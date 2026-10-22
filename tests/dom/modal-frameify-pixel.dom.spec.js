/* modal-frameify-pixel — M1 「프레임화 하기」 픽셀 동일 골든 (2026-10-04, M1 레인 · 설계 §1-3)
 * ★「사람이 보는 것」으로 잰다 — dataset 이 아니라 화면 픽셀(modal-variant.dom.spec 머리말의 교훈).
 *   한 칸 = 섹션 하나에 모달 → 선택·hover 걷기 → 섹션 rect 스샷 A → 프레임화 → 같은 clip 스샷 B → 다른 픽셀 «0» 이어야.
 *   + 수치: 그릇 rect · 글자 칸마다 Range.getClientRects() 줄 상자 · 아이콘 rect — 0.01px 단위로 같아야.
 * 행렬 = 형태 4 × 설정 14 × 자리 3(섹션 / 스택 프레임 안 / 그리드 밑) × 배율 2(100% · 40%) — 테스트 하나 = (형태·자리·배율), 안에서 설정 14 를 돈다.
 * ★비교기 자체의 양성대조 V1 = 맨 끝 시험(픽셀 하나 바꾼 PNG 를 «1» 로 세는가).
 * (PNG 내보내기 E2 는 이 파일에 없다 — 하네스에서 못 잰다(electronAPI 가짜 → captureSectionCdp null) · 실앱에서 쟀다: $S/reports/M1-BUILD.md)
 * ⛔앱 무접촉 — bootApp. */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const LONG = '오후 2시 이전 주문은 당일 출고되며 주말과 공휴일 주문은 다음 영업일에 순차적으로 출고됩니다. 제주·도서산간 지역은 추가 배송비가 붙을 수 있습니다.';
const CFGS = [
  ['기본', {}],
  ['타이포', { fontFamily: 'Georgia, serif', fontWeight: '500', lineHeight: 1.4, letterSpacing: 2 }],
  ['꾸밈', { italic: true, strike: true, highlight: true }],
  ['색', { textColor: 'var(--color-brand, #c0392b)', bg: 'rgba(20, 120, 200, 0.15)' }],
  ['테두리', { borderW: 3, borderStyle: 'dotted', borderColor: '#336699' }],
  ['모서리', { radius: 24, bg: '#eef4ff' }],
  ['그림자soft', { dropShadow: 'soft', bg: '#ffffff' }],
  ['그림자strong', { dropShadow: 'strong', bg: '#ffffff' }],
  ['폭고정', { wMode: 'fixed', width: 420, align: 'center' }],
  ['높이center', { hMode: 'fixed', height: 300, vAlign: 'center' }],
  ['높이bottom', { hMode: 'fixed', height: 300, vAlign: 'bottom', align: 'right' }],
  ['빈칸', { title: '', text: '' }],
  ['작은글', { fontSize: 12, padY: 4, padX: 6, title: '작', text: '작은 글' }],   // 내용 < 60px — 프레임 CSS min-height:60 을 눌렀는지(V4)
  ['긴글', { text: `첫 줄\n둘째 줄 ${LONG}`, title: `제목도 길게 ${LONG.slice(0, 40)}` }],
];
const VARIANTS = ['plain', 'titled', 'dashed', 'icon-stack'];
const PLACES = ['section', 'frame', 'grid'];
const ZOOMS = [100, 40];

const SEC = `<div class="section-block" id="sX" data-section="1" data-name="X"><div class="section-hitzone"></div><div class="section-inner" id="innerX" style="padding-left: 32px; padding-right: 32px;">
<div class="gap-block" data-type="gap" id="gTop" style="height:140px"></div><div id="slot"></div>
<div class="gap-block" data-type="gap" id="gEnd" style="height:200px"></div></div></div>`;

/** 자리별로 모달을 놓는다 — 돌려주는 것 없음. 이전 판은 섹션째 갈아끼운다. */
const place = (page, variant, cfg, where) => page.evaluate(([variant, cfg, where, SEC]) => {
  const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
  c.insertAdjacentHTML('beforeend', SEC);
  const slot = document.getElementById('slot');
  const { row, block } = window.makeModalBlock({ variant, title: '배송 안내', text: '오후 2시 이전 주문은 당일 출고됩니다.', ...cfg });
  block.id = 'mdlX';
  if (where === 'section') slot.replaceWith(row);
  else if (where === 'frame') {
    const f = window.makeFrameBlock({ fullWidth: true, bg: '#fafafa', padding: 24 }); f.id = 'hostF';
    f.appendChild(row); slot.replaceWith(f);
  } else {
    const r = document.createElement('div'); r.className = 'row'; r.dataset.layout = 'stack';
    r.innerHTML = '<div class="grid-block" id="gX" data-type="grid" data-gap="24" data-valign="top"></div>';
    r.firstChild.dataset.cols = JSON.stringify([{ width: 1, lines: [{ type: 'body', text: '칸 가' }] }, { width: 1, lines: [{ type: 'body', text: '칸 나' }] }]);
    slot.replaceWith(r);
    const g = document.getElementById('gX'); window.renderGridBlock(g);
    const box = window.ensureGridKidsBox ? window.ensureGridKidsBox(g) : (() => { window.addGridChild('gX', 'gap'); return g.querySelector(':scope > .grd-children'); })();
    box.innerHTML = ''; box.appendChild(row);
  }
  window.renderModalBlock(block); window.rebindAll?.(); window.deselectAll?.(); document.activeElement?.blur?.();
}, [variant, cfg, where, SEC]);

const measure = (page) => page.evaluate(() => {
  const sec = document.getElementById('sX');
  const r = sec.getBoundingClientRect();
  const box = document.getElementById('mdlX') || document.querySelector('[data-row-text-style]');
  const b = box.getBoundingClientRect();
  const lines = [];
  const slots = document.getElementById('mdlX')
    ? [...box.querySelectorAll('[data-mdl-slot]')]
    : [...box.querySelectorAll('.text-block [class^="tb-"]')];
  for (const s of slots) { const rg = document.createRange(); rg.selectNodeContents(s); for (const q of rg.getClientRects()) lines.push([q.left, q.top, q.width, q.height].map(v => Math.round(v * 100) / 100)); }
  /* ★★«칠» 상태 — ★261021. ★`geo`(상자·줄·아이콘)는 ★510/510 어긋난 적이 없는데 ★«칠»만 달랐다.
     ★9일간 설명되지 않은 자리가 ★여기다 — ★`measure()` 가 ★칠을 ★안 걷고 있었다(Codex 리뷰 4회차).
     ★까닭: `css/editor-blocks.css:2167` `#canvas [data-is-placeholder="true"] { opacity: 0.45 }`
       ＋ `:2170` `[contenteditable="true"] { opacity: 1 }` ⇒ ★★`빈칸` 은 한글 ~20자를
       ★알파 ★0.45 로 ★합성해 그린다(그 문구는 `modal-block.js` `MODAL_PH` 가 ★내용으로 넣는다).
     ⇒ ★분수 알파 위 글자 안티앨리어싱은 ★합성 라운딩을 타므로 ★이 계열에서 ★가장 기계에 민감하다
       (★실측: `빈칸` ★srv 686 · ★아이맥 701/703).
     ⇒ ★★그리고 ★`contenteditable` 이 그 알파를 ★1 로 ★뒤집는다 — ★`frameify` 전후로 그것이 바뀌면
       ★그건 ★래스터가 아니라 ★**제품 결함**이다. ⇒ ★그래서 ★A·B 양쪽에서 걷어 ★따로 단언한다. */
  const paint = slots.map((s) => [
    s.getAttribute('data-is-placeholder'),
    s.getAttribute('contenteditable'),
    getComputedStyle(s).opacity,
  ]);
  const ic = box.querySelector('.mdl-icon, .icon-block');
  const icr = ic ? ic.getBoundingClientRect() : null;
  return { clip: { x: Math.floor(r.left), y: Math.floor(r.top), width: Math.ceil(r.width), height: Math.ceil(r.height) },
           box: [b.left, b.top, b.width, b.height].map(v => Math.round(v * 100) / 100), lines, paint, icon: icr && [icr.left, icr.top, icr.width, icr.height].map(v => Math.round(v * 100) / 100) };
});
async function diffPng(page, a, b) {
  return page.evaluate(async ([a, b]) => {
    const load = async (s) => { const img = new Image(); img.src = 'data:image/png;base64,' + s; await img.decode(); const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d'); x.drawImage(img, 0, 0); return x.getImageData(0, 0, c.width, c.height); };
    const A = await load(a), B = await load(b);
    if (A.width !== B.width || A.height !== B.height) return { n: -1, size: [A.width, A.height, B.width, B.height] };
    let n = 0, first = null;
    for (let i = 0; i < A.data.length; i += 4) if (A.data[i] !== B.data[i] || A.data[i + 1] !== B.data[i + 1] || A.data[i + 2] !== B.data[i + 2] || A.data[i + 3] !== B.data[i + 3]) { n++; if (!first) first = [(i / 4) % A.width, Math.floor(i / 4 / A.width)]; }
    return { n, first };
  }, [a.toString('base64'), b.toString('base64')]);
}
/* ★자리가 «멈춘 뒤»에 찍는다 — 첫 판은 applyZoom 직후 첫 설정을 «움직이는 중»에 찍어 14칸 중 첫 칸만 매번 빨갰다
   (before 상자 437×725 ↔ after 402×796 · 40% 는 섹션 전체가 갈림). _root-harness waitStableRect 와 같은 처방: 두 번 연속 같을 때까지. */
const settle = async (page) => {
  await page.mouse.move(2, 2);
  await page.evaluate(() => document.fonts.ready);   // ★웹폰트가 «다 온 뒤» — 첫 칸만 글자 그림이 갈리던 둘째 까닭(형태는 같고 픽셀만 ~19k 다름)
  let prev = null;
  for (let i = 0; i < 40; i++) {
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    const r = await page.evaluate(() => { const b = document.getElementById('sX').getBoundingClientRect(); const m = (document.getElementById('mdlX') || document.querySelector('[data-row-text-style]')).getBoundingClientRect();
      return [b.left, b.top, b.width, b.height, m.left, m.top, m.width, m.height].map(v => Math.round(v * 100)).join(','); });
    if (r === prev) return;
    prev = r; await page.waitForTimeout(100);
  }
  throw new Error('자리가 안 멈춘다');
};

/* ★알고 남긴 차이 — «이름과 상한»으로 적는다(상한을 넘으면 빨강). 형태(geo)는 언제나 0.01px 까지 같아야 한다.
   ⑴ icon-stack + 모서리: 아이콘 svg 가장자리 안티앨리어싱 62px(골든 3·4차 동일). 원인 = 모서리 둥근 프레임의 «자르기 층»
      (css `.frame-block[data-radius]:not([data-radius="0"]){overflow:hidden}` + makeFrameBlock 인라인 overflow:hidden).
      모서리 없는 icon-stack 은 0 · 다른 세 형태 + 모서리는 0 ⇒ 아이콘 래스터만 갈린다.
      ⛔없애려면 프레임에 인라인 overflow:visible 을 박아야 하는데, 그러면 «모달에서 온 둥근 프레임»만 나중에 넣는 이미지 줄을
        모서리에서 안 자른다(다른 모든 둥근 프레임과 다르게) — 그 대가가 더 커서 «자르기»를 지켰다(M1-BUILD 보고).
   ⑵ icon-stack · 배율 40%: 2px 안팎(소수 배율 래스터 — 어느 설정에 뜨는지 판마다 바뀐다: 3차 빈칸 · 4차 높이bottom·빈칸). */
/* ★★★«이름으로 ★미룬 것» — ★★2026-10-12 · ★현빈 「프리릴리스 먼저 · 고칠 건 그 뒤 다」 · ★지디 발주 ⒞
   ⛔`test.fixme`(★칸 전체 눈감기)보다 ★좁다 — ★★«이 두 설정만» 미루고 ★나머지 12설정은 ★그대로 ★0 으로 ★잰다.
   ★★실측(quote1011 · ×10 회차 · ★10회 ★전부 ★같은 값):
     ★`꾸밈`(italic＋strike＋highlight) — ★★`highlight` ★하나가 ★전부다(★쪼개서 ★쟀다: italic 0~2 · strike 0~4)
        ★최댓값 ★1040px(titled frame 40%) · ★100% 는 ★0(★단 ★icon-stack 100% 는 ★6)
     ★`빈칸`(title:'' text:'') — ★★`text:''` ★하나가 ★거의 ★전부(★titled grid 만 ★`title:''`)
        ★최댓값 ★686px(icon-stack 40%)
     ★★`geo` 는 ★★어긋난 적이 ★★0건(★510/510) ⇒ ★★상자·줄·아이콘은 ★같고 ★★«칠»만 ★다르다
     ★★★261021 — ★그 «칠»을 ★이제 ★걷는다(`measure().paint`). ★`geo` 가 ★그것을 ★안 재고 있었다.
   ★★★떼는 조건 = ★★«정식 릴리스 ★전». ★그 자리: `tests/dom/EXPECT_N.md` 의 ★그 줄.
   ★★상한을 ★무한이 아니라 ★★«잰 값 ＋ 여유»로 ★둔 ★까닭: ★★더 ★커지면 ★여기가 ★잡는다(★미룸 ≠ 눈감기). */
/* ★★★`빈칸` ★700 → ★710 ★재교정 (2026-10-22 · ★★현빈 ⒜ 확정 · ★server-manager 경유)
   ★★★분모 = ★★세 기계 실측(★옛 700 은 ★★srv ★한 기계에서만 교정된 수였다 — ★분모가 ★없었다):
     ★srv    ★686 ×9 · ★688 ×1   (×10 · load1 2.68~4.19)
     ★아이맥  ★701 · ★703 ★섞임    (×3 ＋ ×3 · P9)
     ★인텔    ★★704 ×2 (전수 chunk-06) ＋ ★★×11 재측정 ★전부 ★704 ⇒ ★★흔들림 0 · MacBookPro15,1 i7-8850H
   ⇒ ★상한 ★710 = ★★실측 최댓값 ★704 ＋ ★여유 ★6.
   ★★현빈이 ★알고 고르셨다: 「★네 번째 기계가 오면 또 깨지는 것 ★안다」 ⇒ ★★그 꼴을 ★숨기지 않는다.
   ⛔★★그러니 ★★이 수는 ★«썩는 처방»이다 — ★기계가 늘면 ★최댓값이 ★오른다(★686 → 703 → 704).
     ⇒ ★★참 고침은 ★★«알파 0.45 합성 래스터»를 ★안 쓰는 것이다(★`EXPECT_N.md` ⒞) ⇒ ★★0.9.9 ★뒤로.
   ★★그리고 ★이 줄은 ★★«면제 인상»이 ★아니다 — ★`EXPECT_N.md:233~235` 가 ★그 까닭을 적었다:
     ★★「700 에는 ★기계 분모가 ★애초에 ★없었다 ⇒ ★⒜ 는 ★그 상수에 ★처음으로 ★정직한 근거를 주는 것」
   ★★⇒ ⛔그래서 ★★`TAIL_PX_40` 의 ★「0.9.9 에서 ★걷는다」와 ★★부딪히지 ★않는다 —
      ★저쪽은 ★★«걷기», ★이 칸은 ★★«재교정»이다(★문서가 ★둘을 ★갈라 적었다).
   ★★★그리고 ★★A2b 가 ★이 수를 ★★«막힘 표본»으로 잠근다 — ★★선이 ★영영 거짓이 ★되지 않게. */
const DEFER_PX = Object.freeze({ '꾸밈': 1100, '빈칸': 710 });
/* ★★★«배율 40% 상한 10» (2026-10-12 · 지디 발주 ⒠ · 현빈 ⒜ 확정)
   ★까닭: ★40% 꼬리의 ★★잰 최댓값이 ★★`긴글` ★★10px 이다(★quote1011 ×10 회차 · ★10회 ★전부 ★같은 값).
     ★꼬리 값 전부 = ★`[1, 2, 4, 6, 10]` — ★기본·색·테두리·모서리·그림자soft/strong·높이center/bottom(★2) ·
       ★작은글(★1·2·4 · ★icon-stack ★9) · ★긴글(★4·6·10)
   ⛔★★100% 는 ★★무접촉이다 — ★★거기는 ★★`0` 이 ★참 골든이고(★실측: ★9칸 ★`ALL 0`) ★★새면 ★골든이 ★죽는다.
     ★★그래서 ★`zoom === 40` ★갈래에만 ★얹는다. ★★그 칸을 ★재는 자 = ★이 벌의 ★100% ★9칸 자신이다.
   ★★★떼는 조건 = ★★«다음 버전». ★자리: `tests/dom/EXPECT_N.md`
   ⚠️★이 상한은 ★★`icon-stack · 40%` 의 ★`작은글`(★9)도 ★같이 ★가린다 — ★★의도된 것이다(★같은 꼬리 계열). */
const TAIL_PX_40 = 10;
/* ★★★`icon-stack · 100%` 의 `꾸밈` — ★★«기계 의존»이다(261021 실측 · ★상수가 아니라 ★그 사실이 요점)
   ★★어느 판에서 들어왔나 — ★이등분으로 ★집었다:
     머지 `50194997`(10-10 10:14)의 두 부모를 ★각 ×3 (아이맥 · workers1 · retries0)
       ★`^1` `87c1bb65` ⇒ px ★0,0,0 (first=null · rc 0)
       ★`^2` `bcd8e786` ⇒ px ★6,6,6 (first=★[158,221] · rc 1)   ← ★★범인
     ★`bcd8e786` = 「fix(frame): 명시도 구멍 하나를 닫고 하나는 범위 밖이라 안 닫았다」
       — `css/editor-blocks.css` 에 `overflow: visible !important` 와
         `.frame-block:has(> .frame-child-dragging):not([data-clip-content="true"])` 를 들였다.
       ⇒ ★이 벌 위쪽 ⑴ 주석의 «자르기 층»(`[data-radius]:not([data-radius="0"]){overflow:hidden}`)과 ★같은 기계다.
   ★★★그런데 ★값이 ★기계마다 ★다르다 — ★★같은 판 `013fef98` 에서:
     ★아이맥 ★6 (★20/20 · dev `013fef98` ＋ 핀 `eaab4bbe` 각 ×10) · ★srv ★0 (★3/3 · load1 2.75)
   ⇒ ★★그래서 ★`0` 으로 둘 수도 없고(아이맥이 빨강) ★`6` 은 ★★여유가 ★0 이다(1px 늘면 빨강).
     ⛔그 ★여유 0 을 ★숨기지 않는다 — ★그게 이 줄의 ★가장 중요한 사실이다.
   ★그래도 ★1100 → ★6 으로 ★★183배 ★좁혔고, ★덮는 자리를 ★12 → ★1 로 줄였다(아래 조기반환).
   ★★★떼는 조건 = ★★판 `0.9.9` — ⑴`bcd8e786` 의 자르기 층을 고치거나 ⑵두 기계가 ★같은 값을 내게 되면.
     ★자리: `tests/dom/EXPECT_N.md` · ★재는 자 = `tests/unit/slice-harness-deps-roster.test.mjs` `SHD8`
   ⛔★「래스터다」로 닫지 마라 — ★100% 는 ★정수배율이다. ⛔「플래키다」로도 닫지 마라 — ★두 기계 모두 ★결정적이다(20/20 · 3/3). */
const ICON100_KKUMIM_PX = 6;
/* ★★★`ALLOW` — ★조기반환으로 ★「100% 는 무접촉」을 ★★구조에 박는다 (261021 · Codex 리뷰 ＋ 지디 재확인)
   ⛔★옛 꼴은 `DEFER_PX[name]` 을 ★배율과 무관하게 ★먼저 봤다 ⇒ ★「40% 꼬리」 면제가 ★100% 까지 ★덮었다.
     ★실측(★56쌍 = VARIANTS 4 × CFGS 14): ★고치기 ★전 ★100% 에서 ★★8자리가 ★0 이 아니었다 —
       plain|꾸밈 1100 · plain|빈칸 700 · titled|꾸밈 1100 · titled|빈칸 700
       dashed|꾸밈 1100 · dashed|빈칸 700 · icon-stack|꾸밈 1100 · icon-stack|빈칸 700
     ⇒ ★★네 형태 ★전부였다. ★그 8 이 ★아래 `A1` 의 ★비공허성 핀이다.
   ★★왜 ★재키잉(`'꾸밈|40'` 같은 키)이 ★아니라 ★조기반환인가 — ★★취향이 아니라 ★돌연변이 측정이다:
     `'꾸밈|100': 1100`(배율 오타) ⇒ 조기반환 ★0/56 · 재키잉 ★4/56
     `'색|100': 9999`(100% 에 새 면제)  ⇒ 조기반환 ★0/56 · 재키잉 ★4/56
   ⇒ ★재키잉은 「100% 무접촉」을 ★«표 안의 철자»로 들고 있어 ★현실적인 실수 둘에 ★뚫린다.
     ★조기반환은 ★그 불변식을 ★구조상 ★표현 불가능하게 만든다 — ★표를 ★아무리 늘려도 ★100% 는 ★안 샌다.
   ⛔★★「A1 의 56개 단언이 이 수정을 잠근다」로 적지 마라 — ★48/56 은 ★항등식이다. ★★8 이 잠그고 ★48 이 지킨다. */
const ALLOW = (variant, name, zoom) => (
  zoom === 100
    ? (variant !== 'icon-stack' ? 0
      : name === '모서리' ? 64
      : name === '꾸밈' ? ICON100_KKUMIM_PX
      : 0)
    : (DEFER_PX[name] !== undefined ? DEFER_PX[name] : TAIL_PX_40));
/* ══ ★`ALLOW` 자체를 ★재는 단언 셋 — ★브라우저 ★없이 돈다(순수 함수다) ═════════════
   ★이름을 ★정확히 붙인다 — ⛔「셋이 이 수정을 잠근다」가 ★아니다:
     ★A1 = ★잠그는 자 (고치기 전 ★8/56 비일치 · 고친 뒤 ★0/56)
     ★A2 = ★★«40% 를 안 건드렸다»의 ★음성대조 — ★★완전한 항등식이다(40% 56쌍 ★전부 before===after).
           ⛔「수정이 됐다」의 ★증거로 ★쓰지 마라.
     ★A3 = ★명부 자기검산(오타·NFD 키) — ★예방용 · 항등식 */
test('A1 ★★`ALLOW` 전제 — ★100% 는 ★무접촉이다 (★56쌍 ★전수 · ★예외는 ★이름 붙은 ★둘)', () => {
  const want = (v, n) => (v !== 'icon-stack' ? 0
    : n === '모서리' ? 64
    : n === '꾸밈' ? ICON100_KKUMIM_PX
    : 0);
  const bad = [];
  for (const v of VARIANTS) for (const [name] of CFGS) {
    const got = ALLOW(v, name, 100);
    if (got !== want(v, name)) bad.push(`${v}|${name} ${got}≠${want(v, name)}`);
  }
  /* ★★비공허성 핀 = ★8. ★고치기 ★전 판에서 ★이 목록이 ★그 8쌍이었다(261021 실측 · 계산):
       plain|꾸밈 1100 · plain|빈칸 700 · titled|꾸밈 1100 · titled|빈칸 700
       dashed|꾸밈 1100 · dashed|빈칸 700 · icon-stack|꾸밈 1100 · icon-stack|빈칸 700
     ⇒ ★이 단언을 ★옛 `ALLOW` 에 되돌려 돌리면 ★반드시 ★8 이 나와야 한다. ★0·7·9 면 ★분모가 바뀐 것이다.
   ⚠️★★261022 덧 — ★위 ★8쌍의 ★`빈칸 700` 은 ★★«그때의 값»이다. ★그 뒤 ★상한을 ★★710 으로 ★재교정했다.
     ⇒ ★★되돌려 돌리면 ★이제 ★`빈칸 ★710` 으로 ★나온다. ★★세는 수(★8)는 ★그대로다 — ★★그것이 ★핀이다.
     ⛔★위 ★여덟 줄은 ★★고치지 ★않는다 — ★★그때 ★센 수를 ★거짓으로 만들기 때문이다(★역사 문장). */
  expect(bad, `★100% 가 샌다 — ★이 자리들이 0(또는 이름 붙은 예외)이 ★아니다:\n  ${bad.join('\n  ')}`).toEqual([]);
  expect(VARIANTS.length * CFGS.length, '★분모 — ★56쌍(4×14)이 아니면 ★위 핀 8 이 뜻을 잃는다').toBe(56);
});
test('A2 ★`ALLOW` ★음성대조 — ★★«40% 를 ★안 건드렸다» (⛔이 수정의 ★증거가 ★아니다 · ★항등식)', () => {
  expect(ALLOW('titled', '꾸밈', 40)).toBe(1100);
  expect(ALLOW('icon-stack', '빈칸', 40)).toBe(710);   // ★★261022 재교정(700→710) — ★A2 는 ★항등식이라 ★이 수를 ★잠그지 ★않는다. ★잠그는 자 = ★★아래 ★A2b
  expect(ALLOW('plain', '기본', 40)).toBe(TAIL_PX_40);
  expect(ALLOW('icon-stack', '작은글', 40)).toBe(TAIL_PX_40);
  /* ★꼬리가 ★64 를 이긴다 — ★위 ⚠️ 주석이 「의도된 것」이라 적은 ★그 자리다 */
  expect(ALLOW('icon-stack', '모서리', 40)).toBe(TAIL_PX_40);
});
/* ★★★A2b ★★«막힘 표본» — ★★`빈칸` 상한이 ★★«통과»만 보여 주고 ★★«막음»을 안 보여 주면
     ★그 선은 ★★언젠가 ★조용히 ★올라가 ★영영 ★거짓이 된다(★9999 로 바꿔도 ★아무 검사가 ★안 빨개진다).
   ⇒ ★★그래서 ★★«통과 표본»과 ★★«막힘 표본»을 ★★한 쌍으로 ★둔다 (★server-manager 지시 · 261022).
   ★★★이 단언이 ★재는 것은 ★★«제품»이 ★아니라 ★★«상한 그 자체»다 — ★★그 이름을 ★정확히 붙인다.
     ★상한을 ★올리면(예: 9999) ★★⑵가 ★빨강 · ★내리면(예: 700) ★★⑴이 ★빨강.
   ⛔★★「이 셋이 ★제품을 ★잠근다」로 ★적지 ★마라 — ★제품을 재는 자는 ★★`G1` 이다. */
test('A2b ★★`빈칸` 상한 710 — ★★통과 표본 ＋ ★★막힘 표본 ★한 쌍 (★선이 ★영영 ★거짓이 ★되지 않게)', () => {
  const tol = ALLOW('icon-stack', '빈칸', 40);
  /* ⑴ ★★통과 표본 = ★세 기계 ★실측 ★최댓값 — ★이보다 ★낮추면 ★인텔이 ★빨강이 된다 */
  expect(704 <= tol, '★인텔 실측 704 가 ★상한을 ★넘는다 — ★상한을 ★내렸나(★분모는 ★주석에)').toBe(true);
  expect(703 <= tol, '★아이맥 실측 703 이 ★상한을 ★넘는다').toBe(true);
  expect(688 <= tol, '★srv 실측 688 이 ★상한을 ★넘는다').toBe(true);
  /* ⑵ ★★★막힘 표본 = ★★상한 ★바로 위 — ★★이것이 ★없으면 ★상한을 ★무한으로 올려도 ★아무도 ★안 빨개진다 */
  expect(tol + 1 <= tol, '★★상한 바로 위가 ★통과한다 — ★★산술이 깨졌다').toBe(false);
  expect(800 <= tol, '★★800 이 ★통과한다 — ★★상한이 ★조용히 ★올라갔다(★네 번째 기계가 ★왔으면 ★주석의 ★분모부터 ★고쳐라)').toBe(false);
  /* ⑶ ★★수를 ★박아 둔다 — ★★「710 이다」를 ★사람 기억이 아니라 ★이 줄이 ★든다 */
  expect(tol, '★`빈칸` 상한이 ★710 이 ★아니다 — ★바꿨다면 ★★분모(세 기계 실측)를 ★주석에 ★같이 고쳐라').toBe(710);
});
test('A3 ★`DEFER_PX` 명부는 ★`CFGS` 밖 이름을 ★담지 않는다 (★오타·NFD 를 ★그 자리에서)', () => {
  const names = CFGS.map(([n]) => n);
  expect(Object.keys(DEFER_PX).filter((k) => !names.includes(k)),
    '★면제 명부에 ★CFGS 에 없는 이름이 있다 — ★오타이거나 ★NFD/NFC 가 갈렸다(macOS)').toEqual([]);
});

for (const variant of VARIANTS) for (const where of PLACES) for (const zoom of ZOOMS) {
  test(`G1 픽셀 동일 — ${variant} · ${where} · ${zoom}%`, async ({ page }) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width: 1600, height: 1500 });
    const errs = await bootApp(page);
    await page.evaluate((z) => window.applyZoom(z), zoom);
    await page.waitForTimeout(800);   // 배율 맞추기의 비동기 가운데 맞추기
    /* ★토스트는 «캔버스 위 덮개»다(프레임화가 「⌘Z 로 되돌리기」를 띄운다) — 첫 판은 첫 설정의 B 컷에만 토스트가 들어가
       (뒤 설정은 앞 토스트가 A·B 둘 다에 남아 같아진다) 14칸 중 첫 칸만 ~19k px 갈렸다(형태 같음 · 0행부터). 비교 대상이 아니라 끈다. */
    await page.evaluate(() => { window.showToast = () => {}; });
    const bad = [];
    for (const [name, cfg] of CFGS) {
      await place(page, variant, cfg, where);
      await page.evaluate(() => document.getElementById('sX').scrollIntoView({ block: 'start' }));
      await settle(page);
      const m0 = await measure(page);
      const a = await page.screenshot({ clip: m0.clip });
      const ok = await page.evaluate(() => !!window.frameifyModal?.('mdlX'));
      if (!ok) { bad.push(`${name}: frameifyModal 실패/없음`); continue; }
      await page.evaluate(() => { window.deselectAll?.(); document.activeElement?.blur?.(); });
      await settle(page);
      const m1 = await measure(page);
      const b = await page.screenshot({ clip: m0.clip });
      const d = await diffPng(page, a, b);
      const geo = JSON.stringify([m0.box, m0.lines, m0.icon]) === JSON.stringify([m1.box, m1.lines, m1.icon]);
      /* ★★«칠» 상태는 ★`geo` 와 ★따로 단언한다 — ★그래야 빨강 글이 ★어느 갈래인지 ★말한다:
         ★㉠ paint ★같음 ＋ px>0 ⇒ ★순수 합성 래스터(⇒ 기계 의존으로 닫는다)
         ★㉡ paint ★다름        ⇒ ★★`frameify` 가 ★칠 상태를 ★뒤집었다 = ★제품 결함 */
      /* ★★자기 전제 — ★`slots` 가 비면 `paint` 가 `[]` 이고 ★`paintSame` 이 ★항등식이 된다.
         ⇒ ★그 초록은 ★「칠이 같다」가 아니라 ★「★안 쟀다」다. ⇒ ★그래서 ★칸 수를 ★먼저 단언한다. */
      if (!m0.paint.length) bad.push(`${name}: ★칠을 걷을 슬롯이 ★0개다 — ★아래 paint 판정은 «안 쟀다»다`);
      const paintSame = JSON.stringify(m0.paint) === JSON.stringify(m1.paint);
      if (!paintSame) bad.push(`${name}: ★칠 상태가 갈렸다(★제품 결함 — 래스터 ★아님) a=${JSON.stringify(m0.paint)} b=${JSON.stringify(m1.paint)}`);
      const allow = ALLOW(variant, name, zoom);
      if (d.n > allow || !geo) bad.push(`${name}: px=${d.n} first=${JSON.stringify(d.first)} geo=${geo ? 'ok' : JSON.stringify({ a: [m0.box, m0.lines.slice(0, 3), m0.icon], b: [m1.box, m1.lines.slice(0, 3), m1.icon] })}`);
    }
    console.log(`[G1 ${variant} ${where} ${zoom}]`, bad.length ? bad.join('\n  ') : 'ALL 0');
    expect(bad, bad.join('\n')).toEqual([]);
    expect(errs, errs.join(' | ')).toEqual([]);
  });
}

test('V1 비교기 양성대조 — 같은 PNG 에서 픽셀 하나를 바꾸면 «1» 로 센다', async ({ page }) => {
  await page.setViewportSize({ width: 400, height: 300 });
  await page.setContent('<div id="b" style="width:200px;height:100px;background:#fff"><i id="p" style="position:absolute;left:10px;top:10px;width:1px;height:1px;background:#fff"></i></div>');
  const clip = { x: 0, y: 0, width: 220, height: 120 };
  const a = await page.screenshot({ clip });
  await page.evaluate(() => { document.getElementById('p').style.background = '#000'; });
  const b = await page.screenshot({ clip });
  expect((await diffPng(page, a, b)).n).toBe(1);
  expect((await diffPng(page, a, a)).n).toBe(0);
});
