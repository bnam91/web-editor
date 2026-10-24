/* ft-restore-remeasures-at-other-width.dom.spec.js
 *   ★★`FT-RESTORE-REMEASURES-AT-OTHER-WIDTH-01` — ★다시 열면 글자를 ★«다른 폭»에서 재서
 *   ★여러 줄 글자의 ★그림이 ★저장 전과 ★갈린다. (2026-10-24 신설 · ★적대적 ⒠ ★C3)
 *
 * ★★★이 파일은 ★«고침»이 ★아니다 — ★★미해결을 ★«수»로 ★박아 ★명부에 올린다.
 *   ⇒ ★누가 고치면 ★이 칸들이 ★빨개지고, ★그때 ★판정을 ★다시 하게 된다.
 *   ★「★흔들리는 것에 ★이름 대신 ★수를 붙여라」· ★「★미해결은 ★명부에 ★올려라」.
 *
 * ★★찾은 이 = 적대적 검수 ⒠(수지맥 · ★소스로 지목 · 「★얼마나 다른지(px)는 ★못 쟀다」)
 *   ⇒ ★★수는 ★내가 쟀다(261024 · 판 `2015f88f`) :
 *     ┊ 여러 줄 : matrix3d 첫 성분 ★1.14273 → ★0.857083 (★차 ★0.285647 = ★x 배율이 ★75% 로 줄었다)
 *     ┊            글자칸 폭 ★500 → ★375 (★−125px)
     ┊   ⚠️★폭 차의 ★절대값은 ★장면 ★꼴에 따라 ★흔들린다(★첫 프로브에서는 ★−58px 이었다)
     ┊     ⇒ ★검사는 ★절대값을 ★박지 ★않고 ★★«하한»(> 20px)으로 ★잰다.
 *     ┊ 한 줄   : ★행렬 차 ★1e-6(★부동소수 노이즈) · ★폭 차 ★0   ← ★★음성대조가 섰다
 *   ⇒ ★보고의 「한 줄짜리면 갈리지 않는다」가 ★맞다.
 *
 * ★★왜 그런가 (★소스 · ⛔행위로는 ★이 파일이 ★안 가른다)
 *   `ftMeasure` 는 ★글자를 ★`tfMeasW`(= ★첫 측정 때의 «지금 tf 폭»)에서 ★잰다.
 *     · 저장 ★전 : 그 값은 ★사용자 폭(★300px) — ★긴 글이 ★그 폭에서 ★꺾인다
 *     · 복원 ★뒤 : 그 값은 ★★저장된 ★box 폭(★400px) — ★덜 꺾인다 ⇒ ★`W` 가 ★달라진다
 *   사람이 끈 네 점(`touched`)은 ★그대로 두므로 `homography(_baseRect(새 W,H), 옛 D)` = ★★다른 행렬.
 *
 * ★★★근본 고침이 ★C2 쪽 칸과 ★★정면으로 ★부딪친다 — ★그래서 ★여기서 ★안 고친다
 *   ★★변이로 ★쟀다(261024) : `ftMeasure` 의 `tfMeasW` 를 ★`ktf` → ★`tf.dataset.width` 로 바꾸면
 *     ┊ ★★X1 이 ★빨강  = ★★이 축(C3)이 ★★닫힌다 (여러 줄 행렬이 ★같아진다)
 *     ┊ ★★T5 가 ★빨강  = `ft-tfw0-restore-loss` 의 「★«재는 폭»이 ★«되돌릴 폭»에 ★안 끌려간다」가 ★깨진다
 *   ⇒ ★★★두 자가 ★★반대 방향을 ★가리킨다 :
 *     | `tfMeasW` | ★행렬(C3) | ★복원 직후 box 폭이 ★저장 전(400)과의 오차 |
 *     | `ktf`(=400)            | ★갈린다(차 0.2856) | ★62  (338.344) |
 *     | `dataset.width`(=300)  | ★★같아진다          | ★★235 (164.719) |
 *   ★★⛔그리고 ★★왜 ★둘 다 ★400 이 ★아닌지는 ★★★미확정이다 —
 *     ★`dataset.width` 로 재면 ★`W` 가 ★저장 전과 ★같아져야 하고 ⇒ `boxFromCorners` 도 ★400 이어야 ★맞다.
 *     ★그런데 ★164.719 다. ⇒ ★★내가 ★아직 ★모르는 ★가정이 ★하나 더 ★있다.
 *     ⛔「그러면 된다」로 ★적지 ★않는다. ⛔T5 를 ★「틀린 칸」으로도 ★★단정하지 ★않는다 —
 *       ★T5 의 근거(★오차 62 → 235 ★악화)는 ★그 자로는 ★맞다.
 *   ⇒ ★이름 = `FT-MEASURE-WIDTH-DESIGN-UNDECIDED-01` (★★설계 미결 · ★사람 판정이 필요하다)
 *     ★닫는 순서 : ⒜ ★왜 400 이 안 나오나를 ★먼저 재라 ⒝ ★그 뒤에 ★어느 자를 ★참으로 둘지 ★고르라
 *     ⛔⒝ 를 ★먼저 ★고르면 ★★「수가 갈리는데 ★순서를 안 밟은」 그 사고다.
 *
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js ft-restore-remeasures
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

/** ★행렬 성분의 ★«부동소수 노이즈» 허용값 — ★한 자리에 둔다(⛔두 칸이 각자 숫자를 들면 갈린다).
 *  ★근거(★실측 261024) : ★한 줄 판에서 ★같은 그림인데도 ★`-0.930233` vs ★`-0.930232` = ★★1e-6 이 나왔다.
 *    ⇒ ★그보다 ★두 자리 위를 ★허용값으로 둔다. ★X1 은 ★그 ★100 배 위를 ★요구한다(★실측 차 ★0.285647). */
const NOISE = 1e-4;

const LONG  = '가나다라마바사아자차카타파하 가나다라마바사아자차카타파하 가나다라마바사아자차카타파하';
const SHORT = '한줄';

/** 글자 하나를 ★앱 함수로 만들고 ★사다리꼴 자유변형을 걸고 ★저장→복원한다. */
async function run(page, text) {
  return await page.evaluate(async (text) => {
    for (const k of ['pushHistory', 'markDirty', 'scheduleAutoSave', 'updateLayerPanel', 'buildLayerPanel', 'showToast', 'deselectAll'])
      if (typeof window[k] !== 'function') window[k] = () => {};
    const ft = await import('/js/effects-freetransform.js');
    const canvas = document.getElementById('canvas');
    canvas.querySelectorAll('.section-block').forEach((s) => s.remove());
    await window.addSection();
    const sec = [...canvas.querySelectorAll('.section-block')].pop();
    window.getSelectedSection = () => sec; window._activeFrame = null;
    await window.addTextBlock('body');
    const tb = [...sec.querySelectorAll('.text-block')].pop();
    tb.id = 'c3tb';
    const ce0 = tb.querySelector('[contenteditable]') || tb.querySelector('.tb-body');
    if (!ce0) return { fail: '글자칸이 없다' };
    ce0.textContent = text;
    const tf = tb.closest('.frame-block[data-text-frame="true"]');
    if (!tf) return { fail: 'text-frame 이 없다' };
    tf.style.width = '300px'; tf.style.maxWidth = '100%'; tf.dataset.width = '300';

    const snap = (el) => {
      const ce = el.querySelector('[contenteditable]') || el.querySelector('.tb-body');
      const rc = ce.getBoundingClientRect();
      return { m: ce.style.transform || '', w: Math.round(rc.width), h: Math.round(rc.height) };
    };
    /* ★사다리꼴 — 윗변만 안쪽으로(★아핀이 아니라 ★원근이 들어가게) */
    ft.setFxFreeTransform(tb, [[40, 0], [360, 0], [400, 140], [0, 140]], { history: false });
    const before = snap(tb);

    window.flushCurrentPage();
    canvas.innerHTML = window.getSerializedCanvas ? window.getSerializedCanvas() : canvas.innerHTML;
    window.rebindAll?.({});
    const tb2 = document.getElementById('c3tb');
    if (!tb2) return { fail: '복원 뒤 못 찾음' };
    const after = snap(tb2);

    const nums = (s) => (s.match(/-?[0-9.]+(e-?[0-9]+)?/g) || []).map(Number);
    const a = nums(before.m), c = nums(after.m);
    return {
      before, after,
      sameMatrix: before.m === after.m,
      maxMatrixDiff: (a.length && a.length === c.length) ? Math.max(...a.map((v, i) => Math.abs(v - c[i]))) : null,
      widthDelta: after.w - before.w,
    };
  }, text);
}

test('X0 ★전제 — 장면이 선다(행렬이 걸리고, 긴 글과 짧은 글의 ★폭이 실제로 다르다)', async ({ page }) => {
  const errs = await bootApp(page);
  const m = await run(page, LONG);
  const o = await run(page, SHORT);
  expect(m.fail).toBeUndefined(); expect(o.fail).toBeUndefined();
  expect(m.before.m, '★긴 글에 matrix3d 가 안 걸렸다').toContain('matrix3d');
  expect(o.before.m, '★짧은 글에 matrix3d 가 안 걸렸다').toContain('matrix3d');
  /* ★★앞끝 양성대조 — ★두 글의 ★글자칸 폭이 ★★달라야 ★「여러 줄 vs 한 줄」을 ★가른 것이다.
     ⛔같으면 ★아래 비교가 ★무엇을 재는지 ★알 수 없다. */
  expect(m.before.w, `★긴 글과 짧은 글의 폭이 같다 (${m.before.w} vs ${o.before.w}) — 장면이 두 갈래를 안 만든다`)
    .not.toBe(o.before.w);
  expect(errs, `★앱 오류: ${errs.join(' | ')}`).toEqual([]);
});

test('X1 ★★미해결을 ★수로 박는다 — ★여러 줄은 ★복원 뒤 행렬이 ★갈린다', async ({ page }) => {
  await bootApp(page);
  const r = await run(page, LONG);
  expect(r.fail).toBeUndefined();
  console.log('[X1]', JSON.stringify(r));

  /* ★★★이 단언은 ★«결함이 ★아직 산다»를 ★잠근다 — ⛔「고쳐졌다」가 ★아니다.
     ★고치면 ★이 칸이 ★빨개지고, ★그때 ★`FT-RESTORE-REMEASURES-AT-OTHER-WIDTH-01` 을 ★닫아라.
     ★261024 측정값 : maxMatrixDiff ★0.285647 · widthDelta ★−58 */
  expect(r.maxMatrixDiff,
    `★행렬 차가 사라졌다 (${r.maxMatrixDiff}) — ★고쳐졌다면 이 칸과 X2 를 닫고 명부에서 지워라`
  ).toBeGreaterThan(NOISE * 100);
  expect(Math.abs(r.widthDelta), `★글자칸 폭 차가 사라졌다 (${r.widthDelta})`).toBeGreaterThan(20);
});

test('X2 ★★음성대조 — ★한 줄은 ★복원 뒤에도 ★같다 (★「전부 갈린다」가 아니다)', async ({ page }) => {
  await bootApp(page);
  const r = await run(page, SHORT);
  expect(r.fail).toBeUndefined();
  console.log('[X2]', JSON.stringify(r));

  /* ★★이 칸이 ★X1 을 ★의미 있게 만든다 — ⛔없으면 「복원하면 ★늘 갈린다」와 ★구분이 안 된다.
     ★그리고 ★이 칸이 ★빨개지면 ★★병이 ★넓어진 것이다(한 줄까지 갈린다) ⇒ ★그쪽이 ★더 급하다. */
  /* ★★★⛔「같다」를 ★바이트(문자열)로 ★재지 ★마라 — ★261024 에 ★밟았다 :
       한 줄 판에서 `-0.930233` vs `-0.930232` = ★★1e-6 ★부동소수 ★노이즈가 나왔고,
       ★문자열 비교가 ★그 노이즈를 ★★결함으로 ★읽어 ★이 칸이 ★거짓 빨강이었다.
     ⇒ ★★수로 재고 ★허용값을 ★둔다. ★허용값의 ★근거 = ★실측 노이즈 ★1e-6 보다 ★두 자리 위. */
  expect(r.maxMatrixDiff,
    `★한 줄인데도 복원 전후 행렬이 ★갈렸다 — ★병이 넓어졌다(diff ${r.maxMatrixDiff} · 폭차 ${r.widthDelta})`
  ).toBeLessThan(NOISE);
  expect(r.widthDelta, '★한 줄인데 글자칸 폭이 변했다').toBe(0);
});
