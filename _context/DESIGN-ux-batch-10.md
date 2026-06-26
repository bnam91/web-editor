# DESIGN — goditor UX/버그 10건 배치 (feature/ux-batch-10)

> 작성: 태양(srv 별도세션) · 2026-06-26 · 1차 설계게이트(구현 전)
> worktree: `/Users/a1/web-editor-taeyang-ux` @ `feature/ux-batch-10` (from dev 7fcfcf9)
> 정찰: Explore ×5 (read-only, 라이브/실데이터 미접촉) + 직접 코드검증
> 제약: proj_1782317294600·proj_1782460804390 **실데이터 미접촉**(더미만) / 라이브 9334·렌즈 9335 미접촉 / 격리 9360에서만 / **머지 금지**

---

## 0. 요약 — 분류 & 난이도/리스크

| # | 항목 | 유형 | 난이도 | 리스크 | 상태 |
|---|------|------|--------|--------|------|
| 1 | 섹션 메모 패널 안 열림 | 버그(회귀) | 하 | 저 | **근본원인 확정** |
| 2 | 브릿지블럭 컴포넌트패널 노출 | 기능(노출) | 하 | 저 | 내장 컴포넌트 재사용 |
| 3 | 챗블럭 복사본 수정 불가 | 버그 | 하 | 저 | **근본원인 99% 확정** |
| 4 | 섹션 아이디 복사 토스트 | 기능 | 하 | 저 | 패턴 재사용 |
| 5 | 블럭 잘라내기 ⌘X | 기능 | 중 | 중 | copy+delete 재조합 |
| 6 | 복수선택 일괄 폰트사이즈 | 기능 | 중 | 중 | applySize 재사용 |
| 7 | 아웃라인 복수선택 활성화 | 버그/기능 | ? | ? | **⚠️ 확인 필요(이미 구현된 듯)** |
| 8 | 에셋블럭 A4 세로 프리셋 | 기능 | 하 | 저 | 버튼 1개 추가 |
| 9 | 갭블럭 프리셋 정리+숫자키 | 기능 | 하 | 저 | 배열/매핑 교체 |
| 10 | 복수선택 패널 버튼 디자인 | UI | 하 | 저 | CSS 정렬 |

독립단위(병렬 가능): 1, 2, 3, 4, 8, 9, 10. 의존단위(순차): 5←(copy/delete 공통화), 6←(복수선택 플러밍)·10은 6 산출 컨트롤 포함해서 마무리.

---

## 1. 섹션 메모 패널 안 열림 (버그·회귀)
**현상**: 섹션 헤더 메모(📝)버튼 클릭 시 팝오버 안 열림(sec_thhvp4d 관찰).
**근본원인(확정)**: 메모버튼은 인라인 `onclick="window.toggleSectionMemoPopover(this)"`로 생성됨(block-factory.js:1058,1070 / section-memo.js:189). 그러나 프로젝트 로드 시 `sanitizeCanvasHtml`(js/io/save-load.js:19, line 35 `if(name.startsWith('on')) removeAttribute`)가 **모든 `on*` 속성을 제거** → 저장/재로드된 섹션의 메모버튼은 시각상 존재하나 클릭 핸들러가 없어 무반응. (캔버스 innerHTML 주입 지점: save-load.js:294/345/443에서 항상 sanitize.)
**선례**: 동일 문제를 가진 브랜치(⎇)버튼은 save-load.js:726에서 **로드 후 onclick 재바인딩**으로 해결 중("직렬화 시 프로퍼티 유실 → 항상 재설정"). 메모버튼만 이 재바인딩 누락.
**`_ensureMemoButton`(section-memo.js:179) 한계**: ⓐ `DOMContentLoaded`(L198)에서 1회만 전체 순회 → 이후 프로젝트 로드/페이지 전환엔 미적용. ⓑ 기존 버튼이 있으면(onclick만 스트립된 상태) onclick 재설정을 보장하지 않음.
**수정안**:
- `_ensureMemoButton`이 **버튼 유무와 무관하게 onclick(또는 addEventListener 바인딩)을 항상 보장**하도록 보강.
- 프로젝트/페이지 로드 직후(save-load.js의 post-load 훅, ⎇재바인딩 L726 인접)에서 `document.querySelectorAll('.section-block').forEach(window._ensureMemoButton)` 호출.
- (선호) 장기적으로는 인라인 onclick → 위임(delegation) 이벤트로 전환해 sanitize 영향 차단. 단 이번 배치는 최소변경(재바인딩)으로 안전하게.
**변경면**: js/io/save-load.js(로드 후 메모버튼 재바인딩 1줄), js/section-memo.js(`_ensureMemoButton` onclick 항상보장).
**리스크/롤백**: 저(추가 호출만). 롤백=해당 호출 제거.
**테스트**: 더미 프로젝트에 섹션 생성→메모입력→저장→재로드→버튼 클릭 시 팝오버 open. 신규섹션/재로드섹션 양쪽.
**⚠️ 코디네이션**: `feat/section-memo` 브랜치(claude-pm 섹션메모, dev 미머지)가 별도로 존재. 단 dev의 UI 메모팝오버 코드는 완비 상태라 본 수정은 dev 기준 독립. feat/section-memo와 충돌 없을 것으로 보나 머지 시점은 지디 조율.

## 2. 브릿지블럭 — 컴포넌트패널 노출 (기능)
**해소된 모호점**: 신규 블록 아님. **내장 컴포넌트 "브릿지 (V 커버)"가 이미 존재** — js/component-shelf.js `_BUILTINS = [{id:'builtin_bridge', build:_buildBridgeHtml}]`. 풀폭 밴드+상단중앙 V홈(섹션경계 "아래로 이어짐" 표시). `_buildBridgeHtml`은 `section-block`(data-section=99) HTML 생성.
**현상**: 이 브릿지가 컴포넌트셸프(저장컴포넌트 브라우저)에만 있고, 중앙 플로팅 **컴퍼넌트패널 드롭다운**(index.html #fp-component-menu L623-634)엔 버튼이 없음.
**'laurle' 식별**: index.html L633 = **"Laurel" 버튼**(`addLaurelBlock()`), 메뉴 맨 끝. "바로 아래" = L634 신규 버튼.
**수정안**: ⓐ `addBridgeBlock()` 추가 — 기존 `_buildBridgeHtml()`(또는 component-shelf 내장삽입 경로) 재사용해 섹션 삽입(중복 HTML 작성 금지). ⓑ window 노출. ⓒ index.html L633 아래에 `<button class="fp-menu-item" onclick="addBridgeBlock();toggleFpDropdown(...)">Bridge</button>` 추가.
**변경면**: js/block-factory.js(또는 component-shelf 삽입 헬퍼 노출) + index.html 1줄.
**리스크/롤백**: 저. 롤백=버튼/함수 제거.
**테스트**: 더미에서 컴포넌트패널 열기→Laurel 아래 Bridge 클릭→V커버 섹션 삽입·렌더 확인.
**결정사항(지디 확인)**: 삽입 단위가 "섹션"이 맞는지(내장 브릿지가 section-block을 만듦). 블록 단위 기대였다면 알려달라 → 기본은 기존 내장 그대로(섹션).

## 3. 챗블럭 복사본 수정 불가 (버그)
**근본원인(99% 확정)**: `renderChatBlock()`(js/blocks/chat-block.js:137)이 `if(!block._chatEditBound){ …편집리스너 바인딩… }` 가드 사용. 블록 복제 시 `cloneNode(true)`(editor.js:699)가 `_chatEditBound=true`까지 복제 → 복제 후 리바인딩 코드(editor.js:716-719 dup / 867 paste)는 `_blockBound`만 리셋, **`_chatEditBound` 미리셋** → 복사본은 가드에 걸려 편집리스너 재바인딩 스킵 → 편집 불가.
**수정안(택1, 안전순)**: ⓐ `renderChatBlock` 가드 진입 전 또는 복제경로에서 `delete block._chatEditBound` — 가장 견고. 구현은 **dup(editor.js:717)·paste(editor.js:867) 양쪽에서 `delete b._chatEditBound`** + 방어적으로 renderChatBlock에서도 클론 감지 시 리셋.
**변경면**: js/editor.js:717, 867 (+선택적으로 chat-block.js:137 인근).
**리스크/롤백**: 저. 롤백=리셋 제거. (다른 `_*Bound` 플래그 패턴과 동일하므로 회귀위험 낮음.)
**테스트**: 더미에서 챗블럭 생성→복사/붙여넣기→복사본 텍스트 편집 가능 확인. 원본도 정상 유지.

## 4. 섹션 아이디 복사 토스트 (기능)
**현상**: 섹션 id 칩 클릭 시 클립보드 복사는 되나 토스트 없음. prop-section.js:168 `onclick="_copyToClipboard('${sec.id}')"`.
**패턴**: `window.showToast?.(msg)` 헬퍼 존재. scratch-pad.js:425-441 = 클립보드 write + 성공/실패 토스트 표준패턴(프로젝트 id 칩과 동일 계열).
**수정안**: 섹션 id 칩을 인라인 onclick → addEventListener(또는 `_copyToClipboard` 호출 후 토스트)로 전환, 성공 시 `window.showToast?.('📋 섹션 아이디 복사: '+sec.id)`. (프로젝트 id 토스트 문구/이모지와 톤 일치.)
**변경면**: js/props/prop-section.js:168 인근.
**리스크/롤백**: 저.
**테스트**: 섹션 id 칩 클릭→클립보드 값 + 토스트 노출 확인.

## 5. 블럭 잘라내기 ⌘X (기능)
**현재**: keydown 핸들러 editor.js:1052. ⌘C=L1105(`copySelected()` L760), ⌘V=L1111(`pasteClipboard()` L916). 클립보드 상태=`clipboard` 변수(L344). 삭제로직=Delete/Backspace L1548, 선택삭제 L1637-1683, 단일 `deleteBlock()` L2161. **⌘X/`x`키 미바인딩(충돌 없음).**
**수정안**: ⓐ 선택삭제 로직(L1637-1683)을 `deleteSelectedBlocks()` 함수로 추출(Delete 핸들러도 이걸 호출하도록 공통화 → 중복 제거). ⓑ ⌘V 핸들러 뒤(L1128 인근)에 `e.key==='x'` 분기 추가: 텍스트편집중/INPUT·TEXTAREA 가드 → `e.preventDefault(); copySelected(); deleteSelectedBlocks();`. 복사가 됐을 때만 삭제(빈 선택 가드).
**변경면**: js/editor.js (추출 1함수 + ⌘X 분기 + Delete 핸들러 호출 치환).
**리스크/롤백**: 중 — 삭제로직 공통화가 Delete 동작에 회귀 줄 수 있음 → 추출은 동작보존 리팩터로 신중히, 회귀테스트 필수. 롤백=분기/추출 되돌림.
**테스트**: 단일/복수/섹션 선택에서 ⌘X→클립보드 보관+원본 삭제, 이후 ⌘V 복원. Delete/Backspace 기존동작 회귀 없음. 텍스트 편집중 ⌘X는 OS 기본(텍스트 잘라내기)로 통과.

## 6. 복수선택 일괄 폰트사이즈 (기능)
**현재**: 복수선택 패널 `showFlowMultiSelPanel()`(js/props/prop-multisel.js:443-480) — 정렬/분배만. 단일 폰트사이즈=`applySizeToSel(v)`(js/props/prop-text-wireup-text-edit.js:97-143), 입력 `#txt-size-number`.
**수정안**: ⓐ 패널에 "폰트 크기" 섹션 + number 입력(`#msp-font-size`) 추가. ⓑ `_applyFlowFontSize(blocks,size)` 신규 — 선택된 텍스트블록 순회하며 각 contentEl에 사이즈 적용(applySizeToSel 로직 재사용; 전체선택=블록 style.fontSize 일괄). ⓒ 입력 change→히스토리 1엔트리로 묶어 적용. (선택영역 부분서식이 아닌 블록 전체 사이즈로 정의 — 복수선택 일괄의 자연스러운 시맨틱.)
**변경면**: js/props/prop-multisel.js + 폰트적용 헬퍼(재사용/소량 추가).
**리스크/롤백**: 중 — 다중 블록 일괄변경 시 history/undo 정합성 주의(1 undo로 되돌려야). 롤백=섹션 제거.
**테스트**: 텍스트블록 2+개 선택→사이즈 입력→전부 반영, undo 1회로 복원.

## 7. 아웃라인 복수선택 활성화 (⚠️ 확인 필요)
**정찰 결과**: "아웃라인"=레이어패널(js/panels/layer-panel-items.js). 이미 **Cmd/Ctrl+클릭=개별토글(L186), Shift+클릭=범위선택(L191)** 구현됨 → `window.toggleBlockSelect`(editor.js:426)·`rangeSelectBlocks`(editor.js:485) 호출, 캔버스와 동일 `.selected` 상태 공유, 복수선택 패널도 트리거됨.
**충돌**: 버그보고("현재 불가, sb_w3dduwe")와 정찰("이미 구현")이 상충.
**가설**: ⓐ 블록은 되나 **섹션(sb_/sec_) 복수선택**이 안 됨 / ⓑ 특정 케이스 회귀 / ⓒ 일반 클릭만 시도(수정키 없이) → 단일선택만 되는 걸 "불가"로 인식. 
**액션**: 격리 9360 + 더미에서 **재현 우선**해 실제 막히는 지점 특정 후 수정범위 확정. → **지디 확인 요청**: sb_w3dduwe에서 구체적으로 "무엇을 어떻게" 복수선택하려다 안 됐는지(블록 vs 섹션, 수정키 사용 여부). 모르면 더미 재현 결과로 판단.

## 8. 에셋블럭 A4 세로 프리셋 (기능)
**현재**: js/props/prop-asset.js:96-102 프리셋 버튼(Standard 860×780 / Square 860×860 / Tall 860×1032 / Wide 860×575 / Logo 200×64). 형식 `<button class="prop-preset-btn prop-type-btn" data-w data-h>라벨</button>`. 클릭핸들러(L270-333)가 data-w/h 범용 처리.
**수정안**: Logo 다음(L101 뒤)에 1개 추가 — A4 세로 210:297(1:1.414). 폭 860 기준 높이=860×(297/210)≈**1216** → `<button class="prop-preset-btn prop-type-btn" data-w="860" data-h="1216">A4</button>`. (860:1216 = 1:1.414 ✓.) 추가 코드 불필요.
**변경면**: js/props/prop-asset.js 1줄.
**리스크/롤백**: 저.
**테스트**: 에셋블럭 선택→A4 프리셋 클릭→860×1216 적용, 비율 확인.

## 9. 갭블럭 프리셋 정리 + 숫자키 재매핑 (기능)
**현재**: 프리셋배열 `[20,40,80,120,200]`(js/props/prop-gap.js:29). 숫자키 매핑 editor.js:1372 조건 `Digit1..5`, L1377 `{Digit1:20,Digit2:40,Digit3:80,Digit4:120,Digit5:200}`.
**수정안**: ⓐ prop-gap.js:29 배열 → `[20,40,80,120,160,200,240,280]`(160/240/280 신규). ⓑ editor.js:1372 조건 → `Digit1..8`, L1377 → `{Digit1:20,Digit2:40,Digit3:80,Digit4:120,Digit5:160,Digit6:200,Digit7:240,Digit8:280}`. 핸들러 나머지(L1378-1389)는 범용이라 무변경. 주석(L1371) 갱신.
**변경면**: js/props/prop-gap.js, js/editor.js.
**리스크/롤백**: 저. (단 숫자키 5의 의미 200→160 변경 — 의도된 재매핑.)
**테스트**: 갭블럭 선택→버튼 8개 노출·클릭 적용, 숫자키 1~8 매핑 동작 확인.

## 10. 복수선택 패널 버튼 디자인 일관성 (UI)
**현재**: 복수선택 패널 버튼 `.msp-align-btn`(css/editor-props.css:719-736) — 28px, border `--ui-border-mid`, color `--ui-text-sub`, hover/active 커스텀 블루. 표준 `.prop-btn`(L478-487) — 24px, border `--ui-border-strong`, color `#ccc`, hover `#fff`.
**수정안**: `.msp-align-btn`을 표준 `.prop-btn` 톤에 정렬(사이즈 24px, border-strong, color #ccc, hover #fff). 단 hover border-accent 등 "선택 피드백"은 보존 검토. **6번에서 추가하는 폰트사이즈 컨트롤도 동일 스타일 적용**(가능하면 `.prop-btn` 계열 클래스 재사용으로 DRY). 
**변경면**: css/editor-props.css (+6번 컨트롤 마크업 클래스 정렬).
**리스크/롤백**: 저(CSS). 롤백=스타일 되돌림.
**테스트**: 복수선택 패널 버튼이 단일패널/타패널 버튼과 시각 일관. 렌더 스냅샷 비교.

---

## 11. 마이그레이션 / 하위호환
- 저장포맷 변경 없음(모두 UI/런타임 동작). 기존 프로젝트 데이터 무영향.
- #1 메모버튼 재바인딩은 기존 저장물도 로드 시 자동 복구(데이터 변경 없음).
- #9 숫자키 의미변경(5번)은 데이터 아닌 입력매핑.

## 12. 테스트 전략 (격리 전용)
- 격리 부팅: worktree node_modules는 라이브 심링크(electron41 ABI 동일), 종료 시 rm 원복. `electron . --user-data-dir=<tmp> --remote-debugging-port=9360 --remote-allow-origins=* admin`.
- **모든 재현/검증은 더미 프로젝트로만**(proj_1782317294600·proj_1782460804390 절대 미접촉). 편집 전 `curl 9334/json`로 해당 proj 미오픈 확인.
- 단위별 스모크 + #5/#6 회귀(history/undo·delete) 집중.

## 13. 게이트 질문 (지디 확인)
1. **#7 아웃라인 복수선택**: 정찰상 레이어패널은 Cmd/Shift 복수선택이 이미 구현됨. sb_w3dduwe에서 실제로 "무엇이(블록/섹션) 어떻게(수정키 사용?) 안 됐는지" 알면 알려달라. 모르면 더미 재현으로 막히는 지점 특정 후 수정.
2. **#2 브릿지블럭**: 기존 내장 "브릿지(V커버)"(섹션 삽입)를 Laurel 아래 버튼으로 노출하는 것으로 진행 예정. 블록단위 등 다른 기대 있으면 회신.
3. **머지/순서**: 10건 단일 feature 브랜치(feature/ux-batch-10) 일괄 vs 항목별 분리 커밋 — 기본은 항목별 커밋·단일 브랜치, 머지는 현빈 승인 대기. 이의 있으면 회신.

## 14. 롤백 전략
- 항목별 독립 커밋 → 문제 항목만 revert 가능.
- feature 브랜치 격리 → dev/main 무영향(머지 금지 준수).
