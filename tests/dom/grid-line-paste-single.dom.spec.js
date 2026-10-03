/* grid-line-paste-single.dom.spec.js — G10 (현빈 2026-10-03) 「칸을 복붙하려는데 클립보드와 «동시에» 붙여넣어진다」
 * 측정(604602cd, 진짜 마우스·키): 칸 줄 ⌘C → ⌘V 에서 OS 클립보드가 «비었거나 글»이면 줄만 +1(정상).
 *   OS 클립보드에 «바깥에서 복사해 둔 이미지»가 남아 있으면 줄 +1 «그리고» 스크래치 이미지 +1 (동시에 두 개).
 * 원인: 줄 ⌘C(grdCopySelectedLines)는 블럭 ⌘C(copySelected)와 달리 «내 복사가 최신»을 선언하지 않는다
 *   (_internalClipboardTime·OS 쓰기 없음). 그래서 OS 의 옛 이미지가 그대로 남고, ⌘V 의 keydown 은 줄을 붙이는데
 *   뒤따르는 paste 이벤트는 scratch-pad 가 «이미지 있고 고디터 복사가 최신 아님»으로 읽어 이미지를 또 붙인다.
 *   (10-01 ccfee753 「OS 클립보드를 정답으로」는 블럭 ⌘C 만 이 선언을 하도록 만들었다 — 줄 ⌘C 가 빠져 있었다.)
 * 고침: 줄 ⌘C 도 editor.js claimInternalClipboard 로 선언(OS 에 줄 글자를 쓰고 시각을 남긴다).
 * 하네스의 「OS 클립보드」= 상태 객체 하나: 바깥 앱이 넣은 이미지 + electronAPI.clipboardWriteText 가짜(쓰면 이미지가 «대체»된다 — 실제 OS 와 같다).
 * ★양성대조: GD1001_ROOT=<604602cd 체크아웃> → G1 G2 빨강 / G3 G4 G5 초록(지키는 시험).
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js --workers=1 grid-line-paste-single */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const COLS = '[{&quot;width&quot;:1,&quot;lines&quot;:[{&quot;type&quot;:&quot;body&quot;,&quot;text&quot;:&quot;가&quot;},{&quot;type&quot;:&quot;body&quot;,&quot;text&quot;:&quot;나&quot;}]},{&quot;width&quot;:1,&quot;lines&quot;:[{&quot;type&quot;:&quot;body&quot;,&quot;text&quot;:&quot;다&quot;}]}]';
const SEC = `<div class="section-block" id="sG" data-section="1" data-name="G"><div class="section-hitzone"></div><div class="section-inner">
<div class="gap-block" data-type="gap" style="height:60px"></div><div class="row" id="rG"><div class="grid-block" id="gG" data-type="grid" data-gap="24" data-valign="top" data-cols="${COLS}"></div></div>
<div class="gap-block" data-type="gap" style="height:400px"></div></div></div>`;

async function setup(page, { osWrite = true, osImage = false } = {}) {
  await page.setViewportSize({ width: 1500, height: 1000 });
  await bootApp(page);
  await page.evaluate(([h, osWrite, osImage]) => {
    window.__os = { text: null, image: osImage };        // 가짜 OS 클립보드
    if (osWrite) window.electronAPI = new Proxy({}, { get: (_t, k) => k === 'clipboardWriteText'
      ? (txt) => { window.__os = { text: String(txt), image: false }; return Promise.resolve({ ok: true }); } : () => Promise.resolve(null) });
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', h); window.rebindAll?.(); window.deselectAll?.();
    window.renderGridBlock?.(document.getElementById('gG'));
  }, [SEC, osWrite, osImage]);
  await page.waitForTimeout(400);
}
const lineXY = (page, c, li) => page.evaluate(([c, li]) => { const e = document.querySelector(`#gG [data-r="0"][data-c="${c}"][data-line="${li}"]`); const r = e.getBoundingClientRect(); return [r.left + 8, r.top + r.height / 2]; }, [c, li]);
async function selectLine(page, c, li) {
  let [x, y] = await lineXY(page, c, li);
  await page.mouse.click(x, y); await page.waitForTimeout(150);          // 첫 클릭 = 블럭
  [x, y] = await lineXY(page, c, li);
  await page.mouse.click(x, y); await page.waitForTimeout(250);          // 둘째 = 줄
  await page.evaluate(() => document.activeElement?.blur?.());
}
/* ⌘V — 키 누름 + 브라우저가 이어서 쏘는 paste 이벤트(그 순간의 «가짜 OS 클립보드» 내용이 실린다) */
async function pressPaste(page) {
  await page.evaluate((png) => {
    document.activeElement?.blur?.();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'v', code: 'KeyV', metaKey: true, bubbles: true }));
    const dt = new DataTransfer();
    if (window.__os.text !== null) dt.setData('text/plain', window.__os.text);
    if (window.__os.image) { const b = Uint8Array.from(atob(png), c => c.charCodeAt(0)); dt.items.add(new File([b], 'clip.png', { type: 'image/png' })); }
    document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  }, PNG);
  await page.waitForTimeout(600);
}
const snap = (page) => page.evaluate(() => ({
  cell0: document.querySelectorAll('#gG [data-r="0"][data-c="0"][data-line]').length,
  grids: document.querySelectorAll('#canvas .grid-block').length,
  scratch: document.querySelectorAll('.scratch-item').length,
}));

test('G1 ★바깥에서 이미지를 복사해 둔 채 칸 줄 ⌘C → ⌘V : 줄만 +1, 스크래치 이미지는 안 붙는다', async ({ page }) => {
  await setup(page, { osImage: true });
  await selectLine(page, 0, 0);
  expect(await snap(page)).toEqual({ cell0: 2, grids: 1, scratch: 0 });      // 전제: 줄이 골라졌다고 믿기 전에 복사 전 수
  await page.keyboard.press('Meta+c'); await page.waitForTimeout(200);
  expect(await page.evaluate(() => window.__os.image)).toBe(false);           // 전제: 줄 ⌘C 가 OS 클립보드를 «자기 것»으로 바꿨다
  await pressPaste(page);
  expect(await snap(page)).toEqual({ cell0: 3, grids: 1, scratch: 0 });
});
test('G2 ★OS 에 쓰기가 안 되는 환경에서도(옛 시각 규칙) 이미지가 같이 붙지 않는다', async ({ page }) => {
  await setup(page, { osWrite: false, osImage: true });
  await selectLine(page, 0, 0);
  await page.keyboard.press('Meta+c'); await page.waitForTimeout(200);
  await pressPaste(page);
  expect(await snap(page)).toEqual({ cell0: 3, grids: 1, scratch: 0 });
});
test('G3 지키는 시험 — OS 클립보드가 비었어도 줄만 +1', async ({ page }) => {
  await setup(page);
  await selectLine(page, 0, 0);
  await page.keyboard.press('Meta+c'); await page.waitForTimeout(200);
  await pressPaste(page);
  expect(await snap(page)).toEqual({ cell0: 3, grids: 1, scratch: 0 });
});
test('G4 지키는 시험 — 줄을 복사한 적 없이 바깥 이미지를 붙이면 스크래치에 들어간다(10-01 ccfee753)', async ({ page }) => {
  await setup(page, { osImage: true });
  await pressPaste(page);
  expect(await snap(page)).toEqual({ cell0: 2, grids: 1, scratch: 1 });
});
test('G5 지키는 시험 — 줄 ⌘C 뒤에도 «블럭» 복사 길은 그대로(줄을 안 고르면 그리드 블럭이 복사된다)', async ({ page }) => {
  await setup(page, { osImage: true });
  const [x, y] = await lineXY(page, 0, 0);
  await page.mouse.click(x, y); await page.waitForTimeout(250);              // 블럭만 선택(줄 선택 아님)
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Meta+c'); await page.waitForTimeout(200);
  await pressPaste(page);
  expect(await snap(page)).toEqual({ cell0: 2, grids: 2, scratch: 0 });
});
