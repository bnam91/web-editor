// gradient-select.js — gradient 블록 선택 + 드래그 이동 (sticker 패턴 미러)
// 2026-05-21 신규. sticker-select.js와 동일한 capture-phase 분리 셀렉트.

function _selectGradient(block) {
  if (!block) return;
  document.querySelectorAll('.gradient-block.selected').forEach(b => {
    if (b !== block) { b.classList.remove('selected'); _removeGradientCornerHandles(b); }
  });
  window.deselectAll?.();
  block.classList.add('selected');
  _addGradientCornerHandles(block);
  window.showGradientProperties?.(block);
}
window._selectGradient = _selectGradient;

function _deselectAllGradients() {
  document.querySelectorAll('.gradient-block.selected').forEach(b => {
    b.classList.remove('selected');
    _removeGradientCornerHandles(b);
  });
}
window._deselectAllGradients = _deselectAllGradients;

// ── 4모서리 리사이즈 핸들 (sticker-corner-handle 패턴 재사용) ───────────────
function _removeGradientCornerHandles(block) {
  if (!block) return;
  block.querySelectorAll(':scope > .gradient-corner-handle').forEach(h => h.remove());
}
function _addGradientCornerHandles(block) {
  _removeGradientCornerHandles(block);
  if (!block) return;
  ['tl', 'tr', 'bl', 'br'].forEach(id => {
    const el = document.createElement('div');
    el.className = 'gradient-corner-handle';
    el.dataset.corner = id;
    block.appendChild(el);
    _bindGradientCornerDrag(el, block, id);
  });
}
function _bindGradientCornerDrag(handle, block, corner) {
  handle.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    e.stopImmediatePropagation();
    e.stopPropagation();
    e.preventDefault();
    const zoom = (window.currentZoom || 40) / 100;
    const initW = parseInt(block.dataset.gradWidth)  || 860;
    const initH = parseInt(block.dataset.gradHeight) || 300;
    const initX = parseInt(block.dataset.x) || 0;
    const initY = parseInt(block.dataset.y) || 0;
    const aspect = initH > 0 ? initW / initH : 1;
    const startCX = e.clientX, startCY = e.clientY;
    const MIN = 20;

    const onMove = (ev) => {
      _hideGradSnap();
      const dx = (ev.clientX - startCX) / zoom;
      const dy = (ev.clientY - startCY) / zoom;
      const altCenter = ev.altKey;
      let dW = 0, dH = 0;
      if      (corner === 'tl') { dW = -dx; dH = -dy; }
      else if (corner === 'tr') { dW =  dx; dH = -dy; }
      else if (corner === 'bl') { dW = -dx; dH =  dy; }
      else if (corner === 'br') { dW =  dx; dH =  dy; }
      if (altCenter) { dW *= 2; dH *= 2; }
      let newW = initW + dW;
      let newH = initH + dH;
      if (ev.shiftKey) {
        const rW = newW / initW, rH = newH / initH;
        if (Math.abs(rW - 1) >= Math.abs(rH - 1)) newH = newW / aspect;
        else newW = newH * aspect;
      }
      newW = Math.max(MIN, Math.round(newW));
      newH = Math.max(MIN, Math.round(newH));
      // ── 섹션 너비 스냅 (width only) ──────────────────────────────────────
      const sec = block.closest('.section-block');
      const secW = sec ? sec.offsetWidth : 0;
      const snapTh = GRAD_SNAP_SCREEN / zoom; // 화면 px → 섹션 로컬 px
      if (secW > 0 && Math.abs(newW - secW) <= snapTh) {
        newW = secW;
        _showGradSnapEdge(sec, 'left');
        _showGradSnapEdge(sec, 'right');
      }
      // ─────────────────────────────────────────────────────────────────────
      let newX = initX, newY = initY;
      if (altCenter) {
        newX = initX + Math.round((initW - newW) / 2);
        newY = initY + Math.round((initH - newH) / 2);
      } else if (corner === 'tl') { newX = initX + (initW - newW); newY = initY + (initH - newH); }
      else if (corner === 'tr')   { newY = initY + (initH - newH); }
      else if (corner === 'bl')   { newX = initX + (initW - newW); }
      block.dataset.gradWidth  = String(newW);
      block.dataset.gradHeight = String(newH);
      block.dataset.x = String(newX);
      block.dataset.y = String(newY);
      window.renderGradientBlock?.(block);
      // 우측 패널 슬라이더 동기화 (선택된 상태에서 패널이 열려있으면)
      const wSlider = document.getElementById('grad-width-slider');
      const wNum    = document.getElementById('grad-width-num');
      const hSlider = document.getElementById('grad-height-slider');
      const hNum    = document.getElementById('grad-height-num');
      if (wSlider) wSlider.value = newW;
      if (wNum)    wNum.value    = newW;
      if (hSlider) hSlider.value = newH;
      if (hNum)    hNum.value    = newH;
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      _hideGradSnap();
      window.pushHistory?.('그라데이션 리사이즈');
      window.scheduleAutoSave?.();
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}

// ── 엣지 맞닿기 스냅 (그라데이션 오버레이를 다른 블록 변에 약하게 끌어 붙임) ──
const GRAD_SNAP_SCREEN = 16; // 화면상 자석 끌림 거리(px) — 줌과 무관하게 일정한 체감
const _GRAD_TARGET_SEL = '.text-block,.asset-block,.card-block,.canvas-block,.banner02-block, .comparison-block,.table-block,.graph-block,.divider-block,.icon-circle-block,.label-group-block,.icon-text-block,.step-block,.chat-block,.laurel-block,.mockup-block,.shape-block,.sticker-block,.gradient-block';
let _gradSnapEls = [];

function _hideGradSnap() {
  _gradSnapEls.forEach(e => e.remove());
  _gradSnapEls = [];
}

function _showGradSnapEdge(el, side) {
  const ov = document.getElementById('ss-handles-overlay');
  if (!ov || !el) return;
  const r = el.getBoundingClientRect();
  const line = document.createElement('div');
  line.style.cssText = 'position:absolute;pointer-events:none;z-index:9999;background:var(--sel-color,#2d6fe8);box-shadow:0 0 0 0.5px rgba(255,255,255,0.4);';
  if (side === 'top')         { line.style.left = r.left+'px';        line.style.top = (r.top-1)+'px';     line.style.width = r.width+'px'; line.style.height = '2px'; }
  else if (side === 'bottom') { line.style.left = r.left+'px';        line.style.top = (r.bottom-1)+'px';  line.style.width = r.width+'px'; line.style.height = '2px'; }
  else if (side === 'left')   { line.style.left = (r.left-1)+'px';    line.style.top = r.top+'px';         line.style.width = '2px';        line.style.height = r.height+'px'; }
  else if (side === 'right')  { line.style.left = (r.right-1)+'px';   line.style.top = r.top+'px';         line.style.width = '2px';        line.style.height = r.height+'px'; }
  ov.appendChild(line);
  _gradSnapEls.push(line);
}

// 섹션 로컬 좌표(x,y)에서 형제 블록 변에 맞닿기 스냅. 적용된 좌표 + 하이라이트할 변 반환.
function _gradEdgeSnap(block, sec, x, y) {
  const bw = block.offsetWidth, bh = block.offsetHeight;
  const zoom = (window.currentZoom || 40) / 100;
  const GRAD_SNAP_TH = GRAD_SNAP_SCREEN / zoom; // 화면 px → 섹션 로컬 px 환산 (줌 무관 체감)
  const secRect = sec.getBoundingClientRect();
  const toLocal = r => ({
    L: (r.left  - secRect.left) / zoom, R: (r.right  - secRect.left) / zoom,
    T: (r.top   - secRect.top)  / zoom, B: (r.bottom - secRect.top)  / zoom,
  });
  const targets = [...sec.querySelectorAll(_GRAD_TARGET_SEL)]
    .filter(el => el !== block && !block.contains(el) && !el.contains(block));

  const gL = x, gR = x + bw, gT = y, gB = y + bh;
  let snapX = x, snapY = y, bestX = null, bestY = null, edgeX = null, edgeY = null;

  for (const t of targets) {
    const e = toLocal(t.getBoundingClientRect());
    if (e.R - e.L < 1 || e.B - e.T < 1) continue;
    // 수직 맞닿기: 그라 아랫변↔대상 윗변 / 그라 윗변↔대상 아랫변
    let d = Math.abs(gB - e.T); if (d <= GRAD_SNAP_TH && (bestY === null || d < bestY)) { bestY = d; snapY = e.T - bh; edgeY = { el: t, side: 'top' }; }
    d     = Math.abs(gT - e.B); if (d <= GRAD_SNAP_TH && (bestY === null || d < bestY)) { bestY = d; snapY = e.B;      edgeY = { el: t, side: 'bottom' }; }
    // 수평 맞닿기: 그라 오른변↔대상 왼변 / 그라 왼변↔대상 오른변
    d     = Math.abs(gR - e.L); if (d <= GRAD_SNAP_TH && (bestX === null || d < bestX)) { bestX = d; snapX = e.L - bw; edgeX = { el: t, side: 'left' }; }
    d     = Math.abs(gL - e.R); if (d <= GRAD_SNAP_TH && (bestX === null || d < bestX)) { bestX = d; snapX = e.R;      edgeX = { el: t, side: 'right' }; }
    // 동일변 정렬: 윗변↔윗변 / 아랫변↔아랫변 (같은 쪽 변 줄맞춤)
    d     = Math.abs(gT - e.T); if (d <= GRAD_SNAP_TH && (bestY === null || d < bestY)) { bestY = d; snapY = e.T;      edgeY = { el: t, side: 'top' }; }
    d     = Math.abs(gB - e.B); if (d <= GRAD_SNAP_TH && (bestY === null || d < bestY)) { bestY = d; snapY = e.B - bh; edgeY = { el: t, side: 'bottom' }; }
    // 동일변 정렬: 왼변↔왼변 / 오른변↔오른변
    d     = Math.abs(gL - e.L); if (d <= GRAD_SNAP_TH && (bestX === null || d < bestX)) { bestX = d; snapX = e.L;      edgeX = { el: t, side: 'left' }; }
    d     = Math.abs(gR - e.R); if (d <= GRAD_SNAP_TH && (bestX === null || d < bestX)) { bestX = d; snapX = e.R - bw; edgeX = { el: t, side: 'right' }; }
  }
  // 섹션 자신의 네 모서리도 스냅 타깃 — 풀폭이 아닌 페이드 오버레이를 섹션 좌/우/상/하 끝에 다시 붙이기 쉽게.
  // (기존엔 형제 블록 변에만 스냅돼, 좌측 끝(x=0)에 재정렬이 어려웠음)
  const _secW = sec.clientWidth || 0, _secH = sec.clientHeight || 0;
  let ds = Math.abs(gL - 0);     if (ds <= GRAD_SNAP_TH && (bestX === null || ds < bestX)) { bestX = ds; snapX = 0;          edgeX = { el: sec, side: 'left' }; }
  ds     = Math.abs(gR - _secW); if (ds <= GRAD_SNAP_TH && (bestX === null || ds < bestX)) { bestX = ds; snapX = _secW - bw; edgeX = { el: sec, side: 'right' }; }
  ds     = Math.abs(gT - 0);     if (ds <= GRAD_SNAP_TH && (bestY === null || ds < bestY)) { bestY = ds; snapY = 0;          edgeY = { el: sec, side: 'top' }; }
  ds     = Math.abs(gB - _secH); if (ds <= GRAD_SNAP_TH && (bestY === null || ds < bestY)) { bestY = ds; snapY = _secH - bh; edgeY = { el: sec, side: 'bottom' }; }
  return { x: Math.round(snapX), y: Math.round(snapY), edgeX, edgeY };
}

function bindGradientSelect(block) {
  if (!block || block._gradientBound) return;
  block._gradientBound = true;

  // 클릭 → 선택 (capture phase + stopImmediatePropagation)
  block.addEventListener('click', (e) => {
    e.stopPropagation();
    e.stopImmediatePropagation();
    if (!block.classList.contains('selected')) _selectGradient(block);
  }, true);

  // 드래그 — mousedown으로 위치 이동
  block.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    // 코너 핸들 위에서 누른 경우는 핸들 자체 리사이즈 핸들러가 처리하도록 양보
    // (이 리스너는 capture+stopImmediatePropagation이라 가드 없으면 핸들 mousedown을 삼켜 리사이즈가 안 됨)
    if (e.target.closest?.('.gradient-corner-handle')) return;
    e.stopImmediatePropagation();
    e.stopPropagation();
    e.preventDefault();
    if (!block.classList.contains('selected')) _selectGradient(block);

    let sec = block.closest('.section-block');
    if (!sec) return;
    const zoom = (window.currentZoom || 40) / 100;
    const startX = e.clientX;
    const startY = e.clientY;

    let origX = parseInt(block.dataset.x) || 0;
    let origY = parseInt(block.dataset.y) || 0;
    const blockRect = block.getBoundingClientRect();
    const grabOffX = (startX - blockRect.left) / zoom;
    const grabOffY = (startY - blockRect.top)  / zoom;

    const onMove = (ev) => {
      _hideGradSnap();
      const blockW = block.offsetWidth  || 0;
      const blockH = block.offsetHeight || 0;
      // 섹션 이동 (커서가 다른 섹션 위로 가면 부모 교체)
      const hoverSec = window._findSectionAt ? window._findSectionAt(ev.clientX, ev.clientY) : null;
      if (hoverSec && hoverSec !== sec) {
        hoverSec.appendChild(block);
        sec = hoverSec;
        const secRect = sec.getBoundingClientRect();
        const newXraw = (ev.clientX - secRect.left) / zoom - grabOffX;
        const newYraw = (ev.clientY - secRect.top)  / zoom - grabOffY;
        const [cx, cy] = window._clampToSection
          ? window._clampToSection(newXraw, newYraw, sec, blockW, blockH)
          : [newXraw, newYraw];
        origX = Math.round(cx);
        origY = Math.round(cy);
        block.dataset.x = String(origX);
        block.dataset.y = String(origY);
        block.style.left = origX + 'px';
        block.style.top  = origY + 'px';
        window.renderGradientBlock?.(block);
        return;
      }
      const secRect = sec.getBoundingClientRect();
      const newXraw = (ev.clientX - secRect.left) / zoom - grabOffX;
      const newYraw = (ev.clientY - secRect.top)  / zoom - grabOffY;
      const [cx, cy] = window._clampToSection
        ? window._clampToSection(newXraw, newYraw, sec, blockW, blockH)
        : [newXraw, newYraw];
      let newX = Math.round(cx);
      let newY = Math.round(cy);
      // 엣지 맞닿기 스냅 (약한 끌림) + 붙은 변 하이라이트
      const snapped = _gradEdgeSnap(block, sec, newX, newY);
      newX = snapped.x; newY = snapped.y;
      if (snapped.edgeX) _showGradSnapEdge(snapped.edgeX.el, snapped.edgeX.side);
      if (snapped.edgeY) _showGradSnapEdge(snapped.edgeY.el, snapped.edgeY.side);
      block.dataset.x = String(newX);
      block.dataset.y = String(newY);
      block.style.left = newX + 'px';
      block.style.top  = newY + 'px';
      // fill 클리핑을 새 위치에 맞게 갱신 (outline + 핸들은 블록 요소에 있어 영향 없음)
      window.renderGradientBlock?.(block);
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      _hideGradSnap();
      window.pushHistory?.('그라데이션 이동');
      window.scheduleAutoSave?.();
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, true);
}
window.bindGradientSelect = bindGradientSelect;

// 기존 row > .gradient-block 구조 마이그레이션 — 캔버스 로드 후 호출
function migrateLegacyGradientBlocks(canvasEl) {
  const root = canvasEl || document;
  root.querySelectorAll('.gradient-block').forEach(block => {
    const parentRow = block.closest('.row');
    const sec = block.closest('.section-block');
    if (!sec) return;
    // 이미 섹션 직속 자식이면 skip
    if (block.parentElement === sec) return;
    // row 안에 있다면 섹션 직속으로 끌어올리고 row 삭제 (다른 자식 없을 경우)
    if (parentRow) {
      sec.appendChild(block);
      if (!parentRow.children.length) parentRow.remove();
    } else {
      // .section-inner 안에 있거나 다른 컨테이너 — 섹션 직속으로 이동
      sec.appendChild(block);
    }
    // legacy data 정리
    delete block.dataset.usePadx;
    // x/y 기본값 보장
    if (!block.dataset.x) block.dataset.x = '0';
    if (!block.dataset.y) block.dataset.y = '0';
    // 기본 width/height dataset 보장
    if (!block.dataset.gradWidth) {
      const inlineW = block.style.width && block.style.width.endsWith('px')
        ? parseInt(block.style.width)
        : 860;
      block.dataset.gradWidth = String(inlineW);
    }
    if (!block.dataset.gradHeight) {
      const inlineH = block.style.height && block.style.height.endsWith('px')
        ? parseInt(block.style.height)
        : 300;
      block.dataset.gradHeight = String(inlineH);
    }
    // legacy margin/width inline 제거
    block.style.removeProperty('margin-left');
    block.style.removeProperty('margin-right');
    window.renderGradientBlock?.(block);
  });
}
window.migrateLegacyGradientBlocks = migrateLegacyGradientBlocks;

export { bindGradientSelect, migrateLegacyGradientBlocks };
