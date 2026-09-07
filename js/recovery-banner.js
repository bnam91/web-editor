/* ══════════════════════════════════════════════════════════════════════════
   recovery-banner.js — 「지난 실행에서 무슨 일이 있었나」 판정·문구. (H3, 2026-09-06)
   ──────────────────────────────────────────────────────────────────────────
   ★규율은 js/entitlement-banner.js 와 «같다» — electron·DOM 의존 0. 메인이 계산한 값을
     «옮겨 적기»만 한다. 여기서 파일을 읽거나 무엇을 보낼지 «다시 정하지» 않는다
     (판정이 두 벌이 되면 갈라진다 — 이 프로젝트에서 실제로 난 사고다).

   ★★모달이 아니다. 지난 실행의 사고는 «지금» 급한 일이 아니다.
     사용자가 하려던 걸 먼저 하게 두고, 「되찾을 수 있다」는 사실만 눈에 띄게 둔다.
     ⇒ 반환값에 강제 확인·차단 같은 개념이 «아예 없다». 문구와 「할 수 있는 것」뿐이다.

   ★★실패 방향(지디 확정)
       괜찮다 : 우리 실수로 「불필요한 안내를 봤다」
       안 된다: 「복구할 수 있었는데 못 했다」 · 「모르게 내용이 나갔다」
     ⇒ 애매하면 «띄우는» 쪽으로 가고(안내), «안 보내는» 쪽으로 간다(전송).

   ★outgoingText() 가 이 파일의 핵심이다 — 「진단 정보가 포함됩니다」 같은 뭉뚱그린 문장은
     금지다. 나갈 «줄 그대로»를 사용자가 볼 수 있어야 한다. 이 함수가 그 줄을 만든다.
═══════════════════════════════════════════════════════════════════════════ */
(function (root, factory) {
  var mod = factory();
  if (typeof module === 'object' && module && module.exports) module.exports = mod;
  if (typeof root !== 'undefined' && root) root.RecoveryBanner = mod;
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  /* 서버 LIMITS 와 같은 수(js/report-buffer.js·main/recovery/index.js 와 한 벌). */
  var MAX_ERRORS = 20;
  var MAX_ERR_LEN = 1000;

  /**
   * 배너를 띄울까 · 뭐라고 쓸까.
   * @param {{items:Array, counts:object}|null} pending  main 의 recovery:pending 반환값 그대로
   * @returns {{show:boolean, headline:string, sub:string, restorable:number}|null}
   */
  function decide(pending) {
    if (!pending || !Array.isArray(pending.items) || !pending.items.length) return null;
    var c = pending.counts || {};
    var saves = Number(c.saveFailures || 0);
    var crashes = Number(c.crashes || 0);
    var restorable = Number(c.restorable || 0);

    var headline, sub;
    if (saves > 0) {
      /* ★「저장하지 못했다」와 「확인하지 못했다」를 여기서 다시 가르지 않는다 —
         H4 가 이미 reason 으로 갈라 뒀고, 자세히 패널이 그 사유를 그대로 보여준다.
         배너 한 줄은 «되찾을 수 있다»는 사실만 말한다. */
      var first = firstSaveFailure(pending.items);
      var who = (first && first.projectName) ? '「' + first.projectName + '」' : '작업 내용';
      headline = '지난 종료 때 ' + who + '의 저장이 끝나지 않았습니다.';
      sub = restorable > 0
        ? '비상 사본이 있습니다 — 사본으로 되살릴 수 있습니다.'
        : '비상 사본은 남지 않았습니다. 자세한 내용을 확인하세요.';
      if (crashes > 0) sub += ' (예기치 않은 종료 기록 ' + crashes + '건도 있습니다)';
    } else {
      headline = '지난 실행이 예기치 않게 종료됐습니다' + (crashes > 1 ? ' (' + crashes + '건)' : '') + '.';
      sub = '무엇이 있었는지 확인하고, 원인을 보내주실 수 있습니다.';
    }
    return { show: true, headline: headline, sub: sub, restorable: restorable };
  }

  function firstSaveFailure(items) {
    for (var i = 0; i < items.length; i++) if (items[i] && items[i].kind === 'save-failure') return items[i];
    return null;
  }

  /* ── 한 항목을 사람 말로 (자세히 패널의 한 줄) ─────────────────────────── */
  function itemTitle(it) {
    if (!it) return '';
    if (it.kind === 'save-failure') {
      return it.projectName ? ('「' + it.projectName + '」 저장 실패') : '저장 실패';
    }
    if (it.unreadable) return '읽을 수 없는 크래시 기록';
    return it.label || '예기치 않은 종료';
  }

  function itemDetail(it) {
    if (!it) return '';
    var parts = [];
    if (it.at) parts.push(localTime(it.at));
    if (it.kind === 'save-failure') {
      if (it.reason) parts.push('사유: ' + it.reason);
      if (it.error) parts.push('원인: ' + it.error);
      if (it.emergencyExists) parts.push('비상 사본 ' + kb(it.emergencyBytes));
      else if (it.emergencyError) parts.push('비상 사본 없음(' + it.emergencyError + ')');
    } else {
      if (it.crashKind) parts.push(it.crashKind);
      if (it.reason) parts.push('사유: ' + it.reason);
      if (it.exitCode != null) parts.push('종료코드 ' + it.exitCode);
      if (it.errorLines && it.errorLines.length) parts.push('직전 오류 ' + it.errorLines.length + '줄');
    }
    return parts.join(' · ');
  }

  function kb(bytes) {
    var n = Number(bytes);
    if (!isFinite(n) || n <= 0) return '';
    return n < 1024 ? (n + 'B') : (Math.round(n / 1024) + 'KB');
  }

  function localTime(iso) {
    try {
      var d = new Date(iso);
      if (isNaN(d.getTime())) return String(iso);
      var p = function (x) { return String(x).padStart(2, '0'); };
      return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) +
             ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
    } catch (_) { return String(iso); }
  }

  /* ── ★「무엇이 나가는지」 — 뭉뚱그리지 않는다 ────────────────────────────
     나갈 줄을 «그대로» 한 덩어리 문자열로 만든다. 화면은 이걸 <pre> 에 그대로 넣는다.
     ⛔여기서 요약하거나 «…» 로 줄이지 않는다 — 줄이는 순간 사용자가 본 것과 나간 것이 달라진다. */
  function outgoingText(lines) {
    var ls = lines || [];
    if (!ls.length) return '(보낼 줄이 없습니다)';
    return ls.map(function (e) {
      return '[' + (e.level || '') + '] ' + (e.at || '') + '\n' + (e.msg || '');
    }).join('\n\n');
  }

  /**
   * 신고 payload 의 errors[] 에 복구 줄을 «싣는다».
   * ★E3(authDiag)과 «같은 통로»다 — 최상위 새 필드는 서버가 조용히 버린다(지디 실측).
   *   그래서 errors[] 여야 도달한다. 같은 함정을 다시 밟지 않는다.
   * ★넘칠 때는 «가장 오래된» 것부터 밀어낸다 — 방금 만든 복구 줄이 밀려 사라지면
   *   신고 자체가 무의미해진다(report-modal.js mergeAuthDiag 와 같은 규율).
   */
  function mergeRecoveryLines(errors, lines, maxErrors, maxLen) {
    var ME = maxErrors || MAX_ERRORS;
    var ML = maxLen || MAX_ERR_LEN;
    var add = (lines || []).slice(0, ME).map(function (e) {
      return {
        at: String((e && e.at) || new Date().toISOString()),
        level: String((e && e.level) || 'crash'),
        msg: String((e && e.msg) == null ? '' : e.msg).slice(0, ML),
      };
    });
    var errs = (errors || []).slice();
    var room = ME - add.length;
    if (room < 0) room = 0;
    if (errs.length > room) errs = errs.slice(errs.length - room);   // ★오래된 것부터 밀어낸다
    return errs.concat(add);
  }

  return {
    MAX_ERRORS: MAX_ERRORS,
    MAX_ERR_LEN: MAX_ERR_LEN,
    decide: decide,
    itemTitle: itemTitle,
    itemDetail: itemDetail,
    outgoingText: outgoingText,
    mergeRecoveryLines: mergeRecoveryLines,
    localTime: localTime,
  };
});
