import { canvasEl, propPanel, state, BLOCK_DELEGATE_SEL } from './globals.js';
import { pushHistory, undo, redo, clearHistory, restoreSnapshot } from './history.js';

/* ═══════════════════════════════════
   SSOT: 캔버스에서 "선택된 블록" 셀렉터 목록
   - Delete 핸들러(allSelBlocks)와 getSelectedSection()이 공유.
   - 스티커/조커 등 플로팅 블록 포함 (closest('.row') 없으므로 block.remove()로 안전 삭제).
   - 에셋패널 keydown 가드(canvasSelected)도 window.CANVAS_SEL_BLOCKS로 동기화.
═══════════════════════════════════ */
const CANVAS_SEL_BLOCKS =
  '.text-block.selected, .asset-block.selected, .gap-block.selected, ' +
  '.icon-circle-block.selected, .table-block.selected, .label-group-block.selected, ' +
  '.graph-block.selected, .divider-block.selected, .bridge-block.selected, .duo-block.selected, .infocard-block.selected, .innercard-block.selected, .icon-text-block.selected, ' +
  '.canvas-block.selected, .banner02-block.selected, .comparison-block.selected, ' +
  '.mockup-block.selected, .icon-block.selected, .vector-block.selected, ' +
  '.step-block.selected, .laurel-block.selected, .gradient-block.selected, ' +
  '.sticker-block.selected, .joker-block.selected, .chat-block.selected, ' +
  '.speech-bubble-block.selected';  // 버블(sb_): 복수선택/복사/삭제/⌘X 대상 편입 (#7)
// shape-block은 ss/row 단위 별도 삭제 경로(allSelShapes)라 위 목록에 포함하지 않음.
// 단, "캔버스에 무언가 선택됨" 판정/섹션 매핑엔 shape도 포함해야 함.
const CANVAS_SEL_BLOCKS_AND_SHAPE = CANVAS_SEL_BLOCKS + ', .shape-block.selected';
if (typeof window !== 'undefined') {
  window.CANVAS_SEL_BLOCKS = CANVAS_SEL_BLOCKS;
  window.CANVAS_SEL_BLOCKS_AND_SHAPE = CANVAS_SEL_BLOCKS_AND_SHAPE;
}

/* ═══════════════════════════════════
   포커스 시 전체 선택 (Figma 스타일)
   - 숫자/hex/opacity 프로퍼티 인풋 클릭 시 텍스트 전체 선택 → 바로 덮어쓰기
═══════════════════════════════════ */
/* ═══════════════════════════════════
   C3: 연속 크기/간격 조정 히스토리 병합 (coalesce)
   - +/- 키 연타가 키스트로크마다 별도 히스토리 엔트리를 쌓는 문제 해결.
   - 트레일링 디바운스(push-after): 마지막 DOM 상태를 단일 엔트리로 캡처.
   - 같은 블록+라벨 연타는 타이머 리셋, 다른 블록/라벨로 전환 시 직전 보류분 즉시 확정.
═══════════════════════════════════ */
let _sizeCoalesceTimer = null;
let _sizeCoalesceKey   = null;
function coalesceSizeHistory(targetEl, label) {
  // dataset.blockId 없는 블록은 비직렬화 _uid로 fallback (저장/복원 무영향)
  let uid = targetEl?.dataset?.blockId;
  if (!uid && targetEl) uid = (targetEl._uid ??= 'sz' + Math.random().toString(36).slice(2));
  const key = (uid || 'sz?') + '|' + label;
  if (_sizeCoalesceTimer && _sizeCoalesceKey === key) {
    clearTimeout(_sizeCoalesceTimer); // 같은 대상 연타 → 타이머 연장
  } else if (_sizeCoalesceTimer) {
    // 다른 블록/라벨로 전환 → 직전 보류분 즉시 확정
    clearTimeout(_sizeCoalesceTimer);
    window.pushHistory?.(_sizeCoalesceKey.split('|').slice(1).join('|'));
  }
  _sizeCoalesceKey = key;
  _sizeCoalesceTimer = setTimeout(() => {
    _sizeCoalesceTimer = null;
    _sizeCoalesceKey   = null;
    window.pushHistory?.(label);
  }, 450);
}

const _AUTO_SELECT_SEL = '.prop-number, .prop-color-hex, .prop-color-alpha-input, .goya-cp-hex, .goya-cp-alpha-input';
document.addEventListener('focusin', (e) => {
  const el = e.target;
  if (!el.matches?.(_AUTO_SELECT_SEL)) return;
  // mousedown 이후에 select() 호출되도록 한 틱 지연
  // ⚠️`<select class="prop-number">` 처럼 select() 가 «없는» 요소도 이 셀렉터에 걸린다
  //   (prop-banner02 줄 kind · prop-iconify). 가드 없으면 클릭할 때마다 uncaught TypeError.
  setTimeout(() => { if (document.activeElement === el && typeof el.select === 'function') el.select(); }, 0);
});
document.addEventListener('mouseup', (e) => {
  const el = e.target;
  if (!el.matches?.(_AUTO_SELECT_SEL)) return;
  // 포커스 얻는 첫 클릭에서만 기본 caret 배치 막기
  if (el.dataset._selJustFocused === '1') {
    e.preventDefault();
    delete el.dataset._selJustFocused;
  }
}, true);
document.addEventListener('mousedown', (e) => {
  const el = e.target;
  if (!el.matches?.(_AUTO_SELECT_SEL)) return;
  if (document.activeElement !== el) el.dataset._selJustFocused = '1';
}, true);

/* ═══════════════════════════════════
   PANEL TABS
═══════════════════════════════════ */
function toggleAllSections() {
  const sections = document.querySelectorAll('#layer-panel-body .layer-section');
  const anyOpen = [...sections].some(s => !s.classList.contains('collapsed'));
  sections.forEach(s => s.classList.toggle('collapsed', anyOpen));
}

// Gap 레이어 숨김 토글 — localStorage에 상태 저장 + 즉시 적용
function _applyHideGapLayers(hide) {
  document.body.classList.toggle('hide-gap-layers', hide);
  const btn = document.getElementById('layer-hide-gap');
  if (btn) btn.classList.toggle('active', hide);
}
function toggleHideGapLayers() {
  const cur = localStorage.getItem('goditor_hide_gap_layers') === '1';
  // (FIX-4) 이스터에그 게이팅 — off면 새로 켜는 것만 차단 (이미 켜진 상태는 끌 수 있게 허용)
  if (!cur && window.isEasterEggEnabled && !window.isEasterEggEnabled('hideGapLayers')) return;
  const next = !cur;
  localStorage.setItem('goditor_hide_gap_layers', next ? '1' : '0');
  _applyHideGapLayers(next);
}
window.toggleHideGapLayers = toggleHideGapLayers;
// 페이지 로드 시 저장된 상태 복원
document.addEventListener('DOMContentLoaded', () => {
  _applyHideGapLayers(localStorage.getItem('goditor_hide_gap_layers') === '1');
});

function switchToTab(tabName) {
  document.querySelectorAll('.panel-tab').forEach(t =>
    t.classList.toggle('active', t.dataset.tab === tabName));
  const filePanel = document.getElementById('file-panel-body');
  if (filePanel) filePanel.style.display = tabName === 'file' ? 'flex' : 'none';
  document.getElementById('inspector-panel-body').style.display  = tabName === 'inspector' ? 'flex' : 'none';
  document.getElementById('checklist-panel-body').style.display  = tabName === 'checklist' ? 'flex' : 'none';
  const assetsBody = document.getElementById('assets-panel-body');
  if (assetsBody) assetsBody.style.display = tabName === 'assets' ? 'flex' : 'none';
  const collapseBtn = document.getElementById('layer-collapse-all');
  if (collapseBtn) collapseBtn.style.display = tabName === 'file' ? '' : 'none';
  if (tabName === 'inspector') window.renderInspectorPanel();
  if (tabName === 'checklist') window.renderChecklistPanel?.();
  if (tabName === 'assets')    window.buildAssetsPanel?.();
  // (U7) assets 탭이 아닌 곳으로 전환 시 잔류 자산 선택 클리어 (Delete 오발동 안전망)
  if (tabName !== 'assets')    window._assetsClearSelection?.();
}

function initFileTabToggle() {
  ['page-section-header', 'layers-section-header', 'templates-section-header'].forEach(id => {
    const header = document.getElementById(id);
    if (!header) return;
    header.addEventListener('click', () => {
      header.closest('.file-panel-section').classList.toggle('collapsed');
    });
  });
}

/* ═══════════════════════════════════
   ZOOM
═══════════════════════════════════ */
const CANVAS_W = 860;
let currentZoom = 40;
const scaler = document.getElementById('canvas-scaler');
const zoomDisplay = document.getElementById('zoom-display');

let panOffsetX = 0;
let panOffsetY = 0;

function applyZoom(z) {
  currentZoom = Math.min(400, Math.max(10, z));
  window.currentZoom = currentZoom;
  _applyScalerTransform();
  zoomDisplay.textContent = currentZoom + '%';
  document.documentElement.style.setProperty('--inv-zoom', (100 / currentZoom).toFixed(4));
  // 섹션 라벨/툴바 카운터-스케일
  // - zoom ≥ 80%: 자연 스케일 (1.0) — 라벨이 섹션과 분리돼 보이지 않게
  // - zoom < 80%: 점진적으로 키워서 가독성 유지, 최대 1.6 cap (겹침 방지는 max-width+ellipsis가 담당)
  const uiScale = currentZoom >= 80 ? 1 : Math.min(1.6, 100 / currentZoom * 0.8);
  document.documentElement.style.setProperty('--ui-scale', uiScale.toFixed(4));
  /* ★[적대검수 중대②] 꼬리 여백은 selectSection 안에서만 «부여»되고 아무도 안 되돌렸다.
   *   배율만 바꿔도 465px 짜리 죽은 회색이 그대로 남았다(실측 4회 연속 425px 유지).
   *   여백은 «그 순간의 스크롤을 위한 것»이라 상태가 바뀌면 미련 없이 버린다.
   *   다시 필요하면 다음 selectSection 이 «모자란 만큼» 다시 준다. */
  window.resetCanvasTail?.();
}

function _applyScalerTransform() {
  scaler.style.transform = `translate(${panOffsetX}px, ${panOffsetY}px) scale(${currentZoom / 100})`;
  _syncScalerHeight();
}

/* C20: transform:scale은 레이아웃 박스 높이를 안 바꿔 #canvas-wrap.scrollHeight가 미축소 원본 기준으로 잡힘
 *      → 줌아웃 시 마지막 섹션 아래로 빈 회색이 과도하게 스크롤됨. scaler 레이아웃 높이를
 *      (미축소 자연높이 × scale)로 명시해 스크롤 영역을 줌과 동기화(top 고정 유지). */
function _syncScalerHeight() {
  if (!scaler) return;
  const scale = currentZoom / 100;
  const prev = scaler.style.height;
  scaler.style.height = '';
  void scaler.offsetHeight;            // reflow → 자연(미축소) 높이 측정
  let naturalH = scaler.offsetHeight;  // flow 콘텐츠(#canvas) 기준 (abs 자식 미포함)
  for (const c of scaler.children) {   // canvas 아래로 배치된 absolute 자식(scratch-item 등) 커버
    if (c.style && c.style.position === 'absolute') {
      const b = c.offsetTop + c.offsetHeight;
      if (b > naturalH) naturalH = b;
    }
  }
  const target = Math.round(naturalH * scale) + 'px';
  scaler.style.height = (target !== prev) ? target : prev;
}

/* C20: 섹션/블록 추가·삭제·리사이즈로 #canvas 높이가 바뀌면 scaler 레이아웃 높이도 재동기화.
 *      scaler.style.height 변경은 #canvas.offsetHeight에 영향 없어 피드백 루프 없음. rAF 디바운스. */
(() => {
  const canvasEl = document.getElementById('canvas');
  if (!canvasEl || typeof ResizeObserver === 'undefined') return;
  let raf = 0;
  const ro = new ResizeObserver(() => {
    if (raf) return;
    raf = requestAnimationFrame(() => { raf = 0; _syncScalerHeight(); });
  });
  ro.observe(canvasEl);
})();

function resetPanOffset() {
  panOffsetX = 0;
  // C14: panOffsetY를 0으로 만들 때 잃는 세로 보정을 wrap.scrollTop으로 흡수해
  //       콘텐츠 중앙정렬 유지 (applyZoom의 idealScrollTop/clamp 공식 차용).
  const wrap = document.getElementById('canvas-wrap');
  const scalerEl = document.getElementById('canvas-scaler');
  if (wrap && scalerEl) {
    void scalerEl.offsetHeight; void wrap.scrollHeight;
    const scale = currentZoom / 100;
    const contentH = scalerEl.offsetHeight * scale;
    const idealScrollTop = Math.round((contentH - wrap.clientHeight) / 2);
    const maxScroll = Math.max(0, wrap.scrollHeight - wrap.clientHeight);
    wrap.scrollTop = Math.max(0, Math.min(maxScroll, idealScrollTop));
  }
  panOffsetY = 0;
  _applyScalerTransform();
}
function zoomStep(delta) {
  const wrap = document.getElementById('canvas-wrap');
  const scaler = document.getElementById('canvas-scaler');
  if (!wrap || !scaler) { applyZoom(currentZoom + delta); return; }

  const s_old = currentZoom / 100;
  const newZoom = Math.min(400, Math.max(10, currentZoom + delta));
  if (newZoom === currentZoom) return;
  const s_new = newZoom / 100;

  // 줌인 + 선택 블록 있음: 해당 섹션이 화면 밖일 때만 그쪽으로 점프
  // (이미 화면에 보이는 경우엔 vpCenter 보존 — 사용자가 보던 영역이 갑자기 점프하지 않도록)
  const selectedBlock = delta > 0 && document.querySelector(
    '.text-block.selected, .asset-block.selected, .gap-block.selected, ' +
    '.icon-circle-block.selected, .table-block.selected, .label-group-block.selected, ' +
    '.graph-block.selected, .divider-block.selected, .bridge-block.selected, .duo-block.selected, .infocard-block.selected, .innercard-block.selected, ' +
    '.icon-text-block.selected, .shape-block.selected, .speech-bubble-block.selected'
  );
  let targetEl = selectedBlock ? (selectedBlock.closest('.section-block') || selectedBlock) : null;
  if (targetEl) {
    // 이미 화면 vp 안에 보이면 점프 안 함 (vpCenter 보존 분기로)
    const wrapRect0 = wrap.getBoundingClientRect();
    const tRect = targetEl.getBoundingClientRect();
    const inView = tRect.bottom > wrapRect0.top && tRect.top < wrapRect0.bottom &&
                   tRect.right  > wrapRect0.left && tRect.left < wrapRect0.right;
    if (inView) targetEl = null;
  }

  // ───── 측정 기반 vpCenter(or selected block center) 보존 ─────
  // 핵심:
  //  1) wrap.scrollHeight는 untransformed offsetHeight 기준이라 scale 변경 시 즉시 안 바뀜.
  //  2) #canvas-scaler의 `transition: transform 0.15s`로 인해 applyZoom 직후 동기 측정이
  //     예전 scale을 반영하지 못함 → transition 일시 off + reflow.
  //  3) anchor의 untransformed canvas-y를 줌 전 getBoundingClientRect로 측정해서,
  //     줌 후 scrollTop을 직접 계산. scrollTop으로 흡수 불가 영역은 panOffsetY로 보완.
  const wrapRectBefore = wrap.getBoundingClientRect();
  const scalerRectBefore = scaler.getBoundingClientRect();
  const anchorScreenY = targetEl
    ? (() => { const r = targetEl.getBoundingClientRect(); return r.top + r.height / 2; })()
    : (wrapRectBefore.top + wrapRectBefore.height / 2);
  const anchorCanvasY = (anchorScreenY - scalerRectBefore.top) / s_old;
  // anchor x (selected block 점프 시 좌우 정렬용)
  const anchorScreenX = targetEl
    ? (() => { const r = targetEl.getBoundingClientRect(); return r.left + r.width / 2; })()
    : (wrapRectBefore.left + wrapRectBefore.width / 2);
  // x 변환: transform-origin x = scaler.offsetWidth/2 (top center)
  const scalerCenterX = scalerRectBefore.left + scalerRectBefore.width / 2;
  // canvas-x (origin 기준 offset) = (screenX - centerX) / s_old
  const anchorCanvasOffsetX = (anchorScreenX - scalerCenterX) / s_old;

  // 줌 후 anchor가 viewport 내 어디 위치할지: 선택 블록이면 정중앙, 아니면 측정 시점과 같은 비율
  const anchorVpY = targetEl ? (wrapRectBefore.height / 2) : (anchorScreenY - wrapRectBefore.top);
  const anchorVpX = targetEl ? (wrapRectBefore.width  / 2) : (anchorScreenX - wrapRectBefore.left);

  // transition 일시 off → 동기 적용
  const prevTransition = scaler.style.transition;
  scaler.style.transition = 'none';
  // pan 초기화 (panning 기능 없음 가정, scrollTop 우선)
  panOffsetX = 0;
  panOffsetY = 0;
  applyZoom(newZoom);
  // force layout flush — wrap.scrollHeight / scaler.offsetTop 최신화
  void scaler.offsetHeight; void wrap.scrollHeight;

  // y축: 가능한 한 scrollTop으로 흡수, 잔여는 panOffsetY로 보완
  const padTop = scaler.offsetTop;
  const idealScrollTop = padTop + anchorCanvasY * s_new - anchorVpY;
  const maxScroll = wrap.scrollHeight - wrap.clientHeight;
  const clampedScroll = Math.max(0, Math.min(maxScroll, idealScrollTop));
  wrap.scrollTop = clampedScroll;
  panOffsetY = clampedScroll - idealScrollTop;

  // x축: scrollLeft + transform-origin center. 보통 wrap.clientWidth >= scaler 가시폭이면 0.
  // anchorScreenX 위치 == wrapTop + anchorVpX 만족하도록 panOffsetX 계산
  //   screenX_after = scalerCenterX_after + anchorCanvasOffsetX * s_new + panOffsetX
  //   wrapLeft + anchorVpX = (wrapLeft + scaler.offsetLeft + scaler.offsetWidth/2 - wrap.scrollLeft) + anchorCanvasOffsetX*s_new + panOffsetX
  // → panOffsetX = anchorVpX - scaler.offsetLeft - scaler.offsetWidth/2 + wrap.scrollLeft - anchorCanvasOffsetX*s_new
  const wantedX = anchorVpX - scaler.offsetLeft - scaler.offsetWidth / 2 + wrap.scrollLeft - anchorCanvasOffsetX * s_new;
  panOffsetX = wantedX;
  _applyScalerTransform();

  // transition 복원 (다음 프레임)
  requestAnimationFrame(() => { scaler.style.transition = prevTransition; });
}
function zoomFit() {
  const wrap = document.getElementById('canvas-wrap');
  applyZoom(Math.floor(((wrap.clientWidth - 80) / CANVAS_W) * 100));
}


/* ══ 브레드크럼 헬퍼 ══ */
function getBlockBreadcrumb(el) {
  const sec = el.closest('.section-block');
  if (!sec) return '';
  const sections = [...document.querySelectorAll('.section-block')];
  const sIdx = sections.indexOf(sec) + 1;
  const row = el.classList.contains('row') ? el : el.closest('.row');
  if (!row) return `Section ${sIdx}`;
  const inner = sec.querySelector('.section-inner');
  /* ★합쳐 넣은 몸 안의 행도 세야 한다 — :scope > 만 보면 indexOf 가 -1 이라 「Row 0」 이 뜬다.
     세는 순서는 «화면에 보이는 순서»여야 하므로 상자를 만나면 그 안으로 내려간다. */
  const flattenRows = (el) => [...el.children].flatMap(c =>
    c.classList.contains('section-merged-part') ? flattenRows(c)
      : (c.classList.contains('row') ? [c] : []));
  const rows = inner ? flattenRows(inner) : [];
  const rIdx = rows.indexOf(row) + 1;
  return `Section ${sIdx}  ·  Row ${rIdx}`;
}

/* ══════════════════════════════════════
   클립보드 유틸 — Electron 권한 우회
══════════════════════════════════════ */
function _copyToClipboard(text) {
  const _toast = () => { try { window.showToast && window.showToast('✅ ID 복사됨'); } catch (_) {} };
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    navigator.clipboard.writeText(text).then(_toast).catch(() => { _clipboardFallback(text); _toast(); });
  } else {
    _clipboardFallback(text);
    _toast();
  }
}
function _clipboardFallback(text) {
  const el = document.createElement('textarea');
  el.value = text;
  el.style.cssText = 'position:fixed;opacity:0;top:0;left:0;';
  document.body.appendChild(el);
  el.focus(); el.select();
  try { document.execCommand('copy'); } catch (_) {}
  document.body.removeChild(el);
}
window._copyToClipboard = _copyToClipboard;

/* ══════════════════════════════════════
   복사 / 붙여넣기
══════════════════════════════════════ */
let clipboard = null;

/* ═══════════════════════════════════
   BLOCK MULTI-SELECT HELPERS
   - Cmd+click  : toggle individual block
   - Shift+click: range select from last clicked
═══════════════════════════════════ */
const BLOCK_MULTI_SEL = '.text-block, .asset-block, .gap-block, .icon-circle-block, ' +
  '.table-block, .label-group-block, .graph-block, .divider-block, .bridge-block, .duo-block, .infocard-block, .innercard-block, ' +
  '.icon-text-block, .shape-block';

let _lastClickedBlock = null;

function _getBlockLayerItem(block) {
  if (block.classList.contains('shape-block')) {
    const ss = block.closest('.frame-block');
    return ss?._layerItem || block._layerItem;
  }
  return block._layerItem;
}

/* freeLayout 내 블록인지 확인 */
function _isInFreeLayout(block) {
  const wrapper = block.closest('.frame-block[data-text-frame], .frame-block[data-shape-frame]') ||
    (block.style.position === 'absolute' ? block : null);
  return !!(wrapper && wrapper.closest('.frame-block[data-free-layout]'));
}

/* freeLayout 내 블록의 모든 상위 freeLayout frame에 .selected 복원
 * 중첩 프레임(B inside A) 구조에서 deselectAll() 후 A까지 복원하지 않으면
 * A의 CSS pointer-events:none이 하위 전체에 적용되어 더블클릭이 막힘 */
function _restoreFreeLayoutFrameSelected(block) {
  let el = block;
  let deepestFrame = null;
  while (el) {
    const textOrShape = el.closest('.frame-block[data-text-frame], .frame-block[data-shape-frame]');
    const searchFrom = textOrShape || el;
    const frame = searchFrom.closest('.frame-block[data-free-layout]');
    if (!frame) break;
    frame.classList.add('selected');
    if (!deepestFrame) {
      deepestFrame = frame;
      window._activeFrame = frame;
    }
    const sec = frame.closest('.section-block');
    if (sec) sec.classList.add('selected');
    // 이 frame의 바깥에서 다시 탐색 (상위 frame 복원)
    el = frame.parentElement;
  }
}

/* freeLayout 멀티셀렉 패널 업데이트 트리거 */
function _updateFreeLayoutMultiSelPanel() {
  if (window.hasFreeLayoutMultiSel?.()) {
    window.showFreeLayoutMultiSelPanel?.();
  }
}

/* 일반(플로우) 블록 멀티선택 카운트 패널 트리거 (A11)
 * — freeLayout 블록은 X/Y/W/H 좌표가 있어 전용 패널로 위임,
 *   세로로 쌓인 일반 블록은 좌표가 없어 '몇 개 선택됨' 카운트 패널만 제공 */
// 1454행 allSelBlocks와 동일한 셀렉터 목록(.selected 접미) — SSOT
const FLOW_BLOCK_SEL_SELECTED = '.text-block.selected, .asset-block.selected, .gap-block.selected, .icon-circle-block.selected, .table-block.selected, .label-group-block.selected, .graph-block.selected, .divider-block.selected, .bridge-block.selected, .duo-block.selected, .infocard-block.selected, .innercard-block.selected, .icon-text-block.selected, .canvas-block.selected, .banner02-block.selected, .comparison-block.selected, .mockup-block.selected, .icon-block.selected, .vector-block.selected, .step-block.selected, .laurel-block.selected, .gradient-block.selected, .chat-block.selected, .speech-bubble-block.selected';

function _countFlowMultiSel() {
  return [...document.querySelectorAll(FLOW_BLOCK_SEL_SELECTED)].filter(b => !_isInFreeLayout(b)).length;
}

function _updateMultiSelPanel(block) {
  if (_isInFreeLayout(block)) {
    _updateFreeLayoutMultiSelPanel();
    return;
  }
  const n = _countFlowMultiSel();
  if (n > 1 && propPanel) {
    // B15: 카운트-온리 → 정렬/분배 패널 (prop-multisel.js)
    if (window.showFlowMultiSelPanel) window.showFlowMultiSelPanel();
    else propPanel.innerHTML = `<div class="prop-section"><div class="prop-block-label" style="padding:2px 0 4px;"><div class="prop-block-info"><span class="prop-block-name">${n}개 선택됨</span><span class="prop-breadcrumb">블록 멀티선택</span></div></div></div>`;
  }
}

/* Cmd+클릭: 단일 블록 토글 */
function toggleBlockSelect(block, sec) {
  const layerItem = _getBlockLayerItem(block);
  if (block.classList.contains('selected')) {
    block.classList.remove('selected');
    if (layerItem) { layerItem.classList.remove('active'); layerItem.style.background = ''; }
  } else {
    block.classList.add('selected');
    if (layerItem) layerItem.classList.add('active');
  }
  if (sec) window.syncSection?.(sec);
  _lastClickedBlock = block;
  // freeLayout 내 블록이면 부모 프레임 selected 복원 + 멀티셀렉 패널 업데이트
  if (_isInFreeLayout(block)) {
    _restoreFreeLayoutFrameSelected(block);
    setTimeout(_updateFreeLayoutMultiSelPanel, 0);
  } else {
    // 일반(플로우) 블록 — 멀티선택 시 카운트 패널 트리거 (A11)
    setTimeout(() => _updateMultiSelPanel(block), 0);
  }
}

/* Shift+클릭: 마지막 클릭 블록 ~ 현재 블록 범위 선택
 * — 같은 부모(섹션 또는 프레임)의 직속 자식만 sibling으로 취급
 * — 텍스트프레임(투명 wrapper)은 자기 안의 text-block을 selected
 * — 프레임/일반 블록은 자기 자신을 selected
 */
const SIBLING_MULTI_SEL =
  '.text-block, .asset-block, .gap-block, .icon-circle-block, ' +
  '.table-block, .label-group-block, .graph-block, .divider-block, .bridge-block, .duo-block, .infocard-block, .innercard-block, ' +
  '.icon-text-block, .shape-block, .frame-block, ' +
  // 누락 블록 추가 (#14): divider + 카드/말풍선/배너02/비교/목업/벡터/스텝/조커/캔버스 다중선택 지원
  '.speech-bubble-block, .banner02-block, .comparison-block, ' +
  '.mockup-block, .vector-block, .step-block, .joker-block, .canvas-block, ' +
  // 누락 블록 추가 (2026-06-09): iconify/chat/gradient/sticker/laurel — 다중선택 지원
  '.iconify-block, .chat-block, .gradient-block, .sticker-block, .laurel-block';

function _toSibling(el) {
  if (!el) return null;
  // 텍스트블록 클릭은 부모 텍스트프레임을 sibling 단위로 사용
  const tf = el.closest('.frame-block[data-text-frame]');
  return tf || el;
}

function _selectSibling(sib) {
  // 텍스트프레임이면 inner text-block을 selected (기존 패턴 유지)
  if (sib.dataset.textFrame === 'true') {
    const tb = sib.querySelector('.text-block');
    if (tb) {
      tb.classList.add('selected');
      const li = _getBlockLayerItem(tb);
      if (li) li.classList.add('active');
    }
    return;
  }
  sib.classList.add('selected');
  const li = _getBlockLayerItem(sib);
  if (li) li.classList.add('active');
}

function rangeSelectBlocks(block, sec) {
  const target = _toSibling(block);
  const anchor = _toSibling(_lastClickedBlock);
  const parent = target?.parentElement;

  // Path 1: 같은 부모 — 기존 빠른 경로 (row 안 형제, frame 안 형제 등)
  if (anchor && parent && anchor.parentElement === parent) {
    const siblings = Array.from(parent.children).filter(c => c.matches(SIBLING_MULTI_SEL));
    const a = siblings.indexOf(anchor);
    const b = siblings.indexOf(target);
    if (a >= 0 && b >= 0) {
      const [lo, hi] = a < b ? [a, b] : [b, a];
      window.deselectAll?.();
      _lastClickedBlock = anchor;
      for (let i = lo; i <= hi; i++) _selectSibling(siblings[i]);
      if (sec) window.syncSection?.(sec);
      if (_isInFreeLayout(block)) {
        _restoreFreeLayoutFrameSelected(block);
        setTimeout(_updateFreeLayoutMultiSelPanel, 0);
      } else {
        // 일반(플로우) 블록 범위선택 후 카운트 패널 갱신 (A11)
        setTimeout(() => _updateMultiSelPanel(block), 0);
      }
      return;
    }
  }

  // Path 2: 부모 다르거나 sibling 매칭 실패 — 같은 섹션 안 selectable 블록 통째 fallback
  // (sec_xxx > section-inner > row > divider | section-inner > frame[textFrame] > text-block 같이 깊이 다른 케이스)
  if (anchor && sec && sec.contains(anchor) && sec.contains(target)) {
    const all = Array.from(sec.querySelectorAll(SIBLING_MULTI_SEL));
    // text-frame 안 text-block은 frame 자체를 repr로 → 중복 회피
    const seen = new Set();
    const sibs = [];
    for (const el of all) {
      const repr = _toSibling(el);
      if (!repr || seen.has(repr)) continue;
      // repr 자체가 SIBLING_MULTI_SEL을 만족해야 함 (안전망)
      if (!repr.matches || !repr.matches(SIBLING_MULTI_SEL)) continue;
      seen.add(repr);
      sibs.push(repr);
    }
    const a = sibs.indexOf(anchor);
    const b = sibs.indexOf(target);
    if (a >= 0 && b >= 0) {
      const [lo, hi] = a < b ? [a, b] : [b, a];
      window.deselectAll?.();
      _lastClickedBlock = anchor;
      for (let i = lo; i <= hi; i++) _selectSibling(sibs[i]);
      if (sec) window.syncSection?.(sec);
      // 멀티선택 후 패널 갱신 (A11) — n>1 가드로 단일선택엔 무동작
      setTimeout(() => _updateMultiSelPanel(block), 0);
      return;
    }
  }

  // 끝까지 매칭 실패 — 단일 선택
  window.deselectAll?.();
  block.classList.add('selected');
  const li = _getBlockLayerItem(block);
  if (li) li.classList.add('active');
  _lastClickedBlock = block;
  if (sec) window.syncSection?.(sec);
  // 단일선택 fallback — n>1 가드로 카운트 패널은 자연히 안 뜸 (A11)
  setTimeout(() => _updateMultiSelPanel(block), 0);
}

/* 일반 클릭 시 앵커 업데이트 */
function setBlockAnchor(block) { _lastClickedBlock = block; }
window.toggleBlockSelect  = toggleBlockSelect;
window.rangeSelectBlocks  = rangeSelectBlocks;
window.setBlockAnchor     = setBlockAnchor;
window._restoreFreeLayoutFrameSelected = _restoreFreeLayoutFrameSelected; // QA/디버그용

/* ═══════════════════════════════════
   MULTI-SELECT STATE
═══════════════════════════════════ */
const multiSel = {
  sections: new Set(),
  cols:     new Set(),
  lastSection: null,
  lastCol:     null,
};

function clearMultiSel() {
  multiSel.sections.forEach(s => s.classList.remove('multi-selected'));
  multiSel.cols.forEach(c => c.classList.remove('multi-selected'));
  multiSel.sections.clear();
  multiSel.cols.clear();
  multiSel.lastSection = null;
  multiSel.lastCol     = null;
}

function showMultiSelPanel() {
  if (!propPanel) return;
  // freeLayout 블록 멀티셀렉이면 전용 패널으로 위임
  if (window.hasFreeLayoutMultiSel?.()) {
    window.showFreeLayoutMultiSelPanel?.();
    return;
  }
  // 기존 section/col 멀티셀렉 패널 (기존 동작 유지)
  const n = multiSel.sections.size || multiSel.cols.size;
  propPanel.innerHTML = `<div style="padding:20px;color:#888;font-size:13px;">${n}개 선택됨</div>`;
}

function selectSectionWithModifier(sec, e) {
  if (e && (e.metaKey || e.ctrlKey)) {
    // Cmd: toggle
    if (multiSel.sections.has(sec)) {
      sec.classList.remove('selected', 'multi-selected');
      multiSel.sections.delete(sec);
    } else if (sec.classList.contains('selected') && multiSel.sections.size === 0) {
      // 이미 단일 선택된 항목을 Cmd+클릭 → 선택 해제 (토글)
      sec.classList.remove('selected', 'multi-selected');
    } else {
      // 기존 단일 선택도 multiSel에 합류
      const prev = document.querySelector('.section-block.selected:not(.multi-selected)');
      if (prev && !multiSel.sections.has(prev)) {
        prev.classList.add('multi-selected');
        multiSel.sections.add(prev);
        multiSel.lastSection = prev;
      }
      sec.classList.add('selected', 'multi-selected');
      multiSel.sections.add(sec);
    }
    multiSel.lastSection = sec;
    if (multiSel.sections.size > 1) { showMultiSelPanel(); return; }
    if (multiSel.sections.size === 1) { selectSection([...multiSel.sections][0]); clearMultiSel(); return; }
    deselectAll();
  } else if (e && e.shiftKey && multiSel.lastSection) {
    // Shift: range
    const all = [...document.querySelectorAll('.section-block')];
    const a = all.indexOf(multiSel.lastSection);
    const b = all.indexOf(sec);
    const [lo, hi] = a < b ? [a, b] : [b, a];
    deselectAll();
    clearMultiSel();
    for (let i = lo; i <= hi; i++) {
      all[i].classList.add('selected', 'multi-selected');
      multiSel.sections.add(all[i]);
    }
    multiSel.lastSection = sec;
    if (multiSel.sections.size > 1) { showMultiSelPanel(); return; }
    if (multiSel.sections.size === 1) { selectSection([...multiSel.sections][0]); clearMultiSel(); return; }
  } else {
    // 일반 클릭: 단일 선택
    clearMultiSel();
    selectSection(sec);
    multiSel.lastSection = sec;
  }
}

function selectColWithModifier(col, e) {
  if (!e || (!e.metaKey && !e.ctrlKey && !e.shiftKey)) return false;
  const row = col.closest('.row');
  if (!row) return false;
  const rowCols = [...row.querySelectorAll(':scope > .col')];

  if (e.metaKey || e.ctrlKey) {
    if (multiSel.cols.has(col)) {
      col.classList.remove('selected', 'multi-selected');
      multiSel.cols.delete(col);
    } else {
      const prevCol = row.querySelector('.col.selected:not(.multi-selected)');
      if (prevCol && !multiSel.cols.has(prevCol)) {
        prevCol.classList.add('multi-selected');
        multiSel.cols.add(prevCol);
        multiSel.lastCol = prevCol;
      }
      col.classList.add('selected', 'multi-selected');
      multiSel.cols.add(col);
    }
    multiSel.lastCol = col;
    if (multiSel.cols.size > 1) { showMultiSelPanel(); return true; }
    if (multiSel.cols.size === 1) { clearMultiSel(); return false; }
    return true;
  } else if (e.shiftKey && multiSel.lastCol) {
    const a = rowCols.indexOf(multiSel.lastCol);
    const b = rowCols.indexOf(col);
    if (a === -1 || b === -1) return false;
    const [lo, hi] = a < b ? [a, b] : [b, a];
    multiSel.cols.forEach(c => c.classList.remove('selected','multi-selected'));
    multiSel.cols.clear();
    for (let i = lo; i <= hi; i++) {
      rowCols[i].classList.add('selected', 'multi-selected');
      multiSel.cols.add(rowCols[i]);
    }
    multiSel.lastCol = col;
    if (multiSel.cols.size > 1) { showMultiSelPanel(); return true; }
    if (multiSel.cols.size === 1) { clearMultiSel(); return false; }
    return true;
  }
  return false;
}

/* Cmd+D: 선택 블록 복제 (freeLayout = offset +20px, 섹션 = insertAfter) */
function duplicateSelected() {
  // freeLayout 프레임 내 블록 복제 (absolute 배치)
  const selBlock = document.querySelector(
    '.text-block.selected, .asset-block.selected, .gap-block.selected, ' +
    '.icon-circle-block.selected, .shape-block.selected, .divider-block.selected, .bridge-block.selected, .duo-block.selected, .infocard-block.selected, .innercard-block.selected, ' +
    '.graph-block.selected, .table-block.selected, ' +
    '.label-group-block.selected, .icon-text-block.selected, .icon-block.selected'
  );
  const selSS = document.querySelector('.frame-block.selected:not([data-text-frame])');
  const selSection = document.querySelector('.section-block.selected');

  // freeLayout 내 절대 배치 블록: text-frame 또는 shape-frame 래퍼 복제
  if (selBlock) {
    const absWrapper = selBlock.closest('.frame-block[data-text-frame], .frame-block[data-shape-frame]') ||
                       (selBlock.style.position === 'absolute' ? selBlock : null);
    const parentFrame = absWrapper?.closest('.frame-block[data-free-layout]');
    if (absWrapper && parentFrame) {
      window.pushHistory('복제');
      const clone = absWrapper.cloneNode(true);
      // 새 id 생성
      clone.id = 'ss_' + Math.random().toString(36).slice(2, 9);
      clone.querySelectorAll('[id]').forEach(el => {
        const prefix = el.id.split('_')[0] || 'el';
        el.id = prefix + '_' + Math.random().toString(36).slice(2, 9);
      });
      // 오프셋 +20px
      const origLeft = parseInt(absWrapper.style.left || '0');
      const origTop  = parseInt(absWrapper.style.top  || '0');
      clone.style.left = (origLeft + 20) + 'px';
      clone.style.top  = (origTop  + 20) + 'px';
      clone.dataset.offsetX = String(origLeft + 20);
      clone.dataset.offsetY = String(origTop  + 20);
      parentFrame.appendChild(clone);
      // 이벤트 재바인딩
      const _ALL_BLOCK_SEL = '.text-block, .shape-block, .asset-block, .gap-block, .icon-circle-block, .table-block, .label-group-block, .graph-block, .divider-block, .bridge-block, .duo-block, .infocard-block, .innercard-block, .icon-text-block, .icon-block, .canvas-block, .banner02-block, .comparison-block, .vector-block, .chat-block, .laurel-block, .step-block, .mockup-block, .gradient-block, .speech-bubble-block';
      clone.querySelectorAll(_ALL_BLOCK_SEL).forEach(b => {
        delete b._blockBound;
        window.bindBlock?.(b);
        // chat-block: 편집 위임은 renderChatBlock에서 바인딩되는데 bindBlock은 드래그만 처리.
        // 복사본은 renderChatBlock가 재호출되지 않아 더블클릭 편집이 안 됨 → 명시적 재렌더.
        if (b.classList.contains('chat-block')) { delete b._chatEditBound; window.renderChatBlock?.(b); }
      });
      // 복제본 자신이 블록인 경우(absWrapper=selBlock, 즉 position:absolute 블록을 직접 복제):
      // 위 querySelectorAll은 루트(clone)를 포함하지 않아 본인 드래그 바인딩이 누락된다.
      // text-block은 프레임 위임 드래그가 편집(contenteditable)에 양보하므로 자체 bindBlock이 없으면 못 움직임.
      if (clone.matches?.(_ALL_BLOCK_SEL)) {
        delete clone._blockBound;
        window.bindBlock?.(clone);
        if (clone.matches('.chat-block')) { delete clone._chatEditBound; window.renderChatBlock?.(clone); }
      }
      clone._dragBound = false;
      clone._subSecBound = false;
      window.bindFrameDropZone?.(clone);
      // 기존 선택 해제 후 복제본 선택
      deselectAll();
      const cloneBlock = clone.querySelector('.text-block, .shape-block, .asset-block') || clone;
      cloneBlock.classList.add('selected');
      parentFrame.closest('.section-block')?.classList.add('selected');
      window.buildLayerPanel?.();
      window.pushHistory('복제 완료');
      return;
    }
  }

  // freeLayout 프레임 자체 복제 (frame-block.selected)
  if (selSS && !selSS.dataset.freeLayout) {
    copySelected();
    pasteClipboard();
    return;
  }

  // 섹션 복제
  if (selSection) {
    copySelected();
    pasteClipboard();
    return;
  }

  // 일반 flow 블록 복제
  copySelected();
  pasteClipboard();
}

// 한 행(.row) 안의 «복사 대상이 될 수 있는 블록»이 전부 .selected 인지 판정.
// (copySelected 멀티셀렉트 전용 — 부분선택 시 미선택 형제까지 행째로 딸려오는 것을 막는 기준)
function _isRowFullySelected(row, allTypesSel) {
  const occupants = [...row.querySelectorAll(allTypesSel)];
  if (!occupants.length) return true; // 판정 불가(구조상 못 찾음) — 기존처럼 행 단위 취급
  return occupants.every(b => b.classList.contains('selected'));
}

function copySelected() {
  // 내부 클립보드(섹션/블록) 복사 timestamp — Cmd+V 시 외부 클립보드(스크래치 이미지)와 우선순위 비교용
  window._internalClipboardTime = Date.now();

  const MULTI_SEL = '.text-block.selected, .asset-block.selected, .gap-block.selected, ' +
    '.icon-circle-block.selected, .table-block.selected, .label-group-block.selected, ' +
    '.graph-block.selected, .divider-block.selected, .bridge-block.selected, .duo-block.selected, .infocard-block.selected, .innercard-block.selected, ' +
    '.icon-text-block.selected, .icon-block.selected, .shape-block.selected, .canvas-block.selected, .banner02-block.selected, .comparison-block.selected, ' +
    '.sticker-block.selected, .chat-block.selected, .step-block.selected, ' +
    '.laurel-block.selected, .joker-block.selected, .speech-bubble-block.selected';

  // 위와 같은 블록 타입 목록이지만 «.selected 여부 무관» — 한 행(row) 안의 블록이
  // «전부» 선택됐는지 판정할 때만 쓴다(부분선택이면 행 전체를 담지 않기 위한 기준).
  const ALL_TYPES_SEL = MULTI_SEL.replace(/\.selected\b/g, '');

  const allSel = [...document.querySelectorAll(MULTI_SEL)];

  if (allSel.length > 1) {
    // 멀티셀렉트: DOM 순서대로 고유 항목 수집.
    // ★한 행의 occupant(블록/shape-frame)가 «전부» 선택된 경우에만 행(.row) 전체를 한 덩어리로
    //   담는다(중복 페이스트 방지 + 레이아웃 비율 보존). «일부»만 선택됐으면 미선택 형제가
    //   덩달아 복사되는 것을 막기 위해 선택된 블록만 개별로 담는다(레이아웃 폭은 유실될 수 있음
    //   — 행 전체가 아니라 «일부만 골랐다»는 사용자 의도를 우선한다).
    const seen = new Set();
    const items = [];
    allSel.forEach(block => {
      let ref;
      if (block.classList.contains('shape-block')) {
        const ss = block.closest('.frame-block');
        const rowEl = ss?.closest('.row') || ss || block;
        ref = (rowEl !== ss && _isRowFullySelected(rowEl, ALL_TYPES_SEL))
          ? rowEl
          : (ss || block);
      } else if (block.classList.contains('gap-block')) {
        ref = block;
      } else {
        const rowEl = block.closest('.row');
        ref = (rowEl && _isRowFullySelected(rowEl, ALL_TYPES_SEL)) ? rowEl : block;
      }
      if (!seen.has(ref)) {
        seen.add(ref);
        const banner = ref.closest?.('.frame-block[data-banner-preset]');
        items.push({ html: ref.outerHTML, sourceBannerId: banner?.id || null });
      }
    });
    clipboard = { type: 'multi-block', items };
    return;
  }

  // 단건 copy
  const selBlock   = allSel[0] || null;
  const selShape   = selBlock?.classList.contains('shape-block') ? selBlock : null;
  const selNormal  = selShape ? null : selBlock;
  const selSS      = document.querySelector('.frame-block.selected');
  const selRow     = document.querySelector('.row.row-active');
  const selSection = document.querySelector('.section-block.selected');

  if (selShape) {
    const ss = selShape.closest('.frame-block');
    const rowEl = ss?.closest('.row') || ss || selShape;
    const banner = rowEl.closest?.('.frame-block[data-banner-preset]');
    clipboard = { type: 'block', html: rowEl.outerHTML, sourceBannerId: banner?.id || null };
  } else if (selNormal) {
    // free-layout 프레임 내 블록: absolute 래퍼(text-frame/shape-frame) 또는 자신(absolute)을 복사해
    // 좌표·절대배치를 보존(안 그러면 붙여넣기 시 일반 플로우로 들어가 스택됨).
    const _flWrapper = selNormal.closest('.frame-block[data-text-frame], .frame-block[data-shape-frame]')
      || (selNormal.style.position === 'absolute' ? selNormal : null);
    const _flFrame = _flWrapper?.closest('.frame-block[data-free-layout]');
    if (_flWrapper && _flFrame) {
      clipboard = { type: 'block', html: _flWrapper.outerHTML, freeLayout: true, sourceFrameId: _flFrame.id };
      return;
    }
    const isGapSel = selNormal.classList.contains('gap-block');
    // 스티커/플로팅 블럭은 row 밖에 absolute로 있으므로 자체 outerHTML만 복사 (closest('.row')로 잘못 wrapping 안 함)
    const isFloating = selNormal.classList.contains('sticker-block')
      || selNormal.classList.contains('chat-block')
      || selNormal.classList.contains('laurel-block')
      || selNormal.classList.contains('joker-block');
    const target = (isGapSel || isFloating) ? selNormal : (selNormal.closest('.row') || selNormal);
    const banner = target.closest?.('.frame-block[data-banner-preset]');
    clipboard = { type: 'block', html: target.outerHTML, sourceBannerId: banner?.id || null };
  } else if (selSS) {
    // 서브섹션은 row > col > frame-block 구조이므로 row 단위로 복사
    const rowEl = selSS.closest('.row') || selSS;
    clipboard = { type: 'block', html: rowEl.outerHTML };
  } else if (selRow) {
    clipboard = { type: 'block', html: selRow.outerHTML };
  } else if (selSection) {
    clipboard = { type: 'section', html: selSection.outerHTML };
  }
}

/* 붙여넣기 후 블록 이벤트 재바인딩 공통 함수 */
function _bindPastedEl(el) {
  const rand = () => Math.random().toString(36).slice(2, 9);
  const BLOCK_SEL = '.text-block, .asset-block, .gap-block, .icon-circle-block, .table-block, .label-group-block, .graph-block, .divider-block, .bridge-block, .duo-block, .infocard-block, .innercard-block, .icon-text-block, .icon-block, .shape-block, .joker-block, .canvas-block, .banner02-block, .comparison-block, .vector-block, .chat-block, .laurel-block, .step-block, .mockup-block, .gradient-block, .speech-bubble-block';

  // 모든 ID 재생성 — 원본과 ID 충돌 방지
  el.querySelectorAll('[id]').forEach(child => {
    const prefix = child.id.split('_')[0] || 'el';
    child.id = `${prefix}_${rand()}`;
  });
  if (el.id) {
    const prefix = el.id.split('_')[0] || 'el';
    el.id = `${prefix}_${rand()}`;
  }

  // frame-block 재바인딩 — el 자체 포함
  const frames = [...el.querySelectorAll('.frame-block')];
  if (el.classList.contains('frame-block')) frames.unshift(el);
  frames.forEach(ss => {
    ss._subSecBound = false;
    window.bindFrameDropZone?.(ss);
  });

  // 일반 블록 재바인딩 — el 자체 포함 (_blockBound 리셋 후)
  const blocks = [...el.querySelectorAll(BLOCK_SEL)];
  if (el.matches?.(BLOCK_SEL)) blocks.unshift(el);
  blocks.forEach(b => {
    b._blockBound = false;
    window.bindBlock(b);
    // canvas-block: renderCanvas로 ResizeObserver 재연결
    if (b.classList.contains('canvas-block')) window.renderCanvas?.(b);
    // banner02-block: renderBanner02로 ResizeObserver 재연결
    if (b.classList.contains('banner02-block')) window.renderBanner02?.(b);
    if (b.classList.contains('comparison-block')) window.renderComparison?.(b);
    // chat-block: 더블클릭 편집 위임 재바인딩 (복사본 수정 불가 버그 수정 — bindBlock은 드래그만 처리)
    if (b.classList.contains('chat-block')) { delete b._chatEditBound; window.renderChatBlock?.(b); }
    // bridge-block: data-bridge-*로 path 재생성 + 대상 섹션 패딩 기준 full-bleed 재적용 (붙여넣기, 코덱스 b3-2)
    if (b.classList.contains('bridge-block')) { window.renderBridgeBlock?.(b); window.applyBridgeFullBleed?.(b); }
    if (b.classList.contains('duo-block')) window.renderDuoBlock?.(b);
    if (b.classList.contains('infocard-block')) window.renderInfoCardBlock?.(b);
    if (b.classList.contains('innercard-block')) window.renderInnerCardBlock?.(b);
  });
}

// 붙여넣은 최상위 요소가 freeLayout이 아닌 부모로 들어가면 absolute 좌표는
// 무의미해진다(원본 banner-preset 등에서 복사된 경우). normal flow로 떨어뜨린다.
function _normalizePastedAbsolute(el) {
  if (!el) return;
  const parent = el.parentElement;
  // free-layout 프레임 자식이면 absolute 좌표·offset(left/top/right/bottom, offsetX/offsetY)을
  // 그대로 보존한다. parent 직속 dataset 우선, 없으면 closest로 보강(중첩 free-layout 프레임 대응).
  const freeContainer = parent && (
    parent.dataset?.freeLayout === 'true' ||
    parent.closest?.('.frame-block[data-free-layout="true"]')
  );
  if (freeContainer) return;
  if (el.style.position === 'absolute') {
    el.style.position = '';
    el.style.left = '';
    el.style.top = '';
    el.style.right = '';
    el.style.bottom = '';
  }
}

// banner-preset 안에서 복사한 자식이라면 같은 banner 안에 +20px 오프셋으로 복제.
// banner가 더 이상 없으면 null 반환 → 호출부에서 일반 paste 경로로 fallback.
function _pasteIntoSourceBanner(el, sourceBannerId) {
  if (!sourceBannerId || !el) return null;
  const banner = document.getElementById(sourceBannerId);
  if (!banner || !banner.dataset?.bannerPreset) return null;
  if (banner.dataset?.freeLayout !== 'true') return null;
  banner.appendChild(el);
  el.style.position = 'absolute';
  const lx = parseInt(el.style.left || '0', 10) + 20;
  const ly = parseInt(el.style.top  || '0', 10) + 20;
  el.style.left = lx + 'px';
  el.style.top  = ly + 'px';
  el.style.marginLeft = '';
  el.style.marginTop  = '';
  return banner;
}

function pasteClipboard() {
  if (!clipboard) { window.showToast?.('복사한 것이 없어요'); return; }
  // 현재 DOM 상태가 마지막 히스토리와 다르면 체크포인트 저장
  // (block-factory.js가 push-before라서 최신 N개 블록 상태가 히스토리에 없는 경우 대비)
  window.ensureHistoryCheckpoint?.('붙여넣기 전');

  if (clipboard.type === 'multi-block') {
    const sec = getSelectedSection() || document.querySelector('.section-block:last-child');
    if (!sec) { window.showNoSelectionHint?.(); return; }
    let lastEl = null;
    clipboard.items.forEach(item => {
      const temp = document.createElement('div');
      temp.innerHTML = item.html;
      const el = temp.firstElementChild;
      if (!el) return;
      // banner 내부 출처면 같은 banner 안에 복제
      const banner = _pasteIntoSourceBanner(el, item.sourceBannerId);
      if (banner) {
        _bindPastedEl(el);
        lastEl = el;
        return;
      }
      if (lastEl) {
        lastEl.after(el);
      } else {
        const pasteHasSS = el.classList.contains('frame-block') || !!el.querySelector('.frame-block');
        const savedActiveSS = window._activeFrame;
        if (pasteHasSS) window._activeFrame = null;
        insertAfterSelected(sec, el);
        if (pasteHasSS) window._activeFrame = savedActiveSS;
      }
      _bindPastedEl(el);
      _normalizePastedAbsolute(el);
      lastEl = el;
    });
    window.buildLayerPanel();
    pushHistory('붙여넣기');
    return;
  }

  const temp = document.createElement('div');
  temp.innerHTML = clipboard.html;
  const el = temp.firstElementChild;

  if (clipboard.type === 'section') {
    const genIdFn = window.genId || ((p) => p + '_' + Math.random().toString(36).slice(2, 9));
    el.id = genIdFn('sec');
    el.querySelectorAll('[id]').forEach(child => {
      const prefix = child.id.split('_')[0] || 'el';
      child.id = genIdFn(prefix);
    });
    const refSection = getSelectedSection();
    if (refSection) {
      refSection.after(el);
    } else {
      canvasEl.appendChild(el);
    }
    bindSectionDelete(el);
    bindSectionOrder(el);
    bindSectionDrag(el);
    bindSectionDropZone(el);
    _bindPastedEl(el);
    el.addEventListener('click', e2 => { e2.stopPropagation(); selectSectionWithModifier(el, e2); });
  } else if (clipboard.freeLayout) {
    // free-layout 프레임 내 블록 붙여넣기 — 원본(또는 선택된) free-layout 프레임에 +20px 오프셋 절대배치.
    // duplicateSelected의 freeLayout 분기 미러.
    const frame = (clipboard.sourceFrameId && document.getElementById(clipboard.sourceFrameId))
      || document.querySelector('.frame-block[data-free-layout].selected')
      || (window._activeFrame?.dataset?.freeLayout ? window._activeFrame : null);
    if (!frame) {
      // 대상 프레임 못 찾음 → 일반 경로 폴백(섹션 끝에 삽입)
      const sec = getSelectedSection() || document.querySelector('.section-block:last-child');
      if (sec) { insertAfterSelected(sec, el); _bindPastedEl(el); _normalizePastedAbsolute(el); }
    } else {
      // ★붙여넣기도 «새 블록»이다 — 전역 genId 를 써야 actorId 조각이 붙는다.
      const _gid = (p) => (typeof window.genId === 'function'
        ? window.genId(p)
        : p + '_' + Math.random().toString(36).slice(2, 9));
      el.id = _gid('ss');
      el.querySelectorAll('[id]').forEach(c => { const p = c.id.split('_')[0] || 'el'; c.id = _gid(p); });
      const ox = parseInt(el.style.left || '0'), oy = parseInt(el.style.top || '0');
      el.style.left = (ox + 20) + 'px'; el.style.top = (oy + 20) + 'px';
      el.dataset.offsetX = String(ox + 20); el.dataset.offsetY = String(oy + 20);
      frame.appendChild(el);
      const _ALL = '.text-block, .shape-block, .asset-block, .gap-block, .icon-circle-block, .table-block, .label-group-block, .graph-block, .divider-block, .bridge-block, .duo-block, .infocard-block, .innercard-block, .icon-text-block, .icon-block, .canvas-block, .banner02-block, .comparison-block, .vector-block, .chat-block, .laurel-block, .step-block, .mockup-block, .gradient-block, .speech-bubble-block';
      el.querySelectorAll(_ALL).forEach(b => { delete b._blockBound; window.bindBlock?.(b); });
      if (el.matches?.(_ALL)) { delete el._blockBound; window.bindBlock?.(el); }
      el._dragBound = false; el._subSecBound = false; window.bindFrameDropZone?.(el);
      deselectAll();
      const cb = el.querySelector('.text-block, .shape-block, .asset-block') || el;
      cb.classList.add('selected');
      frame.closest('.section-block')?.classList.add('selected');
    }
  } else {
    // banner 내부 출처면 같은 banner 안에 복제
    const banner = _pasteIntoSourceBanner(el, clipboard.sourceBannerId);
    if (banner) {
      _bindPastedEl(el);
    } else if (el.classList.contains('sticker-block')) {
      // 스티커: section 안에 absolute로 +20px 오프셋해 추가
      const sec = getSelectedSection() || document.querySelector('.section-block:last-child');
      if (!sec) { window.showNoSelectionHint?.(); return; }
      sec.appendChild(el);
      // ID 재생성 (기존 _bindPastedEl이 처리)
      _bindPastedEl(el);
      // 위치 오프셋
      const curX = parseInt(el.dataset.x) || parseInt(el.style.left) || 0;
      const curY = parseInt(el.dataset.y) || parseInt(el.style.top) || 0;
      el.dataset.x = String(curX + 20);
      el.dataset.y = String(curY + 20);
      window.renderStickerBlock?.(el);
      window.bindStickerSelect?.(el);
    } else {
      const sec = getSelectedSection() || document.querySelector('.section-block:last-child');
      if (!sec) { window.showNoSelectionHint?.(); return; }
      const pasteHasSS = el.classList.contains('frame-block') || !!el.querySelector('.frame-block');
      const savedActiveSS = window._activeFrame;
      if (pasteHasSS) window._activeFrame = null;
      insertAfterSelected(sec, el);
      if (pasteHasSS) window._activeFrame = savedActiveSS;
      _bindPastedEl(el);
      _normalizePastedAbsolute(el);
    }
  }
  window.buildLayerPanel();
  pushHistory('붙여넣기');
}

// Option 키 독립 추적 (Korean IME가 altKey를 먹어버리는 문제 대응)
window._optionKeyHeld = false;
document.addEventListener('keydown', e => { if (e.code === 'AltLeft' || e.code === 'AltRight') window._optionKeyHeld = true; }, true);
document.addEventListener('keyup',   e => { if (e.code === 'AltLeft' || e.code === 'AltRight') window._optionKeyHeld = false; }, true);
// ★ stuck 방지: Option을 누른 채 창 포커스/가시성을 잃으면(앱 전환·Spotlight·Alt-tab) keyup을 못 받아
//   _optionKeyHeld가 영구 true로 남고 → ⌘G가 ⌘⌥G(프레임 묶기)로 오라우팅돼 스크래치/블록 그룹이 안 된다.
//   포커스 이탈·창 숨김 시 해제해 재발 차단. (IME 대응 위해 flag 자체는 유지 — e.altKey는 한글IME서 신뢰불가)
window.addEventListener('blur', () => { window._optionKeyHeld = false; });
document.addEventListener('visibilitychange', () => { if (document.hidden) window._optionKeyHeld = false; });

// 갭 블록 높이 키 조정 후 keyup 시 undo 기록
document.addEventListener('keyup', e => {
  if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (document.querySelector('.gap-block.selected')) pushHistory();
});

/* #13 ⌥+a/s/d: 현재 선택 블록들을 «부모 섹션(section-inner) 기준»으로 좌/중/우 정렬(a=좌·s=중·d=우).
   (구 ⌥+숫자에서 이전 — 숫자 네임스페이스 갭/텍스트타입 충돌 회피, 현빈 지시.)
   ⌥의 기준은 항상 «블록이 속한 부모 섹션»이다(페이지/캔버스 아님).
   section-inner는 flex-direction:column이라 자식의 가로 위치는 align-self가 지배(#10 prop-text-wireup-align 참고):
   left→flex-start, center→center, right→flex-end.
   폭 100% 블록(text-block 기본 width:100%)은 align-self로 시각 변화가 없다 — 무해.
   asset/frame/shape 등 커스텀 폭(<100%) 블록에서만 실제 좌우 이동이 보인다.
   섹션 자신을 선택한 경우는 부모가 캔버스라 여기 대상 셀렉터에 안 잡힘 → no-op. 대상 0개도 no-op. */
function alignSelectedToParent(dir) {
  const map = { left: 'flex-start', center: 'center', right: 'flex-end' };
  const val = map[dir];
  if (!val) return;
  // 선택 집합 규약: FLOW_BLOCK_SEL_SELECTED(SSOT) + shape/frame. 각 블록은 부모 섹션이 있어야 대상.
  const ALIGN_SEL = FLOW_BLOCK_SEL_SELECTED + ', .shape-block.selected, .frame-block.selected';
  const blocks = [...document.querySelectorAll(ALIGN_SEL)].filter(b => b.closest('.section-block'));
  if (!blocks.length) return; // 섹션만 선택/무선택 등 대상 없으면 no-op
  blocks.forEach(b => { b.style.alignSelf = val; }); // 선택 상태(.selected)는 그대로 유지
  window.pushHistory?.('부모 기준 정렬');
  window.scheduleAutoSave?.();
}

/* ═══════════════════════════════════
   #8 갭 병합 (⌘M) — «연속(인접)»만 병합
   선택된 .gap-block 들을 같은 부모(section-inner/frame-block/row) 안에서
   DOM상 «바로 이웃한» 런(run)으로 묶어, 각 런의 높이를 합쳐 첫 갭에 몰고
   나머지 갭은 제거한다. 사이에 다른 블록(비선택·비갭)이 낀 갭은 다른 런.
   떨어진 선택은 각 연속 런만 병합하고 나머지는 그대로 둔다.
═══════════════════════════════════ */
/* ★「섹션을 골랐다」를 «섹션만» 골랐을 때로 좁힌다.
   블록을 클릭하면 syncSection 이 그 섹션에도 .selected 를 붙인다 — 그래서
   `.section-block.selected` 만 보면 «거의 항상 참»이고, 블록 하나 고른 사람이
   ⌘M 을 누르면 섹션이 통째로 합쳐진다(실측: 3→2).
   ⇒ 섹션 아닌 .selected 가 하나라도 있으면 「섹션을 고른 것」이 아니다. */
function _sectionOnlySelection() {
  const sec = document.querySelector('.section-block.selected');
  if (!sec) return false;
  // 섹션이 여러 개 골라져 있어도 «섹션만» 이면 합치기 대상이다(전부 합친다)
  const other = [...document.querySelectorAll('.selected')].find(el =>
    el !== document.body && !el.classList.contains('section-block') && !el.classList.contains('layer-item'));
  return !other;
}

function mergeSelectedGaps() {
  const gaps = [...document.querySelectorAll('.gap-block.selected')];
  if (gaps.length < 2) return; // 1개/무선택 → no-op

  // 부모(=section-inner/frame-block/row) 기준 그룹화. 다른 부모 = 다른 컨텍스트(타 섹션 등)
  const byParent = new Map();
  for (const g of gaps) {
    const p = g.parentElement;
    if (!p) continue;
    if (!byParent.has(p)) byParent.set(p, []);
    byParent.get(p).push(g);
  }

  let merged = false;
  let firstKept = null; // 병합 후 선택 유지할 대표 갭

  // #8 보정(현빈 실데이터) — 두 갭 «사이»에 «보이지 않는» 팬텀 블록(0높이 or display:none)이 끼면
  // 이전엔 DOM 인덱스차>1로 «비인접» 판정해 ⌘M 병합을 거부했다(예: 높이0·빈 frame-block).
  // 팬텀은 «사이»로 세지 말고 건너뛰어 인접으로 본다. 갭은 팬텀에서 제외(미선택 갭은 그대로 경계).
  const _isPhantom = (el) => !el.classList.contains('gap-block') && el.offsetHeight === 0;
  // 흡수 제거 대상 = 팬텀 중 «빈»것(텍스트·미디어·입력 없음). display:none이라도 내용 있으면 보존(데이터 손실 방지).
  const _isEmptyPhantom = (el) => _isPhantom(el)
    && !el.textContent.trim()
    && !el.querySelector('img,svg,canvas,video,input,textarea,select');

  for (const [parent, groupGaps] of byParent) {
    if (groupGaps.length < 2) continue;
    const kids = [...parent.children];
    // DOM 순서 정렬
    groupGaps.sort((a, b) => kids.indexOf(a) - kids.indexOf(b));
    // 연속(인접) 런으로 분해 — 두 갭 사이 형제가 «전부 팬텀»이면 같은 런(팬텀 건너뛰기)
    const runs = [];
    let run = [groupGaps[0]];
    for (let i = 1; i < groupGaps.length; i++) {
      const prevIdx = kids.indexOf(groupGaps[i - 1]);
      const curIdx  = kids.indexOf(groupGaps[i]);
      const between = kids.slice(prevIdx + 1, curIdx); // 두 갭 사이 형제들(빈 배열=직접 인접)
      if (between.every(_isPhantom)) {
        run.push(groupGaps[i]);
      } else {
        runs.push(run);
        run = [groupGaps[i]];
      }
    }
    runs.push(run);

    for (const r of runs) {
      if (r.length < 2) continue; // 길이 1은 병합 대상 아님(그대로 둠)
      const head = r[0], last = r[r.length - 1];
      const hi = kids.indexOf(head), li = kids.indexOf(last);
      const span = kids.slice(hi, li + 1); // head..last 포함(사이 팬텀도 포함)
      // 각 갭의 실제 렌더 높이 합산(offsetHeight = CSS/inline 반영된 실측). 팬텀은 0높이라 무영향.
      const total = r.reduce((sum, g) => sum + (g.offsetHeight || parseInt(g.style.height, 10) || 0), 0);
      head.style.height = total + 'px';
      // head 이후 span: 나머지 런 갭 제거 + 빈 0높이 팬텀 흡수 제거(지디 권장). 내용 있는 팬텀은 보존.
      for (const el of span) {
        if (el === head) continue;
        if (el.classList.contains('gap-block')) {
          el.classList.remove('selected');
          el.remove();
        } else if (_isEmptyPhantom(el)) {
          el.remove();
        }
      }
      merged = true;
      if (!firstKept) firstKept = head; // 첫 병합 런의 대표 갭
    }
  }

  if (!merged) return; // 연속 런(길이≥2)이 하나도 없으면 no-op

  window.pushHistory?.('갭 병합');
  window.scheduleAutoSave?.();
  window.buildLayerPanel?.();
  // 레이어 갱신으로 소실될 수 있는 선택 상태 복원(대표 갭 1개 유지)
  if (firstKept) firstKept.classList.add('selected');
}

document.addEventListener('keydown', e => {
  // contenteditable 편집 중: 에디터 전역 단축키 차단
  // (단, Escape는 element 레벨에서 stopPropagation으로 처리 / Cmd 단축키는 통과)
  if (document.activeElement?.isContentEditable && !e.metaKey && !e.ctrlKey) return;

  // ⌘, (Comma) — 환경설정 모달 열기 (시스템 표준)
  if ((e.metaKey || e.ctrlKey) && e.code === 'Comma' && !e.shiftKey && !e.altKey) {
    e.preventDefault();
    if (typeof window.openSettingsModal === 'function') window.openSettingsModal();
    return;
  }

  // 패널 접기/펼치기 — Figma 키 의미에 맞춘 배치.
  //   ⌘\   좌측 패널      ⌘⌥\  우측(속성) 패널
  //   ⌘⇧\  좌우 동시 = Figma의 "Minimize UI"(⌘⇧\)와 같은 의미. 우측 단독에 ⇧를 쓰면
  //        피그마에서 전체 최소화를 기대하고 누른 손이 어긋나므로 ⌥로 뺐다.
  if ((e.metaKey || e.ctrlKey) && e.code === 'Backslash') {
    e.preventDefault();
    if (e.shiftKey) {
      // 하나라도 펼쳐져 있으면 둘 다 접고, 둘 다 접혀 있으면 둘 다 펼친다.
      const next = !(window.isLeftPanelCollapsed?.() && window.isRightPanelCollapsed?.());
      window.toggleLeftPanel?.(next);
      window.toggleRightPanel?.(next);
    } else if (e.altKey) {
      window.toggleRightPanel?.();
    } else {
      window.toggleLeftPanel?.();
    }
    return;
  }

  // ⌘M — 병합. ★preventDefault 필수(Electron '창 최소화' 가속기와 충돌).
  //   컨텍스트 분기: 갭 선택 → #8 갭 병합 / 테이블 셀 선택 → #5-b 셀 병합
  //                 / 섹션만 선택 → 섹션 합치기 / 아무것도 아니면 no-op.
  //   ★섹션은 «맨 뒤»다. 섹션은 블록을 고르면 같이 selected 로 남는 일이 많아서,
  //     앞에 두면 셀·갭 병합을 가로챈다. 좁은 대상이 먼저다.
  if ((e.metaKey || e.ctrlKey) && e.code === 'KeyM' && !e.shiftKey && !e.altKey) {
    /* ★입력 중엔 «아무것도 하지 않는다».
       맥에서 ⌘M 은 「창 최소화」 손버릇이고 이 분기가 preventDefault 로 가로챈다.
       예전엔 그 대가가 no-op 이었지만 섹션 합치기가 붙은 뒤로는 «파괴 편집»이 된다.
       같은 핸들러의 다른 ⌘단축키 21곳엔 이 가드가 이미 있다 — ⌘M 에만 없었다. */
    if (document.querySelector('.text-block.editing, .label-group-block.editing')) return;
    if (document.body.classList.contains('preview-mode')) return;
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
    const ae = document.activeElement;
    if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.tagName === 'SELECT' || ae.isContentEditable)) return;
    e.preventDefault();
    if (document.querySelector('.gap-block.selected')) {
      mergeSelectedGaps();
    } else if (document.querySelector('.table-block .tb-table td.cell-selected')) {
      /* #5-b 테이블 바디셀 병합 (table-cell-select.js) */
      window.mergeSelectedCells?.();
    } else if (_sectionOnlySelection()) {
      /* 섹션 합치기 (section-merge.js) — 「바로 위 섹션과 하나로」 */
      window.mergeSelectedSectionUp?.();
    }
    return;
  }

  if (e.metaKey || e.ctrlKey) {
    if (e.key === '=' || e.key === '+') {
      e.preventDefault();
      document.body.classList.contains('preview-mode') ? window.previewZoomStep?.(10) : zoomStep(10);
    }
    if (e.key === '-') {
      e.preventDefault();
      document.body.classList.contains('preview-mode') ? window.previewZoomStep?.(-10) : zoomStep(-10);
    }
    if (e.key === '0')                  { e.preventDefault(); applyZoom(100); }
    if (e.key === 'z' && !e.shiftKey)   { if (document.activeElement?.isContentEditable) return; e.preventDefault(); undo(); return; }
    // ★Shift+z 는 브라우저가 key:'Z'(대문자)로 준다 — 소문자만 검사하면 ⌘⇧Z redo 가 «전혀» 안 먹는다.
    //   바로 아래 취소선(⌘⇧X)이 (e.key==='x'||e.key==='X') 로 둘 다 받는 것과 같은 규약으로 맞춘다.
    if ((e.key === 'z' || e.key === 'Z') && e.shiftKey) { if (document.activeElement?.isContentEditable) return; e.preventDefault(); redo(); return; }
    if (e.code === 'KeyF' && !e.shiftKey && !e.altKey) {
      // ⌘F — 섹션 검색이동 팔레트. 편집/입력 중엔 양보(기본 동작도 막지 않음).
      if (document.querySelector('.text-block.editing')) return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT' || e.target.isContentEditable) return;
      // I3-F1: openSectionSearch 없으면 preventDefault 안 함 → 브라우저 기본 찾기 허용(no-op로 막지 않음).
      if (typeof window.openSectionSearch === 'function') {
        e.preventDefault();
        window.openSectionSearch();
      }
      return;
    }
    // ⌘S = 실제 저장(가드 포함 정식 경로) + 토스트. saveProject()는 commit-modal을 열지만
    // 커밋 기능은 MVP 숨김(tb-hidden-mvp)이라 봉인된 데드 모달이 소환되던 버그 — commit-system은 봉인 유지.
    if (e.key === 's' && !e.shiftKey)   {
      e.preventDefault();
      window.triggerAutoSave?.();
      window.showToast?.('💾 저장됨');
      return;
    }
    if (e.key === 's' && e.shiftKey)    { e.preventDefault(); saveProjectAs(); return; }
    if (e.key === 'b' && !e.shiftKey) {
      if (document.activeElement?.isContentEditable || document.querySelector('.text-block.editing')) {
        e.preventDefault();
        document.execCommand('bold');
        window.pushHistory?.();
        return;
      }
    }
    if (e.key === 'i' && !e.shiftKey) {
      if (document.activeElement?.isContentEditable || document.querySelector('.text-block.editing')) {
        e.preventDefault();
        document.execCommand('italic');
        window.pushHistory?.();
        return;
      }
    }
    // 취소선 ⌘⇧X — 편집 중=부분 취소선, 블럭 선택=패널 S버튼과 동일한 블럭 토글.
    // ⚠️ 한글 IME에선 shift 조합도 e.key가 'x'(소문자)로 올 수 있어 shift 조합은 여기서
    // 반드시 소진(return)해야 아래 잘라내기(e.key==='x')로 새서 블럭이 삭제되지 않는다.
    if ((e.key === 'x' || e.key === 'X') && e.shiftKey) {
      if (document.activeElement?.isContentEditable || document.querySelector('.text-block.editing')) {
        e.preventDefault();
        document.execCommand('strikeThrough');
        window.pushHistory?.();
        return;
      }
      if (document.querySelector('.text-block.selected')) {
        e.preventDefault();
        document.getElementById('txt-strike-btn')?.click();
      }
      return;
    }
    if (e.key === 'c') {
      if (document.querySelector('.text-block.editing')) return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT' || e.target.isContentEditable) return;
      copySelected();
      return;
    }
    if (e.key === 'v') {
      if (document.querySelector('.text-block.editing')) return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT' || e.target.isContentEditable) return;
      // 우선순위: 가장 최근 Cmd+C 액션이 내부(섹션) vs 외부(스크래치 이미지) 중 어느 것인지로 분기
      // 동률(둘 다 0 또는 같은 시각) 시 scratch 우선 — 외부 이미지 paste를 막지 않기 위함
      const internalT = window._internalClipboardTime || 0;
      const scratchT  = window._scratchClipboardTime  || 0;
      if (internalT > scratchT) {
        // 섹션/블록이 더 최근 → 즉시 섹션 paste, scratch-pad는 양보
        pasteClipboard();
      } else {
        // scratch 이미지가 더 최근 또는 동률 → paste 이벤트 양보, 처리 안 됐을 때만 fallback
        setTimeout(() => {
          if (window._scratchJustHandledPaste) { window._scratchJustHandledPaste = false; return; }
          pasteClipboard();
        }, 30);
      }
      return;
    }
    if (e.key === 'x' && !e.shiftKey) {
      // 잘라내기 = 복사 후 삭제 (copySelected + Delete와 동일한 삭제 로직 deleteSelectedFromCanvas 공유)
      // shift 조합 배제 — 한글 IME에서 ⌘⇧X(취소선)가 e.key 'x'로 들어와 오삭제되는 경로 차단
      if (document.querySelector('.text-block.editing')) return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT' || e.target.isContentEditable) return;
      e.preventDefault();
      copySelected();
      deleteSelectedFromCanvas();
      return;
    }
    if (e.key === 'd') {
      if (document.querySelector('.text-block.editing')) return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT' || e.target.isContentEditable) return;
      e.preventDefault();
      duplicateSelected();
      return;
    }
    if (e.code === 'BracketLeft') {
      if (document.querySelector('.text-block.editing')) return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT' || e.target.isContentEditable) return;
      e.preventDefault();
      moveSelectedBlocks('up');
      return;
    }
    if (e.code === 'BracketRight') {
      if (document.querySelector('.text-block.editing')) return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT' || e.target.isContentEditable) return;
      e.preventDefault();
      moveSelectedBlocks('down');
      return;
    }
    // wrapInFrame (기본: ⌘⌥G, IME 처리로 e.key === '©' 도 매칭)
    const _isWrapFrame = window._matchShortcut
      ? window._matchShortcut(e, 'wrapInFrame')
      : (e.code === 'KeyG' && e.metaKey && !e.shiftKey && e.altKey);
    if (_isWrapFrame || (e.code === 'KeyG' && e.metaKey && !e.shiftKey && (e.altKey || window._optionKeyHeld || e.key === '©'))) {
      if (document.querySelector('.text-block.editing')) return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT' || e.target.isContentEditable) return;
      e.preventDefault();
      window.wrapSelectedBlocksInFrame?.();
      return;
    }
    // groupBlocks (기본: ⌘G)
    const _isGroup = window._matchShortcut
      ? window._matchShortcut(e, 'groupBlocks')
      : (e.code === 'KeyG' && e.metaKey && !e.shiftKey && !e.altKey);
    if (_isGroup && !window._optionKeyHeld && e.key !== '©') {
      if (document.querySelector('.text-block.editing')) return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT' || e.target.isContentEditable) return;
      e.preventDefault();
      // 스크래치 다중 선택 상태면 스크래치 정렬+그룹 (같은 단축키)
      if (typeof window._scratchHasSelection === 'function' && window._scratchHasSelection()) {
        window._scratchGroupAndAlign?.();
      } else {
        window.groupSelectedBlocks?.();
      }
      return;
    }
    // ungroup (기본: ⌘⇧G)
    const _isUngroup = window._matchShortcut
      ? window._matchShortcut(e, 'ungroup')
      : (e.code === 'KeyG' && e.metaKey && e.shiftKey);
    if (_isUngroup) {
      if (document.querySelector('.text-block.editing')) return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT' || e.target.isContentEditable) return;
      e.preventDefault();
      // 스크래치 그룹 아이템 선택 상태면 스크래치 언그룹 우선 (Cmd+G 스크래치 분기와 동일 우선순위)
      if (typeof window._scratchHasGroupSelection === 'function' && window._scratchHasGroupSelection()) {
        window._scratchUngroup?.();
        return;
      }
      // 피그마식 그룹(data-group 프레임) 우선, 없으면 레거시 group-block
      const selGroup = document.querySelector('.frame-block[data-group="true"].selected')
        || document.querySelector('.group-block.group-selected');
      if (selGroup) window.ungroupBlock?.(selGroup);
      return;
    }
    if (e.key === 'a') {
      if (document.querySelector('.text-block.editing')) return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT' || e.target.isContentEditable) return;
      e.preventDefault();
      // 현재 선택된 섹션 내 모든 블록 선택
      const activeSec = document.querySelector('.section-block.selected') || document.querySelector('.section-block');
      if (activeSec) {
        const allBlocks = activeSec.querySelectorAll(
          '.text-block, .asset-block, .gap-block, .icon-circle-block, .table-block, ' +
          '.label-group-block, .graph-block, .divider-block, .bridge-block, .duo-block, .infocard-block, .innercard-block, .icon-text-block, .canvas-block, .banner02-block, .comparison-block, .vector-block'
        );
        allBlocks.forEach(b => b.classList.add('selected'));
      }
      return;
    }
  }
  // 스포이드 (i) — 편집 아님 + 블록 선택 상태에서 화면 픽셀 색을 대상에 추출 적용.
  // #9 대상 확장: 텍스트(글자색) > 쉐이프(fill) > 섹션(배경색), 우선순위 단일 대상.
  // ⌘I(이탤릭)는 위 metaKey 분기에서 이미 소진되므로 여기는 modifier 없는 순수 i만 처리.
  if (e.code === 'KeyI' && !e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey) {
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || document.activeElement?.isContentEditable) return;
    if (document.querySelector('.text-block.editing')) return;
    const textTargets  = Array.from(document.querySelectorAll('.text-block.selected'));
    const shapeTargets = textTargets.length ? [] : Array.from(document.querySelectorAll('.shape-block.selected'));
    const sectionTargets = (textTargets.length || shapeTargets.length) ? [] : Array.from(document.querySelectorAll('.section-block.selected'));
    if (textTargets.length || shapeTargets.length || sectionTargets.length) {
      e.preventDefault();
      if (!window.EyeDropper) { window.showToast?.('이 브라우저는 스포이드 미지원'); return; }
      (async () => {
        try {
          const res = await new window.EyeDropper().open();
          const hex = res?.sRGBHex;
          if (!hex) return;
          if (textTargets.length) {
            // applyTextBlockColor가 내부에서 pushHistory+autosave 수행 → 여기서 중복 호출 안 함
            textTargets.forEach(tb => window.applyTextBlockColor?.(tb, hex));
          } else if (shapeTargets.length) {
            // prop-shape.js applyColor 규약과 동일: dataset.shapeColor + 그라데이션 해제 + svg.style.color(currentColor fill)
            // ★changed로 조건화 — 동일색 재추출(전건 스킵)에 빈 undo 스텝이 쌓이던 것 방지(고디터QA LOW).
            let changed = 0;
            shapeTargets.forEach(sb => {
              if (sb.dataset.shapeColor === hex && !sb.dataset.shapeGradient) return;
              sb.dataset.shapeColor = hex;
              const svg = sb.querySelector('svg');
              if (svg) {
                if (sb.dataset.shapeGradient) window._clearShapeGradient?.(sb);
                svg.style.color = hex;
              }
              changed++;
            });
            if (changed) { window.pushHistory?.('쉐이프 색 추출'); window.scheduleAutoSave?.(); }
          } else {
            // prop-section.js 색 규약과 동일: dataset.bg + 인라인 배경(이미지 해제)
            // ★동일색 가드 + changed 조건화(고디터QA LOW — 섹션 분기는 가드 자체가 없어 빈 undo가 쌓였다).
            let changed = 0;
            sectionTargets.forEach(sec => {
              if (sec.dataset.bg === hex && sec.style.backgroundImage === 'none') return;
              sec.dataset.bg = hex;
              sec.style.backgroundImage = 'none';
              sec.style.backgroundColor = hex;
              changed++;
            });
            if (changed) { window.pushHistory?.('섹션 배경 추출'); window.scheduleAutoSave?.(); }
          }
        } catch (_) { /* 사용자 취소 — 조용히 무시 */ }
      })();
      return;
    }
  }

  // pinToggle (기본: `)
  const _isPinToggle = window._matchShortcut
    ? window._matchShortcut(e, 'pinToggle')
    : (e.code === 'Backquote' && !e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey);
  if (_isPinToggle) {
    if (document.activeElement?.isContentEditable) return;
    e.preventDefault();
    window.togglePinMode?.();
    return;
  }

  // vectorPen 토글 (기본: P) — 입력/contenteditable 가드
  if (e.code === 'KeyP' && !e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey) {
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || document.activeElement?.isContentEditable) {
      // 입력 중이면 펜 토글 안 함 (글자 입력 보존)
    } else {
      e.preventDefault();
      window.toggleVectorPenMode?.();
      return;
    }
  }

  // addSection (기본: S)
  const _isAddSection = window._matchShortcut
    ? window._matchShortcut(e, 'addSection')
    : (e.code === 'KeyS' && !e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey);
  if (_isAddSection) {
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable) return;
    e.preventDefault();
    window.addSection?.();
    return;
  }

  // Shift+F1~F9: 섹션 단축키 등록 / F1~F9: 해당 섹션으로 이동 (스타크래프트식)
  // Mac 매직키보드: Fn+F1(이동), Shift+Fn+F1(등록) / Windows: F1(이동), Shift+F1(등록)
  {
    const fMatch = e.code.match(/^F([1-9])$/);
    if (fMatch && !e.metaKey && !e.ctrlKey) {
      // 이스터에그 토글 off 시 F키 점프/등록 건너뜀
      if (window.isEasterEggEnabled && !window.isEasterEggEnabled('fkeyHotkeys')) return;
      const slot = parseInt(fMatch[1]); // 1~9
      if (e.shiftKey) {
        // 등록: 현재 선택된(또는 첫 번째) 섹션을 slot에 저장
        if (document.activeElement?.isContentEditable) return;
        e.preventDefault();
        const sec = document.querySelector('.section-block.selected') || document.querySelector('.section-block');
        if (!sec) return;
        const map = JSON.parse(localStorage.getItem('section-fkey-map') || '{}');
        map[slot] = sec.id || sec.dataset.name || '';
        localStorage.setItem('section-fkey-map', JSON.stringify(map));
        // 등록 피드백: 섹션 레이블 잠깐 강조
        const label = sec.querySelector('.section-label');
        if (label) {
          label.style.transition = 'background 0.15s';
          label.style.background = 'rgba(45,111,232,0.35)';
          setTimeout(() => { label.style.background = ''; }, 600);
        }
        return;
      } else {
        // 이동: slot에 등록된 섹션으로 스크롤
        e.preventDefault();
        const map = JSON.parse(localStorage.getItem('section-fkey-map') || '{}');
        const secId = map[slot];
        if (!secId) return;
        const target = document.getElementById(secId)
          || [...document.querySelectorAll('.section-block')].find(s => s.dataset.name === secId);
        if (target) {
          // 빠른 smooth 스크롤 (브라우저 기본 smooth보다 3배 빠름, 200ms)
          const wrap = document.getElementById('canvas-wrap');
          if (!wrap) { target.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
          const targetTop = target.getBoundingClientRect().top - wrap.getBoundingClientRect().top + wrap.scrollTop - 40;
          const startTop = wrap.scrollTop;
          const dist = targetTop - startTop;
          const duration = 200;
          const startTime = performance.now();
          const ease = t => t < 0.5 ? 2*t*t : -1+(4-2*t)*t; // easeInOut
          const step = now => {
            const t = Math.min((now - startTime) / duration, 1);
            wrap.scrollTop = startTop + dist * ease(t);
            if (t < 1) requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
        }
        return;
      }
    }
  }

  if (e.key === 'Escape') {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
    // vectorPen 그리기/편집 모드는 자체 capture 핸들러가 ESC를 먼저 소비함.
    // 안전망: 모드가 살아있으면 종료만 하고 선택 해제는 건너뜀.
    if (document.body.classList.contains('vpen-mode')) { window.exitVectorPenMode?.(); return; }
    if (document.body.classList.contains('vpen-edit-mode')) { window.exitPenEditMode?.(); return; }
    // group-editing 중이면 editing만 해제, 선택은 유지
    const editingGroup = document.querySelector('.group-block.group-editing');
    if (editingGroup) {
      editingGroup.classList.remove('group-editing');
      return;
    }
    deselectAll();
  }

  // Cmd/Ctrl + [ / ] : free 모드 frame 안의 selected 블록 z-order 변경
  // Shift 조합 시 맨 앞/뒤로. stack(flow) 모드는 영향 X (free 자식만).
  if ((e.metaKey || e.ctrlKey) && (e.key === '[' || e.key === ']')) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;
    const sel = document.querySelector(
      '.text-block.selected, .asset-block.selected, .gap-block.selected, ' +
      '.icon-circle-block.selected, .table-block.selected, .label-group-block.selected, ' +
      '.graph-block.selected, .divider-block.selected, .bridge-block.selected, .duo-block.selected, .infocard-block.selected, .innercard-block.selected, ' +
      '.icon-text-block.selected, .canvas-block.selected, .banner02-block.selected, .comparison-block.selected, .mockup-block.selected, ' +
      '.icon-block.selected, .vector-block.selected, .step-block.selected, .shape-block.selected'
    );
    if (!sel) return;
    // selected의 z-order 단위 = free frame의 직속 자식까지 거슬러 올라간 wrapper
    const freeFrame = sel.closest('.frame-block[data-free-layout]');
    if (!freeFrame) return;
    let wrapper = sel.closest('.row') || sel;
    while (wrapper && wrapper.parentElement !== freeFrame) wrapper = wrapper.parentElement;
    if (!wrapper) return;

    e.preventDefault();
    window.pushHistory?.('레이어 순서');
    const forward = e.key === ']';
    const toEnd = e.shiftKey;
    if (forward && toEnd) {
      freeFrame.appendChild(wrapper);                      // 맨 위로
    } else if (!forward && toEnd) {
      freeFrame.insertBefore(wrapper, freeFrame.firstChild); // 맨 아래로
    } else if (forward && wrapper.nextElementSibling) {
      freeFrame.insertBefore(wrapper.nextElementSibling, wrapper); // 한 단계 위
    } else if (!forward && wrapper.previousElementSibling) {
      freeFrame.insertBefore(wrapper, wrapper.previousElementSibling); // 한 단계 아래
    }
    window.scheduleAutoSave?.();
    window.buildLayerPanel?.();
    return;
  }

  // 블록 추가 단축키: addGap/addText/addAsset (사용자 설정 가능, 기본 G/T/A — IME 안전: e.code 사용)
  if (!e.metaKey && !e.ctrlKey && !e.shiftKey) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;

    // #13 ⌥+a/s/d → 선택 블록을 부모 섹션(section-inner) 기준 좌/중/우 정렬(a=좌·s=중·d=우).
    //   숫자 네임스페이스(갭 프리셋 1~8·텍스트타입 1~4) 충돌 회피 위해 ⌥+숫자에서 ⌥+글자로 이전(현빈 지시).
    //   ★add-asset(plain A)·add-section(plain S)보다 «먼저» 선점 — alt 요구라 plain A/S/D는 이 분기를 스킵해 기존 동작 유지.
    //   ★preventDefault로 맥 Option+letter 특수문자(å/ß/∂) 삽입 억제. 편집 중은 상단(1183 contentEditable 가드)에서 이미 차단.
    if (e.altKey && ['KeyA', 'KeyS', 'KeyD'].includes(e.code) && !document.querySelector('.text-block.editing')) {
      e.preventDefault();
      alignSelectedToParent({ KeyA: 'left', KeyS: 'center', KeyD: 'right' }[e.code]);
      return;
    }

    const _ms = window._matchShortcut;
    const _isAddGap   = _ms ? _ms(e, 'addGap')   : (e.code === 'KeyG');
    const _isAddText  = _ms ? _ms(e, 'addText')  : (e.code === 'KeyT');
    const _isAddAsset = _ms ? _ms(e, 'addAsset') : (e.code === 'KeyA');
    if (_isAddGap)   { e.preventDefault(); window.addGapBlock?.(); return; }
    if (_isAddText)  { e.preventDefault(); window.addTextBlock?.('body'); return; }
    if (_isAddAsset) { e.preventDefault(); window.toggleFpDropdown?.('fp-asset-dropdown'); return; }

    // Enter → 선택된 텍스트 블록 편집 모드 진입
    if (e.code === 'Enter') {
      const tb = document.querySelector('.text-block.selected');
      if (tb && typeof tb._enterTextEditMode === 'function') {
        e.preventDefault();
        tb._enterTextEditMode();
        return;
      }
    }

    // 갭 블록 프리셋: 1=20, 2=40, 3=80, 4=120, 5=160, 6=200, 7=240, 8=280 (텍스트 편집 중이면 무시)
    // !e.altKey 가드(유지): 정렬이 ⌥+a/s/d로 이전됐어도 ⌥+숫자는 «inert»로 둔다(Option+digit 특수문자·오발동 방지). plain 숫자는 정상.
    if (!e.altKey && ['Digit1','Digit2','Digit3','Digit4','Digit5','Digit6','Digit7','Digit8'].includes(e.code)) {
      if (!document.querySelector('.text-block.editing')) {
        const gb = document.querySelector('.gap-block.selected');
        if (gb) {
          e.preventDefault();
          const presets = { Digit1: 20, Digit2: 40, Digit3: 80, Digit4: 120, Digit5: 160, Digit6: 200, Digit7: 240, Digit8: 280 };
          const h = presets[e.code];
          gb.style.height = h + 'px';
          const sl = document.getElementById('gap-slider');
          const nb = document.getElementById('gap-number');
          if (sl) sl.value = h;
          if (nb) nb.value = h;
          // #15 프로퍼티 패널 갭 프리셋 버튼 active를 높이에 맞춰 동기화 (패널 미개방 시 0개 → 무해)
          const pp = document.getElementById('propPanel') || document;
          pp.querySelectorAll('.gap-preset-btn').forEach(b => b.classList.toggle('active', Number(b.dataset.h) === h));
          window.scheduleAutoSave?.();
          pushHistory();
          return;
        }
      }
    }

    // 텍스트 타입 단축키: 1=H1, 2=H2, 3=H3, 4=Body (텍스트 편집 중이면 무시)
    // !e.altKey 가드(유지): 정렬이 ⌥+a/s/d로 이전됐어도 ⌥+숫자는 inert로 둔다(오발동 방지). plain 숫자는 정상.
    if (!e.altKey && ['Digit1','Digit2','Digit3','Digit4'].includes(e.code)) {
      if (document.querySelector('.text-block.editing')) return; // 편집 중 차단
      const tb = document.querySelector('.text-block.selected');
      if (!tb) return;
      e.preventDefault();
      const typeMap = { 'Digit1': ['tb-h1','heading'], 'Digit2': ['tb-h2','heading'], 'Digit3': ['tb-h3','heading'], 'Digit4': ['tb-body','body'] };
      const phMap = { 'tb-h1':'제목을 입력하세요', 'tb-h2':'소제목을 입력하세요', 'tb-h3':'소항목을 입력하세요', 'tb-body':'본문 내용을 입력하세요.' };
      const [cls, dtype] = typeMap[e.code];
      const contentEl = tb.querySelector('[contenteditable]') || tb.querySelector('.tb-h1,.tb-h2,.tb-h3,.tb-body,.tb-caption,.tb-label,.tb-bullet');
      if (!contentEl) return;
      window.pushHistory?.();
      contentEl.className = cls;
      tb.dataset.type = dtype;
      // 유형 변경 = 스타일 프리셋 적용. inline fontSize 제거 → CSS 유형 표준크기 적용
      // (tb-h1 104 / tb-h2 72 / tb-h3 52 / tb-body 36). 이후 +/-로 미세조정 가능.
      contentEl.style.fontSize = '';
      // TODO-QA: 타입 변환 시 data-placeholder 텍스트도 새 타입에 맞게 갱신
      // 잘못 켜진 placeholder 플래그 정정 — 실제 글자가 있으면 플래그 끔(block-drag.js:496 자가보정과 동일 기준)
      if (contentEl.dataset.isPlaceholder === 'true' && contentEl.textContent.trim() !== '') {
        delete contentEl.dataset.isPlaceholder;
      }
      // 의도적 빈 줄(data-blank)이면 placeholder 문구 덮어쓰기 skip — 빈 블록 유지
      // (EMPTY) 승격 판정은 blur(런타임 Enter 신호) 한 곳에서만 한다. 타입변경 경로엔
      // Enter 신호가 없어 has-breaks 헬퍼를 쓰면 "전부삭제 leftover <br>"을 빈줄로 오판해
      // 회귀가 저장본에 전파된다. → 여기선 이미 승격된 data-blank='true'만 존중(U5 방식).
      let isBlank = contentEl.dataset.blank === 'true' || tb.dataset.blank === 'true';
      if (!isBlank && contentEl.dataset.isPlaceholder === 'true' && phMap[cls]) {
        contentEl.dataset.placeholder = phMap[cls];
        contentEl.innerHTML = phMap[cls];
      } else if (phMap[cls]) {
        contentEl.dataset.placeholder = phMap[cls];
      }
      // 레이어 패널 이름 동기화: 자동이름 모드(사용자 rename 없음)일 때만 유형 라벨 갱신
      if (!tb.dataset.layerName) {
        const nameSpan = tb._layerItem?.querySelector('.layer-item-name');
        if (nameSpan) nameSpan.textContent = (dtype === 'heading') ? 'Heading' : 'Body';
      }
      window.showTextProperties?.(tb);
      return;
    }
  }

  // ── 크기 세부조정: +/- (수정키 없음). 텍스트=fontSize, 갭=height. 줌은 ⌘+/-라 충돌 없음 ──
  // '+'는 Shift+Equal이라 e.code로 매칭(shift 무관). 기본 step 작게(세부조정), Shift로 큰 step.
  if (!e.metaKey && !e.ctrlKey && !e.altKey) {
    if (!(e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT')) {
      const isPlus  = e.code === 'Equal' || e.code === 'NumpadAdd';
      const isMinus = e.code === 'Minus' || e.code === 'NumpadSubtract';
      if ((isPlus || isMinus) && !document.querySelector('.text-block.editing')) {
        const tb = document.querySelector('.text-block.selected');
        const gb = document.querySelector('.gap-block.selected');
        if (tb) {
          const contentEl = tb.querySelector('[class^="tb-"]');
          if (contentEl) {
            e.preventDefault();
            const cur = parseFloat(getComputedStyle(contentEl).fontSize) || 16;
            const step = e.shiftKey ? 4 : 1;
            const next = Math.min(400, Math.max(4, cur + (isPlus ? step : -step)));
            contentEl.style.fontSize = next + 'px';
            coalesceSizeHistory(tb, '글자 크기');
            window.scheduleAutoSave?.();
            window.showTextProperties?.(tb);
          }
          return;
        }
        if (gb) {
          e.preventDefault();
          const step = e.shiftKey ? 20 : 4;
          const cur = gb.offsetHeight;
          const next = Math.min(400, Math.max(0, cur + (isPlus ? step : -step)));
          gb.style.height = next + 'px';
          const sl = document.getElementById('gap-slider');
          const nb = document.getElementById('gap-number');
          if (sl) sl.value = next;
          if (nb) nb.value = next;
          coalesceSizeHistory(gb, '간격 조정');
          window.scheduleAutoSave?.();
          return;
        }
      }
    }
  }

  // ── 갭 블록 높이 조정: 방향키 (수정키 없음 or Shift) ──
  if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && !e.metaKey && !e.ctrlKey && !e.altKey) {
    if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;
    const selGap = document.querySelector('.gap-block.selected');
    if (selGap) {
      e.preventDefault();
      const step = e.shiftKey ? 20 : 4;
      const delta = e.key === 'ArrowUp' ? step : -step;
      const cur = selGap.offsetHeight;
      const next = Math.min(400, Math.max(0, cur + delta));
      selGap.style.height = next + 'px';
      // 패널 슬라이더/숫자 동기화
      const sl = document.getElementById('gap-slider');
      const nb = document.getElementById('gap-number');
      if (sl) sl.value = next;
      if (nb) nb.value = next;
      window.scheduleAutoSave?.();
      return;
    }
  }

  // ── 키보드 Nudge: 블록 이동 Cmd+방향키 (편집 중이거나 입력 포커스 시 무시) ──
  if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && (e.metaKey || e.ctrlKey)) {
    if (document.querySelector('.text-block.editing, .label-group-block.editing')) return;
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;
    // 섹션 외 모든 selected 요소를 블록으로 취급 (iconify/shape/sticker/laurel 등 누락 방지)
    const selBlock = [...document.querySelectorAll('.selected')]
      .find(el => el !== document.body
        && !el.classList.contains('section-block')
        && !el.classList.contains('layer-item')
        && el.id);
    const selSection = document.querySelector('.section-block.selected');
    const moveTarget = selBlock
      ? (selBlock.classList.contains('gap-block') || selBlock.classList.contains('frame-block')
          ? selBlock
          // row 없으면 frame-block fallback — text-block이 frame-block 직접 자식 케이스 등
          : (selBlock.closest('.row') || selBlock.closest('.frame-block') || selBlock))
      : selSection;
    if (moveTarget) {
      e.preventDefault();
      const parent = moveTarget.parentElement;
      if (!parent) return;
      if (e.key === 'ArrowUp') {
        const prev = moveTarget.previousElementSibling;
        if (prev && !prev.classList.contains('drop-indicator')) parent.insertBefore(moveTarget, prev);
      } else {
        const next = moveTarget.nextElementSibling;
        if (next && !next.classList.contains('drop-indicator')) parent.insertBefore(next, moveTarget);
      }
      // 이동 전 선택 상태 수집
      const moveTargetId = moveTarget.id;
      const selBlockIds = selBlock ? [selBlock.id].filter(Boolean) : [];
      const selSectionId = selSection ? selSection.id : null;
      window.buildLayerPanel();
      pushHistory('블록 이동');
      // buildLayerPanel 후 선택 상태 복원
      if (selSectionId) {
        const sec = document.getElementById(selSectionId);
        if (sec) {
          sec.classList.add('selected');
          if (sec._layerItem) { sec._layerItem.classList.add('active'); sec._layerItem.style.background = 'var(--ui-bg-card)'; }
        }
      }
      selBlockIds.forEach(id => {
        const b = document.getElementById(id);
        if (!b) return;
        b.classList.add('selected');
        if (b._layerItem) { b._layerItem.classList.add('active'); b._layerItem.style.background = 'var(--ui-bg-card)'; }
      });
      return;
    }
  }

  const isDelete = e.key === 'Delete' || e.key === 'Backspace';
  if (isDelete) {
    // 텍스트 편집 중이거나 input에 포커스가 있으면 기본 동작 유지
    if (document.querySelector('.text-block.editing, .label-group-block.editing')) return;
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;
    // 캔버스 선택 삭제 — ⌘X(잘라내기)와 공유. consumed=true면 기본동작 차단.
    if (deleteSelectedFromCanvas()) e.preventDefault();
    return;
  }
});

// 캔버스 선택(블록/도형/행/열/섹션/프레임) 삭제 — Delete/Backspace 핸들러와 ⌘X 잘라내기가 공유.
// 동작보존 추출: 원래 인라인 e.preventDefault()는 consumed 플래그로 대체(호출부가 preventDefault).
// 반환값: 무언가를 소비(삭제 시도/보호차단 등 기본동작 차단)했으면 true.
function deleteSelectedFromCanvas() {
  let consumed = false;
    // 이미지 편집 모드 중이면 이미지 삭제
    const imgEditBlock = document.querySelector('.asset-block.img-editing');
    if (imgEditBlock) {
      consumed = true;
      clearAssetImage(imgEditBlock);
      return consumed;
    }

    // 다중 선택 삭제: col 다중
    if (multiSel.cols.size > 1) {
      consumed = true;
      multiSel.cols.forEach(col => {
        const row = col.closest('.row');
        col.remove();
        if (row && !row.querySelector('.col')) row.remove();
      });
      clearMultiSel();
      deselectAll();
      window.buildLayerPanel();
      pushHistory('열 삭제');
      return consumed;
    }
    // 다중 선택 삭제: section 다중
    if (multiSel.sections.size > 1) {
      consumed = true;
      const allSecs = canvasEl.querySelectorAll('.section-block');
      // 보호 섹션 필터링 (section-protection.js)
      const requested = [...multiSel.sections];
      const isProtected = window.isSectionProtected || (() => false);
      const toDelete = requested.filter(s => !isProtected(s));
      const skipped = requested.length - toDelete.length;
      if (skipped > 0 && typeof window.showToast === 'function') {
        window.showToast(`🔒 보호된 섹션 ${skipped}개 제외 (메모: "삭제하지말것" 자동 감지)`);
      }
      if (toDelete.length === 0) { clearMultiSel(); deselectAll(); return consumed; }
      ensureHistoryCheckpoint('섹션 다중 삭제 전');
      toDelete.forEach(s => s.remove());
      clearMultiSel();
      deselectAll();
      if (!canvasEl.querySelector('.section-block')) window.addGhostSection?.();
      window.buildLayerPanel();
      pushHistory('섹션 삭제');
      return consumed;
    }
    const selText    = document.querySelector('.text-block.selected');
    const selAsset   = document.querySelector('.asset-block.selected');
    const selGap     = document.querySelector('.gap-block.selected');
    const selSection = document.querySelector('.section-block.selected');

    // group-block(프레임) selected → group-block 전체 삭제
    const selGroup = document.querySelector('.group-block.group-selected:not(.group-editing)');
    if (selGroup) {
      consumed = true;
      window.ensureHistoryCheckpoint?.('삭제 전');
      selGroup.remove();
      deselectAll();
      window.buildLayerPanel();
      pushHistory('프레임 삭제');
      return consumed;
    }

    // 서브섹션 selected → row 단위로 삭제 (부모 섹션 삭제 방지)
    // 단, 자식 블록이 선택된 경우 자식 블록 삭제로 처리 (프레임은 유지)
    const selSS = document.querySelector('.frame-block.selected');
    if (selSS) {
      const ssHasSelectedChild = selSS.querySelector(
        '.text-block.selected, .asset-block.selected, .gap-block.selected, ' +
        '.icon-circle-block.selected, .table-block.selected, .label-group-block.selected, ' +
        '.graph-block.selected, .divider-block.selected, .bridge-block.selected, .duo-block.selected, .infocard-block.selected, .innercard-block.selected, .icon-text-block.selected, .canvas-block.selected, .banner02-block.selected, .comparison-block.selected, .mockup-block.selected, .icon-block.selected, .vector-block.selected, .step-block.selected'
      );
      if (!ssHasSelectedChild) {
        consumed = true;
        const ssRow = selSS.closest('.row') || selSS;
        ssRow.remove();
        window._activeFrame = null;
        deselectAll();
        window.buildLayerPanel();
        pushHistory('서브섹션 삭제');
        return consumed;
      }
      // 자식 블록이 선택된 경우 → 아래 allSelBlocks 삭제 로직으로 fall-through
    }

    // shape 블록 selected (단건 or 복수) + 일반 블록 혼합 일괄 삭제
    const allSelShapes = [...document.querySelectorAll('.shape-block.selected')];
    const allSelBlocks = [...document.querySelectorAll(CANVAS_SEL_BLOCKS)];
    if (allSelShapes.length > 0 || allSelBlocks.length > 0) {
      consumed = true;
      // A13: 보호섹션(메모 '삭제하지말것' 등) 내부 블록/도형 삭제 우회 차단.
      //       선택 중 하나라도 보호섹션에 속하면 전체 차단(부분삭제 모호성 회피).
      const _isProt = window.isSectionProtected || (() => false);
      const _protShape = allSelShapes.some(s => { const sec = s.closest('.section-block'); return sec && _isProt(sec); });
      const _protBlock = allSelBlocks.some(b => { const sec = b.closest('.section-block'); return sec && _isProt(sec); });
      if (_protShape || _protBlock) {
        if (typeof window.showToast === 'function') window.showToast('🔒 보호된 섹션의 블록은 삭제할 수 없습니다 — 🔒 버튼으로 보호 해제 후 삭제하세요');
        deselectAll();
        return consumed;
      }
      window.ensureHistoryCheckpoint?.('삭제 전');
      // shape: 부모 ss/row 단위로 삭제
      const ssRowsToRemove = new Set();
      allSelShapes.forEach(shape => {
        const ss = shape.closest('.frame-block');
        const ssRow = ss?.closest('.row') || ss;
        if (ssRow) ssRowsToRemove.add(ssRow); else shape.remove();
      });
      ssRowsToRemove.forEach(r => r.remove());
      // 일반 블록 삭제
      const rowsToRemove = new Set();
      allSelBlocks.forEach(block => {
        // mockup 블록: 연결된 숨김 섹션 복원
        if (block.classList.contains('mockup-block')) {
          const secId = block.dataset.sourceSec;
          if (secId) {
            const sec = document.getElementById(secId);
            if (sec) { sec.style.display = ''; sec.dataset.mockupHidden = ''; }
          }
        }
        if (block.classList.contains('gap-block')) {
          block.remove();
        } else {
          const row = block.closest('.row');
          if (row) rowsToRemove.add(row); else block.remove();
        }
      });
      rowsToRemove.forEach(r => r.remove());
      window._activeFrame = null;
      deselectAll();
      window.buildLayerPanel();
      pushHistory('블록 삭제');
    } else {
      const selRow = document.querySelector('.row.row-active');
      if (selRow) {
        consumed = true;
        selRow.remove();
        deselectAll();
        window.buildLayerPanel();
        pushHistory('행 삭제');
      } else if (selSection) {
        consumed = true;
        const isProtected = window.isSectionProtected || (() => false);
        if (selSection.dataset.variationGroup) {
          const gid = selSection.dataset.variationGroup;
          const grouped = [...document.querySelectorAll(`.section-block[data-variation-group="${gid}"]`)];
          const toDelete = grouped.filter(s => !isProtected(s));
          const skipped = grouped.length - toDelete.length;
          if (skipped > 0 && typeof window.showToast === 'function') {
            window.showToast(`🔒 보호된 섹션 ${skipped}개 제외`);
          }
          if (toDelete.length === 0) { deselectAll(); return consumed; }
          toDelete.forEach(s => s.remove());
          deselectAll();
          if (!canvasEl.querySelector('.section-block')) window.addGhostSection?.();
          window.buildLayerPanel();
          pushHistory('섹션 삭제');
        } else {
          if (isProtected(selSection)) {
            if (typeof window.showToast === 'function') {
              window.showToast(`🔒 보호된 섹션입니다 — 🔒 버튼으로 보호 해제 후 삭제하세요`);
            }
            return consumed;
          }
          selSection.remove();
          deselectAll();
          if (!canvasEl.querySelector('.section-block')) window.addGhostSection?.();
          window.buildLayerPanel();
          pushHistory('섹션 삭제');
        }
      }
    }
  return consumed;
}

applyZoom(40);

/* ═══════════════════════════════════
   SELECTION
═══════════════════════════════════ */
function selectSection(sec, scrollIntoView = false) {
  deselectAll();
  sec.classList.add('selected');
  syncLayerActive(sec);
  window.showSectionProperties(sec);
  if (scrollIntoView) {
    /* ★초판은 `sec.offsetTop * scale - 40` 이었다 — 배율은 곱했지만
     *   #canvas-scaler 의 «translate» 를 안 셌다. 실측(2026-08-28, scale 0.38·translateY -335px):
     *   섹션 3개 전부 화면 위쪽에서 «-255px», 즉 «위로 잘려 올라가» 아랫부분만 보였다.
     *   의도는 「위에 40px 여유」였는데 반대로 260px 넘게 어긋나 있었다.
     * ⇒ offsetTop 산수를 버리고 «실제 화면 좌표»로 잰다. transform 이 어떻든(translate·scale·
     *   나중에 rotate 가 붙어도) 맞는다 — 좌표계를 직접 읽으니 변환을 몰라도 된다. */
    const canvasWrapEl = document.getElementById('canvas-wrap');
    const scalerEl = document.getElementById('canvas-scaler');
    const delta = sec.getBoundingClientRect().top - canvasWrapEl.getBoundingClientRect().top;
    const target = canvasWrapEl.scrollTop + delta - CANVAS_TAIL_GAP;
    /* ★마지막 섹션은 «더 당길 캔버스가 없어» 40px 까지 못 온다(현빈이 원인을 짚었다).
     *   부족한 만큼 #canvas-scaler 의 margin-bottom 을 늘린다 — margin 은 «레이아웃»이라
     *   transform: scale 의 영향을 안 받아 1:1 로 스크롤 여유가 된다(실측 500→+500, 1000→+1000).
     *   ⛔#canvas 안에 넣으면 «저장되는 캔버스 HTML»을 오염시킨다. scaler 밖(wrap)은
     *     flex-direction: row 라 옆에 붙어 세로엔 기여를 안 한다. 그래서 scaler 의 margin 이다.
     * ★공식으로 미리 계산하지 «않는다» — 매번 0 으로 되돌리고 «모자란 만큼»만 준다.
     *   그래야 배율이 낮아 레이아웃과 화면이 어긋날 때도 정확하고, 여백이 누적되지 않는다. */
    if (scalerEl) {
      scalerEl.style.marginBottom = '0px';
      const max = canvasWrapEl.scrollHeight - canvasWrapEl.clientHeight;
      const short = target - max;
      if (short > 0) scalerEl.style.marginBottom = Math.round(short) + 'px';
    }
    canvasWrapEl.scrollTo({ top: target, behavior: 'smooth' });
  }
}

function rgbToHex(rgb) {
  const m = rgb.match(/\d+/g);
  if (!m || m.length < 3) return '#000000';
  return '#' + m.slice(0,3).map(n => parseInt(n).toString(16).padStart(2,'0')).join('');
}

/* ── Design Presets ── */
// Electron에서는 preload를 통해 JSON 파일 로드, 브라우저 fallback은 하드코딩
// FIX-PR-01: PRESET_FALLBACK을 presets/*.json 내용과 동기화 (폰트·dots 불일치 수정)
// Electron은 readPresets() 성공 시 덮어쓰므로 fallback은 브라우저/race condition 시만 사용됨
const PRESET_FALLBACK = [
  {
    id: 'default', name: 'Default',
    dots: ['#111111', '#555555', '#111111'],
    variables: {
      '--preset-h1-color': '#111111', '--preset-h1-family': "'Pretendard', 'Noto Sans KR', sans-serif",
      '--preset-h2-color': '#1a1a1a', '--preset-h2-family': "'Pretendard', 'Noto Sans KR', sans-serif",
      '--preset-h3-color': '#333333', '--preset-h3-family': "'Pretendard', 'Noto Sans KR', sans-serif",
      '--preset-body-color': '#555555', '--preset-body-family': "'Pretendard', 'Noto Sans KR', sans-serif",
      '--preset-caption-color': '#999999',
      '--preset-label-bg': '#111111', '--preset-label-color': '#ffffff', '--preset-label-radius': '8px',
    },
  },
  {
    id: 'dark', name: 'Dark',
    dots: ['#ffffff', '#aaaaaa', '#2d6fe8'], // FIX-PR-01: dots를 dark.json과 동기화
    variables: {
      '--preset-h1-color': '#ffffff', '--preset-h1-family': "'Pretendard', 'Noto Sans KR', sans-serif",
      '--preset-h2-color': '#eeeeee', '--preset-h2-family': "'Pretendard', 'Noto Sans KR', sans-serif",
      '--preset-h3-color': '#cccccc', '--preset-h3-family': "'Pretendard', 'Noto Sans KR', sans-serif",
      '--preset-body-color': '#aaaaaa', '--preset-body-family': "'Pretendard', 'Noto Sans KR', sans-serif",
      '--preset-caption-color': '#666666',
      '--preset-label-bg': '#2d6fe8', '--preset-label-color': '#ffffff', '--preset-label-radius': '8px',
    },
  },
  {
    id: 'brand', name: 'Brand',
    dots: ['#1a3a6b', '#444444', '#2d6fe8'],
    variables: {
      '--preset-h1-color': '#1a3a6b', '--preset-h1-family': "'Noto Serif KR', serif",
      '--preset-h2-color': '#2d4a7a', '--preset-h2-family': "'Noto Serif KR', serif",
      '--preset-h3-color': '#3d5a8a', '--preset-h3-family': "'Noto Serif KR', serif",
      '--preset-body-color': '#444444', '--preset-body-family': "'Pretendard', 'Noto Sans KR', sans-serif",
      '--preset-caption-color': '#888888',
      '--preset-label-bg': '#2d6fe8', '--preset-label-color': '#ffffff', '--preset-label-radius': '8px',
    },
  },
  {
    id: 'minimal', name: 'Minimal',
    dots: ['#000000', '#666666', '#000000'],
    variables: {
      '--preset-h1-color': '#000000', '--preset-h1-family': "'Space Grotesk', sans-serif",
      '--preset-h2-color': '#222222', '--preset-h2-family': "'Space Grotesk', sans-serif",
      '--preset-h3-color': '#444444', '--preset-h3-family': "'Space Grotesk', sans-serif",
      '--preset-body-color': '#666666', '--preset-body-family': "'Pretendard', 'Noto Sans KR', sans-serif",
      '--preset-caption-color': '#aaaaaa',
      '--preset-label-bg': '#000000', '--preset-label-color': '#ffffff', '--preset-label-radius': '0px',
    },
  },
];

let PRESETS = PRESET_FALLBACK;

// Electron 환경 감지 → body 클래스 추가 (신호등 영역 확보 등 CSS 처리)
if (window.electronAPI) {
  document.body.classList.add('electron-app');
  // ★맥에서만 신호등(빨강·노랑·초록) 자리를 비운다. 윈도우엔 신호등이 없어
  //   같은 여백을 주면 탑바가 «이유 없이 우측으로 밀린다»(2026-08-29 현빈 지적).
  if (/Mac|Macintosh/i.test(navigator.userAgent)) document.body.classList.add('is-mac');
  window.electronAPI.getFullscreen().then(isFullscreen => {
    document.body.classList.toggle('fullscreen', isFullscreen);
  });
  window.electronAPI.onFullscreenChange(isFullscreen => {
    document.body.classList.toggle('fullscreen', isFullscreen);
  });
}

/* 버전 배지 — 「BETA」 옆에 «실제 버전»을 같이 보인다(현빈 2026-08-28).
 * ★왜: 앱 안에서 「내가 지금 몇 버전을 쓰는지」 알 방법이 없었다.
 *   오늘 실제로 문제가 됐다 — 현빈은 0.8.3, 수지맥은 0.8.2 인데 둘 다 화면엔 「BETA」만 떴다.
 *   버그 신고를 받아도 «어느 버전에서» 난 건지 되물어야 한다.
 * ⚠️getVersion 은 IPC(비동기)라 실패할 수 있다 — 그때는 「BETA」로 남긴다.
 *   ⛔실패를 «빈 배지»로 두지 않는다. 로고 옆이 비면 «망가진 화면»으로 읽힌다. */
const _verBadge = document.getElementById('logo-version-badge');
if (_verBadge) {
  _verBadge.textContent = 'BETA';
  window.electronAPI?.getVersion?.()
    .then(v => { if (v) _verBadge.textContent = `BETA v${v}`; })
    .catch(() => {});
}

/* [A3] 같은 값을 «상단바»에도 (현빈 2026-09-04).
 * ⛔여기선 실패 시 「BETA」 같은 대체 문구를 안 쓴다 — 상단바 배지는 «없어도 되는» 자리라
 *   버전을 모를 때 뭔가 띄우면 그게 버전인 줄 읽힌다. 못 얻으면 숨긴다. */
const _tbVerBadge = document.getElementById('topbar-version-badge');
if (_tbVerBadge) {
  window.electronAPI?.getVersion?.()
    .then(v => {
      if (!v) return;
      _tbVerBadge.textContent = `v${v}`;
      _tbVerBadge.style.display = '';
    })
    .catch(() => {});
}

// Electron 환경이면 JSON 파일에서 프리셋 로드.
// _presetsReady: race condition 방지용 Promise — showSectionProperties 등에서 await 후 UI 렌더.
// Electron 비환경(브라우저)에서는 즉시 resolve하여 PRESET_FALLBACK 사용.
let _presetsReady;
if (window.electronAPI) {
  _presetsReady = window.electronAPI.readPresets().then(loaded => {
    if (loaded && loaded.length) {
      PRESETS = loaded.sort((a, b) => {
        const order = ['default', 'dark', 'brand', 'minimal'];
        return (order.indexOf(a.id) + 1 || 99) - (order.indexOf(b.id) + 1 || 99);
      });
    }
  });
} else {
  _presetsReady = Promise.resolve();
}


function deselectAll() {
  clearMultiSel();
  _lastClickedBlock = null;
  // 텍스트 편집 중인 블록이 있으면 편집 종료 전 현재 상태 히스토리에 저장
  // (입력한 텍스트가 undo 복원 대상이 되도록)
  if (!window._historyPaused) {
    const editingBlock = canvasEl?.querySelector('.text-block.editing, .icon-text-block.editing, .label-group-block.editing');
    if (editingBlock) pushHistory('텍스트 편집');
  }
  // perf(qa-perf): canvas/layerPanel 범위 한정으로 document 전체 탐색 제거
  const canvas = canvasEl;
  const layerPanel = document.getElementById('layer-panel-body');

  // canvas 내 블록 선택 해제 (단일 querySelectorAll 순회)
  canvas.querySelectorAll('.col').forEach(c => c.classList.remove('multi-selected', 'selected'));
  canvas.querySelectorAll('.group-block').forEach(g => g.classList.remove('group-selected', 'group-editing'));
  canvas.querySelectorAll('.section-block').forEach(s => s.classList.remove('selected'));
  canvas.querySelectorAll('.text-block').forEach(t => {
    t.classList.remove('selected', 'editing');
    t.querySelectorAll('[contenteditable]').forEach(el => el.setAttribute('contenteditable','false'));
  });
  canvas.querySelectorAll('.asset-block').forEach(a => {
    a.classList.remove('selected');
    window.exitImageEditMode?.(a);
  });
  canvas.querySelectorAll('.gap-block, .icon-circle-block, .graph-block, .divider-block, .bridge-block, .duo-block, .infocard-block, .innercard-block, .icon-text-block, .joker-block, .shape-block, .canvas-block, .banner02-block, .comparison-block, .mockup-block, .icon-block, .vector-block, .step-block, .chat-block, .laurel-block, .annotation-block, .sticker-block').forEach(b => {
    b.classList.remove('selected');
    // 어노테이션은 핸들도 함께 정리
    if (b.classList.contains('annotation-block')) b.querySelectorAll('.annot-handle').forEach(h => h.remove());
    // 스티커도 4모서리 핸들 / highlightB 끝점 핸들 함께 제거
    if (b.classList.contains('sticker-block')) {
      b.querySelectorAll(':scope > .sticker-corner-handle, :scope > .hlb-handle').forEach(h => h.remove());
    }
  });
  canvas.querySelectorAll('.label-group-block').forEach(b => {
    b.classList.remove('selected', 'editing');
    b.querySelectorAll('.label-item').forEach(i => i.classList.remove('item-selected'));
    b.querySelectorAll('.label-item-text').forEach(el => el.setAttribute('contenteditable','false'));
  });
  canvas.querySelectorAll('.table-block').forEach(b => {
    b.classList.remove('selected');
    b.querySelectorAll('[contenteditable="true"]').forEach(el => el.setAttribute('contenteditable','false'));
    // #5-b: 셀 선택 마킹도 함께 해제
    b.querySelectorAll('td.cell-selected, th.cell-selected').forEach(c => c.classList.remove('cell-selected'));
  });
  if (window._tblSel) window._tblSel = null;
  // ⑧ 배너02 줄 선택 아웃라인도 함께 해제 (label-item 처리와 같은 자리)
  canvas.querySelectorAll('.bn2-line-selected').forEach(el => el.classList.remove('bn2-line-selected'));
  canvas.querySelectorAll('.row.row-active').forEach(r => r.classList.remove('row-active'));

  // 레이어 패널 선택 해제
  if (layerPanel) {
    layerPanel.querySelectorAll('.layer-section-header').forEach(h => h.classList.remove('active'));
    layerPanel.querySelectorAll('.layer-item').forEach(i => { i.classList.remove('active'); i.style.background = ''; });
    layerPanel.querySelectorAll('.layer-row-header').forEach(h => h.classList.remove('active'));
  }

  if (window.setRpIdBadge) window.setRpIdBadge(null);
  window._activeFrame = null;
  window.hideFrameHandles?.();
  window.hideMockupHandles?.();
  window.hideIconHandles?.();
  window.hideAssetRadiusHandles?.();
  window.hideAssetResizeHandles?.();
  window.hideCanvasRadiusHandles?.();
  window.hideCanvasResizeHandles?.();
  window.hideVectorResizeHandles?.();
  window._deselectAllGradients?.(); // gradient 블록 선택 해제 + 4모서리 핸들 제거 (deselectAll 셀렉터에 없어 누락됐던 정리)
  window.hideGradientLine?.(); // banner02/comparison 배경 그라데이션 온캔버스 라인 숨김
  canvas.querySelectorAll('.frame-block').forEach(s => s.classList.remove('selected'));
  window.showPageProperties();
}


/* ═══════════════════════════════════
   블록 순서 이동 — Cmd+[ (위) / Cmd+] (아래)
   이동 단위: section-inner 또는 frame-block 직속 .row / .gap-block
═══════════════════════════════════ */
function moveSelectedBlocks(direction) {
  // 프레임(frame-block)이 선택된 경우 별도 처리
  const selFrame = window._activeFrame;
  if (selFrame && selFrame.classList.contains('selected')) {
    /* ★컨테이너는 «실제 부모»다. closest('.section-inner') 는 합쳐 넣은 몸
       (.section-merged-part) 안의 프레임에 대해 «바깥» inner 를 집어, indexOf 가 -1 이 되고
       아래로 이동이 containerItems[0].after() 로 떨어져 «프레임이 섹션 맨 위로 순간이동»했다
       (위로는 idx<=0 에 걸려 먹통). 상자를 지나 밖으로 꺼내지기까지 한다. */
    const sectionInner = (selFrame.parentElement?.classList.contains('section-merged-part')
      ? selFrame.parentElement
      : selFrame.closest('.section-inner'));
    if (!sectionInner) return;
    const containerItems = [...sectionInner.children].filter(c =>
      c.classList.contains('row') || c.classList.contains('gap-block') || c.classList.contains('frame-block')
    );
    const idx = containerItems.indexOf(selFrame);
    if (direction === 'up') {
      if (idx <= 0) return;
      window.ensureHistoryCheckpoint?.('이동 전');
      containerItems[idx - 1].before(selFrame);
    } else {
      if (idx >= containerItems.length - 1) return;
      window.ensureHistoryCheckpoint?.('이동 전');
      containerItems[idx + 1].after(selFrame);
    }
    pushHistory(direction === 'up' ? '프레임 위로 이동' : '프레임 아래로 이동');
    window.buildLayerPanel?.();
    // 선택 상태 복원
    selFrame.classList.add('selected');
    window._activeFrame = selFrame;
    if (selFrame._layerItem) {
      selFrame._layerItem.classList.add('active');
      selFrame._layerItem.style.background = 'var(--ui-bg-card)';
    }
    return;
  }

  const BLOCK_SEL = '.text-block.selected, .asset-block.selected, .gap-block.selected, ' +
    '.icon-circle-block.selected, .table-block.selected, .label-group-block.selected, ' +
    '.graph-block.selected, .divider-block.selected, .bridge-block.selected, .duo-block.selected, .infocard-block.selected, .innercard-block.selected, ' +
    '.icon-text-block.selected, .shape-block.selected';

  const selBlocks = [...document.querySelectorAll(BLOCK_SEL)];
  if (selBlocks.length === 0) return;

  // 각 블록의 이동 단위(row or gap-block)를 DOM 순서대로 수집
  // ★.section-merged-part 직속 갭도 «이동 단위»다. 안 넣으면 closest('.row')=null →
  //   unitSet 이 비어 ⌘[/⌘] 가 «조용히» 아무 일도 안 한다(먹통으로 보인다).
  const _isUnitParent = el => !!el && (el.classList.contains('section-inner')
    || el.classList.contains('frame-block') || el.classList.contains('section-merged-part'));
  const getUnit = b => b.classList.contains('gap-block')
    ? (_isUnitParent(b.parentElement) ? b : b.closest('.row'))
    : b.closest('.row');

  const unitSet = new Set();
  selBlocks.forEach(b => { const u = getUnit(b); if (u) unitSet.add(u); });
  if (unitSet.size === 0) return;

  // 공통 컨테이너(section-inner / frame-block)가 동일한 unit들만 처리
  const units = [...unitSet];
  const container = units[0].parentElement;
  if (!units.every(u => u.parentElement === container)) return; // 다른 컨테이너 혼합 → 무시

  // 컨테이너의 직속 자식(row/gap-block)만 포함하는 목록
  const containerItems = [...container.children].filter(c =>
    c.classList.contains('row') || c.classList.contains('gap-block')
  );

  // DOM 순서대로 정렬
  units.sort((a, b) => containerItems.indexOf(a) - containerItems.indexOf(b));

  if (direction === 'up') {
    const firstIdx = containerItems.indexOf(units[0]);
    if (firstIdx <= 0) return; // 이미 맨 위
    window.ensureHistoryCheckpoint?.('이동 전');
    const pivot = containerItems[firstIdx - 1]; // 선택 그룹 바로 위 아이템
    pivot.before(...units); // pivot 앞에 units 통째로 삽입 (순서 유지)
  } else {
    const lastIdx = containerItems.indexOf(units[units.length - 1]);
    if (lastIdx >= containerItems.length - 1) return; // 이미 맨 아래
    window.ensureHistoryCheckpoint?.('이동 전');
    const pivot = containerItems[lastIdx + 1]; // 선택 그룹 바로 아래 아이템
    // pivot 뒤에 units 순서 유지하며 삽입: 마커로 삽입 위치 고정
    const marker = document.createComment('mv');
    pivot.after(marker);
    units.forEach(u => marker.before(u));
    marker.remove();
  }

  // 이동 전 선택된 블록 ID 저장
  const selIds = selBlocks.map(b => b.id).filter(Boolean);

  pushHistory(direction === 'up' ? '블록 위로 이동' : '블록 아래로 이동');
  window.buildLayerPanel?.();

  // buildLayerPanel 후 선택 상태 복원 (layer panel active 포함)
  selIds.forEach(id => {
    const b = document.getElementById(id);
    if (!b) return;
    b.classList.add('selected');
    if (b._layerItem) {
      b._layerItem.classList.add('active');
      b._layerItem.style.background = 'var(--ui-bg-card)';
    }
  });
}
window.moveSelectedBlocks = moveSelectedBlocks;

function bindSectionDelete(sec) {
  // 삭제 버튼 제거됨 — 레이어 패널 또는 컨텍스트 메뉴에서 처리
}

function bindSectionOrder(sec) {
  // 순서 버튼 제거됨 — 드래그 또는 레이어 패널에서 처리
}

function bindSectionHitzone(sec) {
  let hz = sec.querySelector('.section-hitzone');
  if (!hz) {
    hz = document.createElement('div');
    hz.className = 'section-hitzone';
    sec.insertBefore(hz, sec.firstChild);
  }
  // 레이블이 hitzone 밖에 있으면 안으로 이동
  const label = sec.querySelector('.section-label');
  if (label && !hz.contains(label)) {
    hz.appendChild(label);
  }
  // 기존 리스너 중복 방지: 새 노드로 교체 후 바인딩
  const fresh = hz.cloneNode(true);
  hz.replaceWith(fresh);
  fresh.addEventListener('click', e => {
    e.stopPropagation();
    selectSectionWithModifier(sec, e);
  });
  fresh.addEventListener('dblclick', e => {
    e.stopPropagation();
    // 레이어 패널에서 해당 섹션 항목으로 스크롤
    const layerEl = sec._layerSectionEl
      || document.querySelector(`.layer-section[data-sec-id="${sec.id}"]`);
    if (layerEl) {
      layerEl.scrollIntoView({ behavior: 'instant', block: 'nearest' });
      layerEl.querySelector('.layer-section-header')?.classList.add('active');
    }
  });
}


/* row 빈 여백(자식 콘텐츠 수평 범위 밖) 클릭 판정 — fix(section-select)
   row는 width:100%라 블록 정렬/폭과 무관하게 히트박스가 콘텐츠 전폭을 덮음.
   자식 envelope 밖 여백 클릭이면 row-active(래퍼 아웃라인)를 붙이지 않고 섹션 선택만 유지.
   getBoundingClientRect/clientX 모두 viewport 좌표라 캔버스 줌 스케일 무관. */
function isRowMarginClick(row, e) {
  if (e.target !== row) return false;            // 자식(col/gap 등) 직접 클릭은 기존 동작 유지
  const rects = [...row.children]
    .map(c => c.getBoundingClientRect())
    .filter(r => r.width > 0 && r.height > 0);
  if (!rects.length) return false;               // 빈 row는 기존 동작 유지 (placeholder 플로우 보호)
  const lo = Math.min(...rects.map(r => r.left));
  const hi = Math.max(...rects.map(r => r.right));
  return e.clientX < lo || e.clientX > hi;       // envelope 밖 = 여백 (블록 사이 gap 클릭은 envelope 안 → row 활성 유지)
}
window.isRowMarginClick = isRowMarginClick;

document.querySelectorAll('.section-block').forEach(sec => {
  sec.addEventListener('click', e => {
    e.stopPropagation();
    selectSectionWithModifier(sec, e);
    // deselectAll() 이후 row-active 복원 (빈 여백 클릭은 제외 — 섹션 선택만)
    const row = e.target.closest('.row');
    if (row && !isRowMarginClick(row, e) && !e.target.closest('.text-block, .asset-block, .gap-block, .col-placeholder, .icon-circle-block, .table-block, .graph-block, .divider-block, .bridge-block, .duo-block, .infocard-block, .innercard-block, .label-group-block, .icon-text-block, .canvas-block, .banner02-block, .comparison-block, .vector-block')) {
      document.querySelectorAll('.row.row-active').forEach(r => r.classList.remove('row-active'));
      row.classList.add('row-active');
      if (window.syncLayerRow) window.syncLayerRow(row);
    }
  });
  bindSectionDelete(sec);
  bindSectionOrder(sec);
  bindSectionDropZone(sec);
  bindSectionDrag(sec);
  bindSectionHitzone(sec);
});

document.getElementById('canvas-wrap').addEventListener('click', e => {
  if (['canvas-wrap','canvas-scaler','canvas'].includes(e.target.id)) deselectAll();
});

/* ── 트랙패드 제스쳐: 핀치(ctrl+wheel)=줌, 두손가락 드래그(wheel)=팬 ── */
(function initTrackpadGestures() {
  const wrap = document.getElementById('canvas-wrap');
  if (!wrap) return;
  let accum = 0, timer = null;
  wrap.addEventListener('wheel', (e) => {
    if (document.body.classList.contains('preview-mode')) return;
    if (e.ctrlKey) {
      // 핀치 = 줌
      e.preventDefault();
      accum += -e.deltaY; // 핀치 아웃(확대) → deltaY 음수
      if (timer) return;
      // setTimeout 스로틀(~60fps) — rAF는 비포커스 윈도우에서 멈춰서 setTimeout 사용
      timer = setTimeout(() => {
        const d = accum; accum = 0; timer = null;
        const step = Math.max(-30, Math.min(30, Math.round(d * 2)));
        if (step !== 0) zoomStep(step);
      }, 16);
    } else {
      // 두손가락 드래그 = 캔버스 팬. 스크롤로 흡수 가능한 만큼 스크롤하고,
      // 흡수 못한 잔여분(콘텐츠가 뷰포트에 맞거나 스크롤 끝)은 transform(panOffset)으로 자유 팬.
      e.preventDefault();
      const bt = wrap.scrollTop, bl = wrap.scrollLeft;
      wrap.scrollTop  += e.deltaY;
      wrap.scrollLeft += e.deltaX;
      const resY = e.deltaY - (wrap.scrollTop - bt);
      const resX = e.deltaX - (wrap.scrollLeft - bl);
      if (resX || resY) {
        panOffsetX -= resX;
        panOffsetY -= resY;
        // over-scroll 상한: 콘텐츠 끝을 지나 최대 '반 화면'까지만 휠 팬 허용.
        // ★휠이 실제로 민 축만 클램프(resX/resY 각각) — 세로 over-scroll이 기존 가로 오프셋(줌/스페이스팬)을
        //   깎거나 노치를 튀게 하지 않도록(Codex 리뷰 반영). 줌/스크롤바/스페이스팬은 이 경로를 안 타므로 무영향.
        if (resX) { const LIM_X = wrap.clientWidth  / 2; panOffsetX = Math.max(-LIM_X, Math.min(LIM_X, panOffsetX)); }
        if (resY) { const LIM_Y = wrap.clientHeight / 2; panOffsetY = Math.max(-LIM_Y, Math.min(LIM_Y, panOffsetY)); }
        _applyScalerTransform();
        if (window.updateNotchPosition) window.updateNotchPosition();
      }
    }
  }, { passive: false });
})();


/* ── Static 블록 초기 바인딩 ── */
document.querySelectorAll('.text-block, .asset-block, .gap-block, .icon-circle-block, .table-block, .label-group-block, .graph-block, .divider-block, .bridge-block, .duo-block, .infocard-block, .innercard-block, .icon-text-block, .canvas-block, .banner02-block, .comparison-block, .icon-block, .mockup-block, .vector-block, .step-block, .chat-block, .laurel-block').forEach(b => window.bindBlock(b));

/* ═══════════════════════════════════
   BLOCK / SECTION 추가
═══════════════════════════════════ */

function getSelectedSection() {
  const secSel = document.querySelector('.section-block.selected');
  if (secSel) return secSel;
  // sub-section 선택 시 부모 섹션 반환
  const selSS = document.querySelector('.frame-block.selected');
  if (selSS) return selSS.closest('.section-block') || null;
  const selBlock = document.querySelector(CANVAS_SEL_BLOCKS_AND_SHAPE);
  return selBlock?.closest('.section-block') || null;
}

/* ── 섹션 삭제 API ── */
function deleteSection(secIdOrEl) {
  const sec = typeof secIdOrEl === 'string'
    ? document.getElementById(secIdOrEl)
    : secIdOrEl;
  if (!sec || !sec.classList.contains('section-block')) {
    console.warn('[deleteSection] 유효한 섹션을 찾을 수 없음:', secIdOrEl);
    return false;
  }
  // 마지막 섹션 삭제 방지
  const allSecs = canvasEl.querySelectorAll('.section-block');
  if (allSecs.length <= 1) {
    console.warn('[deleteSection] 마지막 섹션은 삭제할 수 없습니다.');
    return false;
  }
  // #16: 이 섹션에 연결된 참고이미지 링크를 캡처 → «링크만» 해제(이미지는 스크래치에 그대로 = 데이터손실0).
  //   섹션 삭제와 «같은 히스토리 1건»으로 묶어(단일 ⌘Z 복원), 링크 복원은 sideEffects 로 처리한다
  //   (imageLinks 는 canvas HTML 밖이라 캔버스 스냅샷에 안 잡힘). onUndo=링크 복원 / onRedo=재해제.
  // #16: 섹션에 참고이미지가 연결돼 있어도 특수 처리 불필요 — sec.dataset.refLinks 가 섹션과 함께
  //   제거되고, canvas 스냅샷 기반 undo 가 섹션+refLinks 를 동시 복원한다(이미지는 ScratchPadDB 무접촉).
  pushHistory('섹션 삭제 전');
  sec.remove();
  deselectAll();
  window.buildLayerPanel?.();
  window.triggerAutoSave?.();
  return true;
}
window.deleteSection = deleteSection;

/* ── 블록 삭제 (text/asset/gap/frame 등 일반 블록) ── */
function deleteBlock(blockIdOrEl) {
  const block = typeof blockIdOrEl === 'string' ? document.getElementById(blockIdOrEl) : blockIdOrEl;
  if (!block) return false;
  // section은 deleteSection 별도
  if (block.classList.contains('section-block')) return false;
  pushHistory('블록 삭제 전');
  // 삭제 전 부모 text-frame 캡처 — 삭제 후 빈 wrapper(orphan) 정리용
  const parentTf = block.closest?.('.frame-block[data-text-frame="true"]');
  block.remove();
  // text-block을 지워 부모 text-frame이 비면(=.text-block 0개) 그 빈 프레임도 제거.
  // freeLayout 직속 flow(position relative, h0) 유령 wrapper 잔존 방지.
  // 단, 의도적 빈 줄(data-blank) 텍스트블럭을 품은 프레임은 정리 대상 아님
  // (애초에 .text-block이 남아있으므로 아래 조건에서 자연히 제외됨).
  if (parentTf && parentTf.isConnected && parentTf !== block
      && !parentTf.querySelector('.text-block')) {
    parentTf.remove();
  }
  window.buildLayerPanel?.();
  window.triggerAutoSave?.();
  return true;
}
window.deleteBlock = deleteBlock;

/* ── 섹션 이동 (DOM 순서 변경, beforeId 또는 afterId) ── */
function moveSection(sectionId, { beforeId, afterId } = {}) {
  const sec = document.getElementById(sectionId);
  if (!sec || !sec.classList.contains('section-block')) return false;
  let placed = false;
  if (beforeId) {
    const ref = document.getElementById(beforeId);
    if (ref && ref.classList.contains('section-block') && ref !== sec) { ref.before(sec); placed = true; }
  } else if (afterId) {
    const ref = document.getElementById(afterId);
    if (ref && ref.classList.contains('section-block') && ref !== sec) { ref.after(sec); placed = true; }
  }
  if (!placed) return false;
  pushHistory('섹션 이동 전');
  window.buildLayerPanel?.();
  window.triggerAutoSave?.();
  return true;
}
window.moveSection = moveSection;

/* ── 특정 블록 뒤에 갭 삽입 (기존 섹션 중간 갭) ── */
function insertGapAfterBlock(blockId, height) {
  const block = document.getElementById(blockId);
  if (!block) return null;
  const gb = window.makeGapBlock?.() || (() => { const d = document.createElement('div'); d.className = 'gap-block'; d.dataset.type = 'gap'; d.id = 'gb_' + Math.random().toString(36).slice(2,8); return d; })();
  if (height) gb.style.height = height + 'px';
  block.after(gb);
  if (typeof window.bindBlock === 'function') { try { window.bindBlock(gb); } catch (_) {} }
  pushHistory('갭 삽입 전');
  window.buildLayerPanel?.();
  window.triggerAutoSave?.();
  return gb.id;
}
window.insertGapAfterBlock = insertGapAfterBlock;

/* ── 플로팅 패널 드롭다운 ── */
function toggleFpPluginPanel() {
  const panel = document.getElementById('fp-plugin-panel');
  const btn   = document.getElementById('fp-plugin-btn');
  if (!panel) return;
  const isOpen = panel.style.display !== 'none';
  panel.style.display = isOpen ? 'none' : 'block';
  btn?.classList.toggle('active', !isOpen);
}
window.toggleFpPluginPanel = toggleFpPluginPanel;

// 외부 클릭 시 plugin panel 닫기는 아래 document.addEventListener('click') 에서 처리

function toggleFpDropdown(id) {
  const targetId = id || 'fp-text-dropdown';
  const target = document.getElementById(targetId);
  if (!target) return;
  const wasOpen = target.classList.contains('open');
  document.querySelectorAll('.fp-dropdown').forEach(d => d.classList.remove('open'));
  if (!wasOpen) target.classList.add('open');
}
document.addEventListener('click', e => {
  if (!e.target.closest('.fp-dropdown')) {
    document.querySelectorAll('.fp-dropdown').forEach(d => d.classList.remove('open'));
  }
  // plugin panel 외부 클릭 시 닫기
  const fpPlugin = document.getElementById('fp-plugin-panel');
  if (fpPlugin && fpPlugin.style.display !== 'none' &&
      !e.target.closest('#fp-plugin-panel') && !e.target.closest('#fp-plugin-btn')) {
    fpPlugin.style.display = 'none';
    document.getElementById('fp-plugin-btn')?.classList.remove('active');
  }
  const bdw = document.getElementById('branch-dropdown-wrap');
  if (bdw && !bdw.contains(e.target)) bdw.classList.remove('open');
  if (!e.target.closest('.col-add-btn') && !e.target.closest('.col-add-menu')) {
    document.querySelectorAll('.col-add-menu').forEach(m => m.style.display = 'none');
  }
});


/* ═══════════════════════════════════
   CANVAS PAN (Space + Drag) — transform offset 방식
═══════════════════════════════════ */
{
  const canvasWrap = document.getElementById('canvas-wrap');
  let panMode = false;
  let panning = false;
  let panStart = null;
  let panOffsetStart = null;

  function isTyping() {
    const el = document.activeElement;
    return el && (el.isContentEditable || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT');
  }

  document.addEventListener('keydown', e => {
    if (e.code === 'Space' && !e.metaKey && !e.ctrlKey && !isTyping()) {
      e.preventDefault();
      if (!panMode) {
        panMode = true;
        canvasWrap.classList.add('pan-mode');
      }
    }
  });

  document.addEventListener('keyup', e => {
    if (e.code === 'Space') {
      panMode = false;
      panning = false;
      canvasWrap.classList.remove('pan-mode', 'panning');
    }
  });

  // capture 단계: 하위 요소 stopPropagation 우회
  canvasWrap.addEventListener('mousedown', e => {
    if (!panMode || e.button !== 0) return;
    panning = true;
    panStart = { x: e.clientX, y: e.clientY };
    panOffsetStart = { x: panOffsetX, y: panOffsetY };
    canvasWrap.classList.add('panning');
    e.preventDefault();
    e.stopPropagation();
  }, true);

  window.addEventListener('mousemove', e => {
    if (!panning) return;
    panOffsetX = panOffsetStart.x + (e.clientX - panStart.x);
    panOffsetY = panOffsetStart.y + (e.clientY - panStart.y);
    _applyScalerTransform();
    if (window.updateNotchPosition) window.updateNotchPosition();
  });

  window.addEventListener('mouseup', () => {
    if (!panning) return;
    panning = false;
    if (panMode) canvasWrap.classList.remove('panning');
  });
}

/* ═══════════════════════════════════
   캔버스 «꼬리 여백» — 마지막 섹션도 맨 위로 당겨지게
   ★문제(현빈 실측): 레이어에서 마지막 섹션을 고르면 위 여유 40px 이 «안» 맞는다.
     끝까지 스크롤해도(scrollTop == 최대) 590px 이 모자랐다 —
     아래에 캔버스가 없어서 «더 당길 수가 없다». 버그가 아니라 물리적 한계였다.
   ⇒ 스크롤 컨테이너 아래에 «부족한 만큼만» 여백을 준다. 문서 편집기들이 쓰는 방식이다.
   ★고정값(=화면 한 폭)으로 주지 «않는다» — 마지막 섹션이 크면 여백이 필요 없는데도
     빈 공간이 생긴다. 필요한 만큼만 계산한다: 보이는높이 - 40 - 마지막섹션높이.
   ⚠️transform: scale 은 «레이아웃 크기를 안 바꾼다» → ResizeObserver 가 안 운다.
     그래서 배율 변경(applyZoom)에서도 직접 부른다. */
const CANVAS_TAIL_GAP = 40;   // 섹션 위에 남길 여유
/* 꼬리 여백은 «공식»으로 못 맞춘다 — 아래 selectSection 에서 «모자란 만큼»만 늘린다.
 * ★왜 공식이 안 되나: transform: scale 은 레이아웃 높이를 «안 줄인다».
 *   낮은 배율에선 레이아웃 높이(수천px)와 화면상 높이가 크게 어긋나서
 *   「보이는높이 - 40 - 마지막섹션높이」가 실제 필요량과 다르다(13% 에서 실측 어긋남).
 * ⇒ 계산하지 말고 «재라». 목표 스크롤이 최대치를 넘으면 그 차이가 곧 필요량이다. */
/* ═══════════════════════════════════
   FLOATING PANEL — 캔버스 중앙 추종
   ★문제: 좌우 패널을 접었다 펴면 «캔버스 영역»의 중심이 움직이는데,
     상단 노치는 따라가고 하단 플로팅 바는 «창 한가운데»에 고정돼 있었다.
       #canvas-notch-bar  position: absolute  → #canvas-area 안에서 가운데 (따라간다)
       #floating-panel    position: fixed     → 창 전체에서 가운데 (안 따라간다)
     실측(2026-08-28): 좌패널 237px 접으면 캔버스 중심 776 → 657 인데 플로팅은 777 그대로 = 120px 어긋남.

   ★왜 DOM 을 #canvas-area 안으로 «옮기지 않았나»:
     #canvas-area 는 overflow:hidden 이다. 플로팅 바 안의 드롭다운(스티커·플러그인 등)이
     영역 밖으로 펼쳐지면 «잘린다». 위치만 따라가게 하는 편이 부작용이 없다.

   ★ResizeObserver 를 쓴다 — 패널 토글·창 크기변경·애니메이션 «중»에도 매 프레임 따라온다.
     토글 이벤트에 갈고리를 걸면 새 토글 경로가 생길 때마다 빠뜨린다.
   ※좁을 때(바 400px > 캔버스 영역) 양옆이 패널 위로 삐져나오는 건 현빈 확인 후 «그대로 둔다».
     「실제로 문제가 보이면 그때 잡자」 — 지금 clamp 를 넣으면 그 자체로 중앙에서 벗어난다. */
/** 꼬리 여백을 버린다 — 배율변경·페이지전환·섹션삭제 등 «상태가 바뀌면» 남겨두지 않는다. */
function resetCanvasTail() {
  const sc = document.getElementById('canvas-scaler');
  if (sc && sc.style.marginBottom && sc.style.marginBottom !== '0px') sc.style.marginBottom = '0px';
}
window.resetCanvasTail = resetCanvasTail;

/** 플로팅 바와 «같이» 움직여야 하는 fixed 팝업들. absolute 인 것은 바를 따라가므로 넣지 않는다. */
const FP_FIXED_POPUPS = ['#fp-plugin-panel'];
{
  const fp   = document.getElementById('floating-panel');
  const area = document.getElementById('canvas-area');
  if (fp && area) {
    const syncFloatingPanelCenter = () => {
      const r = area.getBoundingClientRect();
      if (r.width <= 0) return;                       // 숨겨진 순간엔 건드리지 않는다
      const cx = (r.left + r.width / 2) + 'px';
      fp.style.left = cx;                             // transform: translateX(-50%) 는 CSS 그대로
      /* ★[적대검수 중대①] 바만 옮기면 «그 바에서 뜨는 팝업»이 창 중앙에 남는다.
       *   #fp-plugin-panel 은 position: fixed; left: 50% 라 바와 «따로» 논다(실측 120px 어긋남).
       *   스티커 드롭다운(.fp-dropdown-menu)은 position: absolute 라 바를 따라가므로 대상 아님.
       *   ⇒ fixed 로 뜨는 형제를 «같이» 옮긴다. 새로 생기면 여기 추가해야 한다 —
       *     그래서 셀렉터를 «한 곳»에 모아 둔다. */
      for (const sel of FP_FIXED_POPUPS) {
        const el = document.querySelector(sel);
        if (el) el.style.left = cx;
      }
    };
    syncFloatingPanelCenter();
    /* ⚠️관찰자 «참조»를 붙잡아 둔다 — 변수 없이 new 하면 수거되어 콜백이 조용히 안 울린다.
       (실측: 참조 없이 두면 패널 토글에 반응 0. 함수 자체는 정상이라 진단이 어렵다.) */
    const _fpRO = new ResizeObserver(syncFloatingPanelCenter);
    _fpRO.observe(area);
    window._fpResizeObserver = _fpRO;
    window.addEventListener('resize', syncFloatingPanelCenter);
    window.syncFloatingPanelCenter = syncFloatingPanelCenter;   // 테스트/프로브용
  }
}

/* ═══════════════════════════════════
   CENTER NOTCH BAR
═══════════════════════════════════ */
{
  const canvasWrap = document.getElementById('canvas-wrap');
  const notchBar   = document.getElementById('canvas-notch-bar');
  const notch      = document.getElementById('canvas-notch');

  let _notchHideTimer = null;

  function updateNotchPosition() {
    // panOffset 기준으로 노치 위치 표시 (0 = 중앙)
    const isCentered = Math.abs(panOffsetX) < 5 && Math.abs(panOffsetY) < 5;
    notch.classList.toggle('centered', isCentered);
    // 노치 위치: pill 가로 중앙 기준으로 offset 반영
    const pill = 80;
    const clampedX = Math.max(4, Math.min(pill - 4, pill / 2 - panOffsetX / 10));
    notch.style.left = clampedX + 'px';

    if (!isCentered) {
      notchBar.classList.add('visible');
      clearTimeout(_notchHideTimer);
      _notchHideTimer = setTimeout(() => {
        if (Math.abs(panOffsetX) < 5 && Math.abs(panOffsetY) < 5)
          notchBar.classList.remove('visible');
      }, 2500);
    }
  }
  window.updateNotchPosition = updateNotchPosition;

  notchBar.addEventListener('click', () => {
    // 팬 오프셋 리셋 (애니메이션)
    scaler.style.transition = 'transform 0.3s ease';
    resetPanOffset();
    setTimeout(() => { scaler.style.transition = ''; }, 320);
    notchBar.classList.remove('visible');
  });

  setTimeout(updateNotchPosition, 100);
}

/* ── Col 클릭: capture-phase ── */
canvasEl.addEventListener('click', e => {
  const col = e.target.closest('.col');
  if (!col) return;
  // 블록 클릭은 블록 핸들러에게 위임
  if (e.target.closest(BLOCK_DELEGATE_SEL)) return;   // SSOT — globals.js
  // col-add 버튼/메뉴는 통과 (메뉴 열기 동작 유지)
  if (e.target.closest('.col-add-btn, .col-add-menu')) return;

  const row = col.closest('.row');
  if (!row) return;

  if (e.metaKey || e.ctrlKey || e.shiftKey) {
    e.stopPropagation();
    selectColWithModifier(col, e);
    return;
  }

  e.stopPropagation();
  const isRowActive = row.classList.contains('row-active');

  if (!isRowActive) {
    // 1번 클릭: Row 활성화
    const sec = row.closest('.section-block');
    if (sec) selectSection(sec);
    document.querySelectorAll('.row.row-active').forEach(r => r.classList.remove('row-active'));
    row.classList.add('row-active');
    if (window.syncLayerRow) window.syncLayerRow(row);
    if (window.showRowProperties) window.showRowProperties(row);
  }
  // 일반 클릭 후 lastCol 설정 (clearMultiSel 이후이므로 selectSection 호출 다음에 설정)
  multiSel.lastCol = col;
}, true);
// window 할당을 initApp() 보다 먼저 — save-load.js의 initApp 내부에서 참조하기 때문
// pushHistory/undo/redo/clearHistory: history.js에서 window 노출 처리
window.deselectAll = deselectAll;
window.getBlockBreadcrumb = getBlockBreadcrumb;
window.selectSection = selectSection;
window.zoomStep = zoomStep;
window.zoomFit = zoomFit;
window.applyZoom = applyZoom;
window.getPanOffset = () => ({ x: panOffsetX, y: panOffsetY });
window.setPanOffset = (x, y) => { panOffsetX = x; panOffsetY = y; _applyScalerTransform(); };
window.toggleAllSections = toggleAllSections;
window.switchToTab = switchToTab;
window.initFileTabToggle = initFileTabToggle;
window.rgbToHex = rgbToHex;
window.bindSectionDelete  = bindSectionDelete;
window.bindSectionHitzone = bindSectionHitzone;
window.bindSectionOrder = bindSectionOrder;
window.getSelectedSection = getSelectedSection;
window.toggleFpDropdown = toggleFpDropdown;
window.copySelected = copySelected;
window.pasteClipboard = pasteClipboard;

window.multiSel = multiSel;
window.clearMultiSel = clearMultiSel;
window.selectSectionWithModifier = selectSectionWithModifier;
window.selectColWithModifier = selectColWithModifier;
window.showMultiSelPanel = showMultiSelPanel;

/* ═══════════════════════════════════
   PANEL RESIZE / COLLAPSE (좌측 패널)
═══════════════════════════════════ */
(function initPanelResize() {
  const MIN_W = 180;
  const MAX_W = 480;
  const LS_KEY = 'panelLeftWidth';
  const LS_COLLAPSED = 'panelLeftCollapsed';

  const panel = document.getElementById('panel-left');
  const handle = document.getElementById('panel-left-resize-handle');
  if (!panel || !handle) return;

  // 폭은 CSS 변수 하나로 관리 — 접기(margin-left 음수)가 같은 값을 참조해야 하므로
  // 인라인 style.width 대신 --panel-left-w 를 쓴다.
  const setWidth = w => document.documentElement.style.setProperty('--panel-left-w', w + 'px');

  const saved = parseInt(localStorage.getItem(LS_KEY));
  setWidth(saved && saved >= MIN_W && saved <= MAX_W ? saved : 240);

  // 접힘 상태 복원 — 첫 페인트에 애니메이션이 돌지 않도록 panel-anim-on은 다음 프레임에 켠다.
  const collapsed = localStorage.getItem(LS_COLLAPSED) === '1';
  document.body.classList.toggle('left-panel-collapsed', collapsed);
  requestAnimationFrame(() => document.body.classList.add('panel-anim-on'));

  // topbar 토글은 접기/펼치기 겸용이라 툴팁이 현재 상태를 따라가야 한다.
  const syncTitle = () => {
    const btn = document.getElementById('tb-toggle-left-panel');
    if (btn) btn.title = (document.body.classList.contains('left-panel-collapsed') ? '좌측 패널 펼치기' : '좌측 패널 접기') + ' (⌘\\)';
  };
  syncTitle();

  function toggleLeftPanel(force) {
    const next = typeof force === 'boolean' ? force : !document.body.classList.contains('left-panel-collapsed');
    document.body.classList.toggle('left-panel-collapsed', next);
    localStorage.setItem(LS_COLLAPSED, next ? '1' : '0');
    syncTitle();
    return next;
  }
  window.toggleLeftPanel = toggleLeftPanel;
  window.isLeftPanelCollapsed = () => document.body.classList.contains('left-panel-collapsed');

  handle.addEventListener('mousedown', e => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = panel.offsetWidth;
    document.body.classList.add('resizing-panel');

    const onMove = e => {
      const w = Math.min(MAX_W, Math.max(MIN_W, startW + (e.clientX - startX)));
      setWidth(w);
    };
    const onUp = e => {
      document.body.classList.remove('resizing-panel');
      localStorage.setItem(LS_KEY, panel.offsetWidth);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
})();

/* ═══════════════════════════════════
   PANEL COLLAPSE (우측 패널)
   좌측과 동일 — margin-right 음수 슬라이드. 우측은 폭 조절 UI가 없어 리사이즈 없음.
═══════════════════════════════════ */
(function initRightPanelCollapse() {
  const LS_COLLAPSED = 'panelRightCollapsed';
  if (!document.getElementById('panel-right')) return;

  // 접힘 상태 복원 — 첫 페인트에 애니메이션이 돌지 않도록 panel-anim-on은 다음 프레임에 켠다.
  document.body.classList.toggle('right-panel-collapsed', localStorage.getItem(LS_COLLAPSED) === '1');
  requestAnimationFrame(() => document.body.classList.add('panel-anim-on'));

  const syncTitle = () => {
    const btn = document.getElementById('tb-toggle-right-panel');
    if (btn) btn.title = (document.body.classList.contains('right-panel-collapsed') ? '속성 패널 펼치기' : '속성 패널 접기') + ' (⌘⌥\\)';
  };
  syncTitle();

  function toggleRightPanel(force) {
    const next = typeof force === 'boolean' ? force : !document.body.classList.contains('right-panel-collapsed');
    document.body.classList.toggle('right-panel-collapsed', next);
    localStorage.setItem(LS_COLLAPSED, next ? '1' : '0');
    syncTitle();
    return next;
  }
  window.toggleRightPanel = toggleRightPanel;
  window.isRightPanelCollapsed = () => document.body.classList.contains('right-panel-collapsed');
})();


// 모든 모듈 로드 후 앱 초기화 — save-load.js가 editor.js보다 늦게 평가될 수 있어
// window.initApp 등록을 폴링으로 대기 (setTimeout 0만으로는 race가 남음)
(function waitInitApp() {
  if (window.initApp) {
    window.initApp();
    // 캔버스 바탕색 컨트롤(왼쪽 Design System 패널)은 «상주»하므로 부팅 때 한 번만 배선한다.
    // ★initApp «뒤»여야 한다 — state.pageSettings 가 채워진 뒤에 현재 색을 읽어야 하니까.
    try { window.wireCanvasBgControl?.(); } catch (_) {}
  }
  else setTimeout(waitInitApp, 10);
})();

/* ═══════════════════════════════════
   EXPORTS
═══════════════════════════════════ */
export {
  pushHistory,
  undo,
  redo,
  deselectAll,
  getBlockBreadcrumb,
  selectSection,
  zoomStep,
  zoomFit,
  applyZoom,
  toggleAllSections,
  switchToTab,
  initFileTabToggle,
  rgbToHex,
  PRESETS,
  _presetsReady,
  bindSectionDelete,
  bindSectionOrder,
  getSelectedSection,
  toggleFpDropdown,
  copySelected,
  pasteClipboard,
  selectSectionWithModifier,
  selectColWithModifier,
  clearMultiSel,
};
// 위 export의 pushHistory/undo/redo는 history.js에서 import된 것을 re-export함

// (window 할당은 initApp() 호출 전 블록에서 처리됨)
