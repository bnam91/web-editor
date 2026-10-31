/* scaler-zoom-roundtrip-320.dom — ★320 줌 왕복으로 #canvas-wrap 높이가 브라우저 상한(2^24)까지 자라지 않는다
 *
 * ★증상: 줌 버튼으로 100→200→100 한 번이면 #canvas-wrap.scrollHeight = 16777216 · 그 판에서 End 를 누르면 캔버스가 회색만 남는다.
 * ★뿌리(변이로 쟀다 · 블럭 1개): _syncScalerHeight 의 입력에 #todo-pin-overlay(height:100%)가 들어가 ㉡ 가 클릭마다 배율² 배.
 * ★자의 수 N = round(왕복 전 흐름 높이 × 1.5) + 왕복 전 꼬리(wrapH − 흐름 높이).
 *   까닭: ⛔«지금 최대»를 박으면 항등식이다 — 왕복 «전» 값에서만 파생하므로 고침 전 판에서 거짓이 된다. 1.5 = 반올림·꼬리가 흔들릴 몫이고
 *   정상값(1 배)과 증상(N 의 수천 배)이 그 사이에서 갈린다. 전제 Z0 가 «왕복이 정말 200% 에 닿았다»를 잠근다(안 닿으면 초록이 뜻이 없다).
 * ★음성대조: GD1001_ROOT=<고침 전 트리> 로 이 파일을 돌리면 Z1·Z2 가 빨개야 한다(_root-harness 의 ROOT).
 * ★Z2 = 이 고침의 유일하게 알려진 차이 — 같은 배율에서 캔버스가 줄 때 scaler 높이가 «바로» 따라간다(고침 전엔 다음 배율 변경까지 옛 값).
 * 자가 안 보는 것: 사람 속도 · ⌘ 키·휠 · 핀 있는 판 · 섹션 많은 판. 기다림은 전부 조건(고정 대기 0).
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const read = (page) => page.evaluate(() => {
  const sc = document.getElementById('canvas-scaler'), cv = document.getElementById('canvas'), w = document.getElementById('canvas-wrap');
  const O = document.getElementById('todo-pin-overlay');
  return { z: window.currentZoom, a: sc.style.height, flow: cv.offsetTop + cv.offsetHeight, wrapH: w.scrollHeight, overlayInlineAbs: O.style.position === 'absolute' };
});
async function setup(page, sections = 1) {
  await page.setViewportSize({ width: 1400, height: 1000 });
  const errs = await bootApp(page);
  await page.evaluate(async (n) => {
    for (let i = 0; i < n; i++) await window.addSection();
    window.applyZoom(100);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  }, sections);
  await page.waitForFunction(() => {
    const sc = document.getElementById('canvas-scaler'), cv = document.getElementById('canvas');
    return cv.offsetHeight > 0 && sc.style.height === (cv.offsetTop + cv.offsetHeight) + 'px';
  });
  return errs;
}
async function stepTo(page, want) {
  for (let i = 0; i < 40; i++) {
    const z = await page.evaluate(() => window.currentZoom);
    if (Math.round(z) === want) return;
    await page.click(`#zoom-ctrl .zoom-btn:text-is("${z < want ? '+' : '−'}")`);
  }
  throw new Error('배율을 못 맞췄다: ' + want);
}

test('Z0 전제 — 왕복이 200% 에 닿고 · #todo-pin-overlay 는 inline absolute 다(그 조건이 사라지면 이 자는 뜻을 잃는다)', async ({ page }) => {
  const errs = await setup(page);
  expect((await read(page)).overlayInlineAbs).toBe(true);
  await stepTo(page, 200);
  expect(Math.round((await read(page)).z)).toBe(200);
  expect(errs).toEqual([]);
});

test('Z1 ★배율 왕복 20회 뒤 wrapH ≤ N — 상한에 안 닿는다', async ({ page }) => {
  test.setTimeout(180000);
  await setup(page);
  const b = await read(page);
  const N = Math.round(b.flow * 1.5) + (b.wrapH - b.flow);
  for (let i = 1; i <= 20; i++) {
    await stepTo(page, 200);
    await stepTo(page, 100);
    const m = await read(page);
    expect(m.wrapH, `${i}회 왕복 뒤 wrapH ${m.wrapH} > N ${N} (왕복 전 흐름 ${b.flow} · wrapH ${b.wrapH} · ⒜ ${m.a})`).toBeLessThanOrEqual(N);
  }
});

test('Z2 ★같은 배율에서 캔버스가 줄면 scaler 높이가 바로 따라간다', async ({ page }) => {
  await setup(page, 2);
  const b = await read(page);
  await page.evaluate(() => { [...document.querySelectorAll('#canvas .section-block')].pop().remove(); });
  await page.waitForFunction((f) => (document.getElementById('canvas').offsetTop + document.getElementById('canvas').offsetHeight) < f, b.flow);
  await expect.poll(async () => { const m = await read(page); return m.a === m.flow + 'px'; },
    { message: 'scaler 높이가 줄어든 캔버스를 안 따라갔다', timeout: 3000 }).toBe(true);
});
