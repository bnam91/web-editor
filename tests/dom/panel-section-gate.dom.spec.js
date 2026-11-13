/* panel-section-gate — 우측 패널 «절»이 정본(js/props/_section-spec.js)과 같은가. (right-panel-unify U0 · §6-1)
 * 분모 = _block-roster-294 rosterOf()(js/editor.js SECTION_BLOCK_TYPE_SEL 파생) ＋ 수동 6(page·section·frame·row·multisel·annotation-block — 로스터 밖).
 * 판정(_panel-sections.js judgePanel): ★소유(_section-spec.js OWNERSHIP — 컨트롤 id·class·data-* → 있어야 할 절) · SECTION_ORDER 부분열 · 중복 0 · 제목 == SECTION_TITLE(special 은 영어 Title Case 1~2단어 규칙) ·
 *   머리 없는 절은 맨 앞 header 만 · 라벨이 절 제목을 되풀이 0 · prop-hint ≤ 2 · data-sec 절 ≥ 1.
 * ★미이관은 UNMIGRATED 한 명단에만 둔다(test.skip) — 단위(U1~U5)가 자기 블록을 옮기면 그 줄을 지운다. U6 에서 0.
 *   명단에도 없고 이관도 안 된 «새 블록»은 판정에 들어가 빨강이 된다(조용히 빠지지 않는다).
 * 양성대조(내장 G2): 실제로 잰 브릿지 패널을 «뒤집은 SECTION_ORDER»·«틀린 제목 표»로 재면 위반이 나와야 한다.
 *   바깥 양성대조: prop-bridge.js 의 sec('fill' …) 을 sec('effects' …) 로 바꾸면 G1 빨강(소유 위반 — brg-color 는 fill 절 속성).
 *   ⚠️순서 위반은 이관 블록에선 «날 수 없다»(renderPanel 이 정렬한다) — 그래서 소유가 이 게이트의 본 칼날이다. */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const { addKind } = require('./_block-roster-294.js');
const { loadSectionSpec, readPanel, judgePanel, resolveRoster, ENTRY_ALIAS } = require('./_panel-sections.js');

/* ★미이관 명단 — U1 그리드 · U2 텍스트 · U3 컨테이너 · U4 미디어/도형 · U5 조합/스티커. U0 이관 = gap-block · bridge-block. */
const UNMIGRATED = [
  'grid-block',                                                                                  // U1
  'text-block', 'icon-text-block', 'speech-bubble-block', 'quote-block', 'label-group-block',     // U2
  'page', 'section', 'frame', 'row', 'multisel', 'canvas-block', 'modal-block',                   // U3
  'asset-block', 'shape-block', 'icon-circle-block', 'icon-block', 'vector-block', 'mockup-block',
  'zoom-block', 'gradient-block', 'divider-block', 'joker-block', 'annotation-block',             // U4(annotation = 수동 입구 — U4 가 이관 머지 때 뺀다)
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
  /* annotation-block 은 SECTION_BLOCK_TYPE_SEL 밖이라 로스터가 못 센다 — 펜 도구 대신 공용 생성기(makeAnnotationBlock)로 넣고 패널을 연다(annot-point-angle-leak 꼴) */
  'annotation-block': () => { const a = window.makeAnnotationBlock({ points: [[20, 20], [160, 90]], text: 'GATE' }); window.__secEl().appendChild(a); window.deselectAll?.(); window.showAnnotationProperties(a); },
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

test('G0 [전제] 명단이 낡지 않았다 — UNMIGRATED 의 이름은 전부 로스터나 수동 입구에 있다 · 수동 입구는 패널을 연다', async ({ page }) => {
  await scene(page);
  const roster = await resolveRoster(page);
  const known = new Set([...roster.map((k) => k.cls), ...Object.keys(MANUAL)]);
  expect(UNMIGRATED.filter((k) => !known.has(k)), '★로스터에 없는 이름이 명단에 남았다').toEqual([]);
  expect(new Set(UNMIGRATED).size, '★명단 중복').toBe(UNMIGRATED.length);
  /* ★수동 입구가 «실제로» 패널을 연다(미이관이어도 — 이관 단위가 명단에서 빼는 날 바로 잴 수 있게) */
  for (const [name, open] of Object.entries(MANUAL)) {
    if (!open) continue;
    await page.evaluate(() => { document.querySelector('#panel-right .panel-body').innerHTML = ''; });
    await page.evaluate(open);
    expect(await page.locator('#panel-right .panel-body .prop-section').count(), `★수동 입구 ${name} 가 패널을 안 연다`).toBeGreaterThan(0);
  }
  expect(await page.evaluate(() => document.querySelectorAll('.annotation-block').length), '[전제] annotation 입구가 블록을 넣었다').toBeGreaterThan(0);
  /* ★모든 로스터 블록이 «실제» 넣기 함수로 풀린다(별칭 오타·사라진 입구 = 빨강) · 별칭 표가 낡지 않았다 */
  expect(roster.filter((k) => !k.entryOk).map((k) => `${k.cls} → ${k.entry}`), '★입구가 안 풀린다').toEqual([]);
  expect(Object.keys(ENTRY_ALIAS).filter((c) => !roster.some((k) => k.cls === c)), '★별칭 표에 로스터 밖 이름').toEqual([]);
  expect(roster.find((k) => k.cls === 'icon-block')?.entry, '[전제] icon-block = addIconifyBlock').toBe('addIconifyBlock');
  /* ★양성대조 — 별칭 오타는 같은 판정으로 거짓이 된다 */
  expect(await page.evaluate(() => typeof window.addIconifyBlok), '[양성대조] 오타 이름은 함수가 아니다').toBe('undefined');
});

test('G1 이관된 블록 패널 — 절 순서·제목·중복·머리·라벨·힌트가 정본과 같다', async ({ page }) => {
  const errs = await scene(page);
  const roster = await resolveRoster(page);
  const judged = []; const fails = [];
  for (const kind of roster.filter((k) => !UNMIGRATED.includes(k.cls))) {
    if (!kind.entryOk) { fails.push(`${kind.cls}: 입구 없음(${kind.entry})`); continue; }
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
  // ★소유 — 진짜 DOM 에서 색 필드 절을 effects 로 바꾼 가짜 렌더(순서·제목은 정본 그대로 맞춰 «소유»만 틀리게)
  await page.evaluate(() => { const s = document.getElementById('psec-fill'); s.dataset.sec = 'effects'; s.querySelector(':scope > .prop-sec-head .prop-sec-title-text').textContent = 'Effects'; });
  const moved = await readPanel(page);
  expect(moved.secs.find((s) => s.sec === 'effects')?.controls.length, '[전제] 색 컨트롤이 effects 절로 갔다').toBeGreaterThan(0);
  const v = judgePanel(moved, SPEC);
  expect(v.join(' | '), '★색 필드가 effects 절에 있는데 못 잡는다').toContain('소유 위반: brg-color');
  expect(v.filter((x) => !x.startsWith('소유 위반')), '[전제] 소유 «만» 틀린 가짜다').toEqual([]);
});

test('G4 ★하위 접기 제외는 «그릇 안»만 — 그리드 칸 컨트롤이 그릇 밖이면 소유 위반(진짜 DOM 가짜 렌더)', async ({ page }) => {
  await scene(page);
  await openKind(page, { cls: 'bridge-block', entry: 'addBridgeBlock' });
  expect(judgePanel(await readPanel(page), SPEC), '[전제] 정본 판은 통과').toEqual([]);
  // 그리드 「칸 꾸미기」 몸통(#grd-cell-body) 안의 색 칸 — Size 절에 있어도 제외
  await page.evaluate(() => { const w = document.createElement('div'); w.id = 'grd-cell-body'; w.innerHTML = '<input type="color" id="grd-cell-bg-color">'; document.getElementById('psec-size-body').appendChild(w); });
  expect(judgePanel(await readPanel(page), SPEC), '★그릇 안 컨트롤이 빨갛다(제외가 안 먹는다)').toEqual([]);
  // 같은 컨트롤을 그릇 «밖»(Size 절 몸 바로 아래)으로 — 빨강이어야 한다
  await page.evaluate(() => { const c = document.getElementById('grd-cell-bg-color'); document.getElementById('psec-size-body').appendChild(c); document.getElementById('grd-cell-body').remove(); });
  expect(judgePanel(await readPanel(page), SPEC), '★그릇 밖인데 못 잡는다').toEqual(['소유 위반: grd-cell-bg-color 는 fill 절 속성인데 size 절에 있다']);
  // U0c ⑭ 절에 묶인 그릇 — #grd-bbg-section(Fill 몫) 안 여백 칸: Fill 절이면 통과 · Size 절로 옮기면 빨강
  await page.evaluate(() => { document.getElementById('grd-cell-bg-color').remove(); const w = document.createElement('div'); w.id = 'grd-bbg-section'; w.innerHTML = '<input type="number" id="grd-bbg-pad-number">'; document.getElementById('psec-fill-body').appendChild(w); });
  expect(judgePanel(await readPanel(page), SPEC), '★Fill 안 블럭 배경 그릇인데 빨갛다').toEqual([]);
  await page.evaluate(() => document.getElementById('psec-size-body').appendChild(document.getElementById('grd-bbg-section')));
  expect(judgePanel(await readPanel(page), SPEC), '[양성대조] 그릇이 엉뚱한 절(Size)이면 판정').toEqual(['소유 위반: grd-bbg-pad-number 는 padding 절 속성인데 size 절에 있다']);
});

test('G5 data-own 명시 덮어쓰기 — 조상 줄의 data-own 을 readPanel 이 읽고 «그 절»로 판정한다(진짜 DOM)', async ({ page }) => {
  await scene(page);
  await openKind(page, { cls: 'bridge-block', entry: 'addBridgeBlock' });
  // radius 단어 = 규칙상 Appearance. Size 절 몸에 넣고 줄에 data-own="size" — 통과
  await page.evaluate(() => { const r = document.createElement('div'); r.className = 'prop-row'; r.id = '__own-row'; r.dataset.own = 'size'; r.innerHTML = '<input type="range" id="xx-radius-slider">'; document.getElementById('psec-size-body').appendChild(r); });
  expect(judgePanel(await readPanel(page), SPEC), '★data-own=size 줄 안인데 빨갛다').toEqual([]);
  // 덮어쓰기를 걷으면 규칙대로 Appearance ⇒ 빨강
  await page.evaluate(() => { delete document.getElementById('__own-row').dataset.own; });
  expect(judgePanel(await readPanel(page), SPEC), '[양성대조] 덮어쓰기 없으면 잡는다').toEqual(['소유 위반: xx-radius-slider 는 appearance 절 속성인데 size 절에 있다']);
});

test('G6 반복 항목 카드는 Content 안에서만 판정 밖 — 같은 카드가 다른 절이면 판정(진짜 DOM)', async ({ page }) => {
  await scene(page);
  await openKind(page, { cls: 'bridge-block', entry: 'addBridgeBlock' });
  // 브릿지 Size 절 몸에 항목 카드(.prop-cell-card) + 색 칸 — Size 절이라 판정 ⇒ 빨강
  await page.evaluate(() => { const k = document.createElement('div'); k.className = 'prop-cell-card'; k.innerHTML = '<input type="color" id="cmp-card-0-bg-color">'; document.getElementById('psec-size-body').appendChild(k); });
  expect(judgePanel(await readPanel(page), SPEC), '[양성대조] Content 밖 카드는 판정').toEqual(['소유 위반: cmp-card-0-bg-color 는 fill 절 속성인데 size 절에 있다']);
  // 그 절을 Content 로(data-sec·제목만 — 순서는 content < fill < special 이라 정본 부분열) ⇒ 카드 안이라 판정 밖
  await page.evaluate(() => { const s = document.getElementById('psec-size'); s.dataset.sec = 'content'; s.querySelector(':scope > .prop-sec-head .prop-sec-title-text').textContent = 'Content'; });
  expect(judgePanel(await readPanel(page), SPEC), '★Content 안 항목 카드인데 빨갛다').toEqual([]);
});

test('G7 simple-card 꼴 항목 카드([data-card-index] · id 없는 칸) — Content 안에서만 판정 밖(진짜 DOM)', async ({ page }) => {
  await scene(page);
  await openKind(page, { cls: 'bridge-block', entry: 'addBridgeBlock' });
  /* prop-simple-card.js #cvb-card-items 의 꼴 그대로: .cvb-card-item[data-card-index] 안 input[type=color][data-card-index] (id 없음) */
  await page.evaluate(() => { const k = document.createElement('div'); k.id = 'cvb-card-items'; k.innerHTML = '<div class="cvb-card-item" data-card-index="0"><input type="color" class="cvb-card-cell-bg" data-card-index="0"></div>'; document.getElementById('psec-size-body').appendChild(k); });
  const red = judgePanel(await readPanel(page), SPEC);
  expect(red, '[양성대조] Size 절의 카드는 판정 — 색 칸 소유 위반 1건').toEqual(['소유 위반: card-index 0 color 는 fill 절 속성인데 size 절에 있다']);
  await page.evaluate(() => { const s = document.getElementById('psec-size'); s.dataset.sec = 'content'; s.querySelector(':scope > .prop-sec-head .prop-sec-title-text').textContent = 'Content'; });
  expect(judgePanel(await readPanel(page), SPEC), '★Content 안 simple-card 항목 칸인데 빨갛다').toEqual([]);
});

test('G8 effects-registry 카드 칸 = Effects — 진짜 에셋 블록 + 그림자 카드(fxSectionParts) 를 틀로 그려 잰다', async ({ page }) => {
  await scene(page);
  const r = await addKind(page, { cls: 'asset-block', entry: 'addAssetBlock' });
  expect(r.err, '[전제] 에셋 블록').toBeUndefined();
  const draw = (key) => page.evaluate(async ({ id, key }) => {
    const { renderPanel, sec } = await import('/js/props/_panel-frame.js');
    const ab = document.getElementById(id);
    const t = window.fxTypesFor(ab).find((x) => x.key === 'shadow');
    if (t && !t.has(ab)) t.add(ab);
    const p = window.fxSectionParts(ab, 'asset');
    renderPanel(ab, { sections: [sec(key, p.body, { headTools: p.headTools, id: p.id })] });
    return !!document.getElementById('asset-fxsh-color');
  }, { id: r.id, key });
  expect(await draw('effects'), '[전제] 그림자 카드의 색 칸이 그려졌다').toBe(true);
  const ok = await readPanel(page);
  expect(ok.secs.find((s) => s.sec === 'effects').controls.filter((c) => c.fxCard).length, '[전제] 카드 칸을 fx 목록 안으로 읽었다').toBeGreaterThan(2);
  expect(judgePanel(ok, SPEC), '★Effects 안 그림자 카드 칸이 빨갛다').toEqual([]);
  await draw('fill');   // 같은 카드 목록을 Fill 절에 — 판정이 «effects 여야 한다»로 빨개져야 한다
  const red = judgePanel(await readPanel(page), SPEC);
  expect(red, '[양성대조] 카드 목록이 Fill 절이면 빨강').toContain('소유 위반: asset-fxsh-color 는 effects 절 속성인데 fill 절에 있다');
});

test('G9 빈 머리 절 — 몸의 줄이 전부 display:none 이면 빨강 · 접힘은 빈 것이 아니다(진짜 DOM)', async ({ page }) => {
  await scene(page);
  await openKind(page, { cls: 'bridge-block', entry: 'addBridgeBlock' });
  expect(judgePanel(await readPanel(page), SPEC), '[전제] 정본 판 통과').toEqual([]);
  await page.locator('#psec-size-head').click();   // 접기 — 보이는 컨트롤이 «접혀 안 보이는» 것은 빈 머리가 아니다
  await expect(page.locator('#psec-size-body')).toBeHidden();
  expect(judgePanel(await readPanel(page), SPEC), '★접힌 절을 빈 머리로 셌다').toEqual([]);
  await page.locator('#psec-size-head').click();
  /* U4 실측 꼴(가림막 켠 Fill · 떠 있는 iconify 의 Layout): 몸의 줄이 전부 display:none */
  await page.evaluate(() => document.querySelectorAll('#psec-size-body > *').forEach((r) => { r.style.display = 'none'; }));
  expect(judgePanel(await readPanel(page), SPEC), '[양성대조] 줄이 다 숨은 절을 못 잡는다').toEqual(['빈 머리 절: size — 보이는 컨트롤 0(렌더러가 그 절을 안 내야 한다)']);
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
