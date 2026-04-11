// ── Checklist Panel + Canvas Pin System ──────────────────────────────────────
// 프로젝트별 todo 체크리스트 + 캔버스 위에 핀 마킹 기능

const CHECKLIST_PREFIX = 'sangpe-checklist__';

function _ckKey() {
  return CHECKLIST_PREFIX + (window.activeProjectId || 'default');
}

function loadItems() {
  try { return JSON.parse(localStorage.getItem(_ckKey()) || '[]'); }
  catch { return []; }
}

function saveItems(arr) {
  localStorage.setItem(_ckKey(), JSON.stringify(arr));
}

function genCkId() {
  return 'ck_' + Math.random().toString(36).slice(2, 9);
}

// ── 핀 오버레이 렌더 ──────────────────────────────────────────────────────────
function renderPins() {
  const overlay = document.getElementById('todo-pin-overlay');
  if (!overlay) return;
  overlay.innerHTML = '';

  const items = loadItems().filter(it => !it.done && it.x != null && it.y != null);
  items.forEach((item, idx) => {
    const pin = document.createElement('div');
    pin.className = 'todo-pin';
    pin.dataset.id = item.id;
    pin.style.left = item.x + 'px';
    pin.style.top  = item.y + 'px';
    pin.innerHTML = `<span class="todo-pin-num">${idx + 1}</span>`;
    pin.addEventListener('click', e => {
      e.stopPropagation();
      showPinPopup(item, pin);
    });
    overlay.appendChild(pin);
  });
}

// ── 핀 팝업 (document.body에 fixed 배치 — canvas 배율 무관) ───────────────────
let _activePinPopup = null;

function closePinPopup() {
  if (_activePinPopup) { _activePinPopup.remove(); _activePinPopup = null; }
}

function showPinPopup(item, pinEl) {
  closePinPopup();

  const popup = document.createElement('div');
  popup.className = 'todo-pin-popup';

  // 핀 DOM 위치(viewport 기준)로 팝업 배치
  const pinRect = pinEl.getBoundingClientRect();
  popup.style.position = 'fixed';
  popup.style.left = (pinRect.right + 8) + 'px';
  popup.style.top  = (pinRect.top  - 8) + 'px';

  popup.innerHTML = `
    <div class="todo-pin-popup-text">${_escHtml(item.text)}</div>
    <div class="todo-pin-popup-actions">
      <button class="todo-pin-popup-btn todo-pin-complete-btn">✓ 완료</button>
      <button class="todo-pin-popup-btn todo-pin-delete-btn danger">✕ 삭제</button>
    </div>`;

  popup.querySelector('.todo-pin-complete-btn').addEventListener('click', e => {
    e.stopPropagation();
    const items = loadItems().map(it => it.id === item.id ? { ...it, done: true } : it);
    saveItems(items);
    closePinPopup();
    renderPins();
    renderChecklistPanel();
  });

  popup.querySelector('.todo-pin-delete-btn').addEventListener('click', e => {
    e.stopPropagation();
    const items = loadItems().filter(it => it.id !== item.id);
    saveItems(items);
    closePinPopup();
    renderPins();
    renderChecklistPanel();
  });

  popup.addEventListener('click', e => e.stopPropagation());
  document.body.appendChild(popup);
  _activePinPopup = popup;

  // 팝업이 화면 오른쪽 밖으로 나가면 왼쪽으로
  requestAnimationFrame(() => {
    const r = popup.getBoundingClientRect();
    if (r.right > window.innerWidth - 8) {
      popup.style.left = (pinRect.left - r.width - 8) + 'px';
    }
    if (r.bottom > window.innerHeight - 8) {
      popup.style.top = (window.innerHeight - r.height - 8) + 'px';
    }
  });

  // 팝업 외부 클릭 시 닫기
  setTimeout(() => {
    document.addEventListener('click', closePinPopup, { once: true });
  }, 0);
}

// ── 핀 추가 모드 ──────────────────────────────────────────────────────────────
let _pinMode = false;
let _pendingPinEl = null;
let _pendingInputPopup = null;

function enterPinMode() {
  _pinMode = true;
  const wrap = document.getElementById('canvas-wrap');
  if (wrap) wrap.classList.add('pin-mode-active');
  // overlay는 pointer-events:none 유지 — canvas-wrap에서 클릭 수신
  document.addEventListener('keydown', _onPinModeKeydown);
}

function exitPinMode() {
  _pinMode = false;
  const wrap = document.getElementById('canvas-wrap');
  if (wrap) wrap.classList.remove('pin-mode-active');
  document.removeEventListener('keydown', _onPinModeKeydown);
  if (_pendingPinEl) { _pendingPinEl.remove(); _pendingPinEl = null; }
  if (_pendingInputPopup) { _pendingInputPopup.remove(); _pendingInputPopup = null; }
  // 패널 버튼 active 상태 해제
  const btn = document.getElementById('ck-add-pin-btn');
  if (btn) btn.classList.remove('active');
}

function _onPinModeKeydown(e) {
  if (e.key === 'Escape') exitPinMode();
}

function _onCanvasClickForPin(e) {
  if (!_pinMode) return;
  // 핀 마커나 팝업 클릭은 무시
  if (e.target.closest('.todo-pin') || e.target.closest('.todo-pin-popup')) return;
  e.stopPropagation();

  // canvas-scaler 기준 좌표 계산 (섹션 안/밖 어디든 가능)
  const scaler = document.getElementById('canvas-scaler');
  const overlay = document.getElementById('todo-pin-overlay');
  if (!scaler || !overlay) return;

  const scalerRect = scaler.getBoundingClientRect();
  const scale = (window.currentZoom || 40) / 100;
  const x = (e.clientX - scalerRect.left) / scale;
  const y = (e.clientY - scalerRect.top)  / scale;

  // 임시 핀 마커 (overlay 내부, 캔버스 좌표)
  if (_pendingPinEl) _pendingPinEl.remove();
  const tempPin = document.createElement('div');
  tempPin.className = 'todo-pin todo-pin--pending';
  tempPin.style.left = x + 'px';
  tempPin.style.top  = y + 'px';
  tempPin.innerHTML = '<span class="todo-pin-num">+</span>';
  overlay.appendChild(tempPin);
  _pendingPinEl = tempPin;

  // 입력 팝업 (document.body에 fixed — canvas 배율 무관)
  if (_pendingInputPopup) _pendingInputPopup.remove();
  const popup = document.createElement('div');
  popup.className = 'todo-pin-popup todo-pin-input-popup';
  popup.style.position = 'fixed';
  popup.style.left = (e.clientX + 16) + 'px';
  popup.style.top  = (e.clientY - 12) + 'px';
  popup.innerHTML = `
    <input class="todo-pin-input" type="text" placeholder="할 일을 입력하세요..." maxlength="100">
    <div class="todo-pin-popup-actions">
      <button class="todo-pin-popup-btn todo-pin-save-btn">저장</button>
      <button class="todo-pin-popup-btn danger">취소</button>
    </div>`;
  document.body.appendChild(popup);
  _pendingInputPopup = popup;

  // 화면 밖으로 나가면 위치 조정
  requestAnimationFrame(() => {
    const r = popup.getBoundingClientRect();
    if (r.right > window.innerWidth - 8)  popup.style.left = (e.clientX - r.width - 8) + 'px';
    if (r.bottom > window.innerHeight - 8) popup.style.top  = (e.clientY - r.height)    + 'px';
  });

  const input = popup.querySelector('.todo-pin-input');
  input.focus();

  const save = () => {
    const text = input.value.trim();
    if (!text) { exitPinMode(); return; }
    const items = loadItems();
    items.push({ id: genCkId(), text, done: false, x, y, createdAt: Date.now() });
    saveItems(items);
    exitPinMode();
    renderPins();
    renderChecklistPanel();
  };

  input.addEventListener('keydown', ev => {
    if (ev.key === 'Enter')  { ev.preventDefault(); save(); }
    if (ev.key === 'Escape') { ev.stopPropagation(); exitPinMode(); }
  });
  popup.querySelector('.todo-pin-save-btn').addEventListener('click', ev => { ev.stopPropagation(); save(); });
  popup.querySelectorAll('.danger').forEach(btn => btn.addEventListener('click', ev => { ev.stopPropagation(); exitPinMode(); }));
  popup.addEventListener('click', ev => ev.stopPropagation());
}

// canvas-wrap 클릭 이벤트 등록 (초기화 시 1회)
// — overlay가 아닌 canvas-wrap에 달아야 섹션 밖 빈 영역도 클릭 가능
function _initCanvasClickListener() {
  const wrap = document.getElementById('canvas-wrap');
  if (!wrap || wrap._ckBound) return;
  wrap._ckBound = true;
  wrap.addEventListener('click', _onCanvasClickForPin);
}

// ── 체크리스트 패널 렌더 ─────────────────────────────────────────────────────
function renderChecklistPanel() {
  const panel = document.getElementById('checklist-panel-body');
  if (!panel) return;

  _initCanvasClickListener();
  renderPins();

  const items = loadItems();
  const total = items.length;
  const done  = items.filter(it => it.done).length;
  const pct   = total === 0 ? 0 : Math.round(done / total * 100);
  const allDone = total > 0 && done === total;

  panel.innerHTML = `
    <div class="ck-progress-wrap">
      <div class="ck-progress-label">
        <span>${done} / ${total}</span>
        <span>${pct}%</span>
      </div>
      <div class="ck-progress-bar">
        <div class="ck-progress-fill${allDone ? ' ck-progress-fill--complete' : ''}" style="width:${pct}%"></div>
      </div>
    </div>

    <div class="ck-toolbar">
      <button class="ck-btn ck-btn--pin${_pinMode ? ' active' : ''}" id="ck-add-pin-btn">
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="6" cy="5" r="2.5"/>
          <path d="M6 7.5V11" stroke-width="1.5"/>
          <path d="M3.5 5a2.5 2.5 0 0 1 5 0" stroke-width="1.5"/>
        </svg>
        핀 추가
      </button>
      <button class="ck-btn" id="ck-add-text-btn">
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5">
          <line x1="6" y1="2" x2="6" y2="10"/><line x1="2" y1="6" x2="10" y2="6"/>
        </svg>
        텍스트 항목
      </button>
    </div>

    <div class="ck-add-text-row" id="ck-add-text-row" style="display:none;">
      <input class="ck-text-input" id="ck-text-input" type="text" placeholder="할 일을 입력하고 Enter..." maxlength="100">
    </div>

    <div class="ck-list" id="ck-list">
      ${items.map(item => _renderItem(item)).join('')}
    </div>`;

  // ── 이벤트 바인딩 ──
  panel.querySelector('#ck-add-pin-btn').addEventListener('click', () => {
    if (_pinMode) { exitPinMode(); }
    else { enterPinMode(); panel.querySelector('#ck-add-pin-btn').classList.add('active'); }
  });

  const textBtn   = panel.querySelector('#ck-add-text-btn');
  const textRow   = panel.querySelector('#ck-add-text-row');
  const textInput = panel.querySelector('#ck-text-input');
  textBtn.addEventListener('click', () => {
    const open = textRow.style.display !== 'none';
    textRow.style.display = open ? 'none' : 'flex';
    if (!open) setTimeout(() => textInput.focus(), 50);
  });
  textInput?.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      const text = textInput.value.trim();
      if (!text) return;
      const items = loadItems();
      items.push({ id: genCkId(), text, done: false, x: null, y: null, createdAt: Date.now() });
      saveItems(items);
      renderChecklistPanel();
    }
    if (e.key === 'Escape') { textRow.style.display = 'none'; }
  });

  // 체크 / 핀 이동 / 삭제 이벤트
  panel.querySelector('#ck-list').addEventListener('click', e => {
    const row = e.target.closest('.ck-item');
    if (!row) return;
    const id = row.dataset.id;

    if (e.target.closest('.ck-check')) {
      const items = loadItems().map(it => it.id === id ? { ...it, done: !it.done } : it);
      saveItems(items);
      renderChecklistPanel();
      return;
    }
    if (e.target.closest('.ck-goto-pin')) {
      _scrollToPin(id);
      return;
    }
    if (e.target.closest('.ck-delete')) {
      const items = loadItems().filter(it => it.id !== id);
      saveItems(items);
      renderChecklistPanel();
      return;
    }
  });
}

function _renderItem(item) {
  const hasPin = item.x != null && item.y != null;
  return `
    <div class="ck-item${item.done ? ' ck-item--done' : ''}" data-id="${item.id}">
      <button class="ck-check" title="완료 토글">
        ${item.done
          ? '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.8"><polyline points="2,6 5,9 10,3"/></svg>'
          : '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="1.5" y="1.5" width="9" height="9" rx="2"/></svg>'}
      </button>
      <span class="ck-item-text">${_escHtml(item.text)}</span>
      ${hasPin ? `<button class="ck-goto-pin" title="핀 위치로 이동">
        <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="6" cy="5" r="2.5"/><path d="M6 7.5V11"/>
        </svg>
      </button>` : ''}
      <button class="ck-delete" title="삭제">×</button>
    </div>`;
}

function _scrollToPin(id) {
  const item = loadItems().find(it => it.id === id);
  if (!item || item.x == null) return;
  const scale = (window.currentZoom || 40) / 100;
  const wrap  = document.getElementById('canvas-wrap');
  if (!wrap) return;
  wrap.scrollTo({
    left: item.x * scale - wrap.clientWidth  / 2,
    top:  item.y * scale - wrap.clientHeight / 2,
    behavior: 'smooth'
  });
  // 핀 강조
  const pinEl = document.querySelector(`.todo-pin[data-id="${id}"]`);
  if (pinEl) {
    pinEl.classList.add('todo-pin--highlight');
    setTimeout(() => pinEl.classList.remove('todo-pin--highlight'), 1500);
  }
}

function _escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

window.renderChecklistPanel = renderChecklistPanel;
window.renderTodoPins = renderPins;
