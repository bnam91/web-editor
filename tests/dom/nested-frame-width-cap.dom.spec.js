/* nested-frame-width-cap.dom.spec.js — NEW-현빈QA-NESTED-FRAME-WIDTH-CAP-01 ⒜(현빈 261110): 프레임 «안» 프레임의 모서리 손잡이 너비 상한을 없앤다.
 *   부모를 넘는 부분은 부모가 자른다(피그마 clip 꼴) · 부모 크기 무변 · ⌘Z 한 번 · 저장 왕복 · 섹션 직속 프레임 상한은 그대로 · 옛 프로젝트 무변 · HTML 내보내기도 같은 잘림.
 *   뿌리 둘: ① js/overlay-handles.js _onHandleMouseDown maxW(섹션 안쪽 폭) ② 프레임 max-width:100%(인라인 + .frame-block CSS) = 부모 폭.
 * ★양성대조: overlay-handles.js 를 바탕(8531420ec)으로 되돌리면 W1 빨강(자식이 부모 폭에 물린다). */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const { expectOneUndoStep } = require('./_history-step.js');

const f2 = (p) => p.waitForFunction(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
/** 섹션 직속 P(500×400 · free|stack) 안에 들어가(진입) 만든 K(부모 80%) */
async function scene(page, kind) {
  await page.setViewportSize({ width: 1700, height: 1200 });
  const errs = await bootApp(page);
  await page.evaluate(async (kind) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); await window.addSection();
    const sec = [...c.querySelectorAll('.section-block')].pop(); window.applyZoom?.(50);
    window.deselectAll(); window.selectSection(sec); window._activeFrame = null; window.addFrameBlock();
    const P = [...sec.querySelectorAll('.frame-block')].pop(); P.id = 'P';
    if (kind === 'stack') delete P.dataset.freeLayout;
    window.updateFrameBlock?.('P', { width: 500, height: 400 });
    window.deselectAll(); P.classList.add('selected'); window._activeFrame = P; window._enteredFrame = P; window.addFrameBlock(); window._enteredFrame = null;
    const K = [...P.querySelectorAll('.frame-block')].pop(); K.id = 'K';
    window.deselectAll(); window.clearHistory?.();
  }, kind);
  await f2(page);
  return errs;
}
const read = (page) => page.evaluate(() => {
  const K = document.getElementById('K'), P = document.getElementById('P'), kr = K.getBoundingClientRect(), pr = P.getBoundingClientRect();
  const z = pr.width / P.offsetWidth;
  // 부모 오른쪽 변 바로 밖(자식이 넘친 자리) — 잘렸으면 거기서 K 를 못 맞힌다
  const probe = kr.right > pr.right + 20 ? document.elementFromPoint(pr.right + 10, (kr.top + kr.bottom) / 2) : null;
  return { Kw: K.offsetWidth, KmaxW: K.style.maxWidth, Pw: P.offsetWidth, Ph: P.offsetHeight, Pover: getComputedStyle(P).overflow,
    over: Math.round((kr.right - pr.right) / z), hitOutside: probe ? (K.contains(probe) || probe === K) : null };
});
/* 고르기는 «사람 손»으로 — P = P 여백 한 번 클릭 · K = P 여백 클릭 → K 더블클릭(한 겹 내려가 오브젝트로 고름). 스크립트로 .selected 만 달면 쌓기 자식은 손잡이 배선이 안 선다(바탕 판도 같음 · 실측). */
async function pick(page, id) {
  await page.evaluate(() => { window.deselectAll(); document.activeElement?.blur?.(); }); await f2(page);
  const pc = await page.evaluate(() => { const r = document.getElementById('P').getBoundingClientRect(); return [r.right - 6, r.bottom - 6]; });
  await page.mouse.click(pc[0], pc[1]); await f2(page);
  if (id === 'K') { const kc = await page.evaluate(() => { const r = document.getElementById('K').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }); await page.mouse.dblclick(kc[0], kc[1]); await f2(page); }
  await page.waitForFunction((id) => document.getElementById(id).classList.contains('selected') && !!document.querySelector('#ss-handles-overlay .ss-resize-handle.se'), id);
}
async function dragEast(page, id, dx) {
  await pick(page, id);
  const h = await page.evaluate(() => { const e = document.querySelector('#ss-handles-overlay .ss-resize-handle.se'); const r = e.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
  await page.mouse.move(h[0], h[1]); await page.mouse.down();
  await page.mouse.move(h[0] + dx, h[1] + 4, { steps: 8 }); await page.mouse.up(); await f2(page);
}

for (const kind of ['free', 'stack']) {
  test(`W1 ${kind} 부모 안 프레임 — 부모보다 넓게 끌린다 · 부모 크기 무변 · 넘친 곳은 잘림 · ⌘Z 한 번 · 저장 왕복`, async ({ page }) => {
    const errs = await scene(page, kind);
    const a = await read(page);
    expect([a.Kw, a.Pw, a.Ph], '[전제] 자식 400 · 부모 500×400').toEqual([400, 500, 400]);
    let b;
    await expectOneUndoStep(page, async () => {
      await dragEast(page, 'K', 600);
      b = await read(page);
    }, `${kind} 중첩 프레임 넓히기`);
    console.log(`[W1 ${kind}] ` + JSON.stringify({ a, b }));
    expect(b.Kw, '자식이 부모(500)보다 넓어졌다 — 상한 없음').toBeGreaterThan(700);
    expect(b.KmaxW, '그 프레임만 max-width 풀림').toBe('none');
    expect([b.Pw, b.Ph], '부모 크기 무변').toEqual([500, 400]);
    expect(b.Pover, '부모가 자른다(clip)').toBe('hidden');
    expect(b.hitOutside, '부모 밖으로 넘친 자리는 안 보인다(그 점에서 자식을 못 맞힌다)').toBe(false);
    expect((await read(page)).Kw, '⌘Z 한 번 = 400').toBe(400);
    await page.keyboard.press('Meta+Shift+z'); await f2(page);
    const redo = await read(page);
    await page.evaluate(async () => { window.deselectAll(); const d = JSON.parse(window.serializeProject()); document.getElementById('canvas').innerHTML = ''; await window.applyProjectData(d); });
    await page.waitForFunction(() => !!document.getElementById('K'));
    const c = await read(page);
    expect([c.Kw, c.KmaxW, c.Pw, c.Ph], '저장 왕복 그대로').toEqual([redo.Kw, 'none', 500, 400]);
    expect(errs).toEqual([]);
  });
}

test('W2 섹션 직속 프레임 — 상한 그대로(섹션 안쪽 폭)', async ({ page }) => {
  const errs = await scene(page, 'free');
  const secW = await page.evaluate(() => { const si = document.querySelector('#canvas .section-inner'); const cs = getComputedStyle(si); return Math.round(si.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)); });
  await dragEast(page, 'P', 1500);
  const p = await page.evaluate(() => ({ w: parseInt(document.getElementById('P').style.width), max: document.getElementById('P').style.maxWidth }));
  expect(p.w, `섹션 직속은 섹션 안쪽 폭(${secW}) 이하`).toBeLessThanOrEqual(secW);
  expect(p.max, '섹션 직속은 max-width 를 안 푼다').not.toBe('none');
  expect(errs).toEqual([]);
});

test('W3 옛 프로젝트 — 열면 그대로(이미 넓게 저장된 중첩 프레임도 부모 폭에 물린 채 · 만지기 전엔 안 바뀜)', async ({ page }) => {
  const errs = await scene(page, 'free');
  await page.evaluate(() => { const K = document.getElementById('K'); K.style.width = '900px'; K.dataset.width = '900'; });   // 옛 판 저장본 꼴(인라인 max-width:100% 그대로)
  const d = await page.evaluate(() => window.serializeProject());
  await page.evaluate(async (d) => { document.getElementById('canvas').innerHTML = ''; await window.applyProjectData(JSON.parse(d)); }, d);
  await page.waitForFunction(() => !!document.getElementById('K'));
  const r = await read(page);
  expect([r.Kw, r.KmaxW], '옛 저장본은 옛 모양(부모 폭에 물림 · max-width 100%)').toEqual([500, '100%']);
  expect(errs).toEqual([]);
});

test('W4 HTML 내보내기 — 넓힌 중첩 프레임은 화면과 같이 부모가 자른다', async ({ page }) => {
  const errs = await scene(page, 'free');
  await dragEast(page, 'K', 600);
  const live = await read(page);
  const r = await page.evaluate(async () => {
    window.getSelectedSection = () => document.querySelector('#canvas .section-block');
    const orig = URL.createObjectURL; let got = null;
    URL.createObjectURL = (b) => { got = b; return orig.call(URL, b); };
    try { await window.exportHTMLFile(); } finally { URL.createObjectURL = orig; }
    const fr = document.createElement('iframe'); fr.style.cssText = 'position:absolute;left:0;top:0;width:1200px;height:900px';
    document.body.appendChild(fr);
    const html = await got.text();
    await new Promise((res) => { fr.onload = res; fr.srcdoc = html; });
    const doc = fr.contentDocument, K = doc.getElementById('K'), P = doc.getElementById('P');
    const out = K && P ? { Kw: K.offsetWidth, Pw: P.offsetWidth, Pover: fr.contentWindow.getComputedStyle(P).overflow } : { missing: true, html: html.slice(0, 200) };
    fr.remove();
    return out;
  });
  console.log('[W4] ' + JSON.stringify({ live, r }));
  expect(r, '내보낸 HTML — 자식 폭·부모 폭·부모 자름이 화면과 같다').toEqual({ Kw: live.Kw, Pw: live.Pw, Pover: 'hidden' });
  expect(errs).toEqual([]);
});
