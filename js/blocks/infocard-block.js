/* ═══════════════════════════════════
   INFOCARD BLOCK — countup(빅넘버 스탯) / price(가격 카드) / review(리뷰 카드)
═══════════════════════════════════ */
//
// 의존성:
//   - insertAfterSelected, genId (drag-utils.js)
//   - bindBlock (drag-drop.js)
//   - window.getSelectedSection / window.showNoSelectionHint / window.pushHistory /
//     window.buildLayerPanel / window.triggerAutoSave / window.scheduleAutoSave
//
// 상태는 전부 data-* 에 저장(variant + data JSON + 스타일 키) →
// renderInfoCardBlock이 dataset 기준으로 innerHTML을 인라인 스타일로만 재조립
// (직렬화·HTML export에 그대로 살아남음, step-block 패턴).

import { insertAfterSelected, genId } from '../drag-utils.js';
import { bindBlock } from '../drag-drop.js';

const INFOCARD_DEFAULTS = {
  countup: { value: '1,260', unit: '개', label: '누적 판매', caption: '※ 2026-06 기준' },
  price:   { label: '최종 혜택가', originalPrice: '39,900', price: '29,900', currency: '원', discountPct: '25%', extras: ['적립 2%', '무료배송'] },
  review:  { stars: 5, author: 'kim****', body: '재구매입니다. 사진보다 실물이 더 좋고 배송도 빨라요.', date: '2026.06' },
};

const _IFC_VARIANTS = Object.keys(INFOCARD_DEFAULTS);
// variant별 데이터 키 (톱레벨 폴백 수용용 — 스타일 키와 충돌 없음)
const _IFC_DATA_KEYS = {
  countup: ['value', 'unit', 'label', 'caption', 'stats'],
  price:   ['label', 'originalPrice', 'price', 'currency', 'discountPct', 'extras'],
  review:  ['stars', 'author', 'body', 'date'],
};
const _IFC_COLOR_RE = /^(#[0-9a-fA-F]{3,8}|transparent)$|^(rgb|rgba|hsl|hsla)\(\s*[\d.,\s%/]+\)$/;

// textContent-safe escaping (block-factory addTableBlock _escHtml 패턴)
const _esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function _ifcData(block) {
  const variant = _IFC_VARIANTS.includes(block.dataset.variant) ? block.dataset.variant : 'countup';
  let raw = {};
  try { raw = JSON.parse(block.dataset.data || '{}'); } catch (_) { raw = {}; }
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) raw = {};
  return Object.assign({}, INFOCARD_DEFAULTS[variant], raw);
}

function renderInfoCardBlock(block) {
  const variant = _IFC_VARIANTS.includes(block.dataset.variant) ? block.dataset.variant : 'countup';
  const d = _ifcData(block);

  const align   = block.dataset.align === 'left' ? 'left' : 'center';
  const accent  = block.dataset.accentColor || '#2d6fe8';
  const text    = block.dataset.textColor   || '#222222';
  const sub     = block.dataset.subColor    || '#888888';
  const bg      = block.dataset.bg          || '';
  const radius  = parseInt(block.dataset.radius)    || 0;
  const padding = parseInt(block.dataset.padding)   || 0;
  const numSize = parseInt(block.dataset.numSize)   || 96;
  const titleSz = parseInt(block.dataset.titleSize) || 20;
  const bodySz  = parseInt(block.dataset.bodySize)  || 26;

  const justify = align === 'left' ? 'flex-start' : 'center';

  // 카드 컨테이너 — bg/radius/padding은 block 인라인 스타일 (직렬화 유지)
  block.style.width        = '100%';
  block.style.boxSizing    = 'border-box';
  block.style.background   = bg || '';
  block.style.borderRadius = radius > 0 ? radius + 'px' : '';
  block.style.padding      = padding > 0 ? padding + 'px' : '';

  // ── countup: 정적 최종값 빅넘버 스탯 (현빈 확정 2026-07-03: 애니메이션 없음 — 값 = 원본
  //    카운트업 GIF의 최종 프레임 수치. stats 배열이면 N개 가로 배치 — 창대 sec03
  //    "네이버 도마 1위 · 누적판매량 · 평점" 류) ──────────────────────────────
  if (variant === 'countup') {
    const unitSz = Math.max(12, Math.round(numSize * 0.35));
    const one = (st, size) => `
      ${st.label ? `<div class="ifc-label" style="font-size:${titleSz}px;color:${sub};font-weight:600;letter-spacing:0.02em;">${_esc(st.label)}</div>` : ''}
      <div style="line-height:1.1;margin-top:${st.label ? 8 : 0}px;">
        <span class="ifc-value" style="font-size:${size}px;font-weight:800;color:${text};letter-spacing:-0.02em;">${_esc(st.value)}</span>${st.unit ? `<span class="ifc-unit" style="font-size:${Math.max(12, Math.round(size * 0.35))}px;font-weight:700;color:${sub};margin-left:4px;">${_esc(st.unit)}</span>` : ''}
      </div>
      ${st.caption ? `<div class="ifc-caption" style="font-size:14px;color:${sub};margin-top:10px;">${_esc(st.caption)}</div>` : ''}`;
    const stats = (Array.isArray(d.stats) && d.stats.length >= 2) ? d.stats.slice(0, 4) : null;
    if (stats) {
      const size = Math.min(numSize, 64); // N개 가로 배치는 컬럼 폭에 맞게 자동 하향
      block.innerHTML = `<div style="display:flex;width:100%;align-items:flex-start;">
        ${stats.map(st => `<div style="flex:1 1 0;min-width:0;text-align:${align};">${one(st, size)}</div>`).join('')}
      </div>`;
    } else {
      block.innerHTML = `<div style="width:100%;text-align:${align};">${one(d, numSize)}</div>`;
    }
    return;
  }

  // ── price: 가격 카드 ─────────────────────────────────────────────────────
  if (variant === 'price') {
    const extras = (Array.isArray(d.extras) ? d.extras : []).map(x => String(x).trim()).filter(Boolean);
    block.innerHTML = `<div style="width:100%;text-align:${align};">
      ${d.label ? `<div class="ifc-label" style="font-size:${titleSz}px;color:${sub};font-weight:600;">${_esc(d.label)}</div>` : ''}
      ${d.originalPrice ? `<div class="ifc-orig" style="font-size:24px;color:${sub};text-decoration:line-through;margin-top:${d.label ? 6 : 0}px;">${_esc(d.originalPrice)}${_esc(d.currency || '')}</div>` : ''}
      <div style="display:flex;align-items:baseline;justify-content:${justify};gap:12px;margin-top:4px;">
        ${d.discountPct ? `<span class="ifc-discount" style="font-size:40px;font-weight:800;color:${accent};line-height:1;">${_esc(d.discountPct)}</span>` : ''}
        <span class="ifc-price" style="font-size:48px;font-weight:800;color:${text};line-height:1;letter-spacing:-0.02em;">${_esc(d.price)}<span style="font-size:24px;font-weight:700;margin-left:2px;">${_esc(d.currency || '')}</span></span>
      </div>
      ${extras.length ? `<div style="display:flex;flex-wrap:wrap;justify-content:${justify};gap:8px;margin-top:14px;">${
        extras.map(x => `<span class="ifc-extra" style="display:inline-block;border:1px solid ${sub};border-radius:999px;padding:4px 12px;font-size:14px;color:${sub};line-height:1.4;">${_esc(x)}</span>`).join('')
      }</div>` : ''}
    </div>`;
    return;
  }

  // ── review: 리뷰 카드 ────────────────────────────────────────────────────
  const stars = Math.max(0, Math.min(5, parseInt(d.stars) || 0));
  block.innerHTML = `<div style="width:100%;text-align:${align};">
    <div class="ifc-stars" style="font-size:24px;letter-spacing:3px;line-height:1;"><span style="color:${accent};">${'★'.repeat(stars)}</span><span style="color:#dddddd;">${'★'.repeat(5 - stars)}</span></div>
    <div class="ifc-body" style="font-size:${bodySz}px;color:${text};line-height:1.5;margin-top:12px;word-break:keep-all;">&ldquo;${_esc(d.body)}&rdquo;</div>
    <div style="font-size:16px;color:${sub};margin-top:14px;">
      <span class="ifc-author">${_esc(d.author)}</span>${d.date ? `<span class="ifc-date" style="margin-left:10px;">${_esc(d.date)}</span>` : ''}
    </div>
  </div>`;
}

function makeInfoCardBlock(opts = {}) {
  const variant = _IFC_VARIANTS.includes(opts.variant) ? opts.variant : 'countup';
  const block = document.createElement('div');
  block.className = 'infocard-block';
  block.id = genId('ifc');
  block.dataset.type    = 'infocard';
  block.dataset.variant = variant;
  // 데이터 키를 opts 톱레벨에 준 호출도 수용 — data:{} 누락 시 조용히 기본값(샘플 문구)이
  // 그대로 렌더되던 "기본 라벨 누수" 방지. 우선순위: 기본값 < 톱레벨 < opts.data
  const topLevel = {};
  for (const k of _IFC_DATA_KEYS[variant]) if (opts[k] !== undefined) topLevel[k] = opts[k];
  const data = Object.assign({}, INFOCARD_DEFAULTS[variant], topLevel,
    (opts.data && typeof opts.data === 'object' && !Array.isArray(opts.data)) ? opts.data : {});
  block.dataset.data        = JSON.stringify(data);
  block.dataset.align       = opts.align === 'left' ? 'left' : 'center';
  block.dataset.accentColor = opts.accentColor || '#2d6fe8';
  block.dataset.textColor   = opts.textColor   || '#222222';
  block.dataset.subColor    = opts.subColor    || '#888888';
  block.dataset.bg          = opts.bg          || '';
  block.dataset.radius      = opts.radius      ?? 0;
  block.dataset.padding     = opts.padding     ?? 0;
  block.dataset.numSize     = opts.numSize     || 96;
  block.dataset.titleSize   = opts.titleSize   || 20;
  block.dataset.bodySize    = opts.bodySize    || 26;
  renderInfoCardBlock(block);

  const row = document.createElement('div');
  row.className = 'row';
  row.id = genId('row');
  row.dataset.layout = 'stack';
  row.appendChild(block);
  return { row, block };
}

function addInfoCardBlock(opts = {}) {
  const sec = window.getSelectedSection?.();
  if (!sec) { window.showNoSelectionHint?.(); return null; }
  window.pushHistory();
  const { row, block } = makeInfoCardBlock(opts);
  insertAfterSelected(sec, row);
  bindBlock(block);
  window.buildLayerPanel();
  // 방금 추가한 블록 자동 선택 + 화면 안으로 스크롤 (step-block C9 미러)
  try { window.selectBlock?.(block.id); } catch (_) {}
  row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  window.triggerAutoSave?.();
  return { row, block };
}

// ── 수정 ────────────────────────────────────────────────────────────────────
// updateStepBlock 미러: 전체 입력 검증 → before 스냅샷 → pushHistory → 커밋 →
// 재렌더(실패 시 rollback) → 패널/레이어/autosave.
// 지원 필드: variant, data(부분 merge), align, accentColor/textColor/subColor/bg,
//            radius, padding, numSize, titleSize, bodySize
function updateInfoCardBlock(blockId, partial = {}) {
  if (!blockId) return { ok: false, code: 'NOT_FOUND', message: 'blockId required' };
  const block = document.getElementById(String(blockId));
  if (!block || !block.classList.contains('infocard-block')) {
    return { ok: false, code: 'NOT_FOUND', message: `infocard-block not found: ${blockId}` };
  }
  if (partial == null || typeof partial !== 'object') {
    return { ok: false, code: 'INVALID', message: 'partial must be object' };
  }

  // 1단계 — 검증만 (mutate X)
  const next = {};
  const applied = {};

  let targetVariant = _IFC_VARIANTS.includes(block.dataset.variant) ? block.dataset.variant : 'countup';
  if (partial.variant !== undefined) {
    if (!_IFC_VARIANTS.includes(partial.variant)) {
      return { ok: false, code: 'INVALID', message: `variant must be one of ${_IFC_VARIANTS.join('|')}` };
    }
    targetVariant = partial.variant;
    next.variant = partial.variant;
    applied.variant = partial.variant;
  }

  if (partial.data !== undefined && partial.data !== null) {
    if (typeof partial.data !== 'object' || Array.isArray(partial.data)) {
      return { ok: false, code: 'INVALID', message: 'data must be object' };
    }
    if (partial.data.extras !== undefined && !Array.isArray(partial.data.extras)) {
      return { ok: false, code: 'INVALID', message: 'data.extras must be array' };
    }
    if (partial.data.stars !== undefined) {
      const n = Number(partial.data.stars);
      if (!Number.isFinite(n) || n < 0 || n > 5) {
        return { ok: false, code: 'INVALID', message: 'data.stars must be 0..5' };
      }
    }
  }
  if (partial.data !== undefined || partial.variant !== undefined) {
    // 기존 data 위에 partial.data 병합 + 대상 variant의 default로 누락 키 시드
    const merged = Object.assign({}, INFOCARD_DEFAULTS[targetVariant], _ifcData(block), partial.data || {});
    next.data = JSON.stringify(merged);
    applied.data = merged;
  }

  let _planErr = null;
  const _planNum = (key, value, min, max) => {
    const n = Number(value);
    if (!Number.isFinite(n) || n < min || n > max) { _planErr = `${key} invalid (must be ${min}..${max})`; return; }
    next[key] = String(Math.round(n));
    applied[key] = Math.round(n);
  };
  if (partial.radius    !== undefined) _planNum('radius',    partial.radius,    0, 200);
  if (partial.padding   !== undefined) _planNum('padding',   partial.padding,   0, 200);
  if (partial.numSize   !== undefined) _planNum('numSize',   partial.numSize,  40, 200);
  if (partial.titleSize !== undefined) _planNum('titleSize', partial.titleSize, 8, 100);
  if (partial.bodySize  !== undefined) _planNum('bodySize',  partial.bodySize,  8, 100);
  if (_planErr) return { ok: false, code: 'INVALID', message: _planErr };

  if (partial.align !== undefined) {
    if (partial.align !== 'left' && partial.align !== 'center') {
      return { ok: false, code: 'INVALID', message: 'align must be left|center' };
    }
    next.align = partial.align; applied.align = partial.align;
  }

  const _planColor = (key, value, allowEmpty) => {
    const v = String(value).trim();
    if (allowEmpty && v === '') { next[key] = ''; applied[key] = ''; return; }
    if (v.length > 64 || !_IFC_COLOR_RE.test(v)) { _planErr = `${key} invalid color`; return; }
    next[key] = v; applied[key] = v;
  };
  if (partial.accentColor !== undefined && partial.accentColor !== null) _planColor('accentColor', partial.accentColor, false);
  if (partial.textColor   !== undefined && partial.textColor   !== null) _planColor('textColor',   partial.textColor,   false);
  if (partial.subColor    !== undefined && partial.subColor    !== null) _planColor('subColor',    partial.subColor,    false);
  if (partial.bg          !== undefined && partial.bg          !== null) _planColor('bg',          partial.bg,          true);
  if (_planErr) return { ok: false, code: 'INVALID', message: _planErr };

  // 변경 없음 → noop
  if (Object.keys(next).length === 0) {
    return { ok: true, blockId, before: null, applied: {}, noop: true };
  }

  // 2단계 — before 스냅샷 (rollback 대비)
  const beforeSnapshot = {};
  const before = {};
  for (const k of Object.keys(next)) {
    beforeSnapshot[k] = block.dataset[k];
    before[k] = block.dataset[k];
  }

  // 3단계 — pushHistory (변경 전 캔버스 = undo 타겟)
  window.pushHistory?.();

  // 4단계 — 커밋
  for (const k of Object.keys(next)) block.dataset[k] = next[k];

  // 5단계 — 재렌더 (실패 시 rollback)
  try {
    renderInfoCardBlock(block);
  } catch (e) {
    for (const k of Object.keys(beforeSnapshot)) {
      const v = beforeSnapshot[k];
      if (v === undefined) delete block.dataset[k];
      else block.dataset[k] = v;
    }
    try { renderInfoCardBlock(block); } catch (_) {}
    return { ok: false, code: 'RENDER_ERROR', message: e.message, rolledBack: true };
  }

  // 6단계 — 우측 패널 / 레이어 / autosave
  if (block.classList.contains('selected')) {
    try { window.showInfoCardProperties?.(block); } catch (_) {}
  }
  try { window.buildLayerPanel?.(); } catch (_) {}
  window.scheduleAutoSave?.();

  return { ok: true, blockId, before, applied };
}

// ── variant 프리셋 별칭 ──────────────────────────────────────────────────────
function addCountupBlock(opts = {})   { return addInfoCardBlock({ ...opts, variant: 'countup' }); }
function addPriceCardBlock(opts = {}) { return addInfoCardBlock({ ...opts, variant: 'price' }); }
function addReviewCardBlock(opts = {}){ return addInfoCardBlock({ ...opts, variant: 'review' }); }

// ── window 노출 ────────────────────────────────────────────────────────────
window.makeInfoCardBlock   = makeInfoCardBlock;
window.addInfoCardBlock    = addInfoCardBlock;
window.updateInfoCardBlock = updateInfoCardBlock;
window.renderInfoCardBlock = renderInfoCardBlock;
window.addCountupBlock     = addCountupBlock;
window.addPriceCardBlock   = addPriceCardBlock;
window.addReviewCardBlock  = addReviewCardBlock;

export { makeInfoCardBlock, addInfoCardBlock, updateInfoCardBlock, renderInfoCardBlock, addCountupBlock, addPriceCardBlock, addReviewCardBlock, INFOCARD_DEFAULTS };
