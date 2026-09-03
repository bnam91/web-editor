/* ═══════════════════════════════════════════════════════════════════════════
   report-buffer.js — «최근 오류 링버퍼». 신고 기능의 심장.
   ───────────────────────────────────────────────────────────────────────────
   ★왜 이게 먼저인가 (PLAN §2⑴)
     사람은 「안 돼요」라고 쓴다. 재현에 필요한 건 버전·OS·«직전 오류»다. 그런데
     신고 버튼을 누르는 시점엔 오류가 «이미 지나갔다». 앱이 켜져 있는 내내 담아두지
     않으면 신고는 껍데기가 된다. ⇒ 이 파일은 «맨 앞»에서 로드된다(feature-flags 다음).

   ★★씻는 자리는 «담을 때»다 — «보낼 때»가 아니다 (PLAN §7⑵)
     console.error('[ScratchPad] copy failed:', err) 처럼 Error 객체를 그대로 넘기는
     자리가 실제로 있다. Error.stack 에는 /Users/<실명>/... 이 들어간다.
     담아두고 «안 보내도» 메모리에 남는다 ⇒ 들어오는 순간 씻는다.
     (서버도 한 번 더 씻지만, 그건 구버전 앱을 위한 그물이지 우리 몫이 아니다.)

   ⚠️후킹이 기존 로깅을 «깨면 안 된다»
     · console.error 는 원본을 «반드시» 그대로 호출한다(반환값까지).
     · window.onerror 를 «대입»하지 않는다 — addEventListener 로 얹는다.
       대입하면 나중에 누가 window.onerror = ... 를 하면 조용히 지워지고,
       우리가 남의 핸들러를 지울 수도 있다.
     · push 안에서 절대 console.error 를 부르지 않는다(무한재귀). 재진입 가드도 둔다.
═══════════════════════════════════════════════════════════════════════════ */
(function (w) {
  'use strict';
  if (w.ReportBuffer) return;                 // 두 번 로드돼도 후킹은 한 번만

  var MAX     = 20;      // 서버 LIMITS.ERRORS 와 «같은 수». 다르면 조용히 잘린다.
  var MAX_LEN = 1000;    // 서버 LIMITS.ERROR_LEN 과 같음
  var ring    = [];
  var reentry = false;   // push 내부에서 다시 push 로 들어오는 것을 막는다

  /* ── 세척 ────────────────────────────────────────────────────────────────
     ① 홈 경로 → ~        (여기서 «사용자 이름»이 사라진다 — 이게 본체다)
     ② ~ 로 시작하는 긴 경로 → ~/…/파일명
     ③ 남은 절대경로 → 파일명만
     ⛔ URL(https://host/a/b)은 건드리지 않는다 — 앞 글자가 '/' 나 ':' 면 경로로 안 본다. */
  function scrubPaths(s) {
    var out = String(s);
    // file:///Users/... → /Users/...  (URL 껍데기를 벗겨야 아래 규칙이 닿는다)
    out = out.replace(/\bfile:\/\/\/?/g, '/');
    // ★공백이 든 이름을 «먼저» 잡는다. 아래 규칙은 [^/\s…]+ 라 공백에서 멈춰
    //   /Users/kim minjae/… 가 「~ minjae/…」 로 «성만» 지워졌다(2026-09-02 지디 검수).
    //   다음 «/» 까지를 한 칸으로 본다 — 뒤에 슬래시가 있어야 매칭돼 폭주하지 않는다.
    out = out.replace(/\/Users\/[^/\n'")\];:,]{1,64}?(?=\/)/g, '~');
    out = out.replace(/\/home\/[^/\n'")\];:,]{1,64}?(?=\/)/g, '~');
    // 윈도우도 같다 — 다음 «\\» 까지를 한 칸으로 본다.
    out = out.replace(/[A-Za-z]:\\Users\\[^\\\n'")\];:,]{1,64}?(?=\\)/g, '~');
    // ① 홈
    out = out.replace(/\/Users\/[^/\s'")\];:,]+/g, '~');
    out = out.replace(/\/home\/[^/\s'")\];:,]+/g, '~');
    out = out.replace(/[A-Za-z]:\\Users\\[^\\\s'")\];:,]+/g, '~');
    // ② ~ 뒤의 경로
    out = out.replace(/~(?:[/\\][^\s'"`)\];:,]+)+/g, function (m) {
      var base = m.split(/[/\\]/).pop();
      return base ? '~/…/' + base : '~';
    });
    // ③ 남은 절대경로(두 단 이상) → 파일명만
    out = out.replace(/(?:\/[^\s'"`)\];:,/]+){2,}/g, function (m, off, full) {
      var prev = off > 0 ? full.charAt(off - 1) : '';
      if (prev === '/' || prev === ':' || /[A-Za-z0-9._~-]/.test(prev)) return m; // URL·이미 처리된 ~경로
      var base = m.split('/').pop();
      return base ? '…/' + base : m;
    });
    return out;
  }

  /** 인자 하나를 «사람이 읽을 수 있는 한 줄»로. Error 는 stack 까지 가져온다(그게 값어치다). */
  function fmtArg(a) {
    try {
      if (a === null) return 'null';
      if (a === undefined) return 'undefined';
      if (typeof a === 'string') return a;
      if (a instanceof Error) return (a.name || 'Error') + ': ' + (a.message || '') + (a.stack ? '\n' + a.stack : '');
      if (typeof a === 'object') {
        // Error 유사객체(구조화 복제로 넘어온 것 등)
        if (a.message && a.stack) return String(a.message) + '\n' + String(a.stack);
        var j = JSON.stringify(a);
        return j === undefined ? Object.prototype.toString.call(a) : j;
      }
      return String(a);
    } catch (_) {
      return '[unserializable]';
    }
  }

  /** 링버퍼에 한 줄 담기. ⛔여기서 console.* 를 부르지 마라. */
  function push(level, rawMsg) {
    if (reentry) return;
    reentry = true;
    try {
      var msg = scrubPaths(rawMsg);
      if (!msg) return;
      if (msg.length > MAX_LEN) msg = msg.slice(0, MAX_LEN - 1) + '…';
      ring.push({ at: new Date().toISOString(), level: String(level).slice(0, 20), msg: msg });
      if (ring.length > MAX) ring.splice(0, ring.length - MAX);   // 오래된 것부터
    } catch (_) {
      /* 버퍼가 죽어도 앱은 살아야 한다 */
    } finally {
      reentry = false;
    }
  }

  /* ── 후킹 ①: console.error ─────────────────────────────────────────────── */
  var origError = w.console && w.console.error;
  if (typeof origError === 'function') {
    w.console.error = function () {
      var args = Array.prototype.slice.call(arguments);
      try { push('console.error', args.map(fmtArg).join(' ')); } catch (_) {}
      // ★원본을 «그대로» — 반환값까지 넘긴다. 기존 로깅은 아무것도 달라지지 않는다.
      return origError.apply(w.console, arguments);
    };
    w.console.error.__reportBufferWrapped = true;   // 양성대조에서 후킹 여부를 «측정»할 수 있게
  }

  /* ── 후킹 ②: 잡히지 않은 오류 ───────────────────────────────────────────
     ⛔window.onerror = ... 는 쓰지 않는다(남의 핸들러를 덮고, 남이 우릴 덮는다). */
  w.addEventListener('error', function (ev) {
    try {
      if (ev && ev.error) { push('onerror', fmtArg(ev.error)); return; }
      if (ev && ev.message) {
        push('onerror', ev.message + (ev.filename ? ' @' + ev.filename + ':' + (ev.lineno || 0) : ''));
        return;
      }
      // 리소스 로드 실패(<img>·<script>)는 target 에만 정보가 있다
      var t = ev && ev.target;
      if (t && t.tagName) push('resource', t.tagName.toLowerCase() + ' 로드 실패: ' + (t.src || t.href || ''));
    } catch (_) {}
  }, true);   // capture — 중간에서 stopPropagation 해도 우린 본다

  /* ── 후킹 ③: 처리 안 된 Promise 거부 ─────────────────────────────────── */
  w.addEventListener('unhandledrejection', function (ev) {
    try { push('unhandledrejection', fmtArg(ev && ev.reason)); } catch (_) {}
  }, true);

  /* ── 공개 API ──────────────────────────────────────────────────────────── */
  w.ReportBuffer = {
    /** 최근 것이 뒤. 복사본을 준다(밖에서 밀어넣지 못하게). */
    list: function () { return ring.slice(); },
    size: function () { return ring.length; },
    max: MAX,
    clear: function () { ring.length = 0; },
    /** 앱 안에서 «잡아서 처리한» 오류도 남기고 싶을 때 부른다. */
    note: function (msg) { push('app', fmtArg(msg)); },
    /** 세척기 단독 노출 — 테스트·검증에서 이걸 직접 잰다. */
    scrubPaths: scrubPaths,
  };
})(window);
