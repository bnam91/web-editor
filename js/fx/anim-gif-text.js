/* fx/anim-gif-text.js — (ESM · js/fx/package.json 의 "type":"module" 로 단위가 named import — homography.js 와 같은 자리) 애니메이션 GIF(js/animation-engine.js)의 «글자·숫자 계산»만. DOM·캔버스 없음 ⇒ 단위에서 바로 실린다.
 * 실앱 재현(DONE40 · 아이맥 2852c9f44)으로 확인된 V1 결함의 계산 쪽 고침:
 *   ⑴ 카운트업이 «첫 숫자 묶음»만 셌다(12,345 → 0,345…12,345 · 3.5 → 0.5…3.5) ⇒ 콤마·소수까지 한 수로 잡는다.
 *   ⑵·X3 슬롯머신이 자리별 릴이 아니었고 «첫 묶음+10» 잔상이 보였다 ⇒ 자리마다 도는 릴 값.
 *   ⑶·X1 타이핑이 부분 문자열을 매 프레임 다시 정렬해 움찔했고 자동 줄바꿈을 안 했다 ⇒ 줄 «전체» 폭으로 시작 x 를 고정.
 */

/** 한 줄에서 첫 «수» — 1,234 / 1,234.5 / 12345 / 3.5. 없으면 null. */
const NUM_RE = /\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?/;
export function numToken(line) {
  const m = NUM_RE.exec(line || '');
  if (!m) return null;
  const raw = m[0];
  return {
    index: m.index, raw,
    value: parseFloat(raw.replace(/,/g, '')),
    dec: (raw.split('.')[1] || '').length,
    comma: raw.includes(','),
  };
}

/** v 를 tok 과 같은 꼴(소수 자릿수 · 천 단위 콤마)로. */
export function formatLike(v, tok) {
  const [i, f] = v.toFixed(tok.dec).split('.');
  const int = tok.comma ? i.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : i;
  return f ? `${int}.${f}` : int;
}

/** 카운트업 — p(0~1, 이미 가속 적용)만큼 센 줄. p ≥ 1 이면 원문 그대로(앞 0 같은 꼴도 지킨다). 수가 없으면 null. */
export function countUpLine(line, p) {
  const tok = numToken(line);
  if (!tok) return null;
  if (p >= 1) return line;
  const unit = Math.pow(10, -tok.dec);
  const v = Math.floor((tok.value * Math.max(0, p)) / unit) * unit;   // 내림 — 끝값보다 먼저 끝값이 보이지 않게
  return line.slice(0, tok.index) + formatLike(v, tok) + line.slice(tok.index + tok.raw.length);
}

/** 슬롯 릴 한 칸 — 최종 숫자 d, 멈추는 순서 r(0 = 가장 먼저 · 엔진은 왼쪽 칸부터 0), 칸 수 n, 시간 t(0~1), 가속 ease.
 *  r 이 클수록 늦게 멈추고 더 많이 돈다(엔진에선 오른쪽 칸이 마지막). 반환 { cur, next, frac }: cur 가 frac 만큼 위로 빠지고 next 가 올라온다. t ≥ 1 이면 { d, d, 0 }. */
export function reelDigit(d, r, n, t, ease) {
  const stg = n > 1 ? Math.min(0.12, 0.45 / (n - 1)) : 0;
  const p = Math.max(0, Math.min(1, (t - r * stg) / (1 - (n - 1) * stg)));
  if (p >= 1) return { cur: d, next: d, frac: 0 };
  const v = (d + 10 * (2 + r)) * ease(p);
  const base = Math.floor(v);
  return { cur: base % 10, next: (base + 1) % 10, frac: v - base };
}

/** 정렬별 줄 시작 x — 줄 «전체» 폭으로 정한다(부분 문자열 폭으로 정하면 글자가 늘 때마다 줄이 밀린다). */
export function lineStartX(align, anchorX, fullW) {
  if (align === 'left') return anchorX;
  if (align === 'right') return anchorX - fullW;
  return anchorX - fullW / 2;
}

/** 타이핑 — 줄바꿈까지 끝난 줄들(lines)에서 t(0~1) 만큼 보이는 글자. 반환 = 줄마다 보이는 앞부분(빈 줄 포함, 아직 안 온 줄은 빠짐). */
export function typedLines(lines, t) {
  const total = lines.reduce((s, l) => s + l.length, 0);
  let left = Math.floor(Math.max(0, Math.min(1, t)) * total);
  const out = [];
  for (const l of lines) {
    if (left <= 0 && out.length) break;
    out.push(l.slice(0, left));
    left -= l.length;
  }
  return out;
}

/* ── 부분 꾸밈(RICHTEXT-EFFECTS-01) — 글 «조각 스타일» cs ─────────────────────────
 * cs = 글자마다 하나(글과 같은 길이) · null = 블럭 기본 스타일 · 같은 요소의 글자는 «같은 객체»(묶음 = 객체 동일성).
 * 모든 효과는 글을 fillStyled 로 그린다 — 미리보기·GIF 저장·V1·V2 가 한 함수. 조각(같은 스타일 묶음)마다 따로 그리는 자리다
 * (조각별 변형·알파는 지금 0 — 지디 ③ «자리만 막지 마라»).
 * st 필드: C2 color · weight · italic · sizeK(블럭 글자 크기 대비) · C3 ul/lt {color, thick, off} · hl {color, h{pct|px}, y} · bg · C4 shadows [{color,x,y,blur}](계산된 text-shadow = 범위 글로우 · 블럭 글로우 · Shadow 절) ·
 * C5 dot {color, size, tx, ty}(span.tb-dot::before 계산값 · 글자마다 span 하나라 조각도 글자 하나). */

const _plainCs = (cs) => !cs || !cs.some(Boolean);
/** 같은 스타일 객체가 이어진 글자 묶음 = 조각. */
function _pieces(text, cs) {
  const out = [];
  for (let i = 0; i < text.length; i++) {
    const st = cs[i] || null, last = out[out.length - 1];
    if (last && last.st === st) last.text += text[i]; else out.push({ text: text[i], st });
  }
  return out;
}
/** 조각 글꼴 — 블럭 글꼴에 조각의 기울임·굵기·크기 비(sizeK). st 없으면 null(지금 ctx.font 그대로). */
const _font = (env, st) => (st ? `${st.italic ? 'italic ' : ''}${st.weight || env.style.fontWeight} ${env.size * (st.sizeK || 1)}px ${env.style.fontFamily}` : null);
/* 크기 다른 조각이 있으면 «글자 바닥선(alphabetic)»을 맞춘다 — middle 로 그리면 작은 글자가 가운데로 뜬다(블럭은 바닥선 정렬). */
function _baseOff(ctx) {
  const b = ctx.textBaseline;
  ctx.textBaseline = 'middle'; const a1 = ctx.measureText('H').fontBoundingBoxAscent;
  ctx.textBaseline = 'alphabetic'; const a2 = ctx.measureText('H').fontBoundingBoxAscent;
  ctx.textBaseline = b;
  return Number.isFinite(a1) && Number.isFinite(a2) ? a2 - a1 : 0;
}

/* 조각 장식 — over=false: 글 «뒤»(배경색 · 형광펜 띠 · 밑줄) · over=true: 글 «위»(취소선). 글꼴은 이미 그 조각 것.
   상자 = 글꼴 상자(fontBoundingBox · 못 재면 0.8em/0.2em) = CSS 인라인 배경이 까는 곳. CSS px 값은 캔버스 배율(size/블럭 글자 크기)로.
   그림자(글로우 펄스)는 장식에 안 건다 — 글만 빛난다. */
function _decor(ctx, p, x, baseline, env, over) {
  const st = p.st, ps = env.size * (st.sizeK || 1), k = env.size / (env.style.fontSize || env.size);
  const thick = (l) => (l.thick > 0 ? l.thick * k : Math.max(1, ps / 16));
  const sb = ctx.shadowBlur; ctx.shadowBlur = 0;
  const b0 = ctx.textBaseline; ctx.textBaseline = 'alphabetic';
  const m = ctx.measureText(p.text); ctx.textBaseline = b0;
  const asc = Number.isFinite(m.fontBoundingBoxAscent) ? m.fontBoundingBoxAscent : ps * 0.8;
  const desc = Number.isFinite(m.fontBoundingBoxDescent) ? m.fontBoundingBoxDescent : ps * 0.2;
  if (over) {
    if (st.lt) { ctx.fillStyle = st.lt.color; ctx.fillRect(x, baseline - ps * 0.3 - thick(st.lt) / 2, p.w, thick(st.lt)); }
    /* 방점(C5) — CSS: 점 아래끝 = 글자 상자 윗변(bottom:anchor(top)) · 가운데 = 글자 가운데(left:anchor(center)) · 그 뒤 translate(tx, ty)
       (tx 에 -50%(= −size/2) 가 이미 들어 있다 — 계산된 ::before transform). */
    if (st.dot) {
      const r = (st.dot.size * k) / 2;
      ctx.fillStyle = st.dot.color; ctx.beginPath();
      ctx.arc(x + p.w / 2 + st.dot.tx * k + r, baseline - asc + st.dot.ty * k - r, r, 0, Math.PI * 2); ctx.fill();
    }
  } else {
    if (st.bg) { ctx.fillStyle = st.bg; ctx.fillRect(x, baseline - asc, p.w, asc + desc); }
    if (st.hl && st.hl.color) {
      const band = st.hl.h.pct != null ? (asc + desc) * st.hl.h.pct : st.hl.h.px * k;
      ctx.fillStyle = st.hl.color; ctx.fillRect(x, baseline + desc - band + st.hl.y * k, p.w, band);
    }
    if (st.ul) { ctx.fillStyle = st.ul.color; ctx.fillRect(x, baseline + (st.ul.off != null ? st.ul.off * k : ps * 0.1), p.w, thick(st.ul)); }
  }
  ctx.shadowBlur = sb;
}

/** 계산된 text-shadow → [{color, x, y, blur}](CSS 순서 = 맨 앞 그림자 먼저) · 'none'/빈 값 = null. */
export function parseTextShadow(str) {
  const v = String(str || '').trim();
  if (!v || v === 'none') return null;
  const parts = []; let depth = 0, cur = '';
  for (const ch of v) { if (ch === '(') depth++; if (ch === ')') depth--; if (ch === ',' && !depth) { parts.push(cur); cur = ''; } else cur += ch; }
  parts.push(cur);
  const out = parts.map((p) => {
    const color = (/(rgba?\([^)]*\)|hsla?\([^)]*\)|#[0-9a-f]{3,8}\b)/i.exec(p) || [])[0];
    const nums = (p.replace(color || '', '').match(/-?[\d.]+(?=px|\s|$)/g) || []).map(Number);
    return color ? { color, x: nums[0] || 0, y: nums[1] || 0, blur: nums[2] || 0 } : null;
  }).filter(Boolean);
  return out.length ? out : null;
}

/* 조각 그림자(글로우 · Shadow 절) — CSS 처럼 맨 뒤 그림자부터 깔고 글은 그 위에.
   캔버스 그림자는 글도 같이 그리므로 글을 화면 밖(−BIG)에 그리고 그림자만 제자리로 옮긴다. 그림자 오프셋·흐림은 변형을 안 타서
   지금 변형의 배율(a·d)을 곱한다(효과는 회전 없음). shortcut: 회전 변형이 생기면 a·b·c·d 로 옮김 계산. */
const _BIG = 10000;
function _shadows(ctx, p, x, y, env) {
  const k = env.size / (env.style.fontSize || env.size);
  const m = ctx.getTransform ? ctx.getTransform() : { a: 1, d: 1 };
  const keep = [ctx.shadowColor, ctx.shadowBlur, ctx.shadowOffsetX, ctx.shadowOffsetY];
  for (let i = p.st.shadows.length - 1; i >= 0; i--) {
    const sh = p.st.shadows[i];
    ctx.shadowColor = sh.color; ctx.shadowBlur = sh.blur * k * Math.abs(m.a);
    ctx.shadowOffsetX = (_BIG + sh.x * k) * m.a; ctx.shadowOffsetY = sh.y * k * m.d;
    ctx.fillText(p.text, x - _BIG, y);
  }
  [ctx.shadowColor, ctx.shadowBlur, ctx.shadowOffsetX, ctx.shadowOffsetY] = keep;
}

/** 글 text(그 cs) 를 x,y 에 — 정렬은 ctx.textAlign 그대로 · 블럭 기본 글꼴·색은 지금 ctx 의 것. env = { style, size }.
 *  꾸밈 없으면 옛 fillText 한 번(바이트 동일). 있으면 조각마다 제 글꼴·색으로 이어 그린다. */
export function fillStyled(ctx, text, cs, x, y, env) {
  if (_plainCs(cs)) { ctx.fillText(text, x, y); return; }
  const base = { font: ctx.font, fill: ctx.fillStyle, align: ctx.textAlign, bl: ctx.textBaseline };
  const ps = _pieces(text, cs);
  let total = 0;
  for (const p of ps) { ctx.font = _font(env, p.st) || base.font; p.w = ctx.measureText(p.text).width; total += p.w; }
  let px = base.align === 'center' ? x - total / 2 : base.align === 'right' || base.align === 'end' ? x - total : x;
  ctx.font = base.font;
  const mixed = ps.some((p) => p.st && (p.st.sizeK || 1) !== 1) && base.bl === 'middle';
  const decor = ps.some((p) => p.st && (p.st.ul || p.st.lt || p.st.hl || p.st.bg || p.st.dot));
  const off = mixed || decor ? _baseOff(ctx) : 0;
  const by = mixed ? y + off : y;
  const baseline = mixed ? by : y + off;   // 장식(배경·형광·밑줄·취소선)이 재는 글자 바닥선
  ctx.textAlign = 'left';
  if (mixed) ctx.textBaseline = 'alphabetic';
  for (const p of ps) {   // 조각 하나 = 따로 그리는 자리
    ctx.font = _font(env, p.st) || base.font;
    if (p.st) _decor(ctx, p, px, baseline, env, false);
    ctx.fillStyle = (p.st && p.st.color) || base.fill;
    if (p.st && p.st.shadows) _shadows(ctx, p, px, by, env);
    ctx.fillText(p.text, px, by);
    if (p.st) _decor(ctx, p, px, baseline, env, true);
    px += p.w;
  }
  ctx.font = base.font; ctx.fillStyle = base.fill; ctx.textAlign = base.align; ctx.textBaseline = base.bl;
}

/** fillStyled 와 같은 셈의 폭. */
export function measureStyled(ctx, text, cs, env) {
  if (_plainCs(cs)) return ctx.measureText(text).width;
  const f0 = ctx.font;
  let w = 0;
  for (const p of _pieces(text, cs)) { ctx.font = _font(env, p.st) || f0; w += ctx.measureText(p.text).width; }
  ctx.font = f0;
  return w;
}

/** 글이 바뀌었을 때(카운트업 0 → 12,345) 새 글의 cs — 앞뒤 같은 글자는 제 스타일, 바뀐 가운데는 그 첫 글자 스타일. */
export function remapCs(src, cs, out) {
  if (!cs) return null;
  if (out === src) return cs;
  let a = 0; while (a < src.length && a < out.length && src[a] === out[a]) a++;
  let b = 0; while (b < src.length - a && b < out.length - a && src[src.length - 1 - b] === out[out.length - 1 - b]) b++;
  const mid = cs[Math.min(a, src.length - 1)] ?? null;
  return [...cs.slice(0, a), ...Array(out.length - a - b).fill(mid), ...cs.slice(src.length - b)];
}
