/* mcp-two-ends.test.js — F7 «양끝 계측». (2026-09-07 신설, U0)
 *
 * ★왜 «따로» 재는가 (2026-09-06 실측 사고):
 *   「렌더러가 보냈다」와 「도구가 돌려줬다」는 «다른 사실»이다.
 *   canvas-state 가 이미지·표·갭의 summary 를 실어 보내는데 mcp-server.js 의
 *   _slimCanvasState «고정 허용목록»이 그걸 조용히 버렸다. 그 결과 블록은 «보이는데»
 *   지목에 필요한 정보만 없는 «반쯤 고쳐진» 상태가 났다 — 한쪽 끝만 재면 초록이 난다.
 *
 * ⇒ 이 파일은 두 끝의 «키 집합»을 나란히 찍고, 뒤쪽이 앞쪽을 «조용히» 줄였으면 빨강을 낸다.
 *   ★버리는 것 자체는 죄가 아니다(다이어트는 설계다). 죄는 «말 없이» 버리는 것이다 —
 *     그래서 허용된 축약은 ALLOWED_DROPS 에 «이유와 함께» 적어야만 통과한다.
 */
'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { startHarness } = require('./_mcp-harness');

/** 도구 응답에서 «떨어져도 되는» 필드 — 이유 없이 늘리지 마라. */
const ALLOWED_DROPS = {
  // 빈 스타일 필드는 정보 0에 블록당 ~45자다(2026-08-25 다이어트). 값이 «빈» 것만 떨어진다.
  color: '빈 값일 때만 — 응답 다이어트',
  fontSize: '빈 값일 때만 — 응답 다이어트',
  align: '빈 값일 때만 — 응답 다이어트',
  text: '빈 값일 때만 — 응답 다이어트',
  name: '섹션 이름이 빈 문자열일 때만',
};

let H = null;
before(async () => { H = await startHarness({ activeProject: 'proj_1' }); });
after(async () => { if (H) await H.stop(); });

/** 두 끝을 찍는다. 앞끝 = 가짜 렌더러가 «돌려준» 값. 뒤끝 = HTTP 로 «나간» 값. */
async function twoEnds(tool, args) {
  H.reset();
  const r = await H.call(tool, args);
  const rc = H.calls.find(c => c.method === 'getCanvasState');
  assert.ok(rc, `${tool} 이 getCanvasState 를 안 불렀다 — 양끝을 잴 수 없다`);
  return { rendererEnd: rc.result, toolEnd: r.result, bytes: r.bytes, raw: r.rawText };
}

const blocksOf = (st) => (st.sections || []).flatMap(s => s.blocks || []);

test('F7-1 ★양끝 — 렌더러가 보낸 블록이 도구 응답에서 «하나도» 안 사라진다', async () => {
  const { rendererEnd, toolEnd, bytes } = await twoEnds('get_canvas_state', {});
  const a = blocksOf(rendererEnd).map(b => b.blockId);
  const b = blocksOf(toolEnd).map(b => b.blockId);

  console.error('  ┌─ 양끝 (get_canvas_state) ────────────────────────');
  console.error(`  │ 렌더러가 보냈다 : 섹션 ${(rendererEnd.sections || []).length} · 블록 ${a.length} · ${JSON.stringify(rendererEnd).length}자`);
  console.error(`  │ 도구가 돌려줬다 : 섹션 ${(toolEnd.sections || []).length} · 블록 ${b.length} · ${bytes}B`);
  console.error('  └──────────────────────────────────────────────────');

  assert.deepStrictEqual(b, a, `★블록이 두 끝 사이에서 사라졌다 — 사라진 것: ${a.filter(x => !b.includes(x)).join(' ')}`);
});

test('F7-2 ★양끝 — 값이 «있는» 필드는 두 끝 사이에서 안 없어진다 (허용목록이 새 필드를 조용히 버리는 병)', async () => {
  const { rendererEnd, toolEnd } = await twoEnds('get_canvas_state', {});
  const rb = Object.fromEntries(blocksOf(rendererEnd).map(b => [b.blockId, b]));
  const tb = Object.fromEntries(blocksOf(toolEnd).map(b => [b.blockId, b]));

  const rows = [], illegal = [];
  for (const [id, src] of Object.entries(rb)) {
    const dst = tb[id] || {};
    const dropped = Object.keys(src).filter(k => !(k in dst));
    // 값이 «비어 있어서» 떨어진 것은 설계된 다이어트다. 값이 «있는데» 떨어진 것만 죄다.
    const silent = dropped.filter(k => {
      const v = src[k];
      const empty = v === '' || v == null || (typeof v === 'object' && !Object.keys(v).length);
      if (empty) return false;
      return !(k in ALLOWED_DROPS);
    });
    rows.push(`${id.padEnd(18)} 렌더러[${Object.keys(src).join(',')}] → 도구[${Object.keys(dst).join(',')}]${dropped.length ? '  버림:' + dropped.join(',') : ''}`);
    if (silent.length) illegal.push(`${id}: «값이 있는데» 버려진 필드 ${silent.join(',')}`);
  }
  console.error('  ┌─ 양끝 키 집합 (블록별) ──────────────────────────');
  rows.forEach(r => console.error('  │ ' + r));
  console.error('  └──────────────────────────────────────────────────');
  assert.deepStrictEqual(illegal, [],
    '★두 끝 사이에서 «조용히» 사라진 필드:\n  ' + illegal.join('\n  ') +
    '\n  → _slimCanvasState 의 허용목록을 보라. 의도한 축약이면 ALLOWED_DROPS 에 «이유와 함께» 적어라.');
});

test('F7-3 ★양끝 — summary(이미지·표·갭)가 도구 끝까지 «살아서» 온다', async () => {
  const { rendererEnd, toolEnd } = await twoEnds('get_canvas_state', {});
  const rb = Object.fromEntries(blocksOf(rendererEnd).map(b => [b.blockId, b]));
  const tb = Object.fromEntries(blocksOf(toolEnd).map(b => [b.blockId, b]));
  const lost = [];
  for (const [id, src] of Object.entries(rb)) {
    if (!src.summary || !Object.keys(src.summary).length) continue;
    const d = tb[id] && tb[id].summary;
    if (!d || JSON.stringify(d) !== JSON.stringify(src.summary)) lost.push(`${id}: ${JSON.stringify(src.summary)} → ${JSON.stringify(d)}`);
  }
  assert.deepStrictEqual(lost, [], '★summary 가 두 끝 사이에서 바뀌거나 사라졌다 (#1 결함 재발):\n  ' + lost.join('\n  '));
  const n = Object.values(rb).filter(b => b.summary && Object.keys(b.summary).length).length;
  assert.ok(n >= 4, `summary 를 가진 블록이 ${n}개뿐 — 픽스처가 이 검사를 «자극»하지 못한다`);
  console.error(`  [셈] summary 보유 블록 ${n}개 전부 두 끝 일치`);
});

test('F7-4 ★양끝 — read_section 도 같은 잣대로 잰다 (경로가 다르면 결과도 다르다)', async () => {
  const { rendererEnd, toolEnd, bytes } = await twoEnds('read_section', { sectionId: 'sec_fixt_1' });
  const a = blocksOf(rendererEnd).map(b => b.blockId);
  const b = (toolEnd.section.blocks || []).map(x => x.blockId);
  console.error(`  ┌─ 양끝 (read_section sec_fixt_1) ─────────────────`);
  console.error(`  │ 렌더러가 보냈다 : 블록 ${a.length}`);
  console.error(`  │ 도구가 돌려줬다 : 블록 ${b.length} · texts ${toolEnd.texts.length}개 · ${bytes}B`);
  console.error('  └──────────────────────────────────────────────────');
  assert.deepStrictEqual(b, a, '★read_section 이 블록을 잃었다');
  /* ⚠️read_section 은 _slimCanvasState 를 «안» 탄다 — 즉 다이어트가 없다.
     그래서 이 경로로는 원문이 그대로 나갈 수 있다. 그 사실을 검사로 못박아 둔다. */
  assert.ok(blocksOf(rendererEnd).every(x => JSON.stringify(toolEnd.section.blocks.find(y => y.blockId === x.blockId)) === JSON.stringify(x)),
    'read_section 이 조용히 축약하기 시작했다 — 다이어트를 넣었으면 F4 예산과 이 검사를 «같이» 고쳐라');
});

test('F7-5 ★양끝 — 도구가 «렌더러가 안 준 것»을 지어내지 않는다', async () => {
  const { rendererEnd, toolEnd } = await twoEnds('get_canvas_state', {});
  const rIds = new Set(blocksOf(rendererEnd).map(b => b.blockId));
  const invented = blocksOf(toolEnd).map(b => b.blockId).filter(id => !rIds.has(id));
  assert.deepStrictEqual(invented, [], `★도구가 «없는» 블록을 만들어냈다: ${invented.join(' ')}`);
});
