/* icontext-empty-icon-export — ICONTEXT-EMPTY-ICON-PLACEHOLDER-IN-EXPORT-01 (0.9.12 · 미카사 발주17 곁 → 태양 판정 261111).
 * 그림 없는 아이콘텍스트의 점선 네모(.itb-icon 기본 CSS · #canvas 스코프 아님)+자리표시 svg 가 산출물에 찍혔다.
 * 캔버스(편집 중)에는 «보이고», 내보내기 경로마다 «빠져야» 한다 — 경로마다 따로 잰다.
 *   IC0 [지킴] 캔버스: 빈 칸 점선·svg 보인다
 *   IC1 PNG·썸네일 공용 겹(stripEditorOnlyForCapture): 빈 칸 가시성 끔 · 자리(폭) 그대로 · 그림 든 칸은 그대로(음성대조)
 *   IC2 단독 HTML 배송본을 렌더: 빈 칸 안 보임 · 그림 든 칸 보임
 *   IC3 Figma JSON: 빈 칸 블럭의 svg 에 자리표시가 안 실린다
 * 양성대조: 고친 두 줄(capture-safety.js · export-figma-json.js)만 되돌리면 IC1~IC3 빨강, IC0 초록.
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const PNG1 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const PH_SVG = 'points="21 15 16 10 5 21"';   // 자리표시 svg 지문(block-factory.js makeIconTextBlock)

async function setup(page) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  expect(errs, '앱 부팅 pageerror').toEqual([]);
  const ids = await page.evaluate((PNG1) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', '<div class="section-block" data-section="1" data-name="S1" id="secI"><div class="section-hitzone" style="height:28px"></div><div class="section-inner"><div class="gap-block" data-type="gap" style="height:40px"></div></div></div>');
    window.rebindAll?.();
    const sec = document.getElementById('secI');
    const add = () => { const b = new Set([...sec.querySelectorAll('.icon-text-block')]); window.deselectAll?.(); window._activeFrame = null; window.selectSection(sec); window.addIconTextBlock(); return [...sec.querySelectorAll('.icon-text-block')].find(e => !b.has(e)); };
    const empty = add(); const filled = add();
    empty.querySelector('.itb-text').textContent = '빈 아이콘 칸';
    filled.querySelector('.itb-text').textContent = '그림 든 칸';
    const r = window.updateIconTextBlock(filled.id, { imgSrc: PNG1 });
    window.deselectAll?.();
    return { empty: empty.id, filled: filled.id, upd: r && r.ok };
  }, PNG1);
  expect(ids.upd, '전제: 그림 든 칸이 안 섰다').toBe(true);
  return ids;
}

const grabExport = (page) => page.evaluate(async () => {
  const OrigBlob = window.Blob; const origClick = HTMLAnchorElement.prototype.click; let body = null;
  HTMLAnchorElement.prototype.click = function () {};
  window.Blob = function (parts, o) { body = (parts || []).join(''); return new OrigBlob(parts, o); };
  try { await window.exportHTMLFile(); } catch (e) { body = 'THREW:' + (e && e.message); }
  window.Blob = OrigBlob; HTMLAnchorElement.prototype.click = origClick;
  return body;
});

test('IC0 [지킴] 캔버스 — 빈 아이콘 칸 점선·자리표시가 보인다', async ({ page }) => {
  const ids = await setup(page);
  const r = await page.evaluate((id) => { const ic = document.getElementById(id).querySelector('.itb-icon'); const cs = getComputedStyle(ic); return { vis: cs.visibility, bs: cs.borderTopStyle, svg: !!ic.querySelector('svg'), w: ic.offsetWidth }; }, ids.empty);
  expect(r).toEqual({ vis: 'visible', bs: 'dashed', svg: true, w: r.w });
  expect(r.w).toBeGreaterThan(0);
});

test('IC1 PNG·썸네일 공용 겹 — 빈 칸은 가시성만 끈다(자리 그대로) · 그림 든 칸은 그대로', async ({ page }) => {
  const ids = await setup(page);
  const r = await page.evaluate(async (ids) => {
    const live = document.getElementById(ids.empty).querySelector('.itb-icon').offsetWidth;
    const clone = document.getElementById('secI').cloneNode(true);
    const mod = await import('/js/io/capture-safety.js');
    mod.stripEditorOnlyForCapture(clone);
    clone.style.cssText += ';position:fixed;top:-99999px;left:0;width:860px;';
    document.body.appendChild(clone);   // PNG 경로처럼 붙여서 computed 를 잰다
    const e = clone.querySelector('#' + ids.empty + ' .itb-icon'), f = clone.querySelector('#' + ids.filled + ' .itb-icon');
    const out = { live, eVis: getComputedStyle(e).visibility, eW: e.offsetWidth, fVis: getComputedStyle(f).visibility, fImg: !!f.querySelector('img') };
    clone.remove();
    return out;
  }, ids);
  expect(r.eVis, 'PNG 클론에 빈 칸 점선·자리표시가 그려진다').toBe('hidden');
  expect(r.eW, '빈 칸 자리가 사라졌다 — 글자 위치가 캔버스와 달라진다').toBe(r.live);
  expect(r.fImg).toBe(true);
  expect(r.fVis, '음성대조: 그림 든 칸까지 숨겼다').toBe('visible');
});

test('IC2 단독 HTML 배송본 — 빈 칸 안 보임 · 그림 든 칸 보임', async ({ page, context }) => {
  const ids = await setup(page);
  const body = await grabExport(page);
  expect(String(body).startsWith('THREW'), '내보내기가 던졌다: ' + String(body).slice(0, 200)).toBe(false);
  const p2 = await context.newPage();
  await p2.route('**/*', (r) => r.fulfill({ contentType: 'text/html', body }));
  await p2.goto('http://export.itb.test/export.html');
  const r = await p2.evaluate((ids) => {
    const e = document.querySelector('#' + ids.empty + ' .itb-icon'), f = document.querySelector('#' + ids.filled + ' .itb-icon');
    return { e: !!e, f: !!f, eVis: e && getComputedStyle(e).visibility, fVis: f && getComputedStyle(f).visibility };
  }, ids);
  await p2.close();
  expect(r.e && r.f, '전제: 배송본에 두 칸이 없다').toBe(true);
  expect(r.eVis, '배송본에 빈 칸 점선·자리표시가 그려진다').toBe('hidden');
  expect(r.fVis, '음성대조: 그림 든 칸까지 숨겼다').toBe('visible');
});

test('IC3 Figma JSON — 빈 칸 블럭에 자리표시 svg 가 안 실린다', async ({ page }) => {
  const ids = await setup(page);
  const j = await page.evaluate(() => (window.flushCurrentPage?.(), window.buildFigmaExportJSON(null)));
  let hit = null; JSON.stringify(j, (k, v) => { if (v && v.id === ids.empty) hit = v; return v; });
  expect(hit, '전제: 빈 칸 블럭이 Figma JSON 에 없다').not.toBeNull();
  expect(JSON.stringify(hit.texts || []), '전제: 글자는 실린다').toContain('빈 아이콘 칸');
  expect(String(hit.svg || ''), 'Figma JSON 에 자리표시 svg 가 실렸다').not.toContain(PH_SVG);
});
