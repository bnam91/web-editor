import { propPanel, state } from '../globals.js';
import { colorFieldHTML, wireColorField, parseAlphaFromColor } from './color-picker.js';

function _tblTok(name, fallback) {
  if (typeof getComputedStyle !== 'function') return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

function _rgbToHex(rgb) {
  if (!rgb || rgb === 'transparent') return '#cccccc';
  if (/^#/.test(rgb)) return rgb;
  const m = rgb.match(/\d+/g);
  if (!m || m.length < 3) return '#cccccc';
  return '#' + m.slice(0, 3).map(n => parseInt(n).toString(16).padStart(2, '0')).join('');
}

/* 비율 문자열("1:1:2") → 정규화 % colgroup 적용 + dataset.colWidths 저장.
   부족하면 1로 패딩, 넘치면 자른다. table-layout: fixed로 고정해 비율이 정확히 반영되도록.
   ※ colCount는 logical(병합 포함 합산) 기준. 우선순위: tbody 첫 tr(td 갯수) > thead 첫 tr(colspan 합산). */
function _applyColRatio(block, rawRatio) {
  const table = block?.querySelector('.tb-table');
  if (!table) return;
  const _logicalCount = (tr) => {
    if (!tr) return 0;
    let n = 0;
    tr.querySelectorAll('th,td').forEach(c => {
      const cs = parseInt(c.getAttribute('colspan') || '1', 10) || 1;
      n += cs;
    });
    return n;
  };
  const bodyTr = table.querySelector('tbody > tr');
  const headTr = table.querySelector('thead > tr');
  const colCount = bodyTr
    ? bodyTr.querySelectorAll('th,td').length
    : _logicalCount(headTr) || _logicalCount(table.querySelector('tr'));
  if (!colCount) return;
  let parts = String(rawRatio || '').split(/[:,\s]+/).filter(Boolean).map(Number).filter(n => !isNaN(n) && n > 0);
  while (parts.length < colCount) parts.push(1);
  parts = parts.slice(0, colCount);
  const sum = parts.reduce((a, b) => a + b, 0) || 1;
  const percents = parts.map(p => (p / sum) * 100);
  const old = table.querySelector('colgroup');
  if (old) old.remove();
  const cg = document.createElement('colgroup');
  percents.forEach(p => {
    const col = document.createElement('col');
    col.style.width = p.toFixed(2) + '%';
    cg.appendChild(col);
  });
  table.insertBefore(cg, table.firstChild);
  table.style.tableLayout = 'fixed';
  block.dataset.colWidths = parts.join(':');
}
window.__applyTableColRatio = _applyColRatio;

/* 컬럼별 색 적용/해제. style==='colored'일 때만 적용. 부족하면 기본색 패딩, 넘치면 잘림.
   bgList/fgList 파라미터로 직접 갱신할 수 있고, 생략 시 dataset에서 읽는다.
   ※ logical colCount는 tbody td 갯수 또는 thead colspan 합산. 셀별 색칠은 각 셀이 차지하는
      logical col 범위 중 '첫 col'의 색을 사용 (병합 셀이 여러 col에 걸쳐 있어도 시각상 단일 색). */
function _applyColColors(block, bgList, fgList) {
  const table = block?.querySelector('.tb-table');
  if (!table) return;
  const _logicalCount = (tr) => {
    if (!tr) return 0;
    let n = 0;
    tr.querySelectorAll('th,td').forEach(c => {
      const cs = parseInt(c.getAttribute('colspan') || '1', 10) || 1;
      n += cs;
    });
    return n;
  };
  const bodyTr = table.querySelector('tbody > tr');
  const headTr = table.querySelector('thead > tr');
  const colCount = bodyTr
    ? bodyTr.querySelectorAll('th,td').length
    : _logicalCount(headTr) || _logicalCount(table.querySelector('tr'));
  if (!colCount) return;
  const isColored = block.dataset.style === 'colored';
  // 컬럼별 색 cleanup (모든 td/th에서 inline bg/color 제거)
  table.querySelectorAll('th, td').forEach(c => {
    c.style.removeProperty('background-color');
    c.style.removeProperty('color');
  });
  if (!isColored) {
    delete block.dataset.colBgs;
    delete block.dataset.colFgs;
    return;
  }
  let bgs = (bgList ?? (block.dataset.colBgs || '').split(',')).map(s => (s || '').trim());
  let fgs = (fgList ?? (block.dataset.colFgs || '').split(',')).map(s => (s || '').trim());
  while (bgs.length < colCount) bgs.push(_tblTok('--preset-table-col-bg', '#f5f5f5'));
  while (fgs.length < colCount) fgs.push(_tblTok('--preset-table-text', '#222222'));
  bgs = bgs.slice(0, colCount);
  fgs = fgs.slice(0, colCount);
  table.querySelectorAll('tr').forEach(tr => {
    let logicalIdx = 0;
    tr.querySelectorAll('th, td').forEach(cell => {
      const span = parseInt(cell.getAttribute('colspan') || '1', 10) || 1;
      const i = logicalIdx;
      if (bgs[i]) cell.style.backgroundColor = bgs[i];
      if (fgs[i]) cell.style.color = fgs[i];
      logicalIdx += span;
    });
  });
  block.dataset.colBgs = bgs.join(',');
  block.dataset.colFgs = fgs.join(',');
}
window.__applyTableColColors = _applyColColors;

/* placeholder div 생성 — 명시 imgH가 있으면 height 적용, 없으면 정사각형(aspect-ratio: 1/1) */
function _makeImgCellPlaceholder(tr) {
  const h = parseInt(tr?.dataset?.imgH) || 0;
  const ph = document.createElement('div');
  ph.className = 'tbl-img-cell';
  const sizeRule = h > 0 ? `height:${h}px` : 'aspect-ratio:1/1';
  ph.style.cssText = `${sizeRule};width:100%;background-image:repeating-conic-gradient(#e0e0e0 0% 25%, transparent 0% 50%);background-size:16px 16px;cursor:pointer;position:relative;`;
  return ph;
}

/* :img row 변환 — 모든 셀을 placeholder로, 첫 셀에 x 버튼 */
function _convertTableRowToImg(tr) {
  if (!tr || tr.dataset.rowImg === 'true') return;
  tr.dataset.rowImg = 'true';
  tr.style.height = '';
  Array.from(tr.children).forEach(cell => {
    cell.innerHTML = '';
    cell.style.padding = '0';
    cell.style.position = 'relative';
    cell.setAttribute('contenteditable', 'false');
    cell.appendChild(_makeImgCellPlaceholder(tr));
  });
  const xBtn = document.createElement('button');
  xBtn.className = 'tbl-row-img-x';
  xBtn.textContent = '×';
  xBtn.title = '이미지 row 해제';
  xBtn.style.cssText = 'position:absolute;top:4px;right:4px;width:20px;height:20px;border:none;background:rgba(0,0,0,0.6);color:#fff;border-radius:50%;cursor:pointer;font-size:14px;line-height:1;z-index:2;padding:0;';
  tr.firstElementChild.appendChild(xBtn);
  _bindTableRowImg(tr);
}

/* :img row의 모든 placeholder height 갱신. h=0/falsy → aspect-ratio 1/1 (정사각형 자동) */
function _applyRowImgHeight(tr, h) {
  if (!tr || tr.dataset.rowImg !== 'true') return;
  const phs = tr.querySelectorAll('.tbl-img-cell');
  if (h && h > 0) {
    tr.dataset.imgH = String(h);
    phs.forEach(ph => { ph.style.aspectRatio = ''; ph.style.height = h + 'px'; });
  } else {
    delete tr.dataset.imgH;
    phs.forEach(ph => { ph.style.height = ''; ph.style.aspectRatio = '1 / 1'; });
  }
}
window.__applyTableRowImgHeight = _applyRowImgHeight;
window.__makeImgCellPlaceholder = _makeImgCellPlaceholder;
window.__convertTableRowToImg = _convertTableRowToImg;

/* 이미지 row의 placeholder 더블클릭(파일 피커) + x 버튼(롤백) 바인딩.
   페이지 reload 후 hydrate 시에도 안전하게 호출 가능. */
function _bindTableRowImg(tr) {
  if (!tr || tr.dataset.rowImg !== 'true') return;
  tr.querySelectorAll('.tbl-img-cell').forEach(ph => {
    if (ph._imgBound) return;
    ph._imgBound = true;
    ph.addEventListener('dblclick', e => {
      e.stopPropagation();
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = ev => {
        const file = ev.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          ph.style.backgroundImage = `url(${reader.result})`;
          ph.style.backgroundSize = 'cover';
          ph.style.backgroundPosition = 'center';
          window.scheduleAutoSave?.();
        };
        reader.readAsDataURL(file);
      };
      input.click();
    });
  });
  const xBtn = tr.querySelector('.tbl-row-img-x');
  if (xBtn && !xBtn._imgBound) {
    xBtn._imgBound = true;
    xBtn.addEventListener('click', e => {
      e.stopPropagation();
      _revertTableRowToImg(tr);
      window.scheduleAutoSave?.();
    });
  }
}
window.__bindTableRowImg = _bindTableRowImg;

function _revertTableRowToImg(tr) {
  if (!tr) return;
  delete tr.dataset.rowImg;
  Array.from(tr.children).forEach(cell => {
    cell.innerHTML = '';
    cell.style.removeProperty('padding');
    cell.style.removeProperty('position');
  });
}
window.__revertTableRowToImg = _revertTableRowToImg;

export function showTableProperties(block) {
  const table    = block.querySelector('.tb-table');
  const thead    = table.querySelector('thead');
  const tbody    = table.querySelector('tbody');
  // logical col count = (a) tbody 첫 td 갯수 (b) thead colspan 합산 (c) 첫 tr 단순 카운트(폴백)
  const _logicalColCount = () => {
    const bodyTr = tbody?.querySelector('tr');
    if (bodyTr) return bodyTr.querySelectorAll('th,td').length;
    const headTr = thead?.querySelector('tr');
    if (headTr) {
      let n = 0;
      headTr.querySelectorAll('th,td').forEach(c => {
        n += parseInt(c.getAttribute('colspan') || '1', 10) || 1;
      });
      return n;
    }
    return table.querySelector('tr')?.querySelectorAll('th,td').length || 2;
  };
  const colCount = _logicalColCount();
  const rowCount = tbody?.querySelectorAll('tr').length || 0;

  // ── mergedHeaderCols dataset 파싱 → 사용자 친화 문자열 "start:span,start:span" ──
  let _curMergesArr = [];
  try {
    const raw = block.dataset.mergedHeaderCols;
    if (raw) {
      const p = JSON.parse(raw);
      if (Array.isArray(p)) _curMergesArr = p.filter(it => Array.isArray(it) && it.length >= 2);
    }
  } catch (_) {}
  const curMergesStr = _curMergesArr.map(([s, n]) => `${s}:${n}`).join(',');
  const curStyle      = block.dataset.style || 'default';
  const curAlign      = block.dataset.cellAlign || 'left';
  const curPad        = parseInt(block.dataset.cellPad) || 10;
  const curSize       = parseInt(table.style.fontSize) || 28;
  const curShowHeader = block.dataset.showHeader !== 'false';

  // 신규 옵션 7개 기본값
  const curShowVLines  = block.dataset.showVLines  !== 'false';   // 세로선 (default: true)
  const curShowHLines  = block.dataset.showHLines  !== 'false';   // 수평선 (default: true)
  const curShowOuterX  = block.dataset.showOuterX  !== 'false';   // 외곽 좌우 (default: true)
  const curShowOuterY  = block.dataset.showOuterY  !== 'false';   // 외곽 상하 (default: true)
  const curOuterW      = parseInt(block.dataset.outerWidth) || 1; // 외곽선 두께 (1~6)
  const curRowH        = parseInt(block.dataset.rowH) || 0;       // 행 높이 (0 = auto)
  const curTablePadX   = parseInt(block.dataset.tablePadX) || 0;  // 테이블 좌우 패딩 (0~120)
  // 색상 옵션
  const curLineColor   = block.dataset.lineColor   || _tblTok('--preset-table-line', '#cccccc');
  const curLineAlpha   = parseAlphaFromColor(curLineColor);
  const curHeaderBg    = block.dataset.headerBg    || _tblTok('--preset-table-header-bg', '#f0f0f0');
  const curHeaderAlpha = parseAlphaFromColor(curHeaderBg);
  const curTextColor   = block.dataset.textColor   || _tblTok('--preset-table-text', '#222222');
  const curTextAlpha   = parseAlphaFromColor(curTextColor);
  const curFontFamily  = block.dataset.fontFamily  || '';
  const curColRatio    = block.dataset.colWidths   || '';
  const curColBgs      = (block.dataset.colBgs || '').split(',').map(s => s.trim()).filter(Boolean);
  const curColFgs      = (block.dataset.colFgs || '').split(',').map(s => s.trim()).filter(Boolean);

  const rebuildTable = () => {
    const cols = table.querySelector('tr')?.querySelectorAll('th,td').length || 2;
    const rows = [...(tbody?.querySelectorAll('tr') || [])];
    rows.forEach(tr => {
      const cur = tr.querySelectorAll('td').length;
      if (cur < cols) {
        for (let i = cur; i < cols; i++) {
          const td = document.createElement('td');
          td.setAttribute('contenteditable','false');
          tr.appendChild(td);
        }
      } else {
        for (let i = cur; i > cols; i--) tr.lastElementChild?.remove();
      }
    });
    if (thead) {
      const ths = thead.querySelectorAll('th');
      if (ths.length < cols) {
        const tr = thead.querySelector('tr');
        for (let i = ths.length; i < cols; i++) {
          const th = document.createElement('th');
          th.setAttribute('contenteditable','false');
          th.textContent = '항목';
          tr.appendChild(th);
        }
      } else {
        const tr = thead.querySelector('tr');
        for (let i = ths.length; i > cols; i--) tr.lastElementChild?.remove();
      }
    }
    window.pushHistory();
  };

  propPanel.innerHTML = `
    <div class="prop-section">
      <div class="prop-block-label">
        <div class="prop-block-icon">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#888" stroke-width="1.3">
            <rect x="1" y="1" width="10" height="10" rx="1"/>
            <line x1="1" y1="4" x2="11" y2="4"/>
            <line x1="5" y1="4" x2="5" y2="11"/>
          </svg>
        </div>
        <div class="prop-block-info">
          <span class="prop-block-name">${block.dataset.layerName || 'Table'}</span>
          <span class="prop-breadcrumb">${window.getBlockBreadcrumb(block)}</span>
        </div>
        ${block.id ? `<span class="prop-block-id" title="클릭하여 복사" onclick="_copyToClipboard('${block.id}')">${block.id}</span>` : ''}
      </div>
    </div>
    <div class="prop-section">
      <div class="prop-section-title">Rows / Cols</div>
      <div class="prop-row">
        <span class="prop-label">행</span>
        <button class="prop-count-btn" id="tbl-row-minus">−</button>
        <span class="prop-count-val" id="tbl-row-count">${rowCount}</span>
        <button class="prop-count-btn" id="tbl-row-plus">+</button>
      </div>
      <div class="prop-row">
        <span class="prop-label">열</span>
        <button class="prop-count-btn" id="tbl-col-minus">−</button>
        <span class="prop-count-val" id="tbl-col-count">${colCount}</span>
        <button class="prop-count-btn" id="tbl-col-plus">+</button>
      </div>
    </div>
    <div class="prop-section">
      <div class="prop-section-title">Column Ratio</div>
      <div class="prop-row">
        <span class="prop-label">비율</span>
        <input type="text" class="prop-input" id="tbl-col-ratio" placeholder="1:1:1" value="${curColRatio}" style="flex:1 1 0;min-width:0;font-size:11px;height:24px;background:#1a1a1a;color:#e5e5e5;border:1px solid #333;border-radius:4px;padding:0 8px;">
        <button id="tbl-col-ratio-reset" style="height:24px;flex:0 0 auto;padding:0 10px;font-size:11px;white-space:nowrap;background:#262626;color:#e5e5e5;border:1px solid #333;border-radius:4px;cursor:pointer;line-height:1;box-sizing:border-box;">균등</button>
      </div>
      <div class="prop-hint">예: 1:1:2 → 25/25/50%</div>
    </div>
    <div class="prop-section">
      <div class="prop-section-title">Header Merge</div>
      <div class="prop-row">
        <span class="prop-label">병합</span>
        <input type="text" class="prop-input" id="tbl-merge-headers" placeholder="0:2,3:2" value="${curMergesStr}" title="형식: start:span 쉼표구분. 예) 0:2,3:2 = col0~1, col3~4 그룹화" style="flex:1 1 0;min-width:0;font-size:11px;height:24px;background:#1a1a1a;color:#e5e5e5;border:1px solid #333;border-radius:4px;padding:0 8px;">
        <button id="tbl-merge-headers-clear" style="height:24px;flex:0 0 auto;padding:0 10px;font-size:11px;white-space:nowrap;background:#262626;color:#e5e5e5;border:1px solid #333;border-radius:4px;cursor:pointer;line-height:1;box-sizing:border-box;">지우기</button>
      </div>
      <div class="prop-hint">헤더 가로 병합 (start:span, 0-base). 예) 0:2,3:2 — 첫 2칸 + 4~5칸 그룹</div>
    </div>
    ${curStyle === 'colored' ? `
    <div class="prop-section" id="tbl-col-colors-section">
      <div class="prop-section-title">Column Colors</div>
      ${Array.from({ length: colCount }, (_, i) => `
        <div class="prop-row" style="gap:4px;">
          <span class="prop-label" style="width:48px;">컬럼 ${i + 1}</span>
          <input type="color" class="prop-color-input" id="tbl-col-bg-${i}"
                 value="${curColBgs[i] || _tblTok('--preset-table-col-bg', '#f5f5f5')}"
                 title="배경"
                 style="width:32px;height:24px;padding:0;border:1px solid #333;background:transparent;cursor:pointer;">
          <input type="color" class="prop-color-input" id="tbl-col-fg-${i}"
                 value="${curColFgs[i] || _tblTok('--preset-table-text', '#222222')}"
                 title="글자색"
                 style="width:32px;height:24px;padding:0;border:1px solid #333;background:transparent;cursor:pointer;">
        </div>
      `).join('')}
      <div class="prop-hint">왼쪽: 배경 / 오른쪽: 글자색</div>
    </div>
    ` : ''}
    ${(() => {
      const imgRows = Array.from(table.querySelectorAll('tr[data-row-img="true"]'));
      if (!imgRows.length) return '';
      return `
      <div class="prop-section" id="tbl-img-rows-section">
        <div class="prop-section-title">Image Row Heights</div>
        ${imgRows.map((tr, i) => {
          const curH = parseInt(tr.dataset.imgH) || 0;
          return `
          <div class="prop-row">
            <span class="prop-label">Row ${i + 1}</span>
            <input type="range" class="prop-slider" id="tbl-img-h-slider-${i}" min="0" max="600" step="1" value="${curH}">
            <input type="number" class="prop-number" id="tbl-img-h-num-${i}" min="0" max="600" value="${curH}">
          </div>`;
        }).join('')}
        <div class="prop-hint">0 = 정사각형 자동</div>
      </div>`;
    })()}
    <div class="prop-section">
      <div class="prop-section-title">Header</div>
      <div class="prop-row">
        <span class="prop-label">헤더</span>
        <label class="prop-toggle">
          <input type="checkbox" id="tbl-show-header" ${curShowHeader ? 'checked' : ''}>
          <span class="prop-toggle-track"></span>
        </label>
      </div>
      <div class="prop-color-row" style="margin-top:6px;">
        <span class="prop-label">배경색</span>
        ${colorFieldHTML({ idPrefix: 'tbl-header-bg', hex: _rgbToHex(curHeaderBg), alpha: curHeaderAlpha })}
      </div>
    </div>
    <div class="prop-section">
      <div class="prop-section-title">Style</div>
      <div class="prop-row">
        <span class="prop-label">테마</span>
        <select class="prop-select" id="tbl-style-select">
          <option value="default"    ${curStyle==='default'   ?'selected':''}>기본</option>
          <option value="stripe"     ${curStyle==='stripe'    ?'selected':''}>스트라이프</option>
          <option value="borderless" ${curStyle==='borderless'?'selected':''}>보더리스</option>
          <option value="colored"    ${curStyle==='colored'   ?'selected':''}>컬럼별 컬러</option>
        </select>
      </div>
      <div class="prop-row">
        <span class="prop-label">정렬</span>
        <div class="prop-align-group" id="tbl-align-group">
          <button class="prop-align-btn${curAlign==='left'   ?' active':''}" data-align="left">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3">
              <line x1="1" y1="3" x2="13" y2="3"/><line x1="1" y1="6" x2="9" y2="6"/>
              <line x1="1" y1="9" x2="11" y2="9"/><line x1="1" y1="12" x2="7" y2="12"/>
            </svg>
          </button>
          <button class="prop-align-btn${curAlign==='center' ?' active':''}" data-align="center">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3">
              <line x1="1" y1="3" x2="13" y2="3"/><line x1="3" y1="6" x2="11" y2="6"/>
              <line x1="2" y1="9" x2="12" y2="9"/><line x1="4" y1="12" x2="10" y2="12"/>
            </svg>
          </button>
          <button class="prop-align-btn${curAlign==='right'  ?' active':''}" data-align="right">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3">
              <line x1="1" y1="3" x2="13" y2="3"/><line x1="5" y1="6" x2="13" y2="6"/>
              <line x1="3" y1="9" x2="13" y2="9"/><line x1="7" y1="12" x2="13" y2="12"/>
            </svg>
          </button>
        </div>
      </div>
      <div class="prop-row">
        <span class="prop-label">폰트</span>
        <select class="prop-select" id="tbl-font-family" style="flex:1;">
          <option value=""                                                 ${curFontFamily===''?'selected':''}>기본</option>
          <option value="'Pretendard', sans-serif"                          ${curFontFamily==="'Pretendard', sans-serif"?'selected':''}>Pretendard</option>
          <option value="'Noto Sans KR', sans-serif"                        ${curFontFamily==="'Noto Sans KR', sans-serif"?'selected':''}>Noto Sans KR</option>
          <option value="'Spoqa Han Sans Neo', sans-serif"                  ${curFontFamily==="'Spoqa Han Sans Neo', sans-serif"?'selected':''}>Spoqa Han Sans</option>
          <option value="'Inter', sans-serif"                               ${curFontFamily==="'Inter', sans-serif"?'selected':''}>Inter</option>
          <option value="'Roboto', sans-serif"                              ${curFontFamily==="'Roboto', sans-serif"?'selected':''}>Roboto</option>
          <option value="'Helvetica Neue', sans-serif"                      ${curFontFamily==="'Helvetica Neue', sans-serif"?'selected':''}>Helvetica</option>
          <option value="Georgia, serif"                                    ${curFontFamily==="Georgia, serif"?'selected':''}>Georgia</option>
          <option value="'Times New Roman', serif"                          ${curFontFamily==="'Times New Roman', serif"?'selected':''}>Times</option>
          <option value="monospace"                                         ${curFontFamily==="monospace"?'selected':''}>Monospace</option>
        </select>
      </div>
      <div class="prop-row">
        <span class="prop-label">크기</span>
        <input type="range" class="prop-slider" id="tbl-size-slider" min="12" max="60" step="2" value="${curSize}">
        <input type="number" class="prop-number"  id="tbl-size-number" min="12" max="60" value="${curSize}">
      </div>
      <div class="prop-color-row" style="margin-top:6px;">
        <span class="prop-label">글자색</span>
        ${colorFieldHTML({ idPrefix: 'tbl-text', hex: _rgbToHex(curTextColor), alpha: curTextAlpha })}
      </div>
      <div class="prop-row">
        <span class="prop-label">셀 패딩</span>
        <input type="range" class="prop-slider" id="tbl-pad-slider" min="0" max="40" step="2" value="${curPad}">
        <input type="number" class="prop-number"  id="tbl-pad-number" min="0" max="40" value="${curPad}">
      </div>
      <div class="prop-row">
        <span class="prop-label">행 높이</span>
        <input type="range" class="prop-slider" id="tbl-rowh-slider" min="0" max="160" step="2" value="${curRowH}">
        <input type="number" class="prop-number"  id="tbl-rowh-number" min="0" max="160" value="${curRowH}">
      </div>
      <div class="prop-row">
        <span class="prop-label">좌우 여백</span>
        <input type="range" class="prop-slider" id="tbl-padx-slider" min="0" max="120" step="2" value="${curTablePadX}">
        <input type="number" class="prop-number"  id="tbl-padx-number" min="0" max="120" value="${curTablePadX}">
      </div>
    </div>
    <div class="prop-section">
      <div class="prop-section-title">Borders</div>
      <div class="prop-row">
        <span class="prop-label">세로선</span>
        <label class="prop-toggle">
          <input type="checkbox" id="tbl-show-vlines" ${curShowVLines ? 'checked' : ''}>
          <span class="prop-toggle-track"></span>
        </label>
      </div>
      <div class="prop-row">
        <span class="prop-label">수평선</span>
        <label class="prop-toggle">
          <input type="checkbox" id="tbl-show-hlines" ${curShowHLines ? 'checked' : ''}>
          <span class="prop-toggle-track"></span>
        </label>
      </div>
      <div class="prop-row">
        <span class="prop-label">외곽 좌우</span>
        <label class="prop-toggle">
          <input type="checkbox" id="tbl-show-outerx" ${curShowOuterX ? 'checked' : ''}>
          <span class="prop-toggle-track"></span>
        </label>
      </div>
      <div class="prop-row">
        <span class="prop-label">외곽 상하</span>
        <label class="prop-toggle">
          <input type="checkbox" id="tbl-show-outery" ${curShowOuterY ? 'checked' : ''}>
          <span class="prop-toggle-track"></span>
        </label>
      </div>
      <div class="prop-row">
        <span class="prop-label">외곽두께</span>
        <input type="range" class="prop-slider" id="tbl-outerw-slider" min="1" max="6" step="1" value="${curOuterW}">
        <input type="number" class="prop-number"  id="tbl-outerw-number" min="1" max="6" value="${curOuterW}">
      </div>
      <div class="prop-color-row" style="margin-top:6px;">
        <span class="prop-label">선 색</span>
        ${colorFieldHTML({ idPrefix: 'tbl-line', hex: _rgbToHex(curLineColor), alpha: curLineAlpha })}
      </div>
    </div>
    <div class="prop-hint">셀을 더블클릭하면 텍스트를 편집할 수 있습니다.</div>`;

  if (window.setRpIdBadge) window.setRpIdBadge(block.id || null);

  /* 헤더 표시/숨기기 */
  document.getElementById('tbl-show-header').addEventListener('change', e => {
    const show = e.target.checked;
    block.dataset.showHeader = show ? 'true' : 'false';
    if (thead) thead.style.display = show ? '' : 'none';
    window.pushHistory();
  });

  /* 행 추가/삭제 */
  document.getElementById('tbl-row-plus').addEventListener('click', () => {
    const cols = table.querySelector('tr')?.querySelectorAll('th,td').length || 2;
    const tr = document.createElement('tr');
    for (let i = 0; i < cols; i++) {
      const td = document.createElement('td');
      td.setAttribute('contenteditable','false');
      tr.appendChild(td);
    }
    // 신규 행도 row 높이 적용
    const rh = parseInt(block.dataset.rowH) || 0;
    if (rh > 0) tr.style.height = rh + 'px';
    tbody.appendChild(tr);
    document.getElementById('tbl-row-count').textContent = tbody.querySelectorAll('tr').length;
    window.pushHistory();
  });
  document.getElementById('tbl-row-minus').addEventListener('click', () => {
    const rows = tbody.querySelectorAll('tr');
    if (rows.length > 1) { rows[rows.length - 1].remove(); }
    document.getElementById('tbl-row-count').textContent = tbody.querySelectorAll('tr').length;
    window.pushHistory();
  });

  /* 열 추가/삭제 — v1: 열 갯수가 바뀌면 header merge 정합성이 깨질 위험이 있어 자동 clear */
  const _clearMergesIfAny = () => {
    if (block.dataset.mergedHeaderCols && block.dataset.mergedHeaderCols !== '[]') {
      delete block.dataset.mergedHeaderCols;
    }
    // thead의 colspan 속성도 제거 (시각 정합성)
    block.querySelectorAll('.tb-table > thead th[colspan]').forEach(th => th.removeAttribute('colspan'));
  };
  document.getElementById('tbl-col-plus').addEventListener('click', () => {
    _clearMergesIfAny();
    table.querySelectorAll('tr').forEach(tr => {
      const isHead = tr.closest('thead');
      const cell = document.createElement(isHead ? 'th' : 'td');
      cell.setAttribute('contenteditable','false');
      if (isHead) cell.textContent = '항목';
      tr.appendChild(cell);
      // :img row면 새 셀도 placeholder로 자동 변환
      if (!isHead && tr.dataset.rowImg === 'true') {
        cell.textContent = '';
        cell.style.padding = '0';
        cell.style.position = 'relative';
        cell.appendChild(_makeImgCellPlaceholder(tr));
        _bindTableRowImg(tr);
      }
    });
    document.getElementById('tbl-col-count').textContent = table.querySelector('tr')?.querySelectorAll('th,td').length || 0;
    rebuildTable();
    if (block.dataset.colWidths) _applyColRatio(block, block.dataset.colWidths);
    if (block.dataset.style === 'colored') { _applyColColors(block); showTableProperties(block); }
  });
  document.getElementById('tbl-col-minus').addEventListener('click', () => {
    _clearMergesIfAny();
    const cols = table.querySelector('tr')?.querySelectorAll('th,td').length || 0;
    if (cols > 1) {
      table.querySelectorAll('tr').forEach(tr => tr.lastElementChild?.remove());
    }
    document.getElementById('tbl-col-count').textContent = table.querySelector('tr')?.querySelectorAll('th,td').length || 0;
    if (block.dataset.colWidths) _applyColRatio(block, block.dataset.colWidths);
    if (block.dataset.style === 'colored') { _applyColColors(block); showTableProperties(block); }
    window.pushHistory();
  });

  /* 헤더 병합 (mergedHeaderCols) — 입력 형식 "start:span,start:span"
     - 빈 값 / 지우기 버튼 → dataset 제거 + thead 단순 재구성
     - 정상 입력 → window.updateTableBlock(id, { mergedHeaderCols: arr }) 호출 (검증/렌더 통합) */
  const _parseMergesStr = (str) => {
    const out = [];
    String(str || '').split(',').map(s => s.trim()).filter(Boolean).forEach(tok => {
      const m = tok.match(/^(\d+)\s*:\s*(\d+)$/);
      if (!m) return null;
      out.push([parseInt(m[1], 10), parseInt(m[2], 10)]);
    });
    return out;
  };
  const _applyMergeInput = (raw) => {
    const arr = _parseMergesStr(raw);
    if (typeof window.updateTableBlock !== 'function') return;
    const res = window.updateTableBlock(block.id, { mergedHeaderCols: arr });
    if (res && res.ok === false) {
      // 사용자에게 가볍게 알림 (콘솔만) + 패널 재렌더로 입력값 원복
      console.warn('[table-merge] update failed:', res.code, res.message);
    }
    // 패널 재렌더 (입력값 정규형 반영)
    try { showTableProperties(block); } catch (_) {}
  };
  const mergeInput = document.getElementById('tbl-merge-headers');
  mergeInput?.addEventListener('change', e => _applyMergeInput(e.target.value));
  document.getElementById('tbl-merge-headers-clear')?.addEventListener('click', () => {
    if (mergeInput) mergeInput.value = '';
    _applyMergeInput('');
  });

  /* 컬럼 비율 */
  const ratioInput = document.getElementById('tbl-col-ratio');
  ratioInput?.addEventListener('change', e => {
    _applyColRatio(block, e.target.value);
    e.target.value = block.dataset.colWidths || '';
    window.pushHistory();
    window.scheduleAutoSave?.();
  });
  document.getElementById('tbl-col-ratio-reset')?.addEventListener('click', () => {
    const cols = table.querySelector('tr')?.querySelectorAll('th,td').length || 1;
    const equal = Array(cols).fill(1).join(':');
    if (ratioInput) ratioInput.value = equal;
    _applyColRatio(block, equal);
    window.pushHistory();
    window.scheduleAutoSave?.();
  });

  /* 스타일 */
  document.getElementById('tbl-style-select').addEventListener('change', e => {
    block.dataset.style = e.target.value;
    _applyColColors(block);    // colored면 색 적용, 아니면 cleanup
    showTableProperties(block); // Column Colors 섹션 토글 위해 패널 재렌더
    window.pushHistory();
  });

  /* 컬럼별 색 picker */
  if (curStyle === 'colored') {
    const refreshFromInputs = () => {
      const cols = table.querySelector('tr')?.querySelectorAll('th,td').length || 0;
      const bgs = [], fgs = [];
      for (let i = 0; i < cols; i++) {
        bgs.push(document.getElementById(`tbl-col-bg-${i}`)?.value || _tblTok('--preset-table-col-bg', '#f5f5f5'));
        fgs.push(document.getElementById(`tbl-col-fg-${i}`)?.value || _tblTok('--preset-table-text', '#222222'));
      }
      _applyColColors(block, bgs, fgs);
      window.scheduleAutoSave?.();
    };
    const cols = table.querySelector('tr')?.querySelectorAll('th,td').length || 0;
    for (let i = 0; i < cols; i++) {
      document.getElementById(`tbl-col-bg-${i}`)?.addEventListener('input', refreshFromInputs);
      document.getElementById(`tbl-col-fg-${i}`)?.addEventListener('input', refreshFromInputs);
    }
    // 첫 진입 시 dataset이 비어 있으면 기본색으로 채우고 적용
    if (!block.dataset.colBgs) _applyColColors(block);
  }

  /* Image Row Heights — :img row마다 슬라이더 */
  Array.from(table.querySelectorAll('tr[data-row-img="true"]')).forEach((tr, i) => {
    const slider = document.getElementById(`tbl-img-h-slider-${i}`);
    const num    = document.getElementById(`tbl-img-h-num-${i}`);
    const apply = (raw) => {
      const n = Math.max(0, Math.min(600, parseInt(raw) || 0));
      _applyRowImgHeight(tr, n);
      if (slider) slider.value = n;
      if (num)    num.value = n;
      window.scheduleAutoSave?.();
    };
    slider?.addEventListener('input', e => apply(e.target.value));
    num?.addEventListener('input',    e => apply(e.target.value));
    // 커밋(change) 1회 = undo 1액션 (다른 tbl 슬라이더와 동일 패턴)
    slider?.addEventListener('change', () => window.pushHistory());
    num?.addEventListener('change',    () => window.pushHistory());
  });

  /* 정렬 */
  document.querySelectorAll('#tbl-align-group .prop-align-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const align = btn.dataset.align;
      block.dataset.cellAlign = align;
      table.querySelectorAll('th, td').forEach(cell => cell.style.textAlign = align);
      document.querySelectorAll('#tbl-align-group .prop-align-btn').forEach(b => b.classList.toggle('active', b === btn));
      window.pushHistory();
    });
  });

  /* 폰트 크기 */
  const applySize = v => {
    table.style.fontSize = v + 'px';
    block.dataset.fontSize = v;
    document.getElementById('tbl-size-slider').value = v;
    document.getElementById('tbl-size-number').value = v;
  };
  document.getElementById('tbl-size-slider').addEventListener('input',  e => applySize(parseInt(e.target.value)));
  document.getElementById('tbl-size-number').addEventListener('change', e => { applySize(parseInt(e.target.value)); window.pushHistory(); });
  document.getElementById('tbl-size-slider').addEventListener('change', () => window.pushHistory());

  /* 셀 여백 (상하) */
  const applyPad = v => {
    block.dataset.cellPad = v;
    table.querySelectorAll('th, td').forEach(cell => { cell.style.padding = v + 'px 16px'; });
    document.getElementById('tbl-pad-slider').value = v;
    document.getElementById('tbl-pad-number').value = v;
  };
  document.getElementById('tbl-pad-slider').addEventListener('input',  e => applyPad(parseInt(e.target.value)));
  document.getElementById('tbl-pad-number').addEventListener('change', e => { applyPad(parseInt(e.target.value)); window.pushHistory(); });
  document.getElementById('tbl-pad-slider').addEventListener('change', () => window.pushHistory());

  /* 행 높이 */
  const applyRowH = v => {
    block.dataset.rowH = v;
    // tbody tr만 적용 (thead는 헤더 표시 옵션과 분리하여 자동 높이 유지)
    table.querySelectorAll('tbody tr').forEach(tr => {
      tr.style.height = v > 0 ? v + 'px' : '';
    });
    // thead도 높이 일관성을 위해 동일 적용
    table.querySelectorAll('thead tr').forEach(tr => {
      tr.style.height = v > 0 ? v + 'px' : '';
    });
    document.getElementById('tbl-rowh-slider').value = v;
    document.getElementById('tbl-rowh-number').value = v;
  };
  document.getElementById('tbl-rowh-slider').addEventListener('input',  e => applyRowH(parseInt(e.target.value)));
  document.getElementById('tbl-rowh-number').addEventListener('change', e => { applyRowH(parseInt(e.target.value)); window.pushHistory(); });
  document.getElementById('tbl-rowh-slider').addEventListener('change', () => window.pushHistory());

  /* 세로선 / 수평선 / 외곽 좌우 / 외곽 상하 토글 */
  const bindLineToggle = (id, dataKey) => {
    document.getElementById(id).addEventListener('change', e => {
      block.dataset[dataKey] = e.target.checked ? 'true' : 'false';
      window.pushHistory();
    });
  };
  bindLineToggle('tbl-show-vlines',  'showVLines');
  bindLineToggle('tbl-show-hlines',  'showHLines');
  bindLineToggle('tbl-show-outerx',  'showOuterX');
  bindLineToggle('tbl-show-outery',  'showOuterY');

  /* 외곽선 두께 */
  const applyOuterW = v => {
    block.dataset.outerWidth = v;
    block.style.setProperty('--tbl-outer-w', v + 'px');
    document.getElementById('tbl-outerw-slider').value = v;
    document.getElementById('tbl-outerw-number').value = v;
  };
  document.getElementById('tbl-outerw-slider').addEventListener('input',  e => applyOuterW(parseInt(e.target.value)));
  document.getElementById('tbl-outerw-number').addEventListener('change', e => { applyOuterW(parseInt(e.target.value)); window.pushHistory(); });
  document.getElementById('tbl-outerw-slider').addEventListener('change', () => window.pushHistory());

  /* 테이블 좌우 패딩 (block 자체 padding 으로 적용 — tb-table width:100%이라 자동으로 좁아짐) */
  const applyTablePadX = v => {
    block.dataset.tablePadX = v;
    block.style.paddingLeft  = v + 'px';
    block.style.paddingRight = v + 'px';
    document.getElementById('tbl-padx-slider').value = v;
    document.getElementById('tbl-padx-number').value = v;
  };
  document.getElementById('tbl-padx-slider').addEventListener('input',  e => applyTablePadX(parseInt(e.target.value)));
  document.getElementById('tbl-padx-number').addEventListener('change', e => { applyTablePadX(parseInt(e.target.value)); window.pushHistory(); });
  document.getElementById('tbl-padx-slider').addEventListener('change', () => window.pushHistory());

  /* 선 색 — CSS var --tbl-line-color */
  wireColorField('tbl-line', {
    initialAlpha: curLineAlpha,
    onApply: (c) => {
      block.dataset.lineColor = c;
      block.style.setProperty('--tbl-line-color', c);
    },
    onCommit: () => window.pushHistory?.(),
  });

  /* 헤더 배경색 — CSS var --tbl-header-bg */
  wireColorField('tbl-header-bg', {
    initialAlpha: curHeaderAlpha,
    onApply: (c) => {
      block.dataset.headerBg = c;
      block.style.setProperty('--tbl-header-bg', c);
    },
    onCommit: () => window.pushHistory?.(),
  });

  /* 글자색 — CSS var --tbl-text-color */
  wireColorField('tbl-text', {
    initialAlpha: curTextAlpha,
    onApply: (c) => {
      block.dataset.textColor = c;
      block.style.setProperty('--tbl-text-color', c);
    },
    onCommit: () => window.pushHistory?.(),
  });

  /* 폰트 — CSS var --tbl-font-family */
  document.getElementById('tbl-font-family').addEventListener('change', e => {
    const v = e.target.value || '';
    block.dataset.fontFamily = v;
    if (v) block.style.setProperty('--tbl-font-family', v);
    else   block.style.removeProperty('--tbl-font-family');
    window.pushHistory?.();
  });
}


window.showTableProperties = showTableProperties;
