/* ══════════════════════════════════════
   Marketplace (bnam91/goditor-market) — 렌더러 UI
   - 현재 프로젝트를 깃 레포에 올리기(push)
   - 계정별 마켓 목록 보기(list) + 선택 프로젝트 받기(pull → 새 프로젝트로 import)
   main: market:push/list/pull (preload electronAPI.market)
   설정 모달의 "마켓" 탭에서 renderMarketPane(container) 호출.
══════════════════════════════════════ */
(function () {
  const ACCOUNT_KEY = 'goditor.marketAccount';
  const getAccount = () => localStorage.getItem(ACCOUNT_KEY) || 'bnam91';
  const setAccount = (v) => localStorage.setItem(ACCOUNT_KEY, v);

  function _toast(msg) { try { window.showToast?.(msg); } catch (_) { console.log(msg); } }

  async function pushCurrent(account) {
    if (!window.electronAPI?.market) { _toast('⚠️ 마켓 API 없음 (앱 재시작 필요)'); return; }
    const id = window.activeProjectId;
    if (!id) { _toast('⚠️ 열린 프로젝트가 없습니다'); return; }
    const name = (typeof window.getProjectName === 'function' ? window.getProjectName() : '') || id;
    const data = window.serializeProject?.();
    if (!data) { _toast('⚠️ 프로젝트 직렬화 실패'); return; }
    // Phase 1: 전 페이지 스크래치 동봉 (state.pages[].id를 진실소스로 열거)
    let scratch = [];
    try {
      const pageIds = (window.state?.pages || []).map(p => p.id).filter(Boolean);
      scratch = (await window._scratchExportAll?.(id, pageIds)) || [];
    } catch (_) {}
    _toast('⏳ 마켓에 올리는 중…');
    const res = await window.electronAPI.market.push({ account, id, name, data, scratch });
    if (res?.ok) _toast(`✅ 마켓 업로드 완료: ${account}/${name}`);
    else _toast(`❌ 업로드 실패: ${res?.message || '알 수 없음'}`);
    return res;
  }

  async function pullProject(account, id, name) {
    if (!window.electronAPI?.market) { _toast('⚠️ 마켓 API 없음 (앱 재시작 필요)'); return; }
    _toast('⏳ 받는 중…');
    const res = await window.electronAPI.market.pull({ account, id });
    if (!res?.ok) { _toast(`❌ 받기 실패: ${res?.message || '없음'}`); return; }
    let parsed;
    try { parsed = JSON.parse(res.project.data); } catch { _toast('❌ 프로젝트 데이터 손상'); return; }
    // Phase 4: 같은 마켓 프로젝트의 로컬 복사본이 있으면 섹션 diff (1차 정책 = keep-both: 복사본으로 안전 보존)
    let divergeNote = '';
    try {
      if (window.marketMerge) {
        const projs = await window.electronAPI.listProjects?.();
        const mine = (Array.isArray(projs) ? projs : []).filter(p => p && p.marketRef && p.marketRef.id === id);
        if (mine.length) {
          const local = await window.electronAPI.loadProject(mine[0].id);
          if (local && local.pages) {
            const d = window.marketMerge.diffProjects(local, parsed);
            divergeNote = d.diverged
              ? ` · ⚠️분기(변경 ${d.summary.changed}·추가 ${d.summary.added}·삭제 ${d.summary.removed}) → 양쪽 보존`
              : ' · 로컬과 동일';
          }
        }
      }
    } catch (_) {}
    const newId = 'proj_' + Date.now();
    // Phase 2: 받은 시점의 마켓 버전을 marketRef로 박제 → 이후 "내 복사본이 최신인지" 비교 근거
    const proj = { id: newId, name: (res.project.name || name || '마켓 프로젝트') + ' (받음)', ...parsed,
      marketRef: { account, id, version: res.project.version || null, updatedAt: res.project.updatedAt || null, pulledAt: new Date().toISOString() } };
    const saved = await window.electronAPI.saveProject(proj);
    // Phase 1: 받은 스크래치를 새 projectId 키로 복원
    try {
      let scratch = res.project.scratch;
      if (typeof scratch === 'string') scratch = JSON.parse(scratch);
      if (Array.isArray(scratch) && scratch.length) await window._scratchImportAll?.(newId, scratch);
    } catch (_) {}
    if (saved?.ok !== false) _toast(`✅ 받기 완료 — 홈에서 "${proj.name}" 열기${divergeNote}`);
    else _toast('❌ 저장 실패');
  }

  function _esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

  // Phase 4b: 인터랙티브 resolve 모달 빌더 — 섹션별 [내것/원격/둘다] → applyResolve → 새 머지 프로젝트로 원자 저장(원본 불변).
  // 데이터 fetch와 분리(테스트 가능). saveFn 주입(기본 electronAPI.saveProject).
  function buildResolveModal(meta, local, remoteData, saveFn) {
    if (!window.marketMerge) { _toast('⚠️ 머지 엔진 없음 (앱 재시작 필요)'); return; }
    saveFn = saveFn || (p => window.electronAPI.saveProject(p));
    const { account, id, name } = meta;
    const diverged = window.marketMerge.diffProjects(local, remoteData).sections.filter(s => s.status !== 'same');
    if (!diverged.length) { _toast('변경점 없음 — 로컬이 최신과 동일'); return; }
    const LABELS = { changed: ['내것', '원격', '둘다'], added: ['무시', '받기', '둘다'], removed: ['유지', '삭제', '—'] };
    const def = { changed: 'mine', added: 'theirs', removed: 'mine' };
    const ov = document.createElement('div');
    ov.className = 'market-resolve-modal';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:99999;display:flex;align-items:center;justify-content:center;';
    ov.innerHTML = `<div style="background:#222;border:1px solid #3a3a3a;border-radius:8px;width:560px;max-height:80vh;display:flex;flex-direction:column;color:#e8e8e8;font-size:13px;">
      <div style="padding:14px 16px;border-bottom:1px solid #3a3a3a;font-weight:600;">🔀 섹션 머지 — ${_esc(name)} (분기 ${diverged.length}섹션)</div>
      <div id="rsv-list" style="overflow:auto;padding:8px 16px;flex:1;"></div>
      <div style="padding:12px 16px;border-top:1px solid #3a3a3a;display:flex;gap:8px;justify-content:flex-end;">
        <button id="rsv-cancel" class="settings-btn settings-btn-secondary">취소</button>
        <button id="rsv-apply" class="settings-btn settings-btn-primary">머지 적용(새 프로젝트로 저장)</button>
      </div></div>`;
    document.body.appendChild(ov);
    ov.querySelector('#rsv-list').innerHTML = diverged.map(s => {
      const secId = s.key.split('::').slice(-1)[0];
      const opts = LABELS[s.status] || ['내것', '원격', '둘다'];
      return `<div style="padding:7px 0;border-bottom:1px solid #2c2c2c;display:flex;align-items:center;gap:8px;">
        <span style="flex:1;font-family:monospace;">${_esc(secId)} <em style="color:#888;font-style:normal;">(${s.status})</em></span>
        ${opts.map((lbl, i) => { const v = ['mine', 'theirs', 'both'][i]; return lbl === '—' ? '' : `<label style="font-size:12px;"><input type="radio" name="r-${_esc(s.key)}" value="${v}" ${v === def[s.status] ? 'checked' : ''}> ${lbl}</label>`; }).join('')}
      </div>`;
    }).join('');
    ov.querySelector('#rsv-cancel').onclick = () => ov.remove();
    ov.querySelector('#rsv-apply').onclick = async () => {
      const choices = {};
      // 체크된 radio를 직접 순회(키에 '::' 포함 → 셀렉터 이스케이프 회피). name = 'r-'+key.
      ov.querySelectorAll('#rsv-list input[type=radio]:checked').forEach(r => { choices[r.name.slice(2)] = r.value; });
      const parsed = JSON.parse(window.marketMerge.applyResolve(local, remoteData, choices));
      const proj = { id: 'proj_' + Date.now(), name: (name || '머지') + ' (머지)', ...parsed,
        marketRef: { account, id, version: meta.version || null, updatedAt: meta.updatedAt || null, pulledAt: new Date().toISOString() } };
      const saved = await saveFn(proj);
      ov.remove();
      _toast(saved?.ok !== false ? `✅ 머지 완료 — 홈에서 "${proj.name}" 열기` : '❌ 저장 실패');
    };
    return ov;
  }
  async function openResolveModal(account, id, name, localProjId) {
    if (!window.marketMerge) { _toast('⚠️ 머지 엔진 없음 (앱 재시작 필요)'); return; }
    _toast('⏳ 머지 준비 중…');
    const res = await window.electronAPI.market.pull({ account, id });
    if (!res?.ok) { _toast(`❌ 받기 실패: ${res?.message || ''}`); return; }
    let remoteData; try { remoteData = JSON.parse(res.project.data); } catch { _toast('❌ 원격 데이터 손상'); return; }
    const local = await window.electronAPI.loadProject(localProjId);
    if (!local || !local.pages) { _toast('❌ 로컬 프로젝트 로드 실패'); return; }
    buildResolveModal({ account, id, name, version: res.project.version, updatedAt: res.project.updatedAt }, local, remoteData);
  }
  window.marketOpenResolve = openResolveModal;
  window.marketBuildResolveModal = buildResolveModal;

  async function renderMarketPane(container) {
    const account = getAccount();
    container.innerHTML = `
      <div class="settings-section-title">마켓플레이스 (bnam91/goditor-market)</div>
      <div class="settings-help">현재 프로젝트를 깃 레포에 올리고, 계정별 마켓에서 다른 프로젝트를 받을 수 있습니다.</div>
      <div class="market-row" style="display:flex;align-items:center;gap:8px;margin:10px 0;">
        <label style="font-size:12px;color:var(--ui-text-sub,#888)">내 계정</label>
        <input id="market-account" type="text" value="${_esc(account)}" style="flex:0 0 160px;height:28px;background:#1c1c1c;border:1px solid #2a2a2a;border-radius:4px;color:#ddd;padding:0 8px;font-size:12px">
        <button id="market-push-btn" class="settings-btn settings-btn-primary" style="height:30px">현재 프로젝트 올리기</button>
        <button id="market-refresh-btn" class="settings-btn settings-btn-secondary" style="height:30px">목록 새로고침</button>
      </div>
      <div id="market-list" style="margin-top:8px;max-height:340px;overflow:auto;border-top:1px solid #2a2a2a;padding-top:8px;">
        <div style="color:#888;font-size:12px;padding:12px 0;">목록 불러오는 중…</div>
      </div>`;

    const accInput = container.querySelector('#market-account');
    accInput.addEventListener('change', () => setAccount(accInput.value.trim() || 'bnam91'));
    container.querySelector('#market-push-btn').addEventListener('click', async () => {
      await pushCurrent(accInput.value.trim() || 'bnam91');
      loadList();
    });
    container.querySelector('#market-refresh-btn').addEventListener('click', () => loadList());

    async function loadList() {
      const listEl = container.querySelector('#market-list');
      listEl.innerHTML = `<div style="color:#888;font-size:12px;padding:12px 0;">목록 불러오는 중…</div>`;
      if (!window.electronAPI?.market) { listEl.innerHTML = `<div style="color:#c66;font-size:12px;">마켓 API 없음 — 앱 재시작 필요</div>`; return; }
      // Phase 3: gh 인증 선점검 (미인증이면 list/pull이 통째 죽으므로 먼저 안내)
      const auth = await window.electronAPI.market.auth?.();
      if (auth && auth.ok === false) { listEl.innerHTML = `<div style="color:#c66;font-size:12px;">${_esc(auth.message)}</div>`; return; }
      const res = await window.electronAPI.market.list();
      if (!res?.ok) { listEl.innerHTML = `<div style="color:#c66;font-size:12px;">목록 실패: ${_esc(res?.message)}</div>`; return; }
      const items = res.items || [];
      if (!items.length) { listEl.innerHTML = `<div style="color:#888;font-size:12px;padding:12px 0;">아직 올라온 프로젝트가 없습니다.</div>`; return; }
      // Phase 2: 내 로컬 복사본 marketRef ↔ 마켓 version 비교 → 최신여부 배지
      const localRefs = {};
      try {
        const projs = await window.electronAPI.listProjects?.();
        (Array.isArray(projs) ? projs : []).forEach(p => {
          const r = p && p.marketRef;
          if (r && r.id && (!localRefs[r.id] || (r.pulledAt || '') > (localRefs[r.id].pulledAt || ''))) localRefs[r.id] = { ...r, _localProjId: p.id };
        });
      } catch (_) {}
      const _fresh = (it) => {
        const r = localRefs[it.id]; if (!r) return '';
        if (!it.version || !r.version) return `<span style="font-size:10px;color:#888;">받음</span>`;
        return r.version === it.version
          ? `<span style="font-size:10px;color:#3ec46d;" title="내 복사본이 마켓 최신과 동일">✓ 최신</span>`
          : `<span style="font-size:10px;color:#e0b020;" title="마켓에 더 새 버전 있음(다시 받기)">⬇ 업데이트</span>`;
      };
      // 계정별 그룹
      const byAcc = {};
      items.forEach(it => { (byAcc[it.account] = byAcc[it.account] || []).push(it); });
      listEl.innerHTML = Object.keys(byAcc).sort().map(acc => `
        <div class="market-acc" style="margin-bottom:10px;">
          <div style="font-size:12px;font-weight:600;color:#aaa;margin-bottom:4px;">👤 ${_esc(acc)}</div>
          ${byAcc[acc].map(it => `
            <div class="market-item" style="display:flex;align-items:center;gap:8px;padding:6px 8px;background:#1a1a1a;border:1px solid #2a2a2a;border-radius:5px;margin-bottom:4px;">
              <span style="flex:1;font-size:12px;color:#ddd;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${_esc(it.name)}</span>
              ${_fresh(it)}
              <span style="font-size:10px;color:#666;">${_esc((it.updatedAt || '').slice(0, 10))}</span>
              <button class="settings-btn settings-btn-secondary market-pull-btn" data-acc="${_esc(it.account)}" data-id="${_esc(it.id)}" data-name="${_esc(it.name)}" style="height:26px;font-size:11px;">받기</button>
              ${(localRefs[it.id] && it.version && localRefs[it.id].version && localRefs[it.id].version !== it.version) ? `<button class="settings-btn settings-btn-secondary market-merge-btn" data-acc="${_esc(it.account)}" data-id="${_esc(it.id)}" data-name="${_esc(it.name)}" data-local="${_esc(localRefs[it.id]._localProjId)}" style="height:26px;font-size:11px;" title="로컬 복사본과 섹션 머지">🔀머지</button>` : ''}
            </div>`).join('')}
        </div>`).join('');
      listEl.querySelectorAll('.market-pull-btn').forEach(b => {
        b.addEventListener('click', () => pullProject(b.dataset.acc, b.dataset.id, b.dataset.name));
      });
      listEl.querySelectorAll('.market-merge-btn').forEach(b => {
        b.addEventListener('click', () => openResolveModal(b.dataset.acc, b.dataset.id, b.dataset.name, b.dataset.local));
      });
    }
    loadList();
  }

  window.renderMarketPane = renderMarketPane;
  window.marketPushCurrent = pushCurrent;
})();
