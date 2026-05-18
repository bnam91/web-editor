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
    if (b !== block) b.classList.remove('selected');
  });
  window.deselectAll?.();
  block.classList.add('selected');
  window.showStickerProperties?.(block);
}
window._selectSticker = _selectSticker;

function _deselectAllStickers() {
  document.querySelectorAll('.sticker-block.selected').forEach(b => b.classList.remove('selected'));
}
window._deselectAllStickers = _deselectAllStickers;

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
