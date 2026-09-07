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
  // 「0건」이 «못 잰» 것이 아님을 보인다 — 진짜 포트 줄은 있어야 한다
  assert.match(src, /\bport:\s*9345,/, '★port 줄 자체를 못 찾았다 — 검사가 대상을 놓쳤다(구조 변경?)');
});
