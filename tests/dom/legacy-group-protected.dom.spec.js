/* legacy-group-protected — 옛 저장본의 .group-block 도 🔒 보호 섹션이면 Delete 로 안 지워진다.
 * 그룹을 새로 만드는 코드는 없다. 옛 저장본·템플릿에만 있어서 저장 → 다시 열기를 거쳐 잰다. */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const raf = (p) => p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

async function reopenAndDelete(page, prot) {
  await page.setViewportSize({ width: 1500, height: 1400 });
  const errs = await bootApp(page);
  await page.evaluate(async (prot) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    await window.addSection(); await window.addSection();
    const sec = c.querySelector('.section-block');
    sec.querySelector('.section-inner').insertAdjacentHTML('beforeend', '<div class="group-block" id="gLegacy" style="min-height:80px"><div class="group-inner"><div class="row"><div class="col"><div class="text-block" id="tInG" data-type="body"><div class="tb-body">옛 글자</div></div></div></div></div></div>');
    if (prot) window.setSectionProtected(sec.id, true);
    const d = window.serializeProject();
    await window.applyProjectData(typeof d === 'string' ? JSON.parse(d) : d);
    window.__toasts = []; const o = window.showToast; window.showToast = function (m) { window.__toasts.push(String(m)); return o?.apply(this, arguments); };
    document.getElementById('gLegacy').scrollIntoView({ block: 'center' });
  }, prot);
  await raf(page);
  const b = await page.evaluate(() => { const r = document.getElementById('gLegacy').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await page.mouse.click(b.x, b.y);
  await expect.poll(() => page.evaluate(() => !!document.querySelector('.group-block.group-selected')), { message: '[전제] 클릭으로 그룹이 골라졌다' }).toBe(true);
  await page.keyboard.press('Delete');
  await raf(page);
  return { errs, st: await page.evaluate(() => ({ g: !!document.getElementById('gLegacy'), t: !!document.getElementById('tInG'), toast: window.__toasts.some((x) => x.includes('보호')) })) };
}

test('P 보호 섹션의 옛 그룹은 Delete 로 안 지워지고 이유를 알린다', async ({ page }) => {
  const { errs, st } = await reopenAndDelete(page, true);
  expect(st, '★보호 섹션의 옛 그룹이 지워졌다').toEqual({ g: true, t: true, toast: true });
  expect(errs).toEqual([]);
});
test('N [음성] 미보호 섹션의 옛 그룹은 지워진다', async ({ page }) => {
  const { errs, st } = await reopenAndDelete(page, false);
  expect(st, '★미보호인데 막혔다').toEqual({ g: false, t: false, toast: false });
  expect(errs).toEqual([]);
});
