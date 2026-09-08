/* ★tools/list 에 «무엇이 오르나» — 토큰 고정비를 지키는 검사. (2026-09-08)
 *
 * 왜 생겼나 (실제 사고):
 *   banner 의 죽은 add 경로를 끊으려고 `add: null` 로 바꿨다. 그런데 숨김 루프가
 *   `for (const n of [d.add, d.upd])` 라 null 을 건너뛰어 **hide() 가 안 불렸고**,
 *   죽은 도구 `add_banner_block` 이 tools/list 에 «올라왔다»(visible 40 → 41).
 *   ⇒ 목록에 오르면 모델이 직접 부르고 → 무조건 거절당하고 → 왕복을 버린다.
 *     없애려던 낭비가 «다른 문»에서 다시 열린 것이다.
 *   ⛔계약 스냅샷이 숫자를 들고 있었는데도 «40→41 을 아무도 안 물었다» — 지디가 눈으로 대조해 잡았다.
 *
 * 그래서 이 파일이 지키는 것:
 *   ⑴ 끊은 경로(add:null)의 옛 도구는 «절대» 목록에 안 오른다
 *   ⑵ 노출 도구 수가 «늘면» 빨개진다 — 도구가 느는 건 대화마다 드는 토큰이 느는 것이다
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { readSrc } = require('./_srcread.js');   // ⛔CRLF — win-portability ①-3

const ROOT = path.join(__dirname, '..', '..');
const CONTRACT = JSON.parse(readSrc(ROOT, 'tests', 'contract', 'mcp-tools.contract.json'));
const BT = readSrc(ROOT, 'main', 'claude-pm', 'mcp-block-tools.js');

/* ★이 수를 «손으로» 올리는 순간이 곧 「토큰 고정비를 올린다」고 결정하는 순간이다.
     자동으로 따라가게 두면 검사가 아니라 «기록»이 된다. */
/* 40 → 41 (2026-09-08): edit_variation 하나를 늘렸다. «결정»으로 적는다.
     왜: A/B 베리에이션을 «읽기»만 되고 만들지·바꾸지·확정하지 못했다(현빈 지시로 쓰기까지).
     ⛔다섯 도구로 쪼개지 않고 op 하나로 모았다 — 쪼갰으면 고정비가 5칸 늘었다. */
const EXPECTED_VISIBLE = 41;

test('T1 ★노출 도구 수가 늘지 않았다 — 늘리려면 «여기서 한 번 멈춰라»', () => {
  const v = CONTRACT.counts.visible;
  assert.equal(v, EXPECTED_VISIBLE,
    `★tools/list 노출 도구가 ${EXPECTED_VISIBLE} → ${v} 로 변했다.\n` +
    '  도구 하나는 대화마다 드는 «고정비»다(실측: 40개 ≈ 10,100 토큰, 평균 941자/도구).\n' +
    '  늘릴 이유가 있으면 EXPECTED_VISIBLE 을 고치고 «왜 늘렸는지»를 커밋에 적어라.\n' +
    '  줄었다면 무엇이 숨겨졌는지 확인해라 — 살아있는 도구가 숨으면 기능이 사라진 것이다.');
});

test('T1b ★★스냅샷이 «라이브»와 같은지 — 안 재면 이 검사는 «기록»일 뿐이다', async () => {
  /* ⛔2026-09-08 실측 사고: 도구를 하나 늘렸는데 T1 이 «통과»했다.
       T1 은 스냅샷 파일의 숫자만 읽는데, 스냅샷을 «안 갱신하면» 옛 숫자가 그대로라서다.
       ⇒ 「손으로 멈춰 서라」던 문은 «갱신을 안 하면» 저절로 열려 있었다.
     ★그래서 «진짜 서버»를 세운다. 스냅샷이 낡으면 여기서 빨개진다. */
  const { startHarness } = require('./_mcp-harness');
  const h = await startHarness();
  try {
    const names = (await h.listTools()).map(t => t.name).sort();
    assert.equal(names.length, EXPECTED_VISIBLE,
      `★라이브 노출 ${names.length} ≠ 기대 ${EXPECTED_VISIBLE}. 도구를 늘렸거나 줄였다 — 여기서 «한 번 멈춰라».`);
    assert.equal(CONTRACT.counts.visible, names.length,
      `★스냅샷(${CONTRACT.counts.visible})이 라이브(${names.length})와 다르다 — ` +
      'node tools/mcp-contract-snapshot.mjs 로 갱신하고, «수가 변한 이유»를 커밋에 적어라.');
    /* ⛔★«수»만 세면 «바꿔치기»를 못 잡는다 — 실측(2026-09-08): 도구 이름을 바꾸는 변이를 넣었더니
         하나 사라지고 하나 생겨 41 그대로라 «살아남았다». 도구가 통째로 딴것이 돼도 초록이다.
       ⇒ 이름 «집합»으로 잰다. 무엇이 사라지고 무엇이 생겼는지까지 말한다. */
    /* ⚠️CONTRACT.tools 는 «배열이 아니라 객체»다(도구명 → {hidden, mutating, …}).
         첫 판은 배열로 알고 잘라서 빈 목록이 됐다 — 그러면 대조가 «조용히» 안 돈다.
       ⇒ 노출된 것만(hidden !== true) 골라 이름을 뽑는다. */
    const snap = Object.entries(CONTRACT.tools || {})
      .filter(([, v]) => v && v.hidden !== true).map(([k]) => k).sort();
    assert.equal(snap.length, names.length,
      `★스냅샷의 «노출» 도구 수(${snap.length})가 라이브(${names.length})와 다르다`);
    {
      const gone = snap.filter(n => !names.includes(n));
      const born = names.filter(n => !snap.includes(n));
      assert.deepEqual({ gone, born }, { gone: [], born: [] },
        `★노출 도구가 «바꿔치기»됐다 — 수는 같은데 목록이 다르다.\n` +
        `  사라진 것: ${gone.join(', ') || '(없음)'}\n  생긴 것: ${born.join(', ') || '(없음)'}`);
    }
  } finally { await h.stop(); }
});

test('T2 ★끊은 경로(add:null)의 «옛 도구»는 목록에 없다', () => {
  /* BLOCK_TYPES 에서 add:null + addLegacy 를 가진 항목을 소스에서 읽는다 */
  const re = /\{\s*type:\s*'([^']+)',\s*add:\s*null,\s*addLegacy:\s*'([^']+)'/g;
  const pairs = [...BT.matchAll(re)].map(m => ({ type: m[1], legacy: m[2] }));
  assert.ok(pairs.length >= 1,
    '★add:null + addLegacy 쌍을 하나도 못 찾았다 — 패턴이 썩었거나 끊은 경로가 없다(그럼 이 검사는 장식이다)');
  for (const p of pairs) {
    const t = CONTRACT.tools[p.legacy];
    assert.ok(t, `${p.legacy} 가 계약에 없다 — 도구가 사라졌나`);
    assert.equal(t.hidden, true,
      `★${p.legacy} 가 목록에 올라와 있다. type "${p.type}" 은 add 를 끊었는데 옛 도구가 노출되면\n` +
      '  모델이 그걸 직접 부르고 거절당해 왕복을 버린다 — 끊은 의미가 없어진다.');
  }
});

test('T3 살아있는 대안은 «부를 수 있다» — 숨김이 기능 삭제가 되면 안 된다', () => {
  /* banner 를 끊었으면 banner02 로는 만들 수 있어야 한다.
     ⛔숨김(hidden)은 «목록 미노출»이지 «호출 불가»가 아니다 — 그 구분을 여기서 지킨다. */
  assert.ok(CONTRACT.tools['add_banner02_block'], 'banner02 add 도구가 아예 없다');
  assert.match(BT, /type: 'banner02', add: 'add_banner02_block'/,
    'banner02 가 통합 도구(add_block)로 만들 수 있게 등록돼 있어야 한다');
});

test('T4 ★변이대조 — addLegacy 를 빼면 T2 가 빨개진다', () => {
  const mutated = BT.replace(/addLegacy: '[^']+',\s*/g, '');
  const re = /\{\s*type:\s*'([^']+)',\s*add:\s*null,\s*addLegacy:\s*'([^']+)'/g;
  assert.equal([...mutated.matchAll(re)].length, 0,
    '변이가 안 먹었다 = T2 는 이 배선을 «안» 본다');
});
