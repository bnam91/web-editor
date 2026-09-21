# js/ — 모듈별 작업 지침

> 이 파일은 js/ 폴더 내 특정 파일에 적용되는 세부 규칙을 담는다.
> 프로젝트 전체 원칙은 루트 CLAUDE.md를 참고한다.

---

## ★히스토리 규약 (`js/history.js` · pushHistory) — **드래그는 «양쪽 끝»을 찍는다**

`pushHistory()` 는 **부르는 «그 시점»의 캔버스를 통째로 찍는다.** 그래서 히스토리 스택은
「상태를 찍은 **표본의 줄**」이고, ⌘Z 는 «한 칸 앞 표본»으로 되돌린다.
⇒ undo 가 맞으려면 **동작과 동작 «사이»마다 표본이 하나씩** 있어야 한다.

이 레포엔 «언제 부르느냐»가 **두 벌**이고, 둘 다 자기 동작의 한쪽 끝만 찍는다.

| 규약 | 뜻 | 실측 자리 수(2026-09-20 기계 분류) |
|---|---|---|
| **push-before** | 바꾸기 «전»에 찍는다 (`block-factory` 삽입류) | 109 |
| **push-after** | 바꾼 «뒤»에 찍는다 (우측 패널 대다수 · 드래그 `onUp`) | **258** |

★**어느 쪽도 「다수파로 통일」할 만한 크기가 아니다** — 전수 개종은 회귀면이 너무 넓다.
그리고 각각 «혼자» 쓰면 둘 다 일관된다. **섞이는 이음매에서만** 둘 중 하나가 난다.

```
⑴ before → after : 두 동작 «사이»의 표본이 «없다» ⇒ ⌘Z 한 번이 둘을 같이 먹는다
     원 삽입(before: 삽입 «전»을 찍음) → 첫 리사이즈(after: 리사이즈 «뒤»를 찍음)
     ⇒ 「원이 100px 로 막 삽입된」 표본이 스택에 단 한 번도 없다
     ⇒ ⌘Z = 리사이즈 + «삽입» 둘 다 취소  ← 현빈 2026-09-20 제보가 정확히 이 모양
⑵ after → before : 같은 상태를 «두 번» 찍는다 ⇒ ⌘Z 한 번이 화면을 안 바꾼다(먹통)
```

### 그래서 드래그는 «양쪽 끝»을 다 찍는다 (정본)

드래그 제스처는 **onMove 첫 틱에 «시작 상태»**(`js/drag-history.js`), **onUp 에 «끝 상태»**
(기존 `pushHistory` 호출 그대로)를 찍는다. 그러면 어느 이웃을 만나도 표본이 안 빈다.

- 앞이 **push-before**(삽입)였다면 → 우리 «시작» 표본이 그 빠진 칸을 메운다 ⇒ ⑴ 해소
- 앞이 **push-after** 였다면 → 우리 «시작» 표본이 그 «끝» 표본과 같은 상태다
  ⇒ `pushHistory` 의 **무변화 중복 차단**이 조용히 버린다 ⇒ ⑵ 해소

⇒ 이웃 **258자리를 안 건드리고** 두 병을 같이 없앤다. 값은 드래그당 직렬화 1회 추가
(실측 p90 1.6ms / 1081요소 · 판정선 100ms 의 1/60).

⛔**`onUp` 의 `pushHistory` 를 «떼서» onMove 로 옮기지 마라.** 그건 규약을 통일한 게 아니라
**이음매를 옮기는 것**이라, 고친 드래그 뒤에 «안 고친» push-after 가 오는 순간 ⑴ 이 그대로
재발한다(2026-09-20 1차 수정이 실제로 그 회귀를 냈다 — 리사이즈 뒤 회전 ⌘Z 가 크기까지 되돌림).

```js
const _hist = window.beginDragHistory?.('도형 크기');   // mousedown 안에서 «제스처마다» 1개
function onMove(ev) {
  ... dx, dy 를 «캔버스 좌표»로 구한 다음 ...
  _hist?.arm(dx, dy);          // ★첫 실제 이동 직전 1회
  ... 기존 쓰기 그대로 ...
}
function onUp() { ...; window.pushHistory?.('도형 크기'); }   // ←기존 호출 «유지»
```

- **dx/dy 는 «캔버스 좌표»**(화면 델타 ÷ scale). 화면 px 로 재면 40% 줌에서 임계가 2.5배가
  된다(현빈 실사용 줌이 40%다).
- ⛔**`arm()` 의 반환값으로 쓰기를 막지 마라.** 1차 수정은 `if (!arm()) return;` 이었는데,
  그러면 임계 미만 틱에서 **히스토리뿐 아니라 리사이즈 자체가 사라진다** — 줌 150% 에서
  화면 1px 드래그(=캔버스 0.67px)가 무동작이 되는 회귀가 실측됐다. 기본 임계는 **0** 이다
  («움직이기만 하면» 연다). 완전 정지(0,0)만 안 연다.
- 한 제스처에 헬퍼는 **하나**. `onMove` «안»에서 만들면 틱마다 항목이 쌓인다.
- 시작 표본의 라벨은 **직전 항목의 이름을 물려받는다** — 되돌리기 버튼은
  `historyStack[pos].action` 을 보여주는데 실제로 복원되는 건 `[pos-1]` 이기 때문이다.
- 기계 게이트: `tests/unit/drag-history-push-before.test.mjs` 가 로스터·양쪽 끝·early-return
  금지를 잠근다. 행동 회귀: `tests/dom/resize-undo-history.dom.spec.js`(음성대조 4벌).

### `pushHistory` 의 무변화 중복 차단 (`js/history.js`)

꼭대기와 **캔버스·pageSettings·pageId 가 모두 같으면 안 쌓는다**(그리고 redo 꼬리도 안 자른다).
- ⚠️예외 = `sideEffects` 가 있는 호출(`js/scratch-pad.js` 스크래치 리사이즈 — 캔버스는
  그대로여도 `onUndo/onRedo` 로 역동작을 «명시»한다). 이걸 버리면 되돌릴 게 사라진다.
- 덤으로: 안 움직인 «맨클릭»이 만들던 빈 항목과 그것이 redo 꼬리를 자르던 결함이 같이 사라진다.

### 허용목록 — 「이 자리는 이래도 되는」 세 자리

| 자리 | 이유 |
|---|---|
| `js/scratch-pad.js` (`sideEffects`) | 캔버스는 안 바뀌고 `sideEffects.onUndo/onRedo` 로 역동작을 «명시»한다. 무변화 차단의 예외이기도 하다. |
| `js/block-drag.js` 드래그아웃 | 시작 표본은 `onMove` 가 찍었다. 끝 표본은 **추출까지 끝난 뒤** «한 번». (예전엔 추출 «전»에 찍었는데, 지금 그러면 한 제스처가 항목 둘이 된다.) |
| `js/overlay-handles.js` 그리드 거터 | 시작은 이미 `mousedown` 1회. 끝 표본만 `onUp` 에 더했다. |
| `js/insert-history.js` (삽입 입구 래퍼) | 삽입 입구는 `pushHistory` 를 «앞»에 부른다(그대로 둔다). 래퍼가 «돌아온 직후» 한 번 더 부른다 — ⑴ 이음매용 «끝 표본»이다. 입구 안의 호출을 떼면 안 된다(그건 «옮기기»다). |

## 삽입 입구 «선택 따라가기» (T-084 · 2026-09-22)

블럭을 넣으면 **파란 선택 표시와 우측 패널이 «새 블럭»으로 옮겨가야 한다.**
정본은 세 자리이고, 목록을 새로 만들지 않는다.

| 자리 | 하는 일 |
|---|---|
| `js/block-edit.js` `selectBlock` | 「무엇이 선택됐나」의 **정본 한 자리**. `clearSelectionMarks`(옛 표시 전부) + `openPanelForBlock`(우측 패널) + `highlightBlock`(좌측 레이어)를 한 벌로 한다. |
| `js/panel-dispatch.js` `_PANEL_BY_CLASS` | 「이 블럭의 패널은 무엇인가」의 정본 표. `hasPanelForBlock` 이 **같은 표**를 읽어 「블럭인가」까지 답한다(`getBlockById` 가 이걸 쓴다 — `dataset.type` 이 없는 `.asset-block`·`.icon-text-block`·`.label-group-block` 때문). |
| `js/insert-select.js` (삽입 입구 래퍼) | 로스터(=`js/insert-history.js` 의 `__insertSeamRoster`)로 입구 41자리를 감싸, **입구가 스스로 새 것을 고르지 «않았을 때만»** 새로 생긴 «잎» 블럭을 `selectBlock` 으로 고른다. ⛔입구마다 한 줄씩 적지 마라 — 2026-09-22 실측에서 41자리 중 12자리가 빠져 있었다. |

⛔`.selected` 를 여기서 직접 붙이지 마라(표시가 두 벌이 된다) · 미루지 마라(다음 클릭이 선택을 뺏는다).
⚠️`showSectionProperties` 는 **async** 다 — `await` 뒤에 「부를 때는 선택돼 있었는데 지금은 아니면 접는다」
가드가 있다. 없으면 늦게 온 섹션 패널이 새 블럭 패널을 덮는다(`addDeviceMockupBlock`·`addPresetRow` 실측).
게이트: `tests/unit/insert-select-roster.test.mjs` · `tests/dom/insert-select-follows.dom.spec.js` ·
`tests/dom/select-block-submarks.dom.spec.js`.

### 남은 P2 (별도 카드)

1. ~~★「삽입(push-before) → 우측 패널(push-after)」 이음매~~ → **해소(T-131 · 2026-09-21)**.
   258/109 를 통일하지 «않고» 고쳤다 — `js/insert-history.js` 가 삽입 입구(41자리)를 감싸
   «돌아온 직후» `window.pushHistory` 를 한 번 더 부른다(=«끝 표본»). 드래그가 안 끼는
   이음매도 이걸로 메워진다. ⛔입구 «안»의 push-before 는 하나도 안 뗐다(그건 «옮기기»라
   2026-09-20 회귀를 다시 낸다). 규약·게이트는 `js/insert-history.js` 머리말.
   ★같이 간 것 둘: `addTableBlock` 의 `setTimeout` 테마적용을 동기로 폈고(안 그러면 삽입만
   하고 ⌘Z 가 두 번이 된다), `_enterStickerEdit` 가 `.sticker-text` 에 남기던
   `user-select`·`cursor` 를 직렬화에서 세척한다(같은 이유 + 저장본 누수).
2. 그리드 거터의 맨클릭 중복 항목(무변화 차단이 대부분 흡수하지만 확인 안 했다).
3. `js/block-drag.js` 드래그아웃이 «이동 자체»를 별도 항목으로 기록하지 않는 건.

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
