/* freehand-pencil-brush — t13A-02(현빈 GO 261119) 연필(N) · 붓(⇧B · 필압 없음) · 떨림 보정(공통 «보정 세기» 하나)
 *   연필 = 맞춘 펜 노드 → 펜과 같은 확정 길(섹션 = 벡터 penNodes · 섹션 밖 = 스크래치 펜 항목) · 붓 = 채운 외곽 벡터(점 편집 없음 · 색 칸으로 색)
 * 칸
 *   H1 N 키 = 연필 · 막대(#fh-bar) · 섹션 안 진짜 끌기(물결) → 벡터 하나 · penNodes 노드 2 이상 · 끈 점 수보다 훨씬 적다 · 패널 «패스 편집»
 *   H2 보정 세기 — 같은 점(물결 200)을 세기 0 과 100 으로 확정 → 100 쪽 노드가 적다(막대 손잡이 진짜 입력)
 *   H3 ⇧B = 붓 · 섹션 안 끌기 → 벡터 하나 · penNodes 없음 · 채운 path · 같은 점 프리셋 둘(양 끝 가늘게·서예)은 모양이 다르다
 *   H4 연필로 섹션 밖에서 끌기 → 스크래치 장(펜 항목 data-goditor-pen) · 섹션 블럭 무변
 *   H5 Esc = 끝(막대 0 · body fh-mode 0) · P(펜) 켜면 연필 꺼짐(서로 배타)
 * 양성대조: _patches/freehand-CTL-no-fit.patch(fitCurve 가 첫·끝 점 직선 한 조각) → H2 빨강(노드 수 같음) · 단위 F1 빨강.
 * ⛔고정 대기 0(expect.poll · 조건 대기).
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitZoomSettled } = require('./_root-harness.js');

async function scene(page) {
  await page.setViewportSize({ width: 1600, height: 1000 });
  const errs = await bootApp(page);
  await page.evaluate(async () => {
    try { localStorage.removeItem('goditor.freehandSmooth'); } catch (_) {}
    document.querySelectorAll('#canvas .section-block').forEach((s) => s.remove());
    await window.addSection();
    window.deselectAll?.();
    document.activeElement?.blur?.();
  });
  await waitZoomSettled(page, await page.evaluate(() => window.currentZoom));
  return errs;
}
const vecs = (page) => page.evaluate(() => [...document.querySelectorAll('#canvas .section-block .vector-block')].map((v) => ({ nodes: v.dataset.penNodes ? JSON.parse(v.dataset.penNodes).length : 0, svg: v.dataset.svg })));
/** 섹션 안 물결 — 화면 점 n 개 */
const wavePts = (page, n = 40) => page.evaluate((n) => { const r = document.querySelector('#canvas .section-block').getBoundingClientRect(); return Array.from({ length: n }, (_, i) => ({ x: r.left + r.width * (0.15 + 0.7 * i / (n - 1)), y: r.top + r.height * 0.5 + 25 * Math.sin(i / 4) })); }, n);
async function drag(page, pts) {
  await page.mouse.move(pts[0].x, pts[0].y); await page.mouse.down();
  for (const p of pts.slice(1)) await page.mouse.move(p.x, p.y);
  await page.mouse.up();
}
const setSmooth = (page, v) => page.evaluate((v) => { const s = document.getElementById('fh-smooth'); s.value = String(v); s.dispatchEvent(new Event('input', { bubbles: true })); }, v);

test('H1 N = 연필 · 섹션 안 끌기 → 펜 노드 벡터(점 적음) · 패스 편집', async ({ page }) => {
  const errs = await scene(page);
  await page.keyboard.press('KeyN');
  await expect(page.locator('#fh-bar'), '★연필 막대').toBeVisible();
  expect(await page.evaluate(() => window.freehandTool()), '[전제] 연필').toBe('pencil');
  const pts = await wavePts(page, 40);
  await drag(page, pts);
  await expect.poll(() => vecs(page).then((v) => v.length), '★벡터 하나').toBe(1);
  const [v] = await vecs(page);
  expect(v.nodes, '★펜 노드 2 이상 · 끈 점(40)보다 훨씬 적다').toBeGreaterThanOrEqual(2);
  expect(v.nodes).toBeLessThan(20);
  await page.keyboard.press('Escape');
  const r = await page.evaluate(() => { const b = document.querySelector('#canvas .vector-block'); b.scrollIntoView({ block: 'center' }); const q = b.getBoundingClientRect(); return { x: q.left + q.width / 2, y: q.top + q.height / 2 }; });
  await page.mouse.click(r.x, r.y);
  await expect(page.locator('#vb-pen-edit'), '★패널 «패스 편집»(펜 데이터)').toBeVisible();
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('H2 보정 세기 — 같은 점, 세기 100 이 0 보다 노드가 적다', async ({ page }) => {
  const errs = await scene(page);
  await page.evaluate(() => window.enterFreehand('pencil'));
  const count = async (s) => { await setSmooth(page, s); return page.evaluate(() => {
    const sec = document.querySelector('#canvas .section-block');
    const pts = Array.from({ length: 200 }, (_, i) => ({ x: 40 + i * 3, y: 150 + 40 * Math.sin(i / 15) + (i % 2 ? 0.8 : -0.8) }));   // 떨림 섞인 물결
    const before = document.querySelectorAll('#canvas .vector-block').length;
    window.commitFreehand(sec, pts, 'pencil');
    const all = document.querySelectorAll('#canvas .vector-block');
    return all.length > before ? JSON.parse(all[all.length - 1].dataset.penNodes).length : -1;
  }); };
  const n0 = await count(0), n100 = await count(100);
  expect(n0, '[전제] 세기 0 도 만들어짐').toBeGreaterThan(0);
  expect(n100, `★세기 100(${n100}) < 세기 0(${n0})`).toBeLessThan(n0);
  expect(await page.evaluate(() => localStorage.getItem('goditor.freehandSmooth')), '★손잡이 값 기억').toBe('100');
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('H3 ⇧B = 붓 · 채운 외곽 벡터(점 편집 없음) · 프리셋 둘 모양 다름', async ({ page }) => {
  const errs = await scene(page);
  await page.keyboard.press('Shift+KeyB');
  expect(await page.evaluate(() => window.freehandTool()), '[전제] 붓').toBe('brush');
  await expect(page.locator('#fh-brush'), '★프리셋 고르기').toHaveCount(1);
  await drag(page, await wavePts(page, 30));
  await expect.poll(() => vecs(page).then((v) => v.length), '★벡터 하나').toBe(1);
  const [v] = await vecs(page);
  expect(v.nodes, '★펜 노드 없음(채운 외곽)').toBe(0);
  expect(/<path [^>]*d="M [^"]+ Z"[^>]*fill="#000000"/.test(v.svg), '★채운 닫힌 path(색 칸이 바꾸는 검정)').toBe(true);
  const ds = await page.evaluate(async () => {
    const sec = document.querySelector('#canvas .section-block'), pts = Array.from({ length: 60 }, (_, i) => ({ x: 40 + i * 4, y: 120 + 30 * Math.sin(i / 8) }));
    const out = [];
    for (const k of ['taper', 'nib']) { const s = document.getElementById('fh-brush'); s.value = k; s.dispatchEvent(new Event('change', { bubbles: true })); const b = window.commitFreehand(sec, pts, 'brush'); out.push(b?.dataset?.svg || ''); }
    return out;
  });
  expect(ds[0] && ds[1] && ds[0] !== ds[1], '★프리셋 둘 = 모양 다름').toBe(true);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('H4 연필 섹션 밖 → 스크래치 펜 항목 · 섹션 블럭 무변', async ({ page }) => {
  const errs = await scene(page);
  const b0 = (await vecs(page)).length, s0 = await page.evaluate(() => document.querySelectorAll('.scratch-item').length);
  await page.evaluate(() => window.enterFreehand('pencil'));
  const pts = await page.evaluate(() => { const c = document.getElementById('canvas').getBoundingClientRect(); return Array.from({ length: 25 }, (_, i) => ({ x: c.right + 60 + i * 6, y: c.top + 150 + 20 * Math.sin(i / 3) })); });
  expect(await page.evaluate((p) => !document.elementFromPoint(p.x, p.y)?.closest('#canvas'), pts[0]), '[전제] 캔버스 밖').toBe(true);
  await drag(page, pts);
  await expect.poll(() => page.evaluate(() => document.querySelectorAll('.scratch-item').length), '★스크래치 +1').toBe(s0 + 1);
  expect((await vecs(page)).length, '★섹션 블럭 무변').toBe(b0);
  const marked = await page.evaluate(async () => { const id = [...document.querySelectorAll('.scratch-item')].pop().dataset.scratchId; const src = document.querySelector(`.scratch-item[data-scratch-id="${id}"] img`).getAttribute('src'); return !!(await window._scratchPenMeta?.(src)); });
  expect(marked, '★펜 항목(섹션에 놓으면 펜 벡터 — t13A-04 길)').toBe(true);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('H5 Esc = 끝 · P(펜) 켜면 연필 꺼짐', async ({ page }) => {
  const errs = await scene(page);
  await page.keyboard.press('KeyN');
  await expect(page.locator('#fh-bar')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#fh-bar'), '★Esc = 막대 0').toHaveCount(0);
  expect(await page.evaluate(() => [window.freehandTool(), document.body.classList.contains('fh-mode')]), '★Esc = 끝').toEqual([null, false]);
  await page.keyboard.press('KeyN');
  await page.keyboard.press('KeyP');
  expect(await page.evaluate(() => [window.freehandTool(), document.body.classList.contains('vpen-mode')]), '★펜 켜면 연필 꺼짐 · 펜 모드').toEqual([null, true]);
  expect(errs, errs.join(' | ')).toEqual([]);
});
