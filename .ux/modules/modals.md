---
module: modals
owns: ["css/settings-modal.css", "css/editor-extra.css"]
selectors: [".settings-*", ".anim-modal-*", ".pub-dd-*"]
dimensions: [flow, error]
---
# modals — 설정/애니메이션 모달 + publish 드롭다운
주 관찰: 비상구(Esc/취소) 가시성(`nielsen-10.md#3-control`), 확인/취소 순서 관례(MATRIX layout-convention). 주의: .commit-*/.modal-*/.export-* 셀렉터는 미존재(design 검증) — 커밋은 .pub-dd-* 항목으로 구현.
