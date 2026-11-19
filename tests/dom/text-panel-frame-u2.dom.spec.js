/* text-panel-frame-u2 — 텍스트 패널을 틀(_panel-frame.js)로 옮긴 뒤의 두 계약. (right-panel-unify U2 · 2026-11-13)
 *
 * B1 ★절 아래 여백 = 틀 토큰 하나 (시트 PROP-SECTION-EXPANDED-BOTTOM-GAP-14-VS-10-01)
 *    옛 판: 펼친 Effects 절만 아래 14px(카드 margin-bottom 10 + 절 padding 4) · 다른 절 10px(줄 margin 6 + 4).
 *    계약: 펼친 절의 «보이는 마지막 내용 아래 ↔ 절 아래끝» = --ui-sec-body-pb, 절마다 같다(맨 끝 절 = 틀의 패널 끝 여백 --ui-space-2).
 *    ⇒ 그 간격이 «내용의 꼬리 margin» 이 아니라 «틀 토큰» 에서 와야 한다.
 *    내장 양성대조(B1b): 같은 판정 함수로 Effects 카드 꼬리에 margin-bottom 을 심으면 그 절이 걸린다.
 *    바깥 양성대조: css/editor-props.css 패널 절 블록에서 «몸통 마지막 내용 margin-bottom 0» 줄을 지우면 B1 빨강.
 * R1 ★타입을 바꾸면 패널을 다시 그린다 — Tag 전용 칸(모서리=Appearance · 배경=Fill · 높이=Size)이 제 절에 서고, Body 로 돌아가면 걷힌다 · 포커스는 누른 단추로.
 *    양성대조: prop-text-wireup-type.js 의 `rerender?.()` 를 지우면 Tag 로 바꿔도 #label-radius-slider 가 없어 빨강.
 * 앱 통째(bootApp) · 헤드리스 · CDP·라이브 인스턴스 무접촉.
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const { addKind } = require('./_block-roster-294.js');

async function scene(page) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(async () => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); await window.addSection(); const sec = c.querySelector('.section-block'); window.__secEl = () => sec; window.clearHistory?.(); });
  return errs;
}
async function openText(page) {
  const r = await addKind(page, { cls: 'text-block', entry: 'addTextBlock' });
  expect(r.err, '[전제] 텍스트 블럭을 넣었다').toBeUndefined();
  await page.evaluate((id) => window.selectBlock(id), r.id);
  await expect(page.locator('#panel-right .prop-section[data-sec="typography"]'), '[전제] 틀로 그린 텍스트 패널').toBeAttached();
  return r.id;
}

/** 펼친 절마다 «보이는 마지막 내용 아래 ↔ 절 아래끝». 맨 끝 절·보이는 내용 없는 절은 뺀다. */
const readGaps = (page) => page.evaluate(() => {
  /* ★기대 바뀜(Q1 · 현빈 GO 261120) — Layout 묶음(.prop-sec-group · 몸 여럿)도 절 하나로 잰다 */
  const secs = [...document.querySelectorAll('#panel-right .panel-body > .prop-section[data-sec], #panel-right .panel-body > .prop-sec-group')];
  const out = [];
  secs.forEach((s, i) => {
    if (s.classList.contains('is-collapsed')) return;
    let maxB = -Infinity;
    for (const el of s.querySelectorAll('.prop-sec-body *')) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden') maxB = Math.max(maxB, r.bottom);
    }
    if (maxB === -Infinity) return;
    out.push({ sec: s.dataset.sec || 'layout-group', last: i === secs.length - 1, gap: Math.round((s.getBoundingClientRect().bottom - maxB) * 100) / 100 });
  });
  const css = getComputedStyle(document.documentElement);
  return { gaps: out, tok: parseFloat(css.getPropertyValue('--ui-sec-body-pb')), tokLast: parseFloat(css.getPropertyValue('--ui-space-2')) };
});
/* 맨 끝 절은 틀이 패널 끝 여백(--ui-space-2)을 따로 준다 — 그 절도 «꼬리 margin 0 + 토큰» 이어야 한다 */
const judgeGaps = ({ gaps, tok, tokLast }) => gaps.filter((g) => Math.abs(g.gap - (g.last ? tokLast : tok)) > 0.5).map((g) => `${g.sec}=${g.gap}`);

test('B1 ★펼친 절 아래 여백이 전부 --ui-sec-body-pb — Effects(카드 있음)도 다른 절과 같다', async ({ page }) => {
  const errs = await scene(page);
  await openText(page);
  await page.selectOption('#txt-fx-add', 'reflect');   // 카드가 있는 Effects — 옛 14px 자리
  await expect(page.locator('#txt-fx-list'), '[전제] Effects 에 카드가 섰다').toBeAttached();
  const m = await readGaps(page);
  console.log('[B1] ' + JSON.stringify(m));
  expect(m.tok > 0 && m.tokLast > 0, '[전제] 토큰이 읽힌다').toBe(true);
  expect(m.gaps.map((g) => g.sec), '[전제] Effects 와 다른 펼친 절을 같이 잰다').toEqual(expect.arrayContaining(['effects', 'typography', 'fill']));
  expect(judgeGaps(m), `토큰 ${m.tok}px 와 다른 절`).toEqual([]);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('B1b ★내장 양성대조 — Effects 카드 꼬리에 margin 을 심으면 판정이 그 절을 잡는다', async ({ page }) => {
  await scene(page);
  await openText(page);
  await page.selectOption('#txt-fx-add', 'reflect');
  await expect(page.locator('#txt-fx-list')).toBeAttached();
  await page.evaluate(() => { const l = document.getElementById('txt-fx-list'); const last = l.lastElementChild || l; last.style.marginBottom = '17px'; });
  expect(judgeGaps(await readGaps(page)).join(' | '), '★꼬리 margin 을 못 잡는다 — B1 은 공짜 초록이다').toContain('effects=');
});

test('R1 ★Body → Tag → Body — 태그 칸이 제 절(Appearance·Fill·Size)에 섰다 걷힌다(타입 바꿈 = 다시 그림)', async ({ page }) => {
  const errs = await scene(page);
  await openText(page);
  const where = () => page.evaluate(() => Object.fromEntries(['label-radius-slider', 'label-bg-color', 'label-pill-height-slider', 'label-shape-pill']
    .map((id) => [id, document.getElementById(id)?.closest('.prop-section[data-sec]')?.dataset.sec ?? null])));
  expect(Object.values(await where()), '[전제] Body 엔 태그 칸 0').toEqual([null, null, null, null]);
  await page.click('#type-section [data-cls="tb-label"]');
  await expect(page.locator('#label-radius-slider')).toBeAttached();
  expect(await where()).toEqual({ 'label-radius-slider': 'appearance', 'label-bg-color': 'fill', 'label-pill-height-slider': 'size', 'label-shape-pill': 'typography' });
  await expect(page.locator('#type-section [data-cls="tb-label"]'), '다시 그린 패널도 Tag 가 active').toHaveClass(/active/);
  /* a11y — 다시 그린 뒤 포커스가 누른 타입 단추에 있다. 양성대조: wireTypeSection 의 `…[data-cls=…]?.focus()` 를 지우면 빨강(포커스가 body) */
  expect(await page.evaluate(() => document.activeElement?.matches?.('#type-section [data-cls="tb-label"]') ?? false), '포커스가 Tag 단추로 돌아왔다').toBe(true);
  await page.click('#type-section [data-cls="tb-body"]');
  await expect(page.locator('#label-radius-slider')).toHaveCount(0);
  await expect(page.locator('#panel-right .prop-section[data-sec="appearance"]'), 'Body 로 돌아가면 Appearance 절이 걷힌다').toHaveCount(0);
  expect(errs, errs.join(' | ')).toEqual([]);
});
