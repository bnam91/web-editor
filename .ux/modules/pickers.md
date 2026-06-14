---
module: pickers
owns: ["css/color-picker.css", "js/props/color-picker.js", "js/props/gradient-model.js"]
selectors: [".goya-cp-*"]
dimensions: [flow, feedback]
---
# pickers — 컬러/그래디언트 통합 피커 (Figma형 팝오버)
주 관찰: 팝오버 진입-적용-닫기 흐름, 적용 즉시성(피드백). 폰트 피커는 미존재(prop-select 처리) — N/A.
