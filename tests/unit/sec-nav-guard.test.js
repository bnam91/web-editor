/* sec-nav-guard — SEC-MALICIOUS-PROJECT-FILE-SANDBOX-01 ③ main 쪽 벽 (현빈 결정 (가) 261112)
 *   ★진짜 main/nav-guard.js 를 require 해 가짜 app·webContents 를 주입해 돌린다(대역 아님).
 *   DOM 하네스는 Electron 이 아니라 will-navigate·setWindowOpenHandler 를 못 잰다 ⇒ 여기서 잰다.
 *   N1 [음성대조] 에디터 자기 페이지(홈↔편집↔기획↔라이선스↔템플릿 별창) 이동은 통과
 *   N2 앱 밖(https·이웃 폴더·data:·javascript:·about:) 은 거절 — 이웃 폴더는 «접두어만 같은» 함정(startsWith 무구분자)
 *   N3 배선 — web-contents-created 로 건 wc 에서 will-navigate 가 preventDefault 되고(양성), 앱 페이지는 안 되고(음성),
 *      window.open(⌘클릭·가운데 클릭·스크립트) 은 주소와 상관없이 deny
 *   N4 main.js 가 모듈 최상위에서 install 한다(빼면 빨강 = 양성대조) */
const test = require('node:test');
const assert = require('node:assert');
const { EventEmitter } = require('events');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const G = require('../../main/nav-guard');

const ROOT = path.join(__dirname, '..', '..');
const APP = path.resolve(ROOT);
const f = (...p) => pathToFileURL(path.join(APP, ...p)).href;

test('N1 [음성대조] 에디터 자기 페이지 이동은 통과', () => {
  for (const u of [f('index.html') + '?project=p1', f('pages', 'projects.html'), f('pages', 'planning.html') + '?project=p1#x',
                   f('pages', 'license.html'), f('pages', 'template-browser.html')]) {
    assert.equal(G.isAppPage(u, APP), true, u);
  }
});

test('N2 앱 밖은 거절 — https · 이웃 폴더(접두어 함정) · 상위 · data: · javascript: · about: · 깨진 주소', () => {
  for (const u of ['https://attacker.example/p', 'http://127.0.0.1/', pathToFileURL(APP + '-evil' + path.sep + 'index.html').href,
                   pathToFileURL(path.resolve(APP, '..', 'x.html')).href, pathToFileURL(APP).href,
                   'data:text/html,<b>x</b>', 'javascript:alert(1)', 'about:blank', 'not a url', '']) {
    assert.equal(G.isAppPage(u, APP), false, u);
  }
});

function fakeWc() {
  const wc = new EventEmitter();
  wc.setWindowOpenHandler = (h) => { wc._open = h; };
  wc.nav = (url) => { let prevented = false; wc.emit('will-navigate', { preventDefault: () => { prevented = true; } }, url); return prevented; };
  return wc;
}

test('N3 배선 — web-contents-created 로 건 wc: 앱 밖 이동 끊음(양성) · 앱 페이지 통과(음성) · window.open 전부 deny', () => {
  const app = new EventEmitter();
  G.install(app, APP);
  const wc = fakeWc();
  app.emit('web-contents-created', {}, wc);
  assert.equal(wc.nav('https://attacker.example/p'), true, '★외부 이동이 안 끊겼다');
  assert.equal(wc.nav(f('pages', 'projects.html')), false, '홈으로 가는 길이 막혔다');
  assert.equal(wc.nav(f('index.html') + '?project=p1'), false, '편집으로 가는 길이 막혔다');
  assert.equal(typeof wc._open, 'function', 'setWindowOpenHandler 가 안 걸렸다');
  for (const url of ['https://attacker.example/p', f('index.html'), 'about:blank']) {
    assert.deepEqual(wc._open({ url, disposition: 'foreground-tab' }), { action: 'deny' }, url);
  }
  const wc2 = fakeWc();                                     // ★두 번째 창(템플릿 별창 등)도 같은 벽
  app.emit('web-contents-created', {}, wc2);
  assert.equal(wc2.nav('https://attacker.example/p'), true);
});

test('N4 main.js 가 모듈 최상위에서 nav-guard 를 install 한다 (빼면 빨강)', () => {
  const src = fs.readFileSync(path.join(ROOT, 'main.js'), 'utf8');
  assert.match(src, /^require\('\.\/main\/nav-guard'\)\.install\(app, __dirname\);\r?$/m);
});
