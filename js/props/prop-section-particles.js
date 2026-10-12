/* ═══════════════════════════════════════════════════════════════════════════
   prop-section-particles.js — ★섹션 배경 파티클의 «켜는 칸» ＋ ★★«조절 축 전수»
     (2026-10-08 · 현빈 발주 · 지디 GO · ★★2026-10-08 2차 — ★시안 전수로 교체)

   ★★★정본은 ★«시안»이다 — ⛔요약을 참값으로 쓰지 마라
     `/Users/a1/.claude/skills/지디/dashboard/artifacts/goditor-effects-particles.html`
     (46,959B · 740줄 · mtime 2026-10-06 16:50)
   ★현빈 2026-10-08 — 「파티클 ★시안보여줬던대로 ★안보이는데?? ★★조절하는 항목들 ★어디갔냐??
     ★아티팩트에 있던것들 말야 ★조절옵션들 ★왜 줄여 이러면 ★시안을 왜보여주는거야」
     ⇒ ★1차(2026-10-08 `93a309e3`)는 ★축이 ★`count` ★하나뿐이었다. ★★이 판이 ★그걸 ★전수로 채운다.

   ★★«축»의 ★정본 = ★`window.ParticlesFx` — ⛔수·키를 ★손으로 ★적지 마라
     ★★`RANGES` 가 ★★«명세 그 자체»다 ⇒ ★★`Object.keys(RANGES)` 를 ★돌려 ★칸을 ★짓는다.
     ⇒ ★★축이 ★늘면 ★칸이 ★★«저절로» 생긴다. ★★그것을 ★잠그는 자:
       tests/unit/fx-particles-panel ★P11 — ★★«RANGES 에 ★가짜 축을 ★더한 판»에서 ★칸이 ★하나 ★늘나.
       ⛔`칸 수 === RANGES 키 수` ★하나로는 ★항등식이라 ★아무것도 안 잠근다.
     ★`RANGES` ★밖의 축도 ★있다 — ⛔★RANGES 전수만으로는 ★★빠진다:
       ★`rot`(회전 · 참거짓) · ★`colors`(색 · 배열) · ★`shapes`(모양 · 배열) ·
       ★`dist`(분포 · `DISTS`) · ★`preset`(`KINDS`) · ★`seed`(무늬번호)
       ⇒ ★그 여섯은 ★`normalize` 가 ★돌려주는 ★키로 ★따로 ★짓는다(★P12 가 ★전수를 잠근다).
     ★★⇒ ★`normalize` 돌려주는 키 ★13개 == ★★시안의 축 ★13개. ★빠짐 ★0.

   ★★칸의 ★순서·이름 = ★시안 ★그대로 (★시안 `:252~320`)
     프리셋칩 → 🎲다시 뿌리기 → 무늬번호(＋↻) → 갯수 → 색 → 크기(min/max)
       → 불투명도 → 흔들림 → 회전 → 분포 → 글로우 → 퍼짐
     ★★＋ ★모양(shapes) — ⚠️★★시안에선 ★«패널 칸»이 ★아니었다. ★시안 `:338` 의 `#shapebar` 는
        ★★패널 ★«밖»의 ★범례(그림 설명)였고, ★모양은 ★프리셋이 ★정해 줄 뿐 ★사람이 ★고를 수 없었다.
        ★★⇒ ★★«패널 칸»으로 만든 것은 ★2026-10-08 에 ★★내가 ★더한 것이다(⛔시안에 없던 것).
        ★★⇒ ★★지디 판정 2026-10-08 = ★★«두라». 까닭 셋(그가 적은 그대로):
             ⑴ 현빈 원문이 ★「★만져보려는데」다 — ★만질 축이 ★많은 쪽이 ★그 뜻에 맞다
             ⑵ ★`SHAPES` 가 ★`normalize` 키에 ★있다 ⇒ ★★«렌더러가 ★아는 축»이다
             ⑶ 이미 ★검사(P1·P6·P13)가 ★잠갔다 ⇒ ★★빼는 것이 ★더 비싸다
        ★★⛔다음 사람에게 — ★이 칸을 ★«시안에 없으니 빼자»로 ★읽지 마라. ★★위 판정이 ★그 답이다.
           ★자리는 ★맨 끝이다(★시안 순서를 ★안 깨게).
     ⛔★시안의 ★「배경」 색 줄은 ★안 만든다 — ★Background 절이 ★이미 가졌고(`sec-bg-color`),
       ★★파티클이 ★배경을 건드리면 ★계약 위반이다(현빈 2026-10-07 「배경색이 계속 바뀌면 안되는거 알지?」).
     ⛔★시안의 ★`freeze`/`restore` 는 ★안 만든다 — ★시안 스스로 ★「⚙︎ 시안 확인용 — 앱에선 자동 저장됩니다」.

   ★★⛔시안과 ★갈리는 것 ★둘 — ★★«시안대로»가 ★아니라 ★★«나중 결정»이 ★이긴다
     ⑴ ★갯수 상한 — ★시안 ★320 · ★제품 ★`MAX_COUNT`.
        ★2026-10-07 「다 60 으로」 → ★★2026-10-08 현빈 「★60개 말고 ★120개까지하자 최대」 ⇒ ★지금 ★120.
        ⇒ ★★`RANGES.count` 를 ★읽는다. ⛔320 도 ★60 도 ★120 도 ★여기 안 적는다 —
          ★★그래서 ★상한이 ★또 바뀌어도 ★이 파일은 ★손댈 곳이 ★없다(★2026-10-08 ★실제로 그랬다).
     ⑵ ★저장 키 이름 — ★시안 `opacity`·`size[min,max]` · ★제품 `fxOpacity`·`smin`/`smax`.
        ⇒ ★★제품이 ★참값이다(★이미 저장본이 ★나갔고 ★검사가 ★잠갔다).

   ★★⛔«on» 둘째 칸을 ★만들지 않았다 (★js/effects-particles.js:59 · 지디 판정 Q6)
     ⇒ ★켜짐 판정은 ★`hasParticles(sec.dataset)` ★하나다.
     ⇒ ★★끄기는 ★`clearParticles` ★뿐 — ⛔값을 ★빈 문자열로 ★덮지 마라.
       ★실측(행위로): 값만 `''` 로 덮으면 `hasParticles` 는 ★false 인데 ★키 ★둘이 ★고아로 남아 ★저장본에 ★샌다.
       ★잠그는 자 = `tests/dom/fx-particles-panel` ★D2 「끈 뒤 남은 키 0개」
         (★2026-10-08 무력화 ⒞ 에서 ★★D2 ★하나만 ★빨개졌다 — ★장식이 아님이 ★증명됐다).

   ★★자리 — ★`prop-section.js` 의 ★「Background」 절 안 (★지디 2026-10-07 Q1 판정 ⒞ ·
     ★2026-10-08 지디가 ★앱 9400 에서 ★절 전수로 ★재확인). ⛔`fxSectionHtml`·`supports` 미사용.

   ★꼴 — ⛔새 UI 언어 ★0. ★제품에 ★있는 클래스만 썼다(★시안의 `.pi`·`.sw`·`.tg`·`.chipb` → 제품 짝):
     카드      `.prop-cell-card` ＋ `-header` ＋ `-body`   (★선례 effects-reflect.js:163)
     눈·접기·✕ `.prop-icon-btn`                            (★같은 선례)
     프리셋칩  `.prop-align-group` ＋ `.prop-align-btn.active` (★선례 prop-sticker-glow.js:24)
     슬라이더  `.prop-slider` ＋ `.prop-number`             (★선례 prop-sticker-glow.js:88)
     색 칩    `.fxpart-chip-wrap > .prop-color-swatch.fxpart-chip > .fxpart-chip-dot`
               (★크기는 css `--cv-chip-size`·`--cv-chip-dot-size` · 투명 color input · ✕ 는 ★호버 겹침)
                                                           (★현빈 2026-10-08 「이정도 크기는 어때」)
               ⚠️2026-10-08 전에는 ★24px ★네모 ＋ ★✕ 가 ★제 칸을 ★먹었다 — ★그 줄을 ★고친 것이다
     분포      `.prop-select`                              (★선례 sec-bg-size)
     회전      `<input type="checkbox">`                   (★선례 stk-glow-chroma · sec-overflow-visible)
     단추      `.prop-action-btn`                          (★선례 sec-bg-img-empty)
   ═══════════════════════════════════════════════════════════════════════════ */
/* ★★글자 이스케이프는 ★정본 하나다 — ⛔사본 금지(★게이트 tests/unit/name-axes-to-markup ★X9 가 잡는다). */
import { escHtml } from './_helpers.js';

/* ★★축의 ★사람 글 — ★★시안 `:264~318` 의 ★글자 ★그대로다. ⛔내가 지어낸 말이 ★하나도 없다.
   ★`RANGES` 는 ★키만 준다(수는 거기서 읽고 ★글은 여기서). ★선례 = prop-sticker-glow.js:9 `KIND_LABEL`.
   ⛔축을 ★여기에 ★더하지 마라 — ★축의 ★정본은 ★`ParticlesFx.RANGES` 다. ★여기는 ★글만이다.
   ★`|| key` 폴백이 있어 ★새 축이 와도 ★조용히 안 죽고, ★P13 이 ★「RANGES 전부에 글이 있나」를 잠근다. */
const AXIS_LABEL = {
  count: '갯수', smin: '크기', smax: '크기',
  fxOpacity: '불투명도', jit: '흔들림', glow: '글로우', spread: '퍼짐',
  /* ★패닝 셋 — ★글도 ★시안의 ★그 말이다(「떨어지는 속도」·「번짐 세기」·「회전 속도」).
     ★240px 패널이라 ★짧은 쪽을 쓴다 — 위 일곱과 ★같은 결(「불투명도」·「흔들림」).
     ⚠️`rot` 의 글이 ★이미 「회전」이다(참거짓 — ★무작위 각도) ⇒ ★`spin` 은 ★「회전속도」로 ★갈라 적는다.
       ⛔둘을 ★같은 말로 두면 ★현빈이 ★어느 칸인지 ★못 가린다. */
  speed: '속도', blur: '번짐', spin: '회전속도',
};

/* ★모양 글 — ★★짧은 쪽(`s`)은 ★240px 패널용, ★긴 쪽(`t`)은 ★★시안 `:454 SHAPE_KO` ★그대로를 ★title 로.
   ⇒ ★★한 자리에 ★둘을 두어 ★«둘째 명부»를 ★안 만든다. ★P1 이 ★SHAPES 와 ★양방향으로 잠근다. */
const SHAPE_LABEL = {
  rect:   { s: '사각', t: '사각 조각' },
  ribbon: { s: '리본', t: '가는 띠(리본)' },
  circle: { s: '원',   t: '원' },
  star4:  { s: '별',   t: '4갈래 별' },
  tri:    { s: '삼각', t: '삼각' },
};

/* ★분포 글 — ★★시안 `:302~304` ★그대로. ★키는 ★`ParticlesFx.DISTS` 에서 읽는다. */
const DIST_LABEL = { even: '고르게', top: '위쪽 몰림', edge: '가장자리 몰림' };

/* ★★칸의 ★순서 — ★★시안 `:252~320` ★그대로. ★`RANGES` 키를 ★여기서 ★«소비»한다.
   ★★여기 안 적힌 ★RANGES 키는 ★맨 끝에 ★저절로 ★붙는다(★아래 `_rows()` 의 그 줄)
     ⇒ ★★그것이 ★「축이 늘면 칸이 저절로 생긴다」의 ★그 자리고, ★P11 이 ★가짜 축으로 ★잠근다. */
const SHEET_ORDER = [
  { kind: 'slider', key: 'count' },
  { kind: 'colors' },
  { kind: 'pair', keys: ['smin', 'smax'] },      /* ★시안은 ★크기를 ★한 줄에 ★min/max ★둘로 둔다 */
  { kind: 'slider', key: 'fxOpacity' },
  { kind: 'slider', key: 'jit' },
  { kind: 'rot' },
  { kind: 'dist' },
  { kind: 'slider', key: 'glow' },
  { kind: 'slider', key: 'spread' },
  { kind: 'shapes' },                            /* ⚠️시안엔 패널 칸이 아니었다 — 내가 더한 것 */
];

const _fx = () => (typeof window !== 'undefined' && window.ParticlesFx) || null;
const _isOn = (sec) => !!(typeof window !== 'undefined' && window.hasParticles?.(sec?.dataset));

/* ══ ★일시정지/재생 (2026-10-09 · 현빈 발주) ═════════════════════════════════
   ★현빈 「파티클 회전/속도 만지니 ★계속 움직이는데 ★★멈출 수 없나」
     ⇒ ★확정 「★★그냥 일시정지 버튼/재생버튼만 있으면 되겠는데?」
   ★★★상태의 ★임자는 ★여기가 ★아니다 — ★`window.ParticlesAnim`(js/fx/particles-animate.js) ★하나다.
     ⛔패널이 ★제 변수에 ★들고 있으면 ★★패널이 ★다시 그려질 때마다(★`rerender`) ★잊는다.
     ⇒ ★그릴 때마다 ★★«움직이개에게 물어» ★단추 꼴을 ★정한다.
   ★★★⛔`writeParticles`·`sec.dataset` 에 ★★한 자도 ★안 쓴다 — ★저장물에 ★안 넣는 것이 ★계약이다
     (★까닭·전례는 ★`js/fx/particles-animate.js` 「사람 멈춤」 절 ＋
       ★`js/io/section-serialize.js` 머리말의 ★`multi-selected` 전례).
   ⇒ ★그래서 ★이 단추는 ★`commit()`(pushHistory·scheduleAutoSave)도 ★★안 부른다 —
     ★문서가 ★안 바뀌므로 ★되돌릴 것도 ★저장할 것도 ★없다.
   ★★움직이개가 ★안 실린 판(검사 하네스)에서는 ★★단추를 ★안 낸다 — ⛔못 먹는 단추를 ★보이지 않게. */
/* ★★꼴 — ★글자 ★정본 ★한 자리. ★검사도 ★이것을 ★읽는다(⛔spec 에 ★글자를 ★박지 마라 — ★명부가 둘).
   ★★2026-10-09 ★실측(앱 9422 · ★마우스를 ★치우고 ★다섯 꼴을 ★한 줄에 ★나란히 ★찍어 봤다):
     ★`\u23F8` · `\u25B6` · `\u23F8\uFE0E` · `\u25B6\uFE0E` · `\u25BA` ⇒ ★★다섯 ★전부 ★회색(한빛)이다.
   ⚠️★★내 ★첫 판정은 ★틀렸다 — ★「이모지라 ★빨갛다」로 읽고 ★VS15·`\u25BA` 로 ★바꿨었다.
     ★참 까닭은 ★★«마우스가 ★단추 위에 있었던 것»이다(★호버 색 `rgb(224,108,108)`).
     ★같은 자로 ★치우고 다시 재니 ★`rgb(158,158,158)` — ★옆 `◉`·`⌄` 와 ★같다.
     ⇒ ★★스샷은 ★«찍는 것»과 ★«보는 것»이 ★다르고, ★★«내 손이 만든 상태»를 ★원인에서 ★안 뺐다. */
const PAUSE_GLYPH = '\u23F8';           /* ⏸ 일시정지 */
const PLAY_GLYPH  = '\u25B6';           /* ▶ 재생 */
if (typeof window !== 'undefined') { window.SEC_PARTICLES_GLYPH = { pause: PAUSE_GLYPH, play: PLAY_GLYPH }; }

const _anim = () => (typeof window !== 'undefined' && window.ParticlesAnim) || null;
const _isPaused = (sec) => { try { return !!_anim()?.isPaused?.(sec); } catch (_) { return false; } };
const _lbl = (k) => AXIS_LABEL[k] || k;

/** ★그릴 줄 전수 — ★시안 순서 ＋ ★★«명부에 없던 RANGES 키»를 ★끝에 붙인다.
 *  ⇒ ★★`RANGES` 에 축이 ★늘면 ★이 함수가 ★줄을 ★하나 ★더 돌려준다(⛔손으로 안 적는다). */
function _rows(P) {
  const keys = Object.keys((P && P.RANGES) || {});
  const used = new Set();
  for (const r of SHEET_ORDER) {
    if (r.key) used.add(r.key);
    if (r.keys) r.keys.forEach((k) => used.add(k));
  }
  const extra = keys.filter((k) => !used.has(k)).map((key) => ({ kind: 'slider', key }));
  return SHEET_ORDER.concat(extra);
}

/* ── 그리개 ──────────────────────────────────────────────────────────────── */

/** 한 축의 ★슬라이더 줄 — ★범위는 ★`RANGES[key]` 에서 ★읽는다(⛔수를 안 적는다).
 *  ★수 칸에만 ★`data-fxpart-axis` 를 단다 — ★★키마다 ★정확히 ★하나 ⇒ ★검사가 ★셀 수 있다. */
function _sliderRow(key, cfg, R) {
  const r = R[key] || {};
  const v = Number.isFinite(cfg[key]) ? cfg[key] : (r.min ?? 0);
  return `
      <div class="prop-row">
        <span class="prop-label">${escHtml(_lbl(key))}</span>
        <input type="range" class="prop-slider" data-fxpart-range="${escHtml(key)}"
               min="${r.min}" max="${r.max}" step="1" value="${v}">
        <input type="number" class="prop-number" data-fxpart-axis="${escHtml(key)}"
               min="${r.min}" max="${r.max}" value="${v}" aria-label="${escHtml(_lbl(key))}">
      </div>`;
}

/** ★크기 — ★시안처럼 ★한 줄에 ★min·max ★두 칸(⛔슬라이더 아님). ★각 칸이 ★제 축을 ★하나씩 쥔다. */
function _pairRow(keys, cfg, R) {
  const cell = (k, pre) => {
    const r = R[k] || {};
    const v = Number.isFinite(cfg[k]) ? cfg[k] : (r.min ?? 0);
    return `<input type="number" class="prop-number" data-fxpart-axis="${escHtml(k)}"
                 min="${r.min}" max="${r.max}" value="${v}" style="flex:1;min-width:0"
                 title="${escHtml(pre)}" aria-label="${escHtml(_lbl(k) + ' ' + pre)}">`;
  };
  return `
      <div class="prop-row">
        <span class="prop-label">${escHtml(_lbl(keys[0]))}</span>
        ${cell(keys[0], 'min')}${cell(keys[1], 'max')}
      </div>`;
}

/** ★색 — ★시안 `renderPal`: ★스와치마다 ★color 입력 ＋ ★✕(둘 이상일 때) · ★＋(여덟 미만).
 *  ★상한 8 은 ⛔내 수가 아니다 — ★`normalize` 가 ★`.slice(0, 8)` 한다(particles-render.js:156).
 *
 *  ★★현빈 2026-10-08 — 「(파티클 색 칸) ★이것도 ★너무 커」 ＋ (「최근」 색 줄을 가리키며) 「★이정도 크기는 어때」
 *    ⇒ ⒜ ★칩 꼴 = `.cv-chip.recent` ★그대로다 — ★20 알약 껍질 ＋ ★가운데 ★13 색 점.
 *       ★그 두 수는 ★css `--cv-chip-size`·`--cv-chip-dot-size` ★한 자리에서 온다(⛔여기 안 적는다).
 *       ★참값 출처 = `css/editor-props.css` ★origin/dev `:572`(width 20) · `:573`(dot 13).
 *       ⚠️★색은 ★점(`.fxpart-chip-dot`)에 칠한다 — ⛔껍질에 칠하면 ★「최근」 칩과 ★다른 그림이 된다.
 *       ⒝ ★✕ 가 ★칸을 ★먹지 않게 ★모서리에 ★겹쳐 두고 ★호버·포커스에만 보인다.
 *          ★전: 색 ★하나당 ★요소 ★둘(스와치 24px ＋ ✕ 22px) ⇒ ★5색이면 ★가로로 ★열 칸.
 *          ★후: 색 ★하나당 ★자리 ★하나(20px) — ✕ 는 ★그 위에 ★겹친다.
 *    ⚠️★★`.prop-color-swatch` ★클래스를 ★빼지 마라 — ★그 클래스가 ★고야 피커를 ★여는 ★손잡이다
 *      (js/props/color-picker.js:1029 document 델리게이션). ★빼면 ★네이티브 OS 색 대화상자로 ★퇴행한다.
 *    ⚠️★✕ 는 ★`.prop-color-swatch` ★«밖»의 ★형제여야 한다 — ★안에 넣으면 ★그 델리게이션이
 *      ★✕ 클릭(mousedown, capture)에서도 ★피커를 ★연다(★우리 click 핸들러보다 ★먼저 돈다). */
function _colorsRow(cfg, max8) {
  const cs = Array.isArray(cfg.colors) ? cfg.colors : [];
  const sw = cs.map((c, i) => `
          <span class="fxpart-chip-wrap">
            <span class="prop-color-swatch fxpart-chip" data-fxpart-color="${i}"
                  title="파티클 색 ${i + 1} — 누르면 색을 고른다">
              <span class="fxpart-chip-dot" style="background:${escHtml(c)}"></span>
              <input type="color" value="${escHtml(/^#[0-9a-fA-F]{6}$/.test(c) ? c : '#ffffff')}"
                     data-fxpart-color-in="${i}" aria-label="파티클 색 ${i + 1}">
            </span>${cs.length > 1 ? `<button class="prop-icon-btn fxpart-chip-del" data-fxpart-color-del="${i}"
                     title="이 색 빼기" aria-label="파티클 색 ${i + 1} 빼기">✕</button>` : ''}
          </span>`).join('');
  const add = cs.length < max8
    ? `<button class="prop-icon-btn" id="sec-fxpart-color-add" title="색 더하기" aria-label="색 더하기">＋</button>`
    : '';
  return `
      <div class="prop-row" style="align-items:flex-start">
        <span class="prop-label" style="line-height:20px">색</span>
        <div class="prop-align-group" id="sec-fxpart-colors">${sw}${add}
        </div>
      </div>`;
}

function _rotRow(cfg) {
  return `
      <div class="prop-row">
        <span class="prop-label">회전</span>
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:11px;color:#ccc;flex:1;">
          <input type="checkbox" id="sec-fxpart-rot" ${cfg.rot ? 'checked' : ''}>
          무작위
        </label>
      </div>`;
}

function _distRow(cfg, dists) {
  return `
      <div class="prop-row">
        <span class="prop-label">분포</span>
        <select class="prop-select" id="sec-fxpart-dist" style="flex:1;min-width:0;" aria-label="파티클 분포">
          ${dists.map((d) => `<option value="${escHtml(d)}"${d === cfg.dist ? ' selected' : ''}>${
            escHtml(DIST_LABEL[d] || d)}</option>`).join('')}
        </select>
      </div>`;
}

function _shapesRow(cfg, shapes) {
  const picked = Array.isArray(cfg.shapes) ? cfg.shapes : [];
  return `
      <div class="prop-row">
        <span class="prop-label">모양</span>
        <div class="prop-align-group" id="sec-fxpart-shapes" role="group" aria-label="파티클 모양">
          ${shapes.map((k) => {
            const L = SHAPE_LABEL[k] || { s: k, t: k };   /* ★폴백 — 모양이 늘어도 조용히 안 죽는다 */
            return `<button class="prop-align-btn${picked.includes(k) ? ' active' : ''}"
                    data-fxpart-shape="${escHtml(k)}" title="${escHtml(L.t)}"
                    aria-pressed="${picked.includes(k)}">${escHtml(L.s)}</button>`;
          }).join('')}
        </div>
      </div>`;
}

/** 「Background」 절에 ★덧붙는 파티클 칸. ⛔자기 `.prop-section` 을 ★만들지 않는다.
 *  ★ParticlesFx 나 배선이 ★안 실렸으면 ★빈 글자 — ★패널은 ★살아야 한다. */
export function secParticlesHTML(sec) {
  const P = _fx();
  if (!sec || !P || typeof window.writeParticles !== 'function') return '';

  if (!_isOn(sec)) {
    return `
      <span class="prop-field-label" style="margin-top:8px">Particles</span>
      <button class="prop-action-btn secondary" id="sec-fxpart-toggle" style="margin-top:4px;"
              title="이 섹션 배경에 파티클을 깝니다 — 배경색은 바뀌지 않습니다">파티클 켜기</button>`;
  }

  const cfg    = window.readParticles?.(sec.dataset) || {};
  const kinds  = Array.isArray(P.KINDS) ? P.KINDS : Object.keys(P.PRESETS || {});
  const shapes = Array.isArray(P.SHAPES) ? P.SHAPES : [];
  const dists  = Array.isArray(P.DISTS) ? P.DISTS : [];
  const R      = P.RANGES || {};
  const open   = window.fxIsCardOpen ? window.fxIsCardOpen(sec, 'particles') : true;
  /* ★★런타임 상태다 — ⛔`cfg` 에서 읽지 않는다(★`cfg` 는 ★저장되는 것이다) */
  const paused = _isPaused(sec);

  /* ★그림이 ★정말 났나 — ⛔「켰다」와 「그려졌다」는 ★다르다(effects-particles.js:124~137 · R3). */
  const wrap = sec.querySelector?.(':scope > .' + (window.FX_PARTICLES_WRAP || 'sec-fxpart-wrap'));
  const drew = !!(wrap && /<svg/.test(wrap.innerHTML || ''));

  const body = _rows(P).map((r) => {
    if (r.kind === 'slider') return _sliderRow(r.key, cfg, R);
    if (r.kind === 'pair')   return _pairRow(r.keys, cfg, R);
    if (r.kind === 'colors') return _colorsRow(cfg, 8);
    if (r.kind === 'rot')    return _rotRow(cfg);
    if (r.kind === 'dist')   return dists.length ? _distRow(cfg, dists) : '';
    if (r.kind === 'shapes') return shapes.length ? _shapesRow(cfg, shapes) : '';
    return '';
  }).join('');

  /* ★안내 글 — ★★시안 `:291`·`:320` ★그대로다. ⛔내가 지어내지 않았다. */
  return `
      <span class="prop-field-label" style="margin-top:8px">Particles</span>
      <div class="prop-cell-card${open ? ' expanded' : ''}" id="sec-fxpart-card" data-fx-type="particles">
        <div class="prop-cell-card-header" id="sec-fxpart-head">
          <button class="prop-icon-btn" id="sec-fxpart-toggle" title="파티클 끄기"
                  aria-label="파티클 끄기" aria-pressed="true">◉</button>
          <span class="prop-cell-card-title" style="flex:1">파티클</span>${!_anim() ? '' : `
          <button class="prop-icon-btn" id="sec-fxpart-pause"
                  title="${paused ? '재생 — 다시 움직입니다' : '일시정지 — 작업하는 동안 멈춥니다(저장되지 않습니다)'}"
                  aria-label="${paused ? '파티클 재생' : '파티클 일시정지'}"
                  aria-pressed="${paused}">${paused ? PLAY_GLYPH : PAUSE_GLYPH}</button>`}
          <button class="prop-icon-btn" id="sec-fxpart-fold" title="${open ? '접기' : '펼치기'}"
                  aria-label="접기/펼치기" aria-expanded="${open}">${open ? '⌄' : '›'}</button>
        </div>
        <div class="prop-cell-card-body" id="sec-fxpart-body"${open ? '' : ' hidden'}>
          <div class="prop-align-group" id="sec-fxpart-presets" role="group" aria-label="파티클 프리셋"
               style="margin-bottom:6px">
            ${kinds.map((k) => `<button class="prop-align-btn${k === cfg.preset ? ' active' : ''}"
                    data-fxpart-preset="${escHtml(k)}" style="flex:1 0 46%"
                    title="${escHtml((P.PRESETS?.[k]?.label) || k)}">${
                    escHtml((P.PRESETS?.[k]?.label) || k)}</button>`).join('')}
          </div>
          <button class="prop-action-btn" id="sec-fxpart-reroll" style="margin-bottom:6px;"
                  title="모양만 새로 뿌린다(설정은 그대로)">🎲 다시 뿌리기</button>
          <div class="prop-row">
            <span class="prop-label">무늬번호</span>
            <input type="number" class="prop-number" id="sec-fxpart-seed" style="flex:1;min-width:0"
                   value="${Number.isFinite(cfg.seed) ? cfg.seed : 1}" aria-label="무늬번호">
            <button class="prop-icon-btn" id="sec-fxpart-redraw"
                    title="같은 번호로 다시 그리기" aria-label="다시 그리기">↻</button>
          </div>
          <div class="prop-hint" style="font-size:11px;color:#888;">이 번호가 같으면 같은 그림이 나옵니다 — 번호만 저장하면 됩니다.</div>
          ${body}
          <div class="prop-hint" style="font-size:11px;color:#888;">불투명도는 파티클 층 통째(0 이면 안 보임) · 흔들림은 조각마다 진하기를 섞어 앞뒤 깊이를 냅니다.</div>
          <div class="prop-hint" style="font-size:11px;color:#888;">글로우(세기)와 퍼짐(반경)은 따로입니다 — 퍼짐만 키우면 같은 빛이 넓게 흩어져 되레 옅어집니다. 밝게 하려면 글로우를 올리십시오. 둘 중 하나가 0 이면 또렷합니다.</div>${drew ? '' : `
          <div class="prop-hint" style="font-size:11px;color:#888;">섹션 크기를 아직 못 재서 그림을 미뤘습니다 — 이 섹션이 화면에 들어오면 그려집니다.</div>`}
          <button class="prop-action-btn danger" id="sec-fxpart-off" style="margin-top:4px;"
                  title="파티클을 끄고 저장 값을 지웁니다">파티클 끄기</button>
        </div>
      </div>`;
}

/* ── 배선 ────────────────────────────────────────────────────────────────── */
/** @param {HTMLElement} sec 섹션 · @param {Function} rerender 섹션 패널 다시 그리기 */
export function wireSecParticles(sec, rerender) {
  const P = _fx();
  if (!sec || !P || typeof window.writeParticles !== 'function') return;

  const $ = (id) => document.getElementById(id);
  const all = (q) => document.querySelectorAll(q);
  const again  = () => { try { rerender?.(); } catch (_) {} };
  const commit = (label) => { try { window.pushHistory?.(label); } catch (_) {} try { window.scheduleAutoSave?.(); } catch (_) {} };
  const draw   = () => { try { window.applySectionParticles?.(sec); } catch (_) {} };
  /** ★지금 그려지는 값(정규화된 것) — ⛔날것 dataset 을 ★손으로 합치지 않는다. */
  const cur = () => window.readParticles?.(sec.dataset) || {};
  /** ★한 축을 쓴다 — ★나머지는 ★지금 값 그대로. ★쓴 뒤 ★normalize 가 ★돌려준 값을 ★되읽는다. */
  const put = (patch) => { window.writeParticles(sec.dataset, { ...cur(), ...patch }); draw(); };

  /* ★켜기 — ★꺼진 상태의 그 단추(id 가 `-toggle` 하나뿐이다) */
  if (!_isOn(sec)) {
    $('sec-fxpart-toggle')?.addEventListener('click', () => {
      commit('섹션 파티클');
      /* ★프리셋은 ★`KINDS` 첫 값을 ★읽는다(⛔이름 하드코딩 금지 · 지디 승인).
         ★seed 는 ★`FxSeed.newSeed()` — ⛔상수 1 이면 ★섹션 둘이 ★같은 그림이 된다. */
      const first = (Array.isArray(P.KINDS) ? P.KINDS : Object.keys(P.PRESETS || {}))[0];
      const seed = window.FxSeed?.newSeed?.();
      window.writeParticles(sec.dataset, { preset: first, seed: Number.isFinite(seed) ? seed : 1 });
      draw(); again();
    });
    return;                                   /* ★꺼져 있으면 ★나머지 칸이 ★없다 */
  }

  /* ★끄기 — ★`clearParticles` ★뿐. ⛔빈 문자열로 덮으면 ★키 둘이 ★고아로 남는다 */
  const off = () => { commit('섹션 파티클'); window.clearParticles(sec.dataset); draw(); again(); };
  $('sec-fxpart-off')?.addEventListener('click', off);
  $('sec-fxpart-toggle')?.addEventListener('click', (e) => { e.stopPropagation(); off(); });

  /* ★접기 — ★패널 «표시»만. ★데이터 무변(★선례 effects-reflect.js:182 와 같은 결 · 같은 저장소를 쓴다) */
  const foldTo = (openNext) => {
    try { window.fxSetCardOpen?.(sec, 'particles', openNext); } catch (_) {}
    const b = $('sec-fxpart-body');
    if (b) b.hidden = !openNext;
    $('sec-fxpart-card')?.classList.toggle('expanded', openNext);
    const f = $('sec-fxpart-fold');
    if (f) { f.textContent = openNext ? '⌄' : '›'; f.setAttribute('aria-expanded', String(openNext)); }
  };
  $('sec-fxpart-fold')?.addEventListener('click', (e) => {
    e.stopPropagation();
    foldTo(!!$('sec-fxpart-body')?.hidden);
  });

  /* ★★일시정지/재생 — ★★런타임만. ⛔`commit()`·`put()`·`writeParticles` ★어느 것도 ★안 부른다.
     ★★단추 꼴은 ★★«움직이개가 돌려준 값»으로 고친다 — ⛔내가 ★예상한 값으로 ★안 적는다
       (★움직이개가 ★거절할 수도 있다 — ★그러면 ★단추가 ★거짓을 보인다).
     ★★그리고 ★패널을 ★다시 그리지 ★않는다(`again()` ⛔) — ★포커스와 ★굴림 자리를 ★안 잃게
       (★선례: ★위 ★「다시 뿌리기」가 ★같은 까닭으로 ★칸만 되읽는다). */
  const pauseBtn = $('sec-fxpart-pause');
  pauseBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    const now = !!_anim()?.togglePaused?.(sec);
    pauseBtn.textContent = now ? PLAY_GLYPH : PAUSE_GLYPH;
    pauseBtn.setAttribute('aria-pressed', String(now));
    pauseBtn.setAttribute('aria-label', now ? '파티클 재생' : '파티클 일시정지');
    pauseBtn.title = now ? '재생 — 다시 움직입니다' : '일시정지 — 작업하는 동안 멈춥니다(저장되지 않습니다)';
  });

  /* ★프리셋 — ★고른 프리셋을 ★통째로 깐다(★seed 는 그대로).
     ★선례 prop-sticker-glow.js:69 「종류를 바꾸면 그 프리셋을 «통째로» 깐다 — seed 는 그대로」.
     ⇒ ⛔`{...cur()}` 로 덮지 않는다 — ★그러면 ★옛 개수가 ★새 프리셋을 ★이긴다. */
  all('#sec-fxpart-presets [data-fxpart-preset]').forEach((b) => {
    b.addEventListener('click', () => {
      const k = b.dataset.fxpartPreset;
      const kinds = Array.isArray(P.KINDS) ? P.KINDS : Object.keys(P.PRESETS || {});
      if (!kinds.includes(k)) return;
      commit('섹션 파티클 프리셋');
      window.writeParticles(sec.dataset, { preset: k, seed: cur().seed });
      draw(); again();
    });
  });

  /* ★다시 뿌리기 — ★seed 만 새로. ★선례 prop-sticker-glow.js:109 */
  $('sec-fxpart-reroll')?.addEventListener('click', () => {
    const s = window.FxSeed?.newSeed?.();
    if (!Number.isFinite(s)) return;          /* ⛔씨앗 생성기가 없으면 ★아무 수나 쓰지 않는다 */
    commit('섹션 파티클 다시 뿌리기');
    put({ seed: s });
    const inp = $('sec-fxpart-seed');
    if (inp) inp.value = cur().seed;          /* ★칸을 ★되읽는다 — ⛔패널을 다시 그려 포커스를 날리지 않는다 */
  });

  /* ★무늬번호 — ★사람이 ★적는 수(시안 note: 「번호만 저장하면 됩니다」) */
  const seedIn = $('sec-fxpart-seed');
  seedIn?.addEventListener('change', () => {
    const v = Number.parseInt(seedIn.value, 10);
    if (!Number.isFinite(v)) { seedIn.value = cur().seed; return; }   /* ⛔못 읽으면 ★되돌린다 */
    commit('섹션 파티클 무늬번호');
    put({ seed: v >>> 0 });
    seedIn.value = cur().seed;
  });
  $('sec-fxpart-redraw')?.addEventListener('click', () => { draw(); });   /* ★같은 번호로 다시 그리기 */

  /* ★★축 전수 — ★`[data-fxpart-axis]` 가 ★키마다 ★하나다 ⇒ ★★돌면서 ★한 벌로 ★배선한다.
     ⛔축마다 ★손으로 ★한 줄씩 적지 않는다 — ★★축이 늘면 ★배선도 ★저절로 붙는다. */
  all('[data-fxpart-axis]').forEach((num) => {
    const key = num.dataset.fxpartAxis;
    const rng = document.querySelector(`[data-fxpart-range="${key}"]`);
    const apply = (raw) => {
      const lo = +num.min, hi = +num.max;
      const v = Math.min(hi, Math.max(lo, Math.round(+raw || 0)));
      put({ [key]: v });
      /* ★칸은 ★normalize 가 ★돌려준 수로 ★되읽는다 — ★상한에서 ★자른 결과·★min/max 뒤바뀜 보정이 그대로 보이게 */
      const got = cur()[key];
      if (Number.isFinite(got)) { num.value = got; if (rng) rng.value = got; }
    };
    num.addEventListener('input',  () => apply(num.value));
    num.addEventListener('change', () => { apply(num.value); commit('섹션 파티클 ' + _lbl(key)); });
    rng?.addEventListener('input',  () => apply(rng.value));
    rng?.addEventListener('change', () => commit('섹션 파티클 ' + _lbl(key)));
  });

  /* ★색 — ★고치기 / ★빼기 / ★더하기. ★상한 8 은 ★그리개가 `normalize` 의 수를 쓴다 */
  all('[data-fxpart-color-in]').forEach((ci) => {
    const i = +ci.dataset.fxpartColorIn;
    ci.addEventListener('input', () => {
      const cs = (cur().colors || []).slice();
      if (i < 0 || i >= cs.length) return;
      cs[i] = ci.value;
      put({ colors: cs });
      /* ★색은 ★점에 있다(껍질은 「최근」 칩과 같은 알약이라 ★칠하지 않는다)
         ⛔다시 그리면 피커가 닫힌다 ⇒ ★그 자리에서 고친다 */
      const dot = ci.closest('.prop-color-swatch')?.querySelector('.fxpart-chip-dot');
      if (dot) dot.style.background = ci.value;
    });
    ci.addEventListener('change', () => commit('섹션 파티클 색'));
  });
  all('[data-fxpart-color-del]').forEach((x) => {
    x.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation();
      const cs = (cur().colors || []).slice();
      const i = +x.dataset.fxpartColorDel;
      if (cs.length <= 1 || i < 0 || i >= cs.length) return;   /* ★마지막 하나는 ★못 뺀다 */
      cs.splice(i, 1);
      commit('섹션 파티클 색 빼기');
      put({ colors: cs });
      again();                                   /* ★스와치 수가 바뀐다 ⇒ ★다시 그린다 */
    });
  });
  $('sec-fxpart-color-add')?.addEventListener('click', () => {
    const cs = (cur().colors || []).slice();
    if (cs.length >= 8) return;
    cs.push(cs[cs.length - 1] || '#ffffff');
    commit('섹션 파티클 색 더하기');
    put({ colors: cs });
    again();
  });

  /* ★회전 — 참거짓. ⛔`RANGES` 에 ★없는 축이라 ★따로 짓는다 */
  $('sec-fxpart-rot')?.addEventListener('change', (e) => {
    commit('섹션 파티클 회전');
    put({ rot: !!e.target.checked });
  });

  /* ★분포 — `DISTS` 가 ★키를 준다 */
  const distEl = $('sec-fxpart-dist');
  distEl?.addEventListener('change', () => {
    const dists = Array.isArray(P.DISTS) ? P.DISTS : [];
    if (!dists.includes(distEl.value)) return;
    commit('섹션 파티클 분포');
    put({ dist: distEl.value });
  });

  /* ★모양 — ★여럿 고르기. ★★마지막 하나는 ★못 끈다:
     ★까닭 = `normalize`(particles-render.js:157)는 ★빈 배열이면 ★프리셋 모양으로 ★되돌린다
     ⇒ ★다 끄면 ★«끈 것»이 아니라 ★«프리셋으로 돌아간 것»이 되어 ★사람이 어리둥절해진다.
     ⇒ ★그 입력을 ★그냥 ★무시한다(⛔조용히 다른 값을 쓰지 않는다). */
  all('#sec-fxpart-shapes [data-fxpart-shape]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const k = btn.dataset.fxpartShape;
      const have = (cur().shapes || []).slice();
      const at = have.indexOf(k);
      if (at >= 0) { if (have.length <= 1) return; have.splice(at, 1); }
      else have.push(k);
      commit('섹션 파티클 모양');
      put({ shapes: have });
      again();
    });
  });
}

if (typeof window !== 'undefined') {
  /* ★창 다리 — ★prop-section.js 가 ★이 둘을 부른다. ★나머지 셋은 ★검사가 ★읽는 자리다
     (★`SHAPE_LABEL`·`AXIS_LABEL` 을 ★창으로 내보내 ★★「RANGES/SHAPES 전부에 글이 있나」를 잠근다). */
  Object.assign(window, {
    secParticlesHTML, wireSecParticles,
    SEC_PARTICLES_SHAPE_LABEL: SHAPE_LABEL,
    SEC_PARTICLES_AXIS_LABEL: AXIS_LABEL,
    SEC_PARTICLES_DIST_LABEL: DIST_LABEL,
  });
}
