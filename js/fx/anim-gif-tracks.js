/* fx/anim-gif-tracks.js — 애니메이션 GIF V2 «줄별 타임라인»(ESM · js/fx/package.json "type":"module" · DOM 0 ⇒ 단위가 가짜 ctx 로 «실제로 그려» 본다).
 * 현빈 GO 261114(GIF V2 · 브리프 BRIEF-ty-gif-v2-261114): 한 텍스트 블럭 안에서 줄마다 다른 효과·시작 시각(P076 = 질문 «타이핑» · 답 «도장»).
 *   트랙 = 줄(글의 명시 줄바꿈 한 줄)마다 { line, fx, at, dur }(ms). 화면에서 접힌 조각(wrap)은 그 줄의 트랙을 같이 쓴다.
 *   시계: 전체 T = max(at + dur) · 줄마다 local = clamp((τ − at) / dur) · τ < at = 아직 안 나옴(안 그림).
 * ★V1 «블럭 전체 한 효과»(animation-engine.js _drawFrame)는 손대지 않는다 — 트랙이 없으면 엔진이 옛 길로 그린다(회귀 0).
 *   여기의 V1 효과들은 «한 줄 몫»으로 다시 쓴 것이다(같은 곡선 · 같은 도우미 anim-gif-text.js).
 */
import { countUpLine, numToken, reelDigit, lineStartX, fillStyled, measureStyled, remapCs } from './anim-gif-text.js';

export const easeOut = (t) => 1 - Math.pow(1 - t, 3);
export const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const clamp01 = (v) => Math.max(0, Math.min(1, v));

/** 효과 목록(허용 목록 · 저장본 소독의 정본) — V1 7 + V2 새 효과 3(F1 도장 · F2 흐림→선명 · 블러 휩). */
export const TRACK_FX = ['slide-up', 'typewriter', 'slot-machine', 'fade-in', 'word-pop', 'glow-pulse', 'count-up', 'stamp', 'blur-in', 'blur-whip'];
/** V2 에서 새로 생긴 것 — 엔진은 이것들을 «블럭 전체» 모드에서도 이 파일(drawTracks)로 그린다(V1 7종은 옛 _drawFrame 그대로). */
export const V2_FX = ['stamp', 'blur-in', 'blur-whip'];

/* ── V2 새 효과의 «곡선»(순수 · 단위가 수로 잠근다) — k = 배율(블럭 1px = 캔버스 k px) ── */
/** F1 도장 찍기(현빈: P076 «네!») — 0~70% 크게·흐리게(2.2배 · 흐림 10px)에서 가속하며 내려와 «쾅» · 70~100% 눌림 0.94 → 되튐 1 + 2px 감쇠 흔들림. */
export function stampParams(p, k = 1) {
  if (p < 0.7) {
    const q = p / 0.7;
    return { scale: 2.2 - 1.2 * q * q, blur: 10 * k * (1 - q), alpha: clamp01(p / 0.4), dx: 0 };
  }
  const r = (p - 0.7) / 0.3;
  const scale = r < 0.35 ? 1 - 0.06 * (r / 0.35) : 0.94 + 0.06 * easeOut((r - 0.35) / 0.65);
  return { scale, blur: 0, alpha: 1, dx: 2 * k * Math.sin(r * Math.PI * 4) * (1 - r) };
}
/** F2 흐림→선명 — 흐림 14px → 0 · 알파 0.2 → 1(easeOut). */
export const blurInParams = (p, k = 1) => ({ blur: 14 * k * (1 - easeOut(p)), alpha: 0.2 + 0.8 * easeOut(p) });
/** F2 블러 휩 — 왼쪽에서 빠르게 들어와 멈춤 · 움직이는 동안 뒤로 잔상 5장(알파 감쇠) + 흐림 6px → 0. */
export function whipParams(p, k = 1, W = 480) {
  const e = easeOut(p);
  return { dx: -(1 - e) * W * 0.35, blur: 6 * k * (1 - p), alpha: clamp01(p * 3), ghosts: p < 1 ? 5 : 0, ghostStep: (1 - e) * W * 0.05, ghostAlpha: 0.35 * (1 - p) };
}
const _blur = (ctx, px) => { ctx.filter = px > 0.05 ? `blur(${px.toFixed(2)}px)` : 'none'; };
export const AT_MAX = 10000, DUR_MIN = 120, DUR_MAX = 5000;

/** 저장본 → 줄 수 n 에 맞춘 트랙 n 개. 없거나 이상한 칸은 «앞 줄 효과 · 앞 줄 끝에 시작»으로 메운다(첫 줄은 fallback · 0).
 *  남는 트랙(줄이 줄었을 때)은 버린다 · fx 는 허용 목록만 · 숫자는 고정 범위. */
export function normTracks(raw, n, { fx = 'fade-in', dur = 1200 } = {}) {
  const byLine = new Map();
  for (const t of Array.isArray(raw) ? raw : []) {
    const line = Number(t?.line);
    if (!Number.isInteger(line) || line < 0 || line >= n || byLine.has(line)) continue;
    byLine.set(line, t);
  }
  const out = [];
  for (let i = 0; i < n; i++) {
    const r = byLine.get(i), prev = out[i - 1];
    const f = TRACK_FX.includes(r?.fx) ? r.fx : (prev ? prev.fx : (TRACK_FX.includes(fx) ? fx : 'fade-in'));
    const d = Number.isFinite(Number(r?.dur)) ? Math.max(DUR_MIN, Math.min(DUR_MAX, Math.round(Number(r.dur)))) : (prev ? prev.dur : Math.max(DUR_MIN, Math.min(DUR_MAX, dur)));
    const a = Number.isFinite(Number(r?.at)) ? Math.max(0, Math.min(AT_MAX, Math.round(Number(r.at)))) : (prev ? prev.at + prev.dur : 0);
    out.push({ line: i, fx: f, at: a, dur: d });
  }
  return out;
}

/** 한 바퀴 길이(ms) = 가장 늦게 끝나는 줄. */
export const totalMs = (tracks) => tracks.reduce((m, t) => Math.max(m, t.at + t.dur), 0);
/** τ(ms)에서 그 트랙의 진행(0~1) · 시작 전은 음수 대신 null(= 안 그림). */
export const localT = (tr, tau) => (tau < tr.at ? null : clamp01((tau - tr.at) / tr.dur));

/** 배치 — _drawFrame 과 같은 규칙(좌우 여백 5% · 단어 단위 접기 · 줄 높이 · 세로 가운데). 반환 조각마다 src(원래 줄 번호)를 단다. */
/** 글 상자(가로) — 블럭과 같은 줄바꿈: 접는 폭 = 블럭 글 안쪽 폭(em) × 그리는 글자 크기 · 가운데 둔다.
 *  wrapEm 이 없으면(블럭 못 잼) 옛 규칙 좌우 5%. 0.9.12 QA: 716 폭 한 줄 블럭이 5% 여백(432)에 접혀 두 줄이 됐다.
 *  shortcut: 좌우 패딩이 다르면 안쪽 폭만 맞고 위치는 가운데 기준, 비대칭 패딩 블럭이 나오면 padL/padR 로. */
export const TEXT_SLACK = 2;
export function textBox(W, size, style) {
  if (!(style.wrapEm > 0)) { const p = Math.round(W * 0.05); return { paddingX: p, maxW: W - p * 2 }; }
  // 캔버스 폭을 못 넘게(글자 크기 반올림으로 em×size 가 W 를 넘었다 · G4 481.49>480) + measureText 오차 여유 2px
  const maxW = Math.min(W, style.wrapEm * size) - TEXT_SLACK;
  return { paddingX: (W - maxW) / 2, maxW };
}

export function layoutLines(ctx, style, W, H, size) {
  const { paddingX, maxW } = textBox(W, size, style);
  const align = style.textAlign === 'right' || style.textAlign === 'left' ? style.textAlign : 'center';
  const anchorX = align === 'left' ? paddingX : align === 'right' ? W - paddingX : W / 2;
  const env = { style, size };
  const wrap = (text, lcs) => {   // lcs = 이 줄의 조각 스타일 — 굵기·크기 다른 조각은 제 폭으로 잰다
    if (!text) return [''];
    const res = []; let cur = '', c0 = 0, at = 0;
    for (const word of text.split(' ')) {
      const test = cur ? cur + ' ' + word : word, s0 = cur ? c0 : at;
      if (measureStyled(ctx, test, lcs && lcs.slice(s0, s0 + test.length), env) > maxW && cur) { res.push(cur); cur = word; c0 = at; } else { cur = test; c0 = s0; }
      at += word.length + 1;
    }
    if (cur) res.push(cur);
    return res.length ? res : [''];
  };
  const segs = [];
  let off = 0;   // 원문(style.text) 안 줄 시작 — 조각 스타일 cs 를 접힌 조각마다 잘라 붙인다
  String(style.text || '').split('\n').forEach((line, src) => {
    let pos = 0;
    wrap(line, style.cs && style.cs.slice(off, off + line.length)).forEach((text) => {
      const at = line.indexOf(text, pos);
      segs.push({ src, text, cs: style.cs && at >= 0 ? style.cs.slice(off + at, off + at + text.length) : null });
      if (at >= 0) pos = at + text.length;
    });
    off += line.length + 1;
  });
  const lineH = size * (style.lineHeight || 1.4);
  // 줄높이 = 그 줄에서 가장 큰 조각 크기만큼(블럭 줄 상자처럼) · 다 같으면 옛 셈 그대로
  const lhs = segs.map((s) => lineH * Math.max(1, ...(s.cs || []).map((c) => (c && c.sizeK) || 1)));
  const uniform = lhs.every((h) => h === lineH);
  const totalH = uniform ? segs.length * lineH : lhs.reduce((a, h) => a + h, 0);
  const top = H / 2 - ((segs.length - 1) * lineH) / 2;
  let acc = H / 2 - totalH / 2;
  segs.forEach((s, i) => {
    s.y = uniform ? top + i * lineH : acc + lhs[i] / 2; acc += lhs[i];
    s.w = measureStyled(ctx, s.text, s.cs, env); s.x0 = lineStartX(align, anchorX, s.w);
  });
  return { segs, align, anchorX, lineH, totalH, srcCount: String(style.text || '').split('\n').length };
}

/** 캔버스 높이 — 블럭 비율 H 와 «캔버스가 접은 줄 수 × 줄높이» 중 큰 쪽.
 *  캔버스는 좌우 여백 5% 로 블럭보다 좁게 접는다 ⇒ 한 줄 블럭이 두 줄로 그려져 위아래가 잘렸다(0.9.12 QA GIF-PREVIEW-CLIPPED-01). */
export function fitCanvasH(ctx, style, W, H, size) {
  ctx.font = `${style.fontWeight} ${size}px ${style.fontFamily}`;
  try { ctx.letterSpacing = (style.letterSpacing || 0) + 'px'; } catch (_) { /* 옛 캔버스 */ }
  const L = layoutLines(ctx, style, W, H, size);
  return Math.max(H, Math.ceil(L.totalH));
}

/* ── 줄 한 몫 효과 — (ctx, segs(그 줄의 조각들), p(0~1), env) ── */
const _plain = (ctx, segs, env) => segs.forEach((s) => fillStyled(ctx, s.text, s.cs, s.x0, s.y, env));
export const FX = {
  stamp: (ctx, segs, p, env) => {
    const m = stampParams(p, env.k);
    const cx = segs.reduce((a, s) => a + s.x0 + s.w / 2, 0) / segs.length, cy = segs.reduce((a, s) => a + s.y, 0) / segs.length;
    ctx.globalAlpha = m.alpha; _blur(ctx, m.blur);
    // 끝 프레임은 «변형 없음» 으로 — 0.94 + 0.06 이 1.0000000000000002 가 되어 근소 변형이 남는다(T7)
    if (Math.abs(m.scale - 1) > 1e-6 || Math.abs(m.dx) > 1e-6) { ctx.translate(cx + m.dx, cy); ctx.scale(m.scale, m.scale); ctx.translate(-cx, -cy); }
    _plain(ctx, segs, env);
  },
  'blur-in': (ctx, segs, p, env) => { const m = blurInParams(p, env.k); ctx.globalAlpha = m.alpha; _blur(ctx, m.blur); _plain(ctx, segs, env); },
  'blur-whip': (ctx, segs, p, env) => {
    const m = whipParams(p, env.k, env.W);
    _blur(ctx, m.blur);
    for (let g = m.ghosts; g >= 1; g--) {   // 뒤(왼쪽)로 갈수록 옅게
      ctx.globalAlpha = m.ghostAlpha * (1 - g / (m.ghosts + 1));
      segs.forEach((s) => fillStyled(ctx, s.text, s.cs, s.x0 + m.dx - g * m.ghostStep, s.y, env));
    }
    ctx.globalAlpha = m.alpha;
    segs.forEach((s) => fillStyled(ctx, s.text, s.cs, s.x0 + m.dx, s.y, env));
  },
  'fade-in': (ctx, segs, p, env) => { ctx.globalAlpha = easeInOut(p); _plain(ctx, segs, env); },
  'slide-up': (ctx, segs, p, env) => {
    ctx.globalAlpha = easeInOut(p);
    const dy = (1 - easeOut(p)) * env.lineH * 1.2;
    segs.forEach((s) => fillStyled(ctx, s.text, s.cs, s.x0, s.y + dy, env));
  },
  'glow-pulse': (ctx, segs, p, env) => {
    const g = 0.5 + 0.5 * Math.sin(p * Math.PI * 4);
    ctx.shadowColor = env.color; ctx.shadowBlur = (4 + 32 * g) * env.k; ctx.globalAlpha = 0.6 + 0.4 * g;
    _plain(ctx, segs, env);
  },
  typewriter: (ctx, segs, p, env) => {
    const total = segs.reduce((n, s) => n + s.text.length, 0);
    let left = Math.floor(p * total), cur = null;
    for (const s of segs) {
      if (left <= 0 && cur) break;
      const part = s.text.slice(0, Math.max(0, left)), pcs = s.cs && s.cs.slice(0, part.length);
      fillStyled(ctx, part, pcs, s.x0, s.y, env);
      cur = { x: s.x0 + measureStyled(ctx, part, pcs, env) + 2, y: s.y };
      left -= s.text.length;
    }
    if (p < 1 && cur) ctx.fillRect(cur.x, cur.y - env.size * 0.45, 2, env.size * 0.9);   // 커서
  },
  'word-pop': (ctx, segs, p, env) => {
    const words = segs.flatMap((s) => { let x = s.x0; const sp = ctx.measureText(' ').width;
      return [...s.text.matchAll(/[^ ]+/g)].map((m) => { const w = m[0], cs = s.cs && s.cs.slice(m.index, m.index + w.length), ww = measureStyled(ctx, w, cs, env); const o = { w, cs, x, y: s.y, ww }; x += ww + sp; return o; }); });
    words.forEach((o, i) => {
      const q = clamp01(p * words.length - i);
      if (q <= 0) return;
      const sc = 0.6 + 0.4 * easeOut(q);
      ctx.save(); ctx.globalAlpha = q; ctx.translate(o.x + o.ww / 2, o.y); ctx.scale(sc, sc); fillStyled(ctx, o.w, o.cs, -o.ww / 2, 0, env); ctx.restore();
    });
  },
  'count-up': (ctx, segs, p, env) => {
    segs.forEach((s) => {
      const text = countUpLine(s.text, p >= 1 ? 1 : easeOut(p)) ?? s.text, cs = remapCs(s.text, s.cs, text);
      fillStyled(ctx, text, cs, lineStartX(env.align, env.anchorX, measureStyled(ctx, text, cs, env)), s.y, env);
    });
  },
  'slot-machine': (ctx, segs, p, env) => {
    segs.forEach((s) => {
      const tok = numToken(s.text);
      if (!tok) { ctx.globalAlpha = p; fillStyled(ctx, s.text, s.cs, s.x0, s.y + (1 - easeOut(p)) * env.lineH, env); ctx.globalAlpha = 1; return; }
      const nDig = tok.raw.replace(/\D/g, '').length, step = env.size * 1.2;
      let order = 0;
      for (let i = 0; i < s.text.length; i++) {
        const ch = s.text[i], c1 = s.cs && [s.cs[i]], x = s.x0 + measureStyled(ctx, s.text.slice(0, i), s.cs && s.cs.slice(0, i), env);
        const inNum = i >= tok.index && i < tok.index + tok.raw.length && ch >= '0' && ch <= '9';
        if (!inNum) { fillStyled(ctx, ch, c1, x, s.y, env); continue; }
        const r = reelDigit(+ch, order++, nDig, p, easeOut);
        // 도는 자리만 줄 띠로 자른다 — 멈춘 자리·숫자 아닌 글자는 안 잘라 방점·글로우·형광이 산다(RICHTEXT C6 · 엔진 V1 과 같은 규칙)
        const roll = r.frac > 0;
        if (roll) { ctx.save(); ctx.beginPath(); ctx.rect(0, s.y - env.size * 0.6, env.W, env.size * 1.2); ctx.clip(); }
        fillStyled(ctx, String(r.cur), c1, x, s.y - r.frac * step, env);
        if (roll) { fillStyled(ctx, String(r.next), c1, x, s.y + (1 - r.frac) * step, env); ctx.restore(); }
      }
    });
  },
};

/** 한 프레임 — 배경은 부르는 쪽이 깐다(엔진과 같은 순서). tracks 는 normTracks 결과 · tau = ms.
 *  env.k = 미리보기/내보내기 배율(효과의 px 값을 같은 «눈 크기»로 맞춘다 · 블럭 1px = k 캔버스 px). */
export function drawTracks(ctx, W, H, style, size, tracks, tau, k = 1) {
  ctx.font = `${style.fontWeight} ${size}px ${style.fontFamily}`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';   // 조각마다 x0(줄 시작) 로 그린다 — 정렬은 배치가 이미 풀었다
  try { ctx.letterSpacing = (style.letterSpacing || 0) + 'px'; } catch (_) { /* 옛 캔버스 */ }
  const L = layoutLines(ctx, style, W, H, size);
  const env = { W, H, size, k, style, lineH: L.lineH, align: L.align, anchorX: L.anchorX, color: style.color };
  const drawn = [];
  for (const tr of tracks) {
    const p = localT(tr, tau);
    const segs = L.segs.filter((s) => s.src === tr.line);
    if (p == null || !segs.length || !FX[tr.fx]) continue;
    ctx.save();
    ctx.fillStyle = style.color;
    FX[tr.fx](ctx, segs, p, env);
    ctx.restore();
    drawn.push(tr.line);
  }
  return drawn;   // 시험용 — 이 프레임에 그린 줄 번호
}

/* ── F3 저장 꼴(텍스트 블럭 data-anim-gif) — 글 내용은 저장하지 않는다(블럭 글에서 읽는다 · ROADMAP 3-1 과 같은 뜻) ── */
export const SPEED_MIN = 0.5, SPEED_MAX = 3, REPEAT_MIN = 1, REPEAT_MAX = 5;
const _clampNum = (v, lo, hi, d) => (Number.isFinite(Number(v)) ? Math.max(lo, Math.min(hi, Number(v))) : d);
/** 저장 문자열 → { perLine, tracks(줄 수 n 에 맞춤 · 소독), speed, repeat } · 못 읽으면 perLine false. ⛔남이 준 프로젝트에서 올 수 있다 — 값은 전부 허용 목록·범위로만. */
export function parseAnimGif(str, n) {
  let o = null;
  try { o = JSON.parse(String(str || '')); } catch (_) { o = null; }
  if (!o || typeof o !== 'object' || o.v !== 2 || !Array.isArray(o.tracks)) return { perLine: false, tracks: null, speed: 1, repeat: 1 };
  return { perLine: true, tracks: normTracks(o.tracks, n), speed: _clampNum(o.speed, SPEED_MIN, SPEED_MAX, 1), repeat: Math.round(_clampNum(o.repeat, REPEAT_MIN, REPEAT_MAX, 1)) };
}
/** 저장 꼴로 — 정해진 키만(다른 키를 실어 나르지 않는다). */
export const serializeAnimGif = ({ tracks, speed = 1, repeat = 1 }) => JSON.stringify({
  v: 2, tracks: tracks.map(({ line, fx, at, dur }) => ({ line, fx, at, dur })), speed, repeat,
});
/** 속도 배율 — at·dur 를 나눈다(미리보기·GIF 가 같은 값을 쓴다). */
export const scaleTracks = (tracks, speed) => tracks.map((t) => ({ ...t, at: t.at / speed, dur: t.dur / speed }));

/* ── F4 한 바퀴 안내 — 모달 한 줄과 GIF 내보내기가 «같은 셈»을 쓴다(둘이 갈리지 않게) ── */
export const GIF_FPS = 20, GIF_HOLD_S = 1.5;
/** GIF 프레임 수 = 한 바퀴(0~끝 포함) + 끝 멈춤 1.5초 — animation-engine.js exportAnimGif 의 루프 두 개와 같은 수. */
export const gifFrameCount = (durMs) => (Math.ceil((durMs / 1000) * GIF_FPS) + 1) + Math.ceil(GIF_FPS * GIF_HOLD_S);
export const loopInfoText = (durMs) => `한 바퀴 ${(durMs / 1000).toFixed(2)}초 · GIF ${gifFrameCount(durMs)}프레임`;
