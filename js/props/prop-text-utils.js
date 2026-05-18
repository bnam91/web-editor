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
