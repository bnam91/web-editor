# Goditor Section Spec — v1

이미지 분석 봇(GPT/Gemini)이 출력하고, CDP 에이전트가 실행하는 섹션 조립 계약서.

---

## 최상위 구조

```json
{
  "schema": "goditor-spec/v1",
  "sections": [ <Section>, ... ]
}
```

한 번에 여러 섹션을 전달할 수 있다. 단일 섹션이면 `sections` 배열에 1개.

---

## Section

```json
{
  "label": "Hook",
  "settings": {
    "bg": "#ffffff",
    "padX": 32,
    "padY": 32,
    "gap": 100
  },
  "rows": [ <Row>, ... ]
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `label` | string | No | Hook / Main / Detail / CTA / Event |
| `settings.bg` | hex string | No | 섹션 배경색 (기본: #ffffff) |
| `settings.padX` | number | No | 좌우 패딩 px (기본: 32) |
| `settings.padY` | number | No | 상하 패딩 px (기본: 32) |
| `settings.gap` | number | No | 섹션 간격 px (기본: 100) |
| `rows` | Row[] | **Yes** | 1개 이상 |

---

## Row

```json
{
  "layout": "flex",
  "ratio": "1:2",
  "cols": [ <Col>, ... ]
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `layout` | enum | **Yes** | `stack` \| `flex` \| `grid` |
| `ratio` | string | No | layout별 비율 (아래 참조) |
| `cols` | Col[] | **Yes** | 열 배열 |

### layout 값 규칙

| layout | 의미 | ratio 형식 | 예시 |
|--------|------|-----------|------|
| `stack` | 단일 열, 세로 쌓기 | `"100"` `"75"` `"66"` `"50"` `"33"` `"25"` (col 너비 %) | `"100"` |
| `flex` | 다열 가로 배치 | `"1:2"` `"1:1"` `"1:1:1"` `"1:2:1"` (flex 비율) | `"1:2"` |
| `grid` | 다열 × 다행 격자 | `"COLSxROWS"` | `"2x3"` `"3x2"` |

---

## Col

```json
{
  "blocks": [ <Block>, ... ]
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `blocks` | Block[] | **Yes** | 0개 이상 (빈 col 허용) |

---

## Block 타입 목록

### `text`

```json
{ "type": "text", "style": "h1", "content": "제목 텍스트", "align": "center" }
```

| 필드 | 값 | 기본 |
|------|----|------|
| `style` | `h1` \| `h2` \| `h3` \| `body` \| `caption` \| `label` | `body` |
| `content` | string | `""` (빈 placeholder) |
| `align` | `left` \| `center` \| `right` | `left` |

---

### `asset`

```json
{ "type": "asset", "preset": "standard", "alt": "제품 이미지" }
```

| 필드 | 값 | 기본 |
|------|----|------|
| `preset` | `standard`(780px) \| `square`(860px) \| `tall`(1032px) \| `wide`(575px) \| `logo`(200×64px) | `standard` |
| `alt` | string (이미지 설명) | `""` |

---

### `gap`

```json
{ "type": "gap", "height": 40 }
```

| 필드 | 값 | 기본 |
|------|----|------|
| `height` | number (px) | `40` |

---

### `divider`

```json
{ "type": "divider", "color": "#cccccc", "style": "solid", "weight": 1 }
```

| 필드 | 값 | 기본 |
|------|----|------|
| `color` | hex | `#cccccc` |
| `style` | `solid` \| `dashed` \| `dotted` | `solid` |
| `weight` | number (px) | `1` |

---

### `iconCircle`

```json
{ "type": "iconCircle", "size": 240, "bgColor": "#e8e8e8" }
```

| 필드 | 값 | 기본 |
|------|----|------|
| `size` | number (px) | `240` |
| `bgColor` | hex | `#e8e8e8` |

---

### `labelGroup`

```json
{ "type": "labelGroup", "labels": ["라벨1", "라벨2", "라벨3"] }
```

| 필드 | 값 | 기본 |
|------|----|------|
| `labels` | string[] | `["라벨"]` |

---

### `table`

```json
{ "type": "table", "showHeader": true, "cellAlign": "center" }
```

| 필드 | 값 | 기본 |
|------|----|------|
| `showHeader` | boolean | `true` |
| `cellAlign` | `left` \| `center` \| `right` | `center` |

---

### `card`

```json
{ "type": "card", "count": 2, "bgColor": "#f5f5f5", "radius": 12 }
```

| 필드 | 값 | 기본 |
|------|----|------|
| `count` | `2` \| `3` | `2` |
| `bgColor` | hex | `#f5f5f5` |
| `radius` | number (px) | `12` |

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

| 필드 | 값 | 기본 |
|------|----|------|
| `chartType` | `bar-v` \| `bar-h` | `bar-v` |
| `items` | `{ label, value }[]` | 5개 샘플 |

---

## 전체 예시 — 이미지+텍스트 2열 섹션

```json
{
  "schema": "goditor-spec/v1",
  "sections": [
    {
      "label": "Hook",
      "settings": { "bg": "#f9f9f9", "padX": 32, "padY": 48 },
      "rows": [
        {
          "layout": "flex",
          "ratio": "1:2",
          "cols": [
            {
              "blocks": [
                { "type": "asset", "preset": "square" }
              ]
            },
            {
              "blocks": [
                { "type": "text", "style": "label", "content": "브랜드명", "align": "left" },
                { "type": "text", "style": "h1", "content": "메인 카피라이팅", "align": "left" },
                { "type": "gap", "height": 16 },
                { "type": "text", "style": "body", "content": "제품 설명 문장이 들어갑니다.", "align": "left" },
                { "type": "labelGroup", "labels": ["특징1", "특징2", "특징3"] }
              ]
            }
          ]
        },
        {
          "layout": "stack",
          "ratio": "100",
          "cols": [
            {
              "blocks": [
                { "type": "divider" },
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

## 이미지 분석 봇 프롬프트 힌트

GPT/Gemini 등 이미지 분석 봇에게 전달할 지시 포인트:

1. **레이아웃 파악**: 이미지에서 단열/2열/3열 구조 판단 → `layout` + `ratio` 결정
2. **블록 식별**: 텍스트(제목/본문/캡션), 이미지 영역, 구분선, 리스트 등 → 대응 블록 타입 선택
3. **텍스트 추출**: 가능하면 실제 텍스트 추출, 불가능하면 `content: ""` 또는 의미 있는 placeholder
4. **섹션 목적 판단**: 이미지가 어떤 역할인지 → `label` (Hook/Main/Detail/CTA)
5. **출력 포맷**: 반드시 이 스펙 JSON만 출력, 설명 텍스트 없이

---

## 버전 히스토리

| 버전 | 날짜 | 변경 |
|------|------|------|
| v1 | 2026-04-03 | 초안 — 기본 블록 타입 전체 정의 |
