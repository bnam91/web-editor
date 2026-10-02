/* grid-cell-rules.test.mjs — 칸 «사이»의 괘선 (현빈 2026-09-30)
 * 실행: node --test tests/unit/grid-cell-rules.test.mjs
 *
 * 카드 원문: 「2*1인 셀이 있으면 각 칼럼 중간에 줄」 ＋ 「칼럼 간격외에도 로우 간격에도 가로줄」
 *   ＋ 「모든칸 일괄적용할수도 있지만 특정 경계에만 지정해서 넣거나 뺄수 있게도」
 *   ＋ 「굵기 그대로 넘치게 둬」(간격보다 굵어도 자르지 않는다)
 *
 * ★재는 축 — «진짜 렌더러»를 돌려 나온 HTML 을 읽는다(소스 문자열이 아니다).
 *   R0 ⛔끄면 산출이 «바이트 동일»이다 — 옛 저장본이 한 픽셀도 안 바뀐다는 뜻.
 *      ★이게 이 파일의 첫 줄인 까닭: 이 기능의 최대 위험은 «남의 그림을 바꾸는 것»이다.
 *   R1 켠 경계에만 줄이 난다(특정 경계 지정).
 *   R2 줄의 «가운데»가 간격의 «가운데»에 온다 — 내민 거리 = 간격/2 ＋ 굵기/2.
 *   R3 굵기가 간격보다 커도 자르지 않는다(현빈 확정).
 *   R4 들여쓰기 0 = 칸 높이 전체 · N = N px 들여서. 0 을 «없는 값»으로 읽지 않는다.
 *   R5 통짜는 반대 축 간격을 덮고, 블럭 «밖»으로는 안 삐친다.
 *   R6 들여쓰기 > 0 이면 통짜는 뜻이 없다 — 끊김으로 본다.
 *   R7 경계 수가 줄면 켬/끔도 «같이» 잘린다(주인 없는 값이 안 남는다).
 *   R8 입구가 «조용히 안 받는다» — 잘못된 값은 거절하고 화면을 안 바꾼다.
 *   R9 ⛔칸·줄 명부(GRID_CELL_FIELDS·GRID_LINE_FIELDS)를 한 글자도 안 건드렸다.
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', '..');
/* ⛔구간의 «끝»을 꼬리 문자열(`indexOf('\n};')` 등)로 찾지 않는다 — 공용 부품이 균형괄호로 센다.
   그 규율을 tests/unit/slice-block-shared.test.js SB-16 이 레포 전체에서 문다(내가 거기 걸렸다). */
const { sliceBlock } = createRequire(import.meta.url)('./_slice-block.js');
const SRC_PATH = path.join(ROOT, 'js', 'blocks', 'grid-block.js');
const RAW = fs.readFileSync(SRC_PATH, 'utf8');

/* ── 미니 DOM — tests/unit/grid-render-gaps.test.js 와 «같은 표면» ── */
function makeFakeDom() {
  const registry = new Map();
  function createElement(tag) {
    let _id = '', _classes = new Set();
    const el = {
      tagName: tag, dataset: {}, style: {}, innerHTML: '',
      get id() { return _id; },
      set id(v) { if (_id) registry.delete(_id); _id = v; if (v) registry.set(v, el); },
      get className() { return [..._classes].join(' '); },
      set className(v) { _classes = new Set(String(v).split(/\s+/).filter(Boolean)); },
      classList: {
        contains: (c) => _classes.has(c), add: (...cs) => cs.forEach(c => _classes.add(c)),
        remove: (...cs) => cs.forEach(c => _classes.delete(c)),
        replace: (a, b) => { if (!_classes.has(a)) return false; _classes.delete(a); _classes.add(b); return true; },
      },
      appendChild(child) { return child; }, scrollIntoView() {},
      querySelector() { return null; }, querySelectorAll() { return []; },
    };
    return el;
  }
  return { createElement, getElementById: (id) => registry.get(id) || null };
}

let G;
before(async () => {
  let src = RAW;
  const STUB = 'const insertAfterSelected = () => {};\n'
    + 'const genId = (p) => `${p}_` + Math.random().toString(36).slice(2, 9);\n'
    + 'const bindBlock = () => {};\n';
  const b1 = src;
  src = src.replace(
    "import { insertAfterSelected, genId } from '../drag-utils.js';\nimport { bindBlock } from '../drag-drop.js';\n",
    STUB);
  assert.notEqual(src, b1, '★import 2줄을 못 찾았다 — 아래 단언이 전부 «다른 이유»로 초록이 된다');
  const tag = `${process.pid}-rules`;
  const gcr = path.join(os.tmpdir(), `gcr-rules-${tag}.mjs`);
  const b2 = src;
  src = src.replace("from '../grid-cell-resize.js'", 'from ' + JSON.stringify(pathToFileURL(gcr).href));
  assert.notEqual(src, b2, '★grid-cell-resize.js import 를 못 찾았다');
  fs.copyFileSync(path.join(ROOT, 'js', 'grid-cell-resize.js'), gcr);
  const alias = path.join(os.tmpdir(), `grid-rules-${tag}.mjs`);
  fs.writeFileSync(alias, src);
  globalThis.document = makeFakeDom();
  globalThis.window = {};
  G = await import(pathToFileURL(alias).href);
  fs.unlinkSync(alias); fs.unlinkSync(gcr);
});

/** 2열 × N행 블록. 각 칸에 글자 줄 하나. */
function fixture(colsN = 2, rowsN = 1) {
  const cols = Array.from({ length: colsN }, () => ({ width: 1, lines: [] }));
  const { block } = G.makeGridBlock({ cols });
  if (rowsN > 1) {
    const r = G.updateGridBlock(block.id, { rows: Array.from({ length: rowsN }, () => ({ height: 'auto' })) });
    assert.equal(r.ok, true, `★행 ${rowsN} 로 못 만들었다: ${JSON.stringify(r)}`);
  }
  for (let r = 0; r < rowsN; r++) {
    for (let c = 0; c < colsN; c++) {
      G.updateGridBlock(block.id, { patchCell: { r, c, lines: [{ type: 'body', text: `C${r}${c}` }] } });
    }
  }
  return block;
}

/** 한 칸의 여는 태그 + 그 칸이 낸 괘선 div 들. */
function cellChunk(block, r, c) {
  const start = block.innerHTML.indexOf(`data-r="${r}" data-c="${c}"`);
  assert.ok(start >= 0, `★칸 (${r},${c}) 를 못 찾았다`);
  const open = block.innerHTML.lastIndexOf('<div', start);
  const nextCell = block.innerHTML.indexOf('<div class="grd-cell', open + 4);
  return block.innerHTML.slice(open, nextCell < 0 ? undefined : nextCell);
}
const attr = (chunk, cls, name) => {
  const m = chunk.match(new RegExp(`class="${cls}"[^>]*style="([^"]*)"`));
  if (!m) return null;
  const mm = m[1].match(new RegExp(`(?:^|;)${name}:(-?[\\d.]+)px`));
  return mm ? Number(mm[1]) : null;
};

test('R0 ⛔끄면 산출이 «바이트 동일» — 옛 저장본이 한 픽셀도 안 바뀐다', () => {
  const a = fixture(2, 2);
  const before = a.innerHTML;
  // 굵기·색·들여쓰기·이어짐을 «다» 줘도, 경계를 하나도 안 켰으면 그림은 그대로다
  const r = G.updateGridBlock(a.id, { colRuleWidth: 6, colRuleColor: '#123456', colRuleInset: 10, colRuleSpan: 'through' });
  assert.equal(r.ok, true, `★값을 못 넣었다: ${JSON.stringify(r)}`);
  assert.equal(a.innerHTML, before,
    '★경계를 안 켰는데 산출이 바뀌었다 — 옛 저장본의 그림이 달라진다는 뜻이다');
  assert.ok(!a.innerHTML.includes('grd-crule'), '★안 켰는데 세로줄 div 가 났다');
  assert.ok(!a.innerHTML.includes('grd-rrule'), '★안 켰는데 가로줄 div 가 났다');
  assert.ok(!a.innerHTML.includes('position:relative'), '★안 켰는데 칸에 position:relative 가 붙었다');
});

test('R1 ★켠 경계에만 난다 — 3열에서 «가운데 하나만»', () => {
  const b = fixture(3, 1);
  assert.equal(G.updateGridBlock(b.id, { colRuleOn: '0,1' }).ok, true);
  assert.equal(cellChunk(b, 0, 0).includes('grd-crule'), false, '★안 켠 경계(0)에 줄이 났다');
  assert.equal(cellChunk(b, 0, 1).includes('grd-crule'), true, '★켠 경계(1)에 줄이 안 났다');
  // 맨 오른쪽 칸은 오른쪽에 경계가 «없다»
  assert.equal(cellChunk(b, 0, 2).includes('grd-crule'), false, '★마지막 열이 블럭 밖으로 줄을 그었다');
});

test('R2 ★줄의 «가운데»가 간격의 «가운데»에 온다 (간격/2 ＋ 굵기/2)', () => {
  const b = fixture(2, 1);
  assert.equal(G.updateGridBlock(b.id, { colGap: 24 }).ok, true);
  assert.equal(G.updateGridBlock(b.id, { colRuleOn: '1', colRuleWidth: 2 }).ok, true);
  const ch = cellChunk(b, 0, 0);
  assert.equal(attr(ch, 'grd-crule', 'right'), -(24 / 2 + 2 / 2),
    `★내민 거리가 «간격/2 + 굵기/2» 가 아니다 — 줄이 간격 가운데에 안 선다. 본 것: ${ch}`);
  assert.match(ch, /class="grd-crule"[^>]*width:2px/, '★굵기가 안 실렸다');
});

test('R3 ★굵기가 간격보다 커도 «그대로 넘친다» (현빈 확정)', () => {
  const b = fixture(2, 1);
  assert.equal(G.updateGridBlock(b.id, { colGap: 4 }).ok, true);
  assert.equal(G.updateGridBlock(b.id, { colRuleOn: '1', colRuleWidth: 20 }).ok, true);
  const ch = cellChunk(b, 0, 0);
  assert.match(ch, /class="grd-crule"[^>]*width:20px/, '★굵기를 간격에 맞춰 «조용히 깎았다»');
  assert.equal(attr(ch, 'grd-crule', 'right'), -(4 / 2 + 20 / 2), '★넘치는 굵기에서 내민 거리가 어긋난다');
});

test('R4 ★들여쓰기 — 0 은 칸 높이 전체, N 은 N px (0 을 «없는 값»으로 읽지 않는다)', () => {
  const b = fixture(2, 1);
  assert.equal(G.updateGridBlock(b.id, { colRuleOn: '1' }).ok, true);
  let ch = cellChunk(b, 0, 0);
  assert.equal(attr(ch, 'grd-crule', 'top'), 0, '★기본 들여쓰기가 0(전체 높이)이 아니다');
  assert.equal(attr(ch, 'grd-crule', 'bottom'), 0);
  assert.equal(G.updateGridBlock(b.id, { colRuleInset: 16 }).ok, true);
  ch = cellChunk(b, 0, 0);
  assert.equal(attr(ch, 'grd-crule', 'top'), 16, '★들여쓰기가 안 먹었다');
  assert.equal(attr(ch, 'grd-crule', 'bottom'), 16);
  // 0 으로 되돌리면 다시 전체 높이
  assert.equal(G.updateGridBlock(b.id, { colRuleInset: 0 }).ok, true);
  assert.equal(attr(cellChunk(b, 0, 0), 'grd-crule', 'top'), 0, '★0 을 «안 준 것»으로 읽었다');
});

test('R5 ★통짜는 행 간격을 덮고, 블럭 «밖»으로는 안 삐친다', () => {
  const b = fixture(2, 3);
  assert.equal(G.updateGridBlock(b.id, { rowGap: 20 }).ok, true);
  assert.equal(G.updateGridBlock(b.id, { colRuleOn: '1', colRuleSpan: 'through' }).ok, true);
  const top0 = cellChunk(b, 0, 0), mid = cellChunk(b, 1, 0), last = cellChunk(b, 2, 0);
  assert.equal(attr(top0, 'grd-crule', 'top'), 0, '★첫 행이 블럭 위로 삐쳤다');
  assert.equal(attr(top0, 'grd-crule', 'bottom'), -10, '★첫 행이 아래 행 간격을 안 덮는다');
  assert.equal(attr(mid, 'grd-crule', 'top'), -10, '★가운데 행이 위 간격을 안 덮는다');
  assert.equal(attr(mid, 'grd-crule', 'bottom'), -10, '★가운데 행이 아래 간격을 안 덮는다');
  assert.equal(attr(last, 'grd-crule', 'top'), -10, '★마지막 행이 위 간격을 안 덮는다');
  assert.equal(attr(last, 'grd-crule', 'bottom'), 0, '★마지막 행이 블럭 아래로 삐쳤다');
});

test('R6 ⚠️들여쓰기 > 0 이면 통짜는 뜻이 없다 — 끊김으로 본다', () => {
  const b = fixture(2, 2);
  assert.equal(G.updateGridBlock(b.id, { rowGap: 20 }).ok, true);
  assert.equal(G.updateGridBlock(b.id, { colRuleOn: '1', colRuleSpan: 'through', colRuleInset: 8 }).ok, true);
  const ch = cellChunk(b, 0, 0);
  assert.equal(attr(ch, 'grd-crule', 'bottom'), 8,
    '★들여쓰기와 통짜가 «동시에» 먹었다 — 둘은 반대말이라 그림이 설명할 수 없는 꼴이 된다');
});

test('R7 ★경계 수가 줄면 켬/끔도 «같이» 잘린다 (주인 없는 값이 안 남는다)', () => {
  const b = fixture(3, 1);
  assert.equal(G.updateGridBlock(b.id, { colRuleOn: '1,1' }).ok, true);
  assert.equal(b.dataset.colRuleOn, '1,1');
  // 3열 → 2열: 경계가 둘에서 하나로 줄어든다
  assert.equal(G.updateGridBlock(b.id, { cols: [{ width: 1 }, { width: 1 }] }).ok, true);
  assert.equal(b.dataset.colRuleOn, '1', `★경계 목록이 안 잘렸다 — 본 것: ${b.dataset.colRuleOn}`);
  /* 다시 3열로 늘리면 «새 경계는 꺼진 채»로 늘어난다 — 잘려 나간 옛 켬이 되살아나지 않는다.
     ⛔`'1,1'` 이면 사용자가 안 켠 줄이 나타난다(자르지 않았다면 그렇게 된다). */
  assert.equal(G.updateGridBlock(b.id, { cols: [{ width: 1 }, { width: 1 }, { width: 1 }] }).ok, true);
  assert.equal(b.dataset.colRuleOn, '1,0',
    `★늘렸을 때 새 경계가 꺼진 채가 아니다 — 본 것: ${b.dataset.colRuleOn}`);
});

test('R7-b ★행 축도 같다 — 3행 → 2행이면 행 경계 켬도 잘린다', () => {
  const b = fixture(2, 3);
  assert.equal(G.updateGridBlock(b.id, { rowRuleOn: '1,1' }).ok, true);
  assert.equal(b.dataset.rowRuleOn, '1,1');
  assert.equal(G.updateGridBlock(b.id, { rows: [{ height: 'auto' }, { height: 'auto' }] }).ok, true);
  assert.equal(b.dataset.rowRuleOn, '1', `★행 경계 목록이 안 잘렸다 — 본 것: ${b.dataset.rowRuleOn}`);
});

test('R8 ⛔잘못된 값은 «거절»한다 — 조용히 떨구지 않는다', () => {
  const b = fixture(2, 1);
  const before = b.innerHTML;
  for (const bad of [
    { colRuleOn: '2,0' }, { colRuleOn: 'a' },
    { colRuleWidth: 0 }, { colRuleWidth: 41 }, { colRuleWidth: 'x' },
    { colRuleColor: '초록색' },
    { colRuleInset: -1 }, { colRuleInset: 9999 },
    { colRuleSpan: 'full' },
    { rowRuleSpan: 'full' }, { rowRuleWidth: 41 },
  ]) {
    const r = G.updateGridBlock(b.id, bad);
    assert.equal(r.ok, false, `★${JSON.stringify(bad)} 를 «받았다» — 조용한 거짓 성공이다`);
    assert.equal(r.code, 'INVALID');
    assert.match(String(r.message), /Rule/, `★거절 메시지가 어느 키인지 안 말한다: ${r.message}`);
  }
  assert.equal(b.innerHTML, before, '★거절했는데 화면이 바뀌었다');
});

test('R8-b ★빈 목록은 «받는다» — 전부 끄기의 정본 꼴이다', () => {
  const b = fixture(2, 1);
  assert.equal(G.updateGridBlock(b.id, { colRuleOn: '1' }).ok, true);
  assert.ok(b.innerHTML.includes('grd-crule'));
  assert.equal(G.updateGridBlock(b.id, { colRuleOn: '' }).ok, true);
  assert.ok(!b.innerHTML.includes('grd-crule'), '★빈 목록으로 껐는데 줄이 남았다');
  assert.equal(b.dataset.colRuleOn, '', '★전부 끈 뒤 dataset 이 깨끗하지 않다');
});

test('R9 ⛔칸·줄 명부를 한 글자도 안 건드렸다 (이건 칸 값도 줄 값도 아니다)', () => {
  const setOf = (name) => {
    const m = RAW.match(new RegExp(`const ${name} = new Set\\(\\[([\\s\\S]*?)\\]\\)`));
    assert.ok(m, `★${name} 를 못 찾았다`);
    return [...new Set([...m[1].matchAll(/'([\w]+)'/g)].map(x => x[1]))];
  };
  for (const k of setOf('GRID_CELL_FIELDS').concat(setOf('GRID_LINE_FIELDS'))) {
    assert.ok(!/^(col|row)Rule/.test(k), `★칸/줄 명부에 괘선 키(${k})가 들어갔다 — 축이 섞였다`);
  }
  // 그리고 칸으로 주면 «거절»된다(축이 다르다는 것을 도구도 말한다)
  const b = fixture(2, 1);
  const r = G.updateGridBlock(b.id, { patchCell: { r: 0, c: 0, colRuleOn: '1' } });
  assert.equal(r.ok, false, '★칸에 괘선 키를 줬는데 받았다');
});

/* ══ RENDER_ERROR 롤백 — ★코덱스 적대 리뷰가 잡은 자리(2026-09-30) ═══════════════════
 * 무엇이 났나: `before` 스냅샷엔 괘선 10키를 넣었는데 `restore` 의 «손으로 적은 명부»엔 안 넣었다.
 *   ⇒ 렌더가 던지면 cols·cells 는 되돌아가고 괘선 10키는 «방금 실패한 새 값»으로 남았다.
 *   바로 위 주석이 「새 키를 같이 넣어라」라고 경고하던 그 자리다 — 읽을 수 있는 자리에 두고도 어겼다.
 * ★고친 것은 «빠진 10개»가 아니라 «명부가 둘인 것»이다: restore 가 Object.keys(snap) 로 뽑는다.
 * ⇒ 그래서 여기서 재는 것도 «10개가 있나»가 아니라 **명부가 하나인가**다. 그러면 다음에 키를
 *   늘리는 사람이 이 검사를 볼 필요조차 없다(구조가 지킨다).
 * ⚠️왜 «소스»로 재나 — RENDER_ERROR 를 데이터로 일으킬 길이 없다(입구가 다 검증한다).
 *   그 사실도 적어 둔다: 「행위로 못 재는 자리라 구조로 잠갔다」. */
test('R12 ★★되돌림 명부가 «하나»다 — restore 가 스냅샷에서 키를 뽑는다(손으로 안 적는다)', () => {
  const body = sliceBlock(RAW, 'const restore = (snap) =>');
  assert.ok(body && body.length > 20, '★restore 를 못 떴다 — 이 단언이 낡았다');
  assert.match(body, /Object\.keys\(snap\)/,
    '★restore 가 스냅샷에서 키를 안 뽑는다 — 명부가 둘이 되어 «한쪽만 고쳐지는» 사고가 되살아난다');
  /* ⛔손으로 적은 명부(문자열 배열 리터럴)가 되돌아왔나 — 그 꼴이면 위 Object.keys 와 «둘»이 된다. */
  assert.ok(!/\[\s*'cols'/.test(body),
    `★restore 안에 손으로 적은 키 명부가 있다 — 2026-09-30 에 그것 때문에 10키가 안 되돌아갔다. 본 것: ${body}`);
});

test('R13 ★★`next` 에 쓰는 «모든» dataset 키가 `before` 스냅샷에도 있다', () => {
  /* ★이것이 오늘 난 사고를 «다음에» 잡는 자다. 롤백 명부는 이제 하나지만, `before` 에 키를
     안 넣으면 여전히 안 되돌아간다 — 그 자리를 «세어서» 막는다.
     ⛔수를 박지 않는다: 양쪽을 소스에서 뽑아 견준다(키가 늘면 자동으로 따라온다). */
  const bBody = sliceBlock(RAW, 'const before = {');
  assert.ok(bBody && bBody.length > 40, '★before 스냅샷을 못 떴다');
  /* ⛔줄머리로 뜨지 마라 — 한 줄에 키가 여럿 있다(`cols: …, gap: …, valign: …`).
     처음에 `/^\s{4}(\w+):/m` 로 떠서 gap·valign·cells·colGap 넷을 «없다»고 읽었다.
     ⇒ 값의 «꼴»(block.dataset.X)로 뜬다. 자리와 무관하다. */
  const snapKeys = new Set([...bBody.matchAll(/(\w+):\s*block\.dataset\./g)].map(m => m[1]));
  assert.ok(snapKeys.size >= 10, `★스냅샷 키를 못 떴다(${snapKeys.size}개) — 이 단언이 헛돈다`);

  /* 쓰는 쪽 — `next.NAME =` (손으로 적은 이름) ＋ `next[kX] =` (축 루프의 계산된 이름). */
  /* ⛔`export function` 으로 찾지 마라 — 이 파일은 `function …` 로 선언하고 아래에서 export { } 로
     내보낸다(그래서 처음에 못 찾았고, 자가점검이 그걸 잡았다). 선언 꼴 그대로 찾는다. */
  const fnAt = RAW.indexOf('function updateGridBlock(blockId');
  assert.ok(fnAt > 0, '★updateGridBlock 선언을 못 찾았다 — 이 단언이 낡았다');
  // 입구(값을 next 에 쓰는 구간)는 restore 선언 «앞»에 다 있다 — 그 사이만 본다.
  const fn = RAW.slice(fnAt, RAW.indexOf('const restore = (snap)', fnAt));
  const written = new Set([...fn.matchAll(/\bnext\.(\w+)\s*=/g)].map(m => m[1]));
  // 계산된 이름: `const kOn = ax + 'RuleOn'` 꼴 → 축마다 한 벌
  const axes = (() => {
    const m = RAW.match(/export const GRID_RULE_AXES = \[([^\]]*)\]/);
    assert.ok(m, '★GRID_RULE_AXES 를 못 찾았다');
    return [...m[1].matchAll(/'(\w+)'/g)].map(x => x[1]);
  })();
  /* ⛔`const` 를 닻으로 쓰지 마라 — 한 `const` 문에 여러 이름이 콤마로 붙어 있어 첫 하나만 잡힌다
     (처음에 그렇게 써서 «0개»가 나왔고, 자가점검이 그걸 잡았다). 할당 꼴만 본다. */
  const suffixes = [...fn.matchAll(/\bk\w+ = ax \+ '(\w+)'/g)].map(m => m[1]);
  assert.ok(suffixes.length >= 5, `★축 루프의 계산된 키를 못 떴다(${suffixes.length}개) — 이 단언이 헛돈다`);
  for (const ax of axes) for (const suf of suffixes) written.add(ax + suf);

  const missing = [...written].filter(k => !snapKeys.has(k));
  assert.deepEqual(missing, [],
    `★\`next\` 에 쓰는데 \`before\` 에 «없는» 키가 있다: ${missing.join(', ')}\n`
    + '  ⇒ RENDER_ERROR 롤백이 그 키를 «방금 실패한 새 값»으로 남긴다'
    + '(그리기에 실패했는데 화면엔 남는 반쪽 상태). before 에 그 키를 더해라.');
});

test('R10 ★가로줄도 같은 자리에 선다 — 행 간격 가운데', () => {
  const b = fixture(2, 2);
  assert.equal(G.updateGridBlock(b.id, { rowGap: 16 }).ok, true);
  assert.equal(G.updateGridBlock(b.id, { rowRuleOn: '1', rowRuleWidth: 4 }).ok, true);
  const ch = cellChunk(b, 0, 0);
  assert.equal(attr(ch, 'grd-rrule', 'bottom'), -(16 / 2 + 4 / 2), `★가로줄이 행 간격 가운데에 안 선다: ${ch}`);
  assert.match(ch, /class="grd-rrule"[^>]*height:4px/, '★가로줄의 굵기가 height 로 안 실렸다');
  // 마지막 행은 아래 경계가 없다
  assert.equal(cellChunk(b, 1, 0).includes('grd-rrule'), false, '★마지막 행이 블럭 밖으로 가로줄을 그었다');
});

test('R11 ★두 축을 같이 켜면 한 칸이 줄 «둘»을 낸다', () => {
  const b = fixture(2, 2);
  assert.equal(G.updateGridBlock(b.id, { colRuleOn: '1' }).ok, true);
  assert.equal(G.updateGridBlock(b.id, { rowRuleOn: '1' }).ok, true);
  const ch = cellChunk(b, 0, 0);
  assert.ok(ch.includes('grd-crule') && ch.includes('grd-rrule'), '★한 칸이 두 축을 같이 못 낸다');
  assert.match(ch, /position:relative/, '★절대배치의 기준(position:relative)이 안 붙었다 — 줄이 엉뚱한 조상에 걸린다');
});
