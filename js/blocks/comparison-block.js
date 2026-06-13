// comparison-block.js — 1급 비교 블록 (banner02 패턴). N칼럼 비교(1:1, 1:1:1 …).
// 한 칼럼(featured)이 더 크게 떠보임(그림자·overlap·스케일↑). 칼럼은 cols 배열로 관리.
import { genId, showNoSelectionHint, insertAfterSelected } from '../drag-utils.js';
import { bindBlock } from '../drag-drop.js';

const _rows = s => { try { const a = JSON.parse(s || '[]'); return Array.isArray(a) ? a : []; } catch { return []; } };
const _colsParse = s => { try { const a = JSON.parse(s || 'null'); return Array.isArray(a) && a.length ? a : null; } catch { return null; } };

// cols 배열 획득 (없으면 구버전 left/right dataset → 배열로 마이그레이션)
function getComparisonCols(d) {
  const parsed = _colsParse(d.cols);
  if (parsed) return parsed.map(c => ({
    title: c.title ?? '', bg: c.bg || '', text: c.text || '', rows: Array.isArray(c.rows) ? c.rows : []
  }));
  return [
    { title: d.leftTitle ?? '일반 제품',        bg: d.leftBg  || '#e9ebef', text: d.leftText  || '#9aa0a8', rows: _rows(d.leftRows) },
    { title: d.rightTitle ?? '브랜드 명·상품 명', bg: d.rightBg || '#ffffff', text: d.rightText || '#1a1a1a', rows: _rows(d.rightRows) },
  ];
}
function getComparisonFeaturedIdx(d, n) {
  const f = d.featured;
  if (f === 'left') return 0;
  if (f === 'right') return n - 1;
  const i = parseInt(f);
  return (isNaN(i) || i < 0 || i >= n) ? (n - 1) : i;
}
function setComparisonCols(block, cols) { block.dataset.cols = JSON.stringify(cols); }

function renderComparison(block) {
  const d = block.dataset;
  const overlap   = parseInt(d.overlap) || 32;
  const radius    = parseInt(d.radius) || 20;
  const headerH   = parseInt(d.headerH) || 72;
  const rowH      = parseInt(d.rowH) || 64;
  const rowGap    = parseInt(d.rowGap) || 8;
  let featScale   = parseFloat(d.featScale);
  if (!(featScale >= 1)) featScale = 1.2;          // 기본 1.2배
  featScale = Math.min(1.5, Math.max(1.0, featScale));
  const padX = Math.max(0, parseInt(d.padX) || 0); // 전체 좌우 패딩 (블록 ↔ 카드)
  const padY = Math.max(0, parseInt(d.padY) || 0); // 패널 상하 패딩 (카드 내부)
  const baseTitleFont = parseInt(d.titleFont) || 26; // 제목 기본 폰트 (featured는 ×featScale)
  const baseRowFont   = parseInt(d.rowFont) || 18;   // 내용 기본 폰트 (featured는 ×featScale)
  const yPad = 24;                                   // 위/아래 그림자 여유

  // 칼럼 모델 (없으면 left/right에서 마이그레이션 → cols로 영속화)
  const cols = getComparisonCols(d);
  if (!_colsParse(d.cols)) d.cols = JSON.stringify(cols);
  const N = cols.length;
  const featuredIdx = getComparisonFeaturedIdx(d, N);
  if (d.featured !== String(featuredIdx)) d.featured = String(featuredIdx);

  const designW = parseInt(d.compW) || 720;
  const contentW = Math.max(120, designW - padX * 2);   // 카드들이 놓일 안쪽 폭

  // 가로 폭: featured = baseW * featScale, 나머지는 baseW, 인접 칼럼은 overlap만큼 겹침
  const baseW = Math.round((contentW + overlap * (N - 1)) / ((N - 1) + featScale));
  const featW = Math.round(baseW * featScale);

  // 각 칼럼 높이 (featured만 header/row/gap 확대). 각 카드 상하 padY 포함.
  const colHeightOf = (rowsLen, isFeat) => {
    const hH  = isFeat ? Math.round(headerH * featScale) : headerH;
    const rH  = isFeat ? Math.round(rowH * featScale) : rowH;
    const gap = isFeat ? Math.round(rowGap * featScale) : rowGap;
    return padY * 2 + hH + rowsLen * (rH + gap);
  };
  const heights = cols.map((c, i) => colHeightOf(c.rows.length, i === featuredIdx));
  const totalH = Math.max(...heights, 1);
  const designH = totalH + yPad * 2;

  block.style.position = 'relative';
  block.style.overflow = 'visible';
  block.style.width = '100%';
  block.style.maxWidth = 'none';   // 테이블 등 일반 블록과 동일하게 컨테이너 폭을 꽉 채움 (designW는 내부 좌표 기준일 뿐)
  block.style.margin = '0';

  let inner = block.querySelector('.cmp-inner');
  if (!inner) { inner = document.createElement('div'); inner.className = 'cmp-inner'; block.appendChild(inner); }
  inner.innerHTML = '';
  inner.style.cssText = `position:absolute;top:0;left:0;right:auto;bottom:auto;width:${designW}px;height:${designH}px;transform-origin:top left;overflow:visible;`;

  const buildCol = (idx, c, isFeat, left, w) => {
    const col = document.createElement('div');
    col.className = 'cmp-col' + (isFeat ? ' cmp-feat' : ' cmp-muted');
    col.dataset.colIdx = idx;
    const hH    = isFeat ? Math.round(headerH * featScale) : headerH;
    const rH    = isFeat ? Math.round(rowH * featScale) : rowH;
    const gap   = isFeat ? Math.round(rowGap * featScale) : rowGap;
    const tFont = isFeat ? Math.round(baseTitleFont * featScale) : baseTitleFont;
    const rFont = isFeat ? Math.round(baseRowFont * featScale) : baseRowFont;
    const rad   = isFeat ? Math.round(radius * featScale) : radius;
    const h = colHeightOf(c.rows.length, isFeat);
    const top = yPad + (totalH - h) / 2;             // 모든 칼럼을 공통 중심선에 정렬 → featured가 위·아래 overhang
    const bg = c.bg || (isFeat ? '#ffffff' : '#e9ebef');
    const textColor = c.text || (isFeat ? '#1a1a1a' : '#9aa0a8');
    col.style.cssText = `position:absolute;left:${left}px;top:${top}px;width:${w}px;` +
      `padding:${padY}px 0;box-sizing:border-box;background:${bg};border-radius:${rad}px;` +
      `z-index:${isFeat ? 2 : 1};overflow:hidden;` +
      (isFeat ? 'box-shadow:0 18px 50px rgba(0,0,0,0.22);' : '');

    // 헤더
    const hd = document.createElement('div');
    hd.className = 'cmp-hd'; hd.dataset.colIdx = idx;
    hd.textContent = c.title || '';
    hd.style.cssText = `height:${hH}px;display:flex;align-items:center;justify-content:center;text-align:center;` +
      `font-size:${tFont}px;font-weight:${isFeat ? 800 : 700};color:${textColor};padding:0 16px;box-sizing:border-box;line-height:1.2;`;
    _editableTitle(hd, block, idx);
    col.appendChild(hd);
    // 행
    c.rows.forEach((txt, ri) => {
      const r = document.createElement('div');
      r.className = 'cmp-row'; r.dataset.colIdx = idx; r.dataset.rowIdx = ri;
      r.textContent = txt;
      r.style.cssText = `height:${rH}px;margin-top:${gap}px;display:flex;align-items:center;justify-content:center;text-align:center;` +
        `font-size:${rFont}px;font-weight:${isFeat ? 600 : 400};color:${textColor};padding:0 12px;box-sizing:border-box;`;
      _editableRow(r, block, idx, ri);
      col.appendChild(r);
    });
    return col;
  };

  let x = padX;
  cols.forEach((c, i) => {
    const isFeat = i === featuredIdx;
    const w = isFeat ? featW : baseW;
    inner.appendChild(buildCol(i, c, isFeat, x, w));
    x += w - overlap;
  });

  const applyScale = () => {
    const aw = block.offsetWidth; if (aw <= 0) return;
    const scale = aw / designW;
    inner.style.transform = `scale(${scale})`;
    block.style.height = (designH * scale) + 'px';
    block._cmpScale = scale;
  };
  applyScale();
  if (block._cmpRO) block._cmpRO.disconnect();
  block._cmpRO = new ResizeObserver(applyScale);
  block._cmpRO.observe(block);
}

function _editableTitle(el, block, colIdx) {
  el.setAttribute('contenteditable', 'false');
  el.addEventListener('dblclick', e => { e.stopPropagation(); el.setAttribute('contenteditable', 'true'); el.focus(); });
  el.addEventListener('blur', () => {
    el.setAttribute('contenteditable', 'false');
    const cols = getComparisonCols(block.dataset);
    if (cols[colIdx]) { cols[colIdx].title = el.textContent; setComparisonCols(block, cols); }
    window.pushHistory?.(); window.scheduleAutoSave?.();
    if (block.classList.contains('selected')) window.showComparisonProperties?.(block);
  });
}
function _editableRow(el, block, colIdx, rowIdx) {
  el.setAttribute('contenteditable', 'false');
  el.addEventListener('dblclick', e => { e.stopPropagation(); el.setAttribute('contenteditable', 'true'); el.focus(); });
  el.addEventListener('blur', () => {
    el.setAttribute('contenteditable', 'false');
    const cols = getComparisonCols(block.dataset);
    if (cols[colIdx]) { cols[colIdx].rows[rowIdx] = el.textContent; setComparisonCols(block, cols); }
    window.pushHistory?.(); window.scheduleAutoSave?.();
    if (block.classList.contains('selected')) window.showComparisonProperties?.(block);
  });
}

function makeComparisonBlock(data = {}) {
  const row = document.createElement('div');
  row.className = 'row'; row.id = genId('row'); row.dataset.layout = 'stack';
  const block = document.createElement('div');
  block.className = 'comparison-block'; block.dataset.type = 'comparison';
  block.id = genId('cmp');
  block.dataset.layerName = data.layerName || 'Comparison';
  block.dataset.compW     = data.compW ?? 720;
  block.dataset.featScale = data.featScale ?? 1.2;
  block.dataset.titleFont = data.titleFont ?? 26;
  block.dataset.rowFont   = data.rowFont ?? 18;
  block.dataset.padX      = data.padX ?? 0;
  block.dataset.padY      = data.padY ?? 0;
  block.dataset.overlap   = data.overlap ?? 32;
  block.dataset.radius    = data.radius ?? 20;
  block.dataset.headerH   = data.headerH ?? 72;
  block.dataset.rowH      = data.rowH ?? 64;
  block.dataset.rowGap    = data.rowGap ?? 8;
  const defaultCols = [
    { title: data.leftTitle  ?? '일반 제품',        bg: data.leftBg  || '#e9ebef', text: data.leftText  || '#9aa0a8', rows: data.leftRows  || ['경쟁사 내용', '경쟁사 내용', '경쟁사 내용', '경쟁사 내용'] },
    { title: data.rightTitle ?? '브랜드 명·상품 명', bg: data.rightBg || '#ffffff', text: data.rightText || '#1a1a1a', rows: data.rightRows || ['강점 키워드 입력', '강점 키워드 입력', '강점 키워드 입력', '강점 키워드 입력'] },
  ];
  const cols0 = data.cols || defaultCols;
  block.dataset.cols = JSON.stringify(cols0);
  // featured: 인덱스. 구버전 'left'/'right'도 허용. 기본은 마지막(오른쪽) 칼럼.
  // Codex Medium 픽스: cols 3개 이상에서 '1' 하드코딩이 가운데를 강조하던 회귀 수정.
  block.dataset.featured = data.featured != null
    ? String(data.featured)
    : String(Math.max(0, (Array.isArray(cols0) ? cols0.length : 2) - 1));
  renderComparison(block);
  row.appendChild(block);
  return { row, block };
}

function addComparisonBlock(opts = {}) {
  if (window._insertToFlowFrame?.(() => makeComparisonBlock(opts))) return null;
  const sec = window.getSelectedSection();
  if (!sec) { showNoSelectionHint(); return null; }
  window.pushHistory();
  const { row, block } = makeComparisonBlock(opts);
  insertAfterSelected(sec, row);
  bindBlock(block);
  window.buildLayerPanel();
  // 방금 추가한 블록 자동 선택 + 화면 안으로 스크롤 (C9)
  try { window.selectBlock?.(block.id); } catch (_) {}
  row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  window.scheduleAutoSave?.();
  return { row, block };
}

// ── 수정 ────────────────────────────────────────────────────────────────────
// PM의 update_comparison_block(MCP) → main(_invokeRendererUpdateComparisonBlock) → 여기.
// banner02 updateBanner02Block 패턴 미러. dataset partial write + renderComparison 재렌더 + autoSave.
// 지원 필드 (data-* 매핑):
//   - 외곽: compW, featScale, overlap, radius, padX, padY, headerH, rowH, rowGap
//   - 텍스트: titleFont, rowFont
//   - 강조: featured (int index)
//   - 칼럼 전체: cols (배열 전체 교체, 길이 2~8, rows ≤ 20)
//   - 칼럼 단위 patch: columnPatch [{index, title?, bg?, text?, rows?}, ...]
//   - 메타: layerName
function updateComparisonBlock(blockId, partial = {}) {
  if (!blockId) return { ok: false, code: 'NOT_FOUND', message: 'blockId required' };
  const block = document.getElementById(String(blockId));
  if (!block || !block.classList.contains('comparison-block')) {
    return { ok: false, code: 'NOT_FOUND', message: `comparison-block not found: ${blockId}` };
  }
  if (partial == null || typeof partial !== 'object') {
    return { ok: false, code: 'INVALID', message: 'partial must be object' };
  }

  // Codex Medium 픽스: 검증 단계에서 어떤 dataset도 mutate하지 않는다.
  // 모든 검증을 통과한 후에만 마지막에 일괄 commit. 실패해도 상태는 변화 없음.
  const draft = {};      // 데이터셋 단순 필드 (key → string)
  const applied = {};    // 반환용 요약
  let draftCols = null;  // cols 변경분 (cols 전체교체 또는 columnPatch 적용 후)

  const _setNumDraft = (datasetKey, value, min, max, appliedKey) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return { ok: false, msg: `${appliedKey || datasetKey} must be finite number` };
    if (min !== undefined && n < min) return { ok: false, msg: `${appliedKey || datasetKey} < ${min}` };
    if (max !== undefined && n > max) return { ok: false, msg: `${appliedKey || datasetKey} > ${max}` };
    draft[datasetKey] = String(n);
    applied[appliedKey || datasetKey] = n;
    return { ok: true };
  };

  if (partial.layerName !== undefined && partial.layerName !== null) {
    const s = String(partial.layerName);
    if ([...s].length > 100) return { ok: false, code: 'INVALID', message: 'layerName too long' };
    draft.layerName = s;
    applied.layerName = s;
  }

  // 외곽/크기
  const _numFields = [
    ['compW',     'compW',     120, 4000],
    ['overlap',   'overlap',   0,   400],
    ['radius',    'radius',    0,   400],
    ['padX',      'padX',      0,   400],
    ['padY',      'padY',      0,   400],
    ['headerH',   'headerH',   16,  400],
    ['rowH',      'rowH',      16,  400],
    ['rowGap',    'rowGap',    0,   200],
    ['titleFont', 'titleFont', 4,   400],
    ['rowFont',   'rowFont',   4,   400],
  ];
  for (const [pk, dk, min, max] of _numFields) {
    if (partial[pk] === undefined || partial[pk] === null) continue;
    const r = _setNumDraft(dk, partial[pk], min, max, pk);
    if (!r.ok) return { ok: false, code: 'INVALID', message: r.msg };
  }

  if (partial.featScale !== undefined && partial.featScale !== null) {
    const n = Number(partial.featScale);
    if (!Number.isFinite(n) || n < 1 || n > 1.5) {
      return { ok: false, code: 'INVALID', message: 'featScale out of range (1.0~1.5)' };
    }
    draft.featScale = String(n);
    applied.featScale = n;
  }

  // cols 전체 교체 (draft만 갱신, mutate X)
  if (partial.cols !== undefined && partial.cols !== null) {
    if (!Array.isArray(partial.cols)) {
      return { ok: false, code: 'INVALID', message: 'cols must be array' };
    }
    if (partial.cols.length < 2 || partial.cols.length > 8) {
      return { ok: false, code: 'INVALID', message: 'cols length must be 2~8' };
    }
    const safeCols = [];
    for (let i = 0; i < partial.cols.length; i++) {
      const c = partial.cols[i];
      if (!c || typeof c !== 'object') {
        return { ok: false, code: 'INVALID', message: `cols[${i}] must be object` };
      }
      const title = c.title != null ? String(c.title) : '';
      if ([...title].length > 200) return { ok: false, code: 'INVALID', message: `cols[${i}].title too long` };
      const bg    = c.bg   != null ? String(c.bg)   : '';
      const text  = c.text != null ? String(c.text) : '';
      if (bg.length > 1024 || text.length > 64) return { ok: false, code: 'INVALID', message: `cols[${i}] color too long` };
      const rows  = Array.isArray(c.rows) ? c.rows : [];
      if (rows.length > 20) return { ok: false, code: 'INVALID', message: `cols[${i}].rows length > 20` };
      const safeRows = [];
      for (let ri = 0; ri < rows.length; ri++) {
        const s = rows[ri] == null ? '' : String(rows[ri]);
        if ([...s].length > 500) return { ok: false, code: 'INVALID', message: `cols[${i}].rows[${ri}] too long` };
        safeRows.push(s);
      }
      safeCols.push({ title, bg, text, rows: safeRows });
    }
    draftCols = safeCols;
    applied.cols = safeCols;
  }

  // columnPatch — 개별 칼럼 부분 갱신 (draft만 갱신, mutate X)
  if (partial.columnPatch !== undefined && partial.columnPatch !== null) {
    if (!Array.isArray(partial.columnPatch)) {
      return { ok: false, code: 'INVALID', message: 'columnPatch must be array' };
    }
    if (partial.columnPatch.length > 16) {
      return { ok: false, code: 'INVALID', message: 'columnPatch too long' };
    }
    // cols 전체교체 결과를 base로 사용 (없으면 현재 dataset). 둘 다 draft 단계라 mutate X.
    const base = draftCols ? draftCols.map(c => ({ ...c, rows: [...c.rows] })) : getComparisonCols(block.dataset);
    const appliedPatches = [];
    for (let pi = 0; pi < partial.columnPatch.length; pi++) {
      const p = partial.columnPatch[pi];
      if (!p || typeof p !== 'object') {
        return { ok: false, code: 'INVALID', message: `columnPatch[${pi}] must be object` };
      }
      const idx = Number(p.index);
      if (!Number.isInteger(idx) || idx < 0 || idx >= base.length) {
        return { ok: false, code: 'INVALID', message: `columnPatch[${pi}].index ${p.index} out of range (0~${base.length - 1})` };
      }
      const col = base[idx];
      if (p.title !== undefined && p.title !== null) {
        const t = String(p.title);
        if ([...t].length > 200) return { ok: false, code: 'INVALID', message: `columnPatch[${pi}].title too long` };
        col.title = t;
      }
      if (p.bg !== undefined && p.bg !== null) {
        const v = String(p.bg);
        if (v.length > 1024) return { ok: false, code: 'INVALID', message: `columnPatch[${pi}].bg too long` };
        col.bg = v;
      }
      if (p.text !== undefined && p.text !== null) {
        const v = String(p.text);
        if (v.length > 64) return { ok: false, code: 'INVALID', message: `columnPatch[${pi}].text too long` };
        col.text = v;
      }
      if (p.rows !== undefined && p.rows !== null) {
        if (!Array.isArray(p.rows)) return { ok: false, code: 'INVALID', message: `columnPatch[${pi}].rows must be array` };
        if (p.rows.length > 20) return { ok: false, code: 'INVALID', message: `columnPatch[${pi}].rows length > 20` };
        const newRows = [];
        for (let ri = 0; ri < p.rows.length; ri++) {
          const s = p.rows[ri] == null ? '' : String(p.rows[ri]);
          if ([...s].length > 500) return { ok: false, code: 'INVALID', message: `columnPatch[${pi}].rows[${ri}] too long` };
          newRows.push(s);
        }
        col.rows = newRows;
      }
      appliedPatches.push({ index: idx });
    }
    draftCols = base;
    applied.columnPatch = appliedPatches;
  }

  // featured (int index) — cols 변경분과의 정합성 검사
  let draftFeatured = null;
  if (partial.featured !== undefined && partial.featured !== null) {
    const refCols = draftCols || getComparisonCols(block.dataset);
    const fi = Number(partial.featured);
    if (!Number.isInteger(fi) || fi < 0 || fi >= refCols.length) {
      return { ok: false, code: 'INVALID', message: `featured ${partial.featured} out of range (0~${refCols.length - 1})` };
    }
    draftFeatured = String(fi);
    applied.featured = fi;
  }

  // before 스냅샷 (commit 직전, 검증 모두 통과 후)
  const before = {
    cols: block.dataset.cols, featured: block.dataset.featured,
    featScale: block.dataset.featScale, compW: block.dataset.compW,
  };

  // ── 모든 검증 통과 — 여기서부터 mutate ──
  window.pushHistory?.();

  // 단순 필드 (key=value)
  for (const [k, v] of Object.entries(draft)) {
    block.dataset[k] = v;
  }
  // cols 변경분
  if (draftCols) block.dataset.cols = JSON.stringify(draftCols);
  // featured
  if (draftFeatured !== null) block.dataset.featured = draftFeatured;

  // 재렌더
  try {
    renderComparison(block);
  } catch (e) {
    return { ok: false, code: 'RENDER_ERROR', message: e.message };
  }

  if (block.classList.contains('selected')) {
    try { window.showComparisonProperties?.(block); } catch (_) {}
  }
  try { window.buildLayerPanel?.(); } catch (_) {}

  window.scheduleAutoSave?.();

  return { ok: true, blockId, before, applied };
}

window.makeComparisonBlock = makeComparisonBlock;
window.addComparisonBlock  = addComparisonBlock;
window.updateComparisonBlock = updateComparisonBlock;
window.renderComparison    = renderComparison;
window.getComparisonCols   = getComparisonCols;
window.getComparisonFeaturedIdx = getComparisonFeaturedIdx;
window.setComparisonCols   = setComparisonCols;

export { makeComparisonBlock, addComparisonBlock, updateComparisonBlock, renderComparison, getComparisonCols, getComparisonFeaturedIdx, setComparisonCols };
