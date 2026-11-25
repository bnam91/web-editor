/* undo-push-after-3 — 80·94행과 같은 병 · 단추·피커·목록 더하기/지우기·올리기 (0.9.14 97행 UNDO-PUSH-BEFORE-BUTTONS-PICKERS-01)
 *
 * ★병: 속성 패널의 단추·선택칸·목록 단추·올리기가 «찍고 나서» 바꿨다(push-before). 꼭대기 = 라이브(앞 칸이 push-after 이거나 막 clearHistory)면
 *   그 찍기는 js/history.js 무변화 차단에 먹힌다 ⇒ 그 조작은 자기 칸을 못 갖는다(⌘Z 가 구제 칸을 쌓고 · 다음 편집과 같이 사라진다).
 * ★재는 것 — 자리마다 «조작이 마지막 동작 · ⌘Z 한 걸음»(_history-step: 끝 표본 · 구제 없음 · 되돌림):
 *   U 아래 SITES(자리 서른아홉 · tests/unit/prop-push-after PA-11 명부와 한 줄씩 맞다)
 *   F 폰트 피커(공용 js/props/_font-picker.js) — 그 피커를 쓰는 배선 넷(txt · mdl-typo · qt-typo · grd-typo)
 *   C0 대조 — 줌 숫자 칸(bindPair · 이미 push-after)은 같은 잣대로 초록(잣대가 이 장면에서 도는지 · 80·94행 spec C0 와 같음)
 * 빨강 기대: ea56805d7(고치기 전) = U 전부 빨강 · F txt·grd-typo 빨강(onPick 이 기록을 안 하거나 «앞»에만 한다) ·
 *   F mdl-typo·qt-typo 초록(onPick 안의 commit 이 이미 «뒤»에 찍는다 — 대조 겸) · C0 초록.
 * ★누르기 = 요소에 직접 .click()/dispatch — 접힌 절 안 칸도 이벤트가 선다. 올리기(U annot-label-img-upload)만 진짜 마우스(파일 고르기 창은 사용자 활성이 있어야 뜬다).
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const { expectOneUndoStep } = require('./_history-step.js');

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
const GIF_B64 = 'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

const raf = (p) => p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const fillChange = (page, sel, v) => page.evaluate(([sel, v]) => { const n = document.querySelector(sel); n.value = v; n.dispatchEvent(new Event('input', { bubbles: true })); n.dispatchEvent(new Event('change', { bubbles: true })); }, [sel, v]);

/* 빈 섹션 하나 + 블럭 하나 + 그 패널 · 끝에 clearHistory(꼭대기 = 라이브 = 병이 서는 조건) */
async function scene(page, kind) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(async ([kind, PNG]) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    const sec = await window.addSection(); window.deselectAll(); window.selectSection(sec);
    const inner = sec.querySelector('.section-inner');
    const last = (sel) => [...sec.querySelectorAll(sel)].pop();
    const pick = (b, show) => { b.id = b.id || 'u3B'; window.deselectAll(); b.classList.add('selected'); show(b); return b; };
    const grid = (cols, rows, addr) => {
      inner.insertAdjacentHTML('beforeend', '<div class="row" id="u3R" data-layout="stack"></div>');
      const { block: g } = window.makeGridBlock({ cols, rows: rows || [{ height: 'auto' }] });
      g.id = 'u3B'; document.getElementById('u3R').appendChild(g); window.rebindAll?.(); window.renderGridBlock(g);
      window.deselectAll(); g.classList.add('selected'); window.showGridProperties(g, addr);
    };
    const B2 = { width: 1, lines: [{ type: 'body', text: 'B' }] };
    if (kind === 'annot' || kind === 'annotImg') {
      const b = window.makeAnnotationBlock(kind === 'annot' ? { points: [[200, 160], [500, 160]], text: 'A' }
        : { points: [[20, 20], [160, 90]], text: 'A', labelMode: 'image', labelImageSrc: PNG });
      b.id = 'u3B'; inner.appendChild(b); window.showAnnotationProperties(b);
    }
    if (kind === 'chat')     { window.addChatBlock({ messages: [{ text: 'm1', align: 'left' }, { text: 'm2', align: 'right' }] }); pick(last('.chat-block'), window.showChatProperties); }
    if (kind === 'banner')   { window.addBannerBlock('frame_8'); pick(last('.frame-block[data-banner-preset]'), window.showFrameProperties); }
    if (kind === 'frameImg') { window.addFrameBlock(); const f = last('.frame-block:not([data-text-frame])'); f.dataset.bgImg = PNG; f.style.backgroundImage = `url("${PNG}")`; pick(f, window.showFrameProperties); }
    if (kind === 'gap')      { window.addGapBlock(40); pick(last('.gap-block'), window.showGapProperties); }
    if (kind === 'gridImg')  grid([{ width: 1, lines: [{ type: 'image', src: PNG, height: 80 }] }, B2], null, { r: 0, c: 0, li: 0 });
    if (kind === 'gridGap')  grid([{ width: 1, lines: [{ type: 'body', text: 'A' }, { type: 'gap', height: 16 }, { type: 'body', text: 'C' }] }, B2], null, { r: 0, c: 0, li: 1 });
    if (kind === 'gridDiv')  grid([{ width: 1, lines: [{ type: 'body', text: 'A' }, { type: 'divider', height: 4, color: '#000000' }, { type: 'body', text: 'C' }] }, B2], null, { r: 0, c: 0, li: 1 });
    if (kind === 'gridText') grid([{ width: 1, lines: [{ type: 'body', text: 'A', fontSize: 30 }] }, B2], null, { r: 0, c: 0, li: 0 });
    if (kind === 'gridRows') grid([{ width: 1, lines: [{ type: 'body', text: 'A' }] }], [{ height: 100 }, { height: 100 }], null);   // 행 높이 칸은 행 ≥2 일 때만 뜬다(prop-grid _rowHeightHtml)
    if (kind === 'lg' || kind === 'lgShape') {
      if (kind === 'lgShape') {
        try { localStorage.removeItem('we_label_shapes_v1'); } catch {}
        await window.DesignSystem.restoreLabelShapesFromMeta(null);
        window.DesignSystem.setLabelShape('oval', { kind: 'ellipse', bg: '#ff0000' });
      }
      window.addLabelGroupBlock(); const b = last('.label-group-block'); b.id = 'u3B';
      const it = b.querySelector('.label-item'); it.classList.add('item-selected'); window.showLabelGroupProperties(b, it);
    }
    if (kind === 'mockup' || kind === 'mockupCap') {
      if (kind === 'mockupCap') { const src = await window.addSection(); src.id = 'u3Src'; window.deselectAll(); window.selectSection(sec); }
      window.addDeviceMockupBlock('iphone'); pick(last('.mockup-block'), window.showMockupProperties);
    }
    if (kind === 'modal')    { window.addModalBlock({}); pick(last('.modal-block'), window.showModalProperties); }
    if (kind === 'quote')    { window.addQuoteBlock({ text: '안녕' }); pick(last('.quote-block'), window.showQuoteProperties); }
    if (kind === 'page')     { window.addTextBlock('body'); window.deselectAll(); window.showPageProperties(); }
    if (kind === 'sec')      { await window.showSectionProperties(sec); }
    if (kind === 'secImg')   { sec.dataset.bgImg = PNG; await window.showSectionProperties(sec); }
    if (kind === 'stkText')  { window.addStickerBlock({ shape: 'text' }); pick(last('.sticker-block'), window.showStickerProperties); }
    if (kind === 'stkIcon')  { window.addStickerBlock({ shape: 'icon' }); pick(last('.sticker-block'), window.showStickerProperties); }
    if (kind === 'bubble' || kind === 'bubbleFixed') {
      window.addSpeechBubbleBlock('left'); const tb = last('.speech-bubble-block');
      if (kind === 'bubbleFixed') { tb.dataset.bubbleSize = 'fixed'; tb.dataset.bubbleW = '300'; tb.dataset.bubbleH = '80'; }
      pick(tb, window.showTextProperties);
    }
    if (kind === 'label') {
      window.addTextBlock('label'); const tb = [...sec.querySelectorAll('.text-block')].find((t) => t.querySelector('.tb-label'));
      tb.querySelector('.tb-label').style.borderRadius = '3px';   // 어느 모양 단추를 눌러도 «바뀐다»(A0)
      pick(tb, window.showTextProperties);
    }
    if (kind === 'text')     { window.addTextBlock('body'); pick(last('.text-block'), window.showTextProperties); }
    if (kind === 'zoom')     { window.addZoomBlock(); const z = last('.zoom-block'); z.dataset.imgSrc = PNG; z.dataset.lx = '120'; z.dataset.ly = '90'; window.renderZoomBlock(z); pick(z, window.showZoomProperties); }   // 렌더 안 하면 조작 전 화면엔 has-image 가 없고 ⌘Z(복원=재렌더) 뒤엔 있다 ⇒ A3 거짓 빨강(C0 까지)
    window.clearHistory?.();
  }, [kind, PNG]);
  return errs;
}
const ev = (fn, arg) => (page) => page.evaluate(fn, arg);
const click = (sel) => ev((s) => document.querySelector(s).click(), sel);
/* 단추 무리에서 «지금 아닌» 단추 하나 누름 */
const clickOther = (group) => ev((g) => [...document.querySelectorAll(`${g} .prop-align-btn`)].find((b) => !b.classList.contains('active')).click(), group);
/* 선택칸을 «지금 아닌» 첫 값으로 바꿈 */
const selectOther = (sel) => ev((s) => { const n = document.querySelector(s); const o = [...n.options].find((x) => x.value && x.value !== n.value); n.value = o.value; n.dispatchEvent(new Event('change', { bubbles: true })); }, sel);
const fill = (sel, v) => (page) => fillChange(page, sel, v);

/* [이름, 장면, 대기용 셀렉터, 조작, 옵션] — 이름 = 자리(파일:줄 @ea56805d7) */
const SITES = [
  ['annotation:637 label-mode',      'annot',     '#annot-label-mode-group', click('#annot-label-mode-group [data-mode="image"]')],
  ['annotation:688 label-img-upload', 'annotImg', '#annot-label-img-upload', async (page) => {
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#annot-label-img-upload')]);
    await fc.setFiles({ name: 'u3.gif', mimeType: 'image/gif', buffer: Buffer.from(GIF_B64, 'base64') });
  }, { settleMs: 800 }],
  ['annotation:700 label-img-remove', 'annotImg', '#annot-label-img-remove', click('#annot-label-img-remove')],
  ['chat:368 del-msg',               'chat',      '.chb-del-btn',            click('.chb-del-btn[data-idx="0"]')],
  ['chat:467 add-msg',               'chat',      '#chb-add-msg',            click('#chb-add-msg')],
  ['frame:150 banner-swap',          'banner',    '#ss-banner-swap-btn',     click('#ss-banner-swap-btn')],
  ['frame:663 banner-preset',        'banner',    '#ss-banner-preset',       async (page) => { await page.evaluate(() => { window.confirm = () => true; }); await selectOther('#ss-banner-preset')(page); }],
  ['frame:914 bg-size',              'frameImg',  '#ss-bg-size',             selectOther('#ss-bg-size')],
  ['gap:48 preset',                  'gap',       '.gap-preset-btn',         ev(() => [...document.querySelectorAll('.gap-preset-btn')].find((b) => parseInt(b.dataset.h) !== 40).click())],
  ['grid:2060 img-height',           'gridImg',   '#grd-img-height',         fill('#grd-img-height', '120')],
  ['grid:3782 gap-line-h',           'gridGap',   '#grd-line-gap-h',         fill('#grd-line-gap-h', '60')],
  ['grid:3798 divider-h',            'gridDiv',   '#grd-divider-h',          fill('#grd-divider-h', '8')],
  ['grid:3860 line-reset',           'gridText',  '#grd-line-reset',         click('#grd-line-reset')],
  ['grid:4448 row-h',                'gridRows',  '.grd-row-h-item',         fill('.grd-row-h-item[data-ri="0"]', '200')],
  ['label-group:188 style-select',   'lg',        '#lg-style-select',        selectOther('#lg-style-select')],
  ['label-group:208 apply-all',      'lg',        '#lg-apply-all-btn',       ev(() => { const n = document.getElementById('lg-style-select'); n.value = [...n.options].find((x) => x.value && x.value !== n.value).value; document.getElementById('lg-apply-all-btn').click(); })],
  ['label-group:253 shape-link',     'lgShape',   '#lg-shape-link',          ev(() => { const n = document.getElementById('lg-shape-link'); n.value = 'oval'; n.dispatchEvent(new Event('change', { bubbles: true })); })],
  ['mockup:173 shadow',              'mockup',    '#mkp-shadow-group',       clickOther('#mkp-shadow-group')],
  ['mockup:203 capture',             'mockupCap', '#mkp-capture-btn',        ev(() => { document.getElementById('mkp-sec-id-input').value = 'u3Src'; document.getElementById('mkp-capture-btn').click(); }), { settleMs: 3000 }],
  ['modal:527 color-chip',           'modal',     '#mdl-typo-color-chips .cv-chip[data-cv-name="accent"]', click('#mdl-typo-color-chips .cv-chip[data-cv-name="accent"]')],
  /* 쪽 일괄 정렬 단추는 패널이 disabled 로 낸다(prop-page «일시 비활성») — disabled 면 .click() 이 안 선다 ⇒ 풀고 누른다.
     «오른쪽»을 고른다: 글 블럭 기본이 왼쪽이라 왼쪽을 누르면 화면이 안 바뀐다(A0). */
  ['page:620 align',                 'page',      '#page-align-right',       ev(() => { const b = document.getElementById('page-align-right'); b.disabled = false; b.click(); })],
  ['section:1224 checker',           'sec',       '#sec-bg-chk-light',       click('#sec-bg-chk-light')],
  ['section:1238 bg-size',           'secImg',    '#sec-bg-size',            selectOther('#sec-bg-size')],
  ['section:1248 bg-img-remove',     'secImg',    '#sec-bg-img-remove',      click('#sec-bg-img-remove')],
  ['sticker:1031 text-preset',       'stkText',   '#stk-preset-select',      selectOther('#stk-preset-select')],
  ['sticker:1042 icon-replace',      'stkIcon',   '#stk-icon-replace',       ev(() => {
    window.openIconifyModal = (cb) => cb({ name: 'u3:sq', svg: '<svg viewBox="0 0 24 24"><path d="M2 2h20v20H2z"/></svg>' });
    document.getElementById('stk-icon-replace').click();
  })],
  ['bubble:21 style-select',         'bubble',    '#bubble-style-select',    selectOther('#bubble-style-select')],
  ['bubble:29 tail',                 'bubble',    '#bubble-tail-right',      click('#bubble-tail-right')],
  ['bubble:76 size-mode',            'bubble',    '#bubble-size-mode',       ev(() => { const n = document.getElementById('bubble-size-mode'); n.value = 'fixed'; n.dispatchEvent(new Event('change', { bubbles: true })); })],
  ['bubble:100 w-number',            'bubbleFixed', '#bubble-w-number',      fill('#bubble-w-number', '420')],
  ['label:151 shape-pill',           'label',     '#label-shape-pill',       click('#label-shape-pill')],
  ['label:160 shape-box',            'label',     '#label-shape-box',        click('#label-shape-box')],
  ['label:169 shape-outline',        'label',     '#label-shape-outline',    click('#label-shape-outline')],
  ['label:180 shape-circle',         'label',     '#label-shape-circle',     click('#label-shape-circle')],
  ['label:203 shape-oval',           'label',     '#label-shape-oval',       click('#label-shape-oval')],
  ['label:213 shape-text',           'label',     '#label-shape-text',       click('#label-shape-text')],
  ['text-edit:1215 color-chip',      'text',      '#txt-color-chips .cv-chip[data-cv-name="accent"]', click('#txt-color-chips .cv-chip[data-cv-name="accent"]')],
  ['zoom:477 img-clear',             'zoom',      '#zm-img-clear',           click('#zm-img-clear')],
  ['zoom:486 ab-reset',              'zoom',      '#zm-ab-reset',            click('#zm-ab-reset')],
];

for (const [name, kind, sel, act, opts] of SITES) {
  test(`U ${name} — 마지막 동작 · ⌘Z 한 걸음(끝 표본)`, async ({ page }) => {
    const errs = await scene(page, kind);
    await page.waitForSelector(sel, { state: 'attached' });
    await expectOneUndoStep(page, async () => { await act(page); await raf(page); }, name, opts || {});
    expect(errs, errs.join(' | ')).toEqual([]);
  });
}

/* F — 공용 폰트 피커(_font-picker.js:191). 트리거를 열고 «지금 아닌» 글꼴 하나를 고른다(목록은 mousedown 위임). */
const pickFont = (p) => ev((p) => {
  document.getElementById(`${p}-font-trigger`).click();
  const it = [...document.querySelectorAll(`#${p}-font-list .font-item`)].find((i) => i.dataset.value && !i.classList.contains('selected'));
  it.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
}, p);
const FONT_SITES = [
  ['txt',      'text'],       // prop-text-wireup-font.js — 글 블럭(말풍선 포함 · showTextProperties)
  ['mdl-typo', 'modal'],      // prop-modal.js
  ['qt-typo',  'quote'],      // prop-quote.js
  ['grd-typo', 'gridText'],   // prop-grid.js _grdWireTypo — 그리드 줄(그리고 line-host 주인: 버블·챗·비교·월계·카드)
];
for (const [p, kind] of FONT_SITES) {
  test(`F font-picker ${p} — 글꼴 고르기 = 마지막 동작 · ⌘Z 한 걸음`, async ({ page }) => {
    const errs = await scene(page, kind);
    await page.waitForSelector(`#${p}-font-trigger`, { state: 'attached' });
    await expectOneUndoStep(page, async () => { await pickFont(p)(page); await raf(page); }, `font ${p}`);
    expect(errs, errs.join(' | ')).toEqual([]);
  });
}

test('C0 대조 — 줌 숫자 칸(bindPair · push-after)은 같은 잣대로 초록', async ({ page }) => {
  const errs = await scene(page, 'zoom');
  await page.waitForSelector('#zm-maxop-num', { state: 'attached' });
  await expectOneUndoStep(page, async () => { await fillChange(page, '#zm-maxop-num', '37'); }, 'maxop 숫자 칸');
  expect(errs, errs.join(' | ')).toEqual([]);
});
