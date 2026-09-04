/* ── Duo(다단) 블록 프로퍼티 패널 ──
   구조(컬럼/라인 추가·삭제)는 CDP/updateDuoBlock 영역 — 패널은 텍스트·간격·정렬만 다룬다. */
import { propPanel } from '../globals.js';
import { parseRatio, buildGridPicker } from './_helpers.js';

/* ── 컬럼 «비율» UI ────────────────────────────────────────────────────────
 * 렌더러(duo-block.js)는 이미 임의 비율을 지원한다 — 각 컬럼에 flex:(w/총합*100).
 * ★2026-09-04 P0: 슬라이더(2열 20~80 클램프 / 3열 칸별 슬라이더) → 테이블식 `1:1:1` 텍스트
 *   + 「균등」 버튼으로 교체(현빈 지시). 파서는 prop-table.js `_applyColRatio`에서 뽑아온
 *   parseRatio(_helpers.js)를 공용으로 쓴다(복붙 금지) — 부족 1 패딩·초과 자름 규칙 동일.
 * ⛔px width 를 직접 쓰지 말 것 — flex 가중치를 유지해야 폭 계산 함정에 새로 노출되지 않는다.
 * ⛔20~80 클램프도 제거됐다 — 텍스트 입력은 `9:1`도 허용한다(테이블도 그렇다). */
function _ratioRowHtml(cols) {
  if (cols.length < 2) return '';
  /* ★소수 비율(예: 0.5:1.5)을 «있는 그대로» 보여준다.
   * 이전엔 Math.max(1, …) 라 0.5 가 1 로 뭉개져, 패널을 다시 열면 1:1 로 «거짓 표시»됐다.
   * 값은 살아 있는데 화면만 틀리는 종류라 사용자가 「안 먹었다」고 읽는다.
   * 표시는 소수 2자리까지, 정수면 정수로(1.00 이 아니라 1). */
  const curRatioStr = cols.map(c => {
    const n = Number(c.width);
    const v = Number.isFinite(n) && n > 0 ? n : 1;
    return Number.isInteger(v) ? String(v) : String(+v.toFixed(2));
  }).join(':');
  return `
      <div class="prop-row">
        <span class="prop-label">비율</span>
        <input type="text" class="prop-input" id="grd-col-ratio" placeholder="1:1:1" value="${curRatioStr}" style="flex:1 1 0;min-width:0;font-size:11px;height:24px;background:#1a1a1a;color:#e5e5e5;border:1px solid #333;border-radius:4px;padding:0 8px;">
        <button id="grd-col-ratio-reset" style="height:24px;flex:0 0 auto;padding:0 10px;font-size:11px;white-space:nowrap;background:#262626;color:#e5e5e5;border:1px solid #333;border-radius:4px;cursor:pointer;line-height:1;box-sizing:border-box;">균등</button>
      </div>
      <div class="prop-hint">예: 1:1:2 → 25/25/50%</div>`;
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
          <span class="prop-block-name">${block.dataset.layerName || 'Grid Block'}</span>
          <span class="prop-breadcrumb">${window.getBlockBreadcrumb ? window.getBlockBreadcrumb(block) : ''}</span>
        </div>
        ${block.id ? `<span class="prop-block-id" title="클릭하여 복사" onclick="_copyToClipboard('${block.id}')">${block.id}</span>` : ''}
      </div>
    </div>
    <div class="prop-section">
      <div class="prop-section-title">Grid (${cols.length}×1)</div>
      <div class="grid-picker" id="grd-grid-picker"></div>
      <div class="grid-picker-label" id="grd-grid-picker-label">—</div>
      <div class="prop-hint" style="margin-top:2px;">가로 칸 수를 고른다 · 세로(행)는 다음 단계</div>
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
      <div class="prop-row"><span class="prop-label" style="opacity:.6">라인 구조 변경은 updateGridBlock API 사용</span></div>
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

  /* ── 비율 배선 — «change» 시점에만 커밋(blur/Enter) ── */
  /* ⚠️updateDuoBlock 을 매 입력마다 부르지 않는다 — 성공하면 showDuoProperties 를 다시 불러
   *   패널을 통째로 새로 그린다. 입력 중(각 keystroke)에 재호출하면 포커스가 든 input DOM 이
   *   교체돼 타이핑이 끊긴다. 바로 위 gap 슬라이더가 같은 이유로 dataset 직접 쓰기를 택했다 —
   *   여기서도 «change»(blur/Enter) 시점에만 dataset 을 커밋하고 패널은 다시 그리지 않는다.
   *   (검증은 여기서 한다 — 컬럼 2~4개, width 는 양수) */
  const _commitCols = (next) => {
    /* ★상한은 duo-block.js 의 클램프와 «같은 값»이어야 한다(2~4).
     * P0 에서 duo-block.js 세 자리(44 렌더 / 170 생성 / 214 검증)를 4 로 올리면서
     * «여기 하나»를 놓쳤다 — 그래서 4열 그리드에서 비율 입력이 조용히 무시됐다.
     * (P2 워커가 코드에서 발견 → 지디 실기 재현: 4열에 1:2:3:4 를 넣어도 [1,2,3,1] 유지)
     * ⚠️이 레포의 고질이다 — 열거 자리가 흩어져 있어 한 곳만 고치면 «절반만» 고쳐진다. */
    if (!Array.isArray(next) || next.length < 2 || next.length > 4) return false;
    next.forEach(c => { const n = Number(c.width); c.width = Number.isFinite(n) && n > 0 ? n : 1; });
    block.dataset.cols = JSON.stringify(next);
    window.renderDuoBlock?.(block);
    return true;
  };
  /* ── 4×4 그리드 피커 — 가로 칸 수 변경 (현빈 발주 ①) ──────────────────────
   * 카드블럭과 «같은» UI 를 쓴다(공용 buildGridPicker). 행 축은 아직 없어 maxRows=1 —
   * 못 만드는 조합을 «죽은 칸»으로 보여주는 게, 눌러도 아무 일 없는 것보다 정직하다. */
  buildGridPicker(
    document.getElementById('grd-grid-picker'),
    document.getElementById('grd-grid-picker-label'),
    (nCols) => {
      const cur = JSON.parse(block.dataset.cols || '[]');
      if (nCols === cur.length) return;
      window.pushHistory?.();                     // ★변경 «전»에
      const next = [];
      for (let i = 0; i < nCols; i++) {
        next.push(cur[i] || { width: 1, lines: [{ type: 'h2', text: '제목' }, { type: 'body', text: '내용을 입력하세요.' }] });
      }
      // ⛔줄일 때 잘린 칸의 내용은 «버려진다» — undo 로 되돌아온다(pushHistory 를 먼저 부른 이유).
      block.dataset.cols = JSON.stringify(next);
      window.renderDuoBlock?.(block);
      window.scheduleAutoSave?.();
      showDuoProperties(block);                   // 패널 재생성(칸 수가 바뀌면 Column 섹션도 바뀐다)
    },
    { max: 4, maxRows: 1 }
  );

  const ratioInput = document.getElementById('grd-col-ratio');
  const _applyRatioInput = (raw) => {
    const cur = JSON.parse(block.dataset.cols || '[]');
    if (!cur.length) return;
    const parts = parseRatio(raw, cur.length);   // prop-table.js 와 공유 — 부족 1 패딩·초과 자름
    parts.forEach((w, i) => { if (cur[i]) cur[i].width = w; });
    _commitCols(cur);
    if (ratioInput) ratioInput.value = parts.join(':');   // 정규화 결과로 되씀(테이블과 동일 패턴)
  };
  ratioInput?.addEventListener('change', e => {
    _applyRatioInput(e.target.value);
    window.pushHistory?.();
    window.scheduleAutoSave?.();
  });
  document.getElementById('grd-col-ratio-reset')?.addEventListener('click', () => {
    const cur = JSON.parse(block.dataset.cols || '[]');
    const equal = Array(cur.length).fill(1).join(':');
    _applyRatioInput(equal);
    window.pushHistory?.();
    window.scheduleAutoSave?.();
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
// ★2026-09-04 P0: 「그리드 블럭」 별칭(발주 ②) — DOM 정체성은 그대로다(위 duo-block.js 별칭과 동반).
window.showGridProperties = showDuoProperties;
