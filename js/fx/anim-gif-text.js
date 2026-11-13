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
