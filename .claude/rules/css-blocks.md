---
paths:
  - "css/**"
---

# CSS 편집 시 적용 규칙

## 블록 선택 스타일 (변경 금지)

### 두 가지 outline 표준 — **컴포넌트 vs 컨테이너**

| 종류 | outline | offset | 적용 블록 |
|---|---|---|---|
| **컴포넌트(component)** | `1px solid var(--sel-color)` | `-1px` | `text-block`, `asset-block`, `card-block`, `table-block`, `graph-block`, `step-block`, `icon-circle-block`, `icon-text-block`, `divider-block`, **`frame-block[data-banner-preset]`**, 기타 단일 컴포넌트 블록 |
| **컨테이너(container)** | `3px solid var(--sel-color)` | `0` | `frame-block` (data-banner-preset 없는 일반 frame) |

- **컨테이너는 두꺼운 outline** — 자식들을 감싸는 영역이라 흰 배경에서 잘 보이도록.
- **컴포넌트는 얇은 outline** — 콘텐츠 자체가 시각 정보라 outline이 콘텐츠를 가리지 않도록.
- **색은 모두 동일**: `var(--sel-color)` (파란색).
- **배경 fill 없음**: selected 상태에서는 배경색 변화 없이 outline만 표시.

### 신규 컴포넌트 블록 추가 시 (frame-block 변형 패턴 포함)

> `step/card/table`처럼 frame-block을 **구조적으로 재사용**(`data-xxx-preset` 속성)하는 컴포넌트는 **반드시 컴포넌트 outline을 별도 적용**해야 함. frame-block의 3px이 자동 상속되지 않도록 더 구체적인 selector로 override.

```css
.frame-block[data-banner-preset].selected {
  outline: 1px solid var(--sel-color);
  outline-offset: -1px;
}
```

**왜 자동 안 되는지**: `.frame-block.selected { outline: 3px ...; }` 룰이 이미 있어서 `[data-banner-preset]`만 추가해도 selector 특이도(specificity)가 더 높아 override됨. 이 명시 override 빠뜨리면 모든 컴포넌트가 두꺼운 컨테이너 outline을 받아 다른 컴포넌트 블록과 두께 불일치.

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
