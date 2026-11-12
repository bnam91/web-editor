/* nav-guard — 앱 창이 «에디터 페이지 밖»으로 바뀌는 길을 main 에서 전부 막는다 (SEC-MALICIOUS-PROJECT-FILE-SANDBOX-01 ③ · 현빈 결정 (가) 261112)
 *   ★모든 webContents(본창·템플릿 별창·이후 생길 창)에 web-contents-created 로 건다 — 창마다 따로 달다 빠뜨리는 일을 없앤다.
 *   will-navigate : 앱 폴더 안 file: 주소만 통과(홈↔편집↔기획↔라이선스). https·다른 file·data:·javascript: 는 끊는다.
 *   window.open   : 전부 거절(⌘클릭·가운데 클릭·target=_blank·스크립트 window.open). ⛔새 창은 preload 를 물려받는다 — 외부 페이지에 electronAPI 가 열린다.
 *   ⚠️main.js 의 GAP-008 라이선스 가드(will-navigate · 이름 검사)는 그대로 둔다 — 이건 «어디로»를, 그건 «인증됐나»를 본다. */
const path = require('path');
const { fileURLToPath } = require('url');

function isAppPage(url, appDir) {
  try {
    const u = new URL(String(url));
    if (u.protocol !== 'file:') return false;
    const rel = path.relative(appDir, fileURLToPath(u));
    return !!rel && !rel.startsWith('..') && !path.isAbsolute(rel);
  } catch (_) { return false; }
}

function guardWebContents(wc, appDir) {
  wc.on('will-navigate', (e, url) => {
    if (isAppPage(url, appDir)) return;
    e.preventDefault();
    console.warn('[nav-guard] 앱 밖 이동 차단:', String(url).slice(0, 200));
  });
  wc.setWindowOpenHandler(({ url }) => {
    console.warn('[nav-guard] 새 창 차단:', String(url).slice(0, 200));
    return { action: 'deny' };
  });
}

function install(app, appDir) {
  app.on('web-contents-created', (_e, wc) => guardWebContents(wc, appDir));
}

module.exports = { install, isAppPage, guardWebContents };
