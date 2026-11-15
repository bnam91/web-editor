/* foreign-asset-html-export-1116.dom.spec.js — FOREIGN-ASSET-ADOPT-GAPS-01 ①(재발주 · 수지 5/9 «HTML 내보내기 칸 일부 미완»)
 *   장면: 다른 프로젝트 A 의 그림을 B 에 붙이고 저장(adopt = A 파일을 B 로 복사 · 저장본만 새 주소 · 라이브 DOM 은 goya-asset://A/… 그대로)
 *         → 같은 세션에서 A 가 «아주» 지워짐(휴지통 비움·영구 삭제 · 휴지통에 있는 동안은 main _goyaAssetFile 이 읽는다)
 *         → HTML 내보내기는 라이브 DOM 의 A 주소로만 읽어 그림을 못 싣고 주소를 남겼다(재열면 멀쩡 = 새 주소).
 *   고침: js/io/export-html.js inlineGoyaAssets — 이번 세션 adopt 한 사본(asset-externalize adoptedUrlFor)부터 읽고, 없으면 옛 주소.
 *   자산 IPC 는 스텁(A 읽힘 여부를 손에 쥔다). main 쪽 휴지통 읽기는 tests/unit/foreign-asset-trash-read.test.mjs F1~F4.
 * 칸
 *   E1 adopt 뒤 A 가 아주 지워져도 내보낸 HTML 의 그림이 data URI 로 실린다(goya-asset 0)
 *   N1 음성 — adopt 전(저장 안 함)에 A 가 지워지면 주소를 그대로 두고 내보내기는 끝난다(지금 동작 · 옮길 사본이 없다)
 *   N2 음성 — A 가 살아 있으면 어느 길이든 실린다
 * 양성대조(장면 한 줄): CTL-F = export-html.js 의 `const own = adoptedUrlFor(...)`·`if (own) …` 두 줄 삭제 → E1 빨강(A 읽기 실패 → img src 가 goya-asset://pA/h.png 로 남음) · N1·N2 초록
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAEBgIApD5fRAAAAABJRU5ErkJggg==';
const A_URL = 'goya-asset://pA/h.png', B_URL = 'goya-asset://pB/h.png';

async function setup(page) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(async ([png, aUrl, bUrl]) => {
    window.__readable = { pA: true, pB: true };
    window.electronAPI = { ...(window.electronAPI || {}),
      assetsReadAsDataUri: async ({ projectId }) => (window.__readable[projectId] ? { ok: true, dataUri: `data:image/png;base64,${png}` } : { ok: false, error: 'not found' }),
      assetsSaveCanvasImage: async ({ projectId }) => ({ ok: true, url: projectId === 'pB' ? bUrl : 'goya-asset://' + projectId + '/h.png' }) };
    window.activeProjectId = 'pB';
    const k = document.getElementById('canvas'); k.querySelectorAll('.section-block').forEach((s) => s.remove());
    k.insertAdjacentHTML('beforeend', `<div class="section-block" id="sF" data-section="1"><div class="section-hitzone"></div><div class="section-inner"><img id="fImg" src="${aUrl}" style="width:100px;height:100px"></div></div>`);
    window.rebindAll?.();
    window.__blobs = []; const o = URL.createObjectURL; URL.createObjectURL = function (b) { window.__blobs.push(b); return o.call(URL, b); };
    const ck = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = function () { if (!this.download) ck.call(this); };
  }, [PNG, A_URL, B_URL]);
  return errs;
}
const adopt = (page) => page.evaluate(async () => {
  const m = await import('/js/io/asset-externalize.js');
  const data = { pages: [{ canvas: document.getElementById('canvas').innerHTML }] };
  await m.adoptForeignAssets(data, 'pB');
  return { saved: data.pages[0].canvas.includes('goya-asset://pB/h.png'), live: document.getElementById('fImg').getAttribute('src') };
});
const exportImgSrc = (page) => page.evaluate(async () => {
  await window.exportHTMLFile();
  const html = await window.__blobs[window.__blobs.length - 1].text();
  const m = html.match(/<img[^>]*id="fImg"[^>]*src="([^"]*)"/) || html.match(/<img[^>]*src="([^"]*)"[^>]*id="fImg"/);
  return m ? m[1] : null;
});

test('E1 adopt 뒤 원본 A 가 아주 지워져도 HTML 내보내기에 그림이 실린다', async ({ page }) => {
  const errs = await setup(page);
  const a = await adopt(page);
  expect(a, '[전제] 저장본은 B 주소 · 라이브 DOM 은 A 주소 그대로').toEqual({ saved: true, live: A_URL });
  await page.evaluate(() => { window.__readable.pA = false; });   // A 휴지통 비움·영구 삭제
  const src = await exportImgSrc(page);
  expect(src, '[전제] 내보낸 HTML 에 그 img').not.toBeNull();
  expect(src, '★원본이 지워졌다고 B 에 옮긴 사본이 있는데도 그림이 빠졌다(goya-asset 주소가 남음)').toBe(`data:image/png;base64,${PNG}`);
  expect(errs, errs.join('\n')).toEqual([]);
});

test('N1 음성 — adopt 전에 A 가 지워지면 주소를 그대로 두고 내보내기는 끝난다', async ({ page }) => {
  const errs = await setup(page);
  await page.evaluate(() => { window.__readable.pA = false; });
  expect(await exportImgSrc(page)).toBe(A_URL);
  expect(errs, errs.join('\n')).toEqual([]);
});

test('N2 음성 — A 가 살아 있으면 실린다(adopt 없이도)', async ({ page }) => {
  const errs = await setup(page);
  expect(await exportImgSrc(page)).toBe(`data:image/png;base64,${PNG}`);
  expect(errs, errs.join('\n')).toEqual([]);
});
