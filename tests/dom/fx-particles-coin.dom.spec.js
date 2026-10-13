/* fx-particles-coin — 섹션 파티클의 다섯째 프리셋 「코인」과 크기 상한 250 (현빈 노트 1013t2E3 · 1013t2E4).
 *
 * ★현빈 원문
 *   E3 「섹션에 파티클 이펙트 줄수 있는데 거기에 코인 파티클 기능도 추가해줄 것 (별반짝이, 금색 컨패티, 컬러컨페티, 먼지/보케, 코인레시피)
 *        근데 코인레시피의 경우 버튼의 유형이 달라보이니 디자인 일관성 유지 잘시킬 것」
 *   E4 「파티클 코인 레시피의 크기 조절할때 최대 90밖에 안되는데 250까지 가능하게 해줘 / 색은 금색 은색 추가말고 디폴트로 금색으로 해줘」
 *
 * ★무엇을 잠그나
 *   E3-a ★칩 다섯이 «같은 꼴» — 이름·순서 · 폭·높이 · class · 계산된 글자·테두리·모서리·배경(안 고른 넷끼리) · 두 칸 격자(다섯째가 첫째와 같은 열·같은 폭)
 *   E3-b 「코인」을 누르면 — 저장값 · 코인 «그림»이 갯수만큼(원이 아니다) · 그 칩에 불 · 색 칩은 금 하나 · 무늬번호 그대로
 *   E3-c 저장 → 다시 열기 — 같은 그림이 다시 난다 · 코인 id 가 문서에서 안 겹친다(섹션 둘)
 *   E3-d 움직임 — 속도를 주면 꼬리표가 코인마다 달리고 움직이개가 그 코인들을 실제로 옮긴다
 *   E4-a 크기 칸의 상한이 250 — 250 은 들어가고 그림이 그 크기로 난다 · 넘기면 250 으로
 *   E4-b 색 — 기본은 금 하나(은 없음) · 칩을 바꾸면 코인 색이 따라간다
 * ⛔고정 대기를 쓰지 않는다 — 「무엇이 됐을 때」를 기다린다.
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const VIEW_W = 1440, VIEW_H = 1000;
const SEC_HTML = (id) => `<div class="section-block" id="${id}" data-section="1" style="background:#0A0A0C">`
  + '<div class="section-hitzone"></div><div class="section-inner" style="padding-left:40px;padding-right:40px">'
  + '<div class="gap-block" data-type="gap" style="height:300px"></div></div></div>';

/** 섹션 하나를 만들고 섹션 패널을 연 뒤 파티클을 켠다(앱이 그리는 그 길). 돌려줌: pageerror 모음. */
async function setup(page, ids = ['pS']) {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.setViewportSize({ width: VIEW_W, height: VIEW_H });
  await bootApp(page);
  await page.evaluate((html) => { document.getElementById('canvas').innerHTML = html; window.rebindAll?.(); window.deselectAll?.(); }, ids.map(SEC_HTML).join(''));
  await openPanel(page, ids[0]);
  await page.click('#sec-fxpart-toggle');
  await page.waitForSelector('#sec-fxpart-presets [data-fxpart-preset]');
  return errs;
}
async function openPanel(page, id) {
  await page.evaluate((id) => {
    window.deselectAll?.();
    document.querySelectorAll('.section-block.selected').forEach((s) => s.classList.remove('selected'));
    const s = document.getElementById(id); s.classList.add('selected');
    return window.showSectionProperties(s);
  }, id);
  await page.waitForSelector('#sec-fxpart-toggle');
}
/** 섹션의 파티클 상태 — 저장값 ＋ 그려진 층에서 «직접» 센 것. */
const state = (page, id = 'pS') => page.evaluate((id) => {
  const sec = document.getElementById(id);
  const wrap = sec.querySelector(':scope > .' + window.FX_PARTICLES_WRAP);
  const svg = wrap?.querySelector('svg');
  /* 앞면 타원 = fill 이 앞면 gradient(id 가 …f)인 타원 — 코인마다 하나(테 안쪽 바닥 타원은 …d 라 안 걸린다) */
  const faces = svg ? [...svg.querySelectorAll('ellipse[fill$="f)"]')] : [];
  const ids = svg ? [...svg.querySelectorAll('[id]')].map((e) => e.id) : [];
  return {
    cfg: window.readParticles(sec.dataset),
    coins: faces.length,
    faceRx: faces.map((e) => +e.getAttribute('rx')),
    circles: svg ? svg.querySelectorAll('circle').length : -1,
    stops: svg ? [...new Set([...svg.querySelectorAll('linearGradient[id$="f"] stop')].map((s) => s.getAttribute('stop-color').toLowerCase()))] : [],
    ids, tags: svg ? svg.querySelectorAll('[data-fxp]').length : -1,
    layer: wrap ? wrap.innerHTML : '',
  };
}, id);

test('E3-a ★프리셋 칩 다섯이 같은 꼴이다 — 「코인」이 다른 넷과 폭·높이·class·글자·테두리가 같고 같은 격자에 선다', async ({ page }) => {
  const errs = await setup(page);
  const r = await page.evaluate(() => {
    const group = document.getElementById('sec-fxpart-presets');
    const btns = [...group.querySelectorAll('[data-fxpart-preset]')];
    const cs = (e) => { const s = getComputedStyle(e); return [s.fontSize, s.fontWeight, s.fontFamily, s.borderTopWidth, s.borderTopStyle, s.borderRadius, s.paddingLeft, s.paddingRight, s.display, s.justifyContent, s.cursor].join(' | '); };
    const paint = (e) => { const s = getComputedStyle(e); return [s.backgroundColor, s.borderTopColor, s.color].join(' | '); };
    const g = getComputedStyle(group);
    return {
      kinds: [...window.ParticlesFx.KINDS],
      names: btns.map((b) => b.textContent.trim()),
      keys: btns.map((b) => b.dataset.fxpartPreset),
      cls: btns.map((b) => b.className.replace(/\s*\bactive\b/, '').trim()),
      inline: btns.map((b) => b.getAttribute('style') || ''),
      tag: btns.map((b) => b.tagName),
      box: btns.map((b) => { const q = b.getBoundingClientRect(); return { w: Math.round(q.width * 10) / 10, h: Math.round(q.height * 10) / 10, l: Math.round(q.left * 10) / 10, t: Math.round(q.top * 10) / 10 }; }),
      style: btns.map(cs),
      paintIdle: btns.filter((b) => !b.classList.contains('active')).map(paint),
      active: btns.map((b) => b.classList.contains('active')),
      fit: btns.map((b) => b.scrollWidth <= b.clientWidth + 1),
      gap: [g.columnGap, g.rowGap], groupDisplay: g.display,
      siblingOther: [...group.parentElement.querySelectorAll('#sec-fxpart-recipe, [data-fxpart-recipe]')].length,
    };
  });
  /* 이름·순서 — 현빈 노트의 그 다섯 */
  expect(r.keys).toEqual(['star', 'gold', 'party', 'dust', 'coin']);
  expect(r.keys).toEqual(r.kinds);
  expect(r.names).toEqual(['별 반짝이', '금색 컨페티', '컬러 컨페티', '먼지 / 보케', '코인']);
  /* 코인만 다른 단추 꼴(따로 떨어진 「레시피」 단추)이 아니다 — 같은 무리 안의 같은 칩이다 */
  expect(r.siblingOther, '프리셋 무리 밖에 따로 선 코인 단추가 있다').toBe(0);
  expect([...new Set(r.tag)], '다섯이 같은 요소다').toEqual(['BUTTON']);
  expect([...new Set(r.cls)], '다섯이 같은 class 다').toEqual(['prop-align-btn']);
  expect([...new Set(r.inline)], '칩마다 다른 인라인 꼴이 없다').toEqual(['']);
  /* 크기 — 다섯이 같은 폭·같은 높이 */
  expect([...new Set(r.box.map((b) => b.w))].length, `칩 폭이 갈린다: ${r.box.map((b) => b.w).join(' · ')}`).toBe(1);
  expect([...new Set(r.box.map((b) => b.h))].length, `칩 높이가 갈린다: ${r.box.map((b) => b.h).join(' · ')}`).toBe(1);
  expect(r.box[0].w > 60 && r.box[0].h >= 20, `★전제: 칩이 보이는 크기다(${r.box[0].w}×${r.box[0].h})`).toBe(true);
  /* 자리 — 두 칸 격자: 2 · 2 · 1, 다섯째는 첫째 아래(같은 열), 줄 간격이 같다 */
  expect([r.box[0].t === r.box[1].t, r.box[2].t === r.box[3].t, r.box[2].t > r.box[0].t, r.box[4].t > r.box[2].t]).toEqual([true, true, true, true]);
  expect([r.box[4].l, r.box[2].l], '다섯째 칩이 첫째 열에 선다').toEqual([r.box[0].l, r.box[0].l]);
  expect(Math.round((r.box[4].t - r.box[2].t) * 10), '줄 간격이 같다').toBe(Math.round((r.box[2].t - r.box[0].t) * 10));
  expect([r.groupDisplay, r.gap[0], r.gap[1]], '간격은 이웃 무리(.prop-align-group)의 것 그대로').toEqual(['grid', '4px', '4px']);
  /* 계산된 꼴 — 글자·테두리·모서리가 다섯 다 같고, 안 고른 넷은 칠도 같다 */
  expect([...new Set(r.style)].length, `칩의 계산된 꼴이 갈린다:\n${r.style.join('\n')}`).toBe(1);
  expect([r.paintIdle.length, [...new Set(r.paintIdle)].length], '안 고른 넷의 칠이 같다').toEqual([4, 1]);
  expect(r.active, '켜면 첫 프리셋에 불').toEqual([true, false, false, false, false]);
  expect(r.fit, '글자가 칩 안에 들어간다').toEqual([true, true, true, true, true]);

  /* 고른 뒤 — 「코인」의 켜진 칠이 다른 칩이 켜졌을 때의 칠과 같다 */
  const paintOf = (k) => page.evaluate((k) => { const s = getComputedStyle(document.querySelector(`#sec-fxpart-presets [data-fxpart-preset="${k}"]`)); return [s.backgroundColor, s.borderTopColor, s.color].join(' | '); }, k);
  await page.hover('#sec-fxpart-seed');                       // 마우스를 칩 밖으로(호버 칠이 섞이지 않게)
  const starOn = await paintOf('star');
  await page.click('#sec-fxpart-presets [data-fxpart-preset="coin"]');
  await expect.poll(() => page.evaluate(() => document.querySelector('#sec-fxpart-presets .active')?.dataset.fxpartPreset)).toBe('coin');
  await page.hover('#sec-fxpart-seed');
  await expect.poll(() => paintOf('coin'), '「코인」이 켜졌을 때의 칠이 다른 칩과 같다').toBe(starOn);
  expect(errs).toEqual([]);
});

test('E3-b 「코인」을 누르면 코인 그림이 갯수만큼 난다 · 금 하나 · 무늬번호 그대로', async ({ page }) => {
  const errs = await setup(page);
  const before = await state(page);
  expect([before.cfg.preset, before.coins], '★전제: 첫 프리셋이고 코인이 없다').toEqual(['star', 0]);

  await page.click('#sec-fxpart-presets [data-fxpart-preset="coin"]');
  await expect.poll(async () => (await state(page)).cfg.preset).toBe('coin');

  const s = await state(page);
  expect([s.cfg.count, s.cfg.shapes, s.cfg.colors, s.cfg.seed], '저장값 — 14 닢 · 모양 coin · 금 하나 · 무늬번호 그대로').toEqual([14, ['coin'], ['#f5c542'], before.cfg.seed]);
  expect([s.coins, s.circles], '코인 «그림»이 14 닢이고 원으로 떨어지지 않았다').toEqual([14, 0]);
  expect(s.stops, '금의 앞면 세 색으로 칠해졌다').toEqual(['#ffe9a8', '#f5c542', '#e8b22a']);
  expect([s.ids.length, new Set(s.ids).size, s.ids.every((x) => x.startsWith('pfx-pS-c'))], 'id — 코인마다 여덟 · 안 겹침 · 섹션 필터 id 아래').toEqual([112, 112, true]);
  expect(s.tags, '멈춘 판 — 꼬리표 없음').toBe(0);
  /* 패널 — 색 칩 하나 · 모양 칩에 「코인」이 있고 그것만 켜졌다 · 갯수 칸 14 */
  const panel = await page.evaluate(() => ({
    chips: document.querySelectorAll('#sec-fxpart-colors [data-fxpart-color]').length,
    dot: getComputedStyle(document.querySelector('#sec-fxpart-colors .fxpart-chip-dot')).backgroundColor,
    del: document.querySelectorAll('#sec-fxpart-colors [data-fxpart-color-del]').length,
    shapes: [...document.querySelectorAll('#sec-fxpart-shapes [data-fxpart-shape]')].map((b) => b.textContent.trim() + (b.classList.contains('active') ? '*' : '')),
    count: document.querySelector('[data-fxpart-axis="count"]').value,
    size: [document.querySelector('[data-fxpart-axis="smin"]').value, document.querySelector('[data-fxpart-axis="smax"]').value],
  }));
  expect(panel).toEqual({ chips: 1, dot: 'rgb(245, 197, 66)', del: 0, shapes: ['사각', '리본', '원', '별', '삼각', '코인*'], count: '14', size: ['28', '90'] });
  /* 다른 프리셋으로 돌아가면 코인이 사라진다(프리셋은 통째로 깐다) */
  await page.click('#sec-fxpart-presets [data-fxpart-preset="gold"]');
  await expect.poll(async () => (await state(page)).coins).toBe(0);
  expect(errs).toEqual([]);
});

test('E3-c 저장 → 다시 열기 — 같은 그림이 다시 난다 · 섹션 둘의 코인 id 가 안 겹친다', async ({ page }) => {
  const errs = await setup(page, ['pS', 'pT']);
  await page.click('#sec-fxpart-presets [data-fxpart-preset="coin"]');
  await expect.poll(async () => (await state(page)).coins).toBe(14);
  await openPanel(page, 'pT');
  await page.click('#sec-fxpart-toggle');
  await page.waitForSelector('#sec-fxpart-presets [data-fxpart-preset="coin"]');
  await page.click('#sec-fxpart-presets [data-fxpart-preset="coin"]');
  await expect.poll(async () => (await state(page, 'pT')).coins).toBe(14);
  const a = await state(page, 'pS'), b = await state(page, 'pT');
  expect(a.ids.filter((x) => b.ids.includes(x)), '두 섹션의 코인 id 가 겹친다').toEqual([]);
  expect(await page.evaluate(() => { const all = [...document.querySelectorAll('#canvas [id]')].map((e) => e.id); return all.filter((x, i) => all.indexOf(x) !== i); }), '문서에 겹친 id 가 있다').toEqual([]);

  const snap = await page.evaluate(() => window.serializeProject());
  await bootApp(page);                                                   // 새 페이지 로드 = 앱 재기동
  await page.evaluate((d) => window.applyProjectData(JSON.parse(d)), snap);
  await expect.poll(async () => (await state(page, 'pS')).coins, '다시 열었는데 코인이 안 그려졌다').toBe(14);
  const a2 = await state(page, 'pS'), b2 = await state(page, 'pT');
  expect([a2.cfg, b2.cfg], '저장값이 그대로다').toEqual([a.cfg, b.cfg]);
  expect([a2.layer === a.layer, b2.layer === b.layer, a2.layer.length > 5000, a.layer !== b.layer], '다시 연 파티클 층이 저장 전과 글자까지 같다(멈춘 판이라 시각이 안 들어간다)').toEqual([true, true, true, true]);
  expect(errs).toEqual([]);
});

test('E3-d 움직임 — 속도를 주면 꼬리표가 코인마다 달리고 움직이개가 코인을 옮긴다', async ({ page }) => {
  await setup(page);
  await page.click('#sec-fxpart-presets [data-fxpart-preset="coin"]');
  await expect.poll(async () => (await state(page)).coins).toBe(14);
  await page.fill('[data-fxpart-axis="speed"]', '60');
  await page.dispatchEvent('[data-fxpart-axis="speed"]', 'input');
  await expect.poll(async () => (await state(page)).tags, '속도를 줬는데 꼬리표가 안 달렸다').toBe(14);
  const r = await page.evaluate(() => {
    const sec = document.getElementById('pS');
    window.ParticlesAnim.setPaused?.(sec, true);                          // 제 rAF 가 끼어들지 않게 멈춰 두고 손으로 한 걸음씩
    const tagged = [...sec.querySelectorAll('.sec-fxpart-wrap [data-fxp]')];
    const kinds = [...new Set(tagged.map((e) => e.tagName.toLowerCase() + '>' + e.firstElementChild?.tagName.toLowerCase()))];
    const y = () => tagged.map((e) => Math.round(e.getBoundingClientRect().top * 10));
    window.ParticlesAnim.setPaused?.(sec, false);
    const moved0 = window.ParticlesAnim.step(0, sec); const y0 = y();
    const moved1 = window.ParticlesAnim.step(700, sec); const y1 = y();
    window.ParticlesAnim.setPaused?.(sec, true);
    return { kinds, moved0, moved1, changed: y0.filter((v, i) => v !== y1[i]).length, tf: tagged[0].getAttribute('transform') };
  });
  expect(r.kinds, '꼬리표는 코인을 감싼 <g> 에 달린다').toEqual(['g>g']);
  expect([r.moved0, r.moved1], '움직이개가 코인 14 닢을 센다').toEqual([14, 14]);
  expect(r.changed, `0.7초 사이에 자리가 바뀐 코인 수(변환 예: ${r.tf})`).toBe(14);
});

test('E4-a ★크기 상한 250 — 칸의 max · 250 이 들어가고 그 크기로 그려진다 · 넘기면 250', async ({ page }) => {
  const errs = await setup(page);
  await page.click('#sec-fxpart-presets [data-fxpart-preset="coin"]');
  await expect.poll(async () => (await state(page)).coins).toBe(14);
  const lim = await page.evaluate(() => ['smin', 'smax'].map((k) => { const e = document.querySelector(`[data-fxpart-axis="${k}"]`); return [e.min, e.max]; }));
  expect(lim, '크기 칸의 범위 — 1~250').toEqual([['1', '250'], ['1', '250']]);
  const set = async (k, v) => { await page.fill(`[data-fxpart-axis="${k}"]`, String(v)); await page.dispatchEvent(`[data-fxpart-axis="${k}"]`, 'input'); await page.dispatchEvent(`[data-fxpart-axis="${k}"]`, 'change'); };
  /* 회전을 끈다 — 돌아간 코인은 화면 사각형이 지름보다 넓게 재진다 */
  await page.uncheck('#sec-fxpart-rot');
  await expect.poll(async () => (await state(page)).cfg.rot).toBe(false);
  await set('smax', 250);
  await expect.poll(async () => (await state(page)).cfg.smax, '250 을 넣었는데 저장값이 250 이 아니다').toBe(250);
  await set('smin', 250);
  await expect.poll(async () => (await state(page)).cfg.smin).toBe(250);
  const big = await state(page);
  expect([...new Set(big.faceRx)], '코인 지름 250 → 앞면 가로 반지름 125').toEqual([125]);
  /* 화면에서도 그 크기다 — 섹션 폭(레이아웃 px) 대비 코인 한 닢의 폭 */
  const px = await page.evaluate(() => {
    const sec = document.getElementById('pS'); const z = sec.getBoundingClientRect().width / sec.clientWidth;
    return Math.round(sec.querySelector('.sec-fxpart-wrap ellipse[fill$="f)"]').getBoundingClientRect().width / z);
  });
  expect(Math.abs(px - 250), `화면에 그려진 코인 폭 ${px}px(레이아웃) — 250 이어야 한다`).toBeLessThanOrEqual(2);
  await set('smax', 400);
  await expect.poll(() => page.inputValue('[data-fxpart-axis="smax"]'), '상한을 넘긴 값이 칸에서 250 으로 안 돌아왔다').toBe('250');
  expect((await state(page)).cfg.smax).toBe(250);
  /* 옛 상한(90)을 넘는 값이 다른 프리셋에서도 같은 표를 읽는다 */
  await set('smin', 91);
  await expect.poll(async () => (await state(page)).cfg.smin).toBe(91);
  expect(errs).toEqual([]);
});

test('E4-b 색 — 기본은 금 하나(은 없음) · 칩을 바꾸면 코인 색이 따라간다', async ({ page }) => {
  await setup(page);
  await page.click('#sec-fxpart-presets [data-fxpart-preset="coin"]');
  await expect.poll(async () => (await state(page)).coins).toBe(14);
  const gold = await page.evaluate(() => [window.CoinFx.baseColors('gold').face, window.CoinFx.baseColors('silver').face]);
  const s = await state(page);
  expect([s.cfg.colors, s.cfg.colors.includes(gold[1])], '기본 색 = 금 하나').toEqual([[gold[0]], false]);
  expect(s.stops.includes(gold[1]), '은색 코인이 섞여 있다').toBe(false);
  /* 색 칩을 파랑으로 — 코인이 그 색으로 다시 칠해진다 */
  await page.evaluate(() => { const ci = document.querySelector('[data-fxpart-color-in="0"]'); ci.value = '#2d6fe8'; ci.dispatchEvent(new Event('input', { bubbles: true })); ci.dispatchEvent(new Event('change', { bubbles: true })); });
  await expect.poll(async () => (await state(page)).cfg.colors).toEqual(['#2d6fe8']);
  const blue = await state(page);
  expect([blue.coins, blue.stops.includes('#2d6fe8'), blue.stops.includes('#f5c542')], '칩 색의 코인 14 닢 · 금은 사라졌다').toEqual([14, true, false]);
});
