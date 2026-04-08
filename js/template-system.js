/* ═══════════════════════════════════
   TEMPLATE SYSTEM
═══════════════════════════════════ */
import { canvasEl } from './globals.js';

const TEMPLATE_KEY = 'sangpe-templates'; // localStorage fallback key

let _templatesCache = null;  // 메타데이터 전용 (canvas 없음)
let _lsFullCache    = [];    // 비-Electron 전용: canvas 포함 전체 데이터

// 앱 시작 시 1회 호출
async function initTemplates() {
  if (window.electronAPI?.loadTemplateIndex) {
    _templatesCache = await window.electronAPI.loadTemplateIndex();
    // localStorage 기존 데이터 → 파일로 마이그레이션
    const lsRaw = localStorage.getItem(TEMPLATE_KEY);
    if (lsRaw && _templatesCache.length === 0) {
      try {
        const old = JSON.parse(lsRaw) || [];
        const index = [];
        for (const tpl of old) {
          const { canvas, ...meta } = tpl;
          if (canvas) {
            try {
              await window.electronAPI.saveTemplateCanvas(tpl.id, canvas);
              index.push(meta); // canvas 저장 성공한 항목만 index에 추가
            } catch (e) {
              console.warn('[template] canvas 저장 실패 — index에서 제외:', tpl.id, e);
            }
          } else {
            index.push(meta); // canvas 없는 메타 전용 항목은 그대로 추가
          }
        }
        _templatesCache = index;
        await window.electronAPI.saveTemplateIndex(index);
        localStorage.removeItem(TEMPLATE_KEY);
      } catch (e) { console.warn('[template] 마이그레이션 실패:', e); }
    }
  } else {
    // 비-Electron fallback — localStorage에서 canvas 포함 전체 로드
    try { _lsFullCache = JSON.parse(localStorage.getItem(TEMPLATE_KEY)) || []; } catch (e) { console.warn('[template] localStorage 로드 실패:', e); }
    _templatesCache = _lsFullCache.map(({ canvas, ...meta }) => meta);
  }
}

function loadTemplates() {
  return _templatesCache || [];
}

function saveTemplates(arr) {
  _templatesCache = arr;
  if (window.electronAPI?.saveTemplateIndex) {
    window.electronAPI.saveTemplateIndex(arr);
  } else {
    // localStorage: 메타 업데이트하되 canvas 데이터 유지
    _lsFullCache = arr.map(meta => {
      const existing = _lsFullCache.find(t => t.id === meta.id);
      return existing ? { ...meta, canvas: existing.canvas } : meta;
    });
    localStorage.setItem(TEMPLATE_KEY, JSON.stringify(_lsFullCache));
  }
}

// canvas HTML 로드 (파일 or localStorage fallback)
async function _loadCanvas(id) {
  if (window.electronAPI?.loadTemplateCanvas) {
    try {
      return await window.electronAPI.loadTemplateCanvas(id);
    } catch (e) {
      console.warn('[template] canvas 파일 로드 실패:', id, e);
      return null;
    }
  }
  const full = _lsFullCache.find(t => t.id === id);
  if (!full) console.warn('[template] canvas 캐시 미발견:', id);
  return full ? full.canvas : null;
}

async function saveAsTemplate(el, name, folder, category, tags, type = 'section') {
  const clone = el.cloneNode(true);
  clone.classList.remove('selected');
  clone.querySelectorAll('.selected, .editing').forEach(el => el.classList.remove('selected', 'editing'));
  clone.querySelectorAll('[contenteditable="true"]').forEach(el => el.setAttribute('contenteditable', 'false'));
  clone.querySelectorAll('.block-resize-handle, .img-corner-handle, .img-edit-hint').forEach(el => el.remove());

  const id  = 'tpl_' + Date.now();
  const html = clone.outerHTML;
  const tagsArr = Array.isArray(tags) ? tags : [];

  if (window.electronAPI?.saveTemplateCanvas) {
    await window.electronAPI.saveTemplateCanvas(id, html);
  } else {
    _lsFullCache.unshift({ id, name, folder: folder || '기타', category, tags: tagsArr, createdAt: new Date().toISOString(), thumbnail: null, type: type || 'section', canvas: html });
  }

  const templates = loadTemplates();
  templates.unshift({ id, name, folder: folder || '기타', category, tags: tagsArr, createdAt: new Date().toISOString(), thumbnail: null, type: type || 'section' });
  saveTemplates(templates);
  renderTemplatePanel();
}

async function deleteTemplate(id) {
  if (window.electronAPI?.deleteTemplateCanvas) {
    await window.electronAPI.deleteTemplateCanvas(id);
  } else {
    _lsFullCache = _lsFullCache.filter(t => t.id !== id);
  }
  saveTemplates(loadTemplates().filter(t => t.id !== id));
  renderTemplatePanel();
}

async function insertTemplate(tpl) {
  const canvas = await _loadCanvas(tpl.id);
  if (!canvas) {
    window.showToast?.('❌ 템플릿 불러오기 실패: 파일이 없거나 손상됐습니다.');
    return;
  }

  // subsection 타입: 선택된 섹션 안에 삽입
  if (tpl.type === 'subsection') {
    const targetSec = window.getSelectedSection?.();
    if (!targetSec) {
      window.showToast?.('섹션을 먼저 선택하세요') ?? alert('섹션을 먼저 선택하세요');
      return;
    }
    const tmp = document.createElement('div');
    tmp.innerHTML = canvas;
    const ss = tmp.firstElementChild;
    if (!ss || !ss.classList.contains('frame-block')) return;

    // ID 재생성 (중복 방지)
    ss.id = 'ss_' + Math.random().toString(36).slice(2, 9);
    ss._subSecBound = false;

    // frame-block은 row 안에 있어야 함
    const row = document.createElement('div');
    row.className = 'row';
    row.id = 'row_' + Math.random().toString(36).slice(2, 9);
    row.dataset.layout = 'stack';
    const col = document.createElement('div');
    col.className = 'col';
    col.dataset.width = '100';
    col.appendChild(ss);
    row.appendChild(col);

    // 선택된 섹션의 콘텐츠 영역(section-inner 또는 직접)에 append
    const inner = targetSec.querySelector('.section-inner') || targetSec;
    inner.appendChild(row);

    // 이벤트 재바인딩
    window.bindFrameDropZone?.(ss);
    // 내부 블록 이벤트 핸들러 재등록 (Section 삽입과 동일 수준)
    ss.querySelectorAll('.text-block, .asset-block, .gap-block, .icon-circle-block, .table-block, .label-group-block, .card-block, .graph-block, .divider-block, .icon-text-block, .shape-block, .joker-block').forEach(b => window.bindBlock?.(b));
    ss.querySelectorAll('.group-block').forEach(g => window.bindGroupDrag?.(g));
    if (ss.dataset.bg) ss.style.backgroundColor = ss.dataset.bg;
    if (ss.dataset.bgImg && !ss.style.backgroundImage) {
      ss.style.backgroundImage = `url(${ss.dataset.bgImg})`;
      ss.style.backgroundSize = 'cover';
      ss.style.backgroundPosition = ss.dataset.bgPos || 'center';
    }
    if (ss.dataset.radius) ss.style.borderRadius = ss.dataset.radius + 'px';
    const bw = parseInt(ss.dataset.borderWidth) || 0;
    if (bw > 0) ss.style.border = `${bw}px ${ss.dataset.borderStyle || 'solid'} ${ss.dataset.borderColor || '#888'}`;

    window.pushHistory?.();
    window.buildLayerPanel?.();
    window.scheduleAutoSave?.();
    return;
  }

  // 기존 section 타입 삽입 로직
  const tmp = document.createElement('div');
  tmp.innerHTML = canvas;
  const sec = tmp.firstElementChild;
  if (!sec || !sec.classList.contains('section-block')) return;

  // 모든 ID 재생성 (동일 템플릿 2회 삽입 시 중복 ID 방지)
  const genId = (prefix) => prefix + '_' + Math.random().toString(36).slice(2, 9);
  sec.id = genId('sec');
  sec.querySelectorAll('[id]').forEach(el => {
    const prefix = el.id.split('_')[0] || 'el';
    el.id = genId(prefix);
  });

  // 섹션 번호 갱신
  const secList = canvasEl.querySelectorAll('.section-block');
  const newIdx  = secList.length + 1;
  sec.dataset.section = newIdx;
  // 섹션 이름을 템플릿 이름으로 설정
  sec.dataset.name = tpl.name;
  const labelEl = sec.querySelector('.section-label');
  if (labelEl) {
    labelEl.textContent = tpl.name;
    if (!labelEl.closest('.section-hitzone')) {
      const hz = document.createElement('div');
      hz.className = 'section-hitzone';
      labelEl.parentElement.insertBefore(hz, labelEl);
      hz.appendChild(labelEl);
    }
  }

  // 선택 상태 초기화
  sec.classList.remove('selected');

  // 프리뷰에서 적용된 인라인 스타일 제거 (scale, position, pointer-events 등)
  sec.style.transform     = '';
  sec.style.transformOrigin = '';
  sec.style.position      = '';
  sec.style.left          = '';
  sec.style.pointerEvents = '';
  sec.style.userSelect    = '';

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
  if (window.bindSectionHitzone) window.bindSectionHitzone(sec);
  bindSectionDrag(sec);
  bindSectionDropZone(sec);
  sec.querySelectorAll('.text-block, .asset-block, .gap-block, .icon-circle-block, .table-block, .label-group-block, .card-block, .graph-block, .divider-block, .icon-text-block').forEach(b => bindBlock(b));
  sec.querySelectorAll('.group-block').forEach(g => {
    if (!g.querySelector(':scope > .group-block-label')) {
      const lbl = document.createElement('span');
      lbl.className = 'group-block-label';
      lbl.textContent = g.dataset.name || 'Group';
      g.prepend(lbl);
    }
    bindGroupDrag(g);
  });
  applyPageSettings();
  pushHistory();
  buildLayerPanel();
  selectSection(sec, true);
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

const TPL_FOLDER_KEY = 'tpl-folder-state';
let _activeFolderFilter = '전체';
let _activeSearchQuery  = '';

function loadFolderState() {
  try { return JSON.parse(localStorage.getItem(TPL_FOLDER_KEY)) || {}; } catch { return {}; }
}
function saveFolderState(state) {
  localStorage.setItem(TPL_FOLDER_KEY, JSON.stringify(state));
}

async function showTemplatePreview(id) {
  const tpl = loadTemplates().find(t => t.id === id);
  if (!tpl) return;
  const canvas = await _loadCanvas(id);
  if (!canvas) return;

  // 기존 미리보기 제거
  document.querySelectorAll('.tpl-preview-backdrop').forEach(el => el.remove());

  const backdrop = document.createElement('div');
  backdrop.className = 'tpl-preview-backdrop';
  backdrop.innerHTML = `
    <div class="tpl-preview-modal" role="dialog">
      <div class="tpl-preview-header">
        <div class="tpl-preview-header-info">
          <span class="tpl-preview-title">${escHtml(tpl.name)}</span>
          <span class="tpl-preview-cat">${escHtml(tpl.category || '')}</span>
          ${tpl.folder ? `<span class="tpl-preview-folder">${escHtml(tpl.folder)}</span>` : ''}
        </div>
        <button class="tpl-preview-close" title="닫기">
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="currentColor" stroke-width="1.8">
            <line x1="1" y1="1" x2="7" y2="7"/><line x1="7" y1="1" x2="1" y2="7"/>
          </svg>
        </button>
      </div>
      <div class="tpl-preview-canvas">${canvas}</div>
      <div class="tpl-preview-footer">
        <button class="tpl-preview-insert-btn" data-tpl-id="${escHtml(tpl.id)}">${tpl.type === 'subsection' ? '+ 컴포넌트 삽입' : '+ 섹션 추가'}</button>
      </div>
    </div>`;

  document.body.appendChild(backdrop);

  // Scale section to fit preview viewport
  const previewCanvas = backdrop.querySelector('.tpl-preview-canvas');
  const section = previewCanvas.querySelector('.section-block') || previewCanvas.querySelector('.frame-block');
  if (section) {
    const CANVAS_WIDTH = 860;
    section.style.width = CANVAS_WIDTH + 'px';
    const sectionH = section.scrollHeight;
    const viewportW = previewCanvas.clientWidth;
    const viewportH = previewCanvas.clientHeight;
    const scaleX = viewportW / CANVAS_WIDTH;
    const scaleY = viewportH / sectionH;
    const scale = Math.min(scaleX, scaleY);
    section.style.transform = `scale(${scale})`;
    section.style.transformOrigin = 'top left';
  }

  backdrop.addEventListener('click', e => {
    if (e.target === backdrop) backdrop.remove();
  });

  backdrop.querySelector('.tpl-preview-close').addEventListener('click', e => {
    e.stopPropagation();
    backdrop.remove();
  });

  backdrop.querySelector('.tpl-preview-insert-btn').addEventListener('click', async e => {
    e.stopPropagation();
    const t = loadTemplates().find(x => x.id === e.currentTarget.dataset.tplId);
    if (t) { backdrop.remove(); await insertTemplate(t); }
  });
}

function startEditTemplate(id) {
  const tpl = loadTemplates().find(t => t.id === id);
  if (!tpl) return;

  // 기존 인라인 편집 닫기
  document.querySelectorAll('.tpl-edit-form').forEach(el => el.remove());
  document.querySelectorAll('.tpl-card.editing-mode').forEach(el => el.classList.remove('editing-mode'));

  const card = document.querySelector(`.tpl-card[data-tpl-id="${CSS.escape(id)}"]`);
  if (!card) return;
  card.classList.add('editing-mode');

  const allTemplates = loadTemplates();
  const existingFolders = [...new Set(allTemplates.map(t => t.folder || '기타'))];
  const currentFolder = tpl.folder || '기타';
  const folderOptions = existingFolders.map(f =>
    `<option value="${escHtml(f)}" ${f === currentFolder ? 'selected' : ''}>${escHtml(f)}</option>`
  ).join('');
  const catOptions = ['Hero','Main','Feature','Detail','CTA','Event','기타'].map(c =>
    `<option value="${escHtml(c)}" ${c === (tpl.category || '기타') ? 'selected' : ''}>${escHtml(c)}</option>`
  ).join('');

  const currentTags = (tpl.tags || []).join(', ');

  const form = document.createElement('div');
  form.className = 'tpl-edit-form';
  form.innerHTML = `
    <input class="tpl-edit-name" type="text" value="${escHtml(tpl.name)}" placeholder="템플릿 이름" />
    <select class="tpl-edit-folder">${folderOptions}<option value="__new__">새 폴더...</option></select>
    <input class="tpl-edit-folder-new" type="text" placeholder="새 폴더 이름" style="display:none;" />
    <select class="tpl-edit-cat">${catOptions}</select>
    <input class="tpl-edit-tags" type="text" value="${escHtml(currentTags)}" placeholder="태그 (쉼표 구분)" />
    <div class="tpl-edit-actions">
      <button class="tpl-edit-save">저장</button>
      <button class="tpl-edit-cancel">취소</button>
      <button class="tpl-edit-overwrite" title="현재 선택된 섹션으로 덮어쓰기">덮어쓰기</button>
    </div>`;

  card.insertAdjacentElement('afterend', form);

  const folderSel = form.querySelector('.tpl-edit-folder');
  const folderNewInput = form.querySelector('.tpl-edit-folder-new');
  folderSel.addEventListener('change', () => {
    folderNewInput.style.display = folderSel.value === '__new__' ? 'block' : 'none';
  });

  form.querySelector('.tpl-edit-cancel').addEventListener('click', () => {
    form.remove(); card.classList.remove('editing-mode');
  });

  form.querySelector('.tpl-edit-save').addEventListener('click', () => {
    const newName = form.querySelector('.tpl-edit-name').value.trim();
    const newCat  = form.querySelector('.tpl-edit-cat').value;
    let newFolder = folderSel.value === '__new__'
      ? (folderNewInput.value.trim() || '기타')
      : folderSel.value;
    const newTagsRaw = form.querySelector('.tpl-edit-tags')?.value || '';
    const newTags = newTagsRaw.split(',').map(t => t.trim()).filter(Boolean);
    if (!newName) return;
    const templates = loadTemplates();
    const idx = templates.findIndex(t => t.id === id);
    if (idx !== -1) {
      templates[idx].name = newName;
      templates[idx].folder = newFolder;
      templates[idx].category = newCat;
      templates[idx].tags = newTags;
      saveTemplates(templates);
    }
    form.remove();
    renderTemplatePanel();
  });

  form.querySelector('.tpl-edit-overwrite').addEventListener('click', async () => {
    const sec = canvasEl.querySelector('.section-block.selected');
    if (!sec) { alert('덮어쓸 섹션을 먼저 선택하세요.'); return; }
    const clone = sec.cloneNode(true);
    clone.classList.remove('selected');
    clone.querySelectorAll('.selected, .editing').forEach(el => el.classList.remove('selected', 'editing'));
    clone.querySelectorAll('[contenteditable="true"]').forEach(el => el.setAttribute('contenteditable', 'false'));
    clone.querySelectorAll('.block-resize-handle, .img-corner-handle, .img-edit-hint').forEach(el => el.remove());
    if (window.electronAPI?.saveTemplateCanvas) {
      await window.electronAPI.saveTemplateCanvas(id, clone.outerHTML);
    } else {
      const fi = _lsFullCache.findIndex(t => t.id === id);
      if (fi !== -1) { _lsFullCache[fi].canvas = clone.outerHTML; localStorage.setItem(TEMPLATE_KEY, JSON.stringify(_lsFullCache)); }
    }
    form.remove();
    renderTemplatePanel();
  });

  form.querySelector('.tpl-edit-name').focus();
}

function renderTemplatePanel() {
  const body = document.getElementById('template-panel-body');
  if (!body) return;
  const templates = loadTemplates();

  // 전체 폴더 목록 (기존 데이터 호환: folder 없으면 "기타")
  const allFolders = [...new Set(templates.map(t => t.folder || '기타'))];

  // 폴더 필터가 더 이상 유효하지 않으면 "전체"로 리셋
  if (_activeFolderFilter !== '전체' && !allFolders.includes(_activeFolderFilter)) {
    _activeFolderFilter = '전체';
  }

  // 검색 + 폴더 필터 HTML
  const folderDropdown = `
    <div class="tpl-search-bar">
      <input class="tpl-search-input" type="text" placeholder="이름·태그 검색..." value="${escHtml(_activeSearchQuery)}" />
    </div>
    <div class="tpl-folder-filter">
      <select class="tpl-folder-select">
        <option value="전체" ${_activeFolderFilter === '전체' ? 'selected' : ''}>전체 보기</option>
        ${allFolders.map(f => `<option value="${escHtml(f)}" ${f === _activeFolderFilter ? 'selected' : ''}>${escHtml(f)}</option>`).join('')}
      </select>
    </div>`;

  if (!templates.length) {
    body.innerHTML = folderDropdown + '<div class="tpl-empty">저장된 템플릿이 없습니다</div>';
    _bindFolderDropdown(body);
    _bindSearchInput(body);
    return;
  }

  // 폴더 필터 적용
  let filtered = _activeFolderFilter === '전체'
    ? templates
    : templates.filter(t => (t.folder || '기타') === _activeFolderFilter);

  // 검색 필터 적용 (이름 OR 태그)
  if (_activeSearchQuery.trim()) {
    const q = _activeSearchQuery.trim().toLowerCase();
    filtered = filtered.filter(t => {
      const nameMatch = t.name.toLowerCase().includes(q);
      const tagMatch  = (t.tags || []).some(tag => tag.toLowerCase().includes(q));
      return nameMatch || tagMatch;
    });
  }

  // 카테고리별 그룹핑
  const groups = {};
  filtered.forEach(tpl => {
    const cat = tpl.category || '기타';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(tpl);
  });

  const folderState = loadFolderState();

  const listHtml = Object.entries(groups).map(([cat, tpls]) => {
    const isOpen = folderState[cat] !== false;
    return `
      <div class="tpl-folder" data-folder-cat="${escHtml(cat)}">
        <div class="tpl-folder-header ${isOpen ? 'open' : ''}">
          <svg class="tpl-folder-arrow" width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="currentColor" stroke-width="1.8">
            <polyline points="2,2 6,4 2,6"/>
          </svg>
          <span class="tpl-folder-cat-name">${escHtml(cat)}</span>
          <span class="tpl-folder-count">${tpls.length}</span>
        </div>
        <div class="tpl-folder-body" style="display:${isOpen ? 'block' : 'none'}">
          ${tpls.map(tpl => {
            const date = tpl.createdAt ? tpl.createdAt.slice(0, 10) : '';
            const tagBadges = (tpl.tags || []).length
              ? `<div class="tpl-card-tags">${(tpl.tags).map(tag => `<span class="tpl-tag-badge" data-tag="${escHtml(tag)}">${escHtml(tag)}</span>`).join('')}</div>`
              : '';
            const typeBadge = tpl.type === 'subsection'
              ? `<span class="tpl-type-badge" style="font-size:9px;background:#2a3a5a;color:#6a9fdf;padding:1px 5px;border-radius:3px;margin-left:4px;">컴포넌트</span>`
              : '';
            return `
              <div class="tpl-card" data-tpl-id="${escHtml(tpl.id)}">
                <div class="tpl-card-main">
                  <span class="tpl-card-name">${escHtml(tpl.name)}</span>${typeBadge}
                </div>
                ${tagBadges}
                <div class="tpl-card-meta">${escHtml(date)}</div>
                <div class="tpl-card-actions">
                  <button class="tpl-edit-btn" data-tpl-id="${escHtml(tpl.id)}" title="수정">
                    <svg width="8" height="8" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.6">
                      <path d="M1 9 L2.5 5.5 L7.5 0.5 L9.5 2.5 L4.5 7.5 Z"/><line x1="6" y1="2" x2="8" y2="4"/>
                    </svg>
                  </button>
                  <button class="tpl-delete-btn" data-tpl-id="${escHtml(tpl.id)}" title="삭제">
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="currentColor" stroke-width="1.8">
                      <line x1="1" y1="1" x2="7" y2="7"/><line x1="7" y1="1" x2="1" y2="7"/>
                    </svg>
                  </button>
                </div>
              </div>`;
          }).join('')}
        </div>
      </div>`;
  }).join('');

  const emptyMsg = _activeSearchQuery.trim()
    ? '<div class="tpl-empty">검색 결과가 없습니다</div>'
    : '<div class="tpl-empty">이 폴더에 템플릿이 없습니다</div>';

  body.innerHTML = folderDropdown + (listHtml || emptyMsg);

  _bindFolderDropdown(body);
  _bindSearchInput(body);

  // 카테고리 토글
  body.querySelectorAll('.tpl-folder-header').forEach(header => {
    header.addEventListener('click', () => {
      const folder = header.closest('.tpl-folder');
      const cat = folder.dataset.folderCat;
      const folderBody = folder.querySelector('.tpl-folder-body');
      const isOpen = header.classList.toggle('open');
      folderBody.style.display = isOpen ? 'block' : 'none';
      const state = loadFolderState();
      state[cat] = isOpen;
      saveFolderState(state);
    });
  });

  // 태그 뱃지 클릭 → 태그 검색 필터
  body.querySelectorAll('.tpl-tag-badge').forEach(badge => {
    badge.addEventListener('click', e => {
      e.stopPropagation();
      _activeSearchQuery = badge.dataset.tag || '';
      renderTemplatePanel();
    });
  });

  // 카드 클릭 → 미리보기
  body.querySelectorAll('.tpl-card').forEach(card => {
    card.addEventListener('click', e => {
      if (e.target.closest('.tpl-delete-btn') || e.target.closest('.tpl-edit-btn') || e.target.closest('.tpl-tag-badge')) return;
      showTemplatePreview(card.dataset.tplId);
    });
  });

  // 수정 버튼
  body.querySelectorAll('.tpl-edit-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      startEditTemplate(btn.dataset.tplId);
    });
  });

  // 삭제 버튼
  body.querySelectorAll('.tpl-delete-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      deleteTemplate(btn.dataset.tplId);
    });
  });
}

function _bindFolderDropdown(body) {
  const sel = body.querySelector('.tpl-folder-select');
  if (!sel) return;
  sel.addEventListener('change', () => {
    _activeFolderFilter = sel.value;
    renderTemplatePanel();
  });
}

function _bindSearchInput(body) {
  const input = body.querySelector('.tpl-search-input');
  if (!input) return;
  input.addEventListener('input', () => {
    _activeSearchQuery = input.value;
    renderTemplatePanel();
  });
  // 포커스 유지 (리렌더 후 커서 유지)
  if (_activeSearchQuery) {
    input.focus();
    const len = input.value.length;
    input.setSelectionRange(len, len);
  }
}

// 크로스 모듈 접근용 window 노출
window.loadTemplates        = loadTemplates;
window.saveAsTemplate       = saveAsTemplate;
window.deleteTemplate       = deleteTemplate;
window.insertTemplate       = insertTemplate;
window.renderTemplatePanel  = renderTemplatePanel;
window.initTemplates        = initTemplates;
window._loadCanvas          = _loadCanvas;
window.showTemplatePreview  = showTemplatePreview;
