# 스킬 라우팅 가이드

> 상페마법사 웹에디터 전용 스킬 목록.
> 가볍고 빠른 작업 → 단독 스킬 / 전문팀이 필요한 깊은 작업 → 스쿼드

---

## 단독 스킬 (일상적·즉각 실행)

| 상황 | 스킬 |
|------|------|
| 버그 찾아서 즉시 수정 (Notion 디버깅 DB 기반) | `/webeditor-debug` |
| Notion QA DB 체크리스트 순차 검수 | `/webeditor-qa-checker` |
| 블록 생성·CDP 단위 테스트 | `/webeditor-block-tester` |
| 코드 수정 후 스모크 테스트 (회귀 확인) | `/webeditor-regression-guard` |

---

## 스쿼드 투입 (전문팀·병렬 에이전트)

| 상황 | 스킬 |
|------|------|
| 대규모·복잡한 버그 (10개 에이전트 병렬) | `/debug-squad` |
| 유저 시나리오 기반 사용성 검증 | `/qa-squad` |
| 비주얼 일관성·컬러·타이포 감사 | `/design-squad` |
| 사용자 흐름·인터랙션·정보구조 개선 | `/ux-squad` |
| FPS·메모리·로딩 성능 측정 및 병목 분석 | `/performance-squad` |
| 코드 중복 제거·모듈화·가독성 개선 | `/refactor-squad` |
| 빌드·버전 태깅·자동업데이트 배포 | `/release-squad` |
| 브랜치 충돌 해소·PR 생성·병합 관리 | `/merge-manager-squad` |
| 피그마·경쟁사 벤치마킹 기반 기능 발굴 | `/feature-scout-squad` |
| 아이디어 한 줄 → 시나리오·스펙 구체화 | `/idea-lab-squad` |

---

## 오케스트레이터

| 상황 | 스킬 |
|------|------|
| 복합 멀티태스크 (팀 자동 조립) | `/harness-manager` |
