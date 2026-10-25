/* ft-maxwidth-cap-still-holds.dom.spec.js
 *   ★★`FT-MAXWIDTH-CAP-STILL-HOLDS-01` — ★`tf` 가 ★`max-width:100%` 로 ★캡되는 꼴에서도
 *   ★C2(✕ 뒤 폭 복원)·★C3(복원 뒤 행렬)가 ★★선다. (2026-10-25 신설 · ★적대적 ⒠ ★⒟4)
 *
 * ★★적대적 ⒠ ⒟4 : 「★좁은 글상자 — tf `max-width:100%` 상한(머리말 `:45`)에 걸리면 ★tb 만 넓어진다
 *   ⇒ ★★C2/C3 과 ★겹치면 ★어떻게 되는지 ★★안 잼.」
 * ⇒ ★★쟀다(261025). ★★답 = ★★«겹쳐도 ★안 깨진다».
 *
 * ★★★그 상한의 ★실측은 ★★제품 주석이 ★이미 적어 뒀다 —
 *   `js/effects-freetransform.js` 머리말 : 「⚠️`tf` 는 ★`max-width:100%` 다
 *     (실측: `tf.style.width='916px'` → computed ★796px 로 ★캡된다)
 *     ⇒ 박스가 섹션 폭을 넘는 꼴에서는 ★`tb` 만 넓어진다(「셋이 같다」가 그 꼴에서 거짓).
 *     ⛔그 꼴을 ★`W_three_equal` 로 재지 마라 — 넘지 않는 꼴에서 재라」
 *   ⇒ ★★«해법이 문서에 있어도 ★안 읽히면 ★없는 것과 같다» 그 자리다 —
 *     ★적대적 ⒠ 도 ★그 주석을 ★가리켰고(「머리말 `:45`」), ★남은 질문은 ★★«겹침»뿐이었다.
 *
 * ★★실측 (판 `4edd243f` · 섹션 폭 ★860 · computed 캡 ★796)
 *   | 판 | 켠 뒤 tf | 캡 | matDiff | corners | ✕ 뒤 | C2 | C3 |
 *   | 축정렬·폭정함   | inline 1200px / computed ★796 | ★true | ★0 | ★유지 | 300px  | ✓ | ✓ |
 *   | 사다리꼴·폭정함 | inline 1200px / computed ★796 | ★true | ★0 | ★유지 | 300px  | ✓ | ✓ |
 *   | 축정렬·폭안정함 | inline 1200px / computed ★796 | ★true | ★0 | ★유지 | 100%   | ✓ | ✓ |
 *   ⇒ ★`tb` 만 넓어지는 ★그 꼴에서도 ★★✕ 가 ★켜기 전 폭으로 ★되돌리고 ★행렬이 ★같다.
 *
 * ⛔★안 쟀다 : ★그 꼴에서 ★«화면 모습»이 ★맞나(★tb 가 섹션 밖으로 ★삐져 나오나) — ★눈 축이다
 *   ★이름 = `FT-CAPPED-TB-OVERFLOW-UNMEASURED-01` ⇒ ★앱 레인(태양) 몫
 *
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js ft-maxwidth-cap-still-holds
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

/** ★`box.w` 가 ★섹션 폭을 ★넘게 — ★캡이 ★걸리는 네 점 */
const BIG_AXIS = [[0, 0], [1200, 0], [1200, 300], [0, 300]];
const BIG_TRAP = [[100, 0], [1100, 0], [1200, 320], [0, 320]];

async function run(page, corners, setW) {
  return await page.evaluate(async ({ corners, setW }) => {
    for (const k of ['pushHistory', 'markDirty', 'scheduleAutoSave', 'updateLayerPanel', 'buildLayerPanel', 'showToast', 'deselectAll'])
      if (typeof window[k] !== 'function') window[k] = () => {};
    const ft = await import('/js/effects-freetransform.js');
    const canvas = document.getElementById('canvas');
    const matNums = (x) => {
      const m = String(x || '').match(/\(([^)]*)\)/);
      return m ? (m[1].match(/-?[0-9.]+(?:e-?[0-9]+)?/g) || []).map(Number) : [];
    };
    const cw = (el) => Math.round(parseFloat(getComputedStyle(el).width));
    canvas.querySelectorAll('.section-block').forEach((s) => s.remove());
    await window.addSection();
    const sec = [...canvas.querySelectorAll('.section-block')].pop();
    window.getSelectedSection = () => sec; window._activeFrame = null;
    await window.addTextBlock('body');
    const tb = [...sec.querySelectorAll('.text-block')].pop();
    tb.id = 'capTb';
    const tf = tb.closest('.frame-block[data-text-frame="true"]');
    if (!tf) return { fail: 'text-frame 이 없다' };
    if (setW) { tf.style.width = '300px'; tf.style.maxWidth = '100%'; tf.dataset.width = '300'; }

    /* ★★섹션 폭을 ★★«여기서» 잰다 — ⛔복원 ★뒤에 재면 ★`sec` 이 ★옛 DOM 이라 ★`null` 이 된다
       (★261025 : ★내가 그 흠을 ★밟아 ★M0 이 ★`secW: NaN` 으로 ★빨개졌다 — ★자의 흠이었다) */
    const secW = cw(sec);
    const baseC = cw(tf), baseInline = tf.style.width;
    ft.setFxFreeTransform(tb, corners, { history: false });
    const onInline = tf.style.width, onC = cw(tf);
    /* ★★캡이 ★걸렸나 = ★inline 보다 ★computed 가 ★작다 */
    const capped = parseFloat(onInline) > onC;
    const ceOf = (e) => e.querySelector('[contenteditable]') || e.querySelector('.tb-body');
    const mBefore = ceOf(tb).style.transform;
    const cBefore = tb.dataset.tfCorners;

    window.flushCurrentPage();
    canvas.innerHTML = window.getSerializedCanvas ? window.getSerializedCanvas() : canvas.innerHTML;
    window.rebindAll?.({});
    const tb2 = document.getElementById('capTb');
    if (!tb2) return { fail: '복원 뒤 못 찾음' };
    const tf2 = tb2.closest('.frame-block[data-text-frame="true"]');
    const a = matNums(mBefore), c = matNums(ceOf(tb2).style.transform);
    const matDiff = (a.length === 16 && c.length === 16)
      ? Math.max(...a.map((v, i) => Math.abs(v - c[i]))) : null;
    const cornersKept = cBefore === tb2.dataset.tfCorners;
    ft.setFxFreeTransform(tb2, null, { history: false });
    return {
      secW, baseC, baseInline, onInline, onC, capped,
      matDiff, cornersKept,
      afterXInline: tf2.style.width, afterXC: cw(tf2),
    };
  }, { corners, setW });
}

const CASES = [
  ['축정렬·폭정함', BIG_AXIS, true],
  ['사다리꼴·폭정함', BIG_TRAP, true],
  ['축정렬·폭안정함', BIG_AXIS, false],
];

test('M0 ★★전제 — ★캡이 ★실제로 ★걸린다 (⛔안 걸리면 ★아래가 «안 재고 있다»다)', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 1200 });
  const errs = await bootApp(page);
  for (const [name, C, setW] of CASES) {
    const r = await run(page, C, setW);
    expect(r.fail).toBeUndefined();
    console.log(`[M0:${name}]`, JSON.stringify({ secW: r.secW, onInline: r.onInline, onC: r.onC, capped: r.capped }));
    /* ★★앞끝 양성대조 — ★inline 이 ★섹션 폭을 ★넘고 ★computed 가 ★캡됐다 */
    expect(parseFloat(r.onInline), `★${name}: inline 폭이 섹션 폭(${r.secW})을 안 넘는다 — 장면이 캡을 안 만든다`)
      .toBeGreaterThan(r.secW);
    expect(r.capped, `★${name}: 캡이 안 걸렸다 (inline ${r.onInline} · computed ${r.onC})`).toBe(true);
  }
  expect(errs, `★앱 오류: ${errs.join(' | ')}`).toEqual([]);
});

test('M1 ★★C2 가 ★캡 꼴에서도 ★선다 — ✕ 뒤 폭이 ★켜기 전과 ★같다', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 1200 });
  await bootApp(page);
  for (const [name, C, setW] of CASES) {
    const r = await run(page, C, setW);
    console.log(`[M1:${name}]`, JSON.stringify({ base: r.baseC, afterX: r.afterXC, inline: r.afterXInline }));
    expect(r.afterXC, `★${name}: ✕ 뒤 폭이 켜기 전(${r.baseC})과 다르다 (${r.afterXC}) — ` +
      '★캡 꼴에서 C2 고침이 ★안 선다').toBe(r.baseC);
    expect(r.afterXInline, `★${name}: ✕ 뒤 inline 이 켜기 전과 다르다`).toBe(r.baseInline);
  }
});

test('M2 ★★C3 가 ★캡 꼴에서도 ★선다 — 복원 뒤 ★행렬이 ★같고 ★네 점이 ★유지된다', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 1200 });
  await bootApp(page);
  for (const [name, C, setW] of CASES) {
    const r = await run(page, C, setW);
    console.log(`[M2:${name}]`, JSON.stringify({ matDiff: r.matDiff, cornersKept: r.cornersKept }));
    expect(r.matDiff, `★${name}: 행렬 성분이 16 개가 아니다 — 자가 헛돈다`).not.toBeNull();
    expect(r.matDiff, `★${name}: 복원 뒤 행렬이 갈렸다 (${r.matDiff}) — ★캡 꼴에서 C3 고침이 ★안 선다`)
      .toBeLessThan(1e-4);
    /* ★★`tfTouched` 고침도 ★그 꼴에서 ★서나 — ★축정렬 판이 ★그것을 잰다 */
    expect(r.cornersKept, `★${name}: 네 점이 덮어써졌다 — ★캡 꼴에서 tfTouched 고침이 ★안 선다`).toBe(true);
  }
});
