import { canvasEl, canvasWrap, state, PAGE_LABELS } from './globals.js';

/* ══════════════════════════════════════
   저장 / 불러오기
══════════════════════════════════════ */
// DBG-REFRESH: SAVE_KEY는 프로젝트별로 분리 — 탭 전환 시 다른 프로젝트 데이터 오염 방지
// 전역 키('web-editor-autosave')는 더 이상 사용하지 않음
const SAVE_KEY_PREFIX = 'web-editor-autosave';
const PROJECTS_KEY = 'sangpe-projects';

/** 현재 activeProjectId 기준 localStorage 키 반환 */
function getSaveKey() {
  return activeProjectId ? `${SAVE_KEY_PREFIX}__${activeProjectId}` : SAVE_KEY_PREFIX;
}
function getSaveTsKey() {
  return getSaveKey() + '_ts';
}
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
  window.switchScratch?.(id); // 스크래치패드 — 현재 저장 후 새 프로젝트 로드

  // 현재 탭 메모리 캐시 저장 + 파일 비동기 저장
  const curTab = openTabs.find(t => t.id === activeProjectId);
  const prevProjectId = activeProjectId; // activeProjectId 변경 전 캡처 (S10 race condition 방지)
  if (curTab) {
    curTab._cache = serializeProject();
    saveProjectToFile(curTab._cache, { skipThumbnail: true, projectId: prevProjectId }); // 파일 저장은 await 안 함 (비동기)
  }

  activeProjectId = id;
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
  state._suppressAutoSave = true;
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
    applyProjectData(JSON.parse(targetTab._cache));
    state._suppressAutoSave = false;
    initBranchStore();
    requestAnimationFrame(() => { if (window.buildLayerPanel) window.buildLayerPanel(); });
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
  } else {
    // 프로젝트 없으면 캔버스 초기화
    if (canvasEl) canvasEl.innerHTML = '';
    if (window.buildLayerPanel) window.buildLayerPanel();
  }
  state._suppressAutoSave = false;
  initBranchStore();
}

async function closeTab(id) {
  const idx = openTabs.findIndex(t => t.id === id);
  if (idx === -1) return;
  if (openTabs.length === 1) { openTabs = []; saveTabState(); goHome(); return; }
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
    window.showToast(`탭은 최대 ${MAX_TABS}개까지 열 수 있어요`);
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

/* ── 새 프로젝트를 직접 생성하고 탭으로 열기 ── */
async function createNewProjectTab() {
  document.getElementById('tab-add-wrap').classList.remove('open');
  if (openTabs.length >= MAX_TABS) {
    window.showToast(`탭은 최대 ${MAX_TABS}개까지 열 수 있어요`);
    return;
  }
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
  if (IS_ELECTRON) {
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
  if (IS_ELECTRON) {
    list = await window.electronAPI.listProjects();
  } else {
    try { list = JSON.parse(localStorage.getItem(PROJECTS_KEY)) || []; } catch {}
  }

  // 이미 탭에 열린 프로젝트 제외
  const openIds = new Set(openTabs.map(t => t.id));
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

/* ── 썸네일 생성 (첫 섹션 캡처 → base64, 200px 너비 축소) ── */
async function captureThumbnail() {
  try {
    const firstSec = canvasEl?.querySelector('.section-block');
    if (!firstSec || typeof html2canvas === 'undefined') return null;

    const clone = firstSec.cloneNode(true);
    clone.querySelector?.('.section-label')?.remove();
    clone.querySelector?.('.section-toolbar')?.remove();
    clone.classList.remove('selected');
    clone.style.cssText += ';position:fixed;top:-99999px;left:0;width:860px;margin:0;outline:none;';
    document.body.appendChild(clone);

    const bgColor = firstSec.style.background || firstSec.style.backgroundColor || '#ffffff';
    const canvas = await html2canvas(clone, { scale: 1, useCORS: true, backgroundColor: bgColor, logging: false });
    document.body.removeChild(clone);

    // 200px 너비로 축소
    const thumb = document.createElement('canvas');
    const ratio = 200 / canvas.width;
    thumb.width = 200;
    thumb.height = Math.round(canvas.height * ratio);
    thumb.getContext('2d').drawImage(canvas, 0, 0, thumb.width, thumb.height);
    return thumb.toDataURL('image/jpeg', 0.7);
  } catch { return null; }
}

/* ── 프로젝트 파일 저장 (Electron: projects/{id}.json, 브라우저: localStorage) ── */
// DBG-11: 저장 중 대기열 패턴 — 동시 저장 race condition 방지
let _isSavingToFile = false;
let _pendingSaveData = null; // { snapshot, opts }

async function saveProjectToFile(snapshot, opts = {}) {
  // 저장 중이면 최신 데이터를 pendingData로 대기
  if (_isSavingToFile) {
    _pendingSaveData = { snapshot, opts };
    return;
  }
  _isSavingToFile = true;
  try {
    await _doSaveProjectToFile(snapshot, opts);
  } finally {
    _isSavingToFile = false;
    if (_pendingSaveData) {
      const { snapshot: ps, opts: po } = _pendingSaveData;
      _pendingSaveData = null;
      await saveProjectToFile(ps, po);
    }
  }
}

async function _doSaveProjectToFile(snapshot, opts = {}) {
  // opts.projectId: 탭 전환 시 이전 탭 ID로 저장하기 위한 명시적 ID (S10 race condition 방지)
  const targetId = opts.projectId || activeProjectId;
  if (!targetId) return;
  // S4: 손상된 JSON 안전 처리
  let data;
  try {
    data = typeof snapshot === 'string' ? JSON.parse(snapshot) : snapshot;
  } catch {
    console.warn('[save-load] saveProjectToFile: 손상된 snapshot, 저장 취소');
    return;
  }
  const thumbnail = opts.skipThumbnail ? null : await captureThumbnail();

  if (IS_ELECTRON) {
    const existing = await window.electronAPI.loadProject(targetId);
    const proj = {
      ...(existing || {}),
      ...data,
      id: targetId,
      name: existing?.name || data.name || 'Untitled',
      updatedAt: new Date().toISOString(),
      ...(thumbnail ? { thumbnail } : {}),
    };
    await window.electronAPI.saveProject(proj);
  } else {
    try {
      const list = JSON.parse(localStorage.getItem(PROJECTS_KEY) || '[]');
      const proj = list.find(p => p.id === targetId);
      if (proj) {
        proj.snapshot = data;
        proj.updatedAt = new Date().toISOString();
        if (thumbnail) proj.thumbnail = thumbnail;
      }
      localStorage.setItem(PROJECTS_KEY, JSON.stringify(list)); // S9: QuotaExceededError 가능
    } catch (e) {
      if (e.name === 'QuotaExceededError') {
        console.warn('[save-load] localStorage 용량 초과, 저장 실패');
        if (window.showToast) window.showToast('⚠️ 저장 공간 부족: 프로젝트가 너무 큽니다.');
      }
    }
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

async function goHome() {
  const curTab = openTabs.find(t => t.id === activeProjectId);
  if (curTab) curTab._cache = serializeProject();
  await saveProjectToFile(serializeProject()); // 홈으로 나갈 때 썸네일 캡처
  saveTabState();
  window.location.href = 'pages/projects.html';
}

/* ── Page Management ── */
function getCurrentPage() {
  return state.pages.find(p => p.id === state.currentPageId) || state.pages[0];
}

function flushCurrentPage() {
  const page = getCurrentPage();
  if (!page) return;
  page.canvas = getSerializedCanvas();
  page.pageSettings = { ...state.pageSettings };
}

function switchPage(pageId) {
  if (pageId === state.currentPageId) return;
  flushCurrentPage();
  // 이미지 편집 모드 리스너 정리 (메모리 누수 방지)
  canvasEl.querySelectorAll('[data-pos-dragging], .pos-dragging').forEach(ab => {
    if (ab._posDragCleanup) { ab._posDragCleanup(); ab._posDragCleanup = null; }
    if (ab._exitPosDrag)    { document.removeEventListener('click', ab._exitPosDrag); ab._exitPosDrag = null; }
    if (ab._exitPosDragEsc) { document.removeEventListener('keydown', ab._exitPosDragEsc); ab._exitPosDragEsc = null; }
    ab._posDragging = false;
    ab.classList.remove('pos-dragging', 'img-editing');
  });
  state._suppressAutoSave = true;
  state.currentPageId = pageId;
  const page = getCurrentPage();
  if (page.pageSettings) Object.assign(state.pageSettings, page.pageSettings);
  canvasEl.innerHTML = page.canvas || '';
  canvasEl.querySelectorAll('.text-block-label, .asset-block-label').forEach(el => el.remove());
  // propPanel 클리어 — 이전 페이지의 속성 패널 내용이 잔존하지 않도록
  const propPanel = document.querySelector('#panel-right .panel-body');
  if (propPanel) propPanel.innerHTML = '';
  rebindAll();
  applyPageSettings();
  window.deselectAll();
  window.showPageProperties();
  window.buildLayerPanel(); // also calls buildFilePageSection
  state._suppressAutoSave = false;
  scheduleAutoSave();
}

function addPage() {
  flushCurrentPage();
  const id = 'page_' + Date.now();
  const n = state.pages.length + 1;
  state.pages.push({ id, name: `Page ${n}`, label: '', pageSettings: { ...state.pageSettings }, canvas: '' });
  switchPage(id);
}

function deletePage(pageId) {
  if (state.pages.length <= 1) { window.showToast('⚠️ 페이지가 1개 이상이어야 합니다.'); return; }
  const idx = state.pages.findIndex(p => p.id === pageId);
  if (idx === -1) return;
  const wasActive = pageId === state.currentPageId;
  state.pages.splice(idx, 1);
  if (wasActive) {
    const next = state.pages[Math.min(idx, state.pages.length - 1)];
    state._suppressAutoSave = true;
    state.currentPageId = next.id;
    if (next.pageSettings) Object.assign(state.pageSettings, next.pageSettings);
    canvasEl.innerHTML = next.canvas || '';
    canvasEl.querySelectorAll('.text-block-label, .asset-block-label').forEach(el => el.remove());
    rebindAll();
    applyPageSettings();
    window.deselectAll();
    window.showPageProperties();
    state._suppressAutoSave = false;
  }
  window.buildLayerPanel();
  scheduleAutoSave();
}

function getSerializedCanvas() {
  // section data-name 속성 동기화
  canvasEl.querySelectorAll('.section-block').forEach(sec => {
    if (sec._name) sec.dataset.name = sec._name;
  });
  // 핸들/힌트 등 상태 요소는 직렬화에서 제외
  const clone = canvasEl.cloneNode(true);
  clone.querySelectorAll('.block-resize-handle, .img-corner-handle, .img-edit-hint').forEach(el => el.remove());
  // 편집 상태 속성 제거 — contenteditable/editing 상태가 저장되지 않도록
  clone.querySelectorAll('[contenteditable]').forEach(el => el.removeAttribute('contenteditable'));
  clone.querySelectorAll('.editing').forEach(el => el.classList.remove('editing'));
  return clone.innerHTML;
}

function serializeProject() {
  flushCurrentPage();
  return JSON.stringify({ version: 2, currentPageId: state.currentPageId, pages: state.pages });
}

function applyProjectData(data) {
  if (data.version === 2 && Array.isArray(data.pages)) {
    // S8: pages 빈 배열 방어 — 최소 1페이지 보장
    if (data.pages.length === 0) {
      data.pages = [{ id: 'page_1', name: 'Page 1', label: '', pageSettings: { ...state.pageSettings }, canvas: '' }];
    }
    state.pages = data.pages;
    state.currentPageId = data.currentPageId || data.pages[0]?.id;
  } else {
    // v1 backward compat
    const id = 'page_1';
    state.pages = [{ id, name: 'Page 1', label: '', pageSettings: data.pageSettings || { ...state.pageSettings }, canvas: data.canvas || '' }];
    state.currentPageId = id;
  }
  const page = getCurrentPage();
  if (!page) return; // S8: 여전히 undefined면 안전하게 종료
  if (page.pageSettings) Object.assign(state.pageSettings, page.pageSettings);
  canvasEl.innerHTML = page.canvas || '';
  canvasEl.querySelectorAll('.text-block-label, .asset-block-label').forEach(el => el.remove());
  rebindAll();
  applyPageSettings();
  window.deselectAll?.(); // DBG-10: 브랜치 전환 시 이전 선택 상태 클리어
  window.buildLayerPanel(); // also calls buildFilePageSection
  window.showPageProperties();
}

function applyPageSettings() {
  canvasWrap.style.background = state.pageSettings.bg;
  canvasEl.style.gap = state.pageSettings.gap + 'px';
  canvasEl.style.setProperty('--page-padx', state.pageSettings.padX + 'px');
  canvasEl.style.setProperty('--page-pady', state.pageSettings.padY + 'px');
  // asset-block: 너비% 재계산 방식 유지
  canvasEl.querySelectorAll('.asset-block[data-use-padx="true"]').forEach(ab => {
    window.applyAssetPadX(ab, state.pageSettings.padX);
  });
}

function rebindAll() {
  // asset-overlay 오염 정리: contenteditable 제거 + 직접 텍스트 노드 제거
  canvasEl.querySelectorAll('.asset-overlay').forEach(overlay => {
    overlay.removeAttribute('contenteditable');
    [...overlay.childNodes].filter(n => n.nodeType === Node.TEXT_NODE).forEach(n => n.remove());
  });

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
    if (!sec._secClickBound) {
      sec._secClickBound = true;
      sec.addEventListener('click', e => {
        e.stopPropagation();
        window.selectSectionWithModifier(sec, e);
        const row = e.target.closest('.row');
        if (row && !e.target.closest('.text-block, .asset-block, .gap-block, .col-placeholder, .icon-circle-block, .table-block, .card-block, .strip-banner-block, .graph-block, .divider-block, .label-group-block, .icon-text-block')) {
          document.querySelectorAll('.row.row-active').forEach(r => r.classList.remove('row-active'));
          row.classList.add('row-active');
          if (window.syncLayerRow) window.syncLayerRow(row);
        }
      });
    }
    bindSectionDelete(sec);
    bindSectionOrder(sec);
    bindSectionDrag(sec);
    bindSectionDropZone(sec);
    sec.querySelectorAll('.col').forEach(c => window.bindColDropZone?.(c));
    if (window.bindSectionHitzone) window.bindSectionHitzone(sec);
    // ⎇ 버튼 없으면 추가, 있으면 onclick 재바인딩 (직렬화 시 프로퍼티가 유실되므로 항상 재설정)
    const toolbar = sec.querySelector('.section-toolbar');
    if (toolbar) {
      // 구버전 ↑ ↓ ✕ 버튼 제거
      toolbar.querySelectorAll('.st-btn:not(.st-branch-btn):not(.st-ab-btn)').forEach(el => el.remove());
      let branchBtn = toolbar.querySelector('.st-branch-btn');
      if (!branchBtn) {
        branchBtn = document.createElement('button');
        branchBtn.className = 'st-btn st-branch-btn';
        branchBtn.title = 'feature 브랜치로 실험';
        branchBtn.textContent = '⎇';
        toolbar.appendChild(branchBtn);
      }
      branchBtn.onclick = function() { openSectionBranchMenu(this); };
      // variation 툴바 버튼 복원
      if (window.bindVariationToolbarBtn) window.bindVariationToolbarBtn(sec);
    }
  });
  // 구버전 배너 블록 마이그레이션: sbb-gap-top/bottom 없는 경우 추가
  canvasEl.querySelectorAll('.strip-banner-block').forEach(sbb => {
    const content = sbb.querySelector('.sbb-content');
    if (!content) return;
    if (!content.querySelector('.sbb-gap-top')) {
      const topGap = document.createElement('div');
      topGap.className = 'sbb-gap sbb-gap-top';
      topGap.style.height = '20px';
      content.prepend(topGap);
    }
    if (!content.querySelector('.sbb-gap-bottom')) {
      const botGap = document.createElement('div');
      botGap.className = 'sbb-gap sbb-gap-bottom';
      botGap.style.height = '20px';
      content.append(botGap);
    }
  });

  // row ID 복원: 저장/불러오기 시 row에도 고유 ID 부여
  canvasEl.querySelectorAll('.row').forEach(row => {
    if (!row.id) row.id = 'row_' + Math.random().toString(36).slice(2, 9);
    if (window.bindRowColAdd) window.bindRowColAdd(row);
  });

  // 저장 시 제거된 contenteditable 속성 복원 (텍스트 블록 내부 편집 가능 요소)
  canvasEl.querySelectorAll('.text-block').forEach(tb => {
    const inner = tb.querySelector('.tb-h1,.tb-h2,.tb-h3,.tb-body,.tb-caption,.tb-label');
    if (inner && !inner.hasAttribute('contenteditable')) {
      inner.setAttribute('contenteditable', 'false');
    }
  });

  canvasEl.querySelectorAll('.text-block, .asset-block, .gap-block, .icon-circle-block, .table-block, .label-group-block, .card-block, .strip-banner-block, .graph-block, .divider-block, .icon-text-block').forEach(b => {
    if (!b.id) {
      const prefix = b.classList.contains('text-block') ? 'tb'
        : b.classList.contains('asset-block') ? 'ab'
        : b.classList.contains('gap-block') ? 'gb'
        : b.classList.contains('icon-circle-block') ? 'icb'
        : b.classList.contains('label-group-block') ? 'lg'
        : b.classList.contains('card-block') ? 'cdb'
        : b.classList.contains('strip-banner-block') ? 'sbb'
        : b.classList.contains('graph-block') ? 'grb'
        : b.classList.contains('icon-text-block') ? 'itb'
        : b.classList.contains('divider-block') ? 'dvd' : 'tbl';
      b.id = prefix + '_' + Math.random().toString(36).slice(2, 9);
    }
    window.bindBlock(b);
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

const LAST_COMMIT_KEY = 'goya-last-commit';


let _autoSaveHideTimer = null;
function _setAutosaveIndicator(state) {
  const el = document.getElementById('autosave-indicator');
  if (!el) return;
  clearTimeout(_autoSaveHideTimer);
  el.className = state;
  el.textContent = state === 'saving' ? '저장 중...' : '저장됨';
  if (state === 'saved') {
    _autoSaveHideTimer = setTimeout(() => { el.className = ''; el.textContent = ''; }, 2500);
  }
}

function scheduleAutoSave() {
  if (state._suppressAutoSave) return;
  state._canvasDirty = true; // OPT: dirty flag — pushHistory가 실제 변경만 캡처하도록
  clearTimeout(autoSaveTimer);
  _setAutosaveIndicator('saving');
  // debounce 1500ms: Notion ~1s, Figma ~2s 중간값. 데이터 손실·저장 폭주 균형점.
  autoSaveTimer = setTimeout(() => {
    const snap = serializeProject();
    localStorage.setItem(getSaveKey(), snap);
    localStorage.setItem(getSaveTsKey(), String(Date.now()));
    saveProjectToFile(snap, { skipThumbnail: true }); // 자동저장은 썸네일 캡처 생략
    _setAutosaveIndicator('saved');
  }, 1500);
}

// 새로고침/탭 닫기 시 미완료 debounce 즉시 flush → localStorage 백업
// DBG-REFRESH: getSaveKey()로 프로젝트별 키 사용 — 다른 프로젝트 데이터 오염 방지
window.addEventListener('beforeunload', () => {
  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer);
    autoSaveTimer = null;
    const snap = serializeProject();
    localStorage.setItem(getSaveKey(), snap);
    localStorage.setItem(getSaveTsKey(), String(Date.now()));
  }
});

// 변경 감지 — canvas MutationObserver
const autoSaveObserver = new MutationObserver(scheduleAutoSave);

/* ── Init (called from editor.js after all scripts loaded) ── */
function initApp() {
  // 이미 백업이 있으면 되돌리기 버튼 활성화
  if (localStorage.getItem(LAST_COMMIT_KEY)) {
    const revertBtn = document.getElementById('revert-btn');
    if (revertBtn) revertBtn.classList.add('has-commit');
  }
  canvasWrap.style.background = state.pageSettings.bg;
  canvasEl.style.gap = state.pageSettings.gap + 'px';
  canvasEl.style.setProperty('--page-padx', state.pageSettings.padX + 'px');
  canvasEl.style.setProperty('--page-pady', state.pageSettings.padY + 'px');
  // 구버전 저장 파일: 블록에 박힌 inline padding 제거 (CSS Variable로 대체)
  canvasEl.querySelectorAll('.text-block:not(.overlay-tb), .label-group-block').forEach(el => {
    el.style.paddingLeft = ''; el.style.paddingRight = '';
    el.style.paddingTop  = ''; el.style.paddingBottom = '';
  });
  canvasEl.querySelectorAll('.card-block, .graph-block').forEach(el => {
    el.style.paddingLeft = ''; el.style.paddingRight = '';
  });
  canvasEl.querySelectorAll('.sbb-content').forEach(el => {
    el.style.paddingLeft = ''; el.style.paddingRight = '';
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
      try { applyProjectData(data); } catch(e) { console.error('[initApp] applyProjectData 실패:', e); }
    }
    function initEmpty() {
      state.pages = [{ id: 'page_1', name: 'Page 1', label: '', pageSettings: { ...state.pageSettings }, canvas: '' }];
      state.currentPageId = 'page_1';
      window.buildLayerPanel();
      window.showPageProperties();
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
          // DBG-REFRESH: 프로젝트별 키로 localStorage 조회 — 다른 프로젝트 데이터 오염 방지
          // localStorage가 파일보다 새로우면 우선 적용 (새로고침 데이터 손실 방지)
          const lsTs = parseInt(localStorage.getItem(getSaveTsKey()) || '0');
          const fileTs = new Date(proj.updatedAt || 0).getTime();
          if (lsTs > fileTs + 500) {
            const lsSaved = localStorage.getItem(getSaveKey());
            if (lsSaved) { try { applyAndFinish(JSON.parse(lsSaved)); return; } catch {} }
          }
          if (proj.version === 2 && proj.pages) { applyAndFinish(proj); return; }
          if (proj.snapshot) { try { applyAndFinish(typeof proj.snapshot === 'string' ? JSON.parse(proj.snapshot) : proj.snapshot); } catch {} return; }
        }
      } else {
        const proj = loadProjectsList().find(p => p.id === activeProjectId);
        if (proj?.name) {
          name = proj.name;
          const tab = openTabs.find(t => t.id === activeProjectId);
          if (tab) tab.name = name;
        }
        renderTabBar();
        if (proj?.snapshot) { try { applyAndFinish(typeof proj.snapshot === 'string' ? JSON.parse(proj.snapshot) : proj.snapshot); } catch {} return; }
      }
    } else {
      openTabs = [];
      renderTabBar();
    }
    const saved = localStorage.getItem(getSaveKey());
    if (saved) { try { applyAndFinish(JSON.parse(saved)); return; } catch {} }
    initEmpty();
  })();

  // attributes:true 제거 — 드래그 클래스 토글마다 autoSave 폭주 방지 (DBG-11)
  autoSaveObserver.observe(canvasEl, { childList: true, subtree: true, characterData: true });

  // 스크래치패드 초기화
  window.initScratchPad?.(activeProjectId);

  // 브랜치 시스템 초기화
  initBranchStore();
  setTimeout(() => window.applyMainLock(getCurrentBranch()), 100);

  // File 탭 섹션 토글
  window.initFileTabToggle();

  // 템플릿 패널 초기 렌더 (파일 로드 후)
  initTemplates().then(() => {
    window.renderTemplatePanel();
    if (window.initTemplateBrowser) window.initTemplateBrowser();
  });

  // Cmd+G 그룹 — capture phase로 브라우저 Find Next 보다 먼저 처리
  document.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'g') {
      if (e.target.isContentEditable) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      groupSelectedBlocks();
    }
  }, true);

  // 초기 스냅샷
  pushHistory();

  /* 캔버스 — 섹션 드래그 드롭 */
  // rAF throttle: getBoundingClientRect()를 매 픽셀마다 호출하지 않도록 (DBG-11)
  let _sectionDragRafId = null;
  canvasEl.addEventListener('dragover', e => {
    if (!sectionDragSrc) return;
    e.preventDefault();
    if (_sectionDragRafId) return;
    const clientY = e.clientY;
    _sectionDragRafId = requestAnimationFrame(() => {
      _sectionDragRafId = null;
      clearSectionIndicators();
      const after = getSectionDragAfterEl(canvasEl, clientY);
      const indicator = document.createElement('div');
      indicator.className = 'section-drop-indicator';
      if (after) canvasEl.insertBefore(indicator, after);
      else canvasEl.appendChild(indicator);
    });
  });
  canvasEl.addEventListener('dragleave', e => {
    if (!sectionDragSrc) return;
    if (!canvasEl.contains(e.relatedTarget)) clearSectionIndicators();
  });
  canvasEl.addEventListener('drop', e => {
    if (!sectionDragSrc) return;
    e.preventDefault();
    window.pushHistory();
    const indicator = canvasEl.querySelector('.section-drop-indicator');
    if (indicator) canvasEl.insertBefore(sectionDragSrc, indicator);
    else canvasEl.appendChild(sectionDragSrc);
    clearSectionIndicators();
    window.buildLayerPanel();
    sectionDragSrc = null;
  });
}

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
  saveProjectToFile,
  loadProjectsList,
  getProjectName,
  setProjectName,
  goHome,
  getCurrentPage,
  flushCurrentPage,
  switchPage,
  addPage,
  deletePage,
  getSerializedCanvas,
  serializeProject,
  applyProjectData,
  applyPageSettings,
  rebindAll,
  scheduleAutoSave,
  initApp,
};

// Backward compat
window.saveTabState = saveTabState;
window.renderTabBar = renderTabBar;
window.updateProjectNameDisplay = updateProjectNameDisplay;
window.startRenameProject = startRenameProject;
window.finishRenameProject = finishRenameProject;
window.cancelRenameProject = cancelRenameProject;
window.switchTab = switchTab;
window.closeTab = closeTab;
window.openTabForProject = openTabForProject;
window.toggleTabAddMenu = toggleTabAddMenu;
window.createNewProjectTab = createNewProjectTab;
window.saveProjectToFile = saveProjectToFile;
window.loadProjectsList = loadProjectsList;
window.getProjectName = getProjectName;
window.setProjectName = setProjectName;
window.goHome = goHome;
window.getCurrentPage = getCurrentPage;
window.flushCurrentPage = flushCurrentPage;
window.switchPage = switchPage;
window.addPage = addPage;
window.deletePage = deletePage;
window.getSerializedCanvas = getSerializedCanvas;
window.serializeProject = serializeProject;
window.applyProjectData = applyProjectData;
window.applyPageSettings = applyPageSettings;
window.rebindAll = rebindAll;
window.scheduleAutoSave = scheduleAutoSave;
window.triggerAutoSave = scheduleAutoSave; // alias used by drag-drop.js, prop-layout.js
window.initApp = initApp;

// branch-system.js, commit-system.js 등 다른 모듈에서 참조하는 변수들 노출
window.IS_ELECTRON = IS_ELECTRON;
// BUG4: _persistBranchesToFile에서 race condition 감지용 — getter로 읽기 전용 노출
Object.defineProperty(window, '_isSavingToFile', {
  get: () => _isSavingToFile,
  configurable: true,
});
Object.defineProperty(window, 'activeProjectId', {
  get: () => activeProjectId,
  set: (v) => { activeProjectId = v; },
  configurable: true,
});
Object.defineProperty(window, 'openTabs', {
  get: () => openTabs,
  configurable: true,
});
Object.defineProperty(window, 'currentFileName', {
  get: () => currentFileName,
  set: (v) => { currentFileName = v; },
  configurable: true,
});
