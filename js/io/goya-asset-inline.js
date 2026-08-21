/* ── goya-asset:// 공용 헬퍼 + JSON 재인라인 ──────────────────────────
 * v0.8.0 이미지 외부화 이후 캔버스 이미지는 `goya-asset://<projectId>/<hash>.<ext>`
 * (Electron 커스텀 프로토콜) 참조다. 앱 밖(내보낸 HTML·Figma 플러그인)은 이 스킴을
 * 해석 못 하므로 export 직전에 base64 data: URI로 되돌려야 한다.
 *
 * - URL 판별/파싱 헬퍼는 export-html.js(DOM 기반 inlineGoyaAssets)와 공유한다.
 * - inlineGoyaAssetsInJSON: 이미 빌드된 Figma export JSON(객체)을 순회하며
 *   goya-asset URL 문자열을 data URI로 치환하는 «후처리» 단계. 빌드 함수
 *   (buildFigmaExportJSON)는 동기 DOM 순회라 async로 바꾸지 않고 뒤에 붙인다.
 * - ★순수 함수: window/IPC 의존 0. 읽기는 reader 주입
 *   `async (projectId, filename) => dataUri | null` — node:test로 검증 가능.
 * - 실패(reader null/throw)는 원본 URL을 유지하고 unresolvedAssets로 센다(조용히 삼키지 않음).
 * ───────────────────────────────────────────────────────────────────── */

const GOYA_ASSET_PREFIX = 'goya-asset://';
// 문자열 안의 goya-asset URL (raw 또는 url("...") 안쪽). 따옴표·괄호·공백에서 끝난다.
const GOYA_ASSET_RE = /goya-asset:\/\/[^"'()\s]+/g;

function isGoyaAssetUrl(url) {
  return typeof url === 'string' && url.indexOf(GOYA_ASSET_PREFIX) !== -1;
}

// goya-asset://<projectId>/<filename> → { projectId, filename } | null
function parseGoyaAssetUrl(url) {
  const m = /^goya-asset:\/\/([^/]+)\/(.+)$/.exec(url || '');
  if (!m) return null;
  return { projectId: decodeURIComponent(m[1]), filename: decodeURIComponent(m[2]) };
}

// Electron IPC 기반 reader — preload `assetsReadAsDataUri` 없으면(웹) null 반환.
// main.js 'assets:readAsDataUri' 핸들러가 디스크에서 직접 읽어 { ok, dataUri } 를 돌려준다.
function makeElectronAssetReader() {
  const api = (typeof window !== 'undefined') ? window.electronAPI : null;
  if (!api || typeof api.assetsReadAsDataUri !== 'function') return null;
  return async (projectId, filename) => {
    const res = await api.assetsReadAsDataUri({ projectId, filename });
    return (res && res.ok && res.dataUri) ? res.dataUri : null;
  };
}

// JSON 트리의 문자열 값을 방문 — 객체/배열 재귀. visit(str) 반환값으로 치환.
function _walkStrings(node, visit) {
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) {
      const v = node[i];
      if (typeof v === 'string') { const r = visit(v); if (r !== v) node[i] = r; }
      else if (v && typeof v === 'object') _walkStrings(v, visit);
    }
    return;
  }
  if (node && typeof node === 'object') {
    for (const k of Object.keys(node)) {
      const v = node[k];
      if (typeof v === 'string') { const r = visit(v); if (r !== v) node[k] = r; }
      else if (v && typeof v === 'object') _walkStrings(v, visit);
    }
  }
}

/**
 * Figma export JSON의 goya-asset:// 참조를 data URI로 재인라인(제자리 변경).
 * @param {object} root   buildFigmaExportJSON 결과(또는 임의 JSON 객체)
 * @param {((projectId:string, filename:string) => Promise<string|null>)|null} reader
 *        null이면(IPC 없음=웹) 아무것도 읽지 않고 전부 unresolved로 센다.
 * @returns {Promise<{ json, totalAssets, resolvedAssets, unresolvedAssets, unresolvedUrls }>}
 *   같은 URL은 1회만 읽는다(고유 URL 기준 카운트). data:·http(s) 문자열은 건드리지 않는다.
 */
async function inlineGoyaAssetsInJSON(root, reader) {
  // 1) 고유 goya-asset URL 수집 (동기 순회)
  const urls = new Set();
  _walkStrings(root, (s) => {
    if (isGoyaAssetUrl(s)) for (const m of s.match(GOYA_ASSET_RE) || []) urls.add(m);
    return s;
  });

  // 2) URL → dataUri 맵 (중복 1회, 병렬). 실패·파싱불가·reader 없음 → null
  const map = new Map();
  await Promise.all([...urls].map(async (url) => {
    let data = null;
    const parsed = parseGoyaAssetUrl(url);
    if (parsed && typeof reader === 'function') {
      try { data = await reader(parsed.projectId, parsed.filename); }
      catch (err) { console.warn('[goya-asset-inline] 읽기 실패, URL 유지:', url, err); }
    }
    map.set(url, (typeof data === 'string' && data.startsWith('data:')) ? data : null);
  }));

  // 3) 치환 — 해결된 URL만 바꾸고 나머지는 원본 유지
  _walkStrings(root, (s) => {
    if (!isGoyaAssetUrl(s)) return s;
    return s.replace(GOYA_ASSET_RE, (m) => map.get(m) || m);
  });

  const unresolvedUrls = [...map.entries()].filter(([, v]) => !v).map(([k]) => k);
  return {
    json: root,
    totalAssets: urls.size,
    resolvedAssets: urls.size - unresolvedUrls.length,
    unresolvedAssets: unresolvedUrls.length,
    unresolvedUrls,
  };
}

export {
  GOYA_ASSET_PREFIX,
  isGoyaAssetUrl,
  parseGoyaAssetUrl,
  makeElectronAssetReader,
  inlineGoyaAssetsInJSON,
};
