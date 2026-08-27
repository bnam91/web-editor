/* U2 하네스 — «조회 채널이 사용자 데이터를 못 바꾼다»를 측정으로 세운다.
 * 실행: node --test "tests/unit/*.test.js"
 *
 * ★「소스를 읽어보니 write 가 없다」는 증거가 아니다(적대검수 교훈: 막았다고 믿기 전에 막혔는지부터 재라).
 *   ⓐ 행동: 조회 호출 전후로 프로젝트 디렉터리 전체의 (경로,크기,내용해시)를 떠서 대조한다.
 *   ⓑ 구조: main.js 의 history IPC 블록에 쓰기 호출이 «문자로도» 없는지 기계적으로 확인한다.
 *
 * ⚠️ 예외는 사이드카 둘(proj_history/index.json · pins.json)뿐이다 — 파생 캐시고 잃어도 재빌드된다.
 *    프로젝트 «데이터»(proj.json · proj_backup.json · 슬롯 · assets)는 한 바이트도 안 바뀌어야 한다.
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const SS = require('../../main/project-store/snapshot-store');

const NOW = 1_787_700_000_000;
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const SIDECARS = new Set(['proj_history/index.json', 'proj_history/pins.json']);
const mkRoot = () => fs.mkdtempSync(path.join(os.tmpdir(), 'goya-ro-'));
const sec = (id, name) => `<div class="section-block" id="${id}" data-name="${name}"></div>`;
const proj = (id, canvas) => ({ id, name: 'T', version: 2, currentPageId: 'page_1',
  pages: [{ id: 'page_1', name: 'Page 1', canvas }] });

function snapDir(dir) {
  const out = {};
  (function walk(d, rel) {
    let ents = [];
    try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch (_) { return; }
    for (const e of ents) {
      const full = path.join(d, e.name), r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) walk(full, r);
      else out[r] = `${fs.statSync(full).size}:${crypto.createHash('sha256').update(fs.readFileSync(full)).digest('hex')}`;
    }
  })(dir, '');
  return out;
}
function diffExcludingSidecars(before, after) {
  const changed = [];
  for (const k of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (SIDECARS.has(k)) continue;
    if (before[k] !== after[k]) changed.push(`${k}: ${before[k] ? (after[k] ? '변경' : '삭제') : '생성'}`);
  }
  return changed;
}
function setup() {
  const root = mkRoot();
  const dir = path.join(root, 'p');
  fs.mkdirSync(dir, { recursive: true });
  const v1 = proj('p', sec('sec_a', '혜택정리') + sec('sec_b', 'FAQ') + `<img src="${PNG}">`);
  fs.writeFileSync(path.join(dir, 'proj.json'), JSON.stringify(v1, null, 2));
  SS.writeSnapshot(root, 'p', v1, { now: NOW });
  SS.writeSnapshot(root, 'p', proj('p', sec('sec_a', '혜택정리')), { now: NOW + 20 * 60000 });
  // 현재본은 섹션 하나가 «사라진» 상태(= 복구가 필요한 상황)
  const cur = proj('p', sec('sec_a', '혜택정리'));
  fs.writeFileSync(path.join(dir, 'proj.json'), JSON.stringify(cur, null, 2));
  fs.writeFileSync(path.join(dir, 'proj_backup.json'), JSON.stringify(v1, null, 2));
  return { root, dir };
}

/* ── ⓐ 행동 측정 ────────────────────────────────────────────────────────── */

test('RO1 ★history-list 는 프로젝트 데이터를 한 바이트도 안 바꾼다', () => {
  const { root, dir } = setup();
  SS.listVersions(root, 'p'); // 사이드카를 먼저 안정화(첫 호출이 current 를 기록)
  const before = snapDir(dir);
  const r = SS.listVersions(root, 'p');
  assert.equal(r.ok, true);
  assert.equal(r.entries.length, 2);
  assert.deepEqual(diffExcludingSidecars(before, snapDir(dir)), []);
});

test('RO2 ★history-read 는 사이드카조차 안 바꾼다', () => {
  const { root, dir } = setup();
  SS.listVersions(root, 'p');
  const before = snapDir(dir);
  const ts = SS.listVersions(root, 'p').entries[0].ts;
  const r = SS.readVersion(root, 'p', ts);
  assert.equal(r.ok, true);
  assert.deepEqual(snapDir(dir), before, '읽기 하나가 무엇이든 건드리면 안 된다');
});

test('RO3 ★diff-payload 경로(canonicalize write:false)는 에셋을 안 쓴다', () => {
  const { root, dir } = setup();
  SS.listVersions(root, 'p');
  const before = snapDir(dir);
  const cur = JSON.parse(fs.readFileSync(path.join(dir, 'proj.json'), 'utf8'));
  const snap = SS.readVersion(root, 'p', SS.listVersions(root, 'p').entries[1].ts);
  for (const d of [cur, snap.data]) {
    const canon = SS.canonicalize(root, 'p', d, { write: false });
    assert.ok(canon.data);
  }
  assert.deepEqual(diffExcludingSidecars(before, snapDir(dir)), [],
    '★write:false 인데 에셋이 새로 생겼다면 조회가 디스크를 오염시킨 것이다');
});

test('RO4 ★현재본이 base64 이고 스냅샷이 정규형이어도 «같은 좌표계»로 접힌다 (가짜 변경의 벽 방지)', () => {
  const { root, dir } = setup();
  const cur = JSON.parse(fs.readFileSync(path.join(dir, 'proj.json'), 'utf8'));
  cur.pages[0].canvas += `<img src="${PNG}">`; // 현재본만 base64
  const snapTs = SS.listVersions(root, 'p').entries[1].ts;
  const snap = SS.readVersion(root, 'p', snapTs);
  const curC = SS.canonicalize(root, 'p', cur, { write: false }).data;
  assert.ok(!curC.pages[0].canvas.includes('data:image'), '현재본이 정규형으로 접혀야 한다');
  assert.ok(!snap.data.pages[0].canvas.includes('data:image'), '스냅샷은 이미 정규형이다');
  const h = 'goya-asset://p/';
  assert.ok(curC.pages[0].canvas.includes(h) && snap.data.pages[0].canvas.includes(h));
});

test('RO5 조회는 손상된 입력에도 던지지 않고 «정직하게» 실패한다', () => {
  const { root, dir } = setup();
  const ts = SS.listVersions(root, 'p').entries[0].ts;
  fs.writeFileSync(path.join(dir, 'proj_history', `${ts}.json`), '{ 깨짐');
  const r = SS.readVersion(root, 'p', ts);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'corrupt');
  assert.equal(SS.listVersions(root, 'p').ok, true, '슬롯 하나가 깨져도 목록은 살아야 한다');
});

/* ── ⓑ 구조 측정 ────────────────────────────────────────────────────────── */

test('RO6 ★main.js 의 history IPC 블록에 «쓰기» 호출이 문자로도 없다', () => {
  const src = fs.readFileSync(path.join(__dirname, '../../main.js'), 'utf8');
  const start = src.indexOf("/* ── [version-history] 버전 기록 조회");
  assert.ok(start > 0, 'history IPC 블록을 못 찾았다 — 주석이 바뀌었으면 이 테스트도 같이 고쳐라');
  // 블록의 «끝»을 정확히 잡는다 — 초판은 projects:delete 를 끝으로 삼아 _saveProjectImpl 까지 삼켰다
  // (그래서 저장 경로의 쓰기 호출이 조회 블록의 것으로 오판됐다). 바로 다음 선언을 경계로 쓴다.
  const end = src.indexOf('// 섹션 수 합산 헬퍼', start);
  assert.ok(end > start, '블록 경계 마커를 못 찾았다 — main.js 구조가 바뀌었으면 이 테스트도 같이 고쳐라');
  const block = src.slice(start, end);
  const FORBIDDEN = [
    'writeFileSync', 'copyFileSync', 'unlinkSync', 'rmSync', 'renameSync', 'mkdirSync',
    '_atomicWriteFileSync', 'writeSnapshot', 'pruneVersions', 'writeIndex', 'writePins',
    "{ write: true }", 'externalizeProjectFile', 'rollbackExternalize',
  ];
  const hits = FORBIDDEN.filter(t => block.includes(t));
  assert.deepEqual(hits, [], `★조회 블록에 쓰기 호출이 들어왔다: ${hits.join(', ')}`);
  for (const ch of ['projects:history-list', 'projects:history-read', 'projects:history-diff-payload']) {
    assert.ok(block.includes(ch), `${ch} 가 이 블록 안에 있어야 한다`);
  }
});

test('RO7 «승인된» 채널만 노출된다 — 파괴 경로는 U6a 초록 + 현빈 Q2 답 뒤에 열렸다', () => {
  const src = fs.readFileSync(path.join(__dirname, '../../preload.js'), 'utf8');
  for (const ch of ['historyList', 'historyRead', 'historyDiffPayload']) assert.ok(src.includes(ch), `${ch} 누락`);
  assert.ok(src.includes('historyOpenCopy'), 'U5 비파괴 채널');
  // ★2026-08-28 현빈 Q2 확정 + U6a 단독 초록 → historyRestore 개방(교체가 기본).
  assert.ok(src.includes('historyRestore'), 'U6b 채널이 있어야 한다');
  // ★교체는 «판별 불가면 거부»가 계약이다 — 그래서 openProjectIds 를 반드시 실어 보낸다.
  assert.match(src, /historyRestore[\s\S]{0,240}openProjectIds/,
    '★openProjectIds 를 안 넘기면 main 이 판별 불가로 거부한다 — 브리지가 그걸 실어야 한다');
  // ⛔아직 승인 안 된 것: 수동 스냅샷은 현빈이 «안 한다»고 확정(Q3 구간), 프룬·삭제는 노출 대상이 아니다
  for (const ch of ['historySnapshotNow', 'historyPrune', 'historyDelete']) {
    assert.ok(!src.includes(ch), `★${ch} 는 승인된 적이 없다`);
  }
});

test('RO8 ts 검증이 IPC 경계에서 먹는다 — 경로 조각/비정수 거부', () => {
  const { root } = setup();
  for (const bad of ['../../etc/passwd', '..', '1;rm -rf', 'abc', '', null, undefined, '1e3', '0x10']) {
    const r = SS.readVersion(root, 'p', bad);
    assert.equal(r.ok, false, `거부되지 않았다: ${JSON.stringify(bad)}`);
  }
});
