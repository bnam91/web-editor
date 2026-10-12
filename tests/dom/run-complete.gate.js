#!/usr/bin/env node
/* run-complete.gate.js — 「전수가 ★끝까지 돌았나」를 ★그 회차의 ★출력에서 ★파생해 잰다.
 *
 * ★왜 이 자가 생겼나 (2026-10-10 · t3suite)
 *   be4ebbc1 DOM 전수에서 ★`grid-img-frame-noop` 의 계측기 N0-a 가 빨개지자
 *   ★같은 파일 ★52개가 ★「did not run」으로 ★덮였다. 그런데:
 *     ⑴ `--list` Total = 3301 · 출력 머리 `Running 3301` ⇒ ★수로는 ★멀쩡해 보인다
 *     ⑵ ★판정을 받은 것은 ★3249(3237+4+8) ⇒ ★52 가 ★조용히 ★사라졌다
 *     ⑶ ★`tests/dom/EXPECT_N.md` 는 ★이 사고를 막겠다고 ★적혀 있지만(「파일이 통째로 안 돎」)
 *        ★★아무것도 ★그 문서를 ★읽지 않고(★doc-only), ★★값도 ★2864 로 ★437 묵어 있었다.
 *        ⇒ ★★산문이 ★약속한 것을 ★자가 ★안 재고 있었다.
 *   ⇒ ★이 자는 ★★«지켜야 할 수»를 ★손으로 ★들고 있지 ★않는다 — ★★같은 회차의 ★출력에서
 *     ★파생한다. ⇒ ★★갱신할 숫자가 ★없으니 ★★묵지 않는다(★EXPECT_N 이 묵은 ★그 병을 피한다).
 *
 * ★쓰는 법
 *   npx playwright test --config=tests/dom/playwright.dom.config.js > run.log 2>&1
 *   node tests/dom/run-complete.gate.js run.log      # rc 0 = 끝까지 돌았다
 *
 * ★★이 자가 ★재는 것 — ★「선언된 수」와 ★「판정을 받은 수」가 ★같은가, ★did not run 이 ★0 인가.
 * ★★⛔이 자가 ★★안 재는 것 (★수만 떼어 가지 말라고 ★여기 박아 둔다):
 *   ⛔「빨강이 ★없다」를 ★안 잰다 — ★failed>0 이어도 ★«끝까지 돌았으면» ★이 자는 ★초록이다.
 *   ⛔「skipped 가 ★정당한가」를 ★안 잰다 — ★스펙이 ★스스로 건너뛴 축은 ★이 자에게 ★통과다.
 *   ⛔「계측기(자가점검·양성대조)가 ★살아 있나」를 ★안 잰다 — ★그건 ★별건(㉡)이다.
 *      ★이 회차의 ★P2(양성대조)는 ★★제 파일을 ★안 덮었기에 ★이 자로는 ★★안 잡힌다.
 *   ⛔「--list 와 ★Running 이 ★맞나」만 보면 ★이 사고가 ★안 잡힌다 — ★그게 ⑴ 이다.
 */
'use strict';
const fs = require('fs');

const file = process.argv[2];
if (!file) { console.error('⛔쓰는 법: node tests/dom/run-complete.gate.js <전수 로그>'); process.exit(2); }
if (!fs.existsSync(file)) { console.error(`⛔로그가 없다: ${file}`); process.exit(2); }
const log = fs.readFileSync(file, 'utf8');

/* ★★⛔「못 찾았다」를 ★0 으로 ★접지 않는다 — ★그게 ★「답이 없다」를 ★「영」으로 ★바꾸는 자리다.
   ⇒ 머리줄/요약을 ★못 찾으면 ★통과가 아니라 ★★«못 쟀다»로 ★터진다. */
const mRun = log.match(/^Running (\d+) tests? using (\d+) workers?/m);
if (!mRun) {
  console.error('⛔「Running N tests」 머리줄을 못 찾았다 — 이 로그로는 ★못 잰다(통과 아님).');
  process.exit(3);
}
const declared = Number(mRun[1]);
const workers = Number(mRun[2]);

/* 요약 줄들 — ★없는 꼴은 ★0 이 아니라 ★null 로 두고, ★아래에서 ★따로 가른다. */
const pick = (re) => { const m = log.match(re); return m ? Number(m[1]) : null; };
const passed    = pick(/^\s*(\d+) passed/m);
const failed    = pick(/^\s*(\d+) failed/m);
const flaky     = pick(/^\s*(\d+) flaky/m);
const skipped   = pick(/^\s*(\d+) skipped/m);
const didNotRun = pick(/^\s*(\d+) did not run/m);
const interrupt = pick(/^\s*(\d+) interrupted/m);

if (passed === null && failed === null) {
  console.error('⛔요약(passed/failed)을 못 찾았다 — 러너가 끝까지 못 갔거나 꼴이 바뀌었다(통과 아님).');
  process.exit(3);
}
const n = (v) => (v === null ? 0 : v);
const verdicted = n(passed) + n(failed) + n(flaky) + n(skipped);
const missing = declared - verdicted;

console.log('── run-complete.gate ──');
console.log(`선언(Running)      : ${declared}  (워커 ${workers})`);
console.log(`판정 받은 수        : ${verdicted}  = passed ${n(passed)} + failed ${n(failed)} + flaky ${n(flaky)} + skipped ${n(skipped)}`);
console.log(`did not run        : ${didNotRun === null ? '(줄 없음 ⇒ 0)' : didNotRun}`);
console.log(`interrupted        : ${interrupt === null ? '(줄 없음 ⇒ 0)' : interrupt}`);
console.log(`선언 − 판정        : ${missing}`);

const bad = [];
if (n(didNotRun) !== 0) bad.push(`did not run = ${didNotRun} (0 이어야 한다)`);
if (n(interrupt) !== 0) bad.push(`interrupted = ${interrupt} (0 이어야 한다)`);
if (missing !== 0)      bad.push(`선언 ${declared} ≠ 판정 ${verdicted} — ★${missing}개가 판정을 못 받았다`);

if (bad.length) {
  console.error('\n⛔전수가 ★끝까지 돌지 않았다 — ★이 회차의 초록은 ★그만큼 ★«안 본 것»이다:');
  for (const b of bad) console.error(`   · ${b}`);
  console.error('\n★어느 것이 안 돌았나 — ★그 파일부터 보라(계측기가 빨개지면 그 뒤가 덮인다):');
  const files = [...log.matchAll(/^\s+-\s+(?:\d+\s+)?(\S+\.spec\.js):\d+:\d+/gm)]
    .map((m) => m[1]);
  const byFile = files.reduce((a, f) => (a[f] = (a[f] || 0) + 1, a), {});
  for (const [f, c] of Object.entries(byFile).sort((a, b) => b[1] - a[1])) console.error(`   ${String(c).padStart(4)}  ${f}`);
  console.error('\n⚠️위 명부는 ★「skipped ＋ did not run」을 ★같이 센다 — 러너가 ★둘을 ★같은 `-` 로 찍는다.');
  process.exit(1);
}
console.log('\n✅전수가 끝까지 돌았다(did not run 0 · 선언=판정). ⛔「빨강 없다」는 뜻이 ★아니다.');
process.exit(0);
