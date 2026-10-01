/* _root-harness — 1001 묶음 DOM 시험 공용 부품: «어느 판»의 파일을 싣는지 바꿔 끼운다.
 * ★양성대조: GD1001_ROOT=<고치기 전 판(7699ea33) 체크아웃 경로> 로 돌리면 같은 시험이 옛 판을 잰다.
 *   기본은 이 레포. 시험 파일마다 손으로 경로를 적지 않게 한 곳에 둔다. */
const fs = require('fs');
const path = require('path');
const ROOT = process.env.GD1001_ROOT || path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const MIME = { '.js': 'application/javascript', '.mjs': 'application/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.png': 'image/png' };
if (process.env.GD1001_ROOT) console.warn(`[1001] ★양성대조 모드 — ${ROOT}`);

async function boot(page, html, { ready = true } = {}) {
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.route(`${ORIGIN}/**`, async (r) => {
    const u = new URL(r.request().url());
    if (u.pathname === '/__h.html') return r.fulfill({ contentType: 'text/html', body: html });
    const f = path.join(ROOT, decodeURIComponent(u.pathname));
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return r.fulfill({ status: 404, body: '' });
    return r.fulfill({ contentType: MIME[path.extname(f)] || 'text/plain', body: fs.readFileSync(f) });
  });
  await page.goto(`${ORIGIN}/__h.html`);
  if (ready) await page.waitForFunction(() => window.__ready === true, null, { timeout: 15000 });
  return errs;
}
const src = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
module.exports = { ROOT, ORIGIN, boot, src };

/* ★앱 통째로(index.html + 전 스크립트) 헤드리스로 띄운다 — 창을 안 띄우고 «실제 모듈 + 실제 마우스·키»로 잰다.
 *   (규율 ②: QA 창이 현빈 키 입력을 가로채면 안 된다 — 이건 브라우저 창 자체가 없다.)
 *   electronAPI 는 «모든 호출이 null 을 돌려주는» 가짜. 파일·IPC 를 타는 기능은 이걸로 못 잰다(그건 「미측정」). */
async function bootApp(page) {
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.addInitScript(() => { window.electronAPI = new Proxy({}, { get: () => (() => Promise.resolve(null)) }); });
  await page.route(`${ORIGIN}/**`, async (r) => {
    const u = new URL(r.request().url());
    const f = path.join(ROOT, decodeURIComponent(u.pathname));
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return r.fulfill({ status: 404, body: '' });
    return r.fulfill({ contentType: MIME[path.extname(f)] || 'application/octet-stream', body: fs.readFileSync(f) });
  });
  await page.goto(`${ORIGIN}/index.html`);
  await page.waitForFunction(() => typeof window.rebindAll === 'function' && typeof window.groupSelectedBlocks === 'function', null, { timeout: 20000 });
  return errs;
}
module.exports.bootApp = bootApp;
