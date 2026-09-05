# Planner 설계안 — 선택 테두리 오버레이 이전 (2026-09-06)
지디가 «사실 확인»한 항목: section-block.selected::after 실재 · sticker 계열 실재 ·
--sel-color 는 :root 라 오버레이에서 먹힘 · dev(6461a28)에 M57 픽스가 «이미» 있어 F1 은 RED 가 안 난다.

## ★발주서가 놓친 것 (Planner 지적, 지디 승인)
「오버레이로 옮기면 세 증상이 다 해결된다」는 **틀렸다**. ⑶(맞닿으면 2px)은 «페인트 층»이 아니라
«두 상자가 각자 선을 갖는» **기하** 문제다. 옮겨도 그대로 난다.
⇒ 유일한 양립 해법 = **안쪽 1px + 선택 상자끼리 맞닿은 변 «구간» 중복제거(dedupe)**.
   이 요구가 도구를 결정한다(div/border/box-shadow 는 변의 «일부»를 못 지운다 → SVG).

## A1. SVG 1장 + 상자마다 path
- 폴리곤 = `CORNER_DIRS.map(d => _cornerScreen(el, d, 0.5))` — 핸들과 «같은 함수»로 좌표를 얻는다.
- 회전 0: 윗선 중심 y=round(T)+0.5, 아랫선 y=round(B)−0.5 (좌우 동일). 선은 상자 «안쪽» 1 CSS px.
- dedupe(회전 0 상자끼리): A.B≈B.T(|Δ|<1 CSS px) & x-구간 겹침 → DOM 뒤 상자의 «그 구간»을 path 에서 뺀다.
  부분 겹침이면 «남는 구간만» 그린다. 회전 상자는 dedupe 제외.
- 굵기 = 1 CSS px 고정. ★오버레이는 스케일러 «밖»이라 --inv-zoom 불필요(이 이전의 요지).
- 변형: 기본 파랑 / `--overlay`(closest('.asset-overlay') = 흰 0.7 점선 1.5px) / `--sticker`(보라).
  ★색은 «호스트 조상»으로 결정한다 — 블록 이름표로 분기하지 마라.
- 바깥으로 그리던 4종(canvas·banner02·icon-circle·overlay-tb)도 «안쪽»으로 통일.
- crispEdges + 반픽셀 스냅(회전 시엔 끈다).

## A2. rAF 루프 1개(선택 집합) + #canvas MutationObserver(class+childList, subtree)
- ⛔선택 변경 «이벤트가 없다»(.selected 를 바꾸는 자리 116곳). RO/IO 는 스크롤·transform 을 못 본다.
- MO → 다음 rAF 에 «집합 재계산»(`#canvas .selected` 일반 질의). 집합 비면 루프 정지.
- ★블록 이름 «목록을 두지 않는다» — 새 블록이 생기면 자동 편입. 「목록이 썩는 병」의 구조적 답.
- 표시 상자 매핑: `.text-block`/`.speech-bubble-block` → `closest('.frame-block[data-text-frame]') || closest('.row')`,
  그 밖은 자기 자신. 제외 = `.section-block`, `.col`.
- 매 프레임 `isConnected` 검사(핸들과 동일). undo/협업의 outerHTML 교체로 죽은 노드를 잡기 위함.

## A3. P0 = 플래그 양립
- `js/feature-flags.js` 에 `SEL_OVERLAY_ENABLED`(선례 COLLAB_ENABLED).
- ★body 클래스 `sel-ov` 는 «오버레이 모듈이 초기화에 성공한 뒤 스스로» 붙인다
  → JS 가 죽으면 문서 outline 이 그대로 남아 «제품이 성립»한다.
- 중화 규칙 1블록(P0 임시물, P1 에서 원본과 함께 삭제):
  `body.sel-ov #canvas :is(...) { outline-color: transparent !important; border-color: transparent !important }`
  overlay-tb 가 `!important` 라 우리도 `!important` + `body.` 접두로 특이성 우위. `.editing` 은 제외.
- ⛔P0 에서는 CSS 원본을 «지우지 않는다» → 기존 단위테스트 672 가 그대로 통과해야 한다.

## P0 인수조건
§4-1 가려짐0 · §4-2 두께균일 · §4-3 이웃불가침 · §4-4 줌불변 · §4-6 내보내기무유출 GREEN.
§4-5 회전은 «자기 회전»만(중첩은 P1). §4-7 단위 672 유지 + 핸들 무회귀
+ ★코너 일치: path 꼭지점 ↔ `.ss-resize-handle` 중심 ≤1px.
P0 에서 «아직 안 되는 것»을 보고서에 «명시»할 것: 중첩 회전은 오늘보다 나쁘다(AABB).

## ⛔위험 (구현 중 반드시 방어)
1 중첩 회전(_cornerScreen 은 자기 dataset 회전만 본다) — P0 는 퇴행. 폴리곤 넓이 ≠ offsetW×offsetH×scale² 로 감지
2 프레임 overflow:hidden 이 «잘라주던» 것이 오버레이에선 안 잘린다
3 dedupe 3단 쌓임·부분겹침·회전혼재 · N=200 select-all 에서 O(N²)
4 10% 에서 |Δ|<1 CSS px 가 «거짓 맞닿음» 판정
5 스크롤 중 한 프레임 지연(젤리) — 핸들도 이미 그렇지만 사각형은 더 눈에 띈다
6 내보내기: 오버레이는 #canvas 밖이라 클론 유출 0. ⚠️미확인 = captureBeyondViewport × position:fixed
7 undo/redo outerHTML 교체 → 죽은 노드 «유령 상자». isConnected + childList 둘 다
8 협업 sync outerHTML 교체(같은 방어)
9 overlay-tb = `!important` + 부모 에셋 회전 + 흰 점선
10 텍스트 매핑 파리티: `.row:has` 와 «같게» row 로(col 개선은 범위 밖)
11 --sel-color 스코프 = :root 확인됨 ✅
12 U-SELZ 가 P1 에서 설계상 빨강(P0 에선 무관)
13 SVG hit-test: `.ss-sel-layer, .ss-sel-layer * { pointer-events:none }` + 클릭 통과 테스트 1건

## 측정 (전부 픽셀 · 코드 대조 금지)
- 배율은 «재라»: k = shot.height / window.innerHeight. ⛔가정 금지(지디가 1440 가정해 가짜 0을 냈다).
- 판정 = 파랑우세 b−r ≥60(100%) / ≥40(40%·10%). 흰 점선은 «선택 OFF 기준선과의 diff 픽셀 수».
- ⛔elementFromPoint 로 아웃라인 판정 금지(히트테스트 대상 아님).
- getComputedStyle 은 «살아있는 객체» — 상태를 되돌린 뒤 읽지 마라.
- ★각 항목은 RED 를 «먼저» 찍어라. dev 에 M57 이 이미 있어 F1 은 RED 가 안 나온다
  → RED 는 F3(overlay-tb, 유일 잔존 결함)로 찍는다.
- 픽스처: F1 카드+로고(간격0) / F2 텍스트행 3연속 / F3 에셋오버레이+overlay-tb 2줄
  / F4 회전 30° 에셋 + 45° 회전 프레임 안 자식 / F5 어두운 풀블리드 카드 / F6 select-all N≈200
