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

/* ═══ [D] 변이 스윕이 「지워도 전부 초록」이라 짚은 자리들 ════════════════
 * ★여기 있는 건 결함이 아니라 «구멍»이다 — 코드는 맞는데 아무도 안 재고 있었다.
 *   보관정책이 0회 돌아도, 종료 스냅샷이 통째로 사라져도(현빈 Q4 확정 기능!) 스위트가 전부 초록이었다.
 */

/** 히스토리에 «10분보다 오래된» 슬롯 n개를 직접 심는다(게이트를 열어두기 위해). */
function seedOldSlots(id, n, baseTs) {
  const hd = histDir(id);
  fs.mkdirSync(hd, { recursive: true });
  // ★기존 슬롯을 먼저 치운다 — 안 그러면 mkProject 가 «방금» 만든 슬롯이 최신이라
  //   간격 게이트가 닫힌 채로 남아, 「새 스냅샷이 안 생긴다」를 코드 탓으로 오판한다.
  for (const f of fs.readdirSync(hd)) if (/^\d+\.json$/.test(f)) fs.unlinkSync(path.join(hd, f));
  for (let i = 0; i < n; i++) {
    fs.writeFileSync(path.join(hd, `${baseTs + i * 1000}.json`),
      JSON.stringify(proj(id, sec('sec_' + i, 'S' + i))));
  }
  try { fs.unlinkSync(path.join(hd, 'index.json')); } catch (_) {}
}

test('D1 ★저장 경로가 보관정책을 «실제로» 돌린다 — 프룬이 0회 돌아도 아무도 몰랐다', async () => {
  const id = await mkProject(sec('sec_a', 'A'));
  // 최근 N(20) + 하루 1개를 «넘기는» 양을 하루 안에 심는다 → 프룬이 돌면 반드시 줄어든다.
  const base = Date.now() - 40 * 60 * 1000;
  seedOldSlots(id, 40, base);
  const before = fs.readdirSync(histDir(id)).filter(f => /^\d+\.json$/.test(f)).length;
  assert.ok(before >= 40, `전제 실패 before=${before}`);

  assert.equal((await H.invoke('projects:save', proj(id, sec('sec_b', 'B')))).ok, true);

  const after = fs.readdirSync(histDir(id)).filter(f => /^\d+\.json$/.test(f)).length;
  assert.ok(after < before,
    `★저장 후에도 슬롯이 안 줄었다(${before}→${after}) — 보관정책이 «호출되지 않는다». `
    + '상한이 없으면 이 기능은 디스크를 먹기만 한다');
  assert.ok(after <= 41, `★상한을 못 지켰다 after=${after}`);
});

test('D2 ★종료(save-sync) 경로도 스냅샷을 남기고 프룬을 돌린다 — 현빈 Q4 확정 기능', async () => {
  const id = await mkProject(sec('sec_a', 'A'));
  const base = Date.now() - 40 * 60 * 1000;
  seedOldSlots(id, 40, base);
  const before = fs.readdirSync(histDir(id)).filter(f => /^\d+\.json$/.test(f));
  const maxBefore = Math.max(...before.map(f => parseInt(f)));

  // save-sync 는 ipcMain.on(동기) — 하네스의 invoke 는 handle 만 본다. 동기 채널로 부른다.
  const ev = { returnValue: null };
  H.invokeSync('projects:save-sync', ev, proj(id, sec('sec_close', '닫기 직전 작업')));
  assert.deepEqual(ev.returnValue, { ok: true }, '전제: 종료 저장 자체는 성공해야 한다');

  const after = fs.readdirSync(histDir(id)).filter(f => /^\d+\.json$/.test(f));
  const maxAfter = Math.max(...after.map(f => parseInt(f)));
  assert.ok(maxAfter > maxBefore,
    '★새로고침·탭닫기 순간에 버전이 «안» 남는다 — 사고가 제일 잦은 순간인데 슬롯이 0개다(Q4 위반)');
  const added = JSON.parse(fs.readFileSync(path.join(histDir(id), `${maxAfter}.json`), 'utf8'));
  assert.match(added.pages[0].canvas, /sec_close/, '★남긴 건 «닫기 직전 상태»여야 한다');
  assert.ok(after.length < before.length + 1,
    `★종료 경로에서 프룬이 안 돈다(${before.length}→${after.length})`);
});

test('D3 ★예산 드롭도 «최신»은 건너뛴다 — 방금 만든 것을 몇 마이크로초 뒤 지우지 않는다', async () => {
  const id = await mkProject(sec('sec_a', 'A'));
  const SS = require('../../main/project-store/snapshot-store');
  /* ⚠️첫 판은 슬롯 6개를 같은 크기로 놓았는데, 그러면 «드롭 순서»(dense→sparse, 오래된 순)가
   *   우연히 최신을 마지막에 두고 그 전에 예산을 맞춰 루프가 끝난다 — 즉 «가드가 아니라 순서»가
   *   최신을 지켜서, 가드를 지워도 초록이었다(최종 스윕에서 유일하게 살아남은 변이).
   *   ⇒ 가드 말고는 최신을 지킬 방법이 «없는» 배치를 만든다: 최신 «혼자서» 예산을 넘긴다.
   *     그러면 다른 걸 다 버려도 여전히 초과라 루프가 최신까지 온다. */
  seedOldSlots(id, 2, Date.now() - 60 * 60 * 1000);
  const idx = SS.ensureIndex(DIR, id);
  idx.entries.forEach(e => { e.bytes = SS.BUDGET_BYTES + 1; e.canon = 1; e.legacy = 0; e.pinned = false; });
  SS.writeIndex(DIR, id, idx);
  const newest = Math.max(...idx.entries.map(e => e.ts));

  SS.pruneVersions(DIR, id, { now: Date.now() });
  const live = SS.readIndex(DIR, id).entries.map(e => e.ts);
  assert.ok(live.includes(newest),
    '★예산 압박에서 «가장 최신»을 지웠다 — 슬롯이 0개가 되고, 다음 저장의 간격 게이트가 '
    + '옛 슬롯을 보고 통과해 «매 저장마다» 재스냅샷하는 무한루프가 된다([F1])');
  assert.equal(live.length, 1, '양성대조 — 예산 루프는 실제로 돌아서 나머지를 버려야 한다');
});

test('D4 ★diff 페이로드 상한이 «실제로» 선다 — 39MB 를 렌더러로 보내면 앱이 멈춘다', async () => {
  const big = '가'.repeat(5 * 1024 * 1024);   // 5MB × 2(스냅샷+현재) > 8MB 상한
  const id = await mkProject(sec('sec_a', 'A') + big);
  const list = await H.invoke('projects:history-list', { projectId: id });
  const ts = list.entries[0].ts;
  const r = await H.invoke('projects:history-diff-payload', { projectId: id, ts });
  assert.equal(r.ok, false, '★상한 없이 통째로 보냈다');
  assert.equal(r.reason, 'too_large');
  assert.ok(r.bytes > 8 * 1024 * 1024, `bytes=${r.bytes}`);
});

test('D5 ★작은 프로젝트는 그대로 보낸다 — 상한이 diff 를 통째로 끄지 않았다(양성대조)', async () => {
  const id = await mkProject(sec('sec_a', 'A') + sec('sec_b', 'B'));
  const list = await H.invoke('projects:history-list', { projectId: id });
  const r = await H.invoke('projects:history-diff-payload', { projectId: id, ts: list.entries[0].ts });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.ok(r.snapCanvas && r.curCanvas, '★페이로드가 비었다');
});

test('D6 ★되돌리기 안전판에 «신원»이 들어간다 — 없으면 「교체 취소」가 프로젝트를 갤러리에서 지운다', async () => {
  const id = await mkProject(sec('sec_a', 'A'));
  const list = await H.invoke('projects:history-list', { projectId: id });
  const ts = list.entries[0].ts;
  // 렌더러의 serializeProject() 산출물 형태 — id·name·createdAt 이 «없다»(js/io/save-load.js:378)
  const live = { version: 2, currentPageId: 'page_1',
                 pages: [{ id: 'page_1', name: 'Page 1', canvas: sec('sec_live', '살아있는 작업') }],
                 checklistItems: [] };
  const r = await H.invoke('projects:history-restore',
    { projectId: id, ts, openProjectIds: [id], activeProjectId: id, currentData: live });
  assert.equal(r.ok, true, JSON.stringify(r));

  const safety = await H.invoke('projects:history-read', { projectId: id, ts: r.preRestoreTs });
  assert.equal(safety.ok, true, JSON.stringify(safety));
  assert.equal(safety.data.id, id,
    '★안전판에 id 가 없다 — 그걸로 되돌리면 proj.json 에 id 가 없고, 목록이 그 프로젝트를 통째로 뺀다');
  assert.ok(safety.data.name, '★name 도 없으면 목록에 「Untitled」로 뜬다');
});

/* ═══ [QA] «복사본에서도 똑같이 동작해야 한다» ═════════════════════════════
 * 시연·이관·백업복원은 전부 «userData 통째 복사»다. 절대경로·머신 고정 가정이 하나라도 있으면
 * 거기서 깨지는데, 깨지는 자리가 하필 「복구 도구」라 «조용히 틀린 답»이 나온다.
 */

test('Q1 ★프로필을 통째로 복사해도 목록·손실·상세가 같다 — 절대경로 가정 0', async () => {
  const id = await mkProject(sec('sec_hero', '배너') + sec('sec_detail', '상세컷') + sec('sec_foot', '푸터'));
  // 「지금」을 스냅샷과 다르게 만든다 — 손실 1 + 추가 1 이 나오도록
  await H.invoke('projects:save', proj(id, sec('sec_hero', '배너') + sec('sec_foot', '푸터') + sec('sec_new', '새것')));
  const before = await H.invoke('projects:history-list', { projectId: id });
  assert.equal(before.ok, true);

  // ★프로필 복사 — «다른 경로»로 옮긴다. 그리고 mtime 을 «되돌린다»(rsync/아카이브 복원 재현).
  const copy = path.join(require('os').tmpdir(), `goya-copy-${Date.now()}`);
  fs.cpSync(path.dirname(DIR), copy, { recursive: true });
  const copiedProj = path.join(copy, 'projects', id, 'proj.json');
  assert.ok(fs.existsSync(copiedProj), '전제: 복사가 됐다');
  const old = new Date(Date.now() - 7 * 24 * 3600 * 1000);
  fs.utimesSync(copiedProj, old, old);

  // 복사본을 «새 앱 인스턴스»로 연다(하네스는 프로세스당 하나라 스토어를 직접 태운다 —
  // main 의 핸들러가 하는 일이 정확히 이 두 줄이다).
  const SS = require('../../main/project-store/snapshot-store');
  const copiedDir = path.join(copy, 'projects');
  const after = SS.listVersions(copiedDir, id);

  assert.equal(after.ok, true, '★복사본에서 목록이 안 열린다');
  assert.equal(after.entries.length, before.entries.length, '★버전 개수가 다르다');
  assert.deepEqual(after.entries.map(e => e.ts), before.entries.map(e => e.ts), '★버전 시각이 다르다');
  assert.ok(after.current, '★복사본에서 «지금»을 못 읽는다 — 모든 행이 「비교 불가」가 된다');
  assert.deepEqual(after.current.secs.map(s => s.k), before.current.secs.map(s => s.k),
    '★mtime 이 되돌아갔다고 «옛 지문»을 그대로 썼다 — 손실 diff 가 조용히 거짓이 된다');
  assert.deepEqual(after.entries[0].secs, before.entries[0].secs, '★스냅샷 지문이 다르다');
  fs.rmSync(copy, { recursive: true, force: true });
});

test('Q2 ★복사본에서 «되돌리기»까지 된다 — 시연의 마지막 단계가 거기서 깨지면 안 된다', async () => {
  const id = await mkProject(sec('sec_a', '원래 작업'));
  const copy = path.join(require('os').tmpdir(), `goya-copy2-${Date.now()}`);
  fs.cpSync(path.dirname(DIR), copy, { recursive: true });
  const copiedDir = path.join(copy, 'projects');

  const SS = require('../../main/project-store/snapshot-store');
  const list = SS.listVersions(copiedDir, id);
  const ts = list.entries[0].ts;
  const r = SS.prepareRestore(copiedDir, id, ts, {});
  assert.equal(r.ok, true, `★복사본에서 되돌리기 준비가 실패했다: ${JSON.stringify(r)}`);
  assert.ok(r.preRestoreTs, '★안전판이 안 생겼다');
  assert.equal(r.data.id, id, '★복원 데이터에 신원이 없다');
  // 안전판이 «복사본 안»에 생겼는지 — 원본 경로에 쓰면 시연이 실데이터를 건드린다
  assert.ok(fs.existsSync(path.join(copiedDir, id, 'proj_history', `${r.preRestoreTs}.json`)),
    '★안전판이 복사본 밖에 생겼다');
  assert.ok(!fs.existsSync(path.join(DIR, id, 'proj_history', `${r.preRestoreTs}.json`)),
    '★★복사본에서 한 작업이 «원본»에 썼다 — 격리가 깨졌다');
  fs.rmSync(copy, { recursive: true, force: true });
});

test('Q3 ★mtime 이 «뒤로» 간 proj.json 도 다시 읽는다 — 백업 복원이 정확히 그 모양이다', async () => {
  /* ⚠️Q1(단순 복사)만으로는 부족했다 — 복사본의 옛 current 가 «마침 맞는 값»이라
   *   신선도 판정을 «>» 로 되돌려도 초록이었다. 판정이 실제로 갈리는 배치를 만든다:
   *   인덱스의 current 는 새 내용을 가리키는데, 디스크의 proj.json 은 «옛 내용 + 옛 mtime».
   *   (사용자 시나리오: 프로젝트만 백업본으로 되돌려 놓고 버전 기록을 연다.) */
  const id = await mkProject(sec('sec_a', 'A') + sec('sec_b', 'B') + sec('sec_c', 'C'));
  const list0 = await H.invoke('projects:history-list', { projectId: id });
  assert.equal(list0.current.secs.length, 3, '전제: current 가 3섹션으로 잡혀 있다');

  // proj.json 만 «옛 내용»으로 되돌리고 mtime 도 과거로 — 인덱스는 그대로 3섹션을 기억한다
  const projPath = path.join(DIR, id, 'proj.json');
  fs.writeFileSync(projPath, JSON.stringify(proj(id, sec('sec_a', 'A')), null, 2));
  const old = new Date(Date.now() - 30 * 24 * 3600 * 1000);
  fs.utimesSync(projPath, old, old);

  const list1 = await H.invoke('projects:history-list', { projectId: id });
  assert.equal(list1.current.secs.length, 1,
    `★디스크엔 1섹션인데 「지금 섹션 ${list1.current.secs.length}」이라고 답했다 — mtime 이 «뒤로» 갔다고 `
    + '옛 지문을 그대로 썼다. 그러면 실제로 없어진 섹션 2개가 손실 목록에 «안» 뜬다(거짓 안심)');
  assert.deepEqual(list1.current.secs.map(s => s.n), ['A']);
});
