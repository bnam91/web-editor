# Design FIX Plan — 토큰 패밀리 처방 (매트릭스 근본원인) · 2026-06-11

매트릭스 13영역 결산의 단일 근본원인(`:root` 토큰 패밀리 부재) 처방. **순차 진행**(현빈 승인). 시각 변화 있는 migration은 Before/After 게이트 적용. report-only 해제(FIX 승인됨), 커밋은 별도 승인.

## PR-0 — 토큰 패밀리 정의 ✅ 완료 (시각 변화 0, 추가만)
editor-base.css :root에 추가:
- danger 패밀리: `--ui-danger-bg`(rgba .12)·`--ui-danger-border`·`--ui-danger-hover`
- 치수: `--ui-btn-h`24·`--ui-input-h`24·`--ui-radius-sm/md/lg`4/6/10·`--ui-form-label-w`56·`--ui-row-gap`4·`--ui-pad-panel`8·`--ui-disabled-opacity`0.5
- 파랑 정본 주석(--ui-accent-primary가 표준, 우회 폐기 대상 명시)
→ 아무것도 아직 참조 안 함 = 렌더 무변화. 신규 UI는 이걸 써야 함(GATE).

## 이후 migration (시각 변화 — Before/After 승인 후 순차)
| PR | 내용 | 영향 | 리스크 |
|----|------|------|--------|
| PR-1 | **danger 표준화** — 4방식→토큰(fill-alpha 정석). raw hex(#c0392b/#e06060/#e55/#ff8a8a/#ff6b6b) → `--ui-danger*`. tier 구분(블록삭제=fill / 항목=outline) 유지 | left·prop·pm·assets·settings·tpl 6영역 | 중 (영역별 danger 모양 바뀜 → 미리보기 필수) |
| PR-2 | **focus-visible 공용 규칙** — 인터랙티브 요소에 `:focus-visible{outline}` 1규칙(pickers 패턴 승격) | 전역(12영역) | 저 (키보드 focus만 추가, 마우스 무변화) |
| PR-3 | **파랑 정본화** — #6b9eff/#6fa3f7/#6cf/#6a9fd8/raw #2d6fe8 → `--ui-accent-primary`. pm Claude-blue는 의도색이라 현빈 확인 후 | pm·left·assets·toolbar | 중 (pm 정체성 색 변경 가능 → 확인) |
| PR-4 | **치수 토큰 이관** — 버튼 height/radius raw → `--ui-btn-h`/`--ui-radius-*`. 점진(터치하는 셀렉터만) | 전영역 점진 | 중 (일괄 금지, 영역별) |
| PR-5 | **간격 토큰** — 라벨폭 40/62→`--ui-form-label-w`, gap 6→`--ui-row-gap` | left·design-system 등 | 저~중 |
| PR-6 | **disabled opacity** 통일 → `--ui-disabled-opacity` | 전영역 | 저 |
| PR-7 | **구조 정리** — comp-shelf 215줄 2중복정의 제거, `var(--ui-border)322` 깨진 선언 수정, settings-modal raw 팔레트 토큰화, home planning/projects를 license alias 패턴으로 | template-browser·left·modals·home | 중 (중복 제거는 검증 필수) |

## 원칙
- **새 hex/px 추가 금지** — 기존/신설 토큰 치환만.
- migration은 **영역별 Before/After 미리보기 → 승인 → 적용 → CDP 재검증**(현빈 게이트).
- 일괄 치환 금지, 터치하는 셀렉터만 점진 흡수(시각 회귀 방지).
- 캔버스 콘텐츠·preset 불가침.
- pm Claude-blue, planning 초록 등 "의도된 영역 색"은 폐기 전 현빈 확인.
