/* 공용 «구간 떠내기»(_slice-block)의 대조 + 사본이 늘지 못하게 하는 가드.
 *
 * ★2026-09-09 게이트가 균형괄호로 다시 재서 잡은 것: 이 레포 검사 18벌이 구간 끝을
 *   `src.indexOf('\n}\n', i)` 로 찾았다. 「최상위 함수는 0열 `}` 로 끝난다」는 전제인데
 *   ★`};` 로 끝나는 구간(화살표·객체리터럴)에는 «안» 걸리고, -1 도 아니라
 *   «다음 최상위 `}` 까지 달려가» 남의 코드를 삼킨다.
 *
 * ⛔여기 있는 대조들은 「옛 구현으로 되돌리면 빨개지는가」를 «같은 픽스처에서» 같이 잰다.
 *   양성대조 없는 통과는 통과가 아니다.
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { sliceBlock, findBlockEnd } = require('./_slice-block.js');
const { readSrc } = require('./_srcread.js');
const { stripComments } = require('./_strip-comments.js');

const UNIT = __dirname;
const ROOT = path.resolve(__dirname, '../..');

/** ★옛 구현 — 대조용으로 «그대로» 옮겨 둔다. 이걸로 재면 틀려야 검사가 재는 말이 된다. */
function oldSlice(src, header) {
  const i = src.indexOf(header);
  if (i < 0) return null;
  const j = src.indexOf('\n}\n', i);
  if (j < 0) return null;
  return src.slice(i, j + 3);
}

const lines = (s) => s.split('\n').length;

/* ── ① 끝나는 «모양»이 달라도 같은 자에서 끊긴다 ───────────────────────────── */

test('SB-1 `}` 로 끝나는 함수 — 진짜 길이와 같다 (옛 구현도 여기선 맞다)', () => {
  const src = [
    'function alpha() {',
    '  const x = 1;',
    '}',
    'function AFTER() {',
    '  const swallowed = 1;',
    '}',
    '',
  ].join('\n');
  const got = sliceBlock(src, 'function alpha()');
  assert.equal(got, 'function alpha() {\n  const x = 1;\n}');
  assert.equal(/swallowed/.test(got), false, '★다음 함수를 삼켰다');
  // 전제 — 이 모양은 옛 구현도 맞혔다. 그래서 「옛 것이 늘 틀리다」가 아니라 «반만 맞다»가 사실이다.
  assert.ok(oldSlice(src, 'function alpha()').includes('const x = 1;'));
});

test('SB-2 ★`};` 로 끝나는 화살표 — 여기서 옛 구현이 «남의 코드»를 삼킨다', () => {
  const src = [
    'const beta = (a, b) => {',
    '  return a + b;',
    '};',
    'function AFTER() {',
    '  const swallowed = 1;',
    '}',
    '',
  ].join('\n');
  const got = sliceBlock(src, 'const beta = (a, b) =>');
  assert.equal(got, 'const beta = (a, b) => {\n  return a + b;\n}');
  assert.equal(/swallowed/.test(got), false);
  // ★양성대조 — 옛 구현은 «틀린다». 안 틀리면 이 검사는 아무것도 안 재는 것이다.
  const old = oldSlice(src, 'const beta = (a, b) =>');
  assert.ok(/swallowed/.test(old),
    '★옛 구현이 여기서 안 틀렸다 — 대조가 죽었다(픽스처가 병을 재현 못 한다)');
  assert.ok(lines(old) > lines(got), `옛 ${lines(old)}줄 vs 새 ${lines(got)}줄`);
});

test('SB-3 ★`};` 로 끝나는 객체 리터럴 — 같은 병, 같은 처방', () => {
  const src = [
    'const HANDLERS = {',
    "  a: 1,",
    '};',
    'function AFTER() {',
    '  const swallowed = 1;',
    '}',
    '',
  ].join('\n');
  const got = sliceBlock(src, 'const HANDLERS = {');
  assert.equal(got, "const HANDLERS = {\n  a: 1,\n}");
  assert.ok(/swallowed/.test(oldSlice(src, 'const HANDLERS = {')), '★대조가 죽었다');
});

test('SB-4 ⛔`})` · `}]` 로 끝나는 꼬리 — 「`};` 도 찾는다」로 때웠으면 여기서 또 났다', () => {
  const src = [
    'const wired = register({',
    '  onTick: 1,',
    '});',
    'function AFTER() {',
    '  const swallowed = 1;',
    '}',
    '',
  ].join('\n');
  /* 머리 뒤 첫 최상위 `{` 는 `register(` «안»이라 최상위가 아니다 ⇒ 실제 본문은 그 객체다.
     셈으로 찾으니 꼬리 모양(`})`)과 무관하게 끊긴다. */
  const got = sliceBlock(src, 'const wired = register({');
  assert.equal(/swallowed/.test(got), false, '★꼬리 모양이 달라 또 달려갔다');
  assert.ok(got.includes('onTick'), '★본문을 못 떴다');
  assert.ok(/swallowed/.test(oldSlice(src, 'const wired = register({')), '★대조가 죽었다');
});

/* ── ② 중첩 · 문자열 · 주석 · 정규식 · 템플릿 ─────────────────────────────── */

test('SB-5 중첩된 함수 — 안쪽 `}` 에서 끊기지 않고 «바깥» 짝까지 간다', () => {
  const src = [
    'function outer() {',
    '  function inner() {',
    '    const y = 2;',
    '  }',
    '  const tail = 3;',
    '}',
    '',
  ].join('\n');
  const got = sliceBlock(src, 'function outer()');
  assert.ok(got.includes('const tail = 3;'), '★안쪽에서 일찍 끊겼다 — 꼬리를 못 봤다');
  assert.equal(lines(got), 6);
});

test('SB-6 ★주석 안의 0열 `}` — 옛 구현은 «여기서» 일찍 끊겨 코드를 못 본다', () => {
  const src = [
    'function gamma() {',
    '  /*',
    '}',
    '  */',
    '  const kept = 1;',
    '}',
    '',
  ].join('\n');
  const got = sliceBlock(src, 'function gamma()');
  assert.ok(got.includes('const kept = 1;'), '★주석 안의 `}` 를 세었다');
  // ★양성대조 — 옛 구현은 kept 를 «못 본다» ⇒ 「kept 가 없다」는 단언이 거짓 초록이 된다
  assert.equal(/kept/.test(oldSlice(src, 'function gamma()')), false, '★대조가 죽었다');
});

test('SB-7 ★템플릿 리터럴 안의 0열 `}` — 이 레포가 실제로 겪은 자리다', () => {
  /* account-projects-root.test.js 가 주석으로 남긴 실측: 「본문에 «템플릿 리터럴»이 있으면
     bodyOf 가 일찍 끊긴다(_invokeRendererUpdateSection)」. 그 병을 여기서 재현해 못박는다. */
  const src = [
    'function delta() {',
    '  const t = `',
    '}',
    '`;',
    '  const kept = 1;',
    '}',
    '',
  ].join('\n');
  const got = sliceBlock(src, 'function delta()');
  assert.ok(got.includes('const kept = 1;'), '★템플릿 안의 `}` 를 세었다');
  assert.equal(/kept/.test(oldSlice(src, 'function delta()')), false, '★대조가 죽었다');
});

test('SB-8 템플릿 `${}` 중첩 — 안쪽 표현식의 괄호도 제대로 센다', () => {
  const src = [
    'function eps() {',
    '  const t = `a ${ list.map((x) => `${x}!`).join("}") } b`;',
    '  const kept = 1;',
    '}',
    '',
  ].join('\n');
  const got = sliceBlock(src, 'function eps()');
  assert.ok(got.includes('const kept = 1;'), '★`${}` 중첩에서 길을 잃었다');
  assert.equal(lines(got), 4);
});

test('SB-9 문자열·정규식 안의 괄호와 따옴표에 안 속는다', () => {
  const src = [
    'function zeta() {',
    '  const s = "}) not real {";',
    "  const t = '} also not {';",
    '  const re = /[}{\'"]/g;',
    '  const div = a / b / c;',
    '  const kw = String(x).replace(/}/g, "");',
    '  const kept = 1;',
    '}',
    '',
  ].join('\n');
  const got = sliceBlock(src, 'function zeta()');
  assert.ok(got.includes('const kept = 1;'), '★문자열/정규식 안의 괄호를 세었다');
  assert.equal(lines(got), 8);
});

test('SB-10 `return /re/` — 낱말 뒤 `/` 를 «키워드면 정규식, 아니면 나눗셈»으로 가른다', () => {
  const ok = 'function a() {\n  return /}{"/.test(s);\n  }\n';
  assert.ok(sliceBlock(ok, 'function a()').includes('test(s)'));
  const div = 'function b() {\n  const r = total / count / 2;\n  const kept = 1;\n}\n';
  assert.ok(sliceBlock(div, 'function b()').includes('const kept = 1;'), '★나눗셈을 정규식으로 읽었다');
});

/* ── ③ 못 찾으면 «던진다» (조용히 -1 로 흘리지 않는다) ─────────────────────── */

test('SB-11 ⛔끝을 못 찾으면 던진다 — 이 병의 시작이 «-1 을 흘려보낸» 것이었다', () => {
  assert.throws(() => sliceBlock('function a() {\n  const x = 1;\n', 'function a()'),
    /구간의 끝을 못 찾음/, '★짝 없는 `{` 를 조용히 통과시켰다');
  assert.throws(() => sliceBlock('const x = 1;\n', 'function nope()'),
    /구간 머리를 못 찾음/);
  assert.throws(() => sliceBlock('const f = (x) => x + 1;\nconst g = 2;\n', 'const f ='),
    /최상위 '\{' 가 없다/, "★본문 `{` 가 없는데 «아무거나» 떠 왔다");
});

test('SB-12 못 찾은 이유에 «그 검사가 무엇을 놓쳤는지»를 실어 보낸다', () => {
  assert.throws(() => sliceBlock('x', 'function ghost()', '회전 레지스트리'),
    /회전 레지스트리/, '★note 가 오류에 안 실린다 — 사람이 원인을 못 읽는다');
});

/* ── ④ ★진짜 소스에서 재기 — 떠낸 조각은 «구문으로 온전»해야 한다 ───────────── */

/* 실제 호출부가 겨누는 (파일, 구간 머리) 전수. 여기 있는 것이 «오늘 이 부품이 지는 짐»이다.
   ⛔새 호출부를 만들면 여기에 한 줄 더해라 — 그래야 이 그물이 따라간다. */
const REAL = [
  ['js/props/prop-zoom.js', 'const bindPair = (id, key, label, min, max) =>'],
  ['js/props/prop-zoom.js', 'const bindRadio = (name, key, label) =>'],
  ['js/asset-rotate.js', 'const _ROTATE_HANDLERS = {'],
  ['js/blocks/zoom-block.js', 'const ZOOM_DEFAULTS = {'],
  ['js/blocks/zoom-block.js', 'function makeZoomBlock('],
  ['js/blocks/zoom-block.js', 'function clearPinnedShortEdge(block)'],
  ['js/editor.js', 'function deselectAll()'],
  ['js/editor.js', 'function applyZoom(z, opts) {'],
  ['js/overlay-handles.js', 'function _updateGridGutterPositions() {'],
  ['js/blocks/sticker-block.js', 'function _updateStickerSecClip(block) {'],
  ['js/sticker-select.js', 'function _clampToSection'],
  ['main.js', 'async function _clearActiveIfNeeded'],
  ['main.js', 'async function _deleteProjectImpl'],
  ['main.js', 'async function _invokeRendererSetActiveFrame'],
  ['main.js', 'async function _invokeRendererAddAssetBlock'],
  ['main.js', 'async function _invokeRendererAddChecklistItem'],
  ['main.js', 'async function _invokeRendererAssetsMutate'],
  ['js/block-factory.js', 'function makePresetRow'],
  ['main/claude-pm/mcp-server.js', 'function _validateGapOpts'],
  ['main/claude-pm/mcp-server.js', 'function _firstMeaningful'],
  // 세 번째 칸 = «여기서부터 찾아라» 표시(호출부가 실제로 그렇게 좁혀서 쓴다)
  ['js/io/save-load.js', '} finally {', 'state._suppressAutoSave = true;'],
];

/** REAL 한 줄을 실제 호출부와 «같은 방식»으로 떠낸다. */
function sliceReal(rel, header, after) {
  let src = readSrc(ROOT, rel);
  if (after) {
    const k = src.indexOf(after);
    assert.ok(k > 0, `★${rel}: 범위 표시 «${after}» 가 사라졌다`);
    src = src.slice(k);
  }
  return { src, got: sliceBlock(src, header, `${rel} 의 구간이 사라졌거나 이름이 바뀌었다`) };
}

test(`SB-13 ★떠낸 조각이 «구문으로 온전»하다 — 실제 구간 ${REAL.length}개 전수`, () => {
  /* 넘치면 괄호가 안 맞아 파싱이 던진다. 모자라도 마찬가지다.
     ⇒ 「길이가 줄었다」보다 강한 잣대다: 조각 자신이 «한 덩이»임을 파서가 보증한다. */
  let checked = 0;
  for (const [rel, header, after] of REAL) {
    const { got } = sliceReal(rel, header, after);
    // `} finally {` 처럼 조각 자체가 문(statement)이 아닌 것은 «비동기 함수 몸통»에 넣어 파싱한다
    const wrapped = header.startsWith('}') ? `(async () => { try {${got} })` : got;
    assert.doesNotThrow(() => new Function(wrapped),
      `★${rel} — «${header}» 조각이 구문으로 안 온전하다(넘쳤거나 모자라다)`);
    checked++;
  }
  assert.equal(checked, REAL.length, `전수 ${REAL.length}개를 다 재지 못했다`);
});

test('SB-14 ★양성대조 — 옛 자로 재면 실제 구간 21개 중 «5개»가 달라진다 (그게 고친 병이다)', () => {
  /* ⛔「구문이 깨지나」로는 못 잰다 — 함수 하나를 통째로 더 삼켜도 «파싱은 된다».
       그래서 여기서는 조각 자체를 «글자로» 대조한다. 이게 진짜 잣대다.
     ★옛 자의 `+3` 은 닫는 `}` 뒤 개행까지 문다 ⇒ 꼬리 개행만 떼고 견준다(길이 트집 금지). */
  const wrong = [];
  for (const [rel, header, after] of REAL) {
    const { src, got } = sliceReal(rel, header, after);
    const i = src.indexOf(header);
    const j = src.indexOf('\n}\n', i);
    const old = j < 0 ? null : src.slice(i, j + 2);   // +2 = 닫는 `}` 까지
    if (old !== got) wrong.push(`${rel} | ${header}`);
  }
  /* ★이 넷이 `};` 로 끝나는 구간 — 옛 자가 «못 맞추고 달려간» 바로 그 자리들이다. */
  for (const must of ['const bindPair = (id, key, label, min, max) =>',
                      'const bindRadio = (name, key, label) =>',
                      'const _ROTATE_HANDLERS = {',
                      'const ZOOM_DEFAULTS = {']) {
    assert.ok(wrong.some((w) => w.endsWith(must)),
      `★«${must}» 에서 옛 자가 «안» 틀렸다 — 대조가 죽었다(고칠 병이 없었다는 뜻이 된다)`);
  }
  assert.ok(wrong.length >= 5,
    `★옛 자가 ${wrong.length}개만 틀린다 — 알려진 것보다 적다. 무엇이 바뀐 건지 «재고» 이 수를 고쳐라`);
});

test('SB-15 ★실측 — bindPair·bindRadio 를 옛 자로 재면 «몇 배로» 부푼다', () => {
  const prop = readSrc(ROOT, 'js/props/prop-zoom.js');
  for (const [header, cap] of [['const bindPair = (id, key, label, min, max) =>', 40],
                               ['const bindRadio = (name, key, label) =>', 30]]) {
    const now = lines(sliceBlock(prop, header));
    const old = lines(oldSlice(prop, header));
    assert.ok(now < cap, `★${header} 가 ${now}줄 — 이 정도면 또 남을 삼키고 있다`);
    assert.ok(old > now * 2,
      `★옛 자가 ${old}줄, 새 자가 ${now}줄 — 부풀지 않았다면 대조가 죽은 것이다`);
  }
});

/* ── ⑤ 사본이 늘지 못하게 하는 가드 ──────────────────────────────────────── */

test("SB-16 ⛔새 검사가 «자기 `indexOf('\\n}\\n')` 자»를 만들지 못한다 — 공용 부품을 써라", () => {
  /* ★허용목록은 «오늘의 빚»이다. 줄면 여기서 지워라. ⛔늘리려면 «왜»를 커밋에 적어라. */
  const LEGACY = new Set([
    // 이 관용구를 «재는» 검사다 — CRLF 체크아웃에서 `\n}\n` 이 안 걸리는 것을 증명한다.
    'win-portability.test.mjs',
  ]);
  /* ★«코드»만 본다 — 주석은 뺀다. 이 병을 설명하는 주석(「옛 자는 이랬다」)까지 잡으면
     사람이 «왜 고쳤는지»를 못 적게 되고, 그러면 다음 사람이 같은 자를 또 만든다. */
  const own = [];
  for (const n of fs.readdirSync(UNIT)) {
    if (!/\.test\.(js|mjs)$/.test(n) || LEGACY.has(n)) continue;
    if (n === path.basename(__filename)) continue;   // ★자기 자신 — 옛 구현 사본이 «여기 있어서» 걸린다
    const code = stripComments(fs.readFileSync(path.join(UNIT, n), 'utf8'));
    if (/indexOf\('\\n\}\\n'/.test(code)) own.push(n);
  }
  assert.deepEqual(own, [],
    "★자기 `indexOf('\\n}\\n')` 자를 든 검사가 있다 — ./_slice-block.js 의 sliceBlock 을 써라:\n  " + own.join('\n  '));

  // ★양성대조 — 이 잣대가 «실제로» 잡는다
  const wouldCatch = [...LEGACY].filter((n) => {
    try { return /indexOf\('\\n\}\\n'/.test(stripComments(fs.readFileSync(path.join(UNIT, n), 'utf8'))); }
    catch { return false; }
  });
  assert.equal(wouldCatch.length, LEGACY.size,
    `★잣대가 죽었다 — 허용목록 ${LEGACY.size}개 중 ${wouldCatch.length}개만 잡힌다`);
});

test('SB-17 findBlockEnd 도 같이 나가 있다 (조각이 아니라 «자리»가 필요한 자리용)', () => {
  const src = 'function a() {\n  const x = 1;\n}\n';
  assert.equal(src[findBlockEnd(src, 0, 'a')], '}');
});
