/* label-presets.js — 라벨(태그) 블럭 «내 프리셋» (t3-01 · 2026-11-13 · 지디 승인 설계 ~/Downloads/goditor-t3/DONE-T3-W2a.md)
 * 저장 범위 = «꼴»만: 태그 배경·글자색·테두리·모서리·위아래 여백(높이) + 모양(pill|circle) + 블럭 간격.
 *   글·태그 수·정렬·위치·너비는 안 담는다(내용/배치).
 * 저장 위치 = localStorage 'goditor_label_presets' — 앱 전역(모든 프로젝트 공용) · 글꼴 최근(goditor_font_recent)과 같은 결.
 *   망가진 JSON · 막힌 저장소 → 빈 목록으로 읽고(지우지 않는다) 쓰기는 false 를 돌려준다(부른 쪽이 토스트).
 * 기본 4종(LABEL_BUILTIN_PRESETS)은 읽기 전용 — 사용자 프리셋은 select value 'user:<id>' 로 이름 충돌이 없다.
 * ⛔DOM 을 그리지 않는다(패널은 js/props/prop-label-group.js) — 그래서 tests/unit/label-presets.test.mjs 가 몸통을 그대로 돌린다. */

export const LABEL_BUILTIN_PRESETS = Object.freeze({
  Default: Object.freeze({ bg: '#111111', color: '#ffffff', border: 'none' }),
  Filled:  Object.freeze({ bg: '#333333', color: '#ffffff', border: 'none' }),
  Outline: Object.freeze({ bg: 'transparent', color: '#111111', border: '1.5px solid #111111' }),
  Ghost:   Object.freeze({ bg: 'rgba(0,0,0,0.06)', color: '#333333', border: 'none' }),
});
export const LABEL_PRESET_STORE_KEY = 'goditor_label_presets';
export const LABEL_USER_PREFIX = 'user:';
const STYLE_KEYS = ['bg', 'color', 'border', 'radius', 'padT', 'padB', 'shape', 'gap'];

function _cleanStyle(s) {
  if (!s || typeof s !== 'object') return null;
  const out = {};
  for (const k of STYLE_KEYS) if (typeof s[k] === 'string' && s[k].length <= 200) out[k] = s[k];
  return out.bg != null && out.color != null ? out : null;
}

/** 저장된 사용자 프리셋 [{id,name,style}] — 망가진 항목은 건너뛴다(저장소는 안 건드린다). */
export function listLabelUserPresets() {
  let raw;
  try { raw = JSON.parse(localStorage.getItem(LABEL_PRESET_STORE_KEY) || '[]'); } catch { return []; }
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const p of raw) {
    const style = _cleanStyle(p && p.style);
    if (style && typeof p.id === 'string' && p.id && typeof p.name === 'string' && p.name.trim()) out.push({ id: p.id, name: p.name, style });
  }
  return out;
}

function _write(list) {
  try { localStorage.setItem(LABEL_PRESET_STORE_KEY, JSON.stringify(list)); return true; } catch { return false; }
}

function _uniqueName(name, list, exceptId) {
  const base = String(name).trim().slice(0, 40);
  if (!base) return '';
  const taken = new Set(list.filter((p) => p.id !== exceptId).map((p) => p.name));
  if (!taken.has(base)) return base;
  for (let i = 2; ; i++) if (!taken.has(`${base} (${i})`)) return `${base} (${i})`;
}

/** 등록 — 성공하면 {id,name,style} · 이름 비었음/쓰기 실패면 null. 같은 이름은 « (2)» 를 붙인다. */
export function addLabelUserPreset(name, style) {
  const list = listLabelUserPresets();
  const n = _uniqueName(name, list);
  const s = _cleanStyle(style);
  if (!n || !s) return null;
  const p = { id: 'lp_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name: n, style: s };
  return _write([...list, p]) ? p : null;
}

/** 수정 — patch = { name?, style? } · 없는 id/쓰기 실패면 false. */
export function updateLabelUserPreset(id, patch = {}) {
  const list = listLabelUserPresets();
  const p = list.find((x) => x.id === id);
  if (!p) return false;
  if (patch.name != null) { const n = _uniqueName(patch.name, list, id); if (!n) return false; p.name = n; }
  if (patch.style != null) { const s = _cleanStyle(patch.style); if (!s) return false; p.style = s; }
  return _write(list);
}

export function removeLabelUserPreset(id) {
  const list = listLabelUserPresets();
  const next = list.filter((p) => p.id !== id);
  return next.length !== list.length && _write(next);
}

/** select value('Default' | 'user:<id>') → 꼴(없으면 null). */
export function resolveLabelPreset(value) {
  if (typeof value !== 'string') return null;
  if (value.startsWith(LABEL_USER_PREFIX)) return listLabelUserPresets().find((p) => LABEL_USER_PREFIX + p.id === value)?.style || null;
  return Object.prototype.hasOwnProperty.call(LABEL_BUILTIN_PRESETS, value) ? LABEL_BUILTIN_PRESETS[value] : null;
}

/** 태그 하나(+그 블럭)의 지금 꼴. */
export function readLabelStyle(item, block) {
  const st = item.style;
  return {
    bg: item.dataset.bg || st.backgroundColor || '#e8e8e8',
    color: item.dataset.color || st.color || '#333333',
    border: st.border || 'none',
    radius: String(item.dataset.radius ?? '40'),
    padT: st.paddingTop || '',
    padB: st.paddingBottom || '',
    shape: item.dataset.shape || block?.dataset.shape || 'pill',
    gap: block?.style.gap || '',
  };
}

/** 태그 하나에 꼴을 입힌다. 기본 4종은 bg·color·border 만 있어 그 셋만 바뀐다(옛 동작 그대로). */
export function applyLabelStyleToItem(item, s) {
  if (!item || !s) return;
  item.style.backgroundColor = s.bg;
  item.style.color = s.color;
  item.style.border = s.border ?? 'none';
  item.dataset.bg = s.bg;
  item.dataset.color = s.color;
  if (s.shape != null) {
    const circle = s.shape === 'circle';
    item.dataset.shape = s.shape;
    item.classList.toggle('label-circle', circle);
    if (circle) { item.style.borderRadius = '50%'; item.dataset.radius = '50%'; }
  }
  if (s.radius != null && item.dataset.shape !== 'circle') {
    const r = parseInt(s.radius, 10);
    const px = Number.isFinite(r) ? r : 40;
    item.style.borderRadius = px + 'px'; item.dataset.radius = String(px);
  }
  if (s.padT != null) item.style.paddingTop = s.padT;
  if (s.padB != null) item.style.paddingBottom = s.padB;
}

/** 블럭 단위 꼴(모양·간격) — 사용자 프리셋에만 있다. */
export function applyLabelStyleToBlock(block, s) {
  if (!block || !s) return;
  if (s.shape != null) block.dataset.shape = s.shape;
  if (s.gap != null) block.style.gap = s.gap;
}
