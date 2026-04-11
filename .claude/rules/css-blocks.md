---
paths:
  - "css/**"
---

# CSS 편집 시 적용 규칙

## 블록 선택 스타일 (변경 금지)

### 원칙
- **Hover**: `::after` pseudo-element로 배경 tint만 표시 (GitHub row-highlight 스타일)
- **Selected**: `outline: 2px solid var(--sel-color); outline-offset: 0` — 요소 경계에 딱 붙임 (Figma 스타일)
- **배경 fill 없음**: selected 상태에서는 배경색 변화 없이 outline만 표시

### 절대 하지 말 것
- `.selected` 규칙에 `outline-offset` 값을 양수(outer gap)나 음수(inner)로 바꾸지 말 것
- `.text-block`에 `border-radius` 추가하지 말 것
- `box-shadow: 0 0 0 2px` 방식으로 돌아가지 말 것 (overflow:hidden 간섭 위험)
- selected 상태에 `background` 추가하지 말 것

### 적용된 블록 목록
`section-block`, `text-block`, `label-group-block`, `label-item`, `asset-block`,
`overlay-tb`, `gap-block`, `table-block`, `graph-block`, `card-block`,
`strip-banner-block`, `divider-block`, `frame-block` — 모두 `outline-offset: 0` 통일

---

## speech-bubble-block 선택 outline (변경 금지)

일반 블록과 구조가 달라 `frame-block::after` z-index:10 방식을 사용한다.

```css
.frame-block[data-text-frame="true"]:has(.speech-bubble-block.selected)::after {
  content: '';
  position: absolute;
  inset: 0;
  border: 1px solid var(--sel-color);
  z-index: 10;
  pointer-events: none;
  box-sizing: border-box;
}
.speech-bubble-block.selected { outline: none !important; }
```

```css
.speech-bubble-block { width: 100%; }
.speech-bubble-block[data-tail="right"]  .tb-bubble { margin-left: auto; }
.speech-bubble-block[data-tail="center"] .tb-bubble { margin-left: auto; margin-right: auto; }
.tb-bubble { display: block; width: fit-content; max-width: 80%; }
```

**이 패턴으로 돌아가지 말 것**: `width: fit-content`, `outline` 직접 적용, `z-index` 제거

---

## 코너 반경 핸들 시스템 (`#ss-handles-overlay`)

`position:fixed; z-index:9990` 공유 오버레이.

### frame-block 핸들
- **리사이즈**: `.ss-resize-handle` × 4 (nw/ne/sw/se)
- **코너 반경**: `.ss-radius-handle` × 4, 프레임 내부 10px 안쪽
  - `showFrameHandles(ss)` → 두 세트 동시 생성
  - `hideFrameHandles()` → `.ss-resize-handle`, `.ss-radius-handle` 제거 (asset 핸들 유지)

### asset-block 핸들
- **코너 반경**: `.asset-radius-handle` × 4, 블록 내부 10px 안쪽
  - `showAssetRadiusHandles(ab)` — 에셋 클릭 시 자동 호출
  - `hideAssetRadiusHandles()` — `deselectAll`에서 자동 해제

### 핸들 독립성 규칙
- `hideFrameHandles()`는 frame 핸들만 제거, asset 핸들 유지 (반대도 동일)
