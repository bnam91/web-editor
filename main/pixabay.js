/* ═══════════════════════════════════════════════════════════════════════════
   pixabay.js — t13A-06 무료 이미지(현빈 GO 261119 · 사용자 본인 키 · 서버 0)
   ───────────────────────────────────────────────────────────────────────────
   ★키 = Higgsfield 키와 같은 보관(main/higgsfield-key.js 한 벌 재사용 · userData/pixabay.key.bin · safeStorage 암호 바이트만 · 평문 폴백 없음).
   ★렌더러엔 «있나 + ••••끝4» 만 간다 — 검색은 여기(main)서 키를 붙여 보낸다 ⇒ 키는 렌더러 메모리·localStorage·proj.json·내보내기·로그 어디에도 안 간다.
   ★반환·오류는 사유 코드만(요청 주소·키를 안 싣는다) · 콘솔에 주소를 안 찍는다.
   그림 받기 = 렌더러 CORS 를 피해 여기서(https · pixabay.com 과 그 하위만 · 넘겨받은 뒤 주소도 다시 검사 · image/jpeg·png·webp · 15MB 상한).
   단위: tests/unit/pixabay-main.test.js(가짜 safeStorage·가짜 net · 실키·실호출 0).
═══════════════════════════════════════════════════════════════════════════ */
'use strict';

const { createHiggsfieldKey } = require('./higgsfield-key.js');

const API = 'https://pixabay.com/api/';
const KEY_RE = /^[0-9A-Za-z-]{10,64}$/;
const IMG_MAX = 15 * 1024 * 1024;
const okHost = (h) => /(^|\.)pixabay\.com$/i.test(String(h || ''));
/* 보안 리뷰 261120(지디 · 치명 0 · 다섯 고침):
   ① 디스크 HTTP 캐시(userData/Cache)에 «키 든 주소»가 남지 않게 cache:'no-store' · 쿠키 0(credentials omit)
   ② 넘겨주기(redirect) = 'error' — main.js _fetchWithTimeout 의 SSRF 가드 관례(중간 홉·http 강등을 따로 셀 일 없음) · 뒤에 박아 덮지 못하게
   ④ 시간 상한 — 검색 10초(API 는 보통 1초 안 · 넉넉히) · 그림 30초(15MB 를 약 4Mbps 로 받는 시간) */
const SEARCH_MS = 10000, IMG_MS = 30000;
const _init = (ms) => ({ cache: 'no-store', credentials: 'omit', redirect: 'error', signal: AbortSignal.timeout(ms) });
const _why = (e) => (e && (e.name === 'TimeoutError' || e.name === 'AbortError') ? 'timeout' : 'network');
/** ⑤ 첫 바이트(매직)로 실제 꼴 — jpeg FF D8 FF · png 89 50 4E 47 0D 0A 1A 0A · webp RIFF....WEBP. 모르면 '' */
function sniffImage(b) {
  if (!b || b.length < 12) return '';
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return 'image/png';
  if (b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP') return 'image/webp';
  return '';
}
/** ③ 상한 넘으면 «받는 도중» 끊는다(본문 흐름이 없으면 통째 받은 뒤 잰다 — 가짜 net·옛 판). 넘으면 null */
async function readCapped(res, max) {
  const len = Number(res.headers?.get?.('content-length'));
  if (Number.isFinite(len) && len > max) return null;
  const rd = res.body && typeof res.body.getReader === 'function' ? res.body.getReader() : null;
  if (!rd) { const b = Buffer.from(await res.arrayBuffer()); return b.length > max ? null : b; }
  const parts = []; let n = 0;
  for (;;) {
    const { done, value } = await rd.read();
    if (done) break;
    n += value.length;
    if (n > max) { try { await rd.cancel(); } catch (_) {} return null; }
    parts.push(Buffer.from(value));
  }
  return Buffer.concat(parts);
}

/** 검색 조건 정규화(렌더러 js/util/pixabay.js searchParams 와 같은 조임 · 여기서 다시 — 렌더러 값을 믿지 않는다) */
function cleanParams(p) {
  const n = (v, lo, hi, d) => Math.min(hi, Math.max(lo, Math.round(+v) || d));
  return { q: String(p?.q ?? '').trim().slice(0, 100), image_type: 'photo', safesearch: 'true', lang: 'ko', page: n(p?.page, 1, 20, 1), per_page: n(p?.per_page, 20, 80, 40) };
}

/**
 * @param {{ safeStorage, fs, filePath, net: { fetch }, shell: { openExternal } }} deps — main.js 주입(검사 = 가짜)
 */
function createPixabay({ safeStorage, fs, filePath, net, shell }) {
  const store = createHiggsfieldKey({ safeStorage, fs, filePath });   // set·status·clear(같은 파일 꼴 · 같은 «끝4» 규칙)
  function readKey() {
    try { if (!safeStorage.isEncryptionAvailable()) return ''; return safeStorage.decryptString(fs.readFileSync(filePath)) || ''; } catch (_) { return ''; }
  }
  function setKey(raw) {
    const k = typeof raw === 'string' ? raw.trim() : '';
    if (!KEY_RE.test(k)) return { ok: false, reason: 'bad_format' };
    return store.set(k);
  }
  async function search(p) {
    const key = readKey();
    if (!key) return { ok: false, reason: 'no_key' };
    const q = cleanParams(p);
    if (!q.q) return { ok: false, reason: 'empty_query' };
    const url = API + '?key=' + encodeURIComponent(key) + '&' + Object.entries(q).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
    let res;
    try { res = await net.fetch(url, _init(SEARCH_MS)); } catch (e) { return { ok: false, reason: _why(e) }; }
    if (res.status === 429) return { ok: false, reason: 'rate_limited' };
    if (res.status === 400 || res.status === 401 || res.status === 403) return { ok: false, reason: 'bad_key' };
    if (!res.ok) return { ok: false, reason: 'http_' + res.status };
    try { return { ok: true, data: await res.json() }; } catch (_) { return { ok: false, reason: 'bad_json' }; }
  }
  async function fetchImage(raw) {
    let u;
    try { u = new URL(String(raw || '')); } catch (_) { return { ok: false, reason: 'bad_url' }; }
    if (u.protocol !== 'https:' || !okHost(u.hostname)) return { ok: false, reason: 'blocked' };
    let res;
    try { res = await net.fetch(u.toString(), _init(IMG_MS)); } catch (e) { return { ok: false, reason: _why(e) }; }
    /* 끝 주소 — redirect:'error' 라 넘겨받을 일이 없지만 «https + pixabay» 를 한 번 더(가짜 net·바뀐 동작 대비) */
    try { if (res.url) { const f = new URL(res.url); if (f.protocol !== 'https:' || !okHost(f.hostname)) return { ok: false, reason: 'blocked' }; } } catch (_) { return { ok: false, reason: 'blocked' }; }
    if (!res.ok) return { ok: false, reason: 'http_' + res.status };
    const type = String(res.headers?.get?.('content-type') || '').split(';')[0].trim().toLowerCase();
    if (!/^image\/(jpeg|png|webp)$/.test(type)) return { ok: false, reason: 'not_image' };
    let buf;
    try { buf = await readCapped(res, IMG_MAX); } catch (e) { return { ok: false, reason: _why(e) }; }
    if (!buf) return { ok: false, reason: 'too_big' };
    if (sniffImage(buf) !== type) return { ok: false, reason: 'not_image' };   // ⑤ 머리말만 믿지 않는다 — 첫 바이트가 그 꼴이어야
    return { ok: true, dataUrl: `data:${type};base64,${buf.toString('base64')}` };
  }
  /* 안내 화면 바로가기 — 렌더러가 주소를 안 준다(목적지 고정 · noonnu 바로가기와 같은 꼴) */
  function openSite(which) {
    shell.openExternal(which === 'docs' ? 'https://pixabay.com/api/docs/' : 'https://pixabay.com/accounts/register/');
    return { ok: true };
  }
  function registerIpc(ipcMain) {
    ipcMain.handle('pixabay:key-status', () => store.status());
    ipcMain.handle('pixabay:key-set', (_e, k) => setKey(k));
    ipcMain.handle('pixabay:key-clear', () => store.clear());
    ipcMain.handle('pixabay:search', (_e, p) => search(p));
    ipcMain.handle('pixabay:fetch-image', (_e, url) => fetchImage(url));
    ipcMain.handle('pixabay:open-site', (_e, which) => openSite(which));
  }
  return { setKey, status: () => store.status(), clear: () => store.clear(), search, fetchImage, openSite, registerIpc };
}

module.exports = { createPixabay, cleanParams, sniffImage };
