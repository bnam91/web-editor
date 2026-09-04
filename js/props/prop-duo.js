/* ── Duo(다단) 블록 프로퍼티 패널 ──
   구조(컬럼/라인 추가·삭제)는 CDP/updateDuoBlock 영역 — 패널은 텍스트·간격·정렬만 다룬다. */
import { propPanel } from '../globals.js';

/* ── 컬럼 «비율» UI ────────────────────────────────────────────────────────
 * 렌더러(duo-block.js)는 이미 임의 비율을 지원한다 — 각 컬럼에 flex:(w/총합*100).
 * 즉 없던 것은 «엔진»이 아니라 «슬라이더 하나»였다. 여기서 그것만 채운다.
 * ⛔px width 를 직접 쓰지 말 것 — flex 가중치를 유지해야 폭 계산 함정에 새로 노출되지 않는다. */
function _ratioRowHtml(cols) {
  const n = cols.length;
  if (n < 2) return '';
  const w = cols.map(c => Math.max(1, Number(c.width) || 1));
  const sum = w.reduce((a, b) => a + b, 0);
  const pct = w.map(v => Math.round(v / sum * 100));
  if (n === 2) {
    // 두 칸이면 «하나의» 슬라이더가 직관적이다 — 왼쪽이 차지하는 비율.
    return `
      <div class="prop-row">
        <span class="prop-label">비율</span>
        <input type="range" class="prop-slider" id="duo-ratio-slider" min="20" max="80" step="5" value="${pct[0]}">
        <input type="number" class="prop-number" id="duo-ratio-number" min="20" max="80" step="5" value="${pct[0]}">
      </div>
      <div class="prop-row">
        <span class="prop-label" style="opacity:.6">좌 : 우</span>
        <span class="prop-label" id="duo-ratio-readout" style="opacity:.8">${pct[0]} : ${100 - pct[0]}</span>
      </div>`;
  }
  // 세 칸이면 칸마다 «가중치» 슬라이더 + 환산 %를 같이 보여준다.
  return cols.map((c, i) => `
      <div class="prop-row">
        <span class="prop-label">${i + 1}번 폭</span>
        <input type="range" class="prop-slider duo-w-slider" data-col="${i}" min="1" max="8" step="1" value="${w[i]}">
        <span class="prop-label duo-w-pct" data-col="${i}" style="opacity:.8;min-width:34px;text-align:right">${pct[i]}%</span>
      </div>`).join('');
}

export function showDuoProperties(block) {
  let cols = [];
  try { cols = JSON.parse(block.dataset.cols || '[]'); } catch (_) {}
  // ★`parseInt(...) || 24` 금지 — 간격 0 이 «유효값»인데 폴백에 삼켜져 패널이 24 로 되살려 보여줬다.
  const _g = parseInt(block.dataset.gap);
  const gap = Number.isFinite(_g) ? _g : 24;
  const valign = block.dataset.valign || 'top';
  // 가로 정렬은 컬럼 모델(col.align)에 산다. 컬럼마다 다르면(혼합) 어느 버튼도 active 로 켜지 않는다.
  const _aligns = cols.map(c => c.align || 'left');
  const halign = (_aligns.length && _aligns.every(a => a === _aligns[0])) ? _aligns[0] : '';

  const _esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  propPanel.innerHTML = `
    <div class="prop-section">
      <div class="prop-block-label">
        <div class="prop-block-icon">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#888" stroke-width="1.3">
            <rect x="1" y="2" width="4.5" height="8" rx="1"/><rect x="6.5" y="2" width="4.5" height="8" rx="1"/>
          </svg>
        </div>
        <div class="prop-block-info">
          <span class="prop-block-name">${block.dataset.layerName || 'Duo Block'}</span>
          <span class="prop-breadcrumb">${window.getBlockBreadcrumb ? window.getBlockBreadcrumb(block) : ''}</span>
        </div>
        ${block.id ? `<span class="prop-block-id" title="클릭하여 복사" onclick="_copyToClipboard('${block.id}')">${block.id}</span>` : ''}
      </div>
    </div>
    <div class="prop-section">
      <div class="prop-section-title">Layout</div>
      <div class="prop-row">
        <span class="prop-label">간격</span>
        <input type="range" class="prop-slider" id="duo-gap-slider" min="0" max="120" step="4" value="${gap}">
        <input type="number" class="prop-number" id="duo-gap-number" min="0" max="120" value="${gap}">
      </div>
      ${_ratioRowHtml(cols)}
      <div class="prop-row">
        <span class="prop-label">가로 정렬</span>
        <div class="prop-align-group" id="duo-halign-group">
          <button class="prop-align-btn${halign === 'left' ? ' active' : ''}"   data-ha="left"   title="왼쪽 정렬">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3"><line x1="1" y1="2" x2="1" y2="12"/><rect x="3" y="4" width="5" height="6" rx="1"/></svg>
          </button>
          <button class="prop-align-btn${halign === 'center' ? ' active' : ''}" data-ha="center" title="가운데 정렬">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3"><line x1="7" y1="2" x2="7" y2="12"/><rect x="3" y="4" width="8" height="6" rx="1"/></svg>
          </button>
          <button class="prop-align-btn${halign === 'right' ? ' active' : ''}"  data-ha="right"  title="오른쪽 정렬">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3"><line x1="13" y1="2" x2="13" y2="12"/><rect x="6" y="4" width="5" height="6" rx="1"/></svg>
          </button>
        </div>
      </div>
      <div class="prop-row">
        <span class="prop-label">세로 정렬</span>
        <div class="prop-align-group" id="duo-valign-group">
          <button class="prop-align-btn${valign === 'top' ? ' active' : ''}"    data-va="top"    title="상단 정렬">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3"><line x1="2" y1="1" x2="12" y2="1"/><rect x="4" y="3" width="6" height="5" rx="1"/></svg>
          </button>
          <button class="prop-align-btn${valign === 'middle' ? ' active' : ''}" data-va="middle" title="중앙 정렬">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3"><line x1="2" y1="7" x2="12" y2="7"/><rect x="4" y="3" width="6" height="8" rx="1"/></svg>
          </button>
          <button class="prop-align-btn${valign === 'bottom' ? ' active' : ''}" data-va="bottom" title="하단 정렬">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3"><line x1="2" y1="13" x2="12" y2="13"/><rect x="4" y="6" width="6" height="5" rx="1"/></svg>
          </button>
        </div>
      </div>
      <div class="prop-hint" style="margin-top:2px;">세로 정렬은 컬럼 높이가 서로 다를 때만 움직인다</div>
    </div>
    ${cols.map((col, ci) => `
    <div class="prop-section">
      <div class="prop-section-title">Column ${ci + 1}</div>
      ${(Array.isArray(col.lines) ? col.lines : []).map((l, li) =>
        (l.type === 'image' || l.type === 'gap') ? '' : `
      <div class="prop-row">
        <span class="prop-label">${_esc(l.type || 'body')}</span>
        <input type="text" class="prop-input duo-line-input" data-col="${ci}" data-line="${li}" value="${_esc(l.text || '')}" style="flex:1;min-width:0">
      </div>`).join('')}
    </div>`).join('')}
    <div class="prop-section">
      <div class="prop-row"><span class="prop-label" style="opacity:.6">컬럼 «개수»·라인 구조 변경은 updateDuoBlock API 사용 (비율은 위 슬라이더)</span></div>
    </div>`;

  if (window.setRpIdBadge) window.setRpIdBadge(block.id || null);

  const gapS = document.getElementById('duo-gap-slider');
  const gapN = document.getElementById('duo-gap-number');
  const applyGap = (v) => {
    v = Math.min(120, Math.max(0, v || 0));
    block.dataset.gap = String(v);
    window.renderDuoBlock?.(block);
    gapS.value = v; gapN.value = v;
  };
  gapS.addEventListener('input', () => applyGap(parseInt(gapS.value)));
  gapS.addEventListener('change', () => { window.pushHistory?.(); window.scheduleAutoSave?.(); });
  gapN.addEventListener('change', () => { applyGap(parseInt(gapN.value)); window.pushHistory?.(); window.scheduleAutoSave?.(); });

  /* ── 비율 배선 — updateDuoBlock(validate-then-commit + rollback)만 거친다 ── */
  /* ⚠️updateDuoBlock 을 «쓰지 않는다» — 성공하면 showDuoProperties 를 다시 불러
   *   패널을 통째로 새로 그린다. 드래그 중이면 슬라이더 DOM 이 교체돼 드래그가 끊긴다.
   *   바로 위 gap 슬라이더가 같은 이유로 dataset 직접 쓰기를 택했다. 같은 패턴을 따른다.
   *   (검증은 여기서 한다 — 컬럼 2~3개, width 는 양수) */
  const _commitCols = (next) => {
    if (!Array.isArray(next) || next.length < 2 || next.length > 3) return false;
    next.forEach(c => { const n = Number(c.width); c.width = Number.isFinite(n) && n > 0 ? n : 1; });
    block.dataset.cols = JSON.stringify(next);
    window.renderDuoBlock?.(block);
    return true;
  };
  const ratioS = document.getElementById('duo-ratio-slider');
  const ratioN = document.getElementById('duo-ratio-number');
  if (ratioS && ratioN) {
    const applyRatio = (p) => {
      p = Math.min(80, Math.max(20, Math.round((p || 50) / 5) * 5));
      const cur = JSON.parse(block.dataset.cols || '[]');
      if (cur.length !== 2) return;
      cur[0].width = p; cur[1].width = 100 - p;   // 가중치라 합이 100일 필요는 없지만 읽기 쉽다
      _commitCols(cur);
      ratioS.value = p; ratioN.value = p;
      const ro = document.getElementById('duo-ratio-readout');
      if (ro) ro.textContent = `${p} : ${100 - p}`;
    };
    ratioS.addEventListener('input', () => applyRatio(parseInt(ratioS.value)));
    ratioS.addEventListener('change', () => { window.pushHistory?.(); window.scheduleAutoSave?.(); });
    ratioN.addEventListener('change', () => { applyRatio(parseInt(ratioN.value)); window.pushHistory?.(); window.scheduleAutoSave?.(); });
  }
  propPanel.querySelectorAll('.duo-w-slider').forEach(sl => {
    const applyW = () => {
      const cur = JSON.parse(block.dataset.cols || '[]');
      const i = parseInt(sl.dataset.col);
      if (!cur[i]) return;
      cur[i].width = Math.min(8, Math.max(1, parseInt(sl.value) || 1));
      _commitCols(cur);
      const tot = cur.reduce((a, c) => a + (Number(c.width) || 1), 0);
      propPanel.querySelectorAll('.duo-w-pct').forEach(el => {
        const j = parseInt(el.dataset.col);
        if (cur[j]) el.textContent = Math.round((Number(cur[j].width) || 1) / tot * 100) + '%';
      });
    };
    sl.addEventListener('input', applyW);
    sl.addEventListener('change', () => { window.pushHistory?.(); window.scheduleAutoSave?.(); });
  });

  propPanel.querySelectorAll('[data-va]').forEach(btn => btn.addEventListener('click', () => {
    block.dataset.valign = btn.dataset.va;
    window.renderDuoBlock?.(block);
    window.pushHistory?.(); window.scheduleAutoSave?.();
    showDuoProperties(block);
  }));

  // 가로 정렬 — 컬럼 단위(col.align)로 일괄 적용.
  // ★라인의 line.align 은 렌더러에서 col.align 을 «가린다»(_duoLineHtml: line.align || colAlign).
  //   실제 저장본 실측(147줄 중 17줄)에서 그 라인들만 안 움직여 «절반만 먹는» 정렬이 된다 →
  //   컬럼 레벨 일괄 지시일 때는 라인 오버라이드를 걷어내 컬럼을 단일 진실원으로 만든다(undo 가능).
  propPanel.querySelectorAll('[data-ha]').forEach(btn => btn.addEventListener('click', () => {
    try {
      const c = JSON.parse(block.dataset.cols || '[]');
      if (!Array.isArray(c) || !c.length) return;
      c.forEach(col => {
        col.align = btn.dataset.ha;
        if (Array.isArray(col.lines)) col.lines.forEach(l => { if (l && typeof l === 'object') delete l.align; });
      });
      block.dataset.cols = JSON.stringify(c);
      window.renderDuoBlock?.(block);
      window.pushHistory?.(); window.scheduleAutoSave?.();
      showDuoProperties(block);
    } catch (_) {}
  }));

  propPanel.querySelectorAll('.duo-line-input').forEach(inp => {
    inp.addEventListener('input', () => {
      try {
        const c = JSON.parse(block.dataset.cols || '[]');
        const l = c[+inp.dataset.col]?.lines?.[+inp.dataset.line];
        if (l) { l.text = inp.value; block.dataset.cols = JSON.stringify(c); window.renderDuoBlock?.(block); }
      } catch (_) {}
    });
    inp.addEventListener('change', () => { window.pushHistory?.(); window.scheduleAutoSave?.(); });
  });
}

window.showDuoProperties = showDuoProperties;
