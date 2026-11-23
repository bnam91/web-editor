/* hbqa-insert-ial — 0.9.13 202 HBQA-INSERT-WITH-IAL-SELECTED-OUTSIDE-SECTION-01(미카사 261123 · 현빈QA ☐6 재현 곁): 떠 있는(IAL) 도형을 고른 채 인포그래픽을 넣으면 새 블럭이 섹션 «밖»(섹션 직속 · 흐름 밖)에 놓여 다음 섹션에 가려짐
 * I1 떠 있는 도형을 진짜 클릭으로 고름 → 컴포넌트 메뉴가 부르는 addInfographicBlock() → 새 그리드 = 그 섹션 «흐름»(.section-inner 안) · 섹션 상자 안 · 섹션 직속 아님
 * ★결과(태양 261123 srv): 11a67a399 에서 고르는 길 셋(클릭 1·클릭 2·레이어 줄) 모두 초록 = 이미 고쳐져 있다 — t13E-03(efbc57a42 · 261123) 의 insertAfterSelected «떠 있는 래퍼 골랐으면 흐름 끝» 한 줄.
 *   미카사 9510 판은 그 커밋 «전»이었을 것[추정 — 그 판 sha 확인 필요] · 이 파일 = 그 한 줄의 지킴(회귀 방지)
 * 양성대조: _patches/hbqa-202-CTL.patch(drag-utils.js 의 그 한 줄 걷음) ⇒ I1 셋 다 빨강(새 그리드가 섹션 직속 = 흐름 밖 — 202 증상 그대로)
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitZoomSettled } = require('./_root-harness.js');
const raf = (p) => p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

for (const how of ['click1', 'click2', 'layer']) test(`I1-${how} (202) 떠 있는 도형 고른 채(${how}) 인포그래픽 넣기 → 그 섹션 흐름 안(섹션 밖·직속 아님)`, async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 1200 });
  const errs = await bootApp(page);
  const ids = await page.evaluate(async () => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    const s1 = await window.addSection(); s1.id = 'sA'; const s2 = await window.addSection(); s2.id = 'sB'; window.applyZoom?.(100);
    window.deselectAll(); window.selectSection(s1); window.addTextBlock('body');
    window.deselectAll(); window.selectSection(s1); const before = new Set(s1.querySelectorAll('.shape-block')); window.addShapeBlock('rectangle');
    const sh = [...s1.querySelectorAll('.shape-block')].find((x) => !before.has(x)); sh.id = 'shF';
    const w = window.OverlayFloat.posElOf(sh); window.OverlayFloat.enterFloat(w); w.style.left = '60px'; w.style.top = '40px'; w.dataset.offsetX = '60'; w.dataset.offsetY = '40';
    window.deselectAll(); s1.scrollIntoView({ block: 'start' });
    return { wrap: w.id || null };
  });
  await waitZoomSettled(page, 100);
  const p = await page.evaluate(() => { const r = document.getElementById('shF').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  if (how === 'layer') { await page.evaluate(() => window.buildLayerPanel?.()); const q = await page.evaluate(() => { const sh = document.getElementById('shF'), w = window.OverlayFloat.posElOf(sh); const it = [...document.querySelectorAll('.layer-item, .layer-frame, [class*=layer]')].find((x) => x._dragTarget === w || x._dragTarget === sh); if (!it) return null; it.scrollIntoView({ block: 'nearest' }); const r = it.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }); if (q) await page.mouse.click(q[0], q[1]); }
  else { await page.mouse.click(p[0], p[1]); await raf(page); if (how === 'click2') await page.mouse.click(p[0], p[1]); }
  await raf(page);
  const af = await page.evaluate(() => window._activeFrame ? `${window._activeFrame.id}:${window._activeFrame.dataset.overlayBlock || ''}` : null);
  const sel = await page.evaluate(() => [...document.querySelectorAll('#canvas .selected')].map((e) => `${e.id}:${e.className.split(' ')[0]}:${e.dataset.overlayBlock || ''}`));
  const before = await page.evaluate(() => new Set([...document.querySelectorAll('#sA .grid-block')]).size);
  await page.evaluate(() => window.addInfographicBlock()); await raf(page);
  const r = await page.evaluate(() => {
    const s1 = document.getElementById('sA'), g = [...document.querySelectorAll('.grid-block')].pop();
    if (!g) return null;
    let unit = g; while (unit.parentElement && unit.parentElement !== s1 && !unit.parentElement.classList.contains('section-inner')) unit = unit.parentElement;
    const gr = g.getBoundingClientRect(), sr = s1.getBoundingClientRect();
    return { inSec: s1.contains(g), inFlow: !!g.closest('.section-inner') && g.closest('.section-block') === s1, unitParent: unit.parentElement?.classList.contains('section-inner') ? 'inner' : unit.parentElement?.id, insideBox: gr.top >= sr.top - 1 && gr.bottom <= sr.bottom + 1 };
  });
  console.log(`[I1-${how} 실측]`, JSON.stringify({ sel, af, before, r }));
  expect(sel.some((s) => s.startsWith('shF')), '[전제] 떠 있는 도형이 골라졌다').toBe(true);
  expect(r, '★새 인포그래픽 = 섹션 A 흐름 안 · 섹션 상자 안(옛: 섹션 직속 = 흐름 밖 → 다음 섹션에 가려짐)').toEqual({ inSec: true, inFlow: true, unitParent: 'inner', insideBox: true });
  expect(errs, errs.join(' | ')).toEqual([]);
});
