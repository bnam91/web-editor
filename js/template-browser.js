/* ═══════════════════════════════════
   TEMPLATE BROWSER PANEL (T39)
═══════════════════════════════════ */

let _browserOpen      = false;
let _browserFilter    = { folder: '전체', category: '전체' };
let _browserSelected  = null;   // 현재 선택된 tpl id
let _browserSearchQ   = '';

function openTemplateBrowser() {
  const panel = document.getElementById('tpl-browser');
  if (!panel) return;
  _browserOpen = true;
  panel.style.display = 'flex';
  requestAnimationFrame(() => panel.classList.add('open'));
  document.getElementById('templates-section-header')?.classList.add('browser-open');
  _renderBrowserTree();
  _renderBrowserCards();
  document.getElementById('tpl-browser-search')?.focus();
}

function closeTemplateBrowser() {
  const panel = document.getElementById('tpl-browser');
  if (!panel) return;
  panel.classList.remove('open');
  document.getElementById('templates-section-header')?.classList.remove('browser-open');
  panel.addEventListener('transitionend', () => {
    if (!_browserOpen) panel.style.display = 'none';
  }, { once: true });
  _browserOpen = false;
}

function toggleTemplateBrowser() {
  _browserOpen ? closeTemplateBrowser() : openTemplateBrowser();
}

/* ── 트리 렌더 ── */
function _renderBrowserTree() {
  const tree = document.getElementById('tpl-browser-tree');
  if (!tree) return;
  const templates = loadTemplates();

  // 폴더 → 카테고리 계층 구조 계산
  const folderMap = {};
  templates.forEach(t => {
    const f = t.folder || '기타';
    const c = t.category || '기타';
    if (!folderMap[f]) folderMap[f] = {};
    if (!folderMap[f][c]) folderMap[f][c] = 0;
    folderMap[f][c]++;
  });

  const totalCount = templates.length;
  let html = `
    <div class="tb-tree-item tb-tree-all ${_browserFilter.folder === '전체' ? 'active' : ''}"
         data-folder="전체" data-cat="전체">
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.5">
        <rect x="1" y="2" width="8" height="7" rx="1"/><path d="M3 2V1.5a1 1 0 011-1h2a1 1 0 011 1V2"/>
      </svg>
      <span class="tb-tree-label">전체</span>
      <span class="tb-tree-count">${totalCount}</span>
    </div>`;

  Object.entries(folderMap).forEach(([folder, cats]) => {
    const folderTotal = Object.values(cats).reduce((a, b) => a + b, 0);
    const folderActive = _browserFilter.folder === folder;
    const isExpanded = folderActive || Object.keys(folderMap).length <= 3;

    html += `
    <div class="tb-tree-folder ${isExpanded ? 'expanded' : ''}" data-folder="${_esc(folder)}">
      <div class="tb-tree-folder-header ${folderActive && _browserFilter.category === '전체' ? 'active' : ''}"
           data-folder="${_esc(folder)}" data-cat="전체">
        <svg class="tb-tree-chevron" width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="currentColor" stroke-width="1.8">
          <polyline points="2,2 6,4 2,6"/>
        </svg>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M1 3.5h8v5a1 1 0 01-1 1H2a1 1 0 01-1-1V3.5z"/>
          <path d="M1 3.5l1.3-2h3.4l1.3 2"/>
        </svg>
        <span class="tb-tree-label">${_esc(folder)}</span>
        <span class="tb-tree-count">${folderTotal}</span>
      </div>
      <div class="tb-tree-cats">`;

    Object.entries(cats).forEach(([cat, cnt]) => {
      const catActive = folderActive && _browserFilter.category === cat;
      html += `
        <div class="tb-tree-cat ${catActive ? 'active' : ''}"
             data-folder="${_esc(folder)}" data-cat="${_esc(cat)}">
          <span class="tb-tree-dot"></span>
          <span class="tb-tree-label">${_esc(cat)}</span>
          <span class="tb-tree-count">${cnt}</span>
        </div>`;
    });

    html += `</div></div>`;
  });

  tree.innerHTML = html;

  // 이벤트
  tree.querySelectorAll('[data-folder]').forEach(el => {
    if (el.classList.contains('tb-tree-folder')) return; // 폴더 컨테이너 자체는 스킵
    el.addEventListener('click', e => {
      e.stopPropagation();
      const folder = el.dataset.folder;
      const cat    = el.dataset.cat;
      _browserFilter = { folder, category: cat };
      _browserSelected = null;
      _hidePreview();
      _renderBrowserTree();
      _renderBrowserCards();
    });
  });

  // 폴더 헤더 chevron 클릭 → 접기/펼치기
  tree.querySelectorAll('.tb-tree-chevron').forEach(chevron => {
    chevron.addEventListener('click', e => {
      e.stopPropagation();
      const folderEl = chevron.closest('.tb-tree-folder');
      folderEl?.classList.toggle('expanded');
    });
  });
}

/* ── 카드 렌더 ── */
function _renderBrowserCards() {
  const container = document.getElementById('tpl-browser-cards');
  if (!container) return;
  let templates = loadTemplates();

  // 폴더/카테고리 필터
  if (_browserFilter.folder !== '전체') {
    templates = templates.filter(t => (t.folder || '기타') === _browserFilter.folder);
  }
  if (_browserFilter.category !== '전체') {
    templates = templates.filter(t => (t.category || '기타') === _browserFilter.category);
  }

  // 검색 필터
  if (_browserSearchQ.trim()) {
    const q = _browserSearchQ.toLowerCase();
    templates = templates.filter(t =>
      t.name.toLowerCase().includes(q) ||
      (t.folder || '').toLowerCase().includes(q) ||
      (t.category || '').toLowerCase().includes(q)
    );
  }

  if (!templates.length) {
    container.innerHTML = '<div class="tb-cards-empty">템플릿이 없습니다</div>';
    return;
  }

  container.innerHTML = templates.map(tpl => {
    const isSelected = _browserSelected === tpl.id;
    return `
      <div class="tb-card ${isSelected ? 'selected' : ''}" data-tpl-id="${_esc(tpl.id)}" title="${_esc(tpl.name)}">
        <div class="tb-card-thumb">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#555" stroke-width="1.2">
            <rect x="1" y="1" width="12" height="12" rx="1.5"/>
            <line x1="1" y1="5" x2="13" y2="5"/>
            <line x1="4" y1="1" x2="4" y2="5"/>
          </svg>
        </div>
        <div class="tb-card-info">
          <span class="tb-card-name">${_esc(tpl.name)}</span>
          <span class="tb-card-meta">${_esc(tpl.category || '')}${tpl.folder ? ' · ' + _esc(tpl.folder) : ''}</span>
        </div>
        <div class="tb-card-btns">
          <button class="tb-card-edit-btn" data-tpl-id="${_esc(tpl.id)}" title="수정">
            <svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.6">
              <path d="M1 9 L2.5 5.5 L7.5 0.5 L9.5 2.5 L4.5 7.5 Z"/><line x1="6" y1="2" x2="8" y2="4"/>
            </svg>
          </button>
          <button class="tb-card-del-btn" data-tpl-id="${_esc(tpl.id)}" title="삭제">
            <svg width="9" height="9" viewBox="0 0 9 9" fill="none" stroke="currentColor" stroke-width="1.8">
              <line x1="1" y1="1" x2="8" y2="8"/><line x1="8" y1="1" x2="1" y2="8"/>
            </svg>
          </button>
        </div>
      </div>`;
  }).join('');

  container.querySelectorAll('.tb-card').forEach(card => {
    card.addEventListener('click', e => {
      if (e.target.closest('.tb-card-edit-btn') || e.target.closest('.tb-card-del-btn')) return;
      _selectBrowserTemplate(card.dataset.tplId);
    });
  });

  container.querySelectorAll('.tb-card-edit-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      closeTemplateBrowser();
      startEditTemplate(btn.dataset.tplId);
    });
  });

  container.querySelectorAll('.tb-card-del-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      deleteTemplate(btn.dataset.tplId);
      if (_browserSelected === btn.dataset.tplId) {
        _browserSelected = null;
        _hidePreview();
      }
      _renderBrowserTree();
      _renderBrowserCards();
    });
  });
}

/* ── 미리보기 ── */
async function _selectBrowserTemplate(id) {
  _browserSelected = id;

  // 카드 selected 상태 갱신
  document.querySelectorAll('#tpl-browser-cards .tb-card').forEach(c => {
    c.classList.toggle('selected', c.dataset.tplId === id);
  });

  const tpl = loadTemplates().find(t => t.id === id);
  if (!tpl) return;

  const canvas = await _loadCanvas(id);
  if (!canvas) return;

  const previewCanvas = document.getElementById('tpl-browser-preview-canvas');
  const previewEmpty  = document.getElementById('tpl-browser-preview-empty');
  const previewFooter = document.getElementById('tpl-browser-preview-footer');

  previewEmpty.style.display  = 'none';
  previewCanvas.style.display = 'block';
  previewFooter.style.display = 'flex';

  previewCanvas.innerHTML = canvas;

  // 860px → fit
  const section = previewCanvas.querySelector('.section-block');
  if (section) {
    const CANVAS_W = 860;
    section.style.width = CANVAS_W + 'px';
    section.style.pointerEvents = 'none';
    section.style.userSelect    = 'none';
    requestAnimationFrame(() => {
      const vw = previewCanvas.clientWidth;
      const vh = previewCanvas.clientHeight || 300;
      const sh = section.scrollHeight || 400;
      const scale = Math.min(vw / CANVAS_W, vh / sh, 1);
      section.style.transform       = `scale(${scale})`;
      section.style.transformOrigin = 'top left';
      previewCanvas.style.height    = Math.round(sh * scale) + 'px';
    });
  }

  document.getElementById('tpl-browser-preview-name').textContent = tpl.name;
  document.getElementById('tpl-browser-preview-cat').textContent  = tpl.category || '';

  // Insert 버튼
  const insertBtn = document.getElementById('tpl-browser-insert-btn');
  insertBtn.onclick = async () => {
    const t = loadTemplates().find(x => x.id === id);
    if (t) { closeTemplateBrowser(); await insertTemplate(t); }
  };
}

function _hidePreview() {
  const previewEmpty  = document.getElementById('tpl-browser-preview-empty');
  const previewCanvas = document.getElementById('tpl-browser-preview-canvas');
  const previewFooter = document.getElementById('tpl-browser-preview-footer');
  if (!previewEmpty) return;
  previewEmpty.style.display  = 'flex';
  previewCanvas.style.display = 'none';
  previewFooter.style.display = 'none';
  if (previewCanvas) previewCanvas.innerHTML = '';
}

function _esc(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ── 초기화: 이벤트 바인딩 ── */
function initTemplateBrowser() {
  document.getElementById('tpl-browser-close')?.addEventListener('click', closeTemplateBrowser);

  // Esc 닫기
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && _browserOpen) closeTemplateBrowser();
  });

  // 검색
  document.getElementById('tpl-browser-search')?.addEventListener('input', e => {
    _browserSearchQ = e.target.value;
    _renderBrowserCards();
  });

  // 좌측 패널 Templates 헤더 → 브라우저 토글 (기존 collapsible 대신)
  const tplHeader = document.getElementById('templates-section-header');
  if (tplHeader) {
    tplHeader.style.cursor = 'pointer';
    tplHeader.addEventListener('click', () => toggleTemplateBrowser());
  }
}

window.openTemplateBrowser  = openTemplateBrowser;
window.closeTemplateBrowser = closeTemplateBrowser;
window.toggleTemplateBrowser = toggleTemplateBrowser;
window.initTemplateBrowser  = initTemplateBrowser;
window._renderBrowserTree   = _renderBrowserTree;
window._renderBrowserCards  = _renderBrowserCards;
