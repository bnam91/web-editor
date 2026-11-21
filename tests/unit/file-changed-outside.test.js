/* file-changed-outside — FILE-CHANGED-OUTSIDE-WHILE-OPEN-OVERWRITE-01(현빈 결정 261121 · MISSING-FOLDER-02 적대 리뷰 4 일반화) 쓰기 전 도장 비교.
 * 자: 진짜 main 핸들러(_ipc-harness · 임시 userData — 현빈 저장본 무접촉). 렌더러 상자 = DOM file-changed-outside.
 * O1 열며 읽은 뒤 밖에서 바뀜 → 비동기 저장 거절(changed_outside) · 파일 = 밖의 판 · 내 본 = 버전 기록 핀 outside-mine(ts 돌려줌)
 * O2 동기 저장(종료·새로고침)도 같다
 * O3 [거짓 경보 0] 같은 내용을 밖이 다시 씀(iCloud 꼴 — 새 ino·새 시각) → 저장 통과
 * O4b [앞부분 비교 함정] 크기 같고 64KB 뒤만 바뀜(시각 다름) → 거절(앞 64KB 비교면 덮었다)
 * O5 «내 것으로 저장»(_overOutside) → 밖의 판을 핀 outside-theirs 로 먼저 남기고 덮음 · 그 뒤 평소 저장 통과(새 바탕)
 * O6 «내 것으로 저장» 인데 밖의 판 핀을 못 남김 → 안 덮음(theirsNotKept)
 * O7 내 본 핀을 못 남김 → 비상 사본(kept 'emergency') · 그래도 안 덮음
 * O11 [옛 가드에 맡김] 밖의 판이 프로젝트로 안 읽힘(깨짐) → 이 갈래는 거절 안 함 · 롤링 백업이 깨진 판을 옆에 둔 뒤 씀
 * O8 [옛 동작] 이번 실행에 안 읽은(도장 없는) 파일 → 평소대로 씀 · 제 저장 둘 연달아 = 거절 없음
 * O9 같은 본(시각만 다름)의 두 거절 = 핀 하나 · 다른 본은 따로
 * O10 밖에서 바뀐 뒤 이름 바꾸기(overFile — 지금 파일 위)는 통과 · 낡은 탭 저장은 계속 거절(poison) · 다시 열면 평소
 * 양성대조: _patches/file-changed-outside-CTL.patch(_outsideRefusal 첫 줄 return null) → O1·O2·O4b·O5·O6·O7·O9·O10 빨강.
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), path = require('path');
const { loadMain } = require('./_ipc-harness');

const H = loadMain();
H.stub.BrowserWindow.getAllWindows = () => [{ webContents: { executeJavaScript: async () => {} } }];
const SS = require(path.join(__dirname, '../../main/project-store/snapshot-store.js'));
const sec = (k, t) => `<div class="section-block" id="sec_${k}" data-section="1"><div class="section-inner"><div class="text-block" id="tb_${k}"><p>${t}</p></div></div></div>`;
const proj = (id, tag, pad = '') => ({ id, name: id, version: 2, currentPageId: 'page_1', pages: [{ id: 'page_1', name: 'P', canvas: sec('a', tag + ' 머리') + pad + sec('b', tag + ' 끝') }] });
let n = 0;
const P = (id) => path.join(H.projectsDir, id, 'proj.json');
const file = (id) => fs.readFileSync(P(id), 'utf8');
const pins = (id) => SS._internal.readPins(H.projectsDir, id);
const histHas = (id, re) => { const h = path.join(H.projectsDir, id, 'proj_history'); return fs.existsSync(h) && fs.readdirSync(h).some((f) => /^\d+\.json$/.test(f) && re.test(fs.readFileSync(path.join(h, f), 'utf8'))); };
/* 밖에서 바꾼다 — 다른 앱처럼 임시 파일 → rename(새 ino · 새 시각) */
const outside = (id, text) => { const t = P(id) + '.ext'; fs.writeFileSync(t, text); fs.renameSync(t, P(id)); };
async function opened(tag = '처음') {
  const id = 'proj_' + (9800 + n++);
  assert.equal((await H.invoke('projects:save', proj(id, tag))).ok, true);
  assert.ok(await H.invoke('projects:load', id, { open: true }), '[전제] 열며 읽음');
  return id;
}

test('O1 열며 읽은 뒤 밖에서 바뀜 → 비동기 저장은 안 덮고 내 본을 핀으로', async () => {
  const id = await opened();
  outside(id, JSON.stringify(proj(id, '밖')));
  const r = await H.invoke('projects:save', proj(id, '내편집'));
  assert.deepEqual([r.ok, r.reason, r.kept, typeof r.ts], [false, 'changed_outside', 'history', 'number']);
  assert.match(file(id), /밖 머리/, '★밖의 판을 덮었다');
  assert.equal(pins(id)[String(r.ts)], 'outside-mine', '내 본 핀');
  assert.ok(histHas(id, /내편집 머리/), '★내 편집이 어디에도 안 남았다');
});
test('O2 동기 저장(종료·새로고침)도 안 덮는다', async () => {
  const id = await opened();
  outside(id, JSON.stringify(proj(id, '밖')));
  const r = H.invokeSync('projects:save-sync', null, proj(id, '내편집'));
  assert.deepEqual([r.ok, r.reason, r.kept], [false, 'changed_outside', 'history']);
  assert.match(file(id), /밖 머리/);
});
test('O3 같은 내용을 밖이 다시 씀(새 ino·시각) → 거짓 경보 없이 저장', async () => {
  const id = await opened();
  const same = file(id);
  outside(id, same);
  const r = await H.invoke('projects:save', proj(id, '내편집'));
  assert.equal(r.ok, true, `거짓 경보 ${JSON.stringify(r)}`);
  assert.match(file(id), /내편집 머리/);
});
test('O4b 크기 같고 64KB 뒤만 바뀜 · 시각 다름 → 거절', async () => {
  const id = 'proj_' + (9800 + n++);
  const pad = sec('pad', 'x'.repeat(80000));
  assert.equal((await H.invoke('projects:save', proj(id, '처음', pad))).ok, true);
  await H.invoke('projects:load', id, { open: true });
  const t = file(id), i = t.lastIndexOf('처음 끝');
  outside(id, t.slice(0, i) + '바꿈 끝' + t.slice(i + '처음 끝'.length));
  const r = await H.invoke('projects:save', proj(id, '내편집', pad));
  assert.equal(r.reason, 'changed_outside', '★같은 크기·앞 64KB 같음을 같은 판으로 봤다');
  assert.match(file(id), /바꿈 끝/);
});
test('O5 «내 것으로 저장» → 밖의 판 핀 먼저 · 덮음 · 그 뒤 평소 저장 통과', async () => {
  const id = await opened();
  outside(id, JSON.stringify(proj(id, '밖')));
  assert.equal((await H.invoke('projects:save', proj(id, '내편집'))).reason, 'changed_outside');
  const r = await H.invoke('projects:save', { ...proj(id, '내편집'), _overOutside: true });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.match(file(id), /내편집 머리/);
  assert.equal(file(id).includes('_overOutside'), false, '표시가 파일에 들어갔다');
  assert.ok(Object.values(pins(id)).includes('outside-theirs'), '밖의 판 핀');
  assert.ok(histHas(id, /밖 머리/), '★밖의 판이 어디에도 안 남았다');
  assert.equal((await H.invoke('projects:save', proj(id, '다음'))).ok, true, '새 바탕 — 거짓 거절');
});
test('O6 «내 것으로 저장» 인데 밖의 판 핀을 못 남김 → 안 덮음', async () => {
  const id = await opened();
  outside(id, JSON.stringify(proj(id, '밖')));
  const real = SS.writeSnapshot;
  SS.writeSnapshot = (d, pid, data, o) => (o && o.reason === 'outside-theirs' ? { ok: false, skipped: 'write_failed' } : real(d, pid, data, o));
  try {
    const r = await H.invoke('projects:save', { ...proj(id, '내편집'), _overOutside: true });
    assert.deepEqual([r.ok, r.reason, r.theirsNotKept], [false, 'changed_outside', true]);
    assert.match(file(id), /밖 머리/, '★밖의 판을 못 남긴 채 덮었다');
  } finally { SS.writeSnapshot = real; }
});
test('O7 내 본 핀을 못 남김 → 비상 사본 · 안 덮음', async () => {
  const id = await opened();
  outside(id, JSON.stringify(proj(id, '밖')));
  const real = SS.writeSnapshot;
  SS.writeSnapshot = (d, pid, data, o) => (o && o.reason === 'outside-mine' ? { ok: false, skipped: 'write_failed' } : real(d, pid, data, o));
  try {
    const r = await H.invoke('projects:save', proj(id, '내편집'));
    assert.equal(r.reason, 'changed_outside');
    assert.notEqual(r.kept, 'history');
    assert.match(file(id), /밖 머리/);
    assert.equal(r.kept, 'emergency', `비상 사본 ${JSON.stringify(r)}`);
  } finally { SS.writeSnapshot = real; }
});
test('O8 [옛 동작] 도장 없는 파일 = 평소대로 · 제 저장 연달아 = 거절 없음', async () => {
  const id = 'proj_' + (9800 + n++);
  fs.mkdirSync(path.join(H.projectsDir, id), { recursive: true });
  fs.writeFileSync(P(id), JSON.stringify(proj(id, '밖에서만듦')));
  assert.equal((await H.invoke('projects:save', proj(id, '첫'))).ok, true, '도장 없음 = 옛 동작');
  const id2 = await opened();
  for (const t of ['하나', '둘', '셋']) assert.equal((await H.invoke('projects:save', proj(id2, t))).ok, true, t);
  assert.equal(H.invokeSync('projects:save-sync', null, proj(id2, '넷')).ok, true);
});
test('O9 같은 본(시각만 다름) 두 거절 = 핀 하나 · 다른 본은 따로', async () => {
  const id = await opened();
  outside(id, JSON.stringify(proj(id, '밖')));
  const a = await H.invoke('projects:save', { ...proj(id, '내편집'), updatedAt: '2026-01-01T00:00:00Z' });
  const b = H.invokeSync('projects:save-sync', null, { ...proj(id, '내편집'), updatedAt: '2026-01-01T00:00:09Z' });
  assert.equal(a.ts, b.ts, '같은 본인데 핀이 둘');
  const c = await H.invoke('projects:save', proj(id, '다른편집'));
  assert.notEqual(c.ts, a.ts);
  assert.equal(Object.values(pins(id)).filter((x) => x === 'outside-mine').length, 2);
});
test('O10 밖에서 바뀐 뒤 이름 바꾸기는 통과 · 낡은 탭 저장은 계속 거절 · 다시 열면 평소', async () => {
  const id = await opened();
  outside(id, JSON.stringify(proj(id, '밖')));
  const rn = await H.invoke('projects:rename', { projectId: id, name: '새이름' });
  assert.equal(rn && rn.ok, true, JSON.stringify(rn));
  assert.match(file(id), /밖 머리/, '[전제] 이름 바꾸기는 지금 파일 위');
  const r = await H.invoke('projects:save', proj(id, '낡은탭'));
  assert.equal(r.reason, 'changed_outside', '★이름 바꾸기가 도장을 «제 것»으로 갈아 낡은 탭이 밖의 판을 덮었다');
  await H.invoke('projects:load', id, { open: true });
  assert.equal((await H.invoke('projects:save', proj(id, '다시연뒤'))).ok, true);
});
test('O11 밖의 판이 깨짐 → 이 갈래는 거절 안 함 · 롤링 백업이 옆에 두고 씀', async () => {
  const id = await opened();
  outside(id, '{깨진');
  const r = await H.invoke('projects:save', proj(id, '내편집'));
  assert.equal(r.ok, true, JSON.stringify(r));
  const dirFiles = fs.readdirSync(path.join(H.projectsDir, id));
  assert.ok(dirFiles.some((f) => f !== 'proj.json' && fs.statSync(path.join(H.projectsDir, id, f)).isFile() && fs.readFileSync(path.join(H.projectsDir, id, f), 'utf8') === '{깨진'), `깨진 판이 옆에 안 남았다 ${dirFiles}`);
});
