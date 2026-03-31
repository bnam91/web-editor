/* ══════════════════════════════════════
   TAB SYSTEM — 프로젝트 탭 관리
   (save-load.js에서 분리, 2025-03-31)

   의존성 접근:
   - window.activeProjectId  (save-load.js defineProperty getter/setter)
   - window.openTabs         (save-load.js defineProperty getter/setter)
   - window.IS_ELECTRON      (save-load.js)
   - window.serializeProject, window.saveProjectToFile, window.applyProjectData
   - window.loadProjectsList, window.goHome
   - window.initBranchStore  (branch-system.js)
   - window.buildLayerPanel, window.showToast
══════════════════════════════════════ */

/* ── 상수 ── */
const MAX_TABS = 5;
const TAB_STATE_KEY = 'web-editor-open-tabs';

/* ── 헬퍼: openTabs / activeProjectId 접근 ── */
function _getTabs()   { return window.openTabs; }
function _setTabs(v)  { window.openTabs = v; }
function _getActId()  { return window.activeProjectId; }
function _setActId(v) { window.activeProjectId = v; }

function saveTabState() {
  // _cache는 크므로 제외하고 저장
  const slim = _getTabs().map(({ id, name }) => ({ id, name }));
  localStorage.setItem(TAB_STATE_KEY, JSON.stringify({ tabs: slim, activeId: _getActId() }));
}

function renderTabBar() {
  const bar = document.getElementById('tab-bar');
  if (!bar) return;
  bar.innerHTML = _getTabs().map(tab => `
    <div class="proj-tab ${tab.id === _getActId() ? 'active' : ''}"
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
  const tab = _getTabs().find(t => t.id === _getActId());
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

  const tab = _getTabs().find(t => t.id === _getActId());
  if (tab) tab.name = newName;
  display.textContent = newName;
  renderTabBar();
  saveTabState();

  // 파일에도 저장
  const IS_ELECTRON = window.IS_ELECTRON;
  const activeProjectId = _getActId();
  const PROJECTS_KEY = 'sangpe-projects';
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
      let targetIdx = _getTabs().findIndex(t => t.id === dragId);
      tabs.forEach((t, i) => {
        const rect = t.getBoundingClientRect();
        if (mouseX > rect.left + rect.width / 2) targetIdx = i;
      });

      // 드래그 중 순서 미리보기 (DOM 순서 변경 없이 스타일만)
      tabs.forEach((t, i) => t.classList.remove('tab-drop-before', 'tab-drop-after'));
      const fromIdx = _getTabs().findIndex(t => t.id === dragId);
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
      const openTabs = _getTabs();
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
  if (id === _getActId()) return;
  window.switchScratch?.(id); // 스크래치패드 — 현재 저장 후 새 프로젝트 로드

  // 현재 탭 메모리 캐시 저장 + 파일 비동기 저장
  const openTabs = _getTabs();
  const curTab = openTabs.find(t => t.id === _getActId());
  const prevProjectId = _getActId(); // activeProjectId 변경 전 캡처 (S10 race condition 방지)
  if (curTab) {
    curTab._cache = window.serializeProject();
    window.saveProjectToFile(curTab._cache, { skipThumbnail: true, projectId: prevProjectId }); // 파일 저장은 await 안 함 (비동기)
  }

  _setActId(id);
  history.replaceState(null, '', '?project=' + id);

  // 이미지 편집 모드 리스너 정리 (메모리 누수 방지)
  const canvasEl = document.getElementById('canvas');
  if (canvasEl) {
    canvasEl.querySelectorAll('.pos-dragging').forEach(ab => {
      if (ab._posDragCleanup) { ab._posDragCleanup(); ab._posDragCleanup = null; }
      if (ab._exitPosDrag)    { document.removeEventListener('click', ab._exitPosDrag); ab._exitPosDrag = null; }
      if (ab._exitPosDragEsc) { document.removeEventListener('keydown', ab._exitPosDragEsc); ab._exitPosDragEsc = null; }
      ab._posDragging = false;
    });
  }
  // 즉시 캔버스 클리어 (이전 탭 내용이 잠깐 보이지 않도록)
  // autoSaveObserver가 빈 캔버스를 파일에 덮어쓰지 않도록 억제
  window.state._suppressAutoSave = true;
  if (canvasEl) canvasEl.innerHTML = '';
  // propPanel 클리어 — 이전 탭의 속성 패널 내용이 잔존하지 않도록
  const propPanel = document.querySelector('#panel-right .panel-body');
  if (propPanel) propPanel.innerHTML = '';
  if (window.buildLayerPanel) window.buildLayerPanel();

  renderTabBar();
  saveTabState();

  const targetTab = openTabs.find(t => t.id === id);

  // 메모리 캐시 있으면 즉각 복원 (파일 I/O 없음)
  if (targetTab?._cache) {
    window.applyProjectData(JSON.parse(targetTab._cache));
    window.state._suppressAutoSave = false;
    window.initBranchStore();
    requestAnimationFrame(() => { if (window.buildLayerPanel) window.buildLayerPanel(); });
    return;
  }

  // 최초 로드: 파일에서 읽기
  let proj = null;
  if (window.IS_ELECTRON) {
    proj = await window.electronAPI.loadProject(id);
    if (targetTab && proj?.name) targetTab.name = proj.name;
    renderTabBar();
  } else {
    proj = window.loadProjectsList().find(p => p.id === id) || null;
    if (targetTab && proj?.name) targetTab.name = proj.name;
  }
  if (proj) {
    const data = proj.version === 2 && proj.pages ? proj : proj.snapshot ? JSON.parse(proj.snapshot) : proj;
    if (targetTab) targetTab._cache = JSON.stringify(data);
    window.applyProjectData(data);
  } else {
    // 프로젝트 없으면 캔버스 초기화
    if (canvasEl) canvasEl.innerHTML = '';
    if (window.buildLayerPanel) window.buildLayerPanel();
  }
  window.state._suppressAutoSave = false;
  window.initBranchStore();
}

async function closeTab(id) {
  const openTabs = _getTabs();
  const idx = openTabs.findIndex(t => t.id === id);
  if (idx === -1) return;
  if (openTabs.length === 1) { _setTabs([]); saveTabState(); window.goHome(); return; }
  if (id === _getActId()) {
    const nextTab = openTabs[idx + 1] || openTabs[idx - 1];
    await switchTab(nextTab.id);
  }
  _setTabs(_getTabs().filter(t => t.id !== id));
  renderTabBar();
  saveTabState();
}

async function openTabForProject(id) {
  if (_getTabs().find(t => t.id === id)) { await switchTab(id); return; }
  if (_getTabs().length >= MAX_TABS) {
    window.showToast?.(`탭은 최대 ${MAX_TABS}개까지 열 수 있어요`);
    return;
  }
  let name = 'Untitled';
  if (window.IS_ELECTRON) {
    const proj = await window.electronAPI.loadProject(id);
    if (proj?.name) name = proj.name;
  } else {
    const proj = window.loadProjectsList().find(p => p.id === id);
    if (proj?.name) name = proj.name;
  }
  _getTabs().push({ id, name });
  await switchTab(id);
}

/* ── 새 프로젝트를 직접 생성하고 탭으로 열기 ── */
async function createNewProjectTab() {
  document.getElementById('tab-add-wrap').classList.remove('open');
  if (_getTabs().length >= MAX_TABS) {
    window.showToast?.(`탭은 최대 ${MAX_TABS}개까지 열 수 있어요`);
    return;
  }
  const PROJECTS_KEY = 'sangpe-projects';
  const id = 'proj_' + Date.now();
  const now = new Date().toISOString();
  const emptySnap = JSON.stringify({
    version: 2, currentPageId: 'page_1',
    pages: [{ id: 'page_1', name: 'Page 1', label: '', pageSettings: { bg: '#9b9b9b', gap: 100, padX: 32, padY: 32 }, canvas: '' }]
  });
  const proj = {
    id, name: 'Untitled',
    createdAt: now, updatedAt: now,
    version: 2,
    currentPageId: 'page_1',
    pages: [{ id: 'page_1', name: 'Page 1', label: '', pageSettings: { bg: '#9b9b9b', gap: 100, padX: 32, padY: 32 }, canvas: '' }],
    currentBranch: 'dev',
    branches: {
      main: { snapshot: emptySnap, createdAt: Date.now(), updatedAt: Date.now() },
      dev:  { snapshot: emptySnap, createdAt: Date.now(), updatedAt: Date.now() }
    }
  };
  if (window.IS_ELECTRON) {
    await window.electronAPI.saveProject(proj);
  } else {
    const list = JSON.parse(localStorage.getItem(PROJECTS_KEY) || '[]');
    list.push(proj);
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(list));
  }
  await openTabForProject(id);
}

const NEW_PROJECT_BTN_HTML = `
  <div class="tab-add-item tab-add-new" onclick="createNewProjectTab()">
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="2">
      <line x1="5" y1="1" x2="5" y2="9"/><line x1="1" y1="5" x2="9" y2="5"/>
    </svg>
    <span class="tab-add-item-name">새 프로젝트 만들기</span>
  </div>`;

/* ── + 버튼 드롭다운 ── */
async function toggleTabAddMenu(e) {
  e.stopPropagation();
  const wrap = document.getElementById('tab-add-wrap');
  const isOpen = wrap.classList.toggle('open');
  if (!isOpen) return;

  const menu = document.getElementById('tab-add-menu');
  menu.innerHTML = '<div class="tab-add-empty">불러오는 중…</div>';

  let list = [];
  if (window.IS_ELECTRON) {
    list = await window.electronAPI.listProjects();
  } else {
    try { list = JSON.parse(localStorage.getItem('sangpe-projects')) || []; } catch {}
  }

  // 이미 탭에 열린 프로젝트 제외
  const openIds = new Set(_getTabs().map(t => t.id));
  list = list.filter(p => !openIds.has(p.id)).slice(0, 12);

  if (!list.length) {
    menu.innerHTML = NEW_PROJECT_BTN_HTML;
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
  }).join('') + NEW_PROJECT_BTN_HTML;
}

/* ── window 노출 ── */
window.saveTabState         = saveTabState;
window.renderTabBar         = renderTabBar;
window.updateProjectNameDisplay = updateProjectNameDisplay;
window.startRenameProject   = startRenameProject;
window.finishRenameProject  = finishRenameProject;
window.cancelRenameProject  = cancelRenameProject;
window.switchTab            = switchTab;
window.closeTab             = closeTab;
window.openTabForProject    = openTabForProject;
window.toggleTabAddMenu     = toggleTabAddMenu;
window.createNewProjectTab  = createNewProjectTab;

export {
  saveTabState,
  renderTabBar,
  updateProjectNameDisplay,
  startRenameProject,
  finishRenameProject,
  cancelRenameProject,
  switchTab,
  closeTab,
  openTabForProject,
  toggleTabAddMenu,
  createNewProjectTab,
};
