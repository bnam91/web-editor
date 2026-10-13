/* _coin-look.js — 코인의 «생김새» 행 묶음: 재질(금/은/커스텀 · 커스텀일 때만 앞면 색·옆면 색) · 각인 · 두께 · 광택 · 번짐.
 *   코인 스티커 패널(js/props/prop-sticker-coin.js)이 Coin 절 안에 끼운다.
 *   이 파일은 «어디에 저장하는지» 모른다 — 호출자가 id 접두와 get/set/commit 을 준다:
 *     coinLookHTML(idp, v)                     v = { metal, face, side, glyph, k, gloss, blur }  (k·gloss 는 퍼센트 정수)
 *     wireCoinLook(panel, idp, { get, set, commit })
 *        get()         → 지금 값 v (위와 같은 꼴 · 빈 칸·범위 밖은 여기서 정리한다)
 *        set(patch)    → patch 의 키만 저장하고 다시 그린다(히스토리는 안 찍는다)
 *        commit(label) → 히스토리 한 칸(push-after) + 자동저장
 *   ⛔금/은의 색 값은 여기 없다 — js/fx/coin-draw.js 의 CoinFx.PALETTES 한 곳뿐이다(색칸의 첫 값도 CoinFx.baseColors 에서).
 *   색칸의 불투명도 칸은 숨긴다 — 코인 색은 불투명뿐이다(그리개가 알파를 버린다 — CoinFx.toHex6). 보이는 채 두면 값이 먹는 것처럼 보인다.
 *   번짐(1013t2C3) = 섹션 파티클의 「번짐」과 같은 꼴(라벨 · 슬라이더 ＋ 숫자칸) · 같은 범위(CoinFx.LIMITS.blur = ParticlesFx.RANGES.blur). 0 = 끔.
 *   두께·광택·번짐의 범위(CoinFx.LIMITS)와 각인 자르기(CoinFx.cutGlyph)는 그리개 것을 그대로 읽는다 — 칸에 보이는 값 = 그려지는 값.
 *   각인 행은 「각인 + 직접 입력 칸」 한 줄, 그 아래 칩 다섯을 라벨 없이 한 줄(라벨 옆에는 칩 넷까지만 들어가 다섯째가 혼자 둘째 줄로 떨어진다).
 *   숫자칸의 범위·빈 값 처리는 칸의 min/max 를 읽는 공용 가드(prop-number-commit-guard.js)가 한다.
 */
import { colorFieldHTML, wireColorField } from './color-picker.js';
import { escHtml } from './_helpers.js';

const METALS = [['gold', '금'], ['silver', '은'], ['custom', '커스텀']];
const GLYPHS = [['$', '$'], ['₩', '₩'], ['P', 'P'], ['%', '%'], ['', '없음']];

/* 저장값 → 정수. 그리기(sticker-block.js coin 갈래)와 같은 읽기(parseFloat) — 손댄 저장본에서도 칸과 그림이 같은 값을 본다. */
const int = (v, fb) => { const n = parseFloat(v); return Number.isFinite(n) ? Math.round(n) : fb; };
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const fx = () => window.CoinFx;
const glyphMax = () => fx()?.GLYPH_MAX ?? 2;
const limits = (key) => fx()?.LIMITS?.[key] || [0, 100];
const cutGlyph = (s) => (fx() ? fx().cutGlyph(s) : '');

/** 값 정리 — 빈 칸·범위 밖·모르는 재질을 기본값·범위 안으로. */
function norm(v) {
  const D = fx()?.DEFAULTS || {};
  const metal = METALS.some(([m]) => m === v?.metal) ? v.metal : (D.metal || 'gold');
  const base = fx()?.baseColors?.(metal === 'custom' ? 'gold' : metal) || { face: '', side: '' };
  return {
    metal,
    face: fx()?.toHex6?.(v?.face) || base.face,
    side: fx()?.toHex6?.(v?.side) || base.side,
    glyph: v?.glyph == null ? (D.glyph ?? '$') : cutGlyph(v.glyph),
    k: clamp(int(v?.k, D.k ?? 22), ...limits('k')),
    gloss: clamp(int(v?.gloss, D.gloss ?? 22), ...limits('gloss')),
    blur: clamp(int(v?.blur, 0), ...limits('blur')),
  };
}

export function coinLookHTML(idp, value) {
  const v = norm(value);
  const custom = v.metal === 'custom';
  const on = (c) => (c ? ' active' : '');
  const n = glyphMax();
  const [K_MIN, K_MAX] = limits('k'), [GLOSS_MIN, GLOSS_MAX] = limits('gloss'), [BLUR_MIN, BLUR_MAX] = limits('blur');
  return `
      <div class="prop-row"><span class="prop-label">재질</span>
        <div class="prop-align-group" id="${idp}-metal">
          ${METALS.map(([m, t]) => `<button class="prop-align-btn${on(m === v.metal)}" data-coin-metal="${m}" title="${t}">${t}</button>`).join('')}
        </div>
      </div>
      <div class="prop-row" id="${idp}-face-row" style="display:${custom ? 'flex' : 'none'};"><span class="prop-label">앞면 색</span>
        ${colorFieldHTML({ idPrefix: `${idp}-face`, hex: v.face, alpha: 100 })}
      </div>
      <div class="prop-row" id="${idp}-side-row" style="display:${custom ? 'flex' : 'none'};"><span class="prop-label">옆면 색</span>
        ${colorFieldHTML({ idPrefix: `${idp}-side`, hex: v.side, alpha: 100 })}
      </div>
      <div class="prop-row"><span class="prop-label">각인</span>
        <input type="text" class="prop-input" id="${idp}-glyph" value="${escHtml(v.glyph)}" placeholder="직접 입력 (1~${n}자)" aria-label="각인 글자 직접 입력" title="각인 글자 직접 입력 (1~${n}자) · 비우면 각인 없음">
      </div>
      <div class="prop-row">
        <div class="prop-align-group" id="${idp}-glyphs">
          ${GLYPHS.map(([g, t]) => `<button class="prop-align-btn${on(g === v.glyph)}" data-coin-glyph="${escHtml(g)}" title="${g ? `각인 ${escHtml(g)}` : '각인 없음'}">${escHtml(t)}</button>`).join('')}
        </div>
      </div>
      <div class="prop-row"><span class="prop-label">두께</span>
        <input type="range" class="prop-slider" id="${idp}-k" min="${K_MIN}" max="${K_MAX}" step="1" value="${v.k}">
        <input type="number" class="prop-number" id="${idp}-k-num" min="${K_MIN}" max="${K_MAX}" value="${v.k}">
      </div>
      <div class="prop-row"><span class="prop-label">광택</span>
        <input type="range" class="prop-slider" id="${idp}-gloss" min="${GLOSS_MIN}" max="${GLOSS_MAX}" step="1" value="${v.gloss}">
        <input type="number" class="prop-number" id="${idp}-gloss-num" min="${GLOSS_MIN}" max="${GLOSS_MAX}" value="${v.gloss}">
      </div>
      <div class="prop-row"><span class="prop-label">번짐</span>
        <input type="range" class="prop-slider" id="${idp}-blur" min="${BLUR_MIN}" max="${BLUR_MAX}" step="1" value="${v.blur}">
        <input type="number" class="prop-number" id="${idp}-blur-num" min="${BLUR_MIN}" max="${BLUR_MAX}" value="${v.blur}" aria-label="번짐">
      </div>`;
}

/** 슬라이더 + 숫자칸 한 쌍. @param {(v:number)=>void} write  값 쓰기 + 다시 그리기 · @param {()=>void} done  히스토리 한 칸 */
function wireCoinPair(panel, sliderId, numberId, write, done) {
  const s = panel.querySelector('#' + sliderId), n = panel.querySelector('#' + numberId);
  if (!s || !n) return;
  const apply = (raw) => {
    const v = clamp(Math.round(+raw || 0), +s.min, +s.max);
    s.value = v; n.value = v; write(v);
  };
  s.addEventListener('input', () => apply(s.value));
  n.addEventListener('input', () => apply(n.value));
  s.addEventListener('change', () => done());
  n.addEventListener('change', () => done());
}

export function wireCoinLook(panel, idp, { get, set, commit }) {
  const $ = (id) => panel.querySelector('#' + id);
  const cur = () => norm(get());

  /* ── 재질 ── */
  const metalBtns = panel.querySelectorAll(`#${idp}-metal [data-coin-metal]`);
  metalBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const before = cur(), metal = btn.dataset.coinMetal;
      if (before.metal === metal) return;
      const patch = { metal };
      if (metal === 'custom') {
        /* 커스텀으로 넘어갈 때 색칸의 첫 값 = 전에 고른 커스텀 색, 없으면 «지금 보이던» 금속의 대표 두 색
           ⇒ 누르는 순간 그림이 안 바뀐 것처럼 보이고, 거기서부터 색을 고친다. 그 값을 저장도 한다(색칸 = 저장값). */
        const raw = get() || {};
        const base = fx()?.baseColors?.(before.metal) || before;
        patch.face = fx()?.toHex6?.(raw.face) || base.face;
        patch.side = fx()?.toHex6?.(raw.side) || base.side;
        const show = (key, hex) => {
          const p = $(`${idp}-${key}-color`), h = $(`${idp}-${key}-hex`);
          if (p) { p.value = hex; const sw = p.closest('.prop-color-swatch'); if (sw) sw.style.background = hex; }
          if (h) h.value = hex.replace('#', '').toUpperCase();
        };
        show('face', patch.face); show('side', patch.side);
      }
      set(patch);
      metalBtns.forEach((b) => b.classList.toggle('active', b === btn));
      [`${idp}-face-row`, `${idp}-side-row`].forEach((id) => { const r = $(id); if (r) r.style.display = metal === 'custom' ? 'flex' : 'none'; });
      commit('코인 재질');
    });
  });

  const hexOf = (c) => fx()?.toHex6?.(c) || c;
  wireColorField(`${idp}-face`, { initialAlpha: 100, onApply: (c) => set({ face: hexOf(c) }), onCommit: () => commit('코인 앞면 색') });
  wireColorField(`${idp}-side`, { initialAlpha: 100, onApply: (c) => set({ side: hexOf(c) }), onCommit: () => commit('코인 옆면 색') });
  /* 불투명도 칸을 숨기고 끈다 — 공용 색칸은 그 칸이 있어야 배선되므로 마크업은 두고 이 두 칸에서만 접는다(다른 패널 색칸 무영향). */
  ['face', 'side'].forEach((key) => {
    const a = $(`${idp}-${key}-alpha`);
    if (!a) return;
    a.disabled = true;
    const box = a.closest('.prop-color-alpha');
    if (box) box.style.display = 'none';
  });

  /* ── 각인 — 칩과 직접 입력 칸은 같은 값의 두 얼굴이다 ── */
  const gIn = $(`${idp}-glyph`);
  const glyphBtns = panel.querySelectorAll(`#${idp}-glyphs [data-coin-glyph]`);
  const markGlyph = (g) => glyphBtns.forEach((b) => b.classList.toggle('active', b.dataset.coinGlyph === g));
  glyphBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const g = btn.dataset.coinGlyph;
      if (cur().glyph === g) return;
      set({ glyph: g }); markGlyph(g);
      if (gIn) gIn.value = g;
      commit('코인 각인');
    });
  });
  if (gIn) {
    /* 넘친 글자는 그 자리에서 잘라 칸에 되쓴다. 단 한글 조합 중에는 칸을 건드리지 않는다(조합이 끊긴다)
       — 그때는 저장값만 자르고, 칸은 확정(change) 때 저장값으로 맞춘다. */
    gIn.addEventListener('input', (e) => {
      const g = cutGlyph(gIn.value);
      if (!e.isComposing && gIn.value !== g) gIn.value = g;
      set({ glyph: g }); markGlyph(g);
    });
    gIn.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); gIn.blur(); } });
    gIn.addEventListener('change', () => { gIn.value = cur().glyph; commit('코인 각인'); });
  }

  wireCoinPair(panel, `${idp}-k`, `${idp}-k-num`, (v) => set({ k: v }), () => commit('코인 두께'));
  wireCoinPair(panel, `${idp}-gloss`, `${idp}-gloss-num`, (v) => set({ gloss: v }), () => commit('코인 광택'));
  wireCoinPair(panel, `${idp}-blur`, `${idp}-blur-num`, (v) => set({ blur: v }), () => commit('코인 번짐'));
}
