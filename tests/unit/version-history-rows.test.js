/* U3(데이터 계층) 하네스 — js/version-history.js
 * 실행: node --test "tests/unit/*.test.js"
 * ★행 하나가 「이 버전에 내가 잃은 게 살아 있나」에 답하는지, 그리고 «모르는 걸 안다고 말하지 않는지».
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

// version-diff.js(브라우저 IIFE)를 가짜 window 에 얹어 실제 lossDiff 가 돌게 한다.
const win = {};
new Function('window', fs.readFileSync(path.join(__dirname, '../../js/version-diff.js'), 'utf8'))(win);
global.window = win;
const VH = require('../../js/version-history.js');

const NOW = new Date(2026, 7, 27, 17, 30, 0).getTime(); // 2026-08-27 17:30 (로컬)
const s = (k, n) => ({ k, n });
function listOf(entries, current) {
  return { ok: true, current, entries, legacyCount: entries.filter(e => e.canon === 0).length,
           pendingCount: entries.filter(e => e.pending).length,
           totalBytes: entries.reduce((a, e) => a + (e.bytes || 0), 0) };
}
const entry = (over) => ({ ts: NOW - 3 * 3600000, file: 'x.json', reason: 'auto', pinned: false, canon: 1,
  bytes: 248000, name: 'T', counts: { pages: 1, sections: 3, blocks: 20, images: 2 },
  secs: [s('page_1::sec_a', 'A'), s('page_1::sec_b', 'B'), s('page_1::sec_c', 'C')], assets: [], ...over });
const current = (over) => ({ ts: NOW, bytes: 41000000, projMtimeMs: 1, name: 'T',
  counts: { pages: 1, sections: 1, blocks: 8, images: 2 }, secs: [s('page_1::sec_a', 'A')], ...over });

test('VH1 ★손실이 헤드라인으로 나온다 — 「어느 버전에 내 것이 있나」의 답', () => {
  const r = VH.buildRows(listOf([entry()], current()), { now: NOW });
  assert.equal(r.ok, true);
  assert.equal(r.rows.length, 1);
  assert.deepEqual(r.rows[0].lost.map(x => x.n), ['B', 'C']);
  assert.equal(r.rows[0].lostText, '지금은 없는 섹션 2 — B · C');
});

test('VH2 ★손실이 0 이면 손실 줄을 «안 그린다» — 노이즈가 목록을 죽인다', () => {
  const cur = current({ counts: { pages: 1, sections: 3, blocks: 20, images: 2 },
                        secs: [s('page_1::sec_a', 'A'), s('page_1::sec_b', 'B'), s('page_1::sec_c', 'C')] });
  const r = VH.buildRows(listOf([entry()], cur), { now: NOW });
  assert.equal(r.rows[0].lostText, '');
  assert.deepEqual(r.rows[0].lost, []);
});

test('VH3 ★4개 넘게 잃으면 이름 3개 + 「외 N」 — 한 줄이 넘치면 스캔이 안 된다', () => {
  const e = entry({ counts: { pages: 1, sections: 6, blocks: 40, images: 0 },
    secs: ['A', 'B', 'C', 'D', 'E', 'F'].map((n, i) => s(`page_1::sec_${i}`, n)) });
  const cur = current({ secs: [s('page_1::sec_0', 'A')] });
  const r = VH.buildRows(listOf([e], cur), { now: NOW });
  assert.equal(r.rows[0].lostText, '지금은 없는 섹션 5 — B · C · D 외 2');
});

test('VH4 ★숫자가 한 줄에 다 나온다 — 「사고 직전엔 24개였는데 지금 21개」', () => {
  const r = VH.buildRows(listOf([entry()], current()), { now: NOW });
  assert.equal(r.rows[0].sectionsText, '3');
  assert.equal(r.rows[0].blocksText, '20');
  assert.equal(r.rows[0].imagesText, '2');
  assert.equal(r.rows[0].sizeText, '242KB');
  assert.equal(r.currentRow.sectionsText, '1', '비교 기준인 «지금» 행이 있어야 한다');
  assert.equal(r.currentRow.whenText, '지금');
});

test('VH5 ★미분석 항목은 숫자를 «지어내지 않는다» — 0 으로 답하면 거짓 안심을 준다', () => {
  const e = entry({ pending: true, canon: 0, counts: null, secs: [], bytes: 41500000 });
  const r = VH.buildRows(listOf([e], current()), { now: NOW });
  assert.equal(r.rows[0].sectionsText, '—');
  assert.equal(r.rows[0].blocksText, '—');
  assert.equal(r.rows[0].lostText, '아직 분석 안 함');
  assert.deepEqual(r.rows[0].lost, []);
  assert.equal(r.rows[0].badgeText, '옛 형식 · 미분석');
  assert.equal(r.rows[0].sizeText, '39.6MB');
  assert.equal(r.pendingCount, 1);
});

test('VH6 ★version-diff 가 없으면 «손실 0»이 아니라 «비교 불가»라고 말한다', () => {
  const saved = global.window.versionDiff;
  delete global.window.versionDiff;
  try {
    const r = VH.buildRows(listOf([entry()], current()), { now: NOW });
    assert.equal(r.rows[0].lostText, '비교 불가');
    assert.deepEqual(r.rows[0].lost, []);
  } finally { global.window.versionDiff = saved; }
});

test('VH7 시각 표기 — 오늘/어제/그 이전', () => {
  assert.equal(VH.formatWhen(new Date(2026, 7, 27, 14, 22).getTime(), NOW), '오늘 14:22');
  assert.equal(VH.formatWhen(new Date(2026, 7, 26, 9, 5).getTime(), NOW), '어제 09:05');
  assert.equal(VH.formatWhen(new Date(2026, 7, 12, 9, 5).getTime(), NOW), '8월 12일 09:05');
});

test('VH8 경과 표기는 commit-system 과 같은 말투다 — 앱 안에서 표기가 갈리면 안 된다', () => {
  assert.equal(VH.formatTimeAgo(NOW - 30000, NOW), '방금 전');
  assert.equal(VH.formatTimeAgo(NOW - 12 * 60000, NOW), '12분 전');
  assert.equal(VH.formatTimeAgo(NOW - 3 * 3600000, NOW), '3시간 전');
  assert.equal(VH.formatTimeAgo(NOW - 3 * 86400000, NOW), '3일 전');
});

test('VH8b ★8일이 넘어도 «날짜로 바꾸지 않는다» — 옆에 절대 날짜가 이미 있어 두 번 찍힌다', () => {
  // 화면이 「8월 19일 08:17  8월 19일」로 나오던 것. 스크린샷에서만 잡혔다(숫자 검사로는 안 잡힌다).
  assert.equal(VH.formatTimeAgo(NOW - 9 * 86400000, NOW), '9일 전');
  assert.equal(VH.formatTimeAgo(NOW - 40 * 86400000, NOW), '40일 전');
  const r = VH.buildRows(listOf([entry({ ts: NOW - 40 * 86400000 })], current()), { now: NOW });
  assert.ok(!r.rows[0].agoText.includes('월'), `상대표기에 날짜가 들어갔다: ${r.rows[0].agoText}`);
  assert.notEqual(r.rows[0].whenText, r.rows[0].agoText, '★절대·상대 표기가 같은 말을 하면 안 된다');
});

test('VH9 pre-restore 행은 «되돌리기 직전»으로 보인다 — 취소 지점을 찾을 수 있어야 한다', () => {
  const r = VH.buildRows(listOf([entry({ reason: 'pre-restore', pinned: true })], current()), { now: NOW });
  assert.equal(r.rows[0].badgeText, '되돌리기 직전');
  assert.equal(r.rows[0].pinned, true);
});

test('VH10 옛 형식은 그렇게 표시된다(용량이 왜 큰지 사용자가 알아야 한다)', () => {
  const r = VH.buildRows(listOf([entry({ canon: 0, bytes: 41500000 })], current()), { now: NOW });
  assert.equal(r.rows[0].badgeText, '옛 형식');
  assert.equal(r.rows[0].legacy, true);
  assert.equal(r.legacyCount, 1);
});

test('VH11 실패 응답·빈 목록에서 던지지 않는다', () => {
  for (const bad of [null, undefined, {}, { ok: false, reason: 'unavailable' }]) {
    const r = VH.buildRows(bad, { now: NOW });
    assert.equal(r.ok, false);
    assert.deepEqual(r.rows, []);
  }
  const empty = VH.buildRows(listOf([], null), { now: NOW });
  assert.equal(empty.ok, true);
  assert.deepEqual(empty.rows, []);
  assert.equal(empty.currentRow, null);
});

test('VH12 ★U3 데이터 계층은 DOM 을 안 만진다 — 진입점은 현빈 Q1 답 뒤다', () => {
  const src = fs.readFileSync(path.join(__dirname, '../../js/version-history.js'), 'utf8');
  for (const t of ['document.', 'innerHTML', 'createElement', 'querySelector', 'addEventListener']) {
    assert.ok(!src.includes(t), `★${t} 가 들어왔다 — 이 단계는 순수 데이터 계층이어야 한다`);
  }
});
