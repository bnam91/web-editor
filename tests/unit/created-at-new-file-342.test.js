/* created-at-new-file-342 — 새로 생기는 프로젝트 파일에 createdAt 이 빠지지 않는다 (J342A · 시트 342)
 * 왜: 스냅샷에는 이 칸이 없다. 앞 파일이 없으면 지킬 값도 없어 마켓 받기·휴지통 뒤 자동저장이 비운 채 만들었다(앱 값 ~/gd-lane/imac-gd-L1/342d).
 * 칸: 새 파일 — 찍는다 · 준 값은 그대로 · [음성] 앞 파일 값 지킴 · [음성] 앞 파일이 비었으면 안 채운다(언제 만들었는지 모른다) · 이름 가드 그대로.
 * 변이: main.js 의 찍는 줄을 빼면 첫 칸만 빨강. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { readSrc } = require('./_srcread.js');
const { sliceBlock } = require('./_slice-block.js');
const { mkTmpRoot } = require('./_tmproot.js');

const REPO = path.join(__dirname, '..', '..');
const SRC = readSrc(REPO, 'main.js');
const body = sliceBlock(SRC, 'function _guardProjectName(', '_guardProjectName 을 못 찾았다');
const guard = vm.runInNewContext(`(${body})`, { fs, console, Date });
const dir = mkTmpRoot('gd342-');
test.after(() => fs.rmSync(dir, { recursive: true, force: true }));
const prevFile = (name, obj) => { const f = path.join(dir, name); fs.writeFileSync(f, JSON.stringify(obj)); return f; };

test('새 파일 — createdAt 을 찍는다', () => {
  const r = guard({ id: 'p', name: 'x', pages: [] }, path.join(dir, '없음.json'));
  assert.ok(typeof r.createdAt === 'string' && !Number.isNaN(Date.parse(r.createdAt)), '★새 파일에 createdAt 이 비었다');
  const r2 = guard({ id: 'p', name: 'x', pages: [] }, null);
  assert.ok(r2.createdAt, '★경로 없을 때 비었다');
});
test('새 파일 — 준 값은 그대로', () => {
  assert.strictEqual(guard({ id: 'p', createdAt: 'C0' }, null).createdAt, 'C0');
});
test('[음성] 앞 파일 값을 지킨다', () => {
  assert.strictEqual(guard({ id: 'p', name: 'x' }, prevFile('a.json', { id: 'p', name: 'x', createdAt: 'C1' })).createdAt, 'C1');
});
test('[음성] 앞 파일이 비었으면 안 채운다', () => {
  assert.strictEqual(guard({ id: 'p', name: 'x' }, prevFile('b.json', { id: 'p', name: 'x' })).createdAt, undefined);
});
test('[음성] 이름 가드 그대로', () => {
  assert.strictEqual(guard({ id: 'p', name: 'Untitled' }, prevFile('c.json', { id: 'p', name: '진짜', createdAt: 'C2' })).name, '진짜');
});
