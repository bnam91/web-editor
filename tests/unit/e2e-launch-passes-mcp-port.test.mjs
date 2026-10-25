/* e2e-launch-passes-mcp-port.test.mjs
 *   ★★`E2E-HARDCODED-FORBIDDEN-PORT-9345-01` — ★e2e 가 앱을 띄울 때 ★`GODITOR_MCP_PORT` 를
 *   ★★«넘겼는가»를 잰다. (2026-10-25 신설 · 지디)
 *
 * ★왜 — ★앱은 ★그 환경변수가 ★없으면 ★★스스로 ★9345 부터 ★잡는다(★금지대역 9345~9365).
 *   ⇒ ★e2e 가 ★그걸 ★안 넘기면 ★남의 실사용 goditor·클로드앱 커넥터 자리를 ★먹는다.
 *
 * ★★★⛔「포트가 ★9345 가 ★아니다」로 ★재지 ★마라 — ★★그건 ★우연히 통과한다
 *   (★그 순간 ★9345 가 ★차 있으면 ★앱이 ★9346 으로 ★옆걸음친다 ⇒ ★★여전히 ★금지대역인데 ★초록).
 *   ⇒ ★★재는 것은 ★★«넘겼는가» ★하나다. ★그것이 ★이 검사의 ★값이다.
 *
 * ★★`launchApp()`(helpers.js:25)은 ★★이 명부 ★밖이다 — ★`--remote-debugging-port=9334` ★하드코딩이고
 *   ★두 스펙이 ★머리말에 ★「⛔쓰지 않는다」라고 ★박아 뒀다. ★그 사실을 ★★`G3` 이 ★잠근다
 *   (★그 함수가 ★검사에서 ★되살아나면 ★빨강). ★이름 `E2E-LAUNCHAPP-HARDCODES-9334-01`.
 *
 * ⛔안 재는 축 — ★실제로 띄워서 ★앱이 ★무슨 포트를 잡나(★앱 축 · `E2E-LAUNCH-REAL-PORT-UNMEASURED-01`).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
/* ★주석 걷기는 ★공용 부품 — ⛔제 벌을 만들지 마라(`strip-comments-shared.test.js` ★S-6). */
const _req = createRequire(import.meta.url);
const { stripComments } = _req('./_strip-comments.js');

/** `_electron.launch({ … })` 호출을 ★괄호 균형으로 떠낸다 — ★정규식 한 방으로 자르지 않는다. */
function launchCalls(code) {
  const out = [];
  const re = /_electron\.launch\(/g;
  let m;
  while ((m = re.exec(code))) {
    let i = m.index + m[0].length - 1, depth = 0;
    for (; i < code.length; i++) {
      const c = code[i];
      if (c === '(') depth++;
      else if (c === ')') { depth--; if (depth === 0) { i++; break; } }
    }
    out.push(code.slice(m.index, i));
  }
  return out;
}

/* ★호출이 사는 파일 — ★손으로 적지 않고 ★`tests/e2e` 를 ★걸어 찾는다(★새 파일이 생겨도 ★따라온다). */
const E2E = path.join(ROOT, 'tests', 'e2e');
const FILES = fs.readdirSync(E2E)
  .filter(n => /\.(js|mjs)$/.test(n))
  .map(n => 'tests/e2e/' + n)
  .filter(rel => stripComments(read(rel)).includes('_electron.launch('));

test('G0 ★전제 — `_electron.launch` 를 부르는 파일이 하나 이상이고, 호출을 떠낼 수 있다', () => {
  assert.ok(FILES.length >= 1, `tests/e2e 에서 _electron.launch 를 부르는 파일이 0개다 — 이 검사가 아무것도 안 잰다`);
  let n = 0;
  for (const rel of FILES) n += launchCalls(stripComments(read(rel))).length;
  assert.ok(n >= 1, `호출을 하나도 못 떠냈다 (파일 ${FILES.length}개) — 판정 무효`);
});

test('G1 ★★앱을 띄우는 모든 자리가 `GODITOR_MCP_PORT` 를 넘긴다 (⛔「9345 가 아니다」로 재지 않는다)', () => {
  const bad = [];
  for (const rel of FILES) {
    const body = stripComments(read(rel));
    launchCalls(body).forEach((call, i) => {
      /* ★`launchApp()`(9334 하드코딩 · 두 스펙이 「쓰지 않는다」로 박아 둔 것)은 ★G3 가 따로 잠근다 */
      if (/--remote-debugging-port=9334/.test(call)) return;
      if (!/GODITOR_MCP_PORT/.test(call)) bad.push(`${rel} 의 ${i + 1}번째 호출`);
    });
  }
  assert.deepEqual(bad, [],
    `앱을 띄우면서 GODITOR_MCP_PORT 를 안 넘기는 자리가 있다 — 앱이 스스로 9345(금지대역)부터 잡는다:\n  ${bad.join('\n  ')}`);
});

test('G2 ★넘기는 값이 ★금지대역(9345~9365) ★밖이다 — 상수로 박힌 경우만 센다', () => {
  const bad = [];
  for (const rel of FILES) {
    const body = stripComments(read(rel));
    for (const call of launchCalls(body)) {
      /* ★상수로 박힌 값만 본다. ★변수로 넘기는 값은 ★여기서 못 재므로 ★G1 이 「넘겼나」만 잠근다. */
      const m = call.match(/GODITOR_MCP_PORT\s*:\s*['"`](\d{4,5})['"`]/);
      if (!m) continue;
      const p = Number(m[1]);
      if (p >= 9345 && p <= 9365) bad.push(`${rel} → ${p}`);
    }
  }
  assert.deepEqual(bad, [], `금지대역(9345~9365) 값을 넘기는 자리:\n  ${bad.join('\n  ')}`);
});

test('G3 ★`launchApp()`(9334 하드코딩)이 ★검사에서 ★되살아나지 않았다 (E2E-LAUNCHAPP-HARDCODES-9334-01)', () => {
  const callers = [];
  for (const n of fs.readdirSync(E2E)) {
    if (!/\.(js|mjs)$/.test(n)) continue;
    const rel = 'tests/e2e/' + n;
    if (n === 'helpers.js') continue;              // ★정의 자리 — 여기선 선언만 한다
    const body = stripComments(read(rel));
    if (/\blaunchApp\s*\(/.test(body)) callers.push(rel);
  }
  assert.deepEqual(callers, [],
    `launchApp() 은 9334(현빈 데모 포트) 하드코딩 + 공용 프로필이다 — 검사에서 쓰면 안 된다:\n  ${callers.join('\n  ')}`);
});

test('G4 ★★자가점검 — 이 검사가 ★정말 본다 (변이: GODITOR_MCP_PORT 를 지우면 G1 이 빨강)', () => {
  const sample = `_electron.launch({ args: ['.', '--remote-debugging-port=9610'], env: { ...process.env, GODITOR_MCP_PORT: '9611' } })`;
  const calls = launchCalls(sample);
  assert.equal(calls.length, 1, '맛본 호출을 못 떠냈다');
  assert.ok(/GODITOR_MCP_PORT/.test(calls[0]), '맛본 호출에서 그 이름을 못 본다');
  const mutated = sample.replace(/,\s*env:[\s\S]*?\}\s*\}/, ' }');
  assert.ok(!/GODITOR_MCP_PORT/.test(launchCalls(mutated)[0] || ''),
    '변이(env 제거)에도 그 이름이 보인다 = 이 자는 아무것도 안 잰다');
});
