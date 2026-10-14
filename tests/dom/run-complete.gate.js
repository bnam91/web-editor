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
const path = require('path');

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
/* ★★★2026-10-14 더한 자 ② — ★★«명부 밖 빨강 0건»을 ★잰다.
   ★왜: 이 레포엔 ★«일부러 빨간 검사»가 산다(`test.fail(true, …)`) — ★「지금은 빨갛다」를 ★그냥 빨간 검사로
     두면 ★다음 빨강을 ★가리므로 ★표시해 둔 것이다. ⇒ ★★그래서 ★★«failed 0»은 ★영원히 ★안 온다.
   ⛔그런데 ★그 칸들은 ★`✘` 로 ★찍히면서 ★요약 `failed` 에는 ★★안 센다(예상대로 실패 = 통과로 집계).
     ⇒ ★★「✘ 줄 수」와 ★「요약 failed」가 ★다르다. ★261014 실측: ★✘ 18 ↔ ★failed 15 ↔ ★test.fail 3칸 — ★차가 ★정확히 3.
   ★그래서 ★재는 것: ★★✘ 줄의 ★이름이 ★★«명부»에 ★드나. ★★명부 밖이 ★1건이라도 있으면 ★빨강.
   ⛔★명부를 ★손으로 ★박지 않는다 — ★★`test.fail(` 줄에서 ★위로 올라가 ★가장 가까운 `test('…'`/`it('…'` 의
     ★이름을 ★뽑아 ★★«정의 자리»에서 ★파생한다(★「명부가 둘이면 파생시켜 하나로」).
   ★★그리고 ★이 자도 ★자기 전제를 ★단언한다 — ★명부가 ★0칸이면 ★«파서가 깨졌다»로 ★터진다(⛔0 을 «없다»로 안 읽는다). */
function deriveKnownReds(dir) {
  const names = new Set();
  let files = 0;
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.dom.spec.js'))) {
    let src;
    try { src = fs.readFileSync(path.join(dir, f), 'utf8'); } catch { continue; }
    if (!src.includes('test.fail(')) continue;
    files++;
    const lines = src.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (!/^\s*test\.fail\(/.test(lines[i])) continue;      // ⛔주석 속 test.fail 은 안 센다(들여쓰기 뒤 바로)
      for (let j = i; j >= 0; j--) {
        const m = lines[j].match(/^\s*(?:test|it)\(\s*(['"`])([\s\S]*?)\1/);
        if (m) { names.add(m[2].trim()); break; }
      }
    }
  }
  return { names, files };
}

/* ★★261014 — ★spec 폴더를 ★`--specs <dir>` 로 ★받을 수 있게 한다.
   ★까닭: ★이 파일을 ★레포 ★밖(예: /tmp)에 ★꺼내 돌리면 ★`__dirname` 이 ★거기를 가리켜
     ★★명부 0칸 · ★디스크 0벌이 된다(★rc 3 으로 ★터지긴 하지만 ★까닭이 ★안 보인다).
   ★다른 레인의 로그를 ★이 자로 재려는 쓰임이 ★실제로 났다(태양, 261014). */
const _si = process.argv.indexOf('--specs');
const SPEC_DIR = _si > 0 && process.argv[_si + 1] ? process.argv[_si + 1] : __dirname;
console.log(`spec 폴더           : ${SPEC_DIR}${SPEC_DIR === __dirname ? '  (기본 = 이 파일 옆)' : '  (--specs)'}`);
const { names: knownReds, files: knownFiles } = deriveKnownReds(SPEC_DIR);
const redLines = [...log.matchAll(/^\s+(?:✘|×)\s+\d*\s*(\S+\.spec\.js):\d+:\d+\s+›\s+(.*?)(?:\s+\([\d.]+m?s\))?\s*$/gm)]
  .map((m) => ({ file: m[1].split('/').pop(), name: m[2].trim() }));

console.log(`일부러 빨강 명부      : ${knownReds.size}칸 (${knownFiles}벌에서 파생 · 자 = test.fail())`);
for (const n of knownReds) console.log(`   · ${n.slice(0, 90)}`);
console.log(`로그의 ✘ 줄          : ${redLines.length}개`);

if (knownReds.size === 0) {
  console.error(`\n⛔명부가 0칸이다 — ★test.fail() 을 하나도 못 뽑았다(★본 폴더: ${SPEC_DIR}).`);
  console.error('   ⇒ ★이 파일을 ★레포 ★밖에서 돌렸다면 ★`--specs <레포>/tests/dom` 을 주어라.');
  console.error('   ⇒ ⛔「0칸」을 ★«일부러 빨강이 없다»로 ★읽지 마라. ★grep -c "test.fail(" 로 ★먼저 세라.');
  process.exit(3);
}

const outside = redLines.filter((r) => ![...knownReds].some((k) => r.name.startsWith(k.slice(0, 40))));
console.log(`★★명부 밖 빨강        : ${outside.length}개`);
for (const o of outside) console.log(`   ⛔ ${o.file} › ${o.name.slice(0, 95)}`);

/* ⛔★여기서 ★exit 하지 ★않는다 — ★★261014 실측: ★이 자가 ★먼저 터져서 ★아래 「전수인가」 자에
   ★★도달조차 ★못 했고, ★★그 수가 ★로그에 ★안 찍혔다(★손으로 다시 재야 했다).
   ⇒ ★★내 교훈 그대로: ★「계측기가 ★빨개지면 ★그 뒤가 ★덮인다」·「일부러 빨간 검사가 ★다음 빨강을 가린다」.
   ⇒ ★★모든 자를 ★다 재고 ★★마지막에 ★한 번 ★판정한다. */
const verdicts = [];
if (outside.length) {
  console.error(`\n⛔★★명부 ★밖 빨강이 ★${outside.length}건 있다 — ★★「제품결함 0」을 ★적을 수 ★없다.`);
  console.error('   ★적을 말: ★★«아직 못 가렸다». ⛔「참 빨강」·「경합」·「검사 설계」 ★라벨 금지 — ★먼저 ★load<15 에서 ★같은 sha ×2.');
  verdicts.push(`명부 밖 빨강 ${outside.length}건`);
} else {
  console.log('\n✅★★명부 밖 빨강 0건 — ★✘ 전부가 ★«일부러 빨강»이다.');
}

/* ★★★2026-10-14 더한 자 — ★«전수인가»를 ★잰다.
   ★왜: 위까지는 ★「선언 = 판정」만 재므로 ★★«선언 자체가 ★작아도» ★✅ 가 찍힌다.
     ⇒ 실제로 ★내가 ★「전수 177/177 초록」을 ★여러 번 적었고, ★참 전수는 ★440벌이었다(4.6%).
     ⇒ ★★«끝까지 돌았다»와 ★«전부를 돌았다»는 ★다른 물음이다. ★이 자가 ★뒤쪽을 잰다.
   ★어떻게: ★로그에 찍힌 ★spec 파일 이름의 ★유일 수 ↔ ★디스크의 ★spec 파일 수.
     ⛔숫자를 ★손으로 박지 않는다(EXPECT_N 이 묵은 그 병) — ★디스크가 ★참 명부고, ★여기서 ★파생한다.
   ★모드: ★기본은 ★찍기만 하고 ★SKIP(묶음 QA 도 ★정당한 쓰임이다 — ★범위 밖은 FAIL 아니라 SKIP).
     ★`--full` 을 ★주면 ★★«전수 주장»이 되고, ★모자라면 ★빨개진다. */
const claimFull = process.argv.includes('--full');

const specsInLog = new Set(
  [...log.matchAll(/(?:^|\s)((?:[\w./-]*\/)?[\w.-]+\.spec\.js):\d+:\d+/gm)].map((m) => m[1].split('/').pop())
);
let specsOnDisk = null;
try {
  specsOnDisk = fs.readdirSync(SPEC_DIR).filter((f) => f.endsWith('.dom.spec.js')).length;
} catch { /* 못 세면 null — ⛔0 으로 접지 않는다 */ }

console.log(`로그에 나온 spec   : ${specsInLog.size}벌`);
console.log(`디스크의 spec      : ${specsOnDisk === null ? '★못 셌다' : specsOnDisk + '벌'}`);

/* ★★⛔261014 ★고침 — ★여기 ★`process.exit(0)` 이 ★있었다.
   ★증상: ★`--full` 이 ★없으면 ★★«명부 밖 빨강»을 ★★찍고도 ★rc ★0 으로 ★끝났다.
     ⇒ ★★내가 세운 규율 ★「⛔를 ★찍으며 ★rc 0 — ★자는 ★마지막이 ★exit」을 ★★이 코드가 ★범했다.
     ⇒ ★★부분 런 rc 를 ★믿는 ★모든 자리가 ★이 구멍을 ★지났다(태양 S7 ⒞ 로그가 ★그 꼴).
   ★고침: ★`--full` 이 ★없어도 ★★판정을 ★건너뛰지 ★않는다 —
     ★★«전수인가»만 ★안 재고, ★★«명부 밖 0건»은 ★★그대로 ★잰다. */
if (!claimFull) {
  console.log('\n✅끝까지 돌았다(did not run 0 · 선언=판정).');
  console.log('⏭️★«전수인가»는 ★안 쟀다 — ★이 회차는 ★«전수 주장»이 ★아니다(--full 을 주면 잰다).');
  console.log('⛔「빨강 없다」는 뜻이 ★아니다 — ★failed 수는 ★따로 보라.');
  if (verdicts.length) {
    console.error(`\n⛔★★이 회차는 ★통과가 ★아니다 — ★${verdicts.length}가지: ${verdicts.join(' · ')}`);
    process.exit(1);
  }
  console.log('\n✅★명부 밖 빨강 0건(⏭️전수인가는 안 쟀다).');
  process.exit(0);
}
if (specsOnDisk === null) {
  console.error('\n⛔디스크의 spec 수를 ★못 셌다 — ★`--full` 주장을 ★못 잰다(통과 아님).');
  process.exit(3);
}
if (specsInLog.size !== specsOnDisk) {
  console.error(`\n⛔★«전수»가 ★아니다 — ★로그 ${specsInLog.size}벌 ↔ ★디스크 ${specsOnDisk}벌 (★${specsOnDisk - specsInLog.size}벌이 ★로그에 없다).`);
  console.error('   ⇒ ★이 회차의 초록은 ★«돌린 만큼»의 초록이다. ★보고에 ★«분모 ＋ sha»를 ★한 쌍으로 적어라.');
  verdicts.push(`전수 아님(로그 ${specsInLog.size} ↔ 디스크 ${specsOnDisk})`);
} else {
  console.log(`\n✅끝까지 돌았다(did not run 0 · 선언=판정) ★그리고 ★★«전수»다(${specsOnDisk}벌 전부가 로그에 있다).`);
}
console.log('⛔「빨강 없다」는 뜻이 ★아니다 — ★failed 수는 ★따로 보라.');

/* ★★마지막에 ★한 번 ★판정 — ⛔「⛔를 찍으며 rc 0」을 막는다 */
if (verdicts.length) {
  console.error(`\n⛔★★이 회차는 ★통과가 ★아니다 — ★${verdicts.length}가지: ${verdicts.join(' · ')}`);
  process.exit(1);
}
console.log('\n✅★이 회차의 ★자 전부 통과(완주 ＋ 전수 ＋ 명부 밖 0건).');
process.exit(0);
