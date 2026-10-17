/* annotation-1017t1h1 — 어노테이션 8방향(0/45/90/135/180/225/270/315) ±6° 자석 (현빈 확정).
 *
 * ★무엇을 잠그나
 *   SN1 그리는 중(⒜) 40°(±6° 안) 방향 둘째 점 → 선 각도가 45.0±0.2 (배율 40%·100% 둘 다)
 *   SN2 점 손잡이 끌기(⒝) 도 같은 규칙 — 40° 자리로 끌면 45.0±0.2
 *   SN3(음성) 20° 방향(±6° 밖) → 20 근방으로 남고 45 가 아니다 — 자석의 «선»을 잠근다
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

/* 섹션-space 각도(°, atan2 기준 0..360)로 둘째 점을 놓는다. 길이 L(모델 단위) · zoom 은 클릭 좌표 환산에만 쓴다.
   ★len=300(기본) — ★★화면 px 는 «정수»로 반올림된다(Playwright 클릭 좌표). 짧은 길이(예 60)에서는
   그 반올림이 각도를 몇 도씩 흔들어 ★배율에 따라 «우연히 정확히 45」가 나오거나 자석과 무관하게
   어긋나는 거짓 결과를 만든다(2026-10-18 실측: len60·44°·zoom40% → dx,dy 반올림이 우연히 같아져
   스냅 없이도 정확히 45가 나왔다). 길이를 키우면 반올림 오차(최대 ±0.5px)의 «비중»이 작아진다. */
async function drawAtAngle(page, { angleDeg, len = 300, shift = false }) {
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
  // ★전제 — 라벨 편집(contenteditable+focus)이 실제로 들어선 «뒤»에 Escape를 눌러야 한다.
  //   안 그러면(annotation-1013.dom.spec.js makeAnnotation 과 같은 교훈) Escape 가 펜모드 종료와
  //   경합해 라벨이 contenteditable=true 로 남고, 그 뒤 라벨 클릭이 «섹션 클릭»으로 버블돼
  //   섹션이 선택되며 어노테이션 선택이 풀린다(2026-10-18 실측 — save-load.js:1179 섹션 클릭 핸들러).
  await expect.poll(() => page.evaluate(() => document.activeElement?.classList?.contains('annot-label')), '생성 직후 라벨 편집에 들어갔다').toBe(true);
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
  test(`SN1 그리는 중 40° → 45.0±0.2 로 붙는다 (zoom ${zoom}%)`, async ({ page }) => {
    await bootApp(page);
    await page.evaluate((z) => window.applyZoom(z), zoom);
    await expect.poll(() => page.evaluate(() => window.currentZoom), '★전제: 배율이 실제로 그 값이다').toBe(zoom);
    await setup(page);
    expect(await page.evaluate(() => typeof window._snapVecToStep), '★전제: 공용 스냅 함수가 있다').toBe('function');
    expect(await page.evaluate(() => window._ROTATE_SNAP_STEP), '★전제: 스냅 수 45').toBe(45);
    const id = await drawAtAngle(page, { angleDeg: 40 });
    const deg = await lineAngle(page, id);
    expect(Math.abs(deg - 45) <= 0.2, `40° 는 ±6° 안 → 45.0±0.2 (실측 ${deg})`).toBe(true);
  });
}

test('SN2 점 손잡이를 40° 자리로 끌어도 같은 규칙 — 45.0±0.2', async ({ page }) => {
  await bootApp(page);
  // ★100% — 손잡이 반지름이 모델 5px(화면에서도 5px)이라 40% 에서는 클릭 히트박스가 2px 로 너무 작다.
  await page.evaluate(() => window.applyZoom(100));
  await expect.poll(() => page.evaluate(() => window.currentZoom)).toBe(100);
  await setup(page);
  const id = await drawAtAngle(page, { angleDeg: 10 });   // 임의 시작 모양(이후 손잡이로 다시 각을 만든다)
  // 선택 → 핸들 노출
  const sel = `[id="${id}"] .annot-label`;
  const lr = await waitStableRect(page, sel);
  await clickAt(page, lr.cx, lr.cy, { sel }, { label: '라벨(선택)' });
  await expect.poll(() => page.evaluate((id) => document.getElementById(id).querySelectorAll('.annot-handle').length, id), '★전제: 핸들 2개').toBe(2);

  const r = await waitStableRect(page, SEC);
  const zoom = await page.evaluate(() => (window.currentZoom || 40) / 100);
  // ★점1(마지막 점) 자리엔 라벨 div 가 위에 깔려 그 핸들을 가린다(라벨은 마지막 점에 부착) —
  //   실제 클릭은 라벨을 맞혀 「전체 이동」드래그로 빠진다(2026-10-18 실측). ⇒ ★점0(앵커) 핸들을 끈다 —
  //   거기는 안 가려진다. ref = 점1(안 움직이는 쪽).
  const h0 = await page.evaluate((id) => {
    const h = document.querySelector(`[id="${id}"] .annot-handle[data-point-idx="0"]`);
    const rr = h.getBoundingClientRect();
    return { cx: rr.left + rr.width / 2, cy: rr.top + rr.height / 2 };
  }, id);
  const p1 = await page.evaluate((id) => JSON.parse(document.getElementById(id).dataset.points)[1], id);

  const len = 300, angleDeg = 40;
  const rad = angleDeg * Math.PI / 180;
  // 점0을 「점1 + len·(cosθ,sinθ)」 자리로 끈다 — 점0→점1 방향(끄는 핸들 기준 ref=점1)이 θ에 가깝다.
  const targetX = r.left + (p1[0] + Math.cos(rad) * len) * zoom;
  const targetY = r.top + (p1[1] + Math.sin(rad) * len) * zoom;

  const hitH0 = await page.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return e ? (e.className?.baseVal ?? e.className ?? e.tagName) : null; }, [h0.cx, h0.cy]);
  expect(String(hitH0), `★전제: 점0 핸들 좌표가 실제로 그 핸들을 맞힌다(실측 ${hitH0})`).toContain('annot-handle');

  await page.mouse.move(h0.cx, h0.cy);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) {
    await page.mouse.move(h0.cx + (targetX - h0.cx) * i / 8, h0.cy + (targetY - h0.cy) * i / 8);
  }
  await page.mouse.up();

  const deg = await lineAngle(page, id);
  // ★점0 을 끌었으므로 lineAngle(점0→점1) 은 우리가 놓은 방향(점1→점0, θ=40°)의 «반대»다(+180).
  //   같은 직선이므로 mod180 으로 견준다(45 와 225 는 같은 선).
  const mod = deg % 180;
  expect(Math.abs(mod - 45) <= 0.2, `점 손잡이로 40° 자리에 놓아도 45.0±0.2 (한 직선 mod180, 실측 ${deg}→mod180=${mod})`).toBe(true);
});

test('SN3(음성) 20°(±6° 밖) 방향 → 20 근방으로 남고 45 가 아니다', async ({ page }) => {
  await bootApp(page);
  await setup(page);
  const id = await drawAtAngle(page, { angleDeg: 20 });
  const deg = await lineAngle(page, id);
  expect(Math.abs(deg - 20) <= 1, `20° 는 ±6° 밖 → 안 붙고 20 근방으로 남는다 (실측 ${deg})`).toBe(true);
  expect(Math.abs(deg - 45) > 1, '45 로 붙으면 안 된다').toBe(true);
});

test('SN4(음성·계측기 자가검사) _snapVecToStep 를 항등함수로 덮으면 40° 가 더는 안 붙는다', async ({ page }) => {
  await bootApp(page);
  await setup(page);
  await page.evaluate(() => { window.__origSnap = window._snapVecToStep; window._snapVecToStep = (p) => p; });
  const id = await drawAtAngle(page, { angleDeg: 40 });
  const deg = await lineAngle(page, id);
  expect(Math.abs(deg - 45) > 1, `계측기를 무력화하면 40°→45 로 안 붙는다(실측 ${deg}) — SN1 초록이 「없어서」가 아님을 증명`).toBe(true);
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
