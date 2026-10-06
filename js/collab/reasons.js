/* ═══════════════════════════════════════════════════════════════════════════
   collab/reasons.js — 협업 실패 reason → «사용자가 다음에 뭘 할지 아는» 문장. 단일 원본.
   ───────────────────────────────────────────────────────────────────────────
   ★왜 한 벌인가 (2026-10-06, 지디 발주 TWO ⑴ S9)
     이 표가 «두 벌»이었다 — pages/projects.html collabReasonText(인라인 플레인)와
     js/settings/settings-modal.js reasonText(IIFE 클로저). 서로 다른 갈래를 갖고 있었고
     (server·bad_response·too_large 는 목록에만, already_member·self_invite·U6 는 설정에만),
     편집기(sync.js)는 «둘 다» 못 읽어서 실패를 아예 말하지 못했다.
   ⇒ 플레인 스크립트로 «두 화면 모두» 맨 앞에서 싣는다 — js/feature-flags.js 와 같은 까닭이다
      (모듈·클로저에 두면 목록 화면에서 undefined 가 된다 — 2026-09-02 COLLAB_ENABLED 가 실제로 그랬다).
   ⚠️새 화면이 협업 문장을 쓰면 이 파일을 «먼저» 걸어라. 회귀: tests/unit/collab-reasons-single.test.mjs ·
      tests/dom/collab-notify.dom.spec.js(공용 표를 무력화하면 소비자마다 빨강).

   ⛔모르는 reason 을 «알 수 없는 오류»로 뭉개지 않는다 — reason 문자열을 그대로 보여준다
      (빈칸이면 무슨 일인지조차 모른다 · 삼키는 코드 금지).
═══════════════════════════════════════════════════════════════════════════ */
(function (w) {
  /* 출처: 두 표의 합집합. 같은 키에 문장이 달랐던 둘은 «정보가 더 많은 쪽»을 골랐다(새로 짓지 않았다):
   *   offline      ← projects.html 판(「네트워크를 확인해 주세요」가 더 있다)
   *   not_a_member ← settings-modal.js 판(「이미 끊겼을 수 있습니다」가 더 있다)
   * ★이 판(발주 TWO ⒜)은 «합치기만» 한다 — 새 갈래는 다음 걸음(⒝ 문장 채우기)에서 «이 표에» 더한다. */
  const TEXT = {
    not_signed_in:   '로그인이 필요합니다.',
    invalid_session: '로그인이 만료됐습니다. 다시 로그인해 주세요.',
    offline:         '서버에 닿지 못했습니다. 네트워크를 확인해 주세요.',
    not_deployed:    '서버에 공동작업 기능이 아직 배포되지 않았습니다.',
    not_a_member:    '접근 권한이 없습니다(이미 끊겼을 수 있습니다).',
    too_large:       '섹션 하나가 너무 큽니다(이미지가 인라인으로 박혀 있습니다).',
    section_too_large: '섹션 하나가 너무 큽니다(이미지가 인라인으로 박혀 있습니다).',
    already_member:  '이미 참여 중인 사람입니다.',
    self_invite:     '자기 자신은 초대할 수 없습니다.',
    not_linked:      '이 프로젝트는 아직 원격으로 올리지 않았습니다.',
    // U6 — 서버가 아니라 «이 컴퓨터»에서 실패한 것들. 원인이 다르니 문장도 다르다.
    unavailable:        '이 화면에서는 로컬 프로젝트를 만들 수 없습니다(데스크탑 앱에서 열어 주세요).',
    no_project_factory: '앱 초기화가 끝나지 않았습니다. 잠시 후 다시 시도해 주세요.',
    id_collision:       '프로젝트 번호가 겹쳤습니다. 잠시 후 다시 시도해 주세요.',
    save_failed:        '로컬 프로젝트 파일을 만들지 못했습니다(디스크 권한·용량 확인).',
    ref_not_saved:      '연결 정보를 저장하지 못했습니다(디스크 권한·용량 확인).',
  };

  /** reason → 문장. status 가 있는 갈래(server·bad_response·모르는 4xx)는 숫자를 붙인다. */
  function text(reason, r) {
    const st = r && r.status;
    if (reason === 'server')       return `서버 오류(${st || '5xx'}) — 잠시 뒤 다시 시도해 주세요.`;
    if (reason === 'bad_response') return `서버가 알 수 없는 응답을 보냈습니다(${st || '?'}).`;
    if (Object.prototype.hasOwnProperty.call(TEXT, reason)) return TEXT[reason];
    if (!reason) return '알 수 없는 오류' + (st ? ` (${st})` : '');
    return String(reason) + (st ? ` (${st})` : '');   // ★모르는 값은 «그대로» — 뭉개지 않는다
  }

  /* ★이름이 소비자 함수와 «달라야» 한다 — pages/projects.html 의 인라인 `function collabReasonText`
   *   는 고전 스크립트 최상위라 window 에 붙는다. 같은 이름이면 그 위임 함수가 공용 표를 «덮어쓰고»
   *   자기 자신을 부른다(무한 재귀). 그래서 네임스페이스 하나로 낸다. */
  w.CollabReasons = Object.freeze({
    text,
    keys: () => Object.keys(TEXT),   // 검사용 — 표의 갈래를 «정의 자리»에서 센다
  });
})(window);
