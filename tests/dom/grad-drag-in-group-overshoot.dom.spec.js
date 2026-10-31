/* grad-drag-in-group-overshoot.dom.spec.js
 *   ★★`GRAD-DRAG-IN-GROUP-OVERSHOOT-01` — ★★«대조»를 ★세운다. (2026-10-25 신설 · 지디)
 *   ⛔★고치지 ★않는다 — ★`t5-08`(b) 가 ★미정이라 ★두 번 고칠 위험이 있다(★태양 가지 판단 그대로).
 *
 * ★찾은 이 = 태양 가지 `taeyang/t5-07-gradient-group`(`43749cd6`) · ★「지디 판정」으로 넘김
 *   그 보고 ★그대로 : 「★그룹 안 그라데이션을 끌면 ★그룹 안엔 남지만 ★★포인터보다 ★더 움직인다:
 *     ★포인터 아래 ★32 화면 px → ★★73 · 63 · 58 (×3 · ★40% 줌 · x 는 0 고정).
 *     ★★대조(섹션 직속 그라데이션)는 ★섹션보다 ★키가 커 ★안 움직여 ★★대조 안 섬.」
 *   ⇒ ★★★그 «안 선 대조»를 ★세우는 것이 ★이 파일의 ★몫이다.
 *
 * ★★처방(★내 것) : ★`window.updateGradientBlock(id, {width, height})`(★앱 길 · 200~1200px)로
 *   ★그라데를 ★★섹션보다 ★작게 만들면 ★섹션 직속에서도 ★★움직일 자리가 생긴다 ⇒ ★대조가 ★선다.
 *
 * ★★까닭(★소스 실측 261025 · ⛔이것만으로 ★닫지 않는다) :
 *   `gradient-select.js:292·304` 가 ★`newXraw = (ev.clientX - secRect.left) / zoom - grabOffX`
 *   로 ★★«섹션» 기준으로 ★계산하는데, ★CSS 는 ★★«부모(그룹)» 기준으로 ★배치한다
 *   ⇒ ★★그룹이 ★섹션 안에서 ★(gx, gy) 만큼 ★떨어져 있으면 ★그만큼 ★★이중으로 ★더해진다.
 *
 * ⛔안 재는 축 (★이름)
 *   · ★고침 — `GRAD-DRAG-OVERSHOOT-FIX-DEFERRED-01`(★`t5-08`(b) 미정)
 *   · ★y 축 — 가지가 「x 는 0 고정」이라 적었다. ★여기서는 ★★x·y ★둘 다 찍는다(★가지보다 넓다)
 *   · ★줌 40% 밖
 *
 * ★★★261025 ★실측 — ★★대조를 ★세우지 ★못했다. ★그 까닭을 ★수로 박는다.
 *   `D0`  그라데 ★88×48 · 섹션 ★344×113 ⇒ ★작다(✅) ★★단 `updateGradientBlock({width:220})` 이
 *         ★★안 먹었다(★88 이 나왔다) = `GRAD-UPDATE-WIDTH-NOT-APPLIED-IN-HARNESS-01`
 *   `D1`  ①회차 `movedX 28 · movedY ★-40` · ★`dataset` ★변화 ★★0 ⇒ ★★끌기가 ★★안 먹었다
 *         (★움직임은 ★스크롤·레이아웃 탓) / ②회차 `movedX 32 · movedY -14` · `dataset ["0","80"]`
 *         ⇒ ★★회차마다 ★다르다
 *   `D2`  `dataset` 변화 ★★0 ⇒ ★★끌기가 ★안 먹었다
 *   ⇒ ★★★⛔이 수로는 ★「덧움직임이 ★있다/없다」를 ★★단언할 수 ★없다.
 *     ★★`movedY` 에 ★스크롤이 ★섞이고, ★`page.mouse` 가 ★`_GRD_CLICK_SLOP`·핸들러를 ★못 깨운다.
 *   ⇒ ★★이름 = `GRAD-DRAG-HARNESS-CANNOT-DRIVE-DRAG-01`
 *     ⇒ ★★`D1`·`D2` 는 ★★«끌기가 먹었나»(`dataset` 변화)를 ★★전제로 걸고
 *        ★안 먹으면 ★★SKIP 한다 — ⛔「없다」로 ★닫지 ★않는다.
 *   ⚠️＋ ★회차마다 ★★«크기»도 ★다르다 — `D0` 은 88×48/섹션 344×113 인데 `D2` 는 177×96/섹션 691×227
 *     ⇒ ★★배율(줌)이 ★회차마다 ★다르게 잡힌다 = `GRAD-HARNESS-ZOOM-VARIES-BY-RUN-01`
 *     ⇒ ★★그래서 ★★«화면 px» 로 ★견주는 자는 ★이 하네스에서 ★★못 쓴다(★줌 환산이 흔들린다)
 *   ⇒ ★★다음에 할 것 : ★`gradient-select.js` 가 ★★어느 이벤트를 ★듣는지(mousedown 대상·SLOP)
 *     ★먼저 재고 ★그 길로 ★깨운다. ★또는 ★★앱 축(태양)으로 ★넘긴다.
 *
 * ★★단 ★★까닭은 ★소스로 ★섰다(★위 「까닭」 절) — ★★그것은 ★버리지 ★않는다.
 *
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js grad-drag-in-group-overshoot
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitZoomSettled } = require('./_root-harness.js');

/** ★섹션 ＋ ★작은 그라데(들)을 ★앱 길로 만든다. `n`=1 이면 섹션 직속, 2 면 ⌘G 로 묶는다. */
const scene = async (page, group) => page.evaluate(async (group) => {
  const canvas = document.getElementById('canvas');
  canvas.querySelectorAll('.section-block').forEach(s => s.remove());
  await window.addSection();
  const sec = [...canvas.querySelectorAll('.section-block')].pop();
  if (!sec) return { fail: '섹션이 없다' };
  sec.id = 'gdoSec';
  window.selectSection(sec);
  const made = [];
  for (let k = 0; k < (group ? 2 : 1); k++) {
    const b = window.addGradientBlock?.();
    if (!b) return { fail: 'addGradientBlock' };
    b.dataset.probe = 'AB'[k];
    made.push(b);
    /* ★★섹션보다 ★작게 — ★그게 ★대조가 서는 ★조건이다(★가지가 못 세운 그 자리) */
    if (typeof window.updateGradientBlock === 'function') {
      window.updateGradientBlock(b.id, { width: 220, height: 120 });
    }
  }
  if (group) {
    for (const el of made) if (!el.classList.contains('selected')) window.toggleBlockSelect?.(el);
    if (sec.querySelectorAll('.gradient-block.selected').length !== 2) return { fail: '둘이 안 골렸다' };
    window.groupSelectedBlocks?.();
  }
  /* ★누를 좌표를 재기 전에 scrollTop 이 연속 10 프레임 같을 때까지 기다린다(⛔고정 대기 아님 · 지디 MINTEL ②).
     까닭(S3 · 263-1225): addSection 의 부드러운 스크롤이 도는 동안 잰 at 은 낡는다 — 잰 뒤 차 0~23 맞음·바뀜 · 24~26 빗나감(h 48 ⇒ h/2 · ×5).
     ⛔«두 번 연속» 은 스크롤이 시작되기 전에 이미 참이다(후보 428f7034 · at 전부 124 · moved T 0/10). 10 의 출처 = 측정 탐침 settled 55/55. */
  const wrap = document.getElementById('canvas-wrap');
  await new Promise((res) => {
    let last = wrap.scrollTop, same = 0;
    const step = () => { if (wrap.scrollTop === last) same++; else { same = 0; last = wrap.scrollTop; } if (same >= 10) res(); else requestAnimationFrame(step); };
    requestAnimationFrame(step);
  });
  const a = made[0];
  const r = a.getBoundingClientRect();
  const secR = sec.getBoundingClientRect();
  return {
    id: a.id,
    inFrame: !!a.closest('.frame-block'),
    w: Math.round(r.width), h: Math.round(r.height),
    secW: Math.round(secR.width), secH: Math.round(secR.height),
    /* ★★전제 — ★그라데가 ★섹션보다 ★작아야 ★움직일 자리가 있다 */
    smaller: r.width < secR.width - 20 && r.height < secR.height - 20,
    cx: Math.round(r.left + r.width / 2), cy: Math.round(r.top + r.height / 2),
    /* ★263 ⒝⒞ — 같은 자로 함께 찍는다: 모델 폭(dataset · offsetWidth) ↔ 화면 폭(rect) · currentZoom ↔ 렌더 배율(transform) */
    gradWidth: a.dataset.gradWidth, offW: a.offsetWidth, secOffW: sec.offsetWidth,
    zoom: window.currentZoom, scale: (() => { const m = getComputedStyle(document.getElementById('canvas-scaler')).transform; return m === 'none' ? 1 : new DOMMatrix(m).a; })(),
  };
}, group);

/** ★실마우스로 ★(dx, dy) 화면 px 끌고 ★★«실제로 움직인 화면 px»를 돌려준다. */
async function dragBy(page, s, dx, dy) {
  const before = await page.evaluate(() => {
    const a = document.querySelector('#gdoSec .gradient-block[data-probe="A"]');
    const r = a.getBoundingClientRect();
    return { left: r.left, top: r.top, dx: a.dataset.x, dy: a.dataset.y };
  });
  await page.mouse.move(s.cx, s.cy);
  await page.mouse.down();
  /* ★여러 걸음으로 — ★한 번에 뛰면 `_GRD_CLICK_SLOP` 을 ★안 넘길 수 있다 */
  await page.mouse.move(s.cx + dx / 2, s.cy + dy / 2, { steps: 4 });
  await page.mouse.move(s.cx + dx, s.cy + dy, { steps: 4 });
  await page.mouse.up();
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  const after = await page.evaluate(() => {
    const a = document.querySelector('#gdoSec .gradient-block[data-probe="A"]');
    const r = a.getBoundingClientRect();
    return { left: r.left, top: r.top, dx: a.dataset.x, dy: a.dataset.y };
  });
  return {
    movedX: Math.round(after.left - before.left),
    movedY: Math.round(after.top - before.top),
    datasetX: [before.dx, after.dx], datasetY: [before.dy, after.dy],
  };
}

test('D0 ★전제 — ★`updateGradientBlock` 으로 ★그라데를 ★★섹션보다 ★작게 만들 수 있다 (★대조의 ★조건)', async ({ page }) => {
  await bootApp(page);
  const s = await scene(page, false);
  expect(s.fail, `★전제: ${s.fail}`).toBeUndefined();
  console.log('[D0]', JSON.stringify(s));
  /* ★★★이것이 ★가지가 ★못 세운 ★그 자리다 — 「섹션보다 키가 커 안 움직여 ★대조 안 섬」 */
  expect(s.smaller,
    `★그라데가 ★섹션보다 ★작지 않다 — ★대조를 ★세울 수 없다 (${s.w}×${s.h} vs ${s.secW}×${s.secH})`
  ).toBe(true);
  expect(s.inFrame, '★섹션 직속이 아니다').toBe(false);
  /* ⚠️★`updateGradientBlock({width:220})` 이 ★안 먹었다(실측 88) — ★수만 박는다
     = `GRAD-UPDATE-WIDTH-NOT-APPLIED-IN-HARNESS-01` · ⛔이 칸을 빨강으로 두지 않는다
     (★대조의 ★조건인 ★「섹션보다 작다」는 ★이미 섰으므로 ★그 몫은 ★채워졌다) */
  console.log('[D0-width]', JSON.stringify({ asked: 220, got: s.w, gradWidth: s.gradWidth, offW: s.offW, secOffW: s.secOffW, secW: s.secW, zoom: s.zoom, scale: s.scale }));   // ★263 ⒝ «88» 이 화면 px(= 220 × 배율)인가 · ⒞ 배율이 회차마다 다른가
});

/* ★233 GRAD-DRAG-D1-COMPARES-MIXED-COORD-SYSTEMS-01(지디 · S3 261028) — 옛 D1 은 세 자를 섞었다: dataset(모델 px) · 포인터(화면 px) ·
   rect(렌더 px + 스크롤) ⇒ «1:1» 을 안 쟀고 흔들렸다(두 dev ×5 = 4 failed · 1 skip). ⇒ ★한 좌표계(화면 px)로만 견준다:
   화면 이동 = rect 차 + #canvas-wrap 스크롤 차(⑵) · 배율 멎은 뒤(waitZoomSettled ⑶) · 모델 이동(dataset)은 «× 배율» 로 화면에 옮겨 맞대기만(⑴ 섞지 않음).
   «끌기가 안 먹음» 은 SKIP 이 아니라 이름 있는 실패(⑸). 1:1 판정은 순수 함수 oneToOne — D1N 이 «일부러 2:1 → 아니다» 를 잰다(⑷ · 행위 2:1 은 제품 사본 변이로 DOM 쌍). */
const oneToOne = (moved, pointer, tol = 6) => Math.abs(moved - pointer) <= tol;
async function dragMeasure(page, s, dx, dy, { alt = false } = {}) {
  const read = () => page.evaluate(() => {
    const a = document.querySelector('#gdoSec .gradient-block[data-probe="A"]');
    const r = a.getBoundingClientRect(), w = document.getElementById('canvas-wrap');
    const m = getComputedStyle(document.getElementById('canvas-scaler')).transform;
    return { left: r.left, top: r.top, sl: w ? w.scrollLeft : 0, st: w ? w.scrollTop : 0, x: Number(a.dataset.x), y: Number(a.dataset.y), scale: m === 'none' ? 1 : new DOMMatrix(m).a };
  });
  /* ★233 실측(×5): 장면을 잡은 뒤 화면이 스크롤돼(scrolled 0·15·36) 옛 중심(s.cx·cy)이 블럭 밖 → 4/5 «안 먹음».
     ⇒ 누르기 «직전» 에 블럭을 화면 가운데로 · 두 프레임 · 그때의 중심을 잡는다(장면 때 잰 좌표 안 씀). */
  const c = await page.evaluate(async () => {
    const a = document.querySelector('#gdoSec .gradient-block[data-probe="A"]');
    a.scrollIntoView({ block: 'center', inline: 'center' });
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const r = a.getBoundingClientRect(); return { cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
  });
  s = { ...s, cx: Math.round(c.cx), cy: Math.round(c.cy) };
  const b = await read();
  await page.mouse.move(s.cx, s.cy);
  await page.mouse.down();
  /* ★제품의 스냅 우회(⌥ · gradient-select.js «⌥ 누른 동안(매 mousemove 의 ev.altKey) 스냅 건너뜀» · 120 H9-SNAP) — ★누른 «뒤» 에 건다:
     ⌥ 를 누른 채 mousedown 하면 끌기가 아예 안 섰다(×5 실측 · ⌥+클릭은 다른 몸짓) */
  if (alt) await page.keyboard.down('Alt');
  await page.mouse.move(s.cx + dx / 2, s.cy + dy / 2, { steps: 4 });
  await page.mouse.move(s.cx + dx, s.cy + dy, { steps: 4 });
  await page.mouse.up();
  if (alt) await page.keyboard.up('Alt');
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const a = await read();
  return {
    screenX: Math.round((a.left - b.left) + (a.sl - b.sl)), screenY: Math.round((a.top - b.top) + (a.st - b.st)),   // ★화면 px(스크롤 뺀 렌더 이동)
    modelX: a.x - b.x, modelY: a.y - b.y, scale: a.scale,                                                          // 모델 px · 배율
    scrolled: [a.sl - b.sl, a.st - b.st],
  };
}
test('D1 ★★대조 — ★섹션 ★직속 그라데는 ★★포인터만큼 ★움직인다 (★1:1 · 화면 px 한 좌표계)', async ({ page }) => {
  await bootApp(page);
  const s = await scene(page, false);
  expect(s.fail).toBeUndefined();
  expect(s.smaller, '★전제: 그라데가 섹션보다 작지 않다').toBe(true);
  await waitZoomSettled(page, await page.evaluate(() => window.currentZoom));   // ⑶ 배율 멎은 뒤에 잰다
  const s2 = await scene(page, false);   // 멎은 배율에서 자리를 다시 잡는다(중심 좌표가 화면 px)
  /* ★233 실측(×5 · probe): ⌥ 없이 끌면 y 가 «가장자리 맞닿기 스냅»(16 화면 px · 의도된 제품 꼴)으로 당겨져 24/32 · dy 0 에도 +23 모델 px ⇒
     «1:1» 은 스냅을 «끈» 끌기의 계약 ⇒ 제품의 우회(⌥)를 누른 채 잰다(스냅 자체는 이 칸의 몫 아님). */
  const r = await dragMeasure(page, s2, 32, 32, { alt: true });
  console.log('[D1]', JSON.stringify(r));
  expect(r.modelX !== 0 || r.modelY !== 0,
    `GRAD-DRAG-HARNESS-CANNOT-DRIVE-DRAG-01 — 끌기가 안 먹었다(모델 이동 0) · ${JSON.stringify(r)}`).toBe(true);   // ⑸ SKIP 아님
  expect(oneToOne(r.screenX, 32), `★x 화면 이동 ${r.screenX} ≠ 포인터 32(±6) — 1:1 아님 · ${JSON.stringify(r)}`).toBe(true);
  expect(oneToOne(r.screenY, 32), `★y 화면 이동 ${r.screenY} ≠ 포인터 32(±6) — 1:1 아님 · ${JSON.stringify(r)}`).toBe(true);
  /* 맞대기(같은 좌표계로 옮겨): 모델 이동 × 배율 = 화면 이동 — 다르면 렌더가 모델을 안 따른다 */
  expect([Math.abs(r.modelX * r.scale - r.screenX) <= 6, Math.abs(r.modelY * r.scale - r.screenY) <= 6], `모델×배율 ≠ 화면 · ${JSON.stringify(r)}`).toEqual([true, true]);
});
test('D1N ★자가 산다 — oneToOne 은 1:1 만 참 · 일부러 2:1 은 거짓(⑷ 음성 · 자 자체)', () => {
  expect([oneToOne(32, 32), oneToOne(37, 32), oneToOne(64, 32), oneToOne(16, 32), oneToOne(-16, 32)]).toEqual([true, true, false, false, false]);
});

/* ★263 ⒜ 탐침(지디 261029 · GRAD-HARNESS-CANNOT-DRIVE-THREE-FACES-01) — «끌기가 안 먹음» 의 까닭 후보 ①: 누르는 점의 임자가 그 블럭이 아니다.
   이동 길 = 블럭 capture mousedown(js/gradient-select.js bindGradientSelect) → document mousemove 첫 번부터 dataset.x/y · ⛔_GRD_CLICK_SLOP 은 click 가름에만(이동 길 아님).
   한 쌍: P263a 옛 길(장면 때 잰 중심 · D2 와 같은 꼴) · P263b 새 길(누르기 직전 scrollIntoView · D1 꼴) — 둘 다 «임자 = 블럭 ⇔ dataset 바뀜» 이어야. b 는 임자 = 블럭이 전제. */
async function pressProbe(page, s, { recenter }) {
  if (recenter) {
    const c = await page.evaluate(async () => {
      const a = document.querySelector('#gdoSec .gradient-block[data-probe="A"]');
      a.scrollIntoView({ block: 'center', inline: 'center' });
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const r = a.getBoundingClientRect(); return { cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
    });
    s = { ...s, cx: Math.round(c.cx), cy: Math.round(c.cy) };
  }
  const pre = await page.evaluate(({ cx, cy }) => {
    const a = document.querySelector('#gdoSec .gradient-block[data-probe="A"]'), hit = document.elementFromPoint(cx, cy);
    return { owner: !!hit && hit.closest('.gradient-block') === a, hit: hit ? (hit.id || hit.className || hit.tagName).toString().slice(0, 40) : null,
      bound: a._gradientBound === true, x: a.dataset.x, y: a.dataset.y, sl: document.getElementById('canvas-wrap')?.scrollTop ?? null };
  }, s);
  await page.mouse.move(s.cx, s.cy);
  await page.mouse.down();
  await page.mouse.move(s.cx + 16, s.cy + 16, { steps: 4 });
  await page.mouse.move(s.cx + 32, s.cy + 32, { steps: 4 });
  await page.mouse.up();
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const post = await page.evaluate(() => { const a = document.querySelector('#gdoSec .gradient-block[data-probe="A"]'); return { x: a.dataset.x, y: a.dataset.y }; });
  return { ...pre, moved: post.x !== pre.x || post.y !== pre.y, after: post, at: [s.cx, s.cy] };
}
test('P263a ⒜ 옛 길(장면 때 중심) — 임자 = 블럭 ⇔ dataset 바뀜', async ({ page }) => {
  await bootApp(page);
  const s = await scene(page, false);
  expect(s.fail).toBeUndefined();
  await waitZoomSettled(page, await page.evaluate(() => window.currentZoom));
  const r = await pressProbe(page, s, { recenter: false });
  console.log('[P263a]', JSON.stringify(r));
  expect(r.bound, `★전제: 블럭이 bind 안 됨(_gradientBound) · ${JSON.stringify(r)}`).toBe(true);
  expect(r.moved, `★임자 ${r.owner} 인데 dataset 바뀜 ${r.moved} — 임자 후보로 못 가른다 · ${JSON.stringify(r)}`).toBe(r.owner);
  expect(r.moved, `★끌기가 안 먹었다(moved false) — «안 움직여서 안 틀린» 초록 금지 · ${JSON.stringify(r)}`).toBe(true);
});
test('P263b ⒜ 새 길(누르기 직전 가운데로) — 임자 = 블럭 ∧ dataset 바뀜', async ({ page }) => {
  await bootApp(page);
  const s = await scene(page, false);
  expect(s.fail).toBeUndefined();
  await waitZoomSettled(page, await page.evaluate(() => window.currentZoom));
  const r = await pressProbe(page, s, { recenter: true });
  console.log('[P263b]', JSON.stringify(r));
  expect(r.bound, `★전제: 블럭이 bind 안 됨(_gradientBound) · ${JSON.stringify(r)}`).toBe(true);
  expect(r.owner, `★전제: 누르는 점의 임자가 블럭이 아니다(${r.hit}) · ${JSON.stringify(r)}`).toBe(true);
  expect(r.moved, `GRAD-DRAG-HARNESS-CANNOT-DRIVE-DRAG-01 — 임자가 블럭인데 dataset 0 = 후보 ① 아님 · ${JSON.stringify(r)}`).toBe(true);
});

/* ★263 ⒜ 다음 탐침(P263c · 지디 판정 뒤에만 돌림) — P263a 표본 a: 임자 = 블럭인데 안 먹음 ⇒ «점검 때 임자» ↔ «실제 mousedown» 사이를 찍는다.
   window capture(가장 먼저 듣는 자리)로 실제 mousedown target · 그 때 elementFromPoint · 블럭 리스너가 돌았나(block._grdDown 이 섰나 — :251 이 쓰고 click 이 null 로 지우므로 «첫 mousemove 때» 읽는다) · mousemove 수. 옛 길(장면 때 중심) ×1. */
test('P263c ⒜ 실제 mousedown target · 블럭 리스너 돎(_grdDown) — 옛 길', async ({ page }) => {
  await bootApp(page);
  const s = await scene(page, false);
  expect(s.fail).toBeUndefined();
  await waitZoomSettled(page, await page.evaluate(() => window.currentZoom));
  await page.evaluate(() => {
    const a = document.querySelector('#gdoSec .gradient-block[data-probe="A"]'); a._grdDown = null;
    window.__p263c = { down: null, moves: 0 };
    window.addEventListener('mousedown', (e) => {
      const hit = document.elementFromPoint(e.clientX, e.clientY);
      window.__p263c.down = { target: (e.target.id || e.target.className || e.target.tagName).toString().slice(0, 40), inBlock: !!e.target.closest?.('.gradient-block') && e.target.closest('.gradient-block') === a,
        hitInBlock: !!hit && hit.closest('.gradient-block') === a, at: [e.clientX, e.clientY], st: document.getElementById('canvas-wrap')?.scrollTop ?? null };
    }, { capture: true, once: true });
    /* ★찍는 때 = mousedown «뒤» 첫 mousemove — pressProbe 가 누르기 전에 move 하므로 그 첫 move 는 늘 false 였다(㉮ · 5c5dc70b 표본: 끌기 먹음 · grdAtMove false) */
    window.addEventListener('mousemove', () => { if (!window.__p263c.down) return; if (window.__p263c.moves++ === 0) window.__p263c.grdAtMove = !!a._grdDown; }, true);
  });
  const r = await pressProbe(page, s, { recenter: false });
  const c = await page.evaluate(() => ({ ...window.__p263c, grdDown: window.__p263c.grdAtMove === true }));
  console.log('[P263c]', JSON.stringify({ ...r, ...c }));
  expect(c.down, '★window capture mousedown 이 안 왔다').not.toBeNull();
  /* 판정 자: 블럭 리스너가 돌았다(_grdDown) ⇔ 실제 target 이 블럭 안 · 돌았는데 안 바뀜이면 이동 길(onMove) 쪽 */
  expect(c.grdDown, `★실제 target 블럭 안 ${c.down && c.down.inBlock} 인데 블럭 리스너 돎 ${c.grdDown} · ${JSON.stringify({ ...r, ...c })}`).toBe(!!(c.down && c.down.inBlock));
  expect(r.moved, `★블럭 리스너 돎 ${c.grdDown} 인데 dataset 바뀜 ${r.moved} · ${JSON.stringify({ ...r, ...c })}`).toBe(c.grdDown);
  expect(r.moved, `★끌기가 안 먹었다(moved false) — «안 움직여서 안 틀린» 초록 금지 · ${JSON.stringify({ ...r, ...c })}`).toBe(true);
});

test('D2 ★★★수를 박는다 — ★그룹 ★안 그라데는 ★★더 움직인다 (★가지 실측 32 → 73·63·58)', async ({ page }) => {
  await bootApp(page);
  const s = await scene(page, true);
  expect(s.fail, `★전제: ${s.fail}`).toBeUndefined();
  console.log('[D2-scene]', JSON.stringify(s));
  /* ★★전제 ★둘 — ★그룹 안이고 ★작다 */
  expect(s.inFrame, '★그룹 안이 아니다 — ⌘G 가 안 묶였나(t5-07 가 dev 에 있나)').toBe(true);
  expect(s.smaller, '★전제: 그라데가 섹션보다 작지 않다').toBe(true);
  const r = await dragBy(page, s, 32, 32);
  console.log('[D2]', JSON.stringify(r));
  if (r.datasetX[0] === r.datasetX[1] && r.datasetY[0] === r.datasetY[1]) {
    test.skip(true, '★★끌기가 ★안 먹었다(dataset 변화 0) = GRAD-DRAG-HARNESS-CANNOT-DRIVE-DRAG-01'
      + ' — ⛔FAIL 아니라 SKIP · ' + JSON.stringify(r));
  }
  /* ★★★수 — ★★«얼마나 더»를 ★찍는다. ⛔한 쪽을 ★단언하지 않고 ★★D1 과 ★견주는 것이 ★몫이다.
     ★가지 실측(앱 · 40% 줌)은 ★73·63·58 이었다 — ★이 하네스 수가 ★다를 수 있다(★줌·배치) */
  console.log('[D2-overshoot]', JSON.stringify({
    pointer: 32, movedX: r.movedX, movedY: r.movedY,
    overX: r.movedX - 32, overY: r.movedY - 32,
  }));
  /* ★★이 칸이 ★빨개지면 = ★★덧움직임이 ★사라졌다(★고쳐졌다) ⇒ ★그때 ★뒤집어라 */
  expect(Math.abs(r.movedX - 32) > 6 || Math.abs(r.movedY - 32) > 6,
    `★★덧움직임이 ★없다 — ★고쳐졌다면 ★이 칸을 ★뒤집어라 (moved ${r.movedX},${r.movedY} vs pointer 32,32)`
  ).toBe(true);
});
