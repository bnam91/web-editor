/* mcp-gate-coverage.test.js — F3 의 «게이트 팔». (2026-09-07 신설, U0 / 09-07 병합 후 보강)
 *
 * ★왜 «따로» 있나 — 이 파일이 없으면 생기는 구멍이 실재한다:
 *   `feat/mcp-project-gate`(caf8045) 가 들어오자 내 F3-2(도구 전수 ok)가 39건 빨강이 됐다.
 *   고친 방법은 «하네스가 사람처럼 open_project 로 대상을 먼저 확정»하는 것이었다.
 *   ⇒ 그런데 그렇게만 고치면 **게이트를 통째로 지워도 F3-2 는 초록이다** — 확정하고 부르니까.
 *      즉 「고쳤다」가 「검사 구멍」이 된다. 이 파일이 그 구멍을 막는다.
 *
 * ⚠️`confirmProject: false` 로 하네스를 띄운다 — «확정 안 한» 상태가 있어야 게이트가 막는지 잰다.
 *   (mcp-contract.test.js 는 반대로 확정하고 띄운다. 한 프로세스에 하네스는 하나라 파일을 나눈다.)
 *
 * ⛔여기서 재는 것은 «게이트의 세부 문구»가 아니다 — 그건 tests/unit/mcp-project-gate.test.js
 *   (게이트 담당 단위)의 몫이다. 여기서는 «커버리지 관점»만 본다:
 *   ⑴ 확정 없이 쓰기 = 거절 ⑵ 그때 렌더러를 «안» 부른다 ⑶ 읽기는 통과 ⑷ 확정 뒤 통과
 *   ⑸ 게이트 대상이 «계약 스냅샷과 같다»(도구를 몰래 게이트 밖으로 빼면 빨강)
 */
'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { startHarness } = require('./_mcp-harness');
const { CASES } = require('../contract/mcp-cases');
const CONTRACT = require('../contract/mcp-tools.contract.json');

let H = null;
before(async () => { H = await startHarness({ activeProject: 'proj_1', confirmProject: false }); });
after(async () => { if (H) await H.stop(); });

/* ★게이트가 «트리에 없을 수도» 있다 — U0(qa/mcp-harness-u0)과 게이트(feat/mcp-project-gate)는
 *   «따로» 있는 브랜치라, 병합 순서에 따라 게이트 이전 트리에서도 이 파일이 돈다.
 *   ⛔그때 «없는 것을 빨강»으로 내면 병합 «순서»가 검사를 인질로 잡는다.
 *   ⇒ 「게이트가 없다」는 skip 으로 «소리내어» 알린다. skip 은 통과가 아니다 — 로그에 남는다.
 *      게이트가 들어오면 skip 이 사라진다. skip 이 «계속» 보이면 그 자체가 신호다. */
const GATE_PRESENT = () => CONTRACT.counts.gated > 0;
const SKIP_MSG = '게이트(feat/mcp-project-gate)가 이 트리에 없다 — 계약 counts.gated=0. '
  + '게이트 병합 뒤 `node tools/mcp-contract-snapshot.mjs` 로 스냅샷을 갱신하면 «자동으로» 살아난다.';

/** 계약이 「게이트 대상」이라 적어 둔 도구들. */
const gated = () => Object.entries(CONTRACT.tools).filter(([, v]) => v.targetFree === false).map(([k]) => k);
const free = () => Object.entries(CONTRACT.tools).filter(([, v]) => v.targetFree === true).map(([k]) => k);

test('F3-7 ★확정 «전»에는 쓰기 도구가 거절되고, 렌더러를 «한 번도» 안 부른다', async (t) => {
  if (!GATE_PRESENT()) return t.skip(SKIP_MSG);
  const g = gated().filter(n => CASES[n] && !CASES[n].expectReject);
  assert.ok(g.length >= 50, `게이트 대상이 ${g.length}개뿐 — 계약 스냅샷이 낡았다(node tools/mcp-contract-snapshot.mjs)`);

  const leaked = [], touched = [];
  for (const name of g) {
    H.reset();
    const r = await H.call(name, CASES[name].args);
    const refused = !!r.error || (r.result && r.result.ok === false);
    if (!refused) leaked.push(name);
    /* ★「거절했다」와 «아무것도 안 했다»는 다른 사실이다.
       응답만 보면 거절인데 렌더러는 이미 만졌으면 그게 제일 나쁜 모양이다. */
    const work = r.rendererCalls.map(x => x.method).filter(m => m !== 'historyTip' && !m.startsWith('projectOps.'));
    if (work.length) touched.push(`${name} → ${work.join(',')}`);
  }
  assert.deepStrictEqual(leaked, [],
    `★확정 없이 «통과»한 쓰기 도구 ${leaked.length}개: ${leaked.join(' ')}\n` +
    '  → 프로젝트 확정 게이트가 사라졌거나 이 도구가 _TARGET_FREE 로 새어나갔다.');
  assert.deepStrictEqual(touched, [],
    '★거절했다면서 렌더러를 «이미 만졌다» — 사용자의 진짜 프로젝트가 바뀐다:\n  ' + touched.join('\n  '));
  console.error(`  [셈] 게이트 대상 ${g.length}개 전부 거절 · 렌더러 접촉 0건`);
});

test('F3-8 읽기·대상선택 도구는 확정 «없이도» 통과한다 (⛔막으면 현황조차 못 묻는다)', async (t) => {
  if (!GATE_PRESENT()) return t.skip(SKIP_MSG);
  const f = free().filter(n => CASES[n] && !CASES[n].expectReject && !CASES[n].setup);
  const blocked = [];
  for (const name of f) {
    const r = await H.call(name, CASES[name].args);
    const refused = !!r.error || (r.result && r.result.ok === false);
    if (refused) blocked.push(`${name}: ${JSON.stringify(r.result || r.error).slice(0, 100)}`);
  }
  assert.deepStrictEqual(blocked, [],
    '★확정 없이 막힌 읽기 도구 — 클로드가 「지금 뭐가 열렸는지」를 물어볼 통로가 사라진다:\n  ' + blocked.join('\n  '));
  console.error(`  [셈] 게이트 면제 ${f.length}개 전부 확정 없이 통과`);
});

test('F3-9 확정하면 통과하고, 사람이 «다른 프로젝트를 열면» 확정이 깨져 다시 거절된다', async (t) => {
  if (!GATE_PRESENT()) return t.skip(SKIP_MSG);
  await H.confirmTarget('proj_1');
  const okr = await H.call('add_text_block', { content: 'hello' });
  assert.strictEqual(okr.result && okr.result.ok, true, `확정했는데도 거절됐다: ${JSON.stringify(okr.result)}`);

  // 사람이 앱에서 다른 프로젝트를 열었다 — sticky 가 깨져야 한다.
  H.seedProject('proj_2');
  H.setActiveProject('proj_2');
  H.reset();
  const after = await H.call('add_text_block', { content: 'hello again' });
  assert.strictEqual(after.result && after.result.ok, false,
    '★활성 프로젝트가 바뀌었는데 옛 확정으로 그대로 썼다 — 남의 프로젝트에 쓴다');
  const work = after.rendererCalls.map(x => x.method).filter(m => m !== 'historyTip' && !m.startsWith('projectOps.'));
  assert.deepStrictEqual(work, [], '거절했다면서 렌더러를 만졌다');
  console.error(`  [실측] 확정 → 통과 · 프로젝트 전환 → ${after.result.code} 로 재거절`);
});

test('F3-10 계약 스냅샷의 targetFree 가 실제 tools/list 경고와 일치한다', async (t) => {
  if (!GATE_PRESENT()) return t.skip(SKIP_MSG);
  /* 게이트는 tools/list «설명»에 안내를 기계적으로 붙인다.
     계약(targetFree)과 설명(경고 유무)이 어긋나면 둘 중 하나가 거짓말이다.
     ★문구는 «서버 소스의 상수»에서 읽는다 — 여기 또 적어 두면 문구를 고칠 때 어긋난다
       (2026-09-08 실제로 어긋났다: 92자 → 44자로 줄이자 이 검사가 옛 문장을 찾았다).
       이 검사가 지킬 것은 «문구»가 아니라 «계약과 설명이 같은 말을 하나»다. */
  const NOTE = (() => {
    const src = require('fs').readFileSync(
      require('path').join(__dirname, '..', '..', 'main', 'claude-pm', 'mcp-server.js'), 'utf8');
    const m = src.match(/const _TARGET_NOTE = '([^']+)'/);
    if (!m) throw new Error('_TARGET_NOTE 를 소스에서 못 찾았다 — 상수가 사라졌나');
    return m[1].trim();
  })();
  const listed = await H.listTools(true);
  const mismatch = [];
  for (const t of listed) {
    const warned = (t.description || '').includes(NOTE);
    const c = CONTRACT.tools[t.name];
    if (!c) { mismatch.push(`${t.name}: 계약에 없다`); continue; }
    if (warned === c.targetFree) mismatch.push(`${t.name}: 계약 targetFree=${c.targetFree} 인데 설명 경고=${warned}`);
  }
  assert.deepStrictEqual(mismatch, [], '계약과 tools/list 설명이 어긋난다:\n  ' + mismatch.join('\n  '));
  console.error(`  [셈] 도구 ${listed.length}개 · 게이트 대상 ${gated().length} · 면제 ${free().length} — 계약과 설명 일치`);
});
