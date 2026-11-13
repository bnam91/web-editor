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
