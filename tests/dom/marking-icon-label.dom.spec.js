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
 *   M9 프리셋 「포인트」 — 한 번에 사각·주황·흰 꺾쇠·흰 라벨(섹션 전부) · ⌘Z 한 칸 / 「번호」 = 기본 꼴로
 *   M9b 「아이콘 고르기…」 — 고르개가 준 svg 를 걸러서 섹션 전부에 넣는다 · img 폴백은 안 쓴다(고르개는 «대역» — 모달·네트워크를 안 연다)
 *   ── 2차(이벨류에이터 재검 반영) ──
 *   M5b 라벨 색 폴백 — 패널 칸이 보이는 색 = 그려진 색(배경색 키가 없는 블럭에서도 · D6)
 *   M6c 인라인 붙여넣기 — html 을 붙여도 라벨 DOM 에 태그가 안 생긴다(평문만 · D7) · ⌘B 도 태그를 안 만든다
 *   M7b 살아남기(빈 길) — ⌘C⌘V · A/B 변형 · 섹션 템플릿 넣기 뒤에도 아이콘·라벨이 같고 사본이 묶여 있다(더블클릭 편집이 열린다)
 *   M9c 모서리·라벨 굵기 — 패널에서 바꿀 수 있다(모서리 = 한 변의 % · 라벨 굵기는 마커 굵기와 따로)
 *   ── 3차(이벨류에이터 2단계 반영) ──
 *   M3b 손댄 저장본의 «빈 껍데기» svg 는 기본 글리프로(N11) · 커스텀 아이콘이 폰트 크기·글자색을 따라온다(T2 — 세척 캐시) · 같은 아이콘을 든 블럭끼리 id 가 안 겹친다(N2)
 *   M6d 인라인 편집 중 점선 테두리가 실제로 그려진다(N1)
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

/* ── 프리셋 · 아이콘 고르기(1013t2B5) ────────────────────────────────────────────────────────────── */

/* ★1017t1j2(현빈) — 아래 두 값(주황·짙은 꺾쇠)은 ★이제 쓰지 않는다. 2차(D2)에서 그림(ref/1013t2-img02.png)에
   맞춰 골랐던 값이 검정 배경·흰 글자로 바뀌었다(js/count-sticker-tool.js COUNT_STK_PRESETS.point — 그 파일 :53~55 의
   픽셀 출처 주석과 같이 읽어라). ★비석으로 남긴다 — 지우지 않는다. */
const DARK = 'rgb(26, 26, 26)';          // #1a1a1a — ★옛 값(1017t1j2 이전의 COUNT_STK_PRESETS.point.textColor)
const ORANGE = 'rgb(235, 98, 23)';       // #eb6217 — ★옛 값(1017t1j2 이전의 COUNT_STK_PRESETS.point.bgColor)
const BLACK = 'rgb(0, 0, 0)';            // #000000 — js/count-sticker-tool.js COUNT_STK_PRESETS.point.bgColor(1017t1j2 이후 · 글자로 박는다)

/* 그 섹션 마킹들의 «꼴» — 모양·색·아이콘·라벨 색. */
const shapeLook = (page, secId) => page.evaluate((id) => [...document.querySelectorAll(`#${id} .sticker-block[data-count]`)].map((b) => {
  const c = getComputedStyle(b), first = b.querySelector(':scope > .sticker-count-icon > svg')?.firstElementChild, lab = b.querySelector(':scope > .sticker-count-label');
  return { radius: c.borderRadius, bg: c.backgroundColor, points: first ? first.getAttribute('points') : null, stroke: first ? getComputedStyle(first).stroke : null,
    num: b.querySelector(':scope > .sticker-text')?.textContent ?? null, label: lab ? lab.textContent : null, labelColor: lab ? getComputedStyle(lab).color : null,
    labelLeft: lab ? lab.offsetLeft - b.offsetWidth : null, labelFs: lab ? getComputedStyle(lab).fontSize : null, labelFw: lab ? getComputedStyle(lab).fontWeight : null };
}), secId);

test('M9 프리셋 「포인트」 — 한 번에 주황 둥근 네모·짙은 꺾쇠·흰 굵은 라벨(섹션 전부) · ⌘Z 한 칸 / 「번호」는 기본 꼴로', async ({ page }) => {
  const errs = await three(page);
  await typeLabel(page, '메쉬포켓');
  await commitField(page);
  const b0 = await shapeLook(page, 'secB');
  const a0 = await shapeLook(page, 'secA');
  expect(a0.map((m) => [m.radius, m.bg, m.num]), '★전제: 기본 꼴(원 · 검정 · 번호)').toEqual([['50%', 'rgb(0, 0, 0)', '1'], ['50%', 'rgb(0, 0, 0)', '2'], ['50%', 'rgb(0, 0, 0)', '3']]);
  expect([a0[2].label, a0[2].labelColor], '★전제: 셋째의 라벨은 마커 배경색(검정)').toEqual(['메쉬포켓', 'rgb(0, 0, 0)']);
  expect(await page.evaluate(() => document.querySelectorAll('#stk-count-presets [data-count-preset]').length), '★전제: 프리셋 단추 둘').toBe(2);

  /* ★1017t1j2(현빈) — 주황·짙은 꺾쇠(2차 D2 의 그림 꼴)를 검정 배경·흰 글자로. 모서리 = 한 변의 25%(안 바뀜). */
  const point = { radius: '14px', bg: BLACK, points: CHEVRON, stroke: WHITE, num: null };   // 14px = 짧은 변 56 × 25%(3차 N3 — % 가 아니라 px 로 굽는다)
  const h = await expectOneUndoStep(page, async () => {
    await page.click('#stk-count-presets [data-count-preset="point"]');
    /* ★bg 는 이제 ★전제(검정)와 같아 변화 신호가 못 된다(1017t1j2) — 모양(radius 50%→14px)으로 「바뀌었다」를 잰다. */
    await expect.poll(async () => pluck(await shapeLook(page, 'secA'), 'radius'), '★전제: 셋 다 모양이 바뀌었다(둥근 네모)').toEqual(['14px', '14px', '14px']);
    const a = await shapeLook(page, 'secA');
    expect(a.map((m) => ({ radius: m.radius, bg: m.bg, points: m.points, stroke: m.stroke, num: m.num })), '포인트: 둥근 네모 · 검정 · 흰 꺾쇠(섹션 셋 다)').toEqual([point, point, point]);
    expect([a[2].label, a[2].labelColor, a[2].labelLeft], '포인트: 라벨 글자는 그대로 · 흰색 · 마커 오른쪽').toEqual(['메쉬포켓', WHITE, 11]);
    expect([a[2].labelFs, a[2].labelFw], '포인트: 라벨 글자 = 마커 한 변(56)의 0.9배 · 굵게').toEqual(['50px', '700']);
    /* ★1017t1j2 뒤 — 꺾쇠(stroke)와 라벨색(labelColor)이 ★값으로는 같아졌다(둘 다 흰색). 그래도 ★키는 따로다 —
       바로 아래 panel 단언의 txtHex(글자색 칸)·labelHex(라벨색 칸)가 ★각자의 입력칸에서 따로 산다(값이 같아도 독립). */
    expect([a[2].stroke, a[2].labelColor], '꺾쇠색·라벨색 — 값은 같아졌다(흰·흰) · 독립성은 아래 panel 의 txtHex≠없음·labelHex 가 본다').toEqual([WHITE, WHITE]);
    expect(pluck(a, 'label').slice(0, 2), '라벨 글자가 없는 둘에는 라벨이 안 생긴다').toEqual([null, null]);
    const panel = await page.evaluate(() => ({ style: document.querySelector('#stk-count-style .active')?.dataset.countStyle, shape: document.querySelector('#stk-count-shape .active')?.dataset.countShape,
      glyph: document.querySelector('#stk-count-glyph .active')?.dataset.countGlyph, bgHex: document.getElementById('stk-bg-hex')?.value,
      txtHex: document.getElementById('stk-txt-hex')?.value, radius: document.getElementById('stk-count-radius-num')?.value,
      labelHex: document.getElementById('stk-clabel-hex')?.value, labelSize: document.getElementById('stk-count-label-size-num')?.value, labelWeight: document.getElementById('stk-count-label-weight')?.value,
      handles: document.querySelectorAll('#secA .sticker-block.selected .sticker-corner-handle').length }));
    expect(panel, '패널이 새 꼴로 다시 그려졌다 · 손잡이 그대로 · txtHex·labelHex 는 ★값이 같아도 ★각자의 칸(독립성)')
      .toEqual({ style: 'icon', shape: 'square', glyph: 'chevron-right', bgHex: '000000', txtHex: 'FFFFFF', radius: '25', labelHex: 'FFFFFF', labelSize: '50', labelWeight: '700', handles: 4 });
  }, '마킹 프리셋 포인트', { soft: true });
  expect(await shapeLook(page, 'secB'), '다른 섹션은 그대로(⌘Z 뒤에도)').toEqual(b0);
  expect(h.dPos >= 1 && h.seqNew, `A1 프리셋 직후 꼭대기가 새 칸 — Δpos=${h.dPos} top=${h.topAction}`).toBe(true);
  expect([h.undoDLen, h.undoDPos], 'A2 ⌘Z 가 구제 칸 없이 정확히 한 칸').toEqual([0, -1]);
  await expect.poll(() => shapeLook(page, 'secA'), '⌘Z 한 번에 셋 다 프리셋 전으로').toEqual(a0);

  /* 「번호」 — 포인트를 깐 뒤 기본 꼴로. ★이게 t1j2 의 진짜 음성대조다(바로 위 MEMORY 지적과 같은 자리) — 색이
     「번호」와 같아져도(둘 다 검정·흰) 모양(원 50% vs 네모 14px)·표기(num vs icon)로 ★여전히 갈려야 한다.
     두 프리셋이 구분 불가가 되면 이 되돌리기(아래 a0 로의 복귀)가 먼저 빨개진다. */
  await pickMark(page, 2);
  await page.click('#stk-count-presets [data-count-preset="point"]');
  await expect.poll(async () => pluck(await shapeLook(page, 'secA'), 'radius'), '★전제: 다시 둥근 네모').toEqual(['14px', '14px', '14px']);
  await page.click('#stk-count-presets [data-count-preset="number"]');
  await expect.poll(() => shapeLook(page, 'secA'), '번호: 원 · 검정 · 번호 글자 · 라벨은 마커 색(검정)으로').toEqual(a0);
  expect(errs).toEqual([]);
});

test('M9b 아이콘 고르기 — 고르개가 준 svg 를 걸러 섹션 전부에 넣는다 · img 폴백은 안 쓴다 · ⌘Z 한 칸', async ({ page }) => {
  const errs = await three(page);
  /* 고르개는 «대역»이다 — 진짜 모달·네트워크를 안 연다. 단추가 부르는 것이 window.openIconifyModal 이고(레포의 기존 고르개 입구),
     그 콜백에 { svg } 를 돌려준다는 계약만 흉내 낸다. */
  await page.evaluate(() => {
    window.__pickCalls = [];
    window.__pickReply = { name: 'mdi:arrow', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" onload="window.__pwned=1"><script>window.__pwned=2</script><path fill="currentColor" d="M4 11h12v2H4z"/></svg>' };
    window.openIconifyModal = (cb, opts) => { window.__pickCalls.push(opts || null); cb(window.__pickReply); };
  });
  expect(await page.evaluate(() => getComputedStyle(document.getElementById('stk-count-icon-pick-row')).display), '★전제: 번호 표기일 때 「아이콘 고르기」 행은 숨어 있다').toBe('none');
  await page.click('#stk-count-style [data-count-style="icon"]');
  expect(await page.evaluate(() => getComputedStyle(document.getElementById('stk-count-icon-pick-row')).display), '아이콘 표기면 행이 보인다').toBe('flex');

  const state = () => page.evaluate(() => [...document.querySelectorAll('#secA .sticker-block[data-count]')].map((b) => {
    const svg = b.querySelector(':scope > .sticker-count-icon > svg');
    return { icon: b.dataset.countIcon, stored: b.dataset.countIconSvg ?? null, d: svg?.querySelector('path')?.getAttribute('d') ?? null,
      w: svg ? svg.getAttribute('width') : null, on: svg ? [...svg.attributes].filter((a) => /^on/i.test(a.name)).length : null, scripts: b.querySelectorAll('script').length };
  }));
  const CLEAN = '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24"><path fill="currentColor" d="M4 11h12v2H4z"/></svg>';
  const h = await expectOneUndoStep(page, async () => {
    await page.click('#stk-count-icon-pick');
    await expect.poll(async () => pluck(await state(), 'icon'), '★전제: 셋 다 custom 이 됐다').toEqual(['custom', 'custom', 'custom']);
  }, '마킹 아이콘 고르기', { soft: true });
  expect(await page.evaluate(() => window.__pickCalls.length), '★전제: 고르개 입구를 한 번 불렀다').toBe(1);
  expect(h.dPos >= 1 && h.seqNew, `A1 고른 직후 꼭대기가 새 칸 — Δpos=${h.dPos}`).toBe(true);
  expect([h.undoDLen, h.undoDPos], 'A2 ⌘Z 가 구제 칸 없이 정확히 한 칸').toEqual([0, -1]);
  await expect.poll(async () => pluck(await state(), 'icon'), '⌘Z: 고르기 전(내장 글리프)으로').toEqual(['chevron-right', 'chevron-right', 'chevron-right']);

  /* 다시 골라 «걸러진» 모습을 본다 */
  await pickMark(page, 2);
  await page.click('#stk-count-icon-pick');
  const s = await state();
  expect(pluck(s, 'stored'), 'dataset 에는 거른 svg 만(onload·script 없음)').toEqual([CLEAN, CLEAN, CLEAN]);
  expect(s.map((x) => [x.d, x.w, x.on, x.scripts]), '그려진 것: 그 path · 폭 = 폰트 크기(26) · on* 0 · script 0').toEqual(Array(3).fill(['M4 11h12v2H4z', '26', 0, 0]));
  expect(await page.evaluate(() => window.__pwned ?? null), '아무것도 실행되지 않았다').toBeNull();
  expect(await page.evaluate(() => document.querySelector('#stk-count-glyph .active')), '내장 글리프 단추는 아무것도 활성이 아니다').toBeNull();

  /* img 폴백(고르개가 아이콘을 못 받았을 때 주는 꼴)은 안 쓴다 */
  await page.evaluate(() => { window.__pickReply = { name: 'x', svg: '<img src="https://api.iconify.design/x.svg" onerror="window.__pwned=3">' }; });
  await page.click('#stk-count-icon-pick');
  expect(pluck(await state(), 'stored'), 'img 문자열: 앞의 아이콘 그대로').toEqual([CLEAN, CLEAN, CLEAN]);
  expect(await page.evaluate(() => [window.__pickCalls.length, window.__pwned ?? null, document.querySelectorAll('#secA .sticker-block img').length]), '고르개는 불렀지만 쓰지 않았다 · img 0').toEqual([3, null, 0]);

  /* ★거절(2차 · D8) — svg 꼴이지만 걸러 보니 «그릴 것»이 없는 것: 아이콘도 히스토리도 안 바뀐다(1차에는 「마킹 아이콘」 칸이 헛찍혔다)
     ★3차(T1) — 「히스토리 0칸」만으로는 패널의 `if (!wrote) { toast; return; }` 줄을 못 가른다(문서가 안 바뀌면 pushHistory 의 무변화 차단이 어차피 안 쌓는다).
       그래서 «부른 것» 자체를 센다: 거절 때는 pushHistory 를 «아예 안 부르고» toast 를 띄운다. */
  await page.evaluate(() => {
    window.__spy = { push: [], toast: [] };
    const realPush = window.pushHistory;
    window.pushHistory = function (label) { window.__spy.push.push(label ?? null); return realPush.apply(this, arguments); };
    window.showToast = (msg) => { window.__spy.toast.push(String(msg)); };
  });
  const tip0 = await page.evaluate(() => { const t = window.getHistoryTip(); return [t.pos, t.len, t.seq]; });
  for (const bad of ['<svg viewBox="0 0 24 24"><script>window.__pwned=4</script><g><title>빈 껍데기</title></g></svg>', '<svg viewBox="0 0 24 24"><path d="M0 0" onclick="x']) {
    await page.evaluate((svg) => { window.__pickReply = { name: 'x', svg }; }, bad);
    await page.click('#stk-count-icon-pick');
  }
  expect(await page.evaluate(() => window.__pickCalls.length), '★전제: 고르개 입구를 두 번 더 불렀다').toBe(5);
  expect(pluck(await state(), 'stored'), '거절: 앞의 아이콘 그대로').toEqual([CLEAN, CLEAN, CLEAN]);
  expect(await page.evaluate(() => { const t = window.getHistoryTip(); return [t.pos, t.len, t.seq]; }), '거절: 히스토리가 한 칸도 안 생긴다').toEqual(tip0);
  expect(await page.evaluate(() => window.__spy), '거절 두 번: pushHistory 를 한 번도 안 부르고 toast 를 두 번 띄운다')
    .toEqual({ push: [], toast: ['⚠️ 쓸 수 없는 아이콘입니다', '⚠️ 쓸 수 없는 아이콘입니다'] });
  expect(await page.evaluate(() => window.__pwned ?? null)).toBeNull();
  /* 대조 — 스파이가 살아 있다: 쓸 수 있는 아이콘을 고르면 pushHistory('마킹 아이콘') 이 한 번 불리고 toast 는 안 는다 */
  await page.evaluate(() => { window.__pickReply = { name: 'ok', svg: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="6"/></svg>' }; });
  await page.click('#stk-count-icon-pick');
  expect(await page.evaluate(() => [window.__spy.push, window.__spy.toast.length]), '★대조: 받아들인 아이콘은 히스토리를 찍는다(스파이가 실제로 센다)').toEqual([['마킹 아이콘'], 2]);
  expect(errs).toEqual([]);
});

/* ── 2차 — 이벨류에이터 재검 반영 ─────────────────────────────────────────────────────────────── */

test('M5b 라벨 색 폴백 — 패널 칸이 보이는 색 = 그려진 색(배경색 키가 없는 블럭에서도)', async ({ page }) => {
  await three(page);
  await typeLabel(page, '포켓');
  await commitField(page);
  /* 색을 문자열(#RRGGBB)로 읽는 자 — 그려진 색과 패널 칸을 같은 꼴로 견준다 */
  const both = () => page.evaluate(() => {
    const b = document.querySelector('#secA .sticker-block.selected'), lab = b.querySelector(':scope > .sticker-count-label');
    const hex = (rgb) => '#' + rgb.match(/\d+/g).slice(0, 3).map((n) => Number(n).toString(16).padStart(2, '0')).join('').toUpperCase();
    return { drawn: hex(getComputedStyle(lab).color), field: '#' + document.getElementById('stk-clabel-hex').value.toUpperCase(), hasBg: 'bgColor' in b.dataset, hasLabelColor: 'countLabelColor' in b.dataset };
  });
  expect(await both(), '★전제: 배경색 키가 있는 보통 블럭 — 라벨 = 마커 배경색(검정) · 패널 칸도 같다').toEqual({ drawn: '#000000', field: '#000000', hasBg: true, hasLabelColor: false });
  /* 손댄 옛 블럭처럼 배경색 키를 지우고 다시 그린 뒤 패널을 다시 연다 */
  await page.evaluate(() => { const b = document.querySelector('#secA .sticker-block.selected'); delete b.dataset.bgColor; window.renderStickerBlock(b); window._addCornerHandles(b); window.showStickerProperties(b); });
  const r = await both();
  expect([r.hasBg, r.hasLabelColor], '★전제: 배경색 키도 라벨색 키도 없다').toEqual([false, false]);
  expect(r.drawn, '★전제: 그리기의 폴백은 스티커 기본색(빨강)이다').toBe('#E74C3C');
  expect(r.field, '패널 칸도 같은 색을 보인다(1차: 패널은 검정이었다)').toBe(r.drawn);
});

test('M6c 인라인 붙여넣기 — html 을 붙여도 라벨에 태그가 안 생긴다(평문만) · ⌘B 도 태그를 안 만든다', async ({ page }) => {
  await three(page);
  const r = await waitStableRect(page, '#secA .sticker-block.selected');
  await clickAt(page, r.cx, r.cy, { sel: '.sticker-block[data-count]' }, { label: '마커 더블클릭', dbl: true });
  await expect.poll(() => page.evaluate(() => document.activeElement?.classList.contains('sticker-count-label') || false), '★전제: 라벨 편집이 열렸다').toBe(true);
  /* 합성 paste — text/html 과 text/plain 을 같이 싣는다(서식 있는 글을 복사했을 때의 꼴). 편집기는 평문 쪽만 넣어야 한다. */
  const pasted = await page.evaluate(() => {
    const lab = document.activeElement;
    const dt = new DataTransfer();
    dt.setData('text/html', '<b>굵게</b><img src="x" onerror="window.__pwned=1"><span style="color:red">빨강</span>');
    dt.setData('text/plain', '굵게 빨강');
    const ev = new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true });
    const notCancelled = lab.dispatchEvent(ev);
    return { types: [...dt.types].sort(), prevented: !notCancelled, kids: lab.children.length, text: lab.textContent, html: lab.innerHTML };
  });
  expect(pasted.types, '★전제: 붙여넣기에 html 과 평문이 둘 다 실렸다').toEqual(['text/html', 'text/plain']);
  expect([pasted.prevented, pasted.kids, pasted.text], '붙여넣기: 기본 동작을 막고 평문만 넣는다 — 자식 요소 0').toEqual([true, 0, '굵게 빨강']);
  expect(/<|onerror/.test(pasted.html), `라벨 안에 태그가 없다 — ${pasted.html}`).toBe(false);
  /* ⌘B — 글자를 골라 눌러도 서식 태그가 안 생긴다 */
  await page.keyboard.press('Meta+a');
  await page.keyboard.press('Meta+b');
  expect(await page.evaluate(() => { const lab = document.activeElement; return [lab.classList.contains('sticker-count-label'), lab.children.length, lab.textContent]; }), '⌘B: 여전히 평문').toEqual([true, 0, '굵게 빨강']);
  await page.keyboard.press('Enter');
  const done = await page.evaluate(() => { const b = document.querySelectorAll('#secA .sticker-block[data-count]')[2]; const lab = b.querySelector(':scope > .sticker-count-label');
    return { key: b.dataset.countLabel, text: lab.textContent, kids: lab.children.length, pwned: window.__pwned ?? null }; });
  expect(done, '확정: 평문이 그대로 실린다 · 아무것도 실행되지 않았다').toEqual({ key: '굵게 빨강', text: '굵게 빨강', kids: 0, pwned: null });
});

test('M7b 살아남기(빈 길) — ⌘C⌘V · A/B 변형 · 섹션 템플릿 넣기 뒤에도 아이콘·라벨이 같고 사본이 묶여 있다', async ({ page }) => {
  test.setTimeout(90000);
  const errs = await three(page);
  await page.click('#stk-count-style [data-count-style="icon"]');
  await page.click('#stk-count-glyph [data-count-glyph="star"]');
  await typeLabel(page, '방수포켓');
  await commitField(page);
  /* 라벨을 든 마킹들 — 자리(레이아웃)는 안 본다(변형 사본은 숨은 섹션일 수 있다). dataset · 그려진 svg · 라벨의 인라인 자리 · 묶임 표시. */
  const STAR = '8 2.2 9.8 6 14 6.5 10.9 9.3 11.7 13.4 8 11.4 4.3 13.4 5.1 9.3 2 6.5 6.2 6';
  const labeled = () => page.evaluate(() => [...document.querySelectorAll('#canvas .sticker-block[data-count]')].filter((b) => b.dataset.countLabel).map((b) => {
    const lab = b.querySelector(':scope > .sticker-count-label'), first = b.querySelector(':scope > .sticker-count-icon > svg')?.firstElementChild;
    return { id: b.id, style: b.dataset.countStyle, icon: b.dataset.countIcon, points: first ? first.getAttribute('points') : null,
      label: lab ? lab.textContent : null, labelLeft: lab ? lab.style.left : null, labels: b.querySelectorAll('.sticker-count-label').length, bound: b._stickerBound === true };
  }));
  const want = { style: 'icon', icon: 'star', points: STAR, label: '방수포켓', labelLeft: '100%', labels: 1, bound: true };
  const strip = (rows) => rows.map(({ id, ...rest }) => rest);
  const total = () => page.evaluate(() => document.querySelectorAll('#canvas .sticker-block[data-count]').length);
  const first = await labeled();
  expect(strip(first), '★전제: 아이콘(star)과 라벨을 든 마킹이 하나 있다').toEqual([want]);
  expect(await total(), '★전제: 마킹 4개(secA 3 + secB 1)').toBe(4);

  /* ⑴ ⌘C ⌘V — 붙여넣은 사본도 같은 모습이고 묶여 있다 */
  await pickMark(page, 2);
  await page.keyboard.press('Meta+c');
  await page.keyboard.press('Meta+v');
  await expect.poll(total, '★전제: ⌘C⌘V 로 마킹이 하나 늘었다').toBe(5);
  const two = await labeled();
  expect(strip(two), '⌘C⌘V: 원본과 사본 둘 다 같은 아이콘·라벨(라벨은 하나씩)').toEqual([want, want]);
  expect(new Set(two.map((x) => x.id)).size, '사본의 id 는 새로 지었다').toBe(2);
  /* 사본의 편집 바인딩 — 실제 더블클릭으로 라벨 편집이 열린다 */
  const copyId = two.find((x) => x.id !== first[0].id).id;
  const cr = await waitStableRect(page, `[id="${copyId}"]`);
  const onCopy = await page.evaluate(([x, y, id]) => { const e = document.elementFromPoint(x, y), b = document.getElementById(id);
    return !!e && (e === b || b.contains(e)); }, [cr.cx, cr.cy, copyId]);
  expect(onCopy, '★전제: 누를 점의 맨 위 요소가 붙여넣은 사본이다').toBe(true);
  await clickAt(page, cr.cx, cr.cy, { sel: '.sticker-block[data-count]' }, { label: '사본 더블클릭', dbl: true });
  await expect.poll(() => page.evaluate((id) => { const lab = document.getElementById(id)?.querySelector(':scope > .sticker-count-label');
    return !!lab && lab.getAttribute('contenteditable') === 'true' && document.activeElement === lab; }, copyId), '사본을 더블클릭하면 라벨 편집이 열린다').toBe(true);
  await page.keyboard.press('Escape');
  await expect.poll(async () => strip(await labeled()), '편집을 닫은 뒤에도 둘 다 그대로').toEqual([want, want]);

  /* ⑵ A/B 변형 — 섹션 사본 안의 마킹도 다시 그려지고 묶인다 */
  /* 붙여넣은 사본이 어느 섹션에 놓였는지는 이 칸이 정하지 않는다 — secA 안의 수를 «재서» 기대값을 짓는다 */
  const inA = await page.evaluate(() => ({ all: document.querySelectorAll('#secA .sticker-block[data-count]').length,
    labeled: [...document.querySelectorAll('#secA .sticker-block[data-count]')].filter((b) => b.dataset.countLabel).length }));
  expect(inA.all >= 3 && inA.labeled >= 1, `★전제: secA 에 마킹 ${inA.all}개 · 그중 라벨 든 것 ${inA.labeled}개`).toBe(true);
  const beforeVar = await total();
  await page.evaluate(() => window.createVariation(document.getElementById('secA')));
  await expect.poll(total, '★전제: 변형 사본이 생겨 마킹이 secA 몫만큼 늘었다').toBe(beforeVar + inA.all);
  const afterVar = await labeled();
  expect(strip(afterVar), '변형: 라벨을 든 마킹(원본 + 사본)이 전부 같은 모습 · 묶여 있다').toEqual(Array(2 + inA.labeled).fill(want));
  expect(new Set(afterVar.map((x) => x.id)).size, '변형 사본의 id 가 원본과 안 겹친다').toBe(2 + inA.labeled);

  /* ⑶ 섹션 템플릿 넣기 — 저장된 꼴(직렬화본)을 빈 캔버스에 넣는다(coin-sticker K11 과 같은 길) */
  const tplHtml = await page.evaluate(() => window.serializeSectionClone(document.getElementById('secA')));
  expect([/data-count-label="방수포켓"/.test(tplHtml), /data-count-icon="star"/.test(tplHtml), /contenteditable|sticker-corner-handle/.test(tplHtml)],
    '★전제: 템플릿 본문에 라벨·아이콘 키가 실렸고 편집·손잡이 잔재는 없다').toEqual([true, true, false]);
  await setup(page);
  expect(await total(), '★전제: 캔버스에 마킹이 없다').toBe(0);
  await page.evaluate((html) => {
    const real = { loadTemplateCanvas: async () => html };
    window.electronAPI = new Proxy(real, { get: (t, k) => (k in t ? t[k] : () => Promise.resolve(null)) });
  }, tplHtml);
  await page.evaluate(() => window.insertTemplate({ id: 'tpl_marking', name: 'marking', type: 'section', tags: [] }));
  await expect.poll(async () => (await labeled()).length, '★전제: 템플릿을 넣어 라벨 든 마킹이 생겼다').toBe(inA.labeled);
  const tpl = await labeled();
  expect(strip(tpl), '템플릿: 넣은 마킹도 같은 아이콘·라벨 · 묶여 있다').toEqual(Array(inA.labeled).fill(want));
  expect(tpl.every((x) => !two.some((o) => o.id === x.id)), '템플릿으로 넣을 때 블럭 id 를 새로 짓는다').toBe(true);
  expect(errs).toEqual([]);
});

test('M9c 모서리·라벨 굵기 — 패널에서 바꿀 수 있다(모서리 = 한 변의 % · 라벨 굵기는 마커 굵기와 따로)', async ({ page }) => {
  await three(page);
  const rowShown = () => page.evaluate(() => getComputedStyle(document.getElementById('stk-count-radius-row')).display);
  expect(await rowShown(), '★전제: 원 모양일 때 「모서리」 행은 숨어 있다').toBe('none');
  await page.click('#stk-count-shape [data-count-shape="square"]');
  expect(await rowShown(), '사각이면 「모서리」 행이 보인다').toBe('flex');
  const radii = () => page.evaluate(() => [...document.querySelectorAll('#secA .sticker-block[data-count]')].map((b) => [getComputedStyle(b).borderRadius, b.dataset.countRadius ?? null]));
  expect(await radii(), '★전제: 키가 없으면 옛 고정값 8px(옛 저장본과 같은 그림)').toEqual([['8px', null], ['8px', null], ['8px', null]]);
  await typeNumber(page, '#stk-count-radius-num', 30);
  await expect.poll(radii, '모서리 30 → 짧은 변(56)의 30% = 17px(섹션 셋 다 · 스위치 켬)').toEqual([['17px', '30'], ['17px', '30'], ['17px', '30']]);
  /* 비정사각(코너 드래그로 넓어진 것) — % 를 그대로 주면 타원 모서리가 된다. 짧은 변 기준 px 하나여야 한다(3차 · N3) */
  const wide = await page.evaluate(() => { const b = document.querySelector('#secA .sticker-block.selected'); const keep = [b.dataset.sizeW, b.dataset.sizeH];
    b.dataset.sizeW = '120'; b.dataset.sizeH = '56'; window.renderStickerBlock(b);
    const c = getComputedStyle(b); const out = { w: b.offsetWidth, h: b.offsetHeight, tl: c.borderTopLeftRadius, br: c.borderBottomRightRadius };
    b.dataset.sizeW = keep[0]; b.dataset.sizeH = keep[1]; window.renderStickerBlock(b); window._addCornerHandles(b);
    return out; });
  expect([wide.w, wide.h], '★전제: 가로로 넓은 마킹이 그려졌다').toEqual([120, 56]);
  expect([wide.tl, wide.br], '넓은 마킹: 모서리가 가로·세로 같은 반경 하나(짧은 변 56 × 30% = 17px) — 타원이 아니다').toEqual(['17px', '17px']);
  expect(await page.evaluate(() => document.getElementById('stk-count-radius').value), '슬라이더도 같은 값').toBe('30');

  /* 라벨 굵기 — 마커 굵기(700)는 그대로 두고 라벨만 */
  await typeLabel(page, '포켓');
  await commitField(page);
  const weights = () => page.evaluate(() => { const b = document.querySelector('#secA .sticker-block.selected'), lab = b.querySelector(':scope > .sticker-count-label');
    return { label: getComputedStyle(lab).fontWeight, marker: getComputedStyle(b).fontWeight, key: b.dataset.countLabelWeight ?? null, markerKey: b.dataset.fontWeight }; });
  expect(await weights(), '★전제: 굵기 키가 없으면 라벨은 마커 굵기를 따른다').toEqual({ label: '700', marker: '700', key: null, markerKey: '700' });
  await page.selectOption('#stk-count-label-weight', '400');
  expect(await weights(), '라벨 굵기만 바뀐다').toEqual({ label: '400', marker: '700', key: '400', markerKey: '700' });
  await page.selectOption('#stk-fw', '900');
  expect(await weights(), '마커 굵기를 바꿔도 라벨은 제 굵기 그대로').toEqual({ label: '400', marker: '900', key: '400', markerKey: '900' });
  /* 목록에 없는 저장값(손댄 저장본의 200) — 칸이 «있는 그대로» 보인다(3차 · N10 · 예전: 그림은 200 인데 칸은 Light 300) */
  const odd = await page.evaluate(() => { const b = document.querySelector('#secA .sticker-block.selected'); b.dataset.countLabelWeight = '200';
    window.renderStickerBlock(b); window._addCornerHandles(b); window.showStickerProperties(b);
    const sel = document.getElementById('stk-count-label-weight'), lab = b.querySelector(':scope > .sticker-count-label');
    return { drawn: getComputedStyle(lab).fontWeight, field: sel.value, shown: sel.selectedOptions[0]?.textContent.trim(), options: sel.options.length }; });
  expect(odd, '저장값 200: 그림 200 · 칸도 200(선택지 한 줄이 더해진다)').toEqual({ drawn: '200', field: '200', shown: '200', options: 8 });
});

/* ── 3차 — 이벨류에이터 2단계 반영 ─────────────────────────────────────────────────────────────── */

test('M3b 빈 껍데기 svg 는 기본 글리프로 · 커스텀 아이콘이 폰트 크기·글자색을 따라온다 · 블럭끼리 id 가 안 겹친다', async ({ page }) => {
  const errs = await three(page);
  const drawn = () => page.evaluate(() => [...document.querySelectorAll('#secA .sticker-block[data-count]')].map((b) => {
    const svg = b.querySelector(':scope > .sticker-count-icon > svg');
    const shape = svg ? svg.querySelector('path, circle, polyline, rect') : null;
    return { svg: !!svg, kids: svg ? svg.children.length : 0, tag: svg?.firstElementChild?.localName ?? null, points: svg?.querySelector('polyline')?.getAttribute('points') ?? null,
      w: svg ? svg.getAttribute('width') : null, fill: shape ? getComputedStyle(shape).fill : null, color: svg ? getComputedStyle(svg).color : null };
  }));
  const poison = (svg) => page.evaluate((svg) => document.querySelectorAll('#secA .sticker-block[data-count]').forEach((b) => {
    b.dataset.countStyle = 'icon'; b.dataset.countIcon = 'custom'; b.dataset.countIconSvg = svg; window.renderStickerBlock(b);
  }), svg);

  /* ⑴ N11 — 걸러 보니 그릴 것이 없는 svg(손댄 저장본): 빈 마커가 아니라 기본 글리프 */
  for (const shell of ['<svg viewBox="0 0 24 24"></svg>', '<svg viewBox="0 0 24 24"><g><title>빈</title></g></svg>', '<svg>' + '<g x'.repeat(200), '<svg viewBox="0 0 24 24"><script>1</script><use href="#a"/></svg>']) {
    await poison(shell);
    const d = await drawn();
    expect(d.map((x) => [x.svg, x.tag, x.points]), `빈 껍데기 «${shell.slice(0, 40)}»: 셋 다 기본 글리프(꺾쇠)로 그려진다`).toEqual(Array(3).fill([true, 'polyline', CHEVRON]));
  }

  /* ⑵ T2 — 같은 커스텀 svg 에 크기·색만 바꾼다(세척 캐시가 낡은 결과를 주면 여기서 빨개진다) */
  const ICON = '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M4 11h12v2H4z"/></svg>';
  await page.evaluate((svg) => window.CountSticker.setGroup(document.getElementById('secA'), { style: 'icon', icon: 'custom', iconSvg: svg }), ICON);
  await page.evaluate(() => window.showStickerProperties(document.querySelector('#secA .sticker-block.selected')));
  let d = await drawn();
  expect(d.map((x) => [x.tag, x.w, x.fill]), '★전제: 커스텀 아이콘이 폰트 크기 26 · 흰색으로 그려졌다').toEqual(Array(3).fill(['path', '26', WHITE]));
  await typeNumber(page, '#stk-fs-num', 40);
  await expect.poll(async () => pluck(await drawn(), 'w'), '폰트 크기 40 → 같은 svg 가 40 으로 다시 구워진다(셋 다)').toEqual(['40', '40', '40']);
  await typeHex(page, '#stk-txt-hex', '00FF00');
  await expect.poll(async () => pluck(await drawn(), 'fill'), '글자색 → 같은 svg 의 색이 따라온다(셋 다)').toEqual(Array(3).fill('rgb(0, 255, 0)'));
  /* 한 블럭만 다른 크기 — 캐시 한 칸이 앞 블럭의 결과를 뒤 블럭에 주면 안 된다 */
  d = await page.evaluate(() => { const all = [...document.querySelectorAll('#secA .sticker-block[data-count]')];
    all[1].dataset.fontSize = '18'; all.forEach((b) => window.renderStickerBlock(b));
    return all.map((b) => b.querySelector(':scope > .sticker-count-icon > svg').getAttribute('width')); });
  expect(d, '가운데 블럭만 18 — 줄지어 그려도 제 크기').toEqual(['40', '18', '40']);
  /* 다른 svg 로 바꾸면 바로 그 그림 */
  await page.evaluate(() => window.CountSticker.setGroup(document.getElementById('secA'), { icon: 'custom', iconSvg: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="6"/></svg>' }));
  expect(pluck(await drawn(), 'tag'), 'svg 를 바꾸면 새 그림').toEqual(['circle', 'circle', 'circle']);

  /* ⑶ N2 — 같은 그라데이션 아이콘을 든 블럭 셋: 문서에서 id 가 안 겹치고 각자 제 것을 가리킨다 */
  const GRAD = '<svg viewBox="0 0 24 24"><defs><linearGradient id="g"><stop offset="0" stop-color="#f00"/><stop offset="1" stop-color="#00f"/></linearGradient></defs><rect width="24" height="24" fill="url(#g)"/></svg>';
  await page.evaluate((svg) => window.CountSticker.setGroup(document.getElementById('secA'), { icon: 'custom', iconSvg: svg }), GRAD);
  const g = await page.evaluate(() => [...document.querySelectorAll('#secA .sticker-block[data-count]')].map((b) => {
    const grad = b.querySelector('.sticker-count-icon linearGradient'), rect = b.querySelector('.sticker-count-icon rect');
    const ref = (rect?.getAttribute('fill') || '').match(/#([^)'"]+)/)?.[1] ?? null;
    return { id: grad?.id ?? null, ref, own: !!grad && ref === grad.id, hits: grad ? document.querySelectorAll(`[id="${grad.id}"]`).length : 0,
      resolves: !!ref && document.getElementById(ref) === grad, stored: b.dataset.countIconSvg, blockIdIn: !!grad && grad.id.includes(b.id) };
  }));
  expect(g.every((x) => x.id && x.own && x.resolves && x.blockIdIn), `블럭마다: fill 이 «제» 그라데이션을 가리키고 그 id 는 블럭 id 에서 지었다 — ${JSON.stringify(g.map((x) => [x.id, x.ref]))}`).toBe(true);
  expect([new Set(g.map((x) => x.id)).size, g.map((x) => x.hits)], '세 id 가 서로 다르고 문서에 하나씩뿐이다').toEqual([3, [1, 1, 1]]);
  expect(g.every((x) => x.stored.includes('id="g"') && x.stored.includes('url(#g)')), '저장값(dataset)에는 접두사를 안 쓴다 — 그릴 때만 붙인다').toBe(true);
  expect(errs).toEqual([]);
});

test('M6d 인라인 편집 중 — 라벨에 점선 테두리가 실제로 그려진다 · 확정하면 사라진다', async ({ page }) => {
  await three(page);
  await typeLabel(page, '포켓');
  await commitField(page);
  const outline = () => page.evaluate(() => { const lab = document.querySelectorAll('#secA .sticker-block[data-count]')[2].querySelector(':scope > .sticker-count-label');
    const c = getComputedStyle(lab); return { edit: lab.getAttribute('contenteditable'), style: c.outlineStyle, wide: parseFloat(c.outlineWidth) > 0, inline: /outline/.test(lab.getAttribute('style') || '') }; });
  /* 편집 전의 «굵기»는 안 본다 — outline-style 이 none 이어도 이 chromium 은 computed outline-width 를 3px 로 돌려준다(3차 첫 실행에서 쟀다). 그려지는가는 style 이 정한다. */
  const idle = await outline();
  expect([idle.edit, idle.style, idle.inline], '★전제: 편집 전에는 테두리가 없다(style none) · 인라인 style 에 outline 을 안 쓴다').toEqual([null, 'none', false]);
  const r = await waitStableRect(page, '#secA .sticker-block.selected');
  await clickAt(page, r.cx, r.cy, { sel: '.sticker-block[data-count]' }, { label: '마커 더블클릭', dbl: true });
  await expect.poll(() => page.evaluate(() => document.activeElement?.classList.contains('sticker-count-label') || false), '★전제: 라벨 편집이 열렸다').toBe(true);
  expect(await outline(), '편집 중: 점선 테두리가 그려진다(예전: 인라인 outline:none 이 이겨 none 이었다)').toEqual({ edit: 'true', style: 'dashed', wide: true, inline: false });
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await outline()).edit, '★전제: 확정됐다').toBeNull();
  expect((await outline()).style, '확정 뒤: 테두리 없음').toBe('none');
});
