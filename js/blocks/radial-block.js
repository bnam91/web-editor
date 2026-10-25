/* radial-block.js — 방사형 에셋 블럭 (프로토 · 1012t1 → 1013t2A3 V4 반원 · 2026-10-14).
 * 가운데 하나 + 둘레에 칸 N개를 원(또는 정다각형 꼭짓점)에 등분으로 놓는 블럭.
 * 모델 = dataset 이 진실(인용구 블럭과 같은 규율) — render 가 innerHTML 을 통째로 새로 만든다. 블럭 DOM 에 인라인으로 박지 마라.
 * 좌표·연결선은 전부 RADIAL_GEOM(js/radial-geom.js), 칸 그림은 RADIAL_SAMPLES 의 «키»만 저장한다(파일창·업로드 없음).
 * 호 모드(shape = arc): 시작~끝 각도 사이에 항목을 같은 간격으로 놓고(V4: 끝점을 피해 칸 가운데), 원 중심을 블럭 폭 대비 %로 밀 수 있다(음수 = 왼쪽 바깥).
 *   V4 반원(현빈 「반원 끝점이 왼쪽에 붙어야 … 반원이 되도록」): 호 모드의 «기본 꼴 = 반원»이다 — 시작 −90° · 끝 90° · 원 중심 X 0%(블럭 왼쪽 변) · 선 연장 0
 *   ⇒ 끝점 둘이 왼쪽 변에 서고 지름(2R)이 세로로 선다. 기본 모습은 «점 + 글»뿐이다(그림 칸 · 아이콘 · 가운데 없음 — RADIAL_ARC_PRESET · RADIAL_ARC_DEFAULT_ITEMS).
 *   V3 의 «상자에 담기»는 남기되 반원 기본을 건드리지 못하게 했다: 가로 여유를 왼쪽 0 으로 넘기고(끝점이 왼쪽 변에 선 것은 넘침이 아니다) 호 선을 끝이 잘린 선(butt)으로 그린다
 *   ⇒ 반원 기본에서 원 중심 밀기 0 · 반지름 줄이기 0. 옆 라벨이 오른쪽 변을 넘으면 반지름보다 «라벨 폭»을 먼저 죈다(바닥 = 라벨 폭 설정의 절반) — 그래도 안 되면 그때 V3 처럼 반지름을 줄인다.
 *   패널에서 각도 · 원 중심 X · 선 연장을 바꾸는 길은 그대로다 — 바꾼 값이 블럭 밖으로 나가면 V3 처럼 들어올 만큼만 민다.
 *   V3: 호 모드는 «자르지 않는다» — 그려지는 것 전부(호 선 + 선 연장 + 선 두께 · 양 끝 항목 · 라벨 · 가운데)의 상자를
 *   RADIAL_ARC_GEOM(js/radial-arc-geom.js · 순수 함수)이 계산하고, 스테이지 높이 · 원 중심 자리 · (폭이 모자라면) 반지름을 그 상자에 맞춘다.
 *   원 중심 X 는 «바라는 자리»다 — 상자가 블럭 밖으로 나가면 들어올 만큼만 민다. 라벨은 화면에 붙은 뒤 실제 크기를 재서 한 번 더 맞춘다.
 *   온 원 · 다각형 모드의 식은 V2 그대로다.
 *   폭 관찰(V3 고침): 호 모드 블럭은 «폭»이 바뀌면 다시 맞춘다(ResizeObserver 하나 · 같은 폭이면 건너뜀 — 높이는 우리가 바꾸므로 안 본다).
 *   관찰 상태는 요소 속성(_rdlW)과 모듈 안에만 있다 — dataset · 저장본 · 히스토리에 안 실린다. 온 원 · 다각형은 관찰하지 않는다.
 * 캔버스 끌기(V2): 블럭이 선택되고 그 항목이 이미 골라진 상태에서 항목을 끌면 원 중심 기준 각도로 미끄러진다(반지름 그대로) → items[i].deg.
 *   라벨을 Alt+끌기 하거나 라벨 옆 손잡이(고른 항목 라벨의 CSS 가상요소)를 끌면 라벨만 움직인다 → items[i].labelDx / labelDy.
 *   끄는 동안은 그 항목의 style 좌표만 고치고(통째 재렌더 없음 · 문서에 건 mousemove/mouseup), 놓을 때 dataset 에 쓰고 재렌더 → pushHistory 한 번.
 *   개별 값이 없는 항목은 자동 배치 그대로다(섞여도 된다).
 * 항목 아이콘은 샘플 키(items[i].img) 또는 붙여넣은 SVG(items[i].svg) — SVG 는 GRAPH_SHAPE.sanitizeShapeSvg(허용 목록 소독)를 지난 것만 그린다(그릴 때도 다시 지난다).
 * 항목 글은 «표기 원문»을 저장한다 — 줄바꿈 + 별표 둘로 감싼 굵게. 그릴 때 escHtml 을 먼저 하고 그 뒤에 b · br 두 태그만 만든다(주입 길 없음).
 * 유닛 계약: add 함수의 선언 꼴을 주석에 글자로 적지 않는다 · .row 는 한 번만 만들고 genId('row') · dataset.type 은 'radial' 하나 · add 몸통에 타이머 없음. */
import { insertAfterSelected, genId, showNoSelectionHint, mdlReadText } from '../drag-utils.js';
import { bindBlock } from '../drag-drop.js';
import { escHtml } from '../props/_helpers.js';
import '../radial-geom.js';
import '../radial-samples.js';
import '../radial-arc-geom.js';

/* t4-03(2026-10-21 · 현빈 «Data로 디폴트로 들어가있는거 플레이스 홀더로, 내용을 입력하세요로 해줘»):
 *   새 블럭 항목 글은 저장값 '' — 비어 있으면 그릴 때 안내문구(RADIAL_LABEL_PH)를 흐리게 그린다(가운데 글 · 인용구 블럭과 같은 표식).
 *   ⚠️기본값만 바뀐다 — 이미 저장된 블럭의 글은 dataset 이 진실이라 그대로다. */
const RADIAL_DEFAULT_ITEMS = Object.freeze([
  { label: '', img: '' },
  { label: '', img: '' },
  { label: '', img: '' },
  { label: '', img: '' },
  { label: '', img: '' },
  { label: '', img: '' },
]);

/* t4-02 · t4-04 앞(2026-10-21 · 현빈 원문 «선 색 … 점색과 통일» · «핵심효능 6가지 텍스트도 바꿔줘 · 6B4DE0 배경색도 없애줘»):
 *   선 색은 점 색과 «한 자리»에서 온다(RADIAL_DOT_COLOR) — 둘이 다시 갈리지 않게 파생한다.
 *   가운데 글은 저장값 '' + 안내문구(인용구 블럭 규약 · data-is-placeholder) · 가운데 배경 투명 · 글자 색 = 라벨 색(RADIAL_TEXT_COLOR).
 *   ⚠️기본값만 바뀐다 — 이미 저장된 블럭은 dataset 이 진실이라 그대로다(옮기기 0). */
const RADIAL_DOT_COLOR = '#c9cdd6';   /* ★t4-02 (261025) — ★현빈 ★요청값. ★전엔 ★끝에서 둘째 자리가 ★8 이었다(1자 차이) · ★잠그는 자 = tests/dom/t4-02-radial-dot-color */
const RADIAL_TEXT_COLOR = '#222222';
const RADIAL_CENTER_PH = '내용을 입력하세요';   /* 가운데 글 안내문구 — 비면 이것을 흐리게 그린다(저장 안 함 · quote-block QUOTE_DEFAULTS.ph 와 같은 말) */
const RADIAL_LABEL_PH = RADIAL_CENTER_PH;       /* t4-03 항목 글 안내문구 — 같은 말 한 자리 */

const RADIAL_DEFAULTS = Object.freeze({
  shape: 'circle', count: 6, radius: 250, startDeg: -90,
  line: 'orbit', lineColor: RADIAL_DOT_COLOR, lineStyle: 'dashed', lineWidth: 2, bg: '',
  cellSize: 120, cellShape: 'circle', cellRadius: 24, cellFill: '#e8e8e8',   /* ★t4-06(현빈 「에셋의 크기는 기본 추가될 때 120으로」) — 160 → 120 · 저장된 블럭은 제 dataset 값 그대로 */
  centerMode: 'text', centerSize: 220, centerImg: '', centerClip: 'circle',
  centerText: '', centerBg: 'transparent', centerColor: RADIAL_TEXT_COLOR,
  labelPos: 'below', labelSize: 16, labelColor: RADIAL_TEXT_COLOR, labelGap: 10,
  labelWidth: 96, labelWeight: 'bold',
  endDeg: 60, centerX: 50, lineExtend: 0, centerDx: 0,
  marker: 'cell', dotSize: 18, dotColor: RADIAL_DOT_COLOR, iconSize: 36,
  padX: 0,   /* ★t4-07 좌우 패딩 — 0 = 옛 블럭 그대로(새 블럭에도 키를 안 쓴다 · makeRadialBlock 무접촉) */
});
/* 호 모드의 기본 꼴(V4) = 반원 · 점 + 글. 새 호 블럭의 기본값이고, 패널에서 호로 처음 바꿀 때 쓰는 값이다.
 *   꼴(각도 · 원 중심 · 선 연장)의 수는 RADIAL_ARC_GEOM.HALF 한 자리에서 온다. */
const RADIAL_ARC_PRESET = Object.freeze({
  ...window.RADIAL_ARC_GEOM.HALF,
  marker: 'dot', labelPos: 'outside', centerMode: 'none', lineStyle: 'solid',
  labelSize: 20, labelGap: 20, labelWidth: 240,
});
/* 모양(원 ↔ 호)을 오갈 때 따로 기억하는 «모습» 키 — 호의 점 + 글 모습이 원으로 돌아갈 때 따라가지 않게(패널이 쓴다). */
const RADIAL_LOOK_KEYS = Object.freeze(['marker', 'labelPos', 'centerMode', 'lineStyle', 'labelSize', 'labelGap', 'labelWidth']);
/* 새 호 블럭의 항목 — 글만(그림 키 없음). */
const RADIAL_ARC_DEFAULT_ITEMS = Object.freeze(RADIAL_DEFAULT_ITEMS.slice(0, 3).map((it) => Object.freeze({ label: it.label, img: '' })));

const RADIAL_LIMITS = Object.freeze({
  radius: { min: 80, max: 800 },
  startDeg: { min: -180, max: 180 },
  lineWidth: { min: 0.5, max: 6, step: 0.5 },
  cellSize: { min: 40, max: 320 },
  cellRadius: { min: 0, max: 80 },
  centerSize: { min: 80, max: 900 },
  labelSize: { min: 10, max: 64 },
  labelGap: { min: 0, max: 60 },
  labelWidth: { min: 60, max: 480 },
  endDeg: { min: -180, max: 360 },
  centerX: { min: -100, max: 150 },
  lineExtend: { min: 0, max: 90 },
  centerDx: { min: -600, max: 600 },
  dotSize: { min: 4, max: 60 },
  iconSize: { min: 16, max: 96 },
  labelDx: { min: -600, max: 600 },
  labelDy: { min: -600, max: 600 },
  padX: { min: 0, max: 120, step: 4 },   /* ★t4-07 — 그래프 「좌우 패딩」(prop-graph.js #grb-padx 0~80 step 4)과 같은 말 · 넓은 섹션 몫으로 120 */
});
const RADIAL_ICON_SVG_MAX = 20000;   // 붙여넣는 항목 아이콘 SVG 의 글자 수 상한(소독 뒤)
const RADIAL_SHAPES = Object.freeze(['circle', 'poly', 'arc']);
const RADIAL_ARC_COUNT = Object.freeze({ min: 2, max: 10 });

const RADIAL_LINES = Object.freeze(['none', 'orbit', 'outline', 'spoke']);
const RADIAL_LABEL_POS = Object.freeze(['outside', 'below', 'inside', 'none']);
const RADIAL_CENTER_MODES = Object.freeze(['none', 'image', 'text']);

const _RDL_COLOR_RE = /^(#[0-9a-fA-F]{3,8}|transparent)$|^(rgb|rgba|hsl|hsla)\(\s*[\d.,\s%/]+\)$/;
const _color = (v, def) => (typeof v === 'string' && _RDL_COLOR_RE.test(v.trim())) ? v.trim() : def;
const _oneOf = (v, list, def) => (list.includes(v) ? v : def);
/** 보이지 않는 색인가 — transparent · 알파 0 의 #rgba/#rrggbbaa · rgba/hsla(…, 0). */
function _isClearColor(c) {
  const v = String(c || '').trim().toLowerCase();
  if (v === '' || v === 'transparent') return true;
  if (/^#[0-9a-f]{4}$/.test(v)) return v[4] === '0';
  if (/^#[0-9a-f]{8}$/.test(v)) return v.slice(7) === '00';
  const m = v.match(/^(?:rgba|hsla)\(([^)]*)\)$/);
  if (!m) return false;
  const parts = m[1].split(/[\s,/]+/).filter(Boolean);
  return parts.length === 4 && parseFloat(parts[3]) === 0;
}
const _shapeOf = (v) => _oneOf(v, RADIAL_SHAPES, 'circle');
/** 항목 수 한도 — 원 3~10 · 다각형 3~8 · 호 2~10. */
function radialCountLimits(shape) {
  const GL = window.RADIAL_GEOM.LIMITS;
  if (shape === 'arc') return { min: RADIAL_ARC_COUNT.min, max: RADIAL_ARC_COUNT.max };
  if (shape === 'poly') return { min: GL.POLY_MIN, max: GL.POLY_MAX };
  return { min: GL.COUNT_MIN, max: GL.COUNT_MAX };
}
function _clampCount(shape, n, def) {
  const G = window.RADIAL_GEOM;
  if (shape === 'arc') return Math.round(G.clamp(n, RADIAL_ARC_COUNT.min, RADIAL_ARC_COUNT.max, Math.min(RADIAL_ARC_COUNT.max, Math.max(RADIAL_ARC_COUNT.min, Number(def) || 3))));
  return G.clampCount(shape, n, def);
}
/** 호 위의 등분 각도 — 끝점을 피해 칸 가운데(식은 RADIAL_ARC_GEOM). 끝점에 선 항목은 블럭 변 밖으로 반쯤 나간다 ⇒ 자동 배치는 끝점에 안 세운다(손으로 끌면 설 수 있다). */
const _arcAngles = (n, startDeg, endDeg) => window.RADIAL_ARC_GEOM.arcAnglesInset(n, startDeg, endDeg);
const _r2 = (v) => Math.round(v * 100) / 100;
const _polar = (cx, cy, R, deg) => { const a = deg * Math.PI / 180; return { x: _r2(cx + R * Math.cos(a)), y: _r2(cy + R * Math.sin(a)), deg: _r2(deg) }; };
/** 호 path — from~to 각도 구간만. 한 바퀴 이상이면 온 원(식은 RADIAL_ARC_GEOM). */
const _arcPath = (cx, cy, R, fromDeg, toDeg) => window.RADIAL_ARC_GEOM.arcPath(cx, cy, R, fromDeg, toDeg);
/** 각도 정규화 — −180 초과 ~ 180 이하, 소수 1자리. */
function radialNormDeg(v) {
  let d = Number(v);
  if (!Number.isFinite(d)) return 0;
  d = ((d + 180) % 360 + 360) % 360 - 180;
  if (d === -180) d = 180;
  return Math.round(d * 10) / 10;
}

/* 가운데 전용 그림 표 — 동결된 RADIAL_SAMPLES 에 없는 «제품 사진 대신 쓸 그림»을 여기 둔다(배경 투명 · id·외부 참조 없음). */
const RADIAL_CENTER_PICS = Object.freeze({
  fan: Object.freeze({
    label: '휴대용 선풍기',
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 330" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" aria-hidden="true" data-radial-center="fan">'
      + '<ellipse cx="100" cy="316" rx="56" ry="9" fill="#1f2937" opacity="0.10"/>'
      + '<rect x="80" y="168" width="40" height="140" rx="18" fill="#f7f8fa" stroke="#cfd5de" stroke-width="2"/>'
      + '<rect x="86" y="174" width="10" height="128" rx="5" fill="#ffffff" opacity="0.9"/>'
      + '<circle cx="100" cy="226" r="9" fill="#e3e7ee" stroke="#c3cad5" stroke-width="1.5"/>'
      + '<rect x="94" y="250" width="12" height="4" rx="2" fill="#c3cad5"/><rect x="94" y="259" width="12" height="4" rx="2" fill="#dfe4ec"/><rect x="94" y="268" width="12" height="4" rx="2" fill="#dfe4ec"/>'
      + '<circle cx="100" cy="96" r="90" fill="#f7f8fa" stroke="#cfd5de" stroke-width="2.5"/>'
      + '<circle cx="100" cy="96" r="79" fill="#e9edf3"/>'
      + [0, 72, 144, 216, 288].map((a) => `<path transform="rotate(${a} 100 96)" fill="#c5ccd8" d="M100 96 C118 78 132 54 120 26 C98 30 84 60 100 96 Z"/>`).join('')
      + '<g fill="none" stroke="#b4bcc9" stroke-width="1.6"><circle cx="100" cy="96" r="64"/><circle cx="100" cy="96" r="46"/>'
      + '<path d="M100 17 V175 M21 96 H179 M44.1 40.1 L155.9 151.9 M155.9 40.1 L44.1 151.9"/></g>'
      + '<circle cx="100" cy="96" r="20" fill="#ffffff" stroke="#b4bcc9" stroke-width="2"/><circle cx="100" cy="96" r="7" fill="#d5dbe5"/>'
      + '</svg>',
  }),
});
/** 가운데에 쓸 수 있는 그림 키 전부 — 샘플 8종 + 가운데 전용. */
function radialCenterKeys() { return [...window.RADIAL_SAMPLES.KEYS, ...Object.keys(RADIAL_CENTER_PICS)]; }
const _hasCenterPic = (k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(RADIAL_CENTER_PICS, k);
function radialCenterSvg(key) { return _hasCenterPic(key) ? RADIAL_CENTER_PICS[key].svg : window.RADIAL_SAMPLES.svg(key); }
function radialCenterLabel(key) { return _hasCenterPic(key) ? RADIAL_CENTER_PICS[key].label : window.RADIAL_SAMPLES.label(key); }

/** 붙여넣은 SVG 소독 — 그래프 「SVG 모양」의 허용 목록 소독을 그대로 쓴다(script · on* · 외부 참조 · foreignObject · style 이 걸러진다).
 *  → { ok, svg } | { ok:false, code }. 길이 한도 RADIAL_ICON_SVG_MAX. */
function radialSanitizeSvg(text) {
  const fn = window.GRAPH_SHAPE?.sanitizeShapeSvg;
  if (typeof fn !== 'function') return { ok: false, code: 'NO_SANITIZER' };
  if (typeof text !== 'string' || text.length > RADIAL_ICON_SVG_MAX * 4) return { ok: false, code: 'TOO_LARGE' };
  const r = fn(text);
  if (!r || !r.ok) return { ok: false, code: (r && r.code) || 'NOT_SVG' };
  const svg = r.svg.replace(/\spreserveAspectRatio="[^"]*"/, '').replace(/^<svg/, '<svg preserveAspectRatio="xMidYMid meet" data-rdl-custom="1"');
  if (svg.length > RADIAL_ICON_SVG_MAX) return { ok: false, code: 'TOO_LARGE' };
  return { ok: true, svg };
}
const _svgCache = new Map();
/** 저장돼 있던 SVG 글자를 그리기 직전에 한 번 더 소독한다(저장본을 손으로 고친 경우까지 막는다). 못 지나면 ''. */
function _safeSvg(text) {
  if (typeof text !== 'string' || !text) return '';
  if (_svgCache.has(text)) return _svgCache.get(text);
  const r = radialSanitizeSvg(text);
  const out = r.ok ? r.svg : '';
  if (_svgCache.size > 200) _svgCache.clear();
  _svgCache.set(text, out);
  return out;
}

const _FALLBACK_W = 860;   // 아직 문서에 안 붙은 블럭의 폭(캔버스 기본)

/** items JSON 읽기 — 깨졌거나 배열이 아니면 []. 항목은 {label, img} 에 개별 값(deg · labelDx · labelDy · svg)이 있을 때만 그 키를 단다. */
function radialItemsOf(block) {
  let arr = [];
  try { arr = JSON.parse(block?.dataset?.items || '[]'); } catch (_) { arr = []; }
  if (!Array.isArray(arr)) arr = [];
  const S = window.RADIAL_SAMPLES, L = RADIAL_LIMITS;
  const fin = (v) => typeof v === 'number' && Number.isFinite(v);
  return arr.map((it) => {
    const o = {
      label: (it && typeof it.label === 'string') ? it.label : '',
      img: (it && S?.has(it.img)) ? it.img : '',
    };
    if (it && fin(it.deg)) o.deg = radialNormDeg(it.deg);
    if (it && fin(it.labelDx) && it.labelDx !== 0) o.labelDx = Math.round(Math.min(L.labelDx.max, Math.max(L.labelDx.min, it.labelDx)));
    if (it && fin(it.labelDy) && it.labelDy !== 0) o.labelDy = Math.round(Math.min(L.labelDy.max, Math.max(L.labelDy.min, it.labelDy)));
    if (it && typeof it.svg === 'string' && it.svg && it.svg.length <= RADIAL_ICON_SVG_MAX) o.svg = it.svg;
    return o;
  });
}
/** 항목에 개별 배치 값(각도 · 라벨 간격)이 있나. */
const radialItemIsManual = (it) => !!it && (it.deg !== undefined || it.labelDx !== undefined || it.labelDy !== undefined);
/** 개별 배치 값 지우기 — idx 가 정수면 그 항목만, 아니면 전부. 바뀐 게 있으면 true. 그리지는 않는다. */
function radialResetPlacement(block, idx) {
  const items = radialItemsOf(block);
  let changed = false;
  items.forEach((it, i) => {
    if (Number.isInteger(idx) && i !== idx) return;
    if (radialItemIsManual(it)) changed = true;
    delete it.deg; delete it.labelDx; delete it.labelDy;
  });
  if (changed) block.dataset.items = JSON.stringify(items);
  return changed;
}

/** items 를 n 개로 맞춘다(모자라면 빈 글 칸을 붙이고 — 그릴 때 안내문구(t4-03) — 남으면 끝에서 자른다). */
function _fitItems(items, n) {
  const out = items.slice(0, n);
  while (out.length < n) out.push({ label: '', img: '' });
  return out;
}

/** dataset → 죈 상태 한 벌. 렌더와 패널이 같은 값을 읽는다. */
function radialStateOf(block) {
  const G = window.RADIAL_GEOM, D = RADIAL_DEFAULTS, L = RADIAL_LIMITS, d = block.dataset;
  const num = (key) => G.clamp(d[key], L[key].min, L[key].max, D[key]);
  const shape = _shapeOf(d.shape);
  const count = _clampCount(shape, d.count, D.count);
  return {
    bg: _color(d.bg, ''), centerClip: d.centerClip === 'none' ? 'none' : 'circle',
    endDeg: num('endDeg'), centerX: num('centerX'), lineExtend: num('lineExtend'), centerDx: num('centerDx'),
    marker: d.marker === 'dot' ? 'dot' : 'cell',
    dotSize: num('dotSize'), dotColor: _color(d.dotColor, D.dotColor), iconSize: num('iconSize'),
    labelWidth: num('labelWidth'), labelWeight: d.labelWeight === 'normal' ? 'normal' : 'bold',
    shape, count,
    radius: num('radius'), startDeg: num('startDeg'), padX: num('padX'),
    line: _oneOf(d.line, RADIAL_LINES, D.line),
    lineColor: _color(d.lineColor, D.lineColor),
    lineStyle: d.lineStyle === 'solid' ? 'solid' : 'dashed',
    lineWidth: num('lineWidth'),
    cellSize: num('cellSize'),
    cellShape: d.cellShape === 'round' ? 'round' : 'circle',
    cellRadius: num('cellRadius'),
    cellFill: _color(d.cellFill, D.cellFill),
    centerMode: _oneOf(d.centerMode, RADIAL_CENTER_MODES, D.centerMode),
    centerSize: num('centerSize'),
    centerImg: (window.RADIAL_SAMPLES.has(d.centerImg) || _hasCenterPic(d.centerImg)) ? d.centerImg : D.centerImg,
    centerText: typeof d.centerText === 'string' ? d.centerText : D.centerText,
    centerBg: _color(d.centerBg, D.centerBg),
    centerColor: _color(d.centerColor, D.centerColor),
    labelPos: _oneOf(d.labelPos, RADIAL_LABEL_POS, D.labelPos),
    labelSize: num('labelSize'),
    labelColor: _color(d.labelColor, D.labelColor),
    labelGap: num('labelGap'),
    items: _fitItems(radialItemsOf(block), count),
  };
}

/** 항목 수 바꾸기 — count 와 items 길이를 같이 맞춘다(다각형이면 3~8 로 죈다). 그리지는 않는다. */
function radialSetCount(block, n) {
  const shape = _shapeOf(block.dataset.shape);
  const count = _clampCount(shape, n, RADIAL_DEFAULTS.count);
  block.dataset.count = String(count);
  block.dataset.items = JSON.stringify(_fitItems(radialItemsOf(block), count));
  return count;
}

/** 항목마다의 각도 — 개별 각도(items[i].deg)가 있으면 그것, 없으면 자동(원·다각형 = 등분 · 호 = 시작~끝 사이 같은 간격). */
function radialAutoDegs(st) {
  return st.shape === 'arc' ? _arcAngles(st.count, st.startDeg, st.endDeg) : window.RADIAL_GEOM.angles(st.count, st.startDeg);
}
function radialDegsOf(st) {
  return radialAutoDegs(st).map((a, i) => (st.items[i] && st.items[i].deg !== undefined ? st.items[i].deg : a));
}
const _markerSize = (st) => (st.marker === 'dot' ? st.dotSize : st.cellSize);

const RADIAL_ARC_PAD = 16;        // 호 모드 — 내용 상자 둘레의 여유(위 · 아래 · 오른쪽)
const RADIAL_ARC_PAD_LEFT = 0;    // 호 모드 — 왼쪽 여유. 0 이어야 반원의 끝점이 블럭 왼쪽 변에 선다(원 중심 X 0% 를 밀지 않는다)
const RADIAL_ARC_LINECAP = 'butt'; // 호 모드의 선 끝 — 끝점에서 멎는다(둥근 끝은 두께 반만큼 끝점을 넘어 왼쪽 변 밖으로 나간다)
const RADIAL_DOT_HALO = 5;        // 점 마커 둘레의 옅은 고리(css .rdl-cell--dot 의 box-shadow 두께와 같은 값)
const RADIAL_LABEL_ICON_GAP = 10; // 라벨 아이콘 아래 간격(css .rdl-label-ico 의 margin-bottom 과 같은 값)
const _belowLabelW = (m) => Math.max(m + 40, 120);

/** 호 모드 — 옆(바깥) 라벨마다의 최대 폭: 라벨 폭 설정과 «오른쪽 변까지 남는 폭» 가운데 작은 쪽.
 *  바닥 = 라벨 폭 설정의 절반(라벨 폭 칸의 최소보다 작아지지는 않는다) — 라벨이 절반까지 양보하고, 그래도 넘치면 그 다음은 반지름이 양보한다(fit).
 *  f = 라벨 없이 맞춘 자리({R, cx}). 옆 라벨이 아니면 null. */
function radialArcLabelMaxW(st, degs, f, avail) {
  if (st.labelPos !== 'outside') return null;
  const half = _markerSize(st) / 2, floor = Math.max(RADIAL_LIMITS.labelWidth.min, Math.round(st.labelWidth / 2));
  return degs.map((d, i) => {
    const x0 = f.cx + f.R * Math.cos(d * Math.PI / 180) + half + st.labelGap + ((st.items[i] && st.items[i].labelDx) || 0);
    return Math.floor(Math.min(st.labelWidth, Math.max(floor, avail - RADIAL_ARC_PAD - x0)));
  });
}

/** 호 모드 — 항목마다의 라벨 사각형(«항목 중심» 기준). sizes[i] = 화면에서 잰 {w,h}; 없으면 글에서 어림한다. 라벨이 칸 밖에 안 서면 null.
 *  maxWs[i] = 옆 라벨의 최대 폭(없으면 라벨 폭 설정). */
function radialArcLabelRects(st, sizes, maxWs) {
  const A = window.RADIAL_ARC_GEOM;
  const half = _markerSize(st) / 2, m = half * 2;
  const side = st.labelPos === 'outside', below = st.labelPos === 'below';
  return st.items.map((it, i) => {
    if (!side && !below) return null;
    const maxW = side ? ((maxWs && maxWs[i] > 0) ? maxWs[i] : st.labelWidth) : _belowLabelW(m);
    const hasIcon = st.marker === 'dot' && !!(it.svg || it.img);
    const got = sizes && sizes[i];
    const sz = (got && got.w > 0 && got.h > 0) ? got : A.labelEstimate({
      text: _labelIsEmpty(it.label) ? RADIAL_LABEL_PH : it.label, fontSize: st.labelSize, lineHeight: side ? 1.45 : 1.3, maxWidth: maxW,
      iconSize: hasIcon ? st.iconSize : 0, iconGap: RADIAL_LABEL_ICON_GAP,
    });
    const dx = it.labelDx || 0, dy = it.labelDy || 0;
    if (side) return { x0: half + st.labelGap + dx, x1: half + st.labelGap + dx + sz.w, y0: dy - sz.h / 2, y1: dy + sz.h / 2 };
    return { x0: dx - maxW / 2, x1: dx + maxW / 2, y0: half + st.labelGap + dy, y1: half + st.labelGap + dy + sz.h };
  });
}

/** 호 모드 — 기하에 넘기는 «그려지는 것» 한 벌(각도 · 선 구간 · 마커 · 라벨 · 가운데). */
function radialArcSpec(st, sizes, maxWs) {
  const degs = radialDegsOf(st);
  const rng = window.RADIAL_ARC_GEOM.lineRange(st.startDeg, st.endDeg, degs, st.lineExtend);
  const s = st.centerSize;
  return {
    degs, line: st.line, lineLo: rng.lo, lineHi: rng.hi, lineWidth: st.lineWidth, lineCap: RADIAL_ARC_LINECAP,
    markerHalf: _markerSize(st) / 2, halo: st.marker === 'dot' ? RADIAL_DOT_HALO : 0,
    labels: radialArcLabelRects(st, sizes, maxWs),
    center: st.centerMode === 'none' ? null : { x0: st.centerDx - s / 2, x1: st.centerDx + s / 2, y0: -s / 2, y1: s / 2 },
  };
}

/** 스테이지 치수와 점 좌표 — 원·다각형은 반지름을 블럭 폭 안으로 한 번 더 죈다(V2 그대로).
 *  호는 내용 상자가 스테이지 안에 들게 높이 · 원 중심 · 반지름을 맞춘다(자르지 않는다). labelSizes = 화면에서 잰 라벨 크기(없으면 어림). */
function radialLayoutOf(block, st, labelSizes) {
  const G = window.RADIAL_GEOM;
  /* ★t4-07 — «쓸 수 있는 폭» = 블럭 안쪽(clientWidth 는 좌우 padding 을 품는다 ⇒ 그만큼 뺀다). padX 0 이면 옛 식 그대로. */
  const avail = block.clientWidth > 0 ? Math.max(1, block.clientWidth - 2 * (st.padX || 0)) : _FALLBACK_W;
  const m = _markerSize(st), half = m / 2;
  const out = st.labelPos === 'outside', below = st.labelPos === 'below';
  if (st.shape === 'arc') {
    const wantCx = avail * st.centerX / 100;
    // ① 라벨 없이(호 선 · 항목 · 가운데) 먼저 맞춘다 → 그 자리에서 옆 라벨마다 «오른쪽 변까지 남는 폭»으로 라벨 폭을 죈다(반지름보다 라벨이 먼저 양보한다).
    const bare = { ...radialArcSpec(st), labels: null };
    const f0 = window.RADIAL_ARC_GEOM.fit(bare, { radius: st.radius, width: avail, pad: RADIAL_ARC_PAD, padL: RADIAL_ARC_PAD_LEFT, wantCx, minRadius: RADIAL_LIMITS.radius.min });
    const labelMaxW = radialArcLabelMaxW(st, bare.degs, f0, avail);
    // ② 라벨까지 넣어 맞춘다. 줄일 때의 바닥 = 패널 반지름 칸의 최소(RADIAL_LIMITS.radius.min) — 그 아래로는 그림이 무너진다. 바닥에서도 안 들어가면 fit=0(호 선 · 항목만 담는다).
    const spec = radialArcSpec(st, labelSizes, labelMaxW);
    const f = window.RADIAL_ARC_GEOM.fit(spec, { radius: st.radius, width: avail, pad: RADIAL_ARC_PAD, padL: RADIAL_ARC_PAD_LEFT, wantCx, minRadius: RADIAL_LIMITS.radius.min });
    return { arc: true, R: f.R, W: f.W, H: f.H, cx: f.cx, cy: f.cy, m, box: f.box, fits: f.fits, shrunk: f.shrunk, shift: f.shift, labelMaxW,
      pts: spec.degs.map((a) => _polar(f.cx, f.cy, f.R, a)) };
  }
  const vRoom = Math.round(st.labelGap + st.labelSize * 2.8);
  const padTop = out ? vRoom : 8;
  const padBottom = out ? vRoom : (below ? Math.round(st.labelGap + st.labelSize * 2.6) : 8);
  // 「아래」 라벨은 칸보다 조금 넓다 — 그 넘침은 자리가 남을 때만 여유로 잡는다(반지름을 먼저 살린다).
  const wantX = out ? st.labelGap + st.labelWidth : (below ? Math.max(8, (Math.max(m + 40, 120) - m) / 2) : 8);
  const maxR = Math.max(40, Math.floor(avail / 2 - half - (out ? wantX : 8)));
  const R = Math.min(st.radius, maxR);
  const padX = out ? wantX : Math.max(8, Math.min(wantX, Math.floor(avail / 2 - half - R)));
  const W = Math.round(2 * (R + half + padX));
  const H = Math.round(padTop + 2 * (R + half) + padBottom);
  const cx = W / 2, cy = padTop + R + half;
  return { arc: false, R, W, H, cx, cy, m, pts: radialDegsOf(st).map((a) => _polar(cx, cy, R, a)) };
}

/** 연결선 d — 호 모드는 그 구간의 호만(양 끝을 lineExtend 도만큼 늘린다). */
function _linePath(st, g) {
  const G = window.RADIAL_GEOM;
  if (!g.arc) return G.connectorPath(st.line, { cx: g.cx, cy: g.cy, r: g.R, pts: g.pts });
  if (st.line === 'none') return '';
  if (st.line === 'spoke') return G.spokePath(g.cx, g.cy, g.pts);
  // 손으로 끌어 시작~끝 밖으로 나간 항목이 있으면 호도 거기까지 늘린다(상자 계산과 같은 구간 — RADIAL_ARC_GEOM.lineRange).
  const { lo, hi } = window.RADIAL_ARC_GEOM.lineRange(st.startDeg, st.endDeg, g.pts.map((p) => p.deg), st.lineExtend);
  return st.endDeg >= st.startDeg ? _arcPath(g.cx, g.cy, g.R, lo, hi) : _arcPath(g.cx, g.cy, g.R, hi, lo);
}

/** 항목 글이 비었나(공백뿐 포함) — 비면 안내문구를 그린다(t4-03). */
function _labelIsEmpty(src) { return String(src ?? '').trim() === ''; }
/** 항목 글(표기 원문) → 안전한 HTML. escHtml 뒤에 굵게(b)와 줄바꿈(br)만 만든다. */
function radialLabelHTML(src) {
  return escHtml(String(src ?? '')).replace(/\*\*([^*\n]+?)\*\*/g, '<b>$1</b>').replace(/\r?\n/g, '<br>');
}

/* ★t4-06 — 빈 칸 그림 아이콘(.rdl-ph)은 걷었다(체크 무늬로 갈음 · 위 칸 그리기 주석). */
const _multiline = (s) => escHtml(s).replace(/\r?\n/g, '<br>');

function _centerHTML(st, g) {
  if (st.centerMode === 'none') return '';
  const s = g.arc ? st.centerSize : Math.min(st.centerSize, Math.max(40, Math.round(2 * g.R - g.m * 0.5)));
  const box = `left:${_r2(g.cx + st.centerDx - s / 2)}px;top:${_r2(g.cy - s / 2)}px;width:${s}px;height:${s}px;`;
  if (st.centerMode === 'image') {
    /* t4-05(현빈 «샘플그림 안뜨게 해줘. 그냥 캔버스에서 채크패턴으로 떠두면 내가 넣으면 되잖아»): 그림 키가 없으면(새 기본 '') 그림 0 · 체크 무늬(css [data-rdl-empty]). */
    const pic = (window.RADIAL_SAMPLES.has(st.centerImg) || _hasCenterPic(st.centerImg)) ? radialCenterSvg(st.centerImg) : '';
    return `<div class="rdl-center rdl-center--image${st.centerClip === 'none' ? ' rdl-center--noclip' : ''}"${pic ? '' : ' data-rdl-empty="1"'} style="${box}">${pic}</div>`;
  }
  const lines = String(st.centerText).split(/\r?\n/).filter((l) => l.trim() !== '');
  const sub = lines.length > 1 ? lines[0] : '';
  const main = lines.length > 1 ? lines.slice(1).join('\n') : (lines[0] || '');
  /* 글이 비면 안내문구 — 인용구 블럭과 같은 표식(data-is-placeholder · 흐림은 editor-blocks.css · 내보내기에선 capture-safety 가 숨긴다). */
  const ph = lines.length === 0 ? ` data-is-placeholder="true" data-placeholder="${RADIAL_CENTER_PH}"` : '';
  /* 배경이 투명하면 원판 그림자도 없다(그림자는 원판의 것 — css .rdl-center--text[data-rdl-nobg]). */
  const nobg = _isClearColor(st.centerBg) ? ' data-rdl-nobg="1"' : '';
  return `<div class="rdl-center rdl-center--text"${nobg} style="${box}background:${st.centerBg};color:${st.centerColor};">`
    + (sub ? `<span class="rdl-center-sub" style="font-size:${Math.max(11, Math.round(s * 0.085))}px">${escHtml(sub)}</span>` : '')
    + `<span class="rdl-center-main"${ph} style="font-size:${Math.max(14, Math.round(s * (sub ? 0.2 : 0.14)))}px">${ph ? RADIAL_CENTER_PH : _multiline(main)}</span>`
    + `</div>`;
}

/** 항목의 그림(아이콘) — 붙여넣은 SVG 가 있으면 그것(소독본), 없으면 샘플 키. 둘 다 없으면 ''. */
function _itemPic(it) {
  const custom = it.svg ? _safeSvg(it.svg) : '';
  if (custom) return custom;
  return it.img ? window.RADIAL_SAMPLES.svg(it.img) : '';
}

function _labelHTML(st, g, pt, it, i) {
  if (st.labelPos === 'none') return '';
  const m = g.m, half = m / 2;
  const off = (it.labelDx || it.labelDy) ? `translate:${it.labelDx || 0}px ${it.labelDy || 0}px;` : '';
  const css = `font-size:${st.labelSize}px;color:${st.labelColor};font-weight:${st.labelWeight === 'normal' ? 400 : 700};${off}`;
  const pic = st.marker === 'dot' ? _itemPic(it) : '';
  const ico = pic
    ? `<span class="rdl-label-ico${it.svg && pic.includes('data-rdl-custom') ? ' rdl-label-ico--custom' : ''}" style="width:${st.iconSize}px;height:${st.iconSize}px">${pic}</span>` : '';
  /* t4-03: 글이 비면 안내문구 — 같은 span 하나에 표식(data-is-placeholder · 흐림은 editor-blocks.css · 캡처에선 capture-safety 가 숨긴다). 자식 span 은 늘 하나다. */
  const lph = _labelIsEmpty(it.label);
  const body = `${ico}<span class="rdl-label-text"${lph ? ` data-is-placeholder="true" data-placeholder="${RADIAL_LABEL_PH}"` : ''}>${lph ? RADIAL_LABEL_PH : radialLabelHTML(it.label)}</span>`;
  if (st.labelPos === 'below') {
    return `<div class="rdl-label rdl-label--below" style="${css}top:${m + st.labelGap}px;width:${Math.max(m + 40, 120)}px">${body}</div>`;
  }
  if (st.labelPos === 'inside') {
    return `<div class="rdl-label rdl-label--inside" style="${css}">${body}</div>`;
  }
  if (g.arc) {
    // 호 모드의 「바깥」 = 점 오른쪽 · 왼쪽 정렬 · 세로 가운데
    return `<div class="rdl-label rdl-label--outside rdl-label--side" data-rdl-align="left" data-rdl-v="middle" style="${css}left:${m + st.labelGap}px;top:${half}px;max-width:${(g.labelMaxW && g.labelMaxW[i] > 0) ? g.labelMaxW[i] : st.labelWidth}px;transform:translate(0,-50%);text-align:left">${body}</div>`;
  }
  const a = window.RADIAL_GEOM.labelAnchor(pt, g.cx, g.cy, half + st.labelGap);
  const tx = a.align === 'left' ? '0' : (a.align === 'right' ? '-100%' : '-50%');
  const ty = a.v === 'top' ? '0' : (a.v === 'bottom' ? '-100%' : '-50%');
  const ta = a.align === 'left' ? 'left' : (a.align === 'right' ? 'right' : 'center');
  return `<div class="rdl-label rdl-label--outside" data-rdl-align="${a.align}" data-rdl-v="${a.v}" style="${css}left:${(a.x - (pt.x - half)).toFixed(2)}px;top:${(a.y - (pt.y - half)).toFixed(2)}px;max-width:${st.labelWidth}px;transform:translate(${tx},${ty});text-align:${ta}">${body}</div>`;
}

/* ── 캔버스에서 항목 끌기 ─────────────────────────────────────────────────────────
 * 조건: 블럭이 선택돼 있고 그 항목이 «이미 골라진» 항목일 때만(첫 클릭은 고르기). 그 밖의 mousedown 은 손대지 않는다 ⇒ 블럭 빈 곳 끌기는 예전 그대로.
 * 시작하면 mousedown 을 preventDefault(네이티브 draggable 끌기 = 블럭 순서 바꾸기를 막는다) + stopPropagation(자유배치 블럭 끌기를 막는다).
 * 좌표는 스테이지의 화면 사각형 폭 ÷ 레이아웃 폭으로 배율(zoom)을 환산한다. */
function _startItemDrag(block, itemEl, idx, e) {
  const geom = block._rdlGeom;
  const stage = block.querySelector('.rdl-stage');
  if (!geom || !stage || !geom.g.pts[idx]) return;
  const { g, st } = geom;
  const rect = stage.getBoundingClientRect();
  const scale = (rect.width / (stage.offsetWidth || rect.width || 1)) || 1;
  const toStage = (ev) => ({ x: (ev.clientX - rect.left) / scale, y: (ev.clientY - rect.top) / scale });
  const label = e.target.closest?.('.rdl-label');
  let mode = 'slide';
  if (label && itemEl.contains(label)) {
    const lr = label.getBoundingClientRect();
    // 라벨 요소에 걸렸는데 포인터가 라벨 상자 밖이면 = 손잡이(가상요소)를 잡은 것
    const onGrip = e.clientX < lr.left || e.clientX > lr.right || e.clientY < lr.top || e.clientY > lr.bottom;
    if (e.altKey || onGrip) mode = 'label';
  }
  e.preventDefault();
  e.stopPropagation();
  const act = document.activeElement;
  if (act && act !== document.body && !block.contains(act)) { try { act.blur(); } catch (_) {} }

  const half = g.m / 2;
  const p0 = toStage(e);
  const ang = (p) => Math.atan2(p.y - g.cy, p.x - g.cx) * 180 / Math.PI;
  const a0 = ang(p0), deg0 = g.pts[idx].deg;
  const dx0 = st.items[idx].labelDx || 0, dy0 = st.items[idx].labelDy || 0;
  const LL = RADIAL_LIMITS;
  const lineEl = block.querySelector('.rdl-line');
  let moved = false, cur = null;
  block._rdlDragging = true;   // 끄는 동안은 폭 관찰이 다시 그리지 않는다(놓을 때 다시 그린다)

  const onMove = (ev) => {
    if (!moved && Math.hypot(ev.clientX - e.clientX, ev.clientY - e.clientY) < 3) return;
    moved = true;
    const p = toStage(ev);
    if (mode === 'slide') {
      const deg = radialNormDeg(deg0 + (ang(p) - a0));
      const q = _polar(g.cx, g.cy, g.R, deg);
      itemEl.style.left = `${(q.x - half).toFixed(2)}px`;
      itemEl.style.top = `${(q.y - half).toFixed(2)}px`;
      cur = { deg };
      if (lineEl && !g.arc && st.line !== 'orbit' && st.line !== 'none') {
        const pts = g.pts.map((pt, i) => (i === idx ? q : pt));
        lineEl.setAttribute('d', window.RADIAL_GEOM.connectorPath(st.line, { cx: g.cx, cy: g.cy, r: g.R, pts }));
      } else if (lineEl && g.arc && st.line === 'spoke') {
        lineEl.setAttribute('d', window.RADIAL_GEOM.spokePath(g.cx, g.cy, g.pts.map((pt, i) => (i === idx ? q : pt))));
      }
    } else {
      const dx = Math.round(Math.min(LL.labelDx.max, Math.max(LL.labelDx.min, dx0 + (p.x - p0.x))));
      const dy = Math.round(Math.min(LL.labelDy.max, Math.max(LL.labelDy.min, dy0 + (p.y - p0.y))));
      label.style.translate = `${dx}px ${dy}px`;
      cur = { labelDx: dx, labelDy: dy };
    }
    ev.preventDefault();
  };
  const onUp = () => {
    document.removeEventListener('mousemove', onMove, true);
    document.removeEventListener('mouseup', onUp, true);
    block._rdlDragging = false;
    if (!moved || !cur) return;
    // 끌기 끝의 click 은 삼킨다 — 블럭 밖에서 놓으면 그 click 이 선택을 풀어 버린다.
    const eat = (ce) => { ce.stopPropagation(); ce.preventDefault(); };
    window.addEventListener('click', eat, { capture: true, once: true });
    setTimeout(() => window.removeEventListener('click', eat, true), 0);
    const items = radialStateOf(block).items;
    if (!items[idx]) return;
    Object.assign(items[idx], cur);
    block.dataset.items = JSON.stringify(items);
    block._rdlSel = idx;
    renderRadialBlock(block);
    try { window.showRadialProperties?.(block, idx); } catch (_) {}
    window.pushHistory?.();
    window.scheduleAutoSave?.();
  };
  document.addEventListener('mousemove', onMove, true);
  document.addEventListener('mouseup', onUp, true);
}

/* Alt+끌기(라벨만) — 문서에 걸린 「Alt+클릭 = 아래 레이어 고르기」(alt-click-layer-select.js · document capture)가 Alt+mousedown 을 먼저 삼킨다.
 * 그래서 이 한 경우(선택된 블럭의 «고른 항목 라벨» 위)만 window capture 에서 먼저 받아 라벨 끌기를 시작한다. 그 밖의 Alt+클릭은 손대지 않는다. */
if (typeof window !== 'undefined' && !window._rdlAltLabelBound) {
  window._rdlAltLabelBound = true;
  window.addEventListener('mousedown', (e) => {
    if (!e.altKey || e.button !== 0 || e._altLayerSelect) return;
    if (e.target?.closest?.('[contenteditable="true"]')) return;   // t4-03 편집 중 글 안 — 캐럿·글자 고르기가 먼저
    const label = e.target?.closest?.('.radial-block.selected .rdl-cell-selected .rdl-label');
    if (!label) return;
    const itemEl = label.closest('[data-rdl-idx]'), block = label.closest('.radial-block');
    if (!itemEl || !block) return;
    const idx = Number(itemEl.dataset.rdlIdx);
    if (block._rdlSel !== idx) return;
    e.stopImmediatePropagation();
    block._rdlLastHit = idx;
    _startItemDrag(block, itemEl, idx, e);
  }, true);
}

/* t4-04b 가운데 표식(_rdlLastCenterHit)의 수명 — 그 누름에 이어지는 click 한 번에만 쓰인다.
 *   click 은 mouseup 과 같은 task 에서 나고(공용 클릭 고리가 거기서 showRadialProperties 를 부른다) setTimeout 0 은 그 뒤에 돈다.
 *   끌기(dragstart) · 다음 누름(어느 곳이든 — 레이어 패널 포함)은 바로 무효. ⇒ 레이어 패널 · 키 · 다른 길로 열린 패널은 표식을 못 본다(plan-b §5 «레이어 패널 길은 false»). */
let _rdlMarked = null, _rdlMarkSeq = 0;
function _rdlCenterMark(block) { _rdlMarked = block; _rdlMarkSeq++; }
function _rdlDropCenterMark(seq) {
  if (!_rdlMarked || (typeof seq === 'number' && seq !== _rdlMarkSeq)) return;
  _rdlMarked._rdlLastCenterHit = undefined;
  _rdlMarked._rdlPressLive = undefined;
  _rdlMarked = null;
}
if (typeof window !== 'undefined' && !window._rdlCenterMarkBound) {
  window._rdlCenterMarkBound = true;
  window.addEventListener('mousedown', () => _rdlDropCenterMark(), true);   // 새 누름 — 블럭 capture 보다 먼저 돈다(그 블럭이 다시 적는다)
  window.addEventListener('dragstart', () => _rdlDropCenterMark(), true);   // 끌기 = click 아님
  window.addEventListener('mouseup', () => { if (_rdlMarked) { const q = _rdlMarkSeq; setTimeout(() => _rdlDropCenterMark(q), 0); } }, true);
}

/* t4-04b R1 · R2 (eval-b2 D1 · D2) — 가운데 드릴(첫 클릭 = 블럭 · 다음 클릭 = 가운데)은 그리드 T-058 «드릴다운 걸쇠»를 «부른다»(사본 0).
 *   걸쇠 정본 = js/props/prop-grid.js:122-135 grdMarkCanvasDrill / grdWasCanvasDrilled / grdResetCanvasDrill(window 로 내놓음 · :168-171).
 *     그 주석: «캔버스 클릭이 아닌» 선택(Esc · 레이어 패널 · 정본 패널표 · MCP selectBlock)이 걸쇠를 못 풀면 «사용자에겐 첫» 캔버스 클릭이 곧바로 내려간다 → ⌫ 가 엉뚱한 것을 지운다.
 *   단독 선택 = prop-grid.js:115 grdIsSoleSelected(정본) — block-drag.js:72 _isSoleSelectedBlock 이 감싸 부르는 바로 그 함수다(같은 뜻 · 부재 시 false = 블럭 고름 쪽).
 *   ⛔block-drag.js:84 `_gridWasCanvasSelected`(= grdWasCanvasDrilled && _isSoleSelectedBlock) 자체는 못 부른다 — 그 모듈 안 지역 함수(export · window 0)이고 block-drag.js 는 이 덩이 무접촉이다.
 *     그래서 그 «곱»만 여기서 두 정본 함수로 다시 쓴다(걸쇠 상태는 prop-grid 한 곳 · 여기 사본 0).
 *   거는 자리 = 패널이 «이 블럭의 캔버스 누름에 이어진 click» 으로 열릴 때(그리드는 block-drag.js:2495 가 걸지만 그 줄은 그리드 전용이라 radial 은 여기서 건다).
 *   푸는 자리 = 패널이 그 밖의 길(레이어 패널 · 삽입 직후 selectBlock · panel-dispatch · MCP)로 열릴 때 · 걸린 블럭의 고름이 풀릴 때(아래 관찰자).
 *   «이 click 이 캔버스 누름에서 왔나»는 위 표식과 같은 수명(그 누름의 click 한 번)의 _rdlPressLive 로 가린다. */
function _rdlCanvasDrilled(block) {
  return !!window.grdWasCanvasDrilled?.(block) && !!window.grdIsSoleSelected?.(block);
}
/** 패널(showRadialProperties) 머리에서 부른다 — idx 가 정수(패널 안 다시 열기 · 끌기 끝 · 편집 커밋)면 걸쇠를 안 만진다. */
function radialNoteOpen(block, idx) {
  if (!block || Number.isInteger(idx)) return;
  if (block._rdlPressLive === true) window.grdMarkCanvasDrill?.(block);
  else window.grdResetCanvasDrill?.();
}

/* t4-04b «보이는 고리 = ⌫ 가 하는 일» 맞추기(E5 · eval-b).
 *   ⌘D · 붙여넣기는 DOM 을 통째로 베끼므로 고리 클래스는 따라가고 _rdlCenterSel(밑줄 프로퍼티)은 안 따라간다.
 *   규율: «고르기 상태는 사본에 안 따라간다» — 줌 블럭 _zoomPicked(사람이 집어 둔 앵커 · tests/dom/duplicate-zoom.dom.spec.js:16 · :103 · :168)와 같다.
 *   ⇒ 사본에서는 고리를 걷는다. 원본은 블럭 고름이 풀리면(.selected 빠짐) 가운데 고름도 푼다. editor.js · block-drag.js 무접촉 — 캔버스 관찰로 맞춘다. */
function _rdlSyncCenterSel(block) {
  if (!block.classList.contains('selected') && window.grdWasCanvasDrilled?.(block)) window.grdResetCanvasDrill?.();   // R1 — 고름이 풀리면 걸쇠도 푼다
  if (block._rdlCenterSel === true) { if (!block.classList.contains('selected')) radialSetCenterSel(block, false); return; }
  if (block.querySelector('.rdl-center-cell-selected')) radialSetCenterSel(block, false);
}
function _rdlWatchCenterSel() {
  if (window._rdlCenterSelObs || typeof MutationObserver === 'undefined') return;
  const root = document.getElementById('canvas');
  if (!root) return;
  window._rdlCenterSelObs = new MutationObserver((recs) => {
    const hit = new Set();
    for (const r of recs) {
      if (r.type === 'attributes') { if (r.target.classList?.contains('radial-block')) hit.add(r.target); continue; }
      for (const n of r.addedNodes) {
        if (n.nodeType !== 1) continue;
        if (n.classList.contains('radial-block')) hit.add(n);
        n.querySelectorAll('.radial-block').forEach((b) => hit.add(b));
      }
    }
    hit.forEach((b) => { if (b.isConnected) _rdlSyncCenterSel(b); });
  });
  window._rdlCenterSelObs.observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
}

function _bindCellHit(block) {
  _rdlWatchCenterSel();
  if (block._rdlBound) return;
  block._rdlBound = true;
  // 캔버스에서 어느 칸을 눌렀는지 적어 둔다 — 공용 클릭 루프가 패널을 열 때 패널이 읽는다(block-drag.js 에 전용 분기를 안 넣는 길).
  block.addEventListener('mousedown', (e) => {
    if (e.target?.closest?.('[contenteditable="true"]')) return;   // t4-03 편집 중 글 안 — 끌기(preventDefault)로 가면 캐럿이 안 선다
    const hit = e.target?.closest?.('[data-rdl-idx]');
    const idx = (hit && block.contains(hit)) ? Number(hit.dataset.rdlIdx) : -1;
    if (e.button === 0) { block._rdlPressLive = true; _rdlCenterMark(block); }   // R1 — 이 누름의 click 이 패널을 열면 그때 걸쇠를 건다(radialNoteOpen)
    /* t4-03 편집 중 host «밖»을 누르면(칸 끌기 · 다른 칸) 편집을 먼저 끝낸다 — 친 글은 blur → _radialEndEdit 가 쓴다.
     * 이 누름으로 끌기는 시작하지 않는다(편집 host 가 다시 그리기로 떨어져 나갈 때 blur 안에서 innerHTML 이 겹치던 E10 · eval-b).
     * 겹① — E10-G1 이 잰다(⒝-3 실측: 이 겹만 뺀 사본에서 E10-G1 ㉯ 빨강 · 항목 1 에 deg 가 생김 · E10 · Z-E10c 는 초록) · 별건 E10-GUARD1-NO-CONSUMER-01 · ⛔지우지 마라(안 닿는다 ≠ 죽음). */
    if (block.classList.contains('editing')) {
      const h = block.querySelector('[contenteditable="true"]');
      if (h) { e.preventDefault(); h.blur(); return; }
    }
    block._rdlLastHit = idx;
    /* t4-04b 가운데 고르기 — 가운데를 눌렀는지 적어 두고(패널이 열 때 읽어 _rdlCenterSel 로 옮긴다), 가운데 밖이면 바로 푼다(낡은 선택 막기).
     * ★첫 클릭 = 블럭 고르기 · 블럭이 «이미» 골라져 있을 때만 가운데를 고른다 — 항목 끌기(:_startItemDrag 머리 «첫 클릭은 고르기»)와 같은 두 단
     *   (prop-grid.js 피그마식 드릴다운 «첫 클릭=블럭 · 다음 클릭=줄» · 현빈 1012t1G1 «첫클릭은 블럭 선택» · E2 · eval-b).
     * 표식의 수명은 «그 누름의 click 한 번» 이다 — 아래 _rdlCenterMark 가 끌기 · 다음 누름 · mouseup 뒤에 무효로 만든다(E15 · 지금은 모든 왼 누름에 건다 — R1 의 _rdlPressLive 도 같은 수명).
     * ★R1 · R2(eval-b2) — «이미 골라져 있다»만으로는 모자란다: 그 고름을 «캔버스 클릭»이 세웠고(그리드 걸쇠 · 레이어 패널 · 삽입 직후는 아니다) 단독 선택일 때만이다
     *   (prop-grid.js:122-131 · block-drag.js:84 `_gridWasCanvasDrilled = grdWasCanvasDrilled && _isSoleSelectedBlock` · 항목 끌기의 `_rdlSel === idx` 가 같은 걸쇠 노릇 — 레이어 길은 _rdlSel −1). */
    const onCenter = !!(e.target?.closest?.('.rdl-center') && idx < 0 && block.classList.contains('selected') && _rdlCanvasDrilled(block));
    block._rdlLastCenterHit = onCenter;
    if (!onCenter) radialSetCenterSel(block, false);
    if (e.button !== 0 || idx < 0) return;
    if (!block.classList.contains('selected') || block._rdlSel !== idx) return;
    _startItemDrag(block, hit, idx, e);
  }, true);
  block.addEventListener('dblclick', (e) => _onRadialDblclick(block, e));
}

/* ── t4-03 · t4-04b 캔버스에서 바로 고치기(라벨 · 가운데 글) ────────────────────────────
 * 인용구 블럭 dblclick(block-drag.js isQuote · _quoteEndEdit)과 같은 규율:
 *   들어갈 때 — 블럭에 editing(클래스는 classList 로만) · host contenteditable · draggable=false(부모 row 가 draggable) · 원문을 «줄당 div» 로 보인다(** · 줄바꿈 그대로).
 *     안내문구였으면 글을 통째로 골라 둔다(치면 바로 바뀐다).
 *   나올 때(blur · Escape) — mdlReadText(drag-utils.js 한 벌)로 읽는다. 안내문구를 손 안 댔거나 같은 글이면 쓰지 않고 다시 그리기만 한다.
 *     바뀌었으면 편집 전 그림으로 되돌린 뒤 ensureHistoryCheckpoint → dataset 쓰기 → 그리기 → (고른 블럭이면 패널 다시) → pushHistory ⇒ ⌘Z 한 걸음.
 *   가운데 글은 첫 줄 = 작은 글(sub) · 나머지 = 큰 글(main) — _centerHTML 규칙 그대로(이 파일은 저장값만 쓴다). */
function _editTarget(block, n) {
  const lab = n?.closest?.('.rdl-label');
  if (lab && block.contains(lab)) {
    const host = lab.querySelector('.rdl-label-text'), item = lab.closest('[data-rdl-idx]');
    if (host && item) return { host, kind: 'label', idx: Number(item.dataset.rdlIdx) };
  }
  const c = n?.closest?.('.rdl-center--text');
  if (c && block.contains(c)) return { host: c, kind: 'center', idx: -1 };
  return null;
}
function _onRadialDblclick(block, e) {
  const t = _editTarget(block, document.elementFromPoint(e.clientX, e.clientY)) || _editTarget(block, e.target);
  if (!t) return;
  e.stopPropagation();
  const { host, kind, idx } = t;
  if (host.getAttribute('contenteditable') === 'true') return;
  const st = radialStateOf(block);
  if (kind === 'label' && !st.items[idx]) return;
  const raw = kind === 'label' ? st.items[idx].label : st.centerText;
  const wasPh = String(raw).trim() === '';
  if (kind === 'center') {
    const main = host.querySelector('.rdl-center-main');
    if (main) { const cs = getComputedStyle(main); host.style.fontSize = cs.fontSize; host.style.fontWeight = cs.fontWeight; }
  }
  host.removeAttribute('data-is-placeholder');
  host.querySelectorAll('[data-is-placeholder]').forEach((el) => el.removeAttribute('data-is-placeholder'));
  const lines = wasPh ? [RADIAL_LABEL_PH] : String(raw).split(/\r?\n/);
  host.innerHTML = lines.length > 1 ? lines.map((l) => `<div>${escHtml(l) || '<br>'}</div>`).join('') : escHtml(lines[0]);
  block.classList.add('editing');            // 공용 클릭 고리 · 공용 mousedown · 폭 관찰이 이걸 본다
  host.setAttribute('contenteditable', 'true');
  host.setAttribute('draggable', 'false');
  host._rdlEdit = { kind, idx, raw, wasPh };
  host.addEventListener('blur', () => _radialEndEdit(block, host), { once: true });
  if (!host._rdlKeyBound) {
    host._rdlKeyBound = true;
    host.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); host.blur(); }
    });
  }
  host.focus();
  const sel = window.getSelection();
  if (!sel) return;
  sel.removeAllRanges();
  const r = document.createRange();
  if (wasPh) r.selectNodeContents(host);       // 안내문구면 통째로 고름 → 치면 바로 바뀐다
  else {
    const cr = document.caretRangeFromPoint ? document.caretRangeFromPoint(e.clientX, e.clientY) : null;
    if (cr && host.contains(cr.startContainer)) { sel.addRange(cr); return; }
    r.selectNodeContents(host); r.collapse(false);
  }
  sel.addRange(r);
}
function _radialEndEdit(block, host) {
  const ed = host._rdlEdit;
  host._rdlEdit = null;
  host.removeAttribute('draggable');
  host.setAttribute('contenteditable', 'false');
  block.classList.remove('editing');
  if (!ed) return;
  let text = mdlReadText(host);
  if (text.trim() === '' || (ed.wasPh && text.trim() === RADIAL_LABEL_PH)) text = '';   // 안내문구를 손 안 댔으면 굳히지 않는다
  /* 다시 그리는 중이면(_paintRadial 의 innerHTML 이 host 를 떼며 blur 가 났다) 여기서 또 그리지 않는다 — 겹친 innerHTML 은
   * NotFoundError «moved in a 'blur' event handler» 를 낸다(E10 · eval-b). 글은 지금 읽어 두고 그 그리기가 끝난 뒤 쓴다. */
  if (block._rdlPainting) { queueMicrotask(() => _radialCommitEdit(block, ed, text)); return; }
  _radialCommitEdit(block, ed, text);
}
function _radialCommitEdit(block, ed, text) {
  if (!block.isConnected) return;
  renderRadialBlock(block);                    // 편집 전 그림으로(dataset 은 아직 그대로)
  if (text === ed.raw) return;
  window.ensureHistoryCheckpoint?.(ed.kind === 'label' ? '라벨 편집 전' : '가운데 글 편집 전');
  if (ed.kind === 'label') {
    const items = radialItemsOf(block);
    if (!items[ed.idx]) return;
    items[ed.idx].label = text;
    block.dataset.items = JSON.stringify(items);
  } else block.dataset.centerText = text;
  renderRadialBlock(block);
  if (block.classList.contains('selected')) { try { window.showRadialProperties?.(block, Number.isInteger(block._rdlSel) ? block._rdlSel : -1); } catch (_) {} }
  window.pushHistory?.(ed.kind === 'label' ? '라벨 편집' : '가운데 글 편집');
  window.scheduleAutoSave?.();
}

/* ── t4-04b 가운데 고르기 · ⌫ = 가운데 «없음» ─────────────────────────────────────
 * 가운데를 누르면 그 블럭의 가운데가 «골라진» 상태다(_rdlCenterSel · 고리 = 항목 고리와 같은 토큰).
 *   고리 클래스 rdl-center-cell-selected 는 직렬화의 런타임 표식 규칙(-cell-selected · section-serialize.js)이 벗긴다 ⇒ 저장본 · 히스토리에 안 실린다(항목 rdl-cell-selected 와 같은 꼴).
 *   풀리는 때: 가운데 밖 mousedown · 패널이 «가운데를 안 누른» 길로 열릴 때(레이어 패널 · 항목 · 다른 블럭).
 * ⌫/Delete 는 document capture 에서 먼저 받는다(comparison-img-edit.js 의 칸 비우기와 같은 꼴 · editor.js 무접촉).
 *   먹는 조건이 하나라도 어긋나면 손대지 않는다 → 전역 «블럭 삭제» 그대로. */
function radialSetCenterSel(block, on) {
  if (!block) return;
  block._rdlCenterSel = !!on;
  block.querySelectorAll('.rdl-center').forEach((c) => c.classList.toggle('rdl-center-cell-selected', !!on));
}
if (typeof document !== 'undefined' && !window._rdlCenterKeyBound) {
  window._rdlCenterKeyBound = true;
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Backspace' && e.key !== 'Delete') return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const typing = (el) => !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName || ''));
    if (typing(document.activeElement) || typing(e.target)) return;
    const sel = document.querySelectorAll('#canvas .radial-block.selected');
    if (sel.length !== 1 || document.querySelector('#canvas .multi-selected')) return;
    const block = sel[0];
    if (block._rdlCenterSel !== true || !block.querySelector('.rdl-center') || block.classList.contains('editing')) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    window.ensureHistoryCheckpoint?.('가운데 지우기 전');
    block.dataset.centerMode = 'none';
    radialSetCenterSel(block, false);
    renderRadialBlock(block);
    try { window.showRadialProperties?.(block, -1); } catch (_) {}
    window.pushHistory?.('가운데 지우기');
    window.scheduleAutoSave?.();
  }, true);
}

/** 화면에 붙은 블럭의 라벨 크기(배율과 무관한 레이아웃 px) — 못 재면(안 붙었거나 숨김) null. */
function _measureLabels(block, n) {
  if (!block.isConnected) return null;
  const out = new Array(n).fill(null);
  let any = false;
  block.querySelectorAll('.rdl-item[data-rdl-idx]').forEach((el) => {
    const i = Number(el.dataset.rdlIdx), lab = el.querySelector('.rdl-label');
    if (!lab || !(i >= 0 && i < n)) return;
    const w = lab.offsetWidth, h = lab.offsetHeight;
    if (w > 0 && h > 0) { out[i] = { w, h }; any = true; }
  });
  return any ? out : null;
}

/* ── 폭 관찰(호 모드만) ───────────────────────────────────────────────────────────
 * 호 모드는 «그릴 때의 블럭 폭»에 맞춰 반지름 · 원 중심 · 높이를 정한다 ⇒ 그 뒤에 폭이 바뀌면(섹션 좌우 패딩 · 그리드/프레임 칸 · 페이지 폭) 라벨이 블럭 밖으로 나간다.
 * 그래서 폭이 바뀌면 다시 맞춘다. 관찰자는 모듈에 하나(js/effects-reflect.js 와 같은 꼴) — 요소가 문서에서 떨어지면 관찰을 끊는다.
 *   · «폭»만 본다: 다시 그리면 높이가 바뀌어 관찰자가 또 오지만, 그린 폭(_rdlW)과 같으면 아무것도 안 한다 ⇒ 한 번에 멎는다.
 *   · 끄는 동안은 건너뛴다(놓을 때 다시 그린다).
 *   · ★되돌린 상태(redo 꼬리가 있는 동안)에서는 다시 맞추지 «않는다» — 관찰자는 한 프레임 뒤에 쓰므로 그때 화면을 바꾸면
 *     다음 ⌘Z 첫머리의 ensureHistoryCheckpoint 가 «라이브 ≠ 그 칸»으로 읽어 redo 꼬리를 자른다(js/history.js 의 _restampRestored 주석이 적어 둔 위험).
 *     꼭대기로 돌아오면(다시 실행 끝 · 새 편집) 그때의 그리기가 맞춘다. history.js 는 이 프로토 범위 밖이라 안 건드린다. */
const _rdlWidthRO = (typeof ResizeObserver === 'function') ? new ResizeObserver((entries) => {
  for (const e of entries) _onArcWidth(e.target);
}) : null;
const _rdlWatched = new WeakSet();
function _watchArcWidth(block, on) {
  if (!_rdlWidthRO) return;
  if (on && !_rdlWatched.has(block)) { _rdlWatched.add(block); _rdlWidthRO.observe(block); }
  else if (!on && _rdlWatched.has(block)) { _rdlWatched.delete(block); _rdlWidthRO.unobserve(block); }
}
function _onArcWidth(block) {
  if (!block.isConnected || block.dataset.shape !== 'arc') { _watchArcWidth(block, false); return; }
  const w = block.clientWidth;
  if (!(w > 0) || w === block._rdlW || block._rdlDragging || block.classList.contains('editing')) return;   // 편집 중 다시 그리면 host 가 떨어져 나간다
  const tip = window.getHistoryTip?.();
  if (tip && tip.pos < tip.len - 1) return;
  renderRadialBlock(block);
}

function renderRadialBlock(block) {
  if (!block) return;
  /* ★t7-01 「Radial Block 패딩 제외 옵션 추가」(2026-10-26 S3) — 레포 고유명사 「패딩 제외」(dataset.fullBleed)의 이식.
     ★본 = 배너2(js/blocks/banner02-block.js renderBanner02 의 같은 한 줄) · 부품 = js/drag-utils.js applyBlockFullBleed.
     ★자리가 «맨 앞»인 까닭: 호(arc)는 배치가 블럭 폭(clientWidth)을 잰다 ⇒ 넓힌 «뒤»에 재야 넓어진 폭에 맞춰 그린다.
     이 렌더는 블럭 폭을 따로 안 박는다 ⇒ «제 폭을 먼저 정하고 마지막에 덮는다» 규약과 어긋나지 않는다. 키 없으면 no-op(옛 블럭 무변화). */
  window.applyBlockFullBleed?.(block);
  /* ★t4-07 「좌우패딩기능 추가해줄 것」(2026-10-26 S3) — 블럭 안쪽 좌우 여백. 키(dataset.padX)가 없으면 인라인을 안 남긴다(옛 바이트).
     ★배치 «앞»에 건다 — radialLayoutOf 가 clientWidth − 2×padX 로 쓸 수 있는 폭을 잰다(호는 그 폭에 맞춘다). */
  const _px = radialStateOf(block).padX;
  block.style.paddingLeft = block.style.paddingRight = _px ? _px + 'px' : '';
  const st = radialStateOf(block);
  let g = radialLayoutOf(block, st);
  _paintRadial(block, st, g);
  if (g.arc) {
    // 라벨의 실제 크기는 붙은 뒤에야 안다 — 재서 상자를 다시 맞추고, 달라졌을 때만 한 번 더 그린다(라벨 크기는 자리와 무관 ⇒ 한 번이면 멎는다).
    const sizes = _measureLabels(block, st.count);
    if (sizes) {
      const g2 = radialLayoutOf(block, st, sizes);
      if (g2.R !== g.R || g2.H !== g.H || g2.cx !== g.cx || g2.cy !== g.cy) { g = g2; _paintRadial(block, st, g); }
    }
  }
  block.style.background = st.bg || '';
  block._rdlGeom = { g, st };
  block._rdlW = g.arc ? block.clientWidth : undefined;   // 이 그림을 맞춘 폭(문서에 안 붙었으면 0 ⇒ 붙은 뒤 관찰자가 다시 맞춘다)
  _watchArcWidth(block, g.arc);
  _bindCellHit(block);
}

function _paintRadial(block, st, g) {
  const pts = g.pts;
  const d = _linePath(st, g);
  const half = g.m / 2;
  const isDot = st.marker === 'dot';
  const cellRadius = st.cellShape === 'round' ? `${st.cellRadius}px` : '50%';
  const sel = Number.isInteger(block._rdlSel) ? block._rdlSel : -1;
  const dash = st.lineStyle === 'dashed' ? ` stroke-dasharray="${st.lineWidth * 3} ${st.lineWidth * 3}"` : '';

  const itemsHTML = pts.map((p, i) => {
    const it = st.items[i];
    const pic = isDot ? '' : _itemPic(it);
    const cell = isDot
      ? `<div class="rdl-cell rdl-cell--dot" style="background:${st.dotColor}"></div>`
      /* ★t4-06(현빈 「안쪽은 서클이미지블럭처럼 단순히 체크패턴들어간 에셋블럭이면 된다」) — 빈 칸은 회색 바탕+그림 아이콘이 아니라
         체크 무늬(css/editor-radial.css .rdl-cell--empty · 서클이미지블럭 .icb-circle 과 같은 big 토큰 · 가운데 t4-05 와 같은 꼴).
         ★사람이 칸 색을 따로 골랐으면(기본값이 아니면) 그 색이 이긴다 — 서클이미지블럭 「배경색을 고르면 빈 원의 체커도 걷는다」와 같은 뜻. */
      : `<div class="rdl-cell${pic ? '' : ' rdl-cell--empty'}" style="border-radius:${cellRadius};${(pic || st.cellFill !== RADIAL_DEFAULTS.cellFill) ? `background:${st.cellFill}` : ''}">${pic ? `<span class="rdl-cell-img">${pic}</span>` : ''}</div>`;
    return `<div class="rdl-item rdl-item--${st.labelPos}${isDot ? ' rdl-item--dot' : ''}${radialItemIsManual(it) ? ' rdl-item--manual' : ''}${i === sel ? ' rdl-cell-selected' : ''}" data-rdl-idx="${i}" style="left:${(p.x - half).toFixed(2)}px;top:${(p.y - half).toFixed(2)}px;width:${g.m}px;height:${g.m}px">`
      + cell
      + _labelHTML(st, g, p, it, i)
      + `</div>`;
  }).join('');

  const box = g.arc ? `width:100%;height:${g.H}px` : `width:${g.W}px;height:${g.H}px`;
  const fitAttr = g.arc ? ` data-rdl-fit="${g.fits ? 1 : 0}" data-rdl-shrunk="${g.shrunk}" data-rdl-shift="${g.shift}"` : '';
  const html = `<div class="rdl-stage${g.arc ? ' rdl-stage--arc' : ''}" data-rdl-r="${g.R}" data-rdl-cx="${g.cx}" data-rdl-cy="${g.cy}"${fitAttr} style="${box}">`
    + `<svg class="rdl-lines" viewBox="0 0 ${g.W} ${g.H}" width="${g.W}" height="${g.H}" aria-hidden="true">`
    + `<path class="rdl-line" d="${d}" fill="none" stroke="${st.lineColor}" stroke-width="${st.lineWidth}" stroke-linecap="${g.arc ? RADIAL_ARC_LINECAP : 'round'}"${dash}/>`
    + `</svg>`
    + _centerHTML(st, g)
    + itemsHTML
    + `</div>`;
  block._rdlPainting = true;   // 이 사이 편집 host 의 blur 가 다시 그리기를 겹치지 않게(_radialEndEdit)
  try { block.innerHTML = html; } finally { block._rdlPainting = false; }
  if (block._rdlCenterSel) radialSetCenterSel(block, true);   // 다시 그려도 가운데 고름 고리는 남는다
}

function makeRadialBlock(opts = {}) {
  const G = window.RADIAL_GEOM, L = RADIAL_LIMITS;
  const isArc = opts.shape === 'arc';
  // 호 블럭의 기본값 = 반원 · 점 + 글(RADIAL_ARC_PRESET). 원 · 다각형의 기본값은 그대로다.
  const D = isArc ? { ...RADIAL_DEFAULTS, ...RADIAL_ARC_PRESET, count: RADIAL_ARC_DEFAULT_ITEMS.length } : RADIAL_DEFAULTS;
  const block = document.createElement('div');
  block.className = 'radial-block';
  block.id = genId('rdl');
  block.dataset.type = 'radial';
  const ds = block.dataset;
  const num = (key) => String(G.clamp(opts[key], L[key].min, L[key].max, D[key]));
  ds.shape = _oneOf(opts.shape, RADIAL_SHAPES, D.shape);
  if (isArc) ds.arcSeen = '1';
  ds.count = String(_clampCount(ds.shape, opts.count, D.count));
  ds.radius = num('radius');
  ds.startDeg = num('startDeg');
  ds.line = _oneOf(opts.line, RADIAL_LINES, ds.shape === 'poly' ? 'outline' : D.line);
  ds.lineColor = _color(opts.lineColor, D.lineColor);
  ds.lineStyle = (opts.lineStyle === 'solid' || opts.lineStyle === 'dashed') ? opts.lineStyle : D.lineStyle;
  ds.lineWidth = num('lineWidth');
  ds.cellSize = num('cellSize');
  ds.cellShape = opts.cellShape === 'round' ? 'round' : D.cellShape;
  ds.cellRadius = num('cellRadius');
  ds.cellFill = _color(opts.cellFill, D.cellFill);
  ds.centerMode = _oneOf(opts.centerMode, RADIAL_CENTER_MODES, D.centerMode);
  ds.centerSize = num('centerSize');
  ds.centerImg = (window.RADIAL_SAMPLES.has(opts.centerImg) || _hasCenterPic(opts.centerImg)) ? opts.centerImg : D.centerImg;
  ds.centerClip = opts.centerClip === 'none' ? 'none' : D.centerClip;
  ds.bg = _color(opts.bg, D.bg);
  ds.centerText = typeof opts.centerText === 'string' ? opts.centerText : D.centerText;
  ds.centerBg = _color(opts.centerBg, D.centerBg);
  ds.centerColor = _color(opts.centerColor, D.centerColor);
  ds.labelPos = _oneOf(opts.labelPos, RADIAL_LABEL_POS, D.labelPos);
  ds.labelSize = num('labelSize');
  ds.labelColor = _color(opts.labelColor, D.labelColor);
  ds.labelGap = num('labelGap');
  ds.labelWidth = num('labelWidth');
  ds.labelWeight = opts.labelWeight === 'normal' ? 'normal' : D.labelWeight;
  ds.endDeg = num('endDeg');
  ds.centerX = num('centerX');
  ds.lineExtend = num('lineExtend');
  ds.centerDx = num('centerDx');
  ds.marker = (opts.marker === 'dot' || opts.marker === 'cell') ? opts.marker : D.marker;
  ds.dotSize = num('dotSize');
  ds.dotColor = _color(opts.dotColor, D.dotColor);
  ds.iconSize = num('iconSize');
  ds.items = JSON.stringify(Array.isArray(opts.items) ? opts.items : (isArc ? RADIAL_ARC_DEFAULT_ITEMS : RADIAL_DEFAULT_ITEMS));
  radialSetCount(block, ds.count);
  renderRadialBlock(block);

  const row = document.createElement('div');
  row.className = 'row';
  row.id = genId('row');
  row.dataset.layout = 'stack';
  row.appendChild(block);
  return { row, block };
}

function _selectNewRadial(block) {
  if (!block) return;
  try { window.selectBlock?.(block.id); } catch (_) {}
  try {
    window.showRadialProperties?.(block);
    window.showHandlesFor?.(block);
  } catch (_) {}
}

function addRadialBlock(opts = {}) {
  // FRAMEICON 패턴 — free-layout/fullWidth 프레임 안이면 _insertToFlowFrame 이 전부 처리한다(인용구 블럭과 같은 순서).
  let made = null;
  if (window._insertToFlowFrame?.(() => (made = makeRadialBlock(opts)))) {
    if (made) { renderRadialBlock(made.block); _selectNewRadial(made.block); }
    window.triggerAutoSave?.();
    return made;
  }
  const sec = window.getSelectedSection?.();
  if (!sec) { showNoSelectionHint?.(); return null; }
  window.pushHistory?.();
  const { row, block } = made || makeRadialBlock(opts);
  insertAfterSelected(sec, row);
  renderRadialBlock(block);
  bindBlock(block);
  window.buildLayerPanel?.();
  _selectNewRadial(block);
  row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  window.triggerAutoSave?.();
  return { row, block };
}

window.makeRadialBlock = makeRadialBlock;
window.addRadialBlock = addRadialBlock;
window.renderRadialBlock = renderRadialBlock;

export {
  makeRadialBlock, addRadialBlock, renderRadialBlock,
  radialStateOf, radialItemsOf, radialSetCount, radialSetCenterSel, radialNoteOpen, radialLayoutOf, radialArcSpec, radialArcLabelRects, radialArcLabelMaxW, RADIAL_ARC_PAD, RADIAL_ARC_PAD_LEFT, radialCountLimits, radialLabelHTML,
  radialNormDeg, radialAutoDegs, radialDegsOf, radialItemIsManual, radialResetPlacement,
  radialSanitizeSvg, radialCenterKeys, radialCenterSvg, radialCenterLabel, RADIAL_CENTER_PICS, RADIAL_ICON_SVG_MAX,
  RADIAL_DEFAULTS, RADIAL_DOT_COLOR, RADIAL_TEXT_COLOR, RADIAL_CENTER_PH, RADIAL_LABEL_PH, RADIAL_LIMITS, RADIAL_LINES, RADIAL_LABEL_POS, RADIAL_CENTER_MODES, RADIAL_SHAPES, RADIAL_ARC_PRESET, RADIAL_LOOK_KEYS, RADIAL_ARC_DEFAULT_ITEMS,
};
