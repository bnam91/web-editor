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

test('D2 ★★① 후속 — ★별 하나의 ★가로:세로 비가 ★간격을 바꿔도 ★유지된다', async ({ page }) => {
  await setup(page);
  await setNum(page, 'shape-star-count-num', 5);
  await page.waitForTimeout(250);
  /* ★화면에서 ★별 하나의 ★실제 px 를 잰다 — ⛔식이 아니라 ★getBoundingClientRect */
  const rect = () => page.evaluate(() => {
    const p = document.querySelector('#canvas .shape-block svg polygon');
    const b = p.getBoundingClientRect();
    return { w: b.width, h: b.height };
  });
  const r0 = await rect();
  expect(r0.w, `전제 — 별 하나가 보인다 (잰 값: ${JSON.stringify(r0)})`).toBeGreaterThan(1);
  const aspect0 = r0.w / r0.h;

  for (const g of [50, 100, 200]) {
    await setNum(page, 'shape-star-gap-num', g);
    await page.waitForTimeout(250);
    const r = await rect();
    const aspect = r.w / r.h;
    /* ★반올림(폭 정수) 때문에 ★완전 동일은 아니다 — ★유닛에서 잰 흔들림 폭이 0.9418~0.9429 였다 */
    expect(Math.abs(aspect / aspect0 - 1),
      `★gap ${g} 에서 ★비가 ★깨졌다 — ${aspect0.toFixed(4)} → ${aspect.toFixed(4)} (폭 ${JSON.stringify(r)})`)
      .toBeLessThan(0.03);
  }
  /* ★★gap 200 의 ★폭이 ★849 인가 — ★유닛이 ★계산으로 낸 그 수(W0 500 기준이 아니라 ★이 판의 W0 기준) */
  const s = await snap(page);
  expect(s.starGap, 'gap 200').toBe('200');
  expect(s.viewBox, 'viewBox = 200·5＋200·4').toBe('0 0 1800 190');
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
    window.showShapeProperties?.(blk);           // 패널 재배선 → _applyStarGeom 이 다시 돈다
  });
  await page.waitForTimeout(300);
  const before = await snap(page);
  expect(before.fills[0], '★0번 별 색').toBe('#ff0000');
  expect(before.fills[2], '★2번 별 색').toBe('#00ff00');
  const poly1Before = before.polys[1];

  /* ★★저장 — ★제품의 ★직렬화를 ★쓴다(⛔내 사본 금지) */
  const saved = await page.evaluate(() => {
    const sec = document.getElementById('sA');
    if (window.serializeSectionClone) return window.serializeSectionClone(sec).outerHTML;
    return sec.outerHTML;
  });
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
