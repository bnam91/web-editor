/* select-all-list-drift — 「⌘A 전체선택 목록」이 «삭제할 수 있는 타입»을 따라가는가.
 *   실행: node --test "tests/unit/*.test.mjs" "tests/unit/*.test.js"
 *
 * ★왜 있나 (2026-09-20 «사용자 관점 훑기» T-085 — 「⌘A 전체선택 후 Delete 하면 도형만 안 지워진다」)
 *   js/editor.js 안에 «선택할 수 있는 블록 타입» 목록이 손으로 두 벌 적혀 있었고 한 벌이
 *   뒤처져 있었다. ⌘A 분기의 목록에는 .shape-block 을 비롯해 11종이 더 빠져 있었다.
 *   실앱 실측(포트 9527, 40% 줌, 고치기 «전»): 텍스트2 + 도형1 이 든 섹션에서
 *     ⌘A 선택집합 = [gap-block, text-block, text-block, gap-block]  ← shape 0개
 *     Delete 뒤 남은 것 = .shape-block 1개                          ← 사용자가 본 증상
 *   고침 = 목록을 파일 상단 SSOT(SECTION_BLOCK_TYPE_SEL) «한 자리»로 모으고 양쪽이 그걸 본다.
 *
 * ★이 검사가 지키는 «불변»
 *   ⑴ deleteSelectedFromCanvas 가 «지울 수 있는» 타입(CANVAS_SEL_BLOCKS + .shape-block)은
 *      ⌘A 로 «반드시» 골라진다. 새 타입을 삭제 목록에만 더하면 여기서 빨강이 난다.
 *   ⑵ ⌘A 분기는 목록을 손으로 다시 적지 않는다(SSOT 식별자를 그대로 쓴다).
 *   ⑶ 죽은 셀렉터 `.iconify-block` 이 되살아나지 않는다 — 실제 클래스는 `.icon-block`
 *      (js/blocks/iconify-block.js 가 className='icon-block' 으로 만든다. 2026-06-11 리뷰 BR-06).
 *
 * ⚠️이 검사는 «소스 문자열»을 본다. 정상적인 리팩터링에도 빨강이 날 수 있다 — 그때는 지우지 말고
 *   「⌘A 목록과 삭제 목록이 아직 한 자리에서 나오는가」를 확인한 뒤 패턴을 고쳐라.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { readSrc } = require('./_srcread.js');
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '../../');

const EDITOR = readSrc(REPO, 'js/editor.js');

/** 선언의 끝(;) 을 «따옴표·줄주석을 건너뛰며» 찾는다.
 *  ⚠️단순 indexOf(';\n') 는 `...';  // 주석` 꼴에서 «다음 선언»까지 집어삼킨다(실측으로 물렸다). */
function endOfDecl(src, from) {
  let q = null;
  for (let i = from; i < src.length; i++) {
    const c = src[i];
    if (q) { if (c === '\\') { i++; continue; } if (c === q) q = null; continue; }
    if (c === "'" || c === '"' || c === '`') { q = c; continue; }
    if (c === '/' && src[i + 1] === '/') { while (i < src.length && src[i] !== '\n') i++; continue; }
    if (c === ';') return i;
  }
  throw new Error('선언의 끝(;)을 못 찾았다');
}

/** `const NAME = ... ;` 한 선언을 떠낸다. */
function declOf(src, name) {
  const i = src.indexOf(`const ${name} =`);
  assert.ok(i >= 0, `js/editor.js 에서 ${name} 선언을 못 찾았다`);
  return src.slice(i, endOfDecl(src, i) + 1);
}

/** 선언문 안의 `.foo-block` 들을 모은다(.selected 접미사는 떼고). */
function classesIn(decl) {
  return new Set([...decl.matchAll(/\.([a-z0-9-]+-block)(?:\.selected)?/g)].map(m => '.' + m[1]));
}

const SSOT_DECL   = declOf(EDITOR, 'SECTION_BLOCK_TYPE_SEL');
const DELETE_DECL = declOf(EDITOR, 'CANVAS_SEL_BLOCKS');
const SSOT   = classesIn(SSOT_DECL);
const DELETE = classesIn(DELETE_DECL);

/** ⌘A 분기(`if (e.key === 'a') {` ~ 그 안의 querySelectorAll 호출) 본문. */
function selectAllBranch(src) {
  const i = src.indexOf("if (e.key === 'a') {");
  assert.ok(i >= 0, "⌘A 분기(if (e.key === 'a')) 를 못 찾았다");
  const j = src.indexOf('querySelectorAll', i);
  assert.ok(j > i && j - i < 2000, '⌘A 분기 안에서 querySelectorAll 을 못 찾았다');
  const k = src.indexOf(';', j);
  return src.slice(i, k + 1);
}
const A_BRANCH = selectAllBranch(EDITOR);

test('T1 ⌘A 분기는 목록을 손으로 다시 적지 않고 SSOT 식별자를 쓴다', () => {
  assert.match(
    A_BRANCH,
    /querySelectorAll\(\s*SECTION_BLOCK_TYPE_SEL\s*\)/,
    '⌘A 분기가 SECTION_BLOCK_TYPE_SEL 대신 다른 것을 넘긴다:\n' + A_BRANCH
  );
  /* «목록»만 잡는다 — 쉼표로 이어붙인 블록 클래스 둘 이상.
     (`'.text-block.editing'` 같은 단일 가드 셀렉터는 정상이라 세면 안 된다) */
  assert.equal(
    (A_BRANCH.match(/\.[a-z0-9-]+-block[^'"`]*,\s*\.[a-z0-9-]+-block/g) || []).length, 0,
    '⌘A 분기 안에 블록 클래스 «문자열 목록»이 되살아났다(그게 어긋나서 T-085 가 났다):\n' + A_BRANCH
  );
});

test('T2 지울 수 있는 타입은 ⌘A 로 모두 골라진다 (목록 어긋남 방지)', () => {
  const missing = [...DELETE].filter(c => !SSOT.has(c)).sort();
  assert.deepEqual(
    missing, [],
    'CANVAS_SEL_BLOCKS 에는 있는데 SECTION_BLOCK_TYPE_SEL 에 없다 ⇒ ⌘A 로 못 고르는데 지워지는 타입:\n  '
      + missing.join(', ')
  );
});

test('T3 도형(.shape-block)이 ⌘A 목록에 있다 — T-085 본증상', () => {
  assert.ok(SSOT.has('.shape-block'),
    'SECTION_BLOCK_TYPE_SEL 에 .shape-block 이 없다 ⇒ ⌘A→Delete 가 도형을 남긴다');
});

test('T4 죽은 셀렉터 .iconify-block 이 없다 (실제 클래스는 .icon-block)', () => {
  const hits = [...EDITOR.matchAll(/\.iconify-block/g)].length;
  assert.equal(hits, 0, 'js/editor.js 에 .iconify-block 이 남아 있다 — 그런 클래스는 만들어지지 않는다(BR-06)');
  assert.ok(SSOT.has('.icon-block'), 'SECTION_BLOCK_TYPE_SEL 에 .icon-block(아이콘 블록)이 없다');
});

/* ── 양성대조 — 이 검사가 «정말» 어긋남을 잡는지. 계측기가 자기 자신을 증명한다. ───────── */
test('T5 양성대조: SSOT 에서 .shape-block 을 빼면 T1·T3 이 실제로 던진다', () => {
  const mutated = EDITOR.replace("  '.shape-block',", '  /*removed*/');
  assert.notEqual(mutated, EDITOR, '변이 주입 실패 — SSOT 의 .shape-block 줄을 못 찾았다');
  const mSsot = classesIn(declOf(mutated, 'SECTION_BLOCK_TYPE_SEL'));
  // T3 의 판정문을 «그대로» 변이 소스에 물려 본다 — 빨강이 나야 그물이 살아 있는 것이다.
  assert.throws(
    () => assert.ok(mSsot.has('.shape-block')),
    /Expected values to be truthy|AssertionError/,
    'T3 이 «빠진 .shape-block» 을 못 잡는다 ⇒ 그물이 죽었다'
  );

  // ⌘A 분기가 다시 손으로 적힌 목록으로 돌아간 «가짜 소스»도 T1 이 잡아야 한다.
  const regressed = EDITOR.replace(
    'const allBlocks = activeSec.querySelectorAll(SECTION_BLOCK_TYPE_SEL);',
    "const allBlocks = activeSec.querySelectorAll('.text-block, .asset-block, .gap-block');"
  );
  assert.notEqual(regressed, EDITOR, '변이 주입 실패 — ⌘A 의 querySelectorAll 줄을 못 찾았다');
  const rBranch = selectAllBranch(regressed);
  assert.doesNotMatch(rBranch, /querySelectorAll\(\s*SECTION_BLOCK_TYPE_SEL\s*\)/,
    'T1 의 ⑴번 판정이 «되돌아간 소스»를 통과시킨다 ⇒ 그물이 죽었다');
  assert.ok((rBranch.match(/\.[a-z0-9-]+-block[^'"`]*,\s*\.[a-z0-9-]+-block/g) || []).length > 0,
    'T1 의 ⑵번 판정이 «손으로 적은 목록»을 못 잡는다 ⇒ 그물이 죽었다');
});

test('T6 양성대조: 삭제 목록에 새 타입을 더하면 T2 가 빨강이 된다', () => {
  const mutated = EDITOR.replace(
    "'.speech-bubble-block.selected, .qa-block.selected'",
    "'.speech-bubble-block.selected, .qa-block.selected, .brandnew-block.selected'"
  );
  assert.notEqual(mutated, EDITOR, '변이 주입 실패 — CANVAS_SEL_BLOCKS 끝줄을 못 찾았다');
  const mDel = classesIn(declOf(mutated, 'CANVAS_SEL_BLOCKS'));
  const missing = [...mDel].filter(c => !SSOT.has(c));
  assert.deepEqual(missing, ['.brandnew-block'],
    '어긋남을 못 잡는다 ⇒ T2 가 그물 구실을 못 한다는 뜻');
});
