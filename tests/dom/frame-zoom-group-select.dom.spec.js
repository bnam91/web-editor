/* frame-zoom-group-select.dom.spec.js — B1 (현빈 2026-10-01 「프레임블럭+줌블럭 ⌘G 그룹설정이 안 된다」, 재현 sec_2kril19)
 * ★먼저 «눌러서» 증상을 잰다(지디 지시). 꼴은 sec_2kril19 와 같게 합성: 흐름 자유배치 프레임(860×797) 가운데에
 *   absolute 목업(513 폭, 프레임 높이 전체를 덮음) + 섹션에 떠 있는 줌. 현빈 데이터는 안 가져온다.
 * ⚠️처음 진단(코드 읽기)은 «둘 다 틀렸다» — ㉠「가운데를 누르면 목업이 잡힌다」✗(선택 안 된 프레임의 자식은 클릭을 안 받아
 *   프레임이 잡힌다, B1-a 초록) ㉡「⇧클릭이 사이 블럭 전부를 잡는다」✗(갭·글자는 안 잡혔다).
 * ★실측된 증상: ⇧클릭 범위선택이 프레임 «안의 목업»까지 끌어와 선택 = [프레임, 목업, 줌] → 「품은 컨테이너는 뺀다」가
 *   프레임을 빼 host 가 목업이 되고 거절 토스트만. ⌘클릭은 됐다. ⇒ 갈림은 «선택 방법».
 * ★양성대조 판 = 7699ea33 → 실측 빨강: B1-b / 초록: B1-0 B1-a(⌘클릭 길 — 옛 판도 된다).
 * ⚠️첫 판이 가장자리를 ±330px 로 눌러 프레임 «밖»을 쳤다(캔버스 축소) — 비율 오프셋으로 고쳤다.
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const SEC = `
<div class="section-block" id="secB1" data-section="1" style="background-color:#222;">
  <div class="section-hitzone"><span class="section-label">B1</span></div>
  <div class="section-inner" id="innerB1" style="padding-left:0;padding-right:0;">
    <div class="gap-block" id="gapA" data-type="gap" style="height:60px;"></div>
    <div class="frame-block" id="tfA" data-text-frame="true"><div class="text-block" id="tbA" data-type="body"><div class="tb-body" contenteditable="false">사이 글자</div></div></div>
    <div class="gap-block" id="gapB" data-type="gap" style="height:40px;"></div>
    <div class="frame-block" id="frB1" data-free-layout="true" data-width="860" data-height="797"
         style="padding:0;width:860px;max-width:100%;margin:0 auto;min-height:797px;height:797px;">
      <div class="mockup-block" id="mkB1" data-type="mockup" data-device="iphone" data-width="513"
           style="display:block;width:513px;height:1037px;position:absolute;left:174px;top:0px;"></div>
    </div>
  </div>
  <div class="zoom-block" id="zmB1" data-type="zoom" data-x="109" data-y="1000" data-w="300" data-h="160"
       style="position:absolute;left:109px;top:1000px;width:300px;height:160px;"></div>
</div>`;

async function setup(page) {
  const errs = await bootApp(page);
  await page.evaluate((html) => {
    const c = document.getElementById('canvas');
    c.insertAdjacentHTML('beforeend', html);
    window.rebindAll?.();
    window.deselectAll?.();
    document.getElementById('frB1').scrollIntoView({ block: 'start' });
  }, SEC);
  await page.waitForTimeout(300);
  return errs;
}
/* fx = 상자 폭에 대한 «비율» 오프셋. ⛔px 로 주지 마라 — 캔버스가 축소돼 있어 화면 폭이 860 이 아니다
   (첫 판이 ±330px 로 프레임 «밖»(canvas-wrap)을 눌러 거짓 빨강을 냈다). */
const center = (page, id, fx = 0) => page.evaluate(([id, fx]) => {
  const r = document.getElementById(id).getBoundingClientRect(); return [r.left + r.width / 2 + r.width * fx, r.top + Math.min(r.height / 2, 120)];
}, [id, fx]);
const selected = (page) => page.evaluate(() => [...document.querySelectorAll('#secB1 .selected')].map(e => e.id).filter(Boolean));
const zoomParent = (page) => page.evaluate(() => document.getElementById('zmB1').parentElement.id);

test('B1-0 대조 — 프레임 «가장자리»(목업 밖)를 누르고 ⌘클릭 줌 → ⌘G 는 된다', async ({ page }) => {
  await setup(page);
  const [fx, fy] = await center(page, 'frB1', -0.42);
  await page.mouse.click(fx, fy);
  const [zx, zy] = await center(page, 'zmB1');
  await page.keyboard.down('Meta'); await page.mouse.click(zx, zy); await page.keyboard.up('Meta');
  const sel = await selected(page);
  await page.keyboard.press('Meta+g');
  console.log('  B1-0 sel', JSON.stringify(sel));
  expect(await zoomParent(page)).toBe('frB1');
});

test('B1-a ★프레임 «가운데»(목업 위)를 누르고 ⌘클릭 줌 → ⌘G 로 프레임에 묶인다', async ({ page }) => {
  await setup(page);
  const [fx, fy] = await center(page, 'frB1');
  await page.mouse.click(fx, fy);
  const [zx, zy] = await center(page, 'zmB1');
  await page.keyboard.down('Meta'); await page.mouse.click(zx, zy); await page.keyboard.up('Meta');
  const sel = await selected(page);
  await page.keyboard.press('Meta+g');
  console.log('  B1-a sel', JSON.stringify(sel));
  expect(await zoomParent(page), `선택=${JSON.stringify(sel)}`).toBe('frB1');
});

test('B1-b ★프레임을 누르고 ⇧클릭 줌(범위선택이 프레임 안 목업까지 잡는다) → 사이 블럭은 안 잡히고 ⌘G 로 프레임에 묶인다', async ({ page }) => {
  await setup(page);
  const [fx, fy] = await center(page, 'frB1', -0.42);
  await page.mouse.click(fx, fy);
  const [zx, zy] = await center(page, 'zmB1');
  await page.keyboard.down('Shift'); await page.mouse.click(zx, zy); await page.keyboard.up('Shift');
  const sel = await selected(page);
  console.log('  B1-b sel', JSON.stringify(sel));
  expect(sel.filter(id => ['gapA', 'gapB', 'tbA', 'tfA'].includes(id)), '★⇧ 범위선택이 사이 블럭까지 잡았다').toEqual([]);
  await page.keyboard.press('Meta+g');
  expect(await zoomParent(page)).toBe('frB1');
});
