/* 3차 적대검수(파괴 경로) 회귀 — «사용자 데이터를 잃는» 경로만 모은다.
 * 실행: node tests/unit/destructive.test.js
 *
 * ★이 파일의 규칙: 각 테스트는 «해당 가드를 지우면 빨강»이어야 한다.
 *   지워도 초록인 테스트는 이 파일에 있을 자격이 없다(3차 검수 변이 스윕 57건의 교훈).
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const SS = require('../../main/project-store/snapshot-store');

const MIN = 60 * 1000, DAY = 86400000;
const NOW = 1_787_700_000_000;
const mkRoot = () => fs.mkdtempSync(path.join(os.tmpdir(), 'goya-de-'));
const sec = (id, name) => `<div class="section-block" id="${id}" data-name="${name || id}">`
  + `<div class="section-hitzone"><span class="section-label">${name || id}</span></div></div>`;
const proj = (id, canvas, extra = {}) => ({ id, name: 'T', version: 2, currentPageId: 'page_1',
  pages: [{ id: 'page_1', name: 'Page 1', canvas }], ...extra });
function writeProjFile(root, id, data) {
  fs.mkdirSync(path.join(root, id), { recursive: true });
  fs.writeFileSync(path.join(root, id, 'proj.json'), JSON.stringify(data, null, 2));
}
/** 안전판 N개를 «각각 예산의 1/3» 크기로 만든다 — 3개만 넘어도 예산을 넘긴다. */
function seedSafety(root, id, n, bytesEach) {
  writeProjFile(root, id, proj(id, sec('sec_a', 'A')));
  const ts = [];
  for (let i = 0; i < n; i++) {
    const w = SS.writeSnapshot(root, id, proj(id, sec('sec_' + i, '작업' + i)),
      { reason: 'pre-restore', force: true, now: NOW - (n - 1 - i) * 3 * MIN });
    assert.equal(w.ok, true, `안전판 ${i} 기록 실패`);
    ts.push(w.ts);
  }
  const idx = SS.readIndex(root, id);
  idx.entries.forEach(e => { e.bytes = bytesEach; });
  SS.writeIndex(root, id, idx);
  return ts;   // 오래된 → 새것 순
}

/* ═══ A① (치명) — 프룬이 «방금 약속한 안전판»을 지운다 ═══════════════════ */

test('A1a ★교체 6회 뒤에도 «가장 새» 안전판이 살아있다 — 확인창이 그걸로 되돌릴 수 있다고 말했다', () => {
  const root = mkRoot();
  // ★압력을 «최대»로 준다 — 개당 예산 전체. 그래야 「예산 계산이 어쩌다 멈춰서 살아남은」
  //   가짜 초록이 안 생긴다(변이 스윕에서 개당 예산/3 은 A1b 를 거짓 초록으로 만들었다).
  const ts = seedSafety(root, 'p', 6, SS.BUDGET_BYTES);
  const newest = ts[ts.length - 1];

  SS.pruneVersions(root, 'p', { now: NOW });
  const live = new Set(SS.readIndex(root, 'p').entries.map(e => e.ts));
  assert.ok(live.has(newest),
    '★가장 새 안전판이 사라졌다 — UI 는 「직전 상태는 목록 맨 위에 있어요」라고 말한 참이다. '
    + '되돌아간 옛 버전이 현재이므로 «교체 직전의 내 작업»은 여기 말고 어디에도 없다');
  assert.ok(fs.existsSync(path.join(root, 'p', 'proj_history', `${newest}.json`)), '인덱스만 남고 파일이 없다');
});

test('A1b 가장 «오래된» 안전판도 남는다 — 그 소동 이전으로 가는 유일한 길', () => {
  const root = mkRoot();
  const ts = seedSafety(root, 'p', 6, SS.BUDGET_BYTES);
  SS.pruneVersions(root, 'p', { now: NOW });
  const live = new Set(SS.readIndex(root, 'p').entries.map(e => e.ts));
  assert.ok(live.has(ts[0]), '★가장 오래된 안전판이 사라졌다 — 되돌리기 연타 이전으로 갈 방법이 없어진다');
});

test('A1c ★그래도 «중간»은 버린다 — 예산 가드가 통째로 죽은 게 아님을 확인(양성대조)', () => {
  const root = mkRoot();
  const ts = seedSafety(root, 'p', 6, SS.BUDGET_BYTES);
  const pr = SS.pruneVersions(root, 'p', { now: NOW });
  assert.ok(pr.deleted.length > 0,
    '★하나도 안 버렸다 — 위 두 테스트가 「예산 루프가 아예 안 돈다」는 이유로 초록일 수 있다');
  const live = new Set(SS.readIndex(root, 'p').entries.map(e => e.ts));
  for (const t of pr.deleted.map(f => parseInt(f))) {
    assert.notEqual(t, ts[0]); assert.notEqual(t, ts[ts.length - 1]);
  }
  assert.ok(live.size < 6);
});

test('A1d 안전판이 2개뿐이면 예산을 넘겨도 «하나도» 안 버린다 — 약속이 예산보다 앞선다', () => {
  const root = mkRoot();
  const ts = seedSafety(root, 'p', 2, SS.BUDGET_BYTES);   // 합계 = 예산의 2배
  const pr = SS.pruneVersions(root, 'p', { now: NOW });
  const live = new Set(SS.readIndex(root, 'p').entries.map(e => e.ts));
  assert.ok(live.has(ts[0]) && live.has(ts[1]),
    '★안전판이 둘뿐인데 하나를 버렸다 — 둘 중 하나는 반드시 «약속한 취소 지점»이다');
  assert.equal(pr.deleted.length, 0);
});
