/* t13d-01 — 0.9.13 t13D-01 방향키(현빈 결정 261120 · 지디 추천 ①~⑥)
 *   좌표 있는 것(오버레이·자유배치 자식) = 밀기 유지(↑↓←→ 1px · ⇧ 10px) · 흐름 블럭 = ⇧↑↓ 섹션 안 이전/다음 고르기(끝↔처음 순환) · ←→ 무동작 ·
 *   갭 = ↑↓ 높이 ±4(⇧ 큰 단계 걷음) · 글 편집 중 무시.
 * K1 흐름 셋(글·갭·글) — 첫 글 고름 → ⇧↓ 갭 → ⇧↓ 셋째 → ⇧↓ 첫째(순환) → ⇧↑ 셋째(역순환)
 * K2 흐름 글 ←→ = 고름·자리 무변
 * K3 글 편집 중 ⇧↓ = 무시(그 글이 계속 편집 중 · 고름 안 바뀜)
 * K4 ★갭 ↑ = 높이 +4 · ↓ = −4 · ⇧↑ = 높이 무변 + 고르기만 옮김 (고침 전 판 9a724fb78 에서 이 칸 먼저 돌려 «죽은 길» 확인 — 지디 261120)
 * K5 섹션 오버레이 글 → = offsetX +1 · ⇧→ = +10 · ⇧↓ = offsetY +10(흐름 고르기 아님)
 * 양성대조: _patches/t13d-01-CTL-flowsel.patch(⇧↑↓ 흐름 고르기 부름 뺌 → K1 빨강) · _patches/t13d-01-CTL-gapfall.patch(갭 넘김 뺌 → K4 빨강) · _patches/t13d-01-CTL-overlay.patch(오버레이 밀기 대상 뺌 → K5 빨강)
 * 대기는 조건으로만 · 키는 진짜 키보드(page.keyboard).
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitZoomSettled } = require('./_root-harness.js');

async function scene(page) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  const ids = await page.evaluate(async () => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); await window.addSection();
    const sec = c.querySelector('.section-block'); sec.id = 'sK';
    const inner = sec.querySelector('.section-inner'); [...inner.children].forEach((x) => { if (!x.classList.contains('drop-indicator')) x.remove(); });
    const add = (fn) => { const before = new Set([...inner.children]); window.deselectAll(); window.selectSection(sec); fn(); return [...inner.children].find((x) => !before.has(x)); };
    const u1 = add(() => window.addTextBlock('body')); u1.id ||= 'u1';
    const u2 = add(() => window.addGapBlock(40)); u2.id ||= 'u2';
    const u3 = add(() => window.addTextBlock('body')); u3.id ||= 'u3';
    const t1 = u1.querySelector('.text-block'), t3 = u3.querySelector('.text-block');
    /* DIAG2(인텔 261121 K1·K4 ×3): 넣은 순서가 [글·글·갭]으로 떨어졌다(갭이 끝) — 장면 전제가 «셋»만 보고 «순서»를 안 봤다.
       넣기 자리는 이 칸의 주제가 아니다 ⇒ 순서를 손으로 세우고 아래 [전제]로 잠근다(넣은 그대로의 순서는 natural 로 찍어 둔다). */
    const natural = [...inner.children].filter((x) => x.id && !x.classList.contains('drop-indicator')).map((x) => x.id);
    inner.append(u1, u2, u3);
    window.deselectAll(); window.clearHistory?.();
    return { t1: t1.id, gap: u2.id, t3: t3.id, u: [u1.id, u2.id, u3.id], natural, units: [...inner.children].filter((x) => x.id && !x.classList.contains('drop-indicator')).map((x) => x.id) };
  });
  await waitZoomSettled(page, await page.evaluate(() => window.currentZoom));
  expect(ids.units, `[전제] 흐름 단위 순서 = 글·갭·글 (넣은 그대로 ${JSON.stringify(ids.natural)})`).toEqual(ids.u);
  return { errs, ids };
}
/* DIAG(인텔 261120 K1·K4 3/3: ⇧↓ 이 갭이 아니라 «다른 글»로) — 섹션 직속 단위 순서·고름 사슬을 실패 메시지에 */
const diag = (page) => page.evaluate(() => { const inner = document.querySelector('#sK .section-inner'); return { units: [...inner.children].map((x) => `${x.id}:${x.className.split(' ')[0]}${x.dataset.overlayBlock ? ':ov' : ''}:${getComputedStyle(x).position}`), sel: [...document.querySelectorAll('#canvas .selected')].map((x) => `${x.id}:${x.className.split(' ')[0]}`), deep: (window.__deepestCanvasSelection?.() || {}).id || null }; });
const selId = (page) => page.evaluate(() => { const s = [...document.querySelectorAll('#canvas .selected')].filter((x) => !x.classList.contains('section-block')); return s.length ? s[s.length - 1].id : null; });
const pick = async (page, id) => { await page.evaluate((id) => { window.selectBlock(id); window.showHandlesFor?.(document.getElementById(id)); document.activeElement?.blur?.(); }, id); await expect.poll(() => selId(page)).toBe(id); };

test('K1 흐름 ⇧↓ 이전/다음 · 끝↔처음 순환 · ⇧↑ 역순', async ({ page }) => {
  const { errs, ids } = await scene(page);
  await pick(page, ids.t1);
  const dg0 = await diag(page);
  await page.keyboard.press('Shift+ArrowDown'); await expect.poll(() => selId(page), { message: `★⇧↓ = 갭 · 앞 ${JSON.stringify(dg0)} · 뒤 ${JSON.stringify(await diag(page))}`, timeout: 2000 }).toBe(ids.gap);
  await page.keyboard.press('Shift+ArrowDown'); await expect.poll(() => selId(page), '★⇧↓ = 셋째 글').toBe(ids.t3);
  await page.keyboard.press('Shift+ArrowDown'); await expect.poll(() => selId(page), '★끝에서 ⇧↓ = 처음(순환)').toBe(ids.t1);
  await page.keyboard.press('Shift+ArrowUp'); await expect.poll(() => selId(page), '★처음에서 ⇧↑ = 끝(순환)').toBe(ids.t3);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('K2 흐름 글 ←→ = 고름·자리 무변', async ({ page }) => {
  const { errs, ids } = await scene(page);
  await pick(page, ids.t1);
  const r0 = await page.evaluate((id) => { const b = document.getElementById(id).getBoundingClientRect(); return [b.left, b.top]; }, ids.t1);
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowLeft');
  expect(await selId(page), '★고름 그대로').toBe(ids.t1);
  const r1 = await page.evaluate((id) => { const b = document.getElementById(id).getBoundingClientRect(); return [b.left, b.top]; }, ids.t1);
  expect(r1, '★자리 무변').toEqual(r0);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('K3 글 편집 중 ⇧↓ = 무시', async ({ page }) => {
  const { errs, ids } = await scene(page);
  await pick(page, ids.t1);
  await page.evaluate((id) => { const tb = document.getElementById(id); tb.classList.add('editing'); const ed = tb.querySelector('[contenteditable]') || tb.querySelector('[class^="tb-"]'); ed.setAttribute('contenteditable', 'true'); ed.focus(); }, ids.t1);
  await page.keyboard.press('Shift+ArrowDown');
  expect(await selId(page), '★편집 중엔 고름이 안 옮겨 간다').toBe(ids.t1);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('K4 갭 ↑↓ = 높이 ±4 · ⇧↑ = 높이 무변 + 고르기만', async ({ page }) => {
  const { errs, ids } = await scene(page);
  await pick(page, ids.gap);
  const h = () => page.evaluate((id) => document.getElementById(id).offsetHeight, ids.gap);
  const h0 = await h();
  expect(await page.evaluate(() => [...document.querySelectorAll('.gap-preset-btn.active')].map((b) => b.dataset.h)), `[전제] 패널 프리셋 불 = 옛 높이 칸(${h0}) — 없으면 아래 «불 꺼짐» 단언이 죽은 줄`).toEqual([String(h0)]);
  await page.keyboard.press('ArrowUp'); await expect.poll(h, '★↑ = +4(고침 전 판에서 빨강이면 «죽은 길» 확정)').toBe(h0 + 4);
  expect(await page.evaluate(() => [...document.querySelectorAll('.gap-preset-btn.active')].map((b) => b.dataset.h)), '★프리셋 불 = 높이와 같은 칸만(44 = 없음 · 실물 png 에서 40 이 켜진 채였다)').toEqual([]);
  await page.keyboard.press('ArrowDown'); await expect.poll(h, '★↓ = −4').toBe(h0);
  const dg4 = await diag(page);
  await page.keyboard.press('Shift+ArrowUp'); await expect.poll(() => selId(page), { message: `★⇧↑ = 고르기 이동(위 글) · 앞 ${JSON.stringify(dg4)} · 뒤 ${JSON.stringify(await diag(page))}`, timeout: 2000 }).toBe(ids.t1);
  expect(await h(), '★⇧↑ 는 높이 무변(큰 단계 걷음)').toBe(h0);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('K5 섹션 오버레이 글 → +1 · ⇧→ +10 · ⇧↓ = 밀기(고르기 아님)', async ({ page }) => {
  const { errs, ids } = await scene(page);
  const p = await page.evaluate((id) => { const tf = document.getElementById(id).closest('.frame-block[data-text-frame]'); const pe = window.OverlayFloat.posElOf(tf); window.OverlayFloat.enterFloat(pe);
    pe.style.left = '30px'; pe.style.top = '30px'; pe.dataset.offsetX = '30'; pe.dataset.offsetY = '30'; return pe.id; }, ids.t3);
  expect(await page.evaluate((id) => document.getElementById(id).dataset.overlayBlock, p), '[전제] 오버레이').toBe('true');
  await pick(page, ids.t3);
  const off = () => page.evaluate((id) => { const e = document.getElementById(id); return [e.dataset.offsetX, e.dataset.offsetY]; }, p);
  await page.keyboard.press('ArrowRight'); await expect.poll(off, '★→ = x +1').toEqual(['31', '30']);
  await page.keyboard.press('Shift+ArrowRight'); await expect.poll(off, '★⇧→ = x +10').toEqual(['41', '30']);
  await page.keyboard.press('Shift+ArrowDown'); await expect.poll(off, '★⇧↓ = y +10(오버레이는 밀기)').toEqual(['41', '40']);
  expect(await selId(page), '★고름 그대로').toBe(ids.t3);
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* K6 (현빈 9510 QA 198 4-b · 0.9.13 HBQA) — 흐름 제목에서 «바로» ⇧↓ → 이웃 «프레임»이 골라진다(옛: getBlockById 가 프레임을 못 잡아 무동작 · 미카사 실앱은 ⇧↑ 로 갭에서 시작해 이 칸을 직접 못 봤다)
 * 제목 → ⇧↓ 흐름 프레임(프레임 고름 = 레이어 프레임 줄 누름과 같은 길 · _activeFrame) → ⇧↑ 제목 → ⇧↓ 프레임 → ⇧↓ 흐름 도형(래퍼 = 안 도형 고름)
 * 양성대조: _patches/hbqa-198-CTL.patch(editor.js _selectFlowSibling 의 프레임 갈래 걷음) ⇒ K6 빨강 */
test('K6 (198) 제목 ⇧↓ = 이웃 프레임 · ⇧↑ 제목 · 다음 = 도형(래퍼 안 도형)', async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  const ids = await page.evaluate(async () => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); await window.addSection();
    const sec = c.querySelector('.section-block'); sec.id = 'sK6';
    const inner = sec.querySelector('.section-inner'); [...inner.children].forEach((x) => { if (!x.classList.contains('drop-indicator')) x.remove(); });
    const add = (fn) => { const before = new Set([...inner.children]); window.deselectAll(); window.selectSection(sec); fn(); return [...inner.children].find((x) => !before.has(x)); };
    const u1 = add(() => window.addTextBlock('h2')); u1.id ||= 'k6u1';
    const fr = add(() => window.addFrameBlock()); fr.id ||= 'k6fr';
    const sw = add(() => window.addShapeBlock('rectangle')); sw.id ||= 'k6sw';
    inner.append(u1, fr, sw);
    window.deselectAll(); window.clearHistory?.();
    const sb = sw.querySelector('.shape-block');
    return { t1: u1.querySelector('.text-block').id, fr: fr.id, sb: sb?.id ?? null, frIsFrame: fr.matches('.frame-block:not([data-text-frame])'), swIsShapeFrame: !!sb && sb.parentElement === sw };
  });
  await waitZoomSettled(page, await page.evaluate(() => window.currentZoom));
  expect([ids.frIsFrame, ids.swIsShapeFrame], '[전제] 둘째 = 흐름 프레임 · 셋째 = 도형 래퍼').toEqual([true, true]);
  await pick(page, ids.t1);
  await page.keyboard.press('Shift+ArrowDown'); await expect.poll(() => selId(page), { message: '★제목 ⇧↓ = 이웃 프레임(옛 = 무동작)', timeout: 2000 }).toBe(ids.fr);
  expect(await page.evaluate(() => window._activeFrame?.id ?? null), '★프레임 고름 = 활성 프레임').toBe(ids.fr);
  await page.keyboard.press('Shift+ArrowUp'); await expect.poll(() => selId(page), '★프레임에서 ⇧↑ = 제목').toBe(ids.t1);
  await page.keyboard.press('Shift+ArrowDown'); await expect.poll(() => selId(page), '★다시 ⇧↓ = 프레임').toBe(ids.fr);
  await page.keyboard.press('Shift+ArrowDown'); await expect.poll(() => selId(page), '★다음 = 도형(래퍼 안 도형)').toBe(ids.sb);
  /* ⛔도형에서 ⇧↓ 는 여기서 안 잰다 — 이 가지(11a67a399)는 흐름 도형 래퍼 안 도형을 «밀기 대상»으로 잡아(197 4-a) ⇧↓ 가 10px 밀기가 된다 · 그 고침은 ial 가지 aacbf8402(두 벌 고침 금지 · 지디) · 지킴 = ial-0913b I7 */
  expect(errs, errs.join(' | ')).toEqual([]);
});
