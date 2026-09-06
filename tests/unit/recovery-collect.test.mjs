/* U-H3-C — 모으기·도장. (H3, 2026-09-06)
 *
 * ★재는 것 셋
 *   ⑴ H2·H4 가 남긴 «진짜 모양»의 흔적을 빠짐없이 읽는다 — ★깨진 파일도 «조용히 빠지지» 않는다
 *      (조용히 빠지면 「기록 없음」으로 읽힌다 — H2 recorder.js readRecent 주석의 그 자리).
 *   ⑵ 도장(attachedAt)을 찍으면 다시 «안 뜬다».
 *   ⑶ ★도장을 찍었어도 «원본은 그대로 있다» — 사용자가 나중에 다시 찾을 수 있어야 한다.
 *
 * ⛔합성 기록만으로 판정하지 않는다 — 이 파일은 «모양»을 잠그고,
 *   진짜 크래시/진짜 저장실패 입력은 tests/unit/recovery-live-artifact.test.mjs 가 잰다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const recovery = require(path.join(ROOT, 'main/recovery'));
const saveGuard = require(path.join(ROOT, 'main/quit/save-guard'));
const crash = require(path.join(ROOT, 'main/crash'));
const { mkTmpRoot } = require('./_tmproot');

function mkCrash(ud, ts, extra) {
  fs.writeFileSync(path.join(ud, 'logs', `crash-${ts}.json`), JSON.stringify({
    at: new Date(ts).toISOString(), kind: 'render-process-gone', appVersion: '0.8.5',
    os: 'darwin 25.3.0', arch: 'arm64', reason: 'crashed', exitCode: 2, ...(extra || {}),
  }), 'utf8');
}

function setup({ withMarker = true, broken = false } = {}) {
  const ud = mkTmpRoot('goya-h3-c-');
  fs.mkdirSync(path.join(ud, 'logs'), { recursive: true });
  fs.mkdirSync(path.join(ud, 'emergency-saves'), { recursive: true });
  mkCrash(ud, 1788000002000);
  mkCrash(ud, 1788000001000);
  if (broken) fs.writeFileSync(path.join(ud, 'logs', 'crash-1788000003000.json'), '{"at":"2026-', 'utf8');
  if (withMarker) {
    const em = path.join(ud, 'emergency-saves', 'proj_1788000000000-x.json');
    fs.writeFileSync(em, JSON.stringify({ version: 2, pages: [] }), 'utf8');
    fs.writeFileSync(path.join(ud, 'quit-save-failure.json'), JSON.stringify({
      v: 1, records: [
        { at: '2026-09-06T10:00:00.000Z', reason: 'save-failed', error: 'EACCES', projectId: 'proj_1788000000000',
          projectName: '내 상세페이지', appVersion: '0.8.5', emergencyPath: em, emergencyBytes: 30,
          emergencyError: null, handled: false },
        { at: '2026-09-05T10:00:00.000Z', reason: 'no-response', error: null, projectId: 'proj_1',
          projectName: '옛것', appVersion: '0.8.4', emergencyPath: null, emergencyBytes: null,
          emergencyError: 'no-snapshot', handled: true },   // ★이미 처리된 것 — 다시 안 떠야 한다
      ],
    }, null, 2), 'utf8');
  }
  saveGuard.init({ userDataDir: ud });
  crash._recorder.init({ getUserDataDir: () => ud, appVersion: '0.8.5' });
  recovery.init({ userDataDir: ud, crash, saveGuard });
  return ud;
}

test('U-H3-C1 저장 실패 + 크래시를 «둘 다» 모은다. handled=true 는 안 뜬다', () => {
  setup();
  const { items, counts } = recovery.localItems();
  assert.equal(counts.saveFailures, 1, 'handled=true 한 건까지 세고 있다(또는 못 읽었다)');
  assert.equal(counts.crashes, 2);
  assert.equal(counts.restorable, 1);
  assert.equal(items[0].kind, 'save-failure', '★잃은 것이 먼저 와야 한다 — 배너가 그걸 첫 줄로 쓴다');
  assert.equal(items[0].projectName, '내 상세페이지');
  assert.ok(items[0].emergencyExists, '사본이 있는데 없다고 읽었다 — 되살릴 수 있는데 못 하게 된다');
});

test('U-H3-C2 ★깨진 크래시 파일이 «조용히 빠지지» 않는다', () => {
  setup({ broken: true });
  const { items, counts } = recovery.localItems();
  assert.equal(counts.unreadable, 1,
    '★깨진 기록이 목록에서 사라졌다 — 그러면 「기록 없음」으로 읽힌다(H2 가 error:unreadable 로 주는 이유)');
  const u = items.find((i) => i.unreadable);
  assert.equal(u.kind, 'crash');
  assert.ok(u.id.startsWith('crash:crash-'), 'id 가 파일을 못 가리키면 도장을 못 찍는다: ' + u.id);
});

test('U-H3-C3 사본 파일이 «실제로 없으면» emergencyExists=false — 되살리기 버튼이 안 뜬다', () => {
  const ud = setup();
  const em = path.join(ud, 'emergency-saves', 'proj_1788000000000-x.json');
  fs.rmSync(em);
  const { items, counts } = recovery.localItems();
  assert.equal(counts.restorable, 0, '없는 파일을 «있다»고 말하고 있다 — 되살리기를 눌러도 실패한다');
  assert.equal(items[0].emergencyPath, null, '경로를 그대로 넘기면 화면이 「있다」고 그린다');
});

test('U-H3-C4 도장을 찍으면 다시 «안 뜬다» (attachedAt · handled)', () => {
  setup();
  const before = recovery.localItems().items;
  const r = recovery.ack(before.map((i) => i.id), '2026-09-06T12:00:00.000Z');
  assert.equal(r.failed.length, 0, '도장 실패: ' + JSON.stringify(r.failed));
  assert.equal(r.stamped, before.length);
  const after = recovery.localItems();
  assert.equal(after.counts.total, 0, '도장을 찍었는데 또 뜬다: ' + JSON.stringify(after.items.map((i) => i.id)));
});

test('U-H3-C5 ★★도장을 찍었다고 «원본을 지우지 않는다» — 나중에 다시 찾을 수 있어야 한다', () => {
  const ud = setup();
  const before = recovery.localItems().items;
  const crashFile = before.find((i) => i.kind === 'crash').id.slice(6);
  const raw0 = JSON.parse(fs.readFileSync(path.join(ud, 'logs', crashFile), 'utf8'));
  recovery.ack(before.map((i) => i.id), '2026-09-06T12:00:00.000Z');

  const p = path.join(ud, 'logs', crashFile);
  assert.ok(fs.existsSync(p), '★크래시 기록 파일이 «지워졌다» — 반려 조건이다');
  const raw1 = JSON.parse(fs.readFileSync(p, 'utf8'));
  assert.equal(raw1.attachedAt, '2026-09-06T12:00:00.000Z', 'attachedAt 도장이 안 찍혔다');
  /* 도장 «한 칸»만 늘었는지 — 기록 내용은 그대로여야 한다. */
  delete raw1.attachedAt;
  assert.deepEqual(raw1, raw0, '도장을 찍으면서 기록 내용이 바뀌었다');

  const em = path.join(ud, 'emergency-saves', 'proj_1788000000000-x.json');
  assert.ok(fs.existsSync(em), '★비상 사본이 지워졌다 — 사용자가 문서를 잃는다');
  const marker = JSON.parse(fs.readFileSync(path.join(ud, 'quit-save-failure.json'), 'utf8'));
  assert.equal(marker.records.length, 2, '마커 기록이 지워졌다 — handled 만 켜야 한다');
  assert.equal(marker.records[0].handled, true);
});

test('U-H3-C6 «못 새기는» 깨진 파일도 다시 안 뜬다(곁장부 폴백)', () => {
  const ud = setup({ withMarker: false, broken: true });
  const items = recovery.localItems().items;
  const u = items.find((i) => i.unreadable);
  assert.ok(u, '전제 실패: 깨진 항목이 없다');
  const r = recovery.ack([u.id], '2026-09-06T12:00:00.000Z');
  assert.ok(r.ledgerUsed >= 1, '★깨진 파일은 안에 못 새긴다 — 곁장부가 안 돌면 영원히 다시 뜬다');
  assert.equal(recovery.localItems().counts.unreadable, 0, '곁장부를 안 읽고 있다');
  assert.ok(fs.existsSync(path.join(ud, 'logs', 'crash-1788000003000.json')), '깨진 파일을 지웠다 — 지우지 마라');
});

test('U-H3-C7 도장 id 는 «파일 이름 모양»만 받는다 — 경로 조작 차단', () => {
  const ud = setup({ withMarker: false });
  const r = recovery.ack(['crash:../../../etc/passwd', 'crash:../quit-save-failure.json'], '2026-09-06T12:00:00.000Z');
  assert.equal(r.stamped, 0, '★crash-<숫자>.json 이 아닌 이름이 통과했다 — IPC 는 누구나 부르는 문이다');
  assert.ok(fs.existsSync(path.join(ud, 'logs', 'crash-1788000001000.json')));
});

test('U-H3-C8 «없다»와 «못 읽었다»를 가른다 — degraded 를 삼키지 않는다', () => {
  const ud = mkTmpRoot('goya-h3-c8-');
  saveGuard.init({ userDataDir: ud });
  crash._recorder.init({ getUserDataDir: () => ud, appVersion: '0.8.5' });
  recovery.init({
    userDataDir: ud, crash: { readRecent: () => { throw new Error('logs 를 못 읽는다'); } }, saveGuard,
  });
  const r = recovery.localItems();
  assert.equal(r.counts.total, 0);
  assert.ok(r.degraded.some((s) => s.includes('logs 를 못 읽는다')),
    '★읽기 실패를 삼켰다 — 화면이 「사고 없음」으로 읽는다: ' + JSON.stringify(r.degraded));
});
