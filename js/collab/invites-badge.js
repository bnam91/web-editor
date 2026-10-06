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
    return typeof window.isSettingsTabEnabled === 'function' && window.isSettingsTabEnabled('collab') === true;
  }

  function openCollabSettings() {
    // 환경설정의 「협업」 탭으로 보낸다. 탭이 아직 없으면 모달만 연다 —
    // ★「눌렀는데 아무 일도 안 일어난다」가 제일 나쁘다.
    // ★배지는 inboxOpen() 일 때만 뜬다(boot) ⇒ 여기 오면 탭은 열려 있다. 그래도 같은 술어로 한 번 더 본다.
    /* ★C2·C3(2026-10-06): 창구가 닫혀 있는데 모달을 열거나 「환경설정 › 협업 에서…」 라고 안내하면 «거짓 안내»다
     *   (탭이 회색이라 가 봐도 못 누른다). 그 사실을 그대로 말한다 — 문장은 reasons.js 표(inbox_closed).
     *   ⚠️지금은 «죽은 길»이다: 이 함수는 IIFE 지역이고 부르는 자리는 boot 가 단 클릭 리스너 하나뿐인데, boot 가 같은 술어로
     *   리스너를 안 단다(2026-10-06 코드로 판정 · 검사로는 못 잰다 — 닿을 길이 0). 술어와 클릭이 갈리는 날을 위한 방어다. */
    if (!inboxOpen()) {
      const msg = window.CollabReasons ? window.CollabReasons.text('inbox_closed') : 'inbox_closed';
      if (typeof window.showToast === 'function') window.showToast(msg); else console.warn('[collab]', msg);
      return;
    }
    if (typeof window.openSettingsModal === 'function') { window.openSettingsModal('collab'); return; }
    if (typeof window.toggleSettingsModal === 'function') { window.toggleSettingsModal(); return; }
    alert('환경설정 › 협업 에서 초대를 확인할 수 있습니다.');   // 창구가 열려 있을 때만 닿는다 ⇒ 이제 참인 안내
  }

  function boot() {
    if (!inboxOpen()) return;   // ★킬스위치 ＋ MVP 문: 초대를 받을 창구가 닫혀 있으면 폴링·배지 안 뜸(S7)
    const el = document.getElementById('collab-invite-badge');
    if (el) el.addEventListener('click', openCollabSettings);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
    start();
  }
  if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', boot);
  else boot();
  window.addEventListener('beforeunload', stop);

  window.collabInvites = { refresh, start, stop, latest: () => _last, inboxOpen };
})();
