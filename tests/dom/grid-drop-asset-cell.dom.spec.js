/* grid-drop-asset-cell — 0.9.13 203 HBQA-ASSET-DND-INTO-GRID-CELL-01(현빈 9510 QA C · GO «그대로 재사용되면 그대로») · 태양
 * 없던 기능: 에셋(그림) 블럭을 그리드 칸에 끌어 놓아도 칸에 안 들어가고 섹션 흐름 자리로 옮겨질 뿐(미카사 실측 2/2).
 * 고침: prop-grid.js grdAssetDropSource·grdDropAssetOnCell — G9 글자 갈래(grdDropTextBlockOnCell)와 같은 길(칸 판정 · 줄 자리 · 이력 한 칸 · 실패 = 원본 제자리) + 끄는 동안 칸 강조(grid-children.js).
 * A1 그림 든 에셋(흐름 · 행째)을 칸(r0,c1)에 놓음 → 칸 그림 줄 +1(imgSrc 같음) · 원본 에셋·그 행 사라짐 · ⌘Z 한 번 = 에셋 제자리 · 줄 없음
 * A2 끄는 동안 칸 위 = 칸 강조(grd-cell-drop-target) — 놓기와 같은 판정
 * N1 그림 없는 빈 에셋 = 안 받음(종전 = 흐름 자리 옮김 · 칸 줄 그대로 · 에셋 남음)
 * 끌기: 진짜 마우스(HTML5 끌기 · grid-drop-textframe-cell 과 같은 기제) · 시작·놓기 점 맨 위 요소 단언 · 고정 대기 0.
 * 양성대조: _patches/hbqa-203-CTL.patch(block-drag.js·section-drag.js 의 grdDropAssetOnCell 갈래 걷음) ⇒ A1 빨강.
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const COLS = '[{&quot;width&quot;:1,&quot;lines&quot;:[{&quot;type&quot;:&quot;body&quot;,&quot;text&quot;:&quot;가&quot;}]},{&quot;width&quot;:1,&quot;lines&quot;:[{&quot;type&quot;:&quot;body&quot;,&quot;text&quot;:&quot;다&quot;},{&quot;type&quot;:&quot;body&quot;,&quot;text&quot;:&quot;라&quot;}]}]';
const SEC = `<div class="section-block" id="sG" data-section="1" data-name="G"><div class="section-hitzone"></div><div class="section-inner" id="sGI">
<div class="gap-block" data-type="gap" style="height:60px"></div>
<div class="row" id="rG"><div class="grid-block" id="gG" data-type="grid" data-gap="24" data-valign="top" data-cols="${COLS}"></div></div>
<div class="gap-block" id="gEnd" data-type="gap" style="height:300px"></div></div></div>`;
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const raf2 = (page) => page.waitForFunction(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(true)))));

async function setup(page, withImage) {
  await page.setViewportSize({ width: 1500, height: 1000 });
  const errs = await bootApp(page);
  const id = await page.evaluate(([SEC, withImage, PNG]) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', SEC);
    window.rebindAll?.(); window.deselectAll?.(); window.renderGridBlock?.(document.getElementById('gG'));
    const S = document.getElementById('sG'); window.selectSection(S);
    const before = new Set(S.querySelectorAll('.asset-block')); window.addAssetBlock();
    const ab = [...S.querySelectorAll('.asset-block')].find(x => !before.has(x)); ab.id = 'abX';
    if (withImage) window.setAssetImageFromSrc(ab, PNG);
    ab.style.width = '200px'; ab.dataset.width = '200';
    const unit = ab.closest('.row') || ab; if (!unit.id) unit.id = 'uX';
    document.getElementById('gEnd').before(unit);   // 그리드 아래 흐름 자리
    window.rebindAll?.(); window.deselectAll?.(); window.clearHistory?.();
    window.__drops = 0; document.addEventListener('drop', () => { window.__drops++; }, true);
    window.__hl = 0; new MutationObserver(() => { if (document.querySelector('.grd-cell-drop-target')) window.__hl++; }).observe(document.getElementById('gG'), { subtree: true, attributes: true, attributeFilter: ['class'] });
    return unit.id;
  }, [SEC, withImage, PNG]);
  await raf2(page);
  return { id, errs };
}
async function stablePoint(page, fn, arg) {
  let prev = await page.evaluate(fn, arg);
  for (let i = 0; i < 30; i++) { await raf2(page); const cur = await page.evaluate(fn, arg); if (cur && prev && cur.x === prev.x && cur.y === prev.y) return cur; prev = cur; }
  return prev;
}
const cellImgs = (page) => page.evaluate(() => [...document.querySelectorAll('#gG [data-r="0"][data-c="1"][data-line]')].filter(e => e.querySelector('img') || e.dataset.type === 'image' || /grd-img/.test(e.className)).length);
const cellLines = (page) => page.evaluate(() => document.querySelectorAll('#gG [data-r="0"][data-c="1"][data-line]').length);

async function dragToCell(page, id) {
  const s = await stablePoint(page, (id) => { const u = document.getElementById(id); u.scrollIntoView({ block: 'nearest' }); const q = (u.querySelector('.asset-block') || u).getBoundingClientRect(); return { x: Math.round(q.left + q.width / 2), y: Math.round(q.top + q.height / 2) }; }, id);
  const d = await stablePoint(page, () => { const l = document.querySelector('#gG [data-r="0"][data-c="1"][data-line="0"]'); const q = l.getBoundingClientRect(); return { x: Math.round(q.left + q.width / 2), y: Math.round(q.bottom + 2) }; });
  const hits = await page.evaluate(([s, d, id]) => { const a = document.elementFromPoint(s.x, s.y), b = document.elementFromPoint(d.x, d.y); return { start: !!a && !!a.closest(`[id="${id}"]`), startHit: a && (a.id || a.className), drop: !!b && !!b.closest('#gG .grd-cell[data-r="0"][data-c="1"]'), dropHit: b && (b.id || b.className) }; }, [s, d, id]);
  expect(hits.start, `시작 점 맨 위 요소 «${hits.startHit}» 가 에셋 단위 #${id} 안이 아니다`).toBe(true);
  expect(hits.drop, `놓는 점 맨 위 요소 «${hits.dropHit}» 가 칸(r0,c1) 안이 아니다`).toBe(true);
  const n0 = await page.evaluate(() => window.__drops);
  await page.mouse.move(s.x, s.y); await page.mouse.down();
  await page.mouse.move(s.x + 10, s.y - 10, { steps: 3 });
  await page.mouse.move(d.x, d.y, { steps: 12 });
  /* 칸 위에 «머무는» 손(1px 흔들고 두 프레임) — 섹션 dragover 는 rAF 로 표시를 늦게 그린다(section-drag.js _innerDragRafId) · 한 번에 훑고 바로 재면 표시 전 · 고정 대기 대신 조건(뜨면 멈춤 · 최대 20번) */
  let hl = false;
  for (let k = 0; k < 20 && !hl; k++) { await page.mouse.move(d.x + (k % 2 ? 1 : -1), d.y, { steps: 1 }); await raf2(page); hl = await page.evaluate(() => !!document.querySelector('#gG .grd-cell[data-r="0"][data-c="1"].grd-cell-drop-target')); }
  await page.mouse.move(d.x, d.y, { steps: 1 });
  await page.mouse.up();
  await page.waitForFunction((n0) => window.__drops > n0, n0, { timeout: 3000 }).catch(() => { throw new Error('drop 이 안 왔다 — 끌기가 시작되지 않았다'); });
  await raf2(page);
  return hl;
}

test('A1·A2 그림 든 에셋 → 칸 그림 줄 +1 · 원본 사라짐 · 끄는 동안 칸 강조 · ⌘Z 한 번 = 제자리', async ({ page }) => {
  const { id, errs } = await setup(page, true);
  const l0 = await cellLines(page), i0 = await cellImgs(page);
  const hl = await dragToCell(page, id);
  const after = await page.evaluate((PNG) => ({ unit: !!document.getElementById('abX'), src: [...document.querySelectorAll('#gG [data-r="0"][data-c="1"] img')].some(im => im.getAttribute('src') === PNG) }), PNG);
  const l1 = await cellLines(page), i1 = await cellImgs(page);
  await page.evaluate(() => window.undo()); await raf2(page);
  const u = await page.evaluate(() => ({ unit: !!document.getElementById('abX') }));
  const l2 = await cellLines(page);
  const hlEver = await page.evaluate(() => window.__hl);   // 끄는 동안 한 번이라도 강조가 붙었나(재는 시점과 무관)
  console.log('[A1 실측]', JSON.stringify({ l0, i0, hl, hlEver, after, l1, i1, u, l2 }));
  expect([l1 - l0, i1 - i0, after.unit, after.src], '★칸 줄 +1(그림) · 원본 에셋 없음 · 같은 그림').toEqual([1, 1, false, true]);
  expect([u.unit, l2], '★⌘Z 한 번 = 에셋 제자리 · 칸 줄 원래대로').toEqual([true, l0]);
  expect(hl, `★A2 끄는 동안 칸 강조(놓기 직전 · 한 번이라도 = ${hlEver})`).toBe(true);   // 마지막 — A1 을 먼저 잰다(수지맥 261123: A2 에서 멈춰 A1 을 못 봄)
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('N1 그림 없는 빈 에셋은 칸에 안 받음(에셋 남음 · 칸 줄 그대로)', async ({ page }) => {
  const { id, errs } = await setup(page, false);
  const l0 = await cellLines(page);
  await dragToCell(page, id);
  const r = await page.evaluate(() => ({ unit: !!document.getElementById('abX') }));
  expect([r.unit, await cellLines(page)], '★빈 에셋 = 안 받음').toEqual([true, l0]);
  expect(errs, errs.join(' | ')).toEqual([]);
});
