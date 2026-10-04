/* e95-scratch-drop-undo.dom.spec.js — E95(U11) 짝: 스크래치 카드를 그리드 칸에 놓은 뒤 ⌘Z 가 카드를 «끌기 시작 자리»로 되살리나.
 * 결함(772ccadc): scratch-pad.js 변환 갈래의 restoreInfo 가 onMove 로 바뀐 item.x/y(놓은 자리)를 떠서 ⌘Z 가 카드를 놓은 자리(그리드 위)에 되살렸다.
 * 단언:
 *   전제 — 끌기 시작 맞힌 요소 = scratch-item · 놓는 곳 맞힌 요소 = grd-line · 놓기 전 아밍 가이드 보임 · 놓은 뒤 카드 사라짐 · 캔버스 에셋 +1
 *   ⚠️재기·끌기 시작은 «화면이 멈춘 뒤»(줌 전환 중엔 카드가 파일 패널 밑 — integ17 실측) — settle() 상태 대기.
 *   ⚠️놓기는 «아밍 가이드가 뜬 뒤» — 고정 대기(250+150ms)는 배치 따라 아밍 전에 놓아 전제 빨강이 났다(2026-10-05 실측 [661,107] 5/5 미변환).
 *   ★본 단언 — ⌘Z 뒤 카드 자리 = 원래 자리(left −320px · top 40px) — 값으로
 *   본 단언은 끌기 «전» 실측 c0 과 견준다 — 박은 수가 아니다(장면이 −320/40 인지는 :31 전제가 따로 단언).
 *   덮음 — ⌘Z 뒤 놓은 점의 맨 위 요소 ≠ 카드
 *   지킴 — ⌘⇧Z 뒤 카드가 다시 사라진다 · 「E95 restore fallback」 경고 0
 * 양성대조: GD1001_ROOT=<git archive 772ccadc 사본> → 본 단언만 빨강. */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const { hitAt } = require('./_click-at.js');

const CARD = 'sp_e95';
const card = (page) => page.evaluate((id) => { const e = document.querySelector(`.scratch-item[data-scratch-id="${id}"]`); if (!e) return null; const q = e.getBoundingClientRect(); return { left: e.style.left, top: e.style.top, cx: q.left + q.width / 2, cy: q.top + q.height / 2 }; }, CARD);

test('E95 스크래치 카드 → 그리드 칸 놓기 → ⌘Z = 카드가 끌기 시작 자리로 · 놓은 자리를 안 덮음 · ⌘⇧Z 다시 사라짐', async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 1200 });
  const warns = []; page.on('console', m => { if (m.type() === 'warning' && /E95 restore fallback/.test(m.text())) warns.push(m.text()); });
  await bootApp(page);
  const gid = await page.evaluate(() => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', `<div class="section-block" id="sE95" data-section="1"><div class="section-hitzone"></div><div class="section-inner"><div class="gap-block" data-type="gap" style="height:40px"></div><div class="row" id="rE95" data-layout="stack"></div><div class="gap-block" data-type="gap" style="height:200px"></div></div></div>`);
    const { block: g } = window.makeGridBlock({ cols: [{ width: 1, lines: [{ type: 'body', text: '칸 A' }] }, { width: 1, lines: [{ type: 'body', text: '칸 B' }] }] });
    document.getElementById('rE95').appendChild(g); window.rebindAll?.(); window.renderGridBlock(g); window.deselectAll?.(); window.applyZoom?.(50); return g.id;
  });
  const src = await page.evaluate(() => { const cv = document.createElement('canvas'); cv.width = 240; cv.height = 140; const x = cv.getContext('2d'); x.fillStyle = '#3a86ff'; x.fillRect(0, 0, 240, 140); return cv.toDataURL('image/png'); });
  await page.evaluate(async ([src, id]) => { await window._scratchAddAndSaveFx(src, -320, 40, 200, undefined, id, undefined); }, [src, CARD]);
  await page.waitForFunction((id) => { const im = document.querySelector(`.scratch-item[data-scratch-id="${id}"] img`); return im && im.complete && im.naturalWidth > 0; }, CARD, { timeout: 10000 });
  await page.evaluate(() => window.clearHistory?.());
  const c0 = await card(page);
  expect([c0.left, c0.top], '전제 — 카드 시작 자리').toEqual(['-320px', '40px']);
  const assets0 = await page.evaluate(() => document.querySelectorAll('#canvas .asset-block').length);
  /* ★잴 때는 화면이 «멈춘» 뒤 — applyZoom(50) 전환이 도는 중에 재면 카드가 줌 100 쪽 자리(왼쪽 파일 패널 밑)에 있다
     (integ17 01a49b86 전제 빨강: 맞힌 요소 = page-section-header · 2026-10-05 실측 t0 scaler 폭 352~374 → t600 430).
     상태 조건: 스케일러·카드·칸 rect 가 100ms 간격 두 번 연속 같고, 두 번 다 카드 중심의 맨 위 요소 = 그 카드. */
  const settle = (label) => page.evaluate(() => { window.__e95settle = null; }).then(() => page.waitForFunction(([id, gid]) => {
    const r = (e) => { const q = e.getBoundingClientRect(); return [q.left, q.top, q.width, q.height].map(Math.round).join(','); };
    const cd = document.querySelector(`.scratch-item[data-scratch-id="${id}"]`), cl = document.querySelector(`#${gid} .grd-cell`);
    const q = cd.getBoundingClientRect(), top = document.elementFromPoint(q.left + q.width / 2, q.top + q.height / 2);
    const ok = !!(top && top.closest(`.scratch-item[data-scratch-id="${id}"]`));
    const key = ok ? [r(document.getElementById('canvas-scaler')), r(cd), r(cl)].join('|') : null;
    const prev = window.__e95settle; window.__e95settle = key; return !!key && key === prev;
  }, [CARD, gid], { polling: 100, timeout: 10000 })).catch(async () => { throw new Error(`전제 — ${label}: 화면이 멈추고 카드 중심 맨 위 = 카드(두 번 연속) 10초 안에 안 됨 · 마지막 카드 ${JSON.stringify(await card(page))}`); });
  await settle('줌 전환 뒤');
  await page.evaluate((gid) => document.querySelector(`#${gid} .grd-cell`).scrollIntoView({ block: 'nearest' }), gid);
  await settle('칸 scrollIntoView 뒤');
  const drop = await page.evaluate((gid) => { const q = document.querySelector(`#${gid} .grd-cell`).getBoundingClientRect(); return [Math.round(q.left + q.width / 2), Math.round(q.top + q.height / 2)]; }, gid);
  const c1 = await card(page);
  const hs = await hitAt(page, c1.cx, c1.cy), hd = await hitAt(page, drop[0], drop[1]);
  expect(hs && /scratch-item/.test(hs.cls) || (hs && hs.tag === 'IMG'), `전제 — 끌기 시작 맞힌 요소 = scratch-item (${JSON.stringify(hs)})`).toBeTruthy();
  expect(hd && /grd-line/.test(hd.cls), `전제 — 놓는 곳 맞힌 요소 = grd-line (${JSON.stringify(hd)})`).toBeTruthy();
  // 끌기 — 진짜 마우스(스크래치 끌기는 mousemove 기반)
  await page.mouse.move(c1.cx, c1.cy); await page.mouse.down();
  await page.mouse.move(c1.cx + 20, c1.cy + 10, { steps: 4 }); await page.mouse.move(drop[0], drop[1], { steps: 20 });
  await page.mouse.move(drop[0] + 2, drop[1] + 1, { steps: 2 });
  await expect(page.locator('.sp2c-insert-indicator'), '전제 — 놓기 전 아밍 가이드(같은 타깃 250ms 체류) 보임 — 고정 대기 대신 상태 대기').toBeVisible({ timeout: 5000 });
  await page.mouse.up();
  await page.waitForFunction(([id, n0]) => !document.querySelector(`.scratch-item[data-scratch-id="${id}"]`) && document.querySelectorAll('#canvas .asset-block').length === n0 + 1, [CARD, assets0], { timeout: 5000 })
    .catch(() => {});
  const dropped = { card: await card(page), assets: await page.evaluate(() => document.querySelectorAll('#canvas .asset-block').length) };
  expect(dropped.card, '전제 — 놓은 뒤 카드가 보드에서 사라짐').toBeNull();
  expect(dropped.assets, `전제 — 캔버스 에셋 +1 (${assets0}→${dropped.assets})`).toBe(assets0 + 1);
  // ⌘Z
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Meta+z');
  await page.waitForFunction((id) => !!document.querySelector(`.scratch-item[data-scratch-id="${id}"]`), CARD, { timeout: 5000 });
  await page.waitForTimeout(200);
  const back = await card(page);
  expect([back.left, back.top], `★⌘Z 뒤 카드 자리 = 끌기 전에 잰 자리 left=${c0.left} top=${c0.top} · ⌘Z 뒤 잰 자리 left=${back.left} top=${back.top}`).toEqual([c0.left, c0.top]);
  const topAtDrop = await page.evaluate(([x, y, id]) => { const e = document.elementFromPoint(x, y); return { isCard: !!(e && e.closest(`.scratch-item[data-scratch-id="${id}"]`)), cls: e ? (e.className || e.tagName).toString().slice(0, 40) : null }; }, [drop[0], drop[1], CARD]);
  expect(topAtDrop.isCard, `⌘Z 뒤 놓은 점의 맨 위 요소가 카드가 아니다 (${topAtDrop.cls})`).toBe(false);
  // ⌘⇧Z
  await page.keyboard.press('Meta+Shift+z');
  await page.waitForFunction((id) => !document.querySelector(`.scratch-item[data-scratch-id="${id}"]`), CARD, { timeout: 5000 });
  expect(await card(page), '⌘⇧Z 뒤 카드가 다시 사라짐').toBeNull();
  expect(warns, '「E95 restore fallback」 경고 0').toEqual([]);
});
