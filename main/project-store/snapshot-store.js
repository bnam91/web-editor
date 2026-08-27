/* ═══════════════════════════════════════════════════════════════════════════
   project-store/snapshot-store.js — 프로젝트 «버전/백업 히스토리»의 저장소 계층.
   설계: _context/DESIGN-version-history.md
   ───────────────────────────────────────────────────────────────────────────
   ★왜 스냅샷을 «외부화»해서 쓰나 — 용량 때문«만»이 아니다(§6-2)
     ① 용량: 스냅샷 1개 39.59MB → 0.238MB. 히스토리 저장소 전체 2,511MB → 107MB(실측).
     ② ★diff 의 «성립 조건»: 스냅샷이 정규형인데 현재본이 base64 면 이미지가 든 «모든 섹션»이
        「변경」으로 떠서 버전 목록이 통째로 무용해진다. 양쪽을 같은 정규형으로 몰아야만 비교가 된다.
        에셋 파일명이 콘텐츠 해시(sha256 16hex)라서 두 표현을 같은 토큰으로 접을 수 있다.
     ⇒ **용량을 포기해도 외부화는 포기할 수 없다.** 「용량 때문이면 안 해도 되잖아」로 되돌리지 마라.

   ★에셋 GC 를 만들려는 사람에게 (읽고 가라)
     스냅샷은 이미지를 «참조»(goya-asset://)로 가진다. assets/ 를 정리하는 코드는 **반드시**
     listReferencedAssets() 의 결과를 제외해야 한다. 안 그러면 과거 버전이 «조용히» 깨진다
     (로드는 되고 그림만 빈다 — 사용자가 알아채는 건 몇 주 뒤다).
     계약은 tests/unit/snapshot-store.test.js 의 GC 계약 테스트가 지킨다.

   ★파일명 `<epoch>.json` 은 계약이다
     projects:load 의 손상 폴백이 parseInt(파일명)으로 최신순 정렬한다. 접미사를 붙이면 조용히 깨진다.
     부가정보(reason/pinned/집계)는 전부 사이드카 index.json 에 둔다.

   ★에셋 규약은 externalizer 와 «같아야» 한다 — 그래서 빌려 쓴다(재구현 금지).
     같은 바이트가 같은 파일명이어야 dedup 이 성립한다.
═══════════════════════════════════════════════════════════════════════════ */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const X = require('./externalizer');

/* ── 정책 상수 ───────────────────────────────────────────────────────────── */
const SCHEMA        = 1;
const MIN_GAP_MS    = 10 * 60 * 1000;   // 자동 스냅샷 간격 게이트(저장 폭주 방지)
const RECENT_KEEP   = 20;               // 최근 N개는 무조건 보존
const DAILY_DAYS    = 14;               // 최근 D일, 각 날짜의 «마지막» 1개 보존
const PINNED_MAX    = 10;               // 핀 상한(초과 시 오래된 핀부터 해제)
const BUDGET_BYTES  = 200 * 1024 * 1024;// 프로젝트당 스냅샷 예산(안전판)
// ★current 지문 갱신 스로틀. 지문 계산은 39.6MB 프로젝트에서 32ms 인데 «매 저장»(1.5초 debounce)마다
//   돌면 구코드가 0 이던 경로에 32ms 를 얹는 회귀다. listVersions 가 proj.json mtime 으로 신선도를
//   재고 낡았으면 그때 한 번 다시 재므로(≈80ms, 모달 열 때 1회), 스로틀을 걸어도 «정확도 손실이 없다».
const CURRENT_REFRESH_MS = 30 * 1000;
const INDEX_NAME    = 'index.json';
const PINNED_REASONS = new Set(['pre-restore', 'manual']);

/* ── 지문 정규식 — «싸구려»가 요구사항이다(저장 경로에 얹힌다) ─────────────
 * 실측(39.6MB canvas): SEC_OPEN 16ms · BLOCK_ID 7ms · 이미지 2종 20ms · secs 추출 8ms.
 * 합계 45ms 라 스로틀이 필요 없다 — 추측했으면 안 넣어도 될 스로틀을 넣었을 것이다. */
const SEC_OPEN = /<div class="section-block"[^>]*>/g;
// 앱의 genId 규약(sec_/ab_/tb_/gb_…). svg 내부의 id="lnr-grad-1" 같은 건 하이픈 때문에 안 걸린다.
// ★id 를 «캡처»한다 — 섹션 id 를 집합으로 빼야 blocks 가 정확해진다(아래 주석).
const BLOCK_ID = / id="([a-z0-9]{1,6}_[a-z0-9]{4,})"/gi;
const GOYA_ONE = /goya-asset:\/\/([\w.-]+)\/([\w.-]+)/g;
const B64_HEAD = /data:image\/[a-z0-9.+-]+;base64,/gi;
const ATTR_ID   = / id="([^"]*)"/;          // outerHTML 은 속성값의 " 를 &quot; 로 이스케이프 → [^"]* 안전
const ATTR_NAME = / data-name="([^"]*)"/;
const LABEL_RE  = /<span class="section-label"[^>]*>([^<]*)<\/span>/;
const LABEL_WINDOW = 400;                    // section-hitzone 은 섹션의 첫 자식이라 이 창이면 충분

/* ── 소품 ────────────────────────────────────────────────────────────────── */
function safeSeg(s) {
  const v = String(s || '').replace(/[^\w.-]/g, '_');
  return (v === '' || /^\.+$/.test(v)) ? '_' : v;
}
function isValidTs(ts) { return /^\d{1,15}$/.test(String(ts)); }
function pathsFor(projectsDir, projectId) {
  const id = safeSeg(projectId);
  const dir = path.join(projectsDir, id);
  return {
    id, dir,
    proj:    path.join(dir, 'proj.json'),
    backup:  path.join(dir, 'proj_backup.json'),
    meta:    path.join(dir, 'proj_meta.json'),
    assets:  path.join(dir, 'assets'),
    history: path.join(dir, 'proj_history'),
    index:   path.join(dir, 'proj_history', INDEX_NAME),
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
function countMatches(str, re) {
  if (typeof str !== 'string') return 0;
  re.lastIndex = 0; let n = 0;
  while (re.exec(str) !== null) n++;
  return n;
}
/** 슬롯 파일명 목록 — ★숫자 정렬(오름차순). 문자열 정렬은 epoch 자릿수가 섞이면 시간순이 깨진다. */
function slotFiles(histDir) {
  try {
    if (!fs.existsSync(histDir)) return [];
    return fs.readdirSync(histDir)
      .filter(f => /^\d+\.json$/.test(f))
      .sort((a, b) => parseInt(a) - parseInt(b));
  } catch (_) { return []; }
}

/* ── 캔버스 슬롯 — v2(pages) / v1(canvas) 양쪽 ──────────────────────────── */
/** @returns {{key:string, html:string}[]} key 는 pageId(v1 이면 'page') */
function canvasStrings(data) {
  const out = [];
  if (data && Array.isArray(data.pages)) {
    data.pages.forEach((p, i) => {
      if (p && typeof p.canvas === 'string') out.push({ key: String(p.id || `page_${i}`), html: p.canvas });
    });
  } else if (data && typeof data.canvas === 'string') {
    out.push({ key: 'page', html: data.canvas });
  }
  return out;
}
/** 캔버스 문자열만 바꾼 «새 객체»를 만든다. ★입력을 절대 변형하지 않는다(D1). */
function mapCanvas(data, fn) {
  if (data && Array.isArray(data.pages)) {
    return { ...data, pages: data.pages.map(p => (p && typeof p.canvas === 'string') ? { ...p, canvas: fn(p.canvas) } : p) };
  }
  if (data && typeof data.canvas === 'string') return { ...data, canvas: fn(data.canvas) };
  return data;
}

/* ── 정규화(canonicalize) ────────────────────────────────────────────────── */
/** externalizer.saveImageBytes 와 «같은» 파일명을 계산한다(쓰지 않고). 계약 테스트가 동치를 지킨다. */
function assetNameFor(buf, mime) {
  const hash = crypto.createHash('sha256').update(buf).digest('hex').slice(0, 16);
  return `${hash}.${X.extFromMime(mime)}`;
}
function parseDataUri(uri) {
  const comma = uri.indexOf(',');
  if (comma === -1) return null;
  const header = uri.slice(5, comma);
  const semi = header.indexOf(';');
  return { mime: semi === -1 ? header : header.slice(0, semi), b64: uri.slice(comma + 1) };
}

/**
 * 캔버스의 인라인 base64 를 goya-asset:// 정규형으로 접는다.
 * @param {{write?:boolean}} opts write=true 면 에셋 바이트를 실제로 저장(dedup), false 면 해시만 계산.
 * @returns {{data:object, changed:boolean, images:number, reused:number, skipped:number, bytesWritten:number}}
 *   ★data 는 «새 객체»다. 입력은 한 필드도 안 바뀐다.
 */
function canonicalize(projectsDir, projectId, data, opts = {}) {
  const write = opts.write === true;
  const pid = safeSeg(projectId);
  const slots = canvasStrings(data);
  const nil = { data, changed: false, images: 0, reused: 0, skipped: 0, bytesWritten: 0 };
  if (!slots.length) return nil;

  // 수집 — [F6] 개행으로 절단된 base64(MIME 76자 wrapping)는 «건드리지 않는다».
  //   앞부분만 저장하면 깨진 이미지가 되고 뒤는 캔버스에 쓰레기로 남는다. externalizer 와 같은 규율.
  const uris = new Set();
  let skipped = 0;
  for (const s of slots) {
    if (s.html.indexOf('data:image') === -1) continue;
    X.DATA_URI_RE.lastIndex = 0;
    let m;
    while ((m = X.DATA_URI_RE.exec(s.html)) !== null) {
      if (/^\s+[A-Za-z0-9+/]/.test(s.html.slice(X.DATA_URI_RE.lastIndex))) { skipped++; continue; }
      uris.add(m[0]);
    }
  }
  if (uris.size === 0) return { ...nil, skipped };

  const cache = new Map();
  let images = 0, reused = 0, bytesWritten = 0;
  for (const uri of uris) {
    const parsed = parseDataUri(uri);
    if (!parsed) { skipped++; continue; }
    let buf;
    try { buf = Buffer.from(parsed.b64, 'base64'); } catch (_) { skipped++; continue; }
    if (!buf.length) { skipped++; continue; }
    try {
      let url;
      if (write) {
        const r = X.saveImageBytes(projectsDir, pid, buf, parsed.mime);
        url = r.url;
        if (r.reused) reused++; else bytesWritten += buf.length;
      } else {
        url = `goya-asset://${pid}/${assetNameFor(buf, parsed.mime)}`;
      }
      cache.set(uri, url); images++;
    } catch (_) { skipped++; }
  }
  if (cache.size === 0) return { ...nil, skipped };

  // 치환 — 긴 URI 부터(부분일치 방지). URI 는 고유 토큰이라 split/join 이 안전.
  const sorted = [...cache.keys()].sort((a, b) => b.length - a.length);
  const out = mapCanvas(data, (html) => {
    if (html.indexOf('data:image') === -1) return html;
    let h = html;
    for (const uri of sorted) if (h.indexOf(uri) !== -1) h = h.split(uri).join(cache.get(uri));
    return h;
  });
  return { data: out, changed: true, images, reused, skipped, bytesWritten };
}

/* ── 지문(fingerprint) ───────────────────────────────────────────────────── */
/**
 * 목록·손실diff 의 재료. ★파일을 읽지 않고 이미 파싱된 객체에서만 뽑는다.
 * @returns {{counts:{pages,sections,blocks,images}, secs:{k,n}[], assets:string[]}}
 *   secs.k = `pageId::sectionId` (market-merge 와 같은 키 규약)
 *   counts.blocks = 앱 genId 규약의 id 를 가진 요소 중 «섹션이 아닌» 것. 행(row)·프레임도 포함하는
 *     근사치라 «정확한 블록 개수»는 아니지만, 버전 간 «증감 감지»에는 일관되므로 목적에 충분하다
 *     (UI 툴팁에 그렇게 적는다).
 */
function fingerprint(data) {
  const slots = canvasStrings(data);
  const secs = [];
  const assets = new Set();
  let sections = 0, blockCount = 0, images = 0;
  for (const s of slots) {
    const html = s.html;
    const secIds = new Set();
    SEC_OPEN.lastIndex = 0;
    let m;
    while ((m = SEC_OPEN.exec(html)) !== null) {
      const tag = m[0];
      const id = (tag.match(ATTR_ID) || [])[1] || '';
      let name = (tag.match(ATTR_NAME) || [])[1] || '';
      if (!name) {
        // §6-3 규약: data-name → .section-label 텍스트 → id. hitzone 은 첫 자식이라 창 하나면 닿는다.
        const win = html.slice(SEC_OPEN.lastIndex, SEC_OPEN.lastIndex + LABEL_WINDOW);
        name = (win.match(LABEL_RE) || [])[1] || '';
      }
      if (id) secIds.add(id);
      secs.push({ k: `${s.key}::${id || `noid_${sections}`}`, n: name || id || '(이름 없음)' });
      sections++;
    }
    // ★blocks = «BLOCK_ID 에 걸리는 id» 중 섹션 id 를 뺀 것.
    //   초기 구현은 (전체 id 수 − 섹션 수) 로 뺐는데, 그건 «모든 섹션 id 가 BLOCK_ID 에 걸린다»를
    //   전제한다. 짧은 id(sec_a)는 안 걸려서 blocks 가 조용히 1씩 적게 나왔다(단위테스트 FP3 이 잡음).
    //   두 정규식을 빼기로 엮지 말고, 같은 패스에서 모은 섹션 id 집합으로 «정확히» 제외한다.
    BLOCK_ID.lastIndex = 0;
    while ((m = BLOCK_ID.exec(html)) !== null) if (!secIds.has(m[1])) blockCount++;
    images += countMatches(html, B64_HEAD);
    GOYA_ONE.lastIndex = 0;
    while ((m = GOYA_ONE.exec(html)) !== null) { assets.add(m[2]); images++; }
  }
  return {
    counts: { pages: slots.length, sections, blocks: blockCount, images },
    secs,
    assets: [...assets],
  };
}

/* ── 사이드카 인덱스 ─────────────────────────────────────────────────────── */
function emptyIndex(projectId) { return { v: SCHEMA, projectId: safeSeg(projectId), current: null, entries: [] }; }

function readIndex(projectsDir, projectId) {
  const p = pathsFor(projectsDir, projectId);
  const idx = readJsonOrNull(p.index);
  if (!idx || idx.v !== SCHEMA || !Array.isArray(idx.entries)) return null;
  return idx;
}
function writeIndex(projectsDir, projectId, idx) {
  const p = pathsFor(projectsDir, projectId);
  try { fs.mkdirSync(p.history, { recursive: true }); } catch (_) {}
  atomicWrite(p.index, JSON.stringify(idx, null, 2));
  return idx;
}

/**
 * 디스크의 슬롯을 훑어 인덱스를 다시 만든다. ★인덱스는 «파생 데이터»다 — 잃어도 손실이 아니다.
 * 레거시(base64) 슬롯은 canon:0 으로 표시하고 그대로 목록에 남긴다(P1 무접촉 정책).
 */
function rebuildIndex(projectsDir, projectId) {
  const p = pathsFor(projectsDir, projectId);
  const idx = emptyIndex(projectId);
  const prev = readJsonOrNull(p.index); // reason/pinned 같은 «디스크에서 못 뽑는» 정보는 살려 옮긴다
  const prevByTs = new Map(((prev && prev.entries) || []).map(e => [e.ts, e]));
  for (const file of slotFiles(p.history)) {
    const full = path.join(p.history, file);
    let raw;
    try { raw = fs.readFileSync(full, 'utf8'); } catch (_) { continue; }
    let data;
    try { data = JSON.parse(raw); } catch (_) { continue; } // 손상 슬롯은 인덱스에서 뺀다(폴백 체인은 그대로 씀)
    const fp = fingerprint(data);
    const ts = parseInt(file);
    const old = prevByTs.get(ts) || {};
    idx.entries.push({
      ts, file,
      reason: old.reason || 'auto',
      pinned: old.pinned === true,
      // ★canon 판정은 «캔버스 안» base64 로만 한다. assetsTree 썸네일 같은 캔버스 밖 소형 base64는
      //   canonicalize 의 대상이 아니므로, raw 전체로 재면 정규형 스냅샷이 레거시로 오분류된다.
      canon: canvasStrings(data).some(c => c.html.indexOf('data:image') !== -1) ? 0 : 1,
      bytes: Buffer.byteLength(raw),
      name: data.name || null,
      counts: fp.counts, secs: fp.secs, assets: fp.assets,
    });
  }
  idx.entries.sort((a, b) => a.ts - b.ts);
  if (prev && prev.current) idx.current = prev.current;
  return writeIndex(projectsDir, projectId, idx);
}

/** 인덱스를 얻는다 — 없으면 재빌드. 항상 유효한 인덱스를 돌려준다. */
function ensureIndex(projectsDir, projectId) {
  return readIndex(projectsDir, projectId) || rebuildIndex(projectsDir, projectId);
}

/**
 * 현재 proj.json 의 지문을 인덱스에 새긴다 — «스냅샷 생성 여부와 무관하게» 매 저장마다.
 * 이게 있어야 버전 목록이 «파일을 한 개도 안 읽고» 손실 diff 를 낸다(§D4).
 */
function updateCurrent(projectsDir, projectId, data, opts = {}) {
  const p = pathsFor(projectsDir, projectId);
  const idx = ensureIndex(projectsDir, projectId);
  const fp = fingerprint(data);
  let projMtimeMs = 0, bytes = opts.bytes || 0;
  try { const st = fs.statSync(p.proj); projMtimeMs = st.mtimeMs; if (!bytes) bytes = st.size; } catch (_) {}
  idx.current = { ts: opts.now || Date.now(), bytes, projMtimeMs, name: data && data.name || null, counts: fp.counts, secs: fp.secs };
  return writeIndex(projectsDir, projectId, idx);
}

/* ── 스냅샷 기록 ─────────────────────────────────────────────────────────── */
/**
 * «지금 저장되는 객체»를 정규형 스냅샷으로 남긴다.
 * ★재료가 «직전 파일»이 아니라 메모리의 객체다 — 39MB copyFileSync 가 사라져 저장이 오히려 빨라진다.
 * ★proj.json / proj_backup.json 은 한 바이트도 안 건드린다.
 * @param {{reason?:string, force?:boolean, now?:number}} opts force=true 면 간격 게이트 무시(pre-restore 전용)
 * @returns {{ok:boolean, skipped?:string, ts?:number, bytes?:number, images?:number, reused?:number, bytesWritten?:number}}
 */
function writeSnapshot(projectsDir, projectId, data, opts = {}) {
  const p = pathsFor(projectsDir, projectId);
  const reason = opts.reason || 'auto';
  const now = opts.now || Date.now();
  if (!data || typeof data !== 'object') return { ok: false, skipped: 'no_data' };

  const idx = ensureIndex(projectsDir, projectId);

  // 간격 게이트 — force 면 무시. ★게이트에 막혀도 current 지문은 갱신한다(목록이 늘 최신을 보게).
  if (opts.force !== true) {
    const last = idx.entries.length ? idx.entries[idx.entries.length - 1].ts : 0;
    if (!(now - last > MIN_GAP_MS)) {
      // 게이트에 막혀도 current 는 «가끔» 갱신한다 — 매번 하면 저장 경로에 32ms 회귀.
      // 건너뛴 사이의 정확도는 listVersions 의 mtime 신선도 판정이 메운다.
      const curTs = (idx.current && idx.current.ts) || 0;
      if (now - curTs > CURRENT_REFRESH_MS) updateCurrent(projectsDir, projectId, data, { now });
      return { ok: false, skipped: 'interval' };
    }
  }

  try { fs.mkdirSync(p.history, { recursive: true }); } catch (_) {}

  const canon = canonicalize(projectsDir, projectId, data, { write: true });
  const out = JSON.stringify(canon.data, null, 2);

  // ts 충돌 회피(force 연타) — 파일명이 곧 키다.
  let ts = now;
  while (fs.existsSync(path.join(p.history, `${ts}.json`))) ts++;
  const file = `${ts}.json`;
  try { atomicWrite(path.join(p.history, file), out); }
  catch (e) { return { ok: false, skipped: 'write_failed', error: e.message }; }

  const fp = fingerprint(canon.data);
  idx.entries.push({
    ts, file, reason,
    pinned: PINNED_REASONS.has(reason),
    canon: 1,
    bytes: Buffer.byteLength(out),
    name: (data && data.name) || null,
    counts: fp.counts, secs: fp.secs, assets: fp.assets,
  });
  idx.entries.sort((a, b) => a.ts - b.ts);
  writeIndex(projectsDir, projectId, idx);
  updateCurrent(projectsDir, projectId, data, { now });

  return { ok: true, ts, bytes: Buffer.byteLength(out), images: canon.images, reused: canon.reused, bytesWritten: canon.bytesWritten };
}

/* ── 프룬 ────────────────────────────────────────────────────────────────── */
function dayKey(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
/**
 * 계층 보관 — 최근 N + 하루 1개 × D일 + 핀. ★레거시(canon:0)는 P1 에서 «절대» 안 지운다.
 * 복구 도구가 사용자 데이터를 지우고 시작하면 안 된다(P-2). 회수는 P2 의 «옛 스냅샷 경량화» 버튼으로.
 * @returns {{kept:number, deleted:string[], unpinned:number}}
 */
function pruneVersions(projectsDir, projectId, opts = {}) {
  const p = pathsFor(projectsDir, projectId);
  const now = opts.now || Date.now();
  const idx = ensureIndex(projectsDir, projectId);
  const all = [...idx.entries].sort((a, b) => b.ts - a.ts); // 최신 우선

  // 핀 상한 — 초과분은 오래된 핀부터 «해제»(지우지는 않는다. 이후 일반 규칙을 탄다).
  let unpinned = 0;
  const pinnedDesc = all.filter(e => e.pinned);
  for (const e of pinnedDesc.slice(PINNED_MAX)) { e.pinned = false; unpinned++; }

  const keep = new Set();
  for (const e of all) {
    if (e.pinned) keep.add(e.ts);
    if (e.canon === 0) keep.add(e.ts); // ★레거시 무접촉
  }
  // 최근 N
  let n = 0;
  for (const e of all) { if (keep.has(e.ts)) continue; if (n++ < RECENT_KEEP) keep.add(e.ts); }
  // 하루 1개 × D일 — 각 날짜의 «마지막»(=가장 최신) 1개
  const cutoff = now - DAILY_DAYS * 86400000;
  const seenDay = new Set();
  for (const e of all) {
    if (e.ts < cutoff) continue;
    const k = dayKey(e.ts);
    if (seenDay.has(k)) continue;
    seenDay.add(k); keep.add(e.ts);
  }
  // 예산 안전판 — 초과하면 «핀도 레거시도 아닌» 가장 오래된 것부터 뺀다.
  let total = all.filter(e => keep.has(e.ts)).reduce((s, e) => s + (e.bytes || 0), 0);
  if (total > BUDGET_BYTES) {
    const droppable = all.filter(e => keep.has(e.ts) && !e.pinned && e.canon !== 0).sort((a, b) => a.ts - b.ts);
    for (const e of droppable) {
      if (total <= BUDGET_BYTES) break;
      keep.delete(e.ts); total -= (e.bytes || 0);
    }
  }

  const deleted = [];
  for (const e of all) {
    if (keep.has(e.ts)) continue;
    try { fs.unlinkSync(path.join(p.history, e.file)); deleted.push(e.file); } catch (_) {}
  }
  idx.entries = idx.entries.filter(e => keep.has(e.ts)).sort((a, b) => a.ts - b.ts);
  writeIndex(projectsDir, projectId, idx);
  return { kept: idx.entries.length, deleted, unpinned };
}

/* ── 조회 ────────────────────────────────────────────────────────────────── */
/** 목록 — ★파일을 한 개도 안 읽는다(인덱스가 최신이면). current 가 낡았으면 그때만 proj.json 1회 파싱. */
function listVersions(projectsDir, projectId) {
  const p = pathsFor(projectsDir, projectId);
  let idx = ensureIndex(projectsDir, projectId);
  let stale = !idx.current;
  if (!stale) {
    try { stale = fs.statSync(p.proj).mtimeMs > (idx.current.projMtimeMs || 0); } catch (_) { stale = false; }
  }
  if (stale) {
    const cur = readJsonOrNull(p.proj);
    if (cur) idx = updateCurrent(projectsDir, projectId, cur);
  }
  const entries = [...idx.entries].sort((a, b) => b.ts - a.ts); // 최신 우선(UI 순서)
  return {
    ok: true,
    current: idx.current,
    entries,
    legacyCount: entries.filter(e => e.canon === 0).length,
    totalBytes: entries.reduce((s, e) => s + (e.bytes || 0), 0),
  };
}

/** 스냅샷 1개를 파싱해 반환. ts 는 정수만 — 경로 조작 차단. */
function readVersion(projectsDir, projectId, ts) {
  if (!isValidTs(ts)) return { ok: false, reason: 'bad_ts' };
  const p = pathsFor(projectsDir, projectId);
  const full = path.join(p.history, `${parseInt(ts)}.json`);
  if (!full.startsWith(p.history + path.sep)) return { ok: false, reason: 'bad_ts' };
  if (!fs.existsSync(full)) return { ok: false, reason: 'not_found' };
  const data = readJsonOrNull(full);
  if (!data) return { ok: false, reason: 'corrupt' };
  return { ok: true, ts: parseInt(ts), data, bytes: fs.statSync(full).size };
}

/* ── ★GC 계약 ───────────────────────────────────────────────────────────── */
/**
 * 이 프로젝트에서 «살아 있는» 에셋 파일명 전체.
 * ★assets/ 를 정리하는 코드는 반드시 이걸 제외해야 한다. 안 그러면 과거 버전이 조용히 깨진다.
 * 대상: proj.json · proj_backup.json · proj_history/*.json(전부) · proj_pre-externalize*.json ·
 *      proj_pre-rollback*.json — 즉 «복구에 쓰일 수 있는 모든 파일».
 * @returns {Set<string>} 파일명 집합(예: '0633437eefdd157d.png')
 */
function listReferencedAssets(projectsDir, projectId) {
  const p = pathsFor(projectsDir, projectId);
  const out = new Set();
  const addFromRaw = (raw) => {
    if (typeof raw !== 'string' || raw.indexOf('goya-asset://') === -1) return;
    GOYA_ONE.lastIndex = 0;
    let m;
    while ((m = GOYA_ONE.exec(raw)) !== null) out.add(m[2]);
  };
  // 히스토리는 인덱스에 이미 집계돼 있으면 그걸 쓴다(파싱 회피). 없으면 파일을 직접 읽는다.
  const idx = readIndex(projectsDir, projectId);
  const indexed = new Set();
  if (idx) for (const e of idx.entries) { indexed.add(e.file); for (const a of (e.assets || [])) out.add(a); }
  for (const f of slotFiles(p.history)) {
    if (indexed.has(f)) continue;
    try { addFromRaw(fs.readFileSync(path.join(p.history, f), 'utf8')); } catch (_) {}
  }
  const others = [p.proj, p.backup];
  try {
    for (const f of fs.readdirSync(p.dir)) {
      if (/^proj_pre-(externalize|rollback)(\.\d+)?\.json$/.test(f)) others.push(path.join(p.dir, f));
    }
  } catch (_) {}
  for (const f of others) { try { addFromRaw(fs.readFileSync(f, 'utf8')); } catch (_) {} }
  return out;
}

/* ── 폴백 후보(불변식 A) — U0 에서 이관, 의미 무변경 ────────────────────── */
/**
 * projects:load 가 proj.json 을 못 읽었을 때 훑는 순서. ★순서 자체가 계약이다:
 *   backup → history(신 레이아웃, 최신→오래된) → history(구 flat) → pre-externalize(★맨 끝)
 * pre-externalize 는 변환 시점에 «고정»돼 늙는다. 앞에 두면 한 달 늙은 원본이 최신 백업/히스토리를
 * 이겨 덮어쓰는 데이터손실(F1)이 난다.
 */
function loadFallbackCandidates(projectsDir, id, resolveBackupPath) {
  const candidates = [];
  const backupPath = typeof resolveBackupPath === 'function' ? resolveBackupPath(id) : null;
  if (backupPath) candidates.push({ path: backupPath, from: 'backup' });
  for (const histDir of [path.join(projectsDir, id, 'proj_history'), path.join(projectsDir, `${id}_history`)]) {
    try {
      if (fs.existsSync(histDir)) {
        const slots = fs.readdirSync(histDir).filter(f => f.endsWith('.json') && f !== INDEX_NAME)
          .sort((a, b) => (parseInt(b) || 0) - (parseInt(a) || 0)); // 최신 우선
        for (const s of slots) candidates.push({ path: path.join(histDir, s), from: 'history' });
      }
    } catch (_) {}
  }
  try {
    const preExt = path.join(projectsDir, safeSeg(id), 'proj_pre-externalize.json');
    if (fs.existsSync(preExt)) candidates.push({ path: preExt, from: 'pre-externalize' });
  } catch (_) {}
  return candidates;
}

module.exports = {
  SCHEMA, MIN_GAP_MS, RECENT_KEEP, DAILY_DAYS, PINNED_MAX, BUDGET_BYTES, INDEX_NAME, CURRENT_REFRESH_MS,
  canonicalize, fingerprint,
  readIndex, writeIndex, rebuildIndex, ensureIndex, updateCurrent,
  writeSnapshot, pruneVersions, listVersions, readVersion,
  listReferencedAssets, loadFallbackCandidates,
  _internal: { safeSeg, pathsFor, canvasStrings, mapCanvas, assetNameFor, slotFiles, dayKey, isValidTs },
};
