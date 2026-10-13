/* 버즈(1012t1Z5) — 배치 규칙. 순수 함수뿐이다(DOM 0 · 전역 0 · import 0).
   난수는 «인자 rng»(() => [0,1))로만 받는다 — 같은 rng 수열 + 같은 입력 = 같은 출력.
   (부르는 쪽 js/blocks/buzz-frame.js 가 js/fx/seeded-random.js 의 FxSeed.mulberry32 를 넘긴다. PRNG 사본을 두지 않는다.)

   ★프레임 높이(stageH)는 «주어진 값»이다. 여기 함수들은 높이를 정하지 않고 그 안에 맞춘다:
     흩어짐 = 세로 간격을 줄이거나(겹침 허용) 최대 BUZZ_STRETCH_MAX 배까지 벌린다 · 남으면 가운데
     스택   = 간격을 min(설정 간격, 들어가는 간격)으로 — 음수면 겹친다 · 남으면 가운데
   낱개 «크기»는 줄이지 않는다(낱개는 진짜 모달이고, 크기는 사용자가 낱개 패널에서 정한 값이다).
   stageH 를 안 주면(유한수가 아니면) 맞춤 없이 자연 배치와 그 높이(natural)만 돌려준다 — 삽입 때 처음 높이를 재는 길. */

export const BUZZ_MARGIN = 30;        /* 프레임 가장자리와 말풍선 사이 */
export const BUZZ_STRETCH_MAX = 1.5;  /* 흩어짐: 프레임이 남을 때 세로를 벌리는 상한(배) */
export const BUZZ_TAIL_ROOM = 20;     /* 스택: 꼬리가 있을 때 밑에 남기는 자리 */

const _num = (v, d) => (Number.isFinite(v) ? v : d);
const _sinOf = (tilt) => Math.sin(Math.max(0, Number(tilt) || 0) * Math.PI / 180);
const _maxW = (sizes) => sizes.reduce((m, s) => Math.max(m, s.w), 0);

function _shuffle(rng, n) {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

/**
 * 흩어짐 — 위→아래로 좌/우 차선을 번갈아 놓는다.
 * @param {object} o
 * @param {() => number} o.rng
 * @param {{w:number,h:number}[]} o.sizes  실측 크기(레이아웃 px — 배율과 무관)
 * @param {number} o.stageW
 * @param {number} [o.stageH]  프레임 높이. 유한수가 아니면 맞춤을 건너뛴다
 * @param {number} [o.margin=BUZZ_MARGIN]
 * @param {number} [o.spread=60]  0~100
 * @param {number} [o.tilt=0]     deg — 기울면 모서리가 위아래로 더 나가는 만큼 여백을 늘린다
 * @param {boolean} [o.overlap=true]
 * @param {number} [o.padY=20]    겹침 띠의 상한(글이 아니라 패딩끼리 겹치게)
 * @returns {{items:{x:number,y:number,z:number}[], natural:number, squeezed:boolean}}
 */
export function scatterLayout(o) {
  const sizes = o.sizes || [];
  const n = sizes.length;
  const rng = o.rng;
  const stageW = Number(o.stageW) || 860;
  const margin = _num(o.margin, BUZZ_MARGIN);
  const s = Math.max(0, Math.min(100, _num(o.spread, 60))) / 100;
  const overlap = o.overlap !== false;
  const padY = _num(o.padY, 20);
  const order = _shuffle(rng, n);
  const zOrder = _shuffle(rng, n);
  const sin = _sinOf(o.tilt);
  const extra = Math.round(_maxW(sizes) * 0.5 * sin);
  const top = margin + extra;
  const xs = new Array(n), ys = new Array(n);
  let y = top;
  let bottom = top;
  for (let rank = 0; rank < n; rank++) {
    const idx = order[rank];
    const { w, h } = sizes[idx];
    const free = Math.max(0, stageW - w - 2 * margin);
    const r = rng();
    xs[idx] = (rank % 2 === 0) ? margin + r * free * 0.45 * s : margin + free * (1 - r * 0.45 * s);
    ys[idx] = y;
    bottom = Math.max(bottom, y + h);
    const r2 = rng();
    const ov = overlap ? r2 * Math.min(padY * 0.9, h * 0.25) : -(8 + r2 * 16);
    y += h - ov + w * sin * 0.5;
  }
  const natural = Math.round(bottom + margin + extra);
  let squeezed = false;
  if (Number.isFinite(o.stageH)) {
    const bot = o.stageH - margin - extra;
    const avail = bot - top;
    let cand = Infinity;
    for (let i = 0; i < n; i++) {
      if (sizes[i].h > avail) { squeezed = true; continue; }
      if (ys[i] > top) cand = Math.min(cand, (avail - sizes[i].h) / (ys[i] - top));
    }
    if (natural > o.stageH) squeezed = true;                    /* 자연 배치가 안 들어간다 = 줄여 놓았다 */
    const k = Number.isFinite(cand) ? Math.max(0, Math.min(BUZZ_STRETCH_MAX, cand)) : 1;
    let low = -Infinity;
    for (let i = 0; i < n; i++) {
      const yy = Math.round(top + (ys[i] - top) * k);
      ys[i] = Math.max(top, Math.min(yy, bot - sizes[i].h));   /* 프레임보다 큰 낱개는 top(머리가 보인다) */
      low = Math.max(low, ys[i] + sizes[i].h);
    }
    const rest = bot - low;
    if (n && rest > 0) { const d = Math.floor(rest / 2); for (let i = 0; i < n; i++) ys[i] += d; }
  }
  const items = sizes.map(({ w }, i) => ({
    x: Math.round(Math.max(0, Math.min(stageW - w, xs[i]))),
    y: Math.round(ys[i]),
    z: zOrder[i] + 1,
  }));
  return { items, natural, squeezed };
}

/**
 * 스택 — 세로로 쌓고 짝/홀을 ∓offset/2 로 엇갈린다. 아래 것이 위 것을 덮는다(z = 순서) · topFirst 면 반대.
 * @returns {{items:{x:number,y:number,z:number}[], natural:number, gapEff:number, squeezed:boolean}}
 */
export function stackLayout(o) {
  const sizes = o.sizes || [];
  const n = sizes.length;
  const stageW = Number(o.stageW) || 860;
  const margin = _num(o.margin, BUZZ_MARGIN);
  const offset = Number(o.offset) || 0;
  const gap = _num(o.gap, 28);
  const tailRoom = Number(o.tailRoom) || 0;
  const topFirst = !!o.topFirst;   /* 위 것이 아래 것을 덮는다 — 꼬리가 있을 때(겹쳐도 위 말풍선의 꼬리가 보이게) */
  const extra = Math.round(_maxW(sizes) * 0.5 * _sinOf(o.tilt));
  const top = margin + extra;
  const sumH = sizes.reduce((m, s) => m + s.h, 0);
  const natural = Math.round(top + sumH + Math.max(0, n - 1) * gap + margin + extra + tailRoom);
  let gapEff = gap;
  let shift = 0;
  let bot = Infinity;
  if (Number.isFinite(o.stageH)) {
    bot = o.stageH - margin - extra - tailRoom;
    const avail = bot - top;
    if (n > 1) gapEff = Math.min(gap, (avail - sumH) / (n - 1));
    const rest = avail - (sumH + Math.max(0, n - 1) * gapEff);
    if (rest > 0) shift = Math.floor(rest / 2);
  }
  let y = top + shift;
  const items = sizes.map(({ w, h }, i) => {
    const x = Math.round(Math.max(0, Math.min(stageW - w, (stageW - w) / 2 + (i % 2 ? offset / 2 : -offset / 2))));
    const yy = Math.max(top, Math.min(y, bot - h));            /* 프레임보다 큰 낱개는 top */
    y += h + gapEff;
    return { x, y: Math.round(yy), z: topFirst ? n - i : i + 1 };
  });
  return { items, natural, gapEff, squeezed: gapEff < gap - 1e-6 };
}

/**
 * 새 낱개 하나의 자리 — 프레임 «안»에서 tries 번 뽑아 이웃과 겹친 넓이가 가장 작은 것(같으면 먼저 뽑은 것).
 * @param {object} o
 * @param {{w:number,h:number}} o.size
 * @param {{x:number,y:number,w:number,h:number}[]} [o.others]
 * @returns {{x:number,y:number}}
 */
export function pickSpot(o) {
  const { w, h } = o.size;
  const others = o.others || [];
  const rng = o.rng;
  const stageW = Number(o.stageW) || 860;
  const stageH = Number(o.stageH) || 0;
  const margin = _num(o.margin, BUZZ_MARGIN);
  const tries = Math.max(1, Math.round(_num(o.tries, 12)));
  const x0 = margin, x1 = stageW - margin - w;
  const y0 = margin, y1 = stageH - margin - h;
  let best = null;
  let bestCost = Infinity;
  for (let t = 0; t < tries; t++) {
    const rx = rng(), ry = rng();
    const x = Math.round(x1 >= x0 ? x0 + rx * (x1 - x0) : (stageW - w) / 2);
    const y = Math.round(y1 >= y0 ? y0 + ry * (y1 - y0) : margin);
    let cost = 0;
    for (const b of others) {
      const ox = Math.min(x + w, b.x + b.w) - Math.max(x, b.x);
      const oy = Math.min(y + h, b.y + b.h) - Math.max(y, b.y);
      if (ox > 0 && oy > 0) cost += ox * oy;
    }
    if (cost < bestCost) { bestCost = cost; best = { x, y }; }
  }
  return best;
}

/**
 * 회전 = (방향 부호 × 각도) + 범위 안 무작위. 모달의 회전은 정수다(js/blocks/modal-block.js 가 parseInt 로 읽는다).
 * @param {object} o
 * @param {number[]} o.tops  낱개의 y(낱개 순서) — 「번갈아」는 위→아래 순위로 부호를 바꾼다
 * @param {'alt'|'one'|'rand'} [o.dir='alt']
 * @returns {number[]} 낱개 순서의 정수 deg
 */
export function buzzRotations(o) {
  const tops = o.tops || [];
  const rng = o.rng;
  const angle = Number(o.angle) || 0;
  const range = Number(o.range) || 0;
  const dir = o.dir;
  const order = tops.map((_, i) => i).sort((a, b) => (tops[a] - tops[b]) || (a - b));
  const rank = new Array(tops.length);
  order.forEach((idx, r) => { rank[idx] = r; });
  return tops.map((_, i) => {
    const r1 = rng(), r2 = rng();
    const sign = dir === 'one' ? 1 : dir === 'rand' ? (r1 < 0.5 ? -1 : 1) : (rank[i] % 2 ? -1 : 1);
    return Math.round(sign * angle + (r2 * 2 - 1) * range) || 0;   /* || 0 = −0 을 0 으로 */
  });
}

/**
 * 깊이 단계 — z 가 낮은(뒤쪽) 것부터 삼등분해 2(멀다) · 1 · 0(앞).
 * @param {number[]} zs 낱개 순서의 z
 * @returns {number[]} 낱개 순서의 0|1|2
 */
export function depthTiers(zs) {
  const order = zs.map((_, i) => i).sort((a, b) => (zs[a] - zs[b]) || (a - b));
  const third = Math.floor(zs.length / 3);
  const out = new Array(zs.length).fill(0);
  order.forEach((idx, i) => { out[idx] = i < third ? 2 : i < third * 2 ? 1 : 0; });
  return out;
}
