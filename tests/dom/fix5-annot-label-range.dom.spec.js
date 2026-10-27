/* fix5-annot-label-range — 어노테이션 라벨 «고른 글자만» 색·크기 (FIX5 1017t1h3 재투입).
 *
 * ★현빈 원문(👉 뒤가 판정): 「라벨의 텍스트인 경우 선택한 영역만 색지정 혹은 폰트크기 등 각 다르게
 *   입력할수 있게해줘. 일반 텍스트 블럭 처럼 말야. 👉 잘안되는거 같아. qa해봐」
 * ★부모 실측(ca702d40 실앱): 마우스로 끌어 고르면 mouseup 순간 어노테이션 선택·패널 크기/색 칸이 풀린다 ·
 *   키보드로 고르면 되지만 색을 넣을 때마다 빈 `<span style="color:…"></span>` 이 하나씩 쌓인다.
 *
 * ★무엇을 잠그나
 *   RG1 ★진짜 마우스 끌기(page.mouse down/move/up)로 「다라」를 고른다 → 선택·편집·패널이 남는다 →
 *       크기 40 · 색 ff0000 · 색 00ff00 → ★그 두 글자만 바뀌고 나머지 그대로 · 빈 span 0 · 어노테이션 선택 유지 ·
 *       저장값(dataset.labelHtml)에도 빈 span 0 · 평문 그대로.
 *   RG2 ★끌기가 라벨 «밖»에서 끝나도(마지막 글자 너머 섹션 위에서 놓음) 선택이 안 풀린다.
 *   RG3 키보드 길 회귀 — ⇧← 두 번으로 「마바」 → 색·크기·색 → 그 글자만 · 빈 span 0.
 *   RG4 다른 곳 클릭 회귀 — 끌어 고른 «뒤»에도 섹션 빈 곳 클릭이 편집을 마치고 어노테이션 선택·패널을 푼다
 *       (click 삼키기는 «한 번»뿐이다) · 편집 밖 선택 상태에서도 빈 곳 클릭 = 해제.
 * ★양성대조: GD1001_ROOT=<git archive 8608bb13 사본> 이면 RG1·RG2(선택 풀림)·RG3(빈 span) 이 빨강이어야 한다. RG4 는 지키는 칸(양쪽 초록).
 * ★8608bb13 판에 맞춤(t23-h2h3) — 그 사이 라벨 상자 손잡이(.annot-lw-handle · 1013t2C6)가 생겼다 ⇒ 빈 곳 클릭은 손잡이도 피한다.
 * ⛔waitForTimeout 0 — 대기는 «재는 값» 자체를 expect.poll 로.
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');
const { clickAt } = require('./_click-at.js');

const SEC = '[id="secA"]';
const TEXT = '가나다라마바';

async function setup(page) {
  await page.evaluate(() => {
    const canvas = document.getElementById('canvas');
    canvas.innerHTML = '<div class="section-block" id="secA" style="position:relative;height:420px;background:#f4f4f6"><div class="section-inner"></div></div>';
    window.rebindAll?.();
    window.applyPagePadX?.(window.state?.pageSettings?.padX);
    window.buildLayerPanel?.();
  });
}

const annotCount = (page) => page.evaluate(() => document.querySelectorAll('#secA .annotation-block').length);
const penOn = (page) => page.evaluate(() => document.body.classList.contains('pen-mode'));
const labelSel = (id) => `[id="${id}"] .annot-label`;

/* 펜 단추 → 「Annotation」 → 두 점 → Enter → Esc (annotation-1013t2 와 같은 사람 길). */
async function makeAnnotation(page) {
  const before = await annotCount(page);
  await page.click('#fp-pen-btn');
  await page.click('#fp-pen-menu .fp-menu-item:text-is("Annotation")');
  await expect.poll(() => penOn(page), '★전제: 펜 모드가 켜졌다').toBe(true);
  const r = await waitStableRect(page, SEC);
  await clickAt(page, r.left + r.width * 0.2, r.top + r.height * 0.3, { sel: SEC }, { label: '첫 점' });
  await clickAt(page, r.left + r.width * 0.45, r.top + r.height * 0.6, { sel: SEC }, { label: '둘째 점' });
  await page.keyboard.press('Enter');
  await expect.poll(() => annotCount(page), 'Enter 로 어노테이션 하나가 생겼다').toBe(before + 1);
  /* ★라벨 편집 포커스(setTimeout 0)가 «들어온 뒤» Esc — 먼저 누르면 편집이 열린 채(포커스 없이) 남는다(탐침 실측). */
  await expect.poll(() => page.evaluate(() => document.activeElement?.classList?.contains('annot-label')), '생성 직후 라벨 편집에 들어갔다').toBe(true);
  await page.keyboard.press('Escape');
  await expect.poll(() => penOn(page), 'Esc 로 펜 모드 종료').toBe(false);
  return page.evaluate(() => { const all = document.querySelectorAll('#secA .annotation-block'); return all[all.length - 1].id; });
}

/* 지금 상태 한 장 — 편집 중? 골랐나? 패널 크기·색 칸? DOM 선택 글? 빈 span 수? */
const state = (page, id) => page.evaluate((id) => {
  const b = document.getElementById(id); const l = b.querySelector('.annot-label');
  return {
    editing: l.getAttribute('contenteditable') === 'true',
    selected: b.classList.contains('selected'),
    panelFs: !!document.querySelector('#panel-right #annot-font-size-num'),
    panelColor: !!document.querySelector('#panel-right #annot-label-color-hex'),
    sel: String(window.getSelection()),
    empty: [...l.querySelectorAll('span')].filter(s => !s.textContent).length,
  };
}, id);

/* 글자마다 «그려진» 크기·색(computed) — 중첩 꼴에 안 매이고 «그 글자가 어떻게 보이나»를 잰다. */
const perChar = (page, id) => page.evaluate((id) => {
  const l = document.querySelector(`[id="${id}"] .annot-label`);
  const out = [];
  const w = document.createTreeWalker(l, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    const cs = getComputedStyle(n.parentElement);
    for (const ch of n.nodeValue) if (ch !== '\n') out.push([ch, cs.fontSize, cs.color]);
  }
  return out;
}, id);

/* 라벨 글자 i 의 화면 사각형(진짜 글자 위 좌표로 끌기 위해). */
const charRect = (page, id, i) => page.evaluate(([id, i]) => {
  const l = document.querySelector(`[id="${id}"] .annot-label`);
  const w = document.createTreeWalker(l, NodeFilter.SHOW_TEXT);
  let pos = 0;
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    if (i < pos + n.nodeValue.length) {
      const r = document.createRange(); r.setStart(n, i - pos); r.setEnd(n, i - pos + 1);
      const b = r.getBoundingClientRect();
      return { left: b.left, right: b.right, top: b.top, bottom: b.bottom, cy: (b.top + b.bottom) / 2 };
    }
    pos += n.nodeValue.length;
  }
  return null;
}, [id, i]);

/* 만들기 → 라벨 클릭(고르기) → 더블클릭(편집) → TEXT 입력 — 부모 실측 장면(줌 150%). */
async function scene(page) {
  await setup(page);
  await page.evaluate(() => window.applyZoom(150));
  const id = await makeAnnotation(page);
  const lr = await waitStableRect(page, labelSel(id));
  await clickAt(page, lr.cx, lr.cy, { sel: labelSel(id) }, { label: '라벨 고르기' });
  await expect.poll(async () => { const s = await state(page, id); return [s.selected, s.panelFs]; }, '★전제: 골랐고 패널이 떴다').toEqual([true, true]);
  await clickAt(page, lr.cx, lr.cy, { sel: labelSel(id) }, { label: '라벨 더블클릭', dbl: true });
  await expect.poll(async () => (await state(page, id)).editing, '★전제: 편집에 들어갔다').toBe(true);
  /* ★더블클릭의 «글 전체 고르기»(setTimeout 0)가 끝난 뒤 친다 — 먼저 치면 기본 글 앞에 붙는다(바닥 런 실측 「가나다라마바텍스트」). */
  await expect.poll(() => page.evaluate((id) => String(window.getSelection()) === document.querySelector(`[id="${id}"] .annot-label`).textContent, id), '★전제: 글 전체가 골라졌다').toBe(true);
  await page.keyboard.type(TEXT);
  await expect.poll(() => page.evaluate((id) => document.querySelector(`[id="${id}"] .annot-label`).textContent, id), '★전제: 글을 쳤다').toBe(TEXT);
  await waitStableRect(page, labelSel(id));
  return id;
}

/* 글자 a..b(포함)를 진짜 마우스로 끈다. overshoot 면 마지막 글자 너머(라벨 밖)에서 놓는다. */
async function dragSelect(page, id, a, b, { overshoot = false } = {}) {
  const ra = await charRect(page, id, a);
  const rb = await charRect(page, id, b);
  const x0 = ra.left + (ra.right - ra.left) * 0.2;
  const x1 = overshoot ? null : rb.right - (rb.right - rb.left) * 0.2;
  await page.mouse.move(x0, ra.cy);
  await page.mouse.down();
  if (overshoot) {
    const lr = await waitStableRect(page, labelSel(id));
    /* 라벨 오른쪽 아래 바깥(섹션 위). ⚠️탐침 실측: 같은 높이로 «오른쪽만» 벗어나면 Chrome 이 선택 끝을 글 맨 앞으로 잡아
       「가나다라」가 골라진다(사람 손으로도 드문 길) — 오른쪽·아래로 벗어나 「마바」가 골라지는 길을 쓴다. */
    const ox = lr.left + lr.width + 30;
    const oy = lr.top + lr.height + 15;
    const hit = await page.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return !!(e && e.closest('[id="secA"]') && !e.closest('.annot-label')); }, [ox, oy]);
    expect(hit, '★전제: 놓는 자리가 라벨 밖 · 섹션 위').toBe(true);
    await page.mouse.move(ox, oy, { steps: 6 });
  } else {
    await page.mouse.move(x1, rb.cy, { steps: 6 });
  }
  await page.mouse.up();
}

async function setHex(page, hex) {
  await page.click('#annot-label-color-hex');
  await page.fill('#annot-label-color-hex', hex);
  await page.press('#annot-label-color-hex', 'Enter');
}
async function setSize(page, v) {
  await page.click('#annot-font-size-num');
  await page.fill('#annot-font-size-num', String(v));
  await page.press('#annot-font-size-num', 'Enter');
}

/* 고른 글자(idx)만 fs·color, 나머지는 기본(base) 그대로인가. fs 를 null 로 주면 크기는 안 본다. */
async function expectOnly(page, id, idx, { fs, color }, msg) {
  await expect.poll(async () => {
    const pc = await perChar(page, id);
    const base = pc.find((_, i) => !idx.includes(i));
    return pc.map(([ch, f, c], i) => (idx.includes(i)
      ? [ch, fs == null || f === fs, c === color]
      : [ch, fs == null || f === base[1], c === base[2]]));
  }, msg).toEqual([...TEXT].map(ch => [ch, true, true]));
  const others = (await perChar(page, id)).filter((_, i) => !idx.includes(i));
  expect(others.every(([, f, c]) => (fs == null || f !== fs) && c !== color), `${msg} — 나머지 글자는 바뀐 값이 아니다`).toBe(true);
}

const stored = (page, id) => page.evaluate((id) => { const b = document.getElementById(id); return { text: b.dataset.text, html: b.dataset.labelHtml || '' }; }, id);

async function runPanel(page, id, idx, picked) {
  await setSize(page, 40);
  // 색은 아직 안 바꿨다 — 크기만 따로 잰다
  await expect.poll(async () => {
    const pc = await perChar(page, id);
    return pc.map(([ch, f], i) => [ch, idx.includes(i) ? f === '40px' : f !== '40px']);
  }, `크기 40 이 「${picked}」에만`).toEqual([...TEXT].map(ch => [ch, true]));
  expect((await state(page, id)).empty, '크기 뒤 빈 span 0').toBe(0);
  await setHex(page, 'ff0000');
  await expectOnly(page, id, idx, { fs: '40px', color: 'rgb(255, 0, 0)' }, `빨강이 「${picked}」에만`);
  expect((await state(page, id)).empty, '색 1 뒤 빈 span 0').toBe(0);
  await setHex(page, '00ff00');
  await expectOnly(page, id, idx, { fs: '40px', color: 'rgb(0, 255, 0)' }, `초록이 「${picked}」에만(두 번째 색도 같은 글자)`);
  const s = await state(page, id);
  expect({ empty: s.empty, selected: s.selected, panelFs: s.panelFs }, '색 2 뒤 빈 span 0 · 어노테이션 선택·패널 유지')
    .toEqual({ empty: 0, selected: true, panelFs: true });
  const st = await stored(page, id);
  expect(st.text, '평문은 그대로').toBe(TEXT);
  expect(/<span[^>]*><\/span>/.test(st.html), `저장값에 빈 span 0 — ${st.html}`).toBe(false);
}

test('RG1 마우스로 끌어 「다라」 → 선택·패널 유지 · 크기/색이 그 글자만 · 빈 span 0', async ({ page }) => {
  const errs = await bootApp(page);
  const id = await scene(page);
  await dragSelect(page, id, 2, 3);
  await expect.poll(async () => (await state(page, id)).sel, '★전제: 끌어서 「다라」를 골랐다').toBe('다라');
  const s = await state(page, id);
  expect({ editing: s.editing, selected: s.selected, panelFs: s.panelFs, panelColor: s.panelColor },
    'mouseup 뒤에도 편집·어노테이션 선택·패널 크기/색 칸이 남는다').toEqual({ editing: true, selected: true, panelFs: true, panelColor: true });
  await runPanel(page, id, [2, 3], '다라');
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('RG2 끌기가 라벨 밖(섹션 위)에서 끝나도 선택·패널이 안 풀린다', async ({ page }) => {
  const errs = await bootApp(page);
  const id = await scene(page);
  await dragSelect(page, id, 4, 5, { overshoot: true });
  await expect.poll(async () => (await state(page, id)).sel, '★전제: 끌어서 「마바」를 골랐다').toBe('마바');
  const s = await state(page, id);
  expect({ editing: s.editing, selected: s.selected, panelFs: s.panelFs }, '라벨 밖 mouseup 뒤에도 편집·선택·패널 유지')
    .toEqual({ editing: true, selected: true, panelFs: true });
  await setHex(page, 'ff0000');
  await expectOnly(page, id, [4, 5], { fs: null, color: 'rgb(255, 0, 0)' }, '빨강이 「마바」에만');
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('RG3 키보드 회귀 — ⇧← 두 번 「마바」 → 크기·색·색 → 그 글자만 · 빈 span 0', async ({ page }) => {
  const errs = await bootApp(page);
  const id = await scene(page);
  await page.keyboard.press('Shift+ArrowLeft');
  await page.keyboard.press('Shift+ArrowLeft');
  await expect.poll(async () => (await state(page, id)).sel, '★전제: 「마바」를 골랐다').toBe('마바');
  await runPanel(page, id, [4, 5], '마바');
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('RG4 다른 곳 클릭 회귀 — 끌어 고른 뒤에도 섹션 빈 곳 클릭 = 편집 마침 · 선택·패널 해제', async ({ page }) => {
  const errs = await bootApp(page);
  const id = await scene(page);
  await dragSelect(page, id, 2, 3);
  await expect.poll(async () => (await state(page, id)).sel, '★전제: 「다라」를 골랐다').toBe('다라');
  // ⛔여기서 «선택 유지»를 전제로 걸지 않는다 — 그건 RG1 이 잰다. 이 칸은 바닥 판에서도 초록이어야 하는 «지키는» 칸이다.
  /* 빈 곳 = 라벨 오른쪽 위 바깥(섹션 위). ⚠️줌 150% 라 섹션 귀퉁이(0.9, 0.1)는 화면 밖(패널 머리)이다 — 바닥 런 실측. */
  const lr0 = await waitStableRect(page, labelSel(id));
  const bx = lr0.left + lr0.width + 40, by = lr0.top - 40;
  await clickAt(page, bx, by, { sel: SEC, not: '.annot-label, .annot-handle, .annot-lw-handle' }, { label: '섹션 빈 곳 ①' });
  await expect.poll(async () => { const s = await state(page, id); return [s.editing, s.selected, s.panelFs]; }, '빈 곳 클릭 = 편집 마침 · 선택·패널 해제')
    .toEqual([false, false, false]);
  expect((await stored(page, id)).text, '쓴 글은 남았다').toBe(TEXT);
  // 편집 밖 — 라벨 클릭으로 고른 뒤 빈 곳 클릭 = 해제(옛 동작)
  const lr = await waitStableRect(page, labelSel(id));
  await clickAt(page, lr.cx, lr.cy, { sel: labelSel(id) }, { label: '라벨 다시 고르기' });
  await expect.poll(async () => { const s = await state(page, id); return [s.selected, s.panelFs]; }, '다시 골랐다').toEqual([true, true]);
  await clickAt(page, bx, by, { sel: SEC, not: '.annot-label, .annot-handle, .annot-lw-handle' }, { label: '섹션 빈 곳 ②' });
  await expect.poll(async () => { const s = await state(page, id); return [s.selected, s.panelFs]; }, '빈 곳 클릭 = 해제').toEqual([false, false]);
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* ══ 검수 F2 · F1 (c844b040 적대 검수 조건부 PASS 뒤) ══════════════════════════════════════════
 * RG5 ★같은 글자에 색→색→크기→색 을 다시 칠해도 span 은 «하나»(겹 span 0 · 빈 span 0) — 범위 조이기(_annotTightenRange)를 따로 잡는다.
 *     ★변이 M2(조이기 뺌)에서 빨강이어야 한다. (빈 span 걷기 안전망은 입증 못 해 뺐다 — ANNOT-EMPTY-SPAN-SWEEP-UNPROVEN-01)
 * RG6 ★mouseup 을 잃은 누름(라벨 mousedown 만) → Esc → 펜 단추 «첫» 클릭이 먹는다(메뉴가 뜬다) — 검수 탐침 C4b 꼴.
 *     ★c844b040 판(걸어 둔 mouseup 을 finish 가 안 뗌)에서 빨강 · 바닥 8608bb13 에선 초록(그 리스너가 아예 없다). */
const spanShape = (page, id) => page.evaluate((id) => {
  const l = document.querySelector(`[id="${id}"] .annot-label`);
  const sp = [...l.querySelectorAll('span')];
  return { spans: sp.length, nested: sp.filter(s => s.querySelector('span')).length, empty: sp.filter(s => !s.textContent).length,
    texts: sp.map(s => s.textContent) };
}, id);

test('RG5 같은 「마바」에 색→색→크기→색 — span 하나 · 겹 span 0 · 빈 span 0 · 그 글자만', async ({ page }) => {
  const errs = await bootApp(page);
  const id = await scene(page);
  await page.keyboard.press('Shift+ArrowLeft');
  await page.keyboard.press('Shift+ArrowLeft');
  await expect.poll(async () => (await state(page, id)).sel, '★전제: 「마바」를 골랐다').toBe('마바');
  await setHex(page, 'ff0000');
  await expectOnly(page, id, [4, 5], { fs: null, color: 'rgb(255, 0, 0)' }, '색 1 이 「마바」에만');
  await setHex(page, '0000ff');
  await expectOnly(page, id, [4, 5], { fs: null, color: 'rgb(0, 0, 255)' }, '색 2 가 「마바」에만');
  await setSize(page, 40);
  await expect.poll(async () => (await perChar(page, id)).map(([ch, f], i) => [ch, [4, 5].includes(i) ? f === '40px' : f !== '40px']), '크기 40 이 「마바」에만')
    .toEqual([...TEXT].map(ch => [ch, true]));
  await setHex(page, '00ff00');
  await expectOnly(page, id, [4, 5], { fs: '40px', color: 'rgb(0, 255, 0)' }, '색 3 이 「마바」에만');
  expect(await spanShape(page, id), '다시 칠해도 span 하나 — 겹 0 · 빈 0').toEqual({ spans: 1, nested: 0, empty: 0, texts: ['마바'] });
  const st = await stored(page, id);
  expect((st.html.match(/<span/g) || []).length, `저장값도 span 하나 — ${st.html}`).toBe(1);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('RG6 mouseup 잃은 라벨 누름 → Esc → 펜 단추 첫 클릭이 먹는다(메뉴가 뜬다)', async ({ page }) => {
  const errs = await bootApp(page);
  const id = await scene(page);
  // 사람 손으로는 «창 밖에서 놓기»에 해당한다 — mouseup 이 문서에 안 온다
  await page.evaluate((id) => {
    document.querySelector(`[id="${id}"] .annot-label`).dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 }));
  }, id);
  await page.keyboard.press('Escape');
  await expect.poll(async () => (await state(page, id)).editing, '★전제: Esc 로 편집을 마쳤다').toBe(false);
  const item = page.locator('#fp-pen-menu .fp-menu-item:text-is("Annotation")');
  await expect(item, '★전제: 메뉴는 닫혀 있다').toBeHidden();
  await page.click('#fp-pen-btn');
  await expect(item, '펜 단추 «첫» 클릭에 메뉴가 뜬다(삼켜지지 않는다)').toBeVisible();
  expect(errs, errs.join(' | ')).toEqual([]);
});
