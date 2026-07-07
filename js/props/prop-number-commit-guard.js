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
 *
 * 선례: js/editor.js 의 .prop-number document 위임(focusin 자동 select) 패턴.
 */

const PN_SEL = '.prop-number';
const isPn = (el) => el instanceof HTMLInputElement && el.matches?.(PN_SEL);

/** 타이핑 세션 시작 — 최초 편집 시점의 값을 Escape 복원용으로 보관 */
function beginTyping(el) {
  if (!el._pnTyping) { el._pnPrev = el.value; el._pnTyping = true; }
}

/** 유예 중인 타이핑 값을 즉시 커밋 — 합성 input(untrusted)으로 기존 clamp/apply 핸들러 실행 */
function commitTyping(el) {
  el._pnTyping = false;
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
    el.blur(); // 값 변경 시 네이티브 change 발화 → 아래 change 캡처에서 커밋
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

// ── change 캡처: blur/Enter 수렴 지점에서 커밋 ──────────────────────
document.addEventListener('change', (e) => {
  const el = e.target;
  if (!isPn(el) || !el._pnTyping) return;
  commitTyping(el); // 합성 input → 기존 핸들러가 clamp+apply+슬라이더 동기화+필드 재기록
  // change 자체는 그대로 전파 → 기존 pushHistory/scheduleAutoSave 동작 유지
}, true);

// ── 스피너 마우스클릭: 미커밋 타이핑 값에서 스텝하지 않도록 선커밋 ──
document.addEventListener('mousedown', (e) => {
  const el = e.target;
  if (!isPn(el) || !el._pnTyping) return;
  // webkit 인라인 스피너는 우측 끝 — 본문(caret 재배치) 클릭은 타이핑 유지
  if ((el.clientWidth - e.offsetX) <= 18) commitTyping(el);
}, true);

// ── 휠 스텝: 포커스 상태에서 휠 돌리면 타이핑 값 선커밋 후 스텝 ─────
document.addEventListener('wheel', (e) => {
  const el = e.target;
  if (isPn(el) && el._pnTyping && document.activeElement === el) commitTyping(el);
}, true);
