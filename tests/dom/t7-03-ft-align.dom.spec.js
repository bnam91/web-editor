/* t7-03-ft-align.dom.spec.js — t7-03 자유변형 정렬 (S3 실측 · 지디 처방 ⒝)
 *
 * ★잰 값(S3 · 판 ca702d40 · 실앱 배율 40%·100% 같음 · 글 「짧은 글」 h1 · 내용폭 716)
 *   ⑴ 가운데 정렬 글상자에 자유변형을 켜기만 해도 글자중심 − 섹션 내용중심 0.00 → −107.68(왼쪽)
 *   ⑵ ⌥S 0 이동 · ⑶ 패널 가운데 단추는 −107.68 → 0.00 · ⑷ 켠 직후 정렬 단추 active 0/3
 * ★뿌리 — js/effects-freetransform.js applyFxFreeTransform 이 tf 폭을 100% → px 로 갈아타면서 alignSelf 는 안 쓴다
 *   ⇒ 세로 flex(section-inner) 안 «폭 박힌» 자식은 왼쪽에 선다 · 패널 표시(_alignDisplayFor)는 «textAlign center 인데 실제 왼쪽»이라 미정(셋 다 끔).
 * ★처방 ⒝(지디) — ★그 «전이»(직전 tf 인라인 폭이 '100%' 또는 '')에서만 tf.style.alignSelf 도 같이 쓴다 · 값 = 글자칸 textAlign 의 사상.
 *   ⛔상태가 아니라 전이 — 복원 경로(저장본 tf 폭은 이미 px)는 전이가 안 일어난다 ⇒ 옛 저장본 무접촉(자가치유 금지와 양립).
 *   ⛔tf.style.alignSelf 가 이미 있으면 손대지 않는다(패널·사용자 임자).
 *   사상표는 새로 안 적는다 — js/props/prop-text-wireup-align.js ALIGN_SELF_OF 한 자리(editor.js ⌥ 정렬도 거기서 파생).
 *
 * ★칸
 *   P  전제 — 가운데 정렬 글상자(사람 길: 패널 가운데 단추) · 켜기 전 어긋남 0 · 켠 뒤 저장본(getSerializedCanvas)의 tf style 이 width:…px
 *   A1 ★단언 한 쌍 ⑴ — 켠 뒤 글자중심 − 섹션 내용중심 ≈ 0(1 레이아웃 px 안)
 *   A2 ★단언 한 쌍 ⑵ — 켠 뒤 패널 정렬 단추 중 «가운데» 하나만 active
 *   A3 왼쪽 정렬(textAlign 없음)엔 alignSelf 를 안 쓴다 · tf.style.alignSelf 가 이미 있으면 안 바꾼다
 *   A4 복원 — 저장본(tf 폭 px · alignSelf 없음 = 옛 파일 꼴)을 다시 열어도 alignSelf 를 안 심는다(전이 아님)
 *   A5 ✕(효과 끄기) — tf 의 alignSelf 가 켜기 전처럼 비고 폭이 100% 로 돌아온다(같은 세션)
 * ⛔고정 대기 0 — 조건 대기만.
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');

async function setup(page, { center = true } = {}) {
  await page.setViewportSize({ width: 1400, height: 1000 });
  const errs = await bootApp(page);
  const id = await page.evaluate(async () => {
    await window.addSection();
    window.addTextBlock('h1');
    const sec = [...document.querySelectorAll('#canvas .section-block')].pop();
    const tb = [...sec.querySelectorAll('.text-block')].pop();
    const ce = tb.querySelector('[contenteditable]') || tb.querySelector('.tb-h1');
    ce.textContent = '짧은 글';
    window.deselectAll?.();
    return tb.id;
  });
  const r = await waitStableRect(page, '#' + id);
  await page.mouse.click(r.cx, r.cy);
  await page.waitForFunction((id) => document.getElementById(id)?.classList.contains('selected') && !!document.querySelector('#panel-right .prop-align-btn[data-align="center"]'), id, { timeout: 3000 });
  if (center) {
    await page.click('#panel-right .prop-align-btn[data-align="center"]');
    await page.waitForFunction((id) => (document.getElementById(id).querySelector('[contenteditable]') || document.getElementById(id).querySelector('.tb-h1')).style.textAlign === 'center', id, { timeout: 3000 });
  }
  return { errs, id };
}

/** 글자중심 − 섹션 내용중심 (레이아웃 px) · tf 상태 · 정렬 단추 */
const M = (page, id) => page.evaluate((id) => {
  const tb = document.getElementById(id);
  const ce = tb.querySelector('[contenteditable]') || tb.querySelector('.tb-h1');
  const sec = tb.closest('.section-block'); const inner = sec.querySelector('.section-inner');
  const z = sec.getBoundingClientRect().width / sec.offsetWidth;
  const rg = document.createRange(); rg.selectNodeContents(ce); const g = rg.getBoundingClientRect();
  const ir = inner.getBoundingClientRect(); const ics = getComputedStyle(inner);
  const cL = ir.left + parseFloat(ics.paddingLeft) * z, cR = ir.right - parseFloat(ics.paddingRight) * z;
  const tf = tb.closest('.frame-block[data-text-frame="true"]');
  return { d: ((g.left + g.right) / 2 - (cL + cR) / 2) / z, tfW: tf?.style.width ?? null, tfAS: tf?.style.alignSelf ?? null, corners: tb.dataset.tfCorners || null,
    active: [...document.querySelectorAll('#panel-right .prop-align-btn[data-align]')].filter((b) => b.offsetParent && b.classList.contains('active')).map((b) => b.dataset.align) };
}, id);

async function ftOn(page, id) {
  await page.selectOption('#panel-right select[id$="-fx-add"]', 'freetransform');
  await page.waitForFunction((id) => !!document.getElementById(id)?.dataset.tfCorners, id, { timeout: 3000 });
  await page.waitForFunction(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(true)))));
}

test('P·A1 ★가운데 글상자에 자유변형 — 어긋남 ≈0', async ({ page }) => {
  const { errs, id } = await setup(page);
  const m0 = await M(page, id);
  expect(Math.abs(m0.d), `P 켜기 전 어긋남 ${m0.d}`).toBeLessThan(1);
  expect(m0.tfW, 'P 켜기 전 tf 폭').toBe('100%');
  await ftOn(page, id);
  const ser = await page.evaluate((id) => { const h = window.getSerializedCanvas(); const i = h.indexOf('id="' + id + '"'); const fi = h.lastIndexOf('data-text-frame="true"', i); return h.slice(Math.max(0, fi - 400), fi + 400); }, id);
  expect(ser, 'P 저장본의 tf style 이 width:…px (복원 경로는 이미 px — 전이 아님의 전제)').toMatch(/width:\s*[\d.]+px/);
  const m1 = await M(page, id);
  expect(Math.abs(m1.d), `A1 켠 뒤 어긋남 ${m1.d} (tf ${m1.tfW} · alignSelf «${m1.tfAS}»)`).toBeLessThan(1);
  expect(errs).toEqual([]);
});

/* ★단언 한 쌍의 둘째 — 따로 세운다(첫째가 빨개도 이것이 따로 가려지게 · 「하나만 초록이면 반쪽」) */
test('A2 ★가운데 글상자에 자유변형 — 패널 정렬 단추 «가운데» 하나만 켜짐', async ({ page }) => {
  const { errs, id } = await setup(page);
  await ftOn(page, id);
  await page.evaluate((id) => window.showTextProperties?.(document.getElementById(id)), id);
  await page.waitForFunction(() => !!document.querySelector('#panel-right .prop-align-btn[data-align="center"]'));
  const m2 = await M(page, id);
  expect(m2.active, 'A2 정렬 단추 — 가운데 하나만 켜짐').toEqual(['center']);
  expect(errs).toEqual([]);
});

test('A3 ★왼쪽(정렬 안 함)엔 안 쓴다 · 이미 있는 alignSelf 는 안 바꾼다', async ({ page }) => {
  const { errs, id } = await setup(page, { center: false });
  await ftOn(page, id);
  expect((await M(page, id)).tfAS, 'A3 왼쪽 글상자 — alignSelf 안 씀').toBe('');
  const s2 = await setup(page);
  await page.evaluate((id) => { document.getElementById(id).closest('.frame-block[data-text-frame="true"]').style.alignSelf = 'flex-end'; }, s2.id);
  await ftOn(page, s2.id);
  expect((await M(page, s2.id)).tfAS, 'A3 이미 있던 alignSelf(임자 있음) 그대로').toBe('flex-end');
  expect(errs).toEqual([]);
});

test('A4 ★복원 — 옛 저장본 꼴(tf px · alignSelf 없음)을 다시 열어도 alignSelf 를 안 심는다', async ({ page }) => {
  const { errs, id } = await setup(page);
  await ftOn(page, id);
  /* 옛 파일 꼴로 만든다: alignSelf 를 걷고 저장 → 다시 연다(getSerializedCanvas → innerHTML → rebindAll) */
  await page.evaluate((id) => {
    const tf = document.getElementById(id).closest('.frame-block[data-text-frame="true"]');
    tf.style.alignSelf = '';
    const html = window.getSerializedCanvas();
    document.getElementById('canvas').innerHTML = html;
    window.rebindAll?.();
  }, id);
  await page.waitForFunction((id) => !!document.getElementById(id)?.closest('.frame-block[data-text-frame="true"]'), id, { timeout: 3000 });
  await page.waitForFunction(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(true)))));
  const m = await M(page, id);
  expect(m.tfW, 'A4 복원 뒤 tf 폭은 px').toMatch(/px$/);
  expect(m.tfAS, 'A4 복원 뒤 alignSelf 를 심지 않았다(자가치유 0)').toBe('');
  expect(errs).toEqual([]);
});

test('A5 ★✕ — alignSelf 가 켜기 전처럼 비고 폭 100% 로', async ({ page }) => {
  const { errs, id } = await setup(page);
  await ftOn(page, id);
  await page.evaluate((id) => window.setFxFreeTransform(document.getElementById(id), null), id);
  await page.waitForFunction((id) => !document.getElementById(id)?.dataset.tfCorners, id, { timeout: 3000 });
  const m = await M(page, id);
  expect({ tfW: m.tfW, tfAS: m.tfAS }, 'A5 ✕ 뒤').toEqual({ tfW: '100%', tfAS: '' });
  expect(errs).toEqual([]);
});
