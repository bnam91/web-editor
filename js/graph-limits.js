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
  /* ★BAR_THICKNESS_V_MAX(H1 · 현빈 2026-10-05 「세로 그래프 두께 60 → 더 늘리게」) = 'column' — 세로·비교 막대 두께의 위 끝은 «그 막대가 선 칸의 폭»이다(수 없음).
       실측(실앱 d1f642ff · 5항목 860 블럭 · 칸 127): 두께 120 → 막대 120 · 200 → 127 · 1000 → 127 — 렌더가 이미 max-width:100% 로 칸에서 자른다
       (drag-utils.js _barVSettings fillW). 넘침·이웃 겹침·블럭 밖 0. ⇒ 칸보다 큰 수는 «아무 일도 안 하는» 칸이라 상한 = 칸 폭(⒤).
       ⒥ 고정 큰 값(200)·⒦ 무제한은 그 «헛칸»만 늘린다(측정 $S/e1/real/h1.json). 가로 막대(BAR_THICKNESS_MAX 60)는 그대로. */
  var GRAPH_LIMITS = Object.freeze({ BAR_THICKNESS_MIN: 8, BAR_THICKNESS_MAX: 60, BAR_THICKNESS_DEFAULT: 24, BAR_THICKNESS_V_MAX: 'column' });
  if (typeof module !== 'undefined' && module.exports) module.exports = GRAPH_LIMITS;
  if (root) root.GRAPH_LIMITS = GRAPH_LIMITS;
})(typeof window !== 'undefined' ? window : null);
