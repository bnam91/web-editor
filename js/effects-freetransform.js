/* ═══════════════════════════════════════════════════════════════════════════
   EFFECTS 식구 — ★자유변형(네 점 Distort) · ★U2 = «렌더 배선»(⛔핸들 없음)
   (2026-10-23 · 지디 발주 `ORDER-u2-text-ft-ui-261023.md` · 설계 `PLAN-text-freetransform-impl.md` U2)
   ─────────────────────────────────────────────────────────────────────────────
   ★현빈 원문(msg5333·5378·5406·5416·5426) — 「이펙트 누르면 자유변형」 ·
     「사다리꼴도 되어야」 · 「프레임 안에 텍스트 모양만 변형」 · 「박스가 아예 글자를 계속 감쌈」 ·
     「여덟점 따로 안 함」(= 변의 두 점은 ★묶여 있다 — U3 의 `C_tied` 가 그 길을 잠근다).

   ★이 파일이 하는 일 = 명부(js/effects-registry.js)에 ★식구 ⑤ 를 등록하는 것 ＋ «데이터 → 화면» 렌더 문 하나.
     ⇒ 패널 파일(prop-text-template · prop-text)은 ★한 줄도 안 바뀐다(명부 합격 기준 「등록만 하면 뜬다」).
     ★선례 = js/effects-glow.js(식구 ④) 의 꼴을 그대로 본뜬다. ⛔새 UI 언어를 발명하지 않았다.

   ★★정본 = `.text-block` 의 ★dataset ★하나 — `tfCorners = "x0,y0,x1,y1,x2,y2,x3,y3"`
     순서 `nw · ne · se · sw` · 단위 = ★모델 px(글자 상자 좌상단이 원점) · 길이 ★8.
     ⛔`matrix3d` 16값을 ★싣지 마라 — ★그 여덟에서 ★매번 계산한다(발주 ② · 한쪽만 정본).
     ⛔찌그러짐을 `font-size`·`letter-spacing` 으로 ★굳히지 마라 — 「블럭으로도 유지되나」의 답이 ★「안 된다」가 된다.
       잠그는 자 = `NoFreeze_fontsize`(`tfCorners` 를 지우면 글자 크기가 바닥값으로 돌아온다).

   ★★«잰 값»은 싣지 않는다 — `W H OX OY` 는 ★WeakMap 에 산다(기계마다 1~2px 다르다 ⇒ 골든이 흔들린다).
     ★앵커: js/drag-utils.js:1282 「기하에서만 나온 값이라 … 저장본에 실려도 된다 …
       실제 글자를 잰 결과(`grbPieFitTags`)는 ★다른 변수(저장에서 걷힘)에 산다」
     ★WeakMap 꼴의 선례 = js/effects-registry.js:58 `_openCards`(＋접근자 쌍).
     ⛔모듈 변수로 두지 마라 — 시안 8판이 ★글상자 한 개 무대라 그 꼴이었고, 제품에선
       「A 를 손대면 B 가 reset」 사고가 난다(설계 ①⑶-3).

   ★★변형 대상 = ★`.tb-h1` 등 ★글자칸 ★하나뿐(정정 ⑨ · 현빈 msg5406).
     ⛔`.text-block`(파란 아웃라인)에 행렬을 걸지 마라 — 아웃라인이 같이 찌그러진다.
       잠그는 자 셋이 ★같이 빨개진다: `NegA_pixel_same` ＋ `NegC_tb_no_transform` ＋ `K_from_glyph_box`(U3).
     ★실측(261023) — 글자칸의 `transform` 자리는 ★비어 있다:
       `grep -rn "contentEl.style.transform\|ce.style.transform\|glyph.style.transform" js/` ⇒ ★0건.
       회전 host 는 ★tf 또는 ★`.text-block` 이고(js/asset-rotate.js:350~351) ★글자칸이 ★아니다
       ⇒ 서로 다른 요소의 다른 style 객체라 ★다투지 않는다.

   ★★박스(⒞ 「계속 감쌈」) = ★정규화된 경계로 ★`width` ＋ ★`min-height` 를 ★매번 쓴다.
     ⛔`height` 가 아니라 `min-height` — js/overlay-handles.js:3441~3443 「높이는 «쓰지 않고 잰다».
       height 를 쓰면 줄이는 순간 글자가 조용히 잘린다」
     ★가로는 ★㉣ — `.text-block` ★과 ★tf ★둘 다에 «★같은 폭». 까닭 = `.claude/rules/js-structure.md:23`
       「★너비 ★항상 ★동일: frame-block(래퍼)과 내부 블록은 항상 같은 너비」 ★그 까닭을 지킨다.
     ★★그 갈림을 ★행위로 쟀다(261023 · 발주 §1 칸 1 · 정본 §586 의 막힘을 닫았다):
       장면 = ★앱 입구로만 만들었다 — `addSection()` → `selectSection()` → `addTextBlock('h1')` →
         섹션 재선택 → `addTextBlock('body')` ⇒ section-inner 흐름에 글상자 ★뒤에 ★이웃이 선다.
       `W_neighbor_unmoved`(이웃 블럭 `getBoundingClientRect().top` 의 변화):
         ★전제 양성대조 `tb` min-height ＋80 ⇒ ★＋80.00 (이웃이 ★움직인다 = 「원래 안 움직이는 놈」이 아니다)
         ㉢ `tf` 폭만 ＋120            ⇒ ★0.00
         ★㉣ `tb`＋`tf` 같은 폭 ＋120  ⇒ ★★0.00   ← ★이 수가 ㉣ 를 골랐다
         ㉣ 같은 폭 −200(좁히는 쪽)    ⇒ ★0.00
       ⇒ ★★㉣ 가 산다. ★세로(⒞)는 이웃을 ★정확히 그만큼 밀지만, 그것은 ㉣ 의 흠이 아니라
         ⒞ 의 피할 수 없는 결과이고 ★tf 는 `height` 가 막혀 있어 ㉢ 로 가도 ★같다.
     ⚠️`tf` 는 ★`max-width:100%` 다(실측: `tf.style.width='916px'` → computed ★796px 로 ★캡된다)
       ⇒ 박스가 섹션 폭을 ★넘는 꼴에서는 ★`tb` 만 넓어진다(「셋이 같다」가 그 꼴에서 거짓).
       ⛔그 꼴을 ★`W_three_equal` 로 재지 마라 — 넘지 않는 꼴에서 재라.

   ★★U2 가 ★하지 않는 것(⛔U3 까지 묶어 가지 않는다 — 설계 ⑥ U2 가 그렇게 적었다):
     ⛔핸들 12 · ⛔모서리 끌기 · ⛔격자·테두리 레이어 · ⛔`js/overlay-handles.js`·`js/editor.js` 무접촉.
     ★U2 에서 네 점은 ★프로그램이 넣는다 — `window.setFxFreeTransform(tb, C)`.
     ⇒ 「이펙트 → 자유변형」을 고르면 ★항등 네 점이 붙고(보이는 변화 0), 그 문으로 네 점을 주면
       ★글자가 찌그러지고 ★박스가 감싼다. 끄는 것은 ★카드의 `✕`.

   ★회귀: tests/unit/text-freetransform-homography.test.mjs(셈 · U1) ·
         tests/dom/text-freetransform.dom.spec.js(이 파일 · U2 단언 15 ＋ 현빈 QA 두 칸)
   ═══════════════════════════════════════════════════════════════════════════ */
import { registerFxType, fxIsCardOpen, fxSetCardOpen } from './effects-registry.js';
import { homography, cornerMatrix3d, normalizeCorners, boxFromCorners } from './fx/homography.js';
import { ALIGN_SELF_OF } from './props/prop-text-wireup-align.js';   /* t7-03 — 가로 정렬 → align-self 사상표 한 자리 */

/** ★정본 키 — ★하나다. ✕ = 이 키를 지움 ⇒ 켜기 전 바이트(반사·글로우와 같은 규약). */
export const FX_FT_KEYS = ['tfCorners', 'tfTouched', 'tfSchema'];
/* ★★★`tfSchema` (2026-10-25 · 지디 · ★server-manager GO · ⛔main 머지는 현빈 게이트)
   ★무엇 : ★★«이 블록은 ★새 꼴로 ★저장됐다»는 ★사실 ★하나. ★값은 `'1'` 뿐.
     ★`tfTouched` 와 ★다르다 — ★그것은 ★«사람이 끌었나», ★이것은 ★«어느 판이 저장했나»다.
   ★★왜 ★필요한가 — ★★★`tfTouched` ★하나로는 ★★옛 파일을 ★구할 수 ★없었다 :
     ★옛 파일은 ★`tfTouched` 가 ★없다. ★그런데 ★«변형 안 하고 켜기만 한 ★새 블록»도 ★없다.
     ⇒ ★★둘이 ★구분이 ★안 된다 ⇒ ★한쪽을 살리면 ★다른 쪽이 ★죽는다.
   ★★★실측으로 ★증명했다 — ★처방 ★둘을 걸어 ★★둘 다 ★`Y3` 를 ★깼다(261025) :
     ⒜ 「키 없으면 ★보수적 `touched=true`」      → ★`Y1b`(목적) ＋ ★★`Y3` ★빨강
     ⒝ 「★`watchAll` 경로에서만 ★덮어쓰기 끄기」   → ★`Y1b`(목적) ＋ ★★`Y3` ★빨강
     ⛔⒝ 를 걸 때 ★내 추론이 ★틀렸다 : ★`Y3` 는 ★★`rebindAll → watchAllFx` 경로다.
   ★★무엇을 ★막나 (★미카사 실측 261025 · ★★영구 손실)
     조건 = 「★새 앱 ＋ ★`tfTouched` 없는 ★옛 파일 ＋ ★그 뒤 ★아무 저장」
     ⇒ ★★디스크의 네 점이 `0,0,400,0,400,120,0,120` → ★`0,0,164.6,0,164.6,43,0,43` 로 ★굳었다
     ★사용자 눈 = 「★업그레이드 뒤 ★옛 작업을 열어 ★★다른 곳 하나만 고쳐도 ★조용히 사라진다」
   ★★가름
     `tfSchema` ★있음 → ★`tfTouched` 를 ★믿는다(없으면 ★false) ⇒ ★덮어쓴다(★`Y3` 가 ★산다)
     `tfSchema` ★없음 → ★★«옛 파일»이다 ⇒ ★★보수적 `true` ⇒ ★★안 덮어쓴다(★손실 ★0)
   ★★★⛔그래도 ★「전부 고쳤다」가 ★아니다 : ★★이미 ★잃은 파일은 ★★안 돌아온다.
     ★이름 = `FT-ALREADY-LOST-FILES-NOT-RECOVERED-01`(★미측 · `proj_history` 축은 ★미카사 몫)
   ★대칭 : ★이 명부에 있으므로 ★✕ 가 ★`tfCorners`·`tfTouched` 와 ★같이 ★지운다.
   ★재는 자 = `tests/dom/ft-axis-aligned-transform-lost.dom.spec.js` */
/* ★★★`tfTouched` (2026-10-24 · 지디 · ★server-manager GO · ⛔main 머지는 현빈 게이트)
   ★무엇 : ★★«사람이 ★네 점을 ★끌었다»는 ★사실 ★하나. ★값은 `'1'` 뿐이고 ★없으면 ★「모른다」다.
   ★★왜 ★필요한가 — ★★꼴로는 ★가를 수 ★없다(★실측으로 ★증명했다) :
     「★축정렬로 ★400×120 으로 ★키웠다」와 「★글자가 ★400×120 이 ★됐다」는
     ★★저장본에서 ★★★같은 데이터다 — corners 만 실리고 ★`W·H` 는 ★저장되지 ★않는다.
     ⇒ ★`_isBaseRect`(꼴)만으로 판정하면 ★★`FT-AXIS-ALIGNED-TRANSFORM-LOST-ON-RESTORE-01` 이 난다
       (★복원 뒤 ★네 점이 `_baseRect(W,H)` 로 ★덮어써져 ★변형이 ★통째로 ★사라진다).
     ⇒ ★「바탕 W·H 와 같은가」로 좁히는 ★무접촉 길도 ★★기각했다 — ★그러면 ★«변형 안 하고 ★글자만
       바꿔 저장한» 글상자가 ★★찌그러진다(★실측 identDiff ★0.77 ~ ★4.28).
   ★★backward-compat — ⛔옛 파일을 ★깨지 ★않는다 :
     ★키가 ★없으면 ★`watchAll` 은 ★★지금 그대로 ★꼴 판정(`_isBaseRect`)을 쓴다.
     ⇒ ★옛 파일 ★로드 ★OK · ★옛 동작 ★그대로. ★★그래서 ★★옛 파일에서는 ★★안 고쳐진다 —
       ★★★「전부 고쳤다」로 ★적지 ★마라. ★참값 = 「★새로 저장한 파일부터 ★닫힌다」.
   ★대칭 : ★이 명부에 있으므로 ★✕(`setFxFreeTransform(tb, null)`)가 ★`tfCorners` 와 같이 ★지운다.
   ★재는 자 = `tests/dom/ft-axis-aligned-transform-lost.dom.spec.js` */
/** 네 점이 「바탕 네모인가」를 가르는 너그러움(모델 px) — ⛔판정용이 아니라 ★«글꼴이 늦게 와 W·H 가 바뀐 것»을 가린다. */
const BASE_EPS = 0.5;

/* ★글자칸 — js/effects-glow.js:61~65 과 ★같은 순서(contenteditable 먼저, 없으면 tb-* 칸).
   ★이 선택자 목록은 이 레포의 ★관용구다(실측 261023: `editor.js:3090` · `effects-glow.js:64` ·
     `prop-text.js:36` · `text-block-color.js:33` · `prop-multisel.js:589` · `canvas-contrast.js:313` ·
     `animation-engine.js:112` · `text-effect-transform.js:70` ★여덟 자리) ⇒ ★아홉째를 쓰는 것은
   「명부를 둘로 만드는 것」이 아니라 「관용구를 따르는 것」이다(설계 ⑤-ⓛ 가 `HALF` 에 쓴 것과 같은 결). */
function _contentOf(tb) {
  if (!tb || !tb.querySelector) return null;
  return tb.querySelector('[contenteditable]')
    || tb.querySelector('.tb-h1,.tb-h2,.tb-h3,.tb-body,.tb-caption,.tb-label,.tb-bullet,.tb-liner,.itb-text');
}

/** 글상자를 품은 text-frame 래퍼(없으면 null) — ★㉣ 의 둘째 폭이 여기 간다. */
const _tfOf = (tb) => (tb && tb.closest ? tb.closest('.frame-block[data-text-frame="true"]') : null);

/* ── 블럭마다의 «잰 값» ──────────────────────────────────────────────
   tb → { W, H, OX, OY, tfW0, tfMeasW, measured, touched }
     ★★`tfW0` 와 ★`tfMeasW` 는 ★★다른 일을 한다 — ⛔섞지 마라(261024 에 섞여 있어 사고가 났다) :
       `tfW0`    = ★✕(`_strip`)이 ★«되돌릴» 폭. ★출처 = `tf.dataset.width`(패널이 정한 값) → 없으면 `'100%'`
       `tfMeasW` = ★`ftMeasure` 가 ★글자를 ★«어느 폭에서 잴지». ★출처 = ★첫 측정 때의 «지금 폭»(ktf)
   ★`tfW0` = 효과를 ★켜기 «전»의 tf 인라인 폭 — ⛔없으면 사용자가 패널로 정한 폭을
     우리가 ★조용히 먹는다(js/props/prop-text-wireup-position.js applyW 가 `tf.style.width` 를 쓴다). */
const _tfState = new WeakMap();
/** 그 블럭의 잰 값(없으면 null) — ★패널·렌더·시험이 «같은 이 함수»를 본다. */
export const ftStateOf = (tb) => _tfState.get(tb) || null;

/** 캔버스 실제 배율 — ⛔`window.currentZoom` 을 ★가정하지 않고 ★잰다(시안 8판 「실제 배율 — 가정하지 않고 잰다」).
 *  화면 px ÷ 레이아웃 px. 잴 수 없으면 1(변환 없음)로 둔다. */
function _scaleOf(el) {
  const ow = el && el.offsetWidth;
  if (!ow) return 1;
  const z = el.getBoundingClientRect().width / ow;
  return Number.isFinite(z) && z > 0.01 ? z : 1;
}

/** 모서리 여덟 숫자 → 네 점(쉼표로 쪼개 ★길이 8 이어야 한다 · 아니면 null). ★`P3` 가 이 꼴을 잰다. */
export function ftCornersOf(tb) {
  const raw = tb && tb.dataset ? tb.dataset.tfCorners : '';
  if (!raw) return null;
  const n = String(raw).split(',').map(Number);
  if (n.length !== 8 || n.some(v => !Number.isFinite(v))) return null;
  return [[n[0], n[1]], [n[2], n[3]], [n[4], n[5]], [n[6], n[7]]];
}

/** 네 점 → 저장 글자(소수 둘로 자른다 — 저장본이 기계마다 흔들리지 않게). */
const _cornersToStr = (C) => C.map(([x, y]) => `${Math.round(x * 100) / 100},${Math.round(y * 100) / 100}`).join(',');

/** 그 네 점이 ★«바탕 네모»인가 — 좌상단이 원점인 축 정렬 직사각형.
 *  ★까닭(설계 ⑥ U2 ⑶): 글꼴이 ★늦게 와 W·H 가 바뀌면, 저장된 네모는 ★옛 W·H 의 것이라
 *    「변형 0 인데도 항등이 아닌」 행렬이 난다(실측 `matrix(0.952,0,0,0.795)`).
 *    ⇒ ★네모면 ★새 W·H 로 ★다시 맞춘다. ⛔사람이 찌그러뜨린 뒤에는 ★안 건드린다.
 *  ★「기본 네모면 다시 맞춘다」는 ★설계가 쓴 ★그 말이다 — ⛔W·H 값을 견주지 않는다(그러면 옛 W·H 가 필요해진다). */
function _isBaseRect(C) {
  if (!C) return false;
  const [nw, ne, se, sw] = C;
  const w = ne[0], h = sw[1];
  return Math.abs(nw[0]) <= BASE_EPS && Math.abs(nw[1]) <= BASE_EPS
      && Math.abs(ne[1]) <= BASE_EPS && Math.abs(sw[0]) <= BASE_EPS
      && Math.abs(se[0] - w) <= BASE_EPS && Math.abs(se[1] - h) <= BASE_EPS
      && w > BASE_EPS && h > BASE_EPS;
}

/** 바탕 네모(항등 네 점) — 글자 상자 그대로. */
const _baseRect = (W, H) => [[0, 0], [W, 0], [W, H], [0, H]];

/* ★★«옛 파일 전용» 추정자 — ★네 점이 ★«바탕 W·H 의 네모»와 ★같은가(★비율 허용).
   ★★★`tfSchema` 가 ★있는 판에는 ★쓰지 ★마라 — ★거기는 ★`tfTouched` 로 ★정확히 안다.
     ⛔261024 에 ★이것을 ★«모든 판»에 ★쓰려다 ★기각했다 : ★새 파일에서 ★«변형 안 하고
       ★글자만 바꿔 저장한» 블록이 ★찌그러졌다(★실측 identDiff ★0.77 ～ ★4.28).
     ★★그 흠은 ★«새 파일에 ★썼기» 때문이다. ★옛 파일에는 ★이것이 ★★최선의 추정이다 —
       ★거기엔 ★다른 열쇠가 ★아예 ★없다.
   ★허용값의 ★근거 : ★W·H 는 ★측정값이라 ★기계마다 ★1~2px 다르다(★이 파일 머리말 `:20`)
     ⇒ ★절대 px 가 아니라 ★★비율로 둔다. */
const _OLDFILE_NEAR = 0.02;
function _isBaseRectOfLegacy(C, W, H) {
  if (!_isBaseRect(C)) return false;
  if (!(W > 0) || !(H > 0)) return false;
  const w = C[1][0], h = C[3][1];
  return Math.abs(w - W) / W <= _OLDFILE_NEAR && Math.abs(h - H) / H <= _OLDFILE_NEAR;
}

/* ★★★되먹임을 끊는다 (261022 픽셀 실측이 잡았다 · 설계 ⑦-⑵ ⒜):
     렌더가 쓴 `tb.style.width` ★안에서 다시 재면 W 가 줄고 ⇒ 다음 렌더가 더 찌그러진다
     ⇒ ★«켜기 전»인데 `matrix(0.952, 0, 0, 0.795)` 가 났다.
   ⇒ ★재기 «전»에 ★우리가 쓴 인라인 치수를 ★걷는다. 그리고 ★«한 번만» 잰다(글이 바뀔 때만 force).
   ⛔소스에 `measured` 가 있나로 재지 마라 — 다른 경로로 되먹임이 생기면 소스 자는 초록이다.

   ★★★⚠️이 ★치수 걷기는 ★지금 판에서 ★★«발동 0» 이다 — ⛔「세워 뒀다」를 ★「잠겼다」로 읽지 마라.
     ★무력화 대조(261023 M3): ★`tb.style.width=''; tb.style.minHeight=''` ★두 줄을 ★죽여도
       ★U2 의 ★18칸이 ★★전부 초록이었다(★빨강 ★0 건).
     ★까닭 = ★`boxFromCorners` 의 ★★하한 둘(`W+OX`·`H+OY`)이 ★★이미 막는다 — 우리가 쓰는 폭은
       ★★«바탕 글자 폭보다 작아지지 않으므로» 그 안에서 다시 재도 ★글이 더 접히지 않는다
       (★실측: 좁히는 변형 ×4 회 렌더에서 ★W 가 ★658.41 그대로 · 흘러간 양 ★0).
     ⇒ ★★«진짜 자물쇠»는 ★그 하한 둘이다. ⚠️★그런데 ★★그것도 ★처음엔 ★아무도 안 잠갔다 —
       ★설계 ④ 변이 ⒁ 는 「하한을 빼면 `D_zero_same_as_base` ＋ `D_box_real` 빨강」이라 적었는데
       ★★둘 다 ★거짓이었다(★내가 쟀다 261023):
         · ★U2 M11(하한 없는 식) ⇒ `D_box_real` ★초록
         · ★U1 `D_zero_same_as_base` 는 ★«변형 0» ★한 꼴만 재고 ★그 꼴에서 두 식은 ★값이 같다
           (스크래치 실측: 변형 0 × OX·OY 네 짝 ★전부 동일 / ★«안쪽으로 줄임» 꼴에서만 갈린다 —
            w200 h60 vs ★w100 h30)
       ⇒ ★★그래서 ★U2 에 ★`D_floor_keeps_base` 를 ★더해 ★그 하한을 ★수로 못박았다
         (★M11 ⇒ 그 칸 ★빨강 · ⚠️발주 §3 의 15 ★밖이라 ★보고에 적었다).
     ⇒ ★★이 두 줄은 ★★«중복 방어»로 ★남긴다 — ★박스 식이 뒤에 바뀌어 하한이 사라지면 ★그때 값을 한다.
       ⛔「이 줄이 `PRE-IDENTITY` 를 잠근다」로 ★적지 않는다(★그것이 ★거짓이었다). */
/** 글자 상자를 잰다 — `{W,H,OX,OY}`(모델 px). 못 재면 null. */
export function ftMeasure(tb, force) {
  const ce = _contentOf(tb);
  if (!ce || !tb.isConnected) return null;
  const st = _tfState.get(tb) || { tfW0: null, tfMeasW: null, measured: false, touched: false };
  if (st.measured && !force) return st;

  const tf = _tfOf(tb);
  const kw = tb.style.width, kmh = tb.style.minHeight, kce = ce.style.transform, ktf = tf ? tf.style.width : null;
  tb.style.width = ''; tb.style.minHeight = '';
  ce.style.transform = 'none';
  ce.style.width = '';   /* ★119 ㉡ — 아래에서 글자 폭으로 다시 박는다 · 재는 동안은 비운다(줄바꿈은 «재는 폭»에서) */
  /* ★★★2026-10-24 — ★★«재는 폭»과 ★«✕ 로 되돌릴 폭»을 ★★갈랐다. ★이름 = `FT-TFW0-TWO-USES-01`
     ★★까닭(★실측) : ★`tfW0` 하나가 ★두 일을 하고 있었다 —
       ⒜ `ftMeasure` 가 ★글자를 ★«어느 폭에서» 재나      ⒝ `_strip`(✕)이 ★«어느 폭으로» 되돌리나
     ★★`FT-TFW0-LOST-ON-RESTORE-01` 을 고치려고 ⒝ 의 출처를 `tf.dataset.width` 로 바꿨더니
       ★★⒜ 까지 끌려가 ★`tf.style.width` 가 ★338.344px → ★164.719px 로 ★바뀌었다.
     ★★★261024 ★정정 — ★그때 나는 ★그것을 ★「★box 폭이 ★악화됐다」로 ★읽었다. ★★틀렸다 :
       ★교차 측정(판 둘 × 글자 셋)에서 ★★`box.w` 는 ★★두 판 ★모두 ★★400 이었다(★`boxDelta: 0`).
       ★★338.344 · 164.719 는 ★★`box.w` 가 ★아니라 ★★`W`(글자 폭)였고,
       ★그 값이 `tf.style.width` 에 ★실린 까닭은 ★★그 장면의 ★네 점이 ★★직사각형이라
         ★★변형이 ★사라져 `_baseRect(st.W, st.H)` 로 ★덮어써졌기 ★때문이다
         (★★별개 결함 = `FT-AXIS-ALIGNED-TRANSFORM-LOST-ON-RESTORE-01` ·
          ★재는 자 = `tests/dom/ft-axis-aligned-transform-lost.dom.spec.js`).
       ⇒ ★★「오차 62 → 235 악화」는 ★★★철회한다.
     ★★그래도 ★★이 가름(⒜·⒝ 분리) 자체는 ★★유효하다 — ★한 칸이 ★두 일을 하면
       ★한쪽을 고칠 때 ★다른 쪽이 ★조용히 끌려간다. ★그건 ★여전히 참이다.
     ⇒ ★⒜ 는 ★★`tfMeasW`(= 첫 측정 때의 ★«지금 tf 폭» ktf)로 ★따로 둔다 — ★옛 동작 그대로.
       ★⒝ 만 `tfW0` 다. ★두 칸을 ★섞지 마라.
     ★재는 자 : `tests/dom/ft-tfw0-restore-loss.dom.spec.js` T1·T2 ＋ ★T5(★복원 직후 폭이 악화되지 않는다) */
  if (tf) tf.style.width = st.tfMeasW == null ? ktf : st.tfMeasW;   /* ★재는 폭 — ⛔'' 로 비우면 사용자 폭을 잃는다 */

  const z = _scaleOf(tb);
  const r = document.createRange();
  r.selectNodeContents(ce);
  const b = r.getBoundingClientRect();
  r.detach?.();
  const gb = ce.getBoundingClientRect();

  /* ★★OX·OY 는 ★음수일 수 있다 — 글꼴의 ascender 가 `line-height` box 를 넘는다
     (실측 261023 제품: 글자 86.0 vs box 114.39 ⇒ OY = −2 · 261022 시안: OY = −19).
     ⛔음수를 그대로 더하면 박스가 모자란다 ⇒ `boxFromCorners` 의 ★하한 둘이 그것을 막는다. */
  st.W = b.width / z; st.H = b.height / z;
  st.OX = (b.left - gb.left) / z; st.OY = (b.top - gb.top) / z;
  /* ★119 ㉡ FT-BOX-RESERVES-ALIGN-GUTTER-01(현빈 확정 · 저장본 영향 감수) — 상자가 글자를 «딱» 감싼다.
     ★잰 값(실앱 8608bb13 ×3 · h1 「짧은 글」 가운데): 글자 285.51 · 상자 501 · 글자 좌우 빈 띠 107.75 / 107.75.
     ★뿌리: 위 OX 는 «재는 폭»(섹션 100%)에서 가운데 정렬이 만든 들여쓰기다 — 그것이 상자 폭(boxFromCorners W+OX)·
       원점·손잡이 자리(effects-ft-handles OX)에 그대로 들어갔다. 다시 열면 재는 폭이 저장된 px 라 OX 가 달라져
       상자 폭도 바뀌었다((27) 134 실측 527.17 → 432.62).
     ★처방: 줄바꿈은 «재는 폭»에서 정한 채로, 글자칸 폭을 글자 폭으로 박고(올림 1px 안) 그 자리에서 OX 를 다시 잰다
       ⇒ OX ≈ 글자칸 제 여백뿐 · 상자 = 글자. 줄바꿈이 바뀌면(W 가 달라지면) 박지 않는다(옛 동작).
     ★저장 필드: 글자칸 style.width 하나가 는다(✕ 는 _strip 이 걷는다). */
  {
    const cs = getComputedStyle(ce);
    const padX = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0)
               + (parseFloat(cs.borderLeftWidth) || 0) + (parseFloat(cs.borderRightWidth) || 0);
    ce.style.width = (Math.ceil(st.W) + (cs.boxSizing === 'border-box' ? padX : 0)) + 'px';
    const r2 = document.createRange();
    r2.selectNodeContents(ce);
    const b2 = r2.getBoundingClientRect();
    r2.detach?.();
    const gb2 = ce.getBoundingClientRect();
    if (Math.abs(b2.width / z - st.W) < 0.5 && Math.abs(b2.height / z - st.H) < 0.5) {
      st.OX = (b2.left - gb2.left) / z; st.OY = (b2.top - gb2.top) / z;
    } else {
      ce.style.width = '';
    }
  }
  st.measured = true;
  /* ★★★2026-10-24 ⅲ) — ★⒜ ★«재는 폭»의 ★출처를 ★★`tf.dataset.width` 로 ★고른다.
     ★이름 = `FT-MEASURE-WIDTH-DESIGN-UNDECIDED-01` ★★닫힘(★측정이 ★한 방향을 가리킨다).
     ★★왜 : ★저장 ★전에는 ★«사용자 폭»에서 ★재고, ★복원 ★뒤에는 ★«저장된 box 폭»에서 ★재고 있었다
       ⇒ ★긴 글이 ★다른 폭에서 ★꺾여 ★`W` 가 달라지고 ★행렬이 ★갈렸다
         (★`FT-RESTORE-REMEASURES-AT-OTHER-WIDTH-01` = ★적대적 ⒠ ★C3).
     ★★측정 — ★★축정렬 손실을 ★닫은 ★뒤에 ★다시 쟀다(★그 전에는 ★그것이 ★끼어들어 ★판정이 ★틀렸다) :
       | 장면 | `ktf` matDiff | ★`dataset.width` matDiff |
       | 여러 줄·축정렬 | ★0.35706  | ★★0 |
       | 여러 줄·사다리꼴 | ★0.285647 | ★★0 |
       | 한 줄·둘다      | 0        | 0 |
       ★그리고 ★★모든 장면에서 `cornersKept ★true` · `tf 400px → ★400px` · `✕ 뒤 ★300px`
       ⇒ ★★box 영향 ★0 · ★C2 영향 ★0 · ★네 점 ★유지.
     ★★★앞서 적었던 ★「두 자가 ★반대를 가리킨다」는 ★★★철회한다 —
       ★그 전제는 ★축정렬 손실이 ★`tf.style.width` 에 ★`W` 를 ★싣고 있던 ★탓이었다.
     ★★⒜ 와 ⒝ 는 ★★여전히 ★다른 칸이다 — ★★폴백이 ★갈린다 :
       `tfW0`(✕ 가 되돌릴 폭) : `dataset.width` → ★없으면 ★`'100%'`
       `tfMeasW`(재는 폭)     : `dataset.width` → ★없으면 ★`ktf`
     ★재는 자 : `ft-restore-remeasures-at-other-width.dom.spec.js` X1 · `ft-tfw0-restore-loss` T5 */
  if (st.tfMeasW == null && tf) {
    const dsW = tf.dataset && tf.dataset.width;
    st.tfMeasW = (dsW != null && dsW !== '' && Number.isFinite(parseFloat(dsW))) ? (parseFloat(dsW) + 'px') : ktf;
  }
  /* ★★★2026-10-24 — ★`tfW0` 의 ★출처를 ★고쳤다. ★이름 = `FT-TFW0-LOST-ON-RESTORE-01`
     ★★증상(★행위 측정 3/3) : ★폭 300px 짜리 글상자에 ★자유변형을 켜고 ★넓혀(box 400) ★저장한 뒤
       ★★다시 열고 ★효과 ✕ 를 누르면 ★tf 폭이 ★★`400px` 로 ★굳는다 — ★사용자가 정한 ★300 이 ★영영 사라진다.
       (★저장 ★전에 ✕ 하면 ★`''` 로 ★제대로 돌아온다 ⇒ ★★「저장 전 ✕」≠「다시 연 뒤 ✕」)
     ★★까닭 : ★옛 줄은 `st.tfW0 = ktf` 였다. ★`ktf` = ★«지금 tf 폭»인데,
       ★복원 뒤의 ★«지금»은 ★★저장된 ★box 폭(400)이다 — ★켜기 전 폭이 ★아니다.
       ★`tfW0` 가 ★★WeakMap 에만 살아서 ★다시 열면 ★비어 있는 것이 ★뿌리다.
     ★★방아쇠 : ★복원 뒤 ★`watchAllFx` → `ftMeasure` 가 ★이 줄을 ★돌린다.
       ⛔★261024 에 ★내가 `rebindAll` 에 더한 `watchAllFx` 한 줄이 ★그 경로를 ★★늘렸다(★복원·페이지전환·undo/redo).
       ★단 ★`effects-registry.js:136` 의 ★`load` 리스너가 ★원래도 불렀으므로
         ★「내 줄이 없었으면 손실이 없었다」는 ★★거짓이다 — ★늘어난 것은 ★★«경로의 수»다.
     ★★고침 : ★★«사용자가 패널로 정한 폭»의 ★정본을 ★먼저 읽는다 — ★`tf.dataset.width`.
       ★근거 : `js/props/prop-text-wireup-position.js:9` ★`applyW` 가 ★`style.width` 와 ★`dataset.width` 를
         ★★같이 쓴다. ★그리고 ★그 dataset 은 ★★저장본에 실려 ★복원 뒤에도 ★살아 있다(★실측 3/3: `"300"`).
       ⇒ ★★새 저장 키를 ★만들지 ★않았다(★저장 꼴을 ★안 바꾼다 ⇒ 골든·바이트 분모 무접촉).
     ★★`dataset.width` 가 ★없으면(= ★사용자가 폭을 ★한 번도 안 정했으면) ★★`'100%'` 로 ★둔다.
       ★근거(★실측 261024 · ★핀 판 5f845727) : ★갓 만든 tf 의 ★`style.width` 는 ★★`'100%'` 이고
         ★computed 는 ★796 이다. ★그 값의 ★정본 = `js/block-factory.js` `_makeTextFrame` 의
         `style.cssText = 'background:transparent;width:100%;box-sizing:border-box;'`.
       ⛔★`ktf` 로 ★두면 ★복원 뒤 ★그것이 ★★box 폭이라 ★★그 갈래도 ★손실이다(★실측: ★400px 로 굳었다).
       ⛔★`''` 로 ★두면 ★`width:100%` 가 ★사라져 ★★프레임 폭이 ★또 달라진다.
       ★★★이 `'100%'` 는 ★«손으로 박은 값»이다 ⇒ ★검사가 ★`_makeTextFrame` 의 ★cssText 에서
         ★그 값을 ★파싱해 ★대조한다(★갈리면 ★빨강). ★「★명부가 둘이면 ★재는 자를 걸어라」.
     ★★★⛔그런데 ★이 갈래는 ★★«근본 고침»이 ★아니다 :
       ★`tfW0` = ★«켜기 ★전» 폭인데 ★그것은 ★★어디에도 ★저장되지 ★않는다(★WeakMap 뿐).
       ⇒ ★사용자가 ★폭을 ★안 정한 판에서 ★「켜기 전 값」을 ★복원 뒤 ★★알 길이 ★없다 —
         ★`'100%'` 는 ★★«기본값 추정»이다. ★사용자가 ★패널 ★밖의 ★다른 길로 ★폭을 정했다면 ★틀린다.
       ★★근본 처방 = ★켤 때 ★`tfW0` 를 ★★데이터로 ★남기기(저장 꼴 변경) ⇒ ★★분모가 넓어 ★안 골랐다.
       ★이름 = `FT-TFW0-NOT-PERSISTED-01` (★★미해결 · ★0.9.9 후보)
     ★재는 자 : `tests/dom/ft-tfw0-restore-loss.dom.spec.js` (★행위 · 경로 넷 ＋ 변이) */
  if (st.tfW0 == null && tf) {
    const dsW = tf.dataset && tf.dataset.width;
    st.tfW0 = (dsW != null && dsW !== '' && Number.isFinite(parseFloat(dsW)))
      ? (parseFloat(dsW) + 'px')
      : '100%';   /* ★`_makeTextFrame` 의 기본 — ⛔`ktf`(복원 뒤 box 폭)도 `''` 도 아니다 */
  }

  tb.style.width = kw; tb.style.minHeight = kmh;
  ce.style.transform = kce;
  if (tf) tf.style.width = ktf;
  _tfState.set(tb, st);
  return st;
}

/** 「데이터 → 화면」 — ★키 없음 = ★아무것도 안 만진다(옛 문서 바이트 동일 · `NegA_pixel_same`).
 *  ★돌려주는 것: 그렸으면 true. */
export function applyFxFreeTransform(tb) {
  if (!tb || !tb.dataset || !tb.dataset.tfCorners) return false;
  const ce = _contentOf(tb);
  if (!ce) return false;
  const st = ftMeasure(tb, true);          /* ★글이·글꼴이 바뀌었을 수 있다 ⇒ 그릴 때 다시 잰다 */
  if (!st || !(st.W > 0) || !(st.H > 0)) return false;

  let C = ftCornersOf(tb);
  /* ★네 점이 바탕 네모면 ★새 W·H 로 다시 맞춘다(위 `_isBaseRect` 의 까닭) — ⛔찌그러진 것은 안 건드린다. */
  if (!C || (!st.touched && _isBaseRect(C))) {
    C = _baseRect(st.W, st.H);
    tb.dataset.tfCorners = _cornersToStr(C);
  }

  const { D, mnx } = normalizeCorners(C);  /* ★⒞ — 왼·위로 나간 것도 감싸게 0,0 으로 당긴다 */
  const h = homography(_baseRect(st.W, st.H), D);
  if (!h) return false;                    /* ★네 점이 한 줄·겹침 ⇒ 못 푼다 — ★그리지 않는다(가드가 산다) */

  ce.style.transform = cornerMatrix3d(h);
  ce.style.transformOrigin = st.OX + 'px ' + st.OY + 'px';   /* ★글자의 좌상단이 원점 — `NegB_origin` 이 잰다 */

  /* ★⒞ — 박스는 ★«항상» 글자를 감싼다(⛔`on` 분기가 없다 · 현빈 msg5416 확정).
     ⛔박스는 ★찌그러지지 않는다(직사각형 유지) — msg5406 「모양만 변형」과 양립한다(정정 ⑩ 의 두 축). */
  const box = boxFromCorners(D, st.W, st.H, st.OX, st.OY);
  tb.style.width = box.w + 'px';
  tb.style.minHeight = box.h + 'px';
  const tf = _tfOf(tb);
  if (tf) {
    /* ★t7-03(2026-10-26 S3 · 지디 처방 ⒝) — 폭이 «100% → px» 로 갈아타는 ★그 전이에서만 정렬을 같이 옮긴다.
       ★잰 값(실앱 ca702d40 · 배율 40%·100% 같음): 가운데 정렬 글상자에 켜기만 해도 글자중심 0.00 → −107.68(왼쪽) ·
         패널 정렬 단추 셋 다 꺼짐 — 세로 flex 안 «폭 박힌» 자식이 alignSelf 없이 왼쪽에 서기 때문이다.
       ⛔상태가 아니라 «전이»에 건다: 직전 인라인 폭이 '100%'·'' 일 때만. 복원 경로는 저장본 폭이 이미 px 라 전이가 없다
         ⇒ 옛 저장본을 안 건드린다(자가치유 금지와 양립 · tests/dom/t7-03-ft-align A4).
       ⛔tf.style.alignSelf 가 이미 있으면 손대지 않는다 — 패널·사용자가 임자다(A3).
       값 = 글자칸 textAlign 의 사상(ALIGN_SELF_OF 한 자리) · 왼쪽(빈 값)이면 안 쓴다(옛 바이트).
       box 식(boxFromCorners)은 그대로다 — 119 ㉡(FT-BOX-RESERVES-ALIGN-GUTTER-01)은 ftMeasure 의 OX 쪽에서 풀었다(글자칸 폭을 글자에 박음). */
    const prevW = tf.style.width;
    if ((prevW === '' || prevW === '100%') && !tf.style.alignSelf) {
      const as = ALIGN_SELF_OF[ce.style.textAlign];
      if (as && as !== 'flex-start') { tf.style.alignSelf = as; st.alignSetByFt = as; }
    }
    tf.style.width = box.w + 'px';   /* ★㉣ — 「너비 항상 동일」 */
  }
  /* ★FT-3b `FT-LEFT-DRAG-ANCHORS-AT-TB-LEFT-01` — 위 정규화가 왼쪽으로 나간 몫(mnx<0)을 0 으로 당겨,
     흐름 글상자에서 nw 를 왼쪽으로 끌면 손잡이는 제자리고 그림이 «오른쪽»으로 자랐다(미카사 261025 실측: 데이터 x −1998 · 손잡이 cx 573.8 고정).
     ⇒ 당긴 몫만큼 상자째 왼쪽으로 «그려서» 되돌린다 — CSS `translate`(레이아웃 무영향 · 손잡이 층도 같이 간다).
     ⛔정규화는 그대로 둔다(박스 하한·ft-maxwidth-cap·D_floor_keeps_base 가 그 자리를 잠근다).
     ⛔`margin-left` 로 하지 마라 — 글자 프레임의 margin-left 는 프레임 안 X 자리(prop-frame.js)라 겹친다.
     ★세로(mny)는 이 처방 밖이다 — 위로 나간 몫은 섹션이 아래로 자라 손잡이가 안 나간다(FT3-VERTICAL 실측) · 별건. */
  tb.style.translate = mnx < 0 ? `${mnx}px 0px` : '';
  /* ★U3 — 그린 뒤 손잡이를 ★그 자리로. ⛔import 하지 않는다(순환) — 이 파일이 이미 쓰는
     `window.pushHistory?.()`·`window.scheduleAutoSave?.()` 와 ★같은 관용구다. 없으면 아무 일도 안 난다. */
  window.ftHandlesSync?.(tb);
  return true;
}

/* ★★t7-05 「오버레이 모드 리사이즈 시 텍스트만 확대되고 아웃라인·격자는 변경되지 않는 오류」(2026-10-26 S3)
   ★잰 값(시트): 글꼴 36→118.7px · tf 124→409 인데 .tfh-edge 49.8×17.2 불변. ★S3 실측(d772f49e 하네스): 테두리 114×49.6 그대로 ·
     글자는 tb 폭(옛 box 폭)에 묶여 «글자마다 줄바꿈»(73×294) — 같은 뿌리다.
   ★뿌리: 오버레이 리사이즈(js/overlay-handles.js _onTextOverlayResizeMouseDown)는 폭·글자 크기만 k 배로 바꾸고,
     네 점(옛 글자 크기 단위)·재는 폭(tfMeasW)·그린 상자·손잡이는 아무도 다시 맞추지 않는다.
   ★처방: 시작 때 네 점과 재는 폭을 떠 두고(ftScaleBase) · 매 이동 «같은 k» 로 곱해 그리기 문 하나(applyFxFreeTransform —
     다시 재고 · 상자 · 손잡이·테두리·격자까지)를 부른다(ftScaleTo). ⛔매 프레임 «누적 곱» 금지 — 시작 값에 k 를 곱한다
     (overlay-handles.js 의 글자·아이콘 스냅샷과 같은 규약). box 식은 그대로(119 ㉡ 은 ftMeasure 의 OX 쪽). */
export function ftScaleBase(tb) {
  const C = ftCornersOf(tb);
  if (!C) return null;
  const st = _tfState.get(tb) || ftMeasure(tb);
  return { C, measW: st ? st.tfMeasW : null };
}
export function ftScaleTo(tb, base, k) {
  if (!tb || !base || !(k > 0) || !tb.dataset) return false;
  tb.dataset.tfCorners = _cornersToStr(base.C.map(([x, y]) => [x * k, y * k]));
  const st = _tfState.get(tb);
  /* 재는 폭이 px 이면 같이 곱한다 — 안 그러면 큰 글자를 옛 폭에서 재어 줄이 꺾이고 W·H 가 갈린다. '100%' 등은 그대로.
     ★«정수 px» 로 올린다 — 이 파일의 배율 자 `_scaleOf` 는 정수 offsetWidth 로 나눈다 ⇒ 소수 폭(실측 1492.29px)에서 재면
       배율이 0.4001 로 어긋나 W 가 0.115px 작게 잡히고, 그 폭에 박힌 상자 안에서 줄이 꺾였다(실앱 261026 · 216.8px 「짧은 글」 2줄). */
  if (st && typeof base.measW === 'string' && /px$/.test(base.measW)) st.tfMeasW = Math.ceil(parseFloat(base.measW) * k) + 'px';
  return applyFxFreeTransform(tb);
}

/** 우리가 걷어서 style 이 «빈 속성»만 남으면 속성째 지운다 — ✕ 뒤 outerHTML 이 켜기 전과 바이트 같게. */
function _dropEmptyStyle(el) { if (el && el.getAttribute && el.getAttribute('style') === '') el.removeAttribute('style'); }

/** 우리가 쓴 것 ★전부를 걷는다(✕) — ★글자 속성은 ★애초에 안 건드렸으므로 걷을 것이 없다.
 *  ⇒ `NoFreeze_fontsize`(「`tfCorners` 를 지우면 글자 크기가 바닥값으로 돌아온다」)가 그것을 잰다. */
function _strip(tb) {
  const ce = _contentOf(tb);
  const st = _tfState.get(tb);
  const tf = _tfOf(tb);
  if (ce) { ce.style.transform = ''; ce.style.transformOrigin = ''; ce.style.width = ''; _dropEmptyStyle(ce); }
  tb.style.width = ''; tb.style.minHeight = ''; tb.style.translate = '';
  if (tf) {
    tf.style.width = st && st.tfW0 != null ? st.tfW0 : '';
    /* ★t7-03 — 켤 때 «내가» 쓴 alignSelf 만 걷는다(그 뒤 패널·사용자가 바꿨으면 그대로) ⇒ ✕ 뒤 켜기 전 바이트. */
    if (st && st.alignSetByFt && tf.style.alignSelf === st.alignSetByFt) tf.style.alignSelf = '';
    _dropEmptyStyle(tf);
  }
  /* ★U3 — ✕ 면 손잡이·격자도 같이 걷는다(안 걷으면 ★효과를 끈 뒤에도 남는다). */
  window.ftHandlesClear?.(tb);
  _dropEmptyStyle(tb);
  _tfState.delete(tb);
}

/** ★바꾸는 문 «하나» — 패널·U3 핸들·시험이 이리로.
 *  @param {Element} tb `.text-block`
 *  @param {number[][]|null} C 네 점(`null` = ★키 전부 지움 = ✕)
 *  @param {{history?:boolean, touched?:boolean}} o `touched` = 사람이 모양을 바꿨다(⇒ 다시 맞추지 않는다)
 *  ★이력: 부르기 «전»에 pushHistory(push-before · 반사·그림자·글로우와 같은 규약) — 한 제스처 한 걸음. */
export function setFxFreeTransform(tb, C, { history = true, touched = true } = {}) {
  if (!tb || !tb.dataset || !tb.classList || !tb.classList.contains('text-block')) return { ok: false, code: 'NOT_FOUND' };
  if (history) window.pushHistory?.('효과');
  if (C === null) {
    FX_FT_KEYS.forEach(k => { delete tb.dataset[k]; });
    _strip(tb);
  } else {
    const st = ftMeasure(tb, !_tfState.has(tb));
    const next = Array.isArray(C) && C.length === 4 ? C : _baseRect(st ? st.W : 1, st ? st.H : 1);
    tb.dataset.tfCorners = _cornersToStr(next);
    /* ★★가르는 자는 ★`touched` ★하나다 — ⛔«꼴»로 가르지 마라.
       ★까닭(261023 ★내 무력화 대조가 잡았다): 여기서 `_isBaseRect(next)` 를 ★같이 보면
         ★★«축 정렬로 ★줄이기만 한» 네 점(= 사람이 `se` 를 ★똑바로 끈 꼴)이 ★바탕 네모로 읽혀
         ★다음 렌더가 ★항등으로 ★되돌린다 ⇒ ★★U3 에서 ★손잡이가 ★«튕기는» 것처럼 느껴진다.
       ⇒ ★꼴 판정(`_isBaseRect`)은 ★`watchAll`(로드)에만 쓴다 — ★거기엔 런타임 깃발이 ★없다. */
    if (st) { st.touched = !!touched; _tfState.set(tb, st); }
    /* ★★`touched` 를 ★★데이터로 남긴다 — ★그 사실이 ★저장본에 실려야 ★복원 뒤에도 ★산다.
       ⛔`touched: false`(패널이 ★켜기만 한 꼴)면 ★키를 ★지운다 — ★「변형 안 함」이 ★참이다. */
    if (touched) tb.dataset.tfTouched = '1'; else delete tb.dataset.tfTouched;
    /* ★★`tfSchema` 는 ★`touched` 와 ★무관하게 ★★항상 쓴다 — ★그것이 ★«어느 판이 저장했나»다.
       ⛔`touched` 와 ★묶지 마라 : ★「변형 안 하고 켜기만 한」 새 블록도 ★★새 판이 저장한 것이다. */
    tb.dataset.tfSchema = '1';
    applyFxFreeTransform(tb);
  }
  window.scheduleAutoSave?.();
  return { ok: true, corners: ftCornersOf(tb) };
}

/** 「원래대로」 — ★항등 네 점으로(⛔효과를 끄는 것이 아니다 · ⒞ 는 「계속 감쌈」이라 박스는 글자를 감싼 채다). */
export function resetFxFreeTransform(tb, { history = true } = {}) {
  const st = ftMeasure(tb, true);
  if (!st) return { ok: false, code: 'NOT_FOUND' };
  return setFxFreeTransform(tb, _baseRect(st.W, st.H), { history, touched: false });
}

/** 문서를 연 뒤·붙여넣은 뒤 — ★걸린 블럭을 ★다시 그린다(멱등). 돌려주는 수 = 다시 그린 블럭 수.
 *  ★명부(js/effects-registry.js watchAllFx)가 ★이 함수를 부른다 — ⛔제 load 리스너를 ★따로 달지 마라
 *    (js/effects-particles.js:158 이 그 ⛔를 적어 뒀다).
 *  ★★우리는 ★«다시 그려야 하는» 효과다 — `W H OX OY` 가 WeakMap 에 살아 ★로드 뒤엔 ★없다
 *    ⇒ 명부 머리말(js/effects-registry.js:22) 「「데이터 → 화면」을 로드 때 «다시 그려야 하는» 효과는
 *      그 일도 여기서 한다」가 ★우리 갈래다. 잠그는 자 = `J_roundtrip`. */
export function watchAllFxFreeTransform(root = document) {
  if (!root || !root.querySelectorAll) return 0;
  const els = root.querySelectorAll('.text-block[data-tf-corners]');
  let n = 0;
  els.forEach((tb) => {
    /* ★로드된 네 점이 ★바탕 네모가 ★아니면 ★사람이 찌그러뜨린 것이다 ⇒ 다시 맞추지 않는다. */
    const st = ftMeasure(tb, true);
    /* ★★★`tfTouched` 가 ★있으면 ★그것을 ★믿는다(★사람이 끈 사실) — ★꼴로 ★다시 ★추측하지 ★않는다.
       ⛔키가 ★없으면(★옛 파일) ★★옛 꼴 판정을 ★그대로 쓴다 ⇒ ★옛 동작·옛 파일 ★무해.
       ★그 갈래에서는 `FT-AXIS-ALIGNED-TRANSFORM-LOST-ON-RESTORE-01` 이 ★★여전히 난다 —
         ★★「옛 파일은 ★안 고쳐진다」가 ★참이고, ★그것을 ★★숨기지 ★않는다. */
    if (st) {
      /* ★★★판을 ★먼저 ★가른다(261025) — ★`tfSchema` 가 ★없으면 ★★«옛 파일»이다.
         ⇒ ★보수적 `true` ⇒ ★네 점을 ★★안 덮어쓴다 ⇒ ★축정렬 변형이 ★산다.
         ⛔옛 꼴 판정(`_isBaseRect`)으로 ★떨어뜨리면 ★★★영구 손실이 난다(★미카사 실측).
         ★★`tfSchema` 가 ★있으면 ★`tfTouched` 를 ★믿는다 — ★없으면 ★진짜 ★「안 끌었다」다. */
      if (tb.dataset.tfSchema === '1') {
        st.touched = (tb.dataset.tfTouched === '1');
      } else if (st.legacyTouched === undefined) {
        st.legacyTouched = !_isBaseRectOfLegacy(ftCornersOf(tb), st.W, st.H);
        st.touched = st.legacyTouched;
      } else {
        st.touched = st.legacyTouched;
      }
      _tfState.set(tb, st);
    }
    if (applyFxFreeTransform(tb)) n++;
  });
  /* ★★U3 — ★문서를 ★연 ★직후에도 ★손잡이가 ★떠야 ★한다.
     ★★까닭(실측 261024 · ★현빈 신고) : ★`clearSelectionMarks` 의 ★«한 틱 뒤 동기화»는
       ★★«고르거나 ★놓을 때»만 ★돈다 ⇒ ★★★문서를 ★열자마자는 ★그 함수가 ★안 ★불려
       ★★선택이 ★복원돼 ★있어도 ★손잡이가 ★★안 ★붙었다(★실측: ★selected 1 인데 ★grid 0 · handle 0).
     ⇒ ★★여기가 ★그 자리다 — ★명부(watchAllFx)가 ★로드 뒤 ★이 함수를 ★부른다.

     ★★★2026-10-24 ★후속 측정 — ★★이 줄은 ★★«중복»이다. ★이름 = `FT-SYNCALL-IN-WATCHALL-DUPLICATE-01`
       (★앞 이름 `FT-SYNCALL-IN-WATCHALL-UNMEASURED-01` 은 ★이 측정으로 ★닫는다)
     ⒜ ★소스 : ★위 `els` 와 `ftHandlesSyncAll` 이 ★★«같은 선택자»(`.text-block[data-tf-corners]`)·
        ★★«같은 root»·★★«같은 함수»(`ftHandlesSync`)를 쓴다. ★위 고리가 블록마다
        `applyFxFreeTransform` → ★그 끝(:221)에서 ★이미 `ftHandlesSync(tb)` 를 ★부른다.
     ⒝ ★행위 : ★`applyFxFreeTransform` 이 ★:221 ★앞에서 ★빠지는 ★길 넷을 ★판으로 만들어 쟀다 —
        ★`zeroWH`(측정 W·H 가 0) ★`collinear`(네 점이 한 줄) 둘 다 ★`applied=false` 인데
        ★그 뒤 ★`ftHandlesSync` 도 ★★`0` 을 돌려주고 ★손잡이를 ★★못 그린다 ⇒ ★★구해주는 길이 ★없다.
        ★`gain`(ftHandlesSync 가 더 그린 수) = ★★네 판 ★전부 ★0.
     ★★`noCE` 판도 ★★261024 에 ★닫았다 — ★처음엔 ★내 변조가 ★실패해 `applied=true` 가 나왔다.
        ★까닭 : ★`_contentOf`(:75)가 ★`[contenteditable]` 이 ★없으면 ★★`.tb-h1,…,.itb-text` 로 ★★폴백한다
          ⇒ ★속성만 ★지워서는 ★`ce` 가 ★살아 있었다. ★폴백 명부의 ★class 까지 ★떼어야 ★∅ 가 된다.
        ★다시 잰 값 : `ceFound=false` · `applied=false` · `syncRet=★0` · ★`gain=★0`
        ⇒ ★★early return ★넷 ★전부 ★`gain 0` ⇒ ★★중복 판정이 ★네 판에서 ★섰다.
     ⛔★단 ★「`ce` 가 ∅ 인 ★글상자가 ★★앱 경로에서 ★생기나」는 ★★★안 쟀다 — ★인공 장면이다.
     ⒞ ★★그런데도 ★줄을 ★★둔다 : ★지워도 ★동작은 ★같지만 ★★어떤 검사도 ★이 줄을 ★안 잠그므로
        ★지웠을 때 ★깨지면 ★아무도 ★모른다. ★두 번째 패스의 ★값은 ★미미하다.
     ⇒ ★★대신 ★★«두 집합이 ★갈리면 ★빨개지는 자»를 ★세웠다 :
        `tests/unit/ft-syncall-is-duplicate.test.mjs` — ★누가 ★한쪽 선택자를 ★넓히면 ★거기서 ★빨강이고
        ★그때 ★「중복인가」를 ★다시 ★판정하게 ★된다. ⛔주석으로는 ★못 막는다(★재는 자가 있어야 집행된다). */
  window.ftHandlesSyncAll?.(root);
  return n;
}

/* ═══ 카드 — 반사·그림자·글로우 카드와 ★같은 꼴(.prop-cell-card · ✕ · 접기) ═══════════════
   ⛔★숫자 칸을 ★만들지 마라 — 현빈 「★값 입력이 아니라 ★핸들 움직여서」(발주 ③⒞).
     ⇒ 글로우 카드를 ★통째로 베끼면 ★slider 세 줄이 따라와 ★그 ⛔를 어긴다(설계 ⑤-ⓕ).
     잠그는 자 = `NoNumberField`(우리 카드에 `input[type=range|number]` ★0개)
              ＋ `NoNumberField_neg`(★이웃 글로우 카드에는 ★있다 — 자가 ★죽지 않았다는 증거).
   ★「원래대로」 단추 꼴 = 이 레포의 선례 `.prop-btn-full`(js/props/prop-comparison.js:118 `cmp-img-pos-reset`).
   ⛔눈(on/off)을 두지 않았다 — 키가 ★하나라 「값 보존 · 그리지 않음」 상태가 ★없다(발주 밖). */
function _ftCardHtml(tb, P) {
  const open = fxIsCardOpen(tb, 'freetransform');
  return `
      <div class="prop-cell-card${open ? ' expanded' : ''}" id="${P}-fxft-card" data-fx-type="freetransform">
        <div class="prop-cell-card-header" id="${P}-fxft-head">
          <span class="prop-cell-card-title" style="flex:1;">자유변형</span>
          <button class="prop-icon-btn" id="${P}-fxft-del" title="효과 삭제" aria-label="효과 삭제">×</button>
        </div>
        <div class="prop-cell-card-body" id="${P}-fxft-body"${open ? '' : ' hidden'}>
          <button class="prop-btn-full" id="${P}-fxft-reset" title="네 모서리를 처음(변형 없음)으로">원래대로</button>
          <button class="prop-btn-full" id="${P}-fxft-pullin" title="섹션 밖으로 나가 안 보이는 모서리만 섹션 안 가장자리로 데려온다(나머지는 그대로)" style="margin-top:4px;">밖 모서리 데려오기</button>
        </div>
      </div>`;
}

function _wireFtCard(tb, P, again) {
  const $ = (id) => document.getElementById(`${P}-${id}`);
  $('fxft-del')?.addEventListener('click', (e) => { e.stopPropagation(); setFxFreeTransform(tb, null); again(); });
  $('fxft-reset')?.addEventListener('click', (e) => { e.stopPropagation(); resetFxFreeTransform(tb); again(); });
  /* ★FT-3a — 섹션 밖으로 나가 잘린 손잡이 «되찾기». 몸통은 effects-ft-handles.js(손잡이 자리를 아는 쪽) · window 다리(순환 import 회피 · 이 파일의 관용구). */
  $('fxft-pullin')?.addEventListener('click', (e) => {
    e.stopPropagation();
    const n = window.ftPullCornersIntoSection?.(tb) || 0;
    window.showToast?.(n ? `모서리 ${n}개를 섹션 안으로 데려왔습니다 — ⌘Z 로 되돌릴 수 있습니다` : '섹션 밖으로 나간 모서리가 없습니다');
  });
  /* ★U3 — ★이 함수가 ★«고른 순간»에 돈다(명부가 패널을 다시 그릴 때 배선한다)
     ⇒ ★여기서 ★전수 동기화하면 ★고른 블럭엔 붙고 ★놓인 블럭에선 걷힌다(`_shouldShow` 가 가른다). */
  window.ftHandlesSyncAll?.(document);
  $('fxft-head')?.addEventListener('click', () => {
    const b = $('fxft-body'); if (!b) return;
    const open = b.hidden; b.hidden = !open;
    fxSetCardOpen(tb, 'freetransform', open);
    $('fxft-card')?.classList.toggle('expanded', open);
  });
}

/* ═══ 명부 식구 ⑤ — 자유변형 ════════════════════════════════════════════════
   ★이 한 벌이 전부다 — 목록·＋·접힘·배선은 ★명부가 한다(패널 파일 ★0줄 변경). */
registerFxType({
  key: 'freetransform',
  label: '자유변형',
  /* ★텍스트만 — ⛔허용 목록으로 적는다(막는 목록은 블럭이 늘면 샌다 · js/effects-glow.js:207 과 같은 결).
     곡선(liner)·말풍선은 글자칸 구조가 달라 뺀다.
     잠그는 자 = `Registry_mirror`(도형·에셋·프레임엔 ★안 뜬다). */
  supports: (el) => !!(el && el.classList && el.classList.contains('text-block')
    && !el.classList.contains('liner-block') && !el.classList.contains('speech-bubble-block') && _contentOf(el)),
  has: (el) => !!(el && el.dataset && el.dataset.tfCorners),
  /* ★고른 순간 = ★항등 네 점(보이는 변화 0). ★U2 에는 핸들이 없으므로 네 점은
     `window.setFxFreeTransform(tb, C)` 로 ★프로그램이 넣는다 — ★U3 가 그 자리에 핸들을 붙인다. */
  add: (el) => resetFxFreeTransform(el),
  card: _ftCardHtml,
  wire: _wireFtCard,
  watchAll: watchAllFxFreeTransform,
});

if (typeof window !== 'undefined') {
  Object.assign(window, {
    ftCornersOf, ftStateOf, ftMeasure,
    applyFxFreeTransform, setFxFreeTransform, resetFxFreeTransform, watchAllFxFreeTransform,
    ftScaleBase, ftScaleTo,
    FX_FT_KEYS,
  });
}
