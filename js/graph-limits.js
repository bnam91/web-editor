/* graph-limits.js — 그래프 막대 두께 한계의 «단 하나의 자리».
 * UI(슬라이더·숫자칸 attribute · 클램프) · block-factory 의 updateGraphBlock(_intField) · main/claude-pm/mcp-server.js
 * (MCP 스키마·검증)가 전부 여기서 «끌어 쓴다». 가로(barThickness)·세로/비교(vBarThickness)가 같은 한계를 쓴다.
 * 60 — 현빈 2026-10-03 「60까지 되어야해」. (48 은 2026-04-08 bar-h 패널 최초 커밋 73fd3639 에서 이유 없이 들어온 값.)
 * 실측(2026-10-03, DOM 하네스): 48·60 모두 막대 겹침 0 · 블록 가로 넘침 0 · 섹션 밖 0 — 60 에서 깨지는 곳 없음.
 * 렌더러는 prop-graph.js·block-factory.js 가 이 파일을 «side-effect import» 해 window.GRAPH_LIMITS 를 받는다(index.html·하네스 script 줄 불필요).
 * 메인 프로세스는 require. */
(function (root) {
  /* ★BAR_THICKNESS_DEFAULT(E99 U26 · 2026-10-05) — 두께를 «안 정한» 막대의 두께. 패널(prop-graph.js)과 렌더 셋(가로·세로·비교, drag-utils.js)이
       «이 한 값»을 읽는다. 전엔 패널·가로는 24 를 각자 적고, 세로·비교는 키가 없으면 칸 전폭으로 그려 «패널 24 ↔ 막대 127px» 가 났다. */
  /* 같은 병(패널 ||기본값 ↔ 렌더러 기본값) 6 — 명부 E105~E110 · 0.9.7 ($S/unmeasured-tx1.md) */
  var GRAPH_LIMITS = Object.freeze({ BAR_THICKNESS_MIN: 8, BAR_THICKNESS_MAX: 60, BAR_THICKNESS_DEFAULT: 24 });
  if (typeof module !== 'undefined' && module.exports) module.exports = GRAPH_LIMITS;
  if (root) root.GRAPH_LIMITS = GRAPH_LIMITS;
})(typeof window !== 'undefined' ? window : null);
