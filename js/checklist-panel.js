// ── Checklist Panel + Canvas Pin System ──────────────────────────────────────
// 프로젝트별 todo 체크리스트 + 캔버스 위에 핀 마킹 기능

const CHECKLIST_PREFIX = 'sangpe-checklist__';
const SECTIONS_PREFIX  = 'sangpe-checklist-sections__';

function _ckKey()  { return CHECKLIST_PREFIX + (window.activeProjectId || 'default'); }
function _secKey() { return SECTIONS_PREFIX  + (window.activeProjectId || 'default'); }

// ── Items CRUD ────────────────────────────────────────────────────────────────
function loadItems() {
  try { return JSON.parse(localStorage.getItem(_ckKey()) || '[]'); }
  catch { return []; }
}
function saveItems(arr) { localStorage.setItem(_ckKey(), JSON.stringify(arr)); }

// ── Sections CRUD ─────────────────────────────────────────────────────────────
function loadSections() {
  try { return JSON.parse(localStorage.getItem(_secKey()) || '[]'); }
  catch { return []; }
}
function saveSections(arr) { localStorage.setItem(_secKey(), JSON.stringify(arr)); }

function genCkId() { return 'ck_' + Math.random().toString(36).slice(2, 9); }

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

    // ── 캔버스 핀 드래그 이동 (mousedown/move/up) ──────────────────────────
    let _pinDragStartX = 0, _pinDragStartY = 0;
    let _pinDragging = false;

    pin.addEventListener('mousedown', e => {
      if (_pinMode) return; // 핀 추가 모드 중엔 무시
      e.stopPropagation();
      e.preventDefault();
      _pinDragStartX = e.clientX;
      _pinDragStartY = e.clientY;
      _pinDragging = false;
      closePinPopup();

      const scaler = document.getElementById('canvas-scaler');

      const onMove = mv => {
        const dx = mv.clientX - _pinDragStartX;
        const dy = mv.clientY - _pinDragStartY;
        if (!_pinDragging && Math.hypot(dx, dy) < 5) return;
        _pinDragging = true;
        pin.classList.add('todo-pin--dragging');

        // 이동량을 canvas 좌표로 변환
        const scale = (window.currentZoom || 40) / 100;
        const newX = item.x + dx / scale;
        const newY = item.y + dy / scale;
        pin.style.left = newX + 'px';
        pin.style.top  = newY + 'px';
      };

      const onUp = up => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup',   onUp);
        pin.classList.remove('todo-pin--dragging');

        const dx = up.clientX - _pinDragStartX;
        const dy = up.clientY - _pinDragStartY;

        if (!_pinDragging || Math.hypot(dx, dy) < 5) {
          // 클릭으로 처리
          showPinPopup(item, pin);
          return;
        }

        // 새 좌표 저장
        const scale = (window.currentZoom || 40) / 100;
        const newX = item.x + dx / scale;
        const newY = item.y + dy / scale;
        const all = loadItems().map(it =>
          it.id === item.id ? { ...it, x: newX, y: newY } : it
        );
        saveItems(all);
        renderPins();
      };

      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup',   onUp);
    });

    overlay.appendChild(pin);
  });
}

// ── 핀 팝업 ───────────────────────────────────────────────────────────────────
let _activePinPopup   = null;
let _activePinCleanup = null;

function closePinPopup() {
  if (_activePinPopup)   { _activePinPopup.remove();   _activePinPopup = null; }
  if (_activePinCleanup) { _activePinCleanup();         _activePinCleanup = null; }
}

function _positionPopupNearPin(popup, pinEl) {
  const pr = pinEl.getBoundingClientRect();
  if (pr.width === 0) { closePinPopup(); return; } // 핀이 뷰 밖으로 사라짐
  let left = pr.right + 8;
  let top  = pr.top   - 8;
  const r  = popup.getBoundingClientRect();
  if (left + r.width  > window.innerWidth  - 8) left = pr.left - r.width - 8;
  if (top  + r.height > window.innerHeight - 8) top  = window.innerHeight - r.height - 8;
  popup.style.left = left + 'px';
  popup.style.top  = top  + 'px';
}

function showPinPopup(item, pinEl) {
  closePinPopup();
  const popup = document.createElement('div');
  popup.className = 'todo-pin-popup';
  const pinRect = pinEl.getBoundingClientRect();
  popup.style.position = 'fixed';
  popup.style.left = (pinRect.right + 8) + 'px';
  popup.style.top  = (pinRect.top   - 8) + 'px';
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
    closePinPopup(); renderPins(); renderChecklistPanel();
  });
  popup.querySelector('.todo-pin-delete-btn').addEventListener('click', e => {
    e.stopPropagation();
    const items = loadItems().filter(it => it.id !== item.id);
    saveItems(items);
    closePinPopup(); renderPins(); renderChecklistPanel();
  });
  popup.addEventListener('click', e => e.stopPropagation());
  document.body.appendChild(popup);
  _activePinPopup = popup;

  // 위치 초기 보정
  requestAnimationFrame(() => _positionPopupNearPin(popup, pinEl));

  // 캔버스 스크롤 시 팝업 위치 핀 따라가기
  const wrap = document.getElementById('canvas-wrap');
  const _onScroll = () => _positionPopupNearPin(popup, pinEl);
  if (wrap) wrap.addEventListener('scroll', _onScroll);
  _activePinCleanup = () => { if (wrap) wrap.removeEventListener('scroll', _onScroll); };

  setTimeout(() => { document.addEventListener('click', closePinPopup, { once: true }); }, 0);
}

// ── 핀 추가 모드 ──────────────────────────────────────────────────────────────
let _pinMode = false;
let _pendingPinEl = null;
let _pendingInputPopup = null;

function enterPinMode() {
  _pinMode = true;
  const wrap = document.getElementById('canvas-wrap');
  if (wrap) wrap.classList.add('pin-mode-active');
  document.addEventListener('keydown', _onPinModeKeydown);
}

function exitPinMode() {
  _pinMode = false;
  const wrap = document.getElementById('canvas-wrap');
  if (wrap) wrap.classList.remove('pin-mode-active');
  document.removeEventListener('keydown', _onPinModeKeydown);
  if (_pendingPinEl)     { _pendingPinEl.remove();     _pendingPinEl = null; }
  if (_pendingInputPopup){ _pendingInputPopup.remove(); _pendingInputPopup = null; }
  const btn = document.getElementById('ck-add-pin-btn');
  if (btn) btn.classList.remove('active');
}

function _onPinModeKeydown(e) { if (e.key === 'Escape') exitPinMode(); }

function _onCanvasClickForPin(e) {
  if (!_pinMode) return;
  if (e.target.closest('.todo-pin') || e.target.closest('.todo-pin-popup')) return;
  e.stopPropagation();

  const scaler  = document.getElementById('canvas-scaler');
  const overlay = document.getElementById('todo-pin-overlay');
  if (!scaler || !overlay) return;

  const scalerRect = scaler.getBoundingClientRect();
  const scale = (window.currentZoom || 40) / 100;
  const x = (e.clientX - scalerRect.left) / scale;
  const y = (e.clientY - scalerRect.top)  / scale;

  if (_pendingPinEl) _pendingPinEl.remove();
  const tempPin = document.createElement('div');
  tempPin.className = 'todo-pin todo-pin--pending';
  tempPin.style.left = x + 'px';
  tempPin.style.top  = y + 'px';
  tempPin.innerHTML = '<span class="todo-pin-num">+</span>';
  overlay.appendChild(tempPin);
  _pendingPinEl = tempPin;

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

  requestAnimationFrame(() => {
    const r = popup.getBoundingClientRect();
    if (r.right  > window.innerWidth  - 8) popup.style.left = (e.clientX - r.width - 8) + 'px';
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
    exitPinMode(); renderPins(); renderChecklistPanel();
  };

  input.addEventListener('keydown', ev => {
    if (ev.key === 'Enter')  { ev.preventDefault(); save(); }
    if (ev.key === 'Escape') { ev.stopPropagation(); exitPinMode(); }
  });
  popup.querySelector('.todo-pin-save-btn').addEventListener('click', ev => { ev.stopPropagation(); save(); });
  popup.querySelectorAll('.danger').forEach(btn => btn.addEventListener('click', ev => { ev.stopPropagation(); exitPinMode(); }));
  popup.addEventListener('click', ev => ev.stopPropagation());
}

function _initCanvasClickListener() {
  const wrap = document.getElementById('canvas-wrap');
  if (!wrap || wrap._ckBound) return;
  wrap._ckBound = true;
  wrap.addEventListener('click', _onCanvasClickForPin);
}

// ── 드래그앤드랍 상태 ─────────────────────────────────────────────────────────
let _dragSrcId   = null;   // 드래그 중인 item or section ID
let _dragType    = null;   // 'item' | 'section'
let _dropIndicator = null;

function _removeDropIndicator() {
  if (_dropIndicator) { _dropIndicator.remove(); _dropIndicator = null; }
}

function _insertDropIndicator(refEl, before) {
  _removeDropIndicator();
  const ind = document.createElement('div');
  ind.className = 'ck-drop-indicator';
  if (before) refEl.parentNode.insertBefore(ind, refEl);
  else        refEl.parentNode.insertBefore(ind, refEl.nextSibling);
  _dropIndicator = ind;
}

// ── 체크리스트 패널 렌더 ─────────────────────────────────────────────────────
function renderChecklistPanel() {
  const panel = document.getElementById('checklist-panel-body');
  if (!panel) return;

  _initCanvasClickListener();
  renderPins();

  const items    = loadItems();
  const sections = loadSections();
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
      <button class="ck-btn" id="ck-add-section-btn">
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="1" y="1" width="10" height="3" rx="1"/>
          <line x1="1" y1="7" x2="11" y2="7"/>
          <line x1="1" y1="10" x2="8" y2="10"/>
        </svg>
        섹션 추가
      </button>
    </div>

    <div class="ck-list" id="ck-list"></div>`;

  // ── 툴바 이벤트 ──
  panel.querySelector('#ck-add-pin-btn').addEventListener('click', () => {
    if (_pinMode) { exitPinMode(); }
    else { enterPinMode(); panel.querySelector('#ck-add-pin-btn').classList.add('active'); }
  });

  panel.querySelector('#ck-add-text-btn').addEventListener('click', () => {
    _appendInlineItemInput(null);
  });

  panel.querySelector('#ck-add-section-btn').addEventListener('click', () => {
    _appendInlineSectionInput();
  });

  // ── 리스트 렌더 ──
  _renderList();
}

// ── 리스트 DOM 렌더 (sections + items) ───────────────────────────────────────
function _renderList() {
  const list = document.getElementById('ck-list');
  if (!list) return;
  list.innerHTML = '';

  const items    = loadItems();
  const sections = loadSections();

  // 섹션 없는 items (sectionId === null / undefined)
  const unsectionedItems = items.filter(it => !it.sectionId);
  unsectionedItems.forEach(item => {
    list.appendChild(_buildItemEl(item));
  });

  // 각 섹션 헤더 + 소속 items
  sections.forEach(sec => {
    const headerEl = _buildSectionHeaderEl(sec);
    list.appendChild(headerEl);

    if (!sec.collapsed) {
      const secItems = items.filter(it => it.sectionId === sec.id);
      secItems.forEach(item => {
        list.appendChild(_buildItemEl(item, sec.id));
      });
    }
  });

  // 리스트 전체 dragover/drop 위임
  list.addEventListener('dragover', _onListDragOver);
  list.addEventListener('dragleave', e => {
    if (!list.contains(e.relatedTarget)) _removeDropIndicator();
  });
  list.addEventListener('drop', _onListDrop);
  list.addEventListener('dragend', () => { _removeDropIndicator(); _dragSrcId = null; _dragType = null; });
}

// ── 아이템 DOM 요소 생성 ──────────────────────────────────────────────────────
function _buildItemEl(item, sectionId) {
  const hasPin = item.x != null && item.y != null;
  const el = document.createElement('div');
  el.className = 'ck-item' + (item.done ? ' ck-item--done' : '');
  el.dataset.id = item.id;
  el.dataset.type = 'item';
  if (sectionId) el.dataset.sectionId = sectionId;

  el.innerHTML = `
    <div class="ck-drag-handle" title="드래그하여 순서 변경">⠿</div>
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
    <button class="ck-delete" title="삭제">×</button>`;

  // 드래그 핸들 mousedown → item draggable
  const handle = el.querySelector('.ck-drag-handle');
  handle.addEventListener('mousedown', () => { el.draggable = true; });
  el.addEventListener('dragend', () => { el.draggable = false; });

  el.addEventListener('dragstart', e => {
    _dragSrcId = item.id;
    _dragType  = 'item';
    e.dataTransfer.effectAllowed = 'move';
    setTimeout(() => el.classList.add('ck-dragging'), 0);
  });
  el.addEventListener('dragend', () => {
    el.classList.remove('ck-dragging');
    el.draggable = false;
  });

  // 체크
  el.querySelector('.ck-check').addEventListener('click', e => {
    e.stopPropagation();
    const items = loadItems().map(it => it.id === item.id ? { ...it, done: !it.done } : it);
    saveItems(items);
    renderChecklistPanel();
  });

  // 핀 이동
  const gotoBtn = el.querySelector('.ck-goto-pin');
  if (gotoBtn) gotoBtn.addEventListener('click', e => { e.stopPropagation(); _scrollToPin(item.id); });

  // 삭제
  el.querySelector('.ck-delete').addEventListener('click', e => {
    e.stopPropagation();
    saveItems(loadItems().filter(it => it.id !== item.id));
    renderChecklistPanel();
  });

  // 텍스트 클릭 → 인라인 편집
  el.querySelector('.ck-item-text').addEventListener('click', e => {
    e.stopPropagation();
    _startItemInlineEdit(el, item);
  });

  return el;
}

// ── 섹션 헤더 DOM 요소 생성 ──────────────────────────────────────────────────
function _buildSectionHeaderEl(sec) {
  const el = document.createElement('div');
  el.className = 'ck-section-header';
  el.dataset.sectionId = sec.id;
  el.dataset.type = 'section';
  el.draggable = true;

  el.innerHTML = `
    <div class="ck-drag-handle ck-drag-handle--section" title="드래그하여 순서 변경">⠿</div>
    <svg class="ck-section-chevron${sec.collapsed ? ' collapsed' : ''}" width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.8">
      <polyline points="2,3 5,7 8,3"/>
    </svg>
    <span class="ck-section-name">${_escHtml(sec.name)}</span>
    <button class="ck-delete ck-section-delete" title="섹션 삭제">×</button>`;

  // collapsed 토글 (헤더 클릭)
  el.addEventListener('click', e => {
    if (e.target.closest('.ck-section-delete') || e.target.closest('.ck-drag-handle')) return;
    const sections = loadSections().map(s => s.id === sec.id ? { ...s, collapsed: !s.collapsed } : s);
    saveSections(sections);
    _renderList();
  });

  // 이름 더블클릭 → 인라인 편집
  el.querySelector('.ck-section-name').addEventListener('dblclick', e => {
    e.stopPropagation();
    _startSectionInlineEdit(el, sec);
  });

  // 섹션 삭제
  el.querySelector('.ck-section-delete').addEventListener('click', e => {
    e.stopPropagation();
    // 소속 아이템 sectionId 제거 (null로)
    const items = loadItems().map(it => it.sectionId === sec.id ? { ...it, sectionId: null } : it);
    saveItems(items);
    saveSections(loadSections().filter(s => s.id !== sec.id));
    renderChecklistPanel();
  });

  // 드래그 이벤트
  el.addEventListener('dragstart', e => {
    _dragSrcId = sec.id;
    _dragType  = 'section';
    e.dataTransfer.effectAllowed = 'move';
    setTimeout(() => el.classList.add('ck-dragging'), 0);
  });
  el.addEventListener('dragend', () => {
    el.classList.remove('ck-dragging');
  });

  return el;
}

// ── dragover: drop indicator 표시 ─────────────────────────────────────────────
function _onListDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';

  const target = e.target.closest('.ck-item, .ck-section-header');
  if (!target) { _removeDropIndicator(); return; }
  if (target.dataset.id === _dragSrcId || target.dataset.sectionId === _dragSrcId) {
    _removeDropIndicator(); return;
  }

  const rect = target.getBoundingClientRect();
  const midY = rect.top + rect.height / 2;
  _insertDropIndicator(target, e.clientY < midY);
}

// ── drop: 순서 변경 ───────────────────────────────────────────────────────────
function _onListDrop(e) {
  e.preventDefault();
  _removeDropIndicator();
  if (!_dragSrcId) return;

  const target = e.target.closest('.ck-item, .ck-section-header');
  if (!target) return;

  const rect    = target.getBoundingClientRect();
  const midY    = rect.top + rect.height / 2;
  const before  = e.clientY < midY;

  if (_dragType === 'item') {
    _dropItem(target, before);
  } else if (_dragType === 'section') {
    _dropSection(target, before);
  }

  _dragSrcId = null;
  _dragType  = null;
  renderChecklistPanel();
}

function _dropItem(targetEl, before) {
  const items    = loadItems();
  const sections = loadSections();

  const srcIdx = items.findIndex(it => it.id === _dragSrcId);
  if (srcIdx === -1) return;
  const [srcItem] = items.splice(srcIdx, 1);

  if (targetEl.dataset.type === 'item') {
    // 같은 item 위에 drop
    const tgtIdx = items.findIndex(it => it.id === targetEl.dataset.id);
    if (tgtIdx === -1) { items.push(srcItem); saveItems(items); return; }
    // 섹션 변경
    const tgtSectionId = items[tgtIdx].sectionId || null;
    srcItem.sectionId = tgtSectionId;
    items.splice(before ? tgtIdx : tgtIdx + 1, 0, srcItem);

  } else if (targetEl.dataset.type === 'section') {
    // 섹션 헤더 위에 drop → 해당 섹션에 추가 (섹션 바로 위면 섹션 앞, 아래면 섹션 첫 아이템으로)
    const tgtSecId = targetEl.dataset.sectionId;
    if (before) {
      // 섹션 헤더 위 → 이전 섹션의 끝 or 섹션 없는 영역의 끝에
      srcItem.sectionId = null;
      // 섹션 없는 아이템들 뒤에 배치
      const lastUnsecIdx = items.reduce((acc, it, i) => (!it.sectionId ? i : acc), -1);
      items.splice(lastUnsecIdx + 1, 0, srcItem);
    } else {
      // 섹션 헤더 아래 → 이 섹션의 첫 번째 아이템으로
      srcItem.sectionId = tgtSecId;
      const firstInSec = items.findIndex(it => it.sectionId === tgtSecId);
      if (firstInSec === -1) items.push(srcItem);
      else items.splice(firstInSec, 0, srcItem);
    }
  }

  saveItems(items);
}

function _dropSection(targetEl, before) {
  const sections = loadSections();
  const srcIdx   = sections.findIndex(s => s.id === _dragSrcId);
  if (srcIdx === -1) return;
  const [srcSec] = sections.splice(srcIdx, 1);

  if (targetEl.dataset.type === 'section') {
    const tgtIdx = sections.findIndex(s => s.id === targetEl.dataset.sectionId);
    if (tgtIdx === -1) { sections.push(srcSec); saveSections(sections); return; }
    sections.splice(before ? tgtIdx : tgtIdx + 1, 0, srcSec);
  } else {
    // item 위에 drop → 그 아이템의 섹션 위치로 이동
    sections.push(srcSec);
  }

  saveSections(sections);
}

// ── 인라인 아이템 입력 행 추가 ───────────────────────────────────────────────
function _appendInlineItemInput(sectionId) {
  const list = document.getElementById('ck-list');
  if (!list) return;

  const row = document.createElement('div');
  row.className = 'ck-item ck-item--editing';
  if (sectionId) row.dataset.sectionId = sectionId;

  const input = document.createElement('input');
  input.className   = 'ck-inline-input';
  input.type        = 'text';
  input.placeholder = '할 일을 입력하고 Enter...';
  input.maxLength   = 100;
  row.appendChild(input);
  list.appendChild(row);

  input.focus();

  const save = () => {
    const text = input.value.trim();
    if (!text) { row.remove(); return; }
    const items = loadItems();
    items.push({ id: genCkId(), text, done: false, x: null, y: null,
                 sectionId: sectionId || null, createdAt: Date.now() });
    saveItems(items);
    _renderList();
    // 저장 후 새 행 자동 추가
    _appendInlineItemInput(sectionId);
  };

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); save(); }
    if (e.key === 'Escape') { row.remove(); }
  });
  input.addEventListener('blur', () => {
    // 포커스 잃으면 저장 또는 제거
    const text = input.value.trim();
    if (!text) { row.remove(); return; }
    const items = loadItems();
    items.push({ id: genCkId(), text, done: false, x: null, y: null,
                 sectionId: sectionId || null, createdAt: Date.now() });
    saveItems(items);
    row.remove();
    _renderList();
  });
}

// ── 인라인 섹션 입력 ─────────────────────────────────────────────────────────
function _appendInlineSectionInput() {
  const list = document.getElementById('ck-list');
  if (!list) return;

  const row = document.createElement('div');
  row.className = 'ck-section-header ck-section-header--editing';

  const input = document.createElement('input');
  input.className   = 'ck-inline-input ck-inline-input--section';
  input.type        = 'text';
  input.placeholder = '섹션 이름 입력 후 Enter...';
  input.maxLength   = 50;
  row.appendChild(input);
  list.appendChild(row);
  input.focus();

  const save = () => {
    const name = input.value.trim();
    row.remove();
    if (!name) return;
    const sections = loadSections();
    sections.push({ id: genCkId(), name, collapsed: false });
    saveSections(sections);
    _renderList();
  };

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); save(); }
    if (e.key === 'Escape') { row.remove(); }
  });
  input.addEventListener('blur', save);
}

// ── 아이템 텍스트 인라인 편집 ────────────────────────────────────────────────
function _startItemInlineEdit(el, item) {
  const textSpan = el.querySelector('.ck-item-text');
  if (!textSpan) return;

  const input = document.createElement('input');
  input.className = 'ck-inline-input';
  input.type      = 'text';
  input.value     = item.text;
  input.maxLength = 100;
  textSpan.replaceWith(input);
  input.focus();
  input.select();

  const save = () => {
    const text = input.value.trim();
    if (text && text !== item.text) {
      const items = loadItems().map(it => it.id === item.id ? { ...it, text } : it);
      saveItems(items);
    }
    _renderList();
  };

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter')  { e.preventDefault(); save(); }
    if (e.key === 'Escape') { _renderList(); }
  });
  input.addEventListener('blur', save);
}

// ── 섹션 이름 인라인 편집 ────────────────────────────────────────────────────
function _startSectionInlineEdit(el, sec) {
  const nameSpan = el.querySelector('.ck-section-name');
  if (!nameSpan) return;

  const input = document.createElement('input');
  input.className = 'ck-inline-input ck-inline-input--section';
  input.type      = 'text';
  input.value     = sec.name;
  input.maxLength = 50;
  nameSpan.replaceWith(input);
  input.focus();
  input.select();

  const save = () => {
    const name = input.value.trim();
    if (name && name !== sec.name) {
      const sections = loadSections().map(s => s.id === sec.id ? { ...s, name } : s);
      saveSections(sections);
    }
    _renderList();
  };

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter')  { e.preventDefault(); save(); }
    if (e.key === 'Escape') { _renderList(); }
  });
  input.addEventListener('blur', save);
}

// ── 핀 이동 ──────────────────────────────────────────────────────────────────
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
