/* ═══════════════════════════════════════════════════════════════════════════
   EFFECTS 식구③ — 섹션 배경 파티클의 «배선» (2026-10-07 · 현빈 발주 · 지디 판정 ⒞)
   ─────────────────────────────────────────────────────────────────────────────
   ★이 파일이 하는 일 = ⑴ 저장 꼴(dataset) 읽기·쓰기 ⑵ 섹션에 층을 깔기·거두기
     ⑶ ★명부(js/effects-registry.js)에 식구를 하나 등록해 ★「문서를 연 뒤 다시 그리는 문」만 빌린다.
     그림 자체는 js/fx/particles-render.js(ParticlesFx.svg) 가 짓는다 — 이 파일은 ★그리지 않는다.

   ★★자리 판정(지디 2026-10-07 Q1 = ⒞) — ★패널 자리는 ⒜(prop-section.js 의 Background 절),
     ★다시그리기는 ⒝(명부의 watchAll)에서 ★«문만» 빌린다. ⛔목록·카드 UI 는 ★안 쓴다.
     ⇒ 그래서 ★`supports: () => false` 다. 그러면 `fxTypesFor`(effects-registry.js:53)가 이 식구를
       ★모든 블럭에서 걸러내므로 ⛔블럭 패널의 「효과 추가…」 목록에도, 카드에도 ★안 뜬다.
       ★그런데 `watchAllFx`(:122)는 `FX_REGISTRY` 를 ★직접 돈다(fxTypesFor 를 안 거친다)
       ⇒ ★다시그리기 문은 ★그대로 열린다. ★그 둘의 차이가 이 설계의 전부다.
     ⛔⒝ 를 통째로 쓰지 않은 까닭: `fxSectionHtml`(:94)이 ★자기 `<div class="prop-section">` 를
       ★통째로 만들고 제목이 ★「Effects」다 ⇒ 현빈 원문의 ★「background 절에」를 ★못 지킨다.

   ★★배경색 계약(현빈 2026-10-07 「배경색이 계속 바뀌면 안되는거 알지?」)
     ⇒ ⛔이 파일은 ★`sec.style.background*` 와 ★`sec.dataset.bg*` 를 ★한 번도 쓰지 않는다.
       (섹션 배경은 js/props/prop-section.js `_applySectionBg` 한 자리의 몫이다 — 거기 `:138`)
     ⇒ ⛔`ParticlesFx.lum` 을 ★여기서 부르지 않는다. 배경 휘도로 팔레트를 ★자동으로 고르지 않는다
       (지디 판정 Q2: 자동이면 ★되돌릴 자리가 없다 · 배경이 ★이미지면 휘도를 못 읽어 규칙이 ★절반만 돈다).
     ★이 둘은 tests/unit/fx-particles-wiring.test.mjs 가 ★행위로 잰다 — ⛔주석으로 두지 않는다.

   ★★이름(저장 쓸기 여섯 자리 전수 2026-10-07 — 걸리는 것 0 · 양성대조 7/7)
     층 `sec-fxpart-wrap` · dataset ★`fxParticles`(설정 JSON 통째) ＋ ★`fxParticlesSeed`(따로)
     ⇒ ★seed 를 따로 뺀 까닭: ★그것이 정본이고 ★사람이 보고 ★적는 수다(시안의 「무늬 번호」).
     ⇒ ★배열(colors·shapes)이 있어 ★JSON 통째다 — ⛔쉼표 구분자 금지(색에 `rgba(…)` 의 쉼표가 든다).
       선례: js/text-effect-transform.js:133 `tb.dataset.textEffect` 에 JSON 통째.
     ⛔변수 이름에 `pad` 를 쓰지 않는다(`--gdt-pad-` 접두사 쓸기 — section-serialize.js:282).

   ★★층은 저장본에 ★남는다(글로우와 같은 결) — ⛔②(section-serialize.js:217)·③(save-load.js:600)
     명부에 ★올리지 마라. 올리면 ★배송 HTML 에서도 사라져 ★내보낸 그림에 파티클이 없다.
     ★그 두 명부는 «편집기 전용 표시»를 거르는 자리고, 파티클은 «사람이 고른 내용»이다(지디 승인 2026-10-07 R2).
     ⇒ 로드 때 `watchAllParticles` 가 ★현재 섹션 높이로 ★다시 그린다(저장 당시 높이가 아니라).

   ★★⛔`js/section-merge.js` 의 `KEEP_OUT` 에 ★이 층을 ★넣지 마라 (지디 판정 2026-10-07 R1 · 실측 근거)
     까닭 ⑴ 그 `KEEP_OUT` 은 ★허용목록이 아니라 ★«제외목록»이다(그 자리 주석: 「모르는 블록이 새로 생겨도
       안 잃는다」) ⇒ ★가만 두면 층이 ★상자(part)로 ★따라간다.
     까닭 ⑵ ★그것이 ★배경이 겪는 것과 ★같은 동작이다 — `section-merge.js:113~116` 이 source 의
       배경색을 ★상자로 ★옮겨 ★보존한다. ⇒ ★결이 ★일치한다. ⛔새 규칙을 만들면 사용자가 둘을 외워야 한다.
     까닭 ⑶ 좌표가 선다 — 층은 `position:absolute; inset:0` 이고 상자가 `position:relative` 라
       ★상자가 새 기준이 되어 ★정확히 그 상자를 덮는다(그 파일 주석이 스티커로 같은 말을 한다).
     ★⚠️그러므로 ★이 동작을 ★«검사»로 잠가야 한다 — ㉣-1(합친 뒤 층이 상자 안에 산다 ＋ dataset.mergedOuter)
       · ㉣-2(음성대조: 배경색도 같은 자리로 간다) · ㉣-3(★양성대조: KEEP_OUT 에 넣으면 ★빨개지나).
       ★★그 셋은 ★DOM 수트 몫이고 ★2026-10-07 현재 ★★미실시다 — ⛔이 주석을 ★그 검사 대신 읽지 마라.
   ★★＋변형(A/B안)은 ★병합과 ★안 만난다 — `canMergeSections` 가 거부한다(지디 실측).
     ⇒ 필터 id 가 변형 사본에서 어긋나는 건(`section-variation.js` 가 모든 [id] 를 다시 짓는데
       `filter="url(#…)"` 참조는 안 바뀐다)은 ★병합과 무관한 ★별건이고, ★그것도 ★미실시다.
   ═══════════════════════════════════════════════════════════════════════════ */
import { registerFxType } from './effects-registry.js';

export const FX_PARTICLES_KEY  = 'fxParticles';       // dataset 키 — 설정 JSON 통째
export const FX_PARTICLES_SEED = 'fxParticlesSeed';   // dataset 키 — 정본 seed(사람이 보고 적는 수)
export const FX_PARTICLES_WRAP = 'sec-fxpart-wrap';   // 층 요소의 클래스

/* ══ 순수 층 — dataset «객체»만 받는다(DOM 0). 그래서 unit 이 ★불러서 잰다 ══════════════ */

/** 이 섹션에 파티클이 «걸려 있나» — ★정본은 dataset 하나다.
 *  ⛔`on` 같은 둘째 칸을 만들지 마라(지디 판정 Q6): `on:false` ＋ dataset 있음 = ★어느 쪽이 참인가가 생긴다. */
export function hasParticles(ds) {
  return !!(ds && typeof ds[FX_PARTICLES_KEY] === 'string' && ds[FX_PARTICLES_KEY] !== '');
}

/** 저장 꼴 → 그릴 수 있는 설정. ⛔못 읽으면 null(「끄기」와 「깨진 값」을 섞지 않는다). */
export function readParticles(ds) {
  if (!hasParticles(ds)) return null;
  let raw;
  try { raw = JSON.parse(ds[FX_PARTICLES_KEY]); }
  catch (_) { return null; }                       // 조용한 까닭: 깨진 저장본에도 ★패널은 살아야 한다
  if (!raw || typeof raw !== 'object') return null;
  const seed = Number.parseInt(ds[FX_PARTICLES_SEED], 10);
  const P = (typeof window !== 'undefined' && window.ParticlesFx) || null;
  const cfg = { ...raw, seed: Number.isFinite(seed) ? seed >>> 0 : (raw.seed >>> 0 || 1) };
  return P ? P.normalize(cfg) : cfg;               // ParticlesFx 가 아직 안 실렸으면 날것 그대로
}

/** 설정을 저장 꼴로 — ★seed 는 ★따로 나간다(사람이 보고 적는 수).
 *  ⛔배경을 가리키는 칸은 ★담기지 않는다 — 들어와도 ★떨어뜨린다(배경색 계약). */
export function writeParticles(ds, cfg) {
  if (!ds || !cfg) return ds;
  const { seed, ...rest } = cfg;
  for (const k of Object.keys(rest)) if (/^(bg|background)/i.test(k)) delete rest[k];
  ds[FX_PARTICLES_KEY]  = JSON.stringify(rest);
  ds[FX_PARTICLES_SEED] = String((seed >>> 0) || 1);
  return ds;
}

/** ★끄기 = dataset 을 ★지운다(명부가 하나라는 증명). ⛔값을 남겨 두고 플래그로 끄지 마라. */
export function clearParticles(ds) {
  if (!ds) return ds;
  delete ds[FX_PARTICLES_KEY];
  delete ds[FX_PARTICLES_SEED];
  return ds;
}

/** 이 섹션의 필터 id — ★섹션마다 달라야 한다(SVG id 는 문서 전역). */
export const particlesFilterId = (secId) => 'pfx-' + String(secId || 'tmp').replace(/[^A-Za-z0-9_-]/g, '');

/* ══ DOM 층 — ⚠️여기부터는 ★진짜 DOM 이 필요하다. unit 이 아니라 ★DOM 수트가 잰다 ══════ */

/** 섹션에 층을 깔거나 거둔다. 돌려주는 값 = ★그렸으면 true.
 *  ⛔배경색을 ★한 번도 안 건드린다(머리말 계약). */
export function applySectionParticles(sec) {
  if (!sec || !sec.querySelector) return false;
  const cfg = readParticles(sec.dataset);
  let wrap = sec.querySelector(':scope > .' + FX_PARTICLES_WRAP);
  if (!cfg) { if (wrap) wrap.remove(); return false; }
  const P = (typeof window !== 'undefined' && window.ParticlesFx) || null;
  if (!P || !window.FxSeed) {
    /* ⛔조용히 «다른 그림»을 그리지 않는다 — 글로우와 같은 결(sticker-block.js:156). */
    console.error('[fx/particles] ParticlesFx·FxSeed 가 안 실렸다 — index.html 고전 스크립트 순서');
    if (wrap) wrap.innerHTML = '';
    return false;
  }
  /* ★크기는 «지금» 잰다 — 저장본에 실린 viewBox 는 ★저장 당시 높이다.
     ★★높이는 ⛔`sec.offsetHeight` 를 ★직접 쓰지 않는다 — ★공용 자 `window.measureSectionHeight` 를 부른다.
       까닭(js/section-height.js 머리말): ★그것이 ★섹션 높이의 ★단일 원본이고, 캔버스 배지·합계·패널이
       ★같은 함수를 쓴다. ★값의 출처가 둘이면 ★어느 날 갈린다 — ★그 파일 실측(2026-10-07)에서
       ★안쪽이 지역 함수를 부르자 ★자를 0 으로 바꿔도 배지가 ★안 변해 ★양성대조가 죽었다.
       ⇒ ★나는 ★그 자의 ★둘째 소비자다. ★폴백(?? offsetHeight)은 ★로드 순서 보호용이다
         (그 파일 `ruler()` 와 ★같은 꼴 — ⛔다른 수를 쓰는 길이 아니다). */
  const w_ = Math.round(sec.offsetWidth || 0);
  const h_ = Math.round(((typeof window !== 'undefined' && window.measureSectionHeight?.(sec)) ?? sec.offsetHeight) || 0);
  /* ★★★크기를 못 믿으면 ⛔«거짓 크기»로 그리지 않는다 — ★층을 그대로 두고 물러난다. (2026-10-07 R3)
     ★★까닭이 성능이 아니라 ★★«결정성»이다 — ★크기가 ★그림에 들어간다(viewBox·입자 좌표가 W·H 에서 나온다).
       ⇒ ★높이를 ★600 으로 «때워» 그리면, 섹션이 올라와 ★진짜 높이(예: 300)로 다시 그릴 때
         ★같은 seed 인데 ★모습이 ★바뀐다 — ★★그것이 「★같은 시드 = 같은 그림」을 깨는 길이다
         (지디 설계 전제 ⑶ · js/fx/seeded-random.js:7 「모습의 흔들림은 ★저장된 seed 에서만」).
     ★언제 0 이 되나: ★`js/io/lazy-sections.js:81` 이 뷰포트 밖 섹션에 `lazy-unloaded` 를 붙여 ★내린다.
       `watchAllParticles` 는 문서를 연 뒤 ★전 섹션을 도므로 ★아래쪽은 ★이미 내려가 있을 수 있다.
       (저장 경로는 안전하다 — `js/io/section-serialize.js:180` 이 저장 때 그 클래스를 ★벗긴다. ★문제는 «화면»이다.)
     ★⛔층을 ★지우지도 않는다: 저장본에 실린 층이 이미 있으면 ★저장 당시 그림이라도 보이는 쪽이 낫고,
       섹션이 올라오면 ★다시 그려진다. ⇒ ★돌려주는 값은 false(= ★이번엔 안 그렸다).
     ⚠️★★「섹션이 올라올 때 ★누가 다시 그리나」는 ★★미측정이다(2026-10-07 · DOM 수트 창 대기).
       ★그 칸의 ★양성대조: ★섹션에 `lazy-unloaded` 를 ★손으로 붙인 판에서 ★이 함수가 ★false 를 주고
       ★층의 innerHTML 이 ★안 바뀌나 — 그리고 ★벗긴 뒤 다시 부르면 ★진짜 높이로 그려지나. */
  if (w_ <= 0 || h_ <= 0) return false;
  if (!wrap) {
    wrap = sec.ownerDocument.createElement('div');
    wrap.className = FX_PARTICLES_WRAP;
    sec.insertBefore(wrap, sec.firstChild);       // 배경 위 · 내용 아래(자리는 CSS 가 정한다)
  }
  wrap.innerHTML = P.svg({ ...cfg, w: w_, h: h_, filterId: particlesFilterId(sec.id) });
  /* ★★움직이개를 ★깨운다 (v1.5 ⑴ · 2026-10-09) — ★다시 그리면 ★svg 요소가 ★새것이라
     ★움직이개의 ★읽어 둔 명부가 ★빗나간다. ⛔안 깨우면 ★최대 1초(IDLE_RECHECK_MS)를 ★멈춰 있다.
     ★★없어도 ★죽지 않는다 — ★움직이개는 ★따로 실리는 파일이고, ★안 실린 판(검사 하네스)이 ★있다. */
  try { w_doc_anim(sec)?.kick?.(); } catch (_) { /* 움직이개가 없는 판 — 그림은 이미 났다 */ }
  return true;
}

/** 움직이개 손잡이 — ⛔전역을 ★직접 읽지 않는다(검사 하네스가 ★창을 갈아 끼운다). */
function w_doc_anim(sec) {
  const win = sec?.ownerDocument?.defaultView || (typeof window !== 'undefined' ? window : null);
  return win && win.ParticlesAnim;
}

/** 문서를 연 뒤·붙여넣은 뒤 — 걸린 섹션을 ★다시 그린다. 돌려주는 수 = 다시 그린 섹션 수.
 *  ★명부(effects-registry.js watchAllFx)가 ★이 함수를 부른다 — ⛔제 load 리스너를 ★따로 달지 마라. */
export function watchAllParticles(root = document) {
  if (!root || !root.querySelectorAll) return 0;
  let n = 0;
  root.querySelectorAll('.section-block').forEach((sec) => { if (applySectionParticles(sec)) n++; });
  return n;
}

/* ══ 명부 등록 — ★「문만」 빌린다 ════════════════════════════════════════════════ */
registerFxType({
  key: 'particles',
  label: '파티클',
  /* ★supports false = 블럭 패널의 목록·카드에서 ★완전히 빠진다(fxTypesFor 가 거른다).
     ★watchAllFx 는 FX_REGISTRY 를 ★직접 도니 ★다시그리기 문은 그대로 열린다. */
  supports: () => false,
  has: () => false,
  watchAll: watchAllParticles,
});

if (typeof window !== 'undefined') {
  Object.assign(window, {
    hasParticles, readParticles, writeParticles, clearParticles,
    applySectionParticles, watchAllParticles, particlesFilterId,
    FX_PARTICLES_KEY, FX_PARTICLES_SEED, FX_PARTICLES_WRAP,
  });
}
