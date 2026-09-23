/* grid-render-gaps.test.js — 그리드 렌더러가 «조용히 삼키는» 자리들. (E-gridrender, 2026-09-23)
 * 실행: node --test tests/unit/grid-render-gaps.test.js
 * 기준선: 86dce84 · 나무: scratchpad/wt-e-gridrender
 *
 * ★★이 파일은 «고치지 않는다». 「지금 무엇이 빨강인가」를 먼저 세워 두는 그물이다.
 *   그래서 초록인 줄도 «일부러» 같이 넣었다 — 그게 대조다. 전부 빨갛기만 한 그물은
 *   고친 뒤에 「어디까지 안 건드렸나」를 못 말한다.
 *
 * ★재는 «양» — 「API 가 ok 를 줬다」가 아니라 «그려진 것»이다.
 *   이 파일은 renderGridBlock 이 내놓은 문자열 HTML 을 «줄 주소(data-r/data-c/data-line)»로
 *   잘라서 읽는다. 선례 = grid-applied-matches-screen.test.js(하네스를 그대로 베꼈다).
 *   ⛔새 하네스를 만들지 않았다 — loadGrid/makeFakeDom 은 그 파일과 «같은 표면»이다.
 *
 * ★명부로 잠근다, 수로 잠그지 않는다 — 아래 모든 명부는 «저장소에서» 떠 온다.
 *   STRUCT_KEYS  ← grid-block.js 의 `const structKeys = [...]`  (쓰기 경로 넷)
 *   CELL_FIELDS  ← grid-block.js 의 `GRID_CELL_FIELDS`
 *   VALIGN       ← grid-block.js 의 `_GRID_VALIGN`
 *   ALIGN_KEYS   ← js/props/_helpers.js 의 `ALIGN_ICONS['object-h']` (패널이 실제로 주는 값)
 *   POSITIVE_CONTROLS ← tests/unit/grid-*.test.* 의 「양성대조」 시험 이름 전부
 *
 * ── 축 여섯 ──────────────────────────────────────────────────────────────
 *   S  계측기 자가점검 — 내 자가 «같은 줄·앞 줄·다음 줄»에 안 속는가
 *   B  ① «새 동작»: 이미지 줄의 줄 단위 정렬        ★지금 빨강 (합성 교차 12칸 + 혼합 + 중첩)
 *   D  무변화 골든 — line.align «없는» 줄은 한 바이트도 안 바뀐다  ★지금 초록
 *   I  ④ 계측기 사각지대 — 고치고 나면 생길 «거짓 거절»을 미리 문다  ★I1 지금 빨강
 *   N  중첩 그리드(type:'duo') — 오늘 되는 것의 초록 잠금(요구 아님)
 *   G  ★남의 양성대조를 보호한다 + 245/245 등호 래칫
 *   X  ⛔범위 밖(테두리·잘못된 값 거절) — «요구 않음»(todo). 잰 값은 지우지 않고 남긴다.
 *
 * ★★이 그물이 세운 두 규율(2026-09-23 팀장 실측에서 온 것)
 *   ⑴ B축은 «저장본»으로 못 잰다. 현빈 계정 24 프로젝트에 그리드 9개·image 줄 «통틀어 1개»,
 *      그중 align 붙은 것 0 · widthPct<100 인 것 0 ⇒ 실저장본으로는 이 자리를 «한 번도»
 *      밟을 수 없다. ⛔「저장본이 다 초록」을 통과로 읽으면 «한 축의 0건 = 결함 0» 착각이다.
 *      ⇒ 그래서 B·D 는 전부 «내가 만든 합성 교차 픽스처»다.
 *   ⑵ 「무변화 0건」을 주장하는 줄 «앞»에 「내 자가 그 자리를 찾기는 하나」를 세운다(D0-a·D0-b).
 *      팀장의 1차 「0」이 «없어서 0» 이 아니라 «안 재서 0» 이었던 자리다.
 */
'use strict';
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { pathToFileURL } = require('url');
const { readSrc } = require('./_srcread.js');          // ⛔CRLF — win-portability ①-3
const { stripComments } = require('./_strip-comments.js');   // ⛔주석 거르개는 «공용 부품»만 쓴다

const ROOT = path.join(__dirname, '..', '..');
const UNIT_DIR = __dirname;
const SELF = path.basename(__filename);
const SRC_PATH = path.join(ROOT, 'js', 'blocks', 'grid-block.js');
const RAW = readSrc(SRC_PATH);
const HELPERS = readSrc(path.join(ROOT, 'js', 'props', '_helpers.js'));

const IMG_URL = 'https://example.com/gaps-probe.png';

/* ══ 미니 DOM — grid-applied-matches-screen.test.js 와 «같은 표면» ══════════ */
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
  const gcrAlias = path.join(os.tmpdir(), `gcr-gaps-${tag}.mjs`);
  const before2 = src;
  src = src.replace("from '../grid-cell-resize.js'", 'from ' + JSON.stringify(pathToFileURL(gcrAlias).href));
  assert.notEqual(src, before2, '★grid-cell-resize.js import 를 못 찾았다 — 행높이 상한 SSOT 가 끊겼나?');

  fs.copyFileSync(path.join(ROOT, 'js', 'grid-cell-resize.js'), gcrAlias);
  const alias = path.join(os.tmpdir(), `grid-gaps-${tag}.mjs`);
  fs.writeFileSync(alias, src);
  globalThis.document = makeFakeDom();
  globalThis.window = {};
  const mod = await import(pathToFileURL(alias).href);
  fs.unlinkSync(alias); fs.unlinkSync(gcrAlias);
  return mod;
}

let G;
before(async () => { G = await loadGrid(); });

/** 2열 1행. 칸(0,0)에 «글자 줄» 하나(CELL0), 칸(0,1)은 빈 칸. */
function fixture(mod = G) {
  const { block: b } = mod.makeGridBlock({ cols: [{ width: 1, lines: [] }, { width: 1, lines: [] }] });
  assert.ok(b && b.id, '★블록이 안 만들어졌다 — 아래 단언은 전부 «다른 이유»로 초록이 된다');
  mod.updateGridBlock(b.id, { patchCell: { r: 0, c: 0, lines: [{ type: 'body', text: 'CELL0' }] } });
  return b;
}

/* ══ 명부 — 전부 «저장소에서» 떠 온다. ⛔수를 박지 마라 ══════════════════ */

/** grid-patchcell-reject.test.js 의 declaredSet 와 «같은 수법»(Set 리터럴을 파싱). */
function declaredSet(src, name) {
  const m = src.match(new RegExp(`const ${name} = new Set\\(\\[([\\s\\S]*?)\\]\\)`));
  assert.ok(m, `★${name} 상수를 못 찾았다 — 이름이 바뀌었거나 사라졌다. 아래 명부 검사는 전부 무의미하다`);
  return [...new Set([...m[1].matchAll(/'([\w]+)'/g)].map(x => x[1]))];
}
const CELL_FIELDS = declaredSet(RAW, 'GRID_CELL_FIELDS');

/** `const _GRID_VALIGN = { top: 'flex-start', … }` → {키: CSS값} */
function valignMap(src) {
  const m = src.match(/const _GRID_VALIGN = \{([^}]*)\}/);
  assert.ok(m, '★_GRID_VALIGN 를 못 찾았다 — 세로정렬 명부의 출처가 사라졌다');
  const out = {};
  for (const mm of m[1].matchAll(/(\w+)\s*:\s*'([\w-]+)'/g)) out[mm[1]] = mm[2];
  return out;
}
const VALIGN = valignMap(RAW);
const VALIGN_KEYS = Object.keys(VALIGN);

/** `const structKeys = ['cols', 'patchCol', 'cells', 'patchCell']` — «쓰기 경로»의 명부. */
function structKeys(src) {
  const m = src.match(/const structKeys = \[([^\]]*)\]/);
  assert.ok(m, '★structKeys 를 못 찾았다 — 쓰기 경로 명부의 출처가 사라졌다');
  return [...m[1].matchAll(/'(\w+)'/g)].map(x => x[1]);
}
const STRUCT_KEYS = structKeys(RAW);

/** `ALIGN_ICONS['object-h']` 의 키 — 패널이 «실제로 주는» 정렬 값(js/props/_helpers.js SSOT). */
function iconFamilyKeys(src, family) {
  const at = src.indexOf(`'${family}': {`);
  assert.ok(at >= 0, `★ALIGN_ICONS['${family}'] 를 못 찾았다 — 정렬 명부의 출처가 사라졌다`);
  const start = src.indexOf('{', at);
  let depth = 0, end = -1;
  for (let i = start; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
  }
  assert.ok(end > start, `★ALIGN_ICONS['${family}'] 의 괄호를 못 닫았다 — 파싱이 깨졌다`);
  return [...new Set([...src.slice(start + 1, end).matchAll(/(?:^|\n)\s*'?([a-z-]+)'?\s*:/g)].map(m => m[1]))];
}
const ALIGN_KEYS = iconFamilyKeys(HELPERS, 'object-h');   // left|center|right
const VALIGN_ICON_KEYS = iconFamilyKeys(HELPERS, 'object-v');

/* ══ 화면을 «자르는» 자 — 단언의 반대쪽은 늘 여기서 온다 ══════════════════ */

/** 한 «줄»의 여는 태그. 주소(data-r/data-c/data-line)로 집는다 — DOM 순서 추측 안 한다. */
function lineTagAt(b, r, c, li) {
  const needle = ` data-r="${r}" data-c="${c}" data-line="${li}"`;
  const at = b.innerHTML.indexOf(needle);
  if (at < 0) return null;
  assert.equal(b.innerHTML.indexOf(needle, at + 1), -1,
    `★줄 주소 (${r},${c},${li}) 가 화면에 두 번 나온다 — 이 자가 «어느 쪽»을 잰 건지 알 수 없다`);
  const open = b.innerHTML.lastIndexOf('<', at);
  const close = b.innerHTML.indexOf('>', at);
  assert.ok(open >= 0 && close > open, `★줄 (${r},${c},${li}) 의 태그 경계를 못 찾았다`);
  return b.innerHTML.slice(open, close + 1);
}

/** 한 «칸»의 여는 태그(여기 background/padding/border-radius 가 실린다). */
function cellTagAt(b, r, c) {
  const re = new RegExp(`<div class="grd-cell[^"]*" data-r="${r}" data-c="${c}"[^>]*>`);
  const m = b.innerHTML.match(re);
  assert.ok(m, `★칸 (${r},${c}) 의 여는 태그를 못 찾았다 — 렌더 골격이 바뀌었나?`);
  return m[0];
}

/** 한 «칸»의 속(그 칸의 여는 태그부터 다음 칸 직전까지). */
function cellHtmlAt(b, r, c) {
  const tag = cellTagAt(b, r, c);
  const start = b.innerHTML.indexOf(tag);
  const nextCell = b.innerHTML.indexOf('<div class="grd-cell', start + tag.length);
  return b.innerHTML.slice(start, nextCell < 0 ? undefined : nextCell);
}

const imgTagsIn = (html) => html.match(/<img[^>]*>/g) || [];
const cssOf = (tag, prop) => {
  const m = tag && tag.match(new RegExp(`(?:^|[;"])${prop}:([^;"]*)`));
  return m ? m[1] : null;
};
const isCentered = (tag) => /margin-left:auto;margin-right:auto/.test(tag || '');
const isRightPushed = (tag) => /margin-left:auto(?!;margin-right)/.test(tag || '');

/* 쓰기 경로 넷 — 셀/열 수준 필드를 칸(0,0)에 «싣는» 네 가지 길. 전부 CELL0 줄을 살려 둔다. */
const SEED_LINE = () => [{ type: 'body', text: 'CELL0' }];
const WRITE_PATHS = [
  { key: 'patchCell', send: (m, b, f) => m.updateGridBlock(b.id, { patchCell: { r: 0, c: 0, ...f } }) },
  { key: 'patchCol', send: (m, b, f) => m.updateGridBlock(b.id, { patchCol: { index: 0, ...f } }) },
  { key: 'cols', send: (m, b, f) => m.updateGridBlock(b.id, { cols: [{ width: 1, lines: SEED_LINE(), ...f }, { width: 1, lines: [] }] }) },
  { key: 'cells', send: (m, b, f) => m.updateGridBlock(b.id, { cells: [[{ lines: SEED_LINE(), ...f }, { lines: [] }]] }) },
];

/** 「거절했거나, 최소한 «안 됐다»고 일러 줬는가」. 둘 다 아니면 «조용히 삼킨» 것이다. */
function rejectedOrReported(res, field) {
  if (res.ok === false) return true;
  return Array.isArray(res.ignoredProps) && res.ignoredProps.some(p => p.split('.').pop() === field);
}

/* ═══════════════════════════════════════════════════════════════════════
   S — ★계측기 자가점검. 내 자가 «같은 줄·앞 줄·다음 줄»에 안 속는가
   ⛔이게 빨가면 아래 R/B/V/N 의 초록·빨강은 전부 «다른 이유»일 수 있다.
   ═══════════════════════════════════════════════════════════════════════ */

test('S1 ★자가점검 — 똑같이 생긴 세 줄에서 «가운데 줄»만 집는다', () => {
  const b = fixture();
  const r = G.updateGridBlock(b.id, {
    patchCell: {
      r: 0, c: 0, lines: [
        { type: 'body', text: 'SAME' },
        { type: 'body', text: 'SAME', fontSize: 41 },   // ★가운데 줄에만 탐침
        { type: 'body', text: 'SAME' },
      ],
    },
  });
  assert.equal(r.ok, true, `★자가점검 판이 안 깔린다: ${r.message}`);

  const t0 = lineTagAt(b, 0, 0, 0), t1 = lineTagAt(b, 0, 0, 1), t2 = lineTagAt(b, 0, 0, 2);
  assert.ok(t0 && t1 && t2, '★세 줄 중 못 집은 것이 있다');
  assert.equal(cssOf(t1, 'font-size'), '41px', '★탐침을 얹은 «가운데 줄»을 못 집었다');
  assert.notEqual(cssOf(t0, 'font-size'), '41px', '★«앞 줄»을 가운데 줄로 읽었다 — 이 자는 못 믿는다');
  assert.notEqual(cssOf(t2, 'font-size'), '41px', '★«다음 줄»을 가운데 줄로 읽었다 — 이 자는 못 믿는다');
  assert.notEqual(t0, t2, '★글자가 같은 첫 줄과 끝 줄이 «같은 것»으로 나온다 — 주소를 안 보고 있다');
});

test('S2 ★자가점검 — 이웃 «칸»이 새지 않는다', () => {
  const b = fixture();
  G.updateGridBlock(b.id, { patchCell: { r: 0, c: 1, lines: [{ type: 'body', text: 'NEIGHBOUR' }] } });
  const c0 = cellHtmlAt(b, 0, 0), c1 = cellHtmlAt(b, 0, 1);
  assert.match(c0, /CELL0/, '★칸(0,0) 을 잘랐는데 제 내용이 없다');
  assert.doesNotMatch(c0, /NEIGHBOUR/, '★칸(0,0) 에 이웃 칸 내용이 섞여 들어온다');
  assert.match(c1, /NEIGHBOUR/, '★칸(0,1) 을 잘랐는데 제 내용이 없다');
  assert.doesNotMatch(c1, /CELL0/, '★칸(0,1) 에 앞 칸 내용이 섞여 들어온다');
});

test('S3 ★자가점검 — 없는 줄을 물으면 «없다»가 나온다(이웃으로 안 떨어진다)', () => {
  const b = fixture();
  assert.equal(lineTagAt(b, 0, 0, 9), null, '★없는 줄 번호에 «무언가»를 돌려준다 — 부재 단언이 전부 거짓이 된다');
  assert.equal(lineTagAt(b, 0, 1, 0), null, '★빈 칸에 줄이 있다고 한다');
  assert.ok(lineTagAt(b, 0, 0, 0), '★있는 줄을 «없다»고 한다 — 이 자는 반대로도 틀린다');
});

test('S4 ★자가점검 — 명부가 «저장소에서» 떠졌고, 두 출처가 같은 말을 한다', () => {
  assert.ok(CELL_FIELDS.length > 0, '★GRID_CELL_FIELDS 명부가 비었다');
  assert.ok(VALIGN_KEYS.length > 0, '★_GRID_VALIGN 명부가 비었다');
  assert.ok(ALIGN_KEYS.length > 0, "★ALIGN_ICONS['object-h'] 명부가 비었다");
  assert.deepEqual(STRUCT_KEYS.slice().sort(), WRITE_PATHS.map(p => p.key).sort(),
    '★구현이 받는 «구조 쓰기 경로»와 이 파일이 재는 경로가 어긋났다.\n'
    + `  구현: ${STRUCT_KEYS.join(', ')}\n  이 파일: ${WRITE_PATHS.map(p => p.key).join(', ')}\n`
    + '  ⇒ 경로가 하나 늘었으면 그 길로도 같은 질문을 물어야 한다(안 그러면 그 길은 «안 잰 축»이다)');
  assert.deepEqual(VALIGN_KEYS.slice().sort(), VALIGN_ICON_KEYS.slice().sort(),
    "★렌더러의 _GRID_VALIGN 과 패널의 ALIGN_ICONS['object-v'] 가 어긋났다 — 어느 쪽이 참인지 모른다");
  // 아래 B·V 가 쓰는 탐침 이름이 «진짜 필드»가 아님을 확인한다(탐침이 오염되면 그 검사는 헛것이다)
  assert.ok(!CELL_FIELDS.includes('gdtProbeCellField'), '★탐침 이름이 실제 필드가 됐다 — 탐침을 바꿔라');
  assert.ok(!CELL_FIELDS.includes('border'),
    `★'border' 가 이미 칸 필드 명부에 있다 — B 축의 전제(«명부에 없다»)가 깨졌다. 지금 명부: ${CELL_FIELDS.join(', ')}`);
});

/* ═══════════════════════════════════════════════════════════════════════
   B — ① «새 동작»: 이미지 줄의 줄 단위 정렬
   글자 줄: `const align = line.align || colAlign || 'left'`  ⇒ 줄마다 된다
   이미지 줄: `colAlign` 만 본다                               ⇒ 한 칸에서 못 섞는다

   ⛔★이 축은 «저장본»으로 못 잰다 — 팀장 실측(2026-09-23, 현빈 계정 24 프로젝트 읽기만):
        그리드 블럭 9개 · image 줄 «통틀어 1개» · 그중 align 붙은 것 0 · widthPct<100 인 것 0
      ⇒ 「글자 왼쪽 ＋ 이미지 가운데」를 실저장본으로는 «한 번도» 밟을 수 없다.
      ⇒ ⛔「저장본이 다 초록이다」를 이 축의 통과로 읽지 마라 — 그건 «한 축의 0건을 결함 0으로»
        착각하는 그 자리다. 그래서 아래는 전부 «내가 만든 합성 픽스처»다:
          칸 정렬 3종(ALIGN_KEYS) × widthPct {50,100} × {그림 있음, 빈 슬롯} = 12 칸
   ★기대값을 «손으로» 적지 않는다 — 「줄 정렬 L 을 준 결과」는 「칸 정렬이 L 이었을 때의 결과」와
     «바이트 동일»이어야 한다. 그 오른쪽은 D축 골든이 잠가 둔, 이미 믿을 수 있는 산출이다.
     ⇒ CSS 문자열이 이 파일에 한 글자도 안 박힌다(늙지 않는다).
   ═══════════════════════════════════════════════════════════════════════ */

const IMG_LINE = (wp, kind) => (kind === 'img'
  ? { type: 'image', imgSrc: IMG_URL, widthPct: wp }
  : { type: 'image', widthPct: wp, height: 120 });

/** 칸 정렬 `ca` 인 칸에 줄 하나를 얹고, 그 줄의 여는 태그를 돌려준다(«그려진 것»). */
function renderOneLine(mod, ca, line) {
  const b = fixture(mod);
  const r = mod.updateGridBlock(b.id, { patchCell: { r: 0, c: 0, align: ca, lines: [line] } });
  assert.equal(r.ok, true, `★판을 못 깔았다(칸 정렬 ${ca}): ${r.message}`);
  const tag = lineTagAt(b, 0, 0, 0);
  assert.ok(tag, `★줄이 아예 안 그려졌다(칸 정렬 ${ca})`);
  return tag;
}

const B_CASES = [];
for (const ca of ALIGN_KEYS) for (const wp of [50, 100]) for (const kind of ['img', 'empty']) B_CASES.push({ ca, wp, kind });

for (const { ca, wp, kind } of B_CASES) {
  test(`B[칸:${ca}|wp:${wp}|${kind}] ★줄 정렬이 칸 정렬을 «갈음»하는가`, () => {
    for (const L of ALIGN_KEYS) {
      const want = renderOneLine(G, L, IMG_LINE(wp, kind));                    // 칸 정렬이 L 이었다면
      const got = renderOneLine(G, ca, { ...IMG_LINE(wp, kind), align: L });   // 칸은 ca, 줄만 L
      assert.equal(got, want,
        `★칸 정렬 '${ca}' 안에서 이미지 줄에 align:'${L}' 을 줬는데 «칸 정렬이 ${L} 이었을 때»와 다르다.\n`
        + `  나온 것 : ${got}\n  나와야 할 것: ${want}\n`
        + '  ⇒ 이미지 분기가 line.align 을 안 읽고 colAlign 만 본다(글자 줄은 같은 칸에서 된다 — B-혼합 참조)');
    }
  });
}

test('B-혼합 ★「글자 왼쪽 ＋ 이미지 가운데」가 한 칸에서 되는가(이 카드의 머리)', () => {
  const b = fixture();
  const r = G.updateGridBlock(b.id, {
    patchCell: {
      r: 0, c: 0, align: 'left', lines: [
        { type: 'body', text: 'LEFTTEXT', align: 'left' },
        { type: 'image', imgSrc: IMG_URL, widthPct: 50, align: 'center' },
      ],
    },
  });
  assert.equal(r.ok, true, `★판을 못 깔았다: ${r.message}`);
  // ⑴ 같은 칸·같은 호출에서 글자 줄은 «줄 단위»가 된다 — 이 초록이 아래 빨강의 대조다.
  assert.equal(cssOf(lineTagAt(b, 0, 0, 0), 'text-align'), 'left', '★글자 줄의 줄 단위 정렬부터 안 된다 — 진단이 다르다');
  /* ⛔견줄 것은 «같은 주소»에서 떠야 한다 — 기준을 줄 0 에서 뜨면 data-line 이 달라서
     «정렬과 무관한 이유»로 빨개진다(첫 판에서 이 파일이 실제로 그렇게 틀렸다). */
  const ref = fixture();
  G.updateGridBlock(ref.id, {
    patchCell: {
      r: 0, c: 0, align: 'center', lines: [
        { type: 'body', text: 'LEFTTEXT', align: 'left' },
        { type: 'image', imgSrc: IMG_URL, widthPct: 50 },   // ★칸 정렬이 가운데였다면
      ],
    },
  });
  const img = lineTagAt(b, 0, 0, 1);
  assert.equal(img, lineTagAt(ref, 0, 0, 1),
    `★이미지 줄에 align:'center' 를 줬는데 가운데로 안 간다.\n  실제 산출: ${img}\n`
    + '  ⇒ 「글자 왼쪽 ＋ 이미지 가운데」가 한 칸에서 «불가능»하다');
});

test('B-대조(계측기) ★글자 줄은 «줄 단위»로 칸 정렬을 되돌린다', () => {
  const b = fixture();
  G.updateGridBlock(b.id, {
    patchCell: { r: 0, c: 0, align: 'center', lines: [{ type: 'body', text: 'RIGHTY', align: 'right' }] },
  });
  assert.equal(cssOf(lineTagAt(b, 0, 0, 0), 'text-align'), 'right',
    '★글자 줄마저 줄 단위 정렬이 안 된다 — 그러면 B 의 빨강은 «이미지만의 문제»가 아니다');
});

test('B-중첩 ★중첩(type:\'duo\') 안의 이미지도 같은 자리다', () => {
  const b = fixture();
  G.updateGridBlock(b.id, {
    patchCell: {
      r: 0, c: 0, lines: [{
        type: 'duo',
        cols: [{ width: 1, align: 'left', lines: [{ type: 'image', imgSrc: IMG_URL, widthPct: 50, align: 'center' }] }],
      }],
    },
  });
  const imgs = imgTagsIn(cellHtmlAt(b, 0, 0));
  assert.equal(imgs.length, 1, '★중첩 안 이미지가 안 그려졌다 — 이 줄은 다른 것을 재고 있다');
  assert.ok(isCentered(imgs[0]), `★중첩 칸 안에서도 이미지 줄 정렬이 무시된다.\n  실제 산출: ${imgs[0]}`);
});

/* ═══════════════════════════════════════════════════════════════════════
   D — «무변화» 골든. line.align 이 «없는» 이미지 줄의 산출은 한 바이트도 안 바뀐다.
   기준선 86dce84 에서 뜬 12 칸(칸 정렬 3 × wp{50,100} × {그림, 빈 슬롯}).

   ⛔★「무변화 0건」을 주장하는 줄 «앞»에 「내 자가 그 자리를 찾기는 하나」를 세운다.
     팀장 실측에서 1차 「0」이 «없어서 0» 이 아니라 «안 재서 0» 이었다(저장본의 그리드가
     `proj.json → pages[] → HTML 문자열 «안»의 이스케이프된 data-cols` 라 파일 전체 정규식엔
     한 개도 안 걸렸다). 자가 선다는 것부터 증명한 뒤에야 0 을 보고해야 한다.
       D0-a  내 자가 12 칸을 «실제로» 이미지 줄로 집는가 (셈이 0 이면 D1 은 헛것이다)
       D0-b  내 비교기가 «변화를 잡기는» 하는가 (한 칸을 일부러 흔들면 빨개지는가)
   ═══════════════════════════════════════════════════════════════════════ */

/** ★기준선 86dce84 실측. ⛔여기 수를 «손으로» 고치지 마라 — 고칠 일이 생겼다면
 *  그건 「line.align 없는 이미지 줄의 산출이 바뀌었다」는 뜻이고, 그게 이 골든이 막는 것이다. */
const D_GOLDEN = {
  'left|50|img':
    '<img data-r="0" data-c="0" data-line="0" class="grd-img" src="https://example.com/gaps-probe.png" draggable="false" style="display:block;width:50%;height:auto;">',
  'left|50|empty':
    '<div data-r="0" data-c="0" data-line="0" class="grd-img grd-img-empty" style="width:50%;height:120px;background:#e8e8e8;border-radius:8px;">',
  'left|100|img':
    '<img data-r="0" data-c="0" data-line="0" class="grd-img" src="https://example.com/gaps-probe.png" draggable="false" style="display:block;width:100%;height:auto;">',
  'left|100|empty':
    '<div data-r="0" data-c="0" data-line="0" class="grd-img grd-img-empty" style="width:100%;height:120px;background:#e8e8e8;border-radius:8px;">',
  'center|50|img':
    '<img data-r="0" data-c="0" data-line="0" class="grd-img" src="https://example.com/gaps-probe.png" draggable="false" style="display:block;width:50%;height:auto;margin-left:auto;margin-right:auto;">',
  'center|50|empty':
    '<div data-r="0" data-c="0" data-line="0" class="grd-img grd-img-empty" style="width:50%;height:120px;background:#e8e8e8;border-radius:8px;margin-left:auto;margin-right:auto;">',
  'center|100|img':
    '<img data-r="0" data-c="0" data-line="0" class="grd-img" src="https://example.com/gaps-probe.png" draggable="false" style="display:block;width:100%;height:auto;">',
  'center|100|empty':
    '<div data-r="0" data-c="0" data-line="0" class="grd-img grd-img-empty" style="width:100%;height:120px;background:#e8e8e8;border-radius:8px;">',
  'right|50|img':
    '<img data-r="0" data-c="0" data-line="0" class="grd-img" src="https://example.com/gaps-probe.png" draggable="false" style="display:block;width:50%;height:auto;margin-left:auto;">',
  'right|50|empty':
    '<div data-r="0" data-c="0" data-line="0" class="grd-img grd-img-empty" style="width:50%;height:120px;background:#e8e8e8;border-radius:8px;margin-left:auto;">',
  'right|100|img':
    '<img data-r="0" data-c="0" data-line="0" class="grd-img" src="https://example.com/gaps-probe.png" draggable="false" style="display:block;width:100%;height:auto;">',
  'right|100|empty':
    '<div data-r="0" data-c="0" data-line="0" class="grd-img grd-img-empty" style="width:100%;height:120px;background:#e8e8e8;border-radius:8px;">',
};

const dKey = ({ ca, wp, kind }) => `${ca}|${wp}|${kind}`;

test('D0-a ★양성대조(먼저) — 내 자가 12 칸을 «실제로» 이미지 줄로 집는가', () => {
  assert.equal(B_CASES.length, Object.keys(D_GOLDEN).length,
    '★골든 표와 교차 칸 수가 어긋났다 — 정렬 명부가 늘었으면 골든도 같이 떠야 한다');
  let found = 0;
  for (const cs of B_CASES) {
    const tag = renderOneLine(G, cs.ca, IMG_LINE(cs.wp, cs.kind));
    assert.match(tag, /class="grd-img/, `★${dKey(cs)} 가 «이미지 줄»로 안 나왔다 — 이 자는 다른 것을 재고 있다`);
    assert.ok(Object.prototype.hasOwnProperty.call(D_GOLDEN, dKey(cs)), `★골든에 ${dKey(cs)} 칸이 없다`);
    found++;
  }
  assert.ok(found > 0, '★한 칸도 못 집었다 — 아래 D1 의 「무변화 0건」은 «안 재서 0» 이다');
});

test('D0-b ★양성대조(먼저) — 내 비교기가 «변화»를 잡기는 하는가', () => {
  const cs = B_CASES.find(c => c.wp === 50 && c.kind === 'img' && c.ca === 'center');
  assert.ok(cs, '★탐침으로 쓸 칸을 못 찾았다');
  const shaken = renderOneLine(G, cs.ca, { ...IMG_LINE(cs.wp, cs.kind), widthPct: 60 });
  assert.notEqual(shaken, D_GOLDEN[dKey(cs)],
    '★일부러 흔든 칸이 골든과 «같다»고 나온다 — 이 비교기는 아무 변화도 못 잡는다(D1 은 언제나 초록)');
});

for (const cs of B_CASES) {
  test(`D[${dKey(cs)}] ★무변화 — line.align 없는 이미지 줄은 한 바이트도 안 바뀐다`, () => {
    assert.equal(renderOneLine(G, cs.ca, IMG_LINE(cs.wp, cs.kind)), D_GOLDEN[dKey(cs)],
      '★기존 저장본이 «로드만으로» 흔들린다 — 줄 정렬을 얹으면서 «안 준 줄»의 산출까지 바꿨다');
  });
}

/* ═══════════════════════════════════════════════════════════════════════
   I — ④ 계측기 사각지대. `_gridLineFieldIsRead` 는 정렬을 잴 때 «한 문맥»(colAlign:'left')만
   넣고 시험한다. ⇒ ① 을 고치고 나면 「칸이 가운데인데 이미지 줄만 왼쪽」이 «화면은 바뀌는데»
   거짓 거절(ok:false)된다. 그 자리를 «여기서» 문다.
   ⛔전역 탐침(_GRID_FIELD_PROBES)은 건드리지 마라 — 모든 필드 판정에 걸린다.
     오늘 이 레포에서 넓은 처방이 남의 양성대조 넷을 먹은 자리다(I3 가 그것을 잠근다).
   ═══════════════════════════════════════════════════════════════════════ */

test("I1 ★「칸은 가운데, 이미지 줄만 왼쪽」이 ok:true 여야 한다(거짓 거절 금지)", () => {
  const b = fixture();
  G.updateGridBlock(b.id, {
    patchCell: { r: 0, c: 0, align: 'center', lines: [{ type: 'image', imgSrc: IMG_URL, widthPct: 50 }] },
  });
  const r = G.updateGridBlock(b.id, { patchCell: { r: 0, c: 0, lineIndex: 0, align: 'left' } });
  assert.equal(r.ok, true,
    `★화면이 «실제로 바뀌는» 요청을 거절했다: ${r.message}\n`
    + '  ⇒ 판정기가 colAlign:\'left\' 한 문맥만 넣고 재서, 칸이 가운데일 때의 차이를 못 본다.\n'
    + '  ⛔고칠 곳은 «정렬을 재는 문맥»이지 전역 탐침(_GRID_FIELD_PROBES)이 아니다(I3 참조)');
  assert.ok(!isCentered(lineTagAt(b, 0, 0, 0)),
    '★ok 를 줬는데 화면은 여전히 가운데다 — 통과가 곧 반영은 아니다');
});

test('I2 ★짝 — «진짜» 안 읽는 필드는 이미지 줄에서 여전히 거절돼야 한다', () => {
  const b = fixture();
  G.updateGridBlock(b.id, {
    patchCell: { r: 0, c: 0, lines: [{ type: 'image', imgSrc: IMG_URL, widthPct: 50 }] },
  });
  const r = G.updateGridBlock(b.id, { patchCell: { r: 0, c: 0, lineIndex: 0, fontSize: 40 } });
  assert.equal(r.ok, false,
    '★이미지 줄에 fontSize 를 줬는데 통과했다 — I1 을 열어 주면서 관문을 «통째로» 연 것이다');
  assert.match(r.message, /type:'image'/, '★«왜» 안 되는지(줄 종류)를 안 말한다');
});

/** ⛔전역 탐침은 «명부»로 잠근다 — 여기 손대면 모든 필드 판정이 같이 흔들린다. */
function fieldProbes(src) {
  const m = src.match(/const _GRID_FIELD_PROBES = \[([^\]]*)\]/);
  assert.ok(m, '★_GRID_FIELD_PROBES 를 못 찾았다 — 이 잠금은 아무것도 안 지킨다');
  return m[1].split(',').map(s => s.trim()).filter(Boolean);
}

test('I3 ★전역 탐침(_GRID_FIELD_PROBES)이 그대로인가 — 넓은 처방 금지', () => {
  /* ⚠️첫 탐침은 «보이는 대로»가 아니다 — 기준선 86dce84 의 소스에 U+0001 두 개가 박혀 있다
     (js/blocks/grid-block.js:280, 이 파일 전체에서 «유일한» 제어문자 둘). 탐침값은 「아무 값이나」면
     되는 자리라 동작엔 해가 없지만, 눈에 안 보이는 글자가 제품 소스에 있다는 사실은 적어 둔다.
     ⛔그래서 여기서 '\u0001' 을 «지우지» 마라 — 지우면 이 잠금이 아니라 제품 소스를 고치는 일이다. */
  assert.deepEqual(fieldProbes(RAW), ["'\u0001gdt\u0001'", "'gdt-probe'", '41.5', '3', 'true', 'false', 'null'],
    '★전역 탐침이 바뀌었다. 이것은 «모든» 필드 판정에 걸린다 — I1 하나를 열려고 여기를 건드리면\n'
    + '  남의 양성대조가 조용히 죽는다(오늘 이 레포에서 실제로 넷이 죽었다).\n'
    + '  ⇒ 고칠 곳은 «정렬을 재는 문맥»이다. 여기가 아니다.');
});

/* ══ ⛔범위 밖(2026-09-23 팀장 확정) — «요구하지 않는다», 다만 «잰 값»은 남긴다 ══════
   · 테두리  — 스펙만 확정(borderWidth 숫자 px ＋ borderColor). 판정은 그 카드가 한다.
   · 잘못된 «값» 거절 — 따로 설 카드.
   · 중첩 그리드 — 다른 워커가 «앱에서» 재는 중.
   ⇒ 아래 X* 줄 중 «지금 빨강»인 것은 todo 로 단다: 실패로 세지 않되 화면에서 안 사라진다
     (결함만 올리고 장부가 안 닫히는 것을 막는 이 레포 규약 — 조용히 빼지 않는다).
   ⇒ «지금 초록»인 X* 줄은 그대로 둔다 — 새 동작을 요구하는 게 아니라 오늘 되는 것을 잠그는 자물쇠다.
   ⇒ N* (중첩)도 같은 까닭으로 초록 잠금만 남긴다. */
const OUT_OF_SCOPE = { todo: '범위 밖 — 따로 설 카드가 판정한다(측정값은 남겨 둔다)' };

/* ★★2026-09-24 — «따로 설 카드»가 섰다. T-170·175·176·180 (단위 U-33, 브랜치 fix/0924-u-gate).
 *   ⇒ 아래 셋은 더 이상 todo 가 «아니다» — 요구다. 셋 다 고치기 «전»에 빨갰다는 기록:
 *       기준 7780267 · `npm test` · todo 14 중 «열» 개가 이 셋이었다
 *       (X테두리명부-patchCol·cols 2 · X값-넷 4 · X정렬값-넷 4).
 *   ⛔남은 넷(X테두리-* ㈎ 「테두리가 그려지는가」)은 그대로 todo 다 — 그건 T-172 의 몫이고
 *     «새 칸 필드를 만드는» 일이라 이 판의 범위가 아니다. 조용히 빼지 않고 여기 적어 둔다.
 *   ★갈린 잣대: 이 판은 「모르는 것을 «막거나 말한다»」이고, T-172 는 「새 것을 «그린다»」다. */

/* ═══════════════════════════════════════════════════════════════════════
   B — ② 칸 `border`
   ㈎ 테두리를 주면 실제로 «그려지나»
   ㈏ 모르는 «칸» 필드를 «거절하나» — 줄 필드는 이미 제대로 거절한다(B4 가 그 대조)
   ★쓰기 경로 넷을 «전부» 묻는다. 한 길만 재면 나머지 셋에서 속는다.
   ═══════════════════════════════════════════════════════════════════════ */

for (const p of WRITE_PATHS) {
  test(`X테두리-${p.key} ★㈎ 칸에 테두리를 주면 «그려지는가»`, OUT_OF_SCOPE, () => {
    const b = fixture();
    const res = p.send(G, b, { border: '2px solid #ff0000' });
    const tag = cellTagAt(b, 0, 0);
    assert.match(tag, /border:/,
      `★'${p.key}' 로 테두리를 줬는데 칸에 안 그려진다(ok:${res.ok}).\n`
      + `  칸 태그: ${tag}\n  ⇒ 칸 필드 명부(${CELL_FIELDS.join(', ')})에 border 가 없고, 렌더러도 안 그린다`);
  });
}

for (const p of WRITE_PATHS) {
  test(`X테두리명부-${p.key} ★㈏ 모르는 «칸» 필드를 거절하거나, 최소한 «안 됐다»고 하는가`,
    () => {
    const b = fixture();
    const res = p.send(G, b, { gdtProbeCellField: 'gdt-probe-value' });
    assert.ok(rejectedOrReported(res, 'gdtProbeCellField'),
      `★'${p.key}' 는 모르는 칸 필드를 «조용히» 받았다 — ok:${res.ok}, ignoredProps:${JSON.stringify(res.ignoredProps)}.\n`
      + '  ⇒ 부르는 쪽은 됐다고 믿고 넘어가는데 화면은 그대로다(2026-09-09 에 막은 거짓 성공과 같은 모양)');
    assert.doesNotMatch(JSON.stringify(res.applied || {}), /gdt-probe-value/,
      `★'${p.key}' 가 «안 그려진 값»을 applied 에 담아 돌려줬다 — 답 안에서 자기모순이다`);
    assert.doesNotMatch(b.innerHTML, /gdt-probe-value/, '★모르는 필드가 화면에 나왔다 — 진단이 반대다');
  });
}

test('X테두리-대조 ★ — 명부에 «있는» 칸 필드는 넷 다 통과하고 실제로 그려진다', () => {
  for (const p of WRITE_PATHS) {
    const b = fixture();
    const res = p.send(G, b, { bg: '#123456', padding: 12, radius: 8 });
    assert.equal(res.ok, true, `★'${p.key}' 가 멀쩡한 칸 필드를 막았다: ${res.message}`);
    const tag = cellTagAt(b, 0, 0);
    assert.match(tag, /background:#123456/, `★'${p.key}': bg 가 안 그려진다 — 이 경로는 원래 안 닿는 길인가?`);
    assert.match(tag, /padding:12px/, `★'${p.key}': padding 이 안 그려진다`);
    assert.match(tag, /border-radius:8px/, `★'${p.key}': radius 가 안 그려진다`);
  }
});

test('X줄축-대조 ★ — «줄» 축은 이미 제대로 거절한다(칸 축에 세울 꼴이 이것이다)', () => {
  const b = fixture();
  const a = G.updateGridBlock(b.id, { patchCell: { r: 0, c: 0, lineIndex: 0, padding: 8 } });
  assert.equal(a.ok, false, '★칸 필드를 «줄»에 줬는데 통과했다 — 이 대조 자체가 성립 안 한다');
  assert.match(a.message, /CELL field, not a line field/, '★«어느 축의 필드인지»를 안 말한다');
  assert.match(a.message, /drop lineIndex/, '★«무엇을 하라»까지 안 말한다');

  const c = G.updateGridBlock(b.id, { patchCell: { r: 0, c: 0, fontSize: 30 } });
  assert.equal(c.ok, false, '★줄 필드를 «칸»에 줬는데 통과했다');
  assert.match(c.message, /lineIndex/, '★반대 방향에서 «어디로 보내라»를 안 말한다');
});

/* ═══════════════════════════════════════════════════════════════════════
   V — ③ 잘못된 «값»도 조용히 삼킨다
   이름은 명부에 있다. 값이 명부 밖이다. 블록 축(valign)은 값을 검사하는데,
   칸 축은 안 한다 — 같은 이름, 다른 규칙.
   ═══════════════════════════════════════════════════════════════════════ */

for (const p of WRITE_PATHS) {
  test(`X값-${p.key} ★칸 세로정렬에 명부 밖 값('center')을 주면 «조용히» 위로 떨어진다`, () => {
    assert.ok(!VALIGN_KEYS.includes('center'),
      `★'center' 가 세로정렬 명부에 들어왔다 — 이 검사의 전제가 바뀌었다(지금 명부: ${VALIGN_KEYS.join('|')})`);
    const b = fixture();
    const res = p.send(G, b, { valign: 'center' });
    const now = cssOf(cellTagAt(b, 0, 0), 'justify-content');

    assert.ok(rejectedOrReported(res, 'valign'),
      `★'${p.key}' 가 명부 밖 값을 «조용히» 받았다 — ok:${res.ok}, ignoredProps:${JSON.stringify(res.ignoredProps)}.\n`
      + `  화면은 justify-content:${now}(= '${VALIGN_KEYS.find(k => VALIGN[k] === now)}') 로 떨어졌다.\n`
      + `  ⇒ 세로정렬 명부는 ${VALIGN_KEYS.join('|')} 다. 블록 축은 이 값을 «거절한다»(V3) — 칸 축만 안 한다`);
    assert.doesNotMatch(JSON.stringify(res.applied || {}), /"valign":"center"/,
      `★'${p.key}' 가 «안 먹은 값»을 applied 에 그대로 담아 돌려줬다`);
  });
}

test('X값-음성대조 ★ — 명부 «안»의 세로정렬 값은 넷 다 통과하고 실제로 그려진다', () => {
  for (const key of VALIGN_KEYS) {
    for (const p of WRITE_PATHS) {
      const b = fixture();
      const res = p.send(G, b, { valign: key });
      assert.equal(res.ok, true, `★'${p.key}' 가 멀쩡한 valign:'${key}' 를 막았다: ${res.message}`);
      assert.equal(cssOf(cellTagAt(b, 0, 0), 'justify-content'), VALIGN[key],
        `★'${p.key}' 로 valign:'${key}' 를 줬는데 화면이 '${VALIGN[key]}' 가 아니다 — 통과가 곧 반영은 아니다`);
    }
  }
});

test('X값-블록축대조 ★ — «블록» 축의 같은 이름은 값을 제대로 거절한다', () => {
  const b = fixture();
  const bad = G.updateGridBlock(b.id, { valign: 'center' });
  assert.equal(bad.ok, false, '★블록 축마저 값을 안 본다 — 그러면 V1 의 빨강은 «칸만의 문제»가 아니다');
  assert.match(bad.message, new RegExp(VALIGN_KEYS.join('\\|')), '★거절하면서 «무엇이 되는지»를 안 말한다');
  for (const key of VALIGN_KEYS) {
    const ok = G.updateGridBlock(b.id, { valign: key });
    assert.equal(ok.ok, true, `★블록 축이 멀쩡한 '${key}' 도 막는다: ${ok.message}`);
  }
});

for (const p of WRITE_PATHS) {
  test(`X정렬값-${p.key} ★칸 가로정렬에 명부 밖 값('centre')을 주면 그대로 CSS 로 새 나간다`, () => {
    assert.ok(!ALIGN_KEYS.includes('centre'),
      `★'centre' 가 가로정렬 명부에 들어왔다 — 전제가 바뀌었다(지금 명부: ${ALIGN_KEYS.join('|')})`);
    const b = fixture();
    const res = p.send(G, b, { align: 'centre' });
    const drawn = cssOf(lineTagAt(b, 0, 0, 0), 'text-align');

    assert.ok(rejectedOrReported(res, 'align'),
      `★'${p.key}' 가 명부 밖 정렬값을 «조용히» 받았다 — ok:${res.ok}, ignoredProps:${JSON.stringify(res.ignoredProps)}`);
    assert.ok(ALIGN_KEYS.includes(drawn),
      `★명부 밖 값이 화면 CSS 로 그대로 나갔다: text-align:${drawn}\n`
      + `  ⇒ 브라우저가 «무시»해서 아무 일도 안 일어난다 — 오타 하나가 ok:true 로 돌아오고 화면은 그대로다.\n`
      + `  명부: ${ALIGN_KEYS.join('|')}`);
  });
}

test('X정렬값-음성대조 ★ — 명부 «안»의 가로정렬 값은 넷 다 통과하고 실제로 그려진다', () => {
  for (const key of ALIGN_KEYS) {
    for (const p of WRITE_PATHS) {
      const b = fixture();
      const res = p.send(G, b, { align: key });
      assert.equal(res.ok, true, `★'${p.key}' 가 멀쩡한 align:'${key}' 를 막았다: ${res.message}`);
      assert.equal(cssOf(lineTagAt(b, 0, 0, 0), 'text-align'), key,
        `★'${p.key}' 로 align:'${key}' 를 줬는데 화면이 그 값이 아니다`);
    }
  }
});

/* ═══════════════════════════════════════════════════════════════════════
   N — ④ 중첩 그리드(type:'duo'). 렌더 분기는 있는데 «진짜 그려지는지» 미확인이었다.
   ★결과가 초록이면 초록이라고 적는다 — 그것도 값진 값이다.
   ═══════════════════════════════════════════════════════════════════════ */

/** 중첩 상한/깊이 가드도 «소스에서» 떠 온다. ⛔3·2 를 손으로 박지 마라. */
function nestedCaps(src) {
  /* ★2026-09-24 — 두 한계가 리터럴에서 «이름 있는 상수»로 옮겨졌다(입구가 「잘린다」를 말하려면
     렌더러와 같은 값을 봐야 한다). ⇒ 리터럴이면 그대로 읽고, 이름이면 그 선언을 찾아 읽는다.
     ⛔「이름이 있으니 안 잰다」로 물러서지 않는다 — 값이 바뀌면 여전히 이 도출이 따라와야 한다. */
  const resolve = (tok, what) => {
    if (/^\d+$/.test(tok)) return Number(tok);
    const m = src.match(new RegExp(`const ${tok} = (\\d+);`));
    assert.ok(m, `★${what} 가 '${tok}' 라는 이름을 쓰는데 그 선언을 못 찾았다 — 도출이 끊겼다`);
    return Number(m[1]);
  };
  const cap = src.match(/line\.cols\.slice\(0,\s*([A-Za-z_$][\w$]*|\d+)\)/);
  const depth = src.match(/if \(depth >= ([A-Za-z_$][\w$]*|\d+)\) return '';/);
  assert.ok(cap, '★중첩 열 상한(line.cols.slice)을 못 찾았다');
  assert.ok(depth, '★중첩 깊이 가드(depth >= N)를 못 찾았다');
  return { colCap: resolve(cap[1], '중첩 열 상한'), depthCap: resolve(depth[1], '중첩 깊이 가드') };
}
const NEST = nestedCaps(RAW);

test('N1 ★중첩이 «실제로» 그려진다 — 블록 경로로 끝까지', () => {
  const b = fixture();
  const res = G.updateGridBlock(b.id, {
    patchCell: {
      r: 0, c: 0, lines: [{
        type: 'duo', gap: 12,
        cols: [{ width: 1, lines: [{ type: 'body', text: 'NEST-A' }] },
               { width: 3, lines: [{ type: 'body', text: 'NEST-B' }] }],
      }],
    },
  });
  assert.equal(res.ok, true, `★중첩을 거절했다: ${res.message}`);
  assert.equal(res.ignoredProps, undefined, `★멀쩡한 중첩을 「안 됐다」고 돌려줬다: ${res.hint}`);

  const cell = cellHtmlAt(b, 0, 0);
  assert.match(cell, /class="grd-nested"/, '★중첩 셸이 안 그려졌다');
  assert.match(cell, /NEST-A/, '★중첩 1열의 글자가 화면에 없다');
  assert.match(cell, /NEST-B/, '★중첩 2열의 글자가 화면에 없다');
  assert.match(cell, /gap:12px/, '★중첩 gap 이 안 먹었다');
  assert.deepEqual((cell.match(/flex:(\d+)/g) || []), ['flex:1', 'flex:3'], '★중첩 열 가중치가 안 실렸다');
  assert.equal((cell.match(/class="grd-nested-col"/g) || []).length, 2, '★중첩 열 개수가 안 맞는다');
});

test('N2 ★중첩은 저장을 건너서도 살아남는다(dataset 왕복)', () => {
  const b = fixture();
  G.updateGridBlock(b.id, {
    patchCell: { r: 0, c: 0, lines: [{ type: 'duo', cols: [{ width: 1, lines: [{ type: 'body', text: 'ROUNDTRIP' }] }] }] },
  });
  const drawn = b.innerHTML;
  const model = G.getGridModel(b);
  assert.equal(model.cells[0][0].lines[0].type, 'duo', '★모델에서 중첩이 사라졌다');
  G.renderGridBlock(b);   // dataset 에서 «다시» 그린다 — 저장본 로드와 같은 길
  assert.equal(b.innerHTML, drawn, '★다시 그렸더니 화면이 달라졌다 — 중첩이 왕복을 못 견딘다');
  assert.match(b.innerHTML, /ROUNDTRIP/, '★다시 그렸더니 중첩 내용이 사라졌다');
});

test(`N3 ★깊이 가드 — ${NEST.depthCap}단까지 그리고 그 아래는 안 그린다(양쪽 다)`, () => {
  const deep = (n, leaf) => (n === 0 ? { type: 'body', text: leaf }
    : { type: 'duo', cols: [{ width: 1, lines: [deep(n - 1, leaf)] }] });

  const b1 = fixture();
  G.updateGridBlock(b1.id, { patchCell: { r: 0, c: 0, lines: [deep(NEST.depthCap, 'INSIDE')] } });
  assert.match(cellHtmlAt(b1, 0, 0), /INSIDE/,
    `★${NEST.depthCap}단 중첩이 «안» 그려진다 — 가드가 한 단 일찍 자른다`);

  const b2 = fixture();
  G.updateGridBlock(b2.id, { patchCell: { r: 0, c: 0, lines: [deep(NEST.depthCap + 1, 'TOODEEP')] } });
  assert.doesNotMatch(cellHtmlAt(b2, 0, 0), /TOODEEP/,
    `★${NEST.depthCap + 1}단이 그려진다 — 무한 중첩 가드가 안 문다`);
});

test(`N4 ★중첩 열 상한 ${NEST.colCap} — 넘는 열은 버린다(그 안쪽은 전부 살린다)`, () => {
  const b = fixture();
  const cols = Array.from({ length: NEST.colCap + 1 }, (_, i) => ({ width: 1, lines: [{ type: 'body', text: `NC${i}` }] }));
  G.updateGridBlock(b.id, { patchCell: { r: 0, c: 0, lines: [{ type: 'duo', cols }] } });
  const cell = cellHtmlAt(b, 0, 0);
  for (let i = 0; i < NEST.colCap; i++) assert.match(cell, new RegExp(`NC${i}`), `★상한 안쪽 열 NC${i} 이 안 그려졌다`);
  assert.doesNotMatch(cell, new RegExp(`NC${NEST.colCap}`), `★상한(${NEST.colCap})을 넘는 열이 그려졌다`);
});

test('N5 ★중첩 열마다 정렬·세로정렬이 따로 먹는다', () => {
  const b = fixture();
  G.updateGridBlock(b.id, {
    patchCell: {
      r: 0, c: 0, align: 'left', lines: [{
        type: 'duo', valign: 'bottom',
        cols: [{ width: 1, align: 'right', lines: [{ type: 'body', text: 'NR' }] },
               { width: 1, lines: [{ type: 'body', text: 'NL' }] }],
      }],
    },
  });
  const cell = cellHtmlAt(b, 0, 0);
  const aligns = (cell.match(/text-align:[a-z]+/g) || []);
  assert.deepEqual(aligns, ['text-align:right', 'text-align:left'],
    '★중첩 열별 정렬이 안 갈린다(1열은 제 값, 2열은 바깥 칸 값이어야 한다)');
  assert.ok(cell.includes(`justify-content:${VALIGN.bottom}`), '★중첩 세로정렬(bottom)이 안 먹었다');
});

test('N6 ★빈 중첩은 «아무것도» 안 그린다(빈 껍데기를 남기지 않는다)', () => {
  const b = fixture();
  G.updateGridBlock(b.id, { patchCell: { r: 0, c: 0, lines: [{ type: 'duo', cols: [] }] } });
  assert.doesNotMatch(cellHtmlAt(b, 0, 0), /grd-nested/, '★열이 0개인 중첩이 빈 껍데기를 남겼다');
});

test('N7 ★주소는 «최상위 줄»에만 찍힌다 — 중첩 속은 안 찍는다(기존 규약)', () => {
  const b = fixture();
  G.updateGridBlock(b.id, {
    patchCell: { r: 0, c: 0, lines: [{ type: 'duo', cols: [{ width: 1, lines: [{ type: 'body', text: 'INNER' }] }] }] },
  });
  const top = lineTagAt(b, 0, 0, 0);
  assert.match(top, /class="grd-nested"/, '★중첩 셸에 줄 주소가 안 찍혔다 — 인라인 편집이 이 줄을 못 찾는다');
  assert.equal((cellHtmlAt(b, 0, 0).match(/data-line="/g) || []).length, 1,
    '★중첩 «속»에도 주소가 찍혔다 — 기존 규약(중첩은 미주소화)이 깨졌다');
});

/* ═══════════════════════════════════════════════════════════════════════
   G — ⑤ ★★남의 양성대조를 보호한다
   오늘 이 레포에서 났다: 한 워커가 «조건 없이 넓게» 고쳤더니 다른 검사의
   양성대조 넷이 죽었다. ⛔전부 초록이라 «안 보였다».
   ⇒ 이 축은 「이 파일을 고친 뒤에도 기존 grid 검사들이 여전히 무는가」를 잰다.
   ═══════════════════════════════════════════════════════════════════════ */

const GRID_TESTS = fs.readdirSync(UNIT_DIR)
  .filter(f => /^grid-.*\.test\.(js|mjs)$/.test(f) && f !== SELF).sort();

/** 기준선 86dce84 에서 이 파일을 «뺀» grid 검사 전부의 셈. 실측 245/245 초록.
 *  ★2026-09-23 T-178: 245 → 251. «늘었다» — 이 게이트가 시키는 대로 손으로 올린다.
 *    더한 것 = tests/unit/grid-row0-lines-invariant.test.js 의 6개
 *      (I1 불변식 · I2 반대방향 · I3 음성대조 N1 · I4 · I4-b 음성대조 N2 · I5 명부 무지 증명).
 *    ⛔지운 것은 «하나도» 없다. grid-p1.test.js 는 5개를 «다시 썼지만» 수는 그대로(56)다 —
 *      옛 저장 포맷을 정답으로 잠그고 있던 단언들을 새 포맷으로 옮긴 것이다.
 *    ⛔피커 축(새는 길 ④)은 패널 DOM 이라 여기 안 센다 —
 *      tests/dom/grid-picker-row0-lines.dom.spec.js 가 따로 잰다(이 래칫의 사각지대다).
 *  ★2026-09-23 T-178 C2: 251 → 256. 더한 것 = tests/unit/grid-cell-unset-contract.test.js 의 5개
 *    (D1 null=지움 · D2 행0/행1+ 대칭 · D3 undefined 도 지움 · D4 ''·0 은 값 · D5 음성대조).
 *    ⛔여기서도 지운 것은 «하나도» 없다.
 *  ★2026-09-23 T-178 C3: 256 → 257. 더한 것 = grid-cell-unset-contract 의 D6
 *    (비우기 → 저장 → 다시 그리기 = 열 기본값만 걸린 모양과 바이트 동일). */
/*  ★2026-09-24 T-170/175/176/180 (U-gate): 257 → 272. 더한 것 = tests/unit/grid-intake-contract.test.js
 *    의 18개(U0 자가점검 · U1~U1-d 이미지 상한 네 문 ＋ 새것/있던것 가르기 · U2~U2-d 파괴적 교체
 *    안내와 «동작 불변» 바이트대조 · U3-align/valign/c/d 「받는 값 = 뜻이 있는 값」 · U4 applied
 *    자기모순 · U5 「문 하나」를 행위로 · U6·U6-b 만드는 문의 자원 가드 · U7 줄 개수 상한 네 문).
 *    ⛔여기서도 지운 것은 «하나도» 없다. 이 파일 안의 X* 열 개는 todo 에서 «요구»로 올라갔는데,
 *      이 래칫은 이 파일(SELF)을 «안 세므로» 그 열 개는 이 수에 안 들어온다. */
/*  ★2026-09-24 T-175 둘째 판: 275 → 282. 더한 것 = grid-intake-contract.test.js 의 7개
 *    (U8~U8-d 「아는 이름 + 모르는 값」 — 렌더러가 안 받는 색·글꼴을 도구가 받아 «있던 값까지
 *     죽이던» 자리 · U9~U9-c 「한계를 넘긴 중첩」 — 자르되 잘랐다고 «말하게» ＋ 동작 불변 바이트대조).
 *    ⛔여기서도 지운 것은 «하나도» 없다. */
const GRID_BASELINE_TESTS = 282;

/** `RAW.replace('…')` / `src = src.replace('…')` — «소스를 변이시키는» 자리의 닻(문자열). */
function readLiteral(s, i) {
  while (i < s.length && /\s/.test(s[i])) i++;
  const q = s[i];
  if (q !== "'" && q !== '"' && q !== '`') return null;
  let out = '', j = i + 1;
  while (j < s.length) {
    const ch = s[j];
    if (ch === '\\') { const n = s[j + 1]; out += n === 'n' ? '\n' : n === 't' ? '\t' : n === '\\' ? '\\' : n; j += 2; continue; }
    if (ch === q) return { text: out, end: j + 1 };
    out += ch; j++;
  }
  return null;
}
/** 「주입됐나」를 재는 «지킴이»의 꼴 — 이 레포가 실제로 쓰는 세 가지 전부.
 *  ⛔`assert.notEqual` 하나만 찾으면 `notStrictEqual` 을 쓰는 자리를 «안 지킨다»고 오진한다
 *    (실측: grid-guide.test.js 의 G6·M2-변이가 그 꼴이다 — 첫 판에서 이 그물이 그렇게 틀렸다). */
const GUARD_RE = /assert\.(?:notEqual|notStrictEqual)\(|assert\.ok\([^;]*?!==/;

/** 파일 안 «소스 변이» 자리들. {line, anchor, guarded}
 *  ⛔주석을 «먼저» 걷는다 — 주석 속 예시 코드(`src.replace(...)`)를 변이 자리로 세면
 *    「안 지켜진 자리가 있다」는 거짓 빨강이 난다(실측: grid-guide.test.js 머리 주석). */
function mutationSites(testSrcRaw) {
  const testSrc = stripComments(testSrcRaw);   // ★줄 수는 보존된다 — 줄 번호를 그대로 쓴다
  const out = [];
  const re = /\b(?:RAW|src|SRC|source)\s*\.replace\(/g;
  let m;
  while ((m = re.exec(testSrc)) !== null) {
    const after = m.index + m[0].length;
    const lit = readLiteral(testSrc, after);
    const guarded = GUARD_RE.test(testSrc.slice(after, after + 700));
    out.push({
      line: testSrc.slice(0, m.index).split('\n').length,
      anchor: lit && lit.text.length >= 12 ? lit.text : null,
      guarded,
    });
  }
  return out;
}

/** ★명부 — grid-*.test.* 안의 「양성대조」 시험 전부. ⛔수가 아니라 «이름»으로 잠근다.
 *  하나가 사라지면 이 목록과 어긋나서 빨개진다(수로 잠그면 지워도 조용하다). */
const POSITIVE_CONTROLS = [
  'grid-applied-matches-screen.test.js :: A8 ★양성대조 — 줄 종류 관문을 «뺀» 사본은 ok:true + applied 에 imgSrc, 화면은 그림 0개',
  'grid-applied-matches-screen.test.js :: A9 ★양성대조 — applied.cells 를 «입력 메아리»로 되돌린 사본은 A3·A4 의 교차검사가 잡는다',
  'grid-color-re.test.mjs :: U5-0 ★양성대조 — 잣대가 살아 있다 (평범한 hex 는 통과한다)',
  'grid-color-re.test.mjs :: U10-0 ★양성대조 — 잣대가 살아 있다 (피커가 주는 체인은 통과한다)',
  'grid-guide.test.js :: G0 ★양성대조 — 저장이 «DOM 을 직렬화»하는 게 맞나 (이 검사의 전제)',
  'grid-gutter-hitarea.test.mjs :: U-M64-2 [양성대조] «옛 규칙(±4 고정)»이면 같은 기하에서 실제로 막힌다',
  'grid-line-add.test.mjs :: grdAddLine — 양성대조: 상한 미만이면 통과한다',
  'grid-line-add.test.mjs :: 0줄 가드 — 양성대조: 이미 줄이 있는 셀을 patchCell{lines:[]} 로 비우면 거절된다',
  'grid-line-add.test.mjs :: grdAddLine — 양성대조: 작은 이미지(1KB)는 들어가고 줄 수가 +1 된다',
  'grid-line-add.test.mjs :: pickCellByRects — 칸 «안»은 그 칸을 준다(양성대조)',
  'grid-line-typo.test.js :: U1-c-전제 ★양성대조 — 이 소스 훑기가 «실제로» 파일을 읽고 있다',
  'grid-line-typo.test.js :: U2-a-전제 ★양성대조 — «같은 비교기»가 lineIndex:0 의 변화를 실제로 잡는다',
  'grid-line-typo.test.js :: U4-전제 ★양성대조 — 이 비교가 «다른 필드»는 실제로 갈라 낸다',
  'grid-patchcell-reject.test.js :: P4 ★양성대조 — 검증기를 «뺀» 사본은 ok:true 를 주고 화면은 그대로다',
  'grid-patchcell-reject.test.js :: P8 ★양성대조 — 렌더러가 «새 필드»를 읽기 시작하면 도출이 잡는가',
  /* ★2026-09-24 U-gate — 입구 계약(T-170/175/176/180)의 양성대조 넷. */
  'grid-intake-contract.test.js :: U1-c ★양성대조 — 상한 검사를 «뺀» 사본은 cols 로 20만 자를 그대로 삼킨다',
  'grid-intake-contract.test.js :: U2-c ★양성대조 — 쪽지를 «뗀» 사본은 같은 호출에서 아무 말 없이 지나간다',
  'grid-intake-contract.test.js :: U3-c ★양성대조 — 정렬 명부를 «표 없이» 되돌린 사본에선 오타가 화면으로 새 나간다',
  'grid-intake-contract.test.js :: U5 ★★양성대조 — 계약 함수 «하나»를 무력화하면 네 문이 «같이» 뚫린다',
  'grid-intake-contract.test.js :: U8-d ★양성대조 — 값 잣대를 «뺀» 사본은 gradient 를 받고 옛 배경을 죽인다',
];

function livePositiveControls() {
  const out = [];
  for (const f of GRID_TESTS) {
    const s = readSrc(path.join(UNIT_DIR, f));
    for (const m of s.matchAll(/\btest\(\s*(['"`])((?:\\.|(?!\1)[\s\S])*?)\1/g)) {
      if (m[2].includes('양성대조')) out.push(`${f} :: ${m[2]}`);
    }
  }
  return out.sort();
}

test('G1 ★명부 — 「양성대조」가 «하나도 사라지지 않았는가»', () => {
  const live = livePositiveControls();
  assert.ok(live.length > 0, '★양성대조를 한 개도 못 찾았다 — 이 축은 아무것도 안 쟀다(파싱이 깨졌다)');
  const gone = POSITIVE_CONTROLS.filter(x => !live.includes(x));
  const added = live.filter(x => !POSITIVE_CONTROLS.includes(x));
  assert.deepEqual([gone, added], [[], []],
    '★grid 검사들의 «양성대조» 명부가 바뀌었다.\n'
    + `  사라짐(${gone.length}): ${gone.join('\n              ') || '-'}\n`
    + `  늘어남(${added.length}): ${added.join('\n              ') || '-'}\n`
    + '  ⇒ 사라졌다면: 넓게 고치다 남의 양성대조를 죽인 것이다. 되살려라.\n'
    + '  ⇒ 늘어났다면: 잘한 것이다 — 이 목록에 «손으로» 더해라(그 손이 한 번은 세게 만든다).');
});

test('G2 ★닻 — 남의 변이 양성대조가 꽂을 «자리»가 아직 소스에 있는가', () => {
  const rows = [];
  for (const f of GRID_TESTS) {
    for (const s of mutationSites(readSrc(path.join(UNIT_DIR, f)))) {
      if (!s.anchor) continue;
      rows.push({ f, anchor: s.anchor, inSrc: RAW.includes(s.anchor) });
    }
  }
  assert.ok(rows.length > 0, '★변이 닻을 한 개도 못 찾았다 — 이 줄은 아무것도 안 쟀다');
  const lost = rows.filter(r => !r.inSrc);
  assert.deepEqual(lost.map(r => `${r.f} :: ${r.anchor.slice(0, 60).replace(/\n/g, '\\n')}`), [],
    '★남의 양성대조가 «꽂을 자리»가 grid-block.js 에서 사라졌다.\n'
    + '  ⇒ 그 검사는 assert.notEqual 로 빨개지긴 하지만, 그 빨강의 뜻은 「구멍이 돌아왔다」가 아니라\n'
    + '     「이 검사가 더는 아무것도 못 잰다」다. 닻을 새 자리로 옮겨 줘라.');
});

test('G3 ★모든 변이 자리가 «주입 실패»를 큰 소리로 말하는가', () => {
  const unguarded = [];
  for (const f of GRID_TESTS) {
    for (const s of mutationSites(readSrc(path.join(UNIT_DIR, f)))) {
      if (!s.guarded) unguarded.push(`${f}:${s.line}`);
    }
  }
  assert.deepEqual(unguarded, [],
    '★변이를 주입하고 «주입됐는지»를 안 보는 자리가 있다 — 닻이 빗나가면 그 양성대조는 «조용히» 초록이 된다:\n  '
    + unguarded.join('\n  '));
});

/** 하위 프로세스로 node --test 를 돌린다. 반환: {code, out}
 *  ⛔★`NODE_TEST_CONTEXT` 를 «반드시» 지운다 — 이 파일 자신이 `node --test` 아래서 도니까
 *    자식이 그 값(child-v8)을 물려받고, 그러면 자식은 «깨진 검사를 돌리고도 exit 0» 을 준다.
 *    실측(2026-09-23): 이 줄이 없을 때 G4 가 빨개졌다 — 즉 G5 는 «언제나 초록»이 될 뻔했다.
 *    이것이 계측기 자가점검을 넣는 이유 그 자체다. */
function runNodeTest(files, cwd = ROOT) {
  const env = { ...process.env, NODE_OPTIONS: '' };
  delete env.NODE_TEST_CONTEXT;
  const res = spawnSync(process.execPath, ['--test', ...files], {
    cwd, encoding: 'utf8', timeout: 180000, env,
  });
  return { code: res.status, out: `${res.stdout || ''}${res.stderr || ''}` };
}

test('G4 ★자가점검 — 이 축의 계측기(하위 프로세스)가 «빨강을 볼 줄 아는가»', () => {
  const f = path.join(os.tmpdir(), `gaps-selfcheck-${process.pid}.test.js`);
  fs.writeFileSync(f, "require('node:test').test('x', () => { require('node:assert').equal(1, 2); });\n");
  try {
    const r = runNodeTest([f], os.tmpdir());
    assert.notEqual(r.code, 0, '★일부러 깨뜨린 검사를 «통과»로 읽는다 — G5 의 초록은 아무 뜻이 없다');
  } finally { fs.unlinkSync(f); }
});

test('G5 ★기존 grid 검사들이 «여전히 전부 통과하는가»(양성대조 포함)', () => {
  assert.ok(GRID_TESTS.length > 0, '★돌릴 grid 검사를 한 개도 못 찾았다');
  const r = runNodeTest(GRID_TESTS.map(f => path.join('tests', 'unit', f)));
  assert.equal(r.code, 0,
    '★grid-block.js 를 고친 뒤 기존 grid 검사 중 빨개진 것이 있다 — «남의 그물»을 같이 끊었다:\n'
    + r.out.split('\n').filter(l => /^not ok|✖|Error|AssertionError|✘/.test(l)).slice(0, 40).join('\n'));

  /* ★래칫 — 기준선 86dce84 실측이자 플래너가 넘긴 수: 245/245.
     ⛔하한(≥)이 아니라 «등호»다(align-btn-ssot.test.mjs 선례). 하한은 까먹어도 초록이라,
       「남의 양성대조를 지우고 초록」이 그대로 지나간다.
     ★이 수와 안 맞으면 «고쳐진 것»이 아니라 «재는 양이 바뀐 것»이다 — 그때 고칠 것은
       이 수가 아니라, 왜 줄었는지(지웠나)·왜 늘었는지(더했나)를 먼저 적는 일이다. */
  const total = Number((r.out.match(/^ℹ tests (\d+)$/m) || [])[1]);
  const pass = Number((r.out.match(/^ℹ pass (\d+)$/m) || [])[1]);
  assert.ok(Number.isFinite(total) && Number.isFinite(pass), '★하위 프로세스의 셈을 못 읽었다 — 래칫이 헛돈다');
  assert.deepEqual([total, pass], [GRID_BASELINE_TESTS, GRID_BASELINE_TESTS],
    `★기존 grid 검사 수가 기준선(86dce84)의 ${GRID_BASELINE_TESTS}/${GRID_BASELINE_TESTS} 과 다르다 — 지금 ${pass}/${total}.\n`
    + '  줄었다면: 남의 그물을 지웠거나 한 파일이 통째로 안 돌고 있다(그건 초록이 아니라 «안 봤다»다).\n'
    + '  늘었다면: 잘한 것이다 — 이 수를 같이 올려라(그 손이 한 번은 세게 만든다).');
});
