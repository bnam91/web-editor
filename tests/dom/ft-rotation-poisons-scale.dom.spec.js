/* ft-rotation-poisons-scale.dom.spec.js
 *   ★★`FT-ROTATION-POISONS-SCALE-01` — ★회전된 글상자에서 ★`_scaleOf` 가 ★배율을 ★틀리게 읽고
 *   ★그 탓에 ★자유변형의 ★글자 측정(`st.W`)이 ★틀어진다. (2026-10-25 신설 · ★적대적 ⒠ ★⒟2)
 *
 * ★★★이 파일은 ★«고침»이 ★아니다 — ★수를 박아 ★명부에 올린다.
 *   ★고치려면 ★`_scaleOf` 의 ★모형을 ★바꿔야 하고(회전을 ★분리해 ★참 배율만 뽑기)
 *   ★그것은 ★자유변형·손잡이 ★둘의 ★기하를 ★같이 건드린다 ⇒ ★★범위 판정이 ★사람 자리다.
 *
 * ★★찾은 이 = 적대적 검수 ⒠(수지맥) ★⒟2 — 「★소스 추론 · ★안 잼」
 * ★★★그리고 ★그 보고를 ★★정정한다 :
 *   ⒠ 는 「★회전하면 bbox 가 커져 ★배율을 ★★너무 ★크게 읽는다」라 했다.
 *   ★★실측(261025) : ★★θ 에 따라 ★크게도 ★작게도 읽는다 —
 *     | θ | `_scaleOf` | ★참 배율(0.4) 대비 |
 *     | 0  | 0.4000 | —              |
 *     | 15 | 0.4261 | ★＋6.5 %        |
 *     | 30 | 0.4232 | ＋5.8 %         |
 *     | 45 | 0.3914 | ★★−2.2 %  ← ★작다 |
 *     | 90 | 0.1536 | ★★−62 %   ← ★작다 |
 *   ⇒ ★★「항상 크게」는 ★거짓이다. ★45° 부터 ★작아진다.
 *
 * ★★모형이 ★확정됐다 (★실측과 ★식이 ★소수 셋째까지 맞는다)
 *   ★`_scaleOf(el)` = `bbox.width / offsetWidth` 이고, ★회전 θ 인 요소의 bbox 는
 *     `w·|cos θ| + h·|sin θ|` 다 ⇒ ★★`_scaleOf = 참배율 × (|cos θ| + (h/w)·|sin θ|)`
 *   ★검증(h/w = 0.383) : 15° 1.0653 vs 식 1.0651 · 30° 1.0580 vs 1.0577 ·
 *                        45° 0.9785 vs 0.9782 · 90° 0.3840 vs 0.3833
 *
 * ★★그래서 ★무엇이 ★틀어지나 — ★★`st.W`(글자 폭 측정)
 *   `ftMeasure` 는 `st.W = b.width / z` 로 ★z 로 ★나눈다 ⇒ ★z 가 틀리면 ★W 가 틀린다.
 *   ★실측 : ★글자를 ★안 바꿨는데 ★`st.W` 가 ★164.72(0°) → ★182.28(30°) → ★191.63(45°)
 *     ⇒ ★★＋16 % (0° → 45°). ★그 W 로 ★`_baseRect`·`homography`·`boxFromCorners` 가 ★다 돈다.
 *
 * ⛔★이 파일이 ★안 재는 것
 *   · ★★«사람이 끌 때» 델타가 ★얼마나 ★줄거나 ★늘어나나 — ★안 쟀다(★끌기 축)
 *   · ★손잡이 ★자리가 ★회전과 ★합쳐지나 — ★안 쟀다(⒠ 도 「안 잼」이라 했다)
 *     ★이름 = `FT-ROTATED-HANDLE-POSITION-UNMEASURED-01`
 *   · ★회전이 ★`tf` 에 걸린 꼴(★`asset-rotate.js:247` `host`) — ★여기선 ★`.text-block` 에만 걸었다
 *
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js ft-rotation-poisons-scale
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { ROOT, bootApp } = require('./_root-harness.js');

const DEGS = [0, 15, 30, 45, 90];

async function measure(page) {
  return await page.evaluate(async (DEGS) => {
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
    tb.id = 'rotTb';
    const tf = tb.closest('.frame-block[data-text-frame="true"]');
    if (!tf) return { fail: 'text-frame 이 없다' };
    tf.style.width = '300px'; tf.style.maxWidth = '100%'; tf.dataset.width = '300';

    /* ★`_scaleOf` 와 ★같은 꼴 — ⛔모듈 밖이라 ★같은 식을 ★다시 쓴다(★그게 자다) */
    const scaleOf = (el) => {
      const ow = el && el.offsetWidth;
      if (!ow) return 1;
      const z = el.getBoundingClientRect().width / ow;
      return Number.isFinite(z) && z > 0.01 ? z : 1;
    };
    const rows = [];
    for (const deg of DEGS) {
      tb.style.transform = deg ? `rotate(${deg}deg)` : '';
      const ow = tb.offsetWidth, oh = tb.offsetHeight;
      const z = scaleOf(tb);
      const rad = deg * Math.PI / 180;
      const theory = Math.abs(Math.cos(rad)) + (oh / ow) * Math.abs(Math.sin(rad));
      const st = ft.ftMeasure(tb, true);
      rows.push({ deg, ow, oh, z: +z.toFixed(4), theory: +theory.toFixed(4),
                  W: st ? +st.W.toFixed(2) : null });
    }
    tb.style.transform = '';
    return { rows };
  }, DEGS);
}

test('R0 ★전제 — ★회전 0 에서 ★모형이 ★선다(★식 = 1 · ★장면이 ★회전을 ★실제로 먹는다)', async ({ page }) => {
  const errs = await bootApp(page);
  const r = await measure(page);
  expect(r.fail).toBeUndefined();
  console.log('[R0]', JSON.stringify(r.rows));
  const z0 = r.rows.find((x) => x.deg === 0);
  expect(z0, '★회전 0 칸이 없다').toBeTruthy();
  expect(z0.theory, '★회전 0 에서 식이 1 이 아니다 — 자가 헛돈다').toBe(1);
  /* ★★앞끝 양성대조 — ★회전이 ★실제로 ★bbox 를 ★바꿨나.
     ⛔안 바뀌면 ★아래 「틀리게 읽는다」가 ★«안 재고 있다»다. */
  const z90 = r.rows.find((x) => x.deg === 90);
  expect(z90.z, `★90° 인데 scaleOf 가 0° 와 같다 (${z90.z} vs ${z0.z}) — 회전이 안 먹었다`).not.toBe(z0.z);
  expect(errs, `★앱 오류: ${errs.join(' | ')}`).toEqual([]);
});

test('R1 ★★★모형 — `_scaleOf` = ★참배율 × (|cos θ| ＋ (h/w)|sin θ|)', async ({ page }) => {
  await bootApp(page);
  const r = await measure(page);
  expect(r.fail).toBeUndefined();
  const z0 = r.rows.find((x) => x.deg === 0).z;   /* ★참 배율 */
  for (const row of r.rows) {
    const got = row.z / z0, want = row.theory;
    /* ★★실측과 ★식이 ★맞는다 = ★★원인이 ★«회전이 ★bbox 를 키운다» 하나로 ★설명된다.
       ★261025 실측 : 15° 1.0653/1.0651 · 30° 1.0580/1.0577 · 45° 0.9785/0.9782 · 90° 0.3840/0.3833 */
    expect(Math.abs(got - want),
      `★θ=${row.deg}: 실측비 ${got.toFixed(4)} ≠ 식 ${want.toFixed(4)} — ★모형이 깨졌다(까닭이 하나가 아니다)`
    ).toBeLessThan(0.01);
  }
});

test('R2 ★★★보고 정정 — ★「항상 크게 읽는다」는 ★거짓이다(45° 부터 ★작다)', async ({ page }) => {
  await bootApp(page);
  const r = await measure(page);
  const z0 = r.rows.find((x) => x.deg === 0).z;
  const big = r.rows.filter((x) => x.deg > 0 && x.z > z0).map((x) => x.deg);
  const small = r.rows.filter((x) => x.deg > 0 && x.z < z0).map((x) => x.deg);
  console.log('[R2]', JSON.stringify({ z0, big, small }));
  /* ★★★두 방향이 ★다 있어야 ★「항상 크게」가 ★거짓임이 ★선다 */
  expect(big.length, '★크게 읽는 θ 가 ★하나도 없다 — 증상이 사라졌나? 판정해라').toBeGreaterThan(0);
  expect(small.length,
    '★★작게 읽는 θ 가 ★하나도 없다 — ★그러면 적대적 ⒠ 의 「항상 크게」가 ★맞다. 내 정정을 ★철회해라'
  ).toBeGreaterThan(0);
  /* ★261025 실측 : 크게 = [15, 30] · 작게 = [45, 90] */
  expect(small, '★작게 읽는 θ 명부가 바뀌었다 — 수를 다시 적어라').toContain(90);
});

test('R3 ★★그래서 ★`st.W` 가 ★틀어진다 — ★글자를 ★안 바꿨는데 ★폭이 ★커진다', async ({ page }) => {
  await bootApp(page);
  const r = await measure(page);
  const w0 = r.rows.find((x) => x.deg === 0).W;
  const w45 = r.rows.find((x) => x.deg === 45).W;
  console.log('[R3]', JSON.stringify({ w0, w45, delta: +(w45 - w0).toFixed(2), pct: +((w45 / w0 - 1) * 100).toFixed(1) }));
  expect(w0, '★회전 0 의 W 를 못 쟀다').toBeGreaterThan(0);
  /* ★★★본 단언 — ★글자는 ★그대로인데 ★측정값이 ★다르다.
     ★261025 실측 : 164.72(0°) → 182.28(30°) → 191.63(45°) ⇒ ★＋16 %
     ⛔절대값을 박지 않고 ★★«차이가 있다»로 잰다(글꼴·환경이 값을 움직인다) */
  expect(Math.abs(w45 - w0) / w0,
    `★회전해도 W 가 같다 (${w0} vs ${w45}) — ★고쳐졌다면 이 파일을 ★닫아라`
  ).toBeGreaterThan(0.05);
});

test('R4 ★`_scaleOf` 가 ★두 파일에 ★복제돼 있다 — ★한쪽을 고치면 ★다른 쪽이 ★남는다', () => {
  const a = fs.readFileSync(path.join(ROOT, 'js', 'effects-freetransform.js'), 'utf8');
  const b = fs.readFileSync(path.join(ROOT, 'js', 'effects-ft-handles.js'), 'utf8');
  /* ★둘 다 ★제 `_scaleOf` 를 ★따로 든다 — ★후자 주석이 ★스스로 「정본 `_scaleOf` 와 ★같은 자」라 적었다 */
  for (const [name, src] of [['effects-freetransform.js', a], ['effects-ft-handles.js', b]])
    expect(/function _scaleOf\(/.test(src), `★${name} 에 _scaleOf 정의가 없다 — ★합쳐졌으면 이 칸을 닫아라`).toBe(true);
  /* ★★음성대조 — ★한쪽이 ★다른 쪽을 ★import 하지 ★않는다(★그러면 복제가 아니다) */
  expect(/import[^;]*_scaleOf/.test(b),
    '★`effects-ft-handles.js` 가 `_scaleOf` 를 ★불러 쓴다 — ★★복제가 아니다. 이 칸을 닫아라').toBe(false);
});
