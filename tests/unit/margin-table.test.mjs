/* margin-table.test.mjs — 시트 271 ⑴ 「문턱에 붙은 자가 값을 찍는다」 표의 자.
 *   M1 ⑴ 지금 = 문턱 ⇒ 여유 0 ⑵ 한 칸 떨어뜨리면 여유 1(항등식 아님) · floor · equal
 *   M2 표: 판 sha · 같은 값 = 같음 · 다른 값 = 흔들림 · 줄 0 = rc 2
 *   M3 ★명부(이름) — 이 자리들이 값을 찍고 빨강에 세 갈래를 붙인다. 빼면 빨강 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require_ = createRequire(import.meta.url);
const { mkTmpRoot } = require_('./_tmproot.js');
const { margin, WHAT_NOW } = require_('./_margin.js');
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const TOOL = path.join(ROOT, 'tools', 'margin-table.mjs');
const table = (...logs) => spawnSync(process.execPath, [TOOL, ...logs], { cwd: ROOT, encoding: 'utf8' });
const lineOf = (...a) => {
  const log = console.log; let out = '';
  console.log = (s) => { out = s; };
  try { margin(...a); } finally { console.log = log; }
  return out;
};
const leftOf = (...a) => JSON.parse(lineOf(...a).slice('[여유] '.length)).left;

test('M1 ★여유 — 문턱에 앉으면 0 · 한 칸 떨어지면 1 · 넘으면 음수 · floor · equal', () => {
  assert.equal(leftOf('x', 5, 5), 0);
  assert.equal(leftOf('x', 4, 5), 1);
  assert.equal(leftOf('x', 6, 5), -1);
  assert.equal(leftOf('x', 49, 47, 'floor'), 2);
  assert.equal(leftOf('x', 5, 5, 'equal'), 0);
  assert.equal(leftOf('x', 6, 5, 'equal'), -1);
});
test('M2 ★표 — 판 sha · 같음 · 흔들림 · 줄 0 은 rc 2', () => {
  const d = mkTmpRoot('margin-table-');
  const w = (n, ...ls) => { const p = path.join(d, n); fs.writeFileSync(p, ls.join('\n') + '\n'); return p; };
  const a = w('a', '# ' + lineOf('고정', 5, 5), lineOf('흔들', 3, 9));
  const b = w('b', '# ' + lineOf('고정', 5, 5), lineOf('흔들', 4, 9));
  const r = table(a, b);
  assert.equal(r.status, 0, r.stderr);
  const sha = spawnSync('git', ['rev-parse', '--short=8', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).stdout.trim();
  const rows = r.stdout.trim().split('\n').slice(1).map((l) => l.split('\t'));
  assert.deepEqual(rows[0], ['고정', 'cap', '5', '5', '0', sha, '같음 ×2'], r.stdout);
  assert.deepEqual(rows[1].slice(0, 2).concat(rows[1][6]), ['흔들', 'cap', '흔들림 3·4'], r.stdout);
  const other = lineOf('고정', 5, 5).replace(sha, 'deadbeef');
  assert.equal(table(a, w('o', other)).stdout.trim().split('\n')[1].split('\t')[5], `${sha}·deadbeef`, '★판이 섞이면 표가 말한다');
  assert.equal(table(w('c', '[여유] 아닌 줄')).status, 2);
  assert.equal(table(path.join(d, '없는파일')).status, 3);
});
const SITES = {
  'tests/unit/dom-fixed-wait-census.test.mjs': ['dom-fixed-wait W3 곳', 'dom-fixed-wait W3 합ms', 'dom-fixed-wait W6 변수곳', 'dom-fixed-wait H2 하네스ms'],
  'tests/unit/fixed-window-census.test.mjs': ['fixed-window W2 명부 창'],
  'tests/unit/anchor-signature-ratchet.test.mjs': ['anchor R1 서명', 'anchor R1 파일', 'anchor R4 리터럴(바닥)', 'anchor R4 변수'],
  'tests/unit/unit-fixed-sleep-census.test.mjs': ['unit-fixed-sleep S1 곳', 'unit-fixed-sleep S1 합ms'],
  'tests/unit/grid-picked-image-entrances.test.mjs': ['grid-picked E91 data URL'],
  'tests/unit/align-btn-ssot.test.mjs': ['align-btn T0-b 호출', 'align-btn T0-c 파일'],
  'tests/unit/mcp-response-budget.test.js': ['get_canvas_state_blocks', 'get_canvas_state_summary', 'read_section', 'read_project', 'update_block', 'put_image 거절', 'put_image 성공'].map((n) => `mcp 예산 ${n}(하네스`),
  'tests/dom/grid-cell-panel-handles.dom.spec.js': ['grid-cell-panel G2 순증px'],
  'tests/dom/grid-row-gutter-longtask-207-208.dom.spec.js': ['longtask-207 ${k} 개수'],
};
test('M3 ★명부 — 이 자리들이 값을 찍는다 · 래칫 빨강엔 세 갈래가 붙는다', () => {
  for (const [f, labels] of Object.entries(SITES)) {
    const s = fs.readFileSync(path.join(ROOT, f), 'utf8');
    for (const l of labels) assert.ok(s.includes(`margin('${l}`) || s.includes('margin(`' + l), `${f} 이 «${l}» 를 안 찍는다`);
  }
  for (const k of ['㉠', '㉡', '㉢']) assert.ok(WHAT_NOW.includes(k), k);
  for (const f of ['dom-fixed-wait-census.test.mjs', 'fixed-window-census.test.mjs', 'anchor-signature-ratchet.test.mjs', 'unit-fixed-sleep-census.test.mjs', 'grid-picked-image-entrances.test.mjs'])
    assert.match(fs.readFileSync(path.join(ROOT, 'tests/unit', f), 'utf8'), /\bWHAT_NOW\)|\$\{WHAT_NOW\}/, `${f} 빨강에 세 갈래가 없다`);
});
