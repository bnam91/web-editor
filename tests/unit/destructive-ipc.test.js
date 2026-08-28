/* 3차 적대검수(파괴 경로) — «진짜 IPC» end-to-end 회귀.
 * 실행: node tests/unit/destructive-ipc.test.js
 * ★여기 있는 건 전부 「사용자 데이터를 잃는다」 경로다. 흉내내지 않고 main.js 핸들러를 직접 부른다.
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { loadMain } = require('./_ipc-harness');

const H = loadMain();
const DIR = H.projectsDir;
let seq = 0;
const sec = (id, name) => `<div class="section-block" id="${id}" data-name="${name}"></div>`;
const proj = (id, canvas) => ({ id, name: '삭제테스트', version: 2, currentPageId: 'page_1',
  pages: [{ id: 'page_1', name: 'Page 1', canvas }], checklistItems: [] });
async function mkProject(canvas) {
  const id = `proj_${1787800000000 + (seq++) * 1000}`;
  const r = await H.invoke('projects:save', proj(id, canvas));
  assert.equal(r.ok, true);
  return id;
}
const histDir = (id) => path.join(DIR, id, 'proj_history');

/* ═══ A① (치명) — «진짜» 되돌리기 6회. 검수자 재현 그대로 ═════════════ */

test('A1e ★36MB 프로젝트 교체 6회 — 6회차 안전판이 «같은 트랜잭션의 프룬» 뒤에도 살아있다', async () => {
  /* ★유닛(destructive.test.js A1a)은 인덱스 bytes 를 찍어 예산 초과를 «만들었다».
   *   여기선 진짜로 예산(200MB)을 넘기는 실물을 쓴다 — 안전판 6개 × 약 36MB.
   *   그래야 「bytes 를 찍는 방식이 실제 경로와 다르다」는 반론이 안 남는다. 실측 3초 안쪽이다. */
  const big = '<p>' + '가나다라마바사'.repeat(1_700_000) + '</p>';   // ≈ 35.7MB
  const id = `proj_${1787900000000 + (seq++) * 1000}`;
  const mk = (n) => ({ id, name: '큰텍스트', version: 2, currentPageId: 'page_1',
    pages: [{ id: 'page_1', name: 'Page 1',
              canvas: `<div class="section-block" id="sec_${n}" data-name="작업${n}">${big}</div>` }] });
  assert.equal((await H.invoke('projects:save', mk(0))).ok, true);
  const first = (await H.invoke('projects:history-list', { projectId: id })).entries[0].ts;

  let last = null;
  for (let i = 1; i <= 6; i++) {
    // 매번 내용을 바꿔 두고(=잃을 작업이 생긴다) 그 상태에서 옛 버전으로 교체한다.
    assert.equal((await H.invoke('projects:save', mk(i))).ok, true);
    const r = await H.invoke('projects:history-restore', { projectId: id, ts: first, openProjectIds: [] });
    assert.equal(r.ok, true, `${i}회차 교체 실패: ${JSON.stringify(r)}`);
    assert.ok(r.preRestoreTs, `${i}회차 안전판 ts 가 없다`);
    last = r.preRestoreTs;
  }

  // ★UI 는 방금 「↩ 교체됨 — 직전 상태는 버전 목록 맨 위에 있어요」를 띄운 참이다.
  const list = await H.invoke('projects:history-list', { projectId: id });
  const live = new Set(list.entries.map(e => e.ts));
  assert.ok(live.has(last),
    `★6회차 안전판(${last})이 «같은 트랜잭션의 프룬»에 지워졌다 — 확인창이 「잘못 골랐으면 그걸로 `
    + `다시 되돌릴 수 있습니다」라고 약속한 직후다. 현재 상태는 «되돌아간 옛 버전»이므로 `
    + `교체 직전의 작업은 여기 말고 어디에도 없다`);
  assert.ok(fs.existsSync(path.join(histDir(id), `${last}.json`)), '★인덱스엔 있는데 파일이 없다');

  // ★그리고 «실제로 되돌아가진다» — 목록에 보이는 것과 쓸 수 있는 것은 다른 약속이다.
  const back = await H.invoke('projects:history-restore', { projectId: id, ts: last, openProjectIds: [] });
  assert.equal(back.ok, true, `★목록엔 있는데 되돌릴 수 없다: ${JSON.stringify(back && back.reason)}`);
  const now = JSON.parse(fs.readFileSync(path.join(DIR, id, 'proj.json'), 'utf8'));
  assert.match(now.pages[0].canvas, /id="sec_6"/, '★취소했는데 교체 직전 작업이 아니다');
});

/* ═══ A② (치명) — pins.json 이 «프로젝트»로 채택돼 proj.json 을 덮는다 ═══ */

test('A2a ★전원차단 재현 — 잘린 proj.json 을 «핀 사이드카»로 복구하지 않는다', async () => {
  const id = await mkProject(sec('sec_a', '진짜 내용') + sec('sec_b', 'B') + sec('sec_c', 'C'));
  // 되돌리기를 한 번 해서 «진짜» pins.json 을 만든다(손으로 만든 픽스처가 아니다).
  const list = await H.invoke('projects:history-list', { projectId: id });
  const ts = list.entries[0].ts;
  await H.invoke('projects:history-restore', { projectId: id, ts, openProjectIds: [] });
  const pins = path.join(histDir(id), 'pins.json');
  assert.ok(fs.existsSync(pins), '전제 실패: pins.json 이 없다');

  // 전원차단: proj.json 이 잘리고, 같이 쓰이던 백업·슬롯도 함께 깨진다.
  fs.writeFileSync(path.join(DIR, id, 'proj.json'), '{"pages":[{"id":"page_1","canv');
  for (const f of fs.readdirSync(histDir(id))) {
    if (/^\d+\.json$/.test(f)) fs.writeFileSync(path.join(histDir(id), f), '{"pages":[{"id":"pa');
  }
  const bak = path.join(DIR, id, 'proj_backup.json');
  if (fs.existsSync(bak)) fs.writeFileSync(bak, '{"pages":[{"id":"pa');

  const loaded = await H.invoke('projects:load', id);
  if (loaded !== null) {
    assert.ok(Array.isArray(loaded.pages) || typeof loaded.canvas === 'string',
      `★프로젝트가 아닌 것을 프로젝트로 반환했다: ${JSON.stringify(loaded).slice(0, 120)}`);
  }
  // ★자가치유가 «덮어썼는지»가 진짜 피해다 — 반환값만 보면 못 잡는다.
  const after = fs.readFileSync(path.join(DIR, id, 'proj.json'), 'utf8');
  assert.ok(!/pre-restore/.test(after),
    '★자가치유가 proj.json 을 핀 사이드카 내용으로 덮었다 — 39MB 원본이 3줄이 되는 경로다');
});

test('A2b ★후보 «생성»단에서도 사이드카가 안 나온다 — 이름이 늘어도 따라올 필요가 없게', async () => {
  const id = await mkProject(sec('sec_a', 'A'));
  const SS = require('../../main/project-store/snapshot-store');
  fs.writeFileSync(path.join(histDir(id), 'pins.json'), '{"1":"pre-restore"}');
  fs.writeFileSync(path.join(histDir(id), 'index.json.bak'), '{"entries":[]}');   // 미래에 늘 법한 이름
  const cands = SS.loadFallbackCandidates(DIR, id, () => null).map(c => path.basename(c.path));
  assert.ok(cands.every(f => /^\d+\.json$/.test(f) || !f.endsWith('.json') || /proj/.test(f)),
    `★슬롯이 아닌 파일이 복구 후보에 들어갔다: ${cands.join(', ')}`);
  assert.ok(!cands.includes('pins.json'), '★pins.json 이 복구 후보다');
  assert.ok(!cands.includes('index.json.bak'), '★인덱스 백업이 복구 후보다');
  assert.ok(cands.some(f => /^\d+\.json$/.test(f)), '전제 실패: 진짜 슬롯이 후보에 없다(양성대조)');
});

test('A2c ★이름을 «우리가 안 짓는» 후보(backup)에서도 프로젝트 형태를 확인한다', async () => {
  // proj_history 슬롯 이름은 이 모듈이 짓지만 backup·pre-externalize 는 아니다.
  //   그래서 후보 «생성»단 필터만으로는 이 자리를 못 막는다 — 채택 «직전»의 형태 확인이 필요하다.
  //   실사고 형태: 백업이 원자쓰기 도중 «파싱은 되는데 내용이 없는» 상태로 남는다.
  const id = await mkProject(sec('sec_a', '진짜 내용') + sec('sec_b', 'B'));
  fs.writeFileSync(path.join(DIR, id, 'proj_backup.json'), '{}');
  for (const f of fs.readdirSync(histDir(id))) {
    if (/^\d+\.json$/.test(f)) fs.unlinkSync(path.join(histDir(id), f));
  }
  fs.writeFileSync(path.join(DIR, id, 'proj.json'), '{"pages":[{"id":"page_1","canv');

  const loaded = await H.invoke('projects:load', id);
  assert.ok(loaded === null || Array.isArray(loaded.pages) || typeof loaded.canvas === 'string',
    `★내용이 없는 백업을 프로젝트로 채택했다: ${JSON.stringify(loaded)}`);
  const after = fs.readFileSync(path.join(DIR, id, 'proj.json'), 'utf8');
  assert.ok(!/^\s*\{\s*\}\s*$/.test(after),
    '★자가치유가 proj.json 을 «빈 객체»로 덮었다 — 복구하러 온 사용자의 파일을 여기서 잃는다');
});

/* ═══ A③ (치명) — 삭제 부분실패 시 «번들에 손대지 않고» 중단한다 ═══════ */

test('A3a ★잔재 하나가 실패하면 번들은 건드리지 않는다 — 좀비 부활 경로', async () => {
  const id = await mkProject(sec('sec_new', '새 내용'));
  // 구 flat 잔재 — 1년 전 옛 내용. 이게 남고 번들이 사라지면 폴백이 좀비를 되살린다.
  const leftover = path.join(DIR, `${id}_history`);
  fs.mkdirSync(leftover, { recursive: true });
  fs.writeFileSync(path.join(leftover, '1756000000000.json'),
    JSON.stringify(proj(id, sec('sec_old', '1년 전 옛것'))));

  // ★«잔재만» 실패시킨다 — 전부 실패시키면 「번들이 안 갔다」가 저절로 참이 돼서 가드를 못 잰다.
  H.failTrash('EPERM: operation not permitted', `${id}_history`);
  const r = await H.invoke('projects:delete', id, {});
  H.failTrash(null);

  assert.equal(r.ok, false);
  assert.ok(fs.existsSync(path.join(DIR, id, 'proj.json')),
    '★잔재에서 실패했는데 번들이 휴지통으로 갔다 — 확인창에서 취소하면 «1년 전 내용»의 좀비가 남고 '
    + '그 프로젝트의 버전 기록은 통째로 휴지통이라 앱 안에서 되돌릴 방법이 없다');
  assert.equal(r.trashed, false, '★번들이 그대로인데 「휴지통에 갔다」고 답했다');
});

test('A3b 첫 잔재만 실패해도 «그 뒤 잔재까지» 안 건드린다 — 부분 파괴 없음', async () => {
  const id = await mkProject(sec('sec_new', '새'));
  for (const n of [`${id}.json`, `${id}_backup.json`]) fs.writeFileSync(path.join(DIR, n), '{}');
  H.failTrash('EPERM', `${id}.json`);   // ★«첫» 잔재만 실패
  const r = await H.invoke('projects:delete', id, {});
  H.failTrash(null);
  assert.equal(r.ok, false);
  assert.equal(r.deleted, 0, `★첫 실패 뒤에도 계속 지웠다(deleted=${r.deleted})`);
  assert.ok(fs.existsSync(path.join(DIR, `${id}.json`)) && fs.existsSync(path.join(DIR, `${id}_backup.json`)));
  assert.ok(fs.existsSync(path.join(DIR, id, 'proj.json')));
});

test('A3c 양성대조 — 실패가 없으면 «전부» 휴지통으로 간다(중단이 삭제를 죽인 게 아니다)', async () => {
  const id = await mkProject(sec('sec_a', 'A'));
  fs.writeFileSync(path.join(DIR, `${id}.json`), '{}');
  const r = await H.invoke('projects:delete', id, {});
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.trashed, true);
  assert.ok(r.deleted >= 2, `deleted=${r.deleted}`);
  assert.ok(!fs.existsSync(path.join(DIR, id)), '번들이 안 갔다');
  assert.ok(!fs.existsSync(path.join(DIR, `${id}.json`)), '잔재가 안 갔다');
});
