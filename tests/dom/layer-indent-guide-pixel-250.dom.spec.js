/* layer-indent-guide-pixel-250.dom.spec.js — 들여쓰기 칸을 span 없이 CSS 한 벌로 그려도 안내선이 픽셀까지 같은가(★250 ㉠).
 *
 * 판정 = 같은 패널·같은 자리를 옛 꼴(칸마다 span + ::before)로 갈아 끼우고 찍어 RGB 를 비교한다. 깊이 0~7 · 고른 행 · 호버 행 · 배율 1·2.
 * 실측: 안내선 위치·폭은 같고 그 픽셀만 합성 반올림으로 1/255 다르다(64 vs 63 · 알파를 38/255 로 맞춰도 그대로) ⇒ 상한 = 채널 차 1.
 * 자의 양성대조: 안내선을 1px 옮기면 차이가 난다. ⛔못 보는 꼴: 라이트 테마 값(이 레포 패널은 어두운 판 하나) · 배율 1·2 밖.
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { ROOT, ORIGIN } = require('./_root-harness.js');
const PID = 'proj_1700000000250';
test.describe.configure({ timeout: 60000 });
const MIME = { '.js': 'application/javascript', '.mjs': 'application/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.png': 'image/png' };
const OLD_CSS = `.layer-indents.old{display:flex;flex-shrink:0;align-items:stretch;align-self:stretch;width:auto;background:none}
.old .layer-indent{width:16px;flex-shrink:0;position:relative}
.old .layer-indent::before{content:'';position:absolute;left:5px;top:0;bottom:0;border-left:1px solid rgba(255,255,255,0.15)}
.old .layer-indent:last-child::before{border-left:none}`;

async function boot(page) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  await page.addInitScript(() => { window.electronAPI = new Proxy({}, { get: () => (() => Promise.resolve(null)) }); });
  await page.route(`${ORIGIN}/**`, async (r) => {
    const u = new URL(r.request().url());
    const f = path.join(ROOT, decodeURIComponent(u.pathname));
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return r.fulfill({ status: 404, body: '' });
    return r.fulfill({ contentType: MIME[path.extname(f)] || 'application/octet-stream', body: fs.readFileSync(f) });
  });
  await page.goto(`${ORIGIN}/index.html?project=${PID}`);
  await page.waitForFunction(() => typeof window.rebindAll === 'function' && typeof window.buildLayerPanel === 'function', null, { timeout: 20000 });
  return page.evaluate((css) => {
    document.getElementById('canvas').querySelectorAll('.section-block').forEach((s) => s.remove());
    window.addSection();
    const sec = document.querySelector('#canvas > .section-block'); let par = null;
    for (let i = 0; i < 6; i++) { window.deselectAll(); window.selectSection(sec); window._activeFrame = par; const had = new Set(sec.querySelectorAll('.frame-block')); window.addFrameBlock(); par = [...sec.querySelectorAll('.frame-block')].find((x) => !had.has(x)); }
    window._activeFrame = null; window.deselectAll(); window.selectBlock(par.id); window.buildLayerPanel();
    const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    document.querySelectorAll('.layer-indents').forEach((e) => { for (let n = e.parentElement; n; n = n.parentElement) n.classList.remove('collapsed'); });   // 접힌 행은 칸이 0 이라 못 찍는다
    return { depths: [...document.querySelectorAll('.layer-indents')].filter((e) => e.getBoundingClientRect().height > 0).map((e) => +e.style.getPropertyValue('--depth')) };
  }, OLD_CSS);
}
const panelClip = (page) => page.evaluate(() => { const rows = [...document.querySelectorAll('.layer-indents')].map((e) => e.getBoundingClientRect()).filter((r) => r.height > 0); const l = Math.min(...rows.map((r) => r.left)), t = Math.min(...rows.map((r) => r.top)), b = Math.max(...rows.map((r) => r.bottom)), w = Math.max(...rows.map((r) => r.width)); return { x: l, y: t, width: Math.max(1, w + 8), height: b - t }; });
const toOld = (page) => page.evaluate(() => { document.querySelectorAll('.layer-indents').forEach((e) => { const d = +e.style.getPropertyValue('--depth'); e.classList.add('old'); for (let i = 0; i < d; i++) { const s = document.createElement('span'); s.className = 'layer-indent'; e.appendChild(s); } }); });
const shot = async (page, clip) => (await page.screenshot({ clip, animations: 'disabled', caret: 'initial' })).toString('base64');
const diff = (page, a, b) => page.evaluate(async ([a, b]) => { const dec = async (s) => { const i = new Image(); i.src = 'data:image/png;base64,' + s; await i.decode(); const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(i, 0, 0); return { w: i.width, h: i.height, d: x.getImageData(0, 0, i.width, i.height).data }; }; const A = await dec(a), B = await dec(b); let n = 0, max = 0, lit = 0; const xs = {}, ys = {}; let sample = null; for (let i = 0; i < A.d.length; i += 4) { const m = Math.max(Math.abs(A.d[i] - B.d[i]), Math.abs(A.d[i + 1] - B.d[i + 1]), Math.abs(A.d[i + 2] - B.d[i + 2])); if (m) { n++; const x = (i / 4) % A.w, y = Math.floor(i / 4 / A.w); xs[x] = (xs[x] || 0) + 1; ys[y] = (ys[y] || 0) + 1; sample ||= [x, y, [...A.d.slice(i, i + 3)], [...B.d.slice(i, i + 3)]]; } if (m > max) max = m; if (A.d[i] !== A.d[0] || A.d[i + 1] !== A.d[1] || A.d[i + 2] !== A.d[2]) lit++; } return { sameSize: A.w === B.w && A.h === B.h, n, max, lit, w: A.w, h: A.h, xs, ys: Object.keys(ys).length, sample }; }, [a, b]);

for (const dpr of [1, 2]) {
  test.describe(`배율 ${dpr}`, () => {
    test.use({ deviceScaleFactor: dpr });
    test('G1 깊이 0~7 · 고른 행 — 옛 꼴과 채널 차 1 안 · 칸 span 0', async ({ page }) => {
      const { depths } = await boot(page);
      expect(Math.max(...depths), `[전제] 깊은 행이 보인다 ${depths}`).toBeGreaterThanOrEqual(5);
      expect(await page.locator('.layer-indent').count(), '칸마다 span 이 없다').toBe(0);
      const clip = await panelClip(page);
      const a = await shot(page, clip);
      await toOld(page);
      expect(await panelClip(page), '칸 폭이 같다').toEqual(clip);
      const v = await diff(page, a, await shot(page, clip));
      expect(v.lit, '[전제] 찍힌 판에 그림이 있다').toBeGreaterThan(0);
      expect(v.sameSize).toBe(true);
      expect(v.max, JSON.stringify(v)).toBeLessThanOrEqual(1);
    });

    test('G2 호버 행도 채널 차 1 안', async ({ page }) => {
      await boot(page);
      await page.locator('.layer-item').nth(2).hover();
      const clip = await panelClip(page);
      const a = await shot(page, clip);
      await toOld(page);
      const v = await diff(page, a, await shot(page, clip));
      expect(v.sameSize).toBe(true);
      expect(v.max, JSON.stringify(v)).toBeLessThanOrEqual(1);
    });

    test('G3 [자의 양성대조] 안내선을 1px 옮기면 차이가 난다', async ({ page }) => {
      await boot(page);
      const clip = await panelClip(page);
      const a = await shot(page, clip);
      await page.addStyleTag({ content: '.layer-indents{background-position-x:1px}' });
      expect((await diff(page, a, await shot(page, clip))).max, '1/255 상한을 넘는다').toBeGreaterThan(1);
    });
  });
}
