/* section-clip-content — 0.9.13 t13E-07 · 현빈 결정 261123(handoff/SPEC-section-clip-like-figma-261123.md 결정 로그) · 태양
 *   D-1 «Clip content» 켬(= 옛 «섹션 밖 보이기» 꺼짐 = data-overflow-visible 없음 · 새 섹션 기본)이면 편집 캔버스에서도 섹션 밖을 자른다 — 떠 있는 단위 포함(09-20 뒤집음)
 *       고른 단위의 손잡이·선택 테두리는 섹션 밖 층(#ss-handles-overlay)이라 잘려도 보이고 잡힌다(Figma 꼴)
 *   D-2 내보내기(PNG)는 토글과 상관없이 늘 섹션 크기
 *   D-3 패널 = Layout 절 맨 아래 «Clip content» 체크(체크 = 자름 · 저장 키는 옛 data-overflow-visible 그대로 · 체크 = !그 값)
 * C1 켬(기본) · 섹션 아래로 반쯤 나간 떠 있는 글 → 섹션 안 점 = 글 · 섹션 밖 점 = 글 아님(잘림) · 고르면 섹션 밖 아래 손잡이가 보이고 맨 위에서 잡힘
 * C2 패널 체크 끔 → 섹션 밖 점 = 글(보임) · 다시 켬 → 잘림 · ⌘Z 한 번 = 끈 상태로 되돌림
 * C3 PNG — 켬·끔 둘 다 높이 = 섹션 높이(넘친 부분 안 담김)
 * C4 ★현빈 261123 E: 새 섹션 = 체크 꺼짐(밖 보임 · 저장 키 data-overflow-visible="true" 를 얹음) · 키 없는 옛 저장본은 저장·다시 열기 뒤에도 체크(자름) 그대로 · 키 켜진 옛 저장본 = 체크 꺼짐 · 자리 = Layout 절 맨 아래 · 이름 «Clip content»
 * 양성대조: _patches/section-clip-CTL.patch(오버레이 크롭 CSS 두 줄 걷음) ⇒ C1 빨강.
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitZoomSettled } = require('./_root-harness.js');
const raf = (p) => p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
async function wireCdp(page) {
  const cdp = await page.context().newCDPSession(page);
  await page.exposeFunction('__cdpShot', async ({ x = 0, y = 0, width, height, scale = 1 }) => (await cdp.send('Page.captureScreenshot', {
    format: 'png', clip: { x: Math.round(x), y: Math.round(y), width: Math.ceil(width), height: Math.ceil(height), scale: scale > 0 && scale <= 4 ? scale : 1 },
    captureBeyondViewport: true, fromSurface: true })).data);
  await page.evaluate(() => { const real = window.electronAPI; window.electronAPI = new Proxy({}, { get: (t, k) => (k === 'captureSectionCdp' ? (o) => window.__cdpShot(o) : real?.[k]) }); });
}

async function scene(page) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page); await wireCdp(page);
  const ids = await page.evaluate(async () => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    const s1 = await window.addSection(); s1.id = 'sC'; s1.style.backgroundColor = '#ffffff'; delete s1.dataset.overflowVisible;   // ★전제 바뀜(현빈 261123 E — 새 섹션 기본 끔): C1~C3 은 «켬»을 재는 칸이라 켠 섹션(키 없음 = 옛 저장본 꼴)에서
    const s2 = await window.addSection(); s2.id = 'sN'; s2.style.backgroundColor = '#dddddd';
    window.applyZoom?.(100);
    window.deselectAll(); window.selectSection(s1); window.addTextBlock('h1');
    const tf = s1.querySelector('.frame-block[data-text-frame]'); const tb = tf.querySelector('.text-block'); tb.id = 'tbC';
    const ed = tb.querySelector('[class^="tb-"]'); if (ed) { ed.textContent = 'CLIP TEST'; ed.style.color = '#ff0000'; delete ed.dataset.isPlaceholder; }
    const m = await import(new URL('js/overlay-float.js', document.baseURI).href); m.enterFloat(tf);
    m._applyOverlayPos(tf, 120, s1.offsetHeight - Math.round(tf.offsetHeight / 2));   // 아래 반이 섹션 밖
    window.deselectAll(); window.clearHistory?.();
    return { tf: tf.id, tb: tb.id };
  });
  await waitZoomSettled(page, 100);
  await raf(page);
  return { errs, ids };
}
/* 떠 있는 글 상자에서 섹션 안 점·밖 점 하나씩 — 그 점의 임자가 글인가(clip-path 는 잘린 자리를 맞힘에서도 뺀다) */
const probe = (page, tfId) => page.evaluate((tfId) => {
  const tf = document.getElementById(tfId), s = document.getElementById('sC'), sr = s.getBoundingClientRect(), r = tf.getBoundingClientRect();
  const x = r.left + Math.min(30, r.width / 2);
  const hit = (y) => !!document.elementFromPoint(x, y)?.closest?.('.frame-block[data-text-frame]');
  return { inside: hit(sr.bottom - 4), outside: hit(Math.min(r.bottom - 3, sr.bottom + 8)), clip: tf.style.getPropertyValue('--sec-clip') || null };
}, tfId);
const showPanel = (page) => page.evaluate(() => { window.deselectAll(); window.selectSection(document.getElementById('sC')); window.showSectionProperties(document.getElementById('sC')); });

test('C1 켬(기본) — 섹션 밖은 잘림 · 고르면 밖 손잡이는 보이고 잡힘', async ({ page }) => {
  const { errs, ids } = await scene(page);
  const a = await probe(page, ids.tf);
  await page.evaluate((id) => { window.selectBlock(id); window.showHandlesFor?.(document.getElementById(id)); }, ids.tb); await raf(page);
  const h = await page.evaluate(() => {
    const sr = document.getElementById('sC').getBoundingClientRect();
    const hs = [...document.querySelectorAll('#ss-handles-overlay [data-tf-resize-dir="se"], #ss-handles-overlay [data-tbx-dir="s"]')].filter((x) => getComputedStyle(x).display !== 'none');
    const out = hs.find((x) => x.getBoundingClientRect().top > sr.bottom);
    if (!out) return { outHandle: false };
    const r = out.getBoundingClientRect(), top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return { outHandle: true, grabbable: top === out };
  });
  const b = await probe(page, ids.tf);
  if (process.env.SHOT_CLIP) await page.screenshot({ path: `${process.env.SHOT_CLIP}/C1-clip-on-selected.png`, clip: { x: 0, y: 0, width: 1500, height: 700 } });
  console.log('[C1 실측]', JSON.stringify({ a, h, b }));
  expect({ inside: a.inside, outside: a.outside }, '★켬 = 섹션 안 보임 · 밖 잘림').toEqual({ inside: true, outside: false });
  expect(h, '★고른 채 = 섹션 밖 손잡이 보이고 맨 위(잡힘)').toEqual({ outHandle: true, grabbable: true });
  expect(b.outside, '★고른 채로도 내용은 잘림(Figma)').toBe(false);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('C2 패널 체크 끔 → 밖 보임 · 켬 → 잘림 · ⌘Z 한 번', async ({ page }) => {
  const { errs, ids } = await scene(page);
  await showPanel(page);
  await page.click('label.prop-toggle:has(#sec-clip-content)'); await raf(page);
  const off = { ...(await probe(page, ids.tf)), key: await page.evaluate(() => document.getElementById('sC').dataset.overflowVisible ?? null) };
  await page.click('label.prop-toggle:has(#sec-clip-content)'); await raf(page);
  const on = { ...(await probe(page, ids.tf)), key: await page.evaluate(() => document.getElementById('sC').dataset.overflowVisible ?? null) };
  await page.evaluate(() => window.undo()); await raf(page);
  const undone = { ...(await probe(page, ids.tf)), key: await page.evaluate(() => document.getElementById('sC').dataset.overflowVisible ?? null) };
  console.log('[C2 실측]', JSON.stringify({ off, on, undone }));
  expect([off.outside, off.key], '★체크 끔 = 밖 보임 · 저장 키 켜짐').toEqual([true, 'true']);
  expect([on.outside, on.key], '★다시 켬 = 잘림 · 키 없음').toEqual([false, null]);
  expect([undone.outside, undone.key], '★⌘Z 한 번 = 끈 상태').toEqual([true, 'true']);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('C3 PNG — 켬·끔 둘 다 섹션 높이', async ({ page }) => {
  const { errs } = await scene(page);
  const png = () => page.evaluate(async () => { const s = document.getElementById('sC'); const r = await window.__exportGate.captureTruth(s, 860, window.__exportGate.sectionBgColor(s)); return { h: r.canvas.height, w: r.canvas.width, secH: s.offsetHeight, secW: s.offsetWidth }; });
  const on = await png();
  await page.evaluate(() => { document.getElementById('sC').dataset.overflowVisible = 'true'; });
  const off = await png();
  console.log('[C3 실측]', JSON.stringify({ on, off }));
  for (const [k, r] of [['켬', on], ['끔', off]]) expect(Math.abs(r.h / r.w - r.secH / r.secW) < 0.01, `★${k} PNG 비율 = 섹션(${r.w}×${r.h} · 섹션 ${r.secW}×${r.secH})`).toBe(true);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('C4 새 섹션 = 체크 · 옛 저장본(키 켜짐) = 체크 꺼짐 · Layout 절 맨 아래 «Clip content»', async ({ page }) => {
  const { errs } = await scene(page);
  await page.evaluate(() => { const n = document.getElementById('sN'); window.deselectAll(); window.selectSection(n); window.showSectionProperties(n); });   // ★전제 바뀜(현빈 261123 E): «새 섹션» = 장면이 손대지 않은 sN(sC 는 C1~C3 위해 켬)
  const fresh = await page.evaluate(() => { const c = document.getElementById('sec-clip-content'); const sec = c.closest('[data-sec]') || c.closest('.prop-section'); const rows = [...sec.querySelectorAll('.prop-row, .prop-align-group')];
    return { checked: c.checked, label: c.closest('.prop-row').querySelector('.prop-label')?.textContent.trim(), toggle: !!c.closest('label.prop-toggle')?.querySelector('.prop-toggle-track'), key: document.getElementById('sN').dataset.overflowVisible ?? null, inLayout: ['layout', 'size', 'padding'].includes(sec.dataset.sec),   /* ★기대 바뀜(섹션 보강 · 현빈 261123 · v117a) — Clip 줄 = Layout 묶음(layout·size·padding) «맨 아래» = padding 절 끝(자리만 · 극성·기본값 무변) */ last: rows[rows.length - 1] === c.closest('.prop-row'), oldId: !!document.getElementById('sec-overflow-visible') }; });   // ★기대 바뀜(현빈 261123 «체크박스 → 공용 토글 스위치» label.prop-toggle) — 이름은 줄 라벨 · 스위치 꼴
  if (process.env.SHOT_CLIP) await page.screenshot({ path: `${process.env.SHOT_CLIP}/C4-panel-clip-content.png` });
  await page.evaluate(() => { const s = document.getElementById('sC'); s.dataset.overflowVisible = 'true'; window.showSectionProperties(s); });
  const old = await page.evaluate(() => document.getElementById('sec-clip-content').checked);
  console.log('[C4 실측]', JSON.stringify({ fresh, old }));
  expect(fresh, '★새 섹션(sN) = 꺼짐(밖 보임) · 공용 토글 스위치 · 키 켜짐 · Layout 맨 아래 · 이름').toEqual({ checked: false, label: 'Clip content', toggle: true, key: 'true', inLayout: true, last: true, oldId: false });   // ★기대 바뀜(현빈 261123 E — 앞 D-3 «기본 켬» 뒤집음)
  expect(old, '★옛 저장본(키 켜짐) = 체크 꺼짐').toBe(false);
  const rt = {}; rt.key = await page.evaluate(async () => { delete document.getElementById('sC').dataset.overflowVisible; const snap = window.serializeProject(); await window.applyProjectData(typeof snap === 'string' ? JSON.parse(snap) : snap); for (let i = 0; i < 50 && !document.getElementById('sC'); i++) await new Promise((r) => requestAnimationFrame(r)); const s = document.getElementById('sC'); window.deselectAll(); window.selectSection(s); window.showSectionProperties(s); return s.dataset.overflowVisible ?? null; }); await page.waitForFunction(() => !!document.getElementById('sec-clip-content'), null, { timeout: 5000 }); rt.checked = await page.evaluate(() => document.getElementById('sec-clip-content').checked); rt.newKey = await page.evaluate(async () => (await window.addSection())?.dataset?.overflowVisible ?? null);
  expect(rt, '★키 없는 옛 저장본 = 저장·다시 열기 뒤에도 자름(체크) 그대로 · 그 뒤 새로 만든 섹션만 키 켜짐(현빈 261123 E · 옛 저장본은 저장된 그대로)').toEqual({ key: null, checked: true, newKey: 'true' });
  expect(errs, errs.join(' | ')).toEqual([]);
});
