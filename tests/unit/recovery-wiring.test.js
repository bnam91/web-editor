/* U-H3-W — main.js 가 복구 경로를 «실제로 부르는가» + 되살리기가 «진짜로» 되는가. (H3, 2026-09-06)
 *   실행: node tests/unit/recovery-wiring.test.js
 *
 * ★이 검사가 막는 것 — 「모듈은 완벽한데 아무도 안 부른다」
 *   이 프로젝트의 주된 실패 형태다(H2 의 U-H2-W 와 같은 이유로 파일을 따로 둔다).
 *   main/recovery/* 단위검사가 전부 초록이어도 main.js 의 배선이 지워지면 제품엔 아무 일도
 *   안 일어난다. ⇒ 소스 문자열 검색이 아니라 «진짜 main.js 를 적재해» 핸들러를 부른다.
 *
 * ★그리고 이 파일이 「복구할 수 있었는데 못 했다」를 막는 자리다 —
 *   되살리기가 «새 프로젝트»를 만들고 «원본을 안 건드리는지»를 진짜 IPC 로 잰다.
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { loadMain } = require('./_ipc-harness');

const H = loadMain();
const UD = H.userData;
const LOGS = path.join(UD, 'logs');
const EMER = path.join(UD, 'emergency-saves');

const sec = (id, name) => `<div class="section-block" id="${id}" data-name="${name}"></div>`;

function seedCrash(ts) {
  fs.mkdirSync(LOGS, { recursive: true });
  fs.writeFileSync(path.join(LOGS, `crash-${ts}.json`), JSON.stringify({
    at: new Date(ts).toISOString(), kind: 'render-process-gone', appVersion: '0.0.0-test',
    os: 'darwin 25.3.0', arch: 'arm64', reason: 'crashed', exitCode: 2,
    errors: [{ at: new Date(ts - 100).toISOString(), level: 'console.error', msg: '[W-marker] 크래시 직전' }],
  }), 'utf8');
  return `crash:crash-${ts}.json`;
}

test('U-H3-W1 IPC 4개가 «main 에 등록»돼 있다 — 배선이 지워지면 여기서 죽는다', () => {
  for (const ch of ['recovery:pending', 'recovery:restore', 'recovery:reveal', 'recovery:ack']) {
    assert.ok(H.has(ch), `★preload 가 부르는 ${ch} 를 main 이 안 듣는다`);
  }
});

test('U-H3-W2 recovery:pending 이 «진짜 userData» 의 흔적을 읽어 온다', async () => {
  seedCrash(1788000010000);
  const r = await H.invoke('recovery:pending');
  assert.equal(r.ok, true, 'pending 이 실패했다: ' + JSON.stringify(r));
  assert.ok(r.counts.crashes >= 1, '★기록이 있는데 0건으로 읽는다 — 배선이 다른 userData 를 보고 있다');
  assert.ok(JSON.stringify(r.reportLines).includes('[W-marker]'),
    '★크래시 직전 오류 줄이 「나갈 줄」까지 안 닿는다 — 배선 어딘가가 끊겼다');
});

test('U-H3-W3 ★★되살리기 = «새 프로젝트». 원본은 한 글자도 안 바뀐다', async () => {
  const id = 'proj_1788000020000';
  const before = { id, name: '고객사 상세', version: 2, currentPageId: 'page_1',
    pages: [{ id: 'page_1', name: 'Page 1', canvas: sec('sec_old', '옛것') }], checklistItems: [] };
  assert.equal((await H.invoke('projects:save', before)).ok, true);
  const srcPath = path.join(UD, 'projects', id, 'proj.json');
  assert.ok(fs.existsSync(srcPath), '전제 실패 — 원본 경로: ' + srcPath);
  const srcRaw0 = fs.readFileSync(srcPath, 'utf8');

  /* 비상 사본 = 렌더러 serializeProject() 결과 모양(id·name·branches 가 «없다») */
  fs.mkdirSync(EMER, { recursive: true });
  const em = path.join(EMER, `${id}-2026-09-06T10-00-00-000Z.json`);
  fs.writeFileSync(em, JSON.stringify({
    version: 2, currentPageId: 'page_1',
    pages: [{ id: 'page_1', name: 'Page 1', canvas: sec('sec_new', '살려낸 마지막 편집') }],
    checklistItems: [], checklistSections: [], imageGallery: [], assetsTree: [],
  }), 'utf8');

  const r = await H.invoke('recovery:restore', { emergencyPath: em, projectId: id });
  assert.equal(r.ok, true, '★되살리지 못했다 = 「복구할 수 있었는데 못 했다」: ' + JSON.stringify(r));
  assert.notEqual(r.projectId, id, '★원본 id 로 되살렸다 — 덮어썼다는 뜻이다');

  const dupRaw = fs.readFileSync(path.join(UD, 'projects', r.projectId, 'proj.json'), 'utf8');
  assert.ok(dupRaw.includes('살려낸 마지막 편집'), '사본에 마지막 편집이 안 들어갔다');
  assert.ok(dupRaw.includes('복구본'), '이름으로 «복구본»임을 알 수 없다: ' + r.name);
  assert.equal(fs.readFileSync(srcPath, 'utf8'), srcRaw0,
    '★★원본 프로젝트가 바뀌었다 — 복구가 파괴가 됐다. 반려 조건이다');
  assert.ok(fs.existsSync(em), '★비상 사본을 지웠다 — 되살리기가 실패했을 때 사용자가 챙길 마지막 통로다');
});

test('U-H3-W4 ★원본이 «없거나» id 규약과 안 맞아도 되살린다 — 대신 «반쪽»임을 말한다', async () => {
  /* ★실기가 요구한 가지(2026-09-06): H4 러너가 만든 프로젝트 id 는 `proj_h4_<epoch>` 라
     _duplicateProjectImpl 의 `^proj_\d+$` 를 통과 못 한다. 초판은 거기서 그냥 실패했고,
     사본 파일은 멀쩡한데 사용자는 손을 못 댔다 = 「복구할 수 있었는데 못 했다」.
     ⇒ 지금은 원본에 «기대지 않고» 새 프로젝트로 되살린다. 단, 자산은 못 가져오므로
       assetsLinked:false 로 «말한다» — 조용히 반쪽을 주지 않는다. */
  fs.mkdirSync(EMER, { recursive: true });
  const em = path.join(EMER, 'proj_h4_1788000099999-x.json');
  fs.writeFileSync(em, JSON.stringify({
    version: 2, currentPageId: 'page_1',
    pages: [{ id: 'page_1', name: 'Page 1', canvas: sec('sec_orphan', '원본 없는 내용') }],
  }), 'utf8');

  for (const pid of ['proj_h4_1788000099999', 'proj_1788000099999', '']) {
    const r = await H.invoke('recovery:restore', { emergencyPath: em, projectId: pid });
    assert.equal(r.ok, true, `★projectId=${pid || '(없음)'} 에서 되살리기를 포기했다: ` + JSON.stringify(r));
    assert.equal(r.assetsLinked, false, '★자산을 못 가져왔는데 «가져온 것처럼» 답했다');
    const raw = fs.readFileSync(path.join(UD, 'projects', r.projectId, 'proj.json'), 'utf8');
    assert.ok(raw.includes('원본 없는 내용'), '되살렸다면서 내용이 안 들어갔다');
  }
  assert.ok(fs.existsSync(em), '★비상 사본을 지웠다');
});

test('U-H3-W4b 사본이 깨졌으면 «성공했다고 말하지 않는다»', async () => {
  fs.mkdirSync(EMER, { recursive: true });
  const em = path.join(EMER, 'proj_1788000098888-broken.json');
  fs.writeFileSync(em, '{"version":2,"pages":[', 'utf8');
  const r = await H.invoke('recovery:restore', { emergencyPath: em, projectId: 'proj_1788000098888' });
  assert.equal(r.ok, false, '★깨진 사본을 «되살렸다»고 답했다');
  assert.equal(r.code, 'corrupt');
});

test('U-H3-W5 emergency-saves «밖»의 경로는 거절한다 — IPC 는 누구나 부르는 문이다', async () => {
  const outside = path.join(UD, 'auth.json');
  fs.writeFileSync(outside, JSON.stringify({ email: 'x@y.z', sessionToken: 'SECRET' }), 'utf8');
  for (const p of [outside, path.join(EMER, '..', 'auth.json'), '/etc/hosts']) {
    const r = await H.invoke('recovery:restore', { emergencyPath: p, projectId: 'proj_1788000020000' });
    assert.equal(r.ok, false, '★' + p + ' 를 읽어 «프로젝트로» 만들었다');
    const v = await H.invoke('recovery:reveal', { emergencyPath: p });
    assert.equal(v.ok, false, '★' + p + ' 를 Finder 로 열어줬다');
  }
});

test('U-H3-W6 recovery:ack 로 도장을 찍으면 pending 에서 빠진다 — 그런데 파일은 남는다', async () => {
  const id = seedCrash(1788000030000);
  const p0 = (await H.invoke('recovery:pending')).items.map((i) => i.id);
  assert.ok(p0.includes(id), '전제 실패 — 방금 심은 기록이 안 보인다');
  const a = await H.invoke('recovery:ack', { ids: [id] });
  assert.equal(a.ok, true);
  const p1 = (await H.invoke('recovery:pending')).items.map((i) => i.id);
  assert.ok(!p1.includes(id), '★도장을 찍었는데 또 뜬다');
  assert.ok(fs.existsSync(path.join(LOGS, 'crash-1788000030000.json')), '★원본 기록을 지웠다');
});

test('U-H3-W7 ★★이 경로 어디에도 «자동 전송»이 없다 — 신고 큐를 건드리지 않는다', async () => {
  seedCrash(1788000040000);
  const before = await H.invoke('report:queue-stats');
  await H.invoke('recovery:pending');
  await H.invoke('recovery:ack', { ids: ['crash:crash-1788000040000.json'] });
  const after = await H.invoke('report:queue-stats');
  assert.equal(after.size, before.size,
    '★복구 경로가 신고 큐에 무언가를 «집어넣었다» = 사용자 동의 없이 나갈 준비를 했다는 뜻이다');
  assert.ok(!fs.existsSync(path.join(UD, 'reports-queue.json')) || after.size === 0,
    '★큐 파일에 항목이 생겼다 — 동의 없는 전송 준비');
});
