/* coin-sticker-1013t2 — 코인 스티커의 Position(X·Y) 칸과 「번짐」 (현빈 노트 1013t2C2 · 1013t2C3).
 *
 * ★무엇을 잠그나
 *   C2-a Position 절 — Coin 절 «위»에 있고 · 텍스트 패널 Position 과 같은 마크업 꼴 · 칸 = 저장값 · 쳐 넣으면 코인이 그 자리로 간다 · ⌘Z 한 걸음
 *   C2-b ★10% 남기기 — 섹션 밖으로 한참 나가는 값을 넣어도 «코인 그림»의 10% 는 섹션 안이다(네 변) · 가둔 값이 칸에 되적힌다
 *        ★그림을 화면에서 «직접» 잰다(앞면 타원 ＋ 옆띠의 화면 사각형 ∩ 섹션 사각형) — 제품의 계산식을 다시 부르지 않는다.
 *        ★상자가 아니라 그림이다 — 상자 기준이면 그림이 통째로 밖에 있을 수 있다(여백이 한쪽 15%).
 *   C2-c 잘림 — 밖으로 나간 부분은 고르지 않은 동안 clip-path 로 잘린다 · 고른 동안은 안 잘린다(손잡이를 잡을 수 있게)
 *   C2-d ⌘ 끌기 — 코인은 10% 를 남기고 · X·Y 칸이 끄는 대로 따라온다 · 코인이 아닌 스티커는 이 한도를 안 받는다
 *   C2-e 각도가 바뀌어 그림 상자가 달라지면 다시 가둔다
 *   C3-a 「번짐」 행 — 광택 다음 · 섹션 파티클의 「번짐」 행과 같은 꼴(라벨·슬라이더·숫자칸의 class·min·max·step·높이)
 *   C3-b 값 → 그림 — 필터가 생기고 세로로만 번진다 · 0 이면 원래 그림 · 범위 밖은 14 · ⌘Z 한 걸음
 *   C3-c 저장 → 다시 열기 — 번짐이 그대로 · 번짐 없는 코인의 저장본에는 그 속성이 없다
 *   C3-d ★내보내기 그림 두 길(PNG = CDP 오프스크린 · 썸네일 = html2canvas) — 번짐이 그림에 실린다(세로로만) · 대조 = 번짐 없는 코인
 *   C2-f 크기를 줄여도 10% 가 남는다(손잡이로 줄인 뒤 다시 가둔다)
 * ★자리 비교는 «레이아웃 px»(dataset)로, 그림은 화면 사각형의 «비율»로 잰다(배율과 무관).
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');
const { clickAt } = require('./_click-at.js');
const { expectOneUndoStep } = require('./_history-step.js');

const SEC = '[id="secC"]';
const SEC_HTML = '<div class="section-block" id="secC" style="position:relative;height:420px;background:#f4f4f6"><div class="section-inner"></div></div>';

async function setup(page) {
  await page.evaluate((html) => { document.getElementById('canvas').innerHTML = html; window.rebindAll?.(); }, SEC_HTML);
}
/* 코드로 코인 하나 — 각도를 «정해서» 만든다(기울기 60 · 방향 0 · 회전 0 ⇒ 그림의 화면 사각형이 딱 맞게 재진다). */
async function make(page, opts = {}) {
  return page.evaluate((opts) => {
    const b = window.makeStickerBlock({ shape: 'coin', seed: 201, coinTilt: 60, coinDir: 0, x: 120, y: 80, ...opts });
    document.getElementById('secC').appendChild(b);
    window.bindStickerSelect?.(b);
    return b.id;
  }, opts);
}
async function scrollSettled(page) {
  await page.waitForFunction(() => new Promise((resolve) => {
    const w = document.getElementById('canvas-wrap');
    let last = w.scrollTop, same = 0;
    const tick = () => { const now = w.scrollTop; same = now === last ? same + 1 : 0; last = now; if (same >= 12) resolve(true); else requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  }));
}
/* 코인을 실제 마우스로 눌러 고른다 — ★전제: 누를 점이 뷰포트 안이고 그 점의 맨 위 요소가 그 코인이다. */
async function pick(page, id) {
  const sel = `[id="${id}"]`;
  await scrollSettled(page);
  await page.evaluate((id) => document.getElementById(id).scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' }), id);
  await scrollSettled(page);
  const r = await waitStableRect(page, sel);
  const at = await page.evaluate(([x, y, id]) => {
    const e = document.elementFromPoint(x, y), b = document.getElementById(id);
    return [x > 0 && y > 0 && x < window.innerWidth && y < window.innerHeight, !!e && (e === b || b.contains(e))];
  }, [r.cx, r.cy, id]);
  expect(at, `★전제: 누를 점 (${r.cx},${r.cy}) 이 뷰포트 안이고 그 코인 위다`).toEqual([true, true]);
  await clickAt(page, r.cx, r.cy, { sel: '#' + id }, { label: '코인 고르기' });
  await expect.poll(() => page.evaluate((id) => document.getElementById(id)?.classList.contains('selected') && !!document.getElementById('stk-coin-x'), id),
    '★전제: 코인이 골라지고 Position 칸이 떴다').toBe(true);
}
async function typeInto(page, sel, value) {
  await page.click(sel);
  await page.keyboard.press('Meta+a');
  await page.keyboard.type(String(value));
  await page.keyboard.press('Enter');
}
/* 「조작 한 번 = ⌘Z 한 걸음」 — 기존 코인 검사(coin-sticker K9)와 같은 꼴: 히스토리 수(A1·A2)는 헬퍼가, 되돌아온 값·그림은 여기서 직접 본다. */
async function oneUndo(page, id, label, action) {
  const snap = () => page.evaluate((id) => { const b = document.getElementById(id); return b ? { d: { ...b.dataset }, svg: b.querySelector(':scope > svg')?.outerHTML, left: b.style.left, top: b.style.top } : null; }, id);
  const before = await snap();
  const h = await expectOneUndoStep(page, action, label, { soft: true });
  expect(h.changed, `${label}: A0 조작이 화면을 바꿨다`).toBe(true);
  expect(h.dPos >= 1 && h.seqNew, `${label}: A1 조작 직후 꼭대기가 새 칸(끝 표본) — Δpos=${h.dPos}`).toBe(true);
  expect([h.undoDLen, h.undoDPos], `${label}: A2 ⌘Z 가 구제 칸을 안 만들고 정확히 한 칸 내려간다`).toEqual([0, -1]);
  expect(await snap(), `${label}: ⌘Z 한 번에 값·자리·그림이 조작 전으로`).toEqual(before);
}
const ds = (page, id) => page.evaluate((id) => ({ ...document.getElementById(id).dataset }), id);

/* ★코인 «그림»이 섹션 안에 남은 비율 — 화면에서 직접 잰다.
   그림 = 옆띠(첫 path) ∪ 앞면 타원(fill 이 gradient 인 첫 ellipse). 방향 0·회전 0 이라 각 요소의 화면 사각형이 딱 맞는다.
   돌려줌: { fx, fy } = 가로·세로로 섹션 안에 남은 비율(0~1) · inkW/inkH = 그림의 레이아웃 px 크기. */
const inkInside = (page, id) => page.evaluate((id) => {
  const b = document.getElementById(id), sec = b.closest('.section-block');
  const side = b.querySelector('svg path'), face = b.querySelector('svg ellipse[fill^="url("]');
  const rs = [side, face].map((e) => e.getBoundingClientRect());
  const ink = { l: Math.min(...rs.map((r) => r.left)), r: Math.max(...rs.map((r) => r.right)), t: Math.min(...rs.map((r) => r.top)), b: Math.max(...rs.map((r) => r.bottom)) };
  const s = sec.getBoundingClientRect();
  const z = s.width / sec.clientWidth;
  const ov = (a0, a1, b0, b1) => Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));
  const box = b.getBoundingClientRect();
  return { fx: ov(ink.l, ink.r, s.left, s.right) / (ink.r - ink.l), fy: ov(ink.t, ink.b, s.top, s.bottom) / (ink.b - ink.t),
    inkW: (ink.r - ink.l) / z, inkH: (ink.b - ink.t) / z,
    boxFx: ov(box.left, box.right, s.left, s.right) / box.width, boxFy: ov(box.top, box.bottom, s.top, s.bottom) / box.height,
    secW: sec.clientWidth, secH: sec.clientHeight };
}, id);

test('C2-a Position 절 — Coin 절 위 · 텍스트 Position 과 같은 꼴 · 쳐 넣으면 그 자리로 · ⌘Z 한 걸음', async ({ page }) => {
  const errs = await bootApp(page);
  await setup(page);
  const id = await make(page);
  await pick(page, id);
  await page.evaluate(() => window.pushHistory?.('준비'));              // 코드로 넣은 코인을(고른 채로) 히스토리 꼭대기에 올린다 — ⌘Z 가 돌아갈 자리
  const p = await page.evaluate(() => {
    const pos = document.getElementById('stk-coin-pos-section'), coin = document.getElementById('stk-coin-section');
    const sig = (inp) => { const w = inp.closest('.prop-icon-input'); return [inp.type, w?.className, w?.querySelector('.prop-xy-label')?.textContent, w?.parentElement.className, w?.parentElement.parentElement.className, inp.getAttribute('aria-label')]; };
    return { before: !!(pos.compareDocumentPosition(coin) & Node.DOCUMENT_POSITION_FOLLOWING), label: pos.querySelector('.prop-field-label')?.textContent.trim(),
      x: sig(document.getElementById('stk-coin-x')), y: sig(document.getElementById('stk-coin-y')),
      vals: [document.getElementById('stk-coin-x').value, document.getElementById('stk-coin-y').value],
      h: [...pos.querySelectorAll('.prop-icon-input')].map((e) => Math.round(e.getBoundingClientRect().height)),
      w: [...pos.querySelectorAll('.prop-icon-input')].map((e) => Math.round(e.getBoundingClientRect().width)) };
  });
  expect([p.before, p.label], 'Position 절이 Coin 절 위에 있다').toEqual([true, 'Position']);
  /* 텍스트 패널 Position 칸(js/props/prop-text-template.js)과 같은 꼴: .prop-lhls-row > .prop-lhls-col > .prop-icon-input > .prop-xy-label + input[type=number] */
  expect(p.x).toEqual(['number', 'prop-icon-input', 'X', 'prop-lhls-col', 'prop-lhls-row', 'X position']);
  expect(p.y).toEqual(['number', 'prop-icon-input', 'Y', 'prop-lhls-col', 'prop-lhls-row', 'Y position']);
  expect(p.vals, '칸 = 저장값').toEqual(['120', '80']);
  expect([p.h[0] === p.h[1], p.w[0] === p.w[1], p.h[0] > 10, p.w[0] > 40], 'X·Y 두 칸이 같은 크기로 보인다').toEqual([true, true, true, true]);

  /* 쳐 넣는다 — 저장값 · 화면 자리 · 칸이 같이 간다 · 그림은 안 바뀐다 */
  const svg0 = await page.evaluate((id) => document.getElementById(id).querySelector('svg').outerHTML, id);
  await oneUndo(page, id, '코인 X', async () => {
    await typeInto(page, '#stk-coin-x', 300);
    await expect.poll(async () => (await ds(page, id)).x).toBe('300');
  });
  await pick(page, id);
  await typeInto(page, '#stk-coin-x', 300);
  await typeInto(page, '#stk-coin-y', 210);
  await expect.poll(async () => { const d = await ds(page, id); return [d.x, d.y]; }).toEqual(['300', '210']);
  const a = await page.evaluate((id) => { const b = document.getElementById(id); return [b.style.left, b.style.top, b.offsetLeft, b.offsetTop, b.querySelector('svg').outerHTML, b.classList.contains('selected'), b.querySelectorAll(':scope > .sticker-corner-handle').length]; }, id);
  expect(a.slice(0, 4)).toEqual(['300px', '210px', 300, 210]);
  expect([a[4] === svg0, a[5], a[6]], '자리만 바뀐다(그림·선택·손잡이 그대로)').toEqual([true, true, 4]);
  expect(errs).toEqual([]);
});

test('C2-b ★10% 남기기 — 한참 밖의 값을 넣어도 코인 그림의 10% 는 섹션 안 · 가둔 값이 칸에 되적힌다(네 변)', async ({ page }) => {
  await bootApp(page);
  await setup(page);
  const id = await make(page);
  await pick(page, id);
  const base = await inkInside(page, id);
  expect([base.fx > 0.999, base.fy > 0.999], '★전제: 처음엔 그림이 통째로 섹션 안이다').toEqual([true, true]);
  expect(base.inkW > 70 && base.inkW < 90 && base.inkH > 50 && base.inkH < 65, `★전제: 그림 크기 ≈ 83×58 (받음 ${base.inkW}×${base.inkH}) — 상자 120 보다 작다`).toBe(true);

  /* 좌표가 정수라 10% 에서 안쪽으로 최대 1px 더 들어온다 ⇒ 비율은 [10%, 10% + 1px/그림] */
  const near = (f, ink) => f >= 0.1 - 1e-3 && f <= 0.1 + 1.01 / ink + 1e-3;
  for (const [axis, v, key, ink] of [['x', 99999, 'fx', 'inkW'], ['x', -99999, 'fx', 'inkW'], ['y', 99999, 'fy', 'inkH'], ['y', -99999, 'fy', 'inkH']]) {
    await typeInto(page, '#stk-coin-' + axis, 100);                       // 먼저 안으로 되돌려 놓는다
    await expect.poll(async () => (await ds(page, id))[axis]).toBe('100');
    await typeInto(page, '#stk-coin-' + axis, v);
    await expect.poll(async () => (await ds(page, id))[axis] !== '100', `${axis}=${v}: 값이 안 먹었다`).toBe(true);
    const got = await inkInside(page, id);
    const d = await ds(page, id);
    expect(near(got[key], got[ink]), `${axis}=${v} → 저장 ${d[axis]} · 섹션 안에 남은 그림 ${(got[key] * 100).toFixed(2)}% (10% 여야 한다)`).toBe(true);
    expect(await page.inputValue('#stk-coin-' + axis), '가둔 값이 칸에 되적힌다').toBe(d[axis]);
    expect(Math.abs(+d[axis]) < 5000, '넣은 값이 그대로 저장되지 않았다').toBe(true);
    expect(await page.evaluate((id) => { const b = document.getElementById(id); return [b.style.left, b.style.top]; }, id)).toEqual([d.x + 'px', d.y + 'px']);
  }
  /* ★「상자의 10%」가 아니다 — 세로로 끝까지 내렸을 때 상자는 10% 보다 훨씬 많이 남아 있다(그림이 상자 가운데에 있어서) */
  const last = await inkInside(page, id);
  expect(last.boxFy > 0.15, `위로 끝까지 올린 뒤 상자는 ${(last.boxFy * 100).toFixed(1)}% 남는다 — 상자 기준 10% 였다면 그림은 다 나갔다`).toBe(true);
  /* 범위는 칸의 min/max 에도 적힌다(숫자칸 공용 가드가 읽는다) */
  const lim = await page.evaluate(() => ['stk-coin-x', 'stk-coin-y'].map((i) => { const e = document.getElementById(i); return [+e.min < 0, +e.max > 0, +e.min < +e.max]; }));
  expect(lim).toEqual([[true, true, true], [true, true, true]]);
});

test('C2-c 잘림 — 밖으로 나간 부분은 고르지 않은 동안 잘리고 · 고른 동안은 안 잘린다', async ({ page }) => {
  await bootApp(page);
  await setup(page);
  const id = await make(page);
  await pick(page, id);
  await typeInto(page, '#stk-coin-x', -99999);
  await expect.poll(async () => +(await ds(page, id)).x < 0).toBe(true);
  const x = +(await ds(page, id)).x;
  const sel = await page.evaluate((id) => { const b = document.getElementById(id); return [b.classList.contains('selected'), getComputedStyle(b).clipPath, b.style.getPropertyValue('--sec-clip')]; }, id);
  expect([sel[0], sel[1]], '고른 동안은 안 잘린다').toEqual([true, 'none']);
  expect(sel[2], '밖으로 나간 만큼의 잘림 값이 적혀 있다').toBe(`inset(0px 0px 0px ${-x}px)`);
  /* 고르기를 푼다 — 섹션의 빈 자리를 누른다 */
  const r = await waitStableRect(page, SEC);
  await clickAt(page, r.left + r.width * 0.92, r.top + r.height * 0.9, { sel: SEC, not: '.sticker-block' }, { label: '섹션 빈 자리' });
  await expect.poll(() => page.evaluate((id) => document.getElementById(id).classList.contains('selected'), id), '★전제: 코인 고르기가 풀렸다').toBe(false);
  expect(await page.evaluate((id) => getComputedStyle(document.getElementById(id)).clipPath, id), '고르지 않은 코인은 섹션 경계에서 잘린다').toBe(`inset(0px 0px 0px ${-x}px)`);
});

test('C2-d ⌘ 끌기 — 코인은 10% 를 남기고 · X·Y 칸이 따라온다 · 코인이 아닌 스티커는 한도가 없다', async ({ page }) => {
  await bootApp(page);
  await setup(page);
  const id = await make(page);
  await pick(page, id);
  const r0 = await waitStableRect(page, `[id="${id}"]`);
  const secR = await waitStableRect(page, SEC);
  /* 왼쪽으로 상자 세 개만큼 끈다(화면 px) — 코인은 섹션 왼쪽 끝에서 상자 하나쯤 떨어져 있으므로, 한도가 없으면 통째로 밖이다 */
  const far = r0.width * 3;
  expect([r0.cx - far > 0, r0.left - secR.left < r0.width * 1.5], '★전제: 끌 끝점이 뷰포트 안이고, 그만큼 끌면 코인이 섹션을 벗어난다').toEqual([true, true]);
  await page.keyboard.down('Meta');
  await page.mouse.move(r0.cx, r0.cy);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(r0.cx - far * i / 10, r0.cy);
  const midX = await page.inputValue('#stk-coin-x');
  await page.mouse.up();
  await page.keyboard.up('Meta');
  const d = await ds(page, id);
  expect(+d.x < -50, `★전제: ⌘ 끌기로 섹션 밖까지 나갔다(x=${d.x})`).toBe(true);
  const got = await inkInside(page, id);
  expect(got.fx >= 0.1 - 1e-3 && got.fx <= 0.1 + 1.01 / got.inkW + 1e-3, `⌘ 끌기 뒤 섹션 안에 남은 그림 ${(got.fx * 100).toFixed(2)}% (10% 여야 한다)`).toBe(true);
  expect(midX, 'X 칸이 끄는 동안 저장값을 따라온다').toBe(d.x);
  /* 놓은 뒤 — 패널이 그대로면 그 칸을, 다른 패널로 바뀌었으면 다시 골라서 본다(어느 쪽이었는지 적어 둔다) */
  const kept = await page.evaluate(() => !!document.getElementById('stk-coin-x'));
  test.info().annotations.push({ type: 'note', description: `⌘ 끌기 뒤 코인 패널이 남아 있나: ${kept}` });
  if (!kept) {                                                          // 코인 가운데가 섹션 밖이라 마우스로는 못 누른다 — 코드로 고른다
    await page.evaluate((id) => window._selectSticker(document.getElementById(id)), id);
    await page.waitForSelector('#stk-coin-x');
  }
  expect([await page.inputValue('#stk-coin-x'), await page.inputValue('#stk-coin-y')], '놓은 뒤 X·Y 칸 = 저장값').toEqual([d.x, d.y]);
  /* 코인이 아닌 스티커는 이 한도를 안 받는다(다른 스티커의 ⌘ 자유 이동은 그대로) */
  const other = await page.evaluate(() => {
    const b = window.makeStickerBlock({ shape: 'circle', x: 40, y: 40 });
    const sec = document.getElementById('secC'); sec.appendChild(b);
    return [window._clampCoinKeep(b, -99999, 0, sec), window._coinKeepRange(b, sec)];
  });
  expect(other).toEqual([null, null]);
});

test('C2-e 생김새(두께)가 바뀌어 그림 상자가 달라지면 다시 가둔다(코인이 10% 아래로 밖에 남지 않는다)', async ({ page }) => {
  await bootApp(page);
  await setup(page);
  const id = await make(page, { coinTilt: 0, coinDir: 0, sizeW: 240, sizeH: 240 });   // 정면 — 그림 폭이 가장 넓다 · 크게(한도 차이가 3px 로 벌어진다)
  await pick(page, id);
  await typeInto(page, '#stk-coin-x', -99999);
  await expect.poll(async () => +(await ds(page, id)).x < 0).toBe(true);
  const x0 = +(await ds(page, id)).x;
  expect((await inkInside(page, id)).fx, '★전제: 정면 코인이 왼쪽 끝에서 10% 남아 있다').toBeGreaterThanOrEqual(0.1 - 1e-3);
  /* 두께 22 → 40 — 상자 안에서 그림이 작아진다(viewBox 가 넓어진다) ⇒ 그림의 오른쪽 끝이 안쪽으로 들어와 같은 x 로는 10% 가 안 남는다 */
  await typeInto(page, '#stk-coin-k-num', 40);
  await expect.poll(async () => (await ds(page, id)).coinK).toBe('40');
  const d = await ds(page, id);
  const lim = await page.evaluate((id) => { const b = document.getElementById(id); return window._coinKeepRange(b, b.closest('.section-block')); }, id);
  expect(+d.x > x0 + 5, `두께를 바꿨는데 자리가 그대로다(x ${x0} → ${d.x}) — 그림이 10% 아래로 남는다`).toBe(true);
  expect(+d.x, '새 그림 상자의 왼쪽 한도로 왔다').toBe(lim.minX);
  expect([await page.inputValue('#stk-coin-x'), await page.evaluate((id) => document.getElementById(id).style.left, id)]).toEqual([d.x, d.x + 'px']);
});

test('C3-a 「번짐」 행 — 광택 다음 · 섹션 파티클의 「번짐」 행과 같은 꼴', async ({ page }) => {
  await bootApp(page);
  await setup(page);
  const id = await make(page);
  const rowSig = (sel) => page.evaluate((sel) => {
    const num = document.querySelector(sel), row = num.closest('.prop-row');
    const kids = [...row.children].map((e) => [e.tagName, e.className, e.type || '', e.min ?? '', e.max ?? '', e.step ?? ''].join('|'));
    const cs = (e, k) => getComputedStyle(e)[k];
    const lab = row.querySelector('.prop-label'), rng = row.querySelector('input[type=range]');
    return { label: lab.textContent.trim(), kids,
      rowH: Math.round(row.getBoundingClientRect().height), numH: Math.round(num.getBoundingClientRect().height), numW: Math.round(num.getBoundingClientRect().width),
      labW: Math.round(lab.getBoundingClientRect().width), labFont: cs(lab, 'fontSize') + '/' + cs(lab, 'color'), numFont: cs(num, 'fontSize') + '/' + cs(num, 'color'),
      range: [rng.min, rng.max, rng.step || '1'], number: [num.min, num.max] };
  }, sel);
  /* ① 섹션 파티클의 「번짐」 행 — 섹션 패널에서 파티클을 켜고 읽는다 */
  await page.evaluate(() => { window.deselectAll?.(); const s = document.getElementById('secC'); s.classList.add('selected'); return window.showSectionProperties(s); });
  await page.waitForSelector('#sec-fxpart-toggle');
  await page.click('#sec-fxpart-toggle');
  await page.waitForSelector('[data-fxpart-axis="blur"]');
  const part = await rowSig('[data-fxpart-axis="blur"]');
  expect([part.label, part.range, part.number], '★전제: 파티클 「번짐」 행 — 0~14').toEqual(['번짐', ['0', '14', '1'], ['0', '14']]);
  /* ② 코인의 「번짐」 행 */
  await pick(page, id);
  const coin = await rowSig('#stk-coin-blur-num');
  expect(coin, '코인 「번짐」 행이 파티클 「번짐」 행과 꼴이 다르다').toEqual(part);
  const order = await page.evaluate(() => [...document.querySelectorAll('#stk-coin-section > .prop-row')].map((r) => r.querySelector('.prop-label')?.textContent.trim()).filter(Boolean));
  expect(order.slice(-3), '번짐은 광택 다음 · 각도 잠금 앞').toEqual(['광택', '번짐', '각도 잠금']);
  expect([await page.inputValue('#stk-coin-blur'), await page.inputValue('#stk-coin-blur-num')], '새 코인은 번짐 0').toEqual(['0', '0']);
});

test('C3-b 번짐 값 → 그림 — 세로로만 번지는 필터 · 0 이면 원래 그림 · 범위 밖은 14 · ⌘Z 한 걸음', async ({ page }) => {
  const errs = await bootApp(page);
  await setup(page);
  const id = await make(page);
  await pick(page, id);
  await page.evaluate(() => window.pushHistory?.('준비'));
  const pic = () => page.evaluate((id) => {
    const b = document.getElementById(id), svg = b.querySelector(':scope > svg');
    const f = svg.querySelector('filter'), blur = svg.querySelector('feGaussianBlur');
    const wrap = svg.querySelector(':scope > g[filter]');
    return { html: svg.outerHTML, filterId: f?.id || null, sd: blur?.getAttribute('stdDeviation') || null, wrap: wrap?.getAttribute('filter') || null,
      resolved: wrap ? getComputedStyle(wrap).filter : 'none', blurData: b.dataset.coinBlur ?? null,
      dup: [...document.querySelectorAll('[id]')].map((e) => e.id).filter((x, i, a) => x.startsWith('coin-') && a.indexOf(x) !== i),
      handles: b.querySelectorAll(':scope > .sticker-corner-handle').length };
  }, id);
  const plain = await pic();
  expect([plain.filterId, plain.sd, plain.wrap, plain.blurData], '★전제: 번짐 없는 코인엔 필터가 없다').toEqual([null, null, null, null]);

  await oneUndo(page, id, '코인 번짐', async () => {
    await typeInto(page, '#stk-coin-blur-num', 6);
    await expect.poll(async () => (await pic()).blurData).toBe('6');
  });
  await pick(page, id);
  await typeInto(page, '#stk-coin-blur-num', 6);
  await expect.poll(async () => (await pic()).blurData).toBe('6');
  const on = await pic();
  /* 값 6 · 두께 22% → stdDeviation = 6 × 144 ÷ 120 = 7.2 — 가로 0(세로로만) */
  expect([on.filterId, on.sd, on.wrap], '필터 id 는 제 블럭 id 에서 · 세로로만').toEqual([`coin-${id}b`, '0 7.2', `url(#coin-${id}b)`]);
  expect(on.resolved, '필터 참조가 실제로 풀린다(그 id 가 문서에 있다)').toContain(`coin-${id}b`);
  expect([on.dup, on.handles, await page.inputValue('#stk-coin-blur')], 'id 안 겹침 · 손잡이 그대로 · 슬라이더가 같이 간다').toEqual([[], 4, '6']);

  await typeInto(page, '#stk-coin-blur-num', 99);
  await expect.poll(async () => (await pic()).blurData, '범위 밖은 14 로').toBe('14');
  expect(await page.inputValue('#stk-coin-blur-num')).toBe('14');
  expect((await pic()).sd).toBe('0 16.8');

  await typeInto(page, '#stk-coin-blur-num', 0);
  await expect.poll(async () => (await pic()).blurData).toBe('0');
  expect((await pic()).html, '번짐 0 = 원래 그림과 한 글자도 안 다르다').toBe(plain.html);
  expect(errs).toEqual([]);
});

test('C3-c 저장 → 다시 열기 — 번짐이 그대로 · 번짐을 안 준 코인의 저장본엔 그 속성이 없다', async ({ page }) => {
  await bootApp(page);
  await setup(page);
  const plainId = await make(page, { x: 300, y: 200 });
  const id = await make(page, { coinBlur: 9 });
  const before = await page.evaluate((id) => document.getElementById(id).querySelector('svg').outerHTML, id);
  expect(before.includes('stdDeviation="0 10.8"'), '★전제: 번짐 9 로 그려졌다').toBe(true);
  const snap = await page.evaluate(() => window.serializeProject());
  expect((snap.match(/data-coin-blur=/g) || []).length, '번짐을 준 코인 하나만 그 속성을 갖는다').toBe(1);
  expect(snap.includes('data-coin-blur=\\"9\\"')).toBe(true);
  await bootApp(page);                                                   // 새 페이지 로드 = 앱 재기동
  await page.evaluate((d) => window.applyProjectData(JSON.parse(d)), snap);
  await expect.poll(() => page.evaluate(() => document.querySelectorAll('#canvas .sticker-block[data-shape="coin"] > svg').length), '다시 열었는데 코인이 안 그려졌다').toBe(2);
  const after = await page.evaluate(([id, plainId]) => [document.getElementById(id).querySelector('svg').outerHTML, document.getElementById(id).dataset.coinBlur,
    document.getElementById(plainId).querySelector('svg').outerHTML.includes('<filter')], [id, plainId]);
  expect([after[0] === before, after[1], after[2]], '다시 연 그림이 저장 전과 같다').toEqual([true, '9', false]);
});

test('C3-d ★내보내기 그림 두 길(PNG · CDP 오프스크린 / 썸네일 · html2canvas) — 번짐이 실린다(세로로만) · 대조 = 번짐 없는 코인', async ({ page }) => {
  test.setTimeout(120000);
  await bootApp(page);
  await page.evaluate(() => {
    document.getElementById('canvas').innerHTML = '<div class="section-block" id="secC" style="position:relative;height:420px;background:#101018"><div class="section-inner"></div></div>';
    window.rebindAll?.();
  });
  /* 정면 · 각인·광택 없음 — 코인 = 지름 125(= 180 ÷ 1.44)의 금색 원. 왼쪽 = 번짐 없음(대조), 오른쪽 = 번짐 10(상자 180 에서 세로 15px) */
  const common = { coinTilt: 0, coinDir: 0, sizeW: 180, sizeH: 180, y: 120, coinGloss: 0, coinGlyph: '' };
  const ids = [await make(page, { ...common, x: 120 }), await make(page, { ...common, x: 480, coinBlur: 10 })];
  const info = await page.evaluate((ids) => {
    const sec = document.getElementById('secC');
    const clone = sec.cloneNode(true);
    clone.id = 'secC-clone';
    clone.style.cssText += ';position:fixed;top:-99999px;left:0;width:860px;margin:0;outline:none;';
    document.body.appendChild(clone);
    const r = clone.getBoundingClientRect();
    const centers = ids.map((id) => { const b = document.getElementById(id); return { x: (parseFloat(b.style.left) || 0) + b.offsetWidth / 2, y: (parseFloat(b.style.top) || 0) + b.offsetHeight / 2 }; });
    return { rect: { x: r.left, y: r.top, w: Math.round(r.width), h: Math.round(r.height) }, centers, d: 180 / 1.44,
      sd: document.getElementById(ids[1]).querySelector('feGaussianBlur')?.getAttribute('stdDeviation') };
  }, ids);
  expect(info.sd, '★전제: 오른쪽 코인에 번짐 10 이 그려졌다(10 × 144 ÷ 120)').toBe('0 12');
  const cdp = await page.context().newCDPSession(page);
  const shot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true,
    clip: { x: info.rect.x, y: info.rect.y, width: info.rect.w, height: info.rect.h, scale: 1 } });
  const h2c = await page.evaluate(async () => {
    const cv = await html2canvas(document.getElementById('secC-clone'), { scale: 1, useCORS: true, backgroundColor: '#101018', logging: false });
    return cv.toDataURL('image/png').split(',')[1];
  });
  const measure = (b64) => page.evaluate(async ({ b64, info }) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const k = img.width / info.rect.w;
    const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
    const x = cv.getContext('2d'); x.drawImage(img, 0, 0);
    const px = (X, Y) => [...x.getImageData(Math.round(X * k), Math.round(Y * k), 1, 1).data.slice(0, 3)];
    const lum = (p) => 0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2];
    const bg = lum(px(4, 4)), r = info.d / 2;
    const at = (c) => ({ mid: lum(px(c.x, c.y)) - bg, above: lum(px(c.x, c.y - r - 10)) - bg, below: lum(px(c.x, c.y + r + 10)) - bg, left: lum(px(c.x - r - 10, c.y)) - bg, right: lum(px(c.x + r + 10, c.y)) - bg });
    return { bg, plain: at(info.centers[0]), blur: at(info.centers[1]) };
  }, { b64, info });
  for (const [path, b64] of [['cdp', shot.data], ['h2c', h2c]]) {
    const m = await measure(b64);
    const say = `${path}: ` + JSON.stringify(m, (k, v) => (typeof v === 'number' ? Math.round(v) : v));
    expect(m.bg, `★전제(${path}): 바탕이 어둡다`).toBeLessThan(30);
    expect([m.plain.mid > 80, m.blur.mid > 80], `★전제 — 두 코인 다 가운데가 금색으로 칠해졌다 · ${say}`).toEqual([true, true]);
    /* 대조 — 번짐 없는 코인은 가장자리에서 10px 밖이 바탕이다(네 방향) */
    expect([m.plain.above, m.plain.below, m.plain.left, m.plain.right].every((v) => Math.abs(v) < 6), `★대조 — 번짐 없는 코인의 바깥은 바탕이어야 한다 · ${say}`).toBe(true);
    /* 번짐 — 위·아래로는 코인 밖 10px 까지 색이 번지고, 좌·우로는 안 번진다(세로로만) */
    expect([m.blur.above > 12, m.blur.below > 12], `번짐이 그림에 안 실렸다(위·아래 10px 밖이 바탕이다) · ${say}`).toEqual([true, true]);
    expect([Math.abs(m.blur.left) < 6, Math.abs(m.blur.right) < 6], `번짐이 가로로도 났다 · ${say}`).toEqual([true, true]);
  }
});

test('C2-f 크기 손잡이로 줄여도 코인 그림의 10% 는 섹션 안에 남는다', async ({ page }) => {
  await bootApp(page);
  await setup(page);
  const id = await make(page, { sizeW: 240, sizeH: 240, x: 300, y: 80 });
  await pick(page, id);
  await typeInto(page, '#stk-coin-x', 99999);                             // 오른쪽 끝 — 그림의 10% 만 섹션 안
  await expect.poll(async () => +(await ds(page, id)).x > 300).toBe(true);
  const x0 = +(await ds(page, id)).x;
  /* 왼쪽 위 손잡이(섹션 안쪽에 있다)를 오른쪽 아래로 끌어 줄인다 — 오른쪽 아래가 고정이라 그림이 섹션 밖으로 밀려난다 */
  const h = await waitStableRect(page, `[id="${id}"] > .sticker-corner-handle[data-corner="tl"]`);
  expect(await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.className, [h.cx, h.cy]), '★전제: 누르는 점이 크기 손잡이 위다').toBe('sticker-corner-handle');
  const box = await waitStableRect(page, `[id="${id}"]`);
  await page.mouse.move(h.cx, h.cy);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(h.cx + box.width * 0.5 * i / 8, h.cy + box.height * 0.5 * i / 8);
  await page.mouse.up();
  const d = await ds(page, id);
  expect(+d.sizeW < 200, `★전제: 줄었다(sizeW ${d.sizeW})`).toBe(true);
  const got = await inkInside(page, id);
  expect(got.fx >= 0.1 - 1e-3, `줄인 뒤 섹션 안에 남은 그림 ${(got.fx * 100).toFixed(2)}% — 10% 아래다(x ${x0} → ${d.x})`).toBe(true);
  expect(await page.evaluate((id) => document.getElementById(id).style.left, id)).toBe(d.x + 'px');
});
