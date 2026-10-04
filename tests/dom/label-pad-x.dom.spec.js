/* label-pad-x.dom.spec.js — 0 B3 (2026-10-03, 현빈 「라벨텍스트 블럭 — 좌우 패딩 조절, 지금 안 되는 것으로 보임」)
 *
 * 대상 = 도구막대 Text ▸ 「Label」(addTextBlock('label')) 이 만드는 `.text-block[data-type="label"] > .tb-label` 알약.
 * 측정(고치기 전, 604602cd): 패널엔 「왼쪽 패딩/오른쪽 패딩」(L/R)이 있었지만 그건 «바깥» .text-block 에 쓴다 —
 *   알약 «안쪽» padding(36px)·알약 폭은 그대로. 가운데 정렬 라벨은 양쪽이 같아 «아무 일도 안 일어난 것»처럼 보인다.
 * 고침: Padding 섹션에 「좌우 패딩」(sliderRowHTML — 섹션·프레임과 같은 말·같은 꼴) 한 줄 → .tb-label 안쪽 padding-left/right.
 *
 * ★진짜 패널·진짜 입력으로 누르고 getComputedStyle·getBoundingClientRect 로 잰다.
 * ★양성대조: GD1001_ROOT=<604602cd 체크아웃> 이면 L1~L4 가 빨강이어야 한다. 실행: npm run test:dom -- label-pad-x
 */
const { test, expect } = require('@playwright/test');
const { boot, src } = require('./_root-harness');

const HARNESS = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="/css/editor-base.css">
<link rel="stylesheet" href="/css/editor-layout.css">
<link rel="stylesheet" href="/css/editor-panels.css">
<link rel="stylesheet" href="/css/editor-props.css">
<link rel="stylesheet" href="/css/color-picker.css">
<link rel="stylesheet" href="/css/editor-blocks.css">
<style>#panel-right{position:fixed;left:0;top:0;width:240px;} #canvas{position:absolute;left:600px;top:0;width:600px;background:#fff;}</style>
</head><body>
<div id="canvas"><div class="section-block"><div class="section-inner" id="host">
  <div class="text-block" id="tb1" data-type="label" style="text-align:left"><div class="tb-label" contenteditable="false">Label</div></div>
  <div class="text-block" id="tb2" data-type="label" style="text-align:left"><div class="tb-label" contenteditable="false" style="padding: 8px 20px; border-radius: 999px">Tag</div></div>
  <div class="text-block" id="tb3" data-type="label"><div class="tb-label" data-shape="circle" contenteditable="false" style="padding:0;width:64px;height:64px;border-radius:50%;display:inline-flex">1</div></div>
</div></div></div>
<div id="panel-right"><div class="panel-body"></div></div>
<script src="/js/panel-dispatch.js"></script>
<script src="/js/block-edit.js"></script>
<script src="/js/text-effect-transform.js"></script>
<script type="module">
  import '/js/props/color-picker.js';
  import { showTextProperties } from '/js/props/prop-text.js';
  window.__hist = 0; window.__save = 0;
  window.pushHistory = () => { window.__hist++; };
  window.scheduleAutoSave = () => { window.__save++; };
  window.getBlockBreadcrumb = () => '';
  window.__text = showTextProperties;
  window.__ready = true;
</script></body></html>`;

const open = (page, id) => page.evaluate((i) => window.__text(document.getElementById(i)), id);
const measure = (page, id) => page.evaluate((i) => {
  const tb = document.getElementById(i), p = tb.querySelector('.tb-label');
  const cs = getComputedStyle(p), ct = getComputedStyle(tb);
  const rg = document.createRange(); rg.selectNodeContents(p.firstChild || p);
  const pr = p.getBoundingClientRect();
  return { padL: parseFloat(cs.paddingLeft), padR: parseFloat(cs.paddingRight), padT: parseFloat(cs.paddingTop),
    pillW: Math.round(pr.width), textX: Math.round(rg.getBoundingClientRect().x - pr.x),
    tbPadL: parseFloat(ct.paddingLeft), tbStyle: tb.getAttribute('style'), pillStyle: p.getAttribute('style') };
}, id);
// ★「패널 표시값 == 실제 computed padding」 — 이 결함의 얼굴은 「패널 60, 실제 36」이다
const panelEqualsReal = async (page, id) => {
  const shown = Number(await page.locator('#txt-label-padx-number').inputValue());
  expect(shown).toBe((await measure(page, id)).padL);
  expect(Number(await page.locator('#txt-label-padx-slider').inputValue())).toBe(shown);
};
const row = (page) => page.locator('.prop-row', { has: page.locator('#txt-label-padx-slider') });

test('L1 패널에 「좌우 패딩」 줄이 있다(섹션과 같은 말·같은 꼴)', async ({ page }) => {
  const errs = await boot(page, HARNESS);
  await open(page, 'tb1');
  await expect(row(page).locator('.prop-label')).toHaveText('좌우 패딩');
  expect(await row(page).locator('input[type=range]').getAttribute('step')).toBe('2');
  expect(await page.locator('#txt-label-padx-number').getAttribute('max')).toBe('100');   // 섹션·프레임과 같은 0~100
  expect(await page.locator('#txt-label-padx-number').inputValue()).toBe('36');   // 기본값 = 지금 그려진 36px
  expect(errs).toEqual([]);
});

test('L2 값을 넣으면 알약 «안쪽» padding·알약 폭·글자 위치가 그만큼 변한다, 한 번 확정 = 한 걸음', async ({ page }) => {
  await boot(page, HARNESS);
  await open(page, 'tb1');
  const b = await measure(page, 'tb1');
  expect(b.padL).toBe(36);
  await page.locator('#txt-label-padx-number').fill('60');
  await page.locator('#txt-label-padx-number').blur();   // change = 확정(blur) — fill 은 input 만 낸다
  const a = await measure(page, 'tb1');
  expect([a.padL, a.padR]).toEqual([60, 60]);
  expect(a.pillW - b.pillW).toBe(48);      // 24 × 2
  expect(a.textX - b.textX).toBe(24);      // 글자가 왼쪽 안쪽 여백만큼 이동
  expect(a.padT).toBe(b.padT);             // 위아래는 그대로
  expect(a.tbPadL).toBe(b.tbPadL);         // 바깥(L/R 줄)은 건드리지 않는다
  expect(await page.evaluate(() => window.__hist)).toBe(1);
  expect(await page.locator('#txt-label-padx-slider').inputValue()).toBe('60');
});

test('L3 슬라이더도 같다 + 저장 왕복(직렬화→다시 열기)', async ({ page }) => {
  await boot(page, HARNESS);
  await open(page, 'tb1');
  await page.locator('#txt-label-padx-slider').fill('10');
  expect((await measure(page, 'tb1')).padL).toBe(10);
  // 저장 왕복: outerHTML → 새 노드 → 패널
  await page.evaluate(() => {
    const html = document.getElementById('tb1').outerHTML.replace('id="tb1"', 'id="tb9"');
    document.getElementById('host').insertAdjacentHTML('beforeend', html);
  });
  await open(page, 'tb9');
  expect((await measure(page, 'tb9')).padL).toBe(10);
  expect(await page.locator('#txt-label-padx-number').inputValue()).toBe('10');
});

test('L4 형태 버튼(Box)을 누르면 값이 36 으로 돌아가고 줄도 따라온다 · 원형에선 줄이 숨는다', async ({ page }) => {
  await boot(page, HARNESS);
  await open(page, 'tb2');
  expect(await page.locator('#txt-label-padx-number').inputValue()).toBe('20');   // 인라인 20px 를 읽는다
  await page.locator('#label-shape-box').evaluate((e) => e.click());
  expect(await page.locator('#txt-label-padx-number').inputValue()).toBe('36');
  await page.locator('#label-shape-circle').evaluate((e) => e.click());
  await expect(page.locator('#txt-label-padx-wrap')).toBeHidden();
  await page.locator('#label-shape-pill').evaluate((e) => e.click());
  await expect(page.locator('#txt-label-padx-wrap')).toBeVisible();
  await open(page, 'tb3');
  await expect(page.locator('#txt-label-padx-wrap')).toBeHidden();
});

test('L5 기존 라벨은 «열기만 해서는» 그대로다(DOM 한 글자도 안 변한다) + 라벨 아닌 블록엔 줄이 안 보인다', async ({ page }) => {
  await boot(page, HARNESS);
  const before = await page.evaluate(() => ['tb1', 'tb2', 'tb3'].map((i) => document.getElementById(i).outerHTML));
  for (const id of ['tb1', 'tb2', 'tb3']) await open(page, id);
  const after = await page.evaluate(() => ['tb1', 'tb2', 'tb3'].map((i) => document.getElementById(i).outerHTML));
  expect(after).toEqual(before);
  expect(await page.evaluate(() => window.__hist)).toBe(0);
  await page.evaluate(() => document.getElementById('host').insertAdjacentHTML('beforeend', '<div class="text-block" id="tb4" data-type="body"><div class="tb-body">본문</div></div>'));
  await open(page, 'tb4');
  await expect(page.locator('#txt-label-padx-wrap')).toBeHidden();
});

test('L6 ★배경색을 바꿔도 좌우·상하 패딩이 안 지워진다(적대QA 재현: 60 → 배경색 input → 36 / 폭 194→146)', async ({ page }) => {
  await boot(page, HARNESS);
  await open(page, 'tb1');
  await page.locator('#txt-label-padx-number').fill('60');
  await page.locator('#label-pill-height-number').fill('40');   // 상하 20+20 · U22(2026-10-05) Padding 「박스 높이」 제거 → Tag Style 「높이」로 옮김 (옛 결함 계열: 높이도 같은 길로 지워졌다)
  const b = await measure(page, 'tb1');
  expect([b.padL, b.padT, b.pillW]).toEqual([60, 20, 194]);   // 전제
  await page.locator('#label-bg-color').evaluate((e) => { e.value = '#cc2244'; e.dispatchEvent(new Event('input', { bubbles: true })); });
  const a = await measure(page, 'tb1');
  expect([a.padL, a.padR, a.padT, a.pillW]).toEqual([60, 60, 20, 194]);
  expect(await page.locator('#txt-label-padx-number').inputValue()).toBe('60');
  await panelEqualsReal(page, 'tb1');
});

test('L7 ★「배경 없음」: 켜면 0, 그 동안 바꾼 30 은 끌 때 살아 있다(30 → 36 유실 재현) · 줄은 계속 보인다(값이 실제로 먹는다)', async ({ page }) => {
  await boot(page, HARNESS);
  await open(page, 'tb1');
  await page.locator('#label-bg-none').evaluate((e) => e.click());
  expect((await measure(page, 'tb1')).padL).toBe(0);
  await expect(page.locator('#txt-label-padx-wrap')).toBeVisible();
  await page.locator('#txt-label-padx-number').fill('30');
  expect((await measure(page, 'tb1')).padL).toBe(30);            // 투명 라벨에도 그대로 먹는다
  await panelEqualsReal(page, 'tb1');
  await page.locator('#label-bg-none').evaluate((e) => e.click());
  const a = await measure(page, 'tb1');
  await panelEqualsReal(page, 'tb1');
  expect([a.padL, a.padR, a.padT]).toEqual([30, 30, 11]);        // 30 유지, 건드리지 않은 상하는 CSS 기본 11
  await open(page, 'tb2');                                        // 안 건드린 인라인 20/8 라벨: 없음 → 끔 이 원래대로
  await page.locator('#label-bg-none').evaluate((e) => e.click());
  await page.locator('#label-bg-none').evaluate((e) => e.click());
  expect(await measure(page, 'tb2')).toMatchObject({ padL: 20, padT: 8 });
});
