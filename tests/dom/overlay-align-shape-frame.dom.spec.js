/* overlay-align-shape-frame.dom.spec.js — 현빈 2026-10-01 「sec_ts0he_pg899sy: 오버레이 글자(tb_ts0he_mio7m0f)와 원 도형을
 *   복수선택 → 정렬 버튼 → ss_ts0he_m7bkzk1(원의 프레임)과 shp_ts0he_xv6u0kn(원)이 분리됐다」
 * 원인(7699ea33): 옛 «자유배치 다중선택» 정렬이 원(프레임 안 absolute)을 «그 자체»로 움직였다 — 섹션 좌표(글자 프레임)와
 *   프레임 안 좌표(원)를 한 상자로 맞춰, 원만 프레임 안에서 밀려나 갈라졌다. A2(06ec2c59)의 «오버레이끼리 정렬»은 단위를
 *   «떠 있는 프레임»으로 잡아서 원을 프레임째 옮긴다.
 * 고정 데이터 = 현빈 저장본 «사본»의 두 오버레이 그대로(원은 갈라지기 전 자리 0,0 으로 되돌림).
 * ★양성대조 판 7699ea33 → 빨강: P1(⌘클릭) P2(⇧클릭) / ⌘Z 는 두 판 다 됨 — 현빈이 본 「⌘Z 안 됨」은 이 하네스에서 재현 못 함. */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const OV = `<div class="frame-block" id="ss_ts0he_m7bkzk1" data-bg="" data-free-layout="true" data-width="214" data-height="214" data-pad-y="0" data-layer-name="ellipse" style="padding: 0px; width: 214px; max-width: none; margin-top: 0px; margin-bottom: 0px; min-height: 214px; height: 214px; align-self: center; flex-shrink: 0; position: absolute; left: 293px; top: 180px;" draggable="false" data-overlay-return-parent="anchor_ts0he_3lv0xqr" data-overlay-return-after="row_ts0he_uw57r4p" data-offset-x="293" data-offset-y="180" data-overlay-block="true" data-sel-variant="sticker"><div class="shape-block" data-type="shape" data-shape-type="ellipse" data-shape-color="#cccccc" data-shape-stroke-width="0" id="shp_ts0he_xv6u0kn" style="position: absolute; left: 0px; top: 0px;" data-sel-variant="sticker" data-offset-x="0" data-offset-y="0"><svg class="shape-svg" viewBox="0 0 100 100" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg" style="color:#cccccc;stroke-width:0;fill:currentColor;stroke:currentColor;"><ellipse cx="50" cy="50" rx="50" ry="50"></ellipse></svg></div></div>
<div class="frame-block" id="ss_ts0he_64z04f8" data-text-frame="true" data-bg="transparent" style="background: transparent; width: 133px; box-sizing: border-box; max-width: 100%; position: absolute; left: 196px; top: 273px; align-self: center;" data-overlay-return-parent="anchor_ts0he_3lv0xqr" data-overlay-return-after="row_ts0he_uw57r4p" data-width="133" data-overlay-introduced-width="true" data-overlay-frozen-width="716px" data-offset-x="196" data-offset-y="273" data-overlay-block="true" data-sel-variant="sticker"><div class="text-block" data-type="body" id="tb_ts0he_mio7m0f">
    <div class="tb-body" style="font-family: Pretendard, sans-serif; text-align: center;" data-placeholder="본문 내용을 입력하세요." draggable="false">안녕</div></div></div>`;
async function setup(page) {
  await page.setViewportSize({ width: 1700, height: 1100 });
  await bootApp(page);
  await page.evaluate((ov) => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', `<div class="section-block" data-section="1" id="sec_ts0he_pg899sy"><div class="section-hitzone"></div>
      <div class="section-inner"><div class="gap-block" data-type="gap" style="height:600px"></div></div>${ov}</div>`);
    window.rebindAll?.(); window.deselectAll?.(); document.getElementById('sec_ts0he_pg899sy').scrollIntoView({ block: 'start' }); }, OV);
  await page.waitForTimeout(300);
}
const geo = (page) => page.evaluate(() => { const g = id => document.getElementById(id); const cx = e => { const r = e.getBoundingClientRect(); return r.left + r.width / 2; };
  return { frame: [g('ss_ts0he_m7bkzk1').style.left, g('ss_ts0he_m7bkzk1').style.top], shp: [g('shp_ts0he_xv6u0kn').style.left, g('shp_ts0he_xv6u0kn').style.top],
    txt: [g('ss_ts0he_64z04f8').style.left], dc: Math.abs(cx(g('ss_ts0he_m7bkzk1')) - cx(g('ss_ts0he_64z04f8'))) }; });
async function pickBoth(page, mod) {
  const c = (id, f) => page.evaluate(([id, f]) => { const r = document.getElementById(id).getBoundingClientRect(); return [r.left + r.width * f, r.top + r.height * f]; }, [id, f]);
  let [x, y] = await c('tb_ts0he_mio7m0f', 0.5); await page.mouse.click(x, y); await page.waitForTimeout(150);
  [x, y] = await c('shp_ts0he_xv6u0kn', 0.2);
  await page.keyboard.down(mod); await page.mouse.click(x, y); await page.keyboard.up(mod); await page.waitForTimeout(250);
}
async function pressHCenter(page) {
  const sel = await page.evaluate(() => ['[data-ov-align="hcenter"]', '.msp-align-btn[data-align="hcenter"]'].find(s => document.querySelector(s)) || null);
  expect(sel, '정렬 단추가 떠야 한다(전제)').not.toBeNull();
  await page.click(sel); await page.waitForTimeout(250);
}
for (const [name, mod] of [['P1', 'Meta'], ['P2', 'Shift']]) {
  test(`${name} ★글자 + 원을 ${mod === 'Meta' ? '⌘' : '⇧'}클릭으로 고르고 가운데 정렬 → 원은 프레임째 움직이고 갈라지지 않는다`, async ({ page }) => {
    await setup(page);
    await pickBoth(page, mod);
    await pressHCenter(page);
    const g = await geo(page);
    expect(g.shp).toEqual(['0px', '0px']);            // 원은 제 프레임 안 그 자리
    expect(g.frame[0]).not.toBe('293px');             // 프레임이 움직였다
    expect(g.dc).toBeLessThanOrEqual(1);              // 가운데가 맞다
  });
}
test('P3 정렬 뒤 ⌘Z 한 번이면 처음 자리', async ({ page }) => {
  await setup(page);
  await pickBoth(page, 'Meta');
  await pressHCenter(page);
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Meta+z'); await page.waitForTimeout(250);
  const g = await geo(page);
  expect(g.frame).toEqual(['293px', '180px']); expect(g.shp).toEqual(['0px', '0px']); expect(g.txt).toEqual(['196px']);
});
