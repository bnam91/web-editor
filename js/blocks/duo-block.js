/* ═══════════════════════════════════
   DUO BLOCK — 다단(2~4컬럼) 레이아웃 프리미티브 (BL-CDD-02)
   ★상한 4 = 2026-09-04 4x4 피커. 중첩 duo(라인 안)만 3 유지(:77).
═══════════════════════════════════ */
//
// 봉인된 NewGrid(자유 중첩 그리드)의 대체가 아니라, 상세페이지에서 실제로 필요한
// "정형 다단"(좌 수치/우 설명, 양극 게이지, 좌 이미지/우 텍스트)만 안전하게 커버한다.
// 자식 블록 중첩 없음 — 상태는 전부 data-*(cols JSON), renderDuoBlock이 인라인 스타일로만
// 재조립(직렬화·HTML export 그대로 생존, step/infocard 패턴).
//
// cols: [{ width:1, align:'left', valign:'top', bg:'', padding:0, radius:0,
//          lines:[{ type:'label|h1|h2|h3|body|caption|image|gap',
//                   text?, fontSize?, color?, weight?, align?, marginTop?,
//                   imgSrc?, height?(image/gap), radius?(image) }] }]

import { insertAfterSelected, genId } from '../drag-utils.js';
import { bindBlock } from '../drag-drop.js';

const DUO_DEFAULTS = {
  gap: 24,
  valign: 'top', // top | middle | bottom
  cols: [
    { width: 1, lines: [{ type: 'h2', text: '왼쪽 컬럼' }, { type: 'body', text: '내용을 입력하세요.' }] },
    { width: 1, lines: [{ type: 'h2', text: '오른쪽 컬럼' }, { type: 'body', text: '내용을 입력하세요.' }] },
  ],
};

// 컬럼 스케일 텍스트 롤 기본값 (풀폭 h1 104px는 다단에선 과대 — 컬럼용 축소 기준)
const _DUO_ROLES = {
  label:   { size: 16, weight: 600, lh: 1.4, ls: '0.04em' },
  h1:      { size: 64, weight: 800, lh: 1.1, ls: '-0.02em' },
  h2:      { size: 40, weight: 700, lh: 1.2, ls: '-0.01em' },
  h3:      { size: 28, weight: 700, lh: 1.3, ls: '0' },
  body:    { size: 22, weight: 400, lh: 1.6, ls: '0' },
  caption: { size: 14, weight: 400, lh: 1.5, ls: '0' },
};
const _DUO_VALIGN = { top: 'flex-start', middle: 'center', bottom: 'flex-end' };
const _DUO_COLOR_RE = /^(#[0-9a-fA-F]{3,8}|transparent)$|^(rgb|rgba|hsl|hsla)\(\s*[\d.,\s%/]+\)$/;
const _esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function _duoCols(block) {
  let cols;
  try { cols = JSON.parse(block.dataset.cols || '[]'); } catch (_) { cols = []; }
  if (!Array.isArray(cols) || cols.length < 2) cols = JSON.parse(JSON.stringify(DUO_DEFAULTS.cols));
  return cols.slice(0, 4);   // ★상한 4 (2026-09-04, 4x4 피커) — updateDuoBlock 검증과 «같은 값»이어야 한다

}

function _duoLineHtml(line, colAlign, depth = 0) {
  if (!line || typeof line !== 'object') return '';
  // ★필드 별칭 정규화 (2026-07-04 bench2 근본픽스): planner/generator는 텍스트블록 어휘(content)를
  // 라인에도 쓴다 — text만 읽으면 "그릇만 있고 내용 없음"(오렌지 바에 빈 텍스트, duo 통째 미렌더).
  // 러너는 pass-through(계약: 스펙 필드 = API 필드)이므로 파서가 별칭을 수용하는 게 1:1 계약의 근본 해법.
  if (line.text === undefined && line.content !== undefined) line = { ...line, text: line.content };
  const mt = Number.isFinite(Number(line.marginTop)) ? Number(line.marginTop) : null;
  const mtCss = mt !== null ? `margin-top:${mt}px;` : '';
  if (line.type === 'gap') {
    const h = Number(line.height) || 16;
    return `<div class="duo-gap" style="height:${h}px;${mtCss}"></div>`;
  }
  if (line.type === 'image') {
    const h = Number(line.height) || 0;
    const r = Number(line.radius) || 0;
    if (!line.imgSrc) {
      // 빈 이미지 슬롯: 발주 대기 placeholder (기존 ''=투명 소실 → 카드가 깨져 보이던 문제)
      const ph = h > 0 ? h : 180;
      return `<div class="duo-img duo-img-empty" style="width:100%;height:${ph}px;background:#e8e8e8;` +
        `border-radius:${r > 0 ? r : 8}px;${mtCss}"></div>`;
    }
    const sizeCss = h > 0 ? `height:${h}px;object-fit:cover;` : 'height:auto;';
    return `<img class="duo-img" src="${_esc(line.imgSrc)}" draggable="false" style="display:block;width:100%;${sizeCss}${r > 0 ? `border-radius:${r}px;` : ''}${mtCss}">`;
  }
  // 중첩 duo: {type:'duo', gap, valign, cols:[{width, lines[]}]} — innercard 후기카드 등 (BL-SFB-01)
  if (line.type === 'duo') {
    if (depth >= 2) return '';                       // 무한 중첩 가드 (2단까지)
    // ⛔중첩 duo(라인 안의 duo)는 상한 3 «그대로» — 4x4 피커는 «블록» 대상이라
    //   중첩까지 넓히면 innercard 렌더 회귀 범위가 커진다(PLAN §P1 회귀위험).
    const cols = Array.isArray(line.cols) ? line.cols.slice(0, 3) : [];
    if (!cols.length) return '';
    const gap = Number(line.gap) || 24;
    const valign = _DUO_VALIGN[line.valign] || 'flex-start';
    const colsHtml = cols.map(c => {
      const w = Number(c.width) || 1;
      const inner = (Array.isArray(c.lines) ? c.lines : [])
        .map(l => _duoLineHtml(l, c.align || colAlign, depth + 1)).join('');
      // 바깥 duo 와 «같은» 정렬 축을 쓴다 — 컬럼은 stretch, 정렬은 컬럼 안 내용(justify-content).
      return `<div class="duo-nested-col" style="flex:${w};min-width:0;display:flex;flex-direction:column;justify-content:${valign};">${inner}</div>`;
    }).join('');
    return `<div class="duo-nested" style="display:flex;gap:${gap}px;align-items:stretch;${mtCss}">${colsHtml}</div>`;
  }
  // 중첩 graph: {type:'graph', items:[{label,value,barColor?}]} — 정적 가로바 렌더 (BL-SFB-01).
  // bar-h 외 chartType도 카드 내부에선 동일한 가로바 표현으로 수용 (독립 그래프는 graph-block 몫).
  if (line.type === 'graph') {
    const items = Array.isArray(line.items) ? line.items.slice(0, 10) : [];
    if (!items.length) return '';
    const barColor   = (typeof line.barColor === 'string' && line.barColor) ? line.barColor : '#2d6fe8';
    const trackColor = (typeof line.trackColor === 'string' && line.trackColor) ? line.trackColor : '#e8e8e8';
    const valueColor = (typeof line.valueColor === 'string' && line.valueColor) ? line.valueColor : '#171717';
    const labelColor = (typeof line.labelColor === 'string' && line.labelColor) ? line.labelColor : '#555555';
    const labelSize  = Number(line.labelSize) || 20;
    const valueSize  = Number(line.valueSize) || Math.round(labelSize * 1.6);
    const rows = items.map(it => {
      const v = Math.max(0, Math.min(100, Number(it.value) || 0));
      const bc = (typeof it.barColor === 'string' && it.barColor) ? it.barColor : barColor;
      return `<div class="duo-graph-item" style="margin-top:18px;">` +
        `<div style="display:flex;align-items:baseline;gap:12px;">` +
          `<span style="font-size:${valueSize}px;font-weight:800;color:${valueColor};line-height:1;">${v}%</span>` +
          `<span style="font-size:${labelSize}px;color:${labelColor};line-height:1.3;word-break:keep-all;">${_esc(it.label ?? '')}</span>` +
        `</div>` +
        `<div style="margin-top:10px;height:18px;border-radius:9px;background:${trackColor};overflow:hidden;">` +
          `<div style="width:${v}%;height:100%;border-radius:9px;background:${bc};"></div>` +
        `</div></div>`;
    }).join('');
    return `<div class="duo-graph" style="width:100%;${mtCss}">${rows}</div>`;
  }
  const role = _DUO_ROLES[line.type] || _DUO_ROLES.body;
  const size = Number(line.fontSize) || role.size;
  const weight = line.weight !== undefined ? String(line.weight) : String(role.weight);
  const color = (typeof line.color === 'string' && _DUO_COLOR_RE.test(line.color.trim())) ? line.color.trim() : '';
  const align = line.align || colAlign || 'left';
  // 뱃지/필: line.bg 지정 시 inline-block 필로 렌더 — 지정 bg가 조용히 탈락해
  // 카드 위 무배경 텍스트(색 반전처럼 보임)로 뭉개지던 케이스 방지 (2026-07-04 제니 발주)
  const bg = (typeof line.bg === 'string' && _DUO_COLOR_RE.test(line.bg.trim())) ? line.bg.trim() : '';
  if (bg) {
    const padV = Number(line.padV) || Math.max(6, Math.round(size * 0.4));
    const padH = Number(line.padH) || Math.max(14, Math.round(size * 1.0));
    const rad = Number.isFinite(Number(line.radius)) ? Number(line.radius) : 999;
    return `<div style="text-align:${align};${mtCss}"><span class="duo-badge" style="display:inline-block;background:${bg};` +
      `font-size:${size}px;font-weight:${weight};line-height:1.2;letter-spacing:${role.ls};${color ? `color:${color};` : ''}` +
      `padding:${padV}px ${padH}px;border-radius:${rad}px;white-space:pre-wrap;word-break:keep-all;">${_esc(line.text ?? '')}</span></div>`;
  }
  return `<div class="duo-line duo-${_esc(line.type || 'body')}" style="font-size:${size}px;font-weight:${weight};line-height:${role.lh};letter-spacing:${role.ls};text-align:${align};${color ? `color:${color};` : ''}${mtCss}white-space:pre-wrap;word-break:keep-all;">${_esc(line.text ?? '')}</div>`;
}

function renderDuoBlock(block) {
  const cols = _duoCols(block);
  const gap = parseInt(block.dataset.gap);
  const gapPx = Number.isFinite(gap) ? gap : DUO_DEFAULTS.gap;
  const valign = _DUO_VALIGN[block.dataset.valign] || 'flex-start';

  block.style.width = '100%';
  block.style.boxSizing = 'border-box';

  const totalW = cols.reduce((s, c) => s + (Number(c.width) > 0 ? Number(c.width) : 1), 0) || 1;
  // ★세로 정렬의 축 = «컬럼 박스»가 아니라 «컬럼 안의 내용» (2026-09-03 fix/duo-layout-align).
  //   이전: .duo-inner{align-items:top|middle|bottom}. 이 축은 컬럼 박스를 움직이는데,
  //   flex-start/center/flex-end 는 컬럼 박스를 «내용 크기»로 줄여버려 정렬이 쓸 여백을 스스로 0으로
  //   만든다 → 두 컬럼이 동형인 기본 듀오에서는 상단/중앙/하단 어느 것을 눌러도 화면 좌표 0px.
  //   지금: 컬럼은 항상 stretch(=블록 높이를 채움) + 컬럼 내부 justify-content 로 «내용»을 배치.
  //   ⇒ 배경/패딩이 있는 컬럼은 카드 높이가 서로 맞고, 여백이 있으면 내용이 실제로 이동한다.
  block.innerHTML = `<div class="duo-inner" style="display:flex;align-items:stretch;gap:${gapPx}px;width:100%;">
    ${cols.map(col => {
      const w = Number(col.width) > 0 ? Number(col.width) : 1;
      const bg = (typeof col.bg === 'string' && _DUO_COLOR_RE.test(col.bg.trim())) ? col.bg.trim() : '';
      const pad = Number(col.padding) || 0;
      const r = Number(col.radius) || 0;
      const cv = _DUO_VALIGN[col.valign] || valign;   // 컬럼 개별 지정이 블록 기본값을 덮는다
      const lines = Array.isArray(col.lines) ? col.lines : [];
      return `<div class="duo-col" style="flex:${(w / totalW * 100).toFixed(2)} 1 0;min-width:0;display:flex;flex-direction:column;justify-content:${cv};${bg ? `background:${bg};` : ''}${pad > 0 ? `padding:${pad}px;` : ''}${r > 0 ? `border-radius:${r}px;` : ''}">
        ${lines.map(l => _duoLineHtml(l, col.align)).join('')}
      </div>`;
    }).join('')}
  </div>`;
}

function makeDuoBlock(opts = {}) {
  const block = document.createElement('div');
  block.className = 'duo-block';
  block.id = genId('duo');
  block.dataset.type = 'duo';
  const cols = (Array.isArray(opts.cols) && opts.cols.length >= 2) ? opts.cols.slice(0, 4) : JSON.parse(JSON.stringify(DUO_DEFAULTS.cols));
  block.dataset.cols = JSON.stringify(cols);
  block.dataset.gap = String(Number.isFinite(Number(opts.gap)) ? Number(opts.gap) : DUO_DEFAULTS.gap);
  block.dataset.valign = ['top', 'middle', 'bottom'].includes(opts.valign) ? opts.valign : DUO_DEFAULTS.valign;
  renderDuoBlock(block);

  const row = document.createElement('div');
  row.className = 'row';
  row.id = genId('row');
  row.dataset.layout = 'stack';
  row.appendChild(block);
  return { row, block };
}

function addDuoBlock(opts = {}) {
  const sec = window.getSelectedSection?.();
  if (!sec) { window.showNoSelectionHint?.(); return null; }
  window.pushHistory();
  const { row, block } = makeDuoBlock(opts);
  insertAfterSelected(sec, row);
  bindBlock(block);
  window.buildLayerPanel();
  try { window.selectBlock?.(block.id); } catch (_) {}
  row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  window.triggerAutoSave?.();
  return { row, block };
}

// updateStepBlock/updateInfoCardBlock 미러 — validate-then-commit + before 스냅샷.
// 지원: cols(전체 교체), patchCol {index, ...부분}(lines 교체 포함), gap, valign
function updateDuoBlock(blockId, partial = {}) {
  if (!blockId) return { ok: false, code: 'NOT_FOUND', message: 'blockId required' };
  const block = document.getElementById(String(blockId));
  if (!block || !block.classList.contains('duo-block')) {
    return { ok: false, code: 'NOT_FOUND', message: `duo-block not found: ${blockId}` };
  }
  if (partial == null || typeof partial !== 'object') {
    return { ok: false, code: 'INVALID', message: 'partial must be object' };
  }
  if (Object.keys(partial).length === 0) {
    return { ok: false, code: 'INVALID', message: 'partial is empty' };
  }

  const next = {};
  const applied = {};

  if (partial.cols !== undefined) {
    /* ★상한 3 → 4 (2026-09-04): 우측 패널 4×4 피커가 최대 4열을 준다.
     * 하한 2 는 유지한다 — 1열짜리 「그리드」는 그리드가 아니고, _duoCols 폴백이
     * 1열을 기본값으로 되돌려 «내용을 지우는» 함정이 있다(PLAN §P1 회귀위험). */
    if (!Array.isArray(partial.cols) || partial.cols.length < 2 || partial.cols.length > 4) {
      return { ok: false, code: 'INVALID', message: 'cols must be array of 2~4 columns' };
    }
    next.cols = JSON.stringify(partial.cols);
    applied.cols = partial.cols;
  }
  if (partial.patchCol !== undefined) {
    if (next.cols !== undefined) return { ok: false, code: 'INVALID', message: 'cols와 patchCol 동시 지정 불가' };
    const p = partial.patchCol;
    if (!p || typeof p !== 'object' || !Number.isFinite(Number(p.index))) {
      return { ok: false, code: 'INVALID', message: 'patchCol must be {index, ...}' };
    }
    const cols = _duoCols(block);
    const i = Number(p.index);
    if (i < 0 || i >= cols.length) return { ok: false, code: 'INVALID', message: `patchCol.index out of range (0~${cols.length - 1})` };
    const { index, ...rest } = p;
    cols[i] = Object.assign({}, cols[i], rest);
    next.cols = JSON.stringify(cols);
    applied.patchCol = { index: i, ...rest };
  }
  if (partial.gap !== undefined) {
    const n = Number(partial.gap);
    if (!Number.isFinite(n) || n < 0 || n > 200) return { ok: false, code: 'INVALID', message: 'gap must be 0~200' };
    next.gap = String(Math.round(n));
    applied.gap = Math.round(n);
  }
  if (partial.valign !== undefined) {
    if (!['top', 'middle', 'bottom'].includes(partial.valign)) {
      return { ok: false, code: 'INVALID', message: 'valign must be top|middle|bottom' };
    }
    next.valign = partial.valign;
    applied.valign = partial.valign;
  }

  const before = { cols: block.dataset.cols, gap: block.dataset.gap, valign: block.dataset.valign };
  window.pushHistory?.();
  Object.assign(block.dataset, next);
  try {
    renderDuoBlock(block);
  } catch (e) {
    Object.assign(block.dataset, before); // rollback
    try { renderDuoBlock(block); } catch (_) {}
    return { ok: false, code: 'RENDER_ERROR', message: e.message };
  }
  if (block.classList.contains('selected')) {
    try { window.showDuoProperties?.(block); } catch (_) {}
  }
  try { window.buildLayerPanel?.(); } catch (_) {}
  window.scheduleAutoSave?.();
  return { ok: true, blockId, before, applied };
}

window.makeDuoBlock = makeDuoBlock;
window.addDuoBlock = addDuoBlock;
window.updateDuoBlock = updateDuoBlock;
window.renderDuoBlock = renderDuoBlock;

// ★2026-09-04 P0: 사용자에게는 「그리드 블럭」으로 보인다(발주 ②) — 별칭만 추가, DOM 정체성
//   (.duo-block / dataset.type='duo' / duo_ id 접두사)은 P2까지 바꾸지 않는다(PLAN-gridblock.md 2-B).
window.addGridBlock = addDuoBlock;
window.updateGridBlock = updateDuoBlock;
window.renderGridBlock = renderDuoBlock;

// innercard-block 등 라인 스택형 블록이 같은 롤/렌더를 공유한다 (부품 공유 — 현빈 지시 2026-07-03)
export { makeDuoBlock, addDuoBlock, updateDuoBlock, renderDuoBlock, DUO_DEFAULTS, _duoLineHtml as duoLineHtml, _DUO_ROLES as DUO_ROLES };
