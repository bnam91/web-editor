/* style-write-no-subtree-recalc-250c.dom.spec.js — 조상 인라인 스타일 한 번이 자손 전부를 다시 계산하던 것(★250C ⓐ).
 *
 * 원인(앱 실측 · 합성 256섹션): `[style*="background-clip: text"] *::selection` · `… span[…]` 두 규칙. 둘을 빼면 #canvas-scaler 높이 쓰기 834ms → 9ms · 요소 50,195 → 1.
 * 고침: 표식을 상속 변수로 내려 @container style() 로 판정. 판정 = 트레이스의 UpdateLayoutTree elementCount · 그림은 getComputedStyle.
 * ⛔못 보는 꼴: 실제 선택 페인트(계산값까지만) · 원인이 다른 큰 재계산(새 규칙은 P1 이 잡는다).
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { ROOT, ORIGIN } = require('./_root-harness.js');
const PID = 'proj_1700000000251';
test.describe.configure({ timeout: 60000 });
const MIME = { '.js': 'application/javascript', '.mjs': 'application/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.png': 'image/png' };

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
  await page.waitForFunction(() => typeof window.rebindAll === 'function', null, { timeout: 20000 });
  await page.evaluate(() => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach((s) => s.remove());
    window.addSection();
    const inner = c.querySelector('.section-block .section-inner');
    const box = document.createElement('div'); box.id = 'probe';
    box.innerHTML = '<div><span>a</span></div>'.repeat(2000)
      + '<div id="tg" style="background-image: linear-gradient(red, blue); background-clip: text; -webkit-text-fill-color: transparent;">'
      + '<span id="tgPlain">a</span><span id="tgHl" style="background-color: yellow; color: rgb(1, 2, 3);">b<b id="tgDeep">c</b></span></div>'
      + '<div id="plain" style="-webkit-text-fill-color: rgb(4, 5, 6);"><span id="plainHl" style="background-color: yellow; color: rgb(1, 2, 3);">d</span></div>';
    inner.appendChild(box);
  });
}

test('P1 #canvas-scaler 높이 쓰기 — 자손을 다시 계산하지 않는다', async ({ page }) => {
  await boot(page);
  const cdp = await page.context().newCDPSession(page);
  const ev = []; cdp.on('Tracing.dataCollected', (d) => ev.push(...d.value));
  await page.evaluate(() => { void document.getElementById('canvas-wrap').clientWidth; });
  await cdp.send('Tracing.start', { transferMode: 'ReportEvents', traceConfig: { includedCategories: ['devtools.timeline', 'disabled-by-default-devtools.timeline'] } });
  await page.evaluate(() => { const sc = document.getElementById('canvas-scaler'), w = document.getElementById('canvas-wrap'); const h = parseFloat(sc.style.height) || 1000; for (let i = 1; i <= 3; i++) { sc.style.height = (h + i) + 'px'; void w.clientWidth; } });
  const done = new Promise((r) => cdp.once('Tracing.tracingComplete', r)); await cdp.send('Tracing.end'); await done;
  const n = ev.filter((e) => e.name === 'UpdateLayoutTree' && e.ph === 'X').map((e) => e.args?.elementCount || 0);
  expect(n.length, '[전제] 재계산을 찍었다').toBeGreaterThan(0);
  expect(Math.max(...n), `재계산 요소 수 ${n}`).toBeLessThan(50);
});

test('G1 그라데이션 안 — 선택 채움이 투명이 아니다(자기·자손·손자)', async ({ page }) => {
  await boot(page);
  const v = await page.evaluate(() => Object.fromEntries(['tg', 'tgPlain', 'tgHl', 'tgDeep'].map((id) => [id, getComputedStyle(document.getElementById(id), '::selection').webkitTextFillColor])));
  for (const [id, c] of Object.entries(v)) expect(c, id).not.toBe('rgba(0, 0, 0, 0)');
});

test('G2 그라데이션 안 형광펜 span 만 글자색으로 채운다', async ({ page }) => {
  await boot(page);
  const fill = (id) => page.evaluate((id) => getComputedStyle(document.getElementById(id)).webkitTextFillColor, id);
  expect(await fill('tgHl')).toBe('rgb(1, 2, 3)');
  expect(await fill('tgPlain'), '형광펜 없는 span 은 투명 그대로').toBe('rgba(0, 0, 0, 0)');
});

test('G3 [지킴] 그라데이션 밖은 안 바뀐다', async ({ page }) => {
  await boot(page);
  const v = await page.evaluate(() => { const e = document.getElementById('plainHl'); const q = document.createElement('span'); document.getElementById('probe').appendChild(q); return { fill: getComputedStyle(e).webkitTextFillColor, sel: getComputedStyle(q, '::selection').webkitTextFillColor, selBase: getComputedStyle(q).webkitTextFillColor }; });
  expect(v.fill, '부모 채움을 그대로 잇는다').toBe('rgb(4, 5, 6)');
  expect(v.sel, '선택 규칙이 안 걸린다').toBe(v.selBase);
});

test('X1 내보내기 CSS 수확 — 형광펜 규칙이 @container 와 함께 실린다', async ({ page }) => {
  await boot(page);
  const css = await page.evaluate(async () => { const { collectCanvasCss } = await import('/js/io/export-css-collect.js'); return collectCanvasCss(document.getElementById('probe'), document); });
  expect(css).toContain('--gd-tg-host');
  expect(css).toMatch(/@container[^{]*--gd-tg-host[^{]*\{[^}]*span\[style\*="background-color"\]/);
});
