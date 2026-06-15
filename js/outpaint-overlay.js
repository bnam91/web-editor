/* ══════════════════════════════════════
   Outpaint Overlay — 스크래치 아이템 위에 확장 영역 표시
   API:
     window._outpaintShow(spId)
     window._outpaintHide()
     window._outpaintGetBox() → { spId, src, origW, origH, padTop, padRight, padBottom, padLeft }
   - canvas-scaler 좌표계 기준 (zoom transform 보정)
══════════════════════════════════════ */

(function () {
  let _state = null; // { spId, src, origW, origH, padTop, padRight, padBottom, padLeft, overlay, item, observer }

  function _getScale() {
    const sc = document.getElementById('canvas-scaler');
    if (!sc) return 1;
    const t = sc.style.transform || '';
    const m = /scale\(([\d.]+)\)/.exec(t);
    return m ? parseFloat(m[1]) : 1;
  }

  function _findScratchItem(spId) {
    return [...document.querySelectorAll('.scratch-item')]
      .find(el => el.dataset.scratchId === spId);
  }

  function _placeOverlay() {
    if (!_state) return;
    const { overlay, item, padTop, padRight, padBottom, padLeft } = _state;
    _state.origW = item.offsetWidth;
    _state.origH = item.offsetHeight;
    const left = item.offsetLeft - padLeft;
    const top  = item.offsetTop  - padTop;
    const w    = item.offsetWidth  + padLeft + padRight;
    const h    = item.offsetHeight + padTop  + padBottom;
    overlay.style.left   = left + 'px';
    overlay.style.top    = top  + 'px';
    overlay.style.width  = w + 'px';
    overlay.style.height = h + 'px';
    // 모달 안 info box 업데이트
    const ow = Math.round(item.offsetWidth);
    const oh = Math.round(item.offsetHeight);
    const sizeEl = document.getElementById('aig-outpaint-info-size');
    const detailEl = document.getElementById('aig-outpaint-info-detail');
    if (sizeEl)   sizeEl.textContent   = `${Math.round(w)} × ${Math.round(h)} px`;
    if (detailEl) detailEl.textContent = `원본 ${ow} × ${oh} px  ·  패드 ↑${Math.round(padTop)}  ↓${Math.round(padBottom)}  ←${Math.round(padLeft)}  →${Math.round(padRight)}`;
  }

  function _bindHandle(handle, dir) {
    handle.addEventListener('mousedown', e => {
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX;
      const startY = e.clientY;
      const scale = _getScale();
      const init = {
        padTop: _state.padTop, padRight: _state.padRight,
        padBottom: _state.padBottom, padLeft: _state.padLeft,
      };
      const onMove = (ev) => {
        const dx = (ev.clientX - startX) / scale;
        const dy = (ev.clientY - startY) / scale;
        if (dir.includes('n')) _state.padTop    = Math.max(0, init.padTop    - dy);
        if (dir.includes('s')) _state.padBottom = Math.max(0, init.padBottom + dy);
        if (dir.includes('w')) _state.padLeft   = Math.max(0, init.padLeft   - dx);
        if (dir.includes('e')) _state.padRight  = Math.max(0, init.padRight  + dx);
        _placeOverlay();
      };
      const onUp = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    });
  }

  function _outpaintShow(spId) {
    _outpaintHide();
    const item = _findScratchItem(spId);
    if (!item) return;
    const img = item.querySelector('img');
    const src = img?.src || '';
    const origW = item.offsetWidth;
    const origH = item.offsetHeight;
    const parent = item.parentElement;
    if (!parent) return;

    const overlay = document.createElement('div');
    overlay.className = 'outpaint-overlay';
    overlay.dataset.spId = spId;

    // 8 핸들
    ['nw','n','ne','e','se','s','sw','w'].forEach(dir => {
      const h = document.createElement('div');
      h.className = `outpaint-handle outpaint-h-${dir}`;
      h.dataset.dir = dir;
      overlay.appendChild(h);
    });

    parent.appendChild(overlay);

    // 모달 안 info box 보이기
    const infoBox = document.getElementById('aig-outpaint-info-box');
    if (infoBox) infoBox.style.display = 'block';

    _state = {
      spId, src, origW, origH,
      padTop: 0, padRight: 0, padBottom: 0, padLeft: 0,
      overlay, item, observer: null, intervalId: null,
    };

    overlay.querySelectorAll('.outpaint-handle').forEach(h => _bindHandle(h, h.dataset.dir));
    _placeOverlay();

    // 추종: MutationObserver(드래그/리사이즈) + 50ms 폴링(transform/스크롤 등 빠뜨림 방지)
    _state.observer = new MutationObserver(() => _placeOverlay());
    _state.observer.observe(item, { attributes: true, attributeFilter: ['style'] });
    _state.intervalId = setInterval(_placeOverlay, 50);
  }

  function _outpaintHide() {
    if (_state?.observer) _state.observer.disconnect();
    if (_state?.intervalId) clearInterval(_state.intervalId);
    if (_state?.overlay) _state.overlay.remove();
    _state = null;
    const infoBox = document.getElementById('aig-outpaint-info-box');
    if (infoBox) infoBox.style.display = 'none';
  }

  function _outpaintGetBox() {
    if (!_state) return null;
    return {
      spId: _state.spId,
      src: _state.src,
      origW: _state.origW,
      origH: _state.origH,
      padTop: Math.round(_state.padTop),
      padRight: Math.round(_state.padRight),
      padBottom: Math.round(_state.padBottom),
      padLeft: Math.round(_state.padLeft),
    };
  }

  window._outpaintShow   = _outpaintShow;
  window._outpaintHide   = _outpaintHide;
  window._outpaintGetBox = _outpaintGetBox;
})();
