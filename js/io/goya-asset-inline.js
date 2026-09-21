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

/* ══════════════════════════════════════════════════════════════════════════
   ★클론을 «캔버스로 굽는» 경로 전용 — goya-asset 을 미리 풀어 두고 클론에서 갈아끼운다.
   ──────────────────────────────────────────────────────────────────────────
   왜 필요한가 (2026-09-22 실측, 카드 T-071 «0920b-mosaic-cause»):
     html2canvas 1.4.1 은 이미지를 «자기가 다시 로드»한다. 그 로드 규칙이(vendor 소스
     CacheStorage.loadImage) 이렇다 —
       e = isSameOrigin(src)                                  // goya-asset:// vs file:// → false
       r = !data: && options.useCORS===true && !e             // ⇒ crossOrigin="anonymous" 로 로드
       if (e || allowTaint!==false || data: || blob: || proxy || r) 로드 ; else «아예 안 읽는다»
     ⇒ useCORS:true  → crossOrigin="anonymous" 가 붙고, goya-asset 응답엔 CORS 헤더가 없어
                       «로드 자체»가 실패한다(실측: crossOrigin 없이는 naturalWidth 64 로
                       멀쩡히 뜨는 같은 URL 이 anonymous 를 달면 onerror).
       useCORS:false → 위 조건이 전부 거짓이라 html2canvas 가 그 이미지를 «읽지도 않는다».
     ⇒ 두 축 다 «사진이 빠진 그림»이 나온다. 그런데 사진 자리가 섹션 흰 배경으로 채워지므로
       결과는 «불투명»하다 — 빈 그림 감지(_isSuspiciouslyBlank, 불투명 5% 미만)에 안 걸린다.
       실측(2026-09-22, 실앱 9646·줌 40%): 밑에 깔린 체커보드가 red 2048·blue 2048 인데
       모자이크 캔버스 4×4 = 16픽셀 «전부 255,255,255», 그런데도 captureMosaicSnapshot 은
       true 를 돌려주고 isMosaicCaptured 도 true 였다 ⇒ 사용자 화면엔 «단색 네모».
       («회색 #4a4a4a 안전실패»가 아니다 — 그래서 패널의 「캡처 실패」 표시도 안 떴다.)

   ⇒ 답: html2canvas 가 못 읽는 스킴을 «그에게 주지 않는다». 클론에서만 data: 로 갈아끼운다.
     ⛔라이브 DOM 은 건드리지 않는다 — goya-asset 은 화면에는 «잘 그려진다»(main.js 의
       registerSchemesAsPrivileged). 살아있는 화면을 base64 로 바꾸면 메모리만 먹는다.
   ★실패는 «말하게» 한다 — unresolved>0 을 호출부가 읽고 캡처를 실패로 끝내야 한다.
     조용히 넘기면 위에 적은 «흰 네모가 성공으로 보고되는» 그 결함이 그대로 돌아온다.
   ══════════════════════════════════════════════════════════════════════════ */

// 인라인 style 의 background-image 안에 든 goya-asset URL 들.
function _bgGoyaUrls(el) {
  const raw = (el && el.style && el.style.backgroundImage) || '';
  if (raw.indexOf(GOYA_ASSET_PREFIX) === -1) return [];
  return raw.match(GOYA_ASSET_RE) || [];
}

// scope(엘리먼트 또는 Document) 안에서 goya-asset 을 참조하는 자리들을 훑는다.
function _eachGoyaHost(scope, visit) {
  if (!scope) return;
  const els = [];
  if (scope.nodeType === 1) els.push(scope);
  if (scope.querySelectorAll) els.push(...scope.querySelectorAll('img, video, [style*="background-image"]'));
  for (const el of els) {
    const tag = el.tagName;
    if (tag === 'IMG' || tag === 'VIDEO') {
      const src = el.getAttribute('src') || '';
      if (isGoyaAssetUrl(src)) visit(el, 'src', src);
    }
    for (const u of _bgGoyaUrls(el)) visit(el, 'bg', u);
  }
}

/**
 * ★클론 굽기 전 준비 — scope 안의 goya-asset 참조를 «미리» data URI 로 풀어 둔다.
 * @param {Element|Document} scope  라이브 DOM 범위(읽기만 한다 — 절대 안 고친다)
 * @param {((projectId:string, filename:string)=>Promise<string|null>)|null} [reader]
 * @returns {Promise<{ total:number, unresolved:string[], apply:(cloneRoot:Element|Document)=>number }>}
 *   apply(cloneRoot) 는 클론에서 «풀린 것만» 갈아끼우고 바꾼 자리 수를 돌려준다(동기).
 */
async function prepareGoyaAssetsForClone(scope, reader) {
  const urls = new Set();
  _eachGoyaHost(scope, (_el, _kind, url) => urls.add(url));
  const map = new Map();
  const read = (typeof reader === 'function') ? reader : makeElectronAssetReader();
  await Promise.all([...urls].map(async (url) => {
    let data = null;
    const parsed = parseGoyaAssetUrl(url);
    if (parsed && read) {
      try { data = await read(parsed.projectId, parsed.filename); }
      catch (err) { console.warn('[goya-asset-inline] 클론용 읽기 실패:', url, err); }
    }
    if (typeof data === 'string' && data.startsWith('data:')) map.set(url, data);
  }));
  const unresolved = [...urls].filter((u) => !map.has(u));
  return {
    total: urls.size,
    unresolved,
    apply(cloneRoot) {
      let n = 0;
      _eachGoyaHost(cloneRoot, (el, kind, url) => {
        const data = map.get(url);
        if (!data) return;
        if (kind === 'src') { el.setAttribute('src', data); n++; return; }
        // background-image — 같은 선언 안의 다른 레이어(그라데이션 등)는 그대로 둔다.
        const before = el.style.backgroundImage;
        const after = before.split(url).join(data);
        if (after !== before) { el.style.backgroundImage = after; n++; }
      });
      return n;
    },
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
  goyaAssetToDrawableSrc,
  inlineGoyaAssetsInJSON,
  /* ⚠️이 이름은 «goyaAssetToDrawableSrc 와 inlineGoyaAssetsInJSON 사이»에 끼우지 마라 —
     tests/unit/goya-asset-family.test.js ⓑ-5 가 둘의 «인접»을 정규식으로 잰다. */
  prepareGoyaAssetsForClone,
};
