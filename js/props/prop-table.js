import { propPanel, state } from '../globals.js';

export function showTableProperties(block) {
  const table    = block.querySelector('.tb-table');
  const thead    = table.querySelector('thead');
  const tbody    = table.querySelector('tbody');
  const colCount = table.querySelector('tr')?.querySelectorAll('th,td').length || 2;
  const rowCount = tbody?.querySelectorAll('tr').length || 0;
  const curStyle      = block.dataset.style || 'default';
  const curAlign      = block.dataset.cellAlign || 'left';
  const curPad        = parseInt(block.dataset.cellPad) || 10;
  const curSize       = parseInt(table.style.fontSize) || 28;
  const curShowHeader = block.dataset.showHeader !== 'false';

  const rebuildTable = () => {
    const cols = table.querySelector('tr')?.querySelectorAll('th,td').length || 2;
    const rows = [...(tbody?.querySelectorAll('tr') || [])];
    rows.forEach(tr => {
      const cur = tr.querySelectorAll('td').length;
      if (cur < cols) {
        for (let i = cur; i < cols; i++) {
          const td = document.createElement('td');
          td.setAttribute('contenteditable','false');
          td.textContent = '-';
          tr.appendChild(td);
        }
      } else {
        for (let i = cur; i > cols; i--) tr.lastElementChild?.remove();
      }
    });
    if (thead) {
      const ths = thead.querySelectorAll('th');
      if (ths.length < cols) {
        const tr = thead.querySelector('tr');
        for (let i = ths.length; i < cols; i++) {
          const th = document.createElement('th');
          th.setAttribute('contenteditable','false');
          th.textContent = '항목';
          tr.appendChild(th);
        }
      } else {
        const tr = thead.querySelector('tr');
        for (let i = ths.length; i > cols; i--) tr.lastElementChild?.remove();
      }
    }
    window.pushHistory();
  };

  propPanel.innerHTML = `
    <div class="prop-section">
      <div class="prop-block-label">
        <div class="prop-block-icon">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#888" stroke-width="1.3">
            <rect x="1" y="1" width="10" height="10" rx="1"/>
            <line x1="1" y1="4" x2="11" y2="4"/>
            <line x1="5" y1="4" x2="5" y2="11"/>
          </svg>
        </div>
        <div class="prop-block-info">
          <span class="prop-block-name">Table Block</span>
          <span class="prop-breadcrumb">${window.getBlockBreadcrumb(block)}</span>
        </div>
        ${block.id ? `<span class="prop-block-id" title="클릭하여 복사" onclick="_copyToClipboard('${block.id}')">${block.id}</span>` : ''}
      </div>
      <div class="prop-section-title">ROWS / COLS</div>
      <div class="prop-row">
        <span class="prop-label">행</span>
        <button class="prop-count-btn" id="tbl-row-minus">−</button>
        <span class="prop-count-val" id="tbl-row-count">${rowCount}</span>
        <button class="prop-count-btn" id="tbl-row-plus">+</button>
      </div>
      <div class="prop-row">
        <span class="prop-label">열</span>
        <button class="prop-count-btn" id="tbl-col-minus">−</button>
        <span class="prop-count-val" id="tbl-col-count">${colCount}</span>
        <button class="prop-count-btn" id="tbl-col-plus">+</button>
      </div>
    </div>
    <div class="prop-section">
      <div class="prop-section-title">HEADER</div>
      <div class="prop-row">
        <span class="prop-label">헤더 표시</span>
        <label class="prop-toggle">
          <input type="checkbox" id="tbl-show-header" ${curShowHeader ? 'checked' : ''}>
          <span class="prop-toggle-label">${curShowHeader ? '표시' : '숨김'}</span>
        </label>
      </div>
    </div>
    <div class="prop-section">
      <div class="prop-section-title">STYLE</div>
      <div class="prop-row">
        <span class="prop-label">테마</span>
        <select class="prop-select" id="tbl-style-select">
          <option value="default"    ${curStyle==='default'   ?'selected':''}>기본</option>
          <option value="stripe"     ${curStyle==='stripe'    ?'selected':''}>스트라이프</option>
          <option value="borderless" ${curStyle==='borderless'?'selected':''}>보더리스</option>
        </select>
      </div>
      <div class="prop-row">
        <span class="prop-label">정렬</span>
        <div class="prop-align-group" id="tbl-align-group">
          <button class="prop-align-btn${curAlign==='left'   ?' active':''}" data-align="left">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3">
              <line x1="1" y1="3" x2="13" y2="3"/><line x1="1" y1="6" x2="9" y2="6"/>
              <line x1="1" y1="9" x2="11" y2="9"/><line x1="1" y1="12" x2="7" y2="12"/>
            </svg>
          </button>
          <button class="prop-align-btn${curAlign==='center' ?' active':''}" data-align="center">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3">
              <line x1="1" y1="3" x2="13" y2="3"/><line x1="3" y1="6" x2="11" y2="6"/>
              <line x1="2" y1="9" x2="12" y2="9"/><line x1="4" y1="12" x2="10" y2="12"/>
            </svg>
          </button>
          <button class="prop-align-btn${curAlign==='right'  ?' active':''}" data-align="right">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3">
              <line x1="1" y1="3" x2="13" y2="3"/><line x1="5" y1="6" x2="13" y2="6"/>
              <line x1="3" y1="9" x2="13" y2="9"/><line x1="7" y1="12" x2="13" y2="12"/>
            </svg>
          </button>
        </div>
      </div>
      <div class="prop-row">
        <span class="prop-label">폰트</span>
        <input type="range" class="prop-slider" id="tbl-size-slider" min="12" max="60" step="2" value="${curSize}">
        <input type="number" class="prop-number"  id="tbl-size-number" min="12" max="60" value="${curSize}">
      </div>
      <div class="prop-row">
        <span class="prop-label">셀 패딩</span>
        <input type="range" class="prop-slider" id="tbl-pad-slider" min="4" max="32" step="2" value="${curPad}">
        <input type="number" class="prop-number"  id="tbl-pad-number" min="4" max="32" value="${curPad}">
      </div>
    </div>
    <div class="prop-section">
      <div style="font-size:11px;color:#888;">셀을 더블클릭하면 텍스트를 편집할 수 있습니다.</div>
    </div>`;

  if (window.setRpIdBadge) window.setRpIdBadge(block.id || null);

  /* 헤더 표시/숨기기 */
  document.getElementById('tbl-show-header').addEventListener('change', e => {
    const show = e.target.checked;
    block.dataset.showHeader = show ? 'true' : 'false';
    if (thead) thead.style.display = show ? '' : 'none';
    e.target.nextElementSibling.textContent = show ? '표시' : '숨김';
    window.pushHistory();
  });

  /* 행 추가/삭제 */
  document.getElementById('tbl-row-plus').addEventListener('click', () => {
    const cols = table.querySelector('tr')?.querySelectorAll('th,td').length || 2;
    const tr = document.createElement('tr');
    for (let i = 0; i < cols; i++) {
      const td = document.createElement('td');
      td.setAttribute('contenteditable','false');
      td.textContent = '-';
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
    document.getElementById('tbl-row-count').textContent = tbody.querySelectorAll('tr').length;
    window.pushHistory();
  });
  document.getElementById('tbl-row-minus').addEventListener('click', () => {
    const rows = tbody.querySelectorAll('tr');
    if (rows.length > 1) { rows[rows.length - 1].remove(); }
    document.getElementById('tbl-row-count').textContent = tbody.querySelectorAll('tr').length;
    window.pushHistory();
  });

  /* 열 추가/삭제 */
  document.getElementById('tbl-col-plus').addEventListener('click', () => {
    table.querySelectorAll('tr').forEach(tr => {
      const isHead = tr.closest('thead');
      const cell = document.createElement(isHead ? 'th' : 'td');
      cell.setAttribute('contenteditable','false');
      cell.textContent = isHead ? '항목' : '-';
      tr.appendChild(cell);
    });
    document.getElementById('tbl-col-count').textContent = table.querySelector('tr')?.querySelectorAll('th,td').length || 0;
    rebuildTable();
  });
  document.getElementById('tbl-col-minus').addEventListener('click', () => {
    const cols = table.querySelector('tr')?.querySelectorAll('th,td').length || 0;
    if (cols > 1) {
      table.querySelectorAll('tr').forEach(tr => tr.lastElementChild?.remove());
    }
    document.getElementById('tbl-col-count').textContent = table.querySelector('tr')?.querySelectorAll('th,td').length || 0;
    window.pushHistory();
  });

  /* 스타일 */
  document.getElementById('tbl-style-select').addEventListener('change', e => {
    block.dataset.style = e.target.value;
    window.pushHistory();
  });

  /* 정렬 */
  document.querySelectorAll('#tbl-align-group .prop-align-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const align = btn.dataset.align;
      block.dataset.cellAlign = align;
      table.querySelectorAll('th, td').forEach(cell => cell.style.textAlign = align);
      document.querySelectorAll('#tbl-align-group .prop-align-btn').forEach(b => b.classList.toggle('active', b === btn));
      window.pushHistory();
    });
  });

  /* 폰트 크기 */
  const applySize = v => {
    table.style.fontSize = v + 'px';
    block.dataset.fontSize = v;
    document.getElementById('tbl-size-slider').value = v;
    document.getElementById('tbl-size-number').value = v;
  };
  document.getElementById('tbl-size-slider').addEventListener('input',  e => applySize(parseInt(e.target.value)));
  document.getElementById('tbl-size-number').addEventListener('change', e => { applySize(parseInt(e.target.value)); window.pushHistory(); });
  document.getElementById('tbl-size-slider').addEventListener('change', () => window.pushHistory());

  /* 셀 여백 */
  const applyPad = v => {
    block.dataset.cellPad = v;
    const style = document.getElementById('_tbl-pad-style') || (() => {
      const s = document.createElement('style'); s.id = '_tbl-pad-style'; document.head.appendChild(s); return s;
    })();
    style.textContent = '';
    table.querySelectorAll('th, td').forEach(cell => { cell.style.padding = v + 'px 16px'; });
    document.getElementById('tbl-pad-slider').value = v;
    document.getElementById('tbl-pad-number').value = v;
  };
  document.getElementById('tbl-pad-slider').addEventListener('input',  e => applyPad(parseInt(e.target.value)));
  document.getElementById('tbl-pad-number').addEventListener('change', e => { applyPad(parseInt(e.target.value)); window.pushHistory(); });
  document.getElementById('tbl-pad-slider').addEventListener('change', () => window.pushHistory());
}


window.showTableProperties = showTableProperties;
