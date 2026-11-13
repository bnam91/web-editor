/* panel-frame-states — 틀(js/props/_panel-frame.js)이 그린 절 머리의 상태들. (right-panel-unify U0 · A-6) 파일럿 = 갭 · 브릿지.
 * S1 hover — 제목 색이 --ui-sec-title-color → --ui-sec-title-color-hover 로 바뀐다 (토큰이 정의돼 있다)
 * S2 키보드 — Tab 으로 절 머리 도달 · :focus-visible 링(outline ≠ none) · Enter/Space 토글 · aria-expanded 반전 · aria-controls == 몸통 id
 * S3 넘침 — 좁은 패널 · 60자 블록 이름 · 긴 special 제목에도 패널·절에 가로 넘침 0 · 제목은 ellipsis
 * S4 겹침 0 — 절 머리 사각형끼리 안 겹치고 패널 안에 있다 · 제목 글자 ≥ --ui-fs-10
 * S6 몸 아래 여백 = --ui-sec-body-pb «하나»(마지막 보이는 자식 margin 0 · 숨은 꼬리 건너뜀) — 마지막 절 빼고 전부 · 양성대조: 꼬리 margin 을 되살리면 어긋난다
 * S7 보이는 내용 없는 펼친 절(머리만 · 숨은 자식만) — 아래 여백 0 · 머리 위아래 틈 같음(손잡이 가운데) · 양성대조: 내용 있는 절은 pb
 * S8 접힌 Effects 에 효과를 더하면 Effects 가 열리고 새 카드가 보인다(expandSection) · 양성대조: 그 문을 끄면 접힌 채 남는다
 * S5 틀 절 몸 안의 옛 하위 절(.prop-section)은 좌우 들임 0 — 그 안 첫 줄 왼쪽 == 틀 몸 왼쪽(±0.5) · 양성대조: 틀 밖 같은 마크업은 들여진다
 * 양성대조(사람이 돌린다): S1 = editor-base.css 의 --ui-sec-title-color-hover 줄 삭제 → 빨강 ·
 *   S2 = _panel-frame.js 의 panel.addEventListener('keydown' …) 제거 → 빨강 · S3 = editor-props.css .prop-sec-title-text 의 text-overflow:ellipsis 제거 → 빨강.
 * ⛔화면 px 를 상수와 견주지 않는다(dom-screen-px-census) — 사각형끼리만 비교한다. */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const { addKind } = require('./_block-roster-294.js');

const GAP = { cls: 'gap-block', entry: 'addGapBlock' };
const BRIDGE = { cls: 'bridge-block', entry: 'addBridgeBlock' };

async function open(page, kind) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(async () => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); await window.addSection(); const sec = c.querySelector('.section-block'); window.__secEl = () => sec; });
  const r = await addKind(page, kind);
  expect(r.err, `[전제] ${kind.cls} 넣기`).toBeUndefined();
  await page.evaluate((id) => window.selectBlock(id), r.id);
  await expect(page.locator('#psec-size-head'), '[전제] 틀이 그린 절 머리').toBeVisible();
  return { errs, id: r.id };
}
/** 토큰을 color 로 걸어 본 계산값(var() 사슬을 브라우저가 푼다). */
const tokenColor = (page, name) => page.evaluate((name) => {
  const p = document.createElement('span'); p.style.color = `var(${name})`; document.body.appendChild(p);
  const v = getComputedStyle(p).color; p.remove(); return v;
}, name);
const tokenRaw = (page, name) => page.evaluate((name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim(), name);
const colorOf = (page, sel) => page.evaluate((sel) => getComputedStyle(document.querySelector(sel)).color, sel);

test('S1 hover — 제목 색이 hover 토큰으로 바뀐다', async ({ page }) => {
  const { errs } = await open(page, GAP);
  expect(await tokenRaw(page, '--ui-sec-title-color-hover'), '★hover 토큰이 정의돼 있지 않다').not.toBe('');
  const base = await tokenColor(page, '--ui-sec-title-color');
  const hover = await tokenColor(page, '--ui-sec-title-color-hover');
  expect(base, '[전제] 두 토큰 색이 달라야 이 검사가 무엇을 잰다').not.toBe(hover);
  await page.mouse.move(0, 0);
  await expect.poll(() => colorOf(page, '#psec-size-head'), '평소 색').toBe(base);
  await page.hover('#psec-size-head');
  await expect.poll(() => colorOf(page, '#psec-size-head'), 'hover 색').toBe(hover);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('S2 키보드 — Tab 도달 · focus-visible 링 · Enter/Space 토글 · aria', async ({ page }) => {
  const { errs } = await open(page, GAP);
  // 패널 맨 앞에 임시 단추를 두고 거기서 Tab — 블록 머리에는 포커스 받을 것이 없으니 다음 칸이 첫 절 머리다
  await page.evaluate(() => { const b = document.createElement('button'); b.id = '__tabstart'; document.querySelector('#panel-right .panel-body').prepend(b); b.focus(); });
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => document.activeElement?.id), '★Tab 으로 절 머리에 못 간다').toBe('psec-size-head');
  await page.evaluate(() => document.getElementById('__tabstart').remove());
  const ring = await page.evaluate(() => { const s = getComputedStyle(document.activeElement); return { style: s.outlineStyle, fv: document.activeElement.matches(':focus-visible') }; });
  expect(ring.fv, '[전제] 키보드 포커스').toBe(true);
  expect(ring.style, '★focus-visible 링이 없다').not.toBe('none');
  const head = page.locator('#psec-size-head');
  await expect(head).toHaveAttribute('aria-controls', 'psec-size-body');
  await expect(page.locator('#psec-size-body'), '★aria-controls 가 가리키는 몸통이 없다').toBeAttached();
  await expect(head).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Enter');
  await expect(head).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('#psec-size-body')).toBeHidden();
  await page.keyboard.press(' ');
  await expect(head).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#psec-size-body')).toBeVisible();
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('S3 넘침 — 좁은 패널 · 긴 이름 · 긴 special 제목에도 가로 넘침 0 · 제목 ellipsis', async ({ page }) => {
  const { errs, id } = await open(page, BRIDGE);
  const out = await page.evaluate(async (id) => {
    const { renderPanel, sec } = await import('/js/props/_panel-frame.js');
    const { blockHeaderHTML } = await import('/js/props/_helpers.js');
    document.getElementById('panel-right').style.width = '240px';
    const b = document.getElementById(id);
    const longTitle = 'Supercalifragilisticexpialidocious Antidisestablishmentarianism';   // 규칙(Title Case 2단어) 안에서 가장 긴 꼴
    renderPanel(b, { header: blockHeaderHTML({ name: '가'.repeat(60), id: b.id }), sections: [sec('size', '<div class="prop-row"><span class="prop-label">높이</span></div>'), sec('special', '<div class="prop-row">x</div>', { title: longTitle })] });
    const body = document.querySelector('#panel-right .panel-body');
    const over = [body, ...body.querySelectorAll(':scope > .prop-section')].filter((e) => e.scrollWidth > e.clientWidth).map((e) => e.id || e.className);
    const span = document.querySelector('#psec-special-0-head > span');
    return { over, ellipsis: getComputedStyle(span).textOverflow, clipped: span.scrollWidth > span.clientWidth };
  }, id);
  expect(out.clipped, '[전제] 긴 제목이 실제로 잘릴 만큼 길다').toBe(true);
  expect(out.over, '★가로 넘침').toEqual([]);
  expect(out.ellipsis, '★긴 제목이 ellipsis 로 안 접힌다').toBe('ellipsis');
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('S4 겹침 0 — 절 머리끼리 안 겹치고 패널 안 · 제목 글자 ≥ --ui-fs-10', async ({ page }) => {
  const { errs } = await open(page, BRIDGE);
  const r = await page.evaluate(() => {
    const body = document.querySelector('#panel-right .panel-body');
    const P = body.getBoundingClientRect();
    const heads = [...body.querySelectorAll('.prop-section[data-sec] > .prop-sec-head')].map((h) => h.getBoundingClientRect());
    const probe = document.createElement('span'); probe.style.fontSize = 'var(--ui-fs-10)'; document.body.appendChild(probe);
    const minFs = parseFloat(getComputedStyle(probe).fontSize); probe.remove();
    const fs = [...body.querySelectorAll('.prop-section[data-sec] > .prop-sec-head > .prop-section-title')].map((t) => parseFloat(getComputedStyle(t).fontSize));
    const overlap = []; for (let i = 1; i < heads.length; i++) if (heads[i].top < heads[i - 1].bottom - 0.5) overlap.push(i);
    const outside = heads.filter((h) => h.left < P.left - 0.5 || h.right > P.right + 0.5).length;
    return { n: heads.length, overlap, outside, small: fs.filter((v) => v < minFs).length };
  });
  expect(r.n, '[전제] 브릿지 절 셋').toBe(3);
  expect(r.overlap, '★절 머리 겹침').toEqual([]);
  expect(r.outside, '★패널 밖 절 머리').toBe(0);
  expect(r.small, '★--ui-fs-10 보다 작은 제목').toBe(0);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('S5 틀 절 몸 안 옛 하위 절 — 두 번 들이지 않는다(왼쪽 == 틀 몸 왼쪽 ±0.5)', async ({ page }) => {
  const { errs } = await open(page, BRIDGE);
  const r = await page.evaluate(() => {
    const body = document.getElementById('psec-size-body');
    const nest = document.createElement('div'); nest.className = 'prop-section'; nest.innerHTML = '<div class="prop-row" id="__nest-row">x</div>';
    body.appendChild(nest);
    /* 양성대조 — 같은 마크업을 틀 «밖»(패널 몸 끝의 맨 그릇)에 두면 .prop-section 들임을 그대로 받는다 */
    const plain = document.createElement('div'); plain.id = '__plain';
    plain.innerHTML = '<div class="prop-section"><div class="prop-row" id="__plain-row">x</div></div>';
    document.querySelector('#panel-right .panel-body').appendChild(plain);
    const L = (el) => el.getBoundingClientRect().left;
    return { nested: L(document.getElementById('__nest-row')) - L(body),
             plain: L(document.getElementById('__plain-row')) - L(plain) };
  });
  expect(Math.abs(r.nested), `★틀 몸 안 하위 절이 또 들여졌다(${r.nested})`).toBeLessThanOrEqual(0.5);
  expect(r.plain, '[양성대조] 틀 밖 .prop-section 은 들여진다 — 이 칸이 무엇을 잰다').toBeGreaterThan(0.5);
  expect(errs, errs.join(' | ')).toEqual([]);
});

/** 토큰 길이를 px 로(브라우저가 var() 를 푼다). */
const tokenPx = (page, name) => page.evaluate((name) => { const p = document.createElement('div'); p.style.paddingBottom = `var(${name})`; document.body.appendChild(p); const v = parseFloat(getComputedStyle(p).paddingBottom); p.remove(); return v; }, name);
/** 펼친 data-sec 절마다(마지막 절 빼고) 몸 아래 틈 = 절 아래 − 몸의 마지막 «보이는» 자식 아래. */
const bottomGaps = (page) => page.evaluate(() => {
  const secs = [...document.querySelectorAll('#panel-right .panel-body > .prop-section[data-sec]:not(.is-collapsed)')];
  return secs.slice(0, -1).map((s) => {
    const kids = [...s.querySelector(':scope > .prop-sec-body').children].filter((k) => k.getClientRects().length);
    const last = kids[kids.length - 1];
    return { id: s.id, gap: last ? s.getBoundingClientRect().bottom - last.getBoundingClientRect().bottom : null };
  });
});

test('S6 몸 아래 여백 = --ui-sec-body-pb 하나 — 숨은 꼬리는 건너뛴다', async ({ page }) => {
  const { errs } = await open(page, BRIDGE);
  const pb = await tokenPx(page, '--ui-sec-body-pb');
  /* 숨은 꼬리 둘(속성 hidden · 인라인 display:none) — 이것들이 «마지막 자식»이어도 그 앞 보이는 줄의 margin 이 꺼져야 한다 */
  await page.evaluate(() => { const b = document.getElementById('psec-size-body'); b.insertAdjacentHTML('beforeend', '<div class="cv-chips" hidden></div><div class="prop-row" style="display:none">x</div>'); });
  const g = await bottomGaps(page);
  expect(g.length, '[전제] 마지막 빼고 잴 절이 있다(브릿지 Size · Fill)').toBeGreaterThanOrEqual(2);
  for (const x of g) expect(Math.abs(x.gap - pb), `★${x.id} 몸 아래 틈 ${x.gap} ≠ pb ${pb}`).toBeLessThanOrEqual(0.5);
  /* 양성대조 — 꼬리 줄의 margin 을 되살리면(=고치기 전) 틈이 pb 보다 커진다: 이 칸이 무엇을 잰다 */
  await page.addStyleTag({ content: '.prop-sec-body > .prop-row { margin-bottom: var(--ui-space-2) !important; }' });
  const bad = (await bottomGaps(page)).find((x) => x.id === 'psec-size');
  expect(bad.gap - pb, '[양성대조] margin 을 되살렸는데 틈이 그대로다').toBeGreaterThan(0.5);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('S7 보이는 내용 없는 펼친 절 — 아래 여백 0 · 머리 가운데', async ({ page }) => {
  const { errs, id } = await open(page, BRIDGE);
  const pb = await tokenPx(page, '--ui-sec-body-pb');
  const r = await page.evaluate(async (id) => {
    const { renderPanel, sec } = await import('/js/props/_panel-frame.js');
    renderPanel(document.getElementById(id), { sections: [
      sec('effects', '', { headTools: '<select class="prop-select" id="__fx-add"><option>효과 추가…</option></select>' }),   // 머리만(효과 0)
      sec('stroke', '<div class="prop-row" hidden>x</div>', { headTools: '<button class="prop-btn" id="__stk-on">끔</button>' }),   // 숨은 자식만(Stroke 끔)
      sec('size', '<div class="prop-row"><span class="prop-label">높이</span></div>'),   // 양성대조: 내용 있음
      sec('fill', '<div class="prop-row">y</div>'),
    ] });
    const m = (sid) => { const s = document.getElementById(sid), h = s.querySelector(':scope > .prop-sec-head'); const a = s.getBoundingClientRect(), b = h.getBoundingClientRect();
      return { pb: parseFloat(getComputedStyle(s).paddingBottom), top: b.top - a.top - parseFloat(getComputedStyle(s).borderTopWidth), bottom: a.bottom - b.bottom }; };
    return { fx: m('psec-effects'), stroke: m('psec-stroke'), size: m('psec-size') };
  }, id);
  for (const k of ['fx', 'stroke']) {
    expect(r[k].pb, `★${k} — 보이는 내용 없는데 아래 여백이 있다`).toBe(0);
    expect(Math.abs(r[k].top - r[k].bottom), `★${k} 머리가 가운데가 아니다(위 ${r[k].top} · 아래 ${r[k].bottom})`).toBeLessThanOrEqual(0.5);
  }
  expect(Math.abs(r.size.pb - pb), '[양성대조] 내용 있는 절은 pb 를 받는다').toBeLessThanOrEqual(0.5);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('S8 접힌 Effects 에 효과 추가 → Effects 가 열리고 새 카드가 보인다', async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(async () => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); await window.addSection(); const sec = c.querySelector('.section-block'); window.__secEl = () => sec; });
  const r = await addKind(page, { cls: 'asset-block', entry: 'addAssetBlock' });
  expect(r.err, '[전제] 에셋 블록').toBeUndefined();
  /* [전제] 이 하네스의 localStorage 가 정상 — 쓴 값이 돌아온다(태양 261113: setItem 실패·getItem null 환경이면 _panel-frame 접힘이 기억에만 남아 다시 그릴 때 풀린다).
     _root-harness 는 저장소를 스텁하지 않는다(http://goditor.dom.test 진짜 origin) — 여기서 빨강이면 하네스부터 본다. */
  expect(await page.evaluate(() => { try { localStorage.setItem('__s8_ls', '1'); const v = localStorage.getItem('__s8_ls'); localStorage.removeItem('__s8_ls'); return v; } catch (e) { return 'throw:' + e.name; } }),
    '[전제] localStorage setItem → getItem 이 돌아온다').toBe('1');
  /* 틀로 그린 에셋 Effects 절 + 진짜 배선(wireFxSection — 다시 그리기 = 같은 그리기) */
  const opts = await page.evaluate(async (id) => {
    const { renderPanel, sec } = await import('/js/props/_panel-frame.js');
    const ab = document.getElementById(id);
    const draw = () => { const p = window.fxSectionParts(ab, 'asset');
      renderPanel(ab, { sections: [sec('size', '<div class="prop-row"><input type="number" id="__sz"></div>'), sec('effects', p.body, { headTools: p.headTools, id: p.id })] });
      window.wireFxSection(ab, 'asset', draw); };
    draw();
    return [...document.querySelectorAll('#asset-fx-add option')].map((o) => o.value).filter(Boolean);
  }, r.id);
  expect(opts.length, '[전제] 더할 효과가 둘 이상').toBeGreaterThanOrEqual(2);
  const body = page.locator('#asset-fx-section-body');
  /* U6([S8-DOOR] 측정 261113): 효과 0 이면 Effects 몸이 비어 높이 0 → isVisible 거짓 → 머리를 «안 눌렀다». 접힘이 화면에만 있고 저장(gd-panel-collapsed)엔 없어
     효과 추가 뒤 다시 그리기(renderPanel)가 기본값(펼침)으로 그려 양성대조가 visible 로 빨강이었다. ⇒ 접힘은 aria-expanded 로 판단해 «진짜 머리 클릭»(저장까지 타는 길)으로 하고,
     [전제] 저장에 effects 가 들었는지 확인한다. 되돌리면: isVisible 판단으로 돌리면 [전제] 저장 단언이 빨강(접기를 안 탔다). */
  const head = page.locator('#asset-fx-section-head');
  const collapse = async () => {
    if ((await head.getAttribute('aria-expanded')) !== 'false') await head.click();
    await expect(head, '[전제] 머리가 접힘').toHaveAttribute('aria-expanded', 'false');
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('gd-panel-collapsed') || '[]')), '[전제] 접힘이 저장(gd-panel-collapsed)에 들었다 — 다시 그려도 접힌 채').toContain('effects');
    await expect(body).toBeHidden();
  };
  /* 양성대조 — 여는 문을 끈 판: 접힌 채 효과를 더하면 카드가 닫힌 절에 들어간다(고치기 전 꼴) */
  await collapse();
  await page.evaluate(() => { window.__realExpand = window.expandPanelSection; window.expandPanelSection = () => {}; });
  await page.selectOption('#asset-fx-add', opts[0]);
  await expect(page.locator('#asset-fx-list'), '[전제] 카드가 생겼다').toBeAttached();
  await expect(body, '[양성대조] 문을 끄면 Effects 가 접힌 채다').toBeHidden();
  /* 진짜 문 */
  await page.evaluate(() => { window.expandPanelSection = window.__realExpand; });
  await collapse();
  const n0 = await page.locator('#asset-fx-list > *').count();
  const next = await page.evaluate(() => [...document.querySelectorAll('#asset-fx-add option')].map((o) => o.value).find(Boolean));
  await page.selectOption('#asset-fx-add', next);
  await expect(body, '★효과를 더했는데 Effects 가 접힌 채다').toBeVisible();
  await expect(page.locator('#asset-fx-section-head')).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#asset-fx-list > *')).toHaveCount(n0 + 1);
  await expect(page.locator('#asset-fx-list > *').last(), '★새 카드가 안 보인다').toBeVisible();
  expect(errs, errs.join(' | ')).toEqual([]);
});
