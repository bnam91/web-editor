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
  // 내장 컴포넌트는 build()로 매번 새 HTML(새 id) 생성
  const builtin = _BUILTINS.find(b => b.id === id);
  const comp = builtin ? { name: builtin.name, html: builtin.build() }
                       : _load().find(c => c.id === id);
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

// ── 내장(built-in) 컴포넌트 ───────────────────────────
// 사용자가 저장한 컴포넌트 외에, 항상 제공되는 기본 컴포넌트.
// 브릿지: 풀폭 밴드 + 상단 중앙 V홈(섹션 배경 비침) — 섹션 경계에 끼워 "아래로 이어짐" 방향 표시 커버.
function _bridgeGenId(p) {
  return (typeof window.genId === 'function') ? window.genId(p) : p + '_' + Math.random().toString(36).slice(2, 9);
}
function _buildBridgeHtml(color) {
  const c = color || '#9a8a78';
  const secId = _bridgeGenId('sec');
  // viewBox 0 0 860 90, 풀폭 stretch(preserveAspectRatio=none). 상단 중앙이 (430,88)까지 파인 깔때기 V홈.
  const path = 'M0 0 L370 0 C410 0 415 88 430 88 C445 88 450 0 490 0 L860 0 L860 90 L0 90 Z';
  return `<div class="section-block" data-section="99" id="${secId}" data-name="Bridge" style="background-color:transparent">
      <div class="section-hitzone"><span class="section-label">Bridge</span></div>
      <div class="section-inner" style="padding:0">
        <div class="bridge-cover" data-bridge-color="${c}" style="width:100%;aspect-ratio:860/90;line-height:0;font-size:0;">
          <svg viewBox="0 0 860 90" width="100%" height="100%" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg" style="display:block;width:100%;height:100%"><path d="${path}" fill="${c}"/></svg>
        </div>
      </div>
    </div>`;
}
const _BUILTINS = [
  { id: 'builtin_bridge', name: '브릿지 (V 커버)', builtin: true, build: () => _buildBridgeHtml() },
];

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

  // 내장 컴포넌트(삭제 불가, "내장" 뱃지) — 항상 상단에 표시
  const builtinHtml = _BUILTINS.map(b => `
    <div class="comp-shelf-card" data-id="${b.id}">
      <div class="comp-shelf-card-info">
        <div class="comp-shelf-card-name">${_escHtml(b.name)} <span style="font-size:9px;color:#7a9;border:1px solid #2a4a3a;border-radius:3px;padding:0 4px;margin-left:2px;">내장</span></div>
      </div>
      <div class="comp-shelf-card-actions">
        <button class="comp-shelf-insert-btn" data-id="${b.id}" title="캔버스에 삽입">삽입</button>
      </div>
    </div>
  `).join('');

  if (comps.length === 0) {
    listEl.innerHTML = builtinHtml + `
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
    // 내장 삽입 버튼 바인딩
    listEl.querySelectorAll('.comp-shelf-insert-btn').forEach(btn => {
      btn.addEventListener('click', () => { insertComponent(btn.dataset.id); closeShelfPanel(); });
    });
    return;
  }

  listEl.innerHTML = builtinHtml + comps.map(c => `
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
