/* ── Grid(다단) 블록 프로퍼티 패널 ──
   구조(컬럼/라인 추가·삭제)는 CDP/updateGridBlock 영역 — 패널은 간격·정렬·행 높이만 다룬다(P1.5: 글자는 캔버스 인라인 편집 — js/block-drag.js). */
import { propPanel } from '../globals.js';
import { parseRatio, buildGridPicker } from './_helpers.js';
import { ROW_H_MAX } from '../grid-cell-resize.js';   // ★상한은 한 곳에서만 온다
import { gridRows, MIN_COLS, MAX_COLS, MIN_ROWS, MAX_ROWS } from '../blocks/grid-block.js';
import { showGridGutters, hideGridGutters } from '../overlay-handles.js';

/* ── 컬럼 «비율» UI ────────────────────────────────────────────────────────
 * 렌더러(grid-block.js)는 이미 임의 비율을 지원한다 — 각 컬럼에 flex:(w/총합*100).
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

/* ── 행 «높이» UI ──────────────────────────────────────────────────────────
 * ★2026-09-04 P1: 열은 «비율»(가중치)이지만 행은 «px 최소높이»다(PLAN §3-A, 테이블
 *   U5a 와 같은 의미론) — 그래서 열처럼 `1:1:1` 합성 비율 입력을 쓰지 않고, 테이블의
 *   행별 높이 입력(prop-table.js `.tbl-rowh-item-row`)과 같은 마크업으로 «행마다 하나씩» 받는다.
 * rows 가 1개(옛 파일과 동일 상태)면 아예 렌더하지 않는다 — 「비율은 있는데 높이는 없다」는
 *   행 개념이 아직 없다는 뜻이라 보여줄 게 없다(PLAN §4 "행이 생기면 …rows>1일 때만 노출"). */
function _rowHeightHtml(rows) {
  if (rows.length < 2) return '';
  const items = rows.map((r, ri) => `
      <div class="grd-rowh-item-row" style="display:flex;align-items:center;gap:6px;">
        <span class="prop-sublabel" style="width:40px;font-size:11px;color:#888;">행 ${ri + 1}</span>
        <input type="number" class="prop-number grd-row-h-item" data-ri="${ri}" min="0" max="${ROW_H_MAX}"
               placeholder="auto" value="${r.height === 'auto' ? '' : r.height}" title="이 행 높이(px). 비우면 자동" style="width:70px;">
      </div>`).join('');
  return `
      <div class="prop-row" style="align-items:flex-start;">
        <span class="prop-label" style="padding-top:4px;">행 높이</span>
        <div class="grd-rowh-list" style="display:flex;flex-direction:column;gap:4px;flex:1;">${items}</div>
      </div>
      <div class="prop-hint">비우면 자동(내용 높이) · 값은 «최소» 높이(내용이 더 크면 늘어난다)</div>`;
}

export function showGridProperties(block) {
  let cols = [];
  try { cols = JSON.parse(block.dataset.cols || '[]'); } catch (_) {}
  const rows = gridRows(block);   // 없으면(옛 파일) [{height:'auto'}] 1행 — grid-block.js 승격 로직과 공유
  /* ★2026-09-05 현빈 지시로 「간격」 슬라이더를 패널에서 걷어냈다.
   * ⛔데이터와 렌더러는 «그대로»다 — `block.dataset.gap` 은 계속 살아 있고 grid-block.js 가
   *   읽어서 그린다(기존 프로젝트의 간격 값이 사라지면 안 된다). 없앤 건 «조절 UI» 하나뿐이다.
   * 바꾸려면 updateGridBlock API / MCP 로는 여전히 된다. */
  const valign = block.dataset.valign || 'top';
  // 가로 정렬은 컬럼 모델(col.align)에 산다. 컬럼마다 다르면(혼합) 어느 버튼도 active 로 켜지 않는다.
  const _aligns = cols.map(c => c.align || 'left');
  const halign = (_aligns.length && _aligns.every(a => a === _aligns[0])) ? _aligns[0] : '';

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
      <div class="prop-section-title">Grid (${cols.length}×${rows.length})</div>
      <div class="grid-picker" id="grd-grid-picker"></div>
      <div class="grid-picker-label" id="grd-grid-picker-label">—</div>
      <div class="prop-hint" style="margin-top:2px;">가로×세로 칸 수를 고른다</div>
      <!-- ★적대검수 Q3: 「줄이면 보존」으로 동작을 바꾸는 대신 «사실을 적는다».
           API 경로(grid-block.js)가 이미 «자르고 undo» 정책이라, 피커만 보존하면 정책이 둘로 갈라진다. -->
      <div class="prop-hint" style="margin-top:2px;">줄이면 잘린 칸 내용은 사라진다 (⌘Z 복원)</div>
    </div>
    <div class="prop-section">
      <div class="prop-section-title">Layout</div>
      ${_ratioRowHtml(cols)}
      ${_rowHeightHtml(rows)}
      <div class="prop-row">
        <span class="prop-label">가로 정렬</span>
        <div class="prop-align-group" id="grd-halign-group">
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
        <div class="prop-align-group" id="grd-valign-group">
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
    <div class="prop-section">
      <div class="prop-row"><span class="prop-label" style="opacity:.6">글자는 «캔버스에서 줄을 더블클릭»해 고친다 · 라인 구조(추가·삭제) 변경은 updateGridBlock API 사용</span></div>
    </div>`;

  if (window.setRpIdBadge) window.setRpIdBadge(block.id || null);

  /* ── 비율 배선 — «change» 시점에만 커밋(blur/Enter) ── */
  /* ⚠️updateGridBlock 을 매 입력마다 부르지 않는다 — 성공하면 showGridProperties 를 다시 불러
   *   패널을 통째로 새로 그린다. 입력 중(각 keystroke)에 재호출하면 포커스가 든 input DOM 이
   *   교체돼 타이핑이 끊긴다. (전에 있던 gap 슬라이더도 같은 이유로 dataset 직접 쓰기를 택했었다 —
   *   그 슬라이더는 2026-09-05 에 제거됐다.) 여기서도 «change»(blur/Enter) 시점에만 dataset 을
   *   커밋하고 패널은 다시 그리지 않는다.
   *   (검증은 여기서 한다 — 컬럼 2~4개, width 는 양수) */
  const _commitCols = (next) => {
    /* ★상한은 grid-block.js 의 클램프와 «같은 값»이어야 한다 — MIN_COLS/MAX_COLS 상수를 import 해서
     * «같은 값»을 강제한다(하드코딩 2건 반복 금지). P0 에서 grid-block.js 세 자리(렌더/생성/검증)를
     * 4로 올리면서 «여기 하나»를 놓쳐 4열 그리드 비율 입력이 조용히 무시됐던 사고(2026-09-04
     * fix(grid-p0) 1abfea2)가 있었다 — 이 레포의 고질(열거 자리가 흩어져 있어 한 곳만 고치면
     * «절반만» 고쳐진다)이라 P1에서 아예 상수 import 로 재발을 막는다. */
    if (!Array.isArray(next) || next.length < MIN_COLS || next.length > MAX_COLS) return false;
    next.forEach(c => { const n = Number(c.width); c.width = Number.isFinite(n) && n > 0 ? n : 1; });
    block.dataset.cols = JSON.stringify(next);
    window.renderGridBlock?.(block);
    return true;
  };
  /* ── 4×4 그리드 피커 — 가로×세로 칸 수 변경 (현빈 발주 ①) ─────────────────
   * ★2026-09-04 P1: maxRows 해제 — 이제 진짜 4×4(행 축이 생겼다).
   * 줄일 때 잘린 칸/행의 내용은 pushHistory 로 undo 복원(패널 힌트에도 적어뒀다).
   *
   * ⚠️2026-09-05 정정: 여기 「카드블럭과 «같은» UI 를 쓴다(공용 buildGridPicker)」라고 적혀
   *   있었는데 «거짓» 이었다(적대검수). `_helpers.js` 의 buildGridPicker 를 부르는 곳은
   *   이 파일 «하나» 뿐이고, 카드·월계수·캔버스(prop-simple-card.js · prop-laurel.js ·
   *   prop-canvas.js)는 피커를 통째로 복붙해 각자 갖고 있다.
   *   ⇒ 여기 고친 것이 그쪽에 «안 간다». 피커 동작을 바꿀 땐 그 세 곳을 따로 봐야 한다.
   *   (공용화는 별건 — 지금 묶으면 세 블록의 UX 를 동시에 바꾸는 셈이라 발주가 필요하다.) */
  buildGridPicker(
    document.getElementById('grd-grid-picker'),
    document.getElementById('grd-grid-picker-label'),
    (nCols, nRows) => {
      const curCols = JSON.parse(block.dataset.cols || '[]');
      const curRows = gridRows(block);
      if (nCols === curCols.length && nRows === curRows.length) return;
      window.pushHistory?.();                     // ★변경 «전»에

      const nextCols = [];
      for (let i = 0; i < nCols; i++) {
        nextCols.push(curCols[i] || { width: 1, lines: [{ type: 'h2', text: '제목' }, { type: 'body', text: '내용을 입력하세요.' }] });
      }
      // ⛔줄일 때 잘린 칸의 내용은 «버려진다» — undo 로 되돌아온다(pushHistory 를 먼저 부른 이유).
      block.dataset.cols = JSON.stringify(nextCols);

      if (nRows <= 1) {
        // 1행으로 돌아가면 옛 duo 파일과 «완전히 같은» 모양으로 되돌린다(dataset.rows/cells 제거).
        delete block.dataset.rows;
        delete block.dataset.cells;
      } else {
        const nextRows = [];
        for (let i = 0; i < nRows; i++) nextRows.push(curRows[i] || { height: 'auto' });
        block.dataset.rows = JSON.stringify(nextRows);

        /* ★새로 생긴 행에 «기본 내용»을 넣는다.
         * 안 넣으면 셀이 빈 채로 높이 0 이 되어, 2x2 를 눌러도 «아무 일도 안 일어난 것»처럼 보인다
         * (실측: rows=2 이고 grd-cell 4개가 생겼는데 2행 두 칸 높이가 0px).
         * 1행이 기본 텍스트를 갖는 것과 «같은 대우»여야 사용자가 무엇이 생겼는지 안다.
         * ⚠️정정(적대검수 지적, 2026-09-04): 이 코드는 «옛 내용을 보존하지 않는다».
         *   nextCells 를 새로 만들어 덮으므로 «잘린 행/열의 내용은 사라진다».
         *   내가 앞서 커밋 메시지에 「줄였다 늘려도 옛 내용이 살아 있다」고 썼는데 «거짓»이었다 —
         *   P1 의 「cells 를 그대로 둔다」 설계를 병합에서 모르고 뒤집었다.
         *   복원은 undo 로만 된다(그래서 pushHistory 를 변경 전에 부른다). */
        let curCells = [];
        try { curCells = JSON.parse(block.dataset.cells || '[]'); } catch (_) { curCells = []; }
        const nextCells = [];
        for (let r = 1; r < nRows; r++) {          // index 0 = 1행은 cols[].lines 가 갖는다
          const row = Array.isArray(curCells[r - 1]) ? curCells[r - 1] : [];
          const outRow = [];
          for (let c = 0; c < nCols; c++) {
            outRow.push(row[c] || { lines: [{ type: 'body', text: '내용을 입력하세요.' }] });
          }
          nextCells.push(outRow);
        }
        if (nextCells.length) block.dataset.cells = JSON.stringify(nextCells);
        else delete block.dataset.cells;
      }
      window.renderGridBlock?.(block);
      window.scheduleAutoSave?.();
      /* ★거터를 «명시적으로» 걷고 다시 세운다.
       * showGridProperties 끝에도 showGridGutters 가 있지만 피커 경로에서는 그것만으로 안 따라온다 —
       * 실측: 2x1 → 3x3 으로 바꿔도 거터가 col 1개 그대로였다(2초 뒤에도).
       * 격자 «수»가 바뀌는 건 이 경로뿐이라 여기서 한 번 정리한다. */
      hideGridGutters();
      showGridProperties(block);
      showGridGutters(block);                   // 패널 재생성(칸/행 수가 바뀌면 섹션도 바뀐다)
    },
    { max: MAX_COLS, maxRows: MAX_ROWS, minCols: MIN_COLS, minRows: MIN_ROWS }
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
    /* ★pushHistory 는 변경 «전»에. 뒤에 부르면 스냅샷이 «이미 바뀐 상태»라
     * 피커→비율 순서에서 undo 가 두 단계를 한꺼번에 되돌린다(적대검수 지적).
     * 이 레포엔 moveSection 에 같은 버그가 실재한다 — 새 코드에서 복제하지 않는다. */
    window.pushHistory?.();
    _applyRatioInput(e.target.value);
    window.scheduleAutoSave?.();
  });
  document.getElementById('grd-col-ratio-reset')?.addEventListener('click', () => {
    const cur = JSON.parse(block.dataset.cols || '[]');
    const equal = Array(cur.length).fill(1).join(':');
    window.pushHistory?.();                     // ★변경 «전»에(위와 같은 이유)
    _applyRatioInput(equal);
    window.scheduleAutoSave?.();
  });

  propPanel.querySelectorAll('[data-va]').forEach(btn => btn.addEventListener('click', () => {
    block.dataset.valign = btn.dataset.va;
    window.renderGridBlock?.(block);
    window.pushHistory?.(); window.scheduleAutoSave?.();
    showGridProperties(block);
  }));

  // 가로 정렬 — 컬럼 단위(col.align)로 일괄 적용.
  // ★라인의 line.align 은 렌더러에서 col.align 을 «가린다»(_gridLineHtml: line.align || colAlign).
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
      window.renderGridBlock?.(block);
      window.pushHistory?.(); window.scheduleAutoSave?.();
      showGridProperties(block);
    } catch (_) {}
  }));

  /* ── 행 높이 — change(blur/Enter)에서만 커밋(비율 입력과 동일 원칙) ──────── */
  propPanel.querySelectorAll('.grd-row-h-item').forEach(inp => {
    inp.addEventListener('change', () => {
      const ri = parseInt(inp.dataset.ri);
      const curRows = gridRows(block);
      if (!curRows[ri]) return;
      const raw = inp.value.trim();
      const v = raw === '' ? 'auto' : Math.max(0, Math.min(ROW_H_MAX, parseInt(raw) || 0));
      curRows[ri] = { height: v };
      window.pushHistory?.();
      block.dataset.rows = JSON.stringify(curRows);
      window.renderGridBlock?.(block);
      window.scheduleAutoSave?.();
      inp.value = v === 'auto' ? '' : v;   // 정규화 결과로 되씀(비율 입력과 동일 패턴)
    });
  });

  // ★2026-09-04 P2: 캔버스 셀 경계 드래그 거터(overlay-handles.js) — 패널이 뜨는 자리마다
  //   같이 띄운다(클릭 선택·레이어패널 선택·updateGridBlock 후 재선택 모두 이 함수를 거친다,
  //   PLAN-gridblock.md §5). 해제는 editor.js deselectAll()의 hideGridGutters 로 일괄.
  showGridGutters(block);
}

window.showGridProperties = showGridProperties;
// ★deprecated 별칭 — 2026-09-05 개명 이전 이름(tools/duo-align-probe·외부 CDP 스크립트 호환).
//   제거는 P1. grid-block.js 의 window.*Duo* 별칭 4개와 동반한다.
window.showDuoProperties = showGridProperties;
