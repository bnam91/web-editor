/* freehand-pencil-brush — t13A-02(현빈 GO 261119) 연필(N) · 붓(⇧B · 필압 없음) · 떨림 보정(공통 «보정 세기» 하나)
 *   연필 = 맞춘 펜 노드 → 펜과 같은 확정 길(섹션 = 벡터 penNodes · 섹션 밖 = 스크래치 펜 항목) · 붓 = 채운 외곽 벡터(점 편집 없음 · 색 칸으로 색)
 * 칸
 *   H1 N 키 = 연필 · 막대(#floating-panel 안 #fh-bar) · 섹션 안 진짜 끌기(물결) → 벡터 하나 · penNodes 노드 2 이상 · 끈 점 수보다 훨씬 적다 · 패널 «패스 편집»
 *   H2 보정 세기 — 같은 점(물결 200)을 세기 0 과 100 으로 확정 → 100 쪽 노드가 적다(막대 손잡이 진짜 입력)
 *   H3 ⇧B = 붓 · 섹션 안 끌기 → 벡터 하나 · penNodes 없음 · 채운 path · 같은 점 프리셋 둘(양 끝 가늘게·서예)은 모양이 다르다
 *   H4 연필로 섹션 밖에서 끌기 → 떠 있는 펜 벡터(★2026-11-24 기대 바뀜 — t13G-03: 연필은 펜과 같은 확정 길 _finalizeDraw · 섹션 밖 = IAL 벡터) · 스크래치 무변
 *   H5 Esc = 끝(막대 0 · body fh-mode 0) · P(펜) 켜면 연필 꺼짐(서로 배타)
 *   H6 (채점 261120 상자 폭주) 배율 80% · 섹션 2 같은 자리 진짜 끌기 4번(정수 좌표 지그재그 ZIG — 단위 F5 와 같은 획) · 획 사이 보정 손잡이를 키보드로 20→10→5→0 →
 *      블럭마다 offsetWidth/Height ≤ 그린 폭(레이아웃 px) + ½ 긴 변 + 40 · 섹션 2 높이 늘어남 ≤ 새 블럭 줄 높이 합 + 200
 *   H7 (채점 261120 «⇧B 눌러도 연필 N») 보정 손잡이 진짜 클릭(포커스가 거기 남음) 뒤 ⇧B → 붓 · 막대 «붓 ⇧B» · 다시 N → 연필 · 그 뒤 Esc = 끝
 * 양성대조: _patches/freehand-CTL-handle-blowup.patch → H6 빨강 · 단위 F5 빨강 / _patches/freehand-CTL-key-focus.patch → H7 빨강 · 단위 K1·K2 빨강
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
  await expect(page.locator('#floating-panel #fh-bar #fh-smooth'), '★연필 막대(하단 플로팅 패널 안 보정 손잡이)').toBeVisible();
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

test('H4 연필 섹션 밖 → 떠 있는 펜 벡터 · 스크래치 무변(t13G-03 기대 바뀜)', async ({ page }) => {
  const errs = await scene(page);
  const b0 = (await vecs(page)).length, s0 = await page.evaluate(() => document.querySelectorAll('.scratch-item').length);
  await page.evaluate(() => window.enterFreehand('pencil'));
  const pts = await page.evaluate(() => { const c = document.getElementById('canvas').getBoundingClientRect(); return Array.from({ length: 25 }, (_, i) => ({ x: c.right + 60 + i * 6, y: c.top + 150 + 20 * Math.sin(i / 3) })); });
  expect(await page.evaluate((p) => !document.elementFromPoint(p.x, p.y)?.closest('#canvas'), pts[0]), '[전제] 캔버스 밖').toBe(true);
  await drag(page, pts);
  await expect.poll(() => vecs(page).then((v) => v.length), '★섹션 벡터 +1').toBe(b0 + 1);
  expect(await page.evaluate(() => document.querySelectorAll('.scratch-item').length), '★스크래치 무변').toBe(s0);
  expect(await page.evaluate(() => { const v = [...document.querySelectorAll('#canvas .section-block .vector-block')].pop(); return { pen: !!v.dataset.penNodes, float: v.dataset.overlayBlock === 'true' || !!v.closest('[data-overlay-block="true"]') }; }), '★떠 있는 펜 벡터(점 편집 됨)').toEqual({ pen: true, float: true });
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('H5 Esc = 끝 · P(펜) 켜면 연필 꺼짐', async ({ page }) => {
  const errs = await scene(page);
  await page.keyboard.press('KeyN');
  await expect(page.locator('#fh-smooth')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#fh-bar'), '★Esc = 막대 0').toHaveCount(0);
  expect(await page.evaluate(() => [window.freehandTool(), document.body.classList.contains('fh-mode')]), '★Esc = 끝').toEqual([null, false]);
  await page.keyboard.press('KeyN');
  await page.keyboard.press('KeyP');
  expect(await page.evaluate(() => [window.freehandTool(), document.body.classList.contains('vpen-mode')]), '★펜 켜면 연필 꺼짐 · 펜 모드').toEqual([null, true]);
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* 보정 손잡이 진짜 클릭(마우스) — 값이 바뀔 때까지 조건 대기. 포커스는 손잡이에 남는다(H7 전제). */
async function clickSmooth(page, frac) {
  const v0 = await page.locator('#fh-smooth').inputValue();
  const bb = await page.locator('#fh-smooth').boundingBox();
  await page.mouse.click(bb.x + bb.width * frac, bb.y + bb.height / 2);
  await expect.poll(() => page.locator('#fh-smooth').inputValue(), '[전제] 손잡이 값 바뀜').not.toBe(v0);
}

/* 정수 화면 좌표(첫 점 기준) 지그재그 156×8 — 옛 맞춤이 보정 0·5·10·20 모두에서 상자 ≥ 2100 로 터뜨린 획(단위 F5 ZIG 과 같다) */
const ZIG = [[10,0],[17,0],[24,0],[34,1],[40,1],[47,2],[53,2],[57,2],[66,1],[73,4],[75,4],[81,4],[82,1],[86,2],[87,2],[87,4],[84,3],[85,4],[82,2],[78,1],[76,3],[71,2],[66,3],[56,1],[50,0],[42,1],[37,1],[31,0],[22,-1],[19,0],[12,2],[10,1],[2,-1],[-8,0],[-20,-1],[-25,-1],[-33,-1],[-37,0],[-40,0],[-44,-3],[-49,-3],[-54,-3],[-58,-2],[-62,-4],[-64,-2],[-66,-3],[-69,-4],[-68,-2],[-67,-4],[-67,-1],[-65,-4],[-64,-1],[-60,-1],[-54,-3],[-46,-1],[-42,-2],[-39,-2],[-35,-1],[-30,-1],[-23,-1],[-16,0],[-7,-1],[-3,-2],[6,0],[13,0],[21,1],[32,2],[42,1],[53,1],[60,0],[69,0],[73,3]];
/** 보정 손잡이를 키보드로 정확한 값에(Home → → n 번) — 진짜 입력 · 값 조건 대기 */
async function keySmooth(page, v) {
  await page.locator('#fh-smooth').focus();
  await page.keyboard.press('Home');
  for (let i = 0; i < v; i++) await page.keyboard.press('ArrowRight');
  await expect.poll(() => page.locator('#fh-smooth').inputValue(), `[전제] 보정 ${v}`).toBe(String(v));
}

test('H6 배율 80% · 섹션 2 같은 자리 4획 · 보정 바꿔 가며 — 블럭 상자·섹션 높이 안 터짐', async ({ page }) => {
  const errs = await scene(page);
  await page.evaluate(async () => { await window.addSection(); window.applyZoom(80); });
  await waitZoomSettled(page, 80);
  await page.keyboard.press('KeyN');
  await expect(page.locator('#fh-smooth')).toBeVisible();
  const sec2 = () => page.evaluate(() => { const s = document.querySelectorAll('#canvas .section-block')[1]; const r = s.getBoundingClientRect(); return { left: r.left, top: r.top, h: s.offsetHeight }; });
  await page.evaluate(() => document.querySelectorAll('#canvas .section-block')[1].scrollIntoView({ block: 'center' }));
  const h0 = (await sec2()).h;
  const rows = () => page.evaluate(() => [...document.querySelectorAll('#canvas .section-block')[1].querySelectorAll('.vector-block')].map((v) => ({ w: v.offsetWidth, h: v.offsetHeight, rowH: (v.closest('.row') || v).offsetHeight })));
  const r = await sec2(), z = await page.evaluate(() => window.currentZoom / 100);
  const x0 = Math.round(r.left + 200), y0 = Math.round(r.top + 80);   // 정수 화면 좌표 · 4획 모두 같은 자리
  const pts = ZIG.map(([dx, dy]) => ({ x: x0 + dx, y: y0 + dy }));
  expect(await page.evaluate((p) => document.elementFromPoint(p.x, p.y)?.closest('.section-block') === document.querySelectorAll('#canvas .section-block')[1], pts[0]), '[전제] 첫 점 = 섹션 2').toBe(true);
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  const dw = (Math.max(...xs) - Math.min(...xs)) / z, dh = (Math.max(...ys) - Math.min(...ys)) / z, slack = Math.max(dw, dh) / 2 + 40;   // 화면 폭 ÷ 배율 = 레이아웃 px
  for (const [k, sm] of [20, 10, 5, 0].entries()) {
    await keySmooth(page, sm);
    await drag(page, pts);
    await expect.poll(() => rows().then((v) => v.length), `★획 ${k + 1} → 벡터 ${k + 1}`).toBe(k + 1);
    const b = (await rows()).at(-1);
    expect(b.w, `★획 ${k + 1}(보정 ${sm}) 블럭 폭 ${b.w} ≤ 그린 ${dw.toFixed(0)} + ${slack.toFixed(0)}`).toBeLessThanOrEqual(dw + slack);
    expect(b.h, `★획 ${k + 1}(보정 ${sm}) 블럭 높이 ${b.h} ≤ 그린 ${dh.toFixed(0)} + ${slack.toFixed(0)}`).toBeLessThanOrEqual(dh + slack);
  }
  const grow = (await sec2()).h - h0, sumRows = (await rows()).reduce((a, v) => a + v.rowH, 0);
  expect(grow, `★섹션 2 늘어남 ${grow} ≤ 새 줄 높이 합 ${sumRows} + 200`).toBeLessThanOrEqual(sumRows + 200);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('H7 보정 손잡이 만진 뒤 ⇧B = 붓 · N = 연필 · Esc = 끝', async ({ page }) => {
  const errs = await scene(page);
  await page.keyboard.press('KeyN');
  await expect(page.locator('#fh-tool')).toHaveText('연필 N');
  await clickSmooth(page, 0.8);
  expect(await page.evaluate(() => document.activeElement?.id), '[전제] 포커스가 보정 손잡이에 남음').toBe('fh-smooth');
  await page.keyboard.press('Shift+KeyB');
  await expect(page.locator('#fh-tool'), '★⇧B = 막대 «붓 ⇧B»').toHaveText('붓 ⇧B');
  expect(await page.evaluate(() => window.freehandTool()), '★붓').toBe('brush');
  await clickSmooth(page, 0.3);
  await page.keyboard.press('KeyN');
  await expect(page.locator('#fh-tool'), '★N = 연필').toHaveText('연필 N');
  await clickSmooth(page, 0.6);
  await page.keyboard.press('Escape');
  await expect(page.locator('#fh-bar'), '★손잡이 포커스에서도 Esc = 끝').toHaveCount(0);
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* H8 — 0.9.13 211행 BRUSH-OUTSIDE-SECTION-FLOAT-01(현빈 결정 261124 10:47 [4]): 붓 섹션 밖 = 떠 있는(IAL) 그림(연필·펜 t13G-03 과 일관). 옛: 스크래치 그림.
 *   섹션 밖 끌기 → 섹션 벡터 +1 · 떠 있음 · penNodes 없음(채운 외곽 = 붓 꼴 그대로) · 스크래치 무변 · ⌘Z 한 번 = 벡터 0 */
test('H8 붓 섹션 밖 → 떠 있는 붓 그림 · 스크래치 무변 · ⌘Z 한 번', async ({ page }) => {
  const errs = await scene(page);
  const b0 = (await vecs(page)).length, s0 = await page.evaluate(() => document.querySelectorAll('.scratch-item').length);
  await page.evaluate(() => { window.clearHistory?.(); window.enterFreehand('brush'); });
  const pts = await page.evaluate(() => { const c = document.getElementById('canvas').getBoundingClientRect(); return Array.from({ length: 25 }, (_, i) => ({ x: c.right + 60 + i * 6, y: c.top + 150 + 20 * Math.sin(i / 3) })); });
  expect(await page.evaluate((p) => !document.elementFromPoint(p.x, p.y)?.closest('#canvas'), pts[0]), '[전제] 캔버스 밖').toBe(true);
  await drag(page, pts);
  await expect.poll(() => vecs(page).then((v) => v.length), '★섹션 벡터 +1(옛: 스크래치 그림)').toBe(b0 + 1);
  expect(await page.evaluate(() => document.querySelectorAll('.scratch-item').length), '★스크래치 무변').toBe(s0);
  expect(await page.evaluate(() => { const v = [...document.querySelectorAll('#canvas .section-block .vector-block')].pop(); return { pen: !!v.dataset.penNodes, float: v.dataset.overlayBlock === 'true' || !!v.closest('[data-overlay-block="true"]'), path: !!v.querySelector('svg path') }; }), '★떠 있는 붓 그림(점 편집 없음 · 채운 외곽)').toEqual({ pen: false, float: true, path: true });
  await page.evaluate(() => { window.exitFreehand?.(); document.activeElement?.blur?.(); });
  await page.keyboard.press('Meta+z');
  await expect.poll(() => vecs(page).then((v) => v.length), '★⌘Z 한 번 = 벡터 0').toBe(b0);
  expect(errs, errs.join(' | ')).toEqual([]);
});
