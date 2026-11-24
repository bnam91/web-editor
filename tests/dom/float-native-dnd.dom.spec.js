/* float-native-dnd — FLOAT-DRAG-NATIVE-DND-SWALLOW-01(0.9.13 · 지디 261123 · 125 VECTOR-DUP-ID 표식⑦에서 확정)
 * 결함: 떠 있는(IAL/오버레이) 블럭의 posEl 이 draggable="true" 를 쥔 채면, 마우스로 끌 때 몇 px 뒤 브라우저가 «HTML5 네이티브 끌기»로 넘어가
 *   mousemove/mouseup 을 끊는다(실측 dragstart 1 · drag 10 · mouseup 0) → 떠 있는 끌기(overlay-float.js bindFloatMoveDrag · 문서 mouse* 세션)는
 *   ① 블럭을 못 옮기고 ② 세션이 안 끝나 ③ 다음 «아무» 클릭의 mouseup 에서 onUp → killClick 이 그 클릭을 삼킨다(패널 단추 첫 클릭 먹통).
 * 뿌리: enterFloat(overlay-float.js)이 draggable 을 «일반 프레임» posEl 에만 껐다(t13D-05) — 벡터(vector-block.js 가 블럭 자신에 draggable)는 그대로.
 * F0 측정 — 떠 있는 패널 단추가 있는 11종(벡터·에셋·아이콘·그리드·서클·모달·인증서·비교·프레임·도형·글자)을 띄운 뒤 posEl draggable 표 · 기대 = 전부 «아님»
 * F1(종류마다) 진짜 마우스로 떠 있는 블럭을 아래로 30px 끎 → 정본 offsetY 가 움직이고 · dragstart 0 · 다음 빈 곳 클릭이 문서까지 감(안 삼킴)
 * 양성대조: _patches/float-native-dnd-CTL.patch(overlay-float.js enterFloat 의 «종류 무관 draggable 끔» 을 옛 «일반 프레임만»으로) ⇒ F0 · F1 벡터 빨강.
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitZoomSettled } = require('./_root-harness.js');
const raf = (p) => p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

const SVG = '<svg viewBox="0 0 24 24"><rect x="0" y="0" width="24" height="24" fill="currentColor"/></svg>';
/* 종류 → [만드는 식, 새 블럭 고르는 선택자] — 만들기는 제품 입구(window.add*) 그대로 */
const KINDS = {
  vector:     ['window.addVectorBlock(SVG, { w: 80, h: 80 })', '.vector-block'],
  asset:      ['window.addAssetBlock()', '.asset-block'],
  iconify:    ["window.addIconifyBlock('mdi:square', SVG, 64)", '.icon-block'],
  grid:       ['window.addGridBlock()', '.grid-block'],
  iconCircle: ['window.addIconCircleBlock()', '.icon-circle-block'],
  modal:      ['window.addModalBlock()', '.modal-block'],
  cert:       ['window.addCertBlock()', '.cert-block'],
  comparison: ['window.addComparisonBlock()', '.comparison-block'],
  frame:      ['window.addFrameBlock()', '.frame-block:not([data-text-frame])'],
  shape:      ["window.addShapeBlock('rectangle')", '.shape-block'],
  text:       ["window.addTextBlock('body')", '.text-block'],
};

async function boot(page) {
  await page.setViewportSize({ width: 1600, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(async () => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    const sec = await window.addSection(); sec.id = 'sN'; sec.style.minHeight = '1200px'; window.applyZoom?.(100);
  });
  await waitZoomSettled(page, 100);
  return errs;
}
/* 한 종류를 만들어 띄운다 → { id, posElId, kind, before(띄우기 전 posEl draggable), after(띄운 뒤) } */
const makeFloat = (page, kind) => page.evaluate(([kind, make, sel, svg]) => {
  const SVG = svg, sec = document.getElementById('sN'), OF = window.OverlayFloat;
  window.deselectAll(); window.selectSection(sec);
  const before = new Set(sec.querySelectorAll(sel));
  try { eval(make); } catch (e) { return { kind, err: String(e) }; }   // eslint-disable-line no-eval
  const b = [...sec.querySelectorAll(sel)].find((x) => !before.has(x));
  if (!b) return { kind, err: 'not created' };
  b.id = b.id || ('k_' + kind);
  const w = OF.posElOf(b); if (!w.id) w.id = 'pe_' + kind;
  const dBefore = w.getAttribute('draggable');
  OF.enterFloat(w);
  w.style.left = '80px'; w.style.top = '120px'; w.dataset.offsetX = '80'; w.dataset.offsetY = '120';
  window.deselectAll(); window.clearHistory?.();
  return { kind, id: b.id, posElId: w.id, posElCls: String(w.className).split(' ')[0], before: dBefore, after: w.getAttribute('draggable'), float: w.dataset.overlayBlock };
}, [kind, KINDS[kind][0], KINDS[kind][1], SVG]);

test('F0 측정 — 떠 있는 패널 단추가 있는 11종: 띄운 뒤 posEl 이 draggable 을 쥐지 않는다', async ({ page }) => {
  const errs = await boot(page);
  const rows = [];
  for (const k of Object.keys(KINDS)) rows.push(await makeFloat(page, k));
  console.log('[F0 표]', JSON.stringify(rows));
  expect(rows.filter((r) => r.err).map((r) => `${r.kind}:${r.err}`), '[전제] 11종 다 만들어 띄움').toEqual([]);
  expect(rows.filter((r) => r.float !== 'true').map((r) => r.kind), '[전제] 다 떠 있음').toEqual([]);
  expect(rows.filter((r) => r.after === 'true').map((r) => r.kind), '★띄운 뒤 draggable="true" 를 쥔 종류 = 0 (쥐면 끌기가 HTML5 네이티브로 넘어가 mouseup 이 끊긴다)').toEqual([]);
  expect(errs, errs.join(' | ')).toEqual([]);
});

for (const kind of Object.keys(KINDS)) {
  test(`F1 ${kind} — 떠 있는 것을 마우스로 끌면 옮겨지고 · 네이티브 끌기 0 · 다음 클릭 안 삼킴`, async ({ page }) => {
    const errs = await boot(page);
    const m = await makeFloat(page, kind);
    expect(m.err ?? null, `[전제] ${kind} 만들어 띄움`).toBe(null);
    await page.evaluate((id) => document.getElementById(id).scrollIntoView({ block: 'center' }), m.posElId); await raf(page);
    const [x, y, hitOk] = await page.evaluate((id) => { const w = document.getElementById(id), r = w.getBoundingClientRect(), cx = r.left + Math.min(r.width / 2, 20), cy = r.top + Math.min(r.height / 2, 20), h = document.elementFromPoint(cx, cy); return [cx, cy, !!h && w.contains(h)]; }, m.posElId);
    expect(hitOk, `[전제] 누르는 점이 ${kind} 떠 있는 상자 안`).toBe(true);
    await page.evaluate(() => { window.__ds = 0; window.__dsH = (() => window.__ds++); window.addEventListener('dragstart', window.__dsH, true); });
    const oy0 = await page.evaluate((id) => +document.getElementById(id).dataset.offsetY, m.posElId);
    await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x, y + 15, { steps: 5 }); await page.mouse.move(x, y + 30, { steps: 5 }); await page.mouse.up(); await raf(page);
    const oy1 = await page.evaluate((id) => +document.getElementById(id).dataset.offsetY, m.posElId);
    /* 다음 «진짜» 클릭(놓은 지 150ms 넘어 — killClick 정상 창 밖)이 문서 bubble 까지 가나 */
    await page.evaluate(() => { window.__upAt2 = performance.now(); window.__bub = 0; document.addEventListener('click', () => { window.__bub++; }, { once: true }); });
    await page.waitForFunction(() => performance.now() - window.__upAt2 > 150);
    const pr = await page.evaluate(() => { const p = document.getElementById('panel-right').getBoundingClientRect(); return [p.left + 10, p.bottom - 6]; });
    await page.mouse.click(pr[0], pr[1]); await raf(page);
    const got = await page.evaluate(() => ({ ds: window.__ds, bub: window.__bub }));
    console.log(`[F1 ${kind}]`, JSON.stringify({ m, oy0, oy1, got }));
    expect([got.ds, oy1 - oy0 >= 20, got.bub], `★${kind}: dragstart 0 · 정본 offsetY +30 근처 움직임(${oy0}→${oy1}) · 다음 클릭이 문서까지 감`).toEqual([0, true, 1]);
    expect(errs, errs.join(' | ')).toEqual([]);
  });
}
