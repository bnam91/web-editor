/* ═══════════════════════════════════════════════════════════════════════════
   collab/invites-badge.js — 「초대가 와 있다」를 상단바에 알린다.
   ───────────────────────────────────────────────────────────────────────────
   ★왜 폴링인가
     초대 메일을 «보낼 수단이 지금 없다»(홈페이지의 mail 큐엔 소비자가 없다).
     그러니 메일이 정본이면 초대는 도달하지 않는다. ⇒ 앱이 스스로 물어보는 이 경로가
     «정본»이고, 메일은 나중에 붙는 보조수단이다.

   ★주기가 동기화 루프(2초)와 «다르다»
     섹션 패치는 초 단위로 급하지만 초대는 하루에 몇 번이다. 같은 2초로 돌리면
     아무 일도 안 일어나는 요청을 하루 4만 번 보낸다. 20초로 둔다.
     ⇒ 「폴링이니까 다 같은 주기」는 게으른 설계다. 주기는 «변화의 속도»를 따라간다.

   ★창이 안 보이면 쉰다 — 배경 탭에서 계속 두드릴 이유가 없다.
═══════════════════════════════════════════════════════════════════════════ */
(function () {
  const POLL_MS = 20000;
  let _timer = null;
  let _last = { invites: [], projects: [] };

  /* ★invites 가 «함수»일 때만 협업 API 로 친다(2026-10-06 켤 때 실측): 데스크탑 preload 는 collab 객체에 invites 를 준다(preload.js:101~).
     그 밖의 꼴(웹 빌드 · 검사 하네스의 가짜 electronAPI 처럼 collab 이 함수인 것)에서 20초마다 «c.invites is not a function» 을
     던지지 않게 — 조용한 까닭: 초대를 물을 길이 없는 화면이다(배지는 알림이지 진단창이 아니다 · C1 과 같은 판단). */
  const api = () => { const c = window.electronAPI && window.electronAPI.collab; return (c && typeof c.invites === 'function') ? c : null; };

  /* ★SIX ①(2026-10-06 · 현빈 「종모양 svg 같은 데서 초대받았다는 노티 — 수락할지 거절할지」):
   *   옛 판은 이모지 글자 「✉️ 초대 N건」 + 클릭 = 환경설정 › 협업으로 «보내기»였다. 이제 종(인라인 SVG) + 안 읽은 수,
   *   누르면 «그 자리» 칸에서 초대마다 [수락] [거절] · 수락하면 그 자리에서 [열기].
   *   ★두 화면(편집기 index.html · 목록 pages/projects.html)이 «이 파일 하나»를 싣는다 — 프로젝트가 0 개인 사람은
   *     편집기를 못 열어 초대를 볼 길이 0 이었다(지디 실측). 그래서 목록 화면에도 같은 종을 단다. */
  const T = (k) => (window.CollabReasons ? window.CollabReasons.text(k) : k);
  const BELL = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
    + '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>';
  let _open = false;
  let _status = '';           // 칸 아래 한 줄(수락·거절 결과 · 실패 문장)
  let _ready = null;          // { projectId, name } — 방금 수락해 「열기」를 줄 것

  function paint() {
    const el = document.getElementById('collab-invite-badge');
    if (!el) return;
    const n = (_last.invites || []).length;
    if (!n && !_open && !_ready) { el.style.display = 'none'; el.innerHTML = ''; closePanel(); return; }
    el.innerHTML = BELL + (n ? `<span class="collab-bell-count" style="display:inline-block;min-width:14px;margin-left:2px;padding:0 4px;border-radius:7px;background:#e74c3c;color:#fff;font-size:10px;line-height:14px;text-align:center;">${n}</span>` : '');
    el.title = T('inbox_title');
    el.setAttribute('role', 'button');
    el.setAttribute('aria-label', `${T('inbox_title')} ${n}`);
    el.style.display = '';
    if (_open) renderPanel();
  }

  function closePanel() { const p = document.getElementById('collab-inbox-pop'); if (p) p.style.display = 'none'; }

  function renderPanel() {
    const el = document.getElementById('collab-invite-badge');
    let pop = document.getElementById('collab-inbox-pop');
    if (!pop) {
      pop = document.createElement('div');
      pop.id = 'collab-inbox-pop';
      pop.style.cssText = 'position:fixed;z-index:2147483000;min-width:280px;max-width:380px;padding:8px;background:#1e1e1e;color:#eee;'
        + 'border:1px solid #444;border-radius:8px;box-shadow:0 6px 24px rgba(0,0,0,.4);font-size:12px;';
      pop.addEventListener('click', (e) => e.stopPropagation());
      document.body.appendChild(pop);
    }
    const r = el.getBoundingClientRect();
    pop.style.left = Math.max(8, Math.min(window.innerWidth - 390, Math.round(r.left))) + 'px';
    pop.style.top = Math.round(r.bottom + 6) + 'px';
    pop.innerHTML = '';
    const invs = _last.invites || [];
    if (!invs.length && !_ready) {
      const e = document.createElement('div'); e.style.opacity = '.7'; e.textContent = '받은 초대가 없습니다.'; pop.appendChild(e);
    }
    for (const iv of invs) {
      const row = document.createElement('div');
      row.className = 'collab-inbox-row'; row.dataset.inviteId = iv.inviteId;
      row.style.cssText = 'padding:6px 2px;border-bottom:1px solid #333;';
      const t = document.createElement('div'); t.style.fontWeight = '600'; t.textContent = iv.name || iv.projectName || iv.collabId;
      const who = document.createElement('div'); who.style.cssText = 'opacity:.75;margin:2px 0 6px;';
      who.textContent = `${iv.invitedBy || ''} ${T('invited_by')}`.trim();
      const ok = document.createElement('button'); ok.className = 'settings-api-test'; ok.dataset.accept = iv.inviteId; ok.textContent = '수락';
      const no = document.createElement('button'); no.className = 'settings-api-test'; no.dataset.decline = iv.inviteId; no.textContent = '거절'; no.style.marginLeft = '6px';
      ok.addEventListener('click', () => respond(iv, true, ok));
      no.addEventListener('click', () => respond(iv, false, no));
      row.append(t, who, ok, no);
      pop.appendChild(row);
    }
    if (_ready) {
      const row = document.createElement('div'); row.style.cssText = 'padding:6px 2px;';
      const t = document.createElement('div'); t.textContent = _ready.name || '';
      const open = document.createElement('button'); open.className = 'settings-api-test'; open.id = 'collab-inbox-open'; open.textContent = '열기';
      open.addEventListener('click', () => openReady());
      row.append(t, open); pop.appendChild(row);
    }
    if (_status) { const s = document.createElement('div'); s.className = 'collab-inbox-status'; s.style.cssText = 'margin-top:6px;opacity:.85;'; s.textContent = _status; pop.appendChild(s); }
    pop.style.display = '';
  }

  async function respond(iv, accept, btn) {
    const c = api(); if (!c || typeof c.respond !== 'function') return;
    btn.disabled = true; btn.textContent = '…';
    const rr = await c.respond({ inviteId: iv.inviteId, action: accept ? 'accept' : 'decline' });
    if (!rr || !rr.ok) { _status = '✗ ' + T((rr && rr.reason) || 'unknown'); await refresh(); paint(); return; }
    if (!accept) { _status = '거절했습니다'; await refresh(); paint(); return; }
    /* 수락 = 서버 멤버 + «이 컴퓨터»에 로컬 프로젝트 + collabRef — collab/accept.js(두 화면 공용)가 한다. */
    const lk = window.collabAccept ? await window.collabAccept.link(rr) : { ok: false, reason: 'unavailable' };
    if (lk && lk.ok) {
      _ready = { projectId: lk.projectId, name: lk.name || rr.name || '' };
      _status = lk.reused ? '✓ 참여했습니다 — 이미 연결된 프로젝트가 있어 그것을 씁니다' : '✓ 참여했습니다 — 로컬 프로젝트를 만들었습니다';
      if (typeof window.renderGrid === 'function') { try { await window.renderGrid(); } catch (e) { console.error('[collab/inbox] 목록 다시 그리기 실패:', e); } }
    } else {
      _status = '✓ 참여했지만 로컬 프로젝트 연결에 실패했습니다 — ' + (window.CollabReasons ? window.CollabReasons.text(lk && lk.reason, lk) : (lk && lk.reason));
    }
    await refresh(); paint();
  }

  function openReady() {
    const id = _ready && _ready.projectId; if (!id) return;
    _ready = null; _open = false; closePanel();
    /* 목록 화면은 자기 openProject(id)(pages/projects.html — 에디터로 이동) · 편집기는 collabAccept.open(탭으로 열고 동기화 시작) */
    if (typeof window.openProject === 'function' && !window.collabSync) { window.openProject(id); return; }
    if (window.collabAccept) window.collabAccept.open(id);
  }

  async function refresh() {
    const c = api(); if (!c) return;
    if (document.hidden) return;                    // 안 보이는 창은 두드리지 않는다
    const r = await c.invites({});
    /* ★조용한 까닭(C1 · 지디 판정 2026-10-06): 배지는 «알림»이지 진단창이 아니다. 실패는 다음 20초 폴링이 다시 묻는다 —
     *   진짜 문제(로그인·오프라인)는 편집기 동기화(notify.js)와 협업 탭이 말한다. 여기서 또 말하면 같은 실패가 두 번 뜬다. */
    if (!r || !r.ok) return;
    _last = { invites: r.invites || [], projects: r.projects || [] };
    paint();
    window.dispatchEvent(new CustomEvent('gd:collab-invites', { detail: _last }));
  }

  function start() {
    if (_timer) return;
    _timer = setInterval(refresh, POLL_MS);
    refresh();
  }
  function stop() { if (_timer) clearInterval(_timer); _timer = null; }

  /* ★S7(2026-10-06 발주 TWO ⒜): 「초대를 받을 창구가 열려 있나」 — 두 스위치를 «한 술어»로 묶는다.
   *   COLLAB_ENABLED(js/feature-flags.js) ＋ 설정의 협업 탭이 MVP 문 밖인가(settings-modal.js
   *   isSettingsTabEnabled). 하나만 보면 「배지는 떴는데 탭이 회색」 — 눌러도 아무 일 없다.
   *   ⛔술어가 «없으면» 닫힌 쪽(배지 안 띄움): 못 받을 초대를 알리는 것보다 안 알리는 게 낫다. */
  function inboxOpen() {
    if (!window.COLLAB_ENABLED) return false;
    /* ★SIX ①: 초대는 이제 종 칸에서 «그 자리» 수락한다 — 설정 탭을 거치지 않는다. 그래서 설정 모달이 «없는» 화면(목록)에서는
     *   COLLAB_ENABLED 하나로 연다. 설정 술어가 «있는» 화면(편집기)에선 여전히 같이 본다(MVP 문이 닫히면 같이 닫힌다). */
    if (typeof window.isSettingsTabEnabled !== 'function') return true;
    return window.isSettingsTabEnabled('collab') === true;
  }

  function toggle(e) {
    if (e) e.stopPropagation();
    /* ★C2·C3: 창구가 닫혀 있으면 «거짓 안내» 대신 그 사실을 말한다(문장 = reasons.js inbox_closed).
     *   ⚠️boot 가 같은 술어로 리스너를 안 다니 지금은 닿는 길 0 — 술어와 클릭이 갈리는 날을 위한 방어다. */
    if (!inboxOpen()) {
      const msg = T('inbox_closed');
      if (typeof window.showToast === 'function') window.showToast(msg); else console.warn('[collab]', msg);
      return;
    }
    _open = !_open;
    if (!_open) { closePanel(); _status = ''; }
    paint();
  }

  function boot() {
    if (!inboxOpen()) return;   // ★킬스위치 ＋ MVP 문: 초대를 받을 창구가 닫혀 있으면 폴링·배지 안 뜸(S7)
    const el = document.getElementById('collab-invite-badge');
    if (el) el.addEventListener('click', toggle);
    document.addEventListener('click', () => { if (_open) { _open = false; _status = ''; closePanel(); paint(); } });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
    start();
  }
  if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', boot);
  else boot();
  window.addEventListener('beforeunload', stop);

  window.collabInvites = { refresh, start, stop, latest: () => _last, inboxOpen, toggle };
})();
