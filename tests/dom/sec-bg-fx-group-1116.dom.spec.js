/* sec-bg-fx-group-1116.dom.spec.js — NEW-현빈QA-BG-PANEL-NOTE-PATTERN-GROUPING-01 (현빈 실앱 QA 261116)
 *   현빈: «Background 절 안에 [메시그라데이션, 노트무늬 / 이미지선택, 체크배경으로 두기 / 파티클 켜기] — 그룹핑이 이상하다.
 *          Particles 안에 ‘파티클 켜기’랑 같이 ‘노트무늬’가 묶이면 좋겠는데 그럼 소제목(Particles)을 바꾸는 거 어때? 일단 임시로».
 *   고침: prop-section.js — 노트 무늬를 Background Image 뒤 «Pattern & Effects» 소제목 아래로(파티클과 같은 묶음).
 *         소제목은 prop-section.js 한 자리 · prop-section-particles.js 의 «Particles» 라벨 2곳은 걷음. 부품은 기존 .prop-field-label.
 * 칸 (묶음 = 그 칸에서 절 몸통 직속 형제를 거슬러 처음 만나는 .prop-field-label 글자 — 몸통 = 틀 절의 .prop-sec-body(U3 이후) · 옛 절은 .prop-section 자신)
 *   ★rp-on-dev(261118 ⓑ): 우측 패널 통일 U3 로 섹션 «Background» 절 = 틀의 «Fill» 절(data-sec="fill") · 내용은 .prop-sec-body 한 겹 안 — 셀렉터만 따라감(재는 뜻 같음).
 *   G1 기본(그림 없음·파티클 끔) — 노트 단추·파티클 켜기 = «Pattern & Effects» · 이미지 선택 = «Background Image» · «Particles» 라벨 0 · 소제목 1
 *   G2 진짜 클릭으로 파티클 켬(패널 다시 그림) — 파티클 카드·노트 단추가 여전히 같은 묶음
 *   G3 진짜 클릭으로 노트 켬 — 노트 하위 칸(종류)도 같은 묶음 · 파티클도 그대로
 * 양성대조(srv 미실행 · 아이맥): controls/BG-FX-GROUP-CTL.patch = `${noteHTML}` 를 옛 자리(메시 뒤 · Background Image 앞)로 ⇒ G1·G2·G3 빨강
 *   (노트 단추 앞에 소제목 없음 = null). 소제목 글자만 바꾸면 G1 빨강(«Particles» 되살림도 G1 빨강).
 * ⛔고정 대기 0 · 앱 = bootApp · 섹션 = addSection.
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');

const LABEL = 'Pattern & Effects';
const raf2 = (page) => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));

async function setup(page) {
  await page.setViewportSize({ width: 1600, height: 1100 });
  const errs = await bootApp(page);
  const id = await page.evaluate(async () => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach(s => s.remove());
    await window.addSection();
    return [...c.querySelectorAll('.section-block')].pop()?.id || null;
  });
  expect(id, '[전제] addSection').toBeTruthy();
  await page.evaluate((i) => document.getElementById(i).scrollIntoView({ block: 'center' }), id);
  const b = await waitStableRect(page, '#' + id);
  await page.mouse.click(b.left + 8, b.cy);
  await page.waitForFunction((i) => document.getElementById('sec-height-value')?.dataset.secId === i, id, { timeout: 8000 });
  await raf2(page);
  return { errs, id };
}

const groups = (page) => page.evaluate(() => {
  const groupOf = (el) => {
    if (!el) return undefined;
    let n = el;
    while (n.parentElement && !n.parentElement.classList.contains('prop-section') && !n.parentElement.classList.contains('prop-sec-body')) n = n.parentElement;
    for (let p = n.previousElementSibling; p; p = p.previousElementSibling) if (p.classList.contains('prop-field-label')) return p.textContent.trim();
    return null;
  };
  const labels = [...document.querySelectorAll('#panel-right .panel-body .prop-field-label')].map(l => l.textContent.trim());
  const note = document.getElementById('sec-bg-note');
  return {
    note: groupOf(note), noteKind: groupOf(document.getElementById('sec-note-kind')),
    fx: groupOf(document.getElementById('sec-fxpart-card') || document.getElementById('sec-fxpart-toggle')),
    img: groupOf(document.getElementById('sec-bg-img-btn')),
    sameSection: !!note && note.closest('.prop-section') === document.getElementById('sec-fxpart-toggle')?.closest('.prop-section'),
    title: note?.closest('.prop-section[data-sec]')?.dataset.sec ?? null,   // ★U3 선례(fx-particles-panel) — 제목 글자 대신 절 key
    nGroupLabel: labels.filter(t => t === 'Pattern & Effects').length, nParticles: labels.filter(t => t === 'Particles').length,
  };
});

test('G1 기본 — 노트 무늬·파티클 켜기가 «Pattern & Effects» 한 묶음 · 이미지 선택은 Background Image', async ({ page }) => {
  const { errs } = await setup(page);
  const g = await groups(page);
  expect(g.note, '[전제] 노트 단추 있음').not.toBeUndefined();
  expect(g.fx, '[전제] 파티클 칸 있음').not.toBeUndefined();
  expect(g, '★노트 무늬가 파티클과 다른 묶음').toMatchObject({ note: LABEL, fx: LABEL, img: 'Background Image', sameSection: true, title: 'fill', nGroupLabel: 1, nParticles: 0 });
  expect(errs, errs.join('\n')).toEqual([]);
});

test('G2 파티클 켬(진짜 클릭 · 패널 다시 그림) — 카드·노트가 여전히 같은 묶음', async ({ page }) => {
  const { errs } = await setup(page);
  await page.locator('#sec-fxpart-toggle').click();
  await page.waitForFunction(() => !!document.getElementById('sec-fxpart-card'));
  const g = await groups(page);
  expect(g).toMatchObject({ note: LABEL, fx: LABEL, nGroupLabel: 1, nParticles: 0 });
  expect(errs, errs.join('\n')).toEqual([]);
});

test('G3 노트 켬(진짜 클릭) — 하위 칸도 같은 묶음 · 파티클 그대로', async ({ page }) => {
  const { errs } = await setup(page);
  await page.locator('#sec-bg-note').click();
  await page.waitForFunction(() => !!document.getElementById('sec-note-kind'));
  const g = await groups(page);
  expect(g).toMatchObject({ note: LABEL, noteKind: LABEL, fx: LABEL, nGroupLabel: 1, nParticles: 0 });
  expect(errs, errs.join('\n')).toEqual([]);
});
