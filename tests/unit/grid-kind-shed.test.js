/* U-KINDSHED — 줄 «종류 바꾸기»가 앞 종류의 짐(height 등)을 턴다 (E14 · 2026-10-06 · APPROVED_BY: 지디 E14-E157)
 *   실행: node --test "tests/unit/*.test.mjs" "tests/unit/*.test.js"
 *
 * ★병명 (실측 · a8f60da1 · 스크래치 하네스 · 10-06)
 *   MCP update_grid_block{patchCell:{lineIndex, type:'body'}} 로 image(height 160 · 크롭 없음) 줄을 글자 줄로 바꾸면
 *   height:160 이 «남고»(dataset 에 저장됨), 이어 type:'gap' 으로 바꾸면 여백이 16 이 아니라 160px 로 그려진다.
 *   0ff05430(E157 부모)에선 둘 다 없었다(height 사라짐 · gap 16px).
 *   까닭: _gridMergeLine 의 청소는 «옛 줄이 읽던 키»만 턴다. E157 이 «크롭 없는 그림 줄은 height 를 그릴 때 무시»로
 *   바꿔서, 옛 image 줄 «이 인스턴스»가 height 를 안 읽는다 → 청소가 남긴다.
 * ★입구: UI 「종류 바꾸기」(prop-grid _GRD_KIND_SHED)는 손으로 턴다 — 닿는 길은 MCP(E26 선례: 사용자 길).
 * ★하네스 = grid-line-typo.test.js 와 같은 import-스텁 기법(실제 소스를 돌린다).
 * 머리표: [새 것] a8f60da1 에서 빨강 · [회귀 지킴] a8f60da1 에서도 초록.
 */
'use strict';
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');
const { readSrc } = require('./_srcread.js');
const { makeStripper } = require('./_strip-comments.js');

const ROOT = path.join(__dirname, '../..');

/** 소스에서 «주석을 뺀 코드 줄»만. ⛔파일 하나마다 새 stripper(블록 주석 상태를 들고 간다). */
function codeLines(rel) {
  const strip = makeStripper();
  return readSrc(ROOT, rel).split('\n').map(l => strip(l));
}
const codeOf = (rel) => codeLines(rel).join('\n');

/* ── grid-block.js 를 «실물 그대로» 돌린다 (grid-p1.test.js 와 같은 기법) ── */
const srcPath = path.join(ROOT, 'js/blocks/grid-block.js');
let src = readSrc(srcPath);
const STUB = "const insertAfterSelected = () => {};\nconst genId = (p) => `${p}_` + Math.random().toString(36).slice(2, 9);\nconst bindBlock = () => {};\n";
{
  const before_ = src;
  src = src.replace(
    "import { insertAfterSelected, genId } from '../drag-utils.js';\nimport { bindBlock } from '../drag-drop.js';\n",
    STUB);
  assert.notEqual(src, before_, '소스에서 drag-utils/drag-drop import 2줄을 못 찾음 — 리팩터링됐나?');
}
const gcrAliasPath = path.join(os.tmpdir(), `grid-cell-resize-alias-kindshed-${process.pid}.mjs`);
/* ★공용 sanitizer(수지⑦ 2026-10-08) — ★그리드가 ★세 번째 소비자가 되며 ★새 import 가 생겼다.
   ★위 gcr 별칭과 ★같은 스코프에 둔다 — ⛔안쪽 함수에 선언하면 ★바깥 `unlinkSync` 에서
     ★`ReferenceError` 가 난다(★2026-10-08 에 ★내가 ★그렇게 ★5파일을 깼다). */
const srtAlias = path.join(os.tmpdir(), `srt-alias-kindshed-${process.pid}.mjs`);
{
  const before_ = src;
  src = src.replace("from '../grid-cell-resize.js'", 'from ' + JSON.stringify(pathToFileURL(gcrAliasPath).href));
  assert.notEqual(src, before_, "grid-cell-resize.js import 를 못 찾음");
  const beforeSrt = src;
  src = src.replace("from '../util/sanitize-rich-text.js'", 'from ' + JSON.stringify(pathToFileURL(srtAlias).href));
  assert.notEqual(src, beforeSrt, '★sanitize-rich-text.js import 를 못 찾았다 — 부분 서식 공용 모듈이 끊겼나?');
  fs.copyFileSync(path.join(ROOT, 'js/util/sanitize-rich-text.js'), srtAlias);
}

function makeFakeDom() {
  const registry = new Map();
  function createElement(tag) {
    let _id = '', _classes = new Set();
    const el = {
      tagName: tag, dataset: {}, style: {}, innerHTML: '', children: [],   // G19 — 렌더러가 직계 자식(.grd-children 유무)을 읽는다 · 이 가짜는 자식을 안 붙이므로 늘 빈 목록
      get id() { return _id; },
      set id(v) { if (_id) registry.delete(_id); _id = v; if (v) registry.set(v, el); },
      get className() { return [..._classes].join(' '); },
      set className(v) { _classes = new Set(String(v).split(/\s+/).filter(Boolean)); },
      classList: {
        contains: (c) => _classes.has(c),
        add: (...cs) => cs.forEach(c => _classes.add(c)),
        remove: (...cs) => cs.forEach(c => _classes.delete(c)),
        replace: (a, b) => { if (!_classes.has(a)) return false; _classes.delete(a); _classes.add(b); return true; },
      },
      appendChild(child) { return child; },
      scrollIntoView() {},
    };
    return el;
  }
  return { createElement, getElementById: (id) => registry.get(id) || null };
}

let gridLineHtml, GRID_ROLES, makeGridBlock, updateGridBlock, getGridModel, gridPreviewLine, gridLineHasText;

before(async () => {
  const aliasPath = path.join(os.tmpdir(), `grid-kindshed-alias-${process.pid}.mjs`);
  fs.copyFileSync(path.join(ROOT, 'js/grid-cell-resize.js'), gcrAliasPath);
  fs.writeFileSync(aliasPath, src);
  globalThis.document = makeFakeDom();
  globalThis.window = {};
  const mod = await import(pathToFileURL(aliasPath).href);
  fs.unlinkSync(aliasPath); fs.unlinkSync(gcrAliasPath); fs.unlinkSync(srtAlias);
  ({ gridLineHtml, GRID_ROLES, makeGridBlock, updateGridBlock, getGridModel, gridPreviewLine, gridLineHasText } = mod);
});

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4AWL6z8DwHwAAAP//A3ONEwAAAAZJREFUAwAFCgIByRpMngAAAABJRU5ErkJggg==';
/** 줄 하나짜리 그리드 → MCP 모양 patchCell 로 종류를 차례로 바꾼다. 매 단계 줄 모델을 돌려준다. */
function switchKinds(first, ...steps) {
  const { block } = makeGridBlock({ cols: [{ width: 1, lines: [first] }] });
  const line = () => getGridModel(block).cells[0][0].lines[0];
  const out = [];
  for (const s of steps) {
    const res = updateGridBlock(block.id, { patchCell: { r: 0, c: 0, lineIndex: 0, ...s } });
    assert.ok(res && res.ok, `[전제] patchCell 이 실패했다: ${JSON.stringify(res)}`);
    out.push(line());
  }
  return { block, out };
}
const gapPx = (line) => Number((gridLineHtml(line, 'left', 0, null).match(/height:(\d+)px/) || [])[1]);

test('K0 [전제] 하네스가 렌더러를 돌린다 — 키 없는 gap 은 16px · height 40 gap 은 40px (재는 자가 산다)', () => {
  assert.equal(gapPx({ type: 'gap' }), 16);
  assert.equal(gapPx({ type: 'gap', height: 40 }), 40, '★gap 이 height 를 안 읽는다 — K2 는 아무것도 못 본다');
});

test('K1 [새 것] ★image(h160 · 크롭 없음) → body: 앞 종류의 짐(imgSrc·height)이 «안» 남는다', () => {
  const { block, out: [body] } = switchKinds({ type: 'image', imgSrc: PNG, height: 160 }, { type: 'body', text: '바뀐 줄' });
  assert.equal(body.type, 'body');
  assert.deepEqual(['imgSrc', 'height', 'widthPct'].filter(k => body[k] !== undefined), [],
    `★종류를 바꿨는데 앞 종류의 필드가 남았다: ${JSON.stringify(body)}`);
  assert.doesNotMatch(String(block.dataset.cols) + String(block.dataset.cells), /"height":160/, '★저장본(dataset)에 height 160 이 남았다');
});

test('K2 [새 것] ★image(h160) → body → gap: 여백이 16px(기본)이지 160px 이 아니다', () => {
  const { out: [, gap] } = switchKinds({ type: 'image', imgSrc: PNG, height: 160 }, { type: 'body', text: 'x' }, { type: 'gap' });
  assert.equal(gap.type, 'gap');
  assert.equal(gapPx(gap), 16, `★지운 줄 알았던 그림 높이가 여백으로 되살아났다: ${JSON.stringify(gap)}`);
});

test('K3 [회귀 지킴] 크롭한 image(imgSizePct) → body 도 height 를 턴다', () => {
  const { out: [body] } = switchKinds({ type: 'image', imgSrc: PNG, height: 160, imgSizePct: 80 }, { type: 'body', text: 'x' });
  assert.deepEqual(['imgSrc', 'height', 'imgSizePct'].filter(k => body[k] !== undefined), [], JSON.stringify(body));
});

test('K4 [회귀 지킴] 글자 종류끼리(h2 → body)는 글자·자간을 «안» 지운다', () => {
  const { out: [body] } = switchKinds({ type: 'h2', text: '소중한 제목', letterSpacing: 0 }, { type: 'body' });
  assert.equal(body.text, '소중한 제목');
  assert.equal(body.letterSpacing, 0, '★역할 기본과 같은 값(자간 0)을 «안 읽힌다»로 오판해 지웠다');
});

test('K5 [회귀 지킴] 이번 호출이 «명시»한 키는 안 턴다 — image → gap 에 height 24 를 같이 주면 24', () => {
  const { out: [gap] } = switchKinds({ type: 'image', imgSrc: PNG, height: 160 }, { type: 'gap', height: 24 });
  assert.equal(gapPx(gap), 24);
  assert.equal(gap.imgSrc, undefined, '★gap 이 안 읽는 imgSrc 가 남았다');
});

/* ══ K6/K7 — «표가 정말 렌더러에서 파생되나»(지디 조건 ㉢) · 비용(태양 조건) ══════════════════════════
 * 테스트 대역: 같은 소스를 한 번 더 얹되 렌더러의 «빈 그림 틀» 모드에서 height 를 «안 읽게» 한 줄만 바꾼다.
 * 파생이면 → 대역의 image 표에서 height 가 빠지고 K1 의 길이 다시 빨개진다. 손으로 적은 표면 → 그대로 초록(거짓 파생).
 * ★대역은 이 파일 안에서만 산다(제품 소스 무변). 표 함수가 없는 판(a8f60da1)에선 K6·K7 은 [전제]에서 멈춘다. */
/* ★★닻 — ⛔「식」이 아니라 ★«이름» 하나다(2026-10-07 교체).
 *  ★왜 갈았나 — 옛 닻은 ★식 ★전체를 베낀 문자열이었다: `const ph = h > 0 ? h : 180;`
 *    `gd/grid-t4t5` 의 `7dc54091`(T4② — 빈 슬롯이 칸을 ★채운다)이 ★그 식을 고치자
 *    K6 은 ★[전제]에서 멈췄다. ★식을 베낀 닻은 ★그 식을 고치는 날 ★반드시 깨진다.
 *  ★그래서 ★이름으로 간다 — ★`hCss` ★선언 ★한 줄을 찾아 ★그 줄을 ★상수로 갈아친다.
 *    ⇒ ★식이 어떻게 바뀌어도(삼항이든 함수 호출이든) ★이름이 그대로면 ★닻은 산다.
 *  ⛔그래도 ★«이름이 바뀌는» 날은 온다 — 그때 ★조용히 눈먼지 ★않게 아래 셋을 같이 건다:
 *    ⑴ ★딱 ★한 줄만 맞아야 한다(0 이면 [전제] 빨강 · 2 이상이면 ★어느 줄인지 모른다 = 빨강)
 *    ⑵ ★갈아친 뒤 소스가 ★실제로 달라졌나(`assert.notEqual`)
 *    ⑶ ★양성대조 — 이름을 ★일부러 틀리면 ★[전제]가 ★빨개지나(K6-pre 가 ×3 으로 센다)
 *  ⛔이 주석에 ★그 식을 ★그대로 적지 않는다 — 소스 파싱 게이트가 ★주석을 입력으로 먹는 선례가
 *    이 레포에 있다(바로 아래 prop-grid 알약 주석이 name-axes X5 를 빨갛게 만든 자리다). */
const EMPTY_FRAME_DECL = 'hCss';

/** 「`const <name> = …;`」 ★선언 ★한 줄을 찾아 ★`replacement` 로 갈아친다.
 *  ★닻이 ★«이름»이라 식이 바뀌어도 산다. ⛔맞는 줄이 ★하나가 아니면 ★던진다 —
 *    「어느 줄을 갈았는지 모르는 채 초록」을 ★만들지 않는다. */
function replaceDeclLine(src, name, replacement) {
  const re = new RegExp(`^[ \\t]*const ${name}\\s*=.*$`, 'gm');
  const hits = src.match(re) || [];
  if (hits.length !== 1) {
    throw new Error(`[전제] 선언 닻 «const ${name}» 이 ${hits.length} 줄 맞았다(1 이어야 한다) — `
      + '이름이 바뀌었거나 같은 이름이 둘이다. ★이 검사를 끄지 말고 닻 이름을 고쳐라');
  }
  return src.replace(re, replacement);
}
async function loadVariant(tag, edit) {
  let v = src;
  if (edit) { const b = v; v = edit(v); assert.notEqual(v, b, `[전제] 대역 «${tag}» 닻을 못 찾았다`); }
  v += '\nexport { _gridTypeCanRead as __typeCanRead, GRID_LINE_FIELDS as __GLF };\n';
  const gcr2 = path.join(os.tmpdir(), `gcr-kindshed-${tag}-${process.pid}.mjs`);
  const ali = path.join(os.tmpdir(), `grid-kindshed-${tag}-${process.pid}.mjs`);
  fs.copyFileSync(path.join(ROOT, 'js/grid-cell-resize.js'), gcr2);
  /* ★공용 sanitizer(수지⑦ 2026-10-08) — ★gcr2 와 ★같은 꼴로 ★제 사본을 ★따로 뜬다.
     ⛔위 `src` 에 박힌 `srtAlias` 를 ★그대로 쓰면 ★안 된다 — ★그 파일은 ★맨 위 로더가 ★이미 unlink 했다
       (★실측: K6·K7 이 `ERR_MODULE_NOT_FOUND srt-alias-kindshed-*.mjs` 로 죽었다). */
  const srt2 = path.join(os.tmpdir(), `srt-kindshed-${tag}-${process.pid}.mjs`);
  fs.copyFileSync(path.join(ROOT, 'js/util/sanitize-rich-text.js'), srt2);
  fs.writeFileSync(ali, v.replace(pathToFileURL(gcrAliasPath).href, pathToFileURL(gcr2).href)
                         .replace(pathToFileURL(srtAlias).href, pathToFileURL(srt2).href));
  try { return await import(pathToFileURL(ali).href); } finally { fs.unlinkSync(ali); fs.unlinkSync(gcr2); fs.unlinkSync(srt2); }
}
const hasTable = () => src.includes('function _gridTypeCanRead(');
const GRID_LINE_FIELDS_OF = (m) => m.__GLF;

/* ★K6-pre ★양성대조 — ★닻이 ★죽었을 때 ★K6 이 ★«조용히 초록»이 되지 ★않는가.
 *  ⛔1회로 안 닫는다 — ★×3. 까닭: 이 자리의 바닥이 ★«문자열 맞추기»라 ★한 번의 빨강은
 *    ★운일 수 있고(내 별건 명부: 양성대조도 1회로는 안 선다), ★세 꼴을 따로 묻는다:
 *    ㉠ 없는 이름 · ㉡ 옛 이름(실제로 사라진 그 이름) · ㉢ 여럿에 맞는 이름.
 *  ★이게 초록이면 「닻이 깨지면 ★[전제]가 ★운다」가 참이다 ⇒ K6 의 초록을 믿을 수 있다. */
test('K6-pre ★양성대조 ×3 — 선언 닻이 깨지면 «전제»가 크게 운다(조용한 초록 금지)', () => {
  const cases = [
    ['없는 이름',            '__nope_no_such_decl__'],
    ['옛 이름(T4② 가 지움)', 'ph'],
    ['여럿에 맞는 이름',      'h'],
  ];
  for (const [why, name] of cases) {
    assert.throws(() => replaceDeclLine(src, name, 'const x = 1;'),
      /\[전제\] 선언 닻/,
      `★«${why}» 로도 조용히 지나간다 — 닻이 깨져도 K6 이 초록이 된다`);
  }
  /* ★음성대조 — 살아 있는 이름은 ★통과해야 한다(자가 너무 넓으면 늘 빨강이다). */
  const out = replaceDeclLine(src, EMPTY_FRAME_DECL, "  const hCss = 'height:180px;';");
  assert.notEqual(out, src, '★살아 있는 닻으로도 소스가 안 바뀐다 — 갈아치기가 죽었다');
});

test('K6 ★파생 증명 — 렌더러의 «빈 틀 높이» 모드를 끈 대역에선 image 표에서 height 가 빠지고 K1 길이 빨개진다', async () => {
  assert.ok(hasTable(), '[전제] 종류 표(_gridTypeCanRead)가 없는 판 — 이 검사는 고친 판 전용');
  const real = await loadVariant('real');
  const dbl = await loadVariant('noEmptyH',
    s => replaceDeclLine(s, EMPTY_FRAME_DECL, "  const hCss = 'height:180px;';"));
  assert.equal(real.__typeCanRead('image', 'height'), true, '[전제] 진짜 렌더러에선 image 가 height 를 읽을 수 있다');
  assert.equal(dbl.__typeCanRead('image', 'height'), false, '★렌더러 모드를 껐는데 표가 안 바뀌었다 — 표가 렌더러에서 파생된 게 아니다');
  assert.equal(dbl.__typeCanRead('image', 'radius'), true, '[음성대조] 끈 모드와 무관한 키(radius)는 그대로');
  const { block } = dbl.makeGridBlock({ cols: [{ width: 1, lines: [{ type: 'image', imgSrc: PNG, height: 160 }] }] });
  dbl.updateGridBlock(block.id, { patchCell: { r: 0, c: 0, lineIndex: 0, type: 'body', text: 'x' } });
  assert.equal(dbl.getGridModel(block).cells[0][0].lines[0].height, 160, '★대역에서도 height 가 털렸다 — K1 이 표 말고 다른 것 때문에 초록이다');
});

test('K7 비용 — 표 뜨기는 종류마다 «한 번»(첫 부름 = 줄 필드 수만큼 렌더러 탐침 · 두 번째 = 0) · ms 는 찍기만', async () => {
  /* ★10-06 정정(lane-g15) — 옛 K7 은 «첫 부름 > 20ms 면 빨강»(벽시계 문턱)이었다. 전체 단위판(병렬 부하)에서 한 번 넘어 grid-render-gaps G5 가
     빨개졌다(unit-fix25-c4.log · 따로 돌리면 초록) — 부하에 흔들리는 자는 자가 아니다. ⇒ 결정적인 양(탐침 «호출 수»)으로 잰다.
     20ms 문턱은 커밋 전 «측정»으로 이미 냈다(첫 부름 0.12~0.57ms/종류 · 2ddf61e6 커밋 글). 여기선 ms 를 찍기만 한다. */
  assert.ok(hasTable(), '[전제] 종류 표가 없는 판');
  const N = '__kindShedProbeN';
  const fresh = await loadVariant('cost', s => s.replace('function _gridLineFieldIsRead(line, key) {', `function _gridLineFieldIsRead(line, key) { globalThis.${N} = (globalThis.${N} || 0) + 1;`));
  const nFields = [...GRID_LINE_FIELDS_OF(fresh)].filter(k => k !== 'type').length;
  const rows = [];
  for (const T of ['image', 'gap', 'divider', 'body', 'h1', 'h2', 'h3', 'caption', 'label', 'text']) {
    globalThis[N] = 0; const t0 = performance.now(); fresh.__typeCanRead(T, 'height'); const t1 = performance.now(); const first = globalThis[N];
    globalThis[N] = 0; fresh.__typeCanRead(T, 'width'); const t2 = performance.now(); const cached = globalThis[N];
    rows.push({ T, firstProbes: first, cachedProbes: cached, firstMs: +(t1 - t0).toFixed(2), cachedMs: +(t2 - t1).toFixed(3) });
  }
  console.log('K7-COST', JSON.stringify(rows));
  assert.deepEqual(rows.filter(r => r.firstProbes !== nFields).map(r => [r.T, r.firstProbes]), [], `★첫 부름의 탐침 수가 줄 필드 수(${nFields})가 아니다 — 표를 «한 번에» 안 뜬다`);
  assert.deepEqual(rows.filter(r => r.cachedProbes !== 0).map(r => [r.T, r.cachedProbes]), [], '★두 번째 부름이 다시 렌더러를 돌린다 — 기억(메모)이 안 된다');
});
