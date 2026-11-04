/* export-goya-inline-style.dom.spec.js — 내보낸 HTML·썸네일 클론이 인라인 style 의 자산 주소를 어디에 있든 푸는가.
 * 목업은 background 줄임꼴, 반투명 프레임은 --frame-bg-img 에 넣는다 — 긴 이름만 찾으면 goya-asset 이 남아 브라우저에서 빈칸이다.
 * 자산 IPC 는 스텁. 진짜 브라우저에서 그림이 보이는지는 앱 측정값(회신)에 있다.
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAEBgIApD5fRAAAAABJRU5ErkJggg==';
const DATA = `data:image/png;base64,${PNG}`;
const URL_ = 'goya-asset://p1/h.png';

/* 입구마다 진짜 패널 길로 파일을 넣는다(스타일 꼴을 손으로 베끼지 않는다) */
const CASES = {
  '목업(background 줄임꼴)': { add: "await window.addDeviceMockupBlock('iphone', 360); window.__b = document.querySelector('.mockup-block'); window.showMockupProperties(window.__b); document.querySelector('#mkp-upload-btn').click();" },
  '프레임 배경(줄임꼴)': { add: "window.addFrameBlock(); window.__b = [...document.querySelectorAll('.frame-block:not([data-text-frame])')].pop(); window.showFrameProperties(window.__b); document.getElementById('ss-bg-img-btn').click();" },
  '반투명 프레임(CSS 변수)': { add: "window.addFrameBlock(); window.__b = [...document.querySelectorAll('.frame-block:not([data-text-frame])')].pop(); window.showFrameProperties(window.__b); document.getElementById('ss-bg-img-btn').click();", after: "window.showFrameProperties(window.__b); const s = document.getElementById('ss-bgopa-slider'); s.value = 50; s.dispatchEvent(new Event('input', { bubbles: true })); s.dispatchEvent(new Event('change', { bubbles: true }));", needle: '--frame-bg-img' },
  '섹션 배경(긴 이름)': { add: "window.__b = document.querySelector('#canvas .section-block'); window.showSectionProperties(window.__b); document.getElementById('sec-bg-img-btn').click();" },
};

async function build(page, c, readOk) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(async ([url, data, readOk]) => {
    window.activeProjectId = 'p1';
    window.electronAPI = { ...(window.electronAPI || {}),
      assetsSaveCanvasImage: async () => ({ ok: true, url }),
      assetsReadAsDataUri: async () => (readOk ? { ok: true, dataUri: data } : { ok: false, error: 'not found' }) };
    const k = document.getElementById('canvas'); k.querySelectorAll('.section-block').forEach((s) => s.remove());
    await window.addSection();
    window.selectSection(k.querySelector('.section-block'));
    window.__blobs = []; const o = URL.createObjectURL; URL.createObjectURL = function (b) { window.__blobs.push(b); return o.call(URL, b); };
    const ck = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = function () { if (!this.download) ck.call(this); };
  }, [URL_, DATA, readOk]);
  const chooser = page.waitForEvent('filechooser');
  await page.evaluate(`(async () => { ${c.add} })()`);
  await (await chooser).setFiles({ name: 'a.png', mimeType: 'image/png', buffer: Buffer.from(PNG, 'base64') });
  await page.waitForFunction((u) => document.getElementById('canvas').innerHTML.includes(u), URL_);
  if (c.after) await page.evaluate(`(async () => { ${c.after} })()`);
  return errs;
}
const exportHtml = (page) => page.evaluate(async () => { await window.exportHTMLFile(); return window.__blobs[window.__blobs.length - 1].text(); });
const stylesOf = (html) => [...html.matchAll(/\sstyle="([^"]*)"/g)].map((m) => m[1]);

for (const [name, c] of Object.entries(CASES)) {
  test(`HTML — ${name} : 인라인 style 에 자산 주소가 안 남고 그림이 실린다`, async ({ page }) => {
    const errs = await build(page, c, true);
    if (c.needle) expect(await page.evaluate(() => window.__b.getAttribute('style'))).toContain(c.needle);
    const styles = stylesOf(await exportHtml(page));
    expect(styles.filter((s) => s.includes('goya-asset'))).toEqual([]);
    expect(styles.filter((s) => s.includes(PNG)).length).toBeGreaterThan(0);
    expect(errs).toEqual([]);
  });
  test(`[음성] HTML — ${name} : 읽기 실패면 주소를 그대로 두고 내보내기는 끝난다`, async ({ page }) => {
    const errs = await build(page, c, false);
    const styles = stylesOf(await exportHtml(page));
    expect(styles.filter((s) => s.includes('goya-asset')).length).toBeGreaterThan(0);
    expect(styles.filter((s) => s.includes(PNG))).toEqual([]);
    expect(errs).toEqual([]);
  });
  test(`썸네일 클론 — ${name} : 풀고, 라이브 DOM 은 안 건드린다`, async ({ page }) => {
    const errs = await build(page, c, true);
    const r = await page.evaluate(async () => {
      const m = await import('/js/io/goya-asset-inline.js');
      const sec = document.querySelector('#canvas .section-block');
      const live = sec.outerHTML;
      const clone = sec.cloneNode(true);
      const p = await m.prepareGoyaAssetsForClone(clone);
      const n = p.apply(clone);
      return { total: p.total, n, left: clone.outerHTML.match(/style="[^"]*goya-asset/g) || [], liveSame: sec.outerHTML === live };
    });
    expect(r.total).toBe(1);
    expect(r.n).toBeGreaterThan(0);
    expect(r.left).toEqual([]);
    expect(r.liveSame).toBe(true);
    expect(errs).toEqual([]);
  });
}
