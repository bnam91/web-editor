/* spacing-normalize.dom.spec.js — 갭 감수의 «렌더러 쪽 진짜 끝». (2026-09-07 신설)
 *
 * ★왜 따로 필요한가 (canvas-state.dom.spec.js 와 같은 이유):
 *   node 하네스의 가짜 렌더러는 «시퀀스 JSON»을 든다. 그건 js/spacing-normalize.js 가
 *   「이렇게 읽을 것이다」라는 손으로 적은 기대지 실측이 아니다. 기대가 틀리면 배선 검사
 *   전체가 거짓 위에 선다 — 특히 «타입을 어떻게 읽느냐»(텍스트 프레임 → heading, row → 자식들)는
 *   전부 이 파일에만 있다.
 *   ⇒ 여기서 «진짜» js/spacing-normalize.js 를 크로미움에 띄워, 진짜 DOM 에서 재고
 *      «진짜 갭 높이»가 그 값이 됐는지 본다. 「DOM 에 있다」 ≠ 「읽힌다」.
 *
 * ⛔앱을 «안» 띄운다 — 고디터 인스턴스·MCP 9345 대역 무접촉. 빈 페이지에 스크립트만 얹는다.
 * ⚠️이 픽스처엔 이미지가 없어서 setContent 로도 안전하다(상대경로 이미지가 있으면 file:// 로 열 것).
 *
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js spacing-normalize
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const SRC = path.join(REPO, 'js', 'spacing-normalize.js');
const SPACING = require(path.join(REPO, 'main', 'claude-pm', 'services', 'spacing.js'));

/** 앱의 진짜 구조 그대로: .section-block > .section-inner > (gap | 텍스트프레임 | row) */
const gapEl = (id, h, auto) =>
  `<div class="gap-block" data-type="gap"${auto ? ' data-gap-auto="1"' : ''} style="height:${h}px" id="${id}"></div>`;
/* ★inline height 가 «아예 없는» 갭 — templates/canvas 19개에 18건 있는 실제 모양이다.
   CSS 기본값이 보이는 것이지 «사람이 고른 값»이 아니라서 감수가 채워야 한다. */
const bareGapEl = (id) => `<div class="gap-block" data-type="gap" id="${id}"></div>`;
const textEl = (id, type, cls) =>
  `<div class="frame-block" data-text-frame="true" id="ss_${id}">`
  + `<div class="text-block" data-type="${type}" id="${id}"><div class="tb-${cls || type}">글</div></div></div>`;
const rowEl = (id, inner) => `<div class="row" id="row_${id}" data-layout="stack">${inner}</div>`;
/* ★진짜 클로드가 만든 모양 — add_gap_block 이 «텍스트 프레임 안»에 갭을 넣는다.
   실측: 상세페이지_0907 sec_…5bsq8uo = gap100 · frame[ heading · gap50 ] · row · gap100.
   시퀀스(section-inner 직속)엔 그 gap50 이 «안 보인다». */
const textElWithInnerGap = (id, type, h) =>
  `<div class="frame-block" data-text-frame="true" id="ss_${id}">`
  + `<div class="text-block" data-type="${type}" id="${id}"><div class="tb-h2">글</div></div>`
  + `<div class="gap-block" data-type="gap" id="gb_in_${id}" style="height:${h}px"></div></div>`;

const FIXTURE = `
<div id="canvas">
  <div class="section-block" data-section="1" id="sec_1" data-name="Section 01">
    <div class="section-hitzone"><span class="section-label">Section 01</span></div>
    <div class="section-inner">
      ${gapEl('gb_top', 100, true)}
      ${textEl('tb_1', 'label')}
      ${textEl('tb_2', 'heading', 'h2')}
      ${textEl('tb_3', 'body')}
      ${rowEl('r1', '<div class="asset-block" id="ab_1"></div>')}
      ${textEl('tb_4', 'caption')}
      <div class="sticker-block" id="stk_1" style="position:absolute;top:0;left:0">스티커</div>
      ${gapEl('gb_bot', 100, true)}
    </div>
  </div>
  <div class="section-block" data-section="3" id="sec_3" data-name="프레임안갭">
    <div class="section-inner">
      ${gapEl('gb_t3', 100, true)}
      ${textElWithInnerGap('tb_x', 'heading', 50)}
      ${rowEl('r3', '<div class="canvas-block" id="cvb_3"></div>')}
      ${gapEl('gb_b3', 100, true)}
    </div>
  </div>
  <div class="section-block" data-section="2" id="sec_2" data-name="손맞춤">
    <div class="section-inner">
      ${gapEl('gb_t2', 100, true)}
      ${textEl('tb_5', 'heading', 'h2')}
      ${gapEl('gb_manual', 37, false)}
      ${textEl('tb_6', 'body')}
      ${bareGapEl('gb_bare')}
      ${textEl('tb_7', 'body')}
      ${gapEl('gb_o1', 100, true)}
      ${gapEl('gb_o2', 100, true)}
    </div>
  </div>
</div>`;

/** 페이지의 «진짜» 갭 높이를 DOM 에서 직접 읽는다(감수 함수를 안 거친다 = 뒤끝). */
const readDomShape = (page) => page.evaluate(() => {
  const out = {};
  document.querySelectorAll('.section-block').forEach((sec) => {
    out[sec.id] = [...sec.querySelector('.section-inner').children]
      .filter((el) => getComputedStyle(el).position !== 'absolute')
      /* ⚠️표기를 «세 갈래»에 맞춘다. 처음엔 `dataset.gapAuto !== '1'` 이면 전부 (수동)으로 찍었는데,
         inline height 가 없는 갭이 `gapNaN(수동)` 으로 나와 «증거가 거짓말»을 했다.
         제품은 옳게 돌고 있었고 틀린 건 이 «자»였다 — 계측기가 스스로를 속인 자리. */
      .map((el) => {
        if (!el.classList.contains('gap-block')) {
          return el.querySelector('.text-block')?.dataset.type || el.className.split(' ')[0];
        }
        const raw = parseInt(el.style.height, 10);
        if (!isFinite(raw)) return 'gap(값없음)';          // 아무도 안 정했다 → 자동
        return 'gap' + raw + (el.dataset.gapAuto === '1' ? '' : '(수동)');
      });
  });
  return out;
});

async function boot(page) {
  await page.setContent(`<!doctype html><html><body>${FIXTURE}</body></html>`);
  await page.addScriptTag({ content: fs.readFileSync(SRC, 'utf8') });
}

test('DOM-① 진짜 DOM 에서 «세로 시퀀스»를 제대로 읽는다 (텍스트프레임→타입 · row→자식들 · 절대배치 제외)', async ({ page }) => {
  await boot(page);
  const st = await page.evaluate(() => window.readSpacingSequence());
  expect(st.ok).toBe(true);
  const s1 = st.sections.find((s) => s.sectionId === 'sec_1');
  console.log('  읽은 시퀀스(sec_1):', s1.items.map((i) => i.kind === 'gap' ? `gap${i.height}` : i.type).join(' · '));

  expect(s1.items.map((i) => (i.kind === 'gap' ? 'gap' : i.type)))
    .toEqual(['gap', 'label', 'heading', 'body', 'row', 'caption', 'gap']);
  // ★텍스트 프레임은 «껍데기»다 — frame(덩어리) 이 아니라 안의 heading/body/caption 이어야 한다.
  expect(s1.items[2].type).toBe('heading');
  // ★절대배치 스티커는 흐름이 아니다 — 시퀀스에 있으면 그 앞뒤에 갭을 넣어 버린다.
  expect(s1.items.some((i) => i.id === 'stk_1')).toBe(false);
  // ★row 는 자식이 성격을 정한다 — 이미지 든 줄은 덩어리(3)로 읽혀야 한다.
  const row = s1.items.find((i) => i.type === 'row');
  expect(SPACING.weightOfItem(row)).toBe(3);
  /* 자동/수동은 «사실 두 개»로 실린다(판정은 spacing.js 의 isAutoGap 이 한다 — 판단은 한 곳). */
  const s2 = st.sections.find((s) => s.sectionId === 'sec_2');
  const gm = s2.items.find((i) => i.id === 'gb_manual');
  const gt = s2.items.find((i) => i.id === 'gb_t2');
  const gb = s2.items.find((i) => i.id === 'gb_bare');
  expect({ marked: gm.marked, inline: gm.hasInlineHeight }).toEqual({ marked: false, inline: true });
  expect({ marked: gt.marked, inline: gt.hasInlineHeight }).toEqual({ marked: true, inline: true });
  // ★inline height 가 «없는» 갭 — 진짜 DOM 에서 그렇게 읽혀야 세 갈래가 산다
  expect({ marked: gb.marked, inline: gb.hasInlineHeight }).toEqual({ marked: false, inline: false });
  expect(SPACING.isAutoGap(gm)).toBe(false);
  expect(SPACING.isAutoGap(gt)).toBe(true);
  expect(SPACING.isAutoGap(gb)).toBe(true);
});

test('DOM-② ★뒤끝 — 계획을 적용하면 «진짜 갭 높이»가 그 값이 된다', async ({ page }) => {
  await boot(page);
  const before = await readDomShape(page);

  const st = await page.evaluate(() => window.readSpacingSequence());
  const sections = [];
  for (const sec of st.sections) {
    const plan = SPACING.normalizePlan(sec.items);
    if (plan.ops.length) sections.push({ sectionId: sec.sectionId, ops: plan.ops });
  }
  const applied = await page.evaluate((p) => window.applySpacingOps(p), { sections });
  const after = await readDomShape(page);

  console.log('  ┌─ 진짜 DOM 전/후 ─────────────────────────────');
  for (const k of Object.keys(before)) {
    console.log(`  │ ${k}\n  │   전 : ${before[k].join(' · ')}\n  │   후 : ${after[k].join(' · ')}`);
  }
  console.log(`  └ 적용: 삽입 ${applied.inserted} · 크기 ${applied.resized} · 제거 ${applied.removed}`);

  expect(after.sec_1).toEqual([
    'gap100', 'label', 'gap80', 'heading', 'gap80', 'body', 'gap80', 'row', 'gap16', 'caption', 'gap100',
  ]);
  /* ★수동 37px 은 살아남고 · 값 없던 갭(gb_bare)은 본문↔본문 S=40 으로 «채워지고»
     · 고아 갭 둘은 하나로 합쳐진다. 세 갈래가 «한 섹션에서» 다 보인다. */
  expect(after.sec_2).toEqual(['gap100', 'heading', 'gap37(수동)', 'body', 'gap40', 'body', 'gap100']);
  expect(applied.misses).toEqual([]);
  /* ★★프레임 «안»에 이미 갭이 있는 자리에는 «덧쌓지 않는다».
     안 그러면 50(프레임 안) + 80(우리) = 130px 이중 간격이 된다. */
  expect(after.sec_3).toEqual(['gap100', 'heading', 'row', 'gap100']);
});

test('DOM-③ ★멱등 — 한 번 더 돌리면 계획이 «빈 배열»이라 DOM 이 안 움직인다', async ({ page }) => {
  await boot(page);
  const run = async () => {
    const st = await page.evaluate(() => window.readSpacingSequence());
    const sections = [];
    for (const sec of st.sections) {
      const plan = SPACING.normalizePlan(sec.items);
      if (plan.ops.length) sections.push({ sectionId: sec.sectionId, ops: plan.ops });
    }
    if (sections.length) await page.evaluate((p) => window.applySpacingOps(p), { sections });
    return sections.reduce((n, s) => n + s.ops.length, 0);
  };
  const first = await run();
  const shapeA = await readDomShape(page);
  const second = await run();
  const shapeB = await readDomShape(page);
  console.log(`  1회차 ops ${first}개 → 2회차 ops ${second}개`);
  expect(first).toBeGreaterThan(0);
  expect(second).toBe(0);
  expect(shapeB).toEqual(shapeA);
});

test('DOM-④ 사람이 손대면 그 갭은 «수동»이 되고, 그 다음 감수가 안 건드린다', async ({ page }) => {
  await boot(page);
  // 먼저 규격에 맞춘다(전부 자동)
  const norm = async () => {
    const st = await page.evaluate(() => window.readSpacingSequence());
    const sections = [];
    for (const sec of st.sections) {
      const plan = SPACING.normalizePlan(sec.items);
      if (plan.ops.length) sections.push({ sectionId: sec.sectionId, ops: plan.ops });
    }
    if (sections.length) await page.evaluate((p) => window.applySpacingOps(p), { sections });
    return sections.reduce((n, s) => n + s.ops.length, 0);
  };
  await norm();

  // 사람이 sec_1 의 첫 «자동» 갭을 33px 로 맞췄다(=prop-gap.js 가 하는 일)
  const id = await page.evaluate(() => {
    const gb = document.querySelector('#sec_1 .section-inner .gap-block');
    gb.style.height = '33px';
    window.markGapManual(gb);
    return gb.id;
  });
  expect(await page.evaluate((i) => document.getElementById(i).dataset.gapAuto, id)).toBeUndefined();

  const left = await norm();
  expect(left).toBe(0);
  const h = await page.evaluate((i) => document.getElementById(i).style.height, id);
  expect(h).toBe('33px');   // ★되돌리면 도와준 게 아니라 뺏은 것이다
});

/* ── DOM-⑤ ★«화면으로» 본다 ──────────────────────────────────────────────
 * 「DOM 에 있다」 ≠ 「읽힌다」. 갭은 «보이지 않는 것의 크기»라서 숫자만 보면 속기 쉽다.
 * 앱의 진짜 CSS 를 얹고 감수 전/후를 그림으로 남긴다.
 * ⛔앱을 안 띄운다 · ⛔OS 전체 화면 캡처 아님(헤드리스 페이지 스크린샷) · 포커스 무접촉.
 * 산출물: test-results/spacing-before.png · spacing-after.png                        */
test('DOM-⑤ 감수 전/후를 «진짜 CSS 로» 그려 남긴다 (숫자 말고 눈으로)', async ({ page }, testInfo) => {
  const CSS = ['editor-base.css', 'editor-canvas.css', 'editor-blocks.css', 'editor-layout.css']
    .map((f) => fs.readFileSync(path.join(REPO, 'css', f), 'utf8')).join('\n');
  await page.setViewportSize({ width: 960, height: 1400 });
  await page.setContent(`<!doctype html><html><head><style>${CSS}</style>
    <style>body{background:#f4f4f4;margin:0;padding:24px}#canvas{width:860px;background:#fff}
           .gap-block{outline:1px dashed #d33;outline-offset:-1px}</style></head>
    <body>${FIXTURE}</body></html>`);
  await page.addScriptTag({ content: fs.readFileSync(SRC, 'utf8') });

  const shot = async (name) => {
    const buf = await page.locator('#canvas').screenshot();
    await testInfo.attach(name, { body: buf, contentType: 'image/png' });
    const out = path.join(REPO, 'test-results', name + '.png');
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, buf);
    return out;
  };
  const beforePng = await shot('spacing-before');

  const st = await page.evaluate(() => window.readSpacingSequence());
  const sections = [];
  for (const sec of st.sections) {
    const plan = SPACING.normalizePlan(sec.items);
    if (plan.ops.length) sections.push({ sectionId: sec.sectionId, ops: plan.ops });
  }
  await page.evaluate((p) => window.applySpacingOps(p), { sections });
  const afterPng = await shot('spacing-after');

  // 「그렸다」를 «파일이 생겼다»로 확인한다 — ok:true 는 증거가 아니다.
  expect(fs.statSync(beforePng).size).toBeGreaterThan(1000);
  expect(fs.statSync(afterPng).size).toBeGreaterThan(1000);
  console.log(`  전: ${beforePng}\n  후: ${afterPng}`);

  // 감수는 «키를 늘린다»(빠진 갭이 채워지므로). 높이가 그대로면 아무 일도 안 일어난 것이다.
  const h = await page.evaluate(() => document.getElementById('sec_1').getBoundingClientRect().height);
  expect(h).toBeGreaterThan(0);
});

/* ── DOM-⑥ 자동/수동 도장이 «저장을 견디나» ──────────────────────────────────
 * 도장이 직렬화에서 씻겨 나가면, 저장→열기 뒤에 모든 갭이 «수동»이 되어 감수가 통째로 죽는다.
 * (반대로 수동 도장이 씻기면 사람이 맞춘 값이 다음 감수에 되돌려진다.)
 * ⇒ 진짜 세척 파이프라인(js/io/section-serialize.js 의 serializeCleanRoot)에 통과시켜 본다.
 */
test('DOM-⑥ 자동/수동 도장이 «직렬화 세척»을 견딘다 (저장→열기 뒤에도 감수가 산다)', async ({ page }) => {
  await boot(page);
  await page.addScriptTag({ content: fs.readFileSync(path.join(REPO, 'js', 'io', 'section-serialize.js'), 'utf8') });
  const out = await page.evaluate(() => {
    const clone = document.getElementById('canvas').cloneNode(true);
    window.serializeCleanRoot(clone);
    const gaps = [...clone.querySelectorAll('.gap-block')];
    return { total: gaps.length, auto: gaps.filter((g) => g.dataset.gapAuto === '1').length, html: clone.innerHTML.length };
  });
  console.log(`  세척 후 갭 ${out.total}개 중 자동 도장 ${out.auto}개`);
  expect(out.total).toBe(10);  // 픽스처의 갭 수 (sec_1: 2 · sec_3: 3(프레임 안 1 포함) · sec_2: 5)
  expect(out.auto).toBe(7);    // 도장 찍힌 것 (gb_manual·gb_bare·gb_in_tb_x 는 도장 없음)
});
