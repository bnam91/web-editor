/* frame-stack-sidebyside-toast — FRAME-STACK-BUTTON-NATIVE-ALERT-01 (0.9.12 · 미카사 발주10 곁 발견 261110).
 * 나란히 놓인 자식이 있는 자유 프레임에서 「stack」 단추를 누르면 네이티브 alert 이 떠 앱이 얼고 CDP 도 막혔다.
 * 이제 앱 안 토스트(#editor-toast)로 알리고 프레임은 자유배치 그대로.
 * SB1 [새 것] 대화창 0 · 토스트 문구 · 바뀌지 않음.  SB2 [지킴] 위아래로 놓인 자식은 그대로 stack 으로 바뀐다(음성대조).
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

async function scene(page, sideBySide) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  await bootApp(page);
  return page.evaluate((sideBySide) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', `<div class="section-block" id="sSB" data-section="1"><div class="section-hitzone"><span class="section-label">sSB</span></div><div class="section-inner"><div class="gap-block" data-type="gap" style="height:40px"></div></div></div>`);
    window.rebindAll?.(); window.applyZoom?.(60);
    const sec = document.getElementById('sSB');
    const made = (sel, fn) => { const b = new Set([...document.querySelectorAll('#canvas ' + sel)].map(e => e.id)); fn(); return [...document.querySelectorAll('#canvas ' + sel)].find(e => !b.has(e.id)); };
    window.deselectAll?.(); window._activeFrame = null; window.selectSection?.(sec);
    const fr = made('.frame-block:not([data-text-frame])', () => window.addFrameBlock());
    for (let i = 0; i < 3; i++) {
      window.deselectAll?.(); window._activeFrame = fr;
      const t = made('.text-block', () => window.addTextBlock('body'));
      const ed = t.querySelector('[contenteditable]') || t.querySelector('[class^="tb-"]'); if (ed) ed.textContent = '글자 ' + (i + 1);
      const tu = t.closest('.frame-block[data-text-frame]') || t;
      tu.style.width = '160px';
      // 나란히: 앞 둘이 같은 행 · 위아래: 세 줄
      tu.style.left = (sideBySide && i < 2 ? 40 + i * 260 : 40) + 'px';
      tu.style.top = (sideBySide && i < 2 ? 40 : 40 + i * 110) + 'px';
    }
    fr.style.height = '420px'; fr.style.minHeight = '420px';
    window.deselectAll?.(); window._activeFrame = null;
    return fr.id;
  }, sideBySide);
}
async function pressStack(page, fr) {
  const dialogs = [];
  page.on('dialog', d => { dialogs.push(d.message()); d.dismiss().catch(() => {}); });
  const r = await page.evaluate((id) => { const e = document.getElementById(id).getBoundingClientRect(); return { x: e.left + e.width * 0.9, y: e.top + e.height * 0.9 }; }, fr);
  await page.mouse.click(r.x, r.y);
  await page.waitForSelector('#ss-to-stack-btn', { timeout: 5000 });
  await page.click('#ss-to-stack-btn');
  await page.waitForTimeout(150);
  return dialogs;
}

test('SB1 나란히 놓인 자식 — 네이티브 대화창 없이 앱 안 토스트 · 프레임은 자유배치 그대로', async ({ page }) => {
  const fr = await scene(page, true);
  const dialogs = await pressStack(page, fr);
  expect(dialogs, '네이티브 alert/confirm 이 떴다').toEqual([]);
  const t = await page.evaluate(() => { const e = document.getElementById('editor-toast'); return e ? { txt: e.textContent, show: e.classList.contains('show') } : null; });
  expect(t && t.show).toBe(true);
  expect(t.txt).toContain('나란히 놓인 자식');
  expect(await page.evaluate((id) => document.getElementById(id).dataset.freeLayout, fr)).toBe('true');
});

test('SB2 [지킴] 위아래로 놓인 자식 — 대화창·토스트 없이 stack 으로 바뀐다', async ({ page }) => {
  const fr = await scene(page, false);
  const dialogs = await pressStack(page, fr);
  expect(dialogs).toEqual([]);
  await page.waitForFunction((id) => document.getElementById(id).dataset.freeLayout !== 'true', fr, { timeout: 5000 });
  expect(await page.evaluate(() => document.getElementById('editor-toast')?.textContent || '')).not.toContain('나란히');
});
