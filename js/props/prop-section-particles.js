/* ═══════════════════════════════════════════════════════════════════════════
   prop-section-particles.js — ★섹션 배경 파티클의 «켜는 칸» (2026-10-08 · 현빈 발주 · 지디 GO)
   ─────────────────────────────────────────────────────────────────────────────
   ★현빈 원문 — 「★패널에서 내가 만져보려는데 저가 그린다고 달라지니?」
     ⇒ ★기능(js/effects-particles.js · js/fx/particles-render.js)은 ★이미 다 있었고
       ★★«켜는 칸»이 ★없었다. ★이 파일이 ★그 칸이다.

   ★★자리 — ★`js/props/prop-section.js` 의 ★「Background」 절 안.
     ★근거 = ★지디 2026-10-07 Q1 판정 ⒞ 가 ★js/effects-particles.js:8~15 에 ★박혀 있다:
       「패널 자리는 ⒜(prop-section.js 의 Background 절), 다시그리기는 ⒝(명부의 watchAll)에서
        «문만» 빌린다. ⛔목록·카드 UI 는 안 쓴다. ⇒ 그래서 supports: () => false 다」
     ★2026-10-08 지디가 ★그 판정을 ★다시 재서 ★유효함을 확인했다(GO).
     ⛔그래서 ★`fxSectionHtml`(명부의 「Effects」 절)을 ★쓰지 않는다 — 그것은 ★자기 `prop-section` div 를
       ★통째로 짓고 제목이 ★「Effects」라 ★「background 절에」를 ★구조적으로 못 지킨다.
     ⛔`supports: () => false` 를 ★열지 마라 — ★그 명부 다리를 부르는 자는 ★블럭 패널 ★셋뿐이고
       (prop-asset.js:231/679 · prop-shape.js:253/254 · prop-text-template.js:209＋prop-text.js:246)
       ★파티클은 ★섹션 배경이다 ⇒ ★열면 ★텍스트·도형·에셋 ★블럭에 ★뜬다(자리가 틀린다).

   ★★명부는 ★하나다 — ⛔둘째 명부를 만들지 않았다.
     ★수·이름은 ★전부 ★`window.ParticlesFx` 에서 ★읽는다: `PRESETS`·`KINDS`·`SHAPES`·`RANGES`·`MAX_COUNT`
     ★저장·그리기는 ★전부 ★`js/effects-particles.js` 의 창 다리를 ★부른다:
       `hasParticles` · `readParticles` · `writeParticles` · `clearParticles` · `applySectionParticles`
     ⛔이 파일엔 ★상한(60)·프리셋 이름·모양 이름을 ★한 번도 ★적지 않았다.

   ★★⛔«on» 둘째 칸을 ★만들지 않았다 (★js/effects-particles.js:59 의 그 금지 · 지디 판정 Q6)
     ⇒ ★켜짐 판정은 ★`hasParticles(sec.dataset)` ★하나다.
     ⇒ ★★끄기는 ★`clearParticles` ★뿐이다 — ⛔dataset 값을 ★빈 문자열로 ★덮지 마라.
       ★실측(2026-10-08 · 행위로 쟀다): 값만 `''` 로 덮으면 `hasParticles` 는 ★false 인데
       ★키 ★둘(`fxParticles`·`fxParticlesSeed`)이 ★고아로 ★남아 ★저장본에 ★샌다.
       ⇒ ★그것을 ★tests/dom/fx-particles-panel 이 ★「끈 뒤 남은 키 0개」로 ★잠근다.

   ★★«글»은 어디서 오나 — ★둘이 ★다르다. ⛔섞지 마라.
     ⒜ ★프리셋 글 = ★`ParticlesFx.PRESETS[k].label` ★읽는다(「별 반짝이」…) — ★그 쪽이 ★이미 가졌다.
     ⒝ ★모양 글 = ★★이 파일의 `SHAPE_LABEL` ★지역 표다. ★`ParticlesFx.SHAPES` 는 ★키만 준다.
        ★선례 = ★js/props/prop-sticker-glow.js:9 `KIND_LABEL` ★그 꼴 그대로(★새 UI 언어 0).
        ★까닭 = ★키는 ★데이터(저장본에 들어간다)고 ★글은 ★표시다 ⇒ ★표시는 ★패널 몫이다.
        ★★⚠️그래도 ★이것이 ★«둘째 명부»가 될 ★싹이다 ⇒ ★`|| k` 폴백으로 ★조용히 안 죽고,
          ★★`tests/unit/fx-particles-panel` 이 ★「SHAPES 전부에 글이 있나」를 ★양방향으로 단언한다
          ⇒ ★모양이 ★늘면 ★그 검사가 ★빨개진다(⛔조용히 `star4` 가 ★사람 글로 뜨지 않는다).

   ★꼴 — ⛔새로 짓지 않았다. 전부 ★있는 선례:
     프리셋 = `.prop-select`(★Background 절 자신의 `sec-bg-size` 와 ★같은 꼴 ·
       ⛔단추 넷을 ★나란히 두지 않는다 — effects-registry.js:68 이 ★「단추 셋＋select 면 240px 를 넘는다」를 ★이미 쟀다)
     모양   = `.prop-align-group` ＋ `.prop-align-btn.active` (★prop-sticker-glow.js:24 선례 · ★여럿 고르기)
     개수   = `.prop-slider` ＋ `.prop-number` (★prop-sticker-glow.js:88 `pair()` 와 같은 결)
     켜기/끄기 = `.prop-action-btn` (★Background 절 자신의 `sec-bg-img-empty` 와 같은 꼴)
   ═══════════════════════════════════════════════════════════════════════════ */
/* ★★글자 이스케이프는 ★정본 하나다 — ⛔사본을 만들지 마라.
   ★그 규율을 ★재는 자: tests/unit/name-axes-to-markup.test.mjs ★X9 (★2026-10-08 ★내 `_esc` 사본을 ★잡았다).
   ★이 파일의 ★유일한 import 다 — `_helpers.js` 는 ★import 가 ★0 이라 ★단위 하네스가 ★둘만 싣는다. */
import { escHtml } from './_helpers.js';

/* ★모양 사람 글 — ★짧게 둔다(240px 패널에 ★다섯이 ★한 줄로 들어가야 한다).
   ⛔여기에 ★모양을 ★더하지 마라 — 모양의 ★정본은 `ParticlesFx.SHAPES` 다. 여기는 ★글만이다. */
const SHAPE_LABEL = { rect: '사각', ribbon: '리본', circle: '원', star4: '별', tri: '삼각' };

/** ★파티클 이름·수의 ★단일 출처. ⛔없으면 ★칸을 ★안 그린다(조용히 틀린 수를 쓰지 않는다). */
function _fx() {
  return (typeof window !== 'undefined' && window.ParticlesFx) || null;
}

/** ★이 섹션에 파티클이 걸려 있나 — ★`hasParticles` ★하나로 판정한다(⛔둘째 칸 금지). */
function _isOn(sec) {
  return !!(typeof window !== 'undefined' && window.hasParticles?.(sec?.dataset));
}

/* ── 그리개 ──────────────────────────────────────────────────────────────── */
/** 「Background」 절에 ★덧붙는 파티클 칸. ⛔자기 `.prop-section` 을 ★만들지 않는다 —
 *  ★Background 절 ★안에 ★사는 칸이다(지디 판정 ⒞ 의 「background 절에」).
 *  ★ParticlesFx 나 배선이 ★안 실렸으면 ★빈 글자 — ★패널은 ★살아야 한다(prop-section.js:272 의 그 결). */
export function secParticlesHTML(sec) {
  const P = _fx();
  if (!sec || !P || typeof window.writeParticles !== 'function') return '';

  const on = _isOn(sec);
  /* ★끈 상태 = ★켜는 단추 ★하나. ★U3(effects-registry.js:80)과 같은 결 — ★켤 길이 ★늘 있다. */
  if (!on) {
    return `
      <span class="prop-field-label" style="margin-top:8px">Particles</span>
      <button class="prop-action-btn secondary" id="sec-fxpart-toggle" style="margin-top:4px;"
              title="이 섹션 배경에 파티클을 깝니다 — 배경색은 바뀌지 않습니다">파티클 켜기</button>`;
  }

  /* ★켠 상태 — ★지금 «그려지는 값»을 ★normalize 를 거쳐 읽는다(⛔날것 dataset 을 패널에 보이지 않는다).
     ★`readParticles` 가 ★ParticlesFx.normalize 를 ★통과시킨다 ⇒ ★칸에 뜨는 수 = ★그림이 쓰는 수. */
  const cfg = window.readParticles?.(sec.dataset) || {};
  const kinds  = Array.isArray(P.KINDS) ? P.KINDS : Object.keys(P.PRESETS || {});
  const shapes = Array.isArray(P.SHAPES) ? P.SHAPES : [];
  const picked = Array.isArray(cfg.shapes) ? cfg.shapes : [];
  /* ★개수 범위 = ★`RANGES.count` 를 ★읽는다. ⛔상한을 ★적지 않는다 — ★MAX_COUNT 가 바뀌면 ★따라온다.
     ★폴백도 ★MAX_COUNT 를 ★읽는다(⛔둘째 수를 ★여기서 만들지 않게). */
  const R = (P.RANGES && P.RANGES.count) || { min: 0, max: P.MAX_COUNT };
  const count = Number.isFinite(cfg.count) ? cfg.count : R.max;

  /* ★그림이 ★정말 났나 — ⛔「켰다」와 「그려졌다」는 ★다르다.
     ★`applySectionParticles` 는 ★섹션 크기를 못 믿으면(lazy-unloaded 등) ★물러난다
       (js/effects-particles.js:124~137 · R3) ⇒ ★그때 ★사람에게 ★말해 준다. */
  const wrap = sec.querySelector?.(':scope > .' + (window.FX_PARTICLES_WRAP || 'sec-fxpart-wrap'));
  const drawn = !!(wrap && /<svg/.test(wrap.innerHTML || ''));

  return `
      <span class="prop-field-label" style="margin-top:8px">Particles</span>
      <div class="prop-row" style="margin-top:4px;">
        <select class="prop-select" id="sec-fxpart-preset" style="flex:1;min-width:0;"
                title="고른 프리셋의 값을 통째로 깝니다 (무늬 번호는 그대로)" aria-label="파티클 프리셋">
          ${kinds.map((k) => `<option value="${escHtml(k)}"${k === cfg.preset ? ' selected' : ''}>${
            escHtml((P.PRESETS && P.PRESETS[k] && P.PRESETS[k].label) || k)}</option>`).join('')}
        </select>
      </div>
      <div class="prop-row">
        <span class="prop-label">개수</span>
        <input type="range" class="prop-slider" id="sec-fxpart-count" min="${R.min}" max="${R.max}" step="1" value="${count}">
        <input type="number" class="prop-number" id="sec-fxpart-count-num" min="${R.min}" max="${R.max}" value="${count}">
      </div>
      <div class="prop-row">
        <div class="prop-align-group" id="sec-fxpart-shapes" role="group" aria-label="파티클 모양">
          ${shapes.map((k) => {
            const lbl = SHAPE_LABEL[k] || k;      /* ★폴백 — 모양이 늘어도 ★조용히 안 죽는다(단위 검사가 빨개진다) */
            return `<button class="prop-align-btn${picked.includes(k) ? ' active' : ''}" data-fxpart-shape="${escHtml(k)}"
                    title="${escHtml(lbl)}" aria-pressed="${picked.includes(k)}">${escHtml(lbl)}</button>`;
          }).join('')}
        </div>
      </div>${drawn ? '' : `
      <div class="prop-hint" style="font-size:11px;color:#888;">섹션 크기를 아직 못 재서 그림을 미뤘습니다 — 이 섹션이 화면에 들어오면 그려집니다.</div>`}
      <button class="prop-action-btn danger" id="sec-fxpart-toggle" style="margin-top:4px;"
              title="파티클을 끄고 저장 값을 지웁니다">파티클 끄기</button>`;
}

/* ── 배선 ────────────────────────────────────────────────────────────────── */
/** @param {HTMLElement} sec 섹션 · @param {Function} rerender 섹션 패널 다시 그리기
 *  ★칸이 ★없으면 ★아무것도 안 한다(⛔그리개와 ★따로 늙지 않게 — 선례 prop-text.js:246 의 그 결). */
export function wireSecParticles(sec, rerender) {
  const P = _fx();
  if (!sec || !P || typeof window.writeParticles !== 'function') return;

  const $ = (id) => document.getElementById(id);
  const again = () => { try { rerender?.(); } catch (_) {} };
  /* ★그리고 ★저장 예약 — 선례 prop-sticker-glow.js:61 `commit()` 과 같은 꼴. */
  const commit = (label) => { try { window.pushHistory?.(label); } catch (_) {} try { window.scheduleAutoSave?.(); } catch (_) {} };
  const draw  = () => { try { window.applySectionParticles?.(sec); } catch (_) {} };
  /** ★지금 그려지는 값(정규화된 것) — ⛔날것 dataset 을 ★손으로 ★합치지 않는다. */
  const cur = () => window.readParticles?.(sec.dataset) || {};

  /* ★켜기/끄기 — ★한 단추가 ★둘을 한다(⛔「on」 둘째 칸 금지 · 켜짐은 hasParticles 하나로).
     ★끄기는 ★`clearParticles` 뿐 — ⛔빈 문자열로 덮으면 ★키 둘이 ★고아로 남아 저장본에 샌다. */
  $('sec-fxpart-toggle')?.addEventListener('click', () => {
    commit('섹션 파티클');
    if (_isOn(sec)) {
      window.clearParticles(sec.dataset);
    } else {
      /* ★켤 때의 값 — ★프리셋은 ★`KINDS` 의 ★첫 값을 ★읽는다(⛔이름을 적지 않는다 · 지디 승인 2026-10-08).
         ★seed 는 ★`FxSeed.newSeed()` — ★섹션마다 ★다른 무늬가 나야 한다.
           ⛔상수 1 로 두지 않는다: 섹션 둘을 켜면 ★같은 그림이 되어 ★사람이 「안 바뀐다」로 읽는다.
           ★선례 = prop-sticker-glow.js:111(「다시 뿌리기」가 그 함수를 쓴다).
         ★나머지(개수·모양·색…)는 ★안 적는다 — ★normalize 가 ★그 프리셋 기본으로 ★채운다. */
      const first = (Array.isArray(P.KINDS) ? P.KINDS : Object.keys(P.PRESETS || {}))[0];
      const seed = window.FxSeed?.newSeed?.();
      window.writeParticles(sec.dataset, { preset: first, seed: Number.isFinite(seed) ? seed : 1 });
    }
    draw(); again();
  });

  /* ★프리셋 — ★고른 프리셋을 ★통째로 깐다(개수·모양·색이 ★따라온다). ★seed 는 ★그대로.
     ★선례 = prop-sticker-glow.js:69 「종류를 바꾸면 그 프리셋을 «통째로» 깐다 — seed 는 그대로」.
     ⇒ ★그래서 ★다른 칸을 ★안 실어 보낸다(⛔`{...cur()}` 로 덮으면 ★옛 개수가 ★새 프리셋을 이긴다). */
  $('sec-fxpart-preset')?.addEventListener('change', (e) => {
    const k = e.target.value;
    const kinds = Array.isArray(P.KINDS) ? P.KINDS : Object.keys(P.PRESETS || {});
    if (!kinds.includes(k)) return;
    commit('섹션 파티클 프리셋');
    window.writeParticles(sec.dataset, { preset: k, seed: cur().seed });
    draw(); again();
  });

  /* ★개수 — ★끄는 «동안»도 미리보기가 돈다(input) · ★이력은 놓을 때 한 걸음(change).
     ⛔`again()`(패널 다시 그리기)을 ★input 에서 ★부르지 않는다 — ★슬라이더 포커스가 날아간다
       (★이 파일 바깥 선례: prop-section.js:608 이 ★같은 까닭을 적어 뒀다). */
  const sl = $('sec-fxpart-count'), nm = $('sec-fxpart-count-num');
  if (sl && nm) {
    const apply = (v) => {
      const lo = +sl.min, hi = +sl.max;
      v = Math.min(hi, Math.max(lo, Math.round(+v || 0)));
      window.writeParticles(sec.dataset, { ...cur(), count: v });
      /* ★칸은 ★normalize 가 ★돌려준 수로 ★되읽는다 — ★상한에서 ★자른 결과가 ★그대로 보이게. */
      const got = cur().count;
      sl.value = got; nm.value = got;
      draw();
    };
    sl.addEventListener('input',  () => apply(sl.value));
    nm.addEventListener('input',  () => apply(nm.value));
    sl.addEventListener('change', () => commit('섹션 파티클 개수'));
    nm.addEventListener('change', () => commit('섹션 파티클 개수'));
  }

  /* ★모양 — ★여럿 고르기. ★★마지막 하나는 ★못 끈다:
       ★까닭 = `normalize`(particles-render.js:157)는 ★빈 배열이면 ★프리셋 모양으로 ★되돌린다
       ⇒ ★다 끄면 ★«끈 것»이 아니라 ★«프리셋으로 돌아간 것»이 되어 ★사람이 ★어리둥절해진다.
       ⇒ ★그 입력을 ★그냥 ★무시한다(⛔조용히 다른 값을 쓰지 않는다 · 칸도 안 바뀐다). */
  document.querySelectorAll('#sec-fxpart-shapes [data-fxpart-shape]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const k = btn.dataset.fxpartShape;
      const now = cur();
      const have = Array.isArray(now.shapes) ? now.shapes.slice() : [];
      const at = have.indexOf(k);
      if (at >= 0) { if (have.length <= 1) return; have.splice(at, 1); }
      else have.push(k);
      commit('섹션 파티클 모양');
      window.writeParticles(sec.dataset, { ...now, shapes: have });
      draw(); again();
    });
  });
}

if (typeof window !== 'undefined') {
  /* ★창 다리 — ★prop-section.js 가 ★이 둘을 부른다(★선례: 블럭 패널 셋이 `window.fxSectionHtml` 을 부르는 꼴).
     ★까닭(effects-registry.js:26~28 과 같다): ★단위 하네스가 ★패널 파일을 ★«대역»으로 싣는다. */
  Object.assign(window, { secParticlesHTML, wireSecParticles, SEC_PARTICLES_SHAPE_LABEL: SHAPE_LABEL });
}
