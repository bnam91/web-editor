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

  const api = () => (window.electronAPI && window.electronAPI.collab) || null;

  function paint() {
    const el = document.getElementById('collab-invite-badge');
    if (!el) return;
    const n = (_last.invites || []).length;
    if (!n) { el.style.display = 'none'; el.textContent = ''; return; }
    el.textContent = `✉️ 초대 ${n}건`;
    el.title = _last.invites.map(i => `${i.name || i.collabId} — 수락하려면 클릭(환경설정 › 협업)`).join('\n');
    el.style.display = '';
  }

  async function refresh() {
    const c = api(); if (!c) return;
    if (document.hidden) return;                    // 안 보이는 창은 두드리지 않는다
    const r = await c.invites({});
    if (!r || !r.ok) return;                        // 오프라인·미배포는 «조용히» — 배지는 알림이지 진단창이 아니다
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

  function openCollabSettings() {
    // 환경설정의 「협업」 탭으로 보낸다. 탭이 아직 없으면 모달만 연다 —
    // ★「눌렀는데 아무 일도 안 일어난다」가 제일 나쁘다.
    if (typeof window.openSettingsModal === 'function') { window.openSettingsModal('collab'); return; }
    if (typeof window.toggleSettingsModal === 'function') { window.toggleSettingsModal(); return; }
    alert('환경설정 › 협업 에서 초대를 확인할 수 있습니다.');
  }

  function boot() {
    const el = document.getElementById('collab-invite-badge');
    if (el) el.addEventListener('click', openCollabSettings);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
    start();
  }
  if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', boot);
  else boot();
  window.addEventListener('beforeunload', stop);

  window.collabInvites = { refresh, start, stop, latest: () => _last };
})();
