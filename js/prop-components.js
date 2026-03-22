function showIconCircleProperties(block) {
  const circle   = block.querySelector('.icb-circle');
  const size     = parseInt(block.dataset.size)    || 80;
  const bgColor  = block.dataset.bgColor           || '#e8e8e8';
  const borderV  = block.dataset.border            || 'none';
  const radius   = parseInt(block.dataset.radius)  || 0;

  propPanel.innerHTML = `
    <div class="prop-section">
      <div class="prop-block-label">
        <div class="prop-block-icon">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#888" stroke-width="1.3">
            <circle cx="6" cy="6" r="5"/>
          </svg>
        </div>
        <span class="prop-block-name">Icon Circle</span>
        ${block.id ? `<span class="prop-block-id" title="클릭하여 복사" onclick="navigator.clipboard.writeText('${block.id}')">${block.id}</span>` : ''}
      </div>
      <div class="prop-section-title">크기</div>
      <div class="prop-row">
        <span class="prop-label">지름</span>
        <input type="range" class="prop-slider" id="icb-size-slider" min="40" max="860" step="4" value="${size}">
        <input type="number" class="prop-number"  id="icb-size-number" min="40" max="860" value="${size}">
      </div>
    </div>
    <div class="prop-section">
      <div class="prop-section-title">색상</div>
      <div class="prop-color-row">
        <span class="prop-label">배경</span>
        <div class="prop-color-swatch" style="background:${bgColor}">
          <input type="color" id="icb-bg-color" value="${bgColor}">
        </div>
        <input type="text" class="prop-color-hex" id="icb-bg-hex" value="${bgColor}" maxlength="7">
      </div>
    </div>
    <div class="prop-section">
      <div class="prop-section-title">테두리</div>
      <div class="prop-row">
        <span class="prop-label">스타일</span>
        <select class="prop-select" id="icb-border-select">
          <option value="none"   ${borderV==='none'   ?'selected':''}>없음</option>
          <option value="solid"  ${borderV==='solid'  ?'selected':''}>실선</option>
          <option value="dashed" ${borderV==='dashed' ?'selected':''}>점선</option>
        </select>
      </div>
    </div>`;

  // 이미지 섹션 추가
  const hasImage = block.classList.contains('has-image');
  propPanel.innerHTML += hasImage ? `
    <div class="prop-section">
      <div class="prop-section-title">이미지</div>
      <button class="prop-action-btn secondary" id="icb-replace-btn">이미지 교체</button>
      <button class="prop-action-btn danger"    id="icb-remove-btn">이미지 제거</button>
    </div>` : `
    <div class="prop-section">
      <div class="prop-section-title">이미지</div>
      <button class="prop-action-btn primary" id="icb-upload-btn">이미지 선택</button>
      <div style="text-align:center;font-size:11px;color:#555;margin-top:6px;">또는 블록에 파일을 드래그</div>
    </div>`;

  if (hasImage) {
    document.getElementById('icb-replace-btn').addEventListener('click', () => triggerCircleUpload(block));
    document.getElementById('icb-remove-btn').addEventListener('click', () => clearCircleImage(block));
  } else {
    document.getElementById('icb-upload-btn').addEventListener('click', () => triggerCircleUpload(block));
  }

  const applySize = v => {
    v = Math.min(860, Math.max(40, v));
    block.dataset.size     = v;
    circle.style.width     = v + 'px';
    circle.style.height    = v + 'px';
    document.getElementById('icb-size-slider').value = v;
    document.getElementById('icb-size-number').value = v;
  };
  document.getElementById('icb-size-slider').addEventListener('input',  e => applySize(parseInt(e.target.value)));
  document.getElementById('icb-size-number').addEventListener('change', e => { applySize(parseInt(e.target.value)); pushHistory(); });
  document.getElementById('icb-size-slider').addEventListener('change', () => pushHistory());

  const bgPicker = document.getElementById('icb-bg-color');
  const bgHex    = document.getElementById('icb-bg-hex');
  const bgSwatch = bgPicker.closest('.prop-color-swatch');
  bgPicker.addEventListener('input', () => {
    block.dataset.bgColor   = bgPicker.value;
    circle.style.background = bgPicker.value;
    bgHex.value             = bgPicker.value;
    bgSwatch.style.background = bgPicker.value;
  });
  bgPicker.addEventListener('change', () => pushHistory());
  bgHex.addEventListener('input', () => {
    if (/^#[0-9a-f]{6}$/i.test(bgHex.value)) {
      block.dataset.bgColor   = bgHex.value;
      circle.style.background = bgHex.value;
      bgPicker.value          = bgHex.value;
      bgSwatch.style.background = bgHex.value;
      pushHistory();
    }
  });

  document.getElementById('icb-border-select').addEventListener('change', e => {
    block.dataset.border   = e.target.value;
    circle.dataset.border  = e.target.value;
    pushHistory();
  });
}

function showTableProperties(block) {
  const table    = block.querySelector('.tb-table');
  const thead    = table.querySelector('thead');
  const tbody    = table.querySelector('tbody');
  const colCount = table.querySelector('tr')?.querySelectorAll('th,td').length || 2;
  const rowCount = tbody?.querySelectorAll('tr').length || 0;
  const curStyle = block.dataset.style || 'default';
  const curAlign = block.dataset.cellAlign || 'left';
  const curPad   = parseInt(block.dataset.cellPad) || 10;
  const curSize  = parseInt(table.style.fontSize) || 28;

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
    pushHistory();
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
        <span class="prop-block-name">Table Block</span>
        ${block.id ? `<span class="prop-block-id" title="클릭하여 복사" onclick="navigator.clipboard.writeText('${block.id}')">${block.id}</span>` : ''}
      </div>
      <div class="prop-section-title">행 / 열</div>
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
      <div class="prop-section-title">스타일</div>
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
          <button class="prop-align-btn${curAlign==='left'   ?' active':''}" data-align="left">←</button>
          <button class="prop-align-btn${curAlign==='center' ?' active':''}" data-align="center">↔</button>
          <button class="prop-align-btn${curAlign==='right'  ?' active':''}" data-align="right">→</button>
        </div>
      </div>
      <div class="prop-row">
        <span class="prop-label">폰트</span>
        <input type="range" class="prop-slider" id="tbl-size-slider" min="12" max="60" step="2" value="${curSize}">
        <input type="number" class="prop-number"  id="tbl-size-number" min="12" max="60" value="${curSize}">
      </div>
      <div class="prop-row">
        <span class="prop-label">여백</span>
        <input type="range" class="prop-slider" id="tbl-pad-slider" min="4" max="32" step="2" value="${curPad}">
        <input type="number" class="prop-number"  id="tbl-pad-number" min="4" max="32" value="${curPad}">
      </div>
    </div>
    <div class="prop-section">
      <div style="font-size:11px;color:#888;">셀을 더블클릭하면 텍스트를 편집할 수 있습니다.</div>
    </div>`;

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
    pushHistory();
  });
  document.getElementById('tbl-row-minus').addEventListener('click', () => {
    const rows = tbody.querySelectorAll('tr');
    if (rows.length > 1) { rows[rows.length - 1].remove(); }
    document.getElementById('tbl-row-count').textContent = tbody.querySelectorAll('tr').length;
    pushHistory();
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
    pushHistory();
  });

  /* 스타일 */
  document.getElementById('tbl-style-select').addEventListener('change', e => {
    block.dataset.style = e.target.value;
    pushHistory();
  });

  /* 정렬 */
  document.querySelectorAll('#tbl-align-group .prop-align-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const align = btn.dataset.align;
      block.dataset.cellAlign = align;
      table.querySelectorAll('th, td').forEach(cell => cell.style.textAlign = align);
      document.querySelectorAll('#tbl-align-group .prop-align-btn').forEach(b => b.classList.toggle('active', b === btn));
      pushHistory();
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
  document.getElementById('tbl-size-number').addEventListener('change', e => { applySize(parseInt(e.target.value)); pushHistory(); });
  document.getElementById('tbl-size-slider').addEventListener('change', () => pushHistory());

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
  document.getElementById('tbl-pad-number').addEventListener('change', e => { applyPad(parseInt(e.target.value)); pushHistory(); });
  document.getElementById('tbl-pad-slider').addEventListener('change', () => pushHistory());
}

function showGapProperties(gb) {
  const currentH = gb.offsetHeight;
  propPanel.innerHTML = `
    <div class="prop-section">
      <div class="prop-block-label">
        <div class="prop-block-icon">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#888" stroke-width="1.3">
            <line x1="1" y1="4" x2="11" y2="4" stroke-dasharray="2,1"/>
            <line x1="1" y1="8" x2="11" y2="8" stroke-dasharray="2,1"/>
          </svg>
        </div>
        <span class="prop-block-name">Gap Block</span>
        ${gb.id ? `<span class="prop-block-id" title="클릭하여 복사" onclick="navigator.clipboard.writeText('${gb.id}')">${gb.id}</span>` : ''}
      </div>
      <div class="prop-section-title">크기</div>
      <div class="prop-row">
        <span class="prop-label">높이</span>
        <input type="range" class="prop-slider" id="gap-slider" min="0" max="400" step="4" value="${currentH}">
        <input type="number" class="prop-number" id="gap-number" min="0" max="400" value="${currentH}">
      </div>
    </div>`;

  const slider = document.getElementById('gap-slider');
  const number = document.getElementById('gap-number');

  slider.addEventListener('input', () => {
    gb.style.height = slider.value + 'px';
    number.value = slider.value;
  });
  number.addEventListener('input', () => {
    const v = Math.min(400, Math.max(0, parseInt(number.value) || 0));
    gb.style.height = v + 'px';
    slider.value = v;
  });
}

function showCardProperties(block) {
  const bgColor = block.dataset.bgColor || '#f5f5f5';
  const radius  = parseInt(block.dataset.radius) || 12;

  propPanel.innerHTML = `
    <div class="prop-section">
      <div class="prop-block-label">
        <div class="prop-block-icon">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#888" stroke-width="1.3">
            <rect x="1" y="1" width="10" height="10" rx="2"/>
            <line x1="1" y1="6" x2="11" y2="6"/>
          </svg>
        </div>
        <span class="prop-block-name">Card Block</span>
        ${block.id ? `<span class="prop-block-id" title="클릭하여 복사" onclick="navigator.clipboard.writeText('${block.id}')">${block.id}</span>` : ''}
      </div>
      <div class="prop-section-title">이미지</div>
      <div class="prop-row">
        <button class="prop-btn-full" onclick="triggerCardImageUpload(document.getElementById('${block.id}'))">이미지 업로드</button>
      </div>
      ${block.classList.contains('has-image') ? `
      <div class="prop-row">
        <button class="prop-btn-full prop-btn-danger" onclick="clearCardImage(document.getElementById('${block.id}'))">이미지 제거</button>
      </div>` : ''}
    </div>
    <div class="prop-section">
      <div class="prop-section-title">하단 영역</div>
      <div class="prop-color-row">
        <span class="prop-label">배경색</span>
        <div class="prop-color-swatch" style="background:${bgColor}">
          <input type="color" id="card-bg-color" value="${bgColor}">
        </div>
        <input type="text" class="prop-color-hex" id="card-bg-hex" value="${bgColor}" maxlength="7">
      </div>
      <div class="prop-row">
        <span class="prop-label">모서리</span>
        <input type="range" class="prop-slider" id="card-radius-slider" min="0" max="40" step="1" value="${radius}">
        <input type="number" class="prop-number" id="card-radius-number" min="0" max="40" value="${radius}">
      </div>
    </div>`;

  // 배경색
  const bgInput = document.getElementById('card-bg-color');
  const bgHex   = document.getElementById('card-bg-hex');
  const body    = block.querySelector('.cdb-body');

  function applyBg(val) {
    block.dataset.bgColor = val;
    body.style.background = val;
    body.style.borderRadius = `0 0 ${block.dataset.radius || 12}px ${block.dataset.radius || 12}px`;
  }
  bgInput.addEventListener('input', () => { bgHex.value = bgInput.value; applyBg(bgInput.value); });
  bgHex.addEventListener('change', () => {
    const v = bgHex.value.trim();
    if (/^#[0-9a-fA-F]{6}$/.test(v)) { bgInput.value = v; applyBg(v); }
  });

  // 모서리
  const rSlider = document.getElementById('card-radius-slider');
  const rNumber = document.getElementById('card-radius-number');

  function applyRadius(val) {
    block.dataset.radius = val;
    block.style.borderRadius = val + 'px';
    body.style.borderRadius = `0 0 ${val}px ${val}px`;
  }
  rSlider.addEventListener('input', () => { rNumber.value = rSlider.value; applyRadius(rSlider.value); });
  rNumber.addEventListener('input', () => {
    const v = Math.min(40, Math.max(0, parseInt(rNumber.value) || 0));
    rSlider.value = v; applyRadius(v);
  });
}

function showStripBannerProperties(block) {
  const bgColor = block.dataset.bgColor || '#f5f5f5';
  const radius  = parseInt(block.dataset.radius) || 12;

  propPanel.innerHTML = `
    <div class="prop-section">
      <div class="prop-block-label">
        <div class="prop-block-icon">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#888" stroke-width="1.3">
            <rect x="1" y="2" width="10" height="8" rx="1.5"/>
            <line x1="4" y1="2" x2="4" y2="10"/>
          </svg>
        </div>
        <span class="prop-block-name">Strip Banner</span>
        ${block.id ? `<span class="prop-block-id" title="클릭하여 복사" onclick="navigator.clipboard.writeText('${block.id}')">${block.id}</span>` : ''}
      </div>
      <div class="prop-section-title">이미지</div>
      <div class="prop-row">
        <button class="prop-btn-full" onclick="triggerStripBannerImageUpload(document.getElementById('${block.id}'))">이미지 업로드</button>
      </div>
      ${block.classList.contains('has-image') ? `
      <div class="prop-row">
        <button class="prop-btn-full prop-btn-danger" onclick="clearStripBannerImage(document.getElementById('${block.id}'))">이미지 제거</button>
      </div>` : ''}
    </div>
    <div class="prop-section">
      <div class="prop-section-title">텍스트 영역</div>
      <div class="prop-color-row">
        <span class="prop-label">배경색</span>
        <div class="prop-color-swatch" style="background:${bgColor}">
          <input type="color" id="sbb-bg-color" value="${bgColor}">
        </div>
        <input type="text" class="prop-color-hex" id="sbb-bg-hex" value="${bgColor}" maxlength="7">
      </div>
      <div class="prop-row">
        <span class="prop-label">모서리</span>
        <input type="range" class="prop-slider" id="sbb-radius-slider" min="0" max="40" step="1" value="${radius}">
        <input type="number" class="prop-number" id="sbb-radius-number" min="0" max="40" value="${radius}">
      </div>
    </div>`;

  const bgInput  = document.getElementById('sbb-bg-color');
  const bgHex    = document.getElementById('sbb-bg-hex');
  const content  = block.querySelector('.sbb-content');

  function applyBg(val) {
    block.dataset.bgColor = val;
    content.style.background = val;
  }
  bgInput.addEventListener('input', () => { bgHex.value = bgInput.value; applyBg(bgInput.value); });
  bgHex.addEventListener('change', () => {
    const v = bgHex.value.trim();
    if (/^#[0-9a-fA-F]{6}$/.test(v)) { bgInput.value = v; applyBg(v); }
  });

  const rSlider = document.getElementById('sbb-radius-slider');
  const rNumber = document.getElementById('sbb-radius-number');

  function applyRadius(val) {
    block.dataset.radius = val;
    block.style.borderRadius = val + 'px';
  }
  rSlider.addEventListener('input', () => { rNumber.value = rSlider.value; applyRadius(rSlider.value); });
  rNumber.addEventListener('input', () => {
    const v = Math.min(40, Math.max(0, parseInt(rNumber.value) || 0));
    rSlider.value = v; applyRadius(v);
  });
}

function showGraphProperties(block) {
  const chartType = block.dataset.chartType || 'bar-v';
  const preset    = block.dataset.preset    || 'default';
  const items     = JSON.parse(block.dataset.items || '[]');

  const presets = [
    { id: 'default',  label: '기본' },
    { id: 'dark',     label: '다크' },
    { id: 'minimal',  label: '미니멀' },
    { id: 'colorful', label: '컬러풀' },
  ];

  propPanel.innerHTML = `
    <div class="prop-section">
      <div class="prop-block-label">
        <div class="prop-block-icon">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#888" stroke-width="1.3">
            <rect x="1" y="5" width="2" height="6" rx="0.5"/>
            <rect x="5" y="2" width="2" height="9" rx="0.5"/>
            <rect x="9" y="4" width="2" height="7" rx="0.5"/>
          </svg>
        </div>
        <span class="prop-block-name">Graph Block</span>
        ${block.id ? `<span class="prop-block-id" title="클릭하여 복사" onclick="navigator.clipboard.writeText('${block.id}')">${block.id}</span>` : ''}
      </div>
      <div class="prop-section-title">차트 타입</div>
      <div class="prop-type-group">
        <button class="prop-type-btn ${chartType === 'bar-v' ? 'active' : ''}" id="grb-type-v">세로 막대</button>
        <button class="prop-type-btn ${chartType === 'bar-h' ? 'active' : ''}" id="grb-type-h">가로 막대</button>
      </div>
    </div>
    <div class="prop-section">
      <div class="prop-section-title">프리셋</div>
      <div class="prop-preset-group">
        ${presets.map(p => `
          <button class="prop-preset-btn ${preset === p.id ? 'active' : ''}" data-preset-id="${p.id}" id="grb-preset-${p.id}">
            ${p.label}
          </button>`).join('')}
      </div>
    </div>
    <div class="prop-section">
      <div class="prop-section-title">데이터</div>
      <div class="grb-data-list" id="grb-data-list">
        ${items.map((item, i) => `
          <div class="grb-data-item" data-index="${i}">
            <input type="text" class="grb-data-label-input" value="${item.label}" placeholder="라벨">
            <input type="number" class="grb-data-val-input" value="${item.value}" min="0" max="9999">
            <button class="grb-data-del-btn" data-index="${i}">✕</button>
          </div>`).join('')}
      </div>
      <button class="prop-btn-full" id="grb-add-item">+ 항목 추가</button>
    </div>`;

  // 타입 토글
  document.getElementById('grb-type-v').addEventListener('click', () => {
    block.dataset.chartType = 'bar-v';
    renderGraph(block);
    showGraphProperties(block);
  });
  document.getElementById('grb-type-h').addEventListener('click', () => {
    block.dataset.chartType = 'bar-h';
    renderGraph(block);
    showGraphProperties(block);
  });

  // 프리셋
  presets.forEach(p => {
    document.getElementById('grb-preset-' + p.id).addEventListener('click', () => {
      block.dataset.preset = p.id;
      showGraphProperties(block);
    });
  });

  // 데이터 편집
  function syncItems() {
    const list = document.getElementById('grb-data-list');
    if (!list) return;
    const newItems = [...list.querySelectorAll('.grb-data-item')].map(row => ({
      label: row.querySelector('.grb-data-label-input').value || '',
      value: parseFloat(row.querySelector('.grb-data-val-input').value) || 0,
    }));
    block.dataset.items = JSON.stringify(newItems);
    renderGraph(block);
  }

  const dataList = document.getElementById('grb-data-list');
  dataList.addEventListener('input', syncItems);
  dataList.addEventListener('click', e => {
    const btn = e.target.closest('.grb-data-del-btn');
    if (!btn) return;
    const curItems = JSON.parse(block.dataset.items || '[]');
    if (curItems.length <= 1) return;
    curItems.splice(parseInt(btn.dataset.index), 1);
    block.dataset.items = JSON.stringify(curItems);
    renderGraph(block);
    showGraphProperties(block);
  });

  document.getElementById('grb-add-item').addEventListener('click', () => {
    const curItems = JSON.parse(block.dataset.items || '[]');
    curItems.push({ label: '항목 ' + (curItems.length + 1), value: 50 });
    block.dataset.items = JSON.stringify(curItems);
    renderGraph(block);
    showGraphProperties(block);
  });
}
