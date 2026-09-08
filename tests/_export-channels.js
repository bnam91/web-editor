/* _export-channels — 「캔버스 DOM 이 결과물로 나가는 «문»」의 명부. (2026-09-08)
 *
 * ★왜 있나
 *   편집 전용 마커(.selected · .bn2-line-selected · .grd-line-selected …)는 저장본·PNG·HTML
 *   «어디로도» 새면 안 된다. 그런데 그걸 벗기는 자리가 이 레포엔 «흩어져» 있다 —
 *   한 곳만 빠지면 선택 파란 테두리가 배송본에 박힌다.
 *   ⛔그래서 「6자리 다 지웠나」로 세지 않는다. 7번째 문이 생기는 날 조용히 통과하기 때문이다.
 *   ⇒ 문의 «명부»를 여기 두고, tests/unit/export-channel-roster.test.mjs (U6) 가
 *     js/io 를 glob 으로 훑어 «명부 밖 파일 0건»을 강제한다. 새 파일이 생기면 빨강이다.
 *
 * ⛔여기에 파일을 «손으로» 늘려서 빨강을 끄지 마라 — 늘리려면 그 파일이 DOM 클래스를
 *   결과물로 나르는지 «보고» carriesDomClasses 를 정하고, true 면 마커 스트립을 «붙여라».
 *
 * 이 파일은 도구다(`_` 로 시작해 테스트 글롭에 안 걸린다).
 */
'use strict';

/** 편집 전용 마커가 «반드시» 벗겨져야 하는 클래스 토큰 — 채널마다 전부 있어야 한다. */
const MARKER_TOKENS = ['bn2-line-selected', 'grd-line-selected'];

/**
 * js/io 아래에서 «결과물을 내는» 파일 전수.
 *   carriesDomClasses: true  = 캔버스 DOM 을 클론해 클래스째 내보낸다 ⇒ 마커를 벗겨야 한다
 *                      false = DOM 클래스를 안 나른다(JSON·게이트·리포트 등) ⇒ 스트립 불필요
 */
const CHANNELS = [
  { file: 'js/io/section-serialize.js', carriesDomClasses: true,
    why: '저장본 — getSerializedCanvas 가 캔버스 «클론»을 세척해 innerHTML 로 굳힌다' },
  { file: 'js/io/export-html.js', carriesDomClasses: true,
    why: 'HTML 내보내기 — 클론을 그대로 문서로 만든다' },
  { file: 'js/io/export-image.js', carriesDomClasses: true,
    why: 'PNG 내보내기 — 라이브 DOM 클론을 캡처한다(재렌더가 마커를 되붙이는 자리도 여기)' },

  { file: 'js/io/export-design-json.js', carriesDomClasses: false, why: '디자인 JSON — 클래스가 아니라 모델을 쓴다' },
  { file: 'js/io/export-figma-json.js',  carriesDomClasses: false, why: '피그마 JSON — 모델 직렬화' },
  { file: 'js/io/export-gate-core.js',   carriesDomClasses: false, why: '릴리스 게이트 판정 — 산출물이 없다' },
  { file: 'js/io/export-gate.js',        carriesDomClasses: false, why: '릴리스 게이트 진입점 — 산출물이 없다' },
  { file: 'js/io/export-report.js',      carriesDomClasses: false, why: '리포트 — 텍스트 요약이라 DOM 클래스를 안 나른다' },
];

module.exports = { CHANNELS, MARKER_TOKENS };
