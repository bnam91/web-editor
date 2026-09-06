/* U-H3-X — ★이 단위의 «반려 조건»을 기계로 잠근다: 「모르게 내용이 나갔다」. (H3, 2026-09-06)
 *
 * ★왜 이 파일이 제일 중요한가
 *   H3 은 크래시 기록을 신고에 실을 수 있게 만든다. 그 기록엔 렌더러 링버퍼 사본이 붙고,
 *   비상 사본(emergency-saves/)은 «사용자 문서 본문 그 자체»다. 지디 확정:
 *     괜찮다 : 「불필요한 안내를 봤다」
 *     안 된다: 「복구할 수 있었는데 못 했다」 · ★「모르게 내용이 나갔다」
 *   ⇒ 여기서는 «양성대조»로 잰다 — 사본과 프로젝트 이름에 «표식»을 심고,
 *     그 표식이 나갈 줄(reportLines) 어디에도 «없는지»를 본다.
 *   ⛔「필드를 안 넣었다」를 눈으로 보고 통과시키지 않는다. 그건 검사처럼 «생긴» 문장이다.
 *
 * ★고치기 «전»이었다면 빨강인가 — X4 가 그 답이다.
 *   reportLines() 를 「항목을 통째로 실어 몇 개만 지운다」(=흔한 초판)로 바꾸면 X1·X2 가
 *   즉시 빨강이 된다. X4 는 그 «구조»(허용목록 투영) 자체가 유지되는지를 따로 못 박는다.
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
const { mkTmpRoot } = require('./_tmproot');

/* ── 표식 — 이 문자열이 나가면 «사고»다 ───────────────────────────────── */
const SECRET_BODY = 'GOYA-H3-SECRET-DOCUMENT-BODY-9f21';   // 비상 사본 «안»의 본문
const SECRET_NAME = 'GOYA-H3-CLIENT-PROJECT-NAME-4a7c';    // 고객사 프로젝트 이름
const SECRET_PATH_SEG = 'GOYA-H3-PATHSEG-1b3d';            // 비상 사본 «경로»에 든 조각

function setup() {
  const ud = mkTmpRoot('goya-h3-x-');
  fs.mkdirSync(path.join(ud, 'logs'), { recursive: true });
  fs.mkdirSync(path.join(ud, 'emergency-saves'), { recursive: true });

  /* ⑴ 비상 사본 — «문서 본문 그 자체». 경로에도 표식을 박는다. */
  const emergencyPath = path.join(ud, 'emergency-saves', `proj_${SECRET_PATH_SEG}-x.json`);
  fs.writeFileSync(emergencyPath, JSON.stringify({
    version: 2, currentPageId: 'page_1',
    pages: [{ id: 'page_1', name: 'Page 1', canvas: `<div>${SECRET_BODY}</div>` }],
  }), 'utf8');

  /* ⑵ H4 마커 — 프로젝트 «이름»에 표식. */
  fs.writeFileSync(path.join(ud, 'quit-save-failure.json'), JSON.stringify({
    v: 1, records: [{
      at: '2026-09-06T10:00:00.000Z', reason: 'save-failed', error: 'EACCES: permission denied',
      projectId: 'proj_1788000000000', projectName: SECRET_NAME, appVersion: '0.8.5',
      emergencyPath, emergencyBytes: 120, emergencyError: null, handled: false,
    }],
  }, null, 2), 'utf8');

  /* ⑶ H2 크래시 기록 — 진짜 기록과 같은 모양(errors[] 포함). */
  fs.writeFileSync(path.join(ud, 'logs', 'crash-1788000001000.json'), JSON.stringify({
    at: '2026-09-06T10:00:01.000Z', kind: 'render-process-gone', appVersion: '0.8.5',
    os: 'darwin 25.3.0', arch: 'arm64', reason: 'crashed', exitCode: 2,
    projectId: 'proj_1788000000000',
    errors: [{ at: '2026-09-06T10:00:00.900Z', level: 'console.error', msg: '[section] blob decode 실패 id=sec_12' }],
    errorsAsOf: 1788000000900,
    recorder: { swallowed: 0, firstSwallow: null, scrub: 'report-buffer', session: 1 },
  }), 'utf8');

  saveGuard.init({ userDataDir: ud });
  const crash = require(path.join(ROOT, 'main/crash'));
  crash._recorder.init({ getUserDataDir: () => ud, appVersion: '0.8.5' });
  recovery.init({ userDataDir: ud, crash, saveGuard });
  return { ud, emergencyPath };
}

test('U-H3-X0 (전제) 표식이 «실제로» 그 자리에 있다 — 양성대조', () => {
  const { emergencyPath } = setup();
  const raw = fs.readFileSync(emergencyPath, 'utf8');
  assert.ok(raw.includes(SECRET_BODY), '비상 사본에 본문 표식이 없다 — 이 검사 전체가 무의미해진다');
  const { items } = recovery.localItems();
  const sf = items.find((i) => i.kind === 'save-failure');
  assert.ok(sf, '저장 실패 항목을 못 읽었다');
  /* ★화면 쪽엔 «있어야» 한다 — 사용자는 어느 프로젝트인지 알아야 되찾는다. */
  assert.equal(sf.projectName, SECRET_NAME, '화면용 항목에 프로젝트 이름이 없다 — 되찾을 대상을 못 고른다');
  assert.ok(String(sf.emergencyPath).includes(SECRET_PATH_SEG), '화면용 항목에 사본 경로가 없다');
});

test('U-H3-X1 ★★비상 사본의 «본문»은 나갈 줄 어디에도 없다', () => {
  setup();
  const { items } = recovery.localItems();
  const blob = JSON.stringify(recovery.reportLines(items));
  assert.ok(!blob.includes(SECRET_BODY),
    '★사용자 문서 본문이 신고 payload 로 새고 있다 — 이 단위의 반려 조건이다:\n' + blob.slice(0, 800));
});

test('U-H3-X2 ★프로젝트 «이름»과 사본 «경로»도 나가지 않는다', () => {
  setup();
  const { items } = recovery.localItems();
  const blob = JSON.stringify(recovery.reportLines(items));
  assert.ok(!blob.includes(SECRET_NAME),
    '고객사 프로젝트 이름이 나간다 — 「애매하면 안 보내는 쪽」 위반:\n' + blob.slice(0, 800));
  assert.ok(!blob.includes(SECRET_PATH_SEG),
    '비상 사본 경로(홈 경로+프로젝트 id)가 나간다:\n' + blob.slice(0, 800));
});

test('U-H3-X3 그래도 «원인은» 나간다 — 안전하다고 아무것도 안 보내면 이 단위가 무의미하다', () => {
  setup();
  const { items } = recovery.localItems();
  const lines = recovery.reportLines(items);
  const blob = JSON.stringify(lines);
  assert.ok(lines.length >= 3, '줄이 너무 적다(' + lines.length + ') — 저장실패1 + 크래시1 + 크래시로그1');
  assert.ok(blob.includes('EACCES'), '저장 실패 «원인»이 안 나간다 — 우리가 원인을 못 받는다');
  assert.ok(blob.includes('render-process-gone'), '크래시 종류가 안 나간다');
  assert.ok(blob.includes('blob decode 실패'), '크래시 «직전» 렌더러 오류가 안 나간다 — 원인 추적의 유일한 단서다');
  assert.ok(blob.includes('emergencyCopy=yes'), '사본이 있었는지 여부(참/거짓)조차 안 나간다');
});

test('U-H3-X4 ★구조 잠금 — reportLines 는 «허용목록 투영»이지 「통째로 넣고 지우기」가 아니다', () => {
  /* ★★「깜빡하고 안 지웠다」가 성립할 수 없어야 한다. 항목에 «모르는 새 필드»가 생겨도
     나가면 안 된다 — 그게 이 검사가 지키는 것이다(오늘 밟은 함정: 「돌아는 가는데 효과 0」). */
  setup();
  const { items } = recovery.localItems();
  const FUTURE = 'GOYA-H3-FUTURE-FIELD-e5b8';
  for (const it of items) { it.someFutureField = FUTURE; it.snapshot = FUTURE; }
  const blob = JSON.stringify(recovery.reportLines(items));
  assert.ok(!blob.includes(FUTURE),
    '★항목에 새 필드가 붙으니 그대로 나갔다 = 「통째로 넣고 몇 개 지우기」 구조다. ' +
    '허용목록 투영으로 되돌려라(main/recovery/index.js reportLines 주석):\n' + blob.slice(0, 800));
});

test('U-H3-X5 줄 수·길이 상한 — 서버 LIMITS 를 넘겨 신고가 통째로 거절되지 않게', () => {
  const { ud } = setup();
  /* 크래시 기록을 여러 개 + 아주 긴 오류 줄로 채운다. */
  for (let i = 0; i < 8; i++) {
    fs.writeFileSync(path.join(ud, 'logs', `crash-17880000100${i}.json`), JSON.stringify({
      at: `2026-09-06T11:0${i}:00.000Z`, kind: 'uncaught-exception', appVersion: '0.8.5',
      os: 'darwin 25.3.0', arch: 'arm64', reason: 'boom ' + i,
      errors: Array.from({ length: 6 }, (_, k) => ({ at: '2026-09-06T11:00:00.000Z', level: 'console.error', msg: 'X'.repeat(4000) + k })),
    }), 'utf8');
  }
  const { items } = recovery.localItems();
  const lines = recovery.reportLines(items);
  assert.ok(lines.length <= recovery.MAX_REPORT_LINES, '줄 수 상한 초과: ' + lines.length);
  for (const l of lines) {
    assert.ok(l.msg.length <= recovery.MAX_LINE_LEN, '한 줄이 상한을 넘었다: ' + l.msg.length);
  }
});

test('U-H3-X6 ★사용자가 «보는 것»과 «나가는 것»이 같다 — 요약·생략 금지', () => {
  setup();
  const R = require(path.join(ROOT, 'js/recovery-banner.js'));
  const { items } = recovery.localItems();
  const lines = recovery.reportLines(items);
  const shown = R.outgoingText(lines);
  for (const l of lines) {
    assert.ok(shown.includes(l.msg),
      '★나갈 줄인데 화면에 «그대로» 안 보인다 — 「진단 정보가 포함됩니다」식 뭉뚱그림 금지:\n' + l.msg.slice(0, 200));
  }
  assert.ok(!/…|\.\.\./.test(shown.replace(/\.\.\.[a-zA-Z]/g, '')),
    '보여주는 문자열이 «줄여져» 있다 — 본 것과 나간 것이 달라진다');
});

test('U-H3-X7 신고 payload 로 «싣는 자리»는 errors[] 다 — 최상위 새 필드는 서버가 조용히 버린다', () => {
  const R = require(path.join(ROOT, 'js/recovery-banner.js'));
  const lines = [{ at: '2026-09-06T10:00:00.000Z', level: 'crash', msg: 'A' }];
  const merged = R.mergeRecoveryLines([{ at: 'x', level: 'console.error', msg: 'old' }], lines);
  assert.ok(Array.isArray(merged), 'errors[] 배열이 아니다');
  assert.ok(merged.some((e) => e.msg === 'A'), '복구 줄이 errors[] 에 안 실렸다 — E3 과 같은 함정을 다시 밟았다');
  /* 넘칠 때 «가장 오래된 것»부터 밀어낸다 — 방금 만든 복구 줄이 밀려나면 신고가 무의미하다. */
  const many = Array.from({ length: 25 }, (_, i) => ({ at: 'x', level: 'console.error', msg: 'old' + i }));
  const big = R.mergeRecoveryLines(many, Array.from({ length: 5 }, (_, i) => ({ at: 'y', level: 'crash', msg: 'new' + i })));
  assert.equal(big.length, R.MAX_ERRORS, '상한 ' + R.MAX_ERRORS + ' 를 안 지킨다: ' + big.length);
  for (let i = 0; i < 5; i++) {
    assert.ok(big.some((e) => e.msg === 'new' + i), '복구 줄 new' + i + ' 이 밀려 사라졌다');
  }
});
