#!/usr/bin/env node
/* unit-time.gate.js — ★196 ⑴ 유닛 «파일별 시간» 래칫 (S3 · 261028 · 지디 08:1x)
 *
 * ★왜: npm test 엔 시간 제한이 «없다»(run-unit.mjs 가 --test-timeout 을 안 넘김 · 196 ⒜ 실측). 손으로 준 --test-timeout 도
 *   동기 몸(spawnSync·바쁜 대기)에는 안 든다(마감 뒤 타이머로 돌아갈 때만 집행). ⛔N 을 «지금 최대» 로 박으면 항등식(늘 통과).
 *   ⇒ ★느린 유닛 파일 «명부»(이름 → ms)를 두고, 회차 출력(JUnit)에서 파일별 합을 내 «명부보다 느려지면» 빨강 · 명부는 줄어드는 쪽으로만.
 * ★쓰는 법(유닛 전수와 같은 명령 묶음):
 *   GOYA_TEST_JUNIT=/tmp/u.xml npm test; node tests/unit-time.gate.js /tmp/u.xml
 *   rc 0 통과 · 1 느려짐(명부 안 파일이 ms×(1+tol) 넘음 · 명부 밖 파일이 floor 넘음) · 2 쓰는 법 · 3 못 잰다(명부·XML 없음/꼴 깨짐 — 통과 아님)
 * ★명부 = tests/unit/UNIT_SLOW.json { meta:{ sha, workers, load, free, swap }, tol, floor_ms, files:{ "tests/unit/x.test.mjs": ms } }
 *   ⛔이 파일에 수를 손으로 두지 않는다 — tol·floor·ms 는 다 명부에서(무거운 슬롯 전수 실측으로 처음 세움 · 머리에 판·부하).
 * ⛔이 자가 안 재는 것: 시험 «하나»의 시간(파일 합만) · 부하 보정(meta 와 견주는 건 사람 몫) · 빨라진 파일(줄이라는 «알림» 줄만 · rc 안 바꿈).
 */
'use strict';
const fs = require('fs');
const path = require('path');

/** JUnit XML → Map(파일(posix · 저장소 기준) → ms) — testcase file·time 합 */
function fileTimes(xml, root) {
  const out = new Map();
  let n = 0;
  for (const m of String(xml).matchAll(/<testcase\b([^>]*)>/g)) {
    const a = m[1];
    const t = /\btime="([\d.]+)"/.exec(a), f = /\bfile="([^"]+)"/.exec(a);
    if (!t || !f) continue;
    n++;
    const rel = path.relative(root, f[1]).split(path.sep).join('/');
    out.set(rel, (out.get(rel) || 0) + Number(t[1]) * 1000);
  }
  return { n, out };
}

/** 판정 — { ok, why?, slower[], newSlow[], faster[] } */
function judge(xml, roster, root) {
  if (!roster || typeof roster !== 'object' || !roster.files || !(roster.tol >= 0) || !(roster.floor_ms > 0)) return { ok: false, why: '명부 꼴이 아니다(files · tol · floor_ms)' };
  const { n, out } = fileTimes(xml, root);
  if (n === 0) return { ok: false, why: 'JUnit testcase(file·time) 를 하나도 못 읽었다' };
  const slower = [], newSlow = [], faster = [];
  for (const [f, ms] of out) {
    const base = roster.files[f];
    if (base !== undefined) {
      if (ms > base * (1 + roster.tol)) slower.push(`${f} ${Math.round(base)} → ${Math.round(ms)}ms`);
      else if (ms < base * (1 - roster.tol)) faster.push(`${f} ${Math.round(base)} → ${Math.round(ms)}ms`);
    } else if (ms > roster.floor_ms) newSlow.push(`${f} ${Math.round(ms)}ms (floor ${roster.floor_ms})`);
  }
  return { ok: true, files: out.size, cases: n, slower, newSlow, faster };
}

module.exports = { fileTimes, judge };

if (require.main === module) {
  const xmlPath = process.argv[2];
  if (!xmlPath) { console.error('⛔쓰는 법: node tests/unit-time.gate.js <junit.xml> [명부.json]'); process.exit(2); }
  const rosterPath = process.argv[3] || path.join(__dirname, 'unit', 'UNIT_SLOW.json');
  if (!fs.existsSync(xmlPath)) { console.error(`⛔JUnit 이 없다: ${xmlPath} — 못 잰다(통과 아님)`); process.exit(3); }
  if (!fs.existsSync(rosterPath)) { console.error(`⛔명부가 없다: ${rosterPath} — 못 잰다(통과 아님 · 무거운 슬롯 전수로 처음 세운다)`); process.exit(3); }
  const v = judge(fs.readFileSync(xmlPath, 'utf8'), JSON.parse(fs.readFileSync(rosterPath, 'utf8')), path.join(__dirname, '..'));
  if (!v.ok) { console.error(`⛔${v.why} — 못 잰다(통과 아님)`); process.exit(3); }
  console.log(`── unit-time.gate ── 파일 ${v.files} · testcase ${v.cases} · 느려짐 ${v.slower.length} · 명부 밖 느림 ${v.newSlow.length} · 빨라짐 ${v.faster.length}`);
  for (const f of v.faster) console.log(`   ↓ ${f} — 명부를 줄여라(줄어드는 쪽으로만)`);
  if (v.slower.length || v.newSlow.length) {
    console.error('⛔유닛 파일이 느려졌다:');
    for (const s of [...v.slower, ...v.newSlow]) console.error(`   · ${s}`);
    process.exit(1);
  }
}
