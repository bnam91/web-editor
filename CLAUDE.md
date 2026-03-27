# Web Editor — Claude 작업 지침

## 블록 선택 스타일 (변경 금지)

블록 hover/selected 시각 스타일은 아래 설계를 유지해야 한다. 임의로 바꾸지 말 것.

### 원칙
- **Hover**: `::after` pseudo-element로 배경 tint만 표시 (GitHub row-highlight 스타일)
- **Selected**: `outline: 2px solid var(--sel-color); outline-offset: 0` — 요소 경계에 딱 붙임 (Figma 스타일)
- **배경 fill 없음**: selected 상태에서는 배경색 변화 없이 outline만 표시

### 절대 하지 말 것
- `.selected` 규칙에 `outline-offset` 값을 양수(outer gap)나 음수(inner)로 바꾸지 말 것
- `.text-block`에 `border-radius` 추가하지 말 것 (텍스트 블록은 직사각형이어야 함)
- `box-shadow: 0 0 0 2px` 방식으로 돌아가지 말 것 (overflow:hidden 간섭 위험)
- selected 상태에 `background` 추가하지 말 것

### 적용된 블록 목록
`section-block`, `text-block`, `label-group-block`, `label-item`, `asset-block`,
`overlay-tb`, `gap-block`, `table-block`, `graph-block`, `card-block`,
`strip-banner-block`, `divider-block` — 모두 `outline-offset: 0` 통일

---

## 레퍼런스 모달 (`js/reference-modal.js`)

- 툴바는 모달 위에 `position:absolute` 오버레이 (이미지 크기 변화 없음)
- hover 시 height 0 → 32px 슬라이드다운
- 이미지 영역 전체 드래그 가능 (`ref-image-wrap` mousedown)
- 우하단 리사이즈 핸들 (`#ref-resize-handle`, z-index:3) — `mousedown` 인터셉트 가드 필요
- 슬라이더/버튼/input은 `e.target.closest('button, input, label, #ref-resize-handle')` 체크로 드래그 차단

---

## 텍스트 블록 패딩 (`js/prop-text.js`)

- 상하 패딩은 단일 슬라이더 `txt-pv-slider`로 top/bottom 동시 조절
- 개별 top/bottom 슬라이더 없음
