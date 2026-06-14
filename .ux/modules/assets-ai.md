---
module: assets-ai
owns: ["css/assets-panel.css", "css/ai-image.css"]
selectors: [".assets-*", ".aig-*", ".ai-*", ".ai-img-*", ".outpaint-*"]
dimensions: [flow, feedback, semantics]
---
# assets-ai — 에셋 패널 + AI 이미지 생성/아웃페인트
주 관찰: 자산 삽입 플로우(flows/insert-asset.md)의 단계 구성, AI 생성 대기 중 상태 가시성(`nielsen-10.md#1-visibility` — 장시간 작업 진행 표시), .assets vs .aig 두 방언이 사용자에게 두 시스템으로 *보이는가*(시맨틱).
