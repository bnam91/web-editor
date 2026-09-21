/* ul-groupdup-shell.test.mjs — 0920b 유저렌즈 유닛 «groupdup»
 *
 * 증상: 복제본+원본을 ⌘G 로 묶으면 «복제본이 말없이 사라진다»(데이터 손실, 토스트 0건).
 * 뿌리: js/block-factory.js wrapSelectedBlocksInFrame 의 flow 분기가
 *       ⑴ 단위를 `… || b` 로 폴백해 «블록 자신»을 껍데기로 오인하고
 *       ⑵ 알맹이를 손으로 적은 명부(BLOCK_SEL 27종)로만 퍼낸 뒤
 *       ⑶ 껍데기를 «무조건» row.remove() 했다.
 *       ⇒ 단위=블록 자신이면 퍼낼 게 없고(자손 검색은 자기 자신을 안 담는다) 그대로 삭제됐다.
 *
 * 여기서는 shape-frame.js 에 새로 둔 «성질 판정» 술어 셋을 순수하게 재고(①~④),
 * block-factory 쪽이 그 불변식을 실제로 배선했는지 소스로 못박는다(⑤~⑦, 핀).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readSrc } from './_srcread.js';
import { sliceBlock } from './_slice-block.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SF = readSrc(ROOT, 'js/shape-frame.js');
const BF = readSrc(ROOT, 'js/block-factory.js');
const WRAP = sliceBlock(BF, 'function wrapSelectedBlocksInFrame(');

/* shape-frame.js 는 ⛔import 없는 순수 DOM 모듈이라 vm 에서 export 만 걷어내고 바로 돌릴 수 있다. */
function loadPredicates() {
  const ctx = { window: undefined };
  vm.createContext(ctx);
  vm.runInContext(SF.replace(/^export /gm, ''), ctx);
  vm.runInContext('this.__api = { isBlockEl, topLevelBlocksOf, isEmptyShell };', ctx);
  return ctx.__api;
}
const { isBlockEl, topLevelBlocksOf: _tlb, isEmptyShell } = loadPredicates();
// vm 컨텍스트가 돌려주는 배열은 «다른 realm» 이라 deepStrictEqual 이 프로토타입에서 걸린다 — 여기서 벗긴다.
const topLevelBlocksOf = (x) => [..._tlb(x)];

/* 최소 DOM 대역 — 술어가 쓰는 것은 nodeType·classList(이터러블)·children 뿐이다. */
const el = (cls, kids = []) => ({ nodeType: 1, classList: cls.split(' ').filter(Boolean), children: kids });

test('① isBlockEl — 클래스가 `-block` 으로 끝나면 블록, 아니면 아니다(명부 없음)', () => {
  for (const c of ['text-block', 'modal-block', 'frame-block', 'gap-block',
                   'speech-bubble-block', 'sticker-block', 'gradient-block',
                   '아직-없는-미래-block']) {
    assert.equal(isBlockEl(el(c)), true, c);
  }
  for (const c of ['row', 'col', 'section-inner', 'tb-h1', 'block', 'blockish', 'md-body']) {
    assert.equal(isBlockEl(el(c)), false, c);
  }
  assert.equal(isBlockEl(el('selected text-block')), true, '클래스가 여럿이어도 하나만 맞으면 된다');
  for (const bad of [null, undefined, {}, { nodeType: 3 }, { nodeType: 1 }]) {
    assert.equal(isBlockEl(bad), false, String(bad && bad.nodeType));
  }
});

test('② topLevelBlocksOf — 블록을 만나면 «거기서 멈춘다»(블록 안은 알맹이가 아니다)', () => {
  const inner = el('text-block', [el('tb-h1')]);
  const tf = el('frame-block', [inner]);
  const row = el('row', [tf, el('modal-block')]);
  // 텍스트프레임은 그 자체가 «최상위 알맹이» — 안의 text-block 을 또 담지 않는다(중복 수확 금지)
  const got = topLevelBlocksOf(row);
  assert.equal(got.length, 2);
  assert.equal(got[0], tf);
  assert.equal(got.includes(inner), false, '블록 «안»의 블록까지 파고들면 빈 프레임이 남는다');
});

test('③ topLevelBlocksOf — 블록이 «아닌» 중간 껍데기(.col)는 한 겹 더 들어간다', () => {
  const a = el('text-block'), b = el('asset-block');
  const row = el('row', [el('col', [a]), el('col', [b])]);
  assert.deepEqual(topLevelBlocksOf(row), [a, b]);
  assert.deepEqual(topLevelBlocksOf(el('row', [])), [], '빈 row');
  assert.deepEqual(topLevelBlocksOf(el('row', [el('col', [])])), [], '.col 만 있는 row');
  assert.deepEqual(topLevelBlocksOf(null), [], '널 안전');
});

test('④ isEmptyShell — 알맹이 0 이면 참. 이게 「껍데기만 지운다」 게이트다', () => {
  assert.equal(isEmptyShell(el('row', [])), true);
  assert.equal(isEmptyShell(el('row', [el('col', [])])), true, '빈 .col 만 남은 row 는 지워도 된다');
  assert.equal(isEmptyShell(el('frame-block', [])), true, '알맹이를 퍼낸 텍스트프레임');
  assert.equal(isEmptyShell(el('row', [el('modal-block')])), false, '명부에 없던 타입도 알맹이로 센다');
  assert.equal(isEmptyShell(el('row', [el('col', [el('sticker-block')])])), false);
});

test('⑤ 핀 — flow 분기의 삭제는 isEmptyShell 게이트를 «반드시» 거친다(무조건 remove 금지)', () => {
  const flow = WRAP.slice(WRAP.indexOf('섹션 레벨(flow)'));
  assert.ok(flow.length > 200, 'flow 분기를 못 찾았다(리팩터 시 이 테스트부터 고칠 것)');
  const removes = flow.match(/^[ \t]*(?:if \(.+?\) )?row\.remove\(\);/gm) || [];
  assert.deepEqual(removes.map((s) => s.trim()), ['if (isEmptyShell(row)) row.remove();'],
    'flow 분기에서 단위를 지우는 자리는 한 곳뿐이고, 그 앞에 isEmptyShell 게이트가 있어야 한다');
});

test('⑥ 핀 — 단위 해석에 `|| b` 폴백이 «없다»(블록 자신이 껍데기가 되던 자리)', () => {
  assert.equal(/closest\('\.row'\) \|\| b\)/.test(WRAP), false,
    '`b.closest(".row") || b` 가 되살아나면 복제본 소실이 그대로 돌아온다');
  assert.match(WRAP, /const unit = shell \|\| b;/);
  assert.match(WRAP, /if \(shell\) shells\.add\(shell\);/);
});

test('⑦ 핀 — 알맹이 퍼내기가 명부(BLOCK_SEL)를 쓰지 않는다', () => {
  assert.equal(/querySelectorAll\(BLOCK_SEL\)/.test(WRAP), false,
    '명부로 퍼내면 명부에 없는 타입(modal·sticker·gradient·speech-bubble)이 껍데기와 같이 삭제된다');
  assert.match(WRAP, /topLevelBlocksOf\(row\)/);
  // BLOCK_SEL 자체는 «무엇을 선택된 것으로 볼 것인가» 용도로 남아 있어야 한다(역할이 다르다)
  assert.match(WRAP, /BLOCK_SEL\.split\(','\)/);
});

test('⑧ 핀 — shape-frame.js 는 여전히 import 0건(하네스 DOM 테스트가 단독 로드한다)', () => {
  assert.equal((SF.match(/^import\s/gm) || []).length, 0);
  assert.match(SF, /export function isBlockEl/);
  assert.match(SF, /export function topLevelBlocksOf/);
  assert.match(SF, /export function isEmptyShell/);
});
