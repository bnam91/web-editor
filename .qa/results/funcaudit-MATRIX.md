# GODITOR 블록별 prop 패널 기능 작동 전수검수 — 결과 매트릭스

**모델** Opus 4.8 · **CDP** 9334 · **프로젝트** proj_1775644888754 (테스트, 실프로젝트 8탭 무수정) · **날짜** 2026-06-12
**방식** 2층 검증 — ①정적(코드 6그룹 병렬 감사) ②라이브(CDP 차분 오라클 실주행)

---

## 0. 총평 (Headline)

- **라이브: 블록 패널 30+종 전부 정상 오픈, 핸들러 예외 0건, 콘솔 error/warn 0건.** 컨트롤 대다수가 캔버스/dataset에 의도대로 즉시 반영. 깨짐(broken)·크래시 **없음**.
- **silent-fail 0 blocker.** 가장 위험한 "조용한 미반영"은 라이브 3건 + 정적 코드근거 다수(MED 위주). 대부분 **직렬화/undo 누락** 또는 **환경의존(Electron)·컨텍스트 의존**이며, 즉시 출하중단급은 없음.
- 차분 오라클 한계: 직렬화 소실·undo·재로드는 단일 before/after 차분으로 미검출 → 해당 축은 **정적 코드근거**로 판정.

---

## 1. 라이브 커버리지 매트릭스 (블록 × 작동)

| 블록 | 진입 | 컨트롤 | 구동 | 반영 | 예외 | 라이브 판정 |
|---|---|---:|---:|---:|---:|---|
| text | showTextProperties | 70 | 43 | 42 | 0 | ✅ |
| shape | showShapeProperties | 14 | 14 | 14 | 0 | ✅ |
| divider | showDividerProperties | 14 | 14 | 13 | 0 | ✅ |
| gap | showGapProperties | 7 | 7 | 7 | 0 | ✅ |
| table | showTableProperties | 37 | 37 | 35 | 0 | ✅ |
| graph | showGraphProperties | 38 | 34 | 33 | 0 | ✅ |
| icon-circle | showIconCircleProperties | 9 | 8 | 8 | 0 | ✅ |
| sticker | showStickerProperties | 73 | 14 | 13 | 0 | ✅ |
| laurel | showLaurelProperties | 29 | 9 | 8 | 0 | ✅ |
| joker | showJokerProperties | 4 | 4 | 4 | 0 | ✅ |
| step | showStepProperties | 54 | 47 | 43 | 0 | ✅ |
| comparison | showComparisonProperties | 53 | 53 | 53 | 0 | ✅ |
| label-group | showLabelGroupProperties | 9 | 9 | 8 | 0 | ⚠️ lg-style-select |
| gradient | showGradientProperties | 12 | 11 | 11 | 0 | ✅ |
| vector | showVectorProperties | 9 | 9 | 9 | 0 | ✅ (정적: undo) |
| frame | showFrameProperties | 41 | 35 | 30 | 0 | ✅ |
| asset | showAssetProperties | 26 | 25 | 25 | 0 | ✅ |
| canvas | showCanvasProperties | 48 | 48 | 47 | 0 | ✅ (정적: 카드컨트롤) |
| chat | showChatProperties | 32 | 28 | 27 | 0 | ✅ (정적: change-only) |
| mockup | showMockupProperties | 9 | 6 | 5 | 0 | ✅ |
| iconify | showIconifyProperties | 21 | 19 | 11 | 0 | ⚠️ 프리셋 라이브러리 |
| banner02 | showBanner02Properties | 53 | 49 | 49 | 0 | ✅ 완벽 |
| section | showSectionProperties | 28 | 24 | 16 | 0 | ✅ (정적: #sec-memo) |
| page | showPageProperties | 16 | 15 | 6 | 0 | ⚠️ 일괄정렬(의도적 비활성) |
| multisel | showFreeLayoutMultiSelPanel | 24 | — | — | 0 | ⚠️ 정적: W/H 영속 |

> "구동<컨트롤"인 행: 숨김(컨텍스트 비노출)·파괴적·유료·모달·검색 컨트롤을 안전상 제외한 수. "반영<구동": 이미 활성인 옵션 재클릭/메타(export·템플릿) 컨트롤의 정상 no-op 포함.

---

## 2. silent-fail / 결함 Top (심각도순)

### HIGH — 정적 코드근거 (dead-wire / 컨텍스트 오노출)
1. **section · `#sec-memo` 메모 전체 dead-wire** — `prop-section.js:470-508`. 입력·디바운스·dataset.memo·autosave·pushHistory 로직 완비됐으나 패널 HTML에 `#sec-memo`가 없음(메모는 툴바 popover로 이동, L233). `getElementById`가 항상 null → 블록 전체 죽은 코드. `#sec-memo-counter`도 동일.
2. **canvas · 카드 전용 컨트롤이 레이어모드 패널에 노출** — `prop-canvas.js:179-248`. `cvb-img-ratio`/`cvb-gap`/`cvb-padx`가 cardMode≠simple 패널에 노출되나 레이어 renderCanvas가 미사용 가능 → 조작해도 시각변화 없는 무음 우려.

### MED — 라이브 확정
3. **label-group · `lg-style-select` 무선택 무반응** — 태그 미선택 상태에서 프리셋 드롭다운 변경 시 early-return, **토스트·변화 전무**. 사용자는 바뀐 줄 앎. (`prop-label-group.js:212-213`, 라이브 재현)
4. **iconify · 프리셋 라이브러리 8컨트롤 silent** — 저장/카테고리추가/교체 등이 `window.electronAPI?.svgPresets` 의존. 비Electron(CDP 미리보기)서 옵셔널체이닝 단락으로 무동작, 일부 토스트조차 없음. (`prop-iconify.js`, 라이브 8건 확정)

### MED — 정적 코드근거 (직렬화 / undo / 동기 / 가드)
5. **multisel · W/H dataset 부분 미영속** — `prop-multisel.js:176,179` `if(wrapper.dataset.width!==undefined)` 가드. dataset.width 미설정 래퍼(text-frame 등)는 영속 누락 → 재로드 시 너비/높이 복원 실패 위험. (X/Y는 무조건 offsetX/Y 기록—안전). *라이브 합성 freeLayout서 W/X 미반영 관측됐으나 수동구성 아티팩트 가능—실UI 재현 권장.*
6. **vector · flip/rotate undo 누락 ×4** — `prop-vector.js:114-137` `vb-rotate-deg/90/flip-h/flip-v`가 pushHistory 미호출 → Ctrl+Z 불가. 같은 파일 W/H/색상은 호출(일관성 결여).
7. **simple-card · `dataset.textBg` 이중 소스** — `prop-simple-card.js:456,600` 두 컨트롤이 동일 dataset에 교차동기 없이 기록 → 한쪽 편집 시 다른쪽 스와치 stale, 클릭하면 조용히 덮어씀.
8. **chat · 메시지 텍스트 change-only 유실** — `prop-chat.js:269` blur에만 저장. 입력 직후 add/delete(rebindMsgList) 시 미커밋 편집 유실 + 라이브 프리뷰 없음.
9. **chat · 이름표시 토글 vs 패널 디커플** — `prop-chat.js:40,164` `chb-show-name`이 rebindMsgList 미호출 → 프로필 이미지 OFF면 이름 필드 미노출.
10. **annotation · 라벨 선두께 change-only** — `prop-annotation.js:530` 형제 `-num`은 input인데 이것만 change → 라이브 프리뷰 없어 "고장난 듯".
11. **sticker · 하이라이트 색 초기값 하드코딩 desync** — `prop-sticker.js:114,150` 패널이 저장색 무시하고 항상 노란색(#ffeb46) 표시 → 양방향 동기 깨짐.
12. **asset · padX 토글 OFF가 지정 너비 소실** — `prop-asset.js:198-230` `style.width=''` 리셋. 중첩 frame 내 asset은 section-inner 미탐지 fallback.
13. **table · 셀패딩 좌우 16px 하드코딩 직렬화 불완전** — `prop-table.js:705-713` dataset엔 상하만 저장, 좌우 항상 16 복원.
14. **table · `tbl-merge-headers` 외부함수 의존 무음** — `prop-table.js:605,614` `updateTableBlock` 미정의 시 console.warn만, 사용자 피드백 전무.
15. **banner02 · `_bn2Lines` mutator unguarded** — `prop-banner02.js:277` 글로벌 부재 시 0줄 렌더 후 "+ 줄 추가"에서 throw.
16. **laurel · 일괄 슬라이더 clamp 불일치** — `prop-laurel.js:494` apply는 0..2000/20..600인데 슬라이더 max 800/320 → 초과값서 썸이 값을 시각적으로 속임.
17. **section · 텍스트색/일괄정렬 pushHistory·autosave 누락** — `prop-section.js:433-467` undo/자동저장 미반영 위험.
18. **frame · Position/회전/flip/자식정렬 pushHistory 누락** — `prop-frame.js:429-527` 변형 후 undo 불가(autosave만).
19. **label-group · Outline 프리셋 border 미영속** — `prop-label-group.js:18-21` dataset.border 미저장 → 재로드 시 외곽선 소실.
20. **text · 행간/자간/정렬 inline-only 직렬화 의존** — `prop-text-wireup-spacing.js:9,17` 등 dataset 백업 없이 contentEl inline style만 → 직렬화가 정규화하면 소실 위험.

### LOW / 의도적
- **page 일괄정렬 3버튼** 영구 비활성(pointer-events:none+disabled) — 의도적, 라이브 확정.
- divider/sticker/step/chat `prop-align-btn` 일부 silent = **이미 활성 옵션 재클릭**(정상).
- gap height inline-only(dataset.h 미갱신), text/step `*-ph-chain` 좌우연동 로컬변수, icon-circle radius dead-read, mockup capture/upload scheduleAutoSave 누락 등.

---

## 3. 양방향 동기 (슬라이더↔숫자)
정적·라이브 종합: text(rotation/shadow/width/pv/itb-gap), shape, table, graph, sticker(9쌍), asset/canvas(W/H/R), laurel, comparison, frame 등 **대부분 정상 양방향**. 숫자전용(폰트크기/행간/자간/색알파)은 설계상 슬라이더 없음(결함 아님). laurel 일괄쌍은 clamp max 불일치(#16).

## 4. 환경/안전 노트
- 유료 API(AI 이미지 H7) 트리거 버튼: 4개 자산패널 어디에도 **없음** — 전부 로컬 FileReader/html2canvas. 우발 과금 0.
- 실주행 전 구간 콘솔 error/warn 0건. 베이스라인 4섹션 복원·flushSave, 실프로젝트 8탭 무수정(탭전환 0회, 테스트 projectId 직접조작).
- banner02 프리셋 변경 confirm 다이얼로그 정상 동작(내용소실 경고) — 처리 완료.

## 5. report-only
검수임. FIX 미수행. 정적 JSON: `.qa/results/static-{text,asset,structure,graphic,special,meta}.json`. 라이브 JSON: `.qa/results/funcaudit-live.json`.
