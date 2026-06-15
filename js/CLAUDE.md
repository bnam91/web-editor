# js/ — 모듈별 작업 지침

> 이 파일은 js/ 폴더 내 특정 파일에 적용되는 세부 규칙을 담는다.
> 프로젝트 전체 원칙은 루트 CLAUDE.md를 참고한다.

---

## drag-drop.js — absolute 요소 draggable 규칙

- **absolute 요소(text-frame, shape-block 등)는 HTML5 drag 완전 비활성화**: `draggable` 속성 미설정 + `removeAttribute`
  - `draggable="true"` 설정 시 `.dragging` 클래스 → opacity:0.25 적용됨
  - 저장 HTML에 `draggable="true"`가 남아있을 수 있으므로 rebind 시 명시적 `removeAttribute('draggable')` 필요
- 판단 조건: `dragTarget.style.position !== 'absolute' && block.style.position !== 'absolute'` 일 때만 `draggable="true"` 설정
- dragstart 차단 조건: `block.style.position === 'absolute' || dragTarget.style.position === 'absolute'` 양쪽 모두 포함
- 드래그 허용 조건: text-block 미선택이어도 freeLayout 부모 frame이 `.selected`이면 드래그 허용

---

## drag-drop.js — 섹션 → freeLayout 드롭 시 draggable 잔류 버그

**현상**: 섹션에서 freeLayout으로 text-frame 드롭 후, 다음 드래그 시 `.dragging` 클래스 → 연회색 고착

**원인**: 섹션 배치 시 `draggable="true"` 설정 → freeLayout 드롭 후 제거 누락 + `_dragBound = true` 플래그로 rebind 건너뜀

**수정 위치**: freeLayout drop 핸들러 내 text-frame 처리 블록

```js
dragSrc.removeAttribute('draggable');
dragSrc._dragBound = false;    // 재바인딩 허용
inner.appendChild(dragSrc);
const _tb = dragSrc.querySelector('.text-block');
if (_tb) { _tb._blockBound = false; bindBlock(_tb); }
```

**절대 하지 말 것**: text-frame을 freeLayout에 추가한 후 `draggable` 속성을 유지하는 코드 복원 금지

---

## drag-drop.js — 드롭 인디케이터 위치 저장 규칙

`onUp`에서 indicator를 DOM으로 다시 찾으면 이미 제거된 후일 수 있다.

**올바른 패턴**: `onMove`에서 삽입 기준 element를 closure 변수에 직접 저장.

```js
// onMove에서 저장
let _dropInsertBefore = null;
_dropInsertBefore = getDragAfterElement(inner, ev.clientY) || null;

// onUp에서 사용 (clearDropIndicators() 호출 후에도 유효)
const ref = _dropInsertBefore && _dropInsertBefore.parentNode === inner ? _dropInsertBefore : null;
if (ref) inner.insertBefore(dragEl, ref);
else     inner.appendChild(dragEl);
```

**절대 하지 말 것**: `indicator.nextSibling`을 onUp에서 저장하거나 `clearDropIndicators()` 이후에 `inner.querySelector('.drop-indicator')` 호출

---

## 스마트 가이드 (`js/smart-guides.js`)

- `SNAP_THRESHOLD = 10px` — 이 범위 내 접근 시 정렬 위치로 자석 스냅
- `GUIDE_THRESHOLD = 12px` — 이 범위 내 접근 시 빨간 가이드선 표시
- `showGuides(dragEl, parentFrame, scale)` 는 반드시 **`dragEl.style.left/top` 업데이트 후** 호출할 것
- 가이드선은 `#ss-handles-overlay` (position:fixed)에 렌더링 — viewport 좌표 사용
- `hideGuides()` 는 mouseup에서 호출

---

## 레퍼런스 모달 (`reference-modal.js`)

- 툴바는 모달 위에 `position:absolute` 오버레이 (이미지 크기 변화 없음)
- hover 시 height 0 → 32px 슬라이드다운
- 이미지 영역 전체 드래그 가능 (`ref-image-wrap` mousedown)
- 우하단 리사이즈 핸들 (`#ref-resize-handle`, z-index:3) — `mousedown` 인터셉트 가드 필요
- 슬라이더/버튼/input은 `e.target.closest('button, input, label, #ref-resize-handle')` 체크로 드래그 차단

---

## 텍스트 블록 패딩 (`prop-text.js`)

- 상하 패딩은 단일 슬라이더 `txt-pv-slider`로 top/bottom 동시 조절
- 개별 top/bottom 슬라이더 없음
