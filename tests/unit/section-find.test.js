/* P1·P2 — 「어느 섹션인지 찾는」 문제. (2026-09-08 현빈 요청)
 *
 * ★이 파일은 «소스 문자열»이 아니라 «응답»으로 잰다 — 가짜 렌더러에 실제 모양의
 *   섹션을 물려 놓고, 도구가 돌려주는 값을 본다. 그래야 「배선은 있는데 효과가 0」을 잡는다.
 *
 * 실측 근거(끌리젠 102섹션):
 *   P1 전 = 목록 미리보기가 «102줄 전부 (gap)» → 어느 섹션이 뭔지 알 수가 없었다.
 *   P1 후 = (gap) 1개(진짜 여백만 있는 섹션)·글자 없는 섹션 8개, 나머지는 첫 글자가 나온다.
 *   P2 = 102섹션 319블록을 한 번에 3~6ms 로 훑는다(이전엔 왕복 102번).
 */
'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { startHarness } = require('./_mcp-harness');

let H;
before(async () => { H = await startHarness(); });
after(async () => { await H.stop(); });

/* 실물과 같은 모양: 섹션은 «여백»으로 시작한다. 그게 P1 이 존재하는 이유다. */
const SECTIONS = () => ([
  { sectionId: 'sec_a', name: 'Section 01', blocks: [
      { blockId: 'gb_1', type: 'gap', summary: { height: '200px' } },
      { blockId: 'tb_1', type: 'h1', text: '끌리젠 보풀제거기는' },
      { blockId: 'tb_2', type: 'body', text: '무료 배송 -3,000원' },
  ]},
  { sectionId: 'sec_b', name: '가격표', blocks: [
      { blockId: 'gb_2', type: 'gap', summary: { height: '80px' } },
      { blockId: 'tbl_1', type: 'table', summary: { text: '총 할인 -35,100원' } },
  ]},
  { sectionId: 'sec_c', name: 'Section 03', blocks: [
      { blockId: 'gb_3', type: 'gap', summary: { height: '80px' } },
      { blockId: 'ss_1', type: 'frame' },
  ]},
  { sectionId: 'sec_d', name: 'Section 04', blocks: [
      { blockId: 'gb_4', type: 'gap', summary: { height: '40px' } },
  ]},
]);

/* ── P1 ─────────────────────────────────────────────────────────────── */

test('P1-0 ★양성대조 — 검사 자료가 «여백으로 시작»한다(그래야 이 검사가 뜻이 있다)', () => {
  assert.equal(SECTIONS()[0].blocks[0].type, 'gap',
    '자료가 여백으로 시작하지 않으면 P1 은 아무것도 증명하지 못한다');
});

test('P1-1 목록 미리보기는 «첫 글자»다 — 첫 블록이 여백이어도 글자가 나온다', async () => {
  H.setCanned('getCanvasState', async () => ({ ok: true, sections: SECTIONS() }));
  const r = await H.call('get_canvas_state', { detail: 'summary' });
  const secs = r.result.sections;
  const by = Object.fromEntries(secs.map(s => [s.sectionId, s.first]));
  assert.equal(by.sec_a, '끌리젠 보풀제거기는',
    '★여백을 건너뛰고 첫 글자를 보여줘야 한다 — 이게 안 되면 목록이 전부 (gap) 이 된다');
  assert.equal(by.sec_b, '총 할인 -35,100원',
    '표·이미지처럼 text 가 없는 블록도 summary.text 를 들고 있다 — 그것도 봐야 한다');
});

test('P1-2 글자가 «정말» 없으면 무슨 블록인지 말한다 — 여백이라고 답하지 않는다', async () => {
  H.setCanned('getCanvasState', async () => ({ ok: true, sections: SECTIONS() }));
  const secs = (await H.call('get_canvas_state', { detail: 'summary' })).result.sections;
  const by = Object.fromEntries(secs.map(s => [s.sectionId, s.first]));
  assert.equal(by.sec_c, '(frame)', '여백 말고 «내용을 담는» 블록을 골라 말해야 한다');
  assert.equal(by.sec_d, '(gap)', '진짜로 여백뿐이면 그때는 (gap) 이 정직한 답이다');
});

test('P1-3 ★변이대조 — 「첫 블록」으로 되돌리면 P1-1 이 빨개진다', async () => {
  /* 옛 동작을 손으로 재현: blocks[0] 만 본다 */
  const old = (blocks) => String((blocks[0] || {}).text || ('(' + ((blocks[0] || {}).type || 'block') + ')'));
  assert.equal(old(SECTIONS()[0].blocks), '(gap)',
    '옛 방식이 (gap) 을 내놓지 않으면 이 검사는 «없는 병»을 지키는 것이다');
});

/* ── P2 ─────────────────────────────────────────────────────────────── */

test('P2-1 search_sections 가 «어느 섹션·어느 블록»을 돌려준다', async () => {
  H.setCanned('searchSections', async ({ query }) => ({
    ok: true, query, matches: 1, scannedSections: 4, scannedBlocks: 5, truncated: false,
    hits: [{ sectionId: 'sec_a', sectionName: 'Section 01', blockId: 'tb_2',
             type: 'body', where: 'block', excerpt: '…무료 배송 -3,000원…' }],
  }));
  const r = await H.call('search_sections', { query: '무료' });
  assert.equal(r.result.ok, true);
  const h = r.result.hits[0];
  assert.equal(h.blockId, 'tb_2', 'blockId 를 줘야 곧바로 update_block 에 넣을 수 있다');
  assert.equal(h.sectionId, 'sec_a');
});

test('P2-2 ★「0건」과 「못 뒤졌다」를 가른다 — 뒤진 수를 같이 준다', async () => {
  H.setCanned('searchSections', async ({ query }) => ({
    ok: true, query, matches: 0, hits: [], scannedSections: 102, scannedBlocks: 319, truncated: false,
  }));
  const r = await H.call('search_sections', { query: 'ZZZ없는말ZZZ' });
  assert.equal(r.result.matches, 0);
  assert.equal(r.result.scannedSections, 102,
    '★0건인데 «몇 개를 뒤졌는지»가 없으면, 「없다」인지 「못 쟀다」인지 구분이 안 된다');
});

test('P2-3 빈 검색어는 «거절»한다 — 전부 걸리는 검색은 검색이 아니다', async () => {
  const r = await H.call('search_sections', { query: '   ' });
  assert.ok(r.error || (r.result && r.result.ok === false), '빈 검색어가 통과했다');
});

test('P2-4 읽기 전용이라 «대상 지목» 게이트에 안 걸린다', async () => {
  H.setCanned('searchSections', async () => ({ ok: true, matches: 0, hits: [],
    scannedSections: 0, scannedBlocks: 0 }));
  const r = await H.call('search_sections', { query: 'x' });
  assert.ok(!r.error, `읽기 전용 도구가 게이트에 걸렸다: ${JSON.stringify(r.error || {}).slice(0,120)}`);
  assert.notEqual(r.result && r.result.code, 'PROJECT_NOT_CONFIRMED');
});
