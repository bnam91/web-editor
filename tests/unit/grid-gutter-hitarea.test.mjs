/* U-M64 — 낮은 배율에서 «행 거터»가 칸의 편집 진입을 삼킨다.
 *   실행: node --test "tests/unit/*.test.mjs"
 *   js/overlay-handles.js 에서 _rowGutterBand / _rowContentEdge 를 «원문 그대로» 잘라 돌린다.
 *
 * ★[M64] 미니4호기 윈도우 QA 보고 → 맥 재현(2026-09-06, 포트 9371 · 3열×4행 · 행높이 210px).
 *   ⛔보고서의 「거터가 21px 짜리 칸을 통째로 덮는다」는 «틀렸다». 실측하면 거터는 칸의 맨 위
 *     2.8px 만 덮는다. 문제는 «넓이»가 아니라 «자리»다 — 편집 표적은 칸이 아니라 그 안의
 *     글줄(`[data-line]`)이고, valign:top 이라 글줄은 칸 맨 위, 즉 거터가 파고드는 자리에 있다.
 *
 * [실측 — «진짜 더블클릭»(Input.dispatchMouseEvent clickCount 1→2), 12칸]
 *     배율      고치기 전            고친 뒤
 *      10%      편집진입 3/12        12/12      (거터 8.00px → 6.20px)
 *      13%      편집진입 3/12        12/12      (거터 8.00px → 7.09px)
 *      15%      12/12                12/12      (거터 8.00px 그대로)
 *      25%·40%  12/12                12/12      (거터 8.00px 그대로)
 *     ★0행은 고치기 전에도 10% 에서 들어갔다(3/12 의 그 3) — 0행 위엔 경계가 없다.
 *       「10% 라서 다 안 되는 것」이 아니라 «거터가 있는 행만» 막힌 것이라는 대조다.
 *     ★거터 잡기(행높이가 실제로 바뀌나)는 고친 뒤에도 10%·13%·25%·100% 전부 성공 —
 *       «보이는 경계선»을 눌러도, 거터 rect 중앙을 눌러도 잡힌다.
 *
 * ⛔이 검사는 「top 이 몇 px 인가」를 안 센다 — «글줄 중앙이 거터 밖에 있는가»(=편집 가능)와
 *   «거터가 잡을 만큼 두꺼운가»(=리사이즈 가능) 라는 «관찰 가능한 두 결과»로 잰다.
 *   구현을 바꿔도 이 두 계약은 그대로여야 한다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readSrc } from './_srcread.js';        // ★CRLF 체크아웃 방어(윈도우 core.autocrlf=true)
import { sliceBlock } from './_slice-block.js';   // ★구간 떠내기는 «공용 부품»(_slice-block.js) 하나로 — ⛔여기서 자를 새로 만들지 마라(끝은 «균형괄호»로 찾는다)

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const SRC = readSrc(ROOT, 'js/overlay-handles.js');

/** 최상위 함수를 «원문 그대로» 잘라낸다 — 끝은 «균형괄호»로 찾는다(0열 `}` 를 믿지 않는다). */
const sliceFn = (head) => sliceBlock(SRC, head, '검사가 옛 소스를 보고 있다');
/** `const NAME = <값>;` 한 줄을 원문에서 뽑는다 — 상수를 검사가 «베끼면» 갈라진다. */
function sliceConst(name) {
  const m = SRC.match(new RegExp(`^const ${name}\\s*=\\s*[^;]+;`, 'm'));
  assert.ok(m, `const ${name} 정의를 못 찾음 — 상수 이름이 바뀌었다`);
  return m[0];
}

const CONSTS = ['GUT_HALF_MAX', 'GUT_MIN_TOTAL', 'GUT_CONTENT_EPS', 'GUT_PROBE_H'];
const BAND_SRC = sliceFn('function _rowGutterBand(cy, upLimit, downLimit) {');
const EDGE_SRC = sliceFn('function _rowContentEdge(block, r, dir) {');

function load(bandSrc = BAND_SRC) {
  const src = [...CONSTS.map(sliceConst), bandSrc, EDGE_SRC].join('\n');
  return new Function(`${src}\nreturn { _rowGutterBand, _rowContentEdge, ${CONSTS.join(', ')} };`)();
}
const M = load();

/* ── 양성대조용 «옛 동작» — 경계 중앙에 ±4 로 고정(고치기 전 그대로) ──
 *   ⛔이걸 안 두면 이 파일은 «결함을 못 보는 검사»다. 아래 U-M64-2 가 실제로 빨간지 확인한다. */
const BAND_SRC_OLD = `function _rowGutterBand(cy, upLimit, downLimit) {
  return { top: cy - 4, height: 8 };
}
`;
const OLD = load(BAND_SRC_OLD);

/* ── 실측 기하(10% 배율, 행높이 210px, gap 24px, 글줄 35.2px) ──
 *   칸높이 21.00 · 글줄 3.52 · 칸 사이 간격 2.40 → 경계중앙 cy 는 아래 칸 위끝에서 1.20 위. */
const S = 0.1;
const CELL_H = 210 * S, LINE_H = 35.2 * S, GAP = 24 * S;
function geom(scale) {
  const cellH = 210 * scale, lineH = 35.2 * scale, gap = 24 * scale;
  const aTop = 100;                       // 위 칸 위끝(임의 기준점)
  const aBottom = aTop + cellH;
  const bTop = aBottom + gap;             // 아래 칸 위끝
  const cy = (aBottom + bTop) / 2;
  return {
    cy, cellH, lineH,
    upLineMid: aTop + lineH / 2,          // 위 칸 «첫/마지막» 글줄 중앙(valign:top → 맨 위)
    downLineMid: bTop + lineH / 2,        // 아래 칸 첫 글줄 중앙 ← 사용자가 노리는 점
  };
}

test('U-M64-0 ★하네스가 «의존 함수 전부»를 싣는다 — 안 실으면 검사가 조용히 거짓말한다', () => {
  /* 잘라 넣은 코드가 부르는 최상위 식별자를 «소스에서» 뽑아, 우리가 다 실었는지 기계가 센다.
     ⛔사람이 목록을 손으로 맞추는 규약은 반드시 갈라진다(U-GLOGIN-0 과 같은 이유). */
  const body = BAND_SRC + EDGE_SRC;
  const called = new Set([...body.matchAll(/\b(_[A-Za-z][A-Za-z0-9_]*)\s*\(/g)].map(m => m[1]));
  called.delete('_rowGutterBand'); called.delete('_rowContentEdge');
  const missingFns = [...called].filter(n => new RegExp(`function\\s+${n}\\s*\\(`).test(SRC));
  assert.deepEqual(missingFns, [],
    `잘라 넣은 코드가 부르는데 하네스가 «안 실은» 함수: ${missingFns.join(', ')}`);

  // 상수도 마찬가지 — 원문에 있는 GUT_* 를 다 실었나
  const usedConsts = new Set([...body.matchAll(/\b(GUT_[A-Z_]+)\b/g)].map(m => m[1]));
  const missingConsts = [...usedConsts].filter(n => !CONSTS.includes(n));
  assert.deepEqual(missingConsts, [], `안 실은 상수: ${missingConsts.join(', ')}`);

  for (const n of CONSTS) assert.equal(typeof M[n], 'number', `${n} 이 숫자가 아니다`);
});

test('U-M64-1 10% 에서 «아래 칸 글줄 중앙»이 거터 밖에 남는다 = 더블클릭이 편집으로 간다', () => {
  const g = geom(S);
  const band = M._rowGutterBand(g.cy, g.upLineMid + M.GUT_CONTENT_EPS, g.downLineMid - M.GUT_CONTENT_EPS);
  const bottom = band.top + band.height;
  assert.ok(bottom < g.downLineMid,
    `거터 아래끝 ${bottom.toFixed(2)} 가 글줄 중앙 ${g.downLineMid.toFixed(2)} 를 덮는다 — 편집 진입이 막힌다`);
  // 위 칸 글줄도 지킨다(대칭 계약)
  assert.ok(band.top > g.upLineMid, '거터 위끝이 위 칸 글줄 중앙을 덮는다');
});

test('U-M64-2 [양성대조] «옛 규칙(±4 고정)»이면 같은 기하에서 실제로 막힌다', () => {
  const g = geom(S);
  const band = OLD._rowGutterBand(g.cy, g.upLineMid + OLD.GUT_CONTENT_EPS, g.downLineMid - OLD.GUT_CONTENT_EPS);
  const bottom = band.top + band.height;
  assert.ok(bottom >= g.downLineMid,
    '양성대조가 «안 빨갛다» — 이 검사는 M64 를 못 보는 검사다. 기하(geom)나 대조군을 다시 봐라');
  // 실측과 대조: 옛 거터는 아래 칸 위끝에서 2.8px 까지 덮었고, 글줄 중앙은 1.76px 였다
  const bTop = g.cy + (24 * S) / 2;
  assert.ok(Math.abs((bottom - bTop) - 2.8) < 0.01, `옛 침범 깊이 실측 2.80px 과 다르다: ${(bottom - bTop).toFixed(2)}`);
  assert.ok(Math.abs((g.downLineMid - bTop) - 1.76) < 0.01, '글줄 중앙 실측 1.76px 과 다르다');
});

test('U-M64-3 그래도 «거터를 잡을 수 있다» — 최소 두께를 지킨다(무작정 줄이면 이번엔 이게 깨진다)', () => {
  const g = geom(S);
  const band = M._rowGutterBand(g.cy, g.upLineMid + M.GUT_CONTENT_EPS, g.downLineMid - M.GUT_CONTENT_EPS);
  assert.ok(band.height >= M.GUT_MIN_TOTAL,
    `거터가 ${band.height.toFixed(2)}px 로 얇아졌다 — ${M.GUT_MIN_TOTAL}px 미만이면 못 잡는다`);
  // ★«보이는 경계선»(cy)은 반드시 거터 안에 있어야 한다 — 사용자는 선을 보고 누른다
  assert.ok(band.top <= g.cy && g.cy <= band.top + band.height,
    '경계 중앙이 거터 밖이다 — 사용자가 보이는 선을 눌러도 안 잡힌다');
});

test('U-M64-4 높은 배율에선 «옛 동작 그대로» — 8px 가 경계에 중앙 정렬된다(회귀 0)', () => {
  for (const scale of [0.25, 0.4, 1]) {
    const g = geom(scale);
    const band = M._rowGutterBand(g.cy, g.upLineMid + M.GUT_CONTENT_EPS, g.downLineMid - M.GUT_CONTENT_EPS);
    assert.equal(band.height, M.GUT_HALF_MAX * 2, `배율 ${scale}: 두께가 8px 가 아니다`);
    assert.equal(band.top, g.cy - M.GUT_HALF_MAX, `배율 ${scale}: 중앙 정렬이 깨졌다`);
  }
  // 제약이 «아예 없을 때»(글줄 없는 칸)도 옛 동작
  const band = M._rowGutterBand(500, null, null);
  assert.deepEqual(band, { top: 496, height: 8 });
});

test('U-M64-5 양쪽 다 글줄이 경계에 붙으면 «잡기»가 이긴다 — 의도된 대가를 잠근다', () => {
  /* valign:bottom 위 칸 + valign:top 아래 칸처럼 양쪽이 다 꽉 찬 병리적 배치.
     이때는 거터가 글줄을 조금 덮는다 — 「거터를 아예 못 잡는다」보다 낫다는 판단이다.
     ⛔이건 «버그가 아니라 결정»이다. 바꾸려면 이 검사를 먼저 고쳐라. */
  const cy = 300;
  const band = M._rowGutterBand(cy, cy - 0.1, cy + 0.1);
  assert.ok(band.height >= M.GUT_MIN_TOTAL, '병리적 배치에서 거터가 잡을 수 없게 얇아졌다');
  assert.ok(band.height <= M.GUT_HALF_MAX * 2, '거터가 8px 보다 두꺼워졌다 — 상한이 깨졌다');
});

test('U-M64-6 _rowContentEdge 는 «열을 전부» 훑는다 — 한 열만 보면 다른 열이 계속 막힌다', () => {
  /* 가짜 블록: 3열, 아래 칸 첫 글줄의 top 이 열마다 다르다. 가장 «높은»(=작은 y) 것을 골라야
     그 열도 안 막힌다. 한 열만 보는 구현이면 이 검사가 빨개진다. */
  const mkLine = top => ({ getBoundingClientRect: () => ({ top, height: 4 }) });
  const mkCell = (r, tops) => ({
    dataset: { r: String(r) },
    querySelectorAll: () => tops.map(mkLine),
  });
  const cells = [mkCell(1, [200]), mkCell(1, [190]), mkCell(1, [210])];
  const block = {
    querySelector: sel => (sel.includes('grd-inner')
      ? { querySelectorAll: () => cells }
      : null),
  };
  const edge = M._rowContentEdge(block, 1, 'down');
  // 가장 위에 있는 글줄(190)의 중앙 192 에서 eps 를 뺀 값이어야 한다
  assert.equal(edge, 192 - M.GUT_CONTENT_EPS,
    `열 전체를 안 봤다 — 가장 «위» 글줄(190)이 기준이어야 한다. 나온 값: ${edge}`);

  const cellsUp = [mkCell(0, [100, 300]), mkCell(0, [100, 320])];
  const blockUp = { querySelector: () => ({ querySelectorAll: () => cellsUp }) };
  // 'up' 은 «마지막» 글줄 중, 가장 «아래»(큰 y) 것 → 322
  assert.equal(M._rowContentEdge(blockUp, 0, 'up'), 322 + M.GUT_CONTENT_EPS);

  // 글줄이 하나도 없으면 null(제약 없음) — 옛 동작으로 떨어진다
  const empty = { querySelector: () => ({ querySelectorAll: () => [] }) };
  assert.equal(M._rowContentEdge(empty, 0, 'down'), null);
});

test('U-M64-7 ★호출부가 실제로 이 띠를 쓴다 — 순수함수만 고치고 «안 꽂으면» 아무것도 안 바뀐다', () => {
  const i = SRC.indexOf('function _updateGridGutterPositions() {');
  assert.ok(i >= 0, '_updateGridGutterPositions 를 못 찾음');
  const body = sliceBlock(SRC, 'function _updateGridGutterPositions() {');
  const rowPart = body.slice(body.indexOf(`data-axis="row"`));
  assert.ok(/_rowGutterBand\(/.test(rowPart), '행 거터 갱신이 _rowGutterBand 를 «안 부른다»');
  assert.ok(/g\.style\.height\s*=\s*band\.height/.test(rowPart), '계산한 두께를 height 에 «안 쓴다»');
  assert.ok(/g\.style\.top\s*=\s*band\.top/.test(rowPart), '계산한 위치를 top 에 «안 쓴다»');
  // ⛔옛 하드코딩이 남아 있으면 안 된다
  assert.ok(!/\(cy - 4\)/.test(rowPart), '옛 `cy - 4` 하드코딩이 남아 있다');
  // 열 거터는 «안 건드렸다»는 것도 같이 잠근다(고칠 근거가 없던 축)
  const colPart = body.slice(body.indexOf(`data-axis="col"`), body.indexOf(`data-axis="row"`));
  assert.ok(/g\.style\.left\s*=\s*\(cx - 4\)/.test(colPart), '열 거터가 바뀌었다 — 이 변경의 범위 밖이다');
});
