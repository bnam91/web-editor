/* ═══════════════════════════════════════════════════════════════════════════
   collab/presence-ui.js — 「상대가 이 섹션을 편집 중」을 섹션 «위»에 그린다 (SIX ② · 2026-10-06 지디).
   ───────────────────────────────────────────────────────────────────────────
   ★배선은 이미 있었다: 서버 pull 응답 presence[].editingSectionId 를 sync.js paintPresence 가 받는다 — 상단바 한 줄만 그렸다.
     실측(2026-10-06): 상단바 「1명 편집 중」 · title 「secX 편집 중」(id 원문) · 섹션 자체엔 표시 0.
   ⇒ 부딪히기 «전»에 피하게, 그 섹션 둘레에 점선 상자 + 「누구 · 편집 중」 꼬리표를 띄운다.
   ★캔버스 «밖» 고정 층(#collab-presence-layer · pointer-events:none)에 그린다 — 섹션 DOM 에 넣으면 저장본에 섞인다.
   ★다시 그리는 때: sync.js paintPresence(2초 폴링마다) · 스크롤·창 크기(마지막 목록으로 자리만 다시).
   ⚠️고전 스크립트 · sync.js paintPresence 가 부른다(window.CollabPresenceUI.paint).
═══════════════════════════════════════════════════════════════════════════ */
(function () {
  const T = (k) => (window.CollabReasons ? window.CollabReasons.text(k) : k);
  let _last = [];

  function layer() {
    let el = document.getElementById('collab-presence-layer');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'collab-presence-layer';
    el.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;pointer-events:none;z-index:2147482000;';
    document.body.appendChild(el);
    return el;
  }

  function paint(list) {
    _last = Array.isArray(list) ? list : [];
    const L = layer();
    L.innerHTML = '';
    const canvas = document.getElementById('canvas');
    for (const p of _last) {
      const sec = p && p.editingSectionId ? document.getElementById(p.editingSectionId) : null;
      if (!sec || !canvas || !canvas.contains(sec)) continue;   // 다른 페이지·없는 섹션은 그릴 자리가 없다(상단바 title 이 말한다)
      const r = sec.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      const box = document.createElement('div');
      box.className = 'collab-presence-box';
      box.dataset.sectionId = sec.id;
      box.style.cssText = `position:fixed;left:${Math.round(r.left)}px;top:${Math.round(r.top)}px;width:${Math.round(r.width)}px;height:${Math.round(r.height)}px;`
        + 'border:2px dashed #ff9a3c;border-radius:4px;box-sizing:border-box;';
      const tag = document.createElement('div');
      tag.className = 'collab-presence-tag';
      tag.style.cssText = 'position:absolute;left:0;top:-22px;padding:2px 6px;background:#ff9a3c;color:#111;font-size:11px;border-radius:3px;white-space:nowrap;';
      tag.textContent = `${p.email || p.actorId || ''} · ${T('editing_by')}`;
      box.appendChild(tag);
      L.appendChild(box);
    }
  }

  const repaint = () => { if (_last.length) paint(_last); };
  window.addEventListener('scroll', repaint, true);
  window.addEventListener('resize', repaint);

  window.CollabPresenceUI = Object.freeze({ paint, last: () => _last.slice() });
})();
