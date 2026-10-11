/* editing-line-parity.dom.spec.js — ★★«편집에 들어갔을 때 ★선이 ★몇 겹인가» (2026-10-11 · `1011t1a-1b`)
 *
 * ★★★왜 ★있나 — ★현빈 `1011t1a-1` 「캔버스에서 수정할 때 ★포커스하면 ★아웃라인 ★이상함」이
 *   ★★인용구 ★하나의 병이 ★아니었다. ★★뿌리는 ★★중화 절이다:
 *     `body.sel-ov #canvas .selected:not(.editing)…{ outline-color: transparent !important }`
 *   ⇒ ★★`.editing` 을 ★빼 뒀으니 ★편집에 들어가면 ★★블럭 제 outline 이 ★★되살아난다.
 *   ⇒ ★★그런데 ★오버레이 `.ss-sel-path` 는 ★★편집 중에도 ★계속 그린다(★실측 `ovLive=1`)
 *   ⇒ ★★★같은 색·같은 자리에 ★선이 ★★두 겹이 된다.
 *   ★★텍스트 블럭은 ★안 난다 — `.frame-block[data-text-frame] > .text-block.selected` 가 ★색을 ★되돌린다.
 *   ★★인용구는 ★앞 커밋이 ★닫았다. ★★이 파일은 ★★`grid` 와 ★`modal` 을 ★든다.
 *
 * ★★★이 파일의 ★★가장 큰 위험 = ★★«의도한 표시»를 ★같이 ★죽이는 것이다(★지디 ⑶).
 *   ★grid 는 ★편집 중 ★4겹이었고 ★★그중 ★둘은 ★★제품이 ★일부러 ★그리는 ★표시다:
 *     ⒤ `.grd-cell` ★dashed  = ★칸 경계
 *     ⒥ ★편집 host ★solid    = ★「지금 ★편집하는 칸」(`#canvas .grid-block [contenteditable="true"]`)
 *   ⇒ ★★그래서 ★기대값이 ★★«1겹»이 ★아니다 — ★★★`4 → 3` 이다. ★그 둘은 ★★음성대조로 ★★살아 있음을 ★단언한다.
 *
 * ★★겹 수를 ★★«합»으로만 ★세지 ★않는다 — ★★★«어디에 ★몇 겹»으로 ★가른다(self · desc · ov).
 *   ⛔합만 보면 ★★한 겹이 ★죽고 ★다른 한 겹이 ★생겨도 ★같은 수가 ★나온다.
 *
 * ⚠️★마우스를 ★★치운다 — ⛔안 치우면 `.frame-block:not(.selected) …:hover{outline:none !important}` 가
 *   ★같이 걸려 ★★기준(텍스트)을 ★«0겹»으로 ★재게 된다(★261011 ★실측으로 ★한 번 ★속았다).
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js tests/dom/editing-line-parity.dom.spec.js */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');
const { clickAt } = require('./_click-at.js');

/** ★보이는 outline 을 ★★자리별로 ★센다 ＋ ★블럭 밖 오버레이까지. */
const LAYERS = `(() => {
  const b = window.__pb;
  const vis = (el) => { const cs = getComputedStyle(el);
    return cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0
      && !/transparent|rgba\\(\\s*0,\\s*0,\\s*0,\\s*0\\s*\\)/.test(cs.outlineColor); };
  const desc = [...b.querySelectorAll('*')].filter(vis);
  const ov = [...document.querySelectorAll('.ss-sel-path')].filter(p => {
    const cs = getComputedStyle(p); const r = p.getBoundingClientRect();
    return cs.display !== 'none' && cs.visibility !== 'hidden' && parseFloat(cs.opacity) > 0
      && parseFloat(cs.strokeWidth) > 0 && !/none|transparent|rgba\\(\\s*0,\\s*0,\\s*0,\\s*0\\s*\\)/.test(cs.stroke)
      && r.width > 0 && r.height > 0; }).length;
  const cs = getComputedStyle(b);
  const rd = (e) => { const c = getComputedStyle(e);
    return { cls: String(e.className).slice(0, 60), s: c.outlineStyle, w: c.outlineWidth, c: c.outlineColor }; };
  const ce = [...b.querySelectorAll('[contenteditable="true"]')];
  return {
    self: vis(b) ? 1 : 0, desc: desc.length, ov, lines: (vis(b) ? 1 : 0) + desc.length + ov,
    editing: b.classList.contains('editing'), selected: b.classList.contains('selected'),
    hover: b.matches(':hover'), bg: cs.backgroundColor,
    blockOutlineColor: cs.outlineColor, blockOutlineStyle: cs.outlineStyle, blockOutlineWidth: cs.outlineWidth,
    descOutlines: desc.map(rd), ceHosts: ce.map(rd),
    hostBg: ce.length ? getComputedStyle(ce[0]).backgroundColor : null,
    fillToken: getComputedStyle(document.documentElement).getPropertyValue('--sel-color-fill').trim(),
  };
})()`;

async function scene(page, sid) {
  await page.setViewportSize({ width: 1700, height: 1200 });
  const errs = await bootApp(page);
  await page.evaluate((id) => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', `<div class="section-block" data-section="1" id="${id}"><div class="section-hitzone"></div><div class="section-inner"><div class="gap-block" data-type="gap" style="height:40px"></div></div></div>`);
    window.rebindAll && window.rebindAll();
    window.applyZoom && window.applyZoom(100);
    window.deselectAll && window.deselectAll();
    window.selectSection(document.getElementById(id));
  }, sid);
  return errs;
}
/* ⛔고정 대기 금지 — ★«치워졌나»를 ★조건으로 기다린다(`dom-fixed-wait-census` W3 래칫) */
async function park(page) {
  await page.mouse.move(5, 5);
  await page.waitForFunction(() => !document.querySelector('#canvas :hover'), null, { timeout: 5000 })
    .catch(() => { throw new Error('★마우스를 치웠는데 ★캔버스에 ★:hover 가 ★남았다 — ★기준이 틀어진다'); });
}

/* ══════ E1 ★grid — ★★4겹 → ★3겹. ★★«의도한 표시 ★둘»은 ★살아 있다 ══════════════ */
test('E1 ★★grid — ★편집 중 ★블럭 제 outline 은 ★투명(오버레이와 ★중복 ★0) · ★★칸 경계와 ★편집 칸 표시는 ★★산다', async ({ page }) => {
  const errs = await scene(page, 'sE');
  await page.evaluate(() => {
    /* ★앱 함수로 — ★두 줄: ★평 줄(host=`.grd-line`) ＋ ★뱃지 줄(`line.bg` ⇒ host=`.grd-badge`).
       ★★두 갈래를 ★★한 장면에 둬서 ★★아래 ⒞ 가 ★둘 다 덮이는지 ★잴 수 있게. */
    window.addGridBlock({ cols: [{ lines: [
      { type: 'body', text: '평 줄' },
      { type: 'body', text: '뱃지 줄', bg: '#eeeeee' },
    ] }] });
    window.__g = [...document.querySelectorAll('#sE .grid-block')].pop();
    window.buildLayerPanel && window.buildLayerPanel();
    window.deselectAll && window.deselectAll();
    window.__g.dataset.pb = '1'; window.__pb = window.__g;
  });
  await page.waitForFunction(() => !!window.__g && window.__g.isConnected, null, { timeout: 5000 });
  /* ★전제 — ★★두 갈래가 ★정말 섰나. ⛔뱃지가 ★0개면 ★아래 ⒞ 가 ★★한 갈래만 잰다 */
  const n = await page.evaluate(() => ({
    badge: window.__g.querySelectorAll('.grd-badge').length,
    line: window.__g.querySelectorAll('.grd-line').length,
  }));
  expect(n.badge, `★전제 — ★뱃지 줄(.grd-badge)이 ★1개 섰다. 잰 값 ${JSON.stringify(n)}`).toBe(1);
  expect(n.line >= 1, `★전제 — ★평 줄(.grd-line)이 ★있다. 잰 값 ${JSON.stringify(n)}`).toBe(true);

  const gr = await waitStableRect(page, '[data-pb="1"]');
  await clickAt(page, gr.cx, gr.cy, { sel: '[data-pb="1"]' }, { label: 'E1 grid 고르기' });
  await page.waitForFunction(() => window.__g.classList.contains('selected'), null, { timeout: 5000 });
  await park(page);
  const sel = await page.evaluate((c) => eval(c), LAYERS);
  expect(sel.hover, '★전제 — ★마우스를 ★치웠다').toBe(false);
  expect(sel.ov, `★전제 — ★오버레이 선이 ★1개다(★그게 ★선의 임자다). 잰 값 ${JSON.stringify(sel)}`).toBe(1);
  expect(sel.editing, '★전제 — ★아직 ★편집이 ★아니다').toBe(false);
  expect(sel.self, `★★고른 상태에서 ★블럭 제 outline 은 ★안 보인다(★중화 절이 든다). 잰 색 ${sel.blockOutlineColor}`).toBe(0);

  /* ── ⒜ ★평 줄(`.grd-line`) ★편집 ───────────────────────────────────────────── */
  const lr = await waitStableRect(page, '#sE .grid-block .grd-line');
  await page.mouse.dblclick(lr.cx, lr.cy);
  await page.waitForFunction(() => window.__g.querySelectorAll('[contenteditable="true"]').length === 1, null, { timeout: 5000 })
    .catch(() => { throw new Error('★평 줄 ★더블클릭이 ★편집을 ★안 열었다 — ★이 칸은 ★아무것도 안 잰다'); });
  await park(page);
  const e1 = await page.evaluate((c) => eval(c), LAYERS);
  console.log('★E1 grid 평 줄 = ' + JSON.stringify(e1));
  expect(e1.editing, '★전제 — ★`editing` 이 ★붙었다').toBe(true);
  expect(e1.hover, '★전제 — ★마우스 치움').toBe(false);
  /* ★★주 단언 ⑴ — ★블럭 제 outline 이 ★★투명(★고치기 전 = `rgb(45, 111, 232)`) */
  expect(e1.self,
    `★★편집 중 ★블럭 제 outline 이 ★★안 보여야 한다 — ★오버레이가 ★이미 ★그 선을 ★그린다(중복 0).`
    + ` ★잰 값 self=${e1.self} · 「${e1.blockOutlineStyle} ${e1.blockOutlineWidth} ${e1.blockOutlineColor}」`).toBe(0);
  /* ★★★음성대조 ⑴ — ★칸 경계(dashed)가 ★★살아 있다. ⛔이게 없으면 ★내 고침이 ★기능을 ★끈다 */
  const dashed = e1.descOutlines.filter(d => d.s === 'dashed' && /grd-cell/.test(d.cls));
  expect(dashed.length >= 1,
    `★★★음성대조 — ★칸 경계 ★`+'`.grd-cell`'+`의 ★dashed outline 이 ★★살아 있어야 한다`
    + ` (★`+'`#canvas .grid-block.editing > .grd-inner > .grd-cell`'+`). 잰 자손선 ${JSON.stringify(e1.descOutlines)}`).toBe(true);
  /* ★★★음성대조 ⑵ — ★「지금 ★편집하는 칸」 표시(solid)가 ★★살아 있다 */
  const hostSolid = e1.ceHosts.filter(h => h.s === 'solid');
  expect(hostSolid.length,
    `★★★음성대조 — ★편집 host 의 ★solid outline 이 ★★살아 있어야 한다`
    + ` (★`+'`#canvas .grid-block [contenteditable="true"]`'+` — ★「지금 편집하는 칸」). 잰 host ${JSON.stringify(e1.ceHosts)}`).toBe(1);
  /* ★★주 단언 ⑵ — ★겹을 ★★«자리별»로 가른다. ⛔합만 보면 ★한 겹이 죽고 ★다른 겹이 생겨도 ★같은 수다 */
  expect({ self: e1.self, desc: e1.desc, ov: e1.ov },
    `★★겹의 ★자리 — ★블럭 ★0 ＋ ★자손 ★2(칸 경계 ＋ 편집 칸) ＋ ★오버레이 ★1 = ★★3겹`
    + ` (★고치기 전 = ★1 ＋ 2 ＋ 1 = ★★4겹). 잰 값 ${JSON.stringify(e1)}`).toEqual({ self: 0, desc: 2, ov: 1 });

  /* ── ⒝ ★뱃지 줄(`.grd-badge`) ★편집 — ★★한 줄이 ★두 갈래를 ★다 덮나 ───────────── */
  await page.evaluate(() => window.__g.querySelectorAll('[contenteditable="true"]').forEach(e => e.blur()));
  const br = await page.evaluate(() => {
    const s = document.querySelector('#sE .grid-block .grd-badge');
    const r = s.getBoundingClientRect();
    return { cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
  });
  await page.mouse.dblclick(br.cx, br.cy);
  await page.waitForFunction(() => {
    const h = window.__g.querySelector('[contenteditable="true"]');
    return !!h && h.classList.contains('grd-badge');
  }, null, { timeout: 5000 }).catch(() => { throw new Error('★뱃지 줄 ★편집이 ★안 열렸다 — ★★둘째 갈래를 ★못 잰다'); });
  await park(page);
  const e2 = await page.evaluate((c) => eval(c), LAYERS);
  console.log('★E1 grid 뱃지 줄 = ' + JSON.stringify(e2));
  /* ★★주 단언 ⑶ — ★★`.grd-badge` 갈래에서도 ★블럭 outline 이 ★투명이다
     (⛔`.grd-line` ★한 갈래만 보고 ★닫지 ★않는다 — ★★내가 ★앞 회차에 ★그 갈래만 쟀다) */
  expect(e2.ceHosts.map(h => h.cls.includes('grd-badge')),
    `★전제 — ★★편집 host 가 ★`+'`.grd-badge`'+`다(★둘째 갈래). 잰 host ${JSON.stringify(e2.ceHosts)}`).toEqual([true]);
  expect({ self: e2.self, desc: e2.desc, ov: e2.ov },
    `★★뱃지 갈래도 ★★블럭 ★0 ＋ 자손 ★2 ＋ 오버레이 ★1 = ★3겹이어야 한다. 잰 값 ${JSON.stringify(e2)}`).toEqual({ self: 0, desc: 2, ov: 1 });

  /* ★★음성대조 ⑶ — ★★«고른 상태»와 ★«편집 중»이 ★여전히 ★구별된다(★겹 수가 ★다르다)
     ⇒ ★grid 엔 ★틴트를 ★★안 더했다. ★이 줄이 ★그 판정의 ★근거다 */
  expect(e1.lines > sel.lines,
    `★★고친 뒤에도 ★«편집 중»(${e1.lines}겹)이 ★«고른 상태»(${sel.lines}겹)와 ★구별돼야 한다`
    + ` — ⛔같으면 ★틴트를 ★더해야 한다`).toBe(true);

  expect(errs.map(e => String(e)), '★오류 0').toEqual([]);
});

/* ══════ E2 ★modal — ★★2겹 → ★1겹 ＋ ★★슬롯 틴트로 ★구별 ══════════════════════ */
test('E2 ★★modal — ★편집 중 ★블럭 제 outline 은 ★투명 ＋ ★★슬롯 틴트로 ★«고른 상태»와 ★구별된다', async ({ page }) => {
  const errs = await scene(page, 'sE2');
  await page.evaluate(() => {
    window.addModalBlock();
    window.__m = [...document.querySelectorAll('#sE2 .modal-block')].pop();
    window.buildLayerPanel && window.buildLayerPanel();
    window.deselectAll && window.deselectAll();
    window.__m.dataset.pb = '1'; window.__pb = window.__m;
  });
  await page.waitForFunction(() => !!window.__m && window.__m.isConnected, null, { timeout: 5000 });
  const mr = await waitStableRect(page, '[data-pb="1"]');
  await clickAt(page, mr.cx, mr.cy, { sel: '[data-pb="1"]' }, { label: 'E2 modal 고르기' });
  await page.waitForFunction(() => window.__m.classList.contains('selected'), null, { timeout: 5000 });
  await park(page);
  const sel = await page.evaluate((c) => eval(c), LAYERS);
  expect(sel.hover, '★전제 — ★마우스 치움').toBe(false);
  expect(sel.ov, `★전제 — ★오버레이 ★1개. 잰 값 ${JSON.stringify(sel)}`).toBe(1);
  expect(sel.self, '★전제 — ★고른 상태에선 ★블럭 outline 이 ★안 보인다').toBe(0);

  const slot = await page.evaluate(() => {
    const s = document.querySelector('#sE2 .modal-block [data-mdl-slot]');
    const r = s.getBoundingClientRect();
    return { cx: r.left + r.width / 2, cy: r.top + r.height / 2, cls: String(s.className) };
  });
  await page.mouse.dblclick(slot.cx, slot.cy);
  await page.waitForFunction(() => window.__m.querySelectorAll('[contenteditable="true"]').length === 1, null, { timeout: 5000 })
    .catch(() => { throw new Error('★슬롯 ★더블클릭이 ★편집을 ★안 열었다'); });
  await park(page);
  const ed = await page.evaluate((c) => eval(c), LAYERS);
  console.log('★E2 modal = ' + JSON.stringify({ sel, ed, slot }));
  expect(ed.editing, '★전제 — ★`editing` 이 ★붙었다').toBe(true);
  expect(ed.hover, '★전제 — ★마우스 치움').toBe(false);
  /* ★★주 단언 ⑴ — ★블럭 제 outline 이 ★투명(★고치기 전 = `rgb(45, 111, 232)` · ★2겹) */
  expect({ self: ed.self, desc: ed.desc, ov: ed.ov },
    `★★블럭 ★0 ＋ 자손 ★0 ＋ 오버레이 ★1 = ★★1겹 (★고치기 전 = ★1 ＋ 0 ＋ 1 = ★★2겹).`
    + ` 잰 값 ${JSON.stringify(ed)}`).toEqual({ self: 0, desc: 0, ov: 1 });
  /* ★★음성대조 — ★★편집 host 의 outline 은 ★★여전히 ★꺼져 있다(★그 reset 의 까닭은 ★안 죽었다) */
  expect(ed.ceHosts.map(h => h.s),
    `★★음성대조 — ★슬롯의 ★outline 은 ★★`+'`none`'+` 그대로여야 한다(⛔reset 을 ★뒤집지 ★않았다).`
    + ` 잰 host ${JSON.stringify(ed.ceHosts)}`).toEqual(['none']);
  /* ★★주 단언 ⑵ — ★★구별 — ★슬롯 배경이 ★`--sel-color-fill` 로 ★바뀐다.
     ★기대값을 ★★토큰에서 ★끌어온다 ⇒ ⛔수를 ★손으로 ★안 박는다 · ★그리고 ★★«고른 상태와 ★다르다»를 ★같이 */
  expect(ed.fillToken.length > 0, `★전제 — ★`+'`--sel-color-fill`'+` 토큰이 ★있다. 잰 값 「${ed.fillToken}」`).toBe(true);
  expect(ed.hostBg !== sel.bg,
    `★★★«편집 중»이 ★«고른 상태»와 ★구별돼야 한다 — ★겹 수가 ★★둘 다 ★1 이므로 ★★배경이 ★그 일을 한다.`
    + ` ★잰 슬롯 배경 「${ed.hostBg}」 vs ★블럭 배경 「${sel.bg}」`).toBe(true);
  expect(/rgba?\(/.test(String(ed.hostBg)) && !/rgba\(\s*0,\s*0,\s*0,\s*0\s*\)/.test(String(ed.hostBg)),
    `★★슬롯 배경이 ★★투명이 ★아니어야 한다(⛔투명이면 ★위 단언이 ★★항등식에 가까워진다).`
    + ` 잰 값 「${ed.hostBg}」 · 토큰 「${ed.fillToken}」`).toBe(true);

  expect(errs.map(e => String(e)), '★오류 0').toEqual([]);
});
