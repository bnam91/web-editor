/* canvas-link-guard.js — 캔버스 안 링크(a[href])를 눌러도 «아무 일 없음» (SEC-MALICIOUS-PROJECT-FILE-SANDBOX-01 ③ · 현빈 결정 (가) 261112)
 *   일반 클릭·⌘/Ctrl·Shift 클릭(click) · 가운데 클릭(auxclick) 의 «기본 동작»(이동·새 창)만 끊는다.
 *   ⛔stopPropagation 하지 않는다 — 블럭 선택·편집 진입은 그대로 돈다. 커서 놓기는 mousedown 이라 링크 글자 편집도 그대로.
 *   ★바깥 벽은 main/nav-guard.js(will-navigate·setWindowOpenHandler) — 이건 렌더러 쪽 첫 손이다. */
(function () {
  const cut = (ev) => {
    const a = ev.target && ev.target.closest && ev.target.closest('a[href]');
    if (a && a.closest('#canvas')) ev.preventDefault();
  };
  document.addEventListener('click', cut, true);
  document.addEventListener('auxclick', cut, true);
})();
