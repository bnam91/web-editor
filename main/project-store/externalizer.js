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
const MAX_PRE_EXT_ROTATIONS = 2; // [F3] proj_pre-externalize.<ts>.json 회전본 보관 상한(가장 최근 N개)

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
    preRollback: path.join(dir, 'proj_pre-rollback.json'), // 되돌리기가 버리는 «변환 이후 작업»의 전용 보관처(F2)
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
  const truncated = new Set(); // [F6 절단클래스] 개행으로 잘린 base64(MIME 76자 wrapping 등)
  let sectionsBefore = 0;
  for (const s of slots) {
    const html = s.get();
    sectionsBefore += countSections(html);
    if (html.indexOf('data:image') === -1) continue;
    DATA_URI_RE.lastIndex = 0;
    let m;
    while ((m = DATA_URI_RE.exec(html)) !== null) {
      // strict 정규식은 base64 알파벳만 먹으므로, 중간에 개행/공백이 낀 wrapping된 data URI는 «앞부분만» 잡힌다.
      // 매치 직후가 «공백 + 또다시 base64»면 절단된 것 → 앞부분만 저장하면 깨진 이미지가 되고 뒤는 캔버스에
      // 쓰레기로 남는다. 안전하게 «건드리지 않고» 원본 인라인 전체를 그대로 둔다(변환 대상에서 제외).
      if (/^\s+[A-Za-z0-9+/]/.test(html.slice(DATA_URI_RE.lastIndex))) { truncated.add(m[0]); continue; }
      uris.add(m[0]);
    }
  }
  // 변환할 온전한 이미지가 하나도 없으면: 절단분만 있으면 정직하게 실패(원본 무손상), 아니면 noop.
  if (uris.size === 0) {
    if (truncated.size > 0) return { ok: false, reason: 'all_base64_truncated', skipped: truncated.size, before, sections: sectionsBefore, ms: Date.now() - t0 };
    return { ok: true, noop: true, before, after: before, refs: 0, images: 0, sections: sectionsBefore, ms: Date.now() - t0 };
  }
  let refs = 0;
  for (const s of slots) refs += countMatches(s.get(), DATA_URI_RE);
  if (opts.dryRun) return { ok: true, dryRun: true, before, refs, images: uris.size, sections: sectionsBefore, ms: Date.now() - t0 };

  // 3) 에셋 저장 (실패한 URI는 원본 base64 유지 = 데이터 손실 없음)
  const cache = new Map(); // uri → url
  const skippedUris = new Set(); // [F6] 저장 실패해 원본 base64로 남는 URI(정직한 게이트·통지용)
  let images = 0, reused = 0, skipped = 0;
  const urls = [];
  for (const uri of uris) {
    const parsed = parseDataUri(uri);
    if (!parsed) { skipped++; skippedUris.add(uri); continue; }
    try {
      const buf = Buffer.from(parsed.b64, 'base64');
      if (buf.length === 0) { skipped++; skippedUris.add(uri); continue; }
      const r = saveImageBytes(projectsDir, p.id, buf, parsed.mime);
      cache.set(uri, r.url); urls.push(r);
      images++; if (r.reused) reused++;
    } catch (_) { skipped++; skippedUris.add(uri); }
  }
  // 절단분(건드리지 않음)도 «변환 안 된 이미지»이므로 skipped로 정직하게 집계 + remaining 게이트가 인지하게 한다.
  for (const u of truncated) { skippedUris.add(u); skipped++; }
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
  // [F6] remaining을 실게이트로 — 치환 후 남은 base64는 «저장 실패한 URI(skippedUris)»의 등장횟수와
  //   정확히 같아야 한다. 더 많으면 수집(정규식)이 놓친 base64가 있다는 뜻이므로 성공으로 보고하지 않고 막는다
  //   (원본 rename 전이라 데이터 무손상). skipped URI가 여러 번 등장할 수 있어 «횟수»로 비교한다.
  let expectedRemaining = 0;
  for (const uri of skippedUris) for (const s of slots) expectedRemaining += (s.get().split(uri).length - 1);
  if (remaining > expectedRemaining) return { ok: false, reason: `base64_uncollected remaining=${remaining} expected=${expectedRemaining}`, before };
  for (const u of urls) {
    const full = path.join(p.assets, u.filename);
    let st = null; try { st = fs.statSync(full); } catch (_) {}
    if (!st || st.size <= 0) return { ok: false, reason: `asset_missing ${u.filename}`, before };
  }
  // [F3] updatedAt 갱신 — 이 파일이 «가장 최신»임을 명시한다. 안 하면 «열 때 자동변환» 후에도 fileTs가
  //   마지막 autosave 시각에 머물러, 렌더러 initLoad의 localStorage 우선 로직(lsTs+500>fileTs)이
  //   base64가 남아 있는 LS 스냅샷을 이겨 DOM을 base64로 되돌리고 → 다음 autosave가 외부화를 무효화한다(F3).
  try { const nowIso = new Date(opts.now ? opts.now() : Date.now()).toISOString(); if (data && typeof data === 'object') data.updatedAt = nowIso; } catch (_) {}
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
      // [F3] 회전본 상한 — 반복 변환으로 회전본이 무한 적립되던 것 방지(가장 최근 N개만 남긴다).
      try {
        const rots = fs.readdirSync(p.dir)
          .filter(f => /^proj_pre-externalize\.\d+\.json$/.test(f))
          .sort((a, b) => (parseInt(b.match(/\d+/)) || 0) - (parseInt(a.match(/\d+/)) || 0));
        for (const old of rots.slice(MAX_PRE_EXT_ROTATIONS)) { try { fs.unlinkSync(path.join(p.dir, old)); } catch (_) {} }
      } catch (_) {}
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
  const marker = { schema: SCHEMA, at: new Date(opts.now ? opts.now() : Date.now()).toISOString(), before, after, refs, images, reused, skipped, backup: BACKUP_NAME };
  try { if (typeof opts.afterWrite === 'function') opts.afterWrite(p.id, data); } catch (_) {}
  try { patchMeta(p.meta, { externalized: marker }); } catch (_) { /* 마커 실패는 무해 */ }

  return { ok: true, before, after, refs, images, reused, skipped, sections: sectionsAfter, backupPath, ms: Date.now() - t0 };
}

/** 되돌리기 진단 — 버려질 «현재 작업»과 복원될 «변환 전 원본»의 격차(UI 경고용, 비파괴). */
function rollbackDiag(p, backupRaw) {
  const out = { restoreBytes: Buffer.byteLength(backupRaw), currentBytes: 0, currentSections: 0, restoreSections: 0, convertedAt: null, ageDays: null };
  try {
    const cur = fs.readFileSync(p.proj, 'utf8');
    out.currentBytes = Buffer.byteLength(cur);
    const cd = JSON.parse(cur);
    for (const s of canvasSlots(cd)) out.currentSections += countSections(s.get());
  } catch (_) {}
  try { const bd = JSON.parse(backupRaw); for (const s of canvasSlots(bd)) out.restoreSections += countSections(s.get()); } catch (_) {}
  try {
    const meta = readJsonOrNull(p.meta);
    if (meta && meta.externalized && meta.externalized.at) {
      out.convertedAt = meta.externalized.at;
      out.ageDays = Math.max(0, Math.round((Date.now() - new Date(meta.externalized.at).getTime()) / 86400000));
    }
  } catch (_) {}
  return out;
}

/**
 * 되돌리기 — proj_pre-externalize.json을 proj.json으로 복원한다.
 * ★F2: 되돌리면 «변환 이후 작업»이 통째로 사라진다(pre-externalize는 변환 시점 고정본이므로).
 *   그 작업을 «전용» 파일 proj_pre-rollback.json에 보존한다 — 롤링 proj_backup.json은 다음 autosave가
 *   1.5초 뒤 덮어써 되돌리기-취소용으로 못 쓴다(이 파일 헤더가 스스로 경고했던 함정). 전용 파일은
 *   autosave·저장 경로가 절대 건드리지 않으므로 실수 되돌리기 후에도 복구할 여지를 남긴다.
 * 복원 후 backup(pre-externalize)은 «소비»한다(지운다) — 안 지우면 몇 주 뒤 재변환 때 옛 원본이 남아
 * 다음 되돌리기가 몇 주 전 상태로 돌아가는 사고가 난다. 에셋 파일은 남긴다(다른 참조 가능, 해시라 무해).
 * @param {{dryRun?:boolean, afterWrite?:Function}} [opts] dryRun=진단만 반환(파일 무변경).
 * @returns {{ok:boolean, reason?:string, restoredBytes?:number, ageDays?:number|null, currentSections?:number, restoreSections?:number, preRollback?:string}}
 */
function rollbackExternalize(projectsDir, projectId, opts = {}) {
  const p = pathsFor(projectsDir, projectId);
  if (!fs.existsSync(p.backup)) return { ok: false, reason: 'no_backup' };
  let raw;
  try { raw = fs.readFileSync(p.backup, 'utf8'); JSON.parse(raw); }
  catch (e) { return { ok: false, reason: 'backup_corrupt', error: e.message }; }
  const diag = rollbackDiag(p, raw);
  if (opts.dryRun) return { ok: true, dryRun: true, ...diag };
  // 현재 proj.json(=변환 이후 작업)을 «전용» 보관처로 보존(F2). 롤링 슬롯이 아니라 아무도 안 덮는 파일.
  // ★2차 되돌리기(변환→되돌리기→재변환→되돌리기)가 1차 보관본을 덮지 않도록, 있으면 타임스탬프로 회전(상한).
  try {
    if (fs.existsSync(p.proj)) {
      if (fs.existsSync(p.preRollback)) {
        try {
          fs.renameSync(p.preRollback, path.join(p.dir, `proj_pre-rollback.${Date.now()}.json`));
          const rots = fs.readdirSync(p.dir)
            .filter(f => /^proj_pre-rollback\.\d+\.json$/.test(f))
            .sort((a, b) => (parseInt(b.match(/\d+/)) || 0) - (parseInt(a.match(/\d+/)) || 0));
          for (const old of rots.slice(MAX_PRE_EXT_ROTATIONS)) { try { fs.unlinkSync(path.join(p.dir, old)); } catch (_) {} }
        } catch (_) {}
      }
      fs.copyFileSync(p.proj, p.preRollback);
    }
  } catch (_) {}
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
  return { ok: true, restoredBytes: Buffer.byteLength(raw), preRollback: 'proj_pre-rollback.json', ...diag };
}

module.exports = {
  DATA_URI_RE, GOYA_RE, BACKUP_NAME,
  extFromMime, saveImageBytes, scanProjectFile, externalizeProjectFile, rollbackExternalize,
  _internal: { pathsFor, canvasSlots, countMatches, countSections, parseDataUri },
};
