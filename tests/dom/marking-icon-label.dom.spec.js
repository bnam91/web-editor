/* marking-icon-label — 마킹 블럭(옛 카운트 스티커 · data-count)의 아이콘 표기 · 옆 텍스트 라벨 · 프리셋. (1013t2B5)
 *
 * ★무엇을 잠그나
 *   M0 전제(도구·글리프 표·svg 거르개가 실렸다) · M1 표기 「아이콘」(섹션 묶음 · 번호로 돌아오면 번호가 산다)
 *   M2 글리프 바꾸기 · 폰트 크기 = 아이콘 크기 · 글자색 = 아이콘 색(섹션 일괄 포함)
 *   M3 svg 세척 — 쓰는 길(setGroup)과 그리는 길(dataset 을 직접 손댄 저장본) 둘 다에서 script·on*·foreignObject·href 가 화면에 안 닿는다
 * ★자리·크기는 «레이아웃 px»(offset* · dataset)로 견준다. 화면 사각형은 «누를 점»과 «두 사각형의 상대 관계»에만 쓴다.
 * ⛔파일 선택창 · 네트워크 · Iconify 모달은 안 연다(아이콘은 내장 글리프와 setter 로만).
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');
const { clickAt } = require('./_click-at.js');

const SEC_A = '[id="secA"]';
const SEC_B = '[id="secB"]';
const MARKS_A = '#secA .sticker-block[data-count]';

async function setup(page) {
  await page.evaluate(() => {
    const canvas = document.getElementById('canvas');
    canvas.innerHTML = '<div class="section-block" id="secA" style="position:relative;height:320px;background:#f4f4f6"><div class="section-inner"></div></div>'
      + '<div class="section-block" id="secB" style="position:relative;height:320px;background:#e9eef4"><div class="section-inner"></div></div>';
    window.rebindAll?.();
  });
}

async function toolOn(page) {
  await page.evaluate(() => window.enterCountStickerMode());
  await page.waitForFunction(() => window._countStkState().mode === true && window._countStkState().armed === true);
}

const countIn = (page, secId) => page.evaluate((id) => document.querySelectorAll(`#${id} .sticker-block[data-count]`).length, secId);

/* 섹션의 (fx, fy) 비율 지점을 실제 마우스로 눌러 마킹 하나를 찍는다. */
async function stamp(page, secSel, fx, fy) {
  const secId = secSel === SEC_A ? 'secA' : 'secB';
  expect((await page.evaluate(() => window._countStkState())).mode, '★전제: 도구가 켜져 있다').toBe(true);
  const before = await countIn(page, secId);
  const r = await waitStableRect(page, secSel);
  await clickAt(page, r.left + r.width * fx, r.top + r.height * fy, { sel: secSel }, { label: `stamp ${secId}` });
  await expect.poll(() => countIn(page, secId), `${secId}: 누른 뒤 마킹이 하나 늘었다`).toBe(before + 1);
}

/* secB 1개 + secA 3개를 찍고 도구를 끈다(secA 셋째가 골라진 채 · 패널이 떠 있다). */
async function three(page) {
  const errs = await bootApp(page);
  await setup(page);
  await toolOn(page);
  await stamp(page, SEC_B, 0.4, 0.5);
  await stamp(page, SEC_A, 0.2, 0.5);
  await stamp(page, SEC_A, 0.5, 0.5);
  await stamp(page, SEC_A, 0.8, 0.5);
  await page.evaluate(() => window.exitCountStickerMode());
  const pre = await page.evaluate(() => ({ a: document.querySelectorAll('#secA .sticker-block[data-count]').length, b: document.querySelectorAll('#secB .sticker-block[data-count]').length,
    sel: [...document.querySelectorAll('#secA .sticker-block[data-count]')].map((x) => x.classList.contains('selected')), panel: !!document.getElementById('stk-count-section') }));
  expect(pre, '★전제: secA 3 · secB 1 · secA 셋째가 골라졌고 Marking 절이 떴다').toEqual({ a: 3, b: 1, sel: [false, false, true], panel: true });
  return errs;
}

/* 그 섹션 마킹들의 «그려진» 모습 — 아이콘 svg · 번호 글자 · dataset. */
const look = (page, secId) => page.evaluate((id) => [...document.querySelectorAll(`#${id} .sticker-block[data-count]`)].map((b) => {
  const svg = b.querySelector(':scope > .sticker-count-icon > svg');
  const first = svg ? svg.firstElementChild : null;
  const cs = svg ? getComputedStyle(svg) : null;
  return { style: b.dataset.countStyle, icon: b.dataset.countIcon ?? null, text: b.dataset.text, count: b.dataset.count,
    num: b.querySelector(':scope > .sticker-text')?.textContent ?? null,
    svg: !!svg, viewBox: svg ? svg.getAttribute('viewBox') : null, w: cs ? cs.width : null, h: cs ? cs.height : null,
    stroke: first ? getComputedStyle(first).stroke : null, tag: first ? first.tagName.toLowerCase() : null, points: first ? first.getAttribute('points') : null,
    fontSize: getComputedStyle(b).fontSize, color: getComputedStyle(b).color };
}), secId);
const pluck = (rows, k) => rows.map((r) => r[k]);

async function typeNumber(page, sel, value) {
  await page.click(sel);
  await page.keyboard.press('Meta+a');
  await page.keyboard.type(String(value));
  await page.keyboard.press('Enter');
}
async function typeHex(page, sel, hex) {
  await page.click(sel);
  await page.keyboard.press('Meta+a');
  await page.keyboard.type(hex);
  await page.keyboard.press('Enter');
}

const CHEVRON = '6 3.5 10.5 8 6 12.5';        // js/count-sticker-tool.js COUNT_STK_GLYPHS['chevron-right'] 의 좌표(글자로 박는다)
const WHITE = 'rgb(255, 255, 255)';

test('M0 전제 — 도구·글리프 표·svg 거르개가 실렸다 · 오류 0건', async ({ page }) => {
  const errs = await bootApp(page);
  const r = await page.evaluate(() => ({ glyph: typeof window.CountSticker?.glyphSvg, names: window.CountSticker?.GLYPH_NAMES?.length,
    san: typeof window._sanitizeSvgString, clean: window._sanitizeSvgString?.('<svg onload="x()"><script>1</script><path d="M0 0"/></svg>'),
    make: typeof window.makeStickerBlock, render: typeof window.renderStickerBlock }));
  expect(r).toEqual({ glyph: 'function', names: 6, san: 'function', clean: '<svg><path d="M0 0"/></svg>', make: 'function', render: 'function' });
  expect(errs).toEqual([]);
});

test('M1 표기 아이콘 — 섹션 3개가 전부 chevron svg · 번호 글자는 안 보인다 · 1 로 돌아오면 1·2·3', async ({ page }) => {
  const errs = await three(page);
  const b0 = await look(page, 'secB');
  expect(pluck(await look(page, 'secA'), 'num'), '★전제: 처음엔 번호 글자 1·2·3').toEqual(['1', '2', '3']);
  expect(await page.evaluate(() => getComputedStyle(document.getElementById('stk-count-glyph-row')).display), '★전제: 아이콘 행은 숨어 있다').toBe('none');

  await page.click('#stk-count-style [data-count-style="icon"]');
  const a = await look(page, 'secA');
  expect(pluck(a, 'style'), '표기 = icon (셋 다)').toEqual(['icon', 'icon', 'icon']);
  expect(pluck(a, 'icon'), '기본 글리프').toEqual(['chevron-right', 'chevron-right', 'chevron-right']);
  expect([pluck(a, 'svg'), pluck(a, 'num')], '셋 다 svg 가 그려지고 번호 글자 요소는 없다').toEqual([[true, true, true], [null, null, null]]);
  expect([pluck(a, 'tag'), pluck(a, 'points')], '그려진 것이 chevron 이다').toEqual([['polyline', 'polyline', 'polyline'], [CHEVRON, CHEVRON, CHEVRON]]);
  expect(pluck(a, 'viewBox'), 'viewBox').toEqual(['0 0 16 16', '0 0 16 16', '0 0 16 16']);
  expect([pluck(a, 'text'), pluck(a, 'count')], '글자는 비우고(내보내기에 번호가 안 샌다) 순번은 그대로 센다').toEqual([['', '', ''], ['1', '2', '3']]);
  expect([pluck(a, 'w'), pluck(a, 'h')], '아이콘 크기 = 폰트 크기').toEqual([pluck(a, 'fontSize'), pluck(a, 'fontSize')]);
  expect(pluck(a, 'stroke'), '아이콘 색 = 글자색(흰색)').toEqual([WHITE, WHITE, WHITE]);
  expect(await look(page, 'secB'), '다른 섹션은 그대로').toEqual(b0);
  /* 패널: 아이콘 행이 보이고 시작 번호·다시 매기기 행은 숨는다 */
  const rows = await page.evaluate(() => ({ glyph: getComputedStyle(document.getElementById('stk-count-glyph-row')).display, start: getComputedStyle(document.getElementById('stk-count-start-row')).display,
    renum: getComputedStyle(document.getElementById('stk-count-renumber-row')).display, btns: document.querySelectorAll('#stk-count-glyph [data-count-glyph]').length,
    active: document.querySelector('#stk-count-glyph .active')?.dataset.countGlyph, styleActive: document.querySelector('#stk-count-style .active')?.dataset.countStyle,
    handles: document.querySelectorAll('#secA .sticker-block.selected .sticker-corner-handle').length }));
  expect(rows).toEqual({ glyph: 'flex', start: 'none', renum: 'none', btns: 6, active: 'chevron-right', styleActive: 'icon', handles: 4 });

  /* 다음 찍기는 아이콘 표기를 물려받는다 */
  await toolOn(page);
  await stamp(page, SEC_A, 0.5, 0.2);
  await page.evaluate(() => window.exitCountStickerMode());
  const a4 = await look(page, 'secA');
  expect([pluck(a4, 'style'), pluck(a4, 'svg'), pluck(a4, 'count')], '넷째도 아이콘 · 순번은 4').toEqual([['icon', 'icon', 'icon', 'icon'], [true, true, true, true], ['1', '2', '3', '4']]);

  /* 번호로 돌아오면 번호가 산다 */
  await page.click('#stk-count-style [data-count-style="num"]');
  const n = await look(page, 'secA');
  expect([pluck(n, 'num'), pluck(n, 'svg')], '1 로 돌아오면 1·2·3·4 — svg 는 없다').toEqual([['1', '2', '3', '4'], [false, false, false, false]]);
  expect(await page.evaluate(() => getComputedStyle(document.getElementById('stk-count-start-row')).display), '시작 번호 행이 다시 보인다').toBe('flex');
  expect(errs).toEqual([]);
});

test('M2 글리프 바꾸기 · 폰트 크기 = 아이콘 크기 · 글자색 = 아이콘 색(섹션 일괄)', async ({ page }) => {
  await three(page);
  await page.click('#stk-count-style [data-count-style="icon"]');
  expect(pluck(await look(page, 'secA'), 'points'), '★전제: chevron').toEqual([CHEVRON, CHEVRON, CHEVRON]);

  await page.click('#stk-count-glyph [data-count-glyph="check"]');
  let a = await look(page, 'secA');
  expect([pluck(a, 'icon'), pluck(a, 'points')], '글리프: 셋 다 check').toEqual([['check', 'check', 'check'], Array(3).fill('3.5 8.5 6.5 11.5 12.5 4.5')]);
  expect(await page.evaluate(() => document.querySelector('#stk-count-glyph .active')?.dataset.countGlyph), '패널의 활성 글리프').toBe('check');

  await typeNumber(page, '#stk-fs-num', 40);
  await expect.poll(async () => pluck(await look(page, 'secA'), 'w'), '폰트 크기 40 → 아이콘 폭 40px (셋 다)').toEqual(['40px', '40px', '40px']);
  expect(pluck(await look(page, 'secA'), 'h'), '아이콘 높이도').toEqual(['40px', '40px', '40px']);

  await typeHex(page, '#stk-txt-hex', '00FF00');
  await expect.poll(async () => pluck(await look(page, 'secA'), 'stroke'), '글자색 → 아이콘 색 (셋 다)').toEqual(Array(3).fill('rgb(0, 255, 0)'));
  /* 투명 모양이면 아이콘 색 = 배경색 칸(번호와 같은 규칙) */
  await page.click('#stk-count-shape [data-count-shape="none"]');
  a = await look(page, 'secA');
  const bg = await page.evaluate(() => { const b = document.querySelector('#secA .sticker-block[data-count]'); const p = document.createElement('span'); p.style.color = b.dataset.bgColor;
    document.body.appendChild(p); const c = getComputedStyle(p).color; p.remove(); return { c, drawnBg: getComputedStyle(b).backgroundColor }; });
  expect(bg.drawnBg, '★전제: 투명 모양 — 배경이 비었다').toBe('rgba(0, 0, 0, 0)');
  expect(pluck(a, 'stroke'), '투명: 아이콘 색 = 배경색').toEqual([bg.c, bg.c, bg.c]);
});

test('M3 svg 세척 — 쓰는 길·그리는 길 둘 다에서 script · on* · foreignObject · href 가 화면에 안 닿는다', async ({ page }) => {
  const errs = await three(page);
  const POISON = [
    { name: 'onload', svg: '<svg viewBox="0 0 24 24" onload="window.__pwned=(window.__pwned||0)+1"><path d="M4 4L20 20"/></svg>' },
    { name: 'script', svg: '<svg viewBox="0 0 24 24"><script>window.__pwned=(window.__pwned||0)+1</script><path d="M4 4L20 20"/></svg>' },
    { name: 'foreignObject', svg: '<svg viewBox="0 0 24 24"><foreignObject width="24" height="24"><img src="x" onerror="window.__pwned=(window.__pwned||0)+1"></foreignObject><path d="M4 4L20 20"/></svg>' },
    { name: 'href', svg: '<svg viewBox="0 0 24 24"><a href="javascript:window.__pwned=1"><path d="M4 4L20 20"/></a><path d="M1 1L2 2" onclick="window.__pwned=1"/></svg>' },
  ];
  /* 그려진 블럭 안을 훑는다 — 위험한 꼴이 하나라도 «DOM 에» 있으면 센다. */
  const scan = () => page.evaluate(() => {
    const all = [...document.querySelectorAll('#secA .sticker-block[data-count]')];
    const els = all.flatMap((b) => [...b.querySelectorAll('.sticker-count-icon *')]);
    return { blocks: all.length, drawn: all.map((b) => !!b.querySelector(':scope > .sticker-count-icon > svg')),
      onAttr: els.filter((e) => [...e.attributes].some((a) => /^on/i.test(a.name))).length,
      hrefAttr: els.filter((e) => [...e.attributes].some((a) => /href$/i.test(a.name))).length,
      bad: els.filter((e) => /^(script|foreignobject|img|a|use|image|style|iframe)$/i.test(e.localName)).map((e) => e.localName),
      paths: all.map((b) => b.querySelectorAll('.sticker-count-icon path').length), pwned: window.__pwned ?? null,
      stored: all.map((b) => b.dataset.countIconSvg || '') };
  });
  const settle = () => page.evaluate(() => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res))));

  for (const p of POISON) {
    /* ⑴ 쓰는 길 — 묶음 setter(패널의 「아이콘 고르기」가 부르는 그 함수) */
    await page.evaluate((svg) => window.CountSticker.setGroup(document.getElementById('secA'), { style: 'icon', icon: 'custom', iconSvg: svg }), p.svg);
    await settle();
    const w = await scan();
    expect([w.blocks, w.drawn], `★전제(${p.name} · 쓰기): 셋 다 아이콘이 그려졌다`).toEqual([3, [true, true, true]]);
    expect(w.paths.every((n) => n >= 1), `★전제(${p.name} · 쓰기): 그림(path)은 남았다 — ${w.paths}`).toBe(true);
    expect([w.onAttr, w.hrefAttr, w.bad, w.pwned], `${p.name} · 쓰기: on* 0 · href 0 · 불허 태그 0 · 실행 0`).toEqual([0, 0, [], null]);
    expect(w.stored.every((s) => s.startsWith('<svg') && !/\son\w+\s*=|<script|foreignObject|href/i.test(s)), `${p.name} · 쓰기: dataset 에도 거른 것만 실렸다 — ${w.stored[0]}`).toBe(true);

    /* ⑵ 그리는 길 — 저장본을 손댄 것처럼 dataset 에 독을 «직접» 심고 다시 그린다 */
    await page.evaluate((svg) => document.querySelectorAll('#secA .sticker-block[data-count]').forEach((b) => {
      b.dataset.countStyle = 'icon'; b.dataset.countIcon = 'custom'; b.dataset.countIconSvg = svg;
      b.innerHTML = ''; window.renderStickerBlock(b);
    }), p.svg);
    await settle();
    const d = await scan();
    expect(d.stored.every((s) => s.length > 0 && /on\w+=|<script|foreignObject|href/i.test(s)), `★전제(${p.name} · 그리기): dataset 에는 독이 그대로 들어 있다`).toBe(true);
    expect([d.blocks, d.drawn], `★전제(${p.name} · 그리기): 셋 다 아이콘이 그려졌다`).toEqual([3, [true, true, true]]);
    expect(d.paths.every((n) => n >= 1), `★전제(${p.name} · 그리기): 그림(path)은 남았다 — ${d.paths}`).toBe(true);
    expect([d.onAttr, d.hrefAttr, d.bad, d.pwned], `${p.name} · 그리기: on* 0 · href 0 · 불허 태그 0 · 실행 0`).toEqual([0, 0, [], null]);
  }

  /* svg 가 아닌 문자열 — 쓰기는 거절(앞의 아이콘 그대로), 그리기는 기본 글리프로 */
  const before = await page.evaluate(() => { window.CountSticker.setGroup(document.getElementById('secA'), { icon: 'star' });
    return [...document.querySelectorAll('#secA .sticker-block[data-count]')].map((b) => b.dataset.countIcon); });
  expect(before, '★전제: 내장 글리프 star 로 돌려 두었다').toEqual(['star', 'star', 'star']);
  const rejected = await page.evaluate(() => { window.CountSticker.setGroup(document.getElementById('secA'), { icon: 'custom', iconSvg: '<img src=x onerror="window.__pwned=1">' });
    return [...document.querySelectorAll('#secA .sticker-block[data-count]')].map((b) => [b.dataset.countIcon, 'countIconSvg' in b.dataset]); });
  expect(rejected, 'svg 가 아닌 문자열: 쓰지 않는다(앞의 아이콘 그대로)').toEqual([['star', false], ['star', false], ['star', false]]);
  await page.evaluate(() => document.querySelectorAll('#secA .sticker-block[data-count]').forEach((b) => { b.dataset.countIcon = 'custom'; b.dataset.countIconSvg = '<img src=x onerror="window.__pwned=1">'; window.renderStickerBlock(b); }));
  await settle();
  const fb = await scan();
  expect([fb.drawn, fb.bad, fb.pwned], '손댄 저장본의 svg 아닌 값: 기본 글리프로 그려지고 아무것도 안 돈다').toEqual([[true, true, true], [], null]);
  expect(await page.evaluate(() => document.querySelector('#secA .sticker-block[data-count] .sticker-count-icon polyline')?.getAttribute('points')), '기본 글리프 = chevron').toBe(CHEVRON);
  expect(errs).toEqual([]);
});
