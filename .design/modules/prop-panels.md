---
module: prop-panels
owns:
  - "js/props/**"
  - "css/editor-props.css"
dimensions: [component, states, spacing, css-health]   # 영역 내부 정합 가중 차원
# color/typo는 전체 RUN(report-2026-06-11.md)에서 이미 커버 → 이 모듈 RUN은 "패널 간 일관성"에 집중
guard_doc: ../report-2026-06-11.md
---

# 모듈: prop-panels (블록별 속성 패널)

## 목적
블록을 선택하면 우측에 뜨는 **속성(prop) 패널**들이 **서로 일관적인가**를 본다.
전체 차원 스윕(report-2026-06-11.md)이 "전 표면에서 radius 제각각" 같은 *교차파일 이탈*은 잡았으나,
**"텍스트블록 패널 vs 이미지블록 패널 vs 배너 패널이 같은 기능 UI를 같은 크기·계층·스타일로 그리는가"** 라는
*영역 내부 깊이 비교*는 전담 에이전트가 없었다. 이 모듈 RUN이 그 구멍을 메운다.

## 스타일/코드 표면 (owns)
- `css/editor-props.css` (822줄) — 모든 prop 패널 공용 스킨
- `js/props/**` (46파일) — 패널 빌더

### 블록타입 패널 (비교 대상 — "이것들이 서로 닮았나")
prop-text(텍스트) · prop-asset(이미지) · prop-banner02(배너) · prop-chat(채팅) · prop-comparison(비교) ·
prop-canvas(캔버스블록) · prop-section(섹션) · prop-step(스텝) · prop-table(표) · prop-graph(그래프) ·
prop-shape · prop-simple-card · prop-divider · prop-frame · prop-icon-circle · prop-iconify ·
prop-label-group · prop-laurel · prop-layout · prop-mockup · prop-sticker · prop-vector ·
prop-annotation · prop-joker · prop-gap · prop-gradient · prop-row · prop-page · prop-multisel

### 공용 위젯 (같은 기능 = 같은 모양이어야 함 — 정합 체크 핵심)
| 위젯 | 표준 클래스 | 무엇이 같아야 하나 |
|------|-----------|------------------|
| 정렬 버튼군 | `.prop-align-btn` / `.prop-align-group` | 크기(24px)·계층(prop-section 직속)·아이콘 |
| 타입 토글 | `.prop-type-btn` / `.prop-type-group` | 높이·border 토큰·active 표현 |
| 스타일 버튼 | `.prop-style-btn` | prop-align/type과 너비·높이 일치 |
| 프리셋 버튼 | `.prop-preset-btn` / `.prop-preset-group` | grid wrap·hover border |
| 섹션 | `.prop-section` / `.prop-section-title` | 패딩·타이틀 타이포 |
| 블록 헤더 | `.prop-block-label` / `-icon` / `-name` / `-id` | 아이콘 16px·이름 타이포·id 위치 |
| 행 | `.prop-row` / `.prop-label`(56px) / `.prop-field-label` | 라벨 폭·정렬 |
| 토글 | `.prop-toggle` / `-track` | 32×18 크기·knob |
| 카운트 | `.prop-count-btn`(20px) / `-val` | 버튼 크기 |
| 슬라이더 | `.prop-slider` | 트랙·thumb |
| 입력/셀렉트 | `.prop-number` / `.prop-select` / `.prop-text` | height 28px(DBG-A로 통일 명시) |
| 위험 버튼 | `.prop-btn-danger` / `.prop-action-btn.secondary` | **danger 토큰 필수** |

## 🔴 필수 준수 규칙 (위반=major — v2 아카이브 이관, 이 모듈의 핵심 룰)
1. **prop-align-group 계층**: 정렬 전용 그룹은 `.prop-section` 직속(full-width 균등분할). `.prop-row`로 감싸면 shrink-fit으로 좁아짐 = **금지**. → 패널마다 이 계층이 다르면 정렬버튼 너비가 갈린다(v2에서 Banner/Card가 실제로 어긋났던 회귀).
2. **위험 버튼 danger**: 제거/삭제/초기화 버튼은 `danger` class/토큰. `secondary`나 raw hex = 위반.
3. **propPanel.querySelectorAll**: `document.querySelectorAll` 금지(전역오염·다중배너 충돌) — 단 이건 *코드* 규칙이라 debug-squad 영역. 디자인 RUN은 그 결과 *시각* 불일치만.
4. **동일 기능 UI 크기 일치**: 정렬버튼 등은 prop-section.js / prop-text.js를 참조 표준으로, 다른 패널이 같은 크기·계층인지.

## ⚠️ 의도된 예외 (Scan 즉시 제외)
- 블록 고유 컨트롤(그래프의 데이터 입력, 표의 행·열 편집, gradient 슬라이더 등)은 **기능이 달라 모양이 달라야 정상** — 일관성 위반 아님. "같은 기능"끼리만 비교.
- `.prop-text` 6종 wireup(prop-text-wireup-*.js)은 텍스트 전용 세부라 다른 블록에 없음 = 정상.
- `_helpers.js` / color-picker / gradient-model = 공용 빌더(패널 아님).
- DBG-A 주석(height 28px 통일) 등 의도적 정리 주석은 위반 아님.
- 저대비 토큰(dim/muted)은 별도 FIX 완료(fixplan-2026-06-11.md) — 이 RUN 대상 아님.

## RUN 방식 메모
스폰 단위를 차원이 아니라 **"공용 위젯 횡단 비교"** 로 잡는다(영역 정합이 목적):
A. 위젯 정합(component+states): 위 공용 위젯별로 전 블록패널이 같은 클래스·크기·상태스타일을 쓰는가
B. 구조/규칙(css-health): prop-align-group 계층 위반, danger 우회, 중복 prop 스타일, 패널별 빌드 패턴 분기
C. 간격/레이아웃(spacing): prop-section 패딩·prop-row 높이·라벨 폭이 패널 간 일치하는가
