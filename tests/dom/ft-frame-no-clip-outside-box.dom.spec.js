/* ft-frame-no-clip-outside-box.dom.spec.js — PNG72 자유변형 글자는 선택을 풀어도·HTML 내보내기에서도 글상자 프레임에 안 잘린다.
 * 자 ↔ 양: 글자 프레임 computed overflow ↔ 자르나 · 글자 범위 왼쪽 − 프레임 왼쪽 ↔ 밖으로 나갔나(전제) · offsetHeight ↔ 레이아웃.
 * PNG·편집 화면의 픽셀은 앱 값으로 잰다(이 판 하네스는 네이티브 캡처가 없다).
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const OUT_LEFT = [[60, 0], [395, 0], [395, 124], [-200, 124]];
const frames = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

async function scene(page, C, frameData) {
  await page.evaluate(async ([C, frameData]) => {
    const ft = await import('/js/effects-freetransform.js');
    const canvas = document.getElementById('canvas');
    canvas.querySelectorAll('.section-block').forEach((s) => s.remove());
    await window.addSection();
    const sec = [...canvas.querySelectorAll('.section-block')].pop();
    window.getSelectedSection = () => sec; window._activeFrame = null;
    await window.addTextBlock('h1');
    const tb = [...sec.querySelectorAll('.text-block')].pop();
    tb.id = 'p1';
    tb.querySelector('[contenteditable]').textContent = '첫 줄 제목';
    if (C) { ft.resetFxFreeTransform(tb, { history: false }); ft.setFxFreeTransform(tb, C, { history: false, touched: true }); }
    Object.assign(tb.closest('.frame-block[data-text-frame]').dataset, frameData || {});
    window.deselectAll?.();
  }, [C, frameData]);
  await frames(page);
}
const read = (page) => page.evaluate(() => {
  const tb = document.getElementById('p1'), f = tb.closest('.frame-block[data-text-frame]');
  const g = document.createRange(); g.selectNodeContents(tb.querySelector('[contenteditable]').firstChild);
  return { ov: getComputedStyle(f).overflow, out: f.getBoundingClientRect().left - g.getBoundingClientRect().left, fH: f.offsetHeight, secH: f.closest('.section-block').offsetHeight };
});

test('F1 밖으로 나간 자유변형 글자 — 선택을 풀어도 프레임이 안 자른다 · 레이아웃은 그대로', async ({ page }) => {
  await bootApp(page);
  await scene(page, OUT_LEFT);
  const a = await read(page);
  expect(a.out, '전제: 글자가 프레임 왼쪽 밖').toBeGreaterThan(20);
  expect(a.ov).toBe('visible');
  await page.evaluate(() => { document.getElementById('p1').closest('.frame-block[data-text-frame]').style.overflow = 'hidden'; });
  const forced = await read(page);
  expect(forced.ov, '양성: 자의 hidden 을 읽을 줄 안다').toBe('hidden');
  expect([forced.fH, forced.secH], '자르던 때와 높이가 같다').toEqual([a.fH, a.secH]);
});

test('F2 HTML 내보내기 — 자유변형 프레임은 visible, 안 건 글자 프레임은 그대로 hidden', async ({ page }) => {
  await bootApp(page);
  await scene(page, OUT_LEFT);
  const r = await page.evaluate(async () => {
    const sec = document.querySelector('#canvas .section-block');
    window.getSelectedSection = () => sec;
    await window.addTextBlock('body');
    const orig = URL.createObjectURL; let got = null;
    URL.createObjectURL = (b) => { got = b; return orig.call(URL, b); };
    try { await window.exportHTMLFile(); } finally { URL.createObjectURL = orig; }
    const fr = document.createElement('iframe'); fr.style.cssText = 'position:absolute;left:0;top:0;width:860px;height:800px';
    document.body.appendChild(fr);
    const html = await got.text();
    await new Promise((res) => { fr.onload = res; fr.srcdoc = html; });
    const d = fr.contentDocument;
    const ov = (el) => el && getComputedStyle(el).overflow;
    const out = { ft: ov(d.querySelector('[data-tf-corners]')?.closest('[data-text-frame]')), plain: ov(d.querySelector('.text-block:not([data-tf-corners])')?.closest('[data-text-frame]')) };
    fr.remove();
    return out;
  });
  expect(r).toEqual({ ft: 'visible', plain: 'hidden' });
});

test('F3 음성 — 둥근 프레임·「내용 자르기」 켬·자유변형 없는 글자는 계속 자른다', async ({ page }) => {
  await bootApp(page);
  for (const data of [{ radius: '8' }, { clipContent: 'true' }]) {
    await scene(page, OUT_LEFT, data);
    expect((await read(page)).ov, JSON.stringify(data)).toBe('hidden');
  }
  await scene(page, null);
  const plain = await page.evaluate(() => { const b = document.createElement('div'); b.className = 'frame-block'; b.dataset.textFrame = 'true'; document.querySelector('#canvas .section-inner').appendChild(b); const v = getComputedStyle(b).overflow; b.remove(); return v; });
  expect(plain).toBe('hidden');
});
