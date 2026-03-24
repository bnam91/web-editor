/* ═══════════════════════════════════
   BRANCH SYSTEM
═══════════════════════════════════ */

// 브랜치별 색상 (커밋 모달과 공유)
function getBranchColor(name) {
  if (!name || name === 'main') return { dot: '#27ae60', text: '#4ecb7a' }; // 초록
  if (name.startsWith('dev'))  return { dot: '#e07b2a', text: '#f0a05a' }; // 주황
  return                              { dot: '#2d6fe8', text: '#5a9af0' }; // 파랑 (feature/*)
}

// 프로젝트별 키 (탭 간 브랜치 상태 분리)
function getBranchKey() {
  return activeProjectId ? `web-editor-branches-${activeProjectId}` : 'web-editor-branches';
}

function loadBranchStore() {
  try { return JSON.parse(localStorage.getItem(getBranchKey())) || null; } catch { return null; }
}

function saveBranchStore(store) {
  localStorage.setItem(getBranchKey(), JSON.stringify(store));
  _persistBranchesToFile(store);
}

async function _persistBranchesToFile(store) {
  if (!activeProjectId || !IS_ELECTRON) return;
  try {
    const proj = await window.electronAPI.loadProject(activeProjectId);
    if (!proj) return;
    proj.branches = store.branches;
    proj.currentBranch = store.current;
    proj.updatedAt = new Date().toISOString();
    await window.electronAPI.saveProject(proj);
  } catch {}
}

async function initBranchStore() {
  // Electron: 프로젝트 파일에서 브랜치 로드
  if (activeProjectId && IS_ELECTRON) {
    try {
      const proj = await window.electronAPI.loadProject(activeProjectId);
      if (proj?.branches) {
        const store = { current: proj.currentBranch || 'main', branches: proj.branches };
        localStorage.setItem(getBranchKey(), JSON.stringify(store)); // 로컬 캐시
        updateBranchIndicator(store.current);
        applyFocusMode(store.current);
        renderBranchPanel();
        return store;
      }
    } catch {}
  }
  // localStorage 폴백 (브라우저 or 파일 없을 때)
  let store = loadBranchStore();
  if (!store) {
    const snap = serializeProject();
    store = {
      current: 'dev',
      branches: {
        main: { snapshot: snap, createdAt: Date.now(), updatedAt: Date.now() },
        dev:  { snapshot: snap, createdAt: Date.now(), updatedAt: Date.now() }
      }
    };
    saveBranchStore(store);
  }
  updateBranchIndicator(store.current);
  applyFocusMode(store.current);
  applyMainLock(store.current);
  return store;
}

function updateBranchIndicator(name) {
  const el = document.getElementById('branch-name');
  const indicator = document.getElementById('branch-indicator');
  const col = getBranchColor(name);
  if (el) {
    el.textContent = name;
    el.style.color = col.text;
  }
  if (indicator) {
    const icon = indicator.querySelector('svg');
    if (icon) icon.style.stroke = col.text;
  }
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
    const col = getBranchColor(name);
    return `<div class="branch-dd-item ${isCurrent ? 'current' : ''}" onclick="selectBranchFromDropdown('${name}')">
      <span class="branch-dd-item-dot" style="background:${col.dot}"></span>
      <span>${name}</span>
      ${isCurrent ? '<span style="margin-left:auto;font-size:9px;color:#666;font-weight:600;">NOW</span>' : ''}
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
  applyFocusMode(name);
  _mainUnlocked = false; // 브랜치 전환 시 임시 해제 초기화
  applyMainLock(name);
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

  const fromBranch = store.branches[fromName];
  const scope = fromBranch?.scope;
  const confirmMsg = scope && scope.length > 0
    ? `'${fromName}' → '${toName}' 병합\n스코프 섹션(${scope.length}개)만 교체됩니다.`
    : `'${fromName}' → '${toName}' 으로 병합할까요?\n현재 브랜치의 내용이 대체됩니다.`;

  if (!confirm(confirmMsg)) return;

  if (!scope || scope.length === 0) {
    // 전체 병합 (기존 동작)
    store.branches[toName].snapshot = fromBranch.snapshot;
  } else {
    // 섹션 단위 병합
    const fromData = JSON.parse(fromBranch.snapshot);
    const toData = JSON.parse(store.branches[toName].snapshot);

    toData.pages = toData.pages.map(toPage => {
      const fromPage = fromData.pages.find(p => p.id === toPage.id) || fromData.pages[0];
      if (!fromPage) return toPage;

      const parser = new DOMParser();
      const toDoc = parser.parseFromString(`<div id="c">${toPage.canvas}</div>`, 'text/html');
      const fromDoc = parser.parseFromString(`<div id="c">${fromPage.canvas}</div>`, 'text/html');
      const toCanvas = toDoc.getElementById('c');
      const fromCanvas = fromDoc.getElementById('c');

      scope.forEach(sectionId => {
        const fromSec = fromCanvas.querySelector(`#${sectionId}`);
        const toSec = toCanvas.querySelector(`#${sectionId}`);
        if (fromSec && toSec) {
          toSec.replaceWith(fromSec.cloneNode(true));
        } else if (fromSec) {
          toCanvas.appendChild(fromSec.cloneNode(true));
        }
      });

      return { ...toPage, canvas: toCanvas.innerHTML };
    });

    store.branches[toName].snapshot = JSON.stringify(toData);
  }

  store.branches[toName].updatedAt = Date.now();
  store.current = toName;
  saveBranchStore(store);
  const data = JSON.parse(store.branches[toName].snapshot);
  applyProjectData(data);
  updateBranchIndicator(toName);
  applyFocusMode(toName);
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
        const branch = store.branches[name];
        const scope = branch.scope;
        const hasScopeInfo = scope && scope.length > 0;

        // 스코프 섹션 태그
        const scopeHtml = hasScopeInfo ? `
          <div class="branch-scope-list">
            ${scope.map(id => {
              const el = document.getElementById(id);
              const label = el ? (el.querySelector('.section-label')?.textContent?.trim() || id) : id;
              return `<span class="branch-scope-tag">${label}${isCurrent
                ? `<button class="branch-scope-remove" onclick="event.stopPropagation();removeSectionFromScope('${name}','${id}')">✕</button>`
                : ''}</span>`;
            }).join('')}
            ${isCurrent ? `<button class="branch-scope-add" onclick="promptAddSectionToScope('${name}')">+ 섹션</button>` : ''}
          </div>` : '';

        const col = getBranchColor(name);
        return `
        <div class="branch-item ${isCurrent ? 'current' : ''}" data-branch="${name}">
          <svg class="branch-item-icon" width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="${col.dot}" stroke-width="1.4">
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
        </div>
        ${scopeHtml}`;
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

/* ═══════════════════════════════════
   FEATURE BRANCH + FOCUS MODE
═══════════════════════════════════ */

// 섹션 툴바 ⎇ 버튼 클릭 → feature 브랜치 즉시 생성
function openSectionBranchMenu(btn) {
  const sec = btn.closest('.section-block');
  if (!sec || !sec.id) { showToast('⚠️ 섹션 ID가 없습니다.'); return; }

  const secLabel = sec.querySelector('.section-label')?.textContent?.trim() || sec.id;

  // 섹션 라벨 → 브랜치 이름 자동 생성 (영문/숫자/한글 허용, 나머지는 -)
  const slug = secLabel
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9가-힣\-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || sec.id;

  const store = loadBranchStore();
  if (!store) return;

  // 이름 중복 시 숫자 suffix
  let name = `feature/${slug}`;
  let suffix = 2;
  while (store.branches[name]) {
    name = `feature/${slug}-${suffix++}`;
  }

  createFeatureBranchFromSection(sec.id, name);
  showToast(`✅ 브랜치 생성: ${name}`);
}

// feature 브랜치 생성 (특정 섹션 스코프)
function createFeatureBranchFromSection(sectionId, name) {
  name = name.trim();
  if (!name) return;
  const store = loadBranchStore();
  if (!store) return;
  if (store.branches[name]) { alert(`'${name}' 브랜치가 이미 존재합니다.`); return; }

  // 현재 브랜치 저장 후 새 브랜치 생성
  store.branches[store.current].snapshot = serializeProject();
  store.branches[store.current].updatedAt = Date.now();
  store.branches[name] = {
    snapshot: serializeProject(),
    scope: [sectionId],
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  store.current = name;
  saveBranchStore(store);
  updateBranchIndicator(name);
  applyFocusMode(name);
  renderBranchPanel();
}

// 스코프에 섹션 추가 (브랜치 패널 "+ 섹션" 버튼)
function promptAddSectionToScope(branchName) {
  const store = loadBranchStore();
  if (!store || !store.branches[branchName]) return;
  const currentScope = store.branches[branchName].scope || [];

  const canvas = document.getElementById('canvas');
  if (!canvas) return;
  const sections = [...canvas.querySelectorAll('.section-block')]
    .filter(sec => sec.id && !currentScope.includes(sec.id));

  if (sections.length === 0) { showToast('추가할 수 있는 섹션이 없습니다.'); return; }

  const options = sections.map((sec, i) => {
    const label = sec.querySelector('.section-label')?.textContent?.trim() || sec.id;
    return `${i + 1}. ${label}`;
  }).join('\n');

  const input = prompt(`스코프에 추가할 섹션 번호:\n${options}`);
  if (!input) return;
  const idx = parseInt(input) - 1;
  if (idx >= 0 && idx < sections.length) {
    addSectionToScope(branchName, sections[idx].id);
  }
}

// 스코프에 섹션 추가
function addSectionToScope(branchName, sectionId) {
  const store = loadBranchStore();
  if (!store || !store.branches[branchName]) return;
  const branch = store.branches[branchName];
  if (!branch.scope) branch.scope = [];
  if (!branch.scope.includes(sectionId)) {
    branch.scope.push(sectionId);
    saveBranchStore(store);
    if (store.current === branchName) applyFocusMode(branchName);
    renderBranchPanel();
  }
}

// 스코프에서 섹션 제거
function removeSectionFromScope(branchName, sectionId) {
  const store = loadBranchStore();
  if (!store || !store.branches[branchName]) return;
  const branch = store.branches[branchName];
  if (!branch.scope) return;
  branch.scope = branch.scope.filter(id => id !== sectionId);
  saveBranchStore(store);
  if (store.current === branchName) applyFocusMode(branchName);
  renderBranchPanel();
}

// 포커스 모드 적용 (스코프 있는 브랜치로 전환 시 호출)
function applyFocusMode(branchName) {
  const store = loadBranchStore();
  if (!store) return;
  const scope = store.branches[branchName]?.scope;
  const bar = document.getElementById('focus-mode-bar');
  const canvas = document.getElementById('canvas');

  if (!scope || scope.length === 0) {
    // 스코프 없음 — 전체 표시
    if (bar) bar.style.display = 'none';
    if (canvas) canvas.querySelectorAll('.section-block').forEach(sec => {
      sec.style.display = '';
      sec.classList.remove('section-focus-dimmed');
    });
    return;
  }

  // 배너 업데이트
  if (bar) {
    bar.style.display = '';
    bar.dataset.showAll = 'false';
    const nameEl = document.getElementById('focus-mode-branch-name');
    if (nameEl) nameEl.textContent = branchName;
    const sectionsEl = document.getElementById('focus-mode-sections');
    if (sectionsEl && canvas) {
      const labels = scope.map(id => {
        const el = document.getElementById(id);
        return el ? (el.querySelector('.section-label')?.textContent?.trim() || id) : id;
      }).join(', ');
      sectionsEl.textContent = labels;
    }
    const toggleBtn = document.getElementById('focus-show-all-btn');
    if (toggleBtn) toggleBtn.textContent = '전체 보기';
  }

  // 섹션 가시성 적용
  if (canvas) {
    canvas.querySelectorAll('.section-block').forEach(sec => {
      const inScope = scope.includes(sec.id);
      sec.style.display = inScope ? '' : 'none';
      sec.classList.remove('section-focus-dimmed');
    });
  }
}

// "전체 보기 ↔ 집중 모드" 토글
function toggleFocusAll() {
  const bar = document.getElementById('focus-mode-bar');
  if (!bar) return;
  const store = loadBranchStore();
  if (!store) return;
  const scope = store.branches[store.current]?.scope;
  if (!scope) return;

  const showAll = bar.dataset.showAll !== 'true';
  bar.dataset.showAll = showAll ? 'true' : 'false';
  const toggleBtn = document.getElementById('focus-show-all-btn');
  if (toggleBtn) toggleBtn.textContent = showAll ? '집중 모드' : '전체 보기';

  const canvas = document.getElementById('canvas');
  if (!canvas) return;
  canvas.querySelectorAll('.section-block').forEach(sec => {
    const inScope = scope.includes(sec.id);
    if (inScope) {
      sec.style.display = '';
      sec.classList.remove('section-focus-dimmed');
    } else if (showAll) {
      sec.style.display = '';
      sec.classList.add('section-focus-dimmed');
    } else {
      sec.style.display = 'none';
      sec.classList.remove('section-focus-dimmed');
    }
  });
}

// 새 섹션 추가 시 현재 스코프 브랜치에 자동 등록 (drag-drop.js의 addSection() 끝에서 호출)
function maybeAddNewSectionToScope(sectionId) {
  const store = loadBranchStore();
  if (!store) return;
  const branch = store.branches[store.current];
  if (branch?.scope && branch.scope.length > 0) {
    branch.scope.push(sectionId);
    saveBranchStore(store);
    renderBranchPanel();
  }
}

// main 브랜치 잠금
let _mainUnlocked = false;

function applyMainLock(branchName) {
  const isMain = branchName === 'main';
  const canvas = document.getElementById('canvas');
  const canvasWrap = document.getElementById('canvas-wrap');
  let banner = document.getElementById('main-lock-banner');

  if (!isMain || _mainUnlocked) {
    // 잠금 해제
    if (banner) banner.remove();
    if (canvas) canvas.style.pointerEvents = '';
    if (canvasWrap) canvasWrap.classList.remove('main-locked');
    return;
  }

  // 캔버스 편집 불가
  if (canvas) canvas.style.pointerEvents = 'none';
  if (canvasWrap) canvasWrap.classList.add('main-locked');

  // 배너 (없으면 생성)
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'main-lock-banner';
    banner.innerHTML = `
      <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5">
        <rect x="3" y="6" width="8" height="7" rx="1.5"/>
        <path d="M5 6V4a2 2 0 0 1 4 0v2"/>
      </svg>
      <span>main은 읽기 전용이에요 — dev에서 작업 후 병합하세요</span>
      <button onclick="unlockMainBranch()">임시 잠금 해제</button>
    `;
    // focus-mode-bar 바로 뒤에 삽입 (같은 레벨 상단 배너)
    const focusBar = document.getElementById('focus-mode-bar');
    if (focusBar) focusBar.insertAdjacentElement('afterend', banner);
    else document.body.prepend(banner);
  }
}

function unlockMainBranch() {
  if (!confirm('main 브랜치를 임시로 잠금 해제할까요?\n직접 수정은 권장하지 않아요.')) return;
  _mainUnlocked = true;
  applyMainLock('main'); // 잠금 제거
  const canvas = document.getElementById('canvas');
  if (canvas) canvas.style.pointerEvents = '';
  // 다른 브랜치로 전환하면 자동 재잠금
}

// 크로스 모듈 접근용 window 노출
window.maybeAddNewSectionToScope  = maybeAddNewSectionToScope;
window.openSectionBranchMenu      = openSectionBranchMenu;
window.getCurrentBranch           = getCurrentBranch;
window.renderBranchPanel          = renderBranchPanel;
window.initBranchStore            = initBranchStore;
window.unlockMainBranch           = unlockMainBranch;
window.toggleBranchDropdown       = toggleBranchDropdown;
window.selectBranchFromDropdown   = selectBranchFromDropdown;
window.closeBranchDropdown        = closeBranchDropdown;
window.createBranchFromInput      = createBranchFromInput;
window.switchBranch               = switchBranch;
