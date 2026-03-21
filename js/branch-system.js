/* ═══════════════════════════════════
   BRANCH SYSTEM
═══════════════════════════════════ */
const BRANCH_KEY = 'web-editor-branches';

function loadBranchStore() {
  try { return JSON.parse(localStorage.getItem(BRANCH_KEY)) || null; } catch { return null; }
}
function saveBranchStore(store) {
  localStorage.setItem(BRANCH_KEY, JSON.stringify(store));
}
function initBranchStore() {
  let store = loadBranchStore();
  if (!store) {
    const snap = serializeProject();
    store = {
      current: 'main',
      branches: {
        main: { snapshot: snap, createdAt: Date.now(), updatedAt: Date.now() },
        dev:  { snapshot: snap, createdAt: Date.now(), updatedAt: Date.now() }
      }
    };
    saveBranchStore(store);
  }
  updateBranchIndicator(store.current);
  return store;
}

function updateBranchIndicator(name) {
  const el = document.getElementById('branch-name');
  if (el) el.textContent = name;
  renderBranchDropdown();
}

function toggleBranchDropdown(e) {
  e.stopPropagation();
  const wrap = document.getElementById('branch-dropdown-wrap');
  const isOpen = wrap.classList.toggle('open');
  if (isOpen) renderBranchDropdown();
}

function renderBranchDropdown() {
  const menu = document.getElementById('branch-dropdown-menu');
  if (!menu) return;
  const store = loadBranchStore();
  if (!store) return;
  const order = ['main', 'dev', ...Object.keys(store.branches).filter(n => n !== 'main' && n !== 'dev')];
  const sorted = [...new Set(order.filter(n => store.branches[n]))];

  menu.innerHTML = sorted.map(name => {
    const isCurrent = name === store.current;
    return `<div class="branch-dd-item ${isCurrent ? 'current' : ''}" onclick="selectBranchFromDropdown('${name}')">
      <span class="branch-dd-item-dot"></span>
      <span>${name}</span>
      ${isCurrent ? '<span style="margin-left:auto;font-size:9px;color:#2d6fe8;font-weight:700;">NOW</span>' : ''}
    </div>`;
  }).join('') + `
  <div class="branch-dd-divider"></div>
  <div class="branch-dd-manage" onclick="switchToTab('branch');closeBranchDropdown()">
    <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.4">
      <circle cx="3" cy="2.5" r="1.5"/><circle cx="3" cy="9.5" r="1.5"/><circle cx="9" cy="5" r="1.5"/>
      <path d="M3 4v4M3 4C3 6 9 4 9 5"/>
    </svg>
    브랜치 관리 →
  </div>`;
}

function selectBranchFromDropdown(name) {
  closeBranchDropdown();
  switchBranch(name);
}

function closeBranchDropdown() {
  document.getElementById('branch-dropdown-wrap')?.classList.remove('open');
}

function getCurrentBranch() {
  const store = loadBranchStore();
  return store ? store.current : 'main';
}

function saveCurrentBranchSnapshot() {
  const store = loadBranchStore();
  if (!store) return;
  store.branches[store.current].snapshot = serializeProject();
  store.branches[store.current].updatedAt = Date.now();
  saveBranchStore(store);
}

function switchBranch(name) {
  const store = loadBranchStore();
  if (!store || !store.branches[name] || store.current === name) return;
  // 현재 브랜치 스냅샷 저장
  store.branches[store.current].snapshot = serializeProject();
  store.branches[store.current].updatedAt = Date.now();
  // 대상 브랜치 로드
  store.current = name;
  saveBranchStore(store);
  const data = JSON.parse(store.branches[name].snapshot);
  applyProjectData(data);
  updateBranchIndicator(name);
  renderBranchPanel();
}

function createBranch(name) {
  name = name.trim();
  if (!name) return;
  const store = loadBranchStore();
  if (!store) return;
  if (store.branches[name]) { alert(`'${name}' 브랜치가 이미 존재합니다.`); return; }
  store.branches[name] = {
    snapshot: serializeProject(),
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  saveBranchStore(store);
  renderBranchPanel();
}

function deleteBranch(name) {
  const store = loadBranchStore();
  if (!store) return;
  if (name === 'main') { alert('main 브랜치는 삭제할 수 없습니다.'); return; }
  if (store.current === name) { alert('현재 작업 중인 브랜치는 삭제할 수 없습니다.'); return; }
  if (!confirm(`'${name}' 브랜치를 삭제할까요?`)) return;
  delete store.branches[name];
  saveBranchStore(store);
  renderBranchPanel();
}

function mergeBranch(fromName) {
  const store = loadBranchStore();
  if (!store) return;
  const toName = store.current;
  if (fromName === toName) return;
  if (!confirm(`'${fromName}' → '${toName}' 으로 병합할까요?\n현재 브랜치의 내용이 대체됩니다.`)) return;
  store.branches[toName].snapshot = store.branches[fromName].snapshot;
  store.branches[toName].updatedAt = Date.now();
  store.current = toName;
  saveBranchStore(store);
  const data = JSON.parse(store.branches[toName].snapshot);
  applyProjectData(data);
  updateBranchIndicator(toName);
  renderBranchPanel();
}

function renderBranchPanel() {
  const panel = document.getElementById('branch-panel-body');
  if (!panel) return;
  const store = loadBranchStore();
  if (!store) return;
  const branchNames = Object.keys(store.branches);
  const order = ['main', 'dev', ...branchNames.filter(n => n !== 'main' && n !== 'dev')];
  const sorted = [...new Set(order.filter(n => store.branches[n]))];

  panel.innerHTML = `
    <div class="branch-section-title">브랜치</div>
    <div class="branch-list">
      ${sorted.map(name => {
        const isCurrent = name === store.current;
        const ago = timeSince(store.branches[name].updatedAt);
        return `
        <div class="branch-item ${isCurrent ? 'current' : ''}" data-branch="${name}">
          <svg class="branch-item-icon" width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.4">
            <circle cx="3" cy="2.5" r="1.5"/><circle cx="3" cy="9.5" r="1.5"/><circle cx="9" cy="5" r="1.5"/>
            <path d="M3 4v4M3 4C3 6 9 4 9 5"/>
          </svg>
          <span class="branch-item-name">${name}</span>
          ${isCurrent ? '<span class="branch-item-badge">현재</span>' : ''}
          <div class="branch-item-actions">
            ${!isCurrent ? `<button class="branch-action-btn" onclick="switchBranch('${name}')">전환</button>` : ''}
            ${!isCurrent ? `<button class="branch-action-btn merge" onclick="mergeBranch('${name}')">병합</button>` : ''}
            ${name !== 'main' && name !== 'dev' ? `<button class="branch-action-btn danger" onclick="deleteBranch('${name}')">✕</button>` : ''}
          </div>
        </div>`;
      }).join('')}
    </div>
    <div class="branch-divider"></div>
    <div class="branch-section-title">새 브랜치</div>
    <div class="branch-new-form">
      <input class="branch-new-input" id="branch-new-input" placeholder="feature/이름" type="text">
      <button class="branch-new-btn" onclick="createBranchFromInput()">만들기</button>
    </div>`;

  const input = document.getElementById('branch-new-input');
  if (input) input.addEventListener('keydown', e => { if (e.key === 'Enter') createBranchFromInput(); });
}

function createBranchFromInput() {
  const input = document.getElementById('branch-new-input');
  if (!input) return;
  createBranch(input.value);
  input.value = '';
}

function timeSince(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return '방금';
  if (s < 3600) return Math.floor(s/60) + '분 전';
  if (s < 86400) return Math.floor(s/3600) + '시간 전';
  return Math.floor(s/86400) + '일 전';
}
