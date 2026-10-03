/* ═══════════════════════════════════════════════════════════════════════════
   MODAL FRAMEIFY (M1, 2026-10-04) — 모달 블럭 「프레임화 하기」
   현빈: 「모달블럭은 프레임 블럭(스택모드)안에 블럭추가하는 것 처럼 할 수 있을까? 원하는 만큼 줄 추가가 가능하게」
         → 길 ㉢(풀기) 확정 · 문구 「프레임화 하기」 · 자리 = 모달 드롭다운 (설계 $S/reports/M1-DESIGN.md)

   ★무엇을 하나 — 모달(.modal-block, dataset 이 진실) 하나를 «같은 그림»의 스택 프레임 + 진짜 블럭으로 바꾼다.
       before  (자리) > .row > .modal-block
       after   (자리) > .frame-block[data-full-width]   ← 스택(흐름) 프레임
                          ├ (icon-stack) .row > .icon-block
                          ├ (titled)     .frame-block[data-text-frame] > .text-block[h2]
                          └              .frame-block[data-text-frame] > .text-block[body]
     그 뒤 줄 더하기는 «프레임의 기존 손짓 그대로»다(프레임 고르기 → T 등 → block-factory 의 fullWidth 갈래).
     ⛔삽입 길을 새로 만들지 않는다(G19 「새 길 금지」).

   ★스타일은 «모달이 그리던 값»에서 온다 — 색은 dataset 원문(var() 바인딩 유지), 타이포는 renderModalBlock 이
     루트·칸에 «실제로 박은» 인라인 값(그리는 쪽이 진실 — 같은 규칙을 여기 다시 적으면 두 벌이 된다).
     ⇒ 변환 «직전»에 renderModalBlock 을 한 번 불러 인라인을 dataset 과 맞춘다.

   ★R6(지디 조건 2026-10-04) — 프레임화 «뒤» 더하는 본문 줄이 모달 본문과 «같은 꼴»이어야 한다.
     CSS 상속으로는 안 된다: `.text-block .tb-body{font-size:36px;line-height:1.6;color:var(--preset-body-color)}` 클래스 규칙이
     부모에서 물려받은 값을 이기고, makeTextBlock 은 font-family 를 인라인으로 박는다.
     ⇒ 본문 꼴을 프레임 `data-row-text-style`(JSON)에 «심고», 본문 줄도 «같은 함수»(window.applyRowTextStyle)로 칠한다.
       새 본문 줄은 block-factory 의 fullWidth 갈래(addTextBlock·addBlankTextBlock)가 같은 함수로 칠한다 ⇒ «구성상» 같다.

   ★⌘Z 한 걸음 — 「양쪽 끝」(js/CLAUDE.md 히스토리 규약 · 삭제 경로와 같은 꼴):
       ensureHistoryCheckpoint('프레임화 전') → 바꾸기 → 프레임 선택 → pushHistory('프레임화 하기')

   ⛔결과 서브트리에 모달 정체성(.modal-block · data-type=modal · tb-mdl-* · data-mdl-*)이 하나라도 남으면
     rebindAll 이 renderModalBlock 을 불러(save-load.js) 자식을 통째로 지운다 — G19 와 같은 병의 «입구».
     새 블럭을 «새로 만들어» 쓰고 모달 노드는 버리므로 남을 자리가 없다(단위시험 modal-frameify-map 이 잠근다).
═══════════════════════════════════════════════════════════════════════════ */

import { MODAL_DEFAULTS, MODAL_LIMITS, MODAL_PH, MODAL_SHADOW_CSS, MODAL_VARIANTS,
         _effDefault, _dropShadow, clampModal, renderModalBlock } from './modal-block.js';

/** 1차에서 프레임화되는 형태 — 세로로 쌓이는 넷(지디 승인 ㉠, 2026-10-04). */
export const FRAMEIFY_VARIANTS = ['plain', 'titled', 'dashed', 'icon-stack'];
/** 가로 형태(icon·grid-2)에서 항목을 흐리게 둘 때의 까닭 — ⛔「아직 안 됩니다」만 쓰지 않는다(지디 조건 2). */
export const FRAMEIFY_HORIZONTAL_REASON = '가로로 늘어선 모달은 프레임이 세로로만 쌓여서 아직 그대로 옮길 수 없습니다';
export const FRAMEIFY_TOAST = '프레임으로 바꿨어요 · ⌘Z 로 되돌리기';
const _MDL_JUSTIFY_V = { top: 'flex-start', center: 'center', bottom: 'flex-end' };
const HIGHLIGHT_BG = '#fff2a8';   // modal-block.js _highlightCss 와 같은 값 — 단위시험이 두 자리를 대조한다

const _num = (block, key, def) => { const n = parseInt(block.dataset[key]); return Number.isFinite(n) ? n : def; };

/** 이 모달을 지금 프레임화할 수 있나 — { ok, reason } */
export function canFrameifyModal(block) {
  if (!block?.classList?.contains('modal-block')) return { ok: false, reason: '모달 블럭이 아닙니다' };
  const v = MODAL_VARIANTS.includes(block.dataset.variant) ? block.dataset.variant : MODAL_DEFAULTS.variant;
  if (!FRAMEIFY_VARIANTS.includes(v)) return { ok: false, reason: FRAMEIFY_HORIZONTAL_REASON };
  if (!block.parentElement) return { ok: false, reason: '캔버스에 없는 블럭입니다' };
  return { ok: true, reason: '' };
}

/* ── 글자 꼴 — 모달 칸 하나가 «그려진» 꼴을 text-block 에 옮길 꼴로 ───────────────────────────
   돌려주는 꼴 = { ce: {contentEl style}, tb: {text-block style} } — window.applyRowTextStyle 이 받는 꼴. */
function _textStyle(block, root, slotEl, { title = false, pad = null } = {}) {
  const ds = block.dataset;
  const ce = {
    fontSize: `${_num(block, 'fontSize', MODAL_DEFAULTS.fontSize)}px`,
    lineHeight: root.style.lineHeight || String(MODAL_DEFAULTS.lineHeight),
    color: ds.textColor || MODAL_DEFAULTS.textColor,
    textAlign: root.style.textAlign || MODAL_DEFAULTS.align,
    whiteSpace: 'pre-wrap',
  };
  // 글꼴 — 사용자가 정했으면 그 값, 아니면 칸이 «물려받던» computed 를 박는다.
  //   ★P1 실측(2026-10-04): 모달 칸 상속 = "Pretendard, -apple-system, system-ui, Segoe UI, sans-serif",
  //     새 text-block 인라인 = "Pretendard, sans-serif" ⇒ 폴백 사슬이 달라 Pretendard 가 없는 자리에서 글꼴이 갈린다.
  ce.fontFamily = root.style.fontFamily || getComputedStyle(slotEl || root).fontFamily;
  // 줄바꿈 규칙 — ★P1: 모달 칸 normal/normal ↔ .text-block keep-all/break-word ⇒ 한글 긴 글의 줄이 갈린다. 모달 규칙을 옮긴다.
  ce.wordBreak = 'normal'; ce.overflowWrap = 'normal';
  // 굵기: 제목은 칸 인라인(사용자가 정함) 또는 CSS 의 700(css/editor-blocks.css `.modal-block .tb-mdl-title`) — .tb-h2 는 600 이라 «꼭» 박는다
  const w = title ? (slotEl?.style.fontWeight || '700') : root.style.fontWeight;
  if (w) ce.fontWeight = w;
  if (root.style.letterSpacing) ce.letterSpacing = root.style.letterSpacing;
  if (root.style.fontStyle) ce.fontStyle = root.style.fontStyle;
  if (root.style.textDecoration) ce.textDecoration = root.style.textDecoration;
  const tb = {};
  if (pad) { tb.paddingTop = `${pad.t}px`; tb.paddingBottom = `${pad.t}px`; tb.paddingLeft = `${pad.x}px`; tb.paddingRight = `${pad.x}px`; }
  // 형광펜 — 모달은 «칸 상자 전체»(패딩 포함)에 칠한다 ⇒ text-block 상자(패딩 포함)에 칠해야 같은 그림이다
  if (ds.highlight === '1') tb.backgroundColor = HIGHLIGHT_BG;
  return { ce, tb };
}

function _makeTextRow(kind, value, ph, style) {
  const { block } = window.makeTextBlock(kind);
  const tf = window._makeTextFrame();
  const ce = block.querySelector('[class^="tb-"]');
  window.applyRowTextStyle(block, style);
  const txt = String(value ?? '');
  if (txt.trim() === '') {
    ce.textContent = ph; ce.dataset.placeholder = ph; ce.dataset.isPlaceholder = 'true';
  } else {
    ce.textContent = txt; delete ce.dataset.isPlaceholder;
  }
  tf.appendChild(block);
  return { tf, block };
}

function _makeIconRow(block) {
  const ds = block.dataset;
  const size = _num(block, 'iconSize', MODAL_DEFAULTS.iconSize);
  const slot = block.querySelector('.mdl-icon');
  const { row, block: icn } = window.makeIconifyBlock(ds.iconName || '', '', size);
  icn.dataset.iconColor = ds.iconColor || MODAL_DEFAULTS.iconColor;
  icn.dataset.rotation = String(_num(block, 'iconRotation', 0));
  if (ds.raster === '1' && ds.iconSrc) { icn.dataset.raster = '1'; icn.dataset.iconSrc = ds.iconSrc; }
  // ★내용은 «모달이 그리던 그 svg/img» 그대로 — 아이콘을 안 골랐을 때의 자리표(stroke=currentColor)까지.
  //   icon-block 의 자리표는 stroke #aaa 라 그대로 두면 색이 달라진다. 모달 피그마 내보내기도 이 svg 를 싣는다.
  icn.innerHTML = slot ? slot.innerHTML : '';
  const svg = icn.querySelector(':scope > svg');
  if (svg) { svg.setAttribute('width', size); svg.setAttribute('height', size); svg.style.display = 'block'; }
  icn.style.color = icn.dataset.iconColor;
  const rot = _num(block, 'iconRotation', 0);
  icn.style.transform = rot ? `rotate(${rot}deg)` : '';
  icn.style.alignSelf = 'center';   // icon-stack 은 가운데 — prop-frame _setAlign 의 「row[stack] 안 직계 자식 alignSelf」 관례
  return { row, icn };
}

/**
 * 모달 하나를 프레임으로 바꾼다 — DOM 만(히스토리·선택·토스트 없음). 실패하면 null.
 * @returns {{ frame: Element, blocks: Element[] } | null}
 */
export function frameifyModalDom(block) {
  if (!canFrameifyModal(block).ok) return null;
  renderModalBlock(block);   // 인라인을 dataset 과 맞춘다(그리는 쪽이 진실)
  const ds = block.dataset;
  const v = MODAL_VARIANTS.includes(ds.variant) ? ds.variant : MODAL_DEFAULTS.variant;
  const root = block;
  const padX = _num(block, 'padX', MODAL_DEFAULTS.padX);
  const padY = _num(block, 'padY', MODAL_DEFAULTS.padY);
  const radius = clampModal(_num(block, 'radius', MODAL_DEFAULTS.radius), MODAL_LIMITS.radius);
  const bg = ds.bg || _effDefault(v, 'bg');

  const frame = window.makeFrameBlock(radius > 0 ? { fullWidth: true, bg, radius } : { fullWidth: true, bg });
  const st = frame.style;
  /* ★일부러 클립 유지 — AA 62px 차이(실앱 현빈 모달 0px) · 이 한 줄을 바꾸면 뒤집힌다.
       클립을 거는 자리는 둘이다: ⑴ 바로 위 makeFrameBlock(block-factory.js) — radius 를 주면 인라인 `overflow:hidden`
       ⑵ css/editor-blocks.css `.frame-block[data-radius]:not([data-radius="0"]) { overflow: hidden; }`.
       «이 한 줄» = 바로 아래 주석 처리된 `st.overflow = 'visible'` — 풀면 인라인이 ⑴⑵ 를 둘 다 이겨 icon-stack+모서리의
       아이콘 안티앨리어싱 62px(tests/dom/modal-frameify-pixel ALLOW ⑴)가 0 이 되는 대신, «모달에서 온 둥근 프레임»만
       나중에 넣는 이미지 줄을 모서리에서 안 자른다(다른 모든 둥근 프레임과 달라진다). 뒤집으면 ALLOW ⑴ 도 같이 0 으로. */
  // if (radius > 0) st.overflow = 'visible';
  // ── 안쪽 여백 — titled 는 루트 0(칸이 자기 여백을 갖는다 — renderModalBlock rootPad) ──
  const fp = v === 'titled' ? { x: 0, y: 0 } : { x: padX, y: padY };
  frame.dataset.padX = String(fp.x); frame.dataset.padY = String(fp.y);
  st.paddingTop = st.paddingBottom = `${fp.y}px`; st.paddingLeft = st.paddingRight = `${fp.x}px`;
  // ── 테두리 — 프레임은 borderWidth(★이름 다름: 모달 borderW) ──
  const bw = _num(block, 'borderW', _effDefault(v, 'borderW'));
  if (bw > 0) {
    const bs = ds.borderStyle || _effDefault(v, 'borderStyle');
    const bc = ds.borderColor || MODAL_DEFAULTS.borderColor;
    frame.dataset.borderWidth = String(bw); frame.dataset.borderStyle = bs; frame.dataset.borderColor = bc;
    st.border = `${bw}px ${bs} ${bc}`;
  }
  // ── 그림자 — ⚠️프레임 패널엔 손잡이가 없다(R2). 그림은 지키고 dataset 에 이름을 남긴다 ──
  const sh = MODAL_SHADOW_CSS[_dropShadow(ds.dropShadow)];
  if (sh) { st.boxShadow = sh; frame.dataset.dropShadow = _dropShadow(ds.dropShadow); }
  // ── 크기 — 폭 고정이면 프레임 applyWidth 와 같은 꼴(prop-frame.js) · 높이는 «최소 높이» ──
  if (ds.wMode === 'fixed') {
    const w = _num(block, 'width', MODAL_DEFAULTS.width);
    frame.dataset.width = String(w); st.width = `${w}px`; st.margin = '0 auto'; st.alignSelf = 'center';
  }
  const hFixed = ds.hMode === 'fixed';
  // ★CSS `.frame-block{min-height:60px}` 를 «꼭» 누른다 — 안 누르면 글자가 작은 모달이 60px 로 커진다(P3)
  st.minHeight = hFixed ? `${_num(block, 'height', MODAL_DEFAULTS.height)}px` : '0px';
  const jv = _MDL_JUSTIFY_V[ds.vAlign] || _MDL_JUSTIFY_V.top;
  if (hFixed || v === 'icon-stack') { st.justifyContent = jv; frame.dataset.justifyContent = jv; }
  if (v === 'icon-stack') { st.alignItems = 'center'; frame.dataset.alignItems = 'center'; st.gap = '9px'; frame.dataset.gap = '9'; }
  if (ds.layerName) frame.dataset.layerName = ds.layerName;

  // ── 자식 ──
  const blocks = [];
  if (v === 'icon-stack') { const { row, icn } = _makeIconRow(block); frame.appendChild(row); blocks.push(icn); }
  if (v === 'titled') {
    const tSlot = block.querySelector('.tb-mdl-title');
    const tStyle = _textStyle(block, root, tSlot, { title: true, pad: { t: Math.round(padY * 0.6), x: padX } });
    const t = _makeTextRow('h2', ds.titleText, MODAL_PH.title, tStyle);
    frame.appendChild(t.tf); blocks.push(t.block);
  }
  const bStyle = _textStyle(block, root, block.querySelector('.tb-mdl-text'), { pad: v === 'titled' ? { t: padY, x: padX } : null });
  const b = _makeTextRow('body', ds.textText, MODAL_PH.text, bStyle);
  if (v === 'icon-stack') {
    // ★모달 icon-stack 의 글자 칸은 align-items:center 의 flex 아이템 = «내용 폭»으로 준다(shrink-to-fit).
    //   텍스트프레임 기본 폭 100% 로 두면 형광펜 칠이 줄 전체로 번진다(골든 1차 실측: 꾸밈 칸 ~13k px). 내용 폭 + 가운데로.
    b.tf.style.alignSelf = 'center'; b.tf.style.width = 'auto';
  }
  frame.appendChild(b.tf); blocks.push(b.block);
  // ★R6 — 본문 꼴을 프레임에 심는다(새 본문 줄이 같은 함수로 같은 꼴을 받는다)
  frame.dataset.rowTextStyle = JSON.stringify(bStyle);

  // ── 자리: 모달만 든 row 면 row 째, 아니면 모달 자리에 ──
  const row = block.parentElement;
  const soleRow = row?.classList.contains('row') && row.childElementCount === 1 && !row.getAttribute('style');
  (soleRow ? row : block).replaceWith(frame);

  window.bindFrameDropZone?.(frame);
  blocks.forEach(el => window.bindBlock?.(el));
  return { frame, blocks };
}

function _selectFrame(frame) {
  window.deselectAll?.();
  const sec = frame.closest('.section-block');
  if (sec) { sec.classList.add('selected'); window.syncLayerActive?.(sec); }
  frame.classList.add('selected');
  window._activeFrame = frame;
  window.highlightBlock?.(frame, frame._layerItem);
  window.setBlockAnchor?.(frame);
  window.showFrameProperties?.(frame);
  window.showFrameHandles?.(frame);
}

/**
 * 사용자 동작 「프레임화 하기」 — 히스토리 양쪽 끝 + 선택 + 토스트. MCP·자동화도 이 창구를 쓴다(window.frameifyModal).
 * @param {Element|string} blockOrId
 * @returns {Element|null} 새 프레임
 */
export function frameifyModal(blockOrId) {
  const block = typeof blockOrId === 'string' ? document.getElementById(blockOrId) : blockOrId;
  const can = canFrameifyModal(block);
  if (!can.ok) { if (block) window.showToast?.(can.reason); return null; }
  window.ensureHistoryCheckpoint?.('프레임화 전');      // «앞» 표본 — 라이브가 꼭대기와 다를 때만 찍힌다
  const made = frameifyModalDom(block);
  if (!made) return null;
  window.buildLayerPanel?.();
  _selectFrame(made.frame);                             // 선택을 «먼저» — pushHistory 가 선택도 같이 찍는다
  window.pushHistory?.('프레임화 하기');                 // «뒤» 표본
  window.scheduleAutoSave?.();
  window.showToast?.(FRAMEIFY_TOAST);
  return made.frame;
}

if (typeof window !== 'undefined') {
  window.frameifyModal = frameifyModal;
  window.canFrameifyModal = canFrameifyModal;
  window.FRAMEIFY_HORIZONTAL_REASON = FRAMEIFY_HORIZONTAL_REASON;
}
