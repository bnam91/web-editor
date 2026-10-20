/* prop-title-row-align.dom.spec.js — 1020t2c1 ★절 머리줄(제목 ＋ 오른쪽 손잡이)의 ★세로 정렬.
 *
 * ★현빈 2026-10-20 「prop-toggle-track … 조금씩 올라간 게 있어 · 전체 살펴봐봐」
 *   ⇒ 전수 결과: `.prop-row > .prop-toggle` ★41곳은 ★0.00px(죄 없음). 어긋나는 것은
 *     ★`.prop-section-title-row` 패턴 ★5곳뿐이다(Effects·Stroke·Shadow(텍스트)·Shadow(스티커)·Favorites).
 *
 * ★★자(ruler) = |손잡이 상자 세로중심 − 제목 ★글자 줄상자 세로중심|  (글자 = `Range.selectNodeContents`)
 *   ⛔`titleEl.getBoundingClientRect()`(상자) 로 재면 ★고치기 전에도 0.00 이 나와 ★항등식이 된다.
 *     `.prop-section-title` 의 padding 이 `8px 0 4px`(★비대칭)라 ★상자 중심과 ★글자 중심이 ★2px 다르고,
 *     `align-items:center` 는 ★상자를 맞추기 때문이다. ★실측 비석: 같은 자리에서 dBox 0.00 / dGlyph −2.00.
 *   ⇒ 아래 D0b 가 ★그 자를 ★자기 장면으로 ★증명한다(판과 무관한 ★계측기 양성대조 — 「대조군을 돌리는 자도 대조가 필요하다」).
 *
 * ★뿌리는 ★둘이고 서로를 ★가렸다 (1020t2c1 계획 ㉠-7 실측):
 *   R1 `css/editor-props.css` `.prop-section-title { padding: 8px 0 4px }` 비대칭        ⇒ −2.00px
 *   R2 `css/editor-blocks.css` `.prop-action-btn { margin-top: 6px }` 가 제목줄에서 안 꺼짐 ⇒ +3.00px
 *   ★Favorites 줄에서 둘이 깎여 ★+1.00 으로 보였다 ⇒ ★R1 만 고치면 ★+3 으로 ★더 나빠진다.
 *
 * ★★D2 양성대조(핀) — ⛔HEAD 를 대조 판으로 쓰지 마라(고친 뒤 HEAD = 고친 판이라 공짜 초록이 된다).
 *   핀 = ★a42d76d59f45a70eb3ee0e1f68a8ed37650f7565 (풀 sha · ⛔`<sha>^` 꼴 금지)
 *   돌리는 꼴: `GD1001_ROOT=<그 판 추출본> npx playwright test --config=tests/dom/playwright.dom.config.js \
 *                tests/dom/prop-title-row-align.dom.spec.js --workers=1 --repeat-each=3`
 *   ★핀에서 잰 값 = ★[아래 비석 — ★실제로 돌린 뒤 채운다. ⛔재기 전에 박지 않는다]
 *
 * 앱 통째(bootApp) · 헤드리스 · 고디터 인스턴스·MCP 대역 무접촉 · ⛔고정 대기(waitForTimeout) 0건.
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js tests/dom/prop-title-row-align.dom.spec.js
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');
const { clickAt } = require('./_click-at.js');

const TOL = 0.5;                 // px — 「가운데 맞았다」의 턱
const SEC = '[id="secT"]';
const SEC_HTML = '<div class="section-block" id="secT" style="position:relative;height:460px;background:#f4f4f6"><div class="section-inner"></div></div>';

/* ─── 자 ─────────────────────────────────────────────────────────────────
   한 번 읽기 = 패널의 ★모든 `.prop-section-title-row` 를 ★자리별로 잰다.
   ★★rect 를 읽는 자에는 두 칸을 같이 — ⑴ 가라앉기 ⑵ 두 번 읽어 같은가 (아래 settled() 가 둘을 같이 한다). */
const readRows = (page) => page.evaluate(() => {
  const f = (v) => Math.round(v * 100) / 100;
  const out = [];
  for (const row of document.querySelectorAll('#panel-right .prop-section-title-row')) {
    const title = row.querySelector('.prop-section-title');
    const ctl = [...row.children].find((c) => c !== title);
    if (!title || !ctl) continue;
    const rg = document.createRange(); rg.selectNodeContents(title);
    const g = rg.getBoundingClientRect(), tb = title.getBoundingClientRect(), cb = ctl.getBoundingClientRect();
    out.push({
      sec: row.closest('.prop-section')?.id || '(id없음)',
      title: title.textContent.trim(),
      ctl: ctl.tagName.toLowerCase() + (ctl.id ? '#' + ctl.id : '.' + String(ctl.className).split(' ')[0]),
      dGlyph: f((cb.top + cb.height / 2) - (g.top + g.height / 2)),   // ★본 자
      dBox: f((cb.top + cb.height / 2) - (tb.top + tb.height / 2)),   // ⛔항등식 자 — 기록만(판정에 안 쓴다)
      rowH: f(row.getBoundingClientRect().height),
    });
  }
  return out;
});

/* `.prop-row` 안의 토글 — ★대조군(41곳 꼴). 라벨 ★글자 중심과 견준다. */
const readPlainToggles = (page) => page.evaluate(() => {
  const f = (v) => Math.round(v * 100) / 100;
  const out = [];
  for (const row of document.querySelectorAll('#panel-right .prop-row')) {
    const lab = row.querySelector(':scope > .prop-label');
    const tg = row.querySelector(':scope > .prop-toggle');
    if (!lab || !tg) continue;
    const rg = document.createRange(); rg.selectNodeContents(lab);
    const g = rg.getBoundingClientRect(), cb = tg.getBoundingClientRect();
    out.push({ label: lab.textContent.trim(), dGlyph: f((cb.top + cb.height / 2) - (g.top + g.height / 2)) });
  }
  return out;
});

/* `.prop-section-title` ★자체가 flex 인 자리(텍스트 노드 ＋ 토글) — ★안 고쳐야 하는 것. */
const readFlexTitle = (page, secId) => page.evaluate((secId) => {
  const f = (v) => Math.round(v * 100) / 100;
  const t = document.querySelector(`#${secId} .prop-section-title`);
  if (!t) return null;
  const tn = [...t.childNodes].find((n) => n.nodeType === 3 && n.textContent.trim());
  const tg = t.querySelector('.prop-toggle');
  if (!tn || !tg) return null;
  const rg = document.createRange(); rg.selectNodeContents(tn);
  const g = rg.getBoundingClientRect(), cb = tg.getBoundingClientRect();
  return { text: tn.textContent.trim(), dGlyph: f((cb.top + cb.height / 2) - (g.top + g.height / 2)) };
}, secId);

/** ⑴ 가라앉기 ＋ ⑵ 두 번 읽어 같은가 — ★두 번 ★연속 같은 값이 나올 때까지만 쓴다(⛔고정 대기 금지). */
async function settled(page, reader, label, { allowEmpty = false } = {}) {
  let last = null, lastVal = null;
  await expect.poll(async () => {
    const cur = await reader(page);
    const s = JSON.stringify(cur);
    const same = last !== null && s === last;
    last = s; lastVal = cur;
    return same && (allowEmpty || (Array.isArray(cur) ? cur.length > 0 : cur !== null));
  }, { message: `${label} — 두 번 연속 같은 값(⑴가라앉기 ⑵두 번 읽기)`, timeout: 15000 }).toBe(true);
  return lastVal;
}

async function setup(page) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate((html) => { document.getElementById('canvas').innerHTML = html; window.rebindAll?.(); window.applyZoom?.(100); }, SEC_HTML);
  return errs;
}

/** 섹션의 빈 자리를 ★실제로 눌러 섹션을 고른다(넣기 입구가 고른 섹션을 본다). */
async function selectSection(page) {
  const r = await waitStableRect(page, SEC);
  await clickAt(page, r.left + r.width * 0.9, r.top + r.height * 0.9, { sel: SEC }, { label: '섹션 고르기' });
  await expect.poll(() => page.evaluate(() => document.getElementById('secT').classList.contains('selected')), '★전제: 섹션이 골라졌다').toBe(true);
}

/** ★사람 손 그대로 — Text 목록 → 「Body」. 넣기 입구가 선택을 새 블럭으로 옮긴다(T-084) ⇒ 텍스트 패널이 뜬다. */
async function addBodyText(page) {
  await selectSection(page);
  await page.evaluate(() => window.toggleFpDropdown?.('fp-text-dropdown'));
  await page.locator('#fp-text-dropdown .fp-menu-item', { hasText: 'Body' }).first().click();
  await expect.poll(() => page.evaluate(() => document.querySelectorAll('#secT .text-block').length), '★전제: Body 텍스트 블럭이 하나 생겼다').toBe(1);
}

/** ★사람 손 그대로 — 펜 목록 → 「Text Sticker」. */
async function addTextSticker(page) {
  await selectSection(page);
  await page.click('#fp-pen-btn');
  await page.click('#fp-pen-menu .fp-menu-item:text-is("Text Sticker")');
  await expect.poll(() => page.evaluate(() => document.querySelectorAll('#canvas .sticker-block[data-shape="text"]').length), '★전제: 텍스트 스티커가 하나 생겼다').toBe(1);
}

/** ★사람 손 그대로 — 컴포넌트 목록 → 「Grid」. */
async function addGrid(page) {
  await selectSection(page);
  await page.evaluate(() => window.toggleFpDropdown?.('fp-component-dropdown'));
  await page.locator('#fp-component-dropdown .fp-menu-item', { hasText: /^Grid$/ }).first().click();
  await expect.poll(() => page.evaluate(() => document.querySelectorAll('#secT .grid-block').length), '★전제: 그리드 블럭이 하나 생겼다').toBe(1);
}

/* ══ D0 전제 — 패널이 떴고 재는 자리가 ★몇 개인지 ★수로 박는다 (⛔0건 초록 금지) ══ */
test('D0 전제 — 텍스트 패널에 절 머리줄이 떴다(수를 로그에 박는다) · ⛔0건을 초록으로 닫지 않는다', async ({ page }) => {
  const errs = await setup(page);
  await addBodyText(page);
  const rows = await settled(page, readRows, 'D0 텍스트 패널');
  console.log('[D0] 텍스트 패널 절 머리줄 ' + rows.length + '개:\n' + JSON.stringify(rows, null, 1));
  expect(rows.length, '★전제: 텍스트 패널에 .prop-section-title-row 가 1개 이상 떴다').toBeGreaterThanOrEqual(1);
  /* ★명부 ⊇ 실패집합 — 이름으로 적어 둔다. 절이 늘면 ★늘어난 자리가 로그에 찍힌다(⛔==N 으로 닫지 않는다). */
  const names = rows.map((r) => r.sec).sort();
  console.log('[D0] 절 명부: ' + names.join(' · '));
  for (const want of ['txt-fx-section']) expect(names, `★전제: ${want} 가 이 장면에 있다`).toContain(want);
  expect(errs).toEqual([]);
});

/* ══ D0a ★PREMISE — ★레포 CSS 가 ★정말 물렸나 (플래너의 계측기 자기검사를 ★그대로 옮겼다) ══
   ★왜 — ★전제가 안 서면 D1 의 0.00 은 ★「가운데 맞았다」가 아니라 ★「안 재고 있다」다
     (스타일이 안 물린 맨 HTML 에서도 ★0.00 이 나올 수 있다).
   ★기대값은 ★소스에서 ★손으로 읽어 박았다 — ★계측 대상과 ★다른 경로다(⇒ 항등식이 아니다).
   ★★`.prop-section-title` 의 ★전역 padding 은 ★8px/4px ★그대로여야 한다 — 내 처방은 ★`.prop-section-title-row >`
     ★한정 규칙으로만 덮는다(239/244 자리는 ★안 건드린다). ⇒ ★이 칸이 ★그 경계를 ★같이 잠근다. */
test('D0a ★PREMISE — 레포 CSS 가 물렸다(패널 240px · 실물 toggle 32×18 · ★제목줄 ★밖 제목 padding 8/4 ★그대로 · row flex/center/24)', async ({ page }) => {
  const errs = await setup(page);
  await addBodyText(page);                 /* ★전제는 ★실물에서 읽는다 — ⛔빈 그릇에 ★가짜 div 를 넣어 재지 않는다 */
  /* ★★2026-10-20 실측으로 ★고친 자리 — 플래너의 격리 하네스는 이 칸의 기대값을 `.prop-toggle = inline-block`
     으로 두었는데 ★실앱에서는 ★`block` 이다. 까닭: `.panel { display: flex }`(css/panels/_panel-shell.css:54)
     이고 `.prop-row` 도 flex 라 ★.prop-toggle 은 ★언제나 ★flex 항목이다 ⇒ CSS 가 ★inline-block 을 ★블록화한다.
     ⇒ ★`display` 는 ★판정에 안 쓴다(로그에만). ★CSS 가 물렸다는 신호는 ★32×18 ★치수다(그 한 규칙에서만 온다).
     ⛔격리 하네스의 수를 ★그대로 옮겨 적으면 ★이 칸이 ★거짓 빨강을 낸다 — 내가 ★한 번 밟았다. */
  const pre = await page.evaluate(() => {
    const panel = document.getElementById('panel-right');
    const tg = document.querySelector('#panel-right .prop-row > .prop-toggle');
    const ti = [...document.querySelectorAll('#panel-right .prop-section-title')]
      .find((e) => !e.parentElement.classList.contains('prop-section-title-row'));   /* ★제목줄 ★밖 = 239곳 쪽 */
    const ro = document.querySelector('#panel-right .prop-row');
    const g = (e) => (e ? getComputedStyle(e) : null);
    const st = g(tg), sti = g(ti), sro = g(ro);
    return {
      panelW: g(panel).width,
      foundToggle: !!tg, foundTitleOutside: !!ti, foundRow: !!ro,
      toggleSize: st ? [st.width, st.height].join('|') : null,
      toggleDisplay: st ? st.display : null,          /* ★로그만 — flex 항목이라 블록화된다 */
      titleOutside: sti ? [sti.paddingTop, sti.paddingBottom, sti.fontSize].join('|') : null,
      row: sro ? [sro.display, sro.alignItems, sro.minHeight].join('|') : null,
    };
  });
  console.log('[D0a PREMISE] ' + JSON.stringify(pre));
  expect(pre.foundToggle && pre.foundTitleOutside && pre.foundRow,
    `★전제의 ★전제: 실물 부품을 찾았다 — ${JSON.stringify(pre)}`).toBe(true);
  expect(pre.panelW, '★우측 패널 너비 240px — css/editor-panels.css(panels/_panel-shell.css)가 안 물렸다').toBe('240px');
  expect(pre.toggleSize, '★.prop-toggle 의 32×18 — css/editor-props.css 의 그 한 규칙이 안 물렸다(⇒ 아래 0.00 은 「안 재고 있다」다)').toBe('32px|18px');
  expect(pre.titleOutside, '★★제목줄 ★밖 .prop-section-title 의 padding 이 8px/4px 가 ★아니다 — 내 처방이 ★239곳까지 ★번졌거나 CSS 가 안 물렸다').toBe('8px|4px|10px');
  expect(pre.row, '★.prop-row — flex/center/24px 가 아니다').toBe('flex|center|24px');
  expect(errs).toEqual([]);
});

/* ══ D0b ★계측기 양성대조 — 이 자가 ★0 이 아닌 값을 ★낼 수 있나 (판과 ★무관한 장면) ══
   ⛔인라인 style 로만 짓는다 — 레포 CSS 가 바뀌어도 이 칸의 기대값은 ★안 흔들린다.
   ★꼴 = 고치기 전 제목줄과 같다(위 8 / 아래 4 비대칭 ＋ align-items:center) ⇒ ★글자 자는 −2, ★상자 자는 0.
   ⇒ 「D1 이 초록」이 ★「안 재고 있다」와 ★구분된다. */
test('D0b ★계측기 양성대조 — 비대칭 padding 장면에서 글자 자는 −2.00 을 ★내고 상자 자는 0.00 을 낸다(상자 자 = 항등식)', async ({ page }) => {
  const errs = await setup(page);
  const r = await page.evaluate(() => {
    const f = (v) => Math.round(v * 100) / 100;
    const host = document.createElement('div');
    host.setAttribute('style', 'position:fixed;left:0;top:0;width:240px;font:700 10px/normal sans-serif');
    host.innerHTML = '<div style="display:flex;align-items:center;justify-content:space-between">'
      + '<div id="__pcT" style="padding:8px 0 4px;margin:0">Effects</div>'
      + '<span id="__pcC" style="display:inline-block;width:32px;height:18px"></span></div>';
    document.body.appendChild(host);
    const T = host.querySelector('#__pcT'), C = host.querySelector('#__pcC');
    const rg = document.createRange(); rg.selectNodeContents(T);
    const g = rg.getBoundingClientRect(), tb = T.getBoundingClientRect(), cb = C.getBoundingClientRect();
    const out = { dGlyph: f((cb.top + cb.height / 2) - (g.top + g.height / 2)), dBox: f((cb.top + cb.height / 2) - (tb.top + tb.height / 2)) };
    host.remove();
    return out;
  });
  console.log('[D0b] 계측기 자기장면: ' + JSON.stringify(r));
  expect(r.dGlyph, '★글자 자는 비대칭 8/4 를 −2.00 으로 ★잡아낸다 — 이 자는 죽지 않았다').toBeCloseTo(-2, 2);
  expect(r.dBox, '⛔상자 자는 같은 장면에서 0.00 — ★항등식이라 판정에 쓸 수 없다').toBeCloseTo(0, 2);
  expect(errs).toEqual([]);
});

/* ══ D1 ★본 단언 — 제목 ★글자와 손잡이가 가운데 맞았다 ══ */
test('D1 텍스트 패널 — 절 머리줄 전부 |손잡이중심 − 제목글자중심| ≤ 0.5px (Stroke · Shadow · Effects)', async ({ page }) => {
  const errs = await setup(page);
  await addBodyText(page);
  const rows = await settled(page, readRows, 'D1 텍스트 패널');
  console.log('[D1 텍스트] ' + JSON.stringify(rows, null, 1));
  expect(rows.length, '★전제: 잴 자리가 있다').toBeGreaterThanOrEqual(1);
  const bad = rows.filter((r) => Math.abs(r.dGlyph) > TOL);
  expect(bad, `어긋난 자리 ${bad.length}/${rows.length} — ★잰 값: ${JSON.stringify(rows.map((r) => r.sec + '=' + r.dGlyph))}`).toEqual([]);
  expect(errs).toEqual([]);
});

test('D1b 텍스트 스티커 패널 — Favorites(.prop-action-btn · ★R2) · Shadow(toggle) 둘 다 ≤ 0.5px', async ({ page }) => {
  const errs = await setup(page);
  await addTextSticker(page);
  const rows = await settled(page, readRows, 'D1b 스티커 패널');
  console.log('[D1b 스티커] ' + JSON.stringify(rows, null, 1));
  const names = rows.map((r) => r.sec);
  expect(names, '★전제: Favorites 절이 이 장면에 있다(.prop-action-btn 자리 — R2 를 재는 유일한 칸)').toContain('stk-fav-section');
  const bad = rows.filter((r) => Math.abs(r.dGlyph) > TOL);
  expect(bad, `어긋난 자리 ${bad.length}/${rows.length} — ★잰 값: ${JSON.stringify(rows.map((r) => r.sec + '=' + r.dGlyph))}`).toEqual([]);
  expect(errs).toEqual([]);
});

/* ══ D5 ★대가 — 절 머리줄 높이. ★처방의 ★값을 ★같이 잠근다 ══
   ★고치기 전: 토글·select 줄 ★24px · Favorites(.prop-action-btn) 줄 ★30px ⇒ ★꼴마다 ★높이가 달랐다.
   ★고친 뒤  : ★전부 28px — ★R2 를 끄니 단추 줄이 30→28 로 ★내려오고, 제목 padding 대칭으로 나머지가 24→28 로 ★올라간다.
   ⇒ ★이 칸은 ★「꼴이 달라도 절 머리줄 높이는 같다」를 잠근다(핀에서는 30≠24 로 ★빨강).
   ★대가의 ★수는 아래 console 에 ★패널 전체 높이로 찍는다(보고 ㉢). */
test('D5 ★대가 — 한 패널 안 절 머리줄 높이가 ★꼴마다 같다(핀에서는 30≠24) ＋ 패널 전체 높이를 수로 찍는다', async ({ page }) => {
  const errs = await setup(page);
  const panelH = (p) => p.evaluate(() => {
    const b = document.querySelector('#panel-right .panel-body') || document.getElementById('props') || document.getElementById('panel-right');
    return { id: b.id || b.className, scrollH: Math.round(b.scrollHeight) };
  });

  await addBodyText(page);
  const t = await settled(page, readRows, 'D5 텍스트 패널');
  const tH = await panelH(page);
  console.log(`[D5 텍스트 패널] 절 머리줄 높이 = ${JSON.stringify(t.map((r) => r.sec + ':' + r.rowH))} · 합 ${t.reduce((a, r) => a + r.rowH, 0)} · ★패널 전체 높이 ${tH.scrollH}px (${tH.id})`);

  await addTextSticker(page);
  const s = await settled(page, readRows, 'D5 스티커 패널');
  const sH = await panelH(page);
  console.log(`[D5 스티커 패널] 절 머리줄 높이 = ${JSON.stringify(s.map((r) => r.sec + ':' + r.rowH))} · 합 ${s.reduce((a, r) => a + r.rowH, 0)} · ★패널 전체 높이 ${sH.scrollH}px (${sH.id})`);

  for (const [name, rows] of [['텍스트', t], ['스티커', s]]) {
    expect(rows.length, `★전제: ${name} 패널에 잴 절 머리줄이 있다`).toBeGreaterThanOrEqual(1);
    const hs = [...new Set(rows.map((r) => r.rowH))];
    expect(hs.length, `★${name} 패널 절 머리줄 높이가 ★꼴마다 다르다: ${JSON.stringify(rows.map((r) => r.sec + '=' + r.rowH))}`).toBe(1);
  }
  expect(errs).toEqual([]);
});

/* ══ D3 ★범위 밖 — title-row 가 없는 패널은 ★FAIL 이 아니라 ★SKIP ══ */
test('D3 범위 밖 — 그리드 패널에 절 머리줄이 0개면 ★SKIP(⛔FAIL 아님) · 있으면 ★같은 자로 잰다', async ({ page }) => {
  const errs = await setup(page);
  await addGrid(page);
  await settled(page, (p) => p.evaluate(() => document.querySelectorAll('#panel-right .prop-section').length), 'D3 그리드 패널이 떴다');
  const rows = await readRows(page);
  console.log('[D3] 그리드 패널 절 머리줄 ' + rows.length + '개');
  test.skip(rows.length === 0, '★범위 밖: 그리드 패널엔 .prop-section-title-row 가 0개다 — 안 재는 것이 맞다(FAIL 아니라 SKIP)');
  const bad = rows.filter((r) => Math.abs(r.dGlyph) > TOL);
  expect(bad, `그리드 패널에도 절 머리줄이 생겼다 — 같은 자로 잰다: ${JSON.stringify(rows)}`).toEqual([]);
  expect(errs).toEqual([]);
});

/* ══ D4 ★대조군 — ★안 고칠 것을 ★안 고쳤다 ══ */
test('D4 대조군 — `.prop-row > .prop-toggle`(41곳 꼴)과 `#grd-bbg-section`(제목 ★자체가 flex)이 ★여전히 0.00px', async ({ page }) => {
  const errs = await setup(page);
  /* ★표본을 ★두 패널에서 모은다 — 한 패널에 토글이 하나뿐이면 「대조군 1개」가 되어 자가 ★약해진다. */
  await addBodyText(page);
  const plainText = await settled(page, readPlainToggles, 'D4 보통줄 토글(텍스트 패널)', { allowEmpty: true });
  await addTextSticker(page);
  const plainStk = await settled(page, readPlainToggles, 'D4 보통줄 토글(스티커 패널)');
  const plain = [...plainText, ...plainStk];
  console.log('[D4 보통줄 토글 ' + plain.length + '개 — 텍스트 ' + plainText.length + ' ＋ 스티커 ' + plainStk.length + '] ' + JSON.stringify(plain));
  expect(plain.length, '★전제: `.prop-row > .prop-toggle` 표본이 있다 — ⛔0건을 초록으로 닫지 않는다').toBeGreaterThanOrEqual(1);
  const badPlain = plain.filter((r) => Math.abs(r.dGlyph) > TOL);
  expect(badPlain, `★대조군이 움직였다 ${badPlain.length}/${plain.length} — 잰 값: ${JSON.stringify(plain)}`).toEqual([]);

  await addGrid(page);
  const flex = await settled(page, (p) => readFlexTitle(p, 'grd-bbg-section'), 'D4 #grd-bbg-section');
  console.log('[D4 #grd-bbg-section] ' + JSON.stringify(flex));
  expect(flex, '★전제: `#grd-bbg-section` 의 제목(텍스트 노드 ＋ 토글)을 찾았다').not.toBe(null);
  expect(Math.abs(flex.dGlyph) <= TOL, `★제목 자체가 flex 인 자리는 padding 이 ★두 자식을 같이 감싸므로 처방 전후 ★둘 다 0.00 이어야 한다 — 잰 값 ${flex.dGlyph}`).toBe(true);
  expect(errs).toEqual([]);
});
