/* ═══════════════════════════════════════════════════════════════════════════
   collab/notify.js — 협업 동기화(sync.js)가 내는 사건을 듣는 «단 하나의» 자리.
   ───────────────────────────────────────────────────────────────────────────
   ★왜 있나 (2026-10-06, 지디 발주 TWO ⑴㉠)
     sync.js 는 실패를 emit 으로만 냈고(collabSync.onEvent) 그걸 듣는 쪽이 «0곳»이었다 —
     413(그 섹션은 영영 안 올라감)·resync(남의 변경 유실)·pull/push 실패가 전부 화면에 안 떴다.
   ⇒ 듣는 문을 «여기 하나»로 둔다. 새 emit 이 생기면 아래 CLASS 에 칸이 없어 검사가 빨개진다
      (tests/unit/collab-notify-classes.test.mjs — sync.js 의 emit type 집합 == CLASS 키 집합).

   ★이 판(⒜ 걸음)은 «배선만» 한다 — 듣고, 분류하고, 기록한다. 화면에 띄우는 건 다음 걸음(⒝).
     그래서 지금은 사용자 화면이 «하나도» 안 바뀐다(문장을 채우기 전에 구조부터 — 지디 판정).

   분류(지디 판정 2026-10-06):
     speak   — 사용자에게 말한다(⒝ 에서 토스트). 같은 reason 은 상태가 바뀔 때만.
     status  — 상단바 «상태»로만. ⛔토스트 금지(2초 폴링에 정보 토스트를 달면 그게 새 결함이다).
     source  — 낸 자리(sync.js)가 이미 토스트로 말한다. 여기서 또 말하면 두 번 뜬다.
═══════════════════════════════════════════════════════════════════════════ */
(function () {
  const CLASS = Object.freeze({
    section_too_large: 'speak',    // A1 — 그 섹션은 공동작업본에 영영 안 올라간다
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
  function onEvent(evt) {
    const cls = (evt && CLASS[evt.type]) || 'unclassified';
    _heard.push({ type: evt && evt.type, cls, failure: isFailure(evt), at: Date.now() });
    if (_heard.length > HEARD_MAX) _heard.shift();
    /* ⛔분류에 없는 type 은 «조용히 버리지» 않는다 — 콘솔에라도 남긴다(검사가 빨개지기 전 실행 중 신호). */
    if (cls === 'unclassified') console.error('[collab/notify] 분류 없는 사건:', evt && evt.type);
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
    CLASS, isFailure, textFor,
    attached: () => !!_unsub,
    heard: () => _heard.slice(),
  });
})();
