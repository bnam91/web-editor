/* t905-results — t9-05 닫는 칸. ⑴ 칸 measured≥95% ⑵ 빨강은 종·자리·조작·재현 ⑶ 손 명부 결손 종 실측 표. 값은 tests/dom/t905-results.json · t905-gap-table.json(런이 쓴다). */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, 'tests/dom', f), 'utf8'));
const CELLS = read('t904-cells.json'); const R = read('t905-results.json').rows; const GAP = read('t905-gap-table.json');
const run = CELLS.cells.filter((c) => c.run && c.ticket === 't9-05');
const key = (c) => [c.kind, c.place, c.op].join('|');
test('R1 칸 표의 t9-05 도는 칸이 값에 전부 있고 measured≥95%', () => {
  assert.ok(run.length > 0);
  assert.deepEqual(R.map(key).sort(), run.map(key).sort());
  const m = R.filter((r) => r.measured).length;
  assert.ok(m / run.length >= 0.95, `${m}/${run.length}`);
  for (const c of run) assert.equal(c.measured, R.find((r) => key(r) === key(c)).measured, key(c));
});
test('R2 빨강은 종·자리·조작·재현을 갖고 ×3 값이 적혀 있다', () => {
  const red = R.filter((r) => r.red?.length);
  assert.ok(red.length > 0, '빨강 0 이면 자가 눈이 멀었는지 먼저 봐라');
  for (const r of red) { for (const k of ['kind', 'place', 'op']) assert.ok(r[k], k); assert.ok(r.repro?.scene && r.repro?.op && r.repro?.spec, key(r)); assert.equal(r.repeat.length, 2, key(r)); }
});
test('R3 앱 칸에 ⌘C·⌘D 칸이 없다 — OS 클립보드를 덮는다', () => {
  assert.deepEqual(R.filter((r) => r.app && ['dup', 'copypaste'].includes(r.op)).map(key), []);
  assert.ok(R.filter((r) => r.app).length > 0);
});
test('R4 손 명부 결손 표가 결손 종 전부를 잰다', () => {
  const want = CELLS.kinds.filter((k) => k.groups.includes('G4') || k.gaps.length).map((k) => k.cls).sort();
  assert.deepEqual(GAP.map((g) => g.kind).sort(), want);
  for (const g of GAP) assert.ok(Object.keys(g.dup).length || Object.keys(g.drag).length || Object.keys(g.pick).length, g.kind);
});
