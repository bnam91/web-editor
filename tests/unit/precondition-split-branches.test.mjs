/* precondition-split-branches.test.mjs — ★293 «전제 실패가 결함으로 세어진다» 를 자가 막나 (imac-gd-L3 · J196E)
 *   ★병: 261101 «단독 빨강 6» 을 그대로 «진짜 빨강 6» 으로 읽었다 — 메시지를 보니 하네스 2 · 전제 3 · 단언 1. 옛 자는 «전제 — …»·page.goto 를 «그 밖» 에 넣었다.
 *   B1 그 여섯 메시지 → 갈래 수 2·3·1 / B2 자 자신의 --self-test / B3 받는 자리: 갈래 칸이 비면 rc 1 · 다 있으면 rc 0 · 줄 0 은 rc 3 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const GATE = fileURLToPath(new URL('../dom/precondition-split.gate.js', import.meta.url));
const { split, verdict, rosterLines, checkRoster } = createRequire(import.meta.url)(GATE);

const SIX = [
  ['e80-delete-sweep.dom.spec.js:88:5', 'K1', ['Test timeout of 30000ms exceeded.', 'Error: page.goto: Test timeout of 30000ms exceeded.']],
  ['e80-delete-sweep.dom.spec.js:93:5', 'K2', ['Test timeout of 30000ms exceeded.', 'Error: page.goto: Test timeout of 30000ms exceeded.']],
  ['e80-delete-sweep.dom.spec.js:139:5', 'K7', ['Error: 전제 — 열 둘 다중 선택', 'expect(received).toBe(expected) // Object.is equality']],
  ['grid-plus-g15.dom.spec.js:214:5', 'P3', ['Error: 전제 — 2열 ＋ 가운데가 눌린다', 'expect(received).toBe(expected) // Object.is equality']],
  ['grid-plus-g15.dom.spec.js:373:5', 'R4', ['Error: 전제 — 아래 ＋ 는 그리드 바로 아래', 'expect(received).toBe(expected) // Object.is equality']],
  ['scratch-layer-order.dom.spec.js:268:5', 'L7', ['Error: expect(received).toEqual(expected) // deep equality']],
];
const LOG = [
  ...SIX.flatMap(([k, t, ls], i) => [`  ${i + 1}) tests/dom/${k} › ${t} ─────`, '', ...ls.map((l) => `    ${l}`), '', `    > 60 |   await expect(a).toBe(b);`, '']),
  '  6 failed', ...SIX.map(([k, t]) => `    tests/dom/${k} › ${t}`), '  3 passed (1m)',
].join('\n');

test('B1 ★261101 «단독 빨강 6» → 하네스 2 · 전제 3 · 단언 1', () => {
  const r = split(LOG);
  assert.equal(verdict(r).rc, 0, verdict(r).why);
  const n = {};
  for (const l of rosterLines(r)) { const k = l.split('\t')[1]; n[k] = (n[k] || 0) + 1; }
  assert.deepEqual(n, { '⒜하네스': 2, '⒝전제': 3, '⒞단언': 1 });
});
test('B2 자 자신의 양성·음성', () => {
  const s = spawnSync(process.execPath, [GATE, '--self-test'], { encoding: 'utf8' });
  assert.equal(s.status, 0, s.stdout);
});
test('B3 ★받는 자리 — 갈래가 비면 빨강 · 메시지가 비면 빨강 · 다 있으면 초록 · 줄 0 은 못 쟀다', () => {
  assert.equal(checkRoster('a.spec:1 › K1\t\tpage.goto: x\n').rc, 1);
  assert.equal(checkRoster('a.spec:1 › K1\t⒞단언\t\n').rc, 1);
  assert.equal(checkRoster('a.spec:1 › K1\n').rc, 1);
  assert.equal(checkRoster('a.spec:1 › K1\t빨강\tx\n').rc, 1);
  assert.equal(checkRoster(rosterLines(split(LOG)).join('\n')).rc, 0);
  assert.equal(checkRoster('\n').rc, 3);
});
