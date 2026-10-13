/* ═══════════════════════════════════════════════════════════════════════════
   fx/arrow-render.js — 화살표 스티커(shape:'arrow')의 «그림» (SVG 문자열을 짓는 순수 함수). 1013t2C4.
   ───────────────────────────────────────────────────────────────────────────
   ★현빈 1013t2C4 「스티커 화살표 블럭 — 우측 패널에서 스타일·종류 고르기」
     두 끝점(섹션 좌표 x1,y1 → x2,y2)을 손잡이로 끄는 «선 스티커»다(선 형광펜 highlightB 와 같은 기계 — js/sticker-select.js .hlb-handle).
     종류 = 직선 straight · 곡선 curve · 꺾은 elbow · 손그림 hand / 머리 = 한쪽 end · 양쪽 both · 없음 none /
     머리 꼴 = 채운 삼각 fill · 열린 V open / 선 = solid · dashed · dotted / 두께 · 휨(곡선만) · 색.
   ★머리는 «끝 접선 방향»으로 path 를 직접 짓는다. ⛔SVG marker 요소·SVG/CSS 필터를 쓰지 마라 —
     글로우 머리말(js/fx/glow-render.js)이 잰 대로 썸네일(html2canvas)·PNG 두 길에서 «살아야» 한다(마커 id 복제 충돌도 원천 0).
     점선·파선은 몸통에만 — 머리는 늘 실선.
   ★좌표: 출력 svg 의 viewBox 를 «섹션 좌표의 상자»(bbox) 그대로 둔다 ⇒ path 는 섹션 좌표 그대로 쓰고, 호출자는 블럭 상자를 bbox 에 앉힌다.
   ★맞힘: 블럭 상자는 pointer-events:none(호출자) · 투명한 굵은 맞힘 path 만 pointer-events="stroke" — 대각선 화살표의 «빈 귀퉁이»가
     아래 블럭 클릭을 먹지 않는다(highlightB 는 상자 전체가 먹는다 — 그 병을 옮기지 않는다).
   ★손그림의 흔들림은 «저장된 seed» 에서만(js/fx/seeded-random.js FxSeed — 소비자 ④). ⛔이 파일에서 무작위 함수를 부르지 마라.
   ★색은 캔버스 콘텐츠 값(저장본 dataset 에 글자로 박힌다)이라 UI 토큰 대상이 아니다 — 기본값은 DEFAULTS 한 자리
     (#1a1a1a = 어노테이션 strokeColor 기본과 같은 값 · js/blocks/annotation-block.js).
   ⚠️고전 스크립트다 — 모듈 sticker-block.js 보다 먼저 실린다(index.html 의 fx 줄). 네임스페이스 하나(ArrowFx)로 낸다.
   회귀: tests/unit/arrow-sticker-draw.test.mjs AR0~AR6 · tests/dom/sticker-arrow-c4.dom.spec.js.
═══════════════════════════════════════════════════════════════════════════ */
(function (w) {
  const KINDS  = Object.freeze(['straight', 'curve', 'elbow', 'hand']);
  const HEADS  = Object.freeze(['end', 'both', 'none']);
  const TIPS   = Object.freeze(['fill', 'open']);
  const DASHES = Object.freeze(['solid', 'dashed', 'dotted']);
  const DEFAULTS = Object.freeze({ kind: 'straight', head: 'end', tip: 'fill', dash: 'solid', thickness: 4, bend: 40, color: '#1a1a1a', len: 160 });
  const LIMITS = Object.freeze({ thickness: Object.freeze([1, 40]), bend: Object.freeze([-100, 100]) });
  const HIT_MIN = 14;   // 맞힘 띠의 최소 폭(px) — 가는 화살표도 잡히게

  const r2 = (n) => Math.round(n * 100) / 100;   // 문자열이 기계·판마다 같게(결정성)
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const num = (v, fb) => { const n = parseFloat(v); return Number.isFinite(n) ? n : fb; };
  const HEX = /^#[0-9a-fA-F]{3,8}$/;
  const safeColor = (c, fb) => (typeof c === 'string' && (HEX.test(c) || /^rgba?\([0-9.,\s%]+\)$/i.test(c))) ? c : fb;
  const pick = (v, list, fb) => (list.includes(v) ? v : fb);
  const P = (p) => `${r2(p[0])},${r2(p[1])}`;
  const unit = (dx, dy, fbx = 1, fby = 0) => { const L = Math.hypot(dx, dy); return L > 1e-9 ? [dx / L, dy / L] : [fbx, fby]; };

  /** 입력 → 안전한 값. 모르는 종류·NaN·위험한 색은 기본값으로 떨어진다(손댄 저장본이 로드를 멈추지 않는다). */
  function norm(p = {}) {
    const seed = parseInt(p.seed, 10);
    return {
      x1: num(p.x1, 0), y1: num(p.y1, 0), x2: num(p.x2, DEFAULTS.len), y2: num(p.y2, 0),
      kind: pick(p.kind, KINDS, DEFAULTS.kind),
      head: pick(p.head, HEADS, DEFAULTS.head),
      tip:  pick(p.tip, TIPS, DEFAULTS.tip),
      dash: pick(p.dash, DASHES, DEFAULTS.dash),
      t: clamp(num(p.thickness, DEFAULTS.thickness), LIMITS.thickness[0], LIMITS.thickness[1]),
      bend: clamp(num(p.bend, DEFAULTS.bend), LIMITS.bend[0], LIMITS.bend[1]),
      color: safeColor(p.color, DEFAULTS.color),
      seed: seed > 0 ? seed : 1,
    };
  }

  /** 머리 크기 — 두께에서 자동(v1 칸 없음): 길이 L = max(10, 두께×3) · 반폭 = L×0.5 */
  const headLen = (t) => Math.max(10, t * 3);

  /** 몸통 꼭짓점·접선. 반환: { pts(외접 상자용 점들), path(a', b') → d, dirA(시작에서 «바깥» 방향), dirB(끝에서 «나아가는» 방향) } */
  function skeleton(n) {
    const a = [n.x1, n.y1], b = [n.x2, n.y2];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const len = Math.hypot(dx, dy);
    if (n.kind === 'curve') {
      // 제어점 c = 중점 + 법선 × (휨% × 길이/2). 휨 0 = 직선과 같은 꼴.
      const [ux, uy] = unit(dx, dy);
      const k = (n.bend / 100) * (len / 2);
      const c = [(a[0] + b[0]) / 2 - uy * k, (a[1] + b[1]) / 2 + ux * k];
      return {
        pts: [a, b, c],
        dirA: unit(a[0] - c[0], a[1] - c[1], -ux, -uy),
        dirB: unit(b[0] - c[0], b[1] - c[1], ux, uy),
        path: (A, B) => `M${P(A)} Q${P(c)} ${P(B)}`,
        ctrl: c,
      };
    }
    if (n.kind === 'elbow') {
      // 가로 먼저: a → (mx, a.y) → (mx, b.y) → b. 가로 차이가 없으면 세로 한 줄로 떨어진다.
      if (Math.abs(dx) < 1) {
        const sy = dy >= 0 ? 1 : -1;
        return { pts: [a, b], dirA: [0, -sy], dirB: [0, sy], path: (A, B) => `M${P(A)} L${P(B)}` };
      }
      const sx = dx > 0 ? 1 : -1;
      const mx = (a[0] + b[0]) / 2;
      return {
        pts: [a, b, [mx, a[1]], [mx, b[1]]],
        dirA: [-sx, 0], dirB: [sx, 0],
        path: (A, B) => `M${P(A)} H${r2(mx)} V${r2(b[1])} H${r2(B[0])}`,
        maxTrim: Math.abs(dx) / 2 * 0.9,
      };
    }
    if (n.kind === 'hand') {
      // 직선 바탕에 seed 흔들림 — 양 끝점은 «고정»(머리 꼭짓점이 손잡이와 맞는다), 사이 점만 법선으로 흔든다.
      const S = w.FxSeed;
      const rng = S ? S.mulberry32(n.seed) : () => 0.5;
      const [ux, uy] = unit(dx, dy);
      const seg = clamp(Math.round(len / 40), 3, 12);
      const amp = Math.min(len * 0.04, 2 + n.t * 0.6);
      const mids = [];
      for (let i = 1; i < seg; i++) {
        const f = i / seg + (S ? S.jitter(rng, 0.25 / seg) : 0);
        const j = S ? S.jitter(rng, amp) : 0;
        mids.push([a[0] + dx * f - uy * j, a[1] + dy * f + ux * j]);
      }
      const first = mids[0], last = mids[mids.length - 1];
      return {
        pts: [a, b, ...mids],
        dirA: unit(a[0] - first[0], a[1] - first[1], -ux, -uy),
        dirB: unit(b[0] - last[0], b[1] - last[1], ux, uy),
        path: (A, B) => {
          // 부드럽게: M P0 · Q Pi mid(Pi,Pi+1) … · 마지막은 Q Pn-1 Pn  ⇒ 끝 접선 = Pn − Pn-1 (머리 방향과 같다)
          const all = [A, ...mids, B];
          let d = `M${P(A)}`;
          for (let i = 1; i < all.length - 1; i++) {
            const m = [(all[i][0] + all[i + 1][0]) / 2, (all[i][1] + all[i + 1][1]) / 2];
            d += i === all.length - 2 ? ` Q${P(all[i])} ${P(B)}` : ` Q${P(all[i])} ${P(m)}`;
          }
          return d;
        },
        handMids: mids,
      };
    }
    // straight
    const [ux, uy] = unit(dx, dy);
    return { pts: [a, b], dirA: [-ux, -uy], dirB: [ux, uy], path: (A, B) => `M${P(A)} L${P(B)}` };
  }

  /** 머리 하나 — 꼭짓점 T, 나아가는 방향 u. 채운 삼각은 닫힌 면, 열린 V 는 두 날개 획. */
  function headPath(T, u, n) {
    const L = headLen(n.t), W = L * 0.5;
    const B = [T[0] - u[0] * L, T[1] - u[1] * L];
    const nx = -u[1], ny = u[0];
    const left = [B[0] + nx * W, B[1] + ny * W], right = [B[0] - nx * W, B[1] - ny * W];
    const d = n.tip === 'open' ? `M${P(left)} L${P(T)} L${P(right)}` : `M${P(T)} L${P(left)} L${P(right)} Z`;
    return { tip: T, dir: u, base: B, corners: [left, right], d };
  }

  /** 기하 — 테스트와 그리기가 같이 쓴다. bbox 는 섹션 좌표. */
  function geom(p) {
    const n = norm(p);
    const sk = skeleton(n);
    const a = [n.x1, n.y1], b = [n.x2, n.y2];
    const wantStart = n.head === 'both', wantEnd = n.head === 'end' || n.head === 'both';
    const heads = [];
    if (wantStart) heads.push({ end: 'start', ...headPath(a, sk.dirA, n) });
    if (wantEnd)   heads.push({ end: 'end',   ...headPath(b, sk.dirB, n) });
    // 채운 머리는 몸통을 머리 안쪽까지만 — 둥근 끝이 뾰족한 꼭짓점 밖으로 삐져나오지 않게
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    let trim = n.tip === 'fill' ? headLen(n.t) * 0.6 : 0;
    trim = Math.min(trim, len * (wantStart && wantEnd ? 0.45 : 0.9), sk.maxTrim ?? Infinity);
    const A = wantStart ? [a[0] - sk.dirA[0] * trim, a[1] - sk.dirA[1] * trim] : a;
    const B = wantEnd   ? [b[0] - sk.dirB[0] * trim, b[1] - sk.dirB[1] * trim] : b;
    const body = sk.path(A, B);
    const hit = sk.path(a, b);
    const hitW = Math.max(n.t, HIT_MIN);
    const pts = [...sk.pts, ...heads.flatMap(h => h.corners)];
    const pad = Math.ceil(Math.max(n.t, hitW) / 2) + 2;
    const xs = pts.map(q => q[0]), ys = pts.map(q => q[1]);
    const left = Math.floor(Math.min(...xs) - pad), top = Math.floor(Math.min(...ys) - pad);
    const right = Math.ceil(Math.max(...xs) + pad), bottom = Math.ceil(Math.max(...ys) + pad);
    return { n, body, hit, hitW, heads, ctrl: sk.ctrl || null, mids: sk.handMids || null, bbox: { left, top, w: right - left, h: bottom - top } };
  }

  /** 몸통 점선 꼴 — 몸통에만. */
  function dashAttr(dash, t) {
    if (dash === 'dashed') return ` stroke-dasharray="${r2(t * 3)} ${r2(t * 2)}"`;
    if (dash === 'dotted') return ` stroke-dasharray="0.01 ${r2(t * 2)}"`;
    return '';
  }

  /** 그림 — { bbox, html }. html 은 <svg> 하나(맞힘 path · 몸통 path · 머리 path 0~2). */
  function svg(p) {
    const g = geom(p);
    const { n, bbox } = g;
    const c = n.color, t = r2(n.t);
    const hitPath = `<path class="arrow-hit" d="${g.hit}" fill="none" stroke="${c}" stroke-opacity="0" stroke-width="${r2(g.hitW)}" `
      + `stroke-linecap="round" stroke-linejoin="round" pointer-events="stroke" style="cursor:move"/>`;
    const bodyPath = `<path class="arrow-body" d="${g.body}" fill="none" stroke="${c}" stroke-width="${t}" `
      + `stroke-linecap="round" stroke-linejoin="round"${dashAttr(n.dash, n.t)}/>`;
    const headPaths = g.heads.map(h => (n.tip === 'open'
      ? `<path class="arrow-head" data-end="${h.end}" d="${h.d}" fill="none" stroke="${c}" stroke-width="${t}" stroke-linecap="round" stroke-linejoin="round" pointer-events="visiblePainted" style="cursor:move"/>`
      : `<path class="arrow-head" data-end="${h.end}" d="${h.d}" fill="${c}" stroke="${c}" stroke-width="1" stroke-linejoin="round" pointer-events="visiblePainted" style="cursor:move"/>`)).join('');
    const html = `<svg class="sticker-arrow-svg" xmlns="http://www.w3.org/2000/svg" width="${bbox.w}" height="${bbox.h}" `
      + `viewBox="${bbox.left} ${bbox.top} ${bbox.w} ${bbox.h}" `
      + `style="position:absolute;left:0;top:0;width:${bbox.w}px;height:${bbox.h}px;overflow:visible;pointer-events:none;">`
      + hitPath + bodyPath + headPaths + `</svg>`;
    return { bbox, html };
  }

  w.ArrowFx = Object.freeze({ KINDS, HEADS, TIPS, DASHES, DEFAULTS, LIMITS, headLen, geom, svg });
})(window);
