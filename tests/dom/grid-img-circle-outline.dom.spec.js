/* grid-img-circle-outline.dom.spec.js — 현빈 2026-10-03 「그리드 블럭의 칸에 원형 이미지를 추가할 수 있잖아? 근데 이게 아웃라인이 이상한데…
 *   서클에셋블럭의 그것과 달라」 (G24).
 * ★실측으로 정리한 «그때 모습»(핀 37ab1c65): 고른 원형 이미지 줄 = 인라인 border-radius:50% 가 «왼쪽 막대» inset box-shadow 를 초승달 호로 휘게 했고,
 *   줄 상자엔 모서리 핸들 4개뿐 «변»이 없었다. 상자 변처럼 보이던 선 = 줄이 아니라 «블럭» 의 것(#ss-handles-overlay 의 SVG path.ss-sel-path,
 *   js/selection-overlay.js _render) — 그건 맨 위 층이라 «핀에서도 이미지에 안 끊긴다»(D4a 가 양쪽 초록인 까닭).
 * ★서클 에셋(.icon-circle-block.selected::before)과 같은 «두 줄»: ::before=원형 링 · ::after=네모 선(핸들 자리). 둘 다 <img> 위(z-index).
 * 앱 통째(bootApp) · 선택은 진짜 마우스(첫 클릭=블럭, 둘째=그 줄). 전제: 배율은 «실제 요소 폭»으로 재서 단언한다(변수만 믿지 않는다).
 * ★양성대조 판 37ab1c65: GD1001_ROOT=<핀 체크아웃> — D1·D3·D4b·D4c 빨강 / D4a·D5·D6 초록(지키는 시험). 계측기 대조 = 서클 에셋 블럭(B) + 「선 안쪽 20px」(없음) 은 양쪽 판 동일.
 * 미측정 · 태양 · 2026-10-03: 칸 «전체»가 원인 경우는 없다(원형은 줄 단위뿐) · 실앱 Electron 창에서의 사람 눈 확인. */
const { test, expect } = require('@playwright/test');
const { bootApp, pinnedBoot } = require('./_root-harness.js');
const PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const EDGE = [45, 111, 232];   // --sel-color
const D5_PIN = 'e548c211';

async function mount(page, kind, zoom, { empty = false, square = false, boot = bootApp } = {}) {
  await page.setViewportSize({ width: 1500, height: 1000 });
  await boot(page);
  await page.evaluate(([PX, kind, empty, square]) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', `<div class="section-block" id="gS" data-section="1"><div class="section-hitzone"></div><div class="section-inner">
      <div class="gap-block" data-type="gap" style="height:60px"></div><div class="row" id="gR" data-layout="stack"></div><div class="gap-block" data-type="gap" style="height:400px"></div></div></div>`);
    if (kind === 'grid') {
      const img = { type: 'image', height: 300 };
      if (!square) img.imgShape = 'circle'; else img.height = 120;
      if (!empty) img.imgSrc = PX;
      const { block: g } = window.makeGridBlock({ cols: [{ width: 1, lines: [img, { type: 'body', text: 'x' }] }, { width: 3, lines: [{ type: 'body', text: 'y' }] }], rows: [{ height: 'auto' }] });
      g.id = 'gG'; document.getElementById('gR').appendChild(g); window.rebindAll?.(); window.renderGridBlock(g);
    } else {
      const { row, block } = window.makeIconCircleBlock(); block.id = 'gG'; document.getElementById('gS').querySelector('.gap-block').after(row); window.rebindAll?.();
    }
    window.deselectAll?.();
  }, [PX, kind, empty, square]);
  await page.waitForTimeout(300);
  await page.evaluate((z) => window.applyZoom(z), zoom); await page.waitForTimeout(500);
  const sel = kind === 'grid' ? '#gG .grd-img-frame' : '#gG .icb-circle';
  const center = () => page.evaluate((sel) => { const r = document.querySelector(sel).getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, sel);
  let [x, y] = await center();
  await page.mouse.click(x, y); await page.waitForTimeout(200);
  if (kind === 'grid') { await page.mouse.click(x, y); await page.waitForTimeout(300); }
  await page.mouse.move(20, 600); await page.waitForTimeout(350);
  /* ★전제 단언 — 배율을 «실제 요소»로 잰다(applyZoom 에 0.5 를 넘겨도 변수는 조용히 받는다) */
  const prem = await page.evaluate(([sel, zoom]) => {
    const cv = document.getElementById('canvas'); const f = document.querySelector(sel);
    return { scale: cv.getBoundingClientRect().width / cv.offsetWidth, frameScale: f.getBoundingClientRect().width / f.offsetWidth,
      inv: parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--inv-zoom')), zoom };
  }, [sel, zoom]);
  expect(prem.scale, `실제 캔버스 배율 = ${zoom}%`).toBeCloseTo(zoom / 100, 2);
  expect(prem.frameScale, '실제 요소 배율').toBeCloseTo(zoom / 100, 2);
  expect(prem.inv, '--inv-zoom').toBeCloseTo(100 / zoom, 2);
  if (kind === 'grid') expect(await page.evaluate(() => document.querySelector('#gG .grd-img-frame').classList.contains('grd-line-selected')), '전제: 그 줄이 고른 상태').toBe(true);
  else expect(await page.evaluate(() => document.getElementById('gG').classList.contains('selected')), '전제: 블럭이 고른 상태').toBe(true);
  return sel;
}

/* 화면 사진을 한 번 찍어 페이지 안에서 픽셀 조회 — 반환: 구간 검사 함수들의 결과 */
async function shot(page, key = '__shot') {
  const b = (await page.screenshot()).toString('base64');
  await page.evaluate(async ([b, key]) => { const i = new Image(); i.src = 'data:image/png;base64,' + b; await i.decode(); const c = document.createElement('canvas'); c.width = i.width; c.height = i.height;
    const k = c.getContext('2d'); k.drawImage(i, 0, 0); window[key] = { w: i.width, h: i.height, d: k.getImageData(0, 0, i.width, i.height).data }; }, [b, key]);
}
/* 선택을 «푼» 같은 화면 — 원 둘레가 «선택 때문에» 바뀌었는지 비교하는 기준 */
async function shotDeselected(page) { await page.evaluate(() => window.deselectAll?.()); await page.mouse.move(20, 600); await page.waitForTimeout(350); await shot(page, '__shot0'); }
/* 한 변을 따라 «선 색 픽셀이 한 줄 두께 안에 있는가» — 끊김 개수. side: top|bottom|left|right, [a,b) = 변을 따라가는 구간(화면 px) */
function edgeRun(page, rect, side, a, b, off = 0) {
  return page.evaluate(([r, side, a, b, off, EDGE]) => {
    const S = window.__shot; const near = (x, y) => { if (x < 0 || y < 0 || x >= S.w || y >= S.h) return false; const o = (y * S.w + x) * 4;
      return S.d[o + 2] > S.d[o] + 16; };   /* «선 색 계열» = 푸르다(가장자리 안티앨리어싱 포함) — 분홍·회색 체커·옅은 파랑 틴트(b-r≤14, 선 가장자리 안티앨리어싱은 ≥16)는 아니다 */
    const horiz = side === 'top' || side === 'bottom';
    const base = Math.round(side === 'top' ? r.top : side === 'bottom' ? r.bottom : side === 'left' ? r.left : r.right) + off;
    let gaps = 0, n = 0;
    for (let t = Math.ceil(a); t < Math.floor(b); t++) { n++; let ok = false;
      for (let d = -2; d <= 2 && !ok; d++) ok = horiz ? near(t, base + d) : near(base + d, t);
      if (!ok) gaps++; }
    return { gaps, n };
  }, [rect, side, a, b, off, EDGE]);
}
const rectOf = (page, sel) => page.evaluate((sel) => { const r = document.querySelector(sel).getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, w: r.width, h: r.height }; }, sel);
/* 원 둘레 8방위(안쪽 0.5px) 가 선 색인가 */
function ringPoints(page, r) {
  return page.evaluate((r) => { const S = window.__shot, S0 = window.__shot0; const cx = (r.left + r.right) / 2, cy = (r.top + r.bottom) / 2, R = r.w / 2;
    let hit = 0; const miss = [];
    for (let k = 0; k < 8; k++) { let ok = false;
      /* 대각선에선 1px 선이 «픽셀 두 개에 옅게 갈라져» 한 점만 보면 놓친다 — 방위 ±6° 호를 훑는다 */
      for (let dd = -6; dd <= 6 && !ok; dd += 1.5) for (let dr = -2.5; dr <= 1.5 && !ok; dr += 0.5) { const a = (k * 45 + dd) * Math.PI / 180; const x = Math.round(cx + (R + dr) * Math.cos(a)), y = Math.round(cy + (R + dr) * Math.sin(a)); const o = (y * S.w + x) * 4;
        /* 선택 «때문에» 이 픽셀이 바뀌었고(채널 차 ≥ 40) 푸른 쪽으로 갔다 — 분홍·체커·틴트만으론 안 걸린다 */
        const dB = S.d[o + 2] - S0.d[o + 2], dR = S.d[o] - S0.d[o];
        ok = Math.max(Math.abs(S.d[o] - S0.d[o]), Math.abs(S.d[o + 1] - S0.d[o + 1]), Math.abs(S.d[o + 2] - S0.d[o + 2])) >= 40 && dB > dR; }
      if (ok) hit++; else miss.push(k * 45); }
    return { hit, miss }; }, r);
}

for (const zoom of [100, 40]) {
  for (const empty of [false, true]) {
    const tag = `줌${zoom} ${empty ? '빈 원' : '그림 든 원'}`;
    test(`D1~D4 ★${tag} — 링(::before)·네모 선(::after) 둘 다 있고 · 링 반경 50% · <img> 위 · 접점에서 안 끊긴다`, async ({ page }) => {
      const sel = await mount(page, 'grid', zoom, { empty });
      const info = await page.evaluate((sel) => { const f = document.querySelector(sel); const b = getComputedStyle(f, '::before'), a = getComputedStyle(f, '::after'); const img = f.querySelector('img');
        return { bc: b.content, bpos: b.position, br: b.borderTopLeftRadius, bz: b.zIndex, ac: a.content, ar: a.borderTopLeftRadius, az: a.zIndex, imgZ: img ? getComputedStyle(img).zIndex : null, imgPos: img ? getComputedStyle(img).position : null,
          bp: b.pointerEvents }; }, sel);
      /* D1 ⑴ 링 요소가 있다 */
      expect.soft(info.bc, 'D1 링(::before) 이 있다').not.toBe('none');
      expect.soft(info.ac, 'D1 네모 선(::after) 이 있다').not.toBe('none');
      /* D2 ⑵ 반경 50% */
      expect.soft(info.br, 'D2 링 반경').toBe('50%');
      expect.soft(info.ar, 'D2 네모 선은 반경 0').toBe('0px');
      /* D3 ⑶ 링 z-index > <img> */
      const z = Number(info.bz); const imgZ = info.imgZ === null || info.imgZ === 'auto' ? 0 : Number(info.imgZ);
      expect.soft(z, 'D3 링 z-index 가 숫자').toBeGreaterThan(0);
      expect.soft(z, 'D3 링이 <img> 위').toBeGreaterThan(imgZ);
      expect.soft(Number(info.az), 'D3 네모 선도 <img> 위').toBeGreaterThan(imgZ);
      expect.soft(info.bp, '클릭은 줄이 받는다').toBe('none');
      /* D4 ⑷ 픽셀 */
      /* ★⑵(10-06 · 제4안 ⒝ — 손잡이 여덟) — 고르면 블럭 왼변 가운데 «w» 손잡이(7×7)가 왼변 선 위에 앉는다 → D4a 왼변이 그 몸통을 «끊김»으로 읽었다(실측 7b017a98).
         잠그는 것은 «선이 안 끊긴다»지 손잡이가 아니다 ⇒ 찍는 동안 손잡이를 숨긴다(D5 의 해시 선례 그대로 · 제품 손 안 댐). 확인: 숨기면 D1~D4 ×4 초록(07:22:46). */
      await page.evaluate(() => document.querySelectorAll('[data-grd-resize-dir]').forEach(h => { h.style.visibility = 'hidden'; }));
      await shot(page);
      if (process.env.G24_SHOTS) await page.screenshot({ path: `${process.env.G24_SHOTS}/${process.env.GD1001_ROOT ? 'before' : 'after'}-z${zoom}-${empty ? 'empty' : 'img'}.png` });
      const r = await rectOf(page, sel);
      expect(Math.abs(r.w - r.h), '전제: 정원').toBeLessThanOrEqual(1);
      const inset = 6;
      const bottom = await edgeRun(page, r, 'bottom', r.left + inset, r.right - inset, -1);
      const right = await edgeRun(page, r, 'right', r.top + inset, r.bottom - inset, -1);
      expect.soft(bottom, 'D4b 그림 상자 아랫변이 «한 칸도 안 끊기고» 선 색').toMatchObject({ gaps: 0 });
      expect.soft(right, 'D4b 그림 상자 오른변').toMatchObject({ gaps: 0 });
      await shotDeselected(page);
      const ring = await ringPoints(page, r);
      expect.soft(ring, 'D4c 원 둘레 8방위가 모두 선 색').toMatchObject({ hit: 8 });
      /* D4a 지키는 시험 — 블럭 상자 변(오버레이 SVG)과 겹치는 윗변·왼변: 핀에서도 안 끊긴다 */
      expect.soft(await edgeRun(page, r, 'top', r.left + inset, r.right - inset, 0), 'D4a 윗변(블럭 변과 겹침)').toMatchObject({ gaps: 0 });
      expect.soft(await edgeRun(page, r, 'left', r.top + inset, r.bottom - inset, 0), 'D4a 왼변').toMatchObject({ gaps: 0 });
      /* 계측기 대조 — 원 «한가운데 가로줄» 에선 선 색이 «없다» (전부 끊김으로 나와야 계측기가 산다) */
      const ctl = await edgeRun(page, { ...r, bottom: (r.top + r.bottom) / 2 }, 'bottom', r.left + r.w * 0.3, r.right - r.w * 0.3, 0);
      expect(ctl.gaps, '계측기 대조: 선이 «없는» 자리는 끊김으로 읽는다').toBeGreaterThan(ctl.n * 0.9);
    });
  }
}

test('D3b 계측기 양성대조 — 서클 에셋 블럭(B)은 같은 자(아랫변 연속 · 8방위)에서 «양쪽 판» 초록', async ({ page }) => {
  const sel = await mount(page, 'asset', 100);
  if (process.env.G24_SHOTS) await page.screenshot({ path: `${process.env.G24_SHOTS}/${process.env.GD1001_ROOT ? 'before' : 'after'}-asset-circle.png` });
  await shot(page);
  const r = await rectOf(page, sel);
  const blk = await page.evaluate(() => { const b = document.getElementById('gG').getBoundingClientRect(); return { left: b.left, top: b.top, right: b.right, bottom: b.bottom, w: b.width, h: b.height }; });
  expect(await edgeRun(page, blk, 'bottom', blk.left + 6, blk.right - 6, -1), '서클 에셋 네모 아랫변').toMatchObject({ gaps: 0 });
  expect(await edgeRun(page, blk, 'right', blk.top + 6, blk.bottom - 6, -1), '서클 에셋 네모 오른변').toMatchObject({ gaps: 0 });
  await shotDeselected(page);
  const rp = await ringPoints(page, r); 
  expect(rp, '서클 에셋 링 8방위').toMatchObject({ hit: 8 });
});

test('D5 지키는 시험 — 사각 이미지 줄: 고르면 왼쪽 막대·가상요소 없음·overflow/position 불변 · 사진 해시도 핀과 같다', async ({ page }) => {
  const sel = await mount(page, 'grid', 100, { square: true });
  const cs = await page.evaluate((sel) => { const f = document.querySelector(sel); const s = getComputedStyle(f);
    return { bs: s.boxShadow, pos: s.position, ov: s.overflow, bc: getComputedStyle(f, '::before').content, ac: getComputedStyle(f, '::after').content, radius: s.borderTopLeftRadius, imgRadius: getComputedStyle(f.querySelector('img') || f).borderTopLeftRadius }; }, sel);
  expect(cs).toEqual({ bs: 'rgb(45, 111, 232) 2px 0px 0px 0px inset', pos: 'static', ov: 'visible', bc: 'none', ac: 'none', radius: '0px', imgRadius: '0px' });
  /* ★사진 비교 — 같은 런·같은 크로미움에서 «핀 판 파일»로 같은 장면을 띄워 픽셀로 견준다(J323X · 지디 판정).
     ⚰️(옛) 리터럴 해시: 맥마다 값이 달랐다 — 아이맥 3952362091 · 수지 2755476141 ×15 · 4116504563 ×3 · 아이맥에선 그 값을 잰 판 e548c211 도 130943565 = 한 환경에서만 참.
     허용 : 채널 차 2 이상 = 0 화소 · 채널 차 1 = 64 화소 이하. 까닭 : 판 사이 실측 18 화소(217×217 · 각 채널 1 · 선택 선·모서리 · 3adc7a91↔2a6f28d9) — 눈에 안 보이는 안티에일리어스 몫.
     D5_PIN 은 옛 리터럴을 잰 병합 판이다(E157 R1 뒤 · 크롭 없는 1×1 사각 줄 = 정사각 · 옛 ⑵ 다시 핀 2026-10-06 a497e201 APPROVED_BY: 태양 integ25-pins). ⛔값을 다시 박지 마라. */
  const png = async (pg, sl) => { const r = await rectOf(pg, sl);
    /* 10-05 K3 ⒜ — 흐름 그리드에도 모서리 «폭» 손잡이가 서서(오버레이 고정층) 범위(그림 ±4px)에 nw 손잡이가 들어온다(탐침 F-GRID probe-d5)
       요구 = «그림이 안 바뀐다» 그대로 ⇒ 찍는 동안만 장면에서 손잡이를 숨긴다(제품 손 안 댐) · 찍은 뒤 되돌림. */
    await pg.evaluate(() => document.querySelectorAll('[data-grd-resize-dir]').forEach(h => { h.dataset.d5Vis = h.style.visibility; h.style.visibility = 'hidden'; }));
    const b = (await pg.screenshot({ clip: { x: Math.floor(r.left) - 4, y: Math.floor(r.top) - 4, width: Math.ceil(r.w) + 8, height: Math.ceil(r.h) + 8 } })).toString('base64');
    await pg.evaluate(() => document.querySelectorAll('[data-grd-resize-dir]').forEach(h => { h.style.visibility = h.dataset.d5Vis || ''; delete h.dataset.d5Vis; }));
    return b; };
  const nowB = await png(page, sel);
  const p2 = await page.context().newPage();
  const pinSel = await mount(p2, 'grid', 100, { square: true, boot: pinnedBoot(D5_PIN) });
  const pinB = await png(p2, pinSel); await p2.close();
  const diff = await page.evaluate(async ([a, b]) => { const rd = async (s) => { const i = new Image(); i.src = 'data:image/png;base64,' + s; await i.decode(); const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const k = c.getContext('2d'); k.drawImage(i, 0, 0); return { w: i.width, h: i.height, d: k.getImageData(0, 0, i.width, i.height).data }; };
    const A = await rd(a), B = await rd(b); if (A.w !== B.w || A.h !== B.h) return { size: `${A.w}x${A.h} ≠ ${B.w}x${B.h}` };
    let one = 0, big = 0; for (let t = 0; t < A.d.length; t += 4) { const m = Math.max(Math.abs(A.d[t] - B.d[t]), Math.abs(A.d[t + 1] - B.d[t + 1]), Math.abs(A.d[t + 2] - B.d[t + 2])); if (m > 1) big++; else if (m === 1) one++; }
    return { size: `${A.w}x${A.h}`, one, big }; }, [nowB, pinB]);
  console.log('[D5] ' + JSON.stringify(diff));
  expect(diff.size, '사진 크기 = 핀과 같다(E157 R1 — 크롭 없는 1×1 사각 줄 = 정사각)').toBe('217x217');
  expect(diff.big, `★채널 차 2 이상 화소 0 — 눈에 보이는 차 (${JSON.stringify(diff)})`).toBe(0);
  expect(diff.one, `채널 차 1 화소 ≤64 — 안티에일리어스 몫(실측 18) (${JSON.stringify(diff)})`).toBeLessThanOrEqual(64);
});
