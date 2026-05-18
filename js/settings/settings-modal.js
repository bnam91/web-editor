/* ══════════════════════════════════════
   Settings Modal — API 토큰 + 단축키 UI
   - openSettingsModal() / closeSettingsModal() 글로벌
   - 좌측 탭(API 토큰 / 단축키) + 우측 콘텐츠 + 하단 저장 버튼
   ══════════════════════════════════════ */
(function () {
  const PROVIDERS = [
    { key: 'openai',    label: 'OpenAI (GPT)',     placeholder: 'sk-...' },
    { key: 'gemini',    label: 'Google Gemini',    placeholder: 'AIza...' },
    { key: 'anthropic', label: 'Anthropic (Claude)', placeholder: 'sk-ant-...' },
  ];

  const SHORTCUT_ACTIONS = [
    { key: 'addGap',       label: '갭 블록 추가',       allowMod: false },
    { key: 'addText',      label: '텍스트 블록 추가',   allowMod: false },
    { key: 'addAsset',     label: '에셋 블록 추가',     allowMod: false },
    { key: 'addSection',   label: '섹션 추가',          allowMod: false },
    { key: 'pinToggle',    label: '핀 모드 토글',       allowMod: false },
    { key: 'groupBlocks',  label: '블록 그룹화',        allowMod: true },
    { key: 'ungroup',      label: '그룹 해제',          allowMod: true },
    { key: 'wrapInFrame',  label: '프레임으로 감싸기',  allowMod: true },
  ];

  let _captureState = null;   // { actionKey } — 키 캡처 대기 중인 액션
  let _draft = null;          // 모달이 열린 동안의 임시 설정 (저장 전)

  function show(el) { el.style.display = 'flex'; }
  function hide(el) { el.style.display = 'none'; }

  function toast(msg, type = 'info') {
    const t = document.createElement('div');
    t.className = `settings-toast settings-toast-${type}`;
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => { t.classList.add('show'); }, 10);
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 200); }, 2400);
  }

  function ensureModal() {
    let modal = document.getElementById('settings-modal');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'settings-modal';
    modal.className = 'settings-modal-overlay';
    modal.style.display = 'none';
    modal.innerHTML = `
      <div class="settings-modal-shell" role="dialog" aria-label="환경설정">
        <div class="settings-modal-header">
          <div class="settings-modal-title">환경설정</div>
          <button class="settings-modal-close" id="settings-close-btn" title="닫기 (Esc)">×</button>
        </div>
        <div class="settings-modal-body">
          <div class="settings-tabs" role="tablist">
            <button class="settings-tab active" data-tab="api">API 토큰</button>
            <button class="settings-tab" data-tab="shortcuts">단축키</button>
          </div>
          <div class="settings-content">
            <div class="settings-pane settings-pane-api" data-pane="api"></div>
            <div class="settings-pane settings-pane-shortcuts" data-pane="shortcuts" style="display:none"></div>
          </div>
        </div>
        <div class="settings-modal-footer">
          <button class="settings-btn settings-btn-secondary" id="settings-reset-btn">기본값 복원</button>
          <div style="flex:1"></div>
          <button class="settings-btn settings-btn-secondary" id="settings-cancel-btn">취소</button>
          <button class="settings-btn settings-btn-primary" id="settings-save-btn">저장</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    // 이벤트 바인딩
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeSettingsModal();
    });
    modal.querySelector('#settings-close-btn').addEventListener('click', closeSettingsModal);
    modal.querySelector('#settings-cancel-btn').addEventListener('click', closeSettingsModal);
    modal.querySelector('#settings-save-btn').addEventListener('click', onSave);
    modal.querySelector('#settings-reset-btn').addEventListener('click', onResetShortcuts);

    modal.querySelectorAll('.settings-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        modal.querySelectorAll('.settings-tab').forEach(b => b.classList.toggle('active', b === btn));
        modal.querySelectorAll('.settings-pane').forEach(p => {
          p.style.display = (p.dataset.pane === tab) ? 'block' : 'none';
        });
      });
    });

    return modal;
  }

  function renderApiPane() {
    const pane = document.querySelector('.settings-pane-api');
    if (!pane) return;
    pane.innerHTML = `
      <div class="settings-section-title">AI 모델별 API 키</div>
      <div class="settings-help">키를 등록하면 환경변수보다 우선 적용됩니다. 빈칸으로 두면 시스템 환경변수를 사용합니다.</div>
      <div class="settings-api-list">
        ${PROVIDERS.map(p => `
          <div class="settings-api-row" data-provider="${p.key}">
            <label class="settings-api-label">${p.label}</label>
            <div class="settings-api-input-wrap">
              <input type="password" class="settings-api-input" data-key="${p.key}"
                     placeholder="${p.placeholder}" autocomplete="off" spellcheck="false" />
              <button class="settings-api-eye" data-action="toggle-visibility" title="표시/숨김">👁</button>
              <button class="settings-api-test" data-action="test">테스트</button>
            </div>
            <div class="settings-api-status" data-status="${p.key}"></div>
          </div>
        `).join('')}
      </div>
    `;

    // 현재 값 채우기
    PROVIDERS.forEach(p => {
      const input = pane.querySelector(`.settings-api-input[data-key="${p.key}"]`);
      if (input) input.value = (_draft.apiKeys && _draft.apiKeys[p.key]) || '';
      input.addEventListener('input', () => {
        _draft.apiKeys[p.key] = input.value;
      });
    });

    // 표시/숨김 토글
    pane.querySelectorAll('[data-action="toggle-visibility"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const row = btn.closest('.settings-api-row');
        const input = row.querySelector('.settings-api-input');
        input.type = input.type === 'password' ? 'text' : 'password';
      });
    });

    // 테스트 버튼
    pane.querySelectorAll('[data-action="test"]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const row = btn.closest('.settings-api-row');
        const provider = row.dataset.provider;
        const input = row.querySelector('.settings-api-input');
        const status = row.querySelector('[data-status]');
        const key = (input.value || '').trim();
        if (!key) {
          status.textContent = '키를 입력하세요';
          status.className = 'settings-api-status err';
          return;
        }
        status.textContent = '테스트 중...';
        status.className = 'settings-api-status pending';
        btn.disabled = true;
        try {
          const res = await window.electronAPI.testApiKey(provider, key);
          if (res && res.ok) {
            status.textContent = '✓ 유효한 키';
            status.className = 'settings-api-status ok';
          } else {
            status.textContent = '✗ ' + (res?.error || '실패');
            status.className = 'settings-api-status err';
          }
        } catch (e) {
          status.textContent = '✗ ' + e.message;
          status.className = 'settings-api-status err';
        } finally {
          btn.disabled = false;
        }
      });
    });
  }

  function renderShortcutsPane() {
    const pane = document.querySelector('.settings-pane-shortcuts');
    if (!pane) return;
    pane.innerHTML = `
      <div class="settings-section-title">단축키</div>
      <div class="settings-help">"변경" 버튼을 누르고 원하는 키 조합을 누르세요. ⌘S, ⌘Z, ⌘C/V/D/A는 시스템 예약어로 변경할 수 없습니다.</div>
      <div class="settings-shortcut-list">
        ${SHORTCUT_ACTIONS.map(a => `
          <div class="settings-shortcut-row" data-action="${a.key}">
            <div class="settings-shortcut-label">${a.label}</div>
            <div class="settings-shortcut-badge" data-badge="${a.key}"></div>
            <button class="settings-shortcut-btn" data-action-btn="${a.key}">변경</button>
          </div>
        `).join('')}
      </div>
      <div class="settings-shortcut-capture-hint" id="shortcut-capture-hint">변경할 키를 누르세요... (Esc 취소)</div>
    `;

    refreshShortcutBadges();

    pane.querySelectorAll('[data-action-btn]').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.actionBtn;
        startCapture(action);
      });
    });
  }

  function refreshShortcutBadges() {
    const pane = document.querySelector('.settings-pane-shortcuts');
    if (!pane) return;
    SHORTCUT_ACTIONS.forEach(a => {
      const badge = pane.querySelector(`[data-badge="${a.key}"]`);
      if (badge) {
        const spec = _draft.shortcuts[a.key];
        badge.textContent = window._shortcutLabel ? window._shortcutLabel(spec) : (spec || '(없음)');
      }
    });
  }

  function startCapture(actionKey) {
    _captureState = { actionKey };
    const hint = document.getElementById('shortcut-capture-hint');
    if (hint) hint.classList.add('active');
    // 해당 row 강조
    document.querySelectorAll('.settings-shortcut-row').forEach(r => {
      r.classList.toggle('capturing', r.dataset.action === actionKey);
    });
  }

  function endCapture() {
    _captureState = null;
    const hint = document.getElementById('shortcut-capture-hint');
    if (hint) hint.classList.remove('active');
    document.querySelectorAll('.settings-shortcut-row').forEach(r => r.classList.remove('capturing'));
  }

  // 모달이 열려있을 때만 작동하는 keydown 캡처
  function onCaptureKeydown(e) {
    const modal = document.getElementById('settings-modal');
    if (!modal || modal.style.display === 'none') return;

    // 캡처 모드 — 키 조합 받기
    if (_captureState) {
      // Esc는 취소
      if (e.code === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        endCapture();
        return;
      }
      const spec = window._eventToShortcutSpec(e);
      if (!spec) return; // modifier 단독 무시
      e.preventDefault();
      e.stopPropagation();

      // 시스템 단축키 차단
      if (window._SYSTEM_SHORTCUTS_BLOCKED && window._SYSTEM_SHORTCUTS_BLOCKED.has(spec)) {
        toast(`시스템 예약 단축키(${window._shortcutLabel(spec)})는 사용할 수 없습니다.`, 'err');
        return;
      }

      // 충돌 감지
      const action = _captureState.actionKey;
      const conflict = Object.entries(_draft.shortcuts).find(([k, v]) => v === spec && k !== action);
      if (conflict) {
        const conflictLabel = (SHORTCUT_ACTIONS.find(a => a.key === conflict[0]) || {}).label || conflict[0];
        toast(`이미 "${conflictLabel}"에 할당된 키입니다.`, 'err');
        return;
      }

      _draft.shortcuts[action] = spec;
      refreshShortcutBadges();
      endCapture();
      return;
    }

    // 일반: Esc로 모달 닫기
    if (e.code === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      closeSettingsModal();
    }
  }

  async function onSave() {
    try {
      await window.saveSettings({
        apiKeys: _draft.apiKeys,
        shortcuts: _draft.shortcuts,
      });
      toast('저장되었습니다.', 'ok');
      closeSettingsModal();
    } catch (e) {
      toast('저장 실패: ' + e.message, 'err');
    }
  }

  function onResetShortcuts() {
    if (!confirm('단축키를 기본값으로 복원하시겠습니까?')) return;
    // settings-store의 FALLBACK과 동일한 기본값
    const defaults = {
      addGap:      'KeyG',
      addText:     'KeyT',
      addAsset:    'KeyA',
      addSection:  'KeyS',
      pinToggle:   'Backquote',
      groupBlocks: 'Meta+KeyG',
      ungroup:     'Meta+Shift+KeyG',
      wrapInFrame: 'Meta+Alt+KeyG',
    };
    _draft.shortcuts = { ...defaults };
    refreshShortcutBadges();
    toast('기본값으로 복원되었습니다. (저장 버튼을 눌러야 반영됨)', 'info');
  }

  window.openSettingsModal = function () {
    const modal = ensureModal();
    // 현재 settings → draft 복사
    const cur = window._settings || { apiKeys: {}, shortcuts: {} };
    _draft = {
      apiKeys:   { openai: '', gemini: '', anthropic: '', ...(cur.apiKeys || {}) },
      shortcuts: { ...(cur.shortcuts || {}) },
    };
    renderApiPane();
    renderShortcutsPane();
    show(modal);
    document.addEventListener('keydown', onCaptureKeydown, true);
  };

  window.closeSettingsModal = function () {
    const modal = document.getElementById('settings-modal');
    if (!modal) return;
    hide(modal);
    endCapture();
    _draft = null;
    document.removeEventListener('keydown', onCaptureKeydown, true);
  };
})();
