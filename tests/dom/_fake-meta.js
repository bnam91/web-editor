/* _fake-meta.js — 프로젝트 meta IPC 가짜(브라우저 안에 깐다). ★«의미»가 main.js 와 같아야 한다 — 다르면 계측기부터 틀린다.
 * ⛔가짜는 «한 벌»이다 — 시험마다 자기 가짜를 만들지 말고 이것을 써라. main.js 핸들러와 의미를 맞춘다.
 *   2026-10-02: color-history 에 따로 둔 가짜가 save 를 «통째 교체»로 흉내 냈고(main 은 { ...cur, ...metaData }) — writer 를 고치자
 *   H8 이 «거짓 빨강»이 났다. 둘이 갈려 한쪽이 조용히 늙은 것이다. ⇒ 한 벌로 모으고 의미는 unit meta-fake-semantics 가 잠근다.
 * ★load 호출 수 = window.__metaLoads (patch-only writer 가 «0회» 읽는지 단언용).
 *   save = 받는 «그 순간» 파일(여기선 window.__meta[pid])과 `{ ...cur, ...metaData }` 원자 합치기
 *          (main.js ipcMain.handle('projects:save-meta') 와 같은 식 — tests/unit/meta-fake-semantics.test.mjs 가 두 소스를 대조해 잠근다)
 *   load = «부른 순간» 찍고 30ms 뒤 돌려준다(실제 IPC 처럼 — 돌려줄 때 읽으면 경합이 안 생긴다: color-history H8 이 그걸로 거짓 초록이었다)
 *   ★끼어들기: window.__interleave 에 함수를 걸어 두면 «다음 load 가 찍은 직후» 한 번 실행한다 — writer 가 옛 사본을 든 사이
 *     다른 필드가 «반드시» 바뀐다(경합을 우연이 아니라 매번 일으킨다). */
const INSTALL_FAKE_META = function () {
  window.__meta = {};
  window.__metaSaves = [];
  window.__metaLoads = 0;
  const real = window.electronAPI;
  const clone = (o) => (o == null ? o : JSON.parse(JSON.stringify(o)));
  window.__fakeSaveMeta = (pid, metaData) => {
    const cur = window.__meta[pid] && typeof window.__meta[pid] === 'object' ? window.__meta[pid] : null;
    const merged = cur ? { ...cur, ...metaData } : metaData;   // main.js 와 같은 식
    window.__meta[pid] = clone(merged);
    window.__metaSaves.push({ pid, keys: Object.keys(metaData || {}) });
    return { ok: true };
  };
  window.electronAPI = new Proxy({}, { get: (_t, k) => {
    if (k === 'isElectron') return true;
    if (k === 'saveProjectMeta') return (pid, m) => Promise.resolve(window.__fakeSaveMeta(pid, clone(m)));
    if (k === 'loadProjectMeta') return (pid) => {
      window.__metaLoads = (window.__metaLoads || 0) + 1;
      const snap = clone(window.__meta[pid] || null);
      const f = window.__interleave; window.__interleave = null;
      if (typeof f === 'function') f();
      return new Promise(r => setTimeout(() => r(snap), 30));
    };
    if (k === 'saveProject') return () => Promise.resolve({ ok: true });
    if (k === 'loadProject') return () => Promise.resolve(null);
    return real[k];
  } });
};
module.exports = { INSTALL_FAKE_META_SRC: `(${INSTALL_FAKE_META.toString()})()` };
