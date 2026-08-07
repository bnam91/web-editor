// Pure helpers extracted from prop-text.js (Phase 1 refactor — risk-minimal)
// 외부 caller 영향 없음. prop-text.js만 import.

export function rgbToHex(rgb) {
  const m = rgb.match(/\d+/g);
  if (!m) return '#111111';
  return '#' + m.slice(0,3).map(x => parseInt(x).toString(16).padStart(2,'0')).join('');
}

/* ── 폰트 최근 사용 / 핀 고정 ── */
export function _pushRecentFont(fontValue) {
  if (!fontValue) return;
  const key = 'goditor_font_recent';
  let recent = JSON.parse(localStorage.getItem(key) || '[]');
  recent = [fontValue, ...recent.filter(f => f !== fontValue)].slice(0, 5);
  localStorage.setItem(key, JSON.stringify(recent));
}

export function _fontDisplayName(fontValue) {
  // "'Pretendard', sans-serif" → "Pretendard"
  return fontValue.replace(/['"]/g, '').split(',')[0].trim();
}

/* ── 폰트 폴백 체인 ──
 * 시스템 설치 폰트(A2Z 등)와 CDN 웹폰트(Noto/Inter/…)는 «다른 기기에 없을 수 있다».
 * 그때 generic으로 곧장 떨어지면 OS 기본 글꼴(윈도우=맑은고딕)로 보인다.
 * Pretendard는 assets/fonts/woff2 9종을 앱이 번들해 @font-face로 그리므로 «어디서든 있다»
 * → generic 앞에 끼워 최후의 보루로 쓴다. (editor.js 프리셋이 이미 쓰는 관례)
 *
 * ★serif 계열엔 끼우지 «않는다» — Pretendard는 sans라 serif 선택을 조용히 뒤집는다.
 *   generic serif는 실제 명조 계열(맥 AppleMyungjo / 윈 바탕)로 떨어지므로 그게 맞다.
 */
const SERIF_FAMILIES = new Set(['Noto Serif KR', 'Playfair Display']);

export function fontChain(family) {
  const fam = String(family || '').trim();
  if (!fam) return '';                                   // '기본 (시스템)' — 사용자 의도 존중
  if (SERIF_FAMILIES.has(fam)) return `'${fam}', serif`;
  if (fam === 'Pretendard') return `'${fam}', sans-serif`; // 자기 자신을 두 번 안 쓴다
  return `'${fam}', 'Pretendard', sans-serif`;
}

/* 폰트 «동일성» 판정 키 — 체인 문자열이 아니라 대표 패밀리명으로 본다.
   체인이 바뀌어도(폴백 추가 등) 기존 선택·핀·최근사용이 계속 매칭된다. */
export function _fontKey(fontValue) {
  return _fontDisplayName(String(fontValue || '')).toLowerCase();
}
