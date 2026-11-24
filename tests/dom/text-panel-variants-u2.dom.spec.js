/* text-panel-variants-u2 — 틀 이관 뒤 «안 그리는 절»이 배선을 죽이지 않는다: 변형마다 패널을 열고 · 컨트롤 하나가 실제로 쓰고 · 페이지 오류 0.
 * (right-panel-unify U2 · 2026-11-13 · U5 평가자 교차 지적)
 *
 * ★왜 — 틀은 해당 없는 절을 display:none 이 아니라 «안 그린다». 배선이 그 칸을 가드 없이 집으면 TypeError 가 그 뒤 배선을 통째로 죽인다.
 *   게이트(panel-section-gate)는 블럭마다 «기본 변형» 하나만 연다 ⇒ 태그·글머리·말풍선(줄 모드)·서식 하위 칸 같은 변형은 여기서 연다.
 * ★정적 점검(같은 커밋): prop-text-wireup-*.js · prop-text.js · prop-quote.js · prop-label-group.js 의 조건부 칸 조회는 전부
 *   ?. / if (el) / 짝 가드 / 그릇 조기 반환 — 무가드 0.
 * 양성대조: prop-text-wireup-label.js 의 `if (rSlider) {` 가드를 풀면(rSlider.addEventListener 직행) Body 텍스트 패널(태그 모서리 칸 없음)에서
 *   V1 이 빨강(선택 evaluate 가 TypeError 로 거부되거나 pageerror).
 * V6/V7 — 곡선 텍스트·텍스트 효과 증강도 틀로(window.placeTextPanelSection): 그 변형을 열어 «게이트와 같은 판정»(judgePanel) 위반 0.
 *   양성대조: liner-transform.js 의 placeTextPanelSection 호출을 옛 `propPanel.insertAdjacentHTML('beforeend', <prop-section>)` 로 되돌리면
 *   V6 이 「머리 없는 절」로 빨강.
 * 앱 통째(bootApp) · 헤드리스 · CDP·라이브 인스턴스 무접촉.
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const { addKind } = require('./_block-roster-294.js');
const { loadSectionSpec, readPanel, judgePanel } = require('./_panel-sections.js');

async function scene(page) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(async () => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); await window.addSection(); const sec = c.querySelector('.section-block'); window.__secEl = () => sec; window.clearHistory?.(); });
  return errs;
}
async function open(page, cls, entry) {
  const r = await addKind(page, { cls, entry });
  expect(r.err, `[전제] ${cls} 를 넣었다`).toBeUndefined();
  await page.evaluate((id) => window.selectBlock(id), r.id);
  await expect(page.locator('#panel-right .prop-section[data-sec]').first(), `[전제] ${cls} 패널(틀)`).toBeAttached();
  return r.id;
}
const content = (id) => `#${id} [class^="tb-"], #${id} [class*=" tb-"]`;
const shown = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); return !!e && getComputedStyle(e).display !== 'none' && e.getClientRects().length > 0; }, sel);

test('V1 텍스트 — Body 크기 · Tag 모서리 · List 글머리 · 서식 하위 칸 4종(H·점·U·글로우) — 쓰고 · 오류 0', async ({ page }) => {
  const errs = await scene(page);
  const id = await open(page, 'text-block', 'addTextBlock');
  // Body — 글자 크기
  await page.fill('#txt-size-number', '33');
  /* 선택 없음 = 블럭 통째 — 쓰는 자리는 글자칸 또는 그 안 span(applySizeToSel) · 어느 쪽이든 «33px 이 그려졌다»를 잰다 */
  expect(await page.evaluate((id) => [document.getElementById(id), ...document.getElementById(id).querySelectorAll('*')]
    .some((e) => e.style?.fontSize === '33px'), id), 'Body 글자 크기가 먹었다').toBe(true);
  // 서식 단추 4종 — 켜면 하위 칸 줄이 선다(data-own="typography" 줄)
  for (const [btn, row] of [['txt-highlight-btn', 'txt-hl-color-row'], ['txt-dot-btn', 'txt-dot-size-row'], ['txt-underline-btn', 'txt-ul-color-row'], ['txt-glow-btn', 'txt-glow-k-row']]) {
    const before = await page.evaluate((id) => document.getElementById(id).innerHTML, id);
    await page.click(`#${btn}`);
    await expect.poll(() => shown(page, `#${row}`), `${btn} → ${row} 가 선다`).toBe(true);
    expect(await page.evaluate((id) => document.getElementById(id).innerHTML, id), `${btn} 가 글자에 썼다`).not.toBe(before);
  }
  // Tag — 다시 그린 패널에서 모서리
  await page.click('#type-section [data-cls="tb-label"]');
  await expect(page.locator('#label-radius-number')).toBeAttached();
  await page.fill('#label-radius-number', '12');
  expect(await page.evaluate((s) => document.querySelector(s).style.borderRadius, content(id)), 'Tag 모서리가 먹었다').toBe('12px');
  // List — 글머리 모양
  await page.click('#type-section [data-cls="tb-bullet"]');
  await expect(page.locator('#bullet-style-section [data-lst="square"]')).toBeAttached();
  await page.click('#bullet-style-section [data-lst="square"]');
  expect(await page.evaluate((id) => document.querySelector(`#${id} ul`)?.style.listStyleType, id), 'List 글머리가 먹었다').toBe('square');
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('V2 아이콘텍스트 — 간격 · 오류 0', async ({ page }) => {
  const errs = await scene(page);
  const id = await open(page, 'icon-text-block', 'addIconTextBlock');
  await page.fill('#itb-gap-number', '20');
  expect(await page.evaluate((id) => document.getElementById(id).style.gap, id)).toBe('20px');
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('V3 말풍선 — 발신자 토글(줄 없음 · 줄 모드 둘 다) · 오류 0', async ({ page }) => {
  const errs = await scene(page);
  const id = await open(page, 'speech-bubble-block', 'addSpeechBubbleBlock');
  await page.locator('label.ui-check:has(#bubble-show-sender)').click();   /* ★기대 바뀜(현빈 261123 ①②③ · check 부품) — 누르는 자리 = label.ui-check */
  await expect(page.locator(`#${id} .tb-sender-name`), '줄 없음 — 발신자 이름이 섰다').toBeVisible();
  // 줄 모드(D6 — 블럭 단위 글자 절을 숨기는 판)
  await expect(page.locator('#grd-line-add-kind'), '[전제] 「+ 줄 추가」').toBeAttached();
  await page.locator('#grd-line-add-kind').selectOption('h2');
  await expect.poll(() => page.evaluate((id) => JSON.parse(document.getElementById(id).dataset.lines || '[]').length, id), '[전제] 줄 모드').toBeGreaterThan(1);
  await page.evaluate((id) => { window.deselectAll?.(); window.selectBlock(id); }, id);
  await expect(page.locator('#bubble-style-section'), '줄 모드에도 Bubble 절').toBeAttached();
  await page.locator('label.ui-check:has(#bubble-show-sender)').click();   /* ★기대 바뀜(현빈 261123 ①②③ · check 부품) — 누르는 자리 = label.ui-check */
  await expect(page.locator(`#${id} .tb-sender-name`), '줄 모드 — 발신자 이름 끔이 먹었다').toBeHidden();
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('V4 인용구 — 간격 · 오류 0', async ({ page }) => {
  const errs = await scene(page);
  const id = await open(page, 'quote-block', 'addQuoteBlock');
  await page.fill('#qt-gap-number', '30');
  await page.locator('#qt-gap-number').dispatchEvent('change');
  await expect.poll(() => page.evaluate((id) => document.getElementById(id).dataset.gap, id)).toBe('30');
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('V5 태그 묶음 — 간격 · 오류 0', async ({ page }) => {
  const errs = await scene(page);
  const id = await open(page, 'label-group-block', 'addLabelGroupBlock');
  await page.fill('#lg-gap-number', '20');
  expect(await page.evaluate((id) => document.getElementById(id).style.gap, id)).toBe('20px');
  expect(errs, errs.join(' | ')).toEqual([]);
});

const SPEC = loadSectionSpec();
const setRange = (page, sel, v) => page.evaluate(({ sel, v }) => { const e = document.querySelector(sel); e.value = String(v); e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, { sel, v });

test('V6 곡선 텍스트(liner) — special 「Curve」 절이 틀로 · 게이트 판정 0 · 곡률이 쓴다 · 오류 0', async ({ page }) => {
  const errs = await scene(page);
  const id = await open(page, 'liner-block', 'addLinerBlock');
  await expect(page.locator('#liner-controls-section'), '[전제] 곡선 절').toBeAttached();
  expect(await page.evaluate(() => { const s = document.getElementById('liner-controls-section'); return [s.dataset.sec, s.querySelector(':scope > .prop-sec-head .prop-sec-title-text')?.textContent]; }))
    .toEqual(['special', 'Curve']);
  expect(judgePanel(await readPanel(page, SPEC), SPEC), '게이트 판정').toEqual([]);
  await setRange(page, '#lnr-curvature', 77);
  await expect.poll(() => page.evaluate((id) => JSON.parse(document.getElementById(id).dataset.liner || '{}').curvature, id)).toBe(77);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('V7 텍스트 효과 — Effects 절 안 한 묶음(한 key) · 게이트 판정 0 · 강도가 쓴다 · 오류 0', async ({ page }) => {
  const errs = await scene(page);
  const id = await open(page, 'text-block', 'addTextBlock');
  await page.evaluate((id) => { window.applyTextEffect(document.getElementById(id), { preset: 'neon', color: '#0033ff', glowColor: '#0033ff', intensity: 60 }); window.deselectAll?.(); window.selectBlock(id); }, id);
  await expect(page.locator('#text-effect-controls-section'), '[전제] 텍스트 효과 묶음').toBeAttached();
  expect(await page.evaluate(() => document.getElementById('text-effect-controls-section').closest('.prop-section[data-sec]')?.dataset.sec)).toBe('effects');
  expect(await page.locator('#panel-right .prop-section[data-sec="effects"]').count(), 'Effects 절은 하나').toBe(1);
  expect(judgePanel(await readPanel(page, SPEC), SPEC), '게이트 판정').toEqual([]);
  await setRange(page, '#tfx-intensity', 40);
  await expect.poll(() => page.evaluate((id) => JSON.parse(document.getElementById(id).dataset.textEffect || '{}').intensity, id)).toBe(40);
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* ★기대 바뀜(패널 재설계 1차 · 표준 절 접기 없음) — 옛 V8 은 «접힌 Typography 를 서식 단추가 연다»였다. 이제 머리를 눌러도 안 접힌다. */
test('V8 서식 단추가 드러낸 하위 칸 — Typography 머리를 눌러도 안 접히고 형광펜 색 줄이 보인다 · 오류 0', async ({ page }) => {
  const errs = await scene(page);
  await open(page, 'text-block', 'addTextBlock');
  await page.click('#psec-typography-head');
  await expect(page.locator('#psec-typography-body'), '★머리를 누르니 Typography 가 접혔다').toBeVisible();
  await page.locator('#txt-highlight-btn').dispatchEvent('click');
  await expect(page.locator('#psec-typography-body')).toBeVisible();
  await expect(page.locator('#txt-hl-color-row')).toBeVisible();
  expect(errs, errs.join(' | ')).toEqual([]);
});
