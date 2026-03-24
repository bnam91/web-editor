# Goya Web Editor — Design System

> 에디터 UI의 시각적 언어와 컴포넌트 규칙을 기록한 문서.
> CSS 변경 전 반드시 확인할 것.

---

## 1. 색상 토큰 (CSS Variables)

```css
:root {
  /* 선택 색상 */
  --sel-color:        #2d6fe8;          /* 선택 outline 색 */
  --sel-color-hover:  rgba(45,111,232,0.4);  /* (미사용, 예비) */
  --sel-color-fill:   rgba(45,111,232,0.08); /* hover 배경 tint */

  /* 텍스트 프리셋 — 사용자 변경 가능 */
  --preset-h1-color:      #111111;
  --preset-h1-family:     'Noto Sans KR', sans-serif;
  --preset-h2-color:      #1a1a1a;
  --preset-h2-family:     'Noto Sans KR', sans-serif;
  --preset-h3-color:      #333333;
  --preset-h3-family:     'Noto Sans KR', sans-serif;
  --preset-body-color:    #555555;
  --preset-body-family:   'Noto Sans KR', sans-serif;
  --preset-caption-color: #999999;

  /* 레이블 블록 프리셋 */
  --preset-label-bg:     #111111;
  --preset-label-color:  #ffffff;
  --preset-label-radius: 8px;
}
```

---

## 2. 블록 선택/호버 상태 (⚠️ 변경 금지)

### 설계 원칙
| 상태 | 방식 | 참고 |
|------|------|------|
| **Hover** | `::after` pseudo로 `var(--sel-color-fill)` 배경 tint | GitHub row-highlight 스타일 |
| **Selected** | `outline: 2px solid var(--sel-color); outline-offset: 0` | Figma 스타일 — 요소 경계에 딱 붙음 |

### 적용 패턴
```css
/* hover */
.xxx-block:hover::after {
  content: '';
  position: absolute;
  inset: 0;
  background: var(--sel-color-fill);
  pointer-events: none;
  z-index: 0;
}

/* selected */
.xxx-block.selected {
  outline: 2px solid var(--sel-color);
  outline-offset: 0;
}
```

### ❌ 하지 말 것
- `outline-offset`을 양수(outer gap)나 음수(inner)로 변경 금지
- `selected`에 `background` 추가 금지
- `box-shadow: 0 0 0 2px` 방식 사용 금지 (overflow:hidden 간섭)
- 텍스트 블록에 `border-radius` 추가 금지

---

## 3. 레이아웃 구조 (Section → Row → Col)

```
Section (.section-block)
  └─ Row (.row)
       ├─ Col (.col[data-width="50"])
       │    └─ 콘텐츠 블록
       └─ Col (.col[data-width="50"])
            └─ 콘텐츠 블록
```

### Col 너비 옵션
| data-width | 비율 | 설명 |
|-----------|------|------|
| `100` | 전체 | 단독 전체 폭 |
| `75` | 3/4 | |
| `66` | 2/3 | |
| `50` | 1/2 | 2단 동일 |
| `33` | 1/3 | |
| `25` | 1/4 | |

---

## 4. 콘텐츠 블록 목록

| 블록 | 클래스 | 용도 |
|------|--------|------|
| Text | `.text-block` | 텍스트 (h1/h2/h3/body/caption/label) |
| Asset | `.asset-block` | 이미지/배경 이미지 |
| Gap | `.gap-block` | 여백 |
| Icon Circle | `.icon-circle-block` | 원형 아이콘+이미지 |
| Table | `.table-block` | 비교표/데이터 테이블 |
| Label Group | `.label-group-block` | 태그/뱃지 그룹 |
| Card | `.card-block` | 이미지+제목+설명 카드 (border-radius: 12px) |
| Strip Banner | `.strip-banner-block` | 좌우 분할 배너 |
| Divider | `.divider-block` | 구분선 |
| Group | `.group-block` | 블록 묶음 |

---

## 5. 텍스트 블록 타입별 기본값

| 타입 | 클래스 | 크기 | 굵기 | 색상 | line-height |
|------|--------|------|------|------|------------|
| H1 | `.tb-h1` | 104px | 700 | `--preset-h1-color` | 1.1 |
| H2 | `.tb-h2` | 72px | 600 | `--preset-h2-color` | 1.15 |
| H3 | `.tb-h3` | 52px | 600 | `--preset-h3-color` | 1.2 |
| Body | `.tb-body` | 36px | 400 | `--preset-body-color` | 1.6 |
| Caption | `.tb-caption` | 26px | 400 | `--preset-caption-color` | 1.6 |
| Label | `.tb-label` | — | — | `--preset-label-color` | — |

텍스트 블록 기본 패딩: `32px 20px` (상하 패딩은 `txt-pv-slider`로 상하 동시 조절)

---

## 6. 레퍼런스 모달 (`#reference-modal`)

- 툴바: `position:absolute` 오버레이 — 이미지 영역 크기 영향 없음
- 표시 조건: modal `mouseenter` → height 0 → 32px 슬라이드다운
- 이미지 영역 전체 드래그 가능 (`mousedown` on `#ref-image-wrap`)
- 드래그 차단 대상: `button, input, label, #ref-resize-handle`
- 리사이즈 핸들: 우하단 `#ref-resize-handle` (z-index: 3)
- 불투명도: 최소 30%, 최대 100%

---

## 7. 줌 보정 (`--inv-zoom`)

에디터 캔버스가 CSS scale로 줌이 적용될 때, UI 레이블/툴바 등은 줌에 반비례하여 실제 크기를 유지해야 함.

```css
transform: scale(var(--inv-zoom, 1));
transform-origin: left center; /* 또는 맥락에 맞게 */
```

적용 대상: `.section-label`, `.st-btn` 계열, 이미지 편집 핸들 등
