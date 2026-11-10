/* trash-delete-fail-keeps-history.test.js — NEW-TRASH-DELETE-FAIL-WIPES-HISTORY-01 (미카사 실앱 1회 · 지디 261110)
 *   손순서: 프로젝트 폴더 쓰기 금지(chmod 555) → 갤러리 ✕ → 앱 휴지통 실패(rename) → «영구 삭제 진행?» 예 → «삭제하지 못했습니다 ENOTEMPTY»
 *     그런데 폴더 안 claude-pm·proj_history 파일들이 비워짐 = 버전 기록 소실.
 *   뿌리: main.js projects:delete 영구 갈래 fs.rmSync(recursive) 가 쓰기 되는 하위부터 지우다 555 꼭대기에서 멈췄다.
 *   고침(매니저 결정 · 원자성): 지우기 전 점검(막히면 0 바이트 거절) → 대상을 같은 볼륨 대기 자리로 통째 rename(실패면 되돌림 · 0 바이트) → 그 «뒤»에만 지움.
 *   진짜 main.js(_ipc-harness loadMain · 진짜 IPC) · 진짜 임시 폴더 · 진짜 권한.
 *   D1 ★꼭대기 555 → 영구 삭제 = 거절 · 파일 목록 «한 바이트도» 그대로(옛: claude-pm·proj_history 비워짐)
 *   D2 ★안쪽 폴더(proj_history) 555 → 같은 거절 · 이웃 폴더 파일도 그대로
 *   D3 점검은 지났는데 떼어 내기(rename) 중간 실패(틈 흉내) → 옮긴 것 되돌림 · 파일 목록 그대로 · 목록에 프로젝트 그대로
 *   D4 다 떼어 낸 뒤 지우기 실패(rmSync 흉내) → ok · 목록에서 사라짐 · 남은 것은 «대기 자리»에 그대로(잃지 않음) · 사용자에게 할 말(note)
 *   D5 [음성] 평소 영구 삭제 = 폴더 없음 · 대기 자리 찌꺼기 0
 * 양성대조(지디 인텔): 기준 06adc8a4c 의 main.js 로 돌리면 D1·D2·D3 빨강(옛 rmSync 가 지운다) · D5 초록. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { loadMain } = require('./_ipc-harness');

const H = loadMain();
const DIR = H.projectsDir;
let seq = 0;
const sec = (id, name) => `<div class="section-block" id="${id}" data-name="${name}"><div class="section-inner"><div class="text-block"><div class="tb-h2">${name}</div></div></div></div>`;
const proj = (id, canvas) => ({ id, name: '삭제실패시험', version: 2, currentPageId: 'page_1', pages: [{ id: 'page_1', name: 'Page 1', canvas }], checklistItems: [] });

/** 진짜 저장 길로 만든다 — 두 번 저장해 버전 기록도 생기게 · claude-pm 폴더에 파일 하나(미카사 실앱처럼) */
async function mkProject() {
  const id = `proj_${1788800000000 + (seq++) * 1000}`;
  for (const n of ['첫 판', '둘째 판', '셋째 판']) {
    const r = await H.invoke('projects:save', proj(id, sec('sec_a', n) + sec('sec_b', 'FAQ')));
    assert.equal(r.ok, true);
  }
  const pm = path.join(DIR, id, 'claude-pm'); fs.mkdirSync(pm, { recursive: true });
  fs.writeFileSync(path.join(pm, 'notes.md'), '# 작업 기록\n');
  return id;
}
/** 폴더 아래 모든 파일(상대 경로 · 크기) — «한 바이트도» 비교용 */
function listing(root) {
  const out = [];
  const walk = (d) => { for (const n of fs.readdirSync(d).sort()) { const p = path.join(d, n); const st = fs.lstatSync(p); if (st.isDirectory()) walk(p); else out.push(`${path.relative(root, p)}:${st.size}`); } };
  walk(root);
  return out;
}
const holdRoot = () => path.join(DIR, '.trash', '.deleting');
const held = () => (fs.existsSync(holdRoot()) ? fs.readdirSync(holdRoot()) : []);

test('D1 ★꼭대기 폴더 555 → 영구 삭제 거절 · 파일 «한 바이트도» 그대로(버전 기록·claude-pm)', async () => {
  const id = await mkProject();
  const dir = path.join(DIR, id);
  const before = listing(dir);
  assert.ok(before.some(f => f.startsWith('claude-pm/')), '[전제] claude-pm 파일');
  assert.ok(before.length >= 3, `[전제] 파일이 여럿(버전 기록 포함) — ${before.join(', ')}`);
  fs.chmodSync(dir, 0o555);
  let r;
  try { r = await H.invoke('projects:delete', id, { permanent: true }); }
  finally { fs.chmodSync(dir, 0o755); }
  assert.equal(r.ok, false, '★못 지웠는데 성공이라 했다');
  assert.equal(r.deleted, 0);
  assert.deepEqual(listing(dir), before, '★실패했는데 파일이 지워졌다(버전 기록 소실)');
  assert.match(String(r.message), /아무것도 지우지 않았습니다/);
  const list = await H.invoke('projects:list');
  assert.ok(list.some(p => p.id === id), '목록에 그대로');
});

test('D2 ★안쪽 폴더 555 → 거절 · 이웃 폴더 파일도 그대로', async () => {
  const id = await mkProject();
  const dir = path.join(DIR, id);
  const before = listing(dir);
  const pm = path.join(dir, 'claude-pm');
  fs.chmodSync(pm, 0o555);
  let r;
  try { r = await H.invoke('projects:delete', id, { permanent: true }); }
  finally { fs.chmodSync(pm, 0o755); }
  assert.equal(r.ok, false);
  assert.deepEqual(listing(dir), before, '★안쪽이 막혔는데 다른 폴더 파일이 지워졌다');
});

test('D3 점검은 지났는데 떼어 내기 중간 실패(틈) → 되돌림 · 0 바이트 · 목록 그대로', async () => {
  const id = await mkProject();
  const dir = path.join(DIR, id);
  fs.writeFileSync(path.join(DIR, `${id}_backup.json`), '{"old":1}');   // 구 flat 잔재 하나 — 잔재 먼저 옮기고 번들에서 실패하게
  const before = listing(dir);
  const real = fs.renameSync; let n = 0;
  fs.renameSync = function (a, b) { if (String(b).includes(`${path.sep}.deleting${path.sep}`) && ++n === 2) { const e = new Error('EACCES: 틈 흉내'); e.code = 'EACCES'; throw e; } return real.apply(this, arguments); };
  let r;
  try { r = await H.invoke('projects:delete', id, { permanent: true }); }
  finally { fs.renameSync = real; }
  assert.equal(r.ok, false);
  assert.equal(r.code, 'detach_failed');
  assert.deepEqual(listing(dir), before, '★떼어 내기 실패인데 파일이 바뀌었다');
  assert.ok(fs.existsSync(path.join(DIR, `${id}_backup.json`)), '먼저 옮긴 잔재도 제자리로');
  assert.deepEqual(held().filter(h => h.startsWith(id)), [], '대기 자리에 남은 것 없음');
  const list = await H.invoke('projects:list');
  assert.ok(list.some(p => p.id === id));
});

test('D4 다 떼어 낸 뒤 지우기 실패 → 목록에선 사라짐 · 남은 것은 대기 자리에(잃지 않음) · 할 말', async () => {
  const id = await mkProject();
  const before = listing(path.join(DIR, id));
  const real = fs.rmSync;
  fs.rmSync = function (p) { if (String(p).includes(`${path.sep}.deleting${path.sep}`)) { const e = new Error('ENOTEMPTY 흉내'); e.code = 'ENOTEMPTY'; throw e; } return real.apply(this, arguments); };
  let r;
  try { r = await H.invoke('projects:delete', id, { permanent: true }); }
  finally { fs.rmSync = real; }
  assert.equal(r.ok, true, '사용자가 고른 영구 삭제 — 떼어 냈으면 목록에서는 지운 것');
  assert.ok(r.leftover && r.note, '★못 지운 것을 말하지 않았다');
  assert.equal(fs.existsSync(path.join(DIR, id)), false);
  assert.deepEqual(listing(path.join(r.leftover.dir, id)), before, '대기 자리에 통째로 남았다(반쯤 지운 것 아님)');
  const list = await H.invoke('projects:list');
  assert.ok(!list.some(p => p.id === id));
  real(r.leftover.dir, { recursive: true, force: true });
});

test('D5 [음성] 평소 영구 삭제 — 폴더 없음 · 대기 자리 찌꺼기 0', async () => {
  const id = await mkProject();
  const r = await H.invoke('projects:delete', id, { permanent: true });
  assert.equal(r.ok, true);
  assert.equal(r.trashed, false);
  assert.equal(fs.existsSync(path.join(DIR, id)), false);
  assert.deepEqual(held().filter(h => h.startsWith(id)), []);
});
