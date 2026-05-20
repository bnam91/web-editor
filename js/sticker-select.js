// sticker-select.js — 스티커 블록 선택 + 드래그 이동
// 어노테이션 셀렉트와 동일한 플로팅 오버레이 패턴

// ── 공유 헬퍼 (annotation-select.js와 공유) ───────────────────────────
// 마우스 client 좌표로 어떤 .section-block 위에 있는지 hit-test.
// elementsFromPoint 우선, 실패 시 모든 section-block rect 순회 fallback.
function _findSectionAt(clientX, clientY) {
  try {
    const stack = document.elementsFromPoint(clientX, clientY) || [];
    for (const el of stack) {
      const sec = el.closest && el.closest('.section-block');
      if (sec) return sec;
    }
  } catch (_) {}
  const all = document.querySelectorAll('.section-block');
  for (const sec of all) {
    const r = sec.getBoundingClientRect();
    if (clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom) {
      return sec;
    }
  }
  return null;
}
window._findSectionAt = _findSectionAt;

// 좌표를 섹션 안으로 clamp (블록 크기 고려).
// secW/secH는 layout 기준 (clientWidth/Height — zoom 영향 없음).
function _clampToSection(x, y, sec, blockW, blockH) {
  const secW = sec.clientWidth  || 0;
  const secH = sec.clientHeight || 0;
  const bw = blockW || 0;
  const bh = blockH || 0;
  const maxX = Math.max(0, secW - bw);
  const maxY = Math.max(0, secH - bh);
  return [
    Math.min(Math.max(0, x), maxX),
    Math.min(Math.max(0, y), maxY),
  ];
}
window._clampToSection = _clampToSection;

function _selectSticker(block) {
  if (!block) return;
  // 다른 selected 풀기 (deselectAll이 sticker-block도 처리)
  document.querySelectorAll('.sticker-block.selected').forEach(b => {
    if (b !== block) { b.classList.remove('selected'); _removeHlbHandles(b); }
  });
  window.deselectAll?.();
  block.classList.add('selected');
  if (block.dataset.shape === 'highlightB') _addHlbHandles(block);
  window.showStickerProperties?.(block);
}
window._selectSticker = _selectSticker;

function _deselectAllStickers() {
  document.querySelectorAll('.sticker-block.selected').forEach(b => {
    b.classList.remove('selected');
    _removeHlbHandles(b);
  });
}
window._deselectAllStickers = _deselectAllStickers;

// ── HighlightB 끝점 핸들 ──
function _removeHlbHandles(block) {
  block.querySelectorAll('.hlb-handle').forEach(h => h.remove());
}
function _addHlbHandles(block) {
  _removeHlbHandles(block);
  if (block.dataset.shape !== 'highlightB') return;
  const x1 = parseFloat(block.dataset.x1) || 0;
  const y1 = parseFloat(block.dataset.y1) || 0;
  const x2 = parseFloat(block.dataset.x2) || 0;
  const y2 = parseFloat(block.dataset.y2) || 0;
  // bbox top/left 기준으로 핸들 위치 (block은 left/top이 min(x1,x2)/min(y1,y2)에 박힘)
  const minX = Math.min(x1, x2);
  const minY = Math.min(y1, y2);
  const mk = (endpoint, hx, hy) => {
    const h = document.createElement('div');
    h.className = 'hlb-handle';
    h.dataset.endpoint = endpoint;
    h.style.left = (hx - minX) + 'px';
    h.style.top  = (hy - minY) + 'px';
    block.appendChild(h);
    _bindHlbHandleDrag(h, block, endpoint);
  };
  mk('start', x1, y1);
  mk('end',   x2, y2);
}
function _bindHlbHandleDrag(handle, block, endpoint) {
  handle.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    e.stopImmediatePropagation();
    e.stopPropagation();
    e.preventDefault();
    const sec = block.closest('.section-block');
    if (!sec) return;
    const zoom = (window.currentZoom || 40) / 100;
    const startCX = e.clientX, startCY = e.clientY;
    const initX = parseFloat(block.dataset['x' + (endpoint === 'start' ? '1' : '2')]) || 0;
    const initY = parseFloat(block.dataset['y' + (endpoint === 'start' ? '1' : '2')]) || 0;
    const otherX = parseFloat(block.dataset['x' + (endpoint === 'start' ? '2' : '1')]) || 0;
    const otherY = parseFloat(block.dataset['y' + (endpoint === 'start' ? '2' : '1')]) || 0;
    const onMove = (ev) => {
      let nx = initX + (ev.clientX - startCX) / zoom;
      let ny = initY + (ev.clientY - startCY) / zoom;
      // Shift+드래그 — 다른 endpoint 기준 수평/수직 snap
      if (ev.shiftKey) {
        const dx = nx - otherX;
        const dy = ny - otherY;
        if (Math.abs(dx) >= Math.abs(dy)) ny = otherY;
        else nx = otherX;
      }
      block.dataset['x' + (endpoint === 'start' ? '1' : '2')] = String(Math.round(nx));
      block.dataset['y' + (endpoint === 'start' ? '1' : '2')] = String(Math.round(ny));
      window.renderStickerBlock?.(block);
      _addHlbHandles(block); // 핸들 위치도 갱신
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      window.pushHistory?.('형광펜 선 끝점 이동');
      window.scheduleAutoSave?.();
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}
window._addHlbHandles = _addHlbHandles;
window._removeHlbHandles = _removeHlbHandles;

function bindStickerSelect(block) {
  if (!block || block._stickerBound) return;
  block._stickerBound = true;

  // 클릭 → 선택 (capture + stopImmediatePropagation으로 다른 핸들러 격리)
  block.addEventListener('click', (e) => {
    e.stopPropagation();
    e.stopImmediatePropagation();
    if (!block.classList.contains('selected')) _selectSticker(block);
  }, true);

  // 드래그 — mousedown으로 위치 이동
  block.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    e.stopImmediatePropagation();
    e.stopPropagation();
    e.preventDefault();
    if (!block.classList.contains('selected')) _selectSticker(block);

    let sec = block.closest('.section-block');
    if (!sec) return;
    const zoom = (window.currentZoom || 40) / 100;
    const startX = e.clientX;
    const startY = e.clientY;

    // ── highlightB 전용 드래그 — 두 점을 함께 평행이동 ────────────────
    if (block.dataset.shape === 'highlightB') {
      const ox1 = parseFloat(block.dataset.x1) || 0;
      const oy1 = parseFloat(block.dataset.y1) || 0;
      const ox2 = parseFloat(block.dataset.x2) || 0;
      const oy2 = parseFloat(block.dataset.y2) || 0;
      const onMoveB = (ev) => {
        const dx = (ev.clientX - startX) / zoom;
        const dy = (ev.clientY - startY) / zoom;
        block.dataset.x1 = String(Math.round(ox1 + dx));
        block.dataset.y1 = String(Math.round(oy1 + dy));
        block.dataset.x2 = String(Math.round(ox2 + dx));
        block.dataset.y2 = String(Math.round(oy2 + dy));
        window.renderStickerBlock?.(block);
      };
      const onUpB = () => {
        document.removeEventListener('mousemove', onMoveB);
        document.removeEventListener('mouseup', onUpB);
        window.pushHistory?.('선 형광펜 이동');
        window.scheduleAutoSave?.();
      };
      document.addEventListener('mousemove', onMoveB);
      document.addEventListener('mouseup', onUpB);
      return;
    }

    let origX = parseInt(block.dataset.x) || 0;
    let origY = parseInt(block.dataset.y) || 0;
    // 드래그 시작 시 마우스가 블록 내부 어디를 잡았는지 (offset)
    const blockRect = block.getBoundingClientRect();
    const grabOffX = (startX - blockRect.left) / zoom;
    const grabOffY = (startY - blockRect.top)  / zoom;

    const onMove = (ev) => {
      const blockW = block.offsetWidth  || 0;
      const blockH = block.offsetHeight || 0;
      // 현재 마우스가 어떤 섹션 위에 있는지 탐지 (B 정책)
      const hoverSec = window._findSectionAt ? window._findSectionAt(ev.clientX, ev.clientY) : null;
      if (hoverSec && hoverSec !== sec) {
        // 부모 섹션 변경 — DOM 이동 + 좌표 reset (새 섹션 기준)
        hoverSec.appendChild(block);
        sec = hoverSec;
        const secRect = sec.getBoundingClientRect();
        const newXraw = (ev.clientX - secRect.left) / zoom - grabOffX;
        const newYraw = (ev.clientY - secRect.top)  / zoom - grabOffY;
        const [cx, cy] = window._clampToSection(newXraw, newYraw, sec, blockW, blockH);
        origX = Math.round(cx);
        origY = Math.round(cy);
        block.dataset.x = String(origX);
        block.dataset.y = String(origY);
        block.style.left = origX + 'px';
        block.style.top  = origY + 'px';
        return;
      }
      // 같은 섹션 또는 섹션 밖 — 기존 섹션 유지 + clamp
      const secRect = sec.getBoundingClientRect();
      const newXraw = (ev.clientX - secRect.left) / zoom - grabOffX;
      const newYraw = (ev.clientY - secRect.top)  / zoom - grabOffY;
      const [cx, cy] = window._clampToSection(newXraw, newYraw, sec, blockW, blockH);
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
      window.pushHistory?.('스티커 이동');
      window.scheduleAutoSave?.();
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, true);

  // 더블클릭 → 텍스트 편집 (contenteditable)
  block.addEventListener('dblclick', (e) => {
    e.stopPropagation();
    const textEl = block.querySelector('.sticker-text');
    if (!textEl) return;
    textEl.setAttribute('contenteditable', 'true');
    textEl.focus();
    const range = document.createRange();
    range.selectNodeContents(textEl);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);

    const finish = () => {
      textEl.removeAttribute('contenteditable');
      const t = (textEl.textContent || '').trim();
      block.dataset.text = t || 'NEW';
      if (!t) textEl.textContent = 'NEW';
      window.pushHistory?.('스티커 텍스트');
      window.scheduleAutoSave?.();
      textEl.removeEventListener('blur', finish);
      textEl.removeEventListener('keydown', onKey);
    };
    const onKey = (ev) => {
      if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); textEl.blur(); }
      else if (ev.key === 'Escape') { ev.stopPropagation(); textEl.blur(); }
    };
    textEl.addEventListener('blur', finish);
    textEl.addEventListener('keydown', onKey);
  });
}
window.bindStickerSelect = bindStickerSelect;

// ESC/v로 deselect
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' && e.key !== 'v') return;
  const sel = document.querySelector('.sticker-block.selected');
  if (!sel) return;
  if (document.activeElement && document.activeElement.getAttribute('contenteditable') === 'true') return;
  _deselectAllStickers();
});

// Delete/Backspace로 선택된 스티커 삭제
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Delete' && e.key !== 'Backspace') return;
  const tag = e.target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable) return;
  const sel = document.querySelector('.sticker-block.selected');
  if (!sel) return;
  // contenteditable 텍스트 편집 중이면 default 동작 (글자 삭제) 유지
  if (sel.querySelector('[contenteditable="true"]')) return;
  e.preventDefault();
  sel.remove();
  window.pushHistory?.('스티커 삭제');
  window.scheduleAutoSave?.();
});
