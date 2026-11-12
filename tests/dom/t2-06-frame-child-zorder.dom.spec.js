/* t2-06-frame-child-zorder.dom.spec.js — 프레임 안 글자 블럭 ⌘[ ⌘] (0.9.12 t2-06 · 현빈)
 * 뿌리: moveSelectedBlocks 흐름 갈래 getUnit 이 closest('.row') 를 «먼저» 봤다. 템플릿으로 넣은 프레임은 section-inner > .row > 프레임
 *   (js/panels/template-system.js) ⇒ 쌓기 프레임 안 글자가 «바깥 row»(프레임 통째)를 단위로 집어, 글자 대신 프레임이 옮겨지거나(위에 형제가 있으면)
 *   아무 일도 안 했다. 고침 = row·글상자 중 «가까운 쪽».
 * 칸: A 템플릿꼴 쌓기 프레임 안 형제 · B 중첩(쌓기 안 쌓기) · C 대조 = 같은 꼴 자유 프레임(겹침 갈래라 원래 됨) · D 대조 = 섹션 직속 글자(원래 됨)
 *   각 칸: 진짜 클릭으로 고르고 진짜 키 → 같은 부모 안 순서 뒤집힘 · 프레임은 제자리 · 레이어 패널 순서도 뒤집힘 · ⌘Z 한 번 = 원래 · 저장 왕복 뒤 유지.
 * 양성대조: js/editor.js getUnit 한 줄을 (b.closest('.row') || b.closest('.frame-block[data-text-frame]')) 로 되돌리면 A·B 빨강 · C·D 초록.
 * ⛔고정 대기 없음 · ⛔앱 무접촉(_root-harness.bootApp) · 픽스처 = 글 든 블럭 여럿 + 구분선.
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

/* kind: 'stack' | 'nested' | 'free' | 'section'. 돌려줌 = { a, b, frame, outer } (a 가 b 앞 형제) */
async function scene(page, kind) {
  await page.setViewportSize({ width: 1700, height: 1300 });
  const errs = await bootApp(page);
  const ids = await page.evaluate(async (kind) => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach((s) => s.remove());
    await window.addSection();
    const sec = c.querySelector('.section-block'), inner = sec.querySelector(':scope > .section-inner') || sec;
    const text = (s) => { window.deselectAll(); window._activeFrame = null; window.selectSection(sec); const before = new Set(sec.querySelectorAll('.text-block')); window.addTextBlock('body', { content: s }); return [...sec.querySelectorAll('.text-block')].find((x) => !before.has(x)); };
    window.deselectAll(); window.selectSection(sec); await window.addDividerBlock();   // 위 형제 — 옛 결함이면 프레임이 이 위로 올라간다
    if (kind === 'section') { const a = text('첫째 문단 — 섹션 직속'), b = text('둘째 문단 — 섹션 직속'); window.deselectAll(); return { a: a.id, b: b.id }; }
    const mkFrame = (free) => { window.deselectAll(); window._activeFrame = null; window.selectSection(sec); const old = new Set(sec.querySelectorAll('.frame-block')); window.addFrameBlock({ bg: '#f3efe6' });
      const f = [...sec.querySelectorAll('.frame-block')].find((x) => !old.has(x));
      if (!free) { delete f.dataset.freeLayout; delete f.dataset.height; f.dataset.fullWidth = 'true'; f.style.removeProperty('height'); f.style.removeProperty('min-height'); f.style.width = '100%'; f.style.position = ''; }
      return f; };
    const inRow = (f) => { const r = document.createElement('div'); r.className = 'row'; r.id = 'row_t206' + Math.random().toString(36).slice(2, 6); r.dataset.layout = 'stack'; inner.appendChild(r); r.appendChild(f); return r; };   // 템플릿 넣기와 같은 꼴(template-system.js)
    const put = (f, tb, free, top) => { const tf = tb.closest('.frame-block[data-text-frame]'); f.appendChild(tf); if (free) { tf.style.position = 'absolute'; tf.style.left = '40px'; tf.style.top = top + 'px'; } return tb; };
    const free = kind === 'free';
    const f = mkFrame(free); inRow(f);
    let host = f, outer = null;
    if (kind === 'nested') { put(f, text('바깥 프레임 머리글'), false, 0); const g = mkFrame(false); f.appendChild(g); host = g; outer = f.id; }
    const a = put(host, text('첫째 문단 — 프레임 안 형제'), free, 30), b = put(host, text('둘째 문단 — 프레임 안 형제'), free, 140);
    put(host, text('셋째 문단 — 프레임 안 형제'), free, 250);
    window.deselectAll(); window._activeFrame = null; window.buildLayerPanel?.(); window.clearHistory?.();
    return { a: a.id, b: b.id, frame: host.id, outer };
  }, kind);
  return { errs, ...ids };
}
const twoFrames = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
/* B안: 한 번 클릭으로 안 골라지면 더블클릭으로 한 겹씩 들어간다(중첩은 두 번) */
async function pick(page, id) {
  for (let i = 0; i < 4; i++) {
    if (await page.evaluate((id) => document.getElementById(id).classList.contains('selected'), id)) return;
    const loc = page.locator('#' + id); await loc.scrollIntoViewIfNeeded(); const r = await loc.boundingBox();
    if (i === 0) await page.mouse.click(r.x + r.width / 2, r.y + r.height / 2); else await page.mouse.dblclick(r.x + r.width / 2, r.y + r.height / 2);
    await twoFrames(page);
  }
  await page.waitForFunction((id) => document.getElementById(id).classList.contains('selected') && !document.querySelector('.text-block.editing'), id);
}
/* b 의 단위가 a 의 단위보다 «앞» 형제인가 + 같은 부모인가 */
const bFirst = (page, a, b) => page.evaluate(([a, b]) => { const u = (id) => document.getElementById(id).closest('.frame-block[data-text-frame]'); const ua = u(a), ub = u(b);
  return ua.parentElement === ub.parentElement ? !!(ub.compareDocumentPosition(ua) & Node.DOCUMENT_POSITION_FOLLOWING) : 'parent-split'; }, [a, b]);
const layerBFirst = (page, a, b) => page.evaluate(([a, b]) => { window.buildLayerPanel?.(); const la = document.getElementById(a)._layerItem, lb = document.getElementById(b)._layerItem;
  return la && lb ? !!(lb.compareDocumentPosition(la) & Node.DOCUMENT_POSITION_FOLLOWING) : 'no-layer-item'; }, [a, b]);
const framePlace = (page, f) => page.evaluate((f) => { if (!f) return null; let u = document.getElementById(f); if (u.parentElement.classList.contains('row')) u = u.parentElement; return [u.parentElement.id || u.parentElement.className, [...u.parentElement.children].indexOf(u)]; }, f);
async function reopen(page) { await page.evaluate(() => { const d = JSON.parse(window.serializeProject()); document.getElementById('canvas').innerHTML = ''; window.applyProjectData(d); window.clearHistory?.(); }); await twoFrames(page); }

for (const kind of ['stack', 'nested', 'free', 'section']) {
  test(`${kind} — ⌘[ 가 같은 부모 안에서 둘째를 첫째 앞으로 · 프레임 제자리 · 레이어 패널 반영 · ⌘Z 한 번 · 저장 왕복 유지 · ⌘] 로 돌아온다`, async ({ page }) => {
    test.setTimeout(60000);
    const { errs, a, b, frame, outer } = await scene(page, kind);
    expect(a && b, '[전제] 글 든 형제 둘').toBeTruthy();
    expect(await bFirst(page, a, b), '[전제] 첫째가 앞').toBe(false);
    expect(await layerBFirst(page, a, b), '[전제] 레이어 패널도 첫째가 앞').toBe(false);
    const f0 = await framePlace(page, frame), o0 = await framePlace(page, outer);
    await pick(page, b);
    await page.keyboard.press('Meta+BracketLeft');
    await expect.poll(() => bFirst(page, a, b), '⌘[ 뒤 둘째가 첫째 앞(같은 부모)').toBe(true);
    expect(await framePlace(page, frame), '프레임은 제자리(통째로 안 옮겨짐)').toEqual(f0);
    expect(await framePlace(page, outer), '바깥 프레임도 제자리').toEqual(o0);
    expect(await page.evaluate((id) => document.getElementById(id).classList.contains('selected'), b), '선택 유지').toBe(true);
    expect(await layerBFirst(page, a, b), '레이어 패널 순서도 뒤집힘').toBe(true);
    await page.keyboard.press('Meta+z');
    await expect.poll(() => bFirst(page, a, b), '⌘Z 한 번에 원래 순서').toBe(false);
    await page.keyboard.press('Meta+Shift+z');
    await expect.poll(() => bFirst(page, a, b), '다시 하기').toBe(true);
    await reopen(page);
    expect(await bFirst(page, a, b), '저장 왕복(serializeProject → applyProjectData) 뒤에도 순서 유지').toBe(true);
    await pick(page, b);
    await page.keyboard.press('Meta+BracketRight');
    await expect.poll(() => bFirst(page, a, b), '⌘] 로 다시 뒤로').toBe(false);
    expect(errs.filter((e) => !e.includes('electronAPI'))).toEqual([]);
  });
}
