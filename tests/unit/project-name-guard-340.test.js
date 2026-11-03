/* project-name-guard-340 — 있는 파일의 이름은 저장으로 안 바뀌고 이름 바꾸기로만 바뀐다 (시트 340 A)
 * 왜: 자동저장은 읽어 둔 옛 이름을, 동기 저장은 묵은 탭 이름을 들고 와 그 사이 바뀐 이름을 되돌렸다.
 * 칸: 다른 이름 저장 — 앞 이름 · 표식 있으면 통과 · 표식은 파일에 안 남음 · [음성] 앞 이름이 Untitled·없음이면 받음 · [음성] 앞 파일 없음 · 복원·IPC 왕복.
 * 변이: _guardProjectName 조건을 옛 판으로 되돌리면 첫 칸·복원 칸이 빨강. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { readSrc } = require('./_srcread.js');
const { sliceBlock } = require('./_slice-block.js');
const { mkTmpRoot } = require('./_tmproot.js');
const { loadMain } = require('./_ipc-harness');

const REPO = path.join(__dirname, '..', '..');
const SRC = readSrc(REPO, 'main.js');
const guard = vm.runInNewContext(`(${sliceBlock(SRC, 'function _guardProjectName(', '못 찾았다')})`, { fs, console: { warn() {} }, Date, Symbol, JSON });
const dir = mkTmpRoot('gd340a-');
const prevFile = (n, o) => { const f = path.join(dir, n); fs.writeFileSync(f, JSON.stringify(o)); return f; };
const INTENT = Symbol.for('goditor.renameIntent');

test('다른 이름 저장 — 앞 이름을 지킨다', () => {
  assert.strictEqual(guard({ id: 'p', name: '옛탭이름' }, prevFile('a.json', { name: '새이름' })).name, '새이름');
});
test('표식 있는 저장만 이름을 바꾼다 · Untitled 도 받는다', () => {
  const f = prevFile('b.json', { name: '앞' });
  assert.strictEqual(guard({ id: 'p', name: '뒤', [INTENT]: true }, f).name, '뒤');
  assert.strictEqual(guard({ id: 'p', name: 'Untitled', [INTENT]: true }, f).name, 'Untitled');
});
test('표식은 파일에 안 남는다', () => {
  assert.ok(!JSON.stringify(guard({ id: 'p', name: '뒤', [INTENT]: true }, prevFile('c.json', { name: '앞' }))).includes('Intent'));
});
test('[음성] 앞 이름이 Untitled·없음이면 들어온 이름을 받는다', () => {
  assert.strictEqual(guard({ id: 'p', name: '첫이름' }, prevFile('d.json', { name: 'Untitled' })).name, '첫이름');
  assert.strictEqual(guard({ id: 'p', name: '첫이름' }, prevFile('e.json', {})).name, '첫이름');
});
test('[음성] 앞 파일이 없으면 들어온 이름 그대로 · 같은 이름 그대로 · 빈 이름은 앞 이름', () => {
  assert.strictEqual(guard({ id: 'p', name: '새' }, path.join(dir, '없음.json')).name, '새');
  assert.strictEqual(guard({ id: 'p', name: '같음' }, prevFile('f.json', { name: '같음' })).name, '같음');
  assert.strictEqual(guard({ id: 'p' }, prevFile('g.json', { name: '앞' })).name, '앞');
});
test('[음성] 이름이 지켜져도 createdAt·type 지킴은 그대로', () => {
  const r = guard({ id: 'p', name: '옛' }, prevFile('h.json', { name: '앞', createdAt: 'C', type: 'T' }));
  assert.deepStrictEqual([r.name, r.createdAt, r.type], ['앞', 'C', 'T']);
});

const H = loadMain();
const readProj = (id) => JSON.parse(fs.readFileSync(path.join(H.projectsDir, id, 'proj.json'), 'utf8'));
const proj = (id, name, tag) => ({ id, name, version: 2, currentPageId: 'page_1', pages: [{ id: 'page_1', name: 'Page 1', canvas: `<div class="section-block" id="${tag}"></div>` }] });

test('IPC — projects:rename 은 바꾸고, 다른 이름 projects:save 는 못 바꾼다 · 내용은 남는다', async () => {
  const id = 'proj_1787800000001';
  await H.invoke('projects:save', proj(id, '처음', 's1'));
  const r = await H.invoke('projects:rename', { projectId: id, name: '둘째' });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(readProj(id).name, '둘째');
  assert.strictEqual(r.updatedAt, readProj(id).updatedAt, '★표시를 옮길 판이 파일과 다르다');
  await H.invoke('projects:save', proj(id, '처음', 's2'));
  const d = readProj(id);
  assert.strictEqual(d.name, '둘째', '★저장이 옛 이름으로 되돌렸다');
  assert.ok(JSON.stringify(d.pages).includes('s2'), '★내용이 안 들어갔다');
});
test('복원(안 열림) — 옛 이름이 든 스냅샷으로 되돌려도 지금 이름이 남는다 · 내용은 되돌아간다', async () => {
  const id = 'proj_1787800000002';
  await H.invoke('projects:save', proj(id, '옛이름', 'old'));
  const ts = (await H.invoke('projects:history-list', { projectId: id })).entries[0].ts;
  const read = await H.invoke('projects:history-read', { projectId: id, ts });
  assert.strictEqual(read.data.name, '옛이름', '★전제: 스냅샷에 옛 이름이 없다');
  await H.invoke('projects:rename', { projectId: id, name: '지금이름' });
  await H.invoke('projects:save', proj(id, '지금이름', 'now'));
  const r = await H.invoke('projects:history-restore', { projectId: id, ts, openProjectIds: [] });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.applyInRenderer, false);
  const d = readProj(id);
  assert.strictEqual(d.name, '지금이름', '★복원이 이름을 되돌렸다');
  assert.ok(JSON.stringify(d.pages).includes('old'), '★내용이 안 되돌아갔다');
});

test('100자 초과 — 그대로 두면 통과 · 다른 긴 이름은 거절 · 이름 안 바뀜', async () => {
  const id = 'proj_1787800000003';
  const long = '가'.repeat(120);
  await H.invoke('projects:save', proj(id, long, 's1'));
  const same = await H.invoke('projects:rename', { projectId: id, name: long });
  assert.strictEqual(same.ok, true, '★눌렀다 나가기만 했는데 실패했다');
  assert.strictEqual(same.changed, false);
  const other = await H.invoke('projects:rename', { projectId: id, name: '나'.repeat(101) });
  assert.strictEqual(other.ok, false);
  assert.strictEqual(other.code, 'invalid');
  assert.strictEqual(readProj(id).name, long);
});
test('[음성] 100자 이름은 받는다', async () => {
  const id = 'proj_1787800000004';
  await H.invoke('projects:save', proj(id, '짧음', 's1'));
  const r = await H.invoke('projects:rename', { projectId: id, name: '다'.repeat(100) });
  assert.strictEqual(r.ok, true);
});

