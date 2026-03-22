/* ══════════════════════════════════════
   저장 / 불러오기
══════════════════════════════════════ */
const SAVE_KEY = 'web-editor-autosave';
const PROJECTS_KEY = 'sangpe-projects';
let autoSaveTimer = null;
let currentFileName = null; // 현재 세션의 저장 파일명 (null = 최초 저장 전)

/* ── 프로젝트 관리 ── */
const _urlParams = new URLSearchParams(window.location.search);
let activeProjectId = _urlParams.get('project');

const IS_ELECTRON = !!window.electronAPI?.isElectron;

/* ── 탭 상태 ── */
const MAX_TABS = 5;
const TAB_STATE_KEY = 'web-editor-open-tabs';
// [{ id, name, _cache }]  — _cache: 탭 메모리 스냅샷 (즉각 전환용)
let openTabs = [];

function saveTabState() {
  // _cache는 크므로 제외하고 저장
  const slim = openTabs.map(({ id, name }) => ({ id, name }));
  localStorage.setItem(TAB_STATE_KEY, JSON.stringify({ tabs: slim, activeId: activeProjectId }));
}

function renderTabBar() {
  const bar = document.getElementById('tab-bar');
  if (!bar) return;
  bar.innerHTML = openTabs.map(tab => `
    <div class="proj-tab ${tab.id === activeProjectId ? 'active' : ''}"
         data-id="${tab.id}">
      <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.3" opacity="0.6" style="flex-shrink:0">
        <rect x="1" y="1" width="10" height="10" rx="1.5"/>
        <line x1="3.5" y1="4" x2="8.5" y2="4"/><line x1="3.5" y1="6.5" x2="8.5" y2="6.5"/><line x1="3.5" y1="9" x2="6.5" y2="9"/>
      </svg>
      <span class="proj-tab-name">${tab.name}</span>
      <button class="proj-tab-close" onclick="event.stopPropagation();closeTab('${tab.id}')" title="닫기">
        <svg width="7" height="7" viewBox="0 0 8 8" fill="none" stroke="currentColor" stroke-width="1.5">
          <line x1="1" y1="1" x2="7" y2="7"/><line x1="7" y1="1" x2="1" y2="7"/>
        </svg>
      </button>
    </div>`).join('');

  // 탭 클릭 + 드래그 바인딩
  bar.querySelectorAll('.proj-tab').forEach(el => {
    el.addEventListener('click', () => switchTab(el.dataset.id));
    _bindTabDrag(el, bar);
  });

  updateProjectNameDisplay();
}

function updateProjectNameDisplay() {
  const el = document.getElementById('project-name-display');
  if (!el) return;
  const tab = openTabs.find(t => t.id === activeProjectId);
  el.textContent = tab?.name || 'Untitled';
}

function startRenameProject() {
  const display = document.getElementById('project-name-display');
  const input   = document.getElementById('project-name-input');
  if (!display || !input) return;
  input.value = display.textContent;
  display.style.display = 'none';
  input.style.display = 'block';
  input.focus();
  input.select();
}

async function finishRenameProject() {
  const display = document.getElementById('project-name-display');
  const input   = document.getElementById('project-name-input');
  if (!display || !input || input.style.display === 'none') return;
  const newName = input.value.trim() || 'Untitled';
  input.style.display = 'none';
  display.style.display = '';

  const tab = openTabs.find(t => t.id === activeProjectId);
  if (tab) tab.name = newName;
  display.textContent = newName;
  renderTabBar();
  saveTabState();

  // 파일에도 저장
  if (IS_ELECTRON && activeProjectId) {
    const proj = await window.electronAPI.loadProject(activeProjectId);
    if (proj) {
      proj.name = newName;
      proj.updatedAt = new Date().toISOString();
      await window.electronAPI.saveProject(proj);
    }
  } else if (activeProjectId) {
    const list = JSON.parse(localStorage.getItem(PROJECTS_KEY) || '[]');
    const p = list.find(p => p.id === activeProjectId);
    if (p) { p.name = newName; localStorage.setItem(PROJECTS_KEY, JSON.stringify(list)); }
  }
}

function cancelRenameProject() {
  const display = document.getElementById('project-name-display');
  const input   = document.getElementById('project-name-input');
  if (!display || !input) return;
  input.style.display = 'none';
  display.style.display = '';
}

function _bindTabDrag(el, bar) {
  let startX = 0, dragging = false, ghost = null, dragId = null;

  el.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    if (e.target.closest('.proj-tab-close')) return;
    startX = e.clientX;
    dragId = el.dataset.id;

    const onMove = (mv) => {
      const dx = mv.clientX - startX;
      if (!dragging && Math.abs(dx) < 6) return;

      if (!dragging) {
        dragging = true;
        el.classList.add('tab-dragging');

        // 고스트(복사본) 생성
        ghost = el.cloneNode(true);
        ghost.classList.add('tab-ghost');
        ghost.style.left = el.offsetLeft + 'px';
        bar.appendChild(ghost);
      }

      // 고스트 위치 업데이트
      const newLeft = el.offsetLeft + dx;
      ghost.style.left = Math.max(0, newLeft) + 'px';

      // 삽입 위치 계산
      const tabs = [...bar.querySelectorAll('.proj-tab:not(.tab-ghost)')];
      const mouseX = mv.clientX;
      let targetIdx = openTabs.findIndex(t => t.id === dragId);
      tabs.forEach((t, i) => {
        const rect = t.getBoundingClientRect();
        if (mouseX > rect.left + rect.width / 2) targetIdx = i;
      });

      // 드래그 중 순서 미리보기 (DOM 순서 변경 없이 스타일만)
      tabs.forEach((t, i) => t.classList.remove('tab-drop-before', 'tab-drop-after'));
      const fromIdx = openTabs.findIndex(t => t.id === dragId);
      if (targetIdx !== fromIdx) {
        const indicator = tabs[targetIdx];
        if (indicator) {
          indicator.classList.add(targetIdx > fromIdx ? 'tab-drop-after' : 'tab-drop-before');
        }
      }
    };

    const onUp = (up) => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);

      if (!dragging) return;
      dragging = false;
      el.classList.remove('tab-dragging');
      ghost?.remove();
      ghost = null;

      // 최종 삽입 위치 결정
      const tabs = [...bar.querySelectorAll('.proj-tab:not(.tab-ghost)')];
      const mouseX = up.clientX;
      const fromIdx = openTabs.findIndex(t => t.id === dragId);
      let toIdx = fromIdx;
      tabs.forEach((t, i) => {
        const rect = t.getBoundingClientRect();
        if (mouseX > rect.left + rect.width / 2) toIdx = i;
      });

      if (toIdx !== fromIdx) {
        const [moved] = openTabs.splice(fromIdx, 1);
        openTabs.splice(toIdx, 0, moved);
        saveTabState();
      }
      renderTabBar();
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}

async function switchTab(id) {
  if (id === activeProjectId) return;

  // 현재 탭 메모리 캐시 저장 + 파일 비동기 저장
  const curTab = openTabs.find(t => t.id === activeProjectId);
  if (curTab) {
    curTab._cache = serializeProject();
    saveProjectToFile(curTab._cache); // 파일 저장은 await 안 함 (비동기)
  }

  activeProjectId = id;
  history.replaceState(null, '', '?project=' + id);
  renderTabBar();
  saveTabState();

  const targetTab = openTabs.find(t => t.id === id);

  // 메모리 캐시 있으면 즉각 복원 (파일 I/O 없음)
  if (targetTab?._cache) {
    applyProjectData(JSON.parse(targetTab._cache));
    initBranchStore();
    return;
  }

  // 최초 로드: 파일에서 읽기
  let proj = null;
  if (IS_ELECTRON) {
    proj = await window.electronAPI.loadProject(id);
    if (targetTab && proj?.name) targetTab.name = proj.name;
    renderTabBar();
  } else {
    proj = loadProjectsList().find(p => p.id === id) || null;
    if (targetTab && proj?.name) targetTab.name = proj.name;
  }
  if (proj) {
    const data = proj.version === 2 && proj.pages ? proj : proj.snapshot ? JSON.parse(proj.snapshot) : proj;
    if (targetTab) targetTab._cache = JSON.stringify(data);
    applyProjectData(data);
  }
  initBranchStore();
}

async function closeTab(id) {
  const idx = openTabs.findIndex(t => t.id === id);
  if (idx === -1) return;
  if (openTabs.length === 1) { goHome(); return; }
  if (id === activeProjectId) {
    const nextTab = openTabs[idx + 1] || openTabs[idx - 1];
    await switchTab(nextTab.id);
  }
  openTabs = openTabs.filter(t => t.id !== id);
  renderTabBar();
  saveTabState();
}

async function openTabForProject(id) {
  if (openTabs.find(t => t.id === id)) { await switchTab(id); return; }
  if (openTabs.length >= MAX_TABS) {
    showToast(`탭은 최대 ${MAX_TABS}개까지 열 수 있어요`);
    return;
  }
  let name = 'Untitled';
  if (IS_ELECTRON) {
    const proj = await window.electronAPI.loadProject(id);
    if (proj?.name) name = proj.name;
  } else {
    const proj = loadProjectsList().find(p => p.id === id);
    if (proj?.name) name = proj.name;
  }
  openTabs.push({ id, name });
  await switchTab(id);
}

/* ── + 버튼 드롭다운 ── */
async function toggleTabAddMenu(e) {
  e.stopPropagation();
  const wrap = document.getElementById('tab-add-wrap');
  const isOpen = wrap.classList.toggle('open');
  if (!isOpen) return;

  const menu = document.getElementById('tab-add-menu');
  menu.innerHTML = '<div class="tab-add-empty">불러오는 중…</div>';

  let list = [];
  if (IS_ELECTRON) {
    list = await window.electronAPI.listProjects();
  } else {
    try { list = JSON.parse(localStorage.getItem(PROJECTS_KEY)) || []; } catch {}
  }

  // 이미 탭에 열린 프로젝트 제외
  const openIds = new Set(openTabs.map(t => t.id));
  list = list.filter(p => !openIds.has(p.id)).slice(0, 12);

  if (!list.length) {
    menu.innerHTML = `<div class="tab-add-item tab-add-new" onclick="goHome()">
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="5" y1="1" x2="5" y2="9"/><line x1="1" y1="5" x2="9" y2="5"/>
      </svg>
      <span class="tab-add-item-name">새 프로젝트 만들기</span>
    </div>`;
    return;
  }

  menu.innerHTML = list.map(p => {
    const date = new Date(p.updatedAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
    return `<div class="tab-add-item" onclick="openTabForProject('${p.id}');document.getElementById('tab-add-wrap').classList.remove('open')">
      <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.3">
        <rect x="1" y="1" width="10" height="10" rx="1.5"/>
        <line x1="3.5" y1="4" x2="8.5" y2="4"/><line x1="3.5" y1="6.5" x2="8.5" y2="6.5"/><line x1="3.5" y1="9" x2="6.5" y2="9"/>
      </svg>
      <span class="tab-add-item-name">${p.name}</span>
      <span class="tab-add-item-date">${date}</span>
    </div>`;
  }).join('');
}

/* ── 프로젝트 파일 저장 (Electron: projects/{id}.json, 브라우저: localStorage) ── */
async function saveProjectToFile(snapshot) {
  if (!activeProjectId) return;
  const data = typeof snapshot === 'string' ? JSON.parse(snapshot) : snapshot;

  if (IS_ELECTRON) {
    const existing = await window.electronAPI.loadProject(activeProjectId);
    const proj = {
      ...(existing || {}),
      ...data,
      id: activeProjectId,
      name: existing?.name || data.name || 'Untitled',
      updatedAt: new Date().toISOString(),
    };
    await window.electronAPI.saveProject(proj);
  } else {
    const list = JSON.parse(localStorage.getItem(PROJECTS_KEY) || '[]');
    const proj = list.find(p => p.id === activeProjectId);
    if (proj) { proj.snapshot = data; proj.updatedAt = new Date().toISOString(); }
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(list));
  }
}

function loadProjectsList() {
  try { return JSON.parse(localStorage.getItem(PROJECTS_KEY)) || []; } catch { return []; }
}

function getProjectName() {
  if (!activeProjectId) return null;
  if (!IS_ELECTRON) {
    const proj = loadProjectsList().find(p => p.id === activeProjectId);
    return proj?.name || null;
  }
  return openTabs.find(t => t.id === activeProjectId)?.name || null;
}

async function setProjectName(name) {
  if (!activeProjectId) return;
  // 탭 이름 업데이트
  const tab = openTabs.find(t => t.id === activeProjectId);
  if (tab) { tab.name = name; renderTabBar(); }
  if (IS_ELECTRON) {
    const proj = await window.electronAPI.loadProject(activeProjectId);
    if (proj) { proj.name = name; proj.updatedAt = new Date().toISOString(); await window.electronAPI.saveProject(proj); }
  } else {
    const list = loadProjectsList();
    const proj = list.find(p => p.id === activeProjectId);
    if (proj) { proj.name = name; localStorage.setItem(PROJECTS_KEY, JSON.stringify(list)); }
  }
}

function goHome() {
  const curTab = openTabs.find(t => t.id === activeProjectId);
  if (curTab) curTab._cache = serializeProject();
  saveProjectToFile(serializeProject());
  saveTabState();
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
  canvasEl.querySelectorAll('.text-block, .label-group-block').forEach(tb => {
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
    // ⎇ 버튼 없으면 추가, 있으면 onclick 재바인딩 (직렬화 시 프로퍼티가 유실되므로 항상 재설정)
    const toolbar = sec.querySelector('.section-toolbar');
    if (toolbar) {
      // 구버전 ↑ ↓ ✕ 버튼 제거
      toolbar.querySelectorAll('.st-btn:not(.st-branch-btn)').forEach(el => el.remove());
      let branchBtn = toolbar.querySelector('.st-branch-btn');
      if (!branchBtn) {
        branchBtn = document.createElement('button');
        branchBtn.className = 'st-btn st-branch-btn';
        branchBtn.title = 'feature 브랜치로 실험';
        branchBtn.textContent = '⎇';
        toolbar.appendChild(branchBtn);
      }
      branchBtn.onclick = function() { openSectionBranchMenu(this); };
    }
  });
  canvasEl.querySelectorAll('.text-block, .asset-block, .gap-block, .icon-circle-block, .table-block, .label-group-block').forEach(b => {
    if (!b.id) {
      const prefix = b.classList.contains('text-block') ? 'tb'
        : b.classList.contains('asset-block') ? 'ab'
        : b.classList.contains('gap-block') ? 'gb'
        : b.classList.contains('icon-circle-block') ? 'icb'
        : b.classList.contains('label-group-block') ? 'lg' : 'tbl';
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

const LAST_COMMIT_KEY = 'goya-last-commit';

/* ── 인라인 파일명 입력 모달 (prompt() Electron 미지원 대체) ── */
function showFilenameModal(defaultName, onConfirm) {
  const existing = document.getElementById('filename-modal-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'filename-modal-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.45)';

  overlay.innerHTML = `
    <div style="background:#1e1e1e;border:1px solid #3a3a3a;border-radius:10px;padding:20px 24px;min-width:320px;box-shadow:0 8px 32px rgba(0,0,0,0.5)">
      <div style="font-size:13px;color:#ccc;margin-bottom:10px;">파일명을 입력하세요</div>
      <input id="filename-modal-input" type="text" value="${defaultName}"
        style="width:100%;box-sizing:border-box;background:#2a2a2a;border:1px solid #555;border-radius:6px;color:#eee;font-size:13px;padding:7px 10px;outline:none;">
      <div style="display:flex;gap:8px;margin-top:14px;justify-content:flex-end">
        <button id="filename-modal-cancel" style="padding:6px 14px;border-radius:6px;border:1px solid #444;background:#333;color:#aaa;cursor:pointer;font-size:12px;">취소</button>
        <button id="filename-modal-ok" style="padding:6px 14px;border-radius:6px;border:none;background:#4c8aff;color:#fff;cursor:pointer;font-size:12px;">저장</button>
      </div>
    </div>`;

  document.body.appendChild(overlay);
  const input = document.getElementById('filename-modal-input');
  input.select();

  const close = () => overlay.remove();
  const confirm = () => {
    const val = input.value.trim() || defaultName;
    close();
    onConfirm(val);
  };

  document.getElementById('filename-modal-ok').onclick = confirm;
  document.getElementById('filename-modal-cancel').onclick = close;
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') confirm();
    if (e.key === 'Escape') close();
  });
}

/* ── 커밋 모달 ── */
async function saveProject() {
  openCommitModal();
}

function _formatTimeAgo(ts) {
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return '방금 전';
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.floor(h / 24);
  if (d < 8)  return `${d}일 전`;
  return new Date(ts).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
}

async function openCommitModal() {
  document.getElementById('commit-modal-overlay')?.remove();

  let commits = [];
  if (IS_ELECTRON && activeProjectId) {
    const proj = await window.electronAPI.loadProject(activeProjectId);
    commits = proj?.commits || [];
  }

  const branch = (typeof getCurrentBranch === 'function') ? getCurrentBranch() : 'main';
  const tab = openTabs.find(t => t.id === activeProjectId);
  const projectName = tab?.name || 'Untitled';

  const branchColor = b => {
    const c = (typeof getBranchColor === 'function') ? getBranchColor(b) : { dot: '#27ae60', text: '#4ecb7a' };
    const hex = c.dot.replace('#','');
    const r = parseInt(hex.slice(0,2),16), g = parseInt(hex.slice(2,4),16), bl = parseInt(hex.slice(4,6),16);
    return { ...c, bg: `rgba(${r},${g},${bl},0.15)` };
  };

  // 브랜치 필터 탭 목록
  const allBranches = [...new Set(commits.map(c => c.branch || 'main'))];
  const filterTabs = ['전체', ...['main', 'dev', ...allBranches.filter(b => b !== 'main' && b !== 'dev')]
    .filter(b => allBranches.includes(b))];

  const filterTabsHTML = filterTabs.map((b, i) => {
    const col = b === '전체' ? null : branchColor(b);
    const dot = col ? `<span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${col.dot};margin-right:4px;vertical-align:middle"></span>` : '';
    return `<button class="cm-filter-tab ${i === 0 ? 'active' : ''}" data-branch="${b}" onclick="filterCommitHistory(this)">${dot}${b}</button>`;
  }).join('');

  const renderItems = (list) => list.length === 0
    ? '<div class="cm-empty">아직 커밋이 없어요</div>'
    : list.slice().reverse().map(c => {
        const col = branchColor(c.branch);
        return `
        <div class="cm-item">
          <div class="cm-item-dot" style="background:${col.dot};box-shadow:0 0 0 3px ${col.bg}"></div>
          <div class="cm-item-body">
            <span class="cm-item-msg">${c.message}</span>
            <span class="cm-item-meta">
              <span class="cm-item-branch" style="color:${col.text}">${c.branch || 'main'}</span>
              · ${_formatTimeAgo(c.timestamp)}
            </span>
          </div>
          <button class="cm-item-restore" onclick="restoreCommit('${c.id}')" title="이 커밋으로 복원">
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.6">
              <path d="M2 7a5 5 0 1 0 1.5-3.5L2 2v4h4L4.5 4.5"/>
            </svg>
          </button>
        </div>`;
      }).join('');

  const historyHTML = renderItems(commits);

  const overlay = document.createElement('div');
  overlay.id = 'commit-modal-overlay';
  overlay.innerHTML = `
    <div id="commit-modal">
      <div class="cm-header">
        <span class="cm-title">Commit</span>
        <span class="cm-project">${projectName}</span>
        <button class="cm-close" onclick="document.getElementById('commit-modal-overlay').remove()">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.8">
            <line x1="1" y1="1" x2="9" y2="9"/><line x1="9" y1="1" x2="1" y2="9"/>
          </svg>
        </button>
      </div>
      <div class="cm-body">
        <div class="cm-input-wrap">
          <textarea id="cm-msg-input" placeholder="변경사항을 설명해주세요..." rows="2"></textarea>
          <div class="cm-input-footer">
            <span class="cm-branch-badge" style="color:${branchColor(branch).text}">⎇ ${branch}</span>
            <button id="cm-commit-btn" onclick="doCommit()" style="background:${branchColor(branch).dot}">✔ Commit</button>
          </div>
        </div>
        <div class="cm-divider">
          <span>히스토리</span>
        </div>
        <div class="cm-filter-tabs">${filterTabsHTML}</div>
        <div class="cm-history" data-commits='${JSON.stringify(commits)}'>${historyHTML}</div>
      </div>
    </div>`;

  document.body.appendChild(overlay);
  document.getElementById('cm-msg-input').focus();

  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  document.getElementById('cm-msg-input').addEventListener('keydown', e => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) doCommit();
  });
}

function filterCommitHistory(btn) {
  document.querySelectorAll('.cm-filter-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  const selectedBranch = btn.dataset.branch;
  const historyEl = document.querySelector('.cm-history');
  if (!historyEl) return;

  const allCommits = JSON.parse(historyEl.dataset.commits || '[]');
  const filtered = selectedBranch === '전체'
    ? allCommits
    : allCommits.filter(c => (c.branch || 'main') === selectedBranch);

  const branchColor = b => {
    const c = (typeof getBranchColor === 'function') ? getBranchColor(b) : { dot: '#27ae60', text: '#4ecb7a' };
    const hex = c.dot.replace('#','');
    const r = parseInt(hex.slice(0,2),16), g = parseInt(hex.slice(2,4),16), bl = parseInt(hex.slice(4,6),16);
    return { ...c, bg: `rgba(${r},${g},${bl},0.15)` };
  };

  historyEl.innerHTML = filtered.length === 0
    ? '<div class="cm-empty">이 브랜치에 커밋이 없어요</div>'
    : filtered.slice().reverse().map(c => {
        const col = branchColor(c.branch);
        return `
        <div class="cm-item">
          <div class="cm-item-dot" style="background:${col.dot};box-shadow:0 0 0 3px ${col.bg}"></div>
          <div class="cm-item-body">
            <span class="cm-item-msg">${c.message}</span>
            <span class="cm-item-meta">
              <span class="cm-item-branch" style="color:${col.text}">${c.branch || 'main'}</span>
              · ${_formatTimeAgo(c.timestamp)}
            </span>
          </div>
          <button class="cm-item-restore" onclick="restoreCommit('${c.id}')" title="이 커밋으로 복원">
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.6">
              <path d="M2 7a5 5 0 1 0 1.5-3.5L2 2v4h4L4.5 4.5"/>
            </svg>
          </button>
        </div>`;
      }).join('');
}

async function doCommit() {
  const input = document.getElementById('cm-msg-input');
  const message = input?.value.trim();
  if (!message) { input?.classList.add('cm-shake'); setTimeout(() => input?.classList.remove('cm-shake'), 400); return; }

  const snapshot = JSON.parse(serializeProject());
  const branch = (typeof getCurrentBranch === 'function') ? getCurrentBranch() : 'main';
  const commit = {
    id: 'c_' + Date.now(),
    message,
    timestamp: new Date().toISOString(),
    branch,
    snapshot,
  };

  if (IS_ELECTRON && activeProjectId) {
    const proj = await window.electronAPI.loadProject(activeProjectId);
    if (proj) {
      proj.commits = [...(proj.commits || []), commit];
      proj.updatedAt = new Date().toISOString();
      await window.electronAPI.saveProject(proj);
    }
  }

  document.getElementById('commit-modal-overlay')?.remove();
  showToast('✅ Committed — ' + message);
}

async function restoreCommit(id) {
  if (!confirm('이 커밋으로 복원할까요? 현재 변경사항은 자동저장으로 보존돼요.')) return;

  let commit = null;
  if (IS_ELECTRON && activeProjectId) {
    const proj = await window.electronAPI.loadProject(activeProjectId);
    commit = proj?.commits?.find(c => c.id === id);
  }
  if (!commit) { showToast('❌ 커밋을 찾을 수 없어요'); return; }

  document.getElementById('commit-modal-overlay')?.remove();
  applyProjectData(commit.snapshot);
  showToast(`↩ 복원됨 — ${commit.message}`);
}

function saveProjectAs() {
  const json = serializeProject();
  localStorage.setItem(SAVE_KEY, json);

  const defaultName = currentFileName || getProjectName() || `web-editor-${new Date().toISOString().slice(0,10)}`;
  showFilenameModal(defaultName, name => {
    currentFileName = name;
    _downloadJSON(json, currentFileName);
    showToast('✅ 저장됨 — ' + currentFileName);
  });
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
    saveProjectToFile(snap); // 파일 기반 저장 (Electron) 또는 localStorage 폴백
  }, 1500);
}

// 변경 감지 — canvas MutationObserver
const autoSaveObserver = new MutationObserver(scheduleAutoSave);

/* ── Init (called from editor.js after all scripts loaded) ── */
function initApp() {
  // 이미 백업이 있으면 되돌리기 버튼 활성화
  if (localStorage.getItem(LAST_COMMIT_KEY)) {
    const revertBtn = document.getElementById('revert-btn');
    if (revertBtn) revertBtn.classList.add('has-commit');
  }
  canvasWrap.style.background = pageSettings.bg;
  canvasEl.style.gap = pageSettings.gap + 'px';
  document.querySelectorAll('.text-block, .label-group-block').forEach(tb => {
    if (pageSettings.padX > 0) { tb.style.paddingLeft = pageSettings.padX + 'px'; tb.style.paddingRight = pageSettings.padX + 'px'; }
    if (tb.dataset.type !== 'label') {
      tb.style.paddingTop = pageSettings.padY + 'px';
      tb.style.paddingBottom = pageSettings.padY + 'px';
    }
  });

  // 탭 이름 더블클릭 변경 — 탭바 이벤트 위임
  document.getElementById('tab-bar')?.addEventListener('dblclick', e => {
    const nameEl = e.target.closest('.proj-tab-name');
    if (!nameEl) return;
    const tab = nameEl.closest('.proj-tab');
    if (!tab || tab.dataset.id !== activeProjectId) return;
    const current = nameEl.textContent;
    nameEl.contentEditable = 'true';
    nameEl.focus();
    document.execCommand('selectAll', false, null);
    nameEl.addEventListener('blur', function commit() {
      nameEl.contentEditable = 'false';
      const newName = nameEl.textContent.trim() || current;
      nameEl.textContent = newName;
      setProjectName(newName);
      nameEl.removeEventListener('blur', commit);
    }, { once: true });
    nameEl.addEventListener('keydown', function onKey(e) {
      if (e.key === 'Enter') { e.preventDefault(); nameEl.blur(); }
      if (e.key === 'Escape') { nameEl.textContent = current; nameEl.blur(); }
      nameEl.removeEventListener('keydown', onKey);
    });
  });

  // + 드롭다운 — 바깥 클릭 닫기
  document.addEventListener('click', () => {
    document.getElementById('tab-add-wrap')?.classList.remove('open');
  });

  // 프로젝트 로드 (Electron: 파일, 브라우저: localStorage)
  (async function initLoad() {
    function applyAndFinish(data) {
      try { applyProjectData(data); } catch {}
    }
    function initEmpty() {
      pages = [{ id: 'page_1', name: 'Page 1', label: '', pageSettings: { ...pageSettings }, canvas: '' }];
      currentPageId = 'page_1';
      buildLayerPanel();
      showPageProperties();
    }

    // localStorage에서 이전 탭 상태 복원
    try {
      const saved = JSON.parse(localStorage.getItem(TAB_STATE_KEY));
      if (saved?.tabs?.length) openTabs = saved.tabs;
    } catch {}

    if (activeProjectId) {
      // 현재 프로젝트가 탭 목록에 없으면 추가
      if (!openTabs.find(t => t.id === activeProjectId)) {
        openTabs.push({ id: activeProjectId, name: 'Untitled' });
      }
      let name = 'Untitled';
      if (IS_ELECTRON) {
        const proj = await window.electronAPI.loadProject(activeProjectId);
        if (proj) {
          name = proj.name || 'Untitled';
          const tab = openTabs.find(t => t.id === activeProjectId);
          if (tab) tab.name = name;
          renderTabBar();
          if (proj.version === 2 && proj.pages) { applyAndFinish(proj); return; }
          if (proj.snapshot) { applyAndFinish(proj.snapshot); return; }
        }
      } else {
        const proj = loadProjectsList().find(p => p.id === activeProjectId);
        if (proj?.name) {
          name = proj.name;
          const tab = openTabs.find(t => t.id === activeProjectId);
          if (tab) tab.name = name;
        }
        renderTabBar();
        if (proj?.snapshot) { applyAndFinish(proj.snapshot); return; }
      }
    } else {
      openTabs = [];
      renderTabBar();
    }
    const saved = localStorage.getItem(SAVE_KEY);
    if (saved) { try { applyAndFinish(JSON.parse(saved)); return; } catch {} }
    initEmpty();
  })();

  autoSaveObserver.observe(canvasEl, { childList: true, subtree: true, attributes: true, characterData: true });

  // 브랜치 시스템 초기화
  initBranchStore();
  setTimeout(() => applyMainLock(getCurrentBranch()), 100);

  // File 탭 섹션 토글
  initFileTabToggle();

  // 템플릿 패널 초기 렌더 (파일 로드 후)
  initTemplates().then(() => renderTemplatePanel());

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
