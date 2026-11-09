/* ═══════════════════════════════════════════════════════════════════════════
   higgsfield-key.js — Higgsfield API 키 보관 (t2-03 · 0.9.11)
   ───────────────────────────────────────────────────────────────────────────
   ★키는 settings.json 에 «안» 넣는다 — userData/higgsfield.key.bin 에 safeStorage.encryptString 바이트만.
   ⛔암호화를 못 쓰면(리눅스 키링 없음 등) 거절한다 — 평문 폴백은 절대 없다.
   ⛔전체 키를 돌려주는 IPC 는 없다 — status 는 «있나 + ••••끝4» 만. 오류·반환은 사유 코드만(키를 안 싣는다).
═══════════════════════════════════════════════════════════════════════════ */
'use strict';

const MAX_LEN = 512;

/**
 * @param {{ safeStorage: object, fs: object, filePath: string }} deps — main.js 가 주입(테스트는 가짜 safeStorage)
 */
function createHiggsfieldKey({ safeStorage, fs, filePath }) {
  function encOk() {
    try { return !!safeStorage.isEncryptionAvailable(); } catch (_) { return false; }
  }

  function set(raw) {
    const key = typeof raw === 'string' ? raw.trim() : '';
    if (!key) return { ok: false, reason: 'empty' };
    if (key.length > MAX_LEN) return { ok: false, reason: 'too_long' };
    if (!encOk()) return { ok: false, reason: 'no_encryption' };
    const tmp = filePath + '.tmp';
    try {
      fs.writeFileSync(tmp, safeStorage.encryptString(key), { mode: 0o600 });
      fs.renameSync(tmp, filePath);   // 원자 쓰기 — 반쯤 쓴 파일이 남지 않게
    } catch (_) {
      try { fs.unlinkSync(tmp); } catch (__) {}
      return { ok: false, reason: 'write_failed' };
    }
    return { ok: true, ...status() };
  }

  function status() {
    let buf;
    try { buf = fs.readFileSync(filePath); } catch (_) { return { hasKey: false, masked: '' }; }
    if (!encOk()) return { hasKey: true, masked: '' };
    try {
      return { hasKey: true, masked: '••••' + safeStorage.decryptString(buf).slice(-4) };
    } catch (_) {
      return { hasKey: true, masked: '' };   // 복호 실패(다른 기기에서 옮긴 파일 등) — 있음만 알린다
    }
  }

  function clear() {
    try { fs.unlinkSync(filePath); } catch (e) { if (e && e.code !== 'ENOENT') return { ok: false, reason: 'delete_failed' }; }
    return { ok: true, hasKey: false, masked: '' };
  }

  function registerIpc(ipcMain) {
    ipcMain.handle('higgsfield:key-status', () => status());
    ipcMain.handle('higgsfield:key-set', (_e, key) => set(key));
    ipcMain.handle('higgsfield:key-clear', () => clear());
  }

  return { set, status, clear, registerIpc };
}

module.exports = { createHiggsfieldKey, MAX_LEN };
