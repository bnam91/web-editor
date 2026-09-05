/* 단위 하네스 — 심플카드 «캔버스 인라인 편집»(canvas-block.js)과 «우측패널 접기»(prop-simple-card.js).
 * 실행: node --test "tests/unit/*.test.js"   ·  라이브 userData 무접촉(소스를 «읽기»만 한다).
 *
 * ★손으로 쓴 모델이 아니라 «실제 소스 파일»을 import 한다(duo-grid-p1.test.js 와 같은 원칙).
 *   두 모듈 다 브라우저 전용 모듈을 import 하므로(top-level 에 document.addEventListener 등
 *   부작용이 있어 plain Node 에서 import 자체가 실패) 그 import 줄«만» no-op 스텁으로 바꾼
 *   사본을 쓴다. 그 외 바이트는 동일 — 판정 로직은 진짜 그 파일에서 온다.
 * ★package.json 이 "type":"commonjs" 라 .test.js 에서 정적 import 를 못 쓴다
 *   → before() 훅 안에서 동적 import() 로 로드하고 공유 변수로 참조한다.
 *
 * ★왜 이 파일이 있나 — dev 기준 심플카드 관련 단위테스트가 «0건»이었다. 이번 변경이
 *   (a) 편집 판정을 술어 하나로 모으고 (b) 커밋을 updateCanvasBlock 한 경로로 돌리므로,
 *   그 두 계약이 실제로 성립하는지를 기계로 못 박는다.
 */
'use strict';
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');

/* ── 소스 → 스텁 사본(.mjs) ─────────────────────────────────────────────────── */
function stubCopy(relSrc, replacements, tag) {
  const srcPath = path.join(__dirname, '../../', relSrc);
  let src = fs.readFileSync(srcPath, 'utf8');
  for (const [from, to] of replacements) {
    const before = src;
    src = src.replace(from, to);
    assert.notEqual(src, before, `${relSrc} 에서 다음을 못 찾음 — 리팩터링됐나?\n${from}`);
  }
  const out = path.join(os.tmpdir(), `${tag}-${process.pid}-${Math.random().toString(36).slice(2, 8)}.mjs`);
  fs.writeFileSync(out, src);
  return pathToFileURL(out).href;
}

/* ── 미니 DOM (이 테스트가 실제로 쓰는 표면만) ───────────────────────────────── */
function makeEl(tag) {
  let _cls = new Set();
  const el = {
    tagName: tag,
    dataset: {},
    style: {},
    // className 과 classList 는 «같은 한 벌»이다 — 실제 DOM 처럼 한쪽을 쓰면 다른 쪽도 보인다.
    // (이걸 안 묶으면 renderer 는 className 으로 쓰고 updateCanvasBlock 은 classList 로 읽어
    //  테스트만 통과하는 «가짜 초록/가짜 빨강»이 난다 — 실제로 여기서 한 번 났다.)
    get className() { return [..._cls].join(' '); },
    set className(v) { _cls = new Set(String(v).split(/\s+/).filter(Boolean)); },
    children: [],
    parent: null,
    textContent: '',
    get innerText() { return this.textContent; },
    classList: {
      add(...c) { c.forEach(x => _cls.add(x)); },
      remove(...c) { c.forEach(x => _cls.delete(x)); },
      contains(c) { return _cls.has(c); },
    },
    setAttribute(k, v) { this[k] = v; },
    removeAttribute(k) { delete this[k]; },
    appendChild(c) { c.parent = el; el.children.push(c); return c; },
    contains(n) { for (let p = n; p; p = p.parent) if (p === el) return true; return false; },
    // 셀렉터는 이 테스트가 쓰는 형태(.class 목록)만 해석한다.
    closest(sel) {
      const classes = sel.split(',').map(s => s.trim().replace(/^\./, ''));
      for (let p = el; p; p = p.parent) {
        const own = new Set(String(p.className || '').split(/\s+/).filter(Boolean));
        if (classes.some(c => own.has(c))) return p;
      }
      return null;
    },
  };
  return el;
}
// className 을 넣으면 classList 도 따라오게 하는 헬퍼(렌더러는 className 으로 쓴다).
function elWithClass(cls) { const e = makeEl('div'); e.className = cls; return e; }

let CVB, PROP;

before(async () => {
  const cvbUrl = stubCopy(
    'js/blocks/canvas-block.js',
    [[
      "import { genId, showNoSelectionHint, insertAfterSelected, colorLuminance } from '../drag-utils.js';\nimport { bindBlock } from '../drag-drop.js';",
      "const genId = (p) => `${p}_` + Math.random().toString(36).slice(2, 9);\n"
      + "const showNoSelectionHint = () => {};\nconst insertAfterSelected = () => {};\n"
      + "const colorLuminance = () => null;\nconst bindBlock = () => {};",
    ]],
    'cvb-canvas-block'
  );
  const propUrl = stubCopy(
    'js/props/prop-simple-card.js',
    [["import { propPanel } from '../globals.js';", 'const propPanel = null;']],
    'cvb-prop-simple-card'
  );
  // 모듈 top-level 에서 window/document 를 만지는 줄이 있으므로 최소 전역만 깔아 둔다.
  globalThis.window = globalThis.window || globalThis;
  globalThis.document = globalThis.document || { createElement: makeEl, getElementById: () => null };
  CVB = await import(cvbUrl);
  PROP = await import(propUrl);
});

/* ═══ ① 판정 술어 — _cvbEditable ══════════════════════════════════════════════ */

test('①-1 술어가 보는 셀렉터·필드 목록이 «렌더러가 찍는 것»과 같다', () => {
  // 리터럴을 다시 적지 않는다 — 소스에서 가져온 상수로 비교한다.
  for (const cls of ['cvb-card-title', 'cvb-card-desc', 'cvb-card-ph']) {
    assert.ok(CVB._CVB_EDIT_SEL.includes('.' + cls), `${cls} 가 _CVB_EDIT_SEL 에 없다`);
  }
  assert.deepEqual(
    CVB._CVB_EDIT_FIELDS,
    ['title', 'desc', 'titleTop', 'descTop', 'titleBottom', 'descBottom']
  );
});

test('①-2 제목/설명/안내문 요소를 «주소»와 함께 잡아낸다', () => {
  const block = elWithClass('canvas-block');
  for (const [cls, field] of [['cvb-card-title', 'title'], ['cvb-card-desc', 'desc'], ['cvb-card-ph', 'titleTop']]) {
    const host = elWithClass(cls);
    host.dataset.cardIdx = '3';
    host.dataset.field = field;
    block.appendChild(host);
    const hit = CVB._cvbEditable(host, block);
    assert.ok(hit, `${cls} 를 못 잡았다`);
    assert.equal(hit.host, host);
    assert.equal(hit.idx, 3);
    assert.equal(hit.field, field);
  }
});

test('①-3 주소가 없거나 필드가 목록 밖이면 «편집 대상 아님»(null)', () => {
  const block = elWithClass('canvas-block');
  const mk = (ds) => { const h = elWithClass('cvb-card-title'); Object.assign(h.dataset, ds); block.appendChild(h); return h; };
  assert.equal(CVB._cvbEditable(mk({ field: 'title' }), block), null, 'cardIdx 없음');
  assert.equal(CVB._cvbEditable(mk({ cardIdx: '0' }), block), null, 'field 없음');
  assert.equal(CVB._cvbEditable(mk({ cardIdx: '0', field: 'cellBg' }), block), null, '필드 목록 밖(색상 필드)');
  assert.equal(CVB._cvbEditable(mk({ cardIdx: '-1', field: 'title' }), block), null, '음수 인덱스');
  // 이미지 영역 등 그 밖의 요소
  const other = elWithClass('cvb-card-img');
  block.appendChild(other);
  assert.equal(CVB._cvbEditable(other, block), null, '텍스트가 아닌 요소');
});

test('①-4 «다른 블록»의 요소는 잡지 않는다 (block.contains 경계)', () => {
  const a = elWithClass('canvas-block');
  const b = elWithClass('canvas-block');
  const host = elWithClass('cvb-card-title');
  host.dataset.cardIdx = '0'; host.dataset.field = 'title';
  b.appendChild(host);
  assert.ok(CVB._cvbEditable(host, b));
  assert.equal(CVB._cvbEditable(host, a), null);
});

test('①-5 읽기는 개행을 정규화하되 «앞뒤 공백은 살린다»(옛 .trim() 회귀 방지)', () => {
  const host = elWithClass('cvb-card-title');
  host.textContent = '  들여쓴 제목  ';
  assert.equal(CVB._cvbReadText(host), '  들여쓴 제목  ');
  host.textContent = '첫줄\r\n둘째줄\r\n\n';   // contenteditable 이 끝에 남기는 개행은 걷어낸다
  assert.equal(CVB._cvbReadText(host), '첫줄\n둘째줄');
});

/* ═══ ② 빈 문자열 함정 — 안내문이 «주소»를 갖는다 ════════════════════════════ */

test('②-1 글자가 있으면 title/desc 요소가 주소를 달고 나온다', () => {
  const c = makeEl('div');
  CVB._appendCardTexts(c, { title: '제목', desc: '설명' }, 20, 14, 'left', '#000', '#333', 2, null);
  assert.equal(c.children.length, 2);
  assert.deepEqual(c.children.map(e => e.className), ['cvb-card-title', 'cvb-card-desc']);
  assert.deepEqual(c.children.map(e => e.dataset.cardIdx), [2, 2]);
  assert.deepEqual(c.children.map(e => e.dataset.field), ['title', 'desc']);
});

test('②-2 ★글자를 «전부» 지워도 안내문이 주소를 갖는다 — 캔버스에서 다시 잡을 수 있다', () => {
  const block = elWithClass('canvas-block');
  const c = makeEl('div');
  block.appendChild(c);
  CVB._appendCardTexts(c, { title: '', desc: '' }, 20, 14, 'left', '#000', '#333', 5, null);
  assert.equal(c.children.length, 1, '안내문 하나만 나와야 한다');
  const ph = c.children[0];
  assert.equal(ph.className, 'cvb-card-ph');
  // ★결정적 계약: 술어가 이 안내문을 «편집 가능»으로 판정해야 복구 경로가 산다.
  const hit = CVB._cvbEditable(ph, block);
  assert.ok(hit, '안내문이 편집 대상이 아니면 글자를 다 지운 카드는 영영 못 고친다');
  assert.equal(hit.idx, 5);
  assert.equal(hit.field, 'title');
});

test('②-3 both 슬롯의 빈 안내문은 «그 슬롯의» 제목 필드로 라우팅된다', () => {
  const block = elWithClass('canvas-block');
  const c = makeEl('div');
  block.appendChild(c);
  CVB._appendCardTexts(c, {}, 20, 14, 'left', '#000', '#333', 1, 'bottom');
  const hit = CVB._cvbEditable(c.children[0], block);
  assert.equal(hit.field, 'titleBottom', 'card.title 로 새면 상단 라벨을 덮어쓴다');
  assert.equal(c.children[0].dataset.slot, 'bottom');
});

test('②-4 «한쪽만» 비면 남은 쪽만 그려진다 — 안내문은 안 나온다(현행 렌더 규칙 고정)', () => {
  const c = makeEl('div');
  CVB._appendCardTexts(c, { title: '제목만', desc: '' }, 20, 14, 'left', '#000', '#333', 0, null);
  assert.equal(c.children.length, 1);
  assert.equal(c.children[0].className, 'cvb-card-title');
});

/* ═══ ③ 커밋 경로 — updateCanvasBlock({patchCards}) ════════════════════════════ */

function makeCardBlock(cards, id = 'cvb_test1') {
  const block = elWithClass('canvas-block');
  block.id = id;
  block.dataset.cardMode = 'simple';
  block.dataset.cards = JSON.stringify(cards);
  block.dataset.gridCols = '1';
  block.dataset.gridRows = String(cards.length);
  globalThis.document.getElementById = (x) => (x === id ? block : null);
  return block;
}

test('③-1 patchCards 왕복 — 겨눈 카드의 «그 필드만» 바뀌고 형제는 그대로', () => {
  const block = makeCardBlock([{ title: 'A', desc: 'a' }, { title: 'B', desc: 'b' }]);
  let rendered = 0;
  globalThis.window.renderCanvas = () => { rendered++; };
  const r = CVB.updateCanvasBlock(block.id, { patchCards: [{ index: 1, title: '바뀐 B' }] });
  assert.equal(r.ok, true, r.message);
  const out = JSON.parse(block.dataset.cards);
  assert.deepEqual(out[0], { title: 'A', desc: 'a' }, '형제 카드가 변했다');
  assert.deepEqual(out[1], { title: '바뀐 B', desc: 'b' }, 'desc 가 merge 로 보존돼야 한다');
  assert.equal(rendered, 1, '커밋은 재렌더를 «한 번» 부른다');
});

test('③-2 ★pushHistory 는 편집 세션당 «1회» — 타이핑 단위로 쌓이면 ⌘Z 가 글자로 끊긴다', () => {
  const block = makeCardBlock([{ title: 'A', desc: '' }]);
  globalThis.window.renderCanvas = () => {};
  let pushes = 0;
  globalThis.window.pushHistory = () => { pushes++; };
  CVB.updateCanvasBlock(block.id, { patchCards: [{ index: 0, title: 'A2' }] });
  assert.equal(pushes, 1);
});

test('③-3 빈 문자열도 «값»으로 커밋된다(지우기가 저장돼야 한다)', () => {
  const block = makeCardBlock([{ title: 'A', desc: 'a' }]);
  globalThis.window.renderCanvas = () => {};
  const r = CVB.updateCanvasBlock(block.id, { patchCards: [{ index: 0, title: '' }] });
  assert.equal(r.ok, true, r.message);
  assert.equal(JSON.parse(block.dataset.cards)[0].title, '');
  assert.equal(JSON.parse(block.dataset.cards)[0].desc, 'a');
});

test('③-4 ★인라인 편집이 쓸 수 있는 필드는 전부 이 경로를 통과한다', () => {
  // 술어의 필드 목록(SSOT)을 그대로 돌린다 — 목록에 필드를 더하고 검증을 잊는 것을 막는다.
  for (const field of CVB._CVB_EDIT_FIELDS) {
    const block = makeCardBlock([{ title: 'A' }], 'cvb_f_' + field);
    globalThis.window.renderCanvas = () => {};
    const r = CVB.updateCanvasBlock(block.id, { patchCards: [{ index: 0, [field]: '값' }] });
    assert.equal(r.ok, true, `${field}: ${r.message}`);
    assert.equal(JSON.parse(block.dataset.cards)[0][field], '값');
  }
});

test('③-5 배열 밖 index 는 patchCards 가 막는다 — 그래서 커밋부에 pad 분기가 필요했다', () => {
  const block = makeCardBlock([{ title: 'A' }]);
  globalThis.window.renderCanvas = () => {};
  const r = CVB.updateCanvasBlock(block.id, { patchCards: [{ index: 1, title: 'X' }] });
  assert.equal(r.ok, false);
  assert.equal(r.code, 'NOT_FOUND');
  // pad 분기가 쓰는 cards 전체교체는 통과해야 한다
  const r2 = CVB.updateCanvasBlock(block.id, { cards: [{ title: 'A' }, { title: 'X' }] });
  assert.equal(r2.ok, true, r2.message);
  assert.equal(JSON.parse(block.dataset.cards)[1].title, 'X');
});

test('③-6 500자 초과는 거부된다 — dataset 직접쓰기를 버린 «이유»', () => {
  const block = makeCardBlock([{ title: 'A' }]);
  globalThis.window.renderCanvas = () => {};
  const r = CVB.updateCanvasBlock(block.id, { patchCards: [{ index: 0, title: 'x'.repeat(501) }] });
  assert.equal(r.ok, false);
  assert.equal(r.code, 'INVALID');
  assert.equal(JSON.parse(block.dataset.cards)[0].title, 'A', '거부됐으면 데이터는 그대로여야 한다');
});

/* ═══ ④ 우측패널 접기 — cvbCardFold ═══════════════════════════════════════════ */

test('④-1 기본은 «접힘» — 카드가 몇 장이든 입력칸이 열려 있지 않다', () => {
  const cards = [{ title: 'A', desc: 'a' }, { title: 'B', desc: 'b' }, { title: 'C' }];
  const expanded = new Set();
  cards.forEach((c, i) => assert.equal(PROP.cvbCardFold(c, i, false, expanded).open, false, `카드 ${i}`));
});

test('④-2 펼친 카드는 «그 카드만» 열린다', () => {
  const cards = [{ title: 'A' }, { title: 'B' }, { title: 'C' }];
  const expanded = new Set([1]);
  assert.deepEqual(cards.map((c, i) => PROP.cvbCardFold(c, i, false, expanded).open), [false, true, false]);
});

test('④-3 ★빈 카드는 «항상» 펼친다 — 캔버스에 겨냥할 글자가 없어 여기가 유일한 입구다', () => {
  const expanded = new Set();
  assert.equal(PROP.cvbCardFold({ title: '', desc: '' }, 0, false, expanded).open, true);
  assert.equal(PROP.cvbCardFold({}, 0, false, expanded).open, true);
  assert.equal(PROP.cvbCardFold({ title: '   ', desc: '\n' }, 0, false, expanded).open, true, '공백만 있어도 빈 카드');
  assert.equal(PROP.cvbCardFold({ title: '', desc: '' }, 0, false, expanded).preview, '(빈 카드)');
});

test('④-4 미리보기가 «렌더러와 같은 값»을 보여준다 (both 모드 폴백 포함)', () => {
  // both 모드에서 슬롯 값이 없으면 렌더러는 title/desc 로 폴백한다 → 미리보기도 같아야 한다.
  const card = { title: '공용제목', desc: '공용설명', titleTop: '상단만' };
  assert.deepEqual(PROP.cvbCardTexts(card, true), ['상단만', '공용설명', '공용제목', '공용설명']);
  assert.deepEqual(PROP.cvbCardTexts(card, false), ['공용제목', '공용설명']);
  assert.equal(PROP.cvbCardFold(card, 0, false, new Set()).preview, '공용제목 · 공용설명');
});

test('④-5 both 모드에서 슬롯이 전부 비고 폴백도 비면 «빈 카드»', () => {
  assert.equal(PROP.cvbCardFold({ title: '', desc: '' }, 0, true, new Set()).isEmpty, true);
  // 폴백으로 글자가 살아있으면 빈 카드가 아니다(접힘이 기본)
  assert.equal(PROP.cvbCardFold({ title: '살아있음' }, 0, true, new Set()).isEmpty, false);
});

test('④-6 미리보기는 길어도 «한 줄»로 잘린다 (칩이 두 줄로 무너지지 않게)', () => {
  const f = PROP.cvbCardFold({ title: '가'.repeat(100), desc: '나'.repeat(100) }, 0, false, new Set());
  assert.equal(f.preview.length, 28);
});
