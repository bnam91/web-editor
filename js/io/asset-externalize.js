/* ── 캔버스 이미지 외부화 (image externalization) ──
 *
 * 문제: pages[].canvas HTML에 인라인 base64(data:image)가 박혀 proj.json이 수십 MB로 비대해짐.
 * 해결: 직렬화된 canvas HTML에서 data:image URI를 추출 → IPC(assets:saveCanvasImage)로
 *       proj_<id>/assets/<contenthash>.<ext>에 분리 저장(자동 dedup) → HTML은 goya-asset:// URL로 참조.
 *
 * carrier(실측): data-img-src="data:..", data-bg-img="data:..", <img src="data:..">,
 *               인라인 style의 url(data:..). 모두 처리.
 *
 * 하위호환: 저장 경로에서만 동작. 구 base64 프로젝트는 로드 시 변환 없이 그대로 렌더되고,
 *          첫 정상 저장 시 점진 외부화된다. IPC/Electron 미가용(웹) 시 그대로 통과(no-op).
 *
 * 동기 직렬화(getSerializedCanvas)는 건드리지 않는다 — 외부화는 async 저장 chokepoint에서만.
 */

// base64 data:image URI만 매칭. base64 알파벳([A-Za-z0-9+/=])은 따옴표/괄호/공백을 포함하지 않아
// 경계가 안전. 비base64 인라인 SVG(data:image/svg+xml,<svg ...>)는 공백·따옴표·괄호를 포함해
// 경계가 모호하고 보통 작은 아이콘이라 bloat 원인이 아니므로 외부화 대상에서 제외(원본 유지).
const DATA_URI_RE = /data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/]+=*/g;

/* ── 정책 게이팅: 로드 베이스라인 (load baseline) ──
 * 현빈 정책: 저장 시 자동 점진 외부화는 기본 OFF. 신규 이미지만 자동 외부화하고,
 * 기존(로드 시점에 이미 존재하던) base64 대량변환은 명시 액션(optimizeProjectImages)에서만.
 *
 * applyProjectData(유일 로드 chokepoint)에서 로드된 canvas의 모든 base64 지문을 projectId별로
 * 기록한다. 저장 시 new-only 모드는 이 베이스라인에 없는 base64(=이번 세션 신규)만 외부화한다.
 * 베이스라인 기록 자체는 아무 것도 변환하지 않으므로 기존 프로젝트 로드는 무조건 비파괴.
 */
const _baselineByProject = new Map(); // projectId → Set<fingerprint>

// 지문: base64 전체를 보관하면(레거시 85MB) 메모리 폭증 → length + 말미 24자로 충분히 유일.
function _fp(uri) { return uri.length + ':' + uri.slice(-24); }

/**
 * 로드 시점 base64 베이스라인 기록 — applyProjectData에서 1회 호출. 비파괴(읽기만).
 * @param {object} data  { pages:[{canvas}] } (v2) 또는 { canvas } (v1)
 * @param {string} projectId
 */
function recordExternalizeBaseline(data, projectId) {
  if (!projectId || !data) return;
  try {
    const fps = new Set();
    const scan = (html) => {
      if (typeof html !== 'string' || html.indexOf('data:image') === -1) return;
      DATA_URI_RE.lastIndex = 0;
      let m;
      while ((m = DATA_URI_RE.exec(html)) !== null) fps.add(_fp(m[0]));
    };
    if (Array.isArray(data.pages)) data.pages.forEach(p => p && scan(p.canvas));
    else scan(data.canvas); // v1
    _baselineByProject.set(projectId, fps);
  } catch (_) { /* 실패 시 베이스라인 미기록 → 저장 시 안전하게 외부화 보류 */ }
}

/**
 * canvas HTML 문자열 하나를 외부화. 이미 goya-asset://면 건드리지 않음.
 * @param {string} html
 * @param {string} projectId
 * @param {Map<string,string>} cache  data:URI → goya-asset:// URL (호출자 공유, 페이지 간 dedup)
 * @param {?(uri:string)=>boolean} accept  외부화 대상 필터(null=전부). 거부된 URI는 원본 base64 유지.
 * @returns {Promise<string>} 외부화된 HTML
 */
async function externalizeCanvasHtml(html, projectId, cache, accept) {
  if (typeof html !== 'string' || html.indexOf('data:image') === -1) return html;
  if (!projectId || !window.electronAPI?.assetsSaveCanvasImage) return html; // 웹/미가용 → no-op

  // 1) 고유 data:URI 수집 — accept가 거부한 URI는 애초에 수집하지 않아 원본 그대로 둠
  const uris = new Set();
  let m;
  DATA_URI_RE.lastIndex = 0;
  while ((m = DATA_URI_RE.exec(html)) !== null) {
    if (!accept || accept(m[0])) uris.add(m[0]);
  }
  if (uris.size === 0) return html;

  // 2) 각 고유 URI를 asset으로 저장 → URL 매핑 (cache로 중복 IPC 차단)
  for (const uri of uris) {
    if (cache.has(uri)) continue;
    const parsed = _parseDataUri(uri);
    if (!parsed) { cache.set(uri, uri); continue; } // 파싱 실패 → 원본 유지(안전)
    try {
      const res = await window.electronAPI.assetsSaveCanvasImage({
        projectId, b64: parsed.b64, mime: parsed.mime,
      });
      cache.set(uri, (res && res.ok && res.url) ? res.url : uri);
    } catch (_) {
      cache.set(uri, uri); // 저장 실패 → 원본 base64 유지(데이터 손실 없음)
    }
  }

  // 3) 치환 — 단순 문자열 replace (URI는 고유 토큰이라 안전). 긴 것부터 치환해 부분일치 방지.
  let out = html;
  const sorted = [...uris].sort((a, b) => b.length - a.length);
  for (const uri of sorted) {
    const url = cache.get(uri);
    if (!url || url === uri) continue;
    out = out.split(uri).join(url);
  }
  return out;
}

/** data:image/<mime>;base64,<data> 파싱 → { mime, b64 }. (DATA_URI_RE가 base64만 매칭) */
function _parseDataUri(uri) {
  const comma = uri.indexOf(',');
  if (comma === -1) return null;
  const header = uri.slice(5, comma); // image/png;base64
  const semi = header.indexOf(';');
  const mime = semi === -1 ? header : header.slice(0, semi);
  return { mime, b64: uri.slice(comma + 1) };
}

/**
 * 프로젝트 스냅샷(직렬화된 JSON 객체)의 page.canvas를 외부화.
 * 저장 chokepoint(_doSaveProjectToFile)에서 1회 호출.
 *
 * 정책 게이팅:
 *   opts.all=false (기본 autosave) → new-only: 로드 베이스라인에 없는 base64(=이번 세션 신규)만 외부화.
 *                                    기존 base64는 그대로 둠(비파괴). 베이스라인 미기록 시 아무 것도 안 함.
 *   opts.all=true  (명시 최적화 / 레거시 플래그 ON) → 모든 base64 외부화(대량변환).
 * @param {object} data  { version, pages:[{canvas}], ... }
 * @param {string} projectId
 * @param {{all?:boolean}} [opts]
 * @returns {Promise<object>} 동일 객체(in-place canvas 치환). data:image 없으면 즉시 반환.
 */
async function externalizeProjectData(data, projectId, opts = {}) {
  if (!data || !Array.isArray(data.pages) || !projectId) return data;
  if (!window.electronAPI?.assetsSaveCanvasImage) return data;

  let accept; // null = 전부 외부화
  if (opts.all === true) {
    accept = null; // 명시 액션: 대량변환
  } else {
    // new-only: 베이스라인(로드 시점 base64)에 없는 것만 = 이번 세션 신규.
    const baseline = _baselineByProject.get(projectId);
    if (!baseline) accept = () => false;                 // 베이스라인 모름 → 안전하게 외부화 보류
    else           accept = (uri) => !baseline.has(_fp(uri)); // 신규만 통과
  }

  const cache = new Map(); // 페이지 간 dedup
  for (const page of data.pages) {
    if (page && typeof page.canvas === 'string' && page.canvas.indexOf('data:image') !== -1) {
      page.canvas = await externalizeCanvasHtml(page.canvas, projectId, cache, accept);
    }
  }
  return data;
}

/** 프로젝트 객체(또는 직렬화 문자열)의 base64 data:image 개수 합산 — 검증용. */
function _countBase64(data) {
  try {
    const d = typeof data === 'string' ? JSON.parse(data) : data;
    let n = 0;
    const scan = (html) => {
      if (typeof html !== 'string') return;
      DATA_URI_RE.lastIndex = 0;
      while (DATA_URI_RE.exec(html) !== null) n++;
    };
    if (Array.isArray(d?.pages)) d.pages.forEach(p => p && scan(p.canvas));
    else scan(d?.canvas);
    return n;
  } catch { return -1; }
}

/** 프로젝트 객체의 section-block 수 합산 — 구조 보존 검증용. */
function _countSections(data) {
  try {
    const d = typeof data === 'string' ? JSON.parse(data) : data;
    let n = 0;
    const scan = (html) => { if (typeof html === 'string') n += (html.match(/section-block/g) || []).length; };
    if (Array.isArray(d?.pages)) d.pages.forEach(p => p && scan(p.canvas));
    else scan(d?.canvas);
    return n;
  } catch { return -1; }
}

/**
 * 명시적 "이미지 최적화" 액션 — 현재 프로젝트의 **모든** 캔버스 base64를 즉시 외부화(대량변환)하고
 * 저장 후 디스크 재로드로 검증. 메뉴/버튼/콘솔(window.optimizeProjectImages())에서 호출.
 * 백업은 main `projects:save`가 자동(proj_backup.json + history slot)하므로 별도 백업 불필요.
 * @returns {Promise<{ok:boolean, before?:number, after?:number, base64Before?:number, base64After?:number, error?:string}>}
 */
async function optimizeProjectImages() {
  try {
    if (!window.serializeProject || !window.saveProjectToFile) {
      return { ok: false, error: 'serialize/save 미가용' };
    }
    if (!window.electronAPI?.assetsSaveCanvasImage) {
      return { ok: false, error: 'Electron 전용 기능 (웹에서는 외부화 불가)' };
    }
    const projectId = window.activeProjectId;
    if (!projectId) return { ok: false, error: 'activeProjectId 없음' };

    const snap = window.serializeProject();
    const before = (typeof snap === 'string' ? snap : JSON.stringify(snap)).length;
    const base64Before = _countBase64(snap);
    const secBefore = _countSections(snap);

    // externalizeAll:true → _doSaveProjectToFile가 all-mode로 전부 외부화. 백업은 main이 자동.
    const r = await window.saveProjectToFile(snap, { externalizeAll: true, skipThumbnail: true });
    if (r && r.ok === false) return { ok: false, error: r.reason || '저장 실패', before, base64Before };

    // 검증: 디스크에서 재로드 → 섹션 수 보존 + base64 감소 확인
    let fresh = null;
    try { fresh = await window.electronAPI.loadProject(projectId); } catch (_) {}
    if (!fresh) return { ok: false, error: '검증 재로드 실패(저장은 완료됨)', before, base64Before };
    const after = JSON.stringify(fresh).length;
    const base64After = _countBase64(fresh);
    const secAfter = _countSections(fresh);
    if (secAfter < secBefore) {
      return { ok: false, error: `섹션 수 감소 ${secBefore}→${secAfter}`, before, after, base64Before, base64After };
    }
    return { ok: true, before, after, base64Before, base64After, sections: secAfter };
  } catch (e) {
    return { ok: false, error: e && e.message };
  }
}

window.externalizeCanvasHtml = externalizeCanvasHtml;
window.externalizeProjectData = externalizeProjectData;
window.recordExternalizeBaseline = recordExternalizeBaseline;
window.optimizeProjectImages = optimizeProjectImages;

export { externalizeCanvasHtml, externalizeProjectData, recordExternalizeBaseline, optimizeProjectImages };
