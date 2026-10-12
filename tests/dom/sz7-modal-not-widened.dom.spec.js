/* sz7-modal-not-widened.dom.spec.js
 *   ★★«그리드 허용목록이 ★모달로 ★새면 안 된다»를 ★★«행위»로 ★재는 자.
 *
 * ══ ★★왜 이 파일이 생겼나 — ★★«재는 자»가 ★없었다 ════════════════════════════
 *   ★수지⑦ 은 ★공용 sanitizer 를 ★`(html, opts)` 로 바꿔 ★★«허용목록을 ★소비자가 준다»로 갔다.
 *   ★그리드만 ★`GRID_RICH_TEXT_OPTS`(class `tb-hl`·`tb-dot` ＋ `--tb-dot-i`)를 ★넘기고,
 *   ★★모달은 ★`opts` 를 ★★안 넘긴다 ⇒ ★모달의 ★공격면은 ★무변이어야 한다.
 *   ★그 금지선을 ★★나는 ★주석으로 적었다(`js/block-drag.js` import 머리말).
 *   ★★그런데 ★2026-10-08 ★⑥ 무력화 ★E 가 ★★0 을 냈다 — ★★모달 호출에 ★그 목록을 ★억지로 넣어도
 *     ★★새로 빨개지는 검사가 ★★0건이었다 ⇒ ★★★그 금지선은 ★«주석으로만» 살고 ★★집행되지 ★않았다.
 *   ⇒ ★★「★규칙은 ★«재는 자»가 있어야 ★집행된다」(지디). ★★이 파일이 ★그 «재는 자»다.
 *
 * ══ ★★새는 자리가 ★★둘이다 — ★둘 다 잰다 ═══════════════════════════════════
 *   ★N1 ★★렌더 — `js/blocks/modal-block.js:471` `sanitizeRichTextHtml(htmlValue)` (★opts 없음)
 *   ★N2 ★★커밋 — `js/block-drag.js:336` `sanitizeRichTextHtml(host.innerHTML)` (★opts 없음)
 *   ⇒ ★★한쪽에만 ★새도 ★빨개져야 한다 ⇒ ★★두 칸을 ★따로 둔다.
 *
 * ══ ★★양성대조를 ★★한 쌍으로 ═══════════════════════════════════════════════
 *   ⛔「`tb-hl` 이 ★없다」만 ★재면 ★★«sanitize 가 ★전부 지웠다»와 ★구분되지 ★않는다.
 *   ⇒ ★같은 입력의 ★`<b>` 는 ★★산다를 ★같이 단언한다(★기본 허용목록은 ★제 일을 한다).
 *
 * ⛔이 검사가 ★★«지금 제품에서 ★빨강»이면 ★그건 ★★«이미 새고 있다»는 뜻이고 ★★버그다.
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js sz7-modal-not-widened
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');

const SEC = '<div class="section-block" id="sA" data-section="1" data-name="sA" style="background-color:#ffffff"><div class="section-hitzone"></div><div class="section-inner" id="inA"></div></div>';
/* ★그리드에서는 ★살고 ★모달에서는 ★죽어야 하는 꼴 ＋ ★둘 다에서 ★살아야 하는 꼴(`<b>`) */
const LEAK = '<span class="tb-hl">BBB</span><span class="tb-dot" style="--tb-dot-i:0">C</span><b>DDD</b>';
const OUTSIDE = { x: 800, y: 960 };

async function setup(page) {
  await page.setViewportSize({ width: 1600, height: 1000 });
  const errs = await bootApp(page);
  await page.evaluate((html) => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', html);
    window.rebindAll?.(); window.deselectAll?.(); window.applyZoom?.(100);
    document.getElementById('sA').classList.add('selected');
  }, SEC);
  await page.waitForTimeout(250);
  return errs;
}

async function addModal(page) {
  const id = await page.evaluate(() => {
    const before = new Set([...document.querySelectorAll('#canvas [id]')].map(e => e.id));
    document.getElementById('sA').classList.add('selected');
    window.addModalBlock?.({});
    const f = [...document.querySelectorAll('#canvas .modal-block')].filter(e => !before.has(e.id));
    return f.length ? f[f.length - 1].id : null;
  });
  await page.waitForTimeout(400);
  await page.mouse.click(OUTSIDE.x, OUTSIDE.y);   // 자동 진입한 편집을 닫는다
  await page.waitForTimeout(350);
  return id;
}

const slotState = (page, id) => page.evaluate((i) => {
  const b = document.getElementById(i);
  const el = b?.querySelector('[data-mdl-slot="text"]');
  return {
    storedHtml: b?.dataset?.textHtml ?? null,
    rendered: el ? el.innerHTML : null,
    hlCls: el ? el.querySelectorAll('span.tb-hl').length : -1,
    dotCls: el ? el.querySelectorAll('span.tb-dot').length : -1,
    bTags: el ? el.querySelectorAll('b,strong').length : -1,
  };
}, id);

test('N1 ★★렌더 — 모달 저장본에 tb-hl·tb-dot 이 있어도 ★걷힌다 (＋`<b>` 는 산다)', async ({ page }) => {
  const errs = await setup(page);
  const id = await addModal(page);
  expect(id, '★모달이 안 들어갔다 — 아래는 아무것도 안 잰다').toBeTruthy();
  /* ★저장본이 ★변조된 꼴 — ★그리드 쪽에서 ★복사해 온 마크업을 ★흉낸다 */
  await page.evaluate(([i, h]) => {
    const b = document.getElementById(i);
    b.dataset.textText = 'BBBCDDD';
    b.dataset.textHtml = h;
    window.renderModalBlock?.(b);
  }, [id, LEAK]);
  await page.waitForTimeout(300);
  const s = await slotState(page, id);
  console.log('  N1:', JSON.stringify(s));
  expect(s.rendered, '★전제 — 아무것도 안 그려졌다(그러면 아래 「없다」가 ★공짜다)').toBeTruthy();
  /* ★★양성대조 먼저 — ★기본 허용목록이 ★제 일을 한다 */
  expect(s.bTags, `★전제/양성 — ★기본 허용 ★`+'`<b>`'+` 조차 걷혔다 ⇒ ★sanitize 가 ★전부 지우는 자가 됐다. 잰 값 ${JSON.stringify(s)}`).toBeGreaterThan(0);
  /* ★★본단언 — ★그리드 전용 class 가 ★모달 렌더에 ★살아남으면 ★★금지선이 ★새고 있다 */
  expect(s.hlCls, `★★모달 렌더에 ★`+'`tb-hl`'+` 이 ★살아남았다 ⇒ ★★그리드 허용목록이 ★모달로 ★샜다(modal-block.js:471 에 opts 가 넘어갔나?). 잰 값 ${JSON.stringify(s)}`).toBe(0);
  expect(s.dotCls, `★★모달 렌더에 ★`+'`tb-dot`'+` 이 ★살아남았다 ⇒ ★같은 누수. 잰 값 ${JSON.stringify(s)}`).toBe(0);
  expect(/--tb-dot-i/.test(s.rendered), `★★모달 렌더에 ★`+'`--tb-dot-i`'+` 가 ★살아남았다 ⇒ ★같은 누수. 잰 값 ${s.rendered}`).toBe(false);
  expect(errs).toEqual([]);
});

test('N2 ★★커밋 — 모달 편집에서 tb-hl 을 넣고 커밋해도 ★저장본에 안 남는다', async ({ page }) => {
  const errs = await setup(page);
  const id = await addModal(page);
  const sel = `#${id} [data-mdl-slot="text"]`;
  await page.locator(sel).first().scrollIntoViewIfNeeded();
  const r = await waitStableRect(page, sel);
  await page.mouse.dblclick(r.cx, r.cy);
  await page.waitForTimeout(400);
  expect(await page.evaluate((s) => document.querySelector(s)?.getAttribute('contenteditable'), sel),
    '★전제 — 모달 슬롯 편집에 못 들어갔다').toBe('true');
  /* ★편집 중 ★호스트에 ★그리드 꼴 마크업을 ★심는다 — ★«사람이 붙여넣기로 가져오는» 길의 흉내 */
  await page.evaluate(([s, h]) => { const el = document.querySelector(s); if (el) el.innerHTML = h; }, [sel, LEAK]);
  await page.waitForTimeout(150);
  await page.mouse.click(OUTSIDE.x, OUTSIDE.y);   // 커밋 = _modalEndEdit
  await page.waitForTimeout(500);
  const s = await slotState(page, id);
  console.log('  N2:', JSON.stringify(s));
  /* ★★양성대조 — ★커밋 경로가 ★살아 있나(★서식이 ★하나라도 저장됐나) */
  expect(s.storedHtml, `★전제/양성 — ★커밋이 ★Html 키를 ★안 만들었다 ⇒ ★이 칸은 ★누수를 ★못 잰다. 잰 값 ${JSON.stringify(s)}`).toBeTruthy();
  expect(/<b\b|<strong\b/i.test(String(s.storedHtml)), `★전제/양성 — ★저장본에 ★`+'`<b>`'+` 가 ★없다 ⇒ ★커밋 sanitize 가 ★전부 지웠다. 잰 값 ${JSON.stringify(s)}`).toBe(true);
  /* ★★본단언 — ★그리드 전용 class 가 ★모달 ★저장본에 ★남으면 ★금지선이 ★샜다 */
  expect(/class="tb-hl"|class='tb-hl'/.test(String(s.storedHtml)), `★★모달 ★저장본에 ★`+'`tb-hl`'+` 이 ★남았다 ⇒ ★★그리드 허용목록이 ★커밋 경로로 ★샜다(block-drag.js:336 에 opts 가 넘어갔나?). 잰 값 ${JSON.stringify(s)}`).toBe(false);
  expect(/tb-dot|--tb-dot-i/.test(String(s.storedHtml)), `★★모달 ★저장본에 ★점 꼴이 ★남았다 ⇒ ★같은 누수. 잰 값 ${JSON.stringify(s)}`).toBe(false);
  expect(errs).toEqual([]);
});
