/* ════════════════════════════════════════════════════════════════════════
   EFFECTS 식구 — Noise(옛 «그레인» · 현빈 261123 · 시안 v11.7 시안A 1e0c5c2 · 미카사 Figma 실측 = Effects ＋ 의 Noise)
   ────────────────────────────────────────────────────────────────────────
   ★«자리만 옮김»: 옛 에셋 Appearance 절 «그레인» 막대 줄 → Effects ＋ 메뉴 «Noise» 카드(눈 · ✕ · 세기 막대+숫자). 기능·값·저장 키 무변.
     저장 = 에셋 안 .asset-grain 덧층(타일 노이즈 · css/editor-layout.css) + data-grain-intensity(0..100) + 인라인 opacity(= 세기/100) — 옛 저장본 그대로 열림.
   ★눈(끔) = 반사·그림자·블러 카드 규약(U8: 끔 = 값 보존 · 안 그림) — 끈 동안 값은 같은 덧층의 data-grain-off 로 옮기고 세기 0 · opacity 0.
     ⇒ 덧층을 읽는 곳(직렬화·이미지 교체 보존·Figma 알림 figmaGrainNotice)은 «세기 0 = 없음»으로 본다 — 따로 가르칠 곳 0.
   ★✕ = 덧층째 걷음(옛 «0» 과 같은 그림 · 흔적 0). 세기 0 = 걷음.
   ★대상 = 그림 든 에셋만(옛 줄 hasImage 조건 그대로 = has-image · 가림·흐림과 같은 대상). 메뉴 자리 = 그림자 다음(index.html 적재 차례).
   ★Figma 로는 안 나감 — 내보낼 때 알림은 export-figma-json.js figmaGrainNotice 그대로(이 파일 무관).
   ════════════════════════════════════════════════════════════════════════ */
import { registerFxType, fxIsCardOpen, fxSetCardOpen } from './effects-registry.js';

export const FX_NOISE_DEFAULT = 30;
const _clamp = (v) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0; };
const _layer = (el) => el?.querySelector?.(':scope > .asset-grain') || null;

/** {state:'none'|'on'|'off', v} — 패널·시험이 같은 함수를 본다. */
export function fxNoiseOf(el) {
  const g = _layer(el);
  if (!g) return { state: 'none', v: 0 };
  const on = _clamp(g.dataset.grainIntensity);
  if (on > 0) return { state: 'on', v: on };
  const off = _clamp(g.dataset.grainOff);
  if (off > 0) return { state: 'off', v: off };
  return { state: 'none', v: 0 };
}

/** 바꾸는 문 하나 — patch: {state?, v?} · 이력 = push-before(다른 카드와 같은 규약). */
export function setFxNoise(el, patch = {}, { history = true } = {}) {
  if (!el || !el.classList?.contains('asset-block')) return { ok: false };
  if (history) window.pushHistory?.('효과');
  const cur = fxNoiseOf(el);
  const v = patch.v !== undefined ? _clamp(patch.v) : (cur.v || FX_NOISE_DEFAULT);
  const state = patch.state || (cur.state === 'none' ? 'on' : cur.state);
  let g = _layer(el);
  if (state === 'none' || v <= 0) { g?.remove(); window.scheduleAutoSave?.(); return { ok: true, applied: fxNoiseOf(el) }; }
  if (!g) { g = document.createElement('div'); g.className = 'asset-grain'; el.appendChild(g); }   // 옛 패널과 같은 자리(에셋 직속 덧층)
  if (state === 'on') { g.dataset.grainIntensity = String(v); delete g.dataset.grainOff; g.style.opacity = String(v / 100); }
  else { g.dataset.grainIntensity = '0'; g.dataset.grainOff = String(v); g.style.opacity = '0'; }
  window.scheduleAutoSave?.();
  return { ok: true, applied: fxNoiseOf(el) };
}

function _cardHtml(el, P) {
  const fx = fxNoiseOf(el), open = fxIsCardOpen(el, 'noise');
  const eye = (window.EYE_ICONS || {})[fx.state === 'off' ? 'hidden' : 'shown'] || '';
  return `
      <div class="prop-cell-card${open ? ' expanded' : ''}" id="${P}-fxns-card" data-fx-type="noise">
        <div class="prop-cell-card-header" id="${P}-fxns-head">
          <button class="prop-icon-btn" id="${P}-fxns-eye" title="${fx.state === 'off' ? '효과 켜기' : '효과 끄기'}" aria-label="효과 켜기/끄기" aria-pressed="${fx.state === 'on'}">${eye}</button>
          <span class="prop-cell-card-title" style="flex:1;${fx.state === 'off' ? 'text-decoration:line-through;opacity:.6;' : ''}">Noise</span>
          <button class="prop-icon-btn" id="${P}-fxns-del" title="효과 삭제" aria-label="효과 삭제">×</button>
        </div>
        <div class="prop-cell-card-body" id="${P}-fxns-body"${open ? '' : ' hidden'}>
          <div class="prop-row">
            <span class="prop-label">세기</span>
            <input type="range" class="prop-slider" id="${P}-fxns-slider" min="0" max="100" step="1" value="${fx.v}">
            <input type="number" class="prop-number" id="${P}-fxns-num" min="0" max="100" value="${fx.v}">
          </div>
        </div>
      </div>`;
}

function _wireCard(el, P, again) {
  const $ = (id) => document.getElementById(`${P}-${id}`);
  $('fxns-del')?.addEventListener('click', (e) => { e.stopPropagation(); setFxNoise(el, { state: 'none' }); window.pushHistory?.('효과 끔'); again(); });
  $('fxns-eye')?.addEventListener('click', (e) => { e.stopPropagation(); const cur = fxNoiseOf(el).state; setFxNoise(el, { state: cur === 'off' ? 'on' : 'off' }); again(); });
  $('fxns-head')?.addEventListener('click', () => { const b = $('fxns-body'); if (!b) return; const open = b.hidden; b.hidden = !open; fxSetCardOpen(el, 'noise', open); $('fxns-card')?.classList.toggle('expanded', open); });
  const sl = $('fxns-slider'), n = $('fxns-num');
  if (!sl || !n) return;
  const keep = () => (fxNoiseOf(el).state === 'off' ? 'off' : 'on');
  sl.addEventListener('mousedown', () => window.pushHistory?.('효과'));
  sl.addEventListener('change', () => { window.pushHistory?.('효과'); if (_clamp(sl.value) <= 0) { setFxNoise(el, { state: 'none' }, { history: false }); again(); } });
  sl.addEventListener('input', () => { const v = _clamp(sl.value); if (v > 0) setFxNoise(el, { state: keep(), v }, { history: false }); n.value = v; });
  n.addEventListener('change', () => { const v = _clamp(n.value); setFxNoise(el, v > 0 ? { state: keep(), v } : { state: 'none' }); n.value = v; sl.value = v; if (v <= 0) again(); });
}

registerFxType({
  key: 'noise',
  label: 'Noise',
  supports: (el) => !!(el && el.classList && el.classList.contains('asset-block') && el.classList.contains('has-image')),   // 옛 «그레인» 줄 조건(hasImage)
  has: (el) => fxNoiseOf(el).state !== 'none',
  add: (el) => setFxNoise(el, { state: 'on', v: FX_NOISE_DEFAULT }),
  card: _cardHtml,
  wire: _wireCard,
});

if (typeof window !== 'undefined') Object.assign(window, { fxNoiseOf, setFxNoise, FX_NOISE_DEFAULT });
