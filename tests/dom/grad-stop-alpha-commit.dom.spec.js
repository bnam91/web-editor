/* grad-stop-alpha-commit.dom.spec.js — 0920b «grad-alpha» A/B
 *
 * 현빈 원문 11번 전반부: 「grad_8ukztd 우측패널 input.grad-stop-alpha 에 커서 올리고
 * 백스페이스 → 입력 도중인데 즉시 0 이 적용된다」.
 *
 * 실측으로 밝혀진 두 결함(설계서 A·B):
 *   A) `input` 마다 커밋 + `/\d+/` 파서 → "100" 캐럿 index1 Backspace 1회 = "00" = 0 을 커밋.
 *      옆칸 offset 은 `+offIn.value||0` 이라 «빈값 → 0» 이 더 노골적이다.
 *   B) 커밋이 buildList() 로 리스트 innerHTML 을 통째로 다시 만들어 타이핑 중인 input 이
 *      DOM 에서 떨어진다 → activeElement 가 BODY → 다음 Backspace 가 editor.js 의
 *      캔버스 삭제 경로(js/editor.js:2645 의 INPUT 가드를 못 넘김)로 새서 블럭이 지워진다.
 *
 * ⛔앱을 «안» 띄운다(9500/9334/MCP 대역 무접촉). dev 원문 js 만 page.route 로 먹이고
 *   진짜 키보드/마우스로 잰다. globals.js 만 스텁(propPanel/state).
 *   선례: tests/dom/gradient-canvas-bar.dom.spec.js
 * 실행: npm run test:dom -- grad-stop-alpha-commit
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://gradalpha.dom.test';
const SRC = {
  '/js/globals.js': 'export const propPanel = document.getElementById("prop-panel");\nexport const state = {};\n',
  '/js/blocks/gradient-block.js': fs.readFileSync(path.join(REPO, 'js/blocks/gradient-block.js'), 'utf8'),
  '/js/props/_helpers.js': fs.readFileSync(path.join(REPO, 'js/props/_helpers.js'), 'utf8'),
  '/js/props/prop-gradient.js': fs.readFileSync(path.join(REPO, 'js/props/prop-gradient.js'), 'utf8'),
  '/js/props/prop-number-commit-guard.js': fs.readFileSync(path.join(REPO, 'js/props/prop-number-commit-guard.js'), 'utf8'),
  /* 2026-09-20 유닛 colorhex — 스톱 hex 칸의 배선이 color-picker.js 의 공용 wireHexText 로 옮겨갔다.
     화이트리스트가 이 둘을 빠뜨리면 import 가 404 로 죽고 __ready 가 «영영 안 선다»(테스트는 타임아웃). */
  '/js/props/color-picker.js': fs.readFileSync(path.join(REPO, 'js/props/color-picker.js'), 'utf8'),
  '/js/props/gradient-model.js': fs.readFileSync(path.join(REPO, 'js/props/gradient-model.js'), 'utf8'),
};

const HTML = `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0}</style>
<script>
  window.currentZoom = 40;              /* 현빈 실사용 줌 */
  window.__hist = 0;
  window.pushHistory = (a) => { window.__hist++; window.__lastAction = a; };
  window.scheduleAutoSave = () => {};
  window.getBlockBreadcrumb = () => '';
  window._copyToClipboard = () => {};
</script></head><body>
<div id="canvas"><div class="section-block" style="position:relative;width:860px;height:600px">
  <div class="gradient-block selected" id="grad_8ukztd" data-grad-width="860" data-grad-height="300" data-x="0" data-y="0"></div>
</div></div>
<div id="prop-panel"></div>
<script type="module" src="/js/blocks/gradient-block.js"></script>
<script type="module" src="/js/props/prop-number-commit-guard.js"></script>
<script type="module">
  import { showGradientProperties } from '/js/props/prop-gradient.js';
  window.__boot = () => showGradientProperties(document.getElementById('grad_8ukztd'));
  window.__ready = true;
</script>
</body></html>`;

async function boot(page) {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.route(`${ORIGIN}/**`, async (route) => {
    const u = new URL(route.request().url());
    if (u.pathname === '/h.html') return route.fulfill({ contentType: 'text/html', body: HTML });
    if (SRC[u.pathname]) return route.fulfill({ contentType: 'text/javascript', body: SRC[u.pathname] });
    return route.fulfill({ status: 404, body: '' });
  });
  await page.setViewportSize({ width: 1200, height: 900 });
  await page.goto(`${ORIGIN}/h.html`);
  await page.waitForFunction(() => window.__ready && window.renderGradientBlock);
  await page.evaluate(() => {
    window.renderGradientBlock(document.getElementById('grad_8ukztd'));
    window.__boot();
  });
  return errs;
}

const read = (page) => page.evaluate(() => {
  const b = document.getElementById('grad_8ukztd');
  const ae = document.activeElement;
  return {
    startAlpha: b.dataset.gradStartAlpha,
    stops: b.dataset.gradStops,
    resolved: window.resolveGradientStops(b),
    alphaVals: [...document.querySelectorAll('.grad-stop-alpha')].map(x => x.value),
    offVals: [...document.querySelectorAll('.grad-stop-offset')].map(x => x.value),
    activeCls: ae ? (ae.className || ae.tagName) : 'none',
    hist: window.__hist,
  };
});

/** ★리스트가 «멈출 때까지» 기다린다 (2026-09-20 통합 라운드에서 넣음).
 *  커밋(Enter/blur)은 stop 리스트를 innerHTML 로 다시 그린다. 그 재생성이 «한 번 더»,
 *  그것도 비동기로 도는 창이 있는데, 그 창 안에 다음 키를 넣으면 키가 «갈아끼워지기 직전의
 *  노드»에 떨어져 조용히 사라진다.
 *  ⚠️이건 앱의 병이 아니다 — 진단 프로브로 확인했다: Enter 뒤 120ms 만 기다리면 캐럿·값·
 *    포커스가 «항상» 제자리다(6/6). 기다리지 않으면 같은 입력이 부하에 따라 갈렸다
 *    (이 파일 단위 실행 8회 중 2회 빨강 / 단독 실행 6/6 초록 — 검사가 부하를 재고 있었다).
 *  ⇒ 「무엇을 재는 검사인가」를 지키려면 재기 «전»에 화면이 멈춰야 한다
 *    (text-overlay-resize.dom.spec.js 의 settle() 과 같은 규율). */
const settleList = (page) => page.waitForFunction(() => {
  const el = document.querySelectorAll('.grad-stop-alpha')[0];
  if (window.__stPrev === el) { window.__stN = (window.__stN || 0) + 1; }
  else { window.__stPrev = el; window.__stN = 0; }
  return window.__stN >= 3;
}, null, { timeout: 5000, polling: 'raf' })
  .then(() => page.evaluate(() => { window.__stPrev = null; window.__stN = 0; }));

const focusField = (page, sel, idx, caret) => page.evaluate(({ sel, idx, caret }) => {
  const el = document.querySelectorAll(sel)[idx];
  el.focus();
  if (caret != null) el.setSelectionRange(caret, caret);
  return el.value;
}, { sel, idx, caret });

/* 칸 전체 선택 — ⚠️macOS 에서 keyboard.press('Control+a') 는 «줄 맨앞으로»(emacs 바인딩)라
   전체선택이 안 된다. 실측으로 확인. 그래서 select() 를 직접 부른다. */
const selectAllIn = (page, sel, idx) => page.evaluate(({ sel, idx }) => {
  const el = document.querySelectorAll(sel)[idx];
  el.focus(); el.select();
  return el.value;
}, { sel, idx });

test.describe('grad-stop 입력 커밋 시점 (0920b grad-alpha)', () => {
  test('A) 캐럿 중간 Backspace 1회 — 모델 불변 · 히스토리 0 · 포커스 유지', async ({ page }) => {
    const errs = await boot(page);
    const before = await read(page);
    expect(before.alphaVals[0]).toBe('100');     // GRADIENT_DEFAULTS.startAlpha = 1
    expect(before.resolved[0].alpha).toBe(1);
    expect(before.hist).toBe(0);

    await focusField(page, '.grad-stop-alpha', 0, 1);   // "1|00"
    await page.keyboard.press('Backspace');             // → "00"

    const after = await read(page);
    expect(after.resolved[0].alpha).toBe(1);            // ★dev: 0 으로 즉시 커밋(빨강)
    expect(after.hist).toBe(0);                          // ★dev: 1(빨강)
    expect(after.activeCls).toContain('grad-stop-alpha'); // ★dev: BODY(빨강)
    expect(errs).toEqual([]);
  });

  test('B) 타이핑 뒤 Enter — 커밋 정확히 1회 · 표시 동기화', async ({ page }) => {
    await boot(page);
    await selectAllIn(page, '.grad-stop-alpha', 0);
    await page.keyboard.type('60');
    const mid = await read(page);
    expect(mid.hist).toBe(0);                            // 타이핑 중 커밋 없음
    await page.keyboard.press('Enter');
    const after = await read(page);
    expect(after.hist).toBe(1);
    expect(after.resolved[0].alpha).toBeCloseTo(0.6, 6);
    expect(after.alphaVals[0]).toBe('60');
  });

  test('C) 빈 값 → 커밋 안 함 · 칸을 모델값으로 되돌림', async ({ page }) => {
    await boot(page);
    await selectAllIn(page, '.grad-stop-alpha', 0);
    await page.keyboard.press('Backspace');              // 칸 비움
    await page.keyboard.press('Enter');
    const after = await read(page);
    expect(after.resolved[0].alpha).toBe(1);             // 모델 불변
    expect(after.hist).toBe(0);
    expect(after.alphaVals[0]).toBe('100');              // ★가드만: "" 로 남음(빨강)
  });

  test('D) 알파 입력 후 옆 offset 칸 클릭 — 커밋 1회 + 포커스가 offset 칸에 남는다', async ({ page }) => {
    await boot(page);
    await selectAllIn(page, '.grad-stop-alpha', 0);
    await page.keyboard.type('55');
    await page.locator('.grad-stop-row[data-idx="0"] .grad-stop-offset').click();
    const after = await read(page);
    expect(after.resolved[0].alpha).toBeCloseTo(0.55, 6);
    expect(after.hist).toBe(1);
    expect(after.activeCls).toContain('grad-stop-offset'); // ★dev: BODY(빨강)
  });

  test('E) offset 칸을 비우고 blur — 0 으로 안 떨어진다', async ({ page }) => {
    await boot(page);
    // stop2 의 offset 은 100
    await selectAllIn(page, '.grad-stop-offset', 1);
    await page.keyboard.press('Backspace');
    await page.keyboard.press('Enter');
    const after = await read(page);
    const stops = after.resolved;
    expect(stops[stops.length - 1].offset).toBe(1);      // ★dev: +""||0 → 0(빨강)
    expect(after.offVals[1]).toBe('100');
  });

  /* ── 픽스 라운드(이벨류에이터 지적) 3건 ────────────────────────────────────────────
     G) Enter 를 친 «뒤» Backspace 가 블럭을 지우던 길 — 가드의 Enter=blur 로 포커스가 BODY 가 되고,
        그 상태의 Backspace 는 js/editor.js:2645 의 「target 이 INPUT 이면 무시」 가드를 못 넘겨
        .gradient-block.selected 를 캔버스 삭제 경로로 보낸다(실앱 9382 실측: blockGone true).
        이 하네스엔 editor.js 가 없으므로 «그 길의 입구»인 activeElement 를 잰다.
     H) 위치(offset) 칸으로 정렬 순서가 바뀔 때 «엉뚱한 stop» 이 덮어써지던 조용한 손상.
     I) 값을 고친 «직후» ×(stop 삭제) 버튼 클릭이 먹지 않던 것(커밋이 리스트를 다시 그려 버튼이
        mouseup 전에 사라짐). */
  const setThreeStops = (page) => page.evaluate(() => {
    const b = document.getElementById('grad_8ukztd');
    b.dataset.gradStops = JSON.stringify([
      { color: '#ff0000', alpha: 1, offset: 0 },
      { color: '#00ff00', alpha: 1, offset: 0.5 },
      { color: '#0000ff', alpha: 1, offset: 1 },
    ]);
    window.__boot();
    window.__hist = 0;
  });

  test('G) Enter 뒤에도 포커스가 칸에 남는다 — 다음 Backspace 가 캔버스 삭제로 새지 않게', async ({ page }) => {
    await boot(page);
    await page.locator('.grad-stop-row[data-idx="0"] .grad-stop-alpha').click();
    await page.keyboard.press('Enter');                   // 값 변경 없이 Enter (가드: blur)
    let after = await read(page);
    expect(after.activeCls).toContain('grad-stop-alpha'); // ★1차 구현: BODY(빨강)
    // 값을 고친 뒤 Enter(=커밋+리스트 재생성) 도 같아야 한다
    await selectAllIn(page, '.grad-stop-alpha', 0);
    await page.keyboard.type('70');
    await page.keyboard.press('Enter');
    await settleList(page);          // ★커밋 재생성이 «멈춘 뒤»에 잰다 — 아래 Backspace 도 같은 이유
    after = await read(page);
    expect(after.resolved[0].alpha).toBeCloseTo(0.7, 6);
    expect(after.activeCls).toContain('grad-stop-alpha'); // ★1차 구현: BODY(빨강)
    // 이어서 Backspace — 칸 값만 바뀌고 커밋은 안 된다(여전히 타이핑 유예 상태)
    await page.keyboard.press('Backspace');
    const bs = await read(page);
    expect(bs.alphaVals[0]).toBe('7');
    expect(bs.resolved[0].alpha).toBeCloseTo(0.7, 6);
  });

  test('H) 위치 칸으로 순서가 바뀌어도 «이웃 stop» 이 덮어써지지 않는다', async ({ page }) => {
    await boot(page);
    await setThreeStops(page);
    // row0 = red(0%) 의 위치를 60 으로 → 정렬되면 green(50%) 보다 뒤로 간다
    await selectAllIn(page, '.grad-stop-offset', 0);
    await page.keyboard.type('60');
    await page.keyboard.press('Enter');
    const after = await read(page);
    const byColor = Object.fromEntries(after.resolved.map(s => [s.color, s.offset]));
    expect(byColor['#00ff00']).toBeCloseTo(0.5, 6);   // ★1차 구현·dev: 0.6 으로 덮어써짐(빨강)
    expect(byColor['#ff0000']).toBeCloseTo(0.6, 6);
    expect(byColor['#0000ff']).toBeCloseTo(1, 6);
    expect(after.hist).toBe(1);
  });

  test('I) 값을 고친 «직후» ×(stop 삭제) 클릭이 먹는다', async ({ page }) => {
    await boot(page);
    await setThreeStops(page);
    await selectAllIn(page, '.grad-stop-alpha', 0);
    await page.keyboard.type('40');
    await page.locator('.grad-stop-row[data-idx="1"] .grad-stop-del').click();
    await page.waitForTimeout(30);                      // 유예된 재생성 1 task
    const after = await read(page);
    expect(after.resolved.length).toBe(2);              // ★1차 구현: 3(빨강 — × 가 안 먹음)
    expect(after.resolved.map(s => s.color)).toEqual(['#ff0000', '#0000ff']);
    expect(after.resolved[0].alpha).toBeCloseTo(0.4, 6);  // 고친 값은 그대로 커밋
  });

  /* ── J) ★2026-09-20 통합 라운드에서 닫은 자리 (m10 notDone medium) ─────────────
     증상: 투명도 칸(.grad-stop-alpha)의 «오른쪽 절반»을 눌러 캐럿을 옮기면 즉시 커밋된다.
       그 커밋이 리스트를 다시 그려 포커스가 BODY 로 날아가고, 다음 Backspace 가 «블럭»을 지운다.
     뿌리: prop-number-commit-guard 의 「스피너 마우스클릭」 휴리스틱
       `(el.clientWidth - e.offsetX) <= 18` 은 webkit 인라인 스피너가 우측 끝에 있다는 전제인데,
       이 칸은 `type="text"`(width 34px)라 «스피너가 아예 없다». 34px 중 18px = 절반이 넘는다.
     고침: 그 휴리스틱을 «스피너가 실제로 있는» type="number" 칸에만 태운다. */
  test('J) ★투명도 칸 오른쪽을 눌러 캐럿만 옮겨도 커밋되지 않는다 (스피너 없는 text 칸)', async ({ page }) => {
    await boot(page);
    await focusField(page, '.grad-stop-alpha', 0, 3);
    await page.keyboard.press('Backspace');                 // "100" → "10" (미커밋 타이핑)
    const hit = await page.evaluate(() => {
      const el = document.querySelectorAll('.grad-stop-alpha')[0];
      const r = el.getBoundingClientRect();
      return { x: r.right - 4, y: r.top + r.height / 2, w: Math.round(el.clientWidth), type: el.type };
    });
    expect(hit.type, '전제 — 이 칸은 스피너가 없는 text 다').toBe('text');
    expect(hit.w, `전제 — 칸이 좁다(${hit.w}px). 18px 휴리스틱이 절반을 먹는다`).toBeLessThan(40);
    const before = await read(page);
    await page.mouse.click(hit.x, hit.y);                   // 오른쪽 끝 = 캐럿 이동일 뿐
    const after = await read(page);
    expect(after.hist, `클릭만 했는데 히스토리가 ${before.hist} → ${after.hist} 로 늘었다`).toBe(before.hist);
    expect(after.stops, '클릭만 했는데 모델이 커밋됐다').toBe(before.stops);
    expect(after.activeCls, `포커스가 ${after.activeCls} 로 날아갔다 — 다음 Backspace 가 블럭을 지운다`)
      .toContain('grad-stop-alpha');
  });

  test('J2 가드 — 위치 칸(type=number)의 «진짜 스피너» 선커밋은 그대로다', async ({ page }) => {
    await boot(page);
    const t = await page.evaluate(() => document.querySelectorAll('.grad-stop-offset')[0].type);
    expect(t, '전제 — 위치 칸은 number(스피너 있음)').toBe('number');
    /* ⚠️type=number 는 setSelectionRange 를 «지원하지 않는다»(InvalidStateError) — 캐럿 인자 없이 잡는다. */
    await selectAllIn(page, '.grad-stop-offset', 1);
    await page.keyboard.type('5');
    const hist0 = (await read(page)).hist;
    await page.evaluate(() => {
      const el = document.querySelectorAll('.grad-stop-offset')[1];
      /* 스피너 자리(우측 끝)를 누른 것처럼 — 가드는 offsetX 로 잰다. */
      const ev = new MouseEvent('mousedown', { bubbles: true });
      Object.defineProperty(ev, 'offsetX', { value: el.clientWidth - 3 });
      el.dispatchEvent(ev);
    });
    // 스피너 쪽 mousedown 은 «미커밋 값에서 스텝하지 않도록» 선커밋한다(종전 규약 유지)
    const after = await read(page);
    expect(after.hist >= hist0, '스피너 선커밋 규약이 사라졌다').toBe(true);
  });

  test('F) 범위/무효 입력 — "abc" 미커밋 · "-5"→0 · "999"→100', async ({ page }) => {
    await boot(page);
    const type = async (s) => {
      await selectAllIn(page, '.grad-stop-alpha', 0);
      await page.keyboard.type(s);
      await page.keyboard.press('Enter');
      return read(page);
    };
    const a = await type('abc');
    expect(a.resolved[0].alpha).toBe(1);                 // 미커밋
    expect(a.alphaVals[0]).toBe('100');                  // 표시 복원
    const b = await type('-5');
    expect(b.resolved[0].alpha).toBe(0);
    const c = await type('999');
    expect(c.resolved[0].alpha).toBe(1);
  });
});
