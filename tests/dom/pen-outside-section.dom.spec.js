/* pen-outside-section — t13A-04(현빈 GO 261119 · DESIGN-t13A-04 ⓐ «오버레이 모드가 기본»)
 *   섹션 «밖»(캔버스 빈 곳)에서 펜 = 스크래치 «펜 항목»(SVG 안 data-goditor-pen 에 펜 데이터) · 섹션에 끌어 놓으면 놓은 자리에 «떠 있는» 벡터(penNodes 그대로 · 점 편집 됨).
 *   섹션 안 펜은 지금 그대로(흐름 벡터).
 * ★2026-11-24 기대 바뀜 — t13G-03(0.9.13 185행 · 현빈 결정 261124 야간): 섹션 밖 펜 = 그린 자리에 떠 있는(IAL) 펜 벡터(스크래치 아님 · tests/dom/t13g-03-pen-outside-ial).
 *   ⇒ S1 = 스크래치 무변 · 떠 있는 펜 벡터. S2·S5·S6 의 «스크래치 펜 장»은 이제 그려서 못 만든다 — 옛 판에서 남은 장(저장본)의 길이라 장을 직접 심는다(seedPenItem).
 * 칸 (진짜 마우스 · 판정 = DOM·dataset)
 *   S1 펜 모드 · 캔버스 오른쪽 빈 곳 세 점 + Enter → 스크래치 무변 · 섹션에 떠 있는 펜 벡터(노드 셋)
 *   S2 그 장을 섹션 가운데로 끌어 놓기(안내선 뜬 뒤 놓음) → 벡터 하나(dataset.penNodes 노드 셋 · 떠 있음 data-overlay-block) · 그 장 사라짐 · ⌘Z 한 번 = 벡터 0 · 장 되살아남
 *   S3 [음성] 섹션 안에서 세 점 + Enter → 흐름 벡터(penNodes) · 스크래치 장 수 무변
 *   S4 [음성] «남이 만든» SVG 에 조작된 data-goditor-pen(색 주입 · 노드 501 · 글자 좌표 · 모르는 type …) → 읽기 검증이 null ·
 *      그런 장을 섹션에 끌어 놓으면 지금처럼 그림 에셋(벡터 0) — 지디 261119
 * 양성대조: _patches/pen-outside-CTL-section-only.patch(_penHost 가 섹션 밖이면 null — 옛 동작) → S1·S2 빨강 · S3 초록.
 * ⛔고정 대기 0(expect.poll · 조건 대기).
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitZoomSettled } = require('./_root-harness.js');

async function scene(page) {
  await page.setViewportSize({ width: 1600, height: 1000 });
  const errs = await bootApp(page);
  await page.evaluate(async () => {
    document.querySelectorAll('#canvas .section-block').forEach((s) => s.remove());
    await window.addSection();
    window.deselectAll?.();
  });
  await waitZoomSettled(page, await page.evaluate(() => window.currentZoom));
  return errs;
}
const counts = (page) => page.evaluate(() => ({ scratch: document.querySelectorAll('.scratch-item').length, blocks: document.querySelectorAll('#canvas .section-block .vector-block, #canvas .section-block .asset-block').length }));
const penOf = (page, id) => page.evaluate((id) => {
  const it = document.querySelector(`.scratch-item[data-scratch-id="${id}"] img`); if (!it) return null;
  const src = it.getAttribute('src') || '';
  if (!src.startsWith('data:image/svg+xml;base64,')) return { svg: false };
  const txt = decodeURIComponent(escape(atob(src.slice(26))));
  const m = /data-goditor-pen="([^"]+)"/.exec(txt);
  return { svg: true, nodes: m ? JSON.parse(decodeURIComponent(m[1])).nodes.length : 0 };
}, id);
/** 캔버스 오른쪽 빈 곳 세 점(화면) — 그 점의 임자가 #canvas 밖이어야 한다 */
const outsidePts = (page) => page.evaluate(() => {
  const c = document.getElementById('canvas').getBoundingClientRect();
  const pts = [[c.right + 80, c.top + 120], [c.right + 180, c.top + 140], [c.right + 130, c.top + 220]];
  return pts.map(([x, y]) => ({ x, y, out: !document.elementFromPoint(x, y)?.closest('#canvas') }));
});

/** 옛 판에서 남은 스크래치 펜 장(노드 셋 · data-goditor-pen)을 캔버스 오른쪽 밖에 심는다 — t13G-03 뒤엔 그려서는 안 생긴다 */
async function seedPenItem(page) {
  await page.evaluate(async () => {
    const nodes = [{ x: 4, y: 4, type: 'corner', hIn: null, hOut: null }, { x: 104, y: 24, type: 'corner', hIn: null, hOut: null }, { x: 54, y: 84, type: 'corner', hIn: null, hOut: null }];
    const meta = { nodes, closed: false, sw: 2, color: '#1a1a1a', fill: 'none', w: 108, h: 88 };
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" data-goditor-pen="${encodeURIComponent(JSON.stringify(meta))}" viewBox="0 0 108 88" width="108" height="88"><path d="M4 4 L104 24 L54 84" fill="none" stroke="#1a1a1a" stroke-width="2"/></svg>`;
    const src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
    const c = document.getElementById('canvas').getBoundingClientRect(), z = (window.currentZoom || 40) / 100, sc = document.getElementById('canvas-scaler').getBoundingClientRect();
    await window._scratchAddAndSave(src, Math.round((c.right + 80 - sc.left) / z), Math.round((c.top + 120 - sc.top) / z), 108, undefined, 'sp_pen');
  });
  await expect.poll(() => counts(page).then((c) => c.scratch), '[전제] 펜 장').toBe(1);
  return 'sp_pen';
}

/** 스크래치 장(id)을 섹션 가운데로 진짜로 끌어 놓는다 — 잡을 점 = 그 장(멎음) · 놓을 자리 안내(아밍) 뜬 뒤 한 번 더 움직이고 놓음 */
async function dragToSection(page, id) {
  let prev = '', a = null;
  await expect.poll(async () => { a = await page.evaluate((id) => { const el = document.querySelector(`.scratch-item[data-scratch-id="${id}"]`); const r = el.getBoundingClientRect(); const x = r.left + r.width / 2, y = r.top + r.height / 2; return { x, y, own: document.elementFromPoint(x, y)?.closest('.scratch-item') === el }; }, id); const k = `${a.x},${a.y}`, s = k === prev; prev = k; return a.own && s; },
    { message: '[전제] 장 가운데 = 그 장 · 멎음', intervals: [50] }).toBe(true);
  const b = await page.evaluate(() => { const r = document.querySelector('#canvas .section-block').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await page.mouse.move(a.x, a.y); await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(a.x + (b.x - a.x) * i / 8, a.y + (b.y - a.y) * i / 8);
  await expect.poll(() => page.evaluate(() => !!document.querySelector('.sp2c-section-target, .sp2c-insert-indicator, .sp2c-replace-target')), '[전제] 놓을 자리 안내(아밍)').toBe(true);
  await page.mouse.move(b.x + 1, b.y + 1);   // 아밍 뒤 한 번 더 움직여 끌기 쪽 판정(dropKind)을 갱신
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await page.mouse.up();
}

test('S1 섹션 밖 펜 → 떠 있는 펜 벡터 · 스크래치 무변(t13G-03 기대 바뀜)', async ({ page }) => {
  const errs = await scene(page);
  const c0 = await counts(page);
  const pts = await outsidePts(page);
  expect(pts.every((p) => p.out), '[전제] 세 점 = 캔버스 밖').toBe(true);
  await page.evaluate(() => window.enterVectorPenMode());
  for (const p of pts) await page.mouse.click(p.x, p.y);
  await page.keyboard.press('Enter');
  await expect.poll(() => counts(page), '★스크래치 무변 · 섹션 블럭 +1')   /* 인텔 261120: poll 에 함수만 넘겨 page 가 undefined(S1 이 한 번도 안 돌았다) */
    .toEqual({ scratch: c0.scratch, blocks: c0.blocks + 1 });
  expect(await page.evaluate(() => { const v = document.querySelector('#canvas .section-block .vector-block'); return { nodes: JSON.parse(v.dataset.penNodes || '[]').length, float: v.dataset.overlayBlock === 'true' || !!v.closest('[data-overlay-block="true"]') }; }), '★떠 있는 펜 벡터 · 노드 셋').toEqual({ nodes: 3, float: true });
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('S2 펜 항목을 섹션에 끌어 놓기 → 떠 있는 펜 벡터 · ⌘Z 한 번 = 되돌림', async ({ page }) => {
  const errs = await scene(page);
  const id = await seedPenItem(page);
  await dragToSection(page, id);
  const vec = () => page.evaluate(() => { const v = document.querySelector('#canvas .section-block .vector-block'); if (!v) return null; return { nodes: v.dataset.penNodes ? JSON.parse(v.dataset.penNodes).length : 0, float: !!v.closest('[data-overlay-block="true"]') || v.dataset.overlayBlock === 'true' }; });
  await expect.poll(vec, '★떠 있는 펜 벡터(노드 셋)').toEqual({ nodes: 3, float: true });
  await expect.poll(() => counts(page).then((c) => c.scratch), '★장은 섹션으로 옮겨 감').toBe(0);
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Meta+z');
  await expect.poll(vec, '★⌘Z 한 번 = 벡터 0').toBeNull();
  await expect.poll(() => counts(page).then((c) => c.scratch), '★⌘Z 한 번 = 장 되살아남').toBe(1);
  expect(await penOf(page, id), '★되살린 장도 펜 항목').toEqual({ svg: true, nodes: 3 });
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* S5 채점 2차(261120) — 저장·다시 열기를 거친 펜 장(src = 외부화 goya-asset .svg)도 섹션에 놓으면 «펜 벡터»(옛 = 렌더러 fetch('goya-asset://…') 가
 *   «Failed to fetch» → null → 그림 에셋). 장면: S1 로 펜 장 → 그 장 src 를 goya-asset://p-t13a04/pen.svg 로(저장 외부화 뒤 다시 연 꼴) · 디스크 읽기 IPC
 *   (electronAPI.assetsReadAsDataUri · goyaAssetToDrawableSrc 의 «마지막 문»)는 원래 그 장 data URL 을 돌려주는 대역 · 읽은 파일 이름 기록.
 *   잰다: 놓으면 펜 벡터 · penNodes = 원래 장 노드와 같음 · IPC 가 그 파일을 읽음 · 에셋 0.
 *   양성대조: _patches/pen-outside-CTL-goya-fetch.patch(IPC 대신 옛 fetch) → S5 «펜 벡터» 빨강(하네스엔 goya-asset 스킴이 없어 fetch 가 실패 = 앱과 같은 병). */
test('S5 저장·다시 열기 뒤 펜 장(goya-asset .svg) 놓기 → 펜 벡터 · 노드 같음', async ({ page }) => {
  const errs = await scene(page);
  const id = await seedPenItem(page);
  const nodes0 = await page.evaluate((id) => {
    const it = window._scratchItemById(id), data = it.src;
    const m = /data-goditor-pen="([^"]+)"/.exec(decodeURIComponent(escape(atob(data.slice(26)))));
    window.__readCalls = [];
    window.electronAPI = Object.assign({}, window.electronAPI, { assetsReadAsDataUri: async ({ projectId, filename }) => { window.__readCalls.push(projectId + '/' + filename); return { ok: true, dataUri: data }; } });
    it.src = 'goya-asset://p-t13a04/pen.svg';   // 저장 외부화 → 다시 연 꼴(img 는 그대로 보이게 둠 — 놓기 판정은 item.src 를 읽는다)
    return JSON.parse(decodeURIComponent(m[1])).nodes.map((n) => [n.x, n.y]);
  }, id);
  expect(nodes0.length, '[전제] 원래 장 노드 셋').toBe(3);
  await dragToSection(page, id);
  const vec = () => page.evaluate(() => { const v = document.querySelector('#canvas .section-block .vector-block'); return v && v.dataset.penNodes ? JSON.parse(v.dataset.penNodes).map((n) => [n.x, n.y]) : null; });
  await expect.poll(vec, '★goya-asset 펜 장 → 펜 벡터 · 노드 같음').toEqual(nodes0);
  expect(await page.evaluate(() => window.__readCalls), '★디스크 읽기 IPC 로 그 파일을 읽었다').toContain('p-t13a04/pen.svg');
  expect(await page.evaluate(() => document.querySelectorAll('#canvas .section-block .asset-block').length), '★그림 에셋 0').toBe(0);
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* S6 덤(채점 2차) — 놓기가 «안 된»(아밍 없이 스친) 장은 src 가 그대로(옛 = 놓기 전에 grdAssetSrcOf 결과 goya-asset 을 장에 박아 실패해도 바뀜).
 *   장면: 펜 장 · grdAssetSrcOf 대역(늘 goya-asset 을 줌 · 불림 기록) · 장을 잡아 섹션 위로 «한 번에» 옮겨 바로 놓음(아밍 기다리지 않음 = requireArm 거절).
 *   전제: 대역이 실제로 불렸다(그 갈래를 탔다) · 섹션 블럭 무변. 잰다: 장 src 가 그대로 data: .
 *   양성대조: _patches/pen-outside-CTL-src-before-commit.patch(놓기 전 장에 박음 · 옛) → S6 빨강. */
test('S6 아밍 없이 스친 놓기 — 장 src 그대로(실패한 놓기가 장을 바꾸지 않음)', async ({ page }) => {
  const errs = await scene(page);
  const id = await seedPenItem(page);
  const c0 = await counts(page);
  await page.evaluate((id) => { window.__grdCalls = 0;   // 한 번에 놓으면 dropKind = none 이라 펜 갈래는 안 탄다 — 탔으면 «섹션 블럭 무변» 전제가 잡음
    window.grdAssetSrcOf = async () => { window.__grdCalls++; return { asset: true, src: 'goya-asset://p-t13a04/x.svg' }; }; }, id);
  /* ★2026-11-24 — 심은 장(seedPenItem · t13G-03 뒤)은 그리자마자 잡으면 부하에서 자리가 아직 안 섰다(열차 train/0913-c 인텔 전수 1/1 빨강 «grdAssetSrcOf 0» · srv ×5 0/5)
     ⇒ dragToSection 과 같은 «잡을 점 = 그 장 · 멎음» 조건 대기 뒤 잡는다(그 뒤 «한 번에» 옮기는 것은 그대로) */
  let prev = '', a = null;
  await expect.poll(async () => { a = await page.evaluate((id) => { const el = document.querySelector(`.scratch-item[data-scratch-id="${id}"]`); const r = el.getBoundingClientRect(); const x = r.left + r.width / 2, y = r.top + r.height / 2; return { x, y, own: document.elementFromPoint(x, y)?.closest('.scratch-item') === el }; }, id); const k = `${a.x},${a.y}`, st = k === prev; prev = k; return a.own && st; },
    { message: '[전제] 장 가운데 = 그 장 · 멎음', intervals: [50] }).toBe(true);
  const b = await page.evaluate(() => { const r = document.querySelector('#canvas .section-block').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await page.mouse.move(a.x, a.y); await page.mouse.down();
  await page.mouse.move(b.x, b.y);   // 한 번에 — 아밍(안내) 기다리지 않음
  await page.mouse.up();
  await expect.poll(() => page.evaluate(() => window.__grdCalls), '[전제] 그림 갈래(grdAssetSrcOf)를 탔다').toBeGreaterThan(0);
  expect((await counts(page)).blocks, '[전제] 섹션 블럭 무변(안 놓임)').toBe(c0.blocks);
  expect(await page.evaluate((id) => (window._scratchItemById(id)?.src || '').slice(0, 5), id), '★안 놓인 장 src 그대로 data:').toBe('data:');
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('S3 [음성] 섹션 안 펜 = 흐름 벡터 · 스크래치 무변', async ({ page }) => {
  const errs = await scene(page);
  const c0 = await counts(page);
  const pts = await page.evaluate(() => { const r = document.querySelector('#canvas .section-block').getBoundingClientRect(); return [[0.3, 0.3], [0.6, 0.35], [0.45, 0.6]].map(([fx, fy]) => ({ x: r.left + r.width * fx, y: r.top + r.height * fy })); });
  await page.evaluate(() => window.enterVectorPenMode());
  for (const p of pts) await page.mouse.click(p.x, p.y);
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => { const v = document.querySelector('#canvas .section-block .vector-block'); return v ? JSON.parse(v.dataset.penNodes || '[]').length : 0; }), '★섹션 안 = 흐름 펜 벡터').toBe(3);
  expect((await counts(page)).scratch, '★스크래치 무변').toBe(c0.scratch);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('S4 [음성] 조작된 펜 속성 SVG → 검증 null · 섹션에 놓으면 그림 길(벡터 0)', async ({ page }) => {
  const errs = await scene(page);
  const bad = await page.evaluate(async () => {
    const good = { nodes: [{ x: 1, y: 1, type: 'corner', hIn: null, hOut: null }, { x: 30, y: 20, type: 'corner', hIn: null, hOut: null }], closed: false, sw: 2, color: '#1a1a1a', fill: 'none', w: 40, h: 30 };
    const mk = (meta) => 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" data-goditor-pen="${encodeURIComponent(JSON.stringify(meta))}" viewBox="0 0 40 30" width="40" height="30"><rect width="40" height="30" fill="#ff0000"/></svg>`)));
    const cases = [{ ...good, color: 'red"><script>' }, { ...good, nodes: Array.from({ length: 501 }, (_, i) => ({ x: i, y: i })) }, { ...good, nodes: [{ x: '1', y: 1 }, { x: 2, y: 2 }] },
      { ...good, nodes: [{ x: 1, y: 1, type: 'evil' }, { x: 2, y: 2 }] }, { ...good, sw: 999 }, { ...good, fill: 'url(#x)' }];
    const out = [];
    for (const c of cases) out.push(await window._scratchPenMeta(mk(c)));
    out.push(!!(await window._scratchPenMeta(mk(good))));   // 대조: 멀쩡한 것은 읽힌다
    const canvas = document.getElementById('canvas').getBoundingClientRect(), z = (window.currentZoom || 40) / 100;
    const sc = document.getElementById('canvas-scaler').getBoundingClientRect();
    await window._scratchAddAndSave(mk(cases[0]), Math.round((canvas.right + 60 - sc.left) / z), Math.round((canvas.top + 100 - sc.top) / z), 120, undefined, 'sp_bad');
    return out;
  });
  expect(bad, '★조작 여섯 = null · 대조 = 읽힘').toEqual([null, null, null, null, null, null, true]);
  await dragToSection(page, 'sp_bad');
  /* 빈 섹션 가운데 = 놓을 자리 판정(에셋 넣기·섹션 배경)은 기존 그림 길 몫 ⇒ «그림으로 들어갔다» = 장이 소비됐고 벡터 0 */
  await expect.poll(() => page.evaluate(() => ({ vec: document.querySelectorAll('#canvas .section-block .vector-block').length, scratchLeft: !!document.querySelector('.scratch-item[data-scratch-id="sp_bad"]') })), '★그림 길로 소비 · 벡터 0').toEqual({ vec: 0, scratchLeft: false });
  expect(errs, errs.join(' | ')).toEqual([]);
});
