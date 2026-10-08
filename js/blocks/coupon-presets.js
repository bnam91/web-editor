/* ═══════════════════════════════════════════════════════════════════════════
   coupon-presets.js — 쿠폰 프리셋의 ★명부 ＋ ★축 어휘 ＋ ★칩 그리개 (2026-10-08 · 현빈 발주 · 지디 GO)

   ★★★정본은 ★«시안»이다 — ⛔요약을 참값으로 쓰지 마라
     `/Users/a1/.claude/skills/지디/dashboard/artifacts/goditor-coupon-block.html`
     (117,873B · 1,905줄 · mtime 2026-10-07 01:03)
     ★값의 출처 = 그 파일 `:1155~1232 PRESETS` · `:1126 slot()` · `:1130 baseState()`
     ⇒ ★이 파일의 수·글자는 ★거기서 ★떠 온 것이다. ⛔내가 지어낸 값이 ★하나도 없다.

   ★★프리셋은 ★★«다섯»이다 — ⛔「7종」이 아니다(2026-10-08 정정 · P·E·G 셋이 독립 확정)
     ★시안은 ★여섯(⑥ naverpay 포함)이고, ★제품은 ★★다섯이다.
     ⇒ ⑥ `naverpay` 는 ★★2차다 — ★badge 9축(`badgeOn`·`badgeTxt`·`badgeShape`·`badgePos`·
       `badgeR`·`badgeN`·`badgeCol`·`badgeTxtCol`·`badgeSize`)과 ★logo 5축이 ★제품에 ★없다.
       ★★그중 `badgeOn` 은 ★「없다」보다 ★나쁘다 — `coupon-block.js` `_cpnState` 가 ★그 칸을
       ★★dataset 에서 ★«아예 안 읽고» ★`false` 리터럴로 ★덮는다. ⇒ ★칩을 눌러도 ★★조용히 ★무시된다.
       ★그 자리를 ★이름으로 잠그는 자 = `tests/dom/coupon-presets.dom.spec.js` ★C-P7.
     ★이 파일 안에 ★⑥ 을 ★적지 않았다 — ★★적으면 ★C-P9 가 ★빨개지는 것이 ★맞지만,
       ★「명부에 있는데 ★안 먹는다」는 ★★가장 나쁜 꼴이다(★칩이 ★뜨고 ★눌리는데 ★아무 일도 안 난다).

   ★★⛔시안에서 ★«일부러 뺀» 축 — ★★「시안대로」가 ★아니라 ★★«제품 결정»이 ★이긴다
     ⑴ ★`canvasCol` — ★시안은 ★`#F4F4F2`(캔버스 바탕을 ★보이게 하려고).
        ★제품은 ★★`transparent` ★고정이다(`coupon-block.js:95` · `coupon-geometry.js` 머리말:
        ★「앱에서는 ★블럭이 ★곧 쿠폰이다」). ⇒ ★★프리셋이 ★그 칸을 ★건드리면 ★계약 위반이다.
        ★같은 꼴의 선례 = `prop-section-particles.js` 「⛔시안의 ★「배경」 색 줄은 ★안 만든다」.
     ⑵ ★`it`(기울임) · `at`(글자 닻) — ★제품 슬롯 축에 ★★없다(`COUPON_SLOTS` 는 ★다섯 칸 ×
        on/size/weight/color/text ★다섯 축뿐이다). ⛔없는 축에 값을 ★쓰지 않는다.
     ⑶ ★`narrow`(좁아짐 세 꼴) · ★`logo` · ★`badge*` · ★`deco*` — ★제품 미지원.
        ⚠️★`narrow` 는 `_cpnState` 가 ★읽는 축에 ★아예 없어 ★★흔적 없이 사라진다 ⇒ ★안 적는다.
     ⑷ ★`width`(화면 폭) — ★시안엔 ★그 개념이 ★없다(시안은 ★모델 크기 하나다).
        ★제품의 `width` 는 ★★«사용자가 손잡이로 끈 폭»이라 ★★프리셋이 ★안 건드린다.
        ⇒ ★프리셋을 골라도 ★사용자가 맞춘 ★폭은 ★그대로 남고, ★비율(cw/ch)만 따라온다.

   ★★«적지 않은 축은 ★기본값으로 ★되돌린다» — ★시안 `:1234 applyPreset` 과 ★같은 규율
     시안: `var base=baseState(); for(k in v) base[k]=v[k];` ⇒ ★★먼저 ★전부 리셋, ★그 뒤 덮기.
     ⇒ ★그래서 ★이 명부엔 ★★«시안이 적은 축만» 있다. ★기본과 같은 값을 ★또 적지 않는다.
       (적으면 ★둘째 명부가 된다 — ★기본값이 바뀌어도 ★여기가 ★안 따라온다.)
     ⇒ ★리셋을 ★하는 자 = `coupon-block.js applyCouponPreset`(★그 함수가 ★`COUPON_DEFAULTS` 와
       ★`COUPON_SLOTS` ★둘을 ★돌며 ★먼저 되돌린다). ⛔여기서 ★기본값을 ★다시 적지 마라.

   ★★`COUPON_ENUMS` 가 ★★«허용값 명부 ★한 자리»다
     ⛔전엔 ★`_cpnState` 안에 ★리터럴 배열 ★일곱 벌이 ★박혀 있었다(`['none','lr','tb','two']` 등).
       ⇒ ★프리셋 명부가 ★그 목록을 ★벗어나면 ★★«조용히 ★기본값으로 ★떨어진다» — ★칩을 눌렀는데
         ★★아무 일도 안 난 것처럼 보이고, ★★dataset 에는 ★쓰레기가 ★그대로 남아 ★저장본과 화면이 ★갈린다.
     ⇒ ★★이제 ★`_cpnState` 와 ★이 명부와 ★검사(C-P9)가 ★★«같은 표»를 읽는다.
       ★그 합침을 ★재는 자 = `tests/unit/coupon-presets.test.mjs` ★C-P6
         (★「공용 본문 무력화 → ★소비자 수만큼 빨강」 꼴).

   ★★이 파일은 ★`escHtml` ★하나만 import 한다 — ★★그래서 ★unit 하네스가 ★싣을 수 있다
     ⛔`coupon-block.js`·`prop-coupon.js` 를 ★import 하지 마라:
       ★`prop-coupon.js` → `../globals.js:4` 가 ★모듈 최상위에서 `document.querySelector` 를 부른다
       ★`coupon-block.js` → `../drag-drop.js` 가 ★문서를 요구한다
       ⇒ ★★둘 중 하나라도 물면 ★이 파일은 ★★node 에서 ★못 실린다 = ★unit 양성대조가 ★죽는다.
     ★선례 = `js/props/prop-section-particles.js:61`(★그 파일도 ★`_helpers.js` ★하나뿐이다).
   ★★글자 이스케이프는 ★정본 하나다 — ⛔사본 금지(★게이트 `tests/unit/name-axes-to-markup` ★X9).
   ═══════════════════════════════════════════════════════════════════════════ */
import { escHtml } from '../props/_helpers.js';

/* ★★허용값 ★명부 ★한 자리 — ★`_cpnState` 가 ★이것을 ★읽는다(⛔거기에 리터럴을 ★되살리지 마라).
   ★값의 출처 = ★그 함수가 ★전에 들고 있던 ★그 리터럴 ★일곱 벌 그대로다(★뜻을 ★안 바꿨다).
   ⚠️`perfDir` 은 ★전에 `=== 'h' ? 'h' : 'v'` ★꼴이었다 — ★목록으로 바꿔도 ★★행동이 ★같다
     (★'h' 면 'h' · ★그 밖은 ★기본 'v'). ★그 ★동치를 ★C-P6 이 ★단언한다. */
export const COUPON_ENUMS = Object.freeze({
  bgKind:  Object.freeze(['coupon', 'plain', 'grad']),
  split:   Object.freeze(['none', 'lr', 'tb', 'two']),
  shadow:  Object.freeze(['none', 'layer', 'drop']),
  align:   Object.freeze(['left', 'center', 'right']),
  valign:  Object.freeze(['top', 'center', 'bottom']),
  order:   Object.freeze(['t-n-b', 't-b-n', 'n-t-b']),
  perfDir: Object.freeze(['v', 'h']),
});

/* ★슬롯 ★한 칸의 ★꼴 — ★시안 `slot(txt,size,w,it,col,on,at)` 에서 ★제품 축 ★다섯만 남겼다.
   ★`on` 은 ★시안 여섯째 인자다(★`on!==false` ⇒ ★안 주면 ★참). */
const sl = (text, size, weight, color, on = true) => Object.freeze({ text, size, weight, color, on });

/* ★★프리셋 ★다섯 — ★★시안 `:1156~1215` 그대로. ★label 도 ★시안 글자 ★그대로다.
   ★★label 의 ★정본은 ★여기다(★`effects-registry.js:14` 「★label — ★★식구 쪽에서 준다」).
     ⇒ ⛔패널에 ★글을 ★지어 박지 마라. ★칩 그리개는 ★`|| key` ★폴백만 갖는다. */
export const CPN_PRESETS = Object.freeze({
  /* ① 시안 :1156 — 세로 절취선 ＋ 노란 본체. ★순서가 `t-b-n`(윗줄→아랫줄→숫자)인 ★유일한 칸이다. */
  leisure: Object.freeze({
    label: '① 점선 · 세로',
    v: Object.freeze({
      cw: 470, ch: 264, radius: 10, nR: 13, nPos: 50,
      perfOn: true, perfDir: 'v', perfPos: 80, perfDash: 4, perfGap: 5, perfW: 2, perfCol: '#8A6D00', perfEnd: true,
      split: 'none', bodyCol: '#FFD400', shadow: 'none',
      align: 'left', valign: 'center', order: 't-b-n', inlineUnit: true, pad: 22, gapY: 3,
    }),
    slots: Object.freeze({
      top:  sl('GODITOR', 27, 800, '#1A1A1A'),
      num:  sl('5', 34, 800, '#1A1A1A'),
      unit: sl('만원', 19, 700, '#1A1A1A'),
      bot:  sl('최대할인금액', 14, 500, '#4A3C06'),
      stub: sl('↓', 24, 700, '#1A1A1A'),
    }),
  }),

  /* ② 시안 :1168 — 조각 둘(`split:'two'`). ★순서가 `n-t-b`(숫자→윗줄)인 ★유일한 칸이다. */
  jetix: Object.freeze({
    label: '② 조각 둘',
    v: Object.freeze({
      cw: 300, ch: 169, radius: 16, nR: 14, nPos: 50,
      perfOn: false, split: 'two', stubPct: 78, gap: 6,
      bodyCol: '#F26A1B', stubCol: '#F26A1B', shadow: 'none',
      align: 'center', valign: 'center', order: 'n-t-b', inlineUnit: true, pad: 14, gapY: 8,
    }),
    slots: Object.freeze({
      top:  sl('GODITOR EXCLUSIVE', 11, 700, '#FFE6D2'),
      num:  sl('25', 82, 800, '#FFFFFF'),
      unit: sl('%', 28, 700, '#FFFFFF'),
      bot:  sl('DISCOUNT COUPON', 12, 700, '#FFFFFF'),
      stub: sl('', 16, 700, '#FFFFFF', false),
    }),
  }),

  /* ③ 시안 :1180 — 좌우 홈 ＋ 겹친 그림자(`shadow:'layer'`). */
  coupon32: Object.freeze({
    label: '③ 겹친 그림자',
    v: Object.freeze({
      cw: 430, ch: 242, radius: 16, nLeft: true, nRight: true, nR: 17, nPos: 50,
      perfOn: false, split: 'none', bodyCol: '#F97316',
      shadow: 'layer', shDx: 11, shDy: 11, shCol: '#C2410C', shOpa: 100,
      align: 'center', valign: 'center', order: 't-n-b', inlineUnit: true, pad: 16, gapY: 2,
    }),
    slots: Object.freeze({
      top:  sl('COUPON', 15, 700, '#FFF0E2'),
      num:  sl('32', 58, 800, '#FFFFFF'),
      unit: sl('%', 34, 800, '#FFFFFF'),
      bot:  sl('', 13, 500, '#FFFFFF', false),
      stub: sl('', 16, 700, '#FFFFFF', false),
    }),
  }),

  /* ④ 시안 :1193 — 오른쪽 홈 하나 ＋ 연녹색. ★숫자·단위가 ★꺼진 채 오는 ★유일한 칸이다. */
  npay: Object.freeze({
    label: '④ 작은 가로',
    v: Object.freeze({
      cw: 290, ch: 163, radius: 10, nRight: true, nR: 11, nPos: 50,
      perfOn: false, split: 'none', bodyCol: '#DCF2C4', shadow: 'none',
      align: 'center', valign: 'center', order: 't-n-b', inlineUnit: true, pad: 12, gapY: 2,
    }),
    slots: Object.freeze({
      top:  sl('GODITOR', 21, 700, '#1E7A3C'),
      num:  sl('', 40, 800, '#1E7A3C', false),
      unit: sl('', 16, 700, '#1E7A3C', false),
      bot:  sl('', 12, 500, '#1E7A3C', false),
      stub: sl('', 16, 700, '#1E7A3C', false),
    }),
  }),

  /* ⑤ 시안 :1205 — 위아래 분할(`split:'tb'`) ＋ 검정 머리. ★스텁이 ★켜져 오는 ★유일한 칸 둘 중 하나다. */
  sake: Object.freeze({
    label: '⑤ 검정 머리',
    v: Object.freeze({
      cw: 300, ch: 169, radius: 16, nLeft: true, nRight: true, nR: 14, nPos: 62,
      perfOn: false, split: 'tb', stubPct: 30,
      bodyCol: '#F3E9D6', stubCol: '#15151A', shadow: 'none',
      align: 'center', valign: 'center', order: 't-n-b', inlineUnit: true, pad: 14, gapY: 2,
      stubVert: false,
    }),
    slots: Object.freeze({
      top:  sl('UP TO', 14, 700, '#15151A'),
      num:  sl('25', 62, 800, '#15151A'),
      unit: sl('% OFF', 20, 700, '#15151A'),
      bot:  sl('', 12, 500, '#15151A', false),
      stub: sl('GODITOR', 17, 700, '#F3E9D6'),
    }),
  }),
});

export const CPN_PRESET_KEYS = Object.freeze(Object.keys(CPN_PRESETS));

/** ★지금 쓰는 명부 — ★창에 얹힌 것이 ★있으면 ★그것을 쓴다.
 *  ★★이 한 줄이 ★«출처를 갈아 끼우는» 양성대조를 ★가능하게 한다(★선례 `prop-section-particles.js:101 _fx`).
 *  ⛔검사 편의가 ★아니다 — ★「명부가 ★하나인가」를 ★행위로 ★물을 수 있는 ★유일한 길이다. */
const _roster = () => (typeof window !== 'undefined' && window.CouponPresets) || CPN_PRESETS;

/** ★이 블럭에 ★지금 걸린 프리셋 키. ★명부에 없는 값·빈 값은 ★`''`(= ★아무 칩도 활성 아님).
 *  ⛔`makeCouponBlock` 은 ★이 칸을 ★안 박는다 — ★새 쿠폰은 ★★«프리셋 없음»으로 난다.
 *    (★`COUPON_DEFAULTS` 가 ★다섯 중 ★어느 것과도 ★같지 않다 ⇒ ★하나를 적으면 ★그것이 ★거짓말이 된다.
 *     ★시안은 `baseState().preset:'leisure'` 라 적어 뒀는데, ★그 값들은 ★leisure 가 ★아니다.) */
export function couponPresetOf(block) {
  const k = block?.dataset?.preset;
  return (typeof k === 'string' && Object.prototype.hasOwnProperty.call(_roster(), k)) ? k : '';
}

/** ★★프리셋 칩 ★묶음 ★하나 — ★HTML 문자열을 ★돌려주는 ★순수 함수.
 *  ★선례 = `js/props/prop-sticker-glow.js:11 glowSectionHTML` · `:22 title="${KIND_LABEL[k] || k}"`.
 *  ★★명부가 ★늘면 ★칩이 ★★«저절로» 생긴다 — ⛔수·이름·글을 ★여기에 적지 않는다.
 *    ★그것을 잠그는 자 = `tests/unit/coupon-presets` ★C-P2(★가짜 키를 더한 판에서 ★칩이 하나 늘나).
 *  ★꼴 — ⛔새 UI 언어 ★0. `.prop-align-group` ＋ `.prop-align-btn.active`
 *    (★선례 `prop-sticker-glow.js:24` · ★파티클 `prop-section-particles.js:256`).
 *  ⚠️★칩을 ★한 줄에 ★둘씩 두지 ★않았다 — ★패널 줄 폭 211 에서 ★글자가 ★눌려 ★두 줄로 쪼개진다
 *    (★지디 실앱 QA 2026-10-07 · `tests/dom/coupon-block` ★C-PANEL5 가 ★그 자로 잰다).
 *    ⇒ ★`flex:1 0 100%` ★한 줄에 ★하나. ★글자를 ★줄임표로 ★가리지 ★않는다(★가리면 ★검사가 ★못 읽는다). */
export function couponPresetChipsHTML(block) {
  const R = _roster();
  const keys = Object.keys(R);
  if (!keys.length) return '';
  const cur = couponPresetOf(block);
  const chips = keys.map((k) => {
    const label = (R[k] && R[k].label) || k;   /* ★폴백 — ★label 없는 키가 와도 ★조용히 안 죽는다 */
    const on = (k === cur);
    return `<button class="prop-align-btn${on ? ' active' : ''}" data-cpn-preset="${escHtml(k)}"
                    style="flex:1 0 100%;text-align:left;padding:0 8px" title="${escHtml(label)}"
                    aria-pressed="${on}">${escHtml(label)}</button>`;
  }).join('');
  return `
      <div class="prop-row" style="align-items:flex-start">
        <span class="prop-label" style="line-height:24px">프리셋</span>
        <div class="prop-align-group" id="cpn-presets" role="group" aria-label="쿠폰 프리셋">${chips}
        </div>
      </div>
      <div class="prop-hint" style="padding:2px 8px;line-height:1.5">프리셋을 고르면 ${
        keys.length}가지 꼴 중 하나로 바뀝니다 — <b>폭은 그대로</b> 두고 비율·색·글자만 따라옵니다.</div>`;
}

/* ★창 다리 — ★`prop-coupon.js` 는 ★import 로 쓰고, ★다른 자리는 ★이 이름으로 부른다. */
if (typeof window !== 'undefined') {
  window.CouponPresets = CPN_PRESETS;
  window.CPN_PRESET_KEYS = CPN_PRESET_KEYS;
  window.COUPON_ENUMS = COUPON_ENUMS;
  window.couponPresetChipsHTML = couponPresetChipsHTML;
  window.couponPresetOf = couponPresetOf;
}
