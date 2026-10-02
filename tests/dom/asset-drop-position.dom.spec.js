/* asset-drop-position.dom.spec.js — 현빈 2026-10-02 「특정 위치로 드래그했는데 놓을 때 보이는 곳이 아닌 다른 곳에 놓여서
 *   캔버스 배율을 조절해서 찾아야 된다」 + 결정 ⓒ(섹션 안 = 섹션에 · 섹션 밖 = 스크래치패드 그 자리).
 * 노트패널(자산 패널) 바둑판 카드를 «진짜 마우스»로 끌어 놓는다(헤드리스 Chromium 의 HTML5 네이티브 끌기).
 * 옛 판 실측(이 꼴 그대로): 놓은 점→스크래치 중심 40% 바닥(+48,−4)·섹션(−103,−107) / 100% (0,+50) — ÷배율 없음 + 세로 중심 60.
 * ★배율 시험은 «그 배율이 정말 걸렸나»를 첫 단언으로 둔다(지디 조건 — A1 Q7 이 0.5·2 를 넘겨 10% 에서 돌던 거짓 초록의 교훈).
 * ★대조(같은 판, 조건만 바꿈): D1(섹션 밖) vs D2(섹션 안) — 같은 끌기가 놓은 자리에 따라 스크래치/에셋으로 «갈린다».
 *   + 변이 사본(옛 식: ÷배율 없음·−60)에서 D1 이 빨강(커밋 본문에 결과).
 * ★양성대조 판 7699ea33: D1@40·200 · D2 · D4(에셋 0) 빨강 / D1@100 도 빨강(+50) — 결함 자체가 핀에 있다(강한 빨강).
 * ✔ 2026-10-02 현빈 실기 확인 — 사람 손 끌기로 놓은 자리에 들어감(고친 판 dev bb5eb3a5 이후). 옛 줄: ~~「미측정: 실앱 네이티브 끌기 순서」~~
 *   섹션 안인데 «넣을 자리 아님»(→스크래치+토스트) 갈래 — 자연 발생 자리를 못 찾음(섹션 안 18점 실측 전부 insert). */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const SEC = (id, h) => `<div class="section-block" id="${id}" data-section="1" data-name="${id}"><div class="section-hitzone"></div><div class="section-inner">
  <div class="gap-block" data-type="gap" style="height:${h}px"></div><div class="row" id="r_${id}"><div class="text-block" data-type="body" id="t_${id}"><div class="tb-body">${id} 글</div></div></div>
  <div class="gap-block" data-type="gap" style="height:${h}px"></div></div></div>`;

async function setup(page, zoom) {
  await page.setViewportSize({ width: 1600, height: 1000 });
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await bootApp(page);
  await page.evaluate(([px, html, z]) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', html); window.rebindAll?.(); window.deselectAll?.();
    if (z) window.applyZoom?.(z);
    window.state.assetsTree = [{ id: 'f_note', type: 'folder', name: '노트패널', viewMode: 'grid', collapsed: false, locked: true, children: [{ id: 'img_n1', type: 'image', name: '메모', src: px }] }];
    window.switchToTab?.('assets'); window.buildAssetsPanel?.();
  }, [PX, SEC('sA', 150) + SEC('sB', 150) + SEC('sC', 150), zoom]);
  await page.waitForTimeout(400);
  /* 배율을 건 «뒤» 기다렸다가 스크롤 — 섹션 B 를 세로 가운데, 캔버스 왼끝을 보이는 영역 왼쪽 200px 안쪽(200% 에서도 목표가 화면 안) */
  await page.evaluate(() => { document.getElementById('sB').scrollIntoView({ block: 'center' });
    const wrap = document.getElementById('canvas-wrap'); wrap.scrollLeft += document.getElementById('canvas').getBoundingClientRect().left - (wrap.getBoundingClientRect().left + 200); });
  await page.waitForTimeout(200);
  return errs;
}
const rectOf = (page, sel) => page.evaluate((s) => { const r = document.querySelector(s).getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; }, sel);
async function dragCardTo(page, x, y) {
  const c = await rectOf(page, '.assets-grid-card--image');
  const sx = c.l + c.w / 2, sy = c.t + c.h / 2;
  await page.mouse.move(sx, sy); await page.mouse.down();
  for (let i = 1; i <= 12; i++) await page.mouse.move(sx + (x - sx) * i / 12, sy + (y - sy) * i / 12);
  await page.waitForTimeout(100);
  await page.mouse.up(); await page.waitForTimeout(400);
}
const state = (page) => page.evaluate(() => {
  const it = [...document.querySelectorAll('.scratch-item')].map(e => { const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  const ab = [...document.querySelectorAll('#canvas .asset-block')];
  return { secs: [...document.querySelectorAll('#canvas > .section-block')].map(s => s.id), scratch: it, assets: ab.length,
           bOrder: [...document.querySelectorAll('#sB > .section-inner > *')].map(e => e.querySelector('.asset-block') ? 'ASSET' : (e.id || e.className.split(' ')[0])) };
});

for (const z of [40, 100, 200]) {
  test(`D1@${z} ★섹션 밖(회색 바닥)에 놓으면 스크래치 «그 자리» — 중심 = 놓은 점(±2) · 새 섹션·에셋 0`, async ({ page }) => {
    await setup(page, z);
    expect(await page.evaluate(() => window.currentZoom), '전제 — 그 배율이 «정말» 걸렸다').toBe(z);
    const sb = await rectOf(page, '#sB'), cv = await rectOf(page, '#canvas');
    const x = cv.l - 80, y = sb.t + sb.h / 2;
    expect(await page.evaluate(([x, y]) => !document.elementFromPoint(x, y)?.closest('.section-block') && !!document.elementFromPoint(x, y)?.closest('#canvas-wrap'), [x, y]), '전제 — 목표점이 섹션 밖·캔버스 안').toBe(true);
    await dragCardTo(page, x, y);
    const s = await state(page);
    expect(s.scratch.length).toBe(1);
    expect(Math.abs(s.scratch[0][0] - x), `가로 어긋남 ${s.scratch[0][0] - x}`).toBeLessThanOrEqual(2);
    expect(Math.abs(s.scratch[0][1] - y), `세로 어긋남 ${s.scratch[0][1] - y}`).toBeLessThanOrEqual(2);
    expect({ secs: s.secs, assets: s.assets }).toEqual({ secs: ['sA', 'sB', 'sC'], assets: 0 });
  });
  test(`D2@${z} ★섹션 안 글 아래 갭(위쪽 1/4)에 놓으면 그 글 «바로 다음»에 에셋 · 스크래치 0`, async ({ page }) => {
    await setup(page, z);
    expect(await page.evaluate(() => window.currentZoom), '전제 — 그 배율이 «정말» 걸렸다').toBe(z);
    /* ⚠️목표점은 «갭 안»을 비율로 겨눈다. 첫 판은 「글 아래 +4 화면px」이었는데 100%↑ 에선 모델 4px 이하라 글 줄과 갭 «사이 틈»
       (section-inner 자체)에 떨어져 기존 판정 «섹션 배경으로»가 났다(실측: 40% 만 초록) — 기능이 아니라 목표점 탓. */
    const g = await rectOf(page, '#sB > .section-inner > .gap-block:last-child');
    await dragCardTo(page, g.l + g.w / 2, g.t + g.h * 0.25);
    const s = await state(page);
    expect(s.scratch.length).toBe(0);
    expect(s.assets).toBe(1);
    expect(s.bOrder.slice(1, 3)).toEqual(['r_sB', 'ASSET']);
    expect(s.secs).toEqual(['sA', 'sB', 'sC']);
  });
}
test('D3 섹션 위에 떠 있는 스크래치 항목 위에 놓으면 → 스크래치(섹션에 안 넣는다)', async ({ page }) => {
  await setup(page, 100);
  const sb = await rectOf(page, '#sB');
  await page.evaluate(async ([px, x, y]) => { const sc = document.getElementById('canvas-scaler').getBoundingClientRect(); await window._scratchAddAndSave(px, Math.round(x - sc.left - 110), Math.round(y - sc.top - 110), 220); }, [PX, sb.l + sb.w / 2, sb.t + sb.h / 2]);
  expect((await state(page)).scratch.length, '전제 — 섹션 위 스크래치 항목').toBe(1);
  await dragCardTo(page, sb.l + sb.w / 2 + 30, sb.t + sb.h / 2 + 30);
  const s = await state(page);
  expect(s.assets).toBe(0);
  expect(s.scratch.length).toBe(2);
});
test('D4 ★섹션 맨 아래 끝(옛 안내선이 insertBefore 로 던지던 자리)에 놓아도 오류 없이 섹션 «끝»에 들어간다', async ({ page }) => {
  const errs = await setup(page, 100);
  const sb = await rectOf(page, '#sB');
  await dragCardTo(page, sb.l + sb.w / 2, sb.t + sb.h * 0.995);
  const s = await state(page);
  expect(errs, '페이지 오류 0(끌기 중 안내선 포함)').toEqual([]);
  expect(s.assets).toBe(1);
  expect(s.bOrder[s.bOrder.length - 1]).toBe('ASSET');
});
test('D5 섹션에 넣은 뒤 ⌘Z 한 번 = 넣기 취소', async ({ page }) => {
  await setup(page, 100);
  const g = await rectOf(page, '#sB > .section-inner > .gap-block:last-child');
  await dragCardTo(page, g.l + g.w / 2, g.t + g.h * 0.25);
  expect((await state(page)).assets, '전제 — 들어갔다').toBe(1);
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Meta+z'); await page.waitForTimeout(250);
  expect((await state(page)).assets).toBe(0);
});
