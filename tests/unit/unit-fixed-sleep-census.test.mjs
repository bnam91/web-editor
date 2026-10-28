/* unit-fixed-sleep-census.test.mjs — ★tests/unit 의 «고정 잠» 이 늘지 않는다 (S3 · 261028 · 지디 판정 «unit 고정 sleep 축» · 231 가족)
 *
 * ★왜: dom-fixed-wait-census 는 DOM spec(과 그것이 부르는 파일)만 본다 — tests/unit 시험 자체의 고정 잠은 재는 자가 0 이었다.
 * ★자(수 전에 자): 주석 뗀 소스(정본 tests/unit/_strip-comments.js)에서 «그 줄의 문자열 밖» 의 `setTimeout(…, N)` · `sleep(N)` · `waitForTimeout(N)` —
 *   부름 하나 = 한 곳(new Promise(r => setTimeout(r, N)) 도 setTimeout 하나로 · 겹침 없음) · N = 숫자 글자 ★> 0 만.
 *   ⛔0 은 안 센다 — setTimeout(fn, 0) 은 «다음 틱»(이벤트 루프 한 바퀴)이지 «시간을 기다림» 이 아니다(grid-ifg-icon-pick 등).
 *   ⛔문자열 안은 안 센다 — tmproot.test.js:27 `setTimeout(()=>{},60000)` 은 «자식 프로세스 소스 글자»(spawnSync timeout 4000 + SIGKILL 로 죽일 때까지 살려 두기)
 *     ⇒ 이 시험의 대기가 아니다 · ★그 시험의 «참 대기» 는 spawnSync timeout 4000(늘 닿음) — 이 자가 못 보는 꼴(spawn timeout) · 이름으로 적음.
 *   ⚠️한계(단언 안 함): ① 문자열 판정은 «그 줄 앞쪽 따옴표 수 홀짝» — 같은 줄 앞에 따옴표 든 정규식 리터럴이 있으면 놓친다(파일 전체 추적은 vhist-detail 6 곳을 0 으로 읽어 버림)
 *     ② 변수 N(setTimeout(r, ms)) 은 안 센다 ③ spawn/exec timeout · 바쁜 대기 · tests/unit 밖(tests/*.mjs 등)은 안 본다.
 * ★잰 값(판 df2ebf2a · 481 파일): 든 파일 10 · 곳 21 · 합 2710ms · ★하네스(tests/unit/_*) 0 ⇒ 하네스 명부 {} 로 시작(더하면 그 자리 빨강 · 면제 명부 불요).
 *   ⚠️지디 «≈27 · 14 파일» 과 자가 다르다(지디 자 원문 미상 · 내 앞 «21/10» 은 0 도 셈 + 맨 setTimeout 안 셈 = 또 다른 자 — 셋이 다름).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const { stripComments } = createRequire(import.meta.url)('./_strip-comments.js');
const ROOT = path.join(import.meta.dirname, '..', '..');
const UNIT = path.join(ROOT, 'tests', 'unit');
const SELF = path.basename(fileURLToPath(import.meta.url));

function scan(src) {
  const s = stripComments(src), out = [];
  // ★문자열 안 판정 = «그 줄에서 앞쪽 따옴표 수» 가 홀수(줄 단위 · 파일 전체 추적은 정규식 리터럴 따옴표에 깨져 vhist-detail 6 곳을 0 으로 읽었다 — 버림)
  const lineStart = (i) => s.lastIndexOf('\n', i - 1) + 1;
  const inStrAt = (i) => { const pre = s.slice(lineStart(i), i); return ['`', "'", '"'].some((q) => (pre.split(q).length - 1) % 2 === 1); };
  const re = /\b(setTimeout|sleep|waitForTimeout)\(/g; let m;
  while ((m = re.exec(s))) {
    if (inStrAt(m.index)) continue;
    let d = 0, k = m.index + m[0].length - 1, lastComma = -1, end = -1;
    for (; k < s.length; k++) { const c = s[k]; if ('([{'.includes(c)) d++; else if (')]}'.includes(c)) { d--; if (d === 0) { end = k; break; } } else if (c === ',' && d === 1) lastComma = k; }
    if (end < 0) continue;
    const arg = (m[1] === 'setTimeout' ? (lastComma < 0 ? '' : s.slice(lastComma + 1, end)) : s.slice(m.index + m[0].length, end)).trim();
    if (/^\d+$/.test(arg) && Number(arg) > 0) out.push({ kind: m[1], ms: Number(arg), line: s.slice(0, m.index).split('\n').length });
  }
  return out;
}

const BASE = {
  'autosave-overlap.test.js': 2, 'autosave-suppress.test.js': 1, 'devtools-gate.test.js': 3, 'google-login-loopback.test.mjs': 1,
  'history-ipc.test.js': 1, 'inspector-jump-flash.test.mjs': 2, 'mcp-contract.test.js': 1, 'quit-save-guard.test.mjs': 2,
  'spacing-wiring.test.js': 2, 'vhist-detail.test.js': 6,
};
const BASE_MS = 2710;
function census() {
  const out = { read: 0, by: {}, ms: 0, at: [] };
  for (const f of fs.readdirSync(UNIT).filter((n) => /\.(m?js|cjs)$/.test(n) && n !== SELF).sort()) {
    out.read++;
    const r = scan(fs.readFileSync(path.join(UNIT, f), 'utf8'));
    if (!r.length) continue;
    out.by[f] = r.length; out.ms += r.reduce((a, x) => a + x.ms, 0);
    for (const x of r) out.at.push(`${f}:${x.line} ${x.kind}(${x.ms})`);
  }
  return out;
}
test('S0 ★자가 산다 — 양성(맨 setTimeout · Promise 감싼 것 · sleep) · 음성(0 · 주석 · 문자열 안)', () => {
  const T = 'set' + 'Timeout', S = 'sle' + 'ep';
  assert.equal(scan(`${T}(() => {}, 60000)`).length, 1, '양성: 맨 꼴');
  assert.equal(scan(`await new Promise(r => ${T}(r, 30))`).length, 1, '양성: Promise 감싼 꼴(겹침 없이 하나)');
  assert.equal(scan(`${S}(5)`).length, 1, '양성: sleep');
  assert.equal(scan(`${T}(() => { a(1, 2); }, 250)`).length, 1, '양성: 콜백 안 쉼표');
  assert.equal(scan(`${T}(fn, 0)`).length, 0, '음성: 0 = 다음 틱');
  assert.equal(scan(`// ${T}(f, 99)\nx`).length, 0, '음성: 주석');
  assert.equal(scan('  `' + T + '(()=>{},60000);`,').length, 0, '음성: 문자열(자식 소스) 안');
});
test('S1 ★tests/unit 고정 잠이 늘지 않는다 · 하네스(_*)는 0 · 줄었으면 명부를 줄여라', () => {
  const c = census();
  console.log(`    [S1] tests/unit 읽음 ${c.read} · 든 파일 ${Object.keys(c.by).length} · 곳 ${c.at.length} · 합 ${c.ms}ms (기준 ${BASE_MS})`);
  assert.ok(c.read > 100, `전제: tests/unit 을 못 읽었다(${c.read})`);
  const harn = c.at.filter((a) => a.startsWith('_'));
  assert.deepEqual(harn, [], '★공용 하네스(tests/unit/_*)에 고정 잠 — 그 하네스를 쓰는 시험 전부가 잔다(조건 대기로)');
  const grew = [], shrank = [];
  for (const f of new Set([...Object.keys(BASE), ...Object.keys(c.by)])) {
    const b = BASE[f] || 0, n = c.by[f] || 0;
    if (n > b) grew.push(`${f} ${b} → ${n} — ${c.at.filter((a) => a.startsWith(f + ':')).join(' · ')}`);
    else if (n < b) shrank.push(`${f} ${b} → ${n}`);
  }
  assert.deepEqual(grew, [], '고정 잠이 늘었다');
  assert.ok(c.ms <= BASE_MS, `합 ms 가 늘었다: ${BASE_MS} → ${c.ms}`);
  assert.deepEqual(shrank, [], '줄었다 — 고맙다 · BASE 를 그 수로 줄여라(⛔썩은 면제)');
});
