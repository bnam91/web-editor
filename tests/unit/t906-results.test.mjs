/* t906-results — t9-06 값 잠금. 칸 표의 t9-06 도는 칸이 값에 전부 있다 · 안 잰 칸은 까닭 · 닫는 칸 셋의 값이 실려 있다. 고쳐지면 런이 값을 다시 쓴다. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, 'tests/dom', f), 'utf8'));
const CELLS = read('t904-cells.json'); const D = read('t906-results.json'); const R = D.rows;
const key = (c) => [c.kind, c.place, c.op].join('|');
const run = CELLS.cells.filter((c) => c.run && c.ticket === 't9-06');
test('S1 칸 전부 · 해당 칸 measured≥95% · 안 잰 칸은 까닭', () => {
  assert.deepEqual(R.map(key).sort(), run.map(key).sort());
  const applicable = R.filter((r) => !r.na);
  assert.ok(applicable.filter((r) => r.measured).length / applicable.length >= 0.95);
  for (const r of R.filter((x) => !x.measured)) assert.ok(r.why, key(r));
});
test('S2 빨강은 종·자리·조작·재현', () => {
  const red = R.filter((r) => r.red?.length); assert.ok(red.length > 0);
  for (const r of red) assert.ok(r.repro?.spec && r.repro?.op, key(r));
});
test('S3 닫는 칸 값이 있다 — 전환·효과·⌘G', () => {
  assert.ok(R.some((r) => r.dir === 'free→stack' && r.coordLost && 'toast' in r));
  assert.ok(R.filter((r) => r.op === 'effects' && r.reg).length > 0 && D.frameEffects.reg.length > 0);
  assert.ok(R.filter((r) => r.op === 'group' && typeof r.roundtrip === 'number').length > 0);
});
test('S4 앱 칸에 복사 조작이 없다', () => {
  assert.deepEqual(R.filter((r) => r.app && ['dup', 'copypaste', 'scratch'].includes(r.op)).map(key), []);
});
