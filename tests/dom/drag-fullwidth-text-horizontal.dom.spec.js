/* drag-fullwidth-text-horizontal.dom.spec.js — D3 (lane-drag · 2026-10-05 · 현빈 «자유 이동이 되어야지?» · 지디 ⒜ 승인)
 *
 * 자유 프레임 안 «가운데/오른쪽 정렬» 글자는 폭 100% 로 놓인다(block-factory.js _clampTextFrameWidth — 설계).
 * 그래서 끌기 클램프(:765)가 가로 여유 0 을 주어 «좌우로는 0px» 움직였다(실앱 실측 ss_ts0he_kj382m6: 가로만 (80,0) → Δ0 ·
 * (60,40) → 가로 0 · 세로 +100).
 * ⒜ = 그 글자를 «가로로» 끄는 순간에만 폭을 내용 폭 px 로 바꾸고 보이는 자리를 지킨다(끈 글자만 dataset.width 100%→px).
 * 조건(지디): ㉠ 바꾸는 순간 글자 자리 가로 델타 0 ㉢ 세로만 ×3 이면 dataset.width 그대로 '100%'.
 * (㉡ 저장·다시 연 뒤 프레임 폭 바꾸기 = 실앱 표가 진다.)
 *
 * ⛔앱을 «안» 띄운다 — js/block-drag.js 를 진짜 ES 모듈로 얹고 bindBlock 만. 마우스는 page.mouse.
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js tests/dom/drag-fullwidth-text-horizontal.dom.spec.js
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };

const HARNESS = `<!doctype html><html><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; } body { margin:0; font: 32px/1.4 sans-serif; }
  #canvas-wrap { position:relative; width:1000px; height:800px; background:#555; }
  .section-block { position:relative; width:800px; height:600px; background:#fff; }
  .frame-block { position:relative; overflow:hidden; }
</style></head><body>
<div id="canvas-wrap"><div id="canvas-scaler" style="transform:scale(1);transform-origin:0 0"><div id="canvas">
  <div class="section-block" id="sec"><div class="section-inner" id="inner"></div></div>
</div></div></div>
<div id="ss-handles-overlay"></div>
<script src="/js/feature-flags.js"></script>
<script>
  window.currentZoom = 100;
  window.__pushes = [];
  window.pushHistory = (label) => window.__pushes.push(label || '');
  window.scheduleAutoSave = () => {}; window.triggerAutoSave = () => {}; window.buildLayerPanel = () => {};
  window.beginDragHistory = () => ({ arm: () => {} });
  window._findSectionAt = () => null;
  window.deselectAll = () => document.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
</script>
<script type="module">
  import '/js/block-drag.js';
  window.__ready = true;
</script></body></html>`;

async function boot(page) {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/__harness.html') return route.fulfill({ contentType: 'text/html', body: HARNESS });
    const file = path.join(REPO, url.pathname);
    if (!file.startsWith(REPO) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({ contentType: MIME[path.extname(file)] || 'text/plain', body: fs.readFileSync(file) });
  });
  await page.goto(`${ORIGIN}/__harness.html`);
  await page.waitForFunction(() => window.__ready === true && typeof window.bindBlock === 'function');
  return errs;
}

/* 사본 꼴 그대로: 자유 프레임 516×361(위치 없음) > 글자 프레임(absolute 0,152 · 폭 100%) > 글자(가운데 «25%») */
async function mount(page, align = 'center') {
  await page.evaluate((align) => {
    document.getElementById('inner').innerHTML =
      '<div class="frame-block" id="fr" data-free-layout="true" style="width:516px;height:361px;padding:0;margin:0 auto">' +
      '<div class="frame-block" id="tf" data-text-frame="true" data-width="100%" data-offset-x="0" data-offset-y="152" ' +
      'style="background:transparent;width:100%;box-sizing:border-box;position:absolute;left:0px;top:152px">' +
      `<div class="text-block" id="tb" data-type="body"><div class="tb-body" style="text-align:${align}">25%</div></div></div></div>`;
    const fr = document.getElementById('fr');
    window.bindBlock(document.getElementById('tb'));
    // 사람 순서(실앱 ㉠): 첫 클릭 = 프레임 고름 → 그 뒤 글자 위를 끈다
    fr.classList.add('selected'); window._activeFrame = fr;
  }, align);
}
const glyph = (page) => page.evaluate(() => {
  const n = document.querySelector('#tb .tb-body').firstChild; const r = document.createRange(); r.selectNodeContents(n);
  const b = r.getBoundingClientRect(); const tf = document.getElementById('tf');
  return { gx: Math.round(b.left * 10) / 10, gy: Math.round(b.top * 10) / 10, w: tf.style.width, dw: tf.dataset.width, L: parseFloat(tf.style.left), T: parseFloat(tf.style.top) };
});
async function drag(page, dx, dy) {
  const g = await page.evaluate(() => { const n = document.querySelector('#tb .tb-body').firstChild; const r = document.createRange(); r.selectNodeContents(n); const b = r.getBoundingClientRect(); return { x: Math.round(b.left + b.width / 2), y: Math.round(b.top + b.height / 2) }; });
  await page.mouse.move(g.x, g.y);
  await page.mouse.down();
  await page.mouse.move(g.x + dx / 2, g.y + dy / 2);
  await page.mouse.move(g.x + dx, g.y + dy);
  await page.mouse.up();
}

test('전제 — block-drag.js 가 콘솔 오류 없이 얹힌다', async ({ page }) => {
  const errs = await boot(page);
  expect(errs, `pageerror: ${errs.join(' | ')}`).toEqual([]);
});

for (const align of ['center', 'right']) {
  test(`D3a[${align}] ★프레임 고른 뒤 가로로 끌면 글자가 «끈 만큼» 움직인다(바꾸는 순간 튐 0)`, async ({ page }) => {
    await boot(page);
    await mount(page, align);
    const b = await glyph(page);
    const DX = align === 'right' ? -120 : 120;
    await drag(page, DX, 0);
    const a = await glyph(page);
    expect(Math.abs((a.gx - b.gx) - DX), `글자 가로 이동=${(a.gx - b.gx).toFixed(1)} 기대 ${DX} · 전=${JSON.stringify(b)} 뒤=${JSON.stringify(a)} (고치기 전 실측 = 0)`).toBeLessThanOrEqual(1);
    expect(Math.abs(a.gy - b.gy), `세로는 안 움직여야 한다(Δ${a.gy - b.gy})`).toBeLessThanOrEqual(1);
    expect(a.dw, `끈 글자만 폭이 px 로 바뀐다(dataset.width=${a.dw})`).not.toBe('100%');
  });
}

test('D3b ㉢ 세로만 100 ×3 — dataset.width 는 그대로 100%', async ({ page }) => {
  await boot(page);
  await mount(page, 'center');
  const b = await glyph(page);
  for (let i = 0; i < 3; i++) { await drag(page, 0, 30); }
  const a = await glyph(page);
  expect({ dw: a.dw, w: a.w }, `세로만 끈 뒤=${JSON.stringify(a)}`).toEqual({ dw: '100%', w: '100%' });
  expect(a.gy - b.gy, '세로는 움직였어야 한다(장면 확인)').toBeGreaterThan(50);
});
