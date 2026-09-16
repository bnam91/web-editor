/* folders-crud.test.js — 프로젝트 «폴더»(T-A) 안전장치 검사.
 *
 * ★이 검사가 지키는 것
 *   ⑴ 폴더 삭제가 프로젝트를 지우지 않는다(멤버는 «미분류»로 보존)
 *   ⑵ 존재하지 않는 folderId 는 자가치유(null=미분류)된다
 *   ⑶ 「전체」 뷰 개념(=folderId 무시)이 성립하도록 목록 IPC 필드가 항상 있다 — 이건 main.js 쪽 검사(list-folderid.test.js)에서
 *   ⑷ meta 의 다른 필드(favorite·collabRef 등)를 read-merge-write 로 보존한다
 *   ⑸ folders.json 파싱 실패는 빈 목록 폴백 + 파일 보존(손상본을 덮지 않는다)
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const F = require('../../main/folders');

function makeProjectsDir(ids = ['proj_1000']) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gdt-folders-'));
  for (const id of ids) {
    fs.mkdirSync(path.join(dir, id), { recursive: true });
    fs.writeFileSync(path.join(dir, id, 'proj.json'), JSON.stringify({ id, name: `이름-${id}` }));
    fs.writeFileSync(path.join(dir, id, 'proj_meta.json'), JSON.stringify({ id, listMetaV: 1 }));
  }
  return dir;
}

test('F1 폴더 생성 — id·order·parentId:null 을 받는다', () => {
  const dir = makeProjectsDir();
  const r = F.createFolder({ projectsDir: dir, name: '여름신상' });
  assert.ok(r.ok, JSON.stringify(r));
  assert.equal(r.folder.name, '여름신상');
  assert.equal(r.folder.parentId, null, '★1단계는 항상 parentId:null 이어야 한다');
  assert.equal(typeof r.folder.order, 'number');
  assert.equal(F.listFolders({ projectsDir: dir }).folders.length, 1);
});

test('F2 이름 없이 생성하면 거절한다', () => {
  const dir = makeProjectsDir();
  const r = F.createFolder({ projectsDir: dir, name: '   ' });
  assert.equal(r.ok, false);
});

test('F3 order 는 1000 단위 gap 으로 는다(나중 «사이에 끼우기» 대비)', () => {
  const dir = makeProjectsDir();
  const a = F.createFolder({ projectsDir: dir, name: 'A' }).folder;
  const b = F.createFolder({ projectsDir: dir, name: 'B' }).folder;
  assert.equal(b.order - a.order, 1000);
});

test('F4 이름변경 — 다른 필드(id·createdAt)는 그대로', () => {
  const dir = makeProjectsDir();
  const f = F.createFolder({ projectsDir: dir, name: '원래' }).folder;
  const r = F.renameFolder({ projectsDir: dir, id: f.id, name: '바뀐이름' });
  assert.ok(r.ok);
  const list = F.listFolders({ projectsDir: dir }).folders;
  assert.equal(list[0].name, '바뀐이름');
  assert.equal(list[0].id, f.id);
  assert.equal(list[0].createdAt, f.createdAt);
});

test('F5 없는 폴더 이름변경/삭제는 not_found', () => {
  const dir = makeProjectsDir();
  assert.equal(F.renameFolder({ projectsDir: dir, id: 'fold_없음', name: 'x' }).ok, false);
  assert.equal(F.deleteFolder({ projectsDir: dir, id: 'fold_없음' }).ok, false);
});

test('F6 ★★폴더 삭제는 proj_ 를 지우지 않는다 — 멤버는 «미분류»로 남는다', () => {
  const dir = makeProjectsDir(['proj_1000', 'proj_2000']);
  const f = F.createFolder({ projectsDir: dir, name: '지울폴더' }).folder;
  F.assignFolder({ projectsDir: dir, projectIds: ['proj_1000', 'proj_2000'], folderId: f.id });

  const r = F.deleteFolder({ projectsDir: dir, id: f.id });
  assert.ok(r.ok, JSON.stringify(r));
  assert.equal(r.movedOut, 2);
  // 프로젝트 폴더 자체는 안 건드려졌다
  assert.ok(fs.existsSync(path.join(dir, 'proj_1000', 'proj.json')));
  assert.ok(fs.existsSync(path.join(dir, 'proj_2000', 'proj.json')));
  // meta 의 folderId 가 지워졌다(미분류)
  const m1 = JSON.parse(fs.readFileSync(path.join(dir, 'proj_1000', 'proj_meta.json'), 'utf8'));
  const m2 = JSON.parse(fs.readFileSync(path.join(dir, 'proj_2000', 'proj_meta.json'), 'utf8'));
  assert.equal(m1.folderId, null);
  assert.equal(m2.folderId, null);
  // 폴더 레코드 자체는 사라졌다
  assert.equal(F.listFolders({ projectsDir: dir }).folders.length, 0);
});

test('F7 폴더 삭제 시 다른 프로젝트(그 폴더 소속이 «아닌»)의 meta 는 손대지 않는다', () => {
  const dir = makeProjectsDir(['proj_1000', 'proj_2000']);
  const f1 = F.createFolder({ projectsDir: dir, name: 'A' }).folder;
  const f2 = F.createFolder({ projectsDir: dir, name: 'B' }).folder;
  F.assignFolder({ projectsDir: dir, projectIds: ['proj_1000'], folderId: f1.id });
  F.assignFolder({ projectsDir: dir, projectIds: ['proj_2000'], folderId: f2.id });

  F.deleteFolder({ projectsDir: dir, id: f1.id });
  const m2 = JSON.parse(fs.readFileSync(path.join(dir, 'proj_2000', 'proj_meta.json'), 'utf8'));
  assert.equal(m2.folderId, f2.id, 'B 소속 프로젝트가 «같이» 미분류로 밀려났다');
});

test('F8 ★소속 배정은 read-merge-write — favorite·collabRef 같은 다른 meta 필드를 지우지 않는다', () => {
  const dir = makeProjectsDir(['proj_1000']);
  fs.writeFileSync(path.join(dir, 'proj_1000', 'proj_meta.json'),
    JSON.stringify({ id: 'proj_1000', favorite: true, collabRef: { collabId: 'c1' }, listMetaV: 1 }));
  const f = F.createFolder({ projectsDir: dir, name: '폴더' }).folder;
  const r = F.assignFolder({ projectsDir: dir, projectIds: ['proj_1000'], folderId: f.id });
  assert.ok(r.ok); assert.equal(r.moved, 1);
  const meta = JSON.parse(fs.readFileSync(path.join(dir, 'proj_1000', 'proj_meta.json'), 'utf8'));
  assert.equal(meta.favorite, true, 'favorite 이 지워졌다');
  assert.equal(meta.collabRef.collabId, 'c1', 'collabRef 가 지워졌다');
  assert.equal(meta.folderId, f.id);
});

test('F9 folderId:null 로 배정하면 «미분류»로 뺀다', () => {
  const dir = makeProjectsDir(['proj_1000']);
  const f = F.createFolder({ projectsDir: dir, name: '폴더' }).folder;
  F.assignFolder({ projectsDir: dir, projectIds: ['proj_1000'], folderId: f.id });
  F.assignFolder({ projectsDir: dir, projectIds: ['proj_1000'], folderId: null });
  const meta = JSON.parse(fs.readFileSync(path.join(dir, 'proj_1000', 'proj_meta.json'), 'utf8'));
  assert.equal(meta.folderId, null);
});

test('F10 ★존재하지 않는 folderId 로 배정하면 자가치유(null=미분류)된다', () => {
  const dir = makeProjectsDir(['proj_1000']);
  const r = F.assignFolder({ projectsDir: dir, projectIds: ['proj_1000'], folderId: 'fold_없는것' });
  assert.ok(r.ok);
  assert.equal(r.folderId, null, '없는 폴더로 밀어넣었는데 그대로 받아줬다');
  const meta = JSON.parse(fs.readFileSync(path.join(dir, 'proj_1000', 'proj_meta.json'), 'utf8'));
  assert.equal(meta.folderId, null);
});

test('F11 ⛔경로 탈출 프로젝트 id 는 건너뛴다(assign)', () => {
  const dir = makeProjectsDir(['proj_1000']);
  const f = F.createFolder({ projectsDir: dir, name: '폴더' }).folder;
  const r = F.assignFolder({ projectsDir: dir, projectIds: ['../etc', 'notproj', 'proj_1000'], folderId: f.id });
  assert.ok(r.ok);
  assert.equal(r.moved, 1, '탈출 시도 id 까지 옮긴 걸로 세었다');
});

test('F12 ⛔folders.json 파싱 실패 시 빈 목록으로 폴백하되 파일을 «덮지 않는다»', () => {
  const dir = makeProjectsDir();
  fs.writeFileSync(path.join(dir, 'folders.json'), '{깨진 JSON');
  const r = F.listFolders({ projectsDir: dir });
  assert.ok(r.ok);
  assert.deepEqual(r.folders, []);
  // 손상본이 그대로 있다(다음 성공적 쓰기 전까지) — 지웠으면 사람이 복구할 여지가 사라진다
  assert.match(fs.readFileSync(path.join(dir, 'folders.json'), 'utf8'), /깨진/);
});

test('F13 pathOf — 1단계는 항상 «자기 이름 하나»뿐(중첩 없음)', () => {
  const dir = makeProjectsDir();
  const f = F.createFolder({ projectsDir: dir, name: '여름' }).folder;
  assert.deepEqual(F.pathOf({ projectsDir: dir, folderId: f.id }), ['여름']);
  assert.deepEqual(F.pathOf({ projectsDir: dir, folderId: null }), []);
  assert.deepEqual(F.pathOf({ projectsDir: dir, folderId: 'fold_없음' }), []);
});

test('F14 깨진 meta 하나가 폴더 삭제 전체를 죽이지 않는다', () => {
  const dir = makeProjectsDir(['proj_1000', 'proj_2000']);
  const f = F.createFolder({ projectsDir: dir, name: '폴더' }).folder;
  F.assignFolder({ projectsDir: dir, projectIds: ['proj_1000', 'proj_2000'], folderId: f.id });
  fs.writeFileSync(path.join(dir, 'proj_1000', 'proj_meta.json'), '{깨짐');
  const r = F.deleteFolder({ projectsDir: dir, id: f.id });
  assert.ok(r.ok);
  assert.equal(r.movedOut, 1, '멀쩡한 것(proj_2000)까지 실패로 세었다');
});

test('F16 ★FOLDERS_FILE 상수 값 — main.js _adoptLegacyIfSoleAccount 가 문자열 리터럴로 들고 있는 값과 «같아야» 한다', () => {
  // main.js 는 이 값을 require 없이(테스트 인젝션 계약 때문에) 'folders.json' 리터럴로 들고 있다.
  // 두 값이 갈라지면 입양(adopt) 때 folders.json 을 못 찾는 조용한 버그가 된다.
  assert.equal(F.FOLDERS_FILE, 'folders.json');
});

test('F15 flat 레거시 meta(<id>_meta.json) 도 assign/delete 가 다룬다', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gdt-folders-flat-'));
  fs.writeFileSync(path.join(dir, 'proj_1000.json'), JSON.stringify({ id: 'proj_1000', name: 'flat' }));
  fs.writeFileSync(path.join(dir, 'proj_1000_meta.json'), JSON.stringify({ id: 'proj_1000' }));
  const f = F.createFolder({ projectsDir: dir, name: '폴더' }).folder;
  const ra = F.assignFolder({ projectsDir: dir, projectIds: ['proj_1000'], folderId: f.id });
  assert.equal(ra.moved, 1);
  const meta1 = JSON.parse(fs.readFileSync(path.join(dir, 'proj_1000_meta.json'), 'utf8'));
  assert.equal(meta1.folderId, f.id);

  const rd = F.deleteFolder({ projectsDir: dir, id: f.id });
  assert.equal(rd.movedOut, 1);
  const meta2 = JSON.parse(fs.readFileSync(path.join(dir, 'proj_1000_meta.json'), 'utf8'));
  assert.equal(meta2.folderId, null);
});
