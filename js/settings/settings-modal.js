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
            ${window.COLLAB_ENABLED ? '<button class="settings-tab" data-tab="collab">협업</button>' : ''}
            <button class="settings-tab" data-tab="dev">개발자</button>
          </div>
          <div class="settings-content">
            <div class="settings-pane settings-pane-api" data-pane="api"></div>
            <div class="settings-pane settings-pane-shortcuts" data-pane="shortcuts" style="display:none"></div>
            <div class="settings-pane settings-pane-easter" data-pane="easter" style="display:none"></div>
            <div class="settings-pane settings-pane-perf" data-pane="perf" style="display:none"></div>
            <div class="settings-pane settings-pane-market" data-pane="market" style="display:none"></div>
            ${window.COLLAB_ENABLED ? '<div class="settings-pane settings-pane-collab" data-pane="collab" style="display:none"></div>' : ''}
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
        // 협업 탭도 같은 이유로 진입 시 다시 읽는다 — 초대는 «지금» 와 있을 수 있다.
        if (tab === 'collab') renderCollabPane();
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

  // [b8-2] 성능 탭 — 이미지 외부화(최적화). 변환 구현은 main(projects:externalize) 한 곳이고 여기는 트리거·상태만.
  //   [externalize] 추가: «열 때 자동 최적화» 토글(기본 OFF, 저장 버튼으로 반영) + 현재 프로젝트 상태(인라인 장수·
  //   용량·백업 유무) + 「변환 되돌리기」(proj_pre-externalize.json이 있을 때만 표시).
  //   공용 클래스 재사용(settings-section-title/help/btn-primary/api-status/egg-row/egg-toggle) → 새 CSS 없음.
  const _fmtMB = (n) => (Number(n || 0) / 1024 / 1024).toFixed(1) + 'MB';
  function renderPerfPane() {
    const pane = document.querySelector('.settings-pane-perf');
    if (!pane) return;
    pane.innerHTML = `
      <div class="settings-section-title">이미지 최적화 (외부화)</div>
      <div class="settings-help">캔버스에 인라인된 base64 이미지를 외부 파일(goya-asset)로 분리합니다. 프로젝트 용량이 크게 줄어 로딩·저장이 빨라집니다. 변환 직전 원본 파일을 <code>proj_pre-externalize.json</code>으로 보존하며, 아래 「변환 되돌리기」로 복원할 수 있습니다.</div>
      <div class="settings-egg-list">
        <div class="settings-egg-row" data-egg="autoExternalizeOnOpen">
          <div class="settings-egg-text">
            <div class="settings-egg-label">프로젝트 열 때 자동 최적화 (베타)</div>
            <div class="settings-egg-desc">켜면 인라인 이미지가 남아 있는 프로젝트를 열 때 자동으로 분리합니다. 협업 중인 프로젝트는 건너뜁니다. (저장 버튼을 눌러야 반영됨)</div>
          </div>
          <label class="settings-egg-toggle">
            <input type="checkbox" id="settings-auto-externalize" />
            <span class="settings-egg-slider"></span>
          </label>
        </div>
      </div>
      <div class="settings-help" id="settings-externalize-state" style="margin-top:12px"></div>
      <div style="display:flex;align-items:center;gap:12px;margin-top:14px;flex-wrap:wrap">
        <button class="settings-btn settings-btn-primary" id="settings-optimize-btn">이미지 최적화 실행</button>
        <button class="settings-btn" id="settings-externalize-rollback-btn" style="display:none">변환 되돌리기</button>
        <span class="settings-api-status" id="settings-optimize-status"></span>
      </div>
    `;
    const btn = pane.querySelector('#settings-optimize-btn');
    const status = pane.querySelector('#settings-optimize-status');
    const setStatus = (msg, cls) => { status.textContent = msg; status.className = 'settings-api-status' + (cls ? ' ' + cls : ''); };

    // 토글 — draft에만 쓰고, 저장 버튼(onSave)이 main settings에 반영한다(다른 탭과 같은 규율)
    const toggle = pane.querySelector('#settings-auto-externalize');
    toggle.checked = !!(_draft && _draft.autoExternalizeOnOpen);
    toggle.addEventListener('change', () => { if (_draft) _draft.autoExternalizeOnOpen = toggle.checked; });

    // 현재 프로젝트 상태 (main scan: 파싱 없이 수치) + 되돌리기 버튼 노출
    const stateEl = pane.querySelector('#settings-externalize-state');
    const rbBtn = pane.querySelector('#settings-externalize-rollback-btn');
    async function refreshState() {
      const pid = window.activeProjectId;
      if (!pid || !window.electronAPI?.externalizeScan) { stateEl.textContent = '열린 프로젝트가 없습니다.'; rbBtn.style.display = 'none'; return; }
      let s = null;
      try { s = await window.electronAPI.externalizeScan({ projectId: pid }); } catch (_) {}
      if (!s || !s.exists) { stateEl.textContent = '프로젝트 파일 상태를 읽지 못했습니다.'; rbBtn.style.display = 'none'; return; }
      const parts = [`현재 프로젝트: ${_fmtMB(s.bytes)}`, `인라인 이미지 ${s.base64Refs}개`, `분리된 참조 ${s.goyaRefs}개`];
      if (s.externalized && s.externalized.at) parts.push(`마지막 변환 ${new Date(s.externalized.at).toLocaleString()} (${_fmtMB(s.externalized.before)} → ${_fmtMB(s.externalized.after)})`);
      stateEl.textContent = parts.join(' · ');
      rbBtn.style.display = s.hasBackup ? '' : 'none';
    }
    refreshState();

    rbBtn.addEventListener('click', async () => {
      if (!window.activeProjectId) return;
      if (window.__optimizeImagesInFlight) { setStatus('다른 작업이 진행 중입니다…', 'pending'); return; }
      // F2: 되돌리면 사라질 작업의 «실수치»를 경고에 담는다(dryRun 진단). 진단 실패해도 되돌리기는 진행 가능.
      let diag = null;
      try { diag = await window.electronAPI.externalizeRollback({ projectId: window.activeProjectId, dryRun: true }); } catch (_) {}
      let warn = '변환 전 원본으로 되돌립니다.';
      if (diag && diag.ok) {
        if (diag.ageDays != null) warn += `\n이 변환은 약 ${diag.ageDays}일 전입니다 — 그 이후의 편집이 사라집니다.`;
        else warn += `\n⚠️ 변환 시점을 알 수 없습니다 — 변환 이후의 모든 편집이 사라질 수 있습니다.`;
        if (diag.currentSections != null && diag.restoreSections != null && diag.currentSections !== diag.restoreSections)
          warn += `\n섹션 ${diag.currentSections}개 → ${diag.restoreSections}개로 바뀝니다.`;
      }
      warn += '\n(되돌린 직후의 현재 상태는 proj_pre-rollback.json에 보관되어 실수 시 수동 복구할 수 있습니다.)\n진행할까요?';
      if (!confirm(warn)) return;
      window.__optimizeImagesInFlight = true; rbBtn.disabled = true; btn.disabled = true;
      setStatus('되돌리는 중…', 'pending');
      // F4: 되돌리기 전 autosave 3경로(타이머·대기열·in-flight)를 모두 봉인·드레인해 복원본 재덮기를 막는다.
      //     성공 시 봉인 유지→새로고침이 리셋, 실패 시 봉인 해제+편집 복구(dirty 재표시·autosave 재무장).
      const _unseal = () => { try { window.resumeAutoSaveAfterAbortedReload?.(); } catch (_) {} };
      try { await window.cancelPendingAutoSaveForReload?.(); } catch (_) {}
      try {
        const r = await window.electronAPI.externalizeRollback({ projectId: window.activeProjectId });
        if (r && r.ok) { setStatus('✓ 원본으로 되돌렸습니다 — 적용을 위해 새로고침합니다…', 'ok'); setTimeout(() => { try { window.location.reload(); } catch (_) {} }, 1200); return; }
        _unseal();
        setStatus('✗ ' + ((r && (r.reason || r.error)) || '되돌리기 실패'), 'err');
      } catch (e) { _unseal(); setStatus('✗ ' + (e && e.message), 'err'); }
      finally { window.__optimizeImagesInFlight = false; rbBtn.disabled = false; btn.disabled = false; }
    });
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
        let r = await window.optimizeProjectImages();
        // 협업 등록 프로젝트 — 상대에게는 분리된 이미지가 안 보일 수 있다. 경고 확인 후에만 강행.
        if (r && r.ok === false && r.reason === 'collab') {
          if (!confirm('이 프로젝트는 협업 중입니다.\n이미지를 외부 파일로 분리하면 함께 작업하는 상대 화면에는 그 이미지가 보이지 않을 수 있습니다.\n그래도 진행할까요?')) { setStatus('취소됨 (협업 중인 프로젝트)', ''); return; }
          r = await window.optimizeProjectImages({ force: true });
        }
        const mb = (n) => (Number(n || 0) / 1024 / 1024).toFixed(1);
        if (r && r.ok && r.noop) {
          setStatus('✓ 이미 최적화된 프로젝트입니다 (인라인 이미지 0개)', 'ok');
        } else if (r && r.ok && r.base64After === 0) {
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
        autoExternalizeOnOpen: _draft.autoExternalizeOnOpen === true,
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
  /* ── 협업 탭 ─────────────────────────────────────────────────────────────
   * 받은 초대 · 참여 중인 프로젝트 · 초대 보내기 · 연결 끊기.
   * ★여기가 초대의 «유일한 창구»다: Electron 은 native prompt() 를 «차단»한다
   *   (복제 기능이 그것 때문에 한 번 죽었다) → 카드에서 이메일을 받을 수 없다.
   * ★새 CSS 0줄 — 개발자 탭이 쓴 공용 클래스를 그대로 쓴다(디자인 게이트).
   * ★수락/거절/끊기는 «되돌리기 어려운» 동작이다. 눌린 즉시 버튼을 잠그고,
   *   끝나면 목록을 다시 읽는다(낙관적 UI 로 「된 것처럼」 그리지 않는다 —
   *   서버가 거절했는데 화면만 성공해 보이는 게 제일 나쁘다).
   */
  /* ★렌더 토큰 — 이 pane 은 «두 번 연속» 그려질 수 있다(모달 열 때 한 번 + 탭 클릭 때 한 번).
   *   그런데 아래 비동기 꼬리들은 «resolve 되는 시점»의 DOM 을 다시 찾아 리스너를 건다.
   *   그래서 1차 렌더의 꼬리가 2차 렌더가 만든 버튼에 리스너를 «또» 걸어버린다.
   *   ⇒ 클릭 한 번에 초대가 «두 번» 나간다. 실측으로 잡았다(초대 1번 눌렀는데 iv2·iv3 두 개 생성).
   *   각 렌더는 자기 번호를 들고, 번호가 밀렸으면 아무것도 안 한다. */
  let _collabRender = 0;
  function renderCollabPane() {
    const pane = document.querySelector('.settings-pane-collab');
    if (!pane) return;
    const myRender = ++_collabRender;
    const stale = () => myRender !== _collabRender;
    pane.innerHTML = `
      <div class="settings-section-title">받은 초대</div>
      <div class="settings-api-list" id="collab-invites"><div class="settings-help">불러오는 중…</div></div>
      <div class="settings-section-title" style="margin-top:18px">참여 중인 공동작업</div>
      <div class="settings-api-list" id="collab-projects"><div class="settings-help">불러오는 중…</div></div>
      <div class="settings-section-title" style="margin-top:18px">초대 보내기</div>
      <div class="settings-api-list">
        <div class="settings-api-row">
          <div class="settings-api-label">이 프로젝트에 초대할 이메일</div>
          <div class="settings-api-input-wrap">
            <input class="settings-api-input" id="collab-invite-email" placeholder="name@example.com" spellcheck="false" />
            <button class="settings-api-test" id="collab-invite-send">초대</button>
          </div>
          <div class="settings-help" id="collab-invite-help">지금 열려 있는 프로젝트를 먼저 「원격으로 올리기」 해야 초대할 수 있습니다.</div>
        </div>
      </div>
      <div class="settings-api-status" id="collab-status" style="margin-top:12px"></div>
    `;

    const $ = (id) => pane.querySelector('#' + id);
    const status = $('collab-status');
    const setStatus = (m, cls) => { status.textContent = m; status.className = 'settings-api-status' + (cls ? ' ' + cls : ''); };
    const api = window.electronAPI && window.electronAPI.collab;
    if (!api) { setStatus('공동작업은 데스크탑 앱에서만 사용할 수 있습니다', 'err'); return; }

    // 서버 reason → 사람이 다음에 뭘 할지 아는 문장. 코드값을 그대로 보여주면 아무것도 못 한다.
    const reasonText = (r) => ({
      not_signed_in: '로그인이 필요합니다.',
      invalid_session: '로그인이 만료됐습니다. 다시 로그인해 주세요.',
      offline: '서버에 닿지 못했습니다.',
      not_deployed: '서버에 공동작업 기능이 아직 배포되지 않았습니다.',
      not_a_member: '접근 권한이 없습니다(이미 끊겼을 수 있습니다).',
      already_member: '이미 참여 중인 사람입니다.',
      self_invite: '자기 자신은 초대할 수 없습니다.',
      not_linked: '이 프로젝트는 아직 원격으로 올리지 않았습니다.',
    }[r] || r || '알 수 없는 오류');

    const row = (label, help, buttons) => `
      <div class="settings-api-row">
        <div class="settings-api-label">${label}</div>
        <div class="settings-api-input-wrap">
          <input class="settings-api-input" readonly value="${help || ''}" spellcheck="false" />
          ${buttons}
        </div>
      </div>`;

    async function load() {
      const r = await api.invites({});
      if (stale()) return;
      const inv = $('collab-invites'); const prj = $('collab-projects');
      if (!r || !r.ok) {
        const msg = `<div class="settings-help">불러오지 못했습니다 — ${reasonText(r && r.reason)}</div>`;
        inv.innerHTML = msg; prj.innerHTML = msg;
        return;
      }
      const invites = r.invites || [];
      const projects = r.projects || [];
      inv.innerHTML = invites.length
        ? invites.map(i => row(i.name || i.collabId, '초대를 받았습니다',
            `<button class="settings-api-test" data-accept="${i.inviteId}">수락</button>
             <button class="settings-api-test" data-decline="${i.inviteId}">거절</button>`)).join('')
        : '<div class="settings-help">받은 초대가 없습니다.</div>';
      prj.innerHTML = projects.length
        ? projects.map(p => row(p.name || p.collabId, p.role === 'owner' ? '내가 올린 공동작업본' : '초대받아 참여 중',
            `<button class="settings-api-test" data-leave="${p.collabId}">연결 끊기</button>`)).join('')
        : '<div class="settings-help">참여 중인 공동작업이 없습니다.</div>';

      pane.querySelectorAll('[data-accept],[data-decline],[data-leave]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const lock = () => { btn.disabled = true; btn.textContent = '…'; };
          if (btn.dataset.leave) {
            // ⚠️되돌릴 수 없다 — 다시 들어오려면 상대가 «다시 초대»해야 한다. 그래서 묻는다.
            if (!confirm('이 공동작업 연결을 끊을까요?\n\n로컬 프로젝트는 그대로 남습니다.\n다시 참여하려면 상대가 다시 초대해야 합니다.')) return;
            lock();
            const rr = await api.leave({ collabId: btn.dataset.leave });
            setStatus(rr && rr.ok ? '✓ 연결을 끊었습니다' : '✗ ' + reasonText(rr && rr.reason), rr && rr.ok ? 'ok' : 'err');
          } else {
            const accept = !!btn.dataset.accept;
            lock();
            const rr = await api.respond({ inviteId: btn.dataset.accept || btn.dataset.decline, action: accept ? 'accept' : 'decline' });
            setStatus(rr && rr.ok ? (accept ? '✓ 참여했습니다' : '거절했습니다') : '✗ ' + reasonText(rr && rr.reason), rr && rr.ok ? 'ok' : 'err');
          }
          load();                                   // 낙관적으로 그리지 않는다 — 서버에 다시 물어본다
          if (window.collabInvites) window.collabInvites.refresh();
        });
      });
    }

    /* 초대는 «지금 열려 있는 프로젝트»에 대해서만 보낸다.
     * 목록에서 아무 프로젝트나 고르게 하면 「어느 걸 초대했지」가 흐려진다. */
    (async () => {
      let pid = '';
      try { pid = new URLSearchParams(location.search).get('project') || ''; } catch (_) {}
      const refR = pid ? await api.ref({ projectId: pid }) : null;
      if (stale()) return;                        // 내가 그린 pane 이 이미 갈렸다 — 남의 버튼에 리스너를 걸지 않는다
      const ref = refR && refR.ref;
      const btn = $('collab-invite-send'); const input = $('collab-invite-email'); const help = $('collab-invite-help');
      if (!ref || !ref.collabId) {
        btn.disabled = true; input.disabled = true;
        help.textContent = pid
          ? '이 프로젝트는 아직 원격으로 올리지 않았습니다. 프로젝트 목록에서 👥 버튼으로 먼저 올려 주세요.'
          : '프로젝트를 연 상태에서만 초대할 수 있습니다.';
        return;
      }
      help.textContent = '초대한 사람의 앱 상단바에 알림이 뜹니다. (초대 메일 발송은 아직 준비 중입니다 — 앱 알림이 정본입니다.)';
      btn.addEventListener('click', async () => {
        const email = (input.value || '').trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setStatus('✗ 이메일 형식이 아닙니다', 'err'); return; }
        btn.disabled = true;
        const rr = await api.invite({ collabId: ref.collabId, email });
        btn.disabled = false;
        if (rr && rr.ok) { input.value = ''; setStatus('✓ 초대했습니다 — 상대가 앱에서 수락하면 참여합니다', 'ok'); }
        else setStatus('✗ ' + reasonText(rr && rr.reason), 'err');
      });
    })();

    load();
  }

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
      /* ★브리지 복사 실패는 «조용히» 넘어가면 안 된다 — 그 순간 이 탭의 연결 안내가
       *   통째로 거짓이 된다(있지도 않은 경로를 붙여넣으라고 시킨다).
       *   패키징하면 원본이 app.asar 안이라 실행이 안 돼서 userData 복사본을 안내하는데,
       *   그 복사가 실패하면 사용자는 「명령을 붙여넣었는데 안 붙는다」만 겪는다. */
      if (info?.bridgeError) setStatus('✗ ' + info.bridgeError, 'err');
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

  window.openSettingsModal = function (initialTab) {
    const modal = ensureModal();
    // 현재 settings → draft 복사
    const cur = window._settings || { apiKeys: {}, shortcuts: {}, easterEggs: {} };
    _draft = {
      apiKeys:   { openai: '', gemini: '', anthropic: '', ...(cur.apiKeys || {}) },
      shortcuts: { ...(cur.shortcuts || {}) },
      easterEggs: { ...defaultEggEnabled, ...(cur.easterEggs || {}) },
      autoExternalizeOnOpen: cur.autoExternalizeOnOpen === true, // [externalize] 기본 OFF
    };
    renderApiPane();
    renderShortcutsPane();
    renderEasterPane();
    renderPerfPane();
    // ★협업 탭은 «열 때» 안 그린다 — 탭을 눌러야 그린다(마켓 탭과 같은 지연 로드).
    //   초대 목록은 네트워크를 타므로, 안 볼 탭 때문에 매번 서버를 두드릴 이유가 없다.
    renderDevPane();
    show(modal);
    // ★특정 탭으로 바로 열 수 있어야 한다 — 상단바 「초대 N건」 배지가 여기로 보낸다.
    //   눌렀는데 엉뚱한 탭이 열리면 사용자는 초대를 못 찾는다.
    if (initialTab) {
      const t = modal.querySelector(`.settings-tab[data-tab="${initialTab}"]`);
      if (t) t.click();
    }
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
