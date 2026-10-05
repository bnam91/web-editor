
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
import { state } from './globals.js';
import { isShapeFrame, resolveInsertFrame, anchorUnitOf } from './shape-frame.js';

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

/** el 이 뚫고 나가야 할 좌우 패딩(px). 뚫을 수 없는 자리면 0. */
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
  const _fr = parent.closest?.('.frame-block');
  if (_fr) {
    const _r = _fr.dataset?.radius;
    const _clips = _r !== undefined && _r !== '' && String(_r) !== '0';
    if (_clips) return 0;
  }
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
  const pos = el.style?.position;
  if (pos === 'absolute' || pos === 'fixed') return false;   // 플로팅 계열
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
  return frame;
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
  const fmt = (t) => String(t);
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
    const tickEls = axis ? ticks.map(t => `<div class="grb-ov-tick" style="position:absolute;right:100%;margin-right:6px;bottom:${((t / scaleMax) * 100).toFixed(4)}%;transform:translateY(50%);font-size:${tickFont}px;line-height:1;opacity:0.75;white-space:nowrap">${_escGraphHtml(fmt(t))}</div>`).join('') : '';
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
}
/* K8⒤ — 카테고리 라벨 캔버스 직접 편집(더블클릭). 저장 자리 = dataset.items[i].label 한 곳(패널 .grb-data-label-input 과 같은 키).
 *   라벨은 렌더마다 새로 만들어진다 ⇒ 블럭에 «위임» 한 번만 건다(요소 속성이라 복제·로드된 블럭은 첫 렌더에서 새로 건다).
 *   ⌘Z 한 번: 들어갈 때 ensureHistoryCheckpoint · 확정 뒤 pushHistory. Esc · 빈 글자 · 같은 글자 = 무변(다시 그려 원래 글자로).
 *   편집 중엔 block.editing — 공통 mousedown 드래그·삭제키 가드가 본다(그리드 줄 편집과 같은 꼴). */
/* 카테고리 라벨 «셋»(막대·비교 .grb-bar-label · 가로 .grb-bar-h-desc · 꺾은선 .grb-line-xlabel) — 항목마다 정확히 하나(숨김이어도 display:none 으로 있다)
   ⇒ 블럭 안 순서 = items 순서. 색인을 DOM 속성으로 안 박는다 — 렌더 바이트가 핀(graph-vpair 골든 · GR-W0 기준판)과 같게(회귀 실측: data-grb-idx 가 5 빨강). */
const GRB_CAT_LABEL_SEL = '.grb-bar-label, .grb-bar-h-desc, .grb-line-xlabel';
function _bindGraphLabelEdit(block) {
  if (block._grbLabelEditBound) return;
  block._grbLabelEditBound = true;
  block.addEventListener('dblclick', e => {
    const el = e.target?.closest?.(GRB_CAT_LABEL_SEL);
    if (!el || !block.contains(el) || el.isContentEditable) return;
    e.stopPropagation(); e.preventDefault();
    _graphLabelBeginEdit(block, el, [...block.querySelectorAll(GRB_CAT_LABEL_SEL)].indexOf(el));
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
    const val = (el.textContent || '').replace(/\s+/g, ' ').trim();
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
    if (ev.key === 'Enter') { ev.preventDefault(); ev.stopPropagation(); finish(true); }
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
function _renderGraphBody(block) {
  const items      = JSON.parse(block.dataset.items || '[]');
  const chartType  = block.dataset.chartType  || 'bar-v';
  // bar-pair(2시리즈)의 value2까지 포함해 스케일 산출 — 타 차트는 value2 없음(0)이라 영향 없음
  const maxVal     = Math.max(...items.flatMap(i => [i.value || 0, i.value2 || 0]), 1);
  const chartH     = parseInt(block.dataset.chartHeight) || 240;
  const labelSize  = parseInt(block.dataset.labelSize)   || window.GRAPH_LIMITS.LABEL_SIZE_DEFAULT;   // 패널과 같은 한 자리(graph-limits.js · 값 20 그대로)
  const valSize    = Math.round(labelSize * 1.07);

  if (chartType === 'bar-v') {
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
    const overlayItems = points.map(p => {
      const leftPct  = (p.x / innerW) * 100;
      const topPct   = (p.y / innerH) * 100;
      const yLabelTop = (plotB + 4) / innerH * 100;
      const yValTop  = Math.max(0, (p.y - valSize - pointRadius - 4)) / innerH * 100;
      return { p, leftPct, topPct, yLabelTop, yValTop };
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
    const labelsHTML = overlayItems.map(o =>
      `<div class="grb-line-vlabel" style="left:${o.leftPct.toFixed(2)}%;top:${o.yValTop.toFixed(2)}%;font-size:${valSize}px;${vlabelColorCss}${vlabelDisp}">${_escGraphHtml(o.p.v)}</div>
       <div class="grb-line-xlabel" style="left:${o.leftPct.toFixed(2)}%;top:${o.yLabelTop.toFixed(2)}%;font-size:${labelSize}px;${xlabelColorCss}${xlabelDisp}">${_escGraphHtml(o.p.label)}</div>`   /* E150 — 사용자 글자는 이스케이프(막대 셋과 같은 _escGraphHtml). 옛: `<b>` 가 태그로 읽혔다 */
    ).join('');

    block.innerHTML = `
      <div class="grb-line-wrap" style="height:${chartH}px">
        <svg class="grb-line-svg" viewBox="0 0 ${innerW} ${innerH}" preserveAspectRatio="none">
          <line class="grb-line-axis" x1="${plotL}" y1="${baselineY}" x2="${plotR}" y2="${baselineY}" stroke-width="1"/>
          ${areaEl}
          ${polyEl}
        </svg>
        <div class="grb-line-overlay">${pointDots}${labelsHTML}</div>
      </div>`;
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
window.applyBlockFullBleed        = applyBlockFullBleed;
window.clearBlockFullBleed        = clearBlockFullBleed;
window.isFlowAnchorBlock          = isFlowAnchorBlock;
window.findFlowAnchorSelected     = findFlowAnchorSelected;
window.showNoSelectionHint        = showNoSelectionHint;
window.showToast                  = showToast;
window.getSectionAlign            = getSectionAlign;
window.GRAPH_DEFAULT_ITEMS        = GRAPH_DEFAULT_ITEMS;
window.renderGraph                = renderGraph;
window.applyDividerStyle          = applyDividerStyle;
window.ASSET_PRESETS              = ASSET_PRESETS;
window.suppressAncestorDrag       = suppressAncestorDrag;
window.selectAllEditableContents  = selectAllEditableContents;
