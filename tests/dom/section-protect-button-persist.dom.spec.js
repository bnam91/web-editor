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

/* ══════════════════════════════════════════════════════════════════════════
   P6~P9 — 「단추는 «있는데» 죽어 있다」와 「만든 섹션엔 아예 없다」 (T-094 나머지 둘)
   ──────────────────────────────────────────────────────────────────────────
   무엇이 있었나 (2026-09-22 실앱 실측, 포트 9626, b8da61c 판):
     ⒜ 이 판에서 «만든» 섹션 4개 전부 st-protected-btn **0개**.
        ⌘Z(rebindAll)가 지나가도 안 생겼다. 손으로 hydrate 를 부르니 그제야 생겼다
        ⇒ 「없는 것」이 아니라 «부르는 데가 없는 것»이었다.
        심는 곳은 _hydrateAllSectionsForProtection(init ＋ +1500ms) 둘뿐이고,
        섹션을 «만드는» js/block-factory.js 는 그걸 안 불렀다.
     ⒞ ★더 나쁜 쪽 — 저장하고 «다시 열면» 단추는 4개 다 보이는데 onclick 이 **null** 이다.
        저장 소독기 sanitizeCanvasHtml(js/io/save-load.js:27)이 on* 을 걷어내고,
        _ensureProtectionButton 은 그 setAttribute 를 `if (!btn) {…}` «안»에서만 했다
        ⇒ 단추가 이미 있으면 다시 안 걸었다.
        실측: 진짜 클릭 주입(hit-test 통과, 843,408) → 팝오버 «안 열림».
        ★양성대조 — 같은 자리에 onclick 만 손으로 되돌리고 같은 좌표를 누르니 열렸다
          ⇒ 「클릭이 안 닿은 것」이 아니라 «핸들러가 없는 것»이 맞다.
     ⇒ 보호를 켜고 끄는 UI 입구가 «다시 연 판에서 통째로» 죽어 있었다. 그리고 차단 토스트
       (js/editor.js)는 그 죽은 단추를 가리킨다.

   고친 자리 둘:
     ㉢ js/section-protection.js  onclick 을 `if (!btn)` «밖»으로 — 있든 없든 매번 건다
     ㉣ js/block-factory.js       섹션을 만들 때 _ensureProtectionButton 을 부른다
     ★역전 자가검사(2026-09-22, 반쪽을 «따로» 되돌려 재 봄):
         ㉢만 되돌림 → **P7 · P8** 빨강 / 나머지 일곱 초록
         ㉣만 되돌림 → **P9** 빨강      / 나머지 여덟 초록
       ⇒ 겹치지 않는다. P7·P8 이 빨갛다고 block-factory 를 보지 말고,
         P9 가 빨갛다고 section-protection 을 보지 마라.
     ⛔이 되돌림을 스크립트로 할 때 «들여쓰기 4칸 줄»을 앵커로 쓰지 마라 —
       6칸 줄이 그걸 품어서(substring) 첫 시도가 조용히 «안 바뀐 채» 9초록을 냈다.
       앵커에 앞 줄바꿈을 붙여 «줄 전체»로 세라.

   ★고친 뒤 실측(같은 포트): 갓 만든 섹션 onclick 있음 · rebindAll 뒤에도 있음 ·
     저장→재열기 2섹션 전부 onclick 있음 · 진짜 클릭 → 팝오버 열림 · 빈 ⌘Z 칸 0.
═══════════════════════════════════════════════════════════════════════════ */

/** 소스에서 `function <이름>(` 부터 중괄호 짝까지 «그대로» 잘라 온다(베끼면 늙는다). */
function cutFn(src, name) {
  const i = src.indexOf(`function ${name}(`);
  if (i < 0) return null;
  const s = src.indexOf('{', i);
  let d = 0;
  for (let k = s; k < src.length; k++) {
    if (src[k] === '{') d++;
    else if (src[k] === '}' && --d === 0) return src.slice(i, k + 1);
  }
  return null;
}

test('P6 ★전제 — 저장 소독기가 🔓 의 onclick 을 «실제로» 걷어낸다', async ({ page }) => {
  /* 이 전제가 바뀌면 ㉢ 의 «까닭»이 달라진다. 말로 두지 않고 그 함수를 꺼내 돌린다. */
  const SRC = fs.readFileSync(path.join(REPO, 'js', 'io', 'save-load.js'), 'utf8');
  const fn = cutFn(SRC, 'sanitizeCanvasHtml');
  expect(fn, '★sanitizeCanvasHtml 을 못 꺼냈다 — 이 검사가 «안 돈» 것이지 통과가 아니다').toBeTruthy();

  await page.goto('about:blank');
  const r = await page.evaluate((fnSrc) => {
    const sanitize = new Function(`${fnSrc}; return sanitizeCanvasHtml;`)();
    const html = '<div class="section-toolbar">'
      + '<button class="st-btn st-protected-btn" onclick="window.toggleSectionProtectionPopover(this)">🔓</button>'
      + '</div>';
    const out = sanitize(html);
    const t = document.createElement('template'); t.innerHTML = out;
    const b = t.content.querySelector('.st-protected-btn');
    return { 단추남았나: !!b, onclick: b ? b.getAttribute('onclick') : '(단추없음)' };
  }, fn);

  expect(r.단추남았나, '★소독기가 단추까지 지운다 — 그러면 이 건의 모양이 «죽은 단추»가 아니다').toBe(true);
  expect(r.onclick,
    '★소독기가 이제 on* 을 «안» 걷는다 — ㉢(매번 다시 걸기)의 까닭이 사라졌다. ' +
    '고침을 지우지 말고 이 주석과 카드를 «먼저» 고쳐라').toBe(null);
});

test('P7 ★_ensureProtectionButton 은 «이미 있는» 단추에도 onclick 을 다시 건다', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(() => {
    const sec = document.getElementById('sec1');
    window._ensureProtectionButton(sec);                       // ⑴ 새로 만든다
    const b = sec.querySelector('.st-protected-btn');
    const 처음 = b.getAttribute('onclick');
    b.removeAttribute('onclick');                              // ⑵ 저장 소독기가 한 짓을 흉내
    const 걷힌뒤 = b.getAttribute('onclick');
    window._ensureProtectionButton(sec);                       // ⑶ 다시 연 뒤 hydrate 가 부른다
    const b2 = sec.querySelector('.st-protected-btn');
    return {
      처음, 걷힌뒤, 되살아남: b2.getAttribute('onclick'),
      같은노드인가: b2 === b,
      단추수: sec.querySelectorAll('.st-protected-btn').length,
      핸들러있나: typeof window.toggleSectionProtectionPopover,
    };
  });
  expect(r.처음, '★처음부터 onclick 이 안 걸린다 — 검사가 «안 돈» 것이다').toBe('window.toggleSectionProtectionPopover(this)');
  expect(r.걷힌뒤, '★전제가 안 섰다 — onclick 을 못 걷어냈다').toBe(null);
  expect(r.되살아남,
    '★다시 연 판에서 🔓 가 «있는데 죽어 있다» — onclick 설정이 `if (!btn)` 안에 있으면 ' +
    '단추가 이미 있을 때 다시 안 걸린다. 보호를 켜고 끄는 UI 입구가 그 onclick 하나뿐이다')
    .toBe('window.toggleSectionProtectionPopover(this)');
  expect(r.같은노드인가, '★단추를 새로 만들어 버렸다 — 켜짐 상태·자리가 흔들린다').toBe(true);
  expect(r.단추수, '★단추가 늘었다 — 부를 때마다 쌓이면 툴바가 «내용»으로 읽혀 T-136 을 키운다').toBe(1);
  expect(r.핸들러있나, '★onclick 이 가리키는 함수가 없다 — 되살려도 눌리지 않는다').toBe('function');
});

test('P8 ★음성대조 둘 — 계측기가 «죽은 단추»를 실제로 본다', async ({ page }) => {
  await boot(page);
  /* ⑴ 행동 대조: 다시 안 부르면 null 로 «남는다»(P7 의 초록이 「못 걷어내서」가 아님) */
  const 남나 = await page.evaluate(() => {
    const sec = document.getElementById('sec1');
    window._ensureProtectionButton(sec);
    const b = sec.querySelector('.st-protected-btn');
    b.removeAttribute('onclick');
    return b.getAttribute('onclick');
  });
  expect(남나, '★안 불렀는데도 onclick 이 돌아온다 — 다른 데서 걸고 있다. P7 은 이 고침을 «안» 잠근다').toBe(null);

  /* ⑵ 모양 대조: 옛 꼴(= setAttribute 가 `if (!btn) {…}` «안»)로 되돌아가면 빨강이어야 한다 */
  const SRC = fs.readFileSync(path.join(REPO, 'js', 'section-protection.js'), 'utf8');
  const fn = cutFn(SRC, '_ensureProtectionButton');
  expect(fn, '★_ensureProtectionButton 을 못 꺼냈다 — 검사가 안 돈 것이다').toBeTruthy();
  const i = fn.indexOf('if (!btn) {');
  expect(i, '★`if (!btn) {` 분기를 못 찾았다 — 모양이 바뀌었다. 이 대조를 다시 써라').toBeGreaterThan(0);
  let d = 0, end = -1;
  for (let k = fn.indexOf('{', i); k < fn.length; k++) {
    if (fn[k] === '{') d++;
    else if (fn[k] === '}' && --d === 0) { end = k; break; }
  }
  const 분기안 = fn.slice(i, end + 1);
  expect(fn, '★onclick 을 거는 줄이 통째로 사라졌다').toContain("setAttribute('onclick'");
  expect(분기안,
    '★onclick 설정이 «단추를 새로 만들 때만» 도는 자리로 돌아갔다 — 저장 소독기가 걷어낸 뒤 ' +
    '다시 안 걸리므로 다시 연 판에서 단추가 죽는다(P6 이 그 전제를 잰다)')
    .not.toContain("setAttribute('onclick'");
});

test('P9 ★섹션을 «만드는» 자리가 🔓 를 심는다 (hydrate 두 번에만 기대지 않는다)', async ({ page }) => {
  /* ⛔block-factory.js 는 통째로 하네스에 못 얹는다(의존이 크다) — 자리를 «소스»로 잰다.
     행동 쪽은 실앱에서 쟀다: 고치기 전 갓 만든 섹션 단추 0개 → 고친 뒤 있음(2026-09-22). */
  const SRC = fs.readFileSync(path.join(REPO, 'js', 'block-factory.js'), 'utf8');
  /* 양성대조 — 이 앵커가 실재하는지 «먼저» 본다. 없으면 아래 초록은 「못 봐서」다. */
  expect(SRC, '★기준 앵커(bindVariationToolbarBtn 호출)가 없다 — 이 검사가 «안 돈» 것이다')
    .toContain('window.bindVariationToolbarBtn(sec)');
  expect(SRC,
    '★섹션을 만드는 자리가 _ensureProtectionButton 을 «안» 부른다 — 심는 곳이 ' +
    '_hydrateAllSectionsForProtection(init ＋ +1500ms) 둘뿐이라 그 뒤에 만든 섹션엔 ' +
    '🔓 가 «아예» 없다(⌘Z 가 지나가도 안 생긴다). 그런데 삭제 차단 토스트는 그 단추를 가리킨다')
    .toContain('window._ensureProtectionButton(sec)');

  /* ⛔«자리»도 같이 못 박는다 — 📝 다음이어야 한다(P2 와 같은 규약). 실제 배치는 하네스로. */
  await boot(page);
  const order = await page.evaluate(() => {
    window._ensureProtectionButton(document.getElementById('sec1'));
    return [...document.querySelectorAll('#sec1 > .section-toolbar > .st-btn')].map(b => b.className.replace('st-btn ', ''));
  });
  const iMemo = order.findIndex(c => c.includes('st-memo-btn'));
  const iProt = order.findIndex(c => c.includes('st-protected-btn'));
  expect(iProt, `★만들 때 심은 🔓 자리가 ${iProt} 다(툴바: ${order.join(', ')}) — 📝 다음이어야 한다`).toBe(iMemo + 1);
});

/* ══════════════════════════════════════════════════════════════════════════
   P10~P11 — 「페이지를 한 번만 옮겨도 🔒 가 죽는다」 (T-139 ③)
   ──────────────────────────────────────────────────────────────────────────
   ★2026-09-22 검수 실측(포트 9652·9661):
     새로고침 직후 onclick=YY → 페이지 한 번 왕복 → **nn** (protected 만 핸들러 소실).
     1·3·6초 기다려도 안 돌아온다.
     실클릭 짝대조 — 왕복한 섹션 🔒 팝오버 «0개» / 같은 툴바 📝 는 «열림» / 갓 만든 섹션 🔒 도 «열림».
   ⛔피해가 «표시»가 아니다 — 🔒·is-on·data-protected 가 그대로 보이는데 눌러도 안 열려서
     **보호를 끌 방법이 없다**. 그리고 앱은 「🔒 버튼으로 보호 해제 후 삭제하세요」라고
     바로 그 죽은 단추를 가리킨다.

   ★왜 났나 — sanitizeCanvasHtml 이 페이지 로드마다 on* 을 걷는다(앱 로그 「[sanitize] … 4건 제거」).
     📝 는 rebindAll 이 _ensureMemoButton 으로 다시 심지만, 🔒 는 C21 의 :not(.st-protected-btn)
     으로 «지워지지만 않게» 됐을 뿐 다시 심는 곳이 hydrate(init ＋ +1500ms) 둘뿐이라 안 돈다.
   ⛔★그리고 이건 «내 앞선 고침이 반만 선» 자리다 — 5c15aa4 는 «만들 때»와 «hydrate»만 덮었고
     rebindAll 을 지나는 길(페이지 전환·복원)이 빠져 있었다.
     ⇒ ★규약: 「onclick 을 걷는 문」이 몇이고 「다시 거는 문」이 몇인지 «짝으로» 세라.

   ★고친 뒤 실측: 같은 왕복에서 **YY**. 고침만 들어낸 음성대조에서 **nn**.
   ⛔이 두 검사는 «소스 모양»만 잰다(save-load.js 는 의존이 커서 하네스에 못 싣는다).
     행동은 실앱에서 쟀다 — 여기 초록을 «행동까지 봤다»로 읽지 마라.
═══════════════════════════════════════════════════════════════════════════ */
const rebindSrc = () => fs.readFileSync(path.join(REPO, 'js', 'io', 'save-load.js'), 'utf8');
/** rebindAll 안에서 «툴바를 다시 묶는» 구간만 떠낸다 — 파일 전체를 보면 import 줄에 속는다. */
function toolbarRebindWindow(src) {
  const i = src.indexOf('_ensureMemoButton(sec)');
  if (i < 0) return null;
  return src.slice(Math.max(0, i - 1500), i + 1500);
}

test('P10 ★rebindAll 이 🔒 의 onclick 도 «다시 건다» (📝 와 짝이다)', () => {
  const src = rebindSrc();
  const win = toolbarRebindWindow(src);
  /* 양성대조 — 기준 앵커가 실재하는지 «먼저». 없으면 아래 초록은 「못 봐서」다. */
  expect(win, '★rebindAll 의 툴바 재바인딩 구간을 못 찾았다 — 이 검사가 «안 돈» 것이다').toBeTruthy();
  expect(win, '★📝 재바인딩이 사라졌다 — 얼개가 바뀌었으니 이 검사를 먼저 고쳐라')
    .toContain('_ensureMemoButton(sec)');
  expect(win,
    '★🔒 를 다시 거는 자리가 «없다» — sanitizeCanvasHtml 이 on* 을 걷으므로 페이지를 한 번만 ' +
    '옮겨도 🔒 가 «보이는데 죽은 단추»가 된다. 그러면 보호를 «끌 방법이 없다»')
    .toContain('_ensureProtectionButton(sec)');
});

test('P11 ★음성대조 — 그 호출만 들어내면 P10 이 실제로 빨개진다', () => {
  const src = rebindSrc();
  /* ★import 나 다른 자리의 같은 이름에 속지 않게 «호출 꼴»만 지운다. */
  const mutated = src.replace(/window\._ensureProtectionButton\(sec\)/g, '__gone__(sec)');
  expect(mutated, '★변환이 늙었다 — 호출 꼴을 못 찾았다(P10 을 먼저 봐라)').not.toBe(src);
  const win = toolbarRebindWindow(mutated);
  expect(win, '★변형본에서 구간을 못 찾았다').toBeTruthy();
  expect(win.includes('_ensureProtectionButton(sec)'),
    '★호출을 지웠는데도 P10 이 찾아낸다 — P10 의 초록은 «있어서»가 아니라 «못 봐서»다').toBe(false);
  /* ⛔그리고 «📝 쪽은 그대로»여야 한다 — 변환이 옆집까지 지우면 대조가 무의미하다 */
  expect(win, '★변환이 📝 까지 지웠다 — 대조가 너무 넓다').toContain('_ensureMemoButton(sec)');
});
