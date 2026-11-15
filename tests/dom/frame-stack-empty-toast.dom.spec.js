/* frame-stack-empty-toast — FRAME-STACK-EMPTY-FRAME-NATIVE-ALERT-01 (0.9.12 · 지디 261116).
 * «빈» 자유 프레임에서 「stack」 단추 → 네이티브 alert «빈 프레임은 stack 으로 바꿀 수 없습니다…» 로 렌더러가 멈췄다.
 * FRAME-STACK-BUTTON-NATIVE-ALERT-01(나란히 자식 · frame-stack-sidebyside-toast.dom.spec.js)과 같은 고침 — 앱 안 토스트(#editor-toast).
 * E1 대화창 0 · 토스트 «빈 프레임» · 프레임은 자유배치 그대로.
 * 양성대조(srv 미실행): js/props/prop-frame.js 의 그 showToast 줄을 alert(...) 로 되돌리면 E1 빨강
 *   (dialogs 1 · 토스트가 안 떠 poll 시간초과).
 * ⛔고정 대기 0 — 토스트는 expect.poll 로 기다린다 · 앱 = bootApp.
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

test('E1 빈 자유 프레임 stack — 네이티브 대화창 없이 앱 안 토스트 · 자유배치 그대로', async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  const fr = await page.evaluate(() => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', `<div class="section-block" id="sEF" data-section="1"><div class="section-hitzone"><span class="section-label">sEF</span></div><div class="section-inner"><div class="gap-block" data-type="gap" style="height:40px"></div></div></div>`);
    window.rebindAll?.(); window.applyZoom?.(60);
    window.deselectAll?.(); window._activeFrame = null; window.selectSection?.(document.getElementById('sEF'));
    const before = new Set([...document.querySelectorAll('#canvas .frame-block')].map(e => e.id));
    window.addFrameBlock();
    const f = [...document.querySelectorAll('#canvas .frame-block:not([data-text-frame])')].find(e => !before.has(e.id));
    f.style.height = '300px'; f.style.minHeight = '300px';
    window.deselectAll?.(); window._activeFrame = null;
    return { id: f.id, free: f.dataset.freeLayout, kids: [...f.children].filter(k => k.style.position === 'absolute' && k.id).length };
  });
  expect({ free: fr.free, kids: fr.kids }, '[전제] 빈 자유 프레임').toEqual({ free: 'true', kids: 0 });
  const dialogs = [];
  page.on('dialog', d => { dialogs.push(d.message()); d.dismiss().catch(() => {}); });   // ★진짜 네이티브 대화창을 센다
  const r = await page.evaluate((id) => { const e = document.getElementById(id).getBoundingClientRect(); return { x: e.left + e.width * 0.9, y: e.top + e.height * 0.9 }; }, fr.id);
  await page.mouse.click(r.x, r.y);
  await expect(page.locator('#ss-to-stack-btn'), '[전제] stack 단추').toBeVisible();
  await page.click('#ss-to-stack-btn');
  await expect.poll(() => page.evaluate(() => { const e = document.getElementById('editor-toast'); return e && e.classList.contains('show') ? e.textContent : ''; }),
    '앱 안 토스트 문구').toContain('빈 프레임은 stack 으로 바꿀 수 없습니다');
  expect(dialogs, '★네이티브 alert 이 떴다 — 렌더러가 멈춘다').toEqual([]);
  expect(await page.evaluate((id) => document.getElementById(id).dataset.freeLayout, fr.id), '자유배치 그대로').toBe('true');
  expect(errs, errs.join('\n')).toEqual([]);
});
