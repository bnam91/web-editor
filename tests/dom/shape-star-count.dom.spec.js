/* shape-star-count.dom.spec.js — ⑴ 별 도형 우측 패널의 «갯수»
 * (현빈 2026-10-06 「우측패널에 갯수추가하기하면 별 갯수가 여러개 추가되게 해줄래?」
 *  판정 2026-10-06: 한 블록 안에 별 N개 ＋ 늘리면 블록이 옆으로 넓어진다(별 크기 유지).
 *  이미지 채우기는 갯수>1 에서 비활성 ＋ 까닭을 화면에 적는다 — 지디 승인)
 *
 * ★양성대조 판 = e7444dd3(고치기 전) → `GD1001_ROOT=<그 판 체크아웃> ...` 로 돌린 ★실측 명부
 *   (2026-10-06 · ⛔「명부 ⊇ 실패집합」이고 ★명부 밖 0건이다):
 *     빨강 = S1 · S2 · S3 · S4b · S5 · S5b · S6      (새로 생긴 것 전부)
 *     초록 = S4 · S7                                  (★지키는 검사 — 안 바꾼 길)
 *   그 판 실측: 별 패널 라벨 전수 = 색상·외곽선·두께·W·H·꼭짓점·회전° ⇒ 「갯수」 0건.
 *   ⚠️S4 안에 처음엔 교차(꼭짓점7 × 갯수3)가 들어 있어 「지키는 검사」라는 ★이름이 핀에서 거짓이 됐다
 *     ⇒ 그 부분을 S4b 로 떼어냈다. 이름이 조건을 말하면 이름째 거짓이 될 수 있다.
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const OLD_POINTS = '100,8 122,70 188,70 135,110 155,172 100,132 45,172 65,110 12,70 78,70';
const SEC = `<div class="section-block" id="sA" data-section="1" data-name="A" data-bg="#ffffff" style="background:#fff;">
  <div class="section-hitzone"><span class="section-label">A</span></div><div class="section-inner"></div></div>`;

async function setup(page, shapeType = 'star') {
  await page.setViewportSize({ width: 1500, height: 900 });
  await bootApp(page);
  await page.evaluate(([html, type]) => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', html);
    window.rebindAll?.(); window.deselectAll?.();
    window.selectSection?.(document.getElementById('sA'));
    window.addShapeBlock?.(type);
  }, [SEC, shapeType]);
  await page.waitForTimeout(400);
  return page.evaluate(() => {
    const blk = document.querySelector('#canvas .shape-block');
    window.showShapeProperties?.(blk);
    return blk.id;
  });
}

const snap = (page) => page.evaluate(() => {
  const blk = document.querySelector('#canvas .shape-block');
  const svg = blk.querySelector('svg');
  const frame = blk.closest('.frame-block');
  const panel = document.getElementById('prop-panel') || document.body;
  return {
    id: blk.id, shapeType: blk.dataset.shapeType,
    starPoints: blk.dataset.starPoints ?? null,
    starCount: blk.dataset.starCount ?? null,
    viewBox: svg?.getAttribute('viewBox'),
    polys: [...svg.querySelectorAll('polygon')].map(p => p.getAttribute('points')),
    frameW: parseInt(frame?.style.width) || parseInt(frame?.dataset.width) || null,
    shapeBlocksInCanvas: document.querySelectorAll('#canvas .shape-block').length,
    labels: [...panel.querySelectorAll('.prop-label')].map(e => e.textContent.trim()),
    hint: document.getElementById('shape-star-count-hint')?.textContent.trim() || null,
    cpModes: document.getElementById('shape-color-color')?.dataset.cpModes || null,
    cpNote: document.getElementById('shape-color-color')?.dataset.cpModesNote || null,
    shapeFill: blk.dataset.shapeFill ?? null,
  };
});

/** 「갯수」 숫자칸에 값을 넣는다(사람이 타이핑하는 길 — input ＋ change). */
async function setCount(page, v) {
  await page.evaluate((v) => {
    const n = document.getElementById('shape-star-count-num');
    if (!n) throw new Error('shape-star-count-num 이 없다');
    n.value = String(v);
    n.dispatchEvent(new Event('input', { bubbles: true }));
    n.dispatchEvent(new Event('change', { bubbles: true }));
  }, v);
  await page.waitForTimeout(300);
}

test('S1 ★별 패널에 「갯수」 칸이 있다 (1~10 · 기본 1)', async ({ page }) => {
  const id = await setup(page);
  expect(id, '★전제 — 도형 블록이 생겼다').toMatch(/^shp_/);
  const s = await snap(page);
  expect(s.shapeType, '★전제 — 별이다').toBe('star');
  expect(s.labels, `패널 라벨 전수 (잰 값: ${JSON.stringify(s.labels)})`).toContain('갯수');
  const inp = await page.evaluate(() => {
    const n = document.getElementById('shape-star-count-num');
    const r = document.getElementById('shape-star-count-slider');
    return n && r ? { min: n.min, max: n.max, v: n.value, rMin: r.min, rMax: r.max, rStep: r.step } : null;
  });
  expect(inp, '숫자칸·슬라이더 쌍').not.toBeNull();
  expect(inp).toEqual({ min: '1', max: '10', v: '1', rMin: '1', rMax: '10', rStep: '1' });
});

test('S2 ★갯수 3 → polygon 3개 · viewBox 3배 · ★블록은 여전히 1개(복제 아님)', async ({ page }) => {
  await setup(page);
  const before = await snap(page);
  // ★전제 단언 — 시작이 별 1개다(아니면 아래 「3개」가 무엇을 잰 것인지 알 수 없다)
  expect(before.polys.length, `시작 polygon 수 (잰 값: ${before.polys.length})`).toBe(1);
  expect(before.viewBox, '시작 viewBox').toBe('0 0 200 190');

  await setCount(page, 3);
  const s = await snap(page);
  expect(s.polys.length, `polygon 수 (잰 값: ${s.polys.length})`).toBe(3);
  expect(s.viewBox, `viewBox (잰 값: ${s.viewBox})`).toBe('0 0 600 190');
  expect(s.starCount, 'dataset.starCount').toBe('3');
  expect(s.shapeBlocksInCanvas, '★블록 수는 그대로 1 — 복제가 아니다').toBe(1);
  // i 번째 별은 가로로 200·i 만큼만 옮겨졌다 — 첫 x 좌표로 확인
  const firstX = s.polys.map(p => Number(p.split(' ')[0].split(',')[0]));
  expect(firstX, `각 별의 첫 x (잰 값: ${JSON.stringify(firstX)})`).toEqual([100, 300, 500]);
});

test('S3 ★갯수를 늘리면 블록이 «옆으로» 넓어진다(별 크기 유지) · 줄이면 되돌아온다', async ({ page }) => {
  await setup(page);
  const w1 = (await snap(page)).frameW;
  expect(w1, `시작 폭 (잰 값: ${w1})`).toBe(100);   // ★전제 단언 — addShapeBlock 기본 100×100

  await setCount(page, 3);
  const w3 = (await snap(page)).frameW;
  expect(w3, `갯수 3 뒤 폭 (잰 값: ${w3} · 시작 ${w1})`).toBe(300);

  await setCount(page, 2);
  expect((await snap(page)).frameW, '갯수 2 로 줄인 뒤 폭').toBe(200);
  await setCount(page, 1);
  expect((await snap(page)).frameW, '갯수 1 로 되돌린 뒤 폭').toBe(100);
});

test('S4 ★지키는 검사 — 갯수 1 은 옛 별과 바이트 동일 · 꼭짓점은 그대로 돈다', async ({ page }) => {
  await setup(page);
  const s0 = await snap(page);
  expect(s0.viewBox, 'viewBox').toBe('0 0 200 190');
  expect(s0.polys, 'points 가 옛 문자열과 바이트 동일').toEqual([OLD_POINTS]);
  expect(s0.starCount, '갯수 dataset 은 안 쓴다(없으면 1)').toBeNull();

  // 꼭짓점 5 → 7 : polygon 1개 그대로 · 좌표쌍 14 · viewBox 불변
  await page.evaluate(() => {
    const n = document.getElementById('shape-star-num');
    n.value = '7';
    n.dispatchEvent(new Event('input', { bubbles: true }));
    n.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.waitForTimeout(250);
  const s1 = await snap(page);
  expect(s1.polys.length, 'polygon 수').toBe(1);
  expect(s1.polys[0].trim().split(/\s+/).length, `좌표쌍 수 (잰 값: ${s1.polys[0].trim().split(/\s+/).length})`).toBe(14);
  expect(s1.starPoints, 'dataset.starPoints').toBe('7');
  expect(s1.viewBox, 'viewBox 불변').toBe('0 0 200 190');

});

/* ★S4 에서 «떼어냈다»(2026-10-06): 이 교차는 ★새 기능이라 핀 e7444dd3 에서 빨강이다.
   S4 안에 두었더니 「지키는 검사」라 이름 붙인 것이 핀에서 빨강이 되어 ★이름이 거짓이 됐다. */
test('S4b ★꼭짓점과 갯수가 «한 자리»에서 쓰인다 — 꼭짓점 7 인 채로 갯수 3', async ({ page }) => {
  await setup(page);
  await page.evaluate(() => {
    const n = document.getElementById('shape-star-num');
    n.value = '7';
    n.dispatchEvent(new Event('input', { bubbles: true }));
    n.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.waitForTimeout(250);
  // ★전제 단언 — 꼭짓점이 실제로 7 이 됐다(아니면 아래 「14」가 무엇을 잰 것인지 모른다)
  const s1 = await snap(page);
  expect(s1.starPoints, `dataset.starPoints (잰 값: ${s1.starPoints})`).toBe('7');
  expect(s1.polys[0].trim().split(/\s+/).length, '꼭짓점 7 = 좌표쌍 14').toBe(14);

  await setCount(page, 3);
  const s2 = await snap(page);
  expect(s2.polys.length, '별 3개').toBe(3);
  expect(s2.viewBox, 'viewBox 3배').toBe('0 0 600 190');
  s2.polys.forEach((p, i) => {
    expect(p.trim().split(/\s+/).length, `별 ${i} 좌표쌍 — 꼭짓점 7 이 유지된다`).toBe(14);
  });
  expect(s2.starPoints, '꼭짓점 dataset 도 유지').toBe('7');
});

test('S5 ★갯수>1 이면 이미지 채우기가 닫히고 ★까닭이 화면에 적힌다', async ({ page }) => {
  await setup(page);
  const s1 = await snap(page);
  // ★전제 단언 — 별 1개에선 이미지 채우기가 열려 있다
  expect(s1.cpModes, `갯수 1 의 cpModes (잰 값: ${s1.cpModes})`).toBe('solid,gradient,image');
  /* ★★2026-10-11(현빈 「힌트 두 줄 삭제」 · 지디 조건 ⒜·⒞) — ★패널 ★힌트 줄은 ★지웠다.
     ★★설명은 ★사라지지 ★않았다: ★`cpModesNote`(★위 :180 이 ★잠근다)와 ★`showToast` 가 ★떠맡는다
     ⇒ ★★그래서 ★이 단언의 ★과녁을 ★★«이제 ★항상 ★없다»로 ★옮긴다(⛔지우지 ★않는다). */
  expect(s1.hint, '★패널 힌트는 ★지웠다 — ★갯수 1 에서도 ★없다').toBeNull();

  await setCount(page, 3);
  const s3 = await snap(page);
  expect(s3.cpModes, `갯수 3 의 cpModes (잰 값: ${s3.cpModes})`).toBe('solid,gradient');
  expect(s3.cpNote, `까닭 (잰 값: ${s3.cpNote})`).toBe('별이 여러 개면 이미지 채우기를 쓸 수 없습니다.');
  /* ★★여기가 ★★이 작업의 ★핵이다 — ★옛 단언은 ★「★패널에 ★그 글이 ★적혔나」였다.
     ★★그 글을 ★지웠으므로 ★★«없다»로 ★겨눈다. ★★그런데 ★★«설명이 ★사라졌나»는 ★★다른 물음이고,
     ★★그건 ★★바로 ★위 줄(`cpNote`)이 ★★여전히 ★잠근다 ⇒ ★★둘을 ★나란히 ★둬야 ★뜻이 선다. */
  expect(s3.hint, '★패널 힌트는 ★지웠다 — ★설명은 ★위 cpNote 가 ★떠맡는다').toBeNull();

  // ★갯수 1 로 되돌리면 다시 열린다(한 방향으로만 닫히지 않는다)
  await setCount(page, 1);
  const back = await snap(page);
  expect(back.cpModes, '되돌린 뒤 cpModes').toBe('solid,gradient,image');
  expect(back.cpNote, `되돌린 뒤 까닭은 지워진다 (잰 값: ${JSON.stringify(back.cpNote)})`).toBeFalsy();
});

test('S5b ★이미지가 이미 걸려 있을 때 갯수를 올리면 ★조용히 반쪽이 되지 않고 풀린다', async ({ page }) => {
  await setup(page);
  const PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const ok = await page.evaluate((src) => {
    const blk = document.querySelector('#canvas .shape-block');
    window._applyShapeImage ? window._applyShapeImage(blk, src, 'cover') : (() => {
      const d = document.createElement('div'); d.className = 'shape-img-fill';
      d.style.cssText = `position:absolute;inset:0;background-image:url("${src}")`;
      blk.insertBefore(d, blk.firstChild);
      blk.dataset.shapeFill = 'image'; blk.dataset.shapeImage = '1';
      const svg = blk.querySelector('svg'); if (svg) svg.style.fill = 'transparent';
      window._syncShapeImageClip?.(blk);
    })();
    window.showShapeProperties?.(blk);
    return blk.dataset.shapeFill === 'image' && !!blk.querySelector(':scope > .shape-img-fill');
  }, PX);
  expect(ok, '★전제 — 이미지 채우기가 실제로 걸렸다').toBe(true);

  await setCount(page, 3);
  const s = await snap(page);
  expect(s.shapeFill, `갯수 3 뒤 shapeFill (잰 값: ${s.shapeFill})`).toBeNull();
  const leftover = await page.evaluate(() => document.querySelectorAll('#canvas .shape-block > .shape-img-fill').length);
  expect(leftover, '사진 레이어가 남아 있지 않다').toBe(0);
  expect(s.polys.length, '별 3개는 그대로 생겼다').toBe(3);
});

test('S6 ★타입을 사각형으로 바꾸면 갯수가 되돌아간다(SVG 와 dataset 이 안 어긋난다)', async ({ page }) => {
  await setup(page);
  await setCount(page, 4);
  expect((await snap(page)).polys.length, '★전제 — 별 4개').toBe(4);

  const res = await page.evaluate(() => {
    const blk = document.querySelector('#canvas .shape-block');
    return window.updateShapeBlock?.(blk.id, { shapeType: 'rectangle' }) ?? null;
  });
  expect(res && res.ok, `updateShapeBlock 결과 (잰 값: ${JSON.stringify(res)})`).toBe(true);
  await page.waitForTimeout(250);
  const s = await snap(page);
  expect(s.shapeType, '타입').toBe('rectangle');
  expect(s.starCount, 'dataset.starCount 는 지워졌다').toBeNull();
  expect(s.starPoints, 'dataset.starPoints 도 지워졌다').toBeNull();
  expect(s.viewBox, 'viewBox 는 사각형 기본').toBe('0 0 100 100');
  expect(s.polys.length, 'polygon 0개(사각형)').toBe(0);
});

test('S7 ★지키는 검사 — 사각형 패널엔 「갯수」가 없다(별 전용)', async ({ page }) => {
  await setup(page, 'rectangle');
  const s = await snap(page);
  expect(s.shapeType, '★전제').toBe('rectangle');
  expect(s.labels, `패널 라벨 전수 (잰 값: ${JSON.stringify(s.labels)})`).not.toContain('갯수');
  expect(s.labels, '꼭짓점도 없다').not.toContain('꼭짓점');
});
