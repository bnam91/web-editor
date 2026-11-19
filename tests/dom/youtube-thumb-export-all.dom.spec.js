/* youtube-thumb-export-all.dom.spec.js — t13C-03 Q4 «전체 내보내기»에서 유튜브 썸네일 섹션을 뺀다 (현빈 권장안 · 261119 · 태양)
 *   A1 ★exportAllSections(780 쿠팡 · 860) — 보통 섹션 둘만 나간다(파일 2 · 썸네일 sectionId 없음) · 파일 이름 순번은 그대로(section 순번 = 화면 순번)
 *   A2 ★페이지 패널 버튼 수 — 썸네일만 있으면 꺼짐 · 보통 섹션 둘이면 «전체 2개» · Export 메뉴 PNG 도 썸네일만이면 «내보낼 섹션이 없습니다»
 *   A3 지키는 칸 — 썸네일 섹션 «한 장» 내보내기는 그대로 된다(섹션 칸 길)
 * ★양성대조: _patches/yt-thumb-q4-exclude.patch (exportAllTargets 가 거르지 않음) ⇒ A1 빨강(파일 3 · 썸네일 포함) · A2 의 Export 메뉴 칸 빨강.
 *   prop-page _secCount 줄만 되돌리면 A2 버튼 칸 빨강(패치 없음 — 같은 꼴 한 줄).
 * 실행: NODE_PRESERVE_SYMLINKS=1 node --preserve-symlinks-main node_modules/@playwright/test/cli.js test \
 *        --config=tests/dom/playwright.dom.config.js --retries=0 --workers=1 tests/dom/youtube-thumb-export-all.dom.spec.js
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

/* main.js 'capture-section-cdp' 흉내(export-width-1000-upscale installCdpCapture 와 같은 손) */
async function installCdpCapture(page) {
  const cdp = await page.context().newCDPSession(page);
  await page.exposeFunction('__cdpShot', async ({ x = 0, y = 0, width, height, scale = 1 }) => {
    const s = Number(scale); const clipScale = (s > 0 && s <= 4) ? s : 1;
    const r = await cdp.send('Page.captureScreenshot', { format: 'png', clip: { x: Math.round(x), y: Math.round(y), width: Math.ceil(width), height: Math.ceil(height), scale: clipScale }, captureBeyondViewport: true, fromSurface: true });
    return r.data;
  });
  await page.evaluate(() => {
    const old = window.electronAPI;
    window.electronAPI = new Proxy({}, { get: (t, k) => (k === 'captureSectionCdp' ? (o) => window.__cdpShot(o) : old[k]) });
  });
}
const sec = (id, thumb) => `
  <div class="section-block" id="${id}" data-section="1" data-name="${id}"${thumb ? ' data-thumb="youtube" data-height-pin="true" style="height:484px;background-color:#204080"' : ' style="background-color:#ffffff"'}>
    <div class="section-inner"><div class="row"><div class="gap-block" style="height:120px"></div></div></div>
  </div>`;
const setCanvas = (page, html) => page.evaluate((html) => { document.getElementById('canvas').innerHTML = html; window.rebindAll?.(); }, html);

test('A1 ★전체 내보내기(780 · 860)는 썸네일 섹션을 뺀다', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  const errs = await bootApp(page);
  await installCdpCapture(page);
  await setCanvas(page, sec('pA', false) + sec('tY', true) + sec('pB', false));
  const r = await page.evaluate(async () => {
    window.__dl = [];
    const a0 = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () { if (this.download) window.__dl.push(this.download); };
    const out = {};
    for (const w of [780, 860]) {
      window.__dl.length = 0;
      const res = await window.exportAllSections('png', w, null, { gate: false });
      out[w] = { total: res.total, failed: res.failed, ids: res.results.map(x => x.sectionId), files: window.__dl.slice() };
    }
    HTMLAnchorElement.prototype.click = a0;
    return out;
  });
  console.log('  A1:', JSON.stringify(r));
  for (const w of ['780', '860']) {
    expect(r[w].total, `${w} 전체 수`).toBe(2);
    expect(r[w].failed).toEqual([]);
    expect(r[w].ids, `${w} — 썸네일이 섞여 나갔다`).toEqual(['pA', 'pB']);
    expect(r[w].files.length, `${w} 파일 수`).toBe(2);
  }
  expect(errs, errs.join('\n')).toEqual([]);
});

test('A2 ★페이지 패널 버튼 수 · Export 메뉴 PNG — 썸네일은 세지 않는다', async ({ page }) => {
  const errs = await bootApp(page);
  await setCanvas(page, sec('tY', true));
  await page.evaluate(() => window.showPageProperties());
  await expect(page.locator('#page-export-all-btn'), '썸네일만 있는데 전체 내보내기가 켜져 있다').toBeDisabled();
  const toast = await page.evaluate(async () => {
    const seen = []; const t0 = window.showToast; window.showToast = (m) => seen.push(String(m));
    let called = 0; const ea = window.exportAllSections; window.exportAllSections = async () => { called++; return { total: 0, failed: [], results: [] }; };
    await window.exportAllImagesPNG?.();
    window.showToast = t0; window.exportAllSections = ea;
    return { seen, called, has: typeof window.exportAllImagesPNG };
  });
  expect(toast.has, '★전제 — Export 메뉴 PNG 입구').toBe('function');
  expect(toast.called, '썸네일만 있는데 Export 메뉴 PNG 가 전체 내보내기를 돌렸다').toBe(0);
  expect(toast.seen).toContain('내보낼 섹션이 없습니다.');
  await page.evaluate((h) => document.getElementById('canvas').insertAdjacentHTML('beforeend', h), sec('pA', false) + sec('pB', false));
  await expect(page.locator('#page-export-all-btn')).toBeEnabled();
  await expect(page.locator('#page-export-all-btn'), '수에 썸네일이 섞였다').toHaveAttribute('title', '전체 2개 섹션을 내보냅니다');
  expect(errs, errs.join('\n')).toEqual([]);
});

test('A3 지키는 칸 — 썸네일 섹션 한 장 내보내기는 그대로 된다', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  const errs = await bootApp(page);
  await installCdpCapture(page);
  await setCanvas(page, sec('pA', false) + sec('tY', true));
  const r = await page.evaluate(async () => {
    const u = await window.exportSection(document.getElementById('tY'), 'png', 1280, { returnDataUrl: true });
    const im = new Image(); im.src = u; await im.decode();
    return [im.naturalWidth, im.naturalHeight];
  });
  expect(r).toEqual([1280, 720]);
  expect(errs, errs.join('\n')).toEqual([]);
});
