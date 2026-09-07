/* mcp-update-section-guard.test.js — 「아무것도 안 하고 ok」를 막는 가드. (2026-09-07 신설, g-mcpmgr)
 *
 * ★무엇을 잡는가
 *   `update_section({sectionId, name:'새이름'})` 이 «아무 말 없이 성공»했다.
 *   name 은 핸들러 구조분해(`{sectionId, bg}`)에서 버려지고, bg 는 undefined 라 렌더러가 할 일이
 *   없는데, 「no fields to update」 가드가 «이 도구에만» 없어서 그대로 통과했다.
 *
 * ★결함의 «단위»는 함수가 아니라 «형제 패턴»이다 — 그래서 28개를 다 셌다.
 *   registerTool 된 update_* 28개 중 이 가드가 없던 것은 **update_section 하나**다(나머지 27개는 있다).
 *   ⚠️처음엔 2개로 셌는데 «틀렸다» — 'no fields to update' 라는 «문구»만 grep 했고,
 *     update_card_block 은 같은 가드를 'at least one field required' 로 쓴다.
 *     ⇒ ★문자열을 세고 «동작»을 셌다고 적으면 안 된다. F3-2 가 그 자리를 지킨다.
 *
 * ★왜 이게 중요한가 — §5-2(섹션 이름을 바꾸는 도구가 «없다»)와 «같은 뿌리»다.
 *   도구가 없다 → 클로드가 있는 도구에 name 을 넣어 본다 → 아무도 안 나무란다 → 「바꿨어요」라고 답한다.
 *   ⇒ 「기능 부재」가 «조용한 거짓 성공»으로 둔갑한다. 사용자는 영영 모른다.
 *
 * ⚠️`tests/contract/mcp-cases.js` 는 이 결함을 «정답»으로 굳혀 두고 있었다 —
 *   update_section 의 「성공하는 최소 인자」가 {sectionId, name:"새이름"} 이었다.
 *   ★검사가 결함을 지켜 주고 있었던 것이다. 그 줄도 같이 고쳤다(F3-3 이 그 자리를 지킨다).
 */
'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { startHarness } = require('./_mcp-harness');

let H = null;
before(async () => { H = await startHarness({ activeProject: 'proj_1' }); });
after(async () => { if (H) await H.stop(); });

/** 이 호출이 «렌더러까지 갔나». 안 갔으면 세상은 그대로다. */
const reached = (r) => (r.rendererCalls || []).some(c => c.method === 'updateSection');

/** 도구가 «무슨 말»을 했나 — 거절은 JSON-RPC error 로 온다(rawText 가 아니다).
 *  ⚠️처음에 rawText 만 보고 «응답이 빈 문자열»이라 헤맸다. 채널을 먼저 확인해라. */
const said = (r) => JSON.stringify(r.error || r.result || r.rawText || '');

test('G1 ★ {sectionId, name} 은 «거절»된다 — 예전엔 아무 말 없이 ok 였다', async () => {
  H.reset();
  const r = await H.call('update_section', { sectionId: 'sec_fixt_1', name: '새이름' });
  const err = said(r);

  console.error('  ┌─ update_section({sectionId, name}) ───────────────');
  console.error(`  │ 응답        : ${err.slice(0, 200)}`);
  console.error(`  │ 렌더러 도달 : ${reached(r)}`);
  console.error('  └──────────────────────────────────────────────────');

  assert.ok(/no fields to update/.test(err),
    `★거절되지 않았다 — 이게 「아무것도 안 하고 ok」다. 응답: ${err.slice(0, 300)}`);
  assert.ok(!reached(r),
    '거절인데 렌더러까지 갔다 — 부작용이 남는다');
});

test('G2 ★거절이 곧 «안내»여야 한다 — 안 그러면 클로드가 같은 자리를 돈다', async () => {
  H.reset();
  const r = await H.call('update_section', { sectionId: 'sec_fixt_1', name: 'x', title: 'y' });
  const err = said(r);

  // ⑴ 무엇을 «넣을 수 있는지»
  assert.ok(/at least one of: bg/.test(err), `쓸 수 있는 필드를 안 알려준다: ${err.slice(0, 300)}`);
  // ⑵ 무엇을 «받았는데 안 쓰는지» — 오타·환각 인자가 여기서 드러난다
  assert.ok(/name/.test(err) && /title/.test(err),
    `안 쓰는 인자를 이름으로 안 짚어준다: ${err.slice(0, 300)}`);
  // ⑶ ★무엇이 «아예 안 되는지» — 이게 없으면 title→label→heading 으로 갈아 끼우며 돈다
  assert.ok(/NOT settable via MCP/i.test(err),
    `「이름은 MCP 로 못 바꾼다」를 안 말해준다 — 순환이 안 끊긴다: ${err.slice(0, 300)}`);
});

test('G3 정상 호출은 여전히 «통과»한다 (반대방향 오탐 방지 — 경계는 양쪽을 다 잰다)', async () => {
  H.reset();
  const r = await H.call('update_section', { sectionId: 'sec_fixt_1', bg: '#ffffff' });
  const txt = said(r);
  assert.ok(!/no fields to update/.test(txt), `정상 호출이 막혔다: ${txt.slice(0, 300)}`);
  assert.ok(reached(r), '정상 호출인데 렌더러까지 안 갔다');
});

test('G4 bg 가 있으면 남는 인자가 있어도 통과한다 — 가드는 «빈 호출»만 막는다', async () => {
  H.reset();
  const r = await H.call('update_section', { sectionId: 'sec_fixt_1', bg: '#000', name: '무시됨' });
  const txt = said(r);
  assert.ok(!/no fields to update/.test(txt), `bg 가 있는데 막혔다: ${txt.slice(0, 300)}`);
  assert.ok(reached(r), 'bg 가 있는데 렌더러까지 안 갔다');
  // ⚠️여기서 name 은 «여전히» 조용히 버려진다. 그건 이 가드가 닫는 자리가 아니라
  //   스키마의 additionalProperties 부재(33/33)가 닫아야 할 자리다 — 별건으로 남긴다.
});

test('F3-2 ★형제 전수 — update_* 핸들러 중 «빈 호출 가드»가 없는 것은 0개여야 한다', () => {
  const src = fs.readFileSync(
    path.join(__dirname, '..', '..', 'main', 'claude-pm', 'mcp-server.js'), 'utf8');
  // ★«문구»가 아니라 «가드가 있나»로 본다. 실측 문구가 최소 두 가지다:
  //   'no fields to update — provide at least one of …'  /  'at least one field required (…)'
  const GUARD = /no fields to update|at least one[^\n]*(required|of)|hasAny|hasField|!has\b/;
  const marks = [...src.matchAll(/registerTool\(\s*'([a-z_0-9]+)'/g)];
  const missing = [];
  marks.forEach((m, i) => {
    const name = m[1];
    if (!name.startsWith('update_')) return;
    const end = i + 1 < marks.length ? marks[i + 1].index : src.length;
    const head = src.slice(m.index, end).split('\n').slice(0, 70).join('\n');
    if (!GUARD.test(head)) missing.push(name);
  });
  console.error(`  update_* 핸들러 ${marks.filter(m => m[1].startsWith('update_')).length}개 · 가드 없음 ${missing.length}개`);
  assert.deepStrictEqual(missing, [],
    `★빈 호출 가드가 없는 update_* 가 남아 있다 — 「아무것도 안 하고 ok」가 그 자리에 산다: ${missing.join(', ')}`);
});

test('F3-3 ★계약 픽스처가 결함을 «정답»으로 굳혀 두지 않았나', () => {
  const src = fs.readFileSync(
    path.join(__dirname, '..', 'contract', 'mcp-cases.js'), 'utf8');
  const line = src.split('\n').find(l => /^\s*update_section:/.test(l)) || '';
  console.error(`  픽스처: ${line.trim().slice(0, 120)}`);
  assert.ok(!/"name"/.test(line),
    '★계약 픽스처의 「성공하는 최소 인자」가 아직 name 이다 — 검사가 결함을 지켜 준다');
  assert.ok(/"bg"/.test(line),
    '픽스처가 실제로 «무언가를 바꾸는» 인자를 안 쓴다');
});
