/* main/folders.js — 프로젝트 «폴더» (2026-09-16, T-A)
 *
 * ★★핵심 원칙: 폴더는 «가상»이다. 디스크에 디렉터리를 만들지 않는다.
 *   proj_<id> 를 실제로 옮기면 main.js 의 경로 리졸버(_resolveProjectJsonPath 등)·
 *   goya-asset:// traversal 가드·main/trash.js·main/gdt 아래·externalizer 가 전부 깨진다.
 *   ⇒ 폴더는 순수 메타데이터 위의 «뷰»다.
 *
 * 배치
 *   <projectsDir>/folders.json           ← 폴더 정의(계정별 위치 — PROJECTS_DIR 을 그대로 받는다)
 *   <projectsDir>/proj_<id>/proj_meta.json 의 folderId 필드 ← 소속 기록
 *
 * ★1단계 제약 — nested(중첩) 폴더는 스키마만 갖고 있고 아직 안 연다.
 *   createFolder 는 항상 parentId:null 로만 만든다(부모를 고를 API 자체가 없다).
 *   나중에 중첩을 열려면 이 파일에 parentId 인자를 받는 경로를 추가하면 된다 — 지금은 없다.
 *
 * ⛔여기서 proj.json(무거운 문서 본체)을 절대 열지 않는다 — 소속 정리는 «메타»에서만 한다.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const FOLDERS_FILE = 'folders.json';

/* GAP-009 와 같은 세척 — 경로 세그먼트(파일명·프로젝트 id) 살균 */
const _safeSeg = (s) => {
  const v = String(s || '').replace(/[^\w.-]/g, '_');
  return (v === '' || /^\.+$/.test(v)) ? '_' : v;
};

const isProjId = (id) => typeof id === 'string' && /^proj_[A-Za-z0-9_-]+$/.test(id);
const isFolderId = (id) => typeof id === 'string' && /^fold_[A-Za-z0-9]+$/.test(id);

function _atomicWrite(filePath, data) {
  const tmp = filePath + '.tmp';
  fs.writeFileSync(tmp, data, 'utf8');
  try { fs.renameSync(tmp, filePath); }
  catch (e) { try { fs.unlinkSync(tmp); } catch (_) {} throw e; }
}

const _foldersPath = (projectsDir) => path.join(projectsDir, FOLDERS_FILE);

/** ⛔파싱 실패 시 «빈 목록»으로 폴백하되 파일은 «안 건드린다» — 손상본을 지우면
 *    폴더 이름을 영영 잃는다. 다음 성공적인 쓰기(create/rename/delete/assign)가 있기 전까진
 *    디스크의 손상본이 그대로 남는다(사람이 복구할 여지를 남긴다). */
function _readFolders(projectsDir) {
  const fp = _foldersPath(projectsDir);
  try {
    if (!fs.existsSync(fp)) return { version: 1, folders: [] };
    const data = JSON.parse(fs.readFileSync(fp, 'utf8'));
    if (!data || !Array.isArray(data.folders)) return { version: 1, folders: [] };
    return data;
  } catch (_) {
    return { version: 1, folders: [] };
  }
}

function _writeFolders(projectsDir, data) {
  _atomicWrite(_foldersPath(projectsDir), JSON.stringify({ version: 1, folders: data.folders }, null, 2));
}

/** proj_<id> 의 meta 경로 — 신 레이아웃 우선, flat 레거시 폴백(main.js _resolveMetaJsonPath 와 같은 dual-resolve).
 *  ★둘 다 없으면(아직 한 번도 저장 안 된 프로젝트는 있을 수 없지만, 방어적으로) 신 레이아웃 자리를 돌려준다. */
function _metaPath(projectsDir, id) {
  const safeId = _safeSeg(id);
  const newP = path.join(projectsDir, safeId, 'proj_meta.json');
  if (fs.existsSync(newP)) return newP;
  const flat = path.join(projectsDir, `${safeId}_meta.json`);
  if (fs.existsSync(flat)) return flat;
  return newP;
}

function listFolders({ projectsDir } = {}) {
  const data = _readFolders(projectsDir);
  return { ok: true, folders: data.folders };
}

function createFolder({ projectsDir, name } = {}) {
  const nm = String(name == null ? '' : name).trim();
  if (!nm) return { ok: false, error: '이름 필수' };
  const data = _readFolders(projectsDir);
  const maxOrder = data.folders.reduce((m, f) => Math.max(m, Number(f.order) || 0), 0);
  const now = new Date().toISOString();
  const folder = {
    id: 'fold_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name: nm,
    parentId: null,   // ★1단계 제약 — 항상 null
    order: maxOrder + 1000,
    createdAt: now, updatedAt: now,
  };
  data.folders.push(folder);
  try { _writeFolders(projectsDir, data); }
  catch (e) { return { ok: false, error: e.message }; }
  return { ok: true, folder };
}

function renameFolder({ projectsDir, id, name } = {}) {
  const nm = String(name == null ? '' : name).trim();
  if (!nm) return { ok: false, error: '이름 필수' };
  const data = _readFolders(projectsDir);
  const f = data.folders.find(x => x.id === id);
  if (!f) return { ok: false, error: 'not_found' };
  f.name = nm;
  f.updatedAt = new Date().toISOString();
  try { _writeFolders(projectsDir, data); }
  catch (e) { return { ok: false, error: e.message }; }
  return { ok: true, folder: f };
}

/** 폴더 삭제 — ★★안전장치 1: proj.json(무거운 문서 본체)을 절대 열지 않는다.
 *    멤버들의 proj_meta.json 에서 folderId 만 read-merge-write 로 지우고(다른 필드 보존),
 *    그 다음 폴더 레코드를 지운다. 안의 프로젝트는 «미분류»로 남을 뿐 지워지지 않는다. */
function deleteFolder({ projectsDir, id } = {}) {
  const data = _readFolders(projectsDir);
  const idx = data.folders.findIndex(f => f.id === id);
  if (idx < 0) return { ok: false, error: 'not_found' };

  let entries = [];
  try { entries = fs.readdirSync(projectsDir, { withFileTypes: true }); } catch (_) { entries = []; }

  let movedOut = 0;
  for (const ent of entries) {
    let metaPath;
    if (ent.isDirectory() && /^proj_[A-Za-z0-9_-]+$/.test(ent.name)) {
      metaPath = path.join(projectsDir, ent.name, 'proj_meta.json');
    } else if (ent.isFile() && /^proj_[A-Za-z0-9_-]+_meta\.json$/.test(ent.name)) {
      metaPath = path.join(projectsDir, ent.name);
    } else {
      continue;
    }
    if (!fs.existsSync(metaPath)) continue;
    let meta;
    try { meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')); } catch (_) { continue; } // 깨진 메타 하나가 전체를 막으면 안 된다
    if (!meta || typeof meta !== 'object' || meta.folderId !== id) continue;
    meta.folderId = null;
    try { _atomicWrite(metaPath, JSON.stringify(meta, null, 2)); movedOut++; } catch (_) { /* 이 파일 하나 실패해도 나머지는 계속 */ }
  }

  data.folders.splice(idx, 1);
  try { _writeFolders(projectsDir, data); }
  catch (e) { return { ok: false, error: e.message }; }
  return { ok: true, movedOut };
}

/** 프로젝트를 폴더로 옮긴다(또는 folderId:null 로 «미분류»로 뺀다).
 *  ★자가치유: 존재하지 않는 folderId 가 들어오면 null(미분류)로 내려앉는다 —
 *    폴더 버그가 프로젝트를 «안 보이게» 만들면 안 된다는 규율 그대로. */
function assignFolder({ projectsDir, projectIds, folderId = null } = {}) {
  if (!Array.isArray(projectIds) || !projectIds.length) return { ok: false, error: 'projectIds 필수' };
  let fid = folderId || null;
  if (fid) {
    const data = _readFolders(projectsDir);
    if (!data.folders.some(f => f.id === fid)) fid = null;
  }
  let moved = 0;
  for (const raw of projectIds) {
    const id = _safeSeg(raw);
    if (!isProjId(id)) continue;
    const mp = _metaPath(projectsDir, id);
    let merged = {};
    try { if (fs.existsSync(mp)) merged = JSON.parse(fs.readFileSync(mp, 'utf8')) || {}; } catch (_) {}
    if (typeof merged !== 'object' || merged === null) merged = {};
    merged.folderId = fid;
    try {
      fs.mkdirSync(path.dirname(mp), { recursive: true });
      _atomicWrite(mp, JSON.stringify(merged, null, 2));
      moved++;
    } catch (_) { /* 이 프로젝트 하나 실패해도 나머지는 계속 */ }
  }
  return { ok: true, moved, folderId: fid };
}

/** 부모 체인을 이름으로 조인한다 — 지금은 항상 자기 이름 하나뿐(1단계는 중첩이 없다).
 *  나중에 parentId 가 실제로 쓰이기 시작하면 이 함수 «안만» 고치면 브레드크럼이 는다. */
function pathOf({ projectsDir, folderId } = {}) {
  if (!folderId) return [];
  const data = _readFolders(projectsDir);
  const byId = new Map(data.folders.map(f => [f.id, f]));
  const chain = [];
  let cur = byId.get(folderId);
  let guard = 0;
  while (cur && guard++ < 16) {
    chain.unshift(cur.name);
    cur = cur.parentId ? byId.get(cur.parentId) : null;
  }
  return chain;
}

module.exports = {
  listFolders, createFolder, renameFolder, deleteFolder, assignFolder, pathOf,
  FOLDERS_FILE, isFolderId, isProjId,
};
