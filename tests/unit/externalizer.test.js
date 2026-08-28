/* 단위 하네스 — main/project-store/externalizer.js
 * 실행: node --test tests/unit/
 * 라이브 userData 무접촉: 모든 케이스가 os.tmpdir() 아래 격리 디렉터리에서 돈다.
 */
'use strict';
const test = require('node:test');
const { mkTmpRoot } = require('./_tmproot.js');

const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const X = require('../../main/project-store/externalizer');

// 1x1 PNG·GIF (진짜 바이트 — 해시·확장자 매핑까지 검증)
const PNG_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const GIF_B64 = 'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
const PNG = `data:image/png;base64,${PNG_B64}`;
const GIF = `data:image/gif;base64,${GIF_B64}`;
const hash16 = (b64) => crypto.createHash('sha256').update(Buffer.from(b64, 'base64')).digest('hex').slice(0, 16);

function mkRoot() { return mkTmpRoot('goya-ext-'); }
function writeProj(root, id, obj, meta) {
  const dir = path.join(root, id); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'proj.json'), JSON.stringify(obj, null, 2));
  if (meta) fs.writeFileSync(path.join(dir, 'proj_meta.json'), JSON.stringify(meta, null, 2));
  return dir;
}
const readProj = (root, id) => JSON.parse(fs.readFileSync(path.join(root, id, 'proj.json'), 'utf8'));
const section = (inner) => `<div class="section-block">${inner}</div>`;

// 레거시 v2: 같은 이미지가 data-* 속성 + 인라인 style url()에 이중 저장, 페이지 간 중복
function legacyV2(id) {
  return {
    version: 2, id, name: 'legacy', currentPageId: 'p1',
    pages: [
      { id: 'p1', name: 'Page 1', canvas: section(`<div class="asset-block" data-img-src="${PNG}" style="background-image:url(${PNG})"></div>`) + section(`<img src="${GIF}">`) },
      { id: 'p2', name: 'Page 2', canvas: section(`<div data-bg-img="${PNG}"></div>`) + section('<p>no image</p>') },
    ],
    checklistItems: [],
  };
}

test('v2: 전부 외부화 · dedup · 섹션수 보존 · 백업 rename · 마커', () => {
  const root = mkRoot(); const id = 'proj_1';
  writeProj(root, id, legacyV2(id), { name: 'legacy', listMetaV: 1, thumbnail: 'x' });
  const hooks = [];
  const r = X.externalizeProjectFile(root, id, { afterWrite: (pid) => hooks.push(pid) });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.refs, 4);      // PNG×3 + GIF×1
  assert.equal(r.images, 2);    // 고유 2장
  assert.equal(r.skipped, 0);
  assert.ok(r.after < r.before);
  assert.deepEqual(hooks, [id]);
  const data = readProj(root, id);
  const all = data.pages.map(p => p.canvas).join('');
  assert.equal((all.match(/data:image/g) || []).length, 0);
  assert.equal((all.match(/section-block/g) || []).length, 4);
  assert.ok(all.includes(`goya-asset://${id}/${hash16(PNG_B64)}.png`));
  assert.ok(all.includes(`goya-asset://${id}/${hash16(GIF_B64)}.gif`));
  const assets = fs.readdirSync(path.join(root, id, 'assets')).sort();
  assert.deepEqual(assets, [`${hash16(PNG_B64)}.png`, `${hash16(GIF_B64)}.gif`].sort());
  // 에셋 바이트 = 디코드 원본 그대로
  assert.equal(fs.readFileSync(path.join(root, id, 'assets', `${hash16(PNG_B64)}.png`)).toString('base64'), PNG_B64);
  // 원본 rename 백업 = 변환 전 바이트와 동일
  const backup = fs.readFileSync(path.join(root, id, X.BACKUP_NAME), 'utf8');
  assert.deepEqual(JSON.parse(backup), legacyV2(id));
  // meta 마커 + 기존 meta 필드 보존
  const meta = JSON.parse(fs.readFileSync(path.join(root, id, 'proj_meta.json'), 'utf8'));
  assert.equal(meta.thumbnail, 'x');
  assert.equal(meta.externalized.images, 2);
  assert.equal(meta.externalized.backup, X.BACKUP_NAME);
  // 다른 필드(checklistItems 등) 보존
  assert.deepEqual(data.checklistItems, []);
  assert.equal(data.name, 'legacy');
});

test('멱등: 재실행은 noop, 파일 불변', () => {
  const root = mkRoot(); const id = 'proj_2';
  writeProj(root, id, legacyV2(id));
  assert.equal(X.externalizeProjectFile(root, id).ok, true);
  const before = fs.readFileSync(path.join(root, id, 'proj.json'), 'utf8');
  const r2 = X.externalizeProjectFile(root, id);
  assert.equal(r2.ok, true); assert.equal(r2.noop, true);
  assert.equal(fs.readFileSync(path.join(root, id, 'proj.json'), 'utf8'), before);
});

test('v1 포맷(canvas 단일) 지원', () => {
  const root = mkRoot(); const id = 'proj_v1';
  writeProj(root, id, { id, name: 'v1', canvas: section(`<img src="${PNG}">`) });
  const r = X.externalizeProjectFile(root, id);
  assert.equal(r.ok, true); assert.equal(r.images, 1);
  assert.ok(readProj(root, id).canvas.includes('goya-asset://'));
});

test('혼재: 기존 goya-asset 참조는 건드리지 않고 base64만 변환 + 기존 에셋 재사용 카운트', () => {
  const root = mkRoot(); const id = 'proj_mix';
  const dir = writeProj(root, id, { version: 2, id, pages: [{ id: 'p1', canvas: section(`<img src="goya-asset://${id}/deadbeefdeadbeef.png">`) + section(`<img src="${PNG}">`) }] });
  // PNG 에셋이 이미 있는 상황(신규 자동외부화가 먼저 만든 경우)
  fs.mkdirSync(path.join(dir, 'assets'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'assets', `${hash16(PNG_B64)}.png`), Buffer.from(PNG_B64, 'base64'));
  const r = X.externalizeProjectFile(root, id);
  assert.equal(r.ok, true); assert.equal(r.images, 1); assert.equal(r.reused, 1);
  const c = readProj(root, id).pages[0].canvas;
  assert.ok(c.includes('deadbeefdeadbeef.png'));
  assert.equal((c.match(/goya-asset:\/\//g) || []).length, 2);
});

test('비base64 SVG data URI는 대상 아님(원본 유지) → noop', () => {
  const root = mkRoot(); const id = 'proj_svg';
  writeProj(root, id, { version: 2, id, pages: [{ id: 'p1', canvas: section(`<img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E">`) }] });
  const r = X.externalizeProjectFile(root, id);
  assert.equal(r.ok, true); assert.equal(r.noop, true);
});

test('dryRun: 통계만, 디스크 불변', () => {
  const root = mkRoot(); const id = 'proj_dry';
  writeProj(root, id, legacyV2(id));
  const before = fs.readFileSync(path.join(root, id, 'proj.json'), 'utf8');
  const r = X.externalizeProjectFile(root, id, { dryRun: true });
  assert.equal(r.dryRun, true); assert.equal(r.images, 2); assert.equal(r.refs, 4);
  assert.equal(fs.readFileSync(path.join(root, id, 'proj.json'), 'utf8'), before);
  assert.equal(fs.existsSync(path.join(root, id, 'assets')), false);
});

test('손상 JSON → 손대지 않음', () => {
  const root = mkRoot(); const id = 'proj_bad';
  const dir = path.join(root, id); fs.mkdirSync(dir);
  fs.writeFileSync(path.join(dir, 'proj.json'), '{"version":2,"pages":[{"canvas":"' + PNG);
  const before = fs.readFileSync(path.join(dir, 'proj.json'), 'utf8');
  const r = X.externalizeProjectFile(root, id);
  assert.equal(r.ok, false); assert.equal(r.reason, 'corrupt_json');
  assert.equal(fs.readFileSync(path.join(dir, 'proj.json'), 'utf8'), before);
  assert.equal(fs.existsSync(path.join(dir, X.BACKUP_NAME)), false);
});

test('실패 주입: 에셋 디렉터리에 못 쓰면 proj.json 무변경·백업 없음', () => {
  const root = mkRoot(); const id = 'proj_ro';
  const dir = writeProj(root, id, legacyV2(id));
  // assets 자리를 «파일»로 막아 mkdir/쓰기를 실패시킨다
  fs.writeFileSync(path.join(dir, 'assets'), 'not a dir');
  const before = fs.readFileSync(path.join(dir, 'proj.json'), 'utf8');
  const r = X.externalizeProjectFile(root, id);
  assert.equal(r.ok, false); assert.equal(r.reason, 'no_asset_written');
  assert.equal(fs.readFileSync(path.join(dir, 'proj.json'), 'utf8'), before);
  assert.equal(fs.existsSync(path.join(dir, X.BACKUP_NAME)), false);
});

test('부분 실패: 깨진 base64 한 장은 원본 유지, 나머지는 변환(skipped 카운트)', () => {
  const root = mkRoot(); const id = 'proj_part';
  // 1글자 payload는 정규식엔 매칭되지만 디코드하면 0바이트 → skip되어야 한다(원본 유지)
  writeProj(root, id, { version: 2, id, pages: [{ id: 'p1', canvas: section(`<img src="${PNG}"><img src="data:image/png;base64,A">`) }] });
  const r = X.externalizeProjectFile(root, id);
  assert.equal(r.ok, true); assert.equal(r.images, 1); assert.equal(r.skipped, 1);
  const c = readProj(root, id).pages[0].canvas;
  assert.ok(c.includes('goya-asset://')); assert.ok(c.includes("data:image/png;base64,A\""));
});

test('되돌리기: 원본 복원 · 현재본은 «전용» proj_pre-rollback.json으로(F2) · 백업 소비 · 마커 제거 · 재변환(updatedAt만 다름)', () => {
  const root = mkRoot(); const id = 'proj_rb';
  writeProj(root, id, legacyV2(id), { name: 'legacy' });
  assert.equal(X.externalizeProjectFile(root, id).ok, true);
  const converted = fs.readFileSync(path.join(root, id, 'proj.json'), 'utf8');
  const rb = X.rollbackExternalize(root, id);
  assert.equal(rb.ok, true);
  // 원본 복원(단 F3로 updatedAt이 갱신돼 있었으므로 그 필드만 무시하고 비교)
  const restored = readProj(root, id); delete restored.updatedAt;
  assert.deepEqual(restored, legacyV2(id));
  // ★F2: 되돌리기 직전 현재본은 롤링 proj_backup.json이 아니라 «전용» proj_pre-rollback.json에 보존된다
  assert.equal(fs.readFileSync(path.join(root, id, 'proj_pre-rollback.json'), 'utf8'), converted);
  assert.equal(fs.existsSync(path.join(root, id, 'proj_backup.json')), false); // 롤링 슬롯은 되돌리기가 안 건드린다
  assert.equal(rb.preRollback, 'proj_pre-rollback.json');
  assert.equal(fs.existsSync(path.join(root, id, X.BACKUP_NAME)), false);
  const meta = JSON.parse(fs.readFileSync(path.join(root, id, 'proj_meta.json'), 'utf8'));
  assert.equal(meta.externalized, undefined); assert.equal(meta.name, 'legacy'); assert.ok(meta.externalizedRolledBackAt);
  // 재변환 → 에셋 재사용·구조 동일. ★F3로 updatedAt은 변환시각으로 갱신되므로 그 필드만 무시하고 동일성 검증.
  const r2 = X.externalizeProjectFile(root, id);
  assert.equal(r2.ok, true); assert.equal(r2.images, 2); assert.equal(r2.reused, 2);
  const reconverted = readProj(root, id); const convertedObj = JSON.parse(converted);
  delete reconverted.updatedAt; delete convertedObj.updatedAt;
  assert.deepEqual(reconverted, convertedObj);
  // 백업 없으면 되돌리기 거부
  assert.equal(X.rollbackExternalize(root, 'proj_none').ok, false);
});

test('백업이 이미 있으면 덮지 않고 회전', () => {
  const root = mkRoot(); const id = 'proj_rot';
  const dir = writeProj(root, id, legacyV2(id));
  fs.writeFileSync(path.join(dir, X.BACKUP_NAME), '{"stale":true}');
  const r = X.externalizeProjectFile(root, id);
  assert.equal(r.ok, true);
  const rotated = fs.readdirSync(dir).filter(f => /^proj_pre-externalize\.\d+\.json$/.test(f));
  assert.equal(rotated.length, 1);
  assert.equal(fs.readFileSync(path.join(dir, rotated[0]), 'utf8'), '{"stale":true}');
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, X.BACKUP_NAME), 'utf8')), legacyV2(id));
});

test('scanProjectFile: 캔버스 base64만 센다(assetsTree 썸네일 제외)', () => {
  const root = mkRoot(); const id = 'proj_scan';
  const obj = legacyV2(id); obj.assetsTree = [{ type: 'folder', children: [{ type: 'file', thumbSrc: GIF }] }];
  writeProj(root, id, obj);
  assert.equal(X.scanProjectFile(root, id).base64RefsAll, 5);
  const s1 = X.scanProjectFile(root, id);
  assert.equal(s1.exists, true); assert.equal(s1.base64Refs, 4); assert.equal(s1.goyaRefs, 0); assert.equal(s1.hasBackup, false);
  X.externalizeProjectFile(root, id);
  const s2 = X.scanProjectFile(root, id);
  assert.equal(s2.base64Refs, 0); assert.equal(s2.base64RefsAll, 1); assert.equal(s2.goyaRefs, 4); assert.equal(s2.hasBackup, true); assert.equal(s2.externalized.images, 2);
  // 변환 후 assetsTree 썸네일은 그대로(범위 밖)
  assert.ok(JSON.stringify(readProj(root, id).assetsTree).includes('data:image/gif'));
  assert.equal(X.scanProjectFile(root, 'nope').exists, false);
});

test('path traversal: projectId 살균', () => {
  const root = mkRoot();
  const r = X.externalizeProjectFile(root, '../../etc');
  assert.equal(r.ok, false); assert.equal(r.reason, 'no_proj_json');
  assert.equal(X._internal.pathsFor(root, '../x').id, '.._x');
});

// [F6 절단클래스] 개행으로 잘린 base64는 «건드리지 않고» 원본 인라인 유지(반토막 저장·쓰레기 잔존 방지)
const WRAPPED = `data:image/png;base64,${PNG_B64.slice(0, 20)}\n${PNG_B64.slice(20)}`;
test('절단(개행 낀) base64: 온전한 것만 변환, 잘린 것은 인라인 유지·skipped 집계', () => {
  const root = mkRoot(); const id = 'proj_trunc';
  writeProj(root, id, { version: 2, id, pages: [{ id: 'p1', canvas: section(`<img src="${PNG}"><img src="${WRAPPED}">`) }] });
  const r = X.externalizeProjectFile(root, id);
  assert.equal(r.ok, true);
  assert.equal(r.images, 1);          // 온전한 PNG만 변환
  assert.equal(r.skipped, 1);         // 절단분은 skipped
  const c = readProj(root, id).pages[0].canvas;
  assert.ok(c.includes('goya-asset://'));                        // PNG는 치환됨
  assert.ok(c.includes(`data:image/png;base64,${PNG_B64.slice(0, 20)}`)); // 절단 원본 그대로 인라인
  assert.ok(c.includes(PNG_B64.slice(20).slice(0, 12)));         // 뒷절반도 남아있음(쓰레기 아님·원본 유지)
  const assets = fs.readdirSync(path.join(root, id, 'assets'));
  assert.equal(assets.length, 1);     // 절단분은 에셋으로 저장 안 됨(깨진 파일 방지)
});
test('절단분만 있으면: 변환 안 하고 정직하게 실패(원본 무손상)', () => {
  const root = mkRoot(); const id = 'proj_trunc_only';
  const dir = writeProj(root, id, { version: 2, id, pages: [{ id: 'p1', canvas: section(`<img src="${WRAPPED}">`) }] });
  const before = fs.readFileSync(path.join(dir, 'proj.json'), 'utf8');
  const r = X.externalizeProjectFile(root, id);
  assert.equal(r.ok, false); assert.equal(r.reason, 'all_base64_truncated'); assert.equal(r.skipped, 1);
  assert.equal(fs.readFileSync(path.join(dir, 'proj.json'), 'utf8'), before);   // 무손상
  assert.equal(fs.existsSync(path.join(dir, X.BACKUP_NAME)), false);
});

// [F2 회전] 2차 되돌리기가 1차 보관본(proj_pre-rollback.json)을 덮지 않고 회전
test('되돌리기: 기존 pre-rollback 있으면 회전(1차 보관본 보존)', () => {
  const root = mkRoot(); const id = 'proj_rb_rot';
  const dir = writeProj(root, id, legacyV2(id), { name: 'legacy' });
  assert.equal(X.externalizeProjectFile(root, id).ok, true);
  const converted = fs.readFileSync(path.join(dir, 'proj.json'), 'utf8');
  // 1차 되돌리기 흉내: 기존 pre-rollback(과거 보관본)이 이미 있다고 두고 되돌리기
  fs.writeFileSync(path.join(dir, 'proj_pre-rollback.json'), '{"prev-rollback":"WORK-A"}');
  const rb = X.rollbackExternalize(root, id);
  assert.equal(rb.ok, true);
  // 새 보관본 = 되돌리기 직전 현재본(converted)
  assert.equal(fs.readFileSync(path.join(dir, 'proj_pre-rollback.json'), 'utf8'), converted);
  // 1차 WORK-A는 삭제되지 않고 타임스탬프로 회전 보존됨
  const rots = fs.readdirSync(dir).filter(f => /^proj_pre-rollback\.\d+\.json$/.test(f));
  assert.equal(rots.length, 1);
  assert.equal(fs.readFileSync(path.join(dir, rots[0]), 'utf8'), '{"prev-rollback":"WORK-A"}');
});
