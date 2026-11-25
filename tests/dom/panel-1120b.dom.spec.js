/* ★기대 바뀜(현빈 261123 ①②③ · 태양 §2c check) — 바뀐 칸의 토글 스위치(label.prop-toggle · .prop-toggle-track) → check 부품(label.ui-check · input.ui-check-box) */
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
             rows: [...ctl.querySelectorAll('[data-field]')].filter((e) => !e.closest('.ui-stroke-pop, .ui-stroke-slot')).map((e) => e.dataset.field) };   // 표준 줄 칸만(⫶ 팝오버 · □ 면별 슬롯 칸은 stroke-std S7·S11 이 잰다)
  });
  expect(after).toEqual({ shown: true, w: '2', rows: ['stroke-color', 'stroke-align', 'stroke-width'] });   // ★기대 바뀜(현빈 261123 표준 Stroke 부품 · 8910 strokestd2): 옛 줄 [두께 · 색상] → 부품 칸 [색 · 위치 · 굵기] — 머리 ＋·꺼짐 = 몸 숨김·켜면 2 는 그대로
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
    window.__b.dataset.overlay = 'true'; window.__b.dataset.bgColor = '#a0a0a0'; window.showAssetProperties(window.__b);   // 옛 저장본 꼴 · ★기대 바뀜(74행 cf680cce1): 색 키 없는 새 에셋은 «칠 없음 + ＋»라 색 칸이 없다 → 색 있는 에셋으로 «패널이 열린다»를 잰다
    return { none, reopened: !!document.getElementById('asset-bg-hex') && !document.getElementById('asset-overlay-toggle') };
  });
  expect(r).toEqual({ none: true, reopened: true });
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('A6 Asset — 배경 「초기화」(#asset-bg-clear) 없음 · 배경색 칸은 있음', async ({ page }) => {
  const errs = await open(page, 'asset');
  // ★기대 바뀜(74행 cf680cce1): 색 키 없는 새 에셋 = «칠 없음 + ＋»(색 칸 없음) → 색 있는 에셋에서 «색 칸 있음 · 초기화 없음»을 잰다
  await page.evaluate(() => { window.__b.dataset.bgColor = '#a0a0a0'; window.showAssetProperties(window.__b); });
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
    return { add: !!c?.closest('.prop-sec-add.prop-chain-btn'), toggle: !!c?.closest('.ui-check'), sec: c?.closest('.prop-section[data-sec]')?.dataset.sec }; });
  expect(r).toEqual({ add: true, toggle: false, sec: 'effects' });
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* ★기대 바뀜(L4b · 현빈 L-2): 너비·높이 두 칸 = 표준 Layout W/H 줄(.ui-layout[data-part=layout] > .prop-icon-input[data-field=layout-w|h]) + 모드 드롭다운 줄(layout-mode-w) — 옛 prop-lhls-row 두 칸 · 자동/고정 세그먼트 걷음 */
test('B4 Bubble — 너비·높이 = 표준 Layout W/H 칸 + 모드 줄(L4b)', async ({ page }) => {
  const errs = await open(page, 'bubble');
  const r = await page.evaluate(() => ['bubble-w-number', 'bubble-h-number', 'bubble-size-mode'].map((id) => { const e = document.getElementById(id);
    return `${!!e?.closest('.ui-layout[data-part="layout"]')}:${e?.closest('.prop-icon-input')?.dataset.field}`; }));
  expect(r).toEqual(['true:layout-w', 'true:layout-h', 'true:layout-mode-w']);
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
  const r = await page.evaluate(() => { const row = document.getElementById('txt-fx-recent-row');   /* ★기대 바뀜 1120b R2c — 형광펜 최근은 합친 줄 */
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

/* ── 2차(현빈 결정 261120): A5 · B2 · B5 ── */
test('A5 Asset — «체커 어둡게» = 「내용 자르기」와 같은 토글(.prop-toggle 체크박스) · 켬/끔 = dark/키 없음', async ({ page }) => {
  const errs = await open(page, 'asset');
  const r = await page.evaluate(() => {
    const t = document.getElementById('asset-checker-tone-on'), clip = document.getElementById('asset-clip-toggle');
    const shape = (e) => `${e?.type}:${e?.parentElement?.className}:${!!e?.parentElement?.querySelector('.prop-toggle-track')}`;
    const same = shape(t) === shape(clip);
    t.checked = true; t.dispatchEvent(new Event('change', { bubbles: true })); const on = window.__b.dataset.checkerTone ?? null;
    t.checked = false; t.dispatchEvent(new Event('change', { bubbles: true })); const off = window.__b.dataset.checkerTone ?? null;
    return { same, radios: document.querySelectorAll('#panel-right input[name="asset-checker-tone"]').length, on, off };
  });
  expect(r).toEqual({ same: true, radios: 0, on: 'dark', off: null });
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('B2 Bubble — 배경색 줄 = Fill 색 줄과 같은 부품(.prop-color-field: 스와치 + HEX + %) · 값은 따로(--bubble-bg) · Bubble 절', async ({ page }) => {
  const errs = await open(page, 'bubble');
  const r = await page.evaluate(() => {
    const cls = (id) => { const f = document.getElementById(id)?.closest('.prop-color-field'); return f ? [...f.querySelectorAll('input')].map((i) => i.className || i.type).join(',') : null; };
    const sec = document.getElementById('bubble-bg-hex')?.closest('.prop-section[data-sec]')?.dataset.secState;
    const hex = document.getElementById('bubble-bg-hex'); hex.value = 'FF0000'; hex.dispatchEvent(new Event('input', { bubbles: true })); hex.dispatchEvent(new Event('change', { bubbles: true }));
    return { same: cls('bubble-bg-hex') === cls('txt-color-hex'), alpha: !!document.getElementById('bubble-bg-alpha'), sec,
             bg: window.__b.style.getPropertyValue('--bubble-bg').trim().toLowerCase() };
  });
  expect(r).toEqual({ same: true, alpha: true, sec: 'special:Bubble', bg: '#ff0000' });
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('B5 Text — «스타일 번호» 카드 하나(.prop-cell-card > header·body) · 접힘 시작 · Enter 로 펼침 · 줄 id 그대로', async ({ page }) => {
  const pre = `try { localStorage.removeItem('goditor.textStyleCodeFold.open'); } catch (_) {}`;
  const errs = await open(page, 'text', pre);
  const r = await page.evaluate(() => {
    const h = document.getElementById('txt-code-fold-toggle'); const card = h?.closest('.prop-cell-card'); const body = card?.querySelector(':scope > .prop-cell-card-body');
    const rowsIn = ['hl', 'dot', 'ul'].map((k) => body?.contains(document.getElementById(`txt-${k}-code-row`)));
    const start = { exp: h?.getAttribute('aria-expanded'), hidden: body?.hidden, title: h?.querySelector('.prop-cell-card-title')?.textContent, header: h?.classList.contains('prop-cell-card-header') };
    h.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    return { rowsIn, start, after: { exp: h.getAttribute('aria-expanded'), hidden: body.hidden }, cards: document.querySelectorAll('#txt-code-fold-card').length };
  });
  expect(r).toEqual({ rowsIn: [true, true, true], start: { exp: 'false', hidden: true, title: '스타일 번호 3', header: true }, after: { exp: 'true', hidden: false }, cards: 1 });
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* 1120b 후속(지디 261121 · 지혜맥 실물 png 21장에서 본 것) — R2b 라벨 «최/근» 꺾임 · B5b 스타일 번호 세 줄 라벨·placeholder 잘림
 * 양성대조: _patches/1120b-R2b-CTL.patch(라벨 nowrap·안 줄음 걷음 → R2b 빨강) · _patches/1120b-B5b-CTL.patch(라벨·placeholder·라벨 폭 되돌림 → B5b 빨강) */
test('R2b 최근 효과 줄(형광펜·점·글로우) «최근» 라벨 = 색 최근 라벨과 같은 높이(한 줄) · 칩 5개 안 잘림', async ({ page }) => {
  const pre = `localStorage.removeItem('we_text_style_history_v1'); localStorage.removeItem('we_color_history_v1');`;
  const errs = await open(page, 'text', pre);
  await page.evaluate(() => {
    ['#111111', '#222222', '#333333', '#444444', '#555555', '#666666', '#777777'].forEach((h) => window.DesignSystem.pushColorHistory(h));
    document.dispatchEvent(new CustomEvent('colorhistory-changed'));
    const VAR = { hl: '--tb-hl-color', dot: '--tb-dot-color', glow: '--tb-glow-color', ul: '--tb-ul-color' };   // ul = 칩 5개로 꽉 찬 줄(R2c 뒤 라벨이 눌리는 자리 — 아래 주석)
    for (const k of Object.keys(VAR)) ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#00ffff'].forEach((c, i) => window.DesignSystem.pushTextStyleHistory(k, { [VAR[k]]: c }, { now: i * 100000 }));
    window.showTextProperties(window.__b);
  });
  const r = await page.evaluate(() => {
    const lab = (row) => row?.querySelector(':scope > .cv-chips-label')?.offsetHeight ?? null;
    const out = { color: lab(document.querySelector('#panel-right .cv-recent-row')) };
    /* ★기대 바뀜 1120b R2c(현빈 261121) — 세 줄 → 합친 «최근 효과» 한 줄 · 칩 수 = TEXT_STYLE_FX_RECENT_MAX(그 줄 폭에서 잰 수) */
    const row = document.getElementById('txt-fx-recent-row'); const n = row?.querySelectorAll('.ts-chip').length ?? 0;
    out.fx = { h: lab(row), n, fits: !!row && row.scrollWidth <= row.clientWidth };   // 줄은 overflow:hidden — 넘치면 scrollWidth 가 커진다
    out.max = window.DesignSystem.TEXT_STYLE_FX_RECENT_MAX;
    /* R2c 뒤 합친 줄은 칩 4개(설계폭)라 라벨이 안 눌린다 = nowrap 을 걷어도 초록(인텔 261121 R2b-CTL 52/52 초록).
       라벨이 눌리는 자리는 kind 별 큐 5개가 그대로 차는 밑줄 줄(칩이 24.5 로 눌려 들어감) ⇒ 그 줄 라벨도 잰다(같은 공용 .cv-chips-label). */
    const ul = document.getElementById('txt-ul-recent-row'); out.ul = { h: lab(ul), n: ul?.querySelectorAll('.ts-chip').length ?? 0, fits: !!ul && ul.scrollWidth <= ul.clientWidth };
    return out;
  });
  expect(r.color, '[전제] 색 최근 라벨이 섰다').toBeGreaterThan(0);
  expect(r.max, '[전제] 합친 줄 칸 수 상수').toBeGreaterThan(0);
  expect(r.fx, `★합친 최근 라벨 높이 = 색 최근 라벨(${r.color}) · 칩 ${r.max} 안 잘림`).toEqual({ h: r.color, n: r.max, fits: true });
  expect(r.ul, `★밑줄 최근(칩 5 · 꽉 찬 줄) 라벨 높이 = 색 최근 라벨(${r.color}) · 칩 5 안 잘림`).toEqual({ h: r.color, n: 5, fits: true });
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('B5b 스타일 번호 카드 세 줄 라벨 = 형광펜·점·밑줄 · placeholder «번호 붙여넣기» 가 칸 안에 다 듦 · id·복사 단추 무변', async ({ page }) => {
  const errs = await open(page, 'text');
  await page.evaluate(() => { const h = document.getElementById('txt-code-fold-toggle'); if (h && h.getAttribute('aria-expanded') !== 'true') h.click(); });
  const r = await page.evaluate(() => {
    const cv = document.createElement('canvas').getContext('2d');
    return ['hl', 'dot', 'ul'].map((k) => {
      const i = document.getElementById(`txt-${k}-code`); const cs = getComputedStyle(i); cv.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      const room = i.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight); const l = i.parentElement.querySelector('.prop-label');
      return { label: l?.textContent, labelFits: l ? l.scrollWidth <= l.clientWidth : false, ph: i.placeholder, phFits: room > 0 && Math.ceil(cv.measureText(i.placeholder).width) <= room, copy: !!document.getElementById(`txt-${k}-code-copy`) };
    });
  });
  const want = (label) => ({ label, labelFits: true, ph: '번호 붙여넣기', phFits: true, copy: true });
  expect(r).toEqual([want('형광펜'), want('점'), want('밑줄')]);
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* 1120b R2c(현빈 261121 확정 «형광펜·점·글로우 최근 = 셋 합쳐 한 줄») — 합친 줄 하나 · 최근 사용순(kind 섞임) · 칩 = 제 kind 그림 · 누르면 제 kind 입힘 · 한 줄 높이
 * 양성대조: _patches/1120b-R2c-CTL.patch(제품 셋만 되돌림 → 합친 줄 없음 → R2c 빨강) */
test('R2c 형광펜·점·글로우 최근 = 합친 한 줄 · 최근 사용순 · 칩이 제 kind 를 입힌다 · 밑줄 줄은 그대로', async ({ page }) => {
  const pre = `localStorage.removeItem('we_text_style_history_v1');`;
  const errs = await open(page, 'text', pre);
  await page.evaluate(() => {
    const DS = window.DesignSystem, W = DS.TEXT_STYLE_COALESCE_MS * 2;   // 창 밖 시각 — 넷이 따로 쌓인다
    DS.pushTextStyleHistory('hl', { '--tb-hl-color': '#ff0000' }, { now: 1e6 });
    DS.pushTextStyleHistory('dot', { '--tb-dot-color': '#00aa00' }, { now: 1e6 + W });
    DS.pushTextStyleHistory('glow', { '--tb-glow-color': '#0000ff' }, { now: 1e6 + 2 * W });
    DS.pushTextStyleHistory('hl', { '--tb-hl-color': '#ffaa00' }, { now: 1e6 + 3 * W });
    DS.pushTextStyleHistory('ul', { '--tb-ul-thick': '3px' }, { now: 1e6 + 4 * W });
    window.showTextProperties(window.__b);
  });
  const r = await page.evaluate(() => {
    const row = document.getElementById('txt-fx-recent-row');
    const chips = row ? [...row.querySelectorAll('.ts-chip')] : [];
    return {
      rows: document.querySelectorAll('#panel-right .ts-recent-row:not(#txt-ul-recent-row):not(#txt-grad-recent-row)').length,
      old: ['hl', 'dot', 'glow'].filter((k) => document.getElementById(`txt-${k}-recent-row`)),
      ul: document.getElementById('txt-ul-recent-row')?.querySelectorAll('.ts-chip').length ?? null,
      seq: chips.map((c) => c.dataset.tsK + c.dataset.tsI),
      prev: chips.map((c) => c.querySelector('.ts-chip-prev')?.className.split(' ').find((x) => /^tb-(hl|dot|glow)$/.test(x)) ?? null),
      lines: new Set(chips.map((c) => Math.round(c.getBoundingClientRect().top))).size,
      oneLine: !!row && row.offsetHeight <= Math.max(...chips.map((c) => c.offsetHeight)) + 1,
      wrap: row ? getComputedStyle(row).flexWrap : null,
    };
  });
  expect(r.old, '★kind 별 옛 줄(형광펜·점·글로우)이 남았다').toEqual([]);
  expect(r.rows, '★형광펜·점·글로우 최근 줄은 하나').toBe(1);
  expect(r.seq, '★최근 사용순(kind 섞임) — 최근 hl → glow → dot → 옛 hl').toEqual(['hl0', 'glow0', 'dot0', 'hl1']);
  expect(r.prev, '★칩 그림 = 제 kind 제품 클래스(모양으로 갈린다)').toEqual(['tb-hl', 'tb-glow', 'tb-dot', 'tb-hl']);
  expect({ lines: r.lines, oneLine: r.oneLine, wrap: r.wrap }, '★한 줄 · 줄 높이 = 칩 한 줄').toEqual({ lines: 1, oneLine: true, wrap: 'nowrap' });
  expect(r.ul, '★밑줄 최근 줄은 결정 범위 밖 — 제 줄 그대로').toBe(1);

  /* 칩 클릭 = 제 kind 입힘 — kind 마다 새 글 블럭에서 누르고 그 kind span 만 생겼는지 */
  for (const [k, cls] of [['dot', 'tb-dot'], ['glow', 'tb-glow'], ['hl', 'tb-hl']]) {
    await page.evaluate(() => { const sec = window.__b.closest('.section-block'); window.selectSection(sec); window.addTextBlock('body', { content: '가나' });
      const b = [...sec.querySelectorAll('.text-block')].pop(); window.deselectAll?.(); b.classList.add('selected'); window.showTextProperties(b); window.__c = b; });
    /* ★기대 바뀜(P-2 SECTION_ORDER v1 · 탑 통합 261125) — Typography 가 패널 아래로 내려가 1000px 창에서 화면 밖(실측 y 1018) → 누르기 전 스크롤 */
    await page.locator(`#txt-fx-recent-row .ts-chip[data-ts-k="${k}"]`).first().scrollIntoViewIfNeeded();
    const box = await page.locator(`#txt-fx-recent-row .ts-chip[data-ts-k="${k}"]`).first().boundingBox();
    expect(box, `[전제] ${k} 칩이 보인다`).toBeTruthy();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForFunction(() => !!window.__c.querySelector('span.tb-hl, span.tb-dot, span.tb-glow'), null, { timeout: 5000 }).catch(() => {});   // 안 생기면 아래 단언이 빨강
    const got = await page.evaluate(() => ['tb-hl', 'tb-dot', 'tb-glow'].filter((c) => window.__c.querySelector('span.' + c)));
    expect(got, `★${k} 칩을 눌렀더니 ${JSON.stringify(got)}`).toEqual([cls]);
  }
  expect(errs, errs.join(' | ')).toEqual([]);
});
