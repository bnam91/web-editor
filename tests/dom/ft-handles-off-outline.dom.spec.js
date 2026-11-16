/* ft-handles-off-outline — NEW-현빈QA-FREE-TRANSFORM-HANDLES-OFF-OUTLINE-01 · 0.9.12 141행
 *   현빈 QA ⑴ tb_6jh6q_8oxer2p(H1 A2Z 104 · 가운데 정렬 글 프레임) — 보라 핸들이 파란 상자와 어긋나고 아래 핸들이 흩어진다(스샷 hnd.png 22:21:13)
 *   현빈 QA ⑵ 가운데 정렬 뒤 아래 두 핸들을 «양옆으로 대칭» 벌렸더니 가운데가 아니라 왼쪽으로 치우친다
 * 뿌리:
 *   ⓐ applyFxFreeTransform 의 FT-3b 보정 `tb.style.translate = mnx`(49851364b) — tb 에만 걸려 파란 선(selection-overlay 호스트 = 글 프레임)이 안 따라가고,
 *      «프레임 왼쪽 고정»을 가정해 가운데 정렬에선 보정이 겹쳐 왼쪽으로 밀렸다.
 *   ⓑ 나비꼴(자기 교차) 네 점을 setFxFreeTransform 이 받았다 — 무한원 선이 글 사각형을 지나 변 손잡이·격자·글자가 윤곽 밖으로 튄다.
 * 처방(지디 결정 ㉮+㉯ · Q1 허용 · Q2 막기):
 *   ㉮ 글 프레임이 있으면 보정을 «프레임» translate 로 · 값 = mnx + a·(B − B0) (a 왼0·가운데½·오른1) · 패널 정렬 단추가 다시 그린다
 *   ㉯ isConvexQuad(fx/homography.js) 로 오목·나비꼴 거절(NON_CONVEX · 이력 전) · 끌기는 마지막 볼록 자리에 멈춘다
 * 칸: F1 가운데+채점판 사본 네 점 → 보라가 파란 안 · F2c 가운데 대칭 벌림 → 위 모서리 제자리 · F2l [지킴 FT-3b] 왼쪽 같은 조작 제자리 ·
 *     F3 나비꼴 set → 거절·네 점 그대로·변 손잡이 제 변 위 · F4 nw 손잡이를 아래로 실제 끌기(밑변 너머) → 네 점 볼록 유지 ·
 *     F5 변형 뒤 패널 정렬 왼→가운데 → 보라가 파란 안(다시 그림)
 * 양성대조(srv 미실행 · 예측): FTH-CTL1(㉮ 되돌림 = 옛 tb translate 한 줄) → F1·F2c·F5 빨강 · F2l·F3·F4 초록 /
 *   FTH-CTL2(㉯ 되돌림 = setFxFreeTransform 거절 줄 삭제) → F3·F4 빨강 · 나머지 초록.
 * 픽스처 수: F1 = 9501 채점판 사본 proj_history/1794835295982.json(스샷 22초 뒤) 네 점 · F3 = 스샷 맞춤 nw(112,380) ne(296,-2) se(307,362) sw(-80,374).
 * ⛔고정 대기 0 · 배율 = 기본(applyZoom 안 부름).
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');

const f2 = (p) => p.waitForFunction(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

async function setup(page, { center = true } = {}) {
  await page.setViewportSize({ width: 1400, height: 1000 });
  const errs = await bootApp(page);
  const id = await page.evaluate(async () => {
    await window.addSection();
    window.addTextBlock('h1');
    const sec = [...document.querySelectorAll('#canvas .section-block')].pop();
    const tb = [...sec.querySelectorAll('.text-block')].pop();
    (tb.querySelector('[contenteditable]') || tb.querySelector('.tb-h1')).textContent = '짧은 글';
    window.deselectAll?.();
    return tb.id;
  });
  const r = await waitStableRect(page, '#' + id);
  await page.mouse.click(r.cx, r.cy);
  await page.waitForFunction((id) => document.getElementById(id)?.classList.contains('selected') && !!document.querySelector('#panel-right .prop-align-btn[data-align="center"]'), id, { timeout: 3000 });
  if (center) {
    await page.click('#panel-right .prop-align-btn[data-align="center"]');
    await page.waitForFunction((id) => (document.getElementById(id).querySelector('[contenteditable]') || document.getElementById(id).querySelector('.tb-h1')).style.textAlign === 'center', id, { timeout: 3000 });
  }
  /* 켜기(바탕 네모 · 만짐) — 손잡이와 같은 문(setFxFreeTransform) */
  await page.evaluate(async (id) => { const ft = await import('/js/effects-freetransform.js'); ft.setFxFreeTransform(document.getElementById(id), undefined, { history: false }); }, id);
  await f2(page);
  return { errs, id };
}

const setC = async (page, id, C) => { const r = await page.evaluate(async ([id, C]) => { const ft = await import('/js/effects-freetransform.js'); const r = ft.setFxFreeTransform(document.getElementById(id), C, { history: false }); return { ok: r.ok, code: r.code || null }; }, [id, C]); await f2(page); return r; };
const cornersOf = (page, id) => page.evaluate((id) => document.getElementById(id).dataset.tfCorners, id);
const convexNow = (page, id) => page.evaluate(async (id) => { const h = await import('/js/fx/homography.js'); const v = document.getElementById(id).dataset.tfCorners.split(',').map(Number); return h.isConvexQuad([[v[0], v[1]], [v[2], v[3]], [v[4], v[5]], [v[6], v[7]]]); }, id);

/** 화면 값 — 파란(오버레이 path) · 보라(.tfh-edge) · 손잡이 중심 · 배율 z · 전제 */
const M = (page, id) => page.evaluate((id) => {
  const tb = document.getElementById(id);
  const R = (el) => { if (!el) return null; const q = el.getBoundingClientRect(); return { l: q.left, t: q.top, r: q.right, b: q.bottom }; };
  const hc = {}; tb.querySelectorAll('.tfh-handle').forEach((h) => { const q = h.getBoundingClientRect(); hc[h.dataset.tfh] = [q.left + q.width / 2, q.top + q.height / 2]; });
  const tf = tb.closest('.frame-block[data-text-frame="true"]');
  return { blue: R(document.querySelector('#ss-handles-overlay svg.ss-sel-layer path.ss-sel-path')), purple: R(tb.querySelector('.tfh-edge')), hc,
    z: tb.getBoundingClientRect().width / tb.offsetWidth, st: window.ftStateOf?.(tb) ? { W: window.ftStateOf(tb).W, H: window.ftStateOf(tb).H } : null,
    tfAS: tf?.style.alignSelf ?? null, translate: tb.style.translate || '' };
}, id);

test('F1 ★가운데 정렬 · 채점판 사본 네 점 — 보라 윤곽이 파란 상자 안(±1.5)', async ({ page }) => {
  const { errs, id } = await setup(page);
  await setC(page, id, [[0, 0], [295.55, -6.78], [548.6, 160.03], [-70.33, 297.92]]);
  const m = await M(page, id);
  expect({ tf: m.tfAS, blue: !!m.blue, purple: !!m.purple, n: Object.keys(m.hc).length }, '[전제] 가운데 정렬 글 프레임 · 파란·보라·손잡이 12').toEqual({ tf: 'center', blue: true, purple: true, n: 12 });
  const out = { l: +(m.blue.l - m.purple.l).toFixed(1), r: +(m.purple.r - m.blue.r).toFixed(1) };   // 양수 = 보라가 파란 밖
  expect(out.l <= 1.5 && out.r <= 1.5, `★보라가 파란 밖 l=${out.l} r=${out.r} (예측 빨강: l≈70.33·z=${(70.33 * m.z).toFixed(1)} · translate=${m.translate})`).toBe(true);
  expect(errs, errs.join(' | ')).toEqual([]);
});

for (const center of [true, false]) {
  test(`F2${center ? 'c' : 'l'} ${center ? '★가운데' : '[지킴 FT-3b] 왼쪽'} 정렬 — 아래 두 모서리를 대칭으로 60 벌리면 위 두 모서리는 제자리`, async ({ page }) => {
    const { errs, id } = await setup(page, { center });
    const m0 = await M(page, id);
    expect({ tf: m0.tfAS || '', st: !!m0.st }, '[전제] 정렬·잰 값').toEqual({ tf: center ? 'center' : '', st: true });
    const { W, H } = m0.st, d = 60;
    await setC(page, id, [[0, 0], [W, 0], [W + d, H], [-d, H]]);
    const m1 = await M(page, id);
    const dx = { nw: +(m1.hc.nw[0] - m0.hc.nw[0]).toFixed(1), ne: +(m1.hc.ne[0] - m0.hc.ne[0]).toFixed(1) };
    expect(Math.abs(dx.nw) <= 1 && Math.abs(dx.ne) <= 1, `★위 두 모서리 이동 nw=${dx.nw} ne=${dx.ne} (가운데 예측 빨강: ≈−${(d * m1.z).toFixed(1)})`).toBe(true);
    expect(errs, errs.join(' | ')).toEqual([]);
  });
}

/** 변 손잡이 8 이 제 변(이웃 모서리 손잡이 잇는 선분)에서 떨어진 거리(화면 px) */
const edgeOff = (hc) => {
  const seg = { n: ['nw', 'ne'], e: ['ne', 'se'], s: ['se', 'sw'], w: ['sw', 'nw'] };
  const off = {};
  for (const k of ['n1', 'n2', 'e1', 'e2', 's1', 's2', 'w1', 'w2']) {
    const [a, b] = seg[k[0]].map((c) => hc[c]); const p = hc[k];
    const vx = b[0] - a[0], vy = b[1] - a[1], L2 = vx * vx + vy * vy || 1;
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / L2));
    off[k] = +Math.hypot(p[0] - a[0] - t * vx, p[1] - a[1] - t * vy).toFixed(1);
  }
  return off;
};

test('F3 ★나비꼴 네 점(스샷 맞춤) — 거절(NON_CONVEX) · 네 점 그대로 · 변 손잡이 8 이 제 변 위(≤2px)', async ({ page }) => {
  const { errs, id } = await setup(page);
  const c0 = await cornersOf(page, id);
  const r = await setC(page, id, [[112, 380], [296, -2], [307, 362], [-80, 374]]);
  const m = await M(page, id);
  expect(Object.keys(m.hc).length, '[전제] 손잡이 12').toBe(12);
  expect({ r, same: (await cornersOf(page, id)) === c0 }, '★나비꼴은 받지 않는다 · 네 점 그대로').toEqual({ r: { ok: false, code: 'NON_CONVEX' }, same: true });
  const off = edgeOff(m.hc);
  expect(Object.values(off).every((v) => v <= 2), `★변 손잡이가 윤곽 밖 ${JSON.stringify(off)}`).toBe(true);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('F4 ★nw 손잡이를 밑변 너머로 실제 끌기 — 네 점 볼록 유지 · 변 손잡이 제 변 위', async ({ page }) => {
  const { errs, id } = await setup(page);
  const m0 = await M(page, id);
  expect(Object.keys(m0.hc).length, '[전제] 손잡이 12').toBe(12);
  const [x, y] = m0.hc.nw; const down = (m0.hc.sw[1] - y) + 60, right = (m0.hc.se[0] - x) * 0.4;
  await page.mouse.move(x, y); await page.mouse.down();
  for (let i = 1; i <= 12; i++) await page.mouse.move(x + right * i / 12, y + down * i / 12);
  await page.mouse.up(); await f2(page);
  const m1 = await M(page, id);
  expect({ moved: Math.hypot(m1.hc.nw[0] - x, m1.hc.nw[1] - y) > 5, convex: await convexNow(page, id) }, '★끌림은 있었고(앞 걸음 받힘) 네 점은 볼록').toEqual({ moved: true, convex: true });
  const off = edgeOff(m1.hc);
  expect(Object.values(off).every((v) => v <= 2), `★변 손잡이가 윤곽 밖 ${JSON.stringify(off)}`).toBe(true);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('F5 ★변형 뒤 패널 정렬 왼→가운데 — 보라가 파란 안(±1.5) · 다시 그림', async ({ page }) => {
  const { errs, id } = await setup(page, { center: false });
  await setC(page, id, [[0, 0], [295.55, -6.78], [548.6, 160.03], [-70.33, 297.92]]);
  await page.click('#panel-right .prop-align-btn[data-align="center"]');
  await page.waitForFunction((id) => document.getElementById(id).closest('.frame-block[data-text-frame="true"]')?.style.alignSelf === 'center', id, { timeout: 3000 });
  await f2(page);
  const m = await M(page, id);
  const out = { l: +(m.blue.l - m.purple.l).toFixed(1), r: +(m.purple.r - m.blue.r).toFixed(1) };
  expect(out.l <= 1.5 && out.r <= 1.5, `★보라가 파란 밖 l=${out.l} r=${out.r}`).toBe(true);
  expect(errs, errs.join(' | ')).toEqual([]);
});
