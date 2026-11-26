/* t13d-06 — 0.9.13 t13D-06 오버레이 블럭의 프레임 자식 편입 및 종속 이동(지디 승인 계획 ①~⑤ · 261121)
 * 고침: overlay-float.js floatHostOf — 오버레이의 «자리 주인» = posEl 바깥 첫 일반 프레임(없으면 섹션). enterFloat 은 그 주인에 남기고(좌표 = 주인 기준),
 *        끌기는 그 주인 안에서(탄성 · 가이드) · 프레임 안 오버레이는 섹션을 안 넘나든다. editor.js pasteClipboard 오버레이 갈래 — 섹션 오버레이를 «들어간» 프레임(_pasteTarget into)에 붙이면 프레임 안 오버레이(그 프레임 상자 안 자리).
 * G1 프레임 안 글자(두 번 눌러 고름)에 오버레이를 켜면 → 프레임 자식 그대로 · 오버레이 표식 · 화면 자리 그대로 · 주인 = 그 프레임
 * G2 프레임 안 오버레이 글을 끌면 프레임 안에서 옮고 · 프레임 밖까지 끌어도 프레임 자식 그대로(섹션으로 안 빠짐)
 * G3 프레임을 띄워(t13D-05) 끌면 프레임 안 오버레이 글도 같이(프레임 안 상대 자리 그대로)
 * G4 섹션 오버레이 글을 잘라(copySelected + ⌫) 프레임에 들어가(여백 두 번 클릭) 붙이면(pasteClipboard → _pasteTarget 실제 길) = 그 프레임 안 오버레이 · 프레임 안에 보임
 * G5 프레임 안 오버레이를 끄면 프레임 안 제자리로(섹션으로 안 감) · 자유배치 프레임이면 자유 자식(absolute)으로
 * G6 프레임을 ⌘↓ 로 순서 바꾸면(아래 글자 뒤로) 프레임 안 오버레이도 같이(자식 · 상대 자리 그대로)
 * ⛔⌘X/⌘V 실키 금지 — 사본 만드는 함수(copySelected)만 직접 부르고 지우기는 ⌫ · 붙이기 대상 결정부터는 제품 길(pasteClipboard).
 * 양성대조: _patches/t13d-06-CTL.patch(overlay-float.js 주인 = 늘 섹션 · floatHostOf 없음) → G1~G6 전부 빨강 · _patches/t13d-06-CTL-paste.patch(editor.js 붙이기 오버레이 갈래·방향키 주인 되돌림) → G4 만 빨강.
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitZoomSettled } = require('./_root-harness.js');

const raf = (p) => p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const rect = (page, sel) => page.evaluate((s) => { const q = document.querySelector(s).getBoundingClientRect(); return [q.left, q.top, q.width, q.height].map(Math.round); }, sel);

async function scene(page) {
  await page.setViewportSize({ width: 1600, height: 1300 });
  const errs = await bootApp(page);
  await page.evaluate(async () => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); await window.addSection();
    c.querySelector('.section-block').id = 'sV'; window.applyZoom?.(100);
  });
  await waitZoomSettled(page, 100);
  await page.evaluate(() => {
    const sec = document.getElementById('sV'), inner = sec.querySelector('.section-inner'); document.getElementById('canvas-wrap').scrollTop = 0; sec.scrollIntoView({ block: 'start' });
    [...inner.children].forEach((x) => { if (!x.classList.contains('drop-indicator')) x.remove(); });
    const fresh = (sel, fn) => { const before = new Set(sec.querySelectorAll(sel)); window.deselectAll(); window.selectSection(sec); fn(); return [...sec.querySelectorAll(sel)].find((x) => !before.has(x)); };
    const txt = (id, t) => { const tf = fresh('.frame-block[data-text-frame]', () => window.addTextBlock('body')); tf.id = id; const ed = tf.querySelector('[class^="tb-"]'); ed.textContent = t; delete ed.dataset.isPlaceholder; return tf; };
    const o = txt('tfS', '섹션 오버레이');   // 섹션 오버레이(오른쪽 위)
    o.style.width = '200px'; o.dataset.width = '200';
    const p = window.OverlayFloat.posElOf(o); window.OverlayFloat.enterFloat(p); p.style.left = '600px'; p.style.top = '10px'; p.dataset.offsetX = '600'; p.dataset.offsetY = '10';
    txt('tfA', '위 글자');
    const fr = fresh('.frame-block:not([data-text-frame])', () => window.addFrameBlock()); fr.id = 'frV';
    window.updateFrameBlock?.('frV', { width: 420, height: 220 });
    txt('tfB', '아래 글자');
    const kid = document.getElementById('tfB').cloneNode(true); kid.id = 'tfK'; kid.querySelectorAll('[id]').forEach((n) => n.removeAttribute('id'));
    kid.style.position = 'absolute'; kid.style.left = '30px'; kid.style.top = '30px'; kid.style.width = '150px'; kid.dataset.offsetX = '30'; kid.dataset.offsetY = '30';
    kid.querySelector('[class^="tb-"]').textContent = '프레임 자식'; fr.appendChild(kid);
    window.rebindAll?.(); window.deselectAll(); document.activeElement?.blur?.(); window.clearHistory?.();
  });
  await raf(page);
  const pre = await page.evaluate(() => ({ s: document.getElementById('tfS').dataset.overlayBlock, sPar: document.getElementById('tfS').parentElement.id, k: document.getElementById('tfK').parentElement.id }));
  expect(pre, '[전제] 섹션 오버레이 · 프레임 자식').toEqual({ s: 'true', sPar: 'sV', k: 'frV' });
  return errs;
}
const st = (page, id) => page.evaluate((id) => { const e = document.getElementById(id), f = document.getElementById('frV'), r = e.getBoundingClientRect(), fr = f.getBoundingClientRect();
  return { par: e.parentElement.id, ov: e.dataset.overlayBlock || null, host: window.OverlayFloat.floatHostOf(e)?.id || null, x: Math.round(r.left), y: Math.round(r.top), rel: [Math.round(r.left - fr.left), Math.round(r.top - fr.top)],
    inside: r.left >= fr.left - 1 && r.top >= fr.top - 1 && r.right <= fr.right + 1 && r.bottom <= fr.bottom + 1 }; }, id);
/* 프레임 안 글자 고르기 = 두 번 눌러 들어가 고름(사람 길) */
async function pickKid(page) {
  const [x, y, w, h] = await rect(page, '#tfK .text-block');
  await page.mouse.dblclick(x + w / 2, y + h / 2); await raf(page);
  expect(await page.evaluate(() => !!document.querySelector('#tfK .text-block.selected')), '[전제] 프레임 자식 글자를 골랐다').toBe(true);
}
async function toggleTxt(page) {
  const b = await page.evaluate(() => { const e = document.getElementById('txt-overlay-toggle'); if (!e) return null; e.scrollIntoView({ block: 'center' }); const q = e.getBoundingClientRect(); return [q.left + q.width / 2, q.top + q.height / 2]; });
  expect(b, '[전제] 글자 패널 오버레이 단추').toBeTruthy(); await page.mouse.click(b[0], b[1]); await raf(page);
}
async function drag(page, sel, dx, dy, at = 'mid') {
  const [x, y, w, h] = await rect(page, sel); const secB = await page.evaluate((s) => Math.round(document.querySelector(s).closest('.section-block').getBoundingClientRect().bottom), sel);
  const p = at === 'mid' ? [x + w / 2, y + h / 2] : [x + w - 25, Math.min(y + h - 25, secB - 10)];   // ★전제 바뀜(현빈 261123 Clip content 기본 켬) — 섹션 밖 몸통은 잘려 안 잡힘 ⇒ 'corner' 는 보이는 자리
  await page.mouse.move(p[0], p[1]); await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(p[0] + dx * i / 10, p[1] + dy * i / 10);
  await page.mouse.up(); await raf(page);
}

test('G1 프레임 안 글자 오버레이 켬 → 프레임 자식 그대로 · 화면 자리 그대로 · 주인 = 프레임', async ({ page }) => {
  const errs = await scene(page);
  const a = await st(page, 'tfK');
  await pickKid(page); await toggleTxt(page);
  const b = await st(page, 'tfK');
  expect([b.ov, b.par, b.host], '★오버레이 · 부모 = 프레임 · 주인 = 프레임').toEqual(['true', 'frV', 'frV']);
  expect([Math.abs(b.x - a.x) <= 1, Math.abs(b.y - a.y) <= 1], `★화면 자리 그대로 ${JSON.stringify([a, b])}`).toEqual([true, true]);
  expect(errs).toEqual([]);
});

test('G2 프레임 안 오버레이를 끌면 프레임 안에서 옮고 · 커서가 프레임 밖에서 놓으면 섹션 자식(화면 자리 그대로)', async ({ page }) => {
  const errs = await scene(page);
  await pickKid(page); await toggleTxt(page);
  const a = await st(page, 'tfK');
  await drag(page, '#tfK .text-block', 90, 60);
  const b = await st(page, 'tfK');
  expect([b.par, b.ov], '[전제] 그대로 프레임 안 오버레이').toEqual(['frV', 'true']);
  expect([Math.abs(b.rel[0] - a.rel[0] - 90) <= 10, Math.abs(b.rel[1] - a.rel[1] - 60) <= 10], `★프레임 안에서 끈 만큼(자석 ±10) ${JSON.stringify([a.rel, b.rel])}`).toEqual([true, true]);
  await drag(page, '#tfK .text-block', 700, 400);
  const c = await st(page, 'tfK');
  expect([c.par, c.host, c.ov], '★커서가 프레임 밖에서 놓음 → 섹션 자식 · 주인 = 섹션 · 떠 있음 그대로').toEqual(['sV', 'sV', 'true']);   // ★기대 바뀜: 현빈 261123 ⓐ «커서가 프레임 밖이면 섹션 자식으로 빠짐 / 안이면 걸쳐도 자식 유지»(옛 기대 = t13D-06 «프레임 안 오버레이는 섹션을 안 넘나든다» · 지디 승인 261121) — 커서 안 갈래는 아래 G2b
  expect(errs).toEqual([]);
});

test('G3 프레임을 띄워 끌면 프레임 안 오버레이 글도 같이(상대 자리 그대로)', async ({ page }) => {
  const errs = await scene(page);
  await pickKid(page); await toggleTxt(page);
  await page.evaluate(() => { window.deselectAll(); const f = document.getElementById('frV'); window.OverlayFloat.enterFloat(f); window.selectBlock?.('frV'); window.showHandlesFor?.(f); });
  await raf(page);
  const a = await st(page, 'tfK');
  const [x, y, w, h] = await rect(page, '#frV');
  const secB = await page.evaluate((id) => Math.round(document.getElementById(id).closest('.section-block').getBoundingClientRect().bottom), 'frV');
  await page.mouse.click(x + w - 25, Math.min(y + h - 25, secB - 10)); await raf(page);   // ★전제 바뀜(현빈 261123 Clip content 기본 켬) — 섹션 밖 몸통은 잘려 안 잡힘 ⇒ 보이는 자리 · 기대 무변
  await drag(page, '#frV', 150, 80, 'corner');
  const b = await st(page, 'tfK');
  expect([b.par, b.ov], '[전제] 프레임 안 오버레이 그대로').toEqual(['frV', 'true']);
  expect(b.rel, '★프레임 안 상대 자리 그대로').toEqual(a.rel);
  expect([Math.abs(b.x - a.x - 150) <= 10, Math.abs(b.y - a.y - 80) <= 10], `★화면에선 프레임과 같이 옮음 ${JSON.stringify([a, b])}`).toEqual([true, true]);
  expect(errs).toEqual([]);
});

test('G4 섹션 오버레이를 잘라 프레임에 들어가 붙이면 = 그 프레임 안 오버레이 · 프레임 안에 보임', async ({ page }) => {
  const errs = await scene(page);
  const [sx, sy, sw, sh] = await rect(page, '#tfS .text-block');
  await page.mouse.click(sx + sw / 2, sy + sh / 2); await raf(page);
  expect(await page.evaluate(() => !!document.querySelector('#tfS .text-block.selected')), '[전제] 섹션 오버레이 고름').toBe(true);
  await page.evaluate(() => window.copySelected());   // 사본 만드는 함수만 직접(⌘X 실키 금지) — 지우기는 아래 ⌫
  await page.keyboard.press('Backspace'); await raf(page);
  expect(await page.evaluate(() => !document.getElementById('tfS')), '[전제] 잘라냄(원본 지워짐)').toBe(true);
  const [x, y, w, h] = await rect(page, '#frV');
  await page.mouse.dblclick(x + w - 30, y + h - 30); await raf(page);   // 여백 두 번 클릭 = 프레임에 들어감(drag-utils.js _enteredFrame)
  expect(await page.evaluate(() => window._enteredFrame?.id), '[전제] 프레임에 들어갔다').toBe('frV');
  const before = await page.evaluate(() => [...document.querySelectorAll('#frV > .frame-block[data-text-frame]')].map((e) => e.id));
  await page.evaluate(() => window.pasteClipboard()); await raf(page);   // 붙이기 대상 결정(_pasteTarget)부터 제품 길
  const r = await page.evaluate((before) => { const f = document.getElementById('frV'); const n = [...f.querySelectorAll(':scope > .frame-block[data-text-frame]')].find((e) => !before.includes(e.id));
    if (!n) return null; const q = n.getBoundingClientRect(), fr = f.getBoundingClientRect();
    return { txt: n.querySelector('[class^="tb-"]').textContent, ov: n.dataset.overlayBlock || null, host: window.OverlayFloat.floatHostOf(n)?.id, ret: n.dataset.overlayReturnParent,
      inside: q.left >= fr.left - 1 && q.top >= fr.top - 1 && q.right <= fr.right + 1 && q.bottom <= fr.bottom + 1 }; }, before);
  expect(r, '★프레임 자식으로 붙었다').toBeTruthy();
  expect([r.txt, r.ov, r.host, r.ret], '★그 프레임 안 오버레이 · 해제 자리도 이 프레임').toEqual(['섹션 오버레이', 'true', 'frV', 'frV']);
  expect(r.inside, '★프레임 안에 보인다(섹션 좌표 600 을 들고 오지 않음)').toBe(true);
  expect(errs).toEqual([]);
});

test('G5 프레임 안 오버레이를 끄면 프레임 안 제자리로', async ({ page }) => {
  const errs = await scene(page);
  await pickKid(page); await toggleTxt(page);
  await pickKid(page); await toggleTxt(page);
  const b = await st(page, 'tfK');
  expect([b.ov, b.par], '★오버레이 풀림 · 부모 = 프레임(섹션으로 안 감)').toEqual([null, 'frV']);
  expect(await page.evaluate(() => getComputedStyle(document.getElementById('tfK')).position), '★자유배치 프레임이면 자유 자식(absolute)으로 남음 — 흐름으로 풀려 겹쳐 쌓이지 않음').toBe('absolute');
  expect(errs).toEqual([]);
});

test('G6 프레임을 ⌘↓ 로 순서 바꾸면 프레임 안 오버레이도 같이', async ({ page }) => {
  const errs = await scene(page);
  await pickKid(page); await toggleTxt(page);
  const a = await st(page, 'tfK');
  await page.evaluate(() => { window.deselectAll(); document.activeElement?.blur?.(); });
  const [x, y, w, h] = await rect(page, '#frV');
  await page.mouse.click(x + w - 30, y + h - 30); await raf(page);
  expect(await page.evaluate(() => document.getElementById('frV').classList.contains('selected')), '[전제] 프레임을 골랐다').toBe(true);
  const order = () => page.evaluate(() => { const f = document.getElementById('frV'); return [...f.parentElement.children].filter((e) => e.id && !e.classList.contains('drop-indicator')).map((e) => e.id); });
  const o0 = await order();
  await page.keyboard.press('Meta+ArrowDown'); await raf(page);
  const o1 = await order();
  expect(o1.indexOf('frV') > o1.indexOf('tfB') && o0.indexOf('frV') < o0.indexOf('tfB'), `★⌘↓ 로 아래 글자 뒤로 ${JSON.stringify([o0, o1])}`).toBe(true);
  const b = await st(page, 'tfK');
  expect([b.par, b.ov, b.host], '★안쪽 오버레이 = 그대로 프레임 자식').toEqual(['frV', 'true', 'frV']);
  expect(b.rel, '★프레임 안 상대 자리 그대로').toEqual(a.rel);
  expect(b.y > a.y, `★화면에선 프레임과 같이 아래로 ${a.y}→${b.y}`).toBe(true);
  expect(errs).toEqual([]);
});

/* G2b (현빈 261123 ⓐ «커서가 안이면 걸쳐도 프레임 자식 유지 + Clip 이면 잘림» — 일부러 잘려 보이게) — 글 상자를 프레임 오른쪽 가장자리 너머로 걸치게 끌되 커서는 프레임 안에서 놓음
 * 두 다리(frame-clip-axis-roster R2·R4): 내용 자르기 끔('false' = 넘친 몸이 보임) / 켬('true' = 잘림) — 둘 다 프레임 자식 유지 · 축 값이 먹었나를 computed overflow 로 전제 단언 */
for (const clipAttr of ['false', 'true']) {
  test(`G2b 커서가 프레임 안에서 놓으면 상자가 걸쳐도 프레임 자식 · 내용 자르기 ${clipAttr}`, async ({ page }) => {
    const errs = await scene(page);
    await page.evaluate((v) => { document.getElementById('frV').dataset.clipContent = v; }, clipAttr);
    const ov = await page.evaluate(() => getComputedStyle(document.getElementById('frV')).overflow);
    expect(ov, `[전제] 내용 자르기 ${clipAttr} 가 먹었다(computed overflow)`).toBe(clipAttr === 'true' ? 'hidden' : 'visible');
    await pickKid(page); await toggleTxt(page);
    const [fx, , fw] = await rect(page, '#frV');
    const [tx, ty, , th] = await rect(page, '#tfK .text-block');
    const gx = tx + 4, gy = ty + th / 2, target = fx + fw - 12;   // 글 상자 왼쪽 끝을 잡아 커서를 프레임 오른쪽 안쪽 12px 까지 → 상자 몸은 프레임 밖으로 걸침
    await page.mouse.move(gx, gy); await page.mouse.down(); await page.mouse.move((gx + target) / 2, gy, { steps: 8 }); await page.mouse.move(target, gy, { steps: 8 }); await page.mouse.up(); await raf(page);
    const c = await st(page, 'tfK');
    console.log(`[G2b ${clipAttr} 실측]`, JSON.stringify({ c, ov, target }));
    expect([c.par, c.host, c.ov], '★커서가 프레임 안 → 걸쳐도 프레임 자식 · 주인 = 프레임').toEqual(['frV', 'frV', 'true']);
    expect(c.inside, '★상자는 프레임 밖으로 걸침(잘림 여부는 위 전제 overflow — 켬이면 잘려 보임 · 끔이면 넘친 몸이 보임)').toBe(false);
    expect(errs).toEqual([]);
  });
}

/* G7 (현빈 261123 ⓐ «섹션 사이 이동도 같은 규칙» · Figma 실측 MIKASA-hbqa 12) — 프레임 안 오버레이 글을 «다른 섹션 위»에서 놓으면 그 섹션 자식(떠 있음 · 놓기 직전 화면 자리 그대로)
 * 커서가 프레임을 벗어나면 끌기가 섹션 끌기로 바뀌어 상자가 커서를 따라간다(overlay-float.js onMove · 프레임 가장자리에 묶이지 않음) */
test('G7 프레임 안 오버레이를 다른 섹션 위에서 놓음 → 그 섹션 자식 · 떠 있음 · 자리 그대로', async ({ page }) => {
  const errs = await scene(page);
  await page.evaluate(async () => { const s2 = await window.addSection(); s2.id = 'sW2'; s2.style.minHeight = '300px'; document.getElementById('sV').scrollIntoView({ block: 'start' }); });
  await raf(page);
  await pickKid(page); await toggleTxt(page);
  const [tx, ty, , th] = await rect(page, '#tfK .text-block');
  const [qx, qy] = await page.evaluate(() => { const r = document.getElementById('sW2').getBoundingClientRect(); return [r.left + 200, r.top + 60]; });
  const vh = await page.evaluate(() => window.innerHeight);
  const gx = tx + 6, gy = ty + th / 2;
  await page.mouse.move(gx, gy); await page.mouse.down(); await page.mouse.move((gx + qx) / 2, (gy + qy) / 2, { steps: 10 }); await page.mouse.move(qx, qy, { steps: 10 });
  const up = await st(page, 'tfK');
  await page.mouse.up(); await raf(page);
  const c = await st(page, 'tfK');
  console.log('[G7 실측]', JSON.stringify({ up, c, q: [qx, qy], vh }));
  expect(qy < vh - 120, `[전제] 놓는 점이 화면 안쪽(가장자리 저절로 스크롤 막기) ${qy}/${vh}`).toBe(true);
  expect([c.par, c.host, c.ov], '★다른 섹션(sW2) 위에서 놓음 → sW2 자식 · 주인 = sW2 · 떠 있음').toEqual(['sW2', 'sW2', 'true']);
  expect([c.x, c.y], '★놓기 직전 화면 자리 그대로').toEqual([up.x, up.y]);
  expect(Math.abs(up.y - (qy - th / 2)) < 60, `★상자가 커서를 따라감(프레임 가장자리에 안 묶임) 상자 y ${up.y} · 커서 y ${qy}`).toBe(true);
  expect(errs).toEqual([]);
});

/* ★157 t13D-06 마감 ◑(지디 261125 · 아이맥 GRADE-0913close-4 CUT · 판 dev 1cd189937) — 메뉴 «편집›오려두기»(Electron role cut = 네이티브 cut 사건만) 무반응 → ⌘X 와 같은 한 벌(_appCut)
 * G8 섹션 오버레이 고름 → 메뉴 오려두기(document 에 cut 사건) = 원본 사라짐 · 이력 한 칸 · ⌘Z 한 번 = 제자리 · 다시 오려두기 → 프레임에 들어가 메뉴 붙여넣기(paste 사건) = 그 프레임 안 오버레이(티켓 1~3 길 전부 메뉴로)
 *    [지킴] ⌘X 키 길 = 한 번만 지움(뒤따르는 네이티브 cut 이 «한 번 더» 안 함 · _keyCutAt) */
const menuCut = (page) => page.evaluate(() => { const ev = new ClipboardEvent('cut', { clipboardData: new DataTransfer(), bubbles: true, cancelable: true }); document.dispatchEvent(ev); return ev.defaultPrevented; });
const menuPaste = (page) => page.evaluate(() => { document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: new DataTransfer(), bubbles: true, cancelable: true })); });
test('G8 (157) 메뉴 오려두기 = 잘라냄 · ⌘Z 한 칸 · 프레임에 들어가 메뉴 붙여넣기 = 그 프레임 안 오버레이 · [지킴] ⌘X 한 번만', async ({ page }) => {
  const errs = await scene(page);
  const pick = async () => { const [sx, sy, sw, sh] = await rect(page, '#tfS .text-block'); await page.mouse.click(sx + sw / 2, sy + sh / 2); await raf(page);
    expect(await page.evaluate(() => !!document.querySelector('#tfS .text-block.selected')), '[전제] 섹션 오버레이 고름').toBe(true); await page.evaluate(() => document.activeElement?.blur?.()); };
  await pick();
  const tip0 = await page.evaluate(() => window.getHistoryTip?.()?.pos ?? null);
  const took = await menuCut(page); await raf(page);
  const c1 = await page.evaluate(() => ({ gone: !document.getElementById('tfS'), tip: window.getHistoryTip?.()?.pos ?? null }));
  await page.keyboard.press('Meta+z'); await raf(page);
  const back = await page.evaluate(() => !!document.getElementById('tfS'));
  console.log('[G8 실측]', JSON.stringify({ took, tip0, c1, back }));
  expect([took, c1.gone], '★메뉴 오려두기 = 사건을 받음 · 원본 사라짐').toEqual([true, true]);
  expect(c1.tip, '★이력 한 칸').toBe(tip0 + 1);
  expect(back, '★⌘Z 한 번 = 제자리').toBe(true);
  await pick(); await menuCut(page); await raf(page);
  expect(await page.evaluate(() => !document.getElementById('tfS')), '[전제] 다시 잘라냄').toBe(true);
  const [x, y, w, h] = await rect(page, '#frV');
  await page.mouse.dblclick(x + w - 30, y + h - 30); await raf(page);
  expect(await page.evaluate(() => window._enteredFrame?.id), '[전제] 프레임에 들어갔다').toBe('frV');
  const before = await page.evaluate(() => [...document.querySelectorAll('#frV > .frame-block[data-text-frame]')].map((e) => e.id));
  await page.evaluate(() => document.activeElement?.blur?.());
  await menuPaste(page);
  await page.waitForFunction((before) => [...document.querySelectorAll('#frV > .frame-block[data-text-frame]')].some((e) => !before.includes(e.id)), before, { timeout: 3000 });
  const r = await page.evaluate((before) => { const n = [...document.querySelectorAll('#frV > .frame-block[data-text-frame]')].find((e) => !before.includes(e.id)); return { txt: n.querySelector('[class^="tb-"]').textContent, ov: n.dataset.overlayBlock || null, host: window.OverlayFloat.floatHostOf(n)?.id }; }, before);
  expect(r, '★메뉴 붙여넣기 = 그 프레임 안 오버레이(잘라낸 글)').toEqual({ txt: '섹션 오버레이', ov: 'true', host: 'frV' });
  // [지킴] ⌘X 키 길 — 한 번만(키 길 뒤 네이티브 cut 이 와도 두 번 안 지움)
  await page.evaluate(() => { window.deselectAll(); }); const [ax, ay, aw, ah] = await rect(page, '#tfA .text-block'); await page.mouse.click(ax + aw / 2, ay + ah / 2); await raf(page);
  await page.evaluate(() => document.activeElement?.blur?.());
  const n0 = await page.evaluate(() => document.querySelectorAll('#sV .frame-block[data-text-frame]').length);
  await page.keyboard.press('Meta+x'); await menuCut(page); await raf(page);
  const n1 = await page.evaluate(() => document.querySelectorAll('#sV .frame-block[data-text-frame]').length);
  expect([n0 - n1, await page.evaluate(() => !document.getElementById('tfA'))], '★⌘X = 한 블럭만 · 뒤따른 cut 사건은 건너뜀').toEqual([1, true]);
  expect(errs).toEqual([]);
});

/* G9 (지디 261126 유닛 D12 빨강 실측) — ⌘X·메뉴 오려두기 둘 다 «이동»: 섹션을 잘라도 링크 처분(SPLink.releaseSectionsForDelete)을 안 지난다 · refLinks 토큰 그대로 되돌아옴
 *   [양성] Delete 는 처분을 지난다(같은 섹션 · 같은 자리) */
test('G9 (157·D12) 섹션 ⌘X·메뉴 오려두기 = 링크 처분 0 · [양성] Delete = 처분 1', async ({ page }) => {
  const errs = await scene(page);
  await page.evaluate(() => {
    window.__rel = 0; const L = window.SPLink; const orig = L.releaseSectionsForDelete;
    L.releaseSectionsForDelete = (...a) => { window.__rel++; return orig.apply(L, a); };
  });
  const pickSec = () => page.evaluate(() => { const s = document.getElementById('sV'); s.dataset.refLinks = 'sp_g9:0'; window.deselectAll(); window.selectSection(s); document.activeElement?.blur?.(); });
  const st = () => page.evaluate(() => ({ gone: !document.getElementById('sV'), rel: window.__rel, tok: document.getElementById('sV')?.dataset.refLinks ?? null }));
  // 메뉴 길 먼저 — ⌘X 키 길 뒤 500ms 안의 cut 사건은 «방금 키로 했음»이라 건너뛴다(editor.js cut 처리기 · 고정 대기 대신 순서로)
  await pickSec(); await menuCut(page); await raf(page); const m = await st();
  await page.keyboard.press('Meta+z'); await raf(page);
  await pickSec(); await page.keyboard.press('Meta+x'); await raf(page); const k = await st();
  await page.keyboard.press('Meta+z'); await raf(page); const kb = await st();
  await pickSec(); await page.keyboard.press('Delete'); await raf(page); const d = await st();
  console.log('[G9 실측]', JSON.stringify({ k, kb, m, d }));
  expect([k.gone, k.rel], '★⌘X = 섹션 잘림 · 링크 처분 0').toEqual([true, 0]);
  expect(kb.tok, '★⌘Z 뒤 refLinks 토큰 그대로').toBe('sp_g9:0');
  expect([m.gone, m.rel], '★메뉴 오려두기 = 섹션 잘림 · 링크 처분 0').toEqual([true, 0]);
  expect([d.gone, d.rel > 0], '[양성] Delete = 처분을 지난다').toEqual([true, true]);
  expect(errs, errs.join(' | ')).toEqual([]);
});

