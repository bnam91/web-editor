---
flow: edit-block
core_task: 1   # 블록 추가→속성 변경→저장 확인 (주 액션)
verified: never
---
# 플로우: 블록 추가 → 속성 변경 → 저장 확인
## 단계
1. 시작: 에디터 열림, 프로젝트 로드 상태
2. 블록 추가 (좌측/툴바 경로 — 실제 진입로를 RUN이 기록)
3. 캔버스에서 블록 선택 → prop 패널 표시 확인
4. 속성 1개 변경 (예: 텍스트 크기)
5. 완료 판정: 변경이 캔버스 반영 + 저장 상태 피드백 가시
## 기대 뎁스 (추정 — 첫 RUN이 실측 후 갱신)
click_depth_max 3 이내 (추가 1 + 선택 1 + 변경 1)
## 복귀·취소 지점
각 단계에서 Cmd+Z 복귀 가능해야 함. 저장은 autosave(triggerAutoSave) — 수동 저장 UX 아님(saveProject()는 commit modal — 혼동 표면 주의).
