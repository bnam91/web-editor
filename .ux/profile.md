---
# /Users/a1/web-editor/.ux/profile.md — ux-squad v3.0 UX 명세 (PROFILE 2026-06-11, 현빈 확인 게이트 대기)
project: GODITOR (상페마법사 웹에디터)
type: electron
entry: index.html (Electron main.js / name=sangpe-editor)
cdp_port: 9334            # GoyaDesignEditor — .design/profile.md와 동일
results_dir: .ux/results
# ── conformance 기준값 (게이트 G3 확정 2026-06-11: 첫 사이클 느슨하게 — 실측 후 조이기) ──
click_depth_max: 4            # 핵심 작업 1회 완료까지 최대 클릭
feedback_delay_ms_max: 300    # 액션 → 가시 피드백 최대 지연
first_output_steps_max: 7     # 첫 실행 → 첫 산출물(섹션 1개)까지 최대 단계
min_target_px:                # 미설정 — Fitts는 judgment로만
active_dimensions: [layout, semantics, flow, feedback, error, onboarding]
notion_db: 329111a5-7788-8021-9027-deea1f33dd18   # (선택) v2 투두 DB 승계
---

# GODITOR UX 감사 명세

## 앱 개요 (UX 관점)
바닐라 JS + Electron 상세페이지 에디터. **다크 UI 크롬**이 **라이트 캔버스 콘텐츠**(사용자가 만드는 상세페이지)를 편집한다.
- **UX 감사 대상 = UI 크롬만.** 캔버스 콘텐츠(--preset-*, 블록 내부 디자인)는 사용자 편집물 — 불가침(design-squad와 동일 경계).
- 표면: 좌측 패널(레이어/파일) · 중앙 캔버스 · 우측 prop 패널(블록타입별 46빌더) · 상단 툴바 · 모달군 · 보조 페이지 3종(planning/projects/license).

## 페르소나와 핵심 작업 (게이트 G1·G2 확정 2026-06-11)
- **주 사용자 (G1 확정: 외부 사용자까지)**: 현빈(전문가) + 직원 + **외부 일반 사용자**. 함의:
  - **U-onboarding 최고 가중** — 첫 실행→첫 섹션 단계 수, empty state, 기능 발견가능성 정식 감사. `nielsen-10.md#10-help`(맥락 도움) 엄격 적용.
  - 레이블/관례 판단 기준 = **일반 사용자**(도메인 약어·내부 용어는 위반 후보). 회상 기반 가속 경로는 "가시적 대체 경로 존재" 시에만 합격.
- **핵심 작업 Top 5+1 (G2: 초안 + 신규 진입 추가 — 빈도순)**:
| # | 작업 | 빈도(추정) | 비고 |
|---|---|---|---|
| 0 | 신규 진입: 첫 실행 → 프로젝트 생성 → 첫 섹션 | 사용자당 1회, 그러나 외부 확산 시 전환 관문 | U-onboarding 정본 플로우 |
| 1 | 블록 추가 → 속성 변경 → 저장 확인 | 매 세션 수십 회 | 주 액션 — v2 대표 플로우 |
| 2 | 이미지 자산 삽입 (스크래치패드/업로드 → 블록) | 매 세션 다수 | asset placeholder 규약 연관 |
| 3 | 섹션 재배치/복제/삭제 | 매 세션 다수 | U-error(파괴 액션) 핵심 표면 |
| 4 | 템플릿/컴포넌트 삽입 | 세션당 수 회 | template-browser |
| 5 | 내보내기/발행 | 세션 말미 1회 | publish 드롭다운 |

## 용어 사전
**없음 — 신설 제안 경로 활성.** 혼용 발견 시 U-semantics가 혼용 *사실*만 judgment 보고 + "용어 사전 신설"을 root-cause 제안.
(알려진 의심 혼용: 섹션/블록/프레임, 컴포넌트/템플릿 — RUN에서 전수 확인 대상.)

## 영역 후보와 분할 결정 ★design-squad 13영역 selectors 재활용 (matrix-2026-06-11 산출물에서 복원)
| 영역 | 결정 | 사유 |
|---|---|---|
| toolbar, left-panel, prop-panel, canvas-block, modals, template-browser, assets-ai, design-system, pm-panel, pickers, graph, toast, home-pages | **13개 전부 분할 유지** | design MATRIX 검증 완료 경계 — 추적성(design 발견과 교차 대조) 우선 |
| (참고) graph·pickers·toast | 유지하되 RUN에서 저가중 | UX 단독 의뢰엔 과립도 미세 — prop-panel/canvas-block 통과 시 함께 봄 |

분할 상세(owns/selectors)는 `modules/*.md`. 백스톱: 영역 13개 ≥ 3 — 충족.

## 플로우 명세 — flows/*.md ★U-flow·MATRIX의 유일 소스 (즉흥 주행 금지)
| 플로우 파일 | 대응 핵심 작업 | 마지막 검증 |
|---|---|---|
| flows/first-section.md | #0 신규 진입→첫 섹션 (G1 외부 사용자 확정으로 추가) | 미실행 |
| flows/edit-block.md | #1 블록 추가→속성→저장 | 미실행 (기대 뎁스는 추정 — 첫 RUN이 실측) |
| flows/insert-asset.md | #2 이미지 자산 삽입 | 미실행 |
| flows/section-rearrange.md | #3 섹션 재배치/삭제 | 미실행 |
| flows/export-publish.md | #5 내보내기/발행 | 미실행 |

## 의도된 UX 결정 (오탐 방지)
| 결정 | 범위 | 왜 의도인가 |
|---|---|---|
| 다크 크롬 / 라이트 캔버스 이원 | 전역 | 결과물(라이트 상세페이지) 충실 미리보기 |
| 캔버스 콘텐츠 불가침 | --preset-*, 블록 내부 | 사용자 편집물 — UI 크롬 아님 |
| MVP 숨김 기능 (.tb-hidden-mvp — commit 토글 등) | toolbar | 의도적 단계 출시 — "발견 불가" 지적 제외 |
| PM 패널 독자 스타일 (.cpm-* Claude-blue) | pm-panel | **G5 ①확정(2026-06-11 현빈)**: "Claude가 움직이는 영역" 구분 의도 — ux 감사 제외. 단 design의 색상 토큰값 판정은 별개 유지 |

- ~~고밀도 prop 패널~~ — **예외에서 제거** (G1: 외부 사용자 확정 → 점진 공개·청킹은 정식 감사 대상. 전문가 가정의 예외였음)

## MATRIX 시그니처 추출 명세 (정류장 3 × 13영역)
- **terminology**: 각 영역의 버튼/메뉴/토스트 가시 텍스트 — index.html + js 동적 생성 레이블(block-factory, props/*) 전수.
- **layout-convention**: 주 액션 위치(패널 상/하단), 확인/취소 버튼 순서, 그룹 구획 방식(여백/선/박스).
- **error-convention**: 파괴 액션(삭제/덮어쓰기) 보호 방식 — 확인 다이얼로그/Undo/무보호, 에러 표시 위치(toast/inline/silent).
- 명세 없는 항목은 null+UNMEASURED.

## 타 스쿼드 산출물 참조 (4조건 규약 적용 — 읽기전용·xref·신선도·soft)
- design: `.design/results/matrix-station-*.json` (2026-06-11 생성) — 시각 표준값. U-semantics의 기표(danger 등) 판단 보조.
- qa: `.qa/profile.md` 시나리오·회귀 가드(P-01~07) — U-flow 설계 시 중복 회피 참조. qa MATRIX 산출물은 아직 없음 → soft skip.

## 비활성 차원과 사유
없음 — 6차원 전부 활성. U-onboarding은 G1(외부 사용자) 확정으로 **최고 가중**.

## 변경 이력
- 2026-06-11: 최초 생성 (ux-squad v3.0 PROFILE — design 13영역 selectors 재활용)
- 2026-06-11: 게이트 반영 — G1 외부 사용자까지(onboarding 최고 가중, 고밀도 패널 예외 해제) / G2 핵심작업 #0 추가 / G3 기준값 4/300/7(첫 사이클 느슨, 실측 후 조이기)
- 2026-06-11: G5 ①확정(현빈 직접 회신) — PM 패널 독자 스타일을 의도된 UX 결정으로 등재, 감시 루프 종료
