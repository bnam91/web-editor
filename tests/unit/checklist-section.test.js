/* ★체크리스트 «섹션» 배선 검사 (2026-09-07 현빈 요청: 투두 추가·완수·섹션명 지정. 핀은 제외).
   실측(격리 9370): 섹션 2개 생성 → 투두 3개(2개는 섹션 지정) → 완료 토글 →
     패널 화면에 「진행바 1/3 33%」 + 섹션 헤더 + ✔ 가 «실제로 그려졌고»,
     프로젝트 파일(디스크)에도 checklistSections/checklistItems 로 남았다.

   ⛔이 파일이 지키는 «가장 큰 것» = 이름이 겹치는 두 개념을 «섞지 않는 것».
     · add_checklist_item 의 sectionId = «캔버스 섹션»(sec_) — 핀 좌표용
     · item.sectionId                  = «체크리스트 섹션»(ck_) — 패널 분류용
     섞이면 「분류했다」고 믿는데 실제로는 아무 일도 안 나는 상태가 된다. */
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { readSrc } = require('./_srcread.js');   // ⛔CRLF — win-portability ①-3
const { sliceBlock } = require('./_slice-block.js');   // ★구간 떠내기는 «공용 부품»(_slice-block.js) 하나로 — ⛔여기서 자를 새로 만들지 마라(끝은 «균형괄호»로 찾는다)

const ROOT = path.join(__dirname, '..', '..');
const DATA = readSrc(ROOT, 'js', 'checklist-data.js');
const PANEL = readSrc(ROOT, 'js', 'checklist-panel.js');
const MAIN = readSrc(ROOT, 'main.js');
const SRV = readSrc(ROOT, 'main', 'claude-pm', 'mcp-server.js');
const codeOnly = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

test('K0 ★양성대조 — 앱 패널이 «정말» 그 규칙을 쓰나 (전제부터)', () => {
  assert.match(PANEL, /sections\.push\(\{ id: genCkId\(\), name, collapsed: false \}\)/,
    '패널의 섹션 생성 모양이 바뀌었다 — 우리 API 가 «두 번째 규칙»이 됐다는 뜻이다');
  assert.match(PANEL, /it\.sectionId === sec\.id \? \{ \.\.\.it, sectionId: null \}/,
    '패널의 섹션 삭제는 «항목을 살린다» — 이 전제가 깨지면 우리 delete 도 다시 봐야 한다');
});

test('K1 섹션 CRUD 가 window 로 나와 있다', () => {
  for (const fn of ['listChecklistSections', 'addChecklistSection',
                    'renameChecklistSection', 'deleteChecklistSection']) {
    assert.match(DATA, new RegExp(`window\\.${fn} = function`), `${fn} 이 없다`);
  }
});

test('K2 섹션 삭제는 «항목을 안 지운다» — 섹션만 뗀다(앱과 같은 규칙)', () => {
  /* ★2026-09-09 — 여기 자는 `\n};` «만» 찾았다. 지금 이 구간은 실제로 `};` 로 끝나서
     «맞게» 재고 있었지만(실측 13줄, 진짜 14줄 — 차이는 닫는 `}` 포함 여부뿐),
     이 함수가 `function deleteChecklistSection(…) { … }` 선언으로 바뀌는 날 끝을 «영영»
     못 찾고 −1 이 되어 `slice(i, -1)` 이 파일 끝까지 삼킨다. 꼬리 모양에 안 걸리게 센다. */
  const body = sliceBlock(DATA, 'window.deleteChecklistSection');
  assert.match(body, /sectionId === id \? \{ \.\.\.it, sectionId: null \}/,
    '항목을 지우면 앱과 «다른» 동작이 된다 — 사람이 투두를 잃는다');
  assert.match(body, /detachedItems/, '몇 개가 떨어졌는지 말해 줘야 한다');
});

test('K3 ★없는 섹션이면 «조용히 null» 로 가지 않고 거절한다 (add·update 양쪽)', () => {
  const add = DATA.slice(DATA.indexOf('window.addChecklistItem'), DATA.indexOf('window.listChecklistItems'));
  assert.match(add, /SECTION_NOT_FOUND/, 'add 가 없는 섹션을 조용히 삼킨다');
  const upd = DATA.slice(DATA.indexOf('window.updateChecklistItem'), DATA.indexOf('window.addChecklistItem'));
  assert.match(upd, /SECTION_NOT_FOUND/, 'update 가 없는 섹션을 조용히 삼킨다');
});

test('K4 ★두 «섹션» 개념을 접두로 가른다 — ck_ 아닌 것은 거절', () => {
  const src = codeOnly(SRV);
  const hits = [...src.matchAll(/invalid ckSectionId/g)];
  assert.ok(hits.length >= 2, `ckSectionId 접두 검사가 ${hits.length}곳뿐 — add·update 양쪽에 있어야 한다`);
  assert.match(src, /startsWith\('ck_'\)/, 'ck_ 접두 검사가 없다');
});

test('K5 ★「영원히 0건」이던 죽은 필터를 «거절»로 바꿨다', () => {
  /* ⛔`indexOf("'list_checklist_items'")` 는 «_TARGET_FREE 목록»의 첫 등장을 집는다 —
       도구 «등록부»가 아니다. 그 자리를 재면 검사가 엉뚱한 곳을 보고 빨개진다(실제로 그랬다). */
  const i = SRV.indexOf("registerTool(\n    'list_checklist_items'");
  assert.ok(i > 0, '도구 등록부를 못 찾았다 — 패턴이 썩었다');
  const seg = SRV.slice(i, i + 2500);
  assert.match(seg, /sectionId is not a filter here/,
    '옛 sectionId 필터는 sec_ 만 받는데 항목은 ck_ 를 저장해 «항상 0건»이었다 — 0건은 「없다」로 읽힌다');
});

test('K6 add 브리지가 «거절 객체»를 itemId 로 싣지 않는다', () => {
  const body = sliceBlock(MAIN, 'async function _invokeRendererAddChecklistItem');
  assert.match(body, /if \(typeof r !== 'string'\)/,
    'addChecklistItem 은 거절 시 «객체»를 준다 — 그대로 itemId 에 담으면 거짓 성공이다');
});

test('K7 섹션 삭제는 confirm 게이트를 탄다', () => {
  const i = SRV.indexOf("'edit_checklist_section'");
  const seg = SRV.slice(i, i + 2600);
  assert.match(seg, /CONFIRM_REQUIRED/, '확인 없이 지워지면 안 된다');
  assert.match(seg, /TODOS SURVIVE/, '「투두는 살아남는다」를 안 알리면 필요한 정리를 못 한다');
});

test('K8 ★변이대조 — ck_ 접두 검사를 빼면 K4 가 빨개져야 한다', () => {
  const mutated = codeOnly(SRV).replace(/invalid ckSectionId/g, 'whatever');
  const hits = [...mutated.matchAll(/invalid ckSectionId/g)];
  assert.equal(hits.length, 0, '변이가 안 먹었다 = K4 는 이 배선을 «안» 본다');
});
