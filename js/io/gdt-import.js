/* gdt-import.js — 「파일 → 프로젝트 불러오기」 렌더러 측 (GDT-SPEC §7)
 *
 * 편집기(index.html)와 프로젝트 목록(pages/projects.html) 양쪽에서 쓴다.
 * 그래서 «classic script»다 — 목록 페이지는 모듈 스크립트를 안 쓴다. 중복 구현을 피하려는 것.
 */
'use strict';

(function () {
  const API = () => window.electronAPI;

  /* ── 폰트 존재 판정 ──
   * §7은 `document.fonts.check('16px <이름>')`을 지정한다. 그대로 부르되, 그것만으로는
   * 판정이 서지 않아 폭 측정을 함께 본다. 근거(Electron 41 실측, 4종 동시 측정):
   *
   *   폰트                     실제      check() 로드전  check() 로드후  폭측정
   *   @font-face 정상(번들)     있음      false          true          있음
   *   @font-face 파일없음       깨짐      false          false         없음
   *   미설치 시스템 폰트         없음      ★true          ★true         없음
   *   설치된 시스템 폰트(A2Z)    있음      true           true          있음
   *
   * ⇒ ★`check()`는 시스템 폰트에 «true만» 돌려준다(없는 폰트도 true) — 그것만 쓰면 경고가
   *   영원히 안 뜬다. 반대로 @font-face(번들 Pretendard)는 로드 «전»에 false라, 그것만 쓰면
   *   §9의 「Pretendard 거짓 경보 0건」이 깨진다. 두 신호가 서로의 사각을 정확히 덮는다.
   *   폭 측정은 기준 폰트 monospace·serif «둘»을 쓴다 — AppleGothic이 mono=true/serif=false로
   *   갈려서 한쪽만 보면 설치된 폰트를 「없음」으로 오판한다(실측).
   */
  const NOT_A_FONT = new Set([
    'sans-serif', 'serif', 'monospace', 'cursive', 'fantasy', 'system-ui',
    '-apple-system', 'blinkmacsystemfont', 'inherit', 'initial', 'unset',
  ]);

  function _appliesByWidth(family) {
    try {
      const ctx = document.createElement('canvas').getContext('2d');
      const probe = '가나다라마바사아자차ABCDEFGHIJ0123456789';
      const fam = String(family).replace(/["\\]/g, '');
      for (const base of ['monospace', 'serif']) {
        ctx.font = `48px ${base}`;
        const baseW = ctx.measureText(probe).width;
        ctx.font = `48px "${fam}", ${base}`;
        if (Math.abs(ctx.measureText(probe).width - baseW) > 0.5) return true;
      }
      return false;
    } catch (_) { return null; }   // 판정 불가
  }

  function isFontAvailable(family) {
    if (NOT_A_FONT.has(String(family).toLowerCase())) return true;   // 폰트가 아니다 — 경고 대상 아님
    let checked = null;
    try { checked = document.fonts.check(`16px "${String(family).replace(/["\\]/g, '')}"`); } catch (_) {}
    const byWidth = _appliesByWidth(family);
    if (byWidth === null) return checked === null ? null : checked;  // 폭 측정 불가 → check()에 맡긴다
    // check()가 명시적으로 false면 @font-face가 «깨진» 경우다 — 그건 믿는다.
    if (checked === false && byWidth === false) return false;
    return byWidth;
  }

  function missingFonts(list) {
    const unknown = [];
    const missing = [];
    for (const f of list || []) {
      const r = isFontAvailable(f);
      if (r === null) unknown.push(f);
      else if (!r) missing.push(f);
    }
    return { missing, unknown };
  }

  let _busy = false;

  async function gdtImportFlow(opts = {}) {
    const api = API();
    if (!api?.gdtImport) { window.showToast?.('⚠️ 불러오기는 데스크톱 앱에서만 됩니다'); return null; }
    if (_busy) { window.showToast?.('⏳ 불러오기가 이미 진행 중입니다'); return null; }
    _busy = true;
    try {
      window.showProjectLoadingOverlay?.();
      const setText = (m) => { const el = document.querySelector('#proj-loading-overlay .proj-loading-text'); if (el) el.textContent = m; };
      setText('검사 중…');

      const result = await api.gdtImport({ filePath: opts.filePath });
      window.__gdtLastImport = result;      // 완료 훅(§8) — 외부 자동화용

      if (result?.canceled) return null;
      if (!result?.ok) {
        // ★손상 파일은 거부한다. 부분 복원이 없으므로 목록에 아무것도 안 생긴다.
        window.showToast?.(`⚠️ 불러오기 실패: ${result?.error || '알 수 없는 오류'}`);
        return result;
      }

      // ★폰트 경고는 «열 때» 알린다(§7)
      const { missing, unknown } = missingFonts(result.fonts);
      let msg = `✅ 불러옴 — ${result.name} · 이미지 ${result.images}장`;
      if (missing.length) msg += ` · ⚠️ 이 기기에 없는 폰트: ${missing.join(', ')}`;
      else if (unknown.length) msg += ` · 폰트 확인 불가: ${unknown.join(', ')}`;
      window.showToast?.(msg);

      if (typeof opts.onDone === 'function') await opts.onDone(result);
      return result;
    } finally {
      _busy = false;
      window.hideProjectLoadingOverlay?.();
    }
  }

  window.gdtImportFlow = gdtImportFlow;
  window.gdtMissingFonts = missingFonts;

  // 메뉴 배선 — 페이지가 onDone을 미리 등록해두면 그걸 쓴다(목록 페이지=renderGrid).
  API()?.onGdtMenuImport?.(() => {
    gdtImportFlow({ onDone: window.__gdtOnImported });
  });
})();
