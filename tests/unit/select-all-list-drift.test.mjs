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

/** 선언이 «없을 수도 있는» 자리 — 적재 때 던지지 않는다.
 *  ★왜 (2026-09-21 이벨류에이터 지적 low⑤): 여기서 바로 declOf 를 부르면 고치기 «전» 소스에
 *    물렸을 때 «모듈 적재»가 터져 파일 통째로 1건 실패가 난다. 그건 「목록이 뒤처졌다」를 잡은 게
 *    아니라 「파일이 안 열린다」다 — 음성대조라고 부를 수 없다. 없으면 빈 집합으로 두고,
 *    «판정문»이 제 이유로 빨개지게 한다. */
function declOrNull(src, name) { try { return declOf(src, name); } catch (_) { return null; } }

const SSOT_DECL   = declOrNull(EDITOR, 'SECTION_BLOCK_TYPE_SEL');
const DELETE_DECL = declOf(EDITOR, 'CANVAS_SEL_BLOCKS');
const SSOT   = SSOT_DECL ? classesIn(SSOT_DECL) : new Set();
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

/** ⌘A 가 «실제로 고르는» 타입 집합 — 목록을 어디에 적었든 같은 답이 나오게 푼다.
 *  ⑴ `querySelectorAll(IDENT)` 면 그 선언을 따라가고, ⑵ 문자열 목록이면 그 자리에서 읽는다.
 *  ★왜 이렇게 (2026-09-21 이벨류에이터 지적 low⑤): 예전엔 이 파일이 맨 위에서
 *    declOf(EDITOR,'SECTION_BLOCK_TYPE_SEL') 로 «SSOT 선언이 있다»를 전제했다. 그래서 고치기
 *    «전» 소스에 물리면 판정문이 빨개지는 게 아니라 «모듈 적재»가 던져서 파일 통째로 1건 실패가
 *    났다(tests 1 / pass 0 / fail 1). 그건 「목록이 뒤처졌다」를 잡은 게 아니라 「파일이 안 열린다」였다.
 *    이제는 두 모양 다 «열려서» T2·T3 가 제 이유로 빨개진다(T7 이 그걸 실제로 확인한다). */
function selectAllClassesOf(src) {
  const branch = selectAllBranch(src);
  const ident = branch.match(/querySelectorAll\(\s*([A-Za-z_$][A-Za-z0-9_$]*)\s*\)/);
  if (ident) return classesIn(declOf(src, ident[1]));
  return classesIn(branch.slice(branch.indexOf('querySelectorAll')));
}
const A_SEL = selectAllClassesOf(EDITOR);

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
  const missing = [...DELETE].filter(c => !A_SEL.has(c)).sort();
  assert.deepEqual(
    missing, [],
    'CANVAS_SEL_BLOCKS 에는 있는데 ⌘A 가 고르는 목록엔 없다 ⇒ ⌘A 로 못 고르는데 지워지는 타입:\n  '
      + missing.join(', ')
  );
});

test('T3 도형(.shape-block)이 ⌘A 목록에 있다 — T-085 본증상', () => {
  assert.ok(A_SEL.has('.shape-block'),
    '⌘A 가 고르는 목록에 .shape-block 이 없다 ⇒ ⌘A→Delete 가 도형을 남긴다');
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

/* ── 2026-09-21 픽스 라운드 — 이벨류에이터 지적 ①③④⑤ 가 다시 새지 않게 ─────────────── */

test('T7 ★음성대조: 고치기 «전» ⌘A 목록을 그대로 물리면 T2·T3 판정문이 «제 이유로» 빨개진다', () => {
  /* int/0920b @29ae1cb 의 ⌘A 분기에 손으로 적혀 있던 목록 그대로. */
  const OLD_LIST =
    "'.text-block, .asset-block, .gap-block, .icon-circle-block, .table-block, ' +\n" +
    "          '.label-group-block, .graph-block, .divider-block, .bridge-block, .grid-block, .infocard-block, .innercard-block, .modal-block, .icon-text-block, .canvas-block, .banner02-block, .comparison-block, .vector-block, .qa-block'";
  const regressed = EDITOR.replace(
    'activeSec.querySelectorAll(SECTION_BLOCK_TYPE_SEL)',
    'activeSec.querySelectorAll(' + OLD_LIST + ')'
  );
  assert.notEqual(regressed, EDITOR, '변이 주입 실패 — ⌘A 의 querySelectorAll 줄을 못 찾았다');

  // ★핵심: «파일이 안 열려서» 실패하는 게 아니라, 해석이 «성공»한 뒤 판정이 빨개져야 한다.
  const oldSel = selectAllClassesOf(regressed);
  assert.ok(oldSel.size > 10, '옛 목록을 해석조차 못 했다 ⇒ 이 대조는 「파일 통째 실패」와 구별이 안 된다');

  assert.ok(!oldSel.has('.shape-block'), '옛 목록에 도형이 있다 — 대조 상수가 틀렸다');
  assert.throws(() => assert.ok(oldSel.has('.shape-block')), /AssertionError/, 'T3 이 옛 목록을 통과시킨다');

  const missing = [...DELETE].filter(c => !oldSel.has(c)).sort();
  assert.ok(missing.length > 0, 'T2 가 옛 목록에서 어긋남을 못 찾는다 ⇒ 그물이 죽었다');
  assert.deepEqual(
    missing.slice(0, 3), ['.chat-block', '.gradient-block', '.icon-block'],
    '옛 목록에서 빠져 있던 타입 집합이 달라졌다 — 대조 상수를 다시 맞춰라. 실제: ' + missing.join(', ')
  );
});

test('T8 프레임 판정(자식/바깥)은 손으로 적은 목록이 아니라 SSOT 파생을 쓴다', () => {
  // ssHasSelectedChild — 예전엔 joker/chat/gradient/sticker/laurel/zoom 이 빠진 손목록이었다.
  assert.match(
    EDITOR,
    /const ssHasSelectedChild = selSS\.querySelector\(SECTION_BLOCK_TYPE_SEL_SELECTED\);/,
    'ssHasSelectedChild 가 SSOT 파생(SECTION_BLOCK_TYPE_SEL_SELECTED)을 안 쓴다 ⇒ 새 타입이 또 샌다'
  );
  // 파생 상수 자체가 «손으로 다시 적히지» 않았는지.
  const derived = declOf(EDITOR, 'SECTION_BLOCK_TYPE_SEL_SELECTED');
  assert.match(derived, /SECTION_BLOCK_TYPE_SEL\s*\n?\s*\.split/,
    'SECTION_BLOCK_TYPE_SEL_SELECTED 가 SSOT 에서 파생되지 않고 손으로 적혔다:\n' + derived);
  assert.equal((derived.match(/\.[a-z0-9-]+-block/g) || []).length, 0,
    '파생 상수 안에 블록 클래스가 직접 적혀 있다 ⇒ 그게 어긋남의 씨앗이다:\n' + derived);

  // 「프레임 밖에 다른 선택이 있으면 프레임 단독삭제 갈래를 타지 않는다」 — T-085 픽스라운드 ①
  assert.match(
    EDITOR,
    /if \(!ssHasSelectedChild && !_selOutsideSS\)/,
    '프레임 단독삭제 갈래에 «바깥 선택» 가드가 없다 ⇒ ⌘A→Delete 가 프레임 한 줄만 지우고 끝난다'
  );
});

test('T9 복사/붙여넣기 판정목록(MULTI_SEL)이 ⌘A 목록을 따라간다 — 화이트리스트 명시', () => {
  const MULTI = classesIn(declOf(EDITOR, 'MULTI_SEL'));
  /* «일부러» 복사 대상이 아닌 것만 여기 적는다(사유 필수).
     - (현재 없음) ⇒ ⌘A 로 고를 수 있으면 ⌘C 로도 복사돼야 한다. */
  const INTENTIONAL_NOT_COPYABLE = new Set([]);
  const missing = [...A_SEL].filter(c => !MULTI.has(c) && !INTENTIONAL_NOT_COPYABLE.has(c)).sort();
  assert.deepEqual(
    missing, [],
    '⌘A 로는 골라지는데 MULTI_SEL 에 없다 ⇒ 「전체선택→⌘C→⌘V」에서 «조용히» 빠지는 타입:\n  '
      + missing.join(', ')
      + '\n(일부러 빼는 것이면 INTENTIONAL_NOT_COPYABLE 에 «사유와 함께» 적어라)'
  );
});

test('T10 양성대조: MULTI_SEL 에서 한 종을 빼면 T9 가 실제로 빨개진다', () => {
  const mutated = EDITOR.replace(".gradient-block.selected'", "'");
  assert.notEqual(mutated, EDITOR, '변이 주입 실패 — MULTI_SEL 의 .gradient-block 을 못 찾았다');
  const mMulti = classesIn(declOf(mutated, 'MULTI_SEL'));
  assert.ok(!mMulti.has('.gradient-block'), '변이가 안 먹었다');
  const missing = [...A_SEL].filter(c => !mMulti.has(c));
  assert.deepEqual(missing, ['.gradient-block'], 'T9 가 어긋남을 못 잡는다 ⇒ 그물이 죽었다');
});

test('T11 스티커 Delete 는 «삭제 전» 체크포인트를 먼저 찍는다 — ⌘Z 로 돌아오게', () => {
  /* ★왜 (2026-09-21 이벨류에이터 지적 medium②, 실측):
       스티커 «추가»는 push-before(appendChild 앞), 스티커 «삭제»는 push-after 였다.
       둘이 찍는 캔버스가 «둘 다 스티커 없는» 상태라 pushHistory 의 무변화 중복차단에 걸려
       「스티커가 있던 캔버스」가 스택 어디에도 안 남았다 ⇒ ⌘Z 로 못 돌아온다(되돌릴 수 없는 소실).
       이 커밋이 .sticker-block 을 ⌘A 대상에 넣으면서 그 소실이 «전체선택→삭제»에 노출됐다. */
  const STK = readSrc(REPO, 'js/sticker-select.js');
  const i = STK.indexOf("if (e.key !== 'Delete' && e.key !== 'Backspace') return;");
  assert.ok(i >= 0, 'js/sticker-select.js 의 Delete 핸들러를 못 찾았다');
  const handler = STK.slice(i, STK.indexOf("window.scheduleAutoSave?.();", i));
  const iCheck = handler.indexOf("ensureHistoryCheckpoint");
  const iRemove = handler.indexOf("sel.remove();");
  assert.ok(iCheck >= 0, '스티커 삭제가 «삭제 전» 체크포인트를 안 찍는다 ⇒ ⌘Z 로 안 돌아온다:\n' + handler);
  assert.ok(iCheck < iRemove, 'ensureHistoryCheckpoint 가 sel.remove() «뒤»에 있다 — 그러면 찍히는 건 이미 지워진 캔버스다');
  // 섞인 선택은 공통 경로(editor.js)에 맡긴다 — 두 핸들러가 따로 지우면 히스토리가 두 칸이 된다.
  assert.match(handler, /CANVAS_SEL_BLOCKS_AND_SHAPE[\s\S]*?length > 1[\s\S]*?return;/,
    '스티커 핸들러가 «섞인 선택»을 공통 경로에 안 넘긴다 ⇒ Delete 한 번이 히스토리 두 칸이 되어 ⌘Z 한 번에 스티커만 안 돌아온다:\n' + handler);
});
