/* checker-pixel-identity.dom.spec.js — 체커 값을 변수로 모은 뒤에도 «화면 픽셀이 한 점도 안 변했다» (S1 선행, 2026-10-04).
 * 골든 = 07d8178b(변수화 전) 에서 찍은 PNG (tests/dom/fixtures/checker-golden/*.png). 지금 판을 같은 방법으로 찍어 «픽셀 수준»으로 대조한다.
 *   찍는 법(골든 갱신): GD1001_ROOT=<07d8178b 체크아웃> CHECKER_SNAP=update npx playwright test --config=tests/dom/playwright.dom.config.js checker-pixel-identity
 *   ⚠️S1 이 «일부러» 체커를 어둡게 하면 이 시험은 빨강이 된다 — 그때 골든을 새 시안 값으로 갈고 이 머리말에 날짜·사유를 적는다(변수 하나를 바꿔 빨강이 되는 것이 «설계»).
 * ★2026-10-04 S1 «체커 어둡게» 토글(현빈 「켜고 끄는 단추」·지디: 전역 :root·기본 끔·값 A) — 골든은 «두 벌»이 됐다.
 *   ① 끔 골든 <id>.png 는 «갈지 않았다» — 끔 = 지금 화면 그대로가 약속이므로 07d8178b 골든과 0 픽셀 차가 그대로 회귀 기준이다(CP · CP-off).
 *   ② 켬 골든 <id>@dark.png — 찍는 법: CHECKER_SNAP=update-dark npx playwright test --config=tests/dom/playwright.dom.config.js tests/dom/checker-pixel-identity.dom.spec.js
 *      ⚠️새 판에서 찍은 켬 골든은 새 판과 같은 게 당연하다(동어반복) ⇒ CP-dark 에 두 겹을 같이 단다:
 *        ⓐ 순환 방지 — 켬 그림이 «끔 골든(a6bd560b 판 그대로)»과 11/11 자리 «모두» 달라야 한다(diff=0 인 자리 = 토글이 안 닿은 자리).
 *        ⓑ 값 대조 — 켬 그림에 css/editor-base.css 를 «텍스트로» 읽은 톤 값(a·b)이 «정확히» 있고, 끔 값은 없다
 *           (getComputedStyle 로 기대값을 만들면 계산기 세탁 — 독립 경로로 읽는다).
 *   ⚠️CHECKER_SNAP=update 는 «끔» 골든을 덮는다 — 핀 판(GD1001_ROOT)에서만 써라. 켬은 update-dark 만 쓴다.
 * 자리 9곳: 섹션 투명배경 · 에셋 빈칸 · 아이콘원 · 배너 빈 이미지(작은 쌍) · 그리드 빈 슬롯(작은 쌍) · 표 이미지칸(투명 쌍) ·
 *           확대블럭 배경 · 목업 화면(JS 인라인) · 주석 라벨(JS 인라인) · 도형 SVG 패턴.
 * 전제 단언: 각 자리가 «진짜 체커로 칠해졌는가»(computed 서명)와 «그림에 색이 둘 이상인가» — 빈 화면끼리 같다는 거짓 초록 방지. */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { bootApp, ROOT } = require('./_root-harness.js');

const GOLD = path.join(__dirname, 'fixtures', 'checker-golden');
const UPDATE = process.env.CHECKER_SNAP === 'update';
const UPDATE_DARK = process.env.CHECKER_SNAP === 'update-dark';
const CLEAR_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

const SITES = [
  { id: 'section-sec-bg-empty', pair: 'big', sel: '#s1', html: `<div class="section-block sec-bg-empty" id="s1" data-section="1" style="height:200px;width:400px"></div>`, sig: 'bg' },
  { id: 'asset-empty', pair: 'big', sel: '#a1', html: `<div class="asset-block" id="a1" style="height:200px;width:400px"></div>`, sig: 'bg' },
  { id: 'icon-circle-empty', pair: 'big', sel: '#ic1 .icb-circle', html: `<div class="icon-circle-block" data-type="icon-circle" id="ic1" data-size="160" data-border="none"><div class="icb-circle" style="width:160px;height:160px"></div></div>`, sig: 'bg' },
  { id: 'banner-small-pair', pair: 'small', sel: '#b1 .bn2-img-empty', html: `<div class="banner02-block" id="b1"><div class="bn2-img-empty" style="width:200px;height:100px"></div></div>`, sig: 'bg' },
  { id: 'grid-slot-small-pair', pair: 'small', sel: '#g1 .grd-img-empty', html: `<div class="grid-block" id="g1"><div class="grd-img-empty" style="width:200px;height:100px"></div></div>`, sig: 'bg' },
  { id: 'table-clear-pair', pair: 'clear', sel: '#t1 .tbl-img-cell', html: `<div class="table-block" id="t1"><div class="tbl-img-cell" style="width:200px;height:100px"></div></div>`, sig: 'bg' },
  { id: 'zoom-bg', pair: 'big', sel: '#z1 .zoom-bg', html: `<div class="zoom-block" id="z1"><div class="zoom-bg" style="width:200px;height:120px"></div></div>`, sig: 'bg' },
  { id: 'cvb-empty', pair: 'big', sel: '#c1 .cvb-img-empty', html: `<div class="canvas-block" id="c1"><div class="cvb-img-empty" style="width:200px;height:120px"></div></div>`, sig: 'bg' },
  { id: 'mockup-screen-inline', pair: 'big', valueBy: 'inline', sel: '#m1 .mkp-screen', html: `<div class="mockup-block" id="m1"><div class="mkp-screen" style="width:200px;height:120px"></div></div>`, sig: 'bg', run: `window.applyMockupScreenImage(document.getElementById('m1'), '${CLEAR_PNG}')` },
  { id: 'annot-label-inline', pair: 'big', sel: '#an1', html: `<div id="an1"></div>`, sig: 'child-bg', run: `document.getElementById('an1').innerHTML = window._renderAnnotLabelInner('image', { text: '', labelImageSrc: '', labelImageSize: 40, labelImageRadius: 0 })` },
  { id: 'shape-svg-pattern', pair: 'big', sel: '#sh1', html: `<div class="shape-block" id="sh1" data-shape-type="rectangle" data-shape-fill="image" style="position:relative;width:800px;height:480px"><svg class="shape-svg" viewBox="0 0 100 60" preserveAspectRatio="none" style="width:100%;height:100%"><rect x="0" y="0" width="100" height="60" fill="currentColor"/></svg></div>`, sig: 'fill', inCanvas: true },
];

async function diffPng(page, aB64, bB64) {
  return page.evaluate(async ([a, b]) => {
    const load = async (s) => { const i = new Image(); i.src = 'data:image/png;base64,' + s; await i.decode(); const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const g = c.getContext('2d'); g.drawImage(i, 0, 0); return g.getImageData(0, 0, i.width, i.height); };
    const A = await load(a), B = await load(b);
    if (A.width !== B.width || A.height !== B.height) return { size: [A.width, A.height, B.width, B.height], diff: -1, colors: 0 };
    let diff = 0; const seen = new Set();
    for (let i = 0; i < A.data.length; i += 4) {
      if (A.data[i] !== B.data[i] || A.data[i + 1] !== B.data[i + 1] || A.data[i + 2] !== B.data[i + 2] || A.data[i + 3] !== B.data[i + 3]) diff++;
      seen.add((A.data[i] << 16) | (A.data[i + 1] << 8) | A.data[i + 2]);
    }
    return { size: [A.width, A.height], diff, colors: seen.size };
  }, [aB64, bB64]);
}

/* 끔/켬 «두 판»을 같은 손으로 찍는다. tone: 'off' | 'dark' | 'off-after-on'.
 * ★2026-10-06 — 토글이 «전역»에서 «섹션마다»로 바뀌었다(현빈 R1: 섹션 배경 체커만 · 「빈 카드는 그대로」).
 *   ⇒ 더 이상 window.setCheckerDarkOn 이 없다. 켜는 법 = 그 섹션에 data-checker-tone="dark".
 * ★무대를 ★.section-block[data-checker-tone="dark"] 로 감싼다 — 그러면 열한 자리가 «전부»
 *   톤 켜진 섹션 «안»에 들어간다. 그 판에서 ⑴ 섹션 배경 자리만 어두워지고 ⑵ 나머지 열 자리는
 *   ★0 픽셀이어야 R1 이다(CSS 변수는 상속되므로, 공용 토큰을 덮었다면 열 자리가 다 바뀐다). */
async function shootAll(page, tone) {
  await page.setViewportSize({ width: 1200, height: 900 });
  const errs = await bootApp(page);
  const toneState = tone === 'off' ? null : (tone === 'off-after-on' ? 'off-after-on' : 'dark');
  // 앱 CSS 가 «다 얹힌» 문서에 격리 무대를 만든다(앱 CSS 를 그대로 먹는다 — 한 환경에서만 참인 검사 방지).
  await page.evaluate((tone) => {
    const st = document.createElement('div'); st.id = 'ck-stage';
    st.style.cssText = 'position:fixed;left:0;top:0;width:1100px;height:880px;background:#fff;z-index:99999;padding:20px;display:flex;flex-direction:column;gap:20px;overflow:auto';
    /* ★무대 자체를 «톤 켜진 섹션»으로 — 열한 자리가 전부 그 안에 들어간다(R1 경계를 픽셀로 잰다).
       'off-after-on' 은 켰다 «끈» 판: 속성을 걸었다가 뗀다(화면이 지금으로 돌아오는지). */
    /* ★'off-in-section' = 섹션 안이되 ★톤만 없는 판. CP-dark 의 ★대조군이다(바뀌는 변수가 속성 «하나»).
       ⛔톤 켠 판을 «끔 골든»과 바로 견주면 안 된다 — 무대에 .section-block 이 붙는 것만으로
         레이아웃이 아주 조금 달라져 둥근 테두리 안티에일리어싱이 33점 바뀐다(2026-10-06 실측).
         그 33점은 ★무대 탓이지 톤 탓이 아니다. 같은 무대끼리 견줘야 톤만 잰 것이다. */
    if (tone !== 'off') st.classList.add('section-block');
    if (tone === 'dark') st.setAttribute('data-checker-tone', 'dark');
    if (tone === 'off-after-on') { st.setAttribute('data-checker-tone', 'dark'); st.removeAttribute('data-checker-tone'); st.classList.remove('section-block'); }
    document.body.appendChild(st);
  }, tone);
  const shots = [];
  for (const s of SITES) {
    /* 도형 체커 규칙은 `#canvas .shape-block…` 로 «캔버스 안»에만 선다 — 그 자리 무대는 #canvas «안, 흐름 속»에 둔다(fixed 로 두면 캔버스 배율·잘림에 가려 빈 흰 그림이 찍혔다 — 핀에서도 단색이라 전제 단언이 잡았다). */
    await page.evaluate(([html, run, inCanvas, tone]) => {
      let st = document.getElementById('ck-stage');
      st.style.display = inCanvas ? 'none' : 'flex';   // 위에 뜬 흰 무대가 캔버스 안 자리를 «덮지» 않게
      const old = document.getElementById('ck-stage-c'); if (old && !inCanvas) old.remove();
      if (inCanvas) { st = document.getElementById('ck-stage-c') || Object.assign(document.createElement('div'), { id: 'ck-stage-c' }); st.style.cssText = 'background:#fff;padding:20px;width:900px'; const cv = document.getElementById('canvas'); cv.insertBefore(st, cv.firstChild); st.scrollIntoView(); }
      st.innerHTML = html; if (run) (0, eval)(run);
      /* ★섹션 배경 자리는 «그 섹션 자신»이다 — 조상 무대가 아니라 ★제 요소에 속성이 걸려야 어두워진다
         (규칙 선택자가 .section-block[data-checker-tone="dark"] 이고, 그 섹션의 배경은 제 토큰으로 칠해진다). */
      if (tone === 'dark' || tone === 'off-after-on') {
        const s1 = document.getElementById('s1');
        if (s1) { s1.setAttribute('data-checker-tone', 'dark'); if (tone === 'off-after-on') s1.removeAttribute('data-checker-tone'); }
      }
    }, [s.html, s.run || '', !!s.inCanvas, tone]);
    await page.waitForTimeout(80);
    // 전제 ① 진짜 체커로 칠해졌다
    const sig = await page.evaluate(([sel, kind]) => {
      let el = document.querySelector(sel); if (!el) return 'MISSING';
      if (kind === 'child-bg') el = el.firstElementChild;
      const cs = getComputedStyle(kind === 'fill' ? el.querySelector('rect') : el);
      return kind === 'fill' ? cs.fill : cs.backgroundImage;
    }, [s.sel, s.sig]);
    if (s.sig === 'fill') expect(sig, `${s.id} 전제 — 도형 면이 패턴 fill`).toContain('goya-shape-checker');
    else expect(sig, `${s.id} 전제 — 체커 서명`).toMatch(/repeating-conic-gradient/);
    const el = await page.$(s.sel);
    expect(el, `${s.id} 전제 — 요소가 있다`).not.toBeNull();
    const shot = (await (s.sig === 'child-bg' ? (await page.$(s.sel + ' > *')) : el).screenshot()).toString('base64');
    const inline = await page.evaluate((sel) => document.querySelector(sel)?.style.background || '', s.sel);   // 무대가 다음 자리로 갈리기 «전»에 읽는다
    shots.push({ s, shot, inline });
  }
  return { errs, toneState, shots };
}

/* 켬 그림의 «색 집합»에 hex 가 있나 — 정확 일치(반올림 없음). */
async function colorsOf(page, b64) {
  return page.evaluate(async (s) => {
    const i = new Image(); i.src = 'data:image/png;base64,' + s; await i.decode();
    const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const g = c.getContext('2d'); g.drawImage(i, 0, 0);
    const d = g.getImageData(0, 0, i.width, i.height).data; const m = {};
    for (let k = 0; k < d.length; k += 4) { const h = '#' + [d[k], d[k + 1], d[k + 2]].map(v => v.toString(16).padStart(2, '0')).join(''); m[h] = (m[h] || 0) + 1; }
    return m;
  }, b64);
}

/* 톤 값을 «CSS 텍스트»에서 읽는다 — 앱의 computed 와 독립(세탁 방지). 끔 값은 :root 블록에서. */
function cssPairs() {
  const css = fs.readFileSync(path.join(ROOT, 'css', 'editor-base.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const block = (re) => { const m = css.match(re); return m ? m[1] : ''; };
  const pick = (txt, n) => { const m = txt.match(new RegExp(`--goya-checker-${n}\\s*:\\s*(#[0-9a-fA-F]{6})`)); return m ? m[1].toLowerCase() : null; };
  /* ★2026-10-06 — 톤 규칙은 «섹션 선택자»이고, 덮는 토큰은 ★전용 쌍(secbg-a/b) 둘뿐이다.
     섹션 배경의 «끔» 값은 :root 의 secbg 기본값이 big 을 var 로 가리키므로 big 쌍을 그대로 쓴다. */
  const dark = block(/\.section-block\[data-checker-tone="dark"\]\s*\{([^}]*)\}/);
  const base = block(/(?:^|[;}\s]):root\s*\{([^}]*)\}/);
  const P = {};
  for (const p of ['big', 'small', 'clear']) P[p] = { dark: [null, null], off: [pick(base, p + '-a'), p === 'clear' ? null : pick(base, p + '-b')] };
  P.secbg = { dark: [pick(dark, 'secbg-a'), pick(dark, 'secbg-b')], off: [pick(base, 'big-a'), pick(base, 'big-b')] };
  return P;
}

test('CP 체커 자리 전부 — 끔(기본·저장값 없음)이 변수화 전(골든)과 «0 픽셀» 다르다', async ({ page }) => {
  const { errs, toneState, shots } = await shootAll(page, 'off');
  expect(toneState, '★기본은 끔 — 저장값이 없으면 html 에 톤 속성이 없어야 한다').toBeNull();
  const report = [];
  for (const { s, shot } of shots) {
    const gp = path.join(GOLD, s.id + '.png');
    if (UPDATE) { fs.writeFileSync(gp, Buffer.from(shot, 'base64')); report.push(`${s.id}: golden written`); continue; }
    expect(fs.existsSync(gp), `${s.id} 골든이 있다(${gp})`).toBe(true);
    const r = await diffPng(page, fs.readFileSync(gp).toString('base64'), shot);
    expect(r.colors, `${s.id} 전제 — 그림에 색이 둘 이상(빈 그림끼리 같다는 거짓 초록 방지)`).toBeGreaterThanOrEqual(2);
    report.push(`${s.id}: ${r.size.join('x')} diff=${r.diff} colors=${r.colors}`);
    expect.soft(r.diff, `${s.id} 다른 픽셀 수`).toBe(0);   // soft — 한 자리가 틀려도 «어느 자리들이» 틀렸는지 전부 보인다
  }
  console.log('[checker-pixel]\n' + report.join('\n'));
  expect(errs, '페이지 오류 0').toEqual([]);
});

test('CP-off ★섹션 톤을 켰다가 «끄면» 끔 골든과 0 픽셀 — 끈 화면은 지금과 같다', async ({ page }) => {
  test.skip(UPDATE || UPDATE_DARK, '골든 찍는 판');
  const { errs, toneState, shots } = await shootAll(page, 'off-after-on');
  expect(toneState).toBe('off-after-on');
  const report = [];
  for (const { s, shot } of shots) {
    const r = await diffPng(page, fs.readFileSync(path.join(GOLD, s.id + '.png')).toString('base64'), shot);
    expect(r.colors, `${s.id} 전제 — 색 둘 이상`).toBeGreaterThanOrEqual(2);
    report.push(`${s.id}: diff=${r.diff}`);
    expect.soft(r.diff, `${s.id} 켰다 끈 뒤 다른 픽셀 수`).toBe(0);
  }
  console.log('[checker-pixel off-after-on]\n' + report.join('\n'));
  expect(errs, '페이지 오류 0').toEqual([]);
});

/* ★CP-dark — 2026-10-06 현빈 R1(「섹션 배경 체커만 · 빈 카드는 그대로」)을 ★픽셀로 잰다.
 *   무대 전체가 «톤 켜진 섹션» 안이므로 ⑴ 섹션 배경 자리 ★하나만 어두워지고
 *   ⑵ 나머지 열 자리는 끔 골든과 ★0 픽셀이어야 한다.
 *   ★⑵ 가 이 검사의 가장 날카로운 이빨이다 — 누가 톤 규칙에서 공용 토큰(big/small/clear)을 덮으면
 *     CSS 변수 상속으로 열 자리가 «다» 바뀌어 즉시 빨강이다.
 *   ⛔옛 판(전역 토글)은 「11/11 모두 달라야 한다」였다 — 그 단언은 지금 ★거꾸로다. 되살리지 마라.
 *   ⛔그래서 @dark 골든도 섹션 배경 자리 ★한 벌만 남긴다(나머지 열 벌은 2026-10-06 에 지웠다 —
 *     「켬 = 끔」인 자리에 별도 골든을 두면 같은 그림이 두 이름으로 산다). */
const DARK_SITE = 'section-sec-bg-empty';

test('CP-dark ★섹션 톤 — 섹션 배경 자리만 어두워지고 ★나머지 열 자리는 끔 골든과 0 픽셀(R1)', async ({ page }) => {
  test.skip(UPDATE, '끔 골든 찍는 판');
  const { errs, toneState, shots } = await shootAll(page, 'dark');
  expect(toneState).toBe('dark');
  /* ★대조군 — «같은 무대»에서 톤 속성만 뺀 판. keep 자리는 이것과 견준다(변수 하나만 다르게). */
  const ctrl = {};
  { const c = await shootAll(page, 'off-in-section'); for (const { s, shot } of c.shots) ctrl[s.id] = shot; }
  const P = cssPairs();
  expect(P.secbg.dark[0], 'CSS 텍스트에서 섹션 톤 값(secbg-a)을 못 읽었다').toMatch(/^#[0-9a-f]{6}$/);
  expect(P.secbg.dark[1], 'CSS 텍스트에서 섹션 톤 값(secbg-b)을 못 읽었다').toMatch(/^#[0-9a-f]{6}$/);

  const report = [];
  let changed = 0, same = 0;
  for (const { s, shot } of shots) {
    const vsOff = await diffPng(page, fs.readFileSync(path.join(GOLD, s.id + '.png')).toString('base64'), shot);
    expect(vsOff.colors, `${s.id} 전제 — 색 둘 이상`).toBeGreaterThanOrEqual(2);

    if (s.id === DARK_SITE) {
      changed++;
      const vsCtrlDark = await diffPng(page, ctrl[s.id], shot);
      expect.soft(vsCtrlDark.diff, `★${s.id} — 섹션 톤을 켰는데 «같은 무대의 톤 없는 판»과 같다(토글이 안 닿았다)`).toBeGreaterThan(0);
      expect.soft(vsOff.diff, `★${s.id} — 섹션 톤을 켰는데 끔 골든과 같다`).toBeGreaterThan(0);
      // 값 대조 — 톤 hex 가 «정확히» 있고, 끔 hex 는 없다(몫으로: 안티에일리어싱 몇 점에 안 속는다)
      const cols = await colorsOf(page, shot);
      const total = Object.values(cols).reduce((a, b) => a + b, 0);
      for (const h of P.secbg.dark) expect.soft((cols[h] || 0) / total, `${s.id} 켬 색 ${h} 몫(${cols[h] || 0}/${total})`).toBeGreaterThanOrEqual(0.10);
      for (const h of P.secbg.off)  expect.soft((cols[h] || 0) / total, `${s.id} 끔 색 ${h} 몫(${cols[h] || 0}/${total}) — 끔 면이 남았다`).toBeLessThanOrEqual(0.01);
      const gd = path.join(GOLD, s.id + '@dark.png');
      if (UPDATE_DARK) fs.writeFileSync(gd, Buffer.from(shot, 'base64'));
      else {
        expect(fs.existsSync(gd), `${s.id} 켬 골든이 있다(${gd})`).toBe(true);
        const vsDark = await diffPng(page, fs.readFileSync(gd).toString('base64'), shot);
        expect.soft(vsDark.diff, `${s.id} 켬 골든과 다른 픽셀 수`).toBe(0);
      }
      report.push(`${s.id}[DARK]: vsOff=${vsOff.diff}`);
    } else {
      same++;
      /* ★R1 — 톤 켜진 섹션 «안»인데도 한 점도 안 바뀌어야 한다(현빈: 「빈 카드는 그대로」).
         ★대조군(같은 무대 · 톤 속성만 없음)과 견준다 — 무대 탓 차이를 톤 탓으로 읽지 않게. */
      const vsCtrl = await diffPng(page, ctrl[s.id], shot);
      expect.soft(vsCtrl.diff, `★${s.id} — 섹션 톤이 이 자리까지 바꿨다(R1 위반: 공용 토큰을 덮었다)`).toBe(0);
      report.push(`${s.id}[keep]: vsCtrl=${vsCtrl.diff} (vsOff=${vsOff.diff})`);
    }
  }
  console.log('[checker-pixel section-tone]\n' + report.join('\n'));
  expect(changed, '★어두워진 자리 수 = 1(섹션 배경)').toBe(1);
  expect(same, '★그대로여야 하는 자리 수').toBe(SITES.length - 1);
  expect(errs, '페이지 오류 0').toEqual([]);
});
