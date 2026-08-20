/* ═══════════════════════════════════════════════════════════════════════════
   project-store/externalizer.js — 프로젝트 파일의 인라인 base64 이미지를 «파일 수준»에서
   goya-asset:// 에셋으로 일괄 외부화한다. (DESIGN-asset-batch-externalize.md §3)
   ───────────────────────────────────────────────────────────────────────────
   ★왜 main(파일 수준)인가
     렌더러 경로(optimizeProjectImages)는 DOM을 직렬화해 이미지마다 IPC를 타고, 디스크만 바뀐 채
     DOM엔 base64가 남아 «새로고침이 필수»였다(안 하면 다음 autosave가 되돌린다 — 실측 함정).
     파일을 «렌더러가 받기 전에» 바꾸면 렌더러는 처음부터 goya-asset을 받는다 → 경합 0.

   ★안전 계약 (어느 단계가 실패해도 proj.json은 «바이트 하나» 안 바뀐다)
     읽기 → 고유 URI 수집 → 에셋 저장(content-hash, dedup) → 치환 → 검증 5종 전부 통과 →
     원본 rename(proj_pre-externalize.json, 최초 원본 영구 보존) → atomic write → meta 마커.
     롤링 proj_backup.json은 다음 autosave가 1.5초 뒤 덮어쓰므로 «되돌리기 지점»으로 못 쓴다.

   ★정규식·에셋 규약은 렌더러(js/io/asset-externalize.js)·main(assets:saveCanvasImage)과 «동일»
     해야 한다 — 같은 바이트는 같은 파일명이어야 dedup이 성립한다(sha256 앞 16hex + mime 확장자).
═══════════════════════════════════════════════════════════════════════════ */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// base64 data:image URI만. (비base64 SVG는 경계가 모호·소형이라 제외 — 렌더러와 동일)
const DATA_URI_RE = /data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/]+=*/g;
const GOYA_RE = /goya-asset:\/\/([\w.-]+)\/([\w.-]+)/g;
const BACKUP_NAME = 'proj_pre-externalize.json';
const SCHEMA = 1;

/* ── 공용 소품 ───────────────────────────────────────────────────────────── */
function safeSeg(s) {
  const v = String(s || '').replace(/[^\w.-]/g, '_');
  return (v === '' || /^\.+$/.test(v)) ? '_' : v;
}
function extFromMime(mime) {
  switch (String(mime || '').toLowerCase()) {
    case 'image/jpeg': case 'image/jpg': return 'jpg';
    case 'image/svg+xml': return 'svg';
    case 'image/webp': return 'webp';
    case 'image/gif': return 'gif';
    default: return 'png';
  }
}
function parseDataUri(uri) {
  const comma = uri.indexOf(',');
  if (comma === -1) return null;
  const header = uri.slice(5, comma); // image/png;base64
  const semi = header.indexOf(';');
  return { mime: semi === -1 ? header : header.slice(0, semi), b64: uri.slice(comma + 1) };
}
function pathsFor(projectsDir, projectId) {
  const id = safeSeg(projectId);
  const dir = path.join(projectsDir, id);
  return {
    id, dir,
    proj:   path.join(dir, 'proj.json'),
    backup: path.join(dir, BACKUP_NAME),
    rolling: path.join(dir, 'proj_backup.json'),
    meta:   path.join(dir, 'proj_meta.json'),
    assets: path.join(dir, 'assets'),
  };
}
function atomicWrite(filePath, data) {
  const tmp = filePath + '.tmp';
  fs.writeFileSync(tmp, data);
  try { fs.renameSync(tmp, filePath); }
  catch (e) { try { fs.unlinkSync(tmp); } catch (_) {} throw e; }
}
function readJsonOrNull(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (_) { return null; }
}
/** meta read-merge-write (main `projects:save-meta`와 같은 규율 — 다른 top-level 필드 보존). */
function patchMeta(metaPath, patch) {
  let cur = {};
  try { if (fs.existsSync(metaPath)) cur = JSON.parse(fs.readFileSync(metaPath, 'utf8')) || {}; } catch (_) {}
  const next = { ...cur, ...patch };
  atomicWrite(metaPath, JSON.stringify(next, null, 2));
  return next;
}

/* ── 캔버스 문자열 접근 — v2 pages[].canvas / v1 canvas ──────────────────── */
function canvasSlots(data) {
  const slots = [];
  if (data && Array.isArray(data.pages)) {
    data.pages.forEach((p, i) => { if (p && typeof p.canvas === 'string') slots.push({ get: () => data.pages[i].canvas, set: v => { data.pages[i].canvas = v; } }); });
  } else if (data && typeof data.canvas === 'string') {
    slots.push({ get: () => data.canvas, set: v => { data.canvas = v; } });
  }
  return slots;
}
function countMatches(str, re) {
  if (typeof str !== 'string') return 0;
  re.lastIndex = 0;
  let n = 0;
  while (re.exec(str) !== null) n++;
  return n;
}
function countSections(str) { return typeof str === 'string' ? (str.match(/section-block/g) || []).length : 0; }

/* ── 에셋 저장: content-hash(sha256 16hex) + mime 확장자, 있으면 재사용 ──────── */
/**
 * @returns {{filename:string, url:string, bytes:number, reused:boolean}}
 */
function saveImageBytes(projectsDir, projectId, buf, mime) {
  const p = pathsFor(projectsDir, projectId);
  const hash = crypto.createHash('sha256').update(buf).digest('hex').slice(0, 16);
  const filename = `${hash}.${extFromMime(mime)}`;
  fs.mkdirSync(p.assets, { recursive: true });
  const full = path.join(p.assets, filename);
  let reused = true;
  if (!fs.existsSync(full)) { atomicWrite(full, buf); reused = false; }
  return { filename, url: `goya-asset://${p.id}/${filename}`, bytes: buf.length, reused };
}

/* ── 스캔 — 힌트 토스트·설정 상태·리허설 계측용 ──────────────────────────────
 * base64Refs = «캔버스 안» base64만 센다(변환기의 대상과 같은 정의). assetsTree 썸네일 같은 캔버스 밖
 * 소형 base64(실측 프로젝트당 ~8KB)는 대상이 아니라 세지 않는다 — 안 그러면 변환 완료본이 «인라인 12개»로
 * 보여 사용자를 속인다(리허설 U3에서 실측). 캔버스 밖 수치는 base64RefsAll로 따로 준다.
 * 비용: data:image가 없으면 파싱 없이 0. 있으면 JSON.parse 1회(108MB ≈ 1s, 열 때 1회뿐). */
/**
 * @returns {{exists:boolean, bytes:number, base64Refs:number, base64RefsAll:number, goyaRefs:number, hasBackup:boolean, externalized:object|null}}
 */
function scanProjectFile(projectsDir, projectId) {
  const p = pathsFor(projectsDir, projectId);
  if (!fs.existsSync(p.proj)) return { exists: false, bytes: 0, base64Refs: 0, base64RefsAll: 0, goyaRefs: 0, hasBackup: false, externalized: null };
  const raw = fs.readFileSync(p.proj, 'utf8');
  const meta = readJsonOrNull(p.meta);
  let base64RefsAll = 0, base64Refs = 0;
  if (raw.indexOf('data:image') !== -1) {
    base64RefsAll = countMatches(raw, DATA_URI_RE);
    try {
      const data = JSON.parse(raw);
      for (const s of canvasSlots(data)) base64Refs += countMatches(s.get(), DATA_URI_RE);
    } catch (_) { base64Refs = base64RefsAll; } // 손상이면 보수적으로 전체값
  }
  return {
    exists: true,
    bytes: Buffer.byteLength(raw),
    base64Refs, base64RefsAll,
    goyaRefs: raw.indexOf('goya-asset://') === -1 ? 0 : countMatches(raw, GOYA_RE),
    hasBackup: fs.existsSync(p.backup),
    externalized: (meta && meta.externalized) || null,
  };
}

/* ── 본체 ────────────────────────────────────────────────────────────────── */
/**
 * proj.json의 모든 base64 data:image를 assets/<hash>.<ext>로 빼고 goya-asset:// 로 치환한다.
 * @param {string} projectsDir
 * @param {string} projectId
 * @param {{dryRun?:boolean, afterWrite?:(projectId:string, data:object)=>void, now?:()=>number}} [opts]
 * @returns {{ok:boolean, noop?:boolean, reason?:string, before?:number, after?:number, refs?:number,
 *            images?:number, reused?:number, skipped?:number, sections?:number, backupPath?:string, ms?:number}}
 */
function externalizeProjectFile(projectsDir, projectId, opts = {}) {
  const t0 = Date.now();
  const p = pathsFor(projectsDir, projectId);
  if (!fs.existsSync(p.proj)) return { ok: false, reason: 'no_proj_json' };

  // 1) 읽기·파싱 — 손상이면 손대지 않는다(폴백 체인은 projects:load의 몫)
  let raw;
  try { raw = fs.readFileSync(p.proj, 'utf8'); } catch (e) { return { ok: false, reason: 'read_failed', error: e.message }; }
  const before = Buffer.byteLength(raw);
  let data;
  try { data = JSON.parse(raw); } catch (_) { return { ok: false, reason: 'corrupt_json' }; }
  const slots = canvasSlots(data);
  if (slots.length === 0) return { ok: true, noop: true, reason: 'no_canvas', before, after: before, ms: Date.now() - t0 };

  // 2) 고유 URI 수집 + 검증 기준값
  const uris = new Set();
  let sectionsBefore = 0;
  for (const s of slots) {
    const html = s.get();
    sectionsBefore += countSections(html);
    if (html.indexOf('data:image') === -1) continue;
    DATA_URI_RE.lastIndex = 0;
    let m;
    while ((m = DATA_URI_RE.exec(html)) !== null) uris.add(m[0]);
  }
  if (uris.size === 0) return { ok: true, noop: true, before, after: before, refs: 0, images: 0, sections: sectionsBefore, ms: Date.now() - t0 };
  let refs = 0;
  for (const s of slots) refs += countMatches(s.get(), DATA_URI_RE);
  if (opts.dryRun) return { ok: true, dryRun: true, before, refs, images: uris.size, sections: sectionsBefore, ms: Date.now() - t0 };

  // 3) 에셋 저장 (실패한 URI는 원본 base64 유지 = 데이터 손실 없음)
  const cache = new Map(); // uri → url
  let images = 0, reused = 0, skipped = 0;
  const urls = [];
  for (const uri of uris) {
    const parsed = parseDataUri(uri);
    if (!parsed) { skipped++; continue; }
    try {
      const buf = Buffer.from(parsed.b64, 'base64');
      if (buf.length === 0) { skipped++; continue; }
      const r = saveImageBytes(projectsDir, p.id, buf, parsed.mime);
      cache.set(uri, r.url); urls.push(r);
      images++; if (r.reused) reused++;
    } catch (_) { skipped++; }
  }
  if (cache.size === 0) return { ok: false, reason: 'no_asset_written', before, refs, skipped, ms: Date.now() - t0 };

  // 4) 치환 — 긴 URI부터(부분일치 방지). URI는 고유 토큰이라 split/join이 안전.
  const sorted = [...cache.keys()].sort((a, b) => b.length - a.length);
  for (const s of slots) {
    let html = s.get();
    if (html.indexOf('data:image') === -1) continue;
    for (const uri of sorted) { if (html.indexOf(uri) !== -1) html = html.split(uri).join(cache.get(uri)); }
    s.set(html);
  }

  // 5) 검증 — 전부 통과해야 쓴다
  let sectionsAfter = 0, remaining = 0;
  for (const s of slots) { sectionsAfter += countSections(s.get()); remaining += countMatches(s.get(), DATA_URI_RE); }
  if (sectionsAfter !== sectionsBefore) return { ok: false, reason: `section_count_changed ${sectionsBefore}->${sectionsAfter}`, before };
  // 남은 base64는 «저장 실패분»만이어야 한다(성공한 URI가 남아 있으면 치환 누락)
  for (const uri of cache.keys()) for (const s of slots) if (s.get().indexOf(uri) !== -1) return { ok: false, reason: 'replace_incomplete', before };
  for (const u of urls) {
    const full = path.join(p.assets, u.filename);
    let st = null; try { st = fs.statSync(full); } catch (_) {}
    if (!st || st.size <= 0) return { ok: false, reason: `asset_missing ${u.filename}`, before };
  }
  let out;
  try { out = JSON.stringify(data, null, 2); JSON.parse(out); } catch (e) { return { ok: false, reason: 'reserialize_failed', error: e.message, before }; }
  const after = Buffer.byteLength(out);
  if (after >= before) return { ok: false, reason: 'not_smaller', before, after };

  // 6) 원본 보존 — rename(디스크 0 추가). 이미 백업이 있으면(이례) 덮지 않고 타임스탬프로 회전.
  let backupPath = p.backup;
  try {
    if (fs.existsSync(p.backup)) {
      const rotated = path.join(p.dir, `proj_pre-externalize.${Date.now()}.json`);
      fs.renameSync(p.backup, rotated);
    }
    fs.renameSync(p.proj, p.backup);
  } catch (e) { return { ok: false, reason: 'backup_failed', error: e.message, before }; }

  // 7) atomic write — 실패하면 백업을 제자리로 되돌린다(원본 무손상 계약)
  try { atomicWrite(p.proj, out); }
  catch (e) {
    try { fs.renameSync(p.backup, p.proj); } catch (_) {}
    return { ok: false, reason: 'write_failed', error: e.message, before };
  }

  // 8) meta 마커(+ 호출측 목록캐시 갱신 훅). proj.json 다음에 써서 meta.mtime ≥ proj.mtime 불변식 유지.
  const marker = { schema: SCHEMA, at: new Date().toISOString(), before, after, refs, images, reused, skipped, backup: BACKUP_NAME };
  try { if (typeof opts.afterWrite === 'function') opts.afterWrite(p.id, data); } catch (_) {}
  try { patchMeta(p.meta, { externalized: marker }); } catch (_) { /* 마커 실패는 무해 */ }

  return { ok: true, before, after, refs, images, reused, skipped, sections: sectionsAfter, backupPath, ms: Date.now() - t0 };
}

/**
 * 되돌리기 — proj_pre-externalize.json을 proj.json으로 복원한다.
 * 현재 proj.json은 proj_backup.json(롤링)으로 밀어 «어떤 상태도 버리지 않는다».
 * 복원 후 백업 파일은 «소비»한다(지운다) — 안 지우면 몇 주 뒤 재변환 때 옛 원본이 남아
 * 다음 되돌리기가 몇 주 전 상태로 돌아가는 사고가 난다. 에셋 파일은 남긴다(다른 참조 가능, 해시라 무해).
 * @returns {{ok:boolean, reason?:string, restoredBytes?:number}}
 */
function rollbackExternalize(projectsDir, projectId, opts = {}) {
  const p = pathsFor(projectsDir, projectId);
  if (!fs.existsSync(p.backup)) return { ok: false, reason: 'no_backup' };
  let raw;
  try { raw = fs.readFileSync(p.backup, 'utf8'); JSON.parse(raw); }
  catch (e) { return { ok: false, reason: 'backup_corrupt', error: e.message }; }
  try { if (fs.existsSync(p.proj)) fs.copyFileSync(p.proj, p.rolling); } catch (_) {}
  try { atomicWrite(p.proj, raw); }
  catch (e) { return { ok: false, reason: 'write_failed', error: e.message }; }
  try { fs.unlinkSync(p.backup); } catch (_) {}
  try {
    const data = JSON.parse(raw);
    if (typeof opts.afterWrite === 'function') opts.afterWrite(p.id, data);
  } catch (_) {}
  try {
    const meta = readJsonOrNull(p.meta);
    if (meta && meta.externalized) { const { externalized: _x, ...rest } = meta; atomicWrite(p.meta, JSON.stringify({ ...rest, externalizedRolledBackAt: new Date().toISOString() }, null, 2)); }
  } catch (_) {}
  return { ok: true, restoredBytes: Buffer.byteLength(raw) };
}

module.exports = {
  DATA_URI_RE, GOYA_RE, BACKUP_NAME,
  extFromMime, saveImageBytes, scanProjectFile, externalizeProjectFile, rollbackExternalize,
  _internal: { pathsFor, canvasSlots, countMatches, countSections, parseDataUri },
};
