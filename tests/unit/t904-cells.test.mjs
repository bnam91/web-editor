/* t904-cells — t9-04 칸 표가 소스에서 뜬 값과 같고, 분모가 SECTION_BLOCK_TYPE_SEL 길이다.
 * 표 다시 쓰기: node tests/dom/_t904-write-cells.js · 재는 건(t9-05~07)은 표의 measured 를 결과로 채운다. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(import.meta.url);
const { planOf, summary, kindsOf } = require(path.join(ROOT, 'tests/dom/_t904-plan.js'));
const FILE = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests/dom/t904-cells.json'), 'utf8'));
const plan = planOf(ROOT);
test('C1 분모 = SECTION_BLOCK_TYPE_SEL 길이 · 전 칸 = 종 × 자리 × 조작', () => {
  const sel = kindsOf(ROOT);
  assert.ok(sel.length > 0);
  assert.deepEqual(FILE.kinds.map((k) => k.cls), sel);
  assert.equal(FILE.summary.kinds, sel.length);
  assert.equal(FILE.cells.length, sel.length * FILE.places.length * FILE.ops.length);
});
test('C2 표가 소스에서 뜬 값과 같다 — 종·입구·손 명부가 바뀌면 표를 다시 써라', () => {
  const fresh = plan.cells.map((c) => [c.kind, c.place, c.op, c.run, c.route].join('|'));
  assert.deepEqual(FILE.cells.map((c) => [c.kind, c.place, c.op, c.run, c.route].join('|')), fresh);
  assert.deepEqual(FILE.kinds, plan.kinds);
  assert.deepEqual(FILE.summary, summary(plan));
});
test('C3 모든 칸에 measured 열 · 안 도는 칸은 까닭 · 도는 칸은 까닭 없음', () => {
  for (const c of FILE.cells) {
    assert.equal(typeof c.measured, 'boolean', JSON.stringify(c));
    assert.equal(c.run ? c.why === null : typeof c.why === 'string' && c.why.length > 0, true, JSON.stringify(c));
  }
});
test('C4 페어와이즈가 빈틈이 없다 — 전수 종은 자리마다, 자리와 곱하는 조작도 자리마다 돈다', () => {
  const run = FILE.cells.filter((c) => c.run);
  for (const k of FILE.kinds.filter((x) => x.tier === 'all' || x.tier === 'rep')) for (const p of FILE.places) assert.ok(run.some((c) => c.kind === k.cls && c.place === p), `${k.cls} ${p}`);
  for (const o of FILE.ops.filter((x) => x.perPlace)) for (const p of FILE.places) assert.ok(run.some((c) => c.op === o.id && c.place === p), `${o.id} ${p}`);
  for (const k of FILE.kinds.filter((x) => x.tier === 'all' || x.tier === 'rep')) for (const o of FILE.ops) assert.ok(run.some((c) => c.kind === k.cls && c.op === o.id), `${k.cls} ${o.id}`);
});
test('C5 입구 없는 종만 회색 · G2 만인 종은 대표 하나가 잰다', () => {
  for (const k of FILE.kinds) assert.equal(k.tier === 'gray', !k.entry, k.cls);
  assert.equal(FILE.kinds.filter((k) => k.tier === 'rep').length <= 1, true);
  for (const k of FILE.kinds.filter((x) => x.tier === 'covered')) assert.deepEqual(k.groups, ['G2'], k.cls);
});
test('C6 찾은 것이 표에 남는다 — draggable 은 t9-05 가 행동을 잰다', () => {
  assert.deepEqual(FILE.findings, plan.findings);
  const f = FILE.findings.find((x) => x.id === 'draggable-after-roundtrip');
  assert.ok(f, 'draggable 칸이 표에 없다');
  assert.equal(f.ticket, 't9-05');
  const sel = kindsOf(ROOT);
  assert.ok(f.kinds.length > 0 && f.kinds.every((k) => sel.includes(k)), f.kinds.join());
});
