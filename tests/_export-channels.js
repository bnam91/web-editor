/* _export-channels — 「캔버스 DOM 을 «클론해서» 무언가를 만드는 문」의 명부. (2026-09-09)
 *
 * ★왜 있나
 *   편집 전용 마커(.selected · .bn2-line-selected · .grd-line-selected …)는 저장본·PNG·HTML·
 *   템플릿 «어디로도» 새면 안 된다. 그런데 그걸 벗기는 자리가 이 레포엔 «흩어져» 있다.
 *   ⛔「6자리 다 지웠나」로 세면 «7번째 문»이 생기는 날 조용히 통과한다.
 *
 * ★★그리고 그 7번째 문은 «가설이 아니라 실물»이었다 (2026-09-09 적대 검수)
 *   js/panels/template-system.js 의 cloneNode(true) 3곳이 .selected/.editing 은 벗기면서
 *   .bn2-line-selected 와 .grd-line-selected 는 «둘 다» 안 벗기고 있었다.
 *   ⇒ 줄을 선택한 채 템플릿으로 저장하면 마커가 템플릿 HTML 에 박히고, 다시 꺼내 넣으면
 *     «유령 선택바»가 실제로 그려진다. bn2 는 «원래부터» 새고 있었다.
 *   ⇒ 그래서 이 명부의 분모를 «js/io/export-*» 에서 «cloneNode(true) 전수»로 넓혔다.
 *     ★손으로 적은 명부는 다음 문을 못 본다. 분모는 기계가 정해야 한다.
 *
 * ⛔여기에 파일을 «손으로» 늘려서 빨강을 끄지 마라 — 늘리려면 그 클론이 무엇을 만드는지
 *   «보고» kind 를 정해라. artifact 면 마커 스트립을 붙여야 한다(serializeCleanRoot 위임이 정답).
 *
 * ★★2026-09-09 — 축이 «하나뿐»이던 것을 넓혔다 (원래 결함이 하필 거기 있었다)
 *   이 명부의 그물은 잘 짜여 있었지만 축이 «마커 누출» 하나뿐이었다 — 「빠지나」를 안 봤다.
 *   ⇒ 그리고 Figma 업로드는 cloneNode 를 «안 써서»(DOMParser 직행) 이 명부에
 *     «등재조차» 안 되어 있었다. 분모 밖이라 어떤 축으로도 안 재졌다.
 *   ⇒ 실측 결과 거기서 add*Block 38종 중 15종이 {"columns":[]} 로 빠지고 있었다.
 *     ★결함이 하필 «명부 밖 · 축 밖»에 있던 게 우연이 아니다.
 *   ⇒ ⑴ 분모를 하나 더 뒀다: 「DOMParser 로 캔버스를 파싱해 .section-block 을 도는 문」
 *        (globTraverseFiles). 이제 Figma 도 «기계가» 명부에 끌어온다.
 *     ⑵ 채널마다 «어느 축으로 재는가»(axes)를 적게 했다.
 *
 * ★축(axes) — 그 채널을 «무엇으로» 재는가
 *   'marker' = 편집 전용 마커가 결과물에 새지 않는다        (U6-c 가 잰다)
 *   'drop'   = 캔버스의 블록이 결과물에서 «빠지지» 않는다   (U6-g 가 «진짜 검사»에 연결한다)
 *              ★2026-10-22 — Figma 둘에 더해 ★클론 채널 넷(PNG·썸네일·단독 HTML·공용 겹)에도 단다.
 *              ★클론 채널의 자는 ★«지우는 선택자 명부»(DROP_STRIP_ROSTER · tests/unit/capture-drop-axis.test.mjs)다
 *   ⛔축을 안 적으면 U6-b 가 빨강. 「무엇으로 재는지 모르는 채널」을 못 만들게 한다.
 *
 * ⚠️못 잰 것 — 「좌표가 어긋나나」 축은 «아직 부분»이다 (2026-09-09 오후 갱신).
 *   ⑴ 잰다: «플로팅» 블록(.section-block 직속 absolute)의 x/y — dataset.x/y 를 출처로
 *      삼는지까지 본다(style.left/top 을 오염시켜 두고 잰다). FX-4 가 잰다.
 *   ⑵ ⛔안 잰다: «흐름» 블록이 Figma 에서 제자리에 놓이는지 — 어느 축도 안 본다. 별건.
 *
 * 이 파일은 도구다(`_` 로 시작해 테스트 글롭에 안 걸린다).
 */
'use strict';

/** 편집 전용 마커 — artifact 채널에서 «반드시» 벗겨져야 하는 클래스 토큰.
 *  ★늘릴 때 — ★«그 토큰이 ★산출물에 ★실제로 실렸다»를 ★행위로 재고서 올려라(아래 둘이 그렇다).
 *  ★★2026-10-10 (1009t3 A4) ＋2종:
 *    ★`grd-cell-selected` — ★빈 그리드 «칸» 선택 표시. ★다섯 명부 ★전부에 없었다.
 *      ★실측: 저장본 1건 · ⌘C 1건 · 템플릿 1건 · PNG 클론 1건 ·
 *        섹션 비교 해시 `b8315380`→`805b8dc8` ·
 *        ★★HTML 배송본을 ★렌더해 computed `rgb(45,111,232) 0 0 0 2px inset` ⇒ ★★그려졌다.
 *    ★`item-selected`     — ★라벨 항목. ★저장 뿌리에만 ★없었다(= ★저장 쪽이 ★더 허술한 방향).
 *      ★실측: 저장본 1건 · 섹션 비교 해시 `a1ad09e8`→`b4189398`.
 *      ⇒ ★그 비대칭이 ★★「명부가 둘이면 한쪽만 고쳐진다」의 ★실물이다. */
const MARKER_TOKENS = ['bn2-line-selected', 'grd-line-selected', 'grd-cell-selected', 'item-selected'];

/* ★★⛔이 배열을 ★늘리면 ★★«장면을 ★내는 자리»도 ★같이 늘려야 한다 — ★그 수를 ★★검사가 센다.
 *
 * ★★왜 이 주석이 있나 (2026-10-10 · ★내가 밟았다)
 *   ★`grd-cell-selected`·`item-selected` ★2종을 ★이 배열에 ★더했다. ★그런데
 *   ★`tests/dom/grid-three-channels.dom.spec.js` ★D4 는 ★이 배열을 ★★«파생»해 ★토큰마다
 *   ★「라이브 DOM 에 ★1건 있었다」를 ★전제로 단언한다. ★그 spec 의 ★장면은 ★«그리드 ★줄 선택»만
 *   만들었으므로 ★새 2종은 ★★0건이었고 ★★전수에서 ★빨강이 났다.
 *   ★★⇒ ★★«분모를 늘렸는데 ★장면을 ★안 늘렸다». ★그 자는 ★제 일을 했다.
 *   ★★⇒ ★이것이 ★★«enum 을 늘리면 ★판정하는 ★모든 표에 ★칸이 생겼는지 ★세라»의 ★그 자리다.
 *
 * ★그래서 ★명부를 ★★«여기» 둔다 — ★토큰마다 ★★«어느 spec 이 ★그 장면을 ★내나».
 *   ★`tests/unit/selected-marker-census.test.mjs` ★A4-S1 이 ★★양방향으로 견준다:
 *     ㉠ MARKER_TOKENS 에 ★있는데 ★여기 ★없으면 ★빨강(= ★장면을 ★안 늘렸다)
 *     ㉡ ★여기 있는데 ★MARKER_TOKENS 에 ★없으면 ★빨강(= ★명부가 ★낡았다)
 *   ＋ ★그 spec 파일이 ★실재하고 ★★그 토큰을 ★실제로 ★언급하나까지 ★본다.
 * ⛔`how` 를 ★「손으로 심는다」로 적을 때는 ★★`appPath`(앱의 길로 재는 자리)를 ★같이 적어라 —
 *   ★안 적으면 ★다음 사람이 ★「앱 경로도 쟀다」로 ★읽는다. */
const MARKER_SCENES = {
  'bn2-line-selected': {
    spec: 'tests/dom/grid-three-channels.dom.spec.js',
    how:  '손으로 심는다 — banner02 div 에 class 를 박는다(이 spec 의 «이웃 토큰» 선례)',
  },
  'grd-line-selected': {
    spec: 'tests/dom/grid-three-channels.dom.spec.js',
    how:  '★앱의 길 — showGridProperties(block, {r,c,li:2}) 가 붙인다',
  },
  'grd-cell-selected': {
    spec: 'tests/dom/grid-three-channels.dom.spec.js',
    how:  '손으로 심는다 — ⛔앱의 길로는 «이 장면에» 못 심는다: js/props/prop-grid.js 의 ' +
          '_grdSyncLineMark 가 머리에서 document 전역으로 .grd-line-selected 와 ' +
          '.grd-cell-selected 를 둘 다 지운다(:176·:177) ⇒ 두 그리드 마커는 «상호배제»다',
    appPath: 'tests/dom/grid-cell-selected-leak.dom.spec.js',   // ★진짜 마우스 ＋ 배송본 렌더 computed
  },
  'item-selected': {
    spec: 'tests/dom/grid-three-channels.dom.spec.js',
    how:  '손으로 심는다 — label-group-block 안 .label-item 에 박는다',
    appPath: 'tests/dom/grid-cell-selected-leak.dom.spec.js',   // ★L6 가 라벨 항목을 진짜로 클릭한다
  },
};

/** compare 채널의 정규화 단일 진실원 — market-merge 가 갖고 있고, 나머지는 «위임»한다.
 *  ⛔위임을 「자기 명단 없음」으로만 재면 안 된다 — 아무것도 안 씻어도 초록이다.
 *    그래서 U6-e 는 「이 이름을 부르는가」까지 본다. */
const NORM_FN = 'normSection';

/** 세척 단일 진실원. 이걸 부르면 토큰을 손으로 열거하지 않아도 된다(권장). */
const CLEAN_FN = 'serializeCleanRoot';
/** root «자신»까지 씻는 판. root 가 캔버스가 아니라 «섹션/블록 1개»인 채널은 이걸 불러야 한다
 *  (Root 판은 querySelectorAll 만 써서 구조적으로 root 자신을 못 본다). */
const CLEAN_SELF_FN = 'serializeCleanSelf';

/**
 * kind — 그 클론이 «무엇을 만드는가»
 *   'artifact'  = 저장·배송되는 산출물이 된다        ⇒ 마커 스트립 «필수»(U6-c 가 검사)
 *   'compare'   = 비교용 «키 문자열»을 만든다         ⇒ 마커가 남으면 «오탐»을 만든다(백로그 F2)
 *   'transient' = 라이브 캔버스·리스너 교체·드래그 고스트 ⇒ 스트립 불필요
 */
/* ★클론 채널(PNG·썸네일·단독 HTML)의 drop 분모 — Figma 의 add*Block 과 ★다른 자다(아래 DROP_STRIP_ROSTER 머리말). */
const DROP_DENOM = '★두 개를 기계로 센다 — ⑴ 그 채널 dropFns 몸통(주석 뗀 코드)의 «querySelectorAll(…).forEach(…remove())» 선택자 전수 ' +
  '(＋ delegates 로 부르는 공용 겹의 것) ⑵ js/ 전역 «className = / classList.add(» 리터럴 중 «-block» 으로 끝나는 블럭 클래스 전수(readdirSync)';

const CHANNELS = [
  // ── artifact — 마커가 새면 결과물에 박힌다 ─────────────────────────────
  { file: 'js/io/section-serialize.js', kind: 'artifact', axes: ['marker', 'carry'], strips: 'inline',
    why: '저장본 — 캔버스 클론을 세척해 innerHTML 로 굳힌다. ★이 파일이 «세척의 단일 진실원»이다' },
  { file: 'js/io/export-html.js', kind: 'artifact', axes: ['marker', 'drop', 'carry'], strips: 'inline',
    delegates: [{ file: 'js/io/capture-safety.js', entry: 'stripEditorOnlyForCapture' }],
    dropFns: ['exportHTMLFile'], guard: 'tests/unit/capture-drop-axis.test.mjs',
    dropDenominator: DROP_DENOM,
    dropWhy: '★단독 HTML 배송본 — 캔버스 «전체» 클론에서 ★사라지면 안 되는 것 = ★모든 섹션의 ★모든 콘텐츠 블럭. ' +
             '★제 손으로 지우는 것(exportHTMLFile 의 .remove() 다섯 줄)은 ★편집 손잡이·＋단추·안 고른 A/B 시안뿐이어야 한다',
    why: 'HTML 내보내기 — 라이브 클론을 그대로 문서로 만든다(serializeCleanRoot 를 안 거친다). ' +
         '★마커 걷기는 «제 손 명부» ＋ ★공용 겹(capture-safety stripEditorOnlyForCapture)을 «둘 다» 쓴다 — ' +
         '그래서 delegates 를 선언한다. ★U6-c 는 토큰이 ★어느 쪽에 있든 덮였다고 보되, ' +
         '★«그 겹을 정말 부르나»를 코드에서 같이 본다(⛔주석은 떼고)' },
  { file: 'js/io/export-image.js', kind: 'artifact', axes: ['marker', 'drop', 'carry'], strips: 'inline',
    delegates: [{ file: 'js/io/capture-safety.js', entry: 'stripEditorOnlyForCapture' }],
    dropFns: ['prepareCloneForCapture', 'renderComponentsInClone'], guard: 'tests/unit/capture-drop-axis.test.mjs',
    dropDenominator: DROP_DENOM,
    dropWhy: '★PNG — 섹션 클론에서 ★사라지면 안 되는 것 = ★그 섹션의 ★모든 콘텐츠 블럭(떠 있는 블럭 포함). ' +
             '★제 손 지우기는 ★0줄이다(공용 겹에 전부 위임) — ★생기면 이 축이 그 선택자를 명부에서 찾는다',
    why: 'PNG 내보내기 — 라이브 DOM 클론을 캡처한다(재렌더가 마커를 되붙이는 자리도 여기). ' +
         '★제 손 명부는 «재렌더 뒤»(renderComponentsInClone)에만 있다 — 그 순서가 필요한 자리다. ' +
         '★나머지는 공용 겹(capture-safety)에 위임한다. ' +
         '⛔restRuntimeForArtifact 에 마커를 얹지 마라 — 이 파일은 그 겹을 «일부러» 안 부른다(PNG = 스냅샷 계약)' },
  { file: 'js/panels/template-system.js', kind: 'artifact', axes: ['marker'], strips: CLEAN_FN, via: '_cleanTemplateClone',
    why: '★템플릿 저장 3곳(섹션·덮어쓰기·블록) — 2026-09-09 까지 마커를 «안» 벗기던 7번째 문. ' +
         '손 열거 대신 세척에 위임한다. ★클론 3곳이 «파일 안의 문 하나»(_cleanTemplateClone)를 ' +
         '거쳐서 간다 — 같은 위임을 세 번 적으면 네 번째가 생기는 날 한 곳만 빠진다' },

  // ── artifact · «빠짐» 축 — cloneNode 를 안 쓴다(DOMParser 직행). 그래서 2026-09-09 까지
  //    이 명부에 «등재조차» 안 되어 있었다. 결함이 하필 거기 있었다. ──────────────
  { file: 'js/io/export-figma-json.js', kind: 'artifact', axes: ['drop'], strips: null,
    guard: 'tests/dom/figma-export-coverage.dom.spec.js',
    why: '★Figma 업로드용 JSON 을 «블록 단위로» 짓는다(buildFigmaExportJSON). 순회가 못 본 ' +
         '블록은 에러 없이 {"columns":[]} 빈 껍데기가 된다 — 2026-09-09 실측으로 38종 중 15종. ' +
         '마커 축은 해당 없음(클래스가 아니라 JSON 모델을 낸다). ⚠️단 svg outerHTML 을 실어 ' +
         '나르는 자리가 있어 «마커 축»은 아직 «안 잰 것»이다 — 별건',
    dropDenominator: 'js/ 가 노출하는 window.add*Block 전수(기계가 grep 으로 셈)' },
  { file: 'js/io/figma-publish.js', kind: 'artifact', axes: ['drop'], strips: null,
    guard: 'tests/dom/figma-export-coverage.dom.spec.js',
    why: '★그 JSON 을 실제로 «내보내는» 문(doFigmaUpload). 이 채널만 «살아 있다» — ' +
         'exportFigmaJSON(파일 저장)·HTML 내보내기·Design JSON 은 부르는 곳이 검사뿐이다. ' +
         '그래서 검사도 여기 기준으로만 짰다',
    dropDenominator: 'js/ 가 노출하는 window.add*Block 전수(기계가 grep 으로 셈)' },

  // ── compare — 결과물은 아니지만 «문자열 비교»의 입력이다 ────────────────
  { file: 'js/market-merge.js', kind: 'compare', axes: ['marker'], strips: 'runtimeMarkers',
    why: '협업 머지의 섹션 정규화 키. 2026-09-09 까지 자기 _RUNTIME_CLS 명단으로 걷었고 그 명단에 ' +
         '두 줄 마커가 «없어» 줄을 고른 것만으로 「변경됨」 오탐이 났다(백로그 F2). ' +
         '이제 window.runtimeMarkers(section-serialize) 를 읽는다' },
  { file: 'js/version-diff.js', kind: 'compare', axes: ['marker'], strips: 'runtimeMarkers',
    why: '버전 비교의 섹션 정규화 키. market-merge 와 «같은» window.runtimeMarkers 를 읽는다 ' +
         '— 두 벌 명단이면 한쪽만 고쳐지는 날이 온다(백로그 F2)' },

  // ── transient — 라이브/일시. 결과물이 아니다 ───────────────────────────
  { file: 'js/io/save-load.js', kind: 'artifact', axes: ['marker', 'drop'], strips: 'inline',
    delegates: [{ file: 'js/io/capture-safety.js', entry: 'stripEditorOnlyForCapture' }],
    dropFns: ['captureThumbnail'], guard: 'tests/unit/capture-drop-axis.test.mjs',
    dropDenominator: DROP_DENOM,
    dropWhy: '★썸네일(프로젝트 카드) — 첫 섹션 클론에서 ★사라지면 안 되는 것 = ★그 섹션의 ★콘텐츠 블럭. ' +
             '★제 손 지우기는 ★0줄(공용 겹 위임) · ⛔저장 직렬화(serializeCleanRoot)는 이 축이 ★안 잰다 — 그건 marker 축의 일',
    why: '★2026-10-10 에 transient → artifact 로 고쳤다(advqa 가 잡았다). ' +
         '★옛 why 는 「⑴썸네일 클론은 body 로 나가 #canvas 스코프 밖이라 마커가 안 그려진다 ' +
         '⑵캔버스 직렬화는 serializeCleanRoot 에 위임 ⑶히트존 리스너 교체」였고 ★⑴⑵⑶ 은 ★지금도 참이다. ' +
         '★그러나 captureThumbnail 이 만드는 썸네일은 saveProjectMeta 로 ★_meta.json 에 굳고 ' +
         '★프로젝트 목록 ★카드에 뜬다 = ★★«사용자가 보는 산출물»이다. ' +
         '⇒ 「그려지나」로는 transient 지만 「무엇을 굳히나」로는 ★artifact 다. ' +
         '★그래서 이 파일은 stripEditorOnlyForCapture 에 위임한다(save-load.js:120). ' +
         '★★이 칸이 transient 였던 동안 U6-c 의 MARKER_TOKENS 순회가 ★이 문을 안 돌았고, ' +
         'delegates 도 없어 ★그 한 줄을 지워도 ★아무것도 빨개지지 않았다. ' +
         '★★그리고 내 제 문구가 스스로 어긋나 있었다 — 아래 capture-safety 칸이 ' +
         '「세 산출물(PNG·★썸네일·단독 HTML)」이라 적어 놓고 ★그 썸네일을 만드는 파일을 transient 로 뒀다' },
  /* 10-05 G11 ① 로 옮김 · 옛 자리 = js/props/prop-mockup.js(같은 «왜») — 클론하는 찍기가 공용 captureSectionImage 로 갔다 */
  { file: 'js/io/capture-safety.js', kind: 'artifact', axes: ['marker', 'drop'], strips: 'inline',
    dropFns: ['stripEditorOnlyForCapture'], guard: 'tests/unit/capture-drop-axis.test.mjs',
    dropDenominator: DROP_DENOM,
    dropWhy: '★공용 겹 — PNG·썸네일·단독 HTML ★세 소비자가 ★같이 부른다 ⇒ ★여기서 지우는 선택자 한 줄이 ★세 산출물에서 ★같이 빠진다. ' +
             '★사라지면 안 되는 것 = ★콘텐츠 블럭 전부 · ★지워도 되는 것 = ★DROP_STRIP_ROSTER 의 이 칸(편집 chrome·설계 제외·현빈 칸)뿐',
    why: '★2026-10-10 에 transient → artifact 로 고쳤다. 옛 why 는 「목업 이미지 클론을 body 에 붙여 찍으니 ' +
         '마커 CSS 가 #canvas 스코프라 안 그려진다」였고 ★그 문장은 지금도 참이다 — 그러나 ★이 파일은 ' +
         '★stripEditorOnlyForCapture 로 ★세 산출물(PNG·썸네일·단독 HTML)의 ★마커를 걷는 ★공용 겹이다. ' +
         '★즉 «그려지나»로는 transient 지만 «무엇을 걷나»로는 ★artifact 의 임자다. ' +
         '★A4(2026-10-10)에서 ★grd-cell-selected 가 ★이 겹에 없어 ★배송본에 실렸다 — ' +
         '명부가 ★여기에 있다는 사실이 ★안 적혀 있어 ★자의 분모 밖이었다. ' +
         '⚠️★이 명부는 «둘째»다(임자 = section-serialize.js runtimeMarkers). ★모으기는 지디 명부로 올렸다 — ' +
         '까닭: 이 함수를 «실행하는» DOM 검사 9벌이 부분 하네스라 section-serialize.js 를 안 싣는다' },
  { file: 'js/editor.js', kind: 'transient', axes: ['marker'], strips: null,
    why: '⑴ 절대배치 블록 «복제»(라이브 캔버스로 들어간다) ⑵ 히트존 노드 교체(리스너 초기화)' },
  { file: 'js/block-factory.js', kind: 'transient', axes: ['marker'], strips: null,
    why: '히트존 노드 교체(리스너 초기화) — 내용 클론이 아니다' },
  { file: 'js/branch-system.js', kind: 'transient', axes: ['marker'], strips: null,
    why: '브랜치 캔버스 간 섹션 «이식» — 라이브 DOM 이고, 저장은 그 뒤 serializeCleanRoot 를 탄다' },
  { file: 'js/section-variation.js', kind: 'transient', axes: ['marker'], strips: null,
    why: '섹션 변형 «복제» — 라이브 캔버스로 들어간다(deselectAll 이 마커를 걷는다)' },
  { file: 'js/tab-system.js', kind: 'transient', axes: ['marker'], strips: null,
    why: '탭 드래그 «고스트» — 드롭과 함께 사라진다' },
  { file: 'js/section-merge.js', kind: 'transient', axes: ['marker'], strips: null,
    why: '섹션 분리(D1, 2026-10-01) — 원 섹션의 «툴바» 단추를 본떠 새 섹션 껍데기에 단다. 라이브 캔버스로 들어가는 편집 UI 이고, 내용 클론이 아니다' },

  // ── 순회 분모(globTraverseFiles)가 끌어오는 나머지 — «블록 단위»가 아니라
  //    «섹션 outerHTML 통째»를 다룬다. 그래서 빠짐 축이 구조적으로 해당 없다. ────
  { file: 'js/collab/sync.js', kind: 'compare', axes: ['marker'], strips: NORM_FN,
    why: '협업 동기화 — 파싱은 «섹션을 쪼개려고» 할 뿐, 단위가 섹션 outerHTML 통째라 ' +
         '블록이 순회에서 빠질 자리가 없다(빠짐 축 해당 없음). 마커 세척은 자기 명단을 ' +
         `들지 않고 market-merge 의 ${NORM_FN} 에 위임한다 — 그쪽이 window.runtimeMarkers 를 읽는다` },
  { file: 'js/history-diff.js', kind: 'compare', axes: ['marker'], strips: NORM_FN,
    why: '협업 undo 의 섹션 단위 diff — raw outerHTML 문자열 비교라 블록을 «세지» 않는다 ' +
         `(빠짐 축 해당 없음). 해시를 낼 때만 market-merge 의 ${NORM_FN} 에 위임한다` },
];

/* ★★2026-10-10 신설 — ★★`carry` 축 (현빈 1009t3-③ · t3frame)
   ★★왜 — ★이 명부의 축이 ★`marker`(마커가 ★새나) · ★`drop`(블록이 ★빠지나) ★둘이었는데,
     ★★«새 속성·새 CSS 변수가 ★배송물에 ★실리나»는 ★★어느 축에도 ★안 걸렸다.
     ★이 파일 ★머리말이 ★스스로 경고한 자리다 — 「★결함이 하필 ★명부 밖 · ★★축 밖에 있던 게 ★우연이 아니다」.
   ★★무엇을 재나 — ★★«지워지지 ★않는가»다. ★실측(2026-10-10): 배송 경로는 ★data-* 와 ★custom property 를
     ★★«이름으로만» 뗀다(★와일드카드 ★0건 — `data-ref-links` · `data-lazy-bg` · `data-shape-fill` ·
     `--tgs-src` · `--tgs-filter`). ⇒ ★위험은 ★★«누가 ★이름을 ★그 명단에 ★더하는 날»이다.
   ⛔이 축이 ★안 재는 것 ★셋 (★출력·머리말 ★양쪽에 ★적는다):
     ⒤ ★★«실제로 ★실렸나»를 ★행위로 ★안 잰다 — ★소스에서 ★«떼는 자리»가 ★없음까지다
     ⅱ) ★Figma(`export-figma-json.js`)는 ★★애초에 ★프레임 배경 크기를 ★★0건 읽는다 ⇒ ★★기존 공백이고
        ★이 축으로 ★안 덮인다(★JSON 모델을 ★손으로 ★짓는 채널이라 ★«안 지움»이 ★«실림»을 ★뜻하지 않는다)
     ⅲ) ★`js/io/lazy-sections.js` 는 ★명부 ★밖이다 — ★clone·DOMParser 를 ★안 쓴다(★라이브 왕복).
        ★★실측해 ★봤다: ★그것은 ★`style.backgroundImage` ★하나만 ★`data-lazy-bg` 로 ★옮기고
        ★★`backgroundSize` 는 ★★안 건드린다 ⇒ ★이 키들은 ★그 왕복을 ★살아남는다. ★그래서 ★안 넣었다
   ★★한 쌍: ★★«이 키를 ★어느 배송 경로의 ★떼는 명단에 ★넣으면 ★U6-h 가 ★빨강» */
const CARRY_KEYS = [
  'data-bg-size',        /* 프레임·섹션 배경 «크기» — dataset.bgSize 의 속성 꼴 */
  'data-bg-pos',         /* 그 짝(위치) — 둘이 갈리면 한쪽만 지워지는 날이 온다 */
  '--frame-bg-size',     /* ::before 경로가 읽는 변수 */
  '--frame-bg-pos',
];

/* ★★2026-10-22 — ★`drop` 축을 ★클론 채널(PNG·썸네일·단독 HTML)에 ★단다 (imac-지디워커 · 설계 = 지디 PLAN-drop-axis-261022)
   ★★왜 — `drop` 은 ★2026-09-09 에 ★Figma 용으로 났고 ★18 채널 중 ★2(둘 다 Figma)에만 달렸다.
     ★PNG 쪽은 ★`stripEditorOnlyForCapture` 가 ★요소를 ★remove() 하는 ★유일한 공용 겹인데, ★그 선택자 명부가
     ★한 줄 늘어도 ★어느 검사도 ★안 빨개졌다 — ★`.annotation-block` 이 ★그렇게 ★명부에 들어 있는 채
     ★t3-01 사이즈 스티커(annotKind 'dim' · ★같은 클래스)가 ★출하됐다.
   ★★무엇을 재나 — ★«클론에서 ★요소를 ★지우는 선택자»가 ★전부 ★이 명부에 ★«이름과 왜»로 ★있나.
     ⇒ ★★한 쌍: ★지우는 명부를 ★한 줄 늘리면 → ★이 축이 ★빨강(★그 선택자 이름으로). ★늘리려면 ★여기 ★왜를 적어라.
     ⇒ ★지우는 선택자가 ★블럭 클래스(분모 ⑵)면 ★kind 가 ★'design'·'open' 이어야 한다 — ★'chrome' 으로 ★못 숨긴다.
   ★kind — 'chrome' = 편집 UI(콘텐츠 아님) · 'design' = 콘텐츠 꼴이지만 ★설계로 뺀다(까닭을 why 에) ·
            'open' = ★빠지는 것이 ★맞는지 ★안 정해졌다 — ★현빈 칸(⛔이 축이 ★정하지 않는다 · 제품 동작 0 변경)
   ⛔이 축이 ★안 재는 것 (★셋 — 출력·머리말 양쪽에 적는다):
     ⒤ ★숨기기(visibility·display)·속성 떼기·중립화 — ★요소 «제거»만 잰다
        (hidePlaceholderTextForCapture · stripImageMemoForCapture · neutralizeEmptyImageCheckerForCapture · neutralizeRedactForH2C 는 ★DROP_DESIGN_EXCLUSIONS 에 ★이름만)
     ⅱ) ★«실제로 그려졌나» — ★픽셀은 ★S3 몫(PLAN ③ 의 `'rendered'` 축 · ★아직 안 올렸다)
     ⅲ) ★지우는 선택자가 ★블럭 «안»의 콘텐츠 조각(예: 블럭 자식 클래스)을 ★잡는지 — ★선택자 이름만 본다 */
const DROP_STRIP_ROSTER = {
  'js/io/capture-safety.js#stripEditorOnlyForCapture': [
    { sel: '.section-label',    kind: 'chrome', why: '섹션 이름 꼬리표 — 편집 화면 표시' },
    { sel: '.section-toolbar',  kind: 'chrome', why: '섹션 툴바 단추 줄' },
    { sel: '.variation-badge',  kind: 'chrome', why: 'A/B 시안 배지' },
    { sel: '.annotation-block', kind: 'open',
      why: '★펜 주석(C18 · 리뷰 표시)이라 뺐다 — ★그러나 ★t3-01 사이즈 스티커(치수선 · annotKind \'dim\')가 ★같은 클래스를 쓴다 ' +
           '⇒ ★사이즈 표시가 ★PNG·썸네일·단독 HTML 에서 ★빠진다. ★빼는 게 맞나는 ★현빈 칸(이 축은 ★정하지 않는다 · 0 변경) · ' +
           '★2026-10-22 현빈 결정 ⒝ = 「어노테이션·치수선은 최종 이미지에 보인다」 ⇒ ★지금의 지우기는 결정과 ★어긋난다(제품 고침 = 지디 칸 · EDITOR_NODE_EXCEPTIONS 참조)' },
    { sel: '.annot-preview',    kind: 'design', why: '펜툴 «그리는 중» 미리보기 — 확정 전 임시 선(PLAN ④㉡ 설계 제외)' },
    { sel: '.qa-block',         kind: 'design', why: 'admin QA 체크리스트 — 작업 메타데이터(감싼 .row 째 지운다 · 자리도 안 남긴다)' },
    { sel: '.sec-bg-proxy',     kind: 'chrome', why: '섹션 배경 편집 프록시 — 배경 그림이 두 번 찍힌다' },
    { sel: '.img-edit-hint',    kind: 'chrome', why: '이미지 편집 안내' },
    { sel: '.img-boundary',     kind: 'chrome', why: '이미지 편집 경계 선' },
    /* ★★★R1 몫 ★아홉 — ★2026-10-22 ★지디 ★승인. ★★머지 `4ca3dc58`(아이맥 `45c0ad6b`)이 ★더한 것.
       ★까닭: ★「★안 막히는 칸」 ★47 중 ★R1 몫 ★16(= ★이 아홉 × capture·html ★두 길)이
         ★★★«편집 장식인데 ★캡처 겹에서 ★안 지워진다」였다 ⇒ ★내보낸 그림에 ★찍힐 수 ★있다.
       ⛔★★이 명부에 ★안 적고 ★제품만 고쳤더니 ★★D3 가 ★★36 건으로 ★빨개졌다(★소비자 ★넷 × ★아홉).
         ⇒ ★★★그 자가 ★제 일을 했다 — ★「★한 줄 늘리면 ★그 이름으로 ★빨강」.
       ★★⇒ ★그래서 ★★여기에 ★이름·까닭을 ★적는다. ★★이것이 ★★«승인»이다. */
    { sel: '.annot-selbox',         kind: 'chrome', why: '어노테이션 ★선택 상자 — 고른 동안만 보이는 편집 표시' },
    { sel: '.drop-indicator',       kind: 'chrome', why: '드래그 ★드롭 자리 표시 — 끄는 동안만' },
    { sel: '.grad-line-overlay',    kind: 'chrome', why: '그라데이션 ★조절선 오버레이 — 패널을 열었을 때만' },
    { sel: '.grd-add-btn',          kind: 'chrome', why: '그리드 ★칸/줄 ★추가 단추 — 편집 UI' },
    { sel: '.mdl-profile-x',        kind: 'chrome', why: '모달 프로필 ★✕ 단추 — 지우기용 편집 UI' },
    { sel: '.section-block[data-ghost]', kind: 'chrome', why: '드래그 중 ★고스트 섹션 — 끄는 동안의 ★그림자(실물이 아니다)' },
    { sel: '.section-height-badge', kind: 'chrome', why: '섹션 ★높이 배지 — 편집 화면 치수 표시' },
    { sel: '.vpen-edit-overlay',    kind: 'chrome', why: '펜 ★편집 오버레이 — 편집 모드에서만' },
    { sel: '.vpen-preview',         kind: 'design', why: '펜 ★미리보기 — 확정 전 임시 선(`.annot-preview` 와 ★같은 갈래)' },
    /* ★★★R1 ★닫음 — ★2026-10-23 ★지디. ★★위 「R1 몫 아홉」과 ★다른 꼴로 적는다.
       ★무엇이 바뀌었나 : ★캡처 겹이 ★제 손 명부 대신 ★★저장 정본 상수를 ★읽는다
         `js/io/capture-safety.js` → `clone.querySelectorAll?.(NON_CONTENT_UI_SELECTOR)…`
         ⇒ ★파서(`_clone-removals.js`)가 ★문자열이 아니라 ★★식별자를 본다 ⇒ ★`$NON_CONTENT_UI_SELECTOR`.
       ★★★왜 ★그 21 종을 ★여기 ★베껴 적지 ★않나 :
         ⒤ ★베끼면 ★★«셋째 명부»가 된다 — ★저장 정본 · ★캡처 · ★여기. ★한쪽이 ★반드시 ★뒤처진다.
            (★그 말은 ★그 상수의 ★머리말이 ★이미 적고 있다 — 「두 벌로 만들면 한쪽이 반드시 뒤처진다」)
         ⅱ) ★★그 상수엔 ★제 ⛔계약이 ★있다 — 「★serializeProject 가 ★실제로 지우는지 ★먼저 확인하라」.
            ⇒ ★★거기 든 것은 ★★«저장이 지운다» = ★★계약상 ★콘텐츠가 ★아니다 ⇒ ★드롭 승인이 ★따라온다.
            ⇒ ★그 계약을 ★S3 가 ★자동으로 잠근다(「NON_CONTENT 의 모든 항목이 저장에서 0건」).
         ⇒ ★★그래서 ★승인은 ★«종 하나하나»가 아니라 ★★«그 출처 ★전체»에 ★한 번 ★준다.
       ★★⛔잃은 것 ★하나 : judgeDrop 의 ★`kind` 교차검사(「블럭 클래스를 chrome 으로 적었나」)가
         ★`$…` 꼴엔 ★안 걸린다. ⇒ ★★그 구멍을 ★★D3b 가 ★메운다(capture-drop-axis.test.mjs).
       ★종 이름을 ★보려면 : `js/io/editor-ui-roster.js` (261023 = ★21 종) */
    { sel: '$NON_CONTENT_UI_SELECTOR', kind: 'chrome',
      why: '★저장 정본 상수 ★전체(js/io/editor-ui-roster.js NON_CONTENT_UI_SELECTOR) — ★«저장이 지우는 것» = ★그 상수의 ⛔계약상 ★콘텐츠가 아니다. ' +
           '★그래서 ★종별이 아니라 ★출처별로 ★한 번 승인한다(⛔여기 베껴 적으면 ★셋째 명부가 된다). ★계약을 잠그는 자 = S3 · ★kind 구멍을 메우는 자 = D3b' },
  ],
  'js/io/export-html.js#exportHTMLFile': [
    { sel: '$HIDDEN_VARIATION_SECTION_SEL', kind: 'design', why: '안 고른 A/B 시안 섹션 — 배송본에 둘 다 보이던 병(2026-09-09) · 저장본은 안 뺀다' },
    ...['.col-placeholder', '.col-add-btn', '.col-add-menu', '.row-col-add-btn', '.row-drop-indicator', '.layer-section-drop-indicator']
      .map(sel => ({ sel, kind: 'chrome', why: '빈 칸 자리표시·칸/줄 추가 단추·드롭 표시 — 편집 UI' })),
    ...['.section-hitzone', '.shape-handle', '.asset-overlay-handle', '.icb-overlay-handle', '.zm-overlay-handle',
        '.mdl-overlay-handle', '.grd-img-overlay-handle', '.tfo-overlay-handle', '.grid-cell-resize-handle']
      .map(sel => ({ sel, kind: 'chrome', why: '히트존·손잡이 — 앱 CSS 를 실으며 드러난 편집 DOM(2026-09-21)' })),
    ...['.label-item-delete-btn', '.label-group-add-btn', '.grd-add-btn', '.mdl-profile-x']
      .map(sel => ({ sel, kind: 'chrome', why: '✕삭제·＋추가 단추 — 직렬 DOM 보존형 블럭의 편집 단추(BL-CD-10)' })),
    ...['.sec-bg-proxy', '.img-edit-hint', '.img-boundary', '.img-corner-handle', '.img-edge-handle', '.img-rotate-zone', '.mdl-rotate-zone']
      .map(sel => ({ sel, kind: 'chrome', why: '이미지·배경·모달 편집 임시 DOM — 앱 CSS 없는 배송본에서 겹쳐 찍힌다' })),
  ],
};

/* ★설계로 «안 보이게» 하지만 ★요소 제거가 ★아닌 것 — ★이름만 한 자리에(PLAN ④㉢). ⛔위 축이 ★안 잰다(⒤). */
const DROP_DESIGN_EXCLUSIONS = [
  /* since = ★이력에서 뜬 날짜(git log --reverse -S 첫 등장 · 파티클은 릴리스 노트 0.9.7 date) — ⛔기억에서 옮기지 않았다 */
  { id: 'PLACEHOLDER-EXCLUDED-BY-DESIGN-01', sel: '[data-is-placeholder]', what: '[data-is-placeholder] 미입력 안내문구', how: 'hidePlaceholderTextForCapture — visibility:hidden(글만 · 자리는 남는다)', since: '2026-09-21 (0806201e)' },
  { id: 'MEMO-EXCLUDED-BY-DESIGN-01',        sel: '[data-memo]',           what: 'data-memo 이미지 메모 쪽지',          how: 'stripImageMemoForCapture — 속성만 뗀다(가상요소 쪽지가 사라진다)', since: '2026-09-30 (0063cc5d)' },
  { id: 'QA-EXCLUDED-BY-DESIGN-01',          sel: '.qa-block',             what: '.qa-block admin QA 블럭',              how: 'stripEditorOnlyForCapture — 감싼 .row 째 remove()(위 명부 kind design)', since: '2026-09-16 (cbc08322)' },
  { id: 'PARTICLE-EXCLUDED-BY-DESIGN-01',    sel: '.sec-fxpart-wrap',      what: '섹션 배경 파티클',                      how: '릴리스 노트 0.9.7 「저장물에는 들어가지 않음」 — 이 축이 안 잰다(restRuntimeForArtifact 는 «쉬는 꼴»로 돌릴 뿐)', since: '2026-10-12 (release-note 0.9.7)' },
];

/* ══ ★★편집 전용 «노드» 정본 — CAPTURE-ROSTER-NOT-DERIVED-FROM-SAVE-01 (2026-10-22 · 설계 = 지디 PLAN-capture-derive) ══
   ★왜 — 편집 노드(손잡이·회전 핫존·배지)의 명부가 ★여럿이다: 저장(save-load NON_CONTENT_UI_SELECTOR · section-serialize serializeCleanRoot)
     · 캡처 공용 겹(9) · 단독 HTML 제 손(27). ★손으로 따로 들어서 ★한쪽만 고쳐졌다 — export-html.js:120 「2026-09-21 실측 … .shape-handle 8개가
     그대로」 를 HTML 만 배웠고 PNG·썸네일 겹(capture-safety)엔 ★handle 이 ★하나도 없다. ⇒ ★처방 = «토큰 더하기»가 아니라 ★«파생 ＋ 검산».
   ★★정본 = ★두 출처의 합 (2026-10-22 지디 판정 ⑴ 「정본을 넓혀라 · serialize 줄까지」)
     ⒜ js/io/save-load.js `export const NON_CONTENT_UI_SELECTOR = '…'` — 문자열 리터럴 파싱 (dc93370e = 21종)
     ⒝ js/io/section-serialize.js `function serializeCleanRoot(root)`(:304) 몸통의 `querySelectorAll('…').forEach(… .remove())` 전부
        — tests/unit/_clone-removals.js 파서(주석 떼고 · forEach 콜백에 .remove() 가 든 것만 · 리터럴은 쉼표로 쪼갬)
        (dc93370e = :355 1종 ＋ :356 30종 ＋ :392 1종 = 32종 · ⒜ 21종을 ★다 품는다 ⇒ ⒝ ∖ ⒜ = 11)
     ⇒ 합 = 32종(dc93370e). ⛔손으로 안 적는다 — 출처 두 자리를 ★읽는다.
   ⛔★「저장이 지우는 것」≠「캡처가 지워야 할 것」(설계서 ④⒝) ⇒ 항목마다 ★CAPTURE_VERDICT 칸: 'yes' · 'no'(까닭) · 'unmeasured'. */
const EDITOR_NODE_CANON_SRC = [
  { file: 'js/io/editor-ui-roster.js', kind: 'const', name: 'NON_CONTENT_UI_SELECTOR' },   /* ★261023 — save-load.js 에서 ★잎 모듈로 옮겼다(캡처도 같은 상수를 봐야 하는데 거꾸로 import 하면 순환) */
  { file: 'js/io/section-serialize.js', kind: 'fn-removals', name: 'serializeCleanRoot' },
];
/** 정본을 ★소스에서 끌어온다 — { all: [합], by: { 'file#name': [그 출처 몫] } }. 못 찾으면 ★던진다(침묵 0). */
function editorNodeCanon(root) {
  const fs = require('fs'), path = require('path');
  const { fnBody, removedSelectors } = require('./unit/_clone-removals.js');
  const { makeStripper } = require('./unit/_strip-comments.js');
  const by = {};
  for (const s of EDITOR_NODE_CANON_SRC) {
    const src = fs.readFileSync(path.join(root, s.file), 'utf8').replace(/\r\n/g, '\n');
    let list;
    if (s.kind === 'const') {
      const m = new RegExp('export const ' + s.name + "\\s*=\\s*((?:'[^']*'\\s*\\+?\\s*)+);").exec(src);
      if (!m) throw new Error('★정본 ' + s.name + ' 을 ' + s.file + ' 에서 못 찾았다 — 파서가 눈멀었다');
      list = [...m[1].matchAll(/'([^']*)'/g)].map(x => x[1]).join('').split(',').map(x => x.trim()).filter(Boolean);
    } else {
      const strip = makeStripper();
      const body = fnBody(src.split('\n').map(l => strip(l)).join('\n'), s.name);
      if (!body) throw new Error('★정본 ' + s.name + ' 함수를 ' + s.file + ' 에서 못 찾았다');
      const r = removedSelectors(body);
      if (r.covered !== r.total) throw new Error('★' + s.name + ' 에 파서가 못 읽는 지우기 꼴이 ' + (r.total - r.covered) + ' 곳');
      list = r.sels;
    }
    if (!list.length) throw new Error('★정본 출처 ' + s.file + '#' + s.name + ' 에서 0종 — 자가 눈멀었다(판을 먼저 의심하라)');
    by[s.file + '#' + s.name] = list;
  }
  return { all: [...new Set(Object.values(by).flat())], by };
}

/* ★★「캡처에서도 지워야 하나」 — 정본 항목마다 하나 (지디 판정 ⑴ 의 조건 · 값 셋: yes / no(까닭) / unmeasured)
   ⛔'yes' 는 ★근거(자리)를 단다 — 이름이 «handle» 이라서가 아니다. 근거를 못 대면 'unmeasured'.
   ★정본 «밖»이라도 'no' 의 보기는 여기 둔다(.annotation-block — 저장은 안 지우고 캡처는 지금 지운다 · 결정은 «남는다»). */
const _Y = (why) => ({ v: 'yes', why });
const CAPTURE_VERDICT = {
  '.img-corner-handle':   _Y('이미지 편집 손잡이 — export-html 제 손 명부가 이미 지운다(js/io/export-html.js:130)'),
  '.img-edge-handle':     _Y('이미지 편집 손잡이 — export-html:130 이 이미 지운다'),
  '.img-edit-hint':       _Y('이미지 편집 안내 — 캡처 공용 겹이 이미 지운다'),
  '.img-boundary':        _Y('이미지 편집 경계 — 캡처 공용 겹이 이미 지운다'),
  '.img-rotate-zone':     _Y('이미지 회전 핫존 — export-html:130 이 이미 지운다'),
  '.ab-rotate-zone':      _Y('에셋 회전 핫존 — 선택 때 모서리에 붙는 편집 핫존(js/asset-rotate.js:2) · 그림은 .selected 매인 display 로 숨지만 노드는 산출물 쓰레기'),
  '.shape-rotate-zone':   _Y('도형 회전 핫존 — js/asset-rotate.js:47 「«선택 중»에만 히트영역」'),
  '.sticker-rotate-zone': _Y('스티커 회전 핫존 — js/sticker-select.js:347 블럭 안 appendChild'),
  '.tb-rotate-zone':      _Y('글자 회전 핫존 — save-load.js:652 「zoneClass: 정의 자리 7개」 의 하나(편집 핫존)'),
  '.icn-rotate-zone':     _Y('아이콘 회전 핫존 — 같은 zoneClass 정의 7 의 하나'),
  '.mkp-rotate-zone':     _Y('목업 회전 핫존 — 같은 zoneClass 정의 7 의 하나'),
  '.cvb-rotate-zone':     _Y('카드 회전 핫존 — 같은 zoneClass 정의 7 의 하나'),
  '.icb-rotate-zone':     _Y('아이콘카드 회전 핫존 — 같은 zoneClass 정의 7 의 하나'),
  '.vb-rotate-zone':      _Y('벡터 회전 핫존 — 같은 zoneClass 정의 7 의 하나'),
  '.mdl-rotate-zone':     _Y('모달 회전 핫존 — export-html:130 이 이미 지운다'),
  '.mdl-profile-x':       _Y('버즈 프로필 × 단추(에디터 크롬) — export-html:125 이 이미 지운다'),
  '.sec-bg-proxy':        _Y('섹션 배경 편집 프록시 — 캡처 공용 겹이 이미 지운다'),
  '.grd-add-btn':         _Y('그리드 ＋ 단추 — export-html:125 이 이미 지운다'),
  '.section-height-badge': _Y('섹션 높이 배지 — export-css-collect.js:43 이 «편집 전용» 배제 명부에 올려 둔 이름'),
  '.annot-handle':        _Y('어노테이션 «선택 중» 손잡이(save-load.js:647 주석) — 결정 ⒝ 로 부모 .annotation-block 이 캡처에 남으면 ★이것은 지워야 한다'),
  '.annot-selbox':        _Y('어노테이션 선택 상자 — js/annotation-select.js:118 (선택 표시)'),
  '.tfh-handle':          _Y('글상자 자유변형 U3 손잡이 12(모서리 4 ＋ 변 1/3·2/3 8) — .text-block 의 자식 · 2026-10-24 지디'),
  '.tfh-grid':            _Y('글상자 자유변형 U3 격자 — 변형 중 표시 · .text-block 의 자식 · 2026-10-24 지디'),
  '.section-block[data-ghost]': _Y('빈 «유령» 섹션 — js/block-factory.js:1424 display:none 자리표시 · section-search.js:81 이 콘텐츠에서 거른다'),
  '.shape-handle':        _Y('도형 손잡이 — 블럭의 자식(js/block-drag.js:617 · :1081) · export-html:120 이 2026-09-21 에 «8개 누출» 로 실측해 지운다'),
  '.sticker-corner-handle': _Y('스티커 모서리 손잡이 — 블럭 안 appendChild(js/sticker-select.js:331) · 전역 CSS 흰 바탕(MARKER-HLB-261022 ⑶)'),
  '.gradient-corner-handle': _Y('그라데이션 모서리 손잡이 — 블럭 안 appendChild(js/gradient-select.js:37) · 전역 CSS 흰 바탕(MARKER-HLB ⑶)'),
  '.hlb-handle':          _Y('선 스티커 끝점·두께 손잡이 — 블럭 안 appendChild(js/sticker-select.js:208) · 전역 CSS(MARKER-HLB ⑶)'),
  '.grad-line-overlay':   _Y('그라데이션 선 편집 오버레이 — js/gradient-line-overlay.js:20 「section-serialize 가 저장 시 제거」 · 편집 중 표시'),
  '.vpen-preview':        _Y('펜툴 «그리는 중» 미리보기 — 섹션 안 appendChild(js/pen-tool.js:336) · 캡처가 .annot-preview 를 같은 까닭으로 지운다(설계 제외)'),
  '.vpen-edit-overlay':   _Y('펜툴 편집 오버레이 — js/pen-tool.js:603 `wrap.className = \'vpen-edit-overlay\'` · 편집 중 표시'),
  '.drop-indicator':      _Y('드래그가 잠깐 심는 껍데기 — js/overlay-float.js:383 주석'),
  '.block-resize-handle': { v: 'unmeasured', why: '만드는 자리를 js/ 에서 못 찾았다(grep 0 — 옛 이름일 수 있다)' },
  '.ci-handle':           { v: 'unmeasured', why: '만드는 자리를 js/ 에서 못 찾았다(grep 0 — 옛 이름일 수 있다)' },
  /* ── 정본 «밖» — 'no' 의 보기 ── */
  '.annotation-block':    { v: 'no', why: '현빈 261022 결정 ⒝ — 어노테이션·치수선은 최종 이미지에 보인다 ⇒ 캡처에서 남는다', exception: 'ANNOTATION-STAYS-IN-CAPTURE-01' },
};
const CAPTURE_VERDICT_VALUES = ['yes', 'no', 'unmeasured'];

/* ★예외 — «정본 ∖ 세 길» 의 0 에서 ★이름과 까닭으로만 빠진다. ⛔두 벌 금지: 넷은 위 DROP_DESIGN_EXCLUSIONS 에서 ★파생한다.
   effect: 'stays' = 캡처에서 ★남아야 한다 · 'design' = 설계로 지우거나 숨긴다(결함 아님). exempts = 그 예외가 ★빼 주는 길. */
const EDITOR_NODE_EXCEPTIONS = [
  { id: 'ANNOTATION-STAYS-IN-CAPTURE-01', sel: '.annotation-block', effect: 'stays', exempts: ['capture', 'html'],
    why: '현빈 261022 결정 ⒝ — 어노테이션·치수선은 최종 이미지에 ★보인다 ⇒ 캡처에서 ★남는다', since: '2026-10-22 (현빈 결정 ⒝ · 지디 경유)' },
  ...DROP_DESIGN_EXCLUSIONS.map(x => ({ id: x.id, sel: x.sel, effect: 'design', exempts: ['capture', 'html'], why: x.what + ' — ' + x.how, since: x.since })),
];

const AXES = ['marker', 'drop', 'carry'];

module.exports = { CHANNELS, MARKER_TOKENS, MARKER_SCENES, CLEAN_FN, CLEAN_SELF_FN, AXES, NORM_FN, CARRY_KEYS,
  DROP_STRIP_ROSTER, DROP_DESIGN_EXCLUSIONS, EDITOR_NODE_CANON_SRC, editorNodeCanon, EDITOR_NODE_EXCEPTIONS,
  CAPTURE_VERDICT, CAPTURE_VERDICT_VALUES };
