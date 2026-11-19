/* vector-svg-to-path — VECTOR-SVG-TO-PATH-P5-01 (시트 0.9.13 132행 · 현빈 순서 ③ SVG 파일을 패스로)
 *   들여온 SVG(붙여넣기·.svg 끌어 놓기·에셋 «+ 벡터로» = 한 문 addVectorFromSvgText)가 «펜 패스로 똑같이 다시 그려지는» 꼴이면
 *   처음부터 펜 벡터(penNodes · 점 편집 됨)로 넣는다 · 변환 단추 없음(현빈 11/19).
 *   허용 = path 하나 · 하위 경로 하나 · M L H V C S Q T Z · 단색 · transform·style·opacity·dasharray·evenodd 없음 · 앵커 500 이하.
 *   그 밖은 지금처럼 그림 벡터(조용히 망가뜨리지 않는다).
 * 칸 (판정 = 그린 path 의 getBBox 를 원본 svg 를 따로 그린 getBBox 와 견줌 · 칠은 getComputedStyle)
 *   T1 채운 닫힌 패스(viewBox 원점 10,10) → 펜(닫힘 · 노드 넷 · viewBox 0 0 20 20) · 같은 상자 · 빨강 칠 · 선 없음 · 더블클릭·패널 «패스 편집» 둘 다 앵커 편집
 *   T2 열린 곡선 선(C · 파랑 · 두께 3 · 둥근 끝) → 펜(열림) · 같은 상자 · 파랑 선 3px 둥근 끝 · 이음 miter(원본 기본값) · 채움 없음
 *   T3 [음성] 하위 경로 둘 · evenodd · transform · 두 색 · 호(A) · <g> 감싸기 · currentColor · dasharray → 펜 아님(그림 벡터 · d 그대로)
 *   T4 붙여넣기 길 → 펜 · ⌘Z 한 번 = 넣기 전 · 다시 붙여 저장→다시 열기 = penNodes 그대로
 * 양성대조: _patches/vector-p5-CTL-no-convert.patch(svgToPenData 가 늘 null) → T1·T2·T4 빨강 · T3 초록.
 * ⛔고정 대기 0(expect.poll · 조건 대기).
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');

const NS = 'xmlns="http://www.w3.org/2000/svg"';
const FILLED = `<svg ${NS} viewBox="10 10 20 20" width="40" height="40"><path d="M10 10H30V30H10Z" fill="#ff0000"/></svg>`;
const CURVE = `<svg ${NS} viewBox="0 0 40 20" width="80" height="40"><path d="M2 10C2 0 38 0 38 10" fill="none" stroke="#0000ff" stroke-width="3" stroke-linecap="round"/></svg>`;
const NEG = {
  subpaths: `<svg ${NS} viewBox="0 0 20 10"><path d="M0 0h5v5zM6 0h5v5z"/></svg>`,
  evenodd: `<svg ${NS} viewBox="0 0 20 10"><path d="M0 0h10v10H0z" fill-rule="evenodd"/></svg>`,
  transform: `<svg ${NS} viewBox="0 0 20 10"><path d="M0 0h10v10H0z" transform="translate(2 0)"/></svg>`,
  twoColor: `<svg ${NS} viewBox="0 0 20 10"><path d="M0 0h10v10H0z" fill="#ff0000" stroke="#0000ff"/></svg>`,
  arc: `<svg ${NS} viewBox="0 0 20 10"><path d="M0 5A5 5 0 0 1 10 5"/></svg>`,
  group: `<svg ${NS} viewBox="0 0 20 10"><g><path d="M0 0h10v10H0z"/></g></svg>`,
  currentColor: `<svg ${NS} viewBox="0 0 20 10"><path d="M0 0h10v10H0z" fill="currentColor"/></svg>`,
  dash: `<svg ${NS} viewBox="0 0 20 10"><path d="M0 5H20" fill="none" stroke="#000" stroke-dasharray="2 2"/></svg>`,
};

async function scene(page) {
  await page.setViewportSize({ width: 1600, height: 1000 });
  const errs = await bootApp(page);
  await page.evaluate(async () => {
    document.querySelectorAll('#canvas .section-block').forEach((s) => s.remove());
    await window.addSection();
    document.activeElement?.blur?.();
  });
  return errs;
}
const add = (page, svg) => page.evaluate((svg) => { const b = window.addVectorFromSvgText(svg, 'T'); b.id = 'vbT'; return b.id; }, svg);
const pen = (page) => page.evaluate(() => { const b = document.getElementById('vbT'); return { nodes: b.dataset.penNodes ? JSON.parse(b.dataset.penNodes).length : 0, closed: b.dataset.penClosed || null, vb: (/viewBox="([^"]+)"/.exec(b.dataset.svg) || [])[1] || null }; });
/** 그린 펜 path 의 getBBox 와 원본 svg 를 따로 그린 path 의 getBBox(원점 뺌) — 같으면 «같은 그림» */
const sameBox = (page, src) => page.evaluate((src) => {
  const r4 = (b) => [b.x, b.y, b.width, b.height].map((v) => Math.round(v * 100) / 100);
  const host = document.createElement('div'); host.style.cssText = 'position:fixed;left:-9999px;top:0'; host.innerHTML = src; document.body.appendChild(host);
  const s = host.querySelector('svg'), vb = (s.getAttribute('viewBox') || '0 0').split(/[\s,]+/).map(Number);
  const o = s.querySelector('path').getBBox(); host.remove();
  const want = r4({ x: o.x - vb[0], y: o.y - vb[1], width: o.width, height: o.height });
  const got = r4(document.querySelector('#vbT .vb-inner svg path').getBBox());
  return { want, got };
}, src);

test('T1 채운 닫힌 패스(원점 10,10) → 펜 · 같은 상자 · 빨강 칠 · 더블클릭·패스 편집', async ({ page }) => {
  const errs = await scene(page);
  await add(page, FILLED);
  expect(await pen(page), '★펜 벡터(닫힘 · 노드 넷 · viewBox = 원본 폭·높이)').toEqual({ nodes: 4, closed: '1', vb: '0 0 20 20' });
  const { want, got } = await sameBox(page, FILLED);
  expect(got, '★같은 그림(상자)').toEqual(want);
  expect(await page.evaluate(() => { const cs = getComputedStyle(document.querySelector('#vbT .vb-inner svg path')); return [cs.fill, cs.stroke]; }), '★빨강 칠 · 선 없음').toEqual(['rgb(255, 0, 0)', 'none']);
  await page.evaluate(() => document.getElementById('vbT').scrollIntoView({ block: 'center', inline: 'center' }));
  const r = await waitStableRect(page, '#vbT');
  await page.mouse.click(r.cx, r.cy);
  await expect(page.locator('#vb-pen-edit'), '★패널에 «패스 편집»').toBeVisible();
  /* 편집 진입 두 길 — 더블클릭(t13A-03 · block-drag.js 벡터 dblclick = penNodes 있으면 enterPenEditMode) · 패널 «패스 편집» */
  const editing = () => page.evaluate(() => document.body.classList.contains('vpen-edit-mode') && document.getElementById('vbT').classList.contains('pen-editing'));
  await page.mouse.dblclick(r.cx, r.cy);
  await expect.poll(editing, '★더블클릭 → 앵커 편집(변환된 벡터)').toBe(true);
  await page.keyboard.press('Escape');
  await expect.poll(editing, '[전제] Esc 로 편집 끝').toBe(false);
  await page.locator('#vb-pen-edit').click();
  await expect.poll(editing, '★패널 «패스 편집» → 앵커 편집').toBe(true);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('T2 열린 곡선 선 → 펜(열림) · 같은 상자 · 파랑 3px 둥근 끝 · 이음 miter · 채움 없음', async ({ page }) => {
  const errs = await scene(page);
  await add(page, CURVE);
  expect(await pen(page), '★펜 벡터(열림 · 노드 둘)').toEqual({ nodes: 2, closed: '0', vb: '0 0 40 20' });
  const { want, got } = await sameBox(page, CURVE);
  expect(got, '★같은 그림(상자)').toEqual(want);
  expect(await page.evaluate(() => { const cs = getComputedStyle(document.querySelector('#vbT .vb-inner svg path')); return [cs.fill, cs.stroke, cs.strokeWidth, cs.strokeLinecap, cs.strokeLinejoin]; }))
    .toEqual(['none', 'rgb(0, 0, 255)', '3px', 'round', 'miter']);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('T3 [음성] 못 받는 꼴 여덟 → 그림 벡터 그대로', async ({ page }) => {
  const errs = await scene(page);
  const out = {};
  for (const [k, svg] of Object.entries(NEG)) {
    await page.evaluate(() => document.getElementById('vbT')?.removeAttribute('id'));
    await add(page, svg);
    out[k] = await page.evaluate(() => { const b = document.getElementById('vbT'); return { pen: !!b.dataset.penNodes, path: /<path/.test(b.dataset.svg) }; });
  }
  expect(out).toEqual(Object.fromEntries(Object.keys(NEG).map((k) => [k, { pen: false, path: true }])));
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('T4 붙여넣기 길 → 펜 · ⌘Z 한 번 = 넣기 전 · 저장→다시 열기 = penNodes 그대로', async ({ page }) => {
  const errs = await scene(page);
  const paste = () => page.evaluate((t) => { const dt = new DataTransfer(); dt.setData('text/plain', t); const ev = new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }); document.dispatchEvent(ev); return ev.defaultPrevented; }, CURVE);
  const vecs = () => page.evaluate(() => [...document.querySelectorAll('#canvas .vector-block')].map((b) => b.dataset.penNodes || null));
  expect(await paste(), '[전제] 붙여넣기를 받았다').toBe(true);
  await expect.poll(async () => (await vecs()).length, '[전제] 벡터 하나').toBe(1);
  expect((await vecs())[0], '★붙여넣기 길도 펜').toBeTruthy();
  await page.keyboard.press('Meta+z');
  await expect.poll(async () => (await vecs()).length, '★⌘Z 한 번 = 넣기 전').toBe(0);
  /* 지혜맥 261120 vp2 :109 3/3 — ⌘Z 가 캔버스를 되살리며 섹션 고름이 풀린다 → 넣기 문(addVectorBlock)의 «섹션 안 고름 = 안 넣음»(vector-block.js:300 · 모든 넣기 입구 같은 게이트)이 둘째 붙여넣기를 막았다 = 시험 장면 탓.
     둘째 붙여넣기 전에 섹션을 다시 고른다(사람도 같다 — 고른 섹션이 없으면 «섹션을 선택하세요» 안내). */
  await page.evaluate(() => { window.selectSection(document.querySelector('#canvas .section-block')); document.activeElement?.blur?.(); });
  expect(await paste(), '[전제] 둘째 붙여넣기를 받았다').toBe(true);
  await expect.poll(async () => (await vecs()).length).toBe(1);
  const before = (await vecs())[0];
  const canvas = await page.evaluate(() => window.getSerializedCanvas());
  await page.evaluate((c) => window.applyProjectData({ canvas: c }), canvas);
  await expect.poll(async () => (await vecs())[0] ?? null, '★저장→다시 열기 = penNodes 그대로').toBe(before);
  expect(errs, errs.join(' | ')).toEqual([]);
});
