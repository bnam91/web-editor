/* ══════════════════════════════════════════════════════════════════════════
   version-history.js — 버전/백업 히스토리의 «데이터 계층». 설계: _context/DESIGN-version-history.md §6~§7
   ───────────────────────────────────────────────────────────────────────────
   ★U3 단계에서는 «행 모델»까지만 만든다. 진입점 마크업·모달 DOM 은 현빈 Q1(진입점) 답 뒤에 붙는다.
     그래서 이 파일에는 document 접근이 «없다» — 순수 함수만 있고 그래서 전부 단위테스트가 된다.

   ★행 하나가 답해야 하는 질문은 「이 버전에 내가 잃은 게 살아 있나」다(§1).
     그래서 lost 를 앞세우고, 숫자(섹션·블록·이미지·용량·시각)를 같이 준다 —
     「사고 직전엔 섹션이 24개였는데 지금 21개」가 한 줄에 보이면 그것만으로 답이 나온다.

   ★정직 규약(P-1)
     · pending(아직 안 읽은 대형 레거시)은 숫자를 «지어내지 않는다» → counts=null, sectionsText='—'
     · canon:0(옛 형식)은 그렇게 표시한다
     · 손실 0 이면 손실 줄을 아예 안 그린다(노이즈 제거) → lostText=''
═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const KB = 1024, MB = KB * 1024;

  /** 「3시간 전」 — commit-system.js:69 _formatTimeAgo 와 «같은 말투»를 쓴다(앱 안에서 표기가 갈리면 안 된다). */
  function formatTimeAgo(ts, now) {
    const base = now == null ? Date.now() : now;
    const diff = base - new Date(ts).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 0)  return '방금 전';
    if (m < 1)  return '방금 전';
    if (m < 60) return `${m}분 전`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}시간 전`;
    const d = Math.floor(h / 24);
    if (d < 8)  return `${d}일 전`;
    return new Date(ts).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
  }

  /** 「오늘 14:22」 / 「어제 09:05」 / 「8월 12일 09:05」 — 복구는 «시각»으로 찾는다. */
  function formatWhen(ts, now) {
    const d = new Date(ts);
    const hh = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    const base = new Date(now == null ? Date.now() : now);
    const day = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const gap = Math.round((day(base) - day(d)) / 86400000);
    if (gap === 0) return `오늘 ${hh}`;
    if (gap === 1) return `어제 ${hh}`;
    return `${d.getMonth() + 1}월 ${d.getDate()}일 ${hh}`;
  }

  function formatBytes(n) {
    if (!n || n < 0) return '—';
    if (n < KB) return `${n}B`;
    if (n < MB) return `${(n / KB).toFixed(0)}KB`;
    // ★소수점을 버리지 않는다 — 「40MB vs 40MB」로 보이면 어느 버전이 더 큰지 못 고른다.
    return `${(n / MB).toFixed(n < 10 * MB ? 2 : 1)}MB`;
  }

  function _lossDiff(entrySecs, currentSecs) {
    const V = (typeof window !== 'undefined' && window.versionDiff) || null;
    if (V && typeof V.lossDiff === 'function') return V.lossDiff(entrySecs, currentSecs);
    // version-diff.js 가 없으면 «손실 없음»이 아니라 «모름»이다 — 0 으로 답하면 거짓 안심을 준다.
    return null;
  }

  /**
   * 목록 응답 → 화면 행 모델.
   * @param {{ok:boolean,current:object|null,entries:object[],legacyCount:number,pendingCount:number}} list
   *        main 의 projects:history-list 응답 그대로.
   * @param {{now?:number}} [opts]
   * @returns {{ok:boolean, currentRow:object|null, rows:object[], legacyCount:number, pendingCount:number, totalText:string}}
   */
  function buildRows(list, opts) {
    const o = opts || {};
    const now = o.now == null ? Date.now() : o.now;
    if (!list || list.ok !== true) {
      return { ok: false, reason: (list && list.reason) || 'unavailable', currentRow: null, rows: [],
               legacyCount: 0, pendingCount: 0, totalText: '—' };
    }
    const cur = list.current || null;
    const curSecs = (cur && cur.secs) || [];

    const currentRow = cur ? {
      isCurrent: true, ts: cur.ts || now,
      whenText: '지금', agoText: '',
      counts: cur.counts || null,
      sectionsText: cur.counts ? String(cur.counts.sections) : '—',
      blocksText:   cur.counts ? String(cur.counts.blocks)   : '—',
      imagesText:   cur.counts ? String(cur.counts.images)   : '—',
      sizeText: formatBytes(cur.bytes),
      lost: [], lostText: '', pending: false, legacy: false, pinned: false, reason: 'current',
    } : null;

    const rows = (list.entries || []).map((e) => {
      const loss = e.pending ? null : _lossDiff(e.secs || [], curSecs);
      return {
        isCurrent: false,
        ts: e.ts,
        file: e.file,
        whenText: formatWhen(e.ts, now),
        agoText: formatTimeAgo(e.ts, now),
        counts: e.counts || null,
        sectionsText: e.counts ? String(e.counts.sections) : '—',
        blocksText:   e.counts ? String(e.counts.blocks)   : '—',
        imagesText:   e.counts ? String(e.counts.images)   : '—',
        sizeText: formatBytes(e.bytes),
        // ★헤드라인 — 이 버전엔 있는데 지금은 없는 섹션
        lost: (loss && loss.lost) || [],
        lostText: formatLossText(loss, e),
        gainedCount: (loss && loss.gained && loss.gained.length) || 0,
        pending: e.pending === true,
        legacy: e.canon === 0,
        approx: e.approx === true,
        pinned: e.pinned === true,
        reason: e.reason || 'auto',
        badgeText: badgeFor(e),
      };
    });

    return {
      ok: true, currentRow, rows,
      legacyCount: list.legacyCount || 0,
      pendingCount: list.pendingCount || 0,
      totalText: formatBytes(list.totalBytes),
    };
  }

  /** 손실 요약 한 줄. ★모르면 «0»이 아니라 «모름»이라고 말한다(거짓 안심 금지). */
  function formatLossText(loss, entry) {
    if (entry && entry.pending) return '아직 분석 안 함';
    if (!loss) return '비교 불가';
    const n = (loss.lost || []).length;
    if (n === 0) return '';
    const names = loss.lost.slice(0, 3).map(s => s.n).join(' · ');
    return n <= 3 ? `지금은 없는 섹션 ${n} — ${names}` : `지금은 없는 섹션 ${n} — ${names} 외 ${n - 3}`;
  }

  /** 행에 붙는 상태 배지. 없으면 빈 문자열(배지를 억지로 만들지 않는다). */
  function badgeFor(e) {
    if (!e) return '';
    if (e.reason === 'pre-restore') return '되돌리기 직전';
    if (e.reason === 'manual') return '수동';
    if (e.pending) return '옛 형식 · 미분석';
    if (e.canon === 0) return '옛 형식';
    return '';
  }

  const api = { buildRows, formatWhen, formatTimeAgo, formatBytes, formatLossText, badgeFor };
  if (typeof window !== 'undefined') window.versionHistory = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api; // 단위테스트용
})();
