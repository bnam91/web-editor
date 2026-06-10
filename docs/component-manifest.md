# Component Manifest

PM이 spec(JSON) 작성 직전에 "어떤 블록을 쓸까"를 결정하기 위한 카탈로그.
API 시그니처가 아니라 **언제 쓰는가 / 언제 쓰지 말아야 하는가**에 초점.

- **JSON 원본**: `/Users/a1/web-editor/main/claude-pm/component-manifest.json`
- **API 레퍼런스**: `/Users/a1/web-editor/docs/goditor-api-reference.md`
- **Spec v2**: `/Users/a1/web-editor/docs/goditor-spec-v2.md`

> 두 파일은 1:1 동기화. 이 md는 사람이 빠르게 검색하기 위한 뷰, JSON은 스킬/PM이 programmatic하게 읽는 소스.

---

## 사용 흐름

1. PM/planner가 사용자 요청 분석
2. `component-manifest.json`의 `useCases`/`notRecommendedFor` 매칭으로 후보 좁히기
3. spec JSON에 `type` 필드로 컴포넌트 지정
4. orchestrator/generator가 `prefix`와 `api`로 실제 addXxxBlock 호출

---

## Special Components (12)

자체 모달·렌더러·데이터 모델을 가진 복합 컴포넌트.

| name | prefix | API | 핵심 use-case |
|------|--------|-----|---------------|
| banner02 | `bn2_` | `addBanner02Block` | 3단(label/title/sub) 마케팅 배너, 가변 lines |
| laurel | `lrb_` | `addLaurelBlock` | 월계관/리본 — 인증·수상·랭킹 |
| canvas | `cvb_` | `addCanvasBlock` | freeLayout hero, 이미지 위 텍스트 오버레이 |
| chat | `chb_` | `addChatBlock` | 메신저 UI 후기/대화 |
| comparison | `cmp_` | `addComparisonBlock` | 자사 vs 경쟁사 N열 비교표 (featured 강조) |
| gradient | `grad_` | `addGradientBlock` | 섹션 구분용 그라데이션 strip |
| iconify | `icn_` | `addIconifyBlock` | Iconify 라이브러리 아이콘 단독 |
| mockup | `mkp_` | `addMockupBlock` | 폰/태블릿/노트북 프레임 + 스크린샷 |
| step | `stb_` | `addStepBlock` | 3~5단계 가이드 (STEP 1→2→3) |
| sticker | `stk_` | `addStickerBlock` | NEW/BEST/SOLD OUT 짧은 강조 배지 |
| vector | `vb_` | `addVectorBlock` | 임의 SVG 일러스트/장식 |
| banner | `(preset)` | `addBannerBlock(presetKey)` | 사전 정의 BANNER_PRESETS 프레임 호출 |

### 상세 — Special

#### banner02 (`bn2_`)
- **쓸 때**: 'NEW LAUNCH / 6월 한정 / 무료배송' 같은 헤드 블록, section 최상단 attention grabber. 4단 이상도 lines로 가능.
- **쓰지 말 때**: 본문 단락 → `text-block`. 이미지 hero → `canvas`.
- **예시 프롬프트**: "섹션 맨 위에 'EVENT / 6월 한정 50% OFF / 한정수량 소진시 종료' 3단 배너 넣어줘"

#### laurel (`lrb_`)
- **쓸 때**: '2025 베스트셀러 1위', 'KC 인증 완료' 같은 신뢰 배지, 후기 섹션 sub-heading.
- **쓰지 말 때**: 긴 설명 → `text-block`. 단순 강조 → `sticker`.
- **예시 프롬프트**: "리뷰 섹션 위에 '2025 고객만족도 1위' 월계관 넣어줘"

#### canvas (`cvb_`)
- **쓸 때**: 이미지 + 텍스트 자유 배치, 단일 카드 absolute, freeLayout 컨테이너.
- **쓰지 말 때**: 단순 풀폭 이미지 → `asset`. 리스트성 반복 → `card`.
- **예시 프롬프트**: "제품 이미지 위에 '한정수량' 텍스트 좌상단, 가격 우하단 absolute로 얹은 hero canvas 만들어줘"

#### chat (`chb_`)
- **쓸 때**: 메신저 UI 후기, FAQ 대화, Before/After 시나리오.
- **쓰지 말 때**: 단일 인용 → `speech-bubble`. 긴 후기 → `text-block`.
- **예시 프롬프트**: "고객 후기 섹션에 카톡 스타일 메신저 대화 3턴 넣어줘"

#### comparison (`cmp_`)
- **쓸 때**: 자사 vs 경쟁사 N열 비교 (featured 컬럼 강조), ✓/✗ 표, 스펙 비교.
- **쓰지 말 때**: 일반 데이터 표 → `table`. 1:1 단순 비교 → `canvas` 2분할.
- **예시 프롬프트**: "우리 제품, A사, B사 3열 비교표 만들고 우리 컬럼 강조해줘"

#### gradient (`grad_`)
- **쓸 때**: 섹션 구분 strip, 배경 분위기 전환, decorative divider.
- **쓰지 말 때**: 단순 구분선 → `divider`. 섹션 전체 배경 → section bgColor.
- **예시 프롬프트**: "두 섹션 사이에 보라→핑크 그라데이션 띠 넣어줘"

#### iconify (`icn_`)
- **쓸 때**: Iconify 아이콘 단독, 보조 픽토그램, 브랜드 로고 SVG.
- **쓰지 말 때**: 원형 배경 필요 → `icon-circle`. 텍스트 결합 → `icon-text`.
- **예시 프롬프트**: "체크 아이콘 3개를 가로로 배치해줘"

#### mockup (`mkp_`)
- **쓸 때**: 폰/태블릿/노트북 프레임 + 스크린샷, 앱·웹 데모.
- **쓰지 말 때**: 실물 제품 사진 → `asset`/`canvas`. 평면 스크린샷 → `asset`.
- **예시 프롬프트**: "아이폰 mockup에 우리 앱 메인 화면 스크린샷 넣어줘"

#### step (`stb_`)
- **쓸 때**: 3~5단계 가이드, 구매 → 배송 → 사용 flow.
- **쓰지 말 때**: 단순 번호 리스트 → `text-block`. 분기 flowchart → `canvas`.
- **예시 프롬프트**: "STEP1 결제 / STEP2 배송 / STEP3 사용 3단계 가이드 만들어줘"

#### sticker (`stk_`)
- **쓸 때**: SOLD OUT, NEW, BEST, HOT 짧은 라벨, 카드 우상단 overlay 배지, 가격표 'SALE' 도장.
- **쓰지 말 때**: 긴 본문 텍스트, 다국어 번역 필요한 카피, 본문 흐름 강조 → `text-block` bold.
- **예시 프롬프트**: "제품 카드 우상단에 'NEW' 스티커 붙여줘"

#### vector (`vb_`)
- **쓸 때**: 임의 SVG 일러스트, 브랜드 squiggle/underline 강조, 커스텀 SVG.
- **쓰지 말 때**: 표준 아이콘 → `iconify`. 비트맵 → `asset`.
- **예시 프롬프트**: "제목 아래 손글씨 느낌 squiggle underline SVG 넣어줘"

#### banner (preset)
- **쓸 때**: 사전 정의 BANNER_PRESETS(frame_N) 일괄 적용, 디자이너 표준 템플릿 호출.
- **쓰지 말 때**: 자유 텍스트 배너 → `banner02`. preset 없는 신규 → `banner02`.
- **예시 프롬프트**: "표준 배너 frame_8 가져와줘"

---

## Primitive Components (13)

단순 빌딩블록. 텍스트/이미지/도형 등 1차 요소.

| name | prefix | API | 핵심 use-case |
|------|--------|-----|---------------|
| text | `tb_` | `addTextBlock` | 일반 텍스트 (h1/h2/h3/body/caption/label) |
| asset | `ab_` | `addAssetBlock` | 단일 이미지 (preset 높이) |
| gap | `gb_` | spec gap | 블록 사이 빈 공간 (px) |
| divider | `dvd_` | block-factory | 얇은 가로선 |
| icon-circle | `icb_` | block-factory | 원형 배경 + 아이콘 |
| label-group | `lg_` | block-factory | 키워드/태그 chips 묶음 |
| table | `tbl_` | block-factory | 일반 데이터 표 |
| card | `cdb_` | block-factory | 이미지+제목+설명 반복 카드 |
| graph | `grb_` | block-factory | 막대/꺾은선/원형 차트 |
| icon-text | `itb_` | block-factory | 아이콘 + 한 줄 텍스트 |
| speech-bubble | `sb_` | block-factory | 단일 말풍선 인용 |
| frame | `ss_` | block-factory (frame-block) | freeLayout 컨테이너, 그룹 |
| grid | (row layout) | row.dataset.layout | N-column 균등 분할 |

### 상세 — Primitive

#### text (`tb_`)
- **쓸 때**: 모든 일반 텍스트 (h1/h2/h3/body/caption/label), 본문·부제·캡션·라벨, 리스트(• 직접 입력).
- **쓰지 말 때**: 장식 짧은 강조 → `sticker`. 아이콘+한 줄 → `icon-text`.
- **예시 프롬프트**: "h2 '왜 우리 제품인가' 추가하고 그 아래 body로 3줄 설명"

#### asset (`ab_`)
- **쓸 때**: 단일 이미지 풀폭 또는 정사각 (standard 780px / square 860px 등 preset), 제품 사진, 배경 이미지, 스크래치패드 드롭 자동 생성.
- **쓰지 말 때**: 디바이스 프레임 → `mockup`. 위 텍스트 오버레이 → `canvas`. SVG → `vector`.
- **예시 프롬프트**: "정사각 제품 사진 1장 추가"

#### gap (`gb_`)
- **쓸 때**: 블록 사이 빈 공간(px), 호흡, 그리드 row 간격.
- **쓰지 말 때**: 시각 구분 필요 → `divider`/`gradient`. section 외부 → section padding.
- **예시 프롬프트**: "텍스트와 이미지 사이 80px 갭"

#### divider (`dvd_`)
- **쓸 때**: 얇은 가로선, 섹션 내 항목 구분, FAQ 라인, footer separator.
- **쓰지 말 때**: 시각 강조 → `gradient`. 단순 여백 → `gap`.
- **예시 프롬프트**: "FAQ 질문 사이 회색 1px divider 넣어줘"

#### icon-circle (`icb_`)
- **쓸 때**: 원형 배경 + 아이콘, 'WHY US' 3-col 컬럼 상단, step 인디케이터.
- **쓰지 말 때**: 텍스트 결합 → `icon-text`. 원형 불필요 → `iconify`.
- **예시 프롬프트**: "3개 컬럼 각 상단에 컬러풀한 원형 아이콘 배치"

#### label-group (`lg_`)
- **쓸 때**: '#친환경 #국내산 #저알러지' chips 그룹, 특징 라벨 묶음, 필터 옵션.
- **쓰지 말 때**: 비교 표 → `comparison`. 단일 라벨 → `sticker`/`text-block`.
- **예시 프롬프트**: "제품 특징 태그 5개 chips로 묶어줘"

#### table (`tbl_`)
- **쓸 때**: 일반 데이터 표 (스펙, 영양성분, 가격표), 행/열 자유, 주의사항 매트릭스.
- **쓰지 말 때**: 강조 비교 → `comparison`. 2~3행 정보 → `text-block`.
- **예시 프롬프트**: "성분표 4x5 표 만들어줘"

#### card (`cdb_`)
- **쓸 때**: 이미지+제목+설명 묶음, 3-col 추천 제품 반복, 후기 카드, feature card.
- **쓰지 말 때**: 단일 hero → `canvas`. freeLayout → `canvas`.
- **예시 프롬프트**: "3-col grid에 추천 제품 카드 3개 (이미지 + 제목 + 가격)"

#### graph (`grb_`)
- **쓸 때**: 막대/꺾은선/원형 차트 (만족도, 점유율, 성장률), 5개 미만 항목 권장, before/after 수치.
- **쓰지 말 때**: 복잡한 다축 → 외부 이미지. 단일 수치 강조 → `text-block` 큰 폰트.
- **예시 프롬프트**: "고객 만족도 항목 5개 막대 차트로 표현"

#### icon-text (`itb_`)
- **쓸 때**: 아이콘 + 한 줄 텍스트 (체크리스트, 특징 bullet), trust badge 행, FAQ 헤더.
- **쓰지 말 때**: 아이콘만 → `iconify`. 여러 줄 본문 동반 → `card`.
- **예시 프롬프트**: "체크 아이콘 + '무료배송', '당일출고', '정품보장' 3행 만들어줘"

#### speech-bubble (`sb_`)
- **쓸 때**: 단일 말풍선 인용, 한 줄 후기, 슬로건, 캐릭터 대사, FAQ 답변 요약.
- **쓰지 말 때**: 여러 턴 대화 → `chat`. 긴 후기 → `text-block`.
- **예시 프롬프트**: "캐릭터 일러스트 옆에 '이거 진짜 좋아요!' 말풍선"

#### frame (`ss_`)
- **쓸 때**: freeLayout 컨테이너(absolute 자식 담는 통), 그룹화된 sub-section, data-group=true 묶음.
- **쓰지 말 때**: 1차 섹션 → Spec section level. row면 충분 → `row`.
- **예시 프롬프트**: "이 5개 블록을 하나의 frame으로 묶어줘"

#### grid (row layout)
- **쓸 때**: N-column 균등 분할 (2/3/4-col), 카드 반복, 갤러리.
- **쓰지 말 때**: freeLayout 필요 → `frame freeLayout=true`. 비율 다른 컬럼 → col별 flex.
- **예시 프롬프트**: "3-col 그리드에 카드 6개 배치"

---

## 컴포넌트 선택 의사결정 트리

```
사용자 요청
  │
  ├─ 짧은 강조 라벨? ──────────→ sticker
  ├─ 신뢰/수상 배지? ──────────→ laurel
  ├─ 3~5단계 가이드? ──────────→ step
  ├─ 자사 vs 경쟁사 비교? ──────→ comparison
  ├─ 메신저 대화? ─────────────→ chat
  ├─ 디바이스 프레임 + 스샷? ───→ mockup
  ├─ 차트/그래프? ─────────────→ graph
  ├─ 마케팅 배너 3단? ─────────→ banner02
  ├─ 이미지 위 텍스트 자유배치? → canvas
  ├─ SVG 일러스트/장식? ────────→ vector (또는 iconify)
  ├─ 키워드 태그 묶음? ────────→ label-group
  ├─ 아이콘+한 줄? ────────────→ icon-text
  ├─ 카드 반복 (이미지+제목+설명)→ card + grid
  ├─ 일반 표? ────────────────→ table
  ├─ 단순 텍스트? ─────────────→ text
  └─ 단일 이미지? ─────────────→ asset
```

---

## 변경 이력

- v1 (2026-06-09): 초기 12 special + 13 primitive 등록.
