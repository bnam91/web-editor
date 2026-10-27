/* t4-07-radial-padx.dom.spec.js — t4-07 「좌우패딩기능 추가해줄 것」(Radial)
 *
 * ★원문(시트 t4-07 내용 칸) — 「좌우패딩기능 추가해줄 것」
 * ★잰 이(수지맥 · 앱 판 ca702d40) — 「Radial 패널(원·호 둘 다)에 좌우 패딩 칸 없음」.
 * ★처방 — 다른 블럭의 «좌우 패딩» 줄(그래프 prop-graph.js #grb-padx · 프레임 #ss-padx)과 같은 말·같은 꼴(슬라이더＋숫자).
 *   값 = dataset.padX(키 없으면 0 = 옛 블럭 무변화) · 그림 = 블럭 인라인 padding-left/right ·
 *   배치(radialLayoutOf)는 «쓸 수 있는 폭» = clientWidth − 2×padX 로 잰다(호는 그 폭에 맞춰 다시 맞춘다).
 *
 * ★칸(원 · 호 각각)
 *   P  전제 — 라디알이 섹션 흐름에 섰고 골랐다 · 처음엔 인라인 좌우 padding 0
 *   X1 패널 Layout 에 「좌우 패딩」 줄(슬라이더 ＋ 숫자)이 있다
 *   X2 숫자 칸에 60 ⇒ 블럭 계산된 padding-left/right 60px · 무대(.rdl-stage)가 블럭 안쪽 60px(×배율) 안에 든다 ·
 *      (호) 무대 폭 = 블럭 폭 − 120(레이아웃 px · 1px 안) · 다시 그려도(renderRadialBlock) 남는다
 *   X3 ⌘Z 한 번 ⇒ padding 0 으로 돌아온다
 * ⛔고정 대기 0 — 조건 대기만.
 * 실행: bash ~/taeyang-098/run-test.sh dom tests/dom/t4-07-radial-padx.dom.spec.js --workers=1
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');

for (const shape of ['circle', 'arc']) {
  test(`${shape} · P·X1·X2·X3 ★좌우 패딩`, async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 1000 });
    const errs = await bootApp(page);
    const id = await page.evaluate(async (shape) => {
      await window.addSection();
      window.addRadialBlock({ shape });
      const b = [...document.querySelectorAll('#canvas .radial-block')].pop();
      window.deselectAll?.();
      return b?.id || null;
    }, shape);
    expect(id, 'P 전제: 라디알이 섰다').toBeTruthy();
    const r = await waitStableRect(page, '#' + id);
    await page.mouse.click(r.cx, r.top + 6);
    await page.waitForFunction((id) => document.getElementById(id)?.classList.contains('selected') && !!document.querySelector('#panel-right .prop-section'), id, { timeout: 3000 });
    const g = (id) => page.evaluate((id) => {
      const b = document.getElementById(id); const cs = getComputedStyle(b);
      const br = b.getBoundingClientRect(); const z = br.width / b.offsetWidth;
      const st = b.querySelector('.rdl-stage').getBoundingClientRect();
      return { pl: parseFloat(cs.paddingLeft), pr: parseFloat(cs.paddingRight), z, bl: br.left, brr: br.right, bw: b.offsetWidth, sl: st.left, sr: st.right, sw: st.width / z };
    }, id);
    const g0 = await g(id);
    expect([g0.pl, g0.pr], 'P 전제: 처음 좌우 padding 0').toEqual([0, 0]);
    const num = await page.evaluate(() => {
      const row = [...document.querySelectorAll('#panel-right .prop-row')].find((x) => x.querySelector('.prop-label')?.textContent.trim() === '좌우 패딩');
      const n = row?.querySelector('input[type=number]'); const s = row?.querySelector('input[type=range]');
      if (!n || !s) return null;
      if (!n.id) n.id = '__padx_probe';
      return '#' + n.id;
    });
    expect(num, `X1 ${shape} 패널 「좌우 패딩」 줄(슬라이더＋숫자)`).not.toBeNull();
    await page.fill(num, '60');
    await page.press(num, 'Enter');
    await page.locator(num).blur();
    await page.waitForFunction((id) => parseFloat(getComputedStyle(document.getElementById(id)).paddingLeft) === 60, id, { timeout: 3000 });
    await waitStableRect(page, '#' + id + ' .rdl-stage');
    const g1 = await g(id);
    expect([g1.pl, g1.pr], 'X2 padding 60').toEqual([60, 60]);
    expect(g1.sl, `X2 무대 왼끝 ${g1.sl} ≥ 블럭 왼끝+60×배율 ${g1.bl + 60 * g1.z}`).toBeGreaterThanOrEqual(g1.bl + 60 * g1.z - 1);
    expect(g1.sr, `X2 무대 오른끝 ${g1.sr} ≤ 블럭 오른끝−60×배율 ${g1.brr - 60 * g1.z}`).toBeLessThanOrEqual(g1.brr - 60 * g1.z + 1);
    if (shape === 'arc') expect(Math.abs(g1.sw - (g1.bw - 120)), `X2 호 무대 폭 ${g1.sw} = 블럭 ${g1.bw} − 120`).toBeLessThan(1);
    await page.evaluate((id) => window.renderRadialBlock(document.getElementById(id)), id);
    expect((await g(id)).pl, 'X2 다시 그려도 남는다').toBe(60);
    await page.evaluate(() => document.activeElement?.blur?.());
    await page.keyboard.press('Meta+z');
    await page.waitForFunction((id) => parseFloat(getComputedStyle(document.getElementById(id)).paddingLeft) === 0, id, { timeout: 3000 });
    expect(errs).toEqual([]);
  });
}
