/* shape-star-b1b3.dom.spec.js — ★1010t1b 의 ★«행위로만 닫히는 칸» 한 벌 (t1bstar · 지디 창 목록)
 *
 * ★★왜 한 파일인가 — ★창이 ★한 번뿐이다(지디). ⇒ ★★유닛으로 ★못 닫은 칸을 ★★여기 ★모았다.
 *   ★유닛이 이미 닫은 것은 ⛔다시 안 잰다(55칸: shape-star 11·inner-gap 5·frame-width 10·rating 11·colors 8·scales 10)
 *
 * ★★이 파일이 ★닫으려는 ★«안 쟀다» 명부 — ★앞 보고들에서 ★내가 ★열어 둔 그것들:
 *   ⒤ ★b1 — ★간격 슬라이더를 ★참으로 움직이면 ★프레임 폭이 ★늘어나나(★유닛은 ★식만 쟀다)
 *   ⒥ ★① 후속 — ★gap 200 에서 ★폭이 ★참으로 ★849 인가(★계산값과 ★화면값 대조)
 *   ⒦ ★b3 — ★평점 토글을 ★참으로 눌렀을 때 ★칠이 ★그리 되나 ＋ ★갯수가 ★참으로 ★잠기나
 *   ⒧ ★★그라데이션 ★왕복 — ★평점 켜고 ★끄면 ★그라데이션이 ★참으로 ★돌아오나(★R10 의 행위)
 *   ⒨ ★★저장 왕복 — ★개별 색·배율이 ★저장 → 불러오기 → ★다시 꺼내 쓰기까지 ★사나(지디 ㉠)
 *   ⒩ ★★⌘Z ★깊이 — ★평점 토글이 ★한 칸인가(지디 ＋지시)
 *   ⒪ ★★제스처가 ★참으로 ★비었나 — ★별 더블클릭이 ★오늘 ★아무 임자도 ★없나(★내 어림자 ★대체)
 *
 * ★★★전제 — ★이 파일은 ★`#canvas` 에 ★별 블록을 ★심고 ★우측 패널로 ★만진다. ★심은 입력으로만 잰다.
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');

const SEC = `<div class="section-block" id="sA" data-section="1" data-name="A" data-bg="#ffffff" style="background:#fff;">
  <div class="section-hitzone"><span class="section-label">A</span></div><div class="section-inner"></div></div>`;

async function setup(page) {
  await page.setViewportSize({ width: 1500, height: 900 });
  await bootApp(page);
  await page.evaluate((html) => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', html);
    window.rebindAll?.(); window.deselectAll?.();
    window.selectSection?.(document.getElementById('sA'));
    window.addShapeBlock?.('star');
  }, SEC);
  await waitBlocks(page, 1);
  await page.evaluate(() => window.showShapeProperties?.(document.querySelector('#canvas .shape-block')));
  await waitPanel(page);
}

/** 숫자칸에 값을 넣고 input＋change 를 둘 다 때린다(제품 배선이 둘을 쓴다). */
const setNum = (page, id, v) => page.evaluate(([i, val]) => {
  const n = document.getElementById(i);
  if (!n) throw new Error(i + ' 가 없다');
  n.value = String(val);
  n.dispatchEvent(new Event('input', { bubbles: true }));
  n.dispatchEvent(new Event('change', { bubbles: true }));
}, [id, v]);

/* ══ ★★★«고정 대기» → ★«조건 대기» ═══════════════════════════════════════════
 * ★★까닭(261010 머지 18): ★load 106 에서 ★이 파일의 ★E3 가 ★★빨개졌다 — ★★그런데 ★제품이 ★아니라
 *   ★★★«내 고정 대기»가 ★원인이었다(★같은 판 · ★코드 무변 · ★load 5.35 ⇒ ★80 passed · ★두 번 ★확증).
 * ★★관용구를 ★내가 ★고르지 ★않았다 — ★★레포가 ★이미 ★쓴다: ★`page.waitForFunction` ★202벌/334곳.
 * ★★좌표는 ★★하네스의 ★`waitStableRect` — ★★★그 머리말에 ★같은 병이 ★★셋 적혀 있다(★내 E3 가 ★넷째다).
 *   ⇒ ★★★즉 ★약은 ★★이미 ★레포에 ★있었고 ★★★내가 ★안 읽었다.
 * ⛔★수를 ★키우지 ★않는다(250 → 1000) — ★더 느린 판에서 ★또 ★깨진다.
 * ★★★그리고 ★이게 ★핵이다: ★조건이 ★안 서면 ★★여기서 ★★제 이름으로 ★던진다
 *   ⇒ ★★«전제 미달»과 ★★«본 단언 실패»가 ★★★구분된다 ⇒ ★★★증거 사본이 ★없어도 ★갈린다. */
const COND_MS = 15000;   /* ★조건이 ★서기까지의 ★상한 — ⛔«기다리는 시간»이 아니라 ★«포기하는 선»이다 */

const waitCount = (page, n) => page.waitForFunction((k) => {
  const b = document.querySelector('#canvas .shape-block');
  return !!b && b.dataset.starCount === String(k) && b.querySelectorAll('svg polygon').length === k;
}, n, { timeout: COND_MS }).catch(() => {
  throw new Error('★★전제 미달 — ★별 갯수가 ' + n + ' 로 ★서지 ★않았다(★dataset·polygon ★둘 다). ⛔본 단언까지 ★가지 ★못했다');
});

const waitMode = (page, { idx = 0, want = true } = {}) => page.waitForFunction(([i, w]) => {
  const b = document.querySelectorAll('#canvas .shape-block')[i];
  return !!b && b.classList.contains('star-mode') === w;
}, [idx, want], { timeout: COND_MS }).catch(() => {
  throw new Error('★★전제 미달 — ★블록 ' + idx + ' 의 ★별 모드가 ★' + (want ? '서지' : '내려가지') + ' ★않았다. ⛔본 단언까지 ★가지 ★못했다');
});

const waitGap = (page, g) => page.waitForFunction((k) => {
  const b = document.querySelector('#canvas .shape-block');
  return !!b && b.dataset.starGap === String(k);
}, g, { timeout: COND_MS }).catch(() => {
  throw new Error('★★전제 미달 — ★간격이 ' + g + ' 로 ★서지 ★않았다. ⛔본 단언까지 ★가지 ★못했다');
});

const waitRating = (page, r) => page.waitForFunction((k) => {
  const b = document.querySelector('#canvas .shape-block');
  return !!b && (k === null ? b.dataset.starRating === undefined : b.dataset.starRating === String(k));
}, r, { timeout: COND_MS }).catch(() => {
  throw new Error('★★전제 미달 — ★평점이 ' + (r === null ? '«없음»' : r) + ' 로 ★서지 ★않았다. ⛔본 단언까지 ★가지 ★못했다');
});

/** ★블록이 ★N벌 ★생겼나 — ★`addShapeBlock` 은 ★비동기로 ★칠한다 */
const waitBlocks = (page, n) => page.waitForFunction((k) => (
  document.querySelectorAll('#canvas .shape-block').length === k
), n, { timeout: COND_MS }).catch(() => {
  throw new Error('★★전제 미달 — ★별 블록이 ' + n + '벌이 ★되지 ★않았다. ⛔본 단언까지 ★가지 ★못했다');
});

/** ★★별을 ★★«멈춘 뒤»에 ★더블클릭한다 — ★좌표를 ★먼저 재고 누르면 ★그 사이 ★움직인다(하네스 머리말). */
async function dblclickStar(page, starIdx, { blockIdx = 0 } = {}) {
  /* ★블록이 ★여럿일 때 ★몇째의 ★몇번 별인가 — ★좌표는 ★하네스가 ★«멈춘 뒤»로 ★준다.
     ★★`index` 로 ★세는 까닭: ★블록마다 ★고유 선택자가 ★없다(★`graph-label-edit` 가 ★같은 까닭으로 ★제 자를 ★지었다) */
  const n = await page.evaluate(() => document.querySelectorAll('#canvas .shape-block').length);
  const per = await page.evaluate((k) => document.querySelectorAll('#canvas .shape-block')[k]
    .querySelectorAll('svg polygon').length, blockIdx);
  if (!(blockIdx < n)) throw new Error('★블록 ' + blockIdx + ' 이 ★없다(★' + n + '벌)');
  const r = await waitStableRect(page, '#canvas .shape-block svg polygon',
    { index: blockIdx * per + starIdx });
  await page.mouse.dblclick(r.cx, r.cy);
  return r;
}

/** ★★★«어느 칸이 ★없는지»를 ★찍는다 — ⛔AND 로 묶어 ★«둘 다 없다»로 ★적지 ★않는다.
 *  ★★까닭(261010 머지 19 · ★빨강 12건): ★내가 ★`waitPanel` 에 ★갯수 칸 ★AND ★간격 칸을 ★걸었다.
 *    ★★그런데 ★`prop-shape.js:246` 은 ★★`starCount > 1` 일 때만 ★간격 줄을 ★렌더하고,
 *    ★`STAR_COUNT_DEFAULT = 1` 이라 ★★갓 만든 별 블록엔 ★★간격 칸이 ★★없다.
 *  ⇒ ★★★setup 에서 ★영원히 ★안 섰고, ★★내 문구는 ★「패널이 ★안 떴다」라고 ★★거짓을 ★말했다
 *    (★지디가 ★뜬 ★스냅샷에 ★★갯수 슬라이더와 ★별점 체크박스가 ★★있었다 — ★패널은 ★떴다)
 *  ⇒ ★★★그래서 ★★«문구도 ★측정이다» — ★★없는 ★이름을 ★★그대로 ★찍는다.
 *  ★★＋ ★★원인을 ★버리지 ★않는다(`cause`) — ⛔`.catch(() => { throw new Error(…) })` 는
 *    ★타임아웃·컨텍스트 소멸·네비게이션을 ★★전부 ★내 문구로 ★★덮는다(★지디 ⒞). */
async function waitIds(page, ids, what) {
  try {
    await page.waitForFunction((list) => list.every((id) => !!document.getElementById(id)),
      ids, { timeout: COND_MS });
  } catch (e) {
    const missing = await page.evaluate((list) => list.filter((id) => !document.getElementById(id)), ids)
      .catch(() => ids);
    throw new Error(`★★전제 미달 — ${what}: ★★없는 칸 = ${JSON.stringify(missing)}`
      + ` (★찾은 칸 = ${JSON.stringify(ids.filter((i) => !missing.includes(i)))})`
      + '. ⛔본 단언까지 ★가지 ★못했다', { cause: e });
  }
}

/** ★패널이 ★참으로 ★떴나 — ★★«갯수 칸»만 ★요구한다.
 *  ⛔★간격 칸을 ★여기서 ★요구하면 ★안 된다: ★갯수 1 에서는 ★★없는 게 ★맞다(★제품 설계). */
const waitPanel = (page) => waitIds(page, ['shape-star-count-num'], '별 패널의 ★갯수 칸');

/** ★간격 칸은 ★★갯수 > 1 이 ★된 ★뒤에 ★생긴다 — ★만지기 ★전에 ★그걸 ★따로 ★기다린다. */
const waitGapInput = (page) => waitIds(page, ['shape-star-gap-num'],
  '별 ★간격 칸(★갯수 > 1 이어야 ★생긴다 — `prop-shape.js:246`)');


const snap = (page) => page.evaluate(() => {
  const blk = document.querySelector('#canvas .shape-block');
  const svg = blk.querySelector('svg');
  const frame = blk.closest('.frame-block');
  return {
    starCount: blk.dataset.starCount ?? null,
    starGap: blk.dataset.starGap ?? null,
    starRating: blk.dataset.starRating ?? null,
    starColors: blk.dataset.starColors ?? null,
    starScales: blk.dataset.starScales ?? null,
    viewBox: svg?.getAttribute('viewBox') ?? null,
    polys: [...svg.querySelectorAll('polygon')].map(p => p.getAttribute('points')),
    fills: [...svg.querySelectorAll('polygon')].map(p => p.getAttribute('fill')),
    frameW: Math.round(parseFloat(frame?.style.width) || parseFloat(frame?.dataset.width) || 0),
    cntDisabled: !!document.getElementById('shape-star-count-num')?.disabled,
    cntSliderDisabled: !!document.getElementById('shape-star-count-slider')?.disabled,
    ratingHint: document.getElementById('shape-star-rating-hint')?.textContent.trim() || null,
    ratingPreview: document.getElementById('shape-star-rating-preview')?.textContent || null,
  };
});

/* ══ ⒤⒥ b1 — ★간격이 ★폭을 ★참으로 키우나 ══════════════════════════════════ */
test('D1 ★b1 — ★간격을 올리면 ★프레임 폭이 ★늘어난다 (★유닛은 ★식만 쟀다)', async ({ page }) => {
  await setup(page);
  await setNum(page, 'shape-star-count-num', 5);
  await waitCount(page, 5);
  const a = await snap(page);
  expect(a.starCount, '전제 — 갯수 5').toBe('5');
  const w0 = a.frameW;
  expect(w0, `전제 — 갯수 5 뒤 폭이 0 이 아니다 (잰 값: ${w0})`).toBeGreaterThan(0);

  await waitGapInput(page);

  await setNum(page, 'shape-star-gap-num', 100);
  await waitGap(page, 100);
  const b = await snap(page);
  expect(b.starGap, 'dataset.starGap').toBe('100');
  /* ★★고치기 전이라면 ★폭이 ★그대로였다 — ★그게 ★b1 의 흠이었다 */
  expect(b.frameW, `★간격을 올렸는데 ★폭이 ★안 늘었다 (잰 값: ${w0} → ${b.frameW})`).toBeGreaterThan(w0);
  /* ★★식과 ★대조 — W' = W · vbW'/vbW. count 5 · gap 0→100 ⇒ 1000→1400 */
  const want = Math.max(10, Math.min(860, Math.round(w0 * 1400 / 1000)));
  expect(b.frameW, `★식이 낸 수와 ★화면값이 다르다 (기대 ${want} · 잰 값 ${b.frameW})`).toBe(want);
});

test('D2 ★★① 후속 — ★상한 ★아래서는 ★비가 ★유지되고 · ★★상한에서는 ★W9 가 ★예측한 만큼만 ★깨진다', async ({ page }) => {
  /* ★★★첫 판에서 ★이 칸이 ★빨갰고 ★★제품이 ★아니라 ★★내 ★문턱이 ★틀렸다 — ★적어 둔다:
   *   ★잰 값 ★gap 200 에서 ★비 ★−4.4443% · ★내 문턱은 ★3% 였다.
   *   ★★★그런데 ★★`W9`(유닛)이 ★이미 ★★−4.44% 를 ★예측해 뒀다 — ★★내가 ★그 수를 ★손수 적었다.
   *   ★까닭: ★이 판의 ★W0 = ★500(갯수 5 뒤) ⇒ ★★W0 ≥ 479 ⇒ ★gap 200 은 ★900px 을 요구 ⇒ ★★860 으로 ★잘린다
   *     ⇒ ★★860/900 − 1 = ★★−4.44%. ★★DOM 이 ★유닛 예측을 ★★세 자리까지 ★재현했다.
   * ⇒ ★★★그래서 ★문턱을 ★고치는 대신 ★★«두 구간»으로 ★갈라 ★★둘 다 ★단언한다.
   *   ⒜ ★상한 ★아래(gap 50·100) = ★비가 ★지켜진다
   *   ⒝ ★★상한(gap 200) = ★★폭이 ★860 이고 ★손실이 ★★예측값 ★−4.44% 다
   *   ⇒ ★★이 꼴이 ★★판정 ③ 의 ★«대가»를 ★★행위로 ★잠근다(★W9 는 ★산술로 잠근다) */
  await setup(page);
  await setNum(page, 'shape-star-count-num', 5);
  await waitCount(page, 5);
  const rect = () => page.evaluate(() => {
    const p = document.querySelector('#canvas .shape-block svg polygon');
    const b = p.getBoundingClientRect();
    return { w: b.width, h: b.height };
  });
  const r0 = await rect();
  expect(r0.w, `전제 — 별 하나가 보인다 (잰 값: ${JSON.stringify(r0)})`).toBeGreaterThan(1);
  const w0 = (await snap(page)).frameW;
  expect(w0, `전제 — 갯수 5 뒤 폭 (잰 값: ${w0})`).toBe(500);
  const aspect0 = r0.w / r0.h;

  /* ⒜ ★상한 ★아래 — ★요구 폭이 ★860 이하라 ★비가 ★지켜진다 */
  for (const g of [50, 100]) {
    await waitGapInput(page);
    await setNum(page, 'shape-star-gap-num', g);
    await waitGap(page, g);
    const r = await rect();
    const s = await snap(page);
    const need = Math.round(w0 * (1000 + g * 4) / 1000);
    expect(s.frameW, `★gap ${g}: ★폭이 ★식과 다르다`).toBe(need);
    expect(need, `★gap ${g}: ★전제 — ★상한에 ★안 닿아야 한다 (요구 ${need})`).toBeLessThanOrEqual(860);
    expect(Math.abs(r.w / r.h / aspect0 - 1),
      `★gap ${g} 에서 ★비가 ★깨졌다 — ${aspect0.toFixed(4)} → ${(r.w / r.h).toFixed(4)}`).toBeLessThan(0.01);
  }

  /* ⒝ ★★상한 — ★★여기서는 ★깨지는 것이 ★맞다. ★★얼마나 깨지나를 ★못박는다 */
  await waitGapInput(page);
  await setNum(page, 'shape-star-gap-num', 200);
  await waitGap(page, 200);
  const sCap = await snap(page);
  const needCap = Math.round(w0 * 1800 / 1000);
  expect(needCap, `★전제 — gap 200 은 ★상한을 ★넘어야 한다 (요구 ${needCap})`).toBeGreaterThan(860);
  expect(sCap.frameW, `★★상한에서 ★폭이 ★860 이 아니다 (잰 값: ${sCap.frameW})`).toBe(860);
  expect(sCap.viewBox, 'viewBox = 200·5＋200·4').toBe('0 0 1800 190');
  const rCap = await rect();
  const loss = (rCap.w / rCap.h / aspect0 - 1) * 100;
  const predicted = (860 / needCap - 1) * 100;
  expect(Math.abs(loss - predicted),
    `★★상한의 ★손실이 ★예측과 다르다 — ★잰 값 ${loss.toFixed(2)}% · ★예측 ${predicted.toFixed(2)}% (★W9 가 −4.44% 라 적었다)`)
    .toBeLessThan(0.6);
});

/* ══ ⒦⒩ b3 — ★평점 ══════════════════════════════════════════════════════════ */
test('D3 ★b3 — ★평점을 켜면 ★칠이 ★두 색으로 갈리고 ★갯수가 ★잠긴다', async ({ page }) => {
  await setup(page);
  await page.evaluate(() => {
    const t = document.getElementById('shape-star-rating-toggle');
    if (!t) throw new Error('★평점 토글이 ★패널에 ★없다');
    t.checked = true;
    t.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await waitRating(page, 5);
  const s = await snap(page);
  expect(s.starRating, '★평점 dataset').toBe('5');
  expect(s.starCount, '★「별이 5개로 구성」 — 갯수가 5 로 맞춰졌다').toBe('5');
  expect(s.polys.length, '★polygon 5개').toBe(5);
  expect(s.fills, `★칠 전수 (잰 값: ${JSON.stringify(s.fills)})`).toEqual(
    ['#ff8a00', '#ff8a00', '#ff8a00', '#ff8a00', '#ff8a00']);
  /* ★판정 ⑤ — ★두 칸이 ★다 잠긴다 ＋ ★까닭이 ★화면에 적힌다 */
  expect(s.cntDisabled, '★갯수 숫자칸이 ★안 잠겼다').toBe(true);
  expect(s.cntSliderDisabled, '★갯수 슬라이더가 ★안 잠겼다').toBe(true);
  expect(s.ratingHint, '★잠금 ★까닭 줄이 ★화면에 없다').toContain('5');

  /* ★평점 3 — ★앞 셋만 채운 색 */
  await setNum(page, 'shape-star-rating-num', 3);
  await waitRating(page, 3);
  const t = await snap(page);
  expect(t.fills, `★평점 3 의 칠 (잰 값: ${JSON.stringify(t.fills)})`).toEqual(
    ['#ff8a00', '#ff8a00', '#ff8a00', '#d6d6d6', '#d6d6d6']);
  expect(t.ratingPreview, '★미리보기').toBe('★★★☆☆');
});

test('D4 ★b3 — ★평점을 끄면 ★칠이 ★물러나고 ★갯수 잠금이 ★풀린다', async ({ page }) => {
  await setup(page);
  const tog = async (on) => {
    await page.evaluate((v) => {
      const t = document.getElementById('shape-star-rating-toggle');
      t.checked = v;
      t.dispatchEvent(new Event('change', { bubbles: true }));
    }, on);
    await waitRating(page, on ? 5 : null);
  };
  await tog(true);
  expect((await snap(page)).starRating, '전제 — 켜졌다').toBe('5');
  await tog(false);
  const s = await snap(page);
  expect(s.starRating, '★끄면 ★키가 ★지워진다(옛 바이트)').toBeNull();
  expect(s.fills.filter(Boolean), `★칠이 ★안 물러났다 (잰 값: ${JSON.stringify(s.fills)})`).toEqual([]);
  expect(s.cntDisabled, '★갯수 숫자칸 ★잠금이 ★안 풀렸다').toBe(false);
  expect(s.cntSliderDisabled, '★갯수 슬라이더 ★잠금이 ★안 풀렸다').toBe(false);
});

test('D5 ★★⒩ ⌘Z — ★평점 토글이 ★한 칸이다 (지디 ＋지시)', async ({ page }) => {
  await setup(page);
  const depth = () => page.evaluate(() => (window.historyStack?.length ?? window._history?.length ?? null));
  const d0 = await depth();
  test.skip(d0 === null, '★히스토리 깊이를 ★읽을 자가 없다 — ★이 판에서 ★못 잰다');
  await page.evaluate(() => {
    const t = document.getElementById('shape-star-rating-toggle');
    t.checked = true; t.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await waitRating(page, 5);
  const d1 = await depth();
  expect(d1 - d0, `★평점 토글이 ★히스토리를 ★${d1 - d0} 칸 ★먹었다 — ★1 이어야 한다`).toBe(1);
});

/* ══ ⒧ 그라데이션 왕복 ══════════════════════════════════════════════════════ */
test('D6 ★★⒧ ★그라데이션 별 — ★평점 켜고 ★끄면 ★그라데이션이 ★돌아온다 (R10 의 ★행위)', async ({ page }) => {
  await setup(page);
  /* ★그라데이션을 ★제품 길로 ★건다 — ⛔손으로 fill 을 쓰지 않는다 */
  const applied = await page.evaluate(() => {
    const blk = document.querySelector('#canvas .shape-block');
    const svg = blk.querySelector('svg');
    if (!window._applyShapeGradient) return 'NO_FN';
    blk.dataset.shapeColor = 'linear-gradient(90deg, #ff0000 0%, #0000ff 100%)';
    window._applyShapeGradient(blk, svg, {
      css: 'linear-gradient(90deg, #ff0000 0%, #0000ff 100%)',
      type: 'linear', angle: 90,
      stops: [{ color: '#ff0000', pos: 0 }, { color: '#0000ff', pos: 100 }],
    });
    blk.dataset.shapeGradient = JSON.stringify({ type: 'linear', angle: 90,
      stops: [{ color: '#ff0000', pos: 0 }, { color: '#0000ff', pos: 100 }] });
    return [...svg.querySelectorAll('polygon')].map(p => p.getAttribute('fill')).join('|');
  });
  test.skip(applied === 'NO_FN', '★_applyShapeGradient 가 ★window 에 ★없다 — ★이 판에서 ★못 잰다');
  expect(applied, `★전제 — 그라데이션이 ★걸렸다 (잰 값: ${applied})`).toContain('url(#');

  const tog = async (v) => {
    await page.evaluate((on) => {
      const t = document.getElementById('shape-star-rating-toggle');
      t.checked = on; t.dispatchEvent(new Event('change', { bubbles: true }));
    }, v);
    await waitRating(page, v ? 5 : null);
  };
  await tog(true);
  const on = await snap(page);
  expect(on.fills.some(f => f === '#ff8a00'), `★평점이 ★칠을 ★안 덮었다 (잰 값: ${JSON.stringify(on.fills)})`).toBe(true);
  await tog(false);
  const off = await snap(page);
  /* ★★★이 칸이 ★R10 의 ★행위다 — ★돌아와야 한다 */
  expect(off.fills.every(f => f && f.startsWith('url(#')),
    `★★그라데이션이 ★안 돌아왔다 — ★사용자가 ★칠한 것이 ★사라졌다 (잰 값: ${JSON.stringify(off.fills)})`).toBe(true);
});

/* ══ ⒨ 저장 왕복 (지디 ㉠) ══════════════════════════════════════════════════ */
test('D7 ★★⒨ ★저장 왕복 — ★개별 색·배율이 ★저장 → ★불러오기 → ★다시 꺼내 쓰기까지 ★산다', async ({ page }) => {
  await setup(page);
  await setNum(page, 'shape-star-count-num', 5);
  await waitCount(page, 5);
  /* ★상태를 ★심는다 — ★입구(UI)가 ★아직 없으니 ★dataset 에 ★직접 심고 ★제품 길로 ★그리게 한다 */
  await page.evaluate(() => {
    const blk = document.querySelector('#canvas .shape-block');
    blk.dataset.starColors = '#ff0000,,#00ff00';
    blk.dataset.starScales = ',50';
  });
  /* ★★★첫 판에서 ★이 칸이 ★빨갰고 ★★제품이 ★아니라 ★★내 ★준비가 ★틀렸다 — ★적어 둔다:
     ★나는 ★`showShapeProperties`(패널 ★재배선)가 ★다시 ★그린다고 ★★가정했다. ★★틀렸다.
     ★★실측: ★`_applyStarGeom()` 호출은 ★★7 곳이고 ★★전부 ★`apply*` ★«손잡이 안»이다
       (applyStar · applyStarCount · applyStarInner · applyStarGap · applyStarRating ×3)
       ⇒ ★★배선만으로는 ★★한 번도 ★안 그린다.
     ★★★그래서 ★제품 길을 ★★때린다 — ★간격 칸을 ★만져 ★`_applyStarGeom` 을 ★돌린다.
     ⚠️★★그리고 ★그 사실이 ★★제품에 ★뜻을 갖는다: ★★dataset 만 ★든 저장본(손으로 쓴 것·템플릿·
       마이그레이션)은 ★★사람이 ★패널을 ★만질 때까지 ★★안 칠해진다.
       ★★★단 ★보통 저장본은 ★★polygon 의 ★fill·points 가 ★같이 저장되므로 ★그 길은 ★안 탄다.
       ⇒ ★★이 수를 ★지디에 ★올렸다. ⛔이 칸에서 ★그것을 ★고치지는 ★않는다(범위 밖). */
  await waitGapInput(page);
  await setNum(page, 'shape-star-gap-num', 10);
  await waitGap(page, 10);
  const before = await snap(page);
  expect(before.fills[0], '★0번 별 색').toBe('#ff0000');
  expect(before.fills[2], '★2번 별 색').toBe('#00ff00');
  const poly1Before = before.polys[1];

  /* ★★저장 — ★제품의 ★직렬화를 ★쓴다(⛔내 사본 금지)
     ★★★서명을 ★★읽고 ★쓴다 — ⛔추측하지 ★않는다. ★이 칸에서 ★★두 번 ★틀렸다:
       ⑴ ★`showShapeProperties` 가 ★다시 그린다고 ★가정했다 ⇒ ★★틀렸다(손잡이 안에서만 그린다)
       ⑵ ★`serializeSectionClone(sec).outerHTML` 로 ★썼다 ⇒ ★★틀렸다 —
          ★실측(`js/io/section-serialize.js:447~455`): ★★«문자열»을 돌려준다(`…outerHTML : ''`)
     ⇒ ★★그래서 ★이번엔 ★그 함수와 ★`serializeCleanRoot` 를 ★먼저 ★읽었다:
       ★`data-star-*` 를 ★벗기는 줄이 ★★0건이다(★벗기는 것 = `data-lazy-bg` · video-pending 뿐)
       ⇒ ★★그래서 ★dataset 이 ★저장본에 ★살아야 한다. ★아래가 ★그것을 ★잰다. */
  const saved = await page.evaluate(() => {
    const sec = document.getElementById('sA');
    const out = window.serializeSectionClone ? window.serializeSectionClone(sec) : sec.outerHTML;
    return typeof out === 'string' ? out : (out && out.outerHTML) || '';
  });
  expect(typeof saved, '★저장본이 ★문자열이 ★아니다').toBe('string');
  expect(saved.length, `★저장본이 ★비었다 (길이 ${saved.length})`).toBeGreaterThan(100);
  expect(saved, '★저장본에 ★개별 색 키가 ★없다').toContain('star-colors');
  expect(saved, '★저장본에 ★배율 키가 ★없다').toContain('star-scales');

  /* ★★불러오기 — ★지우고 ★저장본으로 ★다시 세운다 */
  await page.evaluate((html) => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', html);
    window.rebindAll?.();
  }, saved);
  /* ⛔★여기서 ★«값»을 ★기다리지 ★않는다 — ★그러면 ★제품 흠이 ★«전제 미달»로 ★둔갑한다.
     ★구조(★블록 ＋ polygon 5개)만 ★기다리고 ★값은 ★아래 ★expect 가 ★잰다 */
  await waitCount(page, 5);
  const after = await snap(page);
  expect(after.starColors, '★불러온 뒤 ★개별 색 dataset').toBe('#ff0000,,#00ff00');
  expect(after.starScales, '★불러온 뒤 ★배율 dataset').toBe(',50');
  expect(after.fills[0], '★불러온 뒤 ★0번 별 색').toBe('#ff0000');
  expect(after.polys[1], '★불러온 뒤 ★1번 별 points(배율 50)').toBe(poly1Before);

  /* ★★★«다시 꺼내 쓰기» — ★지디 ㉠ 의 그 칸. ★패널을 ★만져서 ★_applyStarGeom 을 ★다시 돌린다 */
  await page.evaluate(() => window.showShapeProperties?.(document.querySelector('#canvas .shape-block')));
  await waitPanel(page);
  await waitGapInput(page);
  await setNum(page, 'shape-star-gap-num', 30);
  await waitGap(page, 30);
  const reuse = await snap(page);
  expect(reuse.starColors, '★★패널을 만진 뒤 ★개별 색이 ★사라졌다').toBe('#ff0000,,#00ff00');
  expect(reuse.starScales, '★★패널을 만진 뒤 ★배율이 ★사라졌다').toBe(',50');
  expect(reuse.fills[0], '★★패널을 만진 뒤 ★0번 별 색이 ★사라졌다').toBe('#ff0000');
  /* ★배율이 ★살아 있나 — ★1번 별이 ★0번보다 ★작아야 한다(50％) */
  const span = (p) => { const xs = p.trim().split(/\s+/).map(q => Number(q.split(',')[0]));
    return Math.max(...xs) - Math.min(...xs); };
  expect(span(reuse.polys[1]), `★1번 별이 ★안 작다 — 0번 ${span(reuse.polys[0]).toFixed(1)} vs 1번 ${span(reuse.polys[1]).toFixed(1)}`)
    .toBeLessThan(span(reuse.polys[0]) * 0.75);
});

/* ══ ⒪ 제스처 임자 — ★내 어림자(44곳 중 0건)를 ★행위로 ★대체한다 ══════════════ */
test('D8 ★★⒪ ★별 더블클릭의 ★임자 — ★★지금은 ★«별 모드»다 (⚰️전엔 ★0 이었다)', async ({ page }) => {
  /* ★★★⚰️ ★이 칸의 ★옛 뜻 — ★★«임자가 ★0 이다»였고, ★★2026-10-10 ★창 1·2·3회차에서 ★초록이었다.
   *   ★그 수가 ★★b2 가 ★그 제스처를 ★가져도 된다는 ★근거였다(★내 ★어림자 44곳/0건을 ★대체했다).
   * ★★★이제 ★임자가 ★있다 — ★`js/star-select.js` 다. ⇒ ★★옛 단언은 ★★역사가 됐다.
   *   ⛔그 문장을 ★지우지 ★않고 ★여기 ★남긴다 — ★★«왜 가져도 됐나»의 ★근거이기 때문이다.
   * ★★그래서 ★이 칸은 ★이제 ★★«임자가 ★참으로 ★별 모드인가 ＋ ★그것 ★말고는 ★안 바뀌나»를 ★잰다.
   *   ⇒ ★★기하·갯수는 ★★그대로여야 한다(★모드는 ★«보기»지 ★«데이터»가 아니다)
   *   ⇒ ★★예외 ★0 — ★★실측(2026-10-10): ★이 칸이 ★`_imgEditing` ★null 예외를 ★★잡아냈고
   *     ★★그 한 줄이 ★E1·E2·E3 를 ★같이 ★빨갛게 만들고 있었다. ★★그래서 ★예외 단언을 ★★남긴다. */
  await setup(page);
  await setNum(page, 'shape-star-count-num', 5);
  await waitCount(page, 5);
  const before = await snap(page);
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await dblclickStar(page, 0);
  await waitMode(page, { want: true });
  const after = await snap(page);
  /* ★★예외 0 — ★이 단언이 ★★네 칸을 ★한꺼번에 ★설명한 ★그 자다 */
  expect(errs, `★더블클릭이 ★예외를 던졌다: ${errs.join(' / ')}`).toEqual([]);
  /* ★모드는 ★데이터를 ★안 바꾼다 */
  expect(after.starCount, '★더블클릭이 ★갯수를 바꿨다').toBe(before.starCount);
  expect(after.polys, '★더블클릭이 ★기하를 바꿨다').toEqual(before.polys);
  expect(after.starColors, '★더블클릭만으로 ★색 dataset 이 ★생겼다').toBeNull();
  expect(after.starScales, '★더블클릭만으로 ★배율 dataset 이 ★생겼다').toBeNull();
  /* ★★★그리고 ★임자가 ★참으로 ★별 모드다 */
  const owned = await page.evaluate(() => {
    const blk = document.querySelector('#canvas .shape-block');
    return { mode: blk.classList.contains('star-mode'), sel: blk._starSel ?? null };
  });
  expect(owned.mode, '★★더블클릭이 ★별 모드를 ★안 세웠다 — ★임자가 ★없다').toBe(true);
  expect(owned.sel, '★첫 별이 ★안 골라졌다').toBe(0);
});

/* ══ ★★★b2 ★진입 모드 — ★★«사람이 ★줄 수 ★있나»가 ★★첫 칸이다 (지디 조건 ⑷) ══════════
 * ★★지디: 「★★«사람이 ★줄 수 ★있나»를 ★★그 커밋의 ★첫 칸으로.
 *   ⇒ ★지금 ★D7 은 ★상태를 ★★심어 ★잰다 ⇒ ★★«사람이 ★더블클릭 → ★색 고르기 → ★그 dataset 이 ★생기나»
 *   ⇒ ★★그게 ★★«입구가 ★0건»을 ★지울 ★자격이다. ⛔UI 가 ★떴다로는 ★안 된다」
 * ⇒ ★★★그래서 ★E1 이 ★★제품 길만 쓴다: ★진짜 ★마우스 ★더블클릭 ＋ ★진짜 ★색 입력 ★이벤트.
 *   ⛔`dataset` 을 ★손으로 ★심지 ★않는다. ⛔`enterStarMode` 를 ★직접 ★부르지도 ★않는다. */
test('E1 ★★★사람이 ★줄 수 있다 — ★더블클릭 → ★색 고르기 → ★`data-star-colors` 가 ★생긴다 (지디 ⑷)', async ({ page }) => {
  await setup(page);
  await setNum(page, 'shape-star-count-num', 5);
  await waitCount(page, 5);
  const a = await snap(page);
  expect(a.starColors, '★전제 — ★시작엔 ★개별 색 키가 ★없다(옛 바이트)').toBeNull();
  expect(a.polys.length, '전제 — 별 5개').toBe(5);

  /* ⑴ ★★3번째 별(index 2)을 ★★진짜 ★더블클릭 — ⛔API 를 ★안 부른다 */
  await dblclickStar(page, 2);
  await waitMode(page, { want: true });

  /* ⑵ ★모드가 ★섰고 ★★«입구»가 ★떴나 — ★그 줄이 ★없으면 ★사람이 ★줄 ★길이 ★없다 */
  const ui = await page.evaluate(() => {
    const blk = document.querySelector('#canvas .shape-block');
    return {
      modeCls: blk.classList.contains('star-mode'),
      markedPolys: [...blk.querySelectorAll('svg polygon')].map(p => p.classList.contains('star-cell-selected')),
      hasRow: !!document.getElementById('shape-star-one-row'),
      label: document.getElementById('shape-star-one-label')?.textContent || null,
      hasHex: !!document.getElementById('shape-star-one-hex'),
      hint: document.getElementById('shape-star-one-hint')?.textContent || null,
    };
  });
  expect(ui.modeCls, '★모드 표시가 ★안 붙었다').toBe(true);
  expect(ui.markedPolys, `★고른 별 표시가 ★3번째가 ★아니다 (잰 값: ${JSON.stringify(ui.markedPolys)})`)
    .toEqual([false, false, true, false, false]);
  expect(ui.hasRow, '★★«입구» 줄이 ★없다 — ★사람이 ★색을 ★줄 ★길이 ★없다').toBe(true);
  expect(ui.label, '★몇 번 별인지 ★화면에 ★안 적힌다').toContain('3');
  expect(ui.hasHex, '★색 입력칸이 ★없다').toBe(true);
  expect(ui.hint, '★까닭 줄이 ★없다').toContain('3');

  /* ⑶ ★★★사람이 ★색을 ★넣는다 — ★hex 칸에 ★치고 ★change (★제품 배선이 ★그것을 ★듣는다) */
  await page.evaluate(() => {
    const hex = document.getElementById('shape-star-one-hex');
    hex.value = '00FF00';
    hex.dispatchEvent(new Event('input', { bubbles: true }));
    hex.dispatchEvent(new Event('change', { bubbles: true }));
  });
  /* ⑷ ★★★그 dataset 이 ★생겼나 — ★★이것이 ★★«입구가 0건»을 ★지울 ★자격이다
   * ⛔★여기는 ★`waitForFunction` 으로 ★기다리지 ★않는다 — ★★그러면 ★★제품이 ★안 쓴 ★경우가
   *   ★★«전제 미달»로 ★둔갑해 ★★이 칸이 ★★재려던 것을 ★★안 재게 ★된다.
   * ⇒ ★★★«기다린 뒤 ★단언»이 아니라 ★★★«다시 재는 ★단언»으로 — ★레포 관용구 ★`expect.poll`(49벌/126곳) */
  await expect.poll(
    () => page.evaluate(() => document.querySelector('#canvas .shape-block').dataset.starColors ?? null),
    { timeout: COND_MS, message: '★★data-star-colors 가 ★안 생겼다 — ★사람이 ★준 것이 ★안 남았다' },
  ).not.toBeNull();
  const b = await snap(page);
  expect(b.starColors, '★★data-star-colors 가 ★안 생겼다 — ★사람이 ★준 것이 ★안 남았다')
    .not.toBeNull();
  const parts = String(b.starColors).split(',');
  expect(parts[2]?.toLowerCase(), `★3번째 칸에 ★안 들어갔다 (잰 값: ${b.starColors})`).toBe('#00ff00');
  expect(parts[0] || '', '★0번 칸은 ★비어 있어야 한다(물려받음)').toBe('');
  /* ★★그리고 ★화면이 ★참으로 ★그 색인가 — ⛔dataset 만 보지 않는다 */
  expect(b.fills[2]?.toLowerCase(), `★3번째 별이 ★그 색으로 ★안 칠해졌다 (잰 값: ${JSON.stringify(b.fills)})`)
    .toBe('#00ff00');
  expect(b.fills[0], '★0번 별은 ★안 칠해져야 한다(물려받음)').toBeNull();
});

test('E2 ★진입 배타 ★양방향 ＋ ★나가기 — ★Esc·밖 클릭이 ★모드를 ★푼다', async ({ page }) => {
  await setup(page);
  await setNum(page, 'shape-star-count-num', 5);
  await waitCount(page, 5);
  /* ★★이 칸의 ★«다른 별로 옮긴다»는 ★★모드가 ★선 ★채로 ★고른 별만 ★바뀐다 ⇒ ★★`_starSel` 로 ★기다린다 */
  const dbl = async (n) => {
    await dblclickStar(page, n);
    await page.waitForFunction((k) => {
      const b = document.querySelector('#canvas .shape-block');
      return !!b && b.classList.contains('star-mode') && b._starSel === k;
    }, n, { timeout: COND_MS }).catch(() => {
      throw new Error('★★전제 미달 — ★' + n + '번 별이 ★골라지지 ★않았다(★모드·`_starSel` 둘 다). ⛔본 단언까지 ★가지 ★못했다');
    });
  };
  const inMode = () => page.evaluate(() => ({
    cls: document.querySelector('#canvas .shape-block').classList.contains('star-mode'),
    row: !!document.getElementById('shape-star-one-row'),
    sel: document.querySelector('#canvas .shape-block')._starSel ?? null,
  }));
  await dbl(1);
  expect((await inMode()).cls, '전제 — 모드가 섰다').toBe(true);
  expect((await inMode()).sel, '1번(index 1)이 골라졌다').toBe(1);
  /* ★모드 안에서 ★다른 별을 ★더블클릭하면 ★그 별로 ★옮긴다(★나가지 않는다) */
  await dbl(3);
  expect((await inMode()).sel, '★다른 별로 ★안 옮겼다').toBe(3);
  /* ★Esc 로 ★나간다 */
  await page.keyboard.press('Escape');
  await waitMode(page, { want: false });
  const out = await inMode();
  expect(out.cls, '★Esc 뒤에도 ★모드 표시가 ★남았다').toBe(false);
  expect(out.row, '★Esc 뒤에도 ★입구 줄이 ★남았다').toBe(false);
  expect(out.sel, '★Esc 뒤에도 ★고른 별이 ★남았다').toBeNull();
  /* ★★그리고 ★★고른 색은 ★★안 지워진다 — ★모드는 ★«보기»지 ★«데이터»가 아니다 */
  const s = await snap(page);
  expect(s.starColors, '★모드를 나갔는데 ★색 dataset 이 ★생겼다(모드가 데이터를 만들었다)').toBeNull();
  /* ★★진입 배타 ★반대 방향 — ★`enterImageEditMode` 머리가 ★별 모드를 ★내린다 */
  await dbl(2);
  expect((await inMode()).cls, '전제 — 다시 모드').toBe(true);
  const killed = await page.evaluate(() => {
    if (!window.enterImageEditMode) return 'NO_FN';
    window.enterImageEditMode(document.createElement('div'));   // ★요구가 안 맞아 금방 되돌아 나가도 ★머리 한 줄은 돈다
    return document.querySelector('#canvas .shape-block').classList.contains('star-mode');
  });
  if (killed !== 'NO_FN') {
    expect(killed, '★★`enterImageEditMode` 가 ★별 모드를 ★안 내렸다 — ★배타가 ★한 방향뿐이다').toBe(false);
  }
});

test('E3 ★★모드·표시가 ★저장본에 ★안 샌다 (★명부 둘에 ★등록한 그 까닭)', async ({ page }) => {
  await setup(page);
  await setNum(page, 'shape-star-count-num', 5);
  await waitCount(page, 5);
  await dblclickStar(page, 1);
  await waitMode(page, { want: true });
  /* ★위 `waitMode` 가 ★이미 ★전제다 — ★★이 줄은 ★그 전제를 ★★이름으로 ★남긴다 */
  expect(await page.evaluate(() => document.querySelector('#canvas .shape-block').classList.contains('star-mode')),
    '전제 — 모드가 섰다(표시가 라이브에 있다)').toBe(true);
  /* ★★모드가 ★선 ★채로 ★저장한다 — ★그게 ★이 칸의 핵이다(★사람은 ★아무 때나 저장한다) */
  const saved = await page.evaluate(() => {
    const sec = document.getElementById('sA');
    const out = window.serializeSectionClone ? window.serializeSectionClone(sec) : sec.outerHTML;
    return typeof out === 'string' ? out : (out && out.outerHTML) || '';
  });
  expect(saved.length, '★저장본이 비었다').toBeGreaterThan(100);
  expect(saved, '★★`star-mode` 가 ★저장본에 ★샜다 — `RUNTIME_MARKER_CLS` 등록이 ★안 먹는다').not.toContain('star-mode');
  expect(saved, '★★`star-cell-selected` 가 ★저장본에 ★샜다 — RE 가 ★안 잡는다').not.toContain('star-cell-selected');
  /* ★★`_starSel` 은 ★JS 프로퍼티라 ★애초에 ★직렬화 대상이 ★아니다 — ★그것도 ★확인한다 */
  expect(saved, '★`_starSel` 이 ★저장본에 있다 — ★프로퍼티가 ★속성이 됐다').not.toContain('_starSel');
});

/* ══ ⒦ ★★별 블록이 ★★«둘 이상»일 때 — ★모드가 ★블록 ★단위인가 ═════════════════
 * ★★내가 ★먼저 ★올린 칸이다(⛔«설계가 그렇다»를 ★안 믿는다 · 지디 접수).
 * ★★`js/star-select.js` 는 ★모듈 수준 ★`_mode` ★하나를 ★든다 ⇒ ★★설계상 ★블록 ★하나만 ★선다
 *   ⇒ ★★그런데 ★★«표시»·«고른 별»·«입구»가 ★참으로 ★한 블록에만 ★머무나는 ★★안 쟀다
 * ★★★그리고 ★여기가 ★위험한 까닭: ★`_markStarMode` 류가 ★★선택자를 ★문서 전역으로 ★쓰면
 *   ★★둘째 블록의 ★polygon 까지 ★표시가 ★번진다 — ★★그건 ★«조용한» 흠이다(★예외 ★없다) */
test('E4 ★★⒦ ★별 블록 ★둘 — ★모드·표시·입구가 ★★한 블록에만 ★머문다', async ({ page }) => {
  await setup(page);
  /* ★둘째 별 블록을 ★★제품 길로 ★더한다 — ★`addShapeBlock` 이 ★그 길이다 */
  await page.evaluate(() => {
    window.deselectAll?.();
    window.selectSection?.(document.getElementById('sA'));
    window.addShapeBlock?.('star');
  });
  await waitBlocks(page, 2);
  const n = await page.evaluate(() => document.querySelectorAll('#canvas .shape-block').length);
  expect(n, `★전제 — ★별 블록이 ★둘이어야 한다 (잰 값: ${n})`).toBe(2);

  /* ★둘 다 ★갯수 5 로 — ★각자 ★패널을 열어 ★만진다(⛔dataset 을 ★손으로 심지 않는다) */
  for (const i of [0, 1]) {
    await page.evaluate((k) => {
      const b = document.querySelectorAll('#canvas .shape-block')[k];
      window.showShapeProperties?.(b);
    }, i);
    await waitPanel(page);
    await setNum(page, 'shape-star-count-num', 5);
    await page.waitForFunction((k) => {
      const b = document.querySelectorAll('#canvas .shape-block')[k];
      return !!b && b.dataset.starCount === '5' && b.querySelectorAll('svg polygon').length === 5;
    }, i, { timeout: COND_MS }).catch(() => {
      throw new Error('★★전제 미달 — ★블록 ' + i + ' 의 ★갯수가 ★5 로 ★서지 ★않았다. ⛔본 단언까지 ★가지 ★못했다');
    });
  }
  const counts = await page.evaluate(() => [...document.querySelectorAll('#canvas .shape-block')]
    .map((b) => b.dataset.starCount));
  expect(counts, `★전제 — ★둘 다 ★갯수 5 (잰 값: ${JSON.stringify(counts)})`).toEqual(['5', '5']);

  /* ★★첫째 블록의 ★3번 별을 ★★진짜 ★더블클릭 */
  await dblclickStar(page, 2, { blockIdx: 0 });
  await waitMode(page, { idx: 0, want: true });

  const st = await page.evaluate(() => {
    const bs = [...document.querySelectorAll('#canvas .shape-block')];
    return bs.map((b) => ({
      mode: b.classList.contains('star-mode'),
      sel: b._starSel ?? null,
      marked: [...b.querySelectorAll('svg polygon')].filter((p) => p.classList.contains('star-cell-selected')).length,
    }));
  });
  /* ★★★첫째에만 ★모드·표시가 ★있어야 한다 */
  expect(st[0].mode, '★첫째 블록에 ★모드가 ★안 섰다').toBe(true);
  expect(st[0].sel, '★첫째 블록에서 ★3번째(index 2)가 ★안 골라졌다').toBe(2);
  expect(st[0].marked, '★첫째 블록의 ★표시가 ★하나가 ★아니다').toBe(1);
  expect(st[1].mode, '★★둘째 블록에 ★모드가 ★번졌다').toBe(false);
  expect(st[1].sel, '★★둘째 블록에 ★고른 별이 ★번졌다').toBeNull();
  expect(st[1].marked, '★★둘째 블록의 ★polygon 에 ★표시가 ★번졌다').toBe(0);

  /* ★★그리고 ★★입구(«이 별» 색 줄)가 ★★하나만 ★뜬다 */
  const rows = await page.evaluate(() => document.querySelectorAll('#shape-star-one-row').length);
  expect(rows, `★입구 줄이 ★${rows}개다 — ★하나여야 한다`).toBe(1);

  /* ★★★둘째 블록의 별을 ★더블클릭하면 ★★모드가 ★그쪽으로 ★옮겨지고 ★첫째는 ★풀린다 */
  await dblclickStar(page, 0, { blockIdx: 1 });
  await waitMode(page, { idx: 1, want: true });
  const st2 = await page.evaluate(() => {
    const bs = [...document.querySelectorAll('#canvas .shape-block')];
    return bs.map((b) => ({ mode: b.classList.contains('star-mode'), sel: b._starSel ?? null,
      marked: [...b.querySelectorAll('svg polygon')].filter((p) => p.classList.contains('star-cell-selected')).length }));
  });
  expect(st2[1].mode, '★둘째 블록에 ★모드가 ★안 섰다').toBe(true);
  expect(st2[1].sel, '★둘째 블록에서 ★0번이 ★안 골라졌다').toBe(0);
  expect(st2[0].mode, '★★첫째 블록의 ★모드가 ★안 풀렸다 — ★둘이 ★같이 섰다').toBe(false);
  expect(st2[0].sel, '★★첫째 블록의 ★고른 별이 ★남았다').toBeNull();
  expect(st2[0].marked, '★★첫째 블록의 ★표시가 ★남았다').toBe(0);
  /* ★★그리고 ★★저장본에 ★어느 쪽 흔적도 ★안 샌다 */
  const saved = await page.evaluate(() => {
    const sec = document.getElementById('sA');
    const out = window.serializeSectionClone ? window.serializeSectionClone(sec) : sec.outerHTML;
    return typeof out === 'string' ? out : (out && out.outerHTML) || '';
  });
  expect(saved, '★`star-mode` 가 ★저장본에 ★샜다').not.toContain('star-mode');
  expect(saved, '★`star-cell-selected` 가 ★저장본에 ★샜다').not.toContain('star-cell-selected');
});
