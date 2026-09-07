/* mcp-project-gate.test.js — ★「어느 프로젝트인지 정해지기 «전»엔 쓰기 도구가 안 돈다」
 *
 * 왜 있나(2026-09-07, 현빈 실사용 사고): 「고디터」라고 말한 적도, 어느 프로젝트인지 정한 적도
 *   없는데 add_section 이 그냥 «열려 있던 실사용 프로젝트»에 들어갔다. 원인은 프로토콜이다 —
 *   부작용 도구 24개가 «필수 인자 0개»이고 전부 활성 프로젝트에 쓴다.
 *
 * ★재는 자리 = «서버»다(앱 밖 HTTP). Electron 없이 mcp-server.js 를 그대로 require 해서
 *   진짜 디스패처(_handleRpc)를 HTTP 로 두드린다 — 게이트가 «디스패처 한 곳»에 있으므로
 *   도구 하나하나가 아니라 여기서 재야 배선이 실제로 걸렸는지 보인다.
 * ⛔포트는 9345~9365 «밖»(그 대역은 실사용 goditor·CDP 관행 포트와 겹친다).
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');

const srv = require('../../main/claude-pm/mcp-server.js');
/* ★로그인 프로브를 «꽂는다» — 2026-09-07 부터 인증 게이트가 fail-closed 다(못 재면 거절).
   예전엔 미주입이 «통과»라 안 꽂아도 돌았는데, 그 관대함이 곧 「게이트가 증발하는 경로」였다
   (프로브와 게이트는 «같은 바이너리»라 「버전이 낡아 주입이 없다」는 논거가 성립하지 않는다).
   ⛔이 줄을 지우면 도구들이 AUTH_PROBE_MISSING 으로 죽는다 — 회귀가 아니라 정직한 신호다. */
srv.setAuthProbe(() => ({ authed: true }));


const PORT = 9411;                    // ⛔9345~9365 밖
let ACTIVE = null;                    // 「편집기에 열려 있는 프로젝트」 — 테스트가 사람 역할을 한다
let started = null;
let CALLS = 0;                        // 왕복 비용 측정용

const PROJECTS = [
  { id: 'proj_1000000000001', name: '현빈 실사용 상세페이지' },
  { id: 'proj_1000000000002', name: '테스트 픽스처' },
];

function rpc(method, params) {
  CALLS++;
  const body = JSON.stringify({ jsonrpc: '2.0', id: CALLS, method, params });
  return new Promise((resolve, reject) => {
    const req = http.request({
      host: '127.0.0.1', port: started.port, path: '/mcp', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goditor-token': started.token, 'Content-Length': Buffer.byteLength(body) },
    }, (res) => {
      let out = '';
      res.on('data', c => { out += c; });
      res.on('end', () => { try { resolve(JSON.parse(out)); } catch (e) { reject(new Error(`bad response: ${out.slice(0, 200)}`)); } });
    });
    req.on('error', reject);
    req.end(body);
  });
}

/** tools/call 의 «도구 응답»(content[0].text 안의 JSON)만 꺼낸다. */
async function call(name, args = {}) {
  const r = await rpc('tools/call', { name, arguments: args });
  if (r.error) return { ok: false, _rpcError: r.error.message };
  return JSON.parse(r.result.content[0].text);
}

/** 게이트 sticky 를 «확실히» 지운다 — 활성이 없어지면 확정도 깨진다(설계상). */
async function resetGate() {
  const keep = ACTIVE;
  ACTIVE = null;
  await call('add_section', {});   // NO_ACTIVE_PROJECT → sticky clear
  ACTIVE = keep;
}

test.before(async () => {
  srv.setProjectOps({
    list: () => ({ items: PROJECTS.map(p => ({ ...p, createdAt: 1, updatedAt: 2 })) }),
    open: async ({ projectId }) => { ACTIVE = projectId; return { ok: true, projectId, activeProjectId: projectId, ready: true, sections: 0, waitedMs: 1 }; },
    create: async ({ name }) => ({ ok: true, projectId: 'proj_1000000000003', name: name || 'Untitled' }),
    duplicate: async ({ sourceProjectId }) => ({ ok: true, newProjectId: 'proj_1000000000004', newName: 'copy of ' + sourceProjectId }),
  });
  srv.setRendererInvoker({
    addSection: async () => ({ ok: true, sectionId: 'sec_test' }),
    addTextBlock: async () => ({ ok: true, blockId: 'tb_test' }),
    editTextBlock: async () => ({ ok: true, blockId: 'tb_test' }),
    getCanvasState: async () => ({ ok: true, sections: [{ sectionId: 'sec_test', blocks: [] }] }),
    listMemories: async () => ({ ok: true, items: [] }),
  });
  started = await srv.startMcpServer({ port: PORT, onActiveProject: () => ACTIVE });
  assert.equal(started.port, PORT, `port ${PORT} was busy — another process holds it`);
});

test.after(async () => { await srv.stopMcpServer(); });

// ── 판정 ⑴ 인자 없이 add_block → 거절 + 응답에 현재 프로젝트 id·이름·다음 수 ──────────
test('G1 인자 없이 add_block — 거절되고, 응답이 «지금 열린 프로젝트»와 «다음 수»를 말해 준다', async () => {
  ACTIVE = PROJECTS[0].id;
  await resetGate();
  const r = await call('add_block', { type: 'text', content: '아무 말' });
  assert.equal(r.ok, false, '대상을 정한 적이 없는데 통과했다');
  assert.equal(r.code, 'PROJECT_NOT_CONFIRMED');
  assert.equal(r.activeProject, PROJECTS[0].id);            // ★id
  assert.equal(r.activeProjectName, PROJECTS[0].name);      // ★이름 — id 만으론 사람이 못 알아본다
  assert.match(r.hint, /open_project/);                     // ★다음 수
  assert.match(r.hint, /list_projects/);
  assert.match(r.hint, /NOTHING was written/);              // ⛔조용히 실패하지 않는다
});

// ── 판정 ⑵ open_project 성공 뒤 같은 세션의 add_block → 통과(sticky) ────────────────
test('G2 open_project 뒤에는 인자 없이도 통과한다 (sticky — 매 호출 인자를 요구하지 않는다)', async () => {
  ACTIVE = PROJECTS[0].id;
  await resetGate();
  const o = await call('open_project', { projectId: PROJECTS[0].id });
  assert.equal(o.ok, true);
  const a = await call('add_block', { type: 'text', content: '이제 된다' });
  assert.equal(a.ok, true, JSON.stringify(a));
  assert.equal(a.blockId, 'tb_test');
  // 두 번째·세 번째 쓰기도 «추가 인자 없이» 계속 통과 — 왕복이 2배가 되지 않는다
  assert.equal((await call('add_section', {})).ok, true);
  assert.equal((await call('add_block', { type: 'text', content: '또' })).ok, true);
});

// ── 판정 ⑶ 사람이 앱에서 다른 프로젝트를 열면 sticky 가 «깨진다» ────────────────────
test('G3 사람이 앱에서 다른 프로젝트를 열면 확정이 깨지고 다시 거절된다', async () => {
  ACTIVE = PROJECTS[0].id;
  await resetGate();
  assert.equal((await call('open_project', { projectId: PROJECTS[0].id })).ok, true);
  assert.equal((await call('add_section', {})).ok, true);

  ACTIVE = PROJECTS[1].id;                 // ★사람이 앱에서 다른 프로젝트를 열었다(MCP 밖에서)
  const r = await call('add_section', {});
  assert.equal(r.ok, false, 'sticky 가 안 깨졌다 — 남의 프로젝트에 썼을 것이다');
  assert.equal(r.code, 'PROJECT_NOT_CONFIRMED');
  assert.equal(r.previouslyConfirmed, PROJECTS[0].id);   // 무엇에서 무엇으로 바뀌었는지 말해 준다
  assert.equal(r.activeProject, PROJECTS[1].id);
  assert.equal(r.activeProjectName, PROJECTS[1].name);
});

// ── 판정 ⑷ expectedProject 를 «틀리게» 주면 거절 + 실제 열린 것이 응답에 ────────────
test('G4 expectedProject 가 틀리면 거절하고 «실제로 열린 것»을 알려 준다', async () => {
  ACTIVE = PROJECTS[0].id;
  await resetGate();
  const r = await call('add_section', { expectedProject: PROJECTS[1].id });
  assert.equal(r.ok, false);
  assert.equal(r.code, 'PROJECT_MISMATCH');
  assert.equal(r.activeProject, PROJECTS[0].id);
  assert.equal(r.activeProjectName, PROJECTS[0].name);
  assert.equal(r.expectedProject, PROJECTS[1].id);
  assert.match(r.hint, new RegExp(PROJECTS[0].id));

  // 맞게 주면 통과하고, 그 자체가 «확정»이라 다음 호출은 인자 없이 통과한다
  assert.equal((await call('add_section', { expectedProject: PROJECTS[0].id })).ok, true);
  assert.equal((await call('add_section', {})).ok, true);
});

// ── 판정 ⑸ 읽기 도구는 «전부» 그대로 통과 ─────────────────────────────────────────
test('G5 읽기 도구는 확정 없이도 전부 통과한다 (⛔막으면 「지금 뭐가 열렸는지」도 못 묻는다)', async () => {
  ACTIVE = PROJECTS[0].id;
  await resetGate();
  for (const [name, args] of [
    ['get_canvas_state', {}],
    ['list_projects', {}],
    ['read_project', { projectId: PROJECTS[0].id }],
    ['get_block_schema', { type: 'text' }],
  ]) {
    const r = await call(name, args);
    assert.notEqual(r.code, 'PROJECT_NOT_CONFIRMED', `${name} 이(가) 게이트에 걸렸다`);
    assert.notEqual(r.code, 'NO_ACTIVE_PROJECT', `${name} 이(가) 게이트에 걸렸다`);
  }
  // ★읽기는 «지목»이 아니다 — 다 읽고 나서도 쓰기는 여전히 거절돼야 한다.
  //   (사고가 난 시나리오가 정확히 이 모양이다: 클로드는 늘 먼저 읽는다.)
  const w = await call('add_section', {});
  assert.equal(w.ok, false, '읽기가 확정으로 세어졌다 — 사고 시나리오가 그대로 통과한다');
  assert.equal(w.code, 'PROJECT_NOT_CONFIRMED');
});

// ── 판정 ⑹ duplicate_project{} 빈 호출 → 거절(721MB 복제가 안 일어난다) ─────────────
test('G6 duplicate_project 빈 호출은 거절된다 (빈 호출 한 번 = 최대 721MB 복제)', async () => {
  ACTIVE = PROJECTS[0].id;
  await resetGate();
  let duplicated = 0;
  srv.setProjectOps({
    list: () => ({ items: PROJECTS.map(p => ({ ...p, createdAt: 1, updatedAt: 2 })) }),
    open: async ({ projectId }) => { ACTIVE = projectId; return { ok: true, projectId, activeProjectId: projectId, ready: true }; },
    create: async ({ name }) => ({ ok: true, projectId: 'proj_1000000000003', name: name || 'Untitled' }),
    duplicate: async ({ sourceProjectId }) => { duplicated++; return { ok: true, newProjectId: 'proj_1000000000004', newName: 'copy' }; },
  });
  const r = await call('duplicate_project', {});
  assert.equal(r.ok, false);
  assert.equal(r.code, 'PROJECT_NOT_CONFIRMED');
  assert.equal(duplicated, 0, '★복제가 실제로 «일어났다» — 거절이 실행을 막지 못했다');

  // sourceProjectId 를 «명시»하면 그것이 곧 지목이라 통과한다(정상 사용을 막지 않는다)
  const r2 = await call('duplicate_project', { sourceProjectId: PROJECTS[1].id });
  assert.equal(r2.ok, true, JSON.stringify(r2));
  assert.equal(duplicated, 1);
});

// ── §3 create_project 는 «대상이 없는 게 정상» — 막지 않되, 활성이 안 바뀐다고 말한다 ──
test('G7 create_project 는 게이트를 안 타고, 「만들었지만 활성은 그대로」를 값으로 돌려준다', async () => {
  ACTIVE = PROJECTS[0].id;
  await resetGate();
  const r = await call('create_project', { name: '새 프로젝트' });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.opened, false);
  assert.equal(r.activeProject, PROJECTS[0].id);   // ★새 것이 아니라 «여전히 열려 있던 것»
  assert.match(r.hint, /open_project/);
  // 만들기만 해서는 확정이 안 된다 — 바로 편집하면 여전히 거절
  assert.equal((await call('add_section', {})).code, 'PROJECT_NOT_CONFIRMED');
});

// ── 편집기가 안 열렸을 때 ────────────────────────────────────────────────────────
test('G8 편집기가 안 열려 있으면 NO_ACTIVE_PROJECT 로 «실행하지 않고» 거절한다', async () => {
  ACTIVE = null;
  const r = await call('add_section', {});
  assert.equal(r.ok, false);
  assert.equal(r.code, 'NO_ACTIVE_PROJECT');
  assert.equal(r.activeProject, null);
  assert.match(r.hint, /list_projects/);
  assert.match(r.hint, /Do not guess/);
});

// ── ★fail-closed: 게이트 목록에 «안 적힌» 부작용 도구는 자동으로 걸린다 ────────────
test('G9 fail-closed — 목록에 없는 쓰기 도구(export_sections·delete_section 등)도 자동으로 걸린다', async () => {
  ACTIVE = PROJECTS[0].id;
  await resetGate();
  for (const name of ['export_sections', 'delete_section', 'delete_block', 'move_section', 'put_image', 'update_block', 'undo_last_mcp_change']) {
    const r = await call(name, name === 'delete_section' ? { sectionId: 'sec_x' }
      : name === 'delete_block' ? { blockId: 'tb_x' }
      : name === 'move_section' ? { sectionId: 'sec_x', afterId: 'sec_y' }
      : name === 'put_image' ? { image: 'https://example.com/a.png' }
      : name === 'update_block' ? { blockId: 'tb_x', content: 'x' } : {});
    assert.equal(r.code, 'PROJECT_NOT_CONFIRMED', `${name} 이(가) 게이트를 안 탔다 — _TARGET_FREE 에 잘못 들어갔거나 배선이 빠졌다`);
  }
});

// ── ⒝ 안내: tools/list 설명에 «대상»이 박혀 있고, 읽기 도구엔 안 박혀 있다 ───────────
test('G10 tools/list — 쓰기 도구 설명엔 TARGET 경고가 붙고 읽기 도구엔 안 붙는다', async () => {
  const r = await rpc('tools/list', {});
  const byName = new Map(r.result.tools.map(t => [t.name, t.description]));
  assert.match(byName.get('add_block'), /TARGET=the ACTIVE project/);
  assert.match(byName.get('add_section'), /TARGET=the ACTIVE project/);
  assert.match(byName.get('duplicate_project'), /TARGET=the ACTIVE project/);
  assert.doesNotMatch(byName.get('get_canvas_state'), /TARGET=the ACTIVE project/);
  assert.doesNotMatch(byName.get('list_projects'), /TARGET=the ACTIVE project/);
  assert.doesNotMatch(byName.get('open_project'), /TARGET=the ACTIVE project/);
  // expectedProject 가 «부를 수 있는 인자»로 스키마에 있다
  const add = r.result.tools.find(t => t.name === 'add_block');
  assert.ok(add.inputSchema.properties.expectedProject, 'add_block 스키마에 expectedProject 가 없다');
});

// ── 왕복 비용: 거절이 늘면 호출이 는다 — «몇 번»인지 숫자로 잡아 둔다 ────────────────
test('G11 왕복 비용 — 한 대화에서 늘어나는 호출은 «거절 1 + open_project 1» 뿐이다', async () => {
  ACTIVE = PROJECTS[0].id;
  await resetGate();
  const base = CALLS;
  // 사람이 쓰듯: 읽고 → 쓰려다 거절 → 열고 → «그 호출을 다시» → 쓰기 5번
  await call('get_canvas_state', {});
  const refused = await call('add_section', {});                      // ← 늘어난 호출 ①(거절)
  assert.equal(refused.ok, false);
  await call('open_project', { projectId: refused.activeProject });   // ← 늘어난 호출 ②(응답이 알려준 그대로)
  assert.equal((await call('add_section', {})).ok, true);             // 원래 하려던 것을 재시도
  for (let i = 0; i < 5; i++) assert.equal((await call('add_block', { type: 'text', content: 'x' + i })).ok, true);
  const used = CALLS - base;
  /* ★게이트가 없었다면 1(read)+1(add_section)+5(add_block)=7. 지금은 9.
     늘어난 건 «대화당 정확히 2»(거절 1 + open_project 1)이고 ★쓰기 횟수에 «비례하지 않는다» —
     sticky 가 없었다면 쓰기 6번마다 인자를 붙이거나 여섯 번 거절당했을 것이다. */
  assert.equal(used, 9, `왕복이 예상(9)과 다르다: ${used}`);
});

// ── open_project 가 «실패»했으면 확정으로 세지 않는다 ───────────────────────────────
test('G12 open_project 가 load_timeout 이면 확정이 서지 않는다 (열리지도 않은 걸 확정하면 게이트가 무의미)', async () => {
  ACTIVE = PROJECTS[0].id;
  await resetGate();
  srv.setProjectOps({
    list: () => ({ items: PROJECTS.map(p => ({ ...p, createdAt: 1, updatedAt: 2 })) }),
    open: async ({ projectId }) => ({ ok: false, code: 'load_timeout', projectId, waitedMs: 1, timeoutMs: 2 }),
    create: async ({ name }) => ({ ok: true, projectId: 'proj_1000000000003', name: name || 'Untitled' }),
    duplicate: async () => ({ ok: true, newProjectId: 'proj_1000000000004', newName: 'copy' }),
  });
  const o = await call('open_project', { projectId: PROJECTS[0].id });
  assert.equal(o.ok, false);
  assert.equal(o.code, 'load_timeout');
  const w = await call('add_section', {});
  assert.equal(w.ok, false, '열리지도 않은 프로젝트가 «확정»으로 섰다');
  assert.equal(w.code, 'PROJECT_NOT_CONFIRMED');
});

// ── expectedProject 는 «게이트 인자»지 블록 속성이 아니다 ────────────────────────────
test('G13 add_block/update_block 에 expectedProject 를 줘도 «모르는 속성» 경고가 안 난다', async () => {
  ACTIVE = PROJECTS[0].id;
  await resetGate();
  const a = await call('add_block', { type: 'text', content: '본문', expectedProject: PROJECTS[0].id });
  assert.equal(a.ok, true, JSON.stringify(a));
  /* ★게이트 전용 인자가 블록 속성 병합에 섞이면 normalizeArgs 가 「모르는 prop」으로 잡아
     ignoredProps 에 실린다 — 값은 안 들어갔는데 «틀린 경고»가 나가서, 클로드가 인자를 다시
     안 쓰게 된다. 틀린 안내는 없는 안내보다 나쁘다. */
  assert.equal(a.ignoredProps, undefined, `add_block: expectedProject 가 블록 속성으로 샜다: ${JSON.stringify(a.ignoredProps)}`);
  assert.equal(a.hint, undefined);

  const u = await call('update_block', { blockId: 'tb_test', content: '고침', expectedProject: PROJECTS[0].id });
  assert.equal(u.ok, true, JSON.stringify(u));
  assert.equal(u.ignoredProps, undefined, `update_block: expectedProject 가 블록 속성으로 샜다: ${JSON.stringify(u.ignoredProps)}`);
});

// ── ★실제 앱이 타는 경로(BrowserWindow URL 폴백)로도 게이트가 먹는지 ──────────────────
test('G14 «앱이 실제로 타는» 경로 — 편집기 창 URL(?project=)로 활성을 읽어도 게이트는 같다', async () => {
  /* ⚠️여기가 왜 따로 있나: 앱은 startMcpServer({onActiveProject: () => global.currentActiveProjectId})
   *   로 콜백을 주지만, 그 전역은 renderer 가 claudePM:setActiveProject 를 «부르는 곳이 없어서»
   *   실사용에서 «항상 null»이다(mcp-server.js _activeProjectId 주석의 08-25 실측).
   *   ⇒ 실제로 도는 건 «편집기 창 URL ?project=» 폴백이다. 위 G1~G13 은 콜백 경로만 쟀으므로
   *   ★사용자가 밟는 경로는 여기서 «따로» 잰다(양끝 따로 재기). */
  ACTIVE = null;                                   // 콜백은 null — 실사용과 같은 모양
  const target = PROJECTS[1].id;
  const epath = require.resolve('electron');
  const saved = require.cache[epath];
  require.cache[epath] = { id: epath, filename: epath, loaded: true, exports: {
    BrowserWindow: { getAllWindows: () => [{ webContents: { getURL: () => `file:///app/index.html?project=${target}` } }] },
  } };
  try {
    await call('add_section', {});                 // sticky 정리(활성이 바뀌었으니 어차피 깨진다)
    const r = await call('add_section', {});
    assert.equal(r.ok, false);
    assert.equal(r.code, 'PROJECT_NOT_CONFIRMED');
    assert.equal(r.activeProject, target, 'URL 폴백으로 활성을 못 읽었다');
    assert.equal(r.activeProjectName, PROJECTS[1].name);
    // 그 프로젝트를 지목하면 통과한다
    assert.equal((await call('add_section', { expectedProject: target })).ok, true);
  } finally {
    if (saved) require.cache[epath] = saved; else delete require.cache[epath];
  }
});
