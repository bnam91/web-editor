/* color-adjust-panel-avoid-handle — IMAGE-EDIT-SE-HANDLE-UNDER-COLOR-PANEL-01 (수지맥 채점 곁 261112 · 현빈/지디 ㉠ 261113)
 *   증상: 이미지 편집모드에서 오른아래(se) 손잡이를 «색상 조정» 패널(#color-adjust-panel · fixed 오른아래)이 덮어 못 잡았다.
 *   손잡이 층은 #canvas-area 격리 안이라 z-index 로는 못 올린다 ⇒ 패널이 «비킨다»(js/image-color-adjust.js _avoidHandles).
 *   P0 [음성 · 무변] 손잡이와 안 겹치면 패널은 기본 자리 그대로(인라인 top/bottom 비어 있음)
 *   P1 [재현→고침] se 모서리가 기본 패널 자리 한가운데면 → 패널이 위로 비켜 네 모서리 손잡이 어느 것도 안 덮는다
 *   P2 [사용자 자리 존중] 헤더를 끌어 옮긴 뒤엔 겹쳐도 그 자리 그대로
 *   양성대조: showColorAdjustPanel 의 `if (!_panelPos) _avoidHandles(panel, host);` 한 줄만 빼면 P1 빨강 · P0·P2 초록.
 *   ⛔앱을 안 띄운다(bootApp = index.html + 레포 파일 · 크로미움). 고정 대기 0.
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const PNG1 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

async function setup(page) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  expect(errs, '앱 부팅 pageerror').toEqual([]);
  await page.evaluate((PNG1) => {
    /* 편집 중 이미지 상자 대역 — 화면 좌표를 정확히 놓으려고 fixed 로 둔다(패널이 재는 것은 host 의 화면 사각형뿐) */
    document.body.insertAdjacentHTML('beforeend',
      `<div class="asset-block" id="adjHost" style="position:fixed;left:0;top:0;width:300px;height:200px;z-index:1"><img class="asset-img" src="${PNG1}" style="width:100%;height:100%"></div>`);
  }, PNG1);
}

/** host 를 (x,y) 에 놓고 패널을 연다 → 패널 사각형·인라인 위치·덮인 모서리 수. */
const openAt = (page, x, y) => page.evaluate(([x, y]) => {
  const host = document.getElementById('adjHost');
  host.style.left = x + 'px'; host.style.top = y + 'px';
  window.hideColorAdjustPanel();
  window.showColorAdjustPanel(host);
  const panel = document.getElementById('color-adjust-panel');
  const p = panel.getBoundingClientRect(), r = host.getBoundingClientRect();
  const covered = [[r.left, r.top], [r.right, r.top], [r.left, r.bottom], [r.right, r.bottom]]
    .filter(([cx, cy]) => cx + 4 > p.left && cx - 4 < p.right && cy + 4 > p.top && cy - 4 < p.bottom).length;
  return { p: { left: Math.round(p.left), top: Math.round(p.top), right: Math.round(p.right), bottom: Math.round(p.bottom) },
           inlineTop: panel.style.top, inlineBottom: panel.style.bottom, covered };
}, [x, y]);

/** 손잡이와 먼 자리(왼위)에서 연 «기본 자리» 사각형. */
const defaultRect = async (page) => (await openAt(page, 0, 0)).p;

test('P0 [음성 · 무변] 손잡이와 안 겹치면 패널은 기본 자리 그대로', async ({ page }) => {
  await setup(page);
  const r = await openAt(page, 0, 0);
  expect(r.covered).toBe(0);
  expect([r.inlineTop, r.inlineBottom], '★안 겹치는데 패널을 옮겼다').toEqual(['', '']);
});

test('P1 [재현→고침] se 손잡이가 기본 패널 자리 안이면 패널이 비켜 어느 손잡이도 안 덮는다', async ({ page }) => {
  await setup(page);
  const d = await defaultRect(page);
  const cx = Math.round((d.left + d.right) / 2), cy = Math.round((d.top + d.bottom) / 2);
  const r = await openAt(page, cx - 300, cy - 200);      // host 300×200 의 se 모서리 = 기본 패널 한가운데
  console.log('  P1:', JSON.stringify({ d, r }));
  expect(r.covered, '★패널이 편집 이미지 손잡이를 덮는다 — 오른아래로 키울 수 없다').toBe(0);
  expect(r.p.top, '패널이 위로 비켜야 한다').toBeLessThan(d.top);
});

test('P2 [사용자 자리 존중] 헤더를 끌어 옮긴 뒤엔 겹쳐도 그 자리 그대로', async ({ page }) => {
  await setup(page);
  const d = await defaultRect(page);
  const hb = await page.locator('#color-adjust-header').boundingBox();
  await page.mouse.move(hb.x + 40, hb.y + hb.height / 2);
  await page.mouse.down();
  await page.mouse.move(hb.x - 160, hb.y - 120, { steps: 4 });
  await page.mouse.up();
  const moved = await page.evaluate(() => { const p = document.getElementById('color-adjust-panel').getBoundingClientRect(); return { left: Math.round(p.left), top: Math.round(p.top) }; });
  expect(moved.top, '전제: 끌기가 안 됐다').toBeLessThan(d.top);
  const r = await openAt(page, moved.left + 20 - 300, moved.top + 40 - 200);   // se 모서리를 옮긴 패널 안에 놓는다
  expect({ left: r.p.left, top: r.p.top }, '★사용자가 옮긴 자리를 덮어썼다').toEqual(moved);
  expect(r.covered, '전제: 이 칸은 «겹쳐도» 그대로인지를 잰다').toBeGreaterThan(0);
});

/* ── D4(발주30 · 수지맥 실앱 발주28 2번) — 손잡이는 «편집 그림» 꼭지에 선다. 옛 판은 host(블럭) 꼭지로 재서
 *   ⒜ 그림이 블럭보다 짧을 때(블럭 위 꼭지가 «위로 비킨 자리»를 덮는다고 보고 되돌림) ⒝ 그림이 커서 위·아래 손잡이가 다 패널 세로줄에 들 때
 *   패널이 안 비키고 se 를 덮었다. ⒞ 꽉 찬 그림(블럭 = 그림)은 옛 판도 맞았다 — 무변 확인.
 *   양성대조: _coveredCount(옛 _coversHandle) 의 `_handleCorners(host)` 를 host 사각형 꼭지로 되돌리면 D4-a·D4-b 빨강 · D4-c 초록. */
const openImg = (page, x, y, hostH, imgTop, imgH) => page.evaluate(([x, y, hostH, imgTop, imgH]) => {
  const host = document.getElementById('adjHost'), img = host.querySelector('img');
  Object.assign(host.style, { left: x + 'px', top: y + 'px', height: hostH + 'px', overflow: 'visible' });
  Object.assign(img.style, { position: 'absolute', left: '0px', top: imgTop + 'px', width: '300px', height: imgH + 'px' });
  window.hideColorAdjustPanel();
  window.showColorAdjustPanel(host);
  const p = document.getElementById('color-adjust-panel').getBoundingClientRect(), r = img.getBoundingClientRect();
  const covered = [[r.left, r.top], [r.right, r.top], [r.left, r.bottom], [r.right, r.bottom]]
    .filter(([cx, cy]) => cx + 4 > p.left && cx - 4 < p.right && cy + 4 > p.top && cy - 4 < p.bottom).length;
  return { p: [p.left, p.top, p.right, p.bottom].map(Math.round), img: [r.left, r.top, r.right, r.bottom].map(Math.round), covered };
}, [x, y, hostH, imgTop, imgH]);

for (const [name, shape] of [
  ['D4-a 짧은 그림(블럭 위 꼭지는 위로 비킨 자리 안 · 그림 se 는 기본 패널 한가운데)', (d, cx, cy) => ({ hostTop: 300, imgTop: cy - 344 - 300, imgH: 344, hostH: (cy + 40) - 300 })],
  ['D4-b 큰 그림(위·아래 손잡이가 다 패널 세로줄 · 그 «사이»가 비어 있다)', (d, cx, cy) => ({ hostTop: 200, imgTop: 0, imgH: cy - 200, hostH: cy - 200 })],
  ['D4-c 꽉 찬 그림(블럭 = 그림 · 옛 판도 맞음)', (d, cx, cy) => ({ hostTop: cy - 200, imgTop: 0, imgH: 200, hostH: 200 })],
]) {
  test(name + ' — 패널이 편집 그림 손잡이를 하나도 안 덮는다', async ({ page }) => {
    await setup(page);
    const d = await defaultRect(page);
    const cx = Math.round((d.left + d.right) / 2), cy = Math.round((d.top + d.bottom) / 2);
    const s = shape(d, cx, cy);
    const r = await openImg(page, cx - 300, s.hostTop, s.hostH, s.imgTop, s.imgH);
    console.log('  ' + name.slice(0, 4) + ':', JSON.stringify({ d, s, r }));
    expect(r.img[3], '전제: 그림 se 가 기본 패널 세로 범위 안').toBeGreaterThan(d.top);
    expect(r.covered, '★패널이 편집 그림 손잡이를 덮는다 — se 를 못 잡는다(D4)').toBe(0);
  });
}

/* ── E1 (IMAGE-EDIT-COLOR-PANEL-COVERS-EDGE-HANDLE-01 · 지디 261116) — 변 손잡이(tc·rc·bc·lc = 꼭지 사이 가운데 · image-handling.js syncHandles)도 손잡이다.
 *   옛 판은 꼭지 넷만 재서, 꼭지는 패널 위·아래로 비켜 있고 «오른쪽 변 가운데(rc)»만 패널 안이면 안 비키고 rc 를 덮었다.
 *   장면: 그림 오른쪽 변 = 기본 패널 가운데 x · 세로는 패널보다 위·아래로 40 씩 길다(꼭지 넷은 패널 밖 · rc 만 안).
 *   양성대조(srv 미실행 · IMAGE-EDGE-CTL.patch): _handleCorners 끝의 변 가운데 넷을 빼고 꼭지만 돌려주면 E1 빨강(rc 덮음 1 · 패널 안 움직임) · P0~D4 초록.
 *   ★D4-b(큰 그림)는 이제 어느 세로 자리든 rc 를 덮는다 — «0 아니면 기본» 이 아니라 «가장 적게 덮는 자리»로 골라 꼭지는 계속 0(D4 칸이 지킨다). */
const allPts = (r) => {
  const k = [[r.left, r.top], [r.right, r.top], [r.left, r.bottom], [r.right, r.bottom]];
  const m = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  return { tl: k[0], tr: k[1], bl: k[2], br: k[3], tc: m(k[0], k[1]), rc: m(k[1], k[3]), bc: m(k[2], k[3]), lc: m(k[0], k[2]) };
};
test('E1 ★오른쪽 변 가운데(rc)만 기본 패널 안 — 패널이 비켜 변·꼭지 손잡이 여덟 다 안 덮는다', async ({ page }) => {
  await setup(page);
  await page.setViewportSize({ width: 1500, height: 1600 });   // 패널 위 «캔버스 위» 후보 자리에 그림이 안 닿을 만큼 키를 준다
  const d = await defaultRect(page);
  const h = d.bottom - d.top, cx = Math.round((d.left + d.right) / 2);
  const r = await page.evaluate(([x, top, H]) => {
    const host = document.getElementById('adjHost'), img = host.querySelector('img');
    Object.assign(host.style, { left: x + 'px', top: top + 'px', width: '300px', height: H + 'px', overflow: '' });
    Object.assign(img.style, { position: '', left: '', top: '', width: '100%', height: '100%' });
    window.hideColorAdjustPanel(); window.showColorAdjustPanel(host);
    const p = document.getElementById('color-adjust-panel').getBoundingClientRect(), ir = img.getBoundingClientRect();
    const areaTop = document.getElementById('canvas-area')?.getBoundingClientRect().top || 0;
    return { p: [p.left, p.top, p.right, p.bottom].map(Math.round), ir: { left: ir.left, top: ir.top, right: ir.right, bottom: ir.bottom }, areaTop };
  }, [cx - 300, d.top - 40, h + 80]);
  const pts = allPts(r.ir), [pl, pt, pr, pb] = r.p;
  const inP = ([x, y], q) => x + 4 > q.left && x - 4 < q.right && y + 4 > q.top && y - 4 < q.bottom;
  const dq = { left: d.left, top: d.top, right: d.right, bottom: d.bottom };
  const coveredDefault = Object.keys(pts).filter((k) => inP(pts[k], dq));
  const covered = Object.keys(pts).filter((k) => inP(pts[k], { left: pl, top: pt, right: pr, bottom: pb }));
  console.log('  E1:', JSON.stringify({ d, r, coveredDefault, covered }));
  expect(coveredDefault, '[전제] 기본 자리에선 rc 하나만 덮인다(꼭지 넷은 패널 밖)').toEqual(['rc']);
  expect(r.ir.top, '[전제] «캔버스 위» 후보 자리(패널 높이)에 그림이 안 닿는다').toBeGreaterThan(r.areaTop + 12 + h + 8);
  expect(covered, '★패널이 변 손잡이를 덮는다 — 오른쪽으로 폭을 못 바꾼다').toEqual([]);
});

/* ── Z (IMAGE-EDIT-PANEL-NOT-REAVOID-ON-ZOOM-01 · 지디 261116) — 편집 «중» 배율·스크롤이 바뀌면 같은 비키기 셈을 다시 부른다.
 *   옛 판은 진입 때만 자리를 정해, 배율을 키워 손잡이가 패널 아래로 들어가도 안 비켰다.
 *   대역: host(fixed)를 «배율이 키운 뒤 자리»로 옮기고 applyZoom 으로 배율 눈금만 바꾼다 — 패널이 보는 것은 손잡이 화면 자리 + 배율·스크롤 표.
 *   Z1 ★편집 중 applyZoom 뒤 → 손잡이 여덟 다 안 덮음(rAF 로 손잡이가 멈출 때까지 다시 잼)
 *   Z2 [음성] 배율·스크롤 무변(그림만 옮김 = 끌기 꼴) → 패널 자리 그대로(끄는 중 튀지 않음)
 *   양성대조(srv 미실행 · IMAGE-ZOOM-CTL.patch): showColorAdjustPanel 의 `_reavoidRaf = requestAnimationFrame(_reavoidTick)` 줄을 빼면 Z1 빨강(rc 덮음) · Z2 초록. */
const raf = (page, n = 3) => page.evaluate((n) => new Promise((r) => { const f = (k) => (k ? requestAnimationFrame(() => f(k - 1)) : r()); f(n); }), n);
const zoomScene = async (page) => {
  await setup(page);
  await page.setViewportSize({ width: 1500, height: 1600 });
  const d = await defaultRect(page);
  const h = d.bottom - d.top, cx = Math.round((d.left + d.right) / 2);
  /* 처음 = 패널과 먼 자리(왼위)에서 연다 · «뒤» = E1 의 rc-만-덮는 자리(그림 오른쪽 변 = 패널 가운데 x · 위아래 40 씩 길게) */
  await page.evaluate(() => {
    const host = document.getElementById('adjHost');
    Object.assign(host.style, { left: '0px', top: '0px', width: '300px', height: '200px' });
    window.applyZoom?.(40); window.hideColorAdjustPanel(); window.showColorAdjustPanel(host);
  });
  await raf(page);
  const before = await page.evaluate(() => { const p = document.getElementById('color-adjust-panel'); return [p.style.top, p.style.bottom]; });
  expect(before, '[전제] 처음엔 안 겹쳐 기본 자리').toEqual(['', '']);
  return { d, h, cx };
};
const moveHost = (page, x, top, H) => page.evaluate(([x, top, H]) => {
  Object.assign(document.getElementById('adjHost').style, { left: x + 'px', top: top + 'px', height: H + 'px' });
}, [x, top, H]);
const coveredNow = (page) => page.evaluate(() => {
  const p = document.getElementById('color-adjust-panel').getBoundingClientRect(), r = document.getElementById('adjHost').querySelector('img').getBoundingClientRect();
  const k = [[r.left, r.top], [r.right, r.top], [r.left, r.bottom], [r.right, r.bottom]];
  const m = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const pts = { tl: k[0], tr: k[1], bl: k[2], br: k[3], tc: m(k[0], k[1]), rc: m(k[1], k[3]), bc: m(k[2], k[3]), lc: m(k[0], k[2]) };
  return Object.keys(pts).filter((n) => { const [x, y] = pts[n]; return x + 4 > p.left && x - 4 < p.right && y + 4 > p.top && y - 4 < p.bottom; });
});

test('Z1 ★편집 중 배율을 바꾸면 패널이 다시 비켜 손잡이 여덟 다 안 덮는다', async ({ page }) => {
  const { d, h, cx } = await zoomScene(page);
  await moveHost(page, cx - 300, d.top - 40, h + 80);
  await page.evaluate(() => window.applyZoom(55));
  await expect.poll(() => coveredNow(page), '★배율 뒤 패널이 손잡이를 덮는다 — 다시 안 비켰다').toEqual([]);
});

test('Z2 [음성] 배율·스크롤 무변(그림만 옮김) — 패널은 그 자리 그대로', async ({ page }) => {
  const { d, h, cx } = await zoomScene(page);
  await moveHost(page, cx - 300, d.top - 40, h + 80);
  await raf(page, 10);
  const r = await page.evaluate(() => { const p = document.getElementById('color-adjust-panel'); return [p.style.top, p.style.bottom]; });
  expect(r, '배율·스크롤이 안 바뀌었는데 패널이 움직였다(끄는 중 튐)').toEqual(['', '']);
  expect(await coveredNow(page), '[전제] 이 칸은 «덮였는데도» 그대로인지를 잰다').toEqual(['rc']);
});

/* ── Z3 (지디 261116 실앱 ❌ 재발주) — c1d291a02 의 «한 프레임 안 바뀜 = 정착» 은 #canvas-scaler transform 보간(.15s)의 첫 두 프레임이
 *   같은 값이라 보간 «전에» 끝났다(경합 · Z1 은 fixed 대역이라 보간이 없어 못 잡았다).
 *   여기선 그림을 «캔버스 안»(#canvas-scaler 아래)에 둬 진짜 보간을 그대로 탄다 — [전제] transition-duration 0.15s 실값.
 *   단계(지디 실앱 순서): 40→55→65→80→100 → (100 에서 스크롤만 +300 · 보간 없음) → 80→55. 단계마다 «정착»(scaler 애니메이션 0 + 그림 rect 8 프레임 무변)
 *   직후 패널 top/bottom 이 «그 자리에서 새로 연 셈»(hide→show = 진입 비키기)과 정확히 같아야 한다.
 *   양성대조(IMAGE-ZOOM2-CTL.patch = c1d291a02 의 _reavoidTick 으로 되돌림): 어느 단계에서 패널이 보간 중 자리에 남아 Z3 빨강 · Z1·Z2 초록. */
test('Z3 ★실제 보간(.15s) 그대로 — 배율·스크롤 단계마다 정착 직후 자리 = 새로 연 셈', async ({ page }) => {
  test.setTimeout(120000);
  await setup(page);
  await page.setViewportSize({ width: 1500, height: 1100 });
  const pre = await page.evaluate((PNG1) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    c.insertAdjacentHTML('beforeend', `<div class="section-block" id="zS" data-section="1"><div class="section-hitzone"></div><div class="section-inner">
      <div class="row" data-layout="stack"><div class="asset-block has-image" id="zA" style="width:780px;height:1400px"><div class="asset-img-clip">
      <img class="asset-img" src="${PNG1}" style="width:100%;height:100%;object-fit:cover"></div></div></div></div></div>`);
    window.rebindAll?.(); window.applyZoom(40);
    window.hideColorAdjustPanel(); window.showColorAdjustPanel(document.getElementById('zA'));
    return { dur: getComputedStyle(document.getElementById('canvas-scaler')).transitionDuration, img: !!document.querySelector('#zA .asset-img') };
  }, PNG1);
  expect(pre, '[전제] 보간 실값 0.15s · 그림 있음').toEqual({ dur: '0.15s', img: true });

  /* 정착 — scaler 애니메이션 0 이고 그림 rect 가 8 프레임 연속 같을 때까지 rAF 로 잰다(고정 대기 아님) */
  const settle = () => page.evaluate(() => new Promise((res) => {
    const sc = document.getElementById('canvas-scaler'), im = document.querySelector('#zA .asset-img');
    let last = '', same = 0;
    const f = () => {
      const r = im.getBoundingClientRect(), k = [r.left, r.top, r.width, r.height].map(Math.round).join(',');
      same = (k === last && sc.getAnimations().length === 0) ? same + 1 : 0; last = k;
      if (same >= 8) res(); else requestAnimationFrame(f);
    };
    requestAnimationFrame(f);
  }));
  /* 지금 패널 자리 · 기본 자리에서 덮는 수 · «새로 연 셈» 자리 */
  const judge = () => page.evaluate(() => {
    const panel = document.getElementById('color-adjust-panel'), host = document.getElementById('zA');
    const cnt = () => {
      const p = panel.getBoundingClientRect(), r = host.querySelector('.asset-img').getBoundingClientRect();
      const k = [[r.left, r.top], [r.right, r.top], [r.left, r.bottom], [r.right, r.bottom]], m = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      return [...k, m(k[0], k[1]), m(k[1], k[3]), m(k[2], k[3]), m(k[0], k[2])]
        .filter(([x, y]) => x + 4 > p.left && x - 4 < p.right && y + 4 > p.top && y - 4 < p.bottom).length;
    };
    const now = { top: panel.style.top, bottom: panel.style.bottom, covered: cnt() };
    const keep = [panel.style.top, panel.style.bottom];
    panel.style.top = ''; panel.style.bottom = ''; const defCov = cnt(); [panel.style.top, panel.style.bottom] = keep;
    window.hideColorAdjustPanel(); window.showColorAdjustPanel(host);   // 같은 자리에서 진입 비키기 = 기준
    return { now, fresh: { top: panel.style.top, bottom: panel.style.bottom, covered: cnt() }, defCov, zoom: window.currentZoom, scroll: document.getElementById('canvas-wrap').scrollTop };
  });

  await settle();
  const log = [];
  const steps = [['zoom', 55], ['zoom', 65], ['zoom', 80], ['zoom', 100], ['scroll', 300], ['zoom', 80], ['zoom', 55]];
  for (const [kind, v] of steps) {
    const s0 = await page.evaluate(() => document.getElementById('canvas-wrap').scrollTop);
    if (kind === 'zoom') await page.evaluate((z) => window.applyZoom(z), v);
    else await page.evaluate((dy) => { document.getElementById('canvas-wrap').scrollTop += dy; }, v);
    await settle();
    const j = await judge();
    log.push({ kind, v, s0, ...j });
    await settle();   // judge 의 hide→show 뒤 — 다음 단계는 정착한 자리에서 시작
  }
  console.log('  Z3:', JSON.stringify(log));
  expect(log.find((l) => l.kind === 'scroll').scroll, '[전제] 스크롤 단계가 실제로 스크롤했다').not.toBe(log.find((l) => l.kind === 'scroll').s0);
  expect(log.some((l) => l.defCov > 0), '[전제] 기본 자리가 손잡이를 덮는 단계가 하나 이상(비키기가 실제로 일한다)').toBe(true);
  for (const l of log) {
    expect({ top: l.now.top, bottom: l.now.bottom }, `★${l.kind} ${l.v}: 정착 직후 자리 ≠ 새로 연 셈 ${JSON.stringify(l)}`).toEqual({ top: l.fresh.top, bottom: l.fresh.bottom });
  }
});
