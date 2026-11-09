/* newproj-legacy-probe-async — NEWPROJ-FREEZE-DOCUMENTS-TCC-01 (미카사 아이맥 실앱: 「New Design」 → 앱 전체 멈춤 6분+)
 *   원인: claudePM:ensureFolder 가 새 프로젝트마다 옛 경로 ~/Documents/claude-pm-projects 를 메인 스레드 «동기»로 훑다가
 *         맥 «문서 폴더 접근» 확인창에 붙잡힘. 고침: 옛 경로는 비동기 + 시간 제한 + 막히면 세션 동안 건너뜀.
 *   N1 옛 경로 fs 가 영영 안 돌아와도(가짜 fsp) 시간 제한 안에 null — 다음 부름은 fs 를 아예 안 건드림
 *   N2 옛 이관 찾기는 옛 판과 같은 결과: ⒜ <base>/<id> ⒝ meta id 다르면 버리고 훑기 ⒞ 다른 이름 폴더의 meta.id 일치 ⒟ symlink 무시 ⒠ base 없음 = null
 *   N3 ensureFolder 통합(진짜 fs · 가짜 HOME): 옛 폴더 있으면 migrated:true · 없으면 새로 생성(created:true)
 *   N4 정적: ensureFolder 의 옛 경로 갈래에 동기 fs 호출 0 (★양성대조: 기준판 ipc.js 는 existsSync(legacyBase) 라 빨강)
 * 실제 확인창 재현은 아이맥(미카사) 몫. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { mkTmpRoot } = require('./_tmproot.js');
const { sliceBlock } = require('./_slice-block.js');

const IPC = path.join(__dirname, '..', '..', 'main', 'claude-pm', 'ipc.js');
const load = () => { delete require.cache[require.resolve(IPC)]; return require(IPC); };
const PID = 'proj_1700000000000';

test('N1 옛 경로가 영영 안 돌아와도 시간 제한 안에 null · 그 뒤로는 fs 를 안 건드린다', async () => {
  const ipc = load(); const find = ipc._internal._findLegacySrcAsync;
  assert.strictEqual(typeof find, 'function', '검사 대상 함수가 없다');
  let calls = 0;
  const hang = new Proxy({}, { get: () => () => { calls++; return new Promise(() => {}); } });
  const t0 = Date.now();
  const r = await find('/Users/x/Documents/claude-pm-projects', PID, { fsp: hang, ms: 200 });
  const dt = Date.now() - t0;
  assert.strictEqual(r, null);
  assert.ok(dt < 1000, `시간 제한(200ms) 안에 끝나야 — ${dt}ms`);
  assert.ok(calls >= 1, '[전제] 가짜 fs 를 실제로 불렀다');
  const c1 = calls, t1 = Date.now();
  assert.strictEqual(await find('/Users/x/Documents/claude-pm-projects', PID, { fsp: hang, ms: 200 }), null);
  assert.strictEqual(calls, c1, '한 번 막히면 이 세션엔 다시 안 훑는다');
  assert.ok(Date.now() - t1 < 50);
  ipc._internal._resetLegacyBlocked();
});

test('N2 이관 찾기 결과는 옛 판과 같다(⒜~⒠)', async () => {
  const ipc = load(); const find = (b) => ipc._internal._findLegacySrcAsync(b, PID);
  const base = path.join(mkTmpRoot('legacy-'), 'claude-pm-projects');
  assert.strictEqual(await find(base), null, '⒠ base 없음 = null');
  fs.mkdirSync(path.join(base, PID), { recursive: true });
  assert.strictEqual(await find(base), path.join(base, PID), '⒜ <base>/<id> (meta 없음 = 폴더명 매칭)');
  fs.writeFileSync(path.join(base, PID, 'project.meta.json'), JSON.stringify({ id: 'proj_other' }));
  assert.strictEqual(await find(base), null, '⒝ meta id 가 다르면 버린다(훑어도 없음)');
  fs.mkdirSync(path.join(base, '옛 이름'));
  fs.writeFileSync(path.join(base, '옛 이름', 'project.meta.json'), JSON.stringify({ id: PID }));
  assert.strictEqual(await find(base), path.join(base, '옛 이름'), '⒞ 다른 이름 폴더의 meta.id 일치');
  fs.rmSync(path.join(base, '옛 이름'), { recursive: true });
  const real = path.join(path.dirname(base), 'outside'); fs.mkdirSync(real);
  fs.writeFileSync(path.join(real, 'project.meta.json'), JSON.stringify({ id: PID }));
  fs.symlinkSync(real, path.join(base, 'link'));
  assert.strictEqual(await find(base), null, '⒟ symlink 은 폴더로 안 친다');
});

test('N3 ensureFolder 통합 — 옛 폴더 있으면 이관 · 없으면 새로 생성', async () => {
  const home0 = process.env.HOME;
  const tmp = mkTmpRoot('newproj-');
  try {
    process.env.HOME = path.join(tmp, 'home');
    const root = path.join(tmp, 'projects');
    const ipc = load(); ipc.setPmProjectsRoot(() => root);
    fs.mkdirSync(path.join(root, PID), { recursive: true });
    let r = await ipc.handleEnsureClaudePMFolder(null, { projectId: PID, projectName: '새 디자인' });
    assert.strictEqual(r.ok, true, JSON.stringify(r));
    assert.strictEqual(r.created, true, '옛 경로 없음 → 새로 만든다');
    assert.ok(!r.migrated);
    const P2 = 'proj_1700000000001';
    fs.mkdirSync(path.join(root, P2), { recursive: true });
    const old = path.join(process.env.HOME, 'Documents', 'claude-pm-projects', P2);
    fs.mkdirSync(old, { recursive: true }); fs.writeFileSync(path.join(old, 'NOTES.md'), '# 옛 메모\n');
    r = await ipc.handleEnsureClaudePMFolder(null, { projectId: P2, projectName: '옛 프로젝트' });
    assert.strictEqual(r.ok, true, JSON.stringify(r));
    assert.strictEqual(r.migrated, true, '옛 폴더 이관은 그대로 된다');
    assert.strictEqual(fs.readFileSync(path.join(r.folderPath, 'NOTES.md'), 'utf8'), '# 옛 메모\n');
    ipc.setPmProjectsRoot(null);
  } finally { process.env.HOME = home0; }
});

test('N4 정적 — ensureFolder 의 옛 경로 갈래에 동기 fs 0', () => {
  const src = fs.readFileSync(IPC, 'utf8');
  const body = sliceBlock(src, 'async function handleEnsureClaudePMFolder(', 'ensureFolder 본문');
  const i = body.indexOf('[2] legacy'), j = body.indexOf('if (legacySrc)');
  assert.ok(i > 0 && j > i, '옛 경로 갈래를 못 찾았다');
  const branch = body.slice(i, j);
  assert.ok(!/Sync\(/.test(branch), `옛 경로 갈래에 동기 fs: ${branch.match(/\w+Sync\(/g)}`);
  assert.ok(/await _findLegacySrcAsync\(/.test(branch), '옛 경로는 비동기 찾기로만');
  assert.ok(!/Sync\(/.test(sliceBlock(src, 'async function _findLegacySrcAsync(', '옛 경로 찾기')), '찾기 함수 안에도 동기 fs 0');
});
