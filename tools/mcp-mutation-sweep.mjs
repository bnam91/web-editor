#!/usr/bin/env node
/**
 * F5 — MCP 검사 «변이 스윕». (2026-09-07 신설, U0)
 *
 * ⚠️★겹침 고지: 팀 표준 변이 스윕이 «이미 있다» — `tools/mutation-sweep.js` + `tools/mutations.json`
 *   (45건, MCP 관련 0건). 이 파일이 «따로» 있는 이유는 하나다: 표준 러너는 「몇 개 테스트가
 *   죽었나」를 세지만, 여기선 «어느 검사가» 죽어야 하는지(expectRed)를 못박고 안 죽으면 실패로
 *   센다 — 「엉뚱한 검사가 죽어서 초록이 아닌 것」을 「그 검사가 산다」로 읽지 않기 위해서다.
 *   ⇒ 통합 후보다. 안 합친 이유: mutations.json 에 10건을 더하면 표준 스윕이 매 변이마다
 *      단위 스위트 «전체»(1102개)를 돌려 실행시간이 크게 는다. 그 비용은 팀 결정 사항이라
 *      혼자 물리지 않았다.
 *
 * ★왜: 초록은 «검사가 있다»는 뜻이 아니다. 검사가 아무것도 안 재도 초록이다.
 *   그래서 «일부러 망가뜨리고 빨강이 나는지»를 기계로 확인한다. 안 나면 그 검사는 검사가 아니다.
 *
 * 하는 일: 변이 하나마다 ⑴원본 백업 ⑵치환 ⑶대상 테스트 실행 ⑷빨강인지 판정 ⑸원본 복원.
 *   ⛔git 을 안 쓴다(stash/checkout 은 남의 worktree 와 얽힌다) — 파일 사본으로만 오간다.
 *   ⛔어떤 경로로 죽어도 finally 에서 복원하고, 끝에 «원본과 바이트 동일»을 다시 확인한다.
 *
 * 종료 코드: 0 = 변이 전부 빨강(검사가 산다) · 1 = 초록으로 «샌» 변이가 있다 · 2 = 스윕이 못 돌았다
 * 사용: node tools/mcp-mutation-sweep.mjs [--only <id>] [--list]
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SERVER = 'main/claude-pm/mcp-server.js';
const UNIT = ['tests/unit/mcp-contract.test.js', 'tests/unit/mcp-response-budget.test.js',
              'tests/unit/mcp-two-ends.test.js', 'tests/unit/mcp-gate-coverage.test.js'];
const sha = (b) => createHash('sha256').update(b).digest('hex');

/** 변이 = {id, 왜, file, find, replace, expectRed:[어느 검사가 빨강이어야 하나]} */
const MUTATIONS = [
  { id: 'M1-wire-invoker-call',
    why: '★배선 삭제 — 도구는 답하는데 렌더러를 «안 부른다». 모듈은 완벽한데 아무도 안 부르는 그 병.',
    file: SERVER,
    find: `      return await _rendererInvoker.addTextBlock({ type, content: text, sectionId, align });`,
    replace: `      return { ok: true };  // [MUTANT] 배선 삭제 — 렌더러를 안 부른다`,
    expectRed: ['F3-2'] },

  { id: 'M2-wire-invoker-key',
    why: '★배선 삭제(키 오타) — invoker 키 이름 하나가 어긋나면 조용히 «없는 함수»가 된다.',
    file: SERVER,
    find: `const raw = await _rendererInvoker.getCanvasState({ sectionId });`,
    replace: `const raw = await (_rendererInvoker.getCanvasStateV2 ? _rendererInvoker.getCanvasStateV2({ sectionId }) : { ok: true, sections: [] });`,
    expectRed: ['F3-2', 'F4-1', 'F7-1'] },

  { id: 'M3-registerTool-line',
    why: '★배선 삭제(등록 줄) — registerTool 줄을 지우면 도구가 목록에서 통째로 사라진다.',
    file: SERVER,
    find: `function registerTool(name, handler, schema) {\n  tools.set(name, handler);`,
    replace: `function registerTool(name, handler, schema) {\n  if (name === 'add_gap_block') return;\n  tools.set(name, handler);`,
    expectRed: ['F3-0'] },

  { id: 'M4-serializeCall',
    why: '_serializeCall 제거 — 병렬 편집이 «겹쳐» 들어가 옛 문서에 떨어진다(조용한 증발).',
    file: SERVER,
    find: `  const p = _callChain.then(run, run);   // 앞 호출이 실패해도 줄은 계속 흐른다`,
    replace: `  const p = Promise.resolve().then(run);  // [MUTANT] 직렬화 제거`,
    expectRed: ['F3-5'] },

  { id: 'M5-token-header',
    why: '헤더 삭제 — 토큰 검증이 사라지면 «아무나» 로컬 포트로 캔버스를 고칠 수 있다.',
    file: SERVER,
    find: `      const tok = _extractToken(req);\n      if (!_tokenOk(tok)) {`,
    replace: `      const tok = _extractToken(req);\n      if (false) {`,
    expectRed: ['F3-3'] },

  { id: 'M6-allowlist-summary',
    why: '★허용목록 누락 — #1 결함 그 자체. 렌더러가 보낸 summary 를 «조용히» 버려 «반쯤 고쳐진» 상태를 만든다.',
    file: SERVER,
    find: `        if (b.summary && typeof b.summary === 'object' && Object.keys(b.summary).length) o.summary = b.summary;`,
    replace: `        // [MUTANT] 허용목록에서 summary 를 뺐다`,
    expectRed: ['F7-2', 'F7-3', 'F4-1'] },

  { id: 'M7-all-to-last',
    why: '★차집합→마지막 — «전부»를 봐야 하는 자리에서 «마지막 하나»만 본다(#1 결함의 모양).',
    file: SERVER,
    find: `    sections: raw.sections.map(s => ({`,
    replace: `    sections: raw.sections.slice(-1).map(s => ({`,   // [MUTANT] 전부 → 마지막
    expectRed: ['F4-1', 'F7-1'] },

  { id: 'M8-size-cap-default',
    why: '기본값 되돌리기 — 자동 summary 폴백 상한을 사실상 무한으로 되돌리면 85MB 캔버스가 통째로 나간다.',
    file: SERVER,
    find: `const _CANVAS_AUTO_SUMMARY_CHARS = 24000;`,
    replace: `const _CANVAS_AUTO_SUMMARY_CHARS = 999999999;`,
    expectRed: ['F4-3', 'F1'] },

  { id: 'M9-base64-leak',
    why: '★금지 문자열 — 어떤 경로로든 dataURL 이 응답에 실리면 부르는 쪽 대화가 한 번에 날아간다.',
    file: SERVER,
    find: `      const raw = await _rendererInvoker.getCanvasState({ sectionId });\n      return _slimCanvasState(raw, detail);`,
    replace: `      const raw = await _rendererInvoker.getCanvasState({ sectionId });\n      const out = _slimCanvasState(raw, detail);\n      out.debugImage = 'data:image/png;base64,' + 'A'.repeat(200);  // [MUTANT] 유출\n      return out;`,
    expectRed: ['F4-1', 'F4-7'] },

  { id: 'M10-hidden-tools',
    why: '숨김이 «제거»가 되면 기존 대화·문서가 부르던 별칭 51개가 통째로 죽는다.',
    file: SERVER,
    find: `        if (!includeHidden && hiddenTools.has(name)) continue;`,
    replace: `        if (hiddenTools.has(name)) continue;  // [MUTANT] includeHidden 무시`,
    expectRed: ['F3-0', 'F1'] },

  /* ── 프로젝트 확정 게이트(caf8045) ──
   * ★이 셋이 «반드시» 있어야 하는 이유: 게이트가 들어오자 내 F3-2 가 39건 빨강이 됐고,
   *   고친 방법은 «하네스가 사람처럼 먼저 대상을 확정»하는 것이었다. 그렇게만 두면
   *   게이트를 통째로 지워도 F3-2 는 초록이다(확정하고 부르니까) — 「고쳤다」가 구멍이 된다. */
  { id: 'M11-gate-disabled', requires: { probe: 'function _projectGate(', name: '프로젝트 확정 게이트' },
    why: '★게이트 무력화 — 확정 없이도 쓰기가 통과한다(사용자의 진짜 프로젝트가 말없이 바뀐다).',
    file: SERVER,
    find: `function _projectGate(toolName, args) {`,
    replace: `function _projectGate(toolName, args) {\n  return null;  // [MUTANT] 게이트 무력화`,
    expectRed: ['F3-7'] },

  { id: 'M12-gate-leak-targetfree', requires: { probe: 'const _TARGET_FREE = new Set(', name: '프로젝트 확정 게이트' },
    why: '★면제 목록 누수 — 쓰기 도구를 _TARGET_FREE 로 몰래 빼면 그 도구만 게이트를 빠져나간다.',
    file: SERVER,
    find: `const _TARGET_FREE = new Set([`,
    replace: `const _TARGET_FREE = new Set([\n  'add_text_block', 'update_block',  // [MUTANT] 쓰기 도구 누수`,
    expectRed: ['F3-7', 'F1'] },

  { id: 'M13-gate-refuse-but-write', requires: { probe: 'const _gateRefusal = _projectGate(', name: '프로젝트 확정 게이트' },
    why: '★★「거절했다」와 «아무것도 안 했다»는 다른 사실 — 거절문을 돌려주면서 편집은 이미 한 모양.',
    file: SERVER,
    find: `      if (_gateRefusal) return _reply(_gateRefusal);`,
    replace: `      if (_gateRefusal) { /* [MUTANT] 거절해 놓고 계속 진행 */ }`,
    expectRed: ['F3-7'] },
];

if (process.argv.includes('--list')) {
  for (const m of MUTATIONS) console.log(`${m.id.padEnd(26)} → 빨강 기대: ${m.expectRed.join(' ')}\n${' '.repeat(28)}${m.why}`);
  process.exit(0);
}
const onlyIdx = process.argv.indexOf('--only');
const only = onlyIdx > 0 ? process.argv[onlyIdx + 1] : null;

function runUnit() {
  const r = spawnSync(process.execPath, ['--test', ...UNIT], { cwd: ROOT, encoding: 'utf8', timeout: 300000 });
  const out = (r.stdout || '') + (r.stderr || '');
  const failed = [...out.matchAll(/^✖ (F\d[^ ]*)/gm)].map(m => m[1]);
  const pass = Number((out.match(/^# pass (\d+)/m) || out.match(/ℹ pass (\d+)/) || [])[1] || 0);
  const fail = Number((out.match(/^# fail (\d+)/m) || out.match(/ℹ fail (\d+)/) || [])[1] || 0);
  return { code: r.status, failed, pass, fail, out };
}
function runF1() {
  const r = spawnSync(process.execPath, ['tools/mcp-contract-snapshot.mjs', '--check'], { cwd: ROOT, encoding: 'utf8', timeout: 120000 });
  return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
}

const target = join(ROOT, SERVER);
if (!existsSync(target)) { console.error(`[검사불가] 대상이 없다: ${target}`); process.exit(2); }

/* ★tools/mutation-sweep.js(팀 표준)에서 «빌려온» 두 가지 안전장치. 근거가 그대로 여기에도 맞다:
 *   ⑴ 시작 전 «청결 검사» — 앞선 실행이 죽으며 남긴 변이 «위에서» 스윕이 돌면 결과가 통째로
 *      오염된다(그 파일 주석에 실제 사고가 적혀 있다).
 *   ⑵ finally 만으로는 SIGINT/SIGTERM 을 못 잡는다 — 신호에도 복원한다. */
{
  const st = spawnSync('git', ['status', '--porcelain', '--', SERVER], { cwd: ROOT, encoding: 'utf8' });
  if (st.status === 0 && (st.stdout || '').trim()) {
    console.error(`⛔변이 대상이 이미 수정돼 있다 — 스윕을 시작하지 않는다(결과가 오염된다):\n${st.stdout.trim()}`);
    console.error(`   커밋하거나 \`git checkout -- ${SERVER}\` 로 되돌린 뒤 다시 돌려라.`);
    process.exit(2);
  }
}
const original = readFileSync(target, 'utf8');
const originalSha = sha(original);
let _restored = false;
function restore() {
  if (_restored) return; 
  try { writeFileSync(target, original); }
  catch (e) {
    console.error(`\n⛔⛔ 복원 실패 — «변이가 워킹트리에 남았다»: ${target}\n   ${e.message}\n`
      + `   ⇒ 즉시 \`git checkout -- ${SERVER}\` 하라. 이 상태로 테스트를 믿으면 안 된다.`);
  }
}
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, () => { restore(); process.exit(130); });

// ── 기준선: 변이 «전»에 전부 초록이어야 한다. 아니면 스윕 자체가 무의미하다.
const base = runUnit(), baseF1 = runF1();
if (base.fail !== 0 || baseF1.code !== 0) {
  console.error(`[검사불가] 기준선이 이미 빨강이다 — unit fail ${base.fail} · F1 exit ${baseF1.code}. 변이 스윕은 초록 기준선 위에서만 뜻이 있다.`);
  process.exit(2);
}
console.log(`기준선: unit ${base.pass} pass / ${base.fail} fail · F1(--check) exit 0\n`);

const rows = [];
let leaked = 0, skipped = 0;
try {
  for (const m of MUTATIONS) {
    if (only && m.id !== only) continue;
    if (m.requires && !original.includes(m.requires.probe)) {
      // ⑵ 기능이 이 트리에 «없다» — 낡은 변이가 아니다. 소리내어 건너뛴다(통과로 세지 않는다).
      rows.push({ id: m.id, verdict: '건너뜀', detail: `${m.requires.name} 가 이 트리에 없다 — 병합되면 «자동으로» 살아난다.` });
      skipped++; continue;
    }
    if (!original.includes(m.find)) {
      rows.push({ id: m.id, verdict: '검사불가', detail: '치환 대상 문자열을 못 찾았다 — 소스가 바뀌었다. 변이를 고쳐라.' });
      leaked++; continue;
    }
    writeFileSync(target, original.replace(m.find, m.replace));
    const u = runUnit();
    const f1 = m.expectRed.includes('F1') ? runF1() : null;
    const red = new Set(u.failed);
    if (f1 && f1.code !== 0) red.add('F1');
    const missed = m.expectRed.filter(e => ![...red].some(r => r.startsWith(e)));
    rows.push({
      id: m.id, why: m.why,
      verdict: missed.length ? '★샜다(초록)' : '빨강',
      detail: `기대 ${m.expectRed.join(' ')} · 실제 빨강 ${[...red].join(' ') || '없음'}` + (missed.length ? ` · ⛔안 잡힌 것: ${missed.join(' ')}` : ''),
      unit: `${u.pass} pass / ${u.fail} fail`,
    });
    if (missed.length) leaked++;
    writeFileSync(target, original);   // 즉시 복원
  }
} finally {
  restore();
  const after = sha(readFileSync(target, 'utf8'));
  if (after !== originalSha) { console.error(`[치명] 원본 복원 실패 — sha ${after} ≠ ${originalSha}`); process.exit(2); }
  console.log(`\n원본 복원 확인: sha256 ${originalSha.slice(0, 16)} 동일`);
}

console.log('\n| 변이 | 판정 | 근거 | 단위검사 |');
console.log('|---|---|---|---|');
for (const r of rows) console.log(`| ${r.id} | ${r.verdict} | ${r.detail} | ${r.unit || '-'} |`);
if (leaked) { console.error(`\n❌ 초록으로 «샌» 변이 ${leaked}건 — 그 검사는 검사가 아니다.`); process.exit(1); }
const ran = rows.length - skipped;
console.log(`\n✅ 변이 ${ran}건 «전부» 빨강 — 검사가 실제로 무언가를 재고 있다.`
  + (skipped ? `\n⏭️  건너뜀 ${skipped}건 — 해당 기능이 이 트리에 «없다»(병합되면 자동으로 살아난다). 통과로 세지 않았다.` : ''));
process.exit(0);
