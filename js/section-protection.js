// section-protection.js — 섹션 보호 시스템 (자동 cleanup hook)
//
// 저장:
//   - .section-block.dataset.protected       = "true" (보호됨) | (없음/기타값 = 미보호)
//   - .section-block.dataset.protectedReason = "<자유텍스트>" | "auto-detected from memo"
//   - canvas.innerHTML 기반 직렬화이므로 save-load.js 별도 작업 불필요 (HTML attr 자동 직렬화)
//
// 노출 API:
//   - window.setSectionProtected(sectionId, on, reason?) → {ok, sectionId, protected, reason}
//   - window.getSectionProtected(sectionId)              → {ok, sectionId, protected, reason}
//   - window.isSectionProtected(secOrId)                 → boolean (동기 hook용)
//   - window.toggleSectionProtectionPopover(btn)         — toolbar 🔒 클릭 핸들러
//   - window.SectionProtection.filterDeletable(arr)      — hook 헬퍼: {keep, skipped, names}
//   - window._ensureProtectionButton(sec)
//   - window._hydrateAllSectionsForProtection()
//
// UI:
//   - section-toolbar 두 번째 자식으로 🔒 버튼 주입 (📝 메모 다음)
//   - protected=true 일 때만 표시 (visibility:visible) — false면 hidden + 사용자가 우클릭/팝오버로만 켤 수 있게는 아직 안 함.
//     → 정책: 항상 버튼 표시, 미보호면 회색 / 보호면 골드. 클릭 popover에서 toggle.
//
// 마이그레이션:
//   - dataset.memo 첫 줄 trim 안에 "삭제하지말것" 포함 시 자동 protected=true + reason="auto-detected from memo"
//   - 이미 protected=true 인 섹션은 reason 덮어쓰지 않음 (사용자 입력 보존)
//
// 이 파일은 plain global script (ES module X) — 다른 모듈 의존성 없음.

(function () {
  'use strict';

  const MAX_REASON_LEN = 500;
  const AUTO_REASON   = 'auto-detected from memo';
  const AUTO_TRIGGER  = '삭제하지말것';

  function _findSection(sectionId) {
    if (!sectionId || typeof sectionId !== 'string') return null;
    const sec = document.getElementById(sectionId);
    if (!sec || !sec.classList || !sec.classList.contains('section-block')) return null;
    return sec;
  }

  function _isProtectedEl(sec) {
    return !!(sec && sec.dataset && sec.dataset.protected === 'true');
  }

  /**
   * isSectionProtected — 동기 boolean hook.
   * @param {Element|string} secOrId
   * @returns {boolean}
   */
  function isSectionProtected(secOrId) {
    if (!secOrId) return false;
    if (typeof secOrId === 'string') {
      const sec = _findSection(secOrId);
      return _isProtectedEl(sec);
    }
    if (secOrId.nodeType === 1) return _isProtectedEl(secOrId);
    return false;
  }

  /**
   * setSectionProtected — 섹션 보호 플래그 갱신.
   * @param {string} sectionId
   * @param {boolean} on
   * @param {string} [reason]
   * @returns {{ok:boolean, sectionId?:string, protected?:boolean, reason?:string, code?:string, message?:string}}
   */
  function setSectionProtected(sectionId, on, reason) {
    const sec = _findSection(sectionId);
    if (!sec) return { ok: false, code: 'NOT_FOUND', message: 'section not found: ' + sectionId };
    const flag = !!on;
    if (flag) {
      sec.dataset.protected = 'true';
      if (reason != null) {
        const r = String(reason);
        const clipped = [...r].slice(0, MAX_REASON_LEN).join('');
        if (clipped) sec.dataset.protectedReason = clipped;
        else delete sec.dataset.protectedReason;
      }
    } else {
      delete sec.dataset.protected;
      delete sec.dataset.protectedReason;
    }
    // toolbar 버튼 상태 동기화
    _refreshProtectionButton(sec);
    if (typeof window.scheduleAutoSave === 'function') {
      window.scheduleAutoSave();
    } else if (typeof window.triggerAutoSave === 'function') {
      window.triggerAutoSave();
    }
    return {
      ok: true,
      sectionId,
      protected: flag,
      reason: flag ? (sec.dataset.protectedReason || '') : '',
    };
  }

  /**
   * getSectionProtected
   * @param {string} sectionId
   */
  function getSectionProtected(sectionId) {
    const sec = _findSection(sectionId);
    if (!sec) return { ok: false, code: 'NOT_FOUND', message: 'section not found: ' + sectionId };
    return {
      ok: true,
      sectionId,
      protected: _isProtectedEl(sec),
      reason: sec.dataset.protectedReason || '',
    };
  }

  // ── auto-cleanup hook 헬퍼 ─────────────────────────────────────────────────
  // 사용 예:
  //   const { keep, skipped, names } = window.SectionProtection.filterDeletable([...sels]);
  //   if (skipped) window.SectionProtection.warnSkipped(skipped, names);
  function filterDeletable(sections) {
    const arr = Array.isArray(sections) ? sections : Array.from(sections || []);
    const keep = [];
    const protectedOnes = [];
    for (const s of arr) {
      if (!s || s.nodeType !== 1) continue;
      if (_isProtectedEl(s)) protectedOnes.push(s);
      else keep.push(s);
    }
    const names = protectedOnes.map(s => s.dataset.name || s.id || 'section');
    return { keep, skipped: protectedOnes.length, names, protected: protectedOnes };
  }

  function warnSkipped(count, names) {
    if (!count) return;
    const list = (names && names.length) ? names.slice(0, 3).join(', ') + (names.length > 3 ? ` 외 ${names.length - 3}` : '') : '';
    const msg = `🔒 보호된 섹션 ${count}개 건너뜀${list ? ' (' + list + ')' : ''}`;
    if (typeof window.showToast === 'function') {
      try { window.showToast(msg, 'warn'); return; } catch (_) {}
    }
    if (typeof window.toast === 'function') {
      try { window.toast(msg); return; } catch (_) {}
    }
    console.warn('[section-protection]', msg);
  }

  // ── 마이그레이션: memo → protected 자동 감지 ─────────────────────────────
  function _autoDetectFromMemo(sec) {
    if (!sec || _isProtectedEl(sec)) return false; // 이미 보호된 건 덮어쓰지 않음
    const memo = sec.dataset && sec.dataset.memo;
    if (!memo) return false;
    // 첫 줄만 검사 (trim + 포함 매칭)
    const firstLine = String(memo).split(/\r?\n/, 1)[0].trim();
    if (!firstLine) return false;
    if (firstLine.indexOf(AUTO_TRIGGER) === -1) return false;
    sec.dataset.protected = 'true';
    if (!sec.dataset.protectedReason) {
      sec.dataset.protectedReason = AUTO_REASON;
    }
    return true;
  }

  function _autoDetectAll() {
    let n = 0;
    document.querySelectorAll('.section-block').forEach(sec => {
      if (_autoDetectFromMemo(sec)) {
        _refreshProtectionButton(sec);
        n++;
      }
    });
    if (n > 0) {
      console.log(`[section-protection] auto-detected ${n} protected section(s) from memo`);
    }
    return n;
  }

  // ── 🔒 toolbar 버튼 ────────────────────────────────────────────────────────
  function _refreshProtectionButton(sec) {
    if (!sec) return;
    const btn = sec.querySelector(':scope > .section-toolbar > .st-protected-btn');
    if (!btn) return;
    const on = _isProtectedEl(sec);
    btn.classList.toggle('is-on', on);
    btn.title = on
      ? `보호됨${sec.dataset.protectedReason ? ' — ' + sec.dataset.protectedReason : ''}`
      : '섹션 보호 (잠금)';
    btn.textContent = on ? '🔒' : '🔓';
  }

  function _ensureProtectionButton(sec) {
    if (!sec) return;
    const tb = sec.querySelector(':scope > .section-toolbar');
    if (!tb) return;
    let btn = tb.querySelector(':scope > .st-protected-btn');
    if (!btn) {
      btn = document.createElement('button');
      btn.className = 'st-btn st-protected-btn';
      btn.type = 'button';
      btn.textContent = '🔓';
      btn.title = '섹션 보호 (잠금)';
      btn.setAttribute('onclick', 'window.toggleSectionProtectionPopover(this)');
    }
    // 위치: 📝 메모 버튼 다음 (두 번째 자리). memo가 없으면 첫 자리.
    const memoBtn = tb.querySelector(':scope > .st-memo-btn');
    if (memoBtn) {
      if (memoBtn.nextSibling !== btn) {
        tb.insertBefore(btn, memoBtn.nextSibling);
      }
    } else {
      if (tb.firstChild !== btn) tb.insertBefore(btn, tb.firstChild);
    }
    _refreshProtectionButton(sec);
  }

  function _hydrateAllSectionsForProtection() {
    document.querySelectorAll('.section-block').forEach(_ensureProtectionButton);
  }

  // ── 🔒 popover (사유 표시 + on/off 토글 + reason 편집) ─────────────────────
  let _activePop = null;
  window.toggleSectionProtectionPopover = function toggleSectionProtectionPopover(btn) {
    if (!btn) return;
    const sec = btn.closest('.section-block');
    if (!sec) return;
    if (_activePop) {
      const prev = _activePop;
      _activePop = null;
      const wasSame = prev._anchor === sec;
      (prev._backdrop || prev).remove();
      if (wasSame) return;
    }
    const isOn = _isProtectedEl(sec);
    const reason = sec.dataset.protectedReason || '';

    const pop = document.createElement('div');
    pop._anchor = sec;
    pop.className = 'section-protect-popover';
    pop.innerHTML = `
      <div class="spp-head">
        <span class="spp-title">🔒 ${_escapeHtml(sec.dataset.name || sec.id)}</span>
        <button class="spp-close" type="button" title="닫기 (Esc)">✕</button>
      </div>
      <div class="spp-row">
        <label class="spp-toggle">
          <input type="checkbox" class="spp-on" ${isOn ? 'checked' : ''}/>
          <span>보호하기 (삭제 / 일괄 정리 차단)</span>
        </label>
      </div>
      <div class="spp-row">
        <label class="spp-reason-label">사유 (선택)</label>
        <textarea class="spp-reason" rows="3" maxlength="${MAX_REASON_LEN}" placeholder="예: 클라이언트 승인 완료 — 수정 금지"></textarea>
      </div>
      <div class="spp-foot">
        <span class="spp-count">0 / ${MAX_REASON_LEN}</span>
        <span class="spp-status"></span>
      </div>
    `;
    const cbOn   = pop.querySelector('.spp-on');
    const ta     = pop.querySelector('.spp-reason');
    const count  = pop.querySelector('.spp-count');
    const status = pop.querySelector('.spp-status');
    ta.value = reason;
    const refreshCount = () => { count.textContent = `${[...ta.value].length} / ${MAX_REASON_LEN}`; };
    refreshCount();

    const commit = () => {
      const on = !!cbOn.checked;
      const r = setSectionProtected(sec.id, on, ta.value);
      status.textContent = r.ok ? '저장됨' : ('오류: ' + r.code);
      setTimeout(() => { status.textContent = ''; }, 1500);
    };
    let saveTimer = null;
    cbOn.addEventListener('change', commit);
    ta.addEventListener('input', () => {
      refreshCount();
      clearTimeout(saveTimer);
      saveTimer = setTimeout(commit, 500);
    });
    ta.addEventListener('blur', () => { clearTimeout(saveTimer); commit(); });

    const backdrop = document.createElement('div');
    backdrop.className = 'section-protect-backdrop';
    backdrop.appendChild(pop);
    document.body.appendChild(backdrop);
    pop._backdrop = backdrop;

    const closeModal = () => {
      clearTimeout(saveTimer); commit();
      document.removeEventListener('keydown', onKey, true);
      backdrop.classList.remove('open');
      setTimeout(() => { backdrop.remove(); }, 220);
      if (_activePop === pop) _activePop = null;
    };
    pop.querySelector('.spp-close').addEventListener('click', (e) => {
      e.stopPropagation();
      closeModal();
    });
    pop.addEventListener('mousedown', e => e.stopPropagation());
    backdrop.addEventListener('mousedown', (e) => {
      if (e.target === backdrop) closeModal();
    });
    const onKey = (ev) => { if (ev.key === 'Escape') { ev.stopPropagation(); closeModal(); } };
    document.addEventListener('keydown', onKey, true);

    _activePop = pop;
    requestAnimationFrame(() => backdrop.classList.add('open'));
    setTimeout(() => {
      if (cbOn.checked) {
        ta.focus();
        ta.setSelectionRange(ta.value.length, ta.value.length);
      } else {
        cbOn.focus();
      }
    }, 60);
  };

  function _escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ── 외부 노출 ───────────────────────────────────────────────────────────────
  window.setSectionProtected            = setSectionProtected;
  window.getSectionProtected            = getSectionProtected;
  window.isSectionProtected             = isSectionProtected;
  window._ensureProtectionButton        = _ensureProtectionButton;
  window._hydrateAllSectionsForProtection = _hydrateAllSectionsForProtection;
  window.SectionProtection = {
    isProtected: isSectionProtected,
    set: setSectionProtected,
    get: getSectionProtected,
    filterDeletable,
    warnSkipped,
    autoDetectAll: _autoDetectAll,
    AUTO_TRIGGER,
    AUTO_REASON,
    MAX_REASON_LEN,
  };

  // ── 초기화: hydrate + auto-detect ──────────────────────────────────────────
  function _init() {
    _hydrateAllSectionsForProtection();
    _autoDetectAll();
    // 늦게 로드되는 섹션 대응 (memo와 동일 타이밍)
    setTimeout(() => {
      _hydrateAllSectionsForProtection();
      _autoDetectAll();
    }, 1500);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _init);
  } else {
    _init();
  }
})();
