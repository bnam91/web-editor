/* mcp-addblock-blockid.test.js — add_text_block / add_gap_block 이 돌려주는 blockId 가
 * «그 호출이 만든 그 블록»인지 검증한다.
 *
 * ★왜 이 파일이 있나(2026-09-07, U2)
 *   두 함수는 렌더러가 만든 블록의 id 를 받을 길이 없어서(js/block-factory.js 의
 *   addTextBlock/addGapBlock 은 «아무것도 return 하지 않는다») «문서순 마지막»을 주워 왔다.
 *   그런데 삽입은 insertAfterSelected(= 선택 블록 «뒤») 라 섹션 끝이 아니고, 쿼리는 문서
 *   «전체»를 훑는다 ⇒ 뒤쪽 섹션에 같은 종류 블록이 하나라도 있으면 앞 섹션에 넣어도
 *   「마지막」이 안 움직인다. 격리 인스턴스 실측에서 «직렬» 3콜이 전부 같은 id 를 돌려줬고,
 *   ok:true 라 호출자(클로드)는 그 다음 update_block 으로 «남의 블록»을 고쳤다.
 *
 * ★어떻게 테스트하나
 *   `_invokeRendererAddBlock` / `_invokeRendererAddGapBlock` 은 Electron main 안에 있어
 *   require 할 수 없다(app.whenReady 배선). 대신 두 함수가 «렌더러에 주입하는 스크립트
 *   문자열»을 main.js 원문에서 그대로 떼어내, 최소 DOM 스텁 위에서 돌린다.
 *   ⇒ 「실제로 배포되는 그 문자열」을 재는 것이지 복제본을 재는 게 아니다.
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const MAIN = fs.readFileSync(path.join(__dirname, '..', '..', 'main.js'), 'utf8');

/** main.js 안의 `const atomicJs = ` … `;` 템플릿(또는 executeJavaScript 인라인 템플릿)을 떼어낸다. */
function extractTemplate(fnName, startsWith) {
  const fnAt = MAIN.indexOf(`function ${fnName}(`);
  assert.notEqual(fnAt, -1, `${fnName} 을 main.js 에서 못 찾았다`);
  const open = MAIN.indexOf(startsWith, fnAt);
  assert.notEqual(open, -1, `${fnName} 안에서 주입 템플릿 시작을 못 찾았다`);
  const from = open + startsWith.length;
  const close = MAIN.indexOf('`', from);
  assert.notEqual(close, -1, `${fnName} 주입 템플릿의 닫는 백틱을 못 찾았다`);
  return MAIN.slice(from, close);
}

/* ── 최소 DOM 스텁 ─────────────────────────────────────────────────────────
   섹션 배열 + 각 섹션의 블록 배열만 있으면 이 두 스크립트는 돌아간다.
   querySelectorAll 은 «문서 순서»(섹션 순 → 블록 순)로 돌려준다 — 결함의 핵심이 그 순서다. */
function makeDom(sections) {
  const doc = { activeElement: null };
  const secEls = sections.map(s => {
    const el = { id: s.id, blocks: [], _isSection: true };
    el.closest = sel => (sel === '[id^="sec_"]' ? el : null);
    s.blocks.forEach(b => el.blocks.push(mkBlock(b.id, b.cls, el)));
    return el;
  });
  function mkBlock(id, cls, sec) {
    const b = { id, cls, _sec: sec };
    b.closest = sel => (sel === '[id^="sec_"]' ? sec : null);
    return b;
  }
  const allBlocks = () => secEls.flatMap(s => s.blocks);
  doc.querySelectorAll = sel => {
    if (sel === '[id^="sec_"]') return secEls.slice();
    const cls = sel.replace(/^\./, '');
    return allBlocks().filter(b => b.cls === cls);
  };
  doc.querySelector = sel => doc.querySelectorAll(sel)[0] || null;
  doc.getElementById = id => secEls.find(s => s.id === id) || allBlocks().find(b => b.id === id) || null;
  return { doc, secEls, mkBlock, allBlocks };
}

function runText(dom, win, { type = '"body"', content = '"hi"', sectionId = 'null', align = 'null' } = {}) {
  const tpl = extractTemplate('_invokeRendererAddBlock', 'const atomicJs = `')
    .replace(/\$\{safeType\}/g, type)
    .replace(/\$\{safeContent\}/g, content)
    .replace(/\$\{safeSectionId\}/g, sectionId)
    .replace(/\$\{safeAlign\}/g, align);
  return new Function('document', 'window', `return ${tpl}`)(dom.doc, win);
}

function runGap(dom, win, { h = 40, sectionId = 'null' } = {}) {
  const tpl = extractTemplate('_invokeRendererAddGapBlock', 'const atomicJs = `')
    .replace(/\$\{safeSid\}/g, sectionId)
    .replace(/\$\{h\}/g, String(h));
  return new Function('document', 'window', `return ${tpl}`)(dom.doc, win);
}

/* ── add_text_block ──────────────────────────────────────────────────────── */

test('add_text_block — «앞» 섹션에 넣어도 반환 blockId 는 그 콜이 만든 블록이다 (문서순 마지막 아님)', async () => {
  // S3 에 이미 텍스트가 있다 = 「문서순 마지막」이 S3 에 고정된 상황(실측 재현 조건).
  const dom = makeDom([
    { id: 'sec_1', blocks: [] },
    { id: 'sec_2', blocks: [] },
    { id: 'sec_3', blocks: [{ id: 'tb_old_last', cls: 'text-block' }] },
  ]);
  let selected = null;
  const win = {
    _lastUserKeydown: 0,
    activePageId: 'page_1',
    selectSection: el => { selected = el; },
    getSelectedSection: () => selected,
    addTextBlock: () => {
      const sec = selected;
      sec.blocks.unshift(dom.mkBlock('tb_new_in_s1', 'text-block', sec)); // 끝이 아니라 «앞»에 꽂힌다
    },
  };
  const res = await runText(dom, win, { sectionId: '"sec_1"' });
  assert.equal(res.ok, true);
  assert.equal(res.blockId, 'tb_new_in_s1', '반환 id 가 남의 블록(tb_old_last)이면 결함 재발');
  assert.notEqual(res.blockId, 'tb_old_last');
  assert.equal(res.sectionId, 'sec_1', '새 블록이 «어느 섹션에» 들어갔는지도 돌려줘야 교차확인이 된다');
});

test('add_text_block — 서로 다른 섹션에 연속 3콜이 «서로 다른» id 를 돌려준다', async () => {
  const dom = makeDom([
    { id: 'sec_1', blocks: [] },
    { id: 'sec_2', blocks: [] },
    { id: 'sec_3', blocks: [] },
  ]);
  let selected = null, n = 0;
  const win = {
    _lastUserKeydown: 0,
    selectSection: el => { selected = el; },
    getSelectedSection: () => selected,
    addTextBlock: () => { const s = selected; s.blocks.unshift(dom.mkBlock('tb_' + (++n), 'text-block', s)); },
  };
  // 내림차순 — 실측에서 3콜이 전부 같은 id 였던 그 순서
  const ids = [];
  for (const sid of ['"sec_3"', '"sec_2"', '"sec_1"']) {
    const r = await runText(dom, win, { sectionId: sid });
    assert.equal(r.ok, true);
    ids.push(r.blockId);
  }
  assert.equal(new Set(ids).size, 3, `3콜이 서로 다른 id 를 줘야 한다 — 받은 값: ${ids.join(',')}`);
  assert.deepEqual(ids, ['tb_1', 'tb_2', 'tb_3']);
});

test('add_text_block — 블록이 안 늘면 NO_SECTION (성공으로 위장하지 않는다)', async () => {
  const dom = makeDom([{ id: 'sec_1', blocks: [{ id: 'tb_x', cls: 'text-block' }] }]);
  const win = {
    _lastUserKeydown: 0,
    selectSection: () => {},
    getSelectedSection: () => dom.secEls[0],
    addTextBlock: () => {},           // 아무것도 안 만든다
  };
  const res = await runText(dom, win, { sectionId: '"sec_1"' });
  assert.equal(res.ok, false);
  assert.equal(res.code, 'NO_SECTION');
});

/* ── add_gap_block ───────────────────────────────────────────────────────── */

test('add_gap_block — 반환 gapBlockId 가 «맨 끝 섹션의 하단 패딩 갭»이 아니라 새 갭이다', async () => {
  // 갭은 섹션마다 상·하 패딩 갭이 있어 「문서순 마지막」이 «항상» 맨 끝 섹션 것이었다.
  const dom = makeDom([
    { id: 'sec_1', blocks: [{ id: 'gb_s1_top', cls: 'gap-block' }, { id: 'gb_s1_bottom', cls: 'gap-block' }] },
    { id: 'sec_2', blocks: [{ id: 'gb_s2_top', cls: 'gap-block' }, { id: 'gb_s2_bottom', cls: 'gap-block' }] },
  ]);
  let selected = null;
  const win = {
    selectSection: el => { selected = el; },
    addGapBlock: () => { const s = selected; s.blocks.splice(1, 0, dom.mkBlock('gb_new', 'gap-block', s)); },
  };
  const res = await runGap(dom, win, { sectionId: '"sec_1"', h: 40 });
  assert.equal(res.ok, true);
  assert.equal(res.gapBlockId, 'gb_new');
  assert.notEqual(res.gapBlockId, 'gb_s2_bottom', '문서순 마지막 갭을 돌려주면 결함 재발');
  assert.equal(res.sectionId, 'sec_1');
});

test('add_gap_block — 갭이 안 늘면 NO_SECTION (예전엔 ok:true + 남의 id 였다)', async () => {
  const dom = makeDom([{ id: 'sec_1', blocks: [{ id: 'gb_only', cls: 'gap-block' }] }]);
  const win = { selectSection: () => {}, addGapBlock: () => {} };
  const res = await runGap(dom, win, { sectionId: '"sec_1"', h: 40 });
  assert.equal(res.ok, false);
  assert.equal(res.code, 'NO_SECTION');
  assert.equal(res.gapBlockId, undefined, '실패인데 손잡이를 실어 보내면 안 된다');
});
