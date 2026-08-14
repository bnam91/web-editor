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

  // 코드에서 grep으로 발굴한 숨은 트리거 카탈로그
  const EASTER_EGGS = [
    { key: 'fkeyHotkeys',      label: '섹션 F1~F9 핫키(스타크래프트식)', desc: 'F1~F9로 섹션 점프, Shift+F1~F9로 현재 섹션 등록', trigger: '키 시퀀스 (editor.js)', enabledByDefault: true },
    { key: 'jokerBlock',       label: '시크릿 블록(Figma 패스스루/조커)', desc: 'window.addJokerBlock() 콘솔 호출 또는 Figma import 시 생성되는 SVG 패스스루 블록', trigger: '콘솔 커맨드 (block-factory.js)', enabledByDefault: true },
    { key: 'highlightBMode',   label: '형광펜 라인 모드(B)', desc: '섹션 위에 형광펜 라인 주석을 그리는 모드', trigger: 'window.toggleHighlightBMode()', enabledByDefault: true },
    { key: 'penMode',          label: '펜 주석 모드', desc: '자유 펜 드로잉 주석', trigger: 'window.togglePenMode()', enabledByDefault: true },
    { key: 'hideGapLayers',    label: '레이어 패널 갭 숨김', desc: '레이어 트리에서 gap 블록 항목을 숨김', trigger: 'window.toggleHideGapLayers()', enabledByDefault: true },
    { key: 'freeLayoutAnalyze', label: '프리레이아웃 분석/변환(개발)', desc: 'window.__analyzeFreeLayoutFrame / __convertFreeLayoutToStack 콘솔 디버그 함수', trigger: '콘솔 __ 커맨드 (prop-frame.js)', enabledByDefault: true },
    { key: 'textEffect',       label: '텍스트 효과(네온/메탈릭 등)', desc: '텍스트 블록 레이어 이름을 **text_ 로 바꾸면 네온·메탈릭·그런지·빈티지·시네마틱 효과 + 우측패널 컨트롤이 켜짐', trigger: '레이어명 prefix **text_ (layer-panel-items.js)', enabledByDefault: true },
    { key: 'iconMode',         label: '카드 아이콘 모드', desc: '카드(canvas) 블록 레이어 이름을 **icon_ 로 바꾸면 카드 이미지 자리에 iconify 아이콘을 넣는 모드로 전환', trigger: '레이어명 prefix **icon_ (layer-panel-items.js)', enabledByDefault: true },
    { key: 'badgeTransform',   label: '정품인증 배지 변환', desc: '섹션 이름을 **badge_ 로 바꾸면 해당 섹션이 정품인증 배지 블록으로 변환됨', trigger: '섹션명 prefix **badge_ (layer-panel.js)', enabledByDefault: true },
  ];

  // 이스터에그 기본값 맵 (전부 enabled=true → 기존 동작 보존)
  const defaultEggEnabled = EASTER_EGGS.reduce((m, e) => { m[e.key] = e.enabledByDefault; return m; }, {});

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
            <button class="settings-tab" data-tab="easter">이스터에그</button>
            <button class="settings-tab" data-tab="perf">성능</button>
            <button class="settings-tab" data-tab="market">마켓</button>
            <button class="settings-tab" data-tab="dev">개발자</button>
          </div>
          <div class="settings-content">
            <div class="settings-pane settings-pane-api" data-pane="api"></div>
            <div class="settings-pane settings-pane-shortcuts" data-pane="shortcuts" style="display:none"></div>
            <div class="settings-pane settings-pane-easter" data-pane="easter" style="display:none"></div>
            <div class="settings-pane settings-pane-perf" data-pane="perf" style="display:none"></div>
            <div class="settings-pane settings-pane-market" data-pane="market" style="display:none"></div>
            <div class="settings-pane settings-pane-dev" data-pane="dev" style="display:none"></div>
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
        // 마켓 탭은 진입 시 렌더(목록 fetch는 비용 있어 지연 로드)
        if (tab === 'market' && typeof window.renderMarketPane === 'function') {
          const mp = modal.querySelector('.settings-pane-market');
          if (mp) window.renderMarketPane(mp);
        }
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

  function renderEasterPane() {
    const pane = document.querySelector('.settings-pane-easter');
    if (!pane) return;
    pane.innerHTML = `
      <div class="settings-section-title">이스터에그 (숨은 기능)</div>
      <div class="settings-help">코드에 숨어있는 트리거 기반 기능들입니다. 끄면 해당 트리거가 동작하지 않습니다. (앱 전역 적용 · 저장 버튼을 눌러야 반영됨)</div>
      <div class="settings-egg-list">
        ${EASTER_EGGS.map(egg => `
          <div class="settings-egg-row" data-egg="${egg.key}">
            <div class="settings-egg-text">
              <div class="settings-egg-label">${egg.label}</div>
              <div class="settings-egg-desc">${egg.desc}</div>
              <div class="settings-egg-trigger">${egg.trigger}</div>
            </div>
            <label class="settings-egg-toggle">
              <input type="checkbox" data-egg-key="${egg.key}" />
              <span class="settings-egg-slider"></span>
            </label>
          </div>
        `).join('')}
      </div>
    `;

    // 현재값 채우기 + change 핸들러
    EASTER_EGGS.forEach(egg => {
      const input = pane.querySelector(`input[data-egg-key="${egg.key}"]`);
      if (!input) return;
      const cur = _draft.easterEggs ? _draft.easterEggs[egg.key] : undefined;
      input.checked = (cur !== false); // 기본 true(켜짐)
      input.addEventListener('change', () => {
        if (!_draft.easterEggs) _draft.easterEggs = {};
        _draft.easterEggs[egg.key] = input.checked;
      });
    });
  }

  // [b8-2] 성능 탭 — 이미지 외부화(최적화) 실행 버튼. optimizeProjectImages()는 현재 열린 프로젝트의
  //   캔버스 인라인 base64를 외부 goya-asset 파일로 분리·저장·재로드 검증한다(백업은 projects:save가 자동).
  //   공용 클래스 재사용(settings-section-title/help/btn-primary/api-status) → 새 CSS 없음.
  function renderPerfPane() {
    const pane = document.querySelector('.settings-pane-perf');
    if (!pane) return;
    pane.innerHTML = `
      <div class="settings-section-title">이미지 최적화 (외부화)</div>
      <div class="settings-help">현재 열린 프로젝트의 캔버스에 인라인된 base64 이미지를 외부 파일(goya-asset)로 분리합니다. 프로젝트 용량이 크게 줄어 다음 로딩이 빨라집니다. 변환 직전 자동 백업되지만(proj_backup) 되돌리려면 백업 복원이 필요하니 신중히 실행하세요. (열려 있는 프로젝트에만 적용)</div>
      <div style="display:flex;align-items:center;gap:12px;margin-top:14px;flex-wrap:wrap">
        <button class="settings-btn settings-btn-primary" id="settings-optimize-btn">이미지 최적화 실행</button>
        <span class="settings-api-status" id="settings-optimize-status"></span>
      </div>
    `;
    const btn = pane.querySelector('#settings-optimize-btn');
    const status = pane.querySelector('#settings-optimize-status');
    const setStatus = (msg, cls) => { status.textContent = msg; status.className = 'settings-api-status' + (cls ? ' ' + cls : ''); };
    btn.addEventListener('click', async () => {
      if (typeof window.optimizeProjectImages !== 'function') { setStatus('✗ 최적화 기능 미가용', 'err'); return; }
      if (!window.activeProjectId) { setStatus('✗ 열린 프로젝트가 없습니다', 'err'); return; }
      // 전역 in-flight 가드 — 모달을 닫았다 다시 열어 버튼이 새로 생겨도 동시 실행 차단(코덱스 b8 Q4)
      if (window.__optimizeImagesInFlight) { setStatus('이미 최적화가 진행 중입니다…', 'pending'); return; }
      if (!confirm('현재 프로젝트의 인라인 이미지를 외부 파일로 변환합니다.\n변환 직전 자동 백업되지만 되돌리기 어려우니 진행할까요?')) return;
      window.__optimizeImagesInFlight = true;
      btn.disabled = true;
      setStatus('최적화 중… (이미지 변환·저장·검증, 큰 프로젝트는 수초~수십초 걸릴 수 있습니다)', 'pending');
      try {
        const r = await window.optimizeProjectImages();
        const mb = (n) => (Number(n || 0) / 1024 / 1024).toFixed(1);
        if (r && r.ok && r.base64After === 0) {
          // 디스크가 실제로 완전히 외부화됨 → 새로고침으로 메모리·베이스라인을 goya-asset 상태로 맞춘다.
          // (optimize는 디스크만 바꾸고 에디터 DOM엔 base64가 남아, 새로고침 안 하면 다음 자동저장이
          //  base64를 다시 써서 외부화를 되돌린다 — 실측 확인. optimize가 직전에 저장을 마쳐 유실 없음.)
          setStatus(`✓ 완료: ${mb(r.before)}MB → ${mb(r.after)}MB · 인라인 이미지 ${r.base64Before ?? '?'}→0개 — 적용을 위해 새로고침합니다…`, 'ok');
          setTimeout(() => { try { window.location.reload(); } catch (_) {} }, 1400);
          return; // 새로고침 예정 — 가드/버튼은 리로드로 초기화
        } else if (r && r.ok && r.base64After > 0) {
          // 저장이 큐잉돼(saveProjectToFile in-flight) 외부화가 아직 디스크에 반영 안 됨 → 새로고침하면
          // base64를 다시 로드해 무의미. 재시도 안내(코덱스 b8 Q4: queued-save 조기 검증).
          setStatus(`⚠️ 외부화 미완료(저장 충돌 가능, 인라인 ${r.base64After}개 잔존). 잠시 후 다시 시도하세요.`, 'err');
        } else {
          setStatus('✗ ' + ((r && r.error) || '실패'), 'err');
        }
      } catch (e) {
        setStatus('✗ ' + (e && e.message), 'err');
      } finally {
        window.__optimizeImagesInFlight = false;
        btn.disabled = false;
      }
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
        easterEggs: _draft.easterEggs,
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

  // ── 개발자 탭 — MCP 연결 ─────────────────────────────
  //   지금까지 접속 토큰은 상단바 배지(admin 전용)에만 있어서 «일반 사용자는 토큰을 꺼낼 방법이
  //   없었다». MCP를 공개하려면 여기가 열려야 한다. 공용 클래스만 재사용(새 CSS 0줄):
  //   settings-section-title / settings-help / settings-api-list / settings-api-row /
  //   settings-api-label / settings-api-input-wrap / settings-api-input / settings-api-eye /
  //   settings-api-test / settings-api-status.
  function renderDevPane() {
    const pane = document.querySelector('.settings-pane-dev');
    if (!pane) return;
    const row = (id, label, help) => `
      <div class="settings-api-row">
        <div class="settings-api-label">${label}</div>
        <div class="settings-api-input-wrap">
          <input class="settings-api-input" id="dev-${id}" readonly value="" spellcheck="false" />
          <button class="settings-api-test" data-copy="dev-${id}">복사</button>
        </div>
        ${help ? `<div class="settings-help">${help}</div>` : ''}
      </div>`;
    pane.innerHTML = `
      <div class="settings-section-title">MCP 연결 (Claude 연동)</div>
      <div class="settings-help">GODITOR는 Claude(데스크톱 / Claude Code)가 이 앱을 직접 조작할 수 있는 MCP 서버를 내장하고 있습니다. 아래 「연결 명령」을 터미널에 한 번만 붙여넣으면 등록됩니다. <b>앱을 재시작해도 다시 등록할 필요는 없습니다</b> — 브리지가 토큰을 그때그때 다시 읽습니다.</div>
      <div class="settings-api-list" style="margin-top:14px">
        ${row('cmd', '연결 명령 (Claude Code · 터미널에 붙여넣기)', '데스크톱 앱은 claude_desktop_config.json 의 mcpServers 에 <code>{"goditor":{"command":"node","args":["&lt;브리지 경로&gt;"]}}</code> 로 넣으세요. 토큰은 넣지 않아도 됩니다.')}
        ${row('url', 'MCP 주소')}
        <div class="settings-api-row">
          <div class="settings-api-label">접속 토큰</div>
          <div class="settings-api-input-wrap">
            <input class="settings-api-input" id="dev-token" readonly type="password" value="" spellcheck="false" />
            <button class="settings-api-eye" id="dev-token-eye" title="보기/숨기기">👁</button>
            <button class="settings-api-test" data-copy="dev-token">복사</button>
            <button class="settings-api-test" id="dev-token-regen">재발급</button>
          </div>
          <div class="settings-help">이 토큰이 있어야 외부에서 MCP를 호출할 수 있습니다. 앱을 켤 때마다 새로 만들어지며 아래 파일(소유자만 읽기)에 보관됩니다. <b>남에게 주지 마세요.</b></div>
        </div>
        ${row('tokenfile', '토큰 파일 (권한 0600)')}
        ${row('bridge', '브리지 스크립트 경로')}
      </div>
      <div class="settings-api-status" id="dev-status" style="margin-top:12px"></div>
    `;

    const $ = (id) => pane.querySelector('#' + id);
    const status = $('dev-status');
    const setStatus = (m, cls) => { status.textContent = m; status.className = 'settings-api-status' + (cls ? ' ' + cls : ''); };

    // 복사 버튼(공통)
    pane.querySelectorAll('[data-copy]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const input = pane.querySelector('#' + btn.dataset.copy);
        if (!input || !input.value) { setStatus('✗ 복사할 값이 없습니다', 'err'); return; }
        try {
          if (window.electronAPI?.clipboardWriteText) await window.electronAPI.clipboardWriteText(input.value);
          else await navigator.clipboard.writeText(input.value);
          setStatus('✓ 복사됨', 'ok');
        } catch (e) { setStatus('✗ 복사 실패: ' + e.message, 'err'); }
      });
    });

    const tokenInput = $('dev-token');
    $('dev-token-eye').addEventListener('click', () => {
      tokenInput.type = tokenInput.type === 'password' ? 'text' : 'password';
    });

    const fill = (info, token) => {
      $('dev-url').value = info?.url || '';
      $('dev-tokenfile').value = info?.tokenFile || '(앱 재시작 필요 — 아직 기록되지 않음)';
      $('dev-bridge').value = info?.bridgePath || '';
      tokenInput.value = token || '';
      // 경로에 공백이 있어도 그대로 붙여넣을 수 있게 따옴표로 감싼다.
      $('dev-cmd').value = info?.bridgePath ? `claude mcp add goditor -- node "${info.bridgePath}"` : '';
    };

    (async () => {
      const api = window.electronAPI;
      if (!api?.getMcpInfo) { setStatus('앱(Electron) 환경에서만 표시됩니다', 'err'); return; }
      try {
        const [info, token] = await Promise.all([api.getMcpInfo(), api.getMcpToken ? api.getMcpToken() : null]);
        if (!info?.ok) { setStatus('✗ MCP 서버가 아직 시작되지 않았습니다', 'err'); return; }
        fill(info, token);
        setStatus(token ? `MCP 서버 실행 중 · 포트 ${info.port}` : `MCP 서버 실행 중 · 포트 ${info.port} (토큰 미발급)`, token ? 'ok' : 'err');
        $('dev-token-regen').addEventListener('click', async () => {
          if (!confirm('접속 토큰을 새로 발급합니다.\n이미 연결된 Claude 세션은 다음 호출부터 새 토큰으로 자동 재연결되지만,\n토큰을 직접 설정에 적어둔 경우에는 그 값을 바꿔야 합니다.\n\n계속할까요?')) return;
          try {
            const nt = await api.regenerateMcpToken();
            if (!nt) { setStatus('✗ 재발급 실패', 'err'); return; }
            tokenInput.value = nt;
            const fresh = await api.getMcpInfo();
            if (fresh?.ok) $('dev-tokenfile').value = fresh.tokenFile || $('dev-tokenfile').value;
            setStatus('✓ 새 토큰이 발급되어 토큰 파일에 기록되었습니다', 'ok');
          } catch (e) { setStatus('✗ 재발급 실패: ' + e.message, 'err'); }
        });
      } catch (e) {
        setStatus('✗ 정보를 읽지 못했습니다: ' + e.message, 'err');
      }
    })();
  }

  window.openSettingsModal = function () {
    const modal = ensureModal();
    // 현재 settings → draft 복사
    const cur = window._settings || { apiKeys: {}, shortcuts: {}, easterEggs: {} };
    _draft = {
      apiKeys:   { openai: '', gemini: '', anthropic: '', ...(cur.apiKeys || {}) },
      shortcuts: { ...(cur.shortcuts || {}) },
      easterEggs: { ...defaultEggEnabled, ...(cur.easterEggs || {}) },
    };
    renderApiPane();
    renderShortcutsPane();
    renderEasterPane();
    renderPerfPane();
    renderDevPane();
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
