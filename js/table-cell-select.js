// table-cell-select.js — #5-b 테이블 바디셀 rowspan/colspan 병합
//   · 셀 «선택» 모델: shift-click 범위 + 드래그 사각 선택 → .cell-selected
//   · 병합/해제: mergeSelectedCells() / unmergeCell(cell)  (⌘M + 우클릭에서 호출)
//   · 대상은 «tbody 바디셀(td)»만 — thead 헤더 병합(mergedHeaderCols) 인프라와 완전 분리.
//   · block-drag / prop-table 와 독립. 편집(dblclick contenteditable)과 배타.
(function () {
  'use strict';
  const DRAG_THRESH = 3;

  // ── 논리 그리드 (rowspan/colspan 반영) ──────────────────────────
  // trs: tr 배열. 반환 grid[r][c] = { cell, ar, ac, isAnchor, phys, rs, cs }
  //   ar/ac = 앵커(좌상) 논리좌표, isAnchor = 그 셀의 좌상 슬롯인지, phys = tr 내 물리 인덱스.
  function buildGrid(trs) {
    const grid = [];
    trs.forEach((tr, r) => {
      grid[r] = grid[r] || [];
      let c = 0, phys = 0;
      [...tr.children].forEach(cell => {
        const tag = cell.tagName;
        if (tag !== 'TD' && tag !== 'TH') return;
        while (grid[r][c] !== undefined) c++;
        const rs = Math.max(1, parseInt(cell.getAttribute('rowspan') || '1', 10) || 1);
        const cs = Math.max(1, parseInt(cell.getAttribute('colspan') || '1', 10) || 1);
        for (let dr = 0; dr < rs; dr++) {
          for (let dc = 0; dc < cs; dc++) {
            grid[r + dr] = grid[r + dr] || [];
            grid[r + dr][c + dc] = { cell, ar: r, ac: c, isAnchor: dr === 0 && dc === 0, phys, rs, cs };
          }
        }
        c += cs; phys++;
      });
    });
    return grid;
  }
  window.__tableBuildGrid = buildGrid;

  const bodyTrs = (tbody) => [...tbody.querySelectorAll(':scope > tr')];
  const gridColCount = (grid) => {
    let m = 0; grid.forEach(row => { if (row) m = Math.max(m, row.length); }); return m;
  };
  const spanOf = (cell) => ({
    rs: Math.max(1, parseInt(cell.getAttribute('rowspan') || '1', 10) || 1),
    cs: Math.max(1, parseInt(cell.getAttribute('colspan') || '1', 10) || 1),
  });

  function findCellPos(grid, cell) {
    for (let r = 0; r < grid.length; r++) {
      const row = grid[r]; if (!row) continue;
      for (let c = 0; c < row.length; c++) {
        if (row[c] && row[c].cell === cell && row[c].isAnchor) return { r, c };
      }
    }
    return null;
  }

  // 앵커셀~포커스셀 → 병합셀의 전체 span 을 포함해 «안정될 때까지» 확장한 직사각 범위.
  function rectFrom(grid, aCell, fCell) {
    const pa = findCellPos(grid, aCell), pf = findCellPos(grid, fCell);
    if (!pa || !pf) return null;
    const sa = spanOf(aCell), sf = spanOf(fCell);
    let r0 = Math.min(pa.r, pf.r), c0 = Math.min(pa.c, pf.c);
    let r1 = Math.max(pa.r + sa.rs - 1, pf.r + sf.rs - 1);
    let c1 = Math.max(pa.c + sa.cs - 1, pf.c + sf.cs - 1);
    let changed = true, guard = 0;
    while (changed && guard++ < 2000) {
      changed = false;
      for (let r = r0; r <= r1; r++) {
        for (let c = c0; c <= c1; c++) {
          const slot = grid[r] && grid[r][c];
          if (!slot) continue;
          const rs = slot.rs, cs = slot.cs;
          const cr0 = slot.ar, cc0 = slot.ac, cr1 = slot.ar + rs - 1, cc1 = slot.ac + cs - 1;
          if (cr0 < r0) { r0 = cr0; changed = true; }
          if (cc0 < c0) { c0 = cc0; changed = true; }
          if (cr1 > r1) { r1 = cr1; changed = true; }
          if (cc1 > c1) { c1 = cc1; changed = true; }
        }
      }
    }
    return { r0, c0, r1, c1 };
  }

  // 셀 선택을 유발한 마우스 상호작용 직후의 click 이벤트를 1회 삼킴 —
  // block-drag click 핸들러(→ deselectAll → 셀 선택 소거)로 전파되는 것을 막는다.
  function armClickSwallow() {
    const swallow = (ev) => {
      ev.stopPropagation();
      ev.preventDefault();
      document.removeEventListener('click', swallow, true);
    };
    document.addEventListener('click', swallow, true);
    // 안전장치: click이 안 오는 경우 다음 tick에 해제
    setTimeout(() => document.removeEventListener('click', swallow, true), 0);
  }

  function clearMarks() {
    document.querySelectorAll('td.cell-selected, th.cell-selected').forEach(c => c.classList.remove('cell-selected'));
  }
  function clearSel() { clearMarks(); window._tblSel = null; }
  window.tableClearCellSelection = clearSel;

  // 앵커/포커스 셀로 직사각 범위 마킹
  function applyRect(tbody, aCell, fCell) {
    const grid = buildGrid(bodyTrs(tbody));
    const rect = rectFrom(grid, aCell, fCell);
    if (!rect) return;
    clearMarks();
    const seen = new Set();
    for (let r = rect.r0; r <= rect.r1; r++) {
      for (let c = rect.c0; c <= rect.c1; c++) {
        const slot = grid[r] && grid[r][c];
        if (slot && slot.isAnchor && !seen.has(slot.cell)) {
          seen.add(slot.cell);
          slot.cell.classList.add('cell-selected');
        }
      }
    }
    window._tblSel = { tbody, anchorCell: aCell, rect };
  }

  // ── 병합 ──────────────────────────────────────────────────────
  window.mergeSelectedCells = function () {
    const st = window._tblSel;
    const tbody = st && st.tbody;
    if (!tbody || !tbody.isConnected) { window.showToast?.('병합할 셀을 선택하세요'); return; }
    const selected = [...tbody.querySelectorAll('td.cell-selected')];
    if (selected.length < 2) { window.showToast?.('병합할 셀을 2개 이상 선택하세요'); return; }

    const grid = buildGrid(bodyTrs(tbody));
    let r0 = Infinity, c0 = Infinity, r1 = -1, c1 = -1, sumArea = 0;
    for (const cell of selected) {
      const p = findCellPos(grid, cell);
      if (!p) { window.showToast?.('병합 실패: 셀 위치 오류'); return; }
      const { rs, cs } = spanOf(cell);
      r0 = Math.min(r0, p.r); c0 = Math.min(c0, p.c);
      r1 = Math.max(r1, p.r + rs - 1); c1 = Math.max(c1, p.c + cs - 1);
      sumArea += rs * cs;
    }
    // 완전 타일링(직사각) 검증 — 넓이 합 == 범위 넓이
    const rectArea = (r1 - r0 + 1) * (c1 - c0 + 1);
    if (sumArea !== rectArea) { window.showToast?.('직사각형 범위만 병합할 수 있어요'); return; }
    const tl = grid[r0] && grid[r0][c0];
    if (!tl || !tl.isAnchor) { window.showToast?.('직사각형 범위만 병합할 수 있어요'); return; }
    const tlCell = tl.cell;

    window.pushHistory?.('셀 병합');
    // 텍스트 무손실: 좌상 먼저 + 나머지 비어있지 않은 텍스트 이어붙임(행/열 순서)
    const texts = [];
    const anchors = new Set();
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const slot = grid[r] && grid[r][c];
        if (slot && slot.isAnchor && !anchors.has(slot.cell)) {
          anchors.add(slot.cell);
          const t = (slot.cell.textContent || '').trim();
          if (t) texts.push(t);
        }
      }
    }
    anchors.forEach(cell => { if (cell !== tlCell) cell.remove(); });
    const rspan = r1 - r0 + 1, cspan = c1 - c0 + 1;
    if (rspan > 1) tlCell.setAttribute('rowspan', String(rspan)); else tlCell.removeAttribute('rowspan');
    if (cspan > 1) tlCell.setAttribute('colspan', String(cspan)); else tlCell.removeAttribute('colspan');
    const merged = texts.join(' ');
    if (merged !== (tlCell.textContent || '').trim()) tlCell.textContent = merged;

    clearMarks();
    tlCell.classList.add('cell-selected');
    window._tblSel = { tbody, anchorCell: tlCell };
    window.buildLayerPanel?.();
    window.scheduleAutoSave?.();
    window.showToast?.('셀 병합됨');
  };

  // ── 병합 해제 ─────────────────────────────────────────────────
  function insertEmptyAt(tbody, r, c, template) {
    const trs = bodyTrs(tbody);
    const tr = trs[r]; if (!tr) return;
    const grid = buildGrid(trs);
    const rowSlots = grid[r] || [];
    // 이 tr에 물리적으로 존재하는(=앵커 ar==r) 셀 중 논리 시작열 >= c 인 첫 셀 앞에 삽입
    let before = null;
    for (const child of [...tr.children]) {
      if (child.tagName !== 'TD' && child.tagName !== 'TH') continue;
      let startC = -1;
      for (let cc = 0; cc < rowSlots.length; cc++) {
        if (rowSlots[cc] && rowSlots[cc].cell === child && rowSlots[cc].isAnchor) { startC = cc; break; }
      }
      if (startC >= c) { before = child; break; }
    }
    const td = document.createElement('td');
    td.setAttribute('contenteditable', 'false');
    if (template) {
      if (template.className) { td.className = template.className; td.classList.remove('cell-selected'); }
      const ta = template.style && template.style.textAlign;
      if (ta) td.style.textAlign = ta;
    }
    td.textContent = '';
    if (before) tr.insertBefore(td, before); else tr.appendChild(td);
  }

  window.unmergeCell = function (cell) {
    if (!cell) { window.showToast?.('병합된 셀을 우클릭하세요'); return; }
    const tbody = cell.closest('tbody'); if (!tbody) return;
    const { rs, cs } = spanOf(cell);
    if (rs === 1 && cs === 1) { window.showToast?.('병합된 셀이 아니에요'); return; }
    const grid0 = buildGrid(bodyTrs(tbody));
    const p = findCellPos(grid0, cell); if (!p) return;
    const r0 = p.r, c0 = p.c;

    window.pushHistory?.('셀 병합 해제');
    const template = cell;
    cell.removeAttribute('rowspan');
    cell.removeAttribute('colspan');
    // 빈 셀 복원 — (r0,c0) 제외한 rect 전 위치, 행/열 오름차순(삽입 시 재계산으로 위치 정합)
    for (let r = r0; r < r0 + rs; r++) {
      for (let c = c0; c < c0 + cs; c++) {
        if (r === r0 && c === c0) continue;
        insertEmptyAt(tbody, r, c, template);
      }
    }
    clearMarks();
    cell.classList.add('cell-selected');
    window._tblSel = { tbody, anchorCell: cell };
    window.buildLayerPanel?.();
    window.scheduleAutoSave?.();
    window.showToast?.('병합 해제됨');
  };

  // ── 셀 선택 입력(mousedown: shift-click / 드래그 사각) ──────────
  document.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    const cell = e.target.closest && e.target.closest('.table-block .tb-table tbody td');
    if (!cell) return;
    const block = cell.closest('.table-block');
    if (!block || !block.classList.contains('selected')) return;
    // 편집 중이면 셀 선택 안 함 (편집과 배타)
    if (cell.getAttribute('contenteditable') === 'true') return;
    if (document.activeElement && document.activeElement.isContentEditable) return;
    const tbody = cell.closest('tbody');
    if (!tbody) return;

    if (e.shiftKey) {
      const st = window._tblSel;
      const anchor = (st && st.tbody === tbody && st.anchorCell && tbody.contains(st.anchorCell))
        ? st.anchorCell : cell;
      e.preventDefault();
      e.stopPropagation();
      applyRect(tbody, anchor, cell);
      armClickSwallow();
      return;
    }

    // 드래그 사각 선택 — threshold 넘으면 시작(순수 클릭은 일반 흐름 유지)
    let started = false;
    const sx = e.clientX, sy = e.clientY;
    const onMove = (ev) => {
      if (!started) {
        if (Math.abs(ev.clientX - sx) < DRAG_THRESH && Math.abs(ev.clientY - sy) < DRAG_THRESH) return;
        started = true;
      }
      ev.preventDefault();
      const overCell = (document.elementFromPoint(ev.clientX, ev.clientY) || document.body)
        .closest?.('.table-block .tb-table tbody td');
      if (overCell && overCell.closest('tbody') === tbody) {
        applyRect(tbody, cell, overCell);
      }
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove, true);
      document.removeEventListener('mouseup', onUp, true);
      // 드래그로 셀을 선택한 경우 직후 click을 삼켜 block-drag click(→deselectAll)이
      // 방금 만든 셀 선택을 지우지 못하게 한다. 순수 클릭(미시작)은 일반 흐름 유지.
      if (started) armClickSwallow();
    };
    document.addEventListener('mousemove', onMove, true);
    document.addEventListener('mouseup', onUp, true);
  }, true);
})();
