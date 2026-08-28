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
    const targetId = _ctx.projectId;   // ★await 중 close() 가 _ctx 를 null 로 만든다(중대3과 같은 자리)
    const api = _api();
    if (!api || typeof api.historyOpenCopy !== 'function') { _toast('⚠️ 데스크탑 앱에서만 사용할 수 있습니다'); return; }
    btn.disabled = true;
    const prev = btn.textContent;
    btn.textContent = '만드는 중…';
    try {
      const r = await api.historyOpenCopy({ projectId: targetId, ts });
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
    /* ★[1차검수 중대3] «await 를 건너는 동안 _ctx 가 null 이 될 수 있다» — close() 가 그렇게 만든다.
     * 40MB 프로젝트의 안전판 스냅샷은 초 단위라, 응답을 기다리다 Esc/닫기를 누르는 건 현실적 조작이다.
     * 그때 _ctx.projectId 가 NPE → catch → 「저장에 실패했습니다」 알럿이 뜨는데
     * 실제로는 saveProjectToFile 이 «호출조차» 안 됐고, 억제가 한 프레임 뒤 풀려
     * 다음 autosave 가 그 화면을 확정한다 — 안내문과 결과가 «반대»다.
     * ⇒ 시작 시점에 id 를 «값으로» 잡아 두고 이후로는 _ctx 를 안 읽는다. */
    const targetId = _ctx.projectId;
    const api = _api();
    if (!api || typeof api.historyRestore !== 'function') { _toast('⚠️ 데스크탑 앱에서만 사용할 수 있습니다'); return; }
    const row = (view.rows || []).find(r => r.ts === ts);
    const when = row ? `${row.whenText} (${row.agoText})` : '이 버전';
    // ★파괴 경로 — 확인창에서 «되돌릴 수 있다»를 명시한다. 그게 이 기능의 안전판이 하는 일이다.
    const emptyWarn = (row && row.counts && row.counts.sections === 0)
      ? '\n\n⚠️ 이 버전은 «내용이 비어 있습니다» — 교체하면 지금 내용이 화면에서 사라집니다.' : '';
    if (!confirm(`「${when}」 상태로 교체할까요?${emptyWarn}\n\n지금 상태는 교체 «직전»에 자동으로 버전으로 저장됩니다.\n잘못 골랐으면 그걸로 다시 되돌릴 수 있습니다.`)) return;

    const openIds = _openProjectIds();
    const isOpenHere = openIds.includes(targetId);
    // 열려 있으면 «화면의 최신 상태»를 같이 넘긴다 — 디스크만 뜨면 미저장 편집분이 안전판에서 빠진다
    // ⚠️serializeProject() 는 «활성 탭»의 DOM 을 직렬화한다 — 대상이 활성 탭이 아니면
    //   A 프로젝트 내용이 B 의 안전판으로 박힌다. 활성일 때만 넘기고, 아니면 main 이 디스크를 뜨게 둔다.
    let currentData = null;
    if (isOpenHere && window.activeProjectId === targetId
        && typeof window.serializeProject === 'function') {
      try { currentData = JSON.parse(window.serializeProject()); } catch (_) {}
    }

    btn.disabled = true;
    const prev = btn.textContent;
    btn.textContent = '교체 중…';
    try {
      const r = await api.historyRestore({ projectId: targetId, ts, openProjectIds: openIds,
        activeProjectId: window.activeProjectId, currentData });
      if (!r || !r.ok) {
        // ★거부할 땐 «왜»를 말한다 — 이유 없는 거부가 제일 나쁘다(설계 §7-4)
        // ★사람이 읽는 문구(message)가 있으면 그걸 쓴다. 없으면 reason 을 «번역»한다 —
        //   'exception' 같은 영어 토큰만 던지면 사용자가 뭘 해야 할지 모른다.
        const REASON_KO = {
          unknown_open_state: '다른 창에서 열려 있을 수 있어 교체할 수 없습니다.',
          multiple_windows: '창이 여러 개 열려 있어 교체할 수 없습니다.',
          pre_restore_failed: '되돌리기 «직전» 상태를 저장하지 못해 교체를 중단했습니다.',
          pre_restore_pin_unverified: '되돌리기 취소 지점을 확실히 남기지 못해 교체를 중단했습니다.',
          current_unreadable: '지금 프로젝트 파일을 읽지 못해 교체를 중단했습니다.',
          current_unusable: '지금 상태가 온전하지 않아 교체를 중단했습니다.',
          not_found: '그 버전을 찾을 수 없습니다.', corrupt: '그 버전 파일이 손상됐습니다.',
          write_failed: '파일을 쓰지 못했습니다.', unavailable: '데스크탑 앱에서만 사용할 수 있습니다.',
        };
        const rr = (r && r.reason) || '';
        const msg = (r && r.message)
          || REASON_KO[rr]
          || `교체하지 못했습니다${rr ? ` (${rr})` : ''}`;
        alert(msg + (r && (r.reason === 'multiple_windows' || r.reason === 'unknown_open_state')
          ? '\n\n대신 「사본으로」를 누르면 새 프로젝트로 복원됩니다.' : ''));
        return;
      }
      if (r.applyInRenderer) {
        /* ★autosave 경합 회피 — commit-system.js:269 가 세운 정본.
         * ⚠️[H3] 단 «해제 시점»이 중요하다. applyProjectData 는 스스로 억제를 켜고
         *   rAF 로 «한 프레임 뒤»에 푼다(save-load.js:493) — MutationObserver 가 microtask 뒤에
         *   발화하기 때문이다. 여기서 finally 로 «동기» 해제하면 그 창을 닫아버려,
         *   관측자가 억제 꺼진 상태로 발화해 자동저장을 예약한다(실 Chromium 대조실험으로 확인).
         * ⇒ 우리가 «켠» 경우에만, 그것도 한 프레임 뒤에 «원래 값»으로 되돌린다.
         *   (남이 켜둔 억제 창 — 탭 전환·프로젝트 로드·collab 패치 — 을 중간에서 끄지 않기 위해서도 필요하다) */
        const hadState = !!window.state;
        const prevSuppress = hadState ? window.state._suppressAutoSave : undefined;
        if (hadState) window.state._suppressAutoSave = true;
        try {
          window.applyProjectData(r.data);
        } catch (e) {
          // ★적용이 도중에 던지면 DOM 은 «반쯤» 바뀐 상태다. 억제를 그대로 두면 그게 저장되지 않지만,
          //   사용자에겐 실패를 알려야 한다. 억제는 아래 rAF 가 원래 값으로 되돌린다.
          // ⚠️여기서 alert 후 throw 하면 바깥 catch 가 «또» alert 한다 — 같은 사고에 창이 두 번 뜬다.
          //   표시했다는 표를 달아 바깥이 중복하지 않게 한다.
          e.__vhAlerted = true;
          alert(`교체하지 못했습니다 — ${e.message}\n\n화면이 중간 상태일 수 있으니 새로고침하세요.\n지금 상태는 버전 목록 맨 위에 저장돼 있습니다.`);
          throw e;
        } finally {
          if (hadState) {
            const restore = () => { window.state._suppressAutoSave = prevSuppress; };
            if (typeof requestAnimationFrame === 'function') requestAnimationFrame(restore); else setTimeout(restore, 0);
          }
        }
        /* ★[M4] 정상 저장경로를 «탄다». saveProject 로 직접 쏘면 기존 파일과의 병합이 없어
         *   marketRef 가 사라지고 updatedAt 이 과거로 감긴다(갤러리 정렬이 뒤로 밀린다).
         *   saveProjectToFile 이 merge·id·name·updatedAt·branches 분리를 전부 해준다. */
        let saveOk = true;
        try {
          if (typeof window.saveProjectToFile === 'function') {
            const res = await window.saveProjectToFile(JSON.stringify(r.data), { projectId: targetId });
            // ★[치명] 초판은 `res === false` 였는데 save-load 는 «불리언 false 를 반환하지 않는다».
            //   가드가 «글자만 남고» 죽어 있었다 — EACCES·디스크풀은 물론, 하필 「이 버전은 내용이
            //   비어 있습니다」라고 스스로 경고하는 그 케이스(S11 빈 캔버스 스킵)까지 조용히 통과했다.
            //   화면만 옛 버전, 디스크는 그대로 → 앱 닫으면 「교체가 안 먹었다」.
            //   ★주석은 가드가 아니다. 계약(`{ok:false}` / undefined=큐잉)에 맞춘다.
            if (res && res.ok === false) saveOk = false;
          } else {
            const res = await api.saveProject({ ...r.data, id: targetId });
            saveOk = !!(res && res.ok);
          }
        } catch (_) { saveOk = false; }
        // ★[M5] 저장 실패를 삼키고 「교체됨」이라 말하지 않는다 — 무조건 초록 토스트로 이미 한 번 데였다
        if (!saveOk) {
          alert('화면엔 적용됐지만 «저장에 실패»했습니다.\n앱을 닫기 전에 다시 저장하세요.\n지금 상태는 버전 목록 맨 위에 저장돼 있습니다.');
          return;
        }
      }
      /* ★[1차검수 중대2] showToast 는 «단일 슬롯»이라 같은 tick 에 두 번 부르면 앞의 것이 0ms 만에 덮인다.
       * 그런데 「이미지 N개 없음」은 복구 도구에서 «비어 보이는 게 사고인지»를 알려주는 유일한 자리다.
       * ⇒ 겹치면 한 줄로 합친다. 토스트를 두 번 부르지 «않는다». */
      const missing = (r.missingAssets && r.missingAssets.length) || 0;
      _toast(missing
        ? `↩ 교체됨 — ⚠️ 이미지 ${missing}개가 없어 비어 보일 수 있어요 · 직전 상태는 목록 맨 위에`
        : '↩ 교체됨 — 직전 상태는 버전 목록 맨 위에 있어요');
      close();
      if (typeof window.renderGrid === 'function') { try { await window.renderGrid(); } catch (_) {} }
    } catch (e) {
      if (!e || !e.__vhAlerted) alert(`교체하지 못했습니다 — ${e && e.message ? e.message : e}`);
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

  /* ── 진입점 «해석기» — 세 진입점이 한 함수를 지난다 ────────────────────
   * ① 갤러리 카드 🕐 → id 를 «자기가» 안다(카드가 그 프로젝트다) → 이 함수를 안 탄다
   * ② 에디터 상단바 배지 · ③ 환경설정 「버전 기록」 탭 → 「지금 어느 프로젝트냐」를 여기서 답한다
   *
   * ⛔«아무 프로젝트나»로 폴백하지 않는다. 복구 도구가 엉뚱한 프로젝트의 과거를 보여주면 그게 최악이다.
   *   못 정하면 «못 정한다»고 말하고 «대안»을 알려준다(설계 §7-4: 이유 없는 거부가 제일 나쁘다).
   * @returns {{ok:true, projectId:string, projectName:string}|{ok:false, reason:string, message:string}}
   */
  function resolveVersionHistoryTarget() {
    const id = (typeof window !== 'undefined') && window.activeProjectId;
    if (!id) {
      return { ok: false, reason: 'no_active_project',
        message: '열린 프로젝트가 없습니다. 프로젝트를 연 뒤 다시 열거나, 갤러리에서 카드의 🕐 를 누르세요.' };
    }
    let name = '';
    try {
      const tabs = window.openTabs;
      if (Array.isArray(tabs)) name = (tabs.find(t => t && t.id === id) || {}).name || '';
    } catch (_) {}
    return { ok: true, projectId: id, projectName: name };
  }

  /** 상단바 배지·설정 탭이 쓰는 «한 경로». 못 정하면 이유를 말한다. */
  function openVersionHistoryHere() {
    const t = resolveVersionHistoryTarget();
    if (!t.ok) { if (typeof window.alert === 'function') window.alert(t.message); return; }
    return openVersionHistory({ projectId: t.projectId, projectName: t.projectName });
  }

  window.openVersionHistory = openVersionHistory;
  window.openVersionHistoryHere = openVersionHistoryHere;
  window.resolveVersionHistoryTarget = resolveVersionHistoryTarget;
  window.closeVersionHistory = close;
})();
