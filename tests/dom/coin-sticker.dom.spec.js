/* coin-sticker — 코인 스티커(shape:'coin' · 0.9.8).
 *
 * ★무엇을 잠그나
 *   K0 전제(그리개가 실렸다 · 오류 0)
 *   K1 메뉴 「Coin」(실제 클릭) → 코인 스티커 1개 · 골라짐 · Coin 절 · 섹션을 안 골랐으면 안 생긴다
 *   K2 패널 구성 — 행 순서 · 기본 절·Shape 숨김 · 크기/회전/뿌리기 행 없음
 *   K3 다시뽑기 · 무늬번호 — 각도만 바뀐다(색·자리·크기 그대로) · 같은 번호 = 같은 각도
 *   K4 재질 금/은/커스텀 — 커스텀일 때만 색 행 · 색이 그림에 닿는다
 *   K5 각인 — 칩 · 직접 입력(2자 자르기 · 꺾쇠가 마크업이 안 된다)
 *   K6 두께 · 광택
 *   K7 각도 잠금 — 단추·칸 disabled · 잠긴 채 눌러도 각도 그대로 · 재질은 바뀐다 · 풀면 다시 돈다
 *   K8 ★저장 → 새 페이지에서 다시 열기 → 같은 그림(잠금 포함)
 *   K9 ★⌘Z / ⇧⌘Z — 패널 조작 한 번 = 한 칸
 *   K10 ★복제(⌘D · ⌘C⌘V · 섹션 ⌘C⌘V) — 사본의 gradient·clipPath id 가 제 블럭 id 에서 나오고 문서에서 안 겹친다
 *   K11 A/B 변형 · 섹션 템플릿 넣기 — 사본이 제 id 로 다시 그려진다
 *   K12 손잡이 — 이동 · 크기 · 회전(놓은 뒤 빛 방향 보정)
 *   K13 ★내보내기 그림 두 길(PNG = CDP 오프스크린 · 썸네일 = html2canvas) — gradient·clipPath·각인 글자가 산다
 *   K14 ★내보내기 HTML — 배송본에 코인 SVG 가 그대로 실리고 id 참조가 문서 안에서 풀린다
 *   K15 일반 「Sticker」 단추가 코인을 안 낳는다 · 다음 Coin 은 생김새를 잇고 각도는 새로
 *   K16 ★손댄 저장본 — 재질이 객체 내장 이름이거나 수가 깨져 있어도 열기가 안 멈추고, 뒤 스티커도 그려지고, 칸 = 그림
 * ★자리 비교는 «레이아웃 px»(dataset)로 한다. 화면 사각형은 «누를 점»을 정하는 데만 쓴다(멈춘 뒤 잰다 — waitStableRect).
 * ★기대값은 글자로 박았다: 무늬번호 201 → 기울기 35 · 방향 -24 (tests/unit/coin-sticker-draw.test.mjs 가 그 함수를 따로 잠근다).
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');
const { clickAt } = require('./_click-at.js');
const { expectOneUndoStep } = require('./_history-step.js');

const SEC = '[id="secK"]';
const SEC_HTML = (id, bg = '#f4f4f6') => `<div class="section-block" id="${id}" style="position:relative;height:420px;background:${bg}"><div class="section-inner"></div></div>`;

async function setup(page, html = SEC_HTML('secK')) {
  await page.evaluate((html) => {
    document.getElementById('canvas').innerHTML = html;
    window.rebindAll?.();
  }, html);
}

/* 섹션의 빈 자리(오른쪽 아래 귀퉁이 안쪽)를 실제로 눌러 섹션을 고른다. */
async function selectSection(page, sel = SEC) {
  const r = await waitStableRect(page, sel);
  await clickAt(page, r.left + r.width * 0.92, r.top + r.height * 0.9, { sel, not: '.sticker-block' }, { label: '섹션 고르기' });
  await expect.poll(() => page.evaluate((sel) => document.querySelector(sel).classList.contains('selected'), sel), '★전제: 섹션이 골라졌다').toBe(true);
}

const coinIds = (page) => page.evaluate(() => [...document.querySelectorAll('#canvas .sticker-block[data-shape="coin"]')].map((b) => b.id));

/* 실제 메뉴로 코인 하나. 돌려줌: 새 코인 id. */
async function addByMenu(page) {
  const before = await coinIds(page);
  await page.click('#fp-pen-btn');
  await page.click('#fp-pen-menu .fp-menu-item:text-is("Coin")');
  await expect.poll(async () => (await coinIds(page)).length, '★전제: 메뉴를 누른 뒤 코인이 하나 늘었다').toBe(before.length + 1);
  const after = await coinIds(page);
  return after.find((id) => !before.includes(id));
}

/* 코드로 코인 하나(메뉴가 주제가 아닌 칸) — 섹션에 붙이고 묶는다. */
async function make(page, opts = {}, secId = 'secK') {
  return page.evaluate(({ opts, secId }) => {
    const b = window.makeStickerBlock({ shape: 'coin', seed: 201, x: 120, y: 80, ...opts });
    document.getElementById(secId).appendChild(b);
    window.bindStickerSelect?.(b);
    return b.id;
  }, { opts, secId });
}

/* 캔버스 스크롤이 «멈췄다» — #canvas-wrap 의 scrollTop 이 연속 12 프레임 같을 때까지.
   섹션을 넣는 길(템플릿 넣기 → selectSection(sec, true))은 캔버스를 «부드럽게» 굴린다(js/editor.js selectSection 의 scrollTo smooth).
   굴리기가 막 시작되기 전에는 사각형이 잠깐 가만히 있어, 사각형만 두 번 재는 자(waitStableRect)가 그 틈을 «멈춤»으로 읽을 수 있다. */
async function scrollSettled(page) {
  await page.waitForFunction(() => new Promise((resolve) => {
    const w = document.getElementById('canvas-wrap');
    let last = w.scrollTop, same = 0;
    const tick = () => { const now = w.scrollTop; same = now === last ? same + 1 : 0; last = now; if (same >= 12) resolve(true); else requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  }));
}

/* 코인을 실제 마우스로 눌러 고른다.
   ① 굴리기가 멈추길 기다리고 ② 코인을 화면 가운데로 데려온 뒤(즉시 스크롤 — 진행 중인 부드러운 굴리기를 끊는다) ③ 다시 멈춤을 확인하고
   ④ ★전제: 누를 점이 뷰포트 안이고 그 점의 맨 위 요소가 그 코인(또는 그 자손)이다 — 화면 밖·상단바 아래를 누르지 않는다. */
async function pick(page, id) {
  const sel = `[id="${id}"]`;
  await scrollSettled(page);
  await page.evaluate((id) => document.getElementById(id).scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' }), id);
  await scrollSettled(page);
  const r = await waitStableRect(page, sel);
  const at = await page.evaluate(([x, y, id]) => {
    const e = document.elementFromPoint(x, y), b = document.getElementById(id);
    return { inView: x > 0 && y > 0 && x < window.innerWidth && y < window.innerHeight, onCoin: !!e && (e === b || b.contains(e)), hit: e ? (e.id || String(e.className) || e.tagName) : null };
  }, [r.cx, r.cy, id]);
  expect([at.inView, at.onCoin], `★전제: 누를 점 (${r.cx},${r.cy}) 이 뷰포트 안이고 그 코인 위다 — 맞힌 요소 «${at.hit}»`).toEqual([true, true]);
  await clickAt(page, r.cx, r.cy, { sel: '#' + id }, { label: '코인 고르기' });
  await expect.poll(() => page.evaluate((id) => document.getElementById(id)?.classList.contains('selected') && !!document.getElementById('stk-coin-section'), id),
    '★전제: 코인이 골라지고 Coin 절이 떴다').toBe(true);
}

/* 코인의 상태 — dataset · 그려진 SVG · id 정합. */
const read = (page, id) => page.evaluate((id) => {
  const b = document.getElementById(id);
  if (!b) return null;
  const svg = b.querySelector(':scope > svg');
  const html = svg ? svg.outerHTML : '';
  const ids = svg ? [...svg.querySelectorAll('[id]')].map((e) => e.id) : [];
  const refs = [...new Set([...html.matchAll(/url\(#([^)"]+)\)/g)].map((m) => m[1]))];
  const gloss = svg ? [...svg.querySelectorAll('rect')].map((r) => r.getAttribute('transform'))[0] || null : null;
  return {
    d: { ...b.dataset }, svg: html, ids, refs,
    ownIds: ids.length > 0 && ids.every((x) => x.startsWith('coin-' + id)),
    refsOwn: refs.length > 0 && refs.every((x) => ids.includes(x)),
    texts: svg ? [...new Set([...svg.querySelectorAll('text')].map((t) => t.textContent))] : [],
    textKids: svg ? [...svg.querySelectorAll('text')].reduce((n, t) => n + t.children.length, 0) : -1,
    viewBox: svg?.getAttribute('viewBox') || null, gloss,
    handles: b.querySelectorAll(':scope > .sticker-corner-handle').length, zones: b.querySelectorAll(':scope > .sticker-rotate-zone').length,
    selected: b.classList.contains('selected'), parent: b.parentElement?.id, left: b.style.left, top: b.style.top, w: b.offsetWidth, h: b.offsetHeight,
    transform: b.style.transform,
  };
}, id);

/* 문서 전체에서 id 가 겹치는 것(코인 그림의 id 만). */
const dupCoinIds = (page) => page.evaluate(() => {
  const all = [...document.querySelectorAll('[id]')].map((e) => e.id).filter((x) => x.startsWith('coin-'));
  return all.filter((x, i) => all.indexOf(x) !== i);
});

/* 우측 패널 칸에 «실제 키보드»로 값을 넣고 Enter. */
async function typeInto(page, sel, value) {
  await page.click(sel);
  await page.keyboard.press('Meta+a');
  if (value === '') await page.keyboard.press('Backspace'); else await page.keyboard.type(String(value));
  await page.keyboard.press('Enter');
}

async function dragMouse(page, from, to, steps = 8) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) await page.mouse.move(from.x + (to.x - from.x) * i / steps, from.y + (to.y - from.y) * i / steps);
  await page.mouse.up();
}
const zoomOf = (page) => page.evaluate(() => (window.currentZoom || 40) / 100);

test('K0 전제 — 그리개가 실렸고 오류 0건', async ({ page }) => {
  const errs = await bootApp(page);
  const r = await page.evaluate(() => ({ svg: typeof window.CoinFx?.svg, angle: typeof window.CoinFx?.angleFromSeed, seed: typeof window.FxSeed?.newSeed,
    make: typeof window.makeStickerBlock, defaults: { ...window.CoinFx?.DEFAULTS }, a201: [...(window.CoinFx?.angleFromSeed(201) || [])] }));
  expect(r).toEqual({ svg: 'function', angle: 'function', seed: 'function', make: 'function',
    defaults: { metal: 'gold', glyph: '$', k: 22, gloss: 22, size: 120 }, a201: [35, -24] });
  expect(errs).toEqual([]);
});

test('K1 메뉴 「Coin」 — 누르면 코인 스티커 1개가 생기고 골라진다 · 섹션을 안 골랐으면 안 생긴다', async ({ page }) => {
  const errs = await bootApp(page);
  await setup(page);
  /* 메뉴 항목의 꼴 — Marking(옛 Count Sticker · 1013t2B1) 바로 다음, 같은 class */
  const menu = await page.evaluate(() => [...document.querySelectorAll('#fp-pen-menu > .fp-menu-item')].map((b) => ({ t: b.textContent.trim(), c: b.className, title: !!b.title })));
  const at = menu.findIndex((m) => m.t === 'Coin');
  expect(at, '★전제: 메뉴에 「Coin」이 있다').toBeGreaterThan(0);
  expect(menu[at - 1].t, '「Coin」은 Marking 바로 다음').toBe('Marking');
  expect([menu[at].c, menu[at].title]).toEqual([menu[at - 1].c, true]);

  /* 섹션을 안 골랐을 때 — 안 생긴다(맨 아래 섹션으로 떨어지지 않는다) */
  expect(await page.evaluate(() => document.querySelectorAll('.selected').length), '★전제: 아무것도 안 골랐다').toBe(0);
  await page.click('#fp-pen-btn');
  await page.click('#fp-pen-menu .fp-menu-item:text-is("Coin")');
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.getElementById('fp-pen-menu')).display === 'none' || !document.querySelector('#fp-pen-dropdown.open')), '메뉴가 닫혔다').toBe(true);
  expect(await coinIds(page), '섹션을 안 골랐는데 코인이 생겼다').toEqual([]);

  await selectSection(page);
  const id = await addByMenu(page);
  const c = await read(page, id);
  expect(await coinIds(page), '한 번 누르면 정확히 1개').toEqual([id]);
  expect(c.parent, '코인은 섹션 직속이다').toBe('secK');
  expect([c.d.type, c.d.shape, c.d.coinMetal, c.d.coinGlyph, c.d.coinK, c.d.coinGloss, c.d.sizeW, c.d.sizeH]).toEqual(['sticker', 'coin', 'gold', '$', '22', '22', '120', '120']);
  expect(Number(c.d.seed), '만들 때 무늬번호가 박힌다').toBeGreaterThan(0);
  const want = await page.evaluate((s) => [...window.CoinFx.angleFromSeed(+s)].map(String), c.d.seed);
  expect([c.d.coinTilt, c.d.coinDir], '각도 = 무늬번호에서').toEqual(want);
  expect(c.d.coinLock, '새 코인은 안 잠겼다').toBeUndefined();
  expect(c.ids.length, '그림이 그려졌다(gradient 6 + clipPath 2)').toBe(8);
  expect(c.ownIds && c.refsOwn, `그림의 id 가 제 블럭 id 에서 나온다: ${c.ids.join(',')}`).toBe(true);
  expect(c.texts).toEqual(['$']);
  expect([c.w, c.h]).toEqual([120, 120]);
  expect(c.selected, '방금 만든 것이 골라진다').toBe(true);
  expect([c.handles, c.zones], '손잡이(크기 4 · 회전 4)가 붙는다').toEqual([4, 4]);
  const box = await page.evaluate((id) => { const b = document.getElementById(id), s = b.parentElement; return [b.offsetLeft >= 0, b.offsetTop >= 0, b.offsetLeft + b.offsetWidth <= s.clientWidth, b.offsetTop + b.offsetHeight <= s.clientHeight]; }, id);
  expect(box, '코인 상자가 섹션 안이다').toEqual([true, true, true, true]);
  expect(await page.evaluate(() => !!document.getElementById('stk-coin-section')), '우측 패널에 Coin 절이 뜬다').toBe(true);

  /* 낮은 섹션(150px) — 계단 자리(40,40)에 120 상자를 그대로 두면 아래로 넘친다. 상자 크기를 알고 안으로 당겨야 한다. */
  await setup(page, SEC_HTML('secK').replace('height:420px', 'height:150px'));
  await selectSection(page);
  const low = await addByMenu(page);
  const lowBox = await page.evaluate((id) => { const b = document.getElementById(id), s = b.parentElement; return { h: s.clientHeight, top: b.offsetTop, bottom: b.offsetTop + b.offsetHeight }; }, low);
  expect(lowBox.h, '★전제: 섹션 높이 150').toBe(150);
  expect(lowBox.top >= 0 && lowBox.bottom <= lowBox.h, `낮은 섹션에서 코인 상자가 밖으로 나갔다: ${JSON.stringify(lowBox)}`).toBe(true);
  expect(errs).toEqual([]);
});

test('K2 패널 구성 — 행 순서 · 기본 절과 Shape 는 숨고 · 크기/회전/뿌리기 행은 없다', async ({ page }) => {
  await bootApp(page);
  await setup(page);
  const id = await make(page);
  await pick(page, id);
  const r = await page.evaluate(() => {
    const vis = (el) => !!el && getComputedStyle(el).display !== 'none';
    const sec = document.getElementById('stk-coin-section');
    const nameOf = (row) => row.querySelector('.prop-label')?.textContent.trim() || (row.querySelector('#stk-coin-glyphs') ? '(각인 칩)' : row.querySelector('button')?.textContent.trim());
    const rows = [...sec.querySelectorAll(':scope > .prop-row')].filter(vis).map(nameOf);
    const all = [...sec.querySelectorAll(':scope > .prop-row')].map(nameOf);
    const chips = [...sec.querySelectorAll('#stk-coin-glyphs [data-coin-glyph]')];
    const rowH = (el) => Math.round(el.closest('.prop-row').getBoundingClientRect().height);
    const shapeSec = [...document.querySelectorAll('.prop-section')].find((s) => s.querySelector('.prop-section-title')?.textContent.trim() === 'Shape');
    return { title: sec.querySelector('.prop-section-title').textContent.trim(), rows, all,
      shape: vis(shapeSec), text: vis(document.getElementById('stk-text-section')), image: vis(document.getElementById('stk-image-section')), mode: vis(document.getElementById('stk-mode-section')),
      metals: [...sec.querySelectorAll('#stk-coin-metal [data-coin-metal]')].map((b) => b.textContent.trim() + (b.classList.contains('active') ? '*' : '')),
      glyphs: [...sec.querySelectorAll('#stk-coin-glyphs [data-coin-glyph]')].map((b) => b.textContent.trim() + (b.classList.contains('active') ? '*' : '')),
      gone: ['stk-coin-size', 'stk-coin-rot', 'stk-coin-tilt', 'stk-coin-dir', 'stk-coin-scatter', 'stk-coin-count', 'stk-coin-scatter-section'].filter((x) => document.getElementById(x)),
      chipTops: [...new Set(chips.map((b) => Math.round(b.getBoundingClientRect().top)))].length, chipRowH: rowH(chips[0]), metalRowH: rowH(document.getElementById('stk-coin-metal')),
      chipFit: chips.every((b) => b.scrollWidth <= b.clientWidth + 1), glyphRowHasInput: document.getElementById('stk-coin-glyph').closest('.prop-row').querySelector('.prop-label')?.textContent.trim(),
      glyphMax: document.getElementById('stk-coin-glyph').placeholder, lock: document.getElementById('stk-coin-lock').checked,
      favDim: getComputedStyle(document.getElementById('stk-fav-add')).opacity,
      head: document.querySelector('#stk-coin-section')?.closest('#prop-panel, .prop-panel, body').querySelector('.prop-block-name')?.textContent.trim() };
  });
  expect(r.title).toBe('Coin');
  expect(r.rows, '보이는 행(금 코인 — 색 행은 숨는다)').toEqual(['다시뽑기', '무늬번호', '재질', '각인', '(각인 칩)', '두께', '광택', '각도 잠금']);
  expect(r.all, '전체 행 — 색 둘은 재질 바로 아래').toEqual(['다시뽑기', '무늬번호', '재질', '앞면 색', '옆면 색', '각인', '(각인 칩)', '두께', '광택', '각도 잠금']);
  expect(r.glyphRowHasInput, '직접 입력 칸은 「각인」 행에 있다').toBe('각인');
  expect(r.chipTops, '각인 칩 다섯이 한 줄이다(「없음」이 혼자 둘째 줄로 안 떨어진다)').toBe(1);
  expect(r.chipRowH, '칩 행의 높이가 이웃(재질) 행과 같다').toBe(r.metalRowH);
  expect(r.chipFit, '칩 글자가 칩 안에 들어간다').toBe(true);
  expect([r.shape, r.text, r.image, r.mode], 'Shape·Text·Image·이미지 모드 절은 숨는다').toEqual([false, false, false, false]);
  expect(r.metals).toEqual(['금*', '은', '커스텀']);
  expect(r.glyphs).toEqual(['$*', '₩', 'P', '%', '없음']);
  expect(r.gone, '크기·회전·기울기·방향·뿌리기 칸은 없다(손잡이가 한다)').toEqual([]);
  expect(r.glyphMax).toBe('직접 입력 (1~2자)');
  expect(r.lock).toBe(false);
  expect(r.favDim, '즐겨찾기 미지원 모양 — 추가 단추가 흐리다').toBe('0.4');
  expect(r.head, '헤더 이름은 다른 스티커와 같다').toBe('Sticker');
  const fav = await page.evaluate((id) => ({ ok: window.addStickerFavorite(document.getElementById(id)), toast: document.getElementById('editor-toast')?.textContent || null }), id);
  expect(fav, '즐겨찾기는 조용히 실패하지 않고 «말하고» 거절한다(glow 와 같은 길)').toEqual({ ok: false, toast: '⚠️ 이 모양은 즐겨찾기에 추가할 수 없습니다' });
});

test('K3 다시뽑기 · 무늬번호 — 각도만 바뀐다 · 같은 번호 = 같은 각도', async ({ page }) => {
  await bootApp(page);
  await setup(page);
  const id = await make(page, { seed: 7, coinMetal: 'silver', coinGlyph: 'P' });
  await pick(page, id);
  const a = await read(page, id);
  expect([a.d.seed, a.d.coinTilt, a.d.coinDir], '★전제: 무늬번호 7 → 1 · -158').toEqual(['7', '1', '-158']);
  await page.click('#stk-coin-reroll');
  await expect.poll(async () => (await read(page, id)).d.seed, '다시뽑기를 눌렀는데 무늬번호가 그대로다').not.toBe('7');
  const b = await read(page, id);
  const want = await page.evaluate((s) => [...window.CoinFx.angleFromSeed(+s)].map(String), b.d.seed);
  expect([b.d.coinTilt, b.d.coinDir], '각도 = 새 무늬번호에서').toEqual(want);
  expect(b.svg, '각도가 바뀌었는데 그림이 그대로다').not.toBe(a.svg);
  expect([b.d.coinMetal, b.d.coinGlyph, b.d.coinK, b.d.coinGloss, b.d.x, b.d.y, b.d.sizeW, b.d.sizeH, b.viewBox], '다시뽑기는 색·각인·자리·크기를 안 건드린다')
    .toEqual([a.d.coinMetal, a.d.coinGlyph, a.d.coinK, a.d.coinGloss, a.d.x, a.d.y, a.d.sizeW, a.d.sizeH, a.viewBox]);
  expect(await page.inputValue('#stk-coin-seed'), '칸이 새 번호를 보여 준다').toBe(b.d.seed);
  expect([b.handles, b.zones], '다시 그린 뒤에도 손잡이가 남는다').toEqual([4, 4]);

  await typeInto(page, '#stk-coin-seed', 201);
  await expect.poll(async () => (await read(page, id)).d.seed).toBe('201');
  const c = await read(page, id);
  expect([c.d.coinTilt, c.d.coinDir], '무늬번호 201 → 기울기 35 · 방향 -24').toEqual(['35', '-24']);
  await typeInto(page, '#stk-coin-seed', 7);
  await expect.poll(async () => (await read(page, id)).d.seed).toBe('7');
  const d = await read(page, id);
  expect(d.svg, '같은 번호인데 그림이 다르다').toBe(a.svg);
  /* 빈 칸은 0 번이 아니다 — 아무것도 안 쓴다 */
  await typeInto(page, '#stk-coin-seed', '');
  expect((await read(page, id)).d.seed, '칸을 비웠더니 무늬번호가 바뀌었다').toBe('7');
  await page.evaluate(() => { const s = document.getElementById('stk-coin-seed'); s.value = ''; s.dispatchEvent(new Event('input', { bubbles: true })); });
  expect((await read(page, id)).d.seed, '빈 값(프로그램 입력)이 0 번으로 읽혔다').toBe('7');
});

test('K4 재질 — 금/은/커스텀 · 커스텀일 때만 색 행 · 색이 그림에 닿는다', async ({ page }) => {
  await bootApp(page);
  await setup(page);
  const id = await make(page);
  await pick(page, id);
  const rowsShown = () => page.evaluate(() => ['stk-coin-face-row', 'stk-coin-side-row'].map((x) => getComputedStyle(document.getElementById(x)).display !== 'none'));
  const gold = await read(page, id);
  expect(gold.svg.includes('#F5C542') && !gold.svg.includes('#D3D9E2'), '★전제: 금 코인').toBe(true);
  expect(await rowsShown(), '금일 때 색 행은 숨는다').toEqual([false, false]);

  await page.click('#stk-coin-metal [data-coin-metal="silver"]');
  const silver = await read(page, id);
  expect(silver.d.coinMetal).toBe('silver');
  expect(silver.svg.includes('#D3D9E2') && !silver.svg.includes('#F5C542'), '은을 눌렀는데 그림이 금이다').toBe(true);
  expect(await rowsShown()).toEqual([false, false]);

  await page.click('#stk-coin-metal [data-coin-metal="custom"]');
  const custom = await read(page, id);
  expect(custom.d.coinMetal).toBe('custom');
  expect(await rowsShown(), '커스텀이면 앞면·옆면 색 행이 뜬다').toEqual([true, true]);
  expect([custom.d.coinFace, custom.d.coinSide], '커스텀 첫 색 = 방금 보이던 은의 대표 두 색').toEqual(['#d3d9e2', '#8e97a4']);
  expect(await page.inputValue('#stk-coin-face-hex'), '색칸이 저장값을 보여 준다').toBe('D3D9E2');
  /* 코인 색은 불투명뿐 — 색칸의 불투명도 칸은 안 보이고 꺼져 있다(먹는 척하는 칸이 없다) */
  const alpha = await page.evaluate(() => ['face', 'side'].map((k) => { const a = document.getElementById(`stk-coin-${k}-alpha`);
    /* 보이나 = 레이아웃 상자가 있나(offsetWidth — 배율과 무관) */
    return { there: !!a, disabled: a.disabled, shown: a.offsetWidth > 0, hexShown: document.getElementById(`stk-coin-${k}-hex`).offsetWidth > 0 }; }));
  expect(alpha, '불투명도 칸이 보이거나 켜져 있다').toEqual([{ there: true, disabled: true, shown: false, hexShown: true }, { there: true, disabled: true, shown: false, hexShown: true }]);

  await typeInto(page, '#stk-coin-face-hex', '3366FF');
  await expect.poll(async () => (await read(page, id)).d.coinFace, '앞면 색 칸에 넣은 값이 저장된다').toBe('#3366ff');
  const blue = await read(page, id);
  expect(blue.svg.includes('#3366ff'), '앞면 색이 그림에 안 닿는다').toBe(true);
  await typeInto(page, '#stk-coin-side-hex', '112244');
  await expect.poll(async () => (await read(page, id)).d.coinSide).toBe('#112244');
  expect((await read(page, id)).svg, '옆면 색이 그림에 안 닿는다').not.toBe(blue.svg);

  await page.click('#stk-coin-metal [data-coin-metal="gold"]');
  const back = await read(page, id);
  expect(back.svg, '금으로 돌아오면 처음 그림과 같다(커스텀 색은 안 읽는다)').toBe(gold.svg);
  expect(await rowsShown()).toEqual([false, false]);
  expect([back.handles, back.zones]).toEqual([4, 4]);
});

test('K5 각인 — 칩 · 직접 입력은 2자에서 잘리고, 꺾쇠는 글자로만 들어간다', async ({ page }) => {
  await bootApp(page);
  await setup(page);
  const id = await make(page);
  await pick(page, id);
  expect((await read(page, id)).texts, '★전제: 기본 각인 $').toEqual(['$']);
  const active = () => page.evaluate(() => [...document.querySelectorAll('#stk-coin-glyphs .active')].map((b) => b.dataset.coinGlyph));

  await page.click('#stk-coin-glyphs [data-coin-glyph="₩"]');
  let c = await read(page, id);
  expect([c.d.coinGlyph, c.texts, await active(), await page.inputValue('#stk-coin-glyph')]).toEqual(['₩', ['₩'], ['₩'], '₩']);

  await page.click('#stk-coin-glyphs [data-coin-glyph=""]');
  c = await read(page, id);
  expect([c.d.coinGlyph, c.texts, await active()], '「없음」 = 각인이 안 그려진다').toEqual(['', [], ['']]);

  await typeInto(page, '#stk-coin-glyph', 'AB');
  c = await read(page, id);
  expect([c.d.coinGlyph, c.texts, await active()], '직접 입력 — 칩에 없는 글자면 칩은 다 꺼진다').toEqual(['AB', ['AB'], []]);

  await typeInto(page, '#stk-coin-glyph', 'WXYZ');
  c = await read(page, id);
  expect([c.d.coinGlyph, c.texts, await page.inputValue('#stk-coin-glyph')], '2자에서 잘린다(칸 · 저장 · 그림)').toEqual(['WX', ['WX'], 'WX']);

  /* 이스케이프가 없으면 마크업이 깨지는 글자 — `<b` 는 태그가 열리고, `&l` 은 뒤 글자와 붙어 실체참조가 될 수 있다 */
  for (const g of ['<b', '"x', '&l', '</']) {
    await typeInto(page, '#stk-coin-glyph', g);
    c = await read(page, id);
    const shape = await page.evaluate((id) => { const svg = document.querySelector(`[id="${id}"] > svg`); return { texts: svg.querySelectorAll('text').length, odd: [...svg.querySelectorAll('*')].map((e) => e.localName).filter((n) => !['defs', 'linearGradient', 'stop', 'clipPath', 'ellipse', 'g', 'path', 'text', 'rect'].includes(n)) }; }, id);
    expect([c.d.coinGlyph, c.texts, c.textKids], `각인 ${g}: 글자 그대로 들어간다 — <text> 안에 요소가 안 생긴다`).toEqual([g, [g], 0]);
    expect([c.ids.length, shape.odd, shape.texts > 0], `각인 ${g}: 그림 구조가 그대로다(뜻밖의 요소 0)`).toEqual([8, [], true]);
  }
  /* 공백뿐 = 각인 없음(안 보이는 각인이 저장되지 않는다) */
  await typeInto(page, '#stk-coin-glyph', '  ');
  c = await read(page, id);
  expect([c.d.coinGlyph, c.texts, await active(), await page.inputValue('#stk-coin-glyph')], '공백뿐인 입력은 「없음」').toEqual(['', [], [''], '']);

  await typeInto(page, '#stk-coin-glyph', 'P');
  expect(await active(), '칩에 있는 글자를 치면 그 칩이 켜진다').toEqual(['P']);
});

test('K6 두께 · 광택 — 숫자칸이 그림에 닿는다', async ({ page }) => {
  await bootApp(page);
  await setup(page);
  const id = await make(page);
  await pick(page, id);
  const a = await read(page, id);
  expect([a.d.coinK, a.d.coinGloss, a.viewBox], '★전제').toEqual(['22', '22', '-72 -72 144 144']);
  await typeInto(page, '#stk-coin-k-num', 40);
  await expect.poll(async () => (await read(page, id)).d.coinK).toBe('40');
  const b = await read(page, id);
  expect(b.viewBox, '두께 40 → viewBox ±90').toBe('-90 -90 180 180');
  expect(await page.inputValue('#stk-coin-k'), '슬라이더가 숫자칸을 따라온다').toBe('40');
  await typeInto(page, '#stk-coin-k-num', 99);
  await expect.poll(async () => (await read(page, id)).d.coinK, '범위(8~40) 밖은 끝값으로').toBe('40');
  expect(await page.inputValue('#stk-coin-k-num'), '칸 = 저장값').toBe('40');

  const hasGloss = (svg) => /fill="url\(#coin-[^"]*g\)"/.test(svg);
  expect(hasGloss(b.svg), '★전제: 광택 띠가 있다').toBe(true);
  await typeInto(page, '#stk-coin-gloss-num', 0);
  await expect.poll(async () => (await read(page, id)).d.coinGloss).toBe('0');
  expect(hasGloss((await read(page, id)).svg), '광택 0 인데 띠가 남았다').toBe(false);
  await typeInto(page, '#stk-coin-gloss-num', 80);
  await expect.poll(async () => (await read(page, id)).d.coinGloss).toBe('80');
  const g = await read(page, id);
  expect(/opacity="0\.8"/.test(g.svg) && hasGloss(g.svg), '광택 80 = 띠 불투명도 0.8').toBe(true);
  expect([g.handles, g.zones]).toEqual([4, 4]);
});

test('K7 각도 잠금 — 켜면 다시뽑기·무늬번호가 이 코인을 안 바꾼다 · 재질은 바뀐다 · 풀면 다시 돈다', async ({ page }) => {
  await bootApp(page);
  await setup(page);
  const id = await make(page);
  await pick(page, id);
  const a = await read(page, id);
  const ctl = () => page.evaluate(() => ({ reroll: document.getElementById('stk-coin-reroll').disabled, seed: document.getElementById('stk-coin-seed').disabled, lock: document.getElementById('stk-coin-lock').checked }));
  expect(await ctl(), '★전제: 안 잠겼다').toEqual({ reroll: false, seed: false, lock: false });

  await page.click('#stk-coin-section .prop-toggle');
  await expect.poll(async () => (await read(page, id)).d.coinLock, '토글을 켰는데 data-coin-lock 이 안 붙었다').toBe('1');
  expect(await ctl(), '잠그면 단추·칸이 둘 다 disabled').toEqual({ reroll: true, seed: true, lock: true });
  /* 꺼진 단추는 흐리게 보인다 — 값은 토큰(--ui-disabled-opacity) */
  const look = () => page.evaluate(() => { const b = document.getElementById('stk-coin-reroll'), cs = getComputedStyle(b);
    return { opacity: parseFloat(cs.opacity), cursor: cs.cursor, token: parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ui-disabled-opacity')) }; });
  const dim = await look();
  expect(dim.token > 0 && dim.token < 1, `★전제: 토큰 --ui-disabled-opacity 가 있다 (${dim.token})`).toBe(true);
  expect([dim.opacity, dim.cursor], '잠긴 다시뽑기 단추가 눌릴 것처럼 보인다').toEqual([dim.token, 'not-allowed']);
  expect(/data-coin-lock="1"/.test(await page.evaluate(() => window.getSerializedCanvas())), '저장본에 data-coin-lock="1" 이 실린다').toBe(true);

  /* 잠긴 단추를 진짜로 누른다 — 누르는 점이 그 단추 위다 */
  await page.locator('#stk-coin-reroll').scrollIntoViewIfNeeded();
  const rr = await waitStableRect(page, '#stk-coin-reroll');
  await clickAt(page, rr.cx, rr.cy, { sel: '#stk-coin-reroll' }, { label: '잠긴 다시뽑기' });
  /* 칸의 disabled 를 건너뛰는 길(프로그램 입력)로도 못 바꾼다 — 각도를 쓰는 길이 잠금을 다시 본다 */
  await page.evaluate(() => {
    const s = document.getElementById('stk-coin-seed'); s.value = '12345';
    s.dispatchEvent(new Event('input', { bubbles: true })); s.dispatchEvent(new Event('change', { bubbles: true }));
    const b = document.getElementById('stk-coin-reroll'); b.disabled = false; b.click(); b.disabled = true;
  });
  const b = await read(page, id);
  expect([b.d.seed, b.d.coinTilt, b.d.coinDir, b.svg === a.svg], '잠긴 코인의 각도가 바뀌었다').toEqual(['201', '35', '-24', true]);
  expect(await page.inputValue('#stk-coin-seed'), '칸은 저장값으로 되돌아온다').toBe('201');

  await page.click('#stk-coin-metal [data-coin-metal="silver"]');
  const s = await read(page, id);
  expect([s.d.coinMetal, s.d.coinTilt, s.d.coinDir, s.d.coinLock], '잠가도 재질은 바뀌고 각도는 그대로').toEqual(['silver', '35', '-24', '1']);

  /* 다른 것을 골랐다 돌아와도 잠금이 보인다(패널 = 저장값) */
  await selectSection(page);
  await pick(page, id);
  expect(await ctl(), '다시 골랐을 때 잠금 표시').toEqual({ reroll: true, seed: true, lock: true });

  await page.click('#stk-coin-section .prop-toggle');
  await expect.poll(async () => (await read(page, id)).d.coinLock, '끄면 속성을 지운다').toBeUndefined();
  expect(await ctl()).toEqual({ reroll: false, seed: false, lock: false });
  expect((await look()).opacity, '풀면 단추가 원래대로 보인다').toBe(1);
  await page.click('#stk-coin-reroll');
  await expect.poll(async () => (await read(page, id)).d.seed, '풀었는데 다시뽑기가 안 돈다').not.toBe('201');
});

test('K8 ★저장 → 새 페이지에서 다시 열기 — 같은 그림 · 같은 값 · 잠금 유지', async ({ page }) => {
  await bootApp(page);
  await setup(page);
  const id = await make(page, { seed: 199, coinMetal: 'custom', coinFace: '#3366ff', coinSide: '#112244', coinGlyph: '₩', coinK: 30, coinGloss: 60, rotation: 25, sizeW: 160, sizeH: 160, x: 200, y: 90 });
  await pick(page, id);
  await page.click('#stk-coin-section .prop-toggle');
  await expect.poll(async () => (await read(page, id)).d.coinLock).toBe('1');
  const before = await read(page, id);
  expect([before.d.coinTilt, before.d.coinDir, before.ids.length], '★전제: 무늬번호 199 → 74 · 5, 그림이 있다').toEqual(['74', '5', 8]);

  const snap = await page.evaluate(() => window.serializeProject());
  /* 저장본은 HTML 이다 — 속성 이름은 data-kebab 꼴로 찾는다 */
  for (const attr of ['data-shape="coin"', 'data-seed="199"', 'data-coin-tilt="74"', 'data-coin-dir="5"', 'data-coin-metal="custom"', 'data-coin-face="#3366ff"',
    'data-coin-side="#112244"', 'data-coin-glyph="₩"', 'data-coin-k="30"', 'data-coin-gloss="60"', 'data-coin-lock="1"', 'data-rotation="25"']) {
    expect(JSON.parse(snap) && snap.includes(attr.replace(/"/g, '\\"')), `저장본에 ${attr} 가 없다`).toBe(true);
  }
  expect(/sticker-corner-handle|sticker-rotate-zone/.test(snap), '저장본에 손잡이가 샜다').toBe(false);

  const errs = await bootApp(page);                       // 새 페이지 로드 = 앱 재기동
  expect(await coinIds(page), '★전제: 새 페이지엔 코인이 없다').toEqual([]);
  await page.evaluate((d) => window.applyProjectData(JSON.parse(d)), snap);
  await expect.poll(async () => (await coinIds(page)).length, '다시 열었는데 코인이 없다').toBe(1);
  const after = await read(page, id);
  expect(after, '★같은 id 로 돌아왔다').not.toBeNull();
  expect(after.d, '값이 전부 같다').toEqual(before.d);
  expect(after.svg, '★다시 연 그림이 저장 전과 다르다').toBe(before.svg);
  expect([after.ownIds, after.refsOwn, after.transform]).toEqual([true, true, 'rotate(25deg)']);
  expect(await dupCoinIds(page)).toEqual([]);
  await pick(page, id);
  expect(await page.evaluate(() => [document.getElementById('stk-coin-lock').checked, document.getElementById('stk-coin-reroll').disabled, document.getElementById('stk-coin-seed').disabled,
    document.getElementById('stk-coin-seed').value, document.getElementById('stk-coin-face-hex').value]), '다시 연 뒤 패널이 저장값을 보여 준다').toEqual([true, true, true, '199', '3366FF']);
  expect(errs).toEqual([]);
});

test('K9 ★⌘Z / ⇧⌘Z — 패널 조작 한 번 = 한 칸, 되돌리면 그림도 돌아온다', async ({ page }) => {
  test.setTimeout(150000);
  await bootApp(page);
  await setup(page);
  await selectSection(page);
  const id = await addByMenu(page);
  const a = await read(page, id);
  const one = async (label, action, changed) => {
    await pick(page, id);
    const before = await read(page, id);
    const h = await expectOneUndoStep(page, action, label, { soft: true });
    expect(h.changed, `${label}: A0 조작이 화면을 바꿨다`).toBe(true);
    expect(h.dPos >= 1 && h.seqNew, `${label}: A1 조작 직후 꼭대기가 새 칸(끝 표본) — Δpos=${h.dPos}`).toBe(true);
    expect([h.undoDLen, h.undoDPos], `${label}: A2 ⌘Z 가 구제 칸을 안 만들고 정확히 한 칸 내려간다`).toEqual([0, -1]);
    const undone = await read(page, id);
    expect(undone, `${label}: ⌘Z 뒤에도 코인이 있다(삽입까지 먹지 않았다)`).not.toBeNull();
    expect(undone.d, `${label}: ⌘Z 한 번에 값이 조작 전으로`).toEqual(before.d);
    expect(undone.svg, `${label}: ⌘Z 한 번에 그림이 조작 전으로`).toBe(before.svg);
    await page.keyboard.press('Meta+Shift+z');
    await expect.poll(async () => changed((await read(page, id)).d), `${label}: ⇧⌘Z 로 다시 실행된다`).toBe(true);
    const redone = await read(page, id);
    expect([redone.ownIds, redone.refsOwn], `${label}: 다시 실행한 그림의 id 가 제 것`).toEqual([true, true]);
  };
  await one('재질', () => page.click('#stk-coin-metal [data-coin-metal="silver"]'), (d) => d.coinMetal === 'silver');
  await one('각인 칩', () => page.click('#stk-coin-glyphs [data-coin-glyph="%"]'), (d) => d.coinGlyph === '%');
  await one('다시뽑기', () => page.click('#stk-coin-reroll'), (d) => d.seed !== a.d.seed);
  await one('두께', () => typeInto(page, '#stk-coin-k-num', 35), (d) => d.coinK === '35');
  await one('광택', () => typeInto(page, '#stk-coin-gloss-num', 60), (d) => d.coinGloss === '60');
  await one('무늬번호', () => typeInto(page, '#stk-coin-seed', 225), (d) => d.seed === '225' && d.coinTilt === '1' && d.coinDir === '-27');
  await one('직접 입력', () => typeInto(page, '#stk-coin-glyph', 'AB'), (d) => d.coinGlyph === 'AB');
  await one('재질(커스텀)', () => page.click('#stk-coin-metal [data-coin-metal="custom"]'), (d) => d.coinMetal === 'custom');
  await one('앞면 색', () => typeInto(page, '#stk-coin-face-hex', '3366FF'), (d) => d.coinFace === '#3366ff');
  await one('옆면 색', () => typeInto(page, '#stk-coin-side-hex', '112244'), (d) => d.coinSide === '#112244');
  await one('각도 잠금', () => page.click('#stk-coin-section .prop-toggle'), (d) => d.coinLock === '1');
  const end = await read(page, id);
  expect([end.d.coinMetal, end.d.coinGlyph, end.d.coinK, end.d.coinGloss, end.d.seed, end.d.coinFace, end.d.coinSide, end.d.coinLock], '열한 조작이 다 다시 실행된 채다')
    .toEqual(['custom', 'AB', '35', '60', '225', '#3366ff', '#112244', '1']);
});

test('K10 ★복제 — ⌘D · ⌘C⌘V · 섹션 ⌘C⌘V 의 사본이 제 id 로 다시 그려진다(문서에서 id 겹침 0)', async ({ page }) => {
  test.setTimeout(90000);
  await bootApp(page);
  await setup(page);
  const id = await make(page, { coinMetal: 'silver', coinGlyph: 'P', x: 300, y: 120 });
  const check = async (label, n) => {
    await expect.poll(async () => (await coinIds(page)).length, `★전제(${label}): 코인이 ${n}개가 됐다`).toBe(n);
    const ids = await coinIds(page);
    expect(new Set(ids).size, `${label}: 블럭 id 가 겹친다`).toBe(n);
    for (const x of ids) {
      const c = await read(page, x);
      expect(c.ids.length, `${label}: ${x} 의 그림 id 수`).toBe(8);
      expect(c.ownIds, `${label}: ${x} 의 gradient·clipPath id 가 제 블럭 id 에서 안 나왔다 — ${c.ids.join(',')}`).toBe(true);
      expect(c.refsOwn, `${label}: ${x} 의 url(#…) 가 남의 것을 가리킨다 — ${c.refs.join(',')}`).toBe(true);
      expect([c.d.coinMetal, c.d.coinGlyph, c.d.seed, c.d.coinTilt, c.d.coinDir], `${label}: ${x} 가 원본의 생김새·각도를 물려받았다`).toEqual(['silver', 'P', '201', '35', '-24']);
    }
    expect(await dupCoinIds(page), `${label}: 문서에 같은 id 가 둘이다`).toEqual([]);
    return ids;
  };
  await pick(page, id);
  await page.keyboard.press('Meta+d');
  const two = await check('⌘D', 2);

  /* ⌘D 뒤에는 원본과 사본이 둘 다 골라진 채다(스티커 공통의 기존 동작) — 하나만 고른 상태에서 복사하도록 선택을 비우고 다시 고른다 */
  await selectSection(page);
  await pick(page, id);
  expect(await page.evaluate(() => [...document.querySelectorAll('.sticker-block.selected')].map((b) => b.id)), '★전제: 원본 하나만 골랐다').toEqual([id]);
  await page.keyboard.press('Meta+c');
  await page.keyboard.press('Meta+v');
  const three = await check('⌘C⌘V', 3);
  const pasted = three.find((x) => !two.includes(x));
  expect((await read(page, pasted)).selected, '붙여넣은 사본은 묶여 있고 골라진다').toBe(true);

  /* 섹션째 복사 — 사본 섹션 안의 코인들도 제 id 로 */
  await selectSection(page);
  expect(await page.evaluate(() => document.querySelectorAll('.sticker-block.selected').length), '★전제: 섹션만 골랐다').toBe(0);
  await page.keyboard.press('Meta+c');
  await page.keyboard.press('Meta+v');
  await expect.poll(() => page.evaluate(() => document.querySelectorAll('#canvas .section-block').length), '★전제: 섹션이 둘이 됐다').toBe(2);
  const six = await check('섹션 ⌘C⌘V', 6);
  /* 원본 섹션을 지워도 사본의 그림은 제 것을 가리킨다(원본 것을 빌려 쓰지 않는다) */
  await page.evaluate(() => document.getElementById('secK').remove());
  const rest = six.filter((x) => !three.includes(x));
  expect(rest.length).toBe(3);
  for (const x of rest) {
    const c = await read(page, x);
    const live = await page.evaluate((refs) => refs.every((r) => !!document.getElementById(r)), c.refs);
    expect(live && c.refsOwn, `원본 섹션을 지웠더니 ${x} 의 참조가 끊겼다`).toBe(true);
  }
  /* 사본 섹션의 코인은 눌러서 골라진다(묶였다) */
  await pick(page, rest[0]);
});

test('K11 A/B 변형 · 섹션 템플릿 넣기 — 사본이 제 id 로 다시 그려진다', async ({ page }) => {
  await bootApp(page);
  await setup(page);
  const id = await make(page);
  await page.evaluate(() => window.createVariation(document.getElementById('secK')));
  await expect.poll(async () => (await coinIds(page)).length, '★전제: 변형 사본이 생겼다').toBe(2);
  const [, vid] = await coinIds(page);
  expect(vid).not.toBe(id);
  const v = await read(page, vid);
  expect([v.ids.length, v.ownIds, v.refsOwn], `변형 사본의 그림 id: ${v.ids.join(',')}`).toEqual([8, true, true]);
  expect(await dupCoinIds(page)).toEqual([]);

  /* 섹션 템플릿 — 저장된 꼴(직렬화본)을 그대로 넣는다. 원본은 문서에서 지운 뒤라 빌려 쓸 id 가 없다. */
  const tplHtml = await page.evaluate(() => window.serializeSectionClone(document.getElementById('secK')));
  expect(/data-shape="coin"/.test(tplHtml) && /<linearGradient/.test(tplHtml), '★전제: 템플릿 본문에 코인과 그림이 실렸다').toBe(true);
  await setup(page, SEC_HTML('secT'));
  expect(await coinIds(page), '★전제: 캔버스에 코인이 없다').toEqual([]);
  await page.evaluate((html) => {
    const real = { loadTemplateCanvas: async () => html };
    window.electronAPI = new Proxy(real, { get: (t, k) => (k in t ? t[k] : () => Promise.resolve(null)) });
  }, tplHtml);
  await page.evaluate(() => window.insertTemplate({ id: 'tpl_coin', name: 'coin', type: 'section', tags: [] }));
  await expect.poll(async () => (await coinIds(page)).length, '★전제: 템플릿을 넣어 코인이 생겼다').toBe(1);
  const [tid] = await coinIds(page);
  const t = await read(page, tid);
  expect(tid, '넣을 때 블럭 id 를 새로 짓는다').not.toBe(id);
  expect([t.ids.length, t.ownIds, t.refsOwn], `템플릿으로 넣은 코인의 그림 id: ${t.ids.join(',')} · 참조: ${t.refs.join(',')}`).toEqual([8, true, true]);
  await pick(page, tid);
});

test('K12 손잡이 — 이동 · 크기 · 회전(놓은 뒤 빛 방향이 보정된다)', async ({ page }) => {
  test.setTimeout(90000);
  const errs = await bootApp(page);
  await setup(page);
  await selectSection(page);
  const id = await addByMenu(page);
  await typeInto(page, '#stk-coin-seed', 201);
  await expect.poll(async () => (await read(page, id)).d.seed).toBe('201');
  const z = await zoomOf(page);
  const a = await read(page, id);

  /* 이동 — 코인 몸통을 끈다 */
  const r0 = await waitStableRect(page, `[id="${id}"]`);
  expect(await page.evaluate(([x, y, id]) => document.elementFromPoint(x, y)?.id === id, [r0.cx, r0.cy, id]), '★전제: 끌 점이 코인 위다').toBe(true);
  await dragMouse(page, { x: r0.cx, y: r0.cy }, { x: r0.cx + 60, y: r0.cy + 40 });
  await expect.poll(async () => (await read(page, id)).d.x, '끌었는데 자리가 그대로다').not.toBe(a.d.x);
  const m = await read(page, id);
  expect(Math.abs((+m.d.x - +a.d.x) - 60 / z), `이동 x: ${a.d.x} → ${m.d.x} (화면 60px ÷ 배율 ${z})`).toBeLessThanOrEqual(2);
  expect(Math.abs((+m.d.y - +a.d.y) - 40 / z), `이동 y: ${a.d.y} → ${m.d.y}`).toBeLessThanOrEqual(2);
  expect([m.svg === a.svg, m.left, m.top], '이동은 그림을 안 바꾸고 상자만 옮긴다').toEqual([true, m.d.x + 'px', m.d.y + 'px']);

  /* 크기 — 오른쪽 아래 손잡이 */
  const h = await waitStableRect(page, `[id="${id}"] > .sticker-corner-handle[data-corner="br"]`);
  expect(await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.className, [h.cx, h.cy]), '★전제: 누르는 점이 크기 손잡이 위다').toBe('sticker-corner-handle');
  await dragMouse(page, { x: h.cx, y: h.cy }, { x: h.cx + 40, y: h.cy + 40 });
  await expect.poll(async () => (await read(page, id)).d.sizeW, '손잡이를 끌었는데 크기가 그대로다').not.toBe('120');
  const s = await read(page, id);
  expect(Math.abs((+s.d.sizeW - 120) - 40 / z), `크기 W: 120 → ${s.d.sizeW}`).toBeLessThanOrEqual(2);
  expect(Math.abs((+s.d.sizeH - 120) - 40 / z), `크기 H: 120 → ${s.d.sizeH}`).toBeLessThanOrEqual(2);
  expect([s.w, s.h], '상자가 그 크기로 그려진다').toEqual([+s.d.sizeW, +s.d.sizeH]);
  expect([s.d.x, s.d.y, s.ids.length, s.viewBox, s.handles, s.zones], '크기만 바뀐다(왼쪽 위 고정 · 그림·손잡이 그대로)').toEqual([m.d.x, m.d.y, 8, a.viewBox, 4, 4]);
  expect(await page.inputValue('#stk-coin-seed'), '크기 조절 뒤 패널이 그대로 Coin 절이다').toBe('201');

  /* 회전 — 오른쪽 아래 회전 자리를 잡고 중심 둘레로 약 +40° */
  const rz = await waitStableRect(page, `[id="${id}"] > .sticker-rotate-zone[data-corner="br"]`);
  const bx = await waitStableRect(page, `[id="${id}"]`);
  expect(await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.className, [rz.cx, rz.cy]), '★전제: 누르는 점이 회전 자리 위다').toBe('sticker-rotate-zone');
  const vx = rz.cx - bx.cx, vy = rz.cy - bx.cy, th = 40 * Math.PI / 180;
  const to = { x: bx.cx + vx * Math.cos(th) - vy * Math.sin(th), y: bx.cy + vx * Math.sin(th) + vy * Math.cos(th) };
  const glossBefore = s.gloss;
  /* 끄는 중(놓기 전)에는 상자만 돈다 — 그 상태를 한 번 본 뒤 놓는다 */
  await page.mouse.move(rz.cx, rz.cy);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(rz.cx + (to.x - rz.cx) * i / 8, rz.cy + (to.y - rz.cy) * i / 8);
  const mid = await read(page, id);
  expect(Math.abs(+mid.d.rotation - 40), `★전제: 끄는 중 회전값 ≈ 40 (받음 ${mid.d.rotation})`).toBeLessThanOrEqual(4);
  expect(mid.gloss, '★전제: 끄는 중에는 그림을 다시 안 그린다(상자만 돈다)').toBe(glossBefore);
  await page.mouse.up();
  const rot = await read(page, id);
  expect(rot.d.rotation, '놓은 뒤 회전값이 남는다').toBe(mid.d.rotation);
  expect(rot.gloss, '★놓았는데 빛 방향이 그대로다 — 광택 띠가 코인과 같이 돌아가 있다').not.toBe(glossBefore);
  /* 광택 띠는 «화면 기준» -35° 여야 한다: 띠의 rotate(…) + 코인 방향(-dir) + 상자 회전 = -35 */
  const glossDeg = parseFloat(/rotate\(([-\d.]+)\)/.exec(rot.gloss)[1]);
  expect(Math.abs((glossDeg - (+rot.d.coinDir) + (+rot.d.rotation)) + 35), `광택 띠의 화면 각도: 띠 ${glossDeg} − 방향 ${rot.d.coinDir} + 회전 ${rot.d.rotation}`).toBeLessThan(0.02);
  const canon = await page.evaluate((id) => { const b = document.getElementById(id); const now = b.querySelector(':scope > svg').outerHTML; window.renderStickerBlock(b); const re = b.querySelector(':scope > svg').outerHTML; window._addCornerHandles(b); return now === re; }, id);
  expect(canon, '놓은 뒤의 그림 = dataset 에서 다시 그린 그림(저장·undo 가 보는 그림)').toBe(true);
  expect([rot.handles, rot.zones, rot.selected], '회전 뒤에도 손잡이가 남는다').toEqual([4, 4, true]);
  expect(/rotate\(/.test(rot.transform)).toBe(true);
  /* 회전 한 번 = ⌘Z 한 번 */
  await page.keyboard.press('Meta+z');
  await expect.poll(async () => (await read(page, id))?.d.rotation ?? '0', '⌘Z 로 회전이 돌아온다').toBe(s.d.rotation ?? '0');
  const un = await read(page, id);
  expect([un.d.sizeW, un.gloss], '회전만 돌아오고 크기는 그대로 · 빛도 돌아온다').toEqual([s.d.sizeW, glossBefore]);
  expect(errs).toEqual([]);
});

/* ── 내보내기 그림 두 길 ─────────────────────────────────────────────────────────────────────────
 * 섹션을 클론해 앱의 PNG 내보내기와 같은 꼴(fixed · -99999 · 원본과 같은 id 가 문서에 둘)로 두고
 *   ⑴ CDP Page.captureScreenshot(= PNG 내보내기 엔진) ⑵ html2canvas(= 썸네일 · captureThumbnail 과 같은 옵션) 로 찍는다.
 * 코인 넷(정면 · 방향 0 · 상자 180 → 지름 125): A 광택 100 · B 광택 0 · C 광택 0 + 각인 8 · D = A 와 같되 «클론에서만» clip-path 를 뗀 대조.
 *   gradient — B 의 테(반지름의 91% · 앞면 gradient 만 깔린 자리)와 테 안쪽 바닥(바닥 gradient)이 금색이다
 *              (참조가 죽으면 fill 이 none 이 되어 바탕이 비친다)
 *   clipPath — A 의 코인 바로 바깥 고리가 전부 바탕이다. 대조 D 는 광택 띠가 고리로 삐져나온다(이 자가 삐져나옴을 «볼 수 있다»는 증거)
 *   <text>   — C 와 B 의 같은 자리 픽셀이 각인만큼 다르다 */
async function captureCoins(page) {
  await setup(page, SEC_HTML('secK', '#101018'));
  const common = { coinTilt: 0, coinDir: 0, sizeW: 180, sizeH: 180, y: 100 };
  const ids = [];
  ids.push(await make(page, { ...common, x: 20, coinGloss: 100, coinGlyph: '' }));
  ids.push(await make(page, { ...common, x: 230, coinGloss: 0, coinGlyph: '' }));
  ids.push(await make(page, { ...common, x: 440, coinGloss: 0, coinGlyph: '8' }));
  ids.push(await make(page, { ...common, x: 650, coinGloss: 100, coinGlyph: '' }));
  const info = await page.evaluate((ids) => {
    const sec = document.getElementById('secK');
    const clone = sec.cloneNode(true);
    clone.id = 'secK-clone';
    const ctl = clone.querySelector('[id="' + ids[3] + '"]');
    const stripped = [...ctl.querySelectorAll('[clip-path]')].map((g) => g.removeAttribute('clip-path')).length;   // 대조: clip-path 만 뗀다
    clone.style.cssText += ';position:fixed;top:-99999px;left:0;width:860px;margin:0;outline:none;';
    document.body.appendChild(clone);
    const r = clone.getBoundingClientRect();
    const centers = ids.map((id) => { const b = document.getElementById(id); return { x: (parseFloat(b.style.left) || 0) + b.offsetWidth / 2, y: (parseFloat(b.style.top) || 0) + b.offsetHeight / 2 }; });
    return { rect: { x: r.left, y: r.top, w: Math.round(r.width), h: Math.round(r.height) }, centers, d: 180 / 1.44, stripped,
      sameIds: ids.every((id) => document.querySelectorAll('[id="' + id + '"]').length === 2) };
  }, ids);
  const cdp = await page.context().newCDPSession(page);
  const shot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true,
    clip: { x: info.rect.x, y: info.rect.y, width: info.rect.w, height: info.rect.h, scale: 1 } });
  const h2c = await page.evaluate(async () => {
    const cv = await html2canvas(document.getElementById('secK-clone'), { scale: 1, useCORS: true, backgroundColor: '#101018', logging: false });
    return cv.toDataURL('image/png').split(',')[1];
  });
  const measure = (b64) => page.evaluate(async ({ b64, info }) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const k = img.width / info.rect.w;
    const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
    const x = cv.getContext('2d'); x.drawImage(img, 0, 0);
    const px = (X, Y) => [...x.getImageData(Math.round(X * k), Math.round(Y * k), 1, 1).data.slice(0, 3)];
    const lum = (p) => 0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2];
    const bg = px(4, 4);
    const [A, B, C, D] = info.centers;
    /* 코인 바로 바깥 고리(반지름 + 4px) 72점 중 바탕이 아닌 점의 수 */
    const ringOff = (c) => { let n = 0; for (let i = 0; i < 72; i++) { const t = i / 72 * 2 * Math.PI; const p = px(c.x + (info.d / 2 + 4) * Math.cos(t), c.y + (info.d / 2 + 4) * Math.sin(t)); if (Math.abs(lum(p) - lum(bg)) > 12) n++; } return n; };
    /* 테 안쪽(반지름의 70%) 정사각 안에서 B 와 C 가 다른 픽셀 수 = 각인 */
    let glyphDiff = 0; const half = Math.round(info.d * 0.35);
    for (let dy = -half; dy <= half; dy += 2) for (let dx = -half; dx <= half; dx += 2) { if (Math.abs(lum(px(B.x + dx, B.y + dy)) - lum(px(C.x + dx, C.y + dy))) > 10) glyphDiff++; }
    return { bg, faceB: px(B.x, B.y - info.d * 0.2), rimB: px(B.x + info.d * 0.455, B.y), ringA: ringOff(A), ringB: ringOff(B), ringD: ringOff(D), glyphDiff };
  }, { b64, info });
  return { info, cdp: await measure(shot.data), h2c: await measure(h2c) };
}

test('K13 ★내보내기 그림 두 길(PNG · CDP 오프스크린 / 썸네일 · html2canvas) — gradient·clipPath·각인이 산다', async ({ page }) => {
  test.setTimeout(120000);
  await bootApp(page);
  const all = await captureCoins(page);
  expect(all.info.sameIds, '★전제: 내보내기 클론과 원본이 같은 id 로 문서에 둘 있다(앱의 PNG 길과 같은 꼴)').toBe(true);
  expect(all.info.stripped, '★전제: 대조 코인에서 clip-path 를 뗐다').toBeGreaterThanOrEqual(1);
  for (const path of ['cdp', 'h2c']) {
    const m = all[path];
    const lum = (p) => 0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2];
    expect(lum(m.bg), `★전제(${path}): 바탕이 어둡다`).toBeLessThan(30);
    /* gradient — 앞면이 금색(빨강·초록이 높고 파랑이 낮다) */
    const golden = (p) => p[0] > 180 && p[1] > 120 && p[2] < 160 && p[0] - p[2] > 60;
    expect(golden(m.faceB), `${path}: 테 안쪽 바닥이 금색이 아니다 — 바닥 gradient 가 죽었다 (rgb ${m.faceB})`).toBe(true);
    expect(golden(m.rimB), `${path}: 테가 금색이 아니다 — 앞면 gradient 가 죽었다 (rgb ${m.rimB})`).toBe(true);
    /* clipPath — 광택 띠가 코인 밖으로 안 나온다 · 대조는 나온다 */
    expect(m.ringD, `★대조(${path}): clip-path 를 뗀 코인은 광택 띠가 고리로 삐져나와야 한다(이 자가 그걸 본다)`).toBeGreaterThanOrEqual(2);
    expect(m.ringA, `${path}: 광택 띠가 코인 밖으로 삐져나왔다 — clipPath 가 죽었다 (고리 72점 중 ${m.ringA})`).toBe(0);
    expect(m.ringB, `${path}: 광택 없는 코인의 바깥 고리가 바탕이 아니다`).toBe(0);
    /* <text> — 각인 */
    expect(m.glyphDiff, `${path}: 각인이 안 찍혔다 (각인 있는 코인과 없는 코인이 같은 그림 — 다른 픽셀 ${m.glyphDiff})`).toBeGreaterThan(40);
  }
  /* 두 길이 같은 색을 낸다 */
  for (const i of [0, 1, 2]) expect(Math.abs(all.cdp.faceB[i] - all.h2c.faceB[i]), `두 길의 앞면 색이 갈린다 — CDP ${all.cdp.faceB} · html2canvas ${all.h2c.faceB}`).toBeLessThan(16);
});

test('K14 ★내보내기 HTML — 배송본에 코인 SVG 가 그대로 실리고 id 참조가 그 문서 안에서 풀린다', async ({ page }) => {
  await bootApp(page);
  await setup(page);
  const id = await make(page, { seed: 199, coinMetal: 'custom', coinFace: '#3366ff', coinSide: '#112244', coinGlyph: '<b', rotation: 30, x: 200, y: 90 });
  const live = await read(page, id);
  expect([live.ids.length, live.selected, live.handles], '★전제: 코인이 그려져 있고 골라지지 않았다').toEqual([8, false, 0]);
  /* 진짜 exportHTMLFile() 을 부르고 «내려받는 대신» 그 HTML 문자열을 가로챈다 */
  const html = await page.evaluate(async () => {
    let blob = null;
    const oC = URL.createObjectURL, oR = URL.revokeObjectURL, oClick = HTMLAnchorElement.prototype.click;
    URL.createObjectURL = (b) => { blob = b; return 'blob:__stub__'; };
    URL.revokeObjectURL = () => {};
    HTMLAnchorElement.prototype.click = function () {};
    try { await window.exportHTMLFile(); } finally { URL.createObjectURL = oC; URL.revokeObjectURL = oR; HTMLAnchorElement.prototype.click = oClick; }
    return blob ? blob.text() : null;
  });
  expect(typeof html === 'string' && html.length > 1000, '★전제: 배송본 HTML 을 받았다').toBe(true);
  /* 배송본을 실제로 «렌더»해서 그 문서 안에서 잰다 */
  const r = await page.evaluate(async ({ html, id }) => {
    const f = document.createElement('iframe');
    f.style.cssText = 'position:fixed;left:-99999px;top:0;width:900px;height:1200px;border:0;';
    document.body.appendChild(f);
    await new Promise((res) => { f.onload = res; f.srcdoc = html; });
    const doc = f.contentDocument, win = f.contentWindow;
    const b = doc.getElementById(id);
    if (!b) return { found: false };
    const svg = b.querySelector(':scope > svg');
    const refs = [...new Set([...svg.outerHTML.matchAll(/url\(#([^)"]+)\)/g)].map((m) => m[1]))];
    const cs = win.getComputedStyle(b);
    const face = svg.querySelector('ellipse[fill^="url("]');
    return { found: true, svg: svg.outerHTML, shape: b.dataset.shape, seed: b.dataset.seed, metal: b.dataset.coinMetal,
      refsResolve: refs.map((x) => doc.getElementById(x)?.localName).sort(), nsOk: svg.namespaceURI === 'http://www.w3.org/2000/svg' && [...svg.querySelectorAll('linearGradient, clipPath')].length === 8,
      texts: [...new Set([...svg.querySelectorAll('text')].map((t) => t.textContent))], textKids: [...svg.querySelectorAll('text')].reduce((n, t) => n + t.children.length, 0),
      pos: cs.position, w: Math.round(parseFloat(cs.width)), rotated: cs.transform !== 'none', svgW: Math.round(svg.getBoundingClientRect().width) > 0,
      faceFill: win.getComputedStyle(face).fill, dupIds: [...doc.querySelectorAll('[id]')].map((e) => e.id).filter((x, i, a) => a.indexOf(x) !== i),
      handles: doc.querySelectorAll('.sticker-corner-handle, .sticker-rotate-zone').length, scripts: doc.querySelectorAll('#canvas script').length };
  }, { html, id });
  expect(r.found, '배송본에 코인 스티커가 없다').toBe(true);
  expect(r.svg, '★배송본의 코인 그림이 화면의 그림과 다르다').toBe(live.svg);
  expect([r.shape, r.seed, r.metal]).toEqual(['coin', '199', 'custom']);
  expect(r.nsOk, 'linearGradient·clipPath 가 SVG 요소로 살아 있지 않다(이름 대소문자가 깨졌다)').toBe(true);
  expect(r.refsResolve, 'url(#…) 참조가 배송본 문서 안에서 풀린다').toEqual(['clipPath', 'clipPath', 'linearGradient', 'linearGradient', 'linearGradient', 'linearGradient', 'linearGradient', 'linearGradient'].sort());
  expect(/^url\(/.test(r.faceFill), `앞면 fill 이 gradient 참조가 아니다: ${r.faceFill}`).toBe(true);
  expect([live.texts, live.textKids], '★전제: 화면의 각인이 글자 `<b` 다').toEqual([['<b'], 0]);
  expect([r.texts, r.textKids], '각인 글자가 글자로 실린다(이스케이프가 없으면 <b 가 태그로 열린다)').toEqual([['<b'], 0]);
  expect([r.pos, r.w, r.rotated, r.svgW], '자리·크기·회전이 인라인 스타일로 실린다').toEqual(['absolute', 120, true, true]);
  expect(r.dupIds, '배송본 안에서 id 가 겹친다').toEqual([]);
  expect([r.handles, r.scripts]).toEqual([0, 0]);
});

test('K15 일반 「Sticker」 단추는 코인을 안 낳는다 · 다음 Coin 은 생김새를 잇고 각도는 새로', async ({ page }) => {
  await bootApp(page);
  await setup(page);
  await selectSection(page);
  const first = await addByMenu(page);
  await page.click('#stk-coin-metal [data-coin-metal="silver"]');
  await page.click('#stk-coin-glyphs [data-coin-glyph=""]');
  await page.click('#stk-coin-section .prop-toggle');
  await expect.poll(async () => (await read(page, first)).d.coinLock, '★전제: 첫 코인을 은 · 각인 없음 · 잠금으로').toBe('1');

  /* 펜 메뉴 「Sticker」(shape 미지정) — 마지막에 쓴 모양을 다시 만든다. 코인이면 안 된다. */
  const stickers = () => page.evaluate(() => [...document.querySelectorAll('#canvas .sticker-block')].map((b) => ({ id: b.id, shape: b.dataset.shape })));
  const n0 = (await stickers()).length;
  await page.click('#fp-pen-btn');
  await page.click('#fp-pen-menu .fp-menu-item:text-is("Sticker")');
  await expect.poll(async () => (await stickers()).length, '★전제: Sticker 단추가 스티커를 하나 만들었다').toBe(n0 + 1);
  const plain = (await stickers()).at(-1);
  expect(plain.shape, '일반 Sticker 단추가 코인을 낳았다').not.toBe('coin');
  expect(await coinIds(page)).toEqual([first]);

  const second = await addByMenu(page);
  const [a, b] = [await read(page, first), await read(page, second)];
  expect([b.d.coinMetal, b.d.coinGlyph], '다음 Coin 은 마지막 생김새(은 · 각인 없음)를 잇는다').toEqual(['silver', '']);
  expect(b.d.seed, '새로 만들었는데 무늬번호가 같다').not.toBe(a.d.seed);
  expect(b.d.coinLock, '각도 잠금은 물려받지 않는다').toBeUndefined();
  expect([b.d.x === a.d.x && b.d.y === a.d.y, b.ownIds, b.refsOwn], '둘째는 계단식으로 비켜 놓이고 제 id 로 그려진다').toEqual([false, true, true]);
  expect(await dupCoinIds(page)).toEqual([]);
});

test('K16 ★손댄 저장본 — 재질이 객체 내장 이름이거나 수가 깨져 있어도 열기가 안 멈추고 뒤 스티커도 그려진다', async ({ page }) => {
  test.setTimeout(90000);
  const errs = await bootApp(page);
  /* 저장본에는 dataset 만 믿을 수 있다 — 그림은 열 때 다시 그린다. 코인 열셋(깨진 꼴) + 멀쩡한 코인 + 원 스티커(맨 뒤). */
  const BAD = [
    ['metal-constructor', 'data-coin-metal="constructor"'], ['metal-proto', 'data-coin-metal="__proto__"'], ['metal-toString', 'data-coin-metal="toString"'],
    ['metal-hasOwn', 'data-coin-metal="hasOwnProperty"'], ['k-neg', 'data-coin-k="-50"'], ['k-huge', 'data-coin-k="1e9"'], ['gloss-nan', 'data-coin-gloss="NaN"'],
    ['tilt-neg', 'data-coin-tilt="-9999"'], ['dir-huge', 'data-coin-dir="1e15"'], ['seed-abc', 'data-seed="abc"'],
    ['face-bad', 'data-coin-metal="custom" data-coin-face="rgb(1.2.3,4,5)" data-coin-side="x"'], ['glyph-blank', 'data-coin-glyph="   "'], ['bare', ''],
  ];
  const html = (id) => `<div class="section-block" id="${id}" style="position:relative;height:420px;background:#f4f4f6"><div class="section-inner"></div>`
    + BAD.map(([name, attrs], i) => `<div class="sticker-block" id="stk_bad${i}" data-bad="${name}" data-type="sticker" data-shape="coin" data-x="${20 + (i % 7) * 115}" data-y="${20 + Math.floor(i / 7) * 130}" data-size-w="100" data-size-h="100" ${attrs}></div>`).join('')
    + '<div class="sticker-block" id="stk_good" data-type="sticker" data-shape="coin" data-seed="201" data-coin-tilt="35" data-coin-dir="-24" data-x="40" data-y="290" data-size-w="100" data-size-h="100"></div>'
    + '<div class="sticker-block" id="stk_after" data-type="sticker" data-shape="circle" data-size="60" data-text="뒤" data-x="400" data-y="300"></div></div>';
  const state = () => page.evaluate((n) => {
    const one = (b) => { const svg = b.querySelector(':scope > svg'); const ids = svg ? [...svg.querySelectorAll('[id]')].map((e) => e.id) : [];
      return { ids: ids.length, own: ids.every((x) => x.startsWith('coin-' + b.id)), nan: svg ? /NaN|undefined|Infinity/.test(svg.outerHTML.split(b.id).join('')) : true, vb: svg?.getAttribute('viewBox') || null, w: svg ? Math.round(svg.getBoundingClientRect().width) : 0 }; };
    const out = {};
    for (let i = 0; i < n; i++) { const b = document.getElementById('stk_bad' + i); out[b.dataset.bad] = one(b); }
    out.good = one(document.getElementById('stk_good'));
    return { coins: out, afterText: document.querySelector('#stk_after .sticker-text')?.textContent || null, total: document.querySelectorAll('#canvas .sticker-block').length };
  }, BAD.length);
  const judge = (st, where) => {
    expect(st.total, `${where}: ★전제 — 스티커 ${BAD.length + 2}개가 있다`).toBe(BAD.length + 2);
    for (const [name] of BAD) {
      const c = st.coins[name];
      expect([c.ids, c.own, c.nan, c.w > 0], `${where}: 깨진 코인 「${name}」이 안 그려졌다 — ${JSON.stringify(c)}`).toEqual([8, true, false, true]);
      const [, , vw] = c.vb.split(' ').map(Number);
      expect(vw >= 116 && vw <= 180, `${where}: 「${name}」의 viewBox 가 범위 밖이다(코인이 안 보인다) — ${c.vb}`).toBe(true);
    }
    expect(st.coins.good.ids, `${where}: 멀쩡한 코인`).toBe(8);
    expect(st.afterText, `${where}: ★깨진 코인 «뒤»의 스티커가 안 그려졌다 — 하나가 던져 로드가 멈췄다`).toBe('뒤');
  };
  /* ⑴ rebindAll 길 */
  const threw = await page.evaluate((h) => { document.getElementById('canvas').innerHTML = h; try { window.rebindAll(); return null; } catch (e) { return String(e); } }, html('secK'));
  expect(threw, 'rebindAll 이 던졌다').toBeNull();
  judge(await state(), 'rebindAll');
  expect((await state()).coins['k-neg'].vb, '두께 -50 → 아래 끝 8%').toBe('-58 -58 116 116');
  expect((await state()).coins['k-huge'].vb, '두께 1e9 → 위 끝 40%').toBe('-90 -90 180 180');
  /* 칸 = 그림 — 패널도 같은 끝값을 보여 준다 */
  for (const [i, want] of [[4, '8'], [5, '40']]) {
    await pick(page, 'stk_bad' + i);
    expect(await page.inputValue('#stk-coin-k-num'), `패널의 두께 칸(${BAD[i][0]})이 그림과 다르다`).toBe(want);
  }
  await pick(page, 'stk_bad0');
  expect(await page.evaluate(() => [...document.querySelectorAll('#stk-coin-metal .active')].map((b) => b.dataset.coinMetal)), '모르는 재질은 패널에서도 금').toEqual(['gold']);
  /* 뒤 스티커는 묶여 있다(눌러서 골라진다) */
  const ra = await waitStableRect(page, '[id="stk_after"]');
  await clickAt(page, ra.cx, ra.cy, { sel: '.sticker-block' }, { label: '뒤 스티커' });
  await expect.poll(() => page.evaluate(() => document.getElementById('stk_after').classList.contains('selected')), '깨진 코인 뒤의 스티커가 안 묶였다').toBe(true);

  /* ⑵ 저장 → 새 페이지에서 열기(applyProjectData) 길 — 속성만 남기고 그림은 비운 저장본 */
  const snap = await page.evaluate((h) => { const p = JSON.parse(window.serializeProject()); const pg = (p.pages || [])[0]; if (pg && typeof pg.canvas === 'string') { pg.canvas = h; return JSON.stringify(p); } return null; }, html('secK'));
  expect(snap, '★전제: 저장본의 첫 페이지 canvas 를 손댔다').not.toBeNull();
  const errs2 = await bootApp(page);
  const threw2 = await page.evaluate(async (d) => { try { await window.applyProjectData(JSON.parse(d)); return null; } catch (e) { return String(e); } }, snap);
  expect(threw2, 'applyProjectData 가 던졌다').toBeNull();
  await expect.poll(async () => (await state()).total, '다시 연 뒤 스티커 수').toBe(BAD.length + 2);
  judge(await state(), 'applyProjectData');
  expect([errs, errs2], '페이지 오류 0').toEqual([[], []]);
});
