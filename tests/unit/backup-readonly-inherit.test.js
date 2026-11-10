/* backup-readonly-inherit — proj.json 이 읽기전용(444)이던 뒤 proj_backup.json 이 그 권한을 물려받아 굳는다 (BACKUP-INHERITS-READONLY-FREEZES-01 · 미카사 발주9 곁)
 * 까닭: 롤링 백업이 fs.copyFileSync 였다 — macOS copyfile 은 원본 «권한»까지 복사한다 ⇒ 444 백업이 생기고, 그 뒤 백업은 읽기전용 대상 위 복사가 EACCES 로 실패(copy_failed).
 * 고침: 백업도 proj.json 과 같은 원자적 쓰기(임시 → rename) — 새 파일은 늘 쓰기 되는 권한 · 이미 굳은 444 백업도 갈아 끼운다.
 * 칸: 진짜 main 핸들러(_ipc-harness) · 진짜 chmod.
 *   B1 proj.json 444 에서 저장 → 백업은 쓰기 되는 권한 · 다음 저장마다 백업이 «직전 판»으로 바뀐다(기준판 빨강: 굳어 첫 판에 멈춘다)
 *   B2 이미 굳은 444 백업(옛 판이 남긴 것) → 다음 저장이 갈아 끼운다(기준판 빨강)
 *   B3 비동기·동기 두 저장 길 다 · N1 [대조] 평범한 권한이면 예전과 같다(백업 = 직전 판 바이트 · 백업 mtime = 그 판이 저장된 시각 — 리뷰 1)
 * ★판단(proj.json 권한): 지금도 «존중하지 않는다» — 저장은 임시 파일 → rename 이라 444 proj.json 도 첫 저장에서 644 새 파일로 갈린다(이 가지 무변).
 *   존중하면(읽기전용이면 저장 거절) 편집이 LS 에만 남고 파일엔 안 간다 = 잃음 쪽 — 그래서 바꾸지 않는다. B1 이 그 «지금 동작»을 같이 적는다.
 * ⚠️root 로 돌면 권한이 안 먹어 재현이 안 된다 — 건너뛴다(빨강 0 을 «통과»로 읽지 않게 이유를 남긴다).
 * 양성대조: main.js _rollBackup 의 `_atomicWriteFileSync(backupPath, raw)` 를 `fs.copyFileSync(prevPath, backupPath)` 로 되돌리면 B1·B2·B3 빨강 · N1 초록. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), path = require('path');
const { loadMain } = require('./_ipc-harness');

const H = loadMain();
const ROOT = typeof process.getuid === 'function' && process.getuid() === 0;
const sec = (k, t) => `<div class="section-block" id="sec_${k}" data-section="1"><div class="section-inner"><div class="text-block" id="tb_${k}"><p>${t}</p></div></div></div>`;
const proj = (id, tag) => ({ id, name: id, version: 2, currentPageId: 'page_1', pages: [{ id: 'page_1', name: 'P', canvas: sec('a', tag + ' 머리') + sec('b', tag + ' 몸') + sec('c', tag + ' 끝') }] });
let n = 0;
const P = (id, f) => path.join(H.projectsDir, id, f);
const tagOf = (f) => (JSON.parse(fs.readFileSync(f, 'utf8')).pages[0].canvas.match(/>(\S+) 머리</) || [])[1];
const writable = (f) => (fs.statSync(f).mode & 0o200) !== 0;
const saveBy = (sync) => (p) => (sync ? H.invokeSync('projects:save-sync', null, p) : H.invoke('projects:save', p));

for (const sync of [false, true]) {
  const nm = sync ? '동기' : '비동기';
  test(`B1·B3 ${nm} — proj.json 444 에서 저장해도 백업은 쓰기 되는 권한 · 다음 저장마다 백업이 직전 판으로 바뀐다`, { skip: ROOT && 'root 는 권한을 안 탄다' }, async () => {
    const save = saveBy(sync);
    const id = 'proj_' + (8100 + n++);
    assert.equal((await save(proj(id, '판1'))).ok, true);
    fs.chmodSync(P(id, 'proj.json'), 0o444);   // 사용자가 읽기전용으로
    assert.notEqual((await save(proj(id, '판2'))).ok, false);
    assert.equal(tagOf(P(id, 'proj_backup.json')), '판1', '[전제] 첫 백업 = 직전 판');
    assert.equal(writable(P(id, 'proj_backup.json')), true, '★백업이 원본의 읽기전용을 물려받았다');
    assert.equal(writable(P(id, 'proj.json')), true, '지금 동작 기록 — 저장(임시 → rename)은 444 proj.json 을 새 파일로 간다(이 가지 무변)');
    for (const t of ['판3', '판4']) {
      assert.notEqual((await save(proj(id, t))).ok, false);
      const want = t === '판3' ? '판2' : '판3';
      assert.equal(tagOf(P(id, 'proj_backup.json')), want, `★백업이 굳었다 — ${t} 저장 뒤 백업이 ${want} 가 아니다`);
    }
  });
}

test('B2 이미 굳은 444 백업(옛 판이 남긴 것) — 다음 저장이 갈아 끼운다', { skip: ROOT && 'root 는 권한을 안 탄다' }, async () => {
  const id = 'proj_' + (8100 + n++);
  assert.equal((await H.invoke('projects:save', proj(id, '판1'))).ok, true);
  assert.equal((await H.invoke('projects:save', proj(id, '판2'))).ok, true);
  fs.chmodSync(P(id, 'proj_backup.json'), 0o444);   // 옛 판이 굳혀 둔 백업
  assert.equal(tagOf(P(id, 'proj_backup.json')), '판1', '[전제]');
  assert.equal((await H.invoke('projects:save', proj(id, '판3'))).ok, true);
  assert.equal(tagOf(P(id, 'proj_backup.json')), '판2', '★굳은 백업이 안 바뀌었다');
  assert.equal(writable(P(id, 'proj_backup.json')), true);
});

test('N1 [대조] 평범한 권한이면 백업 = 직전 proj.json 바이트 그대로', async () => {
  const id = 'proj_' + (8100 + n++);
  assert.equal((await H.invoke('projects:save', proj(id, '판1'))).ok, true);
  const old = new Date('2026-01-02T03:04:05.000Z'); fs.utimesSync(P(id, 'proj.json'), old, old);   // 판1 이 «그때» 저장됐다
  const before = fs.readFileSync(P(id, 'proj.json'));
  assert.equal((await H.invoke('projects:save', proj(id, '판2'))).ok, true);
  assert.ok(fs.readFileSync(P(id, 'proj_backup.json')).equals(before), '백업 바이트가 직전 proj.json 과 다르다');
  /* 리뷰 1 — 백업 mtime = 그 내용이 저장된 시각(옛 copyfile 과 같게) — 복구 안내의 «언제 저장된 판»이 이 값이다 */
  assert.ok(Math.abs(fs.statSync(P(id, 'proj_backup.json')).mtimeMs - old.getTime()) < 1000, '★백업 mtime 이 «백업을 쓴 시각»이 됐다 — 복구 안내가 실제보다 최근으로 보인다');
  assert.equal(fs.existsSync(P(id, 'proj_backup.json.tmp')), false, '임시 파일이 남았다');
});
