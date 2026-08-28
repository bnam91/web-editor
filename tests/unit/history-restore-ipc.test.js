/* U6b 하네스 — 「이 버전으로 교체」(파괴 경로). main.js 의 «진짜» IPC 핸들러를 부른다.
 * 실행: node --test "tests/unit/*.test.js"
 *
 * ★이 유닛이 약속한 문장:
 *   「교체해도 «직전 상태»로 돌아올 수 있고, 다른 창의 작업을 조용히 날리지 않는다」
 *
 * ★autosave 경합(설계 §D10)의 핵심은 하나로 줄어든다 —
 *   «열려 있으면 main 이 proj.json 을 쓰지 않는다». 쓰면 1.5초 뒤 autosave 가 옛 DOM 으로 되돌린다.
 *   그건 여기서 «바이트»로 잴 수 있다. 실앱이 필요한 건 그 다음(렌더러가 억제를 실제로 거는가)뿐이다.
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { loadMain } = require('./_ipc-harness');

const H = loadMain();
const DIR = H.projectsDir;
const SS = require('../../main/project-store/snapshot-store');
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

let seq = 0;
const sec = (id, name, inner) =>
  `<div class="section-block" id="${id}" data-name="${name}"><div class="section-inner">${inner || ''}</div></div>`;
const proj = (id, canvas) => ({ id, name: '교체시험', version: 2, currentPageId: 'page_1',
  pages: [{ id: 'page_1', name: 'Page 1', canvas }], checklistItems: [] });
const names = (data) => SS.fingerprint(data).secs.map(s => s.n);
const readProj = (id) => JSON.parse(fs.readFileSync(path.join(DIR, id, 'proj.json'), 'utf8'));

/** v1(섹션 3개) 저장 → 사고(섹션 1개) 저장. 되돌릴 대상 ts 를 준다. */
async function setup() {
  const id = `proj_${1787700000000 + (seq++) * 1000}`;
  await H.invoke('projects:save', proj(id, sec('sec_a', '혜택정리') + sec('sec_b', 'FAQ') + sec('sec_c', '배송안내')));
  const ts = (await H.invoke('projects:history-list', { projectId: id })).entries[0].ts;
  await H.invoke('projects:save', proj(id, sec('sec_a', '혜택정리')));   // 사고
  return { id, ts };
}

/* ═══ ★약속 ══════════════════════════════════════════════════════════════ */

test('RB-PROMISE ★교체해도 «직전 상태»로 돌아올 수 있다 — 왕복으로 잰다', async () => {
  const { id, ts } = await setup();
  assert.deepEqual(names(readProj(id)), ['혜택정리'], '사고 상태에서 시작');

  const r = await H.invoke('projects:history-restore', { projectId: id, ts, openProjectIds: [] });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.applyInRenderer, false, '안 열려 있으면 main 이 직접 쓴다');
  assert.deepEqual(names(readProj(id)), ['혜택정리', 'FAQ', '배송안내'], '★교체가 실제로 됐어야 한다');

  // ★「잘못 골랐다」 — 직전 상태로 다시 돌아온다
  const back = await H.invoke('projects:history-restore', { projectId: id, ts: r.preRestoreTs, openProjectIds: [] });
  assert.equal(back.ok, true);
  assert.deepEqual(names(readProj(id)), ['혜택정리'], '★교체 직전(사고 상태) 그대로 돌아와야 한다');

  // 그리고 그 되돌리기도 또 되돌릴 수 있다
  const again = await H.invoke('projects:history-restore', { projectId: id, ts: back.preRestoreTs, openProjectIds: [] });
  assert.equal(again.ok, true);
  assert.deepEqual(names(readProj(id)), ['혜택정리', 'FAQ', '배송안내']);
});

/* ═══ ★autosave 경합 — 열려 있으면 main 이 «안 쓴다» ═════════════════════ */

test('RB-RACE1 ★열려 있으면 main 이 proj.json 을 «한 바이트도» 안 쓴다', async () => {
  const { id, ts } = await setup();
  const before = fs.readFileSync(path.join(DIR, id, 'proj.json'));

  const r = await H.invoke('projects:history-restore', { projectId: id, ts, openProjectIds: [id] });
  assert.equal(r.ok, true);
  assert.equal(r.applyInRenderer, true, '★렌더러가 적용해야 한다고 답해야 한다');
  assert.ok(before.equals(fs.readFileSync(path.join(DIR, id, 'proj.json'))),
    '★main 이 썼다 — 1.5초 뒤 autosave 가 옛 DOM 으로 되돌려 「되돌린 것을 되돌린다」');
  assert.deepEqual(names(r.data), ['혜택정리', 'FAQ', '배송안내'], '적용할 데이터는 넘겨야 한다');
});

test('RB-RACE2 ★열려 있어도 «안전판»은 박힌다 — 안 박히면 렌더러 적용을 취소할 수 없다', async () => {
  const { id, ts } = await setup();
  const r = await H.invoke('projects:history-restore', { projectId: id, ts, openProjectIds: [id] });
  assert.equal(r.ok, true);
  const saved = SS.readVersion(DIR, id, r.preRestoreTs);
  assert.equal(saved.ok, true, '★안전판이 없으면 렌더러가 적용한 뒤 돌아갈 곳이 없다');
  assert.deepEqual(names(saved.data), ['혜택정리'], '안전판은 «교체 직전» 상태여야 한다');
});

/** ★렌더러의 serializeProject()(js/io/save-load.js:378)가 «실제로» 만드는 모양.
 *  id·name·createdAt·marketRef 가 «없다». 이 한 칸의 차이가 치명 결함 1건을 가렸다 —
 *  픽스처를 진짜 모양으로 두지 않으면 그 결함이 초록 밑에 계속 앉아 있는다. */
const serializeShape = (canvas) => ({
  version: 2, currentPageId: 'page_1',
  pages: [{ id: 'page_1', name: 'Page 1', canvas }],
  checklistItems: [], checklistSections: [], imageGallery: [], assetsTree: [],
});

test('RB-RACE3 ★열려 있으면 «화면의 최신 상태»가 안전판에 담긴다 — 미저장 편집분이 빠지면 못 돌아온다', async () => {
  const { id, ts } = await setup();
  const live = serializeShape(sec('sec_a', '혜택정리') + sec('sec_new', '방금 만든 것'));
  const r = await H.invoke('projects:history-restore', { projectId: id, ts, openProjectIds: [id], currentData: live });
  assert.equal(r.ok, true);
  assert.equal(r.source, 'live');
  assert.ok(names(SS.readVersion(DIR, id, r.preRestoreTs).data).includes('방금 만든 것'),
    '★미저장 편집분이 안전판에서 빠지면 「교체 취소」로도 못 돌아온다');
});

test('RB-RACE4 «안 열려 있다»고 답하면 currentData 를 무시하고 디스크를 뜬다 — 남의 상태를 안전판에 넣지 않는다', async () => {
  const { id, ts } = await setup();
  const bogus = proj(id, sec('sec_x', '엉뚱한 것'));
  const r = await H.invoke('projects:history-restore', { projectId: id, ts, openProjectIds: [], currentData: bogus });
  assert.equal(r.ok, true);
  assert.equal(r.source, 'disk');
  assert.deepEqual(names(SS.readVersion(DIR, id, r.preRestoreTs).data), ['혜택정리']);
});

/* ═══ ★거부 경로 — 조용히 날리지 않는다 ══════════════════════════════════ */

test('RB-REFUSE1 ★openProjectIds 를 안 넘기면 «판별 불가»로 거부한다 — 추측하고 덮지 않는다', async () => {
  const { id, ts } = await setup();
  const before = fs.readFileSync(path.join(DIR, id, 'proj.json'));
  for (const args of [{ projectId: id, ts }, { projectId: id, ts, openProjectIds: null },
                      { projectId: id, ts, openProjectIds: 'x' }]) {
    const r = await H.invoke('projects:history-restore', args);
    assert.equal(r.ok, false, JSON.stringify(args));
    assert.equal(r.reason, 'unknown_open_state');
    assert.ok(r.message && r.message.includes('새 프로젝트'),
      '★거부할 땐 «왜»와 «대신 뭘 하면 되는지»를 말해야 한다 — 이유 없는 거부가 제일 나쁘다');
  }
  assert.ok(before.equals(fs.readFileSync(path.join(DIR, id, 'proj.json'))), '거부했는데 파일이 바뀌었다');
});

test('RB-REFUSE2 ★창이 둘 이상이면 교체를 거부한다 — 다른 창의 편집을 조용히 날릴 수 있다', async () => {
  const { id, ts } = await setup();
  const before = fs.readFileSync(path.join(DIR, id, 'proj.json'));
  const el = require.cache['electron'].exports;
  const orig = el.BrowserWindow.getAllWindows;
  el.BrowserWindow.getAllWindows = () => [{ isDestroyed: () => false }, { isDestroyed: () => false }];
  let r;
  try { r = await H.invoke('projects:history-restore', { projectId: id, ts, openProjectIds: [] }); }
  finally { el.BrowserWindow.getAllWindows = orig; }

  assert.equal(r.ok, false);
  assert.equal(r.reason, 'multiple_windows');
  assert.equal(r.windowCount, 2);
  assert.ok(r.message.includes('새 프로젝트'), '대안을 말해줘야 한다');
  assert.ok(before.equals(fs.readFileSync(path.join(DIR, id, 'proj.json'))));
});

test('RB-REFUSE3 ★거부했으면 «안전판도 안 쌓인다» — 목록이 쓰레기로 차면 안 된다', async () => {
  const { id, ts } = await setup();
  const n0 = SS.readIndex(DIR, id).entries.length;
  await H.invoke('projects:history-restore', { projectId: id, ts });                    // 판별 불가
  const el = require.cache['electron'].exports;
  const orig = el.BrowserWindow.getAllWindows;
  el.BrowserWindow.getAllWindows = () => [{ isDestroyed: () => false }, { isDestroyed: () => false }];
  try { await H.invoke('projects:history-restore', { projectId: id, ts, openProjectIds: [] }); }
  finally { el.BrowserWindow.getAllWindows = orig; }
  assert.equal(SS.readIndex(DIR, id).entries.length, n0, '★거부 경로가 안전판을 쌓았다');
});

/* ═══ ★안전판 없이는 파괴가 시작조차 안 된다 (U6a 계약이 여기서도 서는가) ══ */

test('RB-GATE1 ★안전판 쓰기를 강제 실패시키면 «교체가 일어나지 않는다»', async () => {
  const { id, ts } = await setup();
  const before = fs.readFileSync(path.join(DIR, id, 'proj.json'));
  const orig = fs.writeFileSync;
  let hits = 0;
  fs.writeFileSync = function (f) {
    if (/proj_history[\\/][0-9]+\.json\.tmp$/.test(String(f))) { hits++; const e = new Error('ENOSPC'); e.code = 'ENOSPC'; throw e; }
    return orig.apply(fs, arguments);
  };
  let r;
  try { r = await H.invoke('projects:history-restore', { projectId: id, ts, openProjectIds: [] }); }
  finally { fs.writeFileSync = orig; }

  assert.ok(hits > 0, '★fault 가 실제로 발동해야 이 실험이 성립한다');
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'pre_restore_failed');
  assert.ok(before.equals(fs.readFileSync(path.join(DIR, id, 'proj.json'))),
    '★안전판이 없는데 교체가 진행됐다 — 이 기능이 존재 이유를 잃는 순간이다');
});

test('RB-GATE2 없는 버전으로 교체하려 하면 아무 일도 안 일어난다', async () => {
  const { id } = await setup();
  const before = fs.readFileSync(path.join(DIR, id, 'proj.json'));
  const n0 = SS.readIndex(DIR, id).entries.length;
  const r = await H.invoke('projects:history-restore', { projectId: id, ts: 1, openProjectIds: [] });
  assert.equal(r.ok, false);
  assert.ok(before.equals(fs.readFileSync(path.join(DIR, id, 'proj.json'))));
  assert.equal(SS.readIndex(DIR, id).entries.length, n0);
});

/* ═══ 이미지·목록 ════════════════════════════════════════════════════════ */

test('RB-IMG1 ★교체한 뒤에도 이미지가 «실제로» 있다 — 그림이 비면 조용히 깨진 복구다', async () => {
  const id = `proj_${1787700000000 + (seq++) * 1000}`;
  await H.invoke('projects:save', proj(id, sec('sec_a', 'A', `<img src="${PNG}">`) + sec('sec_b', 'FAQ')));
  const ts = (await H.invoke('projects:history-list', { projectId: id })).entries[0].ts;
  await H.invoke('projects:save', proj(id, sec('sec_a', 'A')));

  const r = await H.invoke('projects:history-restore', { projectId: id, ts, openProjectIds: [] });
  assert.equal(r.ok, true);
  assert.ok(!r.missingAssets, `참조가 비었다: ${JSON.stringify(r.missingAssets)}`);
  const canvas = readProj(id).pages[0].canvas;
  const urls = canvas.match(/goya-asset:\/\/[\w.-]+\/([\w.-]+)/g) || [];
  assert.ok(urls.length > 0);
  for (const u of urls) {
    assert.ok(fs.existsSync(path.join(DIR, id, 'assets', u.split('/').pop())), `★${u} 파일이 없다`);
  }
});

test('RB-LIST1 교체 뒤 목록이 «지금»을 다시 가리킨다 — 다음 판단의 기준점이다', async () => {
  const { id, ts } = await setup();
  const r = await H.invoke('projects:history-restore', { projectId: id, ts, openProjectIds: [] });
  assert.equal(r.ok, true);
  const l = await H.invoke('projects:history-list', { projectId: id });
  assert.equal(l.current.counts.sections, 3, '★교체 뒤 current 가 옛 상태를 가리키면 사용자가 또 헷갈린다');
  const pre = l.entries.find(e => e.ts === r.preRestoreTs);
  assert.equal(pre.reason, 'pre-restore');
  assert.equal(pre.pinned, true, '★안전판이 목록에서 「되돌리기 직전」으로 보여야 찾을 수 있다');
});

/* ═══ ★적대검수가 잡은 치명 2건 — 회귀 봉인 ══════════════════════════════ */

test('RB-C1 ★「교체 취소」 뒤에도 프로젝트가 목록에 «남아 있다» — 사라지면 사용자에겐 삭제로 보인다', async () => {
  const id = `proj_${1787700000000 + (seq++) * 1000}`;
  await H.invoke('projects:save', { ...proj(id, sec('sec_a', '혜택정리') + sec('sec_b', 'FAQ')),
    createdAt: '2026-01-01T00:00:00.000Z', marketRef: { sku: 'A-1' }, type: 'coupang' });
  const ts = (await H.invoke('projects:history-list', { projectId: id })).entries[0].ts;

  // ★렌더러가 «실제로» 보내는 모양(id·name·createdAt·marketRef 없음)으로 교체
  const live = serializeShape(sec('sec_a', '혜택정리'));
  const r1 = await H.invoke('projects:history-restore',
    { projectId: id, ts, openProjectIds: [id], currentData: live });
  assert.equal(r1.ok, true);

  // 「잘못 골랐다」 — 안전판으로 되돌린다(갤러리에서 = 안 열린 상태)
  const r2 = await H.invoke('projects:history-restore',
    { projectId: id, ts: r1.preRestoreTs, openProjectIds: [] });
  assert.equal(r2.ok, true, JSON.stringify(r2));

  const after = readProj(id);
  assert.equal(after.id, id, '★id 가 없으면 _listItemFor 가 목록에서 통째로 뺀다(main.js:850)');
  assert.ok(after.name, '★이름이 사라지면 사용자가 못 찾는다');
  assert.equal(after.createdAt, '2026-01-01T00:00:00.000Z', 'createdAt 보존');
  assert.deepEqual(after.marketRef, { sku: 'A-1' }, 'marketRef 보존');
  assert.equal(after.type, 'coupang', 'type 보존');

  const list = await H.invoke('projects:list');
  assert.ok(list.some(p => p.id === id),
    '★★교체 취소 뒤 프로젝트가 갤러리에서 «사라졌다» — 이 유닛의 약속이 정면으로 깨진 것이다');
});

test('RB-C1b ★안전판 자체가 «온전»해야 한다 — 신원이 빠진 안전판은 되돌아갈 곳이 못 된다', async () => {
  const id = `proj_${1787700000000 + (seq++) * 1000}`;
  await H.invoke('projects:save', { ...proj(id, sec('sec_a', 'A')), createdAt: '2026-02-02T00:00:00.000Z' });
  const ts = (await H.invoke('projects:history-list', { projectId: id })).entries[0].ts;
  const r = await H.invoke('projects:history-restore',
    { projectId: id, ts, openProjectIds: [id], currentData: serializeShape(sec('sec_a', 'A')) });
  assert.equal(r.ok, true);
  const saved = SS.readVersion(DIR, id, r.preRestoreTs).data;
  assert.equal(saved.id, id, '★안전판에 id 가 없으면 그걸로 되돌린 순간 프로젝트가 목록에서 빠진다');
  assert.ok(saved.name);
  assert.equal(saved.createdAt, '2026-02-02T00:00:00.000Z');
});

test('RB-C2 ★되돌릴 대상이 «비어 있으면» 알려준다 — 막지는 않는다(지금이 비어서 복구하러 온 것일 수 있다)', async () => {
  const id = `proj_${1787700000000 + (seq++) * 1000}`;
  await H.invoke('projects:save', proj(id, ''));                                  // 빈 버전
  const emptyTs = (await H.invoke('projects:history-list', { projectId: id })).entries[0].ts;
  await H.invoke('projects:save', proj(id, sec('sec_a', '혜택정리') + sec('sec_b', 'FAQ')));

  const r = await H.invoke('projects:history-restore', { projectId: id, ts: emptyTs, openProjectIds: [] });
  assert.equal(r.ok, true, '막지 않는다 — 사용자가 그걸 원할 수 있다');
  assert.equal(r.targetEmpty, true,
    '★교체가 곧 «지금 내용을 지우는 것»이면 확인창이 그렇게 말할 수 있어야 한다');
  // 그리고 지운 뒤에도 «돌아올 수 있다»
  const back = await H.invoke('projects:history-restore', { projectId: id, ts: r.preRestoreTs, openProjectIds: [] });
  assert.equal(back.ok, true);
  assert.deepEqual(names(readProj(id)), ['혜택정리', 'FAQ'], '★지웠어도 돌아올 수 있어야 한다');
});

test('RB-C2b 지금이 비어 있어도 «복구»는 된다 — 이 기능의 본래 용도를 막으면 안 된다', async () => {
  const id = `proj_${1787700000000 + (seq++) * 1000}`;
  await H.invoke('projects:save', proj(id, sec('sec_a', '혜택정리') + sec('sec_b', 'FAQ')));
  const good = (await H.invoke('projects:history-list', { projectId: id })).entries[0].ts;
  // 사고: 로드 실패 폴백 등으로 화면이 빈 상태
  const r = await H.invoke('projects:history-restore',
    { projectId: id, ts: good, openProjectIds: [id], currentData: serializeShape('') });
  assert.equal(r.ok, true, '★지금이 비었다고 복구를 막으면 이 기능이 존재할 이유가 없다');
  assert.equal(r.currentEmpty, true, '다만 «지금이 비었다»는 알려준다');
  assert.deepEqual(names(r.data), ['혜택정리', 'FAQ']);
});
