#!/usr/bin/env node
/**
 * F1 — MCP 도구 «계약 스냅샷» 생성·대조 (2026-09-07 신설, U0)
 *
 * 왜 있나 (실측 2026-09-07): MCP 도구 84개 중 «검사에 이름조차 없는» 것이 79개였다.
 *   그래서 도구를 고쳐도 회귀가 아무것도 안 잡았다 — 하루에 5개를 추가했는데 그중 어느 것도
 *   지켜지지 않았다. 이 스냅샷은 «모든 도구 이름이 파일에 존재»하는 것을 구조로 보장한다.
 *
 * 스냅샷에 박는 것(도구마다):
 *   name · hidden(tools/list 미노출) · mutating(_NON_MUTATING 의 여집합) · switchExempt
 *   · targetFree(★프로젝트 확정 게이트 «면제» 여부 — caf8045 이후)
 *   · required(inputSchema.required) · expectedProjectGuard(파괴적 도구 가드 보유)
 *   · responseKeys(무인자 호출의 최상위 키 — «현행 기록»이다, 판정이 아니다)
 * 전역: 도구 수 · 접두사 표(idPrefixes) · 크기 상한(sizeCaps)
 *
 * ★두 출처를 «교차»한다 — 소스 텍스트의 registerTool 이름과, 실제로 뜬 서버의 tools/list.
 *   어긋나면 exit 2(검사불가): 추출기가 소스와 어긋난 채로 「일치」를 내는 게 제일 나쁘다.
 *
 * 종료 코드 — ★2 는 «통과가 아니다»
 *   0 = 일치   1 = 불일치(도구·인자를 바꾸고 스냅샷을 안 고쳤다)   2 = 검사 자체가 못 돌았다
 *
 * 사용: node tools/mcp-contract-snapshot.mjs           # 스냅샷 «생성/갱신»
 *       node tools/mcp-contract-snapshot.mjs --check   # 대조만
 */
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const require_ = createRequire(import.meta.url);
const SNAP = join(ROOT, 'tests/contract/mcp-tools.contract.json');
const SRC = [
  join(ROOT, 'main/claude-pm/mcp-server.js'),
  join(ROOT, 'main/claude-pm/mcp-block-tools.js'),
];
const CHECK = process.argv.includes('--check');
const die = (code, msg) => { console.error(msg); process.exit(code); };

/* ── 소스 텍스트 추출기 — tools/mcp-doc-sync-check.mjs 의 것과 «같은 규칙»(두 표기 다 받는다) ── */
function toolNamesFromSource() {
  const names = new Set();
  for (const f of SRC) {
    if (!existsSync(f)) die(2, `[검사불가] 소스 없음: ${f}`);
    const lines = readFileSync(f, 'utf8').split('\n');
    for (let i = 0; i < lines.length; i++) {
      const inline = lines[i].match(/registerTool\(\s*'([A-Za-z0-9_]+)'/);
      if (inline) { names.add(inline[1]); continue; }
      if (/registerTool\(\s*$/.test(lines[i])) {
        const next = (lines[i + 1] || '').match(/^\s*'([A-Za-z0-9_]+)'\s*,?\s*$/);
        if (next) names.add(next[1]);
      }
    }
  }
  if (names.size < 50) die(2, `[검사불가] 도구를 ${names.size}개밖에 못 찾았다 — 추출 정규식이 소스와 어긋났다.`);
  return names;
}

/** 소스의 Set 리터럴에서 이름들을 뽑는다(_NON_MUTATING · _SWITCH_EXEMPT). */
function setLiteral(src, varName) {
  const m = src.match(new RegExp(`const\\s+${varName}\\s*=\\s*new Set\\(\\[([\\s\\S]*?)\\]\\)`));
  if (!m) die(2, `[검사불가] ${varName} 집합을 소스에서 못 찾았다 — 이름이 바뀌었다.`);
  return new Set([...m[1].matchAll(/'([A-Za-z0-9_]+)'/g)].map(x => x[1]));
}

/** 파괴적 도구 가드 — 핸들러 안에서 _assertExpectedProject 를 부르는 도구 이름들. */
function guardedTools(src) {
  const out = new Set();
  const lines = src.split('\n');
  let cur = null;
  for (let i = 0; i < lines.length; i++) {
    const inline = lines[i].match(/registerTool\(\s*'([A-Za-z0-9_]+)'/);
    if (inline) { cur = inline[1]; continue; }
    if (/registerTool\(\s*$/.test(lines[i])) {
      const n = (lines[i + 1] || '').match(/^\s*'([A-Za-z0-9_]+)'\s*,?\s*$/);
      if (n) { cur = n[1]; continue; }
    }
    if (cur && /_assertExpectedProject\(/.test(lines[i])) out.add(cur);
  }
  return out;
}

/** blockId 접두사 표 — 정본은 mcp-block-tools.js 의 BLOCK_TYPES. */
function idPrefixes() {
  const src = readFileSync(SRC[1], 'utf8');
  const out = {};
  for (const m of src.matchAll(/\{\s*type:\s*'([a-z_0-9]+)'[\s\S]{0,220}?pfx:\s*'([a-z_]+)'/g)) out[m[1]] = m[2];
  if (Object.keys(out).length < 20) die(2, `[검사불가] BLOCK_TYPES 접두사를 ${Object.keys(out).length}개밖에 못 뽑았다.`);
  return out;
}

/** 소스에 박힌 크기 상한 — 숫자가 조용히 바뀌면 응답 예산이 통째로 흔들린다. */
function sizeCaps(src) {
  const num = (name) => {
    const m = src.match(new RegExp(`const\\s+${name}\\s*=\\s*(\\d+)`));
    if (!m) die(2, `[검사불가] 상수 ${name} 을 못 찾았다.`);
    return Number(m[1]);
  };
  return {
    _CANVAS_TEXT_CAP: num('_CANVAS_TEXT_CAP'),
    _CANVAS_AUTO_SUMMARY_CHARS: num('_CANVAS_AUTO_SUMMARY_CHARS'),
  };
}

const T = (p, ms, what) => Promise.race([p, new Promise((_, r) => setTimeout(() => r(new Error(`TIMEOUT ${what}`)), ms))]);

async function build() {
  const src = readFileSync(SRC[0], 'utf8');
  const fromSource = toolNamesFromSource();
  const nonMutating = setLiteral(src, '_NON_MUTATING');
  const switchExempt = setLiteral(src, '_SWITCH_EXEMPT');
  /* ★_TARGET_FREE = 프로젝트 확정 게이트의 «면제 목록»(caf8045).
     ⛔fail-closed 라 「목록에 없으면 게이트 대상」이다 — 그래서 이 집합을 스냅샷에 박으면
     도구를 몰래 면제로 빼는 변경이 exit 1 로 드러난다.
     ⚠️게이트 «이전» 소스에는 이 집합이 없다 → 그땐 전부 targetFree=true 로 기록한다
        (없는 것을 「전부 게이트 대상」으로 적으면 거짓이 된다). */
  const hasGate = /const\s+_TARGET_FREE\s*=\s*new Set\(/.test(src);
  const targetFree = hasGate ? setLiteral(src, '_TARGET_FREE') : null;
  const guarded = guardedTools(src);

  let harness;
  try {
    ({ startHarness: harness } = require_(join(ROOT, 'tests/unit/_mcp-harness.js')));
  } catch (e) { die(2, `[검사불가] 하네스를 못 불러왔다: ${e.message}`); }

  let h;
  try { h = await T(harness({ activeProject: 'proj_1' }), 20000, 'startHarness'); }
  catch (e) { die(2, `[검사불가] MCP 서버를 못 띄웠다: ${e.message}`); }

  try {
    const listed = await T(h.listTools(true), 10000, 'tools/list');
    const visible = new Set((await T(h.listTools(false), 10000, 'tools/list')).map(t => t.name));
    const fromServer = new Set(listed.map(t => t.name));

    // ★교차 검증 — 추출기와 실제 등록이 어긋나면 이 검사는 «못 돈 것»이다.
    const onlySrc = [...fromSource].filter(n => !fromServer.has(n)).sort();
    const onlySrv = [...fromServer].filter(n => !fromSource.has(n)).sort();
    if (onlySrc.length || onlySrv.length) {
      die(2, '[검사불가] registerTool 추출기와 실제 등록이 어긋난다 — 추출기를 먼저 고쳐라.\n'
        + (onlySrc.length ? `  소스에만: ${onlySrc.join(' ')}\n` : '')
        + (onlySrv.length ? `  서버에만: ${onlySrv.join(' ')}\n` : ''));
    }

    const tools = {};
    for (const t of listed.slice().sort((a, b) => a.name.localeCompare(b.name))) {
      let responseKeys = null, callOutcome = 'ok';
      try {
        const r = await T(h.call(t.name, {}), 8000, t.name);
        if (r.error) { callOutcome = 'rejected'; responseKeys = []; }
        else responseKeys = Object.keys(r.result || {}).sort();
      } catch (e) { callOutcome = 'timeout'; responseKeys = null; }
      tools[t.name] = {
        hidden: !visible.has(t.name),
        mutating: !nonMutating.has(t.name),
        switchExempt: switchExempt.has(t.name),
        targetFree: targetFree ? targetFree.has(t.name) : true,
        required: (t.inputSchema && t.inputSchema.required) ? t.inputSchema.required.slice().sort() : [],
        expectedProjectGuard: guarded.has(t.name),
        /* ⚠️「무인자로 부르면 이렇게 답한다」는 «현행 기록»이지 «옳음»이 아니다.
              바뀌면 눈에 띄게 하는 게 목적이다. */
        noArgs: callOutcome,
        responseKeys,
      };
    }

    return {
      note: '생성물 — tools/mcp-contract-snapshot.mjs 로만 고친다. 손으로 고치지 마라.',
      counts: { registered: fromServer.size, visible: visible.size, hidden: fromServer.size - visible.size,
                mutating: [...fromServer].filter(n => !nonMutating.has(n)).length,
                gated: [...fromServer].filter(n => !(targetFree ? targetFree.has(n) : true)).length },
      sizeCaps: sizeCaps(src),
      idPrefixes: idPrefixes(),
      tools,
    };
  } finally { await h.stop(); }
}

const built = await build();

if (!CHECK) {
  mkdirSync(dirname(SNAP), { recursive: true });
  writeFileSync(SNAP, JSON.stringify(built, null, 2) + '\n');
  console.log(`스냅샷 갱신: ${SNAP}\n  도구 ${built.counts.registered}개(노출 ${built.counts.visible} · 숨김 ${built.counts.hidden} · 변경성 ${built.counts.mutating} · 게이트대상 ${built.counts.gated}) · 접두사 ${Object.keys(built.idPrefixes).length}종`);
  process.exit(0);
}

if (!existsSync(SNAP)) die(2, `[검사불가] 스냅샷이 없다: ${SNAP}\n  → node tools/mcp-contract-snapshot.mjs 로 «먼저» 만들어라. «통과가 아니다».`);
let have;
try { have = JSON.parse(readFileSync(SNAP, 'utf8')); } catch (e) { die(2, `[검사불가] 스냅샷 파싱 실패: ${e.message}`); }

const diffs = [];
const hn = new Set(Object.keys(have.tools || {})), bn = new Set(Object.keys(built.tools));
for (const n of [...bn].filter(x => !hn.has(x)).sort()) diffs.push(`+ 새 도구 «${n}» 가 스냅샷에 없다 — 계약을 박고 검사도 같이 넣어라`);
for (const n of [...hn].filter(x => !bn.has(x)).sort()) diffs.push(`- 도구 «${n}» 가 사라졌다(스냅샷엔 있다)`);
for (const n of [...bn].filter(x => hn.has(x)).sort()) {
  const a = have.tools[n], b = built.tools[n];
  for (const k of ['hidden', 'mutating', 'switchExempt', 'targetFree', 'expectedProjectGuard', 'noArgs']) {
    if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) diffs.push(`~ ${n}.${k}: ${JSON.stringify(a[k])} → ${JSON.stringify(b[k])}`);
  }
  for (const k of ['required', 'responseKeys']) {
    if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) diffs.push(`~ ${n}.${k}: ${JSON.stringify(a[k])} → ${JSON.stringify(b[k])}`);
  }
}
for (const k of Object.keys(built.counts)) if (have.counts?.[k] !== built.counts[k]) diffs.push(`~ counts.${k}: ${have.counts?.[k]} → ${built.counts[k]}`);
for (const k of Object.keys(built.sizeCaps)) if (have.sizeCaps?.[k] !== built.sizeCaps[k]) diffs.push(`~ sizeCaps.${k}: ${have.sizeCaps?.[k]} → ${built.sizeCaps[k]}`);
for (const k of Object.keys(built.idPrefixes)) if (have.idPrefixes?.[k] !== built.idPrefixes[k]) diffs.push(`~ idPrefixes.${k}: ${have.idPrefixes?.[k]} → ${built.idPrefixes[k]}`);
for (const k of Object.keys(have.idPrefixes || {})) if (!(k in built.idPrefixes)) diffs.push(`- idPrefixes.${k} 가 사라졌다`);

console.log(`코드 도구 ${built.counts.registered}개 · 스냅샷 ${hn.size}개`);
if (!diffs.length) { console.log('✅ 계약 일치'); process.exit(0); }
console.error(`❌ 계약 불일치 ${diffs.length}건 — 의도한 변경이면 스냅샷을 «같이» 갱신해라(node tools/mcp-contract-snapshot.mjs):`);
for (const d of diffs) console.error('  ' + d);
process.exit(1);
