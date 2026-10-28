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
 * ★흔들림 기준값(지디 판정 261028 «기준값이 버전관리 밖이면 한 세션용» ⇒ 여기와 명부 meta.noise 에 박는다):
 *   같은 맥(인텔) · 같은 판 계열 두 전수(5c5b94f5 · e5e677f0) · 파일 합 >0.5s 61 벌의 둘째/첫째 비 = 중앙 1.00 · 10% 0.93 · 90% 1.68 · 최대 1.80 ·
 *   파일 합 542 → 577s · load(입구) 1.70 → 2.26 ⇒ tol 0.5 는 열에 하나를 흔들림으로 빨갛게 했다(edge-contrast 2830→4848 · frame-bg-edit-wiring 2236→3823 · 코드 무변)
 *   ⇒ tol 1.0(⑴) · floor 2000 그대로(⑵ — 명부를 줄이면 2~5s 의 참 느려짐을 못 잡음) · ★⑶ «연속 두 회차 모두 넘으면 빨강»(명부 last_over · --record).
 *   쌍(실 JUnit 두 벌 · tol 0.5 사본 명부): run1 기록 rc 0 → run2 기록(이번만 2 · 지켜봄) rc 0 → run2 다시(연속 두 회차 2) rc 1.
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

/** 판정 — { ok, why?, slower[], newSlow[], faster[], over[](이 회차 넘은 파일), red[](★연속 두 회차), once[](이번만) }
 *  ★196 ⑶(지디 판정 261028) — «연속 두 회차 모두 넘으면 빨강»: 명부의 last_over(지난 기록 회차에 넘은 파일)와 이번 넘음의 교집합만 빨강.
 *  흔들림은 한 회차만 넘고(실측 61 벌 중 최대 1.80 배 · 머리말) · 참 느려짐은 두 회차 다 넘는다. */
function judge(xml, roster, root) {
  if (!roster || typeof roster !== 'object' || !roster.files || !(roster.tol >= 0) || !(roster.floor_ms > 0)) return { ok: false, why: '명부 꼴이 아니다(files · tol · floor_ms)' };
  const { n, out } = fileTimes(xml, root);
  if (n === 0) return { ok: false, why: 'JUnit testcase(file·time) 를 하나도 못 읽었다' };
  const slower = [], newSlow = [], faster = [], over = [];
  for (const [f, ms] of out) {
    const base = roster.files[f];
    if (base !== undefined) {
      if (ms > base * (1 + roster.tol)) { slower.push(`${f} ${Math.round(base)} → ${Math.round(ms)}ms`); over.push(f); }
      else if (ms < base * (1 - roster.tol)) faster.push(`${f} ${Math.round(base)} → ${Math.round(ms)}ms`);
    } else if (ms > roster.floor_ms) { newSlow.push(`${f} ${Math.round(ms)}ms (floor ${roster.floor_ms})`); over.push(f); }
  }
  const last = new Set(Array.isArray(roster.last_over) ? roster.last_over : []);
  const red = over.filter((f) => last.has(f)).sort(), once = over.filter((f) => !last.has(f)).sort();
  return { ok: true, files: out.size, cases: n, slower, newSlow, faster, over: over.sort(), red, once };
}

/** ★196 ⑷ ⒞(지디 13:2x) — 명부의 «낡음» 한 줄. meta.sha 앞 16진 낱말을 판으로 읽고 git 으로 HEAD 와 견준다.
 *  git(args) → { status, stdout } 주입(검사는 가짜 · 실행은 spawnSync git). ⛔rc 를 바꾸지 않는다 — 말만 한다(rc 3 여부는 ⑸ 부르는 자 정해진 뒤).
 *  @returns {{ state: 'ancestor'|'diverged'|'absent'|'unreadable', sha: string|null, behind: number|null, line: string }} */
function staleness(meta, git) {
  const m = /^([0-9a-f]{7,40})\b/.exec(String((meta && meta.sha) || ''));
  if (!m) return { state: 'unreadable', sha: null, behind: null, line: '명부 meta.sha 를 판으로 못 읽는다 — 이 명부가 얼마나 낡았는지 모른다' };
  const sha = m[1];
  if (git(['cat-file', '-e', `${sha}^{commit}`]).status !== 0) return { state: 'absent', sha, behind: null, line: `명부 기준판 ${sha} 가 이 나무에 없다 — 낡음을 못 잰다` };
  if (git(['merge-base', '--is-ancestor', sha, 'HEAD']).status !== 0) return { state: 'diverged', sha, behind: null, line: `명부 기준판 ${sha} 는 HEAD 조상 아님(다른 줄기) — 이 판의 기준값이 아니다` };
  const r = git(['rev-list', '--count', `${sha}..HEAD`]);
  const n = r.status === 0 ? Number(String(r.stdout).trim()) : NaN;
  return { state: 'ancestor', sha, behind: Number.isInteger(n) ? n : null, line: `명부 기준판 ${sha} = HEAD 조상 · ${Number.isInteger(n) ? n : '?'} 커밋 뒤` };
}

module.exports = { fileTimes, judge, staleness };

if (require.main === module) {
  const args = process.argv.slice(2);
  const record = args.includes('--record');
  const [xmlPath, rosterArg] = args.filter((a) => a !== '--record');
  if (!xmlPath) { console.error('⛔쓰는 법: node tests/unit-time.gate.js <junit.xml> [명부.json] [--record]'); process.exit(2); }
  const rosterPath = rosterArg || path.join(__dirname, 'unit', 'UNIT_SLOW.json');
  if (!fs.existsSync(xmlPath)) { console.error(`⛔JUnit 이 없다: ${xmlPath} — 못 잰다(통과 아님)`); process.exit(3); }
  if (!fs.existsSync(rosterPath)) { console.error(`⛔명부가 없다: ${rosterPath} — 못 잰다(통과 아님 · 무거운 슬롯 전수로 처음 세운다)`); process.exit(3); }
  const roster = JSON.parse(fs.readFileSync(rosterPath, 'utf8'));
  { const { spawnSync } = require('child_process');
    const git = (args) => { const r = spawnSync('git', args, { cwd: path.join(__dirname, '..'), encoding: 'utf8' }); return { status: r.status, stdout: r.stdout || '' }; };
    console.log(`── unit-time.gate ── 명부 낡음: ${staleness(roster.meta, git).line}`); }   // ★⑷ ⒞ 자의 한계는 자가 말한다 · rc 무관
  const v = judge(fs.readFileSync(xmlPath, 'utf8'), roster, path.join(__dirname, '..'));
  if (!v.ok) { console.error(`⛔${v.why} — 못 잰다(통과 아님)`); process.exit(3); }
  console.log(`── unit-time.gate ── 파일 ${v.files} · testcase ${v.cases} · 넘음 ${v.over.length}(연속 두 회차 ${v.red.length} · 이번만 ${v.once.length}) · 빨라짐 ${v.faster.length} · 지난 넘음 ${(roster.last_over || []).length}`);
  for (const f of v.faster) console.log(`   ↓ ${f} — 명부를 줄여라(줄어드는 쪽으로만)`);
  for (const f of v.once) console.log(`   ⚠ 이번만 넘음(지켜봄 · 다음 기록 회차에도 넘으면 빨강): ${f}`);
  /* --record: 판정 전수에서만 — 이번 넘음을 명부 last_over 로 남긴다(다음 회차의 «지난»). 그 명부 변경을 회차 증거와 함께 커밋한다. */
  if (record) { roster.last_over = v.over; fs.writeFileSync(rosterPath, JSON.stringify(roster, null, 1) + '\n'); console.log(`   ✎ last_over 기록 ${v.over.length}`); }
  if (v.red.length) {
    console.error('⛔유닛 파일이 «연속 두 회차» 느려졌다:');
    for (const s of [...v.slower, ...v.newSlow].filter((x) => v.red.some((f) => x.startsWith(f + ' ')))) console.error(`   · ${s}`);
    process.exit(1);
  }
}
