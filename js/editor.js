/* ═══════════════════════════════════
   PANEL TABS
═══════════════════════════════════ */
function toggleAllSections() {
  const sections = document.querySelectorAll('#layer-panel-body .layer-section');
  const anyOpen = [...sections].some(s => !s.classList.contains('collapsed'));
  sections.forEach(s => s.classList.toggle('collapsed', anyOpen));
}

function switchToTab(tabName) {
  document.querySelectorAll('.panel-tab').forEach(t =>
    t.classList.toggle('active', t.dataset.tab === tabName));
  const filePanel = document.getElementById('file-panel-body');
  if (filePanel) filePanel.style.display = tabName === 'file' ? 'flex' : 'none';
  document.getElementById('branch-panel-body').style.display    = tabName === 'branch'    ? '' : 'none';
  document.getElementById('inspector-panel-body').style.display = tabName === 'inspector' ? '' : 'none';
  const collapseBtn = document.getElementById('layer-collapse-all');
  if (collapseBtn) collapseBtn.style.display = tabName === 'file' ? '' : 'none';
  if (tabName === 'branch') renderBranchPanel();
}

function initFileTabToggle() {
  ['page-section-header', 'layers-section-header', 'templates-section-header'].forEach(id => {
    const header = document.getElementById(id);
    if (!header) return;
    header.addEventListener('click', () => {
      header.closest('.file-panel-section').classList.toggle('collapsed');
    });
  });
}

/* ═══════════════════════════════════
   TEMPLATE SYSTEM
═══════════════════════════════════ */
const TEMPLATE_KEY = 'sangpe-templates';

function loadTemplates() {
  try { return JSON.parse(localStorage.getItem(TEMPLATE_KEY)) || []; } catch { return []; }
}

function saveTemplates(arr) {
  localStorage.setItem(TEMPLATE_KEY, JSON.stringify(arr));
}

function saveAsTemplate(sec, name, category) {
  const clone = sec.cloneNode(true);
  clone.classList.remove('selected');
  clone.querySelectorAll('.selected, .editing').forEach(el => el.classList.remove('selected', 'editing'));
  clone.querySelectorAll('[contenteditable="true"]').forEach(el => el.setAttribute('contenteditable', 'false'));
  clone.querySelectorAll('.block-resize-handle, .img-corner-handle, .img-edit-hint').forEach(el => el.remove());
  const templates = loadTemplates();
  templates.unshift({
    id: 'tpl_' + Date.now(),
    name,
    category,
    createdAt: new Date().toISOString(),
    thumbnail: null,
    canvas: clone.outerHTML
  });
  saveTemplates(templates);
  renderTemplatePanel();
}

function deleteTemplate(id) {
  const templates = loadTemplates().filter(t => t.id !== id);
  saveTemplates(templates);
  renderTemplatePanel();
}

function insertTemplate(tpl) {
  const tmp = document.createElement('div');
  tmp.innerHTML = tpl.canvas;
  const sec = tmp.firstElementChild;
  if (!sec || !sec.classList.contains('section-block')) return;

  // 섹션 번호 갱신
  const secList = canvasEl.querySelectorAll('.section-block');
  const newIdx  = secList.length + 1;
  sec.dataset.section = newIdx;
  const labelEl = sec.querySelector('.section-label');
  if (labelEl) labelEl.textContent = `Section ${String(newIdx).padStart(2,'0')}`;

  // 선택 상태 초기화
  sec.classList.remove('selected');

  canvasEl.appendChild(sec);

  // 이벤트 바인딩
  if (sec.dataset.bgImg && !sec.style.backgroundImage) {
    sec.style.backgroundImage = `url(${sec.dataset.bgImg})`;
    sec.style.backgroundSize  = sec.dataset.bgSize || 'cover';
    sec.style.backgroundPosition = 'center';
    sec.style.backgroundRepeat   = 'no-repeat';
  }
  sec.addEventListener('click', e => { e.stopPropagation(); selectSection(sec); });
  bindSectionDelete(sec);
  bindSectionOrder(sec);
  bindSectionDrag(sec);
  bindSectionDropZone(sec);
  sec.querySelectorAll('.text-block, .asset-block, .gap-block').forEach(b => bindBlock(b));
  sec.querySelectorAll('.group-block').forEach(g => {
    if (!g.querySelector(':scope > .group-block-label')) {
      const lbl = document.createElement('span');
      lbl.className = 'group-block-label';
      lbl.textContent = g.dataset.name || 'Group';
      g.prepend(lbl);
    }
    bindGroupDrag(g);
  });
  sec.querySelectorAll('.col > .col-placeholder').forEach(ph => {
    const col = ph.parentElement;
    const fresh = makeColPlaceholder(col);
    col.replaceChild(fresh, ph);
  });

  applyPageSettings();
  pushHistory();
  buildLayerPanel();
  selectSection(sec, true);
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function renderTemplatePanel() {
  const body = document.getElementById('template-panel-body');
  if (!body) return;
  const templates = loadTemplates();
  if (!templates.length) {
    body.innerHTML = '<div class="tpl-empty">저장된 템플릿이 없습니다</div>';
    return;
  }
  body.innerHTML = templates.map(tpl => {
    const date = tpl.createdAt ? tpl.createdAt.slice(0, 10) : '';
    return `
      <div class="tpl-card" data-tpl-id="${escHtml(tpl.id)}">
        <div class="tpl-card-main">
          <span class="tpl-card-name">${escHtml(tpl.name)}</span>
          <span class="tpl-card-cat">${escHtml(tpl.category)}</span>
        </div>
        <div class="tpl-card-meta">${escHtml(date)}</div>
        <button class="tpl-delete-btn" data-tpl-id="${escHtml(tpl.id)}" title="삭제">
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="currentColor" stroke-width="1.8">
            <line x1="1" y1="1" x2="7" y2="7"/><line x1="7" y1="1" x2="1" y2="7"/>
          </svg>
        </button>
      </div>`;
  }).join('');

  body.querySelectorAll('.tpl-card').forEach(card => {
    card.addEventListener('click', e => {
      if (e.target.closest('.tpl-delete-btn')) return;
      const id  = card.dataset.tplId;
      const tpl = loadTemplates().find(t => t.id === id);
      if (tpl) insertTemplate(tpl);
    });
  });

  body.querySelectorAll('.tpl-delete-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      deleteTemplate(btn.dataset.tplId);
    });
  });
}

/* ═══════════════════════════════════
   BRANCH SYSTEM
═══════════════════════════════════ */
const BRANCH_KEY = 'web-editor-branches';

function loadBranchStore() {
  try { return JSON.parse(localStorage.getItem(BRANCH_KEY)) || null; } catch { return null; }
}
function saveBranchStore(store) {
  localStorage.setItem(BRANCH_KEY, JSON.stringify(store));
}
function initBranchStore() {
  let store = loadBranchStore();
  if (!store) {
    const snap = serializeProject();
    store = {
      current: 'main',
      branches: {
        main: { snapshot: snap, createdAt: Date.now(), updatedAt: Date.now() },
        dev:  { snapshot: snap, createdAt: Date.now(), updatedAt: Date.now() }
      }
    };
    saveBranchStore(store);
  }
  updateBranchIndicator(store.current);
  return store;
}

function updateBranchIndicator(name) {
  const el = document.getElementById('branch-name');
  if (el) el.textContent = name;
  renderBranchDropdown();
}

function toggleBranchDropdown(e) {
  e.stopPropagation();
  const wrap = document.getElementById('branch-dropdown-wrap');
  const isOpen = wrap.classList.toggle('open');
  if (isOpen) renderBranchDropdown();
}

function renderBranchDropdown() {
  const menu = document.getElementById('branch-dropdown-menu');
  if (!menu) return;
  const store = loadBranchStore();
  if (!store) return;
  const order = ['main', 'dev', ...Object.keys(store.branches).filter(n => n !== 'main' && n !== 'dev')];
  const sorted = [...new Set(order.filter(n => store.branches[n]))];

  menu.innerHTML = sorted.map(name => {
    const isCurrent = name === store.current;
    return `<div class="branch-dd-item ${isCurrent ? 'current' : ''}" onclick="selectBranchFromDropdown('${name}')">
      <span class="branch-dd-item-dot"></span>
      <span>${name}</span>
      ${isCurrent ? '<span style="margin-left:auto;font-size:9px;color:#2d6fe8;font-weight:700;">NOW</span>' : ''}
    </div>`;
  }).join('') + `
  <div class="branch-dd-divider"></div>
  <div class="branch-dd-manage" onclick="switchToTab('branch');closeBranchDropdown()">
    <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.4">
      <circle cx="3" cy="2.5" r="1.5"/><circle cx="3" cy="9.5" r="1.5"/><circle cx="9" cy="5" r="1.5"/>
      <path d="M3 4v4M3 4C3 6 9 4 9 5"/>
    </svg>
    브랜치 관리 →
  </div>`;
}

function selectBranchFromDropdown(name) {
  closeBranchDropdown();
  switchBranch(name);
}

function closeBranchDropdown() {
  document.getElementById('branch-dropdown-wrap')?.classList.remove('open');
}

function getCurrentBranch() {
  const store = loadBranchStore();
  return store ? store.current : 'main';
}

function saveCurrentBranchSnapshot() {
  const store = loadBranchStore();
  if (!store) return;
  store.branches[store.current].snapshot = serializeProject();
  store.branches[store.current].updatedAt = Date.now();
  saveBranchStore(store);
}

function switchBranch(name) {
  const store = loadBranchStore();
  if (!store || !store.branches[name] || store.current === name) return;
  // 현재 브랜치 스냅샷 저장
  store.branches[store.current].snapshot = serializeProject();
  store.branches[store.current].updatedAt = Date.now();
  // 대상 브랜치 로드
  store.current = name;
  saveBranchStore(store);
  const data = JSON.parse(store.branches[name].snapshot);
  applyProjectData(data);
  updateBranchIndicator(name);
  renderBranchPanel();
}

function createBranch(name) {
  name = name.trim();
  if (!name) return;
  const store = loadBranchStore();
  if (!store) return;
  if (store.branches[name]) { alert(`'${name}' 브랜치가 이미 존재합니다.`); return; }
  store.branches[name] = {
    snapshot: serializeProject(),
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  saveBranchStore(store);
  renderBranchPanel();
}

function deleteBranch(name) {
  const store = loadBranchStore();
  if (!store) return;
  if (name === 'main') { alert('main 브랜치는 삭제할 수 없습니다.'); return; }
  if (store.current === name) { alert('현재 작업 중인 브랜치는 삭제할 수 없습니다.'); return; }
  if (!confirm(`'${name}' 브랜치를 삭제할까요?`)) return;
  delete store.branches[name];
  saveBranchStore(store);
  renderBranchPanel();
}

function mergeBranch(fromName) {
  const store = loadBranchStore();
  if (!store) return;
  const toName = store.current;
  if (fromName === toName) return;
  if (!confirm(`'${fromName}' → '${toName}' 으로 병합할까요?\n현재 브랜치의 내용이 대체됩니다.`)) return;
  store.branches[toName].snapshot = store.branches[fromName].snapshot;
  store.branches[toName].updatedAt = Date.now();
  store.current = toName;
  saveBranchStore(store);
  const data = JSON.parse(store.branches[toName].snapshot);
  applyProjectData(data);
  updateBranchIndicator(toName);
  renderBranchPanel();
}

function renderBranchPanel() {
  const panel = document.getElementById('branch-panel-body');
  if (!panel) return;
  const store = loadBranchStore();
  if (!store) return;
  const branchNames = Object.keys(store.branches);
  const order = ['main', 'dev', ...branchNames.filter(n => n !== 'main' && n !== 'dev')];
  const sorted = [...new Set(order.filter(n => store.branches[n]))];

  panel.innerHTML = `
    <div class="branch-section-title">브랜치</div>
    <div class="branch-list">
      ${sorted.map(name => {
        const isCurrent = name === store.current;
        const ago = timeSince(store.branches[name].updatedAt);
        return `
        <div class="branch-item ${isCurrent ? 'current' : ''}" data-branch="${name}">
          <svg class="branch-item-icon" width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.4">
            <circle cx="3" cy="2.5" r="1.5"/><circle cx="3" cy="9.5" r="1.5"/><circle cx="9" cy="5" r="1.5"/>
            <path d="M3 4v4M3 4C3 6 9 4 9 5"/>
          </svg>
          <span class="branch-item-name">${name}</span>
          ${isCurrent ? '<span class="branch-item-badge">현재</span>' : ''}
          <div class="branch-item-actions">
            ${!isCurrent ? `<button class="branch-action-btn" onclick="switchBranch('${name}')">전환</button>` : ''}
            ${!isCurrent ? `<button class="branch-action-btn merge" onclick="mergeBranch('${name}')">병합</button>` : ''}
            ${name !== 'main' && name !== 'dev' ? `<button class="branch-action-btn danger" onclick="deleteBranch('${name}')">✕</button>` : ''}
          </div>
        </div>`;
      }).join('')}
    </div>
    <div class="branch-divider"></div>
    <div class="branch-section-title">새 브랜치</div>
    <div class="branch-new-form">
      <input class="branch-new-input" id="branch-new-input" placeholder="feature/이름" type="text">
      <button class="branch-new-btn" onclick="createBranchFromInput()">만들기</button>
    </div>`;

  const input = document.getElementById('branch-new-input');
  if (input) input.addEventListener('keydown', e => { if (e.key === 'Enter') createBranchFromInput(); });
}

function createBranchFromInput() {
  const input = document.getElementById('branch-new-input');
  if (!input) return;
  createBranch(input.value);
  input.value = '';
}

function timeSince(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return '방금';
  if (s < 3600) return Math.floor(s/60) + '분 전';
  if (s < 86400) return Math.floor(s/3600) + '시간 전';
  return Math.floor(s/86400) + '일 전';
}

/* ═══════════════════════════════════
   ZOOM
═══════════════════════════════════ */
const CANVAS_W = 860;
let currentZoom = 40;
const scaler = document.getElementById('canvas-scaler');
const zoomDisplay = document.getElementById('zoom-display');

function applyZoom(z) {
  currentZoom = Math.min(150, Math.max(25, z));
  scaler.style.transform = `scale(${currentZoom / 100})`;
  zoomDisplay.textContent = currentZoom + '%';
  document.documentElement.style.setProperty('--inv-zoom', (100 / currentZoom).toFixed(4));
}
function zoomStep(delta) { applyZoom(currentZoom + delta); }
function zoomFit() {
  const wrap = document.getElementById('canvas-wrap');
  applyZoom(Math.floor(((wrap.clientWidth - 80) / CANVAS_W) * 100));
}

/* ══════════════════════════════════════
   Undo / Redo
══════════════════════════════════════ */
const MAX_HISTORY = 50;
let historyStack = [];
let historyPos   = -1;
let _historyPaused = false;

function pushHistory() {
  if (_historyPaused) return;
  historyStack = historyStack.slice(0, historyPos + 1);
  historyStack.push({ canvas: getSerializedCanvas(), settings: { ...pageSettings } });
  if (historyStack.length > MAX_HISTORY) historyStack.shift();
  else historyPos++;
}

function restoreSnapshot(snap) {
  _historyPaused = true;
  Object.assign(pageSettings, snap.settings);
  canvasEl.innerHTML = snap.canvas;
  rebindAll();
  applyPageSettings();
  buildLayerPanel();
  deselectAll();
  _historyPaused = false;
}

function undo() {
  if (historyPos <= 0) return;
  historyPos--;
  restoreSnapshot(historyStack[historyPos]);
}
function redo() {
  if (historyPos >= historyStack.length - 1) return;
  historyPos++;
  restoreSnapshot(historyStack[historyPos]);
}

/* ══════════════════════════════════════
   복사 / 붙여넣기
══════════════════════════════════════ */
let clipboard = null;

function copySelected() {
  const selBlock   = document.querySelector('.text-block.selected, .asset-block.selected, .gap-block.selected, .icon-circle-block.selected, .table-block.selected');
  const selSection = document.querySelector('.section-block.selected');
  if (selBlock) {
    const isGapSel = selBlock.classList.contains('gap-block');
    const target = isGapSel ? selBlock : (selBlock.closest('.row') || selBlock);
    clipboard = { type: 'block', html: target.outerHTML };
  } else if (selSection) {
    clipboard = { type: 'section', html: selSection.outerHTML };
  }
}

function pasteClipboard() {
  if (!clipboard) return;
  pushHistory();
  const temp = document.createElement('div');
  temp.innerHTML = clipboard.html;
  const el = temp.firstElementChild;

  if (clipboard.type === 'section') {
    canvasEl.appendChild(el);
    bindSectionDelete(el);
    bindSectionOrder(el);
    bindSectionDrag(el);
    bindSectionDropZone(el);
    el.querySelectorAll('.text-block, .asset-block, .gap-block, .icon-circle-block, .table-block').forEach(b => bindBlock(b));
    el.querySelectorAll('.col > .col-placeholder').forEach(ph => {
      const col = ph.parentElement;
      col.replaceChild(makeColPlaceholder(col), ph);
    });
    el.addEventListener('click', e2 => { e2.stopPropagation(); selectSection(el); });
  } else {
    const sec = getSelectedSection() || document.querySelector('.section-block:last-child');
    if (!sec) return;
    insertAfterSelected(sec, el);
    el.querySelectorAll('.text-block, .asset-block, .gap-block, .icon-circle-block, .table-block').forEach(b => bindBlock(b));
    el.querySelectorAll('.col > .col-placeholder').forEach(ph => {
      const col = ph.parentElement;
      col.replaceChild(makeColPlaceholder(col), ph);
    });
  }
  buildLayerPanel();
}

document.addEventListener('keydown', e => {
  if (e.metaKey || e.ctrlKey) {
    if (e.key === '=' || e.key === '+') { e.preventDefault(); zoomStep(10); }
    if (e.key === '-')                  { e.preventDefault(); zoomStep(-10); }
    if (e.key === '0')                  { e.preventDefault(); applyZoom(100); }
    if (e.key === 'z' && !e.shiftKey)   { e.preventDefault(); undo(); return; }
    if (e.key === 'z' && e.shiftKey)    { e.preventDefault(); redo(); return; }
    if (e.key === 'c') {
      if (document.querySelector('.text-block.editing')) return;
      if (e.target.tagName === 'INPUT' || e.target.isContentEditable) return;
      copySelected();
      return;
    }
    if (e.key === 'v') {
      if (document.querySelector('.text-block.editing')) return;
      if (e.target.tagName === 'INPUT' || e.target.isContentEditable) return;
      pasteClipboard();
      return;
    }
  }
  if (e.key === 'Escape') deselectAll();

  const isDelete = e.key === 'Delete' || (e.key === 'Backspace' && (e.metaKey || e.ctrlKey));
  if (isDelete) {
    // 텍스트 편집 중이거나 input에 포커스가 있으면 기본 동작 유지
    if (document.querySelector('.text-block.editing')) return;
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;

    // 이미지 편집 모드 중이면 이미지 삭제
    const imgEditBlock = document.querySelector('.asset-block.img-editing');
    if (imgEditBlock) {
      e.preventDefault();
      clearAssetImage(imgEditBlock);
      return;
    }

    const selText    = document.querySelector('.text-block.selected');
    const selAsset   = document.querySelector('.asset-block.selected');
    const selGap     = document.querySelector('.gap-block.selected');
    const selSection = document.querySelector('.section-block.selected');

    const allSelBlocks = [...document.querySelectorAll('.text-block.selected, .asset-block.selected, .gap-block.selected, .icon-circle-block.selected, .table-block.selected')];
    if (allSelBlocks.length > 0) {
      e.preventDefault();
      pushHistory();
      const rowsToRemove = new Set();
      allSelBlocks.forEach(block => {
        if (block.classList.contains('gap-block')) {
          block.remove();
        } else {
          const row = block.closest('.row');
          if (row) rowsToRemove.add(row); else block.remove();
        }
      });
      rowsToRemove.forEach(r => r.remove());
      deselectAll();
      buildLayerPanel();
    } else if (selSection) {
      e.preventDefault();
      pushHistory();
      selSection.remove();
      deselectAll();
      buildLayerPanel();
    }
  }
});

applyZoom(40);

/* ═══════════════════════════════════
   LAYER PANEL
═══════════════════════════════════ */
const layerIcons = {
  section: `<svg class="layer-section-icon" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="1" y="1" width="12" height="12" rx="1.5"/></svg>`,
  heading: `<svg class="layer-item-icon" viewBox="0 0 12 12" fill="currentColor"><text x="0" y="10" font-size="10" font-weight="700" font-family="serif">H</text></svg>`,
  body:    `<svg class="layer-item-icon" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.3"><line x1="1" y1="3" x2="11" y2="3"/><line x1="1" y1="6" x2="11" y2="6"/><line x1="1" y1="9" x2="7" y2="9"/></svg>`,
  caption: `<svg class="layer-item-icon" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.3"><line x1="1" y1="4" x2="11" y2="4"/><line x1="1" y1="7" x2="8" y2="7"/></svg>`,
  asset:   `<svg class="layer-item-icon" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="1" y="1" width="10" height="10" rx="1"/><circle cx="4" cy="4" r="1"/><polyline points="11 8 8 5 3 11"/></svg>`,
  gap:     `<svg class="layer-item-icon" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.3"><line x1="1" y1="4" x2="11" y2="4" stroke-dasharray="2,1"/><line x1="1" y1="8" x2="11" y2="8" stroke-dasharray="2,1"/></svg>`,
  label:      `<svg class="layer-item-icon" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="1" y="3" width="10" height="6" rx="1.5"/></svg>`,
  'icon-circle': `<svg class="layer-item-icon" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.3"><circle cx="6" cy="6" r="5"/><text x="3.5" y="9" font-size="6" fill="currentColor" stroke="none">★</text></svg>`,
  table:      `<svg class="layer-item-icon" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="1" y="1" width="10" height="10" rx="1"/><line x1="1" y1="4.5" x2="11" y2="4.5"/><line x1="5" y1="4.5" x2="5" y2="11"/></svg>`,
};

/* 레이어 아이템 생성 (단일 블록용) */
function makeLayerBlockItem(block, dragTarget, sec) {
  const isText   = block.classList.contains('text-block');
  const isGap    = block.classList.contains('gap-block');
  const isIconCb = block.classList.contains('icon-circle-block');
  const isTable  = block.classList.contains('table-block');
  const type     = isText ? (block.dataset.type || 'body') : isGap ? 'gap' : isIconCb ? 'icon-circle' : isTable ? 'table' : 'asset';
  const labels    = { heading:'Heading', body:'Body', caption:'Caption', label:'Label', asset:'Asset', gap:'Gap', 'icon-circle':'Icon Circle', table:'Table' };
  const typeLbls  = { heading:'Text',    body:'Text',  caption:'Text',   label:'Label', asset:'Image', gap:'Gap', 'icon-circle':'Component', table:'Component' };

  const item = document.createElement('div');
  item.className = 'layer-item';
  item.innerHTML = `${layerIcons[type] || layerIcons.body}<span class="layer-item-name">${labels[type] || type}</span><span class="layer-item-type">${typeLbls[type] || 'Text'}</span>`;
  item._dragTarget = dragTarget;

  item.addEventListener('click', e => {
    e.stopPropagation();
    if (e.shiftKey) {
      // Shift+클릭: 다중선택 토글
      if (block.classList.contains('selected')) {
        block.classList.remove('selected');
        item.classList.remove('active');
      } else {
        block.classList.add('selected');
        item.classList.add('active');
      }
      syncSection(sec);
    } else {
      deselectAll();
      block.classList.add('selected');
      syncSection(sec);
      highlightBlock(block, item);
      if (isText) showTextProperties(block);
      else if (isGap) showGapProperties(block);
      else if (isIconCb) showIconCircleProperties(block);
      else if (isTable) showTableProperties(block);
      else showAssetProperties(block);
    }
  });
  block.addEventListener('mouseenter', () => item.style.background = '#252525');
  block.addEventListener('mouseleave', () => { if (!item.classList.contains('active')) item.style.background = ''; });

  item.setAttribute('draggable', 'true');
  item.addEventListener('dragstart', e => {
    e.stopPropagation();
    layerDragSrc = item;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', '');
    requestAnimationFrame(() => item.classList.add('layer-dragging'));
  });
  item.addEventListener('dragend', () => {
    item.classList.remove('layer-dragging');
    clearLayerIndicators();
    layerDragSrc = null;
  });

  block._layerItem = item;
  return item;
}

/* 레이어 Group 아이템 생성 (group-block용) */
function makeLayerGroupItem(groupEl, sec, appendRowFn) {
  const wrapper = document.createElement('div');
  wrapper.className = 'layer-row-group';
  wrapper._dragTarget = groupEl;

  const header = document.createElement('div');
  header.className = 'layer-row-header';
  const name = groupEl.dataset.name || 'Group';
  header.innerHTML = `
    <svg class="layer-chevron" viewBox="0 0 12 12" fill="currentColor"><path d="M2 4l4 4 4-4"/></svg>
    <svg class="layer-item-icon" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.3">
      <rect x="1" y="1" width="10" height="10" rx="1.5"/>
      <line x1="3" y1="4" x2="9" y2="4"/><line x1="3" y1="6.5" x2="7" y2="6.5"/><line x1="3" y1="9" x2="8" y2="9"/>
    </svg>
    <span class="layer-item-name">${name}</span>
    <span class="layer-item-type">Group</span>
    <button class="layer-ungroup-btn" title="그룹 해제">
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.5">
        <rect x="1" y="1" width="3.5" height="3.5" rx="0.5"/>
        <rect x="5.5" y="1" width="3.5" height="3.5" rx="0.5"/>
        <rect x="1" y="5.5" width="3.5" height="3.5" rx="0.5"/>
        <rect x="5.5" y="5.5" width="3.5" height="3.5" rx="0.5"/>
      </svg>
    </button>`;

  header.addEventListener('click', e => {
    if (e.target.closest('.layer-chevron')) { wrapper.classList.toggle('collapsed'); return; }
    if (e.target.closest('.layer-ungroup-btn')) {
      ungroupBlock(groupEl);
      return;
    }
    // 그룹 선택 — 캔버스 그룹 강조 + 섹션 선택
    deselectAll();
    groupEl.classList.add('group-selected');
    const sec = groupEl.closest('.section-block');
    if (sec) selectSection(sec);
    document.querySelectorAll('.layer-row-group').forEach(g => g.classList.remove('active'));
    wrapper.classList.add('active');
  });

  const groupChildren = document.createElement('div');
  groupChildren.className = 'layer-row-children';

  const groupInner = groupEl.querySelector('.group-inner');
  if (groupInner) {
    [...groupInner.children].forEach(child => {
      if (child.classList.contains('row')) appendRowFn(child, groupChildren);
      else if (child.classList.contains('gap-block')) groupChildren.appendChild(makeLayerBlockItem(child, child, sec));
    });
  }

  wrapper.appendChild(header);
  wrapper.appendChild(groupChildren);
  return wrapper;
}

/* 레이어 Row 그룹 생성 (멀티컬럼용) */
function makeLayerRowGroup(rowEl, blocks, sec) {
  const ratioStr = rowEl.dataset.ratioStr || `${blocks.length}*1`;
  const group = document.createElement('div');
  group.className = 'layer-row-group';
  group._dragTarget = rowEl;

  const header = document.createElement('div');
  header.className = 'layer-row-header';
  header.innerHTML = `
    <svg class="layer-chevron" viewBox="0 0 12 12" fill="currentColor"><path d="M2 4l4 4 4-4"/></svg>
    <svg class="layer-item-icon" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.3">
      <rect x="1" y="1" width="4" height="10" rx="0.5"/><rect x="7" y="1" width="4" height="10" rx="0.5"/>
    </svg>
    <span class="layer-item-name">Row</span>
    <span class="layer-item-type">${ratioStr}</span>`;

  const groupChildren = document.createElement('div');
  groupChildren.className = 'layer-row-children';

  blocks.forEach(block => {
    const isText   = block.classList.contains('text-block');
    const isGap    = block.classList.contains('gap-block');
    const isIconCb = block.classList.contains('icon-circle-block');
    const isTable  = block.classList.contains('table-block');
    const type     = isText ? (block.dataset.type || 'body') : isGap ? 'gap' : isIconCb ? 'icon-circle' : isTable ? 'table' : 'asset';
    const labels    = { heading:'Heading', body:'Body', caption:'Caption', label:'Label', asset:'Asset', gap:'Gap', 'icon-circle':'Icon Circle', table:'Table' };
    const typeLbls  = { heading:'Text',    body:'Text',  caption:'Text',   label:'Label', asset:'Image', gap:'Gap', 'icon-circle':'Component', table:'Component' };

    const item = document.createElement('div');
    item.className = 'layer-item layer-item-nested';
    item.innerHTML = `${layerIcons[type]}<span class="layer-item-name">${labels[type]}</span><span class="layer-item-type">${typeLbls[type]}</span>`;

    item.addEventListener('click', e => {
      e.stopPropagation();
      if (e.shiftKey) {
        if (block.classList.contains('selected')) {
          block.classList.remove('selected');
          item.classList.remove('active');
        } else {
          block.classList.add('selected');
          item.classList.add('active');
        }
        syncSection(sec);
      } else {
        deselectAll();
        block.classList.add('selected');
        syncSection(sec);
        highlightBlock(block, item);
        if (isText) showTextProperties(block);
        else if (isGap) showGapProperties(block);
        else if (isIconCb) showIconCircleProperties(block);
        else if (isTable) showTableProperties(block);
        else showAssetProperties(block);
      }
    });
    block.addEventListener('mouseenter', () => item.style.background = '#252525');
    block.addEventListener('mouseleave', () => { if (!item.classList.contains('active')) item.style.background = ''; });

    block._layerItem = item;
    groupChildren.appendChild(item);
  });

  header.addEventListener('click', e => {
    // chevron 클릭이면 토글만
    if (e.target.closest('.layer-chevron')) { group.classList.toggle('collapsed'); return; }
    // Row 헤더 클릭 → 하위 블록 전체 선택
    deselectAll();
    blocks.forEach(block => block.classList.add('selected'));
    syncSection(sec);
    // 레이어 하위 아이템 모두 하이라이트
    groupChildren.querySelectorAll('.layer-item').forEach(it => it.classList.add('active'));
    header.classList.add('active');
  });

  // Row 그룹 드래그 (섹션 내 Row 순서 변경)
  header.setAttribute('draggable', 'true');
  header.addEventListener('dragstart', e => {
    e.stopPropagation();
    layerDragSrc = group;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', '');
    requestAnimationFrame(() => group.classList.add('layer-dragging'));
  });
  header.addEventListener('dragend', () => {
    group.classList.remove('layer-dragging');
    clearLayerIndicators();
    layerDragSrc = null;
  });

  group.appendChild(header);
  group.appendChild(groupChildren);
  return group;
}

function buildLayerPanel() {
  const panel = document.getElementById('layer-panel-body');
  panel.innerHTML = '';

  document.querySelectorAll('.section-block').forEach((sec, si) => {
    const sIdx = si + 1;
    const sectionEl = document.createElement('div');
    sectionEl.className = 'layer-section';
    sectionEl.dataset.section = sIdx;

    const header = document.createElement('div');
    header.className = 'layer-section-header';

    const chevron = document.createElement('div');
    chevron.innerHTML = `<svg class="layer-chevron" viewBox="0 0 12 12" fill="currentColor"><path d="M2 4l4 4 4-4"/></svg>${layerIcons.section}`;
    chevron.style.cssText = 'display:flex;align-items:center;gap:6px;flex-shrink:0;';

    const nameEl = document.createElement('span');
    nameEl.className = 'layer-section-name';
    nameEl.textContent = sec._name || 'Section';

    // 눈 아이콘 (섹션 숨김 토글)
    const eyeBtn = document.createElement('button');
    eyeBtn.className = 'layer-eye-btn';
    const isHidden = sec.dataset.hidden === '1';
    eyeBtn.innerHTML = isHidden
      ? `<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M1 7s2.5-4 6-4 6 4 6 4-2.5 4-6 4-6-4-6-4z"/><line x1="2" y1="2" x2="12" y2="12"/></svg>`
      : `<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M1 7s2.5-4 6-4 6 4 6 4-2.5 4-6 4-6-4-6-4z"/><circle cx="7" cy="7" r="1.8"/></svg>`;
    eyeBtn.title = isHidden ? '섹션 표시' : '섹션 숨기기';
    if (isHidden) { sec.style.visibility = 'hidden'; sec.style.opacity = '0'; sectionEl.classList.add('layer-section-hidden'); }

    header.appendChild(chevron);
    header.appendChild(nameEl);
    header.appendChild(eyeBtn);

    eyeBtn.addEventListener('click', e => {
      e.stopPropagation();
      const hidden = sec.dataset.hidden === '1';
      if (hidden) {
        sec.dataset.hidden = '0';
        sec.style.visibility = ''; sec.style.opacity = '';
        eyeBtn.innerHTML = `<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M1 7s2.5-4 6-4 6 4 6 4-2.5 4-6 4-6-4-6-4z"/><circle cx="7" cy="7" r="1.8"/></svg>`;
        eyeBtn.title = '섹션 숨기기';
        sectionEl.classList.remove('layer-section-hidden');
      } else {
        sec.dataset.hidden = '1';
        sec.style.visibility = 'hidden'; sec.style.opacity = '0';
        eyeBtn.innerHTML = `<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M1 7s2.5-4 6-4 6 4 6 4-2.5 4-6 4-6-4-6-4z"/><line x1="2" y1="2" x2="12" y2="12"/></svg>`;
        eyeBtn.title = '섹션 표시';
        sectionEl.classList.add('layer-section-hidden');
      }
    });

    chevron.addEventListener('click', () => {
      const collapsed = sectionEl.classList.toggle('collapsed');
      if (!collapsed) selectSection(sec, true);
    });
    nameEl.addEventListener('click', e => { e.stopPropagation(); selectSection(sec, true); });
    nameEl.addEventListener('dblclick', e => {
      e.stopPropagation();
      nameEl.contentEditable = 'true';
      nameEl.classList.add('editing');
      nameEl.focus();
      const range = document.createRange();
      range.selectNodeContents(nameEl);
      window.getSelection().removeAllRanges();
      window.getSelection().addRange(range);
      const finish = () => {
        nameEl.contentEditable = 'false';
        nameEl.classList.remove('editing');
        const newName = nameEl.textContent.trim() || 'Section';
        nameEl.textContent = newName;
        sec._name = newName;
        const label = sec.querySelector('.section-label');
        if (label) label.textContent = newName;
      };
      nameEl.addEventListener('blur', finish, { once: true });
      nameEl.addEventListener('keydown', ev => {
        if (ev.key === 'Enter')  { ev.preventDefault(); nameEl.blur(); }
        if (ev.key === 'Escape') { nameEl.textContent = sec._name || 'Section'; nameEl.blur(); }
      });
    });

    const children = document.createElement('div');
    children.className = 'layer-children';

    // section-inner 직접 자식 순회 (Row 단위로 처리)
    const sectionInner = sec.querySelector('.section-inner');

    function appendRowToLayer(child, container) {
      const colBlocks = [...child.querySelectorAll(':scope > .col > *')]
        .filter(el => !el.classList.contains('col-placeholder'));
      const allCols = [...child.querySelectorAll(':scope > .col')];
      const hasPlaceholderOnly = colBlocks.length === 0 && allCols.length > 0;
      if (hasPlaceholderOnly) {
        container.appendChild(makeLayerRowGroup(child, [], sec));
      } else if (colBlocks.length <= 1) {
        const block = colBlocks[0];
        if (block) container.appendChild(makeLayerBlockItem(block, child, sec));
      } else {
        container.appendChild(makeLayerRowGroup(child, colBlocks, sec));
      }
    }

    [...sectionInner.children].forEach(child => {
      if (child.classList.contains('gap-block')) {
        children.appendChild(makeLayerBlockItem(child, child, sec));
      } else if (child.classList.contains('row')) {
        appendRowToLayer(child, children);
      } else if (child.classList.contains('group-block')) {
        children.appendChild(makeLayerGroupItem(child, sec, appendRowToLayer));
      }
    });

    // 레이어 패널 드롭존 (Row/Gap 단위 재배치)
    children.addEventListener('dragover', e => {
      e.preventDefault();
      e.stopPropagation();
      if (!layerDragSrc) return;
      clearLayerIndicators();
      const after = getLayerDragAfterItem(children, e.clientY);
      const indicator = document.createElement('div');
      indicator.className = 'layer-drop-indicator';
      if (after) children.insertBefore(indicator, after);
      else children.appendChild(indicator);
    });
    children.addEventListener('dragleave', e => {
      if (!children.contains(e.relatedTarget)) clearLayerIndicators();
    });
    children.addEventListener('drop', e => {
      e.preventDefault();
      e.stopPropagation();
      if (!layerDragSrc) return;
      const dragTarget = layerDragSrc._dragTarget;
      const indicator = children.querySelector('.layer-drop-indicator');
      if (indicator) {
        const nextEl = indicator.nextElementSibling;
        const nextTarget = nextEl?._dragTarget || null;
        if (nextTarget) {
          sectionInner.insertBefore(dragTarget, nextTarget);
        } else {
          const bottomGap = [...sectionInner.querySelectorAll(':scope > .gap-block')].at(-1);
          if (bottomGap && bottomGap !== dragTarget) sectionInner.insertBefore(dragTarget, bottomGap);
          else sectionInner.appendChild(dragTarget);
        }
      }
      clearLayerIndicators();
      buildLayerPanel();
      layerDragSrc = null;
    });

    sectionEl.appendChild(header);
    sectionEl.appendChild(children);
    panel.appendChild(sectionEl);

    sec._layerEl = sectionEl;
    sec._layerHeader = header;
    sectionEl._canvasSec = sec;

    // 섹션 헤더 드래그 (섹션 순서 변경)
    header.setAttribute('draggable', 'true');
    header.addEventListener('dragstart', e => {
      if (nameEl.classList.contains('editing')) { e.preventDefault(); return; }
      e.stopPropagation();
      layerSectionDragSrc = { sec, sectionEl };
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', '');
      const ghost = document.createElement('div');
      ghost.style.cssText = 'position:fixed;top:-9999px;width:1px;height:1px;';
      document.body.appendChild(ghost);
      e.dataTransfer.setDragImage(ghost, 0, 0);
      setTimeout(() => ghost.remove(), 0);
      requestAnimationFrame(() => sectionEl.classList.add('layer-section-dragging'));
    });
    header.addEventListener('dragend', () => {
      sectionEl.classList.remove('layer-section-dragging');
      clearLayerSectionIndicators();
      layerSectionDragSrc = null;
    });
  });

  buildFilePageSection();
}

function syncLayerActive(sec) {
  document.querySelectorAll('.layer-section-header').forEach(h => h.classList.remove('active'));
  if (sec && sec._layerHeader) sec._layerHeader.classList.add('active');
}

function highlightBlock(block, layerItem) {
  document.querySelectorAll('.layer-item').forEach(i => { i.classList.remove('active'); i.style.background = ''; });
  if (layerItem) layerItem.classList.add('active');
}

/* ═══════════════════════════════════
   SELECTION
═══════════════════════════════════ */
function selectSection(sec, scrollIntoView = false) {
  deselectAll();
  sec.classList.add('selected');
  syncLayerActive(sec);
  showSectionProperties(sec);
  if (scrollIntoView) {
    const canvasWrapEl = document.getElementById('canvas-wrap');
    const scalerEl = document.getElementById('canvas-scaler');
    const scale = parseFloat(scalerEl.style.transform?.match(/scale\(([^)]+)\)/)?.[1] || 1);
    const secTop = sec.offsetTop * scale;
    canvasWrapEl.scrollTo({ top: secTop - 40, behavior: 'smooth' });
  }
}

function rgbToHex(rgb) {
  const m = rgb.match(/\d+/g);
  if (!m || m.length < 3) return '#000000';
  return '#' + m.slice(0,3).map(n => parseInt(n).toString(16).padStart(2,'0')).join('');
}

/* ── Design Presets ── */
// Electron에서는 preload를 통해 JSON 파일 로드, 브라우저 fallback은 하드코딩
const PRESET_FALLBACK = [
  {
    id: 'default', name: 'Default',
    dots: ['#111111', '#555555', '#111111'],
    variables: {
      '--preset-h1-color': '#111111', '--preset-h1-family': "'Noto Sans KR', sans-serif",
      '--preset-h2-color': '#1a1a1a', '--preset-h2-family': "'Noto Sans KR', sans-serif",
      '--preset-body-color': '#555555', '--preset-body-family': "'Noto Sans KR', sans-serif",
      '--preset-caption-color': '#999999',
      '--preset-label-bg': '#111111', '--preset-label-color': '#ffffff', '--preset-label-radius': '8px',
    },
  },
  {
    id: 'dark', name: 'Dark',
    dots: ['#ffffff', '#aaaaaa', '#2d6fe8'],
    variables: {
      '--preset-h1-color': '#ffffff', '--preset-h1-family': "'Noto Sans KR', sans-serif",
      '--preset-h2-color': '#eeeeee', '--preset-h2-family': "'Noto Sans KR', sans-serif",
      '--preset-body-color': '#aaaaaa', '--preset-body-family': "'Noto Sans KR', sans-serif",
      '--preset-caption-color': '#666666',
      '--preset-label-bg': '#2d6fe8', '--preset-label-color': '#ffffff', '--preset-label-radius': '8px',
    },
  },
  {
    id: 'brand', name: 'Brand',
    dots: ['#1a3a6b', '#444444', '#2d6fe8'],
    variables: {
      '--preset-h1-color': '#1a3a6b', '--preset-h1-family': "'Noto Serif KR', serif",
      '--preset-h2-color': '#2d4a7a', '--preset-h2-family': "'Noto Serif KR', serif",
      '--preset-body-color': '#444444', '--preset-body-family': "'Noto Sans KR', sans-serif",
      '--preset-caption-color': '#888888',
      '--preset-label-bg': '#2d6fe8', '--preset-label-color': '#ffffff', '--preset-label-radius': '8px',
    },
  },
  {
    id: 'minimal', name: 'Minimal',
    dots: ['#000000', '#666666', '#000000'],
    variables: {
      '--preset-h1-color': '#000000', '--preset-h1-family': "'Space Grotesk', sans-serif",
      '--preset-h2-color': '#222222', '--preset-h2-family': "'Space Grotesk', sans-serif",
      '--preset-body-color': '#666666', '--preset-body-family': "'Noto Sans KR', sans-serif",
      '--preset-caption-color': '#aaaaaa',
      '--preset-label-bg': '#000000', '--preset-label-color': '#ffffff', '--preset-label-radius': '0px',
    },
  },
];

let PRESETS = PRESET_FALLBACK;

// Electron 환경 감지 → body 클래스 추가 (신호등 영역 확보 등 CSS 처리)
if (window.electronAPI) {
  document.body.classList.add('electron-app');
  window.electronAPI.getFullscreen().then(isFullscreen => {
    document.body.classList.toggle('fullscreen', isFullscreen);
  });
  window.electronAPI.onFullscreenChange(isFullscreen => {
    document.body.classList.toggle('fullscreen', isFullscreen);
  });
}

// Electron 환경이면 JSON 파일에서 프리셋 로드
if (window.electronAPI) {
  window.electronAPI.readPresets().then(loaded => {
    if (loaded && loaded.length) {
      PRESETS = loaded.sort((a, b) => {
        const order = ['default', 'dark', 'brand', 'minimal'];
        return (order.indexOf(a.id) + 1 || 99) - (order.indexOf(b.id) + 1 || 99);
      });
    }
  });
}

function applyPreset(sec, presetId) {
  const preset = PRESETS.find(p => p.id === presetId);
  // 기존 preset 변수 초기화
  PRESETS.forEach(p => Object.keys(p.variables).forEach(k => sec.style.removeProperty(k)));
  delete sec.dataset.preset;

  if (preset && presetId !== 'default') {
    Object.entries(preset.variables).forEach(([k, v]) => sec.style.setProperty(k, v));
    sec.dataset.preset = presetId;
  }
  pushHistory();
}

function showSectionProperties(sec) {
  const rawBg = sec.style.backgroundColor || sec.style.background || '';
  const hexBg = rawBg
    ? (/^#[0-9a-f]{6}$/i.test(rawBg) ? rawBg : rgbToHex(rawBg))
    : '#ffffff';
  const hasBgImg  = !!sec.dataset.bgImg;
  const bgSize    = sec.dataset.bgSize || 'cover';
  const bgImgHTML = hasBgImg ? `
    <div class="prop-row" style="margin-top:6px;">
      <span class="prop-label">사이즈</span>
      <select class="prop-select" id="sec-bg-size">
        <option value="cover"   ${bgSize==='cover'   ?'selected':''}>Cover</option>
        <option value="contain" ${bgSize==='contain' ?'selected':''}>Contain</option>
        <option value="auto"    ${bgSize==='auto'    ?'selected':''}>Auto</option>
      </select>
    </div>
    <button class="prop-action-btn danger" id="sec-bg-img-remove" style="margin-top:6px;">이미지 제거</button>
  ` : `
    <button class="prop-action-btn secondary" id="sec-bg-img-btn" style="margin-top:6px;">이미지 선택</button>
    <input type="file" id="sec-bg-img-input" accept="image/*" style="display:none">
  `;

  // 섹션 내 텍스트 블록 타입별 수집
  const typeMap = { heading: 'Heading', body: 'Body', caption: 'Caption', label: 'Label' };
  const typeOrder = ['heading', 'body', 'caption', 'label'];
  const found = {}; // type → { blocks: [], color: hex }
  sec.querySelectorAll('.text-block').forEach(tb => {
    const type = tb.dataset.type;
    if (!typeMap[type]) return;
    const contentEl = tb.querySelector('[contenteditable]') || tb.querySelector('div');
    const computed = window.getComputedStyle(contentEl);
    const colorHex = contentEl.style.color
      ? (/^#/.test(contentEl.style.color) ? contentEl.style.color : rgbToHex(contentEl.style.color))
      : rgbToHex(computed.color);
    if (!found[type]) found[type] = { blocks: [], color: colorHex };
    found[type].blocks.push(tb);
  });

  const colorRows = typeOrder.filter(t => found[t]).map(t => {
    const c = found[t].color;
    return `
      <div class="prop-color-row">
        <span class="prop-label">${typeMap[t]}</span>
        <div class="prop-color-swatch" style="background:${c}">
          <input type="color" id="sec-txt-${t}" value="${c}">
        </div>
        <input type="text" class="prop-color-hex" id="sec-txt-${t}-hex" value="${c}" maxlength="7">
      </div>`;
  }).join('');

  const currentPreset = sec.dataset.preset || 'default';
  const presetGridHTML = PRESETS.map(p => `
    <button class="prop-preset-btn${p.id === currentPreset ? ' active' : ''}" data-preset-id="${p.id}">
      <div class="prop-preset-swatches">
        ${p.dots.map(c => `<div class="prop-preset-dot" style="background:${c}"></div>`).join('')}
      </div>
      <span class="prop-preset-name">${p.name}</span>
    </button>`).join('');

  propPanel.innerHTML = `
    <div class="prop-section">
      <div class="prop-block-label">
        <div class="prop-block-icon">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#888" stroke-width="1.3">
            <rect x="1" y="1" width="10" height="10" rx="1.5"/>
          </svg>
        </div>
        <span class="prop-block-name">Section</span>
      </div>
      <div class="prop-section-title">Preset</div>
      <div class="prop-preset-grid">${presetGridHTML}</div>
    </div>
    <div class="prop-section">
      <div class="prop-section-title">배경</div>
      <div class="prop-color-row">
        <span class="prop-label">배경색</span>
        <div class="prop-color-swatch" style="background:${hexBg}">
          <input type="color" id="sec-bg-color" value="${hexBg}">
        </div>
        <input type="text" class="prop-color-hex" id="sec-bg-hex" value="${hexBg}" maxlength="7">
      </div>
      <div class="prop-section-title" style="margin-top:10px;">배경 이미지</div>
      ${bgImgHTML}
    </div>
    ${colorRows ? `<div class="prop-section"><div class="prop-section-title">텍스트 컬러</div>${colorRows}</div>` : ''}
    <div class="prop-section">
      <div class="prop-section-title">일괄 정렬</div>
      <div class="prop-align-group">
        <button class="prop-align-btn" id="sec-align-left">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3">
            <line x1="1" y1="3" x2="13" y2="3"/><line x1="1" y1="6" x2="9" y2="6"/>
            <line x1="1" y1="9" x2="11" y2="9"/><line x1="1" y1="12" x2="7" y2="12"/>
          </svg>
        </button>
        <button class="prop-align-btn" id="sec-align-center">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3">
            <line x1="1" y1="3" x2="13" y2="3"/><line x1="3" y1="6" x2="11" y2="6"/>
            <line x1="2" y1="9" x2="12" y2="9"/><line x1="4" y1="12" x2="10" y2="12"/>
          </svg>
        </button>
        <button class="prop-align-btn" id="sec-align-right">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3">
            <line x1="1" y1="3" x2="13" y2="3"/><line x1="5" y1="6" x2="13" y2="6"/>
            <line x1="3" y1="9" x2="13" y2="9"/><line x1="7" y1="12" x2="13" y2="12"/>
          </svg>
        </button>
      </div>
    </div>
    <div class="prop-section">
      <div class="prop-section-title">내보내기</div>
      <select class="prop-select" id="sec-export-format" style="width:100%;margin-bottom:6px;">
        <option value="png">PNG</option>
        <option value="jpg">JPG</option>
      </select>
      <button class="prop-export-btn" id="sec-export-btn">이 섹션 내보내기</button>
    </div>
    <div class="prop-section">
      <div class="prop-section-title">템플릿</div>
      <select class="prop-select" id="sec-tpl-cat" style="width:100%;margin-bottom:6px;">
        <option value="Hero">Hero</option>
        <option value="Main">Main</option>
        <option value="Feature">Feature</option>
        <option value="Detail">Detail</option>
        <option value="CTA">CTA</option>
        <option value="Event">Event</option>
        <option value="기타">기타</option>
      </select>
      <input type="text" id="sec-tpl-name" class="tpl-name-input" placeholder="템플릿 이름 입력">
      <button class="prop-action-btn primary" id="sec-tpl-save-btn" style="margin-top:6px;">템플릿으로 저장</button>
    </div>`;

  // 배경색 이벤트
  const picker = document.getElementById('sec-bg-color');
  const hex    = document.getElementById('sec-bg-hex');
  const swatch = picker.closest('.prop-color-swatch');
  picker.addEventListener('input', () => {
    sec.style.background = picker.value;
    hex.value = picker.value;
    swatch.style.background = picker.value;
  });
  hex.addEventListener('input', () => {
    if (/^#[0-9a-f]{6}$/i.test(hex.value)) {
      sec.style.background = hex.value;
      picker.value = hex.value;
      swatch.style.background = hex.value;
    }
  });

  // 배경 이미지 이벤트
  const bgImgBtn    = document.getElementById('sec-bg-img-btn');
  const bgImgInput  = document.getElementById('sec-bg-img-input');
  const bgSizeEl    = document.getElementById('sec-bg-size');
  const bgImgRemove = document.getElementById('sec-bg-img-remove');

  if (bgImgBtn && bgImgInput) {
    bgImgBtn.addEventListener('click', () => bgImgInput.click());
    bgImgInput.addEventListener('change', () => {
      const file = bgImgInput.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target.result;
        sec.dataset.bgImg = dataUrl;
        sec.dataset.bgSize = 'cover';
        sec.style.backgroundImage = `url(${dataUrl})`;
        sec.style.backgroundSize = 'cover';
        sec.style.backgroundPosition = 'center';
        sec.style.backgroundRepeat = 'no-repeat';
        showSectionProperties(sec);
      };
      reader.readAsDataURL(file);
    });
  }
  if (bgSizeEl) {
    bgSizeEl.addEventListener('change', () => {
      sec.dataset.bgSize = bgSizeEl.value;
      sec.style.backgroundSize = bgSizeEl.value;
    });
  }
  if (bgImgRemove) {
    bgImgRemove.addEventListener('click', () => {
      delete sec.dataset.bgImg;
      delete sec.dataset.bgSize;
      sec.style.backgroundImage = '';
      sec.style.backgroundSize = '';
      sec.style.backgroundPosition = '';
      sec.style.backgroundRepeat = '';
      showSectionProperties(sec);
    });
  }

  // Preset 버튼 이벤트
  propPanel.querySelectorAll('.prop-preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      applyPreset(sec, btn.dataset.presetId);
      propPanel.querySelectorAll('.prop-preset-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // 텍스트 컬러 이벤트
  typeOrder.filter(t => found[t]).forEach(t => {
    const blocks = found[t].blocks;
    const applyColor = (val) => {
      blocks.forEach(tb => {
        const contentEl = tb.querySelector('[contenteditable]') || tb.querySelector('div');
        contentEl.style.color = val;
      });
    };
    const p = document.getElementById(`sec-txt-${t}`);
    const h = document.getElementById(`sec-txt-${t}-hex`);
    const sw = p.closest('.prop-color-swatch');
    p.addEventListener('input', () => { applyColor(p.value); h.value = p.value; sw.style.background = p.value; });
    h.addEventListener('input', () => {
      if (/^#[0-9a-f]{6}$/i.test(h.value)) { applyColor(h.value); p.value = h.value; sw.style.background = h.value; }
    });
  });

  // 일괄 정렬
  const allTextBlocks = [...sec.querySelectorAll('.text-block')];
  ['left','center','right'].forEach(align => {
    const btn = document.getElementById(`sec-align-${align}`);
    if (!btn) return;
    btn.addEventListener('click', () => {
      allTextBlocks.forEach(tb => {
        const isLabel = tb.querySelector('.tb-label');
        if (isLabel) { tb.style.textAlign = align; }
        else {
          const contentEl = tb.querySelector('[contenteditable]') || tb.querySelector('div');
          if (contentEl) contentEl.style.textAlign = align;
        }
      });
      propPanel.querySelectorAll('#sec-align-left,#sec-align-center,#sec-align-right')
        .forEach(b => b.classList.toggle('active', b === btn));
    });
  });

  // 내보내기
  const secExportBtn = document.getElementById('sec-export-btn');
  if (secExportBtn) {
    secExportBtn.addEventListener('click', async () => {
      const fmt = document.getElementById('sec-export-format').value;
      secExportBtn.disabled = true;
      secExportBtn.textContent = '내보내는 중...';
      try {
        await exportSection(sec, fmt);
      } finally {
        secExportBtn.disabled = false;
        secExportBtn.textContent = '이 섹션 내보내기';
      }
    });
  }

  // 템플릿 저장
  const tplSaveBtn = document.getElementById('sec-tpl-save-btn');
  if (tplSaveBtn) {
    tplSaveBtn.addEventListener('click', () => {
      const name = document.getElementById('sec-tpl-name').value.trim();
      if (!name) { document.getElementById('sec-tpl-name').focus(); return; }
      const category = document.getElementById('sec-tpl-cat').value;
      saveAsTemplate(sec, name, category);
      document.getElementById('sec-tpl-name').value = '';
      tplSaveBtn.textContent = '저장됨 ✓';
      tplSaveBtn.disabled = true;
      setTimeout(() => {
        if (tplSaveBtn) { tplSaveBtn.textContent = '템플릿으로 저장'; tplSaveBtn.disabled = false; }
      }, 1500);
    });
  }
}

/* 블록이 선택된 상태에서 소속 섹션만 하이라이트 (deselectAll 없이) */
function syncSection(sec) {
  document.querySelectorAll('.section-block').forEach(s => s.classList.remove('selected'));
  sec.classList.add('selected');
  syncLayerActive(sec);
}

function deselectAll() {
  document.querySelectorAll('.group-block').forEach(g => g.classList.remove('group-selected'));
  document.querySelectorAll('.section-block').forEach(s => s.classList.remove('selected'));
  document.querySelectorAll('.text-block').forEach(t => {
    t.classList.remove('selected', 'editing');
    t.querySelectorAll('[contenteditable]').forEach(el => el.setAttribute('contenteditable','false'));
  });
  document.querySelectorAll('.asset-block').forEach(a => {
    a.classList.remove('selected');
    exitImageEditMode(a);
  });
  document.querySelectorAll('.gap-block').forEach(g => g.classList.remove('selected'));
  document.querySelectorAll('.icon-circle-block').forEach(b => b.classList.remove('selected'));
  document.querySelectorAll('.table-block').forEach(b => {
    b.classList.remove('selected');
    b.querySelectorAll('[contenteditable="true"]').forEach(el => el.setAttribute('contenteditable','false'));
  });
  document.querySelectorAll('.layer-section-header').forEach(h => h.classList.remove('active'));
  document.querySelectorAll('.layer-item').forEach(i => { i.classList.remove('active'); i.style.background = ''; });
  document.querySelectorAll('.layer-row-header').forEach(h => h.classList.remove('active'));
  showPageProperties();
}


function bindSectionDelete(sec) {
  const btns = sec.querySelectorAll('.section-toolbar .st-btn');
  if (btns[2]) {
    btns[2].addEventListener('click', e => {
      e.stopPropagation();
      pushHistory();
      sec.remove();
      deselectAll();
      buildLayerPanel();
    });
  }
}

function bindSectionOrder(sec) {
  const btns = sec.querySelectorAll('.section-toolbar .st-btn');
  if (btns[0]) {
    btns[0].addEventListener('click', e => {
      e.stopPropagation();
      const prev = sec.previousElementSibling;
      if (prev && prev.classList.contains('section-block')) {
        pushHistory();
        canvasEl.insertBefore(sec, prev);
        buildLayerPanel();
        selectSection(sec);
      }
    });
  }
  if (btns[1]) {
    btns[1].addEventListener('click', e => {
      e.stopPropagation();
      const next = sec.nextElementSibling;
      if (next && next.classList.contains('section-block')) {
        pushHistory();
        canvasEl.insertBefore(next, sec);
        buildLayerPanel();
        selectSection(sec);
      }
    });
  }
}

document.querySelectorAll('.section-block').forEach(sec => {
  sec.addEventListener('click', e => { e.stopPropagation(); selectSection(sec); });
  bindSectionDelete(sec);
  bindSectionOrder(sec);
  bindSectionDropZone(sec);
  bindSectionDrag(sec);
});

document.getElementById('canvas-wrap').addEventListener('click', e => {
  if (['canvas-wrap','canvas-scaler','canvas'].includes(e.target.id)) deselectAll();
});

/* ── Static 블록 초기 바인딩 ── */
document.querySelectorAll('.text-block, .asset-block, .gap-block').forEach(b => bindBlock(b));

/* ═══════════════════════════════════
   PROPERTIES PANEL
═══════════════════════════════════ */
const propPanel   = document.querySelector('#panel-right .panel-body');
const canvasEl    = document.getElementById('canvas');
const canvasWrap  = document.getElementById('canvas-wrap');

let pageSettings = { bg: '#969696', gap: 100, padX: 32, padY: 32 };

/* ── Multi-page state ── */
const PAGE_LABELS = ['', 'Hook', 'Main', 'Detail', 'CTA', 'Event'];
let pages = [{ id: 'page_1', name: 'Page 1', label: '', pageSettings: { bg: '#969696', gap: 100, padX: 32, padY: 32 }, canvas: '' }];
let currentPageId = 'page_1';
let _suppressAutoSave = false;

function showPageProperties() {
  const { bg, gap, padX, padY } = pageSettings;
  propPanel.innerHTML = `
    <div class="prop-section">
      <div class="prop-block-label">
        <div class="prop-block-icon">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#888" stroke-width="1.3">
            <rect x="1" y="1" width="10" height="10" rx="1.5"/>
          </svg>
        </div>
        <span class="prop-block-name">Page</span>
      </div>
      <div class="prop-section-title">배경</div>
      <div class="prop-color-row">
        <span class="prop-label">배경색</span>
        <div class="prop-color-swatch" style="background:${bg}">
          <input type="color" id="page-bg-color" value="${bg}">
        </div>
        <input type="text" class="prop-color-hex" id="page-bg-hex" value="${bg}" maxlength="7">
      </div>
    </div>
    <div class="prop-section">
      <div class="prop-section-title">일괄 정렬</div>
      <div class="prop-align-group">
        <button class="prop-align-btn" id="page-align-left">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3">
            <line x1="1" y1="3" x2="13" y2="3"/><line x1="1" y1="6" x2="9" y2="6"/>
            <line x1="1" y1="9" x2="11" y2="9"/><line x1="1" y1="12" x2="7" y2="12"/>
          </svg>
        </button>
        <button class="prop-align-btn" id="page-align-center">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3">
            <line x1="1" y1="3" x2="13" y2="3"/><line x1="3" y1="6" x2="11" y2="6"/>
            <line x1="2" y1="9" x2="12" y2="9"/><line x1="4" y1="12" x2="10" y2="12"/>
          </svg>
        </button>
        <button class="prop-align-btn" id="page-align-right">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3">
            <line x1="1" y1="3" x2="13" y2="3"/><line x1="5" y1="6" x2="13" y2="6"/>
            <line x1="3" y1="9" x2="13" y2="9"/><line x1="7" y1="12" x2="13" y2="12"/>
          </svg>
        </button>
      </div>
    </div>
    <div class="prop-section">
      <div class="prop-section-title">레이아웃</div>
      <div class="prop-row">
        <span class="prop-label">섹션 간격</span>
        <input type="range" class="prop-slider" id="section-gap-slider" min="0" max="200" step="4" value="${gap}">
        <input type="number" class="prop-number" id="section-gap-number" min="0" max="200" value="${gap}">
      </div>
      <div class="prop-row">
        <span class="prop-label">좌우 패딩</span>
        <input type="range" class="prop-slider" id="page-padx-slider" min="0" max="200" step="4" value="${padX}">
        <input type="number" class="prop-number" id="page-padx-number" min="0" max="200" value="${padX}">
      </div>
      <div class="prop-row">
        <span class="prop-label">상하 패딩</span>
        <input type="range" class="prop-slider" id="page-pady-slider" min="0" max="200" step="4" value="${padY}">
        <input type="number" class="prop-number" id="page-pady-number" min="0" max="200" value="${padY}">
      </div>
    </div>
    <div class="prop-section">
      <div class="prop-section-title">내보내기</div>
      <select class="prop-select" id="page-export-format" style="width:100%;margin-bottom:6px;">
        <option value="png">PNG</option>
        <option value="jpg">JPG</option>
      </select>
      <button class="prop-export-btn" id="page-export-all-btn">전체 섹션 내보내기</button>
    </div>`;

  const bgPicker = document.getElementById('page-bg-color');
  const bgHex    = document.getElementById('page-bg-hex');
  const bgSwatch = bgPicker.closest('.prop-color-swatch');
  bgPicker.addEventListener('input', () => {
    pageSettings.bg = bgPicker.value;
    canvasWrap.style.background = pageSettings.bg;
    bgHex.value = pageSettings.bg;
    bgSwatch.style.background = pageSettings.bg;
  });
  bgHex.addEventListener('input', () => {
    if (/^#[0-9a-f]{6}$/i.test(bgHex.value)) {
      pageSettings.bg = bgHex.value;
      bgPicker.value = pageSettings.bg;
      canvasWrap.style.background = pageSettings.bg;
      bgSwatch.style.background = pageSettings.bg;
    }
  });

  const gapSlider = document.getElementById('section-gap-slider');
  const gapNumber = document.getElementById('section-gap-number');
  gapSlider.addEventListener('input', () => {
    pageSettings.gap = parseInt(gapSlider.value);
    canvasEl.style.gap = pageSettings.gap + 'px';
    gapNumber.value = pageSettings.gap;
  });
  gapNumber.addEventListener('input', () => {
    const v = Math.min(200, Math.max(0, parseInt(gapNumber.value) || 0));
    pageSettings.gap = v;
    canvasEl.style.gap = v + 'px';
    gapSlider.value = v;
  });

  const applyPadX = (v) => {
    pageSettings.padX = v;
    document.querySelectorAll('.text-block').forEach(tb => {
      tb.style.paddingLeft = v + 'px';
      tb.style.paddingRight = v + 'px';
    });
  };
  const applyPadY = (v) => {
    pageSettings.padY = v;
    document.querySelectorAll('.text-block').forEach(tb => {
      if (tb.dataset.type === 'label') return;
      tb.style.paddingTop = v + 'px';
      tb.style.paddingBottom = v + 'px';
    });
  };
  const padxSlider = document.getElementById('page-padx-slider');
  const padxNumber = document.getElementById('page-padx-number');
  padxSlider.addEventListener('input', () => { applyPadX(parseInt(padxSlider.value)); padxNumber.value = padxSlider.value; });
  padxNumber.addEventListener('input', () => { const v = Math.min(200, Math.max(0, parseInt(padxNumber.value)||0)); applyPadX(v); padxSlider.value = v; });

  const padySlider = document.getElementById('page-pady-slider');
  const padyNumber = document.getElementById('page-pady-number');
  padySlider.addEventListener('input', () => { applyPadY(parseInt(padySlider.value)); padyNumber.value = padySlider.value; });
  padyNumber.addEventListener('input', () => { const v = Math.min(200, Math.max(0, parseInt(padyNumber.value)||0)); applyPadY(v); padySlider.value = v; });

  ['left','center','right'].forEach(align => {
    const btn = document.getElementById(`page-align-${align}`);
    if (!btn) return;
    btn.addEventListener('click', () => {
      document.querySelectorAll('.text-block').forEach(tb => {
        if (tb.querySelector('.tb-label')) { tb.style.textAlign = align; }
        else {
          const contentEl = tb.querySelector('[contenteditable]') || tb.querySelector('div');
          if (contentEl) contentEl.style.textAlign = align;
        }
      });
      propPanel.querySelectorAll('#page-align-left,#page-align-center,#page-align-right')
        .forEach(b => b.classList.toggle('active', b === btn));
    });
  });

  // 전체 내보내기
  const pageExportBtn = document.getElementById('page-export-all-btn');
  if (pageExportBtn) {
    pageExportBtn.addEventListener('click', async () => {
      const fmt = document.getElementById('page-export-format').value;
      const secCount = canvasEl.querySelectorAll('.section-block').length;
      if (!confirm(`전체 ${secCount}개 섹션을 내보냅니다. 계속할까요?`)) return;
      pageExportBtn.disabled = true;
      pageExportBtn.textContent = '내보내는 중...';
      try {
        await exportAllSections(fmt);
      } finally {
        pageExportBtn.disabled = false;
        pageExportBtn.textContent = '전체 섹션 내보내기';
      }
    });
  }
}

function getCurrentRatioStr(block) {
  const row = block.closest('.row');
  if (!row) return '1*1';
  if (row.dataset.ratioStr) return row.dataset.ratioStr;
  const cols = [...row.querySelectorAll(':scope > .col')];
  if (cols.length <= 1) return '1*1';
  return `${cols.length}*1`;
}

function makeColPlaceholder(col) {
  const ph = document.createElement('div');
  ph.className = 'col-placeholder';
  ph.innerHTML = `
    <button class="col-add-btn">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8">
        <line x1="8" y1="2" x2="8" y2="14"/><line x1="2" y1="8" x2="14" y2="8"/>
      </svg>
    </button>
    <div class="col-add-menu" style="display:none">
      <button class="col-add-item" data-add="h2">Heading</button>
      <button class="col-add-item" data-add="body">Body</button>
      <button class="col-add-item" data-add="caption">Caption</button>
      <button class="col-add-item" data-add="label">Label</button>
      <div class="col-add-divider"></div>
      <button class="col-add-item" data-add="asset">Asset</button>
    </div>`;

  const btn  = ph.querySelector('.col-add-btn');
  const menu = ph.querySelector('.col-add-menu');

  btn.addEventListener('click', e => {
    e.stopPropagation();
    // 다른 열린 메뉴 닫기
    document.querySelectorAll('.col-add-menu').forEach(m => { if (m !== menu) m.style.display = 'none'; });
    menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
  });

  ph.querySelectorAll('.col-add-item').forEach(item => {
    item.addEventListener('click', e => {
      e.stopPropagation();
      menu.style.display = 'none';
      const type = item.dataset.add;
      let block;
      if (type === 'asset') {
        const ab = document.createElement('div');
        ab.className = 'asset-block';
        ab.style.height = '460px';
        ab.innerHTML = `
          ${ASSET_SVG}
          <span class="asset-label">에셋을 업로드하거나 드래그하세요</span>`;
        block = ab;
      } else {
        const { block: tb } = makeTextBlock(type);
        block = tb;
      }
      col.replaceChild(block, ph);
      bindBlock(block);
      buildLayerPanel();
    });
  });

  return ph;
}

function makeEmptyCol(flexVal) {
  const col = document.createElement('div');
  col.className = 'col';
  if (flexVal) { col.style.flex = flexVal; col.dataset.flex = flexVal; }
  col.appendChild(makeColPlaceholder(col));
  return col;
}

function applyRowLayout(block, ratioStr) {
  const parts = ratioStr.trim().split('*').map(n => parseInt(n.trim())).filter(n => n > 0 && !isNaN(n));
  if (parts.length === 0) return;

  const cols  = parts[0] || 1;
  const rows  = parts[1] || 1;
  const total = cols * rows;

  const row = block.closest('.row');
  if (!row) return;

  const existingCols = [...row.querySelectorAll(':scope > .col')];

  if (cols === 1 && rows === 1) {
    // 단일 셀: stack 복귀
    row.dataset.layout = 'stack';
    row.dataset.ratioStr = '1*1';
    row.style.display = '';
    row.style.gridTemplateColumns = '';
    existingCols.slice(1).forEach(col => col.remove());
    if (existingCols[0]) { existingCols[0].style.flex = ''; delete existingCols[0].dataset.flex; }

  } else if (rows === 1) {
    // Flex row: 여러 열, 1행
    row.dataset.layout = 'flex';
    row.dataset.ratioStr = `${cols}*1`;
    row.style.display = '';
    row.style.gridTemplateColumns = '';
    existingCols.forEach((col, i) => {
      if (i < cols) { col.style.flex = '1'; col.dataset.flex = '1'; }
      else col.remove();
    });
    for (let i = existingCols.length; i < cols; i++) row.appendChild(makeEmptyCol('1'));

  } else {
    // CSS Grid: cols열 × rows행
    row.dataset.layout = 'grid';
    row.dataset.ratioStr = `${cols}*${rows}`;
    row.style.display = 'grid';
    row.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    existingCols.forEach((col, i) => {
      if (i < total) { col.style.flex = ''; delete col.dataset.flex; }
      else col.remove();
    });
    for (let i = existingCols.length; i < total; i++) row.appendChild(makeEmptyCol(null));
  }

  buildLayerPanel();
}

function bindLayoutInput(block) {
  const input = document.getElementById('layout-ratio');
  if (!input) return;
  const apply = () => applyRowLayout(block, input.value);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); apply(); } });
  input.addEventListener('blur', apply);
}

function showAssetProperties(ab) {
  const ratioStr   = getCurrentRatioStr(ab);
  const currentH   = parseInt(ab.style.height) || ab.offsetHeight || 780;
  const hasImage   = ab.classList.contains('has-image');
  const currentR   = parseInt(ab.style.borderRadius) || 0;
  const currentW   = ab.offsetWidth || 400;
  const currentAlign = ab.dataset.align || 'center';
  if (!ab.dataset.align) { ab.dataset.align = 'center'; ab.style.alignSelf = 'center'; }
  const currentSize  = ab.dataset.size  || '100';

  const imageSection = hasImage ? `
    <div class="prop-section">
      <div class="prop-section-title">이미지</div>
      <button class="prop-action-btn secondary" id="asset-replace-btn">이미지 교체</button>
      <button class="prop-action-btn danger"    id="asset-remove-btn">이미지 제거</button>
    </div>` : `
    <div class="prop-section">
      <div class="prop-section-title">이미지</div>
      <button class="prop-action-btn primary" id="asset-upload-btn">이미지 선택</button>
      <div style="text-align:center;font-size:11px;color:#555;margin-top:6px;">또는 블록에 파일을 드래그</div>
    </div>`;

  propPanel.innerHTML = `
    <div class="prop-section">
      <div class="prop-block-label">
        <div class="prop-block-icon">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#888" stroke-width="1.3">
            <rect x="1" y="1" width="10" height="10" rx="1"/>
            <circle cx="4" cy="4" r="1"/>
            <polyline points="11 8 8 5 3 11"/>
          </svg>
        </div>
        <span class="prop-block-name">Asset Block</span>
      </div>
      <div class="prop-section-title">레이아웃</div>
      <div class="prop-row">
        <span class="prop-label">비율</span>
        <input type="text" class="prop-layout-input" id="layout-ratio" value="${ratioStr}" placeholder="2*2">
      </div>
    </div>
    <div class="prop-section">
      <div class="prop-section-title">크기</div>
      <div class="prop-row">
        <span class="prop-label">정렬</span>
        <div class="prop-align-group" id="asset-align-group">
          <button class="prop-align-btn${currentAlign==='left'?' active':''}"   data-align="left">←</button>
          <button class="prop-align-btn${currentAlign==='center'?' active':''}" data-align="center">↔</button>
          <button class="prop-align-btn${currentAlign==='right'?' active':''}"  data-align="right">→</button>
        </div>
      </div>
      <div class="prop-row">
        <span class="prop-label">모서리</span>
        <input type="range" class="prop-slider" id="asset-r-slider" min="0" max="120" step="2" value="${currentR}">
        <input type="number" class="prop-number" id="asset-r-number" min="0" max="120" value="${currentR}">
      </div>
      <div class="prop-row">
        <span class="prop-label">사이즈</span>
        <select class="prop-select" id="asset-size-select">
          <option value="85"  ${currentSize==='85'  ?'selected':''}>85%</option>
          <option value="90"  ${currentSize==='90'  ?'selected':''}>90%</option>
          <option value="95"  ${currentSize==='95'  ?'selected':''}>95%</option>
          <option value="100" ${currentSize==='100' ?'selected':''}>100%</option>
        </select>
      </div>
    </div>
    ${imageSection}`;

  bindLayoutInput(ab);


  const applyAlign = a => {
    ab.dataset.align = a;
    if (a === 'left')   ab.style.alignSelf = 'flex-start';
    if (a === 'center') ab.style.alignSelf = 'center';
    if (a === 'right')  ab.style.alignSelf = 'flex-end';
    document.querySelectorAll('#asset-align-group .prop-align-btn').forEach(b => b.classList.toggle('active', b.dataset.align === a));
  };
  document.querySelectorAll('#asset-align-group .prop-align-btn').forEach(btn => {
    btn.addEventListener('click', () => applyAlign(btn.dataset.align));
  });

  const rSlider = document.getElementById('asset-r-slider');
  const rNumber = document.getElementById('asset-r-number');
  const applyR = v => { ab.style.borderRadius = v + 'px'; };
  rSlider.addEventListener('input', () => { applyR(parseInt(rSlider.value)); rNumber.value = rSlider.value; });
  rNumber.addEventListener('input', () => {
    const v = Math.min(120, Math.max(0, parseInt(rNumber.value) || 0));
    applyR(v); rSlider.value = v;
  });

  document.getElementById('asset-size-select').addEventListener('change', e => {
    const v = e.target.value;
    ab.dataset.size = v;

    const prevW = ab.offsetWidth;
    const prevH = parseInt(ab.style.height) || ab.offsetHeight;
    const ratio = prevH / prevW;

    ab.style.width = v === '100' ? '' : v + '%';

    requestAnimationFrame(() => {
      const newW = ab.offsetWidth;
      ab.style.height = Math.round(newW * ratio) + 'px';
      pushHistory();
    });
  });

  if (hasImage) {
    document.getElementById('asset-replace-btn').addEventListener('click', () => triggerAssetUpload(ab));
    document.getElementById('asset-remove-btn').addEventListener('click', () => clearAssetImage(ab));
  } else {
    document.getElementById('asset-upload-btn').addEventListener('click', () => triggerAssetUpload(ab));
  }
}

function showTextProperties(tb) {
  const contentEl = tb.querySelector('[contenteditable]');
  const computed   = window.getComputedStyle(contentEl);

  const currentClass = ['tb-h1','tb-h2','tb-body','tb-caption','tb-label'].find(c => contentEl.classList.contains(c)) || 'tb-body';
  const rawBg = window.getComputedStyle(contentEl).backgroundColor;
  const currentBgColor = (!rawBg || rawBg === 'rgba(0, 0, 0, 0)' || rawBg === 'transparent') ? '#111111' : (rgbToHex(rawBg) || '#111111');
  const currentRadius = parseInt(contentEl.style.borderRadius) || 4;
  const isLabel = currentClass === 'tb-label';
  const currentAlign = isLabel ? (tb.style.textAlign || 'left') : (contentEl.style.textAlign || 'left');
  const currentSize  = parseInt(computed.fontSize) || 15;
  const currentColor = rgbToHex(computed.color) || '#111111';
  const currentLH    = (parseFloat(computed.lineHeight) / parseFloat(computed.fontSize) || 1.5).toFixed(2);
  const currentLS    = parseFloat(contentEl.style.letterSpacing) || 0;
  const defaultPad   = isLabel ? 0 : pageSettings.padY;
  const currentPadT  = tb.style.paddingTop    ? (parseInt(tb.style.paddingTop)    || 0) : defaultPad;
  const currentPadB  = tb.style.paddingBottom ? (parseInt(tb.style.paddingBottom) || 0) : defaultPad;
  const currentFont  = contentEl.style.fontFamily || '';

  const ratioStr = getCurrentRatioStr(tb);
  propPanel.innerHTML = `
    <div class="prop-section">
      <div class="prop-block-label">
        <div class="prop-block-icon">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#888" stroke-width="1.3">
            <line x1="1" y1="3" x2="11" y2="3"/><line x1="1" y1="6" x2="11" y2="6"/><line x1="1" y1="9" x2="7" y2="9"/>
          </svg>
        </div>
        <span class="prop-block-name">Text Block</span>
      </div>
      <div class="prop-section-title">레이아웃</div>
      <div class="prop-row">
        <span class="prop-label">비율</span>
        <input type="text" class="prop-layout-input" id="layout-ratio" value="${ratioStr}" placeholder="1*2*1">
      </div>
    </div>
    <div class="prop-section">
      <div class="prop-section-title">타입</div>
      <div class="prop-type-group">
        <button class="prop-type-btn ${currentClass==='tb-h1'?'active':''}"      data-cls="tb-h1">H1</button>
        <button class="prop-type-btn ${currentClass==='tb-h2'?'active':''}"      data-cls="tb-h2">H2</button>
        <button class="prop-type-btn ${currentClass==='tb-body'?'active':''}"    data-cls="tb-body">Body</button>
        <button class="prop-type-btn ${currentClass==='tb-caption'?'active':''}" data-cls="tb-caption">Cap</button>
        <button class="prop-type-btn ${currentClass==='tb-label'?'active':''}"   data-cls="tb-label">Tag</button>
      </div>
    </div>
    <div id="label-style-section" style="display:${isLabel?'block':'none'}">
      <div class="prop-section">
        <div class="prop-section-title">태그 스타일</div>
        <div class="prop-color-row">
          <span class="prop-label">배경색</span>
          <div class="prop-color-swatch${currentBgColor==='transparent'?' swatch-none':''}" style="background:${currentBgColor==='transparent'?'transparent':currentBgColor}">
            <input type="color" id="label-bg-color" value="${currentBgColor==='transparent'?'#111111':currentBgColor}">
          </div>
          <input type="text" class="prop-color-hex" id="label-bg-hex" value="${currentBgColor==='transparent'?'':currentBgColor}" maxlength="7" placeholder="없음">
          <label class="prop-none-check"><input type="checkbox" id="label-bg-none" ${currentBgColor==='transparent'?'checked':''}>없음</label>
        </div>
        <div class="prop-row">
          <span class="prop-label">모서리</span>
          <input type="range" class="prop-slider" id="label-radius-slider" min="0" max="40" step="1" value="${currentRadius}">
          <input type="number" class="prop-number" id="label-radius-number" min="0" max="40" value="${currentRadius}">
        </div>
      </div>
    </div>

    <div class="prop-section">
      <div class="prop-section-title">정렬</div>
      <div class="prop-align-group">
        <button class="prop-align-btn ${currentAlign==='left'||currentAlign===''?'active':''}" data-align="left">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3">
            <line x1="1" y1="3" x2="13" y2="3"/><line x1="1" y1="6" x2="9" y2="6"/>
            <line x1="1" y1="9" x2="11" y2="9"/><line x1="1" y1="12" x2="7" y2="12"/>
          </svg>
        </button>
        <button class="prop-align-btn ${currentAlign==='center'?'active':''}" data-align="center">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3">
            <line x1="1" y1="3" x2="13" y2="3"/><line x1="3" y1="6" x2="11" y2="6"/>
            <line x1="2" y1="9" x2="12" y2="9"/><line x1="4" y1="12" x2="10" y2="12"/>
          </svg>
        </button>
        <button class="prop-align-btn ${currentAlign==='right'?'active':''}" data-align="right">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3">
            <line x1="1" y1="3" x2="13" y2="3"/><line x1="5" y1="6" x2="13" y2="6"/>
            <line x1="3" y1="9" x2="13" y2="9"/><line x1="7" y1="12" x2="13" y2="12"/>
          </svg>
        </button>
      </div>
    </div>

    <div class="prop-section">
      <div class="prop-section-title">폰트</div>
      <div class="prop-row">
        <span class="prop-label">종류</span>
        <select class="prop-select" id="txt-font-family">
          <option value="" style="font-family:inherit"           ${currentFont===''?'selected':''}>기본 (시스템)</option>
          <optgroup label="── 한글 ──">
            <option value="'Noto Sans KR', sans-serif"          ${currentFont.includes('Noto Sans KR')?'selected':''}>Noto Sans KR</option>
            <option value="'Noto Serif KR', serif"              ${currentFont.includes('Noto Serif KR')?'selected':''}>Noto Serif KR</option>
          </optgroup>
          <optgroup label="── 영문 ──">
            <option value="'Inter', sans-serif"                 ${currentFont.includes('Inter')?'selected':''}>Inter</option>
            <option value="'Space Grotesk', sans-serif"         ${currentFont.includes('Space Grotesk')?'selected':''}>Space Grotesk</option>
            <option value="'Playfair Display', serif"           ${currentFont.includes('Playfair Display')?'selected':''}>Playfair Display</option>
          </optgroup>
          <optgroup label="── 시스템 ──">
            <option value="sans-serif"                          ${currentFont==='sans-serif'?'selected':''}>Sans-serif</option>
            <option value="serif"                               ${currentFont==='serif'?'selected':''}>Serif</option>
            <option value="monospace"                           ${currentFont==='monospace'?'selected':''}>Monospace</option>
          </optgroup>
        </select>
      </div>
      <div class="prop-row">
        <span class="prop-label">크기</span>
        <input type="range" class="prop-slider" id="txt-size-slider" min="8" max="400" step="1" value="${currentSize}">
        <input type="number" class="prop-number" id="txt-size-number" min="8" max="400" value="${currentSize}">
      </div>
      <div class="prop-color-row">
        <span class="prop-label">색상</span>
        <div class="prop-color-swatch" style="background:${currentColor}">
          <input type="color" id="txt-color" value="${currentColor}">
        </div>
        <input type="text" class="prop-color-hex" id="txt-color-hex" value="${currentColor}" maxlength="7">
      </div>
    </div>

    <div class="prop-section">
      <div class="prop-section-title">간격</div>
      <div class="prop-row">
        <span class="prop-label">줄간격</span>
        <input type="range" class="prop-slider" id="txt-lh-slider" min="1" max="3" step="0.05" value="${currentLH}">
        <input type="number" class="prop-number" id="txt-lh-number" min="1" max="3" step="0.05" value="${currentLH}">
      </div>
      <div class="prop-row">
        <span class="prop-label">자간</span>
        <input type="range" class="prop-slider" id="txt-ls-slider" min="-10" max="40" step="0.5" value="${currentLS}">
        <input type="number" class="prop-number" id="txt-ls-number" min="-10" max="40" step="0.5" value="${currentLS}">
      </div>
      <div class="prop-row">
        <span class="prop-label">상단</span>
        <input type="range" class="prop-slider" id="txt-pt-slider" min="0" max="120" step="4" value="${currentPadT}">
        <input type="number" class="prop-number" id="txt-pt-number" min="0" max="120" value="${currentPadT}">
      </div>
      <div class="prop-row">
        <span class="prop-label">하단</span>
        <input type="range" class="prop-slider" id="txt-pb-slider" min="0" max="120" step="4" value="${currentPadB}">
        <input type="number" class="prop-number" id="txt-pb-number" min="0" max="120" value="${currentPadB}">
      </div>
    </div>

    <div class="prop-section prop-section--anim">
      <button class="prop-anim-btn" id="open-anim-btn">
        <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="1" y="3" width="12" height="8" rx="1.5"/>
          <path d="M5 6l3 1.5L5 9V6z" fill="currentColor" stroke="none"/>
        </svg>
        애니메이션 GIF 만들기
      </button>
    </div>`;

  /* 폰트 종류 */
  document.getElementById('txt-font-family').addEventListener('change', e => {
    contentEl.style.fontFamily = e.target.value;
  });

  /* 타입 전환 */
  const labelMap = { 'tb-h1':'Heading','tb-h2':'Heading','tb-body':'Body','tb-caption':'Caption','tb-label':'Label' };
  const typeMap2 = { 'tb-h1':'heading','tb-h2':'heading','tb-body':'body','tb-caption':'caption','tb-label':'label' };
  propPanel.querySelectorAll('.prop-type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const cls = btn.dataset.cls;
      contentEl.className = cls;
      tb.dataset.type = typeMap2[cls];
      propPanel.querySelectorAll('.prop-type-btn').forEach(b => b.classList.toggle('active', b===btn));

      const labelSection = document.getElementById('label-style-section');
      if (labelSection) labelSection.style.display = cls === 'tb-label' ? 'block' : 'none';

      // label로 전환 시 기본 스타일 적용, 다른 타입으로 전환 시 초기화
      if (cls === 'tb-label') {
        if (!contentEl.style.backgroundColor) contentEl.style.backgroundColor = '#111111';
        if (!contentEl.style.color) contentEl.style.color = '#ffffff';
        if (!contentEl.style.borderRadius) contentEl.style.borderRadius = '4px';
      } else {
        contentEl.style.backgroundColor = '';
        contentEl.style.borderRadius = '';
      }
    });
  });

  /* 태그 배경색 */
  const labelBgPicker = document.getElementById('label-bg-color');
  const labelBgHex    = document.getElementById('label-bg-hex');
  const labelBgNone   = document.getElementById('label-bg-none');
  if (labelBgPicker) {
    const labelBgSwatch = labelBgPicker.closest('.prop-color-swatch');
    const setLabelBg = (val) => {
      const isNone = val === 'transparent';
      contentEl.style.backgroundColor = val;
      contentEl.style.padding = isNone ? '0' : '';
      contentEl.style.borderRadius = isNone ? '0' : (contentEl.style.borderRadius || '');
      labelBgSwatch.style.background = isNone ? 'transparent' : val;
      labelBgSwatch.classList.toggle('swatch-none', isNone);
      if (!isNone) { labelBgHex.value = val; labelBgPicker.value = val; }
    };
    labelBgPicker.addEventListener('input', () => {
      if (labelBgNone.checked) return;
      setLabelBg(labelBgPicker.value);
      labelBgHex.value = labelBgPicker.value;
    });
    labelBgHex.addEventListener('input', () => {
      if (/^#[0-9a-f]{6}$/i.test(labelBgHex.value)) { setLabelBg(labelBgHex.value); labelBgNone.checked = false; }
    });
    labelBgNone.addEventListener('change', () => {
      if (labelBgNone.checked) { setLabelBg('transparent'); labelBgHex.value = ''; }
      else {
        contentEl.style.padding = '';
        const v = labelBgPicker.value || '#111111';
        setLabelBg(v); labelBgHex.value = v;
      }
    });
  }
  /* 태그 모서리 */
  const rSlider = document.getElementById('label-radius-slider');
  const rNumber = document.getElementById('label-radius-number');
  if (rSlider) {
    rSlider.addEventListener('input', () => { contentEl.style.borderRadius = rSlider.value+'px'; rNumber.value = rSlider.value; });
    rNumber.addEventListener('input', () => {
      const v = Math.min(40, Math.max(0, parseInt(rNumber.value)||0));
      contentEl.style.borderRadius = v+'px'; rSlider.value = v;
    });
  }

  /* 정렬 */
  propPanel.querySelectorAll('.prop-align-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      // label(inline-block)은 부모 tb에 text-align 적용해야 블록 자체가 정렬됨
      if (contentEl.classList.contains('tb-label')) {
        tb.style.textAlign = btn.dataset.align;
      } else {
        contentEl.style.textAlign = btn.dataset.align;
      }
      propPanel.querySelectorAll('.prop-align-btn').forEach(b => b.classList.toggle('active', b===btn));
    });
  });

  /* 폰트 크기 */
  const sizeSlider = document.getElementById('txt-size-slider');
  const sizeNumber = document.getElementById('txt-size-number');
  sizeSlider.addEventListener('input', () => { contentEl.style.fontSize = sizeSlider.value+'px'; sizeNumber.value = sizeSlider.value; });
  sizeNumber.addEventListener('input', () => {
    const v = Math.min(400, Math.max(8, parseInt(sizeNumber.value)||8));
    contentEl.style.fontSize = v+'px'; sizeSlider.value = v;
  });

  /* 색상 */
  const colorPicker = document.getElementById('txt-color');
  const colorHex    = document.getElementById('txt-color-hex');
  const colorSwatch = colorPicker.closest('.prop-color-swatch');
  colorPicker.addEventListener('input', () => {
    contentEl.style.color = colorPicker.value;
    colorHex.value = colorPicker.value;
    colorSwatch.style.background = colorPicker.value;
  });
  colorHex.addEventListener('input', () => {
    if (/^#[0-9a-f]{6}$/i.test(colorHex.value)) {
      colorPicker.value = colorHex.value;
      contentEl.style.color = colorHex.value;
      colorSwatch.style.background = colorHex.value;
    }
  });

  /* 줄간격 */
  const lhSlider = document.getElementById('txt-lh-slider');
  const lhNumber = document.getElementById('txt-lh-number');
  lhSlider.addEventListener('input', () => { contentEl.style.lineHeight = lhSlider.value; lhNumber.value = parseFloat(lhSlider.value).toFixed(2); });
  lhNumber.addEventListener('input', () => {
    const v = Math.min(3, Math.max(1, parseFloat(lhNumber.value)||1));
    contentEl.style.lineHeight = v; lhSlider.value = v;
  });

  /* 자간 */
  const lsSlider = document.getElementById('txt-ls-slider');
  const lsNumber = document.getElementById('txt-ls-number');
  lsSlider.addEventListener('input', () => { contentEl.style.letterSpacing = lsSlider.value + 'px'; lsNumber.value = lsSlider.value; });
  lsNumber.addEventListener('input', () => {
    const v = Math.min(40, Math.max(-10, parseFloat(lsNumber.value) || 0));
    contentEl.style.letterSpacing = v + 'px'; lsSlider.value = v;
  });

  /* 패딩 */
  const ptSlider = document.getElementById('txt-pt-slider');
  const ptNumber = document.getElementById('txt-pt-number');
  const pbSlider = document.getElementById('txt-pb-slider');
  const pbNumber = document.getElementById('txt-pb-number');
  ptSlider.addEventListener('input', () => { tb.style.paddingTop    = ptSlider.value+'px'; ptNumber.value = ptSlider.value; });
  ptNumber.addEventListener('input', () => { const v=Math.min(120,Math.max(0,parseInt(ptNumber.value)||0)); tb.style.paddingTop=v+'px'; ptSlider.value=v; });
  pbSlider.addEventListener('input', () => { tb.style.paddingBottom = pbSlider.value+'px'; pbNumber.value = pbSlider.value; });
  pbNumber.addEventListener('input', () => { const v=Math.min(120,Math.max(0,parseInt(pbNumber.value)||0)); tb.style.paddingBottom=v+'px'; pbSlider.value=v; });

  /* 애니메이션 GIF 버튼 */
  document.getElementById('open-anim-btn').addEventListener('click', () => openAnimModal(tb));

  bindLayoutInput(tb);
}

function rgbToHex(rgb) {
  const m = rgb.match(/\d+/g);
  if (!m) return '#111111';
  return '#' + m.slice(0,3).map(x => parseInt(x).toString(16).padStart(2,'0')).join('');
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

/* ═══════════════════════════════════
   BLOCK / SECTION 추가
═══════════════════════════════════ */
const ASSET_SVG = `
  <svg class="asset-icon" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="#888" stroke-width="1">
    <rect x="3" y="3" width="18" height="18" rx="2"/>
    <circle cx="8.5" cy="8.5" r="1.5"/>
    <polyline points="21 15 16 10 5 21"/>
  </svg>`;

function getSelectedSection() {
  return document.querySelector('.section-block.selected');
}

/* ═══════════════════════════════════
   DRAG AND DROP
═══════════════════════════════════ */
let dragSrc = null;
let layerDragSrc = null;
let sectionDragSrc = null;
let layerSectionDragSrc = null;

function getDragAfterElement(container, y) {
  const children = [...container.children].filter(el =>
    !el.classList.contains('drop-indicator') && el !== dragSrc
  );
  return children.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) return { offset, element: child };
    return closest;
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}

function clearDropIndicators() {
  document.querySelectorAll('.drop-indicator').forEach(d => d.remove());
}

function clearLayerIndicators() {
  document.querySelectorAll('.layer-drop-indicator').forEach(d => d.remove());
}

function clearSectionIndicators() {
  document.querySelectorAll('.section-drop-indicator').forEach(d => d.remove());
}

function clearLayerSectionIndicators() {
  document.querySelectorAll('.layer-section-drop-indicator').forEach(d => d.remove());
}

function getSectionDragAfterEl(container, y) {
  const sections = [...container.children].filter(el =>
    el.classList.contains('section-block') && el !== sectionDragSrc
  );
  return sections.reduce((closest, sec) => {
    const box = sec.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) return { offset, element: sec };
    return closest;
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}

function getLayerSectionDragAfterEl(panel, y) {
  const sections = [...panel.children].filter(el =>
    el.classList.contains('layer-section') && el !== layerSectionDragSrc?.sectionEl
  );
  return sections.reduce((closest, sec) => {
    const box = sec.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) return { offset, element: sec };
    return closest;
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}

function getLayerDragAfterItem(container, y) {
  const items = [...container.children].filter(el =>
    (el.classList.contains('layer-item') || el.classList.contains('layer-row-group')) && el !== layerDragSrc
  );
  return items.reduce((closest, item) => {
    const box = item.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) return { offset, element: item };
    return closest;
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}

function ungroupBlock(groupEl) {
  const inner = groupEl.querySelector('.group-inner');
  if (!inner) { groupEl.remove(); return; }
  pushHistory();
  // group-inner의 자식들을 group-block 위치로 이동
  [...inner.children].forEach(child => groupEl.before(child));
  groupEl.remove();
  buildLayerPanel();
}

function bindGroupDrag(groupEl) {
  if (groupEl._groupDragBound) return;
  groupEl._groupDragBound = true;

  const label = groupEl.querySelector(':scope > .group-block-label');
  if (!label) return;

  label.setAttribute('draggable', 'true');
  label.addEventListener('dragstart', e => {
    e.stopPropagation();
    dragSrc = groupEl;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', '');
    const ghost = document.createElement('div');
    ghost.style.cssText = 'position:fixed;top:-9999px;width:1px;height:1px;';
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 0, 0);
    setTimeout(() => ghost.remove(), 0);
    requestAnimationFrame(() => groupEl.classList.add('dragging'));
  });
  label.addEventListener('dragend', () => {
    groupEl.classList.remove('dragging');
    clearDropIndicators();
    dragSrc = null;
  });
}

function bindSectionDrag(sec) {
  const label = sec.querySelector('.section-label');
  if (!label || label._sectionDragBound) return;
  label._sectionDragBound = true;
  label.setAttribute('draggable', 'true');

  label.addEventListener('dragstart', e => {
    e.stopPropagation();
    sectionDragSrc = sec;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', '');
    const ghost = document.createElement('div');
    ghost.style.cssText = 'position:fixed;top:-9999px;width:1px;height:1px;';
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 0, 0);
    setTimeout(() => ghost.remove(), 0);
    requestAnimationFrame(() => sec.classList.add('section-dragging'));
  });
  label.addEventListener('dragend', () => {
    sec.classList.remove('section-dragging');
    clearSectionIndicators();
    sectionDragSrc = null;
  });
}

function bindSectionDropZone(sec) {
  const inner = sec.querySelector('.section-inner');
  inner.addEventListener('dragover', e => {
    if (!dragSrc) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    clearDropIndicators();
    const after = getDragAfterElement(inner, e.clientY);
    const indicator = document.createElement('div');
    indicator.className = 'drop-indicator';
    if (after) inner.insertBefore(indicator, after);
    else inner.appendChild(indicator);
  });
  inner.addEventListener('dragleave', e => {
    if (!inner.contains(e.relatedTarget)) clearDropIndicators();
  });
  inner.addEventListener('drop', e => {
    e.preventDefault();
    if (!dragSrc) return;
    const indicator = inner.querySelector('.drop-indicator');
    if (indicator) inner.insertBefore(dragSrc, indicator);
    else inner.appendChild(dragSrc);
    clearDropIndicators();
    buildLayerPanel();
    dragSrc = null;
  });
}

function bindBlock(block) {
  if (block._blockBound) return;
  block._blockBound = true;
  const isText   = block.classList.contains('text-block');
  const isGap    = block.classList.contains('gap-block');
  const isAsset  = block.classList.contains('asset-block');
  const isIconCb = block.classList.contains('icon-circle-block');
  const isTableB = block.classList.contains('table-block');


  if (isText) {
    block.addEventListener('click', e => {
      e.stopPropagation();
      if (e.shiftKey) {
        if (block.classList.contains('selected')) {
          block.classList.remove('selected');
          if (block._layerItem) { block._layerItem.classList.remove('active'); block._layerItem.style.background = ''; }
        } else {
          block.classList.add('selected');
          if (block._layerItem) block._layerItem.classList.add('active');
        }
        syncSection(block.closest('.section-block'));
        return;
      }
      deselectAll();
      block.classList.add('selected');
      syncSection(block.closest('.section-block'));
      highlightBlock(block, block._layerItem);
      showTextProperties(block);
    });
    block.addEventListener('dblclick', e => {
      e.stopPropagation();
      block.classList.add('editing');
      block.querySelectorAll('[contenteditable]').forEach(el => {
        el.setAttribute('contenteditable', 'true');
        el.focus();
      });
    });
  }

  if (isAsset) {
    block.addEventListener('click', e => {
      e.stopPropagation();
      if (e.shiftKey) {
        if (block.classList.contains('selected')) {
          block.classList.remove('selected');
          if (block._layerItem) { block._layerItem.classList.remove('active'); block._layerItem.style.background = ''; }
        } else {
          block.classList.add('selected');
          if (block._layerItem) block._layerItem.classList.add('active');
        }
        syncSection(block.closest('.section-block'));
        return;
      }
      deselectAll();
      block.classList.add('selected');
      syncSection(block.closest('.section-block'));
      highlightBlock(block, block._layerItem);
      showAssetProperties(block);
    });
    block.addEventListener('dblclick', e => {
      e.stopPropagation();
      if (block.classList.contains('has-image')) {
        enterImageEditMode(block);
      } else {
        triggerAssetUpload(block);
      }
    });
    // 파일 드래그 드롭
    block.addEventListener('dragover', e => {
      if (!e.dataTransfer.types.includes('Files')) return;
      e.preventDefault();
      e.stopPropagation();
      block.classList.add('drag-over');
    });
    block.addEventListener('dragleave', e => {
      if (!block.contains(e.relatedTarget)) block.classList.remove('drag-over');
    });
    block.addEventListener('drop', e => {
      if (!e.dataTransfer.types.includes('Files')) return;
      e.preventDefault();
      e.stopPropagation();
      block.classList.remove('drag-over');
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith('image/')) loadImageToAsset(block, file);
    });
    // 로드/undo 후 has-image 상태 복원
    if (block.classList.contains('has-image')) {
      const overlayBtn = block.querySelector('.asset-overlay-clear');
      if (overlayBtn) overlayBtn.addEventListener('click', e => {
        e.stopPropagation();
        clearAssetImage(block);
      });
      // 수동 편집된 위치/크기 복원 (imgW가 있으면 절대 위치 모드)
      applyImageTransform(block);
      // 수동 편집 없으면 object-fit 적용
      if (!block.dataset.imgW) {
        const img = block.querySelector('.asset-img');
        if (img) img.style.objectFit = block.dataset.fit || 'cover';
      }
    }
  }

  if (isGap) {
    block.addEventListener('click', e => {
      e.stopPropagation();
      deselectAll();
      block.classList.add('selected');
      syncSection(block.closest('.section-block'));
      highlightBlock(block, block._layerItem);
      showGapProperties(block);
    });
  }

  if (isIconCb) {
    block.addEventListener('click', e => {
      e.stopPropagation();
      if (e.shiftKey) {
        block.classList.toggle('selected');
        if (block._layerItem) block._layerItem.classList.toggle('active', block.classList.contains('selected'));
        syncSection(block.closest('.section-block'));
        return;
      }
      deselectAll();
      block.classList.add('selected');
      syncSection(block.closest('.section-block'));
      highlightBlock(block, block._layerItem);
      showIconCircleProperties(block);
    });
  }

  if (isTableB) {
    block.addEventListener('click', e => {
      e.stopPropagation();
      if (e.shiftKey) {
        block.classList.toggle('selected');
        if (block._layerItem) block._layerItem.classList.toggle('active', block.classList.contains('selected'));
        syncSection(block.closest('.section-block'));
        return;
      }
      deselectAll();
      block.classList.add('selected');
      syncSection(block.closest('.section-block'));
      highlightBlock(block, block._layerItem);
      showTableProperties(block);
    });
    // 셀 더블클릭 → contenteditable 활성화
    block.addEventListener('dblclick', e => {
      e.stopPropagation();
      const cell = e.target.closest('th, td');
      if (cell && block.classList.contains('selected')) {
        block.querySelectorAll('[contenteditable="true"]').forEach(el => {
          if (el !== cell) el.setAttribute('contenteditable','false');
        });
        cell.setAttribute('contenteditable','true');
        cell.focus();
        // 커서를 끝으로 이동
        const range = document.createRange();
        range.selectNodeContents(cell);
        range.collapse(false);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
      }
    });
  }

  // hover ↔ layer item
  block.addEventListener('mouseenter', () => { if (block._layerItem) block._layerItem.style.background = '#252525'; });
  block.addEventListener('mouseleave', () => { if (block._layerItem && !block._layerItem.classList.contains('active')) block._layerItem.style.background = ''; });

  // 드래그 이벤트
  const dragTarget = isGap ? block : (block.closest('.row') || block);
  if (dragTarget && !dragTarget._dragBound) {
    dragTarget._dragBound = true;
    dragTarget.setAttribute('draggable', 'true');
    if (isText) block.querySelectorAll('[contenteditable]').forEach(el => el.setAttribute('draggable', 'false'));

    dragTarget.addEventListener('dragstart', e => {
      if (block.classList.contains('editing')) { e.preventDefault(); return; }
      dragSrc = dragTarget;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', '');
      // ghost 이미지 투명 처리 (zoom 왜곡 방지)
      const ghost = document.createElement('div');
      ghost.style.cssText = 'position:fixed;top:-9999px;width:1px;height:1px;';
      document.body.appendChild(ghost);
      e.dataTransfer.setDragImage(ghost, 0, 0);
      setTimeout(() => ghost.remove(), 0);
      requestAnimationFrame(() => dragTarget.classList.add('dragging'));
    });
    dragTarget.addEventListener('dragend', () => {
      dragTarget.classList.remove('dragging');
      clearDropIndicators();
      dragSrc = null;
    });
  }
}

function makeTextBlock(type) {
  const classMap  = { h1:'tb-h1', h2:'tb-h2', body:'tb-body', caption:'tb-caption', label:'tb-label' };
  const labelMap  = { h1:'Heading', h2:'Heading', body:'Body', caption:'Caption', label:'Label' };
  const dataType  = (type==='h1'||type==='h2') ? 'heading' : type;
  const placeholder = { h1:'제목을 입력하세요', h2:'소제목을 입력하세요', body:'본문을 입력하세요', caption:'캡션을 입력하세요', label:'Label' };

  const row = document.createElement('div');
  row.className = 'row'; row.dataset.layout = 'stack';

  const col = document.createElement('div');
  col.className = 'col'; col.dataset.width = '100';

  const tb = document.createElement('div');
  tb.className = 'text-block'; tb.dataset.type = dataType;
  tb.innerHTML = `
    <div class="${classMap[type]}" contenteditable="false">${placeholder[type]}</div>`;

  if (pageSettings.padX > 0) { tb.style.paddingLeft = pageSettings.padX + 'px'; tb.style.paddingRight = pageSettings.padX + 'px'; }
  if (type !== 'label') {
    tb.style.paddingTop = pageSettings.padY + 'px';
    tb.style.paddingBottom = pageSettings.padY + 'px';
  }
  col.appendChild(tb);
  row.appendChild(col);
  return { row, block: tb };
}

function makeAssetBlock() {
  const row = document.createElement('div');
  row.className = 'row'; row.dataset.layout = 'stack';

  const col = document.createElement('div');
  col.className = 'col'; col.dataset.width = '100';

  const ab = document.createElement('div');
  ab.className = 'asset-block';
  ab.dataset.align = 'center';
  ab.style.alignSelf = 'center';
  ab.innerHTML = `
    ${ASSET_SVG}
    <span class="asset-label">에셋을 업로드하거나 드래그하세요</span>`;

  col.appendChild(ab);
  row.appendChild(col);
  return { row, block: ab };
}

function makeGapBlock() {
  const gb = document.createElement('div');
  gb.className = 'gap-block'; gb.dataset.type = 'gap';
  return gb;
}

function makeIconCircleBlock() {
  const row = document.createElement('div');
  row.className = 'row'; row.dataset.layout = 'stack';

  const col = document.createElement('div');
  col.className = 'col'; col.dataset.width = '100';

  const icb = document.createElement('div');
  icb.className = 'icon-circle-block'; icb.dataset.type = 'icon-circle';
  icb.dataset.size = '80';
  icb.dataset.bgColor = '#e8e8e8';
  icb.dataset.border = 'none';
  icb.innerHTML = `
    <div class="icb-circle" style="width:80px;height:80px;background:#e8e8e8;">
      <span class="icb-content">⭐</span>
    </div>
    <div class="icb-label" data-placeholder="라벨 텍스트 (선택)" contenteditable="false"></div>`;

  col.appendChild(icb);
  row.appendChild(col);
  return { row, block: icb };
}

function makeTableBlock() {
  const row = document.createElement('div');
  row.className = 'row'; row.dataset.layout = 'stack';

  const col = document.createElement('div');
  col.className = 'col'; col.dataset.width = '100';

  const tb = document.createElement('div');
  tb.className = 'table-block'; tb.dataset.type = 'table';
  tb.dataset.style = 'default';
  tb.dataset.showHeader = 'true';
  tb.innerHTML = `
    <table class="tb-table">
      <thead>
        <tr><th>항목</th><th>내용</th></tr>
      </thead>
      <tbody>
        <tr><td>소재</td><td>100% 면</td></tr>
        <tr><td>사이즈</td><td>Free</td></tr>
      </tbody>
    </table>`;

  col.appendChild(tb);
  row.appendChild(col);
  return { row, block: tb };
}

/* 섹션 안 삽입 — 하단 Gap Block 바로 앞에 */
function insertBeforeBottomGap(section, el) {
  const inner = section.querySelector('.section-inner');
  const bottomGap = [...inner.querySelectorAll(':scope > .gap-block')].at(-1);
  if (bottomGap) inner.insertBefore(el, bottomGap);
  else inner.appendChild(el);
}

/* 선택된 블록 바로 다음에 삽입, 없으면 하단 Gap 앞에 */
function insertAfterSelected(section, el) {
  const inner = section.querySelector('.section-inner');
  const sel = document.querySelector('.text-block.selected, .asset-block.selected, .gap-block.selected, .icon-circle-block.selected, .table-block.selected');

  if (sel && sel.closest('.section-block') === section) {
    const isGap = sel.classList.contains('gap-block');
    const ref = isGap ? sel : (sel.closest('.row') || sel);
    ref.after(el);
  } else {
    insertBeforeBottomGap(section, el);
  }
}

function showNoSelectionHint() {
  const fp = document.getElementById('floating-panel');
  fp.classList.add('fp-shake');
  setTimeout(() => fp.classList.remove('fp-shake'), 400);
  showToast('⚠️ 섹션 또는 블록을 먼저 선택하세요');
}

function showToast(msg) {
  let t = document.getElementById('editor-toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'editor-toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 2000);
}

function getSectionAlign(sec) {
  const first = sec.querySelector('.text-block .tb-h1, .text-block .tb-h2, .text-block .tb-body');
  if (!first) return null;
  return first.style.textAlign || null;
}

function addTextBlock(type) {
  const sec = getSelectedSection();
  if (!sec) { showNoSelectionHint(); return; }
  pushHistory();
  const { row, block } = makeTextBlock(type);

  // 섹션의 기존 텍스트 정렬 상속
  const align = getSectionAlign(sec);
  if (align) {
    const contentEl = block.querySelector('[class^="tb-"]');
    if (type === 'label') {
      block.style.textAlign = align;
    } else if (contentEl) {
      contentEl.style.textAlign = align;
    }
  }

  insertAfterSelected(sec, row);
  bindBlock(block);
  buildLayerPanel();
  selectSection(sec);
}

function groupSelectedBlocks() {
  const selected = [...document.querySelectorAll('.text-block.selected, .asset-block.selected, .gap-block.selected, .icon-circle-block.selected, .table-block.selected')];
  if (selected.length < 2) return;

  // 같은 섹션의 블록만 그룹
  const sec = selected[0].closest('.section-block');
  if (!selected.every(b => b.closest('.section-block') === sec)) return;

  pushHistory();

  // DOM 순서대로 부모 row/gap 수집 (중복 제거)
  const sectionInner = sec.querySelector('.section-inner');
  const childrenInOrder = [...sectionInner.children];
  const rows = [];
  selected.forEach(b => {
    const row = b.classList.contains('gap-block') ? b : b.closest('.row');
    if (row && !rows.includes(row)) rows.push(row);
  });
  rows.sort((a, b) => childrenInOrder.indexOf(a) - childrenInOrder.indexOf(b));

  // group-block 생성
  const groupCount = sectionInner.querySelectorAll('.group-block').length + 1;
  const groupEl = document.createElement('div');
  groupEl.className = 'group-block';
  groupEl.dataset.name = `Group ${groupCount}`;
  const labelEl = document.createElement('span');
  labelEl.className = 'group-block-label';
  labelEl.textContent = groupEl.dataset.name;
  const groupInner = document.createElement('div');
  groupInner.className = 'group-inner';
  groupEl.appendChild(labelEl);
  groupEl.appendChild(groupInner);

  // 첫 번째 row 자리에 group-block 삽입 후 rows 이동
  rows[0].before(groupEl);
  rows.forEach(row => groupInner.appendChild(row));

  bindGroupDrag(groupEl);
  deselectAll();
  buildLayerPanel();
  selectSection(sec);
}

function addRowBlock() {
  const sec = getSelectedSection();
  if (!sec) { showNoSelectionHint(); return; }
  pushHistory();
  const row = document.createElement('div');
  row.className = 'row';
  row.dataset.layout = 'flex';
  row.dataset.ratioStr = '2*1';

  [0, 1].forEach(() => {
    const col = document.createElement('div');
    col.className = 'col';
    col.style.flex = '1';
    col.dataset.flex = '1';
    col.appendChild(makeColPlaceholder(col));
    row.appendChild(col);
  });

  insertAfterSelected(sec, row);
  buildLayerPanel();
  selectSection(sec);
}

function addAssetBlock() {
  const sec = getSelectedSection();
  if (!sec) { showNoSelectionHint(); return; }
  pushHistory();
  const { row, block } = makeAssetBlock();
  insertAfterSelected(sec, row);
  bindBlock(block);
  buildLayerPanel();
  selectSection(sec);
}

function addGapBlock() {
  const sec = getSelectedSection();
  if (!sec) { showNoSelectionHint(); return; }
  pushHistory();
  const gb = makeGapBlock();
  insertAfterSelected(sec, gb);
  bindBlock(gb);
  buildLayerPanel();
  selectSection(sec);
}

function addIconCircleBlock() {
  const sec = getSelectedSection();
  if (!sec) { showNoSelectionHint(); return; }
  pushHistory();
  const { row, block } = makeIconCircleBlock();
  insertAfterSelected(sec, row);
  bindBlock(block);
  buildLayerPanel();
  selectSection(sec);
}

function addTableBlock() {
  const sec = getSelectedSection();
  if (!sec) { showNoSelectionHint(); return; }
  pushHistory();
  const { row, block } = makeTableBlock();
  insertAfterSelected(sec, row);
  bindBlock(block);
  buildLayerPanel();
  selectSection(sec);
}

function addSection() {
  const canvas  = document.getElementById('canvas');
  const secList = canvas.querySelectorAll('.section-block');
  const newIdx  = secList.length + 1;

  const sec = document.createElement('div');
  sec.className = 'section-block'; sec.dataset.section = newIdx;
  sec.innerHTML = `
    <span class="section-label">Section ${String(newIdx).padStart(2,'0')}</span>
    <div class="section-toolbar">
      <button class="st-btn">↑</button>
      <button class="st-btn">↓</button>
      <button class="st-btn" style="color:#e06c6c;">✕</button>
    </div>
    <div class="section-inner">
      <div class="gap-block" data-type="gap" style="height:100px"></div>
      <div class="row" data-layout="stack">
        <div class="col" data-width="100">
          <div class="text-block" data-type="heading">
            <div class="tb-h2" contenteditable="false">새 섹션 제목</div>
          </div>
        </div>
      </div>
      <div class="row" data-layout="stack">
        <div class="col" data-width="100">
          <div class="asset-block">
            ${ASSET_SVG}
            <span class="asset-label">에셋을 업로드하거나 드래그하세요</span>
          </div>
        </div>
      </div>
      <div class="gap-block" data-type="gap" style="height:100px"></div>
    </div>`;

  const selectedSec = document.querySelector('.section-block.selected');
  if (selectedSec) selectedSec.after(sec);
  else canvas.appendChild(sec);

  // 이벤트 바인딩
  pushHistory();
  sec.addEventListener('click', e => { e.stopPropagation(); selectSection(sec); });
  bindSectionDelete(sec);
  bindSectionOrder(sec);
  bindSectionDropZone(sec);
  bindSectionDrag(sec);
  sec.querySelectorAll('.text-block, .asset-block, .gap-block').forEach(b => bindBlock(b));

  buildLayerPanel();
  selectSection(sec);
  sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ── 플로팅 패널 Text 드롭다운 ── */
function toggleFpDropdown() {
  document.getElementById('fp-text-dropdown').classList.toggle('open');
}
document.addEventListener('click', e => {
  const dd = document.getElementById('fp-text-dropdown');
  if (dd && !dd.contains(e.target)) dd.classList.remove('open');
  const bdw = document.getElementById('branch-dropdown-wrap');
  if (bdw && !bdw.contains(e.target)) bdw.classList.remove('open');
  if (!e.target.closest('.col-add-btn') && !e.target.closest('.col-add-menu')) {
    document.querySelectorAll('.col-add-menu').forEach(m => m.style.display = 'none');
  }
});

/* ══════════════════════════════════════
   저장 / 불러오기
══════════════════════════════════════ */
const SAVE_KEY = 'web-editor-autosave';
const PROJECTS_KEY = 'sangpe-projects';
let autoSaveTimer = null;

/* ── 프로젝트 관리 ── */
const _urlParams = new URLSearchParams(window.location.search);
const CURRENT_PROJECT_ID = _urlParams.get('project');

function loadProjectsList() {
  try { return JSON.parse(localStorage.getItem(PROJECTS_KEY)) || []; } catch { return []; }
}
function saveProjectToList(snapshot) {
  if (!CURRENT_PROJECT_ID) return;
  const list = loadProjectsList();
  const proj = list.find(p => p.id === CURRENT_PROJECT_ID);
  if (proj) {
    proj.snapshot = JSON.parse(snapshot);
    proj.updatedAt = new Date().toISOString();
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(list));
  }
}
function getProjectName() {
  if (!CURRENT_PROJECT_ID) return null;
  const proj = loadProjectsList().find(p => p.id === CURRENT_PROJECT_ID);
  return proj?.name || null;
}
function setProjectName(name) {
  if (!CURRENT_PROJECT_ID) return;
  const list = loadProjectsList();
  const proj = list.find(p => p.id === CURRENT_PROJECT_ID);
  if (proj) { proj.name = name; localStorage.setItem(PROJECTS_KEY, JSON.stringify(list)); }
}

function goHome() {
  window.location.href = 'pages/projects.html';
}

/* ── Page Management ── */
function getCurrentPage() {
  return pages.find(p => p.id === currentPageId) || pages[0];
}

function flushCurrentPage() {
  const page = getCurrentPage();
  if (!page) return;
  page.canvas = getSerializedCanvas();
  page.pageSettings = { ...pageSettings };
}

function switchPage(pageId) {
  if (pageId === currentPageId) return;
  flushCurrentPage();
  _suppressAutoSave = true;
  currentPageId = pageId;
  const page = getCurrentPage();
  if (page.pageSettings) Object.assign(pageSettings, page.pageSettings);
  canvasEl.innerHTML = page.canvas || '';
  canvasEl.querySelectorAll('.text-block-label, .asset-block-label').forEach(el => el.remove());
  rebindAll();
  applyPageSettings();
  deselectAll();
  showPageProperties();
  buildLayerPanel(); // also calls buildFilePageSection
  _suppressAutoSave = false;
  scheduleAutoSave();
}

function addPage() {
  flushCurrentPage();
  const id = 'page_' + Date.now();
  const n = pages.length + 1;
  pages.push({ id, name: `Page ${n}`, label: '', pageSettings: { ...pageSettings }, canvas: '' });
  switchPage(id);
}

function deletePage(pageId) {
  if (pages.length <= 1) { showToast('⚠️ 페이지가 1개 이상이어야 합니다.'); return; }
  const idx = pages.findIndex(p => p.id === pageId);
  if (idx === -1) return;
  const wasActive = pageId === currentPageId;
  pages.splice(idx, 1);
  if (wasActive) {
    const next = pages[Math.min(idx, pages.length - 1)];
    _suppressAutoSave = true;
    currentPageId = next.id;
    if (next.pageSettings) Object.assign(pageSettings, next.pageSettings);
    canvasEl.innerHTML = next.canvas || '';
    canvasEl.querySelectorAll('.text-block-label, .asset-block-label').forEach(el => el.remove());
    rebindAll();
    applyPageSettings();
    deselectAll();
    showPageProperties();
    _suppressAutoSave = false;
  }
  buildLayerPanel();
  scheduleAutoSave();
}

function buildFilePageSection() {
  const container = document.getElementById('page-props-in-file');
  if (!container) return;
  container.innerHTML = '';

  pages.forEach(page => {
    const isActive = page.id === currentPageId;

    const bg = (isActive ? pageSettings.bg : page.pageSettings?.bg) || '#969696';

    const item = document.createElement('div');
    item.className = 'file-page-item' + (isActive ? ' active' : '');
    item.dataset.pageId = page.id;

    // Label badge (left side)
    const labelBadge = document.createElement('select');
    labelBadge.className = 'file-page-label' + (page.label ? ' has-label' : '');
    labelBadge.dataset.label = page.label || '';
    PAGE_LABELS.forEach(l => {
      const opt = document.createElement('option');
      opt.value = l;
      opt.textContent = l || '—';
      opt.selected = (l === (page.label || ''));
      labelBadge.appendChild(opt);
    });
    labelBadge.addEventListener('click', e => e.stopPropagation());
    labelBadge.addEventListener('change', e => {
      e.stopPropagation();
      page.label = labelBadge.value;
      labelBadge.dataset.label = page.label;
      labelBadge.className = 'file-page-label' + (page.label ? ' has-label' : '');
      scheduleAutoSave();
    });

    // Info
    const info = document.createElement('div');
    info.className = 'file-page-info';

    const name = document.createElement('div');
    name.className = 'file-page-name';
    name.textContent = page.name;
    name.title = '더블클릭으로 이름 변경';
    name.addEventListener('dblclick', e => {
      e.stopPropagation();
      name.contentEditable = 'true';
      name.classList.add('editing');
      name.focus();
      document.execCommand('selectAll', false, null);
      name.addEventListener('blur', function commit() {
        name.contentEditable = 'false';
        name.classList.remove('editing');
        const newName = name.textContent.trim() || page.name;
        name.textContent = newName;
        page.name = newName;
        scheduleAutoSave();
        name.removeEventListener('blur', commit);
      }, { once: true });
      name.addEventListener('keydown', function onKey(e2) {
        if (e2.key === 'Enter') { e2.preventDefault(); name.blur(); }
        if (e2.key === 'Escape') { name.textContent = page.name; name.blur(); }
        name.removeEventListener('keydown', onKey);
      });
    });

    info.appendChild(name);

    // Copy button
    const copyBtn = document.createElement('button');
    copyBtn.className = 'file-page-copy';
    copyBtn.innerHTML = '⧉';
    copyBtn.title = '페이지 복사';
    copyBtn.addEventListener('click', e => {
      e.stopPropagation();
      flushCurrentPage();
      const srcPage = pages.find(p => p.id === page.id);
      if (!srcPage) return;
      const newId = 'page_' + Date.now();
      const copy = JSON.parse(JSON.stringify(srcPage)); // deep copy
      copy.id = newId;
      copy.name = srcPage.name + ' 사본';
      const srcIdx = pages.findIndex(p => p.id === page.id);
      pages.splice(srcIdx + 1, 0, copy);
      buildFilePageSection();
      scheduleAutoSave();
    });

    // Delete button
    const delBtn = document.createElement('button');
    delBtn.className = 'file-page-del';
    delBtn.innerHTML = '✕';
    delBtn.title = '페이지 삭제';
    delBtn.addEventListener('click', e => { e.stopPropagation(); deletePage(page.id); });

    item.appendChild(labelBadge);
    item.appendChild(info);
    item.appendChild(copyBtn);
    item.appendChild(delBtn);
    item.addEventListener('click', () => switchPage(page.id));

    // Drag-and-drop reorder
    item.setAttribute('draggable', 'true');
    item.addEventListener('dragstart', e => {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', page.id);
      setTimeout(() => item.classList.add('page-dragging'), 0);
    });
    item.addEventListener('dragend', () => {
      item.classList.remove('page-dragging');
      container.querySelectorAll('.page-drop-indicator').forEach(el => el.remove());
    });
    item.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      container.querySelectorAll('.page-drop-indicator').forEach(el => el.remove());
      const rect = item.getBoundingClientRect();
      const after = e.clientY > rect.top + rect.height / 2;
      const indicator = document.createElement('div');
      indicator.className = 'page-drop-indicator';
      if (after) item.after(indicator);
      else item.before(indicator);
    });
    item.addEventListener('drop', e => {
      e.preventDefault();
      container.querySelectorAll('.page-drop-indicator').forEach(el => el.remove());
      const srcId = e.dataTransfer.getData('text/plain');
      if (srcId === page.id) return;
      const srcIdx = pages.findIndex(p => p.id === srcId);
      const tgtIdx = pages.findIndex(p => p.id === page.id);
      if (srcIdx === -1 || tgtIdx === -1) return;
      const rect = item.getBoundingClientRect();
      const after = e.clientY > rect.top + rect.height / 2;
      const [moved] = pages.splice(srcIdx, 1);
      const insertAt = pages.findIndex(p => p.id === page.id) + (after ? 1 : 0);
      pages.splice(insertAt, 0, moved);
      buildFilePageSection();
      scheduleAutoSave();
    });

    container.appendChild(item);
  });

  const addBtn = document.createElement('button');
  addBtn.className = 'file-page-add';
  addBtn.textContent = '+ 페이지 추가';
  addBtn.addEventListener('click', addPage);
  addBtn.addEventListener('dragover', e => {
    e.preventDefault();
    container.querySelectorAll('.page-drop-indicator').forEach(el => el.remove());
    const indicator = document.createElement('div');
    indicator.className = 'page-drop-indicator';
    addBtn.before(indicator);
  });
  addBtn.addEventListener('drop', e => {
    e.preventDefault();
    container.querySelectorAll('.page-drop-indicator').forEach(el => el.remove());
    const srcId = e.dataTransfer.getData('text/plain');
    const srcIdx = pages.findIndex(p => p.id === srcId);
    if (srcIdx === -1) return;
    const [moved] = pages.splice(srcIdx, 1);
    pages.push(moved);
    buildFilePageSection();
    scheduleAutoSave();
  });
  container.appendChild(addBtn);
}

function getSerializedCanvas() {
  // section data-name 속성 동기화
  canvasEl.querySelectorAll('.section-block').forEach(sec => {
    if (sec._name) sec.dataset.name = sec._name;
  });
  // 핸들/힌트 등 상태 요소는 직렬화에서 제외
  const clone = canvasEl.cloneNode(true);
  clone.querySelectorAll('.block-resize-handle, .img-corner-handle, .img-edit-hint').forEach(el => el.remove());
  return clone.innerHTML;
}

function serializeProject() {
  flushCurrentPage();
  return JSON.stringify({ version: 2, currentPageId, pages });
}

function applyProjectData(data) {
  if (data.version === 2 && Array.isArray(data.pages)) {
    pages = data.pages;
    currentPageId = data.currentPageId || data.pages[0]?.id;
  } else {
    // v1 backward compat
    const id = 'page_1';
    pages = [{ id, name: 'Page 1', label: '', pageSettings: data.pageSettings || { ...pageSettings }, canvas: data.canvas || '' }];
    currentPageId = id;
  }
  const page = getCurrentPage();
  if (page.pageSettings) Object.assign(pageSettings, page.pageSettings);
  canvasEl.innerHTML = page.canvas || '';
  canvasEl.querySelectorAll('.text-block-label, .asset-block-label').forEach(el => el.remove());
  rebindAll();
  applyPageSettings();
  buildLayerPanel(); // also calls buildFilePageSection
  showPageProperties();
}

function applyPageSettings() {
  canvasWrap.style.background = pageSettings.bg;
  canvasEl.style.gap = pageSettings.gap + 'px';
  canvasEl.querySelectorAll('.text-block').forEach(tb => {
    tb.style.paddingLeft  = pageSettings.padX + 'px';
    tb.style.paddingRight = pageSettings.padX + 'px';
  });
  canvasEl.querySelectorAll('.text-block').forEach(tb => {
    if (tb.dataset.type !== 'label') {
      tb.style.paddingTop    = pageSettings.padY + 'px';
      tb.style.paddingBottom = pageSettings.padY + 'px';
    }
  });
}

function rebindAll() {
  canvasEl.querySelectorAll('.section-block').forEach(sec => {
    if (sec.dataset.name) sec._name = sec.dataset.name;
    // 배경 이미지 복원
    if (sec.dataset.bgImg && !sec.style.backgroundImage) {
      sec.style.backgroundImage = `url(${sec.dataset.bgImg})`;
      sec.style.backgroundSize = sec.dataset.bgSize || 'cover';
      sec.style.backgroundPosition = 'center';
      sec.style.backgroundRepeat = 'no-repeat';
    }
    sec.addEventListener('click', e => { e.stopPropagation(); selectSection(sec); });
    bindSectionDelete(sec);
    bindSectionOrder(sec);
    bindSectionDrag(sec);
    bindSectionDropZone(sec);
  });
  canvasEl.querySelectorAll('.text-block, .asset-block, .gap-block').forEach(b => bindBlock(b));
  // group-block 라벨 복원
  canvasEl.querySelectorAll('.group-block').forEach(g => {
    if (!g.querySelector(':scope > .group-block-label')) {
      const lbl = document.createElement('span');
      lbl.className = 'group-block-label';
      lbl.textContent = g.dataset.name || 'Group';
      g.prepend(lbl);
    }
    bindGroupDrag(g);
  });
  // col-placeholder 이벤트 재연결
  canvasEl.querySelectorAll('.col > .col-placeholder').forEach(ph => {
    const col = ph.parentElement;
    const fresh = makeColPlaceholder(col);
    col.replaceChild(fresh, ph);
  });
}

function saveProject() {
  const json = serializeProject();
  localStorage.setItem(SAVE_KEY, json);
  const blob = new Blob([json], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `web-editor-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function loadProjectFile(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const data = JSON.parse(ev.target.result);
      applyProjectData(data);
    } catch { alert('올바른 프로젝트 파일이 아닙니다.'); }
  };
  reader.readAsText(file);
  e.target.value = ''; // 같은 파일 재선택 허용
}

function scheduleAutoSave() {
  if (_suppressAutoSave) return;
  clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(() => {
    const snap = serializeProject();
    localStorage.setItem(SAVE_KEY, snap);
    saveProjectToList(snap);
  }, 1500);
}

// 변경 감지 — canvas MutationObserver
const autoSaveObserver = new MutationObserver(scheduleAutoSave);

/* ── Init ── */
canvasWrap.style.background = pageSettings.bg;
canvasEl.style.gap = pageSettings.gap + 'px';
document.querySelectorAll('.text-block').forEach(tb => {
  if (pageSettings.padX > 0) { tb.style.paddingLeft = pageSettings.padX + 'px'; tb.style.paddingRight = pageSettings.padX + 'px'; }
  if (tb.dataset.type !== 'label') {
    tb.style.paddingTop = pageSettings.padY + 'px';
    tb.style.paddingBottom = pageSettings.padY + 'px';
  }
});

// 프로젝트 로드 (URL ?project=id 우선, 없으면 autosave 폴백)
(function initLoad() {
  // 프로젝트 탭 이름
  const projName = getProjectName();
  if (projName) {
    const tabName = document.getElementById('project-tab-name');
    if (tabName) tabName.textContent = projName;
  }

  // 더블클릭으로 프로젝트 이름 변경
  const tabName = document.getElementById('project-tab-name');
  if (tabName) {
    tabName.addEventListener('dblclick', () => {
      const current = tabName.textContent;
      tabName.contentEditable = 'true';
      tabName.focus();
      document.execCommand('selectAll', false, null);
      tabName.addEventListener('blur', function commit() {
        tabName.contentEditable = 'false';
        const newName = tabName.textContent.trim() || current;
        tabName.textContent = newName;
        setProjectName(newName);
        tabName.removeEventListener('blur', commit);
      }, { once: true });
      tabName.addEventListener('keydown', function onKey(e) {
        if (e.key === 'Enter') { e.preventDefault(); tabName.blur(); }
        if (e.key === 'Escape') { tabName.textContent = current; tabName.blur(); }
        tabName.removeEventListener('keydown', onKey);
      });
    });
  }

  // 데이터 로드
  if (CURRENT_PROJECT_ID) {
    const proj = loadProjectsList().find(p => p.id === CURRENT_PROJECT_ID);
    if (proj?.snapshot) {
      try { applyProjectData(proj.snapshot); return; } catch {}
    }
  }
  const saved = localStorage.getItem(SAVE_KEY);
  if (saved) {
    try { applyProjectData(JSON.parse(saved)); return; } catch {}
  }
  // 새 프로젝트 — 기본 1페이지 초기화
  pages = [{ id: 'page_1', name: 'Page 1', label: '', pageSettings: { ...pageSettings }, canvas: '' }];
  currentPageId = 'page_1';
  buildLayerPanel();
  showPageProperties();
})();

autoSaveObserver.observe(canvasEl, { childList: true, subtree: true, attributes: true, characterData: true });

// 브랜치 시스템 초기화
initBranchStore();

// File 탭 섹션 토글
initFileTabToggle();

// 템플릿 패널 초기 렌더
renderTemplatePanel();

// Cmd+G 그룹 — capture phase로 브라우저 Find Next 보다 먼저 처리
document.addEventListener('keydown', e => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'g') {
    e.preventDefault();
    e.stopImmediatePropagation();
    groupSelectedBlocks();
  }
}, true);

// 초기 스냅샷
pushHistory();

/* 캔버스 — 섹션 드래그 드롭 */
canvasEl.addEventListener('dragover', e => {
  if (!sectionDragSrc) return;
  e.preventDefault();
  clearSectionIndicators();
  const after = getSectionDragAfterEl(canvasEl, e.clientY);
  const indicator = document.createElement('div');
  indicator.className = 'section-drop-indicator';
  if (after) canvasEl.insertBefore(indicator, after);
  else canvasEl.appendChild(indicator);
});
canvasEl.addEventListener('dragleave', e => {
  if (!sectionDragSrc) return;
  if (!canvasEl.contains(e.relatedTarget)) clearSectionIndicators();
});
canvasEl.addEventListener('drop', e => {
  if (!sectionDragSrc) return;
  e.preventDefault();
  const indicator = canvasEl.querySelector('.section-drop-indicator');
  if (indicator) canvasEl.insertBefore(sectionDragSrc, indicator);
  else canvasEl.appendChild(sectionDragSrc);
  clearSectionIndicators();
  buildLayerPanel();
  sectionDragSrc = null;
});

/* ══════════════════════════════════════
   이미지 업로드 (Asset)
══════════════════════════════════════ */
/* ── 이미지 위치/스케일 복원 (로드·undo 후) ── */
function applyImageTransform(ab) {
  const img = ab.querySelector('.asset-img');
  if (!img || !ab.dataset.imgW) return;
  img.style.position  = 'absolute';
  img.style.objectFit = 'cover';
  img.style.width     = ab.dataset.imgW + 'px';
  img.style.height    = 'auto';
  img.style.left      = (parseFloat(ab.dataset.imgX) || 0) + 'px';
  img.style.top       = (parseFloat(ab.dataset.imgY) || 0) + 'px';
}

function enterImageEditMode(ab) {
  if (ab._imgEditing) return;
  const img = ab.querySelector('.asset-img');
  if (!img) return;

  ab._imgEditing = true;
  ab.classList.add('img-editing');
  ab.draggable = false;
  ab.style.overflow = 'visible'; // 핸들이 프레임 밖에 위치할 수 있도록
  const _row = ab.closest('.row');
  if (_row) _row.draggable = false; // 부모 row의 drag가 핸들 mousedown을 가로채지 않도록

  const frameW = ab.offsetWidth;
  const frameH = ab.offsetHeight;

  if (ab.dataset.imgW) {
    applyImageTransform(ab);
  } else {
    const ratio = (img.naturalWidth / img.naturalHeight) || 1;
    const initW = frameW;
    const initH = initW / ratio;
    img.style.position  = 'absolute';
    img.style.width     = initW + 'px';
    img.style.height    = 'auto';
    img.style.left      = '0px';
    img.style.top       = ((frameH - initH) / 2) + 'px';
    ab.dataset.imgW = initW;
    ab.dataset.imgX = 0;
    ab.dataset.imgY = (frameH - initH) / 2;
  }
  img.style.objectFit = 'fill'; // 편집 모드 중 스케일 반영
  img.draggable = false;

  // 우측 패널 — 이미지 편집 프로퍼티
  function renderImgPanel() {
    const x = Math.round(parseFloat(img.style.left) || 0);
    const y = Math.round(parseFloat(img.style.top)  || 0);
    const w = Math.round(img.offsetWidth);
    propPanel.innerHTML = `
      <div class="prop-section">
        <div class="prop-block-label">
          <div class="prop-block-icon">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#888" stroke-width="1.3">
              <rect x="1" y="1" width="10" height="10" rx="1"/>
              <circle cx="4" cy="4" r="1"/>
              <polyline points="11 8 8 5 3 11"/>
            </svg>
          </div>
          <span class="prop-block-name">이미지 편집</span>
        </div>
        <div class="prop-section-title">위치</div>
        <div class="prop-row">
          <span class="prop-label">X</span>
          <input type="number" class="prop-number" id="img-x" style="width:64px" value="${x}">
        </div>
        <div class="prop-row">
          <span class="prop-label">Y</span>
          <input type="number" class="prop-number" id="img-y" style="width:64px" value="${y}">
        </div>
      </div>
      <div class="prop-section">
        <div class="prop-section-title">크기</div>
        <div class="prop-row">
          <span class="prop-label">너비</span>
          <input type="number" class="prop-number" id="img-w" style="width:64px" value="${w}" min="40">
        </div>
        <div class="prop-row">
          <span class="prop-label">높이</span>
          <input type="number" class="prop-number" id="img-h" style="width:64px" value="${Math.round(img.offsetHeight)}" disabled>
        </div>
      </div>
      <div class="prop-section">
        <div class="prop-section-title">정렬</div>
        <div class="prop-row">
          <span class="prop-label">가로</span>
          <div class="prop-align-group">
            <button class="prop-align-btn" id="img-align-hl">←</button>
            <button class="prop-align-btn" id="img-align-hc">↔</button>
            <button class="prop-align-btn" id="img-align-hr">→</button>
          </div>
        </div>
        <div class="prop-row">
          <span class="prop-label">세로</span>
          <div class="prop-align-group">
            <button class="prop-align-btn" id="img-align-vt">↑</button>
            <button class="prop-align-btn" id="img-align-vc">↕</button>
            <button class="prop-align-btn" id="img-align-vb">↓</button>
          </div>
        </div>
      </div>
      <div class="prop-section" style="color:#555;font-size:11px;padding-top:0;">
        Esc 또는 블록 밖 클릭으로 편집 종료
      </div>`;

    document.getElementById('img-x').addEventListener('input', e => {
      img.style.left = (parseInt(e.target.value) || 0) + 'px';
      ab.dataset.imgX = parseInt(e.target.value) || 0;
      syncHandles();
    });
    document.getElementById('img-y').addEventListener('input', e => {
      img.style.top = (parseInt(e.target.value) || 0) + 'px';
      ab.dataset.imgY = parseInt(e.target.value) || 0;
      syncHandles();
    });
    document.getElementById('img-w').addEventListener('input', e => {
      const v = Math.max(40, parseInt(e.target.value) || 40);
      img.style.width = v + 'px';
      ab.dataset.imgW = v;
      syncHandles();
      const hEl = document.getElementById('img-h');
      if (hEl) hEl.value = Math.round(img.offsetHeight);
    });

    const savePos = () => {
      ab.dataset.imgX = parseFloat(img.style.left) || 0;
      ab.dataset.imgY = parseFloat(img.style.top)  || 0;
      syncHandles(); syncPanel();
    };
    const fw = ab.offsetWidth, fh = ab.offsetHeight;
    document.getElementById('img-align-hl').addEventListener('click', () => { img.style.left = '0px'; savePos(); });
    document.getElementById('img-align-hc').addEventListener('click', () => { img.style.left = ((fw - img.offsetWidth)  / 2) + 'px'; savePos(); });
    document.getElementById('img-align-hr').addEventListener('click', () => { img.style.left = (fw - img.offsetWidth)        + 'px'; savePos(); });
    document.getElementById('img-align-vt').addEventListener('click', () => { img.style.top  = '0px'; savePos(); });
    document.getElementById('img-align-vc').addEventListener('click', () => { img.style.top  = ((fh - img.offsetHeight) / 2) + 'px'; savePos(); });
    document.getElementById('img-align-vb').addEventListener('click', () => { img.style.top  = (fh - img.offsetHeight)       + 'px'; savePos(); });
  }

  // 드래그/스케일 후 패널 값 동기화
  function syncPanel() {
    const xEl = document.getElementById('img-x');
    const yEl = document.getElementById('img-y');
    const wEl = document.getElementById('img-w');
    const hEl = document.getElementById('img-h');
    if (xEl) xEl.value = Math.round(parseFloat(img.style.left) || 0);
    if (yEl) yEl.value = Math.round(parseFloat(img.style.top)  || 0);
    if (wEl) wEl.value = Math.round(img.offsetWidth);
    if (hEl) hEl.value = Math.round(img.offsetHeight);
  }

  // 4 모서리 핸들 생성
  const CORNERS = [
    { id: 'tl', cursor: 'nwse-resize' },
    { id: 'tr', cursor: 'nesw-resize' },
    { id: 'bl', cursor: 'nesw-resize' },
    { id: 'br', cursor: 'nwse-resize' },
  ];
  const cornerEls = {};
  CORNERS.forEach(({ id, cursor }) => {
    const h = document.createElement('div');
    h.className = 'img-corner-handle';
    h.style.cursor = cursor;
    h.draggable = false;
    h.addEventListener('dragstart', e => e.preventDefault());
    ab.appendChild(h);
    cornerEls[id] = h;
  });

  const hint = document.createElement('div');
  hint.className = 'img-edit-hint';
  hint.textContent = '드래그: 위치 · 모서리: 크기 · Esc: 완료';
  ab.appendChild(hint);

  // 핸들 위치를 이미지 4 모서리에 동기화
  const HS = 5; // 핸들 절반 크기 (10px / 2)
  function syncHandles() {
    const x = parseFloat(img.style.left) || 0;
    const y = parseFloat(img.style.top)  || 0;
    const w = img.offsetWidth;
    const h = img.offsetHeight;
    const pos = {
      tl: [x - HS,     y - HS    ],
      tr: [x + w - HS, y - HS    ],
      bl: [x - HS,     y + h - HS],
      br: [x + w - HS, y + h - HS],
    };
    Object.entries(pos).forEach(([id, [lx, ly]]) => {
      cornerEls[id].style.left = lx + 'px';
      cornerEls[id].style.top  = ly + 'px';
    });
  }
  syncHandles();

  // 이미지 드래그 (위치)
  function onImgDown(e) {
    if (e.button !== 0) return;
    e.preventDefault(); e.stopPropagation();
    const zs = currentZoom / 100;
    const sx = e.clientX, sy = e.clientY;
    const sl = parseFloat(img.style.left) || 0;
    const st = parseFloat(img.style.top)  || 0;
    function onMove(e) {
      img.style.left = (sl + (e.clientX - sx) / zs) + 'px';
      img.style.top  = (st + (e.clientY - sy) / zs) + 'px';
      syncHandles(); syncPanel();
    }
    function onUp() {
      ab.dataset.imgX = parseFloat(img.style.left) || 0;
      ab.dataset.imgY = parseFloat(img.style.top)  || 0;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  // 모서리 드래그 (스케일 — 반대 모서리 앵커 고정)
  function onCornerDown(e, corner) {
    if (e.button !== 0) return;
    e.preventDefault(); e.stopPropagation();
    const zs      = currentZoom / 100;
    const startX  = e.clientX;
    const startIX = parseFloat(img.style.left) || 0;
    const startIY = parseFloat(img.style.top)  || 0;
    const startW  = img.offsetWidth;
    const startH  = img.offsetHeight;
    const ratio   = startW / startH;
    const isLeft  = corner === 'tl' || corner === 'bl';
    const isTop   = corner === 'tl' || corner === 'tr';

    function onMove(e) {
      const rawDx = (e.clientX - startX) / zs;
      const dx    = isLeft ? -rawDx : rawDx;
      const newW  = Math.max(40, startW + dx);
      const newH  = newW / ratio;
      img.style.width = newW + 'px';
      if (isLeft) img.style.left = (startIX + (startW - newW)) + 'px';
      if (isTop)  img.style.top  = (startIY + (startH - newH)) + 'px';
      syncHandles(); syncPanel();
    }
    function onUp() {
      ab.dataset.imgW = img.offsetWidth;
      ab.dataset.imgX = parseFloat(img.style.left) || 0;
      ab.dataset.imgY = parseFloat(img.style.top)  || 0;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  img.addEventListener('mousedown', onImgDown);
  Object.entries(cornerEls).forEach(([id, el]) => {
    el.addEventListener('mousedown', e => onCornerDown(e, id));
  });

  renderImgPanel();

  ab._imgEditCleanup = () => {
    img.removeEventListener('mousedown', onImgDown);
    Object.values(cornerEls).forEach(h => h.remove());
    hint.remove();
    img.draggable = false;
    ab.draggable = false;
    if (_row) _row.draggable = true; // row draggable 복원
  };

  ab._exitImgEdit = e => { if (!ab.contains(e.target)) exitImageEditMode(ab); };
  ab._exitImgEsc  = e => { if (e.key === 'Escape') exitImageEditMode(ab); };
  setTimeout(() => {
    document.addEventListener('click',   ab._exitImgEdit);
    document.addEventListener('keydown', ab._exitImgEsc);
  }, 0);
}

function exitImageEditMode(ab) {
  if (!ab._imgEditing) return;
  ab._imgEditing = false;
  ab.classList.remove('img-editing');
  const img = ab.querySelector('.asset-img');
  if (img) {
    ab.dataset.imgW = img.offsetWidth;
    ab.dataset.imgX = parseFloat(img.style.left) || 0;
    ab.dataset.imgY = parseFloat(img.style.top)  || 0;
    img.style.objectFit = 'cover';
  }
  ab.style.overflow = 'hidden'; // 프레임 클리핑 복원
  if (ab._imgEditCleanup) { ab._imgEditCleanup(); ab._imgEditCleanup = null; }
  document.removeEventListener('click',   ab._exitImgEdit);
  document.removeEventListener('keydown', ab._exitImgEsc);
  ab._exitImgEdit = null;
  ab._exitImgEsc  = null;
}

function triggerAssetUpload(ab) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = e => {
    const file = e.target.files[0];
    if (file) loadImageToAsset(ab, file);
  };
  input.click();
}

function loadImageToAsset(ab, file) {
  if (!file || !file.type.startsWith('image/')) return;
  exitImageEditMode(ab);
  pushHistory();
  const reader = new FileReader();
  reader.onload = ev => {
    const src = ev.target.result;
    ab.classList.add('has-image');
    ab.dataset.imgSrc = src;
    if (!ab.dataset.fit) ab.dataset.fit = 'cover';
    // 기존 위치/크기 초기화
    delete ab.dataset.imgW;
    delete ab.dataset.imgX;
    delete ab.dataset.imgY;
    ab.innerHTML = `
      <img class="asset-img" src="${src}" draggable="false" style="object-fit:${ab.dataset.fit}">
      <button class="asset-overlay-clear" title="이미지 제거">✕</button>`;
    ab.querySelector('.asset-overlay-clear').addEventListener('click', e => {
      e.stopPropagation();
      clearAssetImage(ab);
    });
    showAssetProperties(ab);
  };
  reader.readAsDataURL(file);
}

function clearAssetImage(ab) {
  exitImageEditMode(ab);
  pushHistory();
  ab.classList.remove('has-image');
  delete ab.dataset.imgSrc;
  delete ab.dataset.fit;
  delete ab.dataset.imgW;
  delete ab.dataset.imgX;
  delete ab.dataset.imgY;
  ab.innerHTML = `
    ${ASSET_SVG}
    <span class="asset-label">에셋을 업로드하거나 드래그하세요</span>`;
  showAssetProperties(ab);
}

/* ══════════════════════════════════════
   내보내기 (Export)
══════════════════════════════════════ */
async function exportSection(sec, format) {
  const fmt = format || 'png';

  // 클론을 transform 밖(body)에 배치해서 html2canvas가 부모 scale 영향 안 받게 함
  const clone = sec.cloneNode(true);
  const cloneLabel   = clone.querySelector('.section-label');
  const cloneToolbar = clone.querySelector('.section-toolbar');
  if (cloneLabel)   cloneLabel.remove();
  if (cloneToolbar) cloneToolbar.remove();
  clone.classList.remove('selected');
  clone.style.cssText += ';position:fixed;top:-99999px;left:0;width:' + CANVAS_W + 'px;margin:0;outline:none;';

  document.body.appendChild(clone);

  const secBg   = sec.style.background || sec.style.backgroundColor || '';
  const bgColor = (secBg && secBg !== 'transparent') ? secBg : (pageSettings.bg || '#ffffff');

  try {
    const canvas = await html2canvas(clone, {
      scale: 1,
      useCORS: true,
      backgroundColor: bgColor,
      logging: false,
    });

    const secList = [...canvasEl.querySelectorAll('.section-block')];
    const idx     = secList.indexOf(sec) + 1;
    const name    = (sec._name || `section-${String(idx).padStart(2,'0')}`).replace(/\s+/g, '-');

    canvas.toBlob(blob => {
      const url = URL.createObjectURL(blob);
      const a   = document.createElement('a');
      a.href = url;
      a.download = `${name}.${fmt}`;
      a.click();
      URL.revokeObjectURL(url);
    }, fmt === 'jpg' ? 'image/jpeg' : 'image/png', 0.95);

  } finally {
    document.body.removeChild(clone);
  }
}

async function exportAllSections(format) {
  const sections = [...canvasEl.querySelectorAll('.section-block')];
  for (const sec of sections) {
    await exportSection(sec, format);
    await new Promise(r => setTimeout(r, 300));
  }
}

/* ══════════════════════════════════════
   디자인 메타데이터 JSON 내보내기
══════════════════════════════════════ */
function exportDesignJSON() {
  let _uid = 0;
  const uid = prefix => `${prefix}_${String(++_uid).padStart(3, '0')}`;

  function rgbToHex(rgb) {
    if (!rgb || rgb === 'transparent' || rgb === '') return null;
    if (rgb.startsWith('#')) return rgb;
    const m = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (!m) return rgb;
    return '#' + [m[1], m[2], m[3]].map(n => parseInt(n).toString(16).padStart(2, '0')).join('');
  }

  // variant별 기본 fontFamily (CSS에서 선언된 값 — getComputedStyle 폴백 문제 방지)
  const VARIANT_FONT = {
    h1:      'Noto Sans KR',
    h2:      'Noto Sans KR',
    body:    'Noto Sans KR',
    caption: 'Noto Sans KR',
    label:   'Noto Sans KR',
  };

  function extractTextStyle(innerEl) {
    if (!innerEl) return {};
    const cs = getComputedStyle(innerEl);
    const fsz = parseFloat(cs.fontSize);
    const lhRaw = parseFloat(cs.lineHeight);
    const lh = !isNaN(lhRaw) && !isNaN(fsz) && fsz > 0
      ? Math.round((lhRaw / fsz) * 100) / 100
      : null;

    // inline style에 fontFamily가 지정돼 있으면 그것 우선, 아니면 variant 기본값
    const inlineFF = innerEl.style.fontFamily;
    const variant  = (innerEl.className || '').replace('tb-', '');
    const fontFamily = inlineFF
      ? inlineFF.split(',')[0].replace(/["']/g, '').trim()
      : (VARIANT_FONT[variant] || 'Noto Sans KR');

    const style = {
      fontSize:   fsz,
      fontWeight: parseInt(cs.fontWeight),
      color:      rgbToHex(cs.color) || cs.color,
      fontFamily,
      textAlign:  cs.textAlign,
    };
    if (lh !== null) style.lineHeight = lh;
    if (cs.letterSpacing && cs.letterSpacing !== 'normal' && cs.letterSpacing !== '0px') {
      style.letterSpacing = cs.letterSpacing;
    }
    return style;
  }

  function serializeBlock(el) {
    if (el.classList.contains('gap-block')) {
      const h = parseFloat(el.style.height) || 50;
      return { id: uid('gap'), type: 'gap', height: h };
    }

    if (el.classList.contains('text-block')) {
      const inner = el.querySelector('.tb-h1, .tb-h2, .tb-body, .tb-caption, .tb-label');
      const variant = inner ? inner.className.replace('tb-', '') : (el.dataset.type || 'body');
      return {
        id:      uid('txt'),
        type:    'text',
        variant,
        content: inner ? inner.textContent.trim() : '',
        style:   extractTextStyle(inner),
        padding: {
          top:    parseFloat(el.style.paddingTop)    || 0,
          right:  parseFloat(el.style.paddingRight)  || 0,
          bottom: parseFloat(el.style.paddingBottom) || 0,
          left:   parseFloat(el.style.paddingLeft)   || 0,
        },
      };
    }

    if (el.classList.contains('asset-block')) {
      const block = {
        id:    uid('img'),
        type:  'image',
        style: {
          borderRadius: parseFloat(el.style.borderRadius) || 0,
        },
      };
      const h = parseFloat(el.style.height) || 400; // 기본값 400px
      block.height = h;
      if (el.dataset.imgSrc) {
        block.src        = el.dataset.imgSrc;
        block.fit        = el.dataset.fit || 'cover';
        if (el.dataset.imgW) block.imageScale = parseFloat(el.dataset.imgW);
        if (el.dataset.imgX) block.offsetX    = parseFloat(el.dataset.imgX);
        if (el.dataset.imgY) block.offsetY    = parseFloat(el.dataset.imgY);
      }
      return block;
    }
    return null;
  }

  function serializeCol(colEl) {
    const blocks = [];
    colEl.querySelectorAll(':scope > .text-block, :scope > .asset-block, :scope > .gap-block').forEach(b => {
      const s = serializeBlock(b);
      if (s) blocks.push(s);
    });
    return { id: uid('col'), width: parseInt(colEl.dataset.width) || 100, blocks };
  }

  function serializeRow(rowEl) {
    const cols = [];
    rowEl.querySelectorAll(':scope > .col').forEach(col => cols.push(serializeCol(col)));
    return { id: uid('row'), type: 'row', layout: rowEl.dataset.layout || 'stack', columns: cols };
  }

  function serializeSection(secEl, idx) {
    const rawBg = secEl.style.background || secEl.style.backgroundColor || '';
    const bg    = rgbToHex(rawBg) || pageSettings.bg || '#ffffff';
    const inner = secEl.querySelector('.section-inner');
    const blocks = [];

    if (inner) {
      [...inner.children].forEach(child => {
        if (child.classList.contains('gap-block')) {
          blocks.push(serializeBlock(child));
        } else if (child.classList.contains('row')) {
          blocks.push(serializeRow(child));
        } else if (child.classList.contains('group-block')) {
          const groupRows = [];
          child.querySelectorAll(':scope > .group-inner > .row').forEach(r => groupRows.push(serializeRow(r)));
          blocks.push({
            id:   uid('grp'),
            type: 'group',
            name: child.dataset.name || 'Group',
            rows: groupRows,
          });
        }
      });
    }

    const result = {
      id:         uid('sec'),
      name:       secEl._name || secEl.dataset.name || `Section ${idx + 1}`,
      background: bg,
      blocks,
    };
    if (secEl.dataset.preset) result.stylePreset = secEl.dataset.preset;
    return result;
  }

  const sections = [];
  canvasEl.querySelectorAll(':scope > .section-block').forEach((sec, i) => {
    sections.push(serializeSection(sec, i));
  });

  const output = {
    schema: 'sangpe-design-v1',
    meta: {
      exportedAt:  new Date().toISOString().split('T')[0],
      canvasWidth: CANVAS_W,
      theme: {
        background:  pageSettings.bg  || '#ffffff',
        fontFamily:  'Noto Sans KR',
        sectionGap:  pageSettings.gap  ?? 0,
        paddingX:    pageSettings.padX ?? 0,
        paddingY:    pageSettings.padY ?? 0,
      },
    },
    sections,
  };

  const blob = new Blob([JSON.stringify(output, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'design-export.json';
  a.click();
  URL.revokeObjectURL(a.href);
}

/* ══════════════════════════════════════
   피그마 JSON 내보내기
══════════════════════════════════════ */
function exportFigmaJSON() {
  // 현재 페이지를 pages 배열에 반영
  flushCurrentPage();

  const parser = new DOMParser();

  function parseHeight(el) {
    return parseFloat(el.style.height) || 0;
  }

  function parseBlock(el, ps) {
    // gap-block
    if (el.classList.contains('gap-block')) {
      return { type: 'gap', height: parseHeight(el) || 50 };
    }

    // text-block
    if (el.classList.contains('text-block')) {
      const inner = el.querySelector('.tb-h1, .tb-h2, .tb-body, .tb-caption, .tb-label');
      if (!inner) return null;
      const cls = inner.className;
      const text = inner.textContent.trim();

      // letterSpacing: inline style px 문자열 → 숫자
      let letterSpacing;
      const lsRaw = inner.style.letterSpacing;
      if (lsRaw && lsRaw !== 'normal') {
        const lsVal = parseFloat(lsRaw);
        if (!isNaN(lsVal)) letterSpacing = lsVal;
      }

      // padding (pageSettings.padX fallback)
      const padX = ps ? (ps.padX || 0) : 0;
      const padding = {
        top:    parseFloat(el.style.paddingTop)    || 0,
        right:  parseFloat(el.style.paddingRight)  || padX,
        bottom: parseFloat(el.style.paddingBottom) || 0,
        left:   parseFloat(el.style.paddingLeft)   || padX,
      };

      const base = {
        text,
        padding,
        ...(letterSpacing !== undefined ? { letterSpacing } : {}),
      };

      if (cls.includes('tb-h1')) return { type: 'heading', tag: 'h1', ...base };
      if (cls.includes('tb-h2')) return { type: 'heading', tag: 'h2', ...base };
      if (cls.includes('tb-body'))    return { type: 'body',    ...base };
      if (cls.includes('tb-caption')) return { type: 'caption', ...base };
      if (cls.includes('tb-label'))   return { type: 'label',   ...base };
      return { type: 'body', ...base };
    }

    // asset-block
    if (el.classList.contains('asset-block')) {
      const h = parseHeight(el) || 400;
      const src = el.dataset.imgSrc || null;
      const padX = ps ? (ps.padX || 0) : 0;
      const padding = {
        top:    parseFloat(el.style.paddingTop)    || 0,
        right:  parseFloat(el.style.paddingRight)  || padX,
        bottom: parseFloat(el.style.paddingBottom) || 0,
        left:   parseFloat(el.style.paddingLeft)   || padX,
      };
      // col width는 parseCol에서 주입
      return { type: 'asset', src, height: h, padding };
    }

    return null;
  }

  function parseCol(colEl, ps) {
    const width = parseInt(colEl.dataset.width) || 100;
    const blocks = [];
    colEl.querySelectorAll(':scope > .text-block, :scope > .asset-block, :scope > .gap-block').forEach(b => {
      const block = parseBlock(b, ps);
      if (block) {
        if (block.type === 'asset') block.width = width;
        blocks.push(block);
      }
    });
    return { width, blocks };
  }

  function parseRow(rowEl, ps) {
    const layout = rowEl.dataset.layout || 'stack';
    const cols = [];
    rowEl.querySelectorAll(':scope > .col').forEach(c => cols.push(parseCol(c, ps)));
    return { layout, cols };
  }

  function parseSection(secEl, idx, ps) {
    const inner = secEl.querySelector('.section-inner');
    const rows = [];
    if (inner) {
      [...inner.children].forEach(child => {
        if (child.classList.contains('row')) {
          rows.push(parseRow(child, ps));
        } else if (child.classList.contains('group-block')) {
          child.querySelectorAll(':scope > .group-inner > .row').forEach(r => rows.push(parseRow(r, ps)));
        } else if (child.classList.contains('gap-block')) {
          const h = parseFloat(child.style.height) || 50;
          rows.push({ layout: 'stack', cols: [{ width: 100, blocks: [{ type: 'gap', height: h }] }] });
        }
      });
    }
    // 빈 blocks 배열 rows 제거
    const filteredRows = rows.filter(r => r.cols.some(c => c.blocks.length > 0));

    const name = secEl.dataset.name || secEl._name
      || secEl.querySelector('.section-label')?.textContent?.trim()
      || `Section ${idx + 1}`;
    const bg = secEl.style.backgroundColor || secEl.style.background || '';

    return { index: idx + 1, name, bg, rows: filteredRows };
  }

  function parsePage(page) {
    const doc = parser.parseFromString(
      `<div id="canvas">${page.canvas || ''}</div>`, 'text/html'
    );
    const canvasDiv = doc.getElementById('canvas');
    const ps = page.pageSettings || {};
    const sections = [];
    canvasDiv.querySelectorAll(':scope > .section-block').forEach((sec, i) => {
      sections.push(parseSection(sec, i, ps));
    });
    return {
      name:     page.name  || 'Page',
      label:    page.label || '',
      bg:       (ps.bg)    || '#ffffff',
      sections,
    };
  }

  const exportPages = pages.map(p => parsePage(p));

  const output = {
    source:  'sangpe-wizard',
    version: 1,
    pages:   exportPages,
  };

  const blob = new Blob([JSON.stringify(output, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'sangpe_export.json';
  a.click();
  URL.revokeObjectURL(a.href);
}

function exportHTMLFile() {
  // canvas clone — 에디터 UI 요소 제거
  const clone = canvasEl.cloneNode(true);
  clone.querySelectorAll('.section-label, .section-toolbar, .col-placeholder, .col-add-btn, .col-add-menu, .row-drop-indicator, .layer-section-drop-indicator').forEach(el => el.remove());
  clone.querySelectorAll('[contenteditable]').forEach(el => el.removeAttribute('contenteditable'));
  clone.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
  clone.querySelectorAll('.dragging').forEach(el => el.classList.remove('dragging'));

  const fontLink = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;600;700&family=Noto+Serif+KR:wght@400;600;700&family=Inter:wght@400;600;700&family=Playfair+Display:wght@400;700&family=Space+Grotesk:wght@400;600;700&display=swap" rel="stylesheet">`;

  const bg = pageSettings.bg || '#ffffff';
  const css = `
*{box-sizing:border-box;margin:0;padding:0;}
body{background:${bg};font-family:'Noto Sans KR',sans-serif;}
#canvas{width:${CANVAS_W}px;margin:0 auto;}
/* layout */
.section-block{position:relative;width:100%;}
.section-inner{display:flex;flex-direction:column;}
.row{position:relative;display:flex;width:100%;}
.row[data-layout="stack"]{flex-direction:column;}
.row[data-layout="flex"]{flex-direction:row;gap:8px;align-items:stretch;}
.row[data-layout="grid"]{display:grid;gap:8px;}
.col{position:relative;min-width:0;display:flex;flex-direction:column;}
.col[data-width="100"]{flex:100;}
.col[data-width="75"]{flex:75;}
.col[data-width="66"]{flex:66;}
.col[data-width="50"]{flex:50;}
.col[data-width="33"]{flex:33;}
.col[data-width="25"]{flex:25;}
/* gap */
.gap-block{display:block;width:100%;}
/* text */
.text-block{width:100%;}
.tb-h1{font-size:104px;font-weight:700;color:#111;line-height:1.1;letter-spacing:-0.02em;}
.tb-h2{font-size:72px;font-weight:600;color:#1a1a1a;line-height:1.15;}
.tb-body{font-size:36px;color:#555;line-height:1.6;}
.tb-caption{font-size:26px;color:#999;line-height:1.6;letter-spacing:0.01em;}
.tb-label{display:inline-block;background:#111;color:#fff;font-size:22px;font-weight:600;padding:6px 18px;border-radius:4px;}
/* asset */
.asset-block{width:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;overflow:hidden;position:relative;}
.asset-block .asset-icon,.asset-block .asset-label{display:none;}
.asset-block.has-image{overflow:hidden;}
.asset-block.has-image img{display:block;max-width:100%;height:auto;}
/* group */
.group-block{width:100%;}
.group-inner{display:flex;flex-direction:column;}
`;

  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Export</title>
${fontLink}
<style>${css}</style>
</head>
<body>
<div id="canvas">
${clone.innerHTML}
</div>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'export.html';
  a.click();
  URL.revokeObjectURL(a.href);
}

/* ── Publish Dropdown ── */
function togglePublishDropdown(e) {
  e.stopPropagation();
  document.getElementById('publish-dropdown-wrap').classList.toggle('open');
}
function closePublishDropdown() {
  document.getElementById('publish-dropdown-wrap').classList.remove('open');
}
function doPublish() {
  closePublishDropdown();
  alert('Publish 기능은 준비 중입니다.');
}
document.addEventListener('click', e => {
  if (!e.target.closest('#publish-dropdown-wrap')) closePublishDropdown();
});

/* 레이어 패널 — 섹션 순서 변경 */
const layerPanelBody = document.getElementById('layer-panel-body');
layerPanelBody.addEventListener('dragover', e => {
  if (!layerSectionDragSrc) return;
  e.preventDefault();
  clearLayerSectionIndicators();
  const after = getLayerSectionDragAfterEl(layerPanelBody, e.clientY);
  const indicator = document.createElement('div');
  indicator.className = 'layer-section-drop-indicator';
  if (after) layerPanelBody.insertBefore(indicator, after);
  else layerPanelBody.appendChild(indicator);
});
layerPanelBody.addEventListener('dragleave', e => {
  if (!layerSectionDragSrc) return;
  if (!layerPanelBody.contains(e.relatedTarget)) clearLayerSectionIndicators();
});
layerPanelBody.addEventListener('drop', e => {
  if (!layerSectionDragSrc) return;
  e.preventDefault();
  const { sec } = layerSectionDragSrc;
  const indicator = layerPanelBody.querySelector('.layer-section-drop-indicator');
  if (indicator) {
    const nextLayerSec = indicator.nextElementSibling;
    if (nextLayerSec && nextLayerSec._canvasSec) {
      canvasEl.insertBefore(sec, nextLayerSec._canvasSec);
    } else {
      canvasEl.appendChild(sec);
    }
  }
  clearLayerSectionIndicators();
  buildLayerPanel();
  layerSectionDragSrc = null;
});

/* ══════════════════════════════════════════════════════
   PREVIEW MODE
══════════════════════════════════════════════════════ */

let _previewScrollHandler = null;
let _previewEscHandler    = null;

function enterPreview() {
  flushCurrentPage();

  const overlay   = document.getElementById('preview-overlay');
  const content   = document.getElementById('preview-content');
  const navigator = document.getElementById('preview-navigator');

  content.innerHTML   = '';
  navigator.innerHTML = '';

  const rootStyles = getComputedStyle(document.documentElement);
  const presetVars = [
    '--preset-h1-color','--preset-h1-family',
    '--preset-h2-color','--preset-h2-family',
    '--preset-body-color','--preset-body-family',
    '--preset-caption-color',
    '--preset-label-bg','--preset-label-color','--preset-label-radius',
  ].map(v => `${v}:${rootStyles.getPropertyValue(v)}`).join(';');

  pages.forEach((page, idx) => {
    const ps   = page.id === currentPageId ? pageSettings : (page.pageSettings || pageSettings);
    const bg   = ps.bg   || '#969696';
    const gap  = ps.gap  != null ? ps.gap  : 20;
    const padY = ps.padY != null ? ps.padY : 0;

    const block = document.createElement('div');
    block.className = 'preview-page-block';
    block.dataset.pageIdx = idx;
    block.style.background   = bg;
    block.style.paddingTop    = padY + 'px';
    block.style.paddingBottom = padY + 'px';

    const inner = document.createElement('div');
    inner.className = 'preview-page-inner';
    inner.style.gap = gap + 'px';
    inner.setAttribute('style', inner.getAttribute('style') + ';--inv-zoom:1;' + presetVars);

    inner.innerHTML = page.canvas || '';

    block.appendChild(inner);
    content.appendChild(block);

    const label  = page.label || page.name || ('Page ' + (idx + 1));
    const navBtn = document.createElement('button');
    navBtn.className       = 'preview-nav-btn' + (idx === 0 ? ' active' : '');
    navBtn.dataset.pageIdx = idx;
    navBtn.textContent     = label;
    navBtn.addEventListener('click', () => {
      block.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    navigator.appendChild(navBtn);
  });

  document.body.classList.add('preview-mode');
  overlay.scrollTop = 0;

  const designBtn  = document.getElementById('mode-design-btn');
  const previewBtn = document.getElementById('mode-preview-btn');
  if (designBtn)  designBtn.classList.remove('active');
  if (previewBtn) previewBtn.classList.add('active');

  _previewScrollHandler = () => _updatePreviewNav(overlay);
  overlay.addEventListener('scroll', _previewScrollHandler);

  _previewEscHandler = e => { if (e.key === 'Escape') exitPreview(); };
  document.addEventListener('keydown', _previewEscHandler);
}

function exitPreview() {
  document.body.classList.remove('preview-mode');

  const designBtn  = document.getElementById('mode-design-btn');
  const previewBtn = document.getElementById('mode-preview-btn');
  if (designBtn)  designBtn.classList.add('active');
  if (previewBtn) previewBtn.classList.remove('active');

  const overlay = document.getElementById('preview-overlay');
  if (_previewScrollHandler) {
    overlay.removeEventListener('scroll', _previewScrollHandler);
    _previewScrollHandler = null;
  }
  if (_previewEscHandler) {
    document.removeEventListener('keydown', _previewEscHandler);
    _previewEscHandler = null;
  }

  document.getElementById('preview-content').innerHTML   = '';
  document.getElementById('preview-navigator').innerHTML = '';
}

function _updatePreviewNav(overlay) {
  const blocks    = [...overlay.querySelectorAll('.preview-page-block')];
  const scrollMid = overlay.scrollTop + overlay.clientHeight * 0.4;

  let activeIdx = 0;
  blocks.forEach((block, idx) => {
    if (block.offsetTop <= scrollMid) activeIdx = idx;
  });

  document.querySelectorAll('.preview-nav-btn').forEach((btn, idx) => {
    btn.classList.toggle('active', idx === activeIdx);
  });
}

/* ═══════════════════════════════════════════════════════
   ANIMATION GIF ENGINE
═══════════════════════════════════════════════════════ */

const ANIM_LIST = [
  { id: 'slide-up',     label: '슬라이드업',     desc: '아래→위로 올라오며 등장' },
  { id: 'typewriter',   label: '타이핑',          desc: '한 글자씩 입력되듯 등장' },
  { id: 'slot-machine', label: '슬롯머신',        desc: '숫자가 롤링되다 멈춤' },
  { id: 'fade-in',      label: '페이드인',        desc: '투명→불투명 부드럽게' },
  { id: 'word-pop',     label: '단어별 순차등장', desc: '단어 하나씩 팝인' },
  { id: 'glow-pulse',   label: '글로우 펄스',     desc: '빛이 번쩍이며 강조' },
  { id: 'count-up',     label: '카운트업',        desc: '0부터 목표 숫자까지 카운팅' },
];

let _animTb        = null;
let _animType      = 'slide-up';
let _animRafId     = null;
let _animTimeoutId = null;   // setTimeout 전용 (cancelAnimationFrame과 분리)
let _animStart     = null;
let _animLoops     = 0;

function openAnimModal(tb) {
  _animTb = tb;
  const modal = document.getElementById('anim-gif-modal');
  modal.style.display = 'flex';
  _buildAnimList();
  _selectAnim('slide-up');
}

function closeAnimModal() {
  document.getElementById('anim-gif-modal').style.display = 'none';
  _stopAnimPreview();
}

function _buildAnimList() {
  const list = document.getElementById('anim-list');
  list.innerHTML = ANIM_LIST.map(a => `
    <div class="anim-item${a.id === _animType ? ' active' : ''}" data-id="${a.id}">
      <div class="anim-item-name">${a.label}</div>
      <div class="anim-item-desc">${a.desc}</div>
    </div>
  `).join('');
  list.querySelectorAll('.anim-item').forEach(el => {
    el.addEventListener('click', () => _selectAnim(el.dataset.id));
  });
}

function _selectAnim(id) {
  _animType = id;
  document.querySelectorAll('.anim-item').forEach(el =>
    el.classList.toggle('active', el.dataset.id === id));
  _startAnimPreview();
}

function restartAnimPreview() {
  _startAnimPreview();
}

function _stopAnimPreview() {
  if (_animRafId)     { cancelAnimationFrame(_animRafId); _animRafId = null; }
  if (_animTimeoutId) { clearTimeout(_animTimeoutId); _animTimeoutId = null; }
  _animStart = null;
  _animLoops = 0;
}

function _getTextStyle(tb) {
  const el = tb.querySelector('[contenteditable]');
  const cs = window.getComputedStyle(el);
  return {
    text:          (el.innerText || el.textContent || 'Sample Text').trim(),
    fontSize:      parseFloat(cs.fontSize)    || 24,
    color:         cs.color                   || '#111111',
    fontFamily:    cs.fontFamily              || 'sans-serif',
    fontWeight:    cs.fontWeight              || '400',
    letterSpacing: parseFloat(cs.letterSpacing) || 0,
  };
}

function _startAnimPreview() {
  _stopAnimPreview();
  if (!_animTb) return;
  const canvas = document.getElementById('anim-preview-canvas');
  const ctx    = canvas.getContext('2d');
  const style  = _getTextStyle(_animTb);
  const speed  = parseFloat(document.getElementById('anim-speed')?.value  || 1);
  const repeat = parseInt(document.getElementById('anim-repeat')?.value   || 1);
  const W = canvas.width, H = canvas.height;

  // Scale font to fit canvas (max 56px)
  const displaySize = Math.min(56, Math.round(style.fontSize));
  const duration    = 1200 / speed; // ms for one cycle

  _animLoops = 0;

  function tick(ts) {
    if (!_animStart) _animStart = ts;
    const elapsed = ts - _animStart;
    const t       = Math.min(elapsed / duration, 1);

    ctx.clearRect(0, 0, W, H);
    _drawFrame(ctx, W, H, style, displaySize, _animType, t);

    if (t < 1) {
      _animRafId = requestAnimationFrame(tick);
    } else {
      _animLoops++;
      if (_animLoops < repeat) {
        // 루프 간 300ms 대기 (카운트업 등 마지막 값 인식 시간)
        _animTimeoutId = setTimeout(() => {
          _animTimeoutId = null;
          _animStart = null;
          _animRafId = requestAnimationFrame(tick);
        }, 300);
      } else {
        // hold 1500ms then restart loop
        _animTimeoutId = setTimeout(() => {
          _animTimeoutId = null;
          _animLoops = 0;
          _animStart = null;
          _animRafId = requestAnimationFrame(tick);
        }, 1500);
      }
    }
  }
  _animRafId = requestAnimationFrame(tick);
}

function _drawFrame(ctx, W, H, style, displaySize, animType, t) {
  const cx   = W / 2;
  const cy   = H / 2;
  const text = style.text;

  ctx.font        = `${style.fontWeight} ${displaySize}px ${style.fontFamily}`;
  ctx.textBaseline = 'middle';
  ctx.textAlign    = 'center';
  try { ctx.letterSpacing = style.letterSpacing + 'px'; } catch(e) {}

  switch (animType) {

    /* ── 슬라이드업 ── */
    case 'slide-up': {
      const offset = (1 - _easeOut(t)) * H * 0.45;
      ctx.save();
      ctx.globalAlpha = _easeInOut(t);
      ctx.fillStyle   = style.color;
      ctx.fillText(text, cx, cy + offset);
      ctx.restore();
      break;
    }

    /* ── 타이핑 ── */
    case 'typewriter': {
      const n = Math.floor(t * text.length);
      ctx.fillStyle = style.color;
      ctx.fillText(text.slice(0, n), cx, cy);
      // cursor blink
      if (t < 1) {
        const tw   = ctx.measureText(text.slice(0, n)).width;
        const curX = cx + tw / 2 + 2;
        ctx.fillRect(curX, cy - displaySize * 0.45, 2, displaySize * 0.9);
      }
      break;
    }

    /* ── 슬롯머신 ── */
    case 'slot-machine': {
      const numMatch = text.match(/\d+/);
      if (!numMatch) {
        // non-numeric: just use slide-up fallback
        const offset = (1 - _easeOut(t)) * H * 0.4;
        ctx.save(); ctx.globalAlpha = t;
        ctx.fillStyle = style.color;
        ctx.fillText(text, cx, cy + offset);
        ctx.restore();
        break;
      }
      const target  = parseInt(numMatch[0]);
      const current = Math.floor(target * _easeOut(t));
      const display = text.replace(/\d+/, current.toString());
      // rolling offset: digits fall from top
      const rollY = (1 - _easeOut(t)) * displaySize * 1.5;
      ctx.save();
      ctx.rect(0, cy - displaySize, W, displaySize * 2);
      ctx.clip();
      ctx.fillStyle = style.color;
      ctx.fillText(display, cx, cy + rollY);
      // ghost above
      ctx.globalAlpha = 0.3 * (1 - t);
      ctx.fillText(text.replace(/\d+/, (target + 10).toString()), cx, cy + rollY - displaySize * 1.2);
      ctx.restore();
      break;
    }

    /* ── 페이드인 ── */
    case 'fade-in': {
      ctx.save();
      ctx.globalAlpha = _easeInOut(t);
      ctx.fillStyle   = style.color;
      ctx.fillText(text, cx, cy);
      ctx.restore();
      break;
    }

    /* ── 단어별 순차등장 ── */
    case 'word-pop': {
      const words = text.split(/\s+/).filter(w => w);
      if (!words.length) break;

      ctx.textAlign = 'left';
      const spaceW  = ctx.measureText(' ').width;
      const widths  = words.map(w => ctx.measureText(w).width);
      const totalW  = widths.reduce((s, w) => s + w, 0) + spaceW * (words.length - 1);
      let x = cx - totalW / 2;

      words.forEach((word, i) => {
        const prog  = Math.max(0, Math.min(1, t * words.length - i));
        const alpha = prog;
        const sc    = 0.6 + 0.4 * _easeOut(prog);
        const wx    = x + widths[i] / 2;

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(wx, cy);
        ctx.scale(sc, sc);
        ctx.fillStyle = style.color;
        ctx.fillText(word, -widths[i] / 2, 0);
        ctx.restore();

        x += widths[i] + spaceW;
      });
      break;
    }

    /* ── 글로우 펄스 ── */
    case 'glow-pulse': {
      // 2 full pulses across t 0→1
      const phase  = t * Math.PI * 4;
      const glow   = 0.5 + 0.5 * Math.sin(phase);
      ctx.save();
      ctx.shadowColor = style.color;
      ctx.shadowBlur  = 4 + 32 * glow;
      ctx.globalAlpha = 0.6 + 0.4 * glow;
      ctx.fillStyle   = style.color;
      ctx.fillText(text, cx, cy);
      ctx.restore();
      break;
    }

    /* ── 카운트업 ── */
    case 'count-up': {
      const numMatch = text.match(/\d+/);
      const target   = numMatch ? parseInt(numMatch[0]) : 100;
      const current  = Math.floor(target * _easeOut(t));
      const display  = numMatch ? text.replace(/\d+/, current.toString()) : current.toString();
      // slight scale bounce on last frame
      const scale    = t === 1 ? 1 : (1 + 0.05 * Math.sin(t * Math.PI * 8) * (1 - t));
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(scale, scale);
      ctx.fillStyle = style.color;
      ctx.fillText(display, 0, 0);
      ctx.restore();
      break;
    }
  }
}

function _easeOut(t)   { return 1 - Math.pow(1 - t, 3); }
function _easeInOut(t) { return t < 0.5 ? 2*t*t : 1 - Math.pow(-2*t+2, 2)/2; }

/* ── GIF 내보내기 ── */
async function exportAnimGif() {
  if (!_animTb) return;

  const btn = document.querySelector('.anim-export-btn');
  btn.disabled    = true;
  btn.textContent = '생성 중...';

  try {
    const style  = _getTextStyle(_animTb);
    const speed  = parseFloat(document.getElementById('anim-speed')?.value  || 1);
    const repeat = parseInt(document.getElementById('anim-repeat')?.value   || 1);

    // 2x 해상도 캔버스
    const W = 960, H = 320;
    const offCanvas  = document.createElement('canvas');
    offCanvas.width  = W;
    offCanvas.height = H;
    const ctx = offCanvas.getContext('2d');

    const displaySize = Math.min(96, Math.round(style.fontSize * 2));
    const duration    = 1200 / speed; // ms
    const fps         = 20;
    const frames      = Math.ceil((duration / 1000) * fps);
    const delay       = Math.round(1000 / fps);

    const gif = new GIF({
      workers:      2,
      quality:      8,
      width:        W,
      height:       H,
      workerScript: 'js/gif.worker.js',
      repeat:       repeat <= 1 ? 0 : repeat - 1,
    });

    for (let i = 0; i <= frames; i++) {
      const t = i / frames;
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, W, H);
      _drawFrame(ctx, W, H, style, displaySize, _animType, t);
      gif.addFrame(ctx, { copy: true, delay });
    }
    // 마지막 값에서 1.5초 정지 (카운트업 등 UX)
    const holdFrames = Math.ceil(fps * 1.5);
    for (let i = 0; i < holdFrames; i++) {
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, W, H);
      _drawFrame(ctx, W, H, style, displaySize, _animType, 1);
      gif.addFrame(ctx, { copy: true, delay });
    }

    gif.on('finished', blob => {
      const a    = document.createElement('a');
      a.href     = URL.createObjectURL(blob);
      a.download = 'sangpe_animation.gif';
      a.click();
      URL.revokeObjectURL(a.href);
      showToast('✅ GIF 저장 완료!');
      btn.disabled    = false;
      btn.innerHTML   = `<svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 1v7M3 5l3 4 3-4"/><path d="M1 10h10"/></svg> GIF 저장`;
    });

    gif.render();

  } catch (err) {
    console.error('GIF export error:', err);
    alert('GIF 생성 중 오류가 발생했습니다: ' + err.message);
    btn.disabled    = false;
    btn.textContent = 'GIF 저장';
  }
}
