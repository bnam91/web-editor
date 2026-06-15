---
module: design-system
owns: ["css/editor-base.css", "js/design-system.js"]
selectors: [".ds-*", "#ds-panel-header", "#ds-panel-body", "#design-system-panel"]
dimensions: [semantics, layout]
---
# design-system — 캔버스 프리셋(--preset-*) 편집 패널
주 관찰: "여기서 바꾸면 어디가 바뀌나"의 예측성(편집 대상=캔버스 콘텐츠임이 지각되는가 — wayfinding). picker 내부 hex 값은 콘텐츠 — 불가침.
