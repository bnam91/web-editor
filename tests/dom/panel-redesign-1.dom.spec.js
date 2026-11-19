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
  await page.evaluate(async () => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); await window.addSection(); const sec = c.querySelector('.section-block'); window.__secEl = () => sec; window.clearHistory?.(); });
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
  const n = page.locator('#txt-x-number');
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
  await page.locator('#txt-style-group .prop-style-btn').first().click();   // B 켜기
  const r = await page.evaluate(() => {
    const tok = (n, prop = 'color') => { const p = document.createElement('span'); p.style[prop] = `var(${n})`; document.body.appendChild(p); const v = getComputedStyle(p)[prop]; p.remove(); return v; };
    const look = (el) => { const cs = getComputedStyle(el); return [cs.backgroundColor, cs.borderTopColor, cs.color]; };
    return { want: [tok('--ui-border-mid', 'backgroundColor'), tok('--ui-border-strong'), tok('--ui-text')],
      align: look(document.querySelector('#txt-align-group .prop-align-btn.active')),
      style: look(document.querySelector('#txt-style-group .prop-style-btn.active')),
      kind: getComputedStyle(document.querySelector('.prop-type-btn.active[data-cls]')).backgroundColor, accent: tok('--ui-accent-primary', 'backgroundColor') };
  });
  expect(r.align, '★정렬 켜짐').toEqual(r.want);
  expect(r.style, '★B 켜짐').toEqual(r.want);
  expect(r.kind, '[대조] 타입 단추 켜짐은 파란 채움 그대로').toBe(r.accent);
  await page.locator('#txt-style-group .prop-style-btn').first().click();   // 되돌림
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
  await expect(h).toHaveAttribute('placeholder', 'auto');
  expect(await page.evaluate(() => getComputedStyle(document.getElementById('txt-height-number').closest('.prop-icon-input')).opacity),
    '★꺼진 높이 칸이 안 흐리다').toBe(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--ui-disabled-opacity').trim()));
  const w0 = Number(await page.locator('#txt-width-number').inputValue());
  const box = await page.locator('#txt-width-scrub').boundingBox();
  /* QA 경2 — 오른쪽 단추로 끌면 안 바뀐다 */
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(box.x + box.width / 2 + 20, box.y + box.height / 2, { steps: 4 });
  await page.mouse.up({ button: 'right' });
  await page.keyboard.press('Escape');
  expect(Number(await page.locator('#txt-width-number').inputValue()), '★오른쪽 단추 끌기로 너비가 바뀌었다').toBe(w0);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 20, box.y + box.height / 2, { steps: 4 });
  await page.mouse.up();
  await expect.poll(async () => Number(await page.locator('#txt-width-number').inputValue()), '★라벨을 끌어도 너비가 안 바뀐다').toBe(Math.min(860, w0 + 20));
  const after = await page.evaluate((id) => document.getElementById(id).closest('.row')?.style.width || document.getElementById(id).style.width, id);
  expect(after, '★끈 값이 블럭에 안 썼다').toBe(Math.min(860, w0 + 20) + 'px');
  await page.evaluate(() => window.undo());
  await expect.poll(() => page.evaluate((id) => { const b = document.getElementById(id); return b.closest('.row')?.style.width || b.style.width; }, id), '★⌘Z 한 번에 안 돌아간다').not.toBe(after);
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
      rowGap: bs[bs.length - 1].getBoundingClientRect().top - bs[0].getBoundingClientRect().bottom,
      tok: parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ui-space-1')),
      cols: bs.slice(0, 6).map((b, i) => Math.round(b.getBoundingClientRect().left) === Math.round(bs[i + 6].getBoundingClientRect().left)) };
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
  ph: getComputedStyle(document.getElementById('txt-ph-slider')).visibility, pl: document.getElementById('txt-pl-row').hidden, pr: document.getElementById('txt-pr-row').hidden,
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
  const kids = (page) => page.evaluate(() => [...document.querySelectorAll('.text-block')].map((b) => b.dataset.padXLinked ?? null));
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
    return [...document.querySelectorAll('.text-block')].map((b) => b.dataset.padXLinked ?? null); });
  expect(back, '★저장→다시 열기에서 풂을 잃었다').toEqual(['0', '0', '0']);
  await page.evaluate(() => { const b = document.querySelector('.text-block'); window.deselectAll?.(); window.selectBlock(b.id); });
  expect((await padRows(page)).pressed, '★다시 연 글의 패널이 잠금으로 열렸다').toBe('false');
  // 템플릿 저장(섹션)
  const tpl = await page.evaluate(async () => { const S = document.querySelector('.section-block'); await window.saveAsTemplate(S, 'prd1-p5b', '기타', '', [], 'section'); return JSON.stringify(window.loadTemplates()[0] || null); });
  expect(tpl, '★템플릿에 data-pad-x-linked 가 없다').toMatch(/data-pad-x-linked=\\*"0/);
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* ⑤ 다른 블럭 패딩 이름(Q25) — 프레임·디바이더 줄 라벨. CTL 은 R5a(소스)로 갈음 */
test('P5c 디바이더 패널 Padding 절 «상하패딩»·«좌우패딩»', async ({ page }) => {
  const errs = await scene(page);
  await open(page, 'divider-block', 'addDividerBlock');
  const labs = await page.evaluate(() => [...document.querySelectorAll('#panel-right .prop-section[data-sec="padding"] .prop-label')].map((l) => l.textContent.trim()));
  expect(labs, '★디바이더 패딩 줄 이름').toEqual(expect.arrayContaining(['상하패딩', '좌우패딩']));
  expect(labs.filter((t) => /상하 패딩|좌우 패딩/.test(t)), '★옛 이름이 남았다').toEqual([]);
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* ⑧ 끝 옵션 칼럼 — 값 줄 끝이 한 자리 · 사슬과 머리 손잡이가 같은 칼럼. CTL prd1-08-optcol.patch(절 padding-right 규칙 삭제) → 빨강 */
test('P8 옵션 칼럼 — 상하패딩 숫자 끝 = 좌우패딩 숫자 끝 · 사슬 오른끝 = Position 머리 플로팅 단추 오른끝 · 칼럼 폭 = 토큰', async ({ page }) => {
  const errs = await scene(page);
  await open(page, 'text-block', 'addTextBlock');
  const r = await page.evaluate(() => {
    const R = (id) => document.getElementById(id).getBoundingClientRect();
    const probe = document.createElement('div'); probe.style.width = 'var(--ui-opt-col-w)'; document.body.appendChild(probe); const col = probe.getBoundingClientRect().width; probe.remove();
    const sec = document.getElementById('txt-ph-row').closest('.prop-section[data-sec]');
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
  expect(Math.round(await page.evaluate(() => document.getElementById('txt-fx-add-btn').getBoundingClientRect().width)), '★Effects ＋ 폭(시안 22)').toBe(22);
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
  await open(page, cls, entry);
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
    const sec = row.closest('.prop-section[data-sec]'), sp2 = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ui-space-2'));
    const kids = [...row.children].map((k) => Math.round(k.getBoundingClientRect().top));
    return { right: row.getBoundingClientRect().right, inner: sec.getBoundingClientRect().right - sp2, lines: new Set(kids).size };
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
for (const [cls, entry, subs] of [['text-block', 'addTextBlock', ['Size', 'Padding']], ['gap-block', 'addGapBlock', []]]) test(`P16 Layout 묶음 — ${cls}`, async ({ page }) => {
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
  const all = () => page.evaluate(() => [...document.querySelectorAll('.text-block')].map((b) => { const e = b.closest('.frame-block[data-text-frame="true"]') || b; return [e.dataset.flipH ?? null, /scale\(-1, 1\)/.test(e.style.transform)]; }));
  await page.evaluate((id) => { window.deselectAll?.(); window.selectBlock(id); window.copySelected(); }, id);
  await page.keyboard.press('Meta+v');
  await expect.poll(async () => (await all()).length, '[전제] 붙여넣었다').toBe(2);
  await page.evaluate((id) => { window.deselectAll?.(); window.selectBlock(id); }, id);
  await page.keyboard.press('Meta+d');
  await expect.poll(async () => (await all()).length, '[전제] 복제했다').toBe(3);
  expect(await all(), '★붙여넣기/복제가 반전을 잃었다').toEqual([['1', true], ['1', true], ['1', true]]);
  const back = await page.evaluate(() => { const d = JSON.parse(window.serializeProject()); document.getElementById('canvas').innerHTML = ''; window.applyProjectData(d); window.clearHistory?.();
    return [...document.querySelectorAll('.text-block')].map((b) => { const e = b.closest('.frame-block[data-text-frame="true"]') || b; return [e.dataset.flipH ?? null, /scale\(-1, 1\)/.test(e.style.transform)]; }); });
  expect(back, '★저장→다시 열기에서 반전을 잃었다').toEqual([['1', true], ['1', true], ['1', true]]);
  /* 블록 템플릿 저장(우클릭 «블록 템플릿으로 저장»과 같은 함수) → 넣기 */
  const ins = await page.evaluate(async () => {
    const b = document.querySelector('.text-block'); await window.saveBlockAsTemplate(b, 'prd1-p17b', '블록', '');
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
for (const [cls, p, num] of [['shape-block', 'shape', 'shape-rot-num'], ['modal-block', 'mdl', 'mdl-rot-number'], ['mockup-block', 'mkp', 'mkp-rot-number'],
  ['icon-circle-block', 'icb', 'icb-rot-number'], ['icon-block', 'icn', 'icn-rot-number'], ['zoom-block', 'zm', 'zm-rot-num']]) {
  test(`P17c ${cls} 회전 줄 — 각도 칸 · 90° · 좌우 반전 · 다시 그려도 · 다시 열기`, async ({ page }) => {
    const errs = await scene(page);
    const kind = (await rosterOf(page)).find((r) => r.cls === cls);
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
  const kind = (await rosterOf(page)).find((r) => r.cls === 'frame-block');
  const r0 = await addKind(page, kind);
  await page.evaluate((id) => window.selectBlock(id), r0.id);
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
  const kind = (await rosterOf(page)).find((r) => r.cls === 'frame-block');
  const f = await addKind(page, kind);
  await page.evaluate((fid) => window.selectBlock(fid), f.id);
  expect(await page.evaluate(() => document.querySelectorAll('#panel-right .prop-section[data-sec="template"]').length), '★프레임 패널에 Template 절이 둘').toBe(1);
  expect(await page.locator('#blk-tpl-section').count()).toBe(0);
  expect(errs, errs.join(' | ')).toEqual([]);
});
