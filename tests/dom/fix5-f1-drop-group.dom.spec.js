/* fix5-f1-drop-group.dom.spec.js — 128 F1 처방 ㉠ (지디 2026-10-26 판정)
 *
 * 결함(128 적대 검수 F1 · 근거 reports/S6-FIX5.md ⑯): 그룹 모드 안에서 한 장을 «마우스로» 섹션 그리드 칸에 끌어 놓으면
 *   (스크래치 → 에셋 변환) 남은 1장이 그룹을 그대로 쥐고(1장 그룹) 모드도 남았다 · ⌘Z 로 되살린 장은 그룹 소속을 잃었다.
 * 처방 ㉠: 변환 길 `_scratchRemoveById` 가 규칙 한 벌 `_dissolveLoneGroup` 을 «부른다» + 되살림 정보(_pickScratch)에 g.
 *
 * D1 ⒝ 양성 — 2장 그룹 · 모드 진입 → 한 장 끌어 놓기 ⇒ 남은 1장 그룹 풀림 · 모드 나감
 * D2 ⒝ 음성 — 3장 그룹 · 같은 짓 ⇒ 남은 2장은 같은 그룹 그대로 · 모드 그대로
 * D3 ⒞      — D1 뒤 ⌘Z 한 번 ⇒ 끌린 장 = g_pq · 풀렸던 짝도 g_pq · 장 수·순서가 끌기 전과 같다
 * D4 배경 길 — 섹션 «좌우 패딩 띠»(그리드·본문 칼럼 아님)에 놓아 «섹션 배경»으로 변환 ⇒ 남은 1장 풀림 · ⌘Z 1 = 둘 다 g_pq·순서·배경 원래
 *   (부모 앱 실측 98f30b11 · 원 저장본 g_eqfvnq ×4: 배경으로 바뀐 뒤 ⌘Z 해도 그 장 data-scratch-group = null · 그룹 6 그대로)
 *   ★코드로 확인: 배경 길도 같은 `commitScratchDropAt`(kind 'sectionbg') → 같은 onUp «committed» 갈래 → 같은 되살림 자리다(다른 자리 없음).
 *
 * ★고정 대기 0 — 조건 대기만(무장 = 표시 보임 · 변환 = 장 수/에셋 수 · ⌘Z = 장 되살아남).
 * 양성대조(2026-10-26 실측 ×1): GD1001_ROOT=<98f30b11 git archive> ⇒ D1·D3·D4 빨강 · D2 초록(음성은 옛 판에도 참)
 *   옛 판 값: D1 놓은 뒤 {sp_q:'g_pq'} · 모드 g_pq / D3 ⌘Z 뒤 sp_p:null · 순서 [sp_q,sp_p] / D4 배경 바뀐 뒤 {sp_q:'g_pq'}
 * 변이(각 ×1 · 사본에 한 줄씩):
 *   M1 `_scratchRemoveById` 의 `_dissolveLoneGroup` 호출 줄 빼기   ⇒ D1·D4 빨강
 *   M2 되살림 `_pickScratch(item, ['linkDy'])` 를 ['g','linkDy'] 로 ⇒ D3·D4 빨강
 *   M3 ⌘Z 의 짝 소속 되돌림(_applyScratchGeomSnapshot) 줄 빼기    ⇒ D3·D4 빨강
 *   M4 ⌘Z 의 순서 되앉힘(_applyScratchOrder) 줄 빼기              ⇒ D3·D4 빨강
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

/* 잡는 점 = 장의 «왼쪽 아래» 쪽(가로 30% · 세로 70%) — ⛔가운데가 아니다: 줌 40% 에선 위쪽 손잡이(✂·AI·✕ · 역배율로 커진다)가
   가운데 가까이 내려온다. 첫 런 D2 실측: 가운데를 잡았더니 sp_r 이 두 조각(자르기)이 됐다 — 손잡이를 누른 탓으로 «추정». */
const rect = (page, id) => page.evaluate((id) => {
  const q = document.querySelector(`.scratch-item[data-scratch-id="${id}"]`).getBoundingClientRect();
  return { cx: q.left + q.width * 0.3, cy: q.top + q.height * 0.7 };
}, id);
const st = (page) => page.evaluate(() => ({
  ids: [...document.querySelectorAll('.scratch-item')].map((e) => e.dataset.scratchId),
  grp: Object.fromEntries([...document.querySelectorAll('.scratch-item')].map((e) => [e.dataset.scratchId, e.dataset.scratchGroup ?? null])),
  mode: window._scratchGroupMode?.() ?? null,
  assets: document.querySelectorAll('#canvas .asset-block').length,
}));

/* 섹션 하나 + 2칸 그리드 · 그룹 장 n 개(g_pq) — 마지막 장을 더블클릭해 모드 진입.
   section-inner 좌우 패딩 72px = 앱 값(canvas-scratch-drop.js D6 ⒡2 「z100 72px」) — 하네스엔 그 CSS 가 안 서서(실측 0px) 손으로 준다. 배경 길(D4)의 띠다. */
async function scene(page, ids) {
  await page.setViewportSize({ width: 1500, height: 1200 });
  await bootApp(page);
  const gid = await page.evaluate(() => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', `<div class="section-block" id="sA" data-section="1"><div class="section-hitzone"></div><div class="section-inner" style="padding:0 72px"><div class="gap-block" data-type="gap" style="height:40px"></div><div class="row" id="rA" data-layout="stack"></div><div class="gap-block" data-type="gap" style="height:200px"></div></div></div>`);
    const { block: g } = window.makeGridBlock({ cols: [{ width: 1, lines: [{ type: 'body', text: '칸 A' }] }, { width: 1, lines: [{ type: 'body', text: '칸 B' }] }] });
    document.getElementById('rA').appendChild(g); window.rebindAll?.(); window.renderGridBlock(g); window.deselectAll?.(); window.applyZoom?.(50); return g.id;
  });
  await page.evaluate(async (ids) => {
    const cv = document.createElement('canvas'); cv.width = 240; cv.height = 140;
    const x = cv.getContext('2d'); x.fillStyle = '#3a86ff'; x.fillRect(0, 0, 240, 140);
    const src = cv.toDataURL('image/png');
    let y = 40;
    for (const id of ids) { await window._scratchAddAndSave(src, -320, y, 200, 'g_pq', id); y += 220; }
  }, ids);
  await page.waitForFunction((n) => [...document.querySelectorAll('.scratch-item img')].filter(i => i.complete && i.naturalWidth > 0).length === n, ids.length, { timeout: 10000 });
  await page.evaluate(() => window.clearHistory?.());
  const last = await rect(page, ids[ids.length - 1]);
  await page.mouse.dblclick(last.cx, last.cy);
  await page.waitForFunction(() => window._scratchGroupMode?.() === 'g_pq', null, { timeout: 5000 });
  return gid;
}

/* 첫 장(sp_p)을 «사람 손»으로 끌어 무장 표시가 뜬 뒤 놓는다.
   where = 'cell'(그리드 칸 → 에셋 삽입 · 표시 .sp2c-insert-indicator) | 'bg'(섹션 좌패딩 띠 → 섹션 배경 · 표시 .sp2c-section-target) */
async function dragToCell(page, gid, where = 'cell') {
  /* 대상을 보이게 한 뒤 «세 프레임 내리 같은 자리»일 때까지 기다린다(부드러운 스크롤이어도 멈춘 값을 쓴다). */
  const drop = await page.evaluate(({ gid, where }) => new Promise((res) => {
    const cell = document.querySelector(`#${gid} .grd-cell`);
    const inner = document.querySelector('#sA .section-inner');
    cell.scrollIntoView({ block: 'nearest' });
    const at = () => {
      if (where === 'cell') { const q = cell.getBoundingClientRect(); return [q.left + q.width / 2, q.top + q.height / 2]; }
      /* 배경 길 = 내용 칼럼 «밖» 좌패딩 띠(canvas-scratch-drop.js D6 ⒡2) — 띠 가운데 · 그리드 칸 높이 */
      const ir = inner.getBoundingClientRect();
      const k = inner.offsetWidth ? ir.width / inner.offsetWidth : 1;
      const padL = (parseFloat(getComputedStyle(inner).paddingLeft) || 0) * k;
      const q = cell.getBoundingClientRect();
      return [ir.left + padL / 2, q.top + q.height / 2];
    };
    let prev = null, same = 0;
    const tick = () => {
      const cur = at().map(Math.round);
      same = prev && prev[0] === cur[0] && prev[1] === cur[1] ? same + 1 : 0;
      prev = cur;
      if (same >= 3) res(cur); else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }), { gid, where });
  const p = await rect(page, 'sp_p');
  await page.mouse.move(p.cx, p.cy); await page.mouse.down();
  await page.mouse.move(p.cx + 20, p.cy + 10, { steps: 4 });
  await page.mouse.move(drop[0], drop[1], { steps: 20 });
  await page.mouse.move(drop[0] + 2, drop[1] + 1, { steps: 2 });
  const guide = where === 'cell' ? '.sp2c-insert-indicator' : '#sA.sp2c-section-target';
  await expect(page.locator(guide), '무장(armed) 표시 — 변환 길에 올랐다(' + where + ')').toBeVisible({ timeout: 5000 });
  await page.mouse.up();
  await page.waitForFunction(() => !document.querySelector('.scratch-item[data-scratch-id="sp_p"]'), null, { timeout: 5000 });
}

test('D1 ⒝ 양성 — 2장 그룹 모드에서 한 장을 섹션 칸에 놓으면 남은 1장 그룹이 풀리고 모드가 나간다', async ({ page }) => {
  const gid = await scene(page, ['sp_p', 'sp_q']);
  const s0 = await st(page);
  expect(s0.grp, '전제: 둘 다 g_pq').toEqual({ sp_p: 'g_pq', sp_q: 'g_pq' });
  await dragToCell(page, gid);
  const s1 = await st(page);
  console.log('[D1] ' + JSON.stringify({ s0, s1 }));
  expect(s1.assets, '에셋 하나가 섹션에 들어갔다').toBe(s0.assets + 1);
  expect(s1.ids, '남은 장').toEqual(['sp_q']);
  expect(s1.grp.sp_q, '★남은 1장은 그룹이 풀린다(1장 그룹 0)').toBeNull();
  expect(s1.mode, '★모드도 나간다').toBeNull();
});

test('D2 ⒝ 음성 — 3장 그룹이면 남은 2장은 같은 그룹 그대로(경계 = 1장)', async ({ page }) => {
  const gid = await scene(page, ['sp_p', 'sp_q', 'sp_r']);
  await dragToCell(page, gid);
  const s1 = await st(page);
  console.log('[D2] ' + JSON.stringify(s1));
  expect(s1.ids, '남은 장').toEqual(['sp_q', 'sp_r']);
  expect(s1.grp, '★2장 남으면 안 풀린다').toEqual({ sp_q: 'g_pq', sp_r: 'g_pq' });
  expect(s1.mode, '모드 그대로').toBe('g_pq');
});

test('D3 ⒞ — ⌘Z 한 번에 끌린 장이 g_pq 로 · 풀렸던 짝도 g_pq 로 · 수·순서가 끌기 전과 같다', async ({ page }) => {
  const gid = await scene(page, ['sp_p', 'sp_q']);
  const s0 = await st(page);
  await dragToCell(page, gid);
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Meta+z');
  await page.waitForFunction(() => !!document.querySelector('.scratch-item[data-scratch-id="sp_p"]'), null, { timeout: 5000 });
  /* onUndo 는 async(되살린 «뒤» 소속·순서를 맞춘다) ⇒ 한 번 찍지 않고 맞을 때까지 본다(고정 대기 대신). */
  const pick = async () => { const s = await st(page); return { ids: s.ids, grp: s.grp, assets: s.assets }; };
  await expect.poll(pick, { message: '★⌘Z 1 = 끌린 장·풀렸던 짝 둘 다 g_pq · 수·순서·에셋 수가 끌기 전과 같다', timeout: 5000 })
    .toEqual({ ids: s0.ids, grp: { sp_p: 'g_pq', sp_q: 'g_pq' }, assets: s0.assets });
  console.log('[D3] ' + JSON.stringify({ s0, s2: await st(page) }));
});

test('D4 배경 길 — 2장 그룹 · 섹션 좌패딩 띠에 놓아 «섹션 배경» ⇒ 남은 1장 풀림 · ⌘Z 1 = 둘 다 g_pq·순서·배경 원래', async ({ page }) => {
  const gid = await scene(page, ['sp_p', 'sp_q']);
  const bg = () => page.evaluate(() => document.getElementById('sA').dataset.bgImg ?? null);
  const s0 = await st(page);
  const bg0 = await bg();
  await dragToCell(page, gid, 'bg');
  const s1 = await st(page);
  const bg1 = await bg();
  console.log('[D4] ' + JSON.stringify({ s0, bg0: bg0 && bg0.slice(0, 30), s1, bg1: bg1 && bg1.slice(0, 30) }));
  expect(bg1 && bg1 !== bg0, '전제: 섹션 배경으로 바뀌었다(배경 길)').toBe(true);
  expect(s1.assets, '에셋 수 그대로(삽입 길 아님)').toBe(s0.assets);
  expect(s1.grp, '★남은 1장 풀림').toEqual({ sp_q: null });
  expect(s1.mode, '★모드 나감').toBeNull();
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Meta+z');
  await page.waitForFunction(() => !!document.querySelector('.scratch-item[data-scratch-id="sp_p"]'), null, { timeout: 5000 });
  const pick = async () => { const s = await st(page); return { ids: s.ids, grp: s.grp, assets: s.assets, bg: await bg() }; };
  await expect.poll(pick, { message: '★⌘Z 1 = 둘 다 g_pq · 순서 · 배경 원래', timeout: 5000 })
    .toEqual({ ids: s0.ids, grp: { sp_p: 'g_pq', sp_q: 'g_pq' }, assets: s0.assets, bg: bg0 });
});
