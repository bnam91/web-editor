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

function _isAllCanvasEmpty(data) {
  return data?.pages?.length > 0 && data.pages.every(p => !p.canvas || p.canvas.trim() === '');
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
  if (_isAllCanvasEmpty(data)) {
    console.warn('[save-load] saveProjectToFile: 모든 페이지 canvas가 비어있어 저장 건너뜀 (기존 데이터 보호)');
    return;
  }
  const thumbnail = opts.skipThumbnail ? null : await captureThumbnail();

  if (IS_ELECTRON) {
    try {
      const existing = await window.electronAPI.loadProject(targetId);
      // pages + pageSettings만 저장 — branches/commits/thumbnail은 _meta.json에서 관리
      // existing 먼저 spread 후 data로 덮어쓰기 — 레거시 필드는 data에 없으면 existing 유지
      const { branches: _b, commits: _c, currentBranch: _cb, thumbnail: _t, ...dataWithoutMeta } = data;
      const { branches: _eb, commits: _ec, currentBranch: _ecb, thumbnail: _et, ...existingWithoutMeta } = (existing || {});
      const proj = {
        ...existingWithoutMeta,
        ...dataWithoutMeta,
        id: targetId,
        name: existing?.name || data.name || 'Untitled',
        updatedAt: new Date().toISOString(),
      };
      const saveResult = await window.electronAPI.saveProject(proj);
      // main.js에서 페이지 수 감소 감지 시 { ok: false, reason: 'page_count_reduced' } 반환
      if (saveResult && saveResult.ok === false) {
        console.warn('[save-load] 저장 거부됨:', saveResult.reason, saveResult);
        window.showToast?.('⚠️ 저장 거부: 페이지 수 감소 감지 — 데이터 보호됨');
        return;
      }
      // thumbnail은 _meta.json에 저장
      if (thumbnail) {
        const existingMeta = await window.electronAPI.loadProjectMeta(targetId);
        await window.electronAPI.saveProjectMeta(targetId, { ...(existingMeta || {}), thumbnail, updatedAt: new Date().toISOString() });
      }
    } catch (e) {
      console.error('[save-load] Electron 저장 실패:', e);
      window.showToast?.('❌ 저장 실패: ' + (e.message || '알 수 없는 오류'));
    }
  } else {
    try {
      const listRaw = localStorage.getItem(PROJECTS_KEY) || '[]';
      const list = JSON.parse(listRaw);
      const proj = list.find(p => p.id === targetId);
      if (proj) {
        proj.snapshot = data;
        proj.updatedAt = new Date().toISOString();
        if (thumbnail) proj.thumbnail = thumbnail;
      }
      localStorage.setItem(PROJECTS_KEY, JSON.stringify(list));
    } catch (e) {
      if (e.name === 'QuotaExceededError') {
        console.warn('[save-load] localStorage 용량 초과, 저장 실패');
        window.showToast?.('⚠️ 저장 공간 부족: 이미지를 줄이거나 프로젝트를 분리해 주세요.');
        // 상태와 저장소 불일치 방지 — 저장 실패한 snapshot을 메모리에서도 롤백
        // (이미 proj.snapshot이 변경된 상태이므로 list를 재파싱해 원복)
        try {
          const prevList = JSON.parse(localStorage.getItem(PROJECTS_KEY) || '[]');
          const prevProj = prevList.find(p => p.id === targetId);
          if (prevProj) {
            // state.pages는 이미 최신 — UI는 정상, 다음 저장 시 재시도로 해결
          }
        } catch (_) {}
      } else {
        console.error('[save-load] localStorage 저장 오류:', e);
        window.showToast?.('❌ 저장 오류: ' + e.message);
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

async function switchPage(pageId) {
  if (pageId === state.currentPageId) return;
  state._suppressAutoSave = true; // DOM 조작 전 억제 시작 (MutationObserver 경쟁 조건 방지)
  await window.switchScratchPage?.(pageId);
  flushCurrentPage();
  // 이미지 편집 모드 리스너 정리 (메모리 누수 방지)
  canvasEl.querySelectorAll('[data-pos-dragging], .pos-dragging').forEach(ab => {
    if (ab._posDragCleanup) { ab._posDragCleanup(); ab._posDragCleanup = null; }
    if (ab._exitPosDrag)    { document.removeEventListener('click', ab._exitPosDrag); ab._exitPosDrag = null; }
    if (ab._exitPosDragEsc) { document.removeEventListener('keydown', ab._exitPosDragEsc); ab._exitPosDragEsc = null; }
    ab._posDragging = false;
    ab.classList.remove('pos-dragging', 'img-editing');
  });
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
  // 페이지 전환 시 히스토리 초기화 — 이전 페이지 스냅샷으로 되돌아가는 버그 방지
  window.clearHistory?.();
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
  clone.querySelectorAll('.block-resize-handle, .img-corner-handle, .img-edit-hint, .ci-handle, .shape-handle').forEach(el => el.remove());
  clone.querySelectorAll('.ci-selected').forEach(el => el.classList.remove('ci-selected'));
  clone.querySelectorAll('.ci-active').forEach(el => el.classList.remove('ci-active'));
  // 편집 상태 속성 제거 — contenteditable/editing 상태가 저장되지 않도록
  clone.querySelectorAll('[contenteditable]').forEach(el => el.removeAttribute('contenteditable'));
  clone.querySelectorAll('.editing').forEach(el => el.classList.remove('editing'));
  // 드래그 중단 시 고착된 상태 제거
  clone.querySelectorAll('.dragging').forEach(el => el.classList.remove('dragging'));
  clone.querySelectorAll('.ss-drag-over').forEach(el => el.classList.remove('ss-drag-over'));
  // group-block 선택/편집 상태 제거 — 저장 후 리로드 시 초기 상태로 복원되도록
  clone.querySelectorAll('.group-block').forEach(g => g.classList.remove('group-selected', 'group-editing'));
  clone.querySelectorAll('.drop-indicator').forEach(el => el.remove());
  // 섹션 임시 스타일 제거 — 미리보기/썸네일용 scale transform이 저장에 포함되지 않도록
  clone.querySelectorAll('.section-block').forEach(sec => {
    sec.style.transform       = '';
    sec.style.transformOrigin = '';
    sec.style.position        = '';
    sec.style.left            = '';
    sec.style.pointerEvents   = '';
    sec.style.userSelect      = '';
  });
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
  window.renderChecklistPanel?.();
  // 프로젝트 로드/탭 전환 후 히스토리 초기화 — 이전 프로젝트/페이지 스냅샷 잔류 방지
  window.clearHistory?.();
}

function applyPageSettings() {
  canvasWrap.style.background = state.pageSettings.bg;
  canvasEl.style.gap = state.pageSettings.gap + 'px';
  canvasEl.style.setProperty('--page-pady', state.pageSettings.padY + 'px');
  // padX: 섹션 물리적 padding 방식으로 적용 (섹션 개별 override 제외)
  window.applyPagePadX?.(state.pageSettings.padX);
}

function migrateColsFromDOM(canvasEl) {
  // sub-section-block → frame-block 리네임 (구버전 저장 호환)
  canvasEl.querySelectorAll('.sub-section-block').forEach(el => {
    el.classList.replace('sub-section-block', 'frame-block');
  });
  // sub-section-inner / frame-inner → 제거 (래퍼 제거, 자식을 frame-block 직속으로)
  canvasEl.querySelectorAll('.sub-section-inner, .frame-inner').forEach(inner => {
    const parent = inner.parentElement;
    if (!parent) return;
    [...inner.childNodes].forEach(child => parent.appendChild(child));
    inner.remove();
  });
  // 인라인 핸들 제거 — 핸들은 이제 #ss-handles-overlay에서 렌더링
  canvasEl.querySelectorAll('.frame-block > .ss-resize-handle').forEach(h => h.remove());

  // Stack row: col wrapper 제거, 자식 블록을 row 직속으로 이동
  canvasEl.querySelectorAll('.row[data-layout="stack"] > .col').forEach(col => {
    const row = col.parentElement;
    // col의 배경색이 있으면 row로 승계
    if (col.style.backgroundColor) row.style.backgroundColor = col.style.backgroundColor;
    [...col.childNodes].forEach(child => {
      if (child.classList?.contains('col-placeholder')) return; // placeholder 제거
      row.appendChild(child);
    });
    col.remove();
  });
  canvasEl.querySelectorAll('.row[data-layout="grid"][data-card-grid], .row[data-layout="grid"]').forEach(row => {
    const cols = [...row.querySelectorAll(':scope > .col')];
    if (cols.length === 0) return;
    // card-grid 마이그레이션 — card-block 제거 이후 불필요하므로 스킵
    return;
    cols.forEach(col => {
      [...col.childNodes].forEach(child => row.appendChild(child));
      col.remove();
    });
    row.dataset.cardGrid = '1';
  });
  // Flex/Grid row: col → NewGrid 변환
  canvasEl.querySelectorAll('.row[data-layout="flex"], .row[data-layout="grid"]').forEach(row => {
    if (row.dataset.cardGrid) return; // 카드 그리드는 위에서 처리
    const cols = [...row.querySelectorAll(':scope > .col')];
    if (cols.length < 2) {
      // 단일 col이면 stack처럼 처리
      if (cols.length === 1) {
        if (cols[0].style.backgroundColor) row.style.backgroundColor = cols[0].style.backgroundColor;
        [...cols[0].childNodes].forEach(child => {
          if (child.classList?.contains('col-placeholder')) return;
          row.appendChild(child);
        });
        cols[0].remove();
        row.dataset.layout = 'stack';
      }
      return;
    }
    // 멀티 col → NewGrid 변환
    const gap = 16;
    const colCount = cols.length;
    const ratios = cols.map(c => parseFloat(c.style.flex) || parseFloat(c.dataset.flex) || 1);
    // 변환 전 해당 row의 섹션을 활성화
    const sec = row.closest('.section-block');
    if (sec) {
      document.querySelectorAll('.section-block.selected').forEach(s => s.classList.remove('selected'));
      sec.classList.add('selected');
      window._activeFrame = null;
    }
    const gridFrame = window.addNewGridBlock?.(colCount, 1, { gap, ratios });
    if (!gridFrame) {
      // addNewGridBlock 없으면 col-placeholder만 제거
      cols.forEach(col => col.querySelector('.col-placeholder')?.remove());
      return;
    }
    // 각 col 내용을 cell frame에 이식
    const cellFrames = [...gridFrame.querySelectorAll('[data-grid-cell]')];
    cols.forEach((col, i) => {
      const cell = cellFrames[i];
      if (!cell) return;
      [...col.childNodes].forEach(child => {
        if (child.classList?.contains('col-placeholder')) return;
        cell.appendChild(child);
      });
    });
    row.replaceWith(gridFrame);
  });

  // row[data-layout="stack"] > text-block → frame-block[data-text-frame] > text-block
  // col 제거 후 실행해야 row 직속 text-block을 올바르게 감지함
  canvasEl.querySelectorAll('.row[data-layout="stack"] > .text-block').forEach(tb => {
    const row = tb.parentElement;
    if (row.closest('.asset-overlay')) return; // overlay-tb는 제외
    const tf = document.createElement('div');
    tf.className = 'frame-block';
    tf.id = 'ss_' + Math.random().toString(36).slice(2, 9);
    tf.dataset.textFrame = 'true';
    tf.dataset.bg = 'transparent';
    tf.style.cssText = 'background:transparent;width:100%;box-sizing:border-box;';
    if (row.dataset.paddingX) {
      tf.dataset.paddingX   = row.dataset.paddingX;
      tf.style.paddingLeft  = row.dataset.paddingX + 'px';
      tf.style.paddingRight = row.dataset.paddingX + 'px';
    }
    row.before(tf);
    tf.appendChild(tb);
    if ([...row.childNodes].every(n => n.nodeType === Node.TEXT_NODE && !n.textContent.trim())) {
      row.remove();
    }
  });

  // freeLayout frame-block 직속 text-block → frame-block[data-text-frame] > text-block
  // absolute 위치/크기를 text-frame으로 이전, text-block은 flow 자식으로
  canvasEl.querySelectorAll('.frame-block[data-free-layout="true"] > .text-block, .frame-block[data-freeLayout="true"] > .text-block').forEach(tb => {
    const tf = document.createElement('div');
    tf.className = 'frame-block';
    tf.id = 'ss_' + Math.random().toString(36).slice(2, 9);
    tf.dataset.textFrame = 'true';
    tf.dataset.bg = 'transparent';
    // 절대 위치/크기를 text-frame으로 이전
    const pos = tb.style.cssText; // e.g. "position: absolute; left: 0px; top: 20px; width: 100%;"
    tf.style.cssText = pos + ';box-sizing:border-box;';
    tb.style.cssText = ''; // text-block에서 절대 위치 제거
    // dataset.width도 이전
    if (tb.dataset.width) {
      tf.dataset.width = tb.dataset.width;
      delete tb.dataset.width;
    }
    tb.before(tf);
    tf.appendChild(tb);
  });
}

function rebindAll() {
  migrateColsFromDOM(canvasEl);
  // undo/redo 복원 중(_historyPaused)에는 clearHistory 금지 — 호출 시 히스토리 스택 전체 초기화되어 1스텝만 undo 가능해지는 버그
  if (!window._historyPaused) window.clearHistory?.();
  // asset-overlay 오염 정리: contenteditable 제거 + 직접 텍스트 노드 제거
  canvasEl.querySelectorAll('.asset-overlay').forEach(overlay => {
    overlay.removeAttribute('contenteditable');
    [...overlay.childNodes].filter(n => n.nodeType === Node.TEXT_NODE).forEach(n => n.remove());
  });

  canvasEl.querySelectorAll('.section-block').forEach(sec => {
    if (!sec.id) sec.id = 'sec_' + Math.random().toString(36).slice(2, 9);
    if (sec.dataset.name) sec._name = sec.dataset.name;
    // 템플릿 프리뷰 잔여 인라인 스타일 무조건 초기화 (scale/transform-origin/position/left/pointer-events 등)
    sec.style.transform       = '';
    sec.style.transformOrigin = '';
    sec.style.position        = '';
    sec.style.left            = '';
    sec.style.pointerEvents   = '';
    sec.style.userSelect      = '';
    // 섹션 배경색 복원
    if (sec.dataset.bg && !sec.style.backgroundColor) {
      sec.style.backgroundColor = sec.dataset.bg;
    }
    // section-inner paddingX 복원
    const secInner = sec.querySelector('.section-inner');
    if (secInner && secInner.dataset.paddingX !== undefined && secInner.dataset.paddingX !== '') {
      secInner.style.paddingLeft  = secInner.dataset.paddingX + 'px';
      secInner.style.paddingRight = secInner.dataset.paddingX + 'px';
      // usePadx 복원: 개별 asset-block의 패딩 제외 설정
      const px = parseInt(secInner.dataset.paddingX) || 0;
      if (px > 0) {
        secInner.querySelectorAll('.asset-block').forEach(ab => {
          if (ab.dataset.usePadx === 'true') {
            ab.style.marginLeft  = -px + 'px';
            ab.style.marginRight = -px + 'px';
            ab.style.width = `calc(100% + ${px * 2}px)`;
          }
        });
      }
    }
    // 배경 이미지 복원
    if (sec.dataset.bgImg && !sec.style.backgroundImage) {
      sec.style.backgroundImage = `url(${sec.dataset.bgImg})`;
      sec.style.backgroundSize = sec.dataset.bgSize || 'cover';
      sec.style.backgroundPosition = sec.dataset.bgPos || 'center';
      sec.style.backgroundRepeat = 'no-repeat';
    }
    if (!sec._secClickBound) {
      sec._secClickBound = true;
      sec.addEventListener('click', e => {
        e.stopPropagation();
        window.selectSectionWithModifier(sec, e);
        const row = e.target.closest('.row');
        if (row && !e.target.closest('.text-block, .asset-block, .gap-block, .col-placeholder, .icon-circle-block, .table-block, .graph-block, .divider-block, .label-group-block, .icon-text-block, .canvas-block')) {
          document.querySelectorAll('.row.row-active').forEach(r => r.classList.remove('row-active'));
          row.classList.add('row-active');
          if (window.syncLayerRow) window.syncLayerRow(row);
        }
      });
    }
    bindSectionDelete(sec);
    bindSectionOrder(sec);
    bindSectionDropZone(sec);
    // bindSectionHitzone은 hz.cloneNode(true)로 label을 교체하므로
    // 반드시 bindSectionHitzone 이후에 bindSectionDrag를 호출해야 함 (FIX-SD-01)
    if (window.bindSectionHitzone) window.bindSectionHitzone(sec);
    bindSectionDrag(sec);
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
  // row ID 복원 + paddingX 복원
  canvasEl.querySelectorAll('.row').forEach(row => {
    if (!row.id) row.id = 'row_' + Math.random().toString(36).slice(2, 9);
    if (row.dataset.paddingX !== undefined && row.dataset.paddingX !== '') {
      row.style.paddingLeft  = row.dataset.paddingX + 'px';
      row.style.paddingRight = row.dataset.paddingX + 'px';
    }
  });

  // 저장 시 제거된 contenteditable 속성 복원 (텍스트 블록 내부 편집 가능 요소)
  // + placeholder 여부 판단 (data-is-placeholder가 없으면 내용과 비교해서 설정)
  const _phTextMap = {
    'tb-h1':'제목을 입력하세요', 'tb-h2':'소제목을 입력하세요', 'tb-h3':'소항목을 입력하세요',
    'tb-body':'본문 내용을 입력하세요.', 'tb-caption':'캡션을 입력하세요', 'tb-label':'Label'
  };
  // 말풍선 SVG 말꼬리 마이그레이션 (구버전 저장 파일 대응)
  const _BUBBLE_TAIL_SVG = `<svg class="tb-bubble-tail" viewBox="0 0 18 16" xmlns="http://www.w3.org/2000/svg" width="18" height="16"><path d="M18 0 C14 4 7 8 0 16 C5 9 10 4 18 0Z"/></svg>`;
  canvasEl.querySelectorAll('.speech-bubble-block').forEach(sb => {
    const existingTail = sb.querySelector('.tb-bubble-tail');
    if (!existingTail) {
      sb.insertAdjacentHTML('beforeend', _BUBBLE_TAIL_SVG);
    } else {
      // 이전 Figma-derived path(10.78 포함)가 있으면 현재 path로 교체
      const p = existingTail.querySelector('path');
      if (p && p.getAttribute('d')?.includes('10.78')) {
        existingTail.setAttribute('viewBox', '0 0 18 16');
        existingTail.setAttribute('width', '18');
        existingTail.setAttribute('height', '16');
        p.setAttribute('d', 'M18 0 C14 4 7 8 0 16 C5 9 10 4 18 0Z');
      }
    }
    // 구버전: --bubble-bg가 contentEl에 설정된 경우 → speech-bubble-block으로 이전
    const bubbleEl = sb.querySelector('.tb-bubble');
    if (bubbleEl) {
      const oldVar = bubbleEl.style.getPropertyValue('--bubble-bg');
      if (oldVar) {
        sb.style.setProperty('--bubble-bg', oldVar);
        bubbleEl.style.removeProperty('--bubble-bg');
      }
    }
  });

  canvasEl.querySelectorAll('.text-block').forEach(tb => {
    const inner = tb.querySelector('.tb-h1,.tb-h2,.tb-h3,.tb-body,.tb-caption,.tb-label,.tb-bubble');
    if (!inner) return;
    if (!inner.hasAttribute('contenteditable')) {
      inner.setAttribute('contenteditable', 'false');
    }
    // placeholder 속성 보정: data-placeholder 없으면 클래스로 추정
    if (!inner.dataset.placeholder) {
      const cls = [...inner.classList].find(c => _phTextMap[c]);
      if (cls) inner.dataset.placeholder = _phTextMap[cls];
    }
    // data-is-placeholder 보정: 저장된 내용이 placeholder 텍스트와 같거나 비어있으면 placeholder 상태로 표시
    if (inner.dataset.isPlaceholder !== 'true') {
      const ph = inner.dataset.placeholder;
      const txt = inner.textContent.trim();
      if (ph && (txt === '' || txt === ph.trim())) {
        if (txt === '') inner.innerHTML = ph; // 비어있으면 placeholder 텍스트 복원
        inner.dataset.isPlaceholder = 'true';
      }
    }
  });

  // shape-block 구버전 인라인 width/height 제거 — CSS 100%로 frame 추종
  canvasEl.querySelectorAll('.shape-block').forEach(b => {
    b.style.width = '';
    b.style.height = '';
    const svg = b.querySelector('svg');
    if (svg) {
      svg.style.width = ''; svg.style.height = '';
      // preserveAspectRatio="none" — frame 크기에 맞게 SVG 변형
      svg.setAttribute('preserveAspectRatio', 'none');
    }
    // shape frame inline height 제거 — frame-block 직속 shape-block, height는 frame-block이 관리
    const parentFrame = b.closest('.frame-block');
    if (parentFrame) parentFrame.style.height = parentFrame.dataset.height ? `${parentFrame.dataset.height}px` : '';
  });

  canvasEl.querySelectorAll('.text-block, .asset-block, .gap-block, .icon-circle-block, .table-block, .label-group-block, .card-block, .graph-block, .divider-block, .icon-text-block, .shape-block, .joker-block, .canvas-block, .icon-block, .mockup-block, .step-block, .vector-block').forEach(b => {
    if (!b.id) {
      const prefix = b.classList.contains('text-block') ? 'tb'
        : b.classList.contains('asset-block') ? 'ab'
        : b.classList.contains('gap-block') ? 'gb'
        : b.classList.contains('icon-circle-block') ? 'icb'
        : b.classList.contains('label-group-block') ? 'lg'
        : b.classList.contains('card-block') ? 'cdb'
        : b.classList.contains('canvas-block') ? 'cvb'
        : b.classList.contains('graph-block') ? 'grb'
        : b.classList.contains('icon-text-block') ? 'itb'
        : b.classList.contains('icon-block') ? 'icn'
        : b.classList.contains('mockup-block') ? 'mkp'
        : b.classList.contains('step-block') ? 'stb'
        : b.classList.contains('vector-block') ? 'vb'
        : b.classList.contains('divider-block') ? 'dvd' : 'tbl';
      b.id = prefix + '_' + Math.random().toString(36).slice(2, 9);
    }
    window.bindBlock(b);
  });
  // card-block 스타일 복원 (bgColor, radius, textAlign은 dataset에 저장되나 inline style은 재적용 필요)
  canvasEl.querySelectorAll('.card-block').forEach(cdb => {
    const bg = cdb.dataset.bgColor;
    const r  = parseInt(cdb.dataset.radius) || 12;
    const align = cdb.dataset.textAlign;
    const body = cdb.querySelector('.cdb-body');
    if (body) {
      if (bg) body.style.background = bg;
      body.style.borderRadius = `0 0 ${r}px ${r}px`;
    }
    cdb.style.borderRadius = r + 'px';
    if (align) {
      const title = cdb.querySelector('.cdb-title');
      const desc  = cdb.querySelector('.cdb-desc');
      if (title) title.style.textAlign = align;
      if (desc)  desc.style.textAlign  = align;
    }
    const titleSize = parseInt(cdb.dataset.titleSize);
    const descSize  = parseInt(cdb.dataset.descSize);
    const titleEl2 = cdb.querySelector('.cdb-title');
    const descEl2  = cdb.querySelector('.cdb-desc');
    if (titleEl2 && titleSize) titleEl2.style.fontSize = titleSize + 'px';
    if (descEl2  && descSize)  descEl2.style.fontSize  = descSize  + 'px';
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
  // frame-block 클릭/드롭 핸들러 재연결 (저장/로드 후 누락 방지)
  canvasEl.querySelectorAll('.frame-block').forEach(ss => {
    if (!ss.id) ss.id = 'ss_' + Math.random().toString(36).slice(2, 9);
    ss._subSecBound = false; // rebind 강제
    window.bindFrameDropZone?.(ss);
    // 배경 이미지 복원
    if (ss.dataset.bgImg && !ss.style.backgroundImage) {
      ss.style.backgroundImage = `url(${ss.dataset.bgImg})`;
      ss.style.backgroundSize = 'cover';
      ss.style.backgroundPosition = ss.dataset.bgPos || 'center';
    } else if (ss.dataset.bgPos && ss.style.backgroundImage) {
      ss.style.backgroundPosition = ss.dataset.bgPos;
    }
    // 보더 복원
    const bw = parseInt(ss.dataset.borderWidth) || 0;
    if (bw > 0) {
      ss.style.border = `${bw}px ${ss.dataset.borderStyle || 'solid'} ${ss.dataset.borderColor || '#888888'}`;
    }
    // 배경색 복원
    if (ss.dataset.bg && !ss.style.backgroundColor) ss.style.backgroundColor = ss.dataset.bg;
    // 코너 반경 복원
    if (ss.dataset.radius) ss.style.borderRadius = ss.dataset.radius + 'px';
    // explicit height 복원 — justify-content 정렬 작동을 위해 필요
    // dataset.height 없으면 minHeight 폴백 (레거시 요소 대응)
    const _ssH = parseInt(ss.dataset.height) || parseInt(ss.style.minHeight) || 0;
    if (_ssH) ss.style.height = _ssH + 'px';
    // 자식 정렬 복원 (frame-block 직속)
    if (ss.dataset.alignItems)     ss.style.alignItems     = ss.dataset.alignItems;
    if (ss.dataset.justifyContent) ss.style.justifyContent = ss.dataset.justifyContent;
    if (ss.dataset.gap)            ss.style.gap            = ss.dataset.gap + 'px';
    // 위치 / 회전 / 반전 복원
    const _tx = parseInt(ss.dataset.translateX) || 0;
    const _ty = parseInt(ss.dataset.translateY) || 0;
    const _rd = parseFloat(ss.dataset.rotateDeg) || 0;
    const _fx = ss.dataset.flipH === '1' ? -1 : 1;
    const _fy = ss.dataset.flipV === '1' ? -1 : 1;
    if (_tx || _ty || _rd || _fx !== 1 || _fy !== 1) {
      ss.style.transform = `translate(${_tx}px,${_ty}px) rotate(${_rd}deg) scale(${_fx},${_fy})`;
    }
  });

  // table-block 로드 후 dataset 복원 (showHeader, cellAlign, fontSize, cellPad)
  canvasEl.querySelectorAll('.table-block').forEach(block => {
    const thead = block.querySelector('thead');
    if (block.dataset.showHeader === 'false' && thead) {
      thead.style.display = 'none';
    }
    const cellAlign = block.dataset.cellAlign;
    if (cellAlign) {
      block.querySelectorAll('th, td').forEach(cell => { cell.style.textAlign = cellAlign; });
    }
    const fontSize = parseInt(block.dataset.fontSize);
    if (fontSize) {
      const table = block.querySelector('.tb-table');
      if (table) table.style.fontSize = fontSize + 'px';
    }
    const cellPad = parseInt(block.dataset.cellPad);
    if (cellPad) {
      block.querySelectorAll('th, td').forEach(cell => { cell.style.padding = cellPad + 'px 16px'; });
    }
  });

  // mockup-block 로드 후 화면 이미지 복원
  canvasEl.querySelectorAll('.mockup-block').forEach(block => {
    const imgSrc = block.dataset.imgSrc;
    if (imgSrc) {
      const screen = block.querySelector('.mkp-screen');
      if (screen) {
        screen.style.background = `url('${imgSrc}') top center / 100% auto no-repeat, repeating-conic-gradient(#d8d8d8 0% 25%, #f0f0f0 0% 50%) 0 0 / 72px 72px`;
        screen.innerHTML = '';
      }
    }
    // 그림자 복원
    const shadow = block.dataset.shadow || 'soft';
    const shadows = { none:'none', soft:'0 20px 60px rgba(0,0,0,0.25)', strong:'0 30px 80px rgba(0,0,0,0.55)' };
    block.style.filter = shadow === 'none' ? '' : `drop-shadow(${shadows[shadow]})`;
    // 숨겨진 소스 섹션 복원
    const secId = block.dataset.sourceSec;
    if (secId) {
      const sec = document.getElementById(secId);
      if (sec && sec.dataset.mockupHidden === 'true') sec.style.display = 'none';
    }
  });

  // step-block 로드 후 재렌더링 (data-* → DOM 복원)
  canvasEl.querySelectorAll('.step-block').forEach(block => {
    window.renderStepBlock?.(block);
  });

}

const LAST_COMMIT_KEY = 'goya-last-commit';

/* ── localStorage 용량 관리 ── */

/**
 * 활성 프로젝트 ID 목록에 없는 고아 autosave 키 정리.
 * 삭제된 프로젝트 또는 파일이 더 최신인 프로젝트의 autosave 키를 제거한다.
 * @param {string[]} activeProjectIds - 현재 존재하는 프로젝트 ID 배열
 */
function cleanStaleAutosaveKeys(activeProjectIds) {
  const prefix = SAVE_KEY_PREFIX + '__';
  const activeSet = new Set(activeProjectIds);
  Object.keys(localStorage)
    .filter(k => k.startsWith(prefix) && !k.endsWith('_ts'))
    .forEach(k => {
      const pid = k.slice(prefix.length);
      if (!activeSet.has(pid)) {
        localStorage.removeItem(k);
        localStorage.removeItem(k + '_ts');
        console.log('[save-load] 고아 autosave 키 정리:', k);
      }
    });
}

/**
 * localStorage.setItem 래퍼 — QuotaExceededError 발생 시 오래된 autosave 키를
 * 하나씩 제거하며 최대 5회 재시도한다.
 * @param {string} key
 * @param {string} value
 * @returns {boolean} 저장 성공 여부
 */
function safeLocalStorageSet(key, value) {
  const prefix = SAVE_KEY_PREFIX + '__';
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (e) {
      if (e.name !== 'QuotaExceededError' && e.name !== 'NS_ERROR_DOM_QUOTA_REACHED') throw e;
      // 현재 저장하려는 키를 제외한 autosave 키 중 가장 오래된 것 삭제
      const candidates = Object.keys(localStorage)
        .filter(k => k.startsWith(prefix) && !k.endsWith('_ts') && k !== key);
      if (candidates.length === 0) {
        // 삭제 가능한 키 없음 — 실패 반환
        console.warn('[save-load] QuotaExceededError: 삭제 가능한 autosave 키 없음, 저장 실패');
        window.showToast?.('⚠️ 저장 공간이 부족합니다. 오래된 프로젝트를 삭제해 주세요.');
        return false;
      }
      // _ts 키로 타임스탬프 비교해 가장 오래된 키 선택
      const oldest = candidates.sort((a, b) => {
        const ta = parseInt(localStorage.getItem(a + '_ts') || '0');
        const tb = parseInt(localStorage.getItem(b + '_ts') || '0');
        return ta - tb;
      })[0];
      localStorage.removeItem(oldest);
      localStorage.removeItem(oldest + '_ts');
      console.warn('[save-load] QuotaExceededError: 오래된 autosave 키 삭제 후 재시도 -', oldest);
      window.showToast?.('⚠️ 저장 공간이 부족해 오래된 자동저장을 정리했습니다.');
    }
  }
  return false;
}

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
  // BUG-12: activeProjectId가 없으면 'web-editor-autosave__undefined' 키로 저장되는 버그 방지
  if (!activeProjectId) { console.warn('[save-load] scheduleAutoSave: activeProjectId 없음, 저장 건너뜀'); return; }
  clearTimeout(autoSaveTimer);
  _setAutosaveIndicator('saving');
  // debounce 1500ms: Notion ~1s, Figma ~2s 중간값. 데이터 손실·저장 폭주 균형점.
  autoSaveTimer = setTimeout(() => {
    const snap = serializeProject();
    // S11: 빈 canvas 저장 방지 — _suppressAutoSave 해제 직후 빈 상태 덮어쓰기 방지
    try {
      const snapData = JSON.parse(snap);
      if (_isAllCanvasEmpty(snapData)) {
        console.warn('[save-load] scheduleAutoSave: 빈 canvas, localStorage 저장 건너뜀');
        _setAutosaveIndicator('saved');
        return;
      }
    } catch {}
    const saveOk = safeLocalStorageSet(getSaveKey(), snap);
    if (saveOk) localStorage.setItem(getSaveTsKey(), String(Date.now()));
    saveProjectToFile(snap, { skipThumbnail: true }); // 자동저장은 썸네일 캡처 생략
    _setAutosaveIndicator('saved');
  }, 1500);
}

// 새로고침/탭 닫기 시 항상 localStorage에 flush (autoSaveTimer 여부 무관)
window.addEventListener('beforeunload', () => {
  // BUG-12: activeProjectId 없으면 undefined 키 오염 방지
  if (!activeProjectId) return;
  clearTimeout(autoSaveTimer);
  autoSaveTimer = null;
  const snap = serializeProject();
  // S11: 빈 canvas 저장 방지 + snap 파싱은 한 번만
  let snapData;
  try { snapData = JSON.parse(snap); } catch { return; }
  if (snapData?.pages?.length > 0 && snapData.pages.every(p => !p.canvas || p.canvas.trim() === '')) return;

  const _unloadSaveOk = safeLocalStorageSet(getSaveKey(), snap);
  if (_unloadSaveOk) localStorage.setItem(getSaveTsKey(), String(Date.now()));
  // non-Electron: PROJECTS_KEY snapshot 동기 업데이트 (파싱 결과 재사용)
  if (!IS_ELECTRON && activeProjectId) {
    try {
      const list = JSON.parse(localStorage.getItem(PROJECTS_KEY) || '[]');
      const proj = list.find(p => p.id === activeProjectId);
      if (proj) {
        proj.snapshot = snapData;
        proj.updatedAt = new Date().toISOString();
        localStorage.setItem(PROJECTS_KEY, JSON.stringify(list));
      }
    } catch {}
  }
});

// 앱 종료 전 강제 저장 (Electron before-quit IPC)
if (IS_ELECTRON) {
  window.electronAPI.onForceSaveBeforeQuit(async () => {
    if (!activeProjectId) { window.electronAPI.quitReady(); return; }
    // debounce 타이머 즉시 취소
    if (autoSaveTimer) { clearTimeout(autoSaveTimer); autoSaveTimer = null; }
    const snap = serializeProject();
    let snapData;
    try { snapData = JSON.parse(snap); } catch { window.electronAPI.quitReady(); return; }
    if (_isAllCanvasEmpty(snapData)) { window.electronAPI.quitReady(); return; }
    try {
      await saveProjectToFile(snapData, { skipThumbnail: true });
    } catch (e) {
      console.error('[save-load] force-save-before-quit 저장 실패:', e);
    }
    window.electronAPI.quitReady();
  });
}

// 변경 감지 — canvas MutationObserver
// class 속성 변경만 제외 (드래그 UI 상태 토글 spam 방지, DBG-11)
// data-* 속성 변경(prop 패널 값)은 감지해야 하므로 attributes:true 포함
const autoSaveObserver = new MutationObserver(mutations => {
  if (mutations.every(m => m.type === 'attributes' && m.attributeName === 'class')) return;
  scheduleAutoSave();
});

/* ── Init (called from editor.js after all scripts loaded) ── */
function initApp() {
  // 이미 백업이 있으면 되돌리기 버튼 활성화
  if (localStorage.getItem(LAST_COMMIT_KEY)) {
    const revertBtn = document.getElementById('revert-btn');
    if (revertBtn) revertBtn.classList.add('has-commit');
  }
  canvasWrap.style.background = state.pageSettings.bg;
  canvasEl.style.gap = state.pageSettings.gap + 'px';
  canvasEl.style.setProperty('--page-pady', state.pageSettings.padY + 'px');
  // padX: 섹션 물리적 padding 방식으로 적용
  window.applyPagePadX?.(state.pageSettings.padX);
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
      try { applyProjectData(data); } catch(e) {
        console.error('[initApp] applyProjectData 실패, initEmpty fallback:', e);
        initEmpty();
      }
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
        // Electron: 파일 기반 활성 프로젝트 목록으로 고아 autosave 키 정리
        try {
          const allProjects = await window.electronAPI.listProjects();
          cleanStaleAutosaveKeys(allProjects.map(p => p.id));
        } catch (_) {}
        // proj + meta 병렬 로드 — meta 실패해도 proj는 사용해야 하므로 독립 처리
        let proj = null;
        try { proj = await window.electronAPI.loadProject(activeProjectId); } catch(e) {
          console.error('[initLoad] loadProject 실패:', e);
        }
        const meta = await window.electronAPI.loadProjectMeta(activeProjectId).catch(() => null);
        if (proj) {
          // 마이그레이션: proj.json에 branches/commits가 남아있으면 meta로 이전
          if (!meta && (proj.branches || proj.commits)) {
            const migratedMeta = {
              ...(proj.branches    ? { branches: proj.branches, currentBranch: proj.currentBranch } : {}),
              ...(proj.commits     ? { commits: proj.commits }     : {}),
              ...(proj.thumbnail   ? { thumbnail: proj.thumbnail } : {}),
              updatedAt: new Date().toISOString(),
            };
            window.electronAPI.saveProjectMeta(activeProjectId, migratedMeta).catch(() => {});
            // proj.json에서 meta 필드 제거하여 경량화
            const cleanProj = { ...proj };
            delete cleanProj.branches; delete cleanProj.currentBranch;
            delete cleanProj.commits; delete cleanProj.thumbnail;
            window.electronAPI.saveProject(cleanProj).catch(() => {});
          }
          name = proj.name || 'Untitled';
        }
        // proj null이어도 탭바는 반드시 렌더 (이름은 Untitled로 유지)
        const tab = openTabs.find(t => t.id === activeProjectId);
        if (tab) tab.name = name;
        window.renderTabBar();
        if (proj) {
          // DBG-REFRESH: 프로젝트별 키로 localStorage 조회 — 다른 프로젝트 데이터 오염 방지
          // localStorage가 파일보다 새로우면 우선 적용 (새로고침 데이터 손실 방지)
          // 단, 파일 페이지 수가 더 많으면 파일 우선 (meta 오류 등으로 인한 1페이지 오염 방지)
          const lsTs = parseInt(localStorage.getItem(getSaveTsKey()) || '0');
          const fileTs = new Date(proj.updatedAt || 0).getTime();
          const filePagesCount = proj.version === 2 ? (proj.pages?.length || 0) : (proj.snapshot?.pages?.length || 1);
          if (lsTs > 0 && lsTs + 500 > fileTs) {
            const lsSaved = localStorage.getItem(getSaveKey());
            if (lsSaved) {
              try {
                const lsData = JSON.parse(lsSaved);
                const lsPagesCount = lsData.pages?.length || 0;
                // localStorage 페이지 수가 파일보다 적거나 0이면 파일이 더 완전한 데이터 → 파일 우선
                if (lsPagesCount > 0 && lsPagesCount >= filePagesCount) { applyAndFinish(lsData); return; }
              } catch {}
            }
          }
          if (proj.version === 2 && proj.pages) { applyAndFinish(proj); return; }
          // v1 snapshot: 파싱 실패 시 return하지 않고 아래 localStorage fallback으로 진행
          if (proj.snapshot) {
            try {
              applyAndFinish(typeof proj.snapshot === 'string' ? JSON.parse(proj.snapshot) : proj.snapshot);
              return;
            } catch (e) {
              console.error('[initLoad] v1 snapshot 파싱 실패, localStorage fallback:', e);
            }
          }
        }
      } else {
        // 브라우저: localStorage 프로젝트 목록으로 고아 autosave 키 정리
        const allList = loadProjectsList();
        cleanStaleAutosaveKeys(allList.map(p => p.id));
        const proj = allList.find(p => p.id === activeProjectId);
        if (proj?.name) {
          name = proj.name;
          const tab = openTabs.find(t => t.id === activeProjectId);
          if (tab) tab.name = name;
        }
        window.renderTabBar();
        if (proj?.snapshot) {
          try {
            applyAndFinish(typeof proj.snapshot === 'string' ? JSON.parse(proj.snapshot) : proj.snapshot);
            return;
          } catch (e) {
            console.error('[initLoad] 브라우저 snapshot 파싱 실패, localStorage fallback:', e);
          }
        }
      }
    } else {
      // URL에 project 없이 열림 (admin mode): 탭 유지하고 렌더만
      window.renderTabBar();
    }
    const saved = localStorage.getItem(getSaveKey());
    if (saved) { try { applyAndFinish(JSON.parse(saved)); return; } catch {} }
    initEmpty();
  })();

  // class 변경은 콜백에서 필터링, data-* 등 실제 속성 변경은 감지 (DBG-11 해소)
  autoSaveObserver.observe(canvasEl, { childList: true, subtree: true, characterData: true, attributes: true });

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

  // Cmd+G 그룹 / Cmd+Option+G 프레임 — capture phase로 브라우저 Find Next 보다 먼저 처리
  document.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.code === 'KeyG' && !e.shiftKey) {
      if (e.target.isContentEditable) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (e.altKey || window._optionKeyHeld || e.key === '©') {
        window.wrapSelectedBlocksInFrame?.();
      } else {
        groupSelectedBlocks();
      }
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
    // FIX-SD-02: drop 시점에 _suppressAutoSave=true (dragend 아직 미발화)
    // MutationObserver가 scheduleAutoSave를 억제하므로 drop 직후 명시적으로 저장 트리거
    state._suppressAutoSave = false;
    scheduleAutoSave();
  });
}

export {
  // 탭 함수: tab-system.js에서 window 노출 처리 (여기서는 저장/불러오기 핵심만)
  cleanStaleAutosaveKeys,
  safeLocalStorageSet,
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

// 즉시 저장 (디바운스 없이 flush) — commit-system.js 저장하기 버튼 전용
// saveProjectToFile 경로를 우회하고 IPC를 직접 호출해 _isSavingToFile 락 문제 방지
window.flushSave = async function() {
  clearTimeout(autoSaveTimer);
  autoSaveTimer = null;
  const snap = serializeProject();
  let data;
  try {
    data = JSON.parse(snap);
    if (_isAllCanvasEmpty(data)) return;
  } catch { return; }
  localStorage.setItem(getSaveKey(), snap);
  localStorage.setItem(getSaveTsKey(), String(Date.now()));
  const _targetId = window.activeProjectId;
  if (window.IS_ELECTRON && _targetId) {
    try {
      const existing = await window.electronAPI.loadProject(_targetId);
      const proj = {
        ...(existing || {}),
        ...data,
        id: _targetId,
        name: existing?.name || data.name || 'Untitled',
        updatedAt: new Date().toISOString(),
      };
      await window.electronAPI.saveProject(proj);
    } catch (e) {
      console.error('[flushSave] 저장 실패:', e);
      window.showToast?.('❌ 저장 실패: ' + (e.message || '알 수 없는 오류'));
      return;
    }
  }
  _setAutosaveIndicator('saved');
};
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
