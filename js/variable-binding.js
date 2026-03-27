/* ══════════════════════════════════════════════════
   variable-binding.js
   Figma Variable 개념 시안 C — 변수/토큰 바인딩
   ────────────────────────────────────────────────
   · VariableStore  : localStorage 기반 변수 저장소
   · bindVar        : 블록 요소의 특정 속성에 변수 연결
   · applyAllBindings: 전체 바인딩 값을 실제 스타일에 반영
   · resolveVar     : 변수명 → 현재 값 반환
   · VarPanelUI     : 우측 패널 상단 드로어 UI
══════════════════════════════════════════════════ */

'use strict';

/* ─────────────────────────────────────────────
   VariableStore
   변수 타입: 'color' | 'text' | 'number'
   저장 형태: { name, type, value }[]
───────────────────────────────────────────── */
const VAR_STORAGE_KEY = 'goya_variables_v1';

const VariableStore = (() => {
  function _load() {
    try {
      return JSON.parse(localStorage.getItem(VAR_STORAGE_KEY) || '[]');
    } catch {
      return [];
    }
  }
  function _save(list) {
    localStorage.setItem(VAR_STORAGE_KEY, JSON.stringify(list));
  }

  function listVars() {
    return _load();
  }

  function getVar(name) {
    return _load().find(v => v.name === name) || null;
  }

  function addVar(name, type, value) {
    if (!name || !['color','text','number'].includes(type)) return null;
    const list = _load();
    const existing = list.findIndex(v => v.name === name);
    const entry = { name, type, value: value ?? defaultVal(type) };
    if (existing >= 0) {
      list[existing] = entry;
    } else {
      list.push(entry);
    }
    _save(list);
    return entry;
  }

  function updateVar(name, value) {
    const list = _load();
    const idx = list.findIndex(v => v.name === name);
    if (idx < 0) return false;
    list[idx].value = value;
    _save(list);
    return true;
  }

  function deleteVar(name) {
    const list = _load().filter(v => v.name !== name);
    _save(list);
    // 해당 변수에 연결된 바인딩 제거
    document.querySelectorAll(`[data-var-color="${name}"],[data-var-text="${name}"],[data-var-number="${name}"]`)
      .forEach(el => {
        delete el.dataset.varColor;
        delete el.dataset.varText;
        delete el.dataset.varNumber;
      });
  }

  function defaultVal(type) {
    if (type === 'color')  return '#000000';
    if (type === 'number') return '0';
    return '';
  }

  return { listVars, getVar, addVar, updateVar, deleteVar };
})();

/* ─────────────────────────────────────────────
   resolveVar — 이름으로 현재 값 반환
───────────────────────────────────────────── */
function resolveVar(varName) {
  const v = VariableStore.getVar(varName);
  return v ? v.value : null;
}

/* ─────────────────────────────────────────────
   bindVar — 블록 요소의 속성에 변수 연결
   prop: 'color' | 'text' | 'number'
   data-var-{prop}="varName" dataset으로 기록
───────────────────────────────────────────── */
function bindVar(blockEl, prop, varName) {
  if (!blockEl || !prop) return;
  const key = `var${prop.charAt(0).toUpperCase()}${prop.slice(1)}`;  // varColor, varText, …
  if (varName) {
    blockEl.dataset[key] = varName;
  } else {
    delete blockEl.dataset[key];
  }
  applyAllBindings();
}

/* ─────────────────────────────────────────────
   applyAllBindings — 전체 바인딩을 실제 스타일에 반영
───────────────────────────────────────────── */
function applyAllBindings() {
  const canvas = document.getElementById('canvas');
  if (!canvas) return;

  // color 바인딩 → data-var-color 속성을 가진 블록에 color 적용
  canvas.querySelectorAll('[data-var-color]').forEach(el => {
    const varName = el.dataset.varColor;
    const val = resolveVar(varName);
    if (!val) return;

    // text-block: contenteditable 자식의 color
    const contentEl = el.querySelector('[contenteditable]');
    if (contentEl) {
      contentEl.style.color = val;
    }
    // asset-block, card-block 등: background 적용
    else if (el.classList.contains('asset-block') || el.classList.contains('card-block')) {
      el.style.backgroundColor = val;
    }
    // 그 외 범용: CSS variable로 주입
    else {
      el.style.setProperty('--var-color', val);
    }
  });

  // text 바인딩 → contenteditable 텍스트 내용 교체
  canvas.querySelectorAll('[data-var-text]').forEach(el => {
    const varName = el.dataset.varText;
    const val = resolveVar(varName);
    if (val === null) return;
    const contentEl = el.querySelector('[contenteditable]');
    if (contentEl && !contentEl.dataset.varTextOriginal) {
      contentEl.dataset.varTextOriginal = contentEl.innerText;
    }
    if (contentEl) contentEl.innerText = val;
  });

  // number 바인딩 → CSS 숫자 변수 (px 단위 적용 예시)
  canvas.querySelectorAll('[data-var-number]').forEach(el => {
    const varName = el.dataset.varNumber;
    const val = resolveVar(varName);
    if (val === null) return;
    el.style.setProperty('--var-number', `${val}px`);
  });
}

/* ─────────────────────────────────────────────
   VarPanelUI — 우측 패널 상단 드로어
───────────────────────────────────────────── */
const VarPanelUI = (() => {
  let _isOpen = false;
  let _currentBlock = null;   // 현재 선택된 블록 (bindVar 드롭다운용)

  /* 초기화: panel-right 상단에 토글 버튼 + 드로어 삽입 */
  function init() {
    const panelRight = document.getElementById('panel-right');
    if (!panelRight || document.getElementById('var-toggle-btn')) return;

    // 토글 버튼 주입 (panel-header 위)
    const toggleBtn = document.createElement('button');
    toggleBtn.id = 'var-toggle-btn';
    toggleBtn.title = '변수 바인딩 (Figma Variable)';
    toggleBtn.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.4">
        <circle cx="3" cy="3" r="1.5"/>
        <circle cx="9" cy="9" r="1.5"/>
        <path d="M3 4.5v1.5a3 3 0 003 3h.5"/>
        <path d="M9 7.5V6a3 3 0 00-3-3h-.5"/>
      </svg>
      Variables
    `;
    toggleBtn.onclick = toggle;

    // 드로어
    const drawer = document.createElement('div');
    drawer.id = 'var-panel';
    drawer.innerHTML = _buildDrawerHTML();

    // panel-header 앞에 삽입
    const header = panelRight.querySelector('.panel-header');
    panelRight.insertBefore(drawer, header);
    panelRight.insertBefore(toggleBtn, drawer);

    _bindDrawerEvents(drawer);
  }

  function _buildDrawerHTML() {
    return `
      <div class="var-panel-inner">
        <div class="var-panel-section-title">
          <span>Variables</span>
          <button class="var-add-btn" id="var-add-new-btn" title="변수 추가">
            <svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="5" y1="1" x2="5" y2="9"/><line x1="1" y1="5" x2="9" y2="5"/>
            </svg>
          </button>
        </div>
        <div id="var-list-body"></div>
        <div id="var-add-form" class="var-add-form" style="display:none">
          <input id="var-name-input"  class="var-input" placeholder="변수 이름 (예: primary)" />
          <select id="var-type-select" class="var-select">
            <option value="color">Color</option>
            <option value="text">Text</option>
            <option value="number">Number</option>
          </select>
          <input id="var-value-input" class="var-input" placeholder="값" />
          <div class="var-form-actions">
            <button id="var-save-btn"   class="var-btn var-btn-primary">저장</button>
            <button id="var-cancel-btn" class="var-btn var-btn-ghost">취소</button>
          </div>
        </div>
        <div id="var-bind-section" class="var-bind-section" style="display:none">
          <div class="var-panel-section-title" style="margin-top:8px;">
            <span>Block Binding</span>
          </div>
          <div class="var-bind-row">
            <span class="var-bind-label">Color</span>
            <select id="var-bind-color-select" class="var-select var-bind-select">
              <option value="">— 없음 —</option>
            </select>
          </div>
          <div class="var-bind-row">
            <span class="var-bind-label">Text</span>
            <select id="var-bind-text-select" class="var-select var-bind-select">
              <option value="">— 없음 —</option>
            </select>
          </div>
        </div>
      </div>
    `;
  }

  function _bindDrawerEvents(drawer) {
    // + 버튼 → 폼 토글
    drawer.querySelector('#var-add-new-btn').onclick = () => {
      const form = drawer.querySelector('#var-add-form');
      form.style.display = form.style.display === 'none' ? 'block' : 'none';
    };

    // 저장
    drawer.querySelector('#var-save-btn').onclick = () => {
      const name  = drawer.querySelector('#var-name-input').value.trim();
      const type  = drawer.querySelector('#var-type-select').value;
      const value = drawer.querySelector('#var-value-input').value.trim();
      if (!name) { alert('변수 이름을 입력하세요.'); return; }
      VariableStore.addVar(name, type, value);
      applyAllBindings();
      _refreshList(drawer);
      // 폼 초기화
      drawer.querySelector('#var-add-form').style.display = 'none';
      drawer.querySelector('#var-name-input').value  = '';
      drawer.querySelector('#var-value-input').value = '';
    };

    // 취소
    drawer.querySelector('#var-cancel-btn').onclick = () => {
      drawer.querySelector('#var-add-form').style.display = 'none';
    };

    // 바인딩 드롭다운 변경
    drawer.querySelector('#var-bind-color-select').onchange = (e) => {
      if (_currentBlock) bindVar(_currentBlock, 'color', e.target.value || '');
    };
    drawer.querySelector('#var-bind-text-select').onchange = (e) => {
      if (_currentBlock) bindVar(_currentBlock, 'text', e.target.value || '');
    };

    _refreshList(drawer);
  }

  function _refreshList(drawer) {
    const body = drawer.querySelector('#var-list-body');
    if (!body) return;
    const vars = VariableStore.listVars();
    if (vars.length === 0) {
      body.innerHTML = `<div class="var-empty">변수 없음 — + 버튼으로 추가</div>`;
      return;
    }
    body.innerHTML = vars.map(v => `
      <div class="var-item" data-var-name="${v.name}">
        <span class="var-item-type var-type-${v.type}">${v.type[0].toUpperCase()}</span>
        ${v.type === 'color'
          ? `<span class="var-item-swatch" style="background:${v.value}"></span>`
          : ''}
        <span class="var-item-name" title="${v.name}">${v.name}</span>
        <input class="var-item-value ${v.type === 'color' ? 'var-item-value-color' : ''}"
          type="${v.type === 'color' ? 'color' : 'text'}"
          value="${v.value}"
          data-vname="${v.name}"
          title="값 편집"
        />
        <button class="var-item-del" data-vname="${v.name}" title="삭제">
          <svg width="8" height="8" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.8">
            <line x1="1" y1="1" x2="9" y2="9"/><line x1="9" y1="1" x2="1" y2="9"/>
          </svg>
        </button>
      </div>
    `).join('');

    // 값 편집 이벤트
    body.querySelectorAll('.var-item-value').forEach(inp => {
      inp.addEventListener('input', () => {
        VariableStore.updateVar(inp.dataset.vname, inp.value);
        // 스워치 색상도 갱신
        const swatch = inp.closest('.var-item')?.querySelector('.var-item-swatch');
        if (swatch) swatch.style.background = inp.value;
        applyAllBindings();
      });
    });

    // 삭제 이벤트
    body.querySelectorAll('.var-item-del').forEach(btn => {
      btn.onclick = () => {
        VariableStore.deleteVar(btn.dataset.vname);
        applyAllBindings();
        _refreshList(drawer);
        _refreshBindSection(drawer);
      };
    });

    // bind 섹션 드롭다운 옵션도 갱신
    _refreshBindSection(drawer);
  }

  function _refreshBindSection(drawer) {
    const vars = VariableStore.listVars();
    const colorVars = vars.filter(v => v.type === 'color');
    const textVars  = vars.filter(v => v.type === 'text');

    const colorSel = drawer.querySelector('#var-bind-color-select');
    const textSel  = drawer.querySelector('#var-bind-text-select');

    const currentColorBound = _currentBlock?.dataset.varColor || '';
    const currentTextBound  = _currentBlock?.dataset.varText  || '';

    colorSel.innerHTML = `<option value="">— 없음 —</option>` +
      colorVars.map(v => `<option value="${v.name}" ${v.name === currentColorBound ? 'selected' : ''}>${v.name}</option>`).join('');
    textSel.innerHTML  = `<option value="">— 없음 —</option>` +
      textVars.map(v => `<option value="${v.name}" ${v.name === currentTextBound ? 'selected' : ''}>${v.name}</option>`).join('');
  }

  /* 드로어 열기/닫기 토글 */
  function toggle() {
    _isOpen = !_isOpen;
    const drawer = document.getElementById('var-panel');
    const btn    = document.getElementById('var-toggle-btn');
    if (!drawer) return;
    drawer.classList.toggle('open', _isOpen);
    btn?.classList.toggle('active', _isOpen);
  }

  /* 외부에서 현재 선택 블록 전달 */
  function setCurrentBlock(blockEl) {
    _currentBlock = blockEl;
    const drawer = document.getElementById('var-panel');
    if (!drawer) return;
    const bindSection = drawer.querySelector('#var-bind-section');
    if (bindSection) {
      bindSection.style.display = blockEl ? 'block' : 'none';
      if (blockEl) _refreshBindSection(drawer);
    }
  }

  /* 공개 refresh (외부에서 직접 호출 가능) */
  function refresh() {
    const drawer = document.getElementById('var-panel');
    if (drawer) _refreshList(drawer);
  }

  return { init, toggle, setCurrentBlock, refresh };
})();

/* ─────────────────────────────────────────────
   초기화 — DOM 준비 후
───────────────────────────────────────────── */
function initVariableBinding() {
  VarPanelUI.init();
  applyAllBindings();

  // block 선택 이벤트 훅: showTextProperties / showAssetProperties 래핑
  const _hookBlockSelect = (origFn, prop) => {
    return function(blockEl, ...args) {
      VarPanelUI.setCurrentBlock(blockEl);
      return origFn.call(this, blockEl, ...args);
    };
  };

  // window에 등록되는 타이밍에 맞춰 지연 훅
  setTimeout(() => {
    if (window.showTextProperties) {
      const _orig = window.showTextProperties;
      window.showTextProperties = function(blockEl) {
        VarPanelUI.setCurrentBlock(blockEl);
        return _orig.call(this, blockEl);
      };
    }
    if (window.showAssetProperties) {
      const _orig = window.showAssetProperties;
      window.showAssetProperties = function(blockEl) {
        VarPanelUI.setCurrentBlock(blockEl);
        return _orig.call(this, blockEl);
      };
    }
  }, 500);
}

/* ─────────────────────────────────────────────
   Public API (window 노출)
───────────────────────────────────────────── */
window.VariableStore    = VariableStore;
window.resolveVar       = resolveVar;
window.bindVar          = bindVar;
window.applyAllBindings = applyAllBindings;
window.VarPanelUI       = VarPanelUI;

// DOMContentLoaded 또는 이미 로드된 경우
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initVariableBinding);
} else {
  initVariableBinding();
}
