/* section-mesh-gradient-v1.dom.spec.js
 *   ★★`prev-06` — ★「메시 그라데이션」을 ★★v1 으로 ★비슷하게 ★흉내낸다. (2026-10-25 신설 · 지디)
 *
 * ★발주 (★server-manager 가 ★전한 ★현빈 결정 · ★⒜ GO)
 *   「메시 그라데이션 ★v1 으로 ★비슷하게 ★흉내낼 것」 — `radial-gradient` ★4겹 ＋ ★blend ·
 *   ★CSS 만 · ★★네 출구[저장·PNG·HTML·Figma] ★그대로 · ★★저장 꼴 ★무변.
 *   현빈이 ★「피그마와 똑같진 않다」를 ★수용했다(⒝ ★저장꼴 ★변경 길은 ★안 간다).
 *
 * ★★★먼저 ★잰 것 — ★★보안 검사가 ★4겹을 ★받나 (★발주서가 ★짚은 ★그 자리 `prop-section.js:109~124`)
 *   `isSectionGradient(v)` 의 ★마지막 칸 :
 *       if (depth === 0 && i !== s.length - 1) return false;   // 함수가 끝났는데 뒤에 뭔가 있다
 *   ⇒ ★★★«맨 바깥 괄호가 ★문자열 ★끝에서 ★닫혀야» ★참이다 ⇒ ★★`radial-gradient(…), radial-gradient(…)` 는
 *     ★★★★거짓이다. ★즉 ★4겹 값을 ★`dataset.bg` 에 ★넣는 길은 ★★막혀 있다.
 *   ★그 좁힘은 ★★«일부러» 한 것이다(`★1013t2E1 중-1(보안)` — `linear-gradient(…)"><img onerror=…>` 가
 *     ★예전엔 ★패널 innerHTML 로 ★들어갔다). ⇒ ★★⛔넓히지 ★않는다.
 *
 * ★★★그래서 ★고른 길 — ★★«다른 칸»에 ★둔다
 *   ★`sec.dataset.bgMesh` = `"#rrggbb|#rrggbb|#rrggbb|#rrggbb"` (★TL|TR|BR|BL · ★네 모서리 색 ★만)
 *   ★그리기는 ★`_applySectionBg` ★한 자리가 ★4겹을 ★★조립한다 ⇒
 *     ⑴ ★★`isSectionGradient` 를 ★한 글자도 ★안 건드린다 (★보안 ★무변 — ★아래 ★M4 가 ★잰다)
 *     ⑵ ★저장 꼴은 ★★덧붙임이다 — ★메시를 ★안 쓴 섹션의 ★저장 바이트가 ★★한 글자도 ★안 바뀐다(★M6 · ★단위 골든)
 *     ⑶ ★네 출구는 ★★이미 ★`style.backgroundImage` 를 ★읽는 길이 ★있다(★기존 그라데이션과 ★같은 자리)
 *
 * ★★안 재는 축 (★이름)
 *   · ★★`MESH-PNG-NATIVE-PIXEL-UNMEASURED-01` ⇒ ★★261025 ★닫혔다(미카사 · 실앱 네이티브 캡처).
 *     ★실측 — 1x 860×283 PNG 의 모서리 2px 안쪽 네 점 `#fe6ec6`/`#7b5cfe`/`#4dd6d1`/`#fdd067`
 *       ⇒ ★여기 ★M7 이 잰 헤드리스 값과 ★채널차 ★≤2. ★가운데 `#b19ebf`(예측 평균 `#b19dbf`).
 *       ★대조군도 돌았다 — ★민 섹션 다섯 점 `#ffffff` · ★linear 섹션 위 분홍/아래 청록.
 *   · ★html2canvas 폴백(웹빌드)이 ★4겹을 ★그리나 — `MESH-H2C-FALLBACK-UNMEASURED-01` (★아직 안 잼)
 *     (★그 길은 ★게이트 ★비적용이다 — `export-image.js:488` 「검사는 여기서 «안» 돈다」)
 *   · ★★★Figma — ★★261025 ★★내 독해가 ★틀렸고 ★미카사가 ★실앱으로 ★잡았다. ★정정해 적는다 :
 *     ⛔내가 처음에 쓴 말 = 「`isGradient` 를 ★단색 `#eeeeee` 로 떨어뜨린다(`:1449`)」
 *       ★★틀렸다 — ★나는 ★`:1449`(★마지막 줄)만 보고 ★박았고, ★그 ★앞에
 *       ★★`if (_liveOpaque) background = _liveBg;`(:1447)가 ★★먼저 있다.
 *       ★메시 섹션은 ★`backgroundColor = 네 색 평균`(★불투명)을 깔므로 ★★거기서 끝난다.
 *     ★★실측(미카사 · 실앱 Figma JSON) : ★메시 섹션 fill = `rgb(177,157,191)` = ★네 모서리 ★평균 ·
 *       ★`linear` 섹션 fill = `rgb(255,255,255)` ⇒ ★★`#eeeeee` 는 ★★한 번도 ★안 나왔다.
 *       ★그 값은 ★★«진짜 투명한» 섹션에서만 나온다(그 줄의 주석이 ★그렇게 적어 뒀다).
 *     ★★「기존 그라데이션과 ★같은 방식으로 degrade」라는 ★★취지는 ★맞았다 —
 *       ★`linear` 도 ★한 색(흰색)으로 간다. ⇒ ★그라데이션이 ★Figma 에서 ★한 색이 되는 것은
 *       ★★메시만의 일이 ★아니다(★기존 결함). ★★틀린 것은 ★«값»이다.
 *     ★쓸 만한가 = ★★✗(미카사 판정) — ★고른 네 색이 ★하나도 ★안 간다.
 *       ⇒ ★별건 카드 `MESH-FIGMA-FOUR-RADIAL-PAINTS-01`(메시를 radial 4겹 paint 로)
 *       ＋ ★덤 `SECTION-GRADIENT-FIGMA-WHITE-NOT-EEEEEE-01`(★기존 linear 도 같은 손실)
 *     ★안 잰 축 — ★실 Figma ★업로드 · ★투명 바탕 갈래 · ★내보내기 단추 ★실클릭(MCP 로 같은 함수 호출).
 *     ⇒ `MESH-FIGMA-FLATTEN-UNMEASURED-01` 은 ★닫는다(★위 둘이 ★그 자리를 ★이어받는다).
 *
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js section-mesh-gradient-v1
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');

const raf2 = (page) => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));

/** 섹션 둘을 ★앱 길(`addSection`)로 깐다 — `mA` = 메시를 ★쓸 섹션 · `mB` = ★음성대조(안 쓴다).
    ★★⛔섹션 HTML 을 ★손으로 꽂지 ★마라 — 261025 ★실측: `.section-hitzone`·`data-section` 이 빠져
      ★진짜 클릭이 ★섹션을 ★못 고르고 ★`M0` 가 ★빨강이 됐다(그러면 ★나머지 빨강이 ★「기능 없음」인지
      ★「하네스 고장」인지 ★구분이 ★안 된다). ⇒ ★꼴은 ★앱이 ★만든 것만 쓴다. */
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

/** ★진짜 마우스 클릭으로 섹션을 고른다(왼쪽 패딩 띠). 전제 = 그 섹션이 골라지고 ★섹션 패널이 떴다.
    ⛔`selectSection()` 호출로 ★패널 유무를 재지 마라 — 261025 에 그 자로 「UI 없다」를 ★두 번 틀렸다. */
async function pickSection(page, id) {
  await page.evaluate((i) => document.getElementById(i).scrollIntoView({ block: 'center' }), id);
  const b = await waitStableRect(page, '#' + id);
  await page.mouse.click(b.left + 8, b.cy);
  await page.waitForFunction((i) =>
    document.getElementById(i)?.classList.contains('selected') &&
    document.getElementById('sec-height-value')?.dataset.secId === i, id, { timeout: 8000 });
  await raf2(page);
}

const MESH = '#ff0080|#7928ca|#00d4ff|#ffdd00';

/** 섹션 배경 상태 — ★«쟀다»를 그대로 찍는다(단언이 터지면 수가 보이게). */
const bgState = (page, id) => page.evaluate((i) => {
  const s = document.getElementById(i);
  const cs = getComputedStyle(s);
  const img = cs.backgroundImage || '';
  return {
    mesh: s.dataset.bgMesh ?? null,
    bg: s.dataset.bg ?? null,
    layers: (img.match(/radial-gradient\(/g) || []).length,
    blend: cs.backgroundBlendMode || '',
    img: img.slice(0, 220),
  };
}, id);

/* ─────────────────────────────── M0 ★전제 ─────────────────────────────── */
test('M0 ★자가점검 — 앱이 떠지고, 섹션 둘이 서고, ★진짜 클릭으로 섹션 패널이 뜬다', async ({ page }) => {
  const { errs, A, B } = await setup(page);
  expect(typeof A === 'string' && A && typeof B === 'string' && B && A !== B,
    `addSection 이 준 id = ${A} / ${B}`).toBe(true);
  const n = await page.evaluate(() => document.querySelectorAll('#canvas .section-block').length);
  expect(n, `섹션 수 = ${n}`).toBe(2);
  await pickSection(page, A);
  /* ★패널이 ★정말 섹션 패널인가 — 기존 칸(배경색)이 ★있나로 잰다(★이 스펙이 ★더할 칸이 아니다) */
  const hasBgField = await page.evaluate(() => !!document.getElementById('sec-bg-color'));
  expect(hasBgField, '섹션 패널의 기존 「배경색」 칸이 없다 — 패널 자체가 안 떴다 ⇒ 아래 판정 전부 무효').toBe(true);
  expect(errs, `콘솔 오류 = ${JSON.stringify(errs)}`).toEqual([]);
});

/* ─────────────────────── M1~M3 ★제품 (고치기 전 = 빨강) ─────────────────────── */
test('M1 ★섹션 Background 절에 ★「메시 그라데이션」 단추가 있다', async ({ page }) => {
  const { A } = await setup(page);
  await pickSection(page, A);
  const r = await page.evaluate(() => {
    const b = document.getElementById('sec-bg-mesh');
    if (!b) return { found: false };
    const sec = b.closest('.prop-section');
    const title = sec?.querySelector('.prop-section-title')?.textContent?.trim() || '';
    return { found: true, title, text: b.textContent.trim() };
  });
  expect(r.found, '`#sec-bg-mesh` 단추가 패널에 없다').toBe(true);
  expect(r.title, `단추가 든 절의 제목 = "${r.title}"`).toBe('Background');
});

test('M2 ★켜면 ★네 모서리 색 칸이 ★«넷» 생긴다 (TL·TR·BR·BL)', async ({ page }) => {
  const { A } = await setup(page);
  await pickSection(page, A);
  await page.locator('#sec-bg-mesh').click();
  await raf2(page);
  const found = await page.evaluate(() =>
    ['tl', 'tr', 'br', 'bl'].filter(k => !!document.getElementById(`sec-mesh-${k}-color`)));
  expect(found, `생긴 칸 = ${JSON.stringify(found)}`).toEqual(['tl', 'tr', 'br', 'bl']);
});

test('M3 ★켜면 ★`radial-gradient` 가 ★«네 겹» 그려지고 ★blend 가 선다 · 값은 `data-bg-mesh` 에 산다', async ({ page }) => {
  const { A } = await setup(page);
  await pickSection(page, A);
  await page.locator('#sec-bg-mesh').click();
  await raf2(page);
  const st = await bgState(page, A);
  expect(st.layers, `radial-gradient 겹 수 = ${st.layers} · img=${st.img}`).toBe(4);
  expect(st.blend, `background-blend-mode = "${st.blend}"`).not.toBe('');
  expect(st.mesh, `data-bg-mesh = ${st.mesh}`).toMatch(/^#[0-9a-f]{6}(\|#[0-9a-f]{6}){3}$/i);
  /* ★★4겹 CSS 를 ★`dataset.bg` 에 ★싣지 ★않았다 — ★그게 ★보안 검사를 ★안 건드린 ★까닭이다 */
  expect(String(st.bg || ''), `dataset.bg = ${st.bg}`).not.toMatch(/radial-gradient\([^)]*\)\s*,/);
});

/* ───────────────────── M4 ★★보안 ★무변 (＋★자가작동 양성) ───────────────────── */
test('M4 ★★보안 검사는 ★그대로다 — 4겹은 ★거짓, 한 겹은 ★참 (★자가작동 양성대조 한 쌍)', async ({ page }) => {
  await setup(page);
  const r = await page.evaluate(() => {
    const f = window.isSectionGradient;
    if (typeof f !== 'function') return { ok: false };
    return {
      ok: true,
      four: f('radial-gradient(at 0% 0%, #ff0080 0%, rgba(255,0,128,0) 70%), radial-gradient(at 100% 0%, #7928ca 0%, rgba(121,40,202,0) 70%)'),
      one:  f('radial-gradient(at 0% 0%, #ff0080 0%, rgba(255,0,128,0) 70%)'),
      inj:  f('linear-gradient(#fff, #000)"><img src=x onerror=alert(1)>'),
    };
  });
  expect(r.ok, 'window.isSectionGradient 가 없다 — 판정 무효').toBe(true);
  /* ★★★이 칸이 ★항등식이 되지 않게 ★«참이 나오는 쪽»을 ★같이 걸었다 —
       ⛔`one` 이 없으면 ★「함수가 늘 거짓」일 때도 ★초록이다. */
  expect(r.one,  '한 겹 radial-gradient 가 거짓이다 — ★자가 작동 안 함 ⇒ `four` 의 거짓은 뜻이 없다').toBe(true);
  expect(r.four, '★★4겹이 참이 됐다 = ★보안 검사가 ★넓어졌다 ⇒ `1013t2E1 중-1` 을 되돌린 것이다').toBe(false);
  expect(r.inj,  '★주입 꼴이 참이 됐다 = 보안 구멍').toBe(false);
});

/* ─────────────────────────── M5 ★왕복 (저장 → 복원) ─────────────────────────── */
test('M5 ★저장본에 `data-bg-mesh` 가 실리고, ★다시 열면 4겹이 ★되살아난다', async ({ page }) => {
  const { A } = await setup(page);
  await pickSection(page, A);
  await page.locator('#sec-bg-mesh').click();
  await raf2(page);
  const r = await page.evaluate(async (id) => {
    const html = String(window.getSerializedCanvas?.() || '');
    const inSave = /data-bg-mesh="#[0-9a-f]{6}(\|#[0-9a-f]{6}){3}"/i.test(html);
    /* ★인라인 style 을 ★걷어내고 ★넣는다 — ★저장본만 믿고 그리는 길(템플릿·붙여넣기)을 ★재야
       「인라인이 살아 와서 그냥 보였다」와 ★구분된다(`save-load.js:1177~1180` 머리말의 그 길). */
    const stripped = html.replace(/style="[^"]*"/g, '');
    const c = document.getElementById('canvas');
    c.innerHTML = stripped;
    await window.rebindAll?.();
    const sec = document.getElementById(id);
    const cs = sec ? getComputedStyle(sec) : null;
    return {
      inSave,
      mesh: sec?.dataset.bgMesh ?? null,
      layers: cs ? (cs.backgroundImage.match(/radial-gradient\(/g) || []).length : -1,
    };
  }, A);
  expect(r.inSave, '저장본(getSerializedCanvas)에 data-bg-mesh 가 없다').toBe(true);
  expect(r.mesh, `복원 뒤 data-bg-mesh = ${r.mesh}`).toMatch(/^#[0-9a-f]{6}(\|#[0-9a-f]{6}){3}$/i);
  expect(r.layers, `복원 뒤 radial-gradient 겹 수 = ${r.layers} (인라인 style 을 걷고 쟀다)`).toBe(4);
});

/* ───────────────────────────── M6 ★음성대조 ───────────────────────────── */
test('M6 ★★음성대조 — 메시를 ★안 켠 섹션은 ★한 겹도 안 그려진다 (⛔「전부 메시가 된다」가 아니다)', async ({ page }) => {
  const { A, B } = await setup(page);
  await pickSection(page, A);
  await page.locator('#sec-bg-mesh').click();
  await raf2(page);
  const a = await bgState(page, A);
  const b = await bgState(page, B);
  expect(a.layers, `A 겹 수 = ${a.layers}`).toBe(4);
  expect(b.mesh, `B data-bg-mesh = ${b.mesh} — 켜지 않은 섹션에 값이 생겼다`).toBe(null);
  expect(b.layers, `B 겹 수 = ${b.layers} · img=${b.img}`).toBe(0);
});

/* ───────────────── M7 ★★모서리 ★픽셀 (★이번에 잡은 결함을 ★잠근다) ───────────────── */
/* ★261025 ★실측으로 ★잡은 것 — ★겹의 꼴이 ★`circle` 이면 ★기본 반지름이 ★대각선이라
     ★가로로 긴 섹션에서 ★왼위 겹이 ★왼아래를 ★덮어 ★★사용자가 ★왼아래에 고른 색이 ★안 나왔다
     (circle: BL `#feaa8e` ← 고른 값 `#ffd166`). ⇒ ★`ellipse farthest-side` 로 고쳤다.
   ★★⛔이 칸이 없으면 ★다음 사람이 ★`circle` 로 되돌려도 ★아무도 모른다 — ★나머지 여섯 칸은
     ★「4겹이 섰나」만 보지 ★「무슨 색이 나오나」는 ★안 본다. */
const CORNER_COLS = ['#ff6ec7', '#7b5cff', '#4ad7d1', '#ffd166'];
const CORNER_AT = ['0% 0%', '100% 0%', '100% 100%', '0% 100%'];

/** 섹션의 ★지금 배경 CSS 를 ★그대로 먹인 사본을 ★SVG foreignObject 로 그려 ★픽셀을 읽는다.
    `shapeOverride` 를 주면 ★그 꼴로 ★다시 조립해 읽는다(= ★양성대조용 ★사본). */
async function cornerPixels(page, id, shapeOverride) {
  return page.evaluate(async ([i, shape, cols, at]) => {
    const el = document.getElementById(i);
    const st = getComputedStyle(el);
    const box = el.getBoundingClientRect();
    const w = Math.round(box.width), h = Math.round(box.height);
    let image = st.backgroundImage;
    if (shape) {
      const fade = (x) => `rgba(${parseInt(x.slice(1,3),16)}, ${parseInt(x.slice(3,5),16)}, ${parseInt(x.slice(5,7),16)}, 0)`;
      image = cols.map((x, n) => `radial-gradient(${shape} at ${at[n]}, ${x} 0%, ${fade(x)} 72%)`).join(', ');
    }
    const div = `<div xmlns="http://www.w3.org/1999/xhtml" style="width:${w}px;height:${h}px;background-image:${image};background-color:${st.backgroundColor};background-blend-mode:${st.backgroundBlendMode};background-size:cover;background-position:center;background-repeat:no-repeat"></div>`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><foreignObject width="100%" height="100%">${div}</foreignObject></svg>`;
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); });
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d'); ctx.drawImage(img, 0, 0);
    const px = (x, y) => { const d = ctx.getImageData(x, y, 1, 1).data; return [d[0], d[1], d[2]]; };
    return { w, h, TL: px(2, 2), TR: px(w - 3, 2), BR: px(w - 3, h - 3), BL: px(2, h - 3) };
  }, [id, shapeOverride || null, CORNER_COLS, CORNER_AT]);
}
const hexOf = (a) => '#' + a.map(v => v.toString(16).padStart(2, '0')).join('');
const near = (a, hex, tol = 8) => {
  const w = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  return a.every((v, i) => Math.abs(v - w[i]) <= tol);
};

test('M7 ★★네 모서리 픽셀이 ★사용자가 고른 색 ★그대로다 (＋★`circle` 사본은 ★틀어진다 = 양성대조)', async ({ page }) => {
  const { A } = await setup(page);
  await pickSection(page, A);
  await page.evaluate(([i, cols]) => {
    const el = document.getElementById(i);
    el.dataset.bgMesh = cols.join('|');
    window.applySectionBg?.(el);
  }, [A, CORNER_COLS]);
  await raf2(page);

  const r = await cornerPixels(page, A);
  /* ★전제 — 상자가 ★가로로 길어야 ★이 결함이 ★드러난다(정사각이면 circle 도 맞는다) */
  expect(r.w > r.h, `전제: 섹션이 가로로 길다 ${r.w}×${r.h}`).toBe(true);
  const got = { TL: hexOf(r.TL), TR: hexOf(r.TR), BR: hexOf(r.BR), BL: hexOf(r.BL) };
  ['TL', 'TR', 'BR', 'BL'].forEach((k, n) => {
    expect(near(r[k], CORNER_COLS[n]), `${k} = ${got[k]} · 고른 값 ${CORNER_COLS[n]} (전부: ${JSON.stringify(got)})`).toBe(true);
  });

  /* ★★양성대조 — ★같은 자로 ★`circle` 사본을 재면 ★왼아래가 ★틀어진다.
     ⛔이게 없으면 「자가 늘 통과한다」와 ★구분이 ★안 된다. */
  const c = await cornerPixels(page, A, 'circle');
  const cGot = { TL: hexOf(c.TL), TR: hexOf(c.TR), BR: hexOf(c.BR), BL: hexOf(c.BL) };
  expect(near(c.BL, CORNER_COLS[3]), `★양성대조 실패 — circle 사본의 BL 이 ${cGot.BL} 로 ★맞게 나왔다 ⇒ 이 자는 아무것도 안 잰다 (전부: ${JSON.stringify(cGot)})`).toBe(false);
});

/* ─────────────────── M8 ★★저장 꼴 ★무변 (＋★양성대조) ─────────────────── */
/* ★발주서의 ★「저장 꼴 ★무변」을 ★행위로 잰다 — ★메시를 ★안 쓴 저장본에 ★이번에 더한 ★어떤 글자도
     ★나타나지 ★않는다. ★양성대조 = ★켜면 ★정확히 ★한 섹션에만 ★나타난다. */
test('M8 ★★메시를 안 쓴 저장본엔 이번에 더한 글자가 0개 (＋켜면 1개 = 양성대조)', async ({ page }) => {
  const { A } = await setup(page);
  const before = await page.evaluate(() => String(window.getSerializedCanvas?.() || ''));
  const count = (s, w) => (s.split(w).length - 1);
  const NEW_WORDS = ['bg-mesh', 'background-blend-mode', 'blendMode'];
  NEW_WORDS.forEach(w => {
    expect(count(before, w), `★메시 0개인 저장본에 "${w}" 가 ${count(before, w)} 번 나왔다`).toBe(0);
  });

  await pickSection(page, A);
  await page.locator('#sec-bg-mesh').click();
  await raf2(page);
  const after = await page.evaluate(() => String(window.getSerializedCanvas?.() || ''));
  /* ★★양성대조 — ⛔없으면 「저장본이 늘 비어 있다」와 ★구분이 ★안 된다 */
  expect(count(after, 'data-bg-mesh'), `켠 뒤 data-bg-mesh = ${count(after, 'data-bg-mesh')} 번 (★1 이어야 한다)`).toBe(1);
  /* ★섹션 ★둘 중 ★하나만 바뀐다 — ★나머지 바이트는 ★그대로다 */
  expect(after.length > before.length, `켠 뒤 길이 ${before.length} → ${after.length}`).toBe(true);
});

/* ────────── M9 ★★메시 ↔ 배경«색» — ★같은 자리를 ★다툰다 (★자가검산으로 잡은 결함) ────────── */
/* ★261025 — ★내 첫 판에는 ★이 처리가 ★없었다: 메시가 켜진 섹션에서 ★배경색을 고르면
     `_applySectionBg` 가 ★메시를 ★먼저 그려서 ★★고른 색이 ★아무 일도 ★안 했다(피커가 ★먹통으로 보인다).
   ★이것은 ★새 규약이 ★아니다 — ★그라데이션도 ★「단색을 주면 걷는다」가 ★이미 규약이고
     (tests/dom/section-bg-gradient ★G10), ★메시도 ★같은 자리(섹션 배경)를 ★다툰다. */
test('M9 ★★메시가 켜진 섹션에 ★배경색을 고르면 ★메시가 걷히고 ★그 색이 선다 (＋외부 API 도 같다)', async ({ page }) => {
  const { A } = await setup(page);
  await pickSection(page, A);
  await page.locator('#sec-bg-mesh').click();
  await raf2(page);
  const on = await bgState(page, A);
  expect(on.layers, `전제: 메시가 켜졌다 (겹 ${on.layers})`).toBe(4);

  /* ⑴ ★패널 길 — ★색 칸에 ★진짜로 쳐 넣는다 */
  await page.locator('#sec-bg-hex').click();
  await page.keyboard.press('Meta+A');
  await page.keyboard.type('00FF00');
  await page.keyboard.press('Enter');
  await raf2(page);
  const after = await bgState(page, A);
  expect(after.mesh, `색을 고른 뒤 data-bg-mesh = ${after.mesh} (★걷혔어야 한다)`).toBe(null);
  expect(after.layers, `색을 고른 뒤 겹 수 = ${after.layers} · img=${after.img}`).toBe(0);
  const cssColor = await page.evaluate((i) => getComputedStyle(document.getElementById(i)).backgroundColor, A);
  expect(cssColor, `고른 색이 안 섰다 — ${cssColor}`).toBe('rgb(0, 255, 0)');

  /* ⑵ ★외부 API 길 (`window.setSectionBg`) — ★main.js IPC·피그마 수입이 쓰는 그 자리 */
  await page.evaluate((i) => {
    const el = document.getElementById(i);
    el.dataset.bgMesh = '#ff0000|#00ff00|#0000ff|#ffff00';
    window.applySectionBg?.(el);
  }, A);
  await raf2(page);
  const on2 = await bgState(page, A);
  expect(on2.layers, `전제 ⑵: 메시를 다시 켰다 (겹 ${on2.layers})`).toBe(4);
  await page.evaluate((i) => window.setSectionBg(document.getElementById(i), '#0000ff'), A);
  await raf2(page);
  const api = await bgState(page, A);
  expect(api.mesh, `setSectionBg 뒤 data-bg-mesh = ${api.mesh} (★걷혔어야 한다)`).toBe(null);
  expect(api.layers, `setSectionBg 뒤 겹 수 = ${api.layers} · img=${api.img}`).toBe(0);
});

/* ───────── M10 ★★「배경색」 칸이 ★내가 안 고른 값을 ★보이지 않는다 (★캡처로 잡았다) ───────── */
/* ★261025 — ★구현 모습을 ★찍어 ★보다가 잡았다: 패널 「배경색」이 ★`B19DBF` 를 보였는데
     ★그건 ★제품이 ★메시의 ★바닥으로 깐 ★«네 색 평균»이지 ★★사용자가 ★고른 값이 ★아니다.
   ★까닭 — `rawBg = sec.dataset.bg || sec.style.backgroundColor || …` 라, `dataset.bg` 가 비면
     ★인라인 `backgroundColor`(= 내가 깐 파생값)를 ★읽는다.
   ⇒ ★메시가 켜져 있으면 ★그 파생값을 ★안 읽는다. ★그리고 ★그 칸이 ★무엇을 하는지(색을 고르면
     ★메시가 꺼진다)를 ★한 줄로 ★알린다 — ⛔칸을 ★숨기지는 ★않는다(숨기면 M9 의 패널 길이 ★사라진다). */
test('M10 ★★메시가 켜져도 「배경색」 칸은 ★파생 바닥색을 ★안 보인다 (＋안내 한 줄 · ＋끄면 안내도 간다)', async ({ page }) => {
  const { A } = await setup(page);
  await pickSection(page, A);
  await page.locator('#sec-bg-mesh').click();
  await raf2(page);
  const r = await page.evaluate((i) => {
    const el = document.getElementById(i);
    return {
      hex: document.getElementById('sec-bg-hex')?.value ?? null,
      bg: el.dataset.bg ?? null,
      liveColor: getComputedStyle(el).backgroundColor,
      hint: !!document.getElementById('sec-bg-mesh-hint'),
    };
  }, A);
  /* ★전제 — 제품이 ★정말 파생 바닥색을 ★깔았다(안 깔았으면 이 칸은 아무것도 안 잰다) */
  expect(r.liveColor, `전제: 메시 바닥색이 깔렸다 — ${r.liveColor}`).toMatch(/^rgb\(/);
  const live = '#' + (r.liveColor.match(/\d+/g) || []).slice(0, 3)
    .map(v => Number(v).toString(16).padStart(2, '0')).join('').toUpperCase();
  expect(String(r.hex || '').toUpperCase(), `「배경색」 hex = ${r.hex} · 파생 바닥색 = ${live} — 사용자가 고른 적 없는 값이다`)
    .not.toBe(live.replace('#', ''));
  expect(r.hint, '메시가 켜졌는데 「색을 고르면 메시가 꺼진다」 안내가 없다').toBe(true);

  /* ★★음성대조 — 끄면 ★안내도 ★사라진다(⛔늘 떠 있는 줄이면 아무것도 안 잰다) */
  await page.locator('#sec-bg-mesh').click();
  await raf2(page);
  const off = await page.evaluate(() => !!document.getElementById('sec-bg-mesh-hint'));
  expect(off, '메시를 껐는데 안내가 남아 있다').toBe(false);
});
