/* section-protect-button-persist — 「🔒 표시는 로드 직후에만 붙는다」를 잠근다
 * ──────────────────────────────────────────────────────────────────────────
 * 무엇이 있었나 (2026-09-22 실앱 실측, 포트 9620, dev fd8f85d):
 *   ⑴ ★작업 중에 만든 섹션은 보호를 켜도 🔒 가 «아예» 안 붙었다.
 *      `setSectionProtected(id, true, …)` 가 부르던 `_refreshProtectionButton` 은
 *      `if (!btn) return;` 으로 시작한다 — 단추가 없으면 아무 일도 안 한다.
 *      단추를 심는 `_hydrateAllSectionsForProtection` 은 init 과 +1500ms «두 번»뿐이고
 *      그 뒤 재부착 경로가 없다. ⇒ 실측: 툴바 [ab, memo, ai-fill] 그대로, 단추 0개.
 *      저장→재열기해야 `st-protected-btn is-on` 으로 붙었다.
 *   ⑵ 붙어 있어도 ⌘Z 한 번에 사라졌다 — `rebindAll`(js/io/save-load.js)의 정리 셀렉터가
 *      `.st-protected-btn` 까지 지웠고, `restoreSnapshot`(js/history.js:225)이 그 rebindAll 을
 *      부른다. 다시 심는 곳이 위 hydrate 뿐이라 «페이지를 다시 열기 전까지» 안 돌아왔다.
 *
 * ⛔★보호 «자체»는 안 풀린다 — `dataset.protected` 에 살고, 삭제 가드
 *   (js/editor.js:2995·3078·3131)가 `window.isSectionProtected` 로 그 dataset 을 읽는다.
 *   실앱 짝 측정(같은 키 Backspace): 비보호 섹션은 지워지고, 단추 없는 보호 섹션은 «안 지워졌다».
 *   ⇒ 이 건은 «데이터 소실»이 아니라 «표시와 입구»다. 그런데 차단 토스트(js/editor.js:3085)가
 *     「🔒 버튼으로 보호 해제 후 삭제하세요」라고 «없는 버튼»을 가리키고, 보호를 끄는 UI 입구는
 *     그 단추의 onclick 하나뿐이라 «막다른 길»이 된다.
 *
 * 고친 자리 둘(짝이다):
 *   ㉠ js/section-protection.js  `setSectionProtected` 가 refresh 가 아니라 **ensure** 를 부른다
 *   ㉡ js/io/save-load.js        정리 셀렉터에 `:not(.st-protected-btn)` 을 더한다
 *
 * ★역전 자가검사(2026-09-22, 반쪽을 «따로» 되돌려 재 봄) — 어느 검사가 어느 반쪽을 잠그나:
 *     ㉠만 되돌림 → P1 · P2 · P3 빨강 / P4 · P5 초록
 *     ㉡만 되돌림 → P3 · P4 빨강      / P1 · P2 · P5 초록
 *   ⇒ ★**P3 은 두 반쪽에 «다» 걸린다** — ㉠이 없으면 단추 자체가 없어 전제가 무너지기 때문이다.
 *     **순수 ㉡ 게이트는 P4 하나**다. ⛔P3 이 빨갛다고 셀렉터부터 보지 마라 — 먼저 P1 을 봐라.
 *
 * ⛔앱을 «안» 띄운다 — 레포 파일만 크로미움에 얹는다.
 * 실행: npm run test:dom -- section-protect-button-persist
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };

function router(page, harness) {
  return page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/__harness.html') return route.fulfill({ contentType: 'text/html; charset=utf-8', body: harness });
    const file = path.join(REPO, decodeURIComponent(url.pathname));
    if (!file.startsWith(REPO) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({ contentType: MIME[path.extname(file)] || 'text/plain', body: fs.readFileSync(file) });
  });
}

/* 섹션 하나 + 툴바(실제 버튼 이름 그대로). ⛔🔒 는 «일부러 안 넣는다» —
   「작업 중에 만든 섹션」이 바로 이 꼴이기 때문이다. */
const HARNESS = `<!doctype html><html><head><meta charset="utf-8"></head><body>
<div id="canvas">
  <div class="section-block" id="sec1" data-name="첫 섹션">
    <div class="section-toolbar">
      <button class="st-btn st-ab-btn" type="button">A/B</button>
      <button class="st-btn st-memo-btn" type="button">📝</button>
      <button class="st-btn st-ai-fill-btn" type="button">✨</button>
    </div>
    <div class="section-inner"></div>
  </div>
</div>
<script src="/js/section-protection.js"></script>
<script>window.__ready = true;</script>
</body></html>`;

async function boot(page) {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await router(page, HARNESS);
  await page.goto(`${ORIGIN}/__harness.html`);
  await page.waitForFunction(() => window.__ready === true);
  /* ★init 의 hydrate 가 이미 돌았을 수 있다 — 「작업 중에 만든 섹션」을 흉내내려면
     그 단추를 걷어내고 시작한다. 걷어냈다는 것 자체를 값으로 확인한다. */
  const removed = await page.evaluate(() => {
    const b = document.querySelector('#sec1 .st-protected-btn');
    if (b) b.remove();
    return !document.querySelector('#sec1 .st-protected-btn');
  });
  expect(removed, '★전제가 안 섰다 — 시작 상태에 🔒 가 남아 있다').toBe(true);
  return errs;
}

const btnState = (page) => page.evaluate(() => {
  const b = document.querySelector('#sec1 > .section-toolbar > .st-protected-btn');
  if (!b) return { exists: false };
  return { exists: true, on: b.classList.contains('is-on'), text: (b.textContent || '').trim(), title: b.title };
});

test('P1 ★작업 중에 켠 보호가 화면에 «뜬다» (단추가 없으면 만든다)', async ({ page }) => {
  const errs = await boot(page);
  expect(errs, `pageerror: ${errs.join(' | ')}`).toEqual([]);
  const before = await btnState(page);
  expect(before.exists, '★전제 — 시작엔 단추가 없다').toBe(false);

  const r = await page.evaluate(() => window.setSectionProtected('sec1', true, '검수 중 — 지우지 말 것'));
  expect(r.ok, '★setSectionProtected 가 실패했다 — 이 검사가 «안 돈» 것이지 통과가 아니다').toBe(true);

  const after = await btnState(page);
  expect(after.exists,
    '★보호를 켰는데 🔒 가 «안» 생겼다 — setSectionProtected 가 _refreshProtectionButton 을 부르면 ' +
    '그 함수는 `if (!btn) return;` 으로 되돌아간다. _ensureProtectionButton 을 불러라').toBe(true);
  expect(after.on, '★단추는 생겼는데 «켜진 꼴»이 아니다').toBe(true);
  expect(after.text, '★자물쇠가 잠긴 모양이 아니다').toBe('🔒');
  expect(after.title, '★사유가 이름표에 안 실렸다').toContain('검수 중');
});

test('P2 ★자리 — 🔒 는 📝 메모 «다음»에 붙는다 (첫 자리를 다투지 않는다)', async ({ page }) => {
  /* 툴바 «첫 자리»는 이미 section-variation(ab)과 section-memo(memo)가 다투는 자리다
     (T-136). 🔒 가 거기 끼면 그 다툼을 키운다 — 그래서 메모 다음이어야 한다. */
  await boot(page);
  await page.evaluate(() => window.setSectionProtected('sec1', true));
  const order = await page.evaluate(() =>
    [...document.querySelectorAll('#sec1 > .section-toolbar > .st-btn')].map(b => b.className.replace('st-btn ', '')));
  const iMemo = order.findIndex(c => c.includes('st-memo-btn'));
  const iProt = order.findIndex(c => c.includes('st-protected-btn'));
  expect(iMemo, '★메모 단추를 못 찾았다 — 검사가 안 돈 것이다').toBeGreaterThanOrEqual(0);
  expect(iProt, `★🔒 자리가 ${iProt} 다(툴바: ${order.join(', ')})`).toBe(iMemo + 1);
});

test('P3 ★rebindAll 의 정리 셀렉터가 🔒 를 «안» 지운다', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => window.setSectionProtected('sec1', true, '사유'));
  /* ★셀렉터를 «소스에서 그대로» 꺼내 쓴다 — 베껴 적으면 늙는다.
     (tests/dom/history-chrome-noise 계열이 정규식에 쓰는 그 방식) */
  const SRC = fs.readFileSync(path.join(REPO, 'js', 'io', 'save-load.js'), 'utf8');
  const m = SRC.match(/toolbar\.querySelectorAll\('([^']+)'\)\.forEach\(el => el\.remove\(\)\)/);
  expect(m, '★rebindAll 의 툴바 정리 셀렉터를 못 찾았다 — 이 검사가 «안 돈» 것이지 통과가 아니다').toBeTruthy();

  const res = await page.evaluate((sel) => {
    const tb = document.querySelector('#sec1 > .section-toolbar');
    /* 죽은 구버전 단추를 하나 넣어 «지우는 일 자체»가 도는지 같이 본다 */
    const dead = document.createElement('button');
    dead.className = 'st-btn st-branch-btn';
    tb.appendChild(dead);
    tb.querySelectorAll(sel).forEach(el => el.remove());
    return {
      protectedKept: !!tb.querySelector('.st-protected-btn'),
      deadRemoved: !tb.querySelector('.st-branch-btn'),
      keptNames: [...tb.querySelectorAll('.st-btn')].map(b => b.className.replace('st-btn ', '')),
    };
  }, m[1]);

  expect(res.deadRemoved,
    '★죽은 단추가 «안» 지워졌다 — 셀렉터가 너무 많이 살린다(이 줄의 본래 일이 사라졌다)').toBe(true);
  expect(res.protectedKept,
    `★🔒 가 지워졌다(남은 것: ${res.keptNames.join(', ')}) — rebindAll 은 restoreSnapshot 이 부르므로 ` +
    '⌘Z 한 번에 표시가 사라지고, 다시 심는 곳이 hydrate(init ＋ 1500ms)뿐이라 ' +
    '«페이지를 다시 열기 전까지» 안 돌아온다').toBe(true);
});

test('P4 ★음성대조 — 그 셀렉터에서 :not(.st-protected-btn) 을 빼면 실제로 지워진다', async ({ page }) => {
  /* P3 의 초록이 «고쳐서»인지 «원래 안 지워져서»인지 가른다. */
  await boot(page);
  await page.evaluate(() => window.setSectionProtected('sec1', true));
  const SRC = fs.readFileSync(path.join(REPO, 'js', 'io', 'save-load.js'), 'utf8');
  const sel = SRC.match(/toolbar\.querySelectorAll\('([^']+)'\)\.forEach\(el => el\.remove\(\)\)/)[1];
  const old = sel.replace(':not(.st-protected-btn)', '');
  expect(old, '★변환이 늙었다 — 셀렉터에 :not(.st-protected-btn) 이 없다(고침이 빠졌다)').not.toBe(sel);

  const gone = await page.evaluate((s) => {
    const tb = document.querySelector('#sec1 > .section-toolbar');
    tb.querySelectorAll(s).forEach(el => el.remove());
    return !tb.querySelector('.st-protected-btn');
  }, old);
  expect(gone, '★옛 셀렉터로도 🔒 가 안 지워진다 — P3 의 초록은 «없어서»가 아니라 «못 봐서»다').toBe(true);
});

test('P5 ★보호 «자체»는 단추와 무관하다 — 가드가 읽는 것은 dataset 이다', async ({ page }) => {
  /* 이 고침이 «보호를 고친 것»으로 잘못 읽히지 않게 못 박는다.
     실앱 짝 측정(2026-09-22, 같은 키 Backspace): 단추가 없어도 보호 섹션은 «안 지워졌다». */
  await boot(page);
  await page.evaluate(() => window.setSectionProtected('sec1', true, '사유'));
  const r = await page.evaluate(() => {
    const sec = document.getElementById('sec1');
    sec.querySelector('.st-protected-btn')?.remove();     // 표시만 없앤다
    return { ds: sec.dataset.protected, guard: window.isSectionProtected(sec), btn: !!sec.querySelector('.st-protected-btn') };
  });
  expect(r.btn, '★전제가 안 섰다 — 단추를 못 걷어냈다').toBe(false);
  expect(r.ds, '★dataset 이 단추를 지웠다고 같이 사라졌다').toBe('true');
  expect(r.guard,
    '★단추가 없다고 보호가 «풀렸다»고 한다 — 삭제 가드(js/editor.js)가 이 값을 읽는다. ' +
    '풀리면 이건 «표시 결함»이 아니라 «데이터 결함»이다').toBe(true);
});
