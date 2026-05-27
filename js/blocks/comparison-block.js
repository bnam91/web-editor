// comparison-block.js — 1급 비교 블록 (banner02 패턴). 2칼럼: 한쪽(featured)이 떠보이게(그림자·overlap·높이↑).
import { genId, showNoSelectionHint, insertAfterSelected } from '../drag-utils.js';
import { bindBlock } from '../drag-drop.js';

const _rows = s => { try { return JSON.parse(s || '[]'); } catch { return []; } };

function renderComparison(block) {
  const d = block.dataset;
  const featured = d.featured === 'left' ? 'left' : 'right';
  const elevation = parseInt(d.elevation) || 40;
  const overlap   = parseInt(d.overlap) || 32;
  const radius    = parseInt(d.radius) || 20;
  const headerH   = parseInt(d.headerH) || 72;
  const rowH      = parseInt(d.rowH) || 64;
  const rowGap    = parseInt(d.rowGap) || 8;
  const leftRows  = _rows(d.leftRows);
  const rightRows = _rows(d.rightRows);

  const colH = (rows) => headerH + rows.length * (rowH + rowGap);
  const leftH = colH(leftRows), rightH = colH(rightRows);
  const designW = parseInt(d.compW) || 720;
  const designH = Math.max(leftH, rightH) + elevation + 24; // 그림자 여유

  // featured 칼럼이 더 넓게
  const featW = Math.round(designW * 0.52);
  const mutedW = designW - featW + overlap;

  block.style.position = 'relative';
  block.style.overflow = 'visible';
  block.style.width = '100%';
  block.style.maxWidth = designW + 'px';
  block.style.margin = '0 auto';

  let inner = block.querySelector('.cmp-inner');
  if (!inner) { inner = document.createElement('div'); inner.className = 'cmp-inner'; block.appendChild(inner); }
  inner.innerHTML = '';
  inner.style.cssText = `position:absolute;top:0;left:0;right:auto;bottom:auto;width:${designW}px;height:${designH}px;transform-origin:top left;overflow:visible;`;

  const buildCol = (side, rows, isFeat) => {
    const col = document.createElement('div');
    col.className = 'cmp-col cmp-' + side + (isFeat ? ' cmp-feat' : ' cmp-muted');
    const w = isFeat ? featW : mutedW;
    const h = isFeat ? (colH(rows)) : (colH(rows));
    let left;
    if (side === 'left') left = 0;
    else left = designW - w;
    const top = isFeat ? 0 : elevation;
    col.style.cssText = `position:absolute;left:${left}px;top:${top}px;width:${w}px;` +
      `background:${d[side + 'Bg'] || (isFeat ? '#ffffff' : '#e9ebef')};border-radius:${radius}px;` +
      `z-index:${isFeat ? 2 : 1};overflow:hidden;` +
      (isFeat ? 'box-shadow:0 12px 40px rgba(0,0,0,0.18);' : '');

    const textColor = d[side + 'Text'] || (isFeat ? '#1a1a1a' : '#9aa0a8');
    // 헤더
    const hd = document.createElement('div');
    hd.className = 'cmp-hd'; hd.dataset.field = side + 'Title';
    hd.textContent = d[side + 'Title'] || '';
    hd.style.cssText = `height:${headerH}px;display:flex;align-items:center;justify-content:center;text-align:center;` +
      `font-size:${parseInt(d[side + 'TitleSize']) || (isFeat ? 28 : 26)}px;font-weight:700;color:${textColor};padding:0 16px;box-sizing:border-box;`;
    _editable(hd, block, side + 'Title');
    col.appendChild(hd);
    // 행
    rows.forEach((txt, i) => {
      const r = document.createElement('div');
      r.className = 'cmp-row'; r.dataset.rowSide = side; r.dataset.rowIdx = i;
      r.textContent = txt;
      r.style.cssText = `height:${rowH}px;margin-top:${rowGap}px;display:flex;align-items:center;justify-content:center;text-align:center;` +
        `font-size:${isFeat ? 20 : 18}px;color:${textColor};padding:0 12px;box-sizing:border-box;`;
      _editableRow(r, block, side, i);
      col.appendChild(r);
    });
    return col;
  };

  inner.appendChild(buildCol('left', leftRows, featured === 'left'));
  inner.appendChild(buildCol('right', rightRows, featured === 'right'));

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

function _editable(el, block, field) {
  el.setAttribute('contenteditable', 'false');
  el.addEventListener('dblclick', e => { e.stopPropagation(); el.setAttribute('contenteditable', 'true'); el.focus(); });
  el.addEventListener('blur', () => {
    el.setAttribute('contenteditable', 'false');
    block.dataset[field] = el.textContent;
    window.pushHistory?.(); window.scheduleAutoSave?.();
    if (block.classList.contains('selected')) window.showComparisonProperties?.(block);
  });
}
function _editableRow(el, block, side, idx) {
  el.setAttribute('contenteditable', 'false');
  el.addEventListener('dblclick', e => { e.stopPropagation(); el.setAttribute('contenteditable', 'true'); el.focus(); });
  el.addEventListener('blur', () => {
    el.setAttribute('contenteditable', 'false');
    const arr = _rows(block.dataset[side + 'Rows']);
    arr[idx] = el.textContent; block.dataset[side + 'Rows'] = JSON.stringify(arr);
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
  block.dataset.featured  = data.featured || 'right';
  block.dataset.elevation = data.elevation ?? 40;
  block.dataset.overlap   = data.overlap ?? 32;
  block.dataset.radius    = data.radius ?? 20;
  block.dataset.headerH   = data.headerH ?? 72;
  block.dataset.rowH      = data.rowH ?? 64;
  block.dataset.rowGap    = data.rowGap ?? 8;
  block.dataset.leftTitle  = data.leftTitle  ?? '일반 제품';
  block.dataset.leftTitleSize = data.leftTitleSize ?? 26;
  block.dataset.leftBg    = data.leftBg   || '#e9ebef';
  block.dataset.leftText  = data.leftText || '#9aa0a8';
  block.dataset.leftRows  = JSON.stringify(data.leftRows  || ['경쟁사 내용', '경쟁사 내용', '경쟁사 내용', '경쟁사 내용']);
  block.dataset.rightTitle = data.rightTitle ?? '브랜드 명·상품 명';
  block.dataset.rightTitleSize = data.rightTitleSize ?? 28;
  block.dataset.rightBg   = data.rightBg  || '#ffffff';
  block.dataset.rightText = data.rightText || '#1a1a1a';
  block.dataset.rightRows = JSON.stringify(data.rightRows || ['강점 키워드 입력', '강점 키워드 입력', '강점 키워드 입력', '강점 키워드 입력']);
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

export { makeComparisonBlock, addComparisonBlock, renderComparison };
