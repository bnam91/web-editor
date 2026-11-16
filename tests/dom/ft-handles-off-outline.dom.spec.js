/* ft-handles-off-outline — 재현 픽스처 (NEW-현빈QA-FREE-TRANSFORM-HANDLES-OFF-OUTLINE-01 · 0.9.12 141행) ★코드 변경 전 · 빨강이 «재현»이다
 *   현빈 QA ⑴ tb_6jh6q_8oxer2p(H1 A2Z 104 · 가운데 정렬 글 프레임) — 보라 핸들이 파란 상자와 어긋나고 아래 핸들이 흩어진다(스샷 hnd.png 22:21:13)
 *   현빈 QA ⑵ 가운데 정렬 뒤 아래 두 핸들을 «양옆으로 대칭» 벌렸더니 가운데가 아니라 왼쪽으로 치우친다
 * 뿌리(코드 읽기 · srv 미실행):
 *   ⓐ effects-freetransform.js applyFxFreeTransform — `tb.style.translate = mnx` (FT-3b 49851364b) 는 «글 프레임 왼쪽이 고정»이라 가정한 보정.
 *      파란 선 = selection-overlay 의 호스트(_hostOf → `.frame-block[data-text-frame]`) 상자 ⇒ translate 를 안 받는다 ⇒ 보라(tb 자식)만 |mnx| 왼쪽.
 *      가운데 정렬(tf.alignSelf=center)은 폭이 늘 때 프레임이 이미 양쪽으로 자라므로 보정이 «겹쳐» 그림 전체가 왼쪽으로 밀린다.
 *      맞는 보정 = mnx + a·(B − B0) (a = 왼 0 · 가운데 ½ · 오른 1 · B = 새 상자 폭 · B0 = 바탕 폭) — 대칭 벌림이면 0.
 *   ⓑ 네 점이 «나비꼴»(자기 교차)이 되어도 setFxFreeTransform 이 받는다 — 무한원 선이 글 사각형을 지나 변 손잡이·격자·글 조각이 윤곽 밖으로 튄다.
 * 예측(현 판 aeafcbabb): F1 빨강 · F2c 빨강 · F2l 초록(FT-3b 지킴) · F3 빨강.
 * 픽스처 수: F1 = 9501 채점판 사본 proj_history/1794835295982.json(스샷 22초 뒤) 의 네 점 그대로 ·
 *   F3 = 스샷에서 맞춘 네 점(모델 px · 파란 왼·위 기준) nw(112,380) ne(296,-2) se(307,362) sw(-80,374).
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

const setC = async (page, id, C) => { await page.evaluate(async ([id, C]) => { const ft = await import('/js/effects-freetransform.js'); return ft.setFxFreeTransform(document.getElementById(id), C, { history: false }); }, [id, C]); await f2(page); };

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

test('F3 ★나비꼴 네 점(스샷 맞춤) — 변 손잡이 8 이 제 변 위(≤2px)', async ({ page }) => {
  const { errs, id } = await setup(page);
  await setC(page, id, [[112, 380], [296, -2], [307, 362], [-80, 374]]);
  const m = await M(page, id);
  expect(Object.keys(m.hc).length, '[전제] 손잡이 12(행렬이 풀렸다)').toBe(12);
  const seg = { n: ['nw', 'ne'], e: ['ne', 'se'], s: ['se', 'sw'], w: ['sw', 'nw'] };
  const off = {};
  for (const k of ['n1', 'n2', 'e1', 'e2', 's1', 's2', 'w1', 'w2']) {
    const [a, b] = seg[k[0]].map((c) => m.hc[c]); const p = m.hc[k];
    const vx = b[0] - a[0], vy = b[1] - a[1], L2 = vx * vx + vy * vy || 1;
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / L2));
    off[k] = +Math.hypot(p[0] - a[0] - t * vx, p[1] - a[1] - t * vy).toFixed(1);
  }
  expect(Object.values(off).every((v) => v <= 2), `★변 손잡이가 윤곽 밖 ${JSON.stringify(off)} (예측 빨강)`).toBe(true);
  expect(errs, errs.join(' | ')).toEqual([]);
});
