/* label-pill-h-keep.dom.spec.js — B3 후속(E5 옛 결함): 라벨 배경색을 바꿔도 알약 «높이»(상하 padding)가 안 지워진다.
 * 옛 결함: setLabelBg 가 padding 을 통째로 비워(style.padding='') 박스 높이로 정한 상하 padding 도 CSS 기본(11px)으로 돌아갔다.
 * 겉모습 단언 — computed padding-top/bottom 과 알약 높이. (구현 방식은 단언하지 않는다.)
 * ★양성대조: GD1001_ROOT=<604602cd 의 js·css> 에서 빨강이어야 한다(그 판엔 「좌우 패딩」 줄이 없어도 이 시험은 알약 높이 줄만 쓴다 — 2026-10-05 U22 로 Padding 「박스 높이」(#txt-label-h-*) 가 빠져 Tag Style 「높이」(#label-pill-height-*) 를 쓴다 · 같은 setPillH).
 */
const { test, expect } = require('@playwright/test');
const { boot } = require('./_root-harness');

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

const look = (page) => page.evaluate(() => {
  const p = document.querySelector('#tb1 .tb-label'), cs = getComputedStyle(p);
  return { padT: parseFloat(cs.paddingTop), padB: parseFloat(cs.paddingBottom), h: Math.round(p.getBoundingClientRect().height) };
});

test('H1 ★박스 높이 40 → 배경색 input → 상하 padding·알약 높이가 그대로(옛 결함: 11px 기본으로 복귀)', async ({ page }) => {
  await boot(page, HARNESS);
  await page.evaluate(() => window.__text(document.getElementById('tb1')));
  await page.locator('#label-pill-height-number').fill('40');   // U22(2026-10-05) Padding 「박스 높이」 제거 → Tag Style 「높이」 (같은 setPillH)
  const b = await look(page);
  expect([b.padT, b.padB]).toEqual([20, 20]);                    // 전제: 높이가 실제로 서 있다
  await page.locator('#label-bg-color').evaluate((e) => { e.value = '#cc2244'; e.dispatchEvent(new Event('input', { bubbles: true })); });
  expect(await look(page)).toEqual(b);
});

/* ★U22 (UserLens 0.9.6 ⑷11 · 지디 ① 2026-10-05): 같은 값(알약 높이)에 묶인 손잡이 둘 → Tag Style 「높이」 하나.
 *   양성대조: origin/dev 772ccadc 에선 H0 이 빨강(#txt-label-h-number 1개 · 「박스 높이」 글자 1개). */
test('H0 ★알약 높이 손잡이는 Tag Style 「높이」 «하나» — Padding 절에 「박스 높이」가 없다', async ({ page }) => {
  await boot(page, HARNESS);
  await page.evaluate(() => window.__text(document.getElementById('tb1')));
  await expect(page.locator('#label-pill-height-number')).toBeVisible();            // 전제: 라벨 패널이 열렸다
  await expect(page.locator('#txt-label-h-number, #txt-label-h-slider, #txt-label-h-row')).toHaveCount(0);
  await expect(page.locator('.prop-label', { hasText: /^박스 높이$/ })).toHaveCount(0);
});
