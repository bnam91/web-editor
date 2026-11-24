/* _fill-section.js — 표준 Fill 절 부품(현빈 GO 261124 · 시트 0.9.14 DS-FILL-STD-SECTION-01 · 정본 시안 8910 #mkp-fillstd 탑 55ad8d1 · 계획 gdragon PLAN §4d 65c973c)
 *
 * 꼴(시안 ①): .ui-fill[data-part=fill] › .ui-fill-layer[data-fill-index="0"](겹 줄 하나 · 여러 겹 = 안 함 · 자리만)
 *   겹 줄 = 옛 색 칸(colorFieldHTML · 견본 · 이름칸 · %) + 눈(숨김 · 어댑터 hide · 블럭이 hiddenWhy:'' 로 켤 때만 · 아니면 막힘) + −(칠 지우기 = 어댑터 none)
 *   숨김(F6): 키 = 블럭 data-fill-hidden="1" «숨길 때만»(보이면 키 없음 = 옛 바이트 · setFillHiddenKey 한 곳) · 색 값은 안 지움 · 그리는 법은 어댑터(블럭마다 칠이 사는 자리가 다름)
 *   이름칸: 단색 = HEX · 그라데이션 = «Linear»/«Radial» · 이미지 = «Image» — ⛔읽기 전용 아님: 누르면(포커스) 옛 HEX 가 들어와 «HEX 쳐서 단색으로» 옛 길이 산다(text-gradient G6 · 261124) · 안 바꾸고 나가면 이름으로 돌아감
 *   칠 없음 = «칠 없음 — ＋ 로 더하기» 한 줄 + 머리 ＋(fillHeadToolsHTML · 어댑터 add)
 *   ⛔그 줄은 .prop-hint 가 아니다(.ui-fill-none) — 힌트면 패널 힌트 수(≤2)·힌트 명부 spec 에 잡힌다(radial-t4-b H0 · 지혜맥 261124)
 * 견본 클릭 = 앱 color-picker(goya-cp · 단색/그라데이션/이미지 탭) 그대로 — 계획의 «종류 팝오버»를 새로 짓지 않는다(실측 261124).
 * ⛔color-picker 를 부품이 부르지 않는다: 색 칸 마크업은 부르는 쪽이 colorFieldHTML 로 만들어 colorHtml 로 준다(옛 id·배선 그대로 · 블럭마다 그라데이션/이미지 길이 다름).
 * 데이터 = 어댑터 { add(), none(), commit() } — 부품은 블럭을 모른다.
 */
const EYE = '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 6s1.8-3.5 5-3.5S11 6 11 6s-1.8 3.5-5 3.5S1 6 1 6z"/><circle cx="6" cy="6" r="1.4"/></svg>';
const EYE_OFF = '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 6s1.8-3.5 5-3.5S11 6 11 6s-1.8 3.5-5 3.5S1 6 1 6z"/><path d="M2 10L10 2"/></svg>';
const MINUS = '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M2 6h8"/></svg>';
const PLUS = '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M6 2v8M2 6h8"/></svg>';
export const FILL_KIND_NAME = Object.freeze({ linear: 'Linear', radial: 'Radial', conic: 'Angular', image: 'Image' });   // conic = Figma GRADIENT_ANGULAR(옛 홀로그램 칠 · 새로 고르는 종류 아님)

/** 지난 색(＋ 로 되살림) — 블럭 id 열쇠(⌘Z/⇧⌘Z 가 요소를 새로 만들어 요소 열쇠는 잃는다 · F1 D3 실측) · shortcut: 세션 안에서만(저장 키 0) — 다시 열어서도 원하면 dataset 키로 */
const _LAST = new Map();
export const fillLast = { set: (id, c) => { if (id && c && c !== 'transparent') _LAST.set(id, c); }, get: (id, dflt) => _LAST.get(id) || dflt };
/** 숨김 키 — 숨길 때만 "1" · 보이면 속성 자체를 지움(빈 값 남기지 않음) */
export const fillHiddenOf = (el) => el?.getAttribute?.('data-fill-hidden') === '1';
export function setFillHiddenKey(el, on) { if (!el) return; if (on) el.setAttribute('data-fill-hidden', '1'); else el.removeAttribute('data-fill-hidden'); }
/** CSS 칠 문자열 → 이름칸 종류(그라데이션 아니면 'solid') */
export const fillKindOfCss = (css) => { const m = /(linear|radial|conic)-gradient\s*\(/i.exec(css || ''); return m ? m[1].toLowerCase() : 'solid'; };

/** 이름칸 즉시 맞춤(피커 탭을 바꾼 뒤 · 패널 재그리기 없이) — 이름으로 바꿀 때 그때 HEX 를 data-fill-hex 에 둠(포커스 때 되돌림) · 단색이면 표식만 걷고 HEX 는 피커가 채운다 */
export function setFillKindName(hexEl, kind) {
  if (!hexEl) return;
  if (FILL_KIND_NAME[kind]) { if (!hexEl.dataset.fillKind) hexEl.dataset.fillHex = hexEl.value; hexEl.value = FILL_KIND_NAME[kind]; hexEl.dataset.fillKind = kind; }
  else if (hexEl.dataset.fillKind) { if (hexEl.value === FILL_KIND_NAME[hexEl.dataset.fillKind]) hexEl.value = hexEl.dataset.fillHex || hexEl.value; delete hexEl.dataset.fillKind; delete hexEl.dataset.fillHex; }
}
/* 이름칸 포커스 = HEX(쳐서 단색으로 가는 옛 길) · 안 바꾸고 나가면 이름 — 패널마다 배선 없이 한 벌(document 위임) */
if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') document.addEventListener('focusin', (e) => { const h = e.target; if (h?.classList?.contains('prop-color-hex') && h.dataset.fillKind) { h.value = h.dataset.fillHex || ''; h.select?.(); } });
if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') document.addEventListener('focusout', (e) => { const h = e.target; if (h?.classList?.contains('prop-color-hex') && h.dataset.fillKind && FILL_KIND_NAME[h.dataset.fillKind]) h.value = FILL_KIND_NAME[h.dataset.fillKind]; });

/**
 * @param {object} o
 * @param {string} o.prefix       부품 id 접두(예: 'shape-fill') — 눈 `${prefix}-eye` · − `${prefix}-remove` · ＋ `${prefix}-add`
 * @param {string} o.colorHtml    옛 색 칸 마크업(colorFieldHTML · 옛 id 그대로)
 * @param {boolean} [o.on]        false = 칠 없음(겹 줄 대신 «칠 없음» 줄 · 머리 ＋)
 * @param {string} [o.kind]       'solid' | 'linear' | 'radial' | 'image' — 이름칸(단색이면 옛 HEX 그대로)
 * @param {string} [o.hiddenWhy]  눈 막힘 까닭(기본 «곧 지원») · '' 면 산다(F6 · 어댑터 hide 필요)
 * @param {boolean|'mixed'} [o.hidden] 숨김 중(눈 눌림 · 줄 흐림 · fillHiddenOf(block)) · 'mixed' = 여러 고름에서 일부만(눈 aria-pressed=mixed · 누르면 전부 숨김)
 * @param {string} [o.slotsBelow] 블럭 슬롯(.ui-stroke-slot 꼴)
 * @param {string} [o.removeWhy]  − 막힘 까닭(칠을 못 지우는 블럭 · 예: 그라데이션 블럭) · '' 면 산다
 */
export function fillSectionHTML({ prefix, colorHtml, on = true, kind = 'solid', hiddenWhy = '숨기기 — 곧 지원', hidden = false, slotsBelow = '', removeWhy = '' }) {
  let field = String(colorHtml || '').replace('class="prop-color-field"', 'class="prop-color-field" data-part="color" data-field="fill-color"');
  if (FILL_KIND_NAME[kind]) field = field.replace(/(<input type="text" class="prop-color-hex"[^>]*?) value="([^"]*)"/, `$1 value="${FILL_KIND_NAME[kind]}" data-fill-kind="${kind}" data-fill-hex="$2"`);
  const eyeDis = hiddenWhy ? ` aria-disabled="true" tabindex="0" title="${hiddenWhy}"` : '';
  const hid = !hiddenWhy && hidden === true;
  const pressed = !hiddenWhy && hidden === 'mixed' ? 'mixed' : String(hid);   // F6-3 여러 고름 — 일부만 숨김 = mixed
  const layer = `<div class="ui-fill-layer" data-fill-index="0"${hid ? ' data-hidden="1"' : ''}>
          <div class="prop-color-row ui-f-row">${field}<button type="button" class="prop-icon-btn ui-fill-btn" id="${prefix}-eye" aria-label="${hid ? '보이기' : '숨기기'}" aria-pressed="${pressed}"${eyeDis}>${hid ? EYE_OFF : EYE}</button><button type="button" class="prop-icon-btn ui-fill-btn" id="${prefix}-remove" aria-label="칠 지우기" title="${removeWhy || '칠 지우기'}"${removeWhy ? ' aria-disabled="true"' : ''}>${MINUS}</button></div>
        </div>`;
  return `
      <div class="ui-fill" data-part="fill"${on ? '' : ' data-empty="1"'}>
        ${on ? layer : '<div class="ui-fill-none">칠 없음 — ＋ 로 더하기</div>'}${slotsBelow}
      </div>`;
}

/** 머리 ＋ — 칠이 없을 때만(시안 ① «빈 Fill(＋만)») · 있을 땐 빈 문자열 */
export function fillHeadToolsHTML({ prefix, on }) {
  return on ? '' : `<button type="button" class="prop-chain-btn prop-sec-add ui-fill-add" id="${prefix}-add" data-part="end-slot" aria-label="칠 더하기" title="칠 더하기">${PLUS}</button>`;
}

/** 배선 — ＋ = adapter.add · − = adapter.none(숨김 중이면 숨김 먼저 걷음 — 다시 ＋ 했을 때 숨은 채로 안 남게) · 눈 = adapter.hide(켬/끔 · 줄은 제자리에서 바꿈) · 각 이력 한 칸(commit) · 눈 막힘이면 열림·누름 막음 */
export function wireFillSection({ prefix, adapter }) {
  if (!adapter) return;
  document.getElementById(`${prefix}-add`)?.addEventListener('click', () => { adapter.add(); adapter.commit?.(); });
  const rm = document.getElementById(`${prefix}-remove`);
  const eye = document.getElementById(`${prefix}-eye`);
  const eyeLive = !!eye && eye.getAttribute('aria-disabled') !== 'true' && typeof adapter.hide === 'function';
  if (rm?.getAttribute('aria-disabled') !== 'true') rm?.addEventListener('click', () => { if (eyeLive && eye.getAttribute('aria-pressed') === 'true') adapter.hide(false); adapter.none(); adapter.commit?.(); });
  if (eyeLive) eye.addEventListener('click', () => {
    const on = eye.getAttribute('aria-pressed') !== 'true';
    adapter.hide(on);
    eye.setAttribute('aria-pressed', String(on)); eye.setAttribute('aria-label', on ? '보이기' : '숨기기'); eye.innerHTML = on ? EYE_OFF : EYE;
    const lay = eye.closest('.ui-fill-layer'); if (on) lay?.setAttribute('data-hidden', '1'); else lay?.removeAttribute('data-hidden');
    adapter.commit?.();
  });
  else if (eye) {
    eye.addEventListener('click', (e) => e.preventDefault());
    eye.addEventListener('keydown', (e) => { if (e.key !== 'Tab') e.preventDefault(); });
  }
}

/* ── F6-3 여러 고름 — 종류 표(지디 261124 · 단색 일괄 v1) ─────────────────────────────────────────────
 * 단일 패널 어댑터엔 color() 가 없다(색은 각 패널이 wireColorField onApply 로 속에서 칠함) ⇒ 그 onApply 와 «같은 쓰기»를 종류마다 한 줄로 둔다.
 *   paint = 그 패널 onApply 의 블럭 쓰기 그대로(패널 UI 손질 줄은 뺌) · get = 그 색 키 · hide = 숨김 키 뒤 다시 그리기(단일 어댑터 hide 와 같은 렌더러)
 *   ⛔두 길(단일 패널 / 이 표)이 갈라질 수 있다 → fill-std D28 «두 길 같은 바이트»(종류 15 · 복제본 둘)가 잰다 — 패널 onApply 를 바꾸면 여기도.
 *   그라데이션·이미지(solid=false)가 섞이면 여러 고름 색 칸은 막힘(v1). */
const _r = (fn) => (b) => window[fn]?.(b);
const _grad = (v) => /gradient\s*\(/i.test(v || '');
export const FILL_KINDS = [
  { kind: 'shape', match: (b) => b.classList.contains('shape-block'), get: (b) => b.dataset.shapeColor || '#cccccc',
    solid: (b) => !b.dataset.shapeGradient && !b.dataset.shapeFill && !_grad(b.dataset.shapeColor),
    paint: (b, c) => window._applyShapeSolidFill?.(b, c), hide: (b, on) => { const s = b.querySelector('svg'); if (s) s.style.fillOpacity = on ? '0' : ''; } },
  { kind: 'frame', match: (b) => b.classList.contains('frame-block') && !b.dataset.textFrame && !b.dataset.group && !b.dataset.bannerPreset && !b.querySelector(':scope > .shape-block'),
    get: (b) => b.dataset.bg || '', solid: (b) => !_grad(b.dataset.bg),
    paint: (b, c) => { b.style.backgroundImage = ''; b.style.backgroundColor = c; b.dataset.bg = c; window.syncFrameBgVars?.(b); } },
  { kind: 'asset', match: (b) => b.classList.contains('asset-block'), get: (b) => b.dataset.bgColor || '#a0a0a0', solid: (b) => !_grad(b.dataset.bgColor),
    paint: (b, c) => { b.style.background = ''; b.dataset.bgColor = c; b.style.backgroundColor = c; } },
  { kind: 'icon-circle', match: (b) => b.classList.contains('icon-circle-block'), get: (b) => b.dataset.bgColor || '', solid: () => true,
    paint: (b, c) => { b.dataset.bgColor = c; const ci = b.querySelector('.icb-circle'); if (ci) ci.style.backgroundColor = c; } },
  { kind: 'bridge', match: (b) => b.classList.contains('bridge-block'), get: (b) => b.dataset.bridgeColor || '#cccccc', solid: () => true,
    paint: (b, c) => { b.dataset.bridgeColor = c; b.querySelector('svg path')?.setAttribute('fill', c); }, hide: _r('renderBridgeBlock') },
  { kind: 'canvas', match: (b) => b.classList.contains('canvas-block'), get: (b) => (b.dataset.cardMode === 'simple' ? b.dataset.textBg : b.dataset.bg) || '',
    solid: (b) => !_grad(b.dataset.cardMode === 'simple' ? b.dataset.textBg : b.dataset.bg),
    paint: (b, c) => { if (b.dataset.cardMode === 'simple') { b.dataset.textBgLast = c; b.dataset.textBg = c; } else b.dataset.bg = c; window.renderCanvas?.(b); }, hide: _r('renderCanvas') },
  { kind: 'modal', match: (b) => b.classList.contains('modal-block'), get: (b) => b.dataset.bg || '', solid: () => true, paint: (b, c) => { b.dataset.bg = c; window.renderModalBlock?.(b); }, hide: _r('renderModalBlock') },
  { kind: 'innercard', match: (b) => b.classList.contains('innercard-block'), get: (b) => b.dataset.bg || '', solid: () => true, paint: (b, c) => { b.dataset.bg = c; window.renderInnerCardBlock?.(b); }, hide: _r('renderInnerCardBlock') },
  { kind: 'banner02', match: (b) => b.classList.contains('banner02-block'), get: (b) => b.dataset.bg || '', solid: (b) => !_grad(b.dataset.bg), paint: (b, c) => { b.dataset.bg = c; window.renderBanner02?.(b); }, hide: _r('renderBanner02') },
  { kind: 'step', match: (b) => b.classList.contains('step-block') && b.dataset.stepStyle === 'card', get: (b) => b.dataset.stepCardBg || '', solid: () => true, paint: (b, c) => { b.dataset.stepCardBg = c; window.renderStepBlock?.(b); }, hide: _r('renderStepBlock') },
  { kind: 'sticker-text', match: (b) => b.classList.contains('sticker-block') && b.dataset.shape === 'text', get: (b) => b.dataset.bgColor || '', solid: () => true,
    paint: (b, c) => { b.dataset.bgColor = (/rgba?\([^)]*?,\s*0\s*\)/.test(c) || /,\s*0\s*\)/.test(c)) ? 'transparent' : c; window.renderStickerBlock?.(b); window.rememberStickerStyle?.(b); }, hide: _r('renderStickerBlock') },
  { kind: 'radial', match: (b) => b.classList.contains('radial-block'), get: (b) => b.dataset.bg || '', solid: () => true, paint: (b, c) => { b.dataset.bg = c; window.renderRadialBlock?.(b); }, hide: _r('renderRadialBlock') },
  { kind: 'coupon', match: (b) => b.classList.contains('coupon-block'), get: (b) => b.dataset.bodyCol || '', solid: () => true, paint: (b, c) => { b.dataset.bodyCol = c; window.renderCouponBlock?.(b); }, hide: _r('renderCouponBlock') },
  { kind: 'zoom', match: (b) => b.classList.contains('zoom-block'), get: (b) => b.dataset.fill || '', solid: () => true, paint: (b, c) => { b.dataset.fill = c; window.renderZoomBlock?.(b); }, hide: _r('renderZoomBlock') },
];
/** 고른 단위(래퍼일 수 있음) → { block, k } · 도형 래퍼 = 안의 도형 · 글 프레임 = 글(표준 눈 막힘 = 표 밖) · 없으면 null */
export function fillKindOf(unit) {
  if (!unit) return null;
  const inner = unit.classList?.contains('frame-block') ? unit.querySelector(':scope > .shape-block') : null;
  const block = inner || unit;
  const k = FILL_KINDS.find((x) => x.match(block));
  return k ? { block, k } : null;
}
/** 숨김 켬/끔 — 키(한 곳) + 그 종류 다시 그리기 */
export function fillSetHidden(block, k, on) { setFillHiddenKey(block, on); k.hide?.(block, on); }
