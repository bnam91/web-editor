
// [v0.8 #4 보안] 그래프 바 color/라벨은 innerHTML 주입 → 화이트리스트·이스케이프(저장형 XSS 차단·고디터QA BUG-P2-1 S2)
// GR1(2026-10-03): 항목 막대 «그라데이션» — linear-gradient 만 넓혀 받는다. 판정은 브라우저 파서(_isCssBg)에 맡기고,
//   style="…" 속성 안에 그대로 박히므로 따옴표·세미콜론·꺾쇠·url( 은 막는다(속성 탈출·외부 자원 로드 차단). 그 밖의 꼴은 예전 그대로.
//   ⚠️판정 함수는 js/props/color-picker.js isCssBackgroundValue 와 «같은 식»의 사본이다 — import 하지 않는 까닭: drag-utils 를 «홀로»
//   서빙하는 DOM 하네스가 6개(frame-accepts-component-blocks·free-frame-flow-drag·grid-line-drag·no-selection-hint·
//   qa0920b-asset-width-set·shape-frame-isolation)라 import 한 줄이 404 → 모듈 통째 죽음이 된다(실측 2026-10-03 F0 30s 시간초과).
let _gradProbe = null;
function _isCssBg(v) {
  if (!_gradProbe) _gradProbe = document.createElement('div');
  _gradProbe.style.background = '';
  try { _gradProbe.style.background = v; } catch (_) { return false; }
  return _gradProbe.style.background !== '';
}
/* ★E152(2026-10-06) — 그래프 렌더러의 «속성 안 색»은 전부 이 검증기를 지난다(값/카테고리 라벨 색 · 선 · 면 · 막대 · 범례 점).
   사본 52(08-07)의 그래프 색 값 56 개 전부 통과(거절 0 · \$S/bt2fix/color-census.json) ⇒ 그 표본의 기존 문서 색 무변. */
function _safeGraphColor(c) {
  if (typeof c !== 'string') return '';
  const s = c.trim();
  if (/^linear-gradient\(/i.test(s)) return (!/url\(|[;"'<>\\]/i.test(s) && _isCssBg(s)) ? s : '';
  return (/^#[0-9a-fA-F]{3,8}$/.test(s) || /^rgba?\(\s*[\d.,\s%]+\)$/i.test(s) || /^hsla?\(\s*[\d.,\s%]+\)$/i.test(s) || /^[a-zA-Z]+$/.test(s)) ? s : '';
}
/* ★E152(2026-10-06) — 사용자 글자는 이 한 자리로: 카테고리 라벨 셋(E150 포함) · 값 라벨(세로 · 꺾은선 · 비교) · 비교 범례 A/B · 가로 % (innerHTML 에 날것 0). */
function _escGraphHtml(v) {
  return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ═══════════════════════════════════
   DRAG UTILITIES — pure helpers, no drag state
═══════════════════════════════════ */
import './graph-limits.js';   // side-effect import — window.GRAPH_LIMITS(막대 두께 기본·한계의 한 자리)를 «이 모듈보다 먼저»
import './graph-pie-geom.js';   // side-effect import — window.GRAPH_PIE_GEOM(원형·도넛 조각 기하 · 1012t1G1). graph-limits 와 같은 길(모듈 하네스는 _drag-utils-deps 가 따라 준다)
import './graph-shape.js';   // side-effect import — window.GRAPH_SHAPE(SVG 모양 · 채움 · 마디 · 1012t1G2·G3·G4). 같은 길
import { state } from './globals.js';
import { isShapeFrame, resolveInsertFrame, anchorUnitOf } from './shape-frame.js';
/* ★「이 요소가 ★내용을 ★자르나」의 ★★정본 — ⛔여기 ★사본을 ★짓지 않는다(아래 effectiveSectionPadX)
   ★★★2026-10-10 ㈄ — ★`js/frame-geometry.js` 의 ★`frameClipsPaint` 를 ★★여기로 ★합쳤다.
     ★까닭: ★그 술어와 ★`js/clip-content.js` 의 ★`clipsContent` 는 ★★같은 물음이었다
       (★프레임·에셋·그리드가 ★★「자르나」를 ★각자 ★세고 있었다) ⇒ ★★명부를 ★하나로.
     ⚠️★★뜻이 ★한 군데서 ★갈린다: ★옛 술어는 ★★계열을 ★안 봐서 ★아무 요소에도 ★`true` 를 줬고,
       ★`clipsContent` 는 ★★모르는 계열에 ★★`null` 을 준다(★「영은 ★답이 ★아니다」).
       ⇒ ★★아래 호출 자리는 ★`closest('.frame-block')` 로 ★계열이 ★★확정이라 ★★동값이다(실측).
         ★★그 전제를 ★검사가 ★잠근다 — ★tests/unit/block-full-bleed.test.mjs */
import { clipsContent } from './clip-content.js';

/* ── actorId — «누가 만든 블록인가» ────────────────────────────────────────
 * 원격 동시협업에서는 두 사람의 앱이 «같은 문서»에 블록을 만든다. 기존 ID 는
 * prefix + 7자 난수뿐이라 ⑴ 누가 만들었는지 알 수 없고 ⑵ 충돌 때 keep-both 로
 * 둘 다 남길 때 구분할 근거가 없다.
 *
 * ⇒ ID 한가운데에 actor 조각을 넣는다:  b_k3fa9_x8s2m1
 *   - prefix 는 «그대로 첫 칸»이다 → 기존 `id.split('_')[0]` 코드(editor.js·
 *     section-variation.js·template-system.js)가 손 안 대고 그대로 산다.
 *   - 옛 프로젝트의 옛 ID(`b_x8s2m1`)도 그대로 유효하다. 형식을 «강제»하지 않는다 —
 *     읽는 쪽은 actor 조각이 없어도 동작해야 한다(마이그레이션 없음).
 *
 * ★actorId 는 «설치(userData)» 단위다. 계정 단위가 아니다 — 같은 사람이 두 기기에서
 *   편집하면 그건 실제로 두 편집자이고, 충돌도 둘 사이에서 난다.
 *   (그래서 격리 인스턴스로 A·B 검증하면 actorId 도 실제로 갈린다.)
 */
const ACTOR_KEY = 'goditor.actorId';
let _actorId = null;
function getActorId() {
  if (_actorId) return _actorId;
  let v = '';
  try { v = localStorage.getItem(ACTOR_KEY) || ''; } catch (_) { v = ''; }
  if (!/^[a-z0-9]{4,8}$/.test(v)) {
    v = Math.random().toString(36).slice(2, 7);
    // localStorage 가 막혀 있으면(파일 프로토콜·시크릿) 저장은 실패해도 «이번 세션»은 굴러가야 한다.
    try { localStorage.setItem(ACTOR_KEY, v); } catch (_) {}
  }
  _actorId = v;
  return _actorId;
}

function genId(prefix) {
  return (prefix || 'b') + '_' + getActorId() + '_' + Math.random().toString(36).slice(2, 9);
}

function clearDropIndicators() {
  document.querySelectorAll('.drop-indicator').forEach(d => d.remove());
  document.querySelectorAll('.ss-drag-over').forEach(el => el.classList.remove('ss-drag-over'));
}

function clearLayerIndicators() {
  document.querySelectorAll('.layer-drop-indicator').forEach(d => d.remove());
}

function clearSectionIndicators() {
  document.querySelectorAll('.section-drop-indicator').forEach(d => d.remove());
}

function clearLayerSectionIndicators() {
  document.querySelectorAll('.layer-section-drop-indicator').forEach(d => d.remove());
}

function makeLabelItem(text = 'Label', bg = '#e8e8e8', color = '#333333', radius = 40, shape = 'pill') {
  const item = document.createElement('div');
  const isCircle = shape === 'circle';
  item.className = 'label-item' + (isCircle ? ' label-circle' : '');
  item.dataset.bg     = bg;
  item.dataset.color  = color;
  item.dataset.radius = isCircle ? '50%' : radius;
  item.dataset.shape  = shape;
  item.style.backgroundColor = bg;
  item.style.color            = color;
  item.style.borderRadius     = isCircle ? '50%' : radius + 'px';

  const span = document.createElement('span');
  span.className = 'label-item-text';
  span.contentEditable = 'false';
  span.textContent = text;

  const delBtn = document.createElement('button');
  delBtn.className = 'label-item-delete-btn';
  delBtn.textContent = '×';
  delBtn.title = '라벨 삭제';

  item.appendChild(span);
  item.appendChild(delBtn);
  return item;
}

/* 섹션 안 삽입 — 하단 Gap Block 바로 앞에 */
function insertBeforeBottomGap(section, el) {
  const inner = section.querySelector('.section-inner');
  /* ★「섹션의 끝」은 마지막 «직계» 갭이 아니다.
     합쳐 넣은 몸(.section-merged-part)이 있으면 그 «안»이 진짜 끝이라,
     직계만 보면 이음매 갭을 집어 새 블록이 «두 몸 사이»에 꽂힌다
     (합친 섹션을 고르고 텍스트/이미지를 추가하면 바로 재현). */
  let cur = inner, bottomGap = null;
  while (cur) {
    const gaps = [...cur.children].filter(c => c.classList.contains('gap-block'));
    if (gaps.length) bottomGap = gaps[gaps.length - 1];
    const lastPart = [...cur.children].reverse().find(c => c.classList.contains('section-merged-part'));
    if (!lastPart) break;
    cur = lastPart;
  }
  if (bottomGap && bottomGap.parentElement) bottomGap.parentElement.insertBefore(el, bottomGap);
  else inner.appendChild(el);
}

/* ── 「패딩 제외(full-bleed)」 공용 부품 ────────────────────────────────────
 * 섹션 좌우패딩을 무시하고 «섹션 가장자리까지» 넓히는 장치. 뿌리는 에셋블럭이고
 * (prop-asset.js 의 `dataset.usePadx` + prop-page.js 의 applyAssetFullBleed),
 * 비(非)에셋 블록은 그 패턴을 **per-block `dataset.fullBleed`** 로 미러해 왔다
 * (js/blocks/chat-block.js · canvas-block.js — 둘 다 주석에 「에셋블럭 패턴 미러」).
 *
 * ⚠️`state.pageSettings.padXExcludesAsset` 과는 «겹치지 않는다» — 그건 에셋 «전역 기본값»이고
 *   여기는 블록 하나하나의 스위치다. ⇒ 기본은 언제나 «끔»(dataset 없음 = 지금 동작 그대로).
 *
 * ★호출 규약: «먼저 제 폭을 정하고», 마지막에 applyBlockFullBleed 를 부른다.
 *   꺼져 있으면 이 함수는 «아무것도 안 만진다» — 옛 블록 무변화가 그래서 담보된다.
 *
 * ⚠️width 만 키우면 위치가 안 밀려 우측이 잘린다(`.section-inner{overflow-x:hidden}`).
 *   그래서 width + marginLeft + marginRight 를 «항상 세트로» 쓴다 — 정본 세 곳과 같은 규약. */

/** ★★★«이 자리의 ★실효 좌우 패딩(px)»만 ★답한다 — ★★«조회» 물음이다.
 *  ★우선순위: ★row 의 padX/paddingX  ⇒  ★section-inner 의 override  ⇒  ★문서 padX
 *  ★★⛔«el 이 ★그것을 ★뚫을 수 ★있나»는 ★★★안 묻는다 — ★그건 ★아래 `effectiveSectionPadX` 다.
 *
 *  ★★★왜 ★갈랐나 (2026-10-10 · ★지디 승인 · ★실측으로 ★찾았다)
 *    ★한 함수가 ★★두 물음을 ★답하고 있었다: ★㉠«패딩이 ★얼마냐» ＋ ★㉡«뚫을 수 ★있나(자르는 프레임 안이면 0)».
 *    ★★`js/panels/template-system.js` 의 ★`_tplReapplyPagePad` 는 ★★㉠ 만 ★물었는데 ★★㉡ 까지 ★받았다.
 *    ★그 파일 주석이 ★★제 가정을 ★적어 뒀다: 「section-inner 를 넘기면 ★프레임 갈래를 ★안 탄다」
 *      ⇒ ★★★`closest` 는 ★★위로 ★걷는다 ⇒ ★★서브섹션이면 ★조상에 ★프레임이 ★있어 ★★탄다 ⇒ ★가정이 ★거짓이다.
 *    ★★★2026-10-10 ② ★전에는 ★그 갈래가 ★«둥근 프레임»에서만 ★터져 ★조용했다.
 *      ⇒ ★★②가 ★기본을 ★자름으로 ★뒤집자 ★★모든 프레임에서 ★터졌다 ⇒ ★★서브섹션만 ★padX 0.
 *    ⇒ ★★★«막아둔 ★까닭이 ★죽고 ★문만 ★남는다»의 ★★거울상이다 —
 *      ★★★«문이 ★거의 ★안 열려서 ★아무도 ★몰랐고, ★②가 ★활짝 ★열었다».
 *    ★실측: ★`tests/dom/tpl-pagepad-e81` ★T2 — ★섹션 길 `100%` vs ★서브섹션 길 `calc(100% + 96px)`
 *           (★cw ★820 vs ★916 · ★차 ★96 = ★2×48)
 *  ★★⛔다시 ★합치지 ★마라 — ★★두 물음이 ★다르다. ★★합치면 ★그 사고가 ★그대로 ★돌아온다. */
function sectionPadX(el) {
  const parent = el?.parentElement;
  if (!parent) return 0;
  /* ⚠️row 의 패딩 키가 «두 가지»다: 생성 경로는 `paddingX`, 패널 슬라이더는 `padX`.
     하나만 보면 조용히 글로벌로 샌다 — assetFullBleedWidth 와 같은 함정. */
  if (parent.classList?.contains('row')) {
    const d = parent.dataset || {};
    const v = (d.padX !== undefined && d.padX !== '') ? d.padX
            : (d.paddingX !== undefined && d.paddingX !== '') ? d.paddingX : undefined;
    if (v !== undefined) return parseInt(v) || 0;
  }
  const inner = el.closest?.('.section-inner');
  if (!inner) return 0;
  const hasOverride = inner.dataset.paddingX !== '' && inner.dataset.paddingX !== undefined;
  const padX = hasOverride ? parseInt(inner.dataset.paddingX) : parseInt(state?.pageSettings?.padX);
  return padX || 0;
}

/** ★★«이 요소가 ★인라인으로 ★절대배치냐» — ★★이 물음의 ★자리 ★하나.
 *  ★★부르는 쪽 ★둘: ★아래 ★`effectiveSectionPadX`(★뚫을 패딩이 ★있나) · ★`isFlowAnchorBlock`(★기준점이 되나).
 *  ★★왜 ★인라인만 보나 — ★그 까닭의 ★정본은 ★`isFlowAnchorBlock` 의 ★머리말 ⑵ 다(★플로팅 계열이 ★인라인으로 박는다).
 *  ⛔computed ★금지 — ★검사가 ★«가짜 DOM»으로도 ★부른다(★`block-full-bleed.test.mjs` 의 ★`makeEl`). */
function isInlineAbsolute(el) {
  const pos = el?.style?.position;
  return pos === 'absolute' || pos === 'fixed';
}

/** ★★«이 프레임이 ★제 몸에 ★든 ★좌우 패딩(px)» — ★★dataset ＋ ★인라인만 ★본다. ⛔computed ★금지.
 *
 *  ★★★왜 ★`js/frame-geometry.js` 의 ★`framePadding` 을 ★안 쓰나 — ★★그 자는 ★`getComputedStyle` 을 ★쓴다.
 *    ★이 함수는 ★아래 ★`effectiveSectionPadX` 가 ★부르고, ★그 자는 ★★검사에서 ★«가짜 DOM»으로도 ★돈다
 *    (★`tests/unit/block-full-bleed.test.mjs` 의 ★`makeEl`) ⇒ ★★거기엔 ★computed 가 ★없다.
 *    ⇒ ★★둘은 ★«같은 물음, ★다른 자»다 — ⛔합치지 ★마라. ★합치면 ★그 검사가 ★조용히 ★0 을 ★받는다.
 *
 *  ★★출처가 ★★둘이다 — ★`.frame-block` 에 ★붙는 자리를 ★★전수로 ★쟀다(2026-10-11):
 *    ⑴ ★`dataset.padX`        — ★패널 슬라이더(★`js/props/prop-frame.js` ★`applyPadX`) · ★`js/blocks/modal-frameify.js`
 *    ⑵ ★인라인 ★`paddingLeft` — ★그 둘이 ★★같이 쓰고, ★데이터 칸이 ★없던 ★★옛 프레임은 ★이것만 ★있다
 *    ⛔★`dataset.paddingX` 는 ★★여기 ★해당 ★없다 — ★그건 ★텍스트 블럭의 ★속틀 ／ ★row ／ ★section-inner 쪽이다
 *      (★`js/block-factory.js` ★`applyTextOpts` 가 ★그 자리에 쓴다 · ★전수로 ★가렸다).
 *
 *  ★★★그리고 ★★`js/props/prop-frame.js` 가 ★★이 함수를 ★불러 ★표시값을 ★만든다 — ⛔제 식을 ★또 적지 ★않는다.
 *    ★옛 판엔 ★그 식(★`parseInt(ss.dataset.padX) || parseInt(ss.style.paddingLeft) || 0`)이
 *    ★★거기 ★한 벌 ★있었다 ⇒ ★★명부가 ★둘이 될 ★자리였다 ⇒ ★★파생시켰다.
 *    ⚠️★그 옛 식은 ★`||` 라 ★★«0»을 ★«없음»으로 ★읽는다. ★아래는 ★★그러지 ★않는다.
 *      ★★그래도 ★답이 ★갈리지 ★않는다 — ★★쓰는 자 ★둘이 ★★dataset 과 ★인라인을 ★★한 줄에 ★같이 쓴다
 *      (★실측: ★`prop-frame.js` ★`applyPadX` · ★`modal-frameify.js` ★그 두 줄) ⇒ ★둘이 ★갈릴 ★판이 ★없다.
 *      ⇒ ★★그 «갈릴 판이 없다»를 ★잠그는 자 = ★`tests/unit/block-full-bleed.test.mjs` 의 ★P2 칸. */
function framePadXData(frameEl) {
  if (!frameEl) return 0;
  const v = frameEl.dataset?.padX;
  if (v !== undefined && v !== '') return Math.max(0, parseInt(v) || 0);
  return Math.max(0, parseInt(frameEl.style?.paddingLeft) || 0);
}

/** ★el 이 ★«뚫고 나가야 할» 좌우 패딩(px). ★★뚫을 수 ★없는 자리면 ★0 — ★★«full-bleed» 물음이다.
 *  ★★= ★`sectionPadX(el)` ＋ ★★앞에 ★«자르는 프레임 안이면 0» ★한 갈래.
 *  ★★부르는 쪽 ★넷이 ★★이 물음을 ★묻는다(★소스에 적혀 있다):
 *    ★`applyBlockFullBleed`(아래) · ★`prop-page.js assetFullBleedWidth`
 *    ★`prop-banner02.js _bn2CanFullBleed` · ★`prop-frame.js canFullBleed`
 *  ★★⛔«이 섹션의 ★패딩이 ★얼마냐»를 ★묻는 쪽은 ★★`sectionPadX` 를 ★불러라(★위 머리말의 ★그 까닭). */
function effectiveSectionPadX(el) {
  const parent = el?.parentElement;
  if (!parent) return 0;
  /* ★프레임 «안»에서 뚫을 수 있나 — 그 프레임이 «실제로 자르는지»로 가른다.
     ~~[2026-09-10] `if (parent.closest('.frame-block')) return 0;` — 무조건 못 뚫었다.~~
     까닭은 「.frame-block{overflow:hidden} 이라 넘친 폭이 잘리기만 한다」였는데,
     ★2026-09-28 현빈 지시로 그 overflow 를 visible 로 풀었다(css/editor-blocks.css).
       ⇒ 막아둔 «까닭»이 죽었는데 «문»만 남아 있었다. 그래서 까닭을 코드가 확인하게 바꾼다.
     ★지금 자르는 것은 «모서리를 둥글린 프레임»뿐이다 — 같은 CSS 파일의
       `.frame-block[data-radius]:not([data-radius="0"]) { overflow: hidden }` 한 줄이 정본이고,
       아래 판정은 그 선택자를 «그대로» 옮긴 것이다(두 곳이 갈리면 여기부터 의심하라).
     ⛔computed 스타일로 재지 않는다 — 이 함수는 검사에서 «가짜 DOM»으로도 불린다
       (tests/unit/block-full-bleed.test.mjs 의 makeEl). dataset 은 거기서도 산다. */
  /* ★★2026-10-09 — ★「이 프레임이 ★정말 자르나」의 ★판정을 ★★공용 한 자리로 옮겼다
       (★★2026-10-10 ㈄ 부터 ★`js/clip-content.js` ★`clipsContent`). ⛔여기 ★제 벌을 ★두면 ★명부가 ★둘이다 —
       ★실제로 ★갈려 있었다: ★여기는 ★`radius` 만 봤고 ★「내용 자르기」(`data-clip-content`)는
       ★★안 봤다 ⇒ ★자르는 프레임인데 ★뚫을 수 있다고 ★답했다(★그 판에서 ★뚫은 폭은 ★잘린다).
     ★★위 옛 주석의 「★지금 자르는 것은 ★둥근 프레임뿐」은 ★그래서 ★★낡았다 — ★★둘이다. */
  const _fr = parent.closest?.('.frame-block');
  /* ★★★2026-10-11 ★현빈 ① — ★★이 줄은 ★예전에 ★`return 0` 이었다. ⛔그 줄을 ★지우지 ★않고 ★이어 쓴다(★역사다):
       ⚰️★옛 줄: ★`if (_fr && clipsContent(_fr) === true) return 0;`
       ★★그때의 ★뜻 = 「★자르는 프레임 ★안에서는 ★뚫어 ★봐야 ★잘린다 ⇒ ★★뚫을 게 ★없다」.
       ★★그런데 ★그 뜻이 ★★«섹션 패딩을 ★뚫는 것»에만 ★참이었다 — ★★«그 프레임 ★자신의 ★패딩»은
         ★★그 프레임이 ★자르는 ★상자 ★안에 ★있어 ★★안 잘린다.
       ★★★현빈 2026-10-11: 「★프레임블럭의 ★패딩제외기능 ★원래됐잖아? ★★내용자르기도 ★원됐잖아? ★뭐가 문제야?」
         ★실측(★`FULLBLEED.md` · ★판 `5954e4f4`): ★«섹션 직속»은 ★된다 ／ ★★«프레임 안»은 ★안 된다.
         ★까닭 = ★이 줄의 ★0 ＋ ★`CLIP_DEFAULTS.frame === true`(★현빈 `1009t3-②` 로 ★기본이 ★자름이 됐다)
         ⇒ ★★사용자가 ★아무것도 ★안 켜도 ★★칸이 ★조용히 ★사라졌다.
       ⇒ ★★★지디가 ★고른 ★갈래 ㉡ = ★★«섹션 패딩»이 ★아니라 ★★«그 프레임의 ★패딩»을 ★뚫게 ★한다.
       ★★잠그는 자: ★`tests/dom/frame-inner-fullbleed.dom.spec.js` — ★FI1(★양성) ＋ ★FI3(★자르기가 ★산다).
       ⛔`=== true` 는 ★그대로 ★둔다 — ★`null`(★모르는 계열)을 ★참으로 ★안 읽겠다는 ★뜻이다. */
  if (_fr && clipsContent(_fr) === true) {
    /* ★★★그런데 ★★«절대배치 자식»에는 ★뚫을 것이 ★없다 — ★★내 ★음성대조가 ★잡았다(★2026-10-11 · ★FI3).
         ★실측(`.gd-work/.../run-logs/fi-box.log`): ★자유 프레임(★`dataset.freeLayout="true"`)의 ★자식은
           ★`position:absolute` 다 ⇒ ★★그 자식의 ★담는 상자는 ★★그 프레임의 ★★«패딩 ★상자»다(★content 상자가 ★아니다)
           ⇒ ★★`width:100%` 가 ★★이미 ★끝까지 ★닿는다(★잰 값: ★겉 clientWidth ★860 · ★속 100% = ★860).
         ⇒ ★★거기서 ★`calc(100% + 2×40)` 을 ★쓰면 ★★940 이 되어 ★★양쪽으로 ★40 씩 ★★넘고 ★잘린다
           (★잰 값: ★겉 상자 ★420..1280 ／ ★뚫은 뒤 ★380..1320).
       ⇒ ★★그래서 ★★«흐름 자식»일 때만 ★뚫는다 — ★스택 프레임의 ★자식에는 ★CSS 패딩이 ★먹는다
         (★그 사실의 ★정본은 ★`js/frame-geometry.js` ★`framePadding` 의 ★머리말: 「★자유 프레임 자식엔 ★CSS padding 이
          ★안 먹는다 … ★스택 프레임엔 ★필요 없다(★CSS 가 먹는다)」). */
    if (isInlineAbsolute(el)) return 0;
    return framePadXData(_fr);
  }
  return sectionPadX(el);
}

/** dataset.fullBleed 가 'true' 일 때만 폭·마진 세트를 «덮어쓴다». 적용한 padX 를 돌려준다(껐으면 0). */
function applyBlockFullBleed(el) {
  if (!el?.style || el.dataset?.fullBleed !== 'true') return 0;   // 기본 «끔» — 무접촉
  const padX = effectiveSectionPadX(el);
  if (padX <= 0) return 0;
  el.style.marginLeft  = -padX + 'px';
  el.style.marginRight = -padX + 'px';
  el.style.width       = `calc(100% + ${padX * 2}px)`;
  /* ⚠️maxWidth 가 남아 있으면 폭이 «안 넓어진다» — 프레임은 inline `max-width:100%` 를 달고 태어난다.
     ★그래서 «원래 값을 적어 두고» 푼다. 실측(2026-09-10, 프레임): 적어 두지 않으면 끌 때
       max-width:none 이 남아 860px 가 안 잘리고 «섹션 밖으로 삐져나간 채» 굳었다.
     ⛔이미 적어 둔 게 있으면 덮어쓰지 마라 — padX 가 바뀔 때마다 이 함수가 다시 불린다. */
  if (el.dataset.fbMaxW === undefined) el.dataset.fbMaxW = el.style.maxWidth || '';
  el.style.maxWidth = 'none';
  return padX;
}

/** 패딩제외를 끌 때 «그 흔적만» 지운다. 자연 폭 복원은 호출부 몫(제 규약을 아는 건 호출부다). */
function clearBlockFullBleed(el) {
  if (!el?.style) return;
  el.style.marginLeft  = '';
  el.style.marginRight = '';
  if (!el.style.width || el.style.width.includes('calc')) el.style.width = '';
  if (el.dataset?.fbMaxW !== undefined) {         // 켤 때 적어 둔 «원래» maxWidth 로 되돌린다
    el.style.maxWidth = el.dataset.fbMaxW;
    delete el.dataset.fbMaxW;
  }
}

/* ── 삽입 «기준점» 판정 — ★명부가 아니라 «성질»로 집는다 ───────────────────
 *
 * ★왜 명부를 버렸나 (2026-09-10, 현빈 「모달블럭 추가하고 g 를 누르면 안 된다」)
 *   여기에는 `.text-block.selected, .asset-block.selected, …` 를 «손으로 적은» 목록이
 *   두 벌(프레임 안 / 섹션 레벨) 있었다. 새 블록이 생길 때마다 두 곳에 같이 적어야 했고,
 *   실제로 셋이 빠져 있었다. 실측(앱 9396, 25종 전수, 「뒤에 표지 블록 하나 더」 픽스처):
 *     modal · mockup · joker → 갭이 «바로 아래»가 아니라 «섹션 맨 끝»에 붙었다.
 *     (블록이 하나뿐인 픽스처로 재면 셋 다 «통과»로 보인다 — 그 자리에선 「바로 아래」와
 *      「맨 끝」이 같은 자리라서다. 양성대조 없는 통과였다.)
 *
 * ★성질 둘 — 이 둘이면 명부가 필요 없다
 *   ⑴ 클래스에 `*-block` 이 하나라도 있다.
 *   ⑵ «흐름»이다 = 인라인 position:absolute/fixed 가 아니다.
 *      플로팅 계열(스티커·그라데이션·확대블럭)은 전부 `sec.appendChild` 로 섹션 직속에 놓이고
 *      `block.style.cssText = 'position:absolute;…'` 를 «인라인으로» 박는다.
 *      (어노테이션은 CSS 로 absolute 지만 역시 섹션 직속이라 .section-inner 요구로 걸러진다.)
 *   ⛔플로팅을 기준점으로 삼으면 새 블록이 «섹션 직속»으로 끼어들어 section-inner 흐름에서
 *     빠진다(화면에서 사라진 것처럼 보인다). 그게 옛 주석이 지키려던 것 — 그 뜻은 그대로다.
 *
 * ⚠️컨테이너 셋(section/frame/shape)은 위쪽 분기에서 «이미 따로» 처리된다 — 여기서 뺀다.
 *   이건 「무엇이 새 블록의 앞자리인가」 판정이지 「무엇을 선택된 것으로 볼 것인가」가 아니다.
 *   ⛔globals.js 의 BLOCK_DELEGATE_SEL 과 합치지 마라 — 역할이 다르다. */
const _ANCHOR_EXCLUDE_CLASSES = ['section-block', 'frame-block', 'shape-block'];

function isFlowAnchorBlock(el) {
  if (!el || el.nodeType !== 1 || !el.classList) return false;
  for (const c of _ANCHOR_EXCLUDE_CLASSES) if (el.classList.contains(c)) return false;
  if (isInlineAbsolute(el)) return false;   // 플로팅 계열 — ★★판정은 ★위 `isInlineAbsolute` ★한 자리다(2026-10-11 에 ★뽑았다)
  for (const c of el.classList) if (c.endsWith('-block')) return true;
  return false;
}

/** root 안에서 «기준점이 될 수 있는» 첫 선택 블록. scoped=true 면 .section-inner 안만 본다. */
function findFlowAnchorSelected(root, scoped) {
  if (!root?.querySelectorAll) return null;
  for (const el of root.querySelectorAll(scoped ? '.section-inner .selected' : '.selected')) {
    if (isFlowAnchorBlock(el)) return el;
  }
  return null;
}

/* 선택된 블록 바로 다음에 삽입, 없으면 하단 Gap 앞에 */
/* ★자유배치 프레임 «안»의 흐름 row 를 좌표 단위로 세운다 (B2, 현빈 2026-10-01 「프레임 안에서는 되어야 되지 않나?」).
 * 무엇이 문제였나: 패널로 넣은 컴포넌트(그리드·로렐·카드·스텝 등 공용 삽입 경로 15종)는 insertAfterSelected 가
 *   자유배치 프레임에 «absolute 아닌 .row» 째 붙였다. 드래그 문(block-drag.js 「프레임 자유배치」 갈래)은
 *   position!=='absolute' 이면 빠지므로 좌표 이동이 «아예» 안 됐다. (끌어다 넣은 것은 드롭이 absolute 로 바꿔서 됐다.)
 * 무엇을 하나: row «째» absolute 로 세운다 — 목업이 이미 쓰는 꼴(absolute row = 드래그 대상, block-drag.js isMockup 갈래)이다.
 *   ⛔블럭을 row 에서 꺼내지 않는다: 삽입 입구들이 돌려받은 {row, block} 의 row 를 뒤에서 쓰기 때문이다.
 *   ⛔draggable 을 끈다 — 남으면 HTML5 드래그가 mousemove 를 가로챈다(09-30 줌 실측: 첫 틱 뒤 끊김).
 * mode: 'stack' = 있는 absolute 자식들 밑으로 쌓는다(새로 넣을 때, 끌어넣기와 같은 규칙: x 0 · 바닥+16)
 *       'inplace' = 지금 화면 자리 그대로(이미 흐름으로 들어가 있던 옛 것을 처음 끌 때). 부르는 곳 둘이 이 한 함수를 쓴다. */
function settleRowInFreeFrame(frame, row, mode = 'stack') {
  if (!frame || !row || row.style.position === 'absolute') return false;
  if (frame.dataset?.freeLayout !== 'true' || row.parentElement !== frame) return false;
  // 받는 것 = .row 또는 정본 표(panel-dispatch hasPanelForBlock)의 블럭. 글자 래퍼·도형 래퍼는 제 갈래가 따로 세운다.
  if (!(row.classList?.contains('row') || window.hasPanelForBlock?.(row))) return false;
  /* ★F3(2026-10-03) — 폭 100% 그리드는 «안의 내용»도 프레임 폭이라 아래 w 가 곧 프레임 폭이 됐다 → T-088 클램프 x 범위 [0,0]
     (49c74728 의 시험은 픽스처가 400px 라 못 잡았다). 재기 «전»에 그리드 폭 모델로 프레임보다 작은 폭을 준다.
     규칙·까닭은 grid-block.js fitGridWidthToFreeFrame 머리말 한 곳. ⛔여기서 style.width 를 따로 박지 않는다. */
  const _units = row.classList.contains('row') ? [...row.children] : [row];
  _units.forEach(u => window.fitGridWidthToFreeFrame?.(u, frame));
  const fr = frame.getBoundingClientRect();
  const k = frame.offsetWidth ? (fr.width / frame.offsetWidth) || 1 : 1;   // 캔버스 줌
  /* ★폭·x 는 row 상자가 아니라 «안의 내용» 기준. row 는 블록 요소라 프레임 폭을 다 먹는다 —
     그 폭 그대로 세우면 좌우로 움직일 자리가 0 이 된다(실측: 860 프레임에서 x 이동 0). */
  const kids = row.classList.contains('row') ? [...row.children].filter(c => !c.classList.contains('drop-indicator')) : [];
  const rr = row.getBoundingClientRect();
  const box = kids.length
    ? kids.map(c => c.getBoundingClientRect()).reduce((a, r) => ({ l: Math.min(a.l, r.left), r: Math.max(a.r, r.right) }), { l: Infinity, r: -Infinity })
    : { l: rr.left, r: rr.right };
  const w = Math.round((box.r - box.l) / k);
  let left = 0, top = 0;
  if (mode === 'inplace') {
    left = Math.round((box.l - fr.left) / k - (frame.clientLeft || 0));
    top  = Math.round((rr.top - fr.top) / k - (frame.clientTop  || 0));
  } else {
    const bottom = [...frame.children].filter(c => c !== row && c.style.position === 'absolute')
      .reduce((m, c) => Math.max(m, (parseInt(c.style.top, 10) || 0) + (c.offsetHeight || 0)), 0);
    top = bottom > 0 ? bottom + 16 : 0;
  }
  row.style.position = 'absolute';
  row.style.left = left + 'px';
  row.style.top  = top + 'px';
  /* ★D1(2026-10-03) — 폭 모델을 가진 그리드의 row 에는 폭을 «안» 적는다. 적으면 그 px 가 «두 번째 명부»가 되어
     키를 지우거나 다른 프레임에 맞춰도 row 가 옛 폭을 쥔다(실측: 섹션에 나와도 611 · frB 에서 그리드 320 / row 611 → 다시 수직만).
     ⚠️폭을 비우면 안 된다 — CSS `.row{width:100%}`(editor-layout.css) 라 프레임 폭이 된다(실측 400). 그래서 «값이 아닌» fit-content 로
     안의 px 그리드 폭을 따라가게 한다. 규칙은 grid-block.js _gridRowFollows 한 곳. */
  const _modelSized = _units.some(u => u.classList?.contains('grid-block') && window.getGridWidth?.(u) != null);
  if (_modelSized) row.style.width = 'fit-content';
  else if (w && (!row.style.width || row.style.width === '100%')) row.style.width = w + 'px';
  row.setAttribute('draggable', 'false');
  return true;
}

/* ★F1 (2026-10-03, 지디 결정) — 「프레임 «자체»가 오브젝트로 골라져 있나」.
 *   키보드 입구(⌘V·g·⌘D)가 이 판정으로 «다음 형제»를 가른다. 패널 삽입은 이걸 안 부른다(09-23 「안에 넣는다」 그대로 —
 *   frame-accepts-component-blocks F1 이 잠근다). ⛔t(addTextBlock)는 이 규칙에 넣지 않는다.
 *   조건 셋 = 프레임에 .selected · 그 안에 «흐름 앵커»(선택된 자식 블럭)가 없다 · 그 안에 도형 선택이 없다.
 *   돌려주는 것 = 그 프레임(가장 안쪽의 골라진 것) 또는 null. 도형 래퍼·글자 래퍼·배너 외곽은 «프레임»이 아니라 null 쪽이다. */
function frameSelectedAsObject(section) {
  const ok = (f) => f && f.classList?.contains('frame-block') && f.classList.contains('selected')
    && !isShapeFrame(f) && !f.dataset?.textFrame && !f.dataset?.bannerPreset
    && f.dataset?.group !== 'true'                                  // 그룹(⌘G)은 F1 범위 밖 — 예전대로 «안»
    && (!section || f.closest('.section-block') === section);
  const act = window._activeFrame;
  const cands = [...document.querySelectorAll('.frame-block.selected')].filter(ok);
  const frame = (act && cands.includes(act)) ? act : cands[cands.length - 1];
  if (!frame) return null;
  /* 자식을 골라 둔 것 = 안쪽. ★흐름 앵커(isFlowAnchorBlock)로 세지 않는다 — 그건 절대배치를 제외해서, 자유 프레임의 절대배치 자식(그리드·에셋)을
   *   골라도 «프레임을 골랐다»로 읽혔다(적대QA). 프레임에 .selected 가 남은 채 «자손이 하나라도» 골라져 있으면 오브젝트 선택이 아니다. */
  if (frame.querySelector('.selected')) return null;
  if (window._enteredFrame === frame) return null;   // ★여백 더블클릭으로 «들어간» 프레임 = 오브젝트 선택이 아니다(아래 R1 · 현빈 2026-10-08)
  return frame;
}

/* ★프레임 더블클릭 = «한 겹 내려간다»(R1 · 현빈 2026-10-08 · 지디 발주 ORDER-frame-dblclick-focus 「최종 확정」).
 *   현빈: 「1번클릭은 프레임블럭위에 마치 오버레이된것 처럼 내부수정이 안되게 되는거고, 두번클릭하면 편집모드로 들어가지는거지」
 *        「프레임블럭 내부에 자식블럭위에서 더블클릭하면 그걸 선택할수 있는거야. (내부진입 및 자식 선택을 하나로)」
 *   «오버레이»는 이미 있다 — css/editor-blocks.css :145(고르지 않은 프레임의 자손은 클릭을 못 받는다). 두 번째 클릭이 자식을 고르는 것(R2)도 이미 돈다.
 *   빠져 있던 것 하나: 그 더블클릭이 자식의 «편집» 처리기까지 내려가 «진입 ＋ 선택»이 아니라 «편집»이 됐다(실측 OV-c).
 *   ⇒ 제스처 «시작»(첫 mousedown) 때 포인터 밑 가장 안쪽 프레임이 «아직 안 들어간» 상태였으면, 그 제스처의 dblclick 을 capture 에서 멈춘다.
 *     자식 위였으면 클릭이 이미 그 자식을 골랐다(= 진입 ＋ 선택) · 여백이었으면 그 프레임을 «들어간 프레임»으로 적는다(삽입이 안으로).
 *     이미 들어간 프레임(자손이 골라져 있거나 여백으로 들어감)에서의 더블클릭은 그대로 흘린다 = 자식 처리기가 편집한다(R3).
 *   ★번지는 범위: 판정 대상은 «진짜 프레임»(도형 래퍼·글자 래퍼·배너 외곽·그룹 제외) 안의 더블클릭뿐 — 프레임 밖 블럭은 이 처리기를 안 탄다
 *     (잠금: tests/dom/dblclick-outside-frame-unchanged · 처리기 18 종 정의 자리 수는 그 머리말).
 *   나가기(R4)는 안 바꾼다 — deselectAll 이 «들어간 프레임» 표시를 같이 지운다(editor.js). */
function _isEntryFrame(f) {
  return !!f && f.classList?.contains('frame-block') && !f.dataset?.textFrame && !f.dataset?.bannerPreset
    && f.dataset?.group !== 'true' && !isShapeFrame(f);
}
function _innermostEntryFrame(node) {
  for (let f = node?.closest?.('.frame-block'); f; f = f.parentElement?.closest('.frame-block')) if (_isEntryFrame(f)) return f;
  return null;
}
let _dblGesture = null;   // { frame, entered } — 제스처 첫 mousedown 때 찍는다
if (typeof document !== 'undefined') {
  document.addEventListener('mousedown', (e) => {
    if (e.button !== 0 || e.detail !== 1) return;
    const f = _innermostEntryFrame(e.target);
    _dblGesture = f ? { frame: f, entered: !!f.querySelector('.selected') || window._enteredFrame === f } : null;
  }, true);
  document.addEventListener('dblclick', (e) => {
    const g = _dblGesture;
    if (!g || g.entered || !g.frame.isConnected || !g.frame.contains(e.target)) return;
    e.stopPropagation();   // 자식의 편집 처리기로 안 내려간다 — 이 더블클릭은 «한 겹 내려가기»다
    if (!g.frame.querySelector('.selected')) window._enteredFrame = g.frame;   // 여백이었다 — 그 프레임 «안»이 삽입 자리
    _dblGesture = null;
  }, true);
}

/* 고른 프레임의 «다음 형제» 자리에 el 을 놓는다. 부모가 자유 프레임이면 좌표를 세운다(settleRowInFreeFrame 은 부르기만 한다). */
function _placeAfterFrameAsSibling(frame, el) {
  const unit = frame.parentElement?.classList.contains('row') ? frame.parentElement : frame;
  unit.after(el);
  const parent = unit.parentElement;
  if (parent?.dataset?.freeLayout === 'true') window.settleRowInFreeFrame?.(parent, el, 'stack');
}

/* 키보드 입구용 삽입 — 프레임을 «오브젝트로» 골라 둔 상태면 안이 아니라 «다음 형제»로, 아니면 insertAfterSelected 그대로.
 *   ⛔insertAfterSelected 자체는 건드리지 않는다(패널 삽입 31곳이 쓰고, 「안에 넣는다」를 frame-accepts F1 이 잠근다 —
 *     본문 구간을 읽는 단위 시험 3종도 그 머리말에 걸려 있다). 키보드 입구는 {asSibling} 대신 이 한 문을 부른다. */
/* ★H11(2026-10-05 · 지디 재지시) — 넣는 «깊이»의 한 자리: 「이 프레임 «안»에 넣나?」
 *   거짓 = 프레임을 «오브젝트로» 골라 둔 상태(한 번 클릭 · 자손 선택 0) — frameSelectedAsObject 와 같은 판정. ⒜: 단 자식 요소가 있을 때만(아래 정의).
 *   참   = 들어간 상태(프레임 클릭 → 자식 클릭 = 자식이 골라짐) · 또는 프레임이 안 골라짐(활성만).
 *   부르는 곳: 아래 insertAfterSelected(활성 프레임 갈래 · 고른 프레임 갈래) · block-factory.js _insFrameTarget(툴바 add* 의 프레임 갈래)
 *   · block-factory.js addShapeBlock 의 «고른 프레임» 갈래. ⛔부르는 곳마다 판정을 다시 쓰지 않는다 — 여기 하나. */
/* ★H11 ⒜(2026-10-05 지디 승인) — 정의: 삽입은 «선택 깊이»를 따른다. drill-in 할 대상이 없는 프레임(자식 요소 0)은 그 자체가 안쪽 상태다 ⇒ 안에 넣는다.
 *   («예외»가 아니라 정의다 — 오브젝트 선택 «밖»은 들어갈 자식이 있을 때만 뜻이 있다.)
 *   까닭 둘: 09-23 「그리드가 프레임에 안 들어간다」(현빈) — 빈 프레임을 툴바로 못 채우면 이 요구가 깨진다(「Frame 추가」 직후가 바로 그 자리).
 *            10-05 「한 번 클릭 후에는 프레임 밖에 삽입되어야지」(현빈) — 자식 있는 프레임을 한 번 클릭하면 밖, 그대로.
 *   «자식 요소» = 요소 노드만(글자·주석 노드는 안 센다) · 끌기 중 잠깐 서는 .drop-indicator 는 안 센다. 갭·빈 글자 프레임은 «요소»라 센다
 *   (경계 행 = tests/dom/h11-toolbar-depth.dom.spec.js E-*). */
function frameHasDrillTarget(frame) {
  return [...frame.children].some(c => !c.classList.contains('drop-indicator'));
}
function frameTakesInsert(frame) {
  if (!frame) return false;
  if (!frameHasDrillTarget(frame)) return true;   // 들어갈 자식이 없다 = 이미 안쪽 상태
  return frameSelectedAsObject(frame.closest('.section-block')) !== frame;
}
if (typeof window !== 'undefined') window.frameTakesInsert = frameTakesInsert;

function insertAfterSelectedAsSibling(section, el) {
  const picked = frameSelectedAsObject(section);
  if (picked) { _placeAfterFrameAsSibling(picked, el); return; }
  insertAfterSelected(section, el);
}

function insertAfterSelected(section, el) {
  // 활성 서브섹션이 있으면 그 안에 삽입 (selected 여부 관계없이)
  // ★도형 래퍼는 그냥 도형 — 활성이어도 그 «안»은 삽입 대상이 아니다(0918 A안, shape-frame.js SSOT).
  //   도형 래퍼면 한 단계 위 실제 프레임으로, 없으면 null → 아래 섹션 레벨 분기.
  const activeSS = resolveInsertFrame(window._activeFrame);
  /* ★H11 — 프레임을 «오브젝트로» 골랐으면(한 번 클릭) 안이 아니라 «다음 형제»(F1 키보드 입구와 같은 자리 _placeAfterFrameAsSibling). */
  if (activeSS && activeSS.closest('.section-block') === section && !activeSS.dataset?.textFrame && !frameTakesInsert(activeSS)) {
    _placeAfterFrameAsSibling(activeSS, el);
    return;
  }
  // text-frame은 단순 wrapper — 삽입 대상이 아님 (_restoreParentFrameSelected 안전망)
  // banner-preset 외곽은 컴포넌트 단위 — 안에 직접 자식 추가 받지 않음 (drill-in으로 inner 활성화 시에만)
  if (activeSS && !activeSS.dataset?.textFrame && !activeSS.dataset?.bannerPreset && activeSS.closest('.section-block') === section) {
    // shape-block이 선택된 경우: shape frame은 최소 단위 — 내부 삽입 금지, frame 뒤에 삽입
    const selShape = activeSS.querySelector('.shape-block.selected')
      || [...activeSS.querySelectorAll('.frame-block.selected')].find(isShapeFrame);
    if (selShape) {
      // 선택 도형의 «래퍼(또는 row)» 바로 뒤 — 활성 프레임 밖으로 튀지 않는다
      anchorUnitOf(selShape).after(el);
      return;
    }

    const ssInner = activeSS;
    // ssInner 는 이미 .section-inner «안»이라 scoped 불필요 (성질 판정만으로 충분)
    const sel = findFlowAnchorSelected(ssInner, false);
    if (sel) {
      const ref = sel.classList.contains('gap-block') ? sel : (sel.closest('.frame-block[data-text-frame]') || sel.closest('.row') || sel);
      ref.after(el);
      window.followHostFrameHAlign?.(el);   // ★E135 — 템플릿 넣기 등 이 문으로 프레임 안에 든 것도 정렬을 따른다
      window.settleRowInFreeFrame?.(ssInner, el, 'stack');   // B2 — 자유배치 프레임이면 좌표 단위로
    } else {
      /* ★2026-09-23 — 「프레임 «자체»가 오브젝트로 선택된 상태」도 프레임 «안»이다.
       * ★2026-10-05 H11 — 09-23 결정 = 패널 삽입은 «안»(현빈 「그리드가 프레임에 안 들어간다」) → 10-05 재지시로 «밖»(현빈 「한 번 클릭 후에는 프레임 밖에 삽입되어야지」)
       *   · 까닭 = drill-in(프레임 클릭 → 자식 클릭)이 09-23 의 요구(안에 넣기)를 대신 채운다. 판정은 위 frameTakesInsert 한 자리 —
       *   이 갈래는 이제 «들어간 상태»(자식이 골라짐)에서만 온다(오브젝트 선택은 함수 머리에서 다음 형제로 빠진다). 아래 옛 글은 기록으로 둔다.
       *   옛 판은 여기서 `ssInner.closest('.row').after(el)` 로 «뒤»에 붙였다. 그런데
       *   ⛔프레임 속성 패널 맨 아랫줄이 이렇게 «약속»한다:
       *     「Frame 클릭 후 플로팅 패널에서 블록을 추가하면 이 안으로 들어갑니다.」
       *   현빈 실기 제보(userlens): 「그리드 블럭이 프레임 블럭에 안 들어간다」. 실측 3/3 재현이었다.
       *   ★그리고 이건 그리드만의 병이 «아니었다» — 텍스트·에셋·스티커는 자기 프레임 분기를
       *     따로 갖고 있어 «안»에 들어가고(block-factory.js 등), 공용 경로를 타는
       *     컴포넌트 블럭 15종(banner·banner02·canvas·chat·comparison·grid·iconify·infocard·
       *     innercard·laurel·mockup·modal·qa·step·vector)만 «밖»으로 나갔다.
       *   ⇒ 화면의 약속 · 텍스트 경로 · 공용 경로 «셋»이 서로 다른 말을 하고 있었다. 하나로 맞춘다.
       *   ⛔15곳에 분기를 베끼지 «않는다» — 고칠 자리는 여기 한 곳이다.
       *   ⛔도형 래퍼는 이 줄에 닿지 않는다: 위의 `selShape` 분기가 먼저 return 하고,
       *     `resolveInsertFrame` 이 래퍼를 한 단계 위로 올린다(0918 A안 그대로 산다).
       *   지키는 검사: tests/dom/frame-accepts-component-blocks.dom.spec.js F1(안에 들어간다)
       *                ＋ F2·shape-frame-isolation I1~I3(도형 래퍼는 여전히 뒤 — 짝 검사) */
      ssInner.appendChild(el);
      window.followHostFrameHAlign?.(el);   // ★E135
      window.settleRowInFreeFrame?.(ssInner, el, 'stack');   // B2
    }
    return;
  }

  const inner = section.querySelector('.section-inner');

  /* ★«두 자리»가 같은 술어를 봐야 한다 — insert-anchor-property G3c 가 잠근 규약이다.
   *   한 곳만 고치면 「섹션에선 되는데 프레임 안에서만 안 된다」가 되고 훨씬 찾기 어렵다.
   *   위(활성 프레임 분기)를 「안에 넣는다」로 바꿨으므로 여기도 같이 바꾼다.
   *   ⛔단 도형 래퍼는 «여전히 뒤»다(0918 A안) — 그래서 isShapeFrame 가드를 «여기»에 둔다.
   *     위 분기는 resolveInsertFrame 이 이미 걸러 주지만, 이 길은 _activeFrame 이 없을 때 오므로
   *     걸러 주는 사람이 없다. */
  const selSS = document.querySelector('.frame-block.selected');
  if (selSS && selSS.closest('.section-block') === section) {
    if (isShapeFrame(selSS) || selSS.dataset?.textFrame || selSS.dataset?.bannerPreset) {
      const ssRow = selSS.closest('.row') || selSS;
      ssRow.after(el);                 // 도형 래퍼·글자 래퍼·배너 외곽 = 최소 단위, 안에 안 넣는다
    } else if (!frameTakesInsert(selSS)) {
      /* ★H11 — 10-05 재지시: 한 번 클릭(오브젝트 선택)은 «밖»(다음 형제). 아래 «안» 줄은 09-23 결정의 기록으로 남는다(들어간 상태에서만 탄다). */
      _placeAfterFrameAsSibling(selSS, el);
    } else {
      selSS.appendChild(el);           // 진짜 프레임 = 화면이 약속한 대로 «안»에
      window.settleRowInFreeFrame?.(selSS, el, 'stack');     // B2
    }
    return;
  }

  // row-active 우선: 그리드/flex row가 선택된 경우 그 row 뒤에 삽입
  const activeRow = document.querySelector('.row.row-active');
  if (activeRow && activeRow.closest('.section-block') === section) {
    activeRow.after(el);
    return;
  }

  // shape-block은 최소 단위 — 내부 삽입 금지, 감싼 frame 뒤에 삽입
  const selShape = document.querySelector('.shape-block.selected');
  if (selShape && selShape.closest('.section-block') === section) {
    anchorUnitOf(selShape).after(el);
    return;
  }

  // ★문서 전체에서 «첫» 후보를 집고 나서 섹션을 대조한다 — 옛 판(document.querySelector)과 같은 순서.
  //   scoped=true 로 .section-inner 안만 본다 ⇒ 섹션 직속 플로팅(어노테이션 등)은 애초에 안 걸린다.
  const sel = findFlowAnchorSelected(document, true);

  if (sel && sel.closest('.section-block') === section) {
    const isGap = sel.classList.contains('gap-block');
    const ref = isGap ? sel : (sel.closest('.frame-block[data-text-frame]') || sel.closest('.row') || sel);
    ref.after(el);
  } else {
    insertBeforeBottomGap(section, el);
  }
}

/* 섹션·블록을 안 고른 채 «블럭 추가»를 눌렀을 때의 «한 벌» 경고.
   ★흔들림(fp-shake)은 «곁들이»고 토스트가 «본문»이다 — 순서를 뒤집지 마라.
     옛 판은 #floating-panel 을 가드 없이 역참조해서, 그 요소가 없는 화면(미리보기로
     감춘 게 아니라 아예 없는 경우·초기화 도중)에서는 여기서 TypeError 가 나
     showToast 까지 «못 가고» 경고가 통째로 사라졌다 = 「경고 없이 아무 일도 안 한다」.
     흔들 게 없으면 흔들지 않고 «말은 한다». (2026-09-21 수리공 유닛 ①) */
function showNoSelectionHint() {
  const fp = document.getElementById('floating-panel');
  if (fp) {
    fp.classList.add('fp-shake');
    setTimeout(() => fp.classList.remove('fp-shake'), 400);
  }
  /* ★2026-09-23 — 「선택하세요」는 «선택할 것이 있을 때만» 말이 된다.
     현빈 실기 제보(userlens): 새 「New Design」 프로젝트는 캔버스가 «텅 비어» 있다(섹션 0개).
     거기서 블럭 추가를 누르면 「섹션 또는 블록을 먼저 선택하세요」가 떴는데
     ⛔«선택할 섹션이 하나도 없었다» — 안내가 «할 수 없는 일»을 시키고 있었다.
     그리고 그게 새 프로젝트의 «첫 화면»이다.
     지키는 검사: tests/dom/no-selection-hint.dom.spec.js N1(갈라진다)·N2(빈 판은 추가를 가리킨다)
                  ＋ N3 짝 검사(섹션이 있으면 여전히 「선택」을 가리킨다). */
  const 섹션있나 = !!document.querySelector('.section-block');
  showToast(섹션있나
    ? '⚠️ 섹션 또는 블록을 먼저 선택하세요'
    : '⚠️ 먼저 ＋ 새 섹션을 추가하세요');
}

function showToast(msg) {
  let t = document.getElementById('editor-toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'editor-toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 2000);
}

/* 섹션에 «직접» 텍스트를 추가할 때 상속할 정렬 — 섹션 안 «첫» 텍스트의 정렬을 따라간다.
   ★자유배치(freeLayout) 프레임 «안»의 텍스트는 근거에서 뺀다.
     그 자식들은 자기 좌표계를 갖는 별개 세계이고, 2026-09-05 지시로 «프레임 안 신규 추가»의
     기본 정렬이 가운데가 됐다 — 그걸 여기서 읽으면 프레임이 하나라도 있는 섹션에서
     «섹션에 직접» 넣는 텍스트까지 가운데로 끌려간다(회귀 금지선).
     실측(tests/measure/frame-textcenter): 이 가드가 없을 때 섹션 직접 추가가
     (none) → center 로 오염됐다. 가드 후 (none) 복귀.
   ⚠️fullWidth(플로우) 프레임 안 텍스트는 «뺴지 않는다» — 그쪽은 섹션과 같은 플로우다. */
function getSectionAlign(sec) {
  const cands = sec.querySelectorAll('.text-block .tb-h1, .text-block .tb-h2, .text-block .tb-h3, .text-block .tb-body');
  for (const el of cands) {
    if (el.closest('.frame-block[data-free-layout], .frame-block[data-freelayout]')) continue;
    return el.style.textAlign || null;   // 첫 «섹션 레벨» 텍스트가 정한다(빈 문자열이면 null)
  }
  return null;
}

const GRAPH_DEFAULT_ITEMS = [
  { label: '항목 1', value: 75 },
  { label: '항목 2', value: 90 },
  { label: '항목 3', value: 55 },
  { label: '항목 4', value: 80 },
  { label: '항목 5', value: 65 },
];

// B7: bar-v·bar-pair 의 Bar Settings(항목 간격·두께·좌우 패딩·숫자 크기) — 간격·패딩·숫자 크기는 dataset 키가 «있을 때만» inline 으로 낸다.
// ★E99 U26(2026-10-05): 두께는 «늘» 낸다 — 키가 없으면 GRAPH_LIMITS.BAR_THICKNESS_DEFAULT(가로 막대와 같은 기본, 패널이 보이는 값).
//   전엔 키가 없으면 막대가 칸 전폭(127px 실측)인데 패널은 24 를 보였다. ⚠️두께 키 없는 옛 세로·비교 그래프는 «열면 24px 막대»로 바뀐다(⒜⒝⒞ 현빈 판단 사항).
function _barVSettings(block, nItems) {
  const d = block.dataset;
  const has = k => d[k] !== undefined && d[k] !== '' && !isNaN(parseInt(d[k]));
  const n = k => parseInt(d[k]);
  // 간격은 «블럭 폭/항목 수»를 넘지 않게(min(Npx, 100%/항목수)) — 항목이 많아도 가로로 넘치지 않는다. 폭 안이면 Npx 그대로.
  const gap = has('vItemGap') ? `gap:min(${n('vItemGap')}px,${(100 / Math.max(1, nItems)).toFixed(2)}%);` : '';
  const pad = has('vPadX') ? `padding:0 ${n('vPadX')}px;` : '';
  return {
    barsStyle: (gap + pad) ? ';' + gap + pad : '',
    // 막대 폭은 칸(%)을 넘지 않게 max-width:100%, 칸은 min-width:0 이라 줄어들 수 있다
    fillW: `width:${has('vBarThickness') ? n('vBarThickness') : window.GRAPH_LIMITS.BAR_THICKNESS_DEFAULT}px;max-width:100%;margin:0 auto;`,
    colMin: 'min-width:0;',   // 막대 폭이 늘 정해지므로 칸이 줄 수 있게(전엔 두께 키가 있을 때만 — 위와 같은 꼴)
    pctSize: has('vPctSize') ? n('vPctSize') : null,
    // GR2·GR3 오버레이가 «같은 칸 수식»을 쓰게 내보내는 원값(렌더 문자열에는 안 쓰인다 — 위 세 줄이 바이트를 정한다)
    padX: has('vPadX') ? n('vPadX') : 0,
    gapPx: has('vItemGap') ? n('vItemGap') : null,
    gapPct: (100 / Math.max(1, nItems)).toFixed(2),
  };
}

/* GR2 축 눈금 — 「깔끔한 상한」(지디 판정 2026-10-03 후속, 이전 규칙 «M/step≤6 최소 step + max(ceil,5)칸» 폐기).
 *   후보 step ∈ {1,2,5}×10^k, step ≥ 1(하한 1) · 상단 = ceil(M/step)×step · 칸수 = 상단/step ∈ [3,7] 인 것만.
 *   그중 «상단/M» 이 1 에 가장 가깝게. 동률이면 ★칸수 «많은» 쪽(= 작은 step) — 지디 기대값 표 55→60·step 10·6칸 을 따른 것.
 *     동률 처리는 표를 참값으로 — 2026-10-03 지디 판정(옛 규칙 문장 「칸수 적은 쪽」은 하한 3 의 취지와 어긋나 폐기).
 *   기대값: 13→14(2·7칸) · 11→12(2·6칸) · 4.6→5(1·5칸) · 55→60(10·6칸) · 3.5→4(1·4칸) · 100→100(20·5칸).
 *   후보가 없으면(M<3 같은 작은 값: step 1 이어도 칸이 3 미만) step 1 · 상단 ceil(M)(최소 1) — 예) 1→0~1 · 2→0~2. */
function _niceScale(M) {
  M = (Number.isFinite(M) && M > 0) ? M : 1;
  let best = null;
  for (let k = 0; Math.pow(10, k) <= M; k++) {
    for (const m of [1, 2, 5]) {
      const step = m * Math.pow(10, k);
      const top = Math.ceil(M / step - 1e-9) * step;
      const cnt = Math.round(top / step);
      if (cnt < 3 || cnt > 7) continue;
      const r = top / M;
      if (!best || r < best.r - 1e-12 || (Math.abs(r - best.r) <= 1e-12 && cnt > best.cnt)) best = { step, top, cnt, r };
    }
  }
  if (!best) { const top = Math.max(1, Math.ceil(M - 1e-9)); best = { step: 1, top, cnt: top }; }
  const ticks = []; for (let i = 0; i <= best.cnt; i++) ticks.push(i * best.step);
  return { max: best.top, step: best.step, ticks };
}
window.__grbNiceScale = _niceScale;   // graph-shape.js fillPlan 이 «같은 함수»로 눈금 상한을 읽는다(렌더와 graphFillModel 의 분모가 한 식 · 1012t1G3)

/* ★1017t1f6㉠ — 축 눈금 글자의 «덮어쓴 값»(dataset.axisTickText). 키 = 계산된 눈금 숫자의 String()(예: "20") · 값 = 사용자가 고친 글자.
   ★없으면 옛 그대로(숫자 그대로 그린다) — 덮어쓴 적 없는 그래프는 바이트가 그대로다. 망가진 글자(JSON 아님·배열·원시값)는 {}. */
function _parseAxisTickOv(raw) {
  if (!raw) return {};
  try { const o = JSON.parse(raw); return (o && typeof o === 'object' && !Array.isArray(o)) ? o : {}; } catch (_) { return {}; }
}
window.__grbParseAxisTickOv = _parseAxisTickOv;

/* ★GR2·GR3 — bar-v 플롯 기하 «한 곳». 막대 높이(pct)와 오버레이(축·격자·꺾은선) 좌표가 이 함수 하나에서 나온다.
 *   좌표는 «렌더 때 DOM 을 재서 박는» 게 아니라 모델 수식 + CSS 앵커다(폭이 바뀌어도 맞는다 — GR-DESIGN 대조: px 박기 270px·비율 1.6px 오차).
 *   · 가로: 오버레이 상자 left/right = calc(P − gap/2) ⇒ i번째 막대 가운데 = 상자의 (i+0.5)/n.
 *       gap 은 .grb-bars-v 의 실제 gap 과 같은 식 — 키 없으면 CSS 기본 10px(css/editor-graph.css .grb-bars-v), 있으면
 *       min(Npx, X%)(X% 는 flex 내용폭 기준) ⇒ 오버레이(패딩 상자 기준)에서는 (100% − 2P)×X/100.
 *   · 세로: top = 값 라벨 높이(vSize×1.2 + margin 4) · bottom = 항목 라벨 높이(labelSize×1.2 + margin 6).
 *       라벨 높이를 수식으로 알려고 «오버레이가 켜졌을 때만» 두 라벨에 line-height:1.2;height:1.2em 을 건다(겉모습 ≈1px 변화).
 *   · 셋 다 꺼짐(on=false) ⇒ pct 는 예전 식 그대로·나머지 조각은 전부 '' ⇒ innerHTML 이 30984c67 과 바이트 동일(GR-W0).
 *   · 축 또는 격자가 켜지면 막대도 «깔끔한 상한»으로 다시 비율을 잡는다(격자선과 값이 맞게). 꺾은선만 켜면 예전 상한.
 *   ⚠️값 0·아주 작은 값: 막대는 min-height 4px(.grb-bar-fill)라 꼭대기가 바닥+4px 인데, polyline 꼭짓점은 수식(pct%)이라
 *     바닥에 붙는다 ⇒ 선 꼭짓점이 막대 꼭대기와 최대 ~6px 어긋난다(점 div 는 bottom 이 막대와 같은 식이라 맞는다). 시험 허용치 6.5px. */
function _barVPlotGeom(block, items, { maxVal, labelSize, vSize, bs }) {
  const d = block.dataset;
  const axis = d.showAxis === '1', grid = d.showGrid === '1', line = d.showLine === '1';
  const on = axis || grid || line;
  if (!on) {
    return { on, pct: (v) => (v === 0 ? 0 : Math.max(1, Math.round((v / maxVal) * 100))), barsExtra: '', lhCss: '', overlayHTML: () => '', gridLayerHTML: () => '' };
  }
  const nice = (axis || grid) ? _niceScale(maxVal) : null;
  const scaleMax = nice ? nice.max : maxVal;
  const pct = (v) => (!v ? 0 : Math.max(1, +((v / scaleMax) * 100).toFixed(2)));
  const LH = 1.2;
  const top = d.showVLabel !== '0' ? vSize * LH + 4 : 0;      // .grb-bar-val-label margin-bottom:4px
  const bot = d.showXLabel !== '0' ? labelSize * LH + 6 : 0;  // .grb-bar-label margin-top:6px
  const P = bs.padX;
  const gap = bs.gapPx == null ? '10px' : `min(${bs.gapPx}px, calc((100% - ${2 * P}px) * ${bs.gapPct} / 100))`;
  const inset = `calc(${P}px - ${gap} / 2)`;
  const n = Math.max(1, items.length);
  const xPct = (i) => ((i + 0.5) / n) * 100;
  const tickFont = Math.max(10, Math.round(labelSize * 0.75));
  const axisOv = axis ? _parseAxisTickOv(d.axisTickText) : null;   // ★1017t1f6㉠
  const fmt = (t) => { const k = String(t); return (axisOv && Object.prototype.hasOwnProperty.call(axisOv, k)) ? axisOv[k] : k; };
  const tickChars = nice ? Math.max(...nice.ticks.map(t => fmt(t).length)) : 0;
  // 눈금 글자 자리 — 오버레이 상자 왼쪽 밖(right:100% + 6px)에 그리므로, 그만큼 막대 띠를 오른쪽으로 민다(「11」이 잘리던 시제품 꼴 방지).
  const axisMargin = axis ? Math.ceil(tickChars * tickFont * 0.65 + 8) : 0;
  /* H2(현빈 2026-10-05 「격자선을 막대 뒤로」) — 격자선은 따로 한 층(z-index:-1)에 그리고, 막대 줄을 쌓임 맥락(z-index:0)으로 만든다
     ⇒ 격자 층은 막대(흐름 칸)보다 «뒤», 막대 줄 배경보다는 «앞». 선·점·축·눈금은 그대로 위 층(.grb-ov z-index:1).
     격자가 꺼져 있으면 이 조각은 '' — 옛 바이트 그대로(GR-W0). */
  const barsExtra = 'position:relative;' + (grid ? 'z-index:0;' : '') + (axisMargin ? `margin-left:${axisMargin}px;` : '');
  const lhCss = `line-height:${LH};height:${LH}em;`;
  const ink = _safeGraphColor(d.labelColor);   // 선·점·격자·눈금 색 = 라벨 색(지정 시) 아니면 블럭 글자색(프리셋 color) — 새 색 없음
  const overlayHTML = () => {
    const yOf = (p) => (1000 - p * 10).toFixed(1);
    const ticks = nice ? nice.ticks : [];
    /* (격자선은 H2 로 아래 gridLayerHTML 층으로 옮겼다 — H7 색 규칙도 그리로.) */
    const axisEl = axis ? `<line class="grb-ov-axis" x1="0" x2="0" y1="0" y2="1000" stroke="currentColor" stroke-opacity="0.6" stroke-width="1" vector-effect="non-scaling-stroke"/>` : '';
    const pts = items.map((it, i) => ({ x: (xPct(i) * 10).toFixed(1), p: pct(it.value) }));
    const lineEl = line ? `<polyline class="grb-ov-line" points="${pts.map(q => `${q.x},${yOf(q.p)}`).join(' ')}" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>` : '';
    // 점 높이 = 막대 꼭대기와 같은 식: 값 0 막대는 height:4px + border-style:dashed(기본 medium 3px ×2, border-box) = 6px,
    //   그 밖은 min-height 4px ⇒ max(pct%, 4px).
    const dots = line ? pts.map((q, i) => `<div class="grb-ov-dot" style="position:absolute;left:${xPct(i).toFixed(4)}%;bottom:${q.p === 0 ? '6px' : `max(${q.p}%, 4px)`};width:10px;height:10px;transform:translate(-50%,50%);border-radius:50%;background:currentColor"></div>`).join('') : '';
    /* ★1017t1f6㉠ — data-grb-tick = 그 눈금의 «계산된» 숫자(String) · pointer-events:auto(부모 .grb-ov 는 none 이라 안 밝히면 더블클릭이 안 닿는다).
       더블클릭 편집은 _bindGraphAxisTickEdit(아래)가 연다. */
    const tickEls = axis ? ticks.map(t => `<div class="grb-ov-tick" data-grb-tick="${t}" title="더블클릭 — 이 눈금 글자만 고치기" style="position:absolute;right:100%;margin-right:6px;bottom:${((t / scaleMax) * 100).toFixed(4)}%;transform:translateY(50%);font-size:${tickFont}px;line-height:1;opacity:0.75;white-space:nowrap;pointer-events:auto;cursor:text;">${_escGraphHtml(fmt(t))}</div>`).join('') : '';
    return `<div class="grb-ov" style="position:absolute;left:${inset};right:${inset};top:${top}px;bottom:${bot}px;pointer-events:none;z-index:1;${ink ? `color:${ink};` : ''}">`
      + `<svg class="grb-ov-svg" viewBox="0 0 1000 1000" preserveAspectRatio="none" style="position:absolute;inset:0;width:100%;height:100%;overflow:visible">${axisEl}${lineEl}</svg>`
      + dots + tickEls + `</div>`;
  };
  /* H2 — 격자선 층(막대 «뒤»). 상자는 위 오버레이와 같은 자리·크기(같은 inset · top · bottom) — 선 높이가 눈금과 맞는다. */
  const gridLayerHTML = () => {
    if (!grid) return '';
    const yOf = (p) => (1000 - p * 10).toFixed(1);
    const ticks = nice ? nice.ticks : [];
    const _gc = _safeGraphColor(d.gridColor);
    const _gridStroke = (_gc && !/gradient\(/i.test(_gc)) ? `stroke="${_gc}" stroke-opacity="1"` : `stroke="currentColor" stroke-opacity="0.2"`;
    const gridEl = ticks.map(t => `<line class="grb-ov-grid" x1="0" x2="1000" y1="${yOf((t / scaleMax) * 100)}" y2="${yOf((t / scaleMax) * 100)}" ${_gridStroke} stroke-width="1" vector-effect="non-scaling-stroke"/>`).join('');
    return `<div class="grb-ov-grid-layer" style="position:absolute;left:${inset};right:${inset};top:${top}px;bottom:${bot}px;pointer-events:none;z-index:-1;${ink ? `color:${ink};` : ''}">`
      + `<svg viewBox="0 0 1000 1000" preserveAspectRatio="none" style="position:absolute;inset:0;width:100%;height:100%;overflow:visible">${gridEl}</svg></div>`;
  };
  return { on, axis, grid, line, scaleMax, ticks: nice ? nice.ticks : null, pct, top, bot, inset, barsExtra, lhCss, overlayHTML, gridLayerHTML };
}
/* H6 — 다시 그린 «뒤» 자동 밝기를 맞춘다(그린 값이 바탕이라 그린 다음이어야 한다 · canvas-contrast.js syncGraphTone). 렌더 몸통은 아래 그대로. */
function renderGraph(block) {
  _renderGraphBody(block);
  window.__gdTextTone?.syncGraphTone?.(block);
  _bindGraphLabelEdit(block);
  _bindGraphAxisTickEdit(block);   // ★1017t1f6㉠
  _bindGraphVLabelDrag(block);   // ★1017t1f5 — 꺾은선 값 라벨 개별 드래그(아래)
}
/* K8⒤ — 카테고리 라벨 캔버스 직접 편집(더블클릭). 저장 자리 = dataset.items[i].label 한 곳(패널 .grb-data-label-input 과 같은 키).
 *   라벨은 렌더마다 새로 만들어진다 ⇒ 블럭에 «위임» 한 번만 건다(요소 속성이라 복제·로드된 블럭은 첫 렌더에서 새로 건다).
 *   ⌘Z 한 번: 들어갈 때 ensureHistoryCheckpoint · 확정 뒤 pushHistory. Esc · 빈 글자 · 같은 글자 = 무변(다시 그려 원래 글자로).
 *   편집 중엔 block.editing — 공통 mousedown 드래그·삭제키 가드가 본다(그리드 줄 편집과 같은 꼴). */
/* 카테고리 라벨 «셋»(막대·비교 .grb-bar-label · 가로 .grb-bar-h-desc · 꺾은선 .grb-line-xlabel) — 항목마다 정확히 하나(숨김이어도 display:none 으로 있다)
   ⇒ 블럭 안 순서 = items 순서. 색인을 DOM 속성으로 안 박는다 — 렌더 바이트가 핀(graph-vpair 골든 · GR-W0 기준판)과 같게(회귀 실측: data-grb-idx 가 5 빨강). */
const GRB_CAT_LABEL_SEL = '.grb-bar-label, .grb-bar-h-desc, .grb-line-xlabel, .grb-pie-label, .grb-pie-name';   // 원형·도넛은 범례 라벨(1012t1G1) + 조각 안 이름(t4-17)
/* t4-17 — 색인은 «제 종류 안에서» 센다. 원형은 조각 안 이름(.grb-pie-name)과 범례(.grb-pie-label)가 «둘 다» items 순서로 하나씩 있고
   DOM 순서가 [이름 0..N-1, 범례 0..N-1] 이라, 명부 전체로 세면 범례가 N.. 으로 밀린다(이미 되던 범례 편집이 조용히 틀린다).
   종류 = 위 명부의 조각 하나 — 판정 자리를 따로 두지 않는다(명부에서 파생). 막대·꺾은선은 종류가 하나뿐이라 옛 색인과 같다. */
const GRB_CAT_LABEL_KINDS = GRB_CAT_LABEL_SEL.split(',').map(s => s.trim());
/* t4-17 ㉮ — 조각 안 이름(.grb-pie-name)은 덧층(.grb-pie-tags · pointer-events:none) 안이라 이벤트 대상이 못 된다.
   덧층을 열면 1013t1C3 계약(J5 «라벨 위를 눌러도 그 조각» · J2 · X1)이 깨진다(실측 3 빨강) ⇒ 열지 않고, 같은 위임 안에서
   «누른 점이 보이는 이름 사각형 안인가»로 고른다. 홑클릭·조각 고르기는 그대로 조각에 간다.
   보이는 것만: getBoundingClientRect 는 visibility:hidden · opacity:0 에서도 크기를 준다 ⇒ 사각형 하나로 닫지 않고 checkVisibility(불투명도·visibility 까지)를 같이 건다
   (없는 엔진이면 offsetParent 폴백). display:none(grbPieFitTags 의 --grb-pie-tag-d:none · 조각 「라벨」 숨김)은 사각형 0 으로도 걸러진다.
   상자(.grb-pie-tag)가 overflow:hidden 이라 잘린 글자 밖은 안 잡는다(이름 ∩ 상자). 겹치면 칠 순서 위쪽 — z-index 큰 쪽, 같으면 문서 순서 뒤. */
function _grbPieNameAt(block, x, y) {
  let best = null, bestZ = -Infinity;
  for (const n of block.querySelectorAll('.grb-pie-name')) {
    if (!(n.checkVisibility ? n.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) : n.offsetParent !== null)) continue;
    const tag = n.closest('.grb-pie-tag');
    const a = n.getBoundingClientRect(), b = tag ? tag.getBoundingClientRect() : a;
    const l = Math.max(a.left, b.left), r = Math.min(a.right, b.right), t = Math.max(a.top, b.top), bt = Math.min(a.bottom, b.bottom);
    if (!(r > l && bt > t) || x < l || x > r || y < t || y > bt) continue;
    const z = (tag && parseInt(getComputedStyle(tag).zIndex, 10)) || 0;
    if (z >= bestZ) { best = n; bestZ = z; }
  }
  return best;
}
function _bindGraphLabelEdit(block) {
  if (block._grbLabelEditBound) return;
  block._grbLabelEditBound = true;
  block.addEventListener('dblclick', e => {
    const el = e.target?.closest?.(GRB_CAT_LABEL_SEL) || _grbPieNameAt(block, e.clientX, e.clientY);
    if (!el || !block.contains(el) || el.isContentEditable) return;
    e.stopPropagation(); e.preventDefault();
    const kind = GRB_CAT_LABEL_KINDS.find(s => el.matches(s));
    _graphLabelBeginEdit(block, el, [...block.querySelectorAll(kind)].indexOf(el));
  });
}
function _graphLabelBeginEdit(block, el, idx) {
  window.ensureHistoryCheckpoint?.('그래프 라벨 편집 전');
  block.classList.add('editing');
  el.setAttribute('contenteditable', 'true');   // ⒥⒝ — 세움(parkEditing)은 'true' 만 «살아 있는 편집»으로 본다(_text-selection _parkedAlive). 확정은 textContent 라 서식이 안 남는다
  el.setAttribute('draggable', 'false');
  el.focus();
  const rg = document.createRange(); rg.selectNodeContents(el);
  const sl = window.getSelection(); sl.removeAllRanges(); sl.addRange(rg);
  window.__grbLabelEdit?.reveal?.(block);   // ⒥⒝ — 패널의 «라벨(크기)»·«카테고리 색상» 줄로 스크롤 + 강조(새 절·새 키 0 · prop-graph.js)
  let done = false;
  const finish = (commit, { keepPanel = false } = {}) => {
    if (done) return; done = true;
    el.removeEventListener('keydown', onKey); el.removeEventListener('blur', onBlur);
    block.classList.remove('editing');
    /* ★261018 1017t1f6 — execCommand('insertText','\n') 는 ★<br> 을 넣는다(실측 — 리터럴 '\n' 텍스트 노드가 아니다),
       그런데 textContent 는 <br> 을 «건너뛴다»(기여 0) ⇒ 두 줄이 구분자 없이 붙어버렸다(N1 1차 빨강 — "첫줄\n둘째줄" 기대에 "첫줄둘째줄" 나옴).
       ★innerText 는 <br> 을 '\n' 으로 바꿔 돌려준다(annotation-select.js 의 손과 같다) — 그래서 여기만 innerText 로 읽는다.
       줄 안 공백은 그대로 걷는다(옛 식은 \s+ 전부를 공백 하나로 접어 줄바꿈까지 지웠다) · 붙여넣기(HTML) 는 서식이 안 남는다(옛 성질 그대로 — P 시험,
       innerText 도 textContent 와 같이 인라인 요소 사이에 구분자를 안 넣는다 — <b>굵게</b><a>링크</a> → "굵게링크"). */
    const val = (el.innerText ?? el.textContent ?? '').replace(/[^\S\n]+/g, ' ').trim();
    const items = JSON.parse(block.dataset.items || '[]');
    const changed = commit && val && items[idx] && val !== items[idx].label;
    if (changed) { items[idx].label = val; block.dataset.items = JSON.stringify(items); }
    renderGraph(block);   // 확정이든 취소든 라벨을 dataset 에서 다시 그린다(편집 흔적 0)
    if (changed) {
      window.pushHistory?.('그래프 라벨'); window.scheduleAutoSave?.();
      if (!keepPanel && block.classList.contains('selected')) window.showGraphProperties?.(block);
    }
  };
  const onKey = (ev) => {
    if (ev.isComposing || ev.keyCode === 229) return;   // 한글 조합 중 Enter 는 조합 확정이다
    /* ★261018 1017t1f6 — 현빈 원문 「엔터쳐서 줄바꿈도 할수 있게해줘」= ★맨 Enter. 확정은 ⌘/Ctrl+Enter · blur · Esc(취소) 로 옮겼다
       (선례 js/annotation-select.js:604-642 의 손 — execCommand 로 줄바꿈, 수식키 Enter 로 확정). ⛔축 눈금(.grb-ov-tick · 숫자)은
       Enter=확정 그대로다 — 숫자엔 줄바꿈이 뜻이 없다(아래 _graphAxisTickBeginEdit 머리말 참조). 둘을 같게 맞추지 마라. */
    if (ev.key === 'Enter') {
      ev.preventDefault(); ev.stopPropagation();
      if (ev.metaKey || ev.ctrlKey) finish(true);
      else document.execCommand('insertText', false, '\n');
    }
    else if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); finish(false); }
  };
  /* ⒥⒝ — 패널로 가는 blur 는 끝내지 «않고» 세운다(그리드 줄·텍스트블럭과 같은 술어 isBlurIntoPanel · prop-graph.js 가 _text-selection 을 잇는다).
     끝내면 showGraphProperties 가 패널을 다시 그려 방금 누른 크기·색 칸이 떨어져 나간다(TX1 병). 패널 값이 들어오기 직전엔 flush = 패널을 안 다시 그리는 확정. */
  const onBlur = (ev) => {
    if (window.__grbLabelEdit?.park?.(ev, el, () => finish(true), () => finish(true, { keepPanel: true }))) return;
    finish(true);
  };
  el.addEventListener('keydown', onKey);
  el.addEventListener('blur', onBlur);
}
/* ★1017t1f6㉠ — 「축 보이기」가 켜졌을 때 왼쪽에 뜨는 눈금 숫자(.grb-ov-tick)를 캔버스에서 더블클릭해 바로 고친다.
 *   ★카테고리 라벨(_graphLabelBeginEdit 위)과 «같은 꼴»(더블클릭 → contenteditable → Enter/blur 확정 · Esc 취소)이되,
 *     저장 자리가 다르다 — 라벨은 items[idx].label(색인), 눈금은 dataset.axisTickText(JSON · 키 = 「계산된 숫자」의 글자).
 *     ★색인이 아니라 «값»으로 키를 잡는 이유: 데이터가 바뀌면 깔끔한 상한(_niceScale)이 다시 돌아 눈금 자체가 바뀐다
 *     — 옛 색인에 걸린 덮어쓴 글자가 «다른 숫자 자리»에 눌어붙는 것보다, 숫자가 바뀌면 덮어쓴 글자가 «조용히 빠지는» 쪽이 낫다.
 *   덮어쓴 적 없으면(dataset.axisTickText 없음) 옛 숫자 그대로 — 바이트 무변(GR-W0 은 축 자체가 꺼진 경우만 걸므로 안 걸린다).
 *   ⒥⒝ 패널 스크롤(reveal)은 안 쓴다 — 눈금엔 대응하는 패널 칸이 없다(라벨처럼 크기·색 줄로 데려갈 자리가 없다).
 *   ★261018 — 여기(축 눈금·숫자)는 ★Enter=확정 그대로다. 카테고리 라벨(글, _graphLabelBeginEdit)은 ★맨 Enter=줄바꿈·⌘Enter=확정으로
 *     바뀌었다(1017t1f6㉡) — ★뜻이 달라서 키를 다르게 배정했다(숫자 한 줄엔 줄바꿈이 뜻이 없다). ⛔다음에 「일관성」이라며 둘을 맞추지 마라. */
const GRB_AXIS_TICK_SEL = '.grb-ov-tick';
function _bindGraphAxisTickEdit(block) {
  if (block._grbAxisTickEditBound) return;
  block._grbAxisTickEditBound = true;
  block.addEventListener('dblclick', e => {
    const el = e.target?.closest?.(GRB_AXIS_TICK_SEL);
    if (!el || !block.contains(el) || el.isContentEditable) return;
    e.stopPropagation(); e.preventDefault();
    _graphAxisTickBeginEdit(block, el);
  });
}
function _graphAxisTickBeginEdit(block, el) {
  const key = el.dataset.grbTick;
  if (key == null) return;
  window.ensureHistoryCheckpoint?.('그래프 축 값 편집 전');
  block.classList.add('editing');
  el.setAttribute('contenteditable', 'true');
  el.setAttribute('draggable', 'false');
  el.focus();
  const rg = document.createRange(); rg.selectNodeContents(el);
  const sl = window.getSelection(); sl.removeAllRanges(); sl.addRange(rg);
  let done = false;
  const finish = (commit) => {
    if (done) return; done = true;
    el.removeEventListener('keydown', onKey); el.removeEventListener('blur', onBlur);
    block.classList.remove('editing');
    const val = (el.textContent || '').replace(/\s+/g, ' ').trim();   // 눈금 글자는 한 줄(숫자·단위) — ㉡ 의 줄바꿈 대상이 아니다
    const ov = _parseAxisTickOv(block.dataset.axisTickText);
    const had = Object.prototype.hasOwnProperty.call(ov, key) ? ov[key] : null;
    let changed = false;
    if (commit) {
      if (val === '' || val === key) { if (had != null) { delete ov[key]; changed = true; } }   // 빈 글자·원래 숫자로 되돌리면 덮어쓰기를 지운다
      else if (val !== had) { ov[key] = val; changed = true; }
    }
    if (changed) {
      if (Object.keys(ov).length) block.dataset.axisTickText = JSON.stringify(ov); else delete block.dataset.axisTickText;
    }
    renderGraph(block);   // 확정이든 취소든 눈금을 dataset 에서 다시 그린다(편집 흔적 0)
    if (changed) { window.pushHistory?.('그래프 축 값'); window.scheduleAutoSave?.(); }
  };
  const onKey = (ev) => {
    if (ev.isComposing || ev.keyCode === 229) return;
    if (ev.key === 'Enter') { ev.preventDefault(); ev.stopPropagation(); finish(true); }
    else if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); finish(false); }
  };
  const onBlur = () => finish(true);
  el.addEventListener('keydown', onKey);
  el.addEventListener('blur', onBlur);
}

/* ── ★1017t1f5 꺾은선 값 라벨(.grb-line-vlabel) «개별 드래그» ──────────────────────────
 * 현빈 티켓(1017t1f5) 「값표시 값들 개별 드래그로 위치이동, 어노테이션의 라벨과 같은 원리로」.
 * 선례 = js/annotation-select.js _startLabelOffsetDrag(1013t1A3) — 「이미 골라진 라벨을 «안 움직이고»
 *   한 번 더 누르면 라벨을 고른다(다음 끌기 = 라벨만)」. 어노테이션은 라벨이 블럭당 «하나»라 직접 바인딩해도
 *   되지만, 꺾은선은 항목마다 하나(«여럿»)이고 렌더마다 innerHTML 로 다시 만들어진다 ⇒ 카테고리 라벨 편집
 *   (_bindGraphLabelEdit)과 같은 꼴로 블럭에 «위임 한 번»만 건다.
 * 고르기 상태 = DOM 표식 «하나»뿐: .grb-line-vlabel.grb-vlabel-cell-selected(조각 고르기 grb-pie-cell-selected
 *   와 같은 두 진실 방지 — JS 쪽에 따로 안 둔다). 색인은 DOM 위치로만 센다 — data-* 속성 금지
 *   (위 K8⒤ 주석 「색인을 DOM 속성으로 안 박는다 — data-grb-idx 가 골든 5 빨강」과 같은 까닭).
 * 저장 자리 = dataset.items[i].vDx/vDy 한 곳(패널·MCP 캐리오버는 js/graph-shape.js carryItemExtras).
 * ★★261018 고침(태양 창 실측 V3 빨강) — ★«고르기»는 여기서 직접 하지 않는다. js/block-drag.js 의
 *   isGraph click 핸들러(1013t1C4 조각 고르기와 같은 자리)가 매 클릭마다 deselectAll()→재선택을 통째로
 *   돌린다(clearSelectionMarks 가 -cell-selected 전부를 쓸어낸다) — 내가 mouseup 에서 따로 골라 놓아도
 *   그 직후(같은 제스처의) click 이 지워버렸다(실측: 2번째 누름 뒤 picked 가 false). 조각 고르기가 그 click
 *   핸들러 «안에서» _pieWas/_pieIdx 로 지우기 직전 상태를 챙겨 지운 뒤 다시 거는 것과 같은 자리에,
 *   grbVLabelIndexAt 로 값 라벨도 같이 챙겨 다시 건다 — 그래서 여기엔 «고르기 읽기»(grbVLabelIndexAt)만 두고
 *   «고르기 쓰기»(grbVLabelPick)는 그 click 핸들러가 부른다. 이 파일의 mousedown 은 ★이미 고른 라벨을 끄는 것만 맡는다. */
function _grbVLabelMarkIndex(block) {
  return [...block.querySelectorAll('.grb-line-vlabel')].findIndex(l => l.classList.contains('grb-vlabel-cell-selected'));
}
/** idx 번 값 라벨을 고른다. null·범위 밖 = 전부 해제(grbPieSelect 와 같은 꼴). */
function grbVLabelPick(block, idx) {
  if (!block) return;
  block.querySelectorAll('.grb-line-vlabel').forEach((l, i) => l.classList.toggle('grb-vlabel-cell-selected', i === idx));
}
/** 클릭 지점(target)이 어느 값 라벨 위인가(없으면 −1) — grbPieSliceIndexAt 과 같은 꼴·같은 부르는 자리(block-drag.js 클릭 핸들러). */
function grbVLabelIndexAt(target, block) {
  const p = target?.closest?.('.grb-line-vlabel');
  if (!p || !block || !block.contains(p)) return -1;
  return [...block.querySelectorAll('.grb-line-vlabel')].indexOf(p);
}
function _grbZoomFrac() { return (window.currentZoom || 40) / 100; }
/** 골라 둔 값 라벨을 끈다(끄는 동안은 el.style.translate 만, 놓을 때 dataset 에 쓰고 «끝 표본»을 찍는다 — 어노테이션 라벨과 같은 길). */
function _startVLabelOffsetDrag(block, el, idx, e) {
  e.stopImmediatePropagation(); e.stopPropagation(); e.preventDefault();
  const startX = e.clientX, startY = e.clientY;
  let items; try { items = JSON.parse(block.dataset.items || '[]'); } catch (_) { return; }
  if (!items[idx]) return;
  const L = window.GRAPH_LIMITS;
  const clamp = (v) => Math.min(L.VLABEL_OFFSET_MAX, Math.max(L.VLABEL_OFFSET_MIN, Math.round(v)));
  const off0 = { dx: Number(items[idx].vDx) || 0, dy: Number(items[idx].vDy) || 0 };
  let moved = false, cur = null;
  const _hist = window.beginDragHistory?.('그래프 값 라벨 위치');
  const onMove = (ev) => {
    const ddx = (ev.clientX - startX) / _grbZoomFrac();
    const ddy = (ev.clientY - startY) / _grbZoomFrac();
    if (!moved) {
      if (Math.abs(ev.clientX - startX) < 3 && Math.abs(ev.clientY - startY) < 3) return;
      moved = true;
      _hist?.arm(ddx, ddy);
    }
    cur = { dx: clamp(off0.dx + ddx), dy: clamp(off0.dy + ddy) };
    el.style.translate = `${cur.dx}px ${cur.dy}px`;
    ev.preventDefault();
  };
  const onUp = () => {
    document.removeEventListener('mousemove', onMove, true);
    document.removeEventListener('mouseup',   onUp,   true);
    if (!moved || !cur) return;
    // 끌기 끝의 click 은 삼킨다 — 라벨 밖에서 놓으면 그 click 이 고르기/선택을 풀어 버린다(annotation-select.js 와 같은 처방).
    const eat = (ce) => { ce.stopPropagation(); ce.preventDefault(); };
    window.addEventListener('click', eat, { capture: true, once: true });
    setTimeout(() => window.removeEventListener('click', eat, true), 0);
    const its = JSON.parse(block.dataset.items || '[]');
    if (!its[idx]) return;
    if (cur.dx === 0) delete its[idx].vDx; else its[idx].vDx = cur.dx;
    if (cur.dy === 0) delete its[idx].vDy; else its[idx].vDy = cur.dy;
    block.dataset.items = JSON.stringify(its);
    renderGraph(block);
    grbVLabelPick(block, idx);   // 다시 그린 새 엘리먼트에 고르기 표식을 되붙인다
    if (typeof window.pushHistory === 'function') window.pushHistory('그래프 값 라벨 위치');
    window.scheduleAutoSave?.();
    if (block.classList.contains('selected')) window.showGraphProperties?.(block);
  };
  document.addEventListener('mousemove', onMove, true);
  document.addEventListener('mouseup',   onUp,   true);
}
/** 블럭당 위임 1회(라벨은 렌더마다 새로 만들어진다 — _bindGraphLabelEdit 와 같은 가드 꼴).
 *  ★고르기는 안 한다(위 머리말 261018 고침) — js/block-drag.js isGraph click 핸들러가 한다.
 *  여기는 «이미 고른» 라벨의 mousedown 만 가로채 끌기를 시작한다. */
function _bindGraphVLabelDrag(block) {
  if (block._grbVLabelDragBound) return;
  block._grbVLabelDragBound = true;
  // capture:true — 블럭의 일반 mousedown(드래그 시작) 보다 «먼저» 받아야 고른 라벨에서 가로챌 수 있다(annotation-select.js 의 label mousedown 과 같은 길).
  block.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    const el = e.target?.closest?.('.grb-line-vlabel');
    if (!el || !block.contains(el)) return;
    const idx = [...block.querySelectorAll('.grb-line-vlabel')].indexOf(el);
    if (idx < 0) return;
    const picked = block.classList.contains('selected') && el.classList.contains('grb-vlabel-cell-selected');
    if (picked && !(e.metaKey || e.ctrlKey)) {
      _startVLabelOffsetDrag(block, el, idx, e);
    }
    // 아직 안 골랐으면 — 아무것도 안 한다(전파를 막지 않는다). 클릭은 그대로 block-drag.js 의 isGraph
    // click 핸들러로 가서 「첫 클릭=블럭 선택 · 이미 선택된 블럭에서 또 누르면 그 라벨 고르기」를 거기서 맡는다.
  }, true);
}

/* ── 1012t1G1 원형(pie) · 도넛(donut) ─────────────────────────────────────
 * 조각 = 인라인 SVG path(기하는 graph-pie-geom.js piePaths 한 자리) · 도넛 구멍은 고리 path 로 실제로 뚫는다(바탕색 원으로 덮지 않는다).
 * 조각 요소는 «항목마다 정확히 하나»(값 0 이면 d 가 빈 글자) ⇒ 형제 순번 = 항목 순서 — CSS 색 사다리와 범례가 같은 순번을 쓴다.
 * 색: item.color(단색)면 조각·범례 점에 인라인, 아니면 CSS 프리셋. 막대에서 넘어온 그라데이션 item.color 는 여기선 «미지정»으로 본다(모델은 안 지운다).
 * 범례 = 카테고리 라벨(.grb-pie-label · 더블클릭 편집 대상) + 비율 %(.grb-pie-val). 공통 키(showVLabel·showXLabel·라벨 색 셋·labelSize·chartHeight)를 그대로 따른다.
 * 사용자 글자는 _escGraphHtml · 색은 _safeGraphColor 만 지난다(E152 규약).
 * 1013t1C — 도넛 여부 = chartType 'donut'(옛 별칭) 또는 dataset.pieDonut '1'. 새 키가 «하나도 없으면» 그림(innerHTML)은 1012 판과 바이트가 같다(골든 G0).
 * 1013t1C3 — 조각 안 라벨(순위 배지 「n위」 · 이름): dataset.pieRank / pieName 이 '1' 일 때만 svg 바로 뒤에 HTML 덧층 .grb-pie-tags 를 낸다(둘 다 꺼지면 덧층 자체가 없다 = 옛 바이트).
 *   덧층 안은 «항목마다 정확히 하나»의 .grb-pie-tag(색인 = 조각 색인 — 글자 톤 canvas-contrast.js _syncPieTagTone 이 색인으로 짝짓는다). 자리·보임은 graph-pie-geom.js pieTagPlan,
 *   순위는 pieRanks. 자리는 viewBox 좌표를 % 로 옮겨 쓴다(덧층 = svg 가 그려지는 정사각과 겹치는 정사각 · css/editor-graph.css). 덧층은 클릭을 안 받는다(pointer-events:none — 조각 고르기·블럭 끌기 그대로).
 *   클래스 이름에 grb-pie-label 을 안 쓴다 — 그 이름은 범례 라벨이고 더블클릭 편집·패널 색 칸이 «그 이름으로» 색인을 센다. 이름 글자는 사용자 글자 ⇒ _escGraphHtml. */
/* 1013t1C4 전제 — 조각 고르기. 상태는 DOM 표식 «하나»뿐이다: path.grb-pie-slice.grb-pie-cell-selected (JS 쪽에 따로 들지 않는다 — 두 진실 방지).
 *   이름이 -cell-selected 로 끝나 저장·복사 때 section-serialize 의 RUNTIME_MARKER_RE 가 벗긴다(별 한 개 고르기 star-cell-selected 와 같은 길).
 *   세우는 자: block-drag.js 그래프 클릭(이미 이 블럭만 선택된 채 조각을 누르면) · 패널 Data 줄의 조각 버튼. 걷는 자: editor.js clearSelectionMarks «한 곳».
 *   다시 그리기(_renderPie)는 표식을 색인으로 옮겨 붙인다 — 마크업 문자열에는 안 넣는다(「두 번 그려 같다」 무변). */
function grbPieSliceIndexAt(target, block) {
  const p = target?.closest?.('.grb-pie-slice');
  if (!p || !block || !block.contains(p)) return -1;
  return [...block.querySelectorAll('.grb-pie-slice')].indexOf(p);
}
function _grbPieMarkIndex(block) {
  return [...block.querySelectorAll('.grb-pie-slice')].findIndex(p => p.classList.contains('grb-pie-cell-selected'));
}
/** 고른 조각의 색인(항목 순서) — 블럭이 선택돼 있고 표식이 있을 때만. 없으면 −1. */
function grbPieSelected(block) {
  if (!block || !block.classList.contains('selected')) return -1;
  return _grbPieMarkIndex(block);
}
/** idx 번 조각을 고른다. null·범위 밖 = 해제. */
function grbPieSelect(block, idx) {
  if (!block) return;
  block.querySelectorAll('.grb-pie-slice').forEach((p, i) => p.classList.toggle('grb-pie-cell-selected', i === idx));
}
/* 1013t1C3 고침 — 조각 안 라벨의 «둘째 단»: 그려진 글자를 재서 제 조각 안에 넣는다(첫 단 = pieTagPlan 의 기하 숨김 · 마크업의 display:none).
 *   첫 단은 viewBox 단위만 본다 ⇒ 차트가 작거나 · 라벨 글자가 크거나 · 이름이 길면 라벨이 조각을 넘고 서로 겹쳤다(이벨류에이터 실측 2026-10-13).
 *   라벨마다 차례로(고침 2 — «숨기기 전에» 단계를 밟는다):
 *     ① 줄바꿈 — pieTagRoom 의 사각형(넓적한 것부터)을 폭 한계로 주고 «잰 크기»가 그 조각 안이면(fits) 그 폭으로 둔다. 이름은 PIE_TAG_NAME_LINES(2)줄까지.
 *     ② 글자 줄이기 — 안 들면 글자 크기를 pieTagFontSizes(블럭 라벨 크기)의 다음 단계로 줄여 ①을 다시 한다(가장 작은 단계 = LABEL_SIZE_MIN 위). 키우는 단계는 없다.
 *        줄인 크기는 라벨 전체(배지 + 이름)에 건다 — 배지·간격이 em 이라 같은 비로 준다(참고 그림도 작은 조각은 배지까지 작다).
 *     ③ 어느 크기로도 안 들면 이름을 숨기고(순위 배지만) ①·②를 다시 한다 ④ 그래도 안 들면 라벨을 숨긴다.
 *     items[i].pieTag 'on'(항상)은 ③·④ 대신: 가장 작은 글자 · 가장 넓은 사각형 안에서 이름을 «줄 수로 자른다»(line-clamp · 끝에 말줄임 · 많아야 PIE_TAG_NAME_LINES 줄). 한 줄도 안 들 때만 배지만 남긴다.
 *   고침 3(1013t1C3 · 이벨류에이터 실측 2026-10-14) — «재서 든» 라벨에도 폭·높이 한계를 «쌍으로» 쓴다: fits(폭 한계, 높이 한계) 가 참인 쌍(아래 capOf).
 *     전에는 높이 한계를 'none' 으로 썼다(잰 글자가 든다는 것만 믿었다) ⇒ 단독 HTML 내보내기는 이 인라인 변수를 그대로 싣는데 글꼴이 달라 줄이 하나 늘면 라벨이 조각을 넘었다
 *     ('none' 이 CSS 의 기하 안전망 --grb-pie-box-h 까지 껐다). 이제 한계 사각형 자체가 조각 안이라 «글자가 어떻게 놓이든»(다른 글꼴 · 스크립트 없는 산출물) 넘는 만큼은 잘린다.
 *     편집 화면의 결과는 그대로다 — 쌍은 «잰 크기 이상»으로만 잡는다(못 잡으면 그 판은 안 든 것으로 치고 다음 사각형·글자 크기로 간다).
 *   결과는 «인라인 CSS 변수»에만 산다(canvas-contrast.js GRAPH_PIE_FIT_VARS — DERIVED_AUTO_VARS 에 올라 저장·히스토리에서 걷힌다 · 열면 관찰자가 다시 잰다). 마크업·dataset 은 안 건드린다.
 *   크기는 덧층 정사각에 대한 «비»로 잰다 ⇒ 줌·배율과 무관. 못 재면(떼어진 블럭 · 폭 0) 아무것도 안 쓴다 = CSS 가 기하 사각형으로 자른다.
 *   부르는 자: canvas-contrast.js syncGraphTone(다시 그린 뒤 · 블럭이 꽂힐 때) · 아래 ResizeObserver(블럭 크기가 바뀔 때) · 글꼴이 다 실렸을 때. 같은 판(덧층 폭 · 글꼴)에서 다시 부르면 아무것도 안 한다(멱등).
 *   잰 뒤 «좁아서 숨겨진 이름 수»를 덧층의 JS 속성(_grbPieHidden — DOM·저장에 0)에 적고 블럭에서 grb-pie-fit 을 올린다(듣는 자 = 패널의 안내 줄 · js/props/prop-graph.js). 읽는 길 = grbPieHiddenNames(block).
 *     세는 것: 이름 표시가 켜진 블럭에서 «그려진 조각»(값 > 0)인데 이름이 안 보이는 것(첫 단의 기하 숨김 · 이름만 숨김 · 라벨째 숨김). 안 세는 것: 사용자가 「숨김」('off')으로 둔 조각 · 값 0 조각 · 말줄임으로 잘린 「항상」 라벨. */
let _grbPieFontEpoch = 0;
const _grbPieRO = (typeof ResizeObserver === 'function') ? new ResizeObserver((entries) => { for (const en of entries) if (en.target.isConnected) grbPieFitTags(en.target); }) : null;
if (typeof document !== 'undefined' && document.fonts?.addEventListener) {
  document.fonts.addEventListener('loadingdone', () => { _grbPieFontEpoch++; document.querySelectorAll('.graph-block').forEach(b => { if (b.querySelector('.grb-pie-tags')) grbPieFitTags(b); }); });
}
/** 좁아서 숨겨진 이름 수(가장 최근에 잰 값 · 덧층이 없거나 아직 안 쟀으면 0). */
function grbPieHiddenNames(block) {
  const n = block?.querySelector?.('.grb-pie-tags')?._grbPieHidden;
  return Number.isFinite(n) ? n : 0;
}
function grbPieFitTags(block) {
  const layer = block?.querySelector?.('.grb-pie-tags');
  if (!layer) return;
  _grbPieRO?.observe(block);   // 같은 요소를 또 보라고 해도 한 번만 본다
  const lr = layer.getBoundingClientRect();
  if (!(lr.width > 0) || !(layer.offsetWidth > 0)) return;
  const key = layer.offsetWidth + '|' + _grbPieFontEpoch;
  if (layer._grbPieFitKey === key) return;
  let items; try { items = JSON.parse(block.dataset.items || '[]'); } catch (_) { return; }
  const tags = [...layer.children];
  if (!Array.isArray(items) || tags.length !== items.length) return;
  const { geo, _m } = _pieGeoOf(block, items);
  const room = window.GRAPH_PIE_GEOM.pieTagRoom(geo);
  const side = 1000 + 2 * _m, unit = side / lr.width;   // 화면 px → viewBox 단위
  const pc = (v) => (Math.floor(v / side * 10000) / 100).toFixed(2) + '%';
  const [W, H, D, ND, NL, FS] = window.__gdTextTone?.GRAPH_PIE_FIT_VARS || [];   // 변수 이름의 한 벌 = canvas-contrast.js(저장에서 걷는 목록과 같은 자리)
  if (!FS) return;
  const L = window.GRAPH_LIMITS;
  const sizes = window.GRAPH_PIE_GEOM.pieTagFontSizes(parseInt(block.dataset.labelSize) || L.LABEL_SIZE_DEFAULT);   // 큰 것부터 · 첫 값 = 라벨 크기(안 줄임) — renderGraph 와 같은 읽기
  const fsOf = (k) => k > 0 ? sizes[k] + 'px' : '';   // 안 줄였으면 변수 자체가 없다(덧층의 글자 크기를 물려받는다)
  const maxLines = Math.max(1, parseInt(L.PIE_TAG_NAME_LINES) || 1);
  const put = (el, v, want) => { if (!el || el.style.getPropertyValue(v).trim() === want) return; if (want) el.style.setProperty(v, want); else el.style.removeProperty(v); };
  const st = tags.map((tag, i) => ({ tag, i, name: tag.querySelector('.grb-pie-name'), rank: tag.querySelector('.grb-pie-rank'), on: items[i] && items[i].pieTag === 'on',
    live: tag.style.display !== 'none', done: false, w: '', h: '', d: '', nd: '', nl: '', fs: '' }));   // w · h = 끝에 쓸 한계 쌍(재서 든 라벨은 capOf 가 낸다 — 'none' 을 남기지 않는다)
  const open = () => st.filter(s => s.live && !s.done);
  const lineH = (el) => { const v = parseFloat(getComputedStyle(el).lineHeight); return v > 0 ? v : 0; };   // 한 줄의 높이(배치 px — offsetHeight 와 같은 단위 · 줌과 무관)
  /* 한계 쌍(고침 3) — 폭 한계 bw(지금 써 본 사각형의 폭) 아래에서 잰 크기 mw × mh 가 조각 안일 때, «한계 사각형 자체가 조각 안»인 { w, h }(덧층의 % 글자)를 낸다. 못 내면 null.
       fits 는 같은 자리의 더 작은 사각형에 늘 참이다(작은 사각형은 큰 사각형 안) ⇒ fits(한계 폭, 한계 높이) 면 그 안에서 글자가 어떻게 놓여도 조각 안이다.
       ① fits(bw, mh) 면 폭은 bw 그대로(글자 = 전과 같다) · 높이 = 그 폭에서 드는 가장 큰 높이(이분법).
       ② 아니면 라벨이 bw 보다 좁아서 든 것이다(좁고 긴 꼴) ⇒ 폭 한계를 «mh 가 드는 가장 넓은 폭»으로 좁힌다. 좁힌 폭은 잰 폭보다 0.01 % 넘게 넓어야 한다(폭 한계가 줄바꿈을 건드리지 않게).
       높이 한계는 잰 높이 이상이어야 한다(잘린 글자 0). 내림(0.01 %)으로 그 밑이 되는 «아슬아슬한» 판은 안 든 것으로 친다. */
  const STEP = side / 10000;   // 0.01 % (pc 의 눈금)
  const capOf = (fits, bw, mw, mh) => {
    let w = bw, wTxt = pc(bw);
    if (!fits(bw, mh)) {
      if (!(mw < bw)) return null;
      let lo = mw, hi = bw;
      for (let k = 0; k < 24; k++) { const m = (lo + hi) / 2; if (fits(m, mh)) lo = m; else hi = m; }
      const n = Math.floor(lo / STEP);
      w = n * STEP;
      if (!(w >= mw + STEP) || !fits(w, mh)) return null;
      wTxt = (n / 100).toFixed(2) + '%';
    }
    let lo = mh, hi = side;
    for (let k = 0; k < 24; k++) { const m = (lo + hi) / 2; if (fits(w, m)) lo = m; else hi = m; }
    const hn = Math.floor(lo / STEP);
    if (!(hn * STEP >= mh)) return null;
    return { w: wTxt, h: (hn / 100).toFixed(2) + '%' };
  };
  /* 잰 크기가 조각 안인가 — 가로로 넘친 글자(줄을 못 바꾸는 배지)는 사각형이 잘려 보이므로 따로 본다 · 이름이 보이면 줄 수도 본다(maxLines 줄까지).
     든다면 그 판의 한계 쌍을 s.cap 에 적는다(쌍을 못 내면 안 든 것). bw = 지금 써 본 사각형의 폭(viewBox 단위) */
  const ok = (s, bw) => {
    if (s.tag.scrollWidth > s.tag.clientWidth) return false;
    if (s.name && s.name.style.getPropertyValue(ND).trim() !== 'none') { const lh = lineH(s.name); if (lh > 0 && s.name.offsetHeight > lh * (maxLines + 0.5)) return false; }
    const r = s.tag.getBoundingClientRect(), mw = r.width * unit, mh = r.height * unit;
    if (!room[s.i].fits(mw, mh)) return false;
    s.cap = capOf(room[s.i].fits, bw, mw, mh);
    return !!s.cap;
  };
  open().forEach(s => { put(s.tag, D, ''); put(s.tag, H, 'none'); put(s.tag, FS, ''); put(s.name, ND, ''); put(s.name, NL, ''); });
  const nBox = room.length ? room[0].boxes.length : 0;
  /* 글자 크기(큰 것부터) × 사각형(넓적한 것부터) — 쓰기를 모아 하고 읽기를 모아 한다(판마다 리플로우 한 번). pick = 이 판에서 맞춰 볼 라벨들 */
  const sweep = (pick, nd) => {
    for (let f = 0; f < sizes.length && pick().length; f++) {
      pick().forEach(s => put(s.tag, FS, fsOf(f)));
      for (let k = 0; k < nBox && pick().length; k++) {
        const cur = pick();
        cur.forEach(s => put(s.tag, W, pc(room[s.i].boxes[k].w)));
        cur.filter(s => ok(s, room[s.i].boxes[k].w)).forEach(s => { s.done = true; s.nd = nd; s.fs = fsOf(f); s.w = s.cap.w; s.h = s.cap.h; });
      }
    }
  };
  sweep(open, '');   // ①·② 이름까지 — 줄바꿈 → 글자 줄이기
  const both = () => open().filter(s => !s.on && s.name && s.rank && s.rank.textContent);   // ③ 이름을 숨기고 배지만(「항상」 라벨은 아래에서 이름을 자른다)
  both().forEach(s => put(s.name, ND, 'none'));
  sweep(both, 'none');
  const last = sizes.length - 1;
  open().forEach(s => {   // ④ 자동 = 숨김 · 'on' = 가장 작은 글자 · 가장 넓은 사각형으로 자른다
    if (!s.on) { s.d = 'none'; s.w = ''; s.h = ''; return; }
    const bx = room[s.i].boxes[room[s.i].best];
    s.w = pc(bx.w); s.h = pc(bx.h); s.fs = fsOf(last);
    if (!s.name) return;
    put(s.name, ND, ''); put(s.name, NL, ''); put(s.tag, W, s.w); put(s.tag, FS, s.fs);
    const lh = lineH(s.name);
    const head = (s.rank && s.rank.textContent) ? s.name.offsetTop : 0;   // 배지 + 간격(배치 px · 라벨이 offsetParent)
    const lines = lh > 0 ? Math.min(maxLines, Math.floor((bx.h / side * layer.offsetWidth - head) / lh + 0.02)) : 0;
    if (lines >= 1) s.nl = String(lines); else if (head > 0) s.nd = 'none'; else s.nl = '1';
  });
  st.forEach(s => { if (!s.live) return; put(s.tag, W, s.w); put(s.tag, H, s.h); put(s.tag, D, s.d); put(s.tag, FS, s.fs); put(s.name, ND, s.nd); put(s.name, NL, s.nl); });
  layer._grbPieFitKey = key;
  layer._grbPieHidden = st.filter(s => s.name && !(items[s.i] && items[s.i].pieTag === 'off') && geo.shares[s.i] > 0 && (!s.live || s.d === 'none' || s.nd === 'none')).length;
  block.dispatchEvent(new CustomEvent('grb-pie-fit', { bubbles: true, detail: { hiddenNames: layer._grbPieHidden } }));
}
/* 조각 기하의 «한 자리»(1013t1C3 고침) — dataset + 항목 → piePaths 산출과 viewBox 여유(_m). 그리기(_renderPie)와 라벨 맞추기(grbPieFitTags)가 «같은 수»를 읽는다. */
function _pieGeoOf(block, items) {
  const d = block.dataset;
  const L = window.GRAPH_LIMITS;
  const _h = parseInt(d.pieHole);
  const donut = d.chartType === 'donut' || d.pieDonut === '1';   // 1013t1C1 — 유형은 '원형' 하나 + 「도너츠」 토글(pieDonut='1'). 옛 유형 'donut' 은 «영구 별칭»(옛 저장본 그대로 그린다)
  const hole = donut ? Math.min(L.PIE_HOLE_MAX, Math.max(L.PIE_HOLE_MIN, Number.isFinite(_h) ? _h : L.PIE_HOLE_DEFAULT)) : 0;
  const _vals = items.map(it => it && it.value);
  const _g = parseInt(d.pieGap);   // 1013t1C6 — 조각 간격(없으면 기본 PIE_GAP · 0 = 맞닿는다)
  const gap = (d.pieGap !== undefined && Number.isFinite(_g)) ? Math.min(L.PIE_GAP_MAX, Math.max(L.PIE_GAP_MIN, _g)) : L.PIE_GAP;
  const _s = parseInt(d.pieStart);   // 1013t1C2 — 시작 각도(도 · 없으면 0). 범례·% 는 항목 순서 그대로다
  const start = Number.isFinite(_s) ? ((_s % 360) + 360) % 360 : 0;
  /* 1013t1C4 — 조각 크기(items[i].pieGrow · 바깥 반지름에 더하는 % · 0~PIE_GROW_MAX). 키운 조각은 viewBox 밖으로 나가므로 viewBox 를 «대칭으로» 넓힌다
       ⇒ 키운 조각 «말고는» path 글자가 그대로다(전체를 줄여 그리면 모든 d 가 바뀐다 · overflow:visible 은 아래 범례를 덮는다). 안 키웠으면 viewBox 글자도 옛 그대로. */
  const _pct = (v, hi) => { const n = parseInt(v); return Number.isFinite(n) ? Math.min(hi, Math.max(0, n)) : 0; };
  const grow = items.map(it => _pct(it && it.pieGrow, L.PIE_GROW_MAX));
  /* 1013t1C5 — 밀어내기(items[i].piePull · R 대비 % · 0~PIE_PULL_MAX). 조각을 이등분각 방향으로 «통째로» 옮긴다 — d 는 그대로 두고 path 의 transform 으로(geo.offsets).
       안 민 조각은 속성 자체가 없다(옛 그림과 바이트가 같다). 민 만큼도 extent 에 들어 viewBox 가 같이 넓어진다. 조각 클릭은 브라우저가 «옮긴 자리»에서 맞힌다(e.target). */
  const pull = items.map(it => _pct(it && it.piePull, L.PIE_PULL_MAX));
  const geo = window.GRAPH_PIE_GEOM.piePaths(_vals, hole, gap, { start, grow, pull });   // 조각 사이 틈 — 색 주기(5)로 같은 색이 맞닿아도 갈린다
  return { geo, _vals, _m: Math.ceil(geo.extent) };
}
/* 1017t1f4 — 그림자 x/y/blur/색상 조절(원형 전용 · 프리셋 soft/strong 위에 얹는다). 값·범위의 임자는 js/effects-shadow.js
   FX_SHADOW_DEFAULTS/RANGES — 아래 네 수는 그 «사본»이다(drag-utils.js 는 독립 서빙 DOM 하네스 6곳이 있어 그 파일을 import
   하면 404 로 모듈 그래프가 죽는다 — 파일 머리말의 _isCssBg 주석과 같은 까닭). 두 값이 갈리면
   tests/unit/graph-shadow-xy-derived.test.mjs 가 빨개진다. ⛔여기서 손으로 다른 수를 적지 마라.
   불투명도 조절칸은 없다 — 지금 켠 프리셋(soft 0.25 · strong 0.55)의 값을 그대로 쓴다(css/editor-graph.css 두 줄과
   같은 수 · K2 가 그 두 수가 확대블럭과 같은지 잠근다 — 이 오버레이는 K2 가 재는 가치를 안 바꾼다). */
const _PIE_SH_RANGE = { x: [-20, 20], y: [-20, 20], blur: [0, 40] };
const _PIE_SH_DEFAULT = { x: 2, y: 2, blur: 4 };
const _pieShInt = (raw, [lo, hi], dflt) => { const n = parseInt(raw); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : dflt; };
/* 색상은 패널의 colorFieldHTML/wireColorField(js/props/color-picker.js — 색 코드 칸 배선의 «한 자리» · tests/unit/color-hex-wiring-ssot.test.mjs
   가 손사본을 막는다)를 지나 hex 또는 rgba(…) 문자열로 저장된다 — 그 안에 이미 불투명도가 있다. 여기선 그 문법만 검증한다(저장본이 손으로
   바뀐 경우의 방어 · 험한 값은 프리셋의 기본 틴트로 떨어진다). */
const _pieShColor = (raw) => {
  const s = String(raw || '').trim();
  if (/^#[0-9a-f]{6}$/i.test(s)) return s;
  const m = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*(0|1|0?\.\d+)\s*)?\)$/i.exec(s);
  if (m) { const c = (n) => Math.max(0, Math.min(255, +n)); const a = m[4] !== undefined ? Math.max(0, Math.min(1, +m[4])) : 1; return `rgba(${c(m[1])},${c(m[2])},${c(m[3])},${a})`; }
  return '';
};
function _pieShadowFilterStyle(d) {
  const preset = (d.dropShadow === 'soft' || d.dropShadow === 'strong') ? d.dropShadow : 'none';
  const hasOverride = d.pieShadowX !== undefined || d.pieShadowY !== undefined || d.pieShadowBlur !== undefined || d.pieShadowColor !== undefined;
  if (preset === 'none' || !hasOverride) return '';   // 키 없음 = CSS 프리셋 그대로(그림 무변 · K1·K2·K3 유지)
  const x = _pieShInt(d.pieShadowX, _PIE_SH_RANGE.x, _PIE_SH_DEFAULT.x);
  const y = _pieShInt(d.pieShadowY, _PIE_SH_RANGE.y, _PIE_SH_DEFAULT.y);
  const blur = _pieShInt(d.pieShadowBlur, _PIE_SH_RANGE.blur, _PIE_SH_DEFAULT.blur);
  const col = _pieShColor(d.pieShadowColor) || `rgba(0,0,0,${preset === 'strong' ? 0.55 : 0.25})`;   // css/editor-graph.css:310-311 과 같은 틴트(기본값)
  return ` style="filter:drop-shadow(${x}px ${y}px ${blur}px ${col})"`;
}
function _renderPie(block, { items, chartH, labelSize }) {
  const d = block.dataset;
  const L = window.GRAPH_LIMITS;
  const _selIdx = _grbPieMarkIndex(block);   // 다시 그리기 «전»의 조각 선택 — 아래에서 innerHTML 을 덮은 뒤 되붙인다
  const { geo, _vals, _m } = _pieGeoOf(block, items);
  const viewBox = _m ? `${-_m} ${-_m} ${1000 + 2 * _m} ${1000 + 2 * _m}` : '0 0 1000 1000';
  const pcts = window.GRAPH_PIE_GEOM.piePercents(_vals);                // 합이 정확히 100(최대 잔여법)
  const _lc = d.labelColor || '';
  const _vCss = (d.showVLabel !== '0' ? '' : 'display:none;') + ((_c => _c ? `color:${_c};` : '')(_safeGraphColor(d.vlabelColor || _lc)));
  const _xCss = (d.showXLabel !== '0' ? '' : 'display:none;') + ((_c => _c ? `color:${_c};` : '')(_safeGraphColor(d.xlabelColor || _lc)));
  const _solid = (c) => { const s = _safeGraphColor(c); return (s && !/gradient\(/i.test(s)) ? s : ''; };
  const colors = items.map(it => _solid(it && it.color));

  // freeLayout 절대 배치가 아닌 경우 height 고정 해제 → 범례 줄 수에 따라 자동 증가(가로 막대·꺾은선과 같은 꼴)
  if (block.style.position !== 'absolute') {
    block.style.height = 'auto';
  }

  const _tf = (o) => (o[0] !== '0.00' || o[1] !== '0.00') ? ` transform="translate(${o[0]} ${o[1]})"` : '';
  let tagsHTML = '';
  const _tagRank = d.pieRank === '1', _tagName = d.pieName === '1';
  if (_tagRank || _tagName) {
    const ranks = window.GRAPH_PIE_GEOM.pieRanks(_vals);
    const plan = window.GRAPH_PIE_GEOM.pieTagPlan(geo, { tags: items.map(it => it && it.pieTag) });
    const _side = 1000 + 2 * _m;
    const _at = (v) => ((v + _m) / _side * 100).toFixed(2);   // viewBox 좌표 → 덧층 정사각의 %
    /* 1013t1C3 고침 — 라벨마다 «그 조각 안에서 쓸 수 있는 사각형»(pieTagRoom 의 가장 넓은 것 · 덧층 정사각의 %)을 인라인 변수 둘로 싣는다: 읽는 자 = css/editor-graph.css 의 max-width / max-height.
         기하에서만 나온 값이라 «두 번 그려 같다»·저장본에 실려도 된다(JS 없는 내보내기에서도 라벨이 제 조각을 안 넘는다). 실제 글자를 잰 결과(grbPieFitTags)는 다른 변수(저장에서 걷힘)에 산다. */
    const room = window.GRAPH_PIE_GEOM.pieTagRoom(geo);
    const _pc = (v) => (Math.floor(v / _side * 10000) / 100).toFixed(2);
    tagsHTML = `<div class="grb-pie-tags" style="width:${chartH}px;font-size:${labelSize}px">` + items.map((it, i) =>
      `<div class="grb-pie-tag" style="left:${_at(plan[i].x)}%;top:${_at(plan[i].y)}%;--grb-pie-box-w:${_pc(room[i].boxes[room[i].best].w)}%;--grb-pie-box-h:${_pc(room[i].boxes[room[i].best].h)}%${plan[i].show ? '' : ';display:none'}">`
      + (_tagRank ? `<span class="grb-pie-rank">${ranks[i] > 0 ? ranks[i] + '위' : ''}</span>` : '')
      + (_tagName ? `<span class="grb-pie-name">${_escGraphHtml(it && it.label)}</span>` : '') + `</div>`).join('') + `</div>`;
  }
  const slices = geo.paths.map((p, i) => `<path class="grb-pie-slice" d="${p}"${_tf(geo.offsets[i])}${colors[i] ? ` style="fill:${colors[i]};fill-opacity:1"` : ''}/>`).join('');
  const emptyEl = geo.empty ? `<circle class="grb-pie-empty" cx="500" cy="500" r="498" fill="none" stroke="currentColor" stroke-opacity="0.4" stroke-width="1.5" stroke-dasharray="6 6" vector-effect="non-scaling-stroke"/>` : '';
  const legend = items.map((it, i) => `<span class="grb-pie-legend-item"><span class="grb-pie-dot"${colors[i] ? ` style="background:${colors[i]};opacity:1"` : ''}></span>`
    + `<span class="grb-pie-label" style="${_xCss}">${_escGraphHtml(it && it.label)}</span>`
    + `<span class="grb-pie-val" style="${_vCss}">${pcts[i]}%</span></span>`).join('');
  /* 1017t1f1 — 원형↔범례 간격. 키(dataset.pieLegendGap)가 있을 때만 인라인 margin-top 을 더한다(키 없으면 한 글자도 안 바뀐다 ⇒ G0 골든 유지).
     패널(prop-graph.js)이 기본값(PIE_LEG_GAP_DEFAULT)과 같으면 키를 지우므로, 여기 올 때는 늘 «기본과 다른» 값이다. */
  const _lg = parseInt(d.pieLegendGap);
  const _legGapCss = (d.pieLegendGap !== undefined && Number.isFinite(_lg))
    ? `;margin-top:${Math.min(L.PIE_LEG_GAP_MAX, Math.max(L.PIE_LEG_GAP_MIN, _lg))}px` : '';
  const _shStyle = _pieShadowFilterStyle(d);   // 1017t1f4 — 키 없으면 '' = 프리셋 CSS 그대로(바이트 무변)
  block.innerHTML = `
      <div class="grb-pie-wrap" style="height:${chartH}px">
        <svg class="grb-pie-svg" viewBox="${viewBox}" preserveAspectRatio="xMidYMid meet"${_shStyle}>${slices}${emptyEl}</svg>${tagsHTML}
      </div>
      ${d.pieLegendOff === '1' ? '' : `<div class="grb-pie-legend" style="font-size:${labelSize}px${_legGapCss}">${legend}</div>`}`;
  /* ★★★t4-18 의 ★부작용 — ★이름을 붙였다: `LEGEND-OFF-KILLS-NAME-EDIT-01` (261022 · 지디가 ★읽어서 찾음)
     ★`.grb-pie-label`(범례 안 항목 이름)은 ★★`GRB_CAT_LABEL_SEL`(:808)에 ★들어 있다 ⇒ ★★더블클릭 ★캔버스 편집 대상이다
       (★:1031 주석도 그렇게 적었다: 「범례 = 카테고리 라벨(.grb-pie-label · ★더블클릭 편집 대상) + 비율 %」).
     ⇒ ★★★범례를 ★끄면 ★그 요소가 ★사라져 ★★«이름을 캔버스에서 고치는 길»도 ★같이 ★없어진다.
       ⛔「기능을 껐다」가 아니라 ★★「★다른 기능의 ★입구를 ★같이 껐다」다.
     ★★그 길을 ★돌려주는 것이 ★★t4-17(「조각 안 ★순위·이름 라벨을 ★캔버스에서 직접 수정」)이다 —
       ★조각 안 이름(`.grb-pie-name`)은 ★범례와 ★★같은 `items[i].label` 이라 ★★그 하나를 ★편집 대상에 ★더하면 된다.
       ★선례 = ★`:498~502`(K8⒤ — 꺾은선 ★카테고리 라벨만 `pointer-events:auto`) ＋ ★`_bindGraphLabelEdit`(위임 한 번).
     ⛔그리고 ★`.grb-pie-rank`(「n위」)는 ★★편집 대상이 ★아니다 — `graph-pie-geom.js:129 pieRanks(values)` 가
       ★값 내림차순으로 ★계산한다. ★손으로 고치면 ★값과 ★어긋난다.
     ★재는 자 = tests/unit/pie-legend-toggle.test.mjs ★T5(지금은 `todo` — ★t4-17 이 닫으면 ★초록이 된다) */
  /* ★t4-18 — `pieLegendOff === '1'` 일 때만 ★범례를 ★뺀다. ⛔키가 ★없으면 ★한 글자도 안 바뀐다(옛 저장본·G0 골든 무변).
     ⚠️꺼도 ★「범례 간격」 칸은 ★남는다 — 그 칸을 같이 숨길지는 ★UI 결정(현빈)이라 ★안 건드렸다. */
  if (_selIdx >= 0) grbPieSelect(block, _selIdx);
}
/* ── 1012t1G2 · G3 · G4 「SVG 를 그래프 모양으로」 ─────────────────────────
 * 세로 막대의 «덧 길» — dataset.barShape(실루엣) 또는 items[i].segments(마디)가 있을 때만 온다. chartType 은 'bar-v' 그대로.
 * 칸 틀(값 라벨 · 플롯 · 카테고리 라벨)·두께·간격·축/격자/꺾은선 오버레이는 옛 세로 막대와 «같은 함수»(_barVSettings · _barVPlotGeom)를 쓴다
 *   ⇒ 눈금선이 값과 맞는다. 다른 것은 분모뿐: 모양이면 dataset.fillMax(기본 100), 사각 마디면 옛 max(items).
 * 칸 안(실루엣 마스크 · 채움 층 · 마디)은 graph-shape.js shapeColsHTML 이 만든다. 사용자 글자는 _escGraphHtml · 색은 _safeGraphColor 만 지난다(E152). */
function _renderGraphShape(block, { items, chartH, labelSize, valSize }) {
  const d = block.dataset, GS = window.GRAPH_SHAPE;
  const _lc = d.labelColor || '';
  const _vCss = (d.showVLabel !== '0' ? '' : 'display:none;') + ((_c => _c ? `color:${_c};` : '')(_safeGraphColor(d.vlabelColor || _lc)));
  const _xInk = (_c => _c ? `color:${_c};` : '')(_safeGraphColor(d.xlabelColor || _lc));   // 카테고리 라벨 색(소독 뒤) — 사각 쌓기 마디 라벨도 같은 값을 탄다
  const _xCss = (d.showXLabel !== '0' ? '' : 'display:none;') + _xInk;
  const _bs = _barVSettings(block, items.length);
  const _vSize = _bs.pctSize ?? valSize;
  const blockSvg = GS.shapeSvgOf(d.barShape, d.shapeSvg);
  /* 값의 정본(마디가 있으면 그 합) · 분모 · 눈금 상한 — graph-shape.js fillPlan «한 자리»(graphFillModel 도 같은 것을 부른다 ⇒ data-fill = 모델 ratio).
     눈금 상한은 _barVPlotGeom 과 같은 _niceScale(maxVal) 이다(같은 함수 · 같은 인자). */
  const plan = GS.fillPlan(d, items, _niceScale);
  const vItems = plan.vItems, maxVal = plan.max;
  const _g = _barVPlotGeom(block, vItems, { maxVal, labelSize, vSize: _vSize, bs: _bs });
  const _barsStyle = (_g.on ? (_bs.barsStyle || ';') + _g.barsExtra : _bs.barsStyle) + (blockSvg ? `;--grb-shape:${GS.shapeMaskUrl(blockSvg)}` : '');
  const _sg = parseInt(d.segGap);
  block.innerHTML = `
      <div class="grb-bars-v" style="height:${chartH}px${_barsStyle}">${GS.shapeColsHTML(vItems, {
        esc: _escGraphHtml, color: _safeGraphColor, blockShape: !!blockSvg, blockSvg,
        boxFrac: plan.boxFrac, ratioOf: (v) => GS.fillRatio(v, plan.denom),
        blockBar: _safeGraphColor(d.vBarColor), trackColor: d.trackColor, segGap: Number.isFinite(_sg) ? _sg : NaN,
        labelSize, vSize: _vSize, vCss: _vCss, xCss: _xCss, xInk: _xInk, lhCss: _g.lhCss, colMin: _bs.colMin, fillW: _bs.fillW,
      })}${_g.gridLayerHTML()}${_g.overlayHTML()}
      </div>`;
}
/* 유형 등록표 — 새 그래프 유형은 여기 한 줄(이름 → 그리는 함수)로 붙는다. 표에 없는 유형은 아래 기존 사슬(세로·꺾은선·비교·가로)이 그대로 그린다. */
const GRAPH_RENDERERS = Object.assign(Object.create(null), { pie: _renderPie, donut: _renderPie, radial: (b, ctx) => window.renderGraphRadial?.(b, ctx) });   // 원형 없는 표 — 'constructor' 같은 유형 이름이 상속 함수를 부르지 않게
function _renderGraphBody(block) {
  const items      = JSON.parse(block.dataset.items || '[]');
  const chartType  = block.dataset.chartType  || 'bar-v';
  // bar-pair(2시리즈)의 value2까지 포함해 스케일 산출 — 타 차트는 value2 없음(0)이라 영향 없음
  const maxVal     = Math.max(...items.flatMap(i => [i.value || 0, i.value2 || 0]), 1);
  const chartH     = parseInt(block.dataset.chartHeight) || 240;
  const labelSize  = parseInt(block.dataset.labelSize)   || window.GRAPH_LIMITS.LABEL_SIZE_DEFAULT;   // 패널과 같은 한 자리(graph-limits.js · 값 20 그대로)
  const valSize    = Math.round(labelSize * 1.07);

  const _r = GRAPH_RENDERERS[chartType]; if (_r) return _r(block, { items, chartH, labelSize, valSize });

  if (chartType === 'bar-v') {
    if (window.GRAPH_SHAPE.usesShape(block.dataset, items)) return _renderGraphShape(block, { items, chartH, labelSize, valSize });   // 1012t1G2·G3·G4 — 키가 없으면 아래 옛 분기 그대로(바이트 무변)
    // 값/카테고리 라벨 표시·색 — line 차트와 동일 시맨틱 (이전엔 bar에서 미반영되던 버그)
    const _lc = block.dataset.labelColor || '';
    const _vCss = (block.dataset.showVLabel !== '0' ? '' : 'display:none;') + ((_c => _c ? `color:${_c};` : '')(_safeGraphColor(block.dataset.vlabelColor || _lc)));
    const _xCss = (block.dataset.showXLabel !== '0' ? '' : 'display:none;') + ((_c => _c ? `color:${_c};` : '')(_safeGraphColor(block.dataset.xlabelColor || _lc)));
    const _bs = _barVSettings(block, items.length);
    const _vSize = _bs.pctSize ?? valSize;
    const _blockBar = _safeGraphColor(block.dataset.vBarColor);
    const _g = _barVPlotGeom(block, items, { maxVal, labelSize, vSize: _vSize, bs: _bs });   // GR2·GR3 — 꺼져 있으면 아래 조각 전부 ''
    const _barsStyle = _g.on ? (_bs.barsStyle || ';') + _g.barsExtra : _bs.barsStyle;
    block.innerHTML = `
      <div class="grb-bars-v" style="height:${chartH}px${_barsStyle}">
        ${items.map(item => {
          const pct = _g.pct(item.value);
          const fillStyle = pct === 0 ? 'height:4px;opacity:0.25;border-style:dashed;' : `height:${pct}%;`;
          // 바 개별색 — item.color 있으면 인라인 background로 CSS 프리셋(colorful nth-child 포함) 우선
          const _bc = _safeGraphColor(item.color) || _blockBar; const colorStyle = _bc ? `background:${_bc};` : '';
          return `
            <div class="grb-bar-col"${_bs.colMin ? ` style="${_bs.colMin}"` : ''}>
              <div class="grb-bar-val-label" style="font-size:${_vSize}px;${_vCss}${_g.lhCss}">${_escGraphHtml(item.value)}</div>
              <div class="grb-bar-fill-wrap">
                <div class="grb-bar-fill" style="${fillStyle}${_bs.fillW}${colorStyle}"></div>
              </div>
              <div class="grb-bar-label" style="font-size:${labelSize}px;${_xCss}${_g.lhCss}">${_escGraphHtml(item.label)}</div>
            </div>`;
        }).join('')}${_g.gridLayerHTML()}${_g.overlayHTML()}
      </div>`;
  } else if (chartType === 'line') {
    // ── 꺾은선 (line) — SVG polyline + circle data points
    const strokeWidth = parseInt(block.dataset.strokeWidth) || 3;
    const pointRadius = parseInt(block.dataset.pointRadius) || 5;
    const padXL       = parseInt(block.dataset.padX) || window.GRAPH_LIMITS.LINE_PADX_DEFAULT;   // 패널과 같은 한 자리(값 16 그대로 · SVG 가상폭 단위)
    const padTop      = Math.round(valSize * 1.4) + 8;
    const padBottom   = Math.round(labelSize * 1.4) + 8;

    if (block.style.position !== 'absolute') {
      block.style.height = 'auto';
    }

    // 안전 가드: 빈 데이터
    if (items.length === 0) {
      block.innerHTML = `<div class="grb-line-empty" style="height:${chartH}px"></div>`;
      return;
    }

    const innerW = 1000; // viewBox 기준 가상폭, CSS로 100% 늘림
    const innerH = chartH;
    const plotL  = padXL;
    const plotR  = innerW - padXL;
    const plotT  = padTop;
    const plotB  = innerH - padBottom;
    const plotW  = Math.max(1, plotR - plotL);
    const plotH  = Math.max(1, plotB - plotT);
    const n      = items.length;

    // 1개 점일 때는 중앙에 단일 점만
    const xOf = i => (n === 1) ? (plotL + plotW / 2) : plotL + (plotW * i) / (n - 1);
    const yOf = v => {
      const ratio = maxVal <= 0 ? 0 : (v / maxVal);
      return plotB - plotH * Math.max(0, Math.min(1, ratio));
    };

    const points = items.map((it, i) => ({ x: xOf(i), y: yOf(it.value), v: it.value, label: it.label }));
    const polyPoints = points.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

    // U9(BL-BOL-03): 곡선(스무드) 모드 — Catmull-Rom → cubic bezier. 온도 상승/냉각 곡선(temp-curve) 재현용.
    const smooth = block.dataset.lineSmooth === '1' && points.length >= 3;
    const _smoothD = (pts) => {
      let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
      for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
        const c1x = p1.x + (p2.x - p0.x) / 6, c1y = p1.y + (p2.y - p0.y) / 6;
        const c2x = p2.x - (p3.x - p1.x) / 6, c2y = p2.y - (p3.y - p1.y) / 6;
        d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
      }
      return d;
    };
    const smoothD = smooth ? _smoothD(points) : '';

    // %-좌표 (오버레이 HTML 점/라벨 배치용)
    const overlayItems = points.map((p, i) => {
      const leftPct  = (p.x / innerW) * 100;
      const topPct   = (p.y / innerH) * 100;
      const yLabelTop = (plotB + 4) / innerH * 100;
      const yValTop  = Math.max(0, (p.y - valSize - pointRadius - 4)) / innerH * 100;
      return { p, i, leftPct, topPct, yLabelTop, yValTop };
    });

    // 선/면 색상 분리 — lineColor가 선(stroke)·점, fillColor가 면(area). fallback은 barColor.
    // CSS preset rule이 stroke를 var()로 박아 SVG attribute를 덮어씀 → inline style로 우선순위 강제
    const lineColor = _safeGraphColor(block.dataset.lineColor || block.dataset.barColor || '');   // E152 — 색 문자열은 검증기를 지나서만 속성으로
    const fillColor = _safeGraphColor(block.dataset.fillColor || block.dataset.barColor || '');
    const colorAttr = lineColor ? ` style="stroke:${lineColor}"` : '';
    const pointInlineStyle = lineColor ? `background:${lineColor};border-color:${lineColor};` : '';

    // T10: 면 채우기 옵션 (dataset.fillArea === '1')
    const fillArea = block.dataset.fillArea === '1';
    const fillAlpha = Math.max(0, Math.min(1, parseFloat(block.dataset.fillAlpha) || 0.18));

    const baselineY = plotB.toFixed(1);

    // 면 채우기 polygon: polyPoints + (lastX, baselineY) + (firstX, baselineY)로 닫음
    const areaEl = (fillArea && n >= 2) ? (() => {
      const firstX = points[0].x.toFixed(1);
      const lastX  = points[points.length - 1].x.toFixed(1);
      const fillAttr = fillColor
        ? `fill="${fillColor}" fill-opacity="${fillAlpha}"`
        : `fill="currentColor" fill-opacity="${fillAlpha}" style="color:var(--ui-accent-primary,#3b82f6)"`;
      if (smooth) {
        return `<path class="grb-line-area" d="${smoothD} L ${lastX} ${baselineY} L ${firstX} ${baselineY} Z" ${fillAttr} stroke="none"/>`;
      }
      const areaPoints = `${polyPoints} ${lastX},${baselineY} ${firstX},${baselineY}`;
      return `<polygon class="grb-line-area" points="${areaPoints}" ${fillAttr} stroke="none"/>`;
    })() : '';

    const polyEl = n >= 2
      ? (smooth
        ? `<path class="grb-line-path" d="${smoothD}" fill="none" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"${colorAttr}/>`
        : `<polyline class="grb-line-path" points="${polyPoints}" fill="none" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"${colorAttr}/>`)
      : '';

    const pointDots = overlayItems.map(o =>
      `<div class="grb-line-point-dot" style="left:${o.leftPct.toFixed(2)}%;top:${o.topPct.toFixed(2)}%;width:${pointRadius * 2}px;height:${pointRadius * 2}px;${pointInlineStyle}"></div>`
    ).join('');
    // 라벨 색상 + 표시 옵션 (vlabel = 값, xlabel = 카테고리)
    const labelColor = block.dataset.labelColor || '';
    // vlabel(값)/xlabel(카테고리) 별도 색상 — 개별 set 안 됐으면 labelColor fallback
    const vlabelColor = block.dataset.vlabelColor || labelColor;
    const xlabelColor = block.dataset.xlabelColor || labelColor;
    const showVLabel = block.dataset.showVLabel !== '0';  // default 보임
    const showXLabel = block.dataset.showXLabel !== '0';  // default 보임
    const vlabelColorCss = _safeGraphColor(vlabelColor) ? `color:${_safeGraphColor(vlabelColor)};` : '';   // E152
    const xlabelColorCss = _safeGraphColor(xlabelColor) ? `color:${_safeGraphColor(xlabelColor)};` : '';
    const vlabelDisp = showVLabel ? '' : 'display:none;';
    const xlabelDisp = showXLabel ? '' : 'display:none;';
    // ★1017t1f5 — 값 라벨 «개별 위치»(items[i].vDx/vDy, px). 0(또는 없음)이면 키를 안 달아 옛 바이트 그대로.
    //   translate 는 transform(가운데 정렬 translate(-50%,0))과 «따로 노는» 속성 — 어노테이션 라벨과 같은 길(js/blocks/annotation-block.js annotApplyLabelOffset).
    const _vOffCss = (it) => {
      const L = window.GRAPH_LIMITS;
      const clamp = (v) => Math.min(L.VLABEL_OFFSET_MAX, Math.max(L.VLABEL_OFFSET_MIN, Math.round(v)));
      const dx = Number(it && it.vDx) || 0, dy = Number(it && it.vDy) || 0;
      return (dx || dy) ? `translate:${clamp(dx)}px ${clamp(dy)}px;` : '';
    };
    const labelsHTML = overlayItems.map(o =>
      `<div class="grb-line-vlabel" style="left:${o.leftPct.toFixed(2)}%;top:${o.yValTop.toFixed(2)}%;font-size:${valSize}px;${vlabelColorCss}${vlabelDisp}${_vOffCss(items[o.i])}">${_escGraphHtml(o.p.v)}</div>
       <div class="grb-line-xlabel" style="left:${o.leftPct.toFixed(2)}%;top:${o.yLabelTop.toFixed(2)}%;font-size:${labelSize}px;${xlabelColorCss}${xlabelDisp}">${_escGraphHtml(o.p.label)}</div>`   /* E150 — 사용자 글자는 이스케이프(막대 셋과 같은 _escGraphHtml). 옛: `<b>` 가 태그로 읽혔다 */
    ).join('');

    const _vSelIdx = _grbVLabelMarkIndex(block);   // ★1017t1f5 — 다시 그리기 «전»의 값 라벨 «고르기» 표식(조각 고르기 _grbPieMarkIndex 와 같은 길)
    block.innerHTML = `
      <div class="grb-line-wrap" style="height:${chartH}px">
        <svg class="grb-line-svg" viewBox="0 0 ${innerW} ${innerH}" preserveAspectRatio="none">
          <line class="grb-line-axis" x1="${plotL}" y1="${baselineY}" x2="${plotR}" y2="${baselineY}" stroke-width="1"/>
          ${areaEl}
          ${polyEl}
        </svg>
        <div class="grb-line-overlay">${pointDots}${labelsHTML}</div>
      </div>`;
    if (_vSelIdx >= 0) grbVLabelPick(block, _vSelIdx);   // 다시 그린 뒤 같은 색인에 되붙인다(항목 수가 줄었으면 자동으로 안 붙는다 — querySelectorAll 범위 밖)
  } else if (chartType === 'bar-pair') {
    // ── U9(BL-BOL-03): 2시리즈 비교 세로 막대 (자사 vs 경쟁) — items: [{label, value, value2}]
    const _lc = block.dataset.labelColor || '';
    const _vCss = (block.dataset.showVLabel !== '0' ? '' : 'display:none;') + ((_c => _c ? `color:${_c};` : '')(_safeGraphColor(block.dataset.vlabelColor || _lc)));
    const _xCss = (block.dataset.showXLabel !== '0' ? '' : 'display:none;') + ((_c => _c ? `color:${_c};` : '')(_safeGraphColor(block.dataset.xlabelColor || _lc)));
    const barColor  = _safeGraphColor(block.dataset.barColor  || '');   // E152 — 범례 점 · 막대 채움 모두 이 값
    const barColor2 = _safeGraphColor(block.dataset.barColor2 || '') || '#c9c9c9';
    const sA = block.dataset.seriesA || '';
    const sB = block.dataset.seriesB || '';
    const legend = (sA || sB) ? `
      <div class="grb-pair-legend" style="font-size:${labelSize}px;${_xCss}">
        ${sA ? `<span class="grb-pair-legend-item"><span class="grb-pair-dot"${barColor ? ` style="background:${barColor}"` : ''}></span>${_escGraphHtml(sA)}</span>` : ''}
        ${sB ? `<span class="grb-pair-legend-item"><span class="grb-pair-dot" style="background:${barColor2}"></span>${_escGraphHtml(sB)}</span>` : ''}
      </div>` : '';
    const _bs = _barVSettings(block, items.length);
    const _vSize = _bs.pctSize ?? valSize;
    const bar = (v, color, extraClass) => {
      const pct = !v ? 0 : Math.max(1, Math.round((v / maxVal) * 100));
      const fillStyle = pct === 0 ? 'height:4px;opacity:0.25;border-style:dashed;' : `height:${pct}%;`;
      return `
        <div class="grb-pair-series">
          <div class="grb-bar-val-label" style="font-size:${_vSize}px;${_vCss}">${_escGraphHtml(v ?? 0)}</div>
          <div class="grb-bar-fill${extraClass}" style="${fillStyle}${_bs.fillW}${color ? `background:${color};` : ''}"></div>
        </div>`;
    };
    block.innerHTML = `${legend}
      <div class="grb-bars-v" style="height:${chartH}px${_bs.barsStyle}">
        ${items.map(item => `
          <div class="grb-bar-col"${_bs.colMin ? ` style="${_bs.colMin}"` : ''}>
            <div class="grb-bar-fill-wrap grb-pair-wrap">
              ${bar(item.value, barColor, '')}
              ${bar(item.value2, barColor2, ' grb-bar-fill-b')}
            </div>
            <div class="grb-bar-label" style="font-size:${labelSize}px;${_xCss}">${_escGraphHtml(item.label)}</div>
          </div>`).join('')}
      </div>`;
  } else {
    const barThickness = parseInt(block.dataset.barThickness) || 0;
    const padX         = parseInt(block.dataset.padX)         || 0;
    const barColor     = _safeGraphColor(block.dataset.barColor || '');   // E152
    const itemGap      = parseInt(block.dataset.itemGap)      || 24;
    const pctSize      = parseInt(block.dataset.pctSize)      || Math.round(labelSize * window.GRAPH_LIMITS.PCT_SIZE_FACTOR);   // 패널과 같은 식(값 ×3 그대로)
    const trackH       = barThickness || window.GRAPH_LIMITS.BAR_THICKNESS_DEFAULT;   // E99 — 패널·세로·비교와 같은 기본 한 자리
    const trackR       = Math.round(trackH / 2);
    const trackStyle   = `height:${trackH}px;border-radius:${trackR}px;`;
    const fillStyle    = `width:__PCT__;border-radius:${trackR}px;${barColor ? `background:${barColor};` : ''}`;
    // 값/카테고리 라벨 표시·색 — line 차트와 동일 시맨틱 (이전엔 bar-h에서 미반영되던 버그)
    const _lc = block.dataset.labelColor || '';
    const _vCss = (block.dataset.showVLabel !== '0' ? '' : 'display:none;') + ((_c => _c ? `color:${_c};` : '')(_safeGraphColor(block.dataset.vlabelColor || _lc)));
    const _xCss = (block.dataset.showXLabel !== '0' ? '' : 'display:none;') + ((_c => _c ? `color:${_c};` : '')(_safeGraphColor(block.dataset.xlabelColor || _lc)));

    // freeLayout 절대 배치가 아닌 경우 height 고정 해제 → 콘텐츠 크기에 따라 자동 증가
    if (block.style.position !== 'absolute') {
      block.style.height = 'auto';
    }

    block.innerHTML = `
      <div class="grb-bars-h" style="padding:0 ${padX}px;gap:${itemGap}px">
        ${items.map(item => {
          const pct = item.value === 0 ? 0 : Math.max(1, Math.min(100, Math.round(item.value)));
          const displayVal = Number.isInteger(item.value) ? item.value + '%' : item.value;
          const hFillExtra = pct === 0 ? 'width:4px;opacity:0.25;border-style:dashed;' : '';
          // 바 개별색 — item.color가 블록단위 barColor·CSS 프리셋보다 우선(뒤 선언이 이김)
          const _bc = _safeGraphColor(item.color); const colorStyle = _bc ? `background:${_bc};` : '';
          return `
            <div class="grb-bar-row">
              <div class="grb-bar-h-pct" style="font-size:${pctSize}px;${_vCss}">${_escGraphHtml(displayVal)}</div>
              <div class="grb-bar-h-desc" style="font-size:${Math.round(labelSize * 1.4)}px;${_xCss}">${_escGraphHtml(item.label)}</div>
              <div class="grb-bar-h-track" style="${trackStyle}">
                <div class="grb-bar-h-fill" style="${fillStyle.replace('__PCT__', pct + '%')}${hFillExtra}${colorStyle}"></div>
              </div>
            </div>`;
        }).join('')}
      </div>`;
  }
}

function applyDividerStyle(block) {
  const hr      = block.querySelector('.dvd-line');
  if (!hr) return;
  const weight  = block.dataset.lineWeight  || '1';
  const style   = block.dataset.lineStyle   || 'solid';
  const color   = block.dataset.lineColor   || '#cccccc';
  const padV    = block.dataset.padV        || '30';
  const padH    = parseInt(block.dataset.padH) || 0;
  const dir     = block.dataset.lineDir     || 'horizontal';
  const lineLen = parseInt(block.dataset.lineLength) || 80;
  // padH가 콘텐츠 폭의 절반보다 커도 그대로 적용 (사용자 의도). 라인은 box-sizing border-box로 음수 폭 시 안 보일 수 있음.

  // U7(BL-CDD-06): 페이스라인 — 눈금 레일(tick) + 선택 마커. 수평 전용.
  // 기존 마커는 항상 걷어낸 뒤 tick+markerPos일 때만 다시 그린다(스타일 전환 시 잔재 방지).
  block.querySelector('.dvd-marker')?.remove();
  if (style === 'tick' && dir !== 'vertical') {
    const tickH   = parseInt(block.dataset.tickHeight) || 12;
    const tickGap = parseInt(block.dataset.tickGap) || 24;
    const w = Math.max(1, parseInt(weight) || 1);
    hr.style.cssText = `border:none;height:${tickH}px;` +
      `background:repeating-linear-gradient(90deg, ${color} 0 ${w}px, transparent ${w}px ${tickGap}px);`;
    block.style.padding = `${padV}px ${padH}px`;
    block.style.display = '';
    block.style.position = 'relative';
    const mp = parseFloat(block.dataset.markerPos);
    if (Number.isFinite(mp) && mp >= 0 && mp <= 100) {
      const mc = block.dataset.markerColor || '#2d6fe8';
      const ms = parseInt(block.dataset.markerSize) || 10;
      const marker = document.createElement('span');
      marker.className = 'dvd-marker';
      marker.style.cssText = `position:absolute;left:calc(${padH}px + (100% - ${padH * 2}px) * ${mp / 100});` +
        `top:50%;transform:translate(-50%,-50%);width:${ms}px;height:${ms}px;border-radius:50%;` +
        `background:${mc};pointer-events:none;`;
      block.appendChild(marker);
    }
    return;
  }
  if (dir === 'vertical') {
    hr.style.cssText = `border-left:${weight}px ${style} ${color}; border-top:none; width:0; height:${lineLen}px;`;
    block.style.padding = `${padV}px ${padH}px`;
    block.style.display = 'flex';
    block.style.justifyContent = 'center';
  } else {
    /* ★가로 «너비»(현빈 2026-10-01) — dataset.lineWidth(px)가 있을 때만 가운데로 줄인다. 없으면 지금처럼 전폭(옛 블록 무변화).
       ⛔lineLength 를 쓰지 않는다 — 옛 가로 디바이더에도 기본값 80 이 박혀 있어 그걸 너비로 읽으면 전부 줄어든다. */
    const lineW = parseInt(block.dataset.lineWidth) || 0;
    hr.style.cssText = `border-top:${weight}px ${style} ${color};` + (lineW > 0 ? `width:${lineW}px;max-width:100%;margin-left:auto;margin-right:auto;` : '');
    block.style.padding = `${padV}px ${padH}px`;
    block.style.display = '';
  }
}

const ASSET_PRESETS = {
  standard: { height: 780 },
  square:   { height: 860 },
  tall:     { height: 1032 },
  wide:     { height: 575 },
  small:    { width: 300, height: 300 },
  logo:     { width: 200, height: 64 },
};

// 색 문자열 → 상대 휘도(0~1). 인식 불가/투명이면 null.
// block-factory _colorLuminance 미러 — 블록 렌더러 테마어웨어 공용 (2026-07-04 제니 발주)
function colorLuminance(str) {
  if (!str || typeof str !== 'string') return null;
  const s = str.trim();
  let r, g, b;
  let m = s.match(/^#([0-9a-fA-F]{3})$/);
  if (m) { r = parseInt(m[1][0] + m[1][0], 16); g = parseInt(m[1][1] + m[1][1], 16); b = parseInt(m[1][2] + m[1][2], 16); }
  if (r === undefined) {
    m = s.match(/^#([0-9a-fA-F]{6})/);
    if (m) { r = parseInt(m[1].slice(0, 2), 16); g = parseInt(m[1].slice(2, 4), 16); b = parseInt(m[1].slice(4, 6), 16); }
  }
  if (r === undefined) {
    m = s.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (m) { r = +m[1]; g = +m[2]; b = +m[3]; }
  }
  if (r === undefined) return null;
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}
// 블록의 배경 컨텍스트 휘도: 자체 bg가 유효하면 그것, 아니면 섹션 bg.
function blockContextLuminance(block, selfBg) {
  const own = colorLuminance(selfBg);
  if (own !== null) return own;
  const sec = block.closest?.('.section-block');
  if (!sec) return null;
  return colorLuminance(sec.style.backgroundColor || sec.style.background || sec.dataset.bg || '');
}

// 조상의 HTML5 드래그(draggable="true")를 «드래그하는 동안만» 끈다.
// ★공유화(2026-09-04 P2, PLAN-gridblock.md §5-B-4) — 원래 table-cell-select.js 안에 IIFE
//   전용으로 있었다(셀 사각 선택 드래그가 조상 .row 의 dragstart 로 새는 걸 막던 코드).
//   그리드 블록 열 경계 드래그(overlay-handles.js)가 «같은 문제»를 겪어 여기로 뽑았다.
//   동작은 원본과 완전히 동일(복붙, 로직 무변경) — table-cell-select.js 는 이제 이 함수를 호출만 한다.
// ⚠️draggable 조상은 하나가 아닐 수 있다(td → .row → .frame-block 등 체인) — closest() 로
//   가장 가까운 하나만 끄면 브라우저가 그 위 draggable 에서 dragstart 를 다시 잡는다.
//   ⇒ 체인 «전부» 끄고 «전부» 원래 값으로 복원한다. 안전망: blur 에도 복구(mouseup 을 못 받는 경우).
function suppressAncestorDrag(block) {
  const hosts = [];
  for (let el = block; el && el !== document.body; el = el.parentElement) {
    if (el.getAttribute && el.getAttribute('draggable') === 'true') hosts.push([el, el.getAttribute('draggable')]);
  }
  if (!hosts.length) return () => {};
  hosts.forEach(([el]) => el.setAttribute('draggable', 'false'));
  let done = false;
  const restore = () => {
    if (done) return;
    done = true;
    window.removeEventListener('blur', restore); // 리스너 누적 방지(mousedown 마다 등록됨)
    hosts.forEach(([el, was]) => {
      if (was === null) el.removeAttribute('draggable');
      else el.setAttribute('draggable', was);
    });
  };
  window.addEventListener('blur', restore);
  return restore;
}

// focus 된 contenteditable 요소의 내용 «전체»를 선택한다.
// ★원래 block-drag.js(텍스트·Enter진입·표 셀·모달)와 comparison-block.js 가 각자 5~8줄짜리
//   removeAllRanges→createRange→selectNodeContents→addRange 를 «손으로 복붙»해 쓰던 스니펫이다
//   (comparison-block.js 주석: "block-drag.js:617-624 미러"). 새 블록타입이 생길 때마다 또 베껴야 해서
//   배너(banner02)·그리드가 «빠진» 채로 나갔다 — 안내문구 위에 캐럿만 찍혀 타이핑이 이어붙었다
//   (사용자 관점 훑기 0920 U-26: 「강아지 간식제목을 입력합니다.」). 실행 메커니즘만 한 벌로 모은다.
// ⚠️«이 텍스트가 안내문구인가»의 «판정»은 여기 없다 — 블록마다 데이터모델이 달라서
//   (text-block = data-is-placeholder 마커 / banner02·grid·comparison = 기본문구 값-비교)
//   하나로 못 모은다. 판정은 각 호출자에 남기고 여기는 «전체선택 실행»만 한다.
// ⚠️focus() 직후 «동기»로 불러야 한다 — 비동기면 브라우저 기본 캐럿이 선택을 덮는다.
function selectAllEditableContents(el) {
  if (!el) return false;
  try {
    const range = document.createRange();
    range.selectNodeContents(el);
    const sel = window.getSelection();
    if (!sel) return false;
    sel.removeAllRanges();
    sel.addRange(range);
    return true;
  } catch (_) { return false; }
}

/* ★1020t1a — 더블클릭으로 켠 contenteditable 의 캐럿을 «누른 그 글자»에 꽂는다.
 *   현빈 원문(2026-10-20): 「컴패리전 블럭 더블클릭시 텍스트 수정하려는데 커서가 적절한 곳에 위치하지읺는 문제」
 *
 * ★«적절한 곳»은 취향이 아니라 ★이 앱의 관용이고, ★실측으로 정했다(1020t1a · 헤드리스 크롬 · 진짜 Input 더블클릭):
 *   대조군 ⑴ 텍스트블럭 본문 ⑵ 그리드 칸 줄(.grd-line) — 줌 40·100·200% ★여섯 칸 전부
 *     「캐럿 글자오프셋 − 누른 글자 인덱스 = ★0」, collapsed(낱말 선택 아님).
 *   비교 블럭은 ★같은 자로 ★36칸 전부 0 이 아니었다 — 칸 맨 앞(−4·−14) 또는 줄 끝(+10·+9).
 *
 * ★★좌표 변환을 ★«하지 않는다» — `caretRangeFromPoint` 는 ★뷰포트 좌표를 받고, 브라우저가
 *   CSS transform 을 ★스스로 지나 히트테스트한다. 비교 블럭엔 배율이 ★세 겹이지만
 *   (캔버스 줌 `#canvas-scaler` scale · `.cmp-inner` scale(`block._cmpScale`) · 강조칼럼 featScale)
 *   ★한 겹도 나눌 필요가 없다. ★실측이 그걸 말한다: 어긋남이 줌 40·100·200% 에서 ★똑같았다
 *   (−4 / −14 / +10 고정) ⇒ 어긋남이 배율에 ★안 비례한다 ⇒ ★좌표 변환이 원인이 아니다.
 *   ⛔`/ scale` 을 더하지 마라 — 그게 식이 네 벌로 갈리는 자리다(1020t1c 카드 색의 주범).
 *
 * ★점이 ★이 요소 «안»이 아니면 쓰지 않는다 — 안 그러면 ★옆 블럭 글자에 캐럿을 꽂는다
 *   (겹친 강조 칼럼·overlap 존이 있는 비교 블럭에서 실제로 닿는 자리다).
 * ★폴백은 «끝으로 모으기» — 선례 `_cvbBeginEdit`(canvas-block.js)·`_enterStickerEdit`(sticker-select.js) 와 같다.
 * ⚠️`focus()` 직후 «동기»로 불러야 한다 — `selectAllEditableContents` 와 같은 규약(비동기면 기본 캐럿이 덮는다).
 * ⚠️«안내문구인가»의 판정은 ★여기 없다 — 블록마다 데이터모델이 달라서(위 주석과 같은 까닭)
 *   호출자가 재고, 안내문구면 ★`selectAllEditableContents` 를 부른다.
 * 반환: 누른 점에 꽂았으면 true, 폴백으로 끝에 모았으면 false. */
function placeCaretAtClickPoint(el, e) {
  if (!el) return false;
  const sel = window.getSelection();
  if (!sel) return false;
  let r = null;
  if (e && Number.isFinite(e.clientX) && typeof document.caretRangeFromPoint === 'function') {
    try { r = document.caretRangeFromPoint(e.clientX, e.clientY); } catch (_) { r = null; }
  }
  const inEl = !!(r && r.startContainer && el.contains(r.startContainer));
  try {
    sel.removeAllRanges();
    if (inEl) { r.collapse(true); sel.addRange(r); return true; }
    const rr = document.createRange();
    rr.selectNodeContents(el);
    rr.collapse(false);
    sel.addRange(rr);
  } catch (_) {}
  return false;
}

/* ★1017t1c2 — js/block-drag.js 에서 ★옮겨 왔다(그 자리는 import 로 쓴다 · 사본 0).
   modal 슬롯 «글자 읽기» — contenteditable 의 div/br 를 «보이는 줄» 그대로의 \n 으로 바꾼다.
   ★innerText 를 쓰지 마라: Enter 두 번이 만드는 `가<div><br></div><div>나</div>` 를 "가\n\n\n나"(줄바꿈 «하나 더»)로 읽고,
     슬롯이 white-space:pre-wrap 인 지금은 그대로 그려져 편집 중 3줄이 blur 뒤 4줄이 된다(2026-10-03 적대QA).
   규칙: 블록(div/p)은 줄을 «시작»하고 끝나면 줄바꿈이 «대기»한다(뒤에 뭔가 올 때만 실제 줄바꿈).
         블록 안 «마지막» <br> 는 빈 줄의 자리표시일 뿐이라 줄을 더하지 않는다. 그 밖의 <br> 는 줄바꿈.
         끝의 줄바꿈은 떼어 낸다 — pre-wrap 은 끝 «\n 하나»를 줄로 안 그려 편집 중 줄 수와 갈린다.
   ★1017t1c2 — 비교(comparison) 블럭의 칸·헤더 글자(Enter 줄바꿈)도 이 한 벌을 쓴다(사본 0). */
function mdlReadText(host) {
  const BLOCK = /^(DIV|P|LI|H[1-6])$/;
  let out = '', pending = false;
  const atLineStart = () => out === '' || out.endsWith('\n');
  const walk = (n) => {
    for (const c of n.childNodes) {
      if (c.nodeType === 3) {
        const t = c.nodeValue.replace(/\r\n?/g, '\n').replace(/​/g, '');
        if (t === '') continue;
        if (pending) { out += '\n'; pending = false; }
        out += t;
      } else if (c.nodeType === 1) {
        if (c.tagName === 'BR') {
          const ph = BLOCK.test(n.tagName || '') && n !== host && !c.nextSibling;   // 블록 안 마지막 br = 자리표시
          if (!ph) { pending = false; out += '\n'; }
        } else if (BLOCK.test(c.tagName)) {
          if (pending || (!atLineStart())) { out += '\n'; }
          pending = false;
          walk(c);
          pending = true;
        } else walk(c);
      }
    }
  };
  walk(host);
  return out.replace(/\n+$/, '');
}

export {
  genId,
  getActorId,
  clearDropIndicators,
  clearLayerIndicators,
  clearSectionIndicators,
  clearLayerSectionIndicators,
  makeLabelItem,
  insertBeforeBottomGap,
  insertAfterSelected,
  insertAfterSelectedAsSibling,
  frameSelectedAsObject,
  settleRowInFreeFrame,
  effectiveSectionPadX,
  framePadXData,
  isInlineAbsolute,
  sectionPadX,
  applyBlockFullBleed,
  clearBlockFullBleed,
  isFlowAnchorBlock,
  findFlowAnchorSelected,
  showNoSelectionHint,
  showToast,
  getSectionAlign,
  GRAPH_DEFAULT_ITEMS,
  renderGraph,
  applyDividerStyle,
  ASSET_PRESETS,
  colorLuminance,
  blockContextLuminance,
  suppressAncestorDrag,
  selectAllEditableContents,
  placeCaretAtClickPoint,
  mdlReadText,
};

window.genId                      = genId;
window.getActorId                 = getActorId;
window.clearDropIndicators        = clearDropIndicators;
window.clearLayerIndicators       = clearLayerIndicators;
window.clearSectionIndicators     = clearSectionIndicators;
window.clearLayerSectionIndicators= clearLayerSectionIndicators;
window.makeLabelItem              = makeLabelItem;
window.insertBeforeBottomGap      = insertBeforeBottomGap;
window.insertAfterSelected        = insertAfterSelected;
window.frameSelectedAsObject      = frameSelectedAsObject;
window.insertAfterSelectedAsSibling = insertAfterSelectedAsSibling;
window.settleRowInFreeFrame       = settleRowInFreeFrame;
window.effectiveSectionPadX       = effectiveSectionPadX;
window.framePadXData              = framePadXData;
window.isInlineAbsolute           = isInlineAbsolute;
window.sectionPadX               = sectionPadX;        /* ★«조회» 물음 — ★template-system 이 쓴다 */
window.applyBlockFullBleed        = applyBlockFullBleed;
window.clearBlockFullBleed        = clearBlockFullBleed;
window.isFlowAnchorBlock          = isFlowAnchorBlock;
window.findFlowAnchorSelected     = findFlowAnchorSelected;
window.showNoSelectionHint        = showNoSelectionHint;
window.showToast                  = showToast;
window.getSectionAlign            = getSectionAlign;
window.GRAPH_DEFAULT_ITEMS        = GRAPH_DEFAULT_ITEMS;
window.renderGraph                = renderGraph;
window.grbPieSliceIndexAt         = grbPieSliceIndexAt;   // 1013t1C4 — 조각 고르기 셋(block-drag 클릭 · prop-graph 패널이 부른다)
window.grbPieSelected             = grbPieSelected;
window.grbPieSelect               = grbPieSelect;
window.grbPieHiddenNames          = grbPieHiddenNames;     // 1013t1C3 고침 2 — 좁아서 숨겨진 이름 수(패널 안내 줄이 읽는다)
window.grbVLabelPick              = grbVLabelPick;          // ★1017t1f5 — 꺾은선 값 라벨 고르기(prop-graph.js 항목 수 변경 시 해제용 · block-drag.js click 핸들러의 재적용용)
window.grbVLabelIndexAt           = grbVLabelIndexAt;       // ★1017t1f5(261018 고침) — 클릭 지점의 값 라벨 색인(block-drag.js isGraph click 핸들러가 읽는다)
window.grbPieFitTags              = grbPieFitTags;         // 1013t1C3 고침 — 조각 안 라벨을 재서 제 조각 안에 넣는다(canvas-contrast.js syncGraphTone 이 부른다)
window.applyDividerStyle          = applyDividerStyle;
window.ASSET_PRESETS              = ASSET_PRESETS;
window.suppressAncestorDrag       = suppressAncestorDrag;
window.selectAllEditableContents  = selectAllEditableContents;
window.placeCaretAtClickPoint     = placeCaretAtClickPoint;   // ★1020t1a — 더블클릭 캐럿 «한 벌»(비교 칸·헤더·줄이 쓴다)
