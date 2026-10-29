#!/usr/bin/env node
/* flaky-roster.gate.js — 「흔들린 spec 이 ★FLAKY.md 에 이름으로 올라 있나」를 ★그 회차의 ★출력에서 ★파생해 잰다.
 *   ★209 FLAKY-ROSTER-NEVER-FED-BY-ITS-OWN-RULE-01 (S3 · 261028 · 지디 ⑰⒠ 넷째 묶음)
 *
 * ★왜 이 자가 생겼나
 *   tests/dom/FLAKY.md 는 «flaky 가 0 이 아니면 ★그 이름을 이 명부에 올려라»(2026-10-13 retries 0 → 1 절 ⒝)라고 적었지만
 *   ★그 뒤 흔들림 0/7 이 안 올라갔다 — ★규칙은 있는데 ★재는 자가 없었다(doc-only · run-complete.gate.js 가 막은 EXPECT_N 과 같은 병).
 *   ⛔«손으로 올려라» 를 또 적지 않는다 — ★출력을 읽어 «명부에 없는 이름»이 찍히면 ★빨강으로 막는다.
 *
 * ★쓰는 법(전수와 ★같은 명령 묶음에서 · run-complete.gate.js 옆)
 *   npx playwright test --config=tests/dom/playwright.dom.config.js > run.log 2>&1
 *   node tests/dom/run-complete.gate.js run.log && node tests/dom/flaky-roster.gate.js run.log
 *   rc 0 = flaky 로 찍힌 spec 이 전부 FLAKY.md 에 이름으로 있다(또는 flaky 0) · rc 1 = 명부에 없는 이름 · rc 2 = 쓰는 법 · rc 3 = 못 잰다(통과 아님)
 *
 * ★★이 자가 ★재는 것 — flaky 블럭의 ★spec 파일 이름 ⊆ FLAKY.md 에 적힌 spec 파일 이름.
 * ★같은 이름을 쓰는 «다른 자» 와 갈라 적는다(지디 261029 14:5x ⒜ · ⛔합치지 마라 — 분모가 다르다):
 *   이 자(레포 안 · tests/dom/flaky-roster.gate.js · 209)  = «전수 로그의 N flaky 블럭(retries 뒤 통과) ↔ FLAKY.md 명부» 견줌
 *   지디 자(레포 밖 · ~/.claude/skills/지디/tools/flaky-roster-gate.py) = «FLAKY.md 명부 ↔ 지디가 발주한 건» 견줌
 * ⛔이 자가 ★안 재는 것: 「그 흔들림이 참 빨강인가」(FLAKY.md ⒞ — 사람 몫) · failed(run-complete.gate.js·137 몫) ·
 *   명부의 «원인 라벨» 유무 · 칸(시험) 단위 — ★spec 파일 단위로 잰다(지디 «이름 없는 spec»).
 * ★못 찾았다를 0 으로 접지 않는다: 「Running N tests」 머리줄이 없으면 rc 3. flaky 요약 줄이 «없으면» flaky 0(Playwright 는 0 이면 안 찍는다).
 *   요약 수 N 과 블럭에서 뽑은 줄 수가 다르면 rc 3(꼴이 바뀌었다).
 */
'use strict';
const fs = require('fs');
const path = require('path');

const SPEC_RE = () => /([\w.-]+\.dom\.spec\.js)/g;

/** 로그 → { ok, why?, declared, flakyN, lines[], specs[] } — ok=false 면 «못 잰다» */
function readFlaky(log) {
  const mRun = log.match(/^Running (\d+) tests? using (\d+) workers?/m);
  if (!mRun) return { ok: false, why: '「Running N tests」 머리줄을 못 찾았다' };
  const head = log.match(/^( *)(\d+) flaky\s*$/m);
  if (!head) return { ok: true, declared: Number(mRun[1]), flakyN: 0, lines: [], specs: [] };
  const flakyN = Number(head[2]);
  const after = log.slice(head.index + head[0].length).split('\n').slice(1);
  const lines = [];
  for (const l of after) {
    const m = /^\s+(?:\[[^\]]+\]\s+›\s+)?(?:tests\/dom\/)?([\w.-]+\.dom\.spec\.js):\d+:\d+/.exec(l);
    if (!m) break;
    lines.push({ spec: m[1], line: l.trim() });
  }
  if (lines.length !== flakyN) return { ok: false, why: `flaky 요약 ${flakyN} ≠ 블럭에서 뽑은 줄 ${lines.length} — 꼴이 바뀌었다` };
  return { ok: true, declared: Number(mRun[1]), flakyN, lines, specs: [...new Set(lines.map((x) => x.spec))].sort() };
}

/** FLAKY.md 본문 → 그 안에 «이름으로» 적힌 spec 파일 이름 집합 */
function rosterSpecs(md) {
  return new Set([...measureOnlyCut(md).matchAll(SPEC_RE())].map((m) => m[1]));
}
/** ★«## ⛔측정 가지 전용» 절(그 머리줄부터 다음 «## » 머리줄 앞까지)을 뗀 본문 — 그 절의 이름은 레포 바닥에 없어 명부로 안 센다(지디 261029 14:5x ⒞) */
function measureOnlyCut(md) {
  const L = String(md).split('\n'); let skip = false; const out = [];
  for (const l of L) {
    if (/^## /.test(l)) skip = /^## ⛔측정 가지 전용/.test(l);
    if (!skip) out.push(l);
  }
  return out.join('\n');
}

/** 판정 — 명부에 없는 spec 이름 목록 */
function unlisted(log, md) {
  const r = readFlaky(log);
  if (!r.ok) return { ok: false, why: r.why };
  const roster = rosterSpecs(md);
  return { ok: true, flakyN: r.flakyN, specs: r.specs, missing: r.specs.filter((s) => !roster.has(s)), lines: r.lines, rosterN: roster.size };
}

module.exports = { readFlaky, rosterSpecs, unlisted, measureOnlyCut };

if (require.main === module) {
  const file = process.argv[2];
  if (!file) { console.error('⛔쓰는 법: node tests/dom/flaky-roster.gate.js <전수 로그> [FLAKY.md]'); process.exit(2); }
  if (!fs.existsSync(file)) { console.error(`⛔로그가 없다: ${file}`); process.exit(2); }
  const mdPath = process.argv[3] || path.join(__dirname, 'FLAKY.md');
  if (!fs.existsSync(mdPath)) { console.error(`⛔명부가 없다: ${mdPath} — 못 잰다(통과 아님)`); process.exit(3); }
  const v = unlisted(fs.readFileSync(file, 'utf8'), fs.readFileSync(mdPath, 'utf8'));
  if (!v.ok) { console.error(`⛔${v.why} — 이 로그로는 ★못 잰다(통과 아님).`); process.exit(3); }
  console.log('── flaky-roster.gate ──');
  console.log(`flaky 요약 ${v.flakyN} · spec ${v.specs.length} · 명부(FLAKY.md) spec 이름 ${v.rosterN} · 명부에 없음 ${v.missing.length}`);
  if (v.missing.length) {
    console.error('\n⛔흔들린 spec 이 ★FLAKY.md 에 ★이름으로 없다 — 이름 ＋ 수로 올려라(⛔원인 라벨 없이 · FLAKY.md ⒝):');
    for (const s of v.missing) for (const l of v.lines.filter((x) => x.spec === s)) console.error(`   · ${l.line}`);
    process.exit(1);
  }
  console.log('✔ flaky 로 찍힌 spec 이 전부 명부에 있다' + (v.flakyN === 0 ? ' (flaky 0)' : ''));
}
