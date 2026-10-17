/* annotation-1017t1h5 — 어노테이션 라벨 「없음」 발견 가능성 + 여백(패딩) 손잡이.
 *
 * ★무엇을 잠그나
 *   PD1 알파 0(배경·테두리)이면 그려진 색 알파가 0 · 두께 0이면 borderWidth 0px
 *   PD2 여백 칸을 0 으로 하면 getComputedStyle(label).padding 이 0px (발주서가 말한 흠을 실제로 잠근다)
 *   PD3 (음성) 여백 칸을 안 건드리면 CSS 기본 4px 8px 그대로
 *   PD4 (음성) 알파 0 인데 swatch-none 이 안 켜지면 빨강 · 알파 100 으로 돌리면 꺼진다(발견 가능성 자체를 잠근다)
 * ★만드는 길은 «사람 손» 그대로 — 펜 단추 → 메뉴 「Annotation」 → 섹션 두 점 → Enter → Esc (annotation-1013 과 같은 꼴).
 * ⛔waitForTimeout 금지 — expect.poll/waitForFunction 만.
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');
const { clickAt } = require('./_click-at.js');

const SEC = '[id="secA"]';

async function setup(page) {
  await page.evaluate(() => {
    const canvas = document.getElementById('canvas');
    canvas.innerHTML = '<div class="section-block" id="secA" style="position:relative;height:420px;background:#f4f4f6"><div class="section-inner"></div></div>';
    window.rebindAll?.();
    window.applyPagePadX?.(window.state?.pageSettings?.padX);
    window.buildLayerPanel?.();
  });
}

const annotCount = (page) => page.evaluate(() => document.querySelectorAll('#secA .annotation-block').length);

async function makeAnnotation(page, { p1 = [0.2, 0.3], p2 = [0.45, 0.6] } = {}) {
  const before = await annotCount(page);
  await page.click('#fp-pen-btn');
  await page.click('#fp-pen-menu .fp-menu-item:text-is("Annotation")');
  await expect.poll(() => page.evaluate(() => document.body.classList.contains('pen-mode')), '★전제: 펜 모드가 켜졌다').toBe(true);
  const r = await waitStableRect(page, SEC);
  await clickAt(page, r.left + r.width * p1[0], r.top + r.height * p1[1], { sel: SEC }, { label: '첫 점' });
  await clickAt(page, r.left + r.width * p2[0], r.top + r.height * p2[1], { sel: SEC }, { label: '둘째 점' });
  await page.keyboard.press('Enter');
  await expect.poll(() => annotCount(page), 'Enter 로 어노테이션 하나가 생겼다').toBe(before + 1);
  // ★전제 — 라벨 편집(focus)이 실제로 들어선 뒤에 Escape (annotation-1013.dom.spec.js makeAnnotation
  //   과 같은 교훈 · annotation-1017t1h1 에서 실측: 안 기다리면 Escape 가 펜모드 종료와 경합해
  //   contenteditable=true 가 남고, 그 뒤 라벨 클릭이 섹션 클릭으로 버블돼 선택이 풀린다 — flaky).
  await expect.poll(() => page.evaluate(() => document.activeElement?.classList?.contains('annot-label')), '생성 직후 라벨 편집에 들어갔다').toBe(true);
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => document.body.classList.contains('pen-mode')), 'Esc 로 펜 모드 종료').toBe(false);
  return page.evaluate(() => { const all = document.querySelectorAll('#secA .annotation-block'); return all[all.length - 1].id; });
}

async function selectByLabel(page, id) {
  const sel = `[id="${id}"] .annot-label`;
  const lr = await waitStableRect(page, sel);
  await clickAt(page, lr.cx, lr.cy, { sel }, { label: '라벨' });
  await expect.poll(() => page.evaluate((id) => document.getElementById(id).classList.contains('selected')
    && !!document.querySelector('#panel-right [data-prop-panel="annotation"]'), id), '★전제: 골랐고 어노테이션 패널이 떴다').toBe(true);
  return lr;
}

/* 패널 숫자칸에 값을 넣는다(선택 전체 → 입력 → change). */
async function setNum(page, id, value) {
  await page.click(`#panel-right #${id}`);
  await page.keyboard.press('Meta+a');
  await page.keyboard.type(String(value));
  await page.keyboard.press('Enter');
}

test('PD1 배경·테두리 알파 0 → 그려진 색 알파 0 · 두께 0 → borderWidth 0px', async ({ page }) => {
  await bootApp(page);
  await setup(page);
  const id = await makeAnnotation(page);
  await selectByLabel(page, id);
  await page.fill('#panel-right #annot-label-bg-alpha', '0');
  await page.keyboard.press('Enter');
  await page.fill('#panel-right #annot-label-border-alpha', '0');
  await page.keyboard.press('Enter');
  await setNum(page, 'annot-border-w-num', 0);
  const r = () => page.evaluate((id) => {
    const l = document.getElementById(id).querySelector('.annot-label');
    const cs = getComputedStyle(l);
    const bgA = (cs.backgroundColor.match(/[\d.]+\)$/) || ['1)'])[0];
    const brA = (cs.borderTopColor.match(/[\d.]+\)$/) || ['1)'])[0];
    return { bgAlphaZero: bgA.startsWith('0)'), borderAlphaZero: brA.startsWith('0)'), borderWidth: cs.borderTopWidth };
  }, id);
  await expect.poll(r, '배경·테두리 알파 0 · 두께 0px').toEqual({ bgAlphaZero: true, borderAlphaZero: true, borderWidth: '0px' });
});

test('PD2 여백 0 → getComputedStyle(label).padding = 0px (발주서가 말한 흠을 잠근다)', async ({ page }) => {
  await bootApp(page);
  await setup(page);
  const id = await makeAnnotation(page);
  await selectByLabel(page, id);
  const before = await page.evaluate((id) => getComputedStyle(document.getElementById(id).querySelector('.annot-label')).padding, id);
  expect(before, '★전제: CSS 기본 패딩(4px 8px — 0px 아님)').not.toBe('0px');
  await setNum(page, 'annot-label-pad-num', 0);
  await expect.poll(() => page.evaluate((id) => getComputedStyle(document.getElementById(id).querySelector('.annot-label')).padding, id),
    '여백 0 → computed padding 0px').toBe('0px');
  const ds = await page.evaluate((id) => document.getElementById(id).dataset.labelPad, id);
  expect(ds, 'dataset.labelPad 가 0으로 저장된다').toBe('0');
});

test('PD3(음성) 여백 칸을 안 건드리면 4px 8px 그대로', async ({ page }) => {
  await bootApp(page);
  await setup(page);
  const id = await makeAnnotation(page);
  await selectByLabel(page, id);
  const pad = await page.evaluate((id) => getComputedStyle(document.getElementById(id).querySelector('.annot-label')).padding, id);
  expect(pad, '건드리지 않으면 CSS 기본값').toBe('4px 8px');
  const ds = await page.evaluate((id) => document.getElementById(id).dataset.labelPad, id);
  expect(ds, '안 건드리면 dataset 키가 없다').toBeUndefined();
});

test('PD4(음성·계측기 자가검사) 알파 0 → swatch-none 켜짐 · 100 으로 돌리면 꺼진다', async ({ page }) => {
  await bootApp(page);
  await setup(page);
  const id = await makeAnnotation(page);
  await selectByLabel(page, id);
  const swOn = () => page.evaluate(() => document.querySelector('#panel-right #annot-label-bg-color')?.closest('.prop-color-swatch')?.classList.contains('swatch-none'));
  expect(await swOn(), '★전제: 기본 배경(흰색, 알파100)은 swatch-none 이 꺼져 있다').toBe(false);
  await page.fill('#panel-right #annot-label-bg-alpha', '0');
  await page.keyboard.press('Enter');
  await expect.poll(swOn, '알파 0 → swatch-none 켜짐(발견 가능성이 실제로 보인다)').toBe(true);
  await page.fill('#panel-right #annot-label-bg-alpha', '100');
  await page.keyboard.press('Enter');
  await expect.poll(swOn, '알파 100으로 돌리면 꺼진다').toBe(false);
});
