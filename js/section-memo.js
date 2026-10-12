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
//     `[ ]`/`[x]` 를 동그란 체크박스로, `![](goya-asset://…)` 를 참고 이미지로 보인다.
//     글자 규칙: js/section-memo-format.js
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

  /* 참고 이미지 (1012t1A2) — 주소는 «앱 자산»(goya-asset://)만. 그 판정은 포맷 한 자리(isMemoImgSrc). */
  const MEMO_IMG_MAX_BYTES = 20 * 1024 * 1024;   // 선례: image-handling.js ASSET_IMAGE_MAX_BYTES
  const MEMO_IMG_LONG_EDGE = 1280;               // 선례: js/report-modal.js shrinkToJpeg
  const MEMO_IMG_JPEG_Q = 0.8;
  const ATOM_SEL = '.smp-check, .smp-img';

  function _isMemoImgSrc(src) {
    const F = window.SectionMemoFormat;
    return !!(F && typeof F.isMemoImgSrc === 'function' && F.isMemoImgSrc(src));
  }
  function _makeImgNode(src) {
    const el = document.createElement('img');
    el.className = 'smp-img';
    el.setAttribute('contenteditable', 'false');
    el.setAttribute('draggable', 'false');
    el.setAttribute('alt', '');
    el.setAttribute('src', src);
    return el;
  }
  function _toast(msg) { if (typeof window.showToast === 'function') window.showToast(msg); }

  /* 파일 → 긴 변 1280px JPEG(흰 바탕)의 base64. 메모의 그림은 «참고용»이라 원본을 싣지 않는다. */
  function _shrinkToJpegB64(file) {
    return new Promise((resolve, reject) => {
      const rd = new FileReader();
      rd.onerror = () => reject(rd.error || new Error('read'));
      rd.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('decode'));
        img.onload = () => {
          try {
            const w = img.naturalWidth || img.width;
            const h = img.naturalHeight || img.height;
            if (!w || !h) return reject(new Error('size'));
            const k = Math.min(1, MEMO_IMG_LONG_EDGE / Math.max(w, h));
            const cv = document.createElement('canvas');
            cv.width = Math.max(1, Math.round(w * k));
            cv.height = Math.max(1, Math.round(h * k));
            const ctx = cv.getContext('2d');
            ctx.fillStyle = '#ffffff';   // JPEG 은 알파가 없다 — 안 깔면 투명부가 검게 나온다
            ctx.fillRect(0, 0, cv.width, cv.height);
            ctx.drawImage(img, 0, 0, cv.width, cv.height);
            const m = /^data:image\/jpeg;base64,(.+)$/.exec(cv.toDataURL('image/jpeg', MEMO_IMG_JPEG_Q));
            if (!m) return reject(new Error('encode'));
            resolve(m[1]);
          } catch (e) { reject(e); }
        };
        img.src = String(rd.result || '');
      };
      rd.readAsDataURL(file);
    });
  }

  /* 토큰 → 노드. ★새 토큰 종류는 여기에 한 갈래를 더한다(모르는 종류는 버린다). */
  function _tokenToNode(t) {
    if (t.type === 'text') return document.createTextNode(t.text);
    if (t.type === 'br') return document.createElement('br');
    if (t.type === 'check') return _makeCheckNode(t.checked, t.raw);
    if (t.type === 'img') return _isMemoImgSrc(t.src) ? _makeImgNode(t.src) : null;
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
      if (n.tagName === 'IMG') {
        /* 우리가 넣은 그림만 읽는다 — 그 밖의 img 는 메모의 글이 아니다(직렬화도 주소를 한 번 더 가른다) */
        if (n.classList.contains('smp-img')) out.push({ type: 'img', src: n.getAttribute('src') || '' });
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
        !ta.textContent && !ta.querySelector(ATOM_SEL) && ta.querySelectorAll('br').length < 2);
    };
    refreshCount();
    let saveTimer = null;
    let statusTimer = null;
    /* ★조합(IME) 중에는 DOM 을 건드리지 않는다 — 조합 글자가 깨진다. 끝난 뒤 한 번만 본다. */
    let composing = false;
    /* ── 한도 맞추기 ─────────────────────────────────────────────────────────
       조합(IME) 입력은 beforeinput 으로 못 막는다 ⇒ 넘친 만큼을 «글 끝에서» 잘라 한도 안으로 맞춘다.
       ★원자 노드(체크박스·그림)는 반쪽 내지 않는다 — 걸리면 통째로 뗀다(표식 글자가 깨져 남지 않게).
       ★글자는 deleteData 로 자른다 — data 를 통째로 갈면 그 노드 안의 캐럿이 맨 앞으로 튄다. */
    let limitNote = false;
    const clampToLimit = () => {
      let over = curLen() - MAX_MEMO_LEN;
      if (over <= 0) return false;
      for (let guard = 0; over > 0 && guard < MAX_MEMO_LEN * 4; guard++) {
        let n = ta.lastChild;
        while (n && n.nodeType === 1 && !n.matches(ATOM_SEL) && n.tagName !== 'BR' && n.lastChild) n = n.lastChild;
        if (!n) break;
        if (n.nodeType === 3 && n.data) {
          const cps = Array.from(n.data);
          const keep = Math.max(0, cps.length - over);
          const at = cps.slice(0, keep).join('').length;
          n.deleteData(at, n.data.length - at);
          if (!n.data) n.remove();
        } else {
          n.remove();
        }
        over = curLen() - MAX_MEMO_LEN;
      }
      limitNote = true;
      return true;
    };
    const showLimitNote = () => {
      clearTimeout(statusTimer);
      status.textContent = `${MAX_MEMO_LEN}자까지 저장됩니다`;
      statusTimer = setTimeout(() => { status.textContent = ''; }, 3000);
    };
    const commit = () => {
      /* 어느 길로 넘쳤든 저장은 한도 안의 글로 한다 — 통째로 거절하면 그 뒤 편집까지 같이 버려진다 */
      if (!composing && clampToLimit()) refreshCount();
      const v = _serializeEditor(ta);
      if (v === lastSaved) {
        if (limitNote) { limitNote = false; showLimitNote(); }
        return;
      }
      const r = setSectionMemo(sec.id, v);
      if (r.ok) lastSaved = v;
      clearTimeout(statusTimer);
      if (r.ok && limitNote) { limitNote = false; showLimitNote(); return; }
      status.textContent = r.ok ? '저장됨'
        : (r.code === 'TOO_LONG' ? `${MAX_MEMO_LEN}자를 넘어 저장하지 못했습니다` : '저장하지 못했습니다');
      /* 실패는 지우지 않는다 — 저장이 안 된 채로 표시만 사라지면 모르고 닫는다 */
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
       ⛔execCommand 의 «반환값»을 믿지 않는다 — 크롬은 캐럿 뒤에 글자가 있으면 노드를 «넣고도» false 를
         돌려준다(실측 2026-10-12: `abc|def` 에서 false ＋ 삽입됨 ⇒ 폴백이 한 번 더 넣어 체크가 둘).
         ⇒ 넣기 전에 노드에 표식을 달고, 편집 칸에 «그 표식이 생겼는가»로 판정한다.
       아무것도 안 들어갔을 때만 Range 로 직접 넣는다 — 그 경로는 ⌘Z 에 안 실린다. */
    const NEW_MARK = 'data-smp-new';
    const insertAtom = (node) => {
      const sel0 = window.getSelection();
      const r0 = sel0 && sel0.rangeCount ? sel0.getRangeAt(0) : null;
      const inEditor = !!r0 && ta.contains(r0.commonAncestorContainer);
      /* 선택 범위가 원자 노드를 품지 않았으면 «수가 늘었나»도 증거다(브라우저가 표식을 떨궜을 때의 둘째 자) */
      const atomsBefore = ta.querySelectorAll(ATOM_SEL).length;
      const selHasAtom = inEditor && !r0.collapsed
        && Array.from(ta.querySelectorAll(ATOM_SEL)).some((c) => r0.intersectsNode(c));
      node.setAttribute(NEW_MARK, '1');
      try { document.execCommand('insertHTML', false, node.outerHTML); } catch (_) { /* 아래 판정이 가른다 */ }
      node.removeAttribute(NEW_MARK);
      const marked = ta.querySelectorAll('[' + NEW_MARK + ']');
      const inserted = marked.length > 0
        || (!selHasAtom && ta.querySelectorAll(ATOM_SEL).length > atomsBefore);
      /* ★캐럿은 «넣은 노드 바로 뒤»에 둔다 — 반환값이 false 인 그 경우에 크롬은 캐럿을 노드 «앞»에 남긴다
         (실측: `abc|def` 에 넣고 이어 치면 글자가 체크박스 앞에 붙었다). */
      const last = marked.length ? marked[marked.length - 1] : null;
      marked.forEach((c) => c.removeAttribute(NEW_MARK));
      if (last && sel0) {
        const after = document.createRange();
        after.setStartAfter(last);
        after.collapse(true);
        sel0.removeAllRanges();
        sel0.addRange(after);
      }
      if (inserted) {
        /* 브라우저가 속성을 떨궜을 때를 대비해 다시 박는다(실측: 크롬은 보존한다) */
        ta.querySelectorAll(ATOM_SEL).forEach((c) => {
          if (c.getAttribute('contenteditable') !== 'false') c.setAttribute('contenteditable', 'false');
          if (c.hasAttribute('style')) c.removeAttribute('style');
          if (c.classList.contains('smp-check')) {
            if (c.getAttribute('role') !== 'checkbox') c.setAttribute('role', 'checkbox');
            if (!c.hasAttribute('aria-checked')) c.setAttribute('aria-checked', 'false');
          } else {
            if (c.getAttribute('draggable') !== 'false') c.setAttribute('draggable', 'false');
            ['width', 'height'].forEach((a) => { if (c.hasAttribute(a)) c.removeAttribute(a); });
          }
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
    /* ── 남의 꾸밈 걷기 ────────────────────────────────────────────────────────
       크롬은 지운 글의 «모양»을 다음에 넣는 글에 물려준다(typing style). 체크된 체크박스로 시작하는
       범위를 지우고 글을 넣으면 그 글이 <span style="background-color:…"> 에 싸여 파랗게 보인다
       (실측 2026-10-12: ⌘A → 글자 하나). 메모는 «평문»이라 편집 칸에는 글자·줄바꿈·원자 노드만 둔다
       ⇒ 그 밖의 요소는 껍데기만 벗긴다(글자는 남긴다). DIV/P 는 줄바꿈 뜻이라 두되 꾸밈만 뗀다. */
    const scrubForeign = () => {
      const all = Array.from(ta.querySelectorAll('*')).filter((el) => !el.matches(ATOM_SEL) && el.tagName !== 'BR');
      const bad = all.filter((el) => el.tagName !== 'DIV' && el.tagName !== 'P');
      all.forEach((el) => { if (el.hasAttribute('style')) el.removeAttribute('style'); });
      if (!bad.length) return false;
      /* 껍데기를 벗기면 그 안의 캐럿이 밖으로 밀린다 — 글자 노드 기준으로 쥐었다가 되놓는다 */
      const sel = window.getSelection();
      let aN = null;
      let aO = 0;
      if (sel && sel.rangeCount && sel.isCollapsed && ta.contains(sel.anchorNode)) {
        aN = sel.anchorNode;
        aO = sel.anchorOffset;
        if (aN.nodeType === 1 && aN !== ta) {
          /* 캐럿이 요소 경계에 있다 — 그 자리에 빈 글자 노드를 심어 닻으로 쓴다 */
          const anchor = document.createTextNode('');
          aN.insertBefore(anchor, aN.childNodes[aO] || null);
          aN = anchor;
          aO = 0;
        }
      }
      for (const el of bad) {
        const p = el.parentNode;
        if (!p) continue;
        while (el.firstChild) p.insertBefore(el.firstChild, el);
        p.removeChild(el);
      }
      if (aN && aN !== ta && aN.isConnected && sel) {
        const r = document.createRange();
        r.setStart(aN, Math.min(aO, aN.nodeType === 3 ? aN.data.length : aN.childNodes.length));
        r.collapse(true);
        sel.removeAllRanges();
        sel.addRange(r);
      }
      return true;
    };
    /* 토큰 줄을 캐럿 자리에 넣는다(붙여넣기). ★새 토큰 종류는 여기에 한 갈래를 더한다. */
    const insertTokens = (tokens) => {
      for (const t of tokens) {
        if (t.type === 'text') { if (t.text) document.execCommand('insertText', false, t.text); }
        else if (t.type === 'br') document.execCommand('insertLineBreak');
        else if (t.type === 'check') insertAtom(_makeCheckNode(t.checked, t.raw));
        else if (t.type === 'img') { if (_isMemoImgSrc(t.src)) insertAtom(_makeImgNode(t.src)); }
      }
      scrubForeign();
    };

    /* ── 참고 이미지 붙여넣기 (1012t1A2) ───────────────────────────────────────
       그림은 «프로젝트 자산»으로 저장하고(assetsSaveCanvasImage → goya-asset:// 주소), 메모에는
       그 주소의 표식만 남긴다. ⛔data URL 로 메모에 싣지 않는다 — data-memo 는 캔버스 직렬화에
       그대로 실려 히스토리 표본마다 그림이 한 벌씩 붙는다. 그래서 IPC·프로젝트가 없으면 «안 넣는다». */
    const pasteImages = async (files) => {
      const api = window.electronAPI;
      const projectId = window.activeProjectId || new URLSearchParams(window.location.search).get('project') || null;
      if (!api || typeof api.assetsSaveCanvasImage !== 'function' || !projectId) {
        _toast('⚠️ 이미지는 저장된 프로젝트에서만 메모에 넣을 수 있습니다');
        return;
      }
      /* 기다리는 동안 캐럿이 딴 데로 갈 수 있다 — 붙인 «그 자리»를 쥐고 간다(Range 는 DOM 을 따라 움직인다) */
      const sel0 = window.getSelection();
      let at = null;
      if (sel0 && sel0.rangeCount && ta.contains(sel0.getRangeAt(0).commonAncestorContainer)) at = sel0.getRangeAt(0).cloneRange();
      if (!at) { at = document.createRange(); at.selectNodeContents(ta); at.collapse(false); }
      /* 한도를 넘길 그림은 «저장하기 전에» 거른다 — 자산 파일부터 쓰고 거절하면 메모에 안 쓰이는 파일이 남는다.
         표식 길이는 주소 꼴로 미리 어림한다(goya-asset://<프로젝트>/<16hex>.jpg). 어림이라 저장 뒤에도 한 번 더 잰다. */
      const estToken = _memoLen(window.SectionMemoFormat.imgToken(`goya-asset://${projectId}/${'0'.repeat(16)}.jpg`));
      const tooLong = () => _toast(`⚠️ 메모가 ${MAX_MEMO_LEN}자를 넘어 이미지를 더 넣을 수 없습니다`);
      for (const file of files) {
        if (file.size > MEMO_IMG_MAX_BYTES) {
          _toast(`⚠️ ${Math.round(MEMO_IMG_MAX_BYTES / 1024 / 1024)}MB 이하 이미지만 지원`);
          continue;
        }
        if (curLen() - (at.collapsed ? 0 : _memoLen(at.toString())) + estToken > MAX_MEMO_LEN) { tooLong(); break; }
        let url = null;
        try {
          const b64 = await _shrinkToJpegB64(file);
          const saved = await api.assetsSaveCanvasImage({ projectId, b64, mime: 'image/jpeg' });
          if (saved && saved.ok && typeof saved.url === 'string') url = saved.url;
        } catch (_) { url = null; }
        if (!_isMemoImgSrc(url)) { _toast('⚠️ 이미지를 저장하지 못했습니다'); continue; }
        /* 그 사이 모달이 닫혔으면 넣을 자리가 없다(자산 파일은 남는다 — 같은 바이트는 같은 이름이라 다시 붙여도 한 벌) */
        if (!ta.isConnected) return;
        const cut = at.collapsed ? 0 : _memoLen(at.toString());
        if (curLen() - cut + _memoLen(window.SectionMemoFormat.imgToken(url)) > MAX_MEMO_LEN) {
          tooLong();
          break;
        }
        ta.focus();
        const sel = window.getSelection();
        if (!sel) return;
        sel.removeAllRanges();
        sel.addRange(at);
        insertAtom(_makeImgNode(url));
        /* 다음 장은 방금 넣은 그림 «뒤»에 */
        if (sel.rangeCount && ta.contains(sel.getRangeAt(0).commonAncestorContainer)) at = sel.getRangeAt(0).cloneRange();
        scheduleCommit();
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

    ta.addEventListener('compositionstart', () => { composing = true; });
    ta.addEventListener('compositionend', (e) => {
      composing = false;
      if (typeof e.data === 'string' && e.data.endsWith(']')) convertAtCaret();
      scrubForeign();
      clampToLimit();
      scheduleCommit();
    });
    ta.addEventListener('input', (e) => {
      if (e.isComposing || composing) { refreshCount(); return; }
      if (e.inputType === 'insertText' && e.data === ']') convertAtCaret();
      scrubForeign();
      scheduleCommit();
    });
    /* 한도 — textarea 의 maxlength 를 대신한다(조합 중 입력은 못 막는다 → 조합이 끝날 때 clampToLimit 이 끝에서 자른다) */
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
    /* 서식 단축키(⌘B · ⌘I · ⌘U · ⌘⇧X)는 메모에서 «아무 일도 안 한다» — 메모는 평문이다.
       ★둘 다 막아야 한다: preventDefault = 크롬의 기본 굵게/기울임/밑줄,
         stopPropagation = js/editor.js 의 전역 keydown(document · bubble 단계 — 실측)이 contenteditable 이면
         execCommand('bold') 등을 걸고 캔버스 히스토리를 한 칸 쌓는 것. 이 리스너는 그보다 먼저(대상 단계) 돈다.
       e.code 도 본다 — 한글 자판에서는 e.key 가 라틴 글자가 아닐 수 있다. */
    ta.addEventListener('keydown', (e) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
      const k = (e.key || '').toLowerCase();
      const is = (ch, code) => k === ch || e.code === code;
      const fmt = e.shiftKey ? is('x', 'KeyX') : (is('b', 'KeyB') || is('i', 'KeyI') || is('u', 'KeyU'));
      if (!fmt) return;
      e.preventDefault();
      e.stopPropagation();
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
    /* 그림을 누르면 그 그림 하나가 선택된다 — 이어서 Delete/Backspace 로 지운다(자산 파일은 안 지운다) */
    ta.addEventListener('click', (e) => {
      const im = e.target.closest && e.target.closest('.smp-img');
      if (!im || !ta.contains(im)) return;
      const r = document.createRange();
      r.selectNode(im);
      const sel = window.getSelection();
      if (sel) { sel.removeAllRanges(); sel.addRange(r); }
    });
    /* 복사·잘라내기 — 고른 범위를 «저장 글자»로 싣는다(체크박스 `[ ]`/`[x]` · 그림 표식).
       기본 복사는 화면 글자만 실어 원자 노드가 빠진다 ⇒ 다시 붙이면 체크박스·그림이 사라진다.
       text/html 은 안 싣는다 — 메모 밖에 붙일 때도 평문이다. */
    const selectionAsMemo = () => {
      const sel = window.getSelection();
      if (!sel || !sel.rangeCount || sel.isCollapsed) return null;
      const r = sel.getRangeAt(0);
      if (!ta.contains(r.commonAncestorContainer)) return null;
      const tokens = _domToTokens(r.cloneContents(), []);
      const F = window.SectionMemoFormat;
      return F ? F.serializeTokens(tokens)
        : tokens.map((t) => (t.type === 'text' ? t.text : t.type === 'br' ? '\n' : '')).join('');
    };
    const onCopyCut = (e) => {
      const text = selectionAsMemo();
      if (text == null || !e.clipboardData) return;   // 고른 것이 없으면 기본 동작 그대로
      e.clipboardData.setData('text/plain', text);
      e.preventDefault();
      e.stopPropagation();
      if (e.type !== 'cut') return;
      /* 지우기는 execCommand 로 = 네이티브 되돌리기에 실린다. 안 지워졌으면 Range 로 직접. */
      const before = _serializeEditor(ta);
      try { document.execCommand('delete'); } catch (_) { /* 아래가 가른다 */ }
      const sel = window.getSelection();
      if (_serializeEditor(ta) === before && sel && sel.rangeCount && !sel.isCollapsed) sel.getRangeAt(0).deleteContents();
      scheduleCommit();
    };
    ta.addEventListener('copy', onCopyCut);
    ta.addEventListener('cut', onCopyCut);
    /* 붙여넣기 — 그림 파일이 있으면 그림으로, 없으면 «평문»만 받는다. text/html 은 읽지 않는다
       (contenteditable 의 기본 붙여넣기는 남의 마크업을 그대로 들인다). */
    ta.addEventListener('paste', (e) => {
      e.preventDefault();
      /* ★파일은 «이 틱 안에서» 꺼낸다 — 처리기가 돌아간 뒤에는 클립보드 항목이 비워진다 */
      const cd = e.clipboardData;
      const imgs = [];
      for (const it of Array.from((cd && cd.items) || [])) {
        if (it.kind !== 'file' || !/^image\//.test(it.type)) continue;
        const f = it.getAsFile();
        if (f) imgs.push(f);
      }
      if (imgs.length) {
        /* 전역 붙여넣기(스크래치패드·캔버스)로 새지 않게 여기서 끝낸다 */
        e.stopPropagation();
        pasteImages(imgs);
        return;
      }
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
