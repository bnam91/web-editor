/* panel-section-gate — 우측 패널 «절»이 정본(js/props/_section-spec.js)과 같은가. (right-panel-unify U0 · §6-1)
 * 분모 = _block-roster-294 rosterOf()(js/editor.js SECTION_BLOCK_TYPE_SEL 파생) ＋ 수동 5(page·section·frame·row·multisel).
 * 판정(_panel-sections.js judgePanel): SECTION_ORDER 부분열 · 중복 0 · 제목 == SECTION_TITLE(special 은 영어 Title Case 1~2단어 규칙) ·
 *   머리 없는 절은 맨 앞 header 만 · 라벨이 절 제목을 되풀이 0 · prop-hint ≤ 2 · data-sec 절 ≥ 1.
 * ★미이관은 UNMIGRATED 한 명단에만 둔다(test.skip) — 단위(U1~U5)가 자기 블록을 옮기면 그 줄을 지운다. U6 에서 0.
 *   명단에도 없고 이관도 안 된 «새 블록»은 판정에 들어가 빨강이 된다(조용히 빠지지 않는다).
 * 양성대조(내장 G2): 실제로 잰 브릿지 패널을 «뒤집은 SECTION_ORDER»·«틀린 제목 표»로 재면 위반이 나와야 한다.
 *   바깥 양성대조: prop-bridge.js 의 sec('fill' …) 을 sec('effects' …) 로 바꾸면 G1 빨강(순서 위반). */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const { rosterOf, addKind } = require('./_block-roster-294.js');
const { loadSectionSpec, readPanel, judgePanel } = require('./_panel-sections.js');

/* ★미이관 명단 — U1 그리드 · U2 텍스트 · U3 컨테이너 · U4 미디어/도형 · U5 조합/스티커. U0 이관 = gap-block · bridge-block. */
const UNMIGRATED = [
  'grid-block',                                                                                  // U1
  'text-block', 'icon-text-block', 'speech-bubble-block', 'quote-block', 'label-group-block',     // U2
  'page', 'section', 'frame', 'row', 'multisel', 'canvas-block', 'modal-block',                   // U3
  'asset-block', 'shape-block', 'icon-circle-block', 'icon-block', 'vector-block', 'mockup-block',
  'zoom-block', 'gradient-block', 'divider-block', 'joker-block',                                 // U4
  'sticker-block', 'laurel-block', 'banner02-block', 'table-block', 'graph-block', 'step-block',
  'chat-block', 'comparison-block', 'coupon-block', 'infocard-block', 'innercard-block', 'qa-block',
  'radial-block',                                                                                 // U5
];
/* 수동 5 — 로스터 밖 패널의 입구. null = 아직 입구를 안 적었다(그 단위가 UNMIGRATED 에서 뺄 때 채운다 — 비어 있으면 빨강). */
const MANUAL = {
  page: () => { window.deselectAll?.(); window.showPageProperties(); },
  section: () => { window.deselectAll?.(); window.selectSection(window.__secEl()); },
  frame: null,
  row: null,
  multisel: null,
};
for (const k of UNMIGRATED) test.skip(`${k} — 미이관(UNMIGRATED)`, () => {});

const SPEC = loadSectionSpec();

async function scene(page) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(async () => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); await window.addSection(); const sec = c.querySelector('.section-block'); window.__secEl = () => sec; window.clearHistory?.(); });
  return errs;
}
/** 블록을 넣고 그 패널을 연다(정본 디스패치 = selectBlock). */
async function openKind(page, kind) {
  const r = await addKind(page, kind);
  if (r.err) return r;
  await page.evaluate((id) => window.selectBlock(id), r.id);
  await expect(page.locator('#panel-right .panel-body .prop-section').first()).toBeAttached();
  return r;
}

test('G0 [전제] 명단이 낡지 않았다 — UNMIGRATED 의 이름은 전부 로스터나 수동 5 에 있다', async ({ page }) => {
  await scene(page);
  const roster = await rosterOf(page);
  const known = new Set([...roster.map((k) => k.cls), ...Object.keys(MANUAL)]);
  expect(UNMIGRATED.filter((k) => !known.has(k)), '★로스터에 없는 이름이 명단에 남았다').toEqual([]);
  expect(new Set(UNMIGRATED).size, '★명단 중복').toBe(UNMIGRATED.length);
});

test('G1 이관된 블록 패널 — 절 순서·제목·중복·머리·라벨·힌트가 정본과 같다', async ({ page }) => {
  const errs = await scene(page);
  const roster = await rosterOf(page);
  const judged = []; const fails = [];
  for (const kind of roster.filter((k) => !UNMIGRATED.includes(k.cls))) {
    if (!kind.entry) { fails.push(`${kind.cls}: 입구 없음`); continue; }
    const r = await openKind(page, kind);
    if (r.err) { fails.push(`${kind.cls}: ${r.err}`); continue; }
    const bad = judgePanel(await readPanel(page), SPEC);
    judged.push(kind.cls); for (const b of bad) fails.push(`${kind.cls}: ${b}`);
  }
  for (const [name, open] of Object.entries(MANUAL)) {
    if (UNMIGRATED.includes(name)) continue;
    if (!open) { fails.push(`${name}: 수동 입구가 비었다 — MANUAL 에 채워라`); continue; }
    await page.evaluate(open); judged.push(name);
    for (const b of judgePanel(await readPanel(page), SPEC)) fails.push(`${name}: ${b}`);
  }
  expect(judged, '[전제] 파일럿 둘은 판정에 들어갔다').toEqual(expect.arrayContaining(['gap-block', 'bridge-block']));
  expect(fails).toEqual([]);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('G2 ★내장 양성대조 — 뒤집은 순서·틀린 제목 표로 재면 판정이 빨강', async ({ page }) => {
  await scene(page);
  const r = await openKind(page, { cls: 'bridge-block', entry: 'addBridgeBlock' });
  expect(r.err, '[전제] 브릿지를 넣었다').toBeUndefined();
  const panel = await readPanel(page);
  expect(panel.secs.filter((s) => s.sec).map((s) => s.sec), '[전제] 브릿지 = Size·Fill·Tail').toEqual(['size', 'fill', 'special']);
  expect(judgePanel(panel, SPEC), '[전제] 정본으론 통과').toEqual([]);
  expect(judgePanel(panel, SPEC, [...SPEC.SECTION_ORDER].reverse()).join(' | '), '★뒤집은 순서를 못 잡는다').toContain('순서 위반');
  const wrongTitles = { ...SPEC, SECTION_TITLE: { ...SPEC.SECTION_TITLE, size: 'Dimensions' } };
  expect(judgePanel(panel, wrongTitles).join(' | '), '★틀린 제목을 못 잡는다').toContain('제목 불일치');
  const dup = { ...panel, secs: [...panel.secs, panel.secs.find((s) => s.sec === 'size')] };
  expect(judgePanel(dup, SPEC).join(' | '), '★중복을 못 잡는다').toContain('중복 절');
});

test('G3 접기 유지 — 절 key 단위로 블록을 바꿔도 · 다시 불러와도 그대로', async ({ page }) => {
  await scene(page);
  await openKind(page, { cls: 'gap-block', entry: 'addGapBlock' });
  const body = (k) => page.locator(`#psec-${k}-body`);
  await expect(body('size'), '[전제] 기본 펼침').toBeVisible();
  await page.locator('#psec-size-head').click();
  await expect(body('size')).toBeHidden();
  await expect(page.locator('#psec-size-head')).toHaveAttribute('aria-expanded', 'false');
  // 다른 블록 — 같은 key(size)는 접혀 있고 다른 key 는 펼침
  await openKind(page, { cls: 'bridge-block', entry: 'addBridgeBlock' });
  await expect(page.locator('#brg-h-slider'), '[전제] 브릿지 패널').toBeAttached();
  await expect(body('size')).toBeHidden();
  await expect(body('fill')).toBeVisible();
  // 다시 불러오기 — localStorage 에서 복원
  await page.reload();
  await page.waitForFunction(() => typeof window.rebindAll === 'function' && typeof window.groupSelectedBlocks === 'function', null, { timeout: 20000 });
  await page.evaluate(async () => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); await window.addSection(); const sec = c.querySelector('.section-block'); window.__secEl = () => sec; });
  await openKind(page, { cls: 'gap-block', entry: 'addGapBlock' });
  await expect(page.locator('#gap-slider'), '[전제] 갭 패널').toBeAttached();
  await expect(body('size'), '★재로드 뒤 접힘이 안 남았다').toBeHidden();
  // 접힌 채로도 DOM 은 있다(id 조회 spec 보호) · 다시 펼치면 저장에서 빠진다
  await page.locator('#psec-size-head').click();
  await expect(body('size')).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('gd-panel-collapsed') || '[]'))).toEqual([]);
});
