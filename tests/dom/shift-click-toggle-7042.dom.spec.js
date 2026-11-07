/* shift-click-toggle-7042 — 현빈 7042 「피그마식으로 가자」: 블럭 ⇧클릭 = ⌘클릭(넣고 빼기). ⇧ 범위선택은 없앴다.
 * 결함(MARK-MULTISELECT-PICKS-UNSELECTED-MIDDLE-01): 마킹 a·b·c 에서 a 클릭 → c ⇧클릭이 DOM 순서로 사이 b 까지 골라 셋이 같이 움직였다.
 * 칸: 마킹 배치 셋(가로 한 줄 · b 가 아래로 빠짐 · b 가 바깥 오른끝) × ⇧ — a·c 만 골라지고 a·c 만 움직인다 · 고른 것을 ⇧클릭하면 빠진다.
 *     섹션 흐름 글자 셋 · 자유 프레임 자식 셋도 같다(자유 프레임은 B안대로 더블클릭 진입 뒤).
 * 음성대조: 같은 칸을 ⌘ 로 — 결과가 같다(⌘ 는 그대로 산다). 진짜 마우스 · 장면 준비만 evaluate.
 * 양성대조: 블럭 click 의 ⇧ 갈래를 옛 rangeSelectBlocks 로 되돌리면 «b 안 골라짐»·«b 안 움직임» 칸이 빨강(재현 프로브 hotfix-mark zz-probe-mark-multisel). */
const { test, expect } = require('@playwright/test');
const { bootApp, waitZoomSettled } = require('./_root-harness.js');
const raf = (p) => p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

const SEC = `<div class="section-block" id="sA" data-section="1" data-name="sA" data-bg="#fff" style="background:#fff;">
  <div class="section-hitzone"><span class="section-label">sA</span></div>
  <div class="section-inner" style="padding-left:32px;padding-right:32px;">${['tA', 'tB', 'tC'].map((id) => `<div class="frame-block" id="f${id}" data-text-frame="true"><div class="text-block" id="${id}" data-type="body"><div class="tb-body" contenteditable="false">글자 ${id}</div></div></div>`).join('')}<div class="gap-block" data-type="gap" style="height:460px"></div></div></div>`;

async function boot(page) {
  await page.setViewportSize({ width: 1700, height: 1300 });
  const errs = await bootApp(page);
  await page.evaluate((html) => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    c.insertAdjacentHTML('beforeend', html); window.rebindAll?.(); window.deselectAll?.(); window.applyZoom?.(100); }, SEC);
  await waitZoomSettled(page, 100);
  await page.evaluate(() => { document.getElementById('canvas-wrap').scrollTop = 0; document.getElementById('sA').scrollIntoView({ block: 'start' }); });
  return errs;
}
/* 마킹(번호 스티커) a·b·c — DOM 순서는 늘 a, b, c. 배치만 바꾼다(옛 범위는 DOM 순서라 셋 다 b 를 끌어들였다). */
const LAYOUTS = { '가로 한 줄': [[120, 200], [320, 200], [520, 200]], 'b 가 아래로 빠짐': [[120, 160], [320, 380], [520, 160]], 'b 가 바깥 오른끝': [[120, 200], [760, 200], [440, 200]] };
async function marks(page, lay) {
  await page.evaluate((lay) => { const sec = document.getElementById('sA');
    ['a', 'b', 'c'].forEach((id, i) => { window.deselectAll?.(); window.selectSection?.(sec); const before = new Set(sec.querySelectorAll(':scope > .sticker-block'));
      window.addStickerBlock({ count: String(i + 1), x: lay[i][0], y: lay[i][1] }); const b = [...sec.querySelectorAll(':scope > .sticker-block')].find((x) => !before.has(x)); b.id = id; });
    window.deselectAll?.(); document.activeElement?.blur?.(); }, lay);
  await raf(page);
}
/* 자유 프레임 F 안 에셋 a·b·c — 좌표로 나란히. 다시 열어 실제 저장본과 같은 묶기로 시작한다. */
async function freeKids(page) {
  await page.evaluate(() => { const sec = document.getElementById('sA'); window.deselectAll(); window.selectSection(sec); window._activeFrame = null;
    const FR = '.frame-block:not([data-text-frame])'; const b0 = new Set(sec.querySelectorAll(FR)); window.addFrameBlock(); const F = [...sec.querySelectorAll(FR)].find((x) => !b0.has(x)); F.id = 'F';
    window.updateFrameBlock('F', { width: 900, height: 300 });
    ['a', 'b', 'c'].forEach((id, i) => { window.deselectAll(); window.selectSection(sec); window._activeFrame = F; const bs = new Set(F.querySelectorAll('.asset-block')); window.addAssetBlock();
      const e = [...F.querySelectorAll('.asset-block')].find((x) => !bs.has(x)); e.id = id; let u = e; while (u.parentElement !== F) u = u.parentElement;
      e.style.width = '200px'; e.style.height = '160px'; u.style.position = 'absolute';   // 기본 에셋(796×780)은 프레임 밖으로 넘쳐 서로 겹친다
       u.style.left = (20 + i * 300) + 'px'; u.style.top = '30px'; u.dataset.offsetX = String(20 + i * 300); u.dataset.offsetY = '30'; });
    window.deselectAll(); window._activeFrame = null;
    const d = JSON.parse(window.serializeProject()); document.getElementById('canvas').innerHTML = ''; window.applyProjectData(d); window.clearHistory?.(); window.deselectAll?.(); });
  await raf(page);
  await page.evaluate(() => document.getElementById('F').scrollIntoView({ block: 'center' })); await raf(page);
}
const sel = (page, ids) => page.evaluate((ids) => ids.filter((i) => document.getElementById(i).classList.contains('selected')), ids);
const center = (page, id) => page.evaluate((id) => { const r = document.getElementById(id).getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, id);
const xy = (page, ids) => page.evaluate((ids) => ids.map((i) => { const r = document.getElementById(i).getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top)]; }), ids);
async function clickOn(page, id, { mod, dbl } = {}) { const [x, y] = await center(page, id); if (mod) await page.keyboard.down(mod); if (dbl) await page.mouse.dblclick(x, y); else await page.mouse.click(x, y); if (mod) await page.keyboard.up(mod); await raf(page); }
async function drag(page, id, dx, dy) { const [x, y] = await center(page, id); await page.mouse.move(x, y); await page.mouse.down();
  for (let s = 1; s <= 10; s++) { await page.mouse.move(x + dx * s / 10, y + dy * s / 10); await raf(page); } await page.mouse.up(); await raf(page); }
const movedOf = (a, b) => ['a', 'b', 'c'].filter((_, i) => a[i][0] !== b[i][0] || a[i][1] !== b[i][1]).join('');

for (const mod of ['Shift', 'Meta']) {
  const tag = mod === 'Shift' ? '⇧' : '⌘(음성대조)';
  for (const [lname, lay] of Object.entries(LAYOUTS)) {
    test(`마킹 ${lname} · ${tag} — a 클릭 → c ${tag}클릭 = a·c 만, 끌면 a·c 만 움직인다`, async ({ page }) => {
      const errs = await boot(page); await marks(page, lay);
      await clickOn(page, 'a'); await clickOn(page, 'c', { mod });
      expect(await sel(page, ['a', 'b', 'c']), '사이 b 는 안 골라진다').toEqual(['a', 'c']);
      const p0 = await xy(page, ['a', 'b', 'c']);
      await drag(page, 'a', 60, 40);
      expect(movedOf(p0, await xy(page, ['a', 'b', 'c'])), '움직인 것').toBe('ac');
      expect(errs, errs.join(' | ')).toEqual([]);
    });
  }
  test(`마킹 · ${tag} — 고른 것을 다시 ${tag}클릭하면 빠진다`, async ({ page }) => {
    const errs = await boot(page); await marks(page, LAYOUTS['가로 한 줄']);
    await clickOn(page, 'a'); await clickOn(page, 'c', { mod });
    expect(await sel(page, ['a', 'b', 'c']), '[전제]').toEqual(['a', 'c']);
    await clickOn(page, 'c', { mod });
    expect(await sel(page, ['a', 'b', 'c']), 'c 가 빠진다').toEqual(['a']);
    await clickOn(page, 'a', { mod });
    expect(await sel(page, ['a', 'b', 'c']), 'a 도 빠진다').toEqual([]);
    expect(errs, errs.join(' | ')).toEqual([]);
  });
  test(`섹션 흐름 글자 · ${tag} — tA 클릭 → tC ${tag}클릭 = tA·tC 만 · 다시 누르면 빠진다`, async ({ page }) => {
    const errs = await boot(page);
    await clickOn(page, 'tA'); await clickOn(page, 'tC', { mod });
    expect(await sel(page, ['tA', 'tB', 'tC']), '사이 tB 는 안 골라진다').toEqual(['tA', 'tC']);
    await clickOn(page, 'tC', { mod });
    expect(await sel(page, ['tA', 'tB', 'tC']), 'tC 가 빠진다').toEqual(['tA']);
    expect(errs, errs.join(' | ')).toEqual([]);
  });
  test(`자유 프레임 자식 · ${tag} — a 더블클릭 진입 → c ${tag}클릭 = a·c 만 · 다시 누르면 빠진다 · 끌어도 b 는 제자리`, async ({ page }) => {
    const errs = await boot(page); await freeKids(page);
    await clickOn(page, 'a', { dbl: true });   // B안: 자식은 더블클릭으로 진입·선택
    expect(await sel(page, ['a', 'b', 'c']), '[전제] a 고름').toEqual(['a']);
    await clickOn(page, 'c', { mod });
    expect(await sel(page, ['a', 'b', 'c']), '사이 b 는 안 골라진다').toEqual(['a', 'c']);
    await clickOn(page, 'c', { mod });
    expect(await sel(page, ['a', 'b', 'c']), 'c 가 빠진다').toEqual(['a']);
    await clickOn(page, 'c', { mod });
    expect(await sel(page, ['a', 'b', 'c']), '다시 넣으면 a·c').toEqual(['a', 'c']);
    const p0 = await xy(page, ['a', 'b', 'c']);
    await drag(page, 'a', 40, 30);
    /* 이 결함의 뜻 = «안 고른 b 는 안 움직인다». ⚠️자유 프레임 «블럭» 자식은 여럿 골라도 누른 것만 끌린다 — ⌘ 로도 · B안 전 코드(29eb047ca)로도 같다(별건, 7042 범위 밖) ⇒ c 가 따라오는지는 여기서 안 잰다. */
    const mv = movedOf(p0, await xy(page, ['a', 'b', 'c']));
    expect(mv, '누른 a 는 움직인다').toContain('a'); expect(mv, '안 고른 b 는 안 움직인다').not.toContain('b');
    expect(errs, errs.join(' | ')).toEqual([]);
  });
}
