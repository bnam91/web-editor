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

/**
 * canvas HTML 문자열 하나를 외부화. 이미 goya-asset://면 건드리지 않음.
 * @param {string} html
 * @param {string} projectId
 * @param {Map<string,string>} cache  data:URI → goya-asset:// URL (호출자 공유, 페이지 간 dedup)
 * @returns {Promise<string>} 외부화된 HTML (data:image 0건)
 */
async function externalizeCanvasHtml(html, projectId, cache) {
  if (typeof html !== 'string' || html.indexOf('data:image') === -1) return html;
  if (!projectId || !window.electronAPI?.assetsSaveCanvasImage) return html; // 웹/미가용 → no-op

  // 1) 고유 data:URI 수집
  const uris = new Set();
  let m;
  DATA_URI_RE.lastIndex = 0;
  while ((m = DATA_URI_RE.exec(html)) !== null) uris.add(m[0]);
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
 * 프로젝트 스냅샷(직렬화된 JSON 객체)의 모든 page.canvas를 외부화.
 * 저장 chokepoint(_doSaveProjectToFile)에서 1회 호출.
 * @param {object} data  { version, pages:[{canvas}], ... }
 * @param {string} projectId
 * @returns {Promise<object>} 동일 객체(in-place canvas 치환). data:image 없으면 즉시 반환.
 */
async function externalizeProjectData(data, projectId) {
  if (!data || !Array.isArray(data.pages) || !projectId) return data;
  if (!window.electronAPI?.assetsSaveCanvasImage) return data;
  const cache = new Map(); // 페이지 간 dedup
  for (const page of data.pages) {
    if (page && typeof page.canvas === 'string' && page.canvas.indexOf('data:image') !== -1) {
      page.canvas = await externalizeCanvasHtml(page.canvas, projectId, cache);
    }
  }
  return data;
}

/**
 * 명시적 "이미지 최적화" 액션 — 현재 프로젝트의 모든 캔버스 base64를 즉시 외부화하고 저장.
 * 메뉴/버튼에서 호출. activeProjectId·serializeProject·saveProjectToFile는 save-load.js가 window 노출.
 * @returns {Promise<{ok:boolean, before?:number, after?:number, error?:string}>}
 */
async function optimizeProjectImages() {
  try {
    if (!window.serializeProject || !window.saveProjectToFile) {
      return { ok: false, error: 'serialize/save 미가용' };
    }
    const snap = window.serializeProject();
    const before = snap.length;
    // saveProjectToFile가 _doSaveProjectToFile → externalizeProjectData를 경유하므로 저장만 트리거.
    const r = await window.saveProjectToFile(snap, { skipThumbnail: true });
    return { ok: !r || r.ok !== false, before };
  } catch (e) {
    return { ok: false, error: e && e.message };
  }
}

window.externalizeCanvasHtml = externalizeCanvasHtml;
window.externalizeProjectData = externalizeProjectData;
window.optimizeProjectImages = optimizeProjectImages;

export { externalizeCanvasHtml, externalizeProjectData, optimizeProjectImages };
