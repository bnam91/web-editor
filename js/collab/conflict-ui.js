/* ═══════════════════════════════════════════════════════════════════════════
   collab/conflict-ui.js — 협업 «충돌 고르기» 단추와 그 칸 (SIX ① · 2026-10-06 지디 · 현빈 「한쪽 작업량이 날라가네」).
   ───────────────────────────────────────────────────────────────────────────
   ★무엇: 같은 섹션을 둘이 고쳐 한쪽 판이 «안 보이게» 된 섹션마다 [상대 판으로 바꾸기] [내 판 유지] 를 준다.
     서버엔 둘 다 남는다(keep-both). 기록은 sync.js 가 갖는다(collabSync.conflicts · resolveConflict) — 이 파일은 «그리기»만.
   ★왜 캔버스 «밖»인가: 섹션 DOM 에 단추를 넣으면 저장본(canvas HTML)에 섞여 상대에게까지 간다.
     그래서 상단바 배지 옆 단추 하나 + 그 아래 떠 있는 칸으로만 그린다.
   ★문장은 js/collab/reasons.js 한 벌에서만(새 문장은 현빈 검수 — 승인 전엔 null → 원문 키가 보이고 G1 이 켠 판 push 를 막는다).
   ⚠️고전 스크립트 · notify.js 가 부른다(듣는 자리는 notify 하나 — 이 파일은 collabSync.onEvent 를 직접 듣지 않는다).
═══════════════════════════════════════════════════════════════════════════ */
(function () {
  const T = (k) => (window.CollabReasons ? window.CollabReasons.text(k) : k);
  const label = (id) => (window.collabNotify && window.collabNotify.sectionLabel) ? window.collabNotify.sectionLabel(id) : id;
  const excerpt = (html) => {
    try {
      const d = new DOMParser().parseFromString(html || '', 'text/html');
      const t = (d.body.textContent || '').replace(/\s+/g, ' ').trim();
      return t.length > 60 ? t.slice(0, 60) + '…' : t;
    } catch (e) { console.debug('[collab/conflict-ui] 미리보기 글자 뽑기 실패:', e); return ''; }
  };
  let _open = false;

  function ensureButton() {
    let btn = document.getElementById('collab-conflict-btn');
    if (btn) return btn;
    const anchor = document.getElementById('collab-topbar-badge');
    if (!anchor || !anchor.parentNode) return null;   // 조용한 까닭: 상단바가 없는 화면(목록 등) — 편집기에서만 고른다
    btn = document.createElement('span');
    btn.id = 'collab-conflict-btn';
    btn.className = 'tb-badge';
    btn.style.cssText = 'display:none;cursor:pointer;';
    btn.addEventListener('click', (e) => { e.stopPropagation(); _open = !_open; render(); });
    anchor.parentNode.insertBefore(btn, anchor.nextSibling);
    return btn;
  }

  function ensurePanel() {
    let pop = document.getElementById('collab-conflict-pop');
    if (pop) return pop;
    pop = document.createElement('div');
    pop.id = 'collab-conflict-pop';
    pop.style.cssText = 'position:fixed;z-index:2147483000;display:none;min-width:300px;max-width:420px;padding:8px;'
      + 'background:#1e1e1e;color:#eee;border:1px solid #444;border-radius:8px;box-shadow:0 6px 24px rgba(0,0,0,.4);font-size:12px;';
    document.body.appendChild(pop);
    return pop;
  }

  function render() {
    const cs = window.collabSync;
    const list = (cs && typeof cs.conflicts === 'function') ? cs.conflicts() : [];
    const btn = ensureButton();
    if (!btn) return;
    const pop = ensurePanel();
    if (!list.length) { btn.style.display = 'none'; btn.textContent = ''; pop.style.display = 'none'; _open = false; return; }
    btn.textContent = `${T('conflict_badge')} ${list.length}`;
    btn.style.display = '';
    if (!_open) { pop.style.display = 'none'; return; }
    const r = btn.getBoundingClientRect();
    pop.style.left = Math.max(8, Math.round(r.left)) + 'px';
    pop.style.top = Math.round(r.bottom + 6) + 'px';
    pop.innerHTML = '';
    for (const c of list) {
      const row = document.createElement('div');
      row.className = 'collab-conflict-row';
      row.dataset.key = c.key;
      row.style.cssText = 'padding:6px 4px;border-bottom:1px solid #333;';
      const head = document.createElement('div');
      head.style.cssText = 'font-weight:600;margin-bottom:4px;';
      head.textContent = `${label(c.sectionId)} · ${c.theirs && (c.theirs.email || c.theirs.actorId) || ''}`;
      const mine = document.createElement('div'); mine.style.cssText = 'opacity:.85;';
      mine.textContent = `${T('conflict_mine')}: ${excerpt(c.mineHtml)}`;
      const theirs = document.createElement('div'); theirs.style.cssText = 'opacity:.85;margin-bottom:6px;';
      theirs.textContent = `${T('conflict_theirs')}: ${excerpt(c.theirsHtml)}`;
      const b1 = document.createElement('button'); b1.className = 'settings-api-test'; b1.dataset.pick = 'theirs';
      b1.textContent = T('conflict_use_theirs');
      const b2 = document.createElement('button'); b2.className = 'settings-api-test'; b2.dataset.pick = 'mine'; b2.style.marginLeft = '6px';
      b2.textContent = T('conflict_keep_mine');
      for (const b of [b1, b2]) b.addEventListener('click', (e) => { e.stopPropagation(); cs.resolveConflict(c.key, b.dataset.pick); });
      row.append(head, mine, theirs, b1, b2);
      pop.appendChild(row);
    }
    pop.style.display = '';
  }

  document.addEventListener('click', (e) => {
    if (!_open) return;
    const pop = document.getElementById('collab-conflict-pop');
    if (pop && pop.contains(e.target)) return;
    _open = false; render();
  });

  window.CollabConflictUI = Object.freeze({ render, isOpen: () => _open, open: () => { _open = true; render(); } });
})();
