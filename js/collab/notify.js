/* ═══════════════════════════════════════════════════════════════════════════
   collab/notify.js — 협업 동기화(sync.js)가 내는 사건을 듣는 «단 하나의» 자리.
   ───────────────────────────────────────────────────────────────────────────
   ★왜 있나 (2026-10-06, 지디 발주 TWO ⑴㉠)
     sync.js 는 실패를 emit 으로만 냈고(collabSync.onEvent) 그걸 듣는 쪽이 «0곳»이었다 —
     413(그 섹션은 영영 안 올라감)·resync(남의 변경 유실)·pull/push 실패가 전부 화면에 안 떴다.
   ⇒ 듣는 문을 «여기 하나»로 둔다. 새 emit 이 생기면 아래 CLASS 에 칸이 없어 검사가 빨개진다
      (tests/unit/collab-notify-classes.test.mjs — sync.js 의 emit type 집합 == CLASS 키 집합).

   ★⒜ 걸음(b94be0b0)은 듣고·분류·기록만 했다. ⒝ 걸음(2026-10-06)부터 speak 를 토스트로 «말한다».
     문장은 js/collab/reasons.js 한 벌에서만 온다 — 이 파일은 문장을 «짓지 않는다»(새 문장은 현빈 검수).

   ★「같은 실패를 2초마다 말하지 않는다」를 무엇으로 재나(지디 ④):
     _lastShown = { pull, push } — 채널마다 «마지막으로 말한 reason». 수명 = 이 페이지.
     말하는 조건 = `_lastShown[ch] !== reason`. 지우는 때 = 그 채널이 성공(pulled · pushed 오류 없음)했을 때와
     started · stopped(새 판이 시작/끝남). ⇒ 실패가 «바뀌거나», 한 번 회복한 뒤 «다시» 실패할 때만 뜬다.
     _onceShown(Set) — section_too_large(섹션마다) · patch_dropped(reason 마다)는 «세션당 1회».
   ★상태(status)는 토스트를 «안» 낸다 — 상단바 배지(#collab-topbar-badge)의 data-collab-state 에만 적는다
     (보이는 글자는 새 문장이라 현빈 검수 뒤 — 지금은 값만 남는다).

   분류(지디 판정 2026-10-06):
     speak   — 사용자에게 말한다(⒝ 에서 토스트). 같은 reason 은 상태가 바뀔 때만.
     status  — 상단바 «상태»로만. ⛔토스트 금지(2초 폴링에 정보 토스트를 달면 그게 새 결함이다).
     source  — 낸 자리(sync.js)가 이미 토스트로 말한다. 여기서 또 말하면 두 번 뜬다.
═══════════════════════════════════════════════════════════════════════════ */
(function () {
  const CLASS = Object.freeze({
    section_too_large: 'speak',    // A1 — 그 섹션은 공동작업본에 영영 안 올라간다 · 섹션마다 세션당 1회
    start_failed:      'speak',    // A5/A6/B1 — 동기화 시작 실패(예전엔 ok:true 를 냈다 = 거짓 성공)
    patch_dropped:     'speak',    // A7 — 없는 페이지로 온 변경을 버림(설계상 한계) · reason 마다 세션당 1회
    resync_required:   'speak',    // A4 — 서버가 패치를 정리함 = 남의 변경 유실 가능
    pull_error:        'speak',    // A3 — 받기 실패(2초마다) → 상태 전이 때만
    pushed:            'status',   // A2/A12 — error 가 있으면 speak 로 올린다(isFailure)
    pulled:            'status',   // A12
    started:           'status',   // A12
    stopped:           'status',   // A12
    seed_needs:        'status',   // A12
    seed_done:         'status',   // A12
    seed_repush:       'status',   // A12
    seed_giveup:       'source',   // sync.js:224 가 이미 토스트
    conflict_kept:     'speak',    // SIX ⓐ 묵은 원격 패치를 붙이지 않고 내 판을 지킴 → 알리고 «고르기» 칸
    conflict_replaced: 'speak',    // SIX 상대가 내 마지막 판을 못 보고 더 늦게 올림 → 붙이되 내 판을 «되살리기» 칸
    conflict_resolved: 'status',   // SIX 사용자가 골랐다 — 충돌 단추 다시 그림
    conflict:          'source',   // sync.js notifyConflict 가 이미 토스트
  });

  /** 그 사건이 «실패»인가 — 분류가 status 여도 실패를 담고 오면 말해야 한다. */
  function isFailure(evt) {
    if (!evt) return false;
    if (evt.type === 'pushed') return !!evt.error;
    return CLASS[evt.type] === 'speak';
  }

  /** 사건 → 문장(js/collab/reasons.js 한 벌을 읽는다 · 이 파일에 문장 표를 두지 않는다). */
  function textFor(evt) {
    if (!evt) return '';
    const reason = evt.reason || evt.error || evt.type;
    return window.CollabReasons.text(reason, evt.detail || evt);
  }

  const HEARD_MAX = 50;
  const _heard = [];
  const _shown = [];                      // 실제로 띄운 토스트 문구(검사용 · 최근 50)
  let _lastShown = { pull: null, push: null };
  let _onceShown = new Set();

  function toast(msg) {
    _shown.push(msg); if (_shown.length > HEARD_MAX) _shown.shift();
    if (typeof window.showToast === 'function') {
      try { window.showToast(msg); return; } catch (e) { console.error('[collab/notify] 토스트 실패:', e); }
    }
    console.warn('[collab]', msg);        // 토스트가 없는 화면 — 최소한 콘솔에는 «말한다»
  }

  /* ★상단바 상태(지디 C · 2026-10-06): 받기·시작이 실패하면 «⚠ 연결 끊김» 을 보인다 — S3(2초마다 조용히 실패하던 자리)의 핵심.
     지우는 것은 sync.js paintPresence 다: 다음 «성공한» 받기가 상단바를 다시 그린다(상대가 없으면 숨김). 그래서 여기선 «켜기»만 한다. */
  const LINK_DOWN = { pull_error: 1, start_failed: 1 };
  function setState(evt) {
    const el = document.getElementById('collab-topbar-badge');
    if (!el) return;                      // 조용한 까닭: 상단바가 없는 화면(목록 등) — 상태를 둘 자리가 없다
    el.dataset.collabState = evt.type + (isFailure(evt) ? ':' + (evt.reason || evt.error || '') : '');
    if (LINK_DOWN[evt.type] && window.CollabReasons) {
      el.textContent = window.CollabReasons.text('link_down');
      el.title = window.CollabReasons.text(evt.reason, evt);
      el.style.display = '';
    }
  }

  /* section_too_large 의 섹션 이름(지디 B ⑴): 「N번째 섹션」 — 지금 캔버스(#canvas)의 섹션 순서에서 센다.
     ★다른 페이지의 섹션은 DOM 에 없어 번호를 못 센다 → 그때만 id 를 그대로 보인다(지어내지 않는다). */
  function sectionLabel(sectionId) {
    try {
      const secs = [...(document.getElementById('canvas')?.querySelectorAll(':scope .section-block') || [])];
      const i = secs.findIndex(s => s.id === sectionId);
      if (i >= 0) return `${i + 1}번째 섹션`;
    } catch (e) { console.debug('[collab/notify] 섹션 번호 세기 실패 — id 로 보인다:', e); }
    return String(sectionId || '');
  }

  function speakOnce(key, msg) {
    if (_onceShown.has(key)) return;
    _onceShown.add(key);
    toast(msg);
  }
  function speakOnChange(ch, reason, msg) {
    if (_lastShown[ch] === reason) return;
    _lastShown[ch] = reason;
    toast(msg);
  }

  function onEvent(evt) {
    const cls = (evt && CLASS[evt.type]) || 'unclassified';
    _heard.push({ type: evt && evt.type, cls, failure: isFailure(evt), at: Date.now() });
    if (_heard.length > HEARD_MAX) _heard.shift();
    /* ⛔분류에 없는 type 은 «조용히 버리지» 않는다 — 콘솔에라도 남긴다(검사가 빨개지기 전 실행 중 신호). */
    if (cls === 'unclassified') { console.error('[collab/notify] 분류 없는 사건:', evt && evt.type); return; }
    setState(evt);
    const R = window.CollabReasons;
    switch (evt.type) {
      case 'started': case 'stopped':
        _lastShown = { pull: null, push: null };
        return;
      case 'pulled':
        _lastShown.pull = null;
        return;
      case 'pushed':
        if (!evt.error) { _lastShown.push = null; return; }
        /* too_large 는 section_too_large 사건이 섹션 이름까지 말한다 — 여기서 또 말하면 두 번 뜬다. */
        if (evt.error === 'too_large' || evt.error === 'section_too_large') return;
        speakOnChange('push', evt.error, R.text(evt.error, evt));
        return;
      case 'pull_error':
        speakOnChange('pull', evt.reason, R.text(evt.reason, evt));
        return;
      case 'section_too_large':
        speakOnce('too_large:' + evt.sectionId, `${R.text('too_large', evt.detail)} · ${sectionLabel(evt.sectionId)} — ${R.text('section_not_synced')}`);
        return;
      case 'resync_required':
        toast(R.text('resync_required', evt));
        return;
      case 'start_failed':
        toast(R.text('start_failed') + ' — ' + R.text(evt.reason, evt));
        return;
      case 'patch_dropped':
        speakOnce('dropped:' + evt.reason, R.text(evt.reason, evt));
        return;
      case 'conflict_kept': case 'conflict_replaced':
        toast(`${R.text(evt.type)} · ${sectionLabel(evt.sectionId)}`);
        if (window.CollabConflictUI) { try { window.CollabConflictUI.render(); } catch (e) { console.error('[collab/notify] 충돌 단추 그리기 실패:', e); } }
        return;
      case 'conflict_resolved':
        if (window.CollabConflictUI) { try { window.CollabConflictUI.render(); } catch (e) { console.error('[collab/notify] 충돌 단추 그리기 실패:', e); } }
        return;
      default:
        return;   // status·source — 상태만 적었다(위 setState) / 낸 자리가 이미 말했다
    }
  }

  let _unsub = null;
  function attach() {
    const cs = window.collabSync;
    if (!cs || typeof cs.onEvent !== 'function') {
      /* sync.js 가 없으면(다른 화면) 들을 게 없다 — 조용한 까닭: 협업 루프 자체가 없는 화면이다. */
      return false;
    }
    if (_unsub) return true;
    _unsub = cs.onEvent(onEvent);
    return true;
  }
  attach();   // ★sync.js «뒤»에 실린다(index.html) — 그 시점엔 window.collabSync 가 이미 있다

  window.collabNotify = Object.freeze({
    CLASS, isFailure, textFor, sectionLabel,
    attached: () => !!_unsub,
    heard: () => _heard.slice(),
    shown: () => _shown.slice(),
    lastShown: () => ({ ..._lastShown }),
  });
})();
