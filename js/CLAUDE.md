# js/ — 모듈별 작업 지침

> 이 파일은 js/ 폴더 내 특정 파일에 적용되는 세부 규칙을 담는다.
> 프로젝트 전체 원칙은 루트 CLAUDE.md를 참고한다.

---

## ★히스토리 규약 (`js/history.js` · pushHistory) — **바꾸기 «전»에 1회**

`pushHistory()` 는 **부르는 «그 시점»의 캔버스를 통째로 찍는다.** 그래서 「언제 부르느냐」가
곧 규약이고, 이 레포는 그 규약이 **두 벌**로 갈라져 있었다(2026-09-20 정본 확정).

- **push-before(정본, 다수파)** — 바꾸기 «전»에 찍는다. `block-factory.js` 40+ 자리가 이 꼴.
- ~~push-after~~ — `onUp` 에서 바꾼 «뒤»에 찍던 드래그류. **더 쓰지 않는다.**

각각 «혼자» 쓰면 둘 다 일관된다. ★**섞이면 그 이음매에서 항목 한 칸이 통째로 빈다.**

```
원 삽입(push-before)   push(B = 원이 «없는» 캔버스) → 삽입    stack=[S0,B]    pos=1
첫 리사이즈(push-after) 드래그(기록 0) → onUp 에서 push(A)     stack=[S0,B,A]  pos=2  live===A
⌘Z  ├ ensureHistoryCheckpoint → live===stack[2] 라 «아무것도 안 쌓인다»
    └ pos-- → 1 → restoreSnapshot(B) = 원이 «없는» 캔버스  ⇒ 블럭 «삽입»이 사라진다
```

「원이 100px 로 막 삽입된 상태」라는 스냅샷이 스택에 **단 한 번도 없다** — ⌘Z 한 번이
리사이즈와 삽입을 **한꺼번에** 먹는다. 둘째 리사이즈부터는 `[…,A1,A2]` 라 정상이라,
증상이 **「최초 한 번만」** 나타난다(현빈 2026-09-20 제보가 정확히 이 모양이었다).
⚠️도형 전용이 아니다 — push-before 동작 «무엇 뒤에든» push-after 드래그가 오면 그 앞
동작이 같이 날아간다(타이핑 → 프레임 리사이즈 → ⌘Z = 타이핑까지 소실).

### 드래그에서 지켜야 할 꼴

`js/drag-history.js` 의 `window.beginDragHistory(label, {minPx})` 를 쓴다. 호출부는 두 줄.

```js
const _hist = window.beginDragHistory?.('도형 크기');   // mousedown 안에서 «제스처마다» 1개
function onMove(ev) {
  ... dx, dy 를 «캔버스 좌표»로 구한 다음 ...
  if (_hist && !_hist.arm(dx, dy)) return;              // 첫 arm 에서만 pushHistory 1회
  ... 기존 쓰기 ...
}
function onUp() { /* pushHistory 없음 */ }
```

- **dx/dy 는 «캔버스 좌표»**(화면 델타 ÷ scale). 화면 px 로 재면 40% 줌에서 임계가 2.5배가
  되어 첫 미세 이동이 기록 없이 샌다(현빈 실사용 줌이 40%다).
- `arm()` 이 true 를 돌려준 **그 틱에서 기존 쓰기를 반드시 마저 한다** — early-return 이
  첫 변형까지 삼키면 한 프레임이 사라진다.
- 한 제스처에 헬퍼는 **하나**. mousedown 쪽 push 와 같이 쓰면 항목이 2개 쌓인다.
- 기계 게이트: `tests/unit/drag-history-push-before.test.mjs` 가 로스터를 잠근다.
  행동 회귀: `tests/dom/resize-undo-history.dom.spec.js`(음성대조 포함).

### 허용목록 — `onUp` 에서 찍는 게 **맞는** 세 자리

| 자리 | 이유 |
|---|---|
| `js/scratch-pad.js` (`sideEffects`) | 캔버스는 안 바뀌고 `sideEffects.onUndo/onRedo` 로 역동작을 «명시»한다. 정당한 push-after. |
| `js/block-drag.js` 드래그아웃 | `onUp` 안이지만 **그 뒤의 추출 변형보다 앞**이라 실질 push-before. |
| `js/overlay-handles.js` 그리드 거터 | 이미 `mousedown` 에서 1회 찍는다. |

### 남은 P2 (별도 카드)

1. `pushHistory` 의 **무변화 중복 차단** — `onUp` 은 «안 움직인 맨클릭»에도 발화하므로
   ⌘Z 뒤 핸들을 툭 누르기만 해도 redo 꼬리가 잘린다(`historyStack.slice(0, historyPos+1)`).
   ⛔`sideEffects` 로 «일부러» 같은 캔버스를 찍는 자리를 깨뜨리므로 그냥 막으면 안 된다.
2. 그리드 거터의 맨클릭 중복 항목.
3. `js/block-drag.js` 드래그아웃이 «이동 자체»는 기록하지 않는 건.

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
