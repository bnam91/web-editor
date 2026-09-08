/* edge-contrast.dom — 링크 연결선 대비의 «진짜 끝»: 화면에 실제로 칠해진 색. 2026-09-08 신설
 *
 * ★왜 dom 이 따로 필요한가
 *   계산기가 무슨 값을 «돌려주는지»는 tests/unit 이 잰다. 여기서 잴 것은 세 가지다:
 *     ① CSS 변수가 «칠하는 원소»까지 실제로 도달하나 (스코프)
 *     ② 화면에 얹힌 opacity 가 정말 .70 인가 (⛔상수로 가정하지 «않고» 읽는다)
 *     ③ 점(fill)이 선(stroke)과 «같은 색·α=1» 인가
 *
 * ★대비 공식을 js/canvas-contrast.js 에서 «import 하지 않는다» — 여기 안에 독립 구현.
 *   같은 걸 쓰면 계산기의 버그가 검사를 통과해 «세탁»된다.
 *
 * ⚠️★하네스는 CSS 를 «내가 얹은 만큼»만 갖는다 — 실물보다 관대하다.
 *   그래서 여기서 재는 것은 «계산·배선»이고, 「진짜 눈에 보이나」는 실앱 몫이다(지디, 계획서 §9).
 *
 * ⛔앱을 «안» 띄운다 — 고디터 인스턴스·포트 무접촉. 레포 파일만 크로미움에 얹는다.
 *   (zoom-drop-shadow.dom.spec.js 의 page.route 하네스를 «어휘 그대로» 쓴다.
 *    ⛔기법은 다르다 — 저긴 filter, 여긴 합성 대비다.)
 *
 * 실행: npm run test:dom  (또는 npx playwright test --config=tests/dom/playwright.dom.config.js edge-contrast)
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };

/* ★얹을 CSS 3장 — 하나라도 빠지면 오독한다.
     editor-base   : --ui-accent(#7cb8ff) · --ui-bg-app(#1a1a1a)  ← 후보색·알파 바탕
     editor-canvas : #canvas-wrap 의 배경                          ← 인라인이 «대체»하는 그 선언
     editor-extra  : .spl-edges line / .spl-edge-dot               ← 잴 대상 그 자체 */
const HARNESS = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="/css/editor-base.css">
<link rel="stylesheet" href="/css/editor-canvas.css">
<link rel="stylesheet" href="/css/editor-extra.css">
<style id="probe-style"></style></head><body style="margin:0">
<div id="canvas-area">
  <div id="canvas-wrap">
    <div id="canvas-scaler" style="transform: scale(1); transform-origin: 0 0;">
      <svg id="link-edges" class="spl-edges" width="400" height="200">
        <line id="probe-line" x1="10" y1="10" x2="300" y2="150"></line>
        <circle id="probe-dot" class="spl-edge-dot" cx="10" cy="10" r="4"></circle>
      </svg>
      <div id="canvas" style="width:360px;height:180px"></div>
    </div>
  </div>
</div>
<script type="module">
  import { applyCanvasBackground, edgeColorFor } from '/js/canvas-contrast.js';
  window.__applyBg = applyCanvasBackground;
  window.__edgeColorFor = edgeColorFor;
  window.__ready = true;
</script></body></html>`;

async function boot(page) {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/__harness.html') return route.fulfill({ contentType: 'text/html', body: HARNESS });
    const file = path.join(REPO, url.pathname);
    if (!file.startsWith(REPO) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({ contentType: MIME[path.extname(file)] || 'text/plain', body: fs.readFileSync(file) });
  });
  await page.goto(`${ORIGIN}/__harness.html`);
  await page.waitForFunction(() => window.__ready === true);
  return errs;
}

/* ── ★계측기 — 한 페이지 안, 같은 코드로 여러 번 부른다 ────────────────
   ③ 에서 opacity 를 «상수로 안 쓰고 읽는» 것이 핵심이다.
      .70 을 가정하면 CSS 가 .55 로 되돌아가도 계측기가 눈치채지 못한다. */
async function measure(page, probeCss, bg) {
  return page.evaluate(({ probeCss, bg }) => {
    document.getElementById('probe-style').textContent = probeCss || '';   // ① 규칙을 얹는다
    window.__applyBg(bg);                                                   // ② 실제로 칠한다
    const line = document.getElementById('probe-line');
    const dot = document.getElementById('probe-dot');
    const wrap = document.getElementById('canvas-wrap');
    const cs = getComputedStyle(line), cd = getComputedStyle(dot);
    return {
      stroke: cs.stroke,                                        // ③ 화면에 칠해진 색
      lineOpacity: cs.opacity,                                  // ③ 화면에 얹힌 알파 — «읽는다»
      dotFill: cd.fill,
      dotOpacity: cd.opacity,
      wrapBg: getComputedStyle(wrap).backgroundColor,           // ④ 화면의 실제 배경
      varOnWrap: wrap.style.getPropertyValue('--spl-edge-color'),
      varOnRoot: document.documentElement.style.getPropertyValue('--spl-edge-color'),
      inlineBg: wrap.style.background,
    };
  }, { probeCss, bg });
}

/* ── ⑤ 스펙 «자체» 산술 (⛔canvas-contrast.js 에서 안 가져온다) ───────── */
const lin = (c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const LUM = ([r, g, b]) => 0.2126 * lin(r / 255) + 0.7152 * lin(g / 255) + 0.0722 * lin(b / 255);
const CR = (a, b) => { const x = LUM(a), y = LUM(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const OVER = (f, b, a) => f.map((c, i) => a * c + (1 - a) * b[i]);
/** 'rgb(1, 2, 3)' · 'rgba(1, 2, 3, .5)' · '#rrggbb' → [r,g,b] */
function toRgb(s) {
  const m = /rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/.exec(String(s));
  if (m) return [+m[1], +m[2], +m[3]];
  const h = /^#([0-9a-f]{6})$/i.exec(String(s).trim());
  if (h) return [0, 2, 4].map((i) => parseInt(h[1].slice(i, i + 2), 16));
  throw new Error(`색을 못 읽었다: ${s}`);
}
/** 실측한 색·알파를 실측한 배경 위에 합성해 WCAG 대비를 낸다. */
const measured = (m) => CR(OVER(toRgb(m.stroke), toRgb(m.wrapBg), parseFloat(m.lineOpacity)), toRgb(m.wrapBg));

/* 오늘(고치기 «전»)의 규칙 — ★스펙에 동결 리터럴로 박는다. 작업트리를 안 읽는다. */
const BEFORE_RULE =
  '.spl-edges line { stroke: var(--ui-accent, #4f6bed); stroke-width: 2; stroke-dasharray: 5 5; opacity: .55; }';

// ══════════════════════════════════════════════════════════════════
test('D1 ★양성대조 — 잣대가 살아 있고(나쁜 것을 잡는다), 그 잣대로 전 1.41 → 후 3.89 로 «실제로» 올라간다', async ({ page }) => {
  const errs = await boot(page);

  /* ── 단계 1 — 잣대가 «살아 있나». ⛔이걸 먼저 통과해야 나머지가 뜻을 갖는다. ── */
  const bad = await measure(page, '.spl-edges line { stroke:#8a8a8a; opacity:.70; }', '#828282');
  const good = await measure(page, '.spl-edges line { stroke:#000000; opacity:.70; }', '#828282');
  expect(bad.stroke, '잣대 입력이 안 먹었다 — 잴 것이 없는 채로 아래가 통과한다').toBe('rgb(138, 138, 138)');
  expect(measured(bad), `★잣대가 «나쁜 것»을 못 잡는다 (실측 ${measured(bad).toFixed(2)})`).toBeLessThan(3.0);
  expect(measured(good), `★잣대가 «좋은 것»을 통과시키지 못한다 (실측 ${measured(good).toFixed(2)})`).toBeGreaterThanOrEqual(3.0);

  /* ── 단계 2 — 전 / 후 (같은 잣대·같은 배경) ── */
  const before = await measure(page, BEFORE_RULE, '#828282');
  const after = await measure(page, '', '#828282');   // 규칙 없음 = 작업트리의 진짜 editor-extra.css

  expect(before.lineOpacity, '★BEFORE 의 알파가 .55 가 아니다 — 동결 리터럴이 안 먹었다').toBe('0.55');
  expect(before.stroke, '★BEFORE 가 --ui-accent 를 안 읽었다 — editor-base.css 가 안 얹혔다')
    .toBe('rgb(124, 184, 255)');
  const b = measured(before), a = measured(after);
  expect(b, `★BEFORE 가 3:1 을 이미 넘는다 (${b.toFixed(2)}) — 고칠 이유가 없다는 뜻이다`).toBeLessThan(3.0);
  expect(a, `★AFTER 가 3:1 미달 (${a.toFixed(2)}) — 처방이 안 들었다`).toBeGreaterThanOrEqual(3.0);
  expect(a, `★개선폭이 없다 — 전 ${b.toFixed(2)} · 후 ${a.toFixed(2)}`).toBeGreaterThan(b * 2.5);

  expect(errs, `콘솔 오류: ${errs.join(' | ')}`).toEqual([]);
});

// ══════════════════════════════════════════════════════════════════
test('D2 배경 9종을 «실제로 칠하고» 칠해진 stroke + 읽은 opacity 로 잰다 — 전부 ≥ 3:1 (변수 스코프 포함)', async ({ page }) => {
  const errs = await boot(page);
  const BGS = ['#ffffff', '#000000', '#828282', '#acacac', '#6aa8f0', '#e11d48', '#d40000', '#00b8a9', '#ff00ff'];
  const rows = [];
  for (const bg of BGS) {
    const m = await measure(page, '', bg);
    /* ★변수는 «칠하는 원소»에 걸려 있어야 한다 — documentElement 로 옮기면 여기서 운다. */
    expect(m.varOnWrap, `★${bg}: --spl-edge-color 가 #canvas-wrap 에 없다 — 스코프가 어긋났다`).not.toBe('');
    expect(m.varOnRoot, `★${bg}: 변수가 documentElement 에 걸렸다 — 칠하는 원소와 스코프가 다르다`).toBe('');
    /* ⛔인라인 문자열로 대조하지 않는다 — 크로미움이 '#ffffff' 를 'rgb(255, 255, 255)' 로 정규화한다.
       «화면의 실제 배경»(getComputedStyle) 을 성분으로 비교하는 게 잴 것에 더 가깝다. */
    expect(toRgb(m.wrapBg), `★${bg}: 배경이 실제로 안 칠해졌다 (화면 배경 ${m.wrapBg} · 인라인 ${m.inlineBg})`)
      .toEqual(toRgb(bg));
    expect(parseFloat(m.lineOpacity), `★${bg}: 화면 알파가 .70 이 아니다 (읽은 값 ${m.lineOpacity})`).toBeCloseTo(0.70, 5);
    const cr = measured(m);
    rows.push(`${bg} → ${m.stroke} @${m.lineOpacity} = ${cr.toFixed(2)}`);
    expect(cr, `★${bg}: 실측 대비 ${cr.toFixed(2)} — 3:1 미달\n${rows.join('\n')}`).toBeGreaterThanOrEqual(3.0);
  }
  expect(rows.length, '★한 배경도 안 쟀다').toBe(9);

  /* ★양성대조 — 「전부 통과」가 «변수가 안 걸려도 통과하는 관대한 잣대» 때문이 아님을 보인다.
     같은 잣대에 옛 규칙(#7cb8ff@.55)을 물리면 같은 9종 중 «여러 건»이 실제로 떨어진다. */
  let fell = 0;
  for (const bg of BGS) {
    const m = await measure(page, BEFORE_RULE, bg);
    if (measured(m) < 3.0) fell++;
  }
  expect(fell, '★양성대조 0 — 이 잣대는 아무것도 못 떨어뜨린다(측정법 오류지 개선의 증거가 아니다)')
    .toBeGreaterThan(0);

  expect(errs, `콘솔 오류: ${errs.join(' | ')}`).toEqual([]);
});

// ══════════════════════════════════════════════════════════════════
/* ── D4 ★라이브 변수를 «흔든다» — 계획서 §4-3 「라이브로 읽는다. ⛔하드코딩 금지」의 게이트
     ⛔이게 없어서 아래 셋이 «게이트 두 겹»을 통과했다(2026-09-09 적대검수):
       X2  window.__updateEdgeContrast = () => updateEdgeContrast(<현재 배경 읽기>) → updateEdgeContrast('')
       X7  const sh = _parse(shell ?? _cssVar('--ui-bg-app')) …  →  _parse(shell) …
       X6  _cssVar('--ui-accent')  →  하드코딩 '#7cb8ff'      (대비는 안 깨지지만 «브랜드색 추종»을 잃는다)
     유닛은 opts 를 명시로 넘겨 _cssVar 를 0회 실행했고, 하네스는 기본 테마만 써서
     «하드코딩 값과 라이브 값이 우연히 같았다». ⇒ 값을 «다르게 만들어» 따라오는지 본다. */
test('D4 ★테마 변수를 흔들면 연결선 색이 따라온다 — --ui-bg-app · --ui-accent · 테마훅 (X7·X6·X2)', async ({ page }) => {
  const errs = await boot(page);
  const setVar = (n, v) => page.evaluate(({ n, v }) => document.documentElement.style.setProperty(n, v), { n, v });
  const readVar = () => page.evaluate(() => document.getElementById('canvas-wrap').style.getPropertyValue('--spl-edge-color'));

  /* ── ① shell(--ui-bg-app) 추종 — 배경 알파가 0 이면 «뒤에 있는 것»이 답을 정한다 (X7) ── */
  const CLEAR = 'rgba(255,255,255,0)';           // 앞색은 흰데 «완전 투명» → shell 이 실질 배경
  await measure(page, '', CLEAR);
  const onDark = await readVar();
  expect(onDark, '★기본 테마(어두운 shell)에서 브랜드색 보존이 깨졌다 — 전제가 무너지면 아래가 뜻이 없다')
    .toBe('#7cb8ff');

  await setVar('--ui-bg-app', '#ffffff');
  await measure(page, '', CLEAR);
  const onLight = await readVar();
  expect(onLight, '★--ui-bg-app 을 흰색으로 바꿨는데 색이 안 따라온다 — shell 을 라이브로 안 읽고 있다')
    .toBe('#000000');
  expect(onLight, '★shell 이 답을 안 가른다').not.toBe(onDark);

  /* ── ② ★테마 훅(X2) — 배경은 그대로 두고 «변수만» 바꾼 뒤 __updateEdgeContrast() 로 재산출 ──
       theme-system.js:129 가 실제로 하는 일이 이것이다. 인자를 '' 로 굳히면 여기서 운다. */
  await setVar('--ui-bg-app', '#1a1a1a');          // 다시 어둡게 — 답이 #7cb8ff 로 «돌아와야» 한다
  const followed = await page.evaluate(() => {
    window.__updateEdgeContrast();                 // ⛔applyCanvasBackground 가 아니다 — 훅만 부른다
    return document.getElementById('canvas-wrap').style.getPropertyValue('--spl-edge-color');
  });
  expect(followed, '★테마 훅이 «현재 배경»을 안 읽는다 — 인자가 빈 문자열로 굳으면 색이 통째로 걷힌다')
    .toBe('#7cb8ff');

  /* ── ③ accent(--ui-accent) 추종 — 테마가 강조색을 임의 색으로 바꾼다 (X6) ── */
  await measure(page, '', '#000000');
  expect(await readVar(), '★검은 캔버스에서 브랜드색 보존이 깨졌다').toBe('#7cb8ff');
  await setVar('--ui-accent', '#00ff00');
  await measure(page, '', '#000000');
  expect(await readVar(), '★--ui-accent 를 바꿨는데 색이 안 따라온다 — accent 를 하드코딩하고 있다')
    .toBe('#00ff00');

  expect(errs, `콘솔 오류: ${errs.join(' | ')}`).toEqual([]);
});

// ══════════════════════════════════════════════════════════════════
/* ── D5 ★「못 잰 배경」의 뒷정리 (X10) — A5 는 null 을 «돌려주나»만 본다.
     그때 «이전 값을 걷어내나»는 아무도 안 봤다. removeProperty 를 지워도 게이트가 초록이었다.
     ⚠️도달 가능성 △ — 배경이 못 재는 값(url(...) 등)이 되는 경로가 오늘 UI 엔 안 보인다.
       그래도 검사 한 줄이면 되니 넣는다. 실앱에서 그 경로가 실제로 나는지는 «안 쟀다». */
test('D5 못 재는 배경으로 바뀌면 --spl-edge-color 를 «걷어낸다» — 옛 색이 남으면 안 된다 (X10)', async ({ page }) => {
  const errs = await boot(page);
  const readVar = () => page.evaluate(() => document.getElementById('canvas-wrap').style.getPropertyValue('--spl-edge-color'));

  await measure(page, '', '#828282');
  expect(await readVar(), '★전제 — 먼저 «걷어낼 값»이 실려 있어야 한다').toBe('#000000');

  await measure(page, '', 'url(nope.png)');
  expect(await readVar(),
    '★못 재는 배경인데 옛 색이 그대로 남았다 — CSS 폴백(오늘 색)이 받아야 할 자리를 낡은 값이 막는다')
    .toBe('');

  /* ★양성대조 — 다시 잴 수 있는 배경을 주면 값이 «되돌아온다»(항상 비우는 판이 아니다). */
  await measure(page, '', '#ffffff');
  expect(await readVar(), '★양성대조 실패 — 걷어내기만 하고 다시 안 싣는다').toBe('#000000');

  expect(errs, `콘솔 오류: ${errs.join(' | ')}`).toEqual([]);
});

// ══════════════════════════════════════════════════════════════════
test('D3 점(fill)이 선(stroke)과 «같은 색» 이면서 opacity 는 1 이다 (한쪽만 고치면 두 물건으로 보인다)', async ({ page }) => {
  const errs = await boot(page);
  let checked = 0;
  for (const bg of ['#ffffff', '#828282', '#000000', '#d40000']) {
    const m = await measure(page, '', bg);
    expect(m.dotFill, `★${bg}: 점과 선의 색이 갈렸다 (선 ${m.stroke} · 점 ${m.dotFill})`).toBe(m.stroke);
    expect(m.dotOpacity, `★${bg}: 점의 alpha 가 1 이 아니다 (${m.dotOpacity}) — §5 min(선,점) 의 전제가 깨진다`).toBe('1');
    /* 점은 α=1 이므로 선보다 «항상 이상» 이어야 정상이다 — 대비도 같이 못박는다. */
    const B = toRgb(m.wrapBg), P = toRgb(m.dotFill);
    expect(CR(P, B), `★${bg}: 점 대비 ${CR(P, B).toFixed(2)} — 3:1 미달`).toBeGreaterThanOrEqual(3.0);
    checked++;
  }
  expect(checked, '★한 배경도 안 쟀다').toBe(4);
  expect(errs, `콘솔 오류: ${errs.join(' | ')}`).toEqual([]);
});
