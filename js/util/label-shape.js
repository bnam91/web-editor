/* label-shape.js — 라벨(태그) «모양 변수» 한 벌 (B1 · 현빈 261114 «타원이나 커스텀 라벨 모양을 디자인 관리에 변수로 → 새 라벨마다 적용 → 우측 패널에 변수 사용 중»)
 *   ★값의 정본은 DesignSystem(좌측 «Design System» 패널 · js/design-system.js labelShapes — 컬러 변수와 같은 저장·동기화)이다. 여기는 «꼴»만:
 *     · normalizeLabelShape — 받은 값을 허용한 꼴로(종류 5 · 색 · 반경)
 *     · shapeStyle — 그 모양의 실제 CSS 값 · refStyle — :root 변수 참조(var(--lshape-<이름>-…, 지금 값)) ⇒ 변수를 고치면 쓰는 라벨이 따라 바뀐다
 *       대체값(쉼표 뒤)을 지금 값으로 두는 까닭: HTML 내보내기·변수 없는 환경에서도 같은 꼴(컬러 변수 칩과 같은 규약)
 *     · bindLabelItem / unbindLabelItem — 칸(.label-item)에 참조를 걸고·끊는다(끊으면 지금 값을 그대로 박는다)
 *   ★모양은 원본 도형만(반경·clip-path 다각형) — 사용자 SVG 모양은 2단계(지디 동의 261114).
 *   ⛔이름은 CSS 변수 이름이 되므로 [A-Za-z0-9_-] 1~32 만 받는다.
 */

export const LABEL_SHAPE_KINDS = ['round', 'pill', 'ellipse', 'tag', 'ribbon'];
export const LABEL_SHAPE_KIND_LABEL = { round: '둥근 네모', pill: '알약', ellipse: '타원', tag: '태그', ribbon: '리본' };
const CLIP = {
  tag: 'polygon(14% 0, 100% 0, 100% 100%, 14% 100%, 0 50%)',
  ribbon: 'polygon(0 0, 100% 0, 92% 50%, 100% 100%, 0 100%, 8% 50%)',
};
const COLOR_RE = /^(#[0-9a-fA-F]{3,8}|rgba?\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*(,\s*[\d.]+\s*)?\)|transparent)$/;
const PROPS = ['bg', 'color', 'radius', 'clip', 'border'];

export function isLabelShapeName(name) { return typeof name === 'string' && /^[A-Za-z0-9_-]{1,32}$/.test(name); }

/** @returns {{kind, radius:number, bg:string, color:string, border:string}} */
export function normalizeLabelShape(spec = {}) {
  const s = spec && typeof spec === 'object' ? spec : {};
  const r = Number(s.radius);
  const bc = typeof s.borderColor === 'string' && COLOR_RE.test(s.borderColor.trim()) ? s.borderColor.trim() : '';
  const bw = Number(s.borderWidth);
  return {
    kind: LABEL_SHAPE_KINDS.includes(s.kind) ? s.kind : 'pill',
    radius: Number.isFinite(r) ? Math.max(0, Math.min(60, r)) : 8,
    bg: typeof s.bg === 'string' && COLOR_RE.test(s.bg.trim()) ? s.bg.trim() : '#111111',
    color: typeof s.color === 'string' && COLOR_RE.test(s.color.trim()) ? s.color.trim() : '#ffffff',
    borderColor: bc,
    borderWidth: bc && Number.isFinite(bw) ? Math.max(0, Math.min(6, bw)) : 0,
  };
}

/** 그 모양의 실제 CSS 값(속성 키 = PROPS). */
export function shapeStyle(spec) {
  const s = normalizeLabelShape(spec);
  const radius = s.kind === 'pill' ? '999px' : s.kind === 'ellipse' ? '50%' : s.kind === 'round' ? `${s.radius}px` : '0';
  return {
    bg: s.bg, color: s.color, radius,
    clip: CLIP[s.kind] || 'none',
    border: s.borderWidth > 0 ? `${s.borderWidth}px solid ${s.borderColor}` : 'none',
  };
}

export function labelShapeVar(name, prop) { return `--lshape-${name}-${prop}`; }

/** :root 에 쓸 변수 선언들 [[변수, 값]…] */
export function labelShapeVarDecls(name, spec) {
  if (!isLabelShapeName(name)) return [];
  const st = shapeStyle(spec);
  return PROPS.map((p) => [labelShapeVar(name, p), st[p]]);
}

/** 칸 스타일 = 변수 참조(대체값 = 지금 값). */
export function refStyle(name, spec) {
  const st = shapeStyle(spec);
  const r = (p) => `var(${labelShapeVar(name, p)}, ${st[p]})`;
  return { backgroundColor: r('bg'), color: r('color'), borderRadius: r('radius'), clipPath: r('clip'), border: r('border') };
}

/** 칸에 모양 변수를 건다 — data-label-shape + 참조 스타일 · dataset.bg/color/radius 는 지금 값(옛 코드가 읽는 자리 — «＋» 복제 등). */
export function bindLabelItem(item, name, spec) {
  if (!item || !isLabelShapeName(name)) return false;
  const st = shapeStyle(spec);
  const ref = refStyle(name, spec);
  Object.assign(item.style, ref);
  item.dataset.labelShape = name;
  item.dataset.bg = st.bg; item.dataset.color = st.color;
  item.dataset.radius = st.radius.endsWith('px') ? String(parseFloat(st.radius)) : st.radius;
  return true;
}

/** 끊기 — 지금 모양 값을 그대로 박고 참조를 뗀다(겉모양 무변). */
export function unbindLabelItem(item, spec) {
  if (!item) return;
  const st = shapeStyle(spec);
  item.style.backgroundColor = st.bg; item.style.color = st.color; item.style.borderRadius = st.radius;
  item.style.clipPath = st.clip === 'none' ? '' : st.clip; item.style.border = st.border === 'none' ? '' : st.border;
  delete item.dataset.labelShape;
}

if (typeof window !== 'undefined') {
  window.LabelShape = { LABEL_SHAPE_KINDS, LABEL_SHAPE_KIND_LABEL, isLabelShapeName, normalizeLabelShape, shapeStyle, labelShapeVar, labelShapeVarDecls, refStyle, bindLabelItem, unbindLabelItem };
}
