/* frame-inner-fullbleed.dom.spec.js — ★①의 ★갈래 ㉡: ★★«자르는 프레임 ★안»에서 ★패딩제외가 ★★«그 프레임의 ★패딩»을 ★뚫는다
 *
 * ★★★현빈 원문(2026-10-11 텔레그램): 「★프레임블럭의 ★패딩제외기능 ★원래됐잖아? ★★내용자르기도 ★원됐잖아? ★뭐가 문제야?」
 *   ★★실측으로 ★가린 참값(★`.gd-work` 의 `FULLBLEED.md` · ★판 `5954e4f4`):
 *     ★«섹션 직속 프레임»에선 ★된다 ／ ★★«프레임 ★안의 프레임»에선 ★★안 된다.
 *     ★까닭 = ★`effectiveSectionPadX` 가 ★「★자르는 프레임 ★안이면 ★★0」을 ★돌려준다(`js/drag-utils.js`)
 *       ＋ ★`js/clip-content.js` 의 ★`CLIP_DEFAULTS.frame === true`(★현빈 `1009t3-②` 로 ★기본이 ★자름이 됐다)
 *     ⇒ ★★사용자가 ★아무것도 ★안 켜도 ★겉 프레임은 ★자르고 ⇒ ★★속의 ★패딩제외 칸이 ★★조용히 ★사라진다.
 *   ⇒ ★지디가 ★고른 ★갈래 ㉡ = ★★«섹션 패딩»이 ★아니라 ★★«그 프레임의 ★패딩»을 ★뚫게 한다.
 *
 * ★★★⚠️그리고 ★★범위가 ★하나 ★좁다 — ★★내 ★음성대조(★FI3)가 ★잡았다(2026-10-11):
 *   ★★㉡ 은 ★★«스택 프레임»의 ★자식에만 ★참이다. ★★«자유(free) 프레임»의 ★자식은 ★`position:absolute` 라
 *   ★★그 담는 상자가 ★그 프레임의 ★★«패딩 상자»다 ⇒ ★★`width:100%` 가 ★★이미 ★끝까지 ★닿는다
 *   (★실측 `run-logs/fi-box.log`: ★겉 clientWidth ★860 · ★속 100% = ★860).
 *   ⇒ ★★거기서 ★뚫으면 ★★겉 상자를 ★넘어 ★잘린다(★잰 값: ★겉 ★420..1280 ／ ★뚫은 뒤 ★380..1320).
 *   ⇒ ★★그래서 ★아래 ★FI1·FI3 은 ★★«stack 으로 바꾼 뒤»를 ★잰다(★사람 입구 = ★패널의 ★`stack` 버튼),
 *     ★그리고 ★★FI5 가 ★★«자유 프레임이면 ★꺼진 채 ★보인다»를 ★따로 ★잠근다.
 *
 * ★★★이 파일이 ★재는 축 다섯 — ★★하나는 ★양성, ★★셋은 ★음성이다(⛔양성만 ★두면 ★«옛 것을 ★죽였나»를 ★못 잰다)
 *   ★FI1 ★양성 — ★겉이 ★자르는 채(★기본) ★겉 패딩 ★40 ⇒ ★★속에서 ★패딩제외가 ★★먹는다
 *   ★FI2 ★음성 — ★★«섹션 직속»은 ★★여전히 ★섹션 패딩을 ★뚫는다(⛔ㄱ 가 ★ㄴ 를 ★죽이지 ★않았다)
 *   ★FI3 ★음성 — ★★«자르기»가 ★★안 죽는다: ★`clipsContent(겉) === true` ＋ ★속이 ★뚫은 폭이 ★★겉 패딩상자를 ★안 넘는다
 *                  (★★현빈 `1009t3-②` 「프레임 밖은 ★안 보여야」가 ★산다)
 *   ★FI4 ★⒞ — ★뚫을 ★패딩이 ★0 이면 ★칸이 ★★«꺼진 채 ★보인다» ＋ ★★까닭 ★한 줄. ⛔조용히 ★사라지지 ★않는다
 *   ★FI5 ★⒞ ★둘째 꼴 — ★★«자유 프레임» 안이면 ★★까닭이 ★★«이미 ★다 닿았다»다(⛔«패딩을 ★올려라»가 ★아니다)
 *
 * ★★장면은 ★★«사람이 하는 순서»다: ★프레임 만들기 → ★고르기 → ★패널에서 ★패딩 ★주기 → ★속 프레임 만들기
 *   → ★★«레이어 패널 줄»로 ★속을 ★고르기 → ★★패널의 ★토글을 ★라벨로 ★누르기.
 *   ⚠️★★속 프레임은 ★★«캔버스 클릭으로 ★못 골라진다» — ★★그건 ★★별건이고 ★★내가 ★이미 ★쟀다
 *     (`FULLBLEED.md` F2: 「★클릭이 ★그 프레임을 ★못 골랐다 — ★겉이 ★가린다」 · ★지디 ★미착수 명부에 ★있다).
 *     ⇒ ★★그래서 ★★«레이어 패널»을 ★쓴다 — ★★그것도 ★사람이 ★쓰는 ★입구다. ⛔`selectBlock` 을 ★손으로 ★부르지 ★않는다.
 * ★하네스 = ★`_root-harness bootApp` ＋ ★`_click-at clickAt`.
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js tests/dom/frame-inner-fullbleed.dom.spec.js */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');
const { clickAt } = require('./_click-at.js');

const OUTER_PAD = 40;          /* ★겉 프레임의 ★좌우 패딩 — ★★패널 칸으로 ★준다(★기본값이 ★아니다) */
const PAGE_PAD  = 32;          /* ★문서 기본 좌우 패딩 — ★★앱에서 ★읽어 ★단언한다(⛔여기 수를 ★믿지 ★않는다) */

/** ★그려진 값 ＋ ★앱의 ★두 술어를 ★★앱 안에서 ★부른다 — ⛔사본을 ★만들지 ★않는다. */
const PROBE = (sel) => `(() => {
  const el = document.querySelector(${JSON.stringify(sel)});
  if (!el) return { missing: true };
  const r = el.getBoundingClientRect();
  const fr = el.parentElement?.closest?.('.frame-block') || null;
  return {
    fb: el.dataset.fullBleed ?? null,
    styleWidth: el.style.width || '', marginL: el.style.marginLeft || '',
    rectW: Math.round(r.width), rectL: Math.round(r.left),
    effPadX: window.effectiveSectionPadX ? window.effectiveSectionPadX(el) : '(window 에 없다)',
    secPadX: window.sectionPadX ? window.sectionPadX(el) : '(window 에 없다)',
    frClips: fr ? (window.clipsContent ? window.clipsContent(fr) : '(없다)') : '(조상 프레임 없다)',
    frPadL:  fr ? Math.round(parseFloat(getComputedStyle(fr).paddingLeft) || 0) : null,
    frInnerW: fr ? Math.round(fr.clientWidth - (parseFloat(getComputedStyle(fr).paddingLeft) || 0)
                                             - (parseFloat(getComputedStyle(fr).paddingRight) || 0)) : null,
    frBoxL: fr ? Math.round(fr.getBoundingClientRect().left) : null,
    frBoxR: fr ? Math.round(fr.getBoundingClientRect().right) : null,
    toggle: !!document.getElementById('ss-fullbleed-toggle'),
    toggleDisabled: document.getElementById('ss-fullbleed-toggle')?.disabled ?? null,
    why: document.getElementById('ss-fullbleed-why')?.textContent?.trim() || null,
    clipToggle: !!document.getElementById('ss-clip-toggle'),
    pagePadX: window.state?.pageSettings?.padX ?? null,
  };
})()`;

const ask = (page, sel) => page.evaluate((c) => eval(c), PROBE(sel));

async function boot(page) {
  await page.setViewportSize({ width: 1700, height: 1200 });
  /* ★★`_convertFreeLayoutToStack` 은 ★★«자식이 ★없으면» ★`alert` 를 ★띄우고 ★거짓을 ★돌려준다(★실측 2026-10-12).
     ⇒ ★그 창이 ★뜨면 ★여기서 ★★멈춘다 ⇒ ★★닫고, ★★«떴다»를 ★★모아 ★단언에 ★쓴다(⛔조용히 ★삼키지 ★않는다). */
  const dialogs = [];
  page.on('dialog', (d) => { dialogs.push(d.message()); d.dismiss().catch(() => {}); });
  const errs = await bootApp(page);
  errs._dialogs = dialogs;
  await page.evaluate(() => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach((s) => s.remove());
    c.insertAdjacentHTML('beforeend',
      '<div class="section-block" data-section="1" id="sFI"><div class="section-hitzone"></div>'
      + '<div class="section-inner"><div class="gap-block" data-type="gap" style="height:40px"></div></div></div>');
    window.rebindAll && window.rebindAll();
    window.applyZoom && window.applyZoom(100);
    window.deselectAll && window.deselectAll();
    window.selectSection(document.getElementById('sFI'));
  });
  return errs;
}

/** ★겉 프레임을 ★앱 입구로 ★만들고 ★캔버스 클릭으로 ★고른다(★사람 순서). */
async function makeOuter(page) {
  await page.evaluate(() => {
    window.addFrameBlock();
    const f = [...document.querySelectorAll('#sFI .frame-block:not([data-text-frame])')].pop();
    if (f) f.id = 'outerF';
    window.deselectAll && window.deselectAll();
  });
  const r = await waitStableRect(page, '#outerF');
  await clickAt(page, r.cx, r.cy, { sel: '#outerF' }, { label: '겉 프레임 고르기' });
  await page.waitForFunction(() => document.getElementById('outerF')?.classList.contains('selected'), null, { timeout: 5000 });
  await page.waitForFunction(() => !!document.getElementById('ss-padx-num'), null, { timeout: 5000 });
  return r;
}

/** ★★겉 프레임을 ★★«stack»으로 ★바꾼다 — ★★패널의 ★그 버튼이 ★사람 입구다(`#ss-to-stack-btn`).
 *  ★★왜 ★필요한가 — ★★자유 프레임의 ★자식은 ★절대배치라 ★★뚫을 것이 ★없다(★머리말의 ★그 실측).
 *  ⚠️★★★순서가 ★중요하다 — ★그 변환은 ★★«자식이 ★하나라도 ★있어야» ★돈다
 *    (★실측 2026-10-12: ★빈 프레임에서 ★누르면 ★`alert('변환할 자식이 없습니다.')` ＋ ★`false`).
 *    ⇒ ★★그래서 ★★«속을 ★먼저 ★넣고» ★겉을 ★다시 ★골라 ★누른다. */
async function outerToStack(page) {
  const r = await waitStableRect(page, '#outerF');
  await page.mouse.click(r.cx, r.cy);
  await page.waitForFunction(() => document.getElementById('outerF')?.classList.contains('selected'),
    null, { timeout: 5000 }).catch(() => {});
  await page.waitForFunction(() => !!document.getElementById('ss-to-stack-btn'), null, { timeout: 5000 }).catch(() => {});
  const btn = page.locator('#ss-to-stack-btn');
  const n = await btn.count();
  if (n === 1) await btn.click();
  await page.waitForFunction(() => document.getElementById('outerF')?.dataset.freeLayout !== 'true',
    null, { timeout: 5000 }).catch(() => {});
  await page.waitForFunction(() => !!document.getElementById('ss-padx-num'), null, { timeout: 5000 }).catch(() => {});
  return { btn: n, free: await page.evaluate(() => document.getElementById('outerF')?.dataset.freeLayout ?? null) };
}

/** ★패널의 ★«좌우 패딩» 칸에 ★값을 ★넣는다 — ⛔dataset 을 ★손으로 ★쓰지 ★않는다(★그건 ★패널을 ★안 탄다). */
async function setOuterPad(page, v) {
  await page.locator('#ss-padx-num').fill(String(v));
  await page.locator('#ss-padx-num').dispatchEvent('input');
  await page.locator('#ss-padx-num').dispatchEvent('change');
  await page.waitForFunction(
    (n) => Math.round(parseFloat(getComputedStyle(document.getElementById('outerF')).paddingLeft) || 0) === n,
    v, { timeout: 5000 });
}

/** ★겉이 ★골라진 채 ★★속 프레임을 ★만든다(⛔아직 ★고르지 ★않는다). */
async function makeInner(page) {
  return page.evaluate(() => {
    const outer = document.getElementById('outerF');
    window.addFrameBlock();
    const inner = [...document.querySelectorAll('#sFI .frame-block:not([data-text-frame])')]
      .find((f) => f !== outer && outer.contains(f)) || null;
    if (inner) inner.id = 'innerF';
    window.deselectAll && window.deselectAll();
    return { nested: !!inner };
  });
}

/** ★★«레이어 패널»에서 ★펼쳐 ★속 프레임의 ★줄을 ★누른다.
 *  ★★이 길은 ★★내가 ★탐침으로 ★쟀다(`run-logs/fi-layer2.log`):
 *    ★줄에 ★`data-block-id` 는 ★★없다 · ★프레임은 ★`.layer-row-group[data-type="frame"]` 이고 ★★처음엔 ★접혀 있다
 *    ⇒ ★★쉐브론을 ★눌러 ★펼치고 ★★`:scope > .layer-row-children` 의 ★첫 줄을 ★누른다
 *  ⚠️★★속 프레임은 ★★«캔버스 클릭으로 ★못 골라진다» — ★★별건이고 ★★내가 ★이미 ★쟀다(`FULLBLEED.md` F2 · ★지디 ★미착수 명부).
 *    ⇒ ★★그래서 ★레이어 패널을 ★쓴다 — ★★그것도 ★사람이 ★쓰는 ★입구다. ⛔`selectBlock` 을 ★손으로 ★부르지 ★않는다. */
async function selectInnerViaLayer(page) {
  const pre = await page.evaluate(() => {
    window.deselectAll && window.deselectAll();
    window.buildLayerPanel && window.buildLayerPanel();
    const gs = [...document.querySelectorAll('#layer-panel-body .layer-row-group[data-type="frame"]')];
    if (gs.length) {
      gs[0].dataset.fiOuter = '1';
      const ch = gs[0].querySelector(':scope > .layer-row-header .layer-chevron');
      if (ch) ch.dataset.fiChev = '1';
    }
    return { nGroups: gs.length, chev: !!document.querySelector('[data-fi-chev="1"]') };
  });
  if (!pre.chev) return { ...pre, found: false };
  const cr = await waitStableRect(page, '[data-fi-chev="1"]');
  await clickAt(page, cr.cx, cr.cy, { sel: '[data-fi-chev="1"]' }, { label: '레이어 쉐브론 펼치기' });
  await page.waitForFunction(() => !document.querySelector('[data-fi-outer="1"]')?.classList.contains('collapsed'),
    null, { timeout: 5000 });
  const row = await page.evaluate(() => {
    const out = document.querySelector('[data-fi-outer="1"]');
    const kids = [...(out?.querySelector(':scope > .layer-row-children')?.children || [])];
    const hdr = kids[0]?.classList.contains('layer-row-group')
      ? kids[0].querySelector(':scope > .layer-row-header') : kids[0];
    if (hdr) hdr.dataset.fiKid = '1';
    return { found: !!hdr, nKids: kids.length, txt: (hdr?.textContent || '').trim().slice(0, 24) };
  });
  if (!row.found) return { ...pre, ...row };
  const kr = await waitStableRect(page, '[data-fi-kid="1"]');
  await clickAt(page, kr.cx, kr.cy, { sel: '[data-fi-kid="1"]' }, { label: '레이어 줄로 속 프레임 고르기' });
  await page.waitForFunction(() => document.getElementById('innerF')?.classList.contains('selected'),
    null, { timeout: 5000 });
  await page.waitForFunction(() => !!document.getElementById('ss-clip-toggle'), null, { timeout: 5000 });
  return { ...pre, ...row };
}

/** ★토글은 ★«안 보이는 input» 이다 — ★사람이 ★누르는 ★`label.prop-toggle` 을 ★누른다(★실측). */
async function pressFullBleed(page) {
  const lab = page.locator('label.prop-toggle:has(#ss-fullbleed-toggle)');
  if (await lab.count() === 1) await lab.click();
  else await page.locator('#ss-fullbleed-toggle').check({ force: true });
}

/* ══════ FI1 ★★양성 — ★겉이 ★자르는 채 ★속에서 ★패딩제외가 ★먹는다 ══════ */
test('FI1 ★★★«자르는 겉 프레임» 안에서 ★패딩제외가 ★★먹는다 — ★뚫는 값은 ★★«그 프레임의 패딩»이다 (현빈 ① · 갈래 ㉡)', async ({ page }) => {
  const errs = await boot(page);
  await makeOuter(page);
  /* ★전제 ⑴ — ★문서 패딩이 ★내가 쓴 수와 ★같나. ⛔다르면 ★아래 수들이 ★무엇인지 ★모른다 */
  expect(await page.evaluate(() => window.state?.pageSettings?.padX ?? null),
    '★전제 — ★문서 좌우 패딩').toBe(PAGE_PAD);
  /* ★★순서 = ★★«속을 ★넣고 → ★겉을 ★stack 으로 → ★패딩을 ★주고 → ★속을 ★고른다»
     (★그 변환이 ★자식을 ★요구한다 — ★`outerToStack` 머리말의 ★실측) */
  const mk = await makeInner(page);
  expect(mk.nested, `★전제 — ★겉 안에 ★속 프레임이 ★섰다. 잰 값 ${JSON.stringify(mk)}`).toBe(true);
  const st = await outerToStack(page);
  expect(st, `★전제 — ★겉을 ★«stack»으로 ★바꿨다(★버튼 1개 · ★free 아님). 잰 값 ${JSON.stringify(st)} · ★창 ${JSON.stringify(errs._dialogs)}`)
    .toEqual({ btn: 1, free: null });
  expect(errs._dialogs, '★전제 — ★★알림창이 ★안 떴다(★떴으면 ★변환이 ★거절된 것이다)').toEqual([]);
  await setOuterPad(page, OUTER_PAD);
  const made = await selectInnerViaLayer(page);
  expect(made.found, `★전제 — ★레이어 패널에 ★속 프레임 줄이 ★있다. 잰 값 ${JSON.stringify(made)}`).toBe(true);

  const before = await ask(page, '#innerF');
  console.log('★FI1 켜기 전 = ' + JSON.stringify(before));
  /* ★전제 ⑵ — ★겉이 ★정말 ★자른다(★계열 기본값). ⛔이게 거짓이면 ★이 시험은 ★다른 판을 잰다 */
  expect(before.frClips, `★전제 — ★겉 프레임이 ★자른다(CLIP_DEFAULTS.frame). 잰 값 ${JSON.stringify(before)}`).toBe(true);
  expect(before.frPadL, `★전제 — ★겉 패딩이 ★${OUTER_PAD} 다. 잰 값 ${JSON.stringify(before)}`).toBe(OUTER_PAD);
  /* ★★★주 단언 ⑴ — ★칸이 ★있다. ★고치기 전 판에서는 ★★`canFullBleed` 가 ★거짓이라 ★★사라진다 */
  expect(before.toggle, `★★«패딩 제외» 칸이 ★있어야 한다 — ★고치기 전엔 ★★조용히 ★사라졌다. 잰 값 ${JSON.stringify(before)}`).toBe(true);
  expect(before.toggleDisabled, `★★그리고 ★꺼져 있지 ★않아야 한다(★뚫을 패딩이 ★${OUTER_PAD} 다). 잰 값 ${JSON.stringify(before)}`).toBe(false);
  /* ★★★주 단언 ⑵ — ★뚫는 값이 ★★«겉 프레임의 패딩»이다(⛔섹션의 ★${PAGE_PAD} 가 ★아니다) */
  expect(before.effPadX, `★★뚫을 패딩 = ★겉 프레임의 ★${OUTER_PAD} (⛔0 도 ⛔${PAGE_PAD} 도 ★아니다). 잰 값 ${JSON.stringify(before)}`).toBe(OUTER_PAD);

  await pressFullBleed(page);
  await page.waitForFunction(() => document.getElementById('innerF')?.dataset.fullBleed === 'true', null, { timeout: 5000 });
  const after = await ask(page, '#innerF');
  console.log('★FI1 켠 뒤 = ' + JSON.stringify(after));
  /* ★★★주 단언 ⑶ — ★그려진 폭이 ★★안쪽 폭 ＋ 2×패딩 이다. ⛔dataset 만 보지 ★않는다 */
  expect(after.styleWidth, `★★폭 식이 ★calc(100% + ${OUTER_PAD * 2}px) 여야 한다. 잰 값 ${JSON.stringify(after)}`)
    .toBe(`calc(100% + ${OUTER_PAD * 2}px)`);
  expect(after.marginL, `★★왼쪽 마진이 ★-${OUTER_PAD}px 여야 한다. 잰 값 ${JSON.stringify(after)}`).toBe(`-${OUTER_PAD}px`);
  expect(after.rectW - before.rectW,
    `★★그려진 폭이 ★★2×${OUTER_PAD} 만큼 ★늘어야 한다. 잰 값 전=${before.rectW} 후=${after.rectW}`).toBe(OUTER_PAD * 2);
  expect(errs.map((e) => String(e)), '★오류 0').toEqual([]);
});

/* ══════ FI2 ★★음성 — ★섹션 직속은 ★여전히 ★섹션 패딩을 ★뚫는다 ══════ */
test('FI2 ★★음성대조 — ★★«섹션 직속» 프레임은 ★여전히 ★섹션 패딩을 ★뚫는다 (⛔ㄱ 를 고치며 ★ㄴ 를 ★죽이지 ★않았다)', async ({ page }) => {
  const errs = await boot(page);
  await makeOuter(page);
  const r = await ask(page, '#outerF');
  console.log('★FI2 잰 것 = ' + JSON.stringify(r));
  expect(r.pagePadX, '★전제 — ★문서 좌우 패딩').toBe(PAGE_PAD);
  expect(r.frClips, '★전제 — ★이 프레임은 ★조상 프레임이 ★없다').toBe('(조상 프레임 없다)');
  expect(r.effPadX, `★★섹션 직속 ⇒ ★뚫을 패딩 = ★섹션의 ★${PAGE_PAD}. 잰 값 ${JSON.stringify(r)}`).toBe(PAGE_PAD);
  expect(r.toggle, `★★칸이 ★있다. 잰 값 ${JSON.stringify(r)}`).toBe(true);
  await pressFullBleed(page);
  await page.waitForFunction(() => document.getElementById('outerF')?.dataset.fullBleed === 'true', null, { timeout: 5000 });
  const a = await ask(page, '#outerF');
  console.log('★FI2 켠 뒤 = ' + JSON.stringify(a));
  expect(a.styleWidth, `★★옛 계약 ★그대로. 잰 값 ${JSON.stringify(a)}`).toBe(`calc(100% + ${PAGE_PAD * 2}px)`);
  expect(a.rectW - r.rectW, `★그려진 폭 ★+2×${PAGE_PAD}. 잰 값 전=${r.rectW} 후=${a.rectW}`).toBe(PAGE_PAD * 2);
  expect(errs.map((e) => String(e)), '★오류 0').toEqual([]);
});

/* ══════ FI3 ★★음성 — ★«자르기»가 ★안 죽는다(현빈 1009t3-② 가 산다) ══════ */
test('FI3 ★★음성대조 — ★★«자르기»가 ★안 죽는다: ★겉은 ★여전히 ★자르고 ★★뚫은 폭이 ★겉 상자를 ★안 넘는다 (현빈 `1009t3-②`)', async ({ page }) => {
  const errs = await boot(page);
  await makeOuter(page);
  const mk = await makeInner(page);
  expect(mk.nested, `★전제 — ★속 프레임이 ★섰다. 잰 값 ${JSON.stringify(mk)}`).toBe(true);
  const st = await outerToStack(page);
  expect(st.free, `★전제 — ★겉이 ★«stack»이다. 잰 값 ${JSON.stringify(st)}`).toBe(null);
  await setOuterPad(page, OUTER_PAD);
  const made = await selectInnerViaLayer(page);
  expect(made.found, `★전제 — ★레이어 줄이 ★있다. 잰 값 ${JSON.stringify(made)}`).toBe(true);
  /* ★★전제 — ★★«누를 칸이 ★있다». ⛔이걸 ★안 세우면 ★고치기 전 판에서 ★★30초 ★시간초과로 ★빨개진다
     ⇒ ★★그 빨강은 ★«무엇이 ★틀렸나»를 ★말해 주지 ★않는다(★내 실측 `fi-pin3.log`). */
  const pre = await ask(page, '#innerF');
  expect(pre.toggle, `★전제 — ★누를 ★«패딩 제외» 칸이 ★있다. 잰 값 ${JSON.stringify(pre)}`).toBe(true);
  expect(pre.toggleDisabled, `★전제 — ★그 칸이 ★꺼져 있지 ★않다. 잰 값 ${JSON.stringify(pre)}`).toBe(false);
  await pressFullBleed(page);
  await page.waitForFunction(() => document.getElementById('innerF')?.dataset.fullBleed === 'true', null, { timeout: 5000 });
  const a = await ask(page, '#innerF');
  console.log('★FI3 잰 것 = ' + JSON.stringify(a));
  /* ★★⑴ ★자름 술어가 ★그대로 ★참이다 — ⛔내가 ★그것을 ★끄지 ★않았다 */
  expect(a.frClips, `★★겉은 ★여전히 ★자른다 — ⛔1009t3-② 를 ★안 죽였다. 잰 값 ${JSON.stringify(a)}`).toBe(true);
  /* ★★⑵ ★뚫은 상자가 ★겉 ★테두리 상자를 ★★안 넘는다 — ★넘으면 ★잘려 ★사용자가 ★잃는다 */
  expect(a.rectL >= a.frBoxL - 1,
    `★★뚫은 왼쪽(${a.rectL})이 ★겉 상자 왼쪽(${a.frBoxL})보다 ★안쪽이어야 한다 — ★넘으면 ★잘린다`).toBe(true);
  expect(a.rectL + a.rectW <= a.frBoxR + 1,
    `★★뚫은 오른쪽(${a.rectL + a.rectW})이 ★겉 상자 오른쪽(${a.frBoxR})보다 ★안쪽이어야 한다`).toBe(true);
  /* ★★⑶ ★그리고 ★★«딱 맞게» 뚫렸다 — ★겉 패딩상자 ★폭과 ★같다(★덜 뚫리면 ★기능이 ★반쪽이다) */
  expect(Math.abs(a.rectW - (a.frInnerW + OUTER_PAD * 2)) <= 1,
    `★★뚫은 폭(${a.rectW})이 ★겉 안쪽폭+2×패딩(${a.frInnerW + OUTER_PAD * 2})과 ★같아야 한다`).toBe(true);
  expect(errs.map((e) => String(e)), '★오류 0').toEqual([]);
});

/* ══════ FI4 ★⒞ — ★뚫을 패딩이 ★0 이면 ★«꺼진 채 보인다» ＋ ★까닭 ══════ */
test('FI4 ★★★뚫을 패딩이 ★0 이면 ★칸이 ★★«꺼진 채 ★보인다» ＋ ★까닭 ★한 줄 — ⛔조용히 ★사라지지 ★않는다 (지디 ⒞)', async ({ page }) => {
  const errs = await boot(page);
  await makeOuter(page);
  const mk = await makeInner(page);
  expect(mk.nested, `★전제 — ★속 프레임이 ★섰다. 잰 값 ${JSON.stringify(mk)}`).toBe(true);
  const st = await outerToStack(page);
  expect(st.free, `★전제 — ★겉이 ★«stack»이다(⛔자유면 ★까닭이 ★다른 줄이다 — ★FI5). 잰 값 ${JSON.stringify(st)}`).toBe(null);
  await setOuterPad(page, 0);          /* ★겉 패딩 ★0 ⇒ ★뚫을 것이 ★없다 */
  const made = await selectInnerViaLayer(page);
  expect(made.found, `★전제 — ★레이어 줄이 ★있다. 잰 값 ${JSON.stringify(made)}`).toBe(true);
  const r = await ask(page, '#innerF');
  console.log('★FI4 잰 것 = ' + JSON.stringify(r));
  expect(r.frClips, '★전제 — ★겉이 ★자른다').toBe(true);
  expect(r.frPadL, '★전제 — ★겉 패딩이 ★0 이다').toBe(0);
  expect(r.effPadX, `★뚫을 패딩이 ★0 이다. 잰 값 ${JSON.stringify(r)}`).toBe(0);
  /* ★★★주 단언 — ★칸이 ★★보이고 ★★꺼져 있고 ★★까닭이 ★적혀 있다 */
  expect(r.toggle, `★★칸이 ★★보여야 한다 — ⛔사라지면 ★사용자는 ★「고장」으로 ★읽는다. 잰 값 ${JSON.stringify(r)}`).toBe(true);
  expect(r.toggleDisabled, `★★그리고 ★꺼져 있어야 한다. 잰 값 ${JSON.stringify(r)}`).toBe(true);
  /* ★★★까닭이 ★★«이 장면의» 까닭이어야 한다 — ⛔길이만 재면 ★★틀린 줄도 ★통과한다.
     ★실측 2026-10-12: ★처음엔 ★여기 ★★«자유 배치라…»가 ★떴다(★판정을 ★`isFreeLayout` 으로 ★썼다) ⇒ ★★거짓 까닭. */
  expect(r.why && r.why.includes('좌우 패딩'),
    `★★까닭이 ★★«좌우 패딩을 ★올려라»여야 한다(★stack 장면이다). 잰 값 ${JSON.stringify(r.why)}`).toBe(true);
  expect(r.why && r.why.includes('자유'),
    `★★⛔«자유 배치» 까닭이 ★여기 ★뜨면 ★★거짓이다 — ★이 장면은 ★stack 이다. 잰 값 ${JSON.stringify(r.why)}`).toBe(false);
  expect(errs.map((e) => String(e)), '★오류 0').toEqual([]);
});

/* ══════ FI5 ★⒞ ★둘째 꼴 — ★«자유 프레임» 안이면 ★까닭이 ★다른 줄이다 ══════ */
test('FI5 ★★★«자유(free) 프레임» 안 — ★칸은 ★★꺼진 채 ★보이고 ★까닭은 ★★«이미 ★다 닿았다»다 (⛔«패딩을 올려라»가 ★아니다)', async ({ page }) => {
  const errs = await boot(page);
  await makeOuter(page);
  await setOuterPad(page, OUTER_PAD);   /* ★겉 패딩을 ★줘도 — ★★자유면 ★자식은 ★절대배치라 ★뚫을 것이 ★없다 */
  const mk = await makeInner(page);
  expect(mk.nested, `★전제 — ★속 프레임이 ★섰다. 잰 값 ${JSON.stringify(mk)}`).toBe(true);
  const made = await selectInnerViaLayer(page);
  expect(made.found, `★전제 — ★레이어 줄이 ★있다. 잰 값 ${JSON.stringify(made)}`).toBe(true);
  const r = await ask(page, '#innerF');
  const meta = await page.evaluate(() => ({
    outerFree: document.getElementById('outerF')?.dataset.freeLayout ?? null,
    innerFree: document.getElementById('innerF')?.dataset.freeLayout ?? null,
    innerPos:  document.getElementById('innerF')?.style.position || '',
    innerCB:   Math.round(document.getElementById('outerF')?.clientWidth ?? -1),
  }));
  console.log('★FI5 잰 것 = ' + JSON.stringify({ ...r, ...meta }));
  /* ★전제 셋 — ★★이 시험이 ★★«어느 판»을 재는지 ★박는다 */
  expect(meta.outerFree, '★전제 ⑴ — ★겉이 ★자유 배치다(⛔stack 으로 ★안 바꿨다)').toBe('true');
  expect(meta.innerPos, '★전제 ⑵ — ★그래서 ★속이 ★절대배치다').toBe('absolute');
  expect(r.frPadL, `★전제 ⑶ — ★겉 패딩은 ★${OUTER_PAD} 로 ★있다(★«없어서»가 ★아니다). 잰 값 ${JSON.stringify(r)}`).toBe(OUTER_PAD);
  /* ★★★주 단언 — ★뚫을 것이 ★0 이고, ★칸은 ★보이며 ★꺼져 있고, ★까닭이 ★★«stack» 을 ★가리킨다 */
  expect(r.effPadX, `★★절대배치 자식은 ★★이미 ★끝까지 ★닿았다 ⇒ ★0. 잰 값 ${JSON.stringify(r)}`).toBe(0);
  expect(r.toggle, `★★칸이 ★보여야 한다. 잰 값 ${JSON.stringify(r)}`).toBe(true);
  expect(r.toggleDisabled, `★★꺼져 있어야 한다. 잰 값 ${JSON.stringify(r)}`).toBe(true);
  expect(r.why && r.why.includes('stack'),
    `★★까닭이 ★★«stack»을 ★가리켜야 한다 — ⛔«좌우 패딩을 ★올려라»는 ★★여기선 ★거짓이다. 잰 값 ${JSON.stringify(r.why)}`).toBe(true);
  /* ★★그리고 ★그 입구가 ★★«정말 ★있다» — ⛔없는 입구를 ★가리키지 ★않았다(지디 ⒞) */
  const outerBtn = await page.evaluate(() => {
    window.deselectAll && window.deselectAll();
    const o = document.getElementById('outerF');
    o.classList.add('selected'); window.showFrameProperties?.(o);
    return { btn: !!document.getElementById('ss-to-stack-btn') };
  });
  expect(outerBtn.btn, `★★까닭이 ★가리킨 ★«stack» 버튼이 ★★겉 프레임 패널에 ★정말 ★있다. 잰 값 ${JSON.stringify(outerBtn)}`).toBe(true);
  expect(errs.map((e) => String(e)), '★오류 0').toEqual([]);
});
