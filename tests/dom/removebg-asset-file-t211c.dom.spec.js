/* removebg-asset-file-t211c.dom.spec.js — t2-11c (t2-11 QA B2): remove.bg 결과를 문서에 base64 로 박지 않고 다른 그림처럼 자산 파일로.
 *   옛: projectId 를 window.state?.id || window.currentProjectId 로 찾아 늘 비어 → 늘 data: 인라인.
 *   새: 다른 그림 입구와 같은 문 grdAssetSrcFor(prop-grid.js) — assetsSaveCanvasImage → goya-asset:// · 프로젝트 없으면 data URL.
 *   H1 프로젝트 열림 → 자산 저장 1회(PNG b64) → 블럭 src·data-img-src 가 goya-asset:// · serializeProject 에 data:image/png;base64 없음
 *   H2 ⌘Z 한 번 → 옛 그림
 *   H3 [대조] 프로젝트 없음 → 자산 저장 0 · data URL(다른 입구와 같은 동작 — 저장 때 외부화가 거둔다)
 * ★양성대조: js/removebg-plugin.js 를 55d7e759d 로 되돌리면 H1·H2 빨강. 실제 키·API 호출 0(전부 가짜 electronAPI). */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const OUT_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAEBgIApD5fRAAAAABJRU5ErkJggg==';
const URL_OUT = 'goya-asset://p1/h1.png';

async function setup(page, { project = true } = {}) {
  await page.addInitScript(([OUT_B64, URL_OUT]) => {
    window.__cuts = []; window.__saves = [];
    const fake = {
      hasApiKey: async () => true,
      removebgCutout: async (p) => { window.__cuts.push(p); return { ok: true, b64: OUT_B64, mime: 'image/png' }; },
      assetsSaveCanvasImage: async (a) => { window.__saves.push(a); return { ok: true, url: URL_OUT }; },
    };
    Object.defineProperty(window, 'electronAPI', { configurable: true, get: () => new Proxy(fake, { get: (t, k) => (k in t ? t[k] : () => Promise.resolve(null)) }), set: () => {} });
  }, [OUT_B64, URL_OUT]);
  const errs = await bootApp(page);
  await page.evaluate(([PNG, project]) => {
    if (project) window.activeProjectId = 'p1';
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', `<div class="section-block" id="sR" data-section="1"><div class="section-hitzone"></div><div class="section-inner">
      <div class="row" data-layout="stack"><div class="asset-block" id="abR" data-img-src="${PNG}" style="width:200px;height:120px"><img class="asset-img" src="${PNG}"></div></div></div></div>`);
    window.rebindAll?.(); window.deselectAll?.();
    document.getElementById('abR').classList.add('selected');
  }, [PNG, project]);
  await page.evaluate(() => { window.showToast = () => {}; window.runRemoveBg(); });
  const btn = page.locator('[data-rb-model="removebg"]');
  await expect(btn).toBeVisible();
  await btn.click();
  await expect.poll(() => page.evaluate(() => window.__cuts.length)).toBe(1);
  return errs;
}
const look = (page) => page.evaluate(() => {
  const b = document.getElementById('abR');
  const ser = window.serializeProject();
  return {
    img: b.querySelector('img').getAttribute('src'), ds: b.dataset.imgSrc,
    saves: window.__saves.map(s => ({ projectId: s.projectId, mime: s.mime, b64: s.b64 })),
    inline: (typeof ser === 'string' ? ser : JSON.stringify(ser)).includes(`data:image/png;base64,${window.__OUT}`),
  };
});

test('H1 프로젝트 열림 → 자산 저장 1회 → 블럭이 goya-asset:// · 직렬화에 base64 없음', async ({ page }) => {
  await setup(page);
  await page.evaluate((b) => { window.__OUT = b; }, OUT_B64);
  await expect.poll(async () => (await look(page)).img, '★결과가 data: 로 박혔다(옛 B2)').toBe(URL_OUT);
  const v = await look(page);
  expect(v.ds).toBe(URL_OUT);
  expect(v.saves).toEqual([{ projectId: 'p1', mime: 'image/png', b64: OUT_B64 }]);
  expect(v.inline, 'serializeProject 에 결과 base64').toBe(false);
});

test('H2 ⌘Z 한 번 → 옛 그림', async ({ page }) => {
  await setup(page);
  await expect.poll(async () => (await look(page)).img).toBe(URL_OUT);
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Meta+z');
  await expect.poll(async () => (await look(page)).img).toBe(PNG);
  expect((await look(page)).ds).toBe(PNG);
});

test('H3 [대조] 프로젝트 없음 → 자산 저장 0 · data URL (다른 입구와 같은 동작)', async ({ page }) => {
  await setup(page, { project: false });
  await expect.poll(async () => (await look(page)).img).toBe(`data:image/png;base64,${OUT_B64}`);
  expect((await look(page)).saves).toEqual([]);
});
