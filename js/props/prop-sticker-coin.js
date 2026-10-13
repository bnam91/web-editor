/* prop-sticker-coin.js — 코인 스티커(shape:'coin')의 우측 패널 절.
 *   prop-sticker.js 가 shape==='coin' 일 때 이 절만 보이고 원·사각 기본 절·Shape 고르기는 숨긴다(glow 와 같은 길).
 *   행(이 순서): [다시뽑기] · 무늬번호 · 재질(금/은/커스텀 · 색) · 각인 · 두께 · 광택(= _coin-look.js) · 각도 잠금
 *   이동·크기·회전은 패널에 없다 — 캔버스의 스티커 손잡이(js/sticker-select.js)가 한다.
 *   ★다시뽑기 = «보는 각도만» 바꾼다: 새 무늬번호 → CoinFx.angleFromSeed → data-coin-tilt · data-coin-dir.
 *     그림의 정본은 tilt·dir 두 값이고, 무늬번호 칸도 같은 길로 이 둘을 다시 쓴다(같은 번호 = 같은 각도).
 *   ★각도 잠금(data-coin-lock="1") = 이 코인의 각도를 굳힌다. 켜면 [다시뽑기]와 무늬번호 칸이 disabled 가 되고,
 *     각도를 쓰는 길(applySeed)도 잠금을 «다시» 본다 — 칸의 disabled 는 표시일 뿐이라 그것만 믿지 않는다.
 *     재질·각인·두께·광택과 캔버스 손잡이는 잠금과 무관하다. 끄면 속성을 지운다(저장본에 "0" 을 남기지 않는다).
 *   ⛔무늬번호는 여기서만 새로 뽑는다(FxSeed.newSeed) — 그림(js/fx/coin-draw.js)은 값을 «읽기만» 한다.
 *   히스토리 = push-after(쓰고 그린 뒤 pushHistory) — glow 절과 같은 규약. 조작 한 번 = 한 칸.
 */
import { coinLookHTML, wireCoinLook } from './_coin-look.js';

const SEED_MAX = 4294967295;   // uint32 — FxSeed.mulberry32 가 받는 범위

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
/* 칸의 글자 → 무늬번호. 빈 칸·못 읽는 값은 null(= 아무것도 안 쓴다 — 빈 칸이 0 번으로 읽히면 안 된다). */
const seedOf = (v) => { if (v == null || v === '') return null; const n = Math.round(Number(v)); return Number.isFinite(n) ? clamp(n, 0, SEED_MAX) : null; };
const isLocked = (block) => block.dataset.coinLock === '1';
const lookOf = (d) => ({ metal: d.coinMetal, face: d.coinFace, side: d.coinSide, glyph: d.coinGlyph, k: d.coinK, gloss: d.coinGloss });
const LOOK_KEY = { metal: 'coinMetal', face: 'coinFace', side: 'coinSide', glyph: 'coinGlyph', k: 'coinK', gloss: 'coinGloss' };

export function coinSectionHTML(block) {
  const d = block.dataset;
  const seed = seedOf(d.seed) ?? 1;
  const locked = isLocked(block);
  const off = locked ? ' disabled' : '';
  return `
    <div class="prop-section" id="stk-coin-section">
      <div class="prop-section-title">Coin</div>
      <div class="prop-row">
        <button class="prop-action-btn" id="stk-coin-reroll" style="width:100%;" title="보는 각도만 새로 뽑는다(자리·크기·색은 그대로)"${off}>다시뽑기</button>
      </div>
      <div class="prop-row"><span class="prop-label">무늬번호</span>
        <input type="number" class="prop-number" id="stk-coin-seed" style="flex:1;min-width:0" min="0" max="${SEED_MAX}" step="1" value="${seed}" aria-label="무늬번호" title="같은 번호 = 같은 각도"${off}>
      </div>
${coinLookHTML('stk-coin', lookOf(d))}
      <div class="prop-row"><span class="prop-label">각도 잠금</span>
        <label class="prop-toggle" title="켜면 다시뽑기와 무늬번호가 이 코인의 각도를 바꾸지 않는다">
          <input type="checkbox" id="stk-coin-lock" aria-label="각도 잠금"${locked ? ' checked' : ''}>
          <span class="prop-toggle-track"></span>
        </label>
      </div>
    </div>`;
}

/** @param {HTMLElement} panel  propPanel · @param {Function} rerender  renderStickerBlock + rememberStickerStyle */
export function wireCoinSection(panel, block, rerender) {
  const commit = (label) => { window.pushHistory?.(label); window.scheduleAutoSave?.(); };
  const $ = (id) => panel.querySelector('#' + id);
  /* 그리기가 innerHTML 을 갈아 끼워 손잡이가 사라진다 — 고른 채면 다시 단다(카운트 절과 같은 꼴).
     손잡이를 다시 달 때 떨어지는 작은 상자 표시(tiny)는 지켜 준다. */
  const redraw = () => {
    const tiny = block.classList.contains('tiny');
    rerender();
    if (!block.classList.contains('selected')) return;
    window._addCornerHandles?.(block);
    block.classList.toggle('tiny', tiny);
  };
  const rerollBtn = $('stk-coin-reroll'), seedIn = $('stk-coin-seed'), lockIn = $('stk-coin-lock');

  /* 무늬번호 → 각도 두 값. 잠겼으면 아무것도 안 쓰고 false. */
  const applySeed = (raw) => {
    const C = window.CoinFx, seed = seedOf(raw);
    if (!C || seed == null || isLocked(block)) return false;
    const [tilt, dir] = C.angleFromSeed(seed);
    block.dataset.seed = String(seed);
    block.dataset.coinTilt = String(tilt);
    block.dataset.coinDir = String(dir);
    redraw();
    return true;
  };

  rerollBtn?.addEventListener('click', () => {
    if (!window.FxSeed || !applySeed(window.FxSeed.newSeed())) return;
    if (seedIn) seedIn.value = block.dataset.seed;
    commit('코인 다시뽑기');
    /* 0.2초 페이드 = «새로 뽑았다»는 상태 표시(효과 아님). Web Animations 라 저장본에 안 남는다(glow 절과 같다). */
    try { block.animate([{ opacity: 0.35 }, { opacity: 1 }], { duration: 200, easing: 'ease-out' }); } catch (_) { /* 조용한 까닭: 표시용 — 못 해도 다시뽑기 자체는 끝났다 */ }
  });

  if (seedIn) {
    seedIn.addEventListener('input', () => { applySeed(seedIn.value); });
    seedIn.addEventListener('change', () => {
      seedIn.value = block.dataset.seed ?? seedIn.value;   // 칸 = 저장값(소수·범위 밖을 넣었으면 정리된 값으로 되쓴다)
      if (!isLocked(block)) commit('코인 무늬번호');
    });
  }

  wireCoinLook(panel, 'stk-coin', {
    get: () => lookOf(block.dataset),
    set: (patch) => { for (const [k, v] of Object.entries(patch)) block.dataset[LOOK_KEY[k]] = String(v); redraw(); },
    commit,
  });

  lockIn?.addEventListener('change', () => {
    if (lockIn.checked) block.dataset.coinLock = '1'; else delete block.dataset.coinLock;
    const locked = isLocked(block);
    if (rerollBtn) rerollBtn.disabled = locked;
    if (seedIn) seedIn.disabled = locked;
    commit(locked ? '코인 각도 잠금' : '코인 각도 잠금 해제');
  });
}
