/* coin-particle-recipe.js — 섹션 파티클의 «코인 레시피» 입구 (1012t1 I1-B · 프로토 3c3a25bb js/proto-coin-particles.js 를 정식으로).
 *   섹션에 «코인 레시피»(파티클 설정 묶음)를 쓰고 그린다. 그림은 js/fx/particles-render.js 의 모양 'coin' → js/fx/coin-draw.js(CoinFx).
 *   ★「코인」은 파티클 «프리셋»(KINDS)이 아니다 — 모양 하나 + 이 레시피다. 저장 꼴은 기존 두 키 그대로(data-fx-particles · data-fx-particles-seed · 새 키 0).
 *   ★값·쓰기·그리기·기록은 이 한 자리가 한다 — 패널(js/props/prop-section-particles.js 「코인 레시피」 단추)은 이 함수를 부르고 다시 그릴 뿐이다.
 *   ★무늬번호는 그대로다 — 이미 있으면 그 번호, 없으면(파티클을 처음 켜는 것) 새로 뽑는다.
 *   ★색 = 금 하나 — 현빈 1013t2E4 「(파티클 코인 레시피) 색은 금색 은색 추가말고 디폴트로 금색」. 값은 코인 색의 정본(CoinFx.baseColors)에서 읽는다.
 *     (프로토는 금·은 두 칩이었다.)
 *   ⚠️고전 스크립트다. 전역 이름을 블럭 추가 입구 꼴(add…Block)로 짓지 않는다 — 삽입 이음매 명부(insert-seam-roster)에 안 걸리게.
 *   이름·자리: 프로토 이름(proto-…)을 벗기고 js/ 바로 아래 «입구» 자리에 둔다 — 같은 꼴의 입구(count-sticker-tool.js·highlight-line-tool.js)가 거기 있고,
 *     js/fx/ 는 «DOM 없는 순수 그림» 자리라 DOM·히스토리를 만지는 이 파일은 거기 맞지 않는다.
 *   회귀: tests/unit/coin-particle-recipe.test.mjs · tests/dom/fx-particles-coin-recipe.dom.spec.js
 */
(function (w) {
  /** 레시피 값 — 이 한 자리. preset 은 normalize 가 요구하는 칸이다(없으면 첫 프리셋으로 떨어져 «없는 값»의 기본이 달라진다) —
   *  모든 축을 적었으므로 그림에는 영향이 없다. 패널의 프리셋 칩은 이 이름에 불이 들어온다.
   *  glow 0 — 후광을 켜면 조각을 두 벌 그려 코인의 gradient id 가 겹친다. smax 는 파티클 크기 상한(RANGES.smax)을 넘지 않는다. */
  function coinParticleRecipe() {
    const C = w.CoinFx, P = w.ParticlesFx;
    const smaxCap = (P && P.RANGES && P.RANGES.smax && P.RANGES.smax.max) || 90;
    const r = {
      preset: 'gold', shapes: ['coin'], count: 14, smin: 28, smax: Math.min(90, smaxCap),
      rot: true, dist: 'even', glow: 0, spread: 0, jit: 0, fxOpacity: 100,
      speed: 0, blur: 0, spin: 0,
    };
    if (C && C.baseColors) r.colors = [C.baseColors('gold').face];
    return r;
  }

  /** 섹션에 코인 레시피를 쓰고 그린다. 무늬번호는 이미 있으면 그대로, 없으면 새로 뽑는다.
   *  @param {HTMLElement} sec 섹션(.section-block)
   *  @returns {boolean} 그렸으면 true */
  function applyCoinParticleRecipe(sec) {
    if (!sec || !sec.classList || !sec.classList.contains('section-block')) { if (w.showNoSelectionHint) w.showNoSelectionHint(); return false; }
    if (typeof w.writeParticles !== 'function' || typeof w.applySectionParticles !== 'function' || !w.ParticlesFx) {
      if (w.showToast) w.showToast('파티클 엔진이 아직 안 실렸습니다');
      return false;
    }
    const had = w.readParticles ? w.readParticles(sec.dataset) : null;
    let seed = had && Number.isFinite(had.seed) ? had.seed : NaN;
    if (!Number.isFinite(seed)) seed = w.FxSeed && w.FxSeed.newSeed ? w.FxSeed.newSeed() : 1;
    w.writeParticles(sec.dataset, Object.assign(coinParticleRecipe(), { seed: seed }));
    const drew = w.applySectionParticles(sec);
    try { if (w.fxSetCardOpen) w.fxSetCardOpen(sec, 'particles', true); } catch (_) { /* 패널 표시 상태일 뿐 */ }
    /* push-after — 쓰고 그린 뒤에 찍는다(섹션 패널의 다른 칸과 같은 규약) */
    try { if (w.pushHistory) w.pushHistory('코인 레시피'); } catch (_) { /* 기록기가 없는 판 */ }
    try { if (w.scheduleAutoSave) w.scheduleAutoSave(); } catch (_) { /* 저장기가 없는 판 */ }
    return !!drew;
  }

  w.coinParticleRecipe = coinParticleRecipe;
  w.applyCoinParticleRecipe = applyCoinParticleRecipe;
})(window);
