---
module: left-panel
owns: ["css/editor-panels.css", "css/editor-base.css"]
selectors: [".layer-*", ".file-page-*", ".proj-tab-*", ".panel-header", ".panel-body", "#file-panel-body"]
dimensions: [layout, semantics]
---
# left-panel — 레이어/파일 패널 (좌측)
주 관찰: 계층 들여쓰기의 위계 오독(`gestalt.md#continuity`), 레이어/파일 탭 전환의 wayfinding. 주의: 구 .side-* 셀렉터는 미존재(design 검증) — 실 컨테이너는 .panel-*.
