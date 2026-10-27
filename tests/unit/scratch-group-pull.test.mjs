/* 단위 하네스 — ★1018t1a3 「스크래치패드 ★그룹 링크: 당기면 ★그룹 전체가 움직인다」
 *   현빈 원문(2026-10-20): 「링크설정 된 스크래치패드 하나랑 ★링크 연결이 ★안 된 스크래치패드들을
 *     ★그룹 설정을 한 경우 … ★링크를 더블클릭 하면은 ★그룹 전체가 움직이는 게 아니고 ★그룹 안에서
 *     ★링크 연결된 스크래치패드만 이동이 되는데 ★★그룹 전체가 움직였으면 좋겠어」
 *
 * ★★고치기 «전» 실측(이 하네스로, 같은 판에서): 그룹 4장 중 1장만 링크 ⇒ `_unitOf('s1').ids` = ★['s1'] (1장)
 *   까닭 = `_units()` 가 ★`allLinks()` 를 돌며 짓는다 ⇒ ★토큰 없는 멤버는 ids 에 ★들어올 수 없다.
 *
 * ★무엇을 잠그나 — 셋이다(⛔하나로 뭉치지 마라. 깨지는 까닭이 다르다)
 *   ㉠ «움직이는 집합» — `_unitMoveIds` 의 ★동작. ★실물 소스에서 함수를 ★떠서 ★그대로 돌린다
 *      (tests/unit/scratch-animate-move.test.mjs 선례 · ⛔손으로 쓴 모델 금지).
 *   ㉡ «moves 배열» — `pullLink` 를 ★떠서 돌려 ⑴누가 가나 ⑵상대 배치가 보존되나 ⑶linkDy 가
 *      ★링크 쥔 장에만 실리나 를 잰다.
 *   ㉢ «배선·무회귀» — 소스 문자열로: 갈래가 moveIds 로 가나 · ★선(_edgeEnds)은 안 바뀌나 · 토큰은 안 늘었나.
 *
 * ⛔대역(stub)은 ★잎 셋뿐이다 — `_edgeEnds` · `_pullDest` · `_scaler`. ★그 셋의 동작은 ★이 파일이
 *   재는 것이 ★아니다(각자 제 검사가 있다: scratch-link-edges · scratch-pull-near-section DOM 스펙).
 *   ★나머지(_units·_unitOf·_unitBox·_unitMoveIds·_groupMembers·_groupOf·_scEl·_item·allLinks·_parse)는 ★실물이다.
 * ⛔이 파일의 초록을 «증거»로 쓰지 마라 — 변이 목록이 보고에 같이 있어야 한다.
 * ⛔★닻에 ★매개변수 목록을 적지 마라(`'function f('` 까지만) — 누가 인자 하나만 더해도 이 파일이
 *   ★조용히 눈이 먼다. ★집행 = tests/unit/anchor-signature-ratchet.test.mjs R1/R4.
 *   ★실측: 처음에 서명을 그대로 적었더니 ★그 래칫이 ★빨개졌다(54 vs 기준 51 · 변수닻 38 vs 37).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require_ = createRequire(import.meta.url);
const { sliceBlock } = require_('./_slice-block.js');
const { stripComments } = require_('./_strip-comments.js');
const { readSrc } = require_('./_srcread.js');
const ROOT = path.join(__dirname, '..', '..');
const SRC = readSrc(ROOT, 'js', 'scratchpad-link.js');

/* 실물에서 떠낸다 — 앵커를 못 찾으면 sliceBlock 이 ★던진다(⛔건너뛰지 않는다).
   ⛔`const cut = (h) => sliceBlock(SRC, h)` 꼴로 ★닻을 ★변수에 담지 마라 — anchor-signature-ratchet
     R4 의 ★«변수 닻» 칸(기준 37)이 ★그 꼴을 센다. 그 칸은 ★그 자가 ★못 가르는 ★사각이라,
     기준을 올리는 것은 ★사각을 ★키우는 것이다. ⇒ ★닻을 ★그 자리에 ★글자로 적는다.
     ★실측: 처음에 helper 로 적었더니 ★var 38(기준 37)로 ★R4 가 ★빨개졌다. */
const REAL = [
  sliceBlock(SRC, 'function _parse('),
  sliceBlock(SRC, 'function _allSecs('),
  sliceBlock(SRC, 'function allLinks('),
  sliceBlock(SRC, 'function _scEl('),
  sliceBlock(SRC, 'function _item('),   // ★132 ⓧ(261027) — _scEl 이 먼저 색인(_item → window._scratchItemById)을 본다 · 이 하네스 window 엔 색인이 없어 옛 길 그대로
  sliceBlock(SRC, 'function _groupOf('),
  sliceBlock(SRC, 'function _units('),
  sliceBlock(SRC, 'function _unitOf('),
  sliceBlock(SRC, 'function _unitBox('),
  sliceBlock(SRC, 'function _unitMoveIds('),
  sliceBlock(SRC, 'function _groupMembers('),
  sliceBlock(SRC, 'function pullLink('),
];

/* ── 최소 대역 DOM — 이 하네스가 ★쓰는 선택자 ★네 꼴만 안다(⛔전체 DOM 흉내 금지) ───────── */
function makeDom({ secs, items }) {
  const secEls = secs.map(s => ({
    id: s.id, dataset: { refLinks: s.refLinks },
    classList: { contains: (c) => c === 'section-block' },
    getBoundingClientRect: () => ({ left: s.left ?? 0, top: s.top ?? 0, right: (s.left ?? 0) + (s.w ?? 800), bottom: (s.top ?? 0) + (s.h ?? 200), width: s.w ?? 800, height: s.h ?? 200 }),
  }));
  const itemEls = items.map(i => ({
    dataset: { scratchId: i.id, scratchGroup: i.g },
    style: { left: (i.x ?? 0) + 'px', top: (i.y ?? 0) + 'px' },
    offsetWidth: i.w ?? 100, offsetHeight: i.h ?? 80,
    getBoundingClientRect: () => ({
      left: i.x ?? 0, top: i.y ?? 0, right: (i.x ?? 0) + (i.w ?? 100), bottom: (i.y ?? 0) + (i.h ?? 80),
      width: i.hidden ? 0 : (i.w ?? 100), height: i.hidden ? 0 : (i.h ?? 80),
    }),
  }));
  const scaler = { getBoundingClientRect: () => ({ left: 0, top: 0 }) };
  return {
    getElementById: (id) => secEls.find(e => e.id === id) || (id === 'canvas-scaler' ? scaler : null),
    querySelectorAll: (sel) => {
      if (sel === '.section-block') return secEls;
      const m = sel.match(/^\.scratch-item\[data-scratch-group="(.*)"\]$/);
      if (m) return itemEls.filter(e => e.dataset.scratchGroup === m[1]);
      if (sel === '.scratch-item') return itemEls;
      throw new Error('하네스가 모르는 선택자: ' + sel);
    },
    querySelector: (sel) => {
      const m = sel.match(/^\.scratch-item\[data-scratch-id="(.*)"\]$/);
      if (m) return itemEls.find(e => e.dataset.scratchId === m[1]) || null;
      throw new Error('하네스가 모르는 선택자: ' + sel);
    },
    __scaler: scaler,
  };
}

/** 실물 함수들을 싣는다. 잎 셋(_edgeEnds·_pullDest·_scaler)만 대역. */
function load(dom, { dest = { x: 900, y: 100 }, attachRight = true } = {}) {
  const captured = [];
  const win = {
    currentZoom: 100,
    CSS: { escape: (s) => s },
    _scratchAnimateItemTo: (id, x, y, opts) => { captured.push({ kind: 'one', id, x, y, opts }); return { ok: true, moved: true }; },
    _scratchAnimateItemsTo: (moves, opts) => { captured.push({ kind: 'many', moves, opts }); return { ok: true, moved: true }; },
  };
  /* ★소스가 `window.CSS && CSS.escape` 로 ★맨 전역 `CSS` 를 읽는다 — 브라우저에선 전역이다.
     ⇒ 하네스도 ★전역으로 넘긴다(⛔소스를 고쳐 맞추지 않는다). */
  const CSS = win.CSS;
  const body = `
    const ATTR = 'refLinks';
    const PULL_GAP = 24;
    function _scaler() { return __scaler; }                    // ★대역(잎)
    function _edgeEnds(sec, item) { return { attachRight: __attachRight }; }   // ★대역(잎)
    function _pullDest(sec, item, attachRight, size, exclude) { __pullDestCalls.push({ size, exclude }); return __dest; }  // ★대역(잎)
    ${REAL.join('\n')}
    return { _units, _unitOf, _unitBox, _unitMoveIds, _groupMembers, _groupOf, allLinks, pullLink };
  `;
  const pullDestCalls = [];
  const api = new Function('document', 'window', 'CSS', '__scaler', '__dest', '__attachRight', '__pullDestCalls', body)(
    dom, win, CSS, dom.__scaler, dest, attachRight, pullDestCalls);
  return { ...api, captured, pullDestCalls };
}

/* 판 ①: 그룹 g_A 4장(s1~s4) · ★링크는 s1 하나 — ★현빈이 말한 그 판 */
const PLATE_PARTIAL = {
  secs: [{ id: 'sec_1', refLinks: 's1:0', left: 0, top: 50, w: 800, h: 200 }],
  items: [{ id: 's1', g: 'g_A', x: 100, y: 60 }, { id: 's2', g: 'g_A', x: 220, y: 60 },
          { id: 's3', g: 'g_A', x: 100, y: 150 }, { id: 's4', g: 'g_A', x: 220, y: 150 }],
};
/* 판 ②: 같은 그룹인데 ★4장 전부 링크 — #16-G(2026-10-09)가 ★이미 맞게 도는 판 */
const PLATE_ALL = {
  secs: [{ id: 'sec_1', refLinks: 's1:0,s2:0,s3:0,s4:0', left: 0, top: 50, w: 800, h: 200 }],
  items: PLATE_PARTIAL.items,
};
/* 판 ③: 그룹 ★없는 한 장 */
const PLATE_SOLO = {
  secs: [{ id: 'sec_1', refLinks: 's9:0', left: 0, top: 50 }],
  items: [{ id: 's9', g: undefined, x: 100, y: 60 }],
};

/* ══ ㉠ 움직이는 집합 ═══════════════════════════════════════════════════════ */

test('㉠0 ★전제 — 하네스가 ★실물 함수를 싣고 있다(0건이 «못 읽어서»가 아니다)', () => {
  const api = load(makeDom(PLATE_PARTIAL));
  for (const k of ['_units', '_unitOf', '_unitBox', '_unitMoveIds', '_groupMembers', 'pullLink']) {
    assert.equal(typeof api[k], 'function', `${k} 를 못 떠 왔다 — 앵커가 낡았다`);
  }
  // ★그룹을 DOM 이 안다는 것도 전제다 — 이게 거짓이면 아래 수가 전부 뜻이 없다
  assert.deepEqual(api._groupMembers('g_A'), ['s1', 's2', 's3', 's4']);
});

test('㉠1 ★★결함 그 자리 — 그룹 4장 중 1장만 링크여도 ★움직이는 것은 ★4장', () => {
  const api = load(makeDom(PLATE_PARTIAL));
  const unit = api._unitOf('s1');
  // ★토큰은 ★그대로 1개다(링크 수·선 개수는 안 건드렸다 — 이 파일 :396 의 그 세 까닭)
  assert.deepEqual(unit.ids, ['s1'], '토큰(unit.ids)이 늘었다 — 링크를 늘리면 안 된다');
  assert.equal(unit.group, 'g_A');
  // ★움직이는 집합은 ★그룹째
  assert.deepEqual(api._unitMoveIds(unit).sort(), ['s1', 's2', 's3', 's4'],
    '★그룹 전원이 안 온다 — 고치기 전 실측값은 [\'s1\'] 하나였다');
  /* ★구조 불변식 — 토큰 쥔 장은 ★늘 움직이는 집합 안에 있다(묶음 키가 `sectionId|g:<그룹>` 이므로).
     ⛔「빠진 것을 더하는」 줄로 지키지 않는다 — 그 줄은 도달 불가였다(제품 쪽 주석에 까닭을 적었다). */
  for (const id of unit.ids) assert.ok(api._unitMoveIds(unit).includes(id), `토큰 ${id} 가 움직이는 집합에서 빠졌다`);
});

test('㉠2 [음성대조 ⑴] ★그룹이 없으면 ★오늘 그대로(자기 혼자)', () => {
  const api = load(makeDom(PLATE_SOLO));
  const unit = api._unitOf('s9');
  assert.equal(unit.group, null, '그룹 없는 장에 그룹이 생겼다');
  assert.deepEqual(api._unitMoveIds(unit), ['s9'], '단독 장이 혼자가 아니게 됐다');
});

test('㉠3 ★전원 링크된 그룹은 ★한 글자도 안 바뀐다(#16-G 무회귀)', () => {
  const api = load(makeDom(PLATE_ALL));
  const unit = api._unitOf('s1');
  assert.equal(unit.ids.length, 4, '전제: 전원 링크면 토큰도 4개');
  assert.deepEqual(api._unitMoveIds(unit).sort(), unit.ids.slice().sort(),
    '★전원 링크 그룹에서 움직이는 집합이 토큰 집합과 달라졌다 — 그 판은 오늘과 같아야 한다');
});

test('㉠4 [음성대조 ⑵] ★링크가 ★하나도 없는 그룹은 ★묶음이 ★없다 ⇒ 당겨지지 않는다', () => {
  const api = load(makeDom({
    secs: [{ id: 'sec_1', refLinks: '' }],
    items: [{ id: 's1', g: 'g_A' }, { id: 's2', g: 'g_A' }],
  }));
  assert.equal(api._unitOf('s1'), null, '링크 0인데 묶음이 생겼다');
  assert.deepEqual(api._units(), [], '링크 0인데 묶음 목록이 비지 않았다');
  assert.deepEqual(api.pullLink('s1'), { ok: false, reason: 'NO_LINK' }, '링크가 없는데 당겨졌다');
  assert.deepEqual(api._unitMoveIds(null), [], 'null 묶음에서 뭔가 나왔다');
});

test('㉠5 [음성대조 ⑶] ★그룹 ★밖 요소는 ★안 따라온다', () => {
  const api = load(makeDom({
    secs: [{ id: 'sec_1', refLinks: 's1:0', left: 0, top: 50 }],
    items: [{ id: 's1', g: 'g_A' }, { id: 's2', g: 'g_A' },
            { id: 'sB1', g: 'g_B' },            // ★다른 그룹
            { id: 'solo', g: undefined }],      // ★그룹 없는 장
  }));
  const ids = api._unitMoveIds(api._unitOf('s1'));
  assert.deepEqual(ids.sort(), ['s1', 's2'], '★다른 그룹·무그룹 장이 끌려왔다');
  assert.equal(ids.includes('sB1'), false);
  assert.equal(ids.includes('solo'), false);
});

test('㉠6 ★DOM 에서 그룹을 못 찾으면 ★오늘 그대로 간다(⛔「없다」를 「전부」로 지어내지 않는다)', () => {
  /* 토큰엔 그룹이 적혀 있는데 DOM 에 그 그룹 멤버가 0건인 판 — 요소가 지워지는 중일 수 있다. */
  /* ★판에 ★그룹 밖 장을 ★같이 둔다 — 안 두면 「전부」와 「오늘 그대로」가 ★같은 값이 되어
     「0건을 전부로 지어내는」 변이가 ★안 잡힌다(실측: M3 가 그래서 초록이었다). */
  const dom = makeDom({ secs: [{ id: 'sec_1', refLinks: 's1:0' }],
                        items: [{ id: 's1', g: 'g_A' }, { id: 'zz', g: undefined }] });
  const api = load(dom);
  const unit = api._unitOf('s1');
  // 그룹 조회만 0건으로 만든다(그 외는 그대로)
  const real = dom.querySelectorAll;
  dom.querySelectorAll = (sel) => (/data-scratch-group/.test(sel) ? [] : real(sel));
  assert.deepEqual(api._unitMoveIds(unit), ['s1'], '그룹 0건인데 집합이 달라졌다');
  dom.querySelectorAll = real;
});

test('㉠7 ★토큰은 있는데 ★그룹 속성이 ★없는 장도 빠뜨리지 않는다(DOM·토큰 어긋남)', () => {
  const api = load(makeDom({
    secs: [{ id: 'sec_1', refLinks: 's1:0,sX:0' }],
    items: [{ id: 's1', g: 'g_A' }, { id: 's2', g: 'g_A' }, { id: 'sX', g: undefined }],
  }));
  /* s1 과 sX 는 ★다른 묶음이다(키가 'g:g_A' / '#sX') — s1 묶음에 sX 가 섞이면 안 된다. */
  const u1 = api._unitOf('s1');
  assert.deepEqual(api._unitMoveIds(u1).sort(), ['s1', 's2']);
  const uX = api._unitOf('sX');
  assert.deepEqual(api._unitMoveIds(uX), ['sX'], '그룹 없는 토큰이 남의 그룹에 끌려갔다');
});

/* ══ ㉡ moves 배열 — pullLink 를 실제로 돌린다 ════════════════════════════ */

test('㉡1 ★당기면 ★그룹 4장이 ★한 걸음으로 간다(여러장 입구 ★1회 호출 · 이력 1회)', () => {
  const api = load(makeDom(PLATE_PARTIAL), { dest: { x: 900, y: 100 } });
  const r = api.pullLink('s1');
  assert.equal(r.ok, true);
  assert.equal(api.captured.length, 1, `입구가 ${api.captured.length}번 불렸다 — 한 걸음이어야 ⌘Z 가 한 번이다`);
  assert.equal(api.captured[0].kind, 'many', '여러 장인데 단독 입구로 갔다');
  assert.deepEqual(api.captured[0].moves.map(m => m.id).sort(), ['s1', 's2', 's3', 's4']);
});

test('㉡2 ★상대 배치가 ★보존된다 — 넷이 ★같은 델타로 움직인다', () => {
  const api = load(makeDom(PLATE_PARTIAL), { dest: { x: 900, y: 100 } });
  api.pullLink('s1');
  const by = new Map(api.captured[0].moves.map(m => [m.id, m]));
  const src = new Map(PLATE_PARTIAL.items.map(i => [i.id, i]));
  const d0 = { dx: by.get('s1').x - src.get('s1').x, dy: by.get('s1').y - src.get('s1').y };
  for (const id of ['s2', 's3', 's4']) {
    assert.equal(by.get(id).x - src.get(id).x, d0.dx, `${id} 의 가로 델타가 다르다 — 상대 배치가 깨졌다`);
    assert.equal(by.get(id).y - src.get(id).y, d0.dy, `${id} 의 세로 델타가 다르다 — 상대 배치가 깨졌다`);
  }
  // 겉상자 좌상단(s1·s3 중 최소 = 100,60)이 목표로 간다
  assert.equal(by.get('s1').x, 900, '겉상자 좌상단이 목표 x 로 안 갔다');
});

test('㉡3 ★★`linkDy` 는 ★링크 쥔 장에만 실린다 — ⛔안 링크된 멤버엔 ★안 심는다', () => {
  /* 까닭(js/scratch-pad.js `_applyFollow`): 묵은 linkDy 를 쥔 장이 ★나중에 링크되면
     「현재 자리에서 유도(무이동)」 길을 건너뛰고 y 가 ★한 번 튄다. 저장본에도 남는다. */
  const api = load(makeDom(PLATE_PARTIAL));
  api.pullLink('s1');
  const moves = api.captured[0].moves;
  const withDy = moves.filter(m => Number.isFinite(m.linkDy)).map(m => m.id);
  assert.deepEqual(withDy, ['s1'], `linkDy 가 ${withDy.join(',') || '0건'} 에 실렸다 — 링크 쥔 장(s1)만이어야 한다`);
});

test('㉡4 ★목적지 상자는 ★«옮기는 전원»의 크기다(⛔선 그리는 상자 아님)', () => {
  const api = load(makeDom(PLATE_PARTIAL));
  api.pullLink('s1');
  assert.equal(api.pullDestCalls.length, 1, '_pullDest 호출이 한 번이 아니다');
  const { size, exclude } = api.pullDestCalls[0];
  // 전원 겉상자 = x 100~320 · y 60~230 ⇒ 220 × 170
  assert.deepEqual({ w: size.w, h: size.h }, { w: 220, h: 170 },
    '목적지 상자가 «토큰 쥔 한 장»(100×80)이다 — 그러면 안 링크된 장들이 섹션에서 멀리 앉는다');
  assert.equal(exclude.size, 4, '막는 것에서 뺀 집합이 전원이 아니다 — 자기와 겹치느라 밀려난다');
});

test('㉡5 ★단독(그룹 없음)은 ★단독 입구로 — 길이 한 글자도 안 바뀐다', () => {
  const api = load(makeDom(PLATE_SOLO), { dest: { x: 900, y: 100 } });
  const r = api.pullLink('s9');
  assert.equal(r.ok, true);
  assert.equal(api.captured.length, 1);
  assert.equal(api.captured[0].kind, 'one', '단독인데 여러장 입구로 갔다 — DOM 스펙 하네스가 그 함수 하나를 가로챈다');
  assert.equal(api.captured[0].id, 's9');
  assert.equal(Number.isFinite(api.captured[0].opts.linkDy), true, '단독 길의 linkDy 가 사라졌다');
});

test('㉡6 ★0×0(숨김·접힘) 멤버는 ★안 옮긴다 — 기준이 없는 것을 지어내지 않는다', () => {
  const api = load(makeDom({
    secs: [{ id: 'sec_1', refLinks: 's1:0', left: 0, top: 50 }],
    items: [{ id: 's1', g: 'g_A', x: 100, y: 60 }, { id: 's2', g: 'g_A', x: 220, y: 60 },
            { id: 's3', g: 'g_A', x: 100, y: 150, hidden: true }],
  }));
  api.pullLink('s1');
  const ids = api.captured[0].moves.map(m => m.id).sort();
  assert.deepEqual(ids, ['s1', 's2'], '0×0 멤버를 옮겼다');
});

/* ══ ㉢ 배선·무회귀 — 소스 문자열 ═══════════════════════════════════════════ */
const PULL = () => stripComments(sliceBlock(SRC, 'function pullLink('));

test('㉢1 ★갈래를 ★moveIds 로 고른다 — ⛔`unit.ids.length` 로 고르면 이 결함이 되살아난다', () => {
  const fn = PULL();
  assert.match(fn, /const moveIds = _unitMoveIds\(unit\)/, 'pullLink 가 움직이는 집합을 안 구한다');
  assert.match(fn, /if \(moveIds\.length === 1\)/, '단독 갈래가 moveIds 로 안 간다');
  assert.equal(/unit\.ids\.length/.test(fn), false,
    'pullLink 가 아직 `unit.ids.length` 로 갈래를 고른다 — 「그룹 4장 중 1장 링크」가 단독 길로 떨어진다');
});

test('㉢2 ★«그리는 선»은 안 바뀐다 — _edgeEnds 는 여전히 ★토큰 상자(box)로 잰다', () => {
  const fn = PULL();
  assert.match(fn, /const box = _unitBox\(unit\)/, '선 상자를 unit 으로 안 잰다');
  assert.match(fn, /_edgeEnds\(sec, box\)/,
    '_edgeEnds 에 다른 상자를 넘긴다 — 「보이는 선과 눌리는 선이 갈리지 않는다」(이 파일 규약)를 깼다');
  assert.match(fn, /const moveBox = _unitBox\(\{ ids: moveIds \}\)/, '목적지 상자를 옮기는 전원으로 안 잰다');
});

test('㉢3 ★linkDy 는 ★토큰 집합(unit.ids)으로만 — 배선으로 못박는다', () => {
  const fn = PULL();
  assert.match(fn, /const anchored = new Set\(unit\.ids\)/, 'linkDy 를 실을 집합이 토큰에서 안 온다');
  assert.match(fn, /if \(anchored\.has\(id\)\) m\.linkDy =/, 'linkDy 를 조건 없이 전원에 심는다');
});

test('㉢4 ★그룹을 ★읽는 자리는 ★한 벌 — `_groupMembers` 사본 0', () => {
  const code = stripComments(SRC);
  const defs = [...code.matchAll(/function _groupMembers\s*\(/g)].length;
  assert.equal(defs, 1, `_groupMembers 정의가 ${defs}곳이다 — 그룹 명부가 둘이면 한쪽이 조용히 늙는다`);
  assert.match(stripComments(sliceBlock(SRC, 'function _unitMoveIds(')), /_groupMembers\(unit\.group\)/,
    '_unitMoveIds 가 그룹을 제 손으로 다시 질의한다 — 공용 한 벌을 써라');
});

test('㉢5 ★토큰(refLinks)은 ★안 늘렸다 — 링크 쓰기 자리가 그대로', () => {
  /* 현빈 요구는 «움직임»이다. 토큰을 늘리면 선 개수·언링크 뜻이 같이 바뀐다(이 파일 :396). */
  const mv = stripComments(sliceBlock(SRC, 'function _unitMoveIds('));
  assert.equal(/_write\(|addLink|removeLink/.test(mv), false,
    '_unitMoveIds 가 링크 토큰을 건드린다 — 그 함수는 «누가 함께 가나»만 답해야 한다');
  const fn = PULL();
  assert.equal(/_write\(|addLink\(|removeLink\(/.test(fn), false, 'pullLink 가 링크 토큰을 쓴다');
});

test('㉢6 ★검사 표면에 열려 있다 — 다음 사람이 소스 말고 여기로 묻는다', () => {
  assert.match(stripComments(SRC), /_unitMoveIds,/, 'window.SPLink 에 _unitMoveIds 가 없다');
});

test('㉢7 ★[옛 저장본 무회귀] `_unitMoveIds` 는 ★«당기기» 한 자리에서만 불린다', () => {
  /* ★이것이 ★이 건의 ★무회귀 근거다 — 그리는 자(_drawEdges)·추종(_applyFollow)·불러오기가
     이 함수를 ★부르지 않으므로, ★더블클릭으로 ★당기기 전에는 ★아무것도 안 바뀐다.
     ⛔라이브(9334) 바이트 대조는 ★이 건에서 ★공허하다 — 현빈 문서에 스크래치패드가 ★0장이라
       `_unitMoveIds` 가 ★한 번도 안 불린다(「0건이 초록」). 그래서 ★구조로 잠근다. */
  const code = stripComments(SRC);
  const defs = [...code.matchAll(/function _unitMoveIds\s*\(/g)].length;
  const calls = [...code.matchAll(/_unitMoveIds\s*\(/g)].length - defs;
  assert.equal(defs, 1, `정의가 ${defs}곳이다`);
  assert.equal(calls, 1, `호출이 ${calls}곳이다 — ★당기기(pullLink) ★한 자리여야 한다. 그리기·추종이 부르면 선·자리가 같이 바뀐다`);
  const pull = stripComments(sliceBlock(SRC, 'function pullLink('));
  assert.equal([...pull.matchAll(/_unitMoveIds\s*\(/g)].length, 1, '그 한 호출이 pullLink 안이 아니다');
  /* ★닻을 ★변수에 담지 않는다(루프를 풀었다) — anchor-signature-ratchet R4 의 「변수 닻」 칸이
     ★이 자를 ★못 가르기 때문이다. ⛔`for (… of [[name, head]…]) sliceBlock(SRC, head)` 로 되돌리지 마라. */
  const _drawFn = stripComments(sliceBlock(SRC, 'function _drawEdges('));
  assert.equal(/_unitMoveIds/.test(_drawFn), false, '_drawEdges 가 움직이는 집합을 읽는다 — 그리기가 바뀌면 옛 저장본의 그림이 달라진다');
  const _followFn = stripComments(sliceBlock(SRC, 'function _applyFollow('));
  assert.equal(/_unitMoveIds/.test(_followFn), false, '_applyFollow 가 움직이는 집합을 읽는다 — 추종이 바뀌면 옛 저장본의 그림이 달라진다');
});
