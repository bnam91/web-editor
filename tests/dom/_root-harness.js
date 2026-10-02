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
 *   electronAPI 는 «모든 호출이 null 을 돌려주는» 가짜.
 *
 * ★이 하네스를 믿는 근거(양성대조 — «뜬다»가 아니라 «맞게 돈다»를 잰 사실, 2026-10-01 태양):
 *   · 「오류 0건으로 뜬다」만으로는 근거가 아니다. 아래는 «고치기 전 판 7699ea33» 에서 같은 시험이 빨강이었던 기록이다.
 *   · frame-zoom-group-select B1-b — 7699ea33 빨강 / 고친 판 초록. 그리고 같은 하네스에서 B1-0·B1-a(⌘클릭 길)는
 *     옛 판에서도 초록 ⇒ 이 하네스는 «선택 방법(⇧ vs ⌘)»의 차이를 실제 앱과 같은 코드로 가른다.
 *     (코드 읽기 진단 둘이 이 하네스 측정으로 «틀렸다»고 판명됐다 — 하네스가 진단보다 앞선다.)
 *   · overlay-align O1~O5 — 7699ea33 빨강(그 판엔 패널이 없다) / 고친 판 초록. O6 은 지키는 시험(양쪽 초록).
 *   · 2026-10-02 asset-drop-position: 이 하네스로 잡은 두 원인(÷배율 없음 · 세로 중심 60→110)을 고친 뒤
 *     실앱 «사람 손» 끌기에서 현빈이 확인(놓은 자리에 들어감). ⚠️한 건에서 맞았다는 것뿐 — 「하네스 = 실앱」으로 넓히지 않는다.
 * ⛔이 하네스로 «못 재는» 축(electronAPI 가짜라서): 파일 저장·불러오기, 템플릿 index/canvas 파일, 스크래치패드 IndexedDB 의
 *   «다른 프로젝트·재기동 뒤» 영속, 네이티브 메뉴·창·포커스. 항목별 명부는 커밋 메시지·지디 보고에 «이름으로» 적는다. */
async function bootApp(page) {
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.addInitScript(() => { window.electronAPI = new Proxy({}, { get: () => (() => Promise.resolve(null)) }); });
  /* ★Electron 렌더러처럼 prompt() 가 «던진다» (2026-10-02, 현빈 「디자인시스템 컬러변수 추가가 아예 안 된다」 —
     실앱 스택: `Uncaught Error: prompt() is not supported.`). 헤드리스 Chromium 은 prompt 를 대화창으로 띄우고
     Playwright 가 자동으로 닫아 null 을 돌려줘서, prompt 를 쓰는 기능이 이 하네스에선 «안 죽고» 지나갔다
     ⇒ 「한 환경에서만 참인 검사」. 실앱과 같은 꼴로 던지게 해 그 거짓 초록을 없앤다.
     (alert·confirm 은 Electron 에서도 동기 대화창으로 «동작»하므로 그대로 둔다 — Playwright 가 alert=확인·confirm=취소로 닫는다.) */
  await page.addInitScript(() => { window.prompt = () => { throw new Error('prompt() is not supported.'); }; });
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

/* ★자리가 «멈춘 뒤»의 화면 좌표 — 같은 병을 세 번 고쳐서 묶었다(2026-10-02, 지디 「네 번째가 온다」).
 *   bootApp 뒤엔 배율 맞추기(applyZoom 의 비동기 가운데 맞추기 등)가 늦게 끝나, 좌표를 «먼저» 재고 누르면 그 사이 요소가 움직여 빗나간다.
 *   부하에서만 드러난다(단독 통과≠안 흔들림). 앞선 셋: grid-fullbleed-rerender R3(화면 px 로 잼) · A1 Q7b(배율 직후 스크롤) ·
 *   color-history 준비(클릭 빗나감 — 72 중 14 빨강의 한 원인).
 *   ⇒ 그 요소의 화면 사각형이 interval 간격 «두 번 연속 같을 때»까지 기다렸다가 돌려준다. 끝내 안 멈추면 «던진다»(조용히 옛 값을 주지 않는다).
 *   돌려주는 것: { left, top, width, height, cx, cy } (반올림한 화면 px). */
async function waitStableRect(page, selector, { interval = 150, tries = 40 } = {}) {
  let prev = null;
  for (let i = 0; i < tries; i++) {
    const r = await page.evaluate((sel) => { const e = document.querySelector(sel); if (!e) return null; const b = e.getBoundingClientRect();
      return { left: Math.round(b.left), top: Math.round(b.top), width: Math.round(b.width), height: Math.round(b.height) }; }, selector);
    if (r && prev && r.left === prev.left && r.top === prev.top && r.width === prev.width && r.height === prev.height) {
      return { ...r, cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
    }
    prev = r;
    await page.waitForTimeout(interval);
  }
  throw new Error(`waitStableRect: ${selector} 가 ${tries * interval}ms 안에 멈추지 않았다(또는 없다) — 옛 좌표로 누르지 않는다`);
}
module.exports.waitStableRect = waitStableRect;
