/* panel-1120b — 현빈 우측패널 피드백 배치 1120b(2026-11-20) 항목마다 «새 구조» 한 판씩.
 * 원칙: 텍스트 블럭(text-h1) 패널 부품을 다른 패널이 그대로 쓴다. 항목 = F1 · F3 · A1 · A2 · A3 · A4 · A6 · B1 · B3 · B4 · R1 · R2 · P1 · P2 · P3 · P4.
 * 양성대조(CTL): _patches/1120b-<항목>-CTL.patch 를 적용하면 그 항목 시험이 빨강(제품 변경만 되돌린다).
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js panel-1120b --workers=2 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

/* 빈 섹션 하나 + 고른 상태 — kind 별로 블럭을 넣고 그 패널을 연다. window.__b = 그 블럭 */
async function open(page, kind, pre = '') {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(async ({ kind, pre }) => {
    if (pre) (new Function(pre))();
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    await window.addSection(); const sec = c.querySelector('.section-block');
    window.deselectAll?.(); window.selectSection(sec);
    const last = (sel) => [...sec.querySelectorAll(sel)].pop();
    let b;
    if (kind === 'text') { window.addTextBlock('body', { content: '글' }); b = last('.text-block'); window.deselectAll?.(); b.classList.add('selected'); window.showTextProperties(b); }
    if (kind === 'bubble') { window.addSpeechBubbleBlock('left'); b = last('.speech-bubble-block'); window.deselectAll?.(); b.classList.add('selected'); window.showTextProperties(b); }
    if (kind === 'asset') { window.addAssetBlock('standard'); b = last('.asset-block'); window.deselectAll?.(); window.showAssetProperties(b); }
    if (kind === 'frame') { window.addFrameBlock(); b = last('.frame-block:not([data-text-frame])'); window.deselectAll?.(); window.showFrameProperties(b); }
    window.__b = b;
  }, { kind, pre });
  return errs;
}
const P = '#panel-right';
const secOf = (page, sel) => page.evaluate((sel) => document.querySelector(sel)?.closest('.prop-section[data-sec]')?.dataset.sec ?? null, sel);

test('F1 Text — «GIF» 절이 따로 있고 머리 ＋ 가 곧 GIF 단추(#open-anim-btn)', async ({ page }) => {
  const errs = await open(page, 'text');
  const r = await page.evaluate(() => {
    const b = document.getElementById('open-anim-btn'); const s = b?.closest('.prop-section[data-sec]');
    return { inHead: !!b?.closest('.prop-sec-head'), title: s?.querySelector('.prop-sec-title-text')?.textContent, chain: b?.classList.contains('prop-chain-btn'),
             bodyEmpty: (s?.querySelector('.prop-sec-body')?.textContent || '').trim() === '', visible: (b?.getClientRects().length || 0) > 0 };
  });
  expect(r).toEqual({ inHead: true, title: 'GIF', chain: true, bodyEmpty: true, visible: true });
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('F3 Text — Alignment 는 Layout 절에 있고 Layout 이 Size 위(현빈 261120 Q21 · 바꾸지 않음 확인)', async ({ page }) => {
  const errs = await open(page, 'text');
  expect(await secOf(page, '#txt-align-group')).toBe('layout');
  const order = await page.evaluate(() => [...document.querySelectorAll('#panel-right .prop-section[data-sec]')].map((s) => s.dataset.sec));
  expect(order.indexOf('layout')).toBeLessThan(order.indexOf('size'));
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('A1 Asset — 정렬 줄이 Position 절 · 라벨 «Alignment»(.prop-field-label) · 한글 «정렬» 라벨 없음', async ({ page }) => {
  const errs = await open(page, 'asset');
  expect(await secOf(page, '#asset-align-group')).toBe('position');
  const r = await page.evaluate(() => {
    const g = document.getElementById('asset-align-group');
    return { label: g.previousElementSibling?.classList.contains('prop-field-label') ? g.previousElementSibling.textContent.trim() : null,
             kor: [...document.querySelectorAll('#panel-right .prop-label, #panel-right .prop-field-label')].some((e) => e.textContent.trim() === '정렬'),
             layout: !!document.querySelector('#panel-right .prop-section[data-sec="layout"]') };
  });
  expect(r).toEqual({ label: 'Alignment', kor: false, layout: false });
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('A2 Asset — Stroke 머리 ＋(.prop-sec-add) · 꺼진 기본 = 몸 숨김 · 켜면 두께 2 · 줄 꼴 = 텍스트 Stroke', async ({ page }) => {
  const errs = await open(page, 'asset');
  const before = await page.evaluate(() => ({ add: !!document.querySelector('#panel-right .prop-section[data-sec="stroke"] .prop-sec-head .prop-sec-add > #asset-stroke-on'),
    shown: getComputedStyle(document.getElementById('asset-stroke-controls')).display !== 'none' }));
  expect(before).toEqual({ add: true, shown: false });
  const after = await page.evaluate(() => {
    const c = document.getElementById('asset-stroke-on'); c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true }));
    const ctl = document.getElementById('asset-stroke-controls');
    return { shown: getComputedStyle(ctl).display !== 'none', w: window.__b.dataset.strokeWidth,
             rows: [...ctl.children].map((e) => `${e.className}:${e.querySelector('.prop-label')?.textContent}`) };
  });
  expect(after).toEqual({ shown: true, w: '2', rows: ['prop-row:두께', 'prop-color-row:색상'] });
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('A3 Asset — 빈 에셋에 Content 절(#asset-upload-btn · psec-content) 없음', async ({ page }) => {
  const errs = await open(page, 'asset');
  const r = await page.evaluate(() => ({ btn: !!document.getElementById('asset-upload-btn'), content: !!document.querySelector('#panel-right .prop-section[data-sec="content"]') }));
  expect(r).toEqual({ btn: false, content: false });
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('A4 Asset — 「텍스트 막」 토글·조절 없음 · 옛 data-overlay 블럭도 패널이 열린다', async ({ page }) => {
  const errs = await open(page, 'asset');
  const r = await page.evaluate(() => {
    const none = !document.getElementById('asset-overlay-toggle') && !document.getElementById('asset-overlay-controls');
    window.__b.dataset.overlay = 'true'; window.showAssetProperties(window.__b);   // 옛 저장본 꼴
    return { none, reopened: !!document.getElementById('asset-bg-hex') && !document.getElementById('asset-overlay-toggle') };
  });
  expect(r).toEqual({ none: true, reopened: true });
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('A6 Asset — 배경 「초기화」(#asset-bg-clear) 없음 · 배경색 칸은 있음', async ({ page }) => {
  const errs = await open(page, 'asset');
  expect(await page.evaluate(() => ({ clear: !!document.getElementById('asset-bg-clear'), hex: !!document.getElementById('asset-bg-hex') }))).toEqual({ clear: false, hex: true });
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('B1 Bubble — 힌트 «줄 없음 — 줄을 더하면…» · #txt-pv-bubble-hint 없음(상하패딩 칸은 막힘 그대로)', async ({ page }) => {
  const errs = await open(page, 'bubble');
  const r = await page.evaluate(() => ({ hint: !!document.getElementById('txt-pv-bubble-hint'),
    lineHint: /줄 없음 — 줄을 더하면/.test(document.querySelector('#panel-right').textContent), pvDisabled: document.getElementById('txt-pv-number')?.disabled }));
  expect(r).toEqual({ hint: false, lineHint: false, pvDisabled: true });
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('B3 Bubble — Effects 머리 = ＋(.prop-sec-add 안 #txt-shadow-on) · 옛 토글 꼴 아님', async ({ page }) => {
  const errs = await open(page, 'bubble');
  const r = await page.evaluate(() => { const c = document.getElementById('txt-shadow-on');
    return { add: !!c?.closest('.prop-sec-add.prop-chain-btn'), toggle: !!c?.closest('.prop-toggle'), sec: c?.closest('.prop-section[data-sec]')?.dataset.sec }; });
  expect(r).toEqual({ add: true, toggle: false, sec: 'effects' });
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('B4 Bubble — 너비·높이 = Size 절과 같은 두 칸(prop-lhls-row > .prop-icon-input > .prop-xy-label)', async ({ page }) => {
  const errs = await open(page, 'bubble');
  const r = await page.evaluate(() => ['bubble-w-number', 'bubble-h-number'].map((id) => { const e = document.getElementById(id);
    return `${!!e?.closest('.prop-lhls-row')}:${!!e?.closest('.prop-icon-input')}:${e?.parentElement.querySelector('.prop-xy-label')?.textContent}`; }));
  expect(r).toEqual(['true:true:너비', 'true:true:높이']);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('R1 최근 색 7개가 한 줄(모든 칩 top 같음 · nowrap)', async ({ page }) => {
  const pre = `localStorage.removeItem('we_color_history_v1');`;
  const errs = await open(page, 'text', pre);
  await page.evaluate(() => { ['#111111', '#222222', '#333333', '#444444', '#555555', '#666666', '#777777'].forEach((h) => window.DesignSystem.pushColorHistory(h));
    document.dispatchEvent(new CustomEvent('colorhistory-changed')); window.showTextProperties(window.__b); });
  const r = await page.evaluate(() => { const row = document.querySelector('#panel-right .cv-recent-row');
    const tops = [...row.querySelectorAll('.cv-chip.recent')].map((c) => Math.round(c.getBoundingClientRect().top));
    return { n: tops.length, lines: new Set(tops).size, wrap: getComputedStyle(row).flexWrap }; });
  expect(r).toEqual({ n: 7, lines: 1, wrap: 'nowrap' });
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('R2 최근 효과(형광펜) 줄이 한 줄 · nowrap', async ({ page }) => {
  const pre = `localStorage.removeItem('we_text_style_history_v1');`;
  const errs = await open(page, 'text', pre);
  await page.evaluate(() => { ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#00ffff'].forEach((c, i) => window.DesignSystem.pushTextStyleHistory('hl', { '--tb-hl-color': c }, { now: i * 100000 }));
    window.showTextProperties(window.__b); });
  const r = await page.evaluate(() => { const row = document.getElementById('txt-hl-recent-row');
    const tops = [...row.querySelectorAll('.ts-chip')].map((c) => Math.round(c.getBoundingClientRect().top));
    return { some: tops.length > 1, lines: new Set(tops).size, wrap: getComputedStyle(row).flexWrap }; });
  expect(r).toEqual({ some: true, lines: 1, wrap: 'nowrap' });
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('P1 Frame — 「Radial Arrange」 없음(#ss-radial-section · 글자)', async ({ page }) => {
  const errs = await open(page, 'frame');
  const r = await page.evaluate(() => ({ sec: !!document.getElementById('ss-radial-section'), apply: !!document.getElementById('ss-radial-apply'),
    text: /Radial Arrange/.test(document.querySelector('#panel-right').textContent) }));
  expect(r).toEqual({ sec: false, apply: false, text: false });
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('P2 Frame — 간격 슬라이더(#ss-gap-slider/#ss-gap-num) 없음', async ({ page }) => {
  const errs = await open(page, 'frame');
  expect(await page.evaluate(() => !!document.getElementById('ss-gap-slider') || !!document.getElementById('ss-gap-num'))).toBe(false);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('P3 Frame — 배경 이미지가 있어도 「이미지 제거」(#ss-bg-img-clear) 없음 · 편집 단추는 있음', async ({ page }) => {
  const errs = await open(page, 'frame');
  const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const r = await page.evaluate((png) => { window.__b.dataset.bgImg = png; window.__b.style.backgroundImage = `url("${png}")`; window.showFrameProperties(window.__b);
    return { clear: !!document.getElementById('ss-bg-img-clear'), edit: !!document.getElementById('ss-bg-pos-btn') }; }, PNG);
  expect(r).toEqual({ clear: false, edit: true });
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('P4 Frame — X/Y = 텍스트 Position 두 칸(prop-lhls-row > .prop-icon-input > .prop-xy-label) · 쓰면 프레임에 간다', async ({ page }) => {
  const errs = await open(page, 'frame');
  const r = await page.evaluate(() => {
    const shape = ['ss-pos-x', 'ss-pos-y'].map((id) => { const e = document.getElementById(id);
      return `${!!e?.closest('.prop-lhls-row')}:${!!e?.closest('.prop-icon-input')}:${e?.parentElement.querySelector('.prop-xy-label')?.textContent}`; });
    const x = document.getElementById('ss-pos-x'); x.value = '12'; x.dispatchEvent(new Event('input', { bubbles: true }));
    return { shape, tx: window.__b.dataset.translateX };
  });
  expect(r).toEqual({ shape: ['true:true:X', 'true:true:Y'], tx: '12' });
  expect(errs, errs.join(' | ')).toEqual([]);
});
