/* marking-icon-label — 마킹 블럭(옛 카운트 스티커 · data-count)의 아이콘 표기 · 옆 텍스트 라벨 · 프리셋. (1013t2B5)
 *
 * ★무엇을 잠그나
 *   M0 전제(도구·글리프 표·svg 거르개가 실렸다) · M1 표기 「아이콘」(섹션 묶음 · 번호로 돌아오면 번호가 산다)
 *   M2 글리프 바꾸기 · 폰트 크기 = 아이콘 크기 · 글자색 = 아이콘 색(섹션 일괄 포함)
 *   M3 svg 세척 — 쓰는 길(setGroup)과 그리는 길(dataset 을 직접 손댄 저장본) 둘 다에서 script·on*·foreignObject·href 가 화면에 안 닿는다
 *   M4 옆 라벨(패널) — 마커 오른쪽에 뜨고 마커 상자는 그대로 · 줄바꿈 · 꺾쇠는 글자 그대로 · 비우면 사라진다
 *   M5 라벨 자리 4갈래 · 크기 · 색(「섹션 전체」 스위치를 따른다 · 글자는 블럭마다)
 *   M6 인라인 — 마커를 더블클릭하면 라벨 편집이 열리고 Enter 로 확정 · 번호 글자는 편집이 안 열린다 · ⌘Z 한 칸
 *   M7 살아남기 — ⌘Z/⌘⇧Z · ⌘D 복제 · 직렬화→다시 싣기 뒤에도 아이콘·라벨이 같다 · 손잡이·편집 잔재가 직렬화에 0
 *   M8 섹션 경계 — 마커가 왼쪽 경계에 걸쳐도 오른쪽 라벨은 안 잘린다(오른쪽 inset 이 음수) · 라벨 없는 것의 --sec-clip 은 예전 값
 *   M10 내보내기 클론 — 에디터 CSS 가 없는 문서에서도 라벨이 마커 오른쪽·세로 가운데(자리 스타일이 인라인)
 * ★자리·크기는 «레이아웃 px»(offset* · dataset)로 견준다. 화면 사각형은 «누를 점»과 «두 사각형의 상대 관계»에만 쓴다.
 * ⛔파일 선택창 · 네트워크 · Iconify 모달은 안 연다(아이콘은 내장 글리프와 setter 로만).
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');
const { clickAt } = require('./_click-at.js');
const { expectOneUndoStep } = require('./_history-step.js');

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

/* canvas-wrap 의 스크롤이 멈출 때까지(연속 12프레임 같은 값) 기다린다 — 굴러가는 도중의 좌표를 누르지 않는다(coin-sticker 의 scrollSettled 와 같은 꼴). */
async function scrollSettled(page) {
  await page.waitForFunction(() => new Promise((resolve) => {
    const w = document.getElementById('canvas-wrap');
    let last = w.scrollTop, same = 0;
    const tick = () => { const now = w.scrollTop; same = now === last ? same + 1 : 0; last = now; if (same >= 12) resolve(true); else requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  }));
}

/* secA 의 index 번째 마킹을 실제 마우스로 눌러 고른다. ★전제: 누를 점이 뷰포트 안이고 그 점의 맨 위 요소가 그 마킹(또는 그 자손)이다. */
async function pickMark(page, index) {
  await scrollSettled(page);
  await page.evaluate((i) => document.querySelectorAll('#secA .sticker-block[data-count]')[i].scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' }), index);
  await scrollSettled(page);
  const r = await waitStableRect(page, MARKS_A, { index });
  const at = await page.evaluate(([x, y, i]) => {
    const e = document.elementFromPoint(x, y), b = document.querySelectorAll('#secA .sticker-block[data-count]')[i];
    return { inView: x > 0 && y > 0 && x < window.innerWidth && y < window.innerHeight, onMark: !!e && (e === b || b.contains(e)), hit: e ? (e.id || String(e.className) || e.tagName) : null };
  }, [r.cx, r.cy, index]);
  expect([at.inView, at.onMark], `★전제: 누를 점 (${r.cx},${r.cy}) 이 뷰포트 안이고 그 마킹 위다 — 맞힌 요소 «${at.hit}»`).toEqual([true, true]);
  await clickAt(page, r.cx, r.cy, { sel: '.sticker-block[data-count]' }, { label: `마킹 ${index} 고르기` });
  await expect.poll(() => page.evaluate((i) => { const all = [...document.querySelectorAll('#secA .sticker-block[data-count]')];
    return all[i]?.classList.contains('selected') && all.filter((b) => b.classList.contains('selected')).length === 1 && !!document.getElementById('stk-count-section'); }, index),
    '★전제: 그 마킹 하나만 골라졌고 Marking 절이 떴다').toBe(true);
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

/* ── 옆 라벨(1013t2B5) ───────────────────────────────────────────────────────────────────────────── */

const settle = (page) => page.evaluate(() => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res))));

/* 그 섹션 마킹들의 마커 상자와 라벨 — 전부 «레이아웃 px»(offset*)다. 라벨의 가운데 맞춤(transform)은 M4·M10 이 화면 사각형의 «상대 관계»로 따로 잰다. */
const labels = (page, secId) => page.evaluate((id) => [...document.querySelectorAll(`#${id} .sticker-block[data-count]`)].map((b) => {
  const lab = b.querySelector(':scope > .sticker-count-label');
  const cs = lab ? getComputedStyle(lab) : null;
  return { x: b.dataset.x, w: b.offsetWidth, h: b.offsetHeight, gap: Math.round((parseInt(b.dataset.sizeW, 10) || 0) * 0.2),
    key: b.dataset.countLabel ?? null, pos: b.dataset.countLabelPos ?? null, lsize: b.dataset.countLabelSize ?? null, lcolor: b.dataset.countLabelColor ?? null,
    has: !!lab, text: lab ? lab.textContent : null, kids: lab ? lab.children.length : null, dpos: lab ? lab.dataset.pos : null,
    left: lab ? lab.offsetLeft : null, top: lab ? lab.offsetTop : null, lw: lab ? lab.offsetWidth : null, lh: lab ? lab.offsetHeight : null,
    fs: cs ? cs.fontSize : null, color: cs ? cs.color : null, fw: cs ? cs.fontWeight : null,
    markerFs: getComputedStyle(b).fontSize, markerBg: getComputedStyle(b).backgroundColor };
}), secId);

/* 패널의 라벨 칸에 실제 키보드로 친다(앞의 글자는 지운다). */
async function typeLabel(page, text) {
  await page.click('#stk-count-label');
  expect(await page.evaluate(() => document.activeElement?.id), '★전제: 라벨 칸에 포커스').toBe('stk-count-label');
  await page.keyboard.press('Meta+a');
  await page.keyboard.press('Backspace');
  if (text) await page.keyboard.type(text);
}
/* 칸에서 포커스를 빼 확정한다(change → 히스토리 한 칸). */
const commitField = (page) => page.evaluate(() => document.activeElement?.blur?.());

test('M4 라벨(패널) — 치면 마커 오른쪽에 뜬다 · 마커 상자는 그대로 · 줄바꿈 · 꺾쇠는 글자 그대로 · 비우면 사라진다', async ({ page }) => {
  const errs = await three(page);
  const m0 = (await labels(page, 'secA'))[2];
  expect([m0.has, m0.key], '★전제: 처음엔 라벨이 없다').toEqual([false, null]);
  expect(await page.evaluate(() => !!document.getElementById('stk-count-label-section')), '★전제: 패널에 Label 절이 있다').toBe(true);

  await typeLabel(page, '메쉬포켓');
  const m1 = (await labels(page, 'secA'))[2];
  expect([m1.has, m1.text, m1.key, m1.dpos], '라벨이 그려졌다(오른쪽 · 기본)').toEqual([true, '메쉬포켓', '메쉬포켓', 'right']);
  expect([m1.x, m1.w, m1.h], '마커 상자(자리·폭·높이)는 그대로다').toEqual([m0.x, m0.w, m0.h]);
  expect(m1.left, `라벨 왼쪽 = 마커 폭 + 간격(${m1.w} + ${m1.gap})`).toBe(m1.w + m1.gap);
  expect([m1.fs, m1.color], '라벨 크기 = 마커 폰트 크기 · 색 = 마커 배경색(기본)').toEqual([m1.markerFs, m1.markerBg]);
  /* 화면 사각형의 상대 관계 — 라벨이 마커 오른쪽에 있고 세로 가운데가 맞는다 */
  const rel = await page.evaluate(() => {
    const b = document.querySelector('#secA .sticker-block.selected'), lab = b.querySelector(':scope > .sticker-count-label');
    const mr = b.getBoundingClientRect(), lr = lab.getBoundingClientRect();
    const dy = Math.abs((lr.top + lr.bottom) / 2 - (mr.top + mr.bottom) / 2);
    return { rightOf: lr.left >= mr.right, centered: dy <= 1.5, handles: b.querySelectorAll('.sticker-corner-handle').length };
  });
  expect(rel, '라벨은 마커 오른쪽 · 세로 가운데 · 손잡이는 4개 그대로').toEqual({ rightOf: true, centered: true, handles: 4 });
  const others = (await labels(page, 'secA')).slice(0, 2);
  expect(others.map((o) => [o.has, o.key]), '라벨 글자는 블럭마다 — 같은 섹션의 다른 마킹에는 안 간다').toEqual([[false, null], [false, null]]);

  /* 줄바꿈 — 두 줄이면 높이가 약 두 배 */
  const h1 = m1.lh;
  await typeLabel(page, '가');
  await page.keyboard.press('Enter');
  await page.keyboard.type('나');
  const m2 = (await labels(page, 'secA'))[2];
  expect(m2.key, '줄바꿈이 dataset 에 실린다').toBe('가\n나');
  expect(m2.lh >= h1 * 1.8 && m2.lh <= h1 * 2.2, `두 줄 높이 ${m2.lh} ≈ 한 줄 ${h1} 의 두 배`).toBe(true);

  /* 꺾쇠 — 태그로 안 읽히고 글자 그대로 */
  await typeLabel(page, '<b>x</b>');
  const m3 = (await labels(page, 'secA'))[2];
  expect([m3.text, m3.kids], '꺾쇠는 글자 그대로 보이고 자식 요소는 0').toEqual(['<b>x</b>', 0]);

  /* 비우면 사라진다 */
  await typeLabel(page, '');
  const m4 = (await labels(page, 'secA'))[2];
  expect([m4.has, m4.key], '비우면 라벨도 키도 없다').toEqual([false, null]);
  expect(errs).toEqual([]);
});

test('M5 라벨 자리 4갈래 · 크기 · 색 — 꾸밈은 「섹션 전체」 스위치를 따르고 글자는 블럭마다', async ({ page }) => {
  await three(page);
  await typeLabel(page, '포켓');
  await commitField(page);
  const near = (a, b) => Math.abs(a - b) <= 1;
  const POS = {
    left:   (m) => near(m.left + m.lw, -m.gap),
    top:    (m) => near(m.top + m.lh, -m.gap),
    bottom: (m) => near(m.top, m.h + m.gap),
    right:  (m) => near(m.left, m.w + m.gap),
  };
  for (const pos of ['left', 'top', 'bottom', 'right']) {
    await page.click(`#stk-count-label-pos [data-label-pos="${pos}"]`);
    const all = await labels(page, 'secA');
    const m = all[2];
    expect([m.has, m.dpos, m.text], `${pos}: 라벨이 그 자리로 다시 그려졌다`).toEqual([true, pos, '포켓']);
    expect(POS[pos](m), `${pos}: 자리 — left=${m.left} top=${m.top} lw=${m.lw} lh=${m.lh} 마커 ${m.w}×${m.h} 간격 ${m.gap}`).toBe(true);
    expect(pluck(all, 'pos'), `${pos}: 자리 값은 섹션 셋 다(스위치 켬 · 기본)`).toEqual([pos, pos, pos]);
    expect(await page.evaluate(() => document.querySelector('#stk-count-label-pos .active')?.dataset.labelPos), `${pos}: 패널의 활성 단추`).toBe(pos);
  }
  expect(pluck(await labels(page, 'secA'), 'has'), '글자는 셋째에만 있다(다른 둘은 라벨이 안 그려진다)').toEqual([false, false, true]);

  await typeNumber(page, '#stk-count-label-size-num', 40);
  await expect.poll(async () => (await labels(page, 'secA'))[2].fs, '라벨 크기 40px').toBe('40px');
  let all = await labels(page, 'secA');
  expect([all[2].markerFs, pluck(all, 'lsize')], '마커 폰트는 그대로 · 크기 값은 셋 다').toEqual(['26px', ['40', '40', '40']]);

  await typeHex(page, '#stk-clabel-hex', 'F26B1F');
  await expect.poll(async () => (await labels(page, 'secA'))[2].color, '라벨 색').toBe('rgb(242, 107, 31)');
  all = await labels(page, 'secA');
  expect([all[2].markerBg, new Set(pluck(all, 'lcolor')).size], '마커 배경은 그대로(검정) · 색 값은 셋이 같다').toEqual(['rgb(0, 0, 0)', 1]);
  expect((await labels(page, 'secB'))[0].pos, '다른 섹션은 안 건드린다').toBeNull();
});

test('M6 인라인 — 마커를 더블클릭하면 라벨 편집이 열리고 Enter 로 확정 · 번호 글자는 편집이 안 열린다 · ⌘Z 한 칸', async ({ page }) => {
  await three(page);
  const SEL = '#secA .sticker-block.selected';
  const editing = () => page.evaluate(() => { const b = document.querySelectorAll('#secA .sticker-block[data-count]')[2];
    const lab = b.querySelector(':scope > .sticker-count-label');
    return { lab: !!lab, edit: lab ? lab.getAttribute('contenteditable') : null, focus: !!lab && document.activeElement === lab,
      num: b.querySelector(':scope > .sticker-text')?.getAttribute('contenteditable') ?? null }; });
  const h = await expectOneUndoStep(page, async () => {
    const r = await waitStableRect(page, SEL);
    await clickAt(page, r.cx, r.cy, { sel: '.sticker-block[data-count]' }, { label: '마커 더블클릭', dbl: true });
    await expect.poll(editing, '더블클릭: 라벨 편집이 열리고 포커스가 라벨에 있다 · 번호 글자는 편집이 아니다').toEqual({ lab: true, edit: 'true', focus: true, num: null });
    await page.keyboard.type('사이드 포켓');
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await labels(page, 'secA'))[2].key, 'Enter: 확정됐다').toBe('사이드 포켓');
  }, '마킹 라벨 인라인', { soft: true });
  expect(h.changed, 'A0 편집이 화면을 바꿨다').toBe(true);
  expect(h.dPos >= 1 && h.seqNew, `A1 확정 직후 꼭대기가 새 칸 — Δpos=${h.dPos} top=${h.topAction}`).toBe(true);
  expect([h.undoDLen, h.undoDPos], 'A2 ⌘Z 가 구제 칸 없이 정확히 한 칸').toEqual([0, -1]);
  const back = await labels(page, 'secA');
  expect([back.length, back.map((m) => [m.has, m.key])], '⌘Z 한 번 뒤: 마킹 셋은 그대로 · 라벨만 없다').toEqual([3, [[false, null], [false, null], [false, null]]]);
});

test('M6b 인라인 — 확정 뒤 편집 잔재가 없고(다시 그린 라벨) 패널 칸도 같은 글자 · Esc 도 확정한다', async ({ page }) => {
  await three(page);
  const SEL = '#secA .sticker-block.selected';
  const r = await waitStableRect(page, SEL);
  await clickAt(page, r.cx, r.cy, { sel: '.sticker-block[data-count]' }, { label: '마커 더블클릭', dbl: true });
  await expect.poll(() => page.evaluate(() => document.activeElement?.classList.contains('sticker-count-label') || false), '★전제: 라벨 편집이 열렸다').toBe(true);
  await page.keyboard.type('방수포켓');
  await page.keyboard.press('Escape');
  await expect.poll(async () => (await labels(page, 'secA'))[2].key, 'Esc: 확정됐다(버리지 않는다)').toBe('방수포켓');
  const after = await page.evaluate(() => { const b = document.querySelectorAll('#secA .sticker-block[data-count]')[2]; const lab = b.querySelector(':scope > .sticker-count-label');
    return { edit: lab.getAttribute('contenteditable'), text: lab.textContent, selected: b.classList.contains('selected'), handles: b.querySelectorAll('.sticker-corner-handle').length,
      field: document.getElementById('stk-count-label')?.value, inlineEditStyle: /user-select|cursor/.test(lab.getAttribute('style') || '') }; });
  expect(after, '확정 뒤: 편집 속성 없음 · 선택·손잡이 그대로 · 패널 칸 동기화 · 라벨에 편집용 인라인 style 없음')
    .toEqual({ edit: null, text: '방수포켓', selected: true, handles: 4, field: '방수포켓', inlineEditStyle: false });
});

test('M7 살아남기 — ⌘Z/⌘⇧Z · ⌘D 복제 · 직렬화→다시 싣기 뒤에도 아이콘·라벨이 같다 · 손잡이·편집 잔재가 직렬화에 0', async ({ page }) => {
  test.setTimeout(90000);
  const errs = await three(page);
  await page.click('#stk-count-style [data-count-style="icon"]');
  await page.click('#stk-count-glyph [data-count-glyph="check"]');
  await typeLabel(page, '메쉬포켓');
  await commitField(page);
  const CHECK = '3.5 8.5 6.5 11.5 12.5 4.5';
  /* 라벨을 든 마킹들의 모습(아이콘 좌표 · 라벨 글자 · 라벨 자리) */
  const labeled = () => page.evaluate(() => [...document.querySelectorAll('#canvas .sticker-block[data-count]')].filter((b) => b.dataset.countLabel).map((b) => {
    const lab = b.querySelector(':scope > .sticker-count-label'), first = b.querySelector(':scope > .sticker-count-icon > svg')?.firstElementChild;
    return { style: b.dataset.countStyle, icon: b.dataset.countIcon, points: first ? first.getAttribute('points') : null,
      label: lab ? lab.textContent : null, off: lab ? lab.offsetLeft - b.offsetWidth : null, w: b.offsetWidth };
  }));
  const total = () => page.evaluate(() => document.querySelectorAll('#canvas .sticker-block[data-count]').length);
  const want = { style: 'icon', icon: 'check', points: CHECK, label: '메쉬포켓', off: 11, w: 56 };
  expect(await labeled(), '★전제: 아이콘(check)과 라벨을 든 마킹이 하나 그려져 있다').toEqual([want]);

  /* ⑴ ⌘Z → 라벨만 사라진다 / ⌘⇧Z → 돌아온다 */
  await page.keyboard.press('Meta+z');
  await expect.poll(async () => (await labeled()).length, '⌘Z: 라벨 입력이 되돌아갔다').toBe(0);
  expect(pluck(await look(page, 'secA'), 'points'), '⌘Z 뒤에도 아이콘은 그대로(다시 그려졌다)').toEqual([CHECK, CHECK, CHECK]);
  await page.keyboard.press('Meta+Shift+z');
  await expect.poll(labeled, '⌘⇧Z: 아이콘·라벨이 같은 모습으로 돌아온다').toEqual([want]);

  /* ⑵ ⌘D 복제 — 사본도 같은 아이콘·라벨로 그려진다 */
  await pickMark(page, 2);
  await page.keyboard.press('Meta+d');
  await expect.poll(total, '★전제: ⌘D 로 마킹이 하나 늘었다(secA 4 + secB 1)').toBe(5);
  expect(await labeled(), '⌘D: 원본과 사본 둘 다 같은 아이콘·라벨').toEqual([want, want]);

  /* ⑶ 직렬화 → 세척 → 다시 싣기(저장→열기와 같은 길) */
  const html = await page.evaluate(() => window.getSerializedCanvas());
  expect(html.includes('data-count-label="메쉬포켓"'), '★전제: 직렬화에 라벨 키가 실렸다').toBe(true);
  expect([/contenteditable/.test(html), /sticker-corner-handle/.test(html), /sticker-rotate-zone/.test(html)], '직렬화에 편집 속성·손잡이·회전 핫존 잔재 0').toEqual([false, false, false]);
  await page.evaluate((h) => { document.getElementById('canvas').innerHTML = window.sanitizeCanvasHtml(h); window.rebindAll(); }, html);
  await settle(page);
  expect(await total(), '★전제: 다시 실은 뒤에도 마킹 5개').toBe(5);
  expect(await labeled(), '다시 실은 뒤: 아이콘·라벨이 같은 모습').toEqual([want, want]);
  expect(errs).toEqual([]);
});

test('M8 섹션 경계 — 마커가 왼쪽 경계에 걸쳐도 오른쪽 라벨은 안 잘린다 · 라벨 없는 것의 --sec-clip 은 예전 값 그대로', async ({ page }) => {
  await three(page);
  await typeLabel(page, '행잉 디바이더');
  await commitField(page);
  /* 셋째(라벨 있음)와 첫째(라벨 없음)를 왼쪽 경계 밖으로 20px 씩 밀고 다시 그린다. 클립은 «안 고른» 동안만 걸린다 → 선택을 푼다. */
  const OVER = 20;
  const clip = await page.evaluate(async (over) => {
    const all = [...document.querySelectorAll('#secA .sticker-block[data-count]')];
    window._deselectAllStickers();
    for (const b of [all[0], all[2]]) { b.dataset.x = String(-over); window.renderStickerBlock(b); }
    await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
    const read = (b) => { const v = b.style.getPropertyValue('--sec-clip').trim(); const n = (v.match(/-?[\d.]+(?=px)/g) || []).map(Number);
      return { v, n, computed: getComputedStyle(b).clipPath, left: b.offsetLeft, selected: b.classList.contains('selected') }; };
    const lab = all[2].querySelector(':scope > .sticker-count-label');
    return { bare: read(all[0]), labeled: read(all[2]), inside: read(all[1]), labelRight: lab.offsetLeft + lab.offsetWidth, w: all[2].offsetWidth };
  }, OVER);
  expect([clip.bare.left, clip.labeled.left, clip.bare.selected, clip.labeled.selected], '★전제: 둘 다 왼쪽 경계 밖으로 나갔고 안 골라져 있다').toEqual([-OVER, -OVER, false, false]);
  expect(clip.bare.v, '라벨 없는 마킹: 예전 값 그대로(왼쪽만 자른다)').toBe(`inset(0px 0px 0px ${OVER}px)`);
  expect(clip.labeled.n.length, `★전제: 라벨 있는 마킹의 --sec-clip 을 읽었다 — «${clip.labeled.v}»`).toBe(4);
  const [t, r, b, l] = clip.labeled.n;
  expect([t, b, l], '라벨 있는 마킹: 위·아래 0 · 왼쪽은 넘친 만큼').toEqual([0, 0, OVER]);
  expect(r, `오른쪽 inset = −(라벨이 마커 밖으로 나간 폭) = ${clip.w} − ${clip.labelRight}`).toBe(clip.w - clip.labelRight);
  expect(r < 0, '오른쪽 inset 이 음수다(라벨 쪽을 열어 준다)').toBe(true);
  expect(clip.labeled.computed.startsWith('inset('), `그려지는 clip-path 에 실제로 걸렸다 — ${clip.labeled.computed}`).toBe(true);
  expect(clip.inside.v, '섹션 안에 온전히 있는 마킹: 변수 없음').toBe('');
  /* 라벨까지 섹션 안이면 변수를 지운다 */
  const back = await page.evaluate(async () => { const b = document.querySelectorAll('#secA .sticker-block[data-count]')[2]; b.dataset.x = '200'; window.renderStickerBlock(b);
    await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res))); return b.style.getPropertyValue('--sec-clip'); });
  expect(back, '다시 안으로 들이면 변수가 사라진다').toBe('');
});

test('M10 내보내기 클론 — 에디터 CSS 가 없는 문서에서도 라벨이 마커 오른쪽·세로 가운데다(자리 스타일이 인라인)', async ({ page }) => {
  await three(page);
  await page.click('#stk-count-style [data-count-style="icon"]');
  await typeLabel(page, '방수포켓');
  await commitField(page);
  const r = await page.evaluate(async () => {
    const src = document.querySelectorAll('#secA .sticker-block[data-count]')[2];
    const clone = src.cloneNode(true);
    clone.classList.remove('selected');
    clone.querySelectorAll('.sticker-corner-handle, .sticker-rotate-zone').forEach((n) => n.remove());
    clone.style.left = '8px'; clone.style.top = '8px';
    const f = document.createElement('iframe');
    f.style.cssText = 'position:fixed;left:0;top:0;width:480px;height:240px;border:0;';
    f.srcdoc = '<!doctype html><html><body style="margin:0"><div id="box" style="position:relative;width:480px;height:240px">' + clone.outerHTML + '</div></body></html>';
    const loaded = new Promise((res) => f.addEventListener('load', res, { once: true }));
    document.body.appendChild(f);
    await loaded;
    const d = f.contentDocument;
    const m = d.querySelector('.sticker-block'), lab = m.querySelector('.sticker-count-label'), svg = m.querySelector('.sticker-count-icon > svg');
    const mr = m.getBoundingClientRect(), lr = lab.getBoundingClientRect(), sr = svg.getBoundingClientRect();
    const dy = Math.abs((lr.top + lr.bottom) / 2 - (mr.top + mr.bottom) / 2);
    const out = { sheets: d.styleSheets.length, text: lab.textContent, rightOf: lr.left >= mr.right, gap: Math.round(lr.left - mr.right), centered: dy <= 1.5,
      wantGap: Math.round(parseInt(m.dataset.sizeW, 10) * 0.2), iconW: Math.round(sr.width), fontPx: parseInt(m.style.fontSize, 10),
      iconInside: sr.left >= mr.left && sr.right <= mr.right, labelSizeOk: getComputedStyle(lab).fontSize === m.style.fontSize };
    f.remove();
    return out;
  });
  expect(r.sheets, '★전제: 그 문서에는 스타일시트가 하나도 없다').toBe(0);
  expect(r.text, '★전제: 클론에 라벨이 실렸다').toBe('방수포켓');
  expect([r.rightOf, r.centered, r.gap], '라벨: 마커 오른쪽 · 세로 가운데 · 간격 = 마커 폭의 20%').toEqual([true, true, r.wantGap]);
  expect([r.iconW, r.iconInside, r.labelSizeOk], '아이콘 폭 = 폰트 크기(숫자로 구웠다) · 마커 안 · 라벨 크기도 인라인').toEqual([r.fontPx, true, true]);
});
