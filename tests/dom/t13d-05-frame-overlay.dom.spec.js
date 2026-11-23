/* t13d-05 — 0.9.13 t13D-05 프레임 블럭에 오버레이 모드(일반 배치 ↔ 오버레이 전환)
 * 고침: prop-frame.js — 그룹만 달던 오버레이 단추(#ss-float-toggle · wireFloatToggle 한 벌)를 «섹션 흐름의 일반 프레임»까지(_canFloat).
 * F1 프레임 고름 → Position 머리 오버레이 단추를 누르면 → 오버레이(섹션 직속 absolute) · 화면 자리 그대로 · 자식 글자 그대로 안 · 아래 흐름 글자가 올라옴
 * F2 떠 있는 프레임 몸을 끌면 자리가 옮고 자식 글자도 같이 감(프레임 안 상대 자리 그대로) · se 손잡이로 크기도 바뀜
 * F3 단추를 다시 누르면 흐름 제자리(위 글자와 아래 글자 사이)로 돌아옴
 * F4 다른 프레임 «안»의 프레임에는 단추 없음(t13D-06 몫)
 * 양성대조: _patches/t13d-05-CTL.patch(prop-frame.js _canFloat → 옛 «그룹만») → F1·F2·F3 빨강 · F4 초록.
 *          _patches/t13d-05-CTL-drag.patch(overlay-float.js 떠 있는 동안 draggable 끄기 걷음) → F2 빨강(첫 걸음 뒤 네이티브 dragstart 가 가로챔).
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitZoomSettled } = require('./_root-harness.js');

const raf = (p) => p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const rect = (page, sel) => page.evaluate((s) => { const q = document.querySelector(s).getBoundingClientRect(); return [q.left, q.top, q.width, q.height].map(Math.round); }, sel);

async function scene(page) {
  await page.setViewportSize({ width: 1600, height: 1300 });
  const errs = await bootApp(page);
  await page.evaluate(async () => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); await window.addSection();
    c.querySelector('.section-block').id = 'sF'; window.applyZoom?.(100);
  });
  await waitZoomSettled(page, 100);
  await page.evaluate(() => {
    const sec = document.getElementById('sF'), inner = sec.querySelector('.section-inner'); document.getElementById('canvas-wrap').scrollTop = 0; sec.scrollIntoView({ block: 'start' });
    [...inner.children].forEach((x) => { if (!x.classList.contains('drop-indicator')) x.remove(); });
    const fresh = (sel, fn) => { const before = new Set(sec.querySelectorAll(sel)); window.deselectAll(); window.selectSection(sec); fn(); return [...sec.querySelectorAll(sel)].find((x) => !before.has(x)); };
    const txt = (id, t) => { const tf = fresh('.frame-block[data-text-frame]', () => window.addTextBlock('body')); tf.id = id; const ed = tf.querySelector('[class^="tb-"]'); ed.textContent = t; delete ed.dataset.isPlaceholder; return tf; };
    txt('tfT', '위 글자');
    const fr = fresh('.frame-block:not([data-text-frame])', () => window.addFrameBlock()); fr.id = 'frO';
    window.updateFrameBlock?.('frO', { width: 360, height: 180 });
    txt('tfU', '아래 글자');
    /* 프레임 자식 글자(절대 자리) */
    const kid = document.getElementById('tfU').cloneNode(true); kid.id = 'tfK'; kid.querySelectorAll('[id]').forEach((n) => n.removeAttribute('id'));
    kid.style.position = 'absolute'; kid.style.left = '20px'; kid.style.top = '20px'; kid.style.width = '160px'; kid.dataset.offsetX = '20'; kid.dataset.offsetY = '20';
    kid.querySelector('[class^="tb-"]').textContent = '자식';
    fr.appendChild(kid);
    window.rebindAll?.(); window.deselectAll(); document.activeElement?.blur?.(); window.clearHistory?.();
  });
  await raf(page);
  const pre = await page.evaluate(() => { const f = document.getElementById('frO'); return { flow: getComputedStyle(f).position !== 'absolute', kidIn: f.contains(document.getElementById('tfK')), order: [...f.parentElement.children].filter((x) => x.id).map((x) => x.id) }; });
  expect(pre.flow && pre.kidIn, `[전제] 흐름 프레임 · 자식 안 ${JSON.stringify(pre)}`).toBe(true);
  return errs;
}
/* 프레임 고르기 = 사람 길(빈 몸 클릭) · 패널 열림 */
async function pickFrame(page) {
  const [x, y, w, h] = await rect(page, '#frO');
  await page.mouse.click(x + w - 30, y + h - 30); await raf(page);
  await page.evaluate(() => { const f = document.getElementById('frO'); if (!f.classList.contains('selected')) { window.selectBlock?.('frO'); } window.showFrameProperties?.(f); window.showHandlesFor?.(f); });
  await raf(page);
}
const toggle = async (page) => { const b = await page.evaluate(() => { const e = document.getElementById('ss-float-toggle'); if (!e) return null; e.scrollIntoView({ block: 'center' }); const q = e.getBoundingClientRect(); return [q.left + q.width / 2, q.top + q.height / 2]; });
  expect(b, '★프레임 패널에 오버레이 단추').toBeTruthy(); await page.mouse.click(b[0], b[1]); await raf(page); };
const state = (page) => page.evaluate(() => { const f = document.getElementById('frO'), k = document.getElementById('tfK'), fr = f.getBoundingClientRect(), kr = k.getBoundingClientRect();
  return { ov: f.dataset.overlayBlock || null, abs: getComputedStyle(f).position === 'absolute', par: f.parentElement.classList.contains('section-block') ? 'section' : f.parentElement.className.slice(0, 20),
    f: [fr.left, fr.top, fr.width].map(Math.round), kidIn: f.contains(k), kidRel: [Math.round(kr.left - fr.left), Math.round(kr.top - fr.top)], uTop: Math.round(document.getElementById('tfU').getBoundingClientRect().top) }; });

test('F1 오버레이 단추 → 섹션 직속 오버레이 · 화면 자리 그대로 · 자식 그대로 · 아래 글자 올라옴', async ({ page }) => {
  const errs = await scene(page);
  await pickFrame(page);
  const a = await state(page);
  await toggle(page);
  const b = await state(page);
  expect([b.ov, b.abs, b.par], '★오버레이 · absolute · 섹션 직속').toEqual(['true', true, 'section']);
  expect(b.f.map((v, i) => Math.abs(v - a.f[i]) <= 1), `★화면 자리 그대로 ${JSON.stringify([a.f, b.f])}`).toEqual([true, true, true]);
  expect([b.kidIn, b.kidRel], '★자식 글자 그대로 안 · 상대 자리 그대로').toEqual([true, a.kidRel]);
  expect(b.uTop, `★아래 글자가 올라옴(프레임이 흐름에서 빠짐) ${a.uTop}→${b.uTop}`).toBeLessThan(a.uTop - 100);
  expect(errs).toEqual([]);
});

test('F2 떠 있는 프레임을 끌면 자식도 같이 · se 손잡이로 크기', async ({ page }) => {
  const errs = await scene(page);
  await pickFrame(page); await toggle(page);
  const a = await state(page);
  const [x, y, w, h] = await rect(page, '#frO');
  const secB = await page.evaluate(() => Math.round(document.getElementById('sF').getBoundingClientRect().bottom));
  const p = [x + w - 30, Math.min(y + h - 30, secB - 10)];   // ★전제 바뀜(현빈 261123 t13E-07 Clip content 기본 켬) — 떠서 섹션이 줄면 프레임 아래 몸통은 섹션 밖이라 잘려 안 잡힌다(실측 섹션 바닥 159 · 프레임 102~282) ⇒ 보이는 자리를 잡는다 · 끈 만큼 기대 무변
  await page.mouse.move(p[0], p[1]); await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(p[0] + 140 * i / 10, p[1] + 70 * i / 10);
  await page.mouse.up(); await raf(page);
  const b = await state(page);
  /* 허용 10 = 스마트 가이드 자석 임계(t13D-04 · 섹션 오버레이 끌기) */
  expect([Math.abs(b.f[0] - a.f[0] - 140) <= 10, Math.abs(b.f[1] - a.f[1] - 70) <= 10], `★프레임이 끈 만큼 ${JSON.stringify([a.f, b.f])}`).toEqual([true, true]);
  expect([b.kidIn, b.kidRel], '★자식도 같이(상대 자리 그대로)').toEqual([true, a.kidRel]);
  await page.evaluate(() => { window.showHandlesFor?.(document.getElementById('frO')); }); await raf(page);
  const se = await page.evaluate(() => { const h = [...document.querySelectorAll('#ss-handles-overlay .ss-resize-handle')].find((e) => e.dataset.dir === 'se' && getComputedStyle(e).display !== 'none'); if (!h) return null; const q = h.getBoundingClientRect(); return [q.left + q.width / 2, q.top + q.height / 2]; });
  expect(se, '[전제] se 손잡이').toBeTruthy();
  await page.mouse.move(se[0], se[1]); await page.mouse.down(); await page.mouse.move(se[0] + 80, se[1] + 40, { steps: 6 }); await page.mouse.up(); await raf(page);
  const c = await state(page);
  expect(c.f[2], `★se 로 폭 커짐 ${b.f[2]}→${c.f[2]}`).toBeGreaterThan(b.f[2] + 40);
  expect(c.ov, '★여전히 오버레이').toBe('true');
  expect(errs).toEqual([]);
});

test('F3 단추 다시 → 흐름 제자리(위·아래 글자 사이)', async ({ page }) => {
  const errs = await scene(page);
  await pickFrame(page); await toggle(page);
  await pickFrame(page); await toggle(page);
  const r = await page.evaluate(() => { const f = document.getElementById('frO'); return { drag: f.getAttribute('draggable'), ov: f.dataset.overlayBlock || null, abs: getComputedStyle(f).position === 'absolute', order: [...f.parentElement.children].filter((x) => x.id).map((x) => x.id) }; });
  expect([r.ov, r.abs, r.drag], '★오버레이 풀림 · 흐름 · 흐름 끌기(draggable) 되돌림').toEqual([null, false, 'true']);
  expect(r.order.indexOf('tfT') < r.order.indexOf('frO') && r.order.indexOf('frO') < r.order.indexOf('tfU'), `★제자리 ${JSON.stringify(r.order)}`).toBe(true);
  expect(errs).toEqual([]);
});

test('F4 다른 프레임 안의 프레임에는 오버레이 단추 없음', async ({ page }) => {
  const errs = await scene(page);
  const has = await page.evaluate(() => { const outer = document.getElementById('frO'); window.deselectAll(); window.selectSection(document.getElementById('sF')); window.addFrameBlock();
    const nf = [...document.querySelectorAll('#sF .frame-block:not([data-text-frame])')].find((x) => x.id !== 'frO' && !outer.contains(x)); nf.id = 'frIn';
    nf.style.position = 'absolute'; nf.style.left = '150px'; nf.style.top = '60px'; outer.appendChild(nf); window.rebindAll?.();
    window.showFrameProperties(nf); const inner = !!document.getElementById('ss-float-toggle'); window.showFrameProperties(outer); const top = !!document.getElementById('ss-float-toggle'); return { inner, top }; });
  expect(has.inner, '★안쪽 프레임엔 단추 없음').toBe(false);
  expect(errs).toEqual([]);
});
