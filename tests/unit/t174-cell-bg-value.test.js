/* t174-cell-bg-value.test.js — 칸 배경의 «값»이 아무도 안 보는 자리. (T-174 조사 산출)
 * 실행: node --test tests/unit/t174-cell-bg-value.test.js
 *
 * ⛔파일 이름이 «grid-» 로 안 시작하는 것은 실수가 아니다.
 *   grid-render-gaps.test.js 의 래칫이 `^grid-.*\.test\.(js|mjs)$` 를 전부 돌려
 *   `[total, pass]` 가 «둘 다» 기준수와 같기를 요구한다 ⇒ 그 명부 안에서는 `todo` 가 하나도 못 산다
 *   (todo 는 pass 에 안 들어간다). 이 카드의 G1 은 «아직 안 고친 것»이라 todo 여야 한다.
 *   ⇒ 래칫을 건드리는 대신 명부 «밖»에 세웠다. 옮기려면 래칫의 셈 규칙부터 정해야 한다.
 *
 * ★무엇을 쟀나 (2026-09-24, 격리 인스턴스 9348 · 실화면에서 먼저 밟고 여기로 옮겼다)
 *   `updateGridBlock(id, { patchCell: { r, c, bg: 'linear-gradient(90deg,#fff,#000)' } })` 가
 *   «ok:true» 를 주고 `applied.patchCell.bg` 에 보낸 값을 그대로 되돌려준다.
 *   그런데 렌더러는 `_GRID_COLOR_RE` 를 통과하는 값만 그린다 ⇒ 화면엔 «배경이 아예 없다».
 *   더 나쁜 것은 그 칸이 «이미 갖고 있던 멀쩡한 배경»까지 같이 사라진다는 것이다.
 *   ⇒ 부르는 쪽엔 「바꿨다」로, 화면엔 「지웠다」로 끝난다.
 *
 * ★이름 검사(grid-patchcell-reject)는 이걸 «못 잡는다» — `bg` 는 명부에 «있는» 이름이다.
 *   화면대조 검사(grid-applied-matches-screen)도 못 잡는다 — 그건 「어느 «잎»이 화면에 닿나」를
 *   «줄 종류»축에서 재고, 칸 `bg` 의 «값»축은 안 잰다. ⇒ 두 자물쇠 «사이»에 난 구멍이다.
 *
 * ★대조축 G5 — 같은 블록의 «줄 색»(line.color)은 이미 값 검증을 한다(ok:false).
 *   즉 「값을 안 본다」가 이 파일의 관례가 아니라, 이 «한 자리»만 갈라진 것이다.
 *
 * ⛔G1 은 «일부러 빨갛게» 두지 않는다 — `{ todo: … }` 로 둔다.
 *   빨간 검사는 다음 빨강을 가린다. 고쳐지면 node:test 가 「todo 가 통과했다」로 시끄러워진다.
 */
'use strict';
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');
const { readSrc } = require('./_srcread.js');

const ROOT = path.join(__dirname, '..', '..');
const RAW = readSrc(path.join(ROOT, 'js', 'blocks', 'grid-block.js'));

/* ── 미니 DOM (grid-patchcell-reject.test.js 와 «같은 표면») ── */
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
    };
    return el;
  }
  return { createElement, getElementById: (id) => registry.get(id) || null };
}

let _seq = 0;
async function loadGrid(src = RAW) {
  const STUB = 'const insertAfterSelected = () => {};\n'
    + 'const genId = (p) => `${p}_` + Math.random().toString(36).slice(2, 9);\n'
    + 'const bindBlock = () => {};\n';
  const before1 = src;
  src = src.replace(
    "import { insertAfterSelected, genId } from '../drag-utils.js';\nimport { bindBlock } from '../drag-drop.js';\n",
    STUB);
  assert.notEqual(src, before1, '★소스에서 drag-utils/drag-drop import 2줄을 못 찾았다 — 리팩터링됐나?');

  const tag = `${process.pid}-${++_seq}`;
  const gcrAlias = path.join(os.tmpdir(), `gcr-cbv-${tag}.mjs`);
  const before2 = src;
  src = src.replace("from '../grid-cell-resize.js'", 'from ' + JSON.stringify(pathToFileURL(gcrAlias).href));
  assert.notEqual(src, before2, '★grid-cell-resize.js import 를 못 찾았다 — 행높이 상한 SSOT 가 끊겼나?');

  fs.copyFileSync(path.join(ROOT, 'js', 'grid-cell-resize.js'), gcrAlias);
  const alias = path.join(os.tmpdir(), `grid-cbv-${tag}.mjs`);
  fs.writeFileSync(alias, src);
  globalThis.document = makeFakeDom();
  globalThis.window = {};
  const mod = await import(pathToFileURL(alias).href);
  fs.unlinkSync(alias); fs.unlinkSync(gcrAlias);
  return mod;
}

let G;
before(async () => { G = await loadGrid(); });

const BAD = 'linear-gradient(90deg,#fff,#000)';
const GOOD = '#f5f7fa';

/** 1행 2열 · 0행 0열 칸에 «멀쩡한 배경»과 글자 한 줄이 이미 있는 그리드. */
function fixture(mod = G) {
  const { block: b } = mod.makeGridBlock({ cols: [{ width: 1, lines: [] }, { width: 1, lines: [] }] });
  assert.ok(b && b.id, '★블록이 안 만들어졌다 — 아래 단언은 전부 «다른 이유»로 초록이 된다');
  mod.updateGridBlock(b.id, { patchCell: { r: 0, c: 0, lines: [{ type: 'h2', text: 'A' }] } });
  const r = mod.updateGridBlock(b.id, { patchCell: { r: 0, c: 0, bg: GOOD } });
  assert.equal(r.ok, true, '★밑준비부터 실패했다');
  assert.match(b.innerHTML, new RegExp(`background:${GOOD}`),
    '★멀쩡한 배경이 애초에 안 그려졌다 — 아래 «사라졌다» 단언이 거짓 양성이 된다');
  return b;
}

/* ═══ G1 — 있어야 할 거절(지금은 «없다») ════════════════════════════════ */

test('G1 ★칸 배경에 «색이 아닌 값»을 주면 거절되어야 한다',
  { todo: '2026-09-24 T-174 실측 — 지금은 ok:true 다. 고쳐지면 node:test 가 「todo 통과」로 알린다.' },
  () => {
    const b = fixture();
    const r = G.updateGridBlock(b.id, { patchCell: { r: 0, c: 0, bg: BAD } });
    assert.equal(r.ok, false, '★렌더러가 «못 그리는» 값이 ok:true 로 통과했다 — 거짓 성공이다');
  });

/* ═══ G2·G3 — 지금 «참»인 것을 못 박는다(고쳐지면 여기가 빨개진다) ══════ */

test('G2 ★돌려준 값과 화면이 갈린다 — applied 엔 있고 화면엔 «배경이 없다»', () => {
  const b = fixture();
  const r = G.updateGridBlock(b.id, { patchCell: { r: 0, c: 0, bg: BAD } });
  if (r.ok !== true) return;                       // G1 이 고쳐졌다 — 이 자리는 더 잴 것이 없다
  assert.equal(r.applied.patchCell.bg, BAD,
    '★「적용했다」 목록이 보낸 값을 그대로 메아리친다는 것이 이 구멍의 표면이다');
  assert.doesNotMatch(b.innerHTML, /background:linear-gradient/,
    '★렌더러가 실제로 그렸다면 이 검사의 전제가 틀린 것이다 — 다시 재라');
});

test('G3 ★★멀쩡하던 배경이 «사라진다» — 「됐다」를 받고 잃는다', () => {
  const b = fixture();
  const r = G.updateGridBlock(b.id, { patchCell: { r: 0, c: 0, bg: BAD } });
  if (r.ok !== true) return;                       // G1 이 고쳐졌으면 손실도 안 난다
  assert.doesNotMatch(b.innerHTML, new RegExp(`background:${GOOD}`),
    '★전제 확인 — 옛 배경이 남아 있다면 「사라진다」는 말이 거짓이다');
  assert.doesNotMatch(b.innerHTML, /background:/,
    '★칸에 «아무» 배경도 안 남는다는 것이 이 카드가 재는 손실이다');
});

/* ═══ G4 — 음성대조(전부 거절하면 초록이 되는 검사 방지) ═════════════════ */

test('G4 음성대조 — 멀쩡한 색은 통과하고 «실제로 그려진다»', () => {
  const b = fixture();
  const r = G.updateGridBlock(b.id, { patchCell: { r: 0, c: 1, bg: '#112233' } });
  assert.equal(r.ok, true, '★멀쩡한 색까지 막혔다 — 좁히다가 부쉈다');
  assert.match(b.innerHTML, /background:#112233/, '★ok:true 인데 화면엔 안 닿았다');
});

/* ═══ G5 — 대조축: 같은 블록의 «줄 색»은 값을 «본다» ═════════════════════ */

test('G5 ★같은 블록의 «줄 색»은 이미 값 검증을 한다 — 갈라진 것은 «칸 배경» 한 자리다', () => {
  const b = fixture();
  const line = G.updateGridBlock(b.id, { patchCell: { r: 0, c: 0, lineIndex: 0, color: '초록색' } });
  assert.equal(line.ok, false,
    '★줄 색도 값을 안 보게 됐다면 이 카드의 「한 자리만 갈라졌다」가 거짓이 된다 — 범위를 다시 적어라');
  const cell = G.updateGridBlock(b.id, { patchCell: { r: 0, c: 0, bg: '초록색' } });
  assert.notEqual(cell.ok, line.ok,
    '★두 자리가 같은 말을 하게 됐다 — 그럼 이 검사는 할 일이 끝났다(지우지 말고 G1 을 봐라)');
});
