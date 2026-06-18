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
    _toast('⏳ 마켓에 올리는 중…');
    const res = await window.electronAPI.market.push({ account, id, name, data });
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
    const newId = 'proj_' + Date.now();
    const proj = { id: newId, name: (res.project.name || name || '마켓 프로젝트') + ' (받음)', ...parsed };
    const saved = await window.electronAPI.saveProject(proj);
    if (saved?.ok !== false) _toast(`✅ 받기 완료 — 홈(프로젝트 목록)에서 "${proj.name}" 열기`);
    else _toast('❌ 저장 실패');
  }

  function _esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

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
      const res = await window.electronAPI.market.list();
      if (!res?.ok) { listEl.innerHTML = `<div style="color:#c66;font-size:12px;">목록 실패: ${_esc(res?.message)}</div>`; return; }
      const items = res.items || [];
      if (!items.length) { listEl.innerHTML = `<div style="color:#888;font-size:12px;padding:12px 0;">아직 올라온 프로젝트가 없습니다.</div>`; return; }
      // 계정별 그룹
      const byAcc = {};
      items.forEach(it => { (byAcc[it.account] = byAcc[it.account] || []).push(it); });
      listEl.innerHTML = Object.keys(byAcc).sort().map(acc => `
        <div class="market-acc" style="margin-bottom:10px;">
          <div style="font-size:12px;font-weight:600;color:#aaa;margin-bottom:4px;">👤 ${_esc(acc)}</div>
          ${byAcc[acc].map(it => `
            <div class="market-item" style="display:flex;align-items:center;gap:8px;padding:6px 8px;background:#1a1a1a;border:1px solid #2a2a2a;border-radius:5px;margin-bottom:4px;">
              <span style="flex:1;font-size:12px;color:#ddd;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${_esc(it.name)}</span>
              <span style="font-size:10px;color:#666;">${_esc((it.updatedAt || '').slice(0, 10))}</span>
              <button class="settings-btn settings-btn-secondary market-pull-btn" data-acc="${_esc(it.account)}" data-id="${_esc(it.id)}" data-name="${_esc(it.name)}" style="height:26px;font-size:11px;">받기</button>
            </div>`).join('')}
        </div>`).join('');
      listEl.querySelectorAll('.market-pull-btn').forEach(b => {
        b.addEventListener('click', () => pullProject(b.dataset.acc, b.dataset.id, b.dataset.name));
      });
    }
    loadList();
  }

  window.renderMarketPane = renderMarketPane;
  window.marketPushCurrent = pushCurrent;
})();
