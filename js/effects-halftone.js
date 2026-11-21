/* ════════════════════════════════════════════════════════════════════════
   EFFECTS 식구 — 하프톤 (IMG-FX-HALFTONE-01 · 현빈 261121 · 0.9.14_이펙트 · 피그마 «Halftone» 플러그인 결)
   ────────────────────────────────────────────────────────────────────────
   ★자리 = 에셋(그림) Effects 드롭다운 «하프톤» — js/effects-registry.js 식구 하나(블러·반사와 같은 카드꼴: 눈 · ✕ · 접기).
   ★상태 = 에셋 블럭 data-halftone(JSON · js/fx/halftone.js normHalftone 소독) 한 키 · 끈 동안 = data-halftone-off(값 보존).
   ★화면 = 그 값으로 «구운» 덮개 <img class="asset-halftone">(.asset-img-clip 안 · 그림 바로 위 · 인라인 위치 = 새 CSS 0).
     덮개 = 최종 그림 한 장(바탕 + 점 · 바탕 'none' 이면 원본 사진 위에 점) ⇒ PNG·HTML 은 그 그림을 그대로 찍고,
     Figma JSON 은 그 블럭 src 를 덮개 그림으로 바꾼다(js/io/export-figma-json.js).
   ★덮개는 «파생»이다 — 저장·이력 표본에서 뺀다(section-serialize serializeCleanRoot) · 열기·undo(rebindAll → watchAll)·
     그림 로드(img load)·블럭 크기 바뀜(ResizeObserver) 때 다시 굽는다.
   ★블러(가림 · data-redact)가 켜진 블럭은 굽지 않는다 — 원본 점무늬가 가림 위로 새면 가림이 깨진다.
   shortcut: 그림 회전(imgRotate)은 무시하고 그림 상자 기준으로 굽는다 — 회전 + 하프톤 요구가 오면 회전 행렬로 그린다.
   ════════════════════════════════════════════════════════════════════════ */
import { registerFxType, fxIsCardOpen, fxSetCardOpen } from './effects-registry.js';
import { normalizeDecorBlur } from './effects/image-redact.js';   // 흐림(IMG-FX-BLUR-01) 값 — 굽기 때 원본을 흐리게(두 효과 다 산다 · 열차 261121)
import { normHalftone, parseHalftone, serializeHalftone, halftoneDots, lumOf, HT_DEFAULTS, HT_RANGES, HT_SHAPES } from './fx/halftone.js';

const OVERLAY_CLS = 'asset-halftone';
const SCALE = 2;   // 덮개 해상도 = 블럭 px × 2(레티나·PNG 1000 폭에서도 점이 무르지 않게)

const _isImageAsset = (el) => !!(el && el.classList && el.classList.contains('asset-block') && el.classList.contains('has-image')
  && el.querySelector(':scope > .asset-img-clip > img.asset-img') && !el.dataset.gifSrc);

/** 효과 읽기 — {state:'none'|'on'|'off', o}. */
export function fxHalftoneOf(el) {
  const on = parseHalftone(el?.dataset?.halftone);
  if (on) return { state: 'on', o: on };
  const off = parseHalftone(el?.dataset?.halftoneOff);
  if (off) return { state: 'off', o: off };
  return { state: 'none', o: normHalftone(HT_DEFAULTS) };
}

/** 바꾸는 문 하나 — patch: {state?, ...옵션}. 이력 = push-before(블러·글로우 카드와 같은 규약). */
export function setFxHalftone(el, patch = {}, { history = true } = {}) {
  if (!el || !el.dataset) return { ok: false };
  if (history) window.pushHistory?.('효과');
  const cur = fxHalftoneOf(el);
  const { state: want, ...rest } = patch;
  const state = want || (cur.state === 'none' ? 'on' : cur.state);
  const o = serializeHalftone({ ...cur.o, ...rest });
  delete el.dataset.halftone; delete el.dataset.halftoneOff;
  if (state === 'on') el.dataset.halftone = o;
  else if (state === 'off') el.dataset.halftoneOff = o;
  applyHalftone(el);
  window.scheduleAutoSave?.();
  return { ok: true, applied: fxHalftoneOf(el) };
}

function _overlayOf(el) { return el.querySelector(`:scope > .asset-img-clip > img.${OVERLAY_CLS}`); }
function _drop(el) { _overlayOf(el)?.remove(); }

/* 그림이 «화면에 보이는 그대로» 판 위 어디에 놓였나(블럭 px) — 상자는 clip 기준 rect 비(배율 상쇄) · 안 내용은 object-fit/position 셈. */
function _contentRect(img, clip, W) {
  const cr = clip.getBoundingClientRect(), ir = img.getBoundingClientRect(), k = cr.width / W || 1;
  const bx = (ir.left - cr.left) / k, by = (ir.top - cr.top) / k, bw = ir.width / k, bh = ir.height / k;
  const cs = getComputedStyle(img), fit = cs.objectFit, nw = img.naturalWidth, nh = img.naturalHeight;
  if (fit === 'fill' || !nw || !nh) return { x: bx, y: by, w: bw, h: bh };
  const s = fit === 'contain' ? Math.min(bw / nw, bh / nh) : fit === 'none' ? 1 : fit === 'scale-down' ? Math.min(1, bw / nw, bh / nh) : Math.max(bw / nw, bh / nh);
  const w = nw * s, h = nh * s;
  const [px, py] = (cs.objectPosition || '50% 50%').split(/\s+/).map((t) => (t.endsWith('%') ? parseFloat(t) / 100 : 0.5));
  return { x: bx + (bw - w) * (Number.isFinite(px) ? px : 0.5), y: by + (bh - h) * (Number.isFinite(py) ? py : 0.5), w, h };
}

function _drawDot(ctx, d, shape, angle, gap) {
  if (shape === 'circle') { ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2); ctx.fill(); return; }
  ctx.save(); ctx.translate(d.x, d.y); ctx.rotate((angle * Math.PI) / 180);
  if (shape === 'square') ctx.fillRect(-d.r, -d.r, d.r * 2, d.r * 2);
  else ctx.fillRect(-gap / 2, -d.r, gap, d.r * 2);   // line = 격자 방향 띠(굵기 = 밝기)
  ctx.restore();
}

/** 굽기 — 켜짐·그림 있음·가림 아님이면 덮개를 (다시) 만든다. 굽지 못하면(그림 미로드·캔버스 오염) 덮개를 치우고 false. */
export function applyHalftone(el) {
  if (!el || !el.querySelector) return false;
  const fx = fxHalftoneOf(el);
  if (fx.state !== 'on' || !_isImageAsset(el) || el.dataset.redact) { _drop(el); return false; }
  const clip = el.querySelector(':scope > .asset-img-clip'), img = clip.querySelector(':scope > img.asset-img');
  if (!img.complete || !img.naturalWidth) return false;   // 로드되면 img load 듣개가 다시 부른다
  const W = clip.offsetWidth, H = clip.offsetHeight;
  if (!W || !H) return false;
  const blur = normalizeDecorBlur(el.dataset.decorBlur);   // 가림이면 위에서 이미 덮개 없음(가림 우선)
  const o = fx.o, sig = JSON.stringify([o, W, H, img.currentSrc || img.src, img.style.cssText, blur]);
  const ov0 = _overlayOf(el);
  if (ov0 && ov0.dataset.htSig === sig) return true;
  const cw = Math.round(W * SCALE), ch = Math.round(H * SCALE);
  const src = document.createElement('canvas'); src.width = cw; src.height = ch;
  const sx = src.getContext('2d', { willReadFrequently: true });
  const r = _contentRect(img, clip, W);
  if (blur) sx.filter = `blur(${blur * SCALE}px)`;   // «흐린 사진을 망점화» — 캔버스 drawImage 는 CSS filter 를 안 받으니 여기서 같은 px 로(캔버스는 ×SCALE)
  sx.drawImage(img, r.x * SCALE, r.y * SCALE, r.w * SCALE, r.h * SCALE);
  let px;
  try { px = sx.getImageData(0, 0, cw, ch).data; } catch (e) { console.warn('[halftone] 그림을 못 읽음(오염) — 원본 그대로:', e?.message); _drop(el); return false; }
  const at = (x, y) => { const i = (Math.min(ch - 1, Math.floor(y * SCALE)) * cw + Math.min(cw - 1, Math.floor(x * SCALE))) * 4; return i; };
  const dots = halftoneDots((x, y) => { const i = at(x, y); return lumOf(px[i], px[i + 1], px[i + 2], px[i + 3]); }, W, H, o);
  const out = document.createElement('canvas'); out.width = cw; out.height = ch;
  const ctx = out.getContext('2d');
  if (o.bg === 'none') ctx.drawImage(src, 0, 0); else { ctx.fillStyle = o.bg; ctx.fillRect(0, 0, cw, ch); }
  ctx.scale(SCALE, SCALE);
  if (o.color !== 'image') ctx.fillStyle = o.color;
  for (const d of dots) {
    if (o.color === 'image') {   // 칸 가운데 원본 색 · 바탕도 원본 사진이면 같은 색 점은 안 보인다 ⇒ 반 밝기(잉크처럼 짙게)
      const i = at(d.x, d.y), k = o.bg === 'none' ? 0.5 : 1;
      ctx.fillStyle = '#' + ((1 << 24) | ((px[i] * k) << 16) | ((px[i + 1] * k) << 8) | (px[i + 2] * k)).toString(16).slice(1);
    }
    _drawDot(ctx, d, o.shape, o.angle, o.gap);
  }
  const ov = ov0 || Object.assign(document.createElement('img'), { className: OVERLAY_CLS, alt: '', draggable: false });
  ov.setAttribute('style', 'position:absolute;inset:0;width:100%;height:100%;object-fit:fill;pointer-events:none;');
  ov.setAttribute('aria-hidden', 'true');
  ov.dataset.htSig = sig;
  ov.src = out.toDataURL('image/png');
  if (!ov0) img.after(ov);
  _observe(clip);
  return true;
}

/* 크기 바뀜 → 다시 굽기(rAF 한 번에 모아서). */
let _ro = null; const _pending = new Set(); let _raf = 0;
function _observe(clip) {
  if (typeof ResizeObserver === 'undefined') return;
  _ro = _ro || new ResizeObserver((ents) => {
    for (const e of ents) { const ab = e.target.parentElement; if (ab) _pending.add(ab); }
    if (_raf) return;
    _raf = requestAnimationFrame(() => { _raf = 0; const list = [..._pending]; _pending.clear(); list.forEach((ab) => { if (ab.isConnected) applyHalftone(ab); }); });
  });
  _ro.observe(clip);
}

/** 문서를 연 뒤·undo 뒤(rebindAll → watchAllFx) — 켜진 블럭 다시 굽기 · 남은 덮개(꺼진 블럭) 치우기. 돌려주는 수 = 켜진 블럭 수. */
export function watchAllFxHalftone(root = document) {
  if (!root || !root.querySelectorAll) return 0;
  root.querySelectorAll(`img.${OVERLAY_CLS}`).forEach((ov) => { const ab = ov.closest('.asset-block'); if (!ab || !ab.dataset.halftone) ov.remove(); });
  const els = root.querySelectorAll('.asset-block[data-halftone]');
  els.forEach(applyHalftone);
  return els.length;
}

/* 그림 로드(처음·교체·lazy) → 그 블럭 굽기 — load 는 거품이 안 올라 capture 로 듣는다. */
if (typeof document !== 'undefined' && !window.__htLoadBound) {
  window.__htLoadBound = true;
  document.addEventListener('load', (e) => {
    const t = e.target;
    if (t && t.tagName === 'IMG' && t.classList.contains('asset-img')) { const ab = t.closest('.asset-block[data-halftone]'); if (ab) applyHalftone(ab); }
  }, true);
}

/* ═══ 카드 — 블러·글로우 카드와 같은 꼴 ═══ */
function _cssHex(c) {   // 이름 색('white')도 색 칸에 넣을 수 있게 #rrggbb 로(캔버스가 정규화)
  const x = document.createElement('canvas').getContext('2d'); x.fillStyle = c; return x.fillStyle;
}
function _cardHtml(el, P) {
  const fx = fxHalftoneOf(el), o = fx.o, open = fxIsCardOpen(el, 'halftone');
  const eye = (window.EYE_ICONS || {})[fx.state === 'off' ? 'hidden' : 'shown'] || '';
  const slider = (lbl, key) => { const [lo, hi] = HT_RANGES[key]; return `
          <div class="prop-row">
            <span class="prop-label">${lbl}</span>
            <input type="range" class="prop-slider" id="${P}-fxht-${key}-slider" min="${lo}" max="${hi}" step="1" value="${o[key]}">
            <input type="number" class="prop-number" id="${P}-fxht-${key}-num" min="${lo}" max="${hi}" value="${o[key]}">
          </div>`; };
  const shapeLbl = { circle: '원', square: '네모', line: '선' };
  const colorHex = o.color === 'image' ? _cssHex('black') : o.color, bgHex = o.bg === 'none' ? _cssHex('white') : _cssHex(o.bg);
  const fmt = (h) => (window.formatHex6 ? window.formatHex6(h) : h.replace('#', '').toUpperCase());
  return `
      <div class="prop-cell-card${open ? ' expanded' : ''}" id="${P}-fxht-card" data-fx-type="halftone">
        <div class="prop-cell-card-header" id="${P}-fxht-head">
          <button class="prop-icon-btn" id="${P}-fxht-eye" title="${fx.state === 'off' ? '효과 켜기' : '효과 끄기'}" aria-label="효과 켜기/끄기" aria-pressed="${fx.state === 'on'}">${eye}</button>
          <span class="prop-cell-card-title" style="flex:1;${fx.state === 'off' ? 'text-decoration:line-through;opacity:.6;' : ''}">하프톤</span>
          <button class="prop-icon-btn" id="${P}-fxht-del" title="효과 삭제" aria-label="효과 삭제">×</button>
        </div>
        <div class="prop-cell-card-body" id="${P}-fxht-body"${open ? '' : ' hidden'}>${slider('점 크기', 'size')}${slider('간격', 'gap')}${slider('각도', 'angle')}
          <div class="prop-row">
            <span class="prop-label">모양</span>
            <select class="prop-select" id="${P}-fxht-shape" aria-label="점 모양">${HT_SHAPES.map((s) => `<option value="${s}"${o.shape === s ? ' selected' : ''}>${shapeLbl[s]}</option>`).join('')}</select>
          </div>
          <div class="prop-row">
            <span class="prop-label">점 색</span>
            <select class="prop-select" id="${P}-fxht-color-mode" aria-label="점 색 방식"><option value="image"${o.color === 'image' ? ' selected' : ''}>원본 색</option><option value="solid"${o.color !== 'image' ? ' selected' : ''}>한 색</option></select>
          </div>
          <div class="prop-color-row"${o.color === 'image' ? ' hidden' : ''}>   <!-- 색 칸은 제 줄(지디 261121: 한 줄에 셋이면 hex 칸이 잘림) -->
            <span class="prop-label"></span>
            <div class="prop-color-field">
              <div class="prop-color-swatch" style="background:${colorHex}"><input type="color" id="${P}-fxht-color" value="${colorHex}"></div>
              <input type="text" class="prop-color-hex" id="${P}-fxht-color-hex" value="${fmt(colorHex)}" maxlength="7" aria-label="점 색">
            </div>
          </div>
          <div class="prop-row">
            <span class="prop-label">바탕</span>
            <select class="prop-select" id="${P}-fxht-bg-mode" aria-label="바탕 방식"><option value="solid"${o.bg !== 'none' ? ' selected' : ''}>한 색</option><option value="none"${o.bg === 'none' ? ' selected' : ''}>원본 사진</option></select>
          </div>
          <div class="prop-color-row"${o.bg === 'none' ? ' hidden' : ''}>   <!-- 색 칸은 제 줄(지디 261121: 한 줄에 셋이면 hex 칸이 잘림) -->
            <span class="prop-label"></span>
            <div class="prop-color-field">
              <div class="prop-color-swatch" style="background:${bgHex}"><input type="color" id="${P}-fxht-bg" value="${bgHex}"></div>
              <input type="text" class="prop-color-hex" id="${P}-fxht-bg-hex" value="${fmt(bgHex)}" maxlength="7" aria-label="바탕 색">
            </div>
          </div>
        </div>
      </div>`;
}

function _wireCard(el, P, again) {
  const $ = (id) => document.getElementById(`${P}-${id}`);
  $('fxht-del')?.addEventListener('click', (e) => { e.stopPropagation(); setFxHalftone(el, { state: 'none' }); window.pushHistory?.('효과 끔'); again(); });
  $('fxht-eye')?.addEventListener('click', (e) => { e.stopPropagation(); const cur = fxHalftoneOf(el).state; setFxHalftone(el, { state: cur === 'off' ? 'on' : 'off' }); again(); });
  $('fxht-head')?.addEventListener('click', () => { const b = $('fxht-body'); if (!b) return; const open = b.hidden; b.hidden = !open; fxSetCardOpen(el, 'halftone', open); $('fxht-card')?.classList.toggle('expanded', open); });
  const keep = () => (fxHalftoneOf(el).state === 'off' ? 'off' : 'on');
  for (const key of ['size', 'gap', 'angle']) {
    const sl = $(`fxht-${key}-slider`), n = $(`fxht-${key}-num`);
    if (!sl || !n) continue;
    sl.addEventListener('mousedown', () => window.pushHistory?.('효과'));
    sl.addEventListener('change', () => window.pushHistory?.('효과'));   /* 끝 표본 — 블러·글로우 카드와 같은 규약 */
    sl.addEventListener('input', () => { setFxHalftone(el, { state: keep(), [key]: sl.value }, { history: false }); n.value = fxHalftoneOf(el).o[key]; });
    n.addEventListener('change', () => { setFxHalftone(el, { state: keep(), [key]: n.value }); const v = fxHalftoneOf(el).o[key]; n.value = v; sl.value = v; });
  }
  $('fxht-shape')?.addEventListener('change', (e) => setFxHalftone(el, { state: keep(), shape: e.target.value }));
  $('fxht-color-mode')?.addEventListener('change', (e) => { setFxHalftone(el, { state: keep(), color: e.target.value === 'image' ? 'image' : ($('fxht-color')?.value || _cssHex('black')) }); again(); });
  $('fxht-bg-mode')?.addEventListener('change', (e) => { setFxHalftone(el, { state: keep(), bg: e.target.value === 'none' ? 'none' : ($('fxht-bg')?.value || 'white') }); again(); });
  const col = (id, key) => {
    const c = $(id), h = $(`${id}-hex`);
    c?.addEventListener('input', () => setFxHalftone(el, { state: keep(), [key]: c.value }, { history: false }));
    c?.addEventListener('change', () => { window.pushHistory?.('효과'); again(); });
    h?.addEventListener('change', () => { const v = h.value.startsWith('#') ? h.value : '#' + h.value; setFxHalftone(el, { state: keep(), [key]: v }); again(); });
  };
  col('fxht-color', 'color'); col('fxht-bg', 'bg');
}

registerFxType({
  key: 'halftone',
  label: '하프톤',
  supports: _isImageAsset,   // 정지 그림 에셋만(GIF·영상 0)
  has: (el) => fxHalftoneOf(el).state !== 'none',
  add: (el) => setFxHalftone(el, { state: 'on', ...HT_DEFAULTS }),
  card: _cardHtml,
  wire: _wireCard,
  watchAll: watchAllFxHalftone,
});

if (typeof window !== 'undefined') Object.assign(window, { fxHalftoneOf, setFxHalftone, applyHalftone, watchAllFxHalftone });
