/* fx/holo-palette.js — 홀로그램(무지갯빛) 색 정본 · FX-GRADIENT-GAZE-01(현빈 261121 · 가안 = «계산 그라데이션»).
 *   배지 .badge-hologram-* 의 conic 7색(css/editor-blocks.css --holo-c1..c7)과 «홀로그램» 효과 식구가 같은 색을 쓴다.
 *   CSS 쪽 값과 이 표가 같은지는 tests/unit/holo-palette.test.mjs 가 CSS 를 읽어 잰다(두 벌이 갈라지면 빨강).
 *   정지 각도 = 배지와 같은 0·40·90·140·200·250·310·360(마지막 = 첫 색 · 고리).
 *   ESM · DOM 0(js/fx/package.json "type":"module").
 */
export const HOLO_STOP_DEG = Object.freeze([0, 40, 90, 140, 200, 250, 310, 360]);
export const HOLO_FROM_DEG = 210;
export const HOLO_PRESETS = Object.freeze({
  silver: Object.freeze(['#f0e8dc', '#ffe8f0', '#ccddc0', '#ebe0f5', '#b8acc8', '#ffffff', '#c8b8e0']),   // 배지 기본
  gold:   Object.freeze(['#d4a956', '#fff3c2', '#b8821a', '#f0d088', '#a87420', '#ffefa0', '#b88830']),   // 배지 color-gold
  rose:   Object.freeze(['#e0a8a0', '#ffe0d8', '#c88478', '#f0c8c0', '#b07060', '#ffe8e0', '#c08878']),   // 배지 color-rose
  pearl:  Object.freeze(['#f0d8f5', '#fff0fa', '#c8b0e5', '#fdd8f0', '#a890c8', '#ffffff', '#d8a8e5']),   // 배지 color-pearl
  aurora: Object.freeze(['#7ef0d0', '#a0c4ff', '#e3a8ff', '#ffd6a0', '#9bf6ff', '#ffffff', '#caffbf']),   // 새로(효과용) — 민트·하늘·보라·살구
  oil:    Object.freeze(['#3b2e5a', '#5ad1c8', '#f5a3c7', '#f9e27d', '#6b8cff', '#e8f6ff', '#8e5bd8']),   // 새로(효과용) — 기름막처럼 짙은 바탕
});
export const HOLO_KEYS = Object.freeze(Object.keys(HOLO_PRESETS));

/** conic-gradient 글(CSS) — from = 시작각(deg) · 프리셋 이름이 틀리면 silver. */
export function holoConicCss(preset, from = HOLO_FROM_DEG) {
  const c = HOLO_PRESETS[preset] || HOLO_PRESETS.silver;
  const stops = HOLO_STOP_DEG.map((d, i) => `${c[i % c.length]} ${d}deg`);
  return `conic-gradient(from ${Number(from) || 0}deg at 50% 50%, ${stops.join(', ')})`;
}
/** Figma GRADIENT_ANGULAR 정지점(0..1) — 같은 색·같은 각도 비. */
export function holoAngularStops(preset) {
  const c = HOLO_PRESETS[preset] || HOLO_PRESETS.silver;
  return HOLO_STOP_DEG.map((d, i) => ({ position: d / 360, color: c[i % c.length] }));
}

/* ═══ FX-GRADIENT-GAZE-01 v2(현빈 261121 · 16종 · 원뿔형 포함) — 색 고르기 «홀로그램» 프리셋 정본 ═══
 * ★색값은 우리가 새로 지었다 — 원본 플러그인 표(handoff/MIKASA-plugin-check-1121/notes.md)는 «자연스러운지» 견주는 검수 참고로만 봤고
 *   색·정지점을 옮기지 않았다(IP · 지디 261121). 처음 6종 = 위 배지 팔레트(우리 것)를 linear 고리로.
 * 꼴: { key, type: 'linear' | 'conic', stops: [[#rrggbb, 0..1], …] } · conic 은 끝 = 첫 색(고리) · 각도는 색 고르기 손잡이 그대로(linear = 방향 · conic = 시작각). */
const _ring = (c) => HOLO_STOP_DEG.map((d, i) => [c[i % c.length], d / 360]);
export const GAZE_PRESETS = Object.freeze([
  { key: 'silver', type: 'linear', stops: _ring(HOLO_PRESETS.silver) },
  { key: 'gold', type: 'linear', stops: _ring(HOLO_PRESETS.gold) },
  { key: 'rose', type: 'linear', stops: _ring(HOLO_PRESETS.rose) },
  { key: 'pearl', type: 'linear', stops: _ring(HOLO_PRESETS.pearl) },
  { key: 'aurora', type: 'linear', stops: _ring(HOLO_PRESETS.aurora) },
  { key: 'oil', type: 'linear', stops: _ring(HOLO_PRESETS.oil) },
  { key: 'mist', type: 'linear', stops: [['#dfe9ff', 0], ['#f7e6ff', 0.35], ['#e3fff4', 0.7], ['#fff6e0', 1]] },
  { key: 'sunset', type: 'linear', stops: [['#ffd3a5', 0], ['#fd9fb1', 0.4], ['#c89cf2', 0.75], ['#8fc6ff', 1]] },
  { key: 'mint', type: 'linear', stops: [['#c8f7e8', 0], ['#d9e4ff', 0.5], ['#f2d6ff', 1]] },
  { key: 'chrome', type: 'linear', stops: [['#e9ecf2', 0], ['#ffffff', 0.2], ['#b9c0cc', 0.45], ['#f4f6fa', 0.65], ['#a8b0bd', 0.85], ['#e9ecf2', 1]] },
  { key: 'neon', type: 'linear', stops: [['#6ef3d6', 0], ['#79a8ff', 0.3], ['#c37bff', 0.55], ['#ff7ac0', 0.8], ['#ffd36e', 1]] },
  { key: 'pastel', type: 'linear', stops: [['#ffc9c9', 0], ['#ffe7b3', 0.2], ['#fff8b8', 0.4], ['#c9f7d4', 0.6], ['#c4e4ff', 0.8], ['#e2ccff', 1]] },
  { key: 'prism', type: 'conic', stops: [['#ff9ec4', 0], ['#ffd59e', 0.2], ['#f8ff9e', 0.38], ['#9effc8', 0.55], ['#9ed8ff', 0.72], ['#c99eff', 0.88], ['#ff9ec4', 1]] },
  { key: 'slick', type: 'conic', stops: [['#2e2a4f', 0], ['#3fc1c0', 0.18], ['#e8a3d0', 0.36], ['#f4e285', 0.52], ['#5b7cfa', 0.7], ['#2e2a4f', 1]] },
  { key: 'opal', type: 'conic', stops: [['#f4f0ff', 0], ['#cfe8ff', 0.25], ['#e8ffe9', 0.5], ['#ffe6f4', 0.75], ['#f4f0ff', 1]] },
  { key: 'goldswirl', type: 'conic', stops: [['#f7e2a8', 0], ['#fff8e1', 0.25], ['#d9b25f', 0.5], ['#fff1c7', 0.75], ['#f7e2a8', 1]] },
]);
/** 스와치 미리보기 CSS — 그 종류 그대로(linear 90° · conic 0°). */
export function gazeSwatchCss(p) {
  const parts = p.stops.map(([c, o]) => `${c} ${Math.round(o * 100)}%`).join(', ');
  return p.type === 'conic' ? `conic-gradient(from 0deg at 50% 50%, ${parts})` : `linear-gradient(90deg, ${parts})`;
}

/* ── 세기 = «덮는 정도»(미카사 채점 261121 ③ · 지디 승인): 홀로 정지점 색을 «넣기 전 칠» 위에 a% 로 얹은 결과 색 —
 *   0 = 넣기 전 칠 · 100 = 홀로 그대로 · 결과는 여전히 정지점 목록 한 벌(그라데이션 칠 한 장).
 *   base = null(넣기 전 칠 모름 · 투명) → 옛 셈(정지점 투명도 = a) · {solid:색} → 알파 합성과 같은 셈(정확) ·
 *   {stops:[{color, offset 0..1, opacity?}]} → 넣기 전 그라데이션을 «홀로 정지점 자리(offset)»에서 표본.
 *   shortcut: 넣기 전 그라데이션의 꼴·각도가 홀로와 다르면(예: 선형 위 원뿔) 같은 offset ≠ 같은 화면 자리 — 근사다(DOM 이 근사 정도를 수로 남긴다). 정확해야 하면 칠을 두 겹으로. */
const _rgba = (c) => {
  const s = String(c || '').trim();
  let m = /^#([0-9a-f]{3,8})$/i.exec(s);
  if (m) { let h = m[1]; if (h.length === 3 || h.length === 4) h = h.split('').map((x) => x + x).join(''); if (h.length !== 6 && h.length !== 8) return null;
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1]; }
  m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)$/i.exec(s);
  if (m) { const a = m[4] == null ? 1 : (m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4])); return [+m[1], +m[2], +m[3], a]; }
  return null;
};
const _hex = (r, g, b) => '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
/** 정지점 목록을 t(0..1)에서 표본 — [r,g,b,a] · 정지점 opacity 를 a 에 곱한다 · 못 읽으면 null. */
export function sampleStops(stops, t) {
  const st = (Array.isArray(stops) ? stops : []).map((x) => { const c = _rgba(x && x.color); return c ? { o: Number(x.offset) || 0, c: [c[0], c[1], c[2], c[3] * (x.opacity == null ? 1 : Number(x.opacity))] } : null; }).filter(Boolean).sort((a, b) => a.o - b.o);
  if (!st.length) return null;
  if (t <= st[0].o) return st[0].c;
  for (let i = 1; i < st.length; i++) if (t <= st[i].o) { const a = st[i - 1], b = st[i], f = b.o === a.o ? 0 : (t - a.o) / (b.o - a.o); return a.c.map((v, j) => v + (b.c[j] - v) * f); }
  return st[st.length - 1].c;
}
/** 홀로 정지점([색, offset]) + 세기 a(0..100) + 넣기 전 칠 base → 그라데이션 모델 정지점 [{color, offset, opacity}]. */
export function holoMixStops(stops, a, base) {
  const k = Math.max(0, Math.min(100, Number(a))) / 100;
  return stops.map(([color, offset]) => {
    const h = _rgba(color);
    const b = !base ? null : base.solid != null ? _rgba(base.solid) : sampleStops(base.stops, offset);
    if (!h || !b) return { color, offset, opacity: k };   // 넣기 전 칠 모름 = 옛 셈(투명도)
    const oa = k + b[3] * (1 - k);
    const mix = (j) => (oa ? (h[j] * k + b[j] * b[3] * (1 - k)) / oa : 0);
    return { color: _hex(mix(0), mix(1), mix(2)), offset, opacity: Math.round(oa * 1000) / 1000 };
  });
}
