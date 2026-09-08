/* gap-max-mcp-follows.test.js — 갭 높이 상한을 «MCP 도 따라가는가» (2026-09-09 실측)
 *
 * ★실측 사고: dev(ac9ce2b)가 렌더러 상한을 400 → 1000 으로 올리며
 *   `js/blocks/gap-limits.js` 라는 «단일 진실원»을 만들었다. 주석에 이렇게 적혀 있다:
 *     「400 이 «여섯 군데»에 흩어져 있었다 — … · MCP updateGapBlock 검증」
 *   ⇒ 그 여섯 중 «MCP 쪽»이 안 따라왔다. 실물에서 height=401 이 거부됐다:
 *       401 거부 · 1000 거부   (렌더러 window.GAP_MAX 는 1000 으로 서 있는데도)
 *   ⇒ 사용자는 패널에서 1000 을 넣는데 AI 는 못 넣는다.
 *
 * ⛔★「단일 진실원을 만들었다」와 「모두가 그걸 본다」는 다른 문장이다.
 *   그래서 이 검사는 «상수를 만들었나»가 아니라 «MCP 계약이 그 값과 같은가»를 잰다.
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { readSrc } = require('./_srcread.js');   // ⛔CRLF — win-portability ①-3

const ROOT = path.join(__dirname, '..', '..');
const LIM = readSrc(ROOT, 'js', 'blocks', 'gap-limits.js');
const MCP = readSrc(ROOT, 'main', 'claude-pm', 'mcp-server.js');
const BT  = readSrc(ROOT, 'main', 'claude-pm', 'mcp-block-tools.js');

/** 단일 진실원에서 «값을 읽어온다» — 손으로 1000 을 적지 않는다(그러면 두 벌이 된다) */
function limits() {
  const max = LIM.match(/export const GAP_MAX\s*=\s*(\d+)/);
  const min = LIM.match(/export const GAP_MIN\s*=\s*(\d+)/);
  assert.ok(max && min, '★gap-limits.js 에서 GAP_MIN/GAP_MAX 를 못 읽었다 — 정본이 사라졌거나 모양이 바뀌었다');
  return { min: Number(min[1]), max: Number(max[1]) };
}

test('G1 ★update_gap_block 스키마가 «정본 상한»과 같다', () => {
  const { min, max } = limits();
  const m = MCP.match(/height:\s*\{\s*type:\s*'integer',\s*minimum:\s*(\d+),\s*maximum:\s*(\d+),[^}]*style\.height/);
  assert.ok(m, '★update_gap_block 의 height 스키마를 못 찾았다');
  assert.equal(Number(m[2]), max,
    `★MCP 상한 ${m[2]} ≠ 정본 ${max} — 렌더러는 받는데 AI 는 거부당한다(실측: 401 거부)`);
  assert.equal(Number(m[1]), min, `★MCP 하한 ${m[1]} ≠ 정본 ${min}`);
});

test('G2 ★«설명 문장»도 같은 값을 말한다 — 계약이 두 말을 하면 안 된다', () => {
  const { max } = limits();
  /* 스키마 숫자만 고치고 description 을 두면 AI 는 «문장»을 읽고 400 을 안 넘긴다.
     오늘 이 팀이 겪은 「동작만 고치고 계약을 남기면 계약이 거짓말한다」와 같은 자리. */
  const stale = [...MCP.matchAll(/[Gg]ap height in px \((\d+)[–-](\d+)\)/g)]
    .filter(m => Number(m[2]) !== max);
  assert.deepEqual(stale.map(m => m[0]), [],
    `★설명이 아직 옛 상한을 말한다(정본 ${max}): ${stale.map(m => m[0]).join(' · ')}`);
});

test('G3 ★인라인 스펙(add_block 이 매 대화에 싣는 줄)도 같다', () => {
  const { max } = limits();
  const m = BT.match(/'gap\(gb_\): height:(\d+)-(\d+)'/);
  assert.ok(m, '★인라인 스펙에서 gap 줄을 못 찾았다');
  assert.equal(Number(m[2]), max,
    `★인라인 스펙 ${m[2]} ≠ 정본 ${max} — 이 줄은 «매 대화»에 실려서 AI 가 제일 먼저 읽는다`);
});

test('G0 ★★«집행하는» 자리가 정본을 따른다 — 스키마는 «설명»이고 이 함수가 «막는다»', () => {
  /* ⛔실측(2026-09-09): 스키마 maximum 을 1000 으로 고쳤는데도 401 이 거부됐다.
       응답 문구 `height > 400` 을 따라가니 _validateGapOpts 의 `_int('height', 0, 400)` 이었다.
     ★스키마를 고치고 「고쳤다」고 넘어갈 뻔한 자리다 — 이 검사가 그때 «초록»이었다.
       G1~G3 이 전부 «계약 문서»만 보고 있었고, «집행»은 아무도 안 보고 있었다.
     ⇒ 계약과 집행을 «따로» 잰다. 둘 중 하나만 맞으면 그건 못 고친 것이다. */
  const { min, max } = limits();
  /* ⚠️`_int('height', …)` 는 파일에 «여덟 자리»가 있다(배너·프레임·오버레이·캔버스…).
       첫 판은 그냥 첫 히트를 잡아 «엉뚱한 상한»을 재고 빨개졌다 — 「못 잰 것」이었다.
     ⇒ _validateGapOpts «함수 안»으로 범위를 좁혀서 잰다. */
  const fi = MCP.indexOf('function _validateGapOpts');
  assert.ok(fi > 0, '★_validateGapOpts 가 없다 — 갭 검증기가 사라졌거나 이름이 바뀌었다');
  const body = MCP.slice(fi, MCP.indexOf('\n}\n', fi));
  const m = body.match(/_int\('height',\s*(\d+),\s*(\d+)\)/);
  assert.ok(m, '★_validateGapOpts 안에서 height 집행을 못 찾았다');
  assert.equal(Number(m[2]), max,
    `★집행 상한 ${m[2]} ≠ 정본 ${max} — 스키마가 1000 이라 말해도 여기서 막는다(실측: "height > ${m[2]}")`);
  assert.equal(Number(m[1]), min, `★집행 하한 ${m[1]} ≠ 정본 ${min}`);
});

test('G4 ⛔손으로 400 을 다시 박아두지 않았다 (갭 문맥에서)', () => {
  /* 정본이 바뀌어도 남아 있으면 다음 사람이 그걸 보고 되돌린다.
     ⚠️400 은 다른 뜻으로도 쓰인다(글자 크기·프레임 gap) — 그래서 «갭블럭 문맥»만 본다. */
  const bad = MCP.split('\n')
    .map((l, i) => [i + 1, l])
    .filter(([, l]) => /400/.test(l) && /[Gg]ap height|gap-block|gb_/.test(l));
  assert.deepEqual(bad.map(([n, l]) => `${n}: ${l.trim().slice(0, 60)}`), [],
    '★갭블럭 문맥에 400 이 남아 있다');
});
