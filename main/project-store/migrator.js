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

/* ★T-065 — 「건너뜀」을 적는 «유일한» 자리.
   ⛔삼키지 않는다: 부르는 쪽이 돌려받는 배열과 migration-log.json 둘 다에 남는다.
     삼킨 오류는 「위 판정 거짓말」이 되어 실패보다 나쁘다. */
function _note(skipped, target, e, kind) {
  const rec = {
    path: target,
    kind: kind || 'copy',
    code: (e && e.code) || null,
    message: (e && e.message) || String(e),
  };
  if (Array.isArray(skipped)) skipped.push(rec);
  return rec;
}

// 안전한 statSync (없으면 null).
function _safeStat(p) {
  try { return fs.statSync(p); } catch (_) { return null; }
}

/* 디렉터리 재귀 복사 (덮어쓰기 허용 — 마이그레이션 partial cleanup 후 재실행 케이스 위해).
   ★T-065 — 목록을 한 번 읽어 두고(readdir) 그 이름으로 다시 연다(copyFile). 그 틈에
     항목이 없어지면(다른 프로그램·클라우드 동기화) 옛 판은 ENOENT 를 위로 던졌고,
     그러면 «history 파일 한 개» 때문에 그 프로젝트 전체가 failed 로 주저앉았다(실측).
   ⇒ 항목 단위로 감싸 «그 항목만» 버린다. ⛔조용히는 아니다 — skipped 에 한 줄씩 적는다.
   ★그래도 느슨해지지 않는 근거: 여기서 버린 것은 _verifyDirCopy 가 다시 잡는다.
     「지금도 src 에 남아 있는데 dst 에 없는 것」이 하나라도 있으면 검증이 깨진다.
     사라진 항목은 src 에도 없으니 자연히 빠지고, EACCES 처럼 «있는데 못 읽은» 것은 걸린다. */
async function _copyDirRecursive(src, dst, skipped) {
  await fsp.mkdir(dst, { recursive: true });
  let entries;
  try {
    entries = await fsp.readdir(src, { withFileTypes: true });
  } catch (e) {
    _note(skipped, src, e);   // ★폴더가 통째로 사라진 구간
    return;
  }
  for (const ent of entries) {
    const s = path.join(src, ent.name);
    const d = path.join(dst, ent.name);
    try {
      if (ent.isDirectory()) {
        await _copyDirRecursive(s, d, skipped);
      } else if (ent.isFile()) {
        await fsp.copyFile(s, d);
      }
      // symlink/소켓 등은 무시 (Goditor 데이터에는 없음).
    } catch (e) {
      _note(skipped, s, e);   // ★항목 하나가 사라져도 «그 항목만» 버린다
    }
  }
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

/* 디렉터리 복사 검증 (직속 entries, 재귀 X — 옛 판과 같은 깊이).
   ★T-065 로 «개수 비교»를 버렸다. 개수는 양쪽으로 다 틀린다:
     ⑴ 복사 «전»에 사라지면 src 도 dst 도 없어 개수가 맞는다 — 통과해야 맞는데 옛 판은 맞았다.
     ⑵ 복사 «뒤»에 사라지면 src=n-1, dst=n 이라 개수가 어긋난다 — 멀쩡히 옮겨 놓고 실패로 샜다.
   ⇒ 세지 말고 «묻는다»: 지금도 src 에 있는 것이 dst 에 다 있나.
     사라진 것은 src 에서도 빠져 자연히 면제되고(그건 skipped 에 이미 적혀 있다),
     EACCES 처럼 «있는데 못 옮긴» 것은 여기서 반드시 걸린다. */
function _verifyDirCopy(srcDir, dstDir) {
  const sStat = _safeStat(srcDir);
  if (!sStat || !sStat.isDirectory()) return { ok: false, reason: `source dir missing: ${srcDir}` };
  const dStat = _safeStat(dstDir);
  if (!dStat || !dStat.isDirectory()) return { ok: false, reason: `dest dir missing: ${dstDir}` };
  let names;
  try { names = fs.readdirSync(srcDir); }
  catch (e) { return { ok: false, reason: `source dir unreadable: ${srcDir}: ${e.message}` }; }
  const missing = names.filter(n => !fs.existsSync(path.join(dstDir, n)));
  if (missing.length) return { ok: false, reason: `missing in dest (${missing.length}): ${missing.join(', ')} under ${dstDir}` };
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

/* flat 5개를 quarantine으로 이동. flatHistory는 디렉터리.
   ★T-065 — 여기도 「있나 묻고(existsSync) 그 이름으로 다시 연다(rename)」 구조라
     그 틈에 사라지면 옛 판은 throw 했고, 부르는 쪽 catch 가 _cleanupPartialNew 로
     ★검증까지 끝난 신 위치 사본을 지웠다. flat 은 이미 quarantine 으로 옮겨진 뒤라
     그 프로젝트는 앱에서 «통째로 사라졌다»(실측 V-d: newProj=false, flatProj=false).
   ⇒ 오류 «종류»를 세지 않고 성질로 판정한다 — 실패한 뒤 src 가 지금도 있으면
     「진짜 이동 실패」라 그대로 던지고, 없으면 「옮길 것이 없어진 것」이라 목적은
     이미 달성됐으므로 기록만 하고 넘어간다. ⛔조용히 아님: vanished 로 돌려준다.
*/
function _quarantineFlat(paths, quarantineDir, skipped) {
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
        // ★그새 사라졌나? — 지금도 있으면 진짜 이동 실패, 없으면 옮길 것이 없어진 것.
        if (!fs.existsSync(src)) {
          _note(skipped, src, e2, 'quarantine-vanished');
          continue;
        }
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
  const skipped = [];          // ★T-065 — 그새 사라져 건너뛴 항목들. 조용히 버리지 않는다.
  let quarantineStarted = false;
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
    if (copiedHistory) await _copyDirRecursive(paths.flatHistory, paths.newHistory, skipped);

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
    /* ⛔이 줄부터는 flat 이 «옛 자리에서 없어지기 시작»한다 ⇒ 신 위치가 유일한 사본이 된다.
       아래 catch 가 _cleanupPartialNew 를 못 하게 막는 표식이다(T-065 V-d). */
    quarantineStarted = true;
    const moved = _quarantineFlat(paths, quarantineDir, skipped);

    // [e] 마커 작성 (atomic)
    _atomicWriteJson(paths.marker, {
      migratedAt: new Date().toISOString(),
      sourceLayout: 'flat',
      schemaVersion: SCHEMA_VERSION,
      quarantinePath: quarantineDir,
      moved,
      skipped,               // ★건너뛴 것은 마커에도 남는다 — 나중에 이 자리와 이을 수 있게.
    });

    for (const rec of skipped) {
      _log(options, 'warn', `건너뜀(${rec.kind}): ${rec.path} — ${rec.code || '(코드없음)'} ${rec.message}`);
    }
    _log(options, 'info', `migrated: ${safeId}`, { quarantineDir, moved, skipped: skipped.length });
    return { status: 'migrated', id: safeId, quarantinePath: quarantineDir, moved, skipped };
  } catch (err) {
    _log(options, 'error', `migrate failed: ${safeId}: ${err.message}`);
    /* ★T-065 — quarantine 이 시작된 «뒤»에는 신 위치를 지우지 않는다.
       flat 이 이미 옮겨졌을 수 있어, 지우면 «유일하게 남은 사본»을 지우는 것이 된다.
       마커를 안 남기므로 다음 기동이 이어서 판정한다(flat 없으면 신 레이아웃 그대로 살아난다). */
    if (quarantineStarted) {
      _log(options, 'error', `quarantine 도중 실패 — 신 위치를 «보존»한다(지우면 유일본 소실): ${safeId}`);
    } else {
      // best-effort: 신 위치 partial cleanup. flat 원본은 그대로 보존.
      try { _cleanupPartialNew(paths); } catch (_) {}
    }
    for (const rec of skipped) {
      _log(options, 'warn', `건너뜀(${rec.kind}): ${rec.path} — ${rec.code || '(코드없음)'} ${rec.message}`);
    }
    return { status: 'failed', id: safeId, reason: err.message, skipped, keptNewLayout: quarantineStarted };
  }
}

async function migrateAll(projectsDir, options = {}) {
  const dryRun = !!options.dryRun;
  const runStartIso = new Date().toISOString().replace(/[:.]/g, '-');
  const logPath = path.resolve(path.join(projectsDir, '..', 'migration-log.json'));

  /* ⛔`skipped` 는 «프로젝트 단위 건너뜀»(이미 마이그레이션됨 등)이라 옛 뜻 그대로 둔다.
     ★T-065 가 더하는 `itemsSkipped` 는 «그새 사라져 버린 파일 단위» 기록이다. 다른 축이다. */
  const result = { migrated: [], skipped: [], failed: [], itemsSkipped: [], logPath };

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
    for (const rec of (one.skipped || [])) result.itemsSkipped.push({ id: one.id, ...rec });
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
      itemsSkipped: result.itemsSkipped,   // ★T-065 — 그새 사라져 건너뛴 파일들
    });
  } else {
    _log(options, 'info', `dry-run summary`, { migrated: result.migrated.length, skipped: result.skipped.length, failed: result.failed.length, itemsSkipped: result.itemsSkipped.length });
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
