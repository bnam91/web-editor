/* ══════════════════════════════════════
   AI fill 확장 — table-block 행/열 자동 확장
   payload:
     { id: "tbl_xxx", headers: ["헤더1", ...], rows: [["c1","c2"], ...] }
   동작:
     - 해당 table의 thead row를 headers 배열로 재구성
     - tbody의 tr 수를 rows.length로 맞추고 각 td를 rows[r][c]로 채움
     - 행/열 수가 늘어나면 추가, 줄어들면 제거
══════════════════════════════════════ */
(function () {
  function _aiApplyExt_table(sec, ext) {
    if (!sec || !ext || !ext.id) return false;
    const tbl = sec.querySelector(`#${CSS.escape(ext.id)}`);
    if (!tbl || !tbl.classList.contains('table-block')) return false;
    if (!Array.isArray(ext.headers) || !Array.isArray(ext.rows)) return false;
    const tableEl = tbl.querySelector(':scope > table');
    if (!tableEl) return false;

    const align = tbl.dataset.cellAlign || 'center';
    const headers = ext.headers;
    const rows = ext.rows;
    const colCount = headers.length;

    // ── thead 재구성 ────────────────────────────
    let thead = tableEl.querySelector(':scope > thead');
    if (!thead) {
      thead = document.createElement('thead');
      tableEl.insertBefore(thead, tableEl.firstChild);
    }
    // 기존 모든 tr 제거
    while (thead.firstChild) thead.removeChild(thead.firstChild);
    const headTr = document.createElement('tr');
    for (let c = 0; c < colCount; c++) {
      const th = document.createElement('th');
      th.style.textAlign = align;
      th.textContent = String(headers[c] ?? '');
      headTr.appendChild(th);
    }
    thead.appendChild(headTr);
    // dataset.showHeader 보존
    if (tbl.dataset.showHeader === 'false') {
      thead.style.display = 'none';
    } else {
      thead.style.display = '';
    }

    // ── tbody 재구성 ────────────────────────────
    let tbody = tableEl.querySelector(':scope > tbody');
    if (!tbody) {
      tbody = document.createElement('tbody');
      tableEl.appendChild(tbody);
    }
    while (tbody.firstChild) tbody.removeChild(tbody.firstChild);
    for (let r = 0; r < rows.length; r++) {
      const rowArr = Array.isArray(rows[r]) ? rows[r] : [];
      const tr = document.createElement('tr');
      const cellN = Math.max(colCount, rowArr.length);
      for (let c = 0; c < cellN; c++) {
        const td = document.createElement('td');
        td.style.textAlign = align;
        td.textContent = String(rowArr[c] ?? '');
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }

    return true;
  }
  if (typeof window !== 'undefined') window._aiApplyExt_table = _aiApplyExt_table;
})();
