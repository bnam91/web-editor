/* grid-cell-border-edges — 1013t2F 「모든 칸 테두리」의 «선 자리»(cellBorderEdges) — 값 · 화면 · 겹침 · 바이트 무변.
 * 실행: node --test tests/unit/grid-cell-border-edges.test.js   ·  라이브 userData 무접촉.
 *
 * ★현빈 지적(원문): 「구분선 스타일의 경우, 블럭외곽선 옵션이 들어가있는거니? 윗변과 칼럼로우 중간 구분선들 말야,
 *   이거 우측패널에서 이걸로 조절이 안되네??」 — 프로토는 그 선을 proto/z3.css 가 «고정»했다.
 *   제품은 선을 «데이터»(cellBorderEdges + cellBorder 세 키)에서 렌더한다. 이 파일은 그 «데이터 → 칸 style» 을 칸별로 잰다.
 *   (패널 단추 → 선 생김/사라짐의 computed border 는 DOM spec tests/dom/grid-ifg-preset-lines.dom.spec.js 가 잰다.)
 *
 *   E0  ★바이트 무변 — 키 없는 그리드 3종의 innerHTML·dataset·style 이 366fd826 판 출력(고정 픽스처)과 «문자열 동일»
 *   E1  정규화·거절 — 'vsep,top'→'top,vsep' · [] → 'none' · null/'box' → 키 지움 · 'left'/'TOP' 거절(dataset 무변)
 *   E2  2×2 간격0 top,vsep — 칸별 네 변 표
 *   E3  top 만 / vsep 만 / none
 *   E4  겹침 — 외곽선 위 변 + 배경 꺼짐 → 첫 행 칸 위 변 0 · 배경 켬 → 그대로
 *   E5  고치는 문 — null 로 지움 · RENDER_ERROR 롤백에 edges 포함 · 만드는 문 opts
 *   E5b 줄 marginTop:'auto'(D2 ⓐ) — 'auto' 면 margin-top:auto · 숫자는 옛 식
 *   E7  소스 가드 — renderGridBlock 이 칸에서 읽는 것(pick/cell.)이 366fd826 과 같다(P7 명부 오염 없음)
 *   E8  ★음성대조(파일 안 변이) — edges 갈래 제거 → E2 빨강 · `c > 0`→`c >= 0` → (0,0) 왼쪽 빨강 · 겹침 false 고정 → E4 빨강
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { REPO, GRID_RAW, loadGrid, cellStyle, sides, FIX } = require('./_grid-ifg-harness.js');

const BASE = JSON.parse(fs.readFileSync(path.join(REPO, 'tests/fixtures/grid-cell-border-edges-366fd826.json'), 'utf8'));
const ALL = [[0, 0], [0, 1], [1, 0], [1, 1]];

/* ⛔이 장면들은 픽스처를 «만든» 스크립트와 글자 그대로 같은 조작이다 — 바꾸면 E0 이 빨개진다(그게 맞다: 픽스처는 옛 판 출력이다). */
function shot(b) { return { html: b.innerHTML, ds: { ...b.dataset }, style: { ...b.style } }; }
function scenes(M) {
  const out = {};
  { const { block } = M.makeGridBlock(FIX()); out.plain = shot(block); }
  { const { block } = M.makeGridBlock(FIX()); M.updateGridBlock(block.id, { gap: 0 });
    M.updateGridBlock(block.id, { cellBorderWidth: 1, cellBorderColor: '#333333', cellBorderStyle: 'solid' }); out.box1 = shot(block); }
  { const { block } = M.makeGridBlock(FIX(true)); M.updateGridBlock(block.id, { gap: 12 });
    M.updateGridBlock(block.id, { cellBorderWidth: 2, cellBorderColor: '#123456', cellBorderStyle: 'dashed' });
    M.updateGridBlock(block.id, { blockOutline: 'top,bottom' }); M.updateGridBlock(block.id, { colRuleOn: '1', rowRuleOn: '1' }); out.mix = shot(block); }
  return out;
}

const L1 = '1px solid #b3b1ae';
async function linesGrid(M, edges, extra = {}) {
  const { block } = M.makeGridBlock(FIX());
  M.updateGridBlock(block.id, { gap: 0 });
  const r = M.updateGridBlock(block.id, { cellBorderWidth: 1, cellBorderColor: '#b3b1ae', cellBorderStyle: 'solid', cellBorderEdges: edges, ...extra });
  assert.equal(r.ok, true, `★판을 못 깔았다 — ${r.code}: ${r.message}`);
  return block;
}
const table = (block) => Object.fromEntries(ALL.map(([r, c]) => [`${r}${c}`, sides(cellStyle(block, r, c))]));

/* ══ E0 ══════════════════════════════════════════════════════════════════ */
test('E0 ★바이트 무변 — 키 없는 그리드 3종이 366fd826 판 출력(고정 픽스처)과 문자열 동일', async () => {
  /* 전제 — 픽스처가 «선이 있는 판»을 실제로 담고 있다(빈 픽스처면 아래 동일이 아무것도 안 잰다). */
  assert.ok(BASE.box1.html.includes('border-right:1px solid #333333'), '★전제: 픽스처 box1 에 네 변 선이 없다');
  assert.ok(BASE.mix.html.includes('grd-crule') && BASE.mix.style.borderTop === '2px dashed #123456', '★전제: 픽스처 mix 에 괘선·외곽선이 없다');
  assert.ok(BASE.mix.html.includes('margin-top:12px;'), '★전제: 픽스처 mix 에 숫자 marginTop 이 없다');
  const { G } = await loadGrid();
  const now = scenes(G);
  for (const k of ['plain', 'box1', 'mix']) {
    assert.equal(now[k].html, BASE[k].html, `★${k}: innerHTML 바이트가 366fd826 판과 다르다`);
    assert.deepEqual(now[k].ds, BASE[k].ds, `★${k}: dataset 이 366fd826 판과 다르다`);
    assert.deepEqual(now[k].style, BASE[k].style, `★${k}: 블럭 style 이 366fd826 판과 다르다`);
    assert.equal(now[k].ds.cellBorderEdges, undefined, `★${k}: 안 준 cellBorderEdges 가 생겼다`);
    assert.equal(now[k].ds.ifgPreset, undefined, `★${k}: 안 준 ifgPreset 이 생겼다`);
  }
});

/* ══ E1 ══════════════════════════════════════════════════════════════════ */
test('E1 정규화·거절 — 정본 꼴로 저장 · 모르는 낱말은 INVALID 이고 dataset 무변', async () => {
  const { G } = await loadGrid();
  const { block } = G.makeGridBlock(FIX());
  const ok = [
    ['vsep,top', 'top,vsep'], [['top'], 'top'], [' vsep ', 'vsep'], ['top,top', 'top'],
    ['', 'none'], ['none', 'none'], [[], 'none'],
  ];
  for (const [inV, want] of ok) {
    const r = G.updateGridBlock(block.id, { cellBorderEdges: inV });
    assert.equal(r.ok, true, `★${JSON.stringify(inV)} 를 거절했다 — ${r.message}`);
    assert.equal(r.applied.cellBorderEdges, want, `★applied ${JSON.stringify(inV)}`);
    assert.equal(block.dataset.cellBorderEdges, want, `★dataset ${JSON.stringify(inV)}`);
  }
  for (const del of [null, 'box']) {
    G.updateGridBlock(block.id, { cellBorderEdges: 'top' });
    const r = G.updateGridBlock(block.id, { cellBorderEdges: del });
    assert.equal(r.ok, true, `★${JSON.stringify(del)} 를 거절했다`);
    assert.equal(r.applied.cellBorderEdges, null);
    assert.equal(block.dataset.cellBorderEdges, undefined, `★${JSON.stringify(del)} 가 키를 안 지웠다`);
  }
  G.updateGridBlock(block.id, { cellBorderEdges: 'top,vsep' });
  const snap = JSON.stringify({ ...block.dataset });
  for (const bad of ['left', 'TOP', 'top,bottom', ['top', 'x'], 'all']) {
    const r = G.updateGridBlock(block.id, { cellBorderEdges: bad });
    assert.equal(r.ok, false, `★${JSON.stringify(bad)} 를 받았다`);
    assert.equal(r.code, 'INVALID');
    assert.equal(JSON.stringify({ ...block.dataset }), snap, `★${JSON.stringify(bad)} — ok:false 인데 dataset 이 변했다`);
  }
  /* 표식 — basic|lines|null 만 */
  assert.equal(G.updateGridBlock(block.id, { ifgPreset: 'lines' }).ok, true);
  assert.equal(block.dataset.ifgPreset, 'lines');
  assert.equal(G.updateGridBlock(block.id, { ifgPreset: 'constructor' }).ok, false);
  assert.equal(block.dataset.ifgPreset, 'lines');
  assert.equal(G.updateGridBlock(block.id, { ifgPreset: null }).ok, true);
  assert.equal(block.dataset.ifgPreset, undefined);
});

/* ══ E2·E3 ═══════════════════════════════════════════════════════════════ */
test('E2 ★2×2 간격0 top,vsep — 칸별 네 변(그림 ②: 행 사이·열 사이만. 1017t1i3 — 블럭 맨 위는 칸이 안 긋는다)', async () => {
  const { G } = await loadGrid();
  const t = table(await linesGrid(G, 'top,vsep'));
  assert.deepEqual(t, {
    '00': { top: '0', left: '0', right: '0', bottom: '0' },
    '01': { top: '0', left: L1, right: '0', bottom: '0' },
    '10': { top: L1, left: '0', right: '0', bottom: '0' },
    '11': { top: L1, left: L1, right: '0', bottom: '0' },
  });
});

test('E3 top 만 / vsep 만 / none — 켠 자리만 선, 나머지 0(1017t1i3 — top 은 r>0 에만)', async () => {
  const { G } = await loadGrid();
  const tTop = table(await linesGrid(G, 'top'));
  assert.deepEqual(tTop['00'], { top: '0', left: '0', right: '0', bottom: '0' }, `★top 만 00(블럭 맨 위 — 칸은 안 긋는다)`);
  assert.deepEqual(tTop['01'], { top: '0', left: '0', right: '0', bottom: '0' }, `★top 만 01`);
  assert.deepEqual(tTop['10'], { top: L1, left: '0', right: '0', bottom: '0' }, `★top 만 10(행 사이)`);
  assert.deepEqual(tTop['11'], { top: L1, left: '0', right: '0', bottom: '0' }, `★top 만 11`);
  const tV = table(await linesGrid(G, 'vsep'));
  assert.deepEqual(tV['00'], { top: '0', left: '0', right: '0', bottom: '0' });
  assert.deepEqual(tV['01'], { top: '0', left: L1, right: '0', bottom: '0' });
  assert.deepEqual(tV['11'], { top: '0', left: L1, right: '0', bottom: '0' });
  const tN = table(await linesGrid(G, 'none'));
  for (const k of Object.keys(tN)) assert.deepEqual(tN[k], { top: '0', left: '0', right: '0', bottom: '0' }, `★none ${k}`);
  /* 굵기 0 이면 선 자리가 있어도 «아무것도» 안 쓴다(옛 규약 — 0 = 없음) */
  const { block } = G.makeGridBlock(FIX());
  G.updateGridBlock(block.id, { cellBorderEdges: 'top,vsep' });
  for (const [r, c] of ALL) assert.ok(!cellStyle(block, r, c).includes('border-'), `★굵기 0 인데 칸(${r},${c})에 border 선언`);
});

/* ══ E4 ══════════════════════════════════════════════════════════════════ */
test('E4 ★1017t1i3 — 블럭 맨 위 선은 칸이 다시는 안 긋는다(외곽선·배경 유무와 무관) · 행 사이 선은 그대로', async () => {
  const { G } = await loadGrid();
  const b = await linesGrid(G, 'top,vsep', { blockOutline: 'top' });
  assert.equal(b.style.borderTop, L1, '★전제: 블럭 외곽선 위 변이 안 그려졌다');
  assert.equal(sides(cellStyle(b, 0, 0)).top, '0', '★첫 행 칸 위 변은 이제 칸의 일이 아니다(블럭 외곽선의 일)');
  assert.equal(sides(cellStyle(b, 0, 1)).top, '0');
  assert.equal(sides(cellStyle(b, 1, 0)).top, L1, '★둘째 행 위 변(행 사이 선)까지 사라졌다');
  assert.equal(sides(cellStyle(b, 0, 1)).left, L1, '★칸 사이 세로 선이 영향을 받았다');
  G.updateGridBlock(b.id, { blockBg: { on: true, color: '#ffffff' } });
  assert.equal(sides(cellStyle(b, 0, 0)).top, '0', '★배경을 켜도 첫 행 칸 위 변은 여전히 0 이어야 한다(가드가 필요 없어졌다)');
  G.updateGridBlock(b.id, { blockBg: null, blockOutline: 'bottom' });
  assert.equal(sides(cellStyle(b, 0, 0)).top, '0', '★외곽선 위 변을 꺼도 첫 행 칸 위 변은 여전히 0 이어야 한다(처음부터 칸이 안 그린다)');
  /* 네 변 모드에서는 겹침 규칙을 «안» 탄다(옛 동작) */
  const { block: box } = G.makeGridBlock(FIX());
  G.updateGridBlock(box.id, { gap: 0, cellBorderWidth: 1, cellBorderColor: '#b3b1ae', blockOutline: 'top' });
  assert.equal(sides(cellStyle(box, 0, 0)).top, L1, '★네 변 모드의 첫 행 위 변이 바뀌었다 — 옛 동작 변경');
});

/* ══ E5 ══════════════════════════════════════════════════════════════════ */
const M_THROW_ON = (src) => {
  const out = src.replace('  const cellBorder = _gridCellBorder(block);',
    "  const cellBorder = _gridCellBorder(block);\n  if (cellBorder.color === '#bada55') throw new Error('BOOM');");
  assert.notEqual(out, src, '★닻이 빗나갔다 — renderGridBlock 의 테두리 읽는 줄');
  return out;
};
test('E5 고치는 문 — RENDER_ERROR 롤백이 cellBorderEdges·ifgPreset 도 되돌린다 · before 에 실린다', async () => {
  const { G } = await loadGrid({ mutate: M_THROW_ON });
  const { block } = G.makeGridBlock(FIX());
  G.updateGridBlock(block.id, { cellBorderWidth: 1, cellBorderEdges: 'top', ifgPreset: 'basic' });
  const boom = G.updateGridBlock(block.id, { cellBorderColor: '#bada55', cellBorderEdges: 'vsep', ifgPreset: 'lines' });
  assert.equal(boom.code, 'RENDER_ERROR', `★전제: 렌더가 안 터졌다 — ${JSON.stringify(boom)}`);
  assert.equal(block.dataset.cellBorderEdges, 'top', '★롤백이 선 자리를 안 되돌렸다');
  assert.equal(block.dataset.ifgPreset, 'basic', '★롤백이 표식을 안 되돌렸다');
  const del = G.updateGridBlock(block.id, { cellBorderEdges: null });
  assert.equal(del.before.cellBorderEdges, 'top', '★before 에 선 자리가 없다');
});

test('E5 만드는 문 — opts.cellBorderEdges/ifgPreset 는 «주어졌을 때만» · 모르는 값은 말하고 버린다', async () => {
  const { G } = await loadGrid();
  const drops = [];
  const { block } = G.makeGridBlock({ ...FIX(), cellBorderWidth: 1, cellBorderEdges: ['vsep', 'top'], ifgPreset: 'lines' }, drops);
  assert.equal(block.dataset.cellBorderEdges, 'top,vsep');
  assert.equal(block.dataset.ifgPreset, 'lines');
  assert.deepEqual(drops, []);
  const d2 = [];
  const { block: b2 } = G.makeGridBlock({ ...FIX(), cellBorderEdges: 'left', ifgPreset: 'zzz' }, d2);
  assert.equal(b2.dataset.cellBorderEdges, undefined);
  assert.equal(b2.dataset.ifgPreset, undefined);
  assert.deepEqual(d2.map(d => d.path).sort(), ['cellBorderEdges', 'ifgPreset']);
});

test('E5b 줄 marginTop:\'auto\' — margin-top:auto 로 · 숫자는 옛 식 그대로', async () => {
  const { G } = await loadGrid();
  const auto = G.gridLineHtml({ type: 'image', imgShape: 'circle', height: 84, imgSrc: 'data:image/png;base64,AAAA', marginTop: 'auto' }, 'left');
  assert.ok(auto.includes('margin-top:auto;'), `★'auto' 가 안 실렸다: ${auto}`);
  const num = G.gridLineHtml({ type: 'body', text: 'x', marginTop: 12 }, 'left');
  assert.ok(num.includes('margin-top:12px;') && !num.includes('margin-top:auto'), num);
  const none = G.gridLineHtml({ type: 'body', text: 'x', marginTop: 'nope' }, 'left');
  assert.ok(!none.includes('margin-top'), `★모르는 글자가 margin-top 으로 샜다: ${none}`);
});

/* ══ E7 ══════════════════════════════════════════════════════════════════ */
function fnBody(src, name) {
  const i = src.indexOf(`function ${name}(`);
  assert.ok(i >= 0, `★${name} 를 못 찾았다`);
  const j = src.indexOf('\nfunction ', i + 10);
  return src.slice(i, j < 0 ? undefined : j);
}
test('E7 소스 가드 — renderGridBlock 이 «칸에서» 읽는 것(pick/cell.)이 366fd826 판과 같다', () => {
  /* 366fd826 판에서 «한 번» 뽑아 굳힌 명부(git 의존 없이 — 같은 파서로 2026-10-14 에 잼). */
  const OLD_READS = ['cell.lines', 'pick:align', 'pick:bg', 'pick:bgFit', 'pick:bgImg', 'pick:bgPos', 'pick:padding', 'pick:radius', 'pick:valign'];
  const b = fnBody(GRID_RAW, 'renderGridBlock');
  const now = [...new Set([...b.matchAll(/pick\('([\w]+)'\)/g)].map(m => 'pick:' + m[1])
    .concat([...b.matchAll(/\bcell\.([A-Za-z_]\w*)/g)].map(m => 'cell.' + m[1])))].sort();
  assert.deepEqual(now, OLD_READS, '★renderGridBlock 의 칸 읽기 명부가 바뀌었다 — P7(GRID_CELL_FIELDS) 오염');
});

/* ══ E8 음성대조 ══════════════════════════════════════════════════════════ */
const M_NO_EDGES = (src) => {
  const out = src.replace('  if (bd.edges) return _gridCellEdgesCss(bd, line, r, c);', '');
  assert.notEqual(out, src, '★닻이 빗나갔다 — edges 갈래');
  return out;
};
const M_VSEP_ALL = (src) => {
  const out = src.replace("bd.edges.includes('vsep') && c > 0 ? line : '0'", "bd.edges.includes('vsep') && c >= 0 ? line : '0'");
  assert.notEqual(out, src, '★닻이 빗나갔다 — vsep c > 0');
  return out;
};
const M_NO_R0_GUARD = (src) => {
  const out = src.replace("bd.edges.includes('top') && r > 0 ? line : '0'", "bd.edges.includes('top') ? line : '0'");
  assert.notEqual(out, src, '★닻이 빗나갔다 — r>0 가드');
  return out;
};
test('E8a ★음성대조 — edges 갈래를 지우면(늘 네 변) E2 의 표가 빨개진다', async () => {
  const { G } = await loadGrid({ mutate: M_NO_EDGES });
  const t = table(await linesGrid(G, 'top,vsep'));
  assert.notEqual(t['00'].right, '0', `★갈래를 지웠는데 (0,0) 오른쪽이 0 — E2 는 그 갈래를 «안 재고 있다»: ${JSON.stringify(t['00'])}`);
  assert.notEqual(t['11'].bottom, '0', '★갈래를 지웠는데 (1,1) 아래가 0');
});
test('E8b ★음성대조 — `c > 0` → `c >= 0` 이면 (0,0) 왼쪽이 빨개진다', async () => {
  const { G } = await loadGrid({ mutate: M_VSEP_ALL });
  const t = table(await linesGrid(G, 'top,vsep'));
  assert.equal(t['00'].left, L1, `★변이가 (0,0) 왼쪽에 안 닿았다 — E2 의 (0,0) left:'0' 단언이 그 자리를 «안 잰다»: ${JSON.stringify(t['00'])}`);
});
/* ⛔폐기(1017t1i3) — E8c 는 「겹침 가드(topShared)를 끄면 E4 가 빨개진다」를 쟀다. 그 가드가 _gridCellEdgesCss
 * 에서 사라졌다(r>0 가드 자체가 r===0 칸의 top 을 «처음부터» 0 으로 만들어 겹침이 구조적으로 불가능해졌다 —
 * 겹치려면 먼저 그려야 하는데 안 그린다). 재는 자 = 아래 N9(r>0 가드를 되돌리는 음성대조). */
test('E8c ★폐기(1017t1i3) — topShared 겹침 가드가 삭제돼 이 대조는 무의미해졌다 · 자리는 N9 가 메운다', { skip: true }, () => {});

/* ══ E9·N9·N10 — 1017t1i3(그리드 맨 위 선은 칸이 안 긋는다 · 행 사이는 그대로) ══════════════════════════ */
test('E9 ★top,vsep — r=0 모든 칸 top=0(블럭 맨 위는 칸 몫이 아니다) · r>0 은 L1(행 사이). 3행에서도 r=0 만 0', async () => {
  const { G } = await loadGrid();
  const t2 = table(await linesGrid(G, 'top,vsep'));
  assert.equal(t2['00'].top, '0'); assert.equal(t2['01'].top, '0');
  assert.equal(t2['10'].top, L1); assert.equal(t2['11'].top, L1);
  const { block: b3 } = G.makeGridBlock({
    cols: [{ width: 1, lines: [{ type: 'body', text: 'A' }] }, { width: 1, lines: [{ type: 'body', text: 'B' }] }],
    rows: [{ height: 'auto' }, { height: 'auto' }, { height: 'auto' }],
    cells: [[{ lines: [{ type: 'body', text: 'A' }] }, { lines: [{ type: 'body', text: 'B' }] }],
            [{ lines: [{ type: 'body', text: 'C' }] }, { lines: [{ type: 'body', text: 'D' }] }],
            [{ lines: [{ type: 'body', text: 'E' }] }, { lines: [{ type: 'body', text: 'F' }] }]],
  });
  G.updateGridBlock(b3.id, { gap: 0, cellBorderWidth: 1, cellBorderColor: '#b3b1ae', cellBorderStyle: 'solid', cellBorderEdges: 'top' });
  const s = (r, c) => sides(cellStyle(b3, r, c));
  assert.equal(s(0, 0).top, '0', '★3행에서도 r=0 은 0');
  assert.equal(s(0, 1).top, '0');
  assert.equal(s(1, 0).top, L1, '★r=1 은 L1');
  assert.equal(s(2, 0).top, L1, '★r=2 도 L1(모든 행 아니라 r>0 전부)');
});
test('N9 ★음성대조 — r>0 가드를 되돌리면(늘 top) E2·E3·E4·E9 가 빨개진다', async () => {
  const { G } = await loadGrid({ mutate: M_NO_R0_GUARD });
  const t = table(await linesGrid(G, 'top,vsep'));
  assert.notEqual(t['00'].top, '0', `★r>0 가드를 되돌렸는데 (0,0) top 이 그대로 0 — E9/E2 가 그 가드를 «안 재고 있다»: ${JSON.stringify(t['00'])}`);
  assert.notEqual(t['01'].top, '0', '★(0,1) top 도 되돌아와야 한다');
});
test('N10 ★범위 확인 — `c > 0`(vsep) 는 안 건드렸다(E8b 가 그대로 초록이어야 한다는 뜻을 여기서도 확인)', async () => {
  const { G } = await loadGrid();   // 무변이 — N9 의 변이가 vsep 축을 «안» 건드렸음을 거울로 확인
  const t = table(await linesGrid(G, 'top,vsep'));
  assert.equal(t['00'].left, '0', '★세로축은 (0,0)에서 그대로 0');
  assert.equal(t['01'].left, L1, '★세로축은 (0,1)에서 그대로 L1 — 1017t1i3 이 세로 축을 안 건드렸다');
});
