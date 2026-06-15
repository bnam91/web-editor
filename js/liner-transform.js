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
  { value: 'arc-up',   label: 'Arc Up (위로 아치)' },
  { value: 'arc-down', label: 'Arc Down (아래 오목)' },
  { value: 'wave',     label: 'Wave (물결)' },
  { value: 'circle',   label: '원형' }
];

const LINER_DEFAULTS = {
  preset:        'arc-up',
  curvature:     50,        // 0~100
  letterSpacing: 0,         // px, 자연 자간에 더하는 추가 자간 (음수 가능)
  startAngle:    0          // 0~360°, 텍스트 시작(회전) 위치. 0=기본(circle 12시 중앙 / arc·wave 중앙)
};

const LINER_PAD = 12;     // 좌우 패딩 P (글자 잘림 방지)
const LINER_BASE_H = 80;  // 기본 블록/뷰박스 높이

// 자간 슬라이더 범위 (px)
const LINER_LS_MIN = -2;
const LINER_LS_MAX = 20;

// 곡률 비례 폰트 다운스케일 (미감 규칙 #4): 곡률 0=1.0배 → 100=0.65배 선형
// 아치가 반원에 가까울수록 글자를 작게 만들어 자연스럽게 보이게 한다.
const LINER_CURV_MIN_SCALE = 0.65;
function linerCurvatureScale(curvature) {
  const c = normCurvature(curvature);
  return 1 - (c / 100) * (1 - LINER_CURV_MIN_SCALE);
}

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
  const P = LINER_PAD;
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
  // 측정 신뢰성: 항상 자연 자간(stretch 미설정)
  tp.removeAttribute('textLength');
  tp.removeAttribute('lengthAdjust');
  tp.textContent = readLinerText(mirror);

  path.setAttribute('id', pid);
  path.setAttribute('fill', 'none');

  const isCircle = (cfg.preset === 'circle');
  // 곡률 비례 다운스케일 (#4): 곡률↑ → 폰트↓ (모든 프리셋 공통)
  const curvScale = linerCurvatureScale(cfg.curvature);
  let effFont = Math.max(6, userFontPx * curvScale);

  const LINER_FONT_FLOOR = 6;
  const LINER_FIT_ITERS  = 5;   // M4b: 최대 반복 축소 횟수

  let cy, H, pathK;

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
      pathK = r;
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
    path.setAttribute('d', buildLinerPathD(cfg.preset, cfg.curvature, W, H, P, cy, pathK));
    // avail: 방금 쓴 path의 실제 길이 (원형=둘레, arc/wave=곡선 호 길이)
    let avail = isCircle ? (2 * Math.PI * pathK) : (W - 2 * P);
    try {
      if (path.getTotalLength) { const L = path.getTotalLength(); if (Number.isFinite(L) && L > 0) avail = L; }
    } catch (e) { /* fallback */ }
    // measure: 현재 effFont(+letter-spacing 포함)로 텍스트 자연 길이
    textEl.setAttribute('font-size', String(effFont));
    let natural = 0;
    try {
      if (tp.getComputedTextLength) natural = tp.getComputedTextLength();
      if (!(natural > 0) && textEl.getComputedTextLength) natural = textEl.getComputedTextLength();
    } catch (e) { natural = 0; }
    return { avail, natural };
  };

  // M4b: 반복 수렴 루프 — 넘치면 축소 후 재측정, 수렴(또는 폰트 하한) 시 종료.
  let m = writeAndMeasure();
  let iter = 0;
  while (m.natural > m.avail && m.natural > 0 && effFont > LINER_FONT_FLOOR && iter < LINER_FIT_ITERS) {
    effFont = Math.max(LINER_FONT_FLOOR, effFont * (m.avail / m.natural) * 0.985); // 0.985 안전마진
    m = writeAndMeasure();
    iter++;
  }
  // M4b 폴백: 폰트 하한에 닿고도 여전히 넘치면 textLength=avail + lengthAdjust=spacing 으로 강제 수용.
  if (m.natural > m.avail && m.natural > 0) {
    tp.setAttribute('textLength', String(Math.max(1, Math.round(m.avail))));
    tp.setAttribute('lengthAdjust', 'spacing');
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
  block.dataset.liner = JSON.stringify({ preset: cfg.preset, curvature: cfg.curvature, letterSpacing: cfg.letterSpacing, startAngle: cfg.startAngle });
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

  const html = `
    <div class="prop-section" id="liner-controls-section">
      <div class="prop-section-title">곡선 텍스트 〰️</div>
      <div style="display:flex;align-items:center;gap:8px;margin-top:6px;">
        <span style="flex:1;font-size:11px;color:#999;">글자크기</span>
        <input type="range" class="prop-slider" id="lnr-fontsize" min="${LNR_FONT_MIN}" max="${LNR_FONT_MAX}" step="1" value="${curFont}" style="flex:2;">
        <span id="lnr-fontsize-val" style="width:32px;font-size:11px;color:#999;text-align:right;">${curFont}</span>
      </div>
      <div style="display:flex;align-items:center;gap:8px;margin-top:6px;">
        <span style="flex:1;font-size:11px;color:#999;">프리셋</span>
        <select id="lnr-preset" style="flex:2;padding:5px 6px;font-size:12px;background:#1a1a1a;color:#ddd;border:1px solid #333;border-radius:4px;">
          ${presetOpts}
        </select>
      </div>
      <div style="display:flex;align-items:center;gap:8px;margin-top:6px;">
        <span style="flex:1;font-size:11px;color:#999;" id="lnr-curvature-label">${cfg.preset === 'circle' ? '원 크기' : '곡률'}</span>
        <input type="range" class="prop-slider" id="lnr-curvature" min="0" max="100" value="${cfg.curvature}" style="flex:2;">
        <span id="lnr-curvature-val" style="width:32px;font-size:11px;color:#999;text-align:right;">${cfg.curvature}</span>
      </div>
      <div style="display:flex;align-items:center;gap:8px;margin-top:6px;">
        <span style="flex:1;font-size:11px;color:#999;">자간</span>
        <input type="range" class="prop-slider" id="lnr-letterspacing" min="${LINER_LS_MIN}" max="${LINER_LS_MAX}" step="0.5" value="${cfg.letterSpacing}" style="flex:2;">
        <span id="lnr-letterspacing-val" style="width:32px;font-size:11px;color:#999;text-align:right;">${cfg.letterSpacing}</span>
      </div>
      <div style="display:flex;align-items:center;gap:8px;margin-top:6px;">
        <span style="flex:1;font-size:11px;color:#999;">시작 위치</span>
        <input type="range" class="prop-slider" id="lnr-startangle" min="0" max="360" step="1" value="${cfg.startAngle}" style="flex:2;">
        <span id="lnr-startangle-val" style="width:32px;font-size:11px;color:#999;text-align:right;">${cfg.startAngle}°</span>
      </div>
    </div>
  `;

  const existing = propPanel.querySelector('#liner-controls-section');
  if (existing) existing.outerHTML = html;
  else propPanel.insertAdjacentHTML('beforeend', html);

  const read = () => {
    const next = {
      preset:        propPanel.querySelector('#lnr-preset').value,
      curvature:     parseInt(propPanel.querySelector('#lnr-curvature').value),
      letterSpacing: parseFloat(propPanel.querySelector('#lnr-letterspacing').value),
      startAngle:    parseInt(propPanel.querySelector('#lnr-startangle').value)
    };
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
window.linerCurvatureScale   = linerCurvatureScale;
window.applyLiner            = applyLiner;
window.applyLinerText        = applyLinerText;
window.ensureLiner           = ensureLiner;
window.enhanceLinerPropPanel = enhanceLinerPropPanel;
window.initLinersInDom       = initLinersInDom;
window.LINER_DEFAULTS        = LINER_DEFAULTS;
window.LINER_PRESETS         = LINER_PRESETS;
