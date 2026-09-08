/* project-trash.test.js — 앱 «휴지통 탭» (2026-09-08 현빈 지시)
 *
 * ★이 검사가 지키는 것: 「지웠는데 되살릴 수 없다」와 「지웠는데 안 지워졌다」 둘 다.
 *   삭제는 되돌릴 수 없는 자원이라, 반쯤 옮겨진 상태가 제일 나쁘다
 *   (목록엔 없는데 휴지통에도 없다 = 사용자에겐 «증발»).
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const T = require('../../main/trash');

const DAY = 24 * 60 * 60 * 1000;

function makeProjectsDir(ids = ['proj_1000'], opts = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gdt-trash-'));
  for (const id of ids) {
    fs.mkdirSync(path.join(dir, id), { recursive: true });
    fs.writeFileSync(path.join(dir, id, 'proj.json'), JSON.stringify({ id, name: `이름-${id}`, pages: [{ id: 'page_1' }] }));
    fs.writeFileSync(path.join(dir, id, 'proj_meta.json'), JSON.stringify({ id }));
    if (opts.legacy) {
      fs.writeFileSync(path.join(dir, `${id}.json`), JSON.stringify({ id }));
      fs.mkdirSync(path.join(dir, `${id}_history`), { recursive: true });
      fs.writeFileSync(path.join(dir, `${id}_history`, 'h1.json'), '{}');
    }
  }
  return dir;
}
/* OS 휴지통 «흉내» — 실제로 지우지 않고 옆으로 옮긴다(검사가 남의 휴지통을 더럽히면 안 된다) */
function fakeTrash(bin) {
  return async (p) => { fs.mkdirSync(bin, { recursive: true });
    fs.renameSync(p, path.join(bin, path.basename(p) + '-' + Date.now())); };
}

test('T1 버리면 «목록 자리»에서 사라지고 휴지통에 남는다', () => {
  const dir = makeProjectsDir();
  const r = T.moveToTrash({ projectsDir: dir, projectId: 'proj_1000' });
  assert.ok(r.ok, JSON.stringify(r));
  assert.ok(!fs.existsSync(path.join(dir, 'proj_1000')), '원래 자리에 폴더가 남았다 — 안 옮겨졌다');
  assert.ok(fs.existsSync(path.join(dir, '.trash', 'proj_1000', 'bundle', 'proj.json')),
    '휴지통에 내용이 없다 — 되살릴 재료가 사라졌다');
  const l = T.listTrash({ projectsDir: dir });
  assert.equal(l.items.length, 1);
  assert.equal(l.items[0].name, '이름-proj_1000', '이름을 안 들고 왔다 — 휴지통에서 «자기 걸» 못 고른다');
});

test('T2 되살리면 «id 그대로» 원래 자리로 — 이게 .gdt 대신 이걸 쓰는 이유다', () => {
  const dir = makeProjectsDir();
  const before = fs.readFileSync(path.join(dir, 'proj_1000', 'proj.json'), 'utf8');
  T.moveToTrash({ projectsDir: dir, projectId: 'proj_1000' });
  const r = T.restoreFromTrash({ projectsDir: dir, projectId: 'proj_1000' });
  assert.ok(r.ok, JSON.stringify(r));
  assert.equal(fs.readFileSync(path.join(dir, 'proj_1000', 'proj.json'), 'utf8'), before, '내용이 달라졌다');
  assert.ok(!fs.existsSync(path.join(dir, '.trash', 'proj_1000.json')), '되살렸는데 휴지통에 그대로 남았다 — 두 벌이 된다');
  assert.equal(T.listTrash({ projectsDir: dir }).items.length, 0);
});

test('T3 ★복원한 프로젝트에 «휴지통 부스러기»가 남으면 안 된다', () => {
  const dir = makeProjectsDir();
  T.moveToTrash({ projectsDir: dir, projectId: 'proj_1000' });
  T.restoreFromTrash({ projectsDir: dir, projectId: 'proj_1000' });
  const files = fs.readdirSync(path.join(dir, 'proj_1000')).sort();
  assert.deepEqual(files, ['proj.json', 'proj_meta.json'],
    `프로젝트 폴더에 없던 파일이 생겼다: ${files.join(',')}`);
});

test('T4 구 flat 잔재도 «같이» 오가야 한다 — 안 그러면 좀비가 되살아난다', () => {
  const dir = makeProjectsDir(['proj_1000'], { legacy: true });
  const r = T.moveToTrash({ projectsDir: dir, projectId: 'proj_1000' });
  assert.ok(r.ok); assert.equal(r.movedLegacy, 2, 'flat 잔재를 안 옮겼다');
  assert.ok(!fs.existsSync(path.join(dir, 'proj_1000.json')), '<id>.json 이 남았다 — 폴백이 이걸로 좀비를 만든다');
  assert.ok(!fs.existsSync(path.join(dir, 'proj_1000_history')), '<id>_history 가 남았다');
  T.restoreFromTrash({ projectsDir: dir, projectId: 'proj_1000' });
  assert.ok(fs.existsSync(path.join(dir, 'proj_1000.json')), '되살렸는데 flat 잔재가 안 돌아왔다');
  assert.ok(fs.existsSync(path.join(dir, 'proj_1000_history', 'h1.json')), '_history 안 내용이 안 돌아왔다');
});

test('T5 ⛔자리가 차 있으면 «덮지 않고» 거절한다', () => {
  const dir = makeProjectsDir();
  T.moveToTrash({ projectsDir: dir, projectId: 'proj_1000' });
  fs.mkdirSync(path.join(dir, 'proj_1000'));                       // 같은 id 로 새 프로젝트가 생긴 상황
  fs.writeFileSync(path.join(dir, 'proj_1000', 'proj.json'), '{"id":"proj_1000","name":"새것"}');
  const r = T.restoreFromTrash({ projectsDir: dir, projectId: 'proj_1000' });
  assert.equal(r.ok, false); assert.equal(r.code, 'id_taken');
  assert.match(JSON.parse(fs.readFileSync(path.join(dir, 'proj_1000', 'proj.json'), 'utf8')).name, /새것/,
    '새 프로젝트를 덮어썼다 — 남의 작업이 사라졌다');
});

test('T6 ⛔같은 id 를 두 번 버려도 앞의 것을 덮지 않는다', () => {
  const dir = makeProjectsDir();
  T.moveToTrash({ projectsDir: dir, projectId: 'proj_1000' });
  fs.mkdirSync(path.join(dir, 'proj_1000'));
  fs.writeFileSync(path.join(dir, 'proj_1000', 'proj.json'), '{"id":"proj_1000","name":"두번째"}');
  const r = T.moveToTrash({ projectsDir: dir, projectId: 'proj_1000' });
  assert.equal(r.ok, false); assert.equal(r.code, 'already_in_trash');
  assert.match(fs.readFileSync(path.join(dir, '.trash', 'proj_1000', 'bundle', 'proj.json'), 'utf8'), /이름-proj_1000/,
    '먼저 버린 것이 덮여 사라졌다');
});

test('T7 남은 날짜를 «같이» 준다 — 안 주면 조용히 사라진 걸로 보인다', () => {
  const dir = makeProjectsDir();
  const now = Date.now();
  T.moveToTrash({ projectsDir: dir, projectId: 'proj_1000', now: now - 25 * DAY });
  const l = T.listTrash({ projectsDir: dir, now });
  assert.equal(l.items[0].daysLeft, 5, `남은 날짜가 틀렸다: ${l.items[0].daysLeft}`);
  assert.equal(l.items[0].expired, false);
});

test('T8 30일 지나면 만료로 «표시»되고, 쓸어내기가 그것만 가져간다', async () => {
  const dir = makeProjectsDir(['proj_1000', 'proj_2000']);
  const now = Date.now();
  T.moveToTrash({ projectsDir: dir, projectId: 'proj_1000', now: now - 31 * DAY });  // 만료
  T.moveToTrash({ projectsDir: dir, projectId: 'proj_2000', now: now - 2 * DAY });   // 아직
  const bin = path.join(dir, '__osbin');
  const r = await T.sweepTrash({ projectsDir: dir, trashItem: fakeTrash(bin), now });
  assert.deepEqual(r.swept, ['proj_1000'], `쓸어낸 것이 틀렸다: ${JSON.stringify(r)}`);
  const left = T.listTrash({ projectsDir: dir, now }).items.map(i => i.projectId);
  assert.deepEqual(left, ['proj_2000'], '안 지난 것까지 가져갔다 — 되돌릴 수 없는 사고다');
});

test('T9 ★쓸어내기는 «영구삭제»가 아니라 OS 휴지통으로 넘긴다 — 마지막 그물', async () => {
  const dir = makeProjectsDir();
  const now = Date.now();
  T.moveToTrash({ projectsDir: dir, projectId: 'proj_1000', now: now - 40 * DAY });
  const bin = path.join(dir, '__osbin');
  await T.sweepTrash({ projectsDir: dir, trashItem: fakeTrash(bin), now });
  const moved = fs.readdirSync(bin);
  assert.equal(moved.length, 1, 'OS 휴지통으로 안 넘어갔다 — 우리가 마지막 그물을 끊었다');
  assert.ok(fs.existsSync(path.join(bin, moved[0], 'bundle', 'proj.json')), '내용이 사라졌다');
});

test('T10 ★OS 휴지통이 «효과 없이» 성공해도 메타를 안 지운다 — 유령 방지', async () => {
  const dir = makeProjectsDir();
  T.moveToTrash({ projectsDir: dir, projectId: 'proj_1000' });
  const r = await T.purgeFromTrash({ projectsDir: dir, projectId: 'proj_1000',
                                     trashItem: async () => {} });   // «거짓 성공»
  assert.equal(r.ok, false); assert.equal(r.code, 'trash_noeffect');
  assert.equal(T.listTrash({ projectsDir: dir }).items.length, 1,
    '목록에서 사라졌는데 디스크엔 남았다 — 사용자가 못 찾는 «유령»이다');
});

test('T11 없는 프로젝트를 버리면 «못 찾았다»고 말한다 (조용히 성공 금지)', () => {
  const dir = makeProjectsDir();
  const r = T.moveToTrash({ projectsDir: dir, projectId: 'proj_9999' });
  assert.equal(r.ok, false); assert.equal(r.code, 'not_found');
});

test('T12 ⛔경로 탈출을 막는다', () => {
  const dir = makeProjectsDir();
  for (const bad of ['../etc', 'proj_../x', '', 'notproj']) {
    const r = T.moveToTrash({ projectsDir: dir, projectId: bad });
    assert.equal(r.ok, false, `${bad} 를 통과시켰다`);
    assert.equal(r.code, 'invalid_id');
  }
});

test('T13 ★반쯤 옮기다 실패하면 «원래대로» 되돌린다 — 증발 방지', () => {
  const dir = makeProjectsDir(['proj_1000'], { legacy: true });
  const realRename = fs.renameSync;
  let n = 0;
  fs.renameSync = (a, b) => { if (++n === 2) throw new Error('디스크 가득'); return realRename(a, b); };
  try {
    const r = T.moveToTrash({ projectsDir: dir, projectId: 'proj_1000' });
    assert.equal(r.ok, false);
    assert.ok(fs.existsSync(path.join(dir, 'proj_1000', 'proj.json')), '★프로젝트가 증발했다 — 최악의 상태');
    assert.equal(T.listTrash({ projectsDir: dir }).items.length, 0, '휴지통에 반쪽이 남았다');
  } finally { fs.renameSync = realRename; }
});

test('T15 ★옮기는 «순서» — 잔재 먼저, 번들 나중 (좀비 부활 봉쇄)', () => {
  /* 롤백이 있어도 «순서»는 지켜야 한다 — 롤백도 실패할 수 있다(rollbackStuck).
     번들을 먼저 옮기고 잔재에서 실패하면 「본체는 휴지통, 옛 잔재는 제자리」가 되고
     목록의 낡은 카드가 그 잔재로 «옛 내용»을 되살린다. */
  const dir = makeProjectsDir(['proj_1000'], { legacy: true });
  const order = [];
  const realRename = fs.renameSync;
  fs.renameSync = (a, b) => { order.push(path.basename(b)); return realRename(a, b); };
  try { T.moveToTrash({ projectsDir: dir, projectId: 'proj_1000' }); }
  finally { fs.renameSync = realRename; }
  assert.equal(order[order.length - 1], 'bundle',
    `★번들이 «마지막»이 아니다: ${order.join(' → ')}`);
});

test('T16 ⛔롤백이 «실패한» 파일을 그 자리에서 영구히 지우지 않는다 (지디 지적 F1)', () => {
  /* ★이 파일 머리글의 약속: 「여기서 «영구 삭제»를 하지 않는다 — 마지막 그물을 우리가 끊으면
       되돌릴 길이 없어진다」. 그런데 실패 경로가 `rmSync(dst, recursive, force)` 를 «조건 없이» 돌았다.
     롤백이 일부 실패하면 그 파일들은 아직 dst 안에 있는데, 바로 다음 줄이 그걸 지운다.
     ⇒ 반환값은 「사람이 봐야 한다」인데 «사람이 볼 때는 이미 없다».
     ★순서 결정(잔재 먼저·번들 나중)의 근거가 「롤백도 실패할 수 있다」였다 —
       그 전제를 세워놓고 정작 그 경우에 데이터를 지우면 안 된다. */
  const dir = makeProjectsDir(['proj_1000'], { legacy: true });
  /* ⚠️자극을 정확히 겨눈다 — 첫 판은 «앞으로 가는 이동»까지 같이 막아서 롤백이 아예 안 돌았다.
       ⇒ 「전제: 되돌리기가 실제로 실패했나」가 빨개져서 «못 잰 것»을 알았다. 판정 전에 주입부터 확인한다. */
  const realRename = fs.renameSync;
  let n = 0, forwardDone = false;
  fs.renameSync = (a, b) => {
    n++;
    if (n === 2) { forwardDone = true; throw new Error('디스크 가득'); }   // 앞으로 옮기다 실패
    if (forwardDone) throw new Error('EPERM');                            // ★그 «뒤»의 되돌리기는 전부 실패
    return realRename(a, b);
  };
  let r;
  try { r = T.moveToTrash({ projectsDir: dir, projectId: 'proj_1000' }); }
  finally { fs.renameSync = realRename; }

  assert.equal(r.ok, false);
  assert.ok(r.rollbackStuck && r.rollbackStuck.length, '전제: 되돌리기가 «실제로» 실패해야 이 검사가 뜻이 있다');
  /* ★핵심 — 못 되돌린 파일이 «살아 있어야» 한다. 어디 있든(원자리든 휴지통이든) 디스크에 있어야 한다. */
  const stuckPath = r.rollbackStuck[0].path;
  assert.ok(fs.existsSync(stuckPath) || fs.existsSync(path.join(dir, 'proj_1000.json')),
    `★되돌리지 못한 파일을 그 자리에서 «영구히» 지웠다 — 사람이 볼 때는 이미 없다: ${stuckPath}`);
  /* ★«살아 있다»만으로는 부족하다 — 어디에 남았는지 «말해야» 사람이 찾는다.
     조용히 남기면 사용자는 「그냥 실패했다」로 읽고 그 파일들을 영영 모른다. */
  assert.ok(r.leftInTrash && Array.isArray(r.leftInTrash.entries) && r.leftInTrash.entries.length,
    `★남겨는 뒀는데 «어디에 무엇이» 남았는지 말하지 않는다: ${JSON.stringify(r)}`);
  assert.match(String(r.hint), /지우지 않고/, '★hint 가 아직 「되돌렸다」고 말한다 — 사실과 다르다');
});

test('T17 ⛔되살릴 때도 «메타에 없는» 파일을 조용히 지우지 않는다 (지디 지적 F2)', () => {
  /* 가능성은 F1 보다 낮다(메타는 이동 «뒤»에 쓰이니 보통 일치한다).
     ⛔「가능성이 낮다」로 적지 «없다»로 적지 않는다 — 낮은 확률로 데이터가 사라지는 건 여전히 사고다. */
  const dir = makeProjectsDir();
  T.moveToTrash({ projectsDir: dir, projectId: 'proj_1000' });
  // 메타가 모르는 파일이 휴지통 항목 안에 있다(손으로 넣었든, 옛 판이 남겼든)
  const stray = path.join(dir, '.trash', 'proj_1000', '손으로-넣은-것.txt');
  fs.writeFileSync(stray, '중요');
  const r = T.restoreFromTrash({ projectsDir: dir, projectId: 'proj_1000' });
  assert.equal(r.ok, true);
  assert.ok(fs.existsSync(stray), '★메타에 없는 파일을 지웠다 — 우리가 모르는 것을 지울 자격은 없다');
  // ★남겼으면 «말해야» 한다 — 안 말하면 사용자는 그 파일이 있는 줄도 모른다
  assert.ok(r.leftBehind && r.leftBehind.length,
    `★남겨는 뒀는데 말하지 않는다: ${JSON.stringify(r)}`);
});

test('T14 깨진 메타 하나가 목록 «전체»를 죽이지 않는다', () => {
  const dir = makeProjectsDir(['proj_1000', 'proj_2000']);
  T.moveToTrash({ projectsDir: dir, projectId: 'proj_1000' });
  T.moveToTrash({ projectsDir: dir, projectId: 'proj_2000' });
  fs.writeFileSync(path.join(dir, '.trash', 'proj_1000.json'), '{깨짐');
  const l = T.listTrash({ projectsDir: dir });
  assert.equal(l.items.length, 1, '멀쩡한 것까지 안 보인다');
  assert.equal(l.items[0].projectId, 'proj_2000');
});
