/* ═══════════════════════════════════════════════════════════════════════════
   fx/glow-render.js — 글로우 이펙트 스티커의 «그림» (SVG 문자열을 짓는 순수 함수).
   ───────────────────────────────────────────────────────────────────────────
   ★현빈 「텍스트 네온글로우 이스터에그랑 비슷하면 좋겠어 · 짜치게 PNG 말고」(2026-10-06)
     ⇒ «같은 눈으로 보이되 기법은 SVG». 텍스트 네온(css/editor-blocks.css .tfx-neon)은 text-shadow 라 글자에만 걸린다.
        그 «설계»를 옮긴다: 흰 심(coreColor) + 같은 색 후광 3겹(×세기) + 글로우색을 심 색과 분리 + 색수차(시안/마젠타).
   ★왜 SVG <filter> 인가 — 실측(2026-10-06 태양 · 지디 발주 THREE ㉢ · FOUR ㉢-2):
     PNG 내보내기(CDP · 격리 실앱 오프스크린 fixed ×3)와 썸네일(html2canvas) «두 경로 다» 사는 것은 SVG filter 뿐이다.
     CSS filter: drop-shadow 는 html2canvas 에서 죽는다 · mix-blend-mode(screen·plus-lighter)도 html2canvas 에서 죽는다
     ⇒ ⛔이 그림에 CSS filter·mix-blend-mode 를 쓰지 마라(화면과 썸네일이 갈린다 — 모자이크 전례).
   ★모습의 흔들림은 «저장된 seed» 에서만(js/fx/seeded-random.js FxSeed) — 같은 seed = 같은 그림.
     ⛔이 파일에서 Math.random 을 부르지 마라(리로드·썸네일·undo 마다 모습이 바뀐다).
   ★필터 id 는 호출자가 준다(스티커 block.id 기반 'fxg-<id>' — highlightB 의 'hlb-rough-<id>' 와 같은 꼴).
═══════════════════════════════════════════════════════════════════════════ */
(function (w) {
  /* 프리셋 셋 — 현빈이 보낸 이미지 셋(렌즈 플레어 · 둥근 빛점 · 보라 별 반짝이). 색은 패널에서 바꿀 수 있다.
     ★기본 색은 «값만» 바꾸면 되게 여기 한 자리에 둔다(현빈이 시안을 보고 고르면 이 표만 고친다 — 지디 ②-2). */
  const PRESETS = Object.freeze({
    star:  Object.freeze({ glowColor: '#b06cff', coreColor: '#ffffff', intensity: 70, rays: 4, chroma: '0', fxOpacity: 100, sizeW: 96,  sizeH: 96 }),
    flare: Object.freeze({ glowColor: '#ff9a3c', coreColor: '#fff4e0', intensity: 70, rays: 6, chroma: '0', fxOpacity: 100, sizeW: 180, sizeH: 100 }),
    dot:   Object.freeze({ glowColor: '#ffffff', coreColor: '#ffffff', intensity: 60, rays: 0, chroma: '0', fxOpacity: 100, sizeW: 64,  sizeH: 64 }),
  });
  const KINDS = Object.freeze(Object.keys(PRESETS));

  const r2 = (n) => Math.round(n * 100) / 100;   // 문자열이 기계·판마다 같게(결정성)
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const HEX = /^#[0-9a-fA-F]{3,8}$/;
  const safeColor = (c, fb) => (typeof c === 'string' && (HEX.test(c) || /^rgba?\([0-9.,\s%]+\)$/i.test(c))) ? c : fb;

  /** 가늘고 끝이 뾰족한 빛줄기(마름모) — 중심 (50,50)에서 angle 방향으로 len, 폭 wid. */
  function ray(angleDeg, len, wid) {
    const a = angleDeg * Math.PI / 180;
    const cx = 50, cy = 50;
    const tx = cx + Math.cos(a) * len, ty = cy + Math.sin(a) * len;
    const nx = -Math.sin(a) * wid / 2, ny = Math.cos(a) * wid / 2;
    const mx = cx + Math.cos(a) * len * 0.18, my = cy + Math.sin(a) * len * 0.18;
    return `M${r2(cx)},${r2(cy)} L${r2(mx + nx)},${r2(my + ny)} L${r2(tx)},${r2(ty)} L${r2(mx - nx)},${r2(my - ny)} Z`;
  }

  /** 모양(필터 «안»에 들어갈 것) — kind·rays·seed 로만 정해진다. */
  function shapes(kind, rays, core, glow, rng) {
    const S = w.FxSeed;
    const out = [];
    if (kind === 'dot') {
      out.push(`<circle cx="50" cy="50" r="9" fill="${core}"/>`);
      const n = Math.floor(rng() * 4);                       // 위성 빛점 0~3
      for (let i = 0; i < n; i++) {
        const a = rng() * Math.PI * 2, d = S.range(rng, 20, 34), rr = S.range(rng, 1.5, 3.2);
        out.push(`<circle cx="${r2(50 + Math.cos(a) * d)}" cy="${r2(50 + Math.sin(a) * d)}" r="${r2(rr)}" fill="${core}"/>`);
      }
      return out.join('');
    }
    if (kind === 'star') {
      const n = clamp(rays | 0, 2, 8);
      const base = -90 + S.jitter(rng, 6);
      let d = '';
      for (let i = 0; i < n; i++) d += ray(base + i * 360 / n + S.jitter(rng, 4), 44 * (1 + S.jitter(rng, 0.15)), 4.2) + ' ';
      for (let i = 0; i < n; i++) d += ray(base + (i + 0.5) * 360 / n + S.jitter(rng, 6), 17 * (1 + S.jitter(rng, 0.2)), 2.2) + ' ';
      out.push(`<path d="${d.trim()}" fill="${core}"/>`);
      out.push(`<circle cx="50" cy="50" r="5" fill="${core}"/>`);
      return out.join('');
    }
    // flare — 중심 섬광 + 가로 빛줄기(아나모픽) + 갈래 + 축 위 고스트
    const n = clamp(rays | 0, 0, 12);
    out.push(`<ellipse cx="50" cy="50" rx="48" ry="1.6" fill="${core}"/>`);
    let d = '';
    const base = S.jitter(rng, 10);
    for (let i = 0; i < n; i++) d += ray(base + i * 360 / Math.max(1, n) + S.jitter(rng, 8), S.range(rng, 16, 30), 2.4) + ' ';
    if (d) out.push(`<path d="${d.trim()}" fill="${core}"/>`);
    out.push(`<circle cx="50" cy="50" r="7" fill="${core}"/>`);
    const g = 2 + Math.floor(rng() * 4);                     // 고스트 2~5
    const axis = S.jitter(rng, 25) * Math.PI / 180;
    for (let i = 0; i < g; i++) {
      const t = S.range(rng, -44, 44), rr = S.range(rng, 2, 7.5), op = S.range(rng, 0.22, 0.5);
      out.push(`<circle cx="${r2(50 + Math.cos(axis) * t)}" cy="${r2(50 + Math.sin(axis) * t * 0.55)}" r="${r2(rr)}" fill="${glow}" fill-opacity="${r2(op)}"/>`);
    }
    return out.join('');
  }

  /**
   * @param {object} p  { filterId, kind, glowColor, coreColor, intensity(0~100), rays, chroma('1'|'0'), seed, fxOpacity(0~100) }
   *   ★fxOpacity — 이펙트 «층 통째» 불투명도. 이름을 파티클과 «같게» 쓴다(지디 2026-10-06: 글로우 opacity · 파티클 alpha 로 갈리면
   *     다음 사람이 두 벌로 읽는다). 바깥 <g opacity> 하나 — 안의 색수차 층(0.55)·고스트(fill-opacity)와 «중첩»된다
   *     ⇒ 두 내보내기 경로가 중첩을 같은 값으로 합성하는지 tests/dom/fx-glow-sticker F12 가 잰다.
   * @returns {string} <svg …> 한 장(스티커 상자에 100%로 깔린다 · 후광은 overflow:visible 로 상자 밖까지)
   */
  function svg(p) {
    const kind = KINDS.includes(p.kind) ? p.kind : 'star';
    const pre = PRESETS[kind];
    const glow = safeColor(p.glowColor, pre.glowColor);
    const core = safeColor(p.coreColor, pre.coreColor);
    const I = clamp(Number.isFinite(+p.intensity) ? +p.intensity : pre.intensity, 0, 100) / 100;
    const rays = Number.isFinite(+p.rays) ? +p.rays : pre.rays;
    const seed = +p.seed >>> 0;   // 0 도 정당한 seed(시안과 같은 수열 — seeded-random.js 머리말)
    const op = r2(clamp(Number.isFinite(+p.fxOpacity) ? +p.fxOpacity : (pre.fxOpacity ?? 100), 0, 100) / 100);
    const fid = String(p.filterId || 'fxg-tmp').replace(/[^A-Za-z0-9_-]/g, '');
    const rng = w.FxSeed.mulberry32(seed);
    const body = shapes(kind, rays, core, glow, rng);
    // 네온(.tfx-neon) 매핑: 6/14/28px × 세기 → viewBox 단위(상자 ≈ 100) 4/9/18 × 세기. 세기 0 이어도 아주 옅은 후광은 남긴다.
    const s = (k) => r2(Math.max(0.3, k * I));
    const chroma = (p.chroma === '1' || p.chroma === true)
      ? `<g transform="translate(0.9,0)" opacity="0.55">${body.replace(/fill="[^"]*"/g, 'fill="#00ffff"')}</g>`
        + `<g transform="translate(-0.9,0)" opacity="0.55">${body.replace(/fill="[^"]*"/g, 'fill="#ff0080"')}</g>`
      : '';
    return `<svg class="sticker-glow-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none"`
      + ` width="100%" height="100%" style="display:block;overflow:visible;pointer-events:none;">`
      + `<defs><filter id="${fid}" x="-150%" y="-150%" width="400%" height="400%" color-interpolation-filters="sRGB">`
      + `<feFlood flood-color="${glow}" result="c"/>`
      + `<feComposite in="c" in2="SourceAlpha" operator="in" result="tint"/>`
      + `<feGaussianBlur in="tint" stdDeviation="${s(4)}" result="g1"/>`
      + `<feGaussianBlur in="tint" stdDeviation="${s(9)}" result="g2"/>`
      + `<feGaussianBlur in="tint" stdDeviation="${s(18)}" result="g3"/>`
      + `<feMerge><feMergeNode in="g3"/><feMergeNode in="g2"/><feMergeNode in="g1"/><feMergeNode in="SourceGraphic"/></feMerge>`
      + `</filter></defs>`
      + `<g class="sticker-glow-layer" opacity="${op}"><g class="sticker-glow-body" filter="url(#${fid})">${chroma}${body}</g></g></svg>`;
  }

  w.GlowFx = Object.freeze({ PRESETS, KINDS, svg });
})(window);
