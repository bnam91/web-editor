---
module: prop-panel
owns: ["css/editor-props.css", "js/props/**"]
selectors: [".prop-*"]
dimensions: [layout, semantics, feedback]
---
# prop-panel — 블록타입별 속성 패널 (46빌더, 우측)
주 관찰: 패널 내 속성 그룹핑·순서가 작업 순서와 일치하는가(`gestalt.md#proximity`, `interaction-laws.md#miller` 청킹), 블록타입 간 동일 속성의 위치 일관(MATRIX layout-convention 핵심 행). G1(외부 사용자) 확정으로 **점진 공개·청킹도 정식 감사 대상**(`ia-principles.md#progressive-disclosure`) — 단 클릭 뎁스 트레이드오프 명시 의무.
