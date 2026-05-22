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
              <button type="button" class="cpm-pick-btn" id="cpm-base-path-pick" title="OS 경로 선택기">📂 변경…</button>
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

    // 📂 변경… — OS 경로 선택기
    const pickBtn = modal.querySelector('#cpm-base-path-pick');
    if (pickBtn) pickBtn.addEventListener('click', _onClickPickDirectory);

    // 헤더 드래그 이동 — 닫기 버튼 누르면 제외
    const header = modal.querySelector('.cpm-modal-header');
    const shell  = modal.querySelector('.cpm-modal-shell');
    if (header && shell) _bindModalDrag(header, shell);

    _modalEl = modal;
    return modal;
  }

  // ── 드래그 이동 ───────────────────────────
  // 헤더 영역을 잡고 끌어서 모달 위치 이동.
  // dx/dy는 모달 인스턴스 단위 누적 — 닫혔다 다시 열어도 마지막 위치 유지.
  let _dragDx = 0, _dragDy = 0;
  function _bindModalDrag(header, shell) {
    header.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      // 닫기 버튼 / 다른 인터랙티브 요소는 드래그 안 함
      if (e.target.closest('.cpm-modal-close')) return;
      e.preventDefault();
      const startX = e.clientX, startY = e.clientY;
      const startDx = _dragDx, startDy = _dragDy;
      const onMove = (ev) => {
        _dragDx = startDx + (ev.clientX - startX);
        _dragDy = startDy + (ev.clientY - startY);
        shell.style.transform = `translate(${_dragDx}px, ${_dragDy}px)`;
      };
      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
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

  async function _onClickPickDirectory() {
    if (!_modalEl) return;
    const baseInput = _modalEl.querySelector('#cpm-base-path-input');
    const cur = (baseInput?.value || '').trim();
    try {
      const res = await window.electronAPI?.pickDirectory?.(cur);
      if (!res || !res.ok) {
        if (res && res.canceled) return; // 취소는 silent
        _toast('📂 경로 선택 실패: ' + (res?.error || 'electronAPI 없음'));
        return;
      }
      if (baseInput) {
        baseInput.value = res.path.endsWith('/') ? res.path : res.path + '/';
        // 상태 저장
        try { window._claudePMState.basePath = baseInput.value; } catch (_) {}
        _updatePreview();
      }
    } catch (e) {
      _toast('📂 경로 선택 에러: ' + e.message);
    }
  }

  async function _onClickCreateFolder() {
    if (!_modalEl) return;
    const createBtn = _modalEl.querySelector('#cpm-folder-create-btn');
    if (createBtn && createBtn.disabled) return;

    const basePath = (_modalEl.querySelector('#cpm-base-path-input')?.value || '').trim();
    const projectName = (_modalEl.querySelector('#cpm-project-name-input')?.value || '').trim();
    if (!basePath || !projectName) {
      _toast('📁 경로 / 프로젝트명 필수');
      return;
    }

    if (createBtn) createBtn.disabled = true;
    try {
      const res = await window.electronAPI?.createClaudePMFolder?.({ basePath, projectName });
      if (!res || !res.ok) {
        _toast('📁 폴더 생성 실패: ' + (res?.error || 'electronAPI 없음'));
        return;
      }
      // 성공 — 경로/마지막 폴더 상태 저장
      try {
        window._claudePMState.basePath = basePath;
        window._claudePMState.lastFolderPath = res.folderPath;
      } catch (_) {}
      _toast('📁 생성 완료: ' + res.folderPath);
      closeFolderCreateModal();
      window.closeClaudePMPanel?.();
    } catch (e) {
      _toast('📁 폴더 생성 에러: ' + e.message);
    } finally {
      if (createBtn) createBtn.disabled = false;
    }
  }

  // ── open / close ──────────────────────────
  // 2026-05-22: default basePath가 Goditor userData 안으로 이동.
  //   신: ~/Library/Application Support/Goya Design Editor/projects/<projectId>/claude-pm/
  // 사용자가 명시적으로 입력한 path가 있으면 _claudePMState.basePath에 살아있고 그것을 우선 사용.
  const DEFAULT_BASE_PATH_FALLBACK =
    '~/Library/Application Support/Goya Design Editor/projects/<projectId>/claude-pm/';

  function openFolderCreateModal() {
    const modal = _ensureModalDOM();

    // 기본값 채우기
    const baseInput = modal.querySelector('#cpm-base-path-input');
    const nameInput = modal.querySelector('#cpm-project-name-input');

    let basePath = (window._claudePMState && window._claudePMState.basePath) || DEFAULT_BASE_PATH_FALLBACK;
    // <projectId> placeholder가 들어있으면 현재 activeProjectId로 치환 — 사용자 친화 표시
    try {
      if (basePath.indexOf('<projectId>') >= 0) {
        const pid = window.activeProjectId || '<projectId>';
        basePath = basePath.replace('<projectId>', pid);
      }
    } catch (_) {}
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
