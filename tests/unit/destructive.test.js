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

/* ═══ C④ (중대) — 협업 스냅샷이 «영원히» 안 지워진다 ═════════════════════ */

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
function mkCollab(root, id) {
  fs.mkdirSync(path.join(root, id), { recursive: true });
  fs.writeFileSync(path.join(root, id, 'proj_meta.json'),
    JSON.stringify({ collabRef: { roomId: 'room_1' } }));
}
/** 협업 프로젝트에 스냅샷 n개를 «하루 간격»으로 쌓는다(외부화 금지 → verbatim, canon=0). */
function seedCollabSnaps(root, id, n, startTs) {
  const canvas = sec('sec_a', 'A') + `<img src="${PNG}">`;
  for (let i = 0; i < n; i++) {
    const now = startTs + i * DAY;
    writeProjFile(root, id, proj(id, canvas + `<!--${i}-->`));
    const w = SS.writeSnapshot(root, id, proj(id, canvas + `<!--${i}-->`), { now });
    assert.equal(w.ok, true, `${i}: ${JSON.stringify(w)}`);
    assert.equal(w.collabVerbatim, true, `${i}: 협업인데 외부화가 돌았다(전제 실패)`);
  }
}

test('C4a ★협업 스냅샷도 보관정책을 «탄다» — 상한 없이 쌓이지 않는다', () => {
  const root = mkRoot();
  mkCollab(root, 'c');
  const n = 90;
  seedCollabSnaps(root, 'c', n, NOW - (n - 1) * DAY);   // 90일치, 오늘까지
  const before = SS.readIndex(root, 'c').entries.length;
  assert.equal(before, n, '전제 실패: 90개가 안 쌓였다');
  assert.ok(SS.readIndex(root, 'c').entries.every(e => e.canon === 0),
    '전제 실패: 협업인데 canon=1 이다(외부화가 돌았다)');

  const pr = SS.pruneVersions(root, 'c', { now: NOW });
  assert.ok(pr.deleted.length > 0,
    '★삭제 0 — 협업 프로젝트에서 보관정책이 통째로 꺼져 있다(실행: 720슬롯/281MB/삭제 0, 최대 1.9GB/일)');
  const kept = SS.readIndex(root, 'c').entries;
  // ★계층 보관의 «상한»이 이 기능의 약속이다: 최근 N + 하루 1개 × D일 + 핀.
  //   (RECENT_KEEP 은 «개수» 기준이라 30일 밖도 남을 수 있다 — 그게 설계다. 상한이 있다는 게 요점.)
  const bound = SS.RECENT_KEEP + SS.DAILY_DAYS + 1;
  assert.ok(kept.length <= bound,
    `★상한을 넘었다 kept=${kept.length} > ${bound} — 협업에서 보관정책이 반만 돈다`);
  assert.ok(kept.length < before);
});

test('C4b ★그래도 «진짜 레거시»(기능 이전 슬롯)는 무접촉이다 — 한 뿌리를 갈랐지 보호를 없앤 게 아니다', () => {
  const root = mkRoot();
  const hd = path.join(root, 'L', 'proj_history');
  fs.mkdirSync(hd, { recursive: true });
  for (let i = 0; i < 40; i++) {   // 비협업 프로젝트의 옛 무거운 슬롯 40개(60일 전부터)
    fs.writeFileSync(path.join(hd, `${NOW - (60 - i) * DAY}.json`),
      JSON.stringify(proj('L', sec('sec_a', 'A') + `<img src="${PNG}"><!--${i}-->`)));
  }
  const idx = SS.ensureIndex(root, 'L');
  assert.ok(idx.entries.every(e => e.canon === 0 && e.legacy === 1),
    '★비협업의 canon=0 은 legacy=1 이어야 한다');
  writeProjFile(root, 'L', proj('L', sec('sec_a', 'A')));
  SS.pruneVersions(root, 'L', { now: NOW });
  assert.equal(SS.readIndex(root, 'L').entries.length, 40,
    '★기능 이전 레거시를 지웠다 — 복구 도구가 사용자 데이터를 지우고 시작하면 안 된다(P-2)');
});

test('C4c ★인덱스를 잃어도 협업 스냅샷이 다시 «영구 보존»으로 돌아가지 않는다', () => {
  const root = mkRoot();
  mkCollab(root, 'c');
  seedCollabSnaps(root, 'c', 40, NOW - 120 * DAY);
  fs.unlinkSync(path.join(root, 'c', 'proj_history', 'index.json'));   // 인덱스 유실
  const rebuilt = SS.ensureIndex(root, 'c');
  assert.ok(rebuilt.entries.every(e => e.canon === 0), '전제: 여전히 verbatim');
  assert.ok(rebuilt.entries.every(e => e.legacy === 0),
    '★재빌드가 협업 verbatim 을 «레거시»로 오인했다 — 인덱스 한 번 잃으면 상한이 사라진다');
  assert.ok(SS.pruneVersions(root, 'c', { now: NOW }).deleted.length > 0);
});

/* ═══ C⑤ (중대) — isCollab fail-open ═══════════════════════════════════ */

test('C5a ★meta 를 «못 읽으면» 협업으로 본다 — [F5] 규율이 옆문으로 열려 있었다', () => {
  const root = mkRoot();
  fs.mkdirSync(path.join(root, 'x'), { recursive: true });
  fs.writeFileSync(path.join(root, 'x', 'proj_meta.json'), '{"collabRef":{"roomI');  // 잘린 meta
  const data = proj('x', sec('sec_a', 'A') + `<img src="${PNG}">`);
  writeProjFile(root, 'x', data);
  const w = SS.writeSnapshot(root, 'x', data, { now: NOW });
  assert.equal(w.ok, true);
  assert.equal(w.collabVerbatim, true,
    '★불명인데 «비협업»으로 단정하고 외부화했다 — 상대 디스크에 없는 goya-asset:// 이 나간다');
});

test('C5b meta 가 «아예 없으면» 비협업이 맞다 — 불명과 부재는 다르다(양성대조)', () => {
  const root = mkRoot();
  const data = proj('y', sec('sec_a', 'A') + `<img src="${PNG}">`);
  writeProjFile(root, 'y', data);
  const w = SS.writeSnapshot(root, 'y', data, { now: NOW });
  assert.equal(w.ok, true);
  assert.ok(!w.collabVerbatim, '★등록된 적 없는 프로젝트까지 협업으로 보면 외부화가 영영 안 돈다');
  assert.ok(w.images > 0, '전제: 외부화가 실제로 돌았다');
});

test('C4d ★협업 스냅샷이 «예산»에도 잡힌다 — 세 겹 중 마지막 겹', () => {
  /* ⚠️C4a/C4c 만으로는 부족했다: 계층 보관(개수·날짜)만 재고 «예산»은 안 재서,
   *   「예산 제외를 canon 으로 되돌림」 변이가 살아남았다(3차 검수 스윕이 짚은 바로 그 항목).
   *   협업은 외부화가 금지돼 스냅샷 하나가 통째로 39MB 다 — 예산이 마지막 방어선이다. */
  const root = mkRoot();
  mkCollab(root, 'c');
  const n = 25;
  seedCollabSnaps(root, 'c', n, NOW - (n - 1) * DAY);   // 전부 30일 안 → 계층 규칙만으론 다 남는다
  const idx = SS.readIndex(root, 'c');
  assert.equal(idx.entries.length, n);
  const each = Math.ceil(SS.BUDGET_BYTES / 5);          // 25개 = 예산의 5배
  idx.entries.forEach(e => { e.bytes = each; });
  SS.writeIndex(root, 'c', idx);

  SS.pruneVersions(root, 'c', { now: NOW });
  const kept = SS.readIndex(root, 'c').entries;
  const total = kept.reduce((s, e) => s + (e.bytes || 0), 0);
  assert.ok(total <= SS.BUDGET_BYTES + each,
    `★예산을 넘겨서 남았다 total=${(total / 1048576) | 0}MB 예산=${(SS.BUDGET_BYTES / 1048576) | 0}MB `
    + `kept=${kept.length}/${n} — 협업 프로젝트에서 예산 가드가 안 돈다`);
  assert.ok(kept.length >= 1 && kept.some(e => e.ts === Math.max(...idx.entries.map(x => x.ts))),
    '★최신은 무슨 일이 있어도 남는다([F1])');
});

/* ═══ C⑥ (중대) — 저장 경로가 «인덱스를 만드느라» 120MB 를 읽는다 ═══════ */

test('C6a ★게이트에 막히는 저장은 슬롯을 «한 바이트도» 안 읽는다', () => {
  /* 시간으로 재면 흔들린다 — «읽은 바이트»로 잰다(결정적).
   * 실측 참고: 126MB 슬롯 9개에서 초판 760ms → 픽스 0.1ms. */
  const root = mkRoot();
  const hd = path.join(root, 'p', 'proj_history');
  fs.mkdirSync(hd, { recursive: true });
  const body = 'x'.repeat(200000);
  for (let i = 0; i < 6; i++) {
    fs.writeFileSync(path.join(hd, `${NOW - i * 1000}.json`),
      JSON.stringify(proj('p', sec('s' + i, 'A') + body)));
  }
  const data = proj('p', sec('s0', 'A'));
  writeProjFile(root, 'p', data);
  assert.ok(!fs.existsSync(path.join(hd, 'index.json')), '전제: 인덱스가 없다');

  const orig = fs.readFileSync;
  let slotBytes = 0, slotReads = 0;
  fs.readFileSync = function (f, ...a) {
    const r = orig.call(this, f, ...a);
    if (typeof f === 'string' && /proj_history[\\/]\d+\.json$/.test(f)) {
      slotReads++; slotBytes += Buffer.byteLength(r);
    }
    return r;
  };
  let res;
  try { res = SS.writeSnapshot(root, 'p', data, { now: NOW + 1000 }); }
  finally { fs.readFileSync = orig; }

  assert.equal(res.skipped, 'interval', '전제: 간격 게이트에 막혀야 한다');
  assert.equal(slotReads, 0,
    `★게이트에 막힌 저장이 슬롯 ${slotReads}개(${slotBytes}B)를 읽었다 — 1.5초 debounce 마다 이 비용이 난다. `
    + '인덱스는 게이트를 «통과한 뒤에» 만들면 된다');
});

test('C6b ★그래도 게이트가 «열리면» 인덱스를 만든다 — 미루기가 곧 포기는 아니다(양성대조)', () => {
  const root = mkRoot();
  const hd = path.join(root, 'p', 'proj_history');
  fs.mkdirSync(hd, { recursive: true });
  fs.writeFileSync(path.join(hd, `${NOW - 2 * SS.MIN_GAP_MS}.json`),
    JSON.stringify(proj('p', sec('s_old', '옛것'))));
  const data = proj('p', sec('s_new', '새것'));
  writeProjFile(root, 'p', data);
  const res = SS.writeSnapshot(root, 'p', data, { now: NOW });
  assert.equal(res.ok, true, JSON.stringify(res));
  const idx = SS.readIndex(root, 'p');
  assert.ok(idx, '★게이트가 열렸는데 인덱스가 안 생겼다');
  assert.equal(idx.entries.length, 2, '★옛 슬롯이 인덱스에서 사라졌다');
  assert.ok(idx.current, '★current 지문이 없다 — 손실 diff 가 「비교 불가」로 죽는다');
});

test('C6c ★인덱스가 «있으면» current 갱신은 그대로 돈다 — 최적화가 기능을 끄지 않았다', () => {
  const root = mkRoot();
  const data = proj('p', sec('s0', 'A'));
  writeProjFile(root, 'p', data);
  assert.equal(SS.writeSnapshot(root, 'p', data, { now: NOW }).ok, true);   // 인덱스 생성
  const d2 = proj('p', sec('s0', 'A') + sec('s1', 'B'));
  writeProjFile(root, 'p', d2);
  const r = SS.writeSnapshot(root, 'p', d2, { now: NOW + SS.CURRENT_REFRESH_MS + 1 });
  assert.equal(r.skipped, 'interval', '전제: 간격 게이트에 막힌다');
  const cur = SS.readIndex(root, 'p').current;
  assert.equal(cur.counts.sections, 2, '★게이트에 막힌 사이 current 지문이 안 따라왔다');
});

/* ═══ [D] 「실패했는데 성공이라 말한다」 두 자리 ═══════════════════════════
 * ★둘 다 «조용히 실패하는 쓰기»가 재료다. 던지는 실패는 이미 잡히고 있었다 —
 *   안 던지고 실패하는 쓰기(네트워크·동기화 폴더·꽉 찬 디스크)가 안 잡혔다.
 */

test('D7 ★핀 사이드카가 «조용히» 안 써지면 pinsOk:false 로 답한다 — 되읽어 확인해야 안다', () => {
  const root = mkRoot();
  const data = proj('p', sec('sec_a', 'A'));
  writeProjFile(root, 'p', data);

  // 던지지 «않는» 실패를 만든다: pins.json 최종 rename 만 조용히 삼킨다.
  const origRename = fs.renameSync, origWrite = fs.writeFileSync;
  fs.renameSync = function (a, b) { if (/pins\.json$/.test(String(b))) return; return origRename.apply(fs, arguments); };
  fs.writeFileSync = function (f) { if (/pins\.json$/.test(String(f))) return; return origWrite.apply(fs, arguments); };
  let r;
  try { r = SS.writeSnapshot(root, 'p', data, { reason: 'pre-restore', force: true, now: NOW }); }
  finally { fs.renameSync = origRename; fs.writeFileSync = origWrite; }

  assert.equal(r.ok, true, '스냅샷 자체는 성공해야 한다');
  assert.equal(r.pinsOk, false,
    '★핀이 «안 써졌는데» 성공이라 답했다 — 인덱스를 잃는 순간 「되돌리기 취소 지점」이 사라지는데 '
    + '사용자는 「돌아갈 수 있다」고 들은 뒤다');
});

test('D8 정상일 땐 pinsOk:true — 되읽기 검증이 늘 false 를 내는 게 아니다(양성대조)', () => {
  const root = mkRoot();
  const data = proj('p', sec('sec_a', 'A'));
  writeProjFile(root, 'p', data);
  const r = SS.writeSnapshot(root, 'p', data, { reason: 'pre-restore', force: true, now: NOW });
  assert.equal(r.pinsOk, true);
  assert.equal(SS._internal.readPins(root, 'p')[String(r.ts)], 'pre-restore');
});

test('D9 ★인덱스 기록에 실패하면 «그렇다고 말한다» — 스냅샷은 있는데 목록이 못 따라온 상태다', () => {
  const root = mkRoot();
  const data = proj('p', sec('sec_a', 'A'));
  writeProjFile(root, 'p', data);
  assert.equal(SS.writeSnapshot(root, 'p', data, { now: NOW }).ok, true);   // 인덱스가 «이미» 있는 상태로
  const origRename = fs.renameSync;
  fs.renameSync = function (a, b) {
    if (/index\.json$/.test(String(b))) { const e = new Error('ENOSPC: no space left'); e.code = 'ENOSPC'; throw e; }
    return origRename.apply(fs, arguments);
  };
  let r;
  try { r = SS.writeSnapshot(root, 'p', proj('p', sec('sec_a', 'A') + sec('sec_b', 'B')),
                             { now: NOW + SS.MIN_GAP_MS + 1000 }); }
  finally { fs.renameSync = origRename; }

  assert.equal(r.ok, true, '★스냅샷 파일은 실제로 써졌다 — 없다고 말하면 그게 더 나쁜 거짓말이다');
  assert.ok(r.indexFailed, '★인덱스가 안 써졌는데 아무 말이 없다 — 호출측이 「정상」으로 안다');
  assert.match(String(r.indexFailed), /ENOSPC/);
});

test('D10 정상일 땐 indexFailed 가 없다(양성대조)', () => {
  const root = mkRoot();
  const data = proj('p', sec('sec_a', 'A'));
  writeProjFile(root, 'p', data);
  const r = SS.writeSnapshot(root, 'p', data, { now: NOW });
  assert.equal(r.ok, true);
  assert.ok(!r.indexFailed);
  assert.ok(SS.readIndex(root, 'p'));
});

test('D11 ★인덱스를 «쓸 수 없어도» 목록이 죽지 않는다 — 사고 직후가 정확히 그 상황이다', () => {
  const root = mkRoot();
  const hd = path.join(root, 'p', 'proj_history');
  fs.mkdirSync(hd, { recursive: true });
  for (let i = 0; i < 3; i++) {
    fs.writeFileSync(path.join(hd, `${NOW - i * DAY}.json`), JSON.stringify(proj('p', sec('s' + i, 'S'))));
  }
  writeProjFile(root, 'p', proj('p', sec('s0', 'S')));
  const origRename = fs.renameSync;
  fs.renameSync = function (a, b) {
    if (/index\.json$/.test(String(b))) { const e = new Error('EROFS: read-only file system'); throw e; }
    return origRename.apply(fs, arguments);
  };
  let list;
  try { list = SS.listVersions(root, 'p'); } finally { fs.renameSync = origRename; }
  assert.equal(list.ok, true, '★인덱스를 못 쓴다고 목록이 죽었다 — 복구하러 온 사용자가 아무것도 못 본다');
  assert.equal(list.entries.length, 3, '★슬롯이 3개인데 목록이 비었다');
});
