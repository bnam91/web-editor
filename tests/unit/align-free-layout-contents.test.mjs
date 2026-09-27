/* U-FREEALIGN — 「꽉 찬 자유배치 래퍼(그룹)」를 정렬하면 «안의 묶음»이 움직이는가.
 *   실행: node --test "tests/unit/*.test.mjs" "tests/unit/*.test.js"
 *
 * ★왜 이 파일이 있나 (T-095 2라운드 · T-091 ⑥)
 *   그룹(⌘G)은 섹션 레벨에서 width:100% 로 만들어진다(js/block-factory.js
 *   wrapSelectedBlocksInFrame 의 flow 갈래가 `width:100%` 를 못 박는다).
 *   폭에 여유가 0 이면 align-self 는 «아무 일도 안 한다» — 실측(2026-09-22, 포트 9634 실앱):
 *     섹션 오른쪽/왼쪽/가운데 정렬을 눌러도 그룹 속 도형이 L=308·R=308 «불변», 글자만 움직였다.
 *   = T-095 신고문(「글자만 움직이고 이미지·도형은 제자리」)이 그룹 안에서 그대로 살아 있었다.
 *   ⇒ 진짜 움직일 것은 그 «안»의 자유배치 자식들이고, 그 좌표의 원점이 이 래퍼의 패딩 상자다.
 *
 * ⚠️tests/dom 은 `npm test` 스위트에 «안» 들어간다. 이 자리의 변이 책임은 이 파일이 진다.
 *   진짜 CSS 위에서 화면 좌표로 재는 짝은 tests/dom/bulk-align-section.dom.spec.js (D5~D7).
 *
 * ⛔손으로 베껴 적지 않는다 — 소스에서 그 함수 «원문»을 떠서 돌린다.
 *   베끼면 js/props/prop-multisel.js 가 바뀌어도 이 검사는 영영 초록이다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../');
const SRC = fs.readFileSync(path.join(ROOT, 'js/props/prop-multisel.js'), 'utf8');

/** 중괄호 균형으로 «그 자리»의 블록을 떠낸다(선례: tests/dom/multisel-mixed-kind.dom.spec.js). */
function sliceBraces(src, from) {
  let i = src.indexOf('{', from);
  if (i < 0) throw new Error('여는 중괄호를 못 찾았다');
  let b = 0;
  for (; i < src.length; i++) {
    if (src[i] === '{') b++;
    else if (src[i] === '}') { b--; if (b === 0) return src.slice(src.indexOf('{', from) + 1, i); }
  }
  throw new Error('닫는 중괄호를 못 찾았다');
}
function extractFn(src, name) {
  const m = new RegExp('function\\s+' + name + '\\s*\\(').exec(src);
  if (!m) throw new Error('함수를 못 찾았다: ' + name);
  const open = src.indexOf('(', m.index);
  const close = src.indexOf(')', m.index);
  return 'function ' + name + '(' + src.slice(open + 1, close) + ') {' + sliceBraces(src, close) + '}';
}

const FN_SRC = extractFn(SRC, '_alignFreeLayoutContents');

/* ★배선 확인 — 떠낸 함수가 실제로 alignFlowBlock 에서 «불리는지»까지 본다.
   함수만 멀쩡하고 아무도 안 부르면 화면은 그대로다(검사 있음 ≠ 자동으로 돔). */
const ALIGN_SRC = extractFn(SRC, 'alignFlowBlock');
test('W0 ★배선 — alignFlowBlock 이 이 함수를 실제로 부른다', () => {
  assert.match(ALIGN_SRC, /_alignFreeLayoutContents\(b, dir\)/,
    'alignFlowBlock 이 이 함수를 안 부른다 — 고쳐 놔도 화면은 그대로다');
});

/* ── 최소 가짜 DOM — 이 함수가 실제로 만지는 면만 세운다 ──────────────────
   children · nodeType · clientWidth · offsetWidth · style.left · dataset · getComputedStyle */
class FakeEl {
  constructor({ w = 100, left = 0, pos = 'absolute', pad = 0, client = null } = {}) {
    this.nodeType = 1;
    this.children = [];
    this.offsetWidth = w;
    this.clientWidth = client === null ? w : client;
    this.style = { left: left === null ? '' : left + 'px' };
    this.dataset = {};
    this._style = { position: pos, paddingLeft: pad + 'px', paddingRight: pad + 'px' };
  }
  add(...kids) { this.children.push(...kids); return this; }
}
function withFakeDom(fn) {
  const prev = globalThis.getComputedStyle;
  globalThis.getComputedStyle = (el) => el._style;
  try { return fn(); } finally {
    if (prev === undefined) delete globalThis.getComputedStyle; else globalThis.getComputedStyle = prev;
  }
}
const align = new Function(FN_SRC + '; return _alignFreeLayoutContents;')();

/* 실앱과 같은 한 벌 — 그룹 래퍼(716, 패딩 0) 안에 100px(left 300) · 80px(left 340) 자유배치 둘.
   묶음 폭 = 340+80 − 300 = 120. 여유 = 716 − 120 = 596. */
function buildGroup() {
  const a = new FakeEl({ w: 100, left: 300 });
  const b = new FakeEl({ w: 80,  left: 340 });
  const g = new FakeEl({ w: 716, client: 716, pos: 'relative' }).add(a, b);
  return { g, a, b };
}

test('W1 ★오른쪽 — 묶음의 오른끝이 래퍼 오른끝에 붙는다', () => {
  const { g, a, b } = buildGroup();
  assert.equal(withFakeDom(() => align(g, 'right')), true, '옮길 수 있는 자리인데 false 를 돌려줬다');
  // 묶음 폭 120 · 여유 596 ⇒ 묶음 왼끝이 596 으로, 오른끝(596+120)이 래퍼 폭 716 에 정확히 닿는다
  assert.equal(a.style.left, '596px');
  assert.equal(b.style.left, '636px');
  assert.equal(parseFloat(b.style.left) + b.offsetWidth, 716, '오른끝이 래퍼 오른끝에 안 붙었다');
});

test('W2 ★왼쪽 — 묶음의 왼끝이 0 이 된다', () => {
  const { g, a, b } = buildGroup();
  withFakeDom(() => align(g, 'left'));
  assert.equal(a.style.left, '0px');
  assert.equal(b.style.left, '40px');
});

test('W3 ★가운데 — 좌우 여백이 같다 (묶음 폭 120, 여유 596)', () => {
  const { g, a, b } = buildGroup();
  withFakeDom(() => align(g, 'center'));
  const minX = Math.min(parseFloat(a.style.left), parseFloat(b.style.left));
  const maxX = Math.max(parseFloat(a.style.left) + a.offsetWidth, parseFloat(b.style.left) + b.offsetWidth);
  assert.equal(minX, 298);                    // (716 − 120) / 2
  assert.equal(716 - maxX, 298, '가운데인데 좌우 여백이 다르다');
});

test('W4 ★안의 상대 위치는 안 바뀐다 — 묶음째 민다(그게 그룹의 뜻이다)', () => {
  for (const dir of ['left', 'center', 'right']) {
    const { g, a, b } = buildGroup();
    const before = parseFloat(b.style.left) - parseFloat(a.style.left);
    withFakeDom(() => align(g, dir));
    assert.equal(parseFloat(b.style.left) - parseFloat(a.style.left), before,
      `${dir} 에서 그룹 «안»의 간격이 바뀌었다`);
  }
});

test('W5 저장·재로드가 보는 dataset.offsetX 도 같이 옮긴다', () => {
  const { g, a, b } = buildGroup();
  withFakeDom(() => align(g, 'left'));
  assert.equal(a.dataset.offsetX, '0');
  assert.equal(b.dataset.offsetX, '40');
});

test('W6 대조 — 자유배치 자식이 «없으면» 손대지 않고 false (종전 align-self 경로로 보낸다)', () => {
  const kid = new FakeEl({ w: 300, left: null, pos: 'static' });
  const wrap = new FakeEl({ w: 716, client: 716, pos: 'relative' }).add(kid);
  assert.equal(withFakeDom(() => align(wrap, 'right')), false);
  assert.equal(kid.style.left, '', '자유배치가 아닌 자식의 좌표를 건드렸다');
});

test('W7 대조 — 묶음이 래퍼를 «꽉 채우면» false (도형 전용 래퍼가 바로 이 꼴이다)', () => {
  const shape = new FakeEl({ w: 100, left: 0 });
  const wrap = new FakeEl({ w: 100, client: 100, pos: 'relative' }).add(shape);
  assert.equal(withFakeDom(() => align(wrap, 'right')), false,
    '여유가 0 인데 true 를 돌려줬다 — 도형이 align-self 경로를 못 타고 제자리에 묶인다');
  assert.equal(shape.style.left, '0px');
});

test('W8 래퍼의 좌우 패딩을 뺀 «콘텐츠 상자»를 기준으로 잰다', () => {
  const a = new FakeEl({ w: 100, left: 0 });
  const wrap = new FakeEl({ w: 400, client: 400, pos: 'relative', pad: 50 }).add(a);
  withFakeDom(() => align(wrap, 'right'));
  assert.equal(a.style.left, '200px', '패딩(50×2)을 안 빼고 쟀다');   // 400 − 100 − 100
});
