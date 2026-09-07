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

/**
 * ★«마지막 문» — 이미지 src 하나를 «캔버스가 오염되지 않는» 형태로 되돌린다.
 *
 * 왜 필요한가 (결함군 — 한 건이 아니다):
 *   v0.8.0 이미지 외부화 이후 이미지 src 는 `goya-asset://<projectId>/<hash>.<ext>` 다.
 *   렌더러는 file:// origin 이라 이 커스텀 스킴은 **cross-origin** 이고, 그래서
 *     · `<canvas>` 에 그리면 오염 → `toDataURL()`/`toBlob()` 이 SecurityError 를 던지고
 *     · 서비스의 base64 파서(`/^data:([^;]+);base64,(.+)$/`)는 «거절»한다.
 *   이 병이 발견될 때마다 한 자리씩 고쳐 왔다(슬라이스·색보정·AI 텍스트채우기·AI 이미지생성).
 *   ⇒ 새 변환 로직을 또 만들지 말고 «이 문 하나»를 태워라.
 *
 * ★★CSS 렌더(`el.style.backgroundImage = url(...)`)에는 «쓰지 마라».
 *   main.js:7 의 registerSchemesAsPrivileged({ standard, secure, supportFetchAPI }) 덕분에
 *   goya-asset 은 **화면에 잘 그려진다**. 캔버스/네트워크 전송만 문제다.
 *   무늬가 같다고 처분이 같지 않다 — 판정은 한 건씩.
 *
 * ★실패 시맨틱은 «null» 이다 — 원본으로 조용히 갈아끼우지 않는다.
 *   조용히 원본을 흘려보내면 호출부가 「빠진 줄도 모르고」 결과를 낸다(가장 나쁜 실패).
 *   호출부는 null 을 받으면 그 참조를 «빼고» 사용자에게 보이는 신호(showToast)를 남겨라.
 *   (⛔`?? alert(` 금지 — showToast 가 undefined 를 반환해 네이티브 alert 이 렌더러를 얼린다)
 *
 * @param {string} src   임의의 이미지 src. data:/http(s)/blob: 등 비-goya 는 «그대로» 통과한다.
 * @param {((projectId:string, filename:string) => Promise<string|null>)|null} [reader]
 *        주입 안 하면 makeElectronAssetReader() (웹=IPC 없음이면 null → 변환 실패).
 * @returns {Promise<string|null>} 그릴 수 있는 src, 또는 ★실패 null.
 */
async function goyaAssetToDrawableSrc(src, reader) {
  const s = (typeof src === 'string') ? src : '';
  if (!s) return null;
  if (!isGoyaAssetUrl(s)) return s;              // data:/http(s)/blob: — 손대지 않는다
  const parsed = parseGoyaAssetUrl(s);
  if (!parsed) return null;
  const read = (typeof reader === 'function') ? reader : makeElectronAssetReader();
  if (!read) return null;                        // 웹(IPC 미가용) — «못 읽었다»고 말한다
  try {
    const dataUri = await read(parsed.projectId, parsed.filename);
    return (typeof dataUri === 'string' && dataUri.startsWith('data:')) ? dataUri : null;
  } catch (err) {
    console.warn('[goya-asset-inline] goyaAssetToDrawableSrc 실패:', s, err);
    return null;
  }
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
  goyaAssetToDrawableSrc,
  inlineGoyaAssetsInJSON,
};
