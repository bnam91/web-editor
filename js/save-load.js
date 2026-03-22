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

const IS_ELECTRON = !!window.electronAPI?.isElectron;

/* ── 프로젝트 파일 저장 (Electron: projects/{id}.json, 브라우저: localStorage) ── */
async function saveProjectToFile(snapshot) {
  if (!CURRENT_PROJECT_ID) return;
  const data = typeof snapshot === 'string' ? JSON.parse(snapshot) : snapshot;

  if (IS_ELECTRON) {
    // 기존 파일 로드해서 name/createdAt 보존
    const existing = await window.electronAPI.loadProject(CURRENT_PROJECT_ID);
    const proj = {
      ...(existing || {}),
      ...data,
      id: CURRENT_PROJECT_ID,
      name: existing?.name || data.name || 'Untitled',
      updatedAt: new Date().toISOString(),
    };
    await window.electronAPI.saveProject(proj);
  } else {
    // 브라우저 fallback: localStorage
    const list = JSON.parse(localStorage.getItem(PROJECTS_KEY) || '[]');
    const proj = list.find(p => p.id === CURRENT_PROJECT_ID);
    if (proj) { proj.snapshot = data; proj.updatedAt = new Date().toISOString(); }
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(list));
  }
}

function loadProjectsList() {
  try { return JSON.parse(localStorage.getItem(PROJECTS_KEY)) || []; } catch { return []; }
}

function getProjectName() {
  if (!CURRENT_PROJECT_ID) return null;
  if (!IS_ELECTRON) {
    const proj = loadProjectsList().find(p => p.id === CURRENT_PROJECT_ID);
    return proj?.name || null;
  }
  // Electron: 탭 이름은 초기 로드 시 파일에서 읽어옴 (비동기라 캐시 활용)
  return document.getElementById('project-tab-name')?.textContent?.trim() || null;
}

async function setProjectName(name) {
  if (!CURRENT_PROJECT_ID) return;
  if (IS_ELECTRON) {
    const proj = await window.electronAPI.loadProject(CURRENT_PROJECT_ID);
    if (proj) { proj.name = name; proj.updatedAt = new Date().toISOString(); await window.electronAPI.saveProject(proj); }
  } else {
    const list = loadProjectsList();
    const proj = list.find(p => p.id === CURRENT_PROJECT_ID);
    if (proj) { proj.name = name; localStorage.setItem(PROJECTS_KEY, JSON.stringify(list)); }
  }
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

function saveProject() {
  // 현재 저장된 상태를 "이전 커밋"으로 백업
  const prev = localStorage.getItem(SAVE_KEY);
  if (prev) localStorage.setItem(LAST_COMMIT_KEY, prev);

  const json = serializeProject();
  localStorage.setItem(SAVE_KEY, json);

  // 되돌리기 버튼 활성화
  const revertBtn = document.getElementById('revert-btn');
  if (revertBtn) revertBtn.classList.add('has-commit');

  if (!currentFileName) {
    const defaultName = getProjectName() || `web-editor-${new Date().toISOString().slice(0,10)}`;
    showFilenameModal(defaultName, name => {
      currentFileName = name;
      _downloadJSON(json, currentFileName);
      showToast('✅ Committed — ' + currentFileName);
    });
    return;
  }

  _downloadJSON(json, currentFileName);
  showToast('✅ Committed — ' + currentFileName);
}

function revertToLastCommit() {
  const snap = localStorage.getItem(LAST_COMMIT_KEY);
  if (!snap) { showToast('⚠️ 되돌릴 커밋이 없어요'); return; }
  if (!confirm('마지막 커밋으로 되돌릴까요? 현재 변경사항은 사라져요.')) return;
  try {
    const data = JSON.parse(snap);
    applyProjectData(data);
    showToast('↩ 마지막 커밋으로 되돌렸어요');
  } catch { showToast('❌ 되돌리기 실패'); }
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

  // 프로젝트 탭 이름 더블클릭 변경
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

    if (CURRENT_PROJECT_ID) {
      if (IS_ELECTRON) {
        const proj = await window.electronAPI.loadProject(CURRENT_PROJECT_ID);
        if (proj) {
          if (tabName) tabName.textContent = proj.name || 'Untitled';
          if (proj.version === 2 && proj.pages) { applyAndFinish(proj); return; }
          if (proj.snapshot) { applyAndFinish(proj.snapshot); return; }
        }
      } else {
        const proj = loadProjectsList().find(p => p.id === CURRENT_PROJECT_ID);
        if (tabName && proj?.name) tabName.textContent = proj.name;
        if (proj?.snapshot) { applyAndFinish(proj.snapshot); return; }
      }
    }
    const saved = localStorage.getItem(SAVE_KEY);
    if (saved) { try { applyAndFinish(JSON.parse(saved)); return; } catch {} }
    initEmpty();
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
