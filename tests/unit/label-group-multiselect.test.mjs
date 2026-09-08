/* U-LGMS — 라벨그룹(.label-group-block)의 «칩을 눌러도» ⌘/shift 다중선택이 된다.
 *   실행: node --test "tests/unit/*.test.mjs"  ·  DOM 없이 «소스에서 click 핸들러만» 떼어 «실행»한다.
 *
 * ★현빈 제보: lg_26wrz_ik4d60n 이 «다른 위아래 블록과 동시 선택이 안 된다».
 *   스파이 실측(고치기 «전»):
 *     칩(.label-item) + ⌘     → 선택 1개 · toggleBlockSelect 0회 · rangeSelectBlocks 0회
 *     블록 배경    + ⌘        → 선택 2개 · toggleBlockSelect 1회
 *     칩          + shift     → 선택 1개 · 0회 / 0회
 *     블록 배경    + shift     → 선택 2개 · rangeSelectBlocks 1회
 *   ★같은 블록인데 «누른 자리»만 다르면 2개가 된다 ⇒ 「목록에 없다」가 아니라 「문이 잘못됐다」.
 *   .label-group-block 은 SIBLING_MULTI_SEL·FLOW_BLOCK_SEL_SELECTED 에 «이미» 들어 있다.
 *   기하: lg 716x69.5 안에 칩 121.8x53.5 짜리 3개가 «왼쪽에 몰려» 있어 라벨을 겨냥하면 반드시 이 문으로 온다.
 *
 * ★세 가지가 같이 빠져 있었다: ⓐ metaKey/ctrlKey ⓑ shiftKey ⓒ setBlockAnchor
 *   (ⓒ 가 없으면 칩을 누른 «뒤» shift 범위선택이 «묵은 앵커»에서 뻗는다.)
 *
 * ⛔되돌리면 빨개지는 것: js/block-drag.js 의 라벨 아이템 분기에서
 *   ⌘ 두 줄을 지우면 [칩+⌘] 이, shift 줄을 지우면 [칩+shift] 가, setBlockAnchor 를 지우면
 *   [칩 단독]의 앵커 단언이 죽는다. 「배경」 줄은 그대로여서 «양성대조»가 계속 초록이다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { readSrc } from './_srcread.js';
import { stripComments } from './_strip-comments.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
// ⛔주석 걷어내기는 공용 부품만 쓴다(자기 벌 금지 — S-6).
const SRC = stripComments(readSrc(ROOT, 'js/block-drag.js'));

/* 라벨그룹 click 핸들러의 «몸통»을 중괄호 균형으로 잘라낸다. ⛔고정 창(slice(i, i+900)) 금지. */
function sliceLabelGroupClick() {
  const gi = SRC.indexOf('if (isLabelGroup) {');
  assert.ok(gi >= 0, 'if (isLabelGroup) 분기를 못 찾았다 — 이름이 바뀌었으면 이 검사도 같이 옮겨라');
  const ai = SRC.indexOf("block.addEventListener('click'", gi);
  assert.ok(ai >= 0 && ai - gi < 400, '라벨그룹 분기 «안»의 click 리스너를 못 찾았다');
  const bs = SRC.indexOf('{', SRC.indexOf('=>', ai));
  assert.ok(bs > ai, '핸들러 몸통의 여는 중괄호를 못 찾았다');
  let depth = 0, be = -1;
  for (let k = bs; k < SRC.length; k++) {
    if (SRC[k] === '{') depth++;
    else if (SRC[k] === '}') { depth--; if (!depth) { be = k + 1; break; } }
  }
  assert.ok(be > bs, '중괄호 균형이 안 맞는다 — 핸들러 경계를 못 잡았다');
  return SRC.slice(bs, be);
}
const BODY = sliceLabelGroupClick();

/* ── 얇은 가짜 DOM ─────────────────────────────────────────────────────── */
const cl = (init = []) => {
  const s = new Set(init);
  return { add: c => s.add(c), remove: c => s.delete(c), contains: c => s.has(c), _set: s };
};
function makeWorld({ selected = false } = {}) {
  const calls = { toggle: [], range: [], anchor: [], deselect: 0, props: [], sync: 0, hl: 0 };
  const SEC = { classList: cl(), _tag: 'sec' };
  const chips = [0, 1, 2].map(i => {
    const o = { _tag: 'chip' + i, classList: cl(['label-item']) };
    o.closest = sel => (sel === '.label-item' ? o : sel === '.section-block' ? SEC : null);
    o.querySelector = () => null;
    return o;
  });
  const block = {
    _tag: 'lg', _layerItem: 'LI',
    classList: cl(selected ? ['label-group-block', 'selected'] : ['label-group-block']),
    querySelectorAll: sel => (sel === '.label-item' ? chips : []),
    querySelector: () => null,
    closest: sel => (sel === '.section-block' ? SEC : null),
  };
  const win = {
    deselectAll: () => { calls.deselect++; },
    syncSection: () => { calls.sync++; },
    highlightBlock: () => { calls.hl++; },
    syncLayerActive: () => {},
    showFrameProperties: () => {},
    showLabelGroupProperties: (b, it) => calls.props.push(it ? it._tag : null),
    toggleBlockSelect: (b, s) => calls.toggle.push([b._tag, s && s._tag]),
    rangeSelectBlocks: (b, s) => calls.range.push([b._tag, s && s._tag]),
    setBlockAnchor: b => calls.anchor.push(b._tag),
    pushHistory: () => {},
  };
  const ctx = vm.createContext({
    window: win, block, SEC, chips, calls,
    _isInsideUnselectedFrame: () => false,
    _getParentFrame: () => null,
    _restoreParentFrameSelected: () => {},
    makeLabelItem: () => ({ classList: cl() }),
    showToast: () => {},
  });
  vm.runInContext(`function onClick(e) ${BODY}\nglobalThis.__onClick = onClick;`, ctx);
  return { onClick: ctx.__onClick, calls, block, chips, SEC };
}
const ev = (target, mods = {}) => ({ target, stopPropagation: () => {},
  metaKey: !!mods.meta, ctrlKey: !!mods.ctrl, shiftKey: !!mods.shift });

/* ★표 — 「어디를 누르고 어떤 수식어를 썼나」 → 「무엇이 몇 번 불려야 하나」. */
const CASES = [
  { at: 'chip', mods: { meta: true },  toggle: 1, range: 0, why: '칩 위에서 ⌘ — 배경과 «같아야» 한다' },
  { at: 'chip', mods: { ctrl: true },  toggle: 1, range: 0, why: '칩 위에서 ctrl(윈도우)' },
  { at: 'chip', mods: { shift: true }, toggle: 0, range: 1, why: '칩 위에서 shift 범위선택' },
  { at: 'bg',   mods: { meta: true },  toggle: 1, range: 0, why: '★양성대조 — 배경 ⌘ 는 «원래도» 됐다' },
  { at: 'bg',   mods: { shift: true }, toggle: 0, range: 1, why: '★양성대조 — 배경 shift 는 «원래도» 됐다' },
];

test('★입력이 살아 있다 — 잘라낸 핸들러와 표가 «비어 있지 않다»', () => {
  assert.ok(BODY.length > 200, `핸들러 몸통이 ${BODY.length}자다 — 잘못 잘랐으면 아래 검사는 아무것도 안 본다`);
  assert.ok(BODY.includes('.label-item'), '잘라낸 것이 라벨그룹 핸들러가 아니다');
  assert.ok(BODY.includes('label-group-add-btn'), '잘라낸 범위가 «칩 분기까지» 안 닿았다');
  assert.equal(CASES.length, 5, '표가 줄었다 — 케이스가 사라지면 루프가 «0바퀴»로 스스로 통과한다');
  // 하네스가 «호출을 실제로 볼 수 있는지» 먼저 증명한다.
  const w = makeWorld();
  w.onClick(ev(w.block, { meta: true }));
  assert.equal(w.calls.toggle.length, 1, '배경 ⌘ 조차 안 잡힌다면 스파이 배선이 죽은 것이다');
});

test('★칩(.label-item)을 눌러도 ⌘·shift 가 «배경과 같이» 동작한다', () => {
  let ran = 0;
  for (const c of CASES) {
    const w = makeWorld();
    const target = c.at === 'chip' ? w.chips[0] : w.block;
    w.onClick(ev(target, c.mods));
    ran++;
    assert.equal(w.calls.toggle.length, c.toggle,
      `[${c.at} ${JSON.stringify(c.mods)}] toggleBlockSelect ${w.calls.toggle.length}회 (기대 ${c.toggle}) — ${c.why}`);
    assert.equal(w.calls.range.length, c.range,
      `[${c.at} ${JSON.stringify(c.mods)}] rangeSelectBlocks ${w.calls.range.length}회 (기대 ${c.range}) — ${c.why}`);
    if (c.toggle || c.range) {
      const got = (c.toggle ? w.calls.toggle : w.calls.range)[0];
      assert.deepEqual(got, ['lg', 'sec'],
        `[${c.at}] 블록·섹션을 «둘 다» 넘겨야 한다 — sec 가 null 이면 범위선택이 못 돈다`);
      assert.equal(w.calls.deselect, 0,
        `[${c.at}] 다중선택 경로인데 deselectAll 이 불렸다 — 나머지 선택이 날아간다`);
      assert.equal(w.calls.props.length, 0,
        `[${c.at}] 다중선택인데 프로퍼티 패널을 열었다 — 단일선택처럼 보인다`);
    }
  }
  assert.equal(ran, CASES.length, `루프가 ${ran} 바퀴만 돌았다 — 표를 «다» 안 봤다`);
});

test('★칩 단독 클릭은 그대로 «단일선택 + 아이템 선택» 이고, 앵커가 이 블록으로 옮겨진다', () => {
  const w = makeWorld();
  w.onClick(ev(w.chips[1]));
  assert.equal(w.calls.toggle.length, 0, '수식어가 없는데 다중선택으로 샜다');
  assert.equal(w.calls.range.length, 0, '수식어가 없는데 범위선택으로 샜다');
  assert.equal(w.calls.deselect, 1, '단독 클릭은 «나머지를 풀고» 이 블록만 잡아야 한다');
  assert.ok(w.block.classList.contains('selected'), '블록이 선택되지 않았다');
  assert.ok(w.chips[1].classList.contains('item-selected'), '누른 칩이 «아이템 선택»되지 않았다');
  assert.ok(!w.chips[0].classList.contains('item-selected'), '다른 칩의 아이템 선택이 안 풀렸다');
  assert.deepEqual(w.calls.props, ['chip1'], '프로퍼티 패널에 «누른 칩»이 안 넘어갔다');
  // ★ⓒ — 이게 없으면 칩을 누른 뒤 shift 범위선택이 «묵은 앵커»에서 뻗는다.
  assert.deepEqual(w.calls.anchor, ['lg'], `setBlockAnchor 가 ${w.calls.anchor.length}회 — 「이 블록」으로 한 번 옮겨야 한다`);
});

test('★이미 선택된 블록의 칩을 눌러도 앵커는 «이 블록»으로 온다 (배경 경로와 같다)', () => {
  const w = makeWorld({ selected: true });
  w.onClick(ev(w.chips[2]));
  assert.equal(w.calls.deselect, 0, '이미 선택돼 있으면 다시 풀지 않는다(옛 동작 보존)');
  assert.deepEqual(w.calls.anchor, ['lg'], '앵커가 «묵은 값»으로 남았다 — 다음 shift 가 엉뚱한 범위를 잡는다');
  assert.deepEqual(w.calls.props, ['chip2']);
});
