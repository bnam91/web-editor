/* mcp-contract.test.js — F3 «MCP 도구 전수» 커버리지 게이트. (2026-09-07 신설, U0)
 *
 * ★왜 (실측 2026-09-07): 단위검사 81파일 중 MCP 디스패처를 부르는 것이 «0개»였다.
 *   도구 84개 중 검사에 이름이라도 나오는 것이 5개. 그래서 오늘 도구를 5개 추가했는데
 *   그중 어느 것도 회귀가 지켜주지 않았다. 이 파일이 그 구멍을 «구조로» 닫는다.
 *
 * 재는 것 넷:
 *   ⓪ 커버리지  N_registered − N_with_case === 0        ← 새 도구에 케이스가 없으면 빨강
 *   ⑴ 필수 인자 누락 → 거절                             ← required 가 있는 도구만
 *   ⑵ ★배선     기대한 브리지 메서드가 «한 번 이상» 불렸나
 *   ⑶ ok 키      응답에 ok:true 가 있나(계약)
 *
 * ⛔테스트 서버 포트는 9345~9365 «밖»이다(_mcp-harness.js 가 실제 포트로 다시 잰다).
 *   그 대역이면 사용자의 클로드앱 커넥터가 우리 테스트 서버에 붙는다.
 */
'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { startHarness } = require('./_mcp-harness');
const { CASES } = require('../contract/mcp-cases');
const CONTRACT = require('../contract/mcp-tools.contract.json');

let H = null;
let REGISTERED = [];

before(async () => {
  H = await startHarness({ activeProject: 'proj_1' });
  REGISTERED = (await H.listTools(true)).map(t => t.name).sort();
});
after(async () => { if (H) await H.stop(); });

/* ── ⓪ 커버리지 게이트 ─────────────────────────────────────────────── */
test('F3-0 등록된 도구 «전부»에 케이스가 있다 (N_registered − N_with_case === 0)', () => {
  const cased = new Set(Object.keys(CASES));
  const missing = REGISTERED.filter(n => !cased.has(n));
  const phantom = [...cased].filter(n => !REGISTERED.includes(n));
  assert.deepStrictEqual(missing, [],
    `케이스 없는 도구 ${missing.length}개: ${missing.join(' ')}\n` +
    '  → tests/contract/mcp-cases.js 에 줄을 «같이» 늘려라. 검사 없는 도구는 고쳐도 안 지켜진다.');
  assert.deepStrictEqual(phantom, [], `없는 도구의 케이스: ${phantom.join(' ')}`);
  assert.strictEqual(REGISTERED.length - cased.size, 0);
  // 「셌다」의 근거를 «어디를 셌는지»와 같이 남긴다.
  console.error(`  [셈] tools/list(includeHidden) ${REGISTERED.length}개 · 케이스표 ${cased.size}개 · 차 0`);
});

test('F3-0b 계약 스냅샷의 도구 집합이 실제 등록과 같다', () => {
  assert.deepStrictEqual(Object.keys(CONTRACT.tools).sort(), REGISTERED,
    '스냅샷이 낡았다 → node tools/mcp-contract-snapshot.mjs');
});

/* ── ⑴ 필수 인자 누락 거절 ─────────────────────────────────────────── */
test('F3-1 required 가 있는 도구는 «무인자» 호출을 거절한다', async () => {
  const withRequired = REGISTERED.filter(n => (CONTRACT.tools[n].required || []).length > 0);
  assert.ok(withRequired.length >= 10, `required 있는 도구가 ${withRequired.length}개뿐 — 스냅샷이 이상하다`);
  const wrong = [];
  for (const n of withRequired) {
    const r = await H.call(n, {});
    // ⚠️거절의 «모양»은 둘이다: JSON-RPC error(throw) 또는 ok:false. 둘 다 거절로 센다.
    const rejected = !!r.error || (r.result && r.result.ok === false);
    if (!rejected) wrong.push(n);
  }
  assert.deepStrictEqual(wrong, [], `필수 인자 없이도 «통과»한 도구: ${wrong.join(' ')}`);
  console.error(`  [셈] required 보유 ${withRequired.length}개 전부 무인자 거절 · ` +
              `무인자 수용 ${REGISTERED.length - withRequired.length}개는 «현행 기록»(빨강 아님)`);
});

/* ── ⑵ ★배선 + ⑶ ok 키 ────────────────────────────────────────────── */
test('F3-2 도구 «전수»가 기대한 브리지 메서드를 실제로 부르고 ok 를 돌려준다', async () => {
  const failWire = [], failOk = [];
  for (const name of REGISTERED) {
    const c = CASES[name];
    for (const [sn, sa] of (c.setup || [])) await H.call(sn, sa);
    H.reset();
    const r = await H.call(name, c.args);

    if (c.expectReject) {
      // 폐기 도구 — 거절이 «옳다». 조용히 성공하면 그게 회귀다.
      const rejected = !!r.error || (r.result && r.result.ok === false);
      if (!rejected) failOk.push(`${name}: 폐기 도구인데 성공했다`);
      continue;
    }

    if (r.error) { failOk.push(`${name}: RPC 오류 ${r.error.message}`); continue; }
    if (!c.noOkKey && (!r.result || r.result.ok !== true)) failOk.push(`${name}: ok!==true (${JSON.stringify(r.result).slice(0, 120)})`);

    const called = r.rendererCalls.map(x => x.method).filter(m => m !== 'historyTip'); // historyTip=부기
    if (!c.sinks.length) {
      // 배선이 «없는 게 옳은» 도구 — 브리지를 부르면 그게 이상하다.
      if (called.length) failWire.push(`${name}: 배선 없어야 하는데 ${called.join(',')} 를 불렀다`);
    } else {
      const miss = c.sinks.filter(s => !called.includes(s));
      if (miss.length) failWire.push(`${name}: 기대 «${miss.join(',')}» 가 «한 번도» 안 불렸다 (실제: ${called.join(',') || '없음'})`);
    }
  }
  assert.deepStrictEqual(failWire, [], '★배선 끊김 — 도구는 답하는데 아무도 안 부른다:\n  ' + failWire.join('\n  '));
  assert.deepStrictEqual(failOk, [], 'ok 계약 위반:\n  ' + failOk.join('\n  '));
  const wired = REGISTERED.filter(n => CASES[n].sinks.length);
  console.error(`  [셈] 도구 ${REGISTERED.length}개 · 배선 기대 ${wired.length}개(sink ${wired.reduce((a, n) => a + CASES[n].sinks.length, 0)}곳) 전부 «한 번 이상» 호출 확인 · ` +
              `배선 없는 게 옳은 도구 ${REGISTERED.length - wired.length}개`);
});

/* ── 디스패처 자체의 계약 ───────────────────────────────────────────── */
test('F3-3 토큰 없는 POST /mcp 는 401 이다 (헤더 게이트가 살아 있다)', async () => {
  const r = await H.post({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }, { token: null });
  assert.strictEqual(r.status, 401, `토큰 없이 ${r.status} — 인증 게이트가 사라졌다`);
  const bad = await H.call('get_canvas_state', {}, { headers: { 'x-goditor-token': 'not-the-token-'.padEnd(64, 'x') } });
  assert.strictEqual(bad.status, 401);
});

test('F3-4 없는 도구는 -32601 이다', async () => {
  const r = await H.call('no_such_tool_xyz', {});
  assert.ok(r.error, '없는 도구인데 오류가 없다');
  assert.strictEqual(r.error.code, -32601);
});

test('F3-5 ★직렬화 — 동시에 던진 편집이 «겹치지 않는다»(활성 캔버스는 한 번에 하나)', async () => {
  /* ⚠️이 검사는 «순서»가 아니라 «겹침»을 재야 한다.
     처음엔 호출 순서(seq 간격)로 쟀는데, 변이 스윕 M4(_serializeCall 제거)가 그대로 «초록»으로
     샜다 — 즉 그 검사는 직렬화를 안 재고 있었다(2026-09-07). 순서는 직렬화가 없어도 자주 맞는다.
     ⇒ 편집이 «실제로 시간을 쓰게» 만들고, 그 사이에 다른 편집이 «들어오는지»를 센다.
        직렬화가 살아 있으면 동시 진행 최대치가 1이다. */
  let inFlight = 0, peak = 0;
  const restore = H.setCanned('addTextBlock', async () => {
    peak = Math.max(peak, ++inFlight);
    await new Promise(r => setTimeout(r, 15));   // 편집이 «시간을 쓴다»
    inFlight--;
    return { ok: true };
  });
  try {
    H.reset();
    const N = 6;
    await Promise.all(Array.from({ length: N }, (_, i) => H.call('add_text_block', { content: `t${i}` })));
    assert.strictEqual(H.calls.filter(c => c.method === 'addTextBlock').length, N, '편집이 전부 도착하지 않았다');
    assert.strictEqual(peak, 1,
      `★동시에 편집 ${peak}건이 겹쳤다 — _serializeCall 이 사라졌다. ` +
      '겹치면 두 편집이 같은 렌더러를 동시에 만지고, 전환 중이면 곧 교체될 옛 문서에 떨어져 조용히 증발한다.');
    console.error(`  [실측] 동시 ${N}건 던짐 → 편집 동시진행 최대 ${peak}건(직렬화 정상 = 1)`);
  } finally { restore(); }
});

test('F3-6 tools/list 숨김이 유지된다 (별칭은 «부를 수 있되» 목록엔 없다)', async () => {
  const vis = new Set((await H.listTools(false)).map(t => t.name));
  const hidden = REGISTERED.filter(n => !vis.has(n));
  assert.strictEqual(vis.size, CONTRACT.counts.visible, `노출 도구 수 ${vis.size} ≠ 계약 ${CONTRACT.counts.visible}`);
  assert.strictEqual(hidden.length, CONTRACT.counts.hidden);
  // 숨김 = 제거가 아니다 — 별칭 하나를 실제로 불러 확인한다.
  const one = hidden.find(n => CASES[n] && CASES[n].sinks.length && !CASES[n].expectReject);
  const r = await H.call(one, CASES[one].args);
  assert.strictEqual(r.result && r.result.ok, true, `숨긴 별칭 ${one} 이 «호출 불가»가 됐다 — 숨김이 제거가 됐다`);
});
