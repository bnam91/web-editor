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
// ★[C1] 2 로 올린다 — v1 인덱스는 «깨진 정규식으로 계산된 지문»을 담고 있다.
//   그대로 두면 옛 스냅샷들이 계속 거짓말한다(지운 섹션이 손실에 안 뜨고, 안 지운 게 뜬다).
//   readIndex 가 v!==SCHEMA 를 거부하므로, 다음 접근에서 «자동 재빌드»된다(읽기 예산제가 비용을 묶는다).
const SCHEMA        = 2;
const MIN_GAP_MS    = 10 * 60 * 1000;   // 자동 스냅샷 간격 게이트(저장 폭주 방지)
const RECENT_KEEP   = 20;               // 최근 N개는 무조건 보존
const DAILY_DAYS    = 30;               // 최근 D일, 각 날짜의 «마지막» 1개 보존 (Q5 현빈 확정: 14→30)
const PINNED_MAX    = 10;               // 핀 상한(초과 시 오래된 핀부터 해제)
const BUDGET_BYTES  = 200 * 1024 * 1024;// 프로젝트당 스냅샷 예산(안전판)
// ★current 지문 갱신 스로틀. 지문 계산은 39.6MB 프로젝트에서 32ms 인데 «매 저장»(1.5초 debounce)마다
//   돌면 구코드가 0 이던 경로에 32ms 를 얹는 회귀다. listVersions 가 proj.json mtime 으로 신선도를
//   재고 낡았으면 그때 한 번 다시 재므로(≈80ms, 모달 열 때 1회), 스로틀을 걸어도 «정확도 손실이 없다».
const CURRENT_REFRESH_MS = 30 * 1000;
const INDEX_NAME    = 'index.json';
// [F2] ★핀 사이드카. reason/pinned 는 스냅샷 파일에서 «유도할 수 없다» — index.json 만 믿으면
//   인덱스를 잃는 순간 pre-restore 핀이 조용히 풀리고 다음 프룬이 «되돌리기 취소 지점»을 지운다.
//   「인덱스는 파생 데이터라 잃어도 손실이 아니다」가 참이 되려면 유도 불가 정보는 별도 파일에 있어야 한다.
const PINS_NAME     = 'pins.json';
// [F7] 이 크기를 넘는 레거시 슬롯은 JSON.parse 대신 raw 정규식으로 지문을 낸다(실측 8배).
//   사고 직후 «39MB 파싱»을 시키지 않는다는 설계 P-3 을 레거시에서도 지키기 위한 조치.
const LEGACY_RAW_MAX = 8 * 1024 * 1024;
// [F7] ★인덱스 1회 빌드에서 «읽을» 총 바이트 상한. raw 정규식으로 파싱을 없애도 515MB 프로젝트는
//   디스크 I/O 만으로 2.4초가 걸린다(실측) — 사고 직후 그만큼 얼면 그 자체로 실패다.
//   최신 슬롯부터 예산만큼만 분석하고 나머지는 pending 으로 둔다. 다음 열람 때 이어서 채운다
//   (이미 분석된 항목은 재사용하므로 자동으로 완성된다). 목록은 그 사이에도 시각·용량으로 답한다.
const REBUILD_BYTE_BUDGET = 120 * 1024 * 1024;
const PINNED_REASONS = new Set(['pre-restore', 'manual']);

/* ── 지문 정규식 — «싸구려»가 요구사항이다(저장 경로에 얹힌다) ─────────────
 * 실측(39.6MB canvas): SEC_OPEN 16ms · BLOCK_ID 7ms · 이미지 2종 20ms · secs 추출 8ms.
 * 합계 45ms 라 스로틀이 필요 없다 — 추측했으면 안 넣어도 될 스로틀을 넣었을 것이다. */
// ★[C1 치명] 닫는 " 를 강제하면 `class="section-block selected"` 를 «통째로» 놓친다.
//   런타임 클래스가 저장본에 새는 건 팀이 이미 아는 사실이다(js/version-diff.js:31 _RUNTIME_CLS 가
//   바로 그 selected/group-selected 를 벗긴다) — L1 정규식만 반영이 안 돼 있었다.
//   결과가 «거짓 안심»이라 제일 나쁘다: 지운 섹션이 손실 목록에 «안 뜨고», 안 지운 섹션이 뜬다.
//   ⚠️라이브 실데이터 67개 중 9개(13%)가 이 상태였다. 전제 검증: section-block 태그 2,121건 전부
//   «div + class 가 첫 속성» — 그래서 한 글자(`[ "]`)로 닫힌다.
const SEC_OPEN = /<div class="section-block[ "][^>]*>/g;
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
    pins:    path.join(dir, 'proj_history', PINS_NAME),
  };
}
function atomicWrite(filePath, data) {
  const tmp = filePath + '.tmp';
  // [F10] 쓰기 «도중» 실패(ENOSPC 등)에도 tmp 를 치운다. 초판은 rename 실패만 정리해서,
  //   디스크가 찬 상황에서 부분 tmp 가 계속 쌓였다(적대검수 지적).
  try { fs.writeFileSync(tmp, data); }
  catch (e) { try { fs.unlinkSync(tmp); } catch (_) {} throw e; }
  try { fs.renameSync(tmp, filePath); }
  catch (e) { try { fs.unlinkSync(tmp); } catch (_) {} throw e; }
}
function readJsonOrNull(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (_) { return null; }
}
/** [F6] canon 판정의 «유일한» 정의. write/rebuild 두 곳이 각자 계산하면 같은 파일에 다른 답이 나온다.
 *  ★캔버스 «안» base64 로만 판정한다 — assetsTree 썸네일 같은 캔버스 밖 base64 는 canonicalize 의
 *  대상이 아니므로 raw 전체로 재면 정규형 스냅샷이 레거시로 오분류된다. */
/** ★[R3/R4] 「프로젝트로 읽히는가」 — 안전판/되돌리기 대상의 최소 형태.
 *  객체이기만 하면 통과시키면 `{}` 가 «안전판»이 되고 `[]` 가 «되돌릴 데이터»가 된다.
 *  둘 다 ok:true 로 보고돼서 사용자는 안전하다고 믿는다. 그게 최악이다. */
/** 모든 페이지의 canvas 가 비었나 — js/io/save-load.js 의 S11(_isAllCanvasEmpty)과 같은 판정.
 *  정상 저장경로는 이걸로 «빈 저장»을 막는다. 되돌리기 경로에도 같은 눈이 필요하다. */
function isAllCanvasEmpty(d) {
  if (!d || typeof d !== 'object') return true;
  if (Array.isArray(d.pages)) {
    if (!d.pages.length) return true;
    return d.pages.every(pg => !pg || typeof pg.canvas !== 'string' || pg.canvas.trim() === '');
  }
  return typeof d.canvas !== 'string' || d.canvas.trim() === '';
}
function isProjectShaped(d) {
  if (!d || typeof d !== 'object' || Array.isArray(d)) return false;
  return Array.isArray(d.pages) || typeof d.canvas === 'string';
}
function canonOf(data) {
  // ★[M4] 「data:image 가 있나」가 아니라 «우리가 접는 것이 남았나»로 판정한다.
  //   canonicalize 는 externalizer 와 같은 규약이라 «base64 data URI 만» 접는다
  //   (비base64 SVG 는 경계가 모호·소형이라 대상 밖 — externalizer.js 헤더 규약).
  //   그런데 canon 을 'data:image' 문자열로 재면 그 SVG 하나 때문에 canon=0 이 되고,
  //   canon=0 은 «영구 보존 + 예산 미산입»이라 보관정책이 그 프로젝트에서 통째로 꺼진다.
  //   실측: 그 상태로 45일 시뮬 → 슬롯 270개(전량 잔존)·86MB. 정상은 48개·13.9MB.
  //   canon 의 «쓰임»은 ①레거시(기능 이전의 무거운 스냅샷) 보호 ②「옛 형식」 배지 —
  //   둘 다 「접을 수 있는 base64 가 남았나」가 맞는 물음이다.
  for (const c of canvasStrings(data)) {
    if (c.html.indexOf('data:image') === -1) continue;
    X.DATA_URI_RE.lastIndex = 0;
    if (X.DATA_URI_RE.test(c.html)) return 0;
  }
  return 1;
}
/** [F4] 문자열 전체에서 goya-asset 파일명을 긁는다 — 캔버스 밖(scratchpad 매니페스트 등)도 잡아야 한다. */
function assetsFromRaw(raw) {
  const out = new Set();
  if (typeof raw !== 'string' || raw.indexOf('goya-asset://') === -1) return out;
  GOYA_ONE.lastIndex = 0;
  let m;
  while ((m = GOYA_ONE.exec(raw)) !== null) out.add(m[2]);
  return out;
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
 *   ★입력은 한 필드도 안 바뀐다(이게 계약이다).
 *   ⚠️ 반환된 data 는 «얕은 복제»이고, 바꿀 게 없으면 «입력 그 자체»다(changed:false).
 *      받은 쪽이 그걸 변형하면 곧바로 원본 오염이다 — 변형하려면 호출측이 명시적으로 복제할 것.
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

/* ── [F7] raw 지문 — 대형 레거시 슬롯을 JSON.parse 없이 훑는다 ────────────
 * JSON 안에서 캔버스의 " 는 \" 로 이스케이프돼 있다. 그걸 그대로 노린다.
 * ⚠️ 정규 경로(fingerprint)와 «두 구현»이 되므로 드리프트 위험이 있다 → 8MB 초과 슬롯에만 쓰고,
 *    단위테스트가 두 경로의 동치를 대조한다(실슬롯 15개 차분검증 통과). */
const SEC_OPEN_ESC  = /<div class=\\"section-block[ \\][^>]*>/g;   // [C1] 이스케이프판도 같은 이유
const ATTR_ID_ESC   = / id=\\"([^\\"]*)\\"/;
const ATTR_NAME_ESC = / data-name=\\"([^\\"]*)\\"/;
// ⚠️ JSON 은 «/ 를 이스케이프하지 않는다» — 닫는 태그는 </span> 그대로다.
//    초판이 <\/span> 를 기대해 라벨 폴백이 통째로 헛돌았다(실슬롯 대조에서 15개 중 3개 불일치로 드러남).
const LABEL_ESC     = /<span class=\\"section-label\\"[^>]*>([^<]*)<\/span>/;
const BLOCK_ID_ESC  = / id=\\"([a-z0-9]{1,6}_[a-z0-9]{4,})\\"/gi;
function fingerprintRaw(raw) {
  const secs = [];
  const secIds = new Set();
  let sections = 0, blockCount = 0;
  SEC_OPEN_ESC.lastIndex = 0;
  let m;
  while ((m = SEC_OPEN_ESC.exec(raw)) !== null) {
    const tag = m[0];
    const id = (tag.match(ATTR_ID_ESC) || [])[1] || '';
    let name = (tag.match(ATTR_NAME_ESC) || [])[1] || '';
    if (!name) name = (raw.slice(SEC_OPEN_ESC.lastIndex, SEC_OPEN_ESC.lastIndex + LABEL_WINDOW * 2).match(LABEL_ESC) || [])[1] || '';
    if (id) secIds.add(id);
    // ★페이지 경계를 raw 에서 못 가르므로 키 앞을 '?' 로 둔다. 손실 diff 는 «섹션 id» 로 맞추므로
    //   섹션 이동/삭제 판정은 정확하고, 여러 페이지일 때 «어느 페이지였나»만 모른다(approx 로 표시).
    secs.push({ k: `?::${id || `noid_${sections}`}`, n: name || id || '(이름 없음)' });
    sections++;
  }
  BLOCK_ID_ESC.lastIndex = 0;
  while ((m = BLOCK_ID_ESC.exec(raw)) !== null) if (!secIds.has(m[1])) blockCount++;
  return {
    counts: { pages: 0, sections, blocks: blockCount, images: countMatches(raw, B64_HEAD) + countMatches(raw, GOYA_ONE) },
    secs, assets: [...assetsFromRaw(raw)], approx: true,
  };
}

/* ── 사이드카 인덱스 ─────────────────────────────────────────────────────── */
function readPins(projectsDir, projectId) {
  const o = readJsonOrNull(pathsFor(projectsDir, projectId).pins);
  return (o && typeof o === 'object' && !Array.isArray(o)) ? o : {};
}
function writePins(projectsDir, projectId, pins) {
  const p = pathsFor(projectsDir, projectId);
  try { fs.mkdirSync(p.history, { recursive: true }); } catch (_) {}
  atomicWrite(p.pins, JSON.stringify(pins, null, 2));
}
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
function rebuildIndex(projectsDir, projectId, opts = {}) {
  const p = pathsFor(projectsDir, projectId);
  const idx = emptyIndex(projectId);
  const prev = readJsonOrNull(p.index);
  const prevByTs = new Map(((prev && prev.entries) || []).map(e => [e.ts, e]));
  const pins = readPins(projectsDir, projectId); // [F2] 인덱스를 잃어도 핀은 여기서 되살아난다
  const schemaSame = !!(prev && prev.v === SCHEMA);   // ★[C1] 스키마가 다르면 옛 계산을 못 믿는다
  // [F7] ★최신 슬롯부터 예산만큼만 «읽는다». 이미 분석된 항목은 다시 읽지 않는다.
  const newestFirst = slotFiles(p.history).slice().reverse();
  let budget = opts.byteBudget != null ? opts.byteBudget : REBUILD_BYTE_BUDGET;
  for (const file of newestFirst) {
    const full = path.join(p.history, file);
    let st;
    try { st = fs.statSync(full); } catch (_) { continue; }
    const ts = parseInt(file);
    const old = prevByTs.get(ts) || {};
    const pinReason0 = pins[String(ts)] || (PINNED_REASONS.has(old.reason) ? old.reason : null);

    // 이미 분석된 항목은 그대로 승계(핀만 최신화) — 읽지 않는다.
    // ★[C1] 단 «스키마가 다르면» 승계하지 않는다. 그 지름길이 스키마 무효화를 통째로 무력화해서,
    //   깨진 정규식으로 찍힌 지문이 재빌드를 지나서도 살아남는다(테스트 C1c 가 이걸 잡았다).
    if (schemaSame && old.counts && old.pending !== true && old.bytes === st.size) {
      idx.entries.push({ ...old, reason: pinReason0 || old.reason || 'auto', pinned: !!pinReason0 });
      continue;
    }
    // 예산 소진 → 시각·용량만 기록하고 미룬다. 목록은 그래도 «그 버전이 있다»를 보여준다.
    if (budget - st.size < 0 && st.size > LEGACY_RAW_MAX) {
      idx.entries.push({
        ts, file, reason: pinReason0 || old.reason || 'auto', pinned: !!pinReason0,
        canon: 0, bytes: st.size, name: old.name || null,
        counts: null, secs: [], assets: old.assets || [], pending: true,
      });
      continue;
    }
    budget -= st.size;
    let raw;
    try { raw = fs.readFileSync(full, 'utf8'); } catch (_) { continue; }
    // [F7] 대형 레거시 슬롯은 JSON.parse 를 건너뛴다 — 사고 직후 초 단위 블록을 만들지 않기 위해.
    let fp, canon, name;
    if (st.size > LEGACY_RAW_MAX) {
      fp = fingerprintRaw(raw);
      // [M4] 대형은 캔버스/비캔버스를 못 가르므로 보수적이되, 판정은 «접을 수 있는 base64» 기준으로 맞춘다
      X.DATA_URI_RE.lastIndex = 0;
      canon = X.DATA_URI_RE.test(raw) ? 0 : 1;
      name = (raw.match(/"name"\s*:\s*"([^"]*)"/) || [])[1] || null;
    } else {
      let data;
      try { data = JSON.parse(raw); } catch (_) { continue; } // 손상 슬롯은 인덱스에서 빼되 «파일은 안 지운다»
      fp = fingerprint(data);
      canon = canonOf(data);
      name = data.name || null;
    }
    idx.entries.push({
      ts, file,
      reason: pinReason0 || old.reason || 'auto',
      pinned: !!pinReason0,
      canon,
      bytes: Buffer.byteLength(raw),
      name,
      counts: fp.counts, secs: fp.secs, assets: [...assetsFromRaw(raw)], // [F4] 캔버스 밖 참조도 잡는다
      ...(fp.approx ? { approx: true } : {}),
    });
  }
  idx.entries.sort((a, b) => a.ts - b.ts);
  // ★[C1] 스키마가 바뀐 인덱스의 current 는 «옛 계산»이라 그대로 이어받으면 안 된다.
  //   mtime 은 안 바뀌어 listVersions 의 신선도 판정에도 안 걸리므로, 여기서 명시적으로 버린다.
  if (prev && prev.current && prev.v === SCHEMA) idx.current = prev.current;
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
    // ★[M5] «내 시간선의» 최신을 본다 — 미래 ts 를 기준으로 잡으면 게이트가 영원히 안 열린다.
    //   미래 엔트리는 실제로 생긴다: NTP 보정 · 드라이브 동기화로 넘어온 폴더 · 백업 복원.
    //   실측: 미래 엔트리 1개면 정상 시계로 12회 저장해도 «성공 0» — 그리고 「안 쌓이고 있다」는
    //   신호가 어디에도 없어서 사고가 나야 안다. 그건 이 기능이 «있으나 마나»가 되는 실패다.
    let last = 0;
    for (const e of idx.entries) if (e.ts <= now && e.ts > last) last = e.ts;
    if (!(now - last > MIN_GAP_MS)) {
      // 게이트에 막혀도 current 는 «가끔» 갱신한다 — 매번 하면 저장 경로에 32ms 회귀.
      // 건너뛴 사이의 정확도는 listVersions 의 mtime 신선도 판정이 메운다.
      const curTs = (idx.current && idx.current.ts) || 0;
      if (now - curTs > CURRENT_REFRESH_MS) updateCurrent(projectsDir, projectId, data, { now });
      return { ok: false, skipped: 'interval' };
    }
  }

  try { fs.mkdirSync(p.history, { recursive: true }); } catch (_) {}

  // [F5] ★협업 등록 프로젝트는 정규화하지 «않는다».
  //   손상 폴백(projects:load)이 히스토리 슬롯을 proj.json 으로 자가치유 재기록하는데, 협업에서
  //   proj.json 은 «동기화되는 산출물»이다. 정규형이 그리로 올라가면 상대 디스크엔 assets/ 가 없어
  //   깨진 이미지가 간다. 설계 §8-4 가 「스냅샷은 로컬 전용」을 전제로 허용했던 구멍(적대검수 지적).
  const isCollab = (() => {
    try { const m = readJsonOrNull(p.meta); return !!(m && m.collabRef); } catch (_) { return false; }
  })();
  const canon = isCollab
    ? { data, changed: false, images: 0, reused: 0, skipped: 0, bytesWritten: 0 }
    : canonicalize(projectsDir, projectId, data, { write: true });
  const out = JSON.stringify(canon.data, null, 2);

  // [F11] ts 충돌 회피 — 디스크«와» 인덱스 양쪽을 본다. 파일만 보면 슬롯이 밖에서 사라진 뒤
  //   같은 ts 가 인덱스에 두 번 들어가 목록에 유령 행이 생긴다.
  let ts = now;
  const taken = new Set(idx.entries.map(e => e.ts));
  while (fs.existsSync(path.join(p.history, `${ts}.json`)) || taken.has(ts)) ts++;
  const file = `${ts}.json`;
  try { atomicWrite(path.join(p.history, file), out); }
  catch (e) { return { ok: false, skipped: 'write_failed', error: e.message }; }

  const fp = fingerprint(canon.data);
  idx.entries.push({
    ts, file, reason,
    pinned: PINNED_REASONS.has(reason),
    canon: canonOf(canon.data), // [F6] write/rebuild 가 같은 정의를 쓴다. 하드코딩 1 은 절단 base64 를 거짓말했다
    bytes: Buffer.byteLength(out),
    name: (data && data.name) || null,
    counts: fp.counts, secs: fp.secs,
    assets: [...assetsFromRaw(out)], // [F4] 캔버스 밖(scratchpad 매니페스트 등) 참조도 GC 근거에 넣는다
  });
  idx.entries.sort((a, b) => a.ts - b.ts);
  // [F2] 핀은 사이드카에 «먼저» 박는다 — 인덱스만 남기면 인덱스 유실이 곧 핀 유실이다.
  // ★[R1] 실패를 «삼키지 않는다». 초판은 catch(_){} 로 조용히 넘어가서, 사이드카가 안 써졌는데도
  //   prepareRestore 가 ok:true 를 냈다(인덱스만 보고 판정했으므로). 그러면 인덱스를 잃는 순간
  //   「되돌리기 취소 지점」이 사라지는데 사용자는 «돌아갈 수 있다»고 들은 뒤다.
  //   ⇒ 쓰고 «다시 읽어» 확인한 결과를 pinsOk 로 돌려준다. 판정은 호출측이 한다.
  let pinsOk = null;
  if (PINNED_REASONS.has(reason)) {
    pinsOk = false;
    try {
      const pins = readPins(projectsDir, projectId);
      pins[String(ts)] = reason;
      writePins(projectsDir, projectId, pins);
      pinsOk = readPins(projectsDir, projectId)[String(ts)] === reason;   // 읽어서 확인
    } catch (_) { pinsOk = false; }
  }
  // [F10] 인덱스 기록 실패가 «throw» 로 나가면 호출측이 스냅샷이 없다고 오해한다. 정직하게 돌려준다.
  try { writeIndex(projectsDir, projectId, idx); }
  catch (e) { return { ok: true, ts, indexFailed: e.message, bytes: Buffer.byteLength(out) }; }
  try { updateCurrent(projectsDir, projectId, data, { now }); } catch (_) {}

  return { ok: true, ts, bytes: Buffer.byteLength(out), images: canon.images, reused: canon.reused,
           bytesWritten: canon.bytesWritten, ...(pinsOk === null ? {} : { pinsOk }),
           ...(isCollab ? { collabVerbatim: true } : {}) };
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
  // ★[R2] 단 «안전판»(pre-restore)은 이 상한에서 제외한다.
  //   초판은 newest-first 목록을 slice 해서 «가장 오래된» 핀을 해제했는데, 되돌리기를 연달아 한
  //   패닉 세션에서 가장 오래된 안전판은 «그 소동 이전»으로 가는 유일한 길이다. 그걸 먼저 버렸다.
  //   그리고 prepareRestore 가 이미 ok:true 로 「돌아갈 수 있다」고 말한 뒤라, 조용한 철회다.
  //   상한은 사용자 «선호»로 찍는 핀(manual)에만 건다.
  let unpinned = 0;
  const cappedPins = all.filter(e => e.pinned && e.reason !== 'pre-restore');
  for (const e of cappedPins.slice(PINNED_MAX)) { e.pinned = false; unpinned++; }

  const keep = new Set();
  for (const e of all) {
    if (e.pinned) keep.add(e.ts);
    if (e.canon === 0) keep.add(e.ts); // ★레거시 무접촉
  }
  // [F1 치명] ★«가장 최신» 스냅샷은 무슨 일이 있어도 남긴다.
  //   방금 만든 스냅샷을 몇 마이크로초 뒤 프룬이 지우는 일이 실제로 있었다(적대검수 재현).
  //   그러면 다음 저장의 간격 게이트가 옛 슬롯을 보고 통과해 «매 저장마다» 재스냅샷하는 무한루프가 된다.
  if (all.length) keep.add(all[0].ts);
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
  // [F1 치명] 예산 안전판 — ★«회수 가능한 것»만 예산에 센다.
  //   초판은 total 에 레거시(canon:0)까지 넣었는데 레거시는 애초에 회수 대상이 아니다. 실프로젝트 5개가
  //   이미 레거시만으로 200MB 를 넘겨서, total 이 영원히 예산 위에 있고 → 드롭 루프가 canon:1 을
  //   «전부» 지웠다(방금 만든 것 포함). 버전 히스토리가 필요한 바로 그 프로젝트들에서 0개가 남는다.
  const reclaimable = (e) => keep.has(e.ts) && !e.pinned && e.canon !== 0 && e.ts !== (all[0] && all[0].ts);
  let total = all.filter(reclaimable).reduce((s, e) => s + (e.bytes || 0), 0);
  if (total > BUDGET_BYTES) {
    /* ★[P4] «오래된 것부터»가 아니다 — «중복이 많은 것부터»다.
     * 살아남은 집합은 두 종류가 섞여 있다:
     *   ⓐ 최근 N개 — 몇 분 간격이라 서로 «거의 같다»(중복이 크다)
     *   ⓑ 날짜 대표 1개/일 — 하루에 하나뿐이라 «그날은 대체 불가»다
     * 오래된 것부터 버리면 ⓑ(대체 불가)를 먼저 죽이고 ⓐ(중복)를 남긴다 — 정확히 거꾸로다.
     * ⇒ ⓐ부터(그 안에서 오래된 순), 그래도 모자라면 ⓑ를 오래된 순.
     * ⛔안전판(pre-restore)은 아래 별도 루프가 «가장 새것부터» 버린다 — 거긴 반대가 맞다:
     *   새 안전판은 지금 상태와 거의 같아 재구성 가능하고, 가장 오래된 것은 그 소동 이전으로
     *   가는 유일한 길이라 대체 불가다. 두 규칙은 «중복이 많은 쪽을 먼저 버린다»는 한 원칙의 두 얼굴이다. */
    const dailyRep = new Set();
    { const seen = new Set();
      for (const e of all) { const k = dayKey(e.ts); if (!seen.has(k)) { seen.add(k); dailyRep.add(e.ts); } } }
    const dense = all.filter(e => reclaimable(e) && !dailyRep.has(e.ts)).sort((a, b) => a.ts - b.ts);
    const sparse = all.filter(e => reclaimable(e) && dailyRep.has(e.ts)).sort((a, b) => a.ts - b.ts);
    for (const e of [...dense, ...sparse]) {
      if (total <= BUDGET_BYTES) break;
      keep.delete(e.ts); total -= (e.bytes || 0);
    }
  }
  // ★[A1 치명] 안전판이 예산을 통째로 먹는 극단(되돌리기를 연달아)에서만 도는 최후 안전판.
  //   ⛔초판은 «가장 새것부터» 버렸다. 근거로 「새 안전판은 지금 상태와 거의 같아 재구성 가능」이라
  //   적었는데 ★그 전제가 틀렸다 — 되돌리기 «직후»의 현재 상태는 «되돌아간 옛 버전»이고,
  //   가장 새 안전판은 «교체 직전의 내 작업»이다. 둘은 서로 다르고, 후자는 어디에도 없다.
  //   즉 재구성 «불가능»한 쪽을 맨 먼저 버리고 있었다. 3차 적대검수 재현: 36MB×6회 되돌리기에서
  //   6회차 prepareRestore 가 ok:true 를 낸 «같은 트랜잭션»의 프룬이 그 안전판을 지웠고,
  //   UI 는 그 뒤에도 「직전 상태는 목록 맨 위에 있어요」를 띄웠다. 조용한 거짓말이다.
  //   ⇒ 양 끝을 «둘 다» 지킨다:
  //     ⓐ 가장 «새» 안전판 = 방금 확인창에서 약속한 되돌리기의 취소 지점
  //     ⓑ 가장 «오래된» 안전판 = 그 소동 «이전»으로 가는 유일한 길
  //   버리는 건 중간뿐이다(그 사이 상태들은 대개 목록에 옛 버전으로 «따로» 남아 있다).
  //   ★양 끝밖에 없으면(안전판 2개 이하) 아무것도 안 버린다 — 예산 초과를 감수한다.
  //     약속을 지키는 것이 예산보다 우선이다(P-2: 복구 도구가 데이터를 지우고 시작하지 않는다).
  const safetyOf = () => all.filter(e => keep.has(e.ts) && e.reason === 'pre-restore').sort((a, b) => b.ts - a.ts);
  let pinTotal = safetyOf().reduce((s, e) => s + (e.bytes || 0), 0);
  if (pinTotal > BUDGET_BYTES) {
    const middles = safetyOf().slice(1, -1);   // 새것 먼저 정렬 → 양 끝(최신·최고참)을 잘라낸 «중간»만
    for (const e of middles) {
      if (pinTotal <= BUDGET_BYTES) break;
      keep.delete(e.ts); pinTotal -= (e.bytes || 0);
    }
  }

  const deleted = [], refused = [];
  for (const e of all) {
    if (keep.has(e.ts)) continue;
    // [F3] ★unlink 대상은 «이 모듈이 만든 이름»이어야 한다. 인덱스는 파일이라 손상·조작될 수 있는데,
    //   초판은 entry.file 을 그대로 unlink 해서 '../proj.json' 한 줄이면 원본과 롤링백업이 사라졌다.
    if (!/^\d+\.json$/.test(String(e.file)) || e.file !== `${e.ts}.json`) { refused.push(e.file); keep.add(e.ts); continue; }
    try { fs.unlinkSync(path.join(p.history, e.file)); deleted.push(e.file); } catch (_) {}
  }
  idx.entries = idx.entries.filter(e => keep.has(e.ts)).sort((a, b) => a.ts - b.ts);
  // [F2] 핀 사이드카를 인덱스와 맞춘다 — 지워진/해제된 항목은 사이드카에서도 뺀다.
  try {
    const pins = readPins(projectsDir, projectId);
    const live = new Set(idx.entries.filter(e => e.pinned).map(e => String(e.ts)));
    let dirty = false;
    for (const k of Object.keys(pins)) if (!live.has(k)) { delete pins[k]; dirty = true; }
    if (dirty) writePins(projectsDir, projectId, pins);
  } catch (_) {}
  writeIndex(projectsDir, projectId, idx);
  return { kept: idx.entries.length, deleted, unpinned, ...(refused.length ? { refused } : {}) };
}

/* ── 조회 ────────────────────────────────────────────────────────────────── */
/** 목록 — ★파일을 한 개도 안 읽는다(인덱스가 최신이면). current 가 낡았으면 그때만 proj.json 1회 파싱. */
function listVersions(projectsDir, projectId) {
  const p = pathsFor(projectsDir, projectId);
  // [F7] 인덱스가 이미 있고 미분석分이 남았으면 «이번 열람에서» 예산만큼 더 채운다 — 열 때마다 완성된다.
  //   ⚠️ ensureIndex 가 방금 빌드한 경우엔 다시 부르지 않는다(초판이 그래서 첫 열람에 예산을 두 번 썼다).
  let idx = readIndex(projectsDir, projectId);
  if (!idx) idx = rebuildIndex(projectsDir, projectId);
  else if (idx.entries.some(e => e.pending)) { try { idx = rebuildIndex(projectsDir, projectId); } catch (_) {} }
  let stale = !idx.current;
  if (!stale) {
    try { stale = fs.statSync(p.proj).mtimeMs > (idx.current.projMtimeMs || 0); } catch (_) { stale = false; }
  }
  // ★[C2] proj.json 을 못 읽으면 «옛 current 를 그대로 들고 나가지 않는다».
  //   그러면 프로젝트가 없는데 「지금 섹션 3」이라 표시하고 모든 버전이 「같다」고 답한다 —
  //   거짓 안심이다. 정직한 답은 current:null 이고, 렌더러가 「비교 불가」로 말한다.
  //   ⚠️proj.json 이 깨진 상황이 «이 기능을 여는 바로 그 상황»이라 이 경로가 특히 중요하다.
  let projReadable = true;
  try { projReadable = fs.existsSync(p.proj) && readJsonOrNull(p.proj) !== null; } catch (_) { projReadable = false; }
  if (!projReadable) idx = { ...idx, current: null };

  if (projReadable && stale) {
    // [F7] ★목록은 «사고 직후» 열리는 화면이다. 디스크가 읽기전용이거나 꽉 차서 인덱스를 못 써도
    //   목록이 죽으면 안 된다 — 기록에 실패하면 «메모리에서만» 계산해 돌려준다.
    const cur = readJsonOrNull(p.proj);
    if (cur) {
      try { idx = updateCurrent(projectsDir, projectId, cur); }
      catch (_) {
        const fp = fingerprint(cur);
        let bytes = 0; try { bytes = fs.statSync(p.proj).size; } catch (_2) {}
        idx = { ...idx, current: { ts: Date.now(), bytes, projMtimeMs: 0, name: cur.name || null, counts: fp.counts, secs: fp.secs } };
      }
    }
  }
  const entries = [...idx.entries].sort((a, b) => b.ts - a.ts); // 최신 우선(UI 순서)
  return {
    ok: true,
    current: idx.current,
    entries,
    legacyCount: entries.filter(e => e.canon === 0).length,
    pendingCount: entries.filter(e => e.pending).length, // [F7] 아직 안 읽은 대형 레거시 — UI 가 정직하게 표시
    // [M5] 시각이 «미래»인 버전 — 시계 보정·동기화·백업 복원의 흔적이다. 숨기지 말고 알린다.
    futureCount: entries.filter(e => e.ts > Date.now() + 60000).length,
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
  // ★[R4] `!data` 는 null/0/"" 만 거른다. 초판은 `[]`·숫자·문자열·{pages:"x"} 를 그대로 넘겨서,
  //   호출측이 그걸로 proj.json 을 덮으면 프로젝트가 «형태부터» 깨진다. 「프로젝트로 읽히는가」를 본다.
  if (!isProjectShaped(data)) return { ok: false, reason: 'corrupt' };
  // ★[R6] existsSync 뒤 statSync 는 그 사이 파일이 사라지면 던진다(동기화 폴더·외부 삭제).
  //   조회 함수가 «던지면» 호출측 계약(ok:false)이 깨진다.
  let bytes = 0;
  try { bytes = fs.statSync(full).size; } catch (_) {}
  return { ok: true, ts: parseInt(ts), data, bytes };
}

/* ── U6a: 되돌리기 «안전판» ──────────────────────────────────────────────── */
/**
 * 되돌리기 «직전» 안전판을 박는다. ★실제 교체는 하지 «않는다»(그건 U6b).
 *
 * 이 유닛이 약속하는 문장은 하나다 —
 *   ★「되돌렸는데 잘못 골랐어도 «다시 돌아올 수» 있다」
 * 그래서 순서가 곧 계약이다:
 *   ① 지금 상태를 pre-restore 로 «강제» 스냅샷(간격 게이트 무시·pinned)
 *   ② ①이 실패하면 **아무것도 하지 않고 실패를 돌려준다** — 안전판 없는 파괴는 시작조차 안 한다
 *   ③ 성공해야만 «되돌릴 데이터»를 호출측에 넘긴다
 *
 * @param {object} [opts.currentData] ★에디터에 열려 있으면 «화면의 최신 상태»를 넘겨라.
 *   안 넘기면 디스크(proj.json)를 읽는데, 미저장 편집분이 안전판에서 빠진다 —
 *   그러면 「되돌리기를 취소」해도 그 편집분은 못 돌아온다.
 * @returns {{ok:true, preRestoreTs:number, data:object, ts:number}
 *          |{ok:false, reason:string, error?:string}}
 */
function prepareRestore(projectsDir, projectId, ts, opts = {}) {
  const pid = safeSeg(projectId);
  // ★[R6] 조회가 던지면 호출측은 «실패»가 아니라 «예외»를 받는다 — 계약이 깨진다.
  let target;
  try { target = readVersion(projectsDir, pid, ts); }
  catch (e) { return { ok: false, reason: 'target_unreadable', error: e.message }; }
  if (!target.ok) return { ok: false, reason: target.reason };   // 되돌릴 대상부터 없으면 시작 안 한다

  const p = pathsFor(projectsDir, pid);
  // ★[R7] 안전판을 «어디서» 떴는지 호출측이 알아야 한다 — 디스크에서 떴으면 미저장 편집분이 빠진다.
  const source = opts.currentData ? 'live' : 'disk';
  let current = opts.currentData;
  if (!current) current = readJsonOrNull(p.proj);
  // ★지금 상태를 못 읽으면 «안전판을 못 만든다» → 파괴를 시작하지 않는다.
  //   여기서 「어차피 깨진 파일이니 그냥 덮자」로 가면, 사용자가 되돌리기를 잘못 골랐을 때 갈 곳이 없다.
  if (!current) return { ok: false, reason: 'current_unreadable' };
  // ★[R3] «객체이기만 하면» 통과시키면 `{}` 가 안전판이 된다 — 없느니만 못하다(성공했다고 말하므로).
  if (!isProjectShaped(current)) return { ok: false, reason: 'current_unusable' };

  // ★★[C1] 렌더러의 serializeProject() 는 «신원»을 안 담는다 — id·name·createdAt·marketRef 가 없다
  //   (js/io/save-load.js:378). 그대로 안전판으로 박으면, 나중에 그 안전판으로 되돌렸을 때
  //   proj.json 에 id 가 없어 projects:list 가 그 프로젝트를 «통째로 뺀다»(main.js:850).
  //   = 「교체 취소」가 프로젝트를 갤러리에서 사라지게 한다. 이 유닛이 지킨다는 바로 그 약속이 깨진다.
  //   ⇒ 디스크의 신원 필드로 «보강»해서 안전판을 온전하게 만든다(근본 처방).
  if (source === 'live') {
    const onDisk = readJsonOrNull(p.proj) || {};
    const identity = {};
    for (const k of ['id', 'name', 'createdAt', 'type', 'marketRef']) {
      if (current[k] === undefined && onDisk[k] !== undefined) identity[k] = onDisk[k];
    }
    if (!identity.id && !current.id) identity.id = pid;
    if (Object.keys(identity).length) current = { ...current, ...identity };
  }

  let snap;
  try {
    snap = writeSnapshot(projectsDir, pid, current, {
      reason: 'pre-restore', force: true, now: opts.now || Date.now(),
    });
  } catch (e) { return { ok: false, reason: 'pre_restore_failed', error: e.message }; }
  if (!snap || !snap.ok) return { ok: false, reason: 'pre_restore_failed', error: (snap && (snap.skipped || snap.error)) || 'unknown' };

  // ★안전판이 «핀»으로 박혔는지 확인하고 넘긴다. 핀이 아니면 다음 프룬에 날아가
  //   「되돌리기 취소」 지점이 사라진다 — 약속이 깨진다.
  const e = (readIndex(projectsDir, pid) || { entries: [] }).entries.find(x => x.ts === snap.ts);
  if (!e || e.pinned !== true) return { ok: false, reason: 'pre_restore_not_pinned', error: `ts=${snap.ts}` };
  // ★[R1] 인덱스는 «파생 데이터»다 — 그것만 보고 「핀 됐다」고 하면 인덱스 유실이 곧 취소지점 유실이다.
  //   유도 불가 정보의 정본은 사이드카(pins.json)이므로 «거기 써졌는지»를 본다.
  if (snap.pinsOk !== true) return { ok: false, reason: 'pre_restore_pin_unverified', error: `ts=${snap.ts}` };

  // ★[R5] 되돌릴 «대상»의 이미지가 디스크에 없으면, 되돌아간 화면에서 그림만 빈다 —
  //   파일 헤더가 경고한 「조용히 깨진 복구」다. 막지는 않되(사용자가 텍스트만 원할 수 있다)
  //   호출측이 «경고할 수 있게» 알려준다.
  const missingAssets = [];
  try {
    for (const name of assetsFromRaw(JSON.stringify(target.data))) {
      if (!fs.existsSync(path.join(p.assets, name))) missingAssets.push(name);
    }
  } catch (_) {}

  // ★[C2] 되돌릴 «대상»이 비어 있으면 교체는 곧 «지금 내용을 지우는 것»이다.
  //   ⛔막지는 않는다 — 지금이 비어서 복구하러 온 게 이 기능의 본래 용도라, 막으면 그걸 막는다.
  //   대신 호출측이 확인창에서 «명시»할 수 있게 알린다. 정상 저장경로의 S11 과 같은 눈이되, 판단은 사용자 몫.
  const targetEmpty = isAllCanvasEmpty(target.data);
  const currentEmpty = isAllCanvasEmpty(current);

  return { ok: true, preRestoreTs: snap.ts, ts: target.ts, data: target.data, source,
           ...(targetEmpty ? { targetEmpty: true } : {}),
           ...(currentEmpty ? { currentEmpty: true } : {}),
           ...(missingAssets.length ? { missingAssets } : {}) };
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
  // [F4] ★인덱스를 «정답»으로 믿지 않는다. 인덱스의 assets 는 스냅샷 시점의 집계일 뿐이고,
  //   초판은 그게 캔버스만 훑어서 page.scratchpad[].src 의 goya-asset 참조를 통째로 놓쳤다
  //   (js/scratch-pad.js:96 · js/io/save-load.js:178 — 출시된 기능이다). GC 답을 낼 때는 파일을 직접 읽는다.
  //   인덱스 값은 «추가»로만 합친다(파일이 이미 사라진 과거 항목의 흔적도 보존).
  const idx = readIndex(projectsDir, projectId);
  if (idx) for (const e of idx.entries) for (const a of (e.assets || [])) out.add(a);
  const histDirs = [p.history, path.join(projectsDir, `${p.id}_history`)]; // 구 flat 레이아웃도 폴백이 읽는다
  for (const hd of histDirs) {
    for (const f of slotFiles(hd)) { try { addFromRaw(fs.readFileSync(path.join(hd, f), 'utf8')); } catch (_) {} }
  }
  // 신 레이아웃 + ★구 flat 레이아웃(main.js _resolveProjectJsonPath / _resolveBackupJsonPath 가 폴백한다)
  const others = [p.proj, p.backup,
                  path.join(projectsDir, `${p.id}.json`), path.join(projectsDir, `${p.id}_backup.json`)];
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
  const rawId = id;
  id = safeSeg(id); // [F9] 초판은 여기만 빼먹어 ../ 로 PROJECTS_DIR 밖 JSON 을 후보에 넣을 수 있었다
  const candidates = [];
  const backupPath = typeof resolveBackupPath === 'function' ? resolveBackupPath(rawId) : null;
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
  writeSnapshot, pruneVersions, listVersions, readVersion, prepareRestore,
  listReferencedAssets, loadFallbackCandidates,
  _internal: { safeSeg, pathsFor, canvasStrings, mapCanvas, assetNameFor, slotFiles, dayKey, isValidTs,
               canonOf, assetsFromRaw, fingerprintRaw, readPins, writePins, isProjectShaped, isAllCanvasEmpty },
};
