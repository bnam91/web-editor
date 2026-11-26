/* ifg-edit-mode.dom.spec.js — 0.9.13 201행 HBQA-INFOGRAPHIC-RESIZE-DBLCLICK-01(현빈 결정 ⓑ «에셋블럭 방식» · 지디 (가) 두 겹 GO 261124 · 시안 #mkp-ifgedit).
 *   옛: 인포그래픽 더블클릭 = 칸 글줄 글자 편집으로 바로 감(미카사 6-4) · 블럭 편집 모드 없음.
 *   E1 두 겹 — 고른 인포그래픽의 제목 글줄 위 더블클릭(진짜 마우스) = «인포그래픽 편집»(패널 · 손잡이 넷) · 글자 편집 아님 → 같은 자리 다시 더블클릭 = 글자 편집 · Esc 두 번 = 끝
 *   E2 배율 80 — 틀(블럭 너비·높이) 그대로(±1) · 제목 글자·아이콘 지름·행/열 간격 = 실제 값 × 0.8(dataset) · ⌘Z 한 번 = 들어가기 전 cells·rows·간격 그대로
 *   E3 범위 — 10 → 바닥(≥50) · 300 → 꽉 찬 배율(auto 행 = 100) · 모서리 안쪽 끌기 = 줄어듦
 *   E4 내보내기 — transform 0 · Figma JSON 같은 크기 틀 · 저장→다시 열기 뒤 같은 글자 크기
 * ⛔고정 대기 0(조건 대기) · 좌표는 waitStableRect 뒤. */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');

async function scene(page) {
  await page.setViewportSize({ width: 1600, height: 1400 });
  const errs = await bootApp(page);
  await page.click('.fp-btn.primary[title^="새 섹션 추가"]');
  await expect.poll(() => page.evaluate(() => !!window.getSelectedSection?.())).toBe(true);
  const id = await page.evaluate(() => window.addInfographicBlock()?.id);
  expect(id, '[전제] 인포그래픽').toBeTruthy();
  await page.evaluate(async (id) => { await (window.whenGridRatiosSettled?.() ?? Promise.resolve()); document.getElementById(id).scrollIntoView({ block: 'center' }); window.clearHistory?.(); }, id);
  await waitStableRect(page, `[id="${id}"]`);
  return { errs, id };
}
const snap = (page, id) => page.evaluate((id) => {
  const g = document.getElementById(id), z = g.getBoundingClientRect().width / g.offsetWidth, r = g.getBoundingClientRect();
  const t = g.querySelector('.grd-cell[data-r="0"][data-c="0"] [data-line] h3, .grd-cell[data-r="0"][data-c="0"] .grd-line[data-line="1"]') || g.querySelector('.grd-cell[data-r="0"][data-c="0"] .grd-line');
  const ic = g.querySelector('.grd-cell[data-r="0"][data-c="0"] .grd-img-frame');
  return { w: Math.round(r.width / z), h: Math.round(r.height / z), font: t ? Math.round(parseFloat(getComputedStyle(t).fontSize)) : null, icon: ic ? Math.round(ic.getBoundingClientRect().width / z) : null,
    cells: g.dataset.cells, rows: g.dataset.rows, cols: g.dataset.cols, rowGap: g.dataset.rowGap, colGap: g.dataset.colGap, editing: !!window.isIfgEditing?.(g), stray: document.querySelectorAll('.ifg-editing').length, panel: !!document.getElementById('ifg-edit-panel'),
    handles: document.querySelectorAll('.ifg-edit-handle').length, ce: !!(document.activeElement && document.activeElement.isContentEditable && g.contains(document.activeElement)), transform: /transform/.test(g.getAttribute('style') || '') || /transform/.test(g.querySelector('.grd-inner')?.getAttribute('style') || '') };
}, id);
const titlePt = (page, id) => page.evaluate((id) => { const g = document.getElementById(id); const el = g.querySelector('.grd-cell[data-r="0"][data-c="0"] [data-line="1"]') || g.querySelector('.grd-cell[data-r="0"][data-c="0"] .grd-line'); const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, id);
const setScale = (page, v) => page.evaluate((v) => { const i = document.getElementById('ifg-edit-scale'); i.value = String(v); i.dispatchEvent(new Event('change', { bubbles: true })); return Number(i.value); }, v);

/** 오른쪽 아래 모서리 손잡이를 블럭 가운데 쪽으로 끈다 — frac = 가운데까지 거리의 몇 배(1 넘으면 가운데를 지나 반대쪽) · steps = 나눠 움직일 횟수 */
async function dragCorner(page, id, frac, steps) {
  const h = await page.evaluate(() => { const r = document.querySelector('.ifg-edit-handle[data-corner="rb"]').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  const c = await page.evaluate((id) => { const r = document.getElementById(id).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, id);
  await page.mouse.move(h.x, h.y); await page.mouse.down();
  for (let i = 1; i <= steps; i++) await page.mouse.move(h.x + (c.x - h.x) * frac * i / steps, h.y + (c.y - h.y) * frac * i / steps);
  await page.mouse.up();
}

async function enter(page, id) {
  const p = await titlePt(page, id);
  await page.mouse.click(p.x, p.y);
  await page.mouse.dblclick(p.x, p.y);
  await expect.poll(() => snap(page, id).then((s) => s.editing), '[전제] 편집 모드').toBe(true);
  return p;
}

test('E1 두 겹 — 더블클릭 = 인포그래픽 편집(글자 편집 아님) · 안에서 다시 더블클릭 = 글자 편집 · Esc 로 끝', async ({ page }) => {
  const { errs, id } = await scene(page);
  const p = await titlePt(page, id);
  await page.mouse.click(p.x, p.y);
  await page.mouse.dblclick(p.x, p.y);
  await expect.poll(() => snap(page, id).then(({ editing, panel, handles, ce }) => ({ editing, panel, handles, ce })), '★편집 모드 · 패널 · 손잡이 넷 · 글자 편집 아님')
    .toEqual({ editing: true, panel: true, handles: 4, ce: false });
  await page.mouse.dblclick(p.x, p.y);
  await expect.poll(() => snap(page, id).then((s) => s.ce), '★편집 모드 안 더블클릭 = 글자 편집(한 겹 더)').toBe(true);
  await page.keyboard.press('Escape');
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Escape');
  await expect.poll(() => snap(page, id).then(({ editing, handles }) => ({ editing, handles })), '★Esc = 끝 · 손잡이 걷힘').toEqual({ editing: false, handles: 0 });
  expect(errs).toEqual([]);
});

test('E2 배율 80 — 틀 그대로 · 실제 값 × 0.8 · ⌘Z 한 번 = 들어가기 전', async ({ page }) => {
  const { errs, id } = await scene(page);
  const s0 = await snap(page, id);
  await enter(page, id);
  expect(await setScale(page, 80), '[전제] 배율 80').toBe(80);
  const s1 = await snap(page, id);
  expect(Math.abs(s1.w - s0.w) <= 1 && Math.abs(s1.h - s0.h) <= 1, `★틀 그대로 ${s0.w}×${s0.h} → ${s1.w}×${s1.h}`).toBe(true);
  expect(Math.abs(s1.font - Math.round(s0.font * 0.8)) <= 1, `★글자 ${s0.font} → ${s1.font}`).toBe(true);
  expect(Math.abs(s1.icon - Math.round(s0.icon * 0.8)) <= 1, `★아이콘 ${s0.icon} → ${s1.icon}`).toBe(true);
  expect(s1.cells, '★실제 값(dataset.cells)이 바뀜').not.toBe(s0.cells);
  await page.keyboard.press('Escape');
  await expect.poll(() => snap(page, id).then((s) => s.editing)).toBe(false);
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Meta+z');
  await expect.poll(() => snap(page, id).then(({ cells, rows, cols, rowGap, colGap }) => ({ cells, rows, cols, rowGap, colGap })), '★⌘Z 한 번 = 들어가기 전 그대로')
    .toEqual({ cells: s0.cells, rows: s0.rows, cols: s0.cols, rowGap: s0.rowGap, colGap: s0.colGap });
  expect(errs).toEqual([]);
});

test('E3 범위 — 바닥 ≥ 50 · 꽉 찬 배율(auto 행 = 100) · 모서리 안쪽 끌기 = 줄어듦', async ({ page }) => {
  const { errs, id } = await scene(page);
  await enter(page, id);
  const lo = await setScale(page, 10);
  expect(lo >= 50 && lo < 100, `★바닥 ${lo}`).toBe(true);
  expect(await setScale(page, 300), '★틀보다 크게 못 키움(auto 행 = 들어갈 때가 꽉 참)').toBe(100);
  const h = await page.evaluate(() => { const r = document.querySelector('.ifg-edit-handle[data-corner="rb"]').getBoundingClientRect(); return { x: r.left + 4, y: r.top + 4 }; });
  const c = await page.evaluate((id) => { const r = document.getElementById(id).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, id);
  await page.mouse.move(h.x, h.y); await page.mouse.down();
  for (let i = 1; i <= 5; i++) await page.mouse.move(h.x + (c.x - h.x) * 0.06 * i, h.y + (c.y - h.y) * 0.06 * i);
  await page.mouse.up();
  const v = await page.evaluate(() => Number(document.getElementById('ifg-edit-scale').value));
  expect(v < 100 && v >= lo, `★안쪽 끌기 = 줄어듦 ${v}`).toBe(true);
  expect(errs).toEqual([]);
});

test('E4 내보내기 — transform 0 · Figma 틀 크기 같음 · 저장→다시 열기 뒤 같은 글자 크기', async ({ page }) => {
  const { errs, id } = await scene(page);
  await enter(page, id);
  await setScale(page, 80);
  await page.keyboard.press('Escape');
  const s1 = await snap(page, id);
  expect(s1.transform, '★CSS transform 안 씀').toBe(false);
  const fig = await page.evaluate((id) => {
    window.flushCurrentPage?.();
    const json = window.buildFigmaExportJSON(null);
    let hit = null; const walk = (o) => { if (hit) return; if (Array.isArray(o)) o.forEach(walk); else if (o && typeof o === 'object') { if (o.id === id) hit = o; else Object.values(o).forEach(walk); } }; walk(json);
    return hit ? { w: hit.w ?? hit.width, h: hit.h ?? hit.height } : null;
  }, id);
  expect(fig, '[전제] Figma JSON 에 그리드').not.toBeNull();
  expect(Math.abs(fig.w - s1.w) <= 1 && Math.abs(fig.h - s1.h) <= 1, `★Figma 틀 ${fig.w}×${fig.h} = 캔버스 ${s1.w}×${s1.h}`).toBe(true);
  const data = await page.evaluate(() => window.serializeProject());
  await bootApp(page);
  await page.evaluate((d) => { document.getElementById('canvas').innerHTML = ''; window.applyProjectData(JSON.parse(d)); window.deselectAll?.(); }, data);
  await expect(page.locator(`[id="${id}"]`)).toHaveCount(1);
  await expect.poll(() => snap(page, id).then((s) => [s.font, s.icon]), '★다시 열기 뒤 같은 글자·아이콘').toEqual([s1.font, s1.icon]);
  expect(errs).toEqual([]);
});

test('E5 순수 — ifgScalePartial 틀 높이 보존(행 합 + 간격 합 무변) · 실제 값 × s · ifgScaleFloor 바닥', async ({ page }) => {
  const errs = await bootApp(page);
  const r = await page.evaluate(async () => {
    const m = await import(new URL('js/blocks/grid-ifg-edit.js', document.baseURI).href);
    const L = (fs) => [{ type: 'image', imgShape: 'circle', height: 100 }, { type: 'h3', fontSize: fs, marginTop: 10 }, { type: 'body' }];
    const m0 = { cols: [{}, {}], rows: [{ height: 'auto' }, { height: 200 }, { height: 'auto' }], cells: [[{ lines: L(30), padding: 20 }, { lines: L(20) }], [{ lines: L(30) }, { lines: L(30) }], [{ lines: L(30) }, { lines: L(30) }]] };
    const gaps0 = { row: 40, col: 24 }, rowPx = [250, 210, 230], padY = 5;
    const tot = (p) => p.rows.reduce((a, x) => a + x.height + 2 * padY, 0) + p.rowGap * 2;
    const p8 = m.ifgScalePartial(m0, gaps0, rowPx, padY, 0.8), p15 = m.ifgScalePartial(m0, gaps0, rowPx, padY, 1.5);
    return { t0: rowPx.reduce((a, x) => a + x, 0) + 80, t8: tot(p8), t15: tot(p15), gaps: [p8.rowGap, p8.colGap], c00: p8.cells[0][0], body: p8.cells[0][1].lines[2].fontSize,
      floor: m.ifgScaleFloor(m0), floorSmall: m.ifgScaleFloor({ cells: [[{ lines: [{ type: 'caption', fontSize: 12 }, { type: 'image', height: 20 }] }]] }), m0same: m0.cells[0][0].lines[1].fontSize };
  });
  expect(Math.abs(r.t8 - r.t0) <= 2 && Math.abs(r.t15 - r.t0) <= 2, `★틀 높이 보존 ${r.t0} → 0.8:${r.t8} · 1.5:${r.t15}`).toBe(true);
  expect(r.gaps, '★간격 × 0.8').toEqual([32, 19]);
  expect(r.c00, '★아이콘·글자·줄 위 여백·칸 여백 × 0.8').toEqual({ lines: [{ type: 'image', imgShape: 'circle', height: 80 }, { type: 'h3', fontSize: 24, marginTop: 8 }, { type: 'body', fontSize: 18 }], padding: 16 });
  expect(r.body, '★fontSize 없는 줄 = 역할 크기(body 22) × 0.8').toBe(18);
  expect(r.floor, '★바닥 = max(0.5, 10/22, 16/100)').toBe(0.5);
  expect(r.floorSmall, '★바닥 = 10/12 · 16/20 중 큰 것').toBe(0.84);
  expect(r.m0same, '★들어갈 때 모델은 안 바뀐다(늘 m0 에서 다시 계산)').toBe(30);
  expect(errs).toEqual([]);
});

/* ── 미카사 201 실앱 손 검사(handoff/MIKASA-ifgedit-261124) a~g ── */
test('E6 a 점선 틀 — 편집 모드 = 점선 틀 겹(블럭 크기) · 평소 선택 겹 숨김 · 끝나면 걷힘', async ({ page }) => {
  const { errs, id } = await scene(page);
  await enter(page, id);
  const r = await page.evaluate((id) => { const f = document.querySelector('.ifg-edit-frame'), g = document.getElementById(id).getBoundingClientRect(), o = document.getElementById('ss-handles-overlay');
    if (!f) return null; const fr = f.getBoundingClientRect(), cs = getComputedStyle(f); return { style: cs.borderTopStyle, same: Math.abs(fr.left - g.left) < 1 && Math.abs(fr.width - g.width) < 1 && Math.abs(fr.height - g.height) < 1, ovHidden: !o || getComputedStyle(o).display === 'none' }; }, id);
  expect(r, '★점선 틀 겹이 있다(옛: 없음 · 평소 실선)').toEqual({ style: 'dashed', same: true, ovHidden: true });
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => [document.querySelectorAll('.ifg-edit-frame').length, document.body.classList.contains('ifg-edit-on')])).toEqual([0, false]);
  expect(errs).toEqual([]);
});

test('E7 b 칸 사이 틈(거터) 더블클릭 = 편집 모드', async ({ page }) => {
  const { errs, id } = await scene(page);
  const p = await titlePt(page, id);
  await page.mouse.click(p.x, p.y);
  const gp = await page.evaluate(() => { const gs = [...document.querySelectorAll('.grd-gutter')].filter((x) => x.getBoundingClientRect().width > 0); const g = gs.find((x) => x.dataset.axis === 'col') || gs[0]; if (!g) return null; const r = g.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, own: document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)?.closest('.grd-gutter') === g }; });
  expect(gp && gp.own, '[전제] 고른 인포그래픽 위에 거터가 있고 그 점의 임자').toBe(true);
  await page.mouse.dblclick(gp.x, gp.y);
  await expect.poll(() => snap(page, id).then((s) => s.editing), '★거터 위 더블클릭 = 편집 모드(옛: 안 들어감)').toBe(true);
  expect(errs).toEqual([]);
});

test('E8 c 모서리를 가운데 지나 끌기 = 바닥에서 멈춤(다시 안 커짐)', async ({ page }) => {
  const { errs, id } = await scene(page);
  await enter(page, id);
  const lo = await setScale(page, 10);
  await setScale(page, 100);
  await dragCorner(page, id, 1.8, 10);   // 가운데를 80% 넘어 반대쪽까지
  expect(await page.evaluate(() => Number(document.getElementById('ifg-edit-scale').value)), `★가운데 넘어 = 바닥 ${lo}(옛: 다시 커짐)`).toBe(lo);
  expect(errs).toEqual([]);
});

test('E9 d 80·91% 에서도 틀 높이 그대로 · e 배율 칸에 포커스가 있어도 끌기 값이 칸에 보임', async ({ page }) => {
  const { errs, id } = await scene(page);
  const s0 = await snap(page, id);
  await enter(page, id);
  for (const v of [80, 91, 63]) { await setScale(page, v); const s = await snap(page, id); expect([s.w, s.h], `★${v}% 틀 = ${s0.w}×${s0.h}(옛: 739)`).toEqual([s0.w, s0.h]); }
  await page.focus('#ifg-edit-scale');
  await dragCorner(page, id, 0.3, 1);
  const v = await page.evaluate(() => Number(document.getElementById('ifg-edit-scale').value));
  expect(v < 63, `★끌기 뒤 칸 값이 따라옴 ${v}(옛: 63 그대로)`).toBe(true);
  expect(errs).toEqual([]);
});

test('E10 f 안에서 글줄 편집 뒤 = 편집 패널로 돌아옴 · 그 글은 배율을 바꿔도 남음', async ({ page }) => {
  const { errs, id } = await scene(page);
  await enter(page, id);
  await setScale(page, 80);
  const p2 = await titlePt(page, id);   // 80% 뒤 자리
  await page.mouse.dblclick(p2.x, p2.y);
  await expect.poll(() => snap(page, id).then((s) => s.ce), '[전제] 글자 편집').toBe(true);
  await page.keyboard.press('Meta+a'); await page.keyboard.type('새제목');
  await page.evaluate(() => document.activeElement?.blur?.());   // 커밋 = blur(Esc 는 글자 편집 취소)
  await expect.poll(() => page.evaluate((id) => (JSON.parse(document.getElementById(id).dataset.cols || '[]')[0]?.lines || []).some((l) => l.text === '새제목'), id), '[전제] 글이 모델에 들어감').toBe(true);
  await expect.poll(() => page.evaluate(() => !!document.getElementById('ifg-edit-panel')), '★편집 패널로 돌아옴(옛: Grid Block 그대로)').toBe(true);
  await setScale(page, 70);
  expect(await page.evaluate((id) => (JSON.parse(document.getElementById(id).dataset.cols || '[]')[0]?.lines || []).some((l) => l.text === '새제목'), id), '★고친 글이 배율 뒤에도 남음(들어갈 때 모델로 덮지 않음)').toBe(true);
  expect(errs).toEqual([]);
});

test('E11 g Esc → ⌘Z 뒤 편집 표식 0(class·상태)', async ({ page }) => {
  const { errs, id } = await scene(page);
  await enter(page, id);
  await setScale(page, 80);
  await page.keyboard.press('Escape');
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Meta+z');
  await expect.poll(() => snap(page, id).then((s) => s.rowGap)).toBe('44');
  const s = await snap(page, id);
  expect({ editing: s.editing, stray: s.stray, body: await page.evaluate(() => document.body.classList.contains('ifg-edit-on')) }, '★⌘Z 뒤 표식 0(옛: class ifg-editing 남음)').toEqual({ editing: false, stray: 0, body: false });
  expect(errs).toEqual([]);
});
