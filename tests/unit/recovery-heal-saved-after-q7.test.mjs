/* Q7 — 거짓 저장실패 띠 걷기 (현빈 261112 ⒜ · main/recovery healSavedAfterUnknown).
 *   H1 사유 모름(no-response) + 사본 없음 + proj.json 이 기록보다 새로움 → handled · 띠(localItems)에서 빠짐
 *   H2 [음성대조] 같은데 proj.json 이 기록보다 낡음(진짜 미저장) → 그대로 뜬다
 *   H3 [음성대조] 사유가 save-failed(진짜 오류) → 파일이 새로워도 그대로
 *   H4 [음성대조] 비상 사본이 있음 / projectId 없음 / 파일 없음 → 그대로
 *   H5 flat 꼴(projects/<id>.json)도 같은 규칙
 *   H6 [계정 격리] 해석기가 가리키는 «지금 계정» 뿌리만 본다 — 다른 계정 뿌리의 더 새 파일로는 안 걷는다 · 해석기 없으면 0
 * 해석기 = main.js _resolveProjectJsonPath 와 같은 꼴(신 → flat)을 여기서 흉내 낸다(recovery 는 뿌리를 조립하지 않는다 · M10).
 * 양성대조: recovery 의 `m > t` 조건을 `false` 로 바꾸면 H1·H5 빨강, H2~H4·H6 초록.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const recovery = require(path.join(ROOT, 'main/recovery'));
const saveGuard = require(path.join(ROOT, 'main/quit/save-guard'));
const { mkTmpRoot } = require('./_tmproot');

const AT = '2026-11-10T10:00:00.000Z', T = Date.parse(AT);
const rec = (o) => ({ at: AT, reason: 'no-response', error: null, projectId: 'proj_1', projectName: 'p', appVersion: '0.9.11',
  emergencyPath: null, emergencyBytes: null, emergencyError: 'no-snapshot', handled: false, ...o });

function setup(records, files) {
  const ws = mkTmpRoot('goya-q7-');
  fs.mkdirSync(path.join(ws, 'projects'), { recursive: true });
  for (const [rel, mtime] of files) {
    const p = path.join(ws, 'projects', rel); fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify({ version: 2, pages: [{ id: 'page_1' }] }), 'utf8');
    fs.utimesSync(p, new Date(mtime), new Date(mtime));
  }
  fs.writeFileSync(path.join(ws, 'quit-save-failure.json'), JSON.stringify({ v: 1, records }, null, 2), 'utf8');
  saveGuard.init({ userDataDir: ws, workspaceDir: ws });
  recovery.init({ userDataDir: ws, workspaceDir: ws, saveGuard });
  RES = resolverFor(path.join(ws, 'projects'));
  return ws;
}
const resolverFor = (root) => (id) => { const n = path.join(root, id, 'proj.json'); if (fs.existsSync(n)) return n; const f = path.join(root, id + '.json'); return fs.existsSync(f) ? f : null; };
let RES = null;
const heal = () => recovery.healSavedAfterUnknown({ resolveProjectJson: RES });
const shown = () => recovery.localItems().items.filter((i) => i.kind === 'save-failure').map((i) => i.projectId);

test('H1 모름+사본없음+파일이 더 새로움 → handled · 띠 안 뜸', () => {
  setup([rec({})], [['proj_1/proj.json', T + 60000]]);
  assert.deepEqual(shown(), ['proj_1'], '[전제] 걷기 전엔 뜬다');
  assert.equal(heal().healed, 1);
  assert.deepEqual(shown(), []);
  const r = saveGuard.readMarker()[0];
  assert.equal(r.handled, true); assert.equal(r.handledWhy, 'saved-after');
});

test('H2 [음성대조] 파일이 기록보다 낡음 = 진짜 미저장 → 띠 그대로', () => {
  setup([rec({})], [['proj_1/proj.json', T - 60000]]);
  assert.equal(heal().healed, 0);
  assert.deepEqual(shown(), ['proj_1']);
});

test('H3 [음성대조] save-failed 는 파일이 새로워도 그대로', () => {
  setup([rec({ reason: 'save-failed', error: 'EACCES' })], [['proj_1/proj.json', T + 60000]]);
  assert.equal(heal().healed, 0);
  assert.deepEqual(shown(), ['proj_1']);
});

test('H4 [음성대조] 사본 있음 · projectId 없음 · 파일 없음 → 그대로', () => {
  const ws = setup([rec({ projectId: null }), rec({ at: '2026-11-10T09:00:00.000Z', projectId: 'proj_gone' })], [['proj_1/proj.json', T + 60000]]);
  const em = path.join(ws, 'em.json'); fs.writeFileSync(em, '{}');
  const j = JSON.parse(fs.readFileSync(path.join(ws, 'quit-save-failure.json'), 'utf8'));
  j.records.push(rec({ at: '2026-11-10T08:00:00.000Z', emergencyPath: em, emergencyError: null }));
  fs.writeFileSync(path.join(ws, 'quit-save-failure.json'), JSON.stringify(j), 'utf8');
  assert.equal(heal().healed, 0);
  assert.equal(shown().length, 3);
});

test('H5 flat 꼴 projects/<id>.json 도 같다', () => {
  setup([rec({})], [['proj_1.json', T + 60000]]);
  assert.equal(heal().healed, 1);
  assert.deepEqual(shown(), []);
});

test('H6 [계정 격리] 다른 계정 뿌리의 더 새 파일로는 안 걷는다 · 해석기 없으면 0', () => {
  const ws = setup([rec({})], [['proj_1/proj.json', T - 60000]]);   // 지금 계정 = 낡음(진짜 미저장)
  const other = path.join(ws, 'accounts', 'other', 'projects', 'proj_1'); fs.mkdirSync(other, { recursive: true });
  const op = path.join(other, 'proj.json'); fs.writeFileSync(op, '{}'); fs.utimesSync(op, new Date(T + 60000), new Date(T + 60000));
  assert.equal(heal().healed, 0, '다른 계정의 같은 id 파일로 걷혔다');
  assert.deepEqual(shown(), ['proj_1']);
  RES = resolverFor(path.join(ws, 'accounts', 'other', 'projects'));   // [대조] 같은 기록 · 해석기가 그쪽을 가리키면 걷힌다 = 자가 산다
  assert.equal(recovery.healSavedAfterUnknown({}).healed, 0, '해석기 없이 걷혔다');
  assert.equal(heal().healed, 1);
});
