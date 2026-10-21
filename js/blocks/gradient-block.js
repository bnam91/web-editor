// ── Gradient Block (플로팅 오버레이) ──────────────────────────────────────────
// 2026-05-21 sticker 패턴으로 재작성.
// 섹션 위에 absolute로 떠있는 그라데이션 페이드 오버레이.
// 용도: 이미지 끝선/섹션 경계의 부자연스러움을 페이드로 자연스럽게 연결.
//
// 부모: .section-block 직접 자식 (sticker와 동일 패턴)
// 위치: absolute, left/top dataset 기반
// 디폴트: 860 × 300, 좌상단 (0, 0), linear, 위→아래, 검정 100% → 검정 0%
// z-index: 2 — ★2026-10-17 G-N0 DOM 실측으로 정정(옛 주석은 반대였다: 「텍스트/콘텐츠 아래」).
//   .section-block 이 쌓임맥락(z-index:2)을 만들고, .section-inner/.row 는 쌓임맥락을 «안」
//   만들어(.row 는 z-index:auto) 안의 .text-block(z-index:2) 과 이 블럭(인라인 z-index:2) 이
//   «같은» 쌓임맥락에서 동점 비교된다 — 동점이면 DOM 뒤가 이긴다(js/overlay-handles.js:3648-3654
//   의 같은 타이브레이크). addGradientBlock 이 sec.appendChild(block) 으로 .section-inner «뒤»에
//   붙이므로 ★그라데이션이 텍스트 «위»에 그려진다(실측: tests/dom/grad-g1g7-cascade-stop.dom.spec.js G-N0,
//   elementsFromPoint 와 실제 클릭 둘 다 동의). G1(cascade 없음)과 겹치면 「나머지 블록이 글자 위에
//   깔려 배경이미지처럼 보인다」(현빈 2026-10-17 제보)로 이어진다 — G-NEW 참조.
//

// 의존성:
//   - window.getSelectedSection, window.showNoSelectionHint,
//     window.pushHistory, window.scheduleAutoSave,
//     window.bindGradientSelect (gradient-select.js), window.genId (drag-utils.js)

// G10(261018) — id 가 Math.random() 직접 호출이라 다른 블럭처럼 genId() 를 안 썼다 — actorId 조각이
// 빠져 협업에서 출처 불명(annotation-block.js:9-13 의 같은 병 참조). 「부를 때」 찾는다 — 모듈 로드
// 시점에 잡아두면 drag-utils 가 아직 window.genId 를 안 심었을 때 폴백에 고정된다(같은 까닭).
const genId = (p) => (typeof window.genId === 'function'
  ? window.genId(p)
  : p + '_' + Math.random().toString(36).slice(2, 9));

const GRADIENT_DEFAULTS = {
  style:       'linear',
  direction:   'to bottom',
  startColor:  '#000000',
  endColor:    '#000000',
  startAlpha:  1,
  endAlpha:    0,
  width:       860,
  height:      300,
  x:           0,
  y:           0,
};

function _hexToRgba(hex, alpha) {
  const h = String(hex || '#000000').replace('#','');
  const r = parseInt(h.slice(0,2), 16) || 0;
  const g = parseInt(h.slice(2,4), 16) || 0;
  const b = parseInt(h.slice(4,6), 16) || 0;
  const a = Math.max(0, Math.min(1, parseFloat(alpha)));
  return `rgba(${r},${g},${b},${a})`;
}

// B24: stop 배열 정본. gradStops(JSON) 우선, 없으면 레거시 start/end 2-stop 합성(하위호환).
function _resolveStops(block) {
  const raw = block.dataset.gradStops;
  if (raw) {
    try {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr) && arr.length >= 2) {
        /* G6(261018) — 「별도 카드」 닫힘(js/props/prop-gradient.js:132~135 ★0920b grad-alpha 주석 참조).
           그 주석이 말한 «이 유닛 범위 밖」이 여기다: `|| 0` 은 NaN 과 참 0 을 구분 못 해, MCP/임포트로
           들어온 쓰레기 alpha(예: {offset:'abc'})가 parseFloat 로 NaN → Math.max/min 을 통과한 NaN →
           `|| 0` 에서 「완전 투명」으로 떨어졌다. Number.isFinite 로 갈라 끊는다 — 입력단(prop-gradient.js
           _clamp01)과 같은 처방·같은 기본값(alpha 기본 1 = GRADIENT_DEFAULTS.startAlpha · offset 기본 0). */
        const clean = arr
          .map(s => {
            const pa = parseFloat(s.alpha), po = parseFloat(s.offset);
            return {
              color: /^#[0-9a-fA-F]{6}$/.test(s.color) ? s.color : '#000000',
              alpha: Number.isFinite(pa) ? Math.max(0, Math.min(1, pa)) : GRADIENT_DEFAULTS.startAlpha,
              offset: Number.isFinite(po) ? Math.max(0, Math.min(1, po)) : 0,
            };
          })
          .sort((a, b) => a.offset - b.offset);
        if (clean.length >= 2) return clean;
      }
    } catch (_) { /* fall through to legacy */ }
  }
  const startColor = block.dataset.gradStart || GRADIENT_DEFAULTS.startColor;
  const endColor   = block.dataset.gradEnd   || GRADIENT_DEFAULTS.endColor;
  const sA = block.dataset.gradStartAlpha != null ? parseFloat(block.dataset.gradStartAlpha) : GRADIENT_DEFAULTS.startAlpha;
  const eA = block.dataset.gradEndAlpha   != null ? parseFloat(block.dataset.gradEndAlpha)   : GRADIENT_DEFAULTS.endAlpha;
  return [
    { color: startColor, alpha: Math.max(0, Math.min(1, sA)), offset: 0 },
    { color: endColor,   alpha: Math.max(0, Math.min(1, eA)), offset: 1 },
  ];
}

function renderGradientBlock(block, hint) {
  const style       = block.dataset.gradStyle      || GRADIENT_DEFAULTS.style;
  const direction   = block.dataset.gradDirection  || GRADIENT_DEFAULTS.direction;
  const startColor  = block.dataset.gradStart      || GRADIENT_DEFAULTS.startColor;
  const endColor    = block.dataset.gradEnd        || GRADIENT_DEFAULTS.endColor;
  const startAlpha  = block.dataset.gradStartAlpha != null ? parseFloat(block.dataset.gradStartAlpha) : GRADIENT_DEFAULTS.startAlpha;
  const endAlpha    = block.dataset.gradEndAlpha   != null ? parseFloat(block.dataset.gradEndAlpha)   : GRADIENT_DEFAULTS.endAlpha;
  const width       = parseInt(block.dataset.gradWidth)  || GRADIENT_DEFAULTS.width;
  const height      = parseInt(block.dataset.gradHeight) || GRADIENT_DEFAULTS.height;
  const x           = parseInt(block.dataset.x) || 0;
  const y           = parseInt(block.dataset.y) || 0;

  const stops = _resolveStops(block);
  const stopCss = (arr) => arr
    .map(s => `${_hexToRgba(s.color, s.alpha)} ${Math.round(Math.max(0, Math.min(1, s.offset)) * 100)}%`)
    .join(', ');

  let bg;
  if (style === 'radial') {
    /* ★1017t1 G7 — 2026-10-17 현빈 승인(「고침」).
       ★왜 뒤집혀 있었나: 2-stop 시절 「중앙=투명, 외곽=불투명」 비네트를 ★offset 반전(1-offset)으로
         흉내냈다. 2-stop(0/1)에서는 집합이 자기 자신이라 ★보이지 않았고, ★3-stop 부터 사용자가
         중간색을 0.2 에 두면 ★0.8 로 뒤집혔다.
       ★언제 고쳤나: 2026-10-17.
       ★★기존 저장본의 보이는 그림이 달라진다 — radial ＋ 3-stop 이상인 그라데이션은
         중간색 자리가 ★입력값대로 그려진다(더는 반전하지 않는다).
       ★「중앙=마지막 stop」을 다시 원하면 ★패널에서 stop 순서를 바꿔라 — ⛔코드가 몰래 뒤집지 않는다.
       회귀: tests/dom/grad-g1g7-cascade-stop.dom.spec.js G7-a/G7-n. */
    const radialStops = stops;   // ★자리 보존 — 사용자가 준 offset 그대로
    bg = `radial-gradient(circle at center, ${stopCss(radialStops)})`;
  } else {
    bg = `linear-gradient(${direction}, ${stopCss(stops)})`;
  }

  // absolute floating overlay — 블록 자체는 배경 없음 (선택 outline + 핸들을 유지하기 위해)
  block.style.cssText = `position:absolute;left:${x}px;top:${y}px;`
    + `width:${width}px;height:${height}px;`
    + `user-select:none;cursor:move;z-index:2;pointer-events:auto;`
    + `box-sizing:border-box;`;

  // 그라데이션 fill은 별도 inner div에 적용 — 섹션 박스로 클리핑 가능하게 분리
  let gradFill = block.querySelector(':scope > .grad-fill');
  if (!gradFill) {
    gradFill = document.createElement('div');
    gradFill.className = 'grad-fill';
    block.insertBefore(gradFill, block.firstChild);
  }
  gradFill.style.cssText = `position:absolute;inset:0;pointer-events:none;z-index:0;background:${bg};`;

  /* 섹션 박스를 기준으로 fill 클리핑 (선택 outline + 코너 핸들은 블록 요소에 있어 영향 없음)
     hint.secW/secH: 드래그 중 호출자가 캐싱해둔 값. 없으면 즉시 읽는다(레이아웃 강제 재계산 —
     드래그가 아닌 1회성 호출에서만 감내: 프로퍼티 패널 슬라이더, MCP 갱신 등).

     ★★1020t1b ㉲ (2026-10-20) — ★맨 `clip-path` 인라인을 ★`--sec-clip` ★변수로 옮겼다.
       ★값·식은 ★한 글자도 안 바뀐다(같은 inset). 바뀌는 것은 ★«무엇에 실어 보내나» 하나다.
       ★스티커·목업·확대가 ★이미 쓰는 ★그 레일이다(css/editor-blocks.css 「섹션 밖 크롭」 절).
     ★★왜 옮기나 — ★인라인 `clip-path` 는 ★세 가지를 ★구조적으로 ★못 하게 했다(전부 실측):
       ① ★이력 비교가 ★이걸 ★«편집»으로 읽는다. `js/history.js:63` 의 `_NON_EDIT_ATTR_RE` 는
          ★`--sec-clip` «만» 벗긴다 ⇒ 실측(그 비교자를 떠서 돌린 값):
            맨 clip-path 만 다른 두 판 → `_sameEdit` = ★false (= ⌘Z 가 ★먹통 한 칸을 만든다)
            ★같은 차이를 `--sec-clip` 으로  → ★★true  (= 안 쌓인다)
       ② 「★섹션 밖 보이기 (미리보기)」(js/props/prop-section.js:451 · `data-overflow-visible`)는
          ★CSS 가 `clip-path:none` 으로 ★해제하는데, ★인라인은 ★CSS 로 ★못 이긴다(!important 없이)
          ⇒ ★그 체크를 켜도 ★그라데이션만 ★잘린 채 남았다.
       ③ ★선택 중 해제(조작 가능하게)도 ★같은 까닭으로 ★안 됐다 — 형제 셋은 `.selected` 에서 푼다.
     ⛔`js/history.js` 는 ★안 건드렸다 — `--sec-clip` 은 ★이미 벗겨진다(위 ① 대조값).
     ★★1020 W2A — ★«무효화»를 ★잰 문 8곳에서 닫았다(아래 섹션 감시자 ★1벌 · 등록은 ★한 점).
       ⛔전엔 이 함수를 부르는 자가 ★전부 «그라데이션 자신» 또는 «로드»였고 섹션 높이 감시자가 ★0건이라
         ★섹션이 자라도(글을 더 쓰면) ★이 값이 그대로 굳었다 — 현빈 「잘린 자리가 안 따라온다 ·
         저장했다 다시 열면 제자리로」(다시 열면 로드가 다시 그려서 맞았던 것이다).
       ★등록은 ★한 점 — 아래 `_gradSecOnAdded`(#canvas MutationObserver · childList·subtree) 뿐이다.
         ⛔이 함수(렌더)는 감시자에 ★안 올린다 — 등록이 둘이면 «한 점을 끄면 전부 빨강»이 안 선다
         (tests/unit/grad-sec-clip-watch.test.mjs S1 · M1). 바인더마다 render 를 덧대는 열거도 안 한다.
       ★잰 문 8곳(S5 W2A 재작업 탐침 · 그 문으로 들어온 뒤 섹션을 키워 기대=실측 · 등록점을 끄면 8곳 전부 빨강 — 그 끈 판은 ×1 잼):
         메뉴 추가 · 저장→재열기(applyProjectData) · 페이지 전환(switchPage) · ⌘z 되돌리기(전체 복원) ·
         섹션 복제 ⌘D(js/editor.js _insertPastedSection) · A/B 사본(js/section-variation.js createVariation) ·
         섹션 템플릿 넣기(js/panels/template-system.js insertTemplate 섹션 갈래) · 섹션 사이 끌어 옮기기 ·
         (같은 섹션 안의 글·Enter·블럭·글꼴·패딩 변화는 위 «메뉴 추가» 문 위의 ResizeObserver 로 잼).
       ⛔안 잰 문(0.9.9 에 잰다): 블럭 붙여넣기의 «성장 추종»(⌘c/⌘v — 붙인 그라데이션이 .section-inner 흐름에 position:static 으로 들어가
         섹션이 그만큼 자라 기대 0 고정 ⇒ 이 자로 못 가름 · ★«넣는 순간 다시 내기»는 잼: 등록점 끄면 300 · 켜면 0) ·
         A/B 셋째 안(addVariation) · 블럭 템플릿 넣기 · 탭(프로젝트) 전환 · 브랜치 전환 · 협업 원격 반영(js/collab/sync.js) ·
         MCP/AI 채우기 · 스코프 되돌리기(_applyScopedDiff) · 프레임·그룹 감싸기.
       ⚠️남은 빈틈: ResizeObserver 는 ★화면에 안 그려지는 창에선 안 온다(js/editor.js:716 의 실측) — 그 창에서
         섹션이 바뀌고 ★그 사이 저장되면 저장본엔 옛 값이 남는다(로드가 다시 그리므로 열면 맞다). */
  const sec = block.closest('.section-block');
  if (sec) {
    const secW = hint?.secW ?? sec.offsetWidth;
    const secH = hint?.secH ?? sec.offsetHeight;
    /* ★cssText 대입(위)이 인라인 스타일을 통째로 갈아치우므로 ★그 뒤에 심어야 한다 —
       순서를 바꾸면 변수가 조용히 사라진다(스티커 sticker-block.js:140 이 같은 함정을 적어 뒀다). */
    gradFill.style.setProperty('--sec-clip', _gradSecClipValue(block, secW, secH));
    /* ⛔여기서 감시자에 올리지 않는다 — 등록은 ★한 점(`_gradSecOnAdded`)뿐이다(아래 ⑵ 머리말). */
  } else {
    gradFill.style.removeProperty('--sec-clip');
  }
}

/* ★섹션 밖 크롭 식 ★한 벌 — 렌더와 감시자가 ★같은 자를 읽는다(⛔둘째 식을 만들지 마라). */
function _gradSecClipValue(block, secW, secH) {
  const width  = parseInt(block.dataset.gradWidth)  || GRADIENT_DEFAULTS.width;
  const height = parseInt(block.dataset.gradHeight) || GRADIENT_DEFAULTS.height;
  const x      = parseInt(block.dataset.x) || 0;
  const y      = parseInt(block.dataset.y) || 0;
  const clipTop    = Math.max(0, -y);
  const clipRight  = Math.max(0, (x + width)  - secW);
  const clipBottom = Math.max(0, (y + height) - secH);
  const clipLeft   = Math.max(0, -x);
  return `inset(${clipTop}px ${clipRight}px ${clipBottom}px ${clipLeft}px)`;
}

/* ══ ★1020 W2A 섹션 감시자 — 섹션 상자가 바뀌면 그 섹션의 그라데이션 클립을 다시 낸다 ══════
   ★왜 ResizeObserver 인가 — 섹션 높이를 바꾸는 «까닭»은 열거가 안 된다(글 추가·Enter·블럭 추가·
     글꼴 크기·섹션 패딩·이미지 로드 …). js/section-height.js ⒝ 가 같은 까닭으로 같은 자를 쓴다.
   ★`box:'border-box'` — 클립 식이 읽는 자가 `offsetHeight`(= border-box)다. 기본값(content-box)으로
     두면 ★섹션 «패딩»만 바뀔 때 감시자가 ★안 운다(패딩은 content-box 를 안 바꾼다).
   ★debounce 없음 — ResizeObserver 는 ★한 프레임에 한 번으로 이미 묶여 온다(타이핑 한 글자마다가
     아니라 «크기가 바뀐 프레임마다»). 그리고 ★같은 값이면 안 쓴다 ⇒ 자동저장 감시자
     (js/io/save-load.js autoSaveObserver — style 쓰기를 편집으로 센다)를 헛되이 깨우지 않는다.
   ★고리 없음 — `--sec-clip`(clip-path)은 레이아웃을 안 바꾼다 ⇒ 쓴 것이 감시자를 다시 부르지 않는다.
   ★떼어진 섹션(undo·페이지 전환으로 갈린 옛 DOM)은 감시에서 내린다 — 새 DOM 은 아래 등록점
     (#canvas MutationObserver)이 «들어오는 순간» 다시 올린다. */
let _gradSecRO = null;
const _gradSecWatched = new WeakSet();

function _refreshGradSecClips(sec) {
  if (!sec.isConnected) {
    _gradSecRO?.unobserve(sec);
    _gradSecWatched.delete(sec);
    return;
  }
  const secW = sec.offsetWidth, secH = sec.offsetHeight;
  sec.querySelectorAll('.gradient-block').forEach((block) => {
    if (block.closest('.section-block') !== sec) return;
    const fill = block.querySelector(':scope > .grad-fill');
    if (!fill) return;
    const v = _gradSecClipValue(block, secW, secH);
    if (fill.style.getPropertyValue('--sec-clip') !== v) fill.style.setProperty('--sec-clip', v);
  });
}

function _watchGradSec(sec) {
  if (typeof ResizeObserver !== 'function' || _gradSecWatched.has(sec)) return;
  if (!_gradSecRO) {
    _gradSecRO = new ResizeObserver((entries) => {
      for (const en of entries) _refreshGradSecClips(en.target);
    });
  }
  _gradSecWatched.add(sec);
  _gradSecRO.observe(sec, { box: 'border-box' });
}

/* ══ ★단일 등록점 — #canvas 에 그라데이션이 «들어오면»(어느 넣기 길이든) 그 섹션을 올리고 바로 다시 낸다 ══
   ★왜 여기 — 1020 W2A 평가 D1(실측): 섹션 복제(⌘D)는 js/editor.js _bindPastedEl 을 지나고 그 길은
     bindBlock 만 불러 render 를 안 탄다 ⇒ 사본 섹션이 감시에 안 올라 사본에 글을 쓰면 ★+300px.
     같은 꼴 둘(js/section-variation.js _bindVariantClone · js/panels/template-system.js _bindInsertedTree).
     ⛔바인더마다 render 를 덧대면 «다음 넣기 길»이 또 빠진다 — DOM 에 «들어온다»는 사실로 받는다.
   ★바로 다시 낸다(_refreshGradSecClips) — 이미 감시 중인 섹션에 «다른 섹션에서 복사한» 그라데이션이
     붙으면 섹션 크기가 안 바뀌어 ResizeObserver 가 안 온다(옛 섹션 높이로 굳은 값이 남는다).
   ★가볍게 — childList 만 본다(우리 쓰기는 style 속성이라 자신을 다시 부르지 않는다). 글자 노드는 건너뛰고,
     요소라도 그라데이션이 없으면 레이아웃을 안 읽는다(타이핑 중 <br>·<div> 는 querySelectorAll 한 번). */
function _gradSecOnAdded(node) {
  if (!node || node.nodeType !== 1 || !node.classList) return;
  const grads = node.classList.contains('gradient-block') ? [node] : [...node.querySelectorAll('.gradient-block')];
  if (!grads.length) return;
  const secs = new Set();
  for (const g of grads) { const s = g.closest('.section-block'); if (s) secs.add(s); }
  secs.forEach((s) => { _watchGradSec(s); _refreshGradSecClips(s); });
}

function _initGradSecInsertWatch() {
  const canvasEl = typeof document !== 'undefined' && typeof document.getElementById === 'function'
    ? document.getElementById('canvas') : null;
  if (!canvasEl || typeof MutationObserver !== 'function' || canvasEl.__gradSecMo) return;
  const mo = new MutationObserver((muts) => {
    for (const m of muts) for (const n of m.addedNodes) _gradSecOnAdded(n);
  });
  mo.observe(canvasEl, { childList: true, subtree: true });
  canvasEl.__gradSecMo = mo;
  _gradSecOnAdded(canvasEl);   // 이미 있는 것(모듈이 늦게 실린 경우)
}
_initGradSecInsertWatch();

function makeGradientBlock(opts = {}) {
  const block = document.createElement('div');
  block.className = 'gradient-block';
  block.id = genId('grad');
  block.dataset.type           = 'gradient';
  block.dataset.gradStyle      = opts.style       ?? GRADIENT_DEFAULTS.style;
  block.dataset.gradDirection  = opts.direction   ?? GRADIENT_DEFAULTS.direction;
  block.dataset.gradStart      = opts.startColor  ?? GRADIENT_DEFAULTS.startColor;
  block.dataset.gradEnd        = opts.endColor    ?? GRADIENT_DEFAULTS.endColor;
  block.dataset.gradStartAlpha = String(opts.startAlpha ?? GRADIENT_DEFAULTS.startAlpha);
  block.dataset.gradEndAlpha   = String(opts.endAlpha   ?? GRADIENT_DEFAULTS.endAlpha);
  block.dataset.gradWidth      = String(opts.width  ?? GRADIENT_DEFAULTS.width);
  block.dataset.gradHeight     = String(opts.height ?? GRADIENT_DEFAULTS.height);
  block.dataset.x              = String(opts.x ?? GRADIENT_DEFAULTS.x);
  block.dataset.y              = String(opts.y ?? GRADIENT_DEFAULTS.y);
  block.dataset.layerName      = opts.layerName || 'Gradient';
  renderGradientBlock(block);
  return block;
}

function addGradientBlock(opts = {}) {
  /* 섹션 미선택 = «다른 추가 입구 40곳과 똑같이» 막는다 — 경고만, 아무것도 안 만든다.
     ★이력: B12 는 「먹통처럼 보이지 않게」 마지막 섹션 폴백을 뒀었다. 2026-09-21 무선택
       전수 실측(41입구)에서 «이 입구만» delta=1 이었고, 화면 아래쪽 섹션에 생기니 오히려
       「아무 일도 안 일어났다」로 읽혔다. 현빈 결정(2026-09-21): 한 벌로 맞춘다.
       sticker 가 먼저 같은 이유로 폴백을 걷어낸 선례다(sticker-block.js U6(b)).
     ⛔마지막-섹션 폴백을 되살리지 마라. 회귀: tests/unit/block-add-noselection-hint.test.mjs T3.
     ※getSelectedSection 은 «블럭만 고른» 경우도 그 블럭의 섹션을 돌려준다(editor.js:3464)
       — 그래서 토스트 문구(「섹션 또는 블록을 먼저 선택하세요」)와 동작이 어긋나지 않는다. */
  const sec = window.getSelectedSection?.();
  if (!sec) { window.showNoSelectionHint?.(); return; }
  window.pushHistory?.('그라데이션 추가');
  /* ★1017t1 G1 — 같은 자리 겹침 방지. «스티커의 cascade 와 같은 어휘」(24px 씩, 8칸 주기).
     선례 둘: js/blocks/zoom-block.js:461-464 · js/blocks/sticker-block.js:775-789.
     ⚠️기본 폭 860 = 섹션 폭이라 _clampToSection(js/sticker-select.js:28-39) 이 x 를 0 으로
       되클램프한다 — ★x 오프셋은 «일부러» 죽는다. 보이는 분리는 y 뿐이다.
     ⛔x 를 살리려 clamp 를 빼지 마라(fill clipPath 가 좌측에 빈 띠를 만든다).
     회귀: tests/dom/grad-g1g7-cascade-stop.dom.spec.js G1-a/G1-n. */
  if (opts.x == null && opts.y == null) {
    const n = sec.querySelectorAll('.gradient-block').length;
    const cx = 40 + (n % 8) * 24, cy = 40 + (n % 8) * 24;
    const bw = Number(opts.width ?? GRADIENT_DEFAULTS.width);
    const bh = Number(opts.height ?? GRADIENT_DEFAULTS.height);
    const [qx, qy] = window._clampToSection?.(cx, cy, sec, bw, bh) || [cx, cy];
    opts = { ...opts, x: qx, y: qy };
  }
  /* ★1017t1 G2 — 「추가한 블럭을 안 고른다」는 2026-09-22 에 ★이미 닫혔다.
     ⛔여기에 selectBlock 을 더하지 마라(두 벌이 된다).
     부르는 자: js/insert-history.js:91 MATCH(=addGradientBlock) → js/insert-select.js:114
       window.selectBlock → js/block-edit.js getBlockById → js/panel-dispatch.js:103
       _selectGradient(손잡이·패널 둘 다 그 안에서).
     게이트: tests/dom/panel-route-on-add.dom.spec.js:128 ·
       tests/dom/insert-select-follows.dom.spec.js · tests/unit/insert-select-roster.test.mjs */
  const block = makeGradientBlock(opts);
  sec.appendChild(block); // 섹션 직접 자식 (absolute → 섹션 기준)
  /* ★1020 W2A — makeGradientBlock 의 렌더는 ★붙이기 «전»이라 섹션이 없어 `--sec-clip` 을 지운다(추가 직후 '').
     ⛔여기서 다시 렌더하지 않는다 — 붙이는 순간 단일 등록점(_gradSecOnAdded)이 섹션 기준으로 다시 낸다(W0). */
  window.bindGradientSelect?.(block);
  window.scheduleAutoSave?.();
  window.buildLayerPanel?.();
  return block;
}

// ── 수정 ──────────────────────────────────────────────────────────────────────
// PM의 update_gradient_block(MCP) → main(_invokeRendererUpdateGradientBlock) → 여기.
// banner02 updateBanner02Block 패턴 미러: NOT_FOUND/INVALID 검증 + before snapshot + pushHistory +
//   dataset partial write + renderGradientBlock 재렌더 + showGradientProperties 갱신 + scheduleAutoSave.
// 지원 필드 (data-* 매핑):
//   - style → gradStyle (linear|radial)
//   - direction → gradDirection (8방향, linear 전용)
//   - startColor → gradStart (#RRGGBB만 — _hexToRgba 안전성)
//   - endColor   → gradEnd   (#RRGGBB만)
//   - startAlpha → gradStartAlpha (0~1 float)
//   - endAlpha   → gradEndAlpha   (0~1 float)
//   - width  → gradWidth  (200~1200 px)
//   - height → gradHeight (50~1500 px)
//   - x, y (섹션 기준 좌표, -4000~4000)
//   - layerName (≤100)
function updateGradientBlock(blockId, partial = {}) {
  if (!blockId) return { ok: false, code: 'NOT_FOUND', message: 'blockId required' };
  const block = document.getElementById(String(blockId));
  if (!block || !block.classList.contains('gradient-block') || block.dataset.type !== 'gradient') {
    return { ok: false, code: 'NOT_FOUND', message: `gradient-block not found: ${blockId}` };
  }
  if (partial == null || typeof partial !== 'object') {
    return { ok: false, code: 'INVALID', message: 'partial must be object' };
  }
  if (Object.keys(partial).length === 0) {
    return { ok: false, code: 'INVALID', message: 'partial is empty — provide at least one field' };
  }

  // ── 동시수정 가드 (USER_BUSY) ───────────────────────────────────────────────
  // banner02 패턴: contenteditable / INPUT / TEXTAREA 활성 + 최근 키입력 1.5s 이내면 후퇴.
  try {
    const ae = document.activeElement;
    const userEditing = !!(ae && (
      ae.isContentEditable || ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA'
    ) && !(ae.closest && ae.closest('#claude-pm-terminal-panel, #claude-pm-terminal-mini, .xterm, .xterm-helper-textarea')));
    const recentKey = (Date.now() - (window._lastUserKeydown || 0)) < 1500;
    if (userEditing || recentKey) {
      return { ok: false, code: 'USER_BUSY', message: '사용자가 편집 중입니다. 잠시 후 다시 시도하세요.', retryAfter: 2000, detail: { userEditing, recentKey } };
    }
  } catch (_) { /* guard 실패는 무시 */ }

  // ── helpers ────────────────────────────────────────────────────────────────
  const _HEX6 = /^#[0-9a-fA-F]{6}$/;
  const _STYLES = ['linear', 'radial'];
  const _DIRS = ['to bottom','to top','to right','to left','to bottom right','to bottom left','to top right','to top left'];

  // before snapshot (mutate 전, pushHistory 전)
  const before = { ...block.dataset };

  // ── 1) 값 검증 (mutate 전 모두 검사 → 일부 fail시 부분반영 방지) ───────────
  const writes = {}; // datasetKey -> stringValue
  const applied = {};

  if (partial.style !== undefined) {
    if (!_STYLES.includes(partial.style)) {
      return { ok: false, code: 'INVALID', message: `invalid style: ${partial.style}. allowed: ${_STYLES.join('|')}` };
    }
    writes.gradStyle = String(partial.style);
    applied.style = partial.style;
  }
  if (partial.direction !== undefined) {
    if (!_DIRS.includes(partial.direction)) {
      return { ok: false, code: 'INVALID', message: `invalid direction: ${partial.direction}. allowed: ${_DIRS.join('|')}` };
    }
    writes.gradDirection = String(partial.direction);
    applied.direction = partial.direction;
  }
  if (partial.startColor !== undefined) {
    if (typeof partial.startColor !== 'string' || !_HEX6.test(partial.startColor)) {
      return { ok: false, code: 'INVALID', message: `startColor must be #RRGGBB hex (got: ${partial.startColor})` };
    }
    writes.gradStart = partial.startColor;
    applied.startColor = partial.startColor;
  }
  if (partial.endColor !== undefined) {
    if (typeof partial.endColor !== 'string' || !_HEX6.test(partial.endColor)) {
      return { ok: false, code: 'INVALID', message: `endColor must be #RRGGBB hex (got: ${partial.endColor})` };
    }
    writes.gradEnd = partial.endColor;
    applied.endColor = partial.endColor;
  }
  if (partial.startAlpha !== undefined) {
    const a = Number(partial.startAlpha);
    if (!Number.isFinite(a) || a < 0 || a > 1) {
      return { ok: false, code: 'INVALID', message: `startAlpha must be number 0~1 (got: ${partial.startAlpha})` };
    }
    writes.gradStartAlpha = String(a);
    applied.startAlpha = a;
  }
  if (partial.endAlpha !== undefined) {
    const a = Number(partial.endAlpha);
    if (!Number.isFinite(a) || a < 0 || a > 1) {
      return { ok: false, code: 'INVALID', message: `endAlpha must be number 0~1 (got: ${partial.endAlpha})` };
    }
    writes.gradEndAlpha = String(a);
    applied.endAlpha = a;
  }
  if (partial.width !== undefined) {
    const n = Number(partial.width);
    if (!Number.isFinite(n) || n < 200 || n > 1200) {
      return { ok: false, code: 'INVALID', message: `width must be 200~1200 (got: ${partial.width})` };
    }
    writes.gradWidth = String(Math.round(n));
    applied.width = Math.round(n);
  }
  if (partial.height !== undefined) {
    const n = Number(partial.height);
    if (!Number.isFinite(n) || n < 50 || n > 1500) {
      return { ok: false, code: 'INVALID', message: `height must be 50~1500 (got: ${partial.height})` };
    }
    writes.gradHeight = String(Math.round(n));
    applied.height = Math.round(n);
  }
  if (partial.x !== undefined) {
    const n = Number(partial.x);
    if (!Number.isFinite(n) || n < -4000 || n > 4000) {
      return { ok: false, code: 'INVALID', message: `x must be -4000~4000 (got: ${partial.x})` };
    }
    writes.x = String(Math.round(n));
    applied.x = Math.round(n);
  }
  if (partial.y !== undefined) {
    const n = Number(partial.y);
    if (!Number.isFinite(n) || n < -4000 || n > 4000) {
      return { ok: false, code: 'INVALID', message: `y must be -4000~4000 (got: ${partial.y})` };
    }
    writes.y = String(Math.round(n));
    applied.y = Math.round(n);
  }
  if (partial.layerName !== undefined && partial.layerName !== null) {
    if (typeof partial.layerName !== 'string') {
      return { ok: false, code: 'INVALID', message: 'layerName must be string' };
    }
    if ([...partial.layerName].length > 100) {
      return { ok: false, code: 'INVALID', message: 'layerName too long (>100)' };
    }
    writes.layerName = partial.layerName;
    applied.layerName = partial.layerName;
  }

  if (Object.keys(writes).length === 0) {
    return { ok: false, code: 'INVALID', message: 'no recognized fields in partial' };
  }

  // ── 2) pushHistory (변경 전 1회) ──────────────────────────────────────────
  try { window.pushHistory?.('그라데이션 수정'); } catch (_) {}

  // ── 3) dataset commit ─────────────────────────────────────────────────────
  for (const [k, v] of Object.entries(writes)) {
    block.dataset[k] = v;
  }

  // B24: 레거시 색/alpha 필드가 MCP로 들어오면 gradStops 정본을 비워 2-stop 레거시로 폴백(불일치 방지).
  if (['gradStart','gradEnd','gradStartAlpha','gradEndAlpha'].some(k => k in writes)) {
    delete block.dataset.gradStops;
  }

  // ── 4) 재렌더 ─────────────────────────────────────────────────────────────
  try {
    (window.renderGradientBlock || renderGradientBlock)(block);
  } catch (e) {
    return { ok: false, code: 'RENDER_ERROR', message: e.message };
  }

  // ── 5) 우측 패널 갱신 (선택 상태일 때만 — prop-gradient.js가 ID로 input 참조) ──
  if (block.classList.contains('selected')) {
    try { window.showGradientProperties?.(block); } catch (_) {}
  }

  // ── 6) 레이어 패널 (layerName 변경 가능성) ────────────────────────────────
  try { window.buildLayerPanel?.(); } catch (_) {}

  // ── 7) autosave ───────────────────────────────────────────────────────────
  try { window.scheduleAutoSave?.(); } catch (_) {}

  const after = { ...block.dataset };
  return { ok: true, blockId, before, applied, after };
}

// ── window 노출 ────────────────────────────────────────────────────────────
window.makeGradientBlock   = makeGradientBlock;
window.addGradientBlock    = addGradientBlock;
window.renderGradientBlock = renderGradientBlock;
window.updateGradientBlock = updateGradientBlock;
window.resolveGradientStops = _resolveStops;

export { makeGradientBlock, addGradientBlock, updateGradientBlock, renderGradientBlock, _resolveStops, GRADIENT_DEFAULTS };
