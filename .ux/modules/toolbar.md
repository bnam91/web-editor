---
module: toolbar
owns: ["css/editor-base.css", "css/editor-layout.css", "index.html"]
selectors: [".tb-btn", ".tb-btn--icon", ".tb-badge*", ".zoom-btn", "#zoom-ctrl", "#topbar", ".proj-tab", ".st-btn", ".section-toolbar", "#publish-btn", ".pub-dd-item"]
dimensions: [semantics, layout]
---
# toolbar — 상단 툴바 + 섹션 툴바 + publish 드롭다운
주 관찰: 아이콘 단독 버튼의 레이블 예측성(`ia-principles.md#labeling`), 발행(주 액션)의 전경성. MVP 숨김(.tb-hidden-mvp)은 의도된 결정 — 제외.
