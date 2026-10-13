/* ═══════════════════════════════════════════════════════════════════════════
   fx/coin-draw.js — 코인 스티커의 «그림» (SVG 문자열을 짓는 순수 함수 · window.CoinFx).
   ───────────────────────────────────────────────────────────────────────────
   기울어진 동전 한 닢을 SVG 로 그린다. CSS 3D transform 은 쓰지 않는다 — 앞면은 타원(ry = r·cos τ),
   옆띠는 높이 d·k·sin τ 인 띠다. 그래서 화면 · 썸네일 · PNG · 내보낸 HTML 이 같은 그림을 본다.
   소비자: js/blocks/sticker-block.js 의 shape:'coin' 갈래(그리기) · js/props/_coin-look.js(패널의 기본값·색 정규화).

   ════ 계약 ════
   CoinFx.PALETTES            { gold, silver } — 금/은 색의 «유일한» 표(freeze). ⛔다른 파일에 코인 색을 적지 마라.
   CoinFx.DEFAULTS            { metal:'gold', glyph:'$', k:22, gloss:22, size:120 }
                              ★k·gloss 는 «퍼센트 정수»(dataset 에 적는 꼴)다. svg() 에는 k 만 ÷100 해서 넘긴다.
   CoinFx.GLYPH_MAX           2 — 각인 글자 수 상한. 그리개도 패널도 이 수를 읽는다.
   CoinFx.LIMITS              { k:[8,40], gloss:[0,100] } — 두께 %·광택의 범위. 패널의 칸(min/max)과 그리개의 가두기가 «같은 표»를 읽는다.
   CoinFx.cutGlyph(s)         → 각인 글자 정리: 공백뿐이면 ''(= 각인 없음), 아니면 앞에서 GLYPH_MAX «글자»만.
                              글자 = 그래핌(Intl.Segmenter — 이음표로 묶인 이모지·결합 부호가 반쪽 나지 않는다), 없는 엔진에선 코드포인트.
                              그리개와 패널이 이 함수 하나를 쓴다(칸에 보이는 글자 = 그려지는 글자).
   CoinFx.toHex6(c)           → '#rrggbb' | null.  #rgb · #rrggbb · #rrggbbaa · rgb() · rgba() 수용(알파는 버린다). 못 읽으면 null — 반쪽 색을 내지 않는다.
   CoinFx.baseColors(metal)   → { face, side } — 그 금속의 대표 두 색(「커스텀」으로 넘어갈 때 색칸의 첫 값).
   CoinFx.paletteFor({ metal, face, side })
                              → 팔레트 객체. metal 이 'custom' 이면 face·side 두 색에서 만든다(못 읽는 색 = 금색 대표값).
                                그 밖은 표에 «제 열쇠로» 있는 재질만, 나머지(모르는 값 · constructor 같은 객체 내장 이름)는 gold.
   CoinFx.angleFromSeed(seed) → [tilt(0~80), dir(-180~180)] — 무늬번호 → 보는 각도. 같은 번호 = 같은 각도.
   CoinFx.svg(o)              → '<svg …>' 한 장(스티커 상자에 100% 로 깔린다).
       o = { idPrefix(★필수 · 문서 안에서 고유),
             tilt(0~88 · 0 = 정면), dir(평면 안 회전 · 반시계가 +),
             k(두께 «비율» · 기본 0.22 · LIMITS.k ÷ 100 으로 가둔다), gloss(0~100 · 기본 22),
             glyph(각인 · 기본 '$' · '' = 없음 · cutGlyph 로 자르고 & < > " 를 이스케이프한다),
             metal('gold'|'silver'|'custom') + face · side,
             extRot(상자에 바깥에서 걸린 회전 · CSS 각도 = 시계가 + · «빛 방향 보정»에만 쓴다 — 그림을 돌리지는 않는다) }
       · id 는 «접두에서만» 짓는다: <접두>s · f · d · h · i · g · cf · ch (접두의 [^A-Za-z0-9_-] 는 벗긴다).
         ⛔전역 카운터 없음 — 같은 입력 = 같은 문자열. pushHistory 의 무변화 차단과 저장본 비교가 이 성질에 기댄다.
       · viewBox 는 각도와 무관하게 [-m,-m,2m,2m] (m = 100·(0.5+k)) «고정» ⇒ 다시뽑기에 코인 크기가 출렁이지 않는다.
         preserveAspectRatio="xMidYMid meet" 라 상자 비율이 깨져도 코인은 둥글다. 상자 한 변 S 일 때 지름 = S ÷ (1 + 2k).
       · class 속성을 내지 않는다(배송본의 CSS 쓸기 규칙에 안 걸리게).
       · ★어떤 입력에도 던지지 않는다 — 저장본을 다시 열 때 스티커를 차례로 그리는데(rebindAll), 하나가 던지면 뒤 스티커가 전부 안 그려진다.
         못 읽는 수(NaN·빈 값·무한)는 기본값, 범위 밖은 끝값, 모르는 재질·색은 금으로 떨어진다.

   ★난수는 window.FxSeed.mulberry32 «만» 쓴다(js/fx/seeded-random.js). ⛔이 파일에서 Math.random 을 부르지 마라
     — 리로드·undo·내보내기가 매번 다시 그리므로 그림이 달라진다. 새 무늬번호(FxSeed.newSeed)는 호출자가
     «만들 때 · 다시뽑기 때»만 뽑는다.
   ⚠️고전 스크립트다 — index.html 에서 seeded-random.js «뒤», 모듈(sticker-block.js) «앞».
   회귀: tests/unit/coin-sticker-draw.test.mjs · tests/dom/coin-sticker.dom.spec.js
═══════════════════════════════════════════════════════════════════════════ */
(function (w) {
  const hex2 = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const mix = (a, b, t) => { const A = hex2(a), B = hex2(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join(''); };
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  /* 소수 둘째 자리 · -0 → 0 — 문자열이 기계·판마다 같아야 한다(결정성). */
  const f = (n) => { const v = Math.round(n * 100) / 100; return (Object.is(v, -0) ? 0 : v).toString(); };
  const num = (v, fb) => (v !== '' && v != null && Number.isFinite(+v) ? +v : fb);

  /* ★금/은 색의 유일한 표. */
  const PALETTES = Object.freeze({
    gold: Object.freeze({ face: Object.freeze(['#FFE9A8', '#F5C542', '#E8B22A']), floor: Object.freeze(['#F9D568', '#EFBB3A', '#DDA224']), top: '#FBDD7C',
      sideD: Object.freeze(['#8A5808', '#A86E0C', '#C98A14']), sideL: Object.freeze(['#B87A10', '#E0A42C', '#F6CC5C']),
      wallD: '#B67C10', wallL: '#DDA22C', rimHi: '#FFF3C4', rimLo: '#D99A1E', shade: '#C68A12' }),
    silver: Object.freeze({ face: Object.freeze(['#F6F8FB', '#D3D9E2', '#B4BCC8']), floor: Object.freeze(['#E3E7EE', '#C6CDD8', '#A9B2BF']), top: '#EEF1F6',
      sideD: Object.freeze(['#5C6470', '#6F7885', '#8E97A4']), sideL: Object.freeze(['#8690A0', '#B0B9C6', '#DDE2EA']),
      wallD: '#7C8592', wallL: '#AEB7C4', rimHi: '#FFFFFF', rimLo: '#9AA3B0', shade: '#8E97A4' }),
  });
  const WHITE = '#ffffff', BLACK = '#000000';
  const COIN_K = 0.22;      /* 두께 비율 기본값 */
  const GLYPH_MAX = 2;
  const LIMITS = Object.freeze({ k: Object.freeze([8, 40]), gloss: Object.freeze([0, 100]) });
  const DEFAULTS = Object.freeze({ metal: 'gold', glyph: '$', k: 22, gloss: 22, size: 120 });

  /** 색 문자열 → '#rrggbb' (알파 버림). 못 읽으면 null. */
  function toHex6(c) {
    if (typeof c !== 'string') return null;
    const s = c.trim();
    let m = /^#([0-9a-f]{3})$/i.exec(s);
    if (m) return '#' + m[1].split('').map((x) => x + x).join('').toLowerCase();
    m = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(s);
    if (m) return '#' + m[1].toLowerCase();
    m = /^rgba?\(\s*(\d+(?:\.\d+)?)\s*[, ]\s*(\d+(?:\.\d+)?)\s*[, ]\s*(\d+(?:\.\d+)?)\s*(?:[,/]\s*\d*\.?\d+%?\s*)?\)$/i.exec(s);
    if (m) return '#' + [m[1], m[2], m[3]].map((v) => clamp(Math.round(+v), 0, 255).toString(16).padStart(2, '0')).join('');
    return null;
  }

  /* 「커스텀」 — 앞면 색·옆면 색 두 값에서 나머지 단계를 밝게/어둡게 섞어 만든다. */
  function customPalette(face, side) {
    const W = WHITE, K = BLACK;
    return { face: [mix(face, W, .55), face, mix(face, K, .1)], floor: [mix(face, W, .15), mix(face, K, .06), mix(face, K, .16)], top: mix(face, W, .3),
      sideD: [mix(side, K, .35), mix(side, K, .15), side], sideL: [side, mix(side, W, .3), mix(side, W, .55)],
      wallD: mix(side, K, .05), wallL: mix(side, W, .3), rimHi: mix(face, W, .8), rimLo: mix(side, W, .1), shade: mix(side, W, .05) };
  }
  /* 표에 «제 열쇠로» 있는 재질만 — PALETTES[metal] 로 바로 읽으면 'constructor'·'toString' 같은 이름이 객체 내장 값을 집어 와 그리기가 던진다. */
  const paletteOf = (metal) => (typeof metal === 'string' && Object.prototype.hasOwnProperty.call(PALETTES, metal) ? PALETTES[metal] : PALETTES.gold);
  function baseColors(metal) {
    const P = paletteOf(metal);
    return { face: P.face[1].toLowerCase(), side: P.sideD[2].toLowerCase() };
  }
  function paletteFor(o) {
    const metal = o && o.metal;
    if (metal === 'custom') {
      const base = baseColors('gold');
      return customPalette(toHex6(o.face) || base.face, toHex6(o.side) || base.side);
    }
    return paletteOf(metal);
  }

  /* 각인은 SVG <text> 의 글자로 들어간다 — 사용자가 친 글자를 그대로 마크업에 꽂지 않는다.
     (이 파일은 고전 스크립트라 js/props/_helpers.js 의 escHtml(모듈)을 import 할 수 없다.) */
  const escText = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const _seg = (typeof Intl !== 'undefined' && Intl.Segmenter) ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;
  function cutGlyph(s) {
    const str = String(s == null ? '' : s);
    if (!str.trim()) return '';
    const chars = _seg ? Array.from(_seg.segment(str), (x) => x.segment) : Array.from(str);
    return chars.slice(0, GLYPH_MAX).join('');
  }
  const cleanId = (s) => String(s == null ? '' : s).replace(/[^A-Za-z0-9_-]/g, '') || 'coin';

  /* 코인 한 닢 — 중심 (0,0), 지름 d. */
  function coin(o, d) {
    const r = d / 2, k = num(o.k, COIN_K);
    const tau = clamp(num(o.tilt, 0), 0, 88) * Math.PI / 180;
    const c = Math.max(Math.cos(tau), 0.03), s = Math.sin(tau);
    const ry = r * c, dep = d * k * s;
    const a = -(num(o.dir, 0) % 360);              /* SVG 회전각(시계가 +) · 아주 큰 수가 와도 한 바퀴 안으로 */
    const aLight = a + (num(o.extRot, 0) % 360);           /* 화면에서 실제로 돌아간 각 — 빛·광택 보정에만 */
    const ar = aLight * Math.PI / 180;
    const P = paletteFor(o);
    const glyph = escText(cutGlyph(o.glyph == null ? DEFAULTS.glyph : o.glyph));
    const gloss = clamp(num(o.gloss, DEFAULTS.gloss), 0, 100) / 100;
    const id = cleanId(o.idPrefix);

    /* 빛 — 화면 기준 왼쪽 위에서 온다. 코인 좌표계로 돌려 둔다(코인이 돌아도 빛은 안 돈다). */
    const Lx = -0.6, Ly = -0.8;
    const lx = Lx * Math.cos(ar) + Ly * Math.sin(ar);
    const ly = -Lx * Math.sin(ar) + Ly * Math.cos(ar);
    const wl = clamp((ly + 1) / 2, 0, 1);          /* 옆면(코인 좌표 +y 쪽 벽)이 빛을 받는 정도 */
    const sEdge = mix(P.sideD[0], P.sideL[0], wl), sMid = mix(P.sideD[1], P.sideL[1], wl), sHi = mix(P.sideD[2], P.sideL[2], wl);
    const wall = mix(P.wallD, P.wallL, wl);
    const hx = clamp(0.5 + 0.36 * lx, 0.2, 0.8);

    const hole = 0.82;                             /* 테 안쪽 경계(반지름 비) */
    const hy = d * 0.03 * s;                       /* 양각 높이가 화면에서 드러나는 길이 */
    const b = d * 0.009;                           /* 정면일 때도 양각이 읽히게 하는 빛 어긋남 */
    const fs = d * 0.56, ty = fs * 0.34, sw = d * 0.012;
    const nWall = clamp(Math.ceil(hy / 0.7), 0, 6);
    const font = `font-family="-apple-system, 'Pretendard', sans-serif" font-weight="700" font-size="${f(fs)}" text-anchor="middle"`;
    const txt = (ox, oy, fill, extra) => `<g transform="translate(${f(ox)} ${f(oy)}) scale(1 ${f(c)})"><text y="${f(ty)}" ${font} fill="${fill}" stroke="${fill}" stroke-width="${f(sw)}" stroke-linejoin="round"${extra ? ' ' + extra : ''}>${glyph}</text></g>`;
    const axis = `gradientUnits="userSpaceOnUse" x1="${f(lx * r)}" y1="${f(ly * r)}" x2="${f(-lx * r)}" y2="${f(-ly * r)}"`;

    let g = '<defs>'
      + `<linearGradient id="${id}s" x1="0" x2="1" y1="0" y2="0">`
      + `<stop offset="0" stop-color="${sEdge}"/><stop offset="${f(Math.max(hx - .24, .02))}" stop-color="${sMid}"/><stop offset="${f(hx)}" stop-color="${sHi}"/><stop offset="${f(Math.min(hx + .26, .98))}" stop-color="${sMid}"/><stop offset="1" stop-color="${sEdge}"/>`
      + '</linearGradient>'
      + `<linearGradient id="${id}f" ${axis}><stop offset="0" stop-color="${P.face[0]}"/><stop offset=".5" stop-color="${P.face[1]}"/><stop offset="1" stop-color="${P.face[2]}"/></linearGradient>`
      + `<linearGradient id="${id}d" ${axis}><stop offset="0" stop-color="${P.floor[0]}"/><stop offset=".55" stop-color="${P.floor[1]}"/><stop offset="1" stop-color="${P.floor[2]}"/></linearGradient>`
      + `<linearGradient id="${id}h" ${axis}><stop offset="0" stop-color="${P.rimHi}" stop-opacity=".95"/><stop offset=".55" stop-color="${P.rimHi}" stop-opacity="0"/></linearGradient>`
      + `<linearGradient id="${id}i" ${axis}><stop offset=".45" stop-color="${P.rimHi}" stop-opacity="0"/><stop offset="1" stop-color="${P.rimHi}" stop-opacity=".9"/></linearGradient>`
      + `<linearGradient id="${id}g" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${WHITE}" stop-opacity="0"/><stop offset=".5" stop-color="${WHITE}" stop-opacity="1"/><stop offset="1" stop-color="${WHITE}" stop-opacity="0"/></linearGradient>`
      + `<clipPath id="${id}cf"><ellipse rx="${f(r)}" ry="${f(ry)}"/></clipPath>`
      + `<clipPath id="${id}ch"><ellipse rx="${f(r * hole)}" ry="${f(ry * hole)}"/></clipPath>`
      + '</defs>';

    /* ①② 뒷면 + 옆띠 — 한 모양으로(이음매가 안 뜬다) */
    g += `<path d="M ${f(-r)} 0 L ${f(-r)} ${f(dep)} A ${f(r)} ${f(ry)} 0 0 0 ${f(r)} ${f(dep)} L ${f(r)} 0 Z" fill="url(#${id}s)"/>`;
    /* ③ 톱니 — 원기둥 벽의 세로 홈(가장자리로 갈수록 촘촘해진다) */
    if (dep > 2.2) {
      const n = clamp(Math.round(d * 0.24), 12, 46);
      let reed = '';
      for (let i = 1; i < n; i++) {
        const th = (-90 + 180 * i / n) * Math.PI / 180;
        reed += `M ${f(r * Math.sin(th))} ${f(ry * Math.cos(th))} v ${f(dep)} `;
      }
      g += `<path d="${reed.trim()}" stroke="${P.sideD[0]}" stroke-width="${f(Math.max(0.6, d * 0.007))}" opacity=".32" fill="none"/>`;
    }
    g += `<path d="M ${f(-r)} ${f(dep)} A ${f(r)} ${f(ry)} 0 0 0 ${f(r)} ${f(dep)}" stroke="${P.sideD[0]}" stroke-width="${f(Math.max(.6, d * .008))}" opacity=".35" fill="none"/>`;
    /* ④ 앞면 */
    g += `<ellipse rx="${f(r)}" ry="${f(ry)}" fill="url(#${id}f)"/>`;
    /* ⑤ 테 — 안쪽이 한 단 꺼진다: 벽(어둠) 위에 바닥 타원을 hy 만큼 내려 덮는다 */
    g += `<ellipse rx="${f(r * hole)}" ry="${f(ry * hole)}" fill="${wall}"/>`;
    g += `<g clip-path="url(#${id}ch)"><ellipse cx="${f(-lx * b)}" cy="${f(hy - ly * b)}" rx="${f(r * hole)}" ry="${f(ry * hole)}" fill="url(#${id}d)"/>`;
    /* ⑥ 각인 — 바닥(hy)에서 테 높이(0)까지 쌓아 올린 양각 */
    if (glyph) {
      g += txt(-lx * b * 1.6, hy - ly * b * 1.6, P.shade, 'opacity=".55"');
      for (let i = 0; i <= nWall; i++) g += txt(0, hy * (1 - i / Math.max(nWall, 1)), wall);
      g += txt(lx * b, ly * b, P.rimHi);
      g += txt(0, 0, P.top);
    }
    g += '</g>';
    g += `<ellipse rx="${f(r * hole)}" ry="${f(ry * hole)}" fill="none" stroke="url(#${id}i)" stroke-width="${f(d * 0.012)}"/>`;
    g += `<ellipse rx="${f(r - d * 0.008)}" ry="${f(Math.max(ry - d * 0.008, .5))}" fill="none" stroke="url(#${id}h)" stroke-width="${f(d * 0.016)}"/>`;
    g += `<ellipse rx="${f(r)}" ry="${f(ry)}" fill="none" stroke="${P.rimLo}" stroke-width="${f(Math.max(.5, d * 0.006))}" opacity=".7"/>`;
    /* ⑦ 광택 — 앞면으로 오려 낸 흰 사선 띠(화면 기준 -35°) */
    if (gloss > 0) g += `<g clip-path="url(#${id}cf)"><rect x="${f(-d)}" y="${f(-d * 0.11)}" width="${f(d * 2)}" height="${f(d * 0.22)}" fill="url(#${id}g)" opacity="${f(gloss)}" transform="rotate(${f(-35 - aLight)}) translate(0 ${f(-d * 0.16)})"/></g>`;

    return `<g transform="rotate(${f(a)})">${g}</g>`;
  }

  /** 무늬번호 → 보는 각도 [기울기, 방향]. 다시뽑기는 «보는 각도»만 바꾼다. */
  function angleFromSeed(seed) {
    const S = w.FxSeed;
    if (!S) { console.error('[CoinFx.angleFromSeed] FxSeed 가 안 실렸다 — index.html 고전 스크립트 순서'); return [0, 0]; }
    const R = S.mulberry32(seed >>> 0);
    return [Math.round(R() * 80), Math.round(R() * 360 - 180)];
  }

  const SVG_D = 100;   /* viewBox 안에서의 코인 지름 */
  function svg(o) {
    const k = clamp(num(o.k, COIN_K), LIMITS.k[0] / 100, LIMITS.k[1] / 100);   /* 범위 밖이면 viewBox 가 0 이나 천문학적 수가 되어 코인이 안 보인다 */
    const m = SVG_D * (0.5 + k);
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${f(-m)} ${f(-m)} ${f(2 * m)} ${f(2 * m)}" preserveAspectRatio="xMidYMid meet"`
      + ' width="100%" height="100%" style="display:block;overflow:visible;pointer-events:none;">'
      + coin({ ...o, k }, SVG_D)
      + '</svg>';
  }

  w.CoinFx = Object.freeze({ PALETTES, DEFAULTS, GLYPH_MAX, LIMITS, cutGlyph, toHex6, baseColors, paletteFor, angleFromSeed, svg });
})(window);
