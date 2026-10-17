/* annotation-1017t1h1 — 어노테이션 8방향(0/45/90/135/180/225/270/315) ±6° 자석 (현빈 확정).
 *
 * ★무엇을 잠그나
 *   SN1 그리는 중(⒜) 44°(=45−1, ±6° 안) 방향 둘째 점 → 선 각도가 45.0±0.1 (배율 40%·100% 둘 다)
 *   SN2 점 손잡이 끌기(⒝) 도 같은 규칙 — 44° 자리로 끌면 45.0±0.1
 *   SN3(음성) 20° 방향(±6° 밖) → 20±0.5 로 남고 45 가 아니다 — 자석의 «선»을 잠근다
 *   SN4(음성·계측기 자가검사) _snapVecToStep 를 항등함수로 덮으면 SN1 이 빨개진다(초록이 「없어서」가 아님을 증명)
 *   SN5 그리는 중 각도 라벨이 보인다(/^\d+(\.\d)?°$/) · 끝나면(mouseup/확정) 0개
 * ★SN1·SN2 가 ★한 파일에 있다 — 한쪽만 고치면 반쪽 패치가 빨갛게 드러난다.
 * ★만드는 길은 «사람 손» 그대로 — 펜 단추 → 메뉴 「Annotation」 → 섹션 두 점.
 * ⛔waitForTimeout 금지 — expect.poll/waitForFunction 만.
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');
const { clickAt } = require('./_click-at.js');

const SEC = '[id="secA"]';

async function setup(page) {
  await page.evaluate(() => {
    const canvas = document.getElementById('canvas');
    canvas.innerHTML = '<div class="section-block" id="secA" style="position:relative;height:420px;background:#f4f4f6"><div class="section-inner"></div></div>';
    window.rebindAll?.();
    window.applyPagePadX?.(window.state?.pageSettings?.padX);
    window.buildLayerPanel?.();
  });
}

const annotCount = (page) => page.evaluate(() => document.querySelectorAll('#secA .annotation-block').length);

/* 섹션-space 각도(°, atan2 기준 0..360)로 둘째 점을 놓는다. 길이 L(모델 단위) · zoom 은 클릭 좌표 환산에만 쓴다. */
async function drawAtAngle(page, { angleDeg, len = 60, shift = false }) {
  const before = await annotCount(page);
  await page.click('#fp-pen-btn');
  await page.click('#fp-pen-menu .fp-menu-item:text-is("Annotation")');
  await expect.poll(() => page.evaluate(() => document.body.classList.contains('pen-mode')), '★전제: 펜 모드가 켜졌다').toBe(true);
  const r = await waitStableRect(page, SEC);
  const zoom = await page.evaluate(() => (window.currentZoom || 40) / 100);
  const x1 = r.left + r.width * 0.3, y1 = r.top + r.height * 0.3;
  await clickAt(page, x1, y1, { sel: SEC }, { label: '첫 점' });
  const rad = angleDeg * Math.PI / 180;
  const x2 = x1 + Math.cos(rad) * len * zoom;
  const y2 = y1 + Math.sin(rad) * len * zoom;
  if (shift) await page.keyboard.down('Shift');
  await clickAt(page, x2, y2, { sel: SEC }, { label: '둘째 점' });
  if (shift) await page.keyboard.up('Shift');
  await page.keyboard.press('Enter');
  await expect.poll(() => annotCount(page), 'Enter 로 어노테이션 하나가 생겼다').toBe(before + 1);
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => document.body.classList.contains('pen-mode')), 'Esc 로 펜 모드 종료').toBe(false);
  return page.evaluate(() => { const all = document.querySelectorAll('#secA .annotation-block'); return all[all.length - 1].id; });
}

/* 만든 선의 두 점 사이 각(°, 0..360). */
const lineAngle = (page, id) => page.evaluate((id) => {
  const pts = JSON.parse(document.getElementById(id).dataset.points);
  const [a, b] = [pts[0], pts[pts.length - 1]];
  const deg = Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI;
  return ((deg % 360) + 360) % 360;
}, id);

for (const zoom of [40, 100]) {
  test(`SN1 그리는 중 44° → 45.0±0.1 로 붙는다 (zoom ${zoom}%)`, async ({ page }) => {
    await bootApp(page);
    await page.evaluate((z) => window.applyZoom(z), zoom);
    await expect.poll(() => page.evaluate(() => window.currentZoom), '★전제: 배율이 실제로 그 값이다').toBe(zoom);
    await setup(page);
    expect(await page.evaluate(() => typeof window._snapVecToStep), '★전제: 공용 스냅 함수가 있다').toBe('function');
    expect(await page.evaluate(() => window._ROTATE_SNAP_STEP), '★전제: 스냅 수 45').toBe(45);
    const id = await drawAtAngle(page, { angleDeg: 44 });
    const deg = await lineAngle(page, id);
    expect(Math.abs(deg - 45) <= 0.1, `44° 는 ±6° 안 → 45.0±0.1 (실측 ${deg})`).toBe(true);
  });
}

test('SN2 점 손잡이를 44° 자리로 끌어도 같은 규칙 — 45.0±0.1', async ({ page }) => {
  await bootApp(page);
  await setup(page);
  const id = await drawAtAngle(page, { angleDeg: 10 });   // 임의 시작 모양(이후 손잡이로 다시 각을 만든다)
  // 선택 → 핸들 노출
  const sel = `[id="${id}"] .annot-label`;
  const lr = await waitStableRect(page, sel);
  await clickAt(page, lr.cx, lr.cy, { sel }, { label: '라벨(선택)' });
  await expect.poll(() => page.evaluate((id) => document.getElementById(id).querySelectorAll('.annot-handle').length, id), '★전제: 핸들 2개').toBe(2);

  const r = await waitStableRect(page, SEC);
  const zoom = await page.evaluate(() => (window.currentZoom || 40) / 100);
  const p0 = await page.evaluate((id) => JSON.parse(document.getElementById(id).dataset.points)[0], id);
  const h1 = await page.evaluate((id) => {
    const h = document.querySelector(`[id="${id}"] .annot-handle[data-point-idx="1"]`);
    const rr = h.getBoundingClientRect();
    return { cx: rr.left + rr.width / 2, cy: rr.top + rr.height / 2 };
  }, id);

  const len = 60, angleDeg = 44;
  const rad = angleDeg * Math.PI / 180;
  const targetX = r.left + (p0[0] + Math.cos(rad) * len) * zoom;
  const targetY = r.top + (p0[1] + Math.sin(rad) * len) * zoom;

  await page.mouse.move(h1.cx, h1.cy);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) {
    await page.mouse.move(h1.cx + (targetX - h1.cx) * i / 8, h1.cy + (targetY - h1.cy) * i / 8);
  }
  await page.mouse.up();

  const deg = await lineAngle(page, id);
  expect(Math.abs(deg - 45) <= 0.1, `점 손잡이로 44° 자리에 놓아도 45.0±0.1 (실측 ${deg})`).toBe(true);
});

test('SN3(음성) 20°(±6° 밖) 방향 → 20±0.5 로 남고 45 가 아니다', async ({ page }) => {
  await bootApp(page);
  await setup(page);
  const id = await drawAtAngle(page, { angleDeg: 20 });
  const deg = await lineAngle(page, id);
  expect(Math.abs(deg - 20) <= 0.5, `20° 는 ±6° 밖 → 안 붙고 20±0.5 로 남는다 (실측 ${deg})`).toBe(true);
  expect(Math.abs(deg - 45) > 1, '45 로 붙으면 안 된다').toBe(true);
});

test('SN4(음성·계측기 자가검사) _snapVecToStep 를 항등함수로 덮으면 44° 가 더는 안 붙는다', async ({ page }) => {
  await bootApp(page);
  await setup(page);
  await page.evaluate(() => { window.__origSnap = window._snapVecToStep; window._snapVecToStep = (p) => p; });
  const id = await drawAtAngle(page, { angleDeg: 44 });
  const deg = await lineAngle(page, id);
  expect(Math.abs(deg - 45) > 1, `계측기를 무력화하면 44°→45 로 안 붙는다(실측 ${deg}) — SN1 초록이 「없어서」가 아님을 증명`).toBe(true);
  await page.evaluate(() => { window._snapVecToStep = window.__origSnap; });
});

test('SN5 그리는 중 각도 라벨이 보이고, 끝나면 0개', async ({ page }) => {
  await bootApp(page);
  await setup(page);
  await page.click('#fp-pen-btn');
  await page.click('#fp-pen-menu .fp-menu-item:text-is("Annotation")');
  await expect.poll(() => page.evaluate(() => document.body.classList.contains('pen-mode'))).toBe(true);
  const r = await waitStableRect(page, SEC);
  await clickAt(page, r.left + r.width * 0.3, r.top + r.height * 0.3, { sel: SEC }, { label: '첫 점' });
  await page.mouse.move(r.left + r.width * 0.3 + 40, r.top + r.height * 0.3 + 10);
  await expect.poll(() => page.evaluate(() => {
    const t = document.querySelector('.annot-preview-angle');
    return t && t.style.display !== 'none' ? t.textContent : null;
  }), '끄는 중 각도 라벨이 보인다').toMatch(/^\d+(\.\d)?°$/);
  // 확정(Enter) → 미리보기 SVG 자체가 제거되므로 라벨도 0개
  await page.keyboard.press('Enter');
  await page.keyboard.press('Escape');
  const left = await page.evaluate(() => document.querySelectorAll('.annot-preview-angle').length);
  expect(left, '확정 뒤 각도 라벨 0개').toBe(0);
});
