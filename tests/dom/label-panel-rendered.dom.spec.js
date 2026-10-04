/* label-panel-rendered.dom.spec.js — E121(지디 ⓐ · 2026-10-05): 라벨 패널이 «그려진 값»을 보여 준다.
 *   병: 빈 값(인라인 없음)을 `|| 기본값` 으로 그림 ↔ CSS 는 다른 기본값(기본값 명부 두 벌). 처방 한 자리 = js/props/_panel-rendered.js.
 *   실측(772ccadc · 맨 라벨): 패널 알약 높이 8 / 실제 22(CSS 11+11) · Tag Style 켜짐 0/5 · 상하·L/R 0 = 바깥 블럭 실제 0(맞음).
 * 시험 이름표:
 *   R1 ★새 것(#9 · U22① 의 전제 조건 — 남긴 「높이」가 실제 높이를 보여 준다)
 *   R2 회귀 지킴(좌우 패딩 36 — 옛 코드도 계산값을 읽어 772ccadc 초록이 정상) · ★공용 헬퍼 소비자
 *   R3 ★새 것(U7 Tag Style 켜짐 — 맨 라벨 = Box · 단추 누르면 그 단추)
 *   R4 회귀 지킴(U7 의 상하·L/R 은 «바깥 블럭»을 보여 주고 그 값이 실제와 같다 — 이번에 안 바꿈을 잠근다)
 *   R5 음성(안 맞는 모습엔 아무것도 안 켬 — 거짓 켜짐 금지)
 * ★설계 결정(명부 E121): 안 고른 맨 라벨도 «그려진 모양»으로 켠다(= Box). 까닭 = 원리(패널은 그려진 값). 대안(아무것도 안 켬)은 고치기 전 증상과 같아 버렸다.
 * ★양성대조 둘:
 *   ⑴ 772ccadc(GD1001_ROOT): R1·R3 빨강 · R2·R4 초록.
 *   ⑵ «공용 본문 무력화» — _panel-rendered.js 의 panelRenderedPx 가 0 을 돌려주게 하면 소비자 셋(R1 · R2 · R3)이 빨강 · R4 초록.
 *      ⛔소비자가 제 호출 줄을 각각 빼는 변이는 «한 벌/두 벌»을 못 가른다(지디 규율) — 본문 하나를 꺼서 잰다.
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js tests/dom/label-panel-rendered.dom.spec.js */
const { test, expect } = require('@playwright/test');
const { boot } = require('./_root-harness');
const { clickAt } = require('./_click-at.js');

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
</div></div></div>
<div id="panel-right"><div class="panel-body"></div></div>
<script src="/js/panel-dispatch.js"></script>
<script src="/js/block-edit.js"></script>
<script src="/js/text-effect-transform.js"></script>
<script type="module">
  import '/js/props/color-picker.js';
  import { showTextProperties } from '/js/props/prop-text.js';
  window.pushHistory = () => {}; window.scheduleAutoSave = () => {};
  window.getBlockBreadcrumb = () => '';
  window.__text = showTextProperties;
  window.__ready = true;
</script></body></html>`;


const real = (page) => page.evaluate(() => {
  const tb = document.getElementById('tb1'), p = tb.querySelector('.tb-label');
  const cp = getComputedStyle(p), ct = getComputedStyle(tb);
  return { pillH: Math.round(parseFloat(cp.paddingTop) + parseFloat(cp.paddingBottom)), padX: Math.round(parseFloat(cp.paddingLeft)),
           blockT: Math.round(parseFloat(ct.paddingTop)), blockL: Math.round(parseFloat(ct.paddingLeft)), blockR: Math.round(parseFloat(ct.paddingRight)),
           inlinePad: p.style.padding || p.style.paddingTop || '' };
});
const val = (page, id) => page.locator('#' + id).inputValue();
const lit = (page) => page.evaluate(() => [...document.querySelectorAll('#label-style-section .prop-btn-full.active')].map(b => b.id));
async function open(page) {
  await page.setViewportSize({ width: 1300, height: 1800 });   // 하네스 패널은 position:fixed · 스크롤 없음 — Tag Style 단추가 기본 720 아래(y≈813)라 화면을 키운다
  await boot(page, HARNESS);
  await page.evaluate(() => window.__text(document.getElementById('tb1')));
  await expect(page.locator('#label-pill-height-number')).toBeVisible();
}

test('R1 ★맨 라벨의 「높이」 칸 = 실제 알약 높이(상하 padding 합)', async ({ page }) => {
  await open(page);
  const r = await real(page);
  expect(r.inlinePad, '전제: 인라인 padding 없음(CSS 기본으로 그려짐)').toBe('');
  expect(r.pillH, '전제: CSS 기본 알약 상하 11+11').toBe(22);
  expect(Number(await val(page, 'label-pill-height-number')), `패널 높이 ≠ 실제 ${r.pillH}`).toBe(r.pillH);
});

test('R2 「좌우 패딩」 칸 = 실제 알약 좌우 padding (공용 헬퍼 소비자)', async ({ page }) => {
  await open(page);
  const r = await real(page);
  expect(r.padX, '전제: CSS 기본 36').toBe(36);
  expect(Number(await val(page, 'txt-label-padx-number'))).toBe(r.padX);
});

test('R3 ★Tag Style 켜짐 — 맨 라벨 = Box 하나 · 단추를 누르면 그 단추 하나', async ({ page }) => {
  await open(page);
  expect(await lit(page), '맨 라벨(CSS 기본 = radius 8 · 채움)은 Box 모습').toEqual(['label-shape-box']);
  /* 다섯 모양을 «실제로» 골라 놓고 판정이 맞히나 — 5/5 (지디: 분류기는 추론이라 양성 다섯). 두 길 다 잰다:
     ⒜ 누른 직후(wireup 의 다시 판정) ⒝ 패널을 «다시 열었을 때»(prop-text.js → 템플릿 길). */
  for (const k of ['pill', 'outline', 'text', 'circle', 'box']) {
    const loc = page.locator('#label-shape-' + k);
    await loc.scrollIntoViewIfNeeded();
    await expect.poll(async () => { const a = await loc.boundingBox(); const b2 = await loc.boundingBox(); return a && b2 && a.y === b2.y; }).toBe(true);
    const b = await loc.boundingBox();
    await clickAt(page, b.x + b.width / 2, b.y + b.height / 2, { sel: '#label-shape-' + k }, { label: k });
    await expect.poll(() => lit(page), { message: `⒜ ${k} 를 눌렀는데 켜짐이 다르다` }).toEqual(['label-shape-' + k]);
    await page.evaluate(() => window.__text(document.getElementById('tb1')));
    await expect.poll(() => lit(page), { message: `⒝ ${k} 로 둔 라벨을 다시 열었는데 켜짐이 다르다` }).toEqual(['label-shape-' + k]);
  }
});

test('R5 음성 — 어느 단추와도 안 맞는 모습(채움 없음 + 둥근 모서리 + 테두리 없음)이면 «아무것도» 안 켠다', async ({ page }) => {
  await boot(page, HARNESS);
  await page.evaluate(() => { const p = document.querySelector('#tb1 .tb-label'); p.style.backgroundColor = 'transparent'; p.style.borderRadius = '8px'; window.__text(document.getElementById('tb1')); });
  await expect(page.locator('#label-pill-height-number')).toBeVisible();
  expect(await lit(page)).toEqual([]);
});

test('R4 상하·L/R 은 바깥 블럭을 보여 주고 그 값이 실제와 같다(U7 — 이번에 안 바꿈)', async ({ page }) => {
  await open(page);
  const r = await real(page);
  expect([Number(await val(page, 'txt-pv-number')), Number(await val(page, 'txt-pl-number')), Number(await val(page, 'txt-pr-number'))])
    .toEqual([r.blockT, r.blockL, r.blockR]);
});
