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
    try { res = await net.fetch(url); } catch (_) { return { ok: false, reason: 'network' }; }
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
    try { res = await net.fetch(u.toString()); } catch (_) { return { ok: false, reason: 'network' }; }
    try { if (res.url && !okHost(new URL(res.url).hostname)) return { ok: false, reason: 'blocked' }; } catch (_) { return { ok: false, reason: 'blocked' }; }   // 넘겨받은 끝 주소도
    if (!res.ok) return { ok: false, reason: 'http_' + res.status };
    const type = String(res.headers?.get?.('content-type') || '').split(';')[0].trim().toLowerCase();
    if (!/^image\/(jpeg|png|webp)$/.test(type)) return { ok: false, reason: 'not_image' };
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > IMG_MAX) return { ok: false, reason: 'too_big' };
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

module.exports = { createPixabay, cleanParams };
