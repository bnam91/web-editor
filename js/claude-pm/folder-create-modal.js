// claude-pm/folder-create-modal.js — Claude PM 폴더 생성 모달
// feature/claude-pm — Phase 1 (UI · 백엔드 stub)
// 책임:
//   - DOM lazy create
//   - 기본 경로 / 프로젝트명 input + 라이브 미리보기
//   - [만들기] stub — toast 후 모달·패널 모두 닫기
// (vanilla, non-module)

(function () {
  'use strict';

  let _modalEl = null;
  let _escHandler = null;

  // ── DOM lazy create ───────────────────────
  function _ensureModalDOM() {
    if (_modalEl) return _modalEl;

    const modal = document.createElement('div');
    modal.id = 'claude-pm-folder-modal';
    modal.innerHTML = `
      <div class="cpm-modal-shell" role="dialog" aria-modal="true" aria-labelledby="cpm-folder-modal-title">
        <div class="cpm-modal-header">
          <span class="cpm-modal-title" id="cpm-folder-modal-title">Claude PM 폴더 만들기</span>
          <button class="cpm-modal-close" type="button" data-cpm-modal="close" title="닫기" aria-label="닫기">✕</button>
        </div>
        <div class="cpm-modal-body">
          <div class="cpm-field">
            <label class="cpm-field-label" for="cpm-base-path-input">기본 경로</label>
            <div class="cpm-field-input-row">
              <input type="text" class="cpm-input" id="cpm-base-path-input" autocomplete="off" spellcheck="false">
              <!-- TODO(Phase 2): electronAPI.pickDirectory() — disabled 해제 + onClick 바인딩 -->
              <button type="button" class="cpm-pick-btn" disabled title="Phase 2 — 경로 선택기">📂 변경…</button>
            </div>
          </div>
          <div class="cpm-field">
            <label class="cpm-field-label" for="cpm-project-name-input">프로젝트명</label>
            <input type="text" class="cpm-input" id="cpm-project-name-input" placeholder="예: Untitled" autocomplete="off" spellcheck="false">
          </div>
          <div class="cpm-field">
            <span class="cpm-field-label">최종 경로 (미리보기)</span>
            <div class="cpm-preview-box" id="cpm-final-path-preview">—</div>
          </div>
          <div class="cpm-info">
            <span class="cpm-info-icon">ⓘ</span>
            <span>CLAUDE.md와 .mcp.json이 자동 생성됩니다.</span>
          </div>
        </div>
        <div class="cpm-modal-footer">
          <button type="button" class="cpm-btn" data-cpm-modal="close">취소</button>
          <button type="button" class="cpm-btn primary" id="cpm-folder-create-btn" data-cpm-modal="create">만들기</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    // 이벤트 위임 — header/footer 버튼
    modal.addEventListener('click', _onModalClick);

    // 외부(dimmer) 클릭 닫기
    modal.addEventListener('mousedown', (e) => {
      if (e.target === modal) closeFolderCreateModal();
    });

    // input 라이브 미리보기
    const baseInput = modal.querySelector('#cpm-base-path-input');
    const nameInput = modal.querySelector('#cpm-project-name-input');
    [baseInput, nameInput].forEach((el) => {
      el.addEventListener('input', _updatePreview);
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          _onClickCreateFolder();
        }
      });
    });

    _modalEl = modal;
    return modal;
  }

  // ── 라이브 미리보기 ───────────────────────
  function _updatePreview() {
    if (!_modalEl) return;
    const base = (_modalEl.querySelector('#cpm-base-path-input')?.value || '').trim();
    const name = (_modalEl.querySelector('#cpm-project-name-input')?.value || '').trim();
    const preview = _modalEl.querySelector('#cpm-final-path-preview');
    const createBtn = _modalEl.querySelector('#cpm-folder-create-btn');

    if (!base || !name) {
      if (preview) preview.textContent = '—';
      if (createBtn) createBtn.disabled = true;
      return;
    }
    // 슬래시 정규화
    const normBase = base.endsWith('/') ? base : base + '/';
    const safeName = _sanitizeFolderName(name);
    if (preview) preview.textContent = normBase + safeName + '/';
    if (createBtn) createBtn.disabled = !safeName;
  }

  function _sanitizeFolderName(name) {
    // 파일시스템 비호환 문자 단순 치환 — Phase 2에서 백엔드도 동일 규칙 적용 예정
    return (name || '').replace(/[\\/:*?"<>|]/g, '_').trim();
  }

  // ── 액션 핸들러 ───────────────────────────
  function _onModalClick(e) {
    const btn = e.target.closest('[data-cpm-modal]');
    if (!btn) return;
    const kind = btn.getAttribute('data-cpm-modal');
    if (kind === 'close') closeFolderCreateModal();
    else if (kind === 'create') _onClickCreateFolder();
  }

  function _onClickCreateFolder() {
    if (!_modalEl) return;
    const createBtn = _modalEl.querySelector('#cpm-folder-create-btn');
    if (createBtn && createBtn.disabled) return;
    // TODO(Phase 2): electronAPI.createClaudePMFolder({ basePath, projectName }) → CLAUDE.md + .mcp.json 자동 생성
    _toast('📁 폴더 생성 — Phase 2');
    closeFolderCreateModal();
    window.closeClaudePMPanel?.();
  }

  // ── open / close ──────────────────────────
  function openFolderCreateModal() {
    const modal = _ensureModalDOM();

    // 기본값 채우기
    const baseInput = modal.querySelector('#cpm-base-path-input');
    const nameInput = modal.querySelector('#cpm-project-name-input');

    const basePath = (window._claudePMState && window._claudePMState.basePath) || '~/Documents/Goditor Projects/';
    if (baseInput) baseInput.value = basePath;

    // 현재 프로젝트명 자동 채움
    let projectName = 'Untitled';
    try {
      const tab = window.openTabs?.find?.((t) => t.id === window.activeProjectId);
      if (tab && tab.name) projectName = tab.name;
    } catch (_) {}
    if (nameInput) nameInput.value = projectName;

    modal.classList.add('cpm-open');
    _updatePreview();

    _bindEsc();

    // 프로젝트명 focus + 전체 선택 (빠른 수정 UX)
    setTimeout(() => {
      try { nameInput?.focus(); nameInput?.select(); } catch (_) {}
    }, 50);
  }

  function closeFolderCreateModal() {
    if (!_modalEl) return;
    _modalEl.classList.remove('cpm-open');
    _unbindEsc();
  }

  // ── ESC 처리 (모달 우선) ──────────────────
  function _bindEsc() {
    if (_escHandler) return;
    _escHandler = (e) => {
      if (e.key !== 'Escape') return;
      if (_modalEl && _modalEl.classList.contains('cpm-open')) {
        e.stopPropagation();
        closeFolderCreateModal();
      }
    };
    // 캡처 단계로 등록 — 패널의 ESC보다 먼저 잡아 모달만 닫고 패널은 유지
    document.addEventListener('keydown', _escHandler, true);
  }
  function _unbindEsc() {
    if (!_escHandler) return;
    document.removeEventListener('keydown', _escHandler, true);
    _escHandler = null;
  }

  // ── 유틸 ──────────────────────────────────
  function _toast(msg) {
    if (typeof window.showToast === 'function') window.showToast(msg);
    else console.log('[Claude PM]', msg);
  }

  // ── 전역 노출 ─────────────────────────────
  window.openFolderCreateModal = openFolderCreateModal;
  window.closeFolderCreateModal = closeFolderCreateModal;
})();
