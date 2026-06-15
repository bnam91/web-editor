---
module: graph
owns: ["css/editor-graph.css", "js/props/prop-graph.js"]
selectors: [".grb-data-*"]
dimensions: [layout]
---
# graph — 그래프 데이터 편집 크롬 (.grb-data-* 입력/삭제만)
주 관찰: 데이터 행 편집·삭제의 그룹핑. 차트 시각화 자체는 콘텐츠 — 불가침. 공용 .prop-* 버튼은 prop-panel 소유.
