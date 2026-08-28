/* U1 하네스 — main/project-store/snapshot-store.js (스냅샷 경량화 + 사이드카 인덱스)
 * 실행: node --test "tests/unit/*.test.js"
 * 라이브 userData 무접촉: 모든 케이스가 os.tmpdir() 아래 격리 디렉터리에서 돈다.
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { mkTmpRoot } = require('./_tmproot');
const crypto = require('crypto');
const SS = require('../../main/project-store/snapshot-store');
const X = require('../../main/project-store/externalizer');

const MIN = 60 * 1000;
const NOW = 1_787_700_000_000;

/* 진짜 바이트 — 해시·확장자 매핑까지 검증한다 */
const PNG_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const GIF_B64 = 'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
const PNG = `data:image/png;base64,${PNG_B64}`;
const GIF = `data:image/gif;base64,${GIF_B64}`;
const hash16 = (b64) => crypto.createHash('sha256').update(Buffer.from(b64, 'base64')).digest('hex').slice(0, 16);

const mkRoot = () => mkTmpRoot('goya-u1-');

function sec(id, name, inner = '') {
  return `<div class="section-block" data-section="1" id="${id}"${name ? ` data-name="${name}"` : ''}>`
       + `<div class="section-hitzone"><span class="section-label" draggable="true">${name || id}</span></div>`
       + `<div class="section-inner">${inner}</div></div>`;
}
function proj(id, pages, extra = {}) {
  return { id, name: 'T', version: 2, currentPageId: 'page_1', pages, checklistItems: [], ...extra };
}
function writeProjFile(root, id, data) {
  const dir = path.join(root, id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'proj.json'), JSON.stringify(data, null, 2));
  return path.join(dir, 'proj.json');
}
function deepFreeze(o) {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const k of Object.keys(o)) deepFreeze(o[k]);
  }
  return o;
}
/** 디렉터리 전체의 (상대경로, size, mtimeMs, 바이트해시) 스냅샷 — «안 건드렸다»를 측정으로 증명한다 */
function snapDir(dir) {
  const out = {};
  const walk = (d, rel) => {
    let ents = [];
    try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch (_) { return; }
    for (const e of ents) {
      const full = path.join(d, e.name), r = path.posix.join(rel, e.name);
      if (e.isDirectory()) walk(full, r);
      else {
        const st = fs.statSync(full);
        out[r] = `${st.size}:${st.mtimeMs}:${crypto.createHash('sha1').update(fs.readFileSync(full)).digest('hex')}`;
      }
    }
  };
  walk(dir, '');
  return out;
}

/* ═══ canonicalize ═══════════════════════════════════════════════════════ */

test('CN1 ★입력 객체를 «절대» 변형하지 않는다 — 오염되면 그대로 proj.json 으로 나간다', () => {
  const root = mkRoot();
  const data = deepFreeze(proj('p', [{ id: 'page_1', canvas: sec('sec_a', 'A', `<img src="${PNG}">`) }]));
  const r = SS.canonicalize(root, 'p', data, { write: true }); // 얼어 있으므로 변형 시도 시 throw
  assert.equal(r.changed, true);
  assert.ok(data.pages[0].canvas.includes('data:image'), '원본은 base64 그대로여야 한다');
  assert.ok(!r.data.pages[0].canvas.includes('data:image'), '산출물만 정규형이어야 한다');
  assert.notEqual(r.data, data);
  assert.notEqual(r.data.pages[0], data.pages[0]);
});

test('CN2 write:false 는 디스크를 한 바이트도 안 건드린다(해시만 계산)', () => {
  const root = mkRoot();
  const data = proj('p', [{ id: 'page_1', canvas: sec('sec_a', 'A', `<img src="${PNG}">`) }]);
  writeProjFile(root, 'p', data);
  const before = snapDir(root);
  const r = SS.canonicalize(root, 'p', data, { write: false });
  assert.deepEqual(snapDir(root), before, 'write:false 인데 디스크가 바뀌었다');
  assert.ok(r.data.pages[0].canvas.includes(`goya-asset://p/${hash16(PNG_B64)}.png`));
});

test('CN3 파일명이 externalizer.saveImageBytes 와 «완전히 같다» — 다르면 dedup 이 깨진다', () => {
  const rootA = mkRoot(), rootB = mkRoot();
  const buf = Buffer.from(PNG_B64, 'base64');
  const viaExt = X.saveImageBytes(rootA, 'p', buf, 'image/png');
  const data = proj('p', [{ id: 'page_1', canvas: sec('sec_a', 'A', `<img src="${PNG}">`) }]);
  const viaSnap = SS.canonicalize(rootB, 'p', data, { write: false });
  assert.ok(viaSnap.data.pages[0].canvas.includes(viaExt.filename),
    `externalizer=${viaExt.filename} 인데 snapshot-store 가 다른 이름을 만들었다`);
  assert.equal(SS._internal.assetNameFor(buf, 'image/png'), viaExt.filename);
});

test('CN4 ★dedup — 같은 이미지를 두 번 스냅샷하면 두 번째는 «0 바이트»를 쓴다', () => {
  const root = mkRoot();
  const data = proj('p', [{ id: 'page_1', canvas: sec('sec_a', 'A', `<img src="${PNG}"><img src="${GIF}">`) }]);
  const a = SS.canonicalize(root, 'p', data, { write: true });
  const b = SS.canonicalize(root, 'p', data, { write: true });
  assert.equal(a.images, 2);
  assert.ok(a.bytesWritten > 0);
  assert.equal(b.bytesWritten, 0, '두 번째는 파일이 이미 있어 재사용해야 한다');
  assert.equal(b.reused, 2);
});

test('CN5 확장자는 mime 을 따른다 (png/gif)', () => {
  const root = mkRoot();
  const data = proj('p', [{ id: 'page_1', canvas: sec('sec_a', 'A', `<img src="${PNG}"><img src="${GIF}">`) }]);
  const r = SS.canonicalize(root, 'p', data, { write: true });
  const files = fs.readdirSync(path.join(root, 'p', 'assets')).sort();
  assert.deepEqual(files, [`${hash16(GIF_B64)}.gif`, `${hash16(PNG_B64)}.png`].sort());
  assert.ok(r.data.pages[0].canvas.includes(`${hash16(GIF_B64)}.gif`));
});

test('CN6 [F6] 개행으로 «절단된» base64 는 건드리지 않는다 — 앞부분만 빼면 깨진 이미지가 된다', () => {
  const root = mkRoot();
  const wrapped = `data:image/png;base64,${PNG_B64.slice(0, 20)}\n${PNG_B64.slice(20)}`;
  const data = proj('p', [{ id: 'page_1', canvas: sec('sec_a', 'A', `<img src="${wrapped}">`) }]);
  const r = SS.canonicalize(root, 'p', data, { write: true });
  assert.equal(r.changed, false, '절단분만 있으면 아무것도 안 바꾼다');
  assert.ok(r.skipped > 0, '정직하게 skipped 로 집계해야 한다');
  assert.equal(r.data, data, '바꿀 게 없으면 원본 객체를 그대로 돌려준다');
});

test('CN7 섹션 수는 변하지 않는다 — 정규화가 구조를 건드리면 안 된다', () => {
  const root = mkRoot();
  const canvas = sec('sec_a', 'A', `<img src="${PNG}">`) + sec('sec_b', 'B') + sec('sec_c', 'C', `<div style="background-image:url(${PNG})"></div>`);
  const data = proj('p', [{ id: 'page_1', canvas }]);
  const r = SS.canonicalize(root, 'p', data, { write: true });
  assert.equal(SS.fingerprint(data).counts.sections, 3);
  assert.equal(SS.fingerprint(r.data).counts.sections, 3);
});

test('CN8 v1(pages 없이 canvas) 스키마도 처리한다', () => {
  const root = mkRoot();
  const data = { id: 'p', name: 'v1', canvas: sec('sec_a', 'A', `<img src="${PNG}">`) };
  const r = SS.canonicalize(root, 'p', data, { write: true });
  assert.equal(r.changed, true);
  assert.ok(r.data.canvas.includes('goya-asset://'));
  assert.ok(data.canvas.includes('data:image'), '원본 불변');
});

test('CN9 이미지가 없으면 no-op — 새 객체를 만들지도 않는다', () => {
  const root = mkRoot();
  const data = proj('p', [{ id: 'page_1', canvas: sec('sec_a', 'A', '<p>글자만</p>') }]);
  const r = SS.canonicalize(root, 'p', data, { write: true });
  assert.equal(r.changed, false);
  assert.equal(r.data, data);
  assert.ok(!fs.existsSync(path.join(root, 'p', 'assets')));
});

/* ═══ fingerprint ════════════════════════════════════════════════════════ */

test('FP1 섹션 키는 `pageId::sectionId` — market-merge 와 같은 규약', () => {
  const data = proj('p', [
    { id: 'page_1', canvas: sec('sec_a', 'A') + sec('sec_b', 'B') },
    { id: 'page_2', canvas: sec('sec_c', 'C') },
  ]);
  const fp = SS.fingerprint(data);
  assert.deepEqual(fp.secs.map(s => s.k), ['page_1::sec_a', 'page_1::sec_b', 'page_2::sec_c']);
  assert.deepEqual(fp.secs.map(s => s.n), ['A', 'B', 'C']);
  assert.equal(fp.counts.pages, 2);
  assert.equal(fp.counts.sections, 3);
});

test('FP2 이름 해석 순서: data-name → .section-label → id (§6-3 규약)', () => {
  const withLabel = `<div class="section-block" id="sec_x">`
    + `<div class="section-hitzone"><span class="section-label" draggable="true">라벨이름</span></div></div>`;
  const bare = `<div class="section-block" id="sec_y"></div>`;
  const fp = SS.fingerprint(proj('p', [{ id: 'page_1', canvas: sec('sec_a', '속성이름') + withLabel + bare }]));
  assert.deepEqual(fp.secs.map(s => s.n), ['속성이름', '라벨이름', 'sec_y']);
});

test('FP3 블록 수 = 식별자 가진 요소 − 섹션. 절대값이 아니라 «버전 간 일관성»이 목적이다', () => {
  const inner = '<div class="gap-block" id="gb_aaaa"></div><div class="text-block" id="tb_bbbb"></div>';
  const one = SS.fingerprint(proj('p', [{ id: 'page_1', canvas: sec('sec_a', 'A', inner) }]));
  const two = SS.fingerprint(proj('p', [{ id: 'page_1', canvas: sec('sec_a', 'A', inner + '<div class="gap-block" id="gb_cccc"></div>') }]));
  assert.equal(one.counts.blocks, 2);
  assert.equal(two.counts.blocks, 3, '블록이 하나 늘면 숫자도 하나 늘어야 한다');
});

test('FP4 svg 내부 id 처럼 «앱 규약이 아닌» id 는 블록으로 안 센다', () => {
  const inner = '<svg><linearGradient id="lnr-grad-1"></linearGradient></svg><div class="gap-block" id="gb_aaaa"></div>';
  const fp = SS.fingerprint(proj('p', [{ id: 'page_1', canvas: sec('sec_a', 'A', inner) }]));
  assert.equal(fp.counts.blocks, 1);
});

test('FP5 이미지는 base64·goya-asset 양쪽을 센다. assets 는 goya 참조 파일명', () => {
  const fp = SS.fingerprint(proj('p', [{ id: 'page_1',
    canvas: sec('sec_a', 'A', `<img src="${PNG}"><img src="goya-asset://p/deadbeef00000000.png">`) }]));
  assert.equal(fp.counts.images, 2);
  assert.deepEqual(fp.assets, ['deadbeef00000000.png']);
});

test('FP6 id 없는 섹션은 noid 키로 폴백한다 — 던지지 않는다', () => {
  const fp = SS.fingerprint(proj('p', [{ id: 'page_1', canvas: '<div class="section-block"></div>' }]));
  assert.equal(fp.counts.sections, 1);
  assert.match(fp.secs[0].k, /::noid_0$/);
});

/* ═══ writeSnapshot ══════════════════════════════════════════════════════ */

test('WS1 ★원본 proj.json 의 «바이트»가 변하지 않는다 (디렉터리 md5 롤업이 아니라 대상 파일 직접)', () => {
  const root = mkRoot();
  const data = proj('p', [{ id: 'page_1', canvas: sec('sec_a', 'A', `<img src="${PNG}">`) }]);
  const projPath = writeProjFile(root, 'p', data);
  const before = fs.readFileSync(projPath);
  const r = SS.writeSnapshot(root, 'p', data, { now: NOW });
  assert.equal(r.ok, true);
  assert.ok(before.equals(fs.readFileSync(projPath)), '★스냅샷이 원본 proj.json 을 건드렸다');
});

test('WS2 ★proj_backup.json 도 안 건드린다 — 롤링 백업은 저장 경로의 몫이다', () => {
  const root = mkRoot();
  const data = proj('p', [{ id: 'page_1', canvas: sec('sec_a', 'A') }]);
  writeProjFile(root, 'p', data);
  const bk = path.join(root, 'p', 'proj_backup.json');
  fs.writeFileSync(bk, '{"marker":1}');
  const before = fs.readFileSync(bk);
  SS.writeSnapshot(root, 'p', data, { now: NOW });
  assert.ok(before.equals(fs.readFileSync(bk)));
});

test('WS3 스냅샷은 정규형이다 — base64 가 사라지고 goya-asset 이 남는다', () => {
  const root = mkRoot();
  const data = proj('p', [{ id: 'page_1', canvas: sec('sec_a', 'A', `<img src="${PNG}">`) }]);
  writeProjFile(root, 'p', data);
  const r = SS.writeSnapshot(root, 'p', data, { now: NOW });
  const raw = fs.readFileSync(path.join(root, 'p', 'proj_history', `${r.ts}.json`), 'utf8');
  assert.equal(raw.indexOf('data:image'), -1);
  assert.ok(raw.includes(`goya-asset://p/${hash16(PNG_B64)}.png`));
  assert.ok(r.bytes < Buffer.byteLength(JSON.stringify(data, null, 2)), '경량화가 안 됐다');
});

test('WS4 간격 게이트 — 10분 이내 재저장은 슬롯을 안 만든다. 단 current 지문은 «갱신»된다', () => {
  const root = mkRoot();
  const d1 = proj('p', [{ id: 'page_1', canvas: sec('sec_a', 'A') }]);
  writeProjFile(root, 'p', d1);
  assert.equal(SS.writeSnapshot(root, 'p', d1, { now: NOW }).ok, true);

  const d2 = proj('p', [{ id: 'page_1', canvas: sec('sec_a', 'A') + sec('sec_b', 'B') }]);
  const r2 = SS.writeSnapshot(root, 'p', d2, { now: NOW + 5 * MIN });
  assert.equal(r2.ok, false);
  assert.equal(r2.skipped, 'interval');
  const idx = SS.readIndex(root, 'p');
  assert.equal(idx.entries.length, 1, '슬롯은 안 늘어야 한다');
  assert.equal(idx.current.counts.sections, 2, '★게이트에 막혀도 current 는 최신이어야 한다');
});

test('WS5 «정확히 10분»도 안 만든다 — 경계는 구정책 그대로(> 이지 >=)', () => {
  const root = mkRoot();
  const d = proj('p', [{ id: 'page_1', canvas: sec('sec_a', 'A') }]);
  writeProjFile(root, 'p', d);
  SS.writeSnapshot(root, 'p', d, { now: NOW });
  assert.equal(SS.writeSnapshot(root, 'p', d, { now: NOW + 10 * MIN }).ok, false);
  assert.equal(SS.writeSnapshot(root, 'p', d, { now: NOW + 10 * MIN + 1 }).ok, true);
});

test('WS6 force 는 게이트를 무시한다 (pre-restore 경로) + pinned 로 들어간다', () => {
  const root = mkRoot();
  const d = proj('p', [{ id: 'page_1', canvas: sec('sec_a', 'A') }]);
  writeProjFile(root, 'p', d);
  SS.writeSnapshot(root, 'p', d, { now: NOW });
  const r = SS.writeSnapshot(root, 'p', d, { now: NOW + 1 * MIN, force: true, reason: 'pre-restore' });
  assert.equal(r.ok, true);
  const e = SS.readIndex(root, 'p').entries.find(x => x.ts === r.ts);
  assert.equal(e.reason, 'pre-restore');
  assert.equal(e.pinned, true, '★pre-restore 는 프룬 면제여야 «되돌리기 취소»가 성립한다');
});

test('WS7 같은 ms 에 force 를 연타해도 슬롯이 덮이지 않는다', () => {
  const root = mkRoot();
  const d = proj('p', [{ id: 'page_1', canvas: sec('sec_a', 'A') }]);
  writeProjFile(root, 'p', d);
  const a = SS.writeSnapshot(root, 'p', d, { now: NOW, force: true });
  const b = SS.writeSnapshot(root, 'p', d, { now: NOW, force: true });
  assert.notEqual(a.ts, b.ts);
  assert.equal(SS.readIndex(root, 'p').entries.length, 2);
});

test('WS8 인덱스 엔트리에 목록이 필요로 하는 게 다 들어 있다', () => {
  const root = mkRoot();
  const data = proj('p', [{ id: 'page_1', canvas: sec('sec_a', '혜택정리', `<img src="${PNG}">`) + sec('sec_b', 'FAQ') }]);
  writeProjFile(root, 'p', data);
  const r = SS.writeSnapshot(root, 'p', data, { now: NOW });
  const e = SS.readIndex(root, 'p').entries[0];
  assert.equal(e.ts, r.ts);
  assert.equal(e.file, `${r.ts}.json`);
  assert.equal(e.canon, 1);
  assert.equal(e.counts.sections, 2);
  assert.ok(e.bytes > 0);
  assert.deepEqual(e.secs.map(s => s.n), ['혜택정리', 'FAQ']);
  assert.deepEqual(e.assets, [`${hash16(PNG_B64)}.png`], '★GC 제외 근거가 엔트리에 박혀야 한다');
});

/* ═══ 인덱스 ═════════════════════════════════════════════════════════════ */

test('IX1 인덱스는 «파생 데이터» — 지워도 재빌드가 같은 결과를 낸다', () => {
  const root = mkRoot();
  const d1 = proj('p', [{ id: 'page_1', canvas: sec('sec_a', 'A') }]);
  writeProjFile(root, 'p', d1);
  SS.writeSnapshot(root, 'p', d1, { now: NOW });
  SS.writeSnapshot(root, 'p', proj('p', [{ id: 'page_1', canvas: sec('sec_a', 'A') + sec('sec_b', 'B') }]), { now: NOW + 20 * MIN });
  const before = SS.readIndex(root, 'p');

  fs.unlinkSync(path.join(root, 'p', 'proj_history', 'index.json'));
  const rebuilt = SS.ensureIndex(root, 'p');
  assert.deepEqual(rebuilt.entries.map(e => [e.ts, e.canon, e.counts.sections]),
                   before.entries.map(e => [e.ts, e.canon, e.counts.sections]));
});

test('IX2 인덱스가 깨져 있으면 조용히 재빌드한다 — 목록이 죽으면 안 된다', () => {
  const root = mkRoot();
  const d = proj('p', [{ id: 'page_1', canvas: sec('sec_a', 'A') }]);
  writeProjFile(root, 'p', d);
  SS.writeSnapshot(root, 'p', d, { now: NOW });
  fs.writeFileSync(path.join(root, 'p', 'proj_history', 'index.json'), '{ 깨진 JSON');
  const idx = SS.ensureIndex(root, 'p');
  assert.equal(idx.entries.length, 1);
});

test('IX3 재빌드는 reason/pinned 를 «살려 옮긴다» — 디스크에서 못 뽑는 정보다', () => {
  const root = mkRoot();
  const d = proj('p', [{ id: 'page_1', canvas: sec('sec_a', 'A') }]);
  writeProjFile(root, 'p', d);
  const r = SS.writeSnapshot(root, 'p', d, { now: NOW, force: true, reason: 'pre-restore' });
  const rebuilt = SS.rebuildIndex(root, 'p');
  const e = rebuilt.entries.find(x => x.ts === r.ts);
  assert.equal(e.reason, 'pre-restore');
  assert.equal(e.pinned, true, '재빌드가 핀을 잃으면 되돌리기 취소 지점이 프룬으로 날아간다');
});

test('IX4 레거시(base64) 슬롯은 canon:0 으로 표시되고 «그대로» 목록에 남는다', () => {
  const root = mkRoot();
  const histDir = path.join(root, 'p', 'proj_history');
  fs.mkdirSync(histDir, { recursive: true });
  const legacy = proj('p', [{ id: 'page_1', canvas: sec('sec_a', 'A', `<img src="${PNG}">`) }]);
  fs.writeFileSync(path.join(histDir, `${NOW}.json`), JSON.stringify(legacy, null, 2));
  const idx = SS.ensureIndex(root, 'p');
  assert.equal(idx.entries.length, 1);
  assert.equal(idx.entries[0].canon, 0);
  assert.equal(idx.entries[0].counts.sections, 1, '레거시도 숫자는 나와야 한다');
});

test('IX5 손상된 슬롯은 인덱스에서 빠지되 «파일은 안 지운다» — 폴백 체인이 아직 쓸 수 있다', () => {
  const root = mkRoot();
  const histDir = path.join(root, 'p', 'proj_history');
  fs.mkdirSync(histDir, { recursive: true });
  fs.writeFileSync(path.join(histDir, `${NOW}.json`), '{ 깨짐');
  const idx = SS.ensureIndex(root, 'p');
  assert.equal(idx.entries.length, 0);
  assert.ok(fs.existsSync(path.join(histDir, `${NOW}.json`)), '★복구 도구가 복구 재료를 지우면 안 된다');
});

test('IX6 캔버스 «밖» base64(assetsTree 썸네일 등)는 canon 판정을 오염시키지 않는다', () => {
  const root = mkRoot();
  const data = proj('p', [{ id: 'page_1', canvas: sec('sec_a', 'A') }], { assetsTree: [{ thumb: PNG }] });
  writeProjFile(root, 'p', data);
  SS.writeSnapshot(root, 'p', data, { now: NOW });
  assert.equal(SS.rebuildIndex(root, 'p').entries[0].canon, 1,
    '캔버스 밖 base64 는 canonicalize 대상이 아니다 — raw 전체로 재면 정규형이 레거시로 오분류된다');
});

/* ═══ 프룬 ═══════════════════════════════════════════════════════════════ */

function seed(root, id, tsList, patch = () => ({})) {
  writeProjFile(root, id, proj(id, [{ id: 'page_1', canvas: sec('sec_a', 'A') }]));
  for (const ts of tsList) {
    SS.writeSnapshot(root, id, proj(id, [{ id: 'page_1', canvas: sec('sec_a', 'A') }]), { now: ts, force: true, ...patch(ts) });
  }
  return SS.readIndex(root, id);
}

test('PR1 최근 20개는 남는다 — 구정책 5슬롯에서 늘어난 것이 이 유닛의 핵심', () => {
  const root = mkRoot();
  const tsList = Array.from({ length: 30 }, (_, i) => NOW + i * 11 * MIN); // 전부 같은 날
  seed(root, 'p', tsList);
  const r = SS.pruneVersions(root, 'p', { now: tsList[tsList.length - 1] });
  const kept = SS.readIndex(root, 'p').entries.map(e => e.ts).sort((a, b) => b - a);
  assert.ok(kept.length >= 20, `최근 20 미만으로 줄었다 (kept=${kept.length})`);
  assert.deepEqual(kept.slice(0, 20), tsList.slice(-20).reverse());
  assert.ok(r.deleted.length > 0, '초과분은 실제로 지워져야 한다');
  for (const f of r.deleted) assert.ok(!fs.existsSync(path.join(root, 'p', 'proj_history', f)));
});

test('PR2 하루 1개 × 14일 — 「어제 그거」가 살아남는다', () => {
  const root = mkRoot();
  const DAY = 86400000;
  // 12일치, 하루 3개씩 = 36개. 최근 20개는 최근 ~7일이라, 8~12일 전은 «날짜 버킷»만이 살린다.
  const tsList = [];
  for (let d = 11; d >= 0; d--) for (let k = 0; k < 3; k++) tsList.push(NOW - d * DAY + k * 30 * MIN);
  seed(root, 'p', tsList);
  const now = tsList[tsList.length - 1];
  SS.pruneVersions(root, 'p', { now });
  const kept = SS.readIndex(root, 'p').entries.map(e => e.ts);
  const days = new Set(kept.map(t => SS._internal.dayKey(t)));
  assert.equal(days.size, 12, `12일 전부에 최소 1개가 남아야 한다 (남은 날=${days.size})`);
  // 각 날짜에서 «마지막» 것이 살아남았는지
  for (let d = 11; d >= 0; d--) {
    const last = NOW - d * DAY + 2 * 30 * MIN;
    assert.ok(kept.includes(last), `${SS._internal.dayKey(last)} 의 마지막 스냅샷이 사라졌다`);
  }
});

test('PR3 ★핀은 절대 안 지워진다 — 아무리 오래돼도', () => {
  const root = mkRoot();
  const DAY = 86400000;
  const oldPin = NOW - 200 * DAY;
  const root2 = root;
  writeProjFile(root2, 'p', proj('p', [{ id: 'page_1', canvas: sec('sec_a', 'A') }]));
  SS.writeSnapshot(root2, 'p', proj('p', [{ id: 'page_1', canvas: sec('sec_a', 'A') }]),
    { now: oldPin, force: true, reason: 'pre-restore' });
  for (let i = 0; i < 40; i++) {
    SS.writeSnapshot(root2, 'p', proj('p', [{ id: 'page_1', canvas: sec('sec_a', 'A') }]), { now: NOW + i * 11 * MIN, force: true });
  }
  SS.pruneVersions(root2, 'p', { now: NOW + 40 * 11 * MIN });
  const kept = SS.readIndex(root2, 'p').entries.map(e => e.ts);
  assert.ok(kept.includes(oldPin), '★200일 된 pre-restore 핀이 프룬에 날아갔다 — 되돌리기 취소가 불가능해진다');
});

test('PR4 ★레거시(canon:0)는 P1 에서 «절대» 안 지운다 — 복구 도구가 사용자 데이터를 지우면 안 된다', () => {
  const root = mkRoot();
  const histDir = path.join(root, 'p', 'proj_history');
  fs.mkdirSync(histDir, { recursive: true });
  const DAY = 86400000;
  const legacyTs = NOW - 300 * DAY;
  fs.writeFileSync(path.join(histDir, `${legacyTs}.json`),
    JSON.stringify(proj('p', [{ id: 'page_1', canvas: sec('sec_a', 'A', `<img src="${PNG}">`) }]), null, 2));
  writeProjFile(root, 'p', proj('p', [{ id: 'page_1', canvas: sec('sec_a', 'A') }]));
  for (let i = 0; i < 40; i++) {
    SS.writeSnapshot(root, 'p', proj('p', [{ id: 'page_1', canvas: sec('sec_a', 'A') }]), { now: NOW + i * 11 * MIN, force: true });
  }
  SS.pruneVersions(root, 'p', { now: NOW + 40 * 11 * MIN });
  assert.ok(fs.existsSync(path.join(histDir, `${legacyTs}.json`)), '★300일 된 레거시 슬롯이 지워졌다');
  assert.ok(SS.readIndex(root, 'p').entries.some(e => e.ts === legacyTs));
});

test('PR5 핀 상한은 «사용자 선호» 핀(manual)에만 걸린다 — 초과분은 해제될 뿐 즉시 삭제 안 됨', () => {
  const root = mkRoot();
  writeProjFile(root, 'p', proj('p', [{ id: 'page_1', canvas: sec('sec_a', 'A') }]));
  for (let i = 0; i < 15; i++) {
    SS.writeSnapshot(root, 'p', proj('p', [{ id: 'page_1', canvas: sec('sec_a', 'A') }]),
      { now: NOW + i * 11 * MIN, force: true, reason: 'manual' });
  }
  const r = SS.pruneVersions(root, 'p', { now: NOW + 15 * 11 * MIN });
  assert.equal(r.unpinned, 5, `15개 중 ${SS.PINNED_MAX}개만 핀으로 남아야 한다`);
  assert.equal(SS.readIndex(root, 'p').entries.filter(e => e.pinned).length, SS.PINNED_MAX);
  assert.equal(r.deleted.length, 0, '해제된 것도 최근 20 안이면 아직 남는다');
});

test('PR5b ★«안전판»(pre-restore)은 핀 상한에서 제외된다 — 상한이 약속을 조용히 철회하면 안 된다', () => {
  const root = mkRoot();
  writeProjFile(root, 'p', proj('p', [{ id: 'page_1', canvas: sec('sec_a', 'A') }]));
  const ts = [];
  for (let i = 0; i < 15; i++) {
    const r = SS.writeSnapshot(root, 'p', proj('p', [{ id: 'page_1', canvas: sec('sec_a', 'A') }]),
      { now: NOW + i * 11 * MIN, force: true, reason: 'pre-restore' });
    ts.push(r.ts);
  }
  const r = SS.pruneVersions(root, 'p', { now: NOW + 15 * 11 * MIN });
  assert.equal(r.unpinned, 0, '★안전판을 해제하면 그 되돌리기는 취소 불가가 된다');
  assert.equal(SS.readIndex(root, 'p').entries.filter(e => e.pinned).length, 15);
  // ★특히 «가장 오래된» 것 — 패닉 세션에서 그 소동 이전으로 가는 유일한 길이다
  assert.ok(SS.readVersion(root, 'p', ts[0]).ok, '★가장 오래된 안전판이 사라졌다');
});

test('PR6 프룬은 «빈 히스토리»에서도 던지지 않는다', () => {
  const root = mkRoot();
  writeProjFile(root, 'p', proj('p', [{ id: 'page_1', canvas: sec('sec_a', 'A') }]));
  const r = SS.pruneVersions(root, 'p', { now: NOW });
  assert.deepEqual(r.deleted, []);
});

/* ═══ 조회 ═══════════════════════════════════════════════════════════════ */

test('LV1 목록은 최신 우선 + current 를 함께 준다', () => {
  const root = mkRoot();
  const d = proj('p', [{ id: 'page_1', canvas: sec('sec_a', 'A') }]);
  writeProjFile(root, 'p', d);
  SS.writeSnapshot(root, 'p', d, { now: NOW });
  SS.writeSnapshot(root, 'p', d, { now: NOW + 20 * MIN });
  const r = SS.listVersions(root, 'p');
  assert.equal(r.ok, true);
  assert.deepEqual(r.entries.map(e => e.ts), [NOW + 20 * MIN, NOW]);
  assert.ok(r.current);
  assert.equal(r.current.counts.sections, 1);
});

test('LV2 ★current 가 낡았으면(디스크가 밖에서 바뀜) 목록이 그때 한 번 다시 잰다', () => {
  const root = mkRoot();
  const d = proj('p', [{ id: 'page_1', canvas: sec('sec_a', 'A') }]);
  writeProjFile(root, 'p', d);
  SS.writeSnapshot(root, 'p', d, { now: NOW });
  assert.equal(SS.listVersions(root, 'p').current.counts.sections, 1);
  // 저장 경로를 안 타고 디스크가 바뀐 상황(마이그레이션·외부 도구·자가치유)
  const changed = proj('p', [{ id: 'page_1', canvas: sec('sec_a', 'A') + sec('sec_b', 'B') + sec('sec_c', 'C') }]);
  const pp = path.join(root, 'p', 'proj.json');
  fs.writeFileSync(pp, JSON.stringify(changed, null, 2));
  fs.utimesSync(pp, new Date(), new Date(Date.now() + 5000)); // mtime 을 확실히 앞세운다
  assert.equal(SS.listVersions(root, 'p').current.counts.sections, 3, 'current 가 낡은 채로 답했다');
});

test('RV1 readVersion 은 ts 를 정수로만 받는다 — 경로 조작 차단', () => {
  const root = mkRoot();
  for (const bad of ['../../etc/passwd', '1;rm', '..', 'abc', '', null, '1e3']) {
    assert.equal(SS.readVersion(root, 'p', bad).ok, false, `거부되지 않았다: ${bad}`);
  }
});

test('RV2 readVersion 은 실제 스냅샷 데이터를 준다', () => {
  const root = mkRoot();
  const d = proj('p', [{ id: 'page_1', canvas: sec('sec_a', '혜택정리') }]);
  writeProjFile(root, 'p', d);
  const w = SS.writeSnapshot(root, 'p', d, { now: NOW });
  const r = SS.readVersion(root, 'p', w.ts);
  assert.equal(r.ok, true);
  assert.equal(SS.fingerprint(r.data).secs[0].n, '혜택정리');
});

/* ═══ ★GC 계약 ══════════════════════════════════════════════════════════ */

test('GC1 ★스냅샷이 참조하는 에셋이 «살아 있는» 목록에 든다 — 이걸 어기면 과거 버전이 조용히 깨진다', () => {
  const root = mkRoot();
  // 현재본에서는 이미지를 «지웠고», 과거 스냅샷에만 남아 있는 상황 = GC 가 가장 위험한 순간
  const withImg = proj('p', [{ id: 'page_1', canvas: sec('sec_a', 'A', `<img src="${PNG}">`) }]);
  writeProjFile(root, 'p', withImg);
  SS.writeSnapshot(root, 'p', withImg, { now: NOW });

  const withoutImg = proj('p', [{ id: 'page_1', canvas: sec('sec_a', 'A') }]);
  writeProjFile(root, 'p', withoutImg);

  const live = SS.listReferencedAssets(root, 'p');
  const name = `${hash16(PNG_B64)}.png`;
  assert.ok(live.has(name),
    `★${name} 이 살아있는 목록에 없다 — GC 가 지우면 ${NOW} 버전의 이미지가 깨진다`);
  assert.ok(fs.existsSync(path.join(root, 'p', 'assets', name)));
});

test('GC2 인덱스가 없어도 스냅샷 파일을 직접 읽어 집계한다 — 인덱스 부재가 GC 사고가 되면 안 된다', () => {
  const root = mkRoot();
  const withImg = proj('p', [{ id: 'page_1', canvas: sec('sec_a', 'A', `<img src="${PNG}">`) }]);
  writeProjFile(root, 'p', withImg);
  SS.writeSnapshot(root, 'p', withImg, { now: NOW });
  fs.unlinkSync(path.join(root, 'p', 'proj_history', 'index.json'));
  assert.ok(SS.listReferencedAssets(root, 'p').has(`${hash16(PNG_B64)}.png`));
});

test('GC3 proj_backup / pre-externalize / pre-rollback 의 참조도 «살아 있다»로 센다', () => {
  const root = mkRoot();
  const dir = path.join(root, 'p');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'proj.json'), '{}');
  fs.writeFileSync(path.join(dir, 'proj_backup.json'), JSON.stringify({ pages: [{ canvas: '<img src="goya-asset://p/aaaa000000000000.png">' }] }));
  fs.writeFileSync(path.join(dir, 'proj_pre-externalize.json'), JSON.stringify({ pages: [{ canvas: '<img src="goya-asset://p/bbbb000000000000.png">' }] }));
  fs.writeFileSync(path.join(dir, 'proj_pre-rollback.123.json'), JSON.stringify({ pages: [{ canvas: '<img src="goya-asset://p/cccc000000000000.png">' }] }));
  const live = SS.listReferencedAssets(root, 'p');
  for (const n of ['aaaa000000000000.png', 'bbbb000000000000.png', 'cccc000000000000.png']) {
    assert.ok(live.has(n), `${n} 이 빠졌다 — 이건 복구에 쓰일 수 있는 파일이다`);
  }
});

/* ═══ 통합 ═══════════════════════════════════════════════════════════════ */

test('IT1 ★실사용 재현 — 이미지가 무거운 프로젝트를 6번 저장하면 총량이 «한 벌 + 잔돈»이 된다', () => {
  const root = mkRoot();
  // 실데이터 비율 모사: 캔버스의 거의 전부가 인라인 base64
  const big = 'A'.repeat(120000);
  const IMG = `data:image/png;base64,${Buffer.from(big).toString('base64')}`;
  const mk = (n) => proj('p', [{ id: 'page_1',
    canvas: Array.from({ length: n }, (_, i) => sec(`sec_${i}`, `S${i}`, `<img src="${IMG}">`)).join('') }]);

  let rawTotal = 0, snapTotal = 0;
  for (let i = 0; i < 6; i++) {
    const d = mk(3);
    writeProjFile(root, 'p', d);
    rawTotal += Buffer.byteLength(JSON.stringify(d, null, 2));
    const r = SS.writeSnapshot(root, 'p', d, { now: NOW + i * 20 * MIN });
    assert.equal(r.ok, true);
    snapTotal += r.bytes;
    if (i === 0) assert.ok(r.bytesWritten > 0);
    else assert.equal(r.bytesWritten, 0, `★${i}번째 저장이 에셋을 또 썼다 — dedup 실패`);
  }
  const assetBytes = fs.readdirSync(path.join(root, 'p', 'assets'))
    .reduce((s, f) => s + fs.statSync(path.join(root, 'p', 'assets', f)).size, 0);
  const ratio = (snapTotal + assetBytes) / rawTotal;
  assert.ok(ratio < 0.25, `구방식 대비 ${(ratio * 100).toFixed(1)}% — 경량화가 무너졌다`);
  assert.equal(fs.readdirSync(path.join(root, 'p', 'assets')).length, 1, '6버전이 이미지 한 벌을 공유해야 한다');
});

test('IT2 스냅샷 슬롯은 «평범한 proj.json» 이라 구버전 코드도 읽는다(롤백 안전)', () => {
  const root = mkRoot();
  const d = proj('p', [{ id: 'page_1', canvas: sec('sec_a', 'A', `<img src="${PNG}">`) }]);
  writeProjFile(root, 'p', d);
  const r = SS.writeSnapshot(root, 'p', d, { now: NOW });
  const parsed = JSON.parse(fs.readFileSync(path.join(root, 'p', 'proj_history', `${r.ts}.json`), 'utf8'));
  assert.equal(parsed.version, 2);
  assert.equal(parsed.id, 'p');
  assert.ok(Array.isArray(parsed.pages));
  assert.equal(parsed.currentPageId, 'page_1');
});

test('IT3 레거시 슬롯과 신형 슬롯이 «섞여 있어도» 목록이 정상이다 — 실데이터가 정확히 그 상태다', () => {
  const root = mkRoot();
  const histDir = path.join(root, 'p', 'proj_history');
  fs.mkdirSync(histDir, { recursive: true });
  const legacy = proj('p', [{ id: 'page_1', canvas: sec('sec_a', 'A', `<img src="${PNG}">`) + sec('sec_old', '옛섹션') }]);
  fs.writeFileSync(path.join(histDir, `${NOW - 100 * MIN}.json`), JSON.stringify(legacy, null, 2));

  const cur = proj('p', [{ id: 'page_1', canvas: sec('sec_a', 'A', `<img src="${PNG}">`) }]);
  writeProjFile(root, 'p', cur);
  SS.writeSnapshot(root, 'p', cur, { now: NOW });

  const r = SS.listVersions(root, 'p');
  assert.equal(r.entries.length, 2);
  assert.equal(r.legacyCount, 1);
  assert.deepEqual(r.entries.map(e => e.canon), [1, 0], '최신 우선 + 형식 표시');
  assert.equal(r.entries[1].counts.sections, 2, '레거시도 숫자가 나와야 한다');
  assert.deepEqual(r.entries[1].secs.map(s => s.n), ['A', '옛섹션']);
});

test('WS9 ★current 갱신 스로틀 — 저장 경로에 지문 계산을 매번 얹지 않는다', () => {
  const root = mkRoot();
  const d1 = proj('p', [{ id: 'page_1', canvas: sec('sec_a', 'A') }]);
  writeProjFile(root, 'p', d1);
  SS.writeSnapshot(root, 'p', d1, { now: NOW });

  // 스로틀 안(3초 뒤) — current 는 그대로여야 한다
  const d2 = proj('p', [{ id: 'page_1', canvas: sec('sec_a', 'A') + sec('sec_b', 'B') }]);
  SS.writeSnapshot(root, 'p', d2, { now: NOW + 3000 });
  assert.equal(SS.readIndex(root, 'p').current.counts.sections, 1);

  // 스로틀 밖 — 갱신된다
  SS.writeSnapshot(root, 'p', d2, { now: NOW + SS.CURRENT_REFRESH_MS + 1000 });
  assert.equal(SS.readIndex(root, 'p').current.counts.sections, 2);
});

test('WS10 ★스로틀로 건너뛴 정확도는 목록이 메운다 — 낡은 current 로 답하지 않는다', () => {
  const root = mkRoot();
  const d1 = proj('p', [{ id: 'page_1', canvas: sec('sec_a', 'A') }]);
  const pp = writeProjFile(root, 'p', d1);
  SS.writeSnapshot(root, 'p', d1, { now: NOW });

  // 저장은 됐는데(디스크 최신) current 갱신은 스로틀에 막힌 상태를 재현
  const d2 = proj('p', [{ id: 'page_1', canvas: sec('sec_a', 'A') + sec('sec_b', 'B') + sec('sec_c', 'C') }]);
  fs.writeFileSync(pp, JSON.stringify(d2, null, 2));
  fs.utimesSync(pp, new Date(), new Date(Date.now() + 5000));
  SS.writeSnapshot(root, 'p', d2, { now: NOW + 3000 });
  assert.equal(SS.readIndex(root, 'p').current.counts.sections, 1, '스로틀에 막혔어야 한다');

  assert.equal(SS.listVersions(root, 'p').current.counts.sections, 3,
    '★목록이 mtime 을 보고 다시 재야 한다 — 여기서 안 메우면 스로틀이 정확도 손실이 된다');
});
