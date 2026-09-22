/* model-update-alias.dom.spec.js — 「deprecated 전역 별칭도 «끝 표본»을 찍는가」
 *
 * ★왜 이 검사가 있나 (2026-09-22, 팀리드 지적)
 *   js/blocks/grid-block.js:1151~1154 는 개명(duo→grid) «전» 이름을 별칭으로 살려 둔다:
 *       window.updateDuoBlock = updateGridBlock;
 *   러너·스킬 md·다른 맥 CDP 스크립트가 옛 이름으로 부른다(제거는 P1 —
 *   tests/unit/grid-rename-residue.test.mjs ALLOW[0] 이 그 근거를 적어 뒀다).
 *
 *   그런데 js/model-update-history.js 는 «window 속성을 감싸서 덮어쓰는» 부품이다.
 *   ⇒ 「그 대입이 먼저 일어났으니 옛 이름은 «안 감싸진 원본»을 계속 가리키는 것 아닌가」가
 *     자연스러운 의심이고, 그렇다면 **옛 이름으로 부를 때만 끝 표본이 조용히 사라진다**
 *     (그 경로에서만 T-012 ① · T-130 이 되살아난다 — 새 이름으로 시험하면 안 드러난다).
 *
 *   실측 결과는 «감싸진다»다. 단 그건 두 가지가 «둘 다» 참이라서다:
 *     ⑴ install 이 DOMContentLoaded 라 모든 window 대입 «뒤»에 돈다 ⇒ 두 이름이 다 보인다.
 *     ⑵ wrap 의 「이미 감쌌나」 표시가 «래퍼»에 붙는다(원본이 아니다) ⇒ 같은 함수라도
 *        이름마다 제 래퍼가 생긴다.
 *   ⛔둘 중 하나만 깨져도 빨강이 «안» 나고 옛 이름 경로만 조용히 죽는다. 그래서 잠근다.
 *
 * 여기서 재는 것:
 *   A1 두 이름이 «둘 다» 감싸졌다.
 *   A2 ★옛 이름으로 1회 부르면 칸이 «정확히 1» 는다(0 도 2 도 아니다) + ⌘Z 가 되돌린다.
 *   A3 새 이름도 같다(대조 — 옛 이름만 재고 「같겠지」로 넘기지 않는다).
 *   N1 ★음성대조 — 「이미 감쌌나」 표시를 «원본»에 붙이는 변형본이면 한 이름이 안 감싸지고 A2 가 죽는다.
 *      (⛔화석을 베끼지 않는다 — «지금» 소스에서 한 줄을 더해 만든다. 늙으면 변환이 «던진다».)
 *
 * ⛔앱을 «안» 띄운다 — 진짜 js/globals.js + js/history.js + js/insert-history.js +
 *   진짜 js/model-update-history.js 를 크로미움에 얹는다. 그리드 입구는 «모양»만 합성한다
 *   (진짜 grid-block 은 모듈 그래프가 커서 못 얹는데, 이 스펙이 재는 것은 «별칭 이음매»지
 *    그리드의 렌더가 아니다). 그 «모양»이 진짜와 같은지는 아래 ⓪ 가 진짜 파일에서 확인한다.
 *
 * 실행: npm run test:dom -- model-update-alias
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const read = (p) => fs.readFileSync(path.join(REPO, p), 'utf8').replace(/\r\n/g, '\n');

const MUH = read('js/model-update-history.js');
const GRID = read('js/blocks/grid-block.js');

/* ── ⓪ 전제 — 진짜 파일이 «그 모양»인가. 모양이 바뀌면 이 스펙이 늙은 것이니 «던진다». ── */
if (!/^window\.updateDuoBlock = updateGridBlock;$/m.test(GRID)) {
  throw new Error('⛔js/blocks/grid-block.js 의 updateDuoBlock 별칭이 사라졌거나 모양이 바뀌었다 — 이 스펙을 갱신해라');
}
if (!/document\.addEventListener\('DOMContentLoaded', install/.test(MUH)) {
  throw new Error('⛔model-update-history 의 설치 시점이 DOMContentLoaded 가 아니다 — 위 전제 ⑴ 이 늙었다');
}

/* ── 음성대조본 N1 — 「이미 감쌌나」 표시를 «원본»에도 붙인다 ⇒ 둘째 이름이 안 감싸진다 ── */
const MUH_N1 = (() => {
  const anchor = '    modelUpdateWrapped.__modelUpdateWrapped = true;';
  if (!MUH.includes(anchor)) throw new Error('N1 변환이 늙었다 — 래퍼 표시 줄을 못 찾았다');
  const out = MUH.replace(anchor, '    fn.__modelUpdateWrapped = true;   /* N1: 원본에 표시(=버그) */\n' + anchor);
  if (!/fn\.__modelUpdateWrapped = true;/.test(out)) throw new Error('N1 변환이 안 먹었다');
  return out;
})();

/* 진짜 grid-block 과 «같은 차례»: 함수 하나 → window 이름 둘 → (DOMContentLoaded 에) install */
const SETUP_JS = `
function updateGridBlock(id, partial) {
  window.pushHistory?.();                 /* push-before — 진짜 grid-block.js 와 같은 규약 */
  const el = document.getElementById(id);
  if (!el) return { ok: false, code: 'NOT_FOUND' };
  Object.assign(el.dataset, partial);
  return { ok: true };
}
window.updateGridBlock = updateGridBlock;
window.updateDuoBlock  = updateGridBlock;   /* = js/blocks/grid-block.js:1153 */
/* ★감쌌는지를 «정체»로 본다 — __modelUpdateWrapped 표시만 보면 음성대조본이 그 표시를
   원본에 붙이는 순간 검사가 «속는다»(실측: 초판이 그래서 N1 을 통과시켰다).
   ⛔이 안은 템플릿 리터럴이다 — 주석에 백틱을 쓰지 마라(리터럴이 거기서 끊겨 스펙이 안 뜬다). */
window.__origUpdate = updateGridBlock;
`;

const HARNESS_JS = `
import './globals.js';
import './history.js';
const canvas = document.getElementById('canvas');
window.getSerializedCanvas = () => canvas.innerHTML;
window.getLastVideoPendingSidecar = () => null;
window.rebindAll = () => {};
window.applyPageSettings = () => {};
window.buildLayerPanel = () => {};
window.deselectAll = () => { canvas.querySelectorAll('.selected').forEach(e => e.classList.remove('selected')); };
window.scheduleAutoSave = () => {};
window.CANVAS_SEL_BLOCKS_AND_SHAPE = '.grid-block.selected';
window.syncSection = () => {}; window.highlightBlock = () => {}; window.setBlockAnchor = () => {};
window.openPanelForBlock = () => {}; window.showHandlesFor = () => {};
window.__ready = true;
`;

const BODY = `<div id="canvas"><div class="section-block" id="sec"><div class="section-inner" id="inner">
  <div class="grid-block" id="g_new" data-gap="10"></div>
  <div class="grid-block" id="g_old" data-gap="10"></div>
</div></div></div>`;

async function boot(page, variant = 'fix') {
  const muh = variant === 'N1' ? MUH_N1 : MUH;
  await page.route(`${ORIGIN}/**`, async (route) => {
    const u = new URL(route.request().url());
    const js = (body) => route.fulfill({ contentType: 'application/javascript', body });
    if (u.pathname === '/__h.html') {
      return route.fulfill({
        contentType: 'text/html',
        /* ★index.html 과 «같은 순서» — 대입(모듈 대신 플레인)이 먼저, 부품이 그 다음. */
        body: `<!doctype html><html><head><meta charset="utf-8">
          <script src="/__setup.js"></script>
          <script src="/js/insert-history.js"></script>
          <script src="/js/model-update-history.js"></script>
          <script type="module" src="/__h.js"></script>
          </head><body>${BODY}</body></html>`,
      });
    }
    if (u.pathname === '/__setup.js')                  return js(SETUP_JS);
    if (u.pathname === '/__h.js')                      return js(HARNESS_JS);
    if (u.pathname === '/globals.js')                  return js(read('js/globals.js'));
    if (u.pathname === '/history.js')                  return js(read('js/history.js'));
    if (u.pathname === '/js/insert-history.js')        return js(read('js/insert-history.js'));
    if (u.pathname === '/js/model-update-history.js')  return js(muh);
    return route.fulfill({ status: 404, body: '' });
  });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(`${ORIGIN}/__h.html`);
  await page.waitForFunction(() => window.__ready === true);
  /* 설치가 «실제로» 됐는지 — 부재를 통과로 읽지 않는다 */
  await page.waitForFunction(() => (window.__modelUpdateRoster?.() || []).length > 0);
  return errs;
}

/* 한 이름으로 «1회» 부르고 칸 증가와 ⌘Z 를 돌려준다. */
const CALL_ONCE = async ([name, id]) => {
  const wait = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 0))));
  window.clearHistory();
  window.pushHistory('자리잡기');
  await wait();
  const base = window.historyStack.length;
  window[name](id, { gap: '40' });
  await wait();
  const after = { delta: window.historyStack.length - base, gap: document.getElementById(id).dataset.gap };
  window.undo();
  after.afterUndo = document.getElementById(id).dataset.gap;
  return after;
};

test('A1 ★옛 이름(별칭)과 새 이름이 «둘 다» 감싸졌다', async ({ page }) => {
  const errs = await boot(page);
  const r = await page.evaluate(() => ({
    roster: window.__modelUpdateRoster(),
    newWrapped: window.updateGridBlock !== window.__origUpdate,
    oldWrapped: window.updateDuoBlock !== window.__origUpdate,
  }));
  expect(r.roster).toContain('updateGridBlock');
  expect(r.roster).toContain('updateDuoBlock');
  expect(r.newWrapped, '새 이름이 안 감싸졌다').toBe(true);
  expect(r.oldWrapped,
    '★옛 이름(deprecated 별칭)이 «안» 감싸졌다 — 옛 이름으로 부르는 러너·CDP 스크립트에서만 ' +
    '끝 표본이 사라진다(T-012 ① · T-130 이 그 경로에서만 되살아난다). ' +
    'js/model-update-history.js 의 설치 시점(DOMContentLoaded)과 「이미 감쌌나」 표시 자리(래퍼)를 봐라').toBe(true);
  expect(errs).toEqual([]);
});

test('A2 ★옛 이름으로 1회 부르면 칸이 «정확히 1» 는다 (0 도 2 도 아니다)', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(CALL_ONCE, ['updateDuoBlock', 'g_old']);
  expect(r.gap, '입구가 실제로 값을 바꿨는지부터 — 안 바뀌었으면 아래 칸 수는 뜻이 없다').toBe('40');
  expect(r.delta, '★옛 이름 경로의 끝 표본 — 0 이면 안 찍힌 것, 2 면 두 번 찍힌 것(MCP seq 대조가 어긋난다)').toBe(1);
  expect(r.afterUndo, '★⌘Z 가 옛 이름으로 한 변경을 되돌려야 한다').toBe('10');
});

test('A3 새 이름도 같다 (대조 — 옛 이름만 재고 「같겠지」로 넘기지 않는다)', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(CALL_ONCE, ['updateGridBlock', 'g_new']);
  expect(r.gap).toBe('40');
  expect(r.delta).toBe(1);
  expect(r.afterUndo).toBe('10');
});

test('N1 ★[음성대조] 「이미 감쌌나」를 «원본»에 표시하면 한 이름이 안 감싸지고 A2 가 죽는다', async ({ page }) => {
  await boot(page, 'N1');
  const r = await page.evaluate(() => ({
    newWrapped: window.updateGridBlock !== window.__origUpdate,
    oldWrapped: window.updateDuoBlock !== window.__origUpdate,
  }));
  /* 로스터는 이름순이라 updateDuoBlock 이 먼저 감싸지고, 그때 «원본»에 표시가 붙어
     updateGridBlock 이 원본 그대로 돌아온다. 어느 쪽이든 «둘 다 참»은 깨져야 한다. */
  expect(r.newWrapped && r.oldWrapped,
    '★음성대조가 안 먹었다 — 변형본에서도 둘 다 감싸졌다면 A1 은 «통과를 만들어 내는 검사»다').toBe(false);

  const bad = await page.evaluate(CALL_ONCE, [r.oldWrapped ? 'updateGridBlock' : 'updateDuoBlock',
                                              r.oldWrapped ? 'g_new' : 'g_old']);
  expect(bad.gap, '변형본에서도 값은 바뀐다 — 사라지는 건 «칸»이지 동작이 아니다').toBe('40');
  expect(bad.delta, '★안 감싸진 이름은 끝 표본이 «없다»(0) — 이것이 A2 가 막는 고장이다').toBe(0);
});
