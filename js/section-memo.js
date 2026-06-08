// section-memo.js — 섹션별 메모 시스템 (P/G/E + Codex 리뷰)
//
// 저장: .section-block 의 dataset.memo (HTML data-memo="..." 속성)
//   - save-load.js serializeProject()는 canvas.innerHTML을 그대로 직렬화 → 자동 영속
//   - dataset.memo 는 XSS 안전한 attribute 저장 — innerHTML 재삽입 시도 시에도 안전
// 노출:
//   - window.setSectionMemo(sectionId, memo) → { ok, sectionId, length }
//   - window.getSectionMemo(sectionId)       → { ok, sectionId, memo }
// 사용:
//   - PM MCP 도구 set_section_memo / get_section_memo (main.js bridge 경유)
//   - prop-section.js 의 memo textarea (DOM 직접 dataset 갱신 → 여기 호출 안 함)
//
// 제약:
//   - 메모는 string. 최대 2000자 (UTF-8 code points 기준).
//   - 빈 문자열을 주면 dataset.memo 제거 (DOM 노이즈 최소화).
//
// 이 파일은 plain global script (ES module X) — 다른 모듈 의존성 없음.

(function () {
  'use strict';

  const MAX_MEMO_LEN = 2000;

  function _findSection(sectionId) {
    if (!sectionId || typeof sectionId !== 'string') return null;
    const sec = document.getElementById(sectionId);
    if (!sec || !sec.classList || !sec.classList.contains('section-block')) return null;
    return sec;
  }

  /**
   * setSectionMemo — 섹션의 dataset.memo를 갱신.
   * @param {string} sectionId — sec_xxx
   * @param {string} memo      — 메모 본문. 빈 문자열이면 dataset.memo 제거.
   * @returns {{ok:boolean, sectionId?:string, length?:number, code?:string, message?:string}}
   */
  function setSectionMemo(sectionId, memo) {
    const sec = _findSection(sectionId);
    if (!sec) return { ok: false, code: 'NOT_FOUND', message: 'section not found: ' + sectionId };
    const text = memo == null ? '' : String(memo);
    const len = [...text].length;
    if (len > MAX_MEMO_LEN) {
      return { ok: false, code: 'TOO_LONG', message: `memo too long (${len} > ${MAX_MEMO_LEN})` };
    }
    if (text === '') {
      delete sec.dataset.memo;
    } else {
      sec.dataset.memo = text;
    }
    // 자동저장 + 히스토리 — 둘 다 noop 폴백 (스킬 격리 환경에서도 안전)
    if (typeof window.scheduleAutoSave === 'function') {
      window.scheduleAutoSave();
    } else if (typeof window.triggerAutoSave === 'function') {
      window.triggerAutoSave();
    }
    return { ok: true, sectionId, length: len };
  }

  /**
   * getSectionMemo — 섹션의 dataset.memo를 읽음.
   * @param {string} sectionId
   * @returns {{ok:boolean, sectionId?:string, memo?:string, code?:string, message?:string}}
   */
  function getSectionMemo(sectionId) {
    const sec = _findSection(sectionId);
    if (!sec) return { ok: false, code: 'NOT_FOUND', message: 'section not found: ' + sectionId };
    return { ok: true, sectionId, memo: sec.dataset.memo || '' };
  }

  /**
   * appendSectionMemoLine — 기존 메모 끝에 한 줄을 append (구분: 줄바꿈).
   *   sourceScratchIds 같은 자동 기록용 헬퍼. PM이 직접 호출 X — addSection 안에서 사용.
   * @param {Element} sec     — 섹션 element
   * @param {string} line     — 추가할 한 줄
   * @returns {number}        — append 후 총 길이 (코드포인트)
   */
  function appendSectionMemoLine(sec, line) {
    if (!sec || !line) return 0;
    const cur = sec.dataset.memo || '';
    const next = cur ? `${cur}\n${line}` : line;
    const clipped = [...next].slice(0, MAX_MEMO_LEN).join('');
    sec.dataset.memo = clipped;
    return [...clipped].length;
  }

  // ── 외부 노출 ───────────────────────────────────────────────────────────────
  window.setSectionMemo        = setSectionMemo;
  window.getSectionMemo        = getSectionMemo;
  window.appendSectionMemoLine = appendSectionMemoLine;
  window.SECTION_MEMO_MAX_LEN  = MAX_MEMO_LEN;

  // ── section-toolbar 메모 버튼 popover 토글 (UI) ────────────────────────────
  let _activePop = null;
  window.toggleSectionMemoPopover = function toggleSectionMemoPopover(btn) {
    if (!btn) return;
    const sec = btn.closest('.section-block');
    if (!sec) return;
    if (_activePop) {
      _activePop.remove();
      const prev = _activePop;
      _activePop = null;
      if (prev._anchor === sec) return; // 같은 섹션 토글 = 닫기만
    }
    const memo = sec.dataset.memo || '';
    const pop = document.createElement('div');
    pop._anchor = sec;
    pop.className = 'section-memo-popover';
    pop.innerHTML = `
      <div class="smp-head">
        <span class="smp-title">📝 메모 — ${sec.dataset.name || sec.id}</span>
        <button class="smp-close" type="button" title="닫기">✕</button>
      </div>
      <textarea class="smp-textarea" rows="8" maxlength="${MAX_MEMO_LEN}" placeholder="섹션 메모 (출처, 의도, 디자인 노트 등)..."></textarea>
      <div class="smp-foot">
        <span class="smp-count">0 / ${MAX_MEMO_LEN}</span>
        <span class="smp-status"></span>
      </div>
    `;
    const ta = pop.querySelector('.smp-textarea');
    const count = pop.querySelector('.smp-count');
    const status = pop.querySelector('.smp-status');
    ta.value = memo;
    const refreshCount = () => { count.textContent = `${[...ta.value].length} / ${MAX_MEMO_LEN}`; };
    refreshCount();
    let saveTimer = null;
    const commit = () => {
      const v = ta.value;
      if (v === memo && !sec.dataset.memo === !v) return;
      const r = setSectionMemo(sec.id, v);
      status.textContent = r.ok ? '저장됨' : ('오류: ' + r.code);
      setTimeout(() => { status.textContent = ''; }, 1500);
    };
    ta.addEventListener('input', () => {
      refreshCount();
      clearTimeout(saveTimer);
      saveTimer = setTimeout(commit, 500);
    });
    ta.addEventListener('blur', () => { clearTimeout(saveTimer); commit(); });
    pop.querySelector('.smp-close').addEventListener('click', (e) => {
      e.stopPropagation();
      clearTimeout(saveTimer);
      commit();
      pop.remove();
      _activePop = null;
    });
    pop.addEventListener('click', e => e.stopPropagation());

    // popover를 section-toolbar 다음에 attach
    const toolbar = sec.querySelector('.section-toolbar');
    if (toolbar) toolbar.insertAdjacentElement('afterend', pop);
    else sec.appendChild(pop);
    _activePop = pop;
    ta.focus();
    ta.setSelectionRange(ta.value.length, ta.value.length);
    // 다른 곳 클릭 시 닫기
    setTimeout(() => {
      const closer = (ev) => {
        if (!pop.contains(ev.target)) {
          clearTimeout(saveTimer); commit();
          pop.remove();
          if (_activePop === pop) _activePop = null;
          document.removeEventListener('mousedown', closer, true);
        }
      };
      document.addEventListener('mousedown', closer, true);
    }, 0);
  };
})();
