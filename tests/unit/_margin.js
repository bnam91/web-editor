/* _margin.js — 시트 271 «문턱에 붙은 자»가 초록일 때도 값을 찍는다(지디 261029 ⒟ ⑴ · ⛔경고 아님 · 값).
 *   kind: cap = 지금 ≤ 문턱(여유 = 문턱 − 지금) · floor = 지금 ≥ 문턱(여유 = 지금 − 문턱) · equal = 지금 == 문턱(여유 = 차).
 *   래칫은 여유 0 이 정의다 — 예산만 여유가 뜻이 있다(시트 261031 ⒜). 표는 tools/margin-table.mjs 가 만든다. */
'use strict';
// 찍기는 stderr: stdout 은 test runner 의 직렬화 통로라 섞이면 Unable to deserialize 로 파일이 빨개진다(켬 10/40 · 끔 0/40 · stderr 0/40).
const { spawnSync } = require('node:child_process');
let _sha = null;
/* 판은 값을 찍는 때 읽는다 — 여유는 판에 매인 수다(시트 271 · 표 만드는 때 읽으면 남의 판 로그도 지금 판으로 적힌다). */
const board = () => (_sha ??= spawnSync('git', ['rev-parse', '--short=8', 'HEAD'], { cwd: __dirname, encoding: 'utf8' }).stdout?.trim() || '(못 읽음)');
function margin(label, now, limit, kind = 'cap') {
  const left = kind === 'floor' ? now - limit : kind === 'equal' ? -Math.abs(now - limit) : limit - now;
  console.error(`[여유] ${JSON.stringify({ label, kind, now, limit, left, sha: board() })}`);
}
/* 래칫이 빨개졌을 때 — 「⛔문턱 올리지 마라」 다음에 할 일(지디 261029 ⒟ ⑵). */
const WHAT_NOW = '\n  그래서 무엇을 하나:'
  + '\n  ㉠ 정말 늘렸나 — 바닥 판 워크트리에서 node tests/run-unit.mjs <이 파일> 을 한 벌 더'
  + '\n  ㉡ 늘린 게 맞고 불가피하면 — ⛔문턱을 올리지 말고 같은 묶음에서 그만큼 줄여라'
  + '\n  ㉢ 못 줄이면 — 문턱 올리기를 발주로 내라(그 자가 지키려던 것 · blame · 올린 뒤 여유를 같이)';
module.exports = { margin, WHAT_NOW };
