/* ═══════════════════════════════════════════════════════════════════════════
   E1 Effects — 바닥 리플렉션 (2026-10-04 · 지디 판정 D1 ㉮ · 시안 = 지디 goditor-effects-reflection.html)
   ─────────────────────────────────────────────────────────────────────────────
   ★기법 = `-webkit-box-reflect`(블럭 «자기» 인라인 속성 하나).
     ⛔DOM 거울(블럭을 복제해 뒤집기)로 바꾸지 마라 — innerText 35·textContent 459 곳이 글자를 «두 번» 읽는다
       (오늘 ＋ '+' 누출 E65 와 같은 병). 지키는 시험: tests/dom/effects-reflection.dom.spec.js R6(켬/끔 innerText 같음).
     ★PNG 주 경로(CDP 네이티브 캡처)에 나온다(실측) · html2canvas 대체 경로엔 «안 나온다» — 의도됨(시험 R5 가 고정).
   ★컨트롤 셋 = 간격(px) · 길이(페이드 %) · 불투명도(%) — 흐림 없음(box-reflect 는 흐림을 못 한다 · 현빈 원문에 흐림 명시 없음).
     값 범위·기본값 = 시안 슬라이더 그대로.
   ★자리(D2 ㉠ 다음 블럭을 민다): box-reflect 는 자리를 안 먹는다 ⇒ 보이는 반사 길이만큼 «아래 여백»을 둔다.
     여백 = max(0, 간격 + 블럭높이 × 길이%) · 여백을 거는 자리(host) = 흐름 안의 상자:
       텍스트 = .text-block(텍스트 래퍼 높이는 auto) · 에셋 = .asset-block · 도형 = 도형 «래퍼» frame-block(높이 고정이라 안쪽 여백이 안 민다)
     도형 래퍼의 margin-bottom 은 회전 보정(frame-geometry.js applyFrameRotationMargin)과 «같은 자리»다 ⇒ 둘을 «더해서» 쓴다
       (dataset.rotMarginY + dataset.rfMarginY — 두 쓰는 쪽이 서로 지우지 않게).
   ★정본 = dataset 키 넷 `fxReflect`('on'|'off' · 없음 = 효과 없음) · `fxReflectGap` · `fxReflectLen` · `fxReflectOp`.
     키가 하나도 없고 흔적도 없으면 «아무것도 안 만진다» ⇒ 옛 문서 바이트 동일(시험 R2 가 6119145c 골든과 비교).
     'off' = 눈을 끈 상태(값 보존 · 그리지 않음) · ✕ = 키 «전부» 지움.
   ⛔import 없음 — 패널 세 곳(prop-text-template · prop-shape · prop-asset)이 window 다리로 부른다(단위 하네스가 그 파일들을 대역으로 싣는다).
   ═══════════════════════════════════════════════════════════════════════════ */

export const FX_REFLECT_KEYS = ['fxReflect', 'fxReflectGap', 'fxReflectLen', 'fxReflectOp'];
export const FX_REFLECT_DEFAULTS = { gap: 4, len: 55, op: 35 };
export const FX_REFLECT_RANGES = { gap: [-20, 40], len: [10, 100], op: [0, 100] };

const _int = (raw, [lo, hi], d) => {
  const n = typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : (typeof raw === 'number' ? raw : NaN);
  if (!Number.isFinite(n)) return d;
  return Math.max(lo, Math.min(hi, Math.round(n)));
};

/** 효과 읽기 — {state:'none'|'on'|'off', gap, len, op}. ★패널·렌더·시험이 «같은 이 함수»를 본다. */
export function fxReflectOf(el) {
  const ds = (el && el.dataset) || {};
  const state = ds.fxReflect === 'on' ? 'on' : (ds.fxReflect === 'off' ? 'off' : 'none');
  const D = FX_REFLECT_DEFAULTS, R = FX_REFLECT_RANGES;
  return { state, gap: _int(ds.fxReflectGap, R.gap, D.gap), len: _int(ds.fxReflectLen, R.len, D.len), op: _int(ds.fxReflectOp, R.op, D.op) };
}

/** 여백을 거는 상자 — 도형은 래퍼(frame-block), 나머지는 블럭 자신. */
function _host(el) {
  if (el && el.classList && el.classList.contains('shape-block')) return el.closest('.frame-block') || el;
  return el;
}

/** host 의 margin-bottom = 회전 보정 + 반사 여백. ★둘 다 0 이고 우리가 건 적 없으면 안 만진다. */
function _setHostMargin(host, m) {
  if (!host || !host.style || !host.dataset) return;
  const had = host.dataset.rfMarginY != null;
  if (m > 0) host.dataset.rfMarginY = String(m);
  else if (had) delete host.dataset.rfMarginY;
  else return;                                    // 건 적 없음 + 0 → 바이트 그대로
  const rot = Number(host.dataset.rotMarginY) || 0;
  const total = rot + (m > 0 ? m : 0);
  if (total > 0) host.style.marginBottom = total + 'px';
  else { host.style.removeProperty('margin-bottom'); _dropEmptyStyle(host); }
}

/** 우리가 걷어서 style 이 «빈 속성»만 남으면 속성째 지운다 — ✕ 뒤 outerHTML 이 켜기 전과 바이트 같게(U8 조건⑴). */
function _dropEmptyStyle(el) { if (el && el.getAttribute && el.getAttribute('style') === '') el.removeAttribute('style'); }

const _ro = (typeof ResizeObserver === 'function') ? new ResizeObserver((entries) => {
  for (const e of entries) { if (e.target.isConnected) _applyMargin(e.target); }
}) : null;
const _watched = new WeakSet();

function _applyMargin(el) {
  const fx = fxReflectOf(el);
  const host = _host(el);
  if (fx.state !== 'on') { _setHostMargin(host, 0); return; }
  const h = el.offsetHeight || 0;
  _setHostMargin(host, Math.max(0, Math.round(fx.gap + h * fx.len / 100)));
}

/** 데이터 → 화면. ★키 없음·흔적 없음 = 아무것도 안 만진다(옛 문서 바이트 동일). */
export function applyFxReflect(el) {
  if (!el || !el.style) return;
  const fx = fxReflectOf(el);
  const host = _host(el);
  const trace = !!el.style.webkitBoxReflect || (host && host.dataset && host.dataset.rfMarginY != null);
  if (fx.state === 'none' && !trace) return;
  if (fx.state === 'on') {
    /* 마스크: 반사 «윗변(블럭에 붙은 쪽)»이 진하고 길이% 에서 사라진다(실측: near 틴트 · far 흰). */
    el.style.webkitBoxReflect = `below ${fx.gap}px linear-gradient(to bottom, rgba(0,0,0,0) ${100 - fx.len}%, rgba(0,0,0,${fx.op / 100}))`;
    if (_ro && !_watched.has(el)) { _ro.observe(el); _watched.add(el); }
  } else {
    el.style.webkitBoxReflect = '';
    _dropEmptyStyle(el);
    if (_ro && _watched.has(el)) { _ro.unobserve(el); _watched.delete(el); }
  }
  _applyMargin(el);
}

/** 바꾸는 문 «하나» — 패널·시험이 이리로. patch: {state?:'on'|'off'|'none', gap?, len?, op?} · state 'none' = 키 전부 지움(✕).
 *  ★이력: 부르기 «전»에 pushHistory(push-before · 블럭 삽입류와 같은 규약) — 한 제스처 한 걸음. */
export function setFxReflect(el, patch = {}, { history = true } = {}) {
  if (!el || !el.dataset) return { ok: false, code: 'NOT_FOUND' };
  if (history) window.pushHistory?.('효과');
  const ds = el.dataset;
  if (patch.state === 'none') { FX_REFLECT_KEYS.forEach(k => { delete ds[k]; }); }
  else {
    if (patch.state === 'on' || patch.state === 'off') ds.fxReflect = patch.state;
    else if (!ds.fxReflect) ds.fxReflect = 'on';
    const R = FX_REFLECT_RANGES;
    if (patch.gap !== undefined) ds.fxReflectGap = String(_int(patch.gap, R.gap, FX_REFLECT_DEFAULTS.gap));
    if (patch.len !== undefined) ds.fxReflectLen = String(_int(patch.len, R.len, FX_REFLECT_DEFAULTS.len));
    if (patch.op !== undefined) ds.fxReflectOp = String(_int(patch.op, R.op, FX_REFLECT_DEFAULTS.op));
  }
  applyFxReflect(el);
  window.scheduleAutoSave?.();
  return { ok: true, applied: fxReflectOf(el) };
}

/** 문서를 연 뒤·붙여넣은 뒤 — 켜진 블럭을 감시에 올린다(높이가 바뀌면 여백을 다시 잰다). 그림은 이미 인라인이라 다시 안 그린다. */
export function watchAllFxReflect(root = document) {
  if (!root || !root.querySelectorAll) return 0;
  const els = root.querySelectorAll('[data-fx-reflect="on"]');
  els.forEach(el => { if (_ro && !_watched.has(el)) { _ro.observe(el); _watched.add(el); } });
  return els.length;
}

/* ═══ 패널 — 「Effects」 절(시안) · 새 클래스 0 ═══════════════════════════════
   절 머리 = 텍스트 「Shadow」 절과 같은 .prop-section-title-row(제목 + 오른쪽 손잡이) · ＋ = .prop-icon-btn 안 PLUS_ICON_SVG 정본 ·
   효과 카드 = .prop-cell-card(월계관 칸 카드 선례) · 눈·✕ = .prop-icon-btn(EYE_ICONS · ×) ·
   간격 = .prop-icon-input(「Y」 접두 — prop-multisel mkInput 꼴) · 길이·불투명도 = .prop-slider + .prop-number.
   ★U4(지디 2026-10-04): 「효과 종류 1(반사)」은 «이번 범위»다 — «구조»가 아니다. 절은 효과 카드 «목록»을 담고(FX_TYPES),
     다음 효과(그림자·외곽 광)는 FX_TYPES 에 한 줄 + 카드 그리개·배선 하나로 붙는다. ＋ 는 «아직 없는 종류»가 있을 때만 보인다.
   ★U3: 효과 0개 = 절 머리(「Effects」 + ＋) 한 줄 — 추가할 길이 늘 있다.
   ★U8: 눈 = 'off'(값 남김 · 피그마 결) · ✕ = 그 효과 키 «모두» 지움 · 접기 = 패널 표시만(데이터 무변). */
const _openCards = new WeakMap();   // el → { [type]: 펼침 } (기본 펼침 · 패널 표시만 — 데이터 아님)
const _isOpen = (el, t) => (_openCards.get(el) || {})[t] !== false;
const _setOpen = (el, t, v) => _openCards.set(el, { ...(_openCards.get(el) || {}), [t]: v });

function _reflectCardHtml(el, P) {
  const fx = fxReflectOf(el);
  const open = _isOpen(el, 'reflect');
  const eye = (window.EYE_ICONS || {})[fx.state === 'off' ? 'hidden' : 'shown'] || '';
  const R = FX_REFLECT_RANGES;
  const slider = (lbl, key, val, [lo, hi]) => `
          <div class="prop-row">
            <span class="prop-label">${lbl}</span>
            <input type="range" class="prop-slider" id="${P}-fx-${key}-slider" min="${lo}" max="${hi}" step="1" value="${val}">
            <input type="number" class="prop-number" id="${P}-fx-${key}-num" min="${lo}" max="${hi}" value="${val}">
          </div>`;
  return `
      <div class="prop-cell-card${open ? ' expanded' : ''}" id="${P}-fx-card" data-fx-type="reflect">
        <div class="prop-cell-card-header" id="${P}-fx-head">
          <button class="prop-icon-btn" id="${P}-fx-eye" title="${fx.state === 'off' ? '효과 켜기' : '효과 끄기'}" aria-label="효과 켜기/끄기" aria-pressed="${fx.state === 'on'}">${eye}</button>
          <span class="prop-cell-card-title" style="flex:1;${fx.state === 'off' ? 'text-decoration:line-through;opacity:.6;' : ''}">반사</span>
          <button class="prop-icon-btn" id="${P}-fx-del" title="효과 삭제" aria-label="효과 삭제">×</button>
        </div>
        <div class="prop-cell-card-body" id="${P}-fx-body"${open ? '' : ' hidden'}>
          <div class="prop-row">
            <span class="prop-label">간격</span>
            <div class="prop-icon-input" style="flex:1;min-width:0;" title="블럭과 반사 사이(px)">
              <span style="font-size:9px;color:#666;padding:0 3px;flex-shrink:0;">Y</span>
              <input type="number" id="${P}-fx-gap" value="${fx.gap}" min="${R.gap[0]}" max="${R.gap[1]}" step="1">
            </div>
          </div>${slider('길이', 'len', fx.len, R.len)}${slider('불투명도', 'op', fx.op, R.op)}
        </div>
      </div>`;
}

function _wireReflectCard(el, P, again) {
  const $ = (id) => document.getElementById(`${P}-${id}`);
  $('fx-del')?.addEventListener('click', (e) => { e.stopPropagation(); setFxReflect(el, { state: 'none' }); again(); });
  $('fx-eye')?.addEventListener('click', (e) => { e.stopPropagation(); const cur = fxReflectOf(el).state; setFxReflect(el, { state: cur === 'off' ? 'on' : 'off' }); again(); });
  $('fx-head')?.addEventListener('click', () => { const b = $('fx-body'); if (!b) return; const open = b.hidden; b.hidden = !open; _setOpen(el, 'reflect', open); $('fx-card')?.classList.toggle('expanded', open); });
  const gap = $('fx-gap');
  gap?.addEventListener('change', () => { setFxReflect(el, { gap: gap.value }); gap.value = fxReflectOf(el).gap; });
  for (const key of ['len', 'op']) {
    const sl = $(`fx-${key}-slider`), n = $(`fx-${key}-num`);
    if (!sl || !n) continue;
    sl.addEventListener('mousedown', () => window.pushHistory?.('효과'));
    sl.addEventListener('input', () => { setFxReflect(el, { [key]: sl.value }, { history: false }); n.value = fxReflectOf(el)[key]; });
    n.addEventListener('change', () => { setFxReflect(el, { [key]: n.value }); const v = fxReflectOf(el)[key]; n.value = v; sl.value = v; });
  }
}

/** 효과 종류 명부 — ★이번 범위는 반사 하나(U4). 종류를 더하면 여기 한 줄. */
const FX_TYPES = [
  { key: 'reflect', has: (el) => fxReflectOf(el).state !== 'none', add: (el) => setFxReflect(el, { state: 'on' }), card: _reflectCardHtml, wire: _wireReflectCard },
];

export function fxReflectSectionHtml(el, prefix) {
  const P = prefix;
  const present = FX_TYPES.filter(t => t.has(el));
  const canAdd = present.length < FX_TYPES.length;
  const add = canAdd
    ? `<button class="prop-icon-btn" id="${P}-fx-add" title="효과 추가 — 바닥 반사" aria-label="효과 추가" style="width:18px;height:18px;">${window.PLUS_ICON_SVG || ''}</button>` : '';
  return `
    <div class="prop-section" id="${P}-fx-section">
      <div class="prop-section-title-row" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
        <div class="prop-section-title" style="margin-bottom:0">Effects</div>${add}
      </div>${present.length ? `
      <div id="${P}-fx-list">${present.map(t => t.card(el, P)).join('')}
      </div>` : ''}
    </div>`;
}

/** 배선 — 단추(＋·눈·✕)는 setFxReflect «한 문»(⌘Z 한 걸음) 뒤 패널을 다시 그린다(rerender) · 슬라이더는 끄는 동안 바로 반영(이력은 mousedown 한 번). */
export function wireFxReflectSection(el, prefix, rerender) {
  const P = prefix;
  const again = () => { try { rerender?.(); } catch (_) {} };
  document.getElementById(`${P}-fx-add`)?.addEventListener('click', () => {
    const t = FX_TYPES.find(x => !x.has(el)); if (!t) return;   // 이번 범위에선 반사 하나
    t.add(el); _setOpen(el, t.key, true); again();
  });
  for (const t of FX_TYPES) if (t.has(el)) t.wire(el, P, again);
}

if (typeof window !== 'undefined') {
  Object.assign(window, { fxReflectOf, applyFxReflect, setFxReflect, watchAllFxReflect, fxReflectSectionHtml, wireFxReflectSection, FX_REFLECT_KEYS, FX_REFLECT_DEFAULTS, FX_REFLECT_RANGES });
  /* 문서가 열린 뒤 켜진 블럭을 감시에 올린다(로드는 캔버스를 통째로 갈아 끼운다 — 그 뒤 rebindAll 이 돈다). */
  window.addEventListener('load', () => { try { watchAllFxReflect(document.getElementById('canvas') || document); } catch (_) {} });
}
