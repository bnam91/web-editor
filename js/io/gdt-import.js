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

  /* ── 거부 코드 → 사용자 문구 ──
   * ★`importGdt`는 throw하지 않고 `{ok:false, code}`를 «반환»한다. 호출부가 ok를 안 보면
   *   「거부됐는데 성공한 줄 아는」 버그가 난다. 그리고 코드를 그대로 띄우면 안 된다 —
   *   `sha256_mismatch`는 사용자에게 아무 뜻이 없다.
   */
  const REJECT_MESSAGE = {
    // ★「못 찾음」을 「손상」과 구분한다 — 뭉뚱그리면 멀쩡한 파일을 사용자가 의심한다.
    file_not_found:             '파일을 찾을 수 없습니다. 외장·네트워크 드라이브면 연결을 확인해 주세요.',
    zip_open_failed:            '이 파일은 GODITOR 프로젝트 파일이 아니거나 손상됐습니다.',
    zip_read_failed:            '파일을 읽는 중 오류가 났습니다. 파일이 손상된 것 같습니다.',
    manifest_missing:           'GODITOR 프로젝트 파일이 아닙니다.',
    project_json_missing:       '프로젝트 내용이 없습니다. 파일이 손상됐습니다.',
    project_json_unparsable:    '프로젝트 내용이 손상돼 읽을 수 없습니다.',
    format_version_future:      '더 새로운 버전의 GODITOR에서 만든 파일입니다. 앱을 업데이트해 주세요.',
    referenced_image_missing:   '이미지가 빠져 있습니다. 파일이 손상됐습니다.',
    manifest_image_missing:     '이미지가 빠져 있습니다. 파일이 손상됐습니다.',
    base64_left_in_project_json:'파일 형식이 올바르지 않습니다.',
    sha256_mismatch:            '파일이 손상됐습니다(이미지가 전송 중 깨진 것 같습니다).',
    image_decode_failed:        '이미지를 열 수 없습니다. 파일이 손상됐습니다.',
    verify_exception:           '파일을 검사하는 중 오류가 났습니다.',
    import_failed:              '불러오기에 실패했습니다.',
    // ★입력 상한(§11) — 「손상」이 아니라 「너무 크다·이상하다」로 구분해 알린다.
    //   정상 프로젝트로는 이 값에 닿지 않는다(실측 최대의 9~90배로 잡았다).
    too_many_entries:           '파일 구성이 비정상적으로 많습니다. 신뢰할 수 있는 파일인지 확인해 주세요.',
    too_many_images:            '이미지가 비정상적으로 많습니다. 신뢰할 수 있는 파일인지 확인해 주세요.',
    too_many_references:        '파일 내부 참조가 비정상적으로 많습니다. 신뢰할 수 있는 파일인지 확인해 주세요.',
    reference_count_mismatch:   '파일 내부 구조가 맞지 않습니다. 손상됐거나 정상적으로 만들어진 파일이 아닙니다.',
    unexpected_entry:           '파일에 예상치 못한 내용이 들어 있습니다. 신뢰할 수 있는 파일인지 확인해 주세요.',
    entry_too_large:            '파일 안의 항목 하나가 너무 큽니다. 신뢰할 수 있는 파일인지 확인해 주세요.',
    archive_too_large:          '압축을 풀면 너무 커집니다. 신뢰할 수 있는 파일인지 확인해 주세요.',
    output_too_large:           '복원 결과가 너무 커져 중단했습니다. 신뢰할 수 있는 파일인지 확인해 주세요.',
    timeout:                    '시간이 너무 오래 걸려 중단했습니다.',
  };
  function rejectMessage(result) {
    const base = REJECT_MESSAGE[result?.code] || '불러올 수 없는 파일입니다.';
    return `${base} 기존 프로젝트는 그대로입니다.`;   // 부분 복원이 없다는 걸 사용자에게 알린다
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
      // ★반드시 ok를 본다 — 거부는 예외가 아니라 «반환값»으로 온다.
      if (!result?.ok) {
        console.warn('[gdt] 불러오기 거부:', result?.code, result?.error);   // 원인 코드는 로그로
        window.showToast?.(`⚠️ ${rejectMessage(result)}`);                    // 사용자에겐 번역해서
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
  window.gdtRejectMessage = rejectMessage;

  // 메뉴 배선 — 페이지가 onDone을 미리 등록해두면 그걸 쓴다(목록 페이지=renderGrid).
  API()?.onGdtMenuImport?.(() => {
    gdtImportFlow({ onDone: window.__gdtOnImported });
  });

  /* ── 파일 연결(.gdt 더블클릭) ──
   * 켜진 상태 = main이 push. 꺼진 상태(콜드 스타트) = 렌더러가 준비된 뒤 «가져간다».
   * ★pull이 필요한 이유: 콜드 스타트에선 경로가 창보다 «먼저» 도착해서 push는 유실된다.
   */
  API()?.onGdtOpenFile?.((filePath) => {
    if (filePath) gdtImportFlow({ filePath, onDone: window.__gdtOnImported });
  });
  (async () => {
    try {
      const pending = await API()?.gdtTakePendingOpen?.();
      if (pending) gdtImportFlow({ filePath: pending, onDone: window.__gdtOnImported });
    } catch (_) { /* 미지원 환경 */ }
  })();
})();
