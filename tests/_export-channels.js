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
 * 이 파일은 도구다(`_` 로 시작해 테스트 글롭에 안 걸린다).
 */
'use strict';

/** 편집 전용 마커 — artifact 채널에서 «반드시» 벗겨져야 하는 클래스 토큰. */
const MARKER_TOKENS = ['bn2-line-selected', 'grd-line-selected'];

/** 세척 단일 진실원. 이걸 부르면 토큰을 손으로 열거하지 않아도 된다(권장). */
const CLEAN_FN = 'serializeCleanRoot';

/**
 * kind — 그 클론이 «무엇을 만드는가»
 *   'artifact'  = 저장·배송되는 산출물이 된다        ⇒ 마커 스트립 «필수»(U6-c 가 검사)
 *   'compare'   = 비교용 «키 문자열»을 만든다         ⇒ 마커가 남으면 «오탐»을 만든다(백로그 F2)
 *   'transient' = 라이브 캔버스·리스너 교체·드래그 고스트 ⇒ 스트립 불필요
 */
const CHANNELS = [
  // ── artifact — 마커가 새면 결과물에 박힌다 ─────────────────────────────
  { file: 'js/io/section-serialize.js', kind: 'artifact', strips: 'inline',
    why: '저장본 — 캔버스 클론을 세척해 innerHTML 로 굳힌다. ★이 파일이 «세척의 단일 진실원»이다' },
  { file: 'js/io/export-html.js', kind: 'artifact', strips: 'inline',
    why: 'HTML 내보내기 — 라이브 클론을 그대로 문서로 만든다(serializeCleanRoot 를 안 거친다)' },
  { file: 'js/io/export-image.js', kind: 'artifact', strips: 'inline',
    why: 'PNG 내보내기 — 라이브 DOM 클론을 캡처한다(재렌더가 마커를 되붙이는 자리도 여기)' },
  { file: 'js/panels/template-system.js', kind: 'artifact', strips: CLEAN_FN,
    why: '★템플릿 저장 3곳(섹션·덮어쓰기·블록) — 2026-09-09 까지 마커를 «안» 벗기던 7번째 문. ' +
         '손 열거 대신 serializeCleanRoot 에 위임한다' },

  // ── compare — 결과물은 아니지만 «문자열 비교»의 입력이다 ────────────────
  { file: 'js/market-merge.js', kind: 'compare', strips: null,
    why: '협업 머지의 섹션 정규화 키. _RUNTIME_CLS 로 UI 클래스를 걷는데 그 목록에 두 마커가 «없다» ' +
         '⇒ 줄을 선택한 것만으로 「변경됨」 오탐이 난다(백로그 F2, 별건)' },
  { file: 'js/version-diff.js', kind: 'compare', strips: null,
    why: '버전 비교의 섹션 정규화 키. market-merge 와 같은 _RUNTIME_CLS 사본을 쓴다(백로그 F2)' },

  // ── transient — 라이브/일시. 결과물이 아니다 ───────────────────────────
  { file: 'js/io/save-load.js', kind: 'transient', strips: null,
    why: '⑴ 썸네일 클론은 document.body 로 나가 #canvas 스코프 밖이라 마커가 «안 그려진다» ' +
         '⑵ 캔버스 직렬화는 serializeCleanRoot 에 위임한다 ⑶ 히트존 리스너 교체' },
  { file: 'js/props/prop-mockup.js', kind: 'transient', strips: null,
    why: '목업 이미지 — 클론을 document.body 에 붙여 찍는다. 마커 CSS 가 «#canvas .grid-block» 스코프라 안 그려진다' },
  { file: 'js/editor.js', kind: 'transient', strips: null,
    why: '⑴ 절대배치 블록 «복제»(라이브 캔버스로 들어간다) ⑵ 히트존 노드 교체(리스너 초기화)' },
  { file: 'js/block-factory.js', kind: 'transient', strips: null,
    why: '히트존 노드 교체(리스너 초기화) — 내용 클론이 아니다' },
  { file: 'js/branch-system.js', kind: 'transient', strips: null,
    why: '브랜치 캔버스 간 섹션 «이식» — 라이브 DOM 이고, 저장은 그 뒤 serializeCleanRoot 를 탄다' },
  { file: 'js/section-variation.js', kind: 'transient', strips: null,
    why: '섹션 변형 «복제» — 라이브 캔버스로 들어간다(deselectAll 이 마커를 걷는다)' },
  { file: 'js/tab-system.js', kind: 'transient', strips: null,
    why: '탭 드래그 «고스트» — 드롭과 함께 사라진다' },
];

module.exports = { CHANNELS, MARKER_TOKENS, CLEAN_FN };
