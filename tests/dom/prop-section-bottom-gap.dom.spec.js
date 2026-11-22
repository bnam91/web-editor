/* prop-section-bottom-gap.dom.spec.js — PROP-SECTION-EXPANDED-BOTTOM-GAP-14-VS-10-01 (0.9.12 별건 · 미카사 261112 · 결정 ㉠ 지디 261116)
 * 텍스트 패널: 펼친 Effects 카드 아래 → 다음 구분선 14px, 펼친 Stroke 마지막 행 → 구분선 10px.
 * 뿌리(css/editor-props.css): .prop-cell-card margin-bottom 10 + .prop-section padding-bottom 4 = 14 · .prop-row margin-bottom 6 + 4 = 10.
 * 고침 ㉠: .prop-cell-card:last-child { margin-bottom: 6px } 한 줄 — 절 끝 = 10 · 카드 «사이» 10 은 그대로.
 *   B1 ★펼친 Effects(그림자 카드) 절 끝 = 10 = 펼친 Stroke 절 끝 — 기하(마지막 내용 아래 → 다음 절 구분선 위) ＋ 계산값(margin-bottom + padding-bottom)
 *   B2 [지킴] 로렐 셀 카드 «사이» = 10(마지막 아닌 카드 margin-bottom 10px)
 * 양성대조(srv 미실행): 그 한 줄을 빼면(PROP-GAP-CTL.patch) B1 빨강(Effects 14) · B2 초록.
 *   ㉡(.prop-cell-card margin-bottom 10→6)으로 고쳤다면 B2 빨강(카드 사이 6) — B2 가 그 길을 막는다.
 * ⛔고정 대기 0 · 앱 = bootApp.
 */
const { test, expect } = require('@playwright/test');
/* ★기대 바뀜(시안 v10 · 현빈 GO 261120): 텍스트 Effects ＋ = 단추(#txt-fx-add-btn) → 종류 메뉴(#txt-fx-menu [data-fx]) — 옛 고르개 #txt-fx-add 없음 */
const { bootApp } = require('./_root-harness.js');

/** 절 끝 여백 — 그 절의 «마지막 보이는 내용» 아래 → 다음 보이는 형제 절의 위(구분선 border-top). */
const tailGap = (page, secId, lastSel) => page.evaluate(([secId, lastSel]) => {
  const sec = document.getElementById(secId);
  const last = [...sec.querySelectorAll(lastSel)].filter((e) => e.offsetParent !== null).pop();
  let next = sec.nextElementSibling; while (next && next.offsetParent === null) next = next.nextElementSibling;
  if (!last || !next) return { err: `last ${!!last} next ${!!next}` };
  const cs = (e) => getComputedStyle(e);
  return {
    geom: Math.round(next.getBoundingClientRect().top - last.getBoundingClientRect().bottom),
    calc: parseFloat(cs(last).marginBottom) + parseFloat(cs(sec).paddingBottom),
    nextBorder: cs(next).borderTopWidth,
  };
}, [secId, lastSel]);

test('B1 ★펼친 Effects 절 끝 = 펼친 Stroke 절 끝 = 10px', async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 1400 });
  const errs = await bootApp(page);
  const id = await page.evaluate(async () => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    await window.addSection();
    window.addTextBlock('body', { content: '절 끝 여백' });
    const tb = c.querySelector('.text-block[data-type="body"]'); window.selectBlock(tb.id); return tb.id;
  });
  await expect(page.locator('#txt-fx-add-btn'), '[전제] Effects 추가 목록').toBeAttached();
  await page.click('#txt-fx-add-btn').then(() => page.click('#txt-fx-menu [data-fx="shadow"]'));   // 붙이면 그 카드가 펼쳐진 채 다시 그려진다(wireFxSection)
  await expect(page.locator('#txt-fxsh-card.expanded'), '[전제] 그림자 카드 펼침').toBeVisible();
  await page.evaluate(() => { const c = document.getElementById('txt-stroke-on'); c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true })); });   // 토글 input 은 감춰져 있다(text-stroke-align.dom.spec.js 와 같은 손)
  await expect(page.locator('#txt-stroke-controls'), '[전제] Stroke 펼침').toBeVisible();
  const fx = await tailGap(page, 'txt-fx-section', '#txt-fx-list > .prop-cell-card');
  const st = await tailGap(page, 'txt-stroke-section', '#txt-stroke-controls > *');
  console.log('  B1:', JSON.stringify({ id, fx, st }));
  expect(st, 'Stroke 절 끝(기준)').toMatchObject({ geom: 10, calc: 10 });
  expect(fx, '★Effects 절 끝 = 10(옛 14)').toMatchObject({ geom: 10, calc: 10 });
  expect(errs, errs.join('\n')).toEqual([]);
});

test('B2 [지킴] 로렐 셀 카드 사이 = 10px', async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 1000 });
  const errs = await bootApp(page);
  const r = await page.evaluate(() => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    c.insertAdjacentHTML('beforeend', '<div class="section-block" data-section="1" id="sL"><div class="section-hitzone"></div><div class="section-inner"><div class="gap-block" data-type="gap" style="height:40px"></div></div></div>');
    window.rebindAll?.(); window.applyZoom?.(100);
    window.deselectAll?.(); window.selectSection(document.getElementById('sL'));
    window.addLaurelBlock({ gridCols: 2, gridRows: 2 });
    const b = [...document.querySelectorAll('#sL .laurel-block')].pop();
    window.showLaurelProperties(b);
    const cards = [...document.querySelectorAll('.prop-cell-card[data-cell-idx]')];
    if (cards.length < 2) return { n: cards.length };
    return { n: cards.length, gap: Math.round(cards[1].getBoundingClientRect().top - cards[0].getBoundingClientRect().bottom), mb: getComputedStyle(cards[0]).marginBottom };
  });
  console.log('  B2:', JSON.stringify(r));
  expect(r.n, '[전제] 셀 카드 4').toBe(4);
  expect({ gap: r.gap, mb: r.mb }, '카드 사이 10 그대로').toEqual({ gap: 10, mb: '10px' });
  expect(errs, errs.join('\n')).toEqual([]);
});
