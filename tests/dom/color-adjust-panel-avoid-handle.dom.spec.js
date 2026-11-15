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
