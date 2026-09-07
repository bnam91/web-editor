/* mcp-response-budget.test.js — F4 «응답 크기 예산 + 금지 문자열». (2026-09-07 신설, U0)
 *
 * ★왜: 도구 «출력»도 사용자 토큰이다. 그리고 이 앱의 캔버스는 인라인 base64 이미지를 물고 있어
 *   실측 39,041,257자·85MB 까지 간다. 어떤 경로로도 그게 응답에 실리면 부르는 쪽 대화가 한 번에
 *   날아간다. 「지금은 안 샌다」는 «오늘의 사실»이지 보장이 아니다 — 여기서 종료코드로 묶는다.
 *
 * ⑴ 금지 문자열 `base64,` 가 응답에 «0건»                     ← 새는 경로가 생기면 즉시 빨강
 * ⑵ 크기 예산(바이트)                                          ← 기준선은 «커밋과 같이» 적는다
 * ⑶ 자동 summary 폴백이 살아 있다(큰 페이지가 통째로 안 나온다)
 * ⑷ ★«거절» 경로도 잰다(F4-8) — 아래 「두 경로」 참고
 *
 * ── ★왜 «두 경로»를 따로 재나 (2026-09-07, 프로젝트 게이트 caf8045 병합 뒤) ──
 *   게이트가 들어오면서 쓰기 도구 71개가 「대상 확정 전」엔 «거절 페이로드»를 돌려준다.
 *   거절문은 회복 절차(다음 수)를 실어야 해서 «길다» — 성공 응답 11 B 대 거절 715 B.
 *   ⇒ 한 예산으로 묶으면 둘 중 하나가 거짓말이 된다: 느슨하게 잡으면 성공 경로가 부어도
 *      안 잡히고, 빡빡하게 잡으면 «설계대로 동작하는» 거절이 빨강이 된다.
 *   ⇒ 예산을 «둘로» 나눈다. 그리고 ★거절 경로에도 base64 금지를 건다 —
 *      put_image 의 거절문이 인자로 받은 dataURL 을 되읊으면 그게 제일 큰 유출구다.
 *      (F4-7 은 «성공» 경로만 훑는다 — 그 구멍을 F4-8 이 막는다.)
 *
 * ★검사가 «자극 있는» 검사인 근거: F6 픽스처는 사진 3장 중 2장이 «인라인 dataURL» 이다
 *   (small-b 3,400B · big 400,000B). DOM 쪽엔 base64 가 실제로 «있는데» 응답엔 0건이어야 참이다.
 *   자극이 없으면 이 검사는 아무것도 증명하지 않는다.
 *
 * ── 기준선 (⛔맨숫자 금지 — 커밋·픽스처와 «같이» 적는다) ──
 *   @6dc2385 · F6 픽스처(섹션 2 · 블록 10)
 *     get_canvas_state(blocks)      1,223 B
 *     get_canvas_state(summary)       284 B
 *     read_section(sec_fixt_1)        818 B
 *     read_project(기본=목차)         442 B   ← 프로젝트 원본엔 base64 20,000자가 있다
 *     update_block                     11 B   ← ★«성공» 경로
 *     put_image                        78 B   ← 입력 dataURL 50,022자, «성공» 경로
 *   ★거절 경로는 «따로» 잰다(F4-8) — 게이트 도구 70개, 709~867 B @ caf8045
 *     (확정이 «깨진» 거절은 previouslyConfirmed/note 가 더 붙어 조금 더 길다)
 *   상한은 기준선의 «2배 + 여유»로 둔다 — 조금씩 붓는 것을 잡되 사소한 문구 변경엔 안 터진다.
 */
'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { startHarness } = require('./_mcp-harness');
const { canvasFixture, fixtureBlockIds, FIXTURE_SECTION_IDS } = require('./_mcp-canned');
const CONTRACT = require('../contract/mcp-tools.contract.json');

/** 예산(바이트). 「사실상 무한」이 아니라 «지금 값의 2배 언저리». */
const BUDGET = {
  get_canvas_state_blocks: 3000,
  get_canvas_state_summary: 600,
  read_section: 1800,
  read_project: 800,
  update_block: 200,
  put_image: 400,
};
/** 거절 경로 예산 — 실측 709~743 B(게이트 도구 70개) 기준, 여유를 두되 «무한»은 아니다. */
const REFUSAL_BUDGET = 1600;

let H = null;
before(async () => { H = await startHarness({ activeProject: 'proj_1' }); });
after(async () => { if (H) await H.stop(); });

/** 응답 원문에 절대 있으면 안 되는 것. */
function assertNoBase64(name, raw) {
  const n = (raw.match(/base64,/g) || []).length;
  assert.strictEqual(n, 0,
    `★${name} 응답에 «base64,» 가 ${n}건 샜다 — 이미지 원문이 대화로 흘러들어간다.\n` +
    `  응답 ${raw.length}자 중 첫 발견 위치 ${raw.indexOf('base64,')}`);
}

test('F4-0 픽스처에 base64 가 «실제로» 있다 (자극 없는 초록 방지)', () => {
  const fs = require('fs'), path = require('path');
  const { FIXTURE_DIR } = require('./_mcp-canned');
  const html = fs.readFileSync(path.join(FIXTURE_DIR, 'canvas.html'), 'utf8');
  const n = (html.match(/base64,/g) || []).length;
  assert.ok(n >= 2, `픽스처 DOM 의 base64 가 ${n}건 — 2건 이상이어야 이 파일의 다른 검사가 «자극 있는» 검사가 된다`);
  console.error(`  [자극] 픽스처 DOM 안 base64 ${n}건 · 그중 하나는 400,000B 사진`);
});

test('F4-1 get_canvas_state(blocks) — base64 0건 + 예산 안 + ★블록이 «하나도» 안 빠진다', async () => {
  const r = await H.call('get_canvas_state', {});
  assertNoBase64('get_canvas_state', r.rawText);
  assert.ok(r.bytes <= BUDGET.get_canvas_state_blocks,
    `${r.bytes}B > 예산 ${BUDGET.get_canvas_state_blocks}B — 응답이 부었다`);

  /* ★#1 결함(2026-09-06) 재발 방지: _slimCanvasState 의 «고정 허용목록»이 이미지·표·갭의
     summary 를 조용히 버려, 블록은 «보이는데» 지목할 정보만 없는 «반쯤 고쳐진» 상태가 났다. */
  const got = r.result.sections.flatMap(s => s.blocks.map(b => b.blockId));
  assert.deepStrictEqual(got, fixtureBlockIds(),
    '★블록이 빠졌다 — 텍스트 아닌 블록(이미지·표·갭·프레임)이 조용히 사라지는 그 결함이다');
  const byId = Object.fromEntries(r.result.sections.flatMap(s => s.blocks).map(b => [b.blockId, b]));
  for (const id of ['ab_fx_small_a', 'tbl_fx_1', 'gb_fx_1']) {
    assert.ok(byId[id] && byId[id].summary && Object.keys(byId[id].summary).length,
      `${id} 의 summary 가 사라졌다 — 허용목록이 새 필드를 또 버렸다`);
  }
  console.error(`  [실측] get_canvas_state(blocks) ${r.bytes}B · 블록 ${got.length}개 · base64 0건`);
});

test('F4-2 get_canvas_state(summary) 는 «더 싸다»', async () => {
  const s = await H.call('get_canvas_state', { detail: 'summary' });
  const b = await H.call('get_canvas_state', {});
  assertNoBase64('get_canvas_state(summary)', s.rawText);
  assert.ok(s.bytes < b.bytes, `summary(${s.bytes}B) 가 blocks(${b.bytes}B) 보다 안 싸다 — 폴백의 뜻이 없다`);
  assert.ok(s.bytes <= BUDGET.get_canvas_state_summary, `${s.bytes}B > 예산 ${BUDGET.get_canvas_state_summary}B`);
  console.error(`  [실측] summary ${s.bytes}B < blocks ${b.bytes}B`);
});

test('F4-3 ★큰 페이지는 detail 을 안 줘도 «자동으로» summary 로 내려간다', async () => {
  /* 자동 폴백(_CANVAS_AUTO_SUMMARY_CHARS)이 사라지면 85MB 캔버스가 통째로 나간다.
     상한을 «넘기는» 가짜 캔버스를 만들어 실제로 폴백이 도는지 본다. */
  const cap = CONTRACT.sizeCaps._CANVAS_AUTO_SUMMARY_CHARS;
  const huge = { ok: true, sections: [{ sectionId: 'sec_big', name: '큰페이지',
    blocks: Array.from({ length: 400 }, (_, i) => ({ blockId: `tb_big_${i}`, type: 'body', text: 'x'.repeat(110) })) }] };
  const restore = H.setCanned('getCanvasState', async () => huge);
  try {
    const r = await H.call('get_canvas_state', {});
    assert.strictEqual(r.result.detail, 'summary', `자동 폴백이 안 돌았다 — ${r.bytes}B 를 그대로 뱉었다(상한 ${cap}자)`);
    assert.ok(/too large/.test(r.result.note || ''), '폴백했는데 «왜»를 안 알려준다');
    assert.ok(r.bytes < 2000, `폴백했는데도 ${r.bytes}B`);
    console.error(`  [실측] 400블록(≈${JSON.stringify(huge).length}자) → 자동 summary ${r.bytes}B (상한 ${cap}자)`);
  } finally { restore(); }
});

test('F4-4 read_section — base64 0건 + 예산 안', async () => {
  const r = await H.call('read_section', { sectionId: FIXTURE_SECTION_IDS[0] });
  assertNoBase64('read_section', r.rawText);
  assert.strictEqual(r.result.ok, true);
  assert.ok(r.bytes <= BUDGET.read_section, `${r.bytes}B > 예산 ${BUDGET.read_section}B`);
  console.error(`  [실측] read_section ${r.bytes}B`);
});

test('F4-5 read_project 기본은 «목차»다 — 캔버스 원문(그리고 base64)이 안 실린다', async () => {
  /* pages[].canvas 에 인라인 base64 를 «실제로» 넣어 둔 프로젝트로 잰다 — 자극 없는 초록 방지. */
  const dataUrl = 'data:image/png;base64,' + 'A'.repeat(20000);
  H.seedProject('proj_1', { id: 'proj_1', name: 'fixture',
    pages: [{ id: 'pg_1', name: 'p1', canvas: `<div id="canvas"><img src="${dataUrl}"></div>` }] });
  const r = await H.call('read_project', {});
  assertNoBase64('read_project', r.rawText);
  assert.strictEqual(r.result.truncated, true, '기본이 «목차»가 아니다 — 캔버스 원문이 나간다');
  assert.ok(r.bytes <= BUDGET.read_project, `${r.bytes}B > 예산 ${BUDGET.read_project}B`);
  console.error(`  [실측] read_project ${r.bytes}B (프로젝트 원본엔 base64 20,000자가 있다)`);
});

test('F4-6 update_block · put_image 응답이 작고 base64 를 안 되돌린다', async () => {
  const u = await H.call('update_block', { blockId: 'tb_fx_h1', props: { text: '새 제목' } });
  assertNoBase64('update_block', u.rawText);
  assert.ok(u.bytes <= BUDGET.update_block, `update_block ${u.bytes}B > ${BUDGET.update_block}B`);

  /* ★put_image 는 «인자로» dataURL 을 받는 도구다 — 되돌려 주기 제일 쉬운 자리다. */
  const img = 'data:image/png;base64,' + 'B'.repeat(50000);
  const p = await H.call('put_image', { image: img });
  assertNoBase64('put_image', p.rawText);
  assert.ok(p.bytes <= BUDGET.put_image, `put_image ${p.bytes}B > ${BUDGET.put_image}B — 인자를 되돌려 주고 있다`);
  console.error(`  [실측] update_block ${u.bytes}B · put_image ${p.bytes}B (입력 dataURL 은 50,022자)`);
});

test('F4-7 ★도구 «전수» 응답에 base64 가 0건이다', async () => {
  const { CASES } = require('../contract/mcp-cases');
  const leaks = [];
  for (const [name, c] of Object.entries(CASES)) {
    for (const [sn, sa] of (c.setup || [])) await H.call(sn, sa);
    const r = await H.call(name, c.args);
    if ((r.rawText.match(/base64,/g) || []).length) leaks.push(`${name}(${r.bytes}B)`);
  }
  assert.deepStrictEqual(leaks, [], `base64 를 되돌려 준 도구: ${leaks.join(' ')}`);
  console.error(`  [셈] 도구 ${Object.keys(CASES).length}개 전수 · base64 유출 0건`);
});

test('F4-8 ★«거절» 경로 예산 — 게이트 거절문은 길어도 되지만 무한하지 않고, base64 를 되읊지 않는다', async (t) => {
  /* ⚠️게이트(feat/mcp-project-gate)가 없는 트리에서도 이 파일은 돈다 — 병합 순서 때문이다.
     없는 것을 빨강으로 내지 않고 «소리내어» 건너뛴다(skip 은 통과가 아니다, 로그에 남는다). */
  if (!CONTRACT.counts.gated) return t.skip('게이트가 이 트리에 없다 — 계약 counts.gated=0');
  /* ⚠️확정 «안 한» 하네스가 필요하다 — 한 프로세스에 하네스는 하나라, 여기선 지금 하네스의
     확정을 «깨서» 거절 상태를 만든다(사람이 앱에서 다른 프로젝트를 연 것과 같은 경로). */
  const { CASES } = require('../contract/mcp-cases');
  H.seedProject('proj_9');
  H.setActiveProject('proj_9');   // sticky 깨짐 → 이후 쓰기는 전부 거절

  const over = [], leaks = [];
  let n = 0, max = 0, maxName = null;
  for (const [name, c] of Object.entries(CASES)) {
    if (CONTRACT.tools[name].targetFree || c.expectReject) continue;
    const r = await H.call(name, c.args);
    // 이 자리에서 «거절이 맞는지»는 F3-7 이 본다. 여기서는 «크기»만 잰다.
    if (r.result && r.result.ok === false) {
      n++;
      if (r.bytes > max) { max = r.bytes; maxName = name; }
      if (r.bytes > REFUSAL_BUDGET) over.push(`${name} ${r.bytes}B`);
      if ((r.rawText.match(/base64,/g) || []).length) leaks.push(name);
    }
  }
  assert.ok(n >= 50, `거절 경로를 ${n}개밖에 못 쟀다 — 게이트가 안 걸렸다(자극 없는 초록)`);
  assert.deepStrictEqual(leaks, [],
    `★거절문이 base64 를 되읊었다: ${leaks.join(' ')} — 인자로 받은 dataURL 을 에코하고 있다`);
  assert.deepStrictEqual(over, [], `거절 예산 ${REFUSAL_BUDGET}B 초과: ${over.join(' ')}`);
  console.error(`  [실측] 거절 경로 ${n}개 · 최대 ${max}B(${maxName}) · 예산 ${REFUSAL_BUDGET}B · base64 0건`);

  H.setActiveProject('proj_1');   // 원복 — 뒤에 오는 검사가 있을 수 있다
  await H.confirmTarget('proj_1');
});
