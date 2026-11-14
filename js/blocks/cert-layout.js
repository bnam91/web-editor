/* cert-layout.js — A4 용지 스택(cert-block)의 «배치»만: 세로 A4 를 겹쳐 세운 자리와 (선택) 지시선 (A · 261114 · 현빈 reframe «A4 용지들을 배치»)
 *   ★기본 = fan(부채처럼 겹쳐 세움 · 장 수에 맞춰 계산 — 현빈 노트 ① 인증서샘플). s17·stair·pile = 같은 «스택»의 다른 겹침.
 *   ★순수 함수만 — window·DOM 0. 단위(tests/unit/cert-layout.test.mjs)가 글을 읽어 그대로 돌린다(루트가 commonjs).
 *   ★CB3 참값 = 실물 S17(벨누크 · ~/Downloads/goditor-t3/cert-pilot/rep4/r3.jpg): 증서 4장이 «제각각» 각도·위치로 겹친다(대칭 부채 아님)
 *     · 장마다 세로 지시선 + 굵은 인증명 + 회색 설명 · 위쪽에 놓인 종이는 글이 위, 아래쪽 종이는 글이 아래.
 *     s17 프리셋은 그 그림(폭 600)에서 눈으로 읽은 중심·각도를 폭 비율로 옮긴 것(실측 아님 — 「비슷한 꼴」이 목표).
 *   좌표: 블럭 콜라주 영역 왼쪽 위 (0,0) · y 아래로 증가 · 각도는 도(시계방향 +).
 */

/** 증서 종이 세로/가로 = A4(297/210). */
export const CERT_SHEET_RATIO = 297 / 210;
export const CERT_MAX_SHEETS = 6;
/** 배치 프리셋 — 장 i 의 중심(폭 비율 cx · 밴드 비율 cy)·각도·글 위치·쌓임 순서. 4장 기준 · 장 수가 다르면 'auto' 규칙으로 짓는다. */
export const CERT_PRESETS = Object.freeze({
  s17: [
    { cx: 0.22, cy: 0.52, rot: -8, side: 'bottom', z: 2 },
    { cx: 0.46, cy: 0.30, rot: 4, side: 'top', z: 1 },
    { cx: 0.79, cy: 0.50, rot: 7, side: 'top', z: 3 },
    { cx: 0.55, cy: 0.70, rot: -4, side: 'bottom', z: 4 },
  ],
  stair: [
    { cx: 0.20, cy: 0.62, rot: -6, side: 'bottom', z: 1 },
    { cx: 0.40, cy: 0.42, rot: -2, side: 'top', z: 2 },
    { cx: 0.60, cy: 0.62, rot: 3, side: 'bottom', z: 3 },
    { cx: 0.80, cy: 0.42, rot: 6, side: 'top', z: 4 },
  ],
  pile: [
    { cx: 0.32, cy: 0.48, rot: -10, side: 'top', z: 1 },
    { cx: 0.50, cy: 0.56, rot: 2, side: 'bottom', z: 3 },
    { cx: 0.68, cy: 0.46, rot: 9, side: 'top', z: 2 },
    { cx: 0.50, cy: 0.40, rot: -3, side: 'top', z: 4 },
  ],
});
export const CERT_PRESET_NAMES = ['fan'].concat(Object.keys(CERT_PRESETS), 'auto');

/** 부채 스택 — 가로로 겹쳐 늘어서고(이웃과 약 45% 겹침) 각도가 왼→오로 고르게 커진다 · 바깥 장은 살짝 아래 · 오른쪽이 위에 쌓인다. */
function _fanSlots(n) {
  const maxRot = Math.min(14, 4 * (n - 1));
  const span = n === 1 ? 0 : Math.min(0.56, 0.14 * (n - 1));
  return Array.from({ length: n }, (_, i) => {
    const t = n === 1 ? 0 : (i / (n - 1)) * 2 - 1;   // −1 … +1
    return { cx: 0.5 + (span / 2) * t, cy: 0.5 + 0.06 * t * t, rot: maxRot * t, side: i % 2 ? 'top' : 'bottom', z: i + 1 };
  });
}

/** 시드 난수(mulberry32) — 같은 시드 = 같은 흩뿌림(저장·재그리기·내보내기가 같은 그림). */
export function seededRandom(seed) {
  let a = (Number(seed) >>> 0) || 1;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 장 수가 프리셋과 다를 때(또는 'auto') — 가로로 고르게 · 높낮이 번갈아 · 각도 ± 번갈아 · 쌓임은 시드. */
function _autoSlots(n, rand) {
  const slots = [];
  for (let i = 0; i < n; i++) {
    const cx = n === 1 ? 0.5 : 0.18 + (0.64 * i) / (n - 1);
    const up = i % 2 === 1;
    slots.push({ cx, cy: up ? 0.36 : 0.62, rot: (up ? 1 : -1) * (3 + rand() * 5), side: up ? 'top' : 'bottom', z: 0 });
  }
  const order = slots.map((_, i) => i).sort(() => rand() - 0.5);
  order.forEach((idx, k) => { slots[idx].z = k + 1; });
  return slots;
}

/**
 * 흩뿌린 콜라주 배치.
 * @param {{n?:number, width?:number, sheetW?:number, preset?:string, seed?:number, jitter?:number, lineLen?:number, labelH?:number, pad?:number}} o
 *   sheetW = 종이 폭(블럭 폭 비율 0.2~0.45) · jitter = 흩뿌림 정도(0~1 · 프리셋 위에 시드 흔들림) · lineLen 지시선 길이(px) · labelH 글 덩이 높이(px)
 *   labels = false 면 높이에 글 덩이 자리를 안 넣는다(콜아웃 끔)
 * @returns {{height:number, sheets:Array<{i,cx,cy,w,h,rot,z,side, line:{x,y1,y2}, label:{x,y,anchor:'top'|'bottom'}}>}}
 *   label.y = 글 덩이의 «지시선에 붙는 쪽» y(side top → 덩이 아래끝 · bottom → 덩이 위끝) · 모든 좌표는 높이 계산 뒤 위로 당겨 0 부터.
 */
export function collageLayout(o = {}) {
  const n = Math.max(1, Math.min(CERT_MAX_SHEETS, Math.round(o.n ?? 4)));
  const width = Math.max(200, o.width ?? 600);
  const sheetW = Math.max(0.2, Math.min(0.45, o.sheetW ?? 0.32));
  const jitter = Math.max(0, Math.min(1, o.jitter ?? 0));
  const lineLen = Math.max(16, o.lineLen ?? 56);
  const labelH = Math.max(20, o.labelH ?? 52);
  const pad = Math.max(0, o.pad ?? 12);
  const rand = seededRandom(o.seed ?? 1);
  const preset = o.preset ?? 'fan';
  const base = CERT_PRESETS[preset];
  const slots = preset === 'fan' ? _fanSlots(n) : (base && base.length === n) ? base.map((s) => ({ ...s })) : _autoSlots(n, rand);

  const w = width * sheetW;
  const h = w * CERT_SHEET_RATIO;
  const band = h * 1.6;   // 중심이 오르내리는 밴드 높이 — S17 은 종이 높이의 약 1.5~1.7배
  const sheets = slots.map((s, i) => {
    const jx = jitter ? (rand() - 0.5) * 0.12 * jitter : 0;
    const jy = jitter ? (rand() - 0.5) * 0.18 * jitter : 0;
    const jr = jitter ? (rand() - 0.5) * 10 * jitter : 0;
    const cx = Math.max(w / 2, Math.min(width - w / 2, (s.cx + jx) * width));
    const cy = (s.cy + jy) * band;
    const rot = s.rot + jr;
    // 회전한 종이의 위·아래 끝(세로 지시선이 닿는 자리) — 가운데 세로선 위에서 잰다: h/2 ÷ cos
    const half = (h / 2) / Math.cos((rot * Math.PI) / 180);
    const top = cy - half, bottom = cy + half;
    const side = s.side === 'top' ? 'top' : 'bottom';
    const line = side === 'top' ? { x: cx, y1: top + 4, y2: top - lineLen } : { x: cx, y1: bottom - 4, y2: bottom + lineLen };
    const label = { x: cx, y: side === 'top' ? line.y2 - 6 : line.y2 + 6, anchor: side };
    return { i, cx, cy, w, h, rot, z: s.z || i + 1, side, line, label };
  });
  // 높이 = 종이(회전 감안 바깥 상자) · 지시선 · 글 덩이 모두 들어가게 → 위로 당겨 0 부터
  let minY = Infinity, maxY = -Infinity;
  for (const s of sheets) {
    const r = Math.abs((s.rot * Math.PI) / 180);
    const ext = (s.w / 2) * Math.sin(r) + (s.h / 2) * Math.cos(r);
    const lab = o.labels !== false;   // 콜아웃을 안 그리면(A4 스택 기본) 글 자리를 높이에 안 넣는다
    minY = Math.min(minY, s.cy - ext, lab && s.side === 'top' ? s.label.y - labelH : Infinity);
    maxY = Math.max(maxY, s.cy + ext, lab && s.side === 'bottom' ? s.label.y + labelH : -Infinity);
  }
  const dy = pad - minY;
  for (const s of sheets) { s.cy += dy; s.line.y1 += dy; s.line.y2 += dy; s.label.y += dy; }
  return { height: Math.ceil(maxY - minY + pad * 2), sheets };
}

/** 스캔 그리드(CB2) — 열 수·간격·캡션 높이 → 칸 자리. */
export function gridLayout({ n = 4, width = 600, cols = 4, gap = 16, captionH = 52 } = {}) {
  const c = Math.max(1, Math.min(CERT_MAX_SHEETS, Math.round(cols)));
  const g = Math.max(0, gap);
  const cnt = Math.max(1, Math.min(CERT_MAX_SHEETS, Math.round(n)));
  const w = (width - g * (c - 1)) / c;
  const h = w * CERT_SHEET_RATIO;
  const rowH = h + captionH + g;
  const cells = [];
  for (let i = 0; i < cnt; i++) {
    const r = Math.floor(i / c), k = i % c;
    const inRow = Math.min(c, cnt - r * c);
    const off = ((c - inRow) * (w + g)) / 2;   // 마지막 줄이 덜 차면 가운데로
    cells.push({ i, x: off + k * (w + g), y: r * rowH, w, h });
  }
  return { height: Math.ceil(Math.ceil(cnt / c) * rowH - g), cells };
}
