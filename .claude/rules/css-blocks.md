---
paths:
  - "css/**"
---

# CSS 편집 시 적용 규칙

## 블록 선택 스타일 (변경 금지)

### 선택 outline 표준 — **`--sel-outline-w` 토큰으로 통일** (DS-09, 2026-06-14)

> 과거에는 컨테이너(frame) 3px / 컴포넌트 1px로 분리했으나, 코드는 **모든 블록을 단일 토큰
> `--sel-outline-w`(= `calc(1px * var(--inv-zoom,1))` — 줌 보정 ≈ 1px)로 통일**했다. 두께 분기는 폐기됨.

| 종류 | outline | offset | 적용 블록 |
|---|---|---|---|
| **모든 선택 블록(통일)** | `var(--sel-outline-w) solid var(--sel-color)` | `calc(-1 * var(--sel-outline-w))` | `text/asset/card/table/graph/step/icon-circle/icon-text/divider/frame-block`(banner-preset 유무 무관), 기타 전 블록 |

- **줌 보정**: `--sel-outline-w`가 `--inv-zoom`을 곱해, 캔버스를 확대/축소해도 선택 테두리가 화면상 일정 두께로 보인다.
- **색은 모두 동일**: `var(--sel-color)` (파란색).
- **배경 fill 없음**: selected 상태에서는 배경색 변화 없이 outline만 표시.

### 신규 컴포넌트 블록 추가 시 (frame-block 변형 패턴 포함)

> 선택 outline이 `--sel-outline-w` 단일 토큰으로 통일된 뒤로는, frame-block을 재사용하는 컴포넌트
> (`data-xxx-preset`)도 같은 토큰을 상속받으므로 **두께 불일치를 막는 별도 override가 더 이상 필요 없다**.
> 단, 컴포넌트가 자체 outline 규칙을 둘 경우에도 폭은 반드시 `var(--sel-outline-w)`를 쓸 것(하드코딩 px 금지).

```css
/* 통일 표준 — 전 블록 공통 */
.frame-block.selected {
  outline: var(--sel-outline-w) solid var(--sel-color);
  outline-offset: calc(-1 * var(--sel-outline-w));
}
```

### 절대 하지 말 것
- `.text-block`에 `border-radius` 추가하지 말 것
- `box-shadow: 0 0 0 2px` 방식으로 돌아가지 말 것 (overflow:hidden 간섭 위험)
- selected 상태에 `background` 추가하지 말 것
- 컴포넌트 outline에 3px 두께를 쓰지 말 것 (컨테이너 표준과 혼선)

### speech-bubble은 별도 패턴
구조가 달라 `.frame-block::after`로 처리 — 아래 별도 섹션 참조.

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
