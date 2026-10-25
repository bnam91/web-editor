/* section-mesh-stops-1013t2e2 — 섹션 메시 그라데이션 «모서리별 스톱 추가» (1013t2E2ⓑ2 · t7-02 👉 뒤).
 *
 * 현빈 원문(👉 뒤): 「그라데이션 종류가 radial, liner가 있지만, 각 모서리 별로 스톱을 추가할 수 있도록 해줄래?
 *   멀티 그라데이션처럼 말야. 피그마에 있는기능인데 뭔지 알겠지?」
 * 바닥 f62653ce 실측(S7-T8): 메시 UI = 모서리 색 칸 넷 고정 · 스톱 더하기 단추 0.
 * 선례(⛔새 꼴 발명 금지): 컬러피커 그라데이션 탭 — 막대·손잡이 끌기·막대 더블클릭 추가(이웃 보간)·× 삭제(최소 2)·
 *   저장 = CSS 정지점 글자. 모서리 하나 = 그 겹의 정지점 목록 · 네 칸을 «|» 로(dataset.bgMesh 키 그대로).
 *
 * S1 ★옛 저장본(색 넷 `#hex|…`) — 그리는 CSS 가 옛 공식과 한 글자도 같고, 패널을 열고 닫아도 저장 글자가 안 바뀐다 · 모서리마다 손잡이 둘
 * S2 막대 빈 데를 더블클릭하면 그 모서리에만 스톱 하나(이웃 보간 색) — 다른 세 모서리 칸은 옛 꼴 그대로 · 그 겹이 셋으로 그려진다
 * S3 손잡이를 끌면 위치가 바뀌고 ⌘Z 한 번 = 끌기 전
 * S4 × 로 더한 스톱을 지우면 그 모서리 칸이 «옛 꼴 `#hex` 바이트»로 돌아간다 · 둘일 땐 × 가 잠긴다
 * S5 고른 스톱의 색 칸을 고치면 그 스톱만 바뀌고 투명도는 그 스톱 것 그대로
 * S6 직렬화 왕복(저장 → 다시 열기 흉내) 뒤에도 스톱이 그대로 그려진다
 * S7 ★(음성·보안) 꼴 밖 칸(url · 표현식 · 범위 밖 %)이 하나라도 있으면 메시 아님 — 한 겹도 안 그린다
 * 하네스 = _root-harness bootApp(앱 통째 헤드리스 · ⛔Electron 아님). ⛔waitForTimeout 금지.
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');

const raf2 = (page) => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
const MESH = '#ff0080|#7928ca|#00d4ff|#ffdd00';
const AT = ['0% 0%', '100% 0%', '100% 100%', '0% 100%'];
const fade = (h) => `rgba(${parseInt(h.slice(1, 3), 16)}, ${parseInt(h.slice(3, 5), 16)}, ${parseInt(h.slice(5, 7), 16)}, 0)`;
/* 바닥 ca702d40 의 sectionMeshCss 공식 그대로(옛 꼴의 참값) */
const OLD_IMAGE = MESH.split('|').map((c, i) => `radial-gradient(ellipse farthest-side at ${AT[i]}, ${c} 0%, ${fade(c)} 72%)`).join(', ');

async function setup(page) {
  await page.setViewportSize({ width: 1600, height: 1100 });
  const errs = await bootApp(page);
  const ids = await page.evaluate(async () => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach(s => s.remove());
    await window.addSection();
    return [...c.querySelectorAll('.section-block')].map((s) => s.id);
  });
  await raf2(page);
  return { errs, A: ids[0] };
}
async function pickSection(page, id) {
  await page.evaluate((i) => document.getElementById(i).scrollIntoView({ block: 'center' }), id);
  const b = await waitStableRect(page, '#' + id);
  await page.mouse.click(b.left + 8, b.cy);
  await page.waitForFunction((i) => document.getElementById(i)?.classList.contains('selected') && document.getElementById('sec-height-value')?.dataset.secId === i, id, { timeout: 8000 });
  await raf2(page);
}
/* 저장본에 메시가 든 섹션 = 옛 저장본을 «다시 연» 꼴(dataset → 복원 길 applySectionBg) */
async function seedMesh(page, id, spec) {
  await page.evaluate(([i, s]) => { const e = document.getElementById(i); e.dataset.bgMesh = s; window.applySectionBg(e); }, [id, spec]);
}
const meshOf = (page, id) => page.evaluate((i) => document.getElementById(i).dataset.bgMesh ?? null, id);
const imgOf = (page, id) => page.evaluate((i) => document.getElementById(i).style.backgroundImage, id);
/* 인라인 style 은 CSSOM 이 고쳐 쓴다(#hex → rgb() · 기본 «ellipse» 생략) ⇒ 견줄 글자도 같은 CSSOM 에 한 번 태운다 */
const norm = (page, css) => page.evaluate((c) => { const d = document.createElement('div'); d.style.backgroundImage = c; return d.style.backgroundImage; }, css);
const fnImage = (page, spec) => page.evaluate((s) => window.sectionMeshCss(s)?.image ?? null, spec);
const thumbs = (page) => page.evaluate(() => ['tl', 'tr', 'br', 'bl'].map((k) => document.querySelectorAll(`#sec-mesh-${k}-bar .goya-cp-grad-thumb`).length));
async function barPoint(page, k, frac) {
  return page.evaluate(([k, f]) => { const r = document.getElementById(`sec-mesh-${k}-bar`).getBoundingClientRect(); return { x: r.left + r.width * f, y: r.top + r.height / 2 }; }, [k, frac]);
}
async function thumbPoint(page, k, j) {
  return page.evaluate(([k, j]) => { const t = document.querySelectorAll(`#sec-mesh-${k}-bar .goya-cp-grad-thumb`)[j].getBoundingClientRect(); const x = t.left + t.width / 2, y = t.top + t.height / 2; return { x, y, top: document.elementFromPoint(x, y)?.classList.contains('goya-cp-grad-thumb') }; }, [k, j]);
}

test('S1 ★옛 저장본 — 그리는 CSS = 옛 공식 한 글자도 같음 · 열고 닫아도 저장 글자 불변 · 모서리마다 손잡이 둘', async ({ page }) => {
  const { errs, A } = await setup(page);
  await seedMesh(page, A, MESH);
  expect(await fnImage(page, MESH), '옛 꼴 CSS 글자 = 바닥 공식(한 글자도)').toBe(OLD_IMAGE);
  expect(await imgOf(page, A), '그려진 것 = 바닥 공식').toBe(await norm(page, OLD_IMAGE));
  await pickSection(page, A);
  await expect.poll(() => thumbs(page)).toEqual([2, 2, 2, 2]);
  expect(await page.evaluate(() => ['tl', 'tr', 'br', 'bl'].map((k) => document.getElementById(`sec-mesh-${k}-del`).disabled)), '두 스톱이면 × 잠김').toEqual([true, true, true, true]);
  await page.evaluate(() => window.deselectAll());
  expect(await meshOf(page, A), '패널을 열고 닫기만 하면 저장 글자 불변').toBe(MESH);
  expect(await imgOf(page, A)).toBe(await norm(page, OLD_IMAGE));
  expect(errs).toEqual([]);
});

test('S2 막대 빈 데 더블클릭 = 그 모서리에만 스톱 하나(이웃 보간) · 다른 세 칸은 옛 꼴 · 그 겹이 셋으로 그려진다', async ({ page }) => {
  const { errs, A } = await setup(page);
  await seedMesh(page, A, MESH);
  await pickSection(page, A);
  await expect.poll(() => thumbs(page)).toEqual([2, 2, 2, 2]);
  const pt = await barPoint(page, 'tl', 0.36);
  await page.mouse.dblclick(pt.x, pt.y);
  await expect.poll(() => thumbs(page)).toEqual([3, 2, 2, 2]);
  const parts = (await meshOf(page, A)).split('|');
  expect(parts.slice(1), '다른 세 모서리 칸은 옛 꼴 그대로').toEqual(MESH.split('|').slice(1));
  const m = /^#ff0080 0%, rgba\(255, 0, 128, (0\.\d+)\) (\d+(?:\.\d+)?)%, rgba\(255, 0, 128, 0\) 72%$/.exec(parts[0]);
  expect(m, `왼위 칸 = 세 스톱(가운데 = 이웃 보간: 같은 색 · 알파 사이): ${parts[0]}`).not.toBe(null);
  const pct = Number(m[2]);
  expect(pct > 30 && pct < 42 && Number(m[1]) > 0.3 && Number(m[1]) < 0.7, `누른 자리·보간 알파(${pct}% · ${m[1]})`).toBe(true);
  const want = `radial-gradient(ellipse farthest-side at 0% 0%, ${parts[0]}), ` + OLD_IMAGE.split('), radial-gradient(').slice(1).map((x) => 'radial-gradient(' + x).join('), ');
  expect(await fnImage(page, await meshOf(page, A)), '그 겹 = 세 스톱 · 나머지 세 겹 = 옛 공식 그대로').toBe(want);
  expect(await imgOf(page, A), '그대로 그려졌다').toBe(await norm(page, want));
  expect(await page.inputValue('#sec-mesh-tl-hex'), '색 칸 = 새로 고른 스톱').toBe('FF0080');
  expect(errs).toEqual([]);
});

test('S3 손잡이를 끌면 위치가 바뀌고 ⌘Z 한 번 = 끌기 전', async ({ page }) => {
  const { errs, A } = await setup(page);
  await seedMesh(page, A, '#ff0080 0%, #00ff00 40%, rgba(255, 0, 128, 0) 72%|#7928ca|#00d4ff|#ffdd00');
  await pickSection(page, A);
  await expect.poll(() => thumbs(page)).toEqual([3, 2, 2, 2]);
  const before = await meshOf(page, A);
  const th = await thumbPoint(page, 'tl', 1);
  expect(th.top, '★전제: 가운데 손잡이가 그 자리에서 맨 위').toBe(true);
  const to = await barPoint(page, 'tl', 0.2);
  await page.mouse.move(th.x, th.y);
  await page.mouse.down();
  await page.mouse.move(to.x, th.y, { steps: 6 });
  await page.mouse.up();
  const after = (await meshOf(page, A)).split('|')[0];
  const pct = Number((/#00ff00 (\d+(?:\.\d+)?)%/.exec(after) || [])[1]);
  expect(Math.abs(pct - 20) <= 1.5, `끈 자리(${after})`).toBe(true);
  await page.keyboard.press('Meta+z');
  await expect.poll(() => meshOf(page, A), '⌘Z 한 번 = 끌기 전').toBe(before);
  expect(errs).toEqual([]);
});

test('S4 × 로 더한 스톱을 지우면 그 칸이 옛 꼴 바이트로 돌아간다', async ({ page }) => {
  const { errs, A } = await setup(page);
  await seedMesh(page, A, MESH);
  await pickSection(page, A);
  await expect.poll(() => thumbs(page)).toEqual([2, 2, 2, 2]);
  const pt = await barPoint(page, 'br', 0.5);
  await page.mouse.dblclick(pt.x, pt.y);
  await expect.poll(() => thumbs(page)).toEqual([2, 2, 3, 2]);
  expect(await meshOf(page, A)).not.toBe(MESH);
  await page.click('#sec-mesh-br-del');
  await expect.poll(() => thumbs(page)).toEqual([2, 2, 2, 2]);
  expect(await meshOf(page, A), '옛 꼴 바이트 그대로').toBe(MESH);
  expect(await imgOf(page, A)).toBe(await norm(page, OLD_IMAGE));
  expect(await page.evaluate(() => document.getElementById('sec-mesh-br-del').disabled), '둘이면 다시 잠긴다').toBe(true);
  expect(errs).toEqual([]);
});

test('S5 고른 스톱의 색 칸을 고치면 그 스톱만 · 투명도는 그 스톱 것 그대로', async ({ page }) => {
  const { errs, A } = await setup(page);
  await seedMesh(page, A, '#ff0080 0%, rgba(0, 0, 255, 0.5) 40%, rgba(255, 0, 128, 0) 72%|#7928ca|#00d4ff|#ffdd00');
  await pickSection(page, A);
  await expect.poll(() => thumbs(page)).toEqual([3, 2, 2, 2]);
  const th = await thumbPoint(page, 'tl', 1);
  await page.mouse.click(th.x, th.y);
  await expect.poll(() => page.inputValue('#sec-mesh-tl-hex'), '색 칸 = 고른 스톱 색').toBe('0000FF');
  expect(await page.inputValue('#sec-mesh-tl-alpha'), '투명도 칸 = 고른 스톱 투명도').toBe('50');
  await page.fill('#sec-mesh-tl-hex', '00FF00');
  await page.press('#sec-mesh-tl-hex', 'Enter');
  await expect.poll(() => meshOf(page, A)).toBe('#ff0080 0%, rgba(0, 255, 0, 0.5) 40%, rgba(255, 0, 128, 0) 72%|#7928ca|#00d4ff|#ffdd00');
  expect(errs).toEqual([]);
});

test('S6 직렬화 왕복 뒤에도 스톱이 그대로 그려진다', async ({ page }) => {
  const { errs, A } = await setup(page);
  const SPEC = '#ff0080 0%, rgba(0, 255, 0, 0.5) 25%, #0000ff 50%, rgba(255, 0, 128, 0) 72%|#7928ca|#00d4ff 0%, rgba(0, 212, 255, 0) 90%|#ffdd00';
  await seedMesh(page, A, SPEC);
  const img0 = await imgOf(page, A);
  const out = await page.evaluate((i) => {
    const html = window.getSerializedCanvas();
    const c = document.getElementById('canvas');
    c.innerHTML = html; window.rebindAll?.();
    const s = document.getElementById(i);
    return { mesh: s.dataset.bgMesh, img: s.style.backgroundImage, carried: html.includes('data-bg-mesh=') };
  }, A);
  expect(out.carried, '★전제: 직렬화본에 data-bg-mesh 가 실렸다').toBe(true);
  expect(out.mesh).toBe(SPEC);
  expect(out.img, '다시 연 뒤 같은 CSS').toBe(img0);
  expect((out.img.match(/radial-gradient\(/g) || []).length).toBe(4);
  expect(errs).toEqual([]);
});

test('S7 ★(음성·보안) 꼴 밖 칸이 하나라도 있으면 메시 아님 — 한 겹도 안 그린다', async ({ page }) => {
  const { errs, A } = await setup(page);
  await seedMesh(page, A, MESH);
  expect((await imgOf(page, A)).match(/radial-gradient\(/g)?.length, '★양성대조: 옳은 꼴은 네 겹').toBe(4);
  for (const bad of [
    'url(x.png) 0%, #ffffff 72%|#7928ca|#00d4ff|#ffdd00',
    '#ff0080 0%, expression(alert(1)) 50%|#7928ca|#00d4ff|#ffdd00',
    '#ff0080 0%, #ffffff 120%|#7928ca|#00d4ff|#ffdd00',
    '#ff0080 0%|#7928ca|#00d4ff|#ffdd00',
    'rgba(300, 0, 0, 1) 0%, #ffffff 72%|#7928ca|#00d4ff|#ffdd00',
  ]) {
    await seedMesh(page, A, bad);
    expect(await imgOf(page, A), `메시 아님: ${bad}`).not.toMatch(/radial-gradient/);
  }
  expect(errs).toEqual([]);
});
