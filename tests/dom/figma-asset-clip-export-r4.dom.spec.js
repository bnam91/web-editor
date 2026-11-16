/* figma-asset-clip-export-r4 — 0.9.12 134 FIGMA-ASSET-CLIP-OFF-AND-CROP-MISMATCH-01 r4 (지디 261117 실앱 ◑)
 *   실앱: 에셋 패널 「내용 자르기」 실클릭으로 끔 → data-clip-content=false 인데 window.buildFigmaExportJSON() 결과에 clip 키 0.
 *   뿌리: 빌더는 라이브 캔버스가 아니라 «저장 문자열»(page.canvas)을 DOMParser 로 읽는다 → 마지막 저장 뒤의 편집이 빠진다
 *     (그 사본 el 은 isConnected true · 원본 아님 · data-clip-content 없음 = 지디 실측 그대로). 업로드(figma-publish)는 앞에서 flushCurrentPage 를 불렀지만
 *     직접 부르는 자리는 안 불렀다.
 * 고침(js/io/export-figma-json.js buildFigmaExportJSON 머리): window.flushCurrentPage?.() — 빌더가 스스로 지금 페이지를 굳힌다.
 * 칸
 *   F1 에셋 저장(flush) 뒤 패널 토글 «실클릭»으로 끔 → 곧바로 window.buildFigmaExportJSON() → 그 에셋 블럭 clip:false
 *   F2 [지킴] 다시 켬 → 같은 길 → clip 키 0(켬 = 옛 바이트)
 * 양성대조: _patches/controls/ASSET-R4-CTL.patch(빌더 머리 flush 줄 삭제) → F1 빨강(clip 키 없음 · 저장 문자열엔 끄기 전 꼴). F2 는 초록(켬 = 저장 꼴과 같다).
 * 안 잰 것: 실 Figma · 실앱 업로드 버튼(그 길은 원래 flush 를 했다) · crop(그림 편집은 dataset.imgW 라 저장 문자열에도 산다 — 단위 A1·A2 가 잰다).
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

/* 대기는 «조건»으로만(dom-fixed-wait-census) */
const f2 = (p) => p.waitForFunction(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const until = async (page, fn, arg) => { await page.waitForFunction(fn, arg, { timeout: 2000 }).catch(() => {}); await f2(page); };

async function scene(page) {
  await page.setViewportSize({ width: 1500, height: 1200 });
  const errs = await bootApp(page);
  const a1 = await page.evaluate(() => {
    const cv = document.createElement('canvas'); cv.width = 400; cv.height = 200; const g = cv.getContext('2d'); g.fillStyle = '#3366cc'; g.fillRect(0, 0, 400, 200);
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', `<div class="section-block" id="sF" data-section="1"><div class="section-hitzone"></div><div class="section-inner" id="sF-in"><div class="gap-block" data-type="gap" style="height:30px"></div></div></div>`);
    window.rebindAll?.(); window.applyZoom?.(60);
    window.deselectAll?.(); window.selectSection?.(document.getElementById('sF'));
    const before = new Set([...document.querySelectorAll('#canvas .asset-block')].map(e => e.id));
    window.addAssetBlock();
    const ab = [...document.querySelectorAll('#canvas .asset-block')].find(e => !before.has(e.id));
    window.setAssetImageFromSrc(ab, cv.toDataURL('image/png'));
    window.deselectAll?.();
    return ab.id;
  });
  await page.waitForFunction(() => [...document.querySelectorAll('#sF img')].every(i => i.complete && i.naturalWidth > 0));
  await page.evaluate(() => window.flushCurrentPage());   // 실앱처럼 «에셋은 이미 저장돼 있다» — 끄기만 저장 전
  await f2(page);
  return { errs, a1 };
}
/* JSON 트리에서 그 에셋(type image · id)을 찾는다 */
const exported = (page, id) => page.evaluate((id) => {
  const hit = []; const walk = (v) => { if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === 'object') { if (v.type === 'image' && v.id === id) hit.push(v); Object.values(v).forEach(walk); } };
  walk(window.buildFigmaExportJSON());
  return hit.map((b) => ({ has: 'clip' in b, clip: b.clip }));
}, id);
/* 축 값이 «먹었나» = 제품 술어(window.clipsContent) + 그림 상자(.asset-img-clip) computed overflow — frame-clip-axis-roster R4·R5 규칙(손셈 0) */
const axis = (page, id) => page.evaluate((id) => { const ab = document.getElementById(id);
  return { attr: ab.dataset.clipContent ?? null, clips: window.clipsContent(ab), ov: getComputedStyle(ab.querySelector('.asset-img-clip')).overflow }; }, id);
async function clickToggle(page, a1) {
  const r = await page.evaluate((id) => { const el = document.getElementById(id); el.scrollIntoView({ block: 'center' }); const b = el.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; }, a1);
  await page.mouse.click(r.x, r.y); await until(page, () => !!document.getElementById('asset-clip-toggle'));
  expect(await page.evaluate(() => !!document.getElementById('asset-clip-toggle')), '[전제] 에셋 패널에 「내용 자르기」').toBe(true);
  await page.click('label.prop-toggle:has(#asset-clip-toggle)');
}

test('F1 패널로 «내용 자르기» 끔 → 곧바로 buildFigmaExportJSON() = 그 에셋 clip:false · F2 [지킴] 다시 켬 = clip 키 0', async ({ page }) => {
  const { errs, a1 } = await scene(page);
  expect(await axis(page, a1), '[전제] 켬(기본) — 속성 없음 · 술어 자름 · 그림 상자 hidden').toEqual({ attr: null, clips: true, ov: 'hidden' });
  expect(await exported(page, a1), '[전제] 저장된 에셋이 JSON 에 한 번 · 켬(기본) = clip 키 0').toEqual([{ has: false }]);
  await clickToggle(page, a1);
  await until(page, (id) => window.clipsContent(document.getElementById(id)) === false, a1);
  const off = await axis(page, a1);
  expect(off.attr, '[전제] 실클릭으로 끔 — 그 값이 false 가 됐다').toBe('false');
  expect([off.clips, off.ov], '[전제] 끔 — 술어 false · 그림 상자 visible').toEqual([false, 'visible']);
  expect(await exported(page, a1), 'F1 — 끈 에셋이 Figma JSON 에 clip:false 로 안 실렸다(빌더가 저장 전 문자열을 읽었다)').toEqual([{ has: true, clip: false }]);
  await page.click('label.prop-toggle:has(#asset-clip-toggle)');
  await until(page, (id) => window.clipsContent(document.getElementById(id)) === true, a1);
  expect(await axis(page, a1), '[전제] 다시 켬 — 속성 지움 · 술어 자름 · 그림 상자 hidden').toEqual({ attr: null, clips: true, ov: 'hidden' });
  expect(await exported(page, a1), 'F2 — 다시 켰는데 clip 키가 남았다').toEqual([{ has: false }]);
  expect(errs, errs.join('\n')).toEqual([]);
});
