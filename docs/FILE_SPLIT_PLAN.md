# 1000줄+ 파일 책임단위 분리 플랜 (2026-06-14)

원칙: **리스크 적은 순**. 리스크 = 경계 넘는 local 참조(결합도) × 핵심성 × 데이터무결성 영향.
안전 패턴(검증됨): 추출 단위가 ① 외부에서 bare-name 호출 0(window.* 통신만) ② 외부 의존이 window 노출 헬퍼뿐일 때 무손실. CDP 리로드 스모크(콘솔0·핵심함수·앱무결) 필수.

## 대상 (10개, 줄수 내림차순)
| 파일 | 줄수 | 로딩 | 분리 후보 | 리스크 |
|---|---|---|---|---|
| block-factory.js | 4409→**4198** | module | ✅ Annotation(완료) / Shape / SpeechBubble / update*MCP / Table-merge헬퍼 | 낮음(window 통신) |
| editor.js | 2346 | module | selection / keyboard / clipboard / zoom·pan | 높음(핵심 이벤트·공유상태) |
| block-drag.js | 1861 | classic | drag / inline-cell-edit / asset-overlay | 중상 |
| io/save-load.js | 1595 | module | serialize / deserialize / rebindAll / migration | 높음(데이터무결성) |
| scratch-pad.js | 1286 | module | 자기완결 패널 | 중하 |
| panels/assets-panel.js | 1223 | classic | 자기완결 패널(폴더/파일/URL/import) | 중하 |
| image-handling.js | 1119 | module | crop / move·resize / commit | 중 |
| overlay-handles.js | 1049 | classic | resize / rotate / handle-render | 중 |
| checklist-panel.js | 1049 | classic | pin-render / popup-UI / drag / persistence | 중하(자기완결 feature) |
| blocks/canvas-block.js | 1049 | module | 단일 블록 내부 render 분리 | 중하 |

## 실행 순서 (낮은 리스크 → 높은)
1. **block-factory.js 추가 추출** — Annotation(✅완료, b267aca) 다음: Shape Block / Speech Bubble / update*MCP 진입점 / Table 병합헬퍼. 같은 검증된 window-통신 패턴이라 가장 안전. ← **다음 1순위**
2. **checklist-panel.js** — todo-pin 자기완결 feature(classic script = 전역 공유라 분리 기계적으로 안전). popup-UI / pin-drag / persistence 3분할.
3. **scratch-pad.js / assets-panel.js** — 자기완결 패널 feature. 패널 UI vs 데이터 분리.
4. **blocks/canvas-block.js** — 단일 블록, 내부 sub-render 분리.
5. **image-handling.js / overlay-handles.js** — 인터랙션 핸들러(crop/resize/rotate). 공유 상태 주의.
6. **block-drag.js** — drag + 셀편집 + asset 오버레이 혼재. 결합도 높음.
7. **editor.js** — selection/keyboard/clipboard/zoom 핵심 이벤트·전역상태 집약. 신중.
8. **io/save-load.js** — 직렬화/역직렬화/마이그레이션. 데이터 무결성 직결 → **마지막**, 회귀테스트 강화 후.

## 완료
- **#1 Annotation Block** → js/blocks/annotation-block.js (211줄, b267aca). 외부 bare참조 0, 의존 genId(window). CDP 검증 통과.
