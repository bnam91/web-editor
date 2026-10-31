/* test-port-forbid.test.js — ★301 UNIT-TEST-GRABS-FORBIDDEN-PORT-9390-01
 *   ★병: 유닛이 9390·9392·9411 을 박아 잡았다 — 전부 tests/e2e/run-app.sh OWN_FORBID 에 있는 남의 자리다.
 *     주석은 「9345~9365 밖」만 말했다(명부가 둘이었다) · 하네스 고르는 대역 [9370,9395] 도 그 명부와 겹쳤다.
 *   ★처방: 명부는 OWN_FORBID 한 벌(_mcp-harness.js 가 읽는다) · 검사가 잡는 포트를 그 명부에 대어 겹치면 빨강.
 *   한 쌍: G1 = 지금 레포 겹침 0 / G2 = 같은 자에 박은 줄을 주면 잡는다. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { OWN_FORBID, assertOutsideBand, _freePortIn } = require('./_mcp-harness.js');

// shortcut: 숫자를 그 자리에 박은 꼴만 본다(상수를 거쳐 listen 하면 못 잡는다) · 그 꼴이 나오면 정규식을 넓혀라
const GRAB = /(?:startMcpServer\(\{\s*port:\s*|\bbasePort:\s*|\bPORT\s*=\s*|\?\?\s*|\.listen\()(\d{4,5})\b/g;
/** 글자 하나에서 주석 밖 «잡는 포트» 전부 */
function grabbedPorts(text) {
  return text.split('\n')
    .filter((l) => !/^\s*(\*|\/\*)/.test(l))
    .flatMap((l) => [...l.replace(/\/\/.*$/, '').matchAll(GRAB)].map((m) => Number(m[1])));
}

test('G0 전제 — 명부를 읽었다(알려진 값 9345·9390 · 이게 빨강이면 아래는 「안 쟀다」)', () => {
  assert.ok(OWN_FORBID.has(9345) && OWN_FORBID.has(9390), `OWN_FORBID ${[...OWN_FORBID].join(' ')}`);
});
test('G1 ★유닛이 박아 잡는 포트가 OWN_FORBID 와 안 겹친다', () => {
  const hits = fs.readdirSync(__dirname)
    .filter((f) => /\.(js|mjs)$/.test(f) && f !== path.basename(__filename))
    .flatMap((f) => grabbedPorts(fs.readFileSync(path.join(__dirname, f), 'utf8')).filter((p) => OWN_FORBID.has(p)).map((p) => `${f}:${p}`));
  assert.deepEqual(hits, [], '★금지 포트를 박았다 — _freePortIn() 으로 고르고 assertOutsideBand(r.port) 로 재라');
});
test('G2 ★자가 산다 — 박은 줄은 잡고 · 주석·명부 밖은 안 잡는다', () => {
  assert.deepEqual(grabbedPorts('const r = await mcp.startMcpServer({ port: 9390, x });'), [9390]);
  assert.deepEqual(grabbedPorts('PORT = r.port ?? 9392;'), [9392]);
  assert.deepEqual(grabbedPorts('const PORT = 9411;  // 힌트'), [9411]);
  assert.deepEqual(grabbedPorts('// startMcpServer({ port: 9390 })\n * const PORT = 9411;'), []);
  assert.deepEqual(grabbedPorts('s.listen(0, "127.0.0.1");'), []);
});
test('G3 ★하네스가 명부를 거른다 — 고르지도 · 받아 주지도 않는다', async () => {
  await assert.rejects(_freePortIn(9390, 9390), /빈 포트/);   // 후보가 금지 포트 하나뿐이면 못 고른다(열어 보기 전에 거른다)
  assert.throws(() => assertOutsideBand(9390), /OWN_FORBID/);
  assert.equal(assertOutsideBand(9412), 9412);
  assert.ok(!OWN_FORBID.has(await _freePortIn()));
});
