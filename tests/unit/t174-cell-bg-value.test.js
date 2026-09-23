/* t174-cell-bg-value.test.js — 칸 배경의 «값» 축. (T-174 조사 산출 · 2026-09-24)
 * 실행: node --test tests/unit/t174-cell-bg-value.test.js
 *
 * ★이 파일의 내력 — 두 판에 걸쳐 있다. 그 내력이 이 파일의 «뜻»이다.
 *   ⑴ 기준 7780267 에서 내가 잰 것: `patchCell{bg:'linear-gradient(…)'}` 가 ok:true 를 주고
 *      화면엔 배경이 «아예» 없었다. 게다가 그 칸이 이미 갖고 있던 멀쩡한 배경까지 사라졌다.
 *      ⇒ 그때 이 파일의 G1 은 `{ todo }` 였다(「있어야 할 거절이 없다」).
 *   ⑵ 59c6d63(T-170·175·176·180 「입구 계약」)이 그 자리를 닫았다. 그래서 이 파일이
 *      «스스로» 빨개졌다 — todo 가 통과했고, 「두 자리가 같은 말을 하게 됐다」던 대조축이 깨졌다.
 *      ★그것이 설계대로다. 검사가 「내 할 일이 끝났다」고 소리를 낸 것이지 오작동이 아니다.
 *   ⇒ 지금 이 파일은 «고쳐진 자리를 지키는 자»로 다시 섰다. G6 이 그 증인이다.
 *
 * ★★남은 비대칭 둘을 G3·G4 가 «사실»로 적는다 — 결함이라 부르지 않는다.
 *   59c6d63 이 문을 둘로 갈랐다(그 파일의 「★계약 — 한 문장」):
 *     patchCell/patchCol = «거절»(부르는 쪽이 그 필드를 직접 적었다)
 *     cols/cells         = «말한다»(read→한 칸 고쳐→통째로 되쓰기가 정상 왕복이라 막으면 옛 저장본이 죽는다)
 *   ⇒ `cells` 로 들어온 나쁜 값은 ok:true 이고 «저장본에 남는다». 그게 의도다.
 *     ⛔이 파일은 그 의도를 «뒤집으려» 들지 않는다. 다만 다음 사람이 「왜 여기만 남지」 하고
 *       되돌리려 할 때 부딪힐 자리에 말뚝을 박아 둔다.
 *
 * ⛔파일 이름이 «grid-» 로 안 시작하는 것은 실수가 아니다 — grid-render-gaps.test.js 의 래칫이
 *   `^grid-.*\.test\.(js|mjs)$` 를 전부 돌려 `[total, pass]` 등호를 요구한다. 옮기려면 그 수를
 *   같이 올려야 하고, 그건 «남의 그물»이라 내 사정으로 건드리지 않는다.
 *
 * ★내가 «안» 잰 축 — 화면(실앱)에서의 재현은 기준 7780267 에서만 했다. 59c6d63 재측정은
 *   이 미니 DOM(단위검사와 같은 표면)과 실앱 두 곳에서 했고, 저장 파일(proj.json)은 안 열었다.
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
  const { block: b } = mod.makeGridBlock({ cols: [{ width: 1 }, { width: 1 }] });
  assert.ok(b && b.id, '★블록이 안 만들어졌다 — 아래 단언은 전부 «다른 이유»로 초록이 된다');
  mod.updateGridBlock(b.id, { patchCell: { r: 0, c: 0, lines: [{ type: 'h2', text: 'A' }] } });
  const r = mod.updateGridBlock(b.id, { patchCell: { r: 0, c: 0, bg: GOOD } });
  assert.equal(r.ok, true, '★밑준비부터 실패했다');
  assert.match(b.innerHTML, new RegExp(`background:${GOOD}`),
    '★멀쩡한 배경이 애초에 안 그려졌다 — 아래 «지켜졌다» 단언이 거짓 양성이 된다');
  return b;
}

/* ═══ G1·G2 — 59c6d63 이 닫은 자리를 지킨다 ══════════════════════════════ */

test('G1 ★칸 배경에 «색이 아닌 값»을 patchCell 로 주면 거절된다', () => {
  const b = fixture();
  const r = G.updateGridBlock(b.id, { patchCell: { r: 0, c: 0, bg: BAD } });
  assert.equal(r.ok, false, '★렌더러가 «못 그리는» 값이 ok:true 로 통과했다 — 거짓 성공이 되살아났다');
  assert.equal(r.code, 'INVALID');
  assert.match(r.message, /not a value the renderer accepts for 'bg'/,
    '★거절은 하는데 «무엇이 틀렸나»를 안 말한다 — 부르는 쪽이 다음에 뭘 할지 모른다');
});

test('G2 ★★효과 판정 — 거절이 «옛 배경을 지켰다» (ok:false 는 증거가 아니다)', () => {
  const b = fixture();
  G.updateGridBlock(b.id, { patchCell: { r: 0, c: 0, bg: BAD } });
  assert.match(b.innerHTML, new RegExp(`background:${GOOD}`),
    '★거절했다고 «말만» 하고 값은 이미 덮었다 — 이게 이 카드가 처음 잡은 손실이다');
  assert.equal(JSON.parse(b.dataset.cells)[0][0].bg, GOOD,
    '★화면은 멀쩡한데 저장본이 오염됐다 — 다음에 열 때 사라진다');
});

/* ═══ G3·G4 — 남은 «비대칭»을 사실로 적는다(결함 아님 · 59c6d63 의 의도) ══ */

test('G3 ★cells 통째 경로는 «막지 않고 말한다» — ignoredProps 가 그 자리를 이름으로 댄다', () => {
  const b = fixture();
  const r = G.updateGridBlock(b.id, {
    cells: [[{ bg: BAD, lines: [{ type: 'h2', text: 'A' }] }, { bg: '#eeeeee' }]],
  });
  assert.equal(r.ok, true, '★왕복(read→한 칸 고쳐→되쓰기) 경로를 막으면 옛 저장본이 통째로 죽는다');
  assert.deepEqual(r.ignoredProps, ['cells[0][0].bg'],
    '★조용한 ok:true 로 돌아갔다 — 부르는 쪽이 «안 먹었다»를 알 길이 없어진다');
  assert.equal(r.applied.cells[0][0].bg, undefined,
    '★「적용했다」 목록이 안 먹은 값을 메아리치면 그 자체가 거짓 성공이다');
});

test('G4 ★★그래도 «저장본엔 남는다» — 여기가 남은 단 하나의 비대칭이다', () => {
  const b = fixture();
  G.updateGridBlock(b.id, {
    cells: [[{ bg: BAD, lines: [{ type: 'h2', text: 'A' }] }, { bg: '#eeeeee' }]],
  });
  assert.equal(JSON.parse(b.dataset.cells)[0][0].bg, BAD,
    '★이 값이 안 남게 됐다면 «왕복 보존»을 포기한 것이다 — 그건 별건 결정이다');
  assert.doesNotMatch(b.innerHTML.split('data-c="1"')[0], /background:/,
    '★저장본엔 있는데 화면엔 없다 — 그 갈림이 이 줄이 적는 사실이다');
});

/* ═══ G5 — 음성대조(전부 거절하면 초록이 되는 검사 방지) ═════════════════ */

test('G5 음성대조 — 멀쩡한 색은 통과하고 «실제로 그려진다»', () => {
  const b = fixture();
  const r = G.updateGridBlock(b.id, { patchCell: { r: 0, c: 1, bg: '#112233' } });
  assert.equal(r.ok, true, '★멀쩡한 색까지 막혔다 — 좁히다가 부쉈다');
  assert.match(b.innerHTML, /background:#112233/, '★ok:true 인데 화면엔 안 닿았다');
  const v = G.updateGridBlock(b.id, { patchCell: { r: 0, c: 1, bg: 'var(--color-brand, #ff0000)' } });
  assert.equal(v.ok, true, '★컬러변수 칩이 넣는 꼴이 막혔다 — 칩이 「눌리는데 안 먹는」 상태가 된다');
});

/* ═══ G6 — ★양성대조: 59c6d63 의 수리를 «깨뜨려» 댄다 ════════════════════ */

test('G6 ★★양성대조 — 값 문지기를 «뺀» 사본은 ok:true 를 주고 옛 배경을 잃는다', async () => {
  const mutated = RAW.replace(
    'function _gridValueViolations(node, where) {\n  const out = [];',
    'function _gridValueViolations(node, where) {\n  const out = []; return out;');
  assert.notEqual(mutated, RAW, '★변이가 «주입되지 않았다» — 이 양성대조는 아무것도 안 쟀다');
  const M = await loadGrid(mutated);
  const b = fixture(M);
  const r = M.updateGridBlock(b.id, { patchCell: { r: 0, c: 0, bg: BAD } });
  assert.equal(r.ok, true, '★문지기를 뺐는데도 거절한다 — 내가 «딴 것»을 뺀 것이다(변이가 안 먹었다)');
  assert.doesNotMatch(b.innerHTML, new RegExp(`background:${GOOD}`),
    '★구멍이 실재했다는 증거가 이 줄이다 — 옛 배경이 살아 있으면 G1·G2 는 «다른 이유»로 초록이다');
  assert.equal(JSON.parse(b.dataset.cells)[0][0].bg, BAD, '★저장본까지 오염되는 것이 원래 병의 꼴이다');
});
