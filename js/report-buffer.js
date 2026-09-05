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


  /* ── 리소스 URL 요약 ★M11: 「새는 것을 막되 재현 능력을 죽이지 않는다」 ────────
     [실측 2026-09-05] 고치기 «전»에 이 후킹이 담던 것 — 9/9 표본 전부 유출:
       img 로드 실패: http://127.0.0.1:9877/hang_%EB%A1%AF%EB%8D%B0_2026%EC%97%AC%EB%A6%84.png
       img 로드 실패: https://cdn.lotte.co.kr/2026summer/main_v3.jpg      ← ★호스트가 곧 «클라이언트 이름»
       img 로드 실패: goya-asset://proj_9k2/롯데_2026여름_메인.png
       img 로드 실패: ~/…/hero.png                                        ← 경로는 씻겼는데 «파일명»은 남는다
     ★적대검수가 지적한 파일명보다 «범위가 넓었다»:
       · data: URI 는 «이미지 바이트»가 1000자 상한까지 그대로 담겼다 — 파일명이 아니라 «내용»이다.
         (GIF 경로가 프레임을 dataURL 로 갈아끼우므로 data: img 는 실제로 존재한다)
       · 쿼리스트링의 서명·토큰(`?token=…&sig=…`)이 그대로 담겼다.
     ⚠️scrubPaths 로는 못 막는다 — 그 세척기는 «URL 을 일부러 안 건드린다»(③ 규칙이 앞 글자
       '/'·':' 를 보고 비껴간다). 그래서 여기서 «담기 전에» 줄인다(규약: 씻는 자리는 담을 때).

     남기는 것 / 버리는 것 — 판정 기준은 「없으면 재현이 안 되는가」:
       유지 · 태그(무엇이 깨졌나) · ★스킴(원인 유형의 1축: 에셋저장소 유실 / 사용자 디스크 / 원격)
             · 확장자(gif·svg 는 코드 경로가 다르다) · 짧은 해시(아래 dedupe 와 짝)
       ⛔버림 · 호스트 · 경로 · 파일명 · 쿼리(서명·토큰) · data: 페이로드 · 프로젝트 id
             (프로젝트 id 는 신고 payload.projectId 에 이미 있다 — 여기 또 넣을 이유가 없다)
     ⇒ 결과 꼴:  `img 로드 실패: goya-asset: .png #a3f19c`                              */
  function resHash(s) {
    // djb2. 암호용이 아니다 — «같은 URL 인가»만 가른다(dedupe 뒤 서로 다른 에셋을 구분하려고).
    var h = 5381;
    for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
    return ('00000000' + h.toString(16)).slice(-6);
  }
  function describeResUrl(raw) {
    var u = String(raw || '');
    if (!u) return '(주소 없음)';
    var m = u.match(/^([a-z][a-z0-9+.\-]{0,11}):/i);
    var scheme = m ? m[1].toLowerCase() + ':' : 'rel';
    var ext = '';
    if (scheme === 'data:') {
      // ⛔페이로드는 «절대» 안 본다. mime 서브타입만.
      var dm = u.match(/^data:([a-z0-9.+\-]+)\/([a-z0-9.+\-]+)/i);
      if (dm) ext = '.' + dm[2].toLowerCase();
    } else {
      var path = u.split('#')[0].split('?')[0];        // ★쿼리·프래그먼트를 «먼저» 버린다(서명·토큰)
      var em = path.match(/\.([A-Za-z0-9]{1,8})$/);
      if (em) ext = '.' + em[1].toLowerCase();
    }
    return scheme + (ext ? ' ' + ext : '') + ' #' + resHash(u);
  }
  /* 같은 줄이 «아직 링 안에» 있으면 다시 담지 않는다.
     ★근거: 내보내기 한 번에 같은 깨진 이미지가 «세 번» 온다 — 라이브 DOM · export 클론 · truth 클론이
       전부 document.body 에 붙기 때문이다(export-image.js prepareCloneForCapture 를 export 와
       truth 가 «같이» 쓴다). 20섹션에 깨진 에셋이 하나씩이면 정상 내보내기만으로 40칸을 먹고,
       그건 MAX_PER_RUN 예산 «밖»이라 남의 오류를 밀어낸다.
     ⚠️여기서 억누르는 건 «완전히 같은 요약 줄»뿐이다. 서로 다른 에셋은 해시가 달라 안 뭉친다 —
       해시를 남기는 이유가 바로 이것이다(해시를 빼면 서로 다른 두 에셋이 한 줄로 합쳐진다).
     ⛔resource 밖에는 적용하지 않는다 — 이 파일은 다른 기능도 쓰는 공용 파일이다. */
  function hasRecent(level, msg) {
    for (var i = 0; i < ring.length; i++) {
      if (ring[i].level === level && ring[i].msg === msg) return true;
    }
    return false;
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
      if (t && t.tagName) {
        var line = t.tagName.toLowerCase() + ' 로드 실패: ' + describeResUrl(t.src || t.href || '');
        // ★같은 줄이 «아직 링에 있으면» 다시 담지 않는다 — 아래 dedupe 주석 참조.
        if (!hasRecent('resource', line)) push('resource', line);
      }
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
