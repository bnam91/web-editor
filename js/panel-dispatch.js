/* panel-dispatch.js — 「이 블럭의 우측 패널은 무엇인가」를 «한 자리»에서 답한다.
 * (window 전역, NO ES module — 플레인 스크립트로 얹는 자리가 여럿이라 그렇다.)
 *
 * ★왜 이 파일이 생겼나 (2026-09-21 «사용자 관점 훑기» T-079)
 *   현빈 페르소나: 「배너 글자크기를 40 으로 바꾸고 저장했는데 다시 열면 원래 크기로 돌아가 있어요」
 *   뿌리는 배너가 아니라 «패널 오라우팅»이었다.
 *     · js/blocks/banner02-block.js:345 addBanner02Block 은 삽입 뒤 window.selectBlock 만 부른다.
 *     · js/block-edit.js 의 selectBlock 은 타입표를 «9종»만 들고 나머지를
 *       `else window.showTextProperties(block)` 로 떨어뜨렸다 ⇒ 배너를 넣은 그 순간 우측 패널이
 *       «Text Block» 으로 떴다.
 *     · 텍스트 패널의 글자크기 커밋은 `contentEl.style.fontSize = …` (인라인) 인데,
 *       banner02 의 정본은 dataset.lines 이고 renderBanner02 가 inner.innerHTML 을 새로 그린다.
 *       js/io/save-load.js 는 로드 때 renderBanner02 를 «항상» 부른다 ⇒ 인라인은 통째로 폐기.
 *   = 화면은 즉시 바뀌고 autosave 도 돌아서 «됐다»고 보이는데, 다시 열면 없다(조용한 데이터 손실).
 *
 * ★그런데 표의 사본이 «넷»이었다 — 이게 진짜 뿌리다.
 *     ① js/block-drag.js  타입별 click 핸들러 (사실상의 정본)
 *     ② js/panels/layer-panel-items.js  else-if 사슬
 *     ③ js/history.js  _PANEL_BY_CLASS (스스로 「정본」이라 선언했던 표)
 *     ④ js/block-edit.js  selectBlock 의 9종  ← 결함 자리. 주석엔 「②의 미러」라 적혀 있었지만 낡았다.
 *   ③·④ 는 «폴백»까지 서로 달랐다(③ = 안 연다 / ④ = 텍스트 패널 / ② = 에셋 패널).
 *   ⇒ 같은 블럭이 «어디서 선택됐나»에 따라 다른 패널이 떴다.
 *   여기로 ③ 을 통째로 이사하고 ④ 를 이 파일에 위임한다. 사본 4 → 3, 결함 자리의 목록은 «0개».
 *
 * ★폴백은 ③ 의 것을 정본으로 삼는다 — 「표에 없으면 패널을 «건드리지 않는다»」.
 *   근거: 엉뚱한 패널의 「너비/높이」가 «실제로 먹는》 사고가 이미 있었다
 *   (tests/unit/layer-panel-panel-table.test.mjs 머리말 — gradient 에서 style.width 는 바뀌고
 *    dataset.gradWidth 는 그대로 = 저장값과 화면이 갈라진다). 안 여는 쪽이 덜 틀리다.
 *   ⇒ ④ 를 쓰던 경로(삽입 직후 자동선택 · js/inspector.js 의 점검 점프 · MCP/PM 진입점)에서
 *     「표에 없는 타입」은 이제 텍스트 패널 대신 «직전 패널 그대로»가 된다.
 *     표에 있는 타입은 전부 제 패널로 간다(전수: tests/dom/panel-route-on-add.dom.spec.js D-ROUTE-2).
 *
 * ⚠️핸들(showHandlesFor)은 여기서 «안» 붙인다. 두 호출자의 기존 동작이 다르기 때문이다 —
 *   js/history.js 의 _restoreSelection 은 붙이고, selectBlock 은 안 붙였다. 여기로 끌어오면
 *   zoom·asset·canvas 등에서 «2회 호출»이 되는데 그 멱등성을 아직 안 쟀다(modal 만 확인됨:
 *   js/overlay-handles.js showModalResizeHandles 의 `if (_modalResizeBlock === block) return`).
 *   ⇒ 호출자가 지금 하던 그대로 자기 자리에서 부른다. 이 파일은 «패널»만 책임진다.
 */

/* 순서 = 먼저 맞는 것이 이긴다. .speech-bubble-block/.liner-block 은 .text-block 을 겸하므로
   text-block 은 «맨 뒤».  (근거: js/block-drag.js 의 각 타입 click 핸들러)
   ★값을 화살표 함수로 두는 이유 — 패널 모듈은 ESM 이라 이 플레인 스크립트보다 «나중에»
     window 에 붙는다. 호출 시점에 조회해야 한다. */
const _PANEL_BY_CLASS = [
  ['shape-block',       (el) => window.showShapeProperties?.(el)],          // block-drag.js:2522
  ['asset-block',       (el) => window.showAssetProperties?.(el)],          // :1014
  ['gap-block',         (el) => window.showGapProperties?.(el)],            // :1111
  ['icon-circle-block', (el) => window.showIconCircleProperties?.(el)],     // :1139
  ['table-block',       (el) => window.showTableProperties?.(el)],          // :1236
  ['label-group-block', (el) => window.showLabelGroupProperties?.(el, null)], // :1381 (항목 미지정 = 블럭 전체)
  ['graph-block',       (el) => window.showGraphProperties?.(el)],          // :1434
  ['divider-block',     (el) => window.showDividerProperties?.(el)],        // :1812
  ['bridge-block',      (el) => window.showBridgeProperties?.(el)],         // :1841
  ['grid-block',        (el) => window.showGridProperties?.(el, null)],     // :1846 (줄 선택 없음)
  ['qa-block',          (el) => window.showQAProperties?.(el)],             // :1846
  ['infocard-block',    (el) => window.showInfoCardProperties?.(el)],       // :1846
  ['innercard-block',   (el) => window.showInnerCardProperties?.(el)],      // :1846
  ['modal-block',       (el) => window.showModalProperties?.(el)],          // :1846
  ['joker-block',       (el) => window.showJokerProperties?.(el)],          // :720
  ['canvas-block',      (el) => ((el.dataset.cardMode === 'simple' && window.showSimpleCardProperties)
                                  ? window.showSimpleCardProperties(el)
                                  : window.showCanvasProperties?.(el))],    // :1582~:1585
  ['banner02-block',    (el) => window.showBanner02Properties?.(el)],       // :1618 (항목 미지정)
  ['comparison-block',  (el) => window.showComparisonProperties?.(el)],     // :1645
  ['vector-block',      (el) => window.showVectorProperties?.(el)],         // :1672
  ['icon-block',        (el) => window.showIconifyProperties?.(el)],        // :1700
  ['mockup-block',      (el) => window.showMockupProperties?.(el)],         // :2019
  ['step-block',        (el) => window.showStepProperties?.(el)],           // :1465 (항목 미지정)
  ['chat-block',        (el) => window.showChatProperties?.(el)],           // :1493
  ['laurel-block',      (el) => window.showLaurelProperties?.(el)],         // :1521
  ['zoom-block',        (el) => window.showZoomProperties?.(el)],           // :1549
  ['icon-text-block',   (el) => window.showTextProperties?.(el)],           // :1732
  /* ★annotation — 2026-09-21 픽스 라운드에서 찾은 «T-079 의 쌍둥이».
       .annotation-block 은 dataset.type='annotation' 을 달아(js/blocks/annotation-block.js)
       getBlockById 를 «통과»하는데 표에는 없었다 ⇒ selectBlock/점검점프/MCP 경로에서
       고치기 전엔 텍스트 패널이 떴다. 그게 배너와 «똑같이» 위험한 이유:
         · .annot-label 은 contenteditable="false" 를 달고 있어(:202) prop-text.js 의
           `tb.querySelector('[contenteditable]')` 에 «걸린다» ⇒ 텍스트 패널이 정상 동작한다.
         · 그런데 annotation 의 정본은 dataset 이고, 로드 때 js/io/save-load.js 가
           makeAnnotationBlock 결과로 innerHTML 을 통째로 새로 그린다 ⇒ 인라인은 폐기.
       = 배너와 한 글자도 안 틀리는 «조용한 데이터 손실» 구조였다.
     캔버스 경로(js/annotation-select.js `_selectAnnotation`)가 여는 패널과 같은 것으로 맞춘다.
     ⚠️`_selectAnnotation` 자체를 부르지 않는 이유 — 그 함수는 `if (block.classList.contains('selected')) return`
       으로 시작하는데 selectBlock 은 «.selected 를 붙인 뒤» 여기를 부른다(= 영영 early-return). */
  ['annotation-block',  (el) => window.showAnnotationProperties?.(el)],      // js/annotation-select.js:74
  ['text-block',        (el) => window.showTextProperties?.(el)],           // :900 (버블·라이너 포함)
];

/** 그 블럭의 우측 패널을 연다. 표에 없으면 «아무것도 안 한다»(엉뚱한 패널보다 덜 틀리다).
 *  @returns {boolean} 패널을 열었으면 true.
 *  ★그라데이션·스티커는 «선택+핸들+패널»을 자기 진입점이 한 벌로 처리한다(4모서리 핸들은
 *    showHandlesFor 가 모르는 자기 것이다) → 표보다 «먼저» 본다. */
function openPanelForBlock(el) {
  if (!el || !el.classList) return false;
  try {
    if (el.classList.contains('gradient-block') && window._selectGradient) { window._selectGradient(el); return true; }
    if (el.classList.contains('sticker-block')  && window._selectSticker)  { window._selectSticker(el);  return true; }
    const hit = _PANEL_BY_CLASS.find(([cls]) => el.classList.contains(cls));
    if (!hit) return false;
    hit[1](el);
    return true;
  } catch (e) { console.warn('[panel-dispatch] 패널 열기 실패:', e); return false; }
}

window.openPanelForBlock = openPanelForBlock;

/** 「이 요소는 우측 패널을 가진 «블럭»인가」 — 위 표를 그대로 읽는 «부작용 없는» 판정.
 *  ★목록을 새로 만들지 않는다. openPanelForBlock 과 «같은 표·같은 특례»를 본다.
 *  ★왜 필요한가 (2026-09-22 T-084 후속) — js/block-edit.js getBlockById 는 「블럭인가」를
 *    «dataset.type 이 있는가»로 쟀다. 그런데 실측(9639)에서 dataset.type 이 «없는» 블럭이
 *    셋 있었다 — .asset-block · .icon-text-block · .label-group-block.
 *    셋 다 캔버스에서 «클릭하면 선택되고 제 패널이 뜨는» 진짜 블럭인데(실측: 이미지 블럭을
 *    클릭 → .selected + 「Asset Block」 패널), window.selectBlock(id) 은 false 를 돌려주고
 *    아무것도 안 했다 ⇒ 도구막대로 넣어도 표시가 안 붙고, js/inspector.js 의 점검 점프와
 *    MCP 진입점도 그 셋에는 조용히 안 먹었다.
 *  ⛔여기서 «비블럭 컨테이너»를 열거해 막지 않는다 — .section-block·.frame-block·.group-block 은
 *    표에 없어서 저절로 빠진다. 막을 목록을 적기 시작하면 그 목록이 낡는다(T-079 가 그 병이었다). */
function hasPanelForBlock(el) {
  if (!el || !el.classList) return false;
  if (el.classList.contains('gradient-block') || el.classList.contains('sticker-block')) return true;
  return _PANEL_BY_CLASS.some(([cls]) => el.classList.contains(cls));
}

window.hasPanelForBlock = hasPanelForBlock;
