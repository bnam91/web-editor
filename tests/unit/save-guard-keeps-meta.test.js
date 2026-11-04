/* save-guard-keeps-meta — 동기 저장(새로고침·닫기)이 앞 파일의 칸을 지운다 (시트 SAVE-DROPS-MARKETREF-FROM-PROJ-JSON-01)
 * 왜: 동기 저장은 serializeProject 그대로 보내고 _guardProjectName 은 createdAt·type 만 지켜, 마켓 받은 프로젝트의 marketRef 가
 *     사라졌다(앱 3/3). 그러면 마켓 목록의 최신 배지와 머지 단추가 사라진다.
 * 변이: 가드를 옛 판(createdAt·type 만)으로 되돌리면 SG1·SG2·IPC 칸이 빨강. */
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
const dir = mkTmpRoot('gdmeta-');
let n = 0;
const prev = (o) => { const f = path.join(dir, `p${n++}.json`); fs.writeFileSync(f, JSON.stringify(o)); return f; };
const REF = { account: 'a', id: 'm', version: 'v1' };

test('SG1 들어온 판에 없으면 marketRef 를 남긴다', () => {
  assert.deepStrictEqual(guard({ id: 'p', name: 'n' }, prev({ name: 'n', marketRef: REF })).marketRef, REF);
});
test('SG2 칸 이름을 가리지 않는다 — 처음 보는 칸도 남고 null 로 와도 남는다', () => {
  const r = guard({ id: 'p', name: 'n', marketRef: null }, prev({ name: 'n', marketRef: REF, someKey: 'K' }));
  assert.deepStrictEqual([r.marketRef, r.someKey], [REF, 'K']);
});
test('[음성] 들어온 값이 이긴다 · createdAt·type 그대로', () => {
  const r = guard({ id: 'p', name: 'n', marketRef: { version: 'v2' } }, prev({ name: 'n', marketRef: REF, createdAt: 'C', type: 'T' }));
  assert.deepStrictEqual([r.marketRef.version, r.createdAt, r.type], ['v2', 'C', 'T']);
});
test('[음성] _meta.json 으로 옮긴 칸·런타임 표식은 되살리지 않는다', () => {
  const r = guard({ id: 'p', name: 'n' }, prev({ name: 'n', branches: {}, commits: [], currentBranch: 'dev', thumbnail: 't', _recovered: true, _healed: true, _healError: 'e', _recoveredAt: 1, _recoveredAtLabel: 'l' }));
  assert.deepStrictEqual(Object.keys(r).sort(), ['id', 'name']);
});
test('[음성] 앞 파일이 없으면 칸을 지어내지 않는다 · 객체가 아니면 펼치지 않는다', () => {
  assert.strictEqual(guard({ id: 'p', name: 'n', createdAt: 'C' }, path.join(dir, '없음.json')).marketRef, undefined);
  assert.deepStrictEqual(Object.keys(guard({ id: 'p', name: 'n' }, prev('proj_1'))).sort(), ['id', 'name']);
  assert.deepStrictEqual(Object.keys(guard({ id: 'p', name: 'n' }, prev(['x']))).sort(), ['id', 'name']);
});
test('뺄 칸 사본이 proj-merge 와 같다', () => {
  const list = (src, re) => JSON.parse(re.exec(src)[1].replace(/'/g, '"'));
  const PM = readSrc(REPO, 'js/io/proj-merge.js');
  const want = [...list(PM, /PROJ_META_KEYS = (\[[^\]]*\])/), ...list(PM, /PROJ_RUNTIME_KEYS = (\[[^\]]*\])/)];
  assert.deepStrictEqual(list(SRC, /const notKept = new Set\((\[[^\]]*\])\)/).sort(), want.sort());
});

const H = loadMain();
const readProj = (id) => JSON.parse(fs.readFileSync(path.join(H.projectsDir, id, 'proj.json'), 'utf8'));
const snap = (id, name) => ({ id, name, version: 2, currentPageId: 'page_1', updatedAt: '2026-11-04T00:00:00.000Z', pages: [{ id: 'page_1', name: 'Page 1', canvas: '<div class="section-block" id="s2"></div>' }] });

for (const [route, send] of [['save', (p) => H.invoke('projects:save', p)], ['save-sync', (p) => H.invokeSync('projects:save-sync', {}, p)]]) {
  test(`IPC ${route} — marketRef 가 파일·목록에 남고 내용은 새것`, async () => {
    const id = 'proj_17878' + (route === 'save' ? '00001' : '00002');
    await H.invoke('projects:save', { ...snap(id, '받은글'), marketRef: REF, type: 'T' });
    await send(snap(id, '받은글'));
    const d = readProj(id);
    assert.deepStrictEqual(d.marketRef, REF, '★파일에서 빠졌다');
    assert.strictEqual(d.type, 'T');
    const item = (await H.invoke('projects:list')).find((x) => x.id === id);
    assert.deepStrictEqual(item.marketRef, REF, '★목록(최신 배지의 재료)에서 빠졌다');
    assert.ok(JSON.stringify(d.pages).includes('s2'));
  });
}
