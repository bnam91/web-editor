---
module: canvas-block
owns: ["css/editor-blocks.css", "js/block-factory.js", "js/block-edit.js", "js/block-drag.js"]
selectors: [".canvas-block", ".cvb-*", ".canvas-overlay-handle", ".canvas-radius-handle"]
dimensions: [layout, error, feedback]
---
# canvas-block — 캔버스 블록 선택/핸들/인라인 컨트롤 (UI 크롬만)
주 관찰: 선택 상태의 전경 분리(`gestalt.md#figure-ground`), 블록 삭제 보호(U-error 핵심), 핸들 발견가능성. 블록 *내부* 콘텐츠 디자인은 불가침. 드래그 버벅임은 qa 소관 — 침범 금지.
