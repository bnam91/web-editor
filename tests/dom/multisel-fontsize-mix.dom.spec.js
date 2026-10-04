/* multisel-fontsize-mix.dom.spec.js — TX2 (현빈 2026-10-03 「폰트크기가 다른 텍스트 블럭 2개를 선택하면 어떻게되는지도 보고 피그마처럼 되게해줘」)
 *
 * ★핀 실측(ebb13f39, 격리 앱 9378 · 2026-10-04 02:4x 태양 TX2 — 진짜 클릭·⇧클릭·키 입력)
 *   두 블럭(36px · 72px) 선택 → 「2개 선택됨 · 폰트 크기(텍스트 2개)」 칸 #msp-font-size = value "" · placeholder "px"
 *   ⇒ 크기가 «다르다»는 것도, «같은 값»도 안 보인다(같은 36·36 이어도 "" · "px").
 *   그 칸에 32 + Enter → 두 블럭 모두 32px · 히스토리 한 칸(「일괄 폰트 크기」) · ⌘Z 한 번에 둘 다 되돌아감(이미 됐다).
 *
 * ★지키는 것
 *   M1 크기가 다른 두 블럭 → 비운 칸 + 'Mix'                         (핀 빨강: placeholder "px")
 *   M2 크기가 같은 두 블럭 → 그 값                                   (핀 빨강: value "")
 *   M3 한 블럭 «안»이 섞였으면, 다른 블럭과 크기가 같아도 → Mix       (핀 빨강)
 *   M4 Mix 칸을 누르고 32 를 치면 «32» — 「Mix32」 같은 이어붙임이 없다. Enter 로 «모두» 32 · 되돌리기 한 칸 (핀 초록 — 지키는 시험)
 *   M5 색만 다르고 크기가 같으면 Mix 가 «아니다» (크기 판독이 색에 안 끌려간다) (핀 빨강: M2 와 같은 까닭으로 value "")
 *   ★전제(매 시험): «정말 둘이» 골라졌다 · 크기가 «정말» 다르다/같다 — 전제가 틀리면 결론을 안 낸다.
 *
 * ★양성대조: GD1001_ROOT=<ebb13f39 체크아웃> 로 돌리면 같은 시험이 핀을 잰다(_root-harness.js).
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js tests/dom/multisel-fontsize-mix.dom.spec.js
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const tb = (id, inner, style = '') =>
  `<div class="frame-block" id="tf_${id}" data-text-frame="true"><div class="text-block" id="${id}" data-type="body"><div class="tb-body" contenteditable="false" style="${style}">${inner}</div></div></div>
   <div class="gap-block" data-type="gap" style="height:24px;"></div>`;

const SEC = `
<div class="section-block" id="secTX2" data-section="1" style="background-color:#fff;">
  <div class="section-hitzone"><span class="section-label">TX2</span></div>
  <div class="section-inner" id="innerTX2">
    <div class="gap-block" data-type="gap" style="height:40px;"></div>
    ${tb('tbS20a', 'Small twenty A', 'font-size:20px;')}
    ${tb('tbS48', 'Big forty eight', 'font-size:48px;')}
    ${tb('tbS20b', 'Small twenty B', 'font-size:20px;')}
    ${tb('tbMix', 'AAA <span style="font-size:40px;">BBB</span> CCC', 'font-size:20px;')}
    ${tb('tbRed', 'Red twenty', 'font-size:20px;color:#ff0000;')}
  </div>
</div>`;

async function setup(page) {
  const errs = await bootApp(page);
  await page.evaluate((html) => {
    const c = document.getElementById('canvas');
    c.insertAdjacentHTML('beforeend', html);
    window.rebindAll?.();
    window.deselectAll?.();
    document.getElementById('secTX2').scrollIntoView({ block: 'start' });
  }, SEC);
  await page.waitForTimeout(300);
  return errs;
}
const center = (page, id) => page.evaluate((id) => {
  const r = document.getElementById(id).getBoundingClientRect(); return [r.left + Math.min(r.width / 2, 60), r.top + r.height / 2];
}, id);
/* ⌘클릭(더하기)으로 «딱 둘»만 고른다. ⛔⇧클릭은 «범위» 선택이라 사이의 갭·블럭까지 잡는다
   (첫 판 실측: ⇧ → 「3개 선택됨」·사이 48 블럭 포함 — 전제 검사가 잡았다). */
async function pick(page, a, b) {
  const [ax, ay] = await center(page, a); await page.mouse.click(ax, ay);
  await page.waitForTimeout(150);
  const [bx, by] = await center(page, b);
  await page.keyboard.down('Meta'); await page.mouse.click(bx, by); await page.keyboard.up('Meta');
  await page.waitForTimeout(250);
}
const selected = (page) => page.evaluate(() => [...document.querySelectorAll('#secTX2 .text-block.selected')].map(e => e.id));
/** 블럭마다 «글자가 실제로 그려진» 크기들(텍스트 노드 부모의 계산 스타일). */
const sizesOf = (page, ids) => page.evaluate((ids) => ids.map(id => {
  const c = document.getElementById(id).querySelector('.tb-body'); const w = document.createTreeWalker(c, NodeFilter.SHOW_TEXT); let n; const s = new Set();
  while ((n = w.nextNode())) if (n.nodeValue.trim()) s.add(Math.round(parseFloat(getComputedStyle(n.parentElement).fontSize)));
  return [...s];
}), ids);
const field = (page) => page.evaluate(() => {
  const f = document.getElementById('msp-font-size'); if (!f) return null;
  return { value: f.value, ph: f.getAttribute('placeholder'), empty: f.dataset.empty || null, name: document.querySelector('#panel-right .prop-block-name')?.textContent?.trim() };
});

test('M1 ★크기가 다른 두 블럭(20·48) → 칸은 비고 «Mix»', async ({ page }) => {
  const errs = await setup(page);
  await pick(page, 'tbS20a', 'tbS48');
  expect(await selected(page), '전제: 둘이 골라졌다').toEqual(['tbS20a', 'tbS48']);
  expect(await sizesOf(page, ['tbS20a', 'tbS48']), '전제: 크기가 정말 다르다').toEqual([[20], [48]]);
  const f = await field(page);
  expect(f?.name, '전제: 멀티선택 패널').toBe('2개 선택됨');
  expect(f).toMatchObject({ value: '', ph: 'Mix', empty: 'invalid' });
  expect(errs).toEqual([]);
});

test('M2 ★크기가 같은 두 블럭(20·20) → 그 값 «20»', async ({ page }) => {
  const errs = await setup(page);
  await pick(page, 'tbS20a', 'tbS20b');
  const sel = await selected(page);
  expect(sel, '전제: 딱 둘이 골라졌다(사이 48 블럭이 잡히면 M2 가 아니다)').toEqual(['tbS20a', 'tbS20b']);
  expect(await sizesOf(page, ['tbS20a', 'tbS20b']), '전제: 크기가 정말 같다').toEqual([[20], [20]]);
  expect(await field(page)).toMatchObject({ name: '2개 선택됨', value: '20', ph: 'px', empty: 'invalid' });
  expect(errs).toEqual([]);
});

test('M3 ★한 블럭 «안»이 섞였으면(20+40) — 다른 블럭이 20 이어도 Mix', async ({ page }) => {
  const errs = await setup(page);
  await pick(page, 'tbMix', 'tbRed');
  expect(await selected(page), '전제: 둘이 골라졌다').toEqual(['tbMix', 'tbRed']);
  const s = await sizesOf(page, ['tbMix', 'tbRed']);
  expect(s[0].sort(), '전제: 한 블럭 안이 정말 섞였다').toEqual([20, 40]);
  expect(await field(page)).toMatchObject({ name: '2개 선택됨', value: '', ph: 'Mix' });
  expect(errs).toEqual([]);
});

test('M4 ★Mix 칸을 누르고 32 → 「Mix32」 없이 32 · Enter 로 «모두» 32 · ⌘Z 한 번에 둘 다 되돌아감', async ({ page }) => {
  const errs = await setup(page);
  await pick(page, 'tbS20a', 'tbS48');
  expect(await selected(page), '전제: 둘이 골라졌다').toEqual(['tbS20a', 'tbS48']);
  expect(await sizesOf(page, ['tbS20a', 'tbS48']), '전제: 크기가 정말 다르다').toEqual([[20], [48]]);
  const r = await page.evaluate(() => { const b = document.getElementById('msp-font-size').getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; });
  await page.mouse.click(r[0], r[1]);          // ⛔전체선택(⌘A) 없이 — 사람이 «그냥 누르고 친» 꼴
  await page.waitForTimeout(120);
  expect(await page.evaluate(() => document.activeElement?.id), '전제: 칸에 포커스').toBe('msp-font-size');
  await page.keyboard.type('32');
  expect(await page.evaluate(() => document.getElementById('msp-font-size').value), '이어붙임 없음').toBe('32');
  const h0 = await page.evaluate(() => window.getHistoryTip?.());
  await page.keyboard.press('Enter');
  await page.waitForTimeout(250);
  expect(await sizesOf(page, ['tbS20a', 'tbS48']), '«모두»에 들어갔다').toEqual([[32], [32]]);
  const h1 = await page.evaluate(() => window.getHistoryTip?.());
  expect(h1.pos - h0.pos, '히스토리 «한 칸»').toBe(1);
  expect(h1.action).toBe('일괄 폰트 크기');
  // ⌘Z 는 칸 «밖»에서(칸 안의 ⌘Z 는 글자 되돌리기다) — 빈 캔버스가 아니라 포커스만 뺀다(선택 유지 무관).
  await page.evaluate(() => document.activeElement?.blur());
  await page.keyboard.press('Meta+z');
  await page.waitForTimeout(400);
  expect(await sizesOf(page, ['tbS20a', 'tbS48']), '⌘Z 한 번에 «둘 다» 원래대로').toEqual([[20], [48]]);
  expect(errs).toEqual([]);
});

test('M5 ★색만 다르고 크기는 같다(20 검정 · 20 빨강) → Mix 가 «아니라» 20', async ({ page }) => {
  const errs = await setup(page);
  await pick(page, 'tbS20b', 'tbRed');   // 사이에 tbMix 가 있다 — ⌘클릭이라 안 잡힌다(아래 전제)
  expect(await selected(page), '전제: 둘만 골라졌다').toEqual(['tbS20b', 'tbRed']);
  const colors = await page.evaluate(() => ['tbS20b', 'tbRed'].map(id => getComputedStyle(document.getElementById(id).querySelector('.tb-body')).color));
  expect(colors[0] !== colors[1], `전제: 색이 정말 다르다 ${colors}`).toBe(true);
  expect(await field(page)).toMatchObject({ name: '2개 선택됨', value: '20', ph: 'px' });
  expect(errs).toEqual([]);
});
