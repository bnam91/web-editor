/* cvb-ctx-line-add — 카드블럭 «우클릭 → 아래에 줄 추가 (T)» (1020t2i1 · 현빈 「카드블럭에 우클릭에 줄추가 가능하게」)
 *
 * ★무엇을 지키나
 *   U1 우클릭한 점 → 줄 주소(js/blocks/line-host.js lnCtxAddAddr) — 카드만 · 줄 위/줄 0 카드 제목/핸들 위(고른 줄) · both 라벨·낡은 li 는 null
 *   U2 주소를 받는 줄 추가(lnAddLineAt) — 공용 grdAddLine(host) 에 «누른 줄 다음»으로 넘긴다
 *   U3 ★한 길 — T(lnAddLineToSelected)가 lnAddLineAt 을 부르고, 새 줄 spec·grdAddLine 부르는 자리가 늘지 않았다(두 벌 금지)
 *   U4 메뉴 배선 — index.html #bcm-ln-add · block-factory.js openMenu 표시 조건 · 클릭 → window.lnAddLineAt
 *   U5 주인 명부 LN_CTX_ADD_OWNERS = 카드만
 * ★실제 소스를 import 한다(cvb-card-add-slot.test.mjs 의 스텁 사본 꼴) — import 줄이 바뀌면 치환 «못 찾음»으로 빨개진다.
 * ★기대값은 손으로 박았다(피검 소스에서 뽑지 않는다).
 * [양성대조] 바닥 a42d76d5 판에서 U1~U5 전부 빨강 — gen/ 기록(GEN.md).
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readSrc, toPosix } from './_srcread.js';
import { sliceBlock, sliceCall } from './_slice-block.js';
import { stripComments } from './_strip-comments.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', '..');
const LH_SRC = readSrc(ROOT, 'js', 'blocks', 'line-host.js');
const BF_SRC = readSrc(ROOT, 'js', 'block-factory.js');
const HTML = readSrc(ROOT, 'index.html');

function stubCopy(src, replacements, tag) {
  for (const [from, to] of replacements) {
    const prev = src;
    src = src.replace(from, to);
    assert.notEqual(src, prev, `line-host.js 에서 다음을 못 찾음 — 리팩터링됐나?\n${from}`);
  }
  const out = path.join(os.tmpdir(), `${tag}-${process.pid}-${Math.random().toString(36).slice(2, 8)}.mjs`);
  fs.writeFileSync(out, src);
  return pathToFileURL(out).href;
}
const imp = (mod) => new RegExp(`^import \\{[^}]*\\} from '${mod.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}';.*$`, 'm');

/* ── 미니 DOM ── */
let STACK = [];          // document.elementsFromPoint 가 돌려줄 것
let SELECTED = [];       // document.querySelectorAll(…selected) 가 돌려줄 것
function makeBlock(cls, dataset = {}) {
  const b = {
    classList: { _s: new Set(cls), contains(c) { return this._s.has(c); } },
    dataset: { ...dataset }, id: 'blk_' + Math.random().toString(36).slice(2, 6),
    querySelector: () => null, querySelectorAll: () => [],
    contains(el) { for (let n = el; n; n = n._parent) if (n === b) return true; return false; },
  };
  return b;
}
/* 노드: cls(클래스 배열) · dataset · _parent. closest 는 이 시험이 쓰는 셀렉터 꼴만('.x' · '[data-card-idx]'). */
function node(parent, cls = [], dataset = {}) {
  return {
    _parent: parent, _cls: cls, dataset,
    closest(sel) {
      for (let n = this; n && n.closest; n = n._parent) {
        if (sel.startsWith('.') && n._cls && n._cls.includes(sel.slice(1))) return n;
        if (sel === '[data-card-idx]' && n.dataset && n.dataset.cardIdx !== undefined) return n;
      }
      return null;
    },
  };
}
const ev = (target) => ({ clientX: 10, clientY: 10, target });
const card = (cards, extra = {}) => makeBlock(['canvas-block'], { cardMode: 'simple', cards: JSON.stringify(cards), gridCols: '1', gridRows: '1', ...extra });
const LINES2 = [{ type: 'body', text: '하나' }, { type: 'body', text: '둘' }];

/* ── window 스파이 ── */
const calls = { add: [], spec: [], show: 0 };
let ADD_RES = { ok: true, li: 0 };

let LH, LHX, LNA_FOUND = false;   // LHX = lnAddLineAt 몸통을 무력화한 사본(U6)
const LH_STUBS = () => [
    [imp('./grid-block.js'),
      "const GRID_ROLES = { title: {}, body: {}, caption: {} }; const MAX_CELL_LINES = 12; const gridLineHtml = () => ''; const gridMergeLine = () => null; const gridValidateLines = () => null; const gridLineHasText = (l) => !!(l && l.text); const gridPlusLayer = () => null; const GRID_RICH_TEXT_OPTS = {};"],
    [imp('../util/sanitize-rich-text.js'), 'const sanitizeRichTextHtml = (s) => s; const richTextHasFormatting = () => false; const richTextBlocksToBreaks = (s) => s;'],
    [imp('../props/_text-selection.js'), 'const isBlurIntoPanel = () => false; const parkEditing = () => {}; const withTextSelection = (f) => f(); const getSavedTextSelection = () => null; const setSavedTextSelection = () => {};'],
    [imp('../props/prop-grid.js'),
      "const grdLineUi = {}; const grdSetActiveLine = (b, a) => { b._act = a; }; const grdGetActiveLine = (b) => (b && b._act) || null; const grdIsSoleSelected = (b) => !!(b && b.classList.contains('selected'));"],
    [imp('../props/_helpers.js'), "const escHtml = (s) => String(s ?? '');"],
    [imp('../props/color-picker.js'), 'const swatchHex = (c) => c;'],
    [imp('../props/prop-text-utils.js'), "const _fontDisplayName = (f) => f;"],
    [imp('../props/_panel-rendered.js'), 'const panelRenderedColor = () => null;'],
];
before(async () => {
  const url = stubCopy(LH_SRC, LH_STUBS(), 'cvb-ctx-line-add');
  const LNA_HEAD = 'export function lnAddLineAt(block, addr, type) {\n';
  LNA_FOUND = LH_SRC.includes(LNA_HEAD);
  const urlX = stubCopy(LH_SRC.replace(LNA_HEAD, LNA_HEAD + '  return false;   // U6 변이: 합친 몸통 무력화\n'), LH_STUBS(), 'cvb-ctx-line-add-x');
  globalThis.window = globalThis.window || globalThis;
  globalThis.document = {
    elementsFromPoint: () => STACK,
    querySelectorAll: () => SELECTED,
    getElementById: () => null,
  };
  window.grdNewLineSpec = (k) => { const s = { type: k, text: '', _tag: 'spec-' + k }; calls.spec.push(s); return s; };
  window.grdAddLine = (...a) => { calls.add.push(a); return ADD_RES; };
  window.showSimpleCardProperties = () => { calls.show++; };
  LH = await import(url);
  LHX = await import(urlX);
});
function reset() { calls.add = []; calls.spec = []; calls.show = 0; ADD_RES = { ok: true, li: 0 }; STACK = []; SELECTED = []; }

/* ══ U1 — 우클릭 점 → 주소 ══ */
test('U1 lnCtxAddAddr: 카드 줄 위 · 줄 0 카드 제목 · 핸들 위(고른 줄) → 주소 / 안 서는 자리 → null', () => {
  assert.equal(typeof LH.lnCtxAddAddr, 'function', 'lnCtxAddAddr 가 export 됐다');
  reset();
  // ⑴ 줄 모드 카드 · 둘째 줄(.ln-row data-ln-m=0 data-ln=1) 위
  const b1 = card([{ title: 't', lines: LINES2 }]);
  const row1 = node(b1, ['ln-row'], { lnM: '0', ln: '1' });
  STACK = [node(row1, ['ln-text']), b1];
  assert.deepEqual(LH.lnCtxAddAddr(b1, ev(row1)), { r: 0, c: 0, li: 1 }, '줄 위 우클릭 = 그 줄');
  // ⑵ 줄 0 카드(기본 카드) · 제목 위 → 카드 선택(li:null) = «끝에 추가»(D2 첫 전환은 commitLines 가 한다)
  const b2 = card([{ title: '카드 제목', desc: '' }]);
  const title = node(b2, ['cvb-card-title'], { cardIdx: '0' });
  STACK = [title, b2];
  assert.deepEqual(LH.lnCtxAddAddr(b2, ev(title)), { r: 0, c: 0, li: null }, '줄 0 카드 제목 = li:null');
  // ⑶ 핸들(.grd-line-grip — #ss-handles-overlay 소속, 블럭 밖) 위 · 블럭 하나만 골라짐 · 고른 줄 li 0
  const b3 = card([{ title: 't', lines: LINES2 }]);
  b3.classList._s.add('selected'); b3._act = { r: 0, c: 0, li: 0 };
  const grip = node(null, ['grd-line-grip']);
  STACK = [grip];
  assert.deepEqual(LH.lnCtxAddAddr(b3, ev(grip)), { r: 0, c: 0, li: 0 }, '핸들 위 = 고른 줄');
  b3.classList._s.delete('selected');
  assert.equal(LH.lnCtxAddAddr(b3, ev(grip)), null, '안 골라진 카드의 블럭 밖 = null');
  // ⑷ 레이어 모드 카드(cardMode 없음) → null
  const b4 = makeBlock(['canvas-block'], { cards: JSON.stringify([{ title: 't' }]) });
  const t4 = node(b4, ['cvb-card-title'], { cardIdx: '0' });
  STACK = [t4, b4];
  assert.equal(LH.lnCtxAddAddr(b4, ev(t4)), null, '레이어 모드 카드');
  // ⑸ 카드가 아닌 줄 주인(챗) → null (명부 = 카드만)
  const b5 = makeBlock(['chat-block'], { messages: '[]' });
  const r5 = node(b5, ['ln-row'], { lnM: '0', ln: '0' });
  STACK = [r5, b5];
  assert.equal(LH.lnCtxAddAddr(b5, ev(r5)), null, '챗');
  // ⑹ both 라벨(세로) 카드 → null (rowOk 거짓 — resolveAny)
  const b6 = card([{ title: 't', desc: 'd' }], { labelPos: 'both' });
  const t6 = node(b6, ['cvb-card-title'], { cardIdx: '0' });
  STACK = [t6, b6];
  assert.equal(LH.lnCtxAddAddr(b6, ev(t6)), null, 'both 라벨 세로 카드');
  // ⑺ 낡은 li(없는 줄) → null
  const b7 = card([{ title: 't', lines: LINES2 }]);
  const r7 = node(b7, ['ln-row'], { lnM: '0', ln: '5' });
  STACK = [r7, b7];
  assert.equal(LH.lnCtxAddAddr(b7, ev(r7)), null, '낡은 li');
});

/* ══ U2 — 주소를 받는 줄 추가 ══ */
test('U2 lnAddLineAt: grdAddLine(block, {r,c:0}, 누른 줄, grdNewLineSpec 산출, {}, 카드 host) · 성공 시 패널 1회', () => {
  assert.equal(typeof LH.lnAddLineAt, 'function', 'lnAddLineAt 가 export 됐다');
  reset();
  const b = card([{ title: 't', lines: LINES2 }]);
  assert.equal(LH.lnAddLineAt(b, { r: 0, c: 0, li: 1 }, 'body'), true);
  assert.equal(calls.add.length, 1);
  const [blk, pos, after, spec, opts, host] = calls.add[0];
  assert.equal(blk, b);
  assert.deepEqual(pos, { r: 0, c: 0 });
  assert.equal(after, 1, '누른 줄 «다음»');
  assert.equal(spec, calls.spec[0], 'spec = grdNewLineSpec 이 돌려준 그 객체(손으로 안 짓는다)');
  assert.equal(spec._tag, 'spec-body');
  assert.deepEqual(opts, {});
  assert.equal(host.kind, 'card');
  assert.equal(calls.show, 1, '성공 → showSimpleCardProperties 1회');
  // li:null → 끝(afterLi null)
  reset();
  LH.lnAddLineAt(b, { r: 0, c: 0, li: null }, 'body');
  assert.equal(calls.add[0][2], null, 'li:null → afterLi null');
  // gap
  reset();
  LH.lnAddLineAt(b, { r: 0, c: 0, li: 0 }, 'gap');
  assert.equal(calls.spec[0]._tag, 'spec-gap');
  assert.equal(calls.add[0][2], 0);
  // 실패 → false · 패널 안 부름
  reset(); ADD_RES = { ok: false, code: 'LIMIT' };
  assert.equal(LH.lnAddLineAt(b, { r: 0, c: 0, li: 0 }, 'body'), false);
  assert.equal(calls.show, 0);
  // 주인 아님 → false · grdAddLine 안 부름
  reset();
  assert.equal(LH.lnAddLineAt(makeBlock(['text-block']), { r: 0, c: 0, li: 0 }, 'body'), false);
  assert.equal(calls.add.length, 0);
});

/* ══ U3 — 한 길 (T 와 우클릭) ══ */
test('U3 ★한 길: T(lnAddLineToSelected) 몸통 = lnAddLineAt · 새 줄 spec·grdAddLine 부르는 자리 수 그대로', () => {
  const body = sliceBlock(LH_SRC, 'export function lnAddLineToSelected(');
  assert.match(body, /return lnAddLineAt\(block, addr, type\);/, 'T 가 lnAddLineAt 을 부른다');
  assert.doesNotMatch(body, /grdAddLine|grdNewLineSpec/, 'T 몸통에 둘째 길 없음');
  const count = (re) => (LH_SRC.match(re) || []).length;
  // 바닥 a42d76d5 실측(손으로): grdNewLineSpec?.( 2곳(_lnPlusAdd · lnAddLineToSelected) · grdAddLine?.( 3곳(_lnPlusAdd · lnAddLineToSelected · lnAddIconToSelected)
  assert.equal(count(/window\.grdNewLineSpec\?\.\(/g), 2, 'grdNewLineSpec 부르는 자리 2(옮겼지 늘리지 않았다)');
  assert.equal(count(/window\.grdAddLine\?\.\(/g), 3, 'grdAddLine 부르는 자리 3');
  // 행위: 골라진 카드에서 T 와 lnAddLineAt 이 grdAddLine 에 «같은 인자»
  assert.equal(typeof LH.lnAddLineAt, 'function');
  reset();
  const b = card([{ title: 't', lines: LINES2 }]);
  b.classList._s.add('selected'); b._act = { r: 0, c: 0, li: 1 };
  SELECTED = [b];
  assert.equal(LH.lnAddLineToSelected('body'), true);
  const viaT = calls.add[0].slice(0, 5);
  reset();
  LH.lnAddLineAt(b, { r: 0, c: 0, li: 1 }, 'body');
  const viaCtx = calls.add[0].slice(0, 5);
  assert.deepEqual(viaT, viaCtx, 'T 와 우클릭이 같은 인자로 grdAddLine');
});

/* ══ U4 — 메뉴 배선 ══ */
const BCM_LN_CLICK_HEAD = "document.getElementById('bcm-ln-add')?.addEventListener('click'";
test('U4 메뉴 배선: index #bcm-ln-add · openMenu 표시 조건 · 클릭 → window.lnAddLineAt', () => {
  const ms = HTML.indexOf('<div id="block-context-menu"');
  assert.ok(ms >= 0, '#block-context-menu');
  const menu = HTML.slice(ms, ms + HTML.slice(ms).search(/\n<\/div>\s*\n/));
  assert.equal((menu.match(/id="bcm-ln-add"/g) || []).length, 1, '메뉴 안 #bcm-ln-add 1개');
  assert.equal((HTML.match(/id="bcm-ln-add"/g) || []).length, 1, '문서 전체 1개');
  const item = menu.slice(menu.indexOf('id="bcm-ln-add"'), menu.indexOf('</div>', menu.indexOf('id="bcm-ln-add"')));
  assert.match(item, /아래에 줄 추가 \(T\)/, '라벨');
  assert.match(item, /style="display:none;"/, '처음엔 숨김');
  const om = stripComments(sliceBlock(BF_SRC, 'function openMenu('));
  assert.match(om, /_targetLnAddr = window\.lnCtxAddAddr\?\.\(block, e\) \|\| null;/, '판정 = lnCtxAddAddr');
  assert.match(om, /getElementById\('bcm-ln-add'\)/);
  assert.match(om, /\.style\.display = _targetLnAddr \? 'flex' : 'none'/, '주소가 있을 때만 보인다');
  assert.ok(BF_SRC.includes(BCM_LN_CLICK_HEAD), '클릭 리스너');
  const click = stripComments(sliceCall(BF_SRC, BCM_LN_CLICK_HEAD));
  assert.match(click, /window\.lnAddLineAt\?\.\(block, addr, 'body'\);/, '클릭 → lnAddLineAt(한 길)');
  assert.doesNotMatch(click, /grdAddLine|grdNewLineSpec/, '메뉴가 줄을 직접 짓지 않는다');
  assert.match(stripComments(LH_SRC), /lnAddLineAt, lnCtxAddAddr,/, 'window 에 둘 다 건다');
});

/* ══ U5 — 주인 명부 ══ */
test('U5 LN_CTX_ADD_OWNERS = 카드만', () => {
  const m = /^const LN_CTX_ADD_OWNERS = (\[[^\]]*\]);/m.exec(LH_SRC);
  assert.ok(m, 'LN_CTX_ADD_OWNERS 정의');
  assert.deepEqual(JSON.parse(m[1].replace(/'/g, '"')), ['canvas-block']);
});

/* ══ U6 — «합친 것을 재는 자» (지디 ⑷) ══
 * lnAddLineAt 를 뽑아 소비자들이 한 몸통을 같이 쓴다. ⇒ 몸통을 무력화하면 ★소비자 «전부»가 빨개져야 한다.
 * ★소비자 수는 손으로 박지 않는다 — js/** 의 `lnAddLineAt(`·`lnAddLineAt?.(` 호출 자리(주석 제외 · 정의 줄 제외)에서 센다.
 * 각 호출 자리에는 «그 소비자를 실제로 돌리는» 탐침이 하나씩 있어야 한다(없으면 빨강 — 새 소비자가 탐침 없이 늘지 않게). */
function jsFiles(dir) {
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...jsFiles(p)); else if (/\.(m?js)$/.test(ent.name)) out.push(p);
  }
  return out;
}
function lnAddLineAtCallSites() {
  const sites = [];
  for (const f of jsFiles(path.join(ROOT, 'js'))) {
    const src = stripComments(readSrc(f));
    src.split('\n').forEach((ln) => {
      if (!/lnAddLineAt(?:\?\.)?\(/.test(ln) || /function lnAddLineAt\(/.test(ln)) return;   // `lnAddLineAt(` · `window.lnAddLineAt?.(` 둘 다
      sites.push(toPosix(path.relative(ROOT, f)));
    });
  }
  return sites;
}
/* 탐침: mod = line-host 모듈(진짜 또는 무력화 사본) · 반환 = «줄이 더해졌나»(grdAddLine 이 card host 로 불렸나) */
const PROBES = {
  /* T 단축키 = lnAddLineToSelected → (모듈 안) lnAddLineAt */
  'js/blocks/line-host.js': (mod) => {
    reset();
    const b = card([{ title: 't', lines: LINES2 }]);
    b.classList._s.add('selected'); b._act = { r: 0, c: 0, li: 0 };
    SELECTED = [b];
    mod.lnAddLineToSelected('body');
    return calls.add.length === 1 && calls.add[0][5]?.kind === 'card';
  },
  /* 우클릭 메뉴 = block-factory.js 의 #bcm-ln-add 클릭 리스너 «그 소스»를 그대로 돌린다(window.lnAddLineAt = mod 의 것) */
  'js/block-factory.js': (mod) => {
    reset();
    if (!BF_SRC.includes(BCM_LN_CLICK_HEAD)) return false;
    const call = sliceCall(BF_SRC, BCM_LN_CLICK_HEAD);                       // 머리 … `, e => { … })`
    const arrow = call.slice(BCM_LN_CLICK_HEAD.length).replace(/^\s*,\s*/, '').replace(/\)\s*$/, '');
    const make = new Function('window', '_targetBlock', '_targetLnAddr', 'closeMenu', `return (${arrow});`);
    const b = card([{ title: 't', lines: LINES2 }]);
    const fakeWin = { lnAddLineAt: mod.lnAddLineAt };
    let closed = 0;
    make(fakeWin, b, { r: 0, c: 0, li: 1 }, () => { closed++; })({ stopPropagation() {} });
    return closed === 1 && calls.add.length === 1 && calls.add[0][2] === 1 && calls.add[0][5]?.kind === 'card';
  },
};
test('U6 ★합친 몸통(lnAddLineAt) 무력화 → 소비자 «호출 자리 수»만큼 빨강 · 진짜 판은 전부 초록', () => {
  const sites = lnAddLineAtCallSites();
  assert.ok(sites.length >= 1, `[전제] lnAddLineAt 호출 자리를 셌다(${sites.length})`);
  const missing = [...new Set(sites)].filter(f => !PROBES[f]);
  assert.deepEqual(missing, [], '탐침 없는 소비자(새 호출 자리면 PROBES 에 탐침을 더하라)');
  assert.equal(sites.length, new Set(sites).size, '[전제] 한 파일에 호출 자리 하나(탐침이 자리 하나를 잰다)');
  assert.ok(LNA_FOUND, '[전제] 무력화 사본을 만들었다(lnAddLineAt 정의 줄을 찾았다)');
  const green = sites.filter(f => PROBES[f](LH)).length;
  const red = sites.filter(f => !PROBES[f](LHX)).length;
  assert.equal(green, sites.length, `진짜 판: 소비자 ${sites.length} 전부 줄을 더한다`);
  assert.equal(red, sites.length, `무력화 판: 소비자 ${sites.length} 전부 빨강(빨강 ${red})`);
  console.log(`# U6 소비자(호출 자리) ${sites.length} = ${sites.join(' · ')} · 진짜 초록 ${green} · 무력화 빨강 ${red}`);
});
