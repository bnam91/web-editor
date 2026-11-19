/* pixabay.js — t13A-06(현빈 GO 261119 · 사용자 키 입력) 무료 이미지 검색의 렌더러 쪽 순수 셈(DOM 0 · 단위 tests/unit/pixabay.test.mjs).
 *   ★키는 여기 없다 — 사용자 본인 키는 main/pixabay.js 가 암호 보관하고 검색도 거기서 붙여 보낸다(렌더러엔 ••••끝4 만). 이 파일 = 조건·캐시·응답 거르기만.
 *   캐시 = Pixabay 약관 «requests must be cached for 24 hours» — 같은 검색(키 뺀 조건)은 24시간 저장 응답 · 개수 상한(오래된 것부터 버림).
 *   근거 handoff/RESEARCH-t13A-06-*.md(Pixabay docs 인용). */

export const PIXABAY_API = 'https://pixabay.com/api/';
export const CACHE_SLOT = 'goditor.pixabayCache';
export const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
export const CACHE_MAX = 60;

/** 키 꼴 미리 보기(붙여넣기 칸 · 공백 걷음 · main 이 같은 꼴로 다시 검사) — 아니면 '' */
export function cleanKey(k) {
  const v = String(k ?? '').trim();
  return /^[0-9A-Za-z-]{10,64}$/.test(v) ? v : '';
}

/** 검색 조건 → 정규화(키 없음). q 100자 · page 1~20 · per_page 20~80 · 사진만(범위 = 현빈 «사진») · safesearch 켬 */
export function searchParams(q, { page = 1, perPage = 40 } = {}) {
  return {
    q: String(q ?? '').trim().slice(0, 100),
    image_type: 'photo',
    safesearch: 'true',
    lang: 'ko',
    page: Math.min(20, Math.max(1, Math.round(+page) || 1)),
    per_page: Math.min(80, Math.max(20, Math.round(+perPage) || 40)),
  };
}

/** 캐시 열쇠 — 키 없는 조건만(키는 렌더러에 없다) */
export const cacheKey = (p) => ['q', 'image_type', 'safesearch', 'lang', 'page', 'per_page'].map((k) => `${k}=${encodeURIComponent(p[k])}`).join('&');

/** 캐시 읽기 — 24시간 안 · 없으면 null. store = { getItem, setItem }(localStorage 꼴) · now 주입(검사) */
export function readCache(store, p, now = Date.now()) {
  try {
    const all = JSON.parse(store.getItem(CACHE_SLOT) || '{}');
    const hit = all[cacheKey(p)];
    return hit && now - hit.t < CACHE_TTL_MS ? hit.data : null;
  } catch (_) { return null; }
}
/** 캐시 쓰기 — 만료 걷고 상한 넘으면 오래된 것부터 버림 */
export function writeCache(store, p, data, now = Date.now()) {
  try {
    const all = JSON.parse(store.getItem(CACHE_SLOT) || '{}');
    for (const k of Object.keys(all)) if (!(now - all[k].t < CACHE_TTL_MS)) delete all[k];
    all[cacheKey(p)] = { t: now, data };
    const keys = Object.keys(all).sort((a, b) => all[a].t - all[b].t);
    while (keys.length > CACHE_MAX) delete all[keys.shift()];
    store.setItem(CACHE_SLOT, JSON.stringify(all));
  } catch (_) { /* 저장 실패 = 캐시 없이(검색은 된다) */ }
}

/** 응답 → 그릴 칸(필요한 것만 · 주소는 https pixabay 만 · 숫자 검사). 꼴이 틀리면 [] */
export function pickHits(json) {
  const ok = (u) => typeof u === 'string' && /^https:\/\/([a-z0-9-]+\.)?pixabay\.com\//i.test(u);
  return (Array.isArray(json?.hits) ? json.hits : []).filter((h) => h && ok(h.webformatURL) && ok(h.largeImageURL)).map((h) => ({
    id: Number(h.id) || 0, preview: h.webformatURL, large: h.largeImageURL, page: ok(h.pageURL) ? h.pageURL : '',
    user: String(h.user || '').slice(0, 60), tags: String(h.tags || '').slice(0, 120),
    w: Math.max(1, Number(h.imageWidth) || 1), h: Math.max(1, Number(h.imageHeight) || 1),
  }));
}
