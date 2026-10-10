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
const { bootApp } = require('./_root-harness.js');

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
  await page.waitForTimeout(400);
  await page.evaluate(() => window.showShapeProperties?.(document.querySelector('#canvas .shape-block')));
  await page.waitForTimeout(150);
}

/** 숫자칸에 값을 넣고 input＋change 를 둘 다 때린다(제품 배선이 둘을 쓴다). */
const setNum = (page, id, v) => page.evaluate(([i, val]) => {
  const n = document.getElementById(i);
  if (!n) throw new Error(i + ' 가 없다');
  n.value = String(val);
  n.dispatchEvent(new Event('input', { bubbles: true }));
  n.dispatchEvent(new Event('change', { bubbles: true }));
}, [id, v]);

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
  await page.waitForTimeout(250);
  const a = await snap(page);
  expect(a.starCount, '전제 — 갯수 5').toBe('5');
  const w0 = a.frameW;
  expect(w0, `전제 — 갯수 5 뒤 폭이 0 이 아니다 (잰 값: ${w0})`).toBeGreaterThan(0);

  await setNum(page, 'shape-star-gap-num', 100);
  await page.waitForTimeout(250);
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
  await page.waitForTimeout(250);
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
    await setNum(page, 'shape-star-gap-num', g);
    await page.waitForTimeout(250);
    const r = await rect();
    const s = await snap(page);
    const need = Math.round(w0 * (1000 + g * 4) / 1000);
    expect(s.frameW, `★gap ${g}: ★폭이 ★식과 다르다`).toBe(need);
    expect(need, `★gap ${g}: ★전제 — ★상한에 ★안 닿아야 한다 (요구 ${need})`).toBeLessThanOrEqual(860);
    expect(Math.abs(r.w / r.h / aspect0 - 1),
      `★gap ${g} 에서 ★비가 ★깨졌다 — ${aspect0.toFixed(4)} → ${(r.w / r.h).toFixed(4)}`).toBeLessThan(0.01);
  }

  /* ⒝ ★★상한 — ★★여기서는 ★깨지는 것이 ★맞다. ★★얼마나 깨지나를 ★못박는다 */
  await setNum(page, 'shape-star-gap-num', 200);
  await page.waitForTimeout(250);
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
  await page.waitForTimeout(350);
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
  await page.waitForTimeout(300);
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
    await page.waitForTimeout(350);
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
  await page.waitForTimeout(350);
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
    await page.waitForTimeout(350);
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
  await page.waitForTimeout(250);
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
  await setNum(page, 'shape-star-gap-num', 10);
  await page.waitForTimeout(300);
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
  await page.waitForTimeout(400);
  const after = await snap(page);
  expect(after.starColors, '★불러온 뒤 ★개별 색 dataset').toBe('#ff0000,,#00ff00');
  expect(after.starScales, '★불러온 뒤 ★배율 dataset').toBe(',50');
  expect(after.fills[0], '★불러온 뒤 ★0번 별 색').toBe('#ff0000');
  expect(after.polys[1], '★불러온 뒤 ★1번 별 points(배율 50)').toBe(poly1Before);

  /* ★★★«다시 꺼내 쓰기» — ★지디 ㉠ 의 그 칸. ★패널을 ★만져서 ★_applyStarGeom 을 ★다시 돌린다 */
  await page.evaluate(() => window.showShapeProperties?.(document.querySelector('#canvas .shape-block')));
  await page.waitForTimeout(150);
  await setNum(page, 'shape-star-gap-num', 30);
  await page.waitForTimeout(300);
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
test('D8 ★★⒪ ★별 더블클릭에 ★오늘 ★임자가 ★있나 (★어림자 ★대체 · b2 진입 전 ★기준선)', async ({ page }) => {
  await setup(page);
  await setNum(page, 'shape-star-count-num', 5);
  await page.waitForTimeout(250);
  const before = await snap(page);
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  /* ★별 하나를 ★더블클릭한다 — ★제품 길(실제 마우스 이벤트) */
  const box = await page.locator('#canvas .shape-block svg polygon').first().boundingBox();
  expect(box, '★별을 ★화면에서 ★못 찾았다').not.toBeNull();
  await page.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(400);
  const after = await snap(page);
  /* ★★기준선 — ★오늘은 ★«아무 일도 안 일어난다»가 ★참이어야 한다(그러면 ★b2 가 ★그 자리를 ★가져도 된다) */
  expect(after.starCount, '★더블클릭이 ★갯수를 바꿨다').toBe(before.starCount);
  expect(after.polys, '★더블클릭이 ★기하를 바꿨다').toEqual(before.polys);
  expect(errs, `★더블클릭이 ★예외를 던졌다: ${errs.join(' / ')}`).toEqual([]);
  /* ★★그리고 ★«진입 표시»가 ★생기나 — ★b2 가 ★쓸 이름이 ★이미 쓰이고 있으면 ★여기서 ★드러난다 */
  const marks = await page.evaluate(() => {
    const blk = document.querySelector('#canvas .shape-block');
    return { cls: blk.getAttribute('class') || '', sel: blk.dataset.starSel ?? null,
             polyCls: [...blk.querySelectorAll('polygon')].map(p => p.getAttribute('class') || '').join('|') };
  });
  expect(marks.sel, '★`data-star-sel` 이 ★이미 쓰이고 있다 — ★b2 가 ★그 이름을 ★못 쓴다').toBeNull();
});

/* ══ ⒫ ★«자르는 자»를 ★★computed ＋ ★행위로 — ★상한 100 의 ★근거를 ★올린다 ════════
 * ★★지디(t3frame 발견 2026-10-10): 「★★«자르는 자가 ★없다»를 ★★CSS 전수로 ★말하지 ★마라 —
 *   ★자름은 ★★세 자리에 산다: ⑴ CSS 규칙 ⑵ ★렌더러가 ★박는 ★인라인 ⑶ ★앱이 ★나중에 쓰는 ★인라인」
 * ★★내가 ★`starScales` 상한 ★100 의 ★근거로 ★★«`.shape-block .shape-svg` 에 ★`overflow` 선언 ★0건
 *   ⇒ ★바깥 svg 의 ★UA 기본값이 ★자른다»를 ★★CSS ★독해로 ★댔다.
 * ⇒ ★★결론은 ★안 바뀐다(지디도 그렇게 적었다). ★★그러나 ★근거를 ★★독해 → ★★행위로 ★올린다.
 *   ⇒ ★★그러면 ★★상한 100 이 ★★«내가 읽은 것»이 아니라 ★★«이 판이 ★하는 일»에 ★선다. */
test('D9 ★★⒫ ★svg 가 ★참으로 ★자른다 — ★computed ＋ ★행위 (★상한 100 의 ★근거)', async ({ page }) => {
  await setup(page);
  /* ⒜ ★★computed — ⛔CSS 파일 독해가 ★아니다. ★★이 판이 ★계산한 값이다 */
  const comp = await page.evaluate(() => {
    const svg = document.querySelector('#canvas .shape-block svg.shape-svg');
    const cs = getComputedStyle(svg);
    return { overflow: cs.overflow, overflowX: cs.overflowX, overflowY: cs.overflowY,
             inlineOverflow: svg.style.overflow || null,
             attrOverflow: svg.getAttribute('overflow') };
  });
  /* ★자르는 값 = hidden · clip · (일부 판에서) auto 가 아닌 것 */
  expect(['hidden', 'clip'], `★★computed overflow 가 ★자르는 값이 ★아니다 — ${JSON.stringify(comp)}`)
    .toContain(comp.overflowY);
  /* ⒝ ★★세 자리 중 ★어디서 왔나를 ★같이 적는다 — ★인라인·속성이 ★비면 ★UA/CSS 다 */
  expect(comp.inlineOverflow, `★인라인 overflow 가 ★있다(렌더러·앱이 ★박았다): ${comp.inlineOverflow}`).toBeNull();

  /* ⒞ ★★★행위 — ★틀 ★밖으로 ★나간 점이 ★★참으로 ★안 보이나.
     ★viewBox 위로 ★한참 ★나가는 ★임시 polygon 을 ★넣고, ★그 자리를 ★`elementFromPoint` 로 ★짚는다.
     ⇒ ★자르면 ★그 점에서 ★★그 polygon 이 ★★안 잡힌다. ⛔getBoundingClientRect 로는 ★못 잰다
       (★SVG 의 rect 는 ★기하 bbox 라 ★«잘렸나»를 ★말하지 ★않는다 — ★그래서 ★점을 ★짚는다). */
  const probe = await page.evaluate(() => {
    const svg = document.querySelector('#canvas .shape-block svg.shape-svg');
    const box = svg.getBoundingClientRect();
    const NS = 'http://www.w3.org/2000/svg';
    const p = document.createElementNS(NS, 'polygon');
    /* ★viewBox 세로는 0~190. ★−400 ~ −10 은 ★틀 ★위로 ★완전히 ★나간 자리다 */
    p.setAttribute('points', '0,-400 2000,-400 2000,-10 0,-10');
    p.setAttribute('fill', '#ff00ff');
    p.setAttribute('id', 'probe-outside');
    svg.appendChild(p);
    /* ★틀 ★위쪽 ★바깥의 ★한 점 — ★svg 상단보다 ★위다 */
    const x = Math.round(box.left + box.width / 2);
    const y = Math.round(box.top - Math.min(20, box.top / 2));
    const hit = document.elementFromPoint(x, y);
    const hitId = hit ? (hit.id || hit.tagName) : null;
    /* ★그리고 ★틀 ★안의 ★한 점은 ★★잡혀야 한다(★음성대조 — ★짚는 자가 ★참으로 ★도는지) */
    const inX = Math.round(box.left + box.width / 2);
    const inY = Math.round(box.top + box.height / 2);
    const inHit = document.elementFromPoint(inX, inY);
    p.remove();
    return { hitId, insideTag: inHit ? inHit.tagName : null,
             boxTop: Math.round(box.top), probeY: y, probedAbove: y < box.top };
  });
  expect(probe.probedAbove, `★짚은 점이 ★틀 ★위가 ★아니다 — ${JSON.stringify(probe)}`).toBe(true);
  /* ★★음성대조 — ★틀 ★안을 짚으면 ★무언가 ★잡힌다(★짚는 자가 ★죽어 있지 ★않다) */
  expect(probe.insideTag, `★틀 ★안에서 ★아무것도 ★안 잡혔다 — ★짚는 자가 ★죽었다 ${JSON.stringify(probe)}`).not.toBeNull();
  /* ★★★본 단언 — ★틀 밖으로 나간 ★그 polygon 이 ★★안 잡힌다 = ★★잘린다 */
  expect(probe.hitId, `★★틀 ★밖으로 ★나간 점이 ★★보인다(★안 자른다) — ${JSON.stringify(probe)}`)
    .not.toBe('probe-outside');
});
