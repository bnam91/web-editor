'use strict';
/* /health 가 «브라우저 페이지»에는 신원·작업 정보를 주지 않는가.
 *
 * 왜: /health 는 무인증 + `Access-Control-Allow-Origin: *` 라, 사용자가 연 아무 웹페이지나
 *     읽을 수 있다(실측). 토큰은 못 훔치지만(파일을 못 읽으니) 다음이 새어 나간다:
 *       · activeProject — «지금 어느 프로젝트를 열어놨는지»
 *       · tokenFile     — 절대경로, 즉 «/Users/<계정명>/…» 이 그대로 노출
 *     로컬 프로세스는 그 파일을 어차피 찾을 수 있으니 이건 «브라우저 경계»의 문제다.
 * ⚠️이건 2026-09-07 사고(CLI 세션 9개가 실사용 인스턴스에 붙음)의 처방이 «아니다» —
 *   그건 권한 있는 같은 사용자의 조율 실패였고, 포트 고정 규약이 막는다. 섞지 마라.
 */
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const mcp = require('../../main/claude-pm/mcp-server.js');

let PORT;
before(async () => {
  mcp.setRendererInvoker({ scratchAdd: async () => ({ ok: true }) });
  const r = await mcp.startMcpServer({ port: 9392 }); // 브리지 스캔 대역 9345~9365 «밖»
  PORT = r.port ?? 9392;
  assert.ok(PORT < 9345 || PORT > 9365, `테스트 포트가 스캔 대역 안이다: ${PORT}`);
});
after(async () => { await mcp.stopMcpServer(); });

const health = (headers) => fetch(`http://127.0.0.1:${PORT}/health`, { headers }).then(r => r.json());

test('로컬 호출자(Origin 없음)에겐 tokenFile·activeProject 를 «준다» — 브리지가 그걸로 산다', async () => {
  const h = await health();
  assert.equal(h.status, 'ok');
  assert.ok(typeof h.tokenFile === 'string' && h.tokenFile.length > 0,
    '★브리지는 이 경로로 매 실행마다 최신 토큰을 읽는다 — 빼면 앱 재시작 때 401 이 난다');
  assert.ok('activeProject' in h);
  assert.equal(h.requiresToken, true);
});

test('★브라우저 페이지(Origin 있음)에겐 tokenFile·activeProject 를 «안 준다»', async () => {
  const h = await health({ Origin: 'https://evil.example' });
  assert.equal(h.status, 'ok', '기능은 그대로 — 브리지 계약(status:ok)을 깨지 않는다');
  assert.equal(h.tokenFile, undefined, '★계정명이 들어간 절대경로가 새면 안 된다');
  assert.equal(h.activeProject, undefined, '★어느 프로젝트를 열어놨는지 알려주면 안 된다');
  assert.equal(h.port, PORT, '포트·pid·instance 는 계속 준다(브리지 탐색 계약)');
  assert.match(h.note || '', /omitted/, '뺐다는 사실을 말해야 한다 — 조용히 비우지 않는다');
});

test('원본 문자열이 실제로 «응답 안에 없다» (키만 지우고 값이 남는 실수 방지)', async () => {
  const raw = await fetch(`http://127.0.0.1:${PORT}/health`, { headers: { Origin: 'https://evil.example' } })
    .then(r => r.text());
  assert.doesNotMatch(raw, /"tokenFile"\s*:/, 'tokenFile «키»가 없어야 한다');
  assert.doesNotMatch(raw, /"activeProject"\s*:/, 'activeProject «키»가 없어야 한다');
  // 절대경로 조각이 본문 어디에도 남으면 안 된다(값만 지우고 다른 필드에 흘리는 실수 방지).
  // ⚠️note 문자열은 «키 이름»을 설명으로 담고 있으므로 키 패턴으로 봐야 한다 — 단어 검색은 오탐이다.
  /* ★옛 판 `homedir().split('/').slice(0,3).join('/')` 은 윈도우(`C:\Users\…`)에서
     한 조각도 안 쪼개져 «다른 것»을 쟀다. 루트를 떼고 «앞 두 세그먼트»로 다시 만든다.
     ⚠️그리고 본문은 JSON 이라 윈도우 경로가 `C:\\Users\\…` 로 «이스케이프돼» 실린다 —
       날 것만 찾으면 못 본다. 세 표기를 다 본다. NTFS 는 대소문자도 안 가린다. */
  const path = require('node:path');
  const home = require('node:os').homedir();
  const hroot = path.parse(home).root;
  const homeRoot = hroot + home.slice(hroot.length).split(/[\\/]+/).filter(Boolean).slice(0, 2).join(path.sep);
  const norm = (s) => (process.platform === 'win32' ? s.toLowerCase() : s);
  for (const v of new Set([homeRoot, homeRoot.replace(/\\/g, '\\\\'), homeRoot.replace(/\\/g, '/')])) {
    assert.ok(!norm(raw).includes(norm(v)), `홈 경로(${v}) 조각이 남으면 안 된다`);
  }
});
