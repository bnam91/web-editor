/* ═══════════════════════════════════
   GRID IFG EDIT — 인포그래픽 «더블클릭 편집 모드»(0.9.13 201행 HBQA-INFOGRAPHIC-RESIZE-DBLCLICK-01)
   현빈 결정 ⓑ(261124 야간) «에셋블럭 방식 — 자연스럽다» · 지디 (가) 두 겹 GO · 시안 #mkp-ifgedit(gdragon 1c867b5).
   ★틀(블럭 너비·높이) 고정 · 안 내용 «통째 배율» s — 아이콘 크기 · 글자 크기 · 칸 간격(열·행) · 칸 안 여백 · 줄 위 여백 × s.
   ★저장 = 실제 값에 곱해 updateGridBlock «한 문»(첫 바꿈만 이력 · 나머지 noHistory ⇒ ⌘Z 한 칸 · CSS transform 0 ⇒ 내보내기 길 그대로).
   ★늘 «들어갈 때 모델»(m0)에서 다시 계산한다 — 끄는 동안 반올림이 쌓이지 않는다.
   ★틀 높이 고정 = 들어갈 때 행 «보이는 높이»를 행 height 로 박고, 줄어든(늘어난) 행 간격만큼 행에 돌려준다.
   ★범위(지디 261124): 50~200% · 글자 10px · 아이콘 16px 밑으로 안 감 · 틀보다 크게 못 키움(행·칸 폭에 꽉 찬 배율에서 멈춤).
   ★두 겹: 편집 모드 «밖» 더블클릭 = 이 모드 · «안» 더블클릭 = 옛 갈래(아이콘 고르개 · 글줄 글자 편집) — block-drag.js 그리드 dblclick 머리.
═══════════════════════════════════ */
import { GRID_ROLES, GRID_IMG_CIRCLE_D, gridGaps, getGridCellPadY, updateGridBlock } from './grid-block.js';
/* ★updateGridBlock 을 window 문(model-update-history 감싸기 = 부를 때마다 «뒤 표본» 한 칸)이 아니라 import 로 부른다 —
   끄는 동안 매 틱이 이력 칸이 되면 ⌘Z 가 한 칸이 아니다. 대신 «첫 바꿈 = 앞 표본(updateGridBlock 안) · 끝 = 뒤 표본 하나(exit)»
   = 에셋 이미지 편집(exitImageEditMode «이미지 위치/크기» 한 칸)과 같은 꼴. */

export const IFG_EDIT_MIN = 0.5, IFG_EDIT_MAX = 2, IFG_EDIT_FONT_FLOOR = 10, IFG_EDIT_ICON_FLOOR = 16;
const TEXT = new Set(['label', 'h1', 'h2', 'h3', 'body', 'caption']);
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const _fontOf = (l) => num(l.fontSize) ?? (GRID_ROLES[l.type] ? GRID_ROLES[l.type].size : null);
const _iconOf = (l) => num(l.height) ?? (l.imgShape === 'circle' ? GRID_IMG_CIRCLE_D : null);

function _scaleLine(l, s) {
  const o = { ...l };
  if (o.type === 'image') { const d = _iconOf(o); if (d != null) o.height = Math.max(1, Math.round(d * s)); }
  else if (TEXT.has(o.type)) { const f = _fontOf(o); if (f != null) o.fontSize = Math.max(1, Math.round(f * s)); }
  else if ((o.type === 'gap' || o.type === 'divider') && num(o.height) != null) o.height = Math.round(o.height * s);
  if (num(o.marginTop) != null) o.marginTop = Math.round(o.marginTop * s);   // 'auto'(구분선 프리셋 아이콘)는 그대로
  return o;
}

/** 들어갈 때 모델 m0 · 그때 간격 gaps0{row,col} · 행 «보이는 높이» rowPx[] · cellPadY · 배율 s → updateGridBlock partial 하나(순수). */
export function ifgScalePartial(m0, gaps0, rowPx, padY, s) {
  const n = m0.rows.length;
  const rowGap = Math.round(gaps0.row * s), colGap = Math.round(gaps0.col * s);
  const give = n > 1 ? ((gaps0.row - rowGap) * (n - 1)) / n : 0;   // 줄어든 행 간격을 행마다 고르게 돌려준다(틀 높이 고정)
  const cells = m0.cells.map((row) => row.map((cell) => {
    const c = { ...cell, lines: (Array.isArray(cell.lines) ? cell.lines : []).map((l) => _scaleLine(l, s)) };
    if (num(c.padding) != null) c.padding = Math.round(c.padding * s);
    return c;
  }));
  /* ★d(미카사 201 · 80%·91% 에서 740→739) — 행마다 반올림하면 합이 1px 샌다 ⇒ «누적 합»을 반올림해 그 차로 나눈다(합 = 틀 높이 그대로) */
  let acc = 0, prev = 0;
  const rows = m0.rows.map((r, i) => { acc += (rowPx[i] - 2 * (padY || 0)) + give; const cur = Math.round(acc); const h = Math.max(1, cur - prev); prev = cur; return { ...r, height: h }; });
  return { cells, rows, rowGap, colGap };
}

/** 배율 바닥 — 50% · 가장 작은 글자가 10px · 가장 작은 아이콘이 16px 밑으로 안 가는 값(순수). */
export function ifgScaleFloor(m0, minRel = IFG_EDIT_MIN) {
  let f = Infinity, ic = Infinity;
  for (const row of m0.cells) for (const cell of row) for (const l of (cell.lines || [])) {
    if (l.type === 'image') { const d = _iconOf(l); if (d) ic = Math.min(ic, d); } else if (TEXT.has(l.type)) { const v = _fontOf(l); if (v) f = Math.min(f, v); }
  }
  const lo = Math.max(minRel, f === Infinity ? 0 : IFG_EDIT_FONT_FLOOR / f, ic === Infinity ? 0 : IFG_EDIT_ICON_FLOOR / ic);
  return Math.min(1, Math.ceil(lo * 100) / 100);
}

/* ── 화면 재기(편집 모드 들어갈 때 한 번) ── */
const _z = () => (window.currentZoom || 100) / 100;
function _measure(block, m0, gaps0) {
  const z = _z(), n = m0.rows.length, rowPx = new Array(n).fill(0);
  let hi = IFG_EDIT_MAX;
  const g = n > 1 ? (gaps0.row * (n - 1)) / n : 0;
  const own = [...block.querySelectorAll('.grd-cell')].filter((c) => c.closest('.grid-block') === block);
  own.forEach((cell) => {
    const r = Number(cell.dataset.r); if (!Number.isInteger(r) || r >= n || cell.dataset.rs) return;   // 세로로 합친 칸은 행 높이 재기에서 뺀다
    const h = cell.getBoundingClientRect().height / z; rowPx[r] = Math.max(rowPx[r], h);
  });
  own.forEach((cell) => {
    const r = Number(cell.dataset.r); if (!Number.isInteger(r) || r >= n || cell.dataset.rs) return;
    const cs = getComputedStyle(cell);
    let content = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
    [...cell.children].forEach((k) => { content += k.getBoundingClientRect().height / z; if (k.style.marginTop !== 'auto') content += parseFloat(getComputedStyle(k).marginTop) || 0; });
    if (content > 0 && rowPx[r] > 0) hi = Math.min(hi, (rowPx[r] + g) / (content + g));   // 행에 꽉 찬 배율
    const inner = cell.getBoundingClientRect().width / z - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);   // 다 «배율 뺀» px
    cell.querySelectorAll('.grd-img-frame').forEach((fr) => { const w = fr.getBoundingClientRect().width / z; if (w > 0) hi = Math.min(hi, inner / w); });   // 칸 폭에 꽉 찬 아이콘
  });
  return { rowPx, hi: Math.max(1, Math.floor(hi * 100) / 100) };
}

/* ── 편집 모드 ── */
const H_AL = [['left', '←', '왼쪽'], ['center', '↔', '가운데'], ['right', '→', '오른쪽']];
const V_AL = [['top', '↑', '위'], ['middle', '↕', '가운데'], ['bottom', '↓', '아래']];
function _panelHtml(st) {
  const btns = (arr, kind, on) => arr.map(([v, ic, l]) => `<button type="button" class="prop-align-btn${v === on ? ' active' : ''}" id="ifg-edit-${kind}-${v}" data-ifg-al="${kind}:${v}" aria-label="${l} 정렬" title="${l} 정렬">${ic}</button>`).join('');
  return `<div class="prop-section" id="ifg-edit-panel">
    <div class="prop-block-label"><span class="prop-block-name">인포그래픽 편집</span></div>
    <div class="prop-section-title">크기</div>
    <div class="prop-row"><span class="prop-label">배율</span><input type="number" class="prop-number" id="ifg-edit-scale" style="width:64px" value="${Math.round(st.s * 100)}" min="${Math.round(st.lo * 100)}" max="${Math.round(st.hi * 100)}" aria-label="안 내용 배율(%)"><span class="prop-label" style="flex:0 0 auto">%</span></div>
    <div class="prop-hint">${Math.round(st.lo * 100)}~${Math.round(st.hi * 100)}% · 틀(너비·높이)은 그대로 · 아이콘·글자·간격·여백이 같이 바뀐다</div></div>
  <div class="prop-section"><div class="prop-section-title">정렬</div>
    <div class="prop-row"><span class="prop-label">가로</span><div class="prop-align-group">${btns(H_AL, 'h', st.ha || st.ha0)}</div></div>
    <div class="prop-row"><span class="prop-label">세로</span><div class="prop-align-group">${btns(V_AL, 'v', st.va || st.va0)}</div></div>
    <div class="prop-hint">Esc 또는 블럭 밖 클릭으로 편집 종료</div></div>`;
}

const _sig = (b) => [b.dataset.cells, b.dataset.cols, b.dataset.rows, b.dataset.rowGap, b.dataset.colGap, b.dataset.valign].join('\u0001');
let _cur = null;   // 지금 편집 중인 블럭 하나(⛔블럭 class 로 표시하지 않는다 — 이력 표본·⌘Z 가 class 를 되살렸다 · 미카사 201 g)

/* ★f — 모델이 «배율 밖»에서 바뀌었으면(안 글줄·아이콘 편집 · ⌘Z) 지금 값을 새 기준으로(그 바꿈을 m0 로 덮지 않게). 배율 % 는 이어진다: 새 기준 = st.k */
function _rebase(block, st) {
  const m = window.getGridModel(block), gaps = gridGaps(block), padY = getGridCellPadY(block);
  const { rowPx, hi } = _measure(block, m, gaps);
  st.k = st.s; st.m0 = m; st.gaps0 = gaps; st.padY = padY; st.rowPx = rowPx;
  st.lo = Math.max(IFG_EDIT_MIN, Math.ceil(st.k * ifgScaleFloor(m, 0) * 100) / 100);
  st.hi = Math.min(IFG_EDIT_MAX, Math.floor(st.k * hi * 100) / 100);
  st.sig = _sig(block);
}

function _apply(block, st, s, fromInput) {
  if (_sig(block) !== st.sig) _rebase(block, st);
  st.s = Math.min(st.hi, Math.max(st.lo, Math.round(s * 100) / 100));
  const p = ifgScalePartial(st.m0, st.gaps0, st.rowPx, st.padY, st.s / st.k);
  if (st.ha) p.cells = p.cells.map((row) => row.map((c) => ({ ...c, lines: c.lines.map((l) => ({ ...l, align: st.ha })) })));
  if (st.va) p.valign = st.va;
  const res = updateGridBlock(block.id, p, { noHistory: st.committed, keepPanel: true });   // keepPanel = 편집 패널을 그리드 패널로 갈아끼우지 않게
  if (res && res.ok !== false) st.committed = true;
  st.sig = _sig(block);
  _placeHandles(block);
  const inp = document.getElementById('ifg-edit-scale'); if (inp && !fromInput) inp.value = String(Math.round(st.s * 100));   // ★e — 포커스가 남아 있어도 끌기 값은 칸에 보인다
  return res;
}

function _placeHandles(block) {
  const r = block.getBoundingClientRect();
  document.querySelectorAll('.ifg-edit-handle').forEach((h) => {
    const [x, y] = h.dataset.corner.split('');
    h.style.left = `${(x === 'l' ? r.left : r.right) - 4}px`; h.style.top = `${(y === 't' ? r.top : r.bottom) - 4}px`;
  });
  const fr = document.querySelector('.ifg-edit-frame'); if (fr) Object.assign(fr.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
  const hint = document.querySelector('.ifg-edit-hint'); if (hint) { hint.style.left = `${r.left + r.width / 2}px`; hint.style.top = `${r.bottom + 30}px`; }   // 블럭 «밖» 아래 — 안 내용·행 ＋ 단추를 안 가린다
}

function _renderPanel(block, st) {
  const panel = document.querySelector('#panel-right .panel-body'); if (!panel) return;
  panel.innerHTML = _panelHtml(st);
  const inp = panel.querySelector('#ifg-edit-scale');
  inp?.addEventListener('change', () => { const v = Number(inp.value); if (Number.isFinite(v)) _apply(block, st, v / 100, true); inp.value = String(Math.round(st.s * 100)); });
  panel.querySelectorAll('[data-ifg-al]').forEach((b) => b.addEventListener('click', (e) => {
    e.stopPropagation(); const [k, v] = b.dataset.ifgAl.split(':'); st[k === 'h' ? 'ha' : 'va'] = v;
    panel.querySelectorAll(`[data-ifg-al^="${k}:"]`).forEach((x) => x.classList.toggle('active', x === b));
    _apply(block, st, st.s);
  }));
}

/* ★f — 안에서 글줄·아이콘을 고치면 그 길이 그리드 패널로 갈아끼운다 ⇒ 그 일이 끝나면(글자 편집·아이콘 팝오버 0) 편집 패널로 돌아온다 · 블럭이 DOM 에서 빠지면(⌘Z 복원) 끝 */
function _checkPanel() {
  const block = _cur, st = block && block._ifgEditing; if (!st) return;
  if (!block.isConnected) { exitIfgEditMode(block); return; }
  const busy = (document.activeElement?.isContentEditable && block.contains(document.activeElement)) || document.getElementById('grd-ifg-iconpop');
  if (busy || document.getElementById('ifg-edit-panel')) return;
  if (_sig(block) !== st.sig) _rebase(block, st);
  _renderPanel(block, st);
}
let _chkQueued = false;
const _queueCheck = () => { if (_chkQueued) return; _chkQueued = true; requestAnimationFrame(() => { _chkQueued = false; _checkPanel(); }); };

export function enterIfgEditMode(block) {
  if (!block || !block.dataset || !block.dataset.ifgPreset || block._ifgEditing) return false;
  window.exitStarMode?.();
  if (_cur && _cur !== block) exitIfgEditMode(_cur);
  const m0 = window.getGridModel(block), gaps0 = gridGaps(block), padY = getGridCellPadY(block);
  const { rowPx, hi } = _measure(block, m0, gaps0);
  const t0 = (m0.cells[0] && m0.cells[0][0] && m0.cells[0][0].lines || []).find((l) => TEXT.has(l.type));
  const ha0 = (t0 && t0.align) || (m0.cols[0] && m0.cols[0].align) || null, va0 = block.dataset.valign || null;   // 패널 켜짐 = 지금 값(바꾸기 전엔 안 씀)
  const st = { m0, gaps0, padY, rowPx, s: 1, k: 1, lo: ifgScaleFloor(m0), hi, ha: null, va: null, ha0, va0, committed: false, sig: _sig(block) };
  block._ifgEditing = st; _cur = block;
  document.body.classList.add('ifg-edit-on');   // 평소 선택 겹(#ss-handles-overlay)을 숨긴다 — css/editor-blocks.css
  /* ★a — 점선 틀(시안 #mkp-ifgedit) = 블럭 밖 겹 요소(블럭 DOM·저장·이력에 안 들어감) */
  const fr = document.createElement('div'); fr.className = 'ifg-edit-frame';
  fr.style.cssText = 'position:fixed;box-sizing:border-box;border:1px dashed var(--ui-accent);pointer-events:none;z-index:8999';
  document.body.appendChild(fr);
  ['lt', 'rt', 'lb', 'rb'].forEach((c) => {
    const h = document.createElement('div'); h.className = 'ifg-edit-handle'; h.dataset.corner = c;
    h.style.cssText = 'position:fixed;width:8px;height:8px;background:#fff;border:1px solid var(--ui-accent,#3b82f6);border-radius:50%;z-index:9000;cursor:nwse-resize';
    h.addEventListener('mousedown', (e) => _dragCorner(block, e));
    document.body.appendChild(h);
  });
  const hint = document.createElement('div'); hint.className = 'ifg-edit-hint';
  hint.textContent = '모서리: 안 내용 크기 · 정렬: 남는 자리 · Esc: 완료';
  hint.style.cssText = 'position:fixed;transform:translateX(-50%);z-index:9000;font-size:11px;background:#222;color:#fff;border-radius:10px;padding:2px 10px;pointer-events:none;white-space:nowrap';
  document.body.appendChild(hint);
  _placeHandles(block);
  _renderPanel(block, st);
  const panel = document.querySelector('#panel-right .panel-body');
  block._ifgObs = panel ? new MutationObserver(_queueCheck) : null; block._ifgObs?.observe(panel, { childList: true });
  block._ifgExitClick = (e) => { const t = e.target; if (block.contains(t) || t.closest?.('#panel-right, .ifg-edit-handle, #grd-ifg-iconpop')) return; exitIfgEditMode(block); };
  block._ifgExitEsc = (e) => { if (e.key === 'Escape' && !document.activeElement?.isContentEditable && !document.getElementById('grd-ifg-iconpop')) exitIfgEditMode(block); else _queueCheck(); };
  block._ifgOnScroll = () => _placeHandles(block);
  setTimeout(() => { document.addEventListener('mousedown', block._ifgExitClick, true); document.addEventListener('keydown', block._ifgExitEsc); document.addEventListener('focusout', _queueCheck, true); document.addEventListener('mouseup', _queueCheck, true); }, 0);
  window.addEventListener('scroll', block._ifgOnScroll, true);
  return true;
}

function _dragCorner(block, e) {
  const st = block._ifgEditing; if (!st) return;
  e.preventDefault(); e.stopPropagation();
  const r = block.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  /* ★c — 거리(부호 없음)가 아니라 «처음 대각선 위로의 투영» — 가운데를 넘으면 음수 → 바닥에서 멈춤(옛: 다시 커짐) */
  const vx = e.clientX - cx, vy = e.clientY - cy, d2 = (vx * vx + vy * vy) || 1, s0 = st.s;
  const move = (ev) => _apply(block, st, s0 * (((ev.clientX - cx) * vx + (ev.clientY - cy) * vy) / d2));
  const up = () => { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); };
  document.addEventListener('mousemove', move); document.addEventListener('mouseup', up);
}

export function exitIfgEditMode(block) {
  const st = block && block._ifgEditing; if (!st) return false;
  block._ifgEditing = null; if (_cur === block) _cur = null;
  document.body.classList.remove('ifg-edit-on');
  document.querySelectorAll('.ifg-edit-handle, .ifg-edit-hint, .ifg-edit-frame').forEach((x) => x.remove());
  block._ifgObs?.disconnect(); block._ifgObs = null;
  document.removeEventListener('mousedown', block._ifgExitClick, true);
  document.removeEventListener('keydown', block._ifgExitEsc);
  document.removeEventListener('focusout', _queueCheck, true);
  document.removeEventListener('mouseup', _queueCheck, true);
  window.removeEventListener('scroll', block._ifgOnScroll, true);
  if (st.committed && block.isConnected) { window.pushHistory?.('인포그래픽 편집'); window.scheduleAutoSave?.(); }   // 끝 표본 하나(⌘Z 한 칸)
  if (block.isConnected) window.showGridProperties?.(block);
  return true;
}

/* ★b — 칸 사이 틈은 선택 겹의 거터(.grd-gutter · #ss-handles-overlay 소속 = 블럭 밖)가 덮어 블럭 dblclick 이 안 온다 ⇒ 거터 위 더블클릭도 그 밑 인포그래픽으로 */
if (typeof document !== 'undefined') document.addEventListener('dblclick', (e) => {
  if (!e.target?.closest?.('.grd-gutter')) return;
  const g = document.elementsFromPoint(e.clientX, e.clientY).map((el) => el.closest?.('.grid-block[data-ifg-preset]')).find(Boolean);
  if (g && !g._ifgEditing && enterIfgEditMode(g)) e.stopPropagation();
}, true);

if (typeof window !== 'undefined') {
  window.enterIfgEditMode = enterIfgEditMode;
  window.exitIfgEditMode = exitIfgEditMode;
  window.isIfgEditing = (b) => !!(b && b._ifgEditing);
}
