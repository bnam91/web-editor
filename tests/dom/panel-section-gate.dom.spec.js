/* panel-section-gate — 우측 패널 «절»이 정본(js/props/_section-spec.js)과 같은가. (right-panel-unify U0 · §6-1)
 * 분모 = _block-roster-294 rosterOf()(js/editor.js SECTION_BLOCK_TYPE_SEL 파생) ＋ 수동 6(page·section·frame·row·multisel·annotation-block — 로스터 밖).
 * 판정(_panel-sections.js judgePanel): ★소유(_section-spec.js OWNERSHIP — 컨트롤 id·class·data-* → 있어야 할 절) · SECTION_ORDER 부분열 · 중복 0 · 제목 == SECTION_TITLE(special 은 영어 Title Case 1~2단어 규칙) ·
 *   머리 없는 절은 맨 앞 header 만 · 라벨이 절 제목을 되풀이 0 · prop-hint ≤ 2 · data-sec 절 ≥ 1.
 * ★미이관은 UNMIGRATED 한 명단에만 둔다(test.skip) — 단위(U1~U5)가 자기 블록을 옮기면 그 줄을 지운다. U6 에서 0.
 *   명단에도 없고 이관도 안 된 «새 블록»은 판정에 들어가 빨강이 된다(조용히 빠지지 않는다).
 * 양성대조(내장 G2): 실제로 잰 브릿지 패널을 «뒤집은 SECTION_ORDER»·«틀린 제목 표»로 재면 위반이 나와야 한다.
 * 순서 예외(G2b): 정본 순서 = sectionOrderFor(패널의 data-order) — 섹션 패널만 Fill 앞(현빈 261118 D5 ①) · 전역 순서로 재면 빨강.
 *   바깥 양성대조: prop-bridge.js 의 sec('fill' …) 을 sec('effects' …) 로 바꾸면 G1 빨강(소유 위반 — brg-color 는 fill 절 속성).
 *   ⚠️순서 위반은 이관 블록에선 «날 수 없다»(renderPanel 이 정렬한다) — 그래서 소유가 이 게이트의 본 칼날이다. */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const { addKind } = require('./_block-roster-294.js');
const { loadSectionSpec, readPanel, judgePanel, resolveRoster, ENTRY_ALIAS } = require('./_panel-sections.js');

/* ★미이관 명단 — U1 그리드 · U2 텍스트 · U3 컨테이너 · U4 미디어/도형 · U5 조합/스티커. U0 이관 = gap-block · bridge-block. */
const UNMIGRATED = [
];
/* 수동 5 — 로스터 밖 패널의 입구. null = 아직 입구를 안 적었다(그 단위가 UNMIGRATED 에서 뺄 때 채운다 — 비어 있으면 빨강). */
const MANUAL = {
  page: () => { window.deselectAll?.(); window.showPageProperties(); },
  section: () => { window.deselectAll?.(); window.selectSection(window.__secEl()); },
  /* U3 — 섹션 직속 새 프레임 · 칸 둘 row · 글 둘 흐름 멀티선택(정렬·분배·글자 크기) */
  frame: () => { window.deselectAll?.(); const s = window.__secEl(); window.selectSection(s); window.addFrameBlock(); window.showFrameProperties([...s.querySelectorAll('.frame-block:not([data-text-frame])')].pop()); },
  row: () => { window.deselectAll?.(); const r = document.createElement('div'); r.className = 'row'; r.dataset.layout = 'flex'; r.innerHTML = '<div class="col" data-flex="1"></div><div class="col" data-flex="1"></div>'; window.__secEl().querySelector('.section-inner').appendChild(r); window.showRowProperties(r); },
  multisel: () => { window.deselectAll?.(); const s = window.__secEl(); for (let i = 0; i < 2; i++) { window.selectSection(s); window.addTextBlock('body'); } const t = [...s.querySelectorAll('.text-block')].slice(-2); window.deselectAll?.(); t.forEach((b) => b.classList.add('selected')); window.showFlowMultiSelPanel(); },
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
  /* ★기대 바뀜(RP-PRD-PREEXIST-FAIL-01 · 261121) — ⑴ '__group' = 읽개(readPanel)가 Layout 묶음 머리에 붙이는 표식(750b9fae6 · 판정기도 절에서 뺀다) ⇒ 여기서도 뺀다
     ⑵ 블록 «Template» 절(c5686f5a7 · Q37 · 현빈 GO 261120)이 모든 블럭 패널 끝에 붙는다 */
  expect(panel.secs.filter((s) => s.sec && s.sec !== '__group').map((s) => s.sec), '[전제] 브릿지 = Size·Fill·Appearance·Template·Tail').toEqual(['size', 'fill', 'appearance', 'template', 'special']);   // ★기대 바뀜(P-2 SECTION_ORDER v1 · 지디 승인)   // ★기대 바뀜(표준 Appearance A4 C1 · 현빈 261124) — 브릿지 Opacity 새 절 = 정본 순서 자리(appearance 는 Fill 앞)   // ★기대 바뀜(지디 261123 ⑶ⓑ · 정본 v1 꼬리 Templates → [Special])
  expect(judgePanel(panel, SPEC), '[전제] 정본으론 통과').toEqual([]);
  expect(judgePanel(panel, SPEC, [...SPEC.SECTION_ORDER].reverse()).join(' | '), '★뒤집은 순서를 못 잡는다').toContain('순서 위반');
  const wrongTitles = { ...SPEC, SECTION_TITLE: { ...SPEC.SECTION_TITLE, size: 'Dimensions' } };
  expect(judgePanel(panel, wrongTitles).join(' | '), '★틀린 제목을 못 잡는다').toContain('제목 불일치');
  const dup = { ...panel, secs: [...panel.secs, panel.secs.find((s) => s.sec === 'size')] };
  expect(judgePanel(dup, SPEC).join(' | '), '★중복을 못 잡는다').toContain('중복 절');
  // ★소유 — 진짜 DOM 에서 색 필드 절을 stroke 로 바꾼 가짜 렌더(순서·제목은 정본 그대로 맞춰 «소유»만 틀리게)
  // ★기대 바뀜(P-2 v1) — 옛 가짜 = effects 였으나 v1 에선 effects 가 appearance 뒤라 «순서 위반»도 났다 ⇒ fill 자리에서 순서가 맞는 stroke(Fill → Stroke → Appearance)
  await page.evaluate(() => { const s = document.getElementById('psec-fill'); s.dataset.sec = 'stroke'; s.querySelector(':scope > .prop-sec-head .prop-sec-title-text').textContent = 'Stroke'; });
  const moved = await readPanel(page);
  expect(moved.secs.find((s) => s.sec === 'stroke')?.controls.length, '[전제] 색 컨트롤이 stroke 절로 갔다').toBeGreaterThan(0);
  const v = judgePanel(moved, SPEC);
  expect(v.join(' | '), '★색 필드가 stroke 절에 있는데 못 잡는다').toContain('소유 위반: brg-color');
  expect(v.filter((x) => !x.startsWith('소유 위반')), '[전제] 소유 «만» 틀린 가짜다').toEqual([]);
});

test('G2b ★순서 예외 — 섹션 패널 = Layout 묶음 안 Alignment(layout)가 Size 위 · Fill 은 전역 자리(현빈 261123 «섹션도 예외없이 layout 다음 fill» · D5 걷음) · 다른 패널은 전역 순서', async ({ page }) => {
  await scene(page);
  await page.evaluate(MANUAL.section);
  await page.waitForFunction(() => !!document.getElementById('sec-height-value') && !!document.querySelector('#panel-right .panel-body .prop-section[data-sec="fill"]'));
  const panel = await readPanel(page);
  /* ★기대 바뀜(RP-PRD-PREEXIST-FAIL-01 · 261121) — 판정기(_panel-sections judgePanel)와 같은 규칙으로 순서를 본다: kind(Type 띠 · Q1·Q2 현빈 GO 261120)는 늘 이름표 아래 맨 앞이라 순서 밖 ·
     '__group' 은 Layout 묶음 머리 표식(절 아님). Fill 이 «절 중» 첫째인 D5 ① 은 그대로 잰다. */
  const keys = panel.secs.filter((s) => s.sec && s.sec !== '__group' && s.sec !== 'kind').map((s) => s.sec);
  expect(panel.order, '[전제] 섹션 패널 = 예외 이름 section').toBe('section');
  expect(keys, '★순서 = 예외표 몫의 부분열').toEqual(SPEC.sectionOrderFor('section').filter((k) => keys.includes(k)));
  /* ★기대 바뀜(현빈 261123 «섹션도 예외없이 일단 layout 다음 fill» — 11-18 D5 «Fill 첫 절» 걷음) · 남은 섹션 예외 = before(layout → size) */
  expect(keys.indexOf('layout'), '★Alignment(layout)이 Size 앞').toBeLessThan(keys.indexOf('size'));
  expect(keys.indexOf('padding'), '★Layout 묶음(정렬·크기·여백)이 Fill 앞').toBeLessThan(keys.indexOf('fill'));
  expect(SPEC.SECTION_ORDER_EXCEPT.section.first, '★섹션 «Fill 맨 앞» 예외가 되살아났다').toBeUndefined();
  expect(judgePanel(panel, SPEC), '정본(예외표)으론 통과').toEqual([]);
  expect(judgePanel(panel, SPEC, SPEC.SECTION_ORDER).join(' | '), '★양성대조 — 전역 순서로 재면 순서 위반').toContain('순서 위반');
  const r = await openKind(page, { cls: 'bridge-block', entry: 'addBridgeBlock' });
  expect(r.err, '[전제] 브릿지').toBeUndefined();
  expect((await readPanel(page)).order, '★다른 패널엔 예외 표식 없음').toBe('');
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
  /* ★기대 바뀜(RP-PRD-PREEXIST-FAIL-01 · 261121) — Size 는 Layout 묶음(Q2 · 현빈 GO 261120) 안 몸(.prop-sec-part[data-sec=size] · 몸 #psec-size-body · 제목 = data-title)이다 — 그 몸을 Content 로 바꾼 가짜 */
  await page.evaluate(() => { const s = document.getElementById('psec-size-body').closest('[data-sec]'); s.dataset.sec = 'content'; s.dataset.title = 'Content'; });
  expect(judgePanel(await readPanel(page), SPEC), '★Content 안 항목 카드인데 빨갛다').toEqual([]);
});

test('G7 simple-card 꼴 항목 카드([data-card-index] · id 없는 칸) — Content 안에서만 판정 밖(진짜 DOM)', async ({ page }) => {
  await scene(page);
  await openKind(page, { cls: 'bridge-block', entry: 'addBridgeBlock' });
  /* prop-simple-card.js #cvb-card-items 의 꼴 그대로: .cvb-card-item[data-card-index] 안 input[type=color][data-card-index] (id 없음) */
  await page.evaluate(() => { const k = document.createElement('div'); k.id = 'cvb-card-items'; k.innerHTML = '<div class="cvb-card-item" data-card-index="0"><input type="color" class="cvb-card-cell-bg" data-card-index="0"></div>'; document.getElementById('psec-size-body').appendChild(k); });
  const red = judgePanel(await readPanel(page), SPEC);
  expect(red, '[양성대조] Size 절의 카드는 판정 — 색 칸 소유 위반 1건').toEqual(['소유 위반: card-index 0 color 는 fill 절 속성인데 size 절에 있다']);
  /* ★기대 바뀜(RP-PRD-PREEXIST-FAIL-01 · 261121) — Size 는 Layout 묶음(Q2 · 현빈 GO 261120) 안 몸(.prop-sec-part[data-sec=size] · 몸 #psec-size-body · 제목 = data-title)이다 — 그 몸을 Content 로 바꾼 가짜 */
  await page.evaluate(() => { const s = document.getElementById('psec-size-body').closest('[data-sec]'); s.dataset.sec = 'content'; s.dataset.title = 'Content'; });
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

test('G9 빈 머리 절 — 몸의 줄이 전부 display:none 이면 빨강(진짜 DOM)', async ({ page }) => {
  await scene(page);
  await openKind(page, { cls: 'bridge-block', entry: 'addBridgeBlock' });
  expect(judgePanel(await readPanel(page), SPEC), '[전제] 정본 판 통과').toEqual([]);
  /* ★기대 바뀜(패널 재설계 1차 · 표준 절 접기 없음) — 옛 «접힌 절은 빈 머리가 아니다» 칸은 접기가 없어져 걷었다 */
  /* U4 실측 꼴(가림막 켠 Fill · 떠 있는 iconify 의 Layout): 몸의 줄이 전부 display:none */
  await page.evaluate(() => document.querySelectorAll('#psec-size-body > *').forEach((r) => { r.style.display = 'none'; }));
  expect(judgePanel(await readPanel(page), SPEC), '[양성대조] 줄이 다 숨은 절을 못 잡는다').toEqual(['빈 머리 절: size — 보이는 컨트롤 0(렌더러가 그 절을 안 내야 한다)']);
});

/* ★기대 바뀜(패널 재설계 1차 · 현빈 확정 «표준 절 접기 없음») — 옛 G3 은 «접기가 블록을 바꿔도·재로드해도 남는다»였다.
 *   이제: 머리를 눌러도 안 접히고, 옛 판이 남긴 저장(gd-panel-collapsed)이 있어도 다시 불러온 뒤 절이 펼쳐져 있다. */
test('G3 접기 없음 — 머리를 눌러도 그대로 · 옛 접기 저장이 있어도 재로드 뒤 펼침', async ({ page }) => {
  await scene(page);
  await openKind(page, { cls: 'gap-block', entry: 'addGapBlock' });
  const body = (k) => page.locator(`#psec-${k}-body`);
  await expect(body('size'), '[전제] 펼침').toBeVisible();
  await page.locator('#psec-size-head').click();
  await expect(body('size'), '★머리를 누르니 몸이 숨었다').toBeVisible();
  await page.evaluate(() => localStorage.setItem('gd-panel-collapsed', JSON.stringify(['size', 'fill'])));
  await page.reload();
  await page.waitForFunction(() => typeof window.rebindAll === 'function' && typeof window.groupSelectedBlocks === 'function', null, { timeout: 20000 });
  await page.evaluate(async () => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); await window.addSection(); const sec = c.querySelector('.section-block'); window.__secEl = () => sec; });
  await openKind(page, { cls: 'bridge-block', entry: 'addBridgeBlock' });
  await expect(page.locator('#brg-h-number'), '[전제] 브릿지 패널').toBeAttached();
  await expect(body('size'), '★옛 접기 저장이 절을 숨겼다').toBeVisible();
  await expect(body('fill'), '★옛 접기 저장이 절을 숨겼다').toBeVisible();
});

/* G3 ★소리 없는 잘림 0(QA dev37 261123 치명 5 — 칸 넷짜리 줄이 줄 폭 183 을 넘어 .prop-row overflow:hidden 에 잘림: 슬라이드 칸 ✕ · W·H 의 H · 페이지 거터 · 캔버스 그라데이션).
 * 판정 = 보이는 .prop-row 마다 scrollWidth ≤ clientWidth · 분모 = G1 과 같은 로스터 + 수동 입구(기본 상태). 양성대조 = G3b. */
const clippedRows = (page) => page.evaluate(() => [...document.querySelectorAll('#panel-right .panel-body .prop-row')]
  .filter((r) => r.getClientRects().length && getComputedStyle(r).visibility !== 'hidden' && r.scrollWidth > r.clientWidth)
  .map((r) => `${r.closest('.prop-section')?.dataset.sec || '?'}›${(r.querySelector('.prop-label')?.textContent || r.id || r.className).trim().slice(0, 16)} sw${r.scrollWidth}>cw${r.clientWidth}`));
test('G3 보이는 .prop-row 가 잘리지 않는다(scrollWidth ≤ clientWidth) — 전 패널', async ({ page }) => {
  const errs = await scene(page);
  const roster = await resolveRoster(page);
  const fails = []; let judged = 0;
  for (const kind of roster) {
    if (!kind.entryOk) continue;
    const r = await openKind(page, kind);
    if (r.err) continue;
    judged++; for (const b of await clippedRows(page)) fails.push(`${kind.cls}: ${b}`);
  }
  for (const [name, open] of Object.entries(MANUAL)) {
    if (!open) continue;
    await page.evaluate(open); judged++;
    for (const b of await clippedRows(page)) fails.push(`${name}: ${b}`);
  }
  expect(judged, '[전제] 로스터 + 수동 입구를 다 쟀다').toBeGreaterThan(30);
  expect(fails).toEqual([]);
  expect(errs, errs.join(' | ')).toEqual([]);
});
test('G3b ★양성대조 — 칸 넷짜리 줄을 넣으면 G3 판정이 잡는다(잘린 줄 1)', async ({ page }) => {
  await scene(page);
  const r = await openKind(page, { cls: 'bridge-block', entry: 'addBridgeBlock' });
  expect(r.err, '[전제] 브릿지를 넣었다').toBeUndefined();
  expect(await clippedRows(page), '[전제] 정본 패널은 잘림 0').toEqual([]);
  await page.evaluate(() => { const body = document.querySelector('#panel-right .panel-body .prop-section[data-sec] > .prop-sec-body');
    body.insertAdjacentHTML('beforeend', '<div class="prop-row" id="g3b-wide"><span class="prop-label">W</span><input type="number" class="prop-number"><span class="prop-label" style="width:56px">H</span><input type="number" class="prop-number"><input type="number" class="prop-number"></div>'); });
  expect((await clippedRows(page)).join(' | '), '★넘친 줄을 못 잡는다').toMatch(/›W sw\d+>cw\d+/);   // 넣은 줄 = 라벨 W · H 라벨은 인라인 56 이라 둘째 라벨 규칙이 못 줄임
});
