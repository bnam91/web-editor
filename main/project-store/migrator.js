'use strict';

/*
 * main/project-store/migrator.js
 *
 * Flat → Nested 프로젝트 레이아웃 마이그레이션 모듈.
 *
 *   구 (flat):
 *     <projectsDir>/proj_<id>.json
 *     <projectsDir>/proj_<id>_backup.json
 *     <projectsDir>/proj_<id>_meta.json
 *     <projectsDir>/proj_<id>_history/   (디렉터리)
 *
 *   신 (nested, MVP 결정):
 *     <projectsDir>/proj_<id>/proj.json
 *     <projectsDir>/proj_<id>/proj_backup.json
 *     <projectsDir>/proj_<id>/proj_meta.json
 *     <projectsDir>/proj_<id>/proj_history/
 *     <projectsDir>/proj_<id>/.migrated.json   (마커)
 *
 * 흐름: copy → verify → quarantine flat.
 * - flat 원본은 검증 통과까지 그대로 둔다. 즉시 삭제하지 않는다.
 * - 검증 통과 시 flat을 <projectsDir>/.quarantine/<ISO-timestamp>/ 아래로 "이동" (영구 보관).
 * - .migrated.json 마커가 있으면 해당 프로젝트는 skip (멱등).
 * - 부분 실패는 그 프로젝트만 failed로 기록하고 다음 프로젝트 진행.
 */

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const crypto = require('crypto');

const SCHEMA_VERSION = 1;
const MARKER_NAME = '.migrated.json';
const QUARANTINE_DIRNAME = '.quarantine';

// ─────────────────────────────────────────────────────────────────────────────
// projectId 검증 (claude-pm/ipc.js의 sanitizeProjectId와 동일 패턴)
// slash / dot-only / empty / null-byte reject.
function sanitizeProjectId(pid) {
  const s = String(pid == null ? '' : pid).trim();
  if (!s) return null;
  if (/^\.+$/.test(s)) return null;
  if (s.includes('/') || s.includes('\\')) return null;
  if (s.includes('\0')) return null;
  return s;
}

// 모든 path.join 결과가 root 안에 머무는지 (path traversal 가드).
function _assertInsideRoot(abs, root) {
  const a = path.resolve(abs);
  const r = path.resolve(root);
  if (a !== r && !a.startsWith(r + path.sep)) {
    throw new Error(`path traversal blocked: ${a} not under ${r}`);
  }
  return a;
}

function _log(options, level, msg, extra) {
  if (options && typeof options.log === 'function') {
    try { options.log(level, msg, extra); } catch (_) { /* ignore */ }
  }
}

// 신/구 경로 묶음 — sanitize된 projectId 전제.
function _pathsForId(projectsDir, safeId) {
  const root = path.resolve(projectsDir);
  const dir = _assertInsideRoot(path.join(root, safeId), root);
  return {
    dir,
    // 신 레이아웃
    newProj: _assertInsideRoot(path.join(dir, 'proj.json'), root),
    newBackup: _assertInsideRoot(path.join(dir, 'proj_backup.json'), root),
    newMeta: _assertInsideRoot(path.join(dir, 'proj_meta.json'), root),
    newHistory: _assertInsideRoot(path.join(dir, 'proj_history'), root),
    marker: _assertInsideRoot(path.join(dir, MARKER_NAME), root),
    // 구 레이아웃 (flat)
    flatProj: _assertInsideRoot(path.join(root, `${safeId}.json`), root),
    flatBackup: _assertInsideRoot(path.join(root, `${safeId}_backup.json`), root),
    flatMeta: _assertInsideRoot(path.join(root, `${safeId}_meta.json`), root),
    flatHistory: _assertInsideRoot(path.join(root, `${safeId}_history`), root),
  };
}

// 안전한 statSync (없으면 null).
function _safeStat(p) {
  try { return fs.statSync(p); } catch (_) { return null; }
}

// 디렉터리 재귀 복사 (덮어쓰기 허용 — 마이그레이션 partial cleanup 후 재실행 케이스 위해).
async function _copyDirRecursive(src, dst) {
  await fsp.mkdir(dst, { recursive: true });
  const entries = await fsp.readdir(src, { withFileTypes: true });
  for (const ent of entries) {
    const s = path.join(src, ent.name);
    const d = path.join(dst, ent.name);
    if (ent.isDirectory()) {
      await _copyDirRecursive(s, d);
    } else if (ent.isFile()) {
      await fsp.copyFile(s, d);
    }
    // symlink/소켓 등은 무시 (Goditor 데이터에는 없음).
  }
}

// 디렉터리의 직속 entries 수 (재귀 X). 크기 비교 대신 quick verify용.
function _countEntries(dir) {
  try { return fs.readdirSync(dir).length; }
  catch (_) { return -1; }
}

// JSON 파일 검증: 존재 + 크기 일치 + JSON 파싱 OK.
function _verifyJsonCopy(srcPath, dstPath) {
  const sStat = _safeStat(srcPath);
  const dStat = _safeStat(dstPath);
  if (!sStat || !sStat.isFile()) return { ok: false, reason: `source missing: ${srcPath}` };
  if (!dStat || !dStat.isFile()) return { ok: false, reason: `dest missing: ${dstPath}` };
  if (sStat.size !== dStat.size) return { ok: false, reason: `size mismatch (${sStat.size} != ${dStat.size}) for ${dstPath}` };
  try {
    JSON.parse(fs.readFileSync(dstPath, 'utf8'));
  } catch (e) {
    return { ok: false, reason: `JSON parse failed on ${dstPath}: ${e.message}` };
  }
  return { ok: true };
}

// 디렉터리 entries 개수 비교 (quick verify).
function _verifyDirCopy(srcDir, dstDir) {
  const sStat = _safeStat(srcDir);
  if (!sStat || !sStat.isDirectory()) return { ok: false, reason: `source dir missing: ${srcDir}` };
  const dStat = _safeStat(dstDir);
  if (!dStat || !dStat.isDirectory()) return { ok: false, reason: `dest dir missing: ${dstDir}` };
  const sc = _countEntries(srcDir);
  const dc = _countEntries(dstDir);
  if (sc < 0 || dc < 0 || sc !== dc) return { ok: false, reason: `entries mismatch (${sc} != ${dc}) for ${dstDir}` };
  return { ok: true };
}

// Atomic write: temp → rename.
function _atomicWriteJson(filePath, obj) {
  const dir = path.dirname(filePath);
  const base = path.basename(filePath);
  const tmp = path.join(dir, `.${base}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`);
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2), 'utf8');
  fs.renameSync(tmp, filePath);
}

// 신 위치의 잔재 파일들만 best-effort cleanup (디렉터리 자체나 형제 폴더는 건드리지 않음).
function _cleanupPartialNew(paths) {
  for (const p of [paths.newProj, paths.newBackup, paths.newMeta]) {
    try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch (_) {}
  }
  try {
    if (fs.existsSync(paths.newHistory) && _safeStat(paths.newHistory)?.isDirectory()) {
      fs.rmSync(paths.newHistory, { recursive: true, force: true });
    }
  } catch (_) {}
  try { if (fs.existsSync(paths.marker)) fs.unlinkSync(paths.marker); } catch (_) {}
}

// migration-log.json append (없으면 새로 작성). 기존 로그 배열 보존.
function _appendLog(logPath, entry) {
  let arr = [];
  try {
    if (fs.existsSync(logPath)) {
      const raw = fs.readFileSync(logPath, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) arr = parsed;
    }
  } catch (_) { arr = []; }
  arr.push(entry);
  try { _atomicWriteJson(logPath, arr); } catch (_) { /* best-effort */ }
}

// flat 5개를 quarantine으로 이동. flatHistory는 디렉터리.
function _quarantineFlat(paths, quarantineDir) {
  const moved = [];
  fs.mkdirSync(quarantineDir, { recursive: true });
  const map = [
    [paths.flatProj, path.join(quarantineDir, path.basename(paths.flatProj))],
    [paths.flatBackup, path.join(quarantineDir, path.basename(paths.flatBackup))],
    [paths.flatMeta, path.join(quarantineDir, path.basename(paths.flatMeta))],
    [paths.flatHistory, path.join(quarantineDir, path.basename(paths.flatHistory))],
  ];
  for (const [src, dst] of map) {
    if (!fs.existsSync(src)) continue;
    try {
      fs.renameSync(src, dst);
      moved.push(path.basename(src));
    } catch (e) {
      // 같은 볼륨 아닐 때 fallback: copy + unlink.
      try {
        const st = fs.statSync(src);
        if (st.isDirectory()) {
          fs.cpSync(src, dst, { recursive: true });
          fs.rmSync(src, { recursive: true, force: true });
        } else {
          fs.copyFileSync(src, dst);
          fs.unlinkSync(src);
        }
        moved.push(path.basename(src));
      } catch (e2) {
        throw new Error(`quarantine move failed for ${src}: ${e2.message}`);
      }
    }
  }
  return moved;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API

function resolveProjectJsonPath(projectsDir, projectId) {
  const safe = sanitizeProjectId(projectId);
  if (!safe) return null;
  const p = _pathsForId(projectsDir, safe);
  if (fs.existsSync(p.newProj)) return p.newProj;
  if (fs.existsSync(p.flatProj)) return p.flatProj;
  return null;
}

function resolveMetaJsonPath(projectsDir, projectId) {
  const safe = sanitizeProjectId(projectId);
  if (!safe) return null;
  const p = _pathsForId(projectsDir, safe);
  if (fs.existsSync(p.newMeta)) return p.newMeta;
  if (fs.existsSync(p.flatMeta)) return p.flatMeta;
  return null;
}

function resolveBackupJsonPath(projectsDir, projectId) {
  const safe = sanitizeProjectId(projectId);
  if (!safe) return null;
  const p = _pathsForId(projectsDir, safe);
  if (fs.existsSync(p.newBackup)) return p.newBackup;
  if (fs.existsSync(p.flatBackup)) return p.flatBackup;
  return null;
}

function ensureNewLayoutPaths(projectsDir, projectId) {
  const safe = sanitizeProjectId(projectId);
  if (!safe) throw new Error(`invalid projectId: ${projectId}`);
  const p = _pathsForId(projectsDir, safe);
  fs.mkdirSync(p.dir, { recursive: true });
  return {
    proj: p.newProj,
    backup: p.newBackup,
    meta: p.newMeta,
    history: p.newHistory,
  };
}

// PROJECTS_DIR 스캔 → 마이그레이션 후보 projectId 모음.
// 두 종류를 합집합으로:
//   (a) flat `<id>.json` 파일 — 진짜 마이그레이션 대상
//   (b) 이미 마이그레이션된 디렉터리 `<id>/.migrated.json` — 멱등 확인용 skip 보고
// `<id>_backup.json` / `<id>_meta.json`은 제외.
// 메인 store JSON이 정상이고 id 필드가 파일명 stem과 일치하는지 검증.
// corrupted/rejected/safety/plan 같은 비표준 파일을 자동 거른다.
function _isValidProjectStore(jsonPath, expectedId) {
  try {
    const txt = fs.readFileSync(jsonPath, 'utf8');
    const obj = JSON.parse(txt);
    if (!obj || typeof obj !== 'object') return false;
    return obj.id === expectedId;
  } catch (_) {
    return false;
  }
}

function _scanCandidateIds(projectsDir) {
  const ids = new Set();
  let entries = [];
  try { entries = fs.readdirSync(projectsDir, { withFileTypes: true }); }
  catch (_) { return []; }
  for (const ent of entries) {
    const name = ent.name;
    if (name.startsWith('.')) continue; // .quarantine, dotfiles 무시
    if (ent.isFile()) {
      if (!name.endsWith('.json')) continue;
      if (name === MARKER_NAME) continue;
      const stem = name.slice(0, -'.json'.length);
      if (stem.endsWith('_backup') || stem.endsWith('_meta')) continue;
      // `^proj` 접두 — plan_*, 기타 별도 시스템 데이터 제외
      if (!stem.startsWith('proj')) continue;
      const safe = sanitizeProjectId(stem);
      if (!safe) continue;
      // 메인 store JSON id 필드 ↔ stem 일치 확인 (corrupted/rejected/safety 자동 거름)
      if (!_isValidProjectStore(path.join(projectsDir, name), safe)) continue;
      ids.add(safe);
    } else if (ent.isDirectory()) {
      if (!name.startsWith('proj')) continue;
      // 이미 마이그레이션된 디렉터리도 후보로 잡아 skipped 보고에 포함.
      const safe = sanitizeProjectId(name);
      if (!safe) continue;
      const marker = path.join(projectsDir, name, MARKER_NAME);
      const newProj = path.join(projectsDir, name, 'proj.json');
      if (fs.existsSync(marker) || fs.existsSync(newProj)) {
        ids.add(safe);
      }
    }
  }
  return Array.from(ids);
}

// 신 위치 마이그레이션 마커가 valid (proj.json 동시 존재)인지.
function _isMigrated(paths) {
  if (!fs.existsSync(paths.marker)) return false;
  if (!fs.existsSync(paths.newProj)) return false; // 마커만 있고 proj.json 결손 → 의심, skip 아닌 재시도
  return true;
}

// 단일 프로젝트 마이그레이션.
async function _migrateOne(projectsDir, safeId, runStartIso, options) {
  const dryRun = !!(options && options.dryRun);
  const paths = _pathsForId(projectsDir, safeId);
  const quarantineDir = path.join(projectsDir, QUARANTINE_DIRNAME, runStartIso);

  // 이미 마이그레이션 완료?
  if (_isMigrated(paths)) {
    _log(options, 'info', `skip (already migrated): ${safeId}`);
    return { status: 'skipped', id: safeId, reason: 'marker present' };
  }

  // 마커만 있고 newProj 결손인 이상 상태 → 마커 invalidate (이후 정상 흐름이 cleanup + 재시도).
  if (fs.existsSync(paths.marker) && !fs.existsSync(paths.newProj)) {
    _log(options, 'warn', `stale marker without proj.json, invalidating: ${safeId}`);
    if (!dryRun) { try { fs.unlinkSync(paths.marker); } catch (_) {} }
  }

  // flat 원본이 없으면 마이그레이션 대상이 아님 (신 레이아웃만 있는 케이스).
  if (!fs.existsSync(paths.flatProj)) {
    _log(options, 'info', `skip (no flat source): ${safeId}`);
    return { status: 'skipped', id: safeId, reason: 'no flat proj.json' };
  }

  // 신 위치 partial(마커 없음, proj.json 일부 결손)이면 cleanup 후 재시도.
  // 단, 디렉터리 자체나 claude-pm/assets/images 같은 형제 폴더는 보존.
  const hasPartialNew = fs.existsSync(paths.newProj)
    || fs.existsSync(paths.newBackup)
    || fs.existsSync(paths.newMeta)
    || fs.existsSync(paths.newHistory);
  if (hasPartialNew) {
    _log(options, 'warn', `partial new layout detected, cleaning before retry: ${safeId}`);
    if (!dryRun) {
      _cleanupPartialNew(paths);
    }
  }

  // dryRun: 실제 작업 없이 plan만 기록.
  if (dryRun) {
    const plan = {
      id: safeId,
      from: {
        proj: paths.flatProj,
        backup: fs.existsSync(paths.flatBackup) ? paths.flatBackup : null,
        meta: fs.existsSync(paths.flatMeta) ? paths.flatMeta : null,
        history: fs.existsSync(paths.flatHistory) ? paths.flatHistory : null,
      },
      to: {
        proj: paths.newProj,
        backup: paths.newBackup,
        meta: paths.newMeta,
        history: paths.newHistory,
      },
      quarantine: quarantineDir,
      marker: paths.marker,
    };
    _log(options, 'info', `dry-run plan: ${safeId}`, plan);
    return { status: 'migrated', id: safeId, dryRun: true, plan };
  }

  try {
    // [a] 디렉터리 보장
    fs.mkdirSync(paths.dir, { recursive: true });

    // [b] copy (flat → 신 위치). 결손된 flat 파일은 skip.
    fs.copyFileSync(paths.flatProj, paths.newProj);

    const copiedBackup = fs.existsSync(paths.flatBackup);
    if (copiedBackup) fs.copyFileSync(paths.flatBackup, paths.newBackup);

    const copiedMeta = fs.existsSync(paths.flatMeta);
    if (copiedMeta) fs.copyFileSync(paths.flatMeta, paths.newMeta);

    const copiedHistory = fs.existsSync(paths.flatHistory)
      && (_safeStat(paths.flatHistory)?.isDirectory() ?? false);
    if (copiedHistory) await _copyDirRecursive(paths.flatHistory, paths.newHistory);

    // [c] 검증
    const checks = [_verifyJsonCopy(paths.flatProj, paths.newProj)];
    if (copiedBackup) checks.push(_verifyJsonCopy(paths.flatBackup, paths.newBackup));
    if (copiedMeta) checks.push(_verifyJsonCopy(paths.flatMeta, paths.newMeta));
    if (copiedHistory) checks.push(_verifyDirCopy(paths.flatHistory, paths.newHistory));

    const bad = checks.find(c => !c.ok);
    if (bad) {
      // 신 위치 cleanup, flat 보존.
      _cleanupPartialNew(paths);
      throw new Error(`verify failed: ${bad.reason}`);
    }

    // [d] flat → quarantine 이동
    const moved = _quarantineFlat(paths, quarantineDir);

    // [e] 마커 작성 (atomic)
    _atomicWriteJson(paths.marker, {
      migratedAt: new Date().toISOString(),
      sourceLayout: 'flat',
      schemaVersion: SCHEMA_VERSION,
      quarantinePath: quarantineDir,
      moved,
    });

    _log(options, 'info', `migrated: ${safeId}`, { quarantineDir, moved });
    return { status: 'migrated', id: safeId, quarantinePath: quarantineDir, moved };
  } catch (err) {
    _log(options, 'error', `migrate failed: ${safeId}: ${err.message}`);
    // best-effort: 신 위치 partial cleanup. flat 원본은 그대로 보존.
    try { _cleanupPartialNew(paths); } catch (_) {}
    return { status: 'failed', id: safeId, reason: err.message };
  }
}

async function migrateAll(projectsDir, options = {}) {
  const dryRun = !!options.dryRun;
  const runStartIso = new Date().toISOString().replace(/[:.]/g, '-');
  const logPath = path.resolve(path.join(projectsDir, '..', 'migration-log.json'));

  const result = { migrated: [], skipped: [], failed: [], logPath };

  if (!projectsDir || typeof projectsDir !== 'string') {
    result.failed.push({ id: null, reason: 'projectsDir not provided' });
    return result;
  }
  // PROJECTS_DIR 자체가 없으면 그냥 빈 결과.
  if (!fs.existsSync(projectsDir)) {
    _log(options, 'info', `projectsDir missing, nothing to migrate: ${projectsDir}`);
    return result;
  }

  const ids = _scanCandidateIds(projectsDir);
  _log(options, 'info', `migrateAll start: ${ids.length} candidate(s), dryRun=${dryRun}`);

  for (const id of ids) {
    let one;
    try {
      one = await _migrateOne(projectsDir, id, runStartIso, options);
    } catch (e) {
      one = { status: 'failed', id, reason: e.message };
    }
    if (one.status === 'migrated') result.migrated.push(one.id);
    else if (one.status === 'skipped') result.skipped.push(one.id);
    else result.failed.push({ id: one.id, reason: one.reason });
  }

  // 로그 append (dryRun도 기록 — trace 목적).
  if (!dryRun) {
    _appendLog(logPath, {
      runAt: new Date().toISOString(),
      projectsDir,
      migrated: result.migrated,
      skipped: result.skipped,
      failed: result.failed,
    });
  } else {
    _log(options, 'info', `dry-run summary`, { migrated: result.migrated.length, skipped: result.skipped.length, failed: result.failed.length });
  }

  return result;
}

module.exports = {
  migrateAll,
  resolveProjectJsonPath,
  resolveMetaJsonPath,
  resolveBackupJsonPath,
  ensureNewLayoutPaths,
  // 내부 유틸도 같은 패키지 내 다른 모듈이 재사용할 수 있게 노출.
  _internals: {
    sanitizeProjectId,
    SCHEMA_VERSION,
    MARKER_NAME,
    QUARANTINE_DIRNAME,
  },
};
