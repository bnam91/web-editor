/* stack-padx-works.dom.spec.js — ★스택 프레임의 ★좌우 패딩이 ★«먹는다» (①-가 · 현빈 2026-10-11)
 * ★현빈: 「프레임 안에서 ★스택모드 일때 프레임블럭 안에서 ★좌우패딩이 ★먹히게 바란거였거든?」
 *
 * ★★무엇을 잠그나 — ★«그림»으로. ⛔모델(dataset)로 ★닫지 ★않는다:
 *   ★자 = ★★«프레임 기준 ★틈» = `row.rect.left − frame.rect.left` ÷ ★배율  (⛔`offsetLeft` 아님 —
 *        ★그 창은 ★`offsetParent`(= row) 기준이라 ★★프레임 패딩이 ★영영 ★안 보인다. 첫 회차에 그걸로 틀렸다)
 *   ★단언 = ★★«패딩을 바꾸면 ★틈이 ★그만큼 ★움직인다» (★계수 ★1) ＋ ★★pad 0 에서 ★★옛 값과 ★같다
 * ★누름 꼴: ★`#ss-to-stack-btn`·정렬 단추 = ★진짜 `page.click` · ★패딩 = ★`page.fill('#ss-padx-num')`
 *   (`_helpers.js` bindSlider 가 ★number 의 `input` 을 듣는다) ⛔`dispatchEvent` 0건
 * ⚠️★한 종(그리드)만 잠근다 — ★다른 블럭 종은 ★안 쟀다.
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const PADS = [0, 24, 48];
const READ = `(() => {
  const F = document.getElementById('sF');
  const row = document.getElementById('sG').parentElement;
  const fr = F.getBoundingClientRect(), rr = row.getBoundingClientRect();
  const z = F.offsetWidth ? fr.width / F.offsetWidth : 1;
  const ids = ['ss-align-left', 'ss-align-hcenter', 'ss-align-right'];
  return {
    gapL: Math.round((rr.left - fr.left) / z), gapR: Math.round((fr.right - rr.right) / z),
    rowW: Math.round(rr.width / z), inlineW: row.style.width || '(빈칸)',
    stackW: row.dataset.stackW ?? '(없다)', alignSelf: getComputedStyle(row).alignSelf,
    alignOn: ids.filter((i) => document.getElementById(i)?.classList.contains('active')).join(',') || '(0개)',
    padL: parseFloat(getComputedStyle(F).paddingLeft) || 0,
  };
})`;

async function stackScene(page) {
  await page.setViewportSize({ width: 1500, height: 1200 });
  const errs = await bootApp(page);
  await page.evaluate(() => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend',
      '<div class="section-block" data-section="1" id="sS"><div class="section-hitzone"></div>' +
      '<div class="section-inner" id="sS-in"><div class="gap-block" data-type="gap" style="height:40px"></div></div></div>');
    window.rebindAll?.();
    window.state.pageSettings.padX = 0;
    window.applyPageSettings();
    const S = document.getElementById('sS');
    window.selectSection(S); window.addFrameBlock();
    const F = [...S.querySelectorAll('.frame-block:not([data-text-frame])')].pop();
    F.id = 'sF';
    window.selectSection(F); window.addGridBlock({});
    const g = [...F.querySelectorAll('.grid-block')].pop();
    if (g) g.id = 'sG';
  });
  await page.click('#sF', { timeout: 2500, position: { x: 5, y: 5 } });
  await page.click('#ss-to-stack-btn', { timeout: 2500 });
  const pre = await page.evaluate(eval(READ));
  return { errs, pre };
}
const setPad = (page, v) => page.fill('#ss-padx-num', String(v), { timeout: 2000 });

test('P1 ★★패딩을 바꾸면 ★틈이 ★★그만큼 움직인다 (★계수 1) ＋ ★pad 0 에서 ★무변', async ({ page }) => {
  const { errs, pre } = await stackScene(page);
  console.log(`[P1 전제] stackW=${pre.stackW} · alignSelf=${pre.alignSelf} · 틈 L${pre.gapL}/R${pre.gapR} · rowW=${pre.rowW}`);
  expect(pre.stackW, '전제: 변환이 stackW 를 박았다').not.toBe('(없다)');
  expect(pre.padL, '전제: 패딩은 0 에서 시작').toBe(0);
  const base = pre.gapL;
  const rows = [];
  for (const pad of PADS) {
    await setPad(page, pad);
    const r = await page.evaluate(eval(READ));
    rows.push({ pad, ...r });
    console.log(`[P1] pad=${String(pad).padStart(3)} | 틈 L${r.gapL}/R${r.gapR} | rowW=${r.rowW} inlineW=${r.inlineW} stackW=${r.stackW} | 정렬 켜짐=${r.alignOn}`);
  }
  /* ★★주 단언 — ★계수 1 */
  for (const r of rows) {
    expect(r.gapL, `pad=${r.pad}: 틈L 이 ${base + r.pad} 이어야 한다(계수 1)`).toBe(base + r.pad);
    expect(r.gapR, `pad=${r.pad}: 대칭이어야 한다`).toBe(r.gapL);
  }
  /* ★★pad 0 에서 ★옛 값과 ★같다 — ★기존 문서 ★무변 */
  expect(rows[0].gapL, 'pad 0 에서 변환 직후와 같다(기존 문서 무변)').toBe(base);
  expect(rows[0].rowW, 'pad 0 에서 폭도 같다').toBe(pre.rowW);
  /* ★★정렬 판정이 ★안 바뀐다 — ★그 함수의 ★답으로 */
  for (const r of rows) expect(r.alignOn, `pad=${r.pad}: 정렬 켜짐이 hcenter 그대로`).toBe('ss-align-hcenter');
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('P2 ★★경계 — ★파생폭이 ★0 이하면 ★★보존을 ★포기한다(폭이 ★빈 값)', async ({ page }) => {
  const { pre } = await stackScene(page);
  const base = parseFloat(pre.stackW);
  expect(Number.isFinite(base), '전제: stackW 를 수로 읽었다').toBe(true);
  /* ★★패딩 입력칸의 ★상한을 ★먼저 ★잰다 — ⛔«안 일어날 일»로 빼지 않는다 */
  const lim = await page.evaluate(() => {
    const n = document.getElementById('ss-padx-num');
    return { max: Number(n?.max), min: Number(n?.min) };
  });
  const need = Math.ceil(base / 2);
  console.log(`[P2 전제] stackW=${base} ⇒ 보존이 깨지는 pad = ${need} 이상 · ★입력칸 상한 max=${lim.max} min=${lim.min}`);
  /* ★★★실측: 상한 100 이므로 ★`stackW` 가 ★200 보다 크면 ★★사람이 ★그 경계에 ★닿을 수 ★없다.
     ⇒ ★그 갈래는 ★★«작은 stackW» 에서만 ★선다 — ★그런 자식은 ★실제로 ★생길 수 있다(작은 블럭).
     ⇒ ★그래서 ★`stackW` 를 ★★런타임으로 ★작게 두고 ★상한 패딩으로 ★그 갈래를 ★잠근다.
     ⛔이 칸은 ★★«사람 경로»가 ★아니다 — ★`stackW` 를 ★손으로 박았다. ★그 사실을 ★여기 박는다. */
  const small = Math.max(1, lim.max * 2 - 50);        /* 상한 패딩이면 파생폭이 음수가 되는 값 */
  await page.evaluate((small) => {
    document.getElementById('sG').parentElement.dataset.stackW = String(small);
  }, small);
  console.log(`[P2] ★stackW 를 ★${small} 로 두었다(⛔런타임 · 사람 경로 아님) ⇒ pad ${lim.max} 면 파생폭 ${small - 2 * lim.max}`);
  await setPad(page, lim.max);
  const r = await page.evaluate(eval(READ));
  console.log(`[P2] pad=${lim.max} ⇒ ★inlineW=${r.inlineW} · 틈 L${r.gapL}/R${r.gapR} · rowW=${r.rowW} · 정렬 켜짐=${r.alignOn}`);
  expect(small - 2 * lim.max <= 0, `전제: 파생폭이 0 이하다(${small - 2 * lim.max})`).toBe(true);
  expect(r.inlineW, '파생폭이 0 이하면 보존을 포기한다(빈 값)').toBe('(빈칸)');
  console.log('[P2] ⇒ ★★보존을 ★포기했다 — ★내용이 ★칸을 ★채운다');
  console.log(`[P2 ★범위] ⛔상한이 ${lim.max} 라 ★stackW > ${lim.max * 2} 인 자식에서는 ★★사람이 ★이 경계에 ★닿을 수 ★없다 — ★그 사실을 ★적는다.`);
});
