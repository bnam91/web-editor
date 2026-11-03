/* asset-img-error-undo.dom.spec.js — 그림이 안 뜬 칸 뒤 ⌘Z 가 그 자리에 묶이던 값의 자(앱: pos 4 · len 6 고정 3/3).
 * 까닭: 옛 인라인 onerror 가 style·alt 를 직접 고쳐 직렬화에 실렸다 ⇒ 복원 → 다시 실패 → 라이브 ≠ 꼭대기 → 체크포인트 → 제자리.
 * ⛔이 자가 안 재는 것: 파일이 지워진 프로젝트를 다시 여는 길(앱 값이 회신에 있다).
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAEBgIApD5fRAAAAABJRU5ErkJggg==', 'base64');
async function setup(page, name) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  await page.route('**/__asset/ok.png', (r) => r.fulfill({ contentType: 'image/png', body: PNG }));
  await page.route('**/__asset/bad.png', (r) => r.fulfill({ status: 404, body: '' }));
  await page.evaluate(async (name) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    await window.addSection(); const sec = [...c.querySelectorAll('.section-block')].pop(); window.selectSection(sec); await window.addAssetBlock('img1');
    window.pushHistory('자리');
    window.setAssetImageFromSrc(sec.querySelector('.asset-block'), `${location.origin}/__asset/${name}.png`);
    window.pushHistory('그림');
  }, name);
  await page.waitForFunction(() => document.querySelector('#canvas img.asset-img')?.complete);
  return errs;
}
const has = (page) => page.evaluate(() => !!document.querySelector('#canvas .asset-block')?.dataset.imgSrc);

test('안 뜬 그림도 ⌘Z 한 번에 빠지고 다시 실행으로 돌아온다', async ({ page }) => {
  const errs = await setup(page, 'bad');
  await page.waitForFunction(() => document.querySelector('#canvas img.asset-img')?.alt === '이미지 로드 실패');
  await page.evaluate(() => window.undo());
  await expect.poll(() => has(page)).toBe(false);
  await page.evaluate(() => window.redo());
  await expect.poll(() => has(page)).toBe(true);
  expect(errs).toEqual([]);
});
test('실패 표시는 화면에만 있고 직렬화에는 없다', async ({ page }) => {
  await setup(page, 'bad');
  await page.waitForFunction(() => document.querySelector('#canvas img.asset-img')?.alt === '이미지 로드 실패');
  const v = await page.evaluate(() => { const s = window.getSerializedCanvas(); return { op: getComputedStyle(document.querySelector('#canvas img.asset-img')).opacity, cls: /class="[^"]*asset-img-failed/.test(s), alt: /\salt="이미지 로드 실패"/.test(s) }; });
  expect(v).toEqual({ op: '0.3', cls: false, alt: false });
});
test('열 때처럼 on* 이 지워진 HTML 도 안 뜨면 표시가 붙는다', async ({ page }) => {
  await setup(page, 'ok');
  await page.evaluate(() => { const c = document.querySelector('#canvas .asset-img-clip'); c.innerHTML = window.sanitizeCanvasHtml(`<img class="asset-img" src="${location.origin}/__asset/bad.png" onerror="this.title='x'">`); });
  await page.waitForFunction(() => document.querySelector('#canvas img.asset-img')?.alt === '이미지 로드 실패');
  expect(await page.evaluate(() => { const i = document.querySelector('#canvas img.asset-img'); return [i.hasAttribute('onerror'), getComputedStyle(i).opacity]; })).toEqual([false, '0.3']);
});
test('[음성] 옛 저장본에 박힌 alt·opacity 는 문서 내용이라 직렬화가 그대로 둔다', async ({ page }) => {
  await setup(page, 'ok');
  await page.evaluate(() => { const c = document.querySelector('#canvas .asset-img-clip'); c.innerHTML = window.sanitizeCanvasHtml(`<img class="asset-img" src="${location.origin}/__asset/bad.png" draggable="false" style="object-fit: cover; opacity: 0.3;" alt="이미지 로드 실패">`); });
  await page.waitForFunction(() => document.querySelector('#canvas img.asset-img')?.classList.contains('asset-img-failed'));
  const m = await page.evaluate(() => window.getSerializedCanvas().match(/<img class="asset-img"[^>]*>/)[0]);
  expect(m).toContain('alt="이미지 로드 실패"');
  expect(m).toContain('opacity: 0.3');
  expect(m).not.toContain('asset-img-failed');
});
test('[음성] 뜬 그림은 표시가 없고 ⌘Z 로 빠진다', async ({ page }) => {
  await setup(page, 'ok');
  expect(await page.evaluate(() => { const i = document.querySelector('#canvas img.asset-img'); return [i.naturalWidth > 0, i.classList.contains('asset-img-failed'), i.alt]; })).toEqual([true, false, '']);
  await page.evaluate(() => window.undo());
  await expect.poll(() => has(page)).toBe(false);
});
