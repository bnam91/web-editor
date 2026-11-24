/* label-preset-0913.dom.spec.js — t3-01 라벨 블럭 «내 프리셋» (패널 js/props/prop-label-group.js · 저장소 js/label-presets.js · 2026-11-13 워커2)
 * 칸
 *   P1 등록 — 태그 꼴을 바꾸고 «현재 꼴 저장» → 이름 → 확인: «내 프리셋» optgroup 에 ★이름 · select 가 그걸 가리킴 · 저장소 1건
 *   P2 불러오기 — 다른 블럭의 태그에 그 프리셋 고르기 = 같은 꼴(배경·글자·테두리·모서리·높이) · «전체 적용» = 블럭 간격까지
 *   P3 수정 — 덮어쓰기(꼴 교체 · 같은 id) · 이름 변경(같은 id · 보기 글 바뀜)
 *   P4 삭제 — 한 번 누르면 «삭제?»(안 지움) · 두 번째에 지움 · 그 optgroup 이 사라짐
 *   P5 재시작 뒤 유지 — 저장 → page.reload() → 패널을 다시 열면 그 프리셋이 있고 적용된다
 *   P6 기본 프리셋 무손상 — 사용자 프리셋이 있어도 «기본» 4종 그대로 · Outline 적용 = 옛 동작(배경 투명·테두리 · 모서리 안 건드림)
 *       · 기본을 고르면 수정/삭제 줄이 안 보인다
 *   P7 (dev 꼴) 새 줄은 옛 «Style» 절 안에만 산다 — 절 수·절 제목 순서 무변 · 기존 id(lg-style-select·lg-apply-all-btn 등) 그대로
 *      ★우측패널 가지판(36cb754d8)의 P7 은 패널 틀 게이트(judgePanel)였다 — dev 엔 그 틀(_panel-frame·_panel-sections)이 없어
 *        해당 없음 ⇒ dev 의 옛 패널 모양을 직접 단언한다.
 *      ★rp-on-dev(261118 ⓑ): 우측 패널 통일(U2) 로 틀이 들어와 절 = data-sec key — 옛 제목 → 절 key 로 셀렉터만 따라감(재는 뜻 같음):
 *        Style → kind · Align+Spacing → layout · Height (All) → size · Selected Tag → size(태그 높이)·appearance(모서리)·fill(색). 머리(블록 헤더) = data-sec 없는 절 = null.
 *   P8 (0.9.12 열차 이식 · 충돌 «양쪽 다 살림» 지킴) 모양 변수(B1)에 묶인 칸에 기본 프리셋 → 묶임 끊김(data-label-shape 없음)
 *      · clipPath 비움(var 참조 떨어짐) · 프리셋 값이 그려짐 · 그 뒤 변수를 고쳐도 그 칸은 안 따라감
 *      ⇒ CTL: prop-label-group.js _applyPresetToItem 의 `if (item.dataset.labelShape) { delete … clipPath = ''; }` 줄을 지우면 P8 빨강
 * 양성대조(돌릴 사람이 확인): prop-label-group.js 의 `_wireLabelUserPresets(block, selectedItem, styleSelect);` 호출 줄을 지우면
 *   P1·P3·P4·P5 빨강(저장 버튼이 무동작 · 저장소 0건) · P6 의 기본 4종 단언은 초록.
 *   `<optgroup label="내 프리셋">` 묶음을 지우면 P1·P2·P5 빨강(고를 항목 없음).
 * 앱 통째(bootApp) · 헤드리스 · CDP·라이브 인스턴스 무접촉.
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const KEY = 'goditor_label_presets';
const SEC = '<div class="section-block" id="sL" data-section="1" data-name="라벨"><div class="section-hitzone"></div><div class="section-inner">'
  + '<div class="gap-block" data-type="gap" style="height:30px"></div></div></div>';

async function setup(page) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(({ sec, key }) => {
    try { localStorage.removeItem(key); } catch {}
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    c.insertAdjacentHTML('beforeend', sec);
    window.rebindAll?.(); window.applyZoom?.(100);
    window.selectSection(document.getElementById('sL'));
    window.addLabelGroupBlock(); window.selectSection(document.getElementById('sL')); window.addLabelGroupBlock();
    const [a, b] = document.querySelectorAll('#sL .label-group-block');
    a.id = 'lgA'; b.id = 'lgB';
    /* 사용자가 꾸민 꼴(패널 칸이 쓰는 것과 같은 인라인·data) */
    const t = a.querySelector('.label-item');
    t.id = 'tA'; t.style.backgroundColor = '#ff0000'; t.dataset.bg = '#ff0000'; t.style.color = '#00ff00'; t.dataset.color = '#00ff00';
    t.style.borderRadius = '8px'; t.dataset.radius = '8'; t.style.paddingTop = '6px'; t.style.paddingBottom = '6px';
    a.style.gap = '14px';
    b.querySelectorAll('.label-item').forEach((x, i) => { x.id = 'tB' + i; });
  }, { sec: SEC, key: KEY });
  expect(await page.locator('#sL .label-group-block').count(), '[전제] 라벨 블럭 둘').toBe(2);
  return errs;
}
const openPanel = (page, blockId, itemId) => page.evaluate(({ blockId, itemId }) => {
  window.showLabelGroupProperties(document.getElementById(blockId), itemId ? document.getElementById(itemId) : null);
}, { blockId, itemId });
const store = (page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || '[]'), KEY);
const look = (page, id) => page.evaluate((id) => {
  const e = document.getElementById(id); const cs = getComputedStyle(e);
  return { bg: cs.backgroundColor, color: cs.color, radius: e.style.borderRadius, padT: e.style.paddingTop, padB: e.style.paddingBottom, border: e.style.border };
}, id);
const userOptions = (page) => page.evaluate(() => [...document.querySelectorAll('#lg-style-select optgroup[label="내 프리셋"] option')].map((o) => ({ value: o.value, text: o.textContent.trim() })));
const builtinOptions = (page) => page.evaluate(() => [...document.querySelectorAll('#lg-style-select optgroup[label="기본"] option')].map((o) => o.value));

async function saveAs(page, name) {
  await page.click('#lg-preset-save-btn');
  await expect(page.locator('#lg-preset-name-input'), '이름 줄이 열린다').toBeVisible();
  await page.fill('#lg-preset-name-input', name);
  await page.click('#lg-preset-name-ok');
}
const RED = { bg: 'rgb(255, 0, 0)', color: 'rgb(0, 255, 0)', radius: '8px', padT: '6px', padB: '6px' };

test('P1 등록 — 내 프리셋에 ★이름 · select 가 가리킴 · 저장소 1건', async ({ page }) => {
  const errs = await setup(page);
  await openPanel(page, 'lgA', 'tA');
  expect(await userOptions(page), '[전제] 내 프리셋 없음').toEqual([]);
  await saveAs(page, '빨강 알약');
  const s = await store(page);
  expect(s.length, '저장소 1건').toBe(1);
  expect(s[0].name).toBe('빨강 알약');
  expect(s[0].style).toMatchObject({ bg: '#ff0000', color: '#00ff00', radius: '8', padT: '6px', padB: '6px', shape: 'pill', gap: '14px' });
  expect(await userOptions(page)).toEqual([{ value: 'user:' + s[0].id, text: '★ 빨강 알약' }]);
  expect(await page.inputValue('#lg-style-select'), '방금 저장한 프리셋을 가리킨다').toBe('user:' + s[0].id);
  await expect(page.locator('#lg-preset-user-row'), '수정/삭제 줄이 보인다').toBeVisible();
  expect(errs).toEqual([]);
});

test('P2 불러오기 — 다른 블럭 태그에 같은 꼴 · 전체 적용은 간격까지', async ({ page }) => {
  const errs = await setup(page);
  await openPanel(page, 'lgA', 'tA');
  await saveAs(page, '빨강');
  const [{ id }] = await store(page);
  await openPanel(page, 'lgB', 'tB0');
  expect(await look(page, 'tB0'), '[전제] B 태그는 다른 꼴').not.toMatchObject(RED);
  await page.selectOption('#lg-style-select', 'user:' + id);
  expect(await look(page, 'tB0'), '★고른 태그가 같은 꼴').toMatchObject(RED);
  expect(await look(page, 'tB1'), '고른 태그만 바뀐다(기본 프리셋과 같은 규칙)').not.toMatchObject(RED);
  await page.click('#lg-apply-all-btn');
  expect(await look(page, 'tB1'), '전체 적용 — 나머지 태그도').toMatchObject(RED);
  expect(await page.evaluate(() => document.getElementById('lgB').style.gap), '전체 적용 — 블럭 간격까지').toBe('14px');
  expect(errs).toEqual([]);
});

test('P3 수정 — 덮어쓰기·이름 변경(같은 id)', async ({ page }) => {
  const errs = await setup(page);
  await openPanel(page, 'lgA', 'tA');
  await saveAs(page, '처음');
  const [{ id }] = await store(page);
  await page.evaluate(() => { const t = document.getElementById('tA'); t.style.backgroundColor = '#0000ff'; t.dataset.bg = '#0000ff'; });
  await page.click('#lg-preset-overwrite-btn');
  let s = await store(page);
  expect(s.length).toBe(1);
  expect(s[0].id, '같은 id').toBe(id);
  expect(s[0].style.bg, '★덮어쓴 꼴').toBe('#0000ff');
  await page.click('#lg-preset-rename-btn');
  await expect(page.locator('#lg-preset-name-input')).toHaveValue('처음');
  await page.fill('#lg-preset-name-input', '파랑');
  await page.press('#lg-preset-name-input', 'Enter');
  s = await store(page);
  expect(s.map((p) => [p.id, p.name]), '★이름만 바뀌고 id 그대로').toEqual([[id, '파랑']]);
  expect(await userOptions(page)).toEqual([{ value: 'user:' + id, text: '★ 파랑' }]);
  expect(await page.inputValue('#lg-style-select')).toBe('user:' + id);
  expect(errs).toEqual([]);
});

test('P4 삭제 — 두 번 눌러야 지운다', async ({ page }) => {
  const errs = await setup(page);
  await openPanel(page, 'lgA', 'tA');
  await saveAs(page, '지울 것');
  await page.click('#lg-preset-delete-btn');
  await expect(page.locator('#lg-preset-delete-btn')).toHaveText('삭제?');
  expect((await store(page)).length, '한 번 눌러선 안 지운다').toBe(1);
  await page.click('#lg-preset-delete-btn');
  expect(await store(page), '★두 번째에 지운다').toEqual([]);
  expect(await page.locator('#lg-style-select optgroup[label="내 프리셋"]').count(), '빈 묶음은 안 그린다').toBe(0);
  expect(await page.inputValue('#lg-style-select')).toBe('Default');
  await expect(page.locator('#lg-preset-user-row')).toBeHidden();
  expect(errs).toEqual([]);
});

test('P5 재시작 뒤 유지 — reload 후 다시 열어 적용', async ({ page }) => {
  await setup(page);
  await openPanel(page, 'lgA', 'tA');
  await saveAs(page, '남는다');
  const [{ id }] = await store(page);
  await page.reload();
  await page.waitForFunction(() => typeof window.rebindAll === 'function' && typeof window.showLabelGroupProperties === 'function', null, { timeout: 20000 });
  expect(await store(page), '★재시작 뒤 저장소 그대로').toEqual([expect.objectContaining({ id, name: '남는다' })]);
  await page.evaluate(() => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    c.insertAdjacentHTML('beforeend', '<div class="section-block" id="sR" data-section="1"><div class="section-hitzone"></div><div class="section-inner"><div class="gap-block" data-type="gap" style="height:30px"></div></div></div>');
    window.rebindAll?.(); window.selectSection(document.getElementById('sR')); window.addLabelGroupBlock();
    const b = document.querySelector('#sR .label-group-block'); b.id = 'lgR'; b.querySelector('.label-item').id = 'tR';
  });
  await openPanel(page, 'lgR', 'tR');
  expect(await userOptions(page)).toEqual([{ value: 'user:' + id, text: '★ 남는다' }]);
  await page.selectOption('#lg-style-select', 'user:' + id);
  expect(await look(page, 'tR'), '재시작 뒤에도 같은 꼴로 적용').toMatchObject(RED);
});

test('P6 기본 프리셋 무손상', async ({ page }) => {
  const errs = await setup(page);
  await openPanel(page, 'lgA', 'tA');
  await saveAs(page, 'Default');   // 기본과 같은 이름이어도 기본을 가리지 않는다
  expect(await builtinOptions(page), '★기본 4종 그대로').toEqual(['Default', 'Filled', 'Outline', 'Ghost']);
  await openPanel(page, 'lgB', 'tB0');
  await page.evaluate(() => { const t = document.getElementById('tB0'); t.style.borderRadius = '12px'; t.dataset.radius = '12'; });
  await page.selectOption('#lg-style-select', 'Outline');
  await expect(page.locator('#lg-preset-user-row'), '기본을 고르면 수정/삭제 줄이 없다').toBeHidden();
  const l = await look(page, 'tB0');
  expect(l.bg, 'Outline 배경 투명').toBe('rgba(0, 0, 0, 0)');
  expect(l.color).toBe('rgb(17, 17, 17)');
  expect(l.border).toBe('1.5px solid rgb(17, 17, 17)');
  expect(l.radius, '★기본 프리셋은 모서리를 안 건드린다(옛 동작)').toBe('12px');
  await page.selectOption('#lg-style-select', 'Default');
  expect((await look(page, 'tB0')).bg, '«Default» = 기본 검정(사용자 «Default» 아님)').toBe('rgb(17, 17, 17)');
  expect(errs).toEqual([]);
});

test('P7 (dev 꼴 → 틀) 새 줄은 Kind(옛 Style) 절 안 · 절 구성 무변', async ({ page }) => {
  const errs = await setup(page);
  await openPanel(page, 'lgA', 'tA');
  const sections = () => page.evaluate(() => [...document.querySelectorAll('#panel-right .prop-section')]
    .map((e) => e.dataset.sec ?? null));
  const before = await sections();
  /* ★기대 바뀜(Q1 · Q2 · 현빈 GO 261120) — kind 는 이름표 상자 안 띠 · size·layout 은 «Layout» 묶음 겉(data-sec 없음 = null) 안 몸 */
  /* ★기대 바뀜(Q37 · 현빈 GO 261120) — 모든 블럭 패널 끝에 블록 Template 절 */
  expect(before, '[전제] 틀 패널 절(옛 Style·Align·Spacing·Height (All)·Selected Tag)').toEqual([null, 'kind', null, 'size', 'layout', 'fill', 'appearance', 'template']);   // ★기대 바뀜(P-2 SECTION_ORDER v1 · 지디 승인)
  await saveAs(page, '모양');
  await page.click('#lg-preset-rename-btn');
  await expect(page.locator('#lg-preset-name-row')).toBeVisible();
  expect(await sections(), '★새 절이 안 생긴다').toEqual(before);
  const home = await page.evaluate(() => ['lg-style-select', 'lg-apply-all-btn', 'lg-preset-save-btn', 'lg-preset-user-row', 'lg-preset-name-row']
    .map((id) => document.getElementById(id)?.closest('.prop-section[data-sec]')?.dataset.sec ?? null));
  expect(home, '★프리셋 줄은 전부 Kind(옛 Style) 절 안').toEqual(['kind', 'kind', 'kind', 'kind', 'kind']);
  expect(errs).toEqual([]);
});

test('P8 모양 변수에 묶인 칸에 기본 프리셋 → 묶임 끊김 · clipPath 비움 · 변수를 고쳐도 안 따라감', async ({ page }) => {
  const errs = await setup(page);
  await page.evaluate(async () => {
    try { localStorage.removeItem('we_label_shapes_v1'); } catch {}
    await window.DesignSystem.restoreLabelShapesFromMeta(null);
    const spec = window.DesignSystem.setLabelShape('tagx', { kind: 'tag', bg: '#0000ff', color: '#ffffff' });
    window.LabelShape.bindLabelItem(document.getElementById('tA'), 'tagx', spec);
  });
  const pre = await page.evaluate(() => { const t = document.getElementById('tA'); return { shape: t.dataset.labelShape ?? null, clip: t.style.clipPath }; });
  expect(pre.shape, '[전제] 칸이 변수 tagx 에 묶임').toBe('tagx');
  expect(pre.clip, '[전제] clipPath = 변수 참조').toMatch(/^var\(--lshape-tagx-clip/);
  await openPanel(page, 'lgA', 'tA');
  await page.selectOption('#lg-style-select', 'Filled');
  const got = await page.evaluate(() => { const t = document.getElementById('tA'); return { shape: t.dataset.labelShape ?? null, clip: t.style.clipPath, bg: getComputedStyle(t).backgroundColor }; });
  expect(got, '★프리셋을 입히면 변수 묶임이 끊기고 clipPath 가 비어야 한다').toEqual({ shape: null, clip: '', bg: 'rgb(51, 51, 51)' });
  await page.evaluate(() => window.DesignSystem.setLabelShape('tagx', { kind: 'tag', bg: '#00ff00', color: '#ffffff' }));
  expect((await look(page, 'tA')).bg, '변수를 고쳐도 끊긴 칸은 프리셋 그대로').toBe('rgb(51, 51, 51)');
  expect(errs).toEqual([]);
});
