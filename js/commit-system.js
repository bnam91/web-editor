/* ═══════════════════════════════════
   COMMIT / SAVE-AS / LOAD SYSTEM
   (extracted from save-load.js)
═══════════════════════════════════ */

const LAST_COMMIT_KEY = 'goya-last-commit';
const SAVE_KEY = 'web-editor-autosave';
const MAX_COMMITS = 20; // 커밋 보존 최대 개수 — 초과 시 오래된 것부터 제거 (파일 비대화 방지)

// 커밋 모달 전용 — snapshot을 DOM에 넣지 않고 메모리에서 관리
let _cmCommits = [];

function _downloadJSON(json, filename) {
  const blob = new Blob([json], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename.endsWith('.json') ? filename : filename + '.json';
  a.click();
  URL.revokeObjectURL(a.href);
}

/* ── 인라인 파일명 입력 모달 (prompt() Electron 미지원 대체) ── */
function showFilenameModal(defaultName, onConfirm) {
  const existing = document.getElementById('filename-modal-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'filename-modal-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.45)';

  overlay.innerHTML = `
    <div style="background:#1e1e1e;border:1px solid #3a3a3a;border-radius:10px;padding:20px 24px;min-width:320px;box-shadow:0 8px 32px rgba(0,0,0,0.5)">
      <div style="font-size:13px;color:#ccc;margin-bottom:10px;">파일명을 입력하세요</div>
      <input id="filename-modal-input" type="text" value="${defaultName}"
        style="width:100%;box-sizing:border-box;background:#2a2a2a;border:1px solid #555;border-radius:6px;color:#eee;font-size:13px;padding:7px 10px;outline:none;">
      <div style="display:flex;gap:8px;margin-top:14px;justify-content:flex-end">
        <button id="filename-modal-cancel" style="padding:6px 14px;border-radius:6px;border:1px solid #444;background:#333;color:#aaa;cursor:pointer;font-size:12px;">취소</button>
        <button id="filename-modal-ok" style="padding:6px 14px;border-radius:6px;border:none;background:#4c8aff;color:#fff;cursor:pointer;font-size:12px;">저장</button>
      </div>
    </div>`;

  document.body.appendChild(overlay);
  const input = document.getElementById('filename-modal-input');
  input.select();

  const close = () => overlay.remove();
  const confirm = () => {
    const val = input.value.trim() || defaultName;
    close();
    onConfirm(val);
  };

  document.getElementById('filename-modal-ok').onclick = confirm;
  document.getElementById('filename-modal-cancel').onclick = close;
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') confirm();
    if (e.key === 'Escape') close();
  });
}

/* ── 커밋 모달 ── */
async function saveProject() {
  openCommitModal();
}

function _formatTimeAgo(ts) {
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return '방금 전';
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.floor(h / 24);
  if (d < 8)  return `${d}일 전`;
  return new Date(ts).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
}

async function openCommitModal() {
  document.getElementById('commit-modal-overlay')?.remove();

  let commits = [];
  if (window.IS_ELECTRON && window.activeProjectId) {
    const proj = await window.electronAPI.loadProject(window.activeProjectId);
    commits = proj?.commits || [];
  }

  const branch = (typeof window.getCurrentBranch === 'function') ? window.getCurrentBranch() : 'main';
  const tab = window.openTabs?.find(t => t.id === window.activeProjectId);
  const projectName = tab?.name || 'Untitled';

  const branchColor = b => {
    const c = (typeof window.getBranchColor === 'function') ? window.getBranchColor(b) : { dot: '#27ae60', text: '#4ecb7a' };
    const hex = c.dot.replace('#','');
    const r = parseInt(hex.slice(0,2),16), g = parseInt(hex.slice(2,4),16), bl = parseInt(hex.slice(4,6),16);
    return { ...c, bg: `rgba(${r},${g},${bl},0.15)` };
  };

  // 브랜치 필터 탭 목록
  const allBranches = [...new Set(commits.map(c => c.branch || 'main'))];
  const filterTabs = ['전체', ...['main', 'dev', ...allBranches.filter(b => b !== 'main' && b !== 'dev')]
    .filter(b => allBranches.includes(b))];

  const filterTabsHTML = filterTabs.map((b, i) => {
    const col = b === '전체' ? null : branchColor(b);
    const dot = col ? `<span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${col.dot};margin-right:4px;vertical-align:middle"></span>` : '';
    return `<button class="cm-filter-tab ${i === 0 ? 'active' : ''}" data-branch="${b}" onclick="filterCommitHistory(this)">${dot}${b}</button>`;
  }).join('');

  const renderItems = (list) => list.length === 0
    ? '<div class="cm-empty">아직 커밋이 없어요</div>'
    : list.slice().reverse().map(c => {
        const col = branchColor(c.branch);
        return `
        <div class="cm-item">
          <div class="cm-item-dot" style="background:${col.dot};box-shadow:0 0 0 3px ${col.bg}"></div>
          <div class="cm-item-body">
            <span class="cm-item-msg">${c.message}</span>
            <span class="cm-item-meta">
              <span class="cm-item-branch" style="color:${col.text}">${c.branch || 'main'}</span>
              · ${_formatTimeAgo(c.timestamp)}
            </span>
          </div>
          <button class="cm-item-restore" onclick="restoreCommit('${c.id}')" title="이 커밋으로 복원">
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.6">
              <path d="M2 7a5 5 0 1 0 1.5-3.5L2 2v4h4L4.5 4.5"/>
            </svg>
          </button>
        </div>`;
      }).join('');

  _cmCommits = commits; // snapshot 포함 전체 커밋 — DOM 속성에는 넣지 않음
  const historyHTML = renderItems(commits);

  const overlay = document.createElement('div');
  overlay.id = 'commit-modal-overlay';
  overlay.innerHTML = `
    <div id="commit-modal">
      <div class="cm-header">
        <span class="cm-title">Commit</span>
        <span class="cm-project">${projectName}</span>
        <button class="cm-close" onclick="document.getElementById('commit-modal-overlay').remove()">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.8">
            <line x1="1" y1="1" x2="9" y2="9"/><line x1="9" y1="1" x2="1" y2="9"/>
          </svg>
        </button>
      </div>
      <div class="cm-body">
        <div class="cm-input-wrap">
          <textarea id="cm-msg-input" placeholder="변경사항을 설명해주세요..." rows="2" maxlength="200"></textarea>
          <div class="cm-input-footer">
            <span class="cm-branch-badge" style="color:${branchColor(branch).text}">⎇ ${branch}</span>
            <button id="cm-commit-btn" onclick="doCommit()" style="background:${branchColor(branch).dot}">✔ Commit</button>
          </div>
        </div>
        <div class="cm-divider">
          <span>히스토리</span>
        </div>
        <div class="cm-filter-tabs">${filterTabsHTML}</div>
        <div class="cm-history" data-commits='${JSON.stringify(commits.map(c => ({ id: c.id, message: c.message, branch: c.branch, timestamp: c.timestamp })))}'>${historyHTML}</div>
      </div>
    </div>`;

  document.body.appendChild(overlay);
  document.getElementById('cm-msg-input').focus();

  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  document.getElementById('cm-msg-input').addEventListener('keydown', e => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) doCommit();
  });
}

function filterCommitHistory(btn) {
  document.querySelectorAll('.cm-filter-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  const selectedBranch = btn.dataset.branch;
  const historyEl = document.querySelector('.cm-history');
  if (!historyEl) return;

  const allCommits = JSON.parse(historyEl.dataset.commits || '[]');
  const filtered = selectedBranch === '전체'
    ? allCommits
    : allCommits.filter(c => (c.branch || 'main') === selectedBranch);

  const branchColor = b => {
    const c = (typeof window.getBranchColor === 'function') ? window.getBranchColor(b) : { dot: '#27ae60', text: '#4ecb7a' };
    const hex = c.dot.replace('#','');
    const r = parseInt(hex.slice(0,2),16), g = parseInt(hex.slice(2,4),16), bl = parseInt(hex.slice(4,6),16);
    return { ...c, bg: `rgba(${r},${g},${bl},0.15)` };
  };

  historyEl.innerHTML = filtered.length === 0
    ? '<div class="cm-empty">이 브랜치에 커밋이 없어요</div>'
    : filtered.slice().reverse().map(c => {
        const col = branchColor(c.branch);
        return `
        <div class="cm-item">
          <div class="cm-item-dot" style="background:${col.dot};box-shadow:0 0 0 3px ${col.bg}"></div>
          <div class="cm-item-body">
            <span class="cm-item-msg">${c.message}</span>
            <span class="cm-item-meta">
              <span class="cm-item-branch" style="color:${col.text}">${c.branch || 'main'}</span>
              · ${_formatTimeAgo(c.timestamp)}
            </span>
          </div>
          <button class="cm-item-restore" onclick="restoreCommit('${c.id}')" title="이 커밋으로 복원">
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.6">
              <path d="M2 7a5 5 0 1 0 1.5-3.5L2 2v4h4L4.5 4.5"/>
            </svg>
          </button>
        </div>`;
      }).join('');
}

async function doCommit() {
  const input = document.getElementById('cm-msg-input');
  const message = input?.value.trim();
  if (!message) { input?.classList.add('cm-shake'); setTimeout(() => input?.classList.remove('cm-shake'), 400); return; }

  const snapshot = JSON.parse(window.serializeProject());
  const branch = (typeof window.getCurrentBranch === 'function') ? window.getCurrentBranch() : 'main';
  const commit = {
    id: 'c_' + Date.now(),
    message,
    timestamp: new Date().toISOString(),
    branch,
    snapshot,
  };

  if (window.IS_ELECTRON && window.activeProjectId) {
    const proj = await window.electronAPI.loadProject(window.activeProjectId);
    if (proj) {
      proj.commits = [...(proj.commits || []), commit].slice(-MAX_COMMITS); // 최대 20개 유지
      proj.updatedAt = new Date().toISOString();
      await window.electronAPI.saveProject(proj);
    }
  }

  document.getElementById('commit-modal-overlay')?.remove();
  window.showToast('✅ Committed — ' + message);
}

async function restoreCommit(id) {
  if (!confirm('이 커밋으로 복원할까요? 현재 변경사항은 자동저장으로 보존돼요.')) return;

  // 모달이 열려있는 동안 메모리의 _cmCommits에서 먼저 조회 (snapshot 포함)
  let commit = _cmCommits.find(c => c.id === id) || null;
  if (!commit && window.IS_ELECTRON && window.activeProjectId) {
    const proj = await window.electronAPI.loadProject(window.activeProjectId);
    commit = proj?.commits?.find(c => c.id === id);
  }
  if (!commit) { window.showToast('❌ 커밋을 찾을 수 없어요'); return; }

  document.getElementById('commit-modal-overlay')?.remove();
  // autoSave 억제 — applyProjectData 직후 MutationObserver가 트리거되어 복원 내용을 덮어쓰는 버그 방지
  if (window.state) window.state._suppressAutoSave = true;
  window.applyProjectData(commit.snapshot);
  if (window.state) window.state._suppressAutoSave = false;

  // DBG-11: 커밋 복원 후 현재 브랜치 스토어에도 snapshot 동기화
  // (브랜치 전환 시 복원 전 상태로 덮어쓰여지는 버그 방지)
  if (typeof window.saveCurrentBranchSnapshot === 'function') {
    window.saveCurrentBranchSnapshot();
  }

  window.showToast(`↩ 복원됨 — ${commit.message}`);
}

async function saveProjectFile() {
  // Electron: IPC 직접 호출로 즉시 파일 저장 (flushSave 모듈 클로저 우회)
  if (window.IS_ELECTRON && window.activeProjectId) {
    try {
      const snap = window.serializeProject();
      const data = JSON.parse(snap);
      const targetId = window.activeProjectId;
      const existing = await window.electronAPI.loadProject(targetId);
      const proj = {
        ...(existing || {}),
        ...data,
        id: targetId,
        name: existing?.name || data.name || 'Untitled',
        updatedAt: new Date().toISOString(),
      };
      await window.electronAPI.saveProject(proj);
      // localStorage도 sync
      localStorage.setItem('project_' + targetId, snap);
      window.showToast?.('✅ 저장됨');
    } catch (e) {
      console.error('[saveProjectFile] 저장 실패:', e);
      window.showToast?.('❌ 저장 실패: ' + (e.message || '알 수 없는 오류'));
    }
    return;
  }
  // 웹: JSON 파일 다운로드
  const base = JSON.parse(window.serializeProject());
  const name = window.currentFileName || window.getProjectName?.() || `web-editor-${new Date().toISOString().slice(0,10)}`;
  _downloadJSON(JSON.stringify(base, null, 2), name);
  window.showToast?.('✅ 저장됨 — ' + name);
}

async function exportProjectJSON() {
  const base = JSON.parse(window.serializeProject());
  if (window.IS_ELECTRON && window.activeProjectId) {
    const proj = await window.electronAPI.loadProject(window.activeProjectId);
    if (proj?.commits?.length)  base.commits       = proj.commits;
    if (proj?.branches)         base.branches       = proj.branches;
    if (proj?.currentBranch)    base.currentBranch  = proj.currentBranch;
  }
  const name = window.getProjectName?.() || `web-editor-${new Date().toISOString().slice(0,10)}`;
  _downloadJSON(JSON.stringify(base, null, 2), name);
  window.showToast?.('✅ JSON 내보내기 완료 — ' + name + '.json');
}

async function saveProjectAs() {
  const base = JSON.parse(window.serializeProject());

  // Electron: 커밋/브랜치 정보 병합 후 JSON 다운로드
  if (window.IS_ELECTRON && window.activeProjectId) {
    const proj = await window.electronAPI.loadProject(window.activeProjectId);
    if (proj?.commits?.length)  base.commits  = proj.commits;
    if (proj?.branches)         base.branches  = proj.branches;
    if (proj?.currentBranch)    base.currentBranch = proj.currentBranch;
  }

  const json = JSON.stringify(base, null, 2);
  localStorage.setItem(SAVE_KEY, window.serializeProject());

  const defaultName = window.currentFileName || window.getProjectName?.() || `web-editor-${new Date().toISOString().slice(0,10)}`;
  showFilenameModal(defaultName, name => {
    window.currentFileName = name;
    _downloadJSON(json, window.currentFileName);
    window.showToast?.('✅ 저장됨 — ' + window.currentFileName);
  });
}

function loadProjectFile(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async ev => {
    try {
      const data = JSON.parse(ev.target.result);
      window.applyProjectData(data);
      // Electron: 커밋/브랜치 정보가 있으면 프로젝트 파일에 복원
      if (window.IS_ELECTRON && window.activeProjectId) {
        const proj = await window.electronAPI.loadProject(window.activeProjectId);
        if (proj) {
          if (data.commits?.length)  proj.commits       = data.commits;
          if (data.branches)         proj.branches       = data.branches;
          if (data.currentBranch)    proj.currentBranch  = data.currentBranch;
          await window.electronAPI.saveProject(proj);
          window.showToast?.('✅ 커밋 히스토리 복원됨');
        }
      }
    } catch { alert('올바른 프로젝트 파일이 아닙니다.'); }
  };
  reader.readAsText(file);
  e.target.value = ''; // 같은 파일 재선택 허용
}

export { showFilenameModal, saveProject, openCommitModal, filterCommitHistory, doCommit, restoreCommit, saveProjectFile, saveProjectAs, loadProjectFile, LAST_COMMIT_KEY };

window.showFilenameModal    = showFilenameModal;
window.saveProject          = saveProject;
window.openCommitModal      = openCommitModal;
window.filterCommitHistory  = filterCommitHistory;
window.doCommit             = doCommit;
window.restoreCommit        = restoreCommit;
window.saveProjectFile      = saveProjectFile;
window.exportProjectJSON    = exportProjectJSON;
window.saveProjectAs        = saveProjectAs;
window.loadProjectFile      = loadProjectFile;
