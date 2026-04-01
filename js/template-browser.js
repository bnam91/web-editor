/* ═══════════════════════════════════
   TEMPLATE BROWSER PANEL (T39)
═══════════════════════════════════ */

let _browserOpen      = false;
let _browserFilter    = { folder: '전체', category: '전체', tag: null, starred: false };
let _browserSelected  = null;   // 현재 선택된 tpl id
let _browserSearchQ   = '';

/* ── 즐겨찾기 헬퍼 ── */
function _getStarred() {
  try { return new Set(JSON.parse(localStorage.getItem('tpl-starred') || '[]')); }
  catch { return new Set(); }
}
function _setStarred(set) {
  localStorage.setItem('tpl-starred', JSON.stringify([...set]));
}

function openTemplateBrowser() {
  const panel = document.getElementById('tpl-browser');
  if (!panel) return;
  _browserOpen = true;
  panel.style.display = 'flex';
  if (!panel.dataset.userMoved) {
    const leftPanel = document.getElementById('panel-left');
    const leftW = leftPanel ? leftPanel.getBoundingClientRect().width : 240;
    panel.style.left = (leftW + 4) + 'px';
    panel.style.top = '44px';
  }
  requestAnimationFrame(() => panel.classList.add('open'));
  document.getElementById('templates-section-header')?.classList.add('browser-open');
  _renderBrowserTree();
  _renderBrowserCards();
  _syncInsertBtn();
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
  const starredSet = _getStarred();
  const starredCount = templates.filter(t => starredSet.has(t.id)).length;

  let html = `
    <div class="tb-tree-item tb-tree-starred ${_browserFilter.starred ? 'active' : ''}"
         data-action="starred">
      <span class="tb-tree-star-icon">★</span>
      <span class="tb-tree-label">즐겨찾기</span>
      <span class="tb-tree-count">${starredCount}</span>
    </div>
    <div class="tb-tree-item tb-tree-all ${!_browserFilter.starred && _browserFilter.folder === '전체' ? 'active' : ''}"
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

  // 즐겨찾기 항목 클릭
  tree.querySelector('.tb-tree-starred')?.addEventListener('click', e => {
    e.stopPropagation();
    _browserFilter = { folder: '전체', category: '전체', tag: null, starred: true };
    _browserSelected = null;
    _hidePreview();
    _renderBrowserTree();
    _renderBrowserCards();
  });

  // 전체 / 카테고리 클릭 → 필터 적용
  tree.querySelectorAll('.tb-tree-all, .tb-tree-cat').forEach(el => {
    el.addEventListener('click', e => {
      e.stopPropagation();
      _browserFilter = { folder: el.dataset.folder, category: el.dataset.cat, tag: null, starred: false };
      _browserSelected = null;
      _hidePreview();
      _renderBrowserTree();
      _renderBrowserCards();
    });
  });

  // 폴더 헤더 클릭 → 접기/펼치기 + 폴더 전체 필터
  tree.querySelectorAll('.tb-tree-folder-header').forEach(header => {
    header.addEventListener('click', e => {
      e.stopPropagation();
      const folderEl = header.closest('.tb-tree-folder');
      folderEl?.classList.toggle('expanded');
      // 폴더 선택도 적용
      _browserFilter = { folder: header.dataset.folder, category: '전체', tag: null, starred: false };
      _browserSelected = null;
      _hidePreview();
      _renderBrowserCards();
      // 활성 표시만 갱신 (트리 재렌더 없이)
      tree.querySelectorAll('.tb-tree-all, .tb-tree-folder-header, .tb-tree-cat').forEach(el => el.classList.remove('active'));
      header.classList.add('active');
    });
  });
}

/* ── 카드 렌더 ── */
function _renderBrowserCards() {
  const container = document.getElementById('tpl-browser-cards');
  if (!container) return;
  let templates = loadTemplates();

  // 즐겨찾기 필터
  if (_browserFilter.starred) {
    const starred = _getStarred();
    templates = templates.filter(t => starred.has(t.id));
  }

  // 폴더/카테고리 필터
  if (_browserFilter.folder !== '전체') {
    templates = templates.filter(t => (t.folder || '기타') === _browserFilter.folder);
  }
  if (_browserFilter.category !== '전체') {
    templates = templates.filter(t => (t.category || '기타') === _browserFilter.category);
  }

  // 검색 필터 (이름·폴더·카테고리·태그)
  if (_browserSearchQ.trim()) {
    const q = _browserSearchQ.toLowerCase();
    templates = templates.filter(t =>
      t.name.toLowerCase().includes(q) ||
      (t.folder || '').toLowerCase().includes(q) ||
      (t.category || '').toLowerCase().includes(q) ||
      (t.tags || []).some(tag => tag.toLowerCase().includes(q))
    );
  }

  // 태그 칩 목록 렌더링 (태그 필터 적용 전 — 모든 가용 태그를 보여주기 위함)
  _renderTagChips(templates);

  // 태그 칩 필터
  if (_browserFilter.tag) {
    templates = templates.filter(t => (t.tags || []).includes(_browserFilter.tag));
  }

  if (!templates.length) {
    container.innerHTML = '<div class="tb-cards-empty">템플릿이 없습니다</div>';
    return;
  }

  const starred = _getStarred();
  container.innerHTML = templates.map(tpl => {
    const isSelected = _browserSelected === tpl.id;
    const isStarred  = starred.has(tpl.id);
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
          <button class="tb-card-star-btn ${isStarred ? 'starred' : ''}" data-tpl-id="${_esc(tpl.id)}" title="${isStarred ? '즐겨찾기 해제' : '즐겨찾기 추가'}">★</button>
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
      if (e.target.closest('.tb-card-edit-btn') || e.target.closest('.tb-card-del-btn') || e.target.closest('.tb-card-star-btn')) return;
      _selectBrowserTemplate(card.dataset.tplId);
    });

    // 드래그 앤 드롭으로 섹션 추가
    card.addEventListener('mousedown', e => {
      if (e.target.closest('.tb-card-edit-btn') || e.target.closest('.tb-card-del-btn') || e.target.closest('.tb-card-star-btn')) return;
      if (e.button !== 0) return;
      e.preventDefault(); // 네이티브 드래그(SVG 이미지 등) 차단

      const tplId = card.dataset.tplId;
      const tpl = loadTemplates().find(x => x.id === tplId);
      if (!tpl) return;

      const startX = e.clientX, startY = e.clientY;
      let dragging = false;
      let ghost = null;

      const onMove = mv => {
        const dx = mv.clientX - startX, dy = mv.clientY - startY;
        if (!dragging) {
          if (Math.abs(dx) < 3 && Math.abs(dy) < 3) return;
          dragging = true;
          ghost = document.createElement('div');
          ghost.className = 'tpl-card-drag-ghost';
          ghost.textContent = '+ ' + tpl.name;
          document.body.appendChild(ghost);
        }
        if (ghost) {
          ghost.style.left = mv.clientX + 14 + 'px';
          ghost.style.top  = mv.clientY - 12 + 'px';
        }
        // 패널 밖이면 ghost 강조
        const browser = document.getElementById('tpl-browser');
        const r = browser.getBoundingClientRect();
        const outside = mv.clientX < r.left || mv.clientX > r.right ||
                        mv.clientY < r.top  || mv.clientY > r.bottom;
        if (ghost) ghost.style.opacity = outside ? '1' : '0.5';
      };

      const onUp = async up => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        if (ghost) { ghost.remove(); ghost = null; }
        if (!dragging) return;

        const browser = document.getElementById('tpl-browser');
        const r = browser.getBoundingClientRect();
        const outside = up.clientX < r.left || up.clientX > r.right ||
                        up.clientY < r.top  || up.clientY > r.bottom;
        if (outside) {
          closeTemplateBrowser();
          await insertTemplate(tpl);
        }
      };

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  });

  container.querySelectorAll('.tb-card-star-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const id = btn.dataset.tplId;
      const set = _getStarred();
      if (set.has(id)) {
        set.delete(id);
        btn.classList.remove('starred');
        btn.title = '즐겨찾기 추가';
      } else {
        set.add(id);
        btn.classList.add('starred');
        btn.title = '즐겨찾기 해제';
      }
      _setStarred(set);
      // 즐겨찾기 보기 중이면 카드 목록/트리 갱신
      if (_browserFilter.starred) {
        _renderBrowserTree();
        _renderBrowserCards();
      } else {
        // 트리의 즐겨찾기 카운트만 갱신
        _renderBrowserTree();
      }
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

/* ── 태그 칩 렌더 ── */
function _renderTagChips(filteredTemplates) {
  const wrap = document.getElementById('tpl-browser-tag-chips');
  if (!wrap) return;

  // 현재 필터된 템플릿들에서 태그 수집 (태그 필터 적용 전 기준 아님 — 현재 목록 기준)
  const tagSet = new Set();
  filteredTemplates.forEach(t => (t.tags || []).forEach(tag => tagSet.add(tag)));
  const tags = [...tagSet].sort();

  if (!tags.length) {
    wrap.innerHTML = '';
    wrap.style.display = 'none';
    return;
  }

  wrap.style.display = 'flex';
  wrap.innerHTML = tags.map(tag => {
    const isActive = _browserFilter.tag === tag;
    return `<button class="tb-tag-chip ${isActive ? 'active' : ''}" data-tag="${_esc(tag)}">${_esc(tag)}</button>`;
  }).join('');

  wrap.querySelectorAll('.tb-tag-chip').forEach(chip => {
    chip.addEventListener('click', e => {
      e.stopPropagation();
      const tag = chip.dataset.tag;
      // 토글: 이미 활성이면 해제
      _browserFilter.tag = (_browserFilter.tag === tag) ? null : tag;
      _renderBrowserCards();
    });
  });
}

function _syncInsertBtn() {
  const btn = document.getElementById('tpl-browser-insert-btn');
  if (!btn) return;
  btn.disabled = !_browserSelected;
  btn.style.opacity = _browserSelected ? '1' : '0.4';
  btn.style.cursor  = _browserSelected ? 'pointer' : 'default';
}

/* ── 미리보기 ── */
async function _selectBrowserTemplate(id) {
  _browserSelected = id;
  _syncInsertBtn();

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
      const vw = previewCanvas.getBoundingClientRect().width;
      const vh = previewCanvas.getBoundingClientRect().height || 300;
      const sh = section.scrollHeight || 400;
      const scale = Math.min(vw / CANVAS_W, vh / sh, 1);
      const leftOffset = (vw - CANVAS_W * scale) / 2;
      section.style.transform       = `scale(${scale})`;
      section.style.transformOrigin = 'top left';
      section.style.position        = 'relative';
      section.style.left            = Math.max(0, leftOffset) + 'px';
      previewCanvas.style.height    = Math.round(sh * scale) + 'px';
    });
  }

  document.getElementById('tpl-browser-preview-name').textContent = tpl.name;
  document.getElementById('tpl-browser-preview-cat').textContent  = tpl.category || '';
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

  // 헤더 드래그 이동
  const panel = document.getElementById('tpl-browser');
  const header = panel && (panel.querySelector('.tpl-browser-header') || panel.querySelector('.tpl-browser-top'));
  if (header && !header._dragBound) {
    header._dragBound = true;
    header.style.cursor = 'grab';
    header.addEventListener('mousedown', e => {
      if (e.target.closest('button, input, select')) return;
      e.preventDefault();
      const rect = panel.getBoundingClientRect();
      const offsetX = e.clientX - rect.left;
      const offsetY = e.clientY - rect.top;
      header.style.cursor = 'grabbing';
      const onMove = mv => {
        const newLeft = Math.max(0, Math.min(window.innerWidth - panel.offsetWidth, mv.clientX - offsetX));
        const newTop  = Math.max(0, Math.min(window.innerHeight - 60, mv.clientY - offsetY));
        panel.style.left = newLeft + 'px';
        panel.style.top  = newTop  + 'px';
        panel.dataset.userMoved = '1';
      };
      const onUp = () => {
        header.style.cursor = 'grab';
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup',   onUp);
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup',   onUp);
    });
  }

  // Esc 닫기
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && _browserOpen) closeTemplateBrowser();
  });

  // 캔버스 영역 클릭 시 닫기
  document.getElementById('canvas-area')?.addEventListener('mousedown', () => {
    if (_browserOpen) closeTemplateBrowser();
  });

  // 검색
  document.getElementById('tpl-browser-search')?.addEventListener('input', e => {
    _browserSearchQ = e.target.value;
    _renderBrowserCards();
  });

  // 섹션 추가 버튼 (항상 존재, 선택된 템플릿 기준으로 삽입)
  document.getElementById('tpl-browser-insert-btn')?.addEventListener('click', async () => {
    if (!_browserSelected) return;
    const t = loadTemplates().find(x => x.id === _browserSelected);
    if (t) { closeTemplateBrowser(); await insertTemplate(t); }
  });

  // 좌측 패널 Templates 헤더 → 브라우저 토글 (기존 collapsible 대신)
  const tplHeader = document.getElementById('templates-section-header');
  if (tplHeader) {
    tplHeader.style.cursor = 'pointer';
    tplHeader.addEventListener('click', () => toggleTemplateBrowser());
  }

  // 미리보기 리사이즈 핸들
  const resizeHandle = document.getElementById('tpl-preview-resize-handle');
  const previewArea  = document.getElementById('tpl-browser-preview-area');
  if (resizeHandle && previewArea) {
    resizeHandle.addEventListener('mousedown', e => {
      e.preventDefault();
      e.stopPropagation();
      const startY  = e.clientY;
      const startH  = previewArea.getBoundingClientRect().height;

      const onMove = mv => {
        const newH = Math.max(80, Math.min(520, startH + mv.clientY - startY));
        previewArea.style.flex = `0 0 ${newH}px`;
      };
      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        document.body.style.cursor = '';
        // 스케일 재계산
        const canvas = document.getElementById('tpl-browser-preview-canvas');
        if (canvas && canvas.style.display !== 'none') {
          const section = canvas.querySelector('.section-block');
          if (section) {
            const CANVAS_W = 860;
            const vw = canvas.getBoundingClientRect().width;
            const vh = canvas.getBoundingClientRect().height || 300;
            const sh = section.scrollHeight || 400;
            const scale = Math.min(vw / CANVAS_W, vh / sh, 1);
            const leftOffset = (vw - CANVAS_W * scale) / 2;
            section.style.transform  = `scale(${scale})`;
            section.style.left       = Math.max(0, leftOffset) + 'px';
            canvas.style.height      = Math.round(sh * scale) + 'px';
          }
        }
      };

      document.body.style.cursor = 'ns-resize';
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  }
}

window.openTemplateBrowser  = openTemplateBrowser;
window.closeTemplateBrowser = closeTemplateBrowser;
window.toggleTemplateBrowser = toggleTemplateBrowser;
window.initTemplateBrowser  = initTemplateBrowser;
window._renderBrowserTree   = _renderBrowserTree;
window._renderBrowserCards  = _renderBrowserCards;
window._renderTagChips      = _renderTagChips;
