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

/** 편집 전용 마커 — artifact 채널에서 «반드시» 벗겨져야 하는 클래스 토큰. */
const MARKER_TOKENS = ['bn2-line-selected', 'grd-line-selected'];

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
const CHANNELS = [
  // ── artifact — 마커가 새면 결과물에 박힌다 ─────────────────────────────
  { file: 'js/io/section-serialize.js', kind: 'artifact', axes: ['marker'], strips: 'inline',
    why: '저장본 — 캔버스 클론을 세척해 innerHTML 로 굳힌다. ★이 파일이 «세척의 단일 진실원»이다' },
  { file: 'js/io/export-html.js', kind: 'artifact', axes: ['marker'], strips: 'inline',
    why: 'HTML 내보내기 — 라이브 클론을 그대로 문서로 만든다(serializeCleanRoot 를 안 거친다)' },
  { file: 'js/io/export-image.js', kind: 'artifact', axes: ['marker'], strips: 'inline',
    why: 'PNG 내보내기 — 라이브 DOM 클론을 캡처한다(재렌더가 마커를 되붙이는 자리도 여기)' },
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
  { file: 'js/io/save-load.js', kind: 'transient', axes: ['marker'], strips: null,
    why: '⑴ 썸네일 클론은 document.body 로 나가 #canvas 스코프 밖이라 마커가 «안 그려진다» ' +
         '⑵ 캔버스 직렬화는 serializeCleanRoot 에 위임한다 ⑶ 히트존 리스너 교체' },
  { file: 'js/props/prop-mockup.js', kind: 'transient', axes: ['marker'], strips: null,
    why: '목업 이미지 — 클론을 document.body 에 붙여 찍는다. 마커 CSS 가 «#canvas .grid-block» 스코프라 안 그려진다' },
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

const AXES = ['marker', 'drop'];

module.exports = { CHANNELS, MARKER_TOKENS, CLEAN_FN, CLEAN_SELF_FN, AXES, NORM_FN };
