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
    const _toggled = flag !== _isProtectedEl(sec);   // 사유만 고칠 때는 히스토리 칸을 안 만든다
    if (_toggled) window.ensureHistoryCheckpoint?.('보호 전');
    if (flag) {
      sec.dataset.protected = 'true';
      if (reason != null) {
        const r = String(reason);
        const clipped = [...r].slice(0, MAX_REASON_LEN).join('');
        if (clipped) sec.dataset.protectedReason = clipped;
        else delete sec.dataset.protectedReason;
      }
    } else {
      // 메모가 자동 잠금 글이면 «사람이 풀었다»를 남긴다 — 안 남기면 다시 열 때 _autoDetectFromMemo 가 또 잠근다
      if (String(sec.dataset.memo || '').includes(AUTO_TRIGGER)) sec.dataset.protected = 'false';
      else delete sec.dataset.protected;
      delete sec.dataset.protectedReason;
    }
    /* toolbar 버튼 상태 동기화 — ★«없으면 만들고» 나서 맞춘다(2026-09-22 실측).
       ⛔_refreshProtectionButton 은 `if (!btn) return;` 으로 시작한다. 그래서 단추가 아직
         없는 섹션에서는 이 줄이 «아무 일도 안 했다». 단추를 심는 _hydrateAllSectionsForProtection
         은 init 과 +1500ms «두 번»뿐이고 그 뒤 재부착 경로가 없다 ⇒ 그 창이 지난 뒤
         «작업 중에 만든 섹션»은 보호를 켜도 화면에 표시가 하나도 안 떴다(실측: 툴바
         [ab, memo, ai-fill] 그대로, 단추 0개. 저장→재열기해야 붙었다).
       ★보호 자체는 dataset 에 살아 멀쩡했다(삭제 가드 js/editor.js:2995·3078·3131 이
         window.isSectionProtected 로 그 dataset 을 읽는다 — 실측으로 «안 지워짐» 확인).
         사라지는 건 «표시»와 «끄는 입구»다: 보호를 끄는 UI 는 이 단추의 onclick 하나뿐이고,
         차단 토스트(editor.js:3085)는 「🔒 버튼으로 보호 해제 후 삭제하세요」라고 «없는 버튼»을
         가리킨다. */
    _ensureProtectionButton(sec);
    if (_toggled) {
      // 🔒 도 ⌘Z 한 칸이다 — 되돌리기가 보호를 바꾸면 말로 알린다(되돌리기 단추에 동작 이름이 안 보인다)
      const _say = (lockedNow) => () => window.showToast?.(lockedNow ? '🔒 되돌리기로 보호가 다시 켜졌습니다' : '🔓 되돌리기로 보호가 풀렸습니다');
      window.pushHistory?.(flag ? '섹션 보호' : '섹션 보호 해제', { onUndo: _say(!flag), onRedo: _say(flag) });
    }
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
    if (!sec || _isProtectedEl(sec) || sec.dataset.protected === 'false') return false; // 이미 보호됐거나 사람이 푼 건 덮어쓰지 않음
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
    }
    /* ★★onclick 은 «있든 없든 매번» 다시 건다 (T-094 ⒞ · 2026-09-22 실앱 실측).
       왜 — 저장할 때 sanitizeCanvasHtml 이 on* 속성을 걷어낸다. 그래서 파일을 다시 열면
       단추는 «그대로 보이는데» onclick 이 null 이라 눌러도 아무 일도 안 난다.
       예전엔 이 줄이 위 `if (!btn)` 안에 있어서, 단추가 «이미 있으면» 다시 안 걸었다
       ⇒ 다시 연 판에서 보호를 켜고 끄는 «유일한 입구»가 죽어 있었다.
       실측(포트 9626): 다시 연 뒤 4섹션 전부 onclick=null · 진짜 클릭 주입 → 팝오버 안 열림.
         양성대조 — 그 자리에 onclick 만 손으로 되돌리고 같은 자리를 누르니 팝오버가 열렸다
         ⇒ 「클릭이 안 닿은 것」이 아니라 «핸들러가 없는 것»이 맞다.
       ⛔같은 병이 📝 쪽에도 있어 js/io/save-load.js 가 rebindAll 에서 _ensureMemoButton 을
         다시 부른다 — 여긴 그 호출조차 없었다. 그래서 «자기 안에서» 매번 걸게 한다. */
    btn.setAttribute('onclick', 'window.toggleSectionProtectionPopover(this)');
    // 위치: 📝 메모 버튼 다음 (두 번째 자리). memo가 없으면 첫 자리.
    const memoBtn = tb.querySelector(':scope > .st-memo-btn');
    if (memoBtn) {
      /* ★«요소» 기준 — 이유는 js/section-memo.js 의 같은 자리 주석 참조(T-140 둘째 축).
         ⛔nextSibling 은 공백 텍스트노드일 수 있어, 그대로 두면 부를 때마다 공백이 밀린다.
         ⚠️이 자리는 «모양이 같아서» 같이 고친 것이다 — 🔒 가 실제로 그 잡음을 냈다는
           실측은 «없다»(그 판에서 보호를 안 켰다). 원인이 측정된 자리는 memo 쪽뿐이다. */
      if (memoBtn.nextElementSibling !== btn) {
        tb.insertBefore(btn, memoBtn.nextElementSibling);
      }
    } else {
      if (tb.firstElementChild !== btn) tb.insertBefore(btn, tb.firstElementChild);
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

  /* ★MCP-OTHER-UPDATE-TOOLS-NO-PROTECTED-CHECK-01 — MCP update_* 가 🔒 보호 섹션 블럭의 «있던 글을 빈 글»로 만들면 되돌리고 거절한다(공용 한 자리 · main _guardProtectedText 가 부른다).
     판정(전/후 비교 · 도구 꼴을 모른다): 블럭 안 «글 칸» 수가 그대로인데 글 든 칸이 줄었다 = 있던 글이 빈 글이 됐다 ⇒ 거절.
       다른 글로 바꾸기·빈 칸 채우기·배열 비우기(글 든 줄째 지움 — 이번 범위 밖)는 통과. 이력: 고치는 동안 쌓기를 멈추고, 거절이면 시작 칸으로 복원(이력에 칸 안 남김) · 통과면 끝 칸 하나.
       shortcut: 거절 복원은 캔버스 통째(restoreSnapshot) — 협업 중 그 몇 ms 에 온 상대 패치도 되돌린다(범위 복원 창구가 window 에 없다) · 협업 보호 섹션 MCP 가 늘면 restoreSnapshotScoped 로. */
  const _ZW = /[\s\u200B-\u200D\u2060\uFEFF]/g;
  /* 글 칸 = «제 글자(직속 텍스트)»가 있는 요소 + 글도 자식도 없는 빈 그릇 — «줄1<br>줄2»·굵은 글 옆 글도 한 칸으로 센다(리뷰 1-5).
     SVG 안은 text/tspan 만(그래프 글자). 그림·입력칸 등은 안 센다. */
  function _textSlots(el) {
    let total = 0, filled = 0;
    el.querySelectorAll('*').forEach((n) => {
      const inSvg = !!n.closest('svg');
      if (inSvg ? !/^(text|tspan)$/i.test(n.tagName) : /^(IMG|BR|HR|INPUT|TEXTAREA|SELECT|STYLE|SCRIPT|CANVAS|VIDEO|SVG)$/i.test(n.tagName)) return;
      let own = ''; for (const t of n.childNodes) if (t.nodeType === 3) own += t.nodeValue;
      const has = own.replace(_ZW, '') !== '' && !n.closest('[data-is-placeholder]');   // 자리표시 글(그리드 기본 글 등)은 사용자 글이 아니다 — 빈 칸으로(리뷰 2-3)
      if (!has && n.children.length) return;   // 글 없는 그릇은 칸이 아니다
      total++; if (has) filled++;
    });
    return { total, filled, empty: total - filled };
  }
  const _guardPending = new Map(); let _guardSeq = 0;
  window.__mcpProtGuard = {
    begin(blockId) {
      const el = document.getElementById(String(blockId || ''));
      const sec = el && el.closest('.section-block');
      if (!sec || !isSectionProtected(sec)) return null;
      window.ensureHistoryCheckpoint?.('MCP 수정 전');   // 시작 칸 = 지금 화면
      const tok = ++_guardSeq;
      /* 시작 칸은 «지금 화면»을 직접 찍는다 — 이력 꼭대기는 쌓기가 이미 멈춰 있으면 낡은 판이다(리뷰 2-4). restoreSnapshot 이 읽는 꼴 그대로. */
      const snap = { canvas: window.getSerializedCanvas?.(), videoPendingSidecar: window.getLastVideoPendingSidecar?.(), settings: { ...(window.state?.pageSettings || {}) },
        pageId: window.state?.currentPageId, selection: null };
      if (typeof snap.canvas !== 'string') return null;
      _guardPending.set(tok, { blockId: el.id, before: _textSlots(el), snap, paused: window._historyPaused,
        project: window.activeProjectId, page: window.state?.currentPageId });
      window._historyPaused = true;
      return tok;
    },
    end(tok, applied) {
      const p = _guardPending.get(tok);
      if (!p) return { refused: false };
      _guardPending.delete(tok);
      window._historyPaused = p.paused;
      /* 사이에 프로젝트·페이지가 바뀌었으면 손대지 않는다 — 시작 칸을 다른 판에 씌우면 그 판을 덮는다(리뷰 1-1) · 도구가 안 했으면(USER_BUSY·검증 실패) 비교도 안 한다(리뷰 1-3) */
      if (!applied || window.activeProjectId !== p.project || window.state?.currentPageId !== p.page) return { refused: false };
      const el = document.getElementById(p.blockId);
      const after = el ? _textSlots(el) : null;
      /* 칸 수(구조)는 그대로인데 글 든 칸이 줄었다 = 있던 글이 빈 글이 됐다. 구조가 바뀐 수정(줄·열 더하고 빼기·아이콘 더한 다시 그리기)은 통과(리뷰 2-2) ·
         다른 글·빈 칸 채우기도 통과. shortcut: 빈 글과 구조 바꾸기를 «한 호출»에 섞으면 못 잡는다 — 잡으려면 도구별 모델 비교로. */
      if (after && after.total === p.before.total && after.filled < p.before.filled && p.snap) {
        window.restoreSnapshot?.(p.snap);   // restoreSnapshot 은 이력을 안 쌓는다
        return { refused: true, before: p.before, after };
      }
      if (applied) window.pushHistory?.('MCP 수정');
      return { refused: false };
    },
  };
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
