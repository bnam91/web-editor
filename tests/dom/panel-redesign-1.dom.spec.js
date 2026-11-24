/* panel-redesign-1 — 우측 패널 재설계 «적용 1차»(현빈 확정 261120 · PLAN.md «적용 1차 261120»). 항목마다 한 칸 + CTL 패치(_patches/prd1-*.patch).
 * ★CTL = 제품 코드를 옛 꼴로 되돌린 패치 — 그 패치를 붙인 판에서 해당 칸이 빨강이어야 이 칸이 무엇을 잰다(사람이 돌린다 · 붙여 두지 않는다).
 * 앱 통째(bootApp) · 헤드리스 · CDP·라이브 인스턴스 무접촉.
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const { addKind } = require('./_block-roster-294.js');

async function scene(page) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(async () => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); await window.addSection(); const sec = c.querySelector('.section-block'); window.__secEl = () => sec; window.clearHistory?.();
    /* ★기대 바뀜(기준판 통일 261122 · 실측): dev 판 addSection 은 기본 제목 글(«제목을 입력하세요»)을 같이 넣는다 — 이 칸들이 «글 블럭 전부»를 세면 그 글이 끼어 수·순서가 어긋났다 ⇒ 미리 있던 블럭에 표시(data-prd1-pre) · 셀 때 뺀다 */
    sec.querySelectorAll('[class*="-block"]').forEach((b) => { b.dataset.prd1Pre = '1'; }); });
  return errs;
}
async function open(page, cls, entry) {
  const r = await addKind(page, { cls, entry });
  expect(r.err, `[전제] ${cls} 를 넣었다`).toBeUndefined();
  await page.evaluate((id) => window.selectBlock(id), r.id);
  await expect(page.locator('#panel-right .prop-section[data-sec]').first(), `[전제] ${cls} 패널(틀)`).toBeAttached();
  return r.id;
}

/* ① 표준 절 머리 — 쉐브론·클릭 접기 없음 · role=heading aria-level=3. CTL prd1-01-chevron.patch(머리에 aria-expanded 되살림) · prd1-01b-heading.patch(heading 뺌) → 빨강 */
test('P1 절 머리 = 제목만 · 눌러도 안 접힘(텍스트 패널 모든 절)', async ({ page }) => {
  const errs = await scene(page);
  await open(page, 'text-block', 'addTextBlock');
  const r = await page.evaluate(() => [...document.querySelectorAll('#panel-right .prop-section[data-sec] > .prop-sec-head > .prop-section-title')]
    .map((h) => ({ id: h.id, svg: h.querySelectorAll('svg').length, exp: h.getAttribute('aria-expanded'), role: h.getAttribute('role'), lv: h.getAttribute('aria-level') })));
  expect(r.length, '[전제] 절 머리가 있다').toBeGreaterThan(3);
  for (const h of r) expect([h.id, h.svg, h.exp, h.role, h.lv], `★${h.id} 에 접기 손잡이가 남았거나 heading 이 아니다`).toEqual([h.id, 0, null, 'heading', '3']);
  for (const h of r) {
    await page.locator(`#${h.id}`).click();
    await expect(page.locator(`#${h.id.replace(/-head$/, '-body')}`), `★${h.id} 를 누르니 몸이 숨었다`).not.toHaveAttribute('hidden', '');
  }
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* ② 절 제목 색 한 규칙(빈 절도) + 간격 12 · 12 · 16. CTL prd1-02-title.patch(제목 색 토큰을 --ui-text-sub 로) → 빨강 */
test('P2 모든 절 제목 색 = --ui-text(빈 Stroke·Effects 도) · 머리 위아래 = --ui-space-3', async ({ page }) => {
  const errs = await scene(page);
  await open(page, 'text-block', 'addTextBlock');
  const r = await page.evaluate(() => {
    const probe = document.createElement('span'); probe.style.color = 'var(--ui-text)'; document.body.appendChild(probe);
    const want = getComputedStyle(probe).color; probe.remove();
    const sp3 = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ui-space-3'));
    return { want, sp3, heads: [...document.querySelectorAll('#panel-right .prop-section[data-sec] > .prop-sec-head > .prop-section-title')].map((h) => {
      const t = h.querySelector('.prop-sec-title-text'), cs = getComputedStyle(h);
      return { id: h.id, color: getComputedStyle(t).color, op: getComputedStyle(t).opacity, pt: parseFloat(cs.paddingTop), pb: parseFloat(cs.paddingBottom) };
    }) };
  });
  expect(r.heads.map((h) => h.id), '[전제] 빈 절(Effects) 머리도 쟀다').toContain('txt-fx-section-head');
  for (const h of r.heads) expect([h.id, h.color, h.op, h.pt, h.pb], `★${h.id} 제목 색·간격`).toEqual([h.id, r.want, '1', r.sp3, r.sp3]);
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* ⑦ 숫자 칸 스피너 없음 · ↑↓ 키로 값이 바뀐다. CTL prd1-07-spin.patch(스피너 걷는 규칙 삭제) → 빨강 */
test('P7 우측 패널 숫자 칸 — 스피너 없음(appearance textfield) · ↑ 키로 1 오른다', async ({ page }) => {
  const errs = await scene(page);
  await open(page, 'text-block', 'addTextBlock');
  const ap = await page.evaluate(() => [...document.querySelectorAll('#panel-right input[type="number"]')].map((i) => getComputedStyle(i).appearance));
  expect(ap.length, '[전제] 숫자 칸이 있다').toBeGreaterThan(3);
  expect([...new Set(ap)], '★스피너가 남은 숫자 칸').toEqual(['textfield']);
  const n = page.locator('#txt-rot-number');   /* ★2026-11-24 기대 바뀜 — 표준 Position 6-2(현빈 확정 · 0.9.14 73행 P2): 흐름 안 X/Y = «있음 + disabled»(숨김 아님) — 흐름 글의 X 칸은 disabled ⇒ ↑ 키 단언은 같은 패널의 쓰는 숫자 칸(회전)으로 */
  const v0 = Number(await n.inputValue());
  await n.focus();
  await page.keyboard.press('ArrowUp');
  await expect.poll(async () => Number(await n.inputValue()), '★↑ 키로 값이 안 바뀐다').toBe(v0 + 1);
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* ⑪ 정렬 · B I U S 켜짐 = Figma 식(파란 채움 없음) · 다른 묶음은 그대로. CTL prd1-11-active.patch(규칙 삭제) → 빨강 */
test('P11 켜진 정렬·B 단추 = border-mid 바탕 · border-strong 테두리 · ui-text 글자 / 대조: 타입 단추는 파란 채움 그대로', async ({ page }) => {
  const errs = await scene(page);
  await open(page, 'text-block', 'addTextBlock');
  /* ★기대 바뀜(기준판 통일 261122 · 실측): dev 판의 H1 은 굵게(B)가 처음부터 켜져 있다 — 누르면 꺼져 엉뚱한 켜진 단추를 쟀다 ⇒ 꺼져 있을 때만 켠다 */
  const bOn0 = await page.locator('#txt-style-group .prop-style-btn').first().evaluate((b) => b.classList.contains('active'));
  if (!bOn0) await page.locator('#txt-style-group .prop-style-btn').first().click();   // B 켜기
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => {}))));   // 색 transition 이 끝난 뒤 잰다(누른 직후 = 옛 색)
  const r = await page.evaluate(() => {
    const tok = (n, prop = 'color') => { const p = document.createElement('span'); p.style[prop] = `var(${n})`; document.body.appendChild(p); const v = getComputedStyle(p)[prop]; p.remove(); return v; };
    const look = (el) => { const cs = getComputedStyle(el); return [cs.backgroundColor, cs.borderTopColor, cs.color]; };
    return { want: [tok('--ui-sel-neutral-on-bg', 'backgroundColor'), tok('--ui-sel-neutral-on-border'), tok('--ui-sel-neutral-on-text')],   /* 현빈 261123 «2단 밝게» */
      align: look(document.querySelector('#txt-align-group .prop-align-btn.active')),
      style: look(document.querySelector('#txt-style-group .prop-style-btn.active')),
      kind: getComputedStyle(document.querySelector('.prop-type-btn.active[data-cls]')).backgroundColor, accent: tok('--ui-accent-primary', 'backgroundColor') };
  });
  expect(r.align, '★정렬 켜짐').toEqual(r.want);
  expect(r.style, '★B 켜짐').toEqual(r.want);
  expect(r.kind, '★세그먼트(타입) 켜짐도 같은 중립 회색(현빈 261123)').toBe(r.want[0]);
  expect(r.want[0], '[대조] 중립 켜짐 ≠ 파랑').not.toBe(r.accent);
  if (!bOn0) await page.locator('#txt-style-group .prop-style-btn').first().click();   // 되돌림(켰을 때만)
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* ⑩ 텍스트 패널 «Font»·«글자색» 라벨 글 없음 · 칸은 그대로 · 색 칸이 줄 폭을 쓴다. CTL prd1-10-labels.patch(fontLabel:false 빼기) → 빨강 */
test('P10 텍스트 패널 — «Font»·«글자색» 라벨 없음 · 고르개 · 색 칸 그대로 · 색 칸 왼쪽 = 고르개 왼쪽', async ({ page }) => {
  const errs = await scene(page);
  await open(page, 'text-block', 'addTextBlock');
  const r = await page.evaluate(() => {
    const labs = [...document.querySelectorAll('#panel-right .prop-label, #panel-right .prop-field-label')].map((l) => l.textContent.trim());
    const fp = document.getElementById('txt-font-picker').getBoundingClientRect(), cf = document.getElementById('txt-color').closest('.prop-color-field').getBoundingClientRect();
    return { font: labs.includes('Font'), color: labs.includes('글자색'), dl: Math.round(cf.left - fp.left) };
  });
  expect([r.font, r.color], '★라벨 글이 남았다').toEqual([false, false]);
  expect(Math.abs(r.dl), '★색 칸이 라벨 자리만큼 들여졌다').toBeLessThanOrEqual(1);
  await expect(page.locator('#txt-font-trigger')).toHaveAttribute('aria-label', 'Font');
  await expect(page.locator('#txt-color')).toHaveAttribute('aria-label', '글자색');
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* ⑥ 텍스트 Size — 너비 칸 · 라벨 끌기 · 높이 꺼짐(auto · 흐림). CTL prd1-06-scrub.patch(끌기 배선 삭제) → 빨강 */
test('P6 텍스트 Size — 너비 라벨을 오른쪽으로 끌면 너비가 는다 · ⌘Z 한 번에 되돌아감 · 높이 칸 꺼짐 auto 흐림', async ({ page }) => {
  const errs = await scene(page);
  const id = await open(page, 'text-block', 'addTextBlock');
  const h = page.locator('#txt-height-number');
  await expect(h).toBeDisabled();
  await expect(h).toHaveAttribute('placeholder', '자동');   // ★기대 바뀜(표준 Appearance/Layout · 현빈 261124 L-4/7 슬라이더 걷음 · C3) — 높이 칸 = 부품 h.auto(placeholder «자동»)
  expect(await page.evaluate(() => getComputedStyle(document.getElementById('txt-height-number').closest('.prop-icon-input')).opacity),
    '★꺼진 높이 칸이 안 흐리다').toBe(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--ui-disabled-opacity').trim()));
  const w0 = Number(await page.locator('#txt-width-number').inputValue());
  const box = await page.locator('#txt-width-number-scrub').boundingBox();   // ★기대 바뀜(표준 Appearance/Layout · 현빈 261124 L-4/7 슬라이더 걷음 · C3) — 라벨 끌기 손잡이 = 부품 #<칸 id>-scrub
  /* QA 경2 — 오른쪽 단추로 끌면 안 바뀐다 */
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(box.x + box.width / 2 + 20, box.y + box.height / 2, { steps: 4 });
  await page.mouse.up({ button: 'right' });
  /* ★기대 그대로 · 걸음만 바뀜(261123 실측): 오른쪽 끌기 뒤 열리는 메뉴 0 — 옛 Escape(메뉴 닫기용)는 지금 판에선 «선택 풀기»라 패널이 Page 로 바뀌어 너비 칸이 사라졌다 ⇒ 누르지 않는다 */
  expect(await page.evaluate(() => document.querySelectorAll('#canvas .selected').length), '[전제] 오른쪽 끌기가 선택을 안 풀었다').toBeGreaterThan(0);
  expect(Number(await page.locator('#txt-width-number').inputValue()), '★오른쪽 단추 끌기로 너비가 바뀌었다').toBe(w0);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 20, box.y + box.height / 2, { steps: 4 });
  await page.mouse.up();
  await expect.poll(async () => Number(await page.locator('#txt-width-number').inputValue()), '★라벨을 끌어도 너비가 안 바뀐다').toBe(Math.min(860, w0 + 20));
  const after = await page.evaluate((id) => { const b = document.getElementById(id); return b.closest('.row')?.style.width || b.closest('.frame-block[data-text-frame="true"]')?.style.width || b.style.width; }, id);   // ★쓰는 자리 = prop-text-wireup-position.js 와 같은 차례(줄 → 글 프레임 → 글)
  expect(after, '★끈 값이 블럭에 안 썼다').toBe(Math.min(860, w0 + 20) + 'px');
  await page.evaluate(() => window.undo());
  await expect.poll(() => page.evaluate((id) => { const b = document.getElementById(id); return b.closest('.row')?.style.width || b.closest('.frame-block[data-text-frame="true"]')?.style.width || b.style.width; }, id), '★⌘Z 한 번에 안 돌아간다').not.toBe(after);
  /* QA 경1 — 너비 칸을 누르면 값 전체가 골라져 친 글이 덮어쓴다(.prop-number · editor.js _AUTO_SELECT_SEL) */
  await page.locator('#txt-width-number').click();
  await page.keyboard.type('300');
  await expect(page.locator('#txt-width-number'), '★누른 뒤 친 값이 옛 값 뒤에 붙었다(전체선택 안 됨)').toHaveValue('300');
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* ④ 텍스트 — Layout(가로 정렬)이 Size 위 · 게이트 판정(그 패널 순서) 통과. CTL prd1-04-order.patch(panel:'text' 빼기) → 빨강 */
test('P4 텍스트 패널 절 순서 Position → Layout(정렬) → Size → Padding · 게이트 위반 0', async ({ page }) => {
  const { loadSectionSpec, readPanel, judgePanel } = require('./_panel-sections.js');
  const errs = await scene(page);
  await open(page, 'text-block', 'addTextBlock');
  const secs = await page.evaluate(() => [...document.querySelectorAll('#panel-right .prop-section[data-sec]')].map((s) => s.dataset.sec)
    .filter((k) => ['position', 'size', 'layout', 'padding'].includes(k)));
  expect(secs, '★텍스트 Layout(정렬)이 Size 위가 아니다').toEqual(['position', 'layout', 'size', 'padding']);
  expect(await page.evaluate(() => document.getElementById('txt-align-group').closest('.prop-section[data-sec]').dataset.sec)).toBe('layout');
  const SPEC = loadSectionSpec();
  expect(judgePanel(await readPanel(page, SPEC), SPEC), '게이트 판정').toEqual([]);
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* ⑫ 타입 12칸 두 줄 · 칸마다 네 테두리(Quote 포함) · 묶음 가로 넘침 0 · H3 누르면 바뀐다. CTL prd1-12-kind.patch(칸 테두리 규칙 삭제) → 빨강 */
test('P12 텍스트 타입 12칸 — 두 줄 · Quote 왼 테두리 있음 · 넘침 0 · H3 로 바꾸기', async ({ page }) => {
  const errs = await scene(page);
  const id = await open(page, 'text-block', 'addTextBlock');
  const r = await page.evaluate(() => {
    const g = document.getElementById('txt-kind-group'), bs = [...g.children];
    return { n: bs.length, rows: new Set(bs.map((b) => Math.round(b.getBoundingClientRect().top))).size,
      left: bs.map((b) => [b.textContent.trim(), parseFloat(getComputedStyle(b).borderLeftWidth)]), over: g.scrollWidth - g.clientWidth,
      rowGap: bs[bs.length - 1].offsetTop - (bs[0].offsetTop + bs[0].offsetHeight),   // 레이아웃 px(배율 무관 · dom-screen-px-census) — 두 칸 같은 offsetParent
      tok: parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ui-space-1')),
      cols: bs.slice(0, 6).map((b, i) => b.offsetLeft === bs[i + 6].offsetLeft) };   // 레이아웃 px(같은 offsetParent)
  });
  expect(r.n).toBe(12);
  expect(r.rows, '★두 줄이 아니다').toBe(2);
  for (const [t, w] of r.left) expect(w, `★«${t}» 왼 테두리가 없다`).toBeGreaterThan(0);
  expect(r.over, '★타입 묶음이 가로로 넘친다').toBeLessThanOrEqual(0);
  /* ★기대 바뀜(시안 v10 ① — 6 × 2 · 위아래 같은 세로 칸 · 줄 사이 4px) */
  expect(Math.abs(r.rowGap - r.tok), `★두 줄 사이 ≠ --ui-space-1 ${r.rowGap}`).toBeLessThanOrEqual(0.5);
  expect(r.cols, '★위아래 칸이 같은 세로 칸에 안 선다(6 × 2)').toEqual([true, true, true, true, true, true]);
  await page.click('#txt-kind-group [data-cls="tb-h3"]');
  await expect.poll(() => page.evaluate((id) => !!document.querySelector(`#${id} .tb-h3`), id), '★H3 로 안 바뀐다').toBe(true);
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* ⑤ 텍스트 좌우패딩 사슬 — 잠금 한 줄 ↔ 풂 세 줄 · 사슬 자리 그대로 · 잠금 저장(Q26: 풀고 좌 = 우 로 맞춰도 다시 열면 풀림).
 *   CTL prd1-05-lock.patch(prop-text.js 가 저장값을 안 읽고 «좌 = 우 이면 잠금»으로) → 빨강 */
const padRows = (page) => page.evaluate(() => ({
  ph: getComputedStyle(document.getElementById('txt-ph-number')).visibility,   /* ★기대 바뀜(표준 Appearance/Layout · 현빈 261124 L-4/7 슬라이더 걷음 · C3) — 잠금 한 줄 = 칸 */ pl: document.getElementById('txt-pl-row').hidden, pr: document.getElementById('txt-pr-row').hidden,
  pressed: document.getElementById('txt-ph-chain').getAttribute('aria-pressed'), x: Math.round(document.getElementById('txt-ph-chain').getBoundingClientRect().left) }));
const linkedOf = (page, id) => page.evaluate((id) => document.getElementById(id).dataset.padXLinked ?? null, id);
const setNum = (page, sel, v) => page.evaluate(([sel, v]) => { const n = document.querySelector(sel); n.value = String(v); n.dispatchEvent(new Event('input', { bubbles: true })); n.dispatchEvent(new Event('change', { bubbles: true })); }, [sel, v]);

test('P5a 좌우패딩 — 잠금 한 줄이 둘을 같이 · 사슬 → 세 줄 · 사슬 자리 그대로 · 풀고 좌 = 우 여도 다시 열면 풀림', async ({ page }) => {
  const errs = await scene(page);
  const id = await open(page, 'text-block', 'addTextBlock');
  const a = await padRows(page);
  expect([a.ph, a.pl, a.pr, a.pressed], '[전제] 새 글(좌 0 = 우 0 · 저장 없음) = 잠금 한 줄').toEqual(['visible', true, true, 'true']);
  await setNum(page, '#txt-ph-number', 16);
  expect(await page.evaluate((id) => { const b = document.getElementById(id); return [b.style.paddingLeft, b.style.paddingRight]; }, id), '★한 줄이 둘을 같이 안 바꾼다').toEqual(['16px', '16px']);
  await page.click('#txt-ph-chain');
  const b = await padRows(page);
  expect([b.ph, b.pl, b.pr, b.pressed], '★풀었는데 세 줄(빈 윗줄 + 좌측 + 우측)이 아니다').toEqual(['hidden', false, false, 'false']);
  expect(b.x, '★사슬이 움직였다').toBe(a.x);
  expect(await linkedOf(page, id), '★풂이 블럭에 안 적혔다').toBe('0');
  await setNum(page, '#txt-pl-number', 24); await setNum(page, '#txt-pr-number', 24);   // 일부러 좌 = 우
  await page.evaluate((id) => { window.deselectAll?.(); window.selectBlock(id); }, id);   // 다시 열기
  expect((await padRows(page)).pressed, '★풀어 둔 것을 «좌 = 우» 로 잠갔다(Q26)').toBe('false');
  /* QA 경3 — 다시 연 풂 패널의 사슬 그림 = 끊긴 사슬(aria-pressed 와 같은 뜻) */
  expect(await page.evaluate(() => document.querySelector('#txt-ph-chain line').getAttribute('x1')), '★풂으로 다시 열었는데 이어진 사슬 그림').toBe('5.2');
  await page.click('#txt-ph-chain');
  expect([(await padRows(page)).pressed, await linkedOf(page, id)]).toEqual(['true', '1']);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('P5b 잠금 저장 — ⌘Z/⌘⇧Z · 복사-붙여넣기 · ⌘D · 저장→다시 열기 · 템플릿 저장에 data-pad-x-linked 가 같이 간다', async ({ page }) => {
  const errs = await scene(page);
  const id = await open(page, 'text-block', 'addTextBlock');
  await page.click('#txt-ph-chain');   // 풂 → '0'
  expect(await linkedOf(page, id)).toBe('0');
  await page.evaluate(() => window.undo());
  expect(await linkedOf(page, id), '★⌘Z 가 풂을 안 되돌린다').not.toBe('0');
  await page.evaluate(() => window.redo());
  expect(await linkedOf(page, id), '★⌘⇧Z 가 풂을 안 되살린다').toBe('0');
  const kids = (page) => page.evaluate(() => [...document.querySelectorAll('.text-block:not([data-prd1-pre])')].map((b) => b.dataset.padXLinked ?? null));
  // 복사-붙여넣기
  await page.evaluate((id) => { window.deselectAll?.(); window.selectBlock(id); window.copySelected(); }, id);
  await page.keyboard.press('Meta+v');
  await expect.poll(async () => (await kids(page)).length, '[전제] 붙여넣었다').toBe(2);
  expect(await kids(page), '★붙여넣은 글이 풂을 잃었다').toEqual(['0', '0']);
  // ⌘D
  await page.evaluate((id) => { window.deselectAll?.(); window.selectBlock(id); }, id);
  await page.keyboard.press('Meta+d');
  await expect.poll(async () => (await kids(page)).length, '[전제] 복제했다').toBe(3);
  expect(await kids(page), '★복제한 글이 풂을 잃었다').toEqual(['0', '0', '0']);
  // 저장 → 다시 열기
  const back = await page.evaluate(() => { const d = JSON.parse(window.serializeProject()); document.getElementById('canvas').innerHTML = ''; window.applyProjectData(d); window.clearHistory?.();
    return [...document.querySelectorAll('.text-block:not([data-prd1-pre])')].map((b) => b.dataset.padXLinked ?? null); });
  expect(back, '★저장→다시 열기에서 풂을 잃었다').toEqual(['0', '0', '0']);
  await page.evaluate(() => { const b = document.querySelector('.text-block:not([data-prd1-pre])'); window.deselectAll?.(); window.selectBlock(b.id); });
  expect((await padRows(page)).pressed, '★다시 연 글의 패널이 잠금으로 열렸다').toBe('false');
  // 템플릿 저장(섹션)
  await tplStub(page);
  const tpl = await page.evaluate(async () => { const S = document.querySelector('.section-block'); await window.saveAsTemplate(S, 'prd1-p5b', '기타', '', [], 'section'); const t = window.loadTemplates().find((x) => x.name === 'prd1-p5b'); return t ? JSON.stringify(window.__tplBodies[t.id] ?? null) : null; });
  expect(tpl, '★템플릿에 data-pad-x-linked 가 없다').toMatch(/data-pad-x-linked=\\*"0/);
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* ⑤ 다른 블럭 패딩 이름(Q25) — 프레임·디바이더 줄 라벨. CTL 은 R5a(소스)로 갈음 */
test('P5c 디바이더 패널 Padding 절 «상하패딩»·«좌우패딩»', async ({ page }) => {
  const errs = await scene(page);
  await open(page, 'divider-block', 'addDividerBlock');
  /* ★기대 바뀜(표준 Layout · 현빈 261124 L-4/7 · C1 73c0063a9 · 탑 통합): 패딩 줄 = 표준 패딩 슬롯(작은 라벨 «Padding» + 가로 ↔ dvd-padx · 세로 ↕ dvd-pady 두 칸) — 옛 줄 이름 «상하패딩/좌우패딩» 은 칸 아이콘이 대신한다 */
  const o = await page.evaluate(() => {
    const sec = document.querySelector('#panel-right .prop-section[data-sec="padding"]');
    const slot = sec?.querySelector('[data-part="layout"][data-slot="pad"]');
    return { label: slot?.querySelector('.ui-s2-cell > span')?.textContent.trim() ?? null,
      x: !!slot?.querySelector('[data-field="layout-pad-x"] #dvd-padx-number'), y: !!slot?.querySelector('[data-field="layout-pad-y"] #dvd-pady-number'),
      old: [...(sec?.querySelectorAll('.prop-label') || [])].map((l) => l.textContent.trim()).filter((t) => /상하 ?패딩|좌우 ?패딩/.test(t)) };
  });
  expect(o, '★디바이더 패딩 = 표준 패딩 슬롯 · 옛 줄 이름 0').toEqual({ label: 'Padding', x: true, y: true, old: [] });
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* ⑧ 끝 옵션 칼럼 — 값 줄 끝이 한 자리 · 사슬과 머리 손잡이가 같은 칼럼. CTL prd1-08-optcol.patch(절 padding-right 규칙 삭제) → 빨강 */
test('P8 옵션 칼럼 — 상하패딩 숫자 끝 = 좌우패딩 숫자 끝 · 사슬 오른끝 = Position 머리 플로팅 단추 오른끝 · 칼럼 폭 = 토큰', async ({ page }) => {
  const errs = await scene(page);
  await open(page, 'text-block', 'addTextBlock');
  const r = await page.evaluate(() => {
    const R = (id) => document.getElementById(id).getBoundingClientRect();
    const probe = document.createElement('div'); probe.style.width = 'var(--ui-opt-col-w)'; document.body.appendChild(probe); const col = probe.getBoundingClientRect().width; probe.remove();
    /* ★기대 그대로 · 잴 자리만(261123 실측 9391): 절이 묶음(.prop-sec-group) 안 조각(.prop-sec-part[data-sec=padding])으로 바뀌어 «가장 가까운 data-sec» = 조각(칼럼 몫을 뺀 폭) — 절의 안쪽 오른끝은 묶음 쪽 */
    const sec = document.getElementById('txt-ph-row').closest('.prop-sec-group') || document.getElementById('txt-ph-row').closest('.prop-section[data-sec]');
    const sp2 = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ui-space-2'));
    return { pv: R('txt-pv-number').right, ph: R('txt-ph-number').right, chain: R('txt-ph-chain').right, ov: R('txt-overlay-toggle').right, col,
      inner: sec.getBoundingClientRect().right - sp2 };
  });
  expect(Math.abs(r.chain - r.inner), `★사슬이 절 안쪽 오른끝(칼럼 끝)에 안 선다 — 칼럼을 비워 두지 않았다 ${JSON.stringify(r)}`).toBeLessThanOrEqual(0.5);
  expect(r.col, '[전제] 토큰 폭').toBeGreaterThan(20);
  expect(Math.abs(r.pv - r.ph), `★값 줄 끝이 어긋난다 ${JSON.stringify(r)}`).toBeLessThanOrEqual(0.5);
  expect(Math.abs(r.chain - r.ov), `★사슬과 머리 손잡이가 같은 칼럼이 아니다 ${JSON.stringify(r)}`).toBeLessThanOrEqual(0.5);
  expect(Math.abs((r.chain - r.pv) - r.col), `★칼럼 폭 ≠ --ui-opt-col-w ${JSON.stringify(r)}`).toBeLessThanOrEqual(0.5);
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* ⑨ Stroke «＋» → 몸 펼침 · «−» → 접힘 / Effects «＋» → 종류를 고르면 카드. CTL prd1-09-plus.patch(＋/− 그림 바꿔 끼우는 CSS 삭제) → 빨강 */
test('P9 Stroke ＋ 누르면 두께·색·위치가 펼쳐지고 단추가 − · 다시 누르면 머리만 / Effects ＋ 에서 고르면 카드가 생긴다', async ({ page }) => {
  const errs = await scene(page);
  await open(page, 'text-block', 'addTextBlock');
  const add = page.locator('#txt-stroke-section label.prop-sec-add');
  const icon = () => page.evaluate(() => { const l = document.querySelector('#txt-stroke-section label.prop-sec-add'); const v = (c) => getComputedStyle(l.querySelector(c)).display !== 'none'; return { plus: v('.prop-sec-add-plus'), minus: v('.prop-sec-add-minus') }; });
  await expect(page.locator('#txt-stroke-controls'), '[전제] Stroke 꺼짐 = 머리만').toBeHidden();
  expect(await icon(), '★꺼진 Stroke 머리가 ＋ 가 아니다').toEqual({ plus: true, minus: false });
  await add.click();
  await expect(page.locator('#txt-stroke-controls'), '★＋ 를 눌렀는데 Stroke 가 안 펼쳐진다').toBeVisible();
  expect(await icon(), '★켜진 Stroke 머리가 − 가 아니다').toEqual({ plus: false, minus: true });
  await add.click();
  await expect(page.locator('#txt-stroke-controls'), '★− 를 눌렀는데 그대로다').toBeHidden();
  /* ★기대 바뀜(시안 v10) — ＋ 단추(22 · 끝 칼럼) → 종류 메뉴 → 항목 */
  expect(await page.evaluate(() => document.getElementById('txt-fx-add-btn').offsetWidth), '★Effects ＋ 폭(시안 22 · 레이아웃 px)').toBe(22);
  await page.click('#txt-fx-add-btn');
  await expect(page.locator('#txt-fx-menu'), '★메뉴가 안 뜬다').toBeVisible();
  const items = await page.locator('#txt-fx-menu [data-fx]').allTextContents();
  expect(items.length, '[전제] 더할 효과').toBeGreaterThan(0);
  await page.locator('#txt-fx-menu [data-fx]').first().click();
  await expect(page.locator('#txt-fx-list > *').first(), '★효과를 골랐는데 카드가 없다').toBeVisible();
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* ⑫ 매핑 교정(현빈 261120 · PLAN «텍스트 종류 12칸 매핑») — 중앙 플로팅 텍스트 메뉴로 만든 블럭마다 켜진 칸이 정확히 하나 · 맞는 칸.
 *   (Tags = 태그 블럭 · Quote = 인용구 블럭은 자기 패널이 따로라 여기 없다.) CTL prd1-12b-kind-map.patch(_kind = currentClass) → 말풍선·아이콘텍스트 빨강 */
test('P12b 메뉴로 만든 텍스트 블럭마다 켜진 타입 칸 = 정확히 하나 · 곡선/아이콘텍스트는 타입 칸 없음', async ({ page }) => {
  const errs = await scene(page);
  const CASES = [["addTextBlock('h2')", 'H2'], ["addTextBlock('body')", 'Body'], ["addTextBlock('caption')", 'Cap'], ["addTextBlock('bullet')", 'Bullet'],
    ["addTextBlock('label')", 'Label'], ["addSpeechBubbleBlock('left')", 'Bubble'],
    /* ★기대 바뀜(지디 261120 · 시안 v10 실측 — 아이콘텍스트 10 · 곡선 13 = 타입 칸 0): 그 둘엔 타입 절 없음 ⇒ 켜진 칸 [] · 묶음 없음 */
    ['addIconTextBlock()', null], ["addLinerBlock('arc-up')", null]];
  for (const [call, want] of CASES) {
    const got = await page.evaluate(async (call) => {
      const sec = window.__secEl(); window.deselectAll?.(); window.selectSection(sec);
      const before = new Set(document.querySelectorAll('.text-block, .icon-text-block'));
      await new Function(`return window.${call}`)();
      const b = [...document.querySelectorAll('.text-block, .icon-text-block')].find((x) => !before.has(x));
      if (!b) return { err: 'no block' };
      window.selectBlock(b.id);
      const on = [...document.querySelectorAll('#txt-kind-group .prop-type-btn.active')].map((x) => x.textContent.trim());
      return { on, group: !!document.getElementById('txt-kind-group') };
    }, call);
    expect(got.err, `[전제] ${call} 이 블럭을 만들었다`).toBeUndefined();
    if (want === null) expect(got.group, `★${call} — 시안에 없는 타입 칸 묶음이 생겼다`).toBe(false);
    else expect(got.on, `★${call} → 켜진 칸`).toEqual([want]);
  }
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* 라벨 크기 하나(시안 v9 #4) — ★기대 바뀜(지디 261120 전 패널): 텍스트 + 도형 패널에서 칸 위·칸 안 라벨 = .prop-label 크기.
 *   CTL prd1-13-labelfs.patch(.prop-field-label 정의를 fs-10 으로) → 빨강 */
for (const [cls, entry] of [['text-block', 'addTextBlock'], ['shape-block', 'addShapeBlock']]) test(`P13 ${cls} 패널 — 칸 위·칸 안 라벨 글자 크기 = .prop-label 크기`, async ({ page }) => {
  const errs = await scene(page);
  if (cls === 'shape-block') {
    /* ★기대 그대로 · 상태만(261123 실측): 도형 X/Y 칸 안 라벨은 «띄운»(overlayBlock) 도형에서만 그린다(overlay-float.js floatPositionRowHTML) — 쌓기 줄 도형 = 칸 라벨 Rotation 하나뿐 ⇒ 앱 길(OverlayFloat.enterFloat)로 띄우고 연다 */
    const r0 = await addKind(page, { cls, entry });
    expect(r0.err, '[전제] 도형을 넣었다').toBeUndefined();
    await page.evaluate((id) => { const OF = window.OverlayFloat, b = document.getElementById(id); OF.enterFloat(OF.posElOf(b)); window.deselectAll?.(); window.selectBlock(id); }, r0.id);
  } else await open(page, cls, entry);
  const r = await page.evaluate(() => {
    const fs = (el) => getComputedStyle(el).fontSize;
    const want = fs(document.querySelector('#panel-right .prop-section[data-sec] .prop-label'));
    const got = [...document.querySelectorAll('#panel-right .prop-section[data-sec] :is(.prop-field-label, .prop-xy-label)')].map((l) => [l.textContent.trim(), fs(l)]);
    return { want, got };
  });
  expect(r.got.length, '[전제] 칸 위·칸 안 라벨이 있다').toBeGreaterThan(2);
  for (const [t, f] of r.got) expect(f, `★«${t}» 라벨 크기`).toBe(r.want);
  /* ⑧ 덧 — 틀 절 색 줄은 넘치지 않는다(색 칸 바닥값 121 · 정적 렌더 실측 128곳 → 0). CTL prd1-08b-colorfield.patch → 빨강 */
  const over = await page.evaluate(() => [...document.querySelectorAll('#panel-right .prop-section[data-sec] .prop-color-row')].filter((e) => e.getClientRects().length && e.scrollWidth > e.clientWidth + 0.5).map((e) => e.textContent.trim().slice(0, 20)));
  expect(over, '★색 줄이 넘친다(«%» 칸 잘림)').toEqual([]);
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* 시안 v10 ⑤ — Fill 컬러 변수 칩 줄이 끝 칼럼까지 한 줄. CTL prd1-14-varrow.patch(규칙 삭제) → 빨강 */
test('P14 Fill VAR 칩 줄 — 오른끝 = 절 안쪽 오른끝(칼럼 끝) · 한 줄', async ({ page }) => {
  const errs = await scene(page);
  await open(page, 'text-block', 'addTextBlock');
  const r = await page.evaluate(() => {
    const row = document.getElementById('txt-color-chips');
    row.hidden = false;   // 컬러 변수가 없는 새 문서 — 칩 넷(앱 꼴)을 심어 줄 꼴만 잰다
    row.innerHTML = '<span class="cv-chips-label">VAR</span>' + ['메인', '보조', '강조'].map((t) => `<button class="cv-chip" type="button"><span class="cv-chip-dot"></span><span class="cv-chip-label">${t}</span></button>`).join('');
    const sec = row.closest('.prop-sec-group') || row.closest('.prop-section[data-sec]'), sp2 = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ui-space-2'));
    /* ★잼만 고침(261123 실측 9391): 라벨 «VAR» 는 칩보다 낮아 가운데 맞춤이면 top 이 4px 아래 — top 개수로 세면 한 줄도 «둘». 한 줄 = 모든 칸이 세로로 겹친다 */
    const kids = [...row.children].map((k) => k.getBoundingClientRect());
    const oneLine = Math.max(...kids.map((k) => k.top)) < Math.min(...kids.map((k) => k.bottom));
    return { right: row.getBoundingClientRect().right, inner: sec.getBoundingClientRect().right - sp2, lines: oneLine ? 1 : 2 };
  });
  expect(Math.abs(r.right - r.inner), `★칩 줄이 끝 칼럼까지 안 간다 ${JSON.stringify(r)}`).toBeLessThanOrEqual(0.5);
  expect(r.lines, '★칩 줄이 두 줄로 꺾였다').toBe(1);
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* Q2 Type 띠(시안 v10 · 현빈 GO 261120) — 텍스트 패널: 타입 12칸이 이름표 상자 안 · «Type» 머리 없음 · 게이트 0.
 *   CTL prd1-q2-band.patch(띠를 안 그림) → 빨강 */
test('P15 Type 띠 — 이름표 아래 · 머리 없음 · 12칸 · 게이트 위반 0', async ({ page }) => {
  const { loadSectionSpec, readPanel, judgePanel } = require('./_panel-sections.js');
  const errs = await scene(page);
  await open(page, 'text-block', 'addTextBlock');
  const r = await page.evaluate(() => {
    const band = document.getElementById('type-section'), box = band?.parentElement;
    const titles = [...document.querySelectorAll('#panel-right .prop-sec-title-text')].map((t) => t.textContent.trim());
    return { inHeader: !!box?.querySelector(':scope > .prop-block-label'), band: band?.classList.contains('prop-kind-band'), n: band?.querySelectorAll('.prop-type-btn').length, type: titles.includes('Type'), w: Math.round(band?.getBoundingClientRect().width || 0), lw: Math.round(box?.querySelector('.prop-block-label').getBoundingClientRect().width || 0) };
  });
  expect(r, '★Type 띠').toMatchObject({ inHeader: true, band: true, n: 12, type: false });
  expect(r.w, '★띠 폭 = 이름표 폭(시안 212)').toBe(r.lw);
  const SPEC = loadSectionSpec();
  expect(judgePanel(await readPanel(page, SPEC), SPEC), '게이트 판정').toEqual([]);
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* Q1 Layout 묶음(시안 v10 · 현빈 GO 261120) — 텍스트 · 프레임 · 갭: 머리 «Layout» 하나 · 작은 제목은 둘 이상일 때 Size/Padding · 게이트 0.
 *   CTL prd1-q1-group.patch(LAYOUT_GROUP 비움) → 빨강 */
for (const [cls, entry, subs] of [['text-block', 'addTextBlock', []] /* Padding 몸에도 부품 칸(태그 좌우 · 숨김이어도 DOM 에 있음) ⇒ «Padding» 작은 제목도 안 붙음 · ★기대 바뀜(표준 Appearance/Layout · 현빈 261124 L-4/7 슬라이더 걷음 · C3) — Size 몸 = 부품(data-part="layout" · 작은 라벨을 부품이 낸다) ⇒ «Size» 작은 제목 안 붙음(_panel-frame P 규칙) */, ['gap-block', 'addGapBlock', []]]) test(`P16 Layout 묶음 — ${cls}`, async ({ page }) => {
  const { loadSectionSpec, readPanel, judgePanel } = require('./_panel-sections.js');
  const errs = await scene(page);
  await open(page, cls, entry);
  const r = await page.evaluate(() => ({
    titles: [...document.querySelectorAll('#panel-right .prop-sec-title-text')].map((t) => t.textContent.trim()),
    groups: document.querySelectorAll('#panel-right .prop-sec-group').length,
    subs: [...document.querySelectorAll('#panel-right .prop-sec-sub')].map((t) => t.textContent.trim()),
  }));
  expect(r.titles.filter((t) => t === 'Layout').length, '★«Layout» 머리 하나').toBe(1);
  expect(r.titles.filter((t) => t === 'Size' || t === 'Padding'), '★Size/Padding 머리가 남았다').toEqual([]);
  expect(r.groups).toBe(1);
  expect(r.subs, '★작은 제목').toEqual(subs);
  const SPEC = loadSectionSpec();
  expect(judgePanel(await readPanel(page, SPEC), SPEC), '게이트 판정(묶음 몸 = 절)').toEqual([]);
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* Q17 · Q20(시안 v10 · 현빈 GO 261120) — 텍스트 회전 줄: 각도 칸(숫자 + °) · 90° · 좌우/상하 반전.
 *   반전 저장 = 회전 host(텍스트 프레임 또는 글 블럭) data-flip-h/v · 그림 = transform 끝 scale(±1, ±1).
 *   CTL prd1-q17-flip.patch(block-flip applyFlip 이 scale 을 안 붙임) → 빨강 */
const hostOf = (id) => `(() => { const b = document.getElementById(${JSON.stringify(id)}); return b.closest('.frame-block[data-text-frame="true"]') || b; })()`;
const flipOf = (page, id) => page.evaluate((h) => { const e = eval(h); return { h: e.dataset.flipH ?? null, v: e.dataset.flipV ?? null, t: e.style.transform }; }, hostOf(id));
test('P17a 텍스트 회전 줄 — 칸 꼴(시안 89 | 27·27·27) · 90° · 반전 · 회전과 한 transform · 다시 열기', async ({ page }) => {
  const errs = await scene(page);
  const id = await open(page, 'text-block', 'addTextBlock');
  const g = await page.evaluate(() => { const r = (s) => Math.round(document.querySelector(s).getBoundingClientRect().width);
    return { slider: !!document.getElementById('txt-rot-slider'), unit: document.querySelector('#txt-rot-number + .prop-unit')?.textContent, field: r('.prop-rot-row > .prop-icon-input'), btns: r('.prop-rot-row > .prop-rot-btns'), b1: r('#txt-rot-90'), spin: getComputedStyle(document.getElementById('txt-rot-number')).appearance }; });
  expect(g.slider, '★회전 슬라이더가 남았다(Q20)').toBe(false);
  expect(g.unit).toBe('°');
  expect(Math.abs(g.field - g.btns), `★반반이 아니다 ${JSON.stringify(g)}`).toBeLessThanOrEqual(1);
  expect(g.spin, '★스피너').toBe('textfield');
  const n = page.locator('#txt-rot-number');
  await n.focus(); await page.keyboard.press('ArrowUp');
  await expect(n, '★↑ 키로 1° 안 오른다').toHaveValue('1');
  await page.click('#txt-rot-90');
  await expect(n, '★90° 단추').toHaveValue('91');
  await page.click('#txt-flip-h');
  let f = await flipOf(page, id);
  expect([f.h, /rotate\(91deg\)/.test(f.t), /scale\(-1, 1\)/.test(f.t)], `★좌우 반전 ${JSON.stringify(f)}`).toEqual(['1', true, true]);
  await page.fill('#txt-rot-number', '-30'); await page.locator('#txt-rot-number').dispatchEvent('change');
  f = await flipOf(page, id);
  expect([/rotate\(-30deg\)/.test(f.t), /scale\(-1, 1\)/.test(f.t)], `★각도를 바꾸니 반전이 사라졌다 ${f.t}`).toEqual([true, true]);
  await page.click('#txt-flip-v');
  expect((await flipOf(page, id)).t).toMatch(/scale\(-1, -1\)/);
  await page.evaluate((id) => { window.deselectAll?.(); window.selectBlock(id); }, id);
  await expect(page.locator('#txt-flip-h'), '★다시 연 패널에 반전 켜짐이 없다').toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#txt-flip-v')).toHaveClass(/active/);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('P17b 반전 — ⌘Z/⌘⇧Z · 복사-붙여넣기 · ⌘D · 저장→다시 열기 · 블록 템플릿 저장 · 옛 저장본(키 없음)은 그대로', async ({ page }) => {
  const errs = await scene(page);
  const id = await open(page, 'text-block', 'addTextBlock');
  await page.click('#txt-flip-h');
  expect((await flipOf(page, id)).h).toBe('1');
  await page.evaluate(() => window.undo());
  expect((await flipOf(page, id)).h, '★⌘Z 가 반전을 안 되돌린다').toBeNull();
  await page.evaluate(() => window.redo());
  const re = await flipOf(page, id);
  expect([re.h, /scale\(-1, 1\)/.test(re.t)], '★⌘⇧Z 가 반전을 안 되살린다').toEqual(['1', true]);
  const all = () => page.evaluate(() => [...document.querySelectorAll('.text-block:not([data-prd1-pre])')].map((b) => { const e = b.closest('.frame-block[data-text-frame="true"]') || b; return [e.dataset.flipH ?? null, /scale\(-1, 1\)/.test(e.style.transform)]; }));
  await page.evaluate((id) => { window.deselectAll?.(); window.selectBlock(id); window.copySelected(); }, id);
  await page.keyboard.press('Meta+v');
  await expect.poll(async () => (await all()).length, '[전제] 붙여넣었다').toBe(2);
  await page.evaluate((id) => { window.deselectAll?.(); window.selectBlock(id); }, id);
  await page.keyboard.press('Meta+d');
  await expect.poll(async () => (await all()).length, '[전제] 복제했다').toBe(3);
  expect(await all(), '★붙여넣기/복제가 반전을 잃었다').toEqual([['1', true], ['1', true], ['1', true]]);
  const back = await page.evaluate(() => { const d = JSON.parse(window.serializeProject()); document.getElementById('canvas').innerHTML = ''; window.applyProjectData(d); window.clearHistory?.();
    return [...document.querySelectorAll('.text-block:not([data-prd1-pre])')].map((b) => { const e = b.closest('.frame-block[data-text-frame="true"]') || b; return [e.dataset.flipH ?? null, /scale\(-1, 1\)/.test(e.style.transform)]; }); });
  expect(back, '★저장→다시 열기에서 반전을 잃었다').toEqual([['1', true], ['1', true], ['1', true]]);
  /* 블록 템플릿 저장(우클릭 «블록 템플릿으로 저장»과 같은 함수) → 넣기 */
  await tplStub(page);
  const ins = await page.evaluate(async () => {
    const b = document.querySelector('.text-block:not([data-prd1-pre])'); await window.saveBlockAsTemplate(b, 'prd1-p17b', '블록', '');
    const t = window.loadTemplates().find((x) => x.name === 'prd1-p17b'); if (!t) return { err: 'no tpl' };
    const before = new Set(document.querySelectorAll('.text-block')); window.selectSection?.(document.querySelector('.section-block'));
    await window.insertTemplate(t);
    const nb = [...document.querySelectorAll('.text-block')].find((x) => !before.has(x)); if (!nb) return { err: 'not inserted' };
    const e = nb.closest('.frame-block[data-text-frame="true"]') || nb; return { h: e.dataset.flipH ?? null, s: /scale\(-1, 1\)/.test(e.style.transform) };
  });
  expect(ins, '★블록 템플릿 저장 → 넣기에서 반전을 잃었다').toEqual({ h: '1', s: true });
  /* 옛 저장본 — 반전 키 없는 회전 글: 패널을 열어도 transform·키 그대로 */
  const old = await page.evaluate(() => { const b = document.querySelector('.text-block'); const e = b.closest('.frame-block[data-text-frame="true"]') || b;
    delete e.dataset.flipH; e.style.transform = 'rotate(10deg)'; window.deselectAll?.(); window.selectBlock(b.id);
    return { t: e.style.transform, h: e.dataset.flipH ?? null, pressed: document.getElementById('txt-flip-h').getAttribute('aria-pressed') }; });
  expect(old, '★옛 저장본을 열기만 했는데 바뀌었다').toEqual({ t: 'rotate(10deg)', h: null, pressed: 'false' });
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* Q17 · Q20 — 다른 블럭 회전 줄(시안 v10 이 그린 블럭): 각도 칸만(슬라이더 0) · 반전 → host transform scale · 각도 바꿔도 반전 유지 · 다시 열기 켜짐.
 *   CTL prd1-q17-render.patch(모달 렌더러의 반전 다시 붙이기 삭제) → 모달 칸 빨강(다시 그린 뒤 반전이 사라진다) */
const { rosterOf } = require('./_block-roster-294.js');
/* ★기대 바뀜(기준판 통일 261122 · 실측): 이 표는 SECTION_BLOCK_TYPE_SEL 파생이라 ⑴ .frame-block 이 없고(프레임은 «그릇»이라 명부 밖) ⑵ .icon-block 의 앱 입구는 addIconifyBlock(이름·svg·크기 인자 · 이름 규칙 add<종>Block 밖)
   — 689f11401 에서도 같은 칸이 빨강이었다(가지 안 낡음). ⇒ 두 종만 입구를 적어 준다(나머지는 표 그대로) */
/* ★기대 바뀜(기준판 통일 261122 · 실측): 템플릿 «몸»(HTML)은 electronAPI.saveTemplateCanvas 로 따로 간다 — 하네스는 electronAPI 를 «null 만 돌려주는» 대리로 두어 몸이 어디에도 안 남았다(689f11401 에서도 빨강) ⇒ 저장·읽기만 메모리 대리로(앱이 실제로 넘긴 HTML 을 잰다) */
const tplStub = (page) => page.evaluate(() => { if (window.__tplBodies) return; const box = (window.__tplBodies = {}), orig = window.electronAPI;   // 하네스 electronAPI 는 get 덫 Proxy 라 속성 대입이 안 먹는다 ⇒ 두 이름만 바꾼 Proxy 로 감싼다
  const mine = { saveTemplateCanvas: async (id, html) => { box[id] = html; return true; }, loadTemplateCanvas: async (id) => box[id] ?? null };
  window.electronAPI = new Proxy({}, { get: (t, k) => (k in mine ? mine[k] : orig[k]) }); });
/* ★기대 바뀜(261123 실측): selectBlock 은 프레임을 못 고른다(block-edit.js getBlockById — 프레임은 패널 표 밖 · 설계) ⇒ 다른 spec 과 같은 꼴(.selected + showFrameProperties) */
const selFrame = (id) => { window.deselectAll?.(); const f = document.getElementById(id); f.classList.add('selected'); window.showFrameProperties(f); };
const kindOf = async (page, cls) => {
  if (cls === 'frame-block') return { cls, entry: 'addFrameBlock' };
  if (cls === 'icon-block') { await page.evaluate(() => { window.__addIconP17 = () => window.addIconifyBlock('mdi:star', '<svg viewBox="0 0 24 24"><path d="M12 2l3 7h7l-5.5 4.5L18 21l-6-4-6 4 1.5-7.5L2 9h7z"/></svg>', 64); }); return { cls, entry: '__addIconP17' }; }
  return (await rosterOf(page)).find((r) => r.cls === cls);
};
for (const [cls, p, num] of [['shape-block', 'shape', 'shape-rot-num'], ['modal-block', 'mdl', 'mdl-rot-number'], ['mockup-block', 'mkp', 'mkp-rot-number'],
  ['icon-circle-block', 'icb', 'icb-rot-number'], ['icon-block', 'icn', 'icn-rot-number'], ['zoom-block', 'zm', 'zm-rot-num']]) {
  test(`P17c ${cls} 회전 줄 — 각도 칸 · 90° · 좌우 반전 · 다시 그려도 · 다시 열기`, async ({ page }) => {
    const errs = await scene(page);
    const kind = (await kindOf(page, cls));
    expect(kind?.entry, `[전제] ${cls} 입구`).toBeTruthy();
    const r0 = await addKind(page, kind);
    expect(r0.err).toBeUndefined();
    await page.evaluate((id) => window.selectBlock(id), r0.id);
    await expect(page.locator(`#${num}`), '[전제] 각도 칸').toBeAttached();
    expect(await page.locator(`#${p}-rot-90`).count() + await page.locator(`#${p}-flip-h`).count(), '★단추').toBe(2);
    expect(await page.evaluate(() => document.querySelectorAll('#panel-right .prop-rot-row .prop-slider').length), '★회전 슬라이더(Q20)').toBe(0);
    await page.click(`#${p}-rot-90`);
    await expect(page.locator(`#${num}`)).toHaveValue('90');
    await page.click(`#${p}-flip-h`);
    const t1 = await page.evaluate((id) => { const b = document.getElementById(id); return { h: b.dataset.flipH ?? null, t: b.style.transform }; }, r0.id);
    expect(t1.h).toBe('1');
    expect(t1.t, `★반전 그림 ${t1.t}`).toMatch(/scale\(-1, 1\)/);
    await page.evaluate((id) => { window.deselectAll?.(); window.selectBlock(id); }, r0.id);   // 다시 열기(렌더러가 transform 을 다시 쓰는 블럭 포함)
    await expect(page.locator(`#${p}-flip-h`), '★다시 연 패널에 반전 켜짐이 없다').toHaveAttribute('aria-pressed', 'true');
    expect(await page.evaluate((id) => document.getElementById(id).style.transform, r0.id), '★다시 그리니 반전이 사라졌다').toMatch(/scale\(-1, 1\)/);
    await page.evaluate(() => window.undo());
    expect(await page.evaluate((id) => document.getElementById(id).dataset.flipH ?? null, r0.id), '★⌘Z 가 반전을 안 되돌린다').toBeNull();
    expect(errs, errs.join(' | ')).toEqual([]);
  });
}

test('P17d 프레임 회전 줄 — 옛 id(ss-rotate-deg · ss-rotate-90 · ss-flip-h/v) 그대로 한 줄 · 반반', async ({ page }) => {
  const errs = await scene(page);
  const kind = (await kindOf(page, 'frame-block'));
  const r0 = await addKind(page, kind);
  await page.evaluate(selFrame, r0.id);
  const g = await page.evaluate(() => { const row = document.getElementById('ss-rotate-deg')?.closest('.prop-rot-row');
    return { row: !!row, ids: row ? [...row.querySelectorAll('button')].map((b) => b.id) : [], unit: row?.querySelector('.prop-unit')?.textContent }; });
  expect(g).toEqual({ row: true, ids: ['ss-rotate-90', 'ss-flip-h', 'ss-flip-v'], unit: '°' });
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* Q37(시안 v10 제안 꼴 · 현빈 GO 261120) — 블록 저장 «Template» 절: ＋ → 이름·폴더·태그 → «블록 템플릿으로 저장»(우클릭과 같은 saveBlockAsTemplate) ·
 *   프레임(«컴포넌트로 저장») · QA 패널엔 Template 절이 하나뿐. CTL prd1-q37-tpl.patch(틀이 절을 안 붙임) → 빨강 */
test('P18 Template 절 — 텍스트 패널: ＋ 펼침 · 저장하면 블록 템플릿이 생긴다 · 프레임 패널은 절 하나', async ({ page }) => {
  const errs = await scene(page);
  const id = await open(page, 'text-block', 'addTextBlock');
  await expect(page.locator('#blk-tpl-section'), '★Template 절이 없다').toBeAttached();
  await expect(page.locator('#blk-tpl-form')).toBeHidden();
  await page.click('#blk-tpl-toggle');
  await expect(page.locator('#blk-tpl-form')).toBeVisible();
  await expect(page.locator('#blk-tpl-toggle')).toHaveAttribute('aria-expanded', 'true');
  await page.fill('#blk-tpl-name', 'prd1-p18');
  await page.fill('#blk-tpl-tags', 'a, b');
  const before = await page.evaluate(() => (window.loadTemplates?.() || []).length);
  await page.click('#blk-tpl-save');
  await expect.poll(() => page.evaluate(() => (window.loadTemplates?.() || []).find((t) => t.name === 'prd1-p18') || null), '★저장이 안 됐다').toMatchObject({ type: 'block', folder: '블록', tags: ['a', 'b'] });
  expect(await page.evaluate(() => (window.loadTemplates?.() || []).length)).toBe(before + 1);
  /* 프레임 — 자기 Template(컴포넌트로 저장)만 · 블록 절 안 붙음 */
  const kind = (await kindOf(page, 'frame-block'));
  const f = await addKind(page, kind);
  await page.evaluate(selFrame, f.id);
  expect(await page.evaluate(() => document.querySelectorAll('#panel-right .prop-section[data-sec="template"]').length), '★프레임 패널에 Template 절이 둘').toBe(1);
  expect(await page.locator('#blk-tpl-section').count()).toBe(0);
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* QA2 M3 — transform 을 통째로 다시 쓰는 렌더러가 «실제로 돌 때» 반전을 다시 붙인다(다시 열기·⌘Z 는 렌더러를 안 부른다 → 렌더러를 직접 부른다).
 *   CTL: prd1-q17-render(모달) · prd1-q17-render-sticker · -zoom · -mockup · -iconify — 각 렌더러의 applyFlip 줄 삭제 → 그 칸 빨강 */
for (const [cls, call] of [
  ['modal-block', 'window.renderModalBlock(b)'],
  ['zoom-block', 'window.renderZoomBlock(b)'],
  ['mockup-block', 'window.initMockupCrop(b)'],
  ['sticker-block', 'window.renderStickerBlock(b)'],
  ['icon-block', 'window._applyIconifyBlockStyle(b, b.innerHTML, parseInt(b.style.width) || 64, parseInt(b.dataset.rotation) || 0)'],
]) test(`P17e ${cls} 렌더러가 다시 그려도 반전 유지`, async ({ page }) => {
  const errs = await scene(page);
  const kind = (await kindOf(page, cls));
  expect(kind?.entry, `[전제] ${cls} 입구`).toBeTruthy();
  const r0 = await addKind(page, kind);
  expect(r0.err).toBeUndefined();
  const t = await page.evaluate(([id, call]) => { const b = document.getElementById(id); window.toggleFlip(b, 'flipH');
    const before = b.style.transform; new Function('b', call)(b); return { before, after: b.style.transform, h: b.dataset.flipH }; }, [r0.id, call]);
  expect(t.before, '[전제] 반전이 걸렸다').toMatch(/scale\(-1, 1\)$/);
  expect([t.h, t.after], `★${cls} 렌더러가 반전을 지웠다 ${JSON.stringify(t)}`).toEqual(['1', expect.stringMatching(/scale\(-1, 1\)$/)]);
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* QA2 C1 — 모달 패널: 여는 동안 오류 0 · 떠 있는 모달 X 칸이 먹는다 · 각도 change → ⌘Z 한 번에 되돌아감.
 *   CTL prd1-qa2-c1.patch(_mRotS?. → _mRotS.) → 빨강(TypeError · 아래 배선 끊김) */
test('P19 모달 패널 — 오류 0 · 플로팅 X 칸 · 각도 ⌘Z 1번', async ({ page }) => {
  const errs = await scene(page);
  const kind = (await rosterOf(page)).find((r) => r.cls === 'modal-block');
  const r0 = await addKind(page, kind);
  await page.evaluate((id) => window.selectBlock(id), r0.id);
  await expect(page.locator('#mdl-rot-number')).toBeAttached();
  expect(errs, `★모달 패널을 여는 데 오류: ${errs.join(' | ')}`).toEqual([]);
  await page.fill('#mdl-rot-number', '30'); await page.locator('#mdl-rot-number').dispatchEvent('change');
  expect(await page.evaluate((id) => document.getElementById(id).dataset.rotation, r0.id)).toBe('30');
  await page.evaluate(() => window.undo());
  expect(await page.evaluate((id) => document.getElementById(id).dataset.rotation ?? '0', r0.id), '★각도가 ⌘Z 한 번에 안 돌아간다(change 이력 끊김)').toBe('0');
  await page.evaluate((id) => { window.deselectAll?.(); window.selectBlock(id); }, r0.id);
  await page.click('#mdl-float-toggle');
  await expect(page.locator('#mdl-x-number'), '[전제] 떠 있는 모달 X 칸').toBeAttached();
  await page.fill('#mdl-x-number', '37'); await page.locator('#mdl-x-number').dispatchEvent('input'); await page.locator('#mdl-x-number').dispatchEvent('change');
  /* 떠 있는 자리 = posEl dataset.offsetX(js/overlay-float.js wireFloatPosition · _applyOverlayPos) */
  expect(await page.evaluate((id) => { const b = document.getElementById(id); return [b, ...b.querySelectorAll('*'), b.parentElement].map((e) => e?.dataset?.offsetX).find((v) => v != null) ?? null; }, r0.id), '★X 칸이 안 먹는다(wireFloatPosition 끊김)').toBe('37');
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* QA2 C2 · M1(지디 «그 장면 그대로») — 텍스트 프레임 글: 회전 30 + 좌우 반전 → 저장→다시 열기 / ⌘Z / ⌘⇧Z 각각 뒤
 *   «화면 각(transform 의 rotate) = 패널 각 칸 = 저장 값(dataset.rotation)» 셋 다 30 + 끝이 scale(-1, 1)(순서 rotate → scale).
 *   ⌘Z 는 «반전만» 되돌린다(회전 30 은 남는다). 반전 뒤 각도 45 도 순서 고정.
 *   CTL prd1-qa2-c2.patch(옛 길: 틀 transform 이 텍스트 프레임 반전을 세고 · 회전 다시 쓰기 없음) · prd1-qa2-m1.patch(텍스트 각도가 손으로 rotate 를 짬) → 빨강 */
test('P20 텍스트 프레임 — 회전 30 + 반전이 저장→열기 / ⌘Z / ⌘⇧Z 뒤 화면 = 패널 = 저장값', async ({ page }) => {
  const errs = await scene(page);
  const fk = (await kindOf(page, 'frame-block'));
  const fr = await addKind(page, fk);
  await page.evaluate((id) => { document.getElementById(id).dataset.freeLayout = 'true'; }, fr.id);
  const t = await addKind(page, { cls: 'text-block', entry: 'addTextBlock' }, fr.id);
  /* 셋을 한 번에: 블럭을 다시 골라(패널 다시 그림) 칸 값까지 읽는다 */
  const tri = (id) => page.evaluate((id) => {
    window.deselectAll?.(); window.selectBlock(id);
    const e = document.getElementById(id)?.closest('.frame-block[data-text-frame="true"]');
    if (!e) return { tf: false };
    const m = /rotate\((-?[\d.]+)deg\)/.exec(e.style.transform || '');
    return { tf: true, screen: m ? m[1] : '0', panel: document.getElementById('txt-rot-number')?.value ?? null, saved: e.dataset.rotation ?? '0', flipH: e.dataset.flipH ?? null, t: e.style.transform };
  }, id);
  expect((await tri(t.id)).tf, '[전제] 글이 텍스트 프레임 안').toBe(true);
  await page.fill('#txt-rot-number', '30'); await page.locator('#txt-rot-number').dispatchEvent('change');
  await page.click('#txt-flip-h');
  const ORDER = /rotate\(30deg\) scale\(-1, 1\)$/;
  const want = (x, when) => {
    expect([x.screen, x.panel, x.saved], `★${when} — 화면 각 · 패널 칸 · 저장값이 갈렸다 ${JSON.stringify(x)}`).toEqual(['30', '30', '30']);
    expect(x.t, `★${when} — 순서/반전`).toMatch(ORDER);
  };
  want(await tri(t.id), '반전 직후');
  await page.evaluate((id) => { const d = JSON.parse(window.serializeProject()); document.getElementById('canvas').innerHTML = ''; window.applyProjectData(d); window.clearHistory?.(); }, t.id);
  want(await tri(t.id), '저장→다시 열기 뒤');
  /* 열린 판에서 다시: 반전 끄고 켬 → ⌘Z(반전 꺼짐 = 회전만) → ⌘⇧Z(다시 반전) */
  await page.click('#txt-flip-h'); await page.click('#txt-flip-h');
  await page.evaluate(() => window.undo());
  const u = await tri(t.id);
  expect([u.screen, u.panel, u.saved, u.flipH], `★⌘Z 뒤 회전이 사라졌다 ${JSON.stringify(u)}`).toEqual(['30', '30', '30', null]);
  expect(u.t).toMatch(/rotate\(30deg\)$/);
  await page.evaluate(() => window.redo());
  want(await tri(t.id), '⌘⇧Z 뒤');
  await page.fill('#txt-rot-number', '45'); await page.locator('#txt-rot-number').dispatchEvent('change');
  const r45 = await tri(t.id);
  expect(r45.t, '★반전 뒤 각도를 바꾸니 순서가 뒤집혔다(scale 이 rotate 앞 = 화면 −θ)').toMatch(/rotate\(45deg\) scale\(-1, 1\)$/);
  expect([r45.screen, r45.panel, r45.saved]).toEqual(['45', '45', '45']);
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* QA2 M4 — 각도 칸에 «-30» 을 칠 수 있다(«-» 순간 0 으로 덮지 않는다). CTL prd1-qa2-m4.patch(wireRotRow 캡처 가드 삭제 + 텍스트 typing 플래그 삭제) → 빨강 */
for (const [cls, entry, num] of [['text-block', 'addTextBlock', 'txt-rot-number'], ['modal-block', null, 'mdl-rot-number']]) test(`P21 ${cls} 각도 칸에 «-30» 타이핑`, async ({ page }) => {
  const errs = await scene(page);
  const kind = entry ? { cls, entry } : (await kindOf(page, cls));
  const r0 = await addKind(page, kind);
  await page.evaluate((id) => window.selectBlock(id), r0.id);
  const n = page.locator(`#${num}`);
  await n.click(); await page.keyboard.press('Meta+a'); await page.keyboard.type('-30');
  await expect(n, '★«-30» 을 못 친다').toHaveValue('-30');
  await page.keyboard.press('Enter');
  await expect(n).toHaveValue('-30');
  expect(await page.evaluate((id) => { const b = document.getElementById(id); const e = b.closest('.frame-block[data-text-frame="true"]') || b; return e.style.transform; }, r0.id)).toMatch(/rotate\(-30deg\)/);
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* QA2 Q37 — 저장 연타 = 한 번만 · 새 폴더로 저장하면 같은 패널 폴더 목록에 바로 뜬다. CTL prd1-qa2-q37.patch(연타 막기 삭제) → 빨강 */
test('P18b Template 절 — 저장 두 번 눌러도 한 개 · 새 폴더가 목록에 바로', async ({ page }) => {
  const errs = await scene(page);
  await open(page, 'text-block', 'addTextBlock');
  await page.click('#blk-tpl-toggle');
  await page.fill('#blk-tpl-name', 'prd1-p18b');
  await page.selectOption('#blk-tpl-folder', '__new__');
  await page.fill('#blk-tpl-folder-new', 'P18B폴더');
  await page.evaluate(() => { const b = document.getElementById('blk-tpl-save'); b.click(); b.click(); });
  await expect.poll(() => page.evaluate(() => (window.loadTemplates?.() || []).filter((t) => t.name === 'prd1-p18b').length), '★연타로 두 번 저장됐다').toBe(1);
  await expect.poll(() => page.evaluate(() => [...document.querySelectorAll('#blk-tpl-folder option')].map((o) => o.value)), '★새 폴더가 목록에 안 뜬다').toContain('P18B폴더');
  await expect(page.locator('#blk-tpl-save'), '★저장이 끝났는데 단추가 잠겨 있다').toBeEnabled();
  /* 실패해도 풀림 — 저장 함수가 던지면 단추가 다시 눌린다 · 이름 칸은 그대로(재시도) */
  const fail = await page.evaluate(async () => { const o = window.saveBlockAsTemplate; window.saveBlockAsTemplate = async () => { throw new Error('x'); };
    document.getElementById('blk-tpl-name').value = 'prd1-p18b-fail'; document.getElementById('blk-tpl-save').click();
    await new Promise((r) => setTimeout(r, 50)); window.saveBlockAsTemplate = o;
    return { disabled: document.getElementById('blk-tpl-save').disabled, name: document.getElementById('blk-tpl-name').value }; });
  expect(fail, '★저장 실패 뒤 단추가 잠긴 채 / 이름이 지워졌다').toEqual({ disabled: false, name: 'prd1-p18b-fail' });
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* QA2 ④(지디 ⓑ) — Figma JSON 파일 저장: 반전 블럭이 있으면 «반전은 Figma 로 안 나갑니다 … N개» 토스트 · 없으면 그 문구 0.
 *   CTL prd1-qa2-figflip.patch(파일 저장 길의 안내 빠짐) → 빨강 */
test('P22 Figma JSON — 반전 블럭 있을 때만 안내(수 포함)', async ({ page }) => {
  const errs = await scene(page);
  const r0 = await addKind(page, { cls: 'text-block', entry: 'addTextBlock' });
  const run = () => page.evaluate(async () => { window.__toasts = []; const _t = window.showToast; window.showToast = (m) => { window.__toasts.push(String(m)); };
    const _c = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = function () {};
    try { await window.exportFigmaJSON(); } finally { window.showToast = _t; HTMLAnchorElement.prototype.click = _c; }
    return window.__toasts.slice(); });
  expect((await run()).filter((m) => /반전/.test(m)), '★반전 블럭이 없는데 반전 안내가 떴다').toEqual([]);
  await page.evaluate((id) => { window.selectBlock(id); }, r0.id);
  await page.click('#txt-flip-h');
  const t = await run();
  expect(t.some((m) => /반전\(좌우·상하\)은 Figma 로 안 나갑니다.*1개/.test(m)), `★반전 안내 없음 ${JSON.stringify(t)}`).toBe(true);
  expect(errs, errs.join(' | ')).toEqual([]);
});
