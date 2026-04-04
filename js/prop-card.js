import { propPanel, state } from './globals.js';

export function showCardProperties(block) {
  const bgColor    = block.dataset.bgColor    || '#f5f5f5';
  const radius     = parseInt(block.dataset.radius)     || 12;
  const titleSize  = parseInt(block.dataset.titleSize)  || 24;
  const descSize   = parseInt(block.dataset.descSize)   || 18;

  propPanel.innerHTML = `
    <div class="prop-section">
      <div class="prop-block-label">
        <div class="prop-block-icon">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#888" stroke-width="1.3">
            <rect x="1" y="1" width="10" height="10" rx="2"/>
            <line x1="1" y1="6" x2="11" y2="6"/>
          </svg>
        </div>
        <div class="prop-block-info">
          <span class="prop-block-name">${block.dataset.layerName || 'Card Block'}</span>
          <span class="prop-breadcrumb">${window.getBlockBreadcrumb(block)}</span>
        </div>
        ${block.id ? `<span class="prop-block-id" title="클릭하여 복사" onclick="navigator.clipboard.writeText('${block.id}')">${block.id}</span>` : ''}
      </div>
      <div class="prop-section-title">이미지</div>
      <div class="prop-row">
        <button class="prop-btn-full" onclick="window.triggerCardImageUpload(document.getElementById('${block.id}'))">이미지 업로드</button>
      </div>
      ${block.classList.contains('has-image') ? `
      <div class="prop-row">
        <button class="prop-btn-full prop-btn-danger" onclick="window.clearCardImage(document.getElementById('${block.id}'))">이미지 제거</button>
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
    </div>
    <div class="prop-section">
      <div class="prop-section-title">텍스트 크기</div>
      <div class="prop-row">
        <span class="prop-label">제목</span>
        <input type="range" class="prop-slider" id="card-title-slider" min="12" max="60" step="1" value="${titleSize}">
        <input type="number" class="prop-number" id="card-title-number" min="12" max="60" value="${titleSize}">
      </div>
      <div class="prop-row">
        <span class="prop-label">설명</span>
        <input type="range" class="prop-slider" id="card-desc-slider" min="10" max="40" step="1" value="${descSize}">
        <input type="number" class="prop-number" id="card-desc-number" min="10" max="40" value="${descSize}">
      </div>
    </div>
    <div class="prop-section">
      <div class="prop-section-title">텍스트 정렬</div>
      <div class="prop-row">
        <div class="prop-align-group" id="card-align-group">
          <button class="prop-align-btn${(block.dataset.textAlign||'left')==='left'?' active':''}"   data-align="left">←</button>
          <button class="prop-align-btn${(block.dataset.textAlign||'left')==='center'?' active':''}" data-align="center">↔</button>
          <button class="prop-align-btn${(block.dataset.textAlign||'left')==='right'?' active':''}"  data-align="right">→</button>
        </div>
      </div>
    </div>
    <div class="prop-section">
      <div class="prop-section-title">카드 수</div>
      <div class="prop-row">
        <button class="prop-action-btn primary" id="card-add-btn">+ 카드 추가</button>
        <button class="prop-action-btn danger" id="card-remove-btn">− 마지막 카드 제거</button>
      </div>
    </div>`;

  if (window.setRpIdBadge) window.setRpIdBadge(block.id || null);

  // 배경색
  const bgInput = document.getElementById('card-bg-color');
  const bgHex   = document.getElementById('card-bg-hex');
  const body    = block.querySelector('.cdb-body');

  function applyBg(val) {
    block.dataset.bgColor = val;
    body.style.background = val;
    body.style.borderRadius = `0 0 ${block.dataset.radius || 12}px ${block.dataset.radius || 12}px`;
  }
  bgInput.addEventListener('mousedown', () => { window.pushHistory?.(); });
  bgInput.addEventListener('input', () => { bgHex.value = bgInput.value; applyBg(bgInput.value); });
  bgHex.addEventListener('change', () => {
    window.pushHistory?.();
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
  rSlider.addEventListener('mousedown', () => { window.pushHistory?.(); });
  rSlider.addEventListener('input', () => { rNumber.value = rSlider.value; applyRadius(rSlider.value); });
  rNumber.addEventListener('change', () => { window.pushHistory?.(); });
  rNumber.addEventListener('input', () => {
    const v = Math.min(40, Math.max(0, parseInt(rNumber.value) || 0));
    rSlider.value = v; applyRadius(v);
  });

  // 텍스트 정렬
  const applyCardAlign = a => {
    block.dataset.textAlign = a;
    const titleEl2 = block.querySelector('.cdb-title');
    const descEl2  = block.querySelector('.cdb-desc');
    if (titleEl2) titleEl2.style.textAlign = a;
    if (descEl2)  descEl2.style.textAlign  = a;
    document.querySelectorAll('#card-align-group .prop-align-btn').forEach(b => b.classList.toggle('active', b.dataset.align === a));
    window.pushHistory();
  };
  document.querySelectorAll('#card-align-group .prop-align-btn').forEach(btn => {
    btn.addEventListener('click', () => applyCardAlign(btn.dataset.align));
  });

  // 카드 추가 / 제거
  document.getElementById('card-add-btn').addEventListener('click', () => {
    const row = block.closest('.row');
    if (!row) return;
    window.pushHistory();
    // flex 레이아웃으로 전환 (stack이면)
    if (row.dataset.layout === 'stack') {
      row.dataset.layout = 'flex';
      row.style.display = '';
      row.style.gridTemplateColumns = '';
      [...row.querySelectorAll(':scope > .col')].forEach(col => {
        col.style.flex = col.dataset.flex || '1';
        col.dataset.flex = '1';
      });
    }
    // 새 col + card 생성
    const newCol = document.createElement('div');
    newCol.className = 'col'; newCol.style.flex = '1'; newCol.dataset.flex = '1';
    const cdb = document.createElement('div');
    cdb.className = 'card-block'; cdb.dataset.type = 'card';
    cdb.id = window.genId('cdb');
    cdb.dataset.bgColor = block.dataset.bgColor || '#f5f5f5';
    cdb.dataset.radius  = block.dataset.radius  || '12';
    const r = cdb.dataset.radius;
    const bg = cdb.dataset.bgColor;
    cdb.innerHTML = `
      <div class="cdb-image"><span class="cdb-img-placeholder">+</span></div>
      <div class="cdb-body" style="background:${bg}; border-radius:0 0 ${r}px ${r}px;">
        <div class="cdb-title" contenteditable="false">카드 제목</div>
        <div class="cdb-desc" contenteditable="false">설명 텍스트를 입력하세요</div>
      </div>`;
    newCol.appendChild(cdb);
    row.appendChild(newCol);
    window.bindBlock(cdb);
    // 모든 col flex 균등 분배
    const count = row.querySelectorAll(':scope > .col').length;
    row.dataset.ratioStr = `${count}*1`;
    window.buildLayerPanel();
    showCardProperties(block);
  });

  document.getElementById('card-remove-btn').addEventListener('click', () => {
    const row = block.closest('.row');
    if (!row) return;
    const cols = [...row.querySelectorAll(':scope > .col')];
    if (cols.length <= 1) { window.showToast('⚠️ 마지막 카드는 제거할 수 없어요.'); return; }
    window.pushHistory();
    const myCol = block.closest('.col');
    if (myCol) myCol.remove();
    const remaining = row.querySelectorAll(':scope > .col').length;
    row.dataset.ratioStr = `${remaining}*1`;
    if (remaining === 1) {
      row.dataset.layout = 'stack';
      row.style.display = '';
      const lastCol = row.querySelector(':scope > .col');
      if (lastCol) { lastCol.style.flex = ''; delete lastCol.dataset.flex; }
    }
    window.buildLayerPanel();
    window.deselectAll();
    window.showPageProperties();
  });

  // 제목 크기
  const titleEl  = block.querySelector('.cdb-title');
  const tSlider  = document.getElementById('card-title-slider');
  const tNumber  = document.getElementById('card-title-number');
  const applyTitleSize = v => {
    v = Math.min(60, Math.max(12, v));
    block.dataset.titleSize  = v;
    if (titleEl) titleEl.style.fontSize = v + 'px';
    tSlider.value = v; tNumber.value = v;
  };
  tSlider.addEventListener('input',  () => applyTitleSize(parseInt(tSlider.value)));
  tNumber.addEventListener('change', () => { applyTitleSize(parseInt(tNumber.value)); window.pushHistory(); });
  tSlider.addEventListener('change', () => window.pushHistory());

  // 설명 크기
  const descEl   = block.querySelector('.cdb-desc');
  const dSlider  = document.getElementById('card-desc-slider');
  const dNumber  = document.getElementById('card-desc-number');
  const applyDescSize = v => {
    v = Math.min(40, Math.max(10, v));
    block.dataset.descSize   = v;
    if (descEl) descEl.style.fontSize = v + 'px';
    dSlider.value = v; dNumber.value = v;
  };
  dSlider.addEventListener('input',  () => applyDescSize(parseInt(dSlider.value)));
  dNumber.addEventListener('change', () => { applyDescSize(parseInt(dNumber.value)); window.pushHistory(); });
  dSlider.addEventListener('change', () => window.pushHistory());
}

/* 타입별 프리셋 폰트 사이즈 (strip banner 스케일) */
const SBB_TITLE_TYPES = { h1: { size: 48, weight: 700 }, h2: { size: 36, weight: 700 }, h3: { size: 28, weight: 600 }, body: { size: 22, weight: 400 } };
const SBB_BODY_TYPES  = { body: { size: 18, weight: 400 }, caption: { size: 14, weight: 400 } };


window.showCardProperties = showCardProperties;
