/* timeout-verdict-one-place.test.mjs — ★295 «상한이 무엇을 잡나» 판별 값은 한 자리에만 (imac-gd-L2 · 261031 · 지디 판정)
 *   ★병: 같은 주장이 세 자리(gate:4 · run-unit:39~40 · sync-body-cap:2)에서 서로 다른 판 쌍을 적었다 ⇒ 다음 사람이 어느 것을 참으로 읽을지 모른다.
 *   ★정본 = tests/unit-time.gate.js 머리말 «★왜» 줄. 다른 자리는 이름으로 가리킨다(가리킴 자체는 기계가 못 잰다 ⇒ 이 자가 그 빈칸을 잰다).
 *   ★예외 하나 = tests/run-unit.mjs 의 v25.8.0 실측(역사 문장 · 지디 판정 ⑶). 그 밖의 판은 거기도 빨강.
 *   ★자 = 한 줄에 Node 판(v2N.N.N)과 판별 낱말이 같이 있으면 판별 줄이다.
 *   ⚠️자 한계: 같은 줄만 본다 · 낱말 안의 말만 본다 · tests/ tools/ docs/ 의 js·mjs·cjs·sh·md 만 본다 ⇒ 판을 뺀 채 적은 주장·다른 낱말은 못 잡는다(≥).
 *   한 쌍: V1 = 지금 레포에 정본·예외 밖 판별 줄 0 / V2 = 판별 줄을 먹이면 걸린다(양성) · V3 = 가리키는 줄은 안 걸린다(음성). */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const { toPosix } = createRequire(import.meta.url)('./_srcread.js');   // ★검사 키는 posix 한 자(win-portability ④-2 · 레포 규약)

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const OWNER = 'tests/unit-time.gate.js';
const HISTORY = 'tests/run-unit.mjs';
const SELF = 'tests/unit/timeout-verdict-one-place.test.mjs';   // ★자기 글에 낱말 예시가 든다

const VER = /v2\d\.\d+\.\d+/g;
const VERDICT = /잡힌다|안 ?잡힌|못 ?잡|파일째 취소|안 ?듦|안 ?든다|안 ?닿/;

/** 글자 하나에서 판별 줄 — 한 줄에 Node 판과 판별 낱말이 같이 있는 줄 */
export function verdictLines(text) {
  return text.split('\n').filter((l) => VERDICT.test(l) && l.match(VER));
}
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'node_modules') walk(p, out); }
    else if (/\.(js|mjs|cjs|sh|md)$/.test(e.name)) out.push(p);
  }
  return out;
}
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const scanned = () => ['tests', 'tools', 'docs'].flatMap((d) => walk(path.join(ROOT, d))).map((p) => toPosix(path.relative(ROOT, p)));

test('V0 전제 — 정본 줄에 세 판이 다 있다(이게 빨강이면 아래는 「안 쟀다」)', () => {
  const lines = verdictLines(read(OWNER));
  assert.equal(lines.length, 1, `정본의 판별 줄이 하나가 아니다 — ${lines.length}`);
  for (const v of ['v22.22.3', 'v24.11.1', 'v25.8.0']) assert.ok(lines[0].includes(v), `정본에 ${v} 가 없다`);
});
test('V1 ★판별 줄은 정본과 예외 밖에 없다', () => {
  const files = scanned();
  const out = files.filter((f) => f !== OWNER && f !== HISTORY && f !== SELF && verdictLines(read(f)).length > 0);
  console.log(`  [295] 본 파일 ${files.length} · 정본·예외 밖 판별 줄 있는 파일 ${out.length} (같은 줄 · 낱말 안 ⇒ ≥)`);
  assert.deepEqual(out, [], `★판별 값을 또 적었다 — ${OWNER} 머리말을 고치고 이름으로 가리켜라 · ${out.join(' | ')}`);
});
test('V1b ★예외 자리는 v25.8.0 하나만 남긴다', () => {
  const vers = verdictLines(read(HISTORY)).flatMap((l) => l.match(VER));
  assert.deepEqual([...new Set(vers)], ['v25.8.0'], `${HISTORY} 의 판별 줄에 다른 판이 있다 — ${vers.join(' ')}`);
});
test('V2 양성 — 판별 줄을 먹이면 걸린다', () => {
  assert.equal(verdictLines('// Node v22.22.3 = 동기 몸도 잡힌다\n').length, 1);
  assert.equal(verdictLines(' * v24.11.1 에서는 안 잡힌다\n').length, 1);
  assert.equal(verdictLines(' * v25.8.0 동기 몸엔 안 듦\n').length, 1);
});
test('V3 음성 — 가리키는 줄 · 판만 · 낱말만 은 안 걸린다', () => {
  assert.equal(verdictLines(' * 판별 값의 정본 = tests/unit-time.gate.js 머리말 «★왜» 줄\n').length, 0);
  assert.equal(verdictLines(' * 196 «동기 몸» 칸(S3 실측 ×3 · Node v25.8.0 인텔)\n').length, 0);
  assert.equal(verdictLines(' * 시험 옵션 { timeout } 은 동기 몸에 «안 든다»\n').length, 0);
});
