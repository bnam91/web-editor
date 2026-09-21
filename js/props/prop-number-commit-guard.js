/* prop-number-commit-guard.js
 * .prop-number 숫자 인풋 공통 — 타이핑 즉시 클램프 유예 가드 (2026-07-07)
 *
 * 문제: 각 프로퍼티 모듈의 'input' 리스너가 매 키스트로크마다 clamp+apply를 실행해
 *       860 → 86 → 8 로 지우는 순간 min(80)으로 강제 재기록되어 값 수정이 불가.
 * 해결: document 캡처 단계에서 "타이핑 유래" trusted input 이벤트만 유예하고,
 *       커밋 시점을 blur/Enter(네이티브 change)로 일원화. 기존 242개 모듈 핸들러 무수정.
 *
 * 동작 매트릭스:
 *   - 타이핑(문자/Backspace/Delete/붙여넣기/잘라내기) → input 유예 (기존 clamp/apply 미실행)
 *   - Enter → blur() → 네이티브 change → 합성 input 재발행(untrusted) → 기존 clamp/apply/동기화 실행
 *   - blur  → 동일 (change 캡처에서 커밋)
 *   - Escape → 타이핑 이전 값 복원, 커밋 없음 (change 미발화)
 *   - ArrowUp/Down 스텝 → _pnStep 마킹으로 즉시 통과 (즉시반영 유지)
 *   - 스피너 마우스클릭/휠 스텝 → 타이핑 세션이 아니면 자연 통과 (즉시반영 유지),
 *     타이핑 중이면 미커밋 값에서 스텝하지 않도록 선커밋
 *   - 프로그램 dispatch(goditor-api 등 untrusted) → 즉시 통과 (호환 유지)
 *   ★2026-09-21 «numfield» 로 더해진 줄 (자세한 근거는 바로 아래 머리말):
 *   - 빈 칸·무효값 + blur/Enter → «커밋 없음» + 이전 표시값 복원 (pushHistory/autosave 도 없음)
 *   - min/max 밖 + blur/Enter → 클램프한 값을 «칸에 되쓴 뒤» 커밋 (표시 = 실제)
 *   - 「0」 은 유한수라 빈 칸과 갈린다 — min≤0 이면 0 이 그대로 적용된다
 *   - Enter 커밋 뒤 포커스를 칸에 되돌린다 (BODY 로 두면 다음 Backspace 가 «블럭»을 지운다)
 *   - 회원 = input[type=number] 전부 + 예외 목록(PN_TEXT_SEL) — «클래스»로 세지 않는다
 *
 * 선례: js/editor.js 의 .prop-number document 위임(focusin 자동 select) 패턴.
 */

/* ★0920b «numfield» — 숫자칸 «규약»이 여기 한 자리에 있다 (2026-09-21)
 *
 * ★★값의 SSOT 는 «칸 자신의 min/max 속성»이다.
 *   ⛔규약을 패널 파일에 다시 적지 마라. 새 숫자칸을 만들 때 할 일은 «칸에 min=/max= 를 붙이는 것»
 *     하나다 — 클램프도, 빈값 처리도, 칸 되쓰기도 이 파일이 한다.
 *   ⛔상·하한을 바꾸고 싶으면 «그 칸의 속성»을 고쳐라. 핸들러 안의 Math.min/Math.max 를 고치면
 *     칸이 보이는 범위와 실제 범위가 다시 갈린다(아래 ①②가 정확히 그 사고였다).
 *
 * 왜 여기냐 — 2026-09-20 «사용자 관점 훑기»가 한 뿌리에서 세 얼굴을 잡았다:
 *   ① 커밋 때 클램프는 하는데 «칸에 안 되썼다» → 9999 를 넣으면 실제는 1000 인데 칸엔 9999.
 *      (실측 red: prop-gap.js 의 number 'input' 핸들러는 slider.value 만 고치고 number.value 는 안 고친다.
 *       같은 꼴이 prop-page·prop-text-wireup-*·prop-asset·prop-banner02·prop-step… 수십 곳)
 *   ② 빈 칸을 «0 또는 min» 으로 커밋했다 → 지우고 Enter = 값이 조용히 죽는다.
 *      (가장 센 자리: prop-sticker.js _bindTPair 는 `||` 폴백조차 없어 dataset 에 문자열 "NaN" 이
 *       «저장»되고, 그 NaN 을 number 칸이 거부해 칸이 빈 채 남았다 — 실측 red 로 확인)
 *   ③ 회원 판정이 «손으로 적은 클래스 목록»이라 새 칸을 못 따라갔다. 이 목록은 이미 한 번
 *      손으로 기워졌고(아래 grad-alpha 문단), 그때도 19칸이 밖에 남아 있었다.
 *
 * ⇒ 목록을 또 깁지 않는다. «타입»으로 세고, 규약을 커밋 깔때기 한 자리에서 강제한다.
 *
 * ★0920b «grad-alpha»(앞 라운드): 그라데이션 stop 의 투명도/위치 칸도 여기에 편입했다.
 *   둘은 .prop-number 를 «안» 달고 있어 가드 밖이었다 → prop-gradient.js 가 매 keystroke
 *   마다 커밋해, "100" 캐럿 중간 Backspace 1회("00")가 «즉시 0» 으로 확정되고(현빈 원문 11번)
 *   그 커밋이 리스트를 통째로 다시 그려 포커스가 BODY 로 날아갔다(다음 Backspace = 블럭 삭제).
 *   ★이제 .grad-stop-offset 은 «목록에서 빠져도» type="number" 라 계속 걸린다 — 그게 이 설계의 증명이다.
 *   .grad-stop-alpha 만 type="text" 라 예외 목록에 남는다. */

/** type=number 가 아닌데 숫자칸인 «예외»만 목록으로 남긴다. 여기에 줄을 더하기 전에
 *  먼저 물어라 — 그 칸을 type="number" 로 만들 수 없나? */
const PN_TEXT_SEL = '.grad-stop-alpha';
const isPn = (el) => el instanceof HTMLInputElement
  && (el.type === 'number' || el.matches?.(PN_TEXT_SEL));

/** 타이핑 세션 시작 — 최초 편집 시점의 값을 Escape 복원용으로 보관 */
function beginTyping(el) {
  if (!el._pnTyping) { el._pnPrev = el.value; el._pnTyping = true; }
}

/** 커밋 «직전» 정규화 — 값의 SSOT 는 칸의 min/max 속성이다.
 *  반환: 'empty'(값 없음 = 커밋하지 않는다) | 'clamped'(칸에 되썼다) | 'ok'
 *
 *  ⛔Number(el.min) 금지: 속성이 «없으면» '' → 0 이 되어, min 을 일부러 안 단 좌표칸
 *    (img-x/y, ss-pos-x/y, txt-x/y, lg-x/y …)이 전부 «음수 금지»가 된다 = 오버레이 위치가 죽는다.
 *    반드시 parseFloat + Number.isFinite 로 «속성이 있을 때만» 건다.
 *  ★type=number 칸에만 건다. .grad-stop-alpha(type=text)는 prop-gradient.js 의 _pct/_resync 가
 *    이미 같은 규약을 제 방식으로 지키고 있다(grad-stop-commit-wiring G3/G4) — 두 겹으로 재지 않는다. */
function normalizeBeforeCommit(el) {
  if (el.type !== 'number') return 'ok';
  const raw = String(el.value ?? '').trim();
  if (raw === '') return 'empty';          // number 칸은 '12e'·'-' 같은 무효입력도 '' 로 준다
  const n = Number(raw);
  if (!Number.isFinite(n)) return 'empty';
  const lo = parseFloat(el.min), hi = parseFloat(el.max);
  let c = n;
  if (Number.isFinite(lo) && c < lo) c = lo;
  if (Number.isFinite(hi) && c > hi) c = hi;
  if (c !== n) { el.value = String(c); return 'clamped'; }   // ★핸들러에 넘기기 «전»에 칸을 고친다
  return 'ok';
}

/** 값 없음 — 이전 «표시값»을 되돌린다(0 과 갈린다: '0' 은 유한수라 여기 안 온다). */
function restorePrev(el) {
  el._pnTyping = false;
  if (el._pnPrev != null) el.value = el._pnPrev;
}

/** 유예 중인 타이핑 값을 즉시 커밋 — 합성 input(untrusted)으로 기존 clamp/apply 핸들러 실행 */
function commitTyping(el) {
  el._pnTyping = false;
  if (normalizeBeforeCommit(el) === 'empty') { restorePrev(el); return; }
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

// ── keydown 캡처: 편집/커밋/취소/스텝 판별 ──────────────────────────
document.addEventListener('keydown', (e) => {
  const el = e.target;
  if (!isPn(el)) return;
  el._pnStep = false; // 직전 Arrow가 input 없이 끝난 경우(경계값) 잔류 플래그 정리

  if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
    el._pnStep = true; // 다음 trusted input 즉시 통과 = 스텝 즉시반영 유지
    return;
  }
  if (e.key === 'Enter') {
    /* 값 변경 시 네이티브 change 발화 → 아래 change 캡처에서 커밋.
     * ★blur 는 «커밋을 일으키는 수단»이지 「칸에서 나가라」는 뜻이 아니다. 그런데 부작용으로
     *   activeElement 가 BODY 가 되고, 블럭이 .selected 인 채라 이어지는 Backspace 가
     *   js/editor.js 의 「target 이 INPUT 이면 무시」 가드를 못 넘겨 «선택된 블럭을 지운다».
     *   0920b grad-alpha 라운드가 stop 두 칸에서 이 사고를 실제로 겪고 제 파일에서 고쳤고
     *   (prop-gradient.js _refocusAfterEnter), 거기 주석은 「.prop-number 전반에도 있지만
     *   앱 전체 관행이라 별도 카드」라고 적어 뒀다.
     * ⇒ 0921 numfield: 회원이 19칸 늘면서 그 칸들이 «오늘 없던» 이 길로 새로 들어온다
     *   (실앱 9522 줌40% 실측: chb-fontsize 에 40 치고 Enter → activeElement BODY →
     *    Backspace 한 번에 chat-block 이 지워졌다). 나빠지는 축을 두고 갈 수 없어
     *   «내가 뺏은 포커스만» 여기서 돌려준다 — 커밋이 끝난 «뒤», 아무도 안 가져갔을 때만.
     * ⛔el.focus() 를 조건 없이 부르지 마라: 커밋이 칸을 다시 그렸으면(그라데이션 목록 등)
     *   el 은 이미 DOM 밖이고, 그 경우는 제 패널의 복원 핸들러가 새 노드를 잡는다. */
    el.blur();
    if (el.isConnected && document.activeElement === document.body) {
      try {
        el.focus();
        // 캐럿은 «끝»으로 — 새로 잡은 칸의 기본 캐럿은 0 이라 이어지는 Backspace 가 헛돈다.
        // ⚠️type=number 는 setSelectionRange 가 InvalidStateError 를 던진다 → 따로 감싼다.
        try { const n = String(el.value ?? '').length; el.setSelectionRange(n, n); } catch (_) {}
      } catch (_) { /* 포커스를 못 잡아도 커밋은 이미 끝났다 */ }
    }
    return;
  }
  if (e.key === 'Escape') {
    if (el._pnTyping) {
      el.value = el._pnPrev ?? el.value; // 복원 → blur 시 change 미발화 = 커밋 없음
      el._pnTyping = false;
    }
    return;
  }
  const isEdit = (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey)
    || e.key === 'Backspace' || e.key === 'Delete';
  if (isEdit) beginTyping(el);
}, true);

// 붙여넣기/잘라내기도 타이핑 세션 취급 (즉시 클램프 방지)
document.addEventListener('paste', (e) => { if (isPn(e.target)) beginTyping(e.target); }, true);
document.addEventListener('cut',   (e) => { if (isPn(e.target)) beginTyping(e.target); }, true);

// ── input 캡처: 타이핑 유래 trusted input만 유예 ────────────────────
document.addEventListener('input', (e) => {
  const el = e.target;
  if (!isPn(el)) return;
  if (el._pnStep) { el._pnStep = false; el._pnTyping = false; return; } // 화살표 스텝 통과(=커밋)
  if (!e.isTrusted) { el._pnTyping = false; return; }                   // 프로그램 dispatch/합성 커밋 통과
  if (el._pnTyping) e.stopImmediatePropagation();                       // 타이핑 유예 — 기존 clamp/apply 미실행
  // 스피너 클릭·휠 스텝은 _pnTyping 미설정이라 자연 통과 (즉시반영 유지)
}, true);

// ── change 캡처: blur/Enter 수렴 지점에서 «규약 적용 후» 커밋 ───────
document.addEventListener('change', (e) => {
  const el = e.target;
  if (!isPn(el) || !el._pnTyping) return;
  if (normalizeBeforeCommit(el) === 'empty') {
    /* ★빈 칸 = «값 없음». 커밋 자체를 없앤다 — parseInt('') 가 핸들러에 도달하지 않으므로
       「지우고 Enter = 최소값 확정」도, sticker 의 dataset="NaN" 오염도 같이 죽는다.
       ⚠️stopImmediatePropagation 은 «이 갈래에서만» 부른다. 정상 입력에까지 걸면
         pushHistory/scheduleAutoSave 없이 값이 사라지는 «조용한 소실»(T-079)이 새로 난다. */
    restorePrev(el);
    e.stopImmediatePropagation();
    return;
  }
  commitTyping(el); // 합성 input → 기존 핸들러가 «클램프된» 값을 읽는다
  // change 자체는 그대로 전파 → 기존 pushHistory/scheduleAutoSave 동작 유지
}, true);

// ── 스피너 마우스클릭: 미커밋 타이핑 값에서 스텝하지 않도록 선커밋 ──
document.addEventListener('mousedown', (e) => {
  const el = e.target;
  if (!isPn(el) || !el._pnTyping) return;
  /* ★«스피너가 실제로 있는 칸»에만 태운다 (2026-09-20 통합 라운드에서 닫음).
       이 휴리스틱은 「webkit 인라인 스피너는 우측 18px」이라는 전제 위에 서 있다.
       그런데 0920b 에서 .grad-stop-alpha(type="text", width 34px)가 PN_SEL 에 편입되면서
       그 칸엔 «스피너가 아예 없는데» 우측 18px(칸의 절반 이상)이 스피너로 오판됐다 ⇒
         캐럿을 옮기려고 오른쪽을 누르면 즉시 커밋 → 리스트 재렌더 → 포커스 BODY →
         다음 Backspace 가 «블럭»을 지운다(이 라운드 QA medium, 현빈 원문 11번의 후반부와 같은 결).
       ⛔18 을 더 작은 수로 바꾸는 식으로 고치지 않는다 — 그러면 좁은 number 칸에서 진짜
         스피너를 놓친다. 전제가 「스피너가 있다」이므로 «그 전제»를 검사한다.
       (레포 실측 2026-09-21: .prop-number 를 단 input 214곳이 전부 type="number" — 나머지 2곳은
         <select> 라 HTMLInputElement 가드에서 이미 빠진다. 그쪽 동작은 한 픽셀도 안 바뀐다.) */
  if (el.type !== 'number') return;
  if ((el.clientWidth - e.offsetX) <= 18) commitTyping(el);
}, true);

// ── 휠 스텝: 포커스 상태에서 휠 돌리면 타이핑 값 선커밋 후 스텝 ─────
document.addEventListener('wheel', (e) => {
  const el = e.target;
  if (isPn(el) && el._pnTyping && document.activeElement === el) commitTyping(el);
}, true);
