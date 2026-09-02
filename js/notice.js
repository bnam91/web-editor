/* ═══════════════════════════════════════════════════════════════════════════
   notice.js — 운영자 공지의 «화면»(Unit C, 렌더러 쪽).
   ───────────────────────────────────────────────────────────────────────────
   ★플레인 스크립트다(feature-flags.js 와 같은 이유)
     에디터(index.html)와 프로젝트 목록(pages/projects.html)이 «둘 다» 읽는다.
     type=module 로 두면 목록 화면이 안 읽어 그 화면에서만 공지가 안 뜬다.

   ★공지는 2등급뿐이다(현빈 확정)
     normal → 토스트. 「새 공지가 있습니다 · 보기」. 6초 뒤 사라진다. 작업을 «안 끊는다».
              본문은 「보기」를 눌러야 열린다.
     urgent → 모달. 뒤 덮개. 「확인」을 눌러야 닫힌다.

   ★모달 꼴은 settings-modal-* 를 재사용한다. 새 룩을 만들지 않는다(현빈 상시 지시).

   ★편집 중이면 미룬다(PLAN C-f)
     모달은 포커스를 빼앗는다. 한글 조합 중이면 마지막 글자가 날아가고, 드래그 중이면
     드롭이 어긋난다. 그래서 «지금 손을 쓰고 있는지»를 재고, 손을 뗄 때까지 기다린다.
     판정은 busyReason() 에 한 곳으로 모았다 — 이유를 «이름으로» 남겨야 왜 안 떴는지 안다.
     ⛔토스트는 미루지 않는다. 포커스를 안 뺏으니 미룰 이유가 없다.
═══════════════════════════════════════════════════════════════════════════ */
(function (w, d) {
  const api = w.electronAPI;
  if (!api || typeof api.notice !== 'object') return;   // 브라우저 프리뷰 등 — 조용히 없음

  const TOAST_MS = 6000;          // 「작업을 안 끊는다」 — 읽고 「보기」를 누를 만큼만
  const RECHECK_MS = 1500;        // 편집이 끝났는지 다시 재는 간격
  const DEFER_LOG = '[notice]';

  /* ── 서버 시각 기준 ────────────────────────────────────────────────────────
   * ★기기 시계를 믿지 않는다(G1 계약: endAt 은 serverNow 와 견줘라).
   *   맥 시계가 하루 어긋난 사용자에게 끝난 공지가 뜨거나 산 공지가 안 뜨면 안 된다. */
  let _skew = 0;                                   // (기기시각 - 서버시각)
  function serverNow() { return Date.now() - _skew; }
  function isExpired(n) {
    const end = Date.parse(n && n.endAt);
    return Number.isFinite(end) && end <= serverNow();
  }

  /* ── 「편집 중」 판정 ──────────────────────────────────────────────────────
   * hard  = 지금 모달을 띄우면 «입력이 날아간다». 무조건 기다린다.
   * soft  = 날아가진 않지만 «저장 전»이다. 저장을 먼저 시키고 띄운다(PLAN: 저장된 뒤에). */
  let _composing = false;         // 한글 조합 중(IME)
  let _pointerDown = false;       // 드래그·리사이즈 중
  d.addEventListener('compositionstart', () => { _composing = true; }, true);
  d.addEventListener('compositionend',   () => { _composing = false; }, true);
  d.addEventListener('pointerdown', () => { _pointerDown = true; }, true);
  d.addEventListener('pointerup',   () => { _pointerDown = false; }, true);
  d.addEventListener('pointercancel', () => { _pointerDown = false; }, true);

  function otherModalOpen() {
    // 이미 다른 모달이 떠 있으면 그 위에 또 덮지 않는다(둘 다 못 읽는 화면이 된다).
    return Array.from(d.querySelectorAll('.settings-modal-overlay')).some((el) => {
      if (el.id === 'notice-modal') return false;
      return getComputedStyle(el).display !== 'none';
    });
  }

  function busyReason() {
    const ae = d.activeElement;
    if (ae && (ae.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName))) return 'focus';
    if (_composing) return 'ime';
    if (_pointerDown) return 'pointer';
    if (otherModalOpen()) return 'modal';
    // ↓여기부터 soft. 입력이 날아가진 않는다.
    try { if (w.hasUnsavedChanges && w.hasUnsavedChanges()) return 'unsaved'; } catch (_) {}
    return '';
  }
  const HARD = ['focus', 'ime', 'pointer', 'modal'];

  /* ── 토스트 ───────────────────────────────────────────────────────────────
   * ★자리는 «위 가운데»(탭바 아래) 하나뿐이다. 기존 토스트도 같은 자리로 옮겼다
   *   (css/settings-modal.css · css/editor-toast.css). 자리가 두 벌이면 사용자가
   *   어디를 볼지 모른다.
   * ⛔왼쪽 띠(border-left) 없음(현빈). 강조는 「보기」 한 곳에만. */
  function showToast(n) {
    const el = d.createElement('div');
    el.className = 'settings-toast notice-toast';
    el.setAttribute('role', 'status');
    const txt = d.createElement('span');
    txt.className = 'notice-toast-text';
    txt.textContent = n.title ? `새 공지 · ${n.title}` : '새 공지가 있습니다';
    const link = d.createElement('button');
    link.type = 'button';
    link.className = 'notice-toast-link';
    link.textContent = '보기';
    el.appendChild(txt);
    el.appendChild(link);
    d.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));

    let done = false;
    const close = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      el.classList.remove('show');
      setTimeout(() => el.remove(), 220);
    };
    const timer = setTimeout(close, TOAST_MS);
    link.addEventListener('click', () => { close(); openModal(n, { dismissible: true }); });
    return close;
  }

  /* ── 모달 (settings-modal-* 재사용) ────────────────────────────────────── */
  let _openModalEl = null;

  function openModal(n, opts) {
    const dismissible = !!(opts && opts.dismissible);   // 긴급은 false — 「확인」해야 닫힌다
    if (_openModalEl) return;                            // 두 개를 겹쳐 띄우지 않는다

    const overlay = d.createElement('div');
    overlay.id = 'notice-modal';
    overlay.className = 'settings-modal-overlay';
    overlay.style.display = 'flex';
    overlay.innerHTML = `
      <div class="settings-modal-shell notice-modal-shell" role="dialog" aria-modal="true" aria-label="공지">
        <div class="settings-modal-header">
          <div class="settings-modal-title"></div>
          ${dismissible ? '<button class="settings-modal-close" data-act="close" title="닫기 (Esc)">×</button>' : ''}
        </div>
        <div class="notice-modal-body"></div>
        <div class="settings-modal-footer">
          <div style="flex:1"></div>
          <button class="settings-btn settings-btn-primary" data-act="ok">확인</button>
        </div>
      </div>`;
    // ★본문은 textContent 로만 넣는다 — 서버 글이 HTML 로 실행되면 안 된다.
    overlay.querySelector('.settings-modal-title').textContent = n.title || '공지';
    overlay.querySelector('.notice-modal-body').textContent = n.body || '';
    d.body.appendChild(overlay);
    _openModalEl = overlay;

    const finish = (ack) => {
      if (!_openModalEl) return;
      _openModalEl = null;
      d.removeEventListener('keydown', onKey, true);
      clearInterval(expiryTimer);
      overlay.remove();
      // 「확인」을 눌렀을 때만 읽음으로 적는다. 기간이 끝나 저절로 닫힌 건 읽은 게 아니다.
      if (ack) { try { api.notice.ack(n.id); } catch (_) {} }
    };

    overlay.addEventListener('click', (e) => {
      const act = e.target && e.target.getAttribute && e.target.getAttribute('data-act');
      if (act === 'ok') finish(true);
      else if (act === 'close') finish(false);
      else if (dismissible && e.target === overlay) finish(false);
    });
    const onKey = (e) => { if (dismissible && e.key === 'Escape') { e.stopPropagation(); finish(false); } };
    d.addEventListener('keydown', onKey, true);

    /* ★D-b: 떠 있는 동안 기간이 끝나면 조용히 닫는다(뜨다 만 상태를 만들지 않는다). */
    const expiryTimer = setInterval(() => { if (isExpired(n)) finish(false); }, 5000);

    setTimeout(() => { const b = overlay.querySelector('[data-act="ok"]'); if (b) b.focus(); }, 0);
  }

  /* ── 모달 대기열: 편집이 끝날 때까지 미룬다 ────────────────────────────────
   * ★이 체인은 «죽으면 안 된다».
   *   한 번 미룬 공지는 이 setTimeout 체인 하나에만 매달려 있다. 중간에 예외가 한 번 나면
   *   체인이 끊기고 공지는 «이번 실행 동안 영영» 안 뜬다 — 그런데 main 은 이미 「보여줬다」로
   *   세어 놓은 뒤다. 그래서 어느 갈래로 빠져도 «반드시» 다음 tick 을 다시 건다.
   *   (2026-09-02 검증 중 딱 한 번, 미룬 긴급 모달이 편집이 끝난 뒤에도 안 뜬 일이 있었다.
   *    두 번 재현을 시도했으나 재현되지 않았고 원인을 특정하지 못했다 ⇒ 원인을 못 찾은 채로
   *    두지 않고, «조용히 죽는 구조» 자체를 없앤다.)
   * ★그래도 무한정 매달리지 않는다: DEFER_MAX_MS 를 넘기면 포기한다. 포기해도 손해는 없다 —
   *   긴급 공지는 읽음 처리가 «확인» 버튼으로만 되므로 다음 실행에 다시 온다. */
  const DEFER_MAX_MS = 30 * 60 * 1000;

  function openModalWhenIdle(n, opts) {
    const until = Date.now() + DEFER_MAX_MS;
    let armed = false;
    const rearm = () => {
      if (armed) return;
      armed = true;
      setTimeout(() => { armed = false; tick(); }, RECHECK_MS);
    };
    // 대기가 끝나면(떴든 포기했든) 걸어둔 리스너를 거둔다 — 공지마다 쌓이면 새는 것이다.
    const stop = () => {
      d.removeEventListener('focusout', rearm, true);
      d.removeEventListener('pointerup', rearm, true);
    };
    const tick = async () => {
      try {
        if (isExpired(n)) { stop(); return; }         // 기다리는 사이 기간이 끝났다 → 안 띄운다
        if (Date.now() > until) { stop(); return; }   // 30분 넘게 손을 못 뗐다 → 다음 실행에 다시 온다
        if (_openModalEl) { rearm(); return; }        // 다른 공지가 떠 있다 → 그 뒤에
        const why = busyReason();
        if (why && HARD.includes(why)) { rearm(); return; }
        if (why === 'unsaved') {
          // ★「저장된 뒤에 띄워라」 — 앱 자신의 저장 경로를 쓴다(새로 만들지 않는다).
          try { if (w.flushSave) await w.flushSave(); } catch (_) {}
          if (busyReason()) { rearm(); return; }
        }
        stop();
        openModal(n, opts);
      } catch (e) {
        // ⛔여기서 끊기면 공지가 사라진다. 무슨 일이 있어도 다음 기회를 남긴다.
        console.warn(DEFER_LOG, '대기 중 오류 — 다시 시도합니다:', e && e.message);
        rearm();
      }
    };
    const why0 = busyReason();
    if (why0) console.log(`${DEFER_LOG} 편집 중이라 공지를 미룹니다 (${why0})`);
    // 편집이 끝나는 «순간»을 잡으면 대기가 짧아진다. 타이머는 그래도 남긴다(이벤트가 안 올 수도 있다).
    d.addEventListener('focusout', rearm, true);
    d.addEventListener('pointerup', rearm, true);
    tick();
  }

  /* ── 수신 ─────────────────────────────────────────────────────────────── */
  api.notice.onShow((n) => {
    if (!n || !n.id) return;
    const sn = Date.parse(n.serverNow);
    if (Number.isFinite(sn)) _skew = Date.now() - sn;
    if (isExpired(n)) return;
    if (n.level === 'urgent') openModalWhenIdle(n, { dismissible: false });
    else showToast(n);
  });

  // 화면이 준비됐다고 알린다 → main 이 «앱 시작 폴링»을 건다.
  const hello = () => { try { api.notice.hello(); } catch (_) {} };
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', hello, { once: true });
  else hello();

  // QA·디버그용 창구(사용자 화면엔 안 보인다).
  w.__notice = { busyReason, pollNow: () => api.notice.pollNow(), state: () => api.notice.state() };
})(window, document);
