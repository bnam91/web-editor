/* paste-external-image.dom.spec.js — 현빈 2026-10-01 「카톡에서 이미지를 복사해 캔버스에 붙여넣기 했는데 안 된다 ·
 *   카톡뿐 아니라 캡처·인터넷 «이미지 복사» 뒤 붙여넣기도 들어가져야지 — 피그마는 되는 것 같은데」
 * 원인(7699ea33): ⌘V 가 «고디터 안 복사 시각» vs «스크래치 복사 시각»만 견줬다 — 바깥 복사는 시각을 안 남겨서,
 *   고디터 안에서 ⌘C 를 한 번이라도 했으면 바깥 이미지는 버려지고 예전 블럭이 붙었다.
 * 고침: 피그마처럼 OS 클립보드를 정답으로 — 고디터 안 ⌘C 도 OS 클립보드에 글자를 쓰고, ⌘V 때 그 글자가 그대로인지 본다.
 * 하네스: 「OS 클립보드」 = paste 이벤트의 DataTransfer(바깥 앱이 넣은 것) + electronAPI.clipboardWriteText 가짜(고디터가 쓴 것).
 * ★양성대조 판 7699ea33 → 빨강: X1 X2 / 초록: X3 X4 X5(지키는 시험).
 * ⚠️미측정 · 태양 · 2026-10-01: 카톡이 OS 클립보드에 «어떤 형식»으로 넣는지(이미지 데이터인지 파일 경로뿐인지) — 실물 미측정. */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const SEC = `<div class="section-block" id="pA" data-section="1" data-name="A"><div class="section-hitzone"></div><div class="section-inner">
<div class="gap-block" data-type="gap" style="height:60px"></div><div class="row" id="rP"><div class="text-block" data-type="body" id="tP"><div class="tb-body">안녕 고디터</div></div></div>
<div class="gap-block" data-type="gap" style="height:300px"></div></div></div>`;

async function setup(page, { osWrite }) {
  await page.setViewportSize({ width: 1500, height: 1000 });
  await bootApp(page);
  await page.evaluate(([h, osWrite]) => {
    if (osWrite) window.electronAPI = new Proxy({}, { get: (_t, k) => k === 'clipboardWriteText'
      ? (txt) => { window.__osText = String(txt); return Promise.resolve({ ok: true }); } : () => Promise.resolve(null) });
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', h); window.rebindAll?.(); window.deselectAll?.();
  }, [SEC, osWrite]);
  await page.waitForTimeout(300);
}
async function copyBlockInside(page) {
  const [x, y] = await page.evaluate(() => { const r = document.getElementById('tP').getBoundingClientRect(); return [r.left + 10, r.top + r.height / 2]; });
  await page.mouse.click(x, y); await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Meta+c'); await page.waitForTimeout(150);
  await page.mouse.click(5, 990); await page.waitForTimeout(100);       // 바닥 클릭 — 다른 앱에 다녀온 것처럼 선택 풀기
}
/* ⌘V — 키 누름 + 브라우저가 이어서 쏘는 paste 이벤트(그 순간의 OS 클립보드 내용이 실린다) */
async function pressPaste(page, { image = false, text = null, html = null } = {}) {
  await page.evaluate(([png, image, text, html]) => {
    document.activeElement?.blur?.();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'v', code: 'KeyV', metaKey: true, bubbles: true }));
    const dt = new DataTransfer();
    if (text !== null) dt.setData('text/plain', text === '__OS__' ? (window.__osText || '') : text);
    if (html !== null) dt.setData('text/html', html);
    if (image) { const b = Uint8Array.from(atob(png), c => c.charCodeAt(0)); dt.items.add(new File([b], 'clip.png', { type: 'image/png' })); }
    document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  }, [PNG, image, text, html]);
  await page.waitForTimeout(600);
}
const count = (page) => page.evaluate(() => ({ scratch: document.querySelectorAll('.scratch-item').length, blocks: document.querySelectorAll('#canvas .text-block').length }));

test('X1 ★고디터에서 ⌘C 한 뒤 바깥(캡처·카톡)에서 이미지를 복사해 ⌘V → 이미지가 들어간다, 예전 블럭은 안 붙는다', async ({ page }) => {
  await setup(page, { osWrite: true });
  await copyBlockInside(page);
  await pressPaste(page, { image: true });                                // 캡처: 클립보드엔 이미지만
  expect(await count(page)).toEqual({ scratch: 1, blocks: 1 });
});
test('X2 ★인터넷 «이미지 복사»(이미지 + <img> HTML) 도 같다', async ({ page }) => {
  await setup(page, { osWrite: true });
  await copyBlockInside(page);
  await pressPaste(page, { image: true, html: '<img src="https://example.com/a.png">' });
  expect(await count(page)).toEqual({ scratch: 1, blocks: 1 });
});
test('X3 지키는 시험 — 고디터 ⌘C 가 «최신»이면(OS 클립보드에 내가 쓴 글자 그대로) 블럭이 붙는다 · 쓴 글자는 블럭의 글', async ({ page }) => {
  await setup(page, { osWrite: true });
  await copyBlockInside(page);
  const os = await page.evaluate(() => window.__osText);
  await pressPaste(page, { text: '__OS__' });
  expect(await count(page)).toEqual({ scratch: 0, blocks: 2 });
  if (os !== undefined) expect(os).toContain('안녕 고디터');               // 옛 판은 OS 에 안 쓴다(undefined) — 새 판만 잰다
});
test('X4 지키는 시험 — OS 클립보드 쓰기가 안 되는 환경이면 옛 규칙(고디터 안 복사가 이긴다) 그대로', async ({ page }) => {
  await setup(page, { osWrite: false });
  await copyBlockInside(page);
  await pressPaste(page, { image: true });
  expect(await count(page)).toEqual({ scratch: 0, blocks: 2 });
});
test('X5 지키는 시험 — 고디터 안 복사가 없으면 바깥 이미지는 들어간다(옛 판도 됨)', async ({ page }) => {
  await setup(page, { osWrite: true });
  await pressPaste(page, { image: true });
  expect(await count(page)).toEqual({ scratch: 1, blocks: 1 });
});
