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
  block.querySelectorAll(':scope > .sticker-corner-handle').forEach(h => h.remove());
}
function _addGradientCornerHandles(block) {
  _removeGradientCornerHandles(block);
  if (!block) return;
  ['tl', 'tr', 'bl', 'br'].forEach(id => {
    const el = document.createElement('div');
    el.className = 'sticker-corner-handle';
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
      window.pushHistory?.('그라데이션 리사이즈');
      window.scheduleAutoSave?.();
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
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
        return;
      }
      const secRect = sec.getBoundingClientRect();
      const newXraw = (ev.clientX - secRect.left) / zoom - grabOffX;
      const newYraw = (ev.clientY - secRect.top)  / zoom - grabOffY;
      const [cx, cy] = window._clampToSection
        ? window._clampToSection(newXraw, newYraw, sec, blockW, blockH)
        : [newXraw, newYraw];
      const newX = Math.round(cx);
      const newY = Math.round(cy);
      block.dataset.x = String(newX);
      block.dataset.y = String(newY);
      block.style.left = newX + 'px';
      block.style.top  = newY + 'px';
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
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
