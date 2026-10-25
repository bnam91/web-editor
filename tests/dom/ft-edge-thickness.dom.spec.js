/* ft-edge-thickness.dom.spec.js
 *   ★★`FT-EDGE-THICKNESS-VARIES-UNDER-MATRIX-01` — ★현빈 261025 재신고를 ★잠근다. (2026-10-25 신설)
 *
 * ★★현빈 261025 원문 : 「★보라색 아웃라인의 ★두께가 ★왜 ★모서리 핸들가지고 ★움직일때마다
 *   ★두께가 ★달라지는지?」  (★★261024 ⒜ 와 ★같은 신고 — ★그때 처방이 ★«손잡이»로 갔다)
 * ★실측(미카사 261025 · `b6c5f87d`) : ★끌기 전 ★1.401px 균일 → ★0.28~3.20px
 *
 * ★★★왜 ★「네 변 두께가 같다」로 ★재지 ★않는가 — ★★그것이 ★★항등식이 되기 때문이다.
 *   ★고친 뒤 테두리는 ★변형 «밖» svg 의 ★`stroke-width` 하나다 ⇒ ★네 변이 ★구조적으로 ★같다.
 *   ⇒ ★그 단언은 ★★아무것도 ★잠그지 ★못한다(★초록이 ★양성이 ★아니다).
 *   ⇒ ★★그래서 ★★«두께를 ★갈라놓는 ★원인»을 ★잰다 : ★★테두리가 ★변형 ★«안»에 ★있는가.
 *
 * ★단언 둘
 *   F1 ★★주 단언 — ★`.tfh-edge` 의 ★조상 사슬(★`tb` 까지)에 ★★non-identity `transform` 이 ★★0개다.
 *      ★★핀 `b6c5f87d` 에서는 ★`.tfh-fx` 가 ★`matrix3d(원근)` 를 들고 있어 ★★빨강이다(양성대조).
 *   F2 ★★휨 유지 — ★사다리꼴 장면에서 ★보라 테두리의 ★윗변 ≠ 아랫변.
 *      ⇒ ★★「두께를 고치려고 ★평평한 사각형으로 ★만들어 버리는」 ★틀린 처방을 ★막는다.
 *      ★현빈 : 「★휨 자체는 ★설계대로」(261025) — ★그래서 ★이 칸이 ★필요하다.
 *
 * ★★★양성대조 — ★실제로 ★돌려 ★쟀다 (2026-10-25)
 *   ★고친 판 `c34f7a17`  : ★F0 ✅ · ★F1 ✅(움직이는 조상 ★0개) · ★F2 ✅(윗변 ★320 ≠ 아랫변 ★400)
 *   ★★핀 판   `b6c5f87d` : ★F0 ✅ · ★★F1 ★★빨강 · ★F2 ★SKIP(옛 꼴엔 ★path 가 ★없다)
 *     ★★빨강이 ★찍은 값 : 「★변형된 조상 ★1개 — `.tfh-fx`
 *       `matrix3d(0.945784,0,0,0, -0.930234,2.60465,0,★-0.0046511, 0,0,1,0, 40,0,0,1)`」
 *       ★★`m[7] = -0.0046511 ≠ 0` ⇒ ★★원근 항이 ★살아 있다 = ★두께가 갈리는 ★그 원인이다.
 *   ⇒ ★★이 자는 ★★「안 재고 있다」가 ★아니다. ★F1 이 ★원인을 ★잡는다.
 *   ★두 판을 ★어떻게 갈랐나 : ★고침을 ★먼저 ★커밋하고(⛔잃지 않게),
 *     `git show "b6c5f87d:<경로>" > <경로>` 로 ★두 파일만 ★갈아끼운 뒤 ★돌리고,
 *     `git show "HEAD:<경로>"` 로 ★원복해 ★★sha256 로 ★원복까지 ★쟀다.
 *   ⚠️★안 쟀다 : ★실앱(9401)에서 ★사람이 ★끌어 본 ★두께 — ★현빈 QA 로 ★닫는다.
 *   ⚠️★이 판정은 ★playwright 의 ★종료코드로 ★받지 ★않았다(★zsh `PIPESTATUS` 가 ★안 먹었다) —
 *     ★근거는 ★「1 failed」 ★줄과 ★위에 ★인용한 ★행렬이다.
 *
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js ft-edge-thickness
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const TRAP = [[40, 0], [360, 0], [400, 140], [0, 140]];

async function scene(page, corners) {
  return await page.evaluate(async (corners) => {
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
    tb.id = 'fttb';
    ft.setFxFreeTransform(tb, corners, { history: false });
    window.selectBlock?.(tb.id);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

    const edge = tb.querySelector('.tfh-edge');
    /* ★★조상 사슬 — ★`edge` 에서 ★`tb` 까지 ★올라가며 ★transform 을 ★전수 찍는다.
       ⛔선택자 이름(`.tfh-fx`)으로 ★가르지 ★않는다 — ★층 이름이 ★바뀌어도 ★이 자는 ★산다. */
    const chain = [];
    if (edge) {
      for (let el = edge; el && el !== tb.parentElement; el = el.parentElement) {
        const t = getComputedStyle(el).transform;
        chain.push({
          cls: (el.getAttribute && el.getAttribute('class')) || el.tagName,
          transform: t,
          /* ★identity 판정 — `none` 또는 ★단위행렬만 ★통과 */
          moving: !(t === 'none' || /^matrix\(1,\s*0,\s*0,\s*1,\s*0,\s*0\)$/.test(t)
            || /^matrix3d\(1,\s*0,\s*0,\s*0,\s*0,\s*1,\s*0,\s*0,\s*0,\s*0,\s*1,\s*0,\s*0,\s*0,\s*0,\s*1\)$/.test(t)),
        });
        if (el === tb) break;
      }
    }

    /* ★★보라 테두리의 ★네 꼭짓점 — ★svg 꼴일 때만 ★path 에서 ★읽는다.
       ★길이의 ★비만 쓰므로 ★배율은 ★약분된다(⇒ ★화면 좌표로 ★옮기지 ★않는다). */
    let quad = null;
    const p = edge && edge.tagName && edge.tagName.toLowerCase() === 'svg' ? edge.querySelector('path') : null;
    if (p) {
      const nums = (p.getAttribute('d') || '').match(/-?\d+(\.\d+)?/g);
      if (nums && nums.length >= 8) {
        quad = [0, 1, 2, 3].map((i) => [parseFloat(nums[i * 2]), parseFloat(nums[i * 2 + 1])]);
      }
    }
    return {
      found: !!edge,
      tag: edge ? edge.tagName.toLowerCase() : null,
      handles: tb.querySelectorAll('.tfh-handle').length,
      chain,
      movingCount: chain.filter((c) => c.moving).length,
      quad,
    };
  }, corners);
}

test('F0 ★전제 — 자유변형이 켜지고 `.tfh-edge` 가 떠 있다', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 1200 });
  const errs = await bootApp(page);
  const r = await scene(page, TRAP);
  expect(r.handles, '★손잡이가 12 가 아니다 — 자유변형이 안 켜졌다(이 아래 판정은 못 쓴다)').toBe(12);
  expect(r.found, '★`.tfh-edge` 를 못 찾았다 — 자가 죽었다').toBe(true);
  console.log('[F0] 꼴=', r.tag, '· 조상 사슬=', JSON.stringify(r.chain));
  expect(errs, `★앱 오류: ${errs.join(' | ')}`).toEqual([]);
});

test('F1 ★★★보라 테두리가 ★변형 «밖»에 있다 (= 두께를 갈라놓는 원인이 없다)', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 1200 });
  await bootApp(page);
  const r = await scene(page, TRAP);
  const moving = r.chain.filter((c) => c.moving);
  console.log('[F1] 움직이는 조상=', JSON.stringify(moving));
  /* ★★★이 칸이 ★빨개지면 = ★테두리가 ★행렬 ★안으로 ★되돌아갔다 = ★현빈 신고가 ★되살아난 것이다.
     ★핀 `b6c5f87d` 에서 ★`.tfh-fx` 가 ★matrix3d 를 들고 ★빨강이어야 ★한다(양성대조). */
  expect(r.movingCount,
    `★보라 테두리가 ★변형된 조상 ${r.movingCount}개 ★«안»에 있다 — ${JSON.stringify(moving)} ` +
    '⇒ ★원근 행렬이 ★테두리 안·밖 점을 ★다르게 사상해 ★★두께가 변마다 갈린다(현빈 261025 재신고)'
  ).toBe(0);
});

test('F2 ★★휨은 ★남아 있다 — 사다리꼴에서 윗변 ≠ 아랫변 (⛔평평하게 만들지 않았다)', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 1200 });
  await bootApp(page);
  const r = await scene(page, TRAP);
  /* ★★범위 밖이면 ★SKIP — ⛔FAIL 이 아니다. ★옛 꼴(div+border)엔 ★읽을 path 가 ★없다. */
  test.skip(!r.quad, `★보라 테두리가 ★svg quad 꼴이 아니다(tag=${r.tag}) — ★이 자의 범위 밖이다`);
  const len = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
  const top = len(r.quad[0], r.quad[1]);
  const bot = len(r.quad[3], r.quad[2]);
  console.log('[F2] 윗변=', top.toFixed(2), '아랫변=', bot.toFixed(2));
  expect(Math.abs(top - bot),
    `★윗변 ${top.toFixed(2)} 과 아랫변 ${bot.toFixed(2)} 이 ★같다 — ★★휨이 사라졌다. ` +
    '★현빈은 「휨 자체는 설계대로」라 하셨다 ⇒ ★두께만 고쳐야 한다'
  ).toBeGreaterThan(5);
});
