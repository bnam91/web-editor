/* fix5-annot-label-lines-h2 — 어노테이션 라벨 «줄 추가·줄바꿈» (FIX5 1017t1h2 재투입 · t23-h2h3).
 *
 * ★현빈 원문(👉 뒤가 판정): 「라벨의 경우 텍스트인 경우 텍스트 줄을 추가할 수 있겠니? 지금은 라벨텍스트가 줄바꿈도 안되네
 *   일반 텍스트 블럭이나 줄추가되듯해줘. 👉 잘안되는거 같아. qa해봐」
 * ★범위(reports/S6-FIX5/plan-h2h3.md 1절): Enter = 줄바꿈 몸(annotation-select.js onKey)은 52837a63 부터 있다(annotation-1013t2 AL1·AL6).
 *   사람 손에서 갈리는 자리 둘을 잰다 —
 *   h2-① 편집 중 줄 넣을 자리를 «한 번 눌러» 캐럿을 놓으면 그 click 이 섹션으로 올라가 어노테이션 선택·패널이 걷혔다.
 *   h2-② (가설 · 재현 안 됨 · ANNOT-LABEL-BR-HTML-RESTYLE-UNPROVEN-01) 줄 든 «서식» 라벨에 패널 «전체» 값 → 서식이 지워지나.
 *     실측: 편집 DOM 은 줄바꿈을 날 \n 으로 실어 바닥 판에서도 초록 ⇒ LN3 는 «지키는 칸»이다.
 *
 * ★무엇을 잠그나
 *   LN1 (지키는 칸) 끝에서 Enter → ★치기 전에 라벨이 2줄 · 편집 이어짐 → B → Esc → 'A\nB' · 2줄 · 저장 왕복 2줄 · 피그마 JSON 글에 \n
 *   LN2 편집 중 «A|B» 사이를 진짜 마우스로 한 번 눌러 캐럿 → 어노테이션 선택·패널·편집 유지 → ⇧Enter → Esc → 'A\nB' · 2줄
 *   LN3 'AB'⏎'CD' 의 «CD» 만 빨강 → 편집 밖에서 패널 «전체» 크기 30 → 화면에 CD 빨강·2줄·<br> 그대로(화면 = 저장)
 *   LN4 (지키는 칸) 편집 중 섹션 빈 곳 클릭 = 마침 · 선택 해제 / 편집 밖 라벨 끌기 = 어노테이션 이동(점이 옮겨진다)
 * ★양성대조: GD1001_ROOT=<git archive 8608bb13 사본> 이면 LN2 빨강 · LN1·LN3·LN4 초록이어야 한다(R1 실측 그대로).
 * ⛔waitForTimeout 0 — 대기는 «재는 값» 자체를 expect.poll 로.
 * ⛔줄 수는 rect 가 아니라 offsetHeight ÷ line-height 로 잰다(annotation-1013t2 labelState 와 같은 자).
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');
const { clickAt } = require('./_click-at.js');

const SEC = '[id="secA"]';
const OUTSIDE = '.annot-label, .annot-handle, .annot-lw-handle';

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
  await expect.poll(() => page.evaluate(() => document.activeElement?.classList?.contains('annot-label')), '생성 직후 라벨 편집에 들어갔다').toBe(true);
  await page.keyboard.press('Escape');
  await expect.poll(() => penOn(page), 'Esc 로 펜 모드 종료').toBe(false);
  return page.evaluate(() => { const all = document.querySelectorAll('#secA .annotation-block'); return all[all.length - 1].id; });
}

/* 지금 상태 한 장 — 편집? 골랐나? 패널? 데이터 · 줄 수 · <br> 수 · 라벨 innerHTML. */
const state = (page, id) => page.evaluate((id) => {
  const b = document.getElementById(id); const l = b.querySelector('.annot-label'); const cs = getComputedStyle(l);
  const inner = l.offsetHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - parseFloat(cs.borderTopWidth) - parseFloat(cs.borderBottomWidth);
  return {
    editing: l.getAttribute('contenteditable') === 'true' && document.activeElement === l,
    ce: l.getAttribute('contenteditable'),
    selected: b.classList.contains('selected'),
    panel: !!document.querySelector('#panel-right [data-prop-panel="annotation"]'),
    panelFs: !!document.querySelector('#panel-right #annot-font-size-num'),
    data: b.dataset.text, html: b.dataset.labelHtml || '', fs: b.dataset.labelFontSize || '',
    lines: Math.round(inner / parseFloat(cs.lineHeight)), inner: l.innerHTML,
  };
}, id);

/* 글자마다 «그려진» 색(computed). */
const perCharColor = (page, id) => page.evaluate((id) => {
  const l = document.querySelector(`[id="${id}"] .annot-label`);
  const out = [];
  const w = document.createTreeWalker(l, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    const c = getComputedStyle(n.parentElement).color;
    for (const ch of n.nodeValue) if (ch !== '\n') out.push([ch, c]);
  }
  return out;
}, id);

/* 라벨 글자 i 의 화면 사각형. */
const charRect = (page, id, i) => page.evaluate(([id, i]) => {
  const l = document.querySelector(`[id="${id}"] .annot-label`);
  const w = document.createTreeWalker(l, NodeFilter.SHOW_TEXT);
  let pos = 0;
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    const v = n.nodeValue.replace(/\n/g, '');
    if (i < pos + v.length) {
      let k = -1, seen = -1;
      while (seen < i - pos) { k++; if (n.nodeValue[k] !== '\n') seen++; }
      const r = document.createRange(); r.setStart(n, k); r.setEnd(n, k + 1);
      const b = r.getBoundingClientRect();
      return { left: b.left, right: b.right, top: b.top, bottom: b.bottom, cy: (b.top + b.bottom) / 2 };
    }
    pos += v.length;
  }
  return null;
}, [id, i]);

/* 만들기 → 라벨 고르기 → 더블클릭 편집(글 전체가 골라진 채). */
async function scene(page) {
  await setup(page);
  const id = await makeAnnotation(page);
  const lr = await waitStableRect(page, labelSel(id));
  await clickAt(page, lr.cx, lr.cy, { sel: labelSel(id) }, { label: '라벨 고르기' });
  await expect.poll(async () => { const s = await state(page, id); return [s.selected, s.panel]; }, '★전제: 골랐고 패널이 떴다').toEqual([true, true]);
  await clickAt(page, lr.cx, lr.cy, { sel: labelSel(id) }, { label: '라벨 더블클릭', dbl: true });
  await expect.poll(async () => (await state(page, id)).editing, '★전제: 편집에 들어갔다').toBe(true);
  await expect.poll(() => page.evaluate((id) => String(window.getSelection()) === document.querySelector(`[id="${id}"] .annot-label`).textContent, id), '★전제: 글 전체가 골라졌다').toBe(true);
  return id;
}

/* 섹션 빈 곳(라벨 오른쪽 위 바깥). */
async function blankSpot(page, id) {
  const lr = await waitStableRect(page, labelSel(id));
  return { x: lr.left + lr.width + 60, y: lr.top - 50 };
}

test('LN1 끝에서 Enter → 치기 전에 2줄 · B · Esc → A\\nB · 2줄 · 저장 왕복 · 피그마 JSON 에 \\n', async ({ page }) => {
  const errs = await bootApp(page);
  const id = await scene(page);
  await page.keyboard.type('A');
  await expect.poll(async () => (await state(page, id)).lines, '★전제: 한 줄').toBe(1);
  await page.keyboard.press('Enter');
  await expect.poll(async () => { const s = await state(page, id); return [s.editing, s.lines]; }, '끝에서 Enter = 글을 치기 «전»에 새 줄이 보인다 · 편집 이어짐')
    .toEqual([true, 2]);
  await page.keyboard.type('B');
  await page.keyboard.press('Escape');
  await expect.poll(async () => { const s = await state(page, id); return [s.ce, s.data, s.lines]; }, 'Esc 로 마치고 A\\nB · 2줄').toEqual(['false', 'A\nB', 2]);
  await page.evaluate(() => { const c = document.getElementById('canvas'); c.innerHTML = window.getSerializedCanvas(); window.rebindAll(); });
  const s = await state(page, id);
  expect([s.data, s.lines], '저장 왕복 뒤에도 A\\nB · 2줄').toEqual(['A\nB', 2]);
  /* ★내보내기는 state.pages 를 읽는다 — 앱의 제 길(flushCurrentPage)로 먼저 싣는다(annot-same-as-other-blocks fixture 와 같다). */
  const fig = await page.evaluate(() => { window.flushCurrentPage(); return JSON.stringify(window.buildFigmaExportJSON(null)); });
  const figTexts = (fig.match(/"(?:t|text|characters)":"[^"]*"/g) || []).filter(t => /A/.test(t) && /B/.test(t));
  expect(fig.includes('A\\nB'), `피그마 JSON 의 라벨 글에 줄바꿈이 실렸다 — ${figTexts.join(' · ')}`).toBe(true);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('LN2 편집 중 «A|B» 사이를 한 번 눌러 캐럿 → 선택·패널·편집 유지 → ⇧Enter → A\\nB · 2줄', async ({ page }) => {
  const errs = await bootApp(page);
  const id = await scene(page);
  await page.keyboard.type('AB');
  await expect.poll(() => page.evaluate((id) => document.querySelector(`[id="${id}"] .annot-label`).textContent, id), '★전제: AB 를 쳤다').toBe('AB');
  const rb = await charRect(page, id, 1);
  await clickAt(page, rb.left + 1, rb.cy, { sel: labelSel(id) }, { label: 'A|B 사이' });
  await expect.poll(async () => { const s = await state(page, id); return { editing: s.editing, selected: s.selected, panel: s.panel }; },
    '라벨 안 한 번 클릭 = 캐럿만 옮긴다(텍스트블럭처럼) — 어노테이션 선택·패널·편집 유지')
    .toEqual({ editing: true, selected: true, panel: true });
  await page.keyboard.press('Shift+Enter');
  await expect.poll(async () => (await state(page, id)).lines, '⇧Enter 로 가운데에 줄이 생겼다').toBe(2);
  await page.keyboard.press('Escape');
  await expect.poll(async () => { const s = await state(page, id); return [s.ce, s.data, s.lines, s.selected]; }, '마침 → A\\nB · 2줄 · 선택 유지')
    .toEqual(['false', 'A\nB', 2, true]);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('LN3 (지키는 칸) 줄 든 서식 라벨 — CD 만 빨강 → 패널 «전체» 크기 30 → 화면에 CD 빨강 · 2줄 그대로', async ({ page }) => {
  const errs = await bootApp(page);
  const id = await scene(page);
  await page.keyboard.type('AB');
  await page.keyboard.press('Enter');
  await page.keyboard.type('CD');
  await page.keyboard.press('Shift+ArrowLeft');
  await page.keyboard.press('Shift+ArrowLeft');
  await expect.poll(() => page.evaluate(() => String(window.getSelection())), '★전제: CD 를 골랐다').toBe('CD');
  await page.click('#annot-label-color-hex');
  await page.fill('#annot-label-color-hex', 'ff0000');
  await page.press('#annot-label-color-hex', 'Enter');
  const RED = 'rgb(255, 0, 0)';
  await expect.poll(async () => (await perCharColor(page, id)).map(([ch, c]) => [ch, c === RED]), '★전제: CD 만 빨강')
    .toEqual([['A', false], ['B', false], ['C', true], ['D', true]]);
  const s0 = await state(page, id);
  /* 줄바꿈은 편집 DOM 꼴에 따라 `<br>`(div 를 편 것) 또는 날 `\n`(white-space:pre) 로 실린다 — 둘 다 «줄»이다. */
  expect({ data: s0.data, nl: /<br>|\n/.test(s0.html), lines: s0.lines }, `★전제: 저장값 = AB\\nCD · 서식 HTML 에 줄바꿈 · 2줄 — ${s0.html}`)
    .toEqual({ data: 'AB\nCD', nl: true, lines: 2 });
  // 편집 밖으로 — 빈 곳 클릭(저장 선택을 버린다) → 라벨 다시 고르기
  const bs = await blankSpot(page, id);
  await clickAt(page, bs.x, bs.y, { sel: SEC, not: OUTSIDE }, { label: '섹션 빈 곳' });
  await expect.poll(async () => (await state(page, id)).selected, '★전제: 해제됐다').toBe(false);
  const lr = await waitStableRect(page, labelSel(id));
  await clickAt(page, lr.cx, lr.cy, { sel: labelSel(id) }, { label: '라벨 다시 고르기' });
  await expect.poll(async () => { const s = await state(page, id); return [s.selected, s.panelFs]; }, '★전제: 다시 골랐다').toEqual([true, true]);
  await page.click('#annot-font-size-num');
  await page.fill('#annot-font-size-num', '30');
  await page.press('#annot-font-size-num', 'Enter');
  await expect.poll(async () => (await state(page, id)).fs, '★전제: 라벨 전체 크기 30 이 저장됐다').toBe('30');
  await expect.poll(async () => (await perCharColor(page, id)).map(([ch, c]) => [ch, c === RED]), '전체 크기를 바꿔도 화면의 CD 빨강이 남는다(화면 = 저장)')
    .toEqual([['A', false], ['B', false], ['C', true], ['D', true]]);
  const s = await state(page, id);
  expect({ lines: s.lines, nl: /<br>|\n/.test(s.inner), data: s.data }, `줄도 그대로 · 화면 라벨에 줄바꿈 — ${s.inner}`).toEqual({ lines: 2, nl: true, data: 'AB\nCD' });
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('LN4 회귀 — 편집 중 빈 곳 클릭 = 마침·해제 / 편집 밖 라벨 끌기 = 어노테이션 이동', async ({ page }) => {
  const errs = await bootApp(page);
  const id = await scene(page);
  await page.keyboard.type('XY');
  const bs = await blankSpot(page, id);
  await clickAt(page, bs.x, bs.y, { sel: SEC, not: OUTSIDE }, { label: '섹션 빈 곳' });
  await expect.poll(async () => { const s = await state(page, id); return [s.ce, s.selected, s.panel, s.data]; }, '빈 곳 클릭 = 편집 마침 · 선택·패널 해제 · 글 남음')
    .toEqual(['false', false, false, 'XY']);
  // 편집 밖 — 라벨 고르기 → 끌기 = 어노테이션 이동
  const lr = await waitStableRect(page, labelSel(id));
  await clickAt(page, lr.cx, lr.cy, { sel: labelSel(id) }, { label: '라벨 고르기' });
  await expect.poll(async () => (await state(page, id)).selected, '★전제: 골랐다').toBe(true);
  const p0 = await page.evaluate((id) => document.getElementById(id).dataset.points, id);
  await page.mouse.move(lr.cx, lr.cy);
  await page.mouse.down();
  await page.mouse.move(lr.cx + 40, lr.cy + 30, { steps: 8 });
  await page.mouse.up();
  await expect.poll(() => page.evaluate((id) => document.getElementById(id).dataset.points, id), '라벨 끌기로 어노테이션 점이 옮겨졌다').not.toBe(p0);
  const s = await state(page, id);
  expect([s.ce, s.selected], '끌기 뒤 편집 아님 · 선택 유지').toEqual(['false', true]);
  expect(errs, errs.join(' | ')).toEqual([]);
});
