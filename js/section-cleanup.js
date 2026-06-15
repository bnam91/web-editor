// section-cleanup.js — 섹션 잔재(빈 row/frame + 연속 gap + 과도한 첫/끝 gap) 청소 유틸.
// orchestrator rebuild가 남기는 잔재를 일괄 정리하기 위함.
// 노출: window.cleanupSection(secId, opts), window.cleanupAllSections(secIdArray, opts)
(function () {
  function cleanupSection(secId, opts) {
    opts = opts || {};
    const topGapMax = opts.topGapMax || 80;
    const midGapMax = opts.midGapMax || 80;
    const bottomGapMax = opts.bottomGapMax || 80;

    const sec = document.getElementById(secId);
    if (!sec) return { secId, ok: false, error: 'not_found' };
    const inner = sec.querySelector(':scope > .section-inner');
    if (!inner) return { secId, ok: false, error: 'no_inner' };
    const log = [];

    // 빈 컨테이너 판정 — 자식 갯수 무관, 실제 콘텐츠(텍스트/img/svg/bgImage) 0이면 빈으로 처리
    const hasBgImg = (el) => /url\(/.test(el.style.backgroundImage || '');
    const isEmptyContainer = (el) => {
      if (!el.classList.contains('row') && !el.classList.contains('frame-block')) return false;
      const txt = (el.textContent || '').trim();
      if (txt) return false;
      // 의도적 빈 줄(data-blank) 텍스트블럭은 비어 보여도 사용자 콘텐츠 → 정리 대상에서 제외
      if (el.querySelector('[data-blank="true"]')) return false;
      if (el.querySelector('img, svg')) return false;
      // bg image — 자기 자신 + 모든 자손 검사
      if (hasBgImg(el)) return false;
      for (const d of el.querySelectorAll('[style]')) {
        if (hasBgImg(d)) return false;
      }
      return true;
    };

    let changed = true;
    while (changed) {
      changed = false;
      for (const c of [...inner.children]) {
        if (isEmptyContainer(c)) {
          log.push('rm empty: ' + c.id);
          if (typeof window.deleteBlock === 'function') window.deleteBlock(c.id);
          else c.remove();
          changed = true;
          break;
        }
      }
    }

    changed = true;
    while (changed) {
      changed = false;
      const kids = [...inner.children];
      for (let i = 1; i < kids.length; i++) {
        const prev = kids[i - 1], cur = kids[i];
        if (prev.classList.contains('gap-block') && cur.classList.contains('gap-block')) {
          const ph = parseInt(prev.style.height) || prev.offsetHeight || 0;
          const ch = parseInt(cur.style.height) || cur.offsetHeight || 0;
          prev.style.height = Math.min(midGapMax, ph + ch) + 'px';
          log.push('merge ' + prev.id + ' + ' + cur.id);
          if (typeof window.deleteBlock === 'function') window.deleteBlock(cur.id);
          else cur.remove();
          changed = true;
          break;
        }
      }
    }

    const first = inner.firstElementChild;
    const last = inner.lastElementChild;
    if (first && first.classList.contains('gap-block')) {
      const h = parseInt(first.style.height) || first.offsetHeight || 0;
      if (h > topGapMax) {
        first.style.height = topGapMax + 'px';
        log.push('cap first ' + first.id + ' -> ' + topGapMax);
      }
    }
    if (last && last.classList.contains('gap-block') && last !== first) {
      const h = parseInt(last.style.height) || last.offsetHeight || 0;
      if (h > bottomGapMax) {
        last.style.height = bottomGapMax + 'px';
        log.push('cap last ' + last.id + ' -> ' + bottomGapMax);
      }
    }

    try { window.triggerAutoSave?.() || window.scheduleAutoSave?.(); } catch (_) {}
    return { secId, ok: true, log, remaining: inner.children.length };
  }

  function cleanupAllSections(secIds, opts) {
    return (secIds || []).map(id => cleanupSection(id, opts));
  }

  window.cleanupSection = cleanupSection;
  window.cleanupAllSections = cleanupAllSections;
})();
