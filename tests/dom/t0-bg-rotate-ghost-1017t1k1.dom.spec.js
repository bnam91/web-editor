/* t0-bg-rotate-ghost-1017t1k1.dom.spec.js — 1017t1k1 「로테이트는 됐는데 크롭되서? 프레임안에서만 보임」
 *
 * ★현빈 원문(T0-NOTE-ORIGINAL-261025.txt :11 의 👉 뒤)
 *   「로테이트는 됐는데 크롭되서? 프레임안에서만 보임」
 * ★잰 사람(S3 · t8 재채점 · 판 f62653ce) — 27.9° 돌리면 그림은 프레임(.sec-bg-clip · overflow hidden) 안에서만 돌고,
 *   프레임 «밖»을 보여 주는 고스트(.sec-bg-ghost)는 transform none(0°) 그대로였다.
 * ★뿌리 둘(소스 + 이 파일의 G 칸으로 잼)
 *   ⑴ 고스트를 아무도 안 돌린다(js/image-handling.js syncBg — left/top/width/height/clip 만 쓴다).
 *   ⑵ 레이어 .sec-bg-img 가 «프레임 크기 상자»째 «프레임 중심»을 축으로 돈다(js/bg-layer.js paintBgLayer) —
 *      손잡이·경계선은 «그림 중심»을 축으로 돈다(enterImageEditMode syncHandles) ⇒ 그림을 옮긴 뒤 돌리면 둘이 어긋나고,
 *      프레임 상자 밖에 있던 그림 부분은 돌아 들어와도 안 그려진다(「크롭」).
 *
 * ★칸
 *   P  전제 — 섹션 배경 편집 진입 ⇒ 회전존 4 · 고스트 1 · 그림을 (+80,+40) 끌어 «가운데에서 비켜» 놓았다(프록시 imgX/Y 가 움직임)
 *   G1 30° 돌리면 고스트도 30° 로 돈다(계산된 transform 각)
 *   G2 고스트의 «도는 축» = 경계선(.img-boundary)의 축 — 둘의 화면 사각형 중심이 1px 안
 *   G3 레이어(그려지는 그림)의 축도 같은 자리 — .sec-bg-img 사각형 중심 = 경계선 중심(1px 안)
 *   G4 Esc 로 끝낸 뒤에도 — 레이어 중심 = dataset.bgPos/bgSize 로 계산한 그림 중심(프레임 기준 · 1px 안) ·
 *      bgRotate ≈30 · bgSize/bgPos 가 px 꼴(되돌릴 키워드가 아니다)
 * ⛔고정 대기 0 — 조건 대기만.
 * 실행: bash ~/taeyang-098/run-test.sh dom tests/dom/t0-bg-rotate-ghost-1017t1k1.dom.spec.js
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');

/* 60×40 PNG(위 빨강 · 아래 파랑) — zlib 로 지은 진짜 바이트. 섹션 비율과 달라 cover 로 크게 늘어난다. */
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADwAAAAoCAIAAAAt2Q6oAAAASUlEQVR4nO3OAQ0AIAwDsEtCAlKQjASkIIOdNKmA1pmznXo+kA4mLS0dQFpaOoC0tHSAnumxdjvS0tIBpKWlA0hLSweQlv4tfQHbFuS17Q0c+wAAAABJRU5ErkJggg==';

async function setup(page) {
  await page.setViewportSize({ width: 1400, height: 1000 });
  const errs = await bootApp(page);
  await page.evaluate(({ src }) => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend',
      '<div class="section-block" data-section="1" id="secR" style="height:300px">'
      + '<div class="section-hitzone"></div><div class="section-inner"></div></div>');
    window.rebindAll?.();
    const sec = document.getElementById('secR');
    sec.dataset.bgImg = src;
    window.applySectionBg?.(sec);
  }, { src: PNG });
  await waitStableRect(page, '#secR');
  return errs;
}

async function enterEdit(page) {
  await page.evaluate(() => window.enterSectionBgEditMode(document.getElementById('secR')));
  await page.waitForFunction(() => {
    const img = document.querySelector('.sec-bg-proxy .asset-img');
    return !!img && img.complete && img.naturalWidth > 0 && document.querySelectorAll('#ss-handles-overlay .img-rotate-zone').length === 4 && !!document.querySelector('.sec-bg-ghost');
  }, null, { timeout: 5000 });
  await page.waitForFunction(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(true)))));
}

/** 회전존을 눌러 그림 중심 기준 targetDeg 만큼 돌린다(45° 스냅 밖의 값). */
async function rotateBy(page, targetDeg) {
  const r = await page.evaluate(() => {
    const img = document.querySelector('.sec-bg-proxy .asset-img');
    const ir = img.getBoundingClientRect();
    const cx = ir.left + ir.width / 2, cy = ir.top + ir.height / 2;
    for (const zone of document.querySelectorAll('#ss-handles-overlay .img-rotate-zone')) {
      const zr = zone.getBoundingClientRect();
      for (const [zx, zy] of [[zr.left + 4, zr.top + 4], [zr.right - 4, zr.top + 4], [zr.left + 4, zr.bottom - 4], [zr.right - 4, zr.bottom - 4]]) {
        if (zx >= 0 && zy >= 0 && zx < innerWidth && zy < innerHeight && document.elementFromPoint(zx, zy) === zone) return { cx, cy, zx, zy };
      }
    }
    return null;
  });
  expect(r, '전제: 누를 수 있는 회전존').not.toBeNull();
  const a0 = Math.atan2(r.zy - r.cy, r.zx - r.cx);
  const rad = Math.hypot(r.zx - r.cx, r.zy - r.cy);
  await page.mouse.move(r.zx, r.zy);
  await page.mouse.down();
  for (let k = 1; k <= 8; k++) {
    const a = a0 + (targetDeg * Math.PI / 180) * k / 8;
    await page.mouse.move(r.cx + rad * Math.cos(a), r.cy + rad * Math.sin(a));
  }
  await page.mouse.up();
  await page.waitForFunction((w) => Math.abs(parseFloat(document.querySelector('.sec-bg-proxy')?.dataset.imgRotate || 0) - w) < 0.6, targetDeg, { timeout: 3000 });
  await page.waitForFunction(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(true)))));
}

/** 요소의 계산된 transform 각(도) — matrix(a,b,…) 의 atan2(b,a). */
const ANGLE = `(el) => { const t = getComputedStyle(el).transform; if (!t || t === 'none') return 0; const m = t.match(/matrix\\(([^)]+)\\)/); if (!m) return null; const [a, b] = m[1].split(',').map(parseFloat); return Math.atan2(b, a) * 180 / Math.PI; }`;

async function moveImage(page, dx, dy) {
  const p = await page.evaluate(() => {
    const sec = document.getElementById('secR').getBoundingClientRect();
    const img = document.querySelector('.sec-bg-proxy .asset-img');
    return { x: sec.left + sec.width * 0.5, y: sec.top + sec.height * 0.5, x0: parseFloat(img.style.left) || 0, y0: parseFloat(img.style.top) || 0 };
  });
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.mouse.move(p.x + dx / 2, p.y + dy / 2, { steps: 4 });
  await page.mouse.move(p.x + dx, p.y + dy, { steps: 4 });
  await page.mouse.up();
  await page.waitForFunction((p0) => { const img = document.querySelector('.sec-bg-proxy .asset-img'); return Math.abs((parseFloat(img.style.left) || 0) - p0.x0) > 5; }, p, { timeout: 3000 });
}

const center = (r) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });

test('P·G1·G2·G3 ★옮긴 뒤 30° — 고스트도 돌고, 고스트·레이어·경계선의 축이 한 점', async ({ page }) => {
  const errs = await setup(page);
  await enterEdit(page);
  await moveImage(page, 80, 40);
  await rotateBy(page, 30);
  const m = await page.evaluate((ANGLE) => {
    const ang = eval(ANGLE);
    const g = document.querySelector('.sec-bg-ghost');
    const bd = document.querySelector('#ss-handles-overlay .img-boundary');
    const L = document.querySelector('#secR > .sec-bg-clip > .sec-bg-img');
    const c = (e) => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
    return { ghostDeg: ang(g), ghostC: c(g), boundC: c(bd), layer: !!L, layerC: L ? c(L) : null };
  }, ANGLE);
  expect(Math.abs(m.ghostDeg - 30), `G1 고스트 각 ${m.ghostDeg}`).toBeLessThan(0.6);
  expect(Math.hypot(m.ghostC.x - m.boundC.x, m.ghostC.y - m.boundC.y), `G2 고스트 축 ${JSON.stringify(m.ghostC)} vs 경계선 ${JSON.stringify(m.boundC)}`).toBeLessThan(1);
  expect(m.layer, 'G3 전제: 편집 중 레이어').toBe(true);
  expect(Math.hypot(m.layerC.x - m.boundC.x, m.layerC.y - m.boundC.y), `G3 레이어 축 ${JSON.stringify(m.layerC)} vs 경계선 ${JSON.stringify(m.boundC)}`).toBeLessThan(1);
  expect(errs).toEqual([]);
});

test('G4 ★Esc 로 끝낸 뒤 — 레이어가 그림 중심을 축으로 30° · bgSize/bgPos 가 px 꼴', async ({ page }) => {
  const errs = await setup(page);
  await enterEdit(page);
  await moveImage(page, 80, 40);
  await rotateBy(page, 30);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => document.querySelectorAll('.sec-bg-proxy, .sec-bg-ghost-wrap, .sec-bg-ghost').length === 0, null, { timeout: 5000 });
  const m = await page.evaluate((ANGLE) => {
    const ang = eval(ANGLE);
    const sec = document.getElementById('secR');
    const L = sec.querySelector(':scope > .sec-bg-clip > .sec-bg-img');
    const sr = sec.getBoundingClientRect();
    const z = sr.width / sec.offsetWidth;
    const ds = { rot: sec.dataset.bgRotate, size: sec.dataset.bgSize, pos: sec.dataset.bgPos };
    const [w, h] = String(ds.size).split(/\s+/).map(parseFloat);
    const [x, y] = String(ds.pos).split(/\s+/).map(parseFloat);
    const cs = getComputedStyle(sec);
    const want = { x: sr.left + (parseFloat(cs.borderLeftWidth) + x + w / 2) * z, y: sr.top + (parseFloat(cs.borderTopWidth) + y + h / 2) * z };
    const lr = L ? L.getBoundingClientRect() : null;
    return { ds, layer: !!L, deg: L ? ang(L) : null, got: lr ? { x: lr.left + lr.width / 2, y: lr.top + lr.height / 2 } : null, want };
  }, ANGLE);
  expect(Math.abs(parseFloat(m.ds.rot) - 30), `G4 bgRotate ${m.ds.rot}`).toBeLessThan(0.6);   /* 끌기 끝이 29.9 처럼 떨어진다(소수 한 자리 저장) — 각은 근사로 잰다 */
  expect(m.ds.size, 'G4 bgSize px 꼴').toMatch(/^-?[\d.]+px -?[\d.]+px$/);
  expect(m.ds.pos, 'G4 bgPos px 꼴').toMatch(/^-?[\d.]+px -?[\d.]+px$/);
  expect(m.layer, 'G4 레이어').toBe(true);
  expect(Math.abs(m.deg - 30), `G4 레이어 각 ${m.deg}`).toBeLessThan(0.6);
  expect(Math.hypot(m.got.x - m.want.x, m.got.y - m.want.y), `G4 레이어 축 ${JSON.stringify(m.got)} vs 그림 중심 ${JSON.stringify(m.want)}`).toBeLessThan(1);
  expect(errs).toEqual([]);
});
