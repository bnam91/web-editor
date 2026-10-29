/* marquee-sticker-248.dom.spec.js — 248(지디 261029 12:0x · 결함): 선택상자가 섹션 직속 스티커(마킹·보통)를 못 고른다.
 *   뿌리: 선택상자 명부(scratch-pad.js _marqueeCanvasTargets)와 «서로 맞춤» 명부(prop-multisel.js _overlayUnitOf)가 둘이었고
 *     1013t2C1(ac343b47)이 스티커를 한쪽에만 더했다. 처방 = js/overlay-unit.js 한 벌 · 두 소비자가 부름(tests/unit/overlay-unit-248).
 *   한 쌍(지디 처방 발주): ⑴ M1 — 상자로 마킹·보통 스티커가 잡히나(고치기 전 판 빨강) ⑵ M2 — 공용 술어의 «다른» 소비자(⌘ 로 둘 고른 뒤
 *     getSelectedOverlayUnits = 2)도 산다 ⇒ 술어를 무력화하면 M1·M2 둘(소비자 수)이 빨강 ⑶ M3 — 어노테이션은 여전히 안 잡힌다(음성).
 *   장면: bootApp · 섹션 하나(빈 몸 640) · 스티커 둘(addStickerBlock · 보통 / count=1 마킹) · 어노테이션 하나(makeAnnotationBlock → 섹션 직속).
 *   상자: 캔버스 왼쪽 바닥에서 시작해 셋을 다 덮고 섹션은 반 밑만 덮게(섹션이 잡히면 안의 것은 안 잡는다 — A1 규칙).
 *   ⚠️배율 전제: waitZoomSettled(100) — 맨 applyZoom 은 0.15s 보간.
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitZoomSettled } = require('./_root-harness.js');

const SEC = `
<div class="section-block" id="mS" data-section="1" data-name="S" data-bg="#ffffff" style="background:#fff;">
  <div class="section-hitzone"><span class="section-label">S</span></div>
  <div class="section-inner"><div class="gap-block" data-type="gap" style="height:640px"></div></div></div>`;

async function setup(page) {
  await page.setViewportSize({ width: 1700, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate((html) => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', html); window.rebindAll?.(); window.deselectAll?.(); window.applyZoom?.(100); }, SEC);
  await waitZoomSettled(page, 100);
  const ids = await page.evaluate(() => {
    const sec = document.getElementById('mS'); sec.scrollIntoView({ block: 'start' });
    const mk = (opts) => { window.deselectAll?.(); window.selectSection?.(sec); const before = new Set(sec.querySelectorAll(':scope > .sticker-block'));
      window.addStickerBlock(opts); const n = [...sec.querySelectorAll(':scope > .sticker-block')].filter(b => !before.has(b)); return n.length === 1 ? n[0].id : `ERR:${n.length}`; };
    const plain = mk({ shape: 'circle', x: 120, y: 120 });
    const mark = mk({ count: '1', x: 300, y: 120 });
    const a = window.makeAnnotationBlock({ points: [[500, 130], [580, 170]], text: 't', labelRadius: 0 }); sec.appendChild(a); window.bindAnnotationSelect?.(a);
    window.deselectAll?.(); document.activeElement?.blur?.();
    return { plain, mark, annot: a.id };
  });
  const wrap = await page.evaluate(() => { const w = document.getElementById('canvas-wrap'); w.scrollLeft += document.getElementById('canvas').getBoundingClientRect().left - (w.getBoundingClientRect().left + 200); });
  void wrap;
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  return { errs, ids };
}

/* 전제: 셋 다 섹션 직속 · 화면 면적 > 0 · 마킹은 data-count 를 가졌다 */
async function premise(page, ids) {
  const p = await page.evaluate((ids) => Object.fromEntries(Object.entries(ids).map(([k, id]) => { const e = document.getElementById(id); const r = e?.getBoundingClientRect();
    return [k, { direct: e?.parentElement?.id === 'mS', area: r ? r.width * r.height : 0, count: e?.dataset?.count ?? null }]; })), ids);
  for (const k of ['plain', 'mark', 'annot']) {
    expect(p[k].direct, `전제: ${k} 가 섹션 직속이 아니다`).toBe(true);
    expect(p[k].area, `전제: ${k} 의 화면 면적이 0`).toBeGreaterThan(0);
  }
  expect(p.mark.count, '전제: 마킹 스티커에 data-count 가 없다').toBe('1');
}

/* 캔버스 왼쪽 바깥 바닥에서 시작해 셋을 덮는 상자(모델 px) */
async function marquee(page) {
  const pts = await page.evaluate(() => {
    const sec = document.getElementById('mS').getBoundingClientRect(); const c = document.getElementById('canvas').getBoundingClientRect();
    const box = (id) => document.getElementById(id).getBoundingClientRect();
    /* ★어노테이션 블럭은 섹션 전체를 덮는 층(css/editor-blocks.css .annotation-block width/height 100%) ⇒ 상자 크기는 라벨로 잰다(첫 판 흠: 블럭 상자로 재 섹션 전부를 덮었다) */
    const all = [...document.querySelectorAll('#mS > .sticker-block, #mS > .annotation-block .annot-label')].map(e => e.getBoundingClientRect());
    const top = Math.min(...all.map(r => r.top)) - 20, bot = Math.max(...all.map(r => r.bottom)) + 20, right = Math.max(...all.map(r => r.right)) + 20;
    return { x0: c.left - 60, y0: top, x1: right, y1: bot, secH: sec.height, secW: sec.width, cover: ((bot - top) * (right - c.left)) / (sec.height * sec.width) };
  });
  expect(pts.cover, `전제: 상자가 섹션을 반 이상 덮는다(${pts.cover.toFixed(2)} · 상자 y ${pts.y0.toFixed(0)}~${pts.y1.toFixed(0)} x ~${pts.x1.toFixed(0)} · 섹션 ${pts.secW.toFixed(0)}×${pts.secH.toFixed(0)}) — 섹션이 잡혀 안의 것을 안 잡는다`).toBeLessThan(0.5);
  await page.mouse.move(pts.x0, pts.y0); await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(pts.x0 + (pts.x1 - pts.x0) * i / 10, pts.y0 + (pts.y1 - pts.y0) * i / 10);
  const during = await page.evaluate(() => ({ box: document.querySelectorAll('.scratch-marquee').length, hit: [...document.querySelectorAll('#canvas .marquee-hit')].map(e => e.id) }));
  await page.mouse.up();
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const after = await page.evaluate(() => [...document.querySelectorAll('#canvas .selected')].map(e => e.id).filter(Boolean));
  return { during, after };
}

test('M1 ★선택상자가 섹션 직속 스티커(보통·마킹)를 잡는다(248 · 고치기 전 판 빨강)', async ({ page }) => {
  const { errs, ids } = await setup(page);
  await premise(page, ids);
  const m = await marquee(page);
  expect(m.during.box, '전제: 상자가 안 떴다').toBe(1);
  expect(m.during.hit, '보통 스티커가 상자에 안 걸린다').toContain(ids.plain);
  expect(m.during.hit, '마킹 스티커가 상자에 안 걸린다').toContain(ids.mark);
  expect(m.after, '놓은 뒤 보통 스티커가 안 골라졌다').toContain(ids.plain);
  expect(m.after, '놓은 뒤 마킹 스티커가 안 골라졌다').toContain(ids.mark);
  expect(errs, `앱 오류: ${errs.join(' | ')}`).toEqual([]);
});

test('M2 공용 술어의 다른 소비자 — ⌘ 로 고른 스티커 둘 = «서로 맞춤» 단위 둘', async ({ page }) => {
  const { errs, ids } = await setup(page);
  await premise(page, ids);
  const n = await page.evaluate(async (ids) => {
    window.deselectAll?.();
    window.toggleBlockSelect?.(document.getElementById(ids.plain), document.getElementById('mS'));
    window.toggleBlockSelect?.(document.getElementById(ids.mark), document.getElementById('mS'));
    const sel = [...document.querySelectorAll('#canvas .selected')].map(e => e.id);
    const ms = await import('/js/props/prop-multisel.js');
    const u = ms.getSelectedOverlayUnits();
    return { sel, units: u ? u.map(e => e.id) : null };
  }, ids);
  expect(n.sel, '전제: ⌘ 로 둘이 안 골라졌다').toEqual(expect.arrayContaining([ids.plain, ids.mark]));
  expect(n.units, '«서로 맞춤» 단위가 둘이 아니다').toEqual(expect.arrayContaining([ids.plain, ids.mark]));
  expect(n.units.length).toBe(2);
  expect(errs, `앱 오류: ${errs.join(' | ')}`).toEqual([]);
});

test('M3 음성 — 어노테이션은 상자에 안 잡힌다(ac343b47 «제외» 결정)', async ({ page }) => {
  const { errs, ids } = await setup(page);
  await premise(page, ids);
  const m = await marquee(page);
  expect(m.during.box, '전제: 상자가 안 떴다').toBe(1);
  expect(m.during.hit, '★어노테이션이 상자에 걸렸다').not.toContain(ids.annot);
  expect(m.after, '★어노테이션이 골라졌다').not.toContain(ids.annot);
  expect(errs, `앱 오류: ${errs.join(' | ')}`).toEqual([]);
});
