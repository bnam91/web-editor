/* mcp-checklist-list-delete.test.js — 새로 추가한 window.listChecklistItems / window.deleteChecklistItem 단위테스트.
 *
 * ★js/checklist-data.js는 순수 「plain 글로벌 스크립트」다(document 미사용, window._ckItems 배열 하나가
 *   전부) — 그래서 jsdom·Electron 없이도 window를 최소 스텁으로 주고 require()만 하면 진짜 코드를 돌릴 수 있다.
 *   (goditor MCP 서버/렌더러 브리지는 이 테스트 범위 밖 — main.js의 IPC 브리지·mcp-server.js의 도구 등록은
 *    Electron app.whenReady() 뒤에서만 배선되고, 테스트 하네스(_ipc-harness.js)도 whenReady를 pending으로
 *    묶어놔서 거기까지는 안 닿는다. 이 파일은 「렌더러가 실제로 만지는 배열 CRUD」만 검증한다.)
 *
 * INV-B3/B1 결손 #2 — add_checklist_item/update_checklist_item만 있고 list/delete가 없어서,
 *   대화가 끊겨 ck_xxx id를 잊으면 만든 항목을 다시 찾지도 지우지도 못했다.
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

function freshChecklist() {
  // 모듈 캐시를 비워 매 테스트마다 독립된 window._ckItems로 시작한다.
  const p = require.resolve('../../js/checklist-data.js');
  delete require.cache[p];
  global.window = { triggerAutoSave: () => {} };
  require(p);
  return global.window;
}

test('list_checklist_items — 방금 add한 항목이 list에 그대로 보인다', () => {
  const win = freshChecklist();
  const id = win.addChecklistItem({ text: '섹션1 검수 필요', urgent: true });
  const items = win.listChecklistItems();
  assert.equal(items.length, 1);
  assert.equal(items[0].id, id);
  assert.equal(items[0].text, '섹션1 검수 필요');
  assert.equal(items[0].urgent, true);
});

test('list_checklist_items — includeDone:false는 완료 항목을 뺀다', () => {
  const win = freshChecklist();
  const doneId = win.addChecklistItem({ text: '이미 끝', done: true });
  const openId = win.addChecklistItem({ text: '아직' });
  const all = win.listChecklistItems();
  const openOnly = win.listChecklistItems({ includeDone: false });
  assert.equal(all.length, 2);
  assert.equal(openOnly.length, 1);
  assert.equal(openOnly[0].id, openId);
  assert.ok(!openOnly.some(it => it.id === doneId));
});

test('list_checklist_items — 반환 배열을 고쳐도 원본(window._ckItems)은 안 바뀐다(방어적 복사)', () => {
  const win = freshChecklist();
  win.addChecklistItem({ text: 'a' });
  const items = win.listChecklistItems();
  items.pop(); // 호출측이 실수로 배열을 비워도
  assert.equal(win.listChecklistItems().length, 1); // 원본은 그대로
});

test('delete_checklist_item — 지우면 list에서 사라지고 삭제된 item을 돌려준다', () => {
  const win = freshChecklist();
  const id = win.addChecklistItem({ text: '지울 항목' });
  const res = win.deleteChecklistItem({ id });
  assert.equal(res.ok, true);
  assert.equal(res.itemId, id);
  assert.equal(res.item.text, '지울 항목');
  assert.equal(win.listChecklistItems().length, 0);
});

test('delete_checklist_item — 없는 id는 NOT_FOUND, 다른 항목은 안 건드린다', () => {
  const win = freshChecklist();
  win.addChecklistItem({ text: '살아남을 항목' });
  const res = win.deleteChecklistItem({ id: 'ck_nope' });
  assert.equal(res.ok, false);
  assert.equal(res.code, 'NOT_FOUND');
  assert.equal(win.listChecklistItems().length, 1);
});

test('delete_checklist_item — id 누락은 BAD_ARGS', () => {
  const win = freshChecklist();
  const res = win.deleteChecklistItem({});
  assert.equal(res.ok, false);
  assert.equal(res.code, 'BAD_ARGS');
});

test('list + delete — id를 잊어도 list로 다시 찾아 지울 수 있다(결손 #2가 노리던 왕복)', () => {
  const win = freshChecklist();
  win.addChecklistItem({ text: 'sp_abc123 출처 — 이 섹션은 스크래치 원본 참조' });
  const found = win.listChecklistItems().find(it => it.text.includes('sp_abc123'));
  assert.ok(found, 'list로 다시 찾아져야 한다');
  const res = win.deleteChecklistItem({ id: found.id });
  assert.equal(res.ok, true);
  assert.equal(win.listChecklistItems().length, 0);
});
