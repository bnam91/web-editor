/**
 * component-shelf.js
 * 컴포넌트 선반 — 섹션/Row를 저장하고 재사용하는 기능 (시안 B)
 */

const STORAGE_KEY = 'goya_component_shelf';

// ── 내부 유틸 ──────────────────────────────────────────

function _load() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch (e) {
    return [];
  }
}

function _save(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

function _genId() {
  return 'comp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
}

// ── 공개 API ───────────────────────────────────────────

/**
 * 선택된 섹션/Row의 HTML을 컴포넌트로 localStorage에 저장
 * @param {string} name  컴포넌트 이름
 * @param {string} html  저장할 outerHTML
 * @returns {string} 생성된 컴포넌트 id
 */
function saveAsComponent(name, html) {
  const list = _load();
  const id = _genId();
  list.push({ id, name, html, createdAt: new Date().toISOString() });
  _save(list);
  return id;
}

/**
 * 저장된 컴포넌트 목록 반환
 * @returns {Array<{id, name, html, createdAt}>}
 */
function listComponents() {
  return _load();
}

/**
 * 저장된 컴포넌트를 캔버스 끝에 삽입
 * @param {string} id  컴포넌트 id
 */
function insertComponent(id) {
  const list = _load();
  const comp = list.find(c => c.id === id);
  if (!comp) {
    window.showToast && window.showToast('컴포넌트를 찾을 수 없습니다.');
    return;
  }

  const canvas = document.getElementById('canvas');
  if (!canvas) return;

  // 임시 컨테이너로 파싱
  const tmp = document.createElement('div');
  tmp.innerHTML = comp.html;

  // 각 자식 노드를 캔버스에 추가
  while (tmp.firstChild) {
    canvas.appendChild(tmp.firstChild);
  }

  // 이벤트 재바인딩
  if (typeof window.rebindAll === 'function') {
    window.rebindAll();
  }

  window.showToast && window.showToast(`"${comp.name}" 삽입 완료`);
}

/**
 * 컴포넌트 삭제
 * @param {string} id  컴포넌트 id
 */
function deleteComponent(id) {
  const list = _load().filter(c => c.id !== id);
  _save(list);
}

// ── 패널 UI ───────────────────────────────────────────

let _panelEl = null;

function _buildPanel() {
  if (_panelEl) return _panelEl;

  const panel = document.createElement('div');
  panel.className = 'comp-shelf-panel';
  panel.id = 'comp-shelf-panel';
  panel.innerHTML = `
    <div class="comp-shelf-header">
      <span class="comp-shelf-title">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.6">
          <rect x="1" y="1" width="4" height="4" rx="0.5"/>
          <rect x="7" y="1" width="4" height="4" rx="0.5"/>
          <rect x="1" y="7" width="4" height="4" rx="0.5"/>
          <rect x="7" y="7" width="4" height="4" rx="0.5"/>
        </svg>
        Component Shelf
      </span>
      <button class="comp-shelf-close" id="comp-shelf-close-btn" title="닫기">
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.8">
          <line x1="1" y1="1" x2="9" y2="9"/><line x1="9" y1="1" x2="1" y2="9"/>
        </svg>
      </button>
    </div>

    <div class="comp-shelf-save-area" id="comp-shelf-save-area">
      <input
        type="text"
        class="comp-shelf-name-input"
        id="comp-shelf-name-input"
        placeholder="컴포넌트 이름 입력..."
        maxlength="40"
      />
      <button class="comp-shelf-save-btn" id="comp-shelf-save-btn">+ 저장</button>
    </div>

    <div class="comp-shelf-list" id="comp-shelf-list"></div>
  `;

  document.body.appendChild(panel);
  _panelEl = panel;

  // 닫기 버튼
  panel.querySelector('#comp-shelf-close-btn').addEventListener('click', closeShelfPanel);

  // 저장 버튼
  panel.querySelector('#comp-shelf-save-btn').addEventListener('click', _onSaveClick);

  // Enter 키 저장
  panel.querySelector('#comp-shelf-name-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') _onSaveClick();
  });

  return panel;
}

function _onSaveClick() {
  const nameInput = document.getElementById('comp-shelf-name-input');
  const name = (nameInput?.value || '').trim();

  if (!name) {
    nameInput?.focus();
    window.showToast && window.showToast('컴포넌트 이름을 입력해주세요.');
    return;
  }

  // 선택된 섹션 또는 Row 찾기
  const selSection = document.querySelector('.section-block.selected');
  const selRow = document.querySelector('.row-block.selected');
  const target = selSection || selRow;

  if (!target) {
    window.showToast && window.showToast('섹션 또는 Row를 먼저 선택해주세요.');
    return;
  }

  saveAsComponent(name, target.outerHTML);
  nameInput.value = '';
  _renderList();
  window.showToast && window.showToast(`"${name}" 저장 완료`);
}

function _renderList() {
  const listEl = document.getElementById('comp-shelf-list');
  if (!listEl) return;

  const comps = listComponents();

  if (comps.length === 0) {
    listEl.innerHTML = `
      <div class="comp-shelf-empty">
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="#444" stroke-width="1.3">
          <rect x="3" y="3" width="10" height="10" rx="1.5"/>
          <rect x="15" y="3" width="10" height="10" rx="1.5"/>
          <rect x="3" y="15" width="10" height="10" rx="1.5"/>
          <rect x="15" y="15" width="10" height="10" rx="1.5"/>
        </svg>
        <span>저장된 컴포넌트가 없습니다.<br>섹션을 선택 후 저장해보세요.</span>
      </div>
    `;
    return;
  }

  listEl.innerHTML = comps.map(c => `
    <div class="comp-shelf-card" data-id="${c.id}">
      <div class="comp-shelf-card-info">
        <div class="comp-shelf-card-name">${_escHtml(c.name)}</div>
        <div class="comp-shelf-card-date">${_formatDate(c.createdAt)}</div>
      </div>
      <div class="comp-shelf-card-actions">
        <button class="comp-shelf-insert-btn" data-id="${c.id}" title="캔버스에 삽입">삽입</button>
        <button class="comp-shelf-delete-btn" data-id="${c.id}" title="삭제">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.6">
            <line x1="1" y1="1" x2="9" y2="9"/><line x1="9" y1="1" x2="1" y2="9"/>
          </svg>
        </button>
      </div>
    </div>
  `).join('');

  // 이벤트 바인딩
  listEl.querySelectorAll('.comp-shelf-insert-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      insertComponent(btn.dataset.id);
      closeShelfPanel();
    });
  });

  listEl.querySelectorAll('.comp-shelf-delete-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      deleteComponent(btn.dataset.id);
      _renderList();
    });
  });
}

function _escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function _formatDate(iso) {
  try {
    const d = new Date(iso);
    return `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  } catch (e) {
    return '';
  }
}

// ── 패널 열기/닫기 ────────────────────────────────────

function openShelfPanel() {
  const panel = _buildPanel();
  _renderList();
  panel.classList.add('open');
  // 이름 입력 포커스
  setTimeout(() => {
    document.getElementById('comp-shelf-name-input')?.focus();
  }, 120);
}

function closeShelfPanel() {
  _panelEl && _panelEl.classList.remove('open');
}

function toggleShelfPanel() {
  if (!_panelEl || !_panelEl.classList.contains('open')) {
    openShelfPanel();
  } else {
    closeShelfPanel();
  }
}

// ── 전역 노출 ─────────────────────────────────────────

window.CompShelf = {
  saveAsComponent,
  listComponents,
  insertComponent,
  deleteComponent,
  open: openShelfPanel,
  close: closeShelfPanel,
  toggle: toggleShelfPanel,
};
