/* vector-svg-import — t3-06 P1 «SVG 들여오기» (현빈 결정 261117 #19 ② · 시트 Figma벡터트랙 t3-06)
 *   바깥 SVG 를 벡터 블럭으로: 붙여넣기(SVG 글자 · Figma «Copy as SVG») · 섹션에 .svg 파일 끌어 놓기 · 에셋 «크게 보기» 창의 「+ 벡터로 넣기」.
 *   한 문 = window.addVectorFromSvgText(js/blocks/vector-block.js) — 넣기 «전» sanitize-svg · 크기 = svgImportSize.
 * 칸:
 *   V1 SVG 글자 붙여넣기 → 벡터 블럭 하나 · 거른 글자(onload·<script> 없음) · 크기 = viewBox(48×24) · 이름 SVG
 *   V2 [음성] 그냥 글자 붙여넣기 → 벡터 0
 *   V3 [음성] 그림 항목 + SVG 글자 → 종전대로 스크래치 그림 1 · 벡터 0(두 번 안 붙는다)
 *   V4 .svg 파일을 섹션에 끌어 놓기 → dragover 받음 · 벡터 블럭 하나 · 이름 = 파일 이름 · 크기 = width·height(64×32)
 *   V5 [음성] .png 파일을 섹션에 끌어 놓기 → 벡터 0
 *   V6 200000 자 넘는 SVG 붙여넣기 → 벡터 0 · 알림(빈 블럭 0)
 *   V7 에셋 SVG 항목 «크게 보기» → 「+ 벡터로 넣기」 단추(실마우스) → 벡터 블럭 · 창 닫힘 · 이름 = 항목 이름
 *   V8 [음성] 에셋 PNG 항목 «크게 보기» → 「+ 벡터로 넣기」 단추 없음
 *   V10 Figma 가져오기(JSON 파일 · 앱 메뉴 길) — VECTOR + SVG(data URL · 맨 base64+mimeType) → 벡터 블럭(거른 글자 · 크기 = 노드 width·height) · [음성] VECTOR + PNG → 종전 그림 블럭
 *   V11 .svg 를 섹션 «밖»(캔버스 옆 회색)에 놓기 → 가장 가까운 섹션의 «오버레이 벡터»(overlay-float 재사용 · 섹션 직속 · data-overlay-block) · 섹션 상자 안으로 조임 · 스크래치 0
 *   V12 [음성] .png 를 섹션 밖에 놓기 → 종전대로 스크래치 그림 · 벡터 0
 *   V13 섹션 밖 드랍 뒤 ⌘Z 한 번 = 넣기 전(오버레이로 띄운 것까지 한 걸음)
 *   V9 ⌘Z 한 번 = 넣기 전으로(벡터 0 · 섹션 자식 수 그대로) — insert-history EXTRA 'addVectorFromSvgText'(insert-seam-roster A1)
 * 양성대조: _patches/VEC-CTL5-outside-to-scratch.patch(섹션 밖 캡처 처리기 끔) → V11·V13 빨강 · V12 초록.
 * 양성대조: _patches/VEC-CTL4-figma-vector-as-image.patch(VECTOR 를 옛 그림 길로) → V10 빨강(벡터 0 · 그림 3).
 * 양성대조: _patches/VEC-CTL3-drop-extra.patch(EXTRA 에서 그 이름 뺌) → 단위 insert-seam-roster A1 빨강.
 * 양성대조: _patches/VEC-CTL-no-import.patch(addVectorFromSvgText 가 아무것도 안 넣음) → V1·V4·V7 빨강 · 음성칸 초록.
 * ⛔고정 대기 0(expect.poll · 조건 대기) · 화면 px 를 숫자와 견주지 않는다(크기는 dataset).
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const EVIL = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 24" onload="window.__pwn=1"><script>window.__pwn=2</script><rect width="48" height="24" fill="#ff0000"/></svg>';
const LOGO = '<?xml version="1.0"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="64" height="32"><circle cx="16" cy="16" r="16"/></svg>';
const PX = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

async function scene(page) {
  await page.setViewportSize({ width: 1500, height: 1000 });
  const errs = await bootApp(page);
  const sid = await page.evaluate(async () => {
    document.querySelectorAll('#canvas .section-block').forEach((s) => s.remove());
    await window.addSection();
    window.__t = []; const o = window.showToast; window.showToast = (m, ...a) => { window.__t.push(String(m)); return o?.(m, ...a); };
    document.activeElement?.blur?.();
    return window.getSelectedSection().id;
  });
  return { errs, sid };
}
const vecs = (page, sid) => page.evaluate((s) => [...document.getElementById(s).querySelectorAll('.vector-block')].map((b) => ({ svg: b.dataset.svg, w: b.dataset.w, h: b.dataset.h, name: b.dataset.layerName })), sid);
const paste = (page, { text = null, png = false }) => page.evaluate(([text, png, px]) => {
  const dt = new DataTransfer();
  if (text !== null) dt.setData('text/plain', text);
  if (png) dt.items.add(new File([Uint8Array.from(atob(px), (c) => c.charCodeAt(0))], 'clip.png', { type: 'image/png' }));
  const ev = new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true });
  document.dispatchEvent(ev);
  return ev.defaultPrevented;
}, [text, png, PX]);
const drop = (page, sid, { name, type, body }) => page.evaluate(([sid, name, type, body, px]) => {
  const dt = new DataTransfer();
  dt.items.add(new File([type === 'image/png' ? Uint8Array.from(atob(px), (c) => c.charCodeAt(0)) : body], name, { type }));
  const el = document.getElementById(sid).querySelector('.section-inner') || document.getElementById(sid);
  const over = new DragEvent('dragover', { dataTransfer: dt, bubbles: true, cancelable: true });
  el.dispatchEvent(over);
  el.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
  return over.defaultPrevented;
}, [sid, name, type, body, PX]);

test('V1 SVG 글자 붙여넣기 → 거른 벡터 블럭 하나 · 크기 = viewBox', async ({ page }) => {
  const { errs, sid } = await scene(page);
  expect(await paste(page, { text: EVIL }), '[전제] 붙여넣기를 받았다(preventDefault)').toBe(true);
  await expect.poll(() => vecs(page, sid).then((v) => v.length), '벡터 블럭 하나').toBe(1);
  const [v] = await vecs(page, sid);
  expect({ w: v.w, h: v.h, name: v.name }).toEqual({ w: '48', h: '24', name: 'SVG' });
  expect(v.svg.startsWith('<svg'), v.svg).toBe(true);
  expect({ onload: /onload/i.test(v.svg), script: /<script/i.test(v.svg), pwn: await page.evaluate(() => window.__pwn ?? null) }, '★거르개를 지났다').toEqual({ onload: false, script: false, pwn: null });
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('V2 [음성] 그냥 글자 붙여넣기 → 벡터 0', async ({ page }) => {
  const { errs, sid } = await scene(page);
  expect(await paste(page, { text: 'hello <svg></svg>' })).toBe(false);
  expect(await vecs(page, sid)).toEqual([]);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('V3 [음성] 그림 항목 + SVG 글자 → 스크래치 그림 1 · 벡터 0', async ({ page }) => {
  const { errs, sid } = await scene(page);
  await paste(page, { text: EVIL, png: true });
  await expect.poll(() => page.evaluate(() => document.querySelectorAll('.scratch-item').length), '[전제] 종전대로 스크래치가 그림을 받았다').toBe(1);
  expect(await vecs(page, sid)).toEqual([]);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('V4 .svg 파일을 섹션에 끌어 놓기 → 벡터 블럭 · 이름 = 파일 이름 · 크기 = width·height', async ({ page }) => {
  const { errs, sid } = await scene(page);
  expect(await drop(page, sid, { name: 'logo.svg', type: 'image/svg+xml', body: LOGO }), '[전제] dragover 를 받았다').toBe(true);
  await expect.poll(() => vecs(page, sid).then((v) => v.length), '벡터 블럭 하나').toBe(1);
  const [v] = await vecs(page, sid);
  expect({ w: v.w, h: v.h, name: v.name, xml: v.svg.includes('<?xml') }).toEqual({ w: '64', h: '32', name: 'logo', xml: false });
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('V5 [음성] .png 파일을 섹션에 끌어 놓기 → 벡터 0', async ({ page }) => {
  const { errs, sid } = await scene(page);
  expect(await drop(page, sid, { name: 'a.png', type: 'image/png', body: '' })).toBe(false);
  expect(await vecs(page, sid)).toEqual([]);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('V6 200000 자 넘는 SVG → 벡터 0 · 알림', async ({ page }) => {
  const { errs, sid } = await scene(page);
  const big = '<svg xmlns="http://www.w3.org/2000/svg">' + '<path d="M0 0L1 1"/>'.repeat(12000) + '</svg>';
  expect(big.length, '[전제] 상한 200000 을 넘는다').toBeGreaterThan(200000);
  await paste(page, { text: big });
  await expect.poll(() => page.evaluate(() => window.__t.join('|')), '알림').toContain('SVG 로 읽을 수 없습니다');
  expect(await vecs(page, sid)).toEqual([]);
  expect(errs, errs.join(' | ')).toEqual([]);
});

async function seedAsset(page, node) {
  await page.evaluate((node) => {
    window.state.assetsTree = [{ id: 'f_v', type: 'folder', name: '벡터 시험', viewMode: 'grid', collapsed: false, children: [node] }];
    window.switchToTab?.('assets'); window.buildAssetsPanel?.();
  }, node);
}

test('V7 에셋 SVG 항목 → 「+ 벡터로 넣기」 → 벡터 블럭 · 창 닫힘', async ({ page }) => {
  const { errs, sid } = await scene(page);
  await seedAsset(page, { id: 'img_svg', type: 'image', name: 'brand.svg', mime: 'image/svg+xml', src: 'data:image/svg+xml;base64,' + Buffer.from(LOGO).toString('base64') });
  expect(await page.evaluate(() => window.assetsOpenPreview('img_svg')), '[전제] 창이 열렸다').toBe(true);
  const btn = page.locator('.tpl-preview-backdrop.asset-preview [data-asset-insert-vector]');
  await expect(btn, '[전제] SVG 항목엔 「+ 벡터로 넣기」').toBeVisible();
  await page.evaluate((s) => window.selectSection(document.getElementById(s)), sid);
  await btn.click();
  await expect.poll(() => vecs(page, sid).then((v) => v.length), '벡터 블럭 하나').toBe(1);
  const [v] = await vecs(page, sid);
  expect({ w: v.w, h: v.h, name: v.name }).toEqual({ w: '64', h: '32', name: 'brand' });
  expect(await page.locator('.tpl-preview-backdrop.asset-preview').count(), '넣으면 창은 닫힌다').toBe(0);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('V8 [음성] 에셋 PNG 항목 → 「+ 벡터로 넣기」 없음 · 「+ 섹션에 넣기」는 그대로', async ({ page }) => {
  const { errs } = await scene(page);
  await seedAsset(page, { id: 'img_png', type: 'image', name: 'a.png', src: 'data:image/png;base64,' + PX });
  expect(await page.evaluate(() => window.assetsOpenPreview('img_png'))).toBe(true);
  await expect(page.locator('.tpl-preview-backdrop.asset-preview [data-asset-insert]'), '[전제] 옛 단추').toBeVisible();
  expect(await page.locator('[data-asset-insert-vector]').count()).toBe(0);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('V9 SVG 붙여넣기 뒤 ⌘Z 한 번 = 넣기 전', async ({ page }) => {
  const { errs, sid } = await scene(page);
  const kids = () => page.evaluate((s) => document.getElementById(s).querySelectorAll('.section-inner > *').length, sid);
  const k0 = await kids();
  await paste(page, { text: EVIL });
  await expect.poll(() => vecs(page, sid).then((v) => v.length), '[전제] 벡터 블럭 하나').toBe(1);
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Meta+z');
  await expect.poll(() => page.evaluate((s) => document.getElementById(s)?.querySelectorAll('.vector-block').length ?? -1, sid), '★⌘Z 한 번에 벡터가 빠진다').toBe(0);
  expect(await kids(), '섹션 자식 수 = 넣기 전').toBe(k0);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('V10 Figma 가져오기 JSON — VECTOR+SVG 는 벡터 블럭 · VECTOR+PNG 는 종전 그림', async ({ page }) => {
  const { errs } = await scene(page);
  const b64 = (t) => Buffer.from(t).toString('base64');
  const json = JSON.stringify({ frames: [{ name: 'FG', width: 860, height: 600, children: [
    { type: 'VECTOR', name: 'logoA', x: 0, y: 0, width: 64, height: 32, imageData: 'data:image/svg+xml;base64,' + b64(EVIL) },
    { type: 'VECTOR', name: 'logoB', x: 0, y: 200, width: 50, height: 50, mimeType: 'image/svg+xml', imageData: b64(LOGO) },
    { type: 'VECTOR', name: 'bitmap', x: 0, y: 400, width: 40, height: 40, imageData: 'data:image/png;base64,' + PX },
  ] }] });
  const n0 = await page.evaluate(() => document.querySelectorAll('#canvas .section-block').length);
  await page.evaluate((json) => window.openFigmaImportPreview({ target: { files: [new File([json], 'fg.json', { type: 'application/json' })], value: '' } }), json);
  await expect(page.locator('#figma-import-modal'), '[전제] 가져오기 창').toBeVisible();
  await page.locator('#figma-import-modal button[onclick="doFigmaImport()"]').click();
  await expect.poll(() => page.evaluate(() => document.querySelectorAll('#canvas .section-block').length), '[전제] 섹션 하나 더').toBe(n0 + 1);
  const r = await page.evaluate(() => {
    const sec = [...document.querySelectorAll('#canvas .section-block')].pop();
    return { vec: [...sec.querySelectorAll('.vector-block')].map((b) => ({ name: b.dataset.layerName, w: b.dataset.w, h: b.dataset.h, drawn: !!b.querySelector('.vb-inner svg'), bad: /onload|<script/i.test(b.dataset.svg + b.innerHTML) })),
      img: [...sec.querySelectorAll('.asset-block img')].map((i) => i.getAttribute('src').slice(0, 15)), pwn: window.__pwn ?? null };
  });
  expect(r.vec, '★VECTOR+SVG 둘 = 벡터 블럭(그려짐 · 거른 글자 · 크기 = 노드)').toEqual([
    { name: 'logoA', w: '64', h: '32', drawn: true, bad: false },
    { name: 'logoB', w: '50', h: '50', drawn: true, bad: false },
  ]);
  expect({ img: r.img, pwn: r.pwn }, '[음성] VECTOR+PNG = 종전 그림 블럭').toEqual({ img: ['data:image/png;'], pwn: null });
  expect(errs, errs.join(' | ')).toEqual([]);
});

const dropOutside = (page, sid, { name, type, body }) => page.evaluate(([sid, name, type, body, px]) => {
  const dt = new DataTransfer();
  dt.items.add(new File([type === 'image/png' ? Uint8Array.from(atob(px), (c) => c.charCodeAt(0)) : body], name, { type }));
  const wrap = document.getElementById('canvas-wrap'), sc = document.getElementById('canvas-scaler').getBoundingClientRect(), sr = document.getElementById(sid).getBoundingClientRect();
  const o = { dataTransfer: dt, bubbles: true, cancelable: true, clientX: Math.max(wrap.getBoundingClientRect().left + 4, sc.left - 60), clientY: sr.top + sr.height / 2 };
  const hit = document.elementFromPoint(o.clientX, o.clientY);
  const over = new DragEvent('dragover', o); wrap.dispatchEvent(over);
  wrap.dispatchEvent(new DragEvent('drop', o));
  return { accepted: over.defaultPrevented, outside: !hit?.closest('#canvas .section-block') };
}, [sid, name, type, body, PX]);
const floats = (page, sid) => page.evaluate((s) => [...document.getElementById(s).querySelectorAll(':scope > .vector-block')].map((b) => ({ ov: b.dataset.overlayBlock, x: b.dataset.offsetX, name: b.dataset.layerName, inFlow: !!b.closest('.row') })), sid);
const RED = '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="#ff0000"/></svg>';

test('V11 .svg 를 섹션 밖에 놓기 → 가장 가까운 섹션의 오버레이 벡터 · 상자 안으로 조임 · 스크래치 0', async ({ page }) => {
  const { errs, sid } = await scene(page);
  const sc0 = await page.evaluate(() => document.querySelectorAll('.scratch-item').length);
  expect(await dropOutside(page, sid, { name: 'mark.svg', type: 'image/svg+xml', body: RED }), '[전제] 놓은 자리 = 섹션 밖 · dragover 받음').toEqual({ accepted: true, outside: true });
  await expect.poll(() => floats(page, sid).then((v) => v.length), '오버레이 벡터 하나').toBe(1);
  expect(await floats(page, sid), '★섹션 직속 · 오버레이 · 흐름 밖 · 왼쪽 끝(0)으로 조임').toEqual([{ ov: 'true', x: '0', name: 'mark', inFlow: false }]);
  expect(await page.evaluate(() => document.querySelectorAll('.scratch-item').length), '스크래치 그림 안 생김').toBe(sc0);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('V12 [음성] .png 를 섹션 밖에 놓기 → 스크래치 그림 · 벡터 0', async ({ page }) => {
  const { errs, sid } = await scene(page);
  const sc0 = await page.evaluate(() => document.querySelectorAll('.scratch-item').length);
  await dropOutside(page, sid, { name: 'a.png', type: 'image/png', body: '' });
  await expect.poll(() => page.evaluate(() => document.querySelectorAll('.scratch-item').length), '[전제] 종전대로 스크래치').toBe(sc0 + 1);
  expect(await page.evaluate(() => document.querySelectorAll('#canvas .vector-block').length)).toBe(0);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('V13 섹션 밖 드랍 뒤 ⌘Z 한 번 = 넣기 전', async ({ page }) => {
  const { errs, sid } = await scene(page);
  /* FLAKY cand12(4번 중 2 · 부하 샤딩에서만): 넣기 직후 끝 표본 «다시 찍기»(insert-history _scheduleRestamp · rAF 2번+setTimeout · 늦으면 120ms 마감)가
     닿기 «전»에 ⌘Z 를 누르면 꼭대기 ≠ 라이브라 undo 첫머리 체크포인트가 「현재 상태」를 한 칸 더 쌓고 거기서 멈춘다(벡터 남음).
     사람은 놓고 120ms 안에 ⌘Z 를 못 누른다 — 창은 «부하에 밀린 프레임»뿐 ⇒ 시험 쪽: 다시 찍기가 닿아 꼭대기 = 라이브가 된 «뒤»에 누른다(조건 대기 · 고정 대기 0). */
  await page.evaluate(() => {
    const orig = window.restampHistoryTop;
    window.__v13rs = { n: 0, canvas: null };
    window.restampHistoryTop = function (seq) { const r = orig.apply(this, arguments); window.__v13rs = { n: window.__v13rs.n + 1, canvas: window.getSerializedCanvas() }; return r; };
  });
  const tip0 = await page.evaluate(() => window.getHistoryTip());
  await dropOutside(page, sid, { name: 'mark.svg', type: 'image/svg+xml', body: RED });
  await expect.poll(() => floats(page, sid).then((v) => v.length), '[전제] 오버레이 벡터 하나').toBe(1);
  const tip1 = await page.evaluate(() => window.getHistoryTip());
  expect(tip1.pos > tip0.pos && tip1.seq !== tip0.seq, `[전제] 넣기가 끝 표본 한 칸을 찍었다 ${JSON.stringify([tip0, tip1])}`).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__v13rs.n > 0 && window.__v13rs.canvas === window.getSerializedCanvas()),
    '[전제] 끝 표본 다시 찍기가 닿았고 그 뒤 라이브가 안 변했다(꼭대기 = 라이브)').toBe(true);
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Meta+z');
  await expect.poll(() => page.evaluate((s) => document.getElementById(s)?.querySelectorAll('.vector-block').length ?? -1, sid), '★⌘Z 한 번에 빠진다').toBe(0);
  expect(errs, errs.join(' | ')).toEqual([]);
});
