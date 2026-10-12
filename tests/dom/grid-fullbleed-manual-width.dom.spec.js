/* grid-fullbleed-manual-width.dom.spec.js — T5-⒜ ＋ T4④-⒝ (현빈 2026-10-07 · 지디 판정)
 *
 * ★T5 현빈 원문: 「그리드블럭 우측 패널에서 ★패딩제외를 했는데, 캔버스에서 블럭 ★모서리 핸들
 *   조작했더니 ★패딩제외가 풀려버린다」
 * ★판정 ⒜(지디) — ⛔설계는 안 바꾼다. `grid-block.js` 의 「명시 폭이 이긴다 · 둘은 같이 설 수 없다」는
 *   까닭이 ★살아 있다(현빈 2026-10-01 `grd_ts0he_lvy913j` 「왼쪽은 붙고 오른쪽만 패딩」).
 *   ⇒ 고치는 것은 ★«안 알려 준 것»이다: 효과는 사라졌는데 표식·패널 체크가 ★켜진 채였다.
 *
 * ★고치기 «전» 판에서 ★내가 직접 잰 값(2026-10-07 · 이 단언들의 근거):
 *     패딩제외 ON → 리사이즈(500) 뒤
 *       dataset.fullBleed  true → ★true      패널 체크 checked → ★true
 *       음수마진 -32px → (없음)               폭 calc(100%+64px) → 500px
 *   ⇒ ★그래서 F1 은 「둘이 ★같이 꺼진다」를 잰다. ⛔하나만 재면 「DOM 은 껐는데 패널만 켜진」 새 거짓말이 산다.
 *
 * ★자리: 「사람이 정한 폭」 세 문 — applyGridOwnWidth(핸들·패널 슬라이더) · fitGridWidthToFreeFrame(명시) ·
 *   updateGridBlock{width}(MCP·API). ⛔자동 폭(gridWidthAuto)에서는 ★안 끈다 — F4 가 그걸 잠근다.
 *
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js tests/dom/grid-fullbleed-manual-width.dom.spec.js
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

/** 섹션(좌우 패딩 60) 안에 그리드 하나 — 패딩제외가 «뺄 패딩»을 가지려면 섹션 안이어야 한다. */
async function setup(page) {
  await bootApp(page);
  await page.evaluate(() => {
    document.getElementById('canvas').innerHTML =
      `<div class="section-block" id="fbSec" data-section="1">
         <div class="section-hitzone"><span class="section-label">S</span></div>
         <div class="section-inner" id="fbIn" style="padding-left:60px;padding-right:60px"></div>
       </div>`;
    const { row, block } = window.makeGridBlock({});
    document.getElementById('fbIn').appendChild(row);
    block.id = 'fbGrid';
    window.renderGridBlock(block);
  });
}

/** 패딩제외를 «제품이 쓰는 그 길»로 켠다(dataset ＋ 공용 헬퍼) ＋ 패널을 연다. */
const turnOn = (page) => page.evaluate(() => {
  const b = document.getElementById('fbGrid');
  b.dataset.fullBleed = 'true';
  window.applyBlockFullBleed(b);
  window.showGridProperties?.(b);
});

const read = (page) => page.evaluate(() => {
  const b = document.getElementById('fbGrid');
  const cb = document.getElementById('grd-use-padx');
  return {
    fullBleed: b.dataset.fullBleed ?? null,
    gridWidth: b.dataset.gridWidth ?? null,
    gridWidthAuto: b.dataset.gridWidthAuto ?? null,
    marginL: b.style.marginLeft || '',
    width: b.style.width || '',
    checkbox: cb ? cb.checked : null,
  };
});

test('F1 ★리사이즈(사람) — dataset 과 패널 체크가 ★같이 꺼진다 (둘을 한 단언에)', async ({ page }) => {
  await setup(page);
  await turnOn(page);
  const before = await read(page);
  // ★전제 — 켰을 때 ★실제로 먹었다. 안 먹었으면 아래 비교가 공허하다.
  expect(before.fullBleed, '전제 — 표식이 켜졌다').toBe('true');
  expect(before.checkbox, '전제 — 패널 체크가 켜졌다').toBe(true);
  expect(before.marginL, `전제 — 음수마진이 붙었다(받은 값 ${before.marginL})`).toMatch(/-\d+px/);
  expect(before.width, `전제 — calc 폭이 붙었다(받은 값 ${before.width})`).toContain('calc');

  // ★사람이 폭을 정한다 — 핸들과 패널 슬라이더가 ★같이 쓰는 그 문 하나
  await page.evaluate(() => window.applyGridOwnWidth(document.getElementById('fbGrid'), 500));
  const after = await read(page);

  expect(after.fullBleed, `★표식이 안 꺼졌다 — 받은 값 ${after.fullBleed}`).toBe('false');
  expect(after.checkbox, `★패널 체크가 안 꺼졌다 — 받은 값 ${after.checkbox} (DOM 만 끄면 새 거짓말이다)`).toBe(false);
  expect(after.marginL, `음수마진은 걷힌다 — 받은 값 ${after.marginL}`).toBe('');
  expect(after.gridWidth, '명시 폭이 섰다').toBe('500');
});

test('F2 ★음성대조 — 리사이즈를 ★안 하면 체크는 ★켜진 채다(사용자 것을 안 뺏는다)', async ({ page }) => {
  await setup(page);
  await turnOn(page);
  // ★폭과 무관한 일을 시킨다 — 다시 그리기만
  await page.evaluate(() => window.renderGridBlock(document.getElementById('fbGrid')));
  const r = await read(page);
  expect(r.fullBleed, `★안 건드렸는데 꺼졌다 — 받은 값 ${r.fullBleed}`).toBe('true');
  expect(r.checkbox, `★안 건드렸는데 패널 체크가 꺼졌다 — 받은 값 ${r.checkbox}`).toBe(true);
  expect(r.marginL, '효과도 그대로다').toMatch(/-\d+px/);
});

test('F3 ★같은 문을 ★MCP·API 로 지나도 같다 — updateGridBlock{width}', async ({ page }) => {
  await setup(page);
  await turnOn(page);
  await page.evaluate(() => window.updateGridBlock('fbGrid', { width: 420 }));
  const r = await read(page);
  expect(r.gridWidth, '폭이 섰다').toBe('420');
  expect(r.fullBleed, `★API 길에서는 안 꺼졌다 — 받은 값 ${r.fullBleed}`).toBe('false');

  /* ★width:null(자동으로 되돌리기)은 ⛔끄지 않는다 — 그때는 ownW===null 로 가 패딩제외가 되살아나야 맞다.
     ⇒ 다시 켜고 null 을 주면 표식이 ★살아 있어야 한다. */
  await page.evaluate(() => {
    const b = document.getElementById('fbGrid');
    b.dataset.fullBleed = 'true';
    window.updateGridBlock('fbGrid', { width: null });
  });
  const back = await read(page);
  expect(back.gridWidth, 'width:null 이면 키가 지워진다').toBe(null);
  expect(back.fullBleed, `★width:null 은 «끄는 일»이 아니다 — 받은 값 ${back.fullBleed}`).toBe('true');
  expect(back.marginL, '되돌아오면 효과도 돌아온다').toMatch(/-\d+px/);
});

test('F4 ⛔★자동 폭에서는 ★안 끈다 — 프레임에 맞춘 것은 «사람이 한 일»이 아니다', async ({ page }) => {
  await setup(page);
  await turnOn(page);
  const n = await page.evaluate(() => {
    const b = document.getElementById('fbGrid');
    /* 자동 가지를 ★직접 재현한다 — fitGridWidthToFreeFrame 의 auto 길이 쓰는 두 키 그대로.
       (자유 프레임을 띄우는 대신 그 길의 «결과 상태»를 세워 규약을 잰다 — 끄는 자가 없어야 한다.) */
    b.dataset.gridWidth = '300';
    b.dataset.gridWidthAuto = '1';
    window.renderGridBlock(b);
    return b.dataset.fullBleed;
  });
  expect(n, `★자동 폭인데 표식이 꺼졌다 — 받은 값 ${n} (사용자 것을 소리 없이 뺏는다)`).toBe('true');

  // ★그리고 자동 폭이 «지워지면» 패딩제외가 되살아난다(그게 자동 길의 계약이다)
  const back = await page.evaluate(() => {
    const b = document.getElementById('fbGrid');
    delete b.dataset.gridWidth; delete b.dataset.gridWidthAuto;
    window.renderGridBlock(b);
    return { fb: b.dataset.fullBleed, ml: b.style.marginLeft };
  });
  expect(back.fb, '자동 폭이 지워지면 표식은 그대로').toBe('true');
  expect(back.ml, `자동 폭이 지워지면 효과가 돌아온다 — 받은 값 ${back.ml}`).toMatch(/-\d+px/);
});

test('R1 ★T4④-⒝ — 패널 placeholder 가 ★렌더러 폴백과 ★같은 수다(명부 하나에서 파생)', async ({ page }) => {
  await setup(page);
  const r = await page.evaluate(() => {
    const b = document.getElementById('fbGrid');
    // 빈 이미지 줄 하나를 첫 칸에 둔다
    window.updateGridBlock('fbGrid', { cells: null });
    const m = window.getGridModel(b);
    m.cols[0].lines = [{ type: 'image', imgSrc: '' }];
    b.dataset.cols = JSON.stringify(m.cols);
    window.renderGridBlock(b);
    const el = b.querySelector('.grd-img-empty');
    const rendered = el ? getComputedStyle(el).borderRadius : null;
    // 그 줄을 패널에 띄운다
    window.showGridProperties?.(b, { r: 0, c: 0, li: 0 });
    const inp = document.getElementById('grd-img-radius');
    return { rendered, placeholder: inp ? inp.getAttribute('placeholder') : null, exists: !!inp };
  });
  expect(r.exists, '전제 — 이미지 줄 패널이 떴다').toBe(true);
  /* ★전제 — «오늘의 값»을 ★손으로 박는다. ⛔제품 상수를 읽어 와서 견주지 마라:
       그러면 식이 ★항등식이 되어(「상수 == 상수」) ★아무것도 안 잠근다.
     ★2026-10-07 현빈 ★직접 결정 「0으로 하자」 ⇒ 폴백이 ★8 → ★0 이 됐다(그의 프로젝트 빈 슬롯 ★20개가 바뀐다). */
  expect(r.rendered, `전제 — 빈 슬롯의 «오늘» 폴백(받은 값 ${r.rendered})`).toBe('0px');
  /* ★핵심 — 패널이 하는 말 == 캔버스가 그리는 것. ⛔둘이 다르면 현빈의 「설정 안 했는데 왜?」가 다시 난다.
     ★그래서 ★둘을 ★나란히 단언한다 — 값이 바뀌면 ★위 전제가 먼저 울려 「따라와라」를 말한다. */
  expect(r.placeholder, `★패널 placeholder(${r.placeholder}) 가 렌더 폴백(${r.rendered}) 과 다르다`).toBe('0');
  expect(`${r.placeholder}px`, '★둘이 어긋났다').toBe(r.rendered);
});
