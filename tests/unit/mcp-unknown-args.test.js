/* mcp-unknown-args.test.js — «스키마에 없는 인자»를 조용히 버리지 않는다. (2026-09-07 g-mcpmgr)
 *
 * ★배경 — 도구 33/33(노출 기준)이 inputSchema 에 additionalProperties 를 «안» 걸어 뒀고,
 *   핸들러는 구조분해로 받아 나머지를 말없이 버린다. 오타·환각 인자가 사라지고 ok 가 돌아간다.
 *   양성대조: 필수 인자를 빼면 18/18 제대로 거절한다 ⇒ 서버는 «검사할 줄 안다, 안 하는 것뿐»이다.
 *
 * ★왜 «거절»이 아니라 «경고»로 시작하나 — 세어 봤기 때문이다(「없을 것이다」로 넘기지 않았다).
 *   계약 픽스처 84건 중 스키마에 없는 인자를 주는 호출이 3건이었고, 그중 하나
 *   (`update_text_block {text}`)는 **핸들러가 실제로 «먹는»** 선언 안 된 별칭이다.
 *   ⇒ 지금 STRICT 로 켜면 오늘 도는 호출이 깨진다. T5 가 그 사실을 «검사로» 붙들어 둔다.
 *
 * ★그리고 더 큰 이유: 인자 단위 «원장»이 없었다. 브리지 로그는 `params { metadata: undefined }` 라
 *   무슨 인자가 왔는지 아무 데도 안 남아 「실제 트래픽에 몇 건이냐」를 «셀 수가 없었다».
 *   ⇒ 이 장치가 그 원장을 만든다. 원장이 쌓여야 STRICT 전환을 «근거로» 결정할 수 있다.
 */
'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { startHarness } = require('./_mcp-harness');
const { CASES } = require('../contract/mcp-cases.js');

let H = null;
before(async () => { H = await startHarness({ activeProject: 'proj_1' }); });
after(async () => { if (H) await H.stop(); });

const said = (r) => JSON.stringify(r.error || r.result || r.rawText || '');

test('T1 ★경고 — 없는 인자는 «조용히» 버려지지 않는다 (기본 동작)', async () => {
  H.reset();
  const r = await H.call('list_projects', { limit: 1, zzz_bogus: 'x', alsoBogus: 1 });
  const res = r.result;

  console.error('  ┌─ list_projects({limit, zzz_bogus, alsoBogus}) ────');
  console.error(`  │ warnings : ${JSON.stringify(res && res.warnings)}`);
  console.error('  └──────────────────────────────────────────────────');

  assert.ok(res && Array.isArray(res.warnings), `경고가 «없다» — 조용히 버려졌다: ${said(r).slice(0, 200)}`);
  const w = res.warnings.join(' ');
  assert.ok(/zzz_bogus/.test(w) && /alsoBogus/.test(w), `버린 인자를 «이름으로» 안 짚는다: ${w}`);
  assert.ok(/accepts only/.test(w), `무엇을 넣을 수 있는지 안 알려준다: ${w}`);
  assert.ok(/NO effect/.test(w), `「효과가 없었다」를 안 말해준다: ${w}`);
});

test('T2 ★깨끗한 호출엔 «아무것도 안 붙는다» (응답 모양을 안 바꾼다 — 반대방향)', async () => {
  H.reset();
  const r = await H.call('list_projects', { limit: 1 });
  assert.ok(r.result && r.result.warnings === undefined,
    `인자가 깨끗한데 warnings 가 붙었다 — 다른 측정을 오염시킨다: ${said(r).slice(0, 200)}`);
});

test('T3 ★경고는 «호출을 막지 않는다» — 기존 동작이 그대로 돈다 (반대방향)', async () => {
  H.reset();
  const clean = await H.call('get_canvas_state', {});
  H.reset();
  const dirty = await H.call('get_canvas_state', { zzz_bogus: 'x' });
  const strip = (o) => { const { warnings, ...rest } = (o || {}); return JSON.stringify(rest); };
  assert.strictEqual(strip(dirty.result), strip(clean.result),
    '★없는 인자 하나에 응답 «내용»이 달라졌다 — 경고는 부작용이 없어야 한다');
  assert.ok((dirty.result || {}).warnings, '더러운 호출에 경고가 안 붙었다');
});

test('T4 ★STRICT 로 켜면 «거절»하고, 거절이 곧 «안내»다', async () => {
  // ★스위치를 «호출 시점»에 읽으므로 프로세스를 새로 띄우지 않고 잰다.
  const prev = process.env.GODITOR_MCP_STRICT_ARGS;
  process.env.GODITOR_MCP_STRICT_ARGS = '1';
  try {
    H.reset();
    const r = await H.call('list_projects', { limit: 1, zzz_bogus: 'x' });
    const txt = JSON.stringify(r.error || r.result || '');
    console.error(`  STRICT 응답: ${txt.slice(0, 220)}`);
    assert.ok(/UNKNOWN_ARGS/.test(txt), `STRICT 인데 거절 안 했다: ${txt.slice(0, 300)}`);
    assert.ok(/zzz_bogus/.test(txt), '⑵ 받았는데 안 쓰는 것을 이름으로 안 짚는다');
    assert.ok(/accepts only/.test(txt), '⑴ 넣을 수 있는 것을 안 알려준다');
    assert.ok(/do not retry with a renamed variant/.test(txt),
      '⑶ 「이름만 바꿔 다시 시도하지 마라」가 없다 — 클로드가 같은 자리를 돈다');
  } finally {
    if (prev === undefined) delete process.env.GODITOR_MCP_STRICT_ARGS;
    else process.env.GODITOR_MCP_STRICT_ARGS = prev;
  }
});

test('T5 ★★STRICT 를 지금 켜면 «무엇이 깨지나» — 세고 나서 결정한다', async () => {
  const tools = await H.listTools(true);
  const declared = new Map(tools.map(t => [t.name, Object.keys((t.inputSchema && t.inputSchema.properties) || {})]));
  const breaks = [];
  for (const [name, c] of Object.entries(CASES)) {
    const props = declared.get(name);
    if (!props) continue;
    const unknown = Object.keys(c.args || {}).filter(a => !props.includes(a));
    if (unknown.length) breaks.push(`${name}{${unknown.join(',')}}`);
  }
  console.error(`\n  ■ 계약 픽스처 ${Object.keys(CASES).length}건 중 STRICT 로 «깨질» 호출 = ${breaks.length}건`);
  breaks.forEach(b => console.error(`     ⛔ ${b}`));
  console.error('  ⇒ 0 이 될 때까지 STRICT 로 켜지 마라. 0 이 되면 이 검사가 그때를 «알려준다».\n');

  // ★이 검사는 「깨질 게 없어야 한다」가 아니라 「몇 건인지 «알고 있어야» 한다」를 지킨다.
  //   숫자가 바뀌면 빨강이 나서, 누군가 조용히 늘리거나 줄인 것을 알게 된다.
  const KNOWN = ['update_card_block{cards}', 'update_scratch_item{name}', 'update_text_block{text}'];
  assert.deepStrictEqual(breaks.sort(), KNOWN.sort(),
    '★STRICT 로 깨질 호출 목록이 달라졌다 — 늘었으면 STRICT 가 더 멀어진 것이고, '
    + '줄었으면 누가 고친 것이다. 어느 쪽이든 «알고» 넘어가라.');
});

test('T6 ★선언 안 된 «별칭»이 실재한다 — 스키마가 거짓말한다', async () => {
  // update_text_block 스키마는 content 만 말하는데 핸들러는 text 도 «먹는다».
  // ⇒ 「스키마에 없다」와 「핸들러가 안 쓴다」는 «다른 사실»이다. STRICT 전에 이걸 먼저 갈라야 한다.
  H.reset();
  const byText = await H.call('update_text_block', { blockId: 'tb_fx_h1', text: 'x' });
  const reachedText = (byText.rendererCalls || []).some(c => c.method === 'editTextBlock');
  H.reset();
  const byContent = await H.call('update_text_block', { blockId: 'tb_fx_h1', content: 'x' });
  const reachedContent = (byContent.rendererCalls || []).some(c => c.method === 'editTextBlock');

  console.error(`  text→editTextBlock=${reachedText} · content→editTextBlock=${reachedContent}`);
  assert.ok(reachedContent, '스키마가 말하는 이름(content)이 안 먹는다면 그건 더 큰 문제다');
  assert.ok(reachedText,
    'text 가 이제 안 먹는다면 이 항목은 해소된 것이다 — T5 의 KNOWN 목록과 이 검사를 같이 지워라');
  assert.ok((byText.result || {}).warnings,
    '★스키마에 없으니 경고는 나와야 한다 — 「먹는다」와 「선언됐다」는 다른 사실이다');
});

test('T7 ★★원장이 «실제로 디스크에» 써진다 — 빈 catch 가 삼키고 있지 않나', async () => {
  // ⛔`_recordUnknownArgs` 는 실패를 통째로 삼킨다(원장 실패가 도구를 막으면 안 되므로).
  //   그러면 «안 써지는데 아무도 모르는» 상태가 된다 — 오늘 이 팀이 계속 잡는 그 모양이다.
  //   ⇒ 「썼다」를 rc 로 믿지 않고 «파일»로 잰다.
  // ★그리고 내가 이걸 손으로 확인하려다 두 번 속았다:
  //   ⑴ 이 맥의 find(bfs)는 `-newermt` 를 «안 받는다» — 2>/dev/null 이 그 에러를 삼켜 「0건」이 됐다.
  //   ⑵ 하네스 tmp 는 프로세스 종료 시 지워진다 — 사후 탐색으론 «영영» 못 본다.
  //   ⇒ 그래서 판정을 «검사 안»으로 옮겼다. 이게 그 교훈의 코드 형태다.
  const ledger = path.join(H.userData, 'claude-pm', 'unknown-args.jsonl');
  try { fs.unlinkSync(ledger); } catch (_) {}

  H.reset();
  await H.call('list_projects', { limit: 1, zzz_bogus: 'v', another_bogus: 2 });

  assert.ok(fs.existsSync(ledger), `★원장이 «안» 써졌다 — 빈 catch 가 삼켰다: ${ledger}`);
  const lines = fs.readFileSync(ledger, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
  console.error(`  원장 ${lines.length}줄 · 마지막: ${JSON.stringify(lines[lines.length - 1])}`);
  const last = lines[lines.length - 1];
  assert.strictEqual(last.tool, 'list_projects');
  assert.deepStrictEqual(last.unknown.sort(), ['another_bogus', 'zzz_bogus']);
  assert.ok(last.at && last.argKeys, '시각·인자이름이 없다 — 나중에 못 센다');

  // ★★값은 «안» 적혀야 한다 — 원장에 PII·본문이 새면 안 된다. 이름만으로 세는 데 충분하다.
  const raw = fs.readFileSync(ledger, 'utf8');
  assert.ok(!/"v"/.test(raw) && !raw.includes(':2,') ,
    `★원장에 인자 «값»이 새어 들어갔다 — 이름만 적어야 한다: ${raw.slice(0, 300)}`);
});
