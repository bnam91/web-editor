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
  block.dataset.cols = JSON.stringify(data.cols || defaultCols);
  // featured: 인덱스. 구버전 'left'/'right'도 허용. 기본은 마지막(오른쪽) 칼럼.
  block.dataset.featured = data.featured != null ? String(data.featured) : '1';
  renderComparison(block);
  row.appendChild(block);
  return { row, block };
}

function addComparisonBlock(opts = {}) {
  if (window._insertToFlowFrame?.(() => makeComparisonBlock(opts))) return;
  const sec = window.getSelectedSection();
  if (!sec) { showNoSelectionHint(); return; }
  window.pushHistory();
  const { row, block } = makeComparisonBlock(opts);
  insertAfterSelected(sec, row);
  bindBlock(block);
  window.buildLayerPanel();
  window.selectSection(sec);
}

window.makeComparisonBlock = makeComparisonBlock;
window.addComparisonBlock  = addComparisonBlock;
window.renderComparison    = renderComparison;
window.getComparisonCols   = getComparisonCols;
window.getComparisonFeaturedIdx = getComparisonFeaturedIdx;
window.setComparisonCols   = setComparisonCols;

export { makeComparisonBlock, addComparisonBlock, renderComparison, getComparisonCols, getComparisonFeaturedIdx, setComparisonCols };
