import { canvasEl, canvasWrap, state, PAGE_LABELS } from './globals.js';
// 탭 함수는 tab-system.js에서 window.* 노출 (saveTabState, renderTabBar, switchTab 등)

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

/* ── 탭 함수는 tab-system.js에서 관리 (분리됨, 2025-03-31) ── */

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
  // S11: 빈 canvas 저장 방지 — 모든 페이지의 canvas가 비어있으면 기존 파일 데이터 보호
  if (data?.pages && data.pages.length > 0 && data.pages.every(p => !p.canvas || p.canvas.trim() === '')) {
    console.warn('[save-load] saveProjectToFile: 모든 페이지 canvas가 비어있어 저장 건너뜀 (기존 데이터 보호)');
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
  if (tab) { tab.name = name; window.renderTabBar(); }
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
  window.saveTabState();
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
  window.switchScratchPage?.(pageId);
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
  clone.querySelectorAll('.block-resize-handle, .img-corner-handle, .img-edit-hint, .ci-handle').forEach(el => el.remove());
  clone.querySelectorAll('.ci-selected').forEach(el => el.classList.remove('ci-selected'));
  clone.querySelectorAll('.ci-active').forEach(el => el.classList.remove('ci-active'));
  // 편집 상태 속성 제거 — contenteditable/editing 상태가 저장되지 않도록
  clone.querySelectorAll('[contenteditable]').forEach(el => el.removeAttribute('contenteditable'));
  clone.querySelectorAll('.editing').forEach(el => el.classList.remove('editing'));
  // 드래그 중단 시 고착된 상태 제거
  clone.querySelectorAll('.dragging').forEach(el => el.classList.remove('dragging'));
  clone.querySelectorAll('.drop-indicator').forEach(el => el.remove());
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
        if (row && !e.target.closest('.text-block, .asset-block, .gap-block, .col-placeholder, .icon-circle-block, .table-block, .card-block, .graph-block, .divider-block, .label-group-block, .icon-text-block')) {
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

  // canvas-block 바인딩 (canvas-item은 bindCanvasBlock 내부에서 처리)
  canvasEl.querySelectorAll('.canvas-block').forEach(cb => {
    if (!cb.id) cb.id = 'cb_' + Math.random().toString(36).slice(2, 9);
    cb._canvasBound = false; // rebind 강제
    window.bindCanvasBlock?.(cb);
  });

  canvasEl.querySelectorAll('.text-block, .asset-block, .gap-block, .icon-circle-block, .table-block, .label-group-block, .card-block, .graph-block, .divider-block, .icon-text-block, .canvas-block').forEach(b => {
    if (!b.id) {
      const prefix = b.classList.contains('text-block') ? 'tb'
        : b.classList.contains('asset-block') ? 'ab'
        : b.classList.contains('gap-block') ? 'gb'
        : b.classList.contains('icon-circle-block') ? 'icb'
        : b.classList.contains('label-group-block') ? 'lg'
        : b.classList.contains('card-block') ? 'cdb'
        : b.classList.contains('graph-block') ? 'grb'
        : b.classList.contains('icon-text-block') ? 'itb'
        : b.classList.contains('divider-block') ? 'dvd'
        : b.classList.contains('canvas-block') ? 'cb' : 'tbl';
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
  // sub-section-block 클릭/드롭 핸들러 재연결 (저장/로드 후 누락 방지)
  canvasEl.querySelectorAll('.sub-section-block').forEach(ss => {
    if (!ss.id) ss.id = 'ss_' + Math.random().toString(36).slice(2, 9);
    ss._subSecBound = false; // rebind 강제
    window.bindSubSectionDropZone?.(ss);
    // 배경 이미지 복원
    if (ss.dataset.bgImg && !ss.style.backgroundImage) {
      ss.style.backgroundImage = `url(${ss.dataset.bgImg})`;
      ss.style.backgroundSize = 'cover';
      ss.style.backgroundPosition = 'center';
    }
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
  clearTimeout(autoSaveTimer);
  _setAutosaveIndicator('saving');
  // debounce 1500ms: Notion ~1s, Figma ~2s 중간값. 데이터 손실·저장 폭주 균형점.
  autoSaveTimer = setTimeout(() => {
    const snap = serializeProject();
    // S11: 빈 canvas 저장 방지 — _suppressAutoSave 해제 직후 빈 상태 덮어쓰기 방지
    try {
      const snapData = JSON.parse(snap);
      if (snapData?.pages?.length > 0 && snapData.pages.every(p => !p.canvas || p.canvas.trim() === '')) {
        console.warn('[save-load] scheduleAutoSave: 빈 canvas, localStorage 저장 건너뜀');
        _setAutosaveIndicator('saved');
        return;
      }
    } catch {}
    localStorage.setItem(getSaveKey(), snap);
    localStorage.setItem(getSaveTsKey(), String(Date.now()));
    saveProjectToFile(snap, { skipThumbnail: true }); // 자동저장은 썸네일 캡처 생략
    _setAutosaveIndicator('saved');
  }, 1500);
}

// 새로고침/탭 닫기 시 항상 localStorage에 flush (autoSaveTimer 여부 무관)
window.addEventListener('beforeunload', () => {
  clearTimeout(autoSaveTimer);
  autoSaveTimer = null;
  const snap = serializeProject();
  // S11: 빈 canvas 저장 방지
  try {
    const snapData = JSON.parse(snap);
    if (snapData?.pages?.length > 0 && snapData.pages.every(p => !p.canvas || p.canvas.trim() === '')) {
      return;
    }
  } catch {}
  localStorage.setItem(getSaveKey(), snap);
  localStorage.setItem(getSaveTsKey(), String(Date.now()));
  // non-Electron: PROJECTS_KEY snapshot 동기 업데이트
  if (!IS_ELECTRON && activeProjectId) {
    try {
      const list = JSON.parse(localStorage.getItem(PROJECTS_KEY) || '[]');
      const proj = list.find(p => p.id === activeProjectId);
      if (proj) {
        proj.snapshot = JSON.parse(snap);
        proj.updatedAt = new Date().toISOString();
        localStorage.setItem(PROJECTS_KEY, JSON.stringify(list));
      }
    } catch {}
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

    // localStorage에서 이전 탭 상태 복원 (삭제된 프로젝트 탭 자동 정리)
    try {
      const saved = JSON.parse(localStorage.getItem(TAB_STATE_KEY));
      if (saved?.tabs?.length) {
        if (IS_ELECTRON) {
          const existingProjects = await window.electronAPI.listProjects();
          const existingIds = new Set(existingProjects.map(p => p.id));
          openTabs = saved.tabs.filter(t => existingIds.has(t.id));
        } else {
          openTabs = saved.tabs;
        }
      }
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
          window.renderTabBar();
          // DBG-REFRESH: 프로젝트별 키로 localStorage 조회 — 다른 프로젝트 데이터 오염 방지
          // localStorage가 파일보다 새로우면 우선 적용 (새로고침 데이터 손실 방지)
          // lsTs + 500 > fileTs: 파일이 500ms 이상 명확히 더 새롭지 않으면 localStorage 우선
          const lsTs = parseInt(localStorage.getItem(getSaveTsKey()) || '0');
          const fileTs = new Date(proj.updatedAt || 0).getTime();
          if (lsTs > 0 && lsTs + 500 > fileTs) {
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
        window.renderTabBar();
        if (proj?.snapshot) { try { applyAndFinish(typeof proj.snapshot === 'string' ? JSON.parse(proj.snapshot) : proj.snapshot); } catch {} return; }
      }
    } else {
      // URL에 project 없이 열림 (admin mode): 탭 유지하고 렌더만
      window.renderTabBar();
    }
    const saved = localStorage.getItem(getSaveKey());
    if (saved) { try { applyAndFinish(JSON.parse(saved)); return; } catch {} }
    initEmpty();
  })();

  // attributes:true 제거 — 드래그 클래스 토글마다 autoSave 폭주 방지 (DBG-11)
  autoSaveObserver.observe(canvasEl, { childList: true, subtree: true, characterData: true });

  // 스크래치패드 초기화
  window.initScratchPad?.(activeProjectId, state.currentPageId);

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
  // 탭 함수: tab-system.js에서 window 노출 처리 (여기서는 저장/불러오기 핵심만)
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

// Backward compat — 탭 함수는 tab-system.js에서 window 노출 처리
// (saveTabState, renderTabBar 등 window.* 할당은 tab-system.js에서 수행)
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
  set: (v) => { openTabs = v; },
  configurable: true,
});
Object.defineProperty(window, 'currentFileName', {
  get: () => currentFileName,
  set: (v) => { currentFileName = v; },
  configurable: true,
});
