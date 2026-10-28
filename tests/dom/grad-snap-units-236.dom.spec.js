/* grad-snap-units-236.dom.spec.js — 236 ①-0(지디 261029): «화면 px → 섹션 로컬 px» 환산을 한 자리(_gradScreenToLocal)에서 파생 ＋ 한 쌍.
 *   읽는 이 둘 = js/gradient-select.js 리사이즈의 섹션 «너비» 스냅(가로만) · 이동의 형제/섹션 «변» 스냅(가로세로).
 *   ⛔두 스냅 규칙은 합치지 않는다 — 문턱 값만 같고(GRAD_SNAP_SCREEN 16 화면 px) 맞추는 대상이 다르다.
 * 자: 문턱을 «화면 px» 로 잰다 — 12 화면 px 안 = 붙는다 · 22 = 안 붙는다. 환산을 무력화하면(÷배율 빠짐) 로컬 문턱이 16 이 되어
 *   화면으로는 16×배율(≤9.6 · 배율 ≤0.6 전제) ⇒ 12 화면 px 에서 «안 붙는다» ⇒ 읽는 이 둘(M12·W12)이 함께 빨강이어야 한다.
 * 칸
 *   U0  환산 한 자리 — 정의 1 · 읽는 이 2 · `GRAD_SNAP_SCREEN /` 맨 나눗셈 0 (소스를 ROOT 에서 읽음 ⇒ 변이 사본도 같은 자)
 *   U1  자가 산다(D1N 꼴) — 고른 거리 12·22 가 «참 문턱 16» 과 «무력화 문턱 16×배율» 사이를 가른다(배율 0.25~0.6)
 *   U1N 자가 산다(D1N 베낌 · 236 ③) — 판정 함수 near 는 허용(±3) 안만 참 · 일부러 어긋난 값은 거짓
 *   Z0  전제 — 배율 ≤ 0.6(이름 붙인 자리를 재기 전 단언) · 섹션 안에 그라데 말고 스냅 대상 0 · 골라짐
 *       ★배율 = #canvas-scaler transform(렌더 배율 · 화면 px 의 참) · waitZoomSettled 뒤에만(D1 ⑶) — currentZoom 과 1e-3 안 같음 단언(236 ② 섞인 자)
 *   «끌기가 안 먹음»(x 그대로) = GRAD-DRAG-HARNESS-CANNOT-DRIVE-DRAG-01 이름 있는 실패(D1 ⑸ · SKIP 아님) · 리사이즈도 폭 그대로면 이름 없이 따로 빨강
 *   M12 이동 — 왼변을 섹션 왼끝에서 12 화면 px 까지 끌면 x = 0
 *   M22 이동 음성 — 22 화면 px 이면 안 붙는다(x ≈ 22/배율)
 *   MA  이동 ⌥(mousedown «뒤» 에 · D1 꼴) — 12 화면 px 이어도 안 붙는다
 *   W12 리사이즈 — 폭이 섹션 폭에서 12 화면 px 모자라게 끌면 폭 = 섹션 폭
 *   W22 리사이즈 음성 — 22 화면 px 이면 안 붙는다
 * 한 쌍(사본 변이 · GD1001_ROOT): _gradScreenToLocal 몸을 `return px;` 로 ⇒ M12·W12 빨강 · 나머지 초록. 사본은 «바뀐 줄 1» 을 세어 단언 ＋ 그 판 로그에 «양성대조 모드 — <사본>» 줄이 있나 단언(슬롯 스크립트 · 236 ④).
 * ⛔고정 대기 없음 · 끌기·⌥ 는 진짜 입력(page.mouse · page.keyboard).
 */
const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { bootApp, waitZoomSettled, ROOT } = require('./_root-harness.js');

const SRC = () => fs.readFileSync(path.join(ROOT, 'js', 'gradient-select.js'), 'utf8');
const NEAR = 12, FAR = 22, SNAP = 16;
const near = (v, want, tol = 3) => Math.abs(v - want) <= tol;   // 판정 함수 하나(D1 oneToOne 꼴) — M22·MA·W22 가 이것만 쓴다

test('U0 환산 한 자리 — 정의 1 · 읽는 이 2 · 맨 나눗셈 0', () => {
  const s = SRC();
  const def = s.match(/function _gradScreenToLocal\(/g) || [];
  const calls = (s.match(/_gradScreenToLocal\(/g) || []).length - def.length;
  const bare = s.match(/GRAD_SNAP_SCREEN\s*\//g) || [];
  expect([def.length, calls, bare.length], '[정의, 읽는 이, 맨 나눗셈]').toEqual([1, 2, 0]);
});

test('U1 자가 산다 — 12 는 참 문턱 안 · 무력화 문턱 밖 · 22 는 둘 다 밖', () => {
  for (const z of [0.25, 0.4, 0.5, 0.6]) {
    expect([NEAR < SNAP, NEAR > SNAP * z, FAR > SNAP], `배율 ${z}`).toEqual([true, true, true]);
  }
});
test('U1N 자가 산다 — near 는 ±3 안만 참 · 일부러 어긋남은 거짓(D1N 베낌)', () => {
  expect([near(55, 55), near(57.9, 55), near(51.5, 55), near(0, 55), near(200, 55), near(55 * 2, 55)]).toEqual([true, true, false, false, false, false]);
});

const scaleNow = () => { const m = getComputedStyle(document.getElementById('canvas-scaler')).transform;
  return { render: m === 'none' ? 1 : new DOMMatrix(m).a, cur: (window.currentZoom || 40) / 100 }; };
async function setup(page) {
  await page.setViewportSize({ width: 1700, height: 1200 });
  const errs = await bootApp(page);
  await waitZoomSettled(page, await page.evaluate(() => window.currentZoom));   // D1 ⑶ 배율 멎은 뒤에 잰다
  const pre = await page.evaluate((sel) => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach((s) => s.remove());
    window.addSection();
    const sec = c.querySelector('.section-block');
    window.selectSection(sec);
    window.addGradientBlock();
    const g = sec.querySelector(':scope > .gradient-block');
    sec.querySelectorAll(sel).forEach((el) => { if (el !== g && !el.contains(g)) el.remove(); });   // 스냅 대상은 그라데 하나만
    Object.assign(g.dataset, { gradWidth: '300', gradHeight: '100', x: '200', y: '40' });
    window.renderGradientBlock(g);
    window.__sec = sec; window.__g = g;
    window.deselectAll?.();
    g.scrollIntoView({ block: 'center', inline: 'center' });
    return { others: [...sec.querySelectorAll(sel)].filter((el) => el !== g).length };
  }, SRC().match(/const _GRAD_TARGET_SEL = '([^']+)'/)[1]);
  await page.evaluate(() => new Promise((done) => { let p = null, n = 0; const t = () => { const r = window.__g.getBoundingClientRect(); const k = [r.left, r.top, r.width].join(); if (k === p) { if (++n >= 2) return done(); } else n = 0; p = k; requestAnimationFrame(t); }; requestAnimationFrame(t); }));
  const p = await page.evaluate(() => { const r = window.__g.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  await page.mouse.click(p[0], p[1]);
  await page.waitForFunction(() => window.__g.classList.contains('selected'));
  const zz = await page.evaluate(scaleNow);
  /* ★236 ② 섞인 자 — 화면 px 의 참은 렌더 배율(transform) · 제품 환산은 currentZoom ⇒ 둘이 같을 때만 잰다 */
  expect(Math.abs(zz.render - zz.cur), `★전제: 렌더 배율 ${zz.render} ≠ currentZoom ${zz.cur} = GRAD-HARNESS-ZOOM-VARIES-BY-RUN-01`).toBeLessThan(1e-3);
  const z = zz.render;
  /* ★전제를 스스로 단언 — 배율 ≤ 0.6 이 아니면 무력화 문턱(16×배율)이 12 를 넘어 한 쌍이 안 선다 */
  expect(z, `★전제: 배율 ${z} > 0.6`).toBeLessThanOrEqual(0.6);
  expect(pre.others, '★전제: 섹션 안에 그라데 말고 스냅 대상이 남았다').toBe(0);
  return { errs, z };
}
/* 그라데 가운데를 눌러 왼변이 섹션 왼끝에서 «gap 화면 px» 가 되게 끈다 · alt = mousedown «뒤» 에 ⌥(D1 꼴) */
async function moveTo(page, gap, { alt = false } = {}) {
  const s = await page.evaluate(() => { const r = window.__g.getBoundingClientRect(), q = window.__sec.getBoundingClientRect();
    return { cx: r.left + r.width / 2, cy: r.top + r.height / 2, gl: r.left - q.left }; });   // 제품 식과 같은 자: (clientX − secRect.left)/zoom
  const dx = gap - s.gl, x0 = +(await page.evaluate(() => window.__g.dataset.x));
  await page.mouse.move(s.cx, s.cy); await page.mouse.down();
  if (alt) await page.keyboard.down('Alt');
  for (let i = 1; i <= 8; i++) await page.mouse.move(s.cx + dx * i / 8, s.cy);
  await page.mouse.up();
  if (alt) await page.keyboard.up('Alt');
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const x = +(await page.evaluate(() => window.__g.dataset.x));
  expect(x, `GRAD-DRAG-HARNESS-CANNOT-DRIVE-DRAG-01 — 끌기가 안 먹었다(x ${x} 그대로)`).not.toBe(x0);   // D1 ⑸ 이름 있는 실패
  return x;
}
/* br 손잡이로 폭을 «섹션 폭 − short 화면 px» 까지 끈다(왼변 x = 0 에서) */
async function widenTo(page, short) {
  await page.evaluate(() => { window.__g.dataset.x = '0'; window.renderGradientBlock(window.__g); if (!window.__g.classList.contains('selected')) window._selectGradient(window.__g); });
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  /* ★골라진 그라데의 모서리 손잡이는 js/overlay-handles.js HANDLE_ESCAPE_SPECS 가 #ss-handles-overlay(고정층)로 옮긴다 ⇒ 블럭 자식이 아니라 거기서 찾는다(지디 09:5x 236 처방)
     ★임자 전제: 골라진 그라데 = 그 블럭 하나 · 그 블럭이 탈출했다(__handlesEscaped) · 고정층 br 손잡이 = 하나 · 그 가운데가 블럭 오른아래 모서리(±6 화면 px) */
  const h = await page.evaluate(() => {
    const g = window.__g, ov = document.getElementById('ss-handles-overlay');
    const sel = [...document.querySelectorAll('#canvas .gradient-block.selected')];
    const brs = ov ? [...ov.querySelectorAll('.gradient-corner-handle[data-corner="br"]')] : [];
    const inBlock = g.querySelectorAll(':scope > .gradient-corner-handle').length;
    const e = brs[0], gr = g.getBoundingClientRect(), m = getComputedStyle(document.getElementById('canvas-scaler')).transform, z = m === 'none' ? 1 : new DOMMatrix(m).a;
    const r = e ? e.getBoundingClientRect() : null;
    return { overlay: !!ov, selOnlyG: sel.length === 1 && sel[0] === g, escaped: g.__handlesEscaped === true, brs: brs.length, inBlock,
      x: r ? r.left + r.width / 2 : null, y: r ? r.top + r.height / 2 : null, cornerOff: r ? [Math.round(r.left + r.width / 2 - gr.right), Math.round(r.top + r.height / 2 - gr.bottom)] : null,
      z, w0: +g.dataset.gradWidth, secW: window.__sec.offsetWidth };
  });
  expect([h.overlay, h.selOnlyG, h.escaped, h.brs], `★전제: 고정층 · 골라진 그라데 = 그 블럭 하나 · 탈출함 · br 손잡이 하나 ${JSON.stringify(h)}`).toEqual([true, true, true, 1]);
  expect(Math.abs(h.cornerOff[0]) <= 6 && Math.abs(h.cornerOff[1]) <= 6, `★전제: br 손잡이가 그 블럭 오른아래 모서리에 있지 않다(임자) ${JSON.stringify(h)}`).toBe(true);
  const dx = (h.secW - h.w0) * h.z - short;
  await page.mouse.move(h.x, h.y); await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(h.x + dx * i / 8, h.y);
  await page.mouse.up();
  const w = +(await page.evaluate(() => window.__g.dataset.gradWidth));
  expect(w, `★리사이즈가 안 먹었다(폭 ${w} 그대로)`).not.toBe(h.w0);
  return { w, secW: h.secW, z: h.z };
}

test('M12 이동 — 섹션 왼끝 12 화면 px 안이면 x = 0', async ({ page }) => {
  const { errs } = await setup(page);
  expect(await moveTo(page, NEAR), '★12 화면 px 인데 안 붙었다(환산이 화면 px 를 안 따른다)').toBe(0);
  expect(errs).toEqual([]);
});
test('M22 이동 음성 — 22 화면 px 이면 안 붙는다', async ({ page }) => {
  const { errs, z } = await setup(page);
  const x = await moveTo(page, FAR);
  expect(near(x, FAR / z), `★22 화면 px 인데 x=${x} (기대 ≈${(FAR / z).toFixed(1)})`).toBe(true);
  expect(errs).toEqual([]);
});
test('MA 이동 ⌥(mousedown 뒤) — 12 화면 px 이어도 안 붙는다', async ({ page }) => {
  const { errs, z } = await setup(page);
  const x = await moveTo(page, NEAR, { alt: true });
  expect(near(x, NEAR / z), `★⌥ 인데 x=${x} (기대 ≈${(NEAR / z).toFixed(1)})`).toBe(true);
  expect(errs).toEqual([]);
});
test('W12 리사이즈 — 섹션 폭 12 화면 px 안이면 폭 = 섹션 폭', async ({ page }) => {
  const { errs } = await setup(page);
  const r = await widenTo(page, NEAR);
  expect(r.w, `★12 화면 px 인데 안 붙었다 ${JSON.stringify(r)}`).toBe(r.secW);
  expect(errs).toEqual([]);
});
test('W22 리사이즈 음성 — 22 화면 px 이면 안 붙는다', async ({ page }) => {
  const { errs } = await setup(page);
  const r = await widenTo(page, FAR);
  expect(near(r.w, r.secW - FAR / r.z), `★22 화면 px 인데 ${JSON.stringify(r)}`).toBe(true);
  expect(errs).toEqual([]);
});
