# Goditor Section Spec — v2

이미지 분석 봇(GPT/Gemini)이 출력하고, CDP 에이전트가 실행하는 섹션 조립 계약서.

> **v1 → v2 주요 변경**
> - Block 타입명 코드 기준으로 통일 (`asset`→`image`, `iconCircle`→`icon-circle` 등)
> - Col이 flex 비율을 직접 소유 (Row.ratio 제거)
> - version 정수 필드 + minCompatVersion 추가
> - Section.label 판단 기준 명문화
> - layout 선택 규칙 명문화
> - 단위 전부 명시 (px, 지름 등)

---

## 최상위 구조

```json
{
  "schema": "goditor-spec",
  "version": 2,
  "minCompatVersion": 1,
  "sections": [ <Section>, ... ]
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| `schema` | string | 항상 `"goditor-spec"` 고정 |
| `version` | number | 이 JSON의 스펙 버전 (현재 2) |
| `minCompatVersion` | number | 파서 최소 지원 버전 (하위호환 범위 선언) |
| `sections` | Section[] | 1개 이상 |

---

## Section

```json
{
  "label": "Hook",
  "settings": {
    "bg": "#ffffff",
    "padX": 32,
    "padY": 32
  },
  "rows": [ <Row>, ... ]
}
```

| 필드 | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| `label` | string | No | `""` | Hook / Main / Detail / CTA / Event — 아래 판단 기준 참조 |
| `settings` | object | No | — | 생략 시 에디터 현재 설정 유지 |
| `settings.bg` | hex | No | `"#ffffff"` | 섹션 배경색 |
| `settings.padX` | number (px) | No | `32` | 섹션 좌우 패딩. `.section-inner`의 `padding-left/right`에 직접 적용. 명시하면 페이지 레벨 `applyPagePadX` 설정을 override함 |
| `settings.padY` | number (px) | No | `32` | 상하 패딩 |
| `rows` | Row[] | **Yes** | — | 1개 이상 |

### Section.label 판단 기준

이미지 분석 봇이 섹션 목적을 판단할 때 아래 기준을 사용한다.

| label | 사용 기준 |
|-------|-----------|
| `Hook` | 제품 첫인상, 감성 어필, 브랜드 카피, 히어로 이미지 중심 |
| `Main` | 핵심 기능·스펙 소개, 제품의 why·what 설명 |
| `Detail` | 소재·사용법·세부 정보, 스펙 표, 성분 등 |
| `CTA` | 구매 유도, 가격 정보, 버튼, 프로모션 문구 |
| `Event` | 기간 한정 할인, 이벤트, 증정품 안내 |
| `""` (빈 문자열) | 판단 불가 또는 위 5가지에 해당하지 않는 경우 |

---

## Row

```json
{
  "layout": "flex",
  "cols": [ <Col>, ... ]
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `layout` | enum | **Yes** | `stack` \| `flex` \| `grid` |
| `cols` | Col[] | **Yes** | 열 배열 (layout별 개수 규칙 아래 참조) |

### layout 선택 규칙

이미지 분석 봇이 어떤 layout을 선택할지 판단하는 기준:

| layout | 선택 조건 | cols 개수 |
|--------|-----------|-----------|
| `stack` | 가로 분할 없이 위→아래로만 쌓이는 구조 | 정확히 1개 |
| `flex` | 2~3개 영역이 한 행에 가로로 나란히 있는 구조 | 2~3개 |
| `grid` | 동일한 카드/셀이 격자(2×2, 2×3 등)로 반복되는 구조 | `gridCols × gridRows` 개 |

**grid 사용 시 추가 필드:**

```json
{
  "layout": "grid",
  "gridCols": 2,
  "gridRows": 3,
  "cols": [ <Col>, ... ]  // gridCols × gridRows 개
}
```

---

## Col

```json
{
  "id": "col_001",
  "flex": 2,
  "blocks": [ <Block>, ... ]
}
```

| 필드 | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| `id` | string | No | 자동 생성 | 실행 봇이 타깃 지정 시 사용 |
| `flex` | number | No | `1` | `layout: "flex"` 일 때 비율 (상대값) |
| `widthPct` | number | No | `100` | `layout: "stack"` 일 때 col 너비 % — 가능한 값: `100` `75` `66` `50` `33` `25` |
| `blocks` | Block[] | **Yes** | — | 0개 이상 (빈 col 허용) |

**flex 비율 예시:**
- `"1:2"` 레이아웃 → `[{ "flex": 1 }, { "flex": 2 }]`
- `"1:1:1"` 레이아웃 → `[{ "flex": 1 }, { "flex": 1 }, { "flex": 1 }]`
- `"1:2:1"` 레이아웃 → `[{ "flex": 1 }, { "flex": 2 }, { "flex": 1 }]`

---

## Block 공통 구조

모든 Block은 `type` 필드를 반드시 포함한다.

```json
{ "type": "<block-type>", ...타입별 필드 }
```

---

## Block 타입 목록

### `text`

```json
{ "type": "text", "style": "h1", "content": "제목 텍스트", "align": "center" }
```

| 필드 | 값 | 기본값 | 설명 |
|------|----|--------|------|
| `style` | 아래 표 참조 | `"body"` | 텍스트 스타일 |
| `content` | string | `""` | 텍스트 내용. 추출 불가 시 `""` |
| `align` | `"left"` \| `"center"` \| `"right"` | `"left"` | 정렬 |

**style 판단 기준 (이미지 분석 봇용):**

| style | 용도 | 판단 기준 |
|-------|------|-----------|
| `h1` | 섹션 메인 헤드라인 | 섹션에서 가장 큰 텍스트 |
| `h2` | 서브 헤드라인 | h1보다 작고 강조된 제목 |
| `h3` | 항목 제목 | 리스트 항목 또는 소항목 제목 |
| `body` | 본문 설명 | 일반 문장, 설명 단락 |
| `caption` | 부연 설명 | 이미지 하단 설명, 작은 주석 |
| `label` | 태그형 텍스트 | 칩/뱃지 형태의 짧은 분류 텍스트 |

---

### `image`

> v1의 `asset` → v2에서 `image`로 변경

```json
{ "type": "image", "preset": "standard", "alt": "제품 이미지" }
```

| 필드 | 값 | 기본값 | 설명 |
|------|----|--------|------|
| `preset` | 아래 표 참조 | `"standard"` | 이미지 영역 크기 프리셋 |
| `alt` | string | `""` | 이미지 내용 설명 (이미지 분석 봇이 채울 것) |

**preset 판단 기준:**

| preset | 크기 | 용도 / 선택 기준 |
|--------|------|-----------------|
| `standard` | 780px 높이 | 일반 제품 이미지, 기본값 |
| `square` | 860×860px | 정사각형 비율 이미지 |
| `tall` | 1032px 높이 | 세로가 긴 이미지 (3:4, 2:3 비율) |
| `wide` | 575px 높이 | 가로가 넓은 이미지 (배너, 16:9) |
| `logo` | 200×64px | 브랜드 로고, 인증 마크 등 작은 이미지 |

---

### `gap`

```json
{ "type": "gap", "height": 40 }
```

| 필드 | 값 | 기본값 |
|------|----|--------|
| `height` | number (px 단위, 지름 아님) | `40` |

---

### `divider`

```json
{ "type": "divider", "color": "#cccccc", "lineStyle": "solid", "weight": 1 }
```

| 필드 | 값 | 기본값 |
|------|----|--------|
| `color` | hex | `"#cccccc"` |
| `lineStyle` | `"solid"` \| `"dashed"` \| `"dotted"` | `"solid"` |
| `weight` | number (px 단위) | `1` |

> v1의 `style` → v2에서 `lineStyle`로 변경 (Block 공통 `type` 필드와 혼동 방지)

---

### `icon-circle`

> v1의 `iconCircle` → v2에서 `icon-circle`로 변경

```json
{ "type": "icon-circle", "size": 240, "bgColor": "#e8e8e8" }
```

| 필드 | 값 | 기본값 |
|------|----|--------|
| `size` | number (px 단위, **지름** 기준) | `240` |
| `bgColor` | hex | `"#e8e8e8"` |

---

### `label-group`

> v1의 `labelGroup` → v2에서 `label-group`으로 변경

```json
{ "type": "label-group", "labels": ["특징1", "특징2", "특징3"] }
```

| 필드 | 값 | 기본값 |
|------|----|--------|
| `labels` | string[] | `["라벨"]` |

---

### `table`

```json
{ "type": "table", "showHeader": true, "cellAlign": "center" }
```

| 필드 | 값 | 기본값 |
|------|----|--------|
| `showHeader` | boolean | `true` |
| `cellAlign` | `"left"` \| `"center"` \| `"right"` | `"center"` |

> 표 내용(headers, rows 데이터)은 v3에서 추가 예정. 현재는 빈 표 생성 후 수동 편집.

---

### `card`

```json
{ "type": "card", "count": 2, "bgColor": "#f5f5f5", "radius": 12 }
```

| 필드 | 값 | 기본값 |
|------|----|--------|
| `count` | `2` \| `3` | `2` |
| `bgColor` | hex | `"#f5f5f5"` |
| `radius` | number (px 단위) | `12` |

---

### `graph`

```json
{
  "type": "graph",
  "chartType": "bar-v",
  "items": [
    { "label": "항목A", "value": 80 },
    { "label": "항목B", "value": 60 }
  ]
}
```

| 필드 | 값 | 기본값 |
|------|----|--------|
| `chartType` | `"bar-v"` \| `"bar-h"` | `"bar-v"` |
| `items` | `{ label: string, value: number(0~100) }[]` | 5개 샘플 |

> **이미지 분석 봇 주의**: 이미지에서 수치 추출이 불확실할 경우 `items: []`로 빈 배열 전달. 실행 봇이 에디터 기본값으로 생성.

---

### `sub-section`

Figma FRAME(오토레이아웃 없음)에 대응하는 자유 배치 컨테이너. 내부에 `joker` 블록을 절대 위치로 포함한다.

```json
{
  "type": "sub-section",
  "label": "Frame 2",
  "width": 453,
  "height": 241,
  "x": 204,
  "bg": "#1e1e1e",
  "children": [
    {
      "type": "joker",
      "label": "Star 1",
      "svg": "<svg>...</svg>",
      "width": 174,
      "height": 174,
      "x": 53,
      "y": 33
    }
  ]
}
```

| 필드 | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| `label` | string | No | `"Frame"` | 레이어 패널 이름 |
| `width` | number (px) | **Yes** | — | 서브섹션 너비 |
| `height` | number (px) | **Yes** | — | 서브섹션 높이 (클리핑 기준) |
| `x` | number (px) | No | `0` | 섹션 내 X 위치 (marginLeft) |
| `bg` | hex | No | `"#f5f5f5"` | 배경색 |
| `children` | joker[] | No | `[]` | 내부 조커 블록 배열 |

> **에디터 동작**: `overflow: hidden` 적용 — 서브섹션 경계 밖으로 나간 자식은 잘려서 보이지 않음 (Figma 프레임 클리핑과 동일)

---

### `joker`

Figma에서 에디터 기본 블록으로 표현 불가능한 요소(VECTOR, STAR, POLYGON, CONNECTOR, GROUP 등)를 SVG로 보존하는 패스스루 블록.

```json
{
  "type": "joker",
  "label": "Arrow 1",
  "svg": "<svg width=\"325\" height=\"15\" ...>...</svg>",
  "width": 325,
  "height": 15,
  "x": 268,
  "y": 0
}
```

| 필드 | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| `label` | string | No | `"Figma Component"` | 레이어 패널 이름 |
| `svg` | string | No | `""` | SVG 마크업 전체. 없으면 회색 placeholder |
| `width` | number (px) | **Yes** | — | 렌더 너비 |
| `height` | number (px) | **Yes** | — | 렌더 높이 |
| `x` | number (px) | No | `0` | X 오프셋. 섹션 직계 자식이면 `transform: translateX`, 서브섹션 자식이면 `left` |
| `y` | number (px) | No | `0` | Y 오프셋. 서브섹션 자식일 때만 유효 (`top`) |

**Figma 노드 → joker 변환 기준:**

| Figma 타입 | 처리 |
|-----------|------|
| ELLIPSE, VECTOR, STAR, POLYGON, BOOLEAN_OPERATION | joker (SVG 추출) |
| CONNECTOR, LINE 등 얇은 요소 | joker (SVG 자연 크기 우선 — bbox가 hit area 포함 시 SVG dims 사용) |
| GROUP | joker (그룹 전체 SVG 추출, 단일 블록으로) |
| FRAME (레벨 1) | sub-section (재귀 처리) |
| 기타 | joker (SVG 추출 시도, 실패 시 빈 joker) |

---

## 전체 예시 — 이미지+텍스트 2열 섹션

```json
{
  "schema": "goditor-spec",
  "version": 2,
  "minCompatVersion": 1,
  "sections": [
    {
      "label": "Hook",
      "settings": { "bg": "#f9f9f9", "padX": 32, "padY": 48 },
      "rows": [
        {
          "layout": "flex",
          "cols": [
            {
              "id": "col_001",
              "flex": 1,
              "blocks": [
                { "type": "image", "preset": "square", "alt": "제품 정면 이미지" }
              ]
            },
            {
              "id": "col_002",
              "flex": 2,
              "blocks": [
                { "type": "text", "style": "label", "content": "브랜드명", "align": "left" },
                { "type": "text", "style": "h1", "content": "메인 카피라이팅", "align": "left" },
                { "type": "gap", "height": 16 },
                { "type": "text", "style": "body", "content": "제품 설명 문장이 들어갑니다.", "align": "left" },
                { "type": "label-group", "labels": ["특징1", "특징2", "특징3"] }
              ]
            }
          ]
        },
        {
          "layout": "stack",
          "cols": [
            {
              "widthPct": 100,
              "blocks": [
                { "type": "divider", "color": "#e0e0e0" },
                { "type": "text", "style": "caption", "content": "주의사항 문구", "align": "center" }
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

---

## 이미지 분석 봇 지시 요약

GPT/Gemini에게 전달할 시스템 프롬프트 핵심 포인트:

1. **섹션 목적 판단** → `label` (Hook/Main/Detail/CTA/Event/"")
2. **레이아웃 구조 파악** → `layout` 결정 규칙 (단열=stack, 가로분할=flex, 격자=grid)
3. **Col 비율 추정** → `flex` 값 (예: 왼쪽이 좁으면 1, 오른쪽이 넓으면 2)
4. **블록 타입 식별** → text/image/gap/divider/icon-circle/label-group/table/card/graph
5. **텍스트 스타일 판단** → h1/h2/h3/body/caption/label 기준표 참조
6. **이미지 preset 선택** → standard/square/tall/wide/logo 기준표 참조
7. **수치 추출 불확실 시** → `content: ""`, `items: []` 등 빈 값 사용
8. **출력 규칙** → JSON만 출력, 설명 텍스트 없이, `"schema": "goditor-spec"` 필드 반드시 포함

---

## v1 → v2 마이그레이션 가이드

| v1 | v2 | 비고 |
|----|----|----|
| `"schema": "goditor-spec/v1"` | `"schema": "goditor-spec"` + `"version": 2` | 버전 분리 |
| `"type": "asset"` | `"type": "image"` | 코드 기준 통일 |
| `"type": "iconCircle"` | `"type": "icon-circle"` | kebab-case |
| `"type": "labelGroup"` | `"type": "label-group"` | kebab-case |
| `Row.ratio: "1:2"` | `Col.flex: 1` / `Col.flex: 2` | Col 소유 구조 |
| `Row.ratio: "100"` | `Col.widthPct: 100` | 필드명 명확화 |
| `divider.style` | `divider.lineStyle` | type 충돌 방지 |

---

## 버전 히스토리

| 버전 | 날짜 | 변경 |
|------|------|------|
| v1 | 2026-04-03 | 초안 |
| v2 | 2026-04-03 | 타입명 통일, Col flex 소유, 버전 필드, label/layout 판단 기준, 단위 명시 |
| v2.1 | 2026-04-03 | `settings.padX` 설명 갱신 — 섹션 레벨 override 동작 명시 (페이지 레벨 `applyPagePadX` 우선순위 구조 반영) |
| v2.2 | 2026-04-03 | `sub-section`, `joker` 블록 타입 추가 (Figma 임포트 파이프라인 대응) |
