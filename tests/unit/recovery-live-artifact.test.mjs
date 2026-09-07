/* U-H3-L — ★«진짜 실기»가 만든 흔적을 입력으로 쓴다. (H3, 2026-09-06)
 *
 * ★왜 이 파일이 따로 있나
 *   합성 기록으로만 판정하면 «내 머릿속 스키마»를 통과시키게 된다. 오늘 이 프로젝트에서
 *   그 실패가 여러 번 났다(H2 초판·H4 초판 둘 다 실기가 뒤집었다).
 *   ⇒ 여기서 쓰는 입력은 tests/unit/_fixture-h3-live/ — H2 하네스(진짜 렌더러 크래시·
 *     진짜 메인 예외)와 H4 러너(chmod 로 진짜 EACCES)가 «실제로» 만든 파일 그대로다.
 *     자세한 출처는 그 폴더의 README.md.
 *
 * ⛔픽스처를 «고쳐서» 통과시키지 마라. 이 검사가 빨강이면 답은 둘 중 하나다:
 *   ㉮ H2/H4 의 기록 «모양»이 바뀌었다 → 하네스를 다시 돌려 픽스처를 갈아라(README 참조).
 *   ㉯ H3 의 읽기가 깨졌다 → 코드를 고쳐라.
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
const FIX = path.join(__dirname, '_fixture-h3-live');
const recovery = require(path.join(ROOT, 'main/recovery'));
const saveGuard = require(path.join(ROOT, 'main/quit/save-guard'));
const crash = require(path.join(ROOT, 'main/crash'));
const R = require(path.join(ROOT, 'js/recovery-banner.js'));
const { mkTmpRoot } = require('./_tmproot');

/** 픽스처를 «쓸 수 있는» 임시 ud 로 옮겨 심는다(원본 픽스처는 안 건드린다 — 도장이 찍히면 안 되므로). */
function plant() {
  const ud = mkTmpRoot('goya-h3-l-');
  fs.mkdirSync(path.join(ud, 'logs'), { recursive: true });
  fs.mkdirSync(path.join(ud, 'emergency-saves'), { recursive: true });
  for (const n of fs.readdirSync(path.join(FIX, 'logs'))) {
    fs.copyFileSync(path.join(FIX, 'logs', n), path.join(ud, 'logs', n));
  }
  let emergencyPath = null;
  for (const n of fs.readdirSync(path.join(FIX, 'emergency-saves'))) {
    emergencyPath = path.join(ud, 'emergency-saves', n);
    fs.copyFileSync(path.join(FIX, 'emergency-saves', n), emergencyPath);
  }
  /* 마커의 emergencyPath 는 «만들어졌던 그 기계»의 절대경로다 — 임시 ud 로 옮겨 심는다.
     ★이것이 「그 기계에서만 되는 검사」를 만들지 않는 유일한 손질이고, 그 밖엔 원문 그대로다. */
  const marker = JSON.parse(fs.readFileSync(path.join(FIX, 'quit-save-failure.json'), 'utf8'));
  marker.records[0].emergencyPath = emergencyPath;
  fs.writeFileSync(path.join(ud, 'quit-save-failure.json'), JSON.stringify(marker, null, 2), 'utf8');

  saveGuard.init({ userDataDir: ud });
  crash._recorder.init({ getUserDataDir: () => ud, appVersion: '0.9.1' });
  recovery.init({ userDataDir: ud, crash, saveGuard });
  return { ud, emergencyPath, marker };
}

test('U-H3-L1 진짜 렌더러 크래시 · 진짜 메인 예외 · 진짜 EACCES 저장실패를 «전부» 읽는다', () => {
  plant();
  const { items, counts, degraded } = recovery.localItems();
  assert.deepEqual(degraded, [], '읽기 실패가 있다: ' + JSON.stringify(degraded));
  assert.equal(counts.saveFailures, 1, 'H4 의 진짜 저장 실패를 못 읽었다');
  assert.equal(counts.crashes, 2, 'H2 의 진짜 크래시 2건을 못 읽었다: ' + counts.crashes);
  assert.equal(counts.restorable, 1, '★진짜 비상 사본이 있는데 되살릴 수 없다고 읽었다');

  const kinds = items.filter((i) => i.kind === 'crash').map((i) => i.crashKind);
  assert.ok(kinds.includes('render-process-gone'), '렌더러 사망 기록을 못 알아본다: ' + kinds);
  assert.ok(kinds.includes('uncaught-exception'), '메인 예외 기록을 못 알아본다: ' + kinds);
});

test('U-H3-L2 ★배너 문구가 «진짜 사건»에서 실제로 만들어진다', () => {
  plant();
  const p = recovery.localItems();
  const d = R.decide({ items: p.items, counts: p.counts });
  assert.ok(d && d.show, '★진짜 사고가 셋인데 배너가 안 뜬다 = 「복구할 수 있었는데 못 했다」');
  assert.ok(d.headline.includes('H7 fixture'), '어느 프로젝트인지 안 말한다: ' + d.headline);
  assert.ok(/되살/.test(d.sub), '되살릴 수 있다는 사실을 안 말한다: ' + d.sub);
  assert.ok(!/모달|확인해야|차단/.test(d.headline + d.sub), '막는 문구다 — 이 배너는 사용자를 안 막는다');
});

test('U-H3-L3 ★★진짜 문서 스냅샷이 신고로 새지 않는다 (양성대조 = 픽스처 원문)', () => {
  const { emergencyPath } = plant();
  const raw = fs.readFileSync(emergencyPath, 'utf8');
  const snap = JSON.parse(raw);
  const canvas = String(snap.pages[0].canvas);
  const marks = canvas.match(/H7-EDIT-\d+/g) || [];
  assert.ok(marks.length > 0, '전제 실패 — 진짜 사본에 편집 표식이 없다(양성대조가 성립 안 한다)');

  const lines = recovery.reportLines(recovery.localItems().items);
  const blob = JSON.stringify(lines);
  for (const m of new Set(marks)) {
    assert.ok(!blob.includes(m), `★진짜 문서 본문(${m})이 신고 payload 로 새고 있다 — 반려 조건이다`);
  }
  assert.ok(!blob.includes('h7-edit-marker'), '★캔버스 HTML 조각이 새고 있다');
  assert.ok(!blob.includes('srv-지디_qa-ud-h4'), '★비상 사본 경로(홈 경로)가 새고 있다');
  assert.ok(!blob.includes('H7 fixture'), '★프로젝트 이름이 새고 있다');
});

test('U-H3-L4 그래도 «진짜 원인»은 나간다 — EACCES 와 크래시 exitCode', () => {
  plant();
  const blob = JSON.stringify(recovery.reportLines(recovery.localItems().items));
  assert.ok(blob.includes('EACCES'), '★저장이 왜 실패했는지가 안 나간다 — 우리가 원인을 못 받는다');
  assert.ok(blob.includes('render-process-gone'), '크래시 종류가 안 나간다');
  assert.ok(blob.includes('exit=2'), '종료코드가 안 나간다');
  assert.ok(blob.includes('emergencyCopy=yes'), '사본 유무(참/거짓)가 안 나간다');
  /* 크래시 «직전» 렌더러가 남긴 진짜 오류 — 원인 추적의 유일한 단서다. */
  assert.ok(blob.includes("Cannot read properties of null"),
    '★렌더러가 죽기 직전 남긴 진짜 오류가 안 실린다');
});

test('U-H3-L5 ★H2 의 scrub 을 믿되 «확인»한다 — 홈 경로가 그대로 나가지 않는다', () => {
  plant();
  const blob = JSON.stringify(recovery.reportLines(recovery.localItems().items));
  assert.ok(!/\/Users\/[^/"\\]+\//.test(blob),
    '★홈 경로가 씻기지 않고 나간다(사용자 계정 이름 노출):\n' + blob.slice(0, 600));
});

test('U-H3-L6 진짜 사본은 «되살릴 수 있는 모양»이다 — 파싱되고 pages 를 갖는다', () => {
  const { emergencyPath } = plant();
  const r = recovery.readEmergencySnapshot(emergencyPath);
  assert.equal(r.ok, true, '★진짜 사본을 못 읽는다 = 되살리기가 실패한다: ' + JSON.stringify(r));
  assert.ok(Array.isArray(r.data.pages) && r.data.pages.length, 'pages 가 없다 — 되살려도 빈 프로젝트가 된다');
  assert.equal(r.data.version, 2);
});
