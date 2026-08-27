/* ══════════════════════════════════════════════════════════════════════════
   version-history-ui.js — 「버전 기록」 모달. 설계: _context/DESIGN-version-history.md §7
   ───────────────────────────────────────────────────────────────────────────
   ★껍데기는 «신작 0» — css/font-substitute.css 가 세운 규율을 그대로 따른다.
     .settings-modal-overlay / -shell / -header / -title / -close / -body / -footer 재사용,
     버튼은 .settings-btn*. 새로 만든 건 css/version-history.css 의 «행 배치»뿐이다.

   ★데이터 계층은 js/version-history.js 다(순수 함수, DOM 접근 0).
     이 파일은 «그 행 모델을 그리는 일»만 한다 — 계산을 여기서 다시 하지 않는다.
     그래야 「무엇을 보여줄지」가 단위테스트로 고정되고, 여기선 배치만 틀리면 된다.

   ★파괴 경로(교체)는 U6a(되돌리기 직전 안전판)가 «단독으로» 초록이 된 뒤에 붙었다.
     그리고 안전판을 «잊을 수 없다» — main 의 prepareRestore 가 실패하면 덮을 데이터 자체를 안 준다.
═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const OVERLAY_ID = 'vhist-overlay';
  let _ctx = null;      // { projectId, projectName }
  let _escHandler = null;

  const _el = (id) => document.getElementById(id);
  const _esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  function _api() {
    return (typeof window !== 'undefined' && window.electronAPI) || null;
  }
  function _toast(msg) {
    if (typeof window.showToast === 'function') window.showToast(msg);
  }

  /* ── 껍데기 ─────────────────────────────────────────────────────────────
   * settings-modal 과 «같은» 여닫기 규율: display flex/none · 오버레이 클릭 · Esc(capture) */
  function _ensureModal() {
    let ov = _el(OVERLAY_ID);
    if (ov) return ov;
    ov = document.createElement('div');
    ov.id = OVERLAY_ID;
    ov.className = 'settings-modal-overlay';
    ov.style.display = 'none';
    ov.innerHTML = `
      <div class="settings-modal-shell vhist-shell" role="dialog" aria-label="버전 기록">
        <div class="settings-modal-header">
          <div class="settings-modal-title" id="vhist-title">버전 기록</div>
          <button class="settings-modal-close" id="vhist-close" title="닫기 (Esc)">×</button>
        </div>
        <div class="settings-modal-body vhist-body">
          <div class="vhist-intro" id="vhist-intro"></div>
          <div class="vhist-list" id="vhist-list"></div>
        </div>
        <div class="settings-modal-footer">
          <div class="vhist-intro" id="vhist-status"></div>
          <div style="flex:1"></div>
          <button class="settings-btn settings-btn-secondary" id="vhist-done">닫기</button>
        </div>
      </div>`;
    document.body.appendChild(ov);
    ov.addEventListener('click', (e) => { if (e.target === ov) close(); });
    _el('vhist-close').addEventListener('click', close);
    _el('vhist-done').addEventListener('click', close);
    return ov;
  }

  function close() {
    const ov = _el(OVERLAY_ID);
    if (ov) ov.style.display = 'none';
    if (_escHandler) { document.removeEventListener('keydown', _escHandler, true); _escHandler = null; }
    _ctx = null;
  }

  /* ── 행 그리기 — 계산은 version-history.js 가 이미 했다 ─────────────────── */
  function _rowHtml(r) {
    const badge = r.badgeText
      ? `<span class="vhist-badge${r.pinned ? ' is-pinned' : ''}">${_esc(r.badgeText)}</span>` : '';
    const when = r.isCurrent
      ? `<div class="vhist-when">지금${badge}</div>`
      : `<div class="vhist-when">${_esc(r.whenText)}<span class="vhist-ago">${_esc(r.agoText)}</span>${badge}</div>`;
    // 숫자는 «버전 간 비교»용이다 — 절대값이 아니라 증감을 읽는 자리(설계 §D4).
    const meta = `<div class="vhist-meta">섹션 ${_esc(r.sectionsText)} · 블록 ${_esc(r.blocksText)}`
      + ` · 이미지 ${_esc(r.imagesText)} · ${_esc(r.sizeText)}</div>`;
    // ★손실 0 이면 줄 자체를 안 그린다. 사고 직후 화면에서 노이즈가 제일 해롭다.
    const unknown = r.lostText === '비교 불가' || r.lostText === '아직 분석 안 함';
    const loss = r.lostText
      ? `<div class="vhist-loss${unknown ? ' is-unknown' : ''}">${unknown ? '' : '⚠️ '}${_esc(r.lostText)}</div>` : '';
    // ★현빈 확정(Q2): 「이 버전으로 교체」가 «기본»(primary). 사본은 보조.
    //   교체 «직전» 지금 상태가 자동으로 안전판에 박히므로 파괴적이지 않다 — 그걸 확인창에서 말해준다.
    const actions = r.isCurrent ? '<div class="vhist-actions"></div>'
      : `<div class="vhist-actions">
           <button class="settings-btn settings-btn-secondary" data-vh-open="${r.ts}">사본으로</button>
           <button class="settings-btn settings-btn-primary" data-vh-restore="${r.ts}">이 버전으로 교체</button>
         </div>`;
    return `<div class="vhist-row${r.isCurrent ? ' is-current' : ''}">${when}${actions}${meta}${loss}</div>`;
  }

  function _render(view) {
    const list = _el('vhist-list');
    const intro = _el('vhist-intro');
    const status = _el('vhist-status');
    if (!view.ok) {
      list.innerHTML = `<div class="vhist-empty">버전 기록을 읽을 수 없습니다.<br>${_esc(view.reason || '')}</div>`;
      intro.textContent = ''; status.textContent = '';
      return;
    }
    if (!view.rows.length) {
      list.innerHTML = '<div class="vhist-empty">아직 저장된 버전이 없습니다.<br>'
        + '저장할 때마다 자동으로 쌓이고, 여기서 되돌릴 수 있게 됩니다.</div>';
    } else {
      list.innerHTML = (view.currentRow ? _rowHtml(view.currentRow) : '')
        + view.rows.map(_rowHtml).join('');
    }
    intro.textContent = '「지금」과 비교해 «이 버전에는 있는데 지금은 없는» 섹션을 먼저 보여줍니다.';
    const bits = [`버전 ${view.rows.length}개`, `총 ${view.totalText}`];
    if (view.legacyCount) bits.push(`옛 형식 ${view.legacyCount}`);
    if (view.pendingCount) bits.push(`미분석 ${view.pendingCount}`);
    status.textContent = bits.join(' · ');

    list.querySelectorAll('[data-vh-open]').forEach((b) => {
      b.addEventListener('click', () => _openCopy(Number(b.dataset.vhOpen), b));
    });
    list.querySelectorAll('[data-vh-restore]').forEach((b) => {
      b.addEventListener('click', () => _restore(Number(b.dataset.vhRestore), b, view));
    });
  }

  async function _openCopy(ts, btn) {
    if (!_ctx) return;
    const api = _api();
    if (!api || typeof api.historyOpenCopy !== 'function') { _toast('⚠️ 데스크탑 앱에서만 사용할 수 있습니다'); return; }
    btn.disabled = true;
    const prev = btn.textContent;
    btn.textContent = '만드는 중…';
    try {
      const r = await api.historyOpenCopy({ projectId: _ctx.projectId, ts });
      if (!r || !r.ok) { _toast(`⚠️ 사본을 만들지 못했습니다 — ${(r && (r.error || r.code)) || '알 수 없는 오류'}`); return; }
      // ★원본은 그대로 두고 «사본»이 생긴다 — 만져보고 판단하되 원본은 안전하다(설계 §D8)
      _toast(`✅ 「${r.newName}」 사본을 만들었습니다`);
      close();
      // 갤러리에서 열었으면 목록을 다시 그려 사본이 «보이게» 한다(안 보이면 사용자는 못 찾는다)
      if (typeof window.renderGrid === 'function') { try { await window.renderGrid(); } catch (_) {} }
    } catch (e) {
      _toast(`⚠️ 사본을 만들지 못했습니다 — ${e.message}`);
    } finally {
      btn.disabled = false; btn.textContent = prev;
    }
  }

  /* 이 창이 «에디터로 연» 프로젝트 id 목록. 갤러리 페이지엔 에디터가 없으니 빈 배열이 정직한 답이다.
   * ★main 이 추측하지 않게 «항상» 배열을 넘긴다 — 안 넘기면 main 은 판별 불가로 보고 거부한다. */
  function _openProjectIds() {
    try {
      const tabs = window.openTabs;
      if (Array.isArray(tabs)) return tabs.map(t => t && t.id).filter(Boolean);
    } catch (_) {}
    return [];
  }

  async function _restore(ts, btn, view) {
    if (!_ctx) return;
    const api = _api();
    if (!api || typeof api.historyRestore !== 'function') { _toast('⚠️ 데스크탑 앱에서만 사용할 수 있습니다'); return; }
    const row = (view.rows || []).find(r => r.ts === ts);
    const when = row ? `${row.whenText} (${row.agoText})` : '이 버전';
    // ★파괴 경로 — 확인창에서 «되돌릴 수 있다»를 명시한다. 그게 이 기능의 안전판이 하는 일이다.
    if (!confirm(`「${when}」 상태로 교체할까요?\n\n지금 상태는 교체 «직전»에 자동으로 버전으로 저장됩니다.\n잘못 골랐으면 그걸로 다시 되돌릴 수 있습니다.`)) return;

    const openIds = _openProjectIds();
    const isOpenHere = openIds.includes(_ctx.projectId);
    // 열려 있으면 «화면의 최신 상태»를 같이 넘긴다 — 디스크만 뜨면 미저장 편집분이 안전판에서 빠진다
    let currentData = null;
    if (isOpenHere && typeof window.serializeProject === 'function') {
      try { currentData = JSON.parse(window.serializeProject()); } catch (_) {}
    }

    btn.disabled = true;
    const prev = btn.textContent;
    btn.textContent = '교체 중…';
    try {
      const r = await api.historyRestore({ projectId: _ctx.projectId, ts, openProjectIds: openIds, currentData });
      if (!r || !r.ok) {
        // ★거부할 땐 «왜»를 말한다 — 이유 없는 거부가 제일 나쁘다(설계 §7-4)
        const msg = (r && r.message) || `교체하지 못했습니다 — ${(r && r.reason) || '알 수 없는 오류'}`;
        alert(msg + (r && (r.reason === 'multiple_windows' || r.reason === 'unknown_open_state')
          ? '\n\n대신 「사본으로」를 누르면 새 프로젝트로 복원됩니다.' : ''));
        return;
      }
      if (r.applyInRenderer) {
        // ★autosave 경합 회피 — commit-system.js:269 가 세운 정본을 그대로 쓴다.
        //   억제 없이 applyProjectData 를 부르면 MutationObserver 가 1.5초 뒤 옛 DOM 으로 되돌린다.
        if (window.state) window.state._suppressAutoSave = true;
        try { window.applyProjectData(r.data); }
        finally { if (window.state) window.state._suppressAutoSave = false; }
        // 적용한 내용을 «즉시» 디스크에 확정한다 — 안 하면 다음 autosave 까지 디스크는 옛 상태다
        try { await api.saveProject({ ...r.data, id: _ctx.projectId }); } catch (_) {}
      }
      if (r.missingAssets && r.missingAssets.length) {
        _toast(`⚠️ 이미지 ${r.missingAssets.length}개가 없어 비어 보일 수 있습니다`);
      }
      _toast('↩ 교체됨 — 직전 상태는 버전 목록 맨 위에 있어요');
      close();
      if (typeof window.renderGrid === 'function') { try { await window.renderGrid(); } catch (_) {} }
    } catch (e) {
      alert(`교체하지 못했습니다 — ${e.message}`);
    } finally {
      btn.disabled = false; btn.textContent = prev;
    }
  }

  /* ── 진입점 ─────────────────────────────────────────────────────────────
   * @param {{projectId:string, projectName?:string}} opts */
  async function openVersionHistory(opts) {
    const projectId = opts && opts.projectId;
    if (!projectId) return;
    _ctx = { projectId, projectName: (opts && opts.projectName) || '' };

    const ov = _ensureModal();
    _el('vhist-title').textContent = _ctx.projectName ? `버전 기록 — ${_ctx.projectName}` : '버전 기록';
    _el('vhist-list').innerHTML = '<div class="vhist-empty">불러오는 중…</div>';
    _el('vhist-status').textContent = '';
    ov.style.display = 'flex';
    if (!_escHandler) {
      _escHandler = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
      document.addEventListener('keydown', _escHandler, true);
    }

    const api = _api();
    let list = { ok: false, reason: 'unavailable' };
    if (api && typeof api.historyList === 'function') {
      try { list = await api.historyList({ projectId }); }
      catch (e) { list = { ok: false, reason: e.message }; }
    }
    // 계산은 데이터 계층에 맡긴다 — 여기서 다시 세지 않는다
    const view = (window.versionHistory && window.versionHistory.buildRows)
      ? window.versionHistory.buildRows(list)
      : { ok: false, reason: 'version-history.js 미로드', rows: [], currentRow: null, totalText: '—' };
    if (_ctx && _ctx.projectId === projectId) _render(view);
  }

  window.openVersionHistory = openVersionHistory;
  window.closeVersionHistory = close;
})();
