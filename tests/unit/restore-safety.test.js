/* U6a 하네스 — 되돌리기 «안전판». 실행: node --test "tests/unit/*.test.js"
 *
 * ★이 유닛이 약속한 문장을 «직접» 잰다:
 *     「되돌렸는데 잘못 골랐어도 다시 돌아올 수 있다」
 *   부품 테스트(스냅샷이 써지나·핀이 붙나)를 아무리 많이 해도 이 문장은 안 재진다.
 *   RS-PROMISE 가 그 문장 자체를 왕복으로 잰다.
 *
 * ★그리고 «음성대조»가 이 유닛의 핵심이다:
 *   안전판 쓰기를 강제로 실패시키면 «되돌리기가 시작조차 되지 않아야» 한다.
 *   안전판 없는 파괴가 한 번이라도 통과하면 이 기능은 존재 이유를 잃는다.
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const SS = require('../../main/project-store/snapshot-store');

const MIN = 60 * 1000;
const NOW = 1_787_700_000_000;
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const mkRoot = () => fs.mkdtempSync(path.join(os.tmpdir(), 'goya-u6a-'));
const sec = (id, name, inner) =>
  `<div class="section-block" id="${id}" data-name="${name}"><div class="section-inner">${inner || ''}</div></div>`;
const proj = (id, canvas) => ({ id, name: 'T', version: 2, currentPageId: 'page_1',
  pages: [{ id: 'page_1', name: 'Page 1', canvas }] });
function write(root, id, data) {
  fs.mkdirSync(path.join(root, id), { recursive: true });
  fs.writeFileSync(path.join(root, id, 'proj.json'), JSON.stringify(data, null, 2));
}
const names = (data) => SS.fingerprint(data).secs.map(s => s.n);

/* ═══ ★약속 — 되돌린 뒤 다시 돌아올 수 있나 ══════════════════════════════ */

test('RS-PROMISE ★「되돌렸는데 잘못 골랐어도 다시 돌아올 수 있다」 — 왕복으로 잰다', () => {
  const root = mkRoot();
  // v1: 섹션 3개(내가 지키고 싶은 상태)
  const v1 = proj('p', sec('sec_a', '혜택정리') + sec('sec_b', 'FAQ') + sec('sec_c', '배송안내'));
  write(root, 'p', v1);
  const s1 = SS.writeSnapshot(root, 'p', v1, { now: NOW });
  assert.equal(s1.ok, true);

  // 사고: 섹션 2개가 사라진 상태로 저장됨
  const broken = proj('p', sec('sec_a', '혜택정리'));
  write(root, 'p', broken);
  SS.writeSnapshot(root, 'p', broken, { now: NOW + 20 * MIN });

  // ① 되돌리기 준비 — 안전판이 박힌다
  const r = SS.prepareRestore(root, 'p', s1.ts, { now: NOW + 40 * MIN });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.deepEqual(names(r.data), ['혜택정리', 'FAQ', '배송안내'], '되돌릴 데이터가 v1 이어야 한다');

  // ② 실제 적용(U6b 가 할 일을 여기선 손으로) — 되돌렸다
  write(root, 'p', r.data);

  // ③ ★「잘못 골랐다」 — 안전판으로 «다시» 돌아온다
  const back = SS.prepareRestore(root, 'p', r.preRestoreTs, { now: NOW + 41 * MIN });
  assert.equal(back.ok, true, '★안전판으로 못 돌아오면 이 기능은 존재 이유가 없다');
  assert.deepEqual(names(back.data), ['혜택정리'], '되돌리기 «직전»(사고 상태) 그대로여야 한다');

  // ④ 그리고 «그 되돌리기»도 또 되돌릴 수 있다(안전판이 매번 박힌다)
  write(root, 'p', back.data);
  const again = SS.prepareRestore(root, 'p', back.preRestoreTs, { now: NOW + 42 * MIN });
  assert.equal(again.ok, true);
  assert.deepEqual(names(again.data), ['혜택정리', 'FAQ', '배송안내'], '한 단계 더 되돌아간다');
});

/* ═══ ★음성대조 — 안전판이 없으면 파괴가 «시작조차» 안 되나 ═══════════════ */

test('RS-NEG1 ★안전판 쓰기를 강제 실패시키면 되돌리기가 실행되지 않는다', () => {
  const root = mkRoot();
  const v1 = proj('p', sec('sec_a', 'A') + sec('sec_b', 'B'));
  write(root, 'p', v1);
  const s1 = SS.writeSnapshot(root, 'p', v1, { now: NOW });
  write(root, 'p', proj('p', sec('sec_a', 'A')));

  const before = fs.readFileSync(path.join(root, 'p', 'proj.json'));
  const orig = fs.writeFileSync;
  fs.writeFileSync = function (f, d) {
    // 히스토리 슬롯 쓰기만 실패시킨다(인덱스·프로젝트는 정상)
    if (/proj_history[\\/][0-9]+\.json\.tmp$/.test(String(f))) { const e = new Error('ENOSPC'); e.code = 'ENOSPC'; throw e; }
    return orig.apply(fs, arguments);
  };
  let r;
  try { r = SS.prepareRestore(root, 'p', s1.ts, { now: NOW + 40 * MIN }); }
  finally { fs.writeFileSync = orig; }

  assert.equal(r.ok, false, '★안전판을 못 만들었는데 되돌리기가 진행됐다');
  assert.equal(r.reason, 'pre_restore_failed');
  assert.ok(!r.data, '★되돌릴 데이터를 넘기면 호출측이 그걸로 덮어쓴다 — 넘기면 안 된다');
  assert.ok(before.equals(fs.readFileSync(path.join(root, 'p', 'proj.json'))), '원본이 바뀌었다');
});

test('RS-NEG2 ★지금 상태를 «못 읽으면» 되돌리기를 시작하지 않는다', () => {
  const root = mkRoot();
  const v1 = proj('p', sec('sec_a', 'A'));
  write(root, 'p', v1);
  const s1 = SS.writeSnapshot(root, 'p', v1, { now: NOW });
  fs.writeFileSync(path.join(root, 'p', 'proj.json'), '{ 손상');

  const r = SS.prepareRestore(root, 'p', s1.ts, { now: NOW + 40 * MIN });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'current_unreadable',
    '★「어차피 깨진 파일이니 그냥 덮자」로 가면 잘못 고른 사용자가 갈 곳이 없다');
  assert.ok(!r.data);
});

test('RS-NEG3 ★안전판이 «핀»으로 안 박히면 실패로 답한다 — 핀이 아니면 프룬에 날아간다', () => {
  const root = mkRoot();
  const v1 = proj('p', sec('sec_a', 'A'));
  write(root, 'p', v1);
  const s1 = SS.writeSnapshot(root, 'p', v1, { now: NOW });

  // 핀 사이드카·인덱스 기록을 무력화해 «핀 안 붙은» 상태를 만든다
  const origWrite = fs.writeFileSync;
  fs.writeFileSync = function (f, d) {
    if (String(f).includes('pins.json')) return;                       // 사이드카 유실
    if (String(f).includes('index.json')) {
      try { const o = JSON.parse(d); (o.entries || []).forEach(e => { e.pinned = false; }); d = JSON.stringify(o); } catch (_) {}
    }
    return origWrite.call(fs, f, d);
  };
  let r;
  try { r = SS.prepareRestore(root, 'p', s1.ts, { now: NOW + 40 * MIN }); }
  finally { fs.writeFileSync = origWrite; }
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'pre_restore_not_pinned');
  assert.ok(!r.data);
});

test('RS-NEG4 없는 버전으로 되돌리려 하면 «안전판도 안 만든다»', () => {
  const root = mkRoot();
  write(root, 'p', proj('p', sec('sec_a', 'A')));
  SS.writeSnapshot(root, 'p', proj('p', sec('sec_a', 'A')), { now: NOW });
  const n0 = SS.readIndex(root, 'p').entries.length;
  const r = SS.prepareRestore(root, 'p', 1, { now: NOW + 40 * MIN });
  assert.equal(r.ok, false);
  assert.equal(SS.readIndex(root, 'p').entries.length, n0,
    '★대상이 없는데 안전판만 쌓이면 목록이 쓰레기로 찬다');
});

/* ═══ 양성 — 안전판이 «제대로» 박히나 ════════════════════════════════════ */

test('RS-POS1 안전판은 «지금 상태»를 담는다 — 되돌릴 대상이 아니라', () => {
  const root = mkRoot();
  const v1 = proj('p', sec('sec_a', '옛것') + sec('sec_b', '옛것2'));
  write(root, 'p', v1);
  const s1 = SS.writeSnapshot(root, 'p', v1, { now: NOW });
  const cur = proj('p', sec('sec_z', '지금것'));
  write(root, 'p', cur);

  const r = SS.prepareRestore(root, 'p', s1.ts, { now: NOW + 40 * MIN });
  assert.equal(r.ok, true);
  const saved = SS.readVersion(root, 'p', r.preRestoreTs);
  assert.deepEqual(names(saved.data), ['지금것'], '★안전판이 «되돌릴 대상»을 담으면 취소가 성립 안 한다');
});

test('RS-POS2 ★열려 있으면 «화면의 최신 상태»를 안전판에 담는다 — 미저장 편집분이 빠지면 못 돌아온다', () => {
  const root = mkRoot();
  const v1 = proj('p', sec('sec_a', 'A'));
  write(root, 'p', v1);
  const s1 = SS.writeSnapshot(root, 'p', v1, { now: NOW });
  write(root, 'p', proj('p', sec('sec_a', 'A') + sec('sec_b', '디스크에만')));
  // 렌더러가 들고 있는 «아직 저장 안 된» 상태
  const live = proj('p', sec('sec_a', 'A') + sec('sec_b', '디스크에만') + sec('sec_c', '방금 만든 것'));

  const r = SS.prepareRestore(root, 'p', s1.ts, { now: NOW + 40 * MIN, currentData: live });
  assert.equal(r.ok, true);
  const saved = SS.readVersion(root, 'p', r.preRestoreTs);
  assert.ok(names(saved.data).includes('방금 만든 것'),
    '★미저장 편집분이 안전판에서 빠지면 「되돌리기 취소」로도 못 돌아온다');
});

test('RS-POS3 안전판은 간격 게이트를 «무시»한다 — 방금 저장했어도 박힌다', () => {
  const root = mkRoot();
  const v1 = proj('p', sec('sec_a', 'A'));
  write(root, 'p', v1);
  const s1 = SS.writeSnapshot(root, 'p', v1, { now: NOW });
  // 1분 뒤 — 자동 스냅샷이라면 게이트에 막힐 시점
  assert.equal(SS.writeSnapshot(root, 'p', v1, { now: NOW + 1 * MIN }).ok, false);
  const r = SS.prepareRestore(root, 'p', s1.ts, { now: NOW + 1 * MIN });
  assert.equal(r.ok, true, '★게이트에 막혀 안전판이 안 생기면 그 순간 되돌리기는 취소 불가가 된다');
});

test('RS-POS4 안전판은 이미지도 정규형으로 담는다 — 되돌아왔을 때 그림이 살아 있어야 한다', () => {
  const root = mkRoot();
  const v1 = proj('p', sec('sec_a', 'A'));
  write(root, 'p', v1);
  const s1 = SS.writeSnapshot(root, 'p', v1, { now: NOW });
  write(root, 'p', proj('p', sec('sec_a', 'A', `<img src="${PNG}">`)));

  const r = SS.prepareRestore(root, 'p', s1.ts, { now: NOW + 40 * MIN });
  assert.equal(r.ok, true);
  const saved = SS.readVersion(root, 'p', r.preRestoreTs);
  const canvas = saved.data.pages[0].canvas;
  const m = canvas.match(/goya-asset:\/\/[\w.-]+\/([\w.-]+)/);
  assert.ok(m, '정규형이어야 한다');
  assert.ok(fs.existsSync(path.join(root, 'p', 'assets', m[1])),
    '★참조만 있고 파일이 없으면 되돌아와도 그림이 빈다 — 「조용히 깨진 복구」다');
});

test('RS-POS5 안전판은 «지금 상태»를 담되 원본 proj.json 은 한 바이트도 안 바꾼다', () => {
  const root = mkRoot();
  const v1 = proj('p', sec('sec_a', 'A'));
  write(root, 'p', v1);
  const s1 = SS.writeSnapshot(root, 'p', v1, { now: NOW });
  write(root, 'p', proj('p', sec('sec_a', 'A') + sec('sec_b', 'B')));
  const before = fs.readFileSync(path.join(root, 'p', 'proj.json'));

  const r = SS.prepareRestore(root, 'p', s1.ts, { now: NOW + 40 * MIN });
  assert.equal(r.ok, true);
  assert.ok(before.equals(fs.readFileSync(path.join(root, 'p', 'proj.json'))),
    '★U6a 는 «준비»만 한다 — 교체는 U6b 의 몫이다');
});

test('RS-POS6 ★안전판은 오래돼도 프룬에 안 날아간다 — 취소 지점이 사라지면 약속이 깨진다', () => {
  const root = mkRoot();
  const DAY = 86400000;
  const v1 = proj('p', sec('sec_a', 'A'));
  write(root, 'p', v1);
  const s1 = SS.writeSnapshot(root, 'p', v1, { now: NOW - 200 * DAY });
  write(root, 'p', proj('p', sec('sec_a', 'A') + sec('sec_b', 'B')));
  const r = SS.prepareRestore(root, 'p', s1.ts, { now: NOW - 200 * DAY + MIN });
  assert.equal(r.ok, true);

  for (let i = 0; i < 40; i++) {
    SS.writeSnapshot(root, 'p', proj('p', sec('sec_a', 'A')), { now: NOW + i * 11 * MIN, force: true });
  }
  SS.pruneVersions(root, 'p', { now: NOW + 40 * 11 * MIN });
  assert.ok(SS.readVersion(root, 'p', r.preRestoreTs).ok,
    '★200일 된 안전판이 프룬에 날아갔다 — 그날의 되돌리기는 영영 취소 불가가 된다');
});
