/* t7-fullbleed-radial-laurel.dom.spec.js — t7-01 「Radial Block 패딩 제외 옵션 추가」 · t5-10 「월계수 블럭도 패딩제외 옵션 넣어줄 것」
 *
 * ★원문(시트 t7-01 · t5-10 내용 칸) — 「Radial Block 패딩 제외 옵션 추가」 · 「월계수 블럭도 패딩제외 옵션 넣어줄 것」
 * ★잰 이(아이맥 · 앱 판 ca702d40 · 저장본 lrb_6vpqi0) — 월계수 패널에 「패딩 제외」 0(패딩 낱말 0) · prop-laurel.js 0.
 *   라디알은 같은 꼴(prop-radial.js 에 「패딩」 0 · S3 실측 46d444b1).
 * ★처방 = 이식 — 「패딩 제외」는 레포 고유명사다(dataset.fullBleed · js/drag-utils.js applyBlockFullBleed/clearBlockFullBleed).
 *   본 = 배너2(js/blocks/banner02-block.js 렌더가 매번 applyBlockFullBleed · js/props/prop-banner02.js 토글).
 *   페이지 padX 를 바꾸면 따라오는 길은 js/props/prop-page.js 의 `[data-full-bleed="true"]` 표식 루프가 이미 맡는다.
 *
 * ★칸(블럭마다 같은 셋 — 라디알 원 · 라디알 호 · 월계수)
 *   P  전제 — 블럭이 섹션 흐름에 섰고 그 자리의 실효 좌우 패딩(effectiveSectionPadX) > 0 · 블럭이 섹션보다 좁다
 *   F1 블럭을 고르면 패널에 「패딩 제외」 토글이 있다
 *   F2 켜면 블럭 왼·오른 끝 = 섹션 왼·오른 끝(1px 안) · dataset.fullBleed='true' · (호) 무대 폭도 같이 넓어진다
 *   F3 끄면 켜기 전 사각형으로 돌아온다(1px 안) · 인라인 margin 흔적 0 · 켠 뒤 ⌘Z 한 번이면 끈 상태
 * ⛔고정 대기 0 — 조건 대기만.
 * 실행: bash ~/taeyang-098/run-test.sh dom tests/dom/t7-fullbleed-radial-laurel.dom.spec.js --workers=1
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');

const KINDS = [
  { name: '라디알 원', add: () => window.addRadialBlock({ shape: 'circle' }), sel: '.radial-block' },
  { name: '라디알 호', add: () => window.addRadialBlock({ shape: 'arc' }), sel: '.radial-block', arc: true },
  { name: '월계수', add: () => window.addLaurelBlock(), sel: '.laurel-block' },
];

async function setup(page, kind) {
  await page.setViewportSize({ width: 1400, height: 1000 });
  const errs = await bootApp(page);
  const r = await page.evaluate(async ({ src, sel }) => {
    await window.addSection();
    // eslint-disable-next-line no-eval
    (0, eval)('(' + src + ')')();
    /* addLaurelBlock 은 아무것도 안 돌려준다 — 입구가 만든 «마지막» 블럭을 집는다 */
    const block = [...document.querySelectorAll('#canvas ' + sel)].pop();
    window.deselectAll?.();
    return { id: block?.id || null, padX: block ? window.effectiveSectionPadX?.(block) ?? null : null };
  }, { src: kind.add.toString(), sel: kind.sel });
  expect(r.id, `P 전제(${kind.name}): 블럭이 섰다`).toBeTruthy();
  await waitStableRect(page, '#' + r.id);
  return { errs, id: r.id, padX: r.padX };
}

const geom = (page, id) => page.evaluate((id) => {
  const b = document.getElementById(id);
  const s = b.closest('.section-block').getBoundingClientRect();
  const r = b.getBoundingClientRect();
  const st = b.querySelector('.rdl-stage');
  return { bl: r.left, br: r.right, sl: s.left, sr: s.right, w: r.width, fb: b.dataset.fullBleed || null,
    ml: b.style.marginLeft, mr: b.style.marginRight, stageW: st ? st.getBoundingClientRect().width : null };
}, id);

async function pick(page, id) {
  const r = await waitStableRect(page, '#' + id);
  await page.mouse.click(r.cx, r.top + 6);
  await page.waitForFunction((id) => document.getElementById(id)?.classList.contains('selected'), id, { timeout: 3000 });
}

/** 패널의 「패딩 제외」 토글 input(없으면 null) — 라벨 글자로 찾는다(블럭마다 id 가 다르다). */
const toggleSel = (page) => page.evaluate(() => {
  const row = [...document.querySelectorAll('#panel-right .prop-row')].find((r) => r.querySelector('.prop-label')?.textContent.trim() === '패딩 제외');
  const cb = row?.querySelector('input[type=checkbox]');
  if (!cb) return null;
  if (!cb.id) cb.id = '__fb_probe';
  return '#' + cb.id;
});

async function clickToggle(page, sel) {
  /* 체크박스는 트랙(span)이 덮고 있다 — 사람이 누르는 자리 = 그 label 의 보이는 사각형 */
  const box = await page.evaluate((sel) => { const l = document.querySelector(sel).closest('label'); l.scrollIntoView({ block: 'center' }); const r = l.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, sel);
  await page.mouse.click(box.x, box.y);
}

for (const kind of KINDS) {
  test(`${kind.name} · P·F1·F2·F3 ★패딩 제외 켜고 끄기`, async ({ page }) => {
    const { errs, id, padX } = await setup(page, kind);
    expect(padX, `P 전제(${kind.name}): 실효 좌우 패딩 > 0`).toBeGreaterThan(0);
    const g0 = await geom(page, id);
    expect(g0.bl - g0.sl, `P 전제: 블럭이 섹션 왼끝보다 안쪽 (${g0.bl} vs ${g0.sl})`).toBeGreaterThan(1);
    await pick(page, id);
    const sel = await toggleSel(page);
    expect(sel, `F1 ${kind.name} 패널 「패딩 제외」 토글`).not.toBeNull();
    await clickToggle(page, sel);
    await page.waitForFunction((id) => document.getElementById(id)?.dataset.fullBleed === 'true', id, { timeout: 3000 });
    await waitStableRect(page, '#' + id);
    const g1 = await geom(page, id);
    expect(Math.abs(g1.bl - g1.sl), `F2 왼끝 ${g1.bl} = 섹션 ${g1.sl}`).toBeLessThan(1);
    expect(Math.abs(g1.br - g1.sr), `F2 오른끝 ${g1.br} = 섹션 ${g1.sr}`).toBeLessThan(1);
    if (kind.arc) expect(g1.stageW, `F2 호 무대 폭 ${g0.stageW} → ${g1.stageW}`).toBeGreaterThan(g0.stageW + 1);
    /* ⌘Z 한 번 = 켜기 전 */
    await page.evaluate(() => document.activeElement?.blur?.());
    await page.keyboard.press('Meta+z');
    await page.waitForFunction((id) => document.getElementById(id) && document.getElementById(id).dataset.fullBleed !== 'true', id, { timeout: 3000 });
    const id2 = id;
    await waitStableRect(page, '#' + id2);
    const gu = await geom(page, id2);
    expect(Math.abs(gu.bl - g0.bl) < 1 && Math.abs(gu.w - g0.w) < 1, `F3 ⌘Z 뒤 사각형 ${gu.bl}/${gu.w} = ${g0.bl}/${g0.w}`).toBe(true);
    /* 다시 켜고 → 토글로 끄기 */
    await pick(page, id2);
    const sel2 = await toggleSel(page);
    await clickToggle(page, sel2);
    await page.waitForFunction((id) => document.getElementById(id)?.dataset.fullBleed === 'true', id2, { timeout: 3000 });
    const sel3 = await toggleSel(page);
    await clickToggle(page, sel3);
    await page.waitForFunction((id) => document.getElementById(id)?.dataset.fullBleed !== 'true', id2, { timeout: 3000 });
    await waitStableRect(page, '#' + id2);
    const g2 = await geom(page, id2);
    expect(Math.abs(g2.bl - g0.bl), `F3 끈 뒤 왼끝 ${g2.bl} = 켜기 전 ${g0.bl}`).toBeLessThan(1);
    expect(Math.abs(g2.w - g0.w), `F3 끈 뒤 폭 ${g2.w} = 켜기 전 ${g0.w}`).toBeLessThan(1);
    expect([g2.ml, g2.mr], 'F3 인라인 margin 흔적 0').toEqual(['', '']);
    expect(errs).toEqual([]);
  });
}
