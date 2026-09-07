/* ★격리용 포트가 «커밋에 딸려 들어가는» 것을 막는다.
   2026-09-07 실제로 들어갔다(6ca0a12). up.sh 가 기동 때마다 main.js 를 9370 으로 치환하는데,
   그 상태로 커밋하면 dev·릴리스가 내 격리 포트로 뜬다.
   「앞으로 조심하겠다」로는 안 막힌다 — «실패하는 검사»로 닫는다. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

test('★main.js 에 격리 포트(9370)가 남아 있지 않다', () => {
  const p = path.join(__dirname, '..', '..', 'main.js');
  const src = fs.readFileSync(p, 'utf8');
  const hits = src.split('\n').map((l, i) => [i + 1, l])
    .filter(([, l]) => /\bport:\s*937\d\b/.test(l) || /\[mcpmgr\]\s*격리/.test(l));
  assert.deepStrictEqual(hits, [], `★격리용 치환이 남아 있다 — 커밋하면 dev 가 이 포트로 뜬다:\n  ${hits.map(([n, l]) => `${n}: ${l.trim()}`).join('\n  ')}`);
  // 「0건」이 «못 잰» 것이 아님을 보인다 — 포트를 정하는 자리는 «있어야» 한다
  assert.match(src, /GODITOR_MCP_PORT/, '★포트를 정하는 자리를 못 찾았다 — 검사가 대상을 놓쳤다(구조 변경?)');
  assert.match(src, /return 9345;/, '★기본 포트(9345)가 없다');
});

/* ★그리고 «구조»로도 막는다 — 검사보다 구조가 강하다(지디 지적).
   기동 스크립트가 소스를 «치환»하는 한, 커밋에 딸려갈 자리는 계속 남는다.
   환경변수로 주면 그 자리 자체가 없어진다. */
test('★포트는 «환경변수»로 옮길 수 있다 — 기동이 소스를 안 건드린다', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', '..', 'main.js'), 'utf8');
  assert.match(src, /process\.env\.GODITOR_MCP_PORT/, '★환경변수로 못 옮기면 기동 스크립트가 소스를 치환하게 된다');
  // ⛔못 읽는 값을 «조용히 기본값»으로 삼키면 격리 의도가 소리 없이 사라진다
  assert.match(src, /GODITOR_MCP_PORT 이 포트가 아니다/, '★잘못된 값은 던져야 한다 — 조용히 9345 로 가면 안 된다');
});
