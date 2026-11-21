/* text-fx-soft-shadow — TEXT-FX-BEAUTIFUL-SHADOW-01(현빈 261121 · 피그마 «Beautiful Shadows» 결): 텍스트 Effects «부드러운 그림자» = 각도·높이·세기·색 → 여러 겹
 * 고침: js/fx/soft-shadow.js(셈) · js/effects-soft-shadow.js(명부 식구) · effects-glow.js 합성 문 맨 뒤 겹 · index.html 한 줄
 * F1 드롭다운 «부드러운 그림자» 진짜 고르기 → dataset fxSoft on · 글자칸 computed text-shadow 5겹(아래로 1·2·4·8·12px)
 * F2 카드 «각도» 0 → 겹이 오른쪽으로(x>0 · y=0) · «높이» 20 → 가장 먼 겹 20px
 * F3 [지킴] 옛 «그림자»(shadow* 키) 저장본 — 부드러운 그림자를 더하면 [옛 그림자, 5겹] · ✕ 하면 옛 그림자 글·키 그대로(바이트)
 * F4 내보내기 — PNG 글자 아래 그림자 잉크 늘어남 · HTML 에 5겹 text-shadow · Figma JSON 글자 textShadow 5겹
 * F5 저장 왕복 · undo 1번 = 없음
 * 양성대조: _patches/soft-shadow-CTL.patch(합성 문에서 부드러운 겹 걷음) → F1·F2·F3·F4·F5 빨강.
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitZoomSettled } = require('./_root-harness.js');

const raf = (p) => p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
async function scene(page, { oldShadow = false } = {}) {
  await page.setViewportSize({ width: 1600, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(async (oldShadow) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); await window.addSection(); window.applyZoom?.(100);
    const sec = c.querySelector('.section-block'); sec.id = 'sS'; window.deselectAll(); window.selectSection(sec);
    const before = new Set(sec.querySelectorAll('.text-block')); window.addTextBlock('h1'); const tb = [...sec.querySelectorAll('.text-block')].find((x) => !before.has(x)); tb.id = 'tbS';
    const e = tb.querySelector('[class^="tb-"]'); e.textContent = 'SOFT SHADOW'; delete e.dataset.isPlaceholder; e.style.fontSize = '72px'; e.style.color = '#ffffff';
    if (oldShadow) { /* 옛 텍스트 그림자 저장본 꼴 — shadow* 키 + 인라인 text-shadow(옛 _apply 와 같은 값) */
      Object.assign(e.dataset, { shadowEnabled: 'true', shadowX: '3', shadowY: '3', shadowBlur: '0', shadowColor: '#ff0000', shadowAlpha: '100' }); e.style.textShadow = '3px 3px 0px #ff0000'; }
    window.clearHistory?.();
  }, oldShadow);
  await waitZoomSettled(page, 100);
  return errs;
}
async function openPanel(page) {
  const xy = await page.evaluate(() => { const e = document.querySelector('#tbS [class^="tb-"]'); e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return [r.left + 30, r.top + r.height / 2]; });
  await page.mouse.click(xy[0], xy[1]); await raf(page);
  await page.evaluate(() => { if (!document.querySelector('#panel-right [id$="-fx-add"]')) window.showTextProperties?.(document.getElementById('tbS')); });
  await page.waitForFunction(() => !!document.querySelector('#panel-right [id$="-fx-add"]'), null, { timeout: 5000 });
}
const addSoft = async (page) => { await openPanel(page); const id = await page.evaluate(() => document.querySelector('#panel-right [id$="-fx-add"]').id);
  expect(await page.evaluate((id) => [...document.getElementById(id).options].map((o) => o.value), id), '[전제] 목록에 부드러운 그림자').toContain('soft');
  await page.selectOption('#' + id, 'soft'); await raf(page); };
const ts = (page) => page.evaluate(() => { const e = document.querySelector('#tbS [class^="tb-"]'); return { inline: e.style.textShadow, computed: getComputedStyle(e).textShadow, ds: { ...document.getElementById('tbS').dataset }, eds: { ...e.dataset } }; });
const layers = (css) => String(css || '').split(/,(?![^()]*\))/).map((p) => p.replace(/rgba?\([^)]*\)|#[0-9a-f]{3,8}/gi, '')).filter((p) => /px/.test(p)).map((p) => (p.match(/-?\d*\.?\d+px/g) || []).map(parseFloat));   // 겹 = 괄호 밖 쉼표로 · 색 걷고 px

test('F1 드롭다운 → 5겹', async ({ page }) => {
  const errs = await scene(page);
  await addSoft(page);
  const t = await ts(page);
  const L = layers(t.computed);
  expect([t.ds.fxSoft, L.length, L.map((l) => l[1])], `★5겹 아래로 ${t.computed}`).toEqual(['on', 5, [0.8, 1.5, 3, 6, 12]]);
  expect(errs).toEqual([]);
});

test('F2 각도 0 · 높이 20', async ({ page }) => {
  const errs = await scene(page);
  await addSoft(page);
  await page.evaluate(() => { const b = document.querySelector('[id$="-fxsf-body"]'); if (b?.hidden) document.querySelector('[id$="-fxsf-head"]').click(); });
  const P = await page.evaluate(() => document.querySelector('[id$="-fxsf-card"]').id.replace('-fxsf-card', ''));
  await page.fill(`#${P}-fxsf-angle-num`, '0'); await page.press(`#${P}-fxsf-angle-num`, 'Enter');
  await page.fill(`#${P}-fxsf-height-num`, '20'); await page.press(`#${P}-fxsf-height-num`, 'Enter'); await raf(page);
  const L = layers((await ts(page)).computed);
  expect([L.every((l) => l[0] > 0 && l[1] === 0), L.at(-1)[0]], `★오른쪽 · 먼 겹 20 ${JSON.stringify(L)}`).toEqual([true, 20]);
  expect(errs).toEqual([]);
});

test('F3 [지킴] 옛 그림자 저장본 — 더하고 빼면 그대로', async ({ page }) => {
  const errs = await scene(page, { oldShadow: true });
  const a = await ts(page);
  await addSoft(page);
  const b = await ts(page);
  const L = layers(b.inline);
  expect([L.length, L[0]], `★[옛 그림자, 5겹] ${b.inline}`).toEqual([6, [3, 3, 0]]);
  await page.evaluate(() => window.setFxSoft(document.getElementById('tbS'), { state: 'none' })); await raf(page);
  const c = await ts(page);
  expect([c.inline, c.eds], '★✕ = 옛 글·키 그대로').toEqual([a.inline, a.eds]);
  expect(errs).toEqual([]);
});

test('F4 PNG·HTML·Figma', async ({ page }) => {
  const errs = await scene(page);
  const ink = () => page.evaluate(async () => { const s = document.getElementById('sS'); const r = await window.__exportGate.captureTruth(s, 860, window.__exportGate.sectionBgColor(s)); const d = r.canvas.getContext('2d').getImageData(0, 0, r.canvas.width, r.canvas.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] < 225 && Math.abs(d[i] - d[i + 1]) < 8 && Math.abs(d[i + 1] - d[i + 2]) < 8) n++; return n; });
  const i0 = await ink();
  await addSoft(page);
  const i1 = await ink();
  expect(i1 > i0 + 2000, `★PNG 그림자 잉크 ${i0} → ${i1}`).toBe(true);
  const out = await page.evaluate(async () => {
    let blob = null; const oc = URL.createObjectURL, ok = HTMLAnchorElement.prototype.click; URL.createObjectURL = function (x) { blob = x; return oc.call(URL, x); }; HTMLAnchorElement.prototype.click = function () { if (!this.download) return ok.call(this); };
    try { await window.exportHTMLFile(); } finally { URL.createObjectURL = oc; HTMLAnchorElement.prototype.click = ok; }
    const html = blob ? await blob.text() : ''; const m = /text-shadow:\s*([^;"]+)/.exec(html.slice(html.indexOf('SOFT SHADOW') - 1500, html.indexOf('SOFT SHADOW')));
    const j = await window.buildFigmaExportJSON(['sS']); let tsF = null; const w = (o) => { if (!o || typeof o !== 'object' || tsF) return; if (typeof o.textShadow === 'string' && o.textShadow) { tsF = o.textShadow; return; } Object.values(o).forEach(w); }; w(j);
    return { html: m ? m[1] : '', fig: tsF || '' };
  });
  expect([(out.html.match(/rgba/g) || []).length, (out.fig.match(/rgba/g) || []).length], `★HTML·Figma 5겹 ${JSON.stringify(out).slice(0, 300)}`).toEqual([5, 5]);
  expect(errs).toEqual([]);
});

test('F5 저장 왕복 · undo', async ({ page }) => {
  const errs = await scene(page);
  await addSoft(page);
  const h = await page.evaluate(() => window.getSerializedCanvas());
  await page.evaluate((h) => { const c = document.getElementById('canvas'); c.innerHTML = h; window.rebindAll?.(); }, h); await raf(page);
  expect(layers((await ts(page)).computed).length, '★다시 열기 = 5겹').toBe(5);
  await page.evaluate(() => { window.clearHistory?.(); window.setFxSoft(document.getElementById('tbS'), { height: 30 }); window.undo(); }); await raf(page);
  expect(layers((await ts(page)).computed).at(-1)[1], '★undo = 높이 12').toBe(12);
  expect(errs).toEqual([]);
});
