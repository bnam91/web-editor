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
  /* ★LABEL_SIZE_DEFAULT · LINE_PADX_DEFAULT · PCT_SIZE_FACTOR(그래프 패널 묶음 · 2026-10-05 · 승인 lane-graph-panel) — 키를 «안 정한» 그래프의
       라벨 글자 크기 20 · 꺾은선 좌우 여백 16(SVG 가상폭 1000 단위 — 계산된 CSS 로 못 읽는다) · 가로 막대 숫자 크기 = 라벨 크기 × 3.
       렌더러(drag-utils renderGraph)와 패널(prop-graph)이 «이 값들»을 읽는다. 전엔 패널 13·0·60 을 각자 적어 그려지는 20·16·라벨×3 과 달랐다
       (명부 E105 = 13≠20 · E106 · E110 — PANEL-SHOWS-WRONG 꼴). 값은 렌더러의 옛 값 그대로 = 렌더 바이트 무변. */
  /* ★PIE_HOLE_MIN · MAX · DEFAULT(1012t1G1 · 2026-10-12) — 도넛 그래프 가운데 구멍의 크기(바깥 반지름 대비 %). 패널 슬라이더·숫자칸(prop-graph.js)과
       렌더러(drag-utils.js _renderPie)가 «이 세 값»을 읽는다. 20 미만은 원형과 구별이 안 되고 80 초과는 고리가 실처럼 가늘어진다(기획 값 — 현빈 확인 전). */
  /* ★PIE_GAP(1012t1G1 고침 · 2026-10-13) — 원형·도넛 조각 사이 틈의 폭(viewBox 1000 단위 — 계산된 CSS 로 못 읽는다 · 높이 240 에서 약 2.4px).
       색 순번이 5개 주기라 항목 수가 5n+1 이면 끝 조각이 첫 조각과 같은 색으로 맞닿는다 — 틈이 그 둘을 가른다. 렌더러(drag-utils.js _renderPie)가 읽는다(기획 값 — 현빈 확인 전). */
  /* ★PIE_GAP_MIN · MAX(1013t1C6 · 2026-10-13) — 조각 간격 칸(dataset.pieGap · viewBox 1000 단위)의 한계. 키가 없으면 PIE_GAP(10)으로 그린다(옛 저장본 그대로).
       0 = 틈 없음(조각이 맞닿는다) · 40 = 높이 240 에서 약 10px. 패널 슬라이더·숫자칸(prop-graph.js)과 렌더러(_renderPie)가 같이 읽는다(기획 값 — 현빈 확인 전). */
  /* ★PIE_START_MIN · MAX(1013t1C2 · 2026-10-13) — 시작 각도 칸(dataset.pieStart · 도 · 12시 = 0 · 시계 방향)의 한계. 키가 없으면 0(옛 저장본 그대로).
       360 은 0 과 같은 그림이라 위 끝은 359(기획 값 — 현빈 확인 전). */
  /* ★PIE_GROW_MAX(1013t1C4 · 2026-10-13) — 조각 크기 칸(items[i].pieGrow · 바깥 반지름에 더하는 %)의 위 끝. 0 = 안 키움(키 없음).
       키운 만큼 viewBox 를 대칭으로 넓혀 그린다 ⇒ 30 이면 나머지 조각이 화면에서 1/1.3 로 작아진다(기획 값 — 현빈 확인 전). */
  /* ★PIE_PULL_MAX(1013t1C5 · 2026-10-13) — 밀어내기 칸(items[i].piePull · 바깥 반지름 대비 %)의 위 끝. 0 = 안 밂(키 없음).
       민 만큼도 viewBox 를 대칭으로 넓혀 그린다(조각 크기와 같은 길 — 둘을 같이 주면 더해진다 · 기획 값 — 현빈 확인 전). */
  /* ★SHAPE_SVG_MAX · SHAPE_FILL_MAX_DEFAULT · SHAPE_TRACK_OPACITY · SEG_GAP_DEFAULT(1012t1G2·G3·G4 · 2026-10-12) — 「SVG 를 그래프 모양으로」(js/graph-shape.js).
       SHAPE_SVG_MAX 60000 = 블럭에 실리는 «정규화된» 사용자 SVG 글자 수의 상한(마스크 URL 은 % 인코딩으로 그 세 배쯤까지 는다 — 저장본 비대 방지).
       SHAPE_FILL_MAX_DEFAULT 100 = 모양일 때 채움 분모(값 하나짜리 채움 그래프가 늘 꽉 차지 않게 — 사각 막대의 max(items) 와 다르다).
       SHAPE_TRACK_OPACITY 0.25 = 안 찬 부분(트랙)의 불투명도 — 색은 채움과 같은 색(새 색 0). SEG_GAP_DEFAULT 2 = 마디 사이 틈(px).
       렌더러(drag-utils.js · graph-shape.js)와 패널(prop-graph.js)이 «이 값들»을 읽는다(기획 값 — 현빈 확인 전). */
  var GRAPH_LIMITS = Object.freeze({ BAR_THICKNESS_MIN: 8, BAR_THICKNESS_MAX: 60, BAR_THICKNESS_DEFAULT: 24, BAR_THICKNESS_V_MAX: 'column', LABEL_SIZE_DEFAULT: 20, LINE_PADX_DEFAULT: 16, PCT_SIZE_FACTOR: 3,
    PIE_HOLE_MIN: 20, PIE_HOLE_MAX: 80, PIE_HOLE_DEFAULT: 55, PIE_GAP: 10, PIE_GAP_MIN: 0, PIE_GAP_MAX: 40, PIE_START_MIN: 0, PIE_START_MAX: 359, PIE_GROW_MAX: 30, PIE_PULL_MAX: 30,
    SHAPE_SVG_MAX: 60000, SHAPE_FILL_MAX_DEFAULT: 100, SHAPE_TRACK_OPACITY: 0.25, SEG_GAP_DEFAULT: 2 });
  if (typeof module !== 'undefined' && module.exports) module.exports = GRAPH_LIMITS;
  if (root) root.GRAPH_LIMITS = GRAPH_LIMITS;
})(typeof window !== 'undefined' ? window : null);
