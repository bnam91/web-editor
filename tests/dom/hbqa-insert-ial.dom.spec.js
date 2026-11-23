/* hbqa-insert-ial — 0.9.13 202 HBQA-INSERT-WITH-IAL-SELECTED-OUTSIDE-SECTION-01(미카사 261123 · 현빈QA ☐6 재현 곁): 떠 있는(IAL) 도형을 고른 채 인포그래픽을 넣으면 새 블럭이 섹션 «밖»(섹션 직속 · 흐름 밖)에 놓여 다음 섹션에 가려짐
 * I1 떠 있는 도형을 진짜 클릭으로 고름 → 컴포넌트 메뉴가 부르는 addInfographicBlock() → 새 그리드 = 그 섹션 «흐름»(.section-inner 안) · 섹션 상자 안 · 섹션 직속 아님
 * ★머리말 고침(지디 261123 지적 · 261124): I1 = «넣는 자리»(t13E-03 efbc57a42 insertAfterSelected — 떠 있는 래퍼 골랐으면 흐름 끝) 지킴일 뿐 «202 고침»이 아니다 — 202 실제 원인 = 넣은 섹션이 핀 484(유튜브 썸네일)라 흐름이 넘침.
 *   현빈 261124 결정 = 넘친 부분은 그냥 안 보임(토스트 없음 · 내보내기 3경로도 잘림) → 아래 P202 가 잰다(지금 제품이 이미 그 꼴 · CTL _patches/hbqa-p202-CTL.patch = 핀 넘침 자름 CSS 걷음 → P202 빨강)
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

/* P202 (현빈 261124 결정: 높이 고정 섹션 = 넘친 부분은 그냥 안 보임 · 토스트 없음 · 내보내기 3경로도 같이 잘림)
 *   장면 = 유튜브 썸네일 섹션(핀 484) + 글 + 떠 있는 도형 고름 → 인포그래픽 넣기 → 섹션 높이 484 그대로 · 핀 밖 그리드 «안 보임»(그 자리 elementFromPoint ≠ 그리드)
 *   · 원래 글 자리 무변 · PNG 높이 = 484 · HTML 섹션 = 484 고정 + 넘침 자름 · Figma JSON heightPin 484(렌더러 섹션 프레임 = 핀 높이 · clipsContent 기본) */
test('P202 핀 섹션(484)에 넣은 인포그래픽 — 넘친 부분 안 보임 · 섹션 484 · 글 자리 무변 · PNG/HTML/Figma 도 484', async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 1200 });
  const errs = await bootApp(page);
  await page.evaluate(async () => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    const s1 = window.addYoutubeThumbSection(); s1.id = 'sP'; s1.style.backgroundColor = '#ffffff'; window.applyZoom?.(100);
    window.deselectAll(); window.selectSection(s1); window.addTextBlock('h1', { content: '썸네일 제목' }); [...s1.querySelectorAll('.text-block')].pop().id = 'tP';
    window.deselectAll(); window.selectSection(s1); const before = new Set(s1.querySelectorAll('.shape-block')); window.addShapeBlock('rectangle');
    const sh = [...s1.querySelectorAll('.shape-block')].find((x) => !before.has(x)); sh.id = 'shP';
    const w = window.OverlayFloat.posElOf(sh); window.OverlayFloat.enterFloat(w); w.style.left = '60px'; w.style.top = '40px'; w.dataset.offsetX = '60'; w.dataset.offsetY = '40';
    window.deselectAll(); s1.scrollIntoView({ block: 'start' });
  });
  await waitZoomSettled(page, 100);
  const t0 = await page.evaluate(() => { const r = document.getElementById('tP').getBoundingClientRect(), s = document.getElementById('sP').getBoundingClientRect(); return [Math.round(r.top - s.top), Math.round(r.left - s.left)]; });
  const p = await page.evaluate(() => { const r = document.getElementById('shP').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  await page.mouse.click(p[0], p[1]); await raf(page);
  await page.evaluate(() => window.addInfographicBlock()); await raf(page); await raf(page);
  const r = await page.evaluate(() => {
    const s = document.getElementById('sP'), g = [...s.querySelectorAll('.grid-block')].pop(), sr = s.getBoundingClientRect(), gr = g.getBoundingClientRect(), t = document.getElementById('tP').getBoundingClientRect();
    const below = gr.bottom > sr.bottom + 2 ? { x: gr.left + gr.width / 2, y: Math.min(innerHeight - 2, (Math.max(gr.top, sr.bottom) + gr.bottom) / 2) } : null;
    const hit = below ? document.elementFromPoint(below.x, below.y) : null;
    return { secH: Math.round(sr.height), overflow: Math.round(gr.bottom - sr.bottom), belowPainted: below ? !!(hit && g.contains(hit)) : null, t1: [Math.round(t.top - sr.top), Math.round(t.left - sr.left)], peek: s.classList.contains('pin-peek') };
  });
  const fig = await page.evaluate(() => { const find = (o) => { if (!o || typeof o !== 'object') return null; if (o.id === 'sP' && 'heightPin' in o) return o; for (const v of Object.values(o)) { const f = find(v); if (f) return f; } return null; }; return find(window.buildFigmaExportJSON(null))?.heightPin ?? null; });
  const png = await page.evaluate(async () => { try { const url = await window.exportSection(document.getElementById('sP'), 'png', 860, { returnDataUrl: true, forceH2C: true }); const i = new Image(); i.src = url; await i.decode(); return { w: i.width, h: i.height }; } catch (e) { return { err: String(e?.message || e).slice(0, 120) }; } });
  const [dh] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), page.evaluate(() => { window.exportHTMLFile(); return null; })]);
  const html = require('fs').readFileSync(await dh.path(), 'utf8');
  const htmlPin = /id="sP"[^>]*data-height-pin="true"|data-height-pin="true"[^>]*id="sP"/.test(html) && /\.section-block\[data-height-pin="true"\]\s*>\s*\.section-inner\s*\{[^}]*overflow-y:\s*clip/.test(html);
  console.log('[P202 실측]', JSON.stringify({ t0, r, fig, png, htmlPin }));
  expect(r.overflow, '[전제] 인포그래픽이 핀 높이를 넘는다(넘침 장면)').toBeGreaterThan(20);
  expect([r.secH, r.peek], '★섹션 484 그대로(전체 보기 꺼짐)').toEqual([484, false]);
  expect(r.belowPainted, '★핀 밖 그리드가 안 보인다').toBe(false);
  expect(r.t1, '★원래 글 자리 무변').toEqual(t0);
  expect(fig, '★Figma JSON 섹션 heightPin 484').toBe(484);
  expect(png.h, `★PNG 높이 = 핀 484 ${JSON.stringify(png)}`).toBe(484);
  expect(htmlPin, '★HTML = 핀 섹션 표식 + 넘침 자름 규칙').toBe(true);
  expect(errs, errs.join(' | ')).toEqual([]);
});
