/* t13g-01-grid-img-paste2.dom.spec.js — 0.9.13 183행 t13G-01(현빈 261122 · t13A-01 재오픈 잔여)
 *   ① 그림 줄 ⌘C → «다른 칸» 글 줄 고르고 ⌘V = 그 칸에 그림 줄 +1
 *   ② 그림 줄 ⌘C → 섹션에 ⌘V = 에셋 블럭이 «그림 비율»(정방형 아님)
 *   ③ 메뉴 길(미카사 재현): «편집›복사/붙여넣기» = 네이티브 copy/paste 사건만(keydown 0) — 키 길과 같은 결과
 *   그림 = 4×2 PNG(비율 2:1 · 정방형이면 빨강). setup·누를 점 = t13a-01-grid-img-paste 와 같은 꼴(조건 대기 · 고정 대기 0). */
const { test, expect } = require('@playwright/test');
const { bootApp, waitZoomSettled } = require('./_root-harness.js');
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAQAAAACCAIAAADwyuo0AAAAEElEQVR4nGP4z8AARwzIHABvqgf5gNwAKAAAAABJRU5ErkJggg==';
const SRC = 'data:image/png;base64,' + PNG;
const q = (o) => JSON.stringify(o).replace(/"/g, '&quot;');
const COLS = q([{ width: 1, lines: [{ type: 'body', text: '가' }, { type: 'image', imgSrc: SRC }] }, { width: 1, lines: [{ type: 'body', text: '다' }] }]);
const SEC = `<div class="section-block" id="sG" data-section="1" data-name="G"><div class="section-hitzone"></div><div class="section-inner">
<div class="gap-block" data-type="gap" style="height:60px"></div><div class="row" id="rG"><div class="grid-block" id="gG" data-type="grid" data-gap="24" data-valign="top" data-cols="${COLS}"></div></div>
<div class="gap-block" data-type="gap" style="height:400px"></div></div></div>`;

async function setup(page) {
  await page.setViewportSize({ width: 1500, height: 1000 });
  await bootApp(page);
  await page.evaluate((h) => {
    window.__os = { text: null };
    window.electronAPI = new Proxy({}, { get: (_t, k) => k === 'clipboardWriteText'
      ? (txt) => { window.__os = { text: String(txt) }; return Promise.resolve({ ok: true }); } : () => Promise.resolve(null) });
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    c.insertAdjacentHTML('beforeend', h); window.rebindAll?.(); window.deselectAll?.();
    window.renderGridBlock?.(document.getElementById('gG'));
  }, SEC);
  await page.waitForFunction(() => { const e = document.querySelector('#gG .grd-img-frame[data-line="1"]') || document.querySelector('#gG [data-r="0"][data-c="0"][data-line="1"]'); const r = e?.getBoundingClientRect(); const im = e?.querySelector('img'); return r && r.height > 0 && (!im || im.complete); });
  await waitZoomSettled(page, await page.evaluate(() => window.currentZoom));
}
const SEL = { img: '#gG [data-r="0"][data-c="0"][data-line="1"]', text1: '#gG [data-r="0"][data-c="1"][data-line="0"]' };
async function pointAt(page, which) {
  let p = null, prev = '';
  await expect.poll(async () => {
    p = await page.evaluate(([which, s]) => { const e = (which === 'img' && document.querySelector('#gG .grd-img-frame[data-line="1"]')) || document.querySelector(s); const r = e.getBoundingClientRect();
      const x = which === 'img' ? r.left + r.width / 2 : r.left + 8, y = r.top + r.height / 2; return { x, y, own: !!document.elementFromPoint(x, y)?.closest('#gG') }; }, [which, SEL[which]]);
    const k = `${p.x},${p.y}`, same = k === prev; prev = k; return p.own && same;
  }, { message: `[전제] ${which} 점의 임자가 그리드이고 자리가 멎었다`, intervals: [50] }).toBe(true);
  return [p.x, p.y];
}
const frames2 = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
async function selectLine(page, which) {
  for (let i = 0; i < 2; i++) {
    const [x, y] = await pointAt(page, which); await page.mouse.click(x, y);
    await page.waitForFunction((i) => { const b = document.getElementById('gG'); return i === 0 ? !!b?.classList.contains('selected') : ((window.grdGetLineSel?.(b) || []).length > 0 || window.grdGetActiveLine?.(b)); }, i);
  }
  await page.evaluate(() => document.activeElement?.blur?.());
}
const imgLinesIn = (page, r, c) => page.evaluate(([r, c]) => window.getGridModel(document.getElementById('gG')).cells[r][c].lines.filter((l) => l.type === 'image').length, [r, c]);
/* 붙여넣기 — key = keydown(⌘V) + 따라오는 paste 사건(앱 키 길) · menu = paste 사건만(메뉴 «편집›붙여넣기» = role paste = 네이티브 사건) */
async function paste(page, how) {
  await page.evaluate((how) => {
    document.activeElement?.blur?.();
    if (how === 'key') document.dispatchEvent(new KeyboardEvent('keydown', { key: 'v', code: 'KeyV', metaKey: true, bubbles: true }));
    const dt = new DataTransfer(); if (window.__os.text !== null) dt.setData('text/plain', window.__os.text);
    document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  }, how);
  await page.waitForTimeout(0); await frames2(page); await frames2(page);
}
async function copy(page, how) {
  if (how === 'key') await page.keyboard.press('Meta+c');
  else await page.evaluate(() => { const dt = new DataTransfer(); document.dispatchEvent(new ClipboardEvent('copy', { clipboardData: dt, bubbles: true, cancelable: true })); });
  await frames2(page);
}

for (const how of ['key', 'menu']) {
  test(`G1-${how} 그림 줄 복사 → 다른 칸 글 줄 고르고 붙여넣기 = 그 칸에 그림 줄 +1`, async ({ page }) => {
    await setup(page);
    await selectLine(page, 'img');
    await copy(page, how);
    expect(await imgLinesIn(page, 0, 1), '[전제] 오른 칸 그림 줄 0').toBe(0);
    await selectLine(page, 'text1');
    await paste(page, how);
    await expect.poll(() => imgLinesIn(page, 0, 1), { message: `★${how} — 다른 칸에 그림 줄이 안 들어갔다`, timeout: 5000 }).toBe(1);
  });
  test(`G2-${how} 그림 줄 복사 → 섹션에 붙여넣기 = 에셋 블럭이 그림 비율(2:1 · 정방형 아님)`, async ({ page }) => {
    await setup(page);
    await selectLine(page, 'img');
    await copy(page, how);
    await page.evaluate(() => { window.deselectAll(); window.selectSectionWithModifier?.(document.getElementById('sG')); });
    await paste(page, how);
    await expect.poll(() => page.evaluate(() => document.querySelectorAll('#canvas .asset-block').length), { message: `★${how} — 섹션에 에셋이 안 붙었다`, timeout: 5000 }).toBe(1);
    const r = await page.evaluate(() => { const a = document.querySelector('#canvas .asset-block'); return a.offsetWidth / a.offsetHeight; });
    expect(Math.abs(r - 2), `★${how} — 에셋 비율 ${r.toFixed(2)} (그림 2:1)`).toBeLessThan(0.05);
  });
}

/* G5 [지킴] 메뉴 길 처리기가 «남의 일»을 안 가로챈다 — 입력칸 글 복사 = 네이티브 그대로(preventDefault 0) · 다른 처리기가 먹은 paste 엔 고디터 붙여넣기 0 */
test('G5 [지킴] 입력칸 글 복사는 네이티브 · 남이 먹은 paste 엔 안 덧붙인다', async ({ page }) => {
  await setup(page);
  await selectLine(page, 'img');
  await copy(page, 'key');   // 고디터 클립보드에 무엇인가 들어 있게
  const r = await page.evaluate(() => {
    const inp = document.createElement('input'); inp.value = 'abc'; document.body.appendChild(inp); inp.focus(); inp.select();
    const ev = new ClipboardEvent('copy', { clipboardData: new DataTransfer(), bubbles: true, cancelable: true }); inp.dispatchEvent(ev);
    const prevented = ev.defaultPrevented; inp.remove(); return prevented;
  });
  expect(r, '입력칸 글 복사를 가로챘다').toBe(false);
  const before = await page.evaluate(() => document.querySelectorAll('#canvas .asset-block').length);
  await page.evaluate(() => {
    window.deselectAll(); window.selectSectionWithModifier?.(document.getElementById('sG'));
    const eater = (e) => e.preventDefault(); document.addEventListener('paste', eater, { once: true, capture: true });   // «남의 처리기»가 먹음
    document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: new DataTransfer(), bubbles: true, cancelable: true }));
  });
  await frames2(page); await page.waitForTimeout(100);
  expect(await page.evaluate(() => document.querySelectorAll('#canvas .asset-block').length), '남이 먹은 paste 에 고디터 붙여넣기가 덧붙었다').toBe(before);
});
