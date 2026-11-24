/* appearance-std.dom.spec.js — 표준 Appearance 절(정본 시안 8910 #mkp-appstd gdragon 88f5aa9 · 현빈 확정 261124 10:47·10:59·14:39·18:38 · 계획 handoff/PLAN-appearance-layout-std-261124 · 지디 GO A1)
 *   A1 = 부품(js/props/_appearance-section.js) + 첫 소비자 frame — 슬라이더 걷음(숫자 + 라벨 끌기) · 머리 [눈](7-2 보류 표식) · 끝 Individual corners(7-3 보류 표식)
 *   ⛔저장 키(dataset.radius)·숫자 칸 id(ss-radius-num) 무변.
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js tests/dom/appearance-std.dom.spec.js --workers=1 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

async function frameScene(page) {
  await page.setViewportSize({ width: 1700, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(async () => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    const sec = await window.addSection(); window.deselectAll?.(); window.selectSection?.(sec);
    window.addFrameBlock();
  });
  await expect(page.locator('#ss-radius-num')).toHaveCount(1);
  return errs;
}
const frameEl = (page) => page.evaluate(() => { const f = document.querySelector('#canvas .frame-block.selected'); return { r: f.dataset.radius ?? null, css: f.style.borderRadius }; });   // 고른 것 = 방금 더한 프레임(새 섹션엔 기본 프레임이 따로 하나 있다)
const setNum = (page, v) => page.evaluate((v) => { const n = document.getElementById('ss-radius-num'); n.value = String(v); n.dispatchEvent(new Event('input', { bubbles: true })); n.dispatchEvent(new Event('change', { bubbles: true })); }, v);

test('AS1 frame Appearance = 표준 꼴 — 슬라이더 없음 · 숫자 칸(옛 id)은 부품 안 · 머리 눈/끝 모서리 단추 = 보류 표식(aria-disabled + 까닭)', async ({ page }) => {
  const errs = await frameScene(page);
  const o = await page.evaluate(() => {
    const sec = document.querySelector('#panel-right .prop-section[data-sec="appearance"]');
    const eye = sec?.querySelector('.prop-sec-head #ss-app-eye'), cor = document.getElementById('ss-corners');
    return {
      slider: !!document.getElementById('ss-radius-slider'),
      inPart: !!document.getElementById('ss-radius-num')?.closest('[data-part="appearance"] [data-field="appearance-radius"]'),   // data-field 이름 = 시안 #mkp-appstd 마크업 줄(appearance-radius)
      label: sec?.querySelector('[data-part="appearance"] .ui-s2-cell > span')?.textContent,
      eye: eye ? [eye.getAttribute('aria-disabled'), /보류/.test(eye.title)] : null,
      corners: cor ? [cor.getAttribute('aria-disabled'), /보류/.test(cor.title), cor.closest('[data-part="appearance"]') === document.getElementById('ss-radius-num')?.closest('[data-part="appearance"]')] : null,
      clip: !!document.getElementById('ss-clip-toggle'),
    };
  });
  expect(o).toEqual({ slider: false, inPart: true, label: 'Corner radius', eye: ['true', true], corners: ['true', true, true], clip: true });
  expect(errs).toEqual([]);
});

test('AS2 frame 모서리 숫자 칸 — 20 → dataset.radius 20 · borderRadius 20px · 이력 1 · 200 → 80 으로 잘림(옛 0~80)', async ({ page }) => {
  const errs = await frameScene(page);
  await page.evaluate(() => { window.__ph = 0; const o = window.pushHistory; window.pushHistory = (...a) => { window.__ph++; return o?.(...a); }; });
  await setNum(page, 20);
  expect(await frameEl(page)).toEqual({ r: '20', css: '20px' });
  expect(await page.evaluate(() => window.__ph)).toBe(1);
  await setNum(page, 200);
  expect([await page.inputValue('#ss-radius-num'), (await frameEl(page)).r]).toEqual(['80', '80']);
  expect(errs).toEqual([]);
});

test('AS3 frame 모서리 라벨 끌기 — 아이콘을 오른쪽으로 15px 끌면 +15 · 놓을 때 이력 1(슬라이더 대신)', async ({ page }) => {
  const errs = await frameScene(page);
  await setNum(page, 10);
  await page.evaluate(() => { window.__ph = 0; const o = window.pushHistory; window.pushHistory = (...a) => { window.__ph++; return o?.(...a); }; });
  const h = page.locator('#ss-radius-num-scrub');
  await expect(h).toHaveCount(1);
  const b = await h.boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2 + 15, b.y + b.height / 2, { steps: 5 });
  await page.mouse.up();
  await expect.poll(() => frameEl(page)).toEqual({ r: '25', css: '25px' });
  expect([await page.inputValue('#ss-radius-num'), await page.evaluate(() => window.__ph)]).toEqual(['25', 1]);
  expect(errs).toEqual([]);
});

/* ── A2 — dataset.radius 무리(겹침 없는 넷 먼저 · 지디 261124): modal · banner02 · canvas(card) · innercard ── */
async function blockScene(page, add, numId) {
  await page.setViewportSize({ width: 1700, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(async (add) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    const sec = await window.addSection(); window.deselectAll?.(); window.selectSection?.(sec);
    (0, eval)(add);
  }, add);
  if (numId !== 'canvas') await expect(page.locator('#' + numId)).toHaveCount(1);   // 'canvas' = 칸은 뒤 단계(타입 바꿈 등)에서 선다
  return errs;
}
for (const [name, add, cls, pfx, numId, max] of [
  ['modal', 'window.addModalBlock({})', 'modal-block', 'mdl', 'mdl-radius-number', 60],
  ['banner02', 'window.addBanner02Block()', 'banner02-block', 'bn2', 'bn2-radius-num', 60],
  ['canvas', "window.addCanvasBlock(); { const b = [...document.querySelectorAll('#canvas .canvas-block')].pop(); delete b.dataset.cardMode; window.showCanvasProperties(b); }", 'canvas-block', 'cvb', 'cvb-radius-number', 60],   // 새 카드 = simple 꼴(심플카드 패널 · ⑵) → 옛 카드 패널(prop-canvas)은 cardMode 없을 때
  ['innercard', 'window.addInnerCardBlock()', 'innercard-block', 'icd', 'icd-radius-number', 60],
  /* ⑵ — 태양 F6-2b(1e30279c2) 뒤 · 줄 통보 261124 */
  ['coupon', 'window.addCouponBlock()', 'coupon-block', 'cpn', 'cpn-radius-number', 60],
  ['simple-card', 'window.addCanvasBlock()', 'canvas-block', 'cvb', 'cvb-radius-number', 60],   // 새 카드 = simple 꼴(심플카드 패널)
  ['comparison', 'window.addComparisonBlock()', 'comparison-block', 'cmp', 'cmp-rad-num', 40],
  ['chat', 'window.addChatBlock()', 'chat-block', 'chb', 'chb-radius', 400],
]) {
  test(`AS4 ${name} Appearance = 표준 꼴 + 숫자 칸 → dataset.radius · 라벨 끌기 · 이력(change 1 · 끌기 1)`, async ({ page }) => {
    const errs = await blockScene(page, add, numId);
    const part = await page.evaluate(([numId, pfx]) => {
      const sec = document.querySelector('#panel-right .prop-section[data-sec="appearance"]');
      return { slider: !!sec?.querySelector('input[type=range]'), inPart: !!document.getElementById(numId)?.closest('[data-part="appearance"] [data-field="appearance-radius"]'),
        eye: document.querySelector(`#panel-right .prop-sec-head #${pfx}-app-eye`)?.getAttribute('aria-disabled'), corners: document.getElementById(`${pfx}-corners`)?.getAttribute('aria-disabled') };
    }, [numId, pfx]);
    expect(part).toEqual({ slider: false, inPart: true, eye: 'true', corners: 'true' });
    const blockR = () => page.evaluate((cls) => [...document.querySelectorAll('#canvas .' + cls)].pop()?.dataset.radius ?? null, cls);
    await page.evaluate(() => { window.__ph = 0; const o = window.pushHistory; window.pushHistory = (...a) => { window.__ph++; return o?.(...a); }; });
    await page.evaluate((id) => { const n = document.getElementById(id); n.value = '20'; n.dispatchEvent(new Event('input', { bubbles: true })); n.dispatchEvent(new Event('change', { bubbles: true })); }, numId);
    await expect.poll(blockR).toBe('20');
    const h = page.locator(`#${numId}-scrub`); await h.scrollIntoViewIfNeeded(); const b = await h.boundingBox();   // 긴 패널(비교·챗)은 절이 화면 아래 — 사람처럼 굴려서 잡는다
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await page.mouse.down();
    await page.mouse.move(b.x + b.width / 2 + 7, b.y + b.height / 2, { steps: 4 }); await page.mouse.up();
    await expect.poll(blockR).toBe('27');
    expect([await page.inputValue('#' + numId), await page.evaluate(() => window.__ph)]).toEqual(['27', 2]);
    await page.evaluate((id) => { const n = document.getElementById(id); n.value = '999'; n.dispatchEvent(new Event('input', { bubbles: true })); n.dispatchEvent(new Event('change', { bubbles: true })); }, numId);
    await expect.poll(blockR).toBe(String(max));
    expect(errs).toEqual([]);
  });
}

/* ── AS5(지디 261124 확인): 옛 «change 때만 적용»이던 넷(modal · canvas · innercard · coupon)이 input 즉시가 됐다 —
 *   키를 여러 번 쳐도(input 여러 번) 이력은 «편집 한 번 = 한 칸»(change 때 1) · ⌘Z 한 번 = 그 편집 전 값 · 라벨 끌기 한 번도 ⌘Z 한 번. */
for (const [name, add, cls, numId] of [
  ['modal', 'window.addModalBlock({})', 'modal-block', 'mdl-radius-number'],
  ['canvas', "window.addCanvasBlock(); { const b = [...document.querySelectorAll('#canvas .canvas-block')].pop(); delete b.dataset.cardMode; window.showCanvasProperties(b); }", 'canvas-block', 'cvb-radius-number'],
  ['innercard', 'window.addInnerCardBlock()', 'innercard-block', 'icd-radius-number'],
  ['coupon', 'window.addCouponBlock()', 'coupon-block', 'cpn-radius-number'],
]) {
  test(`AS5 ${name} 숫자 칸 키 «3·5» 두 번 + Tab = 이력 1 · ⌘Z 1 = 편집 전 · 라벨 끌기 1 → ⌘Z 1 = 끌기 전`, async ({ page }) => {
    const errs = await blockScene(page, add, numId);
    const blockR = () => page.evaluate((cls) => [...document.querySelectorAll('#canvas .' + cls)].pop()?.dataset.radius ?? null, cls);
    const r0 = await blockR();
    await page.evaluate(() => { window.__ph = 0; const o = window.pushHistory; window.pushHistory = (...a) => { window.__ph++; return o?.(...a); }; });
    const n = page.locator('#' + numId); await n.scrollIntoViewIfNeeded();
    await n.click(); await page.keyboard.press('ControlOrMeta+A'); await page.keyboard.type('35'); await page.keyboard.press('Tab');
    await expect.poll(blockR).toBe('35');
    expect(await page.evaluate(() => window.__ph), '★키 두 번 = 이력 한 칸(input 마다 쌓이면 ⌘Z 가 글자로 끊긴다)').toBe(1);
    await page.evaluate(() => window.undo());
    await expect.poll(blockR, '★⌘Z 한 번 = 편집 전 값').toBe(r0);
    await page.evaluate(() => window.redo());
    await expect.poll(blockR).toBe('35');
    const h = page.locator(`#${numId}-scrub`); await h.scrollIntoViewIfNeeded(); const b = await h.boundingBox();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await page.mouse.down();
    await page.mouse.move(b.x + b.width / 2 + 6, b.y + b.height / 2, { steps: 6 }); await page.mouse.up();
    await expect.poll(blockR).toBe('41');
    expect(await page.evaluate(() => window.__ph), '★끌기 6 틱 = 이력 한 칸').toBe(2);
    await page.evaluate(() => window.undo());
    await expect.poll(blockR, '★⌘Z 한 번 = 끌기 전 값').toBe('35');
    expect(errs).toEqual([]);
  });
}

test('AS6 simple-card «이미지 모양» 슬롯 = 표준 줄 «아래»(시안 슬롯 정본 data-slot below · 지디 261124 (가))', async ({ page }) => {
  const errs = await blockScene(page, 'window.addCanvasBlock()', 'cvb-radius-number');
  const o = await page.evaluate(() => { const part = document.getElementById('cvb-radius-number').closest('[data-part="appearance"]'), shape = document.getElementById('cvb-img-shape-group');
    return { both: !!(part && shape), below: !!(part && shape) && !!(part.compareDocumentPosition(shape) & Node.DOCUMENT_POSITION_FOLLOWING) }; });
  expect(o).toEqual({ both: true, below: true });
  expect(errs).toEqual([]);
});

/* ── A3 — 키가 다른 자리(지디 261124 GO · asset·sticker·grid 는 태양 줄 대조 «겹침 0» 뒤): 숫자 칸 → 그 키 · 라벨 끌기 · 슬라이더 0 ──
 *   row(자식 카드 일괄)는 옛 card-block 자식에만 칸이 서서(지금 만드는 입구 0) 이 표에 없다 — 표적 DOM·유닛이 마크업/배선만 본다. */
const A3 = [
  { name: 'asset', numId: 'asset-r-number', eye: 'asset-app-eye', add: 'window.addAssetBlock()',
    read: "[...document.querySelectorAll('#canvas .asset-block')].pop()?.style.borderRadius ?? null", want: (v) => v + 'px' },
  { name: 'text-tag', numId: 'label-radius-number', eye: 'label-app-eye', add: "window.addTextBlock('body')",
    after: async (page) => { await page.evaluate(() => window.selectBlock([...document.querySelectorAll('#canvas .text-block')].pop().id)); await page.click('#type-section [data-cls="tb-label"]'); },
    read: "document.querySelector('#canvas .tb-label')?.style.borderRadius ?? null", want: (v) => v + 'px' },
  { name: 'label-group', numId: 'lg-item-radius-number', eye: 'lg-item-app-eye', add: "window.addLabelGroupBlock(); { const b = [...document.querySelectorAll('#canvas .label-group-block')].pop(); window.showLabelGroupProperties(b, b.querySelector('.label-item')); }",
    read: "[...document.querySelectorAll('#canvas .label-group-block')].pop()?.querySelector('.label-item')?.dataset.radius ?? null", want: (v) => String(v) },
  { name: 'radial(둥근 칸)', numId: 'rdl-cellradius-number', eye: 'rdl-app-eye', add: "window.addRadialBlock(); { const b = [...document.querySelectorAll('#canvas .radial-block')].pop(); b.dataset.cellShape = 'round'; window.renderRadialBlock?.(b); window.showRadialProperties(b); }",
    read: "[...document.querySelectorAll('#canvas .radial-block')].pop()?.dataset.cellRadius ?? null", want: (v) => String(v) },
  { name: 'sticker(글)', numId: 'stk-t-radius-num', eye: 'stk-t-app-eye', add: "window.addStickerBlock({ shape: 'text' })",
    read: "[...document.querySelectorAll('#canvas .sticker-block')].pop()?.dataset.cornerRadius ?? null", want: (v) => String(v) },
  { name: 'grid 블럭 배경', numId: 'grd-bbg-radius-num', eye: null, add: "window.addGridBlock(); { const g = [...document.querySelectorAll('#canvas .grid-block')].pop(); window.updateGridBlock(g.id, { blockBg: { on: true, color: '#ff0000' } }); window.showGridProperties(g); }",
    read: "[...document.querySelectorAll('#canvas .grid-block')].pop()?.dataset.blockBgRadius ?? null", want: (v) => String(v) },
];
for (const c of A3) {
  test(`AS7 ${c.name} — 표준 꼴(슬라이더 0 · 칸 = 부품 안${c.eye ? ' · 머리 눈 보류 표식' : ''}) · 숫자 20 → 그 키 · 라벨 끌기 +5`, async ({ page }) => {
    const errs = await blockScene(page, c.add, c.after ? 'canvas' : c.numId);
    if (c.after) { await c.after(page); await expect(page.locator('#' + c.numId)).toHaveCount(1); }
    const part = await page.evaluate(([numId, eye]) => { const n = document.getElementById(numId), sec = n?.closest('.prop-section');
      return { slider: !!n?.closest('[data-part="appearance"]')?.parentElement?.querySelector(':scope > .prop-row input[type=range][id*="radius"], :scope > .prop-row input[type=range][id*="-r-"]') || !!sec?.querySelector('input[type=range][id*="radius"]'),
        inPart: !!n?.closest('[data-part="appearance"] [data-field="appearance-radius"]'), eye: eye ? document.getElementById(eye)?.getAttribute('aria-disabled') ?? null : 'n/a' }; }, [c.numId, c.eye]);
    expect(part).toEqual({ slider: false, inPart: true, eye: c.eye ? 'true' : 'n/a' });
    const read = () => page.evaluate((x) => (0, eval)(x), c.read);
    await page.evaluate((id) => { const n = document.getElementById(id); n.value = '20'; n.dispatchEvent(new Event('input', { bubbles: true })); n.dispatchEvent(new Event('change', { bubbles: true })); }, c.numId);
    await expect.poll(read).toBe(c.want(20));
    const h = page.locator(`#${c.numId}-scrub`); await h.scrollIntoViewIfNeeded(); const b = await h.boundingBox();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await page.mouse.down();
    await page.mouse.move(b.x + b.width / 2 + 5, b.y + b.height / 2, { steps: 5 }); await page.mouse.up();
    await expect.poll(read).toBe(c.want(25));
    expect(errs).toEqual([]);
  });
}
