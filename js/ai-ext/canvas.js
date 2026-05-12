/* ══════════════════════════════════════
   AI fill 확장 — canvas-block (카드 simple) grid 자동 확장
   payload:
     { id: "cvb_xxx", cols: 2, rows: 3, cards: [{title, desc}, ...] }
   동작:
     - canvas-block.dataset.cards = JSON.stringify(payload.cards)
     - canvas-block.dataset.gridCols = payload.cols
     - canvas-block.dataset.gridRows = payload.rows
     - cards 길이가 cols*rows 와 일치 권장 (모자라면 빈 카드 채워도 OK)
     - window.renderCanvas(cvb) 호출
══════════════════════════════════════ */
(function () {
  function _aiApplyExt_canvas(sec, ext) {
    if (!sec || !ext || !ext.id) return false;
    const cvb = sec.querySelector(`#${CSS.escape(ext.id)}`);
    if (!cvb || !cvb.classList.contains('canvas-block')) return false;
    if (!Array.isArray(ext.cards)) return false;
    const cols = parseInt(ext.cols) || parseInt(cvb.dataset.gridCols) || 1;
    const rows = parseInt(ext.rows) || parseInt(cvb.dataset.gridRows) || 1;
    const total = cols * rows;
    let cards = ext.cards.map(c => ({
      title: (c && c.title) || '',
      desc: (c && c.desc) || '',
      imgSrc: (c && c.imgSrc) || '',
      cellBg: (c && c.cellBg) || ''
    }));
    if (cards.length > total) {
      cards = cards.slice(0, total);
    } else {
      while (cards.length < total) {
        cards.push({ title: '', desc: '', imgSrc: '', cellBg: '' });
      }
    }
    cvb.dataset.gridCols = String(cols);
    cvb.dataset.gridRows = String(rows);
    cvb.dataset.cards = JSON.stringify(cards);
    if (cvb.dataset.cardMode !== 'simple') cvb.dataset.cardMode = 'simple';
    if (typeof window !== 'undefined' && typeof window.renderCanvas === 'function') {
      window.renderCanvas(cvb);
    }
    return true;
  }
  if (typeof window !== 'undefined') window._aiApplyExt_canvas = _aiApplyExt_canvas;
})();
