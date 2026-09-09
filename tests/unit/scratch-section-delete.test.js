/* scratch-section-delete.test.js — #16-DEL 「링크된 섹션을 지우면 스크래치패드도 «같이» 지운다」
 * (2026-09-09 신설 · 현빈 QA 발주 → 같은 날 «정정»)
 *
 * ★규격이 하루 안에 한 번 바뀌었다. 두 판을 다 적어 둔다 — 「왜 안 묻나」가 다음 사람의 첫 질문이라서.
 *   ⑴ 첫 발주 : 「섹션을 삭제할 때 «스크래치패드도 같이 삭제할까요?»를 묻고, 아니라면 링크만 끊어라」
 *   ⑵ ★정정  : 「**알럿 띄우니 이상하네. 그냥 스크래치패드랑 같이 삭제시켜줘.**」 ← 지금 규격
 *   ⇒ ⛔확인 대화상자를 «다시 들이지 마라». `confirm` 호출 0건이 계약이다(D4).
 *
 * ★★유일한 예외 = 「남이 쓰는 스크래치패드」.
 *   한 이미지를 «두 섹션»이 링크한 상태에서 한쪽만 지웠는데 이미지를 지우면, 남은 섹션의
 *   refLinks 토큰이 死참조가 된다 — 화면엔 링크가 있다고 적혀 있는데 그림이 없다.
 *   ⇒ 참조가 «0일 때만» 지운다. 그 수는 ⛔손으로 적지 않고 `[data-ref-links]` 전수를 훑어 «기계가» 센다.
 *
 * ★★신고된 ⑴ 버그(「붙여넣은 섹션을 지웠는데 링크가 원본으로 옮겨가 2장」)는 «이미 고쳐져 있었다».
 *   2026-09-09 실앱 실측(포트 9384)으로 갈랐다 — 고침(e4ecc39 rewireClonedSection)을 «런타임에 되돌려» 재현:
 *   ┌ 고침을 되돌린 판 ────────────────────────────────────────────────────
 *   │ 붙여넣기 직후 : 섹션 둘이 «같은» sp_ogr2qz 를 쥔다 → links 2 · edges 2 · ★이미지는 1
 *   │               = 「똑같은 스크래치패드가 2장」의 정체는 «링크가 둘»이지 아이템이 둘이 아니다
 *   │ 사본 섹션 삭제: links 1 · 이미지가 y583 → y200 «원본 섹션 자리»로 돌아온다
 *   │               = 「링크가 처음 생성된 섹션으로 옮겨갔다」
 *   └ 고침이 살아있는 판 ──────────────────────────────────────────────────
 *     붙여넣기 직후 : 원본 sp_bc4pzk · 사본 sp_rtuvz1 (이미지 2 · 링크 2 · 1:1)
 *     사본 섹션 삭제: 원본 refLinks 가 `sp_bc4pzk:0` → `sp_bc4pzk:0` (★한 건도 안 늘었다)
 *   ⇒ ★원인은 「붙여넣기가 사본에 «같은» scratchId 를 물려준다」였고, 그 원인 고침은
 *     자매 파일 tests/unit/scratch-paste-dup.test.js 가 지킨다(T-U1-1/2/6/6b).
 *     이 파일의 D1 은 그 «다음 걸음»을 지킨다 — 삭제가 «남는 섹션»의 refLinks 를 안 건드린다.
 *   ⛔「이제 같이 삭제하니까 안 보인다」로 넘기지 마라 — 증상이 가려질 뿐 원인은 저 두 곳이 진다.
 *
 * ★이 파일이 겨누는 것
 *   ⑴ scratchpad-link.js 의 신설 함수를 «원문에서 떼어» 실제로 돌린다(D1~D8)
 *   ⑵ editor.js ↔ SPLink «이음매»는 텍스트로 못 박는다(D9~D14)
 *      — editor.js 를 «실행»해서 재는 검사는 이 레포에 0개다(ESM 이라 addScriptTag 로 못 얹는다).
 *        자매 파일의 같은 한계 문단 참조. 그 한계는 그대로다.
 *
 * ⛔주석 거르기는 tests/unit/_strip-comments.js 의 stripComments «만» 쓴다.
 * ⛔고정 창(slice(i, i±N)) 금지 — 함수 몸통은 중괄호를 세어 떼어낸다.
 *
 * ★안 잰 것 (정직하게)
 *   · 「사용자가 이미지가 사라진 걸 «알아채는가»」 — 토스트도 안 띄운다(발주가 「그냥 같이 삭제」다).
 *     되돌리기가 유일한 안전망이므로 D8/D13 이 그것을 지킨다. 체감은 실기(지디)가 진다.
 *   · js/editor.js 의 deleteSection() 은 «이미지를 안 지운다»(D12) — 그 갈래의 ⌘Z 를 실앱에서
 *     ★재 봤다: pushHistory 가 «변경 전»이라 sideEffects 가 안 탄다(그래서 안 지운다).
 *     그 실측 로그는 이 파일이 아니라 보고서에 있다.
 *   · 레이어 패널 A/B 경로 셋은 «안 배선했다» — D14 가 래칫으로 못박아 둔다.
 *   · 협업(sync.js) 원격 삭제가 이 경로를 지나는가 — «안 쟀다».
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { readSrc } = require('./_srcread.js');
const { stripComments } = require('./_strip-comments.js');

const ROOT = path.join(__dirname, '..', '..');
const RAW = {
  editor: readSrc(ROOT, 'js', 'editor.js'),
  link:   readSrc(ROOT, 'js', 'scratchpad-link.js'),
  // ★D14 전용 — «안 배선한» 형제 경로의 분모
  layer:     readSrc(ROOT, 'js', 'panels', 'layer-panel.js'),
  variation: readSrc(ROOT, 'js', 'section-variation.js'),
};
/** 주석을 걷어낸 판 — «문장이 있다/없다»는 전부 이쪽에서 센다. */
const SRC = Object.fromEntries(Object.entries(RAW).map(([k, v]) => [k, stripComments(v)]));

/* ── 중괄호를 세어 함수 몸통을 떼어내는 부품 (고정 창 금지) ────────────────── */
function _matchBrace(src, openIdx, label) {
  let depth = 0;
  for (let j = openIdx; j < src.length; j++) {
    if (src[j] === '{') depth++;
    else if (src[j] === '}') { depth--; if (depth === 0) return j; }
  }
  assert.fail(`★"${label}" 의 몸통 끝을 못 찾았다`);
}
function fnBody(src, header, label) {
  const i = src.indexOf(header);
  assert.notStrictEqual(i, -1, `★"${label}" 를 못 찾았다 — 이름이 바뀌었으면 이 검사부터 고쳐라`);
  const start = src.indexOf('{', i + header.length - 1);
  assert.notStrictEqual(start, -1, `★"${label}" 의 몸통 시작 { 을 못 찾았다`);
  return src.slice(start + 1, _matchBrace(src, start, label));
}
/** `function NAME(…) {` — ★인자 목록의 괄호를 «세어» 지나간다.
 *  헤더 문자열을 통째로 못 박으면 «기본값 한 글자»만 바뀌어도 파일이 통째로 못 읽혀서,
 *  그 변이가 «이름 있는 빨강»이 아니라 「못 찾았다」로 나온다(2026-09-09 변이표 M2 에서 실측). */
function fnBodyByName(src, name, label) {
  const i = src.indexOf('function ' + name + '(');
  assert.notStrictEqual(i, -1, `★"${label}" 를 못 찾았다 — 이름이 바뀌었으면 이 검사부터 고쳐라`);
  let depth = 0, j = src.indexOf('(', i);
  for (; j < src.length; j++) {
    if (src[j] === '(') depth++;
    else if (src[j] === ')') { depth--; if (depth === 0) break; }
  }
  const start = src.indexOf('{', j);
  assert.notStrictEqual(start, -1, `★"${label}" 의 몸통 시작 { 을 못 찾았다`);
  return { body: src.slice(start + 1, _matchBrace(src, start, label)), params: src.slice(src.indexOf('(', i) + 1, j) };
}

const _REL   = fnBodyByName(SRC.link, 'releaseSectionsForDelete', 'releaseSectionsForDelete');
const REL    = _REL.body;
const _DELSEL = fnBodyByName(SRC.editor, 'deleteSelectedFromCanvas', 'deleteSelectedFromCanvas');
const DELSEL = _DELSEL.body;
const DELSEC = fnBodyByName(SRC.editor, 'deleteSection', 'deleteSection').body;

// ══════════════════════════════════════════════════════════════════
test('D0 ★양성대조 — 두 파일을 «실제로» 읽고 있다 (아래의 「0건」이 못 읽어서가 아니다)', () => {
  assert.match(SRC.link,   /function releaseSectionsForDelete\s*\(/, '★scratchpad-link.js 를 못 읽고 있다');
  assert.match(SRC.editor, /function deleteSelectedFromCanvas\s*\(/, '★editor.js 를 못 읽고 있다');
  // ★주석 거르개가 실제로 돌았는가 — 안 돌면 아래 「금지어 0건」이 주석에 걸려 거짓 빨강이 난다
  assert.ok(RAW.link.includes('확인 대화상자를 다시 들이지 마라'),
    '★원문에 대화상자 금지 «주석»이 있어야 D4 의 대조가 성립한다');
  assert.ok(!REL.includes('확인 대화상자를 다시 들이지 마라'),
    '★주석 거르개가 안 돌고 있다 — 몸통에 주석 문장이 남아 있다');
});

/* ══════════════════════════════════════════════════════════════════
   실행 하네스 — releaseSectionsForDelete 를 «원문에서 떼어» 돌린다.
   ★document 를 «인자»로 넣는다 — _holderSecs 의 `[data-ref-links]` 선택자를 대역으로 바꾸지 않고
     «그대로» 돌리기 위해서다(그 선택자가 참조 세기의 분모라서 대역으로 갈면 계약이 죽는다).
   ══════════════════════════════════════════════════════════════════ */
function buildHarness() {
  const src = [
    "const ATTR = 'refLinks';",
    'const _follow = new Map();',
    'function _parse(sec) {' + fnBody(SRC.link, 'function _parse(sec)', '_parse') + '}',
    'function _write(sec, arr) {' + fnBody(SRC.link, 'function _write(sec, arr)', '_write') + '}',
    'function _num(v) {' + fnBody(SRC.link, 'function _num(v)', '_num') + '}',
    'function _item(id) {' + fnBody(SRC.link, 'function _item(id)', '_item') + '}',
    'function _curPageId() {' + fnBody(SRC.link, 'function _curPageId()', '_curPageId') + '}',
    'function _clearAnchor(scratchId) {' + fnBody(SRC.link, 'function _clearAnchor(scratchId)', '_clearAnchor') + '}',
    'function _rerender() {' + fnBody(SRC.link, 'function _rerender()', '_rerender') + '}',
    'function _save() {' + fnBody(SRC.link, 'function _save()', '_save') + '}',
    'function _emitSplChanged() {' + fnBody(SRC.link, 'function _emitSplChanged()', '_emitSplChanged') + '}',
    'function linksOfSections(secs) {' + fnBody(SRC.link, 'function linksOfSections(secs)', 'linksOfSections') + '}',
    'function _holderSecs() {' + fnBody(SRC.link, 'function _holderSecs()', '_holderSecs') + '}',
    'function refCount(scratchId) {' + fnBody(SRC.link, 'function refCount(scratchId)', 'refCount') + '}',
    'function releaseSectionsForDelete(' + _REL.params + ') {' + REL + '}',
    'return { releaseSectionsForDelete, linksOfSections, refCount, _holderSecs };',
  ].join('\n');
  return new Function('window', 'console', 'document', src);
}

/** 노드용 «섹션» 대역 — _parse/_write 가 보는 면(dataset)만 세운다. */
function mkSec(id, refLinks) {
  const ds = {};
  if (refLinks) ds.refLinks = refLinks;
  return { id, dataset: ds, classList: { contains: (c) => c === 'section-block' }, querySelectorAll: () => [] };
}
/** 노드용 document 대역 — ★`[data-ref-links]` «말고 다른 선택자»로 물으면 터진다.
 *  그래야 「손으로 적은 .section-block 목록」으로 슬쩍 갈아타는 것이 검사에 걸린다. */
function mkDoc(allSecs) {
  const doc = {
    queries: [],
    querySelectorAll(sel) {
      doc.queries.push(sel);
      assert.strictEqual(sel, '[data-ref-links]',
        `★참조 세기의 «분모»가 바뀌었다(${sel}) — 「링크를 쥐고 있다」의 표식은 data-ref-links 속성 하나뿐이다`);
      return allSecs.filter((s) => 'refLinks' in s.dataset);
    },
  };
  return doc;
}
/** 노드용 ScratchPadDB 대역 + 호출 원장. */
function mkWorld(items = [
  { id: 'sp_a', src: 'goya-asset://a', x: 100, y: 20, w: 80, linkDy: 7 },
  { id: 'sp_b', src: 'goya-asset://b', x: 300, y: 40, w: 80, linkDy: 11 },
]) {
  const db = items.map((i) => Object.assign({}, i));
  const log = { removed: [], restored: [], confirms: 0, events: [], warns: [] };
  const win = {
    state: { currentPageId: 'p1' },
    _scratchItemById: (id) => db.find((s) => s.id === id) || null,
    _scratchSaveSoon: () => {},
    scheduleAutoSave: () => {},
    __spLinkRerender: () => {},
    // ★대화상자가 «불리면» 원장에 남는다(D4 의 실행 쪽 근거)
    confirm: () => { log.confirms++; return true; },
    _scratchRestoreItem: (rec) => { log.restored.push(rec); db.push(Object.assign({}, rec)); return { ok: true }; },
    _scratchRemoveById: (id) => {
      log.removed.push(id);
      const k = db.findIndex((s) => s.id === id);
      if (k < 0) return false;
      db.splice(k, 1); return true;
    },
    dispatchEvent: (e) => { log.events.push(e && e.type); return true; },
    CustomEvent: function CustomEvent(type) { return { type }; },
  };
  const con = { warn: (...a) => log.warns.push(a.join(' ')) };
  return { win, con, db, log };
}
/** 하네스 + 세상 + «캔버스의 모든 섹션»(참조 세기의 분모)을 한 벌로. */
function mount(allSecs, items) {
  const W = mkWorld(items);
  const D = mkDoc(allSecs);
  const M = buildHarness()(W.win, W.con, D);
  return { M, W, D };
}

// ══════════════════════════════════════════════════════════════════
test('D1 ★★S1 — 「링크를 옮기지 않는다」: 지우는 섹션의 토큰만 지우고 «남는 섹션»의 refLinks 는 한 글자도 안 바뀐다', () => {
  const orig   = mkSec('sec_orig',  'sp_a:0');   // ★원본(안 지운다)
  const pasted = mkSec('sec_paste', 'sp_b:0');   // ★붙여넣은 것(지운다) — 고침 덕에 «다른» id 다
  const { M, W } = mount([orig, pasted]);
  const before = orig.dataset.refLinks;
  // ★입력이 «살아 있었나»(S5) — 처분 «전»에 센다. 뒤에 세면 늘 0이라 자기통과한다.
  const inputLinks = M.linksOfSections([pasted]).length;

  M.releaseSectionsForDelete([pasted]);

  assert.strictEqual(inputLinks, 1,
    '★분모 붕괴 — 지운 섹션이 링크를 «안» 쥐고 있었다면 아래 단언들은 아무것도 안 잰 것이다');
  assert.strictEqual(orig.dataset.refLinks, before,
    `★남는 섹션의 refLinks 가 바뀌었다 (${before} → ${orig.dataset.refLinks}) — `
    + '현빈이 신고한 「링크가 처음 생성된 섹션으로 옮겨가서 스크래치패드가 2장」이 이것이다.');
  assert.ok(!('refLinks' in pasted.dataset), '★지우는 섹션의 refLinks 가 안 지워졌다');
  // ★원본이 쓰는 이미지는 «살아 있다»(사본 것만 지운다)
  assert.deepStrictEqual(W.log.removed, ['sp_b'],
    `★지운 이미지가 사본 것(sp_b) 하나가 아니다: ${JSON.stringify(W.log.removed)}`);
  assert.ok(W.db.some((s) => s.id === 'sp_a'), '★원본이 쓰는 이미지까지 지웠다');
});

test('D2a ★★기본값이 «같이 삭제» 다 — 호출자가 아무것도 안 넘겨도 지운다 (발주: 「그냥 같이 삭제」)', () => {
  assert.match(_REL.params, /deleteOrphans\s*=\s*true/,
    `★releaseSectionsForDelete 의 기본값이 «지우지 않음» 쪽으로 뒤집혔다: ${JSON.stringify(_REL.params)} — `
    + '사용자 경로(js/editor.js)는 옵션을 «안» 넘긴다. 기본값이 false 면 발주가 통째로 무효가 되는데 '
    + '화면엔 아무 표시도 안 난다.');
  // 실행으로도 확인 — 인자 없이 불러도 지운다
  const sec = mkSec('sec_x', 'sp_a:0');
  const { M, W } = mount([sec]);
  M.releaseSectionsForDelete([sec]);
  assert.deepStrictEqual(W.log.removed, ['sp_a'], '★인자 없이 불렀는데 안 지웠다');
});

test('D2 ★★S2 — 그 섹션«만» 쓰던 스크래치 아이템이 «같이» 사라진다 (순서: ①끊기 →②고아삭제)', () => {
  const sec = mkSec('sec_x', 'sp_a:0,sp_b:1');
  const { M, W } = mount([sec]);
  const out = M.releaseSectionsForDelete([sec]);

  assert.deepStrictEqual(out.order, ['sever', 'deleteOrphans'],
    `★밟은 순서가 다르다: ${JSON.stringify(out.order)} — ①을 먼저 하기 «때문에» ②의 분모가 `
    + '「남이 아직 쓰는 섹션」이 된다. 거꾸로 하면 지우는 섹션이 «자기 자신»을 세어 항상 참조≥1 이 되고 '
    + '고아가 하나도 안 지워진다(= 발주 「그냥 같이 삭제」가 통째로 무효).');
  assert.deepStrictEqual(W.log.removed.slice().sort(), ['sp_a', 'sp_b'],
    `★같이 안 지웠다: ${JSON.stringify(W.log.removed)}`);
  assert.strictEqual(W.db.length, 0, '★스크래치 아이템이 남았다');
  assert.ok(!('refLinks' in sec.dataset), '★링크가 안 끊겼다');
  assert.deepStrictEqual(out.keptShared, [], '★아무도 안 쓰는데 「남이 쓴다」고 봤다');
  assert.strictEqual(out.links.length, 2, '★분모 붕괴 — 링크 2건을 쥔 섹션이어야 이 검사가 뜻을 갖는다');
  // ★앵커도 버려야 «다시 완전 자유»가 된다(살아남는 경우를 대비한 같은 규약 — D3 이 그 짝이다)
  assert.ok(out.sideEffects, '★sideEffects 가 없다 — 이미지가 말없이 지워지는데 ⌘Z 가 못 되살린다 = 데이터 손실');
});

test('D3 ★★★S3 — «남이 쓰는» 스크래치패드는 ⛔안 지운다 (두 섹션이 같은 scratchId 를 쥔 상태)', () => {
  const keep = mkSec('sec_keep', 'sp_a:0');      // ★남는 섹션 — 같은 sp_a 를 쥔다
  const gone = mkSec('sec_gone', 'sp_a:0,sp_b:0');
  const { M, W, D } = mount([keep, gone]);

  // ★입력이 «정말로» 공유 상태였나(S5) — 처분 전에 기계가 센다
  assert.strictEqual(M.refCount('sp_a'), 2,
    '★분모 붕괴 — 두 섹션이 sp_a 를 «같이» 쥔 상태를 안 밟았다면 이 검사는 아무것도 안 잰 것이다');

  const out = M.releaseSectionsForDelete([gone]);

  assert.deepStrictEqual(W.log.removed, ['sp_b'],
    `★«남이 쓰는» sp_a 까지 지웠다: ${JSON.stringify(W.log.removed)} — 남은 섹션(sec_keep)의 `
    + 'refLinks 토큰이 死참조가 된다. 화면엔 링크가 있다고 적혀 있는데 그림이 없다.');
  assert.ok(W.db.some((s) => s.id === 'sp_a'), '★공유 이미지가 사라졌다');
  assert.deepStrictEqual(out.keptShared, [{ scratchId: 'sp_a', stillUsedBy: 1 }],
    `★「남이 쓴다」를 안 세거나 수가 틀렸다: ${JSON.stringify(out.keptShared)}`);
  assert.strictEqual(keep.dataset.refLinks, 'sp_a:0', '★남는 섹션의 링크가 바뀌었다');
  // ★분모는 «전수»여야 한다 — 손으로 적은 목록으로 갈아타면 mkDoc 이 터진다
  assert.ok(D.queries.length >= 1 && D.queries.every((q) => q === '[data-ref-links]'),
    `★참조 세기가 [data-ref-links] 전수를 안 훑었다: ${JSON.stringify(D.queries)}`);
});

test('D3b ★공유가 «풀리면» 그때는 지운다 — 마지막 섹션을 지울 때 비로소 고아가 된다', () => {
  const a = mkSec('sec_a', 'sp_a:0');
  const b = mkSec('sec_b', 'sp_a:0');
  const { M, W } = mount([a, b]);
  M.releaseSectionsForDelete([a]);
  assert.deepStrictEqual(W.log.removed, [], '★아직 b 가 쥐고 있는데 지웠다');
  M.releaseSectionsForDelete([b]);                       // 이제 아무도 안 쥔다
  assert.deepStrictEqual(W.log.removed, ['sp_a'],
    '★마지막 참조가 사라졌는데도 안 지웠다 — 그러면 고아가 영영 쌓인다');
});

test('D3c ★한 이미지를 «지우는 섹션 둘»이 쥔 경우 — 한 번만 세고 한 번만 지운다', () => {
  const s1 = mkSec('s1', 'sp_a:0');
  const s2 = mkSec('s2', 'sp_a:1');
  const { M, W } = mount([s1, s2]);
  const out = M.releaseSectionsForDelete([s1, s2]);       // ★둘 다 지운다 = 고아가 된다
  assert.deepStrictEqual(W.log.removed, ['sp_a'], `★같은 이미지를 두 번 지우려 들었다: ${W.log.removed.join(',')}`);
  assert.strictEqual(out.removedScratch.length, 1, '★복원 레코드가 중복이다 — onRedo 가 없는 것을 또 지운다');
});

test('D4 ★★S4 — 대화상자를 «안» 띄운다: confirm 호출 0건 (원문에도, 실행에도)', () => {
  const sec = mkSec('sec_x', 'sp_a:0');
  const { M, W } = mount([sec]);
  M.releaseSectionsForDelete([sec]);
  assert.strictEqual(W.log.confirms, 0,
    `★confirm 을 ${W.log.confirms}번 불렀다 — 현빈이 알럿을 직접 보고 「그냥 같이 삭제」로 정정했다.`);
  // ★원문 쪽 못 — 두 파일의 «코드»에 confirm/prompt/alert 이 0건이다(주석은 걸러진 판에서 센다)
  for (const [name, body] of [['scratchpad-link.js', SRC.link], ['deleteSelectedFromCanvas', DELSEL]]) {
    for (const bad of ['confirm(', 'prompt(', 'alert(']) {
      assert.ok(!body.includes(bad), `★${name} 에 ${bad} 가 있다 — 대화상자는 폐기됐다`);
    }
  }
  // 양성대조 — 이 레포에 confirm( 은 «실재»한다(0건이 「없는 문자열」이라서가 아니다)
  assert.ok(stripComments(readSrc(ROOT, 'js', 'design-system.js')).includes('confirm('),
    '★대조 실패 — 레포에 confirm( 이 없다. 그러면 위 「0건」은 아무것도 안 잰 것이다');
});

test('D5 ⛔removeLink 금지 — releaseSectionsForDelete 는 pushHistory 를 «스스로» 쌓지 않는다', () => {
  for (const bad of ['removeLink(', 'pushHistory']) {
    assert.ok(!REL.includes(bad),
      `★releaseSectionsForDelete 가 ${bad} 를 쓴다 — 그러면 섹션 삭제와 «별개의» 히스토리 항목이 쌓여 `
      + '⌘Z 가 두 번으로 쪼개진다(「한 번 눌렀는데 섹션만 돌아온다」). '
      + 'js/scratch-pad.js _severLinks 가 «같은 이유»로 dataset 을 직접 고친다.');
  }
  assert.ok(SRC.link.includes('removeLink(') && SRC.link.includes('pushHistory'),
    '★대조 실패 — scratchpad-link.js 에 removeLink/pushHistory 가 없다');
});

test('D6 ★★S6 undo 왕복 — onUndo 가 «같은 id 로» 되살리고 onRedo 가 다시 지운다 (데이터 손실 방지선)', () => {
  const sec = mkSec('sec_x', 'sp_a:0,sp_b:0');
  const { M, W } = mount([sec]);
  const out = M.releaseSectionsForDelete([sec]);
  assert.strictEqual(W.db.length, 0, '★전제 — 둘 다 지워져야 한다');

  out.sideEffects.onUndo();
  assert.deepStrictEqual(W.log.restored.map((r) => r.id).sort(), ['sp_a', 'sp_b'],
    '★onUndo 가 지운 이미지를 안 되살린다 — 이제 이미지가 «말없이» 지워지므로 이게 유일한 안전망이다');
  assert.deepStrictEqual(W.log.restored.map((r) => r.id).sort(), W.log.removed.slice().sort(),
    '★되살린 id 집합이 지운 집합과 다르다 — 되돌아온 캔버스 스냅샷의 refLinks 토큰이 그 id 를 부른다. 死참조가 된다.');
  assert.ok(W.log.restored.every((r) => 'src' in r && 'linkDy' in r),
    '★복원 레코드에 src/linkDy 가 없다 — 지운 뒤엔 못 뜬다. 그림이 안 돌아오거나 자리가 튄다.');

  const n = W.log.removed.length;
  out.sideEffects.onRedo();
  assert.strictEqual(W.log.removed.length, n + 2, '★onRedo 가 다시 안 지운다');
  assert.strictEqual(W.db.length, 0, '★redo 뒤 이미지가 남았다');
});

test('D7 ★페이지 가드 — 다른 페이지에서 불리면 «건드리지 않고» 경고한다 (ScratchPadDB 는 페이지별 키다)', () => {
  const sec = mkSec('sec_x', 'sp_a:0');
  const { M, W } = mount([sec]);
  const out = M.releaseSectionsForDelete([sec]);
  const n = W.log.removed.length;
  W.win.state.currentPageId = 'p2';              // restoreSnapshot 이 페이지를 바꾼 뒤다
  out.sideEffects.onUndo();
  out.sideEffects.onRedo();
  assert.deepStrictEqual(W.log.restored, [], '★다른 페이지인데 되살렸다');
  assert.strictEqual(W.log.removed.length, n, '★다른 페이지인데 지웠다');
  assert.strictEqual(W.log.warns.length, 2, `★조용히 넘어갔다 — 「모르는 상태」는 소리를 내야 한다: ${JSON.stringify(W.log.warns)}`);
});

test('D8 ★음성대조 — 링크가 «없는» 섹션은 아무것도 안 건드린다 (그리고 참조를 세지도 않는다)', () => {
  const bare = mkSec('sec_bare');
  const other = mkSec('sec_other', 'sp_a:0');
  const { M, W, D } = mount([bare, other]);
  const out = M.releaseSectionsForDelete([bare]);
  assert.deepStrictEqual(out.order, [], '★링크 0인데 무언가를 했다');
  assert.deepStrictEqual(W.log.removed, [], '★링크 0인 섹션 삭제가 이미지를 지웠다');
  assert.strictEqual(W.db.length, 2, '★이미지 수가 줄었다');
  assert.deepStrictEqual(D.queries, [], '★링크가 0인데 참조를 셌다 — 헛일이다(그리고 분모 계산이 도는 걸 숨긴다)');
  // ★양성대조 — 링크가 «있으면» 실제로 센다(위 0건이 「함수가 안 도는」 탓이 아니다)
  const { M: M2, D: D2 } = mount([mkSec('s', 'sp_a:0')]);
  M2.releaseSectionsForDelete([...[]].concat([mkSec('s', 'sp_a:0')]));
  assert.ok(D2.queries.length >= 1, '★링크가 있으면 참조를 세야 한다');
});

test('D8b ⛔deleteOrphans:false 는 «끊기만» 한다 (deleteSection 전용 갈래 — D12 가 그 이유를 진다)', () => {
  const sec = mkSec('sec_x', 'sp_a:0');
  const { M, W } = mount([sec]);
  const out = M.releaseSectionsForDelete([sec], { deleteOrphans: false });
  assert.deepStrictEqual(out.order, ['sever'], `★순서표가 다르다: ${JSON.stringify(out.order)}`);
  assert.deepStrictEqual(W.log.removed, [], '★deleteOrphans:false 인데 지웠다');
  assert.strictEqual(out.sideEffects, null, '★안 지웠는데 sideEffects 를 달았다');
  assert.ok(!('refLinks' in sec.dataset), '★링크는 끊어야 한다');
});

/* ══════════════════════════════════════════════════════════════════
   editor.js ↔ SPLink 이음매 — «텍스트»로 못 박는다.
   ⚠️한계: editor.js 를 «실행»해서 재는 검사는 이 레포에 0개다(ESM). 그 한계는 그대로다.
   ⛔인덱스 비교만으로 되돌리지 마라 — 자매 파일(scratch-paste-dup.test.js T-U1-1)이
     「인덱스는 한 글자도 안 움직이는데 발주 버그가 통째로 되살아난」 변이 둘을 기록해 뒀다.
   ══════════════════════════════════════════════════════════════════ */
const SEC_REMOVE_STMTS = ['toDelete.forEach(s => s.remove());', 'selSection.remove();'];

test('D9 ★★순서 계약 — 섹션을 지우는 «모든» 문 앞에 링크 처분이 «먼저» 온다', () => {
  const iRel = [...DELSEL.matchAll(/_splReleaseSections\(/g)].map((m) => m.index);
  assert.ok(iRel.length >= 1, '★deleteSelectedFromCanvas 가 링크 처분을 «아예» 안 부른다');
  let seen = 0;
  for (const stmt of SEC_REMOVE_STMTS) {
    let from = 0;
    for (;;) {
      const iRemove = DELSEL.indexOf(stmt, from);
      if (iRemove === -1) break;
      from = iRemove + 1; seen++;
      const before = iRel.filter((i) => i < iRemove);
      assert.ok(before.length > 0,
        `★"${stmt}" (idx ${iRemove}) «앞»에 _splReleaseSections 호출이 없다 — 섹션을 먼저 지우면 `
        + '그 섹션이 참조 세기의 분모에서 «미리» 빠져 버리거나, 앵커를 못 버린다. '
        + '무엇보다 발주 「그냥 같이 삭제」가 그 갈래에서 통째로 안 돈다.');
      assert.ok(iRemove - Math.max(...before) < 400,
        `★"${stmt}" 와 그 앞 _splReleaseSections 가 너무 멀다(${iRemove - Math.max(...before)}자) — 짝이 어긋났을 수 있다`);
    }
  }
  assert.strictEqual(seen, 3,
    `★섹션을 지우는 문을 ${seen}개 찾았다(기대 3 = 다중 1 + 변형그룹 1 + 단일 1). `
    + '새 삭제 문이 생겼거나 기존 문이 바뀌었으면 «그 문도» 링크 처분을 지나는지 확인하고 이 수를 갱신해라.');
});

test('D10 ★★체크포인트가 «먼저» — ensureHistoryCheckpoint 는 링크가 «살아있는» 캔버스를 찍어야 한다', () => {
  const iChk = [...DELSEL.matchAll(/ensureHistoryCheckpoint\('섹션[^']*'\)/g)].map((m) => m.index);
  const iRel = [...DELSEL.matchAll(/_splReleaseSections\(/g)].map((m) => m.index);
  assert.strictEqual(iChk.length, 3,
    `★섹션 삭제 체크포인트가 ${iChk.length}개다(기대 3) — 하나라도 빠지면 그 갈래는 ⌘Z 로 되살린 섹션에 `
    + 'refLinks 가 «빠진 채» 온다(2026-09-09 실측: 링크 1 → undo 후 0).');
  assert.strictEqual(iRel.length, 3, `★링크 처분 호출이 ${iRel.length}개다(기대 3)`);
  for (let k = 0; k < 3; k++) {
    assert.ok(iChk[k] < iRel[k],
      `★${k + 1}번째 갈래에서 체크포인트가 링크 처분 «뒤»에 있다(${iChk[k]} > ${iRel[k]}) — `
      + '그러면 체크포인트가 «이미 끊긴» 캔버스를 찍어서, ⌘Z 로 돌아온 섹션에 링크가 없다.');
  }
});

test('D11 ★★S6 배선 — 섹션 삭제의 pushHistory 가 «전부» sideEffects 를 싣는다', () => {
  const hits = [...DELSEL.matchAll(/pushHistory\('섹션 삭제'([^)]*)\)/g)].map((m) => m[1]);
  assert.strictEqual(hits.length, 3,
    `★pushHistory('섹션 삭제') 를 ${hits.length}자리에서 찾았다(기대 3) — 분모가 바뀌었으면 이 검사부터 고쳐라`);
  for (const arg of hits) {
    assert.match(arg, /,\s*_splRel\?\.sideEffects/,
      '★섹션 삭제 pushHistory 가 sideEffects 를 안 싣는다 — 이제 이미지가 «말없이» 지워진다. '
      + `⌘Z 가 못 되살리면 그건 데이터 손실이다. 본 것: ${JSON.stringify(arg)}`);
  }
});

test('D12 ★★⌘X 는 «이동»이다 — 잘라내기는 링크 처분을 «아예» 안 지난다', () => {
  const CUT = SRC.editor.slice(SRC.editor.indexOf("if (e.key === 'x' && !e.shiftKey)"));
  assert.ok(CUT.includes('deleteSelectedFromCanvas({ isCut: true })'),
    '★⌘X 가 isCut 을 안 넘긴다 — 그러면 잘라내기가 참고이미지를 «지운다». ⌘V 로 되붙인 섹션의 '
    + 'refLinks 토큰은 死참조가 된다(붙여넣기 규칙: 아무도 안 쥐면 = 이동 → 토큰 그대로).');
  const rels = [...DELSEL.matchAll(/_splReleaseSections\(/g)].map((m) => m.index);
  assert.strictEqual(rels.length, 3, `★링크 처분 자리가 ${rels.length}개다(기대 3)`);
  for (const i of rels) {
    const head = DELSEL.slice(Math.max(0, i - 40), i);
    assert.match(head, /isCut \? null :/,
      `★링크 처분 하나가 isCut 게이트를 안 지난다 — 본 것: ${JSON.stringify(head.slice(-40))}`);
  }
  assert.ok(SRC.editor.includes('if (deleteSelectedFromCanvas()) e.preventDefault();'),
    '★Delete/Backspace 경로가 isCut 을 넘기고 있다 — 그러면 «아무 데서도» 같이 삭제가 안 된다');
});

test('D13 ★★MCP 경로(deleteSection)는 ⛔이미지를 «안» 지운다 — 그 갈래는 ⌘Z 가 못 되살린다', () => {
  assert.ok(DELSEC.includes('releaseSectionsForDelete?.([sec], { deleteOrphans: false })'),
    '★deleteSection 이 이미지를 «지운다» — 이 함수는 pushHistory 를 «변경 전»에 찍어서 '
    + 'sideEffects 가 영영 안 탄다(history.js undo() 가 sideEffects 없는 «현재 상태» 항목을 '
    + '떠나는 스냅으로 끼워 넣는다). 그러면 지운 이미지를 ⌘Z 로 못 되살린다 = 데이터 손실. '
    + '그리고 이 문은 MCP·자동화가 쓴다 — 사람이 안 보는 곳이다. '
    + '⛔넓히려면 pushHistory 를 «변경 뒤»로 옮겨야 하는데 그건 MCP undo 의 seq 셈을 건드린다(별건).');
  // ★전제(나중) — 그 「변경 전」 push 가 실제로 그 자리에 있다(위 근거가 성립하는 조건)
  const iPush = DELSEC.indexOf("pushHistory('섹션 삭제 전')");
  const iRel  = DELSEC.indexOf('releaseSectionsForDelete');
  const iRem  = DELSEC.indexOf('sec.remove();');
  assert.ok(iPush !== -1 && iPush < iRel,
    '★deleteSection 의 pushHistory 가 «변경 전»이 아니다 — 그렇다면 위 근거가 낡았다. '
    + '이제 sideEffects 를 실을 수 있는지 다시 재고, 맞으면 「같이 삭제」로 넓혀라.');
  assert.ok(iRel < iRem, `★deleteSection 에서도 순서가 뒤집혔다(release ${iRel} / remove ${iRem})`);
});

test('D14 ⛔전수 래칫 — editor.js 의 `.remove()` 문 수 + 섹션 제거문의 «얼굴»', () => {
  /* ★분모를 손으로 적지 않기 위한 문. 이름으로 «섹션 삭제»만 골라내면 새 이름으로 들어온 문을
     영영 못 본다 ⇒ `.remove()` «전부»를 세고 수를 못박는다(래칫).
     ⚠️한계(명시): 수가 같다고 경로가 그대로인 건 아니다(한 문을 빼고 다른 문을 더하면 유지된다).
       그 짝은 아래 «얼굴» 단언이 잡는다. */
  const ALL = [...SRC.editor.matchAll(/\.remove\(\)/g)];
  assert.strictEqual(ALL.length, 21,
    `★editor.js 의 .remove() 가 ${ALL.length}개다(박아 둔 값 21) — 삭제 문이 늘거나 줄었다. `
    + '새 문이 «섹션»을 지운다면 링크 처분을 먼저 지나게 하고, D9·D10·D11 의 기대 수(3)도 같이 갱신해라.');
  const SECT = [...SRC.editor.matchAll(/(selSection\.remove\(\)|sec\.remove\(\)|toDelete\.forEach\(s => s\.remove\(\)\))/g)]
    .map((m) => m[1]);
  assert.deepStrictEqual(SECT,
    ['toDelete.forEach(s => s.remove())', 'toDelete.forEach(s => s.remove())', 'selSection.remove()', 'sec.remove()'],
    '★섹션을 지우는 «문»의 얼굴이나 순서가 바뀌었다(기대: 다중 → 변형그룹 → 단일 → deleteSection).');
});

/* ══════════════════════════════════════════════════════════════════
   ★★백로그 BL-SPL-06 — 「A/B 형제 경로는 «안» 배선했다」 (2026-09-09 · ⛔이번에 안 고쳤다)
   섹션을 지우는 문이 editor.js «밖»에도 셋 있다. 전부 A/B(Variant) 기능이고, 전부
   링크 처분을 «안 지난다» ⇒ 그 셋으로 지우면 연결된 참고이미지가 오늘도 «주인 없이» 남는다.
     · js/panels/layer-panel.js  `secs.forEach(s => s.remove());`  Variant 그룹 «전체» 삭제(×)
     · js/panels/layer-panel.js  `s.remove();`                     개별 variant 삭제(×)
     · js/section-variation.js   `all.forEach(s => { if (s !== active) s.remove(); });`  ✓확정
   ⛔왜 안 고쳤나 — 이번 단위의 파일 울타리가 js/scratchpad-link.js · js/editor.js ·
     js/scratch-pad.js 로 «명시»돼 있다(지디 지시). 남의 파일을 같이 고치면 그 회귀가
     이 단위의 것으로 섞이고, 같은 브랜치에서 도는 다른 작업과 부딪힌다.
   ★자매 파일의 BL-SPL-03 이 «붙여넣기» 쪽에서 정확히 같은 일을 예고했고 실제로 났다 —
     「고쳐 놓은 병을 새 문으로 그대로 들여왔다」. 같은 값으로 읽어라.
   ⇒ 처방: 저 셋도 SPLink.releaseSectionsForDelete → remove 순서로 지나게 하기.
      (릴리즈 차단 사유는 아니다 — 이미지가 캔버스에 남을 뿐 파괴되지 않는다.)
   ══════════════════════════════════════════════════════════════════ */
test('D15 ⛔백로그 래칫(BL-SPL-06) — 「안 배선한 섹션 삭제 문」이 여전히 셋이다', () => {
  const UNWIRED = [
    ['layer',     'secs.forEach(s => s.remove());',                       'layer-panel.js · Variant 그룹 전체 삭제(×)'],
    ['layer',     's.remove();',                                          'layer-panel.js · 개별 variant 삭제(×)'],
    ['variation', 'all.forEach(s => { if (s !== active) s.remove(); });',  'section-variation.js · ✓확정(나머지 삭제)'],
  ];
  const still = UNWIRED.filter(([f, stmt]) => SRC[f].includes(stmt)).map(([, , label]) => label);
  assert.strictEqual(still.length, 3,
    `★안 배선한 문이 ${still.length}개다(박아 둔 값 3). 살아 있는 것: ${JSON.stringify(still)}\n`
    + '  · 줄었다면 = 누가 배선했거나 문을 지웠다 ⇒ 그 경로가 링크 처분을 «먼저» 지나는지 확인하고 이 수를 갱신해라.\n'
    + '  · 늘었다면 = 새 삭제 문이 또 배선 없이 들어왔다 ⇒ 배선해라.');
  for (const file of ['layer', 'variation']) {
    assert.ok(!SRC[file].includes('releaseSectionsForDelete'),
      `★${file} 이 이제 링크 처분을 «부른다» — 좋은 소식이다. BL-SPL-06 문단과 위 기대 수(3)를 갱신해라.`);
  }
  assert.ok(SRC.editor.includes('_splReleaseSections(') && SRC.link.includes('function releaseSectionsForDelete'),
    '★대조 실패 — 배선된 경로에서조차 링크 처분을 못 찾았다');
});
