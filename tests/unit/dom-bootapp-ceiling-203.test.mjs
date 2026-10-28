/* dom-bootapp-ceiling-203.test.mjs — ★한 DOM spec 이 bootApp 을 부르는 수가 ★늘지 않는다 (203 · 래칫)
 *
 * ★왜 (203 «검사 한 판이 앱을 여러 번 띄운다» · 지디 261029 14:4x):
 *   _root-harness.js 의 bootApp 은 부를 때마다 index.html + 전 스크립트를 새로 싣는다. «한 번 띄우고 장면만 되돌리는 길» 은 없다
 *   (내보내는 것 일곱 · bootApp 에 reset·teardown 0 줄) ⇒ ⛔그 길을 만들기 전에 ★상한부터 — 늘지 않게 잠근다.
 *   ⛔«장면만 되돌리기» 를 먼저 만들지 마라(같은 함수 주석의 prompt() 선례 — 앞 시험 상태가 남아 거짓 초록).
 *
 * ★자 (S5 261029 · 판 333aa3d9 에서 세어 박음 · ⛔손으로 박지 마라 — 아래 BASELINE 은 R1 이 찍는 수 그대로):
 *   tests/dom/*.spec.js 마다 «주석 뗀 소스(tests/unit/_strip-comments.js)» 에서 bootApp( 부름 «낱자» 수(정의 `function bootApp(` 은 뺌 · 줄 아님 — 한 줄 두 번은 둘).
 *   ⚠️자의 한계(적어 둔다): setup() 안에서 bootApp 을 «한 번» 부르고 test 마다 setup() 을 부르는 spec 은 낱자 1 인데 실제 기동은 test 수다
 *     ⇒ 이 자는 «글로 적힌 부름» 의 상한이다 · 실제 기동 수의 상한이 아니다(그건 시간 상관 ⒝ — 인텔 무거운 슬롯 거리).
 *
 * ★래칫 규칙(anchor-signature-ratchet 꼴):
 *   R1 가장 큰 파일의 수 ≤ BASELINE.max · 그 파일 이름 = BASELINE.top(아는 표본 = 양성대조) — 넘으면 빨강(⛔기준을 올려 닫지 마라)
 *   R2 줄었으면 ★기준을 내려라(같은 커밋에 — «명부·수를 고치는 변경은 그 수를 틀리게 만드는 커밋과 같은 커밋에»)
 *   ≥2 인 파일 수는 «찍기만» 한다(새 spec 이 test 둘을 가지면 늘어나는 게 정상이라 단언 아님). */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const { stripComments } = createRequire(import.meta.url)('./_strip-comments.js');

const ROOT = process.env.GD1001_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DOM = path.join(ROOT, 'tests', 'dom');
/* ★S5 261029 · 판 333aa3d9 (tree 08ff1236) 실측 — spec 617 · 맨 위 count-sticker 33 · 둘째 coin-sticker 19 · ≥2 파일 120 */
const BASELINE = Object.freeze({ max: 33, top: 'count-sticker.dom.spec.js' });

/** 주석 뗀 소스의 bootApp( 부름 낱자(정의 줄 뺌 · 다른 이름의 xbootApp( · a.bootApp( 은 안 셈) */
function calls(src) {
  const s = stripComments(src);
  return (s.match(/(^|[^\w.$])bootApp\(/g) || []).length - (s.match(/function\s+bootApp\(/g) || []).length;
}
function census() {
  const rows = [];
  for (const f of fs.readdirSync(DOM).sort()) {
    if (!f.endsWith('.spec.js')) continue;
    rows.push([f, calls(fs.readFileSync(path.join(DOM, f), 'utf8'))]);
  }
  rows.sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
  return rows;
}

test('R0 자가 산다 — 낱자로 센다(한 줄 둘 = 2) · 주석 속·정의·다른 이름은 안 센다', () => {
  const SRC = [
    "const { bootApp } = require('./_root-harness.js');",
    "async function setup(page) { await bootApp(page); }",
    "test('a', async ({ page }) => { await bootApp(page); await bootApp(page); });",
    "// await bootApp(page) 주석",
    "/* bootApp(page) 블럭 주석 */",
    "async function bootApp(page) {}",
    "await h.bootApp(page); await rebootApp(page);",
  ].join('\n');
  assert.equal(calls(SRC), 3);
});

test('R1 ★가장 큰 spec 의 bootApp 수 ≤ 기준 · 그 이름 = 아는 표본(양성대조 — 자가 0 을 세면 여기서 빨강)', () => {
  const rows = census();
  const [top, n] = rows[0];
  const ge2 = rows.filter((r) => r[1] >= 2).length;
  console.log(`  R1 ★지금 — spec ${rows.length} · 맨 위 ${top} ${n} · 둘째 ${rows[1][0]} ${rows[1][1]} · ≥2 파일 ${ge2}(찍기만)`);
  assert.ok(rows.length > 100, `★tests/dom spec 을 읽어야 한다(${rows.length})`);
  assert.ok(n <= BASELINE.max, `★${top} 이 bootApp 을 ${n} 번 부른다 — 기준 ${BASELINE.max} 를 넘었다(203: 한 spec 이 앱을 더 띄운다) · ⛔기준을 올려 닫지 마라`);
  assert.equal(top, BASELINE.top, `★맨 위가 바뀌었다(${top} ${n}) — 아는 표본이 줄었다면 R2 · 아니면 자가 바르게 세나부터`);
});

test('R2 ★줄었으면 기준을 내려라(래칫 — 같은 커밋에)', () => {
  const [top, n] = census()[0];
  assert.equal(n, BASELINE.max, `★맨 위 ${top} 가 ${n}(기준 ${BASELINE.max}) — 줄었으면 BASELINE.max 를 ${n} 로 내려라(⛔더 큰 쪽으로는 R1 이 막는다)`);
});
