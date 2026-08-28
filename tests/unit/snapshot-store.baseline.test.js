/* 불변식 하네스 — main/project-store/snapshot-store.js
 * 실행: node --test "tests/unit/*.test.js"
 *
 * 이 파일이 지키는 것은 «U1 이 바꿔서는 안 되는 것»이다.
 *   불변식 A(영구) — 손상 폴백 후보 «순서»: backup → history(최신→오래된) → pre-externalize(맨 끝)
 *   불변식 B(영구) — 슬롯 파일명 `<epoch>.json`. parseInt 정렬이 시간순이어야 한다.
 *   변경명세 D     — U0(구정책) → U1(신정책) 에서 «의도적으로» 바뀐 것. 값이 또 바뀌면 여기가 먼저 깨진다.
 *
 * ★U0 에서 이 파일이 담당하던 «구 슬롯 정책»(10분 게이트/5슬롯) 특성화 테스트는 U1 이 그 정책을
 *   대체하면서 §D 로 압축했다. 구현은 사라졌지만 «무엇이 왜 바뀌었는지»는 여기 남는다.
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { mkTmpRoot } = require('./_tmproot');
const SS = require('../../main/project-store/snapshot-store');

function mkRoot() { return mkTmpRoot('goya-snap-'); }
function mkHist(root, id, tsList) {
  const d = path.join(root, id, 'proj_history');
  fs.mkdirSync(d, { recursive: true });
  for (const ts of tsList) fs.writeFileSync(path.join(d, `${ts}.json`), '{}');
  return d;
}

/* ── 불변식 A: 폴백 후보 순서 ────────────────────────────────────────────── */
function setupFallback(root, id, { backup, hist = [], flatHist = [], preExt, index } = {}) {
  const dir = path.join(root, id);
  fs.mkdirSync(dir, { recursive: true });
  if (backup) fs.writeFileSync(path.join(dir, 'proj_backup.json'), '{}');
  if (hist.length || index) mkHist(root, id, hist);
  if (index) fs.writeFileSync(path.join(dir, 'proj_history', 'index.json'), '{}');
  if (flatHist.length) {
    const fd = path.join(root, `${id}_history`);
    fs.mkdirSync(fd, { recursive: true });
    for (const ts of flatHist) fs.writeFileSync(path.join(fd, `${ts}.json`), '{}');
  }
  if (preExt) fs.writeFileSync(path.join(dir, 'proj_pre-externalize.json'), '{}');
  const resolveBackup = (i) => {
    const p = path.join(root, i, 'proj_backup.json');
    return fs.existsSync(p) ? p : null;
  };
  return SS.loadFallbackCandidates(root, id, resolveBackup);
}

test('A1 순서 계약: backup → history(최신→오래된) → pre-externalize(★맨 끝)', () => {
  const root = mkRoot();
  const c = setupFallback(root, 'p', { backup: true, hist: [100, 300, 200], preExt: true });
  assert.deepEqual(c.map(x => x.from), ['backup', 'history', 'history', 'history', 'pre-externalize']);
  assert.deepEqual(c.slice(1, 4).map(x => path.basename(x.path)), ['300.json', '200.json', '100.json'],
    '히스토리는 «최신 우선»이어야 한다');
});

test('A2 ★pre-externalize 는 절대 앞으로 오지 않는다 — 늙은 원본이 최신 백업을 이기면 F1 데이터손실', () => {
  const root = mkRoot();
  const c = setupFallback(root, 'p', { backup: true, hist: [100], preExt: true });
  assert.equal(c[c.length - 1].from, 'pre-externalize');
  assert.ok(c.findIndex(x => x.from === 'pre-externalize') > c.findIndex(x => x.from === 'backup'));
  assert.ok(c.findIndex(x => x.from === 'pre-externalize') > c.findIndex(x => x.from === 'history'));
});

test('A3 backup 이 없으면 history 가 선두 — 빠진 자리를 메우지 않는다', () => {
  const root = mkRoot();
  const c = setupFallback(root, 'p', { hist: [100, 200] });
  assert.deepEqual(c.map(x => x.from), ['history', 'history']);
});

test('A4 구 flat 레이아웃(<id>_history)도 후보에 든다 — 신 레이아웃 «다음»', () => {
  const root = mkRoot();
  const c = setupFallback(root, 'p', { hist: [200], flatHist: [900] });
  assert.deepEqual(c.map(x => path.basename(x.path)), ['200.json', '900.json'],
    '신 레이아웃이 먼저다(마이그레이션 안 된 옛 파일이 최신을 이기면 안 된다)');
});

test('A5 아무것도 없으면 빈 배열 — 던지지 않는다', () => {
  const root = mkRoot();
  assert.deepEqual(SS.loadFallbackCandidates(root, 'ghost', () => null), []);
});

test('A6 projectId 에 경로조각이 들어와도 base 밖을 가리키지 않는다', () => {
  /* ⚠️초판은 존재하지도 않는 곳('../../etc')을 넘겨서 후보가 «항상 빈 배열»이었다 —
   *   빈 배열에 대고 for 를 돌면 무엇을 지워도 초록이다(3차 검수: safeSeg 를 지워도 초록).
   *   ⇒ 탈출 지점에 실물을 놓고, ★후보가 나왔다는 것 자체도 확인한다(양성대조). */
  const base = mkTmpRoot('goya-esc2-');
  const root = path.join(base, 'projects');
  const escapeDir = path.join(base, 'secret');
  fs.mkdirSync(path.join(escapeDir, 'proj_history'), { recursive: true });
  fs.writeFileSync(path.join(escapeDir, 'proj_history', '1787700000000.json'), '{"pages":[]}');
  // sanitize 되면 '.._secret' 이라는 «평범한 이름»이 되므로 그 자리에도 실물을 둬서 후보가 생기게 한다
  fs.mkdirSync(path.join(root, '.._secret', 'proj_history'), { recursive: true });
  fs.writeFileSync(path.join(root, '.._secret', 'proj_history', '1787700000000.json'), '{"pages":[]}');

  const c = SS.loadFallbackCandidates(root, '../secret', () => null);
  assert.ok(c.length > 0, '★후보가 0개면 아래 루프가 아무것도 검사하지 않는다(양성대조)');
  for (const x of c) assert.ok(path.resolve(x.path).startsWith(path.resolve(root) + path.sep), x.path);
});

test('A7 ★U1 이 새로 넣은 index.json 이 폴백 후보에 섞이면 안 된다', () => {
  const root = mkRoot();
  const c = setupFallback(root, 'p', { hist: [100, 200], index: true });
  assert.deepEqual(c.map(x => path.basename(x.path)), ['200.json', '100.json'],
    'index.json 은 프로젝트 데이터가 아니다 — 복구 후보로 들어가면 빈 프로젝트로 자가치유된다');
});

/* ── 불변식 B: 파일명 계약 ───────────────────────────────────────────────── */
test('B1 스냅샷 파일명은 `<epoch>.json` — 접미사를 붙이면 폴백의 parseInt 정렬이 조용히 깨진다', () => {
  const root = mkRoot();
  const data = { id: 'p', name: 'x', version: 2, pages: [{ id: 'page_1', canvas: '<div class="section-block" id="sec_a"></div>' }] };
  const r = SS.writeSnapshot(root, 'p', data, { now: 1_787_634_347_738 });
  assert.equal(r.ok, true);
  const files = fs.readdirSync(path.join(root, 'p', 'proj_history')).filter(f => f !== 'index.json');
  assert.deepEqual(files, ['1787634347738.json']);
  assert.match(files[0], /^\d+\.json$/);
});

test('B2 ★슬롯 정렬은 «숫자» 정렬이다 — U0 에서 잡았던 문자열정렬 취약성이 고쳐졌는지', () => {
  const root = mkRoot();
  mkHist(root, 'p', [999_994_060_000, 1_000_000_000_000]); // 12자리 + 13자리 혼합
  const names = SS._internal.slotFiles(path.join(root, 'p', 'proj_history'));
  assert.deepEqual(names, ['999994060000.json', '1000000000000.json'],
    '문자열 정렬이면 13자리가 앞으로 온다. 실데이터는 전부 13자리라 도달 불가였지만 U1 이 정면으로 고쳤다');
});

/* ── 변경명세 D: U0(구) → U1(신). «의도적» 변경만 여기 적는다 ───────────── */
test('D1 간격 게이트 10분은 «그대로»다 — 저장 폭주 방지는 여전히 필요하다', () => {
  assert.equal(SS.MIN_GAP_MS, 10 * 60 * 1000);
});

test('D2 슬롯 상한 5 → 최근 20 + 하루1개×30일. 경량화(39.59MB→0.238MB)가 이걸 가능하게 했다', () => {
  assert.equal(SS.RECENT_KEEP, 20, '구정책은 5였다 — 실효 보관기간이 50분뿐이었다');
  // ★2026-08-28 현빈 확정(Q5): 14 → 30. 실측 근거 — 39.6MB 프로젝트를 45일 굴려도
  //   47슬롯 13.70MB(예산 200MB의 6.9%). 복구 도구는 보관이 길수록 값이 난다.
  assert.equal(SS.DAILY_DAYS, 30, '「어제 그거」가 복구의 실제 단위이고, 30일이면 「지난달 그거」까지 닿는다');
  assert.ok(SS.RECENT_KEEP > 5, '이 값이 5 이하로 돌아가면 구정책 회귀다');
});

test('D3 예산 안전판과 핀 상한이 신설됐다 — 구정책엔 둘 다 없었다', () => {
  assert.equal(SS.BUDGET_BYTES, 200 * 1024 * 1024);
  assert.equal(SS.PINNED_MAX, 10);
});
