/* grid-fullbleed-no-padding.dom.spec.js — t2-08 ⓒ 바닥 + ⓐ(현빈 확정 2026-11-10)
 *   결함(수지맥 프로젝트 사본 실측 · 격리 앱 9440): 뚫을 패딩이 0 인 자리에서 「좌우 패딩 제외」를 켜면
 *     ⑶ 자유 프레임(831) 안 절대배치 그리드(747 · left 42) → (ⓒ 전) 폭 100% · left 42 그대로라 오른쪽이 프레임에 잘림
 *     ⑷ 둥근 자유 프레임 안 절대 row(fit-content) 안 그리드(737) → 737→608 로 줄어듦
 *   ⓒ(바닥): 정한 폭은 «실제로 펴질 때만» 뗀다. ⓐ: 자유 프레임 «직속» 그리드는 켜면 프레임 좌우 끝까지(정본 x·너비는 그대로 → 끄면 원래대로) ·
 *     펼 것이 없는 자리(패딩 0 흐름 · 프레임 안 row 안처럼 직속이 아니고 뚫을 패딩 0)는 스위치를 숨긴다(떠 있을 때와 같은 꼴).
 *   ★F3 기대가 ⓒ 에서 바뀐 근거: ⓒ 는 «잘림·줄어듦 0»(폭 747 유지)이 바닥이었고, 현빈이 ⓐ «프레임 안 = 프레임 폭»을 골랐다 — 잘림 0 은 여전히 단언한다(right ≤ 프레임 폭).
 *   픽스처 = 그 구조를 «흉내» 낸 합성(⛔실데이터 아님) — 섹션 2개(패딩 0 · 42), 프레임 2개, 그리드 5개.
 *   F3 ⓐ 켬 = 프레임 끝까지 · 끔 = 747·left 42 · 정본 무변 · F4 row 안 = 스위치 숨김 + 억지로 켜도 안 줄어듦(ⓒ) · H1 패딩 0 흐름 = 숨김 · P1 PNG 클론도 프레임 폭 · C1 [대조] 패딩 42 흐름 = 섹션 전폭(t2-08 A)
 * ★양성대조: js/blocks/grid-block.js renderGridBlock 의 «t2-08 ⓐ» 덩이(gridFreeFrameChild 분기)를 빼면 F3·P1 빨강 ·
 *   prop-grid.js 의 hideBleed 를 `floating` 으로 되돌리면 F4(숨김)·H1 빨강 · C1 초록. */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const COLS = [{ width: 1, lines: [{ type: 'body', text: '매일 선착순 쿠폰' }, { type: 'body', text: '오전 00시/10시/18시' }] }, { width: 1, lines: [{ type: 'body', text: '혜택 2' }] }];

async function setup(page) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  await bootApp(page);
  await page.evaluate((COLS) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', `
      <div class="section-block" id="s1" data-section="1"><div class="section-hitzone"></div>
        <div class="section-inner" data-padding-x="0" style="padding-left:0px;padding-right:0px">
          <div class="row" id="rZero" data-layout="stack"></div>
          <div class="gap-block" data-type="gap" style="height:40px"></div>
          <div class="frame-block" id="fr1" data-free-layout="true" data-width="831" data-height="900" data-pad-x="0" data-pad-y="0" data-radius="0"
               style="background:#6648aa;padding:0px;width:831px;max-width:100%;margin:0px auto;min-height:900px;height:900px;border-radius:0px;"></div>
          <div class="gap-block" data-type="gap" style="height:40px"></div>
        </div></div>
      <div class="section-block" id="s2" data-section="2"><div class="section-hitzone"></div>
        <div class="section-inner" data-padding-x="42" style="padding-left:42px;padding-right:42px">
          <div class="row" id="rFlow" data-layout="stack"></div>
          <div class="frame-block" id="fr2" data-free-layout="true" data-width="776" data-height="528" data-pad-y="0" data-radius="77"
               style="background:#f3f4f0;padding:0px;width:776px;max-width:100%;margin:0px auto;min-height:528px;height:528px;border-radius:77px;">
            <div class="row" id="rAbs" data-layout="stack" data-offset-x="20" data-offset-y="46" style="position:absolute;left:20px;top:46px;width:fit-content;"></div>
          </div>
        </div></div>`);
    const mk = (id, host) => { const { block: g } = window.makeGridBlock({ cols: COLS, rows: [{ height: 'auto' }] }); g.id = id; host.appendChild(g); return g; };
    const fr1 = document.getElementById('fr1');
    [['gA', 119], ['gB', 505]].forEach(([id, top]) => {
      const g = mk(id, fr1);
      g.dataset.offsetX = '42'; g.dataset.offsetY = String(top);
      g.style.position = 'absolute'; g.style.left = '42px'; g.style.top = top + 'px';
      g.dataset.fullBleed = 'false';
    });
    mk('gFlow', document.getElementById('rFlow'));
    mk('gZero', document.getElementById('rZero'));   // 수지 섹션01 흐름 그리드 꼴(패딩 0)
    mk('gRow', document.getElementById('rAbs'));
    window.rebindAll?.();
    for (const [id, w] of [['gA', 747], ['gB', 747], ['gFlow', 776], ['gRow', 737]]) { const g = document.getElementById(id); window.renderGridBlock(g); window.applyGridOwnWidth(g, w); }
  }, COLS);
}
const pick = (page, id) => page.evaluate((id) => { const g = document.getElementById(id); window.deselectAll?.(); window.selectBlock?.(g); window.showGridProperties(g); window.clearHistory?.(); }, id);
const toggleOff = (page) => page.evaluate(() => { const cb = document.getElementById('grd-use-padx'); cb.checked = false; cb.dispatchEvent(new Event('change', { bubbles: true })); });
const shown = (page) => page.evaluate(() => { const t = document.getElementById('grd-use-padx')?.closest('.prop-toggle'); return !!t && getComputedStyle(t).display !== 'none'; });
const toggleOn = (page) => page.evaluate(() => { const cb = document.getElementById('grd-use-padx'); cb.checked = true; cb.dispatchEvent(new Event('change', { bubbles: true })); });
/* ★배율 무관 값으로 잰다 — 캔버스 줌 아래 rect 는 배율이 곱해지고, 절대 자식의 rect 는 실앱에서 offsetLeft 와 갈린 적이 있다(t2-08 실측).
   프레임 안: offsetLeft/offsetWidth(offsetParent = 프레임) · 섹션 흐름: rect 차를 섹션 offsetWidth/rect 폭 비로 되돌린다. */
const box = (page, id) => page.evaluate((id) => {
  const g = document.getElementById(id), fr = g.closest('.frame-block');
  if (fr) { const op = g.offsetParent === fr ? 0 : g.offsetParent.offsetLeft;   // row 안이면 row 의 left 를 더한다
    const left = g.offsetLeft + op; return { w: g.offsetWidth, left, right: left + g.offsetWidth, hostW: fr.clientWidth, key: g.dataset.gridWidth ?? null, fb: g.dataset.fullBleed ?? null }; }
  const s = g.closest('.section-block'), a = g.getBoundingClientRect(), b = s.getBoundingClientRect(), k = s.offsetWidth / b.width;
  return { w: Math.round(a.width * k), left: Math.round((a.left - b.left) * k), right: Math.round((a.right - b.left) * k), hostW: s.offsetWidth, key: g.dataset.gridWidth ?? null, fb: g.dataset.fullBleed ?? null };
}, id);

test('F3 ⓐ 패딩 0 섹션 · 자유 프레임 안 절대 그리드(747 · left 42) → 켜면 프레임 좌우 끝까지 · 끄면 원래 x·너비 · 정본 무변', async ({ page }) => {
  await setup(page);
  const before = await box(page, 'gA');
  expect([before.w, before.left, before.key], '[전제] 747 · left 42').toEqual([747, 42, '747']);
  await pick(page, 'gA');
  expect(await shown(page), '★자유 프레임 안인데 스위치가 숨었다').toBe(true);
  await toggleOn(page);
  await page.evaluate(() => window.renderGridBlock(document.getElementById('gA')));   // 다시 그려도 유지
  const on = await box(page, 'gA');
  expect([on.left, on.w], `★프레임(${on.hostW}) 끝까지가 아니다`).toEqual([0, on.hostW]);
  expect(on.right, '잘림 0').toBeLessThanOrEqual(on.hostW);
  expect([on.key, await page.evaluate(() => document.getElementById('gA').dataset.offsetX)], '★정본(너비 키·x)을 건드렸다 — 끄면 못 돌아온다').toEqual(['747', '42']);
  await pick(page, 'gA');
  await toggleOff(page);
  expect(await box(page, 'gA'), '★끄면 원래 x·너비로 안 돌아왔다').toMatchObject({ w: 747, left: 42, key: '747', fb: 'false' });
  expect(await box(page, 'gB'), '이웃 그리드 무변').toMatchObject({ w: 747, left: 42, key: '747' });
});

test('F4 둥근 자유 프레임 안 절대 row 안 그리드(737) — 펼 것이 없다: 스위치 숨김 · 억지로 켜도 안 줄어든다(ⓒ 바닥)', async ({ page }) => {
  await setup(page);
  expect((await box(page, 'gRow')).w, '[전제] 737').toBe(737);
  await pick(page, 'gRow');
  expect(await shown(page), '★프레임 직속도 아니고 뚫을 패딩 0 인데 스위치가 보인다(눌러도 아무 일 없음)').toBe(false);
  await toggleOn(page);
  await page.evaluate(() => window.renderGridBlock(document.getElementById('gRow')));
  const after = await box(page, 'gRow');
  expect(after.key, '★정한 폭을 뗐다').toBe('737');
  expect(after.w, '★fit-content row 에 줄어들었다(실물 737→608)').toBe(737);
});

test('H1 패딩 0 섹션 흐름 그리드 — 뺄 패딩이 없다: 스위치 숨김(떠 있을 때와 같은 꼴)', async ({ page }) => {
  await setup(page);
  expect(await page.evaluate(() => window.effectiveSectionPadX(document.getElementById('gZero'))), '[전제] 뚫을 패딩 0').toBe(0);
  await pick(page, 'gZero');
  await expect(page.locator('#grd-use-padx')).toHaveCount(1);
  expect(await shown(page), '★뺄 패딩 0 인데 스위치가 보인다').toBe(false);
  expect(await page.evaluate(() => { const l = document.getElementById('grd-use-padx').closest('.prop-row').querySelector('.prop-label'); return getComputedStyle(l).display; }), '이름표도 같이 숨는다').toBe('none');
});

test('P1 ⓐ PNG 내보내기 클론도 프레임 폭 — 화면과 같다', async ({ page }) => {
  await setup(page);
  await pick(page, 'gA');
  await toggleOn(page);
  const r = await page.evaluate(async () => {
    const X = await import('/js/io/export-image.js');
    const sec = document.getElementById('s1');
    const clone = await X.prepareCloneForCapture(sec, sec.offsetWidth, true);   // 앱 PNG = 이 클론의 네이티브 스크린샷
    const g = clone.querySelector('#gA'), fr = clone.querySelector('#fr1');
    const out = { left: g.offsetLeft, w: g.offsetWidth, frW: fr.clientWidth };
    clone.remove();
    return out;
  });
  expect([r.left, r.w], `★PNG 클론의 그리드가 프레임(${r.frW}) 끝까지가 아니다`).toEqual([0, r.frW]);
});

test('C1 [대조] 패딩 42 섹션 흐름 그리드(776) → 예전처럼 너비 키 떼고 섹션 전폭', async ({ page }) => {
  /* ★전제 — 뺄 패딩 = 그린 패딩(42). 인텔 1차는 data-padding-x 없이 style 만 줘 코드가 문서 기본 padX 32 를 읽어 776+64=840 이 나왔다(픽스처 결함) */
  await setup(page);
  expect(await page.evaluate(() => window.effectiveSectionPadX(document.getElementById('gFlow')))).toBe(42);
  await pick(page, 'gFlow');
  await toggleOn(page);
  await page.evaluate(() => window.renderGridBlock(document.getElementById('gFlow')));
  const after = await box(page, 'gFlow');
  expect([after.key, after.fb]).toEqual([null, 'true']);
  expect(Math.abs(after.w - after.hostW), `폭 ${after.w} = 섹션 ${after.hostW}`).toBeLessThanOrEqual(1);
  expect(Math.abs(after.left)).toBeLessThanOrEqual(1);
});
