# DESIGN — #16 스크래치패드 ↔ 섹션 노드연결 (울트라플랜)

- 작성: 태양 2026-08-25 · worktree `/Users/a1/web-editor-s16` · 브랜치 `feature/v0.8-scratchpad-link`(base=v0.8-improvements HEAD 919dc97) · ⛔머지·배포 현빈 게이트
- 기준 스펙 = 데모 `goditor-scratchpad-link-demo-v2.html`(합의된 동작) 포팅. 현빈 4대 확정동작.
- ★게이트: 착수 전 지디 승인(이 문서). 데이터손실0(연결끊김≠이미지소실)·회귀0·디자인일관성. fresh agent 적대리뷰 라운드 필수.

## 0. 실측 (근거)
- **스크래치패드**: `js/scratch-pad.js`. 아이템 = `{el, src, x, y, w, id, g?}`(`_createItem` src=이미지 소스 직접, `dataset.scratchId=id`). 저장 = IndexedDB `ScratchPadDB`/store `scratch`/키 `scratch-pad-<projectId>-<pageId>`(페이지별). 직렬화 필드 `{src,x,y,w,id,g}`. ★공개 API 존재: `window._scratchAddAndSave(src,x,y,w,g,id)`·`window._scratchRemoveById(id)`.
- **섹션**: `.section-block`, 안정 id=`sec.id`. `deleteSection(secIdOrEl)`(editor.js:2436) = pushHistory→`sec.remove()`→deselectAll→buildLayerPanel→triggerAutoSave.
- **캔버스**: `#canvas-wrap > #scaler(transform: translate(pan) scale(zoom)) > #canvas`. 줌=currentZoom, 팬=panOffsetX/Y. #canvas가 스케일러 «안».
- **직렬화**: `serializeCleanRoot(clone)`(section-serialize.js)가 #canvas HTML 세척. proj.json = `{version:2, currentPageId, pages:[{id,name,label,pageSettings,canvas}], checklistItems, imageGallery, assetsTree}`. ★`pages: state.pages` 통째 저장 → 페이지 객체에 필드 추가 시 «자동 직렬화».
- ★**스크래치패드 = «캔버스 위»**: `_createItem`이 `#canvas-scaler`(줌/팬 레이어)에 `.scratch-item`(dataset.scratchId, 절대배치 x/y/w) append. 데모의 «tray»=GODITOR에선 캔버스 위 스크래치 아이템. → «연결»=그 아이템을 캔버스에서 빼고 사이드카로 / «복귀»=`_scratchAddAndSave(src,x,y,w,g,id)`로 캔버스 재생성(기존 add 경로).
- ★**undo/redo = `pushHistory(action, sideEffects)` 존재**: sideEffects=`{onUndo,onRedo}`가 «DOM 외 상태(스크래치 IDB 등) 복원용»으로 이미 설계됨. imageLinks는 canvas HTML 밖(페이지객체)이라 canvas 스냅에 안 잡히지만, **sideEffects 훅으로 imageLinks 스냅/복원**(정석 경로). scratch-pad.js가 이미 이 패턴 사용.
- **재렌더 훅**: `rebindAll`(save-load)이 로드/undo·redo/협업마다 `bindSectionHitzone(sec)` 호출. template-system.js가 이 래퍼로 태그칩 재생성(검증된 패턴) → 사이드카 재렌더도 동일 패턴 재사용.

## 1. ★데이터 모델 & 직렬화 스키마 (지디 명시 요청)
- **단일 진실원 = ScratchPadDB**(이미지 실체). 링크는 «참조만»(중복저장 0).
- **연결정보 = 페이지 객체에 신규 필드**:
  ```
  page.imageLinks = [ { sectionId:"sec_xxx", scratchId:"s_yyy", collapsed:false } ]
  ```
  - 페이지 스코프(섹션·스크래치 둘 다 페이지 소속이라 자연 정합). `pages: state.pages` 경유 proj.json 자동 보존.
  - 이미지 데이터는 ScratchPadDB에 그대로. imageLinks는 scratchId로 «참조».
- **뷰 분리(단일 데이터, 2뷰)**: 캔버스 스크래치(미연결=`.scratch-item` on canvas-scaler) / 사이드카(연결=canvas-wrap 스크린좌표). ★스크래치 로드(`_loadScratch`)/렌더가 imageLinks에 있는 scratchId는 «캔버스 아이템 생성 skip»(데이터는 로드하되 사이드카로), 미연결만 캔버스에. 해제/삭제 시 캔버스 복귀. 데이터는 ScratchPadDB 단일원(참조).
- **하위호환**: `page.imageLinks` 없으면 = 링크 0(기존 저장본 무변·회귀0). 로드 시 imageLinks의 scratchId가 현 스크래치에 없으면(이미지 삭제됨) 그 링크 skip+정리(고아 안전).

## 2. 렌더 아키텍처 (오버레이)
- 신규 오버레이 = `#canvas-wrap` 안, **#scaler 밖**(스크린 좌표): `<svg id="link-edges">` + `<div id="link-sidecar">`(note-group들). → serializeCleanRoot(#canvas 대상)에 «안 잡힘»=직렬화 오염0.
- **추종 = getBoundingClientRect(post-transform)**: 데모 `positionTops`(댓글레일: 섹션 top에 붙되 위 그룹과 안 겹치게 push-down) 그대로. 줌/팬은 rect가 이미 반영 → 자동 추종. 카드는 스크린 크기 고정(가독성). 스크롤=canvas-wrap 스크롤에 동기(relayout on scroll).
- **edges**: SVG `<line>` 섹션 우변→카드 좌변(데모 drawEdges). 기어 토글 on/off.
- **note-group**: 섹션별 1그룹, 카드 세로 스택(1:N). glide 트랜지션(섹션 높이/순서 변경 시).

## 3. 연결 UX (데모 그대로)
- 스크래치 아이템 «선택»(기존 선택모델) → **[노드연결] 버튼**(스크래치 pane 툴바에 추가, 기존 .prop-btn 계열 재사용) → linkMode 진입(배너+섹션에 .linkable 점선 아웃라인+연결선 프리뷰) → 섹션 «클릭» → `page.imageLinks`에 추가 → 사이드카 렌더. Esc 취소.
- 다중선택 시 여러 이미지 일괄 연결 가능(선택셋 순회).

## 4. 사이드카 기능
- 카드: 썸네일(scratch src)+파일명+버튼(－접기/⤢분할비교/⛌해제). fold=collapsed 토글(썸네일 숨김, imageLinks.collapsed 저장). 
- ⤢ 분할비교: 오버레이(섹션 실렌더 좌 ↔ 참고이미지 우, 높이 정규화) — 데모 openCompare 포팅(섹션은 실 DOM 클론 렌더).
- ⚙ 기어: 연결선 표시 on/off(전역, 세션 설정). 
- ⛌ 해제: imageLinks에서 제거 → 이미지 스크래치 pane 복귀(데이터 보존).

## 5. ★섹션 삭제 → 스크래치 복귀 (지디 명시 요청)
- `deleteSection`에 훅: `sec.remove()` «전», `page.imageLinks`에서 sectionId===sec.id 항목 제거. 
- ★이미지 데이터는 ScratchPadDB에 그대로 → 링크만 사라져 스크래치 pane에 «자동 복귀». `_scratchRemoveById` 절대 호출 안 함(이미지 삭제 금지).
- ★undo = `pushHistory('섹션 삭제 전', {onUndo:복원 imageLinks, onRedo:재제거})` sideEffects로 링크 복원(canvas HTML 스냅은 섹션 DOM, sideEffects는 imageLinks). 검증된 패턴(scratch-pad.js 사용).
- 동일 로직 재사용: 개별 ⛌ 해제 = 그 링크 1개 제거.

## 6. P0 데이터손실/회귀 시나리오 (고QA + fresh agent 적대리뷰)
1. ★섹션 삭제 → 연결이미지 스크래치 복귀·**이미지 데이터 무손실**·ScratchPadDB 실체 생존(디스크 재조회).
2. 연결→저장→리로드: imageLinks 생존·사이드카 재렌더·정위치.
3. 연결→undo/redo: 링크 상태 정합.
4. 섹션 순서변경/높이변경: 사이드카 추종(positionTops)·edges 재계산.
5. ★기존 저장본(imageLinks 없음) 로드 회귀0.
6. 스크래치 이미지 삭제(pad에서) → 그 링크 고아 안전 처리(크래시0).
7. export(PNG/HTML/figma)·.gdt: 사이드카/edges 미직렬화(오버레이라 canvas 밖) → export 오염0.
8. 협업 수신 재렌더 정합(rebindAll 경유).
9. 줌/팬/스크롤 중 추종 정확·성능(rAF 스로틀).
10. 1섹션 N이미지 push-down 겹침0.

## 7. 실행 단계 (PGE)
- P1: 데이터모델+직렬화(imageLinks CRUD·저장/로드/하위호환) → 격리 왕복 실증.
- P2: 오버레이 렌더(사이드카/note-group/edges/positionTops·줌팬추종) → 시각 정합.
- P3: 연결 UX(linkMode·[노드연결]·섹션클릭·Esc·다중).
- P4: 기능(fold/compare/gear/unlink) + ★섹션삭제복귀 + undo.
- 각 P마다 1차 격리 CDP 스모크. 전체 후 ★fresh agent 적대리뷰(데이터손실 함정 집중) → P0 고QA.
- 신규 파일 위주: `js/scratchpad-link.js`(오버레이·링크CRUD·렌더) + scratch-pad.js(pane 필터·[노드연결] 버튼) + editor.js deleteSection 훅 + save-load 재렌더 배선 + css/editor-extra.css(오버레이 스타일, 기존 토큰). 기존 로직 최소침습.

## 8. 리스크 & 롤백
- ★리스크: (a) 줌/팬/스크롤 추종 정확도(rect 기반이라 원리상 OK, 성능은 rAF 스로틀) (b) undo가 imageLinks까지 스냅샷하나(히스토리 스택이 canvas HTML만 담으면 링크 별도 스냅 필요 — 실측해 정합) (c) 스크래치 pane 필터가 기존 pane 동작 회귀 유발 금지 (d) 협업 CRDT가 imageLinks 필드 인지(비인지면 링크 협업 미동기=수용가능·손실 아님).
- 롤백: imageLinks 없으면 전부 기존 동작(오버레이 미렌더·pane 필터 무효). 신규 파일 revert + deleteSection 훅 1줄 제거로 원복. 이미지 데이터는 애초에 안 건드리므로 손실 경로 없음.
