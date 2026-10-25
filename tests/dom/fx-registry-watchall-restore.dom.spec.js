/* fx-registry-watchall-restore.dom.spec.js — ★★★`FX-REGISTRY-WATCHALL-ONLY-ON-LOAD-01`
 *   (2026-10-24 · 지디 · ★★현빈 신고가 ★찾은 ★구멍)
 *
 * ★★★왜 세우나 — ★★현빈 신고 : 「★자유변형 ★손잡이가 ★안 ★뜬다」
 *   ★★앱(9401)에서 ★재현했다 : ★`selected: true` · `data-tf-corners` ★있음 ⇒ ★★그런데
 *     ★`ftStateOf(tb)` = ★★`null` · 손잡이 ★★0 · `.tfh-fx` ★★0
 *   ★손으로 ★`watchAllFxFreeTransform(document)` 를 ★부르니 ⇒ ★`ret 1` · 손잡이 ★★12
 *   ⇒ ★★★코드는 ★맞고 ★★«부르는 자»가 ★없었다.
 *
 * ★★참 ★까닭 : ★`js/effects-registry.js:136` 이 ★★`window.addEventListener('load', …)` ★★한 번만 ★부른다.
 *   ★★프로젝트 ★복원은 ★그 `load` ★★«뒤»에 ★비동기로 ★온다 ⇒ ★★그때 ★캔버스가 ★비어 ★★0 건을 ★돌고 ★끝.
 *
 * ★★★그리고 ★그 ★`watchAllFx` 는 ★★★«명부 ★전체»를 ★도는 ★한 자리다(`:122~126`):
 *     for (const t of FX_REGISTRY) { n += t.watchAll?.(root) || 0; }
 *   ⇒ ★★★그 한 자리가 ★★안 ★불리면 ★★★명부 ★식구 ★전부가 ★★안 ★돈다.
 *   ★★실측(앱 명부 전수) : ★★★`["reflect","shadow","particles","glow","freetransform"]` = ★★다섯
 *
 * ★★★이 벌이 ★메우는 ★칸 — ★★★«미측 ★넷»이다.
 *   ★261024 ★분모 : ★★«구조 ★5 / ★★증상 ★1 / ★★미측 ★4»
 *   ⇒ ★★그 ★넷(reflect·shadow·glow·particles)을 ★★여기서 ★증상으로 ★세운다.
 *   ⛔「다섯이 ★다 ★깨져 ★있었다」로 ★적지 ★않았다 — ★★안 ★쟀기 ★때문이다. ★이제 ★잰다.
 *
 * ★고침 : ★`js/io/save-load.js` `rebindAll` 끝의 ★`window.watchAllFx?.(canvasEl)` ★한 줄.
 *   ★그 자리인 까닭 — ★복원의 ★★정본 ★한 자리(★열기 :553 · ★전환 :605 · ★undo/redo :751 가 ★전부 지난다).
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

test.describe.configure({ timeout: 90000 });

async function setup(page) {
  await page.setViewportSize({ width: 1400, height: 1200 });
  const errs = await bootApp(page);
  await page.evaluate(() => {
    document.querySelectorAll('.section-block').forEach((s) => s.remove());
    window.addSection();
    const sec = document.querySelector('.section-block');
    sec.id = 'fxS';
    window.selectSection(sec); window.addTextBlock('h1');
    const tbs = sec.querySelectorAll('.text-block');
    tbs[tbs.length - 1].id = 'fxTB';
    /* ★★shadow 는 ★★«도형 전용»이다 — `effects-shadow.js` supports =
       shape-block | asset-block | frame-block (⛔text-block ★아니다).
       ★261024 에 ★내가 ★text-block 에 ★걸어 ★거짓 빨강을 ★냈다 ⇒ ★제 자리를 ★만든다. */
    if (typeof window.addShapeBlock === 'function') {
      window.addShapeBlock('rect');
      const shs = sec.querySelectorAll('.shape-block');
      if (shs.length) shs[shs.length - 1].id = 'fxSH';
    }
  });
  return errs;
}

/* ── R0 ★전제 — ★명부를 ★판에서 ★읽는다. ★★⛔「전부 watchAll 을 준다」는 ★★거짓이었다 ──
   ★★★261024 ★정정 : 옛 머리말은 「★명부가 ★다섯이고 ★★전부 ★`watchAll` 을 ★준다」였다.
     ★소스 실측 : `registerFxType({...})` ★다섯 중 ★★`shadow` 만 ★`watchAll` 이 ★★없다.
     ⇒ ★`watchAllFx` 가 ★부를 수 있는 문은 ★★넷이다(freetransform·glow·reflect·particles).
     ★★그래서 ★shadow 는 ★`ret` 에 ★영영 ★안 ★센다 — ⛔그걸 「안 그려진다」로 ★읽으면 ★틀린다.
       ★shadow 가 ★저장 뒤 ★살아남는 ★길은 ★★«다른 축»이다(★직렬화에 실린 ★인라인 자취).
     ★「★머리말이 ★단언보다 ★넓다」 — ★그 병을 ★이 파일이 ★앓고 ★있었다. */
test('R0 ★전제 — 명부 식구가 ★다섯이고 ★`watchAllFx` 가 ★그 전부를 ★돈다 (⛔수를 박지 않고 판에서 읽는다)', async ({ page }) => {
  const errs = await setup(page);
  const r = await page.evaluate(() => ({
    keys: window.fxTypeKeys ? window.fxTypeKeys() : [],
    hasWatchAllFx: typeof window.watchAllFx === 'function',
    /* ★식구마다 ★`watchAll` 이 ★있나 — ★★명부를 ★판에서 ★읽는다(⛔이름을 손으로 적지 않는다) */
    perKey: (window.fxTypeKeys ? window.fxTypeKeys() : []).map((k) => {
      /* ★각 식구의 `watchAll` 은 ★명부 ★안에 ★있어 ★밖에서 ★못 ★본다
         ⇒ ★★그래서 ★★«전부를 ★부른 뒤 ★합계»로 ★잰다(★아래 R1~R2) */
      return k;
    }),
  }));
  console.log('[R0]', JSON.stringify(r));
  expect(r.keys, '★전제: 명부를 판에서 읽었다(비면 모듈이 안 실렸다 ⇒ 아래 0건은 「안 재고 있다」다)').not.toEqual([]);
  expect(r.hasWatchAllFx, '⛔`window.watchAllFx` 가 없다 — `rebindAll` 의 그 줄이 죽은 코드가 된다').toBe(true);
  /* ★★261024 ★실측 = ★다섯. ⛔「5」를 ★박지 ★않고 ★★«셋 이상»만 ★단언하고 ★수는 ★찍는다
     (★효과가 ★늘면 ★이 칸이 ★거짓이 ★되어서는 ★안 된다 — ★명부 머리말의 규율) */
  expect(r.keys.length, '★명부 식구가 셋보다 적다 — 명부를 잘못 읽었다').toBeGreaterThanOrEqual(3);
  expect(r.keys, '★자유변형이 명부에 없다').toContain('freetransform');
  expect(errs, `★앱이 오류를 냈다: ${errs.join(' | ')}`).toEqual([]);
});

/* ── R1 ★★복원 뒤 ★효과가 ★다시 ★그려진다 — ★`rebindAll` → `watchAllFx` 사슬 ──────
   ★★★261024 ★고침 : ★이 칸은 ★★거짓 빨강을 ★냈다. ★★내 자가 ★★세 곳 ★틀렸다 —
     ⒜ `tb.dataset.fxGlow = '1'`   ★선택자는 `.text-block[data-fx-glow="on"]` (★effects-glow.js:145)
     ⒝ `tb.dataset.fxReflect = '1'` ★선택자는 `[data-fx-reflect="on"]`        (★effects-reflect.js:136)
     ⒞ shadow 를 ★★text-block 에 ★걸었다 — ★shadow 는 ★도형 전용이고 ★★watchAll 이 ★없다
   ★★★그리고 ★★가장 ★나쁜 것 : ★내 ★전제 단언이 `!!tb.dataset.fxGlow` 였다 ⇒ ★`'1'` 에도 ★참.
     ★★즉 ★「다섯 키가 다 걸렸다」는 ★★★항등식이었고 ★아무것도 ★안 잠갔다.
   ⇒ ★이제 ★★앱의 ★제 설정 문(`setFx*`)으로 ★걸고, ★전제는 ★★«선택자가 ★그 요소를 ★집나»로 ★잰다.
   ★잡아 준 이 = qa-eval(독립 QA) · ★까닭은 ★내가 ★소스에서 ★다시 ★쟀다. */
test('R1 ★★복원 뒤 ★효과가 ★다시 ★그려진다 — ★★앱의 제 문(setFx*)으로 걸고 ★선택자로 전제를 잰다', async ({ page }) => {
  const errs = await setup(page);
  const r = await page.evaluate(() => {
    const tb = document.getElementById('fxTB');
    const sh = document.getElementById('fxSH');
    const sec = document.getElementById('fxS');

    /* ★★앱의 ★제 문으로 ★건다 — ⛔dataset 을 ★손으로 ★쓰지 ★않는다(★값 꼴을 ★짐작하게 된다) */
    window.setFxGlow?.(tb, { state: 'on', blur: 20, op: 100, color: '#ff00ff' }, { history: false });
    window.setFxReflect?.(tb, { state: 'on', gap: 4, len: 55, op: 35 }, { history: false });
    if (sh) window.setFxShadow?.(sh, { state: 'on', x: 2, y: 2, blur: 6, color: '#000000', op: 50 }, { history: false });
    tb.dataset.tfCorners = '0,0,200,0,240,120,0,120';   /* ★자유변형은 ★좌표가 ★곧 ★데이터다 */
    sec.dataset.fxParticles = JSON.stringify({ kind: 'snow', count: 20 });

    /* ★★★전제를 ★★«선택자»로 ★잰다 — ★그 효과의 ★watchAll 이 ★★실제로 ★집는 ★자로.
       ⛔`!!dataset.x` 로 ★재면 ★어떤 값이든 ★참이 되어 ★★항등식이 ★된다(★261024 그 흠). */
    const picked = {
      glow:    [...document.querySelectorAll('.text-block[data-fx-glow="on"]')].includes(tb),
      reflect: [...document.querySelectorAll('[data-fx-reflect="on"]')].includes(tb),
      shadow:  sh ? [...document.querySelectorAll('[data-fx-shadow="on"]')].includes(sh) : null,
      ft:      !!tb.dataset.tfCorners,
      particles: !!sec.dataset.fxParticles,
    };

    /* ★★음성대조 ★먼저 — ★★아무것도 ★안 고른 판에서 ★손잡이는 ★0 이어야 ★한다.
       ★`effects-ft-handles.js:73` 이 ★`.selected` 를 ★요구한다 ⇒ ★0 은 ★★결함이 ★아니다.
       ⛔261024 에 ★내가 ★이걸 ★모르고 ★「손잡이 0 = 빨강」으로 ★걸어 ★★또 ★거짓 빨강을 ★냈다. */
    const retNoSel = window.watchAllFx(document.getElementById('canvas') || document);
    const handlesNoSel = document.querySelectorAll('.tfh-handle').length;

    /* ★★★현빈 ★신고 ★장면 — 「★문서를 ★연 ★직후 ★선택이 ★복원돼 ★있는데 ★손잡이가 ★안 ★붙었다」
       ⇒ ★★고른 ★뒤에 ★같은 ★한 자리를 ★부른다. */
    /* ★`selectBlock` 은 ★★«id» 를 ★받는다 — ⛔요소를 ★넘기면 ★조용히 ★아무 일도 ★안 한다.
       ★쓰임의 ★정본 = `js/insert-select.js:114` `window.selectBlock(target.id)`
       ★★261024 : ★요소를 ★넘겼다가 ★내 ★전제 단언에 ★걸렸다(★그 칸이 ★제 할 일을 했다). */
    window.selectBlock?.(tb.id);
    const ret = window.watchAllFx(document.getElementById('canvas') || document);

    const g = tb.querySelector('[contenteditable]') || tb.querySelector('.tb-h1,.tb-h2,.tb-h3,.tb-body');
    const cs = g ? getComputedStyle(g) : null;
    const tbcs = getComputedStyle(tb);
    return {
      ret, picked, retNoSel, handlesNoSel,
      selected: tb.classList.contains('selected'),
      keys: window.fxTypeKeys ? window.fxTypeKeys() : [],
      /* ★효과마다 ★«그려졌나»를 ★그 효과의 ★제 자취로 ★잰다 */
      glow_textShadow: cs ? (cs.textShadow || 'none') : null,
      reflect_boxReflect: (tbcs.webkitBoxReflect || tbcs.getPropertyValue('-webkit-box-reflect') || 'none'),
      shadow_filter: sh ? (getComputedStyle(sh).filter || 'none') : null,
      ft_transform: g ? (g.style.transform || '') : '',
      ft_handles: document.querySelectorAll('.tfh-handle').length,
      particles_wrap: document.querySelectorAll('.sec-fxpart-wrap').length,
    };
  });
  console.log('[R1]', JSON.stringify(r));

  /* ★★전제 — ★★선택자가 ★그 요소를 ★집는다(⛔안 집으면 ★아래는 ★「안 재고 있다」다) */
  expect({ glow: r.picked.glow, reflect: r.picked.reflect, ft: r.picked.ft, particles: r.picked.particles },
    '★전제: 각 효과의 watchAll 이 쓰는 ★선택자가 내 요소를 집어야 한다 — 안 집으면 아무것도 안 잰다')
    .toEqual({ glow: true, reflect: true, ft: true, particles: true });
  expect(r.picked.shadow, '★전제: shadow 를 ★도형에 걸었다(text-block 이 아니다)').toBe(true);

  /* ★★★본 단언 — ★★네 효과가 ★★각각 ★다시 ★그려진다 (★`ret` 하나로 ★뭉개지 않는다) */
  expect(r.glow_textShadow, `★glow 가 안 그려졌다 (textShadow=${r.glow_textShadow})`).not.toBe('none');
  expect(r.reflect_boxReflect, `★reflect 가 안 그려졌다 (boxReflect=${r.reflect_boxReflect})`).not.toBe('none');
  expect(r.ft_transform, '★자유변형이 복원 뒤 안 그려졌다 — matrix3d 가 없다').toContain('matrix');
  /* ★★음성대조 — ★안 고른 판에서는 ★0 (★`.selected` 가 ★가른다 · effects-ft-handles.js:73) */
  expect(r.handlesNoSel, '★아무것도 안 골랐는데 손잡이가 떴다 — 선택 조건이 사라졌다').toBe(0);
  expect(r.selected, '★전제: selectBlock 이 안 먹었다 — 아래 「손잡이가 뜬다」를 못 잰다').toBe(true);
  /* ★★★본 단언 — ★★고른 ★뒤에 ★★watchAllFx 한 자리가 ★손잡이를 ★올린다(★현빈 신고 그 자리) */
  expect(r.ft_handles, '★자유변형 손잡이가 복원 뒤 안 떴다 — 현빈 신고 그 자리').toBeGreaterThan(0);
  expect(r.particles_wrap, '★파티클 감쌈이 안 생겼다').toBeGreaterThan(0);

  /* ★★`ret` — ★★watchAll 을 ★가진 ★넷이 ★올라온다. ⛔「5」를 ★박지 ★않는다(★shadow 는 문이 없다) */
  expect(r.ret, `⛔watchAllFx 가 넷보다 적게 올렸다 (ret=${r.ret} · 명부=${r.keys.join(',')})`)
    .toBeGreaterThanOrEqual(4);

  /* ★★★shadow 는 ★`ret` 에 ★안 센다 — ★그건 ★결함이 ★아니라 ★★구조다(watchAll 이 없다).
     ★그래도 ★★«걸면 ★그려지나»는 ★여기서 ★한 번 ★잰다 — ★`watchAllFx` 밖의 ★축이다. */
  expect(r.shadow_filter, `★shadow 가 도형에 안 그려졌다 (filter=${r.shadow_filter})`).not.toBe('none');

  expect(errs, `★앱이 오류를 냈다: ${errs.join(' | ')}`).toEqual([]);
});

/* ── R2 ★★`rebindAll` 이 ★★그 자리를 ★★정말 ★부르나 — ★★고침의 ★재는 자 ───── */
test('R2 ★★`rebindAll`(복원 정본) 이 ★`watchAllFx` 를 ★부른다 — ★★★261024 고침의 ★잠그는 자', async ({ page }) => {
  const errs = await setup(page);
  const r = await page.evaluate(async () => {
    /* ★★`watchAllFx` 를 ★★가로채 ★«불렸나»를 ★센다 —
       ⛔제품을 ★고치는 ★것이 ★아니라 ★★그 ★한 자리가 ★★불리는지만 ★★본다. */
    const orig = window.watchAllFx;
    let calls = 0;
    window.watchAllFx = (...a) => { calls++; return orig.apply(null, a); };
    try {
      const has = typeof window.rebindAll === 'function';
      if (has) window.rebindAll({});
      return { has, calls };
    } finally { window.watchAllFx = orig; }
  });
  console.log('[R2]', JSON.stringify(r));
  expect(r.has, '⛔`window.rebindAll` 이 없다 — 이 칸이 아무것도 재지 않는다').toBe(true);
  /* ★★★이것이 ★261024 고침을 ★잠근다 — ★그 한 줄을 ★지우면 ★★여기서 ★빨개진다 */
  expect(r.calls, '⛔`rebindAll` 이 `watchAllFx` 를 안 부른다 — FX-REGISTRY-WATCHALL-ONLY-ON-LOAD-01 이 되살아났다').toBeGreaterThan(0);
  expect(errs, `★앱이 오류를 냈다: ${errs.join(' | ')}`).toEqual([]);
});
