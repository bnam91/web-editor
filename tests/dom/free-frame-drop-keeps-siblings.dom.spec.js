/* free-frame-drop-keeps-siblings — 자유배치 프레임에 밖의 블럭을 «끌어 넣어도» 이미 있던 블럭은 제자리 (수지③ · 2026-10-08 지디 배정 T2).
 *
 * 수지 원문(현빈 4018 전달): 「프레임 블럭안에, 라벨텍스트, 일반 텍스트 블럭이 있는 상황에서 외부에 오브젝트 블럭을 드래그해서
 *   프레임블럭 안에 넣으려고 하면, 기존에 프레임블럭 안에 있던 블럭들의 위치가 바뀌게 된다. 자유배치 모드인데 왜 …」
 * 재현(64a06566 · 진짜 마우스 끌기): 라벨 (120,40)→(0,0) · 텍스트 (260,150)→(0,85).
 * 장면: 블럭은 «앱 함수»로 짓는다(addFrameBlock·addLabelGroupBlock·addTextBlock·addAssetBlock).
 *   「사람이 옮겨 둔 자리」는 left/top px 로 둔다 — 앱의 자식 끌기가 쓰는 «같은 꼴»(absolute + left/top px)이다.
 *   ⚠️그 자리를 진짜 손으로 만들지 «않았다»: 하네스에서 자식 클릭이 프레임을 고르고(수지④와 같은 규칙) 끌기가 프레임 쪽으로 갔다.
 * 끌어 넣기는 «진짜 손»(page.mouse) — HTML5 dragstart·dragover·drop 을 앱 리스너가 받는다.
 * 머리표: FD1 [새 것] 고치기 전 판에서 빨강 · FD0 [전제] 들어간 블럭이 프레임 안에 있다(전제가 서야 FD1 이 잰 것이다).
 * ⛔못 보는 꼴: 그리드(수지 「그리드 블럭을 드래그해서 삽입」) — 문장 뜻이 둘(그리드를 넣기 / 그리드에 넣기)이라 답을 받은 뒤 칸을 더한다.
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

async function scene(page, kind = 'asset') {
  await page.setViewportSize({ width: 1500, height: 1100 });
  await bootApp(page);
  return page.evaluate((kind) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', `<div class="section-block" id="sFD" data-section="1"><div class="section-hitzone"><span class="section-label">sFD</span></div><div class="section-inner"><div class="gap-block" data-type="gap" style="height:40px"></div></div></div>`);
    window.rebindAll?.(); window.applyZoom?.(60);
    const sec = document.getElementById('sFD');
    const made = (sel, fn) => { const b = new Set([...document.querySelectorAll('#canvas ' + sel)].map(e => e.id)); fn(); return [...document.querySelectorAll('#canvas ' + sel)].find(e => !b.has(e.id)); };
    window.deselectAll?.(); window._activeFrame = null; window.selectSection?.(sec);
    const fr = made('.frame-block:not([data-text-frame])', () => window.addFrameBlock());
    window.deselectAll?.(); window._activeFrame = fr; const lab = made('.label-group-block', () => window.addLabelGroupBlock());
    window.deselectAll?.(); window._activeFrame = fr; const txt = made('.text-block', () => window.addTextBlock('body'));
    const tu = txt.closest('.frame-block[data-text-frame]') || txt;
    lab.style.left = '120px'; lab.style.top = '40px'; tu.style.left = '260px'; tu.style.top = '150px';
    window.deselectAll?.(); window._activeFrame = null; window.selectSection?.(sec);
    const ext = kind === 'grid' ? made('.grid-block', () => window.addGridBlock()) : made('.asset-block', () => window.addAssetBlock());
    if (kind !== 'grid') window.applyAssetWidth?.(ext, 300);   // 패널 폭 칸이 부르는 그 함수 — 프레임보다 좁아야 «가운데»를 잴 수 있다(첫 판: 에셋 924 > 프레임 860 이라 가운데 단언이 항등식이었다)
    window.deselectAll?.(); window._activeFrame = null;
    return { fr: fr.id, free: fr.dataset.freeLayout, lab: lab.id, tu: tu.id, ext: ext.id,
      labIn: lab.parentElement === fr && lab.style.position === 'absolute', tuIn: tu.parentElement === fr && tu.style.position === 'absolute', extOut: !fr.contains(ext) };
  }, kind);
}
const box = (page, id) => page.evaluate((id) => { const r = document.getElementById(id).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, l: r.left, t: r.top, w: r.width, h: r.height }; }, id);
const pos = (page, ids) => page.evaluate((ids) => ({ lab: [document.getElementById(ids.lab).style.left, document.getElementById(ids.lab).style.top],
  tu: [document.getElementById(ids.tu).style.left, document.getElementById(ids.tu).style.top] }), ids);

async function dropIn(page, ids, kind = 'asset') {
  let e = await box(page, ids.ext);
  await page.mouse.click(e.x, e.y); await page.waitForTimeout(800);
  /* ★그리드는 고르면 크기가 바뀌고(실측 14→31px 높이) 가운데에 칸 경계(.grd-gutter)·모서리 손잡이가 선다 —
     사람처럼 «칸 안»(폭 25%)을 잡는다. 잡는 점이 그리드 줄 위인지 먼저 본다([전제]). */
  e = await box(page, ids.ext);
  if (kind === 'grid') {
    e = { ...e, x: e.l + e.w * 0.25 };
    const hit = await page.evaluate(({ x, y, id }) => !!document.elementFromPoint(x, y)?.closest('#' + id), { x: e.x, y: e.y, id: ids.ext });
    expect(hit, '[전제] 그리드 칸 안을 잡았다').toBe(true);
  }
  const f = await box(page, ids.fr);
  await page.mouse.move(e.x, e.y); await page.mouse.down();
  for (let i = 1; i <= 20; i++) await page.mouse.move(e.x + (f.l + f.w * 0.5 - e.x) * i / 20, e.y + (f.t + f.h * 0.75 - e.y) * i / 20);
  await page.waitForTimeout(200); await page.mouse.up(); await page.waitForTimeout(800);
  return page.evaluate((ids) => document.getElementById(ids.fr).contains(document.getElementById(ids.ext)), ids);
}

test('FD1 ★자유배치 프레임에 밖의 에셋을 끌어 넣어도 — 이미 있던 라벨·텍스트 자리는 그대로', async ({ page }) => {
  const ids = await scene(page);
  expect(ids.free, '[전제] 자유배치 프레임').toBe('true');
  expect(ids.labIn && ids.tuIn, '[전제] 라벨·텍스트가 프레임의 absolute 자식').toBe(true);
  expect(ids.extOut, '[전제] 에셋은 프레임 밖에서 시작').toBe(true);
  const p0 = await pos(page, ids);
  expect(p0).toEqual({ lab: ['120px', '40px'], tu: ['260px', '150px'] });
  const extIn = await dropIn(page, ids);
  expect(extIn, '[전제·FD0] 끌어 넣은 에셋이 프레임 안에 들어갔다(아니면 아래 단언은 아무것도 안 잰 것)').toBe(true);
  const p1 = await pos(page, ids);
  expect(p1, `이미 있던 블럭이 움직였다 — 라벨 ${p0.lab}→${p1.lab} · 텍스트 ${p0.tu}→${p1.tu}`).toEqual(p0);
  /* ★음성대조(같은 시험 안) — «들어온 그것»은 여전히 09-05 (b) 「좌표만 가로 중앙」이다. 이게 없으면 루프를 통째로 끈 것과 구분이 안 된다
     (실측: 루프를 통째로 끈 판에서 이 칸이 빨강이어야 한다 — 커밋 메시지에 그 판과 수). */
  const c = await page.evaluate((ids) => {
    const fr = document.getElementById(ids.fr), a = document.getElementById(ids.ext);
    const k = fr.getBoundingClientRect().width / fr.offsetWidth || 1;
    const fc = fr.getBoundingClientRect().left + fr.clientLeft * k + fr.clientWidth * k / 2;
    const ar = a.getBoundingClientRect();
    return { err: Math.round(((ar.left + ar.width / 2) - fc) / k * 10) / 10, left: a.style.left, pos: a.style.position, top: parseInt(a.style.top, 10), aw: a.offsetWidth, fw: fr.clientWidth };
  }, ids);
  expect(c.pos, '[전제] 들어온 에셋이 absolute 로 섰다').toBe('absolute');
  expect(c.aw, `[전제] 에셋이 프레임보다 좁아야 «가운데»가 잴 것이 된다 — 에셋 ${c.aw} · 프레임 ${c.fw}`).toBeLessThan(c.fw - 40);
  expect(Math.abs(c.err), `들어온 에셋이 가로 중앙이 아니다(09-05 (b)) — 중심 오차 ${c.err}px · left ${c.left}`).toBeLessThanOrEqual(2);
  expect(c.top, `들어온 에셋이 이미 있던 블럭과 겹친다 — top ${c.top} (텍스트 바닥 아래여야)`).toBeGreaterThan(150);
});

/* FD2 — 수지 「그리드 블럭을 드래그해서 삽입하려고 할때도」 의 «㉮ 그리드를 끌어 넣기» 읽기. (㉯ «그리드에 끌어 넣기» 는 답을 받은 뒤 칸을 더한다.)
 *   ⚠️그리드는 기본 폭이 프레임 폭을 따라가(F3 fitGridWidthToFreeFrame) «가운데» 가 잴 것이 안 될 수 있다 — 폭을 찍고, 좁을 때만 가운데를 잰다. */
test('FD2 ★자유배치 프레임에 밖의 그리드를 끌어 넣어도 — 이미 있던 라벨·텍스트 자리는 그대로', async ({ page }) => {
  const ids = await scene(page, 'grid');
  expect(ids.free, '[전제] 자유배치 프레임').toBe('true');
  expect(ids.labIn && ids.tuIn, '[전제] 라벨·텍스트가 프레임의 absolute 자식').toBe(true);
  expect(ids.extOut, '[전제] 그리드는 프레임 밖에서 시작').toBe(true);
  const p0 = await pos(page, ids);
  expect(p0).toEqual({ lab: ['120px', '40px'], tu: ['260px', '150px'] });
  const extIn = await dropIn(page, ids, 'grid');
  expect(extIn, '[전제·FD0] 끌어 넣은 그리드가 프레임 안에 들어갔다').toBe(true);
  const p1 = await pos(page, ids);
  expect(p1, `이미 있던 블럭이 움직였다 — 라벨 ${p0.lab}→${p1.lab} · 텍스트 ${p0.tu}→${p1.tu}`).toEqual(p0);
  const c = await page.evaluate((ids) => {
    const g = document.getElementById(ids.ext); const unit = g.closest('.row')?.parentElement?.id === ids.fr ? g.closest('.row') : g;
    return { pos: unit.style.position, top: parseInt(unit.style.top, 10), w: unit.offsetWidth, fw: document.getElementById(ids.fr).clientWidth };
  }, ids);
  expect(c.pos, '[전제] 들어온 그리드(또는 그 줄)가 absolute 로 섰다').toBe('absolute');
  expect(c.top, `들어온 그리드가 이미 있던 블럭과 겹친다 — top ${c.top} (텍스트 바닥 아래여야) · 폭 ${c.w}/${c.fw}`).toBeGreaterThan(150);
});

/* FD3 — 「같은 자유배치 프레임 «안에서» HTML5 로 다시 놓기」(지디 ⑷: 동작 변화 자리를 재는 칸).
 *   그 길이 앱에서 생기나(2026-10-08 실측 · 진짜 손 9 장면): absolute 자식(라벨·텍스트)을 누르면 HTML5 가 아니라 «프레임째» dragstart
 *   이거나(맨누름) 좌표 끌기(클릭 뒤)라 이 길을 안 탄다. ★생기는 꼴 = 옛 저장본의 «흐름» row(absolute 아님)가 자유배치 프레임 안에 있을 때 —
 *   그 안 블럭을 누르면 dragstart 가 그 블럭에서 나고 drop 이 같은 프레임에 1 번 온다(3/3).
 *   예전 판은 이때도 전원을 다시 쌓았다. 이제는 «들어온 것»(row 에서 꺼내져 프레임 직속이 된 것)만 옮긴다. */
test('FD3 같은 프레임 안 옛 흐름 row 의 블럭을 HTML5 로 다시 놓아도 — 이미 있던 라벨·텍스트 자리는 그대로', async ({ page }) => {
  const ids = await scene(page);
  const old = await page.evaluate((ids) => {
    const fr = document.getElementById(ids.fr);
    fr.insertAdjacentHTML('beforeend', '<div class="row" id="fdOldRow" style="height:60px"><div class="gap-block" id="fdOldGap" data-type="gap" style="height:60px"></div></div>');
    window.rebindAll?.(); window.deselectAll?.(); window._activeFrame = null;
    window.__fd3 = { ds: [], drop: 0 };
    document.addEventListener('dragstart', e => window.__fd3.ds.push(e.target.id || ''), true);
    fr.addEventListener('drop', () => { window.__fd3.drop++; }, true);
    const r = document.getElementById('fdOldRow');
    return { flow: r.style.position !== 'absolute', parentIsFrame: r.parentElement === fr };
  }, ids);
  expect(old, '[전제] 옛 흐름 row 가 자유배치 프레임 직속·흐름이다').toEqual({ flow: true, parentIsFrame: true });
  const p0 = await pos(page, ids);
  const g = await box(page, 'fdOldGap');
  await page.mouse.move(g.x, g.y); await page.mouse.down();
  for (let i = 1; i <= 15; i++) await page.mouse.move(g.x + i * 6, g.y + i * 4);
  await page.mouse.up(); await page.waitForTimeout(600);
  const ev = await page.evaluate(() => window.__fd3);
  expect(ev.ds, '[전제] HTML5 dragstart 가 그 블럭에서 났다(이 길을 실제로 탔다)').toContain('fdOldGap');
  expect(ev.drop, '[전제] drop 이 같은 프레임에 왔다').toBe(1);
  const p1 = await pos(page, ids);
  expect(p1, `이미 있던 블럭이 움직였다 — 라벨 ${p0.lab}→${p1.lab} · 텍스트 ${p0.tu}→${p1.tu}`).toEqual(p0);
});
