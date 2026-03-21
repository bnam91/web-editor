/* ═══════════════════════════════════
   TEMPLATE SYSTEM
═══════════════════════════════════ */
const TEMPLATE_KEY = 'sangpe-templates';

function loadTemplates() {
  try { return JSON.parse(localStorage.getItem(TEMPLATE_KEY)) || []; } catch { return []; }
}

function saveTemplates(arr) {
  localStorage.setItem(TEMPLATE_KEY, JSON.stringify(arr));
}

function saveAsTemplate(sec, name, category) {
  const clone = sec.cloneNode(true);
  clone.classList.remove('selected');
  clone.querySelectorAll('.selected, .editing').forEach(el => el.classList.remove('selected', 'editing'));
  clone.querySelectorAll('[contenteditable="true"]').forEach(el => el.setAttribute('contenteditable', 'false'));
  clone.querySelectorAll('.block-resize-handle, .img-corner-handle, .img-edit-hint').forEach(el => el.remove());
  const templates = loadTemplates();
  templates.unshift({
    id: 'tpl_' + Date.now(),
    name,
    category,
    createdAt: new Date().toISOString(),
    thumbnail: null,
    canvas: clone.outerHTML
  });
  saveTemplates(templates);
  renderTemplatePanel();
}

function deleteTemplate(id) {
  const templates = loadTemplates().filter(t => t.id !== id);
  saveTemplates(templates);
  renderTemplatePanel();
}

function insertTemplate(tpl) {
  const tmp = document.createElement('div');
  tmp.innerHTML = tpl.canvas;
  const sec = tmp.firstElementChild;
  if (!sec || !sec.classList.contains('section-block')) return;

  // 섹션 번호 갱신
  const secList = canvasEl.querySelectorAll('.section-block');
  const newIdx  = secList.length + 1;
  sec.dataset.section = newIdx;
  const labelEl = sec.querySelector('.section-label');
  if (labelEl) labelEl.textContent = `Section ${String(newIdx).padStart(2,'0')}`;

  // 선택 상태 초기화
  sec.classList.remove('selected');

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
  bindSectionDrag(sec);
  bindSectionDropZone(sec);
  sec.querySelectorAll('.text-block, .asset-block, .gap-block, .icon-circle-block, .table-block').forEach(b => bindBlock(b));
  sec.querySelectorAll('.group-block').forEach(g => {
    if (!g.querySelector(':scope > .group-block-label')) {
      const lbl = document.createElement('span');
      lbl.className = 'group-block-label';
      lbl.textContent = g.dataset.name || 'Group';
      g.prepend(lbl);
    }
    bindGroupDrag(g);
  });
  sec.querySelectorAll('.col > .col-placeholder').forEach(ph => {
    const col = ph.parentElement;
    const fresh = makeColPlaceholder(col);
    col.replaceChild(fresh, ph);
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

function loadFolderState() {
  try { return JSON.parse(localStorage.getItem(TPL_FOLDER_KEY)) || {}; } catch { return {}; }
}
function saveFolderState(state) {
  localStorage.setItem(TPL_FOLDER_KEY, JSON.stringify(state));
}

function showTemplatePreview(id) {
  const tpl = loadTemplates().find(t => t.id === id);
  if (!tpl) return;

  // 기존 미리보기 제거
  document.querySelectorAll('.tpl-preview-overlay').forEach(el => el.remove());

  const overlay = document.createElement('div');
  overlay.className = 'tpl-preview-overlay';
  overlay.innerHTML = `
    <div class="tpl-preview-header">
      <span class="tpl-preview-title">${escHtml(tpl.name)}</span>
      <span class="tpl-preview-cat">${escHtml(tpl.category || '')}</span>
      <button class="tpl-preview-close" title="닫기">
        <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="currentColor" stroke-width="1.8">
          <line x1="1" y1="1" x2="7" y2="7"/><line x1="7" y1="1" x2="1" y2="7"/>
        </svg>
      </button>
    </div>
    <div class="tpl-preview-canvas">${tpl.canvas}</div>
    <div class="tpl-preview-footer">
      <button class="tpl-preview-insert-btn" data-tpl-id="${escHtml(tpl.id)}">+ 섹션 추가</button>
    </div>`;

  const body = document.getElementById('template-panel-body');
  body.appendChild(overlay);

  overlay.querySelector('.tpl-preview-close').addEventListener('click', e => {
    e.stopPropagation();
    overlay.remove();
  });

  overlay.querySelector('.tpl-preview-insert-btn').addEventListener('click', e => {
    e.stopPropagation();
    const t = loadTemplates().find(x => x.id === e.currentTarget.dataset.tplId);
    if (t) { insertTemplate(t); overlay.remove(); }
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

  const form = document.createElement('div');
  form.className = 'tpl-edit-form';
  form.innerHTML = `
    <input class="tpl-edit-name" type="text" value="${escHtml(tpl.name)}" placeholder="템플릿 이름" />
    <input class="tpl-edit-cat" type="text" value="${escHtml(tpl.category || '')}" placeholder="카테고리" />
    <div class="tpl-edit-actions">
      <button class="tpl-edit-save">저장</button>
      <button class="tpl-edit-cancel">취소</button>
      <button class="tpl-edit-overwrite" title="현재 선택된 섹션으로 덮어쓰기">덮어쓰기</button>
    </div>`;

  card.insertAdjacentElement('afterend', form);

  form.querySelector('.tpl-edit-cancel').addEventListener('click', () => {
    form.remove(); card.classList.remove('editing-mode');
  });

  form.querySelector('.tpl-edit-save').addEventListener('click', () => {
    const newName = form.querySelector('.tpl-edit-name').value.trim();
    const newCat  = form.querySelector('.tpl-edit-cat').value.trim();
    if (!newName) return;
    const templates = loadTemplates();
    const idx = templates.findIndex(t => t.id === id);
    if (idx !== -1) {
      templates[idx].name = newName;
      templates[idx].category = newCat;
      saveTemplates(templates);
    }
    form.remove();
    renderTemplatePanel();
  });

  form.querySelector('.tpl-edit-overwrite').addEventListener('click', () => {
    const sec = canvasEl.querySelector('.section-block.selected');
    if (!sec) { alert('덮어쓸 섹션을 먼저 선택하세요.'); return; }
    const clone = sec.cloneNode(true);
    clone.classList.remove('selected');
    clone.querySelectorAll('.selected, .editing').forEach(el => el.classList.remove('selected', 'editing'));
    clone.querySelectorAll('[contenteditable="true"]').forEach(el => el.setAttribute('contenteditable', 'false'));
    clone.querySelectorAll('.block-resize-handle, .img-corner-handle, .img-edit-hint').forEach(el => el.remove());
    const templates = loadTemplates();
    const idx = templates.findIndex(t => t.id === id);
    if (idx !== -1) { templates[idx].canvas = clone.outerHTML; saveTemplates(templates); }
    form.remove();
    renderTemplatePanel();
  });

  form.querySelector('.tpl-edit-name').focus();
}

function renderTemplatePanel() {
  const body = document.getElementById('template-panel-body');
  if (!body) return;
  const templates = loadTemplates();
  if (!templates.length) {
    body.innerHTML = '<div class="tpl-empty">저장된 템플릿이 없습니다</div>';
    return;
  }

  // 카테고리별 그룹핑
  const groups = {};
  templates.forEach(tpl => {
    const cat = tpl.category || '기타';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(tpl);
  });

  const folderState = loadFolderState();

  body.innerHTML = Object.entries(groups).map(([cat, tpls]) => {
    const isOpen = folderState[cat] !== false; // 기본 접힘 → true = 펼침
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
            return `
              <div class="tpl-card" data-tpl-id="${escHtml(tpl.id)}">
                <div class="tpl-card-main">
                  <span class="tpl-card-name">${escHtml(tpl.name)}</span>
                </div>
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

  // 폴더 토글
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

  // 카드 클릭 → 미리보기 (P1)
  body.querySelectorAll('.tpl-card').forEach(card => {
    card.addEventListener('click', e => {
      if (e.target.closest('.tpl-delete-btn') || e.target.closest('.tpl-edit-btn')) return;
      showTemplatePreview(card.dataset.tplId);
    });
  });

  // 수정 버튼 (P3)
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
