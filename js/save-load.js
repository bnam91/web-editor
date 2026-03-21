/* ══════════════════════════════════════
   저장 / 불러오기
══════════════════════════════════════ */
const SAVE_KEY = 'web-editor-autosave';
const PROJECTS_KEY = 'sangpe-projects';
let autoSaveTimer = null;
let currentFileName = null; // 현재 세션의 저장 파일명 (null = 최초 저장 전)

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
    if (!sec.id) sec.id = 'sec_' + Math.random().toString(36).slice(2, 9);
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
  canvasEl.querySelectorAll('.text-block, .asset-block, .gap-block, .icon-circle-block, .table-block').forEach(b => {
    if (!b.id) {
      const prefix = b.classList.contains('text-block') ? 'tb'
        : b.classList.contains('asset-block') ? 'ab'
        : b.classList.contains('gap-block') ? 'gb'
        : b.classList.contains('icon-circle-block') ? 'icb' : 'tbl';
      b.id = prefix + '_' + Math.random().toString(36).slice(2, 9);
    }
    bindBlock(b);
  });
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

function _downloadJSON(json, filename) {
  const blob = new Blob([json], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename.endsWith('.json') ? filename : filename + '.json';
  a.click();
  URL.revokeObjectURL(a.href);
}

function saveProject() {
  const json = serializeProject();
  localStorage.setItem(SAVE_KEY, json);

  if (!currentFileName) {
    // 최초 저장: 파일명 입력 다이얼로그
    const defaultName = getProjectName() || `web-editor-${new Date().toISOString().slice(0,10)}`;
    const name = prompt('파일명을 입력하세요', defaultName);
    if (name === null) return; // 취소
    currentFileName = name.trim() || defaultName;
  }

  _downloadJSON(json, currentFileName);
  showToast('✅ 저장됨 — ' + currentFileName);
}

function saveProjectAs() {
  const json = serializeProject();
  localStorage.setItem(SAVE_KEY, json);

  const defaultName = currentFileName || getProjectName() || `web-editor-${new Date().toISOString().slice(0,10)}`;
  const name = prompt('다른 이름으로 저장', defaultName);
  if (name === null) return; // 취소
  const trimmed = name.trim() || defaultName;
  currentFileName = trimmed;

  _downloadJSON(json, currentFileName);
  showToast('✅ 저장됨 — ' + currentFileName);
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

/* ── Init (called from editor.js after all scripts loaded) ── */
function initApp() {
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
}
