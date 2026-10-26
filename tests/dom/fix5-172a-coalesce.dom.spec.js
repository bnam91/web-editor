/* fix5-172a-coalesce.dom.spec.js — ★172 ㉮(지디 2026-10-27): 섹션 높이 배지를 bindSectionHitzone 래퍼 «안»에서 모아 그린다.
 * 옛 꼴: 래퍼가 섹션마다 «바로» renderOne(offsetHeight 읽기) → rebindAll 의 «히트존 갈아끼움(쓰기) → 읽기»가 섹션 수만큼 번갈아
 *   = 읽기마다 스타일 재계산·레이아웃(앱 실측 · 원 저장본 섹션 82 · 강제 Layout 84 · ⌘Z 의 ≈815ms).
 * 자 = window.measureSectionHeight(공용 자 — section-height.js ruler 가 window 를 거쳐 부른다)를 «언제» 몇 번 부르나
 *      + 배지 data-h 쓰기(MutationObserver 기록을 읽기마다 동기로 털어 순서를 한 줄로).
 * C1 [새 것] rebindAll «동기 구간» 안 읽기 0 · 한 태스크 뒤 섹션마다 정확히 1 번 · 배지·합계 맞음
 * C2 [새 것] 한 번에 그릴 때 «먼저 다 읽고 그다음 쓴다» — 첫 배지 쓰기 앞에 읽기가 섹션 수만큼 · 쓰기 뒤 읽기 0
 * N1 [음성대조] 섹션 높이가 바뀌면(블럭 키우기) 배지·합계가 여전히 따라온다(ResizeObserver 길 무접촉)
 * 기다림은 전부 조건 — 고정 대기 0. */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const T = { timeout: 5000 };
const H = (i) => 100 + i * 10;

async function fixture(page, n) {
  await page.evaluate(({ n, hs }) => {
    let h = '';
    for (let i = 0; i < n; i++) h += `<div class="section-block" id="cS${i}" data-section="${i + 1}" data-name="S${i}"><div class="section-hitzone"><span class="section-label">Section ${i}</span></div><div class="section-inner"><div class="gap-block" data-type="gap" style="height:${hs[i]}px"></div></div></div>`;
    document.getElementById('canvas').innerHTML = h;
  }, { n, hs: Array.from({ length: n }, (_, i) => H(i)) });
  await page.evaluate(() => window.renderSectionHeights());
  await page.waitForFunction((n) => document.querySelectorAll('.section-height-badge').length === n, n, T);
}
/* 공용 자를 감싸 «R» · 그 직전까지 쌓인 배지 data-h 쓰기를 «W» 로 한 줄에 적는다 */
const arm = (page) => page.evaluate(() => {
  const L = window.__c172 = { reads: 0, seq: '' };
  const mo = new MutationObserver(() => {});
  mo.observe(document.getElementById('canvas'), { attributes: true, subtree: true, attributeFilter: ['data-h'] });
  const drain = () => { for (const m of mo.takeRecords()) if (m.target.classList?.contains('section-height-badge')) L.seq += 'W'; };
  const f = window.measureSectionHeight;
  window.measureSectionHeight = function (sec) { drain(); L.reads++; L.seq += 'R'; return f.call(this, sec); };
  L.drain = drain;
});

test('C1 rebindAll 동기 구간 안 공용 자 읽기 0 · 한 태스크 뒤 섹션마다 1 번 · 배지·합계 맞음', async ({ page }) => {
  await bootApp(page);
  const N = 6;
  await fixture(page, N);
  await arm(page);
  const readsInSync = await page.evaluate(() => {
    const L = window.__c172; L.reads = 0; L.seq = '';
    const c = document.getElementById('canvas'); c.innerHTML = c.innerHTML;   // undo/redo 와 같은 꼴(라이브 노드 교체)
    window.rebindAll({ preserveHistory: true });
    return L.reads;
  });
  await page.waitForFunction((n) => window.__c172.reads >= n, N, T);
  await page.waitForFunction((t) => document.getElementById('rp-height-total')?.querySelector('.rp-ht-val')?.textContent === t,
    Array.from({ length: N }, (_, i) => H(i)).reduce((a, b) => a + b, 0) + 'px', T);
  const s = await page.evaluate(() => ({ reads: window.__c172.reads,
    badges: [...document.querySelectorAll('#canvas > .section-block')].map(x => x.querySelector('.section-height-badge')?.dataset.h || null),
    dup: [...document.querySelectorAll('#canvas > .section-block')].map(x => x.querySelectorAll('.section-height-badge').length) }));
  console.log('[C1] ' + JSON.stringify({ readsInSync, ...s }));
  expect(readsInSync, '★rebindAll 동기 구간 안 읽기 0(래퍼가 바로 안 잰다)').toBe(0);
  expect(s.reads, '한 태스크 뒤 섹션마다 정확히 1 번').toBe(N);
  expect(s.badges).toEqual(Array.from({ length: N }, (_, i) => H(i) + 'px'));
  expect(s.dup).toEqual(Array(N).fill(1));
});

test('C2 한 번에 그릴 때 «먼저 다 읽고 그다음 쓴다» — 첫 배지 쓰기 앞에 읽기가 섹션 수만큼 · 쓰기 뒤 읽기 0', async ({ page }) => {
  await bootApp(page);
  const N = 5;
  await fixture(page, N);
  await arm(page);
  const seq = await page.evaluate(() => {
    document.querySelectorAll('#canvas .gap-block').forEach((g, i) => { g.style.height = (200 + i * 10) + 'px'; });   // 모든 배지가 다시 써지게
    const L = window.__c172; L.seq = '';
    window.renderSectionHeights();
    L.drain();
    return L.seq;
  });
  console.log('[C2] ' + seq);
  expect(seq.includes('W'), `전제: 배지 쓰기가 있었다 — ${seq}`).toBe(true);
  expect(seq.indexOf('W'), `★첫 배지 쓰기 앞에 읽기 ${N} 번 — 실제 ${seq}`).toBe(N);
  expect(seq.slice(seq.indexOf('W')).includes('R'), `★쓰기 뒤에 다시 읽지 않는다 — 실제 ${seq}`).toBe(false);
});

test('N1 [음성대조] 섹션 높이가 바뀌면(블럭 키우기) 배지·합계가 따라온다 — ResizeObserver 길 무접촉', async ({ page }) => {
  await bootApp(page);
  await fixture(page, 2);
  await page.evaluate(() => { document.querySelector('#cS0 .gap-block').style.height = '333px'; });
  await page.waitForFunction(() => document.querySelector('#cS0 .section-height-badge')?.dataset.h === '333px', null, T);
  await page.waitForFunction((t) => document.getElementById('rp-height-total')?.querySelector('.rp-ht-val')?.textContent === t, (333 + H(1)) + 'px', T);
});
