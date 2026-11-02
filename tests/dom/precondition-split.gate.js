#!/usr/bin/env node
/* precondition-split.gate.js — 전수 로그의 빨강을 ★«전제 실패(판 정체)» 와 ★«그 밖(결함 후보)» 으로 ★갈라 센다.
 *
 * ★왜 이 자가 생겼나 (293 PRECONDITION-FAILURES-COUNTED-AS-DEFECTS-01 · 2026-10-29)
 *   Intel 판 ★«늘 빨강 89» 중 ★42 가 ★«판 정체: EXPECT_SHA env 가 풀 sha 40자» 류였다(네 런 같은 수 · S7 n89pj.pl).
 *   env 를 넣으면 ★t4-01 14/14 초록(S6) ⇒ ★안 돈 것이었는데, ★여럿이 ★89 를 ★«결함 명부»로 썼다.
 *   ⇒ ★빨강 수를 ★판정에 쓰기 전에 ★«전제가 안 선 것» 을 ★먼저 떼어 낸다.
 *
 * ★쓰는 법 (run-complete.gate.js 옆 · ★같은 로그)
 *   npx playwright test --config=tests/dom/playwright.dom.config.js > run.log 2>&1
 *   node tests/dom/run-complete.gate.js run.log
 *   node tests/dom/precondition-split.gate.js run.log       # 표 + 이름 · rc 아래
 *   node tests/dom/precondition-split.gate.js --self-test   # 자가 산다(양성·음성)
 *   node tests/dom/precondition-split.gate.js --roster run.log          # 회신 꼴 «파일:줄 › 칸 이름 ⇥ 갈래 ⇥ 메시지(원문)» 만 찍는다
 *   node tests/dom/precondition-split.gate.js --check-roster 명부.tsv   # 빨강 명부를 받는 자리 — 갈래 칸이 비면 rc 1(⛔갈래별로만 수를 쓴다)
 *
 * ★★이 자가 ★재는 것 — 실패 블록(«  N) tests/dom/<파일>:<줄>:<열> › <제목>») 마다 ★시도(첫 시도 · Retry #k)별 ★첫 «…Error:» 글(Error · TimeoutError 등).
 *   ★갈래(261101 «단독 빨강 6» 이 참 단언 실패 1 이었다): ⒜ 하네스(첫 시도가 시험 시간 예산을 다 씀 · page.goto) · ⒝ 전제(판 정체 = «전제 실패» · 장면 전제) · ⒞ 단언(expect) · ⒟ 알 수 없음(그 밖 throw · TimeoutError 등).
 *   ★블록이 failed 인지 flaky 인지는 ★요약의 이름 목록(«N failed» · «N flaky» 아래)에서 읽는다.
 * ★rc  0 = 갈랐다(전제 실패가 몇이든) · 3 = ★못 쟀다(블록 수 ≠ failed+flaky · 요약 없음 · 첫 Error 없는 블록) · 2 = 쓰는 법
 *   ⛔«못 찾았다» 를 ★0 으로 접지 않는다(run-complete.gate.js 와 같은 규약).
 * ★★⛔이 자가 ★안 재는 것:
 *   ⛔⒞·⒟ 가 ★제품 결함인가 — ★하네스·부하·검사 설계일 수 있다(★라벨을 붙이지 않는다). ⛔⒜ 도 제품 결론으로 바꾸지 마라.
 *   ⛔PRECOND 밖의 ★전제 글(예 «[전제] …» 장면 전제) — ★따로 «장면 전제» 칸으로만 찍고 ★전제 실패 수에 ★안 넣는다.
 *   ⛔skipped — 전제가 ★env 없음으로 ★건너뛴 칸(169)은 ★빨강이 아니라 ★이 자 밖이다.
 *   ⛔로그 꼴이 바뀌면(reporter) ★못 쟀다로 터진다 — ★이 자는 ★list/line reporter 의 끝 요약 꼴만 안다.
 */
'use strict';
const fs = require('fs');

/* ★전제 실패 = ★판 정체 가족. 머리말이 ★셋 꼴로 쓰인다(소스 실측 · tests/dom/_cr-harness.js · w2d06-sticker-paste-clamp 등):
     «판 정체: …» · «P0 판 정체: …» · «판 정체 ⑴: …»/«P0 판 정체 ⑵a: …» */
const PRECOND = /^(?:P0\s+)?판 정체(?:\s*[⑴-⑽][a-z]?)?\s*:|^장면 미성립\s*[:—]\s*(?:판 정체|.*EXPECT_SHA|ROOT HEAD|서빙 .*sha1)/;
/*   ＋ «장면 미성립: …» 머리 중 ★판 정체 낱말이 든 것(소스 실측 넷 · 293 머지 전 지디 물음):
     t4-16-mix-font-bulk:213 «장면 미성립: 판 정체: EXPECT_SHA 가 풀 sha 40자» · w2d08-text-edit-checkpoint:167 «장면 미성립: EXPECT_SHA 없음»
     · :178 «장면 미성립: ROOT HEAD === EXPECT_SHA» · :179 «장면 미성립: 서빙 <f> sha1 === git <sha>:<f>»
     ⛔그 밖 «장면 미성립: …»(범례가 안 꺼졌다 등 장면 전제)은 ★전제 실패가 아니라 ★«장면 전제» 칸으로만 찍는다. */
/* ★이름 채널(지디 293 보탬) — 판 정체 «검사»는 ★제목이 «P0 판 정체 — …»·«B0 판 정체 — …» 꼴이다(소스 실측 다섯:
     inspector-assetclear:117 · inspector-row-ctx:132 · paste-dest-style-lock:303 · radial-t4-b-canvas-edit:234 · w2d08-text-edit-checkpoint:164).
   ★그 검사가 ★맨 expect 로 빨개지면(사용자 글 없음) ★글 채널은 ★못 본다 ⇒ ★제목 마디 머리도 본다. */
const PRECOND_TITLE = /(?:^|›\s*)(?:[A-Z]{1,2}\d*\s+)?판 정체(?=\s*(?:—|:|[⑴-⑽]|$))/;
const SCENE = /^\[전제\]|^장면 미성립\s*[:—]|^★*전제/;   // 장면 전제 — 따로 찍기만(판 정체 낱말 든 것은 위 PRECOND 가 먼저 가져간다) · «전제 — …»·«전제: …» 는 expect 메시지 꼴(소스 ≥1700 줄)
const HARNESS = /Test timeout of \d+ms exceeded|^page\.goto:/;   // 시험 예산을 다 썼다 · 페이지가 안 떴다 ⇒ 값이 안 났다
const BRANCH = { '하네스 실패': '⒜하네스', '전제 실패': '⒝전제', '장면 전제': '⒝전제', '단언 실패': '⒞단언', '알 수 없음': '⒟알 수 없음' };

const stripAnsi = (s) => s.replace(/\x1b\[[0-9;]*[A-Za-z]/g, '').replace(/\r/g, '\n');
const HEAD = /^\s+\d+\)\s+(tests\/dom\/\S+?:\d+:\d+)\s+›\s+(.*)$/;

function split(text) {
  const lines = stripAnsi(text).split('\n');
  const iSum = lines.findIndex((l) => /^\s+\d+ failed\s*$/.test(l));
  const iFlaky = lines.findIndex((l) => /^\s+\d+ flaky\s*$/.test(l));
  const nFailed = iSum < 0 ? 0 : Number(lines[iSum].trim().split(' ')[0]);
  const nFlaky = iFlaky < 0 ? 0 : Number(lines[iFlaky].trim().split(' ')[0]);
  const keysUnder = (i, n) => (i < 0 ? [] : lines.slice(i + 1, i + 1 + n).map((l) => (l.match(/(tests\/dom\/\S+?:\d+:\d+)/) || [])[1]));
  const failedKeys = new Set(keysUnder(iSum, nFailed));
  const flakyKeys = new Set(keysUnder(iFlaky, nFlaky));
  const end = [iSum, iFlaky].filter((i) => i >= 0).reduce((a, b) => Math.min(a, b), lines.length);
  const blocks = [];
  let cur = null;
  for (let i = 0; i < end; i++) {
    const l = lines[i];
    const h = l.match(HEAD);
    if (h) { cur = { key: h[1], title: h[2].replace(/\s*[─�].*$/, '').trim(), tries: [null] }; blocks.push(cur); continue; }
    if (!cur) continue;
    if (/^\s+Retry #\d+/.test(l)) { cur.tries.push(null); continue; }
    const e = l.match(/^\s+(?:\w*Error):\s*(.*)$/);   // Error: · TimeoutError: 등 — 첫 «…Error:» 줄
    if (e && cur.tries[cur.tries.length - 1] === null) cur.tries[cur.tries.length - 1] = e[1].trim();
    if (cur.tries.length === 1 && /^\s+(?:Error:\s*)?expect\(/.test(l)) cur.asserted = true;   // 코드 틀 줄(«> 60 |»)은 안 걸린다
    const t = l.match(/^\s+(Test timeout of \d+ms exceeded.*)$/);   // Error 줄 없이 이것만 찍히는 블록이 있다(이벤트만 기다리다 끝남)
    if (t && cur.tries.length === 1) cur.bare = t[1];
  }
  for (const b of blocks) {
    const first = b.tries[0] ?? b.bare ?? null;
    b.msg = first;
    b.kind = failedKeys.has(b.key) ? 'failed' : flakyKeys.has(b.key) ? 'flaky' : '요약에 없음';
    const byMsg = first != null && PRECOND.test(first), byName = PRECOND_TITLE.test(b.title);
    b.via = byMsg && byName ? '글·이름' : byMsg ? '글' : byName ? '이름' : '';
    b.cls = byMsg || byName ? '전제 실패' : first == null ? '첫 Error 없음' : SCENE.test(first) ? '장면 전제' : HARNESS.test(first) ? '하네스 실패' : b.asserted ? '단언 실패' : '알 수 없음';
    b.agree = b.tries.filter((t) => t != null).every((t) => PRECOND.test(t) === PRECOND.test(first || ''));
  }
  return { blocks, nFailed, nFlaky, found: iSum >= 0 || iFlaky >= 0 };
}

function report(r) {
  const out = [];
  const tab = {};
  for (const b of r.blocks) { tab[b.cls] = tab[b.cls] || { failed: 0, flaky: 0, '요약에 없음': 0 }; tab[b.cls][b.kind]++; }
  out.push(`블록 ${r.blocks.length} · 요약 failed ${r.nFailed} + flaky ${r.nFlaky} = ${r.nFailed + r.nFlaky}`);
  out.push('| 갈래 | failed | flaky |');
  for (const c of Object.keys(tab).sort()) out.push(`| ${c} | ${tab[c].failed} | ${tab[c].flaky} |`);
  for (const b of r.blocks.filter((x) => x.cls !== '단언 실패')) out.push(`${b.cls}${b.via ? `(${b.via})` : ''}\t${b.kind}\t${b.key} › ${b.title}\t«${b.msg}»${b.agree ? '' : '\t⚠️재시도 갈래 다름'}`);
  return out.join('\n');
}

/* 회신 꼴 한 줄 — notes/CHECK-before-you-order.md «빨강 명부를 받을 때» 와 같은 칸 */
const rosterLines = (r) => r.blocks.map((b) => `${b.key} › ${b.title}\t${BRANCH[b.cls] || ''}\t${b.msg ?? ''}`);
/** 받은 명부 글자 → rc 0 칸 다 있음 · 1 갈래 빈 줄 있음 · 3 줄 0(못 쟀다) */
function checkRoster(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return { rc: 3, why: '⛔명부에 줄이 없다 — 못 쟀다' };
  const known = new Set(Object.values(BRANCH));
  const bad = lines.filter((l) => { const c = l.split('\t'); return c.length < 3 || !known.has(c[1].trim()) || !c[2].trim(); });
  if (bad.length) return { rc: 1, why: `⛔갈래·메시지 칸이 빈 줄 ${bad.length}/${lines.length} — 이 명부의 수를 쓰지 마라\n${bad.join('\n')}` };
  const n = {};
  for (const l of lines) { const k = l.split('\t')[1].trim(); n[k] = (n[k] || 0) + 1; }
  return { rc: 0, why: Object.entries(n).map(([k, v]) => `${k} ${v}`).join(' · ') };
}

function verdict(r) {
  if (!r.found) return { rc: 3, why: '⛔요약(N failed / N flaky)을 못 찾았다 — 못 쟀다' };
  if (r.blocks.length !== r.nFailed + r.nFlaky) return { rc: 3, why: `⛔블록 ${r.blocks.length} ≠ failed+flaky ${r.nFailed + r.nFlaky} — 못 쟀다` };
  const none = r.blocks.filter((b) => b.cls === '첫 Error 없음' || b.kind === '요약에 없음');
  if (none.length) return { rc: 3, why: `⛔첫 Error 없음/요약에 없음 ${none.length} — 못 쟀다` };
  return { rc: 0, why: '갈랐다' };
}

/* ★자가 산다 — 양성(판 정체 셋 꼴) · 음성(참 빨강 · 장면 전제) · 못 쟀다(블록 수 어긋남) */
function selfTest() {
  const blk = (n, key, err, retryErr, title) => [`  ${n}) ${key} › ${title || `제목 ${n}`} ─────`, '', `    Error: ${err}`, '',
    ...(retryErr ? ['    Retry #1 ─────', '', `    Error: ${retryErr}`, ''] : [])].join('\n');
  const log = (bs, failed, flaky) => [...bs, '', `  ${failed.length} failed`, ...failed.map((k) => `    ${k} › x`),
    ...(flaky.length ? [`  ${flaky.length} flaky`, ...flaky.map((k) => `    ${k} › x`)] : []), '  9 passed (1m)'].join('\n');
  const K = (i) => `tests/dom/x${i}.dom.spec.js:${i}:1`;
  const cases = [
    ['양성 «판 정체:»', blk(1, K(1), '판 정체: EXPECT_SHA env 가 풀 sha 40자', '판 정체: EXPECT_SHA env 가 풀 sha 40자'), '전제 실패'],
    ['양성 «P0 판 정체:»', blk(1, K(1), 'P0 판 정체: EXPECT_SHA env 가 풀 sha 40자'), '전제 실패'],
    ['양성 «판 정체 ⑵a:»', blk(1, K(1), '판 정체 ⑵a: 페이지가 받은 js/editor.js === ROOT 작업트리 js/editor.js'), '전제 실패'],
    ['음성 참 빨강(bt2-safety:197 꼴)', blk(1, K(1), 'expect(received).toEqual(expected) // deep equality'), '단언 실패'],
    ['음성 글 속 «판 정체» (머리 아님)', blk(1, K(1), 'T3 card — 판 정체: 아님'), '알 수 없음'],
    ['음성 장면 전제', blk(1, K(1), '[전제] 무거운 장면이 섰다'), '장면 전제'],
    ['양성 «판 정체: EXPECT_SHA 40 hex»(dim-label-radius-t5:30)', blk(1, K(1), '판 정체: EXPECT_SHA 40 hex'), '전제 실패'],
    ['양성 «장면 미성립: EXPECT_SHA 없음»(w2d08:167 · 이름 채널 없이)', blk(1, K(1), '장면 미성립: EXPECT_SHA 없음'), '전제 실패'],
    ['양성 «장면 미성립: 판 정체: …»(t4-16:213)', blk(1, K(1), '장면 미성립: 판 정체: EXPECT_SHA 가 풀 sha 40자'), '전제 실패'],
    ['양성 «장면 미성립: ROOT HEAD === EXPECT_SHA»(w2d08:178)', blk(1, K(1), '장면 미성립: ROOT HEAD === EXPECT_SHA'), '전제 실패'],
    ['양성 «판 정체 ⑴:»(_cr-harness:49 꼴)', blk(1, K(1), '판 정체 ⑴: ROOT 의 HEAD === EXPECT_SHA'), '전제 실패'],
    ['음성 «장면 미성립: 범례가 안 꺼졌다»(graph-label-edit:335)', blk(1, K(1), '장면 미성립: 범례가 안 꺼졌다'), '장면 전제'],
    ['양성 이름만(맨 expect · inspector-assetclear:117 제목)', blk(1, K(1), 'expect(received).toBe(expected) // Object.is equality', null, 'T4-ASSETCLEAR 인스펙터 «이미지» 비우기 › P0 판 정체 — HEAD = EXPECT_SHA · 페이지가 받은 ID_FILES sha1'), '전제 실패'],
    ['양성 이름만(맨 expect · w2d08:164 «B0» 제목)', blk(1, K(1), 'expect(received).toBe(expected) // Object.is equality', null, 'B0 판 정체 — HEAD 와 서빙 파일이 EXPECT_SHA'), '전제 실패'],
    ['음성 제목 속 «판 정체 아님»', blk(1, K(1), 'expect(received).toBe(expected)', null, 'T9 판 정체 아님을 확인한다'), '단언 실패'],
    ['음성 시간 초과(TimeoutError:)', blk(1, K(1), 'x').replace('Error: x', 'TimeoutError: page.waitForFunction: Timeout 3000ms exceeded.'), '알 수 없음'],
    ['양성 «전제 — …»(e80:139)', blk(1, K(1), '전제 — 열 둘 다중 선택'), '장면 전제'],
    ['양성 «전제: …»', blk(1, K(1), '전제: 선 스티커를 눌렀다'), '장면 전제'],
    ['양성 하네스 page.goto(e80:88)', blk(1, K(1), 'page.goto: Test timeout of 30000ms exceeded.'), '하네스 실패'],
    ['양성 하네스 Error 줄 없음', blk(1, K(1), 'x').replace('Error: x', 'Test timeout of 500ms exceeded.'), '하네스 실패'],
    ['양성 메시지 달린 단언(다음 줄 expect)', blk(1, K(1), '높이가 어긋난다').concat('    expect(received).toBe(expected) // Object.is equality\n'), '단언 실패'],
    ['음성 맨 throw', blk(1, K(1), '직접 던졌다'), '알 수 없음'],
  ];
  let bad = 0;
  for (const [name, b, want] of cases) {
    const r = split(log([b], [K(1)], []));
    const got = r.blocks[0] && r.blocks[0].cls;
    const ok = got === want && verdict(r).rc === 0;
    if (!ok) bad++;
    console.log(`${ok ? 'ok' : 'NOT OK'}\t${name}\t→ ${got} (rc ${verdict(r).rc})`);
  }
  const mis = split(log([blk(1, K(1), 'x')], [K(1), K(2)], []));
  const okMis = verdict(mis).rc === 3;
  if (!okMis) bad++;
  console.log(`${okMis ? 'ok' : 'NOT OK'}\t못 쟀다(블록 1 ≠ 요약 2)\t→ rc ${verdict(mis).rc}`);
  return bad ? 1 : 0;
}

if (require.main === module) {
  const arg = process.argv[2];
  if (arg === '--self-test') process.exit(selfTest());
  if (arg === '--check-roster' || arg === '--roster') {
    const f = process.argv[3];
    if (!f || !fs.existsSync(f)) { console.error(`⛔파일이 없다: ${f}`); process.exit(2); }
    const text = fs.readFileSync(f, 'utf8');
    if (arg === '--roster') { const r = split(text), v = verdict(r); if (v.rc) { console.error(v.why); process.exit(v.rc); } console.log(rosterLines(r).join('\n')); process.exit(0); }
    const c = checkRoster(text);
    console.log(c.why);
    process.exit(c.rc);
  }
  if (!arg) { console.error('⛔쓰는 법: node tests/dom/precondition-split.gate.js <전수 로그> | --self-test'); process.exit(2); }
  if (!fs.existsSync(arg)) { console.error(`⛔로그가 없다: ${arg}`); process.exit(2); }
  const r = split(fs.readFileSync(arg, 'utf8'));
  console.log(report(r));
  const v = verdict(r);
  console.log(v.why);
  process.exit(v.rc);
}
module.exports = { split, verdict, PRECOND, rosterLines, checkRoster };
