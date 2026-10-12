/* ═══════════════════════════════════════════════════════════════════════════
   fx/doodle-line-render.js — 선 형광펜(highlightB)의 «두들» 스타일 그림 (path 목록을 짓는 순수 함수).
   ───────────────────────────────────────────────────────────────────────────
   ★1012t1J2 (현빈 「두들 스타일 프리셋」) — 기존 lineStyle(line·wavy·marker) 옆에 손그림 다섯을 더한다:
     scribble(스크리블) · brush(거친 붓) · circle(동그라미) · double(두 줄 밑줄) · scratch(밑줄 긁기)
   ★좌표계 = sticker-block.js highlightB 렌더와 같다: 회전된 SVG 안, 길이 방향 = x축(0..length), 두께 방향 = y축(yMid 중심).
     호출자(renderStickerBlock)는 bbox·svg 높이를 extraPad 로 넓히고, paths() 의 항목마다 <path> 하나를 찍는다.
   ★모습의 흔들림은 «저장된 seed» 에서만(js/fx/seeded-random.js FxSeed.mulberry32) — 같은 seed = 같은 그림.
     ⛔이 파일에서 Math.random 을 부르지 마라(리로드·썸네일·undo 마다 모습이 바뀐다).
   ★SVG filter 0 — 마커의 feTurbulence 와 달리 «겹친 획·흔들린 꼭짓점»만으로 손맛을 낸다(썸네일 html2canvas·내보내기에서 산다).
   ★프리셋(PRESETS)은 모양 + 두께 + 색을 «한 묶음»으로 깐다(가정 A3 · 글로우 종류 프리셋과 같은 판단).
     색은 캔버스 콘텐츠 값이라 UI 토큰 대상이 아니다(기본 노랑 rgba(255, 235, 70, 0.7)과 같은 성격). 값만 바꾸면 되게 이 표 한 자리에 둔다.
   ⚠️고전 스크립트다 — 모듈 sticker-block.js 보다 먼저 실린다(index.html 의 fx 줄). 네임스페이스 하나(DoodleLine)로 낸다.
   회귀: tests/unit/doodle-line-render.test.mjs DL1~DL4 · tests/dom/highlight-line-j1j2.dom.spec.js J2-a~f.
═══════════════════════════════════════════════════════════════════════════ */
(function (w) {
  const PRESETS = Object.freeze({
    scribble: Object.freeze({ lineStyle: 'scribble', thickness: 18, hlColor: 'rgba(255, 235, 70, 0.75)' }),
    brush:    Object.freeze({ lineStyle: 'brush',    thickness: 20, hlColor: 'rgba(255, 150, 40, 0.6)' }),
    circle:   Object.freeze({ lineStyle: 'circle',   thickness: 4,  hlColor: 'rgba(230, 60, 60, 0.9)', amplitude: 22 }),
    double:   Object.freeze({ lineStyle: 'double',   thickness: 5,  hlColor: 'rgba(40, 110, 230, 0.85)', amplitude: 10 }),
    scratch:  Object.freeze({ lineStyle: 'scratch',  thickness: 6,  hlColor: 'rgba(230, 60, 60, 0.9)' }),
  });
  const STYLES = Object.freeze(Object.keys(PRESETS));
  /* 칩 이름(패널) — 한 자리에서 */
  const LABELS = Object.freeze({ scribble: '스크리블', brush: '거친 붓', circle: '동그라미', double: '두 줄 밑줄', scratch: '밑줄 긁기' });

  const r2 = (n) => Math.round(n * 100) / 100;   // 문자열이 기계·판마다 같게(결정성)
  const jit = (rng, amp) => (rng() * 2 - 1) * amp;
  const P = (x, y) => `${r2(x)},${r2(y)}`;

  /* 동그라미의 가로 여유(선분 양끝 바깥) · 세로 반지름 */
  const circleGeom = (length, amplitude) => {
    const padX = Math.max(8, amplitude * 0.6);
    return { padX, rx: length / 2 + padX, ry: Math.max(4, amplitude) };
  };
  const scratchGeom = (length, thickness) => ({
    bow:  Math.min(thickness * 1.2 + 2, 10),
    tail: Math.max(thickness * 1.5, 8),
  });

  /** bbox·svg 에 더할 «세로 여유»(두께 절반 바깥). 꼭짓점·조절점 전부 |y−yMid| ≤ thickness/2 + extraPad 안에 든다.
   *  ⚠️«길이 방향»(선분 양끝 바깥) 넘침은 여기서 안 덮는다 → extraPadAlong. */
  function extraPad(style, { thickness = 12, amplitude = 6, length = 160 } = {}) {
    const t = Math.max(1, +thickness || 12);
    const a = Math.max(0, +amplitude || 0);
    switch (style) {
      case 'scribble': return Math.ceil(Math.max(2, t * 0.28) / 2) + 2;
      case 'brush':    return Math.ceil(t * 0.12 + t * 0.55 / 2) + 2;
      case 'circle': { const g = circleGeom(length, a); return Math.ceil(Math.max(g.ry * 1.16, g.padX * 1.2) + t) + 2; }
      case 'double':   return Math.ceil(a / 2 + t * 0.3 + 1.5 + t / 2) + 2;
      case 'scratch': { const g = scratchGeom(length, t); return Math.ceil(Math.max(g.bow, g.tail) + 1.5 + t / 2) + 2; }
      default: return 0;
    }
  }

  /** «길이 방향» 여유 — 모든 점이 −extraPadAlong ≤ x ≤ length + extraPadAlong 안에 든다(선폭 절반 포함).
   *  circle 만 0 이 아니다: 타원 rx = L/2 + padX 에 흔들림·두 바퀴째 커짐 k ≤ 1.13 이 곱해져 넘침이 «길이에 비례»한다
   *  (1012t1J2 D1 · 이벨류에이터 실측 L=600 17.6px · L=2000 103px 넘침 — 옛 판은 L 항이 없었다).
   *  호출자(sticker-block.js highlightB 렌더)는 이 값을 회전각으로 나눠 bbox 가로·세로 pad 에 얹는다. */
  function extraPadAlong(style, { thickness = 12, amplitude = 6, length = 160 } = {}) {
    if (style !== 'circle') return 0;
    const t = Math.max(1, +thickness || 12);
    const L = Math.max(1, +length || 1);
    const g = circleGeom(L, Math.max(0, +amplitude || 0));
    return Math.ceil(g.rx * 1.13 - L / 2 + Math.max(2, t) / 2) + 2;
  }

  /** 스타일 하나의 획 목록 → [{ d, width, opacity }]. rng = FxSeed.mulberry32(seed). */
  function paths(style, { length = 160, thickness = 12, yMid = 0, amplitude = 6, rng } = {}) {
    if (typeof rng !== 'function') throw new Error('DoodleLine.paths: rng(FxSeed.mulberry32(seed)) 가 필요하다');
    const L = Math.max(1, +length || 1);
    const t = Math.max(1, +thickness || 12);
    const a = Math.max(0, +amplitude || 0);
    const y = +yMid || 0;
    if (style === 'scribble') {
      // 두께 띠 안을 지그재그로 왕복 — 꼭짓점은 띠 가장자리(±t/2)에서 안쪽으로 조금씩 흔들린다
      const step = Math.max(3, t * 0.45);
      const half = t / 2;
      let d = `M${P(0, y + jit(rng, half * 0.3))}`;
      let dir = -1;
      for (let x = step * 0.5; x < L; x += step) {
        const xx = Math.min(L, x + jit(rng, step * 0.2));
        d += ` L${P(xx, y + dir * (half - rng() * t * 0.15))}`;
        dir *= -1;
      }
      d += ` L${P(L, y + jit(rng, half * 0.3))}`;
      return [{ d, width: r2(Math.max(2, t * 0.28)), opacity: 1 }];
    }
    if (style === 'brush') {
      // 주 획 + 위아래로 어긋난 흐린 획 둘. 양끝은 seed 로 조금 «찢는다»(시작·끝 x 를 흔든다)
      const stroke = (off, w, op) => {
        const x0 = Math.abs(jit(rng, t * 0.4));
        const x3 = L - Math.abs(jit(rng, t * 0.4));
        const yy = () => y + off + jit(rng, t * 0.08);
        return { d: `M${P(x0, yy())} C${P(L * 0.33, yy())} ${P(L * 0.66, yy())} ${P(x3, yy())}`, width: r2(w), opacity: op };
      };
      return [stroke(0, t, 1), stroke(-t * 0.2, t * 0.55, 0.55), stroke(t * 0.2, t * 0.55, 0.4)];
    }
    if (style === 'circle') {
      // 선분을 감싸는 손그림 타원 1.1바퀴(끝이 시작을 겹쳐 지나간다) · 반지름이 낮은 주파수로 흔들린다
      const { rx, ry } = circleGeom(L, a);
      const cx = L / 2;
      const ph1 = rng() * Math.PI * 2, ph2 = rng() * Math.PI * 2;
      const start = Math.PI * (0.9 + rng() * 0.3);
      const turns = 1.1, N = 64;
      let d = '';
      for (let i = 0; i <= Math.round(N * turns); i++) {
        const th = start + (i / N) * Math.PI * 2;
        const grow = 1 + 0.05 * (i / N);                    // 두 번째 지날 때 살짝 바깥으로
        const k = (1 + 0.04 * Math.sin(th * 2 + ph1) + 0.03 * Math.sin(th * 3 + ph2)) * grow;
        // 세로 흔들림은 1.16 안(extraPad 계약) — k ≤ (1.07)(1.055) < 1.13
        d += (i === 0 ? 'M' : ' L') + P(cx + Math.cos(th) * rx * k, y + Math.sin(th) * ry * k);
      }
      return [{ d, width: r2(Math.max(2, t)), opacity: 1 }];
    }
    if (style === 'double') {
      // 살짝 휜 두 줄 — yMid ± 간격/2. 아랫줄은 조금 짧게(손으로 두 번 그은 맛)
      const gap = Math.max(2, a) / 2;
      const line = (yy, x0, x3) => {
        const j = () => jit(rng, t * 0.3 + 1.5);
        return `M${P(x0, yy + j())} C${P(L * 0.33, yy + j())} ${P(L * 0.66, yy + j())} ${P(x3, yy + j())}`;
      };
      return [
        { d: line(y - gap, 0, L), width: r2(t), opacity: 1 },
        { d: line(y + gap, L * 0.04, L * 0.96), width: r2(t), opacity: 1 },
      ];
    }
    if (style === 'scratch') {
      // 아래로 살짝 휜 밑줄 하나 + 끝에서 위로 짧게 치켜 올리는 꼬리
      const { bow, tail } = scratchGeom(L, t);
      const j = () => jit(rng, 1.5);
      const xEnd = L * 0.9;
      const d = `M${P(0, y + j())} Q${P(L * 0.45, y + bow + j())} ${P(xEnd, y + j())} L${P(L, y - tail + j())}`;
      return [{ d, width: r2(t), opacity: 1 }];
    }
    return [];
  }

  w.DoodleLine = Object.freeze({ STYLES, PRESETS, LABELS, extraPad, extraPadAlong, paths });
})(window);
