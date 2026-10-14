/* coin-sticker-1013t2 — 코인 스티커의 Position(X·Y) 칸과 「번짐」 (현빈 노트 1013t2C2 · 1013t2C3).
 *
 * ★무엇을 잠그나
 *   C2-a Position 절 — Coin 절 «위»에 있고 · 텍스트 패널 Position 과 같은 마크업 꼴 · 칸 = 저장값 · 쳐 넣으면 코인이 그 자리로 간다 · ⌘Z 한 걸음
 *   C2-b ★10% 남기기 — 섹션 밖으로 한참 나가는 값을 넣어도 «코인 그림 면적»의 10% 는 섹션 안이다(네 변 ＋ ★네 모서리) · 가둔 값이 칸에 되적힌다
 *        ★면적을 «따로» 잰다 — 그려진 SVG 를 캔버스에 찍어 그림 화소를 세고, 상자의 자리·회전으로 섹션 좌표에 옮겨 안/밖을 가른다.
 *          제품의 계산(CoinFx.inkFrac · inkBox · _coinKeepRange)을 부르지 않는다.
 *        ★구성 넷 — 기울기·방향·상자 회전·비정사각 상자(독립 평가가 0% 를 잰 꼴들).
 *   C2-g ★회전한 코인의 잘림이 섹션 경계와 맞는다 — clip-path 의 네 점을 화면으로 옮기면 섹션의 네 귀다
 *   C2-h 옛 저장본의 «처음부터 밖에 있던» 코인은 생김새를 바꿔도 안 튄다 · 지키고 있던 코인도 광택·번짐에는 안 움직인다
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

/* ★코인 «그림 면적»이 섹션 안에 남은 비율 — 제품 계산과 «다른 길»로 잰다.
   ① 그려진 SVG 를 상자 크기 캔버스에 찍는다(그림 화소 = 알파 > 40) ② 화소마다 상자 중심 둘레로 data-rotation 만큼 돌리고 자리(left·top)를 더해
   섹션 좌표로 옮긴다 ③ 섹션 사각형 안에 든 화소 수 ÷ 그림 화소 수. 번짐이 없는 코인에서만 쓴다. */
const inkArea = (page, id) => page.evaluate(async (id) => {
  const b = document.getElementById(id), sec = b.closest('.section-block');
  const W = b.offsetWidth, H = b.offsetHeight, x = b.offsetLeft, y = b.offsetTop;
  const src = b.querySelector(':scope > svg').outerHTML.replace('width="100%" height="100%"', `width="${W}" height="${H}"`);
  const img = new Image(); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(src); await img.decode();
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d'); g.drawImage(img, 0, 0, W, H);
  const px = g.getImageData(0, 0, W, H).data;
  const th = (parseFloat(b.dataset.rotation) || 0) * Math.PI / 180, c = Math.cos(th), s = Math.sin(th);
  const SW = sec.clientWidth, SH = sec.clientHeight;
  let all = 0, inn = 0;
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    if (px[(j * W + i) * 4 + 3] <= 40) continue;
    all++;
    const dx = i + 0.5 - W / 2, dy = j + 0.5 - H / 2;
    const X = x + W / 2 + dx * c - dy * s, Y = y + H / 2 + dx * s + dy * c;
    if (X >= 0 && X <= SW && Y >= 0 && Y <= SH) inn++;
  }
  return { frac: all ? inn / all : -1, all, x, y };
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
    return { before: !!(pos.compareDocumentPosition(coin) & Node.DOCUMENT_POSITION_FOLLOWING), label: pos.querySelector(':scope > .prop-section-title')?.textContent.trim(), coinTitle: coin.querySelector(':scope > .prop-section-title')?.className,
      posTitle: pos.querySelector(':scope > .prop-section-title')?.className,
      x: sig(document.getElementById('stk-coin-x')), y: sig(document.getElementById('stk-coin-y')),
      vals: [document.getElementById('stk-coin-x').value, document.getElementById('stk-coin-y').value],
      h: [...pos.querySelectorAll('.prop-icon-input')].map((e) => Math.round(e.getBoundingClientRect().height)),
      w: [...pos.querySelectorAll('.prop-icon-input')].map((e) => Math.round(e.getBoundingClientRect().width)) };
  });
  expect([p.before, p.label], 'Position 절이 Coin 절 위에 있다').toEqual([true, 'Position']);
  expect(p.posTitle, 'Position 절의 제목이 바로 아래 Coin 절의 제목과 같은 꼴이다').toBe(p.coinTitle);
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

test('C2-b ★10% 남기기 — 한참 밖의 값을 넣어도 코인 그림 «면적»의 10% 는 섹션 안 · 네 변 ＋ 네 모서리 · 구성 넷', async ({ page }) => {
  test.setTimeout(180000);
  await bootApp(page);
  await setup(page);
  /* 독립 평가가 0% 를 잰 꼴들 — 정면이 아닌 기울기·방향, 상자 회전, 비정사각 상자 */
  const CONFIGS = [
    { name: '기울기 60', o: { coinTilt: 60, coinDir: 0 } },
    { name: '기울기 80 · 방향 37', o: { coinTilt: 80, coinDir: 37, sizeW: 200, sizeH: 200 } },
    { name: '기울기 60 · 상자 회전 90', o: { coinTilt: 60, coinDir: 0, rotation: 90, sizeW: 160, sizeH: 160 } },
    { name: '기울기 30 · 방향 -120 · 회전 45 · 240×120', o: { coinTilt: 30, coinDir: -120, rotation: 45, sizeW: 240, sizeH: 120 } },
  ];
  const FAR = 99999;
  const MOVES = [['왼쪽', -FAR, null], ['오른쪽', FAR, null], ['위', null, -FAR], ['아래', null, FAR],
    ['왼쪽 위', -FAR, -FAR], ['오른쪽 위', FAR, -FAR], ['왼쪽 아래', -FAR, FAR], ['오른쪽 아래', FAR, FAR]];
  const seen = [];
  for (const cfg of CONFIGS) {
    const id = await make(page, { x: 300, y: 150, ...cfg.o });
    await page.evaluate((id) => window._selectSticker(document.getElementById(id)), id);   // 고르기 자체는 C2-a 가 마우스로 잰다 — 여기는 칸이 주제다
    await page.waitForSelector(`#stk-coin-x[data-block-id="${id}"]`);
    const base = await inkArea(page, id);
    expect([base.frac, base.all > 1500], `★전제(${cfg.name}): 처음엔 그림이 통째로 섹션 안이고, 그림 화소를 셌다(${base.all})`).toEqual([1, true]);
    for (const [where, vx, vy] of MOVES) {
      await typeInto(page, '#stk-coin-x', 300); await typeInto(page, '#stk-coin-y', 150);          // 안으로 되돌려 놓고
      await expect.poll(async () => { const d = await ds(page, id); return [d.x, d.y]; }).toEqual(['300', '150']);
      if (vx != null) { await typeInto(page, '#stk-coin-x', vx); await expect.poll(async () => (await ds(page, id)).x !== '300', `${cfg.name} ${where}: X 가 안 먹었다`).toBe(true); }
      if (vy != null) { await typeInto(page, '#stk-coin-y', vy); await expect.poll(async () => (await ds(page, id)).y !== '150', `${cfg.name} ${where}: Y 가 안 먹었다`).toBe(true); }
      const got = await inkArea(page, id), d = await ds(page, id);
      seen.push(`${cfg.name} · ${where}: (${d.x},${d.y}) ${(got.frac * 100).toFixed(1)}%`);
      /* 10% 이상(화소 자의 오차 1%p) · 그리고 10% 근처다(좌표가 정수라 안쪽으로 1px 더 — 작은 그림에서 몇 %p) — 훨씬 많이 남기면 「밖으로 나갈 수 있다」가 깨진다 */
      expect(got.frac >= 0.09 && got.frac <= 0.17, `${cfg.name} · ${where} → (${d.x},${d.y}) · 섹션 안에 남은 그림 면적 ${(got.frac * 100).toFixed(2)}% (10% 여야 한다)`).toBe(true);
      expect([await page.inputValue('#stk-coin-x'), await page.inputValue('#stk-coin-y')], '가둔 값이 칸에 되적힌다').toEqual([d.x, d.y]);
      expect(await page.evaluate((id) => { const b = document.getElementById(id); return [b.style.left, b.style.top]; }, id)).toEqual([d.x + 'px', d.y + 'px']);
      expect(Math.abs(+d.x) < 5000 && Math.abs(+d.y) < 5000, '넣은 값이 그대로 저장되지 않았다').toBe(true);
    }
    await page.evaluate((id) => document.getElementById(id).remove(), id);
  }
  test.info().annotations.push({ type: 'measured', description: seen.join(' | ') });
  console.log('[C2-b] ' + seen.join('\n[C2-b] '));
  expect(seen.length, '구성 4 × 방향 8 = 32 자리를 쟀다').toBe(32);
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
  const got = await inkArea(page, id);
  expect(got.frac >= 0.09 && got.frac <= 0.17, `⌘ 끌기 뒤 섹션 안에 남은 그림 면적 ${(got.frac * 100).toFixed(2)}% (10% 여야 한다)`).toBe(true);
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
  expect((await inkArea(page, id)).frac, '★전제: 정면 코인이 왼쪽 끝에서 10% 남아 있다').toBeGreaterThanOrEqual(0.09);
  /* 두께 22 → 40 — 상자 안에서 그림이 작아진다(viewBox 가 넓어진다) ⇒ 그림의 오른쪽 끝이 안쪽으로 들어와 같은 x 로는 10% 가 안 남는다 */
  await typeInto(page, '#stk-coin-k-num', 40);
  await expect.poll(async () => (await ds(page, id)).coinK).toBe('40');
  const d = await ds(page, id);
  expect(+d.x > x0 + 5, `두께를 바꿨는데 자리가 그대로다(x ${x0} → ${d.x}) — 그림이 10% 아래로 남는다`).toBe(true);
  const after = await inkArea(page, id);
  expect(after.frac >= 0.09 && after.frac <= 0.17, `두께를 바꾼 뒤 섹션 안에 남은 그림 면적 ${(after.frac * 100).toFixed(2)}%`).toBe(true);
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
  const got = await inkArea(page, id);
  expect(got.frac >= 0.09, `줄인 뒤 섹션 안에 남은 그림 면적 ${(got.frac * 100).toFixed(2)}% — 10% 아래다(x ${x0} → ${d.x})`).toBe(true);
  expect(await page.evaluate((id) => document.getElementById(id).style.left, id)).toBe(d.x + 'px');
});

test('C2-g ★회전한 코인의 잘림이 섹션 경계와 맞는다 — clip-path 의 네 점을 화면으로 옮기면 섹션의 네 귀다', async ({ page }) => {
  await bootApp(page);
  await setup(page);
  for (const [rot, axis, v] of [[180, 'y', -99999], [90, 'x', -99999], [45, 'x', 99999], [-30, 'y', 99999]]) {
    const id = await make(page, { rotation: rot, sizeW: 160, sizeH: 160, x: 300, y: 150 });
    await page.evaluate((id) => window._selectSticker(document.getElementById(id)), id);
    await page.waitForSelector(`#stk-coin-x[data-block-id="${id}"]`);
    await typeInto(page, '#stk-coin-' + axis, v);
    await expect.poll(async () => (await ds(page, id))[axis] !== (axis === 'x' ? '300' : '150')).toBe(true);
    await page.evaluate(() => window.deselectAll?.());
    await expect.poll(() => page.evaluate((id) => !document.getElementById(id).classList.contains('selected'), id), '★전제: 고르기가 풀렸다').toBe(true);
    const r = await page.evaluate((id) => {
      const b = document.getElementById(id), sec = b.closest('.section-block');
      const clip = getComputedStyle(b).clipPath;
      const nums = (clip.match(/polygon\((.*)\)/)?.[1] || '').split(',').map((p) => p.trim().split(/\s+/).map(parseFloat));
      const W = b.offsetWidth, H = b.offsetHeight, th = (parseFloat(b.dataset.rotation) || 0) * Math.PI / 180, c = Math.cos(th), s = Math.sin(th);
      /* 요소의 회전 전 좌표 → 섹션 좌표(중심 둘레로 회전) */
      const toSec = ([lx, ly]) => { const dx = lx - W / 2, dy = ly - H / 2; return [b.offsetLeft + W / 2 + dx * c - dy * s, b.offsetTop + H / 2 + dx * s + dy * c].map((n) => Math.round(n)); };
      return { clip, pts: nums.length === 4 ? nums.map(toSec) : null, sec: [[0, 0], [sec.clientWidth, 0], [sec.clientWidth, sec.clientHeight], [0, sec.clientHeight]] };
    }, id);
    expect(r.clip.startsWith('polygon('), `회전 ${rot}°: 잘림이 polygon 이 아니다 — ${r.clip}`).toBe(true);
    const off = r.pts.map((p, i) => Math.max(Math.abs(p[0] - r.sec[i][0]), Math.abs(p[1] - r.sec[i][1])));
    expect(Math.max(...off), `회전 ${rot}°: 잘리는 꼴을 화면으로 옮긴 네 점 ${JSON.stringify(r.pts)} 이 섹션의 네 귀 ${JSON.stringify(r.sec)} 와 다르다`).toBeLessThanOrEqual(1);
    await page.evaluate((id) => document.getElementById(id).remove(), id);
  }
  /* 회전 0 은 예전 그대로 inset · 섹션 안에 통째로 있는 회전 코인은 잘림 값이 없다 */
  const inId = await make(page, { rotation: 30, x: 300, y: 150 });
  await expect.poll(() => page.evaluate((id) => getComputedStyle(document.getElementById(id)).clipPath, inId)).toBe('none');
});

test('C2-h 옛 저장본의 «처음부터 밖에 있던» 코인은 생김새를 바꿔도 안 튄다 · 지키던 코인도 광택·번짐에는 안 움직인다', async ({ page }) => {
  await bootApp(page);
  await setup(page);
  /* ① 통째로 밖(예전 ⌘ 자유 이동에는 한도가 없었다) */
  const old = await make(page, { x: -500, y: 80 });
  await page.evaluate((id) => window._selectSticker(document.getElementById(id)), old);
  await page.waitForSelector(`#stk-coin-x[data-block-id="${old}"]`);
  expect((await inkArea(page, old)).frac, '★전제: 그 코인은 통째로 섹션 밖이다').toBe(0);
  await typeInto(page, '#stk-coin-gloss-num', 50);
  await expect.poll(async () => (await ds(page, old)).coinGloss).toBe('50');
  await typeInto(page, '#stk-coin-k-num', 40);
  await expect.poll(async () => (await ds(page, old)).coinK).toBe('40');
  expect([(await ds(page, old)).x, (await ds(page, old)).y], '밖에 있던 코인이 광택·두께를 바꿨다고 끌려왔다').toEqual(['-500', '80']);
  /* 자리를 직접 고치면 그때부터는 가둔다 */
  await typeInto(page, '#stk-coin-x', -400);
  await expect.poll(async () => +(await ds(page, old)).x > -400, 'X 를 직접 넣었는데 안 가둬졌다').toBe(true);
  expect((await inkArea(page, old)).frac).toBeGreaterThanOrEqual(0.09);
  /* ② 10% 를 지키고 있는 코인 — 그림 크기를 안 바꾸는 조작(광택·번짐·재질)에는 자리가 그대로다 */
  const x1 = (await ds(page, old)).x;
  await typeInto(page, '#stk-coin-gloss-num', 80);
  await expect.poll(async () => (await ds(page, old)).coinGloss).toBe('80');
  await typeInto(page, '#stk-coin-blur-num', 5);
  await expect.poll(async () => (await ds(page, old)).coinBlur).toBe('5');
  await page.click('#stk-coin-metal [data-coin-metal="silver"]');
  await expect.poll(async () => (await ds(page, old)).coinMetal).toBe('silver');
  expect((await ds(page, old)).x, '광택·번짐·재질을 바꿨는데 자리가 움직였다').toBe(x1);
});
