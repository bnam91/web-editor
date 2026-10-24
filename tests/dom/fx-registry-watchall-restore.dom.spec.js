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
  });
  return errs;
}

/* ── R0 ★전제 — ★명부가 ★★다섯이고 ★★전부 ★`watchAll` 을 ★준다 ───────────── */
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

/* ── R1 ★★★미측 넷을 ★증상으로 ★세운다 — ★효과를 ★걸고 ★★복원을 ★흉내 낸다 ── */
test('R1 ★★★복원 뒤 ★효과가 ★다시 ★그려진다 — ★`rebindAll` → `watchAllFx` 사슬 (★★미측 넷을 메운다)', async ({ page }) => {
  const errs = await setup(page);
  const r = await page.evaluate(() => {
    const tb = document.getElementById('fxTB');
    /* ★★효과 ★넷을 ★★데이터로 ★건다 — ★★그것이 ★★저장본에 ★사는 ★꼴이다(dataset 키).
       ⛔UI 로 ★걸지 ★않는 ★까닭 : ★이 칸이 ★재는 것은 ★★«복원 뒤 ★다시 그리나»이고
         ★★«UI 로 ★걸 수 ★있나»는 ★★다른 칸이다(★섞으면 ★무엇이 ★깨졌는지 ★안 ★갈린다). */
    tb.dataset.fxGlow = '1'; tb.dataset.fxGlowBlur = '20'; tb.dataset.fxGlowOp = '100'; tb.dataset.fxGlowColor = '#ff00ff';
    tb.dataset.fxReflect = '1'; tb.dataset.fxReflectGap = '4'; tb.dataset.fxReflectLen = '55'; tb.dataset.fxReflectOp = '35';
    tb.dataset.fxShadow = '1'; tb.dataset.fxShadowX = '2'; tb.dataset.fxShadowY = '2';
    tb.dataset.fxShadowBlur = '6'; tb.dataset.fxShadowColor = '#000000'; tb.dataset.fxShadowOp = '50';
    tb.dataset.tfCorners = '0,0,200,0,240,120,0,120';
    const sec = document.getElementById('fxS');
    sec.dataset.fxParticles = JSON.stringify({ kind: 'snow', count: 20 });

    /* ★★★한 자리를 ★부른다 — ★그것이 ★★명부 ★전체를 ★돈다 */
    const ret = window.watchAllFx(document.getElementById('canvas') || document);

    const g = tb.querySelector('[contenteditable]') || tb.querySelector('.tb-h1,.tb-h2,.tb-h3,.tb-body');
    return {
      ret,
      /* ★★★효과마다 ★«그려졌나»를 ★★그 효과의 ★제 자취로 ★잰다 */
      glow_textShadow: g ? (getComputedStyle(g).textShadow || '').slice(0, 60) : null,
      shadow_filter: g ? (getComputedStyle(g).textShadow || '').indexOf('rgb') >= 0 : null,
      ft_transform: g ? (g.style.transform || '').slice(0, 24) : null,
      ft_handles: document.querySelectorAll('.tfh-handle').length,
      reflect_el: document.querySelectorAll('[class*="fxrefl"],[class*="fx-refl"],.fx-reflect').length,
      particles_wrap: document.querySelectorAll('.sec-fxpart-wrap').length,
      /* ★★음성대조 — ★★이 네 키가 ★★정말 ★걸렸나(★안 걸렸으면 ★위 0 은 ★「안 쟀다」다) */
      keysOn: { glow: !!tb.dataset.fxGlow, reflect: !!tb.dataset.fxReflect,
                shadow: !!tb.dataset.fxShadow, ft: !!tb.dataset.tfCorners,
                particles: !!sec.dataset.fxParticles },
    };
  });
  console.log('[R1]', JSON.stringify(r));
  /* ★★전제 — ★다섯 키가 ★다 ★걸렸다(⛔안 걸렸으면 ★아래가 ★아무것도 ★안 잰다) */
  expect(r.keysOn, '★전제: 다섯 키가 다 걸려야 이 칸이 무엇을 재는지 분명하다')
    .toEqual({ glow: true, reflect: true, shadow: true, ft: true, particles: true });
  /* ★★★`watchAllFx` 한 자리가 ★★하나 이상을 ★올렸다 = ★★★사슬이 ★산다 */
  expect(r.ret, '⛔`watchAllFx` 가 0 을 돌려준다 — 명부를 안 돌거나 식구가 다 거절했다').toBeGreaterThan(0);
  /* ★★자유변형 — ★★★손잡이가 ★★복원 뒤 ★떠야 ★한다(★현빈 신고 그 자리) */
  expect(r.ft_transform, '⛔자유변형이 복원 뒤 안 그려졌다 — matrix3d 가 없다').toContain('matrix');
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
