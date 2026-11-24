// liner-transform.js — 라이너(곡선) 텍스트: SVG textPath로 텍스트를 path를 따라 휘게 함
// text-effect-transform.js 동형 구조 — apply / ensure / MutationObserver / window 전역
//
// 렌더 모델:
//   .text-block.liner-block (data-type="liner", data-liner JSON {preset,curvature})
//     ├─ .tb-liner[contenteditable]  ← 편집 미러 div (텍스트 SSOT, 평소 숨김 / 편집중만 노출)
//     └─ svg.lnr-svg
//          └─ <defs><path id="liner-path-{blockId}" d="..."/></defs>
//          └─ <text><textPath href="#liner-path-{blockId}">텍스트</textPath></text>
//
// 곡률/프리셋/폭/폰트는 미러 div에서 읽어 SVG로 매핑한다. innerHTML 직렬화로 자동 round-trip,
// 로드 후 ensureLiner가 path id / d / 폰트를 재계산한다.

const LINER_PRESETS = [
  { value: 'round',    label: '둥글게 (글 기준)' },   // LINETEXT-ARC «기본 둥글게»(현빈 261121 · 지디 추천) — 위로 아치 · 반지름을 비우면 글이 호 약 120° 가 되게 글 길이에 맞춰 저절로
  { value: 'arc-up',   label: 'Arc Up (위로 아치)' },
  { value: 'arc-down', label: 'Arc Down (아래 오목)' },
  { value: 'wave',     label: 'Wave (물결)' },
  { value: 'circle',   label: '원형' }
];

const LINER_DEFAULTS = {
  preset:        'arc-up',
  curvature:     50,        // 0~100
  letterSpacing: 0,         // px, 자연 자간에 더하는 추가 자간 (음수 가능)
  startAngle:    0,         // 0~360°, 텍스트 시작(회전) 위치. 0=기본(circle 12시 중앙 / arc·wave 중앙)
  /* LINETEXT-ARC-RESEARCH-01(현빈 261121 발주2 #4 · 비교표 handoff/LINER-ARC-COMPARE-261121.md) — 기본값이면 dataset 에 안 씀(옛 저장본 바이트 무변) */
  radius:        0,         // px · 0=자동(옛 «블럭 폭» 곡률) · >0 이면 arc-up/arc-down 이 그 반지름 원 위에 글 길이만큼(반원 넘는 호 · 피그마 ARC 와 같은 «글 기준» 휨)
  flip:          false,     // 원 안쪽 뒤집기 — circle·반지름 모드에서 경로 방향을 거꾸로(글자가 원 안쪽을 향함)
  strokeColor:   '',        // 외곽선 색 #rrggbb · '' = 없음
  strokeWidth:   0          // 외곽선 두께 px 0~20 · 0 = 없음
};
const LINER_RADIUS_MAX = 2000, LINER_STROKE_MAX = 20;
const LINER_ROUND_DEG = 120;   // «둥글게»·아치 자동 반지름 — 글이 원을 이만큼 돌게
/** 글 길이(px) → 그 글이 원을 LINER_ROUND_DEG 만큼 돌게 하는 반지름(px · 정수 · 8 이상). */
const linerAutoRadius = (textLen) => Math.max(8, Math.round((Number(textLen) || 0) / (LINER_ROUND_DEG * Math.PI / 180)));
const normRadius = (x) => { const n = Math.round(Number(x)); return Number.isFinite(n) && n > 0 ? Math.min(LINER_RADIUS_MAX, n) : 0; };
const normStrokeWidth = (x) => { const n = Number(x); return Number.isFinite(n) && n > 0 ? Math.min(LINER_STROKE_MAX, Math.round(n * 2) / 2) : 0; };
const normStrokeColor = (x) => (typeof x === 'string' && /^#[0-9a-f]{6}$/i.test(x) ? x.toLowerCase() : '');

/* 원 위 경로(반지름 모드 · circle 뒤집기) — 글 가운데(startOffset 50%)가 위(down=false) 또는 아래(down=true)에 온다.
 *   위·바로: 6시 시작 시계방향 → 12시 = 50% · 좌→우 · 글자 바깥쪽(옛 circle 과 같은 길)
 *   아래·바로: 12시 시작 반시계 → 6시 = 50% · 좌→우 · 글자 안쪽(arc-down 과 같은 바로 섬)
 *   flip = 같은 시작점에서 방향만 거꾸로(글이 원의 반대편 면으로 — «안쪽 뒤집기»). */
function buildRadiusPathD(cx, cy, r, down, flip) {
  const sweep = (down ? 0 : 1) ^ (flip ? 1 : 0);
  const sy = down ? cy - r : cy + r, ey = down ? cy + r : cy - r;
  return `M ${cx},${sy} A ${r},${r} 0 1 ${sweep} ${cx},${ey} A ${r},${r} 0 1 ${sweep} ${cx},${sy}`;
}

const LINER_PAD = 12;     // 좌우 패딩 P (글자 잘림 방지)
const LINER_BASE_H = 80;  // 기본 블록/뷰박스 높이

// 자간 슬라이더 범위 (px)
const LINER_LS_MIN = -2;
const LINER_LS_MAX = 20;

// 자간 정규화 — NaN은 0
function normLetterSpacing(x) {
  const n = Number(x);
  if (!Number.isFinite(n)) return 0;
  return Math.max(LINER_LS_MIN, Math.min(LINER_LS_MAX, n));
}

// 곡률 정규화 — NaN/비유한값은 기본값(50)으로 (m7)
function normCurvature(x) {
  const n = Number(x);
  if (!Number.isFinite(n)) return LINER_DEFAULTS.curvature;
  return Math.max(0, Math.min(100, n));
}

// 시작각(회전) 정규화 — 0~360 wrap. NaN은 0.
function normStartAngle(x) {
  let n = Number(x);
  if (!Number.isFinite(n)) return 0;
  n = n % 360;
  if (n < 0) n += 360;
  return n;
}

// startAngle(0~360°) → textPath startOffset(%) 계산.
//   circle: 기본 12시 중앙 = 둘레의 50%. 시계방향으로 startAngle 만큼 회전.
//     path는 6시 시작, 시계방향 진행이므로 (angle/360) 비율만큼 더하면 시계방향 회전.
//     0°=50%(12시), 90°=75%(3시), 180°=100%≡0%(6시), 270°=25%(9시).
//   arc/wave: 기본 중앙 50%. startAngle/360 비율만큼 path 길이를 따라 이동(보정).
function linerStartOffsetPct(preset, startAngle) {
  const a = normStartAngle(startAngle);
  let pct = 50 + (a / 360) * 100;   // 중앙(50%) 기준 회전/이동
  pct = ((pct % 100) + 100) % 100;  // 0~100 wrap
  return pct;
}

// 색 문자열이 투명(transparent / alpha=0)인지 판정 (M1)
function isTransparentColor(c) {
  if (!c) return true;
  const v = String(c).trim().toLowerCase();
  if (v === 'transparent' || v === 'none') return true;
  // rgba(...,0) / rgba(...,0.0) 형태의 alpha=0 감지
  const m = v.match(/^rgba?\(([^)]+)\)$/);
  if (m) {
    const parts = m[1].split(',').map(s => s.trim());
    if (parts.length === 4 && parseFloat(parts[3]) === 0) return true;
  }
  return false;
}

// SVG <text> fill 색 결정 — 미러 inline style.color 우선, 비었거나 transparent면 기본색 fallback (M1)
function resolveLinerFill(mirror, cs) {
  const inline = (mirror.style.color || '').trim();
  if (inline && !isTransparentColor(inline)) return inline;
  const computed = (cs && cs.color) || '';
  if (computed && !isTransparentColor(computed)) return computed;
  return '#111111';
}

// ── arc(arc-up/arc-down) sagitta 매핑 ──
// 곡률 → 가용 폭(availW = W - 2P) 비례 sagitta(s = 호의 실제 솟음/꺼짐 높이).
// 곡률 0 = 직선(s=0), **곡률 100 = 정확한 반원(s = availW/2, 반지름 r = availW/2)**.
// arc-up/arc-down은 Q(포물선) 대신 SVG arc(A 커맨드)로 진짜 원호를 그려 꼭대기가 둥글다.
function linerArcSagitta(curvature, availW) {
  const w = (Number.isFinite(availW) && availW > 0) ? availW : (LINER_BASE_H * 2);
  return (normCurvature(curvature) / 100) * (w / 2);  // 100 → w/2 = 반원
}

// sagitta s + 현(=availW) chord 로부터 원호 반지름 r 환산: r = (s² + (c/2)²) / (2s).
// s = c/2(반원)일 때 r = c/2. s→0이면 r→∞(직선).
function linerArcRadius(sagitta, chord) {
  const s = sagitta, half = chord / 2;
  if (!(s > 0)) return Infinity;
  return (s * s + half * half) / (2 * s);
}

// wave 진폭(폭 비례). wave는 Q곡선 유지 → 제어점 오프셋 k(렌더 진폭 = k/2).
const LINER_WAVE_SCALE = 0.5;
function linerAmplitude(curvature, availW, scale) {
  const w = (Number.isFinite(availW) && availW > 0) ? availW : (LINER_BASE_H * 2);
  const s = (scale != null) ? scale : LINER_WAVE_SCALE;
  return (normCurvature(curvature) / 100) * w * s;
}

// ── path d 생성 공식 (viewBox 0 0 W H, 좌우 패딩 P, 베이스라인 cy, 진폭 k) ──
// arc-up/arc-down: k = sagitta(s, 호 솟음 높이). wave: k = Q 제어점 오프셋. circle: k = 반지름 r.
// cy/k를 caller가 명시(폰트 ascent 여유 반영). 미지정 시 옛 동작(H/2 기준)으로 fallback.
function buildLinerPathD(preset, curvature, W, H, P, cy, k) {
  const c = normCurvature(curvature);
  if (cy == null) cy = H / 2;
  const x0 = P, x1 = W - P;
  const chord = x1 - x0;
  if (preset === 'circle') {
    // 풀 원형: <circle>은 textPath 못 받으니 두 개의 A(arc)로 360°.
    // 시작점 = 최하단(6시) (cx, cy+r). 시계방향(sweep=1)으로 왼쪽→상단→오른쪽→하단 복귀.
    // ⇒ 최상단(12시)이 둘레의 정확히 50% 지점에 위치 → startOffset='50%' + text-anchor=middle 로
    //    텍스트 중앙이 12시에 오고, 좌우로 자연스럽게 감김(짧으면 상단 호만 차지).
    // caller가 cy=원 중심 y, k=반지름 r 로 전달.
    const cx = W / 2;
    const r = (k != null) ? k : (Math.min(W - 2 * P, H) / 2);
    const botX = cx, botY = cy + r;
    const topX = cx, topY = cy - r;
    // 하단 → (왼쪽 반원) 상단 → (오른쪽 반원) 하단. sweep-flag=1(시계방향).
    return `M ${botX},${botY} A ${r},${r} 0 1 1 ${topX},${topY} A ${r},${r} 0 1 1 ${botX},${botY}`;
  }
  if (c === 0) {
    return `M ${x0},${cy} L ${x1},${cy}`;
  }
  if (preset === 'arc-up' || preset === 'arc-down') {
    // 진짜 원호: k = sagitta(s). r = (s² + (chord/2)²)/(2s). 곡률100 → s=chord/2 → 반원.
    const s = (k != null) ? k : linerArcSagitta(c, chord);
    if (!(s > 0)) return `M ${x0},${cy} L ${x1},${cy}`;
    const r = linerArcRadius(s, chord);
    // y-down 좌표계: 시작(x0,cy)→끝(x1,cy), large-arc=0(소호).
    //   arc-up(위로 볼록): 꼭대기가 위(작은 y) → sweep-flag=1
    //   arc-down(아래로 오목): 바닥이 아래(큰 y) → sweep-flag=0
    // (좌→우 진행에서 sweep=1 이 곡선을 위로 솟게 함 — 실측 검증)
    const sweep = (preset === 'arc-up') ? 1 : 0;
    return `M ${x0},${cy} A ${r},${r} 0 0 ${sweep} ${x1},${cy}`;
  }
  // wave: sine 1주기 — Q...T 대칭 파동 (k = 제어점 오프셋)
  if (k == null) k = (c / 100) * (H * 0.45);
  return `M ${x0},${cy} Q ${W / 4},${cy - k} ${W / 2},${cy} T ${x1},${cy}`;
}

// 미러 div(.tb-liner) 찾기
function findLinerMirror(block) {
  return block.querySelector('.tb-liner');
}

// 미러 div의 현재 텍스트 (placeholder 상태면 placeholder 문구)
function readLinerText(mirror) {
  if (!mirror) return '';
  const t = (mirror.textContent || '').trim();
  if (!t) return mirror.dataset.placeholder || '';
  return t;
}

// 블록 id 보장 — 없으면 즉시 발급 (m8: 'unknown' path id 공유 방지)
function ensureBlockId(block) {
  if (!block.id) {
    block.id = window.genId ? window.genId('lnr') : 'lnr_' + Math.random().toString(36).slice(2, 9);
  }
  return block.id;
}

// path id 보장 — 블록 id 기준 (복제/복원 시 충돌 회피)
function linerPathId(block) {
  return 'liner-path-' + ensureBlockId(block);
}

// 미러 div → SVG textPath 텍스트 동기화
function applyLinerText(block) {
  if (!block) return;
  const svg = block.querySelector('svg.lnr-svg');
  const mirror = findLinerMirror(block);
  if (!svg || !mirror) return;
  const tp = svg.querySelector('textPath');
  if (tp) tp.textContent = readLinerText(mirror);
}

function applyLiner(block, opts) {
  if (!block) return;
  ensureBlockId(block); // m8: id 없으면 즉시 발급
  const mirror = findLinerMirror(block);
  const svg = block.querySelector('svg.lnr-svg');
  if (!mirror || !svg) return;

  const prev = (() => { try { return JSON.parse(block.dataset.liner || '{}'); } catch (e) { return {}; } })();
  const cfg = { ...LINER_DEFAULTS, ...prev, ...(opts || {}) };
  cfg.curvature     = normCurvature(cfg.curvature);          // m7: NaN → 기본값
  cfg.letterSpacing = normLetterSpacing(cfg.letterSpacing);  // #1: 자간 정규화
  cfg.startAngle    = normStartAngle(cfg.startAngle);        // 시작각(회전) 정규화
  cfg.radius        = normRadius(cfg.radius);
  cfg.flip          = cfg.flip === true || cfg.flip === 'true';
  cfg.strokeColor   = normStrokeColor(cfg.strokeColor);
  cfg.strokeWidth   = normStrokeWidth(cfg.strokeWidth);

  // 사용자 폰트크기 = "원하는 최대치" (#3) — 미러 inline style 우선, 없으면 computed
  const csEarly = window.getComputedStyle(mirror);
  // m2: parseInt 가드 — 유한·양수만 채택, 상한 클램프, 아니면 fallback 체인
  const LINER_FONT_MAX = 800;
  const safeFontPx = (x, fb) => {
    const n = parseInt(x);
    return (Number.isFinite(n) && n > 0) ? Math.min(n, LINER_FONT_MAX) : fb;
  };
  const userFontPx = safeFontPx(mirror.style.fontSize, safeFontPx(csEarly.fontSize, 28));

  // 폭: 블록(미러) 실측 폭 — 0이면 fallback
  const W = Math.max(120, Math.round(mirror.offsetWidth || block.offsetWidth || 600));
  let P = LINER_PAD;   // 가로 지킴이(아래)가 끝 글자 잘림을 막으려 늘릴 수 있다
  const pid = linerPathId(block);

  // 폰트/색 — 미러 div style/computed에서 복사 (단일 소스 = 미러)
  const cs = csEarly;
  const fontFamily = mirror.style.fontFamily || cs.fontFamily || "'Pretendard', sans-serif";
  const fontWeight = mirror.style.fontWeight || cs.fontWeight || '400';
  const fontStyle  = mirror.style.fontStyle || cs.fontStyle || 'normal';
  const fill       = resolveLinerFill(mirror, cs);
  // M6a: 라이너 자간 단일소스 = 우리 슬라이더(dataset.liner.letterSpacing).
  // opts/dataset에 명시 없으면 미러 inline style.letterSpacing → 0 폴백.
  let ls = (opts && opts.letterSpacing != null) ? cfg.letterSpacing
         : (prev && prev.letterSpacing != null) ? cfg.letterSpacing
         : null;
  if (ls == null) {
    const mls = parseFloat(mirror.style.letterSpacing);
    ls = Number.isFinite(mls) ? normLetterSpacing(mls) : (cfg.letterSpacing || 0);
  }
  ls = normLetterSpacing(ls);
  cfg.letterSpacing = ls; // dataset 저장값과 일치

  // defs / path / text 보장
  let defs = svg.querySelector('defs');
  if (!defs) { defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs'); svg.insertBefore(defs, svg.firstChild); }
  let path = defs.querySelector('path');
  if (!path) { path = document.createElementNS('http://www.w3.org/2000/svg', 'path'); defs.appendChild(path); }
  let textEl = svg.querySelector('text');
  if (!textEl) { textEl = document.createElementNS('http://www.w3.org/2000/svg', 'text'); svg.appendChild(textEl); }
  let tp = textEl.querySelector('textPath');
  if (!tp) { tp = document.createElementNS('http://www.w3.org/2000/svg', 'textPath'); textEl.appendChild(tp); }

  // textPath href / 공통 텍스트 속성 (측정 전에 세팅)
  const startPct = linerStartOffsetPct(cfg.preset, cfg.startAngle); // 시작각 → startOffset%
  tp.setAttribute('href', '#' + pid);
  tp.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', '#' + pid);
  tp.setAttribute('startOffset', startPct + '%');
  textEl.setAttribute('text-anchor', 'middle');
  textEl.setAttribute('font-family', fontFamily);
  textEl.setAttribute('font-weight', fontWeight);
  textEl.setAttribute('font-style', fontStyle);
  textEl.setAttribute('fill', fill);
  textEl.setAttribute('letter-spacing', String(ls));
  if (cfg.strokeWidth > 0 && cfg.strokeColor) {   // 외곽선 — 칠 뒤에 그려 글자 모양을 안 먹는다(paint-order)
    textEl.setAttribute('stroke', cfg.strokeColor); textEl.setAttribute('stroke-width', String(cfg.strokeWidth));
    textEl.setAttribute('stroke-linejoin', 'round'); textEl.setAttribute('paint-order', 'stroke fill');
  } else { ['stroke', 'stroke-width', 'stroke-linejoin', 'paint-order'].forEach((a) => textEl.removeAttribute(a)); }
  // 측정 신뢰성: 항상 자연 자간(stretch 미설정)
  tp.removeAttribute('textLength');
  tp.removeAttribute('lengthAdjust');
  tp.textContent = readLinerText(mirror);

  path.setAttribute('id', pid);
  path.setAttribute('fill', 'none');

  const isCircle = (cfg.preset === 'circle');
  const isRound = cfg.preset === 'round';
  const radiusMode = isRound || ((cfg.preset === 'arc-up' || cfg.preset === 'arc-down') && cfg.radius > 0);
  /* «둥글게» 반지름 = 넣은 값 · 비면 지금 글 길이(사용자 글자 크기)에서 저절로 — 글을 고치면 따라감 */
  let roundAutoR = 0;
  if (isRound && !cfg.radius) { textEl.setAttribute('font-size', String(Math.max(6, userFontPx))); let n0 = 0; try { n0 = tp.getComputedTextLength(); } catch (e) { n0 = 0; } roundAutoR = linerAutoRadius(n0); }
  /* 경로 d 한 자리 — 반지름 모드·circle 뒤집기는 원 경로, 그 밖은 옛 buildLinerPathD 그대로 */
  const buildD = (Hx, cyx) => (radiusMode ? buildRadiusPathD(W / 2, cyx, pathK, cfg.preset === 'arc-down', cfg.flip)
    : (isCircle && cfg.flip) ? buildRadiusPathD(W / 2, cyx, pathK, false, true)
    : buildLinerPathD(cfg.preset, cfg.curvature, W, Hx, P, cyx, pathK));
  // effFont = userFont 그대로 시작 (곡률→폰트 연동 제거: 곡률 바꿔도 글자크기 불변).
  // 가로 넘칠 때만 아래 fit-to-width 루프가 줄인다.
  let effFont = Math.max(6, userFontPx);

  const LINER_FONT_FLOOR = 6;
  const LINER_FIT_ITERS  = 5;   // M4b: 최대 반복 축소 횟수

  let cy, H, pathK;
  let flipTopR = 0, flipA = 0;   // 안쪽 뒤집기 — 윗변 반지름(사용자 r) · 글자 높이(밀어낸 만큼) ⇒ 아래 자간 보탬

  // 현재 effFont 기준으로 path d를 SVG에 쓰고(write) → 그 path에서 길이를 측정(measure).
  // M4a: 측정 전에 반드시 현재 프리셋 path를 써서, 프리셋 전환 시 이전 path 길이 오측정 제거.
  // 반환: { avail, natural } — avail=path 가용 길이, natural=텍스트 자연 길이.
  const writeAndMeasure = () => {
    if (isCircle) {
      // M4c: circle 반지름/ascent/원 중심을 "현재(축소된) effFont" 기준으로 재계산.
      const ascent = effFont * 0.78;
      const sizeScale = 1 - (normCurvature(cfg.curvature) / 100) * 0.40; // 1.0 ~ 0.60
      const maxR = (W - 2 * P) / 2 - ascent;
      const r = Math.max(8, maxR * sizeScale);
      H = W;                       // 정사각형
      cy = Math.round(H / 2);      // 원 중심 = 블록 중앙
      if (cfg.flip) { flipTopR = r; flipA = ascent; }
      pathK = r + (cfg.flip ? ascent : 0);   // 안쪽 뒤집기 — 글 위쪽이 중심을 향하니 경로를 글자 높이만큼 밀어 윗변이 r 에(겹침 줄임 · 미카사 채점 261121 ④ 안B)
    } else if (radiusMode) {
      // 반지름 모드 — 원(반지름 R) 위에 글 길이만큼. 처음엔 원 전체 상자 · 아래 LINERH 가 글이 덮는 구간으로 높이를 조인다.
      const ascent = effFont * 0.85, descent = effFont * 0.30;
      /* 안쪽 뒤집기(미카사 채점 261121 ④ · 지디 안B «뜻 보존»): 글 위쪽이 원 중심을 향해 윗변이 r−글자높이 원에 모여 작은 반지름에서 겹쳤다
         ⇒ 경로 반지름을 글자 높이만큼 밀어(r+ascent) 윗변이 고른 반지름 r 에 오게 — 윗변 길이 비 (r−a)/r → r/(r+a). 자간 자동 보탬은 다음 판. */
      pathK = (cfg.radius || roundAutoR) + (cfg.flip ? ascent : 0);
      if (cfg.flip) { flipTopR = cfg.radius || roundAutoR; flipA = ascent; }
      cy = Math.round(6 + ascent + pathK);
      H  = Math.round(cy + pathK + descent + 6);
    } else {
      // ── arc/wave: effFont 기준 높이/베이스라인 (#2) ──
      const availW  = W - 2 * P;
      const ascent  = effFont * 0.85;
      const descent = effFont * 0.30;
      const padTop = 6, padBottom = 6;
      if (cfg.preset === 'arc-up' || cfg.preset === 'arc-down') {
        // 진짜 원호. rise = sagitta(s). 곡률100 → s = availW/2 (반원).
        const rise = linerArcSagitta(cfg.curvature, availW);
        if (cfg.preset === 'arc-up') {
          // 위로만 솟음 → 상단에 rise 만큼 여유
          cy = Math.round(padTop + ascent + rise);
          H  = Math.round(cy + descent + padBottom);
        } else {
          // 아래로만 꺼짐 → 하단에 rise 만큼 여유
          cy = Math.round(padTop + ascent);
          H  = Math.round(cy + descent + rise + padBottom);
        }
        pathK = rise;                    // buildLinerPathD arc 분기에 sagitta 전달
      } else {
        // wave: Q곡선 유지. amp = 제어점 오프셋, 렌더 진폭 = amp/2. 양쪽 흔들림.
        const amp  = linerAmplitude(cfg.curvature, availW, LINER_WAVE_SCALE);
        const rise = amp / 2;
        cy    = Math.round(padTop + ascent + rise);
        H     = Math.round(cy + descent + rise + padBottom);
        pathK = amp;
      }
    }
    // write: 현재 프리셋 path d 적용
    path.setAttribute('d', buildD(H, cy));
    // avail: 방금 쓴 path의 실제 길이 (원형=둘레, arc/wave=곡선 호 길이)
    let avail = (isCircle || radiusMode) ? (2 * Math.PI * pathK) : (W - 2 * P);
    try {
      if (path.getTotalLength) { const L = path.getTotalLength(); if (Number.isFinite(L) && L > 0) avail = L; }
    } catch (e) { /* fallback */ }
    // measure: 현재 effFont(+letter-spacing 포함)로 텍스트 자연 길이
    textEl.setAttribute('font-size', String(effFont));
    /* 안쪽 뒤집기 자간 보탬(미카사 재채점 261122 (나)(다)): 경로가 r+a 라 윗변 간격이 r/(r+a) 로 줄어 이웃 획이 맞닿고, 돈 각도 글길이/(r+a) 라 반지름을 바꿔도 꼴이 덜 바뀌었다.
       ⇒ 글자당 평균 폭 × a/r 를 자간에 보탠다 — 윗변 간격 = 자연 폭 · 돈 각 = 글길이/r(뒤집기 끈 때와 같음) · 사용자 자간은 그 위에 그대로. */
    textEl.setAttribute('letter-spacing', String(ls));
    if (flipTopR > 0 && flipA > 0) {
      let n0 = 0, nch = 0; try { n0 = tp.getComputedTextLength(); nch = textEl.getNumberOfChars(); } catch (e) { n0 = 0; }
      if (n0 > 0 && nch > 0) textEl.setAttribute('letter-spacing', String(ls + (n0 / nch) * flipA / flipTopR));
    }
    let natural = 0;
    try {
      if (tp.getComputedTextLength) natural = tp.getComputedTextLength();
      if (!(natural > 0) && textEl.getComputedTextLength) natural = textEl.getComputedTextLength();
    } catch (e) { natural = 0; }
    return { avail, natural };
  };

  // M4b: 반복 수렴 루프 — 넘치면 축소 후 재측정, 수렴(또는 폰트 하한) 시 종료.
  let m, stretchFallback = false;
  const fitAndTighten = () => {
  m = writeAndMeasure();
  let iter = 0;
  while (m.natural > m.avail && m.natural > 0 && effFont > LINER_FONT_FLOOR && iter < LINER_FIT_ITERS) {
    effFont = Math.max(LINER_FONT_FLOOR, effFont * (m.avail / m.natural) * 0.985); // 0.985 안전마진
    m = writeAndMeasure();
    iter++;
  }
  // M4b 폴백: 폰트 하한에 닿고도 여전히 넘치면 textLength=avail + lengthAdjust=spacing 으로 강제 수용.
  stretchFallback = (m.natural > m.avail && m.natural > 0);
  if (stretchFallback) {
    tp.setAttribute('textLength', String(Math.max(1, Math.round(m.avail))));
    tp.setAttribute('lengthAdjust', 'spacing');
  }

  // ── LINERH: arc/wave 타이트 높이 2차 패스 ──
  // 문제: H가 '아치 전체 sagitta'를 예약하지만, 텍스트는 startOffset 50% + anchor=middle 라서
  //   정점 밴드에만 앉음(짧은 텍스트+고곡률일수록 끝점 하강분이 통째로 빈 공간이 됨).
  // 해결: 텍스트가 실제 덮는 패스 구간 [f0,f1]의 베이스라인 y 밴드를 샘플링해 H를 콘텐츠 최소높이로
  //   다시 잡고, cy를 위로 평행이동(shift)해 콘텐츠를 새 박스 상단에 정렬한 뒤 path d를 재작성.
  // circle은 정사각(H=W) 유지 → 스킵. getTotal/getPointAtLength 실패 시 기존 H로 fallback.
  if (!isCircle) {
    try {
      let availPathLen = (W - 2 * P);
      if (path.getTotalLength) {
        const L = path.getTotalLength();
        if (Number.isFinite(L) && L > 0) availPathLen = L;
      }
      // natural: 텍스트 자연 길이. stretch 폴백이 걸린 경우는 glyph가 늘어나 측정이 왜곡되므로
      //   half=0.5(전체 구간)로 안전하게 두어 기존 full-sagitta 수렴을 보장.
      let half = 0.5;
      if (!stretchFallback && Number.isFinite(m.natural) && m.natural > 0 && availPathLen > 0) {
        half = Math.min(0.5, (m.natural / 2) / availPathLen);
      }
      if (!(half > 0)) half = 0; // 빈 텍스트 등 → 밴드 0 (글자 없음)
      const f0 = 0.5 - half, f1 = 0.5 + half;

      // 구간 [f0,f1]을 N등분 샘플 → 베이스라인 y 밴드(min/max)
      const N = 40;
      let minBaseY = Infinity, maxBaseY = -Infinity, sampled = 0;
      if (path.getPointAtLength) {
        for (let i = 0; i <= N; i++) {
          const f = f0 + (f1 - f0) * (i / N);
          const pt = path.getPointAtLength(availPathLen * f);
          if (pt && Number.isFinite(pt.y)) {
            if (pt.y < minBaseY) minBaseY = pt.y;
            if (pt.y > maxBaseY) maxBaseY = pt.y;
            sampled++;
          }
        }
      }
      // half=0(빈 텍스트)이면 정점 1점만 샘플되도록 보강
      if (sampled === 0 && path.getPointAtLength) {
        const pt = path.getPointAtLength(availPathLen * 0.5);
        if (pt && Number.isFinite(pt.y)) { minBaseY = maxBaseY = pt.y; sampled = 1; }
      }

      if (sampled > 0 && Number.isFinite(minBaseY) && Number.isFinite(maxBaseY)) {
        const ascent = effFont * 0.85;
        const descent = radiusMode ? ascent : effFont * 0.30;   // 반지름 모드는 원 아래쪽 글자가 거꾸로·옆으로 서서 아래로도 ascent 만큼 뻗는다(실측: r49 아래 글자 잘림)
        const padTop = 6, padBottom = 6;
        const band = maxBaseY - minBaseY;
        const newH = Math.round(band + ascent + descent + padTop + padBottom);
        // 콘텐츠(minBaseY-ascent ... maxBaseY+descent)를 새 박스 상단(padTop)에 정렬
        const shift = Math.round(padTop + ascent - minBaseY);
        const cyNew = cy + shift;
        if (Number.isFinite(newH) && newH > 0 && Number.isFinite(cyNew)) {
          path.setAttribute('d', buildD(newH, cyNew));
          H = newH;
          cy = cyNew;
        }
      }
    } catch (e) { /* getTotalLength/getPointAtLength 실패 → 기존 H 유지 */ }
  }
  };
  fitAndTighten();

  /* ★가로 지킴이(LINETEXT-ARC 곁 결함 · 비교표 2행) — 글이 덮는 구간의 베이스라인 x 에 글자 높이(ascent)만큼 여유를 두고
   *   상자(0..W) 밖으로 나가면: 옛 곡률 모드 = 좌우 패딩 P 를 넘친 만큼 늘려 다시(호가 좁아짐) · 반지름 모드 = 글자를 줄여 다시.
   *   넓은 블럭(글이 호 가운데)은 넘침 0 ⇒ 아무것도 안 바뀜(옛 결과 그대로). circle(바로)은 정사각 + 반지름에 ascent 를 이미 뺌 ⇒ 건너뜀. */
  if (!(isCircle && !cfg.flip)) {
    for (let g = 0; g < 3; g++) {
      let L = 0; try { L = path.getTotalLength(); } catch (e) { L = 0; }
      if (!(L > 0) || !path.getPointAtLength || !(m.natural > 0)) break;
      const half = Math.min(0.5, (Math.min(m.natural, m.avail) / 2) / L), a = effFont * 0.85 + (cfg.strokeWidth || 0) / 2;
      const c = (L * startPct) / 100;   // 글 가운데 = startOffset
      let minX = Infinity, maxX = -Infinity;
      for (let i = 0; i <= 40; i++) { let at = c + L * half * (2 * i / 40 - 1); at = ((at % L) + L) % L; const pt = path.getPointAtLength(at); if (pt.x < minX) minX = pt.x; if (pt.x > maxX) maxX = pt.x; }
      const over = Math.max(0, a - minX, maxX + a - W);
      if (!(over > 0.5)) break;
      if (radiusMode || isCircle) effFont = Math.max(LINER_FONT_FLOOR, effFont * Math.min(0.95, (W - 2 * a) / Math.max(1, maxX - minX)));
      else P += Math.ceil(over);
      fitAndTighten();
    }
  }

  // viewBox / 크기
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('width', String(W));
  svg.setAttribute('height', String(H));
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

  // path d / font-size 는 writeAndMeasure 루프에서 이미 확정됨.

  // 원형: path 시작점=6시, 12시=둘레 50% 지점. startOffset(시작각 반영) + text-anchor=middle
  // ⇒ 텍스트 중앙이 12시(기본)에 오고, startAngle 만큼 시계방향 회전. arc/wave도 동일 보정.
  tp.setAttribute('startOffset', startPct + '%');

  // 블록/섹션 차지 높이 동기 (#2: 위 콘텐츠와 겹침/잘림 방지)
  block.style.minHeight = H + 'px';

  // dataset 저장 (autoSave가 outerHTML 직렬화 → data-* 보존). 사용자 폰트크기는 미러가 보존, 여기엔 effFont 미저장.
  const out = { preset: cfg.preset, curvature: cfg.curvature, letterSpacing: cfg.letterSpacing, startAngle: cfg.startAngle };
  if (cfg.radius) out.radius = cfg.radius;            // LINETEXT-ARC — 기본값은 안 씀(옛 바이트 그대로)
  if (cfg.flip) out.flip = true;
  if (cfg.strokeWidth && cfg.strokeColor) { out.strokeColor = cfg.strokeColor; out.strokeWidth = cfg.strokeWidth; }
  block.dataset.liner = JSON.stringify(out);
  /* 반지름 안내 수(미카사 재채점 261122 (가)) — 지금 글 길이(사용자 글자 크기·자간)에서 반원·한 바퀴가 되는 반지름. 패널이 이 블럭 것일 때만 고친다 */
  const sz = textEl.getAttribute('font-size'), lsNow = textEl.getAttribute('letter-spacing');
  textEl.setAttribute('font-size', String(Math.max(6, userFontPx))); textEl.setAttribute('letter-spacing', String(ls));
  let nUser = 0; try { nUser = tp.getComputedTextLength(); } catch (e) { nUser = 0; }
  textEl.setAttribute('font-size', sz); textEl.setAttribute('letter-spacing', lsNow);
  block.__lnrUserLen = nUser; block.__lnrR = radiusMode ? (cfg.radius || roundAutoR) : 0;
  const hn = document.querySelector('#lnr-radius-hint .lnr-hint-nums');
  if (hn && hn.closest('#lnr-radius-hint')._lnrBlock === block) hn.textContent = linerRadiusHintNums(block);
}

/** 반지름 안내 글 — 글 길이 n 이면 반원 = n/π · 한 바퀴 = n/2π(뒤집기도 같음 — 뒤집기 자간 보탬이 돈 각을 글길이/r 로 맞춘다) */
function linerRadiusHintNums(block) {
  const n = block && block.__lnrUserLen;
  if (!(n > 0)) return '반지름이 작을수록 더 휜다';
  const r = block.__lnrR, deg = r > 0 ? Math.min(360, Math.round((n / r) * 180 / Math.PI)) : 0;
  return `${deg ? `지금 ≈ ${deg}° · ` : ''}반원 ≈ ${Math.round(n / Math.PI)} · 한 바퀴 ≈ ${Math.round(n / (2 * Math.PI))}(글 길이 기준 · 더 작으면 글자가 줄어 원에 맞춤)`;
}

// 저장/로드 사이클에서 SVG가 innerHTML로 살아있어도 path id/폭변화 재계산
function ensureLiner(block) {
  if (!block || !block.dataset.liner) return;
  try {
    const cfg = JSON.parse(block.dataset.liner);
    applyLiner(block, cfg);
    applyLinerText(block);
  } catch (e) { /* malformed dataset → ignore */ }
}

// ── prop-panel 증강 (프리셋 select + 곡률 슬라이더) ──
function enhanceLinerPropPanel(block) {
  if (!block || !block.classList.contains('liner-block')) return;
  let cfg;
  try { cfg = JSON.parse(block.dataset.liner || '{}'); }
  catch (e) { cfg = { ...LINER_DEFAULTS }; }
  cfg = { ...LINER_DEFAULTS, ...cfg };

  const propPanel = document.querySelector('#panel-right .panel-body')
                 || document.querySelector('.panel-body');
  if (!propPanel) return;

  // 현재 사용자 폰트크기(userFont 단일소스 = 미러 .tb-liner style.fontSize). 없으면 computed.
  const mirrorEl = findLinerMirror(block);
  const LNR_FONT_MIN = 8, LNR_FONT_MAX = 200;
  let curFont = parseInt(mirrorEl && mirrorEl.style.fontSize);
  if (!Number.isFinite(curFont) || curFont <= 0) {
    curFont = parseInt(mirrorEl ? window.getComputedStyle(mirrorEl).fontSize : '') || 28;
  }
  curFont = Math.max(LNR_FONT_MIN, Math.min(LNR_FONT_MAX, curFont));

  const presetOpts = LINER_PRESETS
    .map(p => `<option value="${p.value}" ${p.value === cfg.preset ? 'selected' : ''}>${p.label}</option>`)
    .join('');

  /* ★U2(right-panel-unify) — 블록 고유 절 special 「Curve」(틀 경유 window.placeTextPanelSection · 자리 = SECTION_ORDER).
     꼴 = 표준 .prop-row/.prop-label/.prop-select(옛 인라인 색·px 폐지). id·배선 그대로. */
  const html = `
      <div class="prop-row">
        <span class="prop-label">글자크기</span>
        <input type="range" class="prop-slider" id="lnr-fontsize" min="${LNR_FONT_MIN}" max="${LNR_FONT_MAX}" step="1" value="${curFont}">
        <span id="lnr-fontsize-val">${curFont}</span>
      </div>
      <div class="prop-row">
        <span class="prop-label">프리셋</span>
        <select class="prop-select" id="lnr-preset">
          ${presetOpts}
        </select>
      </div>
      <div class="prop-row">
        <span class="prop-label" id="lnr-curvature-label">${cfg.preset === 'circle' ? '원 크기' : '곡률'}</span>
        <input type="range" class="prop-slider" id="lnr-curvature" min="0" max="100" value="${cfg.curvature}"${cfg.preset === 'round' || ((cfg.preset === 'arc-up' || cfg.preset === 'arc-down') && cfg.radius > 0) ? ' disabled title="반지름을 넣으면 곡률 대신 반지름이 휨을 정합니다"' : ''}>
        <span id="lnr-curvature-val">${cfg.curvature}</span>
      </div>
      <div class="prop-row">
        <span class="prop-label">자간</span>
        <input type="range" class="prop-slider" id="lnr-letterspacing" min="${LINER_LS_MIN}" max="${LINER_LS_MAX}" step="0.5" value="${cfg.letterSpacing}">
        <span id="lnr-letterspacing-val">${cfg.letterSpacing}</span>
      </div>
      <div class="prop-row">
        <span class="prop-label">시작 위치</span>
        <input type="range" class="prop-slider" id="lnr-startangle" min="0" max="360" step="1" value="${cfg.startAngle}">
        <span id="lnr-startangle-val">${cfg.startAngle}°</span>
      </div>
      <div class="prop-row" data-own="special:Curve" id="lnr-radius-row"${cfg.preset === 'arc-up' || cfg.preset === 'arc-down' || cfg.preset === 'round' ? '' : ' hidden'}>
        <span class="prop-label">반지름</span>
        <input type="number" class="prop-number" id="lnr-radius" min="0" max="${LINER_RADIUS_MAX}" step="1" value="${cfg.radius || ''}" placeholder="자동" data-empty="auto" title="px · 비우면 블럭 폭 기준 곡률 · 넣으면 그 반지름 원 위에 글 길이만큼(반원 넘게도)">
      </div>
      <div class="prop-hint" id="lnr-radius-hint"${cfg.preset === 'round' || ((cfg.preset === 'arc-up' || cfg.preset === 'arc-down') && cfg.radius > 0) ? '' : ' hidden'}><span class="lnr-hint-nums">${linerRadiusHintNums(block)}</span><span class="lnr-hint-auto"${cfg.preset === 'round' ? '' : ' hidden'}> · 반지름을 비우면 글 길이 기준으로 자동(글을 고치면 따라감)</span></div>
      <div class="prop-row" id="lnr-flip-row"${cfg.preset === 'circle' || cfg.preset === 'round' || ((cfg.preset === 'arc-up' || cfg.preset === 'arc-down') && cfg.radius > 0) ? '' : ' hidden'}>
        ${window.checkHTML({ id: 'lnr-flip', label: '안쪽 뒤집기', checked: !!cfg.flip })}   <!-- 현빈 261123 «온/오프 = 체크» -->
      </div>
      <div class="prop-row" data-own="special:Curve">   <!-- 절 정체 = special:<제목>(게이트 explicitOwnOf · prop-annotation 꼴) — 옛 «special» 은 없는 절이라 빨강(V6 · Electron 전수 261122) -->
        <span class="prop-label">외곽선</span>
        <input type="color" id="lnr-outline-color" value="${cfg.strokeColor || '#000000'}" aria-label="곡선 글자 외곽선 색">
        <input type="range" class="prop-slider" id="lnr-outline-width" min="0" max="${LINER_STROKE_MAX}" step="0.5" value="${cfg.strokeWidth || 0}" aria-label="곡선 글자 외곽선 두께">
        <span id="lnr-outline-width-val">${cfg.strokeWidth || 0}</span>
      </div>`;

  window.placeTextPanelSection?.(propPanel, 'special', html, { title: 'Curve', id: 'liner-controls-section' });
  { const h = propPanel.querySelector('#lnr-radius-hint'); if (h) h._lnrBlock = block; }   // applyLiner 가 이 블럭일 때만 안내 수를 고친다

  const read = () => {
    const next = {
      preset:        propPanel.querySelector('#lnr-preset').value,
      curvature:     parseInt(propPanel.querySelector('#lnr-curvature').value),
      letterSpacing: parseFloat(propPanel.querySelector('#lnr-letterspacing').value),
      startAngle:    parseInt(propPanel.querySelector('#lnr-startangle').value),
      radius:        normRadius(propPanel.querySelector('#lnr-radius')?.value),
      flip:          !!propPanel.querySelector('#lnr-flip')?.checked,
      strokeColor:   propPanel.querySelector('#lnr-outline-color')?.value || '',
      strokeWidth:   parseFloat(propPanel.querySelector('#lnr-outline-width')?.value) || 0
    };
    const arc = next.preset === 'arc-up' || next.preset === 'arc-down', round = next.preset === 'round';   // 줄 보이기 — 반지름 = arc·둥글게 · 뒤집기 = circle·둥글게·반지름 모드
    propPanel.querySelector('#lnr-radius-row')?.toggleAttribute('hidden', !(arc || round));
    propPanel.querySelector('#lnr-radius-hint')?.toggleAttribute('hidden', !(round || (arc && next.radius > 0)));   // 안내 = 반지름 모드(반원·한 바퀴 수) · «비우면 글 길이 기준» 은 둥글게만(아치는 비우면 블럭 폭 기준이라 다른 뜻)
    propPanel.querySelector('#lnr-radius-hint .lnr-hint-auto')?.toggleAttribute('hidden', !round);
    propPanel.querySelector('#lnr-flip-row')?.toggleAttribute('hidden', !(next.preset === 'circle' || round || (arc && next.radius > 0)));
    { const cv = propPanel.querySelector('#lnr-curvature'); if (cv) cv.disabled = round || (arc && next.radius > 0); }   // 반지름 모드·둥글게 = 곡률 안 씀
    applyLiner(block, next);
    return next;
  };

  // 글자크기 — userFont 단일소스(미러 style.fontSize) 갱신 → applyLiner(곡률 다운스케일/fit는 그 위에 재계산)
  propPanel.querySelector('#lnr-fontsize')?.addEventListener('input', e => {
    const v = Math.max(LNR_FONT_MIN, Math.min(LNR_FONT_MAX, parseInt(e.target.value) || LNR_FONT_MIN));
    propPanel.querySelector('#lnr-fontsize-val').textContent = String(v);
    const mr = findLinerMirror(block);                  // 라이브 미러 재조회(closure stale 방지)
    if (mr) mr.style.fontSize = v + 'px';               // 직렬화로 round-trip 보존
    applyLiner(block);                                   // dataset+미러에서 재계산 (effFont 미저장)
  });
  propPanel.querySelector('#lnr-fontsize')?.addEventListener('change', () => {
    window.pushHistory?.('곡선 텍스트 글자크기'); window.scheduleAutoSave?.();
  });
  propPanel.querySelector('#lnr-preset')?.addEventListener('change', () => {
    /* «기본 둥글게» — 아치(위/아래)를 «처음» 고를 때(반지름 칸이 빔) 지금 글 길이로 반지름을 채운다(글이 약 120°) · 사용자가 고친 값은 그대로 둔다 */
    const pv = propPanel.querySelector('#lnr-preset').value, rIn = propPanel.querySelector('#lnr-radius');
    if ((pv === 'arc-up' || pv === 'arc-down') && rIn && !normRadius(rIn.value)) {
      const t = block.querySelector('svg.lnr-svg text textPath'), te = block.querySelector('svg.lnr-svg text');
      let n = 0; try { if (te) te.setAttribute('font-size', String(curFont)); n = t ? t.getComputedTextLength() : 0; } catch (e) { n = 0; }
      if (n > 0) rIn.value = String(linerAutoRadius(n));
    }
    const lbl = propPanel.querySelector('#lnr-curvature-label');
    if (lbl) lbl.textContent = (propPanel.querySelector('#lnr-preset').value === 'circle') ? '원 크기' : '곡률';
    read(); window.pushHistory?.('곡선 텍스트 프리셋'); window.scheduleAutoSave?.();
  });
  propPanel.querySelector('#lnr-curvature')?.addEventListener('input', e => {
    propPanel.querySelector('#lnr-curvature-val').textContent = e.target.value;
    read();
  });
  propPanel.querySelector('#lnr-curvature')?.addEventListener('change', () => {
    window.pushHistory?.('곡선 텍스트 곡률'); window.scheduleAutoSave?.();
  });
  propPanel.querySelector('#lnr-letterspacing')?.addEventListener('input', e => {
    propPanel.querySelector('#lnr-letterspacing-val').textContent = e.target.value;
    read();
  });
  propPanel.querySelector('#lnr-letterspacing')?.addEventListener('change', () => {
    window.pushHistory?.('곡선 텍스트 자간'); window.scheduleAutoSave?.();
  });
  // 시작 위치(회전) — input 마다 실시간 연속 이동(라이브 미리보기), change 시 history/autosave
  propPanel.querySelector('#lnr-startangle')?.addEventListener('input', e => {
    propPanel.querySelector('#lnr-startangle-val').textContent = e.target.value + '°';
    read();
  });
  propPanel.querySelector('#lnr-startangle')?.addEventListener('change', () => {
    window.pushHistory?.('곡선 텍스트 시작위치'); window.scheduleAutoSave?.();
  });
  // LINETEXT-ARC — 반지름(px) · 안쪽 뒤집기 · 외곽선: 적용 뒤 기록(push-after · 이웃 칸과 같은 규약)
  propPanel.querySelector('#lnr-radius')?.addEventListener('change', () => { read(); window.pushHistory?.('곡선 텍스트 반지름'); window.scheduleAutoSave?.(); });
  propPanel.querySelector('#lnr-flip')?.addEventListener('change', () => { read(); window.pushHistory?.('곡선 텍스트 뒤집기'); window.scheduleAutoSave?.(); });
  propPanel.querySelector('#lnr-outline-color')?.addEventListener('input', () => read());
  propPanel.querySelector('#lnr-outline-color')?.addEventListener('change', () => { window.pushHistory?.('곡선 텍스트 외곽선'); window.scheduleAutoSave?.(); });
  propPanel.querySelector('#lnr-outline-width')?.addEventListener('input', (e) => { propPanel.querySelector('#lnr-outline-width-val').textContent = e.target.value; read(); });
  propPanel.querySelector('#lnr-outline-width')?.addEventListener('change', () => { window.pushHistory?.('곡선 텍스트 외곽선'); window.scheduleAutoSave?.(); });
}

// ── 로드 시 모든 liner-block 복구 ──
function initLinersInDom() {
  document.querySelectorAll('.liner-block[data-liner]').forEach(ensureLiner);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initLinersInDom);
} else {
  initLinersInDom();
}

// 프로젝트 전환 / 새 블록 추가 시 자동 보장
new MutationObserver(muts => {
  for (const m of muts) {
    for (const node of m.addedNodes) {
      if (node.nodeType !== 1) continue;
      if (node.classList?.contains('liner-block') && node.dataset.liner) ensureLiner(node);
      node.querySelectorAll?.('.liner-block[data-liner]').forEach(ensureLiner);
    }
  }
}).observe(document.body, { childList: true, subtree: true });

window.buildLinerPathD       = buildLinerPathD;
window.linerAmplitude        = linerAmplitude;
window.linerArcSagitta       = linerArcSagitta;
window.linerArcRadius        = linerArcRadius;
window.normStartAngle        = normStartAngle;
window.linerStartOffsetPct   = linerStartOffsetPct;
window.applyLiner            = applyLiner;
window.applyLinerText        = applyLinerText;
window.ensureLiner           = ensureLiner;
window.enhanceLinerPropPanel = enhanceLinerPropPanel;
window.initLinersInDom       = initLinersInDom;
window.LINER_DEFAULTS        = LINER_DEFAULTS;
window.buildRadiusPathD      = buildRadiusPathD;
window.linerAutoRadius       = linerAutoRadius;
window.LINER_PRESETS         = LINER_PRESETS;
