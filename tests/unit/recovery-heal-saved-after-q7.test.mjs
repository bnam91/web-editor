/* Q7 — 거짓 저장실패 띠 걷기 (현빈 261112 ⒜ · main/recovery healSavedAfterUnknown).
 *   H1 사유 모름(no-response) + 사본 없음 + proj.json 이 기록보다 새로움 → handled · 띠(localItems)에서 빠짐
 *   H2 [음성대조] 같은데 proj.json 이 기록보다 낡음(진짜 미저장) → 그대로 뜬다
 *   H3 [음성대조] 사유가 save-failed(진짜 오류) → 파일이 새로워도 그대로
 *   H4 [음성대조] 비상 사본이 있음 / projectId 없음 / 파일 없음 → 그대로
 *   H5 flat 꼴(projects/<id>.json)도 같은 규칙
 * 양성대조: main.js 가 아니라 recovery 의 `m > t` 조건을 `false` 로 바꾸면 H1·H5 빨강, H2~H4 초록.
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
  return ws;
}
const shown = () => recovery.localItems().items.filter((i) => i.kind === 'save-failure').map((i) => i.projectId);

test('H1 모름+사본없음+파일이 더 새로움 → handled · 띠 안 뜸', () => {
  setup([rec({})], [['proj_1/proj.json', T + 60000]]);
  assert.deepEqual(shown(), ['proj_1'], '[전제] 걷기 전엔 뜬다');
  assert.equal(recovery.healSavedAfterUnknown().healed, 1);
  assert.deepEqual(shown(), []);
  const r = saveGuard.readMarker()[0];
  assert.equal(r.handled, true); assert.equal(r.handledWhy, 'saved-after');
});

test('H2 [음성대조] 파일이 기록보다 낡음 = 진짜 미저장 → 띠 그대로', () => {
  setup([rec({})], [['proj_1/proj.json', T - 60000]]);
  assert.equal(recovery.healSavedAfterUnknown().healed, 0);
  assert.deepEqual(shown(), ['proj_1']);
});

test('H3 [음성대조] save-failed 는 파일이 새로워도 그대로', () => {
  setup([rec({ reason: 'save-failed', error: 'EACCES' })], [['proj_1/proj.json', T + 60000]]);
  assert.equal(recovery.healSavedAfterUnknown().healed, 0);
  assert.deepEqual(shown(), ['proj_1']);
});

test('H4 [음성대조] 사본 있음 · projectId 없음 · 파일 없음 → 그대로', () => {
  const ws = setup([rec({ projectId: null }), rec({ at: '2026-11-10T09:00:00.000Z', projectId: 'proj_gone' })], [['proj_1/proj.json', T + 60000]]);
  const em = path.join(ws, 'em.json'); fs.writeFileSync(em, '{}');
  const j = JSON.parse(fs.readFileSync(path.join(ws, 'quit-save-failure.json'), 'utf8'));
  j.records.push(rec({ at: '2026-11-10T08:00:00.000Z', emergencyPath: em, emergencyError: null }));
  fs.writeFileSync(path.join(ws, 'quit-save-failure.json'), JSON.stringify(j), 'utf8');
  assert.equal(recovery.healSavedAfterUnknown().healed, 0);
  assert.equal(shown().length, 3);
});

test('H5 flat 꼴 projects/<id>.json 도 같다', () => {
  setup([rec({})], [['proj_1.json', T + 60000]]);
  assert.equal(recovery.healSavedAfterUnknown().healed, 1);
  assert.deepEqual(shown(), []);
});
