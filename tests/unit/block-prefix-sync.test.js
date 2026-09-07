/* ★읽기 표가 «정본»과 어긋나면 그 블록은 조용히 사라진다 — 실제로 사라졌다.
   2026-09-07 실측(끌리젠 사본 102섹션·1201블록): `bn2_`(banner02) 3개가 디스크에 있는데
   그 섹션을 읽으면 19블록 중 «0개». 이름이 바뀐 게 아니라 «없는 취급»이었다.
   원인 둘이 겹쳤다: ⑴사본 표(PFX)에 bn2_ 가 없다 ⑵거르개가 «숫자 든 접두»를 버린다.
   ⇒ 그리고 사본 표 «주석»은 「안 늘려도 빠지지는 않는다」고 약속하고 있었다. 코드가 안 지켰다.
   ⇒ 이 검사는 그 어긋남을 «구조»로 막는다. 사람 기억에 두면 또 어긋난다. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { readSrc } = require('./_srcread.js');   // ★CRLF 체크아웃 방어

const R = path.join(__dirname, '..', '..');
const CANON = readSrc(R, 'main', 'claude-pm', 'mcp-block-tools.js');
const COPY = readSrc(R, 'js', 'canvas-state.js');

/** 정본 BLOCK_TYPES 의 {접두: 타입} */
function canonPrefixes() {
  const out = {};
  const re = /\{\s*type:\s*'([^']+)'[\s\S]*?pfx:\s*'([^']+)'/g;
  let m; while ((m = re.exec(CANON))) out[m[2]] = m[1];
  return out;
}
/** 사본 PFX 의 {접두: 타입} */
function copyPrefixes() {
  const blk = COPY.match(/var PFX = \{([\s\S]*?)\};/);
  assert.ok(blk, '★사본 표(PFX)를 못 찾았다 — 검사가 대상을 놓쳤다');
  const out = {};
  const re = /(\w+_):\s*'([^']+)'/g;
  let m; while ((m = re.exec(blk[1]))) out[m[1]] = m[2];
  return out;
}
/** 읽는 쪽 거르개 정규식 */
function filterRe() {
  const m = COPY.match(/if \(type === null && !\/(\^[^/]+)\/\.test\(id\)\) return;/);
  assert.ok(m, '★거르개를 못 찾았다 — 검사가 대상을 놓쳤다');
  return new RegExp(m[1]);
}

test('B1 ★정본에 있는 블록 접두가 «전부» 읽기 표에 있다', () => {
  const canon = canonPrefixes(), copy = copyPrefixes();
  assert.ok(Object.keys(canon).length > 15, `★정본을 ${Object.keys(canon).length}종밖에 못 셌다 — 못 잰 것이다`);
  const missing = Object.entries(canon).filter(([p]) => !(p in copy));
  assert.deepStrictEqual(missing, [],
    `★정본에 있는데 읽기 표에 없다 → 그 블록은 «이름 없이»(type:null) 나오거나 아예 안 나온다:\n  ${missing.map(([p, t]) => `${p} = ${t}`).join('\n  ')}`);
});

test('B2 ★★거르개가 «정본의 모든 접두»를 통과시킨다 (숫자 든 것 포함)', () => {
  /* 이게 banner02 를 지운 자리다. `^[a-z]{2,4}_` 는 bn2_ 를 «영문자만»이라며 버렸다. */
  const canon = canonPrefixes();
  const re = filterRe();
  const blocked = Object.entries(canon).filter(([p]) => !re.test(p + 'abc123'));
  assert.deepStrictEqual(blocked, [],
    `★거르개가 이 접두를 «버린다» — 그 블록은 화면에 있어도 MCP 로 «안 보인다»:\n  ${blocked.map(([p, t]) => `${p} = ${t}`).join('\n  ')}`);

  // ★양성대조 — 거르개가 «무엇이든» 통과시키는 건 아니어야 한다(그러면 이 검사가 무의미)
  assert.ok(!re.test('section-toolbar'), '★블록이 아닌 것까지 통과시키면 목록이 쓰레기가 된다');
  assert.ok(!re.test('canvas'), '★접두 모양(xx_)이 아닌 것은 걸러야 한다');
});

test('B3 ★앱에 «있는데 정본에 없는» 블록을 «세어» 남긴다 (읽기라도 되게)', () => {
  /* grid 가 그 경우다 — DOM 에 grid-block 이 79곳, id 접두 grd_ 인데 BLOCK_TYPES 엔 0건.
     ⇒ 만들지도 고치지도 못한다. 그래도 «읽기»는 이름을 붙여 준다(보이는데 못 만지는 쪽이 낫다).
     ★이 검사는 그 상태를 «기록»으로 못박는다 — 정본에 들어오면 여기가 빨개져서 같이 정리하게 된다. */
  const canon = canonPrefixes(), copy = copyPrefixes();
  const onlyCopy = Object.entries(copy).filter(([p]) => !(p in canon));
  const known = { row_: 'row', grd_: 'grid' };   // ★«알고 두는» 것만 여기 적는다
  const unexpected = onlyCopy.filter(([p]) => !(p in known));
  assert.deepStrictEqual(unexpected, [],
    `★읽기 표에만 있는 접두가 늘었다 — 정본에 넣을지 여기서 뺄지 정해라:\n  ${unexpected.map(([p, t]) => `${p} = ${t}`).join('\n  ')}`);
  for (const [p, t] of Object.entries(known)) {
    assert.strictEqual(copy[p], t, `★${p} 가 읽기 표에서 사라졌다 — 그러면 «이름 없이» 나온다`);
  }
});
