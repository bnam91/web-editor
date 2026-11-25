/* undo-check-push-after-2 — 80행(prop-zoom.js bindCheck)과 같은 병 · 다른 자리 열하나 (0.9.14 94행 UNDO-CHECK-PUSH-BEFORE-OTHERS-01)
 *
 * ★병: 켬/끔 체크 · 줌 단일 선택 단추가 «찍고 나서» 바꿨다(push-before). 꼭대기 = 라이브(앞 칸이 push-after 이거나 막 clearHistory)면
 *   그 찍기는 js/history.js 무변화 차단에 먹힌다 ⇒ 그 조작은 자기 칸을 못 갖는다(⌘Z 가 구제 칸을 쌓고 · 다음 편집과 같이 사라진다).
 * ★재는 것 — 자리마다 «조작이 마지막 동작 · ⌘Z 한 걸음»(_history-step: 끝 표본 · 구제 없음 · 되돌림):
 *   U 블럭 자리 열(아래 SITES) · P 페이지 «에셋블록 제외»(설정만 바뀌어 캔버스 바이트가 안 변할 수 있다 ⇒ 스택 수 + 설정 값으로 직접)
 *   C0 대조 — 줌 숫자 칸(bindPair · 이미 push-after)은 같은 잣대로 초록(잣대가 이 장면에서 도는지 · 80행 spec C0 와 같음)
 * 빨강 기대: 656c06884(고치기 전) = U 열하나 중 블럭 열 · P 빨강 · C0 초록.
 * ★누르기 = 요소에 직접 .click() — 숨은 체크(label.ui-check 안 · 머리 ＋ 뒤 #txt-shadow-on)도 change 가 선다.
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const { expectOneUndoStep } = require('./_history-step.js');

const raf = (p) => p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const fillChange = (page, sel, v) => page.evaluate(([sel, v]) => { const n = document.querySelector(sel); n.value = v; n.dispatchEvent(new Event('input', { bubbles: true })); n.dispatchEvent(new Event('change', { bubbles: true })); }, [sel, v]);

/* 빈 섹션 하나 + 블럭 하나 + 그 패널 · 끝에 clearHistory(꼭대기 = 라이브 = 병이 서는 조건) */
async function scene(page, kind) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(async (kind) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    const sec = await window.addSection(); window.deselectAll(); window.selectSection(sec);
    const last = (sel) => [...sec.querySelectorAll(sel)].pop();
    const pick = (b, show) => { b.id = b.id || 'u2B'; window.deselectAll(); b.classList.add('selected'); show(b); };
    if (kind === 'asset')  { window.addAssetBlock('standard'); pick(last('.asset-block'), window.showAssetProperties); }
    if (kind === 'icb')    { window.addIconCircleBlock(); pick(last('.icon-circle-block'), window.showIconCircleProperties); }
    if (kind === 'bn2')    { window.addBanner02Block(); pick(last('.banner02-block'), window.showBanner02Properties); }
    if (kind === 'bubble') { window.addSpeechBubbleBlock('left'); pick(last('.speech-bubble-block'), window.showTextProperties); }
    if (kind === 'frame')  { window.addFrameBlock(); pick(last('.frame-block:not([data-text-frame])'), window.showFrameProperties); }
    if (kind === 'zoom')   { window.addZoomBlock(); pick(last('.zoom-block'), window.showZoomProperties); }
    if (kind === 'page')   { window.deselectAll(); window.showPageProperties(); }
    window.clearHistory?.();
  }, kind);
  return errs;
}
/* 체크 한 번 누름 */
const clickCheck = (id) => (page) => page.evaluate((id) => document.getElementById(id).click(), id);
/* 단추 무리에서 «지금 아닌» 단추 하나 누름 */
const clickOther = (group) => (page) => page.evaluate((g) => [...document.querySelectorAll(`${g} .prop-align-btn`)].find((b) => !b.classList.contains('active')).click(), group);

/* [이름, 장면, 누를 자리(대기용 셀렉터), 누르기] */
const SITES = [
  ['asset-clip-toggle',      'asset',  '#asset-clip-toggle',      clickCheck('asset-clip-toggle')],
  ['asset-checker-tone-on',  'asset',  '#asset-checker-tone-on',  clickCheck('asset-checker-tone-on')],
  ['icb-clip-toggle',        'icb',    '#icb-clip-toggle',        clickCheck('icb-clip-toggle')],
  ['bn2-fullbleed-toggle',   'bn2',    '#bn2-fullbleed-toggle',   clickCheck('bn2-fullbleed-toggle')],
  ['bubble-show-sender',     'bubble', '#bubble-show-sender',     clickCheck('bubble-show-sender')],
  ['txt-shadow-on',          'bubble', '#txt-shadow-on',          clickCheck('txt-shadow-on')],
  ['ss-fullbleed-toggle',    'frame',  '#ss-fullbleed-toggle',    clickCheck('ss-fullbleed-toggle')],
  ['zm-shape-group',         'zoom',   '#zm-shape-group',         clickOther('#zm-shape-group')],
  ['zm-drop-group',          'zoom',   '#zm-drop-group',          clickOther('#zm-drop-group')],
  ['zm-txa-group',           'zoom',   '#zm-txa-group',           clickOther('#zm-txa-group')],
];

for (const [name, kind, sel, act] of SITES) {
  test(`U ${name} — 마지막 동작 · ⌘Z 한 걸음(끝 표본)`, async ({ page }) => {
    const errs = await scene(page, kind);
    await page.waitForSelector(sel, { state: 'attached' });
    await expectOneUndoStep(page, async () => { await act(page); await raf(page); }, name);
    expect(errs, errs.join(' | ')).toEqual([]);
  });
}

test('P page-padx-asset — 설정 켬/끔이 자기 칸을 갖고 ⌘Z 한 번에 되돌아온다', async ({ page }) => {
  const errs = await scene(page, 'page');
  await page.waitForSelector('#page-padx-asset', { state: 'attached' });
  const read = () => page.evaluate(() => ({ tip: window.getHistoryTip(), v: !!window.state.pageSettings.padXExcludesAsset }));
  const s0 = await read();
  await page.evaluate(() => document.getElementById('page-padx-asset').click()); await raf(page);
  const s1 = await read();
  await page.evaluate(() => document.activeElement?.blur?.()); await page.keyboard.press('Meta+z'); await raf(page);
  const s2 = await read();
  console.log('[P 실측]', JSON.stringify({ s0, s1, s2 }));
  expect(s1.v, '★전제 — 설정이 바뀌었다').toBe(!s0.v);
  expect(s1.tip.pos - s0.tip.pos, '★끝 표본 — 켬/끔 직후 꼭대기가 새 칸(push-before 면 무변화 차단에 먹혀 0)').toBe(1);
  expect([s2.tip.len - s1.tip.len, s2.tip.pos - s1.tip.pos], '★구제 없음 — ⌘Z 가 칸을 새로 안 만들고 한 칸 내려간다').toEqual([0, -1]);
  expect(s2.v, '★되돌림 — ⌘Z 한 번 = 바꾸기 전').toBe(s0.v);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('C0 대조 — 줌 숫자 칸(bindPair · push-after)은 같은 잣대로 초록', async ({ page }) => {
  const errs = await scene(page, 'zoom');
  await page.waitForSelector('#zm-maxop-num', { state: 'attached' });
  await expectOneUndoStep(page, async () => { await fillChange(page, '#zm-maxop-num', '37'); }, 'maxop 숫자 칸');
  expect(errs, errs.join(' | ')).toEqual([]);
});
