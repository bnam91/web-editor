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
    // branches/currentBranch는 _meta.json에만 저장 (proj.json 경량화)
    const existingMeta = await window.electronAPI.loadProjectMeta(activeProjectId);
    const meta = {
      ...(existingMeta || {}),
      branches: store.branches,
      currentBranch: store.current,
      updatedAt: new Date().toISOString(),
    };
    await window.electronAPI.saveProjectMeta(activeProjectId, meta);
  } catch (e) { console.warn('[branch] 브랜치 meta 저장 실패:', e); }
}

async function initBranchStore() {
  // Electron: _meta.json에서 브랜치 로드 (분리 저장 구조)
  if (activeProjectId && IS_ELECTRON) {
    try {
      // meta 우선, 없으면 proj.json 폴백 (마이그레이션 전 하위 호환)
      const [meta, proj] = await Promise.all([
        window.electronAPI.loadProjectMeta(activeProjectId),
        window.electronAPI.loadProject(activeProjectId),
      ]);
      const branches = meta?.branches || proj?.branches || null;
      const currentBranch = meta?.currentBranch || proj?.currentBranch || null;
      if (branches) {
        const store = { current: currentBranch || 'main', branches };
        localStorage.setItem(getBranchKey(), JSON.stringify(store)); // 로컬 캐시
        // initLoad()가 이미 올바른 캔버스 데이터를 로드하므로 여기서 applyProjectData 호출 금지
        // (race condition: 두 함수가 동시에 실행되어 initLoad 결과를 덮어쓰는 버그 방지)
        updateBranchIndicator(store.current);
        applyFocusMode(store.current);
        applyMainLock(store.current); // Electron 경로에서도 main 잠금 배너 적용
        renderBranchPanel();
        return store;
      }
    } catch (e) { console.warn('[branch] Electron 브랜치 로드 실패, localStorage 폴백:', e); }
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
  // 대상 브랜치 로드 — autoSave 억제를 파싱 전에 먼저 적용 (경쟁 조건 최소화)
  window.state._suppressAutoSave = true;
  store.current = name;
  saveBranchStore(store);
  let data;
  try {
    const raw = store.branches[name].snapshot;
    data = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch (e) {
    console.error('[branch] 스냅샷 파싱 실패:', e);
    window.showToast?.('❌ 브랜치 데이터 손상 — 전환 취소');
    window.state._suppressAutoSave = false;
    return;
  }
  applyProjectData(data);
  window.state._suppressAutoSave = false;
  // 브랜치 전환 시 히스토리 스택 초기화 — applyProjectData 이후 호출해야 새 브랜치 상태가 초기 스냅샷으로 저장됨
  if (window.clearHistory) window.clearHistory();
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
  if (name === 'main' || name === 'dev') { alert(`'${name}' 브랜치는 삭제할 수 없습니다.`); return; }
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
  if (!fromBranch) {
    console.error('[branch] 병합 소스 브랜치 없음:', fromName);
    window.showToast?.('❌ 병합 실패: 브랜치를 찾을 수 없습니다.');
    return;
  }
  const scope = fromBranch.scope;
  const confirmMsg = scope && scope.length > 0
    ? `'${fromName}' → '${toName}' 병합\n스코프 섹션(${scope.length}개)만 교체됩니다.`
    : `'${fromName}' → '${toName}' 으로 병합할까요?\n현재 브랜치의 내용이 대체됩니다.`;

  if (!confirm(confirmMsg)) return;

  if (!scope || scope.length === 0) {
    // 전체 병합 (기존 동작)
    store.branches[toName].snapshot = fromBranch.snapshot;
  } else {
    // 섹션 단위 병합
    let fromData, toData;
    try {
      const fromRaw = fromBranch.snapshot;
      const toRaw = store.branches[toName].snapshot;
      fromData = typeof fromRaw === 'string' ? JSON.parse(fromRaw) : fromRaw;
      toData   = typeof toRaw   === 'string' ? JSON.parse(toRaw)   : toRaw;
    } catch (e) {
      console.error('[branch] 병합 스냅샷 파싱 실패:', e);
      window.showToast?.('❌ 병합 실패: 브랜치 데이터 손상');
      return;
    }

    // v2 포맷 보장
    if (!toData.version) { toData.version = 2; }
    if (!toData.pages) { toData.pages = []; }

    toData.pages = toData.pages.map(toPage => {
      // 같은 ID 우선, 없으면 인덱스 기준 대응 (첫 페이지 폴백 제거 — 데이터 오염 방지)
      const fromPage = fromData.pages?.find(p => p.id === toPage.id);
      if (!fromPage) return toPage;

      try {
        const parser = new DOMParser();
        const toDoc = parser.parseFromString(`<div id="c">${toPage.canvas}</div>`, 'text/html');
        const fromDoc = parser.parseFromString(`<div id="c">${fromPage.canvas}</div>`, 'text/html');
        const toCanvas = toDoc.getElementById('c');
        const fromCanvas = fromDoc.getElementById('c');
        if (!toCanvas || !fromCanvas) return toPage;

        scope.forEach(sectionId => {
          const safeSel = CSS.escape(sectionId);
          const fromSec = fromCanvas.querySelector(`#${safeSel}`);
          const toSec = toCanvas.querySelector(`#${safeSel}`);
          if (fromSec && toSec) {
            toSec.replaceWith(fromSec.cloneNode(true));
          } else if (fromSec) {
            toCanvas.appendChild(fromSec.cloneNode(true));
          }
        });

        return { ...toPage, canvas: toCanvas.innerHTML };
      } catch (e) {
        console.error('[branch] 섹션 병합 파싱 오류:', e);
        return toPage; // 실패 시 기존 페이지 유지
      }
    });

    store.branches[toName].snapshot = JSON.stringify(toData);
  }

  store.branches[toName].updatedAt = Date.now();
  // store.current은 이미 toName (mergeBranch 호출 시점에 현재 브랜치가 toName)
  saveBranchStore(store);
  let mergedData;
  try {
    const raw = store.branches[toName].snapshot;
    mergedData = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch (e) {
    console.error('[branch] 병합 결과 파싱 실패:', e);
    window.showToast?.('❌ 병합 결과 적용 실패');
    return;
  }
  window.state._suppressAutoSave = true;
  applyProjectData(mergedData);
  window.state._suppressAutoSave = false;
  // 병합 후 히스토리 초기화 — applyProjectData 이후 호출해야 병합된 상태가 초기 스냅샷으로 저장됨
  if (window.clearHistory) window.clearHistory();
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
window.getBranchColor             = getBranchColor;
window.renderBranchPanel          = renderBranchPanel;
window.initBranchStore            = initBranchStore;
window.unlockMainBranch           = unlockMainBranch;
window.applyMainLock              = applyMainLock;
window.toggleBranchDropdown       = toggleBranchDropdown;
window.selectBranchFromDropdown   = selectBranchFromDropdown;
window.closeBranchDropdown        = closeBranchDropdown;
window.createBranchFromInput      = createBranchFromInput;
window.switchBranch               = switchBranch;
window.saveCurrentBranchSnapshot      = saveCurrentBranchSnapshot; // DBG-11: restoreCommit 후 동기화용
window.createBranch                   = createBranch;
window.deleteBranch                   = deleteBranch;
window.mergeBranch                    = mergeBranch;
window.loadBranchStore                = loadBranchStore;
window.saveBranchStore                = saveBranchStore;
window.getBranchKey                   = getBranchKey;
window.toggleFocusAll                 = toggleFocusAll;
window.applyFocusMode                 = applyFocusMode;
window.createFeatureBranchFromSection = createFeatureBranchFromSection;
window.addSectionToScope              = addSectionToScope;
window.removeSectionFromScope         = removeSectionFromScope;
window.promptAddSectionToScope        = promptAddSectionToScope;
