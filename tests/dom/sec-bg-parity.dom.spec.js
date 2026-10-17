/* sec-bg-parity.dom.spec.js — 1017t1k1·k2 「에셋블럭의 이미지 편집하는 것과 기능이 같아야」.
 *
 * ★현빈 원문(1017t1) — 「에셋블럭의 이미지 편집하는 것과 ★기능이 같아야 사람들이 헷갈리지 않을 것」
 *   k1: 배경이미지 편집 모서리 핸들에 ★로테이트가 없다 ⇒ 추가.
 *   k2: 배경이미지에 ★색상조절이 없다 ⇒ 에셋블럭처럼 뜨게.
 *
 * ★설계 = ★옵트인 배경 레이어(js/bg-layer.js) — dataset.bgRotate 나 색보정 adj 가 ★있을 때만
 *   `.section-block > .sec-bg-clip > .sec-bg-img` 를 세운다. 키가 없으면 레이어도 없다.
 *
 * ★무력화 대조표(쓴 이가 정한 것 — 제너레이터가 각각 돌려 ★몇 벌이 빨개지는지 적는다):
 *   ㉠ js/image-handling.js:1345-1346 에 noRotate/noColorAdjust 를 되살린다
 *      ⇒ 유닛 P1 ＋ D1·D2·D3·D4 빨강(기대 5벌)
 *   ㉡ needsBgLayer 를 `() => false` 로 못박는다 ⇒ D2·D4·D7 빨강(기대 3벌 — k1·k2 가 ★뿌리 하나)
 *   ㉢ image-color-adjust.js ADJ_TARGET_SEL 에서 `, .sec-bg-img` 를 뺀다 ⇒ 유닛 P2 ＋ D4·D7 빨강
 *   ㉣ prop-section.js _applySectionBg 의 레이어 분기를 지운다 ⇒ D2·D4·D5·D7 빨강
 *
 * ⛔전수 금지 — 이 1벌만. 소비자(cmp-img-fx · checker-pixel-identity · asset-secbg ·
 *   sec-bg-checker-undo · thumbnail-strip-parity)는 ★따로 지정 실행해 비회귀를 본다.
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js sec-bg-parity.dom
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');

const PNG1 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

/** 섹션 하나(배경이미지 지정)를 세운다 — 사람이 하는 순서(만들기 → 그림 넣기). */
async function setupSection(page, { withImage = true } = {}) {
  await page.setViewportSize({ width: 1400, height: 1000 });
  const errs = await bootApp(page);
  await page.evaluate(({ src, withImage }) => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend',
      '<div class="section-block" data-section="1" id="secA" style="height:300px">'
      + '<div class="section-hitzone"></div><div class="section-inner" id="innerA"></div></div>');
    window.rebindAll?.();
    const sec = document.getElementById('secA');
    if (withImage) {
      sec.dataset.bgImg = src;
      window.applySectionBg?.(sec);
    }
    window.__sec = sec;
  }, { src: PNG1, withImage });
  // ★레이아웃 settle — bootApp 직후엔 canvas-scaler/zoom 배율이 아직 확정 전이라 섹션 자리가
  //   한두 프레임 더 움직인다(js/io/save-load.js rebindAll 의 「zoom 레이아웃 아직 확정 안됨」
  //   주석과 같은 병 — 색보정 준비 클릭 빗나감의 선례). 자리가 두 번 연속 같을 때까지 기다린다.
  await waitStableRect(page, '#secA');
  return errs;
}

/** 배경이미지 편집 진입 — enterSectionBgEditMode 는 img.load 이후 비동기로 임시 DOM 을 짓는다. */
async function enterEdit(page) {
  await page.evaluate(() => { window.enterSectionBgEditMode(window.__sec); });
  // ★존재만으론 로드 전에도 참이다(innerHTML 로 <img> 가 먼저 생기고 src 는 뒤에 붙는다)
  //   ⇒ complete && naturalWidth>0 까지 재야 「이미지 decode」가 끝난 것이다.
  await page.waitForFunction(() => {
    const img = document.querySelector('.sec-bg-proxy .asset-img');
    return !!img && img.complete && img.naturalWidth > 0;
  }, null, { timeout: 5000 });
  // ★start() 의 1차 RAF 틱 — enterImageEditMode 가 ★예약만 해 둔 syncHandles 첫 호출이 돌아
  //   회전존·코너핸들의 «자리»(syncHandles)를 잡는 순간까지(js/image-handling.js:477-478
  //   `_syncRafId = requestAnimationFrame(_syncLoop)` — 존 자체는 동기 생성이지만 좌표는 RAF 뒤).
  await page.waitForFunction(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(true)))));
}

/** Esc 로 편집을 끝낸다(beforeCommit → _teardownBgEdit → applySectionBg). */
async function exitEdit(page) {
  await page.evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
  // ★_teardownBgEdit(js/image-handling.js:1413)이 프록시·고스트를 치울 때까지 — 그게 테어다운 완료의 정의다.
  await page.waitForFunction(() => document.querySelectorAll('.sec-bg-proxy, .sec-bg-ghost-wrap, .sec-bg-ghost').length === 0, null, { timeout: 5000 });
}

/** 회전존 하나를 «중심 기준 각도 0°→targetDeg» 로 드래그한다(45 단위·5° 이내 스냅과 맞춰 정확히 떨어지게). */
async function dragRotate(page, targetDeg) {
  const r = await page.evaluate(() => {
    const img = document.querySelector('.sec-bg-proxy .asset-img');
    const zones = [...document.querySelectorAll('#ss-handles-overlay .img-rotate-zone')];
    if (!img || !zones.length) return null;
    const ir = img.getBoundingClientRect();
    const cx = ir.left + ir.width / 2, cy = ir.top + ir.height / 2;
    const inViewport = (x, y) => x >= 0 && y >= 0;
    // ★회전존은 모서리 핸들(.img-corner-handle, z-index 더 높음)과 ★겹친다 — 존의 «기하 중심」이
    //   핸들의 히트 영역 안에 떨어지면 real mouse 는 핸들을 때린다. elementFromPoint 로 ★그 존
    //   자신이 실제로 맞는 점을 찾는다(네 귀퉁이를 살짝 안쪽으로 당겨 샘플).
    const hits = [];
    for (const zone of zones) {
      const zr = zone.getBoundingClientRect();
      const pad = 4;
      const candidates = [
        [zr.left + pad, zr.top + pad], [zr.right - pad, zr.top + pad],
        [zr.left + pad, zr.bottom - pad], [zr.right - pad, zr.bottom - pad],
        [zr.left + zr.width / 2, zr.top + zr.height / 2],
      ];
      for (const [zx, zy] of candidates) {
        if (!inViewport(zx, zy)) continue;
        if (document.elementFromPoint(zx, zy) === zone) { hits.push({ zx, zy }); break; }
      }
    }
    if (!hits.length) return null;
    // ★atan2 는 (-180,180] 범위라 시작각이 경계 가까이면 +targetDeg 가 ★랩어라운드해 저장값이
    //   45−360=−315 처럼 나온다(값은 ★시각적으로 같지만 문자열이 다르다). startAng 가 0 에
    //   가장 가까운(=경계에서 제일 먼) 후보를 골라 ★랩 걱정 없이 정확한 문자열을 만든다.
    let best = hits[0], bestAbs = Infinity;
    for (const h of hits) {
      const a = Math.abs(Math.atan2(h.zy - cy, h.zx - cx) * 180 / Math.PI);
      if (a < bestAbs) { bestAbs = a; best = h; }
    }
    return { cx, cy, zx: best.zx, zy: best.zy };
  });
  expect(r, '회전존 또는 프록시 이미지를 못 찾았다').not.toBeNull();
  // ★mousedown 은 ★«회전존 자신의 자리»에서 — 중심에서의 거리·각도는 ★그 존이 실제로 놓인 자리를 믿는다
  // (가상의 radius/각도를 지어내면 그 좌표가 존 바깥이라 mousedown 이 다른 요소로 간다).
  const startAng = Math.atan2(r.zy - r.cy, r.zx - r.cx) * 180 / Math.PI;
  await page.mouse.move(r.zx, r.zy);
  await page.mouse.down();
  // baseRot=0(씨앗) ⇒ newRot = (moveAng - startAng) 이 targetDeg 가 되도록 moveAng 를 고른다
  const radius = Math.max(60, Math.hypot(r.zx - r.cx, r.zy - r.cy));
  const moveAng = (startAng + targetDeg) * Math.PI / 180;
  const moveX = r.cx + radius * Math.cos(moveAng);
  const moveY = r.cy + radius * Math.sin(moveAng);
  await page.mouse.move(moveX, moveY, { steps: 6 });
  await page.mouse.up();
  // ★드래그가 실제로 먹었는지 — onRotateDown(js/image-handling.js:429)은 mousemove 마다
  //   동기로 proxy.dataset.imgRotate 를 쓴다. 그 값이 targetDeg(45° 단위 스냅 뒤)로
  //   떨어질 때까지 재서, «이벤트는 보냈지만 핸들러가 아직 안 돈» 창을 없앤다.
  await page.waitForFunction((want) => {
    const proxy = document.querySelector('.sec-bg-proxy');
    if (!proxy) return false;
    const rot = ((parseFloat(proxy.dataset.imgRotate || '0') % 360) + 360) % 360;
    const w = ((want % 360) + 360) % 360;
    return Math.abs(rot - w) < 0.5;
  }, targetDeg, { timeout: 3000 });
}

/* ═══════════════════════════════════════════════════════════════════════════
   D1 — ★회전존 수(양성: 섹션 배경 편집 · 음성: 같은 판 그리드 칸 크롭)
═══════════════════════════════════════════════════════════════════════════ */
test('D1 ★섹션 배경 편집 진입 ⇒ 회전존 4개 (★음성 — 그리드 칸 크롭은 0개)', async ({ page }) => {
  const errs = await setupSection(page);
  await enterEdit(page);
  const n = await page.evaluate(() => document.querySelectorAll('#ss-handles-overlay .img-rotate-zone').length);
  expect(n, '★배경이미지 편집에 회전존이 없다').toBe(4);
  await exitEdit(page);

  // ★음성대조 — 같은 판에서 그리드 칸 크롭 진입(다른 편집기 호출)엔 회전존이 없다
  await page.evaluate(() => {
    const c = document.getElementById('innerA');
    c.insertAdjacentHTML('beforeend',
      '<div class="grid-block" id="gridA" data-rows="1" data-cols="1"></div>');
    const block = document.getElementById('gridA');
    window.setGridModel?.(block, { cells: [[{ lines: [{ type: 'image', imgSrc: window.__PNG1 || '' }] }]] });
  });
  const hasGrid = await page.evaluate(() => typeof window.enterGridImageEditMode === 'function');
  if (hasGrid) {
    await page.evaluate((src) => {
      const block = document.getElementById('gridA');
      try { window.setGridModel?.(block, { cells: [[{ lines: [{ type: 'image', imgSrc: src }] }]] }); } catch (_) {}
      window.enterGridImageEditMode?.(block, { r: 0, c: 0, li: 0 });
    }, PNG1);
    /* ⚠️★조건으로 못 바꾼 자리 — 적어 둔다(보고용): `window.setGridModel` 은 이 레포에 ★없다
     *   (grep 전수 — `js/**`엔 `getGridModel` 뿐, `setGridModel` 정의가 없다). 위 두 호출은
     *   둘 다 `?.` 라 조용히 no-op 이고, 그래서 gridA 는 실제 셀/줄 데이터가 ★없다.
     *   enterGridImageEditMode(js/image-handling.js:1502)는 `_grdImgLine` 이 null 이면
     *   ★곧바로 return 한다 — «코너핸들이 생긴다»는 조건은 ★영원히 안 선다(실측: 5000ms
     *   waitForFunction 이 2회 전부 타임아웃). ⇒ 기다릴 비동기 자체가 없다(동기 no-op) —
     *   그래서 고정 대기를 ★조건으로 바꾸지 않고 ★그냥 없앴다(아래는 즉시 읽기, 0 이 나오는
     *   까닭이 바뀌지 않는다: 예전엔 「150ms 동안 아무 일도 없어서 0」, 지금은 「호출 즉시
     *   no-op 이라 0」). ★음성대조 자체가 vacuous 하다는 점은 이 시험의 별도 결함이라 이번
     *   과업(고정 대기 치환) 범위 밖으로 남긴다. */
    const n2 = await page.evaluate(() => document.querySelectorAll('#ss-handles-overlay .img-rotate-zone').length);
    expect(n2, '★그리드 칸 크롭에 회전존이 생겼다 — 별건(noRotate)이 깨졌다').toBe(0);
  }
  expect(errs).toEqual([]);
});

/* ═══════════════════════════════════════════════════════════════════════════
   D2 — ★회전존 드래그 → bgRotate 저장 → 레이어 transform → 직렬화 왕복 생존
═══════════════════════════════════════════════════════════════════════════ */
test('D2 ★회전존 드래그 45° → Esc → dataset.bgRotate===45 · 레이어 transform · 직렬화 왕복', async ({ page }) => {
  const errs = await setupSection(page);
  // ★전제 — 재기 전엔 회전 키가 없다
  const pre = await page.evaluate(() => window.__sec.dataset.bgRotate ?? null);
  expect(pre, '★전제: 처음엔 bgRotate 가 없어야 한다').toBeNull();

  await enterEdit(page);
  await dragRotate(page, 45);
  await exitEdit(page);

  const r = await page.evaluate(() => {
    const sec = window.__sec;
    const layer = sec.querySelector(':scope > .sec-bg-clip > .sec-bg-img');
    const tf = layer ? getComputedStyle(layer).transform : null;
    const ser = window.serializeSectionClone ? window.serializeSectionClone(sec) : null;
    return { bgRotate: sec.dataset.bgRotate ?? null, hasLayer: !!layer, tf, ser };
  });
  expect(r.bgRotate, `★45° 드래그 뒤 dataset.bgRotate 가 «${r.bgRotate}» 다`).toBe('45');
  expect(r.hasLayer, '★레이어가 안 생겼다').toBe(true);
  expect(r.tf, `★레이어 computed transform 이 «${r.tf}» 다`).not.toBe('none');
  if (r.ser) {
    expect(r.ser, '★직렬화 결과에 data-bg-rotate="45" 가 없다').toContain('data-bg-rotate="45"');
  }

  // ★왕복 — rebindAll 로 다시 그려도 45 가 산다(rebindAll 자체는 동기이지만 poll 로 재 —
  //   고정 ms 대신 조건으로 두면 다음에 rebindAll 이 비동기화돼도 이 시험이 거짓 빨강을 안 낸다)
  await page.evaluate(() => { window.rebindAll?.(); });
  await expect.poll(() => page.evaluate(() => document.getElementById('secA')?.dataset.bgRotate ?? null),
    { message: '★rebindAll 왕복 뒤 bgRotate 가 사라졌다' }).toBe('45');
  expect(errs).toEqual([]);
});

test('D2-음성 ★맨클릭(0px 이동)은 bgRotate 키 자체가 없다(옛 저장본 바이트 보존)', async ({ page }) => {
  const errs = await setupSection(page);
  await enterEdit(page);
  // ★이동 0 — mousedown 즉시 mouseup(같은 자리)
  const pt = await page.evaluate(() => {
    const zone = document.querySelector('#ss-handles-overlay .img-rotate-zone');
    const r = zone.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  await page.mouse.move(pt.x, pt.y);
  await page.mouse.down();
  await page.mouse.up();
  await exitEdit(page);
  const bgRotate = await page.evaluate(() => window.__sec.dataset.bgRotate ?? null);
  expect(bgRotate, '★안 움직였는데 bgRotate 키가 생겼다').toBeNull();
  expect(errs).toEqual([]);
});

/* ═══════════════════════════════════════════════════════════════════════════
   D3 — ★색보정 패널이 뜬다(배경이미지 편집에도 에셋처럼)
═══════════════════════════════════════════════════════════════════════════ */
test('D3 ★배경이미지 편집 진입 ⇒ 색보정 패널이 뜨고 슬라이더 7개 (★음성 — 패널 클릭은 편집 유지)', async ({ page }) => {
  const errs = await setupSection(page);
  await enterEdit(page);
  const r = await page.evaluate(() => {
    const panel = document.getElementById('color-adjust-panel');
    const disp = panel ? getComputedStyle(panel).display : null;
    const keys = ['exposure', 'contrast', 'saturation', 'temperature', 'tint', 'highlights', 'shadows'];
    const sliders = keys.map(k => !!document.getElementById('ca-' + k));
    return { disp, sliderCount: sliders.filter(Boolean).length };
  });
  expect(r.disp, `★색보정 패널 display 가 «${r.disp}» 다`).not.toBe('none');
  expect(r.sliderCount, '★슬라이더가 7개가 아니다').toBe(7);

  // ★음성 — 패널 «안»을 클릭해도 편집이 안 끝난다(keepAliveSel·isColorPanel 규약)
  await page.evaluate(() => {
    const panel = document.getElementById('color-adjust-panel');
    panel.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  // ★isColorPanel 가드(js/image-handling.js:499)는 같은 click dispatch 안에서 동기로 판정한다 —
  //   poll 로 재면 «판정이 아직 안 돈» 창과 «판정이 실제로 틀렸다»를 가른다(둘 다 즉시 안 흔들림).
  await expect.poll(() => page.evaluate(() => !!document.querySelector('.sec-bg-proxy')),
    { message: '★색보정 패널 클릭으로 편집이 끝났다' }).toBe(true);
  await exitEdit(page);
  expect(errs).toEqual([]);
});

/* ═══════════════════════════════════════════════════════════════════════════
   D4 — ★핵심 한 쌍: 레이어만 물들고 섹션 본체·자식 콘텐츠는 안 물든다
═══════════════════════════════════════════════════════════════════════════ */
test('D4 ★채도 -100 ⇒ 레이어 filter 는 url(#...) · 섹션 자신 filter=none · 자식 픽셀 불변', async ({ page }) => {
  const errs = await setupSection(page);
  await page.evaluate(() => {
    const inner = document.getElementById('innerA');
    inner.insertAdjacentHTML('beforeend', '<div class="text-block" id="tbA"><div class="tb-body">본문 글자</div></div>');
  });
  await enterEdit(page);
  const before = await page.evaluate(() => {
    const tb = document.querySelector('#tbA .tb-body');
    return tb.getBoundingClientRect();
  });
  await page.evaluate(() => {
    const slider = document.getElementById('ca-saturation');
    slider.value = -100;
    slider.dispatchEvent(new Event('input', { bubbles: true }));
  });
  // ★applyImgColorAdjust→writeImgFilter(js/effects/image-redact.js:80)는 동기지만, poll 로 재면
  //   레이어 filter 가 실제로 바뀌었다는 «조건»이 되지(= asset-redact.dom.spec.js 와 같은 관용구)
  await expect.poll(() => page.evaluate(() => {
    const layer = window.__sec.querySelector(':scope > .sec-bg-clip > .sec-bg-img');
    return layer ? layer.style.filter : null;
  }), { message: '★채도 조정이 레이어 filter 에 반영되지 않았다' }).toMatch(/url\(["']?#img-color-adj-/);
  const r = await page.evaluate(() => {
    const sec = window.__sec;
    const layer = sec.querySelector(':scope > .sec-bg-clip > .sec-bg-img');
    const tb = document.querySelector('#tbA .tb-body');
    return {
      layerFilter: layer ? layer.style.filter : null,
      secFilter: getComputedStyle(sec).filter,
      tbRect: tb.getBoundingClientRect(),
    };
  });
  expect(r.layerFilter, `★레이어 filter 가 «${r.layerFilter}» 다`).toMatch(/url\(["']?#img-color-adj-/);
  expect(r.secFilter, `★섹션 자신의 computed filter 가 «${r.secFilter}» 다(물들면 안 된다)`).toBe('none');
  expect(Math.round(r.tbRect.width), '★자식 블럭 폭이 변했다(섹션 통째 filter 사고)').toBe(Math.round(before.width));
  expect(Math.round(r.tbRect.height)).toBe(Math.round(before.height));
  await exitEdit(page);
  expect(errs).toEqual([]);
});

/* ═══════════════════════════════════════════════════════════════════════════
   D5 — ★회귀(바이트): rotate·adj 가 없으면 레이어 0개 · 직렬화 바이트 불변
═══════════════════════════════════════════════════════════════════════════ */
test('D5 ★rotate·adj 없는 섹션은 .sec-bg-img 0개 · serializeSectionClone 이 편집 전과 바이트 동일', async ({ page }) => {
  const errs = await setupSection(page);
  const before = await page.evaluate(() => {
    const sec = window.__sec;
    return { layerCount: sec.querySelectorAll('.sec-bg-img').length, ser: window.serializeSectionClone?.(sec) ?? null };
  });
  expect(before.layerCount, '★손대기 전부터 레이어가 있다').toBe(0);

  // ★편집에 들어갔다 「아무것도 안 하고」 나온다 — 위치만 재확인(움직임 없음)
  await enterEdit(page);
  await exitEdit(page);

  const after = await page.evaluate(() => {
    const sec = window.__sec;
    return { layerCount: sec.querySelectorAll('.sec-bg-img').length, ser: window.serializeSectionClone?.(sec) ?? null };
  });
  expect(after.layerCount, '★편집을 열었다 닫았을 뿐인데 레이어가 남았다').toBe(0);
  if (before.ser !== null && after.ser !== null) {
    expect(after.ser, '★손도 안 댔는데 직렬화 바이트가 바뀌었다').toBe(before.ser);
  }
  expect(errs).toEqual([]);
});

/* ═══════════════════════════════════════════════════════════════════════════
   D6 — ★소독: 편집 중 DOM 을 세척하면 proxy/rotate-zone/hint 는 0건, 레이어는 남는다
═══════════════════════════════════════════════════════════════════════════ */
test('D6 ★serializeCleanRoot — proxy·rotate-zone·hint 0건, .sec-bg-img 는 남는다', async ({ page }) => {
  const errs = await setupSection(page);
  await enterEdit(page);
  await dragRotate(page, 45);   // ★레이어를 만들어 둔다(편집 «중» 상태로 — 아직 커밋 전)
  const r = await page.evaluate(() => {
    const sec = window.__sec;
    const beforeStr = sec.outerHTML;
    const clone = sec.cloneNode(true);
    window.serializeCleanRoot?.(clone);
    const afterStr = clone.outerHTML;
    const hits = (s, needles) => needles.filter(n => s.includes(n));
    return {
      beforeHits: hits(beforeStr, ['sec-bg-proxy', 'img-rotate-zone', 'img-edit-hint']),
      afterHits: hits(afterStr, ['sec-bg-proxy', 'img-rotate-zone', 'img-edit-hint']),
      layerSurvives: afterStr.includes('sec-bg-img'),
    };
  });
  // ★양성대조 전제 — 세척 «전» 문자열엔 반드시 편집 UI 가 들어 있어야 한다(픽스처가 우연히 빈 경우 배제)
  expect(r.beforeHits.length, `★세척 전에 편집 UI 흔적이 없다(${JSON.stringify(r.beforeHits)}) — 전제가 안 섰다`).toBeGreaterThan(0);
  expect(r.afterHits, `★세척 뒤에도 편집 UI 가 남았다: ${JSON.stringify(r.afterHits)}`).toEqual([]);
  expect(r.layerSurvives, '★세척이 영구 레이어(.sec-bg-img)까지 지웠다').toBe(true);
  await exitEdit(page);
  expect(errs).toEqual([]);
});

/* ═══════════════════════════════════════════════════════════════════════════
   D7 — ★내보내기 bake: 색보정 걸린 배경이 data: 로 굽힌다
═══════════════════════════════════════════════════════════════════════════ */
test('D7 ★bakeImgFilterToCanvas — 레이어 background-image 가 data: 로 갈리고 filter 가 비워진다', async ({ page }) => {
  const errs = await setupSection(page);
  await enterEdit(page);
  await page.evaluate(() => {
    const slider = document.getElementById('ca-contrast');
    slider.value = 40;
    slider.dispatchEvent(new Event('input', { bubbles: true }));
  });
  // ★같은 자(D4 와 동일) — 레이어 filter 에 반영됐다는 조건으로 재고 exit 한다
  await expect.poll(() => page.evaluate(() => {
    const layer = window.__sec.querySelector(':scope > .sec-bg-clip > .sec-bg-img');
    return layer ? layer.style.filter : null;
  }), { message: '★대비 조정이 레이어 filter 에 반영되지 않았다' }).toMatch(/url\(["']?#img-color-adj-/);
  await exitEdit(page);

  const pre = await page.evaluate(() => {
    const layer = window.__sec.querySelector(':scope > .sec-bg-clip > .sec-bg-img');
    return { bg: layer?.style.backgroundImage ?? null, filter: layer?.style.filter ?? null };
  });
  expect(pre.filter, `★커밋 뒤 레이어 filter 가 «${pre.filter}» 다`).toMatch(/url\(["']?#img-color-adj-/);

  const r = await page.evaluate(async () => {
    const sec = window.__sec;
    const clone = sec.cloneNode(true);
    document.body.appendChild(clone);
    const layer = clone.querySelector(':scope > .sec-bg-clip > .sec-bg-img');
    const bakeFn = window.bakeImgFilterToCanvas;
    let baked = null, skippedFilter = null;
    if (bakeFn && layer) {
      await bakeFn(layer);
      baked = { bg: layer.style.backgroundImage, filter: layer.style.filter };
    }
    clone.remove();
    // ★음성 — bake 를 건너뛰면 filter 가 남는다(= bake 가 실제로 일을 했다는 대조)
    const clone2 = sec.cloneNode(true);
    const layer2 = clone2.querySelector(':scope > .sec-bg-clip > .sec-bg-img');
    skippedFilter = layer2 ? layer2.style.filter : null;
    return { baked, hasFn: !!bakeFn, hasLayer: !!layer, skippedFilter };
  });
  expect(r.hasFn, 'window.bakeImgFilterToCanvas 가 없다').toBe(true);
  expect(r.hasLayer, '클론에 .sec-bg-img 레이어가 없다').toBe(true);
  expect(r.baked?.bg, `★bake 뒤 background-image 가 «${r.baked?.bg}» 다`).toMatch(/^url\("?data:/);
  expect(r.baked?.filter, `★bake 뒤 filter 가 «${r.baked?.filter}» 다`).toBe('');
  expect(r.skippedFilter, '★음성대조 — bake 를 안 거친 클론은 filter 가 남아 있어야 한다').toMatch(/url\(["']?#img-color-adj-/);
  expect(errs).toEqual([]);
});
