/* section-note-pattern-t309.dom.spec.js — t3-09 노트/모눈 배경 무늬 직접 조절(data-bg-note)
 *
 * 정본 = sec.dataset.bgNote 한 칸 `kind|gap|#rrggbb|width|opacity` · 그리기 = prop-section.js _applySectionBg 한 자리(CSS 그라데이션).
 * 지디 261113 붙임: ① 내보내기 «경로마다» 따로 잰다 — 캔버스만 초록이면 미완 ② 저장 왕복 + 옛 프로젝트(bgImg 고정 SVG) 하위호환 ③ 기존 칸 재사용.
 *
 * 칸:
 *   N0 전제 — 앱·섹션 둘·진짜 클릭으로 섹션 패널 · 노트 단추가 Background 절에 있다
 *   N1 화면 — 켜면 기본값 · 줄눈 1겹 / 모눈 2겹 · 간격 칸이 dataset 에 쓴다(기존 슬라이더 꼴) · B 는 무변(음성)
 *   N2 PNG ⒜ 클론 스크린샷(주 경로 대역) ⒝ html2canvas 폴백 — 띠 위·띠 사이 픽셀이 주기대로 · 무늬 없는 B 는 빨강 0(음성)
 *   N3 HTML — 진짜 exportHTMLFile(Blob 가로채기) 산출을 sandbox iframe 에 띄워 계산 스타일로 겹을 잰다 · 켜기 전 0(음성)
 *   N4 Figma — flushCurrentPage → buildFigmaExportJSON 의 A 섹션 bgNoteSvg(pattern 칸 = gap · 색) · B 없음(음성)
 *   N5 저장 왕복 — getSerializedCanvas 에 data-bg-note 1개(켜기 전 0) · 인라인 style 을 걷고 rebindAll → 겹이 되살아난다
 *   N6 하위호환 — 옛 노트패널 고정 SVG(bgImg) 섹션은 왕복 뒤에도 그 그림 그대로 · 그라데이션 0 · 노트 단추 없음
 *        + 그림이 있으면 bgNote 가 실려 있어도 그림이 주인(_applySectionBg 규칙)
 *
 * 되돌리면 빨강:
 *   _applySectionBg 의 `if (note)` 가지를 빼면 N1·N2·N3·N5 빨강 · export-figma-json 의 bgNoteSvg 를 빼면 N4 빨강 ·
 *   save-load.js 의 `|| sec.dataset.bgNote` 를 빼면 N5 빨강(인라인을 걷고 재므로) · `(img || mesh) ? null` 을 빼면 N6 둘째 반 빨강.
 * 못 재는 축: 실앱 네이티브 CDP 캡처(⒜ 는 같은 클론의 브라우저 스크린샷) · 실 Figma 업로드(렌더러 create_node_from_svg 는 단위 N4 가 배선만 잰다).
 *
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js section-note-pattern-t309
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');

const raf2 = (page) => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));

/** 섹션 둘을 앱 길(addSection)로 — A = 무늬를 켤 섹션 · B = 음성대조. (손 HTML 금지 — mesh M0 의 교훈) */
async function setup(page) {
  await page.setViewportSize({ width: 1600, height: 1100 });
  const errs = await bootApp(page);
  const ids = await page.evaluate(async () => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach(s => s.remove());
    const out = [];
    for (let i = 0; i < 2; i++) {
      await window.addSection();
      const el = [...c.querySelectorAll('.section-block')].pop();
      out.push(el ? el.id : null);
    }
    return out;
  });
  await raf2(page);
  return { errs, A: ids[0], B: ids[1] };
}

async function pickSection(page, id) {
  await page.evaluate((i) => document.getElementById(i).scrollIntoView({ block: 'center' }), id);
  const b = await waitStableRect(page, '#' + id);
  await page.mouse.click(b.left + 8, b.cy);
  await page.waitForFunction((i) =>
    document.getElementById(i)?.classList.contains('selected') &&
    document.getElementById('sec-height-value')?.dataset.secId === i, id, { timeout: 8000 });
  await raf2(page);
}

/* 픽셀 판정용 무늬 — 빨강 6px 띠 · 40px 주기. 띠 가운데(+3)는 빨강, 띠 사이(+20)는 빨강 아님. */
const GAP = 40, BAND = 6;
const SPEC = `lines|${GAP}|#ff0000|${BAND}|100`;
const BAND_TXT = `transparent ${BAND}px`;   // 이 무늬의 CSS 에만 나오는 글자(HTML 산출 대조용)

/** 섹션에 값을 싣고 제품 그리개로 그린다(픽셀 칸 — 패널 길은 N1 이 잰다) · 세 주기가 들어갈 높이를 준다. */
const applySpec = (page, id, spec) => page.evaluate(([i, s]) => {
  const el = document.getElementById(i);
  el.style.minHeight = '320px';
  if (s) el.dataset.bgNote = s; else delete el.dataset.bgNote;
  window.applySectionBg(el);
}, [id, spec]);

const bgState = (page, id) => page.evaluate((i) => {
  const s = document.getElementById(i), cs = getComputedStyle(s);
  return { note: s.dataset.bgNote ?? null, lin: (cs.backgroundImage.match(/linear-gradient\(/g) || []).length,
           rad: (cs.backgroundImage.match(/radial-gradient\(/g) || []).length, size: cs.backgroundSize, img: cs.backgroundImage.slice(0, 200) };
}, id);

/** 그려진 캔버스(ctx)에서 왼쪽 10px 세로줄의 띠 주기를 잰다 — s = 출력px / CSSpx.
    ⛔문자열 eval 금지 — 앱 CSP 에 'unsafe-eval' 이 없다 ⇒ evaluate 로 window 에 심는다. */
const installStripes = (page) => page.evaluate(([GAP, BAND]) => {
  window.__noteStripes = (ctx, s) => {
    const px = (y) => Array.from(ctx.getImageData(Math.round(10 * s), Math.round(y * s), 1, 1).data.slice(0, 3));
    const red = (p) => p[0] > 200 && p[1] < 80 && p[2] < 80;
    const out = [];
    for (let k = 1; k <= 3; k++) { const on = px(k * GAP + BAND / 2), off = px(k * GAP + GAP / 2); out.push({ k, on, off, ok: red(on) && !red(off), anyRed: red(on) || red(off) }); }
    return out;
  };
}, [GAP, BAND]);

/* ─────────────────────────────── N0 전제 ─────────────────────────────── */
test('N0 전제 — 앱·섹션 둘·진짜 클릭으로 섹션 패널 · 「노트 무늬」 단추가 Background 절에 있다', async ({ page }) => {
  const { errs, A, B } = await setup(page);
  expect(typeof A === 'string' && A && typeof B === 'string' && B && A !== B, `addSection id = ${A} / ${B}`).toBe(true);
  await pickSection(page, A);
  const r = await page.evaluate(() => {
    const b = document.getElementById('sec-bg-note');
    return { bgField: !!document.getElementById('sec-bg-color'), found: !!b,
             title: b?.closest('.prop-section')?.querySelector('.prop-section-title')?.textContent?.trim() || '' };
  });
  expect(r.bgField, '섹션 패널 기존 「배경색」 칸이 없다 — 패널이 안 떴다 ⇒ 아래 전부 무효').toBe(true);
  expect(r.found, '#sec-bg-note 가 없다').toBe(true);
  expect(r.title, `노트 단추가 든 절 = "${r.title}"`).toBe('Background');
  expect(errs, JSON.stringify(errs)).toEqual([]);
});

/* ─────────────────────────────── N1 화면 ─────────────────────────────── */
test('N1 화면 — 켜면 기본 줄눈 1겹 · 모눈 2겹 · 간격 칸이 쓴다(기존 슬라이더 줄) · B 무변', async ({ page }) => {
  const { errs, A, B } = await setup(page);
  await pickSection(page, A);
  const off = await bgState(page, A);
  expect([off.note, off.lin], `전제: 켜기 전 무늬 없음 ${JSON.stringify(off)}`).toEqual([null, 0]);
  await page.locator('#sec-bg-note').click();
  await raf2(page);
  const on = await bgState(page, A);
  expect(on.note, '켜면 기본값').toBe('lines|28|#9ca3af|1|100');
  expect([on.lin, on.size], `줄눈 1겹 · 크기 ${JSON.stringify(on)}`).toEqual([1, '100% 28px']);
  /* ③ 기존 칸 재사용 — 범위 슬라이더 + 수 칸 짝(sliderRowHTML) · 색은 colorFieldHTML */
  const kinds = await page.evaluate(() => ({
    slider: document.getElementById('sec-note-gap-slider')?.type ?? null,
    number: document.getElementById('sec-note-gap-number')?.type ?? null,
  }));
  expect([kinds.slider, kinds.number], `간격 줄 = ${JSON.stringify(kinds)}`).toEqual(['range', 'number']);
  await page.locator('#sec-note-kind').selectOption('grid');
  await raf2(page);
  const grid = await bgState(page, A);
  expect([grid.note, grid.lin], `모눈 = 2겹 ${JSON.stringify(grid)}`).toEqual(['grid|28|#9ca3af|1|100', 2]);
  await page.locator('#sec-note-gap-number').fill('40');
  await page.locator('#sec-note-gap-number').press('Enter');
  await raf2(page);
  const g40 = await bgState(page, A);
  expect([g40.note, g40.size], `간격 40 ${JSON.stringify(g40)}`).toEqual(['grid|40|#9ca3af|1|100', '40px 40px, 40px 40px']);
  const b = await bgState(page, B);
  expect([b.note, b.lin], `음성 — B 무변 ${JSON.stringify(b)}`).toEqual([null, 0]);
  expect(errs, JSON.stringify(errs)).toEqual([]);
});

/* ─────────────────────────────── N2 PNG ─────────────────────────────── */
test('N2 PNG — ⒜ 클론 스크린샷 ⒝ html2canvas 폴백 둘 다 띠가 40px 주기로 나온다 · 무늬 없는 B 는 빨강 0', async ({ page }) => {
  test.setTimeout(90000);
  const { errs, A, B } = await setup(page);
  await applySpec(page, A, SPEC);
  await applySpec(page, B, null);
  await installStripes(page);
  await raf2(page);
  const st = await bgState(page, A);
  expect(st.lin, `전제: 화면에 무늬 ${JSON.stringify(st)}`).toBe(1);

  /* ⒜ 주 경로 대역 — prepareCloneForCapture(useNative=true) 클론을 브라우저로 찍는다 */
  const shotOf = async (id) => {
    await page.evaluate(async (i) => {
      const ex = await import('/js/io/export-image.js');
      document.getElementById('__nclone')?.remove();
      const clone = await ex.prepareCloneForCapture(document.getElementById(i), 860, true);
      ex.renderComponentsInClone(clone);
      clone.id = '__nclone';
      if (!clone.isConnected) document.body.appendChild(clone);
      Object.assign(clone.style, { position: 'fixed', top: '0px', left: '0px', zIndex: '2147483647' });
    }, id);
    const cw = await page.evaluate(() => document.getElementById('__nclone').offsetWidth);
    const buf = await page.locator('#__nclone').screenshot();
    const r = await page.evaluate(async ([b64, cw]) => {
      const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
      const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
      const ctx = cv.getContext('2d'); ctx.drawImage(img, 0, 0);
      return { w: img.width, h: img.height, cw, rows: window.__noteStripes(ctx, img.width / cw) };
    }, [buf.toString('base64'), cw]);
    await page.evaluate(() => document.getElementById('__nclone')?.remove());
    return r;
  };
  /* ⒝ html2canvas — captureCloneToCanvas(useNative=false) 그 함수 */
  const h2cOf = (id) => page.evaluate(async (i) => {
    const ex = await import('/js/io/export-image.js');
    const live = document.getElementById(i);
    const clone = await ex.prepareCloneForCapture(live, 860, false);
    ex.renderComponentsInClone(clone);
    if (!clone.isConnected) document.body.appendChild(clone);
    const cw = clone.offsetWidth;
    const { canvas } = await ex.captureCloneToCanvas(clone, 860, '#ffffff', false, live);
    clone.remove();
    return { w: canvas.width, h: canvas.height, cw, rows: window.__noteStripes(canvas.getContext('2d'), canvas.width / cw) };
  }, id);

  const a = await shotOf(A), aNeg = await shotOf(B);
  const h = await h2cOf(A), hNeg = await h2cOf(B);
  const msg = JSON.stringify({ a, aNeg, h, hNeg });
  console.log('[N2]', msg);
  expect(a.h, `전제: 클론이 세 주기 높이 ${a.h}`).toBeGreaterThan((3 * GAP + GAP) * (a.w / a.cw));
  expect(a.rows.map(x => x.ok), `⒜ 클론 스크린샷 띠 주기 ${msg}`).toEqual([true, true, true]);
  expect(h.rows.map(x => x.ok), `⒝ html2canvas 띠 주기 ${msg}`).toEqual([true, true, true]);
  /* 음성 — 무늬 없는 섹션은 같은 자리에 빨강이 한 점도 없다(자가 늘 빨강을 보는 게 아님) */
  expect(aNeg.rows.some(x => x.anyRed) || hNeg.rows.some(x => x.anyRed), `음성 B 에 빨강 ${msg}`).toBe(false);
  expect(errs, JSON.stringify(errs)).toEqual([]);
});

/* ─────────────────────────────── N3 HTML ─────────────────────────────── */
test('N3 HTML — exportHTMLFile 산출을 띄우면 무늬 겹이 계산 스타일로 선다 · 켜기 전 0', async ({ page }) => {
  test.setTimeout(90000);
  const { errs, A } = await setup(page);
  const exportAndMeasure = () => page.evaluate(async ([band, gap]) => {
    let blob = null;
    const oC = URL.createObjectURL, oR = URL.revokeObjectURL, oClick = HTMLAnchorElement.prototype.click;
    URL.createObjectURL = (b) => { blob = b; return 'blob:__stub__'; }; URL.revokeObjectURL = () => {}; HTMLAnchorElement.prototype.click = function () {};
    try { await window.exportHTMLFile(); } finally { URL.createObjectURL = oC; URL.revokeObjectURL = oR; HTMLAnchorElement.prototype.click = oClick; }
    const html = blob ? await blob.text() : '';
    /* 스크립트 막은 iframe 에 띄운다 — 산출이 «그 자체로» 무늬를 그리나 */
    const fr = document.createElement('iframe');
    fr.setAttribute('sandbox', 'allow-same-origin');
    fr.style.cssText = 'position:fixed;left:0;top:0;width:900px;height:900px;';
    await new Promise((res) => { fr.onload = res; fr.srcdoc = html; document.body.appendChild(fr); });
    const d = fr.contentDocument;
    const hits = [...d.querySelectorAll('*')].filter((el) => {
      const cs = fr.contentWindow.getComputedStyle(el);
      return /linear-gradient\(/.test(cs.backgroundImage) && cs.backgroundSize.includes(`${gap}px`);
    }).length;
    fr.remove();
    return { got: html.length, txt: html.split(band).length - 1, hits };
  }, [BAND_TXT, GAP]);
  const before = await exportAndMeasure();
  await applySpec(page, A, SPEC);
  await raf2(page);
  const after = await exportAndMeasure();
  const msg = JSON.stringify({ before, after });
  expect(after.got, `전제: HTML 이 나왔다 ${msg}`).toBeGreaterThan(0);
  expect([before.txt, before.hits], `음성 — 켜기 전 산출엔 무늬가 없다 ${msg}`).toEqual([0, 0]);
  expect(after.txt, `산출 글자에 무늬 CSS ${msg}`).toBeGreaterThan(0);
  expect(after.hits, `산출을 띄우면 무늬 겹이 선다(계산 스타일) ${msg}`).toBeGreaterThan(0);
  expect(errs, JSON.stringify(errs)).toEqual([]);
});

/* ─────────────────────────────── N4 Figma ─────────────────────────────── */
test('N4 Figma — A 섹션에 bgNoteSvg(pattern gap·색) · B 는 없음', async ({ page }) => {
  const { errs, A, B } = await setup(page);
  await applySpec(page, A, SPEC);
  await raf2(page);
  const r = await page.evaluate(([a, b]) => {
    window.flushCurrentPage?.();
    const j = window.buildFigmaExportJSON(null);
    const sa = j.sections.find(s => s.id === a), sb = j.sections.find(s => s.id === b);
    return { found: [!!sa, !!sb], svgA: sa?.bgNoteSvg || '', hasB: !!(sb && 'bgNoteSvg' in sb) };
  }, [A, B]);
  expect(r.found, '전제: 두 섹션이 JSON 에 있다').toEqual([true, true]);
  expect(r.svgA, 'A bgNoteSvg').toMatch(new RegExp(`<pattern id="gdnote" width="${GAP}" height="${GAP}"`));
  expect(r.svgA, 'A 띠 = 색·두께').toContain(`<rect width="${GAP}" height="${BAND}" fill="#ff0000"`);
  expect(r.hasB, '음성 — B 에 bgNoteSvg 가 실렸다').toBe(false);
  expect(errs, JSON.stringify(errs)).toEqual([]);
});

/* ─────────────────────────────── N5 저장 왕복 ─────────────────────────────── */
test('N5 저장 왕복 — data-bg-note 가 저장본에 1개(켜기 전 0) · 인라인을 걷고 다시 열어도 겹이 선다', async ({ page }) => {
  const { errs, A } = await setup(page);
  const count = (s) => s.split('data-bg-note').length - 1;
  const before = await page.evaluate(() => String(window.getSerializedCanvas?.() || ''));
  expect(count(before), '음성 — 켜기 전 저장본').toBe(0);
  await applySpec(page, A, SPEC);
  await raf2(page);
  const r = await page.evaluate(async (id) => {
    const html = String(window.getSerializedCanvas?.() || '');
    const c = document.getElementById('canvas');
    c.innerHTML = html.replace(/style="[^"]*"/g, '');   // 인라인이 살아 와서 보인 것과 구분 — dataset 정본만으로 다시 그리나
    await window.rebindAll?.();
    const sec = document.getElementById(id), cs = sec ? getComputedStyle(sec) : null;
    return { html, note: sec?.dataset.bgNote ?? null, lin: cs ? (cs.backgroundImage.match(/linear-gradient\(/g) || []).length : -1, size: cs?.backgroundSize ?? '' };
  }, A);
  expect(count(r.html), '켠 뒤 저장본의 data-bg-note 수').toBe(1);
  expect(r.html).toContain(`data-bg-note="${SPEC}"`);
  expect([r.note, r.lin, r.size], '왕복 뒤').toEqual([SPEC, 1, `100% ${GAP}px`]);
  expect(errs, JSON.stringify(errs)).toEqual([]);
});

/* ─────────────────────────────── N6 하위호환 ─────────────────────────────── */
test('N6 하위호환 — 옛 노트패널 고정 SVG(bgImg) 섹션은 왕복 뒤 그대로 · 그림이 있으면 bgNote 보다 그림이 주인', async ({ page }) => {
  const { errs, A, B } = await setup(page);
  const r = await page.evaluate(async ([a, b, spec]) => {
    const { NOTE_BG_PATTERNS } = await import('/js/data/note-bg-patterns.js');
    const src = NOTE_BG_PATTERNS[0].src;
    const sa = document.getElementById(a), sb = document.getElementById(b);
    sa.dataset.bgImg = src; window.applySectionBg(sa);                              // 옛 프로젝트 꼴 — 무늬는 그림 한 장
    sb.dataset.bgImg = src; sb.dataset.bgNote = spec; window.applySectionBg(sb);    // 둘 다 실려도 그림이 주인
    const imgBefore = sa.dataset.bgImg;
    const html = String(window.getSerializedCanvas?.() || '');
    const c = document.getElementById('canvas');
    c.innerHTML = html.replace(/style="[^"]*"/g, '');
    await window.rebindAll?.();
    const m = (id) => { const s = document.getElementById(id), cs = getComputedStyle(s);
      return { img: s.dataset.bgImg === imgBefore, url: /url\(/.test(cs.backgroundImage), lin: (cs.backgroundImage.match(/linear-gradient\(/g) || []).length, note: s.dataset.bgNote ?? null }; };
    /* 진단(r0914t309 N6 pickSection 8s 시간초과): 인라인을 걷은 꼴의 섹션 높이·클릭 자리에 무엇이 있나 */
    sa.scrollIntoView?.({ block: 'center' });
    const ra = document.getElementById(a).getBoundingClientRect();
    const hit = document.elementFromPoint(ra.left + 8, ra.top + ra.height / 2);
    const diag = { h: Math.round(ra.height), hit: hit ? `${hit.tagName}.${hit.className}#${hit.id}` : null };
    return { a: m(a), b: m(b), html, diag };
  }, [A, B, SPEC]);
  console.log('[N6] 걷은 꼴 진단', JSON.stringify(r.diag));
  expect(r.a, `옛 섹션 왕복 ${JSON.stringify(r)}`).toEqual({ img: true, url: true, lin: 0, note: null });
  expect([r.b.url, r.b.lin], `그림 + bgNote → 그림만 ${JSON.stringify({ a: r.a, b: r.b })}`).toEqual([true, 0]);
  /* 패널: 그림이 있으면 노트 줄을 안 띄운다(같은 자리를 다투지 않게).
     ★261114 r0914t309 — 옛 판은 «인라인을 걷은» 캔버스에서 바로 pickSection 해 8s 시간초과. 걷은 꼴은 dataset 정본만 재려는 시험 장치라
       섹션 min-height·패딩 인라인까지 없다(진짜 열기엔 없는 상태) ⇒ 고르기는 «진짜 열기 꼴»(저장본 그대로 innerHTML + rebindAll)에서 한다.
       이 열기 뒤 고르기가 빨강이면 그건 제품(다시 연 섹션을 못 고른다)이다. */
  const reopened = await page.evaluate(async ([html, a]) => {
    document.getElementById('canvas').innerHTML = html;
    await window.rebindAll?.();
    const s = document.getElementById(a);
    return { img: !!s?.dataset.bgImg, url: s ? /url\(/.test(getComputedStyle(s).backgroundImage) : false };
  }, [r.html, A]);
  expect(reopened, '[전제] 저장본 그대로 다시 열면 그림 섹션').toEqual({ img: true, url: true });
  await pickSection(page, A);
  expect(await page.evaluate(() => !!document.getElementById('sec-bg-note')), '그림 섹션에 노트 단추').toBe(false);
  expect(errs, JSON.stringify(errs)).toEqual([]);
});
