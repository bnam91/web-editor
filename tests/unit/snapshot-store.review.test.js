/* 적대검수 회귀 하네스 — 독립 리뷰어가 U1 에서 찾아낸 결함 11건을 «각각» 못 박는다.
 * 실행: node --test "tests/unit/*.test.js"
 *
 * ★이 파일의 존재 이유: 저자 리허설이 통과시킨 것들이다. 고쳤다고 끝이 아니라
 *   «같은 형태로 되돌아오지 못하게» 테스트로 봉인해야 한다.
 *   원본 테스트가 왜 못 잡았는지도 각 케이스에 적어 둔다 — 그게 다음 하네스를 고치는 재료다.
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const SS = require('../../main/project-store/snapshot-store');

/** version-diff.js 는 브라우저 IIFE — 가짜 window 에 얹어 «진짜» lossDiff 를 쓴다(재구현 금지). */
function loadVersionDiff() {
  const win = {};
  new Function('window', fs.readFileSync(path.join(__dirname, '../../js/version-diff.js'), 'utf8'))(win);
  return win.versionDiff;
}

const MIN = 60 * 1000, DAY = 86400000;
const NOW = 1_787_700_000_000;
const PNG_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const PNG = `data:image/png;base64,${PNG_B64}`;
const mkRoot = () => fs.mkdtempSync(path.join(os.tmpdir(), 'goya-rv-'));
const sec = (id, name) => `<div class="section-block" id="${id}"${name ? ` data-name="${name}"` : ''}>`
  + `<div class="section-hitzone"><span class="section-label">${name || id}</span></div></div>`;
const proj = (id, canvas, extra = {}) => ({ id, name: 'T', version: 2, currentPageId: 'page_1',
  pages: [{ id: 'page_1', name: 'Page 1', canvas }], ...extra });
function writeProjFile(root, id, data) {
  fs.mkdirSync(path.join(root, id), { recursive: true });
  fs.writeFileSync(path.join(root, id, 'proj.json'), JSON.stringify(data, null, 2));
}

/* ═══ F1 (치명) — 예산 굶주림 ═══════════════════════════════════════════ */

test('F1a ★레거시가 예산을 넘겨도 «방금 만든» 스냅샷이 살아남는다', () => {
  const root = mkRoot();
  const hd = path.join(root, 'p', 'proj_history');
  fs.mkdirSync(hd, { recursive: true });
  // 레거시 5슬롯. 실프로젝트 5개가 이미 이 상태다(합계 200~515MB).
  for (let i = 0; i < 5; i++) {
    fs.writeFileSync(path.join(hd, `${NOW - (5 - i) * DAY}.json`),
      JSON.stringify(proj('p', sec('sec_a', 'A') + `<img src="${PNG}">`)));
  }
  const idx = SS.ensureIndex(root, 'p');
  idx.entries.forEach(e => { e.bytes = 52 * 1024 * 1024; }); // 합계 260MB > 예산 200MB
  SS.writeIndex(root, 'p', idx);
  assert.ok(idx.entries.every(e => e.canon === 0));

  writeProjFile(root, 'p', proj('p', sec('sec_a', 'A')));
  const w = SS.writeSnapshot(root, 'p', proj('p', sec('sec_a', 'A')), { now: NOW });
  assert.equal(w.ok, true);
  const pr = SS.pruneVersions(root, 'p', { now: NOW });
  assert.ok(fs.existsSync(path.join(hd, `${w.ts}.json`)),
    '★방금 만든 스냅샷을 프룬이 즉시 지웠다 — 버전 히스토리가 필요한 바로 그 프로젝트에서 0개가 남는다');
  assert.ok(!pr.deleted.includes(`${w.ts}.json`));
  assert.ok(SS.readIndex(root, 'p').entries.some(e => e.canon === 1));
});

test('F1b ★그래서 간격 게이트가 계속 살아 있다 — 매 저장 재스냅샷 무한루프가 안 난다', () => {
  const root = mkRoot();
  const hd = path.join(root, 'p', 'proj_history');
  fs.mkdirSync(hd, { recursive: true });
  for (let i = 0; i < 5; i++) {
    fs.writeFileSync(path.join(hd, `${NOW - (5 - i) * DAY}.json`),
      JSON.stringify(proj('p', sec('sec_a', 'A') + `<img src="${PNG}">`)));
  }
  const idx = SS.ensureIndex(root, 'p');
  idx.entries.forEach(e => { e.bytes = 52 * 1024 * 1024; });
  SS.writeIndex(root, 'p', idx);
  writeProjFile(root, 'p', proj('p', sec('sec_a', 'A')));

  let created = 0;
  for (let i = 0; i < 4; i++) { // 1.5초 간격 autosave 4회
    if (SS.writeSnapshot(root, 'p', proj('p', sec('sec_a', 'A')), { now: NOW + i * 1500 }).ok) created++;
    SS.pruneVersions(root, 'p', { now: NOW + i * 1500 });
  }
  assert.equal(created, 1,
    `★${created}회 생성됐다 — 프룬이 최신을 지워 게이트가 무력화되면 매 저장 400ms 가 붙는다`);
});

test('F1c 예산은 «회수 가능한 것»만 센다 — 레거시는 회수 대상이 아니므로 분모가 아니다', () => {
  const root = mkRoot();
  writeProjFile(root, 'p', proj('p', sec('sec_a', 'A')));
  for (let i = 0; i < 25; i++) {
    SS.writeSnapshot(root, 'p', proj('p', sec('sec_a', 'A')), { now: NOW + i * 11 * MIN, force: true });
  }
  const idx = SS.readIndex(root, 'p');
  idx.entries.forEach(e => { e.bytes = 1024; }); // 전부 합쳐도 예산 훨씬 아래
  SS.writeIndex(root, 'p', idx);
  const before = SS.readIndex(root, 'p').entries.length;
  SS.pruneVersions(root, 'p', { now: NOW + 25 * 11 * MIN });
  assert.ok(SS.readIndex(root, 'p').entries.length >= SS.RECENT_KEEP,
    `예산 아래인데도 최근 ${SS.RECENT_KEEP}개를 못 지켰다 (before=${before})`);
});

/* ═══ F2 (중대) — 인덱스 유실 = 핀 유실 ════════════════════════════════ */

test('F2 ★index.json 을 잃어도 pre-restore 핀이 살아남는다 (핀 사이드카)', () => {
  const root = mkRoot();
  writeProjFile(root, 'p', proj('p', sec('sec_a', 'A')));
  const pin = SS.writeSnapshot(root, 'p', proj('p', sec('sec_a', 'A')),
    { now: NOW - 200 * DAY, force: true, reason: 'pre-restore' });
  for (let i = 0; i < 25; i++) {
    SS.writeSnapshot(root, 'p', proj('p', sec('sec_a', 'A')), { now: NOW + i * 11 * MIN, force: true });
  }
  // 인덱스만 사라진 상황 — 모듈 헤더가 「잃어도 손실이 아니다」라고 주장하는 바로 그 상황
  fs.unlinkSync(path.join(root, 'p', 'proj_history', 'index.json'));
  SS.pruneVersions(root, 'p', { now: NOW + 25 * 11 * MIN });
  assert.ok(fs.existsSync(path.join(root, 'p', 'proj_history', `${pin.ts}.json`)),
    '★인덱스 유실만으로 «되돌리기 취소 지점»이 프룬에 날아갔다');
  const e = SS.readIndex(root, 'p').entries.find(x => x.ts === pin.ts);
  assert.equal(e.pinned, true);
  assert.equal(e.reason, 'pre-restore');
});

/* ═══ F3 (중대) — 검증 없는 unlink ════════════════════════════════════ */

test('F3 ★인덱스가 조작돼도 히스토리 «밖»을 지우지 않는다', () => {
  const root = mkRoot();
  writeProjFile(root, 'p', proj('p', sec('sec_a', 'A')));
  fs.writeFileSync(path.join(root, 'p', 'proj_backup.json'), '{"marker":1}');
  for (let i = 0; i < 25; i++) {
    SS.writeSnapshot(root, 'p', proj('p', sec('sec_a', 'A')), { now: NOW + i * 11 * MIN, force: true });
  }
  const idx = SS.readIndex(root, 'p');
  idx.entries[0].file = '../proj.json';       // 가장 오래된 것 = 프룬 대상
  idx.entries[1].file = '../proj_backup.json';
  SS.writeIndex(root, 'p', idx);
  const r = SS.pruneVersions(root, 'p', { now: NOW + 25 * 11 * MIN });
  assert.ok(fs.existsSync(path.join(root, 'p', 'proj.json')), '★원본 proj.json 이 프룬에 지워졌다');
  assert.ok(fs.existsSync(path.join(root, 'p', 'proj_backup.json')), '★롤링 백업이 프룬에 지워졌다');
  assert.deepEqual(r.refused.sort(), ['../proj.json', '../proj_backup.json'].sort());
});

/* ═══ F4 (중대) — GC 계약의 구멍 ═══════════════════════════════════════ */

test('F4a ★캔버스 «밖»(page.scratchpad) 의 goya-asset 참조도 살아있음에 든다', () => {
  const root = mkRoot();
  const data = proj('p', sec('sec_a', 'A'));
  data.pages[0].scratchpad = [{ id: 's1', src: 'goya-asset://p/deadbeef00000000.png', x: 0, y: 0, w: 100 }];
  writeProjFile(root, 'p', data);
  SS.writeSnapshot(root, 'p', data, { now: NOW });
  // 현재본에서는 스크래치를 비웠다 = GC 가 가장 위험한 순간
  writeProjFile(root, 'p', proj('p', sec('sec_a', 'A')));
  assert.ok(SS.listReferencedAssets(root, 'p').has('deadbeef00000000.png'),
    '★scratchpad 매니페스트(출시된 기능)의 참조를 GC 계약이 놓쳤다 — 지우면 과거 버전이 조용히 깨진다');
});

test('F4b ★구 flat 레이아웃(<id>.json · <id>_backup.json · <id>_history/)의 참조도 센다', () => {
  const root = mkRoot();
  fs.mkdirSync(path.join(root, 'p'), { recursive: true });
  fs.writeFileSync(path.join(root, 'p', 'proj.json'), '{}');
  fs.writeFileSync(path.join(root, 'p.json'),
    JSON.stringify({ pages: [{ canvas: '<img src="goya-asset://p/aaaa000000000000.png">' }] }));
  fs.writeFileSync(path.join(root, 'p_backup.json'),
    JSON.stringify({ pages: [{ canvas: '<img src="goya-asset://p/bbbb000000000000.png">' }] }));
  fs.mkdirSync(path.join(root, 'p_history'), { recursive: true });
  fs.writeFileSync(path.join(root, 'p_history', `${NOW}.json`),
    JSON.stringify({ pages: [{ canvas: '<img src="goya-asset://p/cccc000000000000.png">' }] }));
  const live = SS.listReferencedAssets(root, 'p');
  for (const n of ['aaaa000000000000.png', 'bbbb000000000000.png', 'cccc000000000000.png']) {
    assert.ok(live.has(n), `${n} 누락 — main.js 의 폴백 체인은 이 파일들을 «복구 재료»로 읽는다`);
  }
});

test('F4c ★인덱스가 있어도 파일을 직접 읽는다 — 캐시가 GC 정답을 좁히면 안 된다', () => {
  const root = mkRoot();
  const data = proj('p', sec('sec_a', 'A'));
  data.pages[0].scratchpad = [{ id: 's1', src: 'goya-asset://p/deadbeef00000000.png' }];
  writeProjFile(root, 'p', data);
  SS.writeSnapshot(root, 'p', data, { now: NOW });
  const idx = SS.readIndex(root, 'p');
  idx.entries.forEach(e => { e.assets = []; }); // 캐시가 «비었다»고 거짓말하는 상황
  SS.writeIndex(root, 'p', idx);
  assert.ok(SS.listReferencedAssets(root, 'p').has('deadbeef00000000.png'),
    '★인덱스만 믿으면 캐시 결함이 곧 데이터 파괴가 된다');
});

/* ═══ F5 (중간) — 협업 프로젝트 ════════════════════════════════════════ */

test('F5 ★협업 등록 프로젝트는 스냅샷을 정규화하지 않는다 (자가치유가 동기화 산출물을 바꾼다)', () => {
  const root = mkRoot();
  const data = proj('p', sec('sec_a', 'A') + `<img src="${PNG}">`);
  writeProjFile(root, 'p', data);
  fs.writeFileSync(path.join(root, 'p', 'proj_meta.json'), JSON.stringify({ collabRef: { room: 'r1' } }));
  const r = SS.writeSnapshot(root, 'p', data, { now: NOW });
  assert.equal(r.collabVerbatim, true);
  const raw = fs.readFileSync(path.join(root, 'p', 'proj_history', `${r.ts}.json`), 'utf8');
  assert.ok(raw.includes('data:image'),
    '★정규형 스냅샷이 폴백 자가치유로 proj.json 에 올라가면 상대 디스크엔 assets/ 가 없어 깨진 이미지가 간다');
  assert.equal(SS.readIndex(root, 'p').entries[0].canon, 0, '정직하게 «옛 형식»으로 표시돼야 한다');
});

/* ═══ F6 (중간) — canon 판정 불일치 ═══════════════════════════════════ */

test('F6 ★write 와 rebuild 가 같은 canon 값을 낸다 — 절단 base64 가 남아도 거짓말 안 한다', () => {
  const root = mkRoot();
  const wrapped = `data:image/png;base64,${PNG_B64.slice(0, 20)}\n${PNG_B64.slice(20)}`;
  const data = proj('p', sec('sec_a', 'A') + `<img src="${wrapped}">`);
  writeProjFile(root, 'p', data);
  const w = SS.writeSnapshot(root, 'p', data, { now: NOW });
  const atWrite = SS.readIndex(root, 'p').entries.find(e => e.ts === w.ts).canon;
  const atRebuild = SS.rebuildIndex(root, 'p').entries.find(e => e.ts === w.ts).canon;
  assert.equal(atWrite, atRebuild,
    `★write=${atWrite} rebuild=${atRebuild} — 같은 파일에 다른 판정이면 프룬 면제가 비결정적이 된다`);
  assert.equal(atWrite, 0, '정규화가 절단분을 못 접었으면 «옛 형식»이 맞다');
});

/* ═══ F7 (중간) — 목록이 죽으면 안 된다 / 대형 레거시 파싱 ══════════════ */

test('F7a ★히스토리 디렉터리를 못 써도 목록은 답한다 — 사고 직후 열리는 화면이다', () => {
  const root = mkRoot();
  const d = proj('p', sec('sec_a', 'A') + sec('sec_b', 'B'));
  writeProjFile(root, 'p', d);
  SS.writeSnapshot(root, 'p', d, { now: NOW });
  const hd = path.join(root, 'p', 'proj_history');
  const projPath = path.join(root, 'p', 'proj.json');
  fs.writeFileSync(projPath, JSON.stringify(proj('p', sec('sec_a', 'A')), null, 2));
  fs.utimesSync(projPath, new Date(), new Date(Date.now() + 5000)); // current 를 낡게 만든다
  fs.chmodSync(hd, 0o500); // 읽기전용
  try {
    const r = SS.listVersions(root, 'p');
    assert.equal(r.ok, true);
    assert.equal(r.entries.length, 1);
    assert.equal(r.current.counts.sections, 1, '기록은 못 해도 «계산»은 해서 답해야 한다');
  } finally { fs.chmodSync(hd, 0o700); }
});

test('F7b ★대형 레거시 슬롯은 JSON.parse 없이 지문을 낸다 — 두 경로가 같은 답을 내야 한다', () => {
  const root = mkRoot();
  // 8MB 를 넘기되 섹션/블록 구조는 명확하게
  const filler = 'z'.repeat(1500000); // base64 로 2MB × 5섹션 = 10MB → 임계치(8MB) 초과
  const canvas = Array.from({ length: 5 }, (_, i) =>
    `<div class="section-block" id="sec_${i}" data-name="섹션${i}">`
    + `<div class="section-inner"><div class="gap-block" id="gb_aaa${i}0"></div>`
    + `<img src="data:image/png;base64,${Buffer.from(filler).toString('base64')}"></div></div>`).join('');
  const data = proj('p', canvas);
  const raw = JSON.stringify(data, null, 2);
  assert.ok(Buffer.byteLength(raw) > 8 * 1024 * 1024, '픽스처가 임계치를 넘어야 이 경로를 탄다');
  const hd = path.join(root, 'p', 'proj_history');
  fs.mkdirSync(hd, { recursive: true });
  fs.writeFileSync(path.join(hd, `${NOW}.json`), raw);

  const e = SS.ensureIndex(root, 'p').entries[0];
  const parsed = SS.fingerprint(data);
  assert.equal(e.approx, true, 'raw 경로를 탔다고 정직하게 표시해야 한다');
  assert.equal(e.counts.sections, parsed.counts.sections);
  assert.equal(e.counts.blocks, parsed.counts.blocks);
  assert.deepEqual(e.secs.map(s => s.n), parsed.secs.map(s => s.n),
    '★raw 지문과 정규 지문이 갈리면 목록이 거짓말한다');
  assert.equal(e.canon, 0);
});

test('F7c raw 지문의 이름 폴백(.section-label)이 실제로 동작한다', () => {
  // JSON 은 / 를 이스케이프하지 않는다. 초판은 <\/span> 를 기대해 라벨 폴백이 통째로 헛돌았다.
  const raw = JSON.stringify(proj('p',
    '<div class="section-block" id="sec_x">'
    + '<div class="section-hitzone"><span class="section-label" draggable="true">라벨이름</span></div></div>'));
  const fp = SS._internal.fingerprintRaw(raw);
  assert.deepEqual(fp.secs.map(s => s.n), ['라벨이름'],
    '★실슬롯 대조에서만 드러났던 결함 — 합성 픽스처만 봤으면 놓쳤다');
});

/* ═══ F9 / F10 / F11 ═══════════════════════════════════════════════════ */

test('F9 폴백 후보 생성도 projectId 를 sanitize 한다', () => {
  const root = mkRoot();
  fs.mkdirSync(path.join(root, 'elsewhere', 'proj_history'), { recursive: true });
  fs.writeFileSync(path.join(root, 'elsewhere', 'proj_history', `${NOW}.json`), '{}');
  const c = SS.loadFallbackCandidates(root, '../elsewhere', () => null);
  for (const x of c) {
    assert.ok(!path.resolve(x.path).includes(`${path.sep}elsewhere${path.sep}`),
      `★PROJECTS_DIR 밖을 복구 후보로 삼았다: ${x.path}`);
  }
});

test('F10 쓰기 실패 시 .tmp 를 남기지 않는다', () => {
  const root = mkRoot();
  const hd = path.join(root, 'p', 'proj_history');
  fs.mkdirSync(hd, { recursive: true });
  const orig = fs.writeFileSync;
  fs.writeFileSync = function (f, d) {
    if (String(f).endsWith('.tmp')) { orig.call(fs, f, '부분'); const e = new Error('ENOSPC'); e.code = 'ENOSPC'; throw e; }
    return orig.apply(fs, arguments);
  };
  try { try { SS._internal.writePins(root, 'p', { a: 1 }); } catch (_) {} }
  finally { fs.writeFileSync = orig; }
  assert.deepEqual(fs.readdirSync(hd).filter(f => f.endsWith('.tmp')), [],
    '★디스크가 찬 상황에서 부분 tmp 가 쌓인다 — 원인 상황을 더 악화시킨다');
});

test('F11 슬롯 파일이 밖에서 사라져도 인덱스에 같은 ts 가 두 번 들어가지 않는다', () => {
  const root = mkRoot();
  const d = proj('p', sec('sec_a', 'A'));
  writeProjFile(root, 'p', d);
  const a = SS.writeSnapshot(root, 'p', d, { now: NOW, force: true });
  fs.unlinkSync(path.join(root, 'p', 'proj_history', `${a.ts}.json`)); // 밖에서 사라짐
  const b = SS.writeSnapshot(root, 'p', d, { now: NOW, force: true });
  assert.notEqual(a.ts, b.ts);
  const ts = SS.readIndex(root, 'p').entries.map(e => e.ts);
  assert.equal(new Set(ts).size, ts.length, '★목록에 유령 행이 생긴다');
});

test('F7d ★대형 레거시가 많아도 첫 열람이 통째로 얼지 않는다 — 예산제 + 열 때마다 자동 완성', () => {
  const root = mkRoot();
  const hd = path.join(root, 'p', 'proj_history');
  fs.mkdirSync(hd, { recursive: true });
  // 슬롯 하나가 LEGACY_RAW_MAX(8MB)를 넘어야 «미룸»이 성립한다 — 작은 슬롯은 미룰 가치가 없어 그냥 읽는다
  const chunk = 'z'.repeat(9 * 1024 * 1024);
  for (let i = 0; i < 3; i++) {
    fs.writeFileSync(path.join(hd, `${NOW - (3 - i) * DAY}.json`),
      JSON.stringify(proj('p', sec(`sec_${i}`, `S${i}`) + `<img src="data:image/png;base64,${chunk}">`)));
  }
  writeProjFile(root, 'p', proj('p', sec('sec_0', 'S0')));
  // 예산을 슬롯 1개분으로 좁혀 «미룸»이 실제로 일어나게 한다
  const idx0 = SS.rebuildIndex(root, 'p', { byteBudget: 1 });
  assert.ok(idx0.entries.some(e => e.pending), '예산을 넘긴 슬롯은 미뤄져야 한다');
  assert.ok(idx0.entries.every(e => e.ts && e.bytes > 0),
    '미룬 항목도 «그 버전이 있다»는 건 시각·용량으로 답해야 한다(P-1 정직)');

  let guard = 0;
  while (SS.listVersions(root, 'p').pendingCount > 0 && guard++ < 10) { /* 열 때마다 이어서 채운다 */ }
  const r = SS.listVersions(root, 'p');
  assert.equal(r.pendingCount, 0, '반복 열람으로 자동 완성돼야 한다');
  assert.ok(r.entries.every(e => e.counts && e.counts.sections === 1));
});

test('F7e 미룬 항목도 프룬이 «레거시»로 보호한다 — 분석 전에 지워지면 안 된다', () => {
  const root = mkRoot();
  const hd = path.join(root, 'p', 'proj_history');
  fs.mkdirSync(hd, { recursive: true });
  const chunk = 'z'.repeat(9 * 1024 * 1024);
  fs.writeFileSync(path.join(hd, `${NOW - 300 * DAY}.json`),
    JSON.stringify(proj('p', sec('sec_x', '옛것') + `<img src="data:image/png;base64,${chunk}">`)));
  writeProjFile(root, 'p', proj('p', sec('sec_a', 'A')));
  SS.rebuildIndex(root, 'p', { byteBudget: 1 });
  for (let i = 0; i < 25; i++) {
    SS.writeSnapshot(root, 'p', proj('p', sec('sec_a', 'A')), { now: NOW + i * 11 * MIN, force: true });
  }
  SS.pruneVersions(root, 'p', { now: NOW + 25 * 11 * MIN });
  assert.ok(fs.existsSync(path.join(hd, `${NOW - 300 * DAY}.json`)),
    '★아직 안 읽어본 슬롯을 지웠다 — 내용을 모르는 채로 버리는 건 복구 도구가 할 일이 아니다');
});

/* ═══ 2차 적대검수 — 거짓 안심 계열 ══════════════════════════════════════ */

test('C1 ★런타임 클래스가 붙은 섹션을 «놓치지» 않는다 — 놓치면 「지워도 손실 0」이라 말한다', () => {
  // 저장본에 selected/group-selected 가 새는 건 팀이 이미 아는 사실이다
  // (js/version-diff.js 의 _RUNTIME_CLS 가 바로 그걸 벗긴다). L1 정규식만 반영이 안 돼 있었다.
  const canvas = '<div class="section-block" id="sec_a" data-name="멀쩡"></div>'
    + '<div class="section-block selected" id="sec_b" data-name="핵심 카피"></div>'
    + '<div class="section-block group-selected editing" id="sec_c" data-name="셋째"></div>';
  const fp = SS.fingerprint({ id: 'p', version: 2, pages: [{ id: 'page_1', canvas }] });
  assert.equal(fp.counts.sections, 3, '★런타임 클래스가 붙으면 섹션이 통째로 사라진다');
  assert.deepEqual(fp.secs.map(s => s.n), ['멀쩡', '핵심 카피', '셋째']);
  // ★거짓 안심의 «두 방향»을 다 잰다
  const gone = { id: 'p', version: 2, pages: [{ id: 'page_1',
    canvas: '<div class="section-block" id="sec_a" data-name="멀쩡"></div>' }] };
  const V = loadVersionDiff();
  const loss = V.lossDiff(fp.secs, SS.fingerprint(gone).secs);
  assert.deepEqual(loss.lost.map(x => x.n), ['핵심 카피', '셋째'],
    '★지운 섹션이 손실에 «안 뜨면» 사용자는 안심하고 그냥 나간다');
  const noLoss = V.lossDiff(fp.secs, fp.secs);
  assert.deepEqual(noLoss.lost, [], '★안 지웠는데 「사라졌다」고 하면 엉뚱한 버전으로 되돌린다');
});

test('C1b raw 지문(대형 레거시)도 같은 규칙을 쓴다 — 두 경로가 갈리면 목록이 거짓말한다', () => {
  const canvas = '<div class="section-block selected" id="sec_b" data-name="핵심 카피"></div>';
  const raw = JSON.stringify({ id: 'p', version: 2, pages: [{ id: 'page_1', canvas }] });
  const fr = SS._internal.fingerprintRaw(raw);
  assert.equal(fr.counts.sections, 1);
  assert.deepEqual(fr.secs.map(s => s.n), ['핵심 카피']);
});

test('C1c ★깨진 정규식으로 찍힌 «옛 인덱스»는 자동으로 다시 계산된다', () => {
  const root = mkRoot();
  const canvas = '<div class="section-block selected" id="sec_b" data-name="핵심 카피"></div>';
  const data = { id: 'p', name: 'T', version: 2, pages: [{ id: 'page_1', canvas }] };
  writeProjFile(root, 'p', data);
  SS.writeSnapshot(root, 'p', data, { now: NOW });

  // v1(옛 스키마) + 옛 계산 결과를 흉내낸다
  const ip = path.join(root, 'p', 'proj_history', 'index.json');
  const idx = JSON.parse(fs.readFileSync(ip, 'utf8'));
  idx.v = 1;
  idx.entries.forEach(e => { e.counts.sections = 0; e.secs = []; });
  idx.current = { ts: NOW, bytes: 1, projMtimeMs: 9e15, counts: { sections: 0 }, secs: [] };
  fs.writeFileSync(ip, JSON.stringify(idx));

  const l = SS.listVersions(root, 'p');
  assert.equal(l.entries[0].counts.sections, 1, '★옛 지문을 그대로 쓰면 계속 거짓말한다');
  assert.equal(l.current.counts.sections, 1,
    '★current 도 옛 계산이다 — mtime 이 안 바뀌어 신선도 판정에 안 걸리므로 명시적으로 버려야 한다');
});

test('C2 ★proj.json 을 못 읽으면 «옛 current 를 들고 나가지 않는다» — 「지금 섹션 3」은 거짓말이다', () => {
  const root = mkRoot();
  const data = { id: 'p', name: 'T', version: 2, pages: [{ id: 'page_1',
    canvas: sec('sec_a', 'A') + sec('sec_b', 'B') + sec('sec_c', 'C') }] };
  writeProjFile(root, 'p', data);
  SS.writeSnapshot(root, 'p', data, { now: NOW });
  assert.equal(SS.listVersions(root, 'p').current.counts.sections, 3, '정상일 땐 3');

  // ① 잘린 JSON
  fs.writeFileSync(path.join(root, 'p', 'proj.json'), '{"pages":[{"canv');
  assert.equal(SS.listVersions(root, 'p').current, null,
    '★깨진 프로젝트인데 「지금 섹션 3」이라 답하면 모든 버전이 「같다」로 보인다 — 거짓 안심');
  // ② 아예 삭제
  fs.unlinkSync(path.join(root, 'p', 'proj.json'));
  assert.equal(SS.listVersions(root, 'p').current, null, '★없는 프로젝트에 「지금」이 있으면 안 된다');
  // 그래도 목록 자체는 살아야 한다 — 사고 직후에 열리는 화면이다
  const l = SS.listVersions(root, 'p');
  assert.equal(l.ok, true);
  assert.equal(l.entries.length, 1, '★버전 목록은 보여야 복구할 수 있다');
});
