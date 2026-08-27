/* preload ↔ main 배선 하네스 — 「렌더러가 부르는 그 이름」이 「main 이 등록한 그 채널」에 닿는가.
 * 실행: node --test "tests/unit/*.test.js"
 *
 * ★여기서 잡히는 것: 노출 이름 오타 · 채널 문자열 오타 · 인자 «모양» 불일치 · 미등록 채널.
 *   이것들은 코드를 읽으면 「맞아 보이고», 단위테스트가 main 쪽만 보면 전부 통과한다.
 *   실제로 렌더러에서 한 번 눌러야 드러나던 부류다.
 *
 * ★막힌 것처럼 보일 때 «무엇이 진짜 필요한가»를 다시 쪼갠다:
 *   이 검증에 필요한 건 «GODITOR 앱»이 아니라 «preload.js 를 실제로 적재하는 것»뿐이다.
 *   contextBridge/ipcRenderer 를 스텁으로 주고 preload 를 require 하면, 렌더러가 보게 될
 *   window.electronAPI 객체 «그 자체»가 손에 들어온다. 거기서 main 의 진짜 핸들러로 이어 붙인다.
 *   ⇒ 렌더러 → preload → main 왕복이 node 안에서 «진짜 코드»로 성립한다.
 *
 * ⚠️ 이걸로도 못 보는 것: Electron 이 창을 만들 때 그 preload 를 실제로 물리는지
 *   (webPreferences.preload, main.js:245). 그건 정적으로만 확인하고 아래 BR6 에 남긴다.
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { loadMain } = require('./_ipc-harness');

// 1) main.js 를 먼저 적재해 진짜 핸들러를 잡는다(이 과정에서 require.cache['electron'] 가 세팅된다).
const H = loadMain();
const DIR = H.projectsDir;

// 2) 같은 electron 스텁에 contextBridge/ipcRenderer 를 «덧붙여» preload 를 진짜로 적재한다.
const el = require.cache['electron'].exports;
const invoked = [];
let exposedName = null, API = null;
el.contextBridge = { exposeInMainWorld: (name, api) => { exposedName = name; API = api; } };
el.ipcRenderer = {
  invoke: (channel, ...args) => { invoked.push({ channel, args }); return H.invoke(channel, args[0]); },
  send: () => {}, sendSync: () => ({ ok: true }), on: () => {}, removeListener: () => {},
};
require(path.join(__dirname, '../../preload.js'));

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const sec = (id, name, inner) =>
  `<div class="section-block" id="${id}" data-name="${name}"><div class="section-inner">${inner || ''}</div></div>`;
let seq = 0;
async function mkProject(canvas) {
  const id = `proj_${1787700000000 + (seq++) * 1000}`;
  await API.saveProject({ id, name: '브리지시험', version: 2, currentPageId: 'page_1',
    pages: [{ id: 'page_1', name: 'Page 1', canvas }], checklistItems: [] });
  return id;
}

test('BR0 preload 가 window.electronAPI 를 노출하고 history 4종이 «그 안에» 있다', () => {
  assert.equal(exposedName, 'electronAPI');
  for (const k of ['historyList', 'historyRead', 'historyDiffPayload', 'historyOpenCopy']) {
    assert.equal(typeof API[k], 'function', `★${k} 가 렌더러에 노출되지 않았다`);
  }
});

test('BR1 ★렌더러가 부르는 이름이 «main 이 등록한 채널»에 닿는다 (오타는 여기서 죽는다)', async () => {
  const id = await mkProject(sec('sec_a', 'A'));
  invoked.length = 0;
  await API.historyList({ projectId: id });
  await API.historyRead({ projectId: id, ts: 1 });
  await API.historyDiffPayload({ projectId: id, ts: 1 });
  const channels = invoked.map(x => x.channel);
  assert.deepEqual(channels,
    ['projects:history-list', 'projects:history-read', 'projects:history-diff-payload']);
  for (const c of channels) assert.ok(H.has(c), `★main 에 ${c} 핸들러가 없다 — 렌더러에선 조용히 undefined 가 온다`);
});

test('BR2 ★인자 «모양»이 맞는다 — preload 가 객체를 통째로 넘겨야 main 의 구조분해가 먹는다', async () => {
  const id = await mkProject(sec('sec_a', 'A'));
  invoked.length = 0;
  await API.historyRead({ projectId: id, ts: 12345 });
  assert.deepEqual(invoked[0].args, [{ projectId: id, ts: 12345 }],
    '★위치인자로 넘기면 main 이 { projectId } 를 못 뽑아 조용히 unavailable 을 돌려준다');
});

test('BR3 ★렌더러 → preload → main 왕복이 «진짜로» 성립한다 (실제 값이 돌아온다)', async () => {
  const id = await mkProject(sec('sec_a', '혜택정리', `<img src="${PNG}">`) + sec('sec_b', 'FAQ'));
  const l = await API.historyList({ projectId: id });
  assert.equal(l.ok, true);
  assert.equal(l.entries.length, 1);
  assert.deepEqual(l.entries[0].secs.map(s => s.n), ['혜택정리', 'FAQ']);

  const r = await API.historyRead({ projectId: id, ts: l.entries[0].ts });
  assert.equal(r.ok, true);
  assert.ok(JSON.stringify(r.data).includes('FAQ'));

  const d = await API.historyDiffPayload({ projectId: id, ts: l.entries[0].ts });
  assert.equal(d.ok, true);
  assert.ok(!JSON.stringify(d.curCanvas).includes('data:image'), '양쪽이 정규형으로 와야 한다');
});

test('BR4 ★사본으로 열기도 브리지를 타고 «끝까지» 간다 — 새 프로젝트가 실제로 생긴다', async () => {
  const id = await mkProject(sec('sec_a', '혜택정리', `<img src="${PNG}">`) + sec('sec_b', 'FAQ'));
  const ts = (await API.historyList({ projectId: id })).entries[0].ts;
  await API.saveProject({ id, name: '브리지시험', version: 2, currentPageId: 'page_1',
    pages: [{ id: 'page_1', name: 'Page 1', canvas: sec('sec_a', '혜택정리') }] }); // 사고: FAQ 소실

  const r = await API.historyOpenCopy({ projectId: id, ts });
  assert.equal(r.ok, true, JSON.stringify(r));
  const copy = JSON.parse(fs.readFileSync(path.join(DIR, r.newProjectId, 'proj.json'), 'utf8'));
  assert.ok(copy.pages[0].canvas.includes('FAQ'), '★잃었던 섹션이 사본에 있어야 한다');
  assert.ok(copy.pages[0].canvas.includes(`goya-asset://${r.newProjectId}/`));

  // 그리고 사본이 «목록 API»에도 보인다 — 렌더러가 갤러리를 다시 그리면 뜬다
  const list = await API.listProjects();
  assert.ok(list.some(p => p.id === r.newProjectId), '★사본이 프로젝트 목록에 안 보이면 사용자는 못 찾는다');
});

test('BR5 파괴 채널이 열렸고, «판별 불가면 거부»가 브리지에서도 성립한다', async () => {
  assert.equal(typeof API.historyRestore, 'function', 'U6b 채널(현빈 Q2 확정 + U6a 초록 뒤 개방)');
  for (const k of ['historySnapshotNow', 'historyPrune', 'historyDelete']) {
    assert.equal(API[k], undefined, `★${k} 는 승인된 적이 없다`);
  }
  // ★브리지를 타고도 «추측하고 덮지» 않는다 — openProjectIds 없이 부르면 거부여야 한다
  const id = await mkProject(sec('sec_a', 'A') + sec('sec_b', 'B'));
  const ts = (await API.historyList({ projectId: id })).entries[0].ts;
  const before = fs.readFileSync(path.join(DIR, id, 'proj.json'));
  const r = await API.historyRestore({ projectId: id, ts });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'unknown_open_state');
  assert.ok(before.equals(fs.readFileSync(path.join(DIR, id, 'proj.json'))), '거부했는데 파일이 바뀌었다');
});

test('BR6 창이 «이» preload 를 물고 있다 (정적 확인 — 이건 node 에서 실행으로 못 잰다)', () => {
  const src = fs.readFileSync(path.join(__dirname, '../../main.js'), 'utf8');
  assert.match(src, /preload:\s*path\.join\(__dirname,\s*'preload\.js'\)/,
    '★webPreferences.preload 가 이 파일을 안 가리키면 위 전부가 무의미하다');
});

test('BR7 브리지가 예외를 렌더러로 던지지 않는다 — 잘못된 인자에도 «객체»로 답한다', async () => {
  for (const args of [{}, { projectId: '' }, { projectId: 'p', ts: '../x' }]) {
    for (const k of ['historyList', 'historyRead', 'historyDiffPayload']) {
      const r = await API[k](args);
      assert.equal(typeof r, 'object', `${k}(${JSON.stringify(args)}) 가 객체를 안 줬다`);
    }
  }
});
