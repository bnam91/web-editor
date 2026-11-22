/* rp-u4-variant-wiring — U4 패널을 «기본이 아닌» 갈래까지 열어 본다. (교차 지적: 조건부로 빠진 절/줄을 null 가드 없이 집으면
 *   그 뒤 배선이 통째로 죽는데, 게이트는 기본 갈래만 연다.)
 * V1 갈래마다: 패널 열기 + 컨트롤 하나 조작 → ⑴ pageerror·예외 0 ⑵ 캔버스가 실제로 바뀌었다(컨트롤이 «쓴다» — 배선이 살아 있다).
 *   갈래 = asset(기본·이미지·영상·로고·플로팅) · shape(사각·원·별·가림막) · zoom · annotation(일반·치수선·이미지 라벨) ·
 *          iconify · mockup · gradient · divider · vector(일반·펜 패스) · joker · icon-circle.
 * ★내장 양성대조 P: prop-annotation.js 의 가드 `if (fs && fsN) {` 하나를 떼어 낸 판을 내려보내면(이미지 라벨 갈래엔 글자 크기 칸이 없다)
 *   같은 V1 판정이 그 갈래에서 빨강이 된다 — 이 자가 «가드 없는 조회»를 실제로 잡는다.
 * ⛔화면 px 를 재지 않는다. */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path d="M0 0L10 10"/></svg>';

/* make = 페이지 안에서 돌 함수 본문(블록 element 를 돌려준다) · open = 패널 여는 전역 · ctl = 조작할 컨트롤 */
const V = [
  { name: 'asset 기본', make: `return add('asset-block', () => window.addAssetBlock('standard'));`, open: 'showAssetProperties', ctl: { id: 'asset-overlay-toggle', click: true } },
  { name: 'asset 이미지', make: `const b = add('asset-block', () => window.addAssetBlock('standard')); window.setAssetImageFromSrc(b, ${JSON.stringify(PNG)}); return b;`, open: 'showAssetProperties', ctl: { id: 'asset-clip-toggle', click: true } },   // ★전제 바뀜(현빈 261123 그레인 → Effects «Noise» 카드) — 그림 든 에셋 패널의 다른 공용 칸
  { name: 'asset 영상', make: `const b = add('asset-block', () => window.addAssetBlock('standard')); b.classList.add('has-image'); b.dataset.assetType = 'video-pending'; return b;`, open: 'showAssetProperties', ctl: { id: 'asset-overlay-toggle', click: true } },
  { name: 'asset 로고', make: `return add('asset-block', () => window.addAssetBlock('logo'));`, open: 'showAssetProperties', ctl: { id: 'asset-collab-toggle', click: true } },
  { name: 'asset 플로팅', make: `return add('asset-block', () => window.addAssetBlock('standard'));`, open: 'showAssetProperties', ctl: { id: 'asset-float-toggle', click: true }, after: 'asset-x-number' },
  { name: 'shape 사각', make: `return add('shape-block', () => window.addShapeBlock('rectangle'));`, open: 'showShapeProperties', ctl: { id: 'shape-rot-slider', value: '30' } },
  { name: 'shape 원', make: `return add('shape-block', () => window.addShapeBlock('ellipse'));`, open: 'showShapeProperties', ctl: { id: 'shape-ellipse-count-slider', value: '2' } },
  { name: 'shape 별', make: `return add('shape-block', () => window.addShapeBlock('star'));`, open: 'showShapeProperties', ctl: { id: 'shape-star-count-slider', value: '3' } },
  { name: 'shape 가림막', make: `return add('shape-block', () => window.addShapeBlock('rectangle'));`, open: 'showShapeProperties', ctl: { id: 'shape-redact-toggle', click: true } },
  { name: 'zoom', make: `return add('zoom-block', () => window.addZoomBlock());`, open: 'showZoomProperties', ctl: { sel: 'input[name="zm-bd"][value="on"]', click: true } },
  { name: 'annotation 일반', make: `return annot({});`, open: 'showAnnotationProperties', ctl: { id: 'annot-stroke-w', value: '3' } },
  { name: 'annotation 치수선', make: `return annot({ annotKind: 'dim' });`, open: 'showAnnotationProperties', ctl: { id: 'annot-stroke-w', value: '3' } },
  { name: 'annotation 이미지 라벨', make: `const b = annot({}); b.dataset.labelMode = 'image'; return b;`, open: 'showAnnotationProperties', ctl: { id: 'annot-stroke-w', value: '3' } },
  { name: 'iconify', make: `return add('icon-block', () => window.addIconifyBlock());`, open: 'showIconifyProperties', ctl: { id: 'icn-rot-slider', value: '30' } },
  { name: 'mockup', make: `return add('mockup-block', () => window.addMockupBlock());`, open: 'showMockupProperties', ctl: { id: 'mkp-width-slider', value: '300' } },
  { name: 'gradient', make: `return add('gradient-block', () => window.addGradientBlock());`, open: 'showGradientProperties', ctl: { id: 'grad-width-slider', value: '500' } },
  { name: 'divider', make: `return add('divider-block', () => window.addDividerBlock());`, open: 'showDividerProperties', ctl: { id: 'dvd-style', value: 'dashed' } },
  { name: 'vector 일반', make: `return add('vector-block', () => window.addVectorBlock(${JSON.stringify(SVG)}, { w: 120, h: 120 }));`, open: 'showVectorProperties', ctl: { id: 'vb-rotate-deg', value: '30' } },
  { name: 'vector 펜 패스', make: `const b = add('vector-block', () => window.addVectorBlock(${JSON.stringify(SVG)}, { w: 120, h: 120 })); b.dataset.penNodes = JSON.stringify([{ x: 0, y: 0 }, { x: 10, y: 10 }]); b.dataset.penClosed = '1'; return b;`, open: 'showVectorProperties', ctl: { id: 'vb-stroke-w', value: '5' } },
  { name: 'joker', make: `return add('joker-block', () => window.addJokerBlock());`, open: 'showJokerProperties', ctl: { id: 'joker-x-slider', value: '100' } },
  { name: 'icon-circle', make: `return add('icon-circle-block', () => window.addIconCircleBlock());`, open: 'showIconCircleProperties', ctl: { id: 'icb-border-select', value: 'solid' } },
];

async function scene(page) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(async () => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); await window.addSection(); const sec = c.querySelector('.section-block'); window.__secEl = () => sec; });
  return errs;
}

/** 한 갈래 — 만들고 · 열고 · 조작하고 · 잰다. 예외는 «던지지 않고» 값으로 돌려준다(그래야 다음 갈래로 간다). */
const runVariant = (page, v) => page.evaluate(async ({ v }) => {
  const sec = window.__secEl();
  const add = (cls, fn) => { window.deselectAll?.(); window.selectSection(sec); const b0 = new Set(sec.querySelectorAll('.' + cls)); fn(); const f = [...sec.querySelectorAll('.' + cls)].find((x) => !b0.has(x)); if (!f) throw new Error('새 ' + cls + ' 없음'); return f; };
  const annot = (o) => { const b = window.makeAnnotationBlock({ points: [[200, 160], [500, 160]], text: '라벨', ...o }); sec.querySelector('.section-inner').appendChild(b); window.bindAnnotationSelect?.(b); return b; };
  const res = { exc: null, wrote: false, after: null };
  try {
    const b = await (new Function('add', 'annot', v.make))(add, annot);
    window[v.open](b);
    const el = v.ctl.id ? document.getElementById(v.ctl.id) : document.querySelector(v.ctl.sel);
    if (!el) throw new Error('컨트롤 없음: ' + (v.ctl.id || v.ctl.sel));
    const before = document.getElementById('canvas').innerHTML;
    if (v.ctl.click) el.click();
    else { el.value = v.ctl.value; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }
    await new Promise((r) => setTimeout(r, 50));
    res.wrote = document.getElementById('canvas').innerHTML !== before;
    if (v.after) res.after = !!document.getElementById(v.after);
  } catch (e) { res.exc = String(e && e.stack || e).slice(0, 300); }
  return res;
}, { v });

async function judgeAll(page) {
  const errs = await scene(page);
  const out = [];
  for (const v of V) {
    const n0 = errs.length;
    const r = await runVariant(page, v);
    out.push({ name: v.name, exc: r.exc, pageErrors: errs.slice(n0), wrote: r.wrote, after: r.after, wantAfter: !!v.after });
  }
  return out;
}

test('V1 갈래 전부 — 예외·pageerror 0 · 컨트롤 하나가 캔버스에 쓴다', async ({ page }) => {
  const out = await judgeAll(page);
  console.log('[V1] ' + JSON.stringify(out.map((o) => [o.name, !o.exc && !o.pageErrors.length, o.wrote])));
  expect(out.filter((o) => o.exc || o.pageErrors.length).map((o) => `${o.name}: ${o.exc || o.pageErrors.join(' | ')}`), '★갈래에서 배선이 죽었다').toEqual([]);
  expect(out.filter((o) => !o.wrote).map((o) => o.name), '★조작했는데 캔버스가 안 바뀐 갈래(배선이 안 걸렸다)').toEqual([]);
  expect(out.filter((o) => o.wantAfter && !o.after).map((o) => o.name), '★플로팅 뒤 X/Y 칸이 없다').toEqual([]);
});

test('P ★양성대조 — annotation 가드 하나를 떼면 «이미지 라벨» 갈래가 빨강', async ({ page }) => {
  await scene(page);
  const fs = require('fs'); const path = require('path');
  const src = fs.readFileSync(path.join(__dirname, '..', '..', 'js/props/prop-annotation.js'), 'utf8');
  expect(src.split('if (fs && fsN) {').length - 1, '[전제] 가드가 정확히 한 자리').toBe(1);
  // 나중에 건 route 가 먼저 돈다 — bootApp 의 정적 서버보다 앞에서 이 파일만 바꿔 내려보낸다
  await page.route('**/js/props/prop-annotation.js', (r) => r.fulfill({ contentType: 'text/javascript', body: src.replace('if (fs && fsN) {', '{') }));
  await page.reload();
  await page.waitForFunction(() => typeof window.rebindAll === 'function' && typeof window.groupSelectedBlocks === 'function', null, { timeout: 20000 });
  await page.evaluate(async () => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); await window.addSection(); const sec = c.querySelector('.section-block'); window.__secEl = () => sec; });
  const img = await runVariant(page, V.find((v) => v.name === 'annotation 이미지 라벨'));
  expect(img.exc, '★가드를 뗐는데 이미지 라벨 갈래가 안 죽는다 — 자가 가드 없는 조회를 못 본다').not.toBeNull();
  const plain = await runVariant(page, V.find((v) => v.name === 'annotation 일반'));
  expect(plain.exc, '[대조] 일반 갈래(글자 칸 있음)는 같은 판에서도 산다').toBeNull();
});
