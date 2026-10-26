/* t2d3-mix-scope.dom.spec.js — 1020t2d3 「mix 판정 — 커서 자리·선택 영역이면 그 영역의 실제 값. 폰트크기 외 색상 등 mix 나는 칸 전부」
 *
 * ★잰 값(S3 실앱 8608bb13 ×3): 글상자 「AAA」(36px · 빨강 · 400) + 「BBB」(60px · 700) —
 *   ⒜ 블럭만 · ⒝ BBB 안 커서 · ⒞ BBB 선택 «셋 다» 크기·색·굵기 = Mix (선택 영역의 실제 값 60·700·그 색이 아니다).
 * ★분모(정의 자리를 읽어 셌다): js/props/prop-text-mix-detect.js detectMix — 칸 셋(color · fontSize · fontWeight) · 범위 = 블럭 전체.
 *   그리는 자리 셋 = js/props/_typo-section.js(크기 · 굵기 · 색) · mix 를 넘기는 패널 = 텍스트 블럭 하나(prop-text.js).
 * ★처방(지디 (25)) — detectMix 에 «범위»(커서면 그 노드 · 선택이면 그 영역) · 텍스트 패널이 편집 중 선택을 그 범위로 넘긴다.
 *   ⛔prop-multisel.js · prop-text-wireup-text-edit.js 의 부르는 자리는 그대로(인자 없음 = 옛 «블럭 전체»).
 *
 * ★칸
 *   P  전제 — 장면이 정말 섞였다(⒜ 셋 다 Mix)
 *   ⒜ 블럭만 고름 ⇒ 셋 다 Mix 그대로(지키는 칸)
 *   ⒝ 편집 · BBB 안 커서 ⇒ 크기 60 · 굵기 700 · 색 = BBB 의 계산된 색
 *   ⒞ BBB 선택 ⇒ 크기 60 · 굵기 700 · 색 = BBB 의 계산된 색
 * ⛔고정 대기 0 — 조건 대기만.
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');

const PANEL = () => {
  const s = document.getElementById('txt-size-number'), hx = document.getElementById('txt-color-hex');
  const w = document.querySelector('#panel-right select[id*="weight"]');
  return { size: s ? s.value : null, sizePh: s ? s.placeholder : null, hex: hx ? hx.value : null, hexPh: hx ? hx.placeholder : null,
    weight: w ? (w.options[w.selectedIndex] || {}).textContent : null };
};

async function setup(page) {
  await page.setViewportSize({ width: 1400, height: 1000 });
  const errs = await bootApp(page);
  const id = await page.evaluate(async () => {
    await window.addSection();
    window.addTextBlock('body');
    const tb = [...document.querySelectorAll('#canvas .text-block')].pop();
    const ce = tb.querySelector('[contenteditable]') || tb.querySelector('.tb-body');
    ce.innerHTML = '<span style="font-size:36px;color:#ff0000;font-weight:400">AAA</span> <span style="font-size:60px;font-weight:700">BBB</span>';
    window.deselectAll?.();
    return tb.id;
  });
  const r = await waitStableRect(page, '#' + id);
  await page.mouse.click(r.left + 10, r.cy);
  await page.waitForFunction(() => !!document.getElementById('txt-size-number'), null, { timeout: 3000 });
  const a = await page.evaluate(PANEL);
  expect([a.sizePh, a.hexPh, a.weight], 'P·⒜ 블럭만 — 셋 다 Mix').toEqual(['Mix', 'Mix', 'Mix']);
  const bbb = await page.evaluate((id) => {
    const sp = [...document.getElementById(id).querySelectorAll('span')].find((s) => s.textContent === 'BBB');
    const rr = sp.getBoundingClientRect(); const cs = getComputedStyle(sp);
    const m = cs.color.match(/\d+/g).map(Number); const hex = m.slice(0, 3).map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();
    return { x: rr.left + rr.width / 2, y: rr.top + rr.height / 2, l: rr.left + 2, r: rr.right - 2, hex };
  }, id);
  await page.mouse.dblclick(bbb.x, bbb.y);
  await page.waitForFunction((id) => document.getElementById(id).querySelector('[contenteditable="true"]') !== null, id, { timeout: 3000 });
  return { errs, id, bbb };
}
const settle60 = (page) => page.waitForFunction(() => { const s = document.getElementById('txt-size-number'); return s && s.value === '60'; }, null, { timeout: 3000 }).catch(() => {});

test('P·⒜·⒝ ★편집 중 BBB 안 커서 ⇒ 그 노드의 실제 값', async ({ page }) => {
  const { errs, bbb } = await setup(page);
  await page.mouse.click(bbb.x, bbb.y);
  await settle60(page);
  const b = await page.evaluate(PANEL);
  expect({ size: b.size, weight: b.weight, hex: b.hex }, '⒝ BBB 안 커서').toEqual({ size: '60', weight: 'Bold 700', hex: bbb.hex });
  expect(errs).toEqual([]);
});

test('P·⒜·⒞ ★편집 중 BBB 선택 ⇒ 그 영역의 실제 값', async ({ page }) => {
  const { errs, bbb } = await setup(page);
  /* 편집 진입(더블클릭)은 글 전체를 고른다 — 그 상태에서 바로 끌면 하네스에서 선택이 안 선다(고치기 전 판에서도 '' · 실측).
     사람처럼 한 번 눌러 커서를 놓고 끈다(실앱 순서와 같다). */
  await page.mouse.click(bbb.x, bbb.y);
  await page.mouse.move(bbb.l, bbb.y); await page.mouse.down(); await page.mouse.move(bbb.r, bbb.y, { steps: 8 }); await page.mouse.up();
  await page.waitForFunction(() => String(window.getSelection()) === 'BBB', null, { timeout: 3000 }).catch(() => {});
  expect(await page.evaluate(() => String(window.getSelection())), '⒞ 전제: 선택 글자').toBe('BBB');
  await settle60(page);
  const c = await page.evaluate(PANEL);
  expect({ size: c.size, weight: c.weight, hex: c.hex }, '⒞ BBB 선택').toEqual({ size: '60', weight: 'Bold 700', hex: bbb.hex });
  expect(errs).toEqual([]);
});

/* ── (47) ㉡ 편집 복귀(prop-text-wireup-text-edit.js focusin) 도 셋 다 다시 판정 ─────────────────────────
 *   E1 섞인 글 전체를 고른 채 패널 칸으로 갔다가(굵기·색 칸에 옛 값이 남은 꼴) 글자칸으로 돌아오면 ⇒ 크기·굵기·색 셋 다 Mix
 *      (★이 순간 tb._mixKey 는 그대로라 selectionchange 다시 그리기는 안 돈다 — 편집 복귀 판정 «하나»만 잰다)
 * ── ⒟ 음성대조 — 균일한 글에서는 Mix 가 안 뜬다(셋 칸 × 블럭만·커서·선택) ── */
test('E1 ★편집 복귀 — 크기·굵기·색 셋 다 Mix 로 다시 판정', async ({ page }) => {
  const { errs, id } = await setup(page);
  const bbb = await page.evaluate((id) => { const sp = [...document.getElementById(id).querySelectorAll('span')].find((s) => s.textContent === 'BBB'); const r = sp.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, id);
  await page.mouse.click(bbb.x, bbb.y);
  /* 글 전체 선택 → 패널이 Mix 로 다시 그려질 때까지(㉠ 길) */
  await page.evaluate((id) => { const ce = document.getElementById(id).querySelector('[contenteditable="true"]'); const r = document.createRange(); r.selectNodeContents(ce); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }, id);
  await page.waitForFunction(() => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(() => res(true)))));
  await page.waitForFunction(() => document.getElementById('txt-color-hex')?.placeholder === 'Mix', null, { timeout: 3000 });
  /* 패널 칸으로 갔다가 — 굵기·색 칸에 옛 값(비-Mix)이 남은 꼴을 만든다 */
  await page.evaluate(() => {
    const w = document.getElementById('txt-font-weight'); [...w.options].filter((o) => o.value === '' && o.disabled).forEach((o) => o.remove()); w.value = '400';
    const hx = document.getElementById('txt-color-hex'); hx.placeholder = ''; hx.value = '111111';
    document.getElementById('txt-size-number').focus();
  });
  /* 글자칸으로 돌아온다(선택은 그대로 전체) */
  await page.evaluate((id) => { const ce = document.getElementById(id).querySelector('[contenteditable="true"]'); const r = document.createRange(); r.selectNodeContents(ce); const s = getSelection(); s.removeAllRanges(); s.addRange(r); ce.focus(); }, id);
  /* 편집 복귀 판정은 한 프레임 뒤에 돈다 — 크기 칸은 이미 Mix 라 그걸로 기다리면 안 된다(색 칸으로 기다린다) */
  await page.waitForFunction(() => document.getElementById('txt-color-hex')?.placeholder === 'Mix', null, { timeout: 3000 }).catch(() => {});
  const e = await page.evaluate(PANEL);
  expect([e.sizePh, e.weight, e.hexPh, e.hex], 'E1 셋 다 Mix').toEqual(['Mix', 'Mix', 'Mix', '']);
  expect(errs).toEqual([]);
});

async function setupUniform(page) {
  await page.setViewportSize({ width: 1400, height: 1000 });
  const errs = await bootApp(page);
  const id = await page.evaluate(async () => {
    await window.addSection();
    window.addTextBlock('body');
    const tb = [...document.querySelectorAll('#canvas .text-block')].pop();
    const ce = tb.querySelector('[contenteditable]') || tb.querySelector('.tb-body');
    ce.innerHTML = '<span style="font-size:40px;color:#333333;font-weight:700">CCC</span> <span style="font-size:40px;color:#333333;font-weight:700">DDD</span>';
    window.deselectAll?.();
    return tb.id;
  });
  const r = await waitStableRect(page, '#' + id);
  await page.mouse.click(r.left + 10, r.cy);
  await page.waitForFunction(() => !!document.getElementById('txt-size-number'), null, { timeout: 3000 });
  return { errs, id };
}
const noMix = (p) => [p.sizePh, p.weight, p.hexPh].map((v) => v === 'Mix');

test('N1 ⒟ 균일한 글 — 블럭만: Mix 0', async ({ page }) => {
  const { errs } = await setupUniform(page);
  const p = await page.evaluate(PANEL);
  expect(noMix(p), `N1 ${JSON.stringify(p)}`).toEqual([false, false, false]);
  expect(errs).toEqual([]);
});

test('N2·N3 ⒟ 균일한 글 — 커서·선택: Mix 0', async ({ page }) => {
  const { errs, id } = await setupUniform(page);
  const d = await page.evaluate((id) => { const sp = [...document.getElementById(id).querySelectorAll('span')].find((s) => s.textContent === 'DDD'); const r = sp.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, l: r.left + 2, r: r.right - 2 }; }, id);
  await page.mouse.dblclick(d.x, d.y);
  await page.waitForFunction((id) => document.getElementById(id).querySelector('[contenteditable="true"]') !== null, id, { timeout: 3000 });
  await page.mouse.click(d.x, d.y);
  await page.waitForFunction(() => !!document.getElementById('txt-size-number'), null, { timeout: 3000 });
  const p2 = await page.evaluate(PANEL);
  expect(noMix(p2), `N2 커서 ${JSON.stringify(p2)}`).toEqual([false, false, false]);
  await page.evaluate((id) => { const ce = document.getElementById(id).querySelector('[contenteditable="true"]'); const r = document.createRange(); r.selectNodeContents(ce); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }, id);
  await page.waitForFunction(() => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(() => res(true)))));
  const p3 = await page.evaluate(PANEL);
  expect(noMix(p3), `N3 전체 선택 ${JSON.stringify(p3)}`).toEqual([false, false, false]);
  expect(errs).toEqual([]);
});
