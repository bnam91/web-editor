/* label-shape-oval.dom.spec.js — 라벨 Tag Style «Oval(타원)» 단추 (현빈 · 2026-11-14 · wk1/1114-label-oval).
 *   Oval = border-radius:50% · 폭은 글자대로(폭>높이) — Circle(64×64 정원 · data-shape)·Pill(999px 반원 끝)과 다른 꼴.
 *   ⚠️B1 «라벨 모양 변수»(q/cert-* · label-group 블럭 · LABEL_SHAPE_KINDS.ellipse)와 별개 — 그쪽은 다른 파일이다.
 * 시험:
 *   O1 화면 — 단추 → 인라인·계산 radius 50% · data-shape="oval" · 계산 aspect-ratio auto · padding 11px 36px 유지 · 폭>높이
 *      · Oval 하나만 켜짐(누른 직후 + 다시 열기)
 *   O2 저장 왕복 — getSerializedCanvas 에 50% · 그 HTML 로 다시 열면(innerHTML + rebindAll) 같은 꼴 · Oval 켜짐
 *   O3 ⌘Z — 한 번에 Oval 전(맨 라벨 = Box)으로
 *   O4 PNG — 클론 스크린샷(useNative) · html2canvas 둘 다: 왼쪽 위 «모서리 칸»(폭 10%·높이 10%)이 Oval 이면 바탕(흰),
 *      같은 자에서 Pill 이면 채움(검정) = 양성대조 · 위 가운데(폭 50%)는 둘 다 채움(자가 늘 흰 것을 보는 게 아님)
 *   O5 다른 모양 무회귀 — Oval 뒤 pill·box·outline·circle·text 를 누르면 그 단추 하나만 켜진다(판정기가 % 를 오판 안 함)
 *   O6 원형 안전망 무회귀(1115 실앱 ❌ 고침) — Circle 단추 · 레거시 저장본(인라인 50% · data-shape 없음) 둘 다 여전히 정원
 *      (aspect-ratio 1/1 · padding 0) · 레거시는 Circle 이 켜진다
 * 양성대조(srv 미실행 · 인텔): ⑴ prop-text-wireup-label.js 의 label-shape-oval 핸들러를 빼면 O1~O4 빨강(인라인 '' · Box 켜짐)
 *   ⑵ _panel-rendered.js 의 `/%/` 줄을 빼면 O1·O2 빨강(Pill 이 켜진다) · O4 의 Pill 칸은 핸들러가 꺼져도 그대로라 자 검증용.
 *   ⑶ css/editor-layout.css 원형 안전망의 `:not([data-shape])` 를 빼면(OVAL-CTL.patch) O1 빨강(aspect-ratio 1 / 1 · padding 0px) · O4 빨강([전제] 폭>높이×5) · O6 초록
 *   ⑷ 그 레거시 셀렉터 줄을 통째로 지우면 O6 레거시 칸 빨강(정원 회복이 죽는다)
 * ⛔고정 대기 0 · 앱 = bootApp.
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const TEXT = '가로로 아주 긴 타원 라벨 텍스트';
const raf2 = (page) => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
const lit = (page) => page.evaluate(() => [...document.querySelectorAll('#label-style-section .prop-btn-full.active')].map(b => b.id));

async function setup(page) {
  await page.setViewportSize({ width: 1600, height: 1400 });
  const errs = await bootApp(page);
  const id = await page.evaluate(async (t) => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach(s => s.remove());
    await window.addSection();
    window.addTextBlock('label', { content: t });
    return c.querySelector('.text-block[data-type="label"]')?.id || null;
  }, TEXT);
  expect(id, '[전제] 라벨 블럭이 들어갔다').toBeTruthy();
  await openPanel(page, id);
  return { errs, id };
}
async function openPanel(page, id) {
  await page.evaluate((i) => window.selectBlock(i), id);
  await expect(page.locator('#label-shape-oval'), '[전제] Oval 단추가 떴다').toBeVisible();
}
async function press(page, k) {
  await page.locator('#label-shape-' + k).click();
  await raf2(page);
}
const geom = (page, id) => page.evaluate((i) => {
  const p = document.getElementById(i).querySelector('.tb-label');
  const cs = getComputedStyle(p);
  return { inline: p.style.borderRadius, computed: cs.borderTopLeftRadius, aspect: cs.aspectRatio, pad: cs.paddingTop + ' ' + cs.paddingLeft,
    w: p.offsetWidth, h: p.offsetHeight, shape: p.dataset.shape ?? null };
}, id);

test('O1 화면 — Oval 단추 → radius 50% · 폭>높이 · Oval 하나만 켜짐(누른 직후 · 다시 열기)', async ({ page }) => {
  const { errs, id } = await setup(page);
  expect(await lit(page), '[전제] 맨 라벨 = Box').toEqual(['label-shape-box']);
  await press(page, 'oval');
  const g = await geom(page, id);
  expect(g, JSON.stringify(g)).toMatchObject({ inline: '50%', computed: '50%', shape: 'oval', aspect: 'auto', pad: '11px 36px' });
  expect(g.w, `가로로 긴 타원(폭>높이 유지) ${JSON.stringify(g)}`).toBeGreaterThan(g.h);
  expect(await lit(page), '⒜ 누른 직후').toEqual(['label-shape-oval']);
  await openPanel(page, id);
  expect(await lit(page), '⒝ 다시 열기').toEqual(['label-shape-oval']);
  expect(errs).toEqual([]);
});

test('O2 저장 왕복 — 저장본에 50% · 그 HTML 로 다시 열면 같은 꼴 · Oval 켜짐', async ({ page }) => {
  const { errs, id } = await setup(page);
  await press(page, 'oval');
  const before = await geom(page, id);
  const html = await page.evaluate(() => String(window.getSerializedCanvas?.() || ''));
  expect(html.includes(id), '[전제] 저장본에 라벨').toBe(true);
  expect(/tb-label[^>]*border-radius:\s*50%/.test(html), '저장본의 라벨 border-radius 50%').toBe(true);
  await page.evaluate(async (h) => { document.getElementById('canvas').innerHTML = h; await window.rebindAll?.(); }, html);
  await raf2(page);
  expect(await geom(page, id), '다시 연 꼴').toEqual(before);
  await openPanel(page, id);
  expect(await lit(page)).toEqual(['label-shape-oval']);
  expect(errs).toEqual([]);
});

test('O3 ⌘Z — 한 번에 Oval 전(맨 라벨 = Box)으로', async ({ page }) => {
  const { errs, id } = await setup(page);
  const before = await geom(page, id);
  await press(page, 'oval');
  expect((await geom(page, id)).inline, '[전제] Oval 됨').toBe('50%');
  await page.evaluate(() => window.undo());
  await raf2(page);
  expect(await geom(page, id), '⌘Z 한 번').toEqual(before);
  await openPanel(page, id);
  expect(await lit(page)).toEqual(['label-shape-box']);
  expect(errs).toEqual([]);
});

/* 라벨 사각 안 두 점의 밝기(0~255) — corner = (폭 10%, 높이 10%) · top = (폭 50%, 높이 10%). 사각은 섹션 클론 기준 CSS px. */
async function installSampler(page) {
  await page.evaluate(() => {
    window.__ovalPx = (ctx, s, r) => {
      const at = (fx, fy) => { const d = ctx.getImageData(Math.round((r.x + r.w * fx) * s), Math.round((r.y + r.h * fy) * s), 1, 1).data; return Math.round((d[0] + d[1] + d[2]) / 3); };
      return { corner: at(0.1, 0.1), top: at(0.5, 0.1) };
    };
    window.__labelRect = (root, id) => {
      const a = root.getBoundingClientRect(), b = root.querySelector('#' + id + ' .tb-label').getBoundingClientRect();
      return { x: b.left - a.left, y: b.top - a.top, w: b.width, h: b.height };
    };
  });
}
const nativeShot = async (page, secId, id) => {
  await page.evaluate(async (i) => {
    const ex = await import('/js/io/export-image.js');
    document.getElementById('__oclone')?.remove();
    const clone = await ex.prepareCloneForCapture(document.getElementById(i), 860, true);
    ex.renderComponentsInClone(clone);
    clone.id = '__oclone';
    if (!clone.isConnected) document.body.appendChild(clone);
    Object.assign(clone.style, { position: 'fixed', top: '0px', left: '0px', zIndex: '2147483647' });
  }, secId);
  const meta = await page.evaluate((i) => { const c = document.getElementById('__oclone'); return { cw: c.offsetWidth, r: window.__labelRect(c, i) }; }, id);
  const buf = await page.locator('#__oclone').screenshot();
  const px = await page.evaluate(async ([b64, m]) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
    const ctx = cv.getContext('2d'); ctx.drawImage(img, 0, 0);
    return window.__ovalPx(ctx, img.width / m.cw, m.r);
  }, [buf.toString('base64'), meta]);
  await page.evaluate(() => document.getElementById('__oclone')?.remove());
  return { ...px, r: meta.r };
};
const h2cShot = (page, secId, id) => page.evaluate(async ([s, i]) => {
  const ex = await import('/js/io/export-image.js');
  const live = document.getElementById(s);
  const clone = await ex.prepareCloneForCapture(live, 860, false);
  ex.renderComponentsInClone(clone);
  if (!clone.isConnected) document.body.appendChild(clone);
  const cw = clone.offsetWidth, r = window.__labelRect(clone, i);
  const { canvas } = await ex.captureCloneToCanvas(clone, 860, '#ffffff', false, live);
  clone.remove();
  return { ...window.__ovalPx(canvas.getContext('2d'), canvas.width / cw, r), r };
}, [secId, id]);

test('O4 PNG — 클론 스크린샷·html2canvas 둘 다 타원(모서리 칸 바탕) · 같은 자로 Pill 은 모서리 칸 채움', async ({ page }) => {
  test.setTimeout(90000);
  const { errs, id } = await setup(page);
  const secId = await page.evaluate((i) => document.getElementById(i).closest('.section-block').id, id);
  await installSampler(page);
  const shots = {};
  for (const k of ['oval', 'pill']) {
    await openPanel(page, id);
    await press(page, k);
    shots[k] = { native: await nativeShot(page, secId, id), h2c: await h2cShot(page, secId, id) };
  }
  const msg = JSON.stringify(shots);
  console.log('[O4]', msg);
  const r = shots.oval.native.r;
  expect(r.w, `[전제] 모서리 칸(폭 10%)이 Pill 반원(높이 절반) 밖이다 ${msg}`).toBeGreaterThan(r.h * 5);
  const DARK = 100, LIGHT = 200;   // 라벨 채움 #111(≈17) · 섹션 바탕 #fff(255) — 가장자리 안티앨리어싱 여유
  for (const path of ['native', 'h2c']) {
    expect(shots.pill[path].corner, `[양성] ${path} Pill 모서리 칸 = 채움 ${msg}`).toBeLessThan(DARK);
    expect(shots.pill[path].top, `${path} Pill 위 가운데 = 채움`).toBeLessThan(DARK);
    expect(shots.oval[path].top, `${path} Oval 위 가운데 = 채움(자가 흰 것만 보는 게 아님)`).toBeLessThan(DARK);
    expect(shots.oval[path].corner, `★${path} Oval 모서리 칸 = 바탕(타원 밖) ${msg}`).toBeGreaterThan(LIGHT);
  }
  expect(errs).toEqual([]);
});

test('O5 다른 모양 무회귀 — Oval 뒤 각 단추는 그 단추 하나만 켠다', async ({ page }) => {
  const { errs, id } = await setup(page);
  for (const k of ['pill', 'box', 'outline', 'circle', 'text']) {
    await openPanel(page, id);
    await press(page, 'oval');
    expect(await lit(page), `[전제] ${k} 앞 Oval`).toEqual(['label-shape-oval']);
    await press(page, k);
    expect(await lit(page), `${k} 를 눌렀는데`).toEqual(['label-shape-' + k]);
    const g = await geom(page, id);
    expect(g.inline === '50%' && g.shape !== 'circle', `${k} 에 Oval 의 50% 가 남았다 ${JSON.stringify(g)}`).toBe(false);
  }
  expect(errs).toEqual([]);
});

test('O6 원형 안전망 무회귀 — Circle 단추 · 레거시 50%(data-shape 없음) 는 여전히 정원 · 레거시는 Circle 켜짐', async ({ page }) => {
  const { errs, id } = await setup(page);
  await press(page, 'circle');
  const c = await geom(page, id);
  expect(c, `Circle 단추 ${JSON.stringify(c)}`).toMatchObject({ shape: 'circle', aspect: '1 / 1', pad: '0px 0px' });
  expect(Math.abs(c.w - c.h), `Circle 정원 ${JSON.stringify(c)}`).toBeLessThanOrEqual(1);
  await page.evaluate((i) => {   // 레거시 저장본 꼴 — data-shape 표식 이전 원형(인라인 50% 만)
    const p = document.getElementById(i).querySelector('.tb-label');
    delete p.dataset.shape; p.style.padding = ''; p.style.borderRadius = '50%';
  }, id);
  await raf2(page);
  const L = await geom(page, id);
  expect(L, `레거시 50% ${JSON.stringify(L)}`).toMatchObject({ shape: null, inline: '50%', aspect: '1 / 1', pad: '0px 0px' });
  expect(Math.abs(L.w - L.h), `레거시 정원 ${JSON.stringify(L)}`).toBeLessThanOrEqual(1);
  await openPanel(page, id);
  expect(await lit(page), '레거시 50% = Circle 켜짐(Oval 아님)').toEqual(['label-shape-circle']);
  expect(errs).toEqual([]);
});
