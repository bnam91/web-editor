/* grid-badge-radius.dom.spec.js — 알약(배경색 준 글자 줄) ★둥글기 손잡이 (현빈 2026-10-07 「만들라고 했어」)
 *
 * ★무엇이 없었나 — 알약은 `line.radius` 를 ★이미 읽는데(7dc54091:js/blocks/grid-block.js:2427)
 *   패널에 ★그 값을 주는 손잡이가 ★0개였다. radius 입력은 ★셋뿐이고 전부 ★다른 것이었다
 *   (grd-img-radius=이미지 줄 · grd-cellall-radius · grd-cell-radius=칸).
 * ★새 필드 ★0 — `radius` 는 이미 `GRID_LINE_FIELDS`(34)에 있고 `patchCell` 이 그 명부로 검문한다.
 *
 * ⚠️★★이 spec 의 ★음성대조(B4)는 ★«현장 대상이 0» 이다 — 꼭 읽어라.
 *   ★실측(2026-10-07 · 현빈 `proj_1791204636612` 를 ★사본으로 세고 사본은 지웠다):
 *     ★알약 ★★0개 (그려진 HTML 0 · 모델 0 — ★두 자 일치) · 빈 이미지 슬롯 20
 *   ⇒ ★★그러니 「현빈 프로젝트의 ★기존 알약이 안 바뀐다」의 ★근거는 ★★이 검사가 ★아니라 ★★그 수(0)다.
 *     ★이 검사는 ★판을 ★내가 지어서 잰다 ⇒ ★★그 초록을 ★「현장을 쟀다」로 ★읽지 마라.
 *   ⇒ ★현빈은 ★«있는 알약을 고치려고» 물은 게 아니라 ★«앞으로 만들» 알약의 손잡이를 요구했다.
 *
 * ⚠️★★그리고 ★기댓값을 ★제품 상수에서 ★읽어 오지 ★않는다 — 그러면 식이 ★「상수 == 상수」 ★항등식이 되어
 *   ★아무것도 안 잠근다. ⇒ ★값은 ★손으로 박고(오늘의 값 999) · ★불변식(placeholder == 렌더 폴백)은 ★따로 건다.
 *   (2026-10-07 에 레인 ★넷이 각각 그 함정을 밟았다 — 그 처방이 이 줄이다.)
 *
 * ⛔못 재는 축: ★내보내기(단독 HTML·피그마)가 이 값을 싣는가 — ★별도 검사. 여긴 ★캔버스·패널·모델까지.
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js tests/dom/grid-badge-radius.dom.spec.js
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

/** 첫 칸에 글자 줄 하나. `bg` 를 주면 그 줄이 ★알약이 된다(7dc54091:grid-block.js:2428 `if (bg)`). */
async function build(page, line) {
  await page.evaluate((line) => {
    document.getElementById('canvas').innerHTML =
      `<div class="section-block" id="s" data-section="1">
         <div class="section-hitzone"><span class="section-label">S</span></div>
         <div class="section-inner" id="in" style="padding-left:60px;padding-right:60px"></div></div>`;
    const { row, block } = window.makeGridBlock({});
    document.getElementById('in').appendChild(row);
    block.id = 'G';
    const m = window.getGridModel(block);
    m.cols[0].lines = [line];
    block.dataset.cols = JSON.stringify(m.cols);
    window.renderGridBlock(block);
    window.showGridProperties?.(block, { r: 0, c: 0, li: 0 });
  }, line);
  await page.waitForTimeout(120);
}

const read = (page) => page.evaluate(() => {
  const b = document.getElementById('G');
  const badge = b.querySelector('.grd-badge');
  const inp = document.getElementById('grd-badge-radius');
  return {
    badgeExists: !!badge,
    rendered: badge ? getComputedStyle(badge).borderRadius : null,
    inline: badge ? badge.getAttribute('style') || '' : null,
    inputExists: !!inp,
    placeholder: inp ? inp.getAttribute('placeholder') : null,
    value: inp ? inp.value : null,
    max: inp ? inp.getAttribute('max') : null,
    modelRadius: (window.getGridModel(b).cols[0].lines[0] || {}).radius ?? null,
  };
});

test('B1 ★미설정 알약 — 완전 둥글게 그려지고 ★패널이 ★그 수를 placeholder 로 말한다', async ({ page }) => {
  await bootApp(page);
  await build(page, { type: 'body', text: '알약', bg: '#2d6fe8' });
  const r = await read(page);
  expect(r.badgeExists, '전제 — bg 를 주면 알약이 생긴다').toBe(true);
  expect(r.modelRadius, '전제 — 모델엔 radius 가 ★없다(미설정)').toBe(null);
  /* ★오늘의 값을 ★손으로 박는다 — ⛔제품 상수를 읽어 오면 항등식이다(머리말). */
  expect(r.rendered, `★미설정 알약의 «오늘» 폴백(받은 값 ${r.rendered})`).toBe('999px');
  expect(r.inputExists, '★손잡이가 없다 — 이 건의 요구가 그것이다').toBe(true);
  expect(r.placeholder, `★placeholder(${r.placeholder}) 가 렌더 폴백(${r.rendered}) 과 다르다`).toBe('999');
  /* ★불변식 — 패널이 하는 말 == 캔버스가 그리는 것 (값이 바뀌면 ★위 전제가 먼저 울린다) */
  expect(`${r.placeholder}px`, '★둘이 어긋났다').toBe(r.rendered);
  expect(r.value, '미설정이면 입력칸은 ★비어 있다(placeholder 가 보이게)').toBe('');
  expect(r.max, '★상한은 999 — ⛔40 같은 수로 좁히지 않는다').toBe('999');
});

test('B2 ★손으로 주면 ★그 값이 이긴다 — 0 이면 ★모난 네모', async ({ page }) => {
  await bootApp(page);
  await build(page, { type: 'body', text: '알약', bg: '#2d6fe8', radius: 0 });
  const zero = await read(page);
  expect(zero.rendered, `★0 인데 안 모났다 — 받은 값 ${zero.rendered}`).toBe('0px');
  expect(zero.value, '입력칸이 그 값을 보여야 한다').toBe('0');

  await build(page, { type: 'body', text: '알약', bg: '#2d6fe8', radius: 12 });
  const twelve = await read(page);
  expect(twelve.rendered, `★12 가 안 먹었다 — 받은 값 ${twelve.rendered}`).toBe('12px');
  expect(twelve.modelRadius, '모델에도 그 값이 있다').toBe(12);
});

test('B3 ★패널에서 고치면 ★모델·화면이 ★같이 따라온다 (patchCell 과 같은 병합 길)', async ({ page }) => {
  await bootApp(page);
  await build(page, { type: 'body', text: '알약', bg: '#2d6fe8' });
  await page.fill('#grd-badge-radius', '20');
  await page.dispatchEvent('#grd-badge-radius', 'change');
  await page.waitForTimeout(150);
  const r = await read(page);
  expect(r.modelRadius, `★모델에 안 들어갔다 — 받은 값 ${r.modelRadius}`).toBe(20);
  expect(r.rendered, `★화면이 안 따라왔다 — 받은 값 ${r.rendered}`).toBe('20px');

  /* ★비우면 ★«미설정»으로 되돌아간다 ⇒ 렌더러가 다시 폴백을 쓴다(= 되돌릴 길이 있다) */
  await page.fill('#grd-badge-radius', '');
  await page.dispatchEvent('#grd-badge-radius', 'change');
  await page.waitForTimeout(150);
  const back = await read(page);
  expect(back.modelRadius, `★비웠는데 키가 남았다 — 받은 값 ${back.modelRadius}`).toBe(null);
  expect(back.rendered, `★비웠는데 폴백으로 안 돌아갔다 — 받은 값 ${back.rendered}`).toBe('999px');
});

test('B4 ★음성대조 — ★배경이 없으면 ★칸 자체가 ★없다(아무것도 안 하는 칸을 안 만든다)', async ({ page }) => {
  await bootApp(page);
  await build(page, { type: 'body', text: '그냥 글자' });          // ★bg 없음
  const none = await read(page);
  expect(none.badgeExists, '전제 — bg 가 없으면 알약이 ★안 생긴다').toBe(false);
  expect(none.inputExists, '★알약이 없는데 둥글기 칸이 떴다 — «조용히 아무 일 없음»을 만든다').toBe(false);

  // ★그리고 ★배경을 주면 ★생긴다 — 「없다」가 «항상 없다»가 아님을 같이 잰다
  await build(page, { type: 'body', text: '그냥 글자', bg: '#888888' });
  const some = await read(page);
  expect(some.inputExists, '★배경을 줬는데 칸이 안 생긴다').toBe(true);
});

test('B5 ★이미지 줄의 radius 와 ★섞이지 않는다 — 입력칸이 ★따로다', async ({ page }) => {
  await bootApp(page);
  await build(page, { type: 'image', imgSrc: '' });               // ★이미지 줄
  const img = await page.evaluate(() => ({
    badgeInput: !!document.getElementById('grd-badge-radius'),
    imgInput: !!document.getElementById('grd-img-radius'),
  }));
  expect(img.imgInput, '전제 — 이미지 줄엔 이미지 radius 칸이 뜬다').toBe(true);
  expect(img.badgeInput, '★이미지 줄에 ★알약 칸이 떴다 — 절이 안 갈렸다').toBe(false);
});
