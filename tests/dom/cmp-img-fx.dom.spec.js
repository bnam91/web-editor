/* cmp-img-fx.dom.spec.js — 1012t1D4 비교(comparison) 셀 이미지 «블러(Redact)·색상편집». (2026-10-12 · S1 하네스)
 *
 * ★현빈 원문: 「(컴패리전 셀에) 이미지를 넣으면 해당 이미지에 에셋블럭이 들어간 것처럼 블러(redact) 기능 및 색상편집 가능하게 해줄 것」
 *
 * ★설계: 정본 = 모델(행 필드 row.redact 0..100 · row.adj 7키) — renderComparison 이 칸 div 를 매번 새로 만들므로 렌더가 매번 칠한다.
 *   블러 = 칸 div 의 ::after backdrop-filter(css/editor-layout.css · C1 공용 모듈 js/effects/image-redact.js applyRedact)
 *   색보정 = 칸 div 의 filter:url(#img-color-adj-…)(js/image-color-adjust.js · 대상 술어 ADJ_TARGET_SEL 에 칸을 더함)
 *
 * 칸
 *   K1 adj 행 → data-adj-* · filter url · 재렌더 · 저장 왕복(serializeProject → applyProjectData) 생존
 *   K2 내보내기 클론(renderComponentsInClone) → ADJ_DIRTY_SEL 이 칸을 집고 bake 가 배경을 구운 PNG 로 · neutralize 가 블러 칸을 덮개로
 *   K3 redact 보임 — C1 asset-redact 와 같은 자(::after backdrop blur(12px) + 가운데 줄 B 채널 sd) · 색보정과 공존(둘 다 생존 · 그래도 흐림)
 *   K4 패널 — 「Image」 절 바로 아래 「블러 (Redact)」 · 슬라이더 → 모델 · undo 1번 = 꺼짐 · 편집기(더블클릭) 색보정 슬라이더 → 모델 · Esc = 패널 닫힘
 *   K5 0/기본값 = 흔적 0(속성·변수·필터·모델 키·outerHTML)
 *   K6 문(MCP/AI) cols 교체 뒤 redact·adj 생존 · 범위 밖 클램프 · adj 꼴 아님 = INVALID
 *   K7 Figma JSON — 블러 칸 원본 imgSrc 가 JSON 에 없다(양성대조: 끄면 있다)
 *
 * ⛔고정 대기 0(waitForFunction / expect.poll) · 픽셀은 요소 스크린샷(locator.screenshot)으로 — 화면 사각형을 숫자와 견주지 않는다.
 * ★파일창은 안 연다 — 그림은 dataURL 을 row.imgSrc 에 직접 넣는다.
 *
 * 음성대조(쓴 이가 정한 것 — ★이 파일은 아직 안 돌았다 · 태양 정지 지시):
 *   · js/image-color-adjust.js ADJ_TARGET_SEL 에서 `, .comparison-block .cmp-img` 빼기   ⇒ K2(bake) · K4(편집기 패널 안 뜸) 빨강
 *   · js/blocks/comparison-block.js 렌더의 `applyRedact(r, src ? row.redact : 0);` 를 `applyRedact(r, 0);`  ⇒ K3 · K4 · K6 빨강
 *   · 같은 곳 `if (_adj) window.applyImgColorAdjust?.(r, _adj);` 주석                   ⇒ K1 · K2 · K3(공존) 빨강
 *   · css/editor-layout.css 비교 칸 선택자 줄(`…cmp-img[data-redact]::after,`) 지우기      ⇒ K3(계산값·픽셀) 빨강
 *   · js/effects/image-redact.js REDACT_HOST_SEL 에서 비교 칸 빼기                        ⇒ K2(neutralize 덮개) 빨강
 *   · comparison-block.js CMP_ROW_KEEP 의 `redact:` 줄 지우기                              ⇒ K6(cols 교체 생존) 빨강
 *   · prop-comparison.js `${imgSection}${redactSection}` → `${imgSection}`                  ⇒ K4 빨강
 *   · export-figma-json.js _cmpRow 의 `if (rd > 0) return …` 줄 지우기                     ⇒ K7 빨강
 *
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js cmp-img-fx
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');

const SEC = '<div class="section-block" data-section="1" id="sB"><div class="section-hitzone"></div><div class="section-inner"><div class="gap-block" data-type="gap" style="height:40px"></div></div></div>';
const cellSel = (c, r) => `#sB .comparison-block .cmp-row[data-col-idx="${c}"][data-row-idx="${r}"]`;
const ADJ_SAT = { exposure: 0, contrast: 0, saturation: -1, temperature: 0, tint: 0, highlights: 0, shadows: 0 };
/* 흐림 판정 문턱 — C1 asset-redact R4 와 같은 자(가운데 줄 B 채널 표준편차) */
const SD_ON = 50, SD_OFF = 15;

/* 칼럼0: [줄무늬 그림 칸, 글자, 빈 슬롯] · 칼럼1: [줄무늬 그림 칸, 글자, 글자] — 행 필드는 extra 로 칼럼0 첫 칸에 */
async function setup(page, extra = {}) {
  await page.setViewportSize({ width: 1700, height: 1200 });
  const errs = await bootApp(page);
  await page.evaluate(([sec, ex]) => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', sec);
    window.rebindAll?.(); window.applyZoom?.(100);
    window.deselectAll?.(); window.selectSection(document.getElementById('sB'));
    /* 줄무늬 PNG — 파랑/노랑 6px (C1 R4 와 같은 그림) */
    const cv = document.createElement('canvas'); cv.width = 240; cv.height = 180;
    const x = cv.getContext('2d');
    for (let i = 0; i < 240; i += 12) { x.fillStyle = '#0000ff'; x.fillRect(i, 0, 6, 180); x.fillStyle = '#ffff00'; x.fillRect(i + 6, 0, 6, 180); }
    window.__SRC = cv.toDataURL('image/png');
    const img = (o) => ({ type: 'image', text: '', imgSrc: window.__SRC, imgFit: 'cover', ...o });
    window.addComparisonBlock({ cols: [
      { title: 'A', rows: [img(ex), { type: 'text', text: 'a1' }, { type: 'image', text: '', imgSrc: '', imgFit: 'cover' }] },
      { title: 'B', rows: [img({}), { type: 'text', text: 'b1' }, { type: 'text', text: 'b2' }] }], featured: 1 });
    window.__blk = [...document.querySelectorAll('#sB .comparison-block')].pop();
    window.__bid = window.__blk?.id;
    window.buildLayerPanel?.(); window.deselectAll?.();
    window.__blk?.scrollIntoView({ block: 'center' });
  }, [SEC, extra]);
  await page.waitForFunction(() => !!window.__blk && window.__blk.isConnected && !window.__blk.classList.contains('selected'), null, { timeout: 5000 });
  return errs;
}
/* 칸 상태 — 매번 다시 찾는다(재렌더·undo·왕복 뒤 div 가 바뀐다) */
const cell = (page, c = 0, r = 0) => page.evaluate(([c, r]) => {
  const b = document.getElementById(window.__bid);
  if (!b) throw new Error('블럭을 다시 찾았는데 없다: ' + window.__bid);
  const e = b.querySelector(`.cmp-row[data-col-idx="${c}"][data-row-idx="${r}"]`);
  const after = getComputedStyle(e, '::after');
  const row = window.getComparisonCols(b.dataset)[c].rows[r];
  return {
    redactAttr: e.getAttribute('data-redact'),
    blurVar: (e.style.getPropertyValue('--redact-blur') || '').trim(),
    afterContent: after.content,
    afterBackdrop: after.backdropFilter || after.webkitBackdropFilter || '',
    position: getComputedStyle(e).position,
    filter: e.style.filter || '',
    adjSat: e.getAttribute('data-adj-saturation'),
    adjAttrs: [...e.attributes].filter(a => a.name.startsWith('data-adj-')).length,
    outerHasRedact: /redact/i.test(e.outerHTML),
    rowRedact: row.redact ?? null,
    rowAdj: row.adj ?? null,
    rowKeys: Object.keys(row),
  };
}, [c, r]);
/* 칸 그림의 가운데 줄 B 채널 sd — 요소 스크린샷(화면 사각형을 안 읽는다). 가장자리 20% 는 버린다. */
async function sdOf(page, c = 0, r = 0) {
  const png = await page.locator(cellSel(c, r)).screenshot();
  return page.evaluate(async (b64) => {
    const bmp = await createImageBitmap(await (await fetch('data:image/png;base64,' + b64)).blob());
    const cv = document.createElement('canvas'); cv.width = bmp.width; cv.height = bmp.height;
    const ctx = cv.getContext('2d'); ctx.drawImage(bmp, 0, 0);
    const y = Math.floor(bmp.height / 2), x0 = Math.floor(bmp.width * 0.2), x1 = Math.floor(bmp.width * 0.8);
    const d = ctx.getImageData(x0, y, x1 - x0, 1).data;
    const bs = []; for (let i = 0; i < d.length; i += 4) bs.push(d[i + 2]);
    const m = bs.reduce((a, v) => a + v, 0) / bs.length;
    return Math.round(Math.sqrt(bs.reduce((a, v) => a + (v - m) * (v - m), 0) / bs.length) * 10) / 10;
  }, png.toString('base64'));
}
const setRow = (page, patch, c = 0, r = 0) => page.evaluate(([p, c, r]) => {
  const b = document.getElementById(window.__bid);
  const cols = window.getComparisonCols(b.dataset);
  Object.assign(cols[c].rows[r], p);
  for (const k of Object.keys(p)) if (p[k] === undefined) delete cols[c].rows[r][k];
  window.setComparisonCols(b, cols); window.renderComparison(b);
}, [patch, c, r]);

test('K1 색보정 adj 행 → data-adj-* · filter url · 재렌더 · 저장 왕복 생존', async ({ page }) => {
  const errs = await setup(page, { adj: ADJ_SAT });
  const s0 = await cell(page);
  expect(s0.rowAdj, '전제: 모델에 adj 가 실렸다').toEqual(ADJ_SAT);
  expect(s0.adjSat, '렌더가 data-adj-saturation 을 안 칠했다').toBe('-1.000');
  expect(s0.filter).toMatch(/^url\("?#img-color-adj-/);
  const other = await cell(page, 1, 0);
  expect([other.adjAttrs, other.filter], '이웃 칸(adj 없음)엔 흔적 0').toEqual([0, '']);
  /* 재렌더 — div 가 새로 생겨도 모델에서 다시 칠한다 */
  await page.evaluate(() => window.renderComparison(document.getElementById(window.__bid)));
  const s1 = await cell(page);
  expect([s1.adjSat, /^url\(/.test(s1.filter)], '재렌더 뒤').toEqual(['-1.000', true]);
  /* 저장 왕복 — 새 앱에 프로젝트를 다시 싣는다 */
  const snap = await page.evaluate(() => window.serializeProject());
  const bid = await page.evaluate(() => window.__bid);
  await bootApp(page);
  await page.evaluate((d) => window.applyProjectData(JSON.parse(d)), snap);
  await page.waitForFunction((id) => !!document.getElementById(id)?.querySelector('.cmp-row[data-col-idx="0"][data-row-idx="0"]'), bid, { timeout: 5000 });
  await page.evaluate((id) => { window.__bid = id; }, bid);
  const s2 = await cell(page);
  expect(s2.rowAdj, '왕복 뒤 모델').toEqual(ADJ_SAT);
  expect([s2.adjSat, /^url\(/.test(s2.filter)], '왕복 뒤 그림').toEqual(['-1.000', true]);
  expect(errs, errs.join('\n')).toEqual([]);
});

test('K2 내보내기 클론 — 색보정 칸이 구운 PNG 로 · 블러 칸은 h2c 덮개로(neutralize)', async ({ page }) => {
  const errs = await setup(page, { adj: ADJ_SAT });
  await setRow(page, { redact: 60 }, 1, 0);
  const out = await page.evaluate(async () => {
    const EI = await import('/js/io/export-image.js');
    const CS = await import('/js/io/capture-safety.js');
    const sec = document.getElementById('sB');
    const clone = sec.cloneNode(true); clone.id = 'sB-clone-k2';
    clone.querySelectorAll('[id]').forEach(e => { e.id = e.id + '-k2'; });
    document.body.appendChild(clone);
    EI.renderComponentsInClone(clone);   // export-image 가 클론에서 다시 그리는 바로 그 함수
    const q = (c, r) => clone.querySelector(`.cmp-row[data-col-idx="${c}"][data-row-idx="${r}"]`);
    const dirty = [...clone.querySelectorAll(window.ADJ_DIRTY_SEL)];
    const pre = { dirtyHasCell: dirty.includes(q(0, 0)), dirtyN: dirty.length, bg: q(0, 0).style.backgroundImage };
    for (const el of dirty) await window.bakeImgFilterToCanvas(el);   // export-image.js 색 bake 루프와 같은 꼴
    const baked = { bg: q(0, 0).style.backgroundImage, filter: q(0, 0).style.filter };
    const redactCell = { attr: q(1, 0).getAttribute('data-redact') };
    CS.neutralizeRedactForH2C(clone);
    const nz = { bgImg: q(1, 0).style.backgroundImage, bgColor: q(1, 0).style.backgroundColor, untouchedBg: q(0, 0).style.backgroundImage === baked.bg };
    clone.remove();
    const live = document.querySelector('#sB .cmp-row[data-col-idx="1"][data-row-idx="0"]');
    return { pre, baked, redactCell, nz, src: window.__SRC, liveBg: live.style.backgroundImage };
  });
  expect(out.pre.dirtyHasCell, 'ADJ_DIRTY_SEL 이 비교 칸을 못 집는다 — 내보내기에 색보정이 빠진다').toBe(true);
  expect(out.pre.dirtyN, '색보정 안 한 칸까지 집었다').toBe(1);
  expect(out.pre.bg, '전제: 굽기 전엔 원본 그림').toContain(out.src);
  expect(out.baked.bg, '굽지 않았다').toMatch(/^url\("data:image\/png/);
  expect(out.baked.bg.includes(out.src), '구운 뒤에도 원본 그대로').toBe(false);
  expect(out.baked.filter, '구운 뒤 SVG 필터가 남았다(h2c 가 못 그린다)').toBe('');
  expect(out.redactCell.attr, '전제: 클론 재렌더가 블러를 다시 칠했다').toBe('60');
  /* neutralize 는 backgroundImage='none' 뒤 background 단축속성으로 덮는다 — 읽으면 'initial' 일 수 있다(둘 다 «그림 없음») */
  expect(out.nz.bgImg, 'neutralize 가 블러 칸 원본을 안 걷었다(h2c 누출)').toMatch(/^(none|initial)$/);
  expect(out.nz.bgColor, '덮개 색이 기존 불투명 회색이 아니다').toBe('rgb(74, 74, 74)');
  expect(out.nz.untouchedBg, '블러 없는 칸까지 덮었다').toBe(true);
  expect(out.liveBg, '라이브 칸이 바뀌었다').toContain(out.src);
  expect(errs, errs.join('\n')).toEqual([]);
});

test('K3 블러 보임 — ::after blur(12px) · 줄무늬 sd 가 꺼진다 · 색보정과 공존(둘 다 생존 · 그래도 흐림)', async ({ page }) => {
  const errs = await setup(page);
  const s0 = await cell(page);
  expect([s0.redactAttr, s0.afterContent], '전제: 처음엔 블러 없음').toEqual([null, 'none']);
  const before = await sdOf(page);
  expect(before, '양성대조: 켜기 전 줄무늬가 안 보인다 ⇒ 이 자는 흐림을 못 가른다').toBeGreaterThan(SD_ON);
  await setRow(page, { redact: 60 });
  const s1 = await cell(page);
  expect([s1.redactAttr, s1.blurVar, s1.position], '속성·변수·위치 기준').toEqual(['60', '12px', 'relative']);
  expect(s1.afterBackdrop).toContain('blur(12px)');
  await expect.poll(() => sdOf(page), { message: '켰는데 줄무늬가 남는다(흐려지지 않았다)' }).toBeLessThan(SD_OFF);
  /* 공존 — 같은 칸에 색보정(채도 -100)을 더한다 */
  await setRow(page, { redact: 60, adj: ADJ_SAT });
  const s2 = await cell(page);
  expect(s2.filter, '블러를 켜니 색보정 필터가 사라졌다').toMatch(/^url\(/);
  expect(s2.afterBackdrop, '색보정을 더하니 블러가 사라졌다').toContain('blur(12px)');
  await expect.poll(() => sdOf(page), { message: '색보정과 같이 켜니 흐림이 풀렸다' }).toBeLessThan(SD_OFF);
  /* 양성대조(공존 쪽): 색보정만 남기면 다시 줄무늬 — 채도 -100 이어도 파랑/노랑의 B 차가 남는다 */
  await setRow(page, { redact: undefined, adj: ADJ_SAT });
  await expect.poll(() => sdOf(page), { message: '블러를 껐는데 줄무늬가 안 돌아온다' }).toBeGreaterThan(SD_ON);
  expect(errs, errs.join('\n')).toEqual([]);
});

/* 칸 가운데(멈춘 뒤) + «누르는 점이 그 칸 위»라는 전제 단언 — cmp-img-edit 와 같은 꼴 */
async function at(page, c, r) {
  const rc = await waitStableRect(page, cellSel(c, r));
  const hit = await page.evaluate(([x, y, s]) => {
    const e = document.elementFromPoint(x, y); const want = document.querySelector(s);
    return !!(e && want && (e === want || want.contains(e)));
  }, [rc.cx, rc.cy, cellSel(c, r)]);
  expect(hit, `전제 — (${rc.cx},${rc.cy}) 가 칸 ${c}/${r} 위다`).toBe(true);
  return rc;
}

test('K4 패널 — Image 절 아래 블러 절 · 슬라이더 → 모델 · undo 1번 = 꺼짐 · 편집기 색보정 슬라이더 → 모델 · Esc = 닫힘', async ({ page }) => {
  const errs = await setup(page);
  /* 칸 선택(2번째 클릭과 같은 상태)으로 패널을 연다 */
  await page.evaluate(() => {
    const b = document.getElementById(window.__bid);
    window.selectBlock?.(b.id);
    window.cmpSetActiveCell(b, { colIdx: 0, rowIdx: 0 });
    window.showComparisonProperties(b);
  });
  await page.waitForFunction(() => !!document.getElementById('cmp-cell-redact-slider'), null, { timeout: 5000 });
  const p = await page.evaluate(() => {
    const img = document.getElementById('cmp-img-section');
    const red = document.getElementById('cmp-cell-redact-section');
    const rs = document.getElementById('cmp-cell-redact-slider');
    return { nextIsRedact: !!img && img.nextElementSibling === red,
             title: red?.querySelector('.prop-section-title')?.textContent || null,
             range: [rs?.type, rs?.min, rs?.max], inlineStyles: red ? red.querySelectorAll('[style]').length : -1 };
  });
  expect(p.nextIsRedact, '블러 절이 「Image」 절 «바로 다음»이 아니다').toBe(true);
  expect(p.title).toBe('블러 (Redact)');
  expect(p.range).toEqual(['range', '0', '100']);
  expect(p.inlineStyles, '인라인 style 이 생겼다(디자인시스템)').toBe(0);
  await page.evaluate(() => window.pushHistory?.('K4 기준'));
  await page.evaluate(() => {
    const s = document.getElementById('cmp-cell-redact-slider');
    s.value = '60';
    s.dispatchEvent(new Event('input', { bubbles: true }));
    s.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await expect.poll(async () => (await cell(page)).rowRedact, { message: '슬라이더가 모델에 안 썼다' }).toBe(60);
  const s1 = await cell(page);
  expect([s1.redactAttr, s1.blurVar]).toEqual(['60', '12px']);
  expect(s1.afterBackdrop).toContain('blur(12px)');
  /* undo 1번 — 켜기 «전»으로 */
  await page.evaluate(() => window.undo());
  await expect.poll(async () => (await cell(page)).rowRedact, { message: 'undo 1번에 블러가 안 꺼졌다' }).toBe(null);
  expect((await cell(page)).redactAttr).toBe(null);

  /* 색보정 — 더블클릭 편집기에 들어가면 플로팅 패널(에셋·카드와 같은 몸짓) */
  await page.evaluate(() => window.deselectAll?.());
  const pt = await at(page, 0, 0);
  await page.mouse.dblclick(pt.cx, pt.cy);
  await page.waitForFunction(() => document.querySelectorAll('.cmp-img-editing').length === 1, null, { timeout: 3000 });
  await page.waitForFunction(() => getComputedStyle(document.getElementById('color-adjust-panel')).display !== 'none' && !!document.getElementById('ca-saturation'), null, { timeout: 3000 });
  await page.evaluate(() => {
    const s = document.getElementById('ca-saturation');
    s.value = '-100';
    s.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await expect.poll(async () => (await cell(page)).rowAdj?.saturation ?? null, { message: '색보정 슬라이더가 모델(row.adj)에 안 썼다' }).toBe(-1);
  const s2 = await cell(page);
  expect([s2.adjSat, /^url\(/.test(s2.filter)], '편집 중 칸에 바로 칠한다').toEqual(['-1.000', true]);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => document.querySelectorAll('.cmp-img-editing').length === 0 && getComputedStyle(document.getElementById('color-adjust-panel')).display === 'none', null, { timeout: 3000 });
  await page.evaluate(() => window.renderComparison(document.getElementById(window.__bid)));
  const s3 = await cell(page);
  expect([s3.rowAdj?.saturation, s3.adjSat], '편집기를 닫고 다시 그려도 남는다').toEqual([-1, '-1.000']);
  expect(errs, errs.join('\n')).toEqual([]);
});

test('K5 0/기본값 = 흔적 0 — 속성·변수·필터·모델 키·outerHTML', async ({ page }) => {
  const errs = await setup(page, { redact: 60, adj: ADJ_SAT });
  const on = await cell(page);
  expect([on.redactAttr, on.adjSat], '전제: 둘 다 켜져 있다').toEqual(['60', '-1.000']);
  /* 패널 숫자칸 0 */
  await page.evaluate(() => {
    const b = document.getElementById(window.__bid);
    window.cmpSetActiveCell(b, { colIdx: 0, rowIdx: 0 });
    window.showComparisonProperties(b);
    const n = document.getElementById('cmp-cell-redact-number');
    n.value = '0';
    n.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await expect.poll(async () => (await cell(page)).redactAttr).toBe(null);
  /* 색보정 «초기화» 와 같은 값(전부 0) — 편집기 되쓰기와 같은 규칙(전부 0 = 키 지움)을 모델 문으로 */
  await setRow(page, { adj: { ...ADJ_SAT, saturation: 0 } });
  const off = await cell(page);
  expect(off.rowKeys.filter(k => k === 'redact' || k === 'adj'), '모델에 키가 남았다').toEqual([]);
  expect([off.blurVar, off.filter, off.adjAttrs, off.afterContent], '칸 흔적').toEqual(['', '', 0, 'none']);
  expect(off.outerHasRedact, '바이트에 redact 가 남았다').toBe(false);
  /* 그림을 비우면 블러도 끈다(에셋 clearAssetImage 와 같다) — 패널 × */
  await setRow(page, { redact: 40 });
  await page.evaluate(() => {
    const b = document.getElementById(window.__bid);
    window.showComparisonProperties(b);
    document.querySelector('.cmp-row-img-clear[data-col="0"][data-idx="0"]').click();
  });
  await expect.poll(async () => (await cell(page)).rowKeys.includes('redact'), { message: '그림을 비웠는데 블러가 모델에 남았다 — 다음 그림이 말없이 흐려진다' }).toBe(false);
  expect(errs, errs.join('\n')).toEqual([]);
});

test('K6 문(MCP/AI) — cols 교체 뒤 redact·adj 생존 · 범위 밖 클램프 · adj 꼴 아님 = INVALID', async ({ page }) => {
  const errs = await setup(page, { redact: 60, adj: ADJ_SAT });
  const r = await page.evaluate(() => {
    const b = document.getElementById(window.__bid);
    const res = window.updateComparisonBlock(b.id, { cols: window.getComparisonCols(b.dataset) });
    const kept = window.getComparisonCols(b.dataset)[0].rows[0];
    const e = b.querySelector('.cmp-row[data-col-idx="0"][data-row-idx="0"]');
    const res2 = window.updateComparisonBlock(b.id, { columnPatch: [{ index: 1, rows: [{ type: 'image', imgSrc: '', redact: 150, adj: { saturation: 5, bogus: 1 } }] }] });
    const clamped = window.getComparisonCols(b.dataset)[1].rows[0];
    const res3 = window.updateComparisonBlock(b.id, { columnPatch: [{ index: 1, rows: [{ type: 'image', imgSrc: '', adj: 'abc' }] }] });
    return { ok: res.ok, kept: [kept.redact, kept.adj], drawn: [e.getAttribute('data-redact'), e.getAttribute('data-adj-saturation')],
             ok2: res2.ok, clamped: [clamped.redact, clamped.adj], ok3: res3.ok, code3: res3.code };
  });
  expect(r.ok, 'cols 교체 ok').toBe(true);
  expect(r.kept, 'cols 교체 뒤 모델 생존').toEqual([60, ADJ_SAT]);
  expect(r.drawn, 'cols 교체 뒤 그림 생존').toEqual(['60', '-1.000']);
  expect(r.ok2, 'columnPatch ok').toBe(true);
  expect(r.clamped, '범위 밖 → 클램프(0~100 · -1~1) · 모르는 키 버림').toEqual([100, { ...ADJ_SAT, saturation: 1 }]);
  expect([r.ok3, r.code3], 'adj 가 객체가 아님 → INVALID').toEqual([false, 'INVALID']);
  expect(errs, errs.join('\n')).toEqual([]);
});

test('K7 Figma JSON — 블러 칸 원본 imgSrc 가 없다 · 덮개 색 (양성대조: 끄면 있다)', async ({ page }) => {
  const errs = await setup(page);
  /* 칼럼1 첫 칸도 같은 그림이다 — 그 칸을 다른 그림으로 바꿔 «이 칸»의 src 만 따로 잰다 */
  await page.evaluate(() => {
    const cv = document.createElement('canvas'); cv.width = 4; cv.height = 4;
    cv.getContext('2d').fillRect(0, 0, 4, 4);
    window.__SRC2 = cv.toDataURL('image/png');
  });
  await page.evaluate(() => {
    const b = document.getElementById(window.__bid);
    const cols = window.getComparisonCols(b.dataset); cols[1].rows[0].imgSrc = window.__SRC2;
    window.setComparisonCols(b, cols); window.renderComparison(b);
  });
  const build = () => page.evaluate(() => {
    window.flushCurrentPage?.();
    const s = JSON.stringify(window.buildFigmaExportJSON(null));
    const found = [];
    const walk = (o) => { if (!o || typeof o !== 'object') return; if (o.type === 'comparison' && o.id === window.__bid) found.push(o); Object.values(o).forEach(walk); };
    walk(JSON.parse(s));
    return { hasSrc: s.includes(window.__SRC), n: found.length, row: found[0]?.cols?.[0]?.rows?.[0] || null };
  });
  const off = await build();
  expect(off.n, '전제: 비교 블럭이 JSON 에 없다').toBeGreaterThan(0);
  expect(off.hasSrc, '양성대조: 끈 상태에서 원본 src 가 JSON 에 없다 ⇒ 이 자는 누출을 못 본다').toBe(true);
  await setRow(page, { redact: 60 });
  const on = await build();
  expect(on.hasSrc, '블러를 켰는데 원본 src 가 Figma JSON 에 실렸다').toBe(false);
  expect(on.row?.redact).toEqual({ intensity: 60, blurPx: 12, cover: '#4a4a4a' });
  expect(on.row?.imgSrc).toBe('');
  expect(errs, errs.join('\n')).toEqual([]);
});
