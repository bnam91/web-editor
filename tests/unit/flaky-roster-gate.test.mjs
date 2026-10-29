/* flaky-roster-gate.test.mjs — 209 tests/dom/flaky-roster.gate.js 의 판정(순수 함수)을 합성 로그로 잰다 (S3 · 261028)
 *   ⛔DOM 안 돌림 · 파일 쓰기 0. 실로그 행위(S7 8608bb13 · flaky 13 · spec 11 · 명부에 없음 9 · rc 1)는 보고서에.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const { readFlaky, rosterSpecs, unlisted } = createRequire(import.meta.url)('../dom/flaky-roster.gate.js');
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const REAL_MD = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dom', 'FLAKY.md'), 'utf8');

const HEAD = 'Running 40 tests using 4 workers\n\n';
const SUM = (flakyBlock) => `${HEAD}  2 failed\n    tests/dom/a.dom.spec.js:1:1 › x\n${flakyBlock}  30 passed (1.0m)\n`;
const FL = (rows) => `  ${rows.length} flaky\n${rows.map((r) => `    tests/dom/${r}.dom.spec.js:10:1 › 칸 ${r}\n`).join('')}`;
const MD = '# FLAKY\n- tests/dom/known-one.dom.spec.js:10 — 2/3\n';

test('G1 ★못 잰다를 통과로 접지 않는다 — 머리줄 없음 · 요약 수 ≠ 줄 수', () => {
  assert.equal(readFlaky('hello').ok, false, '머리줄 없는데 ok');
  const bad = `${HEAD}  3 flaky\n    tests/dom/x.dom.spec.js:1:1 › a\n  30 passed\n`;
  const r = readFlaky(bad);
  assert.equal(r.ok, false, `flaky 3 인데 줄 1 을 ok 로 받았다: ${JSON.stringify(r)}`);
});

test('G2 flaky 0(요약 줄 없음) = 명부에 없음 0 · 통과', () => {
  const v = unlisted(SUM(''), MD);
  assert.deepEqual([v.ok, v.flakyN, v.missing], [true, 0, []]);
});

test('G3 ★양성 — 명부에 없는 spec 이 흔들리면 그 이름을 짚는다', () => {
  const v = unlisted(SUM(FL(['known-one', 'new-flaker', 'new-flaker'])), MD);
  assert.deepEqual([v.ok, v.flakyN, v.specs, v.missing], [true, 3, ['known-one.dom.spec.js', 'new-flaker.dom.spec.js'], ['new-flaker.dom.spec.js']]);
});

test('G4 음성 — 명부에 있는 spec 만 흔들리면 통과 · 명부 글자는 줄 어디에 있어도 «이름»', () => {
  assert.deepEqual(unlisted(SUM(FL(['known-one'])), MD).missing, []);
  assert.ok(rosterSpecs('설명 안에 known-two.dom.spec.js 가 있다').has('known-two.dom.spec.js'));
  assert.equal(rosterSpecs('known-one.dom.spec 만').size, 0, '확장자 없는 글자를 이름으로 셌다');
});

test('G5 flaky 블럭 뒤 줄(passed 요약)을 이름으로 안 먹는다', () => {
  const r = readFlaky(SUM(FL(['known-one'])));
  assert.deepEqual(r.lines.map((x) => x.spec), ['known-one.dom.spec.js']);
});

/* ★지디 261029 14:5x ⒝⒞ — 실 FLAKY.md 로: «측정 가지 전용» 절(명부 밖)의 이름은 명부로 안 센다 · 명부 안 이름은 그대로 «명부 안». */
test('G6 ★양성 — 실 FLAKY.md «측정 가지 전용» 절의 spec 이 흔들리면 «미등재» 로 짚는다(분모에서 뺐다)', () => {
  assert.ok(REAL_MD.includes('## ⛔측정 가지 전용') && REAL_MD.includes('q2274-handle-leak-userpath.dom.spec.js'), '★전제: 실 FLAKY.md 에 그 절과 그 이름이 있다');
  assert.equal(rosterSpecs(REAL_MD).has('q2274-handle-leak-userpath.dom.spec.js'), false, '측정 가지 전용 절의 이름을 명부로 셌다(거짓 «명부 안»)');
  const v = unlisted(SUM(FL(['q2274-handle-leak-userpath'])), REAL_MD);
  assert.deepEqual([v.ok, v.missing], [true, ['q2274-handle-leak-userpath.dom.spec.js']]);
});
test('G7 음성 — 실 FLAKY.md «명부» 안 이름은 «미등재» 로 안 찍힌다(양성만이면 «전부 미등재» 항등식일 수)', () => {
  assert.ok(rosterSpecs(REAL_MD).has('s3v-icon-text.dom.spec.js'), '★전제: 명부 첫 줄 이름이 명부로 읽힌다');
  const v = unlisted(SUM(FL(['s3v-icon-text'])), REAL_MD);
  assert.deepEqual([v.ok, v.missing], [true, []]);
});
