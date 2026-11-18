/* tool-modes — «맨 V = 모든 도구 모드 끝 + 선택 커서» 공용 명부 (t13A-08 · 지디 261118 공용 규칙).
 *   끝낼 모드가 자기 출구를 등록한다: window.registerToolModeExit(name, fn) — fn() 은 «모드가 켜져 있어 껐으면» true.
 *   window.exitToolModes() = 등록된 출구 전부 부름 · 하나라도 껐으면 true(editor.js 맨 V 가 그때만 키를 먹는다).
 *   ⛔맨 V 를 따로 잡는 기존 넷(annotation-tool·count-sticker-tool·highlight-line-tool·annotation-select 의 capture keydown)은
 *     이번에 안 옮긴다(지디 261118 · 별건). 플레인 스크립트 — module·plain 양쪽에서 보이게, 어느 모듈보다 먼저 선다. */
(function () {
  const exits = new Map();
  window.registerToolModeExit = (name, fn) => { if (typeof fn === 'function') exits.set(name, fn); };
  window.exitToolModes = () => {
    let any = false;
    exits.forEach((fn, name) => {
      try { if (fn()) any = true; } catch (err) { console.error('[tool-modes] exit 실패:', name, err); }
    });
    return any;
  };
})();
