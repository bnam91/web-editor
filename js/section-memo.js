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
//   - 섹션 툴바 📝 모달 (아래 toggleSectionMemoPopover) — contenteditable 에디터.
//     `[ ]`/`[x]` 를 동그란 체크박스로 보인다. 글자 규칙: js/section-memo-format.js
//
// 제약:
//   - 메모는 string. 최대 2000자 (UTF-8 code points 기준).
//   - 빈 문자열을 주면 dataset.memo 제거 (DOM 노이즈 최소화).
//
// 이 파일은 plain global script (ES module X). window.SectionMemoFormat(js/section-memo-format.js)을
//   쓰지만 없어도 돈다(그때는 체크박스 없이 글자로만).

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

  // ── 메모 에디터(contenteditable) ↔ 평문 (1012t1A1) ─────────────────────────
  //   글자 규칙은 js/section-memo-format.js 한 자리에 있다. 여기는 그 토큰을 DOM 으로 옮길 뿐.
  //   ⛔innerHTML 로 짓지 않는다 — 메모는 사용자·MCP 가 쓴 «글자»다. createElement/createTextNode 만.
  function _memoLen(s) { return [...String(s == null ? '' : s)].length; }

  function _makeCheckNode(checked, raw) {
    const el = document.createElement('span');
    el.className = 'smp-check';
    el.setAttribute('contenteditable', 'false');
    el.setAttribute('role', 'checkbox');
    el.setAttribute('aria-checked', checked ? 'true' : 'false');
    if (raw) el.dataset.raw = raw;
    return el;
  }

  /* 토큰 → 노드. ★새 토큰 종류는 여기에 한 갈래를 더한다(모르는 종류는 버린다). */
  function _tokenToNode(t) {
    if (t.type === 'text') return document.createTextNode(t.text);
    if (t.type === 'br') return document.createElement('br');
    if (t.type === 'check') return _makeCheckNode(t.checked, t.raw);
    return null;
  }

  function _renderMemo(ed, memo) {
    while (ed.firstChild) ed.removeChild(ed.firstChild);
    const F = window.SectionMemoFormat;
    /* 포맷 스크립트가 없으면(격리 하네스) 통째로 글자로 — 줄바꿈은 CSS pre-wrap 이 보인다 */
    const tokens = F ? F.tokenizeMemo(memo) : (memo ? [{ type: 'text', text: String(memo) }] : []);
    for (const t of tokens) {
      const n = _tokenToNode(t);
      if (n) ed.appendChild(n);
    }
  }

  /* 노드 → 토큰. ★새 원자 노드는 여기에 한 갈래를 더한다. */
  function _domToTokens(root, out) {
    for (let n = root.firstChild; n; n = n.nextSibling) {
      if (n.nodeType === 3) { if (n.data) out.push({ type: 'text', text: n.data }); continue; }
      if (n.nodeType !== 1) continue;
      if (n.classList.contains('smp-check')) {
        out.push({ type: 'check', checked: n.getAttribute('aria-checked') === 'true', raw: n.dataset.raw });
        continue;
      }
      if (n.tagName === 'BR') { out.push({ type: 'br' }); continue; }
      /* 브라우저가 문단을 DIV/P 로 쪼갰을 때 — 그 앞이 줄바꿈이다 */
      if ((n.tagName === 'DIV' || n.tagName === 'P') && out.length) out.push({ type: 'br' });
      _domToTokens(n, out);
    }
    return out;
  }

  function _serializeEditor(ed) {
    const tokens = _domToTokens(ed, []);
    const F = window.SectionMemoFormat;
    const s = F ? F.serializeTokens(tokens)
      : tokens.map((t) => (t.type === 'text' ? t.text : t.type === 'br' ? '\n' : '')).join('');
    /* 꼬리 줄바꿈은 턴다 — contenteditable 은 마지막 줄을 보이려고 줄바꿈을 하나 더 둔다 */
    return s.replace(/\n+$/, '');
  }

  // ── section-toolbar 메모 버튼 popover 토글 (UI) ────────────────────────────
  let _activePop = null;
  window.toggleSectionMemoPopover = function toggleSectionMemoPopover(btn) {
    if (!btn) return;
    const sec = btn.closest('.section-block');
    if (!sec) return;
    if (_activePop) {
      const prev = _activePop;
      _activePop = null;
      (prev._backdrop || prev).remove();
      if (prev._anchor === sec) return; // 같은 섹션 토글 = 닫기만
    }
    const memo = sec.dataset.memo || '';
    const pop = document.createElement('div');
    pop._anchor = sec;
    pop.className = 'section-memo-popover';
    /* ★섹션 이름은 틀에 안 넣는다 (T-049) — 빈 칸을 내고 아래에서 textContent 로 채운다. */
    /* ★편집 칸은 textarea 가 아니라 contenteditable 이다 (1012t1A1) — 글 사이에 체크박스 같은
       «원자 노드»를 둘 수 있어야 해서다. 저장은 종전대로 «평문»이고(js/section-memo-format.js),
       메모 본문은 틀(innerHTML)에 안 넣는다 — 아래 _renderMemo 가 노드로만 짓는다. */
    pop.innerHTML = `
      <div class="smp-head">
        <span class="smp-title">📝 <span class="smp-title-name"></span></span>
        <button class="smp-close" type="button" title="닫기 (Esc)">✕</button>
      </div>
      <div class="smp-textarea smp-editor" contenteditable="true" role="textbox" aria-multiline="true" data-placeholder="섹션 메모 (출처, 의도, 디자인 노트 등)..."></div>
      <div class="smp-foot">
        <span class="smp-count">0 / ${MAX_MEMO_LEN}</span>
        <span class="smp-status"></span>
      </div>
    `;
    pop.querySelector('.smp-title-name').textContent = sec.dataset.name || sec.id;
    const ta = pop.querySelector('.smp-editor');
    const count = pop.querySelector('.smp-count');
    const status = pop.querySelector('.smp-status');
    _renderMemo(ta, memo);
    /* ★무변화 가드의 기준값 = «방금 그린 것을 다시 읽은 값». 열고 닫기만 하면 dataset 을 안 건드린다
       (꼬리 줄바꿈처럼 왕복에서 달라지는 글자가 있어도 «손대지 않은 메모»는 그대로 남는다). */
    let lastSaved = _serializeEditor(ta);
    const curLen = () => _memoLen(_serializeEditor(ta));
    const refreshCount = () => {
      count.textContent = `${curLen()} / ${MAX_MEMO_LEN}`;
      ta.classList.toggle('is-empty',
        !ta.textContent && !ta.querySelector('.smp-check') && ta.querySelectorAll('br').length < 2);
    };
    refreshCount();
    let saveTimer = null;
    let statusTimer = null;
    const commit = () => {
      const v = _serializeEditor(ta);
      if (v === lastSaved) return;
      const r = setSectionMemo(sec.id, v);
      if (r.ok) lastSaved = v;
      status.textContent = r.ok ? '저장됨' : ('오류: ' + r.code);
      clearTimeout(statusTimer);
      /* 실패(한도 초과)는 지우지 않는다 — 저장이 안 된 채로 표시만 사라지면 모르고 닫는다 */
      if (r.ok) statusTimer = setTimeout(() => { status.textContent = ''; }, 1500);
    };
    const scheduleCommit = () => {
      refreshCount();
      clearTimeout(saveTimer);
      saveTimer = setTimeout(commit, 500);
    };

    /* ── 원자 노드 넣기 — 선택 범위를 node 로 갈아 끼운다 ───────────────────────
       ★execCommand('insertHTML') 로 넣는다 = 브라우저 «네이티브 되돌리기»에 실린다
         (⌘Z 가 `[]` 글자를 되살린다. 모달 안의 ⌘Z 는 js/editor.js 가 contenteditable 에 양보한다).
       execCommand 가 거절하면(false) Range 로 직접 넣는다 — 그 경로는 ⌘Z 에 안 실린다. */
    const insertAtom = (node) => {
      let ok = false;
      try { ok = document.execCommand('insertHTML', false, node.outerHTML); } catch (_) { ok = false; }
      if (ok) {
        /* 브라우저가 속성을 떨궜을 때를 대비해 다시 박는다(실측: 크롬은 보존한다) */
        ta.querySelectorAll('.smp-check').forEach((c) => {
          if (c.getAttribute('contenteditable') !== 'false') c.setAttribute('contenteditable', 'false');
          if (c.getAttribute('role') !== 'checkbox') c.setAttribute('role', 'checkbox');
          if (!c.hasAttribute('aria-checked')) c.setAttribute('aria-checked', 'false');
          if (c.hasAttribute('style')) c.removeAttribute('style');
        });
        return;
      }
      const sel = window.getSelection();
      if (!sel || !sel.rangeCount) return;
      const r = sel.getRangeAt(0);
      if (!ta.contains(r.commonAncestorContainer)) return;
      r.deleteContents();
      r.insertNode(node);
      r.setStartAfter(node);
      r.collapse(true);
      sel.removeAllRanges();
      sel.addRange(r);
    };
    /* 토큰 줄을 캐럿 자리에 넣는다(붙여넣기). ★새 토큰 종류는 여기에 한 갈래를 더한다. */
    const insertTokens = (tokens) => {
      for (const t of tokens) {
        if (t.type === 'text') { if (t.text) document.execCommand('insertText', false, t.text); }
        else if (t.type === 'br') document.execCommand('insertLineBreak');
        else if (t.type === 'check') insertAtom(_makeCheckNode(t.checked, t.raw));
      }
    };

    /* ── `[]` → 체크박스 ───────────────────────────────────────────────────────
       «치는 순간»에만 바꾼다: 캐럿 바로 앞이 `[]` · `[ ]` · `[x]` 로 끝나게 `]` 를 쳤을 때.
       ⛔저장돼 있던 `[]` 글자나, 되돌리기로 돌아온 `[]` 는 안 바꾼다(그래서 `]` 입력만 본다). */
    const convertAtCaret = () => {
      const F = window.SectionMemoFormat;
      const sel = window.getSelection();
      if (!F || !sel || !sel.rangeCount || !sel.isCollapsed) return false;
      const node = sel.anchorNode;
      const off = sel.anchorOffset;
      if (!node || node.nodeType !== 3 || !ta.contains(node)) return false;
      const trig = F.checkTrigger(node.data.slice(0, off));
      if (!trig) return false;
      /* `[]`(2자)는 `[ ]`(3자)로 저장된다 — 한도 끝에서는 바꾸지 않는다 */
      if (curLen() - trig.len + 3 > MAX_MEMO_LEN) return false;
      const r = document.createRange();
      r.setStart(node, off - trig.len);
      r.setEnd(node, off);
      sel.removeAllRanges();
      sel.addRange(r);
      insertAtom(_makeCheckNode(trig.checked));
      return true;
    };

    /* ★조합(IME) 중에는 DOM 을 건드리지 않는다 — 조합 글자가 깨진다. 끝난 뒤 한 번만 본다. */
    let composing = false;
    ta.addEventListener('compositionstart', () => { composing = true; });
    ta.addEventListener('compositionend', (e) => {
      composing = false;
      if (typeof e.data === 'string' && e.data.endsWith(']')) convertAtCaret();
      scheduleCommit();
    });
    ta.addEventListener('input', (e) => {
      if (e.isComposing || composing) { refreshCount(); return; }
      if (e.inputType === 'insertText' && e.data === ']') convertAtCaret();
      scheduleCommit();
    });
    /* 한도 — textarea 의 maxlength 를 대신한다(조합 중 입력은 못 막는다 → commit 이 오류로 알린다) */
    ta.addEventListener('beforeinput', (e) => {
      if (e.isComposing || composing) return;
      const t = e.inputType || '';
      if (!t.startsWith('insert')) return;
      const add = (t === 'insertLineBreak' || t === 'insertParagraph') ? 1 : _memoLen(e.data || '');
      if (!add) return;
      const sel = window.getSelection();
      const cut = sel && !sel.isCollapsed ? _memoLen(sel.toString()) : 0;
      if (curLen() + add - cut > MAX_MEMO_LEN) e.preventDefault();
    });
    /* 줄바꿈은 항상 «한 줄바꿈»으로 — 기본 동작(DIV 로 문단 쪼개기)을 쓰지 않는다 */
    ta.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' || e.isComposing || composing || e.keyCode === 229) return;
      e.preventDefault();
      if (curLen() + 1 > MAX_MEMO_LEN) return;
      document.execCommand('insertLineBreak');
    });
    /* 체크 토글 — mousedown 을 막아 캐럿·포커스를 그대로 둔다 */
    ta.addEventListener('mousedown', (e) => {
      if (e.target.closest && e.target.closest('.smp-check')) e.preventDefault();
    });
    ta.addEventListener('click', (e) => {
      const c = e.target.closest && e.target.closest('.smp-check');
      if (!c || !ta.contains(c)) return;
      c.setAttribute('aria-checked', c.getAttribute('aria-checked') === 'true' ? 'false' : 'true');
      delete c.dataset.raw;
      scheduleCommit();
    });
    /* 붙여넣기 — «평문»만 받는다. text/html 은 읽지 않는다(contenteditable 의 기본 붙여넣기는
       남의 마크업을 그대로 들인다). ★다른 종류(예: 이미지 파일)를 받으려면 이 앞에서 가른다. */
    ta.addEventListener('paste', (e) => {
      e.preventDefault();
      const F = window.SectionMemoFormat;
      let text = (e.clipboardData && e.clipboardData.getData('text/plain')) || '';
      text = text.replace(/\r\n?/g, '\n');
      if (!text) return;
      const sel = window.getSelection();
      const cut = sel && !sel.isCollapsed ? _memoLen(sel.toString()) : 0;
      const room = MAX_MEMO_LEN - curLen() + cut;
      if (room <= 0) return;
      if (_memoLen(text) > room) text = Array.from(text).slice(0, room).join('');
      insertTokens(F ? F.tokenizeMemo(text) : [{ type: 'text', text }]);
      scheduleCommit();
    });
    ta.addEventListener('dragover', (e) => { e.preventDefault(); });
    ta.addEventListener('drop', (e) => { e.preventDefault(); });
    ta.addEventListener('blur', () => { clearTimeout(saveTimer); commit(); });
    // 모달 backdrop으로 감싸기 — 화면 중앙에 "열린다" 느낌
    const backdrop = document.createElement('div');
    backdrop.className = 'section-memo-backdrop';
    backdrop.appendChild(pop);
    document.body.appendChild(backdrop);
    pop._backdrop = backdrop;

    const closeModal = () => {
      clearTimeout(saveTimer); commit();
      document.removeEventListener('keydown', onKey, true);
      backdrop.classList.remove('open');
      // transition 끝난 후 제거 (CSS 200ms와 일치)
      setTimeout(() => { backdrop.remove(); }, 220);
      if (_activePop === pop) _activePop = null;
    };

    pop.querySelector('.smp-close').addEventListener('click', (e) => {
      e.stopPropagation();
      closeModal();
    });
    // 안쪽 클릭은 닫힘 방지
    pop.addEventListener('mousedown', e => e.stopPropagation());
    // backdrop 클릭으로 닫기
    backdrop.addEventListener('mousedown', (e) => {
      if (e.target === backdrop) closeModal();
    });
    // Esc 키로 닫기
    const onKey = (ev) => { if (ev.key === 'Escape') { ev.stopPropagation(); closeModal(); } };
    document.addEventListener('keydown', onKey, true);

    _activePop = pop;
    // 다음 frame에 open class → CSS transition 트리거 (열리는 애니메이션)
    requestAnimationFrame(() => backdrop.classList.add('open'));
    setTimeout(() => {
      ta.focus();
      /* 캐럿을 글 끝으로 */
      const r = document.createRange();
      r.selectNodeContents(ta);
      r.collapse(false);
      const sel = window.getSelection();
      if (sel) { sel.removeAllRanges(); sel.addRange(r); }
    }, 60);
  };

  // 마이그레이션: 기존 저장 프로젝트의 toolbar에 📝 버튼 주입 (ai-section-fill 패턴 미러).
  function _ensureMemoButton(sec) {
    if (!sec) return;
    const tb = sec.querySelector(':scope > .section-toolbar');
    if (!tb) return;
    let btn = tb.querySelector('.st-memo-btn');
    if (!btn) {
      btn = document.createElement('button');
      btn.className = 'st-btn st-memo-btn';
      btn.title = '섹션 메모';
      btn.textContent = '📝';
    }
    // onclick은 직렬화(sanitizeCanvasHtml)가 on* 속성을 제거하므로 로드마다 항상 재설정.
    // 안 하면 버튼은 보이나 클릭 무반응 = "섹션 메모 패널 안 열림" 회귀.
    btn.setAttribute('onclick', 'window.toggleSectionMemoPopover(this)');
    // toolbar 맨 왼쪽으로 이동 — 항상 첫 자식
    /* ★«노드»가 아니라 «요소» 기준으로 자리를 본다 (T-140 둘째 축, 2026-09-22 실측)
       ⛔tb.firstChild 는 «단추»가 아니라 툴바 마크업의 «공백 텍스트노드»다. 그래서 이 줄이
         부를 때마다 참이 되어, 단추가 공백을 넘어 앞으로 튀고 공백 뭉치가 뒤로 밀린다.
         단추 «차례»는 그대로인데 childNodes 가 바뀌고, 직렬화는 그 텍스트노드를 그대로
         싣는다 ⇒ 비교자가 «길이 같고 내용 다른» 차이를 보고 빈 ⌘Z 칸을 하나 더 쌓는다.
       ★실측(2026-09-22, 뿌리 고침만 넣은 판 9624): 단추 차례는 ⌘Z 앞뒤 5/5 동일인데
         «빈 ⌘Z 칸»은 5/5 재현. 태그 단위 diff 가 «공백 줄 4개(−2/+2)»뿐이었다.
         rebind 한 번만 불러도 재현된다:
           before [TEXT,TEXT,memo,TEXT,ab,ai] → after [memo,TEXT,TEXT,TEXT,ab,ai]
       ⇒ firstElementChild 로 보면 «이미 첫 요소»일 때 안 건드린다. */
    if (tb.firstElementChild !== btn) tb.insertBefore(btn, tb.firstElementChild);
  }
  function _hydrateAllSectionsForMemoBtn() {
    document.querySelectorAll('.section-block').forEach(_ensureMemoButton);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      _hydrateAllSectionsForMemoBtn();
      setTimeout(_hydrateAllSectionsForMemoBtn, 1500);
    });
  } else {
    _hydrateAllSectionsForMemoBtn();
    setTimeout(_hydrateAllSectionsForMemoBtn, 1500);
  }
  window._ensureMemoButton = _ensureMemoButton;
  window._hydrateAllSectionsForMemoBtn = _hydrateAllSectionsForMemoBtn;
})();
