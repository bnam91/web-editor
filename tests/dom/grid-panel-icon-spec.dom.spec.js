/* grid-panel-icon-spec.dom.spec.js — 「칸 꾸미기·줄 꾸미기·줄 추가 세 절의 아이콘이 «한 규격»인가」
 * (2026-09-24 · 기준선 7780267 · 현빈 지적 「우측패널 svg가 일관성도 없고 uiux상 직관적이지 않다」)
 *
 * ★재는 «양»
 *   세 절 안에 «실제로 그려진» <svg> 의 선 굵기·선끝 처리·색 바인딩이,
 *   같은 우측 패널이 «이미 쓰고 있는» 쉐브론 규격과 같은가.
 *   ⛔「소스에 1.5 라고 적혀 있나」가 아니다 — getComputedStyle 로 «그려진 값»을 잰다.
 *     (stroke-width·stroke-linecap 은 CSS 속성이라 CSS 가 덮을 수 있다. 속성만 읽으면 속는다.)
 *
 * ★기준을 «발명하지 않는다» — 레포에서 떠 온다
 *   ⑴ js/props/_typo-section.js 의 인라인 쉐브론(같은 우측 패널, 줄 꾸미기 바로 아래 절)
 *   ⑵ css/editor-props.css 의 `.prop-select` 화살표(data URI) — 이 패널의 «모든» select 가 쓴다
 *   둘은 같은 그림(M1 1l4 4 4-4)·같은 굵기·같은 선끝이다. A0 이 그 «둘이 같음»을 먼저 잰다 —
 *   기준이 둘로 갈리면 아래를 «잴 수 없다»(계측기 자가점검).
 *   ⛔색은 A0 에서 «빼 둔다» — CSS 쪽은 #666 고정, 인라인 쪽은 currentColor 라 지금도 갈려 있다.
 *     그건 26패널 전역 사안이라 이 그물의 범위 밖이고, 보고서에 «갈래»로 올렸다.
 *
 * ★모수를 «이름으로 안 센다»
 *   세 절은 소스에 실재하는 id 로 찾는다 — #grd-cell-body · #grd-line-body · #grd-line-add-kind.
 *   A1 이 그 셋이 «실제로 떴는지»를 먼저 단언한다. ⛔안 그러면 절이 안 떠도 「svg 0개 = 전부 통과」
 *     라는 «빈 초록»이 난다(이 레포가 여러 번 당한 갈래).
 *
 * ⛔앱을 «안» 띄운다 — 레포 파일만 크로미움에 얹는다(고디터 인스턴스·MCP 9345 대역 무접촉).
 *   하네스 골격은 tests/dom/grid-cell-panel-handles.dom.spec.js 를 그대로 베꼈다.
 *
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js grid-panel-icon-spec
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };

/* ── 기준 뜨기 ─────────────────────────────────────────────────────────── */
const SRC_TYPO = fs.readFileSync(path.join(REPO, 'js/props/_typo-section.js'), 'utf8');
/** A8 이 «이름표 사전»을 소스에서 뜬다 — 검사 안에 한글을 손으로 베끼지 않는다. */
const SRC_PANEL_KO = fs.readFileSync(path.join(REPO, 'js/props/prop-grid.js'), 'utf8');
const SRC_CSS  = fs.readFileSync(path.join(REPO, 'css/editor-props.css'), 'utf8');

/** 인라인 쉐브론 — _typo-section.js 의 `viewBox="0 0 10 6"` svg 한 개. */
function anchorInline() {
  const m = SRC_TYPO.match(/<svg[^>]*viewBox="0 0 10 6"[\s\S]*?<\/svg>/);
  if (!m) return null;
  const s = m[0];
  return {
    d:   (s.match(/\sd="([^"]+)"/) || [])[1] || null,
    sw:  (s.match(/stroke-width="([^"]+)"/) || [])[1] || null,
    cap: (s.match(/stroke-linecap="([^"]+)"/) || [])[1] || null,
  };
}
/** `.prop-select` 의 background-image data URI 화살표. */
function anchorCss() {
  const m = SRC_CSS.match(/\.prop-select\s*\{[\s\S]*?background-image:\s*url\("([^"]+)"\)/);
  if (!m) return null;
  const uri = decodeURIComponent(m[1]);
  return {
    d:   (uri.match(/\sd='([^']+)'/) || [])[1] || null,
    sw:  (uri.match(/stroke-width='([^']+)'/) || [])[1] || null,
    cap: (uri.match(/stroke-linecap='([^']+)'/) || [])[1] || null,
  };
}

const HARNESS = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="/css/editor-base.css">
<link rel="stylesheet" href="/css/editor-layout.css">
<link rel="stylesheet" href="/css/editor-canvas.css">
<link rel="stylesheet" href="/css/editor-panels.css">
<link rel="stylesheet" href="/css/editor-props.css">
<link rel="stylesheet" href="/css/color-picker.css">
<link rel="stylesheet" href="/css/editor-blocks.css"></head><body>
<div id="canvas"><div class="section-block"><div class="section-inner" id="host"></div></div></div>
<div id="panel-right"><div class="panel-body"></div></div>
<script src="/js/design-system.js"></script>
<script src="/js/io/section-serialize.js"></script>
<script>window.openIconifyModal=(cb)=>cb({svg:"<svg viewBox='0 0 24 24'><path d='M0 0h24v24H0z'/></svg>",size:64});</script>
<script type="module">
  import { makeGridBlock, getGridModel } from '/js/blocks/grid-block.js';
  import { showGridProperties } from '/js/props/prop-grid.js';
  window.__mk = makeGridBlock; window.__model = getGridModel; window.__open = showGridProperties; window.__ready = true;
</script></body></html>`;

const FIXTURE = {
  cols: [{ width: 1, lines: [] }, { width: 1, lines: [] }],
  rows: [{ height: 'auto' }, { height: 'auto' }],
  cells: [
    [{ lines: [{ type: 'body', text: 'A0' }, { type: 'h2', text: 'A1' }] }, { lines: [{ type: 'body', text: 'B0' }] }],
    [{ lines: [{ type: 'body', text: 'C0' }] }, { lines: [] }],
  ],
};
const ADDR = { r: 0, c: 0, li: 1 };   // 글자 줄 — 세 절이 «전부» 뜨는 주소
/** 기준 쉐브론 «마크업 그대로» — 하네스 안에서 같은 자로 잰다(숫자를 손으로 안 베낀다). */
const ANCHOR_SVG = (SRC_TYPO.match(/<svg[^>]*viewBox="0 0 10 6"[\s\S]*?<\/svg>/) || [])[0] || null;

/** @param {(src:string, pathname:string)=>string} [mutate] 양성대조 전용 — 서빙 직전 한 군데만 비튼다. */
async function boot(page, mutate) {
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/__harness.html') return route.fulfill({ contentType: 'text/html', body: HARNESS });
    const file = path.join(REPO, url.pathname);
    if (!file.startsWith(REPO) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
    const body = fs.readFileSync(file);
    const ct = MIME[path.extname(file)] || 'text/plain';
    if (mutate) return route.fulfill({ contentType: ct, body: mutate(body.toString('utf8'), url.pathname) });
    return route.fulfill({ contentType: ct, body });
  });
  await page.goto(`${ORIGIN}/__harness.html`);
  await page.waitForFunction(() => window.__ready === true);
  await page.evaluate((fx) => { window.__FIX = fx; }, FIXTURE);
}

/** 패널을 열고 접이식 절을 «펼친 뒤» 세 절 안의 svg 를 전수로 뜬다. */
const SURVEY = (page) => page.evaluate(async (addr) => {
  const HOST = document.getElementById('host');
  const PANEL = document.querySelector('#panel-right .panel-body');
  HOST.innerHTML = ''; PANEL.innerHTML = '';
  const { row, block } = window.__mk(JSON.parse(JSON.stringify(window.__FIX)));
  HOST.appendChild(row); block.classList.add('selected');
  window.__open(block, addr);
  for (const id of ['grd-cell-toggle', 'grd-line-toggle']) document.getElementById(id)?.click();
  await new Promise(r => setTimeout(r, 30));

  /* 세 절 — 소스에 실재하는 id 로 찾는다(이름을 짓지 않는다). */
  const ANCHORS = { cell: 'grd-cell-body', line: 'grd-line-body', add: 'grd-line-add-kind' };
  const secs = {};
  for (const [k, id] of Object.entries(ANCHORS)) {
    const el = document.getElementById(id);
    secs[k] = { found: !!el, sec: el ? el.closest('.prop-section') : null };
  }
  const svgs = [];
  for (const [k, v] of Object.entries(secs)) {
    if (!v.sec) continue;
    for (const s of v.sec.querySelectorAll('svg')) {
      /* ★그려진 값을 잰다 — 속성이 아니라 계산된 스타일. CSS 가 덮으면 속성은 거짓말이 된다.
         stroke 를 «실제로 긋는» 자식(또는 svg 자신)에서 읽는다. */
      const painters = [...s.querySelectorAll('*')].filter(e => {
        const cs = getComputedStyle(e);
        return cs.stroke && cs.stroke !== 'none';
      });
      const probe = painters[0] || s;
      const cs = getComputedStyle(probe);
      /* ★★잉크로 잰다 — 「stroke-width 1.5」는 viewBox 가 10 이냐 8 이냐에 따라 «다른 굵기»로 그려진다.
         선언값만 재면 viewBox 를 키워 잉크를 가늘게 만들어 놓고도 초록이 난다(게이트가 잘못된 양을 재는 갈래).
         잉크 = 선언 굵기 × (화면 폭 ÷ viewBox 폭). */
      const vb = (s.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number);
      const vbW = (vb.length === 4 && vb[2] > 0) ? vb[2] : null;
      const shownW = s.getBoundingClientRect().width;
      const scale = vbW ? (shownW / vbW) : null;
      const declSw = parseFloat(cs.strokeWidth);
      const ink = (scale !== null && !Number.isNaN(declSw)) ? +(declSw * scale).toFixed(3) : null;
      /* 모양 — 첫 moveto 좌표(놓는 «자리»)는 빼고 «그리는 손짓»만 견준다. */
      const dRaw = probe.getAttribute('d')
        || (probe.getAttribute('points') ? 'PTS:' + probe.getAttribute('points') : null);
      const shape = dRaw ? dRaw.replace(/^M\s*[-\d.]+[\s,]+[-\d.]+/, 'M') : null;
      /* 하드코딩 색 — 속성으로 본다(계산값은 currentColor 를 이미 rgb 로 풀어 버려 구분이 안 된다). */
      const rawStrokes = [s, ...s.querySelectorAll('*')]
        .map(e => e.getAttribute('stroke')).filter(v => v !== null);
      const rawFills = [s, ...s.querySelectorAll('*')]
        .map(e => e.getAttribute('fill')).filter(v => v !== null);
      svgs.push({
        sec: k,
        painters: painters.length,
        sw: cs.strokeWidth, ink, shape,
        cap: cs.strokeLinecap,
        join: cs.strokeLinejoin,
        viewBox: s.getAttribute('viewBox'),
        wh: `${s.getAttribute('width')}x${s.getAttribute('height')}`,
        rawStrokes, rawFills,
        where: (s.closest('[id]') || {}).id || '(no-id)',
      });
    }
  }
  /* ★기준도 «같은 자»로 잰다 — 소스 문자열에서 숫자를 베껴 오면 viewBox 배율을 못 본다.
     기준 쉐브론 마크업을 같은 패널에 잠깐 심어 잉크를 재고 걷는다(계측기 하나로 둘을 잰다). */
  let anchorInk = null;
  if (addr.__anchorSvg) {
    const box = document.createElement('div');
    box.style.cssText = 'position:absolute;left:-9999px;top:0;';
    box.innerHTML = addr.__anchorSvg;
    PANEL.appendChild(box);
    const a = box.querySelector('svg');
    const ap = [...a.querySelectorAll('*')].find(e => {
      const cs = getComputedStyle(e); return cs.stroke && cs.stroke !== 'none';
    }) || a;
    const avb = (a.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number);
    if (avb.length === 4 && avb[2] > 0) {
      anchorInk = +(parseFloat(getComputedStyle(ap).strokeWidth) * (a.getBoundingClientRect().width / avb[2])).toFixed(3);
    }
    box.remove();
  }
  return { secs: Object.fromEntries(Object.entries(secs).map(([k, v]) => [k, v.found])), svgs, anchorInk };
}, { ...ADDR, __anchorSvg: ANCHOR_SVG });

const INLINE = anchorInline();
const CSSARR = anchorCss();

test.describe('그리드 패널 세 절 — 아이콘 한 규격', () => {
  test('A0 계측기 — 기준이 «하나»인가 (인라인 쉐브론 ≡ .prop-select 화살표)', () => {
    expect(INLINE, '_typo-section.js 에서 viewBox="0 0 10 6" 쉐브론을 못 떴다').not.toBeNull();
    expect(CSSARR, 'editor-props.css 의 .prop-select background-image 를 못 떴다').not.toBeNull();
    expect(INLINE.d,   '쉐브론 그림(d)이 두 자리에서 다르다').toBe(CSSARR.d);
    expect(INLINE.sw,  '쉐브론 굵기가 두 자리에서 다르다').toBe(CSSARR.sw);
    expect(INLINE.cap, '쉐브론 선끝이 두 자리에서 다르다').toBe(CSSARR.cap);
  });

  test('A1 모수 — 세 절이 «실제로» 떴는가 (빈 초록 방지)', async ({ page }) => {
    await boot(page);
    const { secs, svgs } = await SURVEY(page);
    expect(secs, '세 절 중 안 뜬 것이 있다 — 그러면 아래 판정이 «빈 초록»이다')
      .toEqual({ cell: true, line: true, add: true });
    expect(svgs.length, '세 절 안에 잰 svg 가 0개다 — 모수가 비면 전부 통과한다').toBeGreaterThan(0);
  });

  test('A2 선끝 — 세 절의 모든 svg 가 기준 선끝을 따른다', async ({ page }) => {
    await boot(page);
    const { svgs } = await SURVEY(page);
    const bad = svgs.filter(s => s.painters > 0 && s.cap !== INLINE.cap);
    expect(bad, `기준 선끝 = "${INLINE.cap}" · 어긋난 것: ${JSON.stringify(bad)}`).toEqual([]);
  });

  test('A3 선굵기 — 세 절의 모든 svg 가 기준 «잉크»를 따른다', async ({ page }) => {
    await boot(page);
    const { svgs, anchorInk } = await SURVEY(page);
    expect(anchorInk, '기준 잉크를 못 쟀다 — 계측기가 눈이 멀었다').not.toBeNull();
    const bad = svgs.filter(s => s.painters > 0 && Math.abs(s.ink - anchorInk) > 0.05);
    expect(bad, `기준 잉크 = ${anchorInk}px · 어긋난 것: ${JSON.stringify(bad)}`).toEqual([]);
  });

  test('A3b 모양 — 세 절의 쉐브론이 기준 쉐브론과 «같은 손짓»인가', async ({ page }) => {
    await boot(page);
    const { svgs } = await SURVEY(page);
    const want = INLINE.d.replace(/^M\s*[-\d.]+[\s,]+[-\d.]+/, 'M');
    const bad = svgs.filter(s => s.painters > 0 && s.shape !== want);
    expect(bad, `기준 모양 = "${want}" · 어긋난 것: ${JSON.stringify(bad.map(b => ({ where: b.where, shape: b.shape })))}`).toEqual([]);
  });

  test('A4 색 — 세 절의 모든 svg 가 색을 «박아 두지» 않는다(currentColor/none 만)', async ({ page }) => {
    await boot(page);
    const { svgs } = await SURVEY(page);
    const OK = new Set(['currentColor', 'none']);
    const bad = svgs.filter(s => [...s.rawStrokes, ...s.rawFills].some(v => !OK.has(v)));
    expect(bad, `하드코딩 색이 남았다: ${JSON.stringify(bad)}`).toEqual([]);
  });

  /* ★양성대조 — 「고쳐야 할 것을 깨뜨리면 빨개지나」.
     고친 뒤에도 이 그물이 «깨어 있는지»를 매번 같이 잰다. 서빙 직전 굵기 한 글자만 되돌린다. */
  test('A5 양성대조 — 절 머리 쉐브론 굵기를 옛 1.8 로 되돌리면 A3 가 빨개진다', async ({ page }) => {
    /* ★이 비틀기가 «실제로 한 글자를 바꿨는지»까지 본다 — 앵커가 늙어 치환이 0건이면
       비틀지도 않은 코드를 「빨갛다」고 세게 된다(검사처럼 생긴 문장). */
    let hits = 0;
    await boot(page, (src, p) => {
      if (p !== '/js/props/prop-grid.js') return src;
      return src.replace(/(viewBox="0 0 10 10"[\s\S]{0,120}?stroke-width=")[0-9.]+(")/, (m, a, b) => { hits++; return a + '1.8' + b; });
    });
    expect(hits, '비틀 자리를 못 찾았다 — 이 양성대조가 «아무것도 안 바꾸고» 있다').toBe(1);
    const { svgs, anchorInk } = await SURVEY(page);
    const bad = svgs.filter(s => s.painters > 0 && Math.abs(s.ink - anchorInk) > 0.05);
    expect(bad.length, '비틀었는데도 A3 가 초록이다 — 그물이 그 축을 «안 재고» 있다').toBeGreaterThan(0);
  });

  /* ══ A6 — 절 머리 쉐브론은 «네 곳»에 같은 마크업으로 산다 ═══════════════════
   * ⚠️★이 하나만 «소스 읽기»다. 위 A2~A4 보다 «약한 자»다 — CSS 가 덮으면 못 본다.
   *   그래도 두는 까닭: 같은 절 머리 부품이 prop-grid 말고 세 곳에 더 복붙돼 있고,
   *   그 셋은 이 하네스가 «안 띄우는» 패널이라 DOM 으로 잴 자리가 없다.
   *   ⇒ 「그리드는 실측으로, 나머지 셋은 소스로」 — 어디까지 쟀는지 여기 적어 둔다.
   * ★모수를 이름으로 안 센다 — 「돌아가는 svg」라는 «생김새»로 찾는다
   *   (절 머리 쉐브론만 transform:rotate 로 접힘/펼침을 표시한다). */
  test('A6 (소스) 절 머리 쉐브론 네 곳이 전부 기준 마크업인가', () => {
    const DIR = path.join(REPO, 'js/props');
    const found = [];
    for (const f of fs.readdirSync(DIR).filter(n => n.endsWith('.js'))) {
      const src = fs.readFileSync(path.join(DIR, f), 'utf8');
      for (const m of src.matchAll(/<svg\b[\s\S]*?<\/svg>/g)) {
        if (!/transform:rotate\(/.test(m[0])) continue;   // 접힘 표시 쉐브론만
        const s2 = m[0];
        found.push({
          file: f,
          sw:  (s2.match(/stroke-width="([^"]+)"/) || [])[1] || null,
          cap: (s2.match(/stroke-linecap="([^"]+)"/) || [])[1] || null,
          d:   (s2.match(/\sd="([^"]+)"/) || [])[1] || null,
          vb:  (s2.match(/viewBox="([^"]+)"/) || [])[1] || null,
          wh:  ((s2.match(/width="([^"]+)"/) || [])[1] || '?') + 'x' + ((s2.match(/height="([^"]+)"/) || [])[1] || '?'),
          stroke: (s2.match(/\sstroke="([^"]+)"/) || [])[1] || null,
        });
      }
    }
    expect(found.length, '접힘 쉐브론을 한 개도 못 찾았다 — 모수가 비면 전부 통과한다').toBeGreaterThan(0);
    const shape = INLINE.d.replace(/^M\s*[-\d.]+[\s,]+[-\d.]+/, 'M');
    const bad = found.filter(x =>
      x.sw !== INLINE.sw || x.cap !== INLINE.cap || x.stroke !== 'currentColor' ||
      !x.d || x.d.replace(/^M\s*[-\d.]+[\s,]+[-\d.]+/, 'M') !== shape ||
      /* 잉크가 1.5px 로 그려지려면 viewBox 폭 = 화면 폭 이어야 한다. */
      (x.vb || '').trim().split(/\s+/)[2] !== x.wh.split('x')[0]);
    expect(bad, `기준 = d≡"${shape}" · sw ${INLINE.sw} · cap ${INLINE.cap} · currentColor · viewBox폭=화면폭\n어긋난 것: ${JSON.stringify(bad, null, 1)}`).toEqual([]);
  });

  /* ══ A7 — «직관성» 축 하나: 정렬 손잡이가 «무엇에 걸리는지» 말하는가 ═══════════
   * 이 패널엔 「가로 정렬」이라는 «같은 말»이 두 번, 「세로 정렬」도 두 번 뜬다
   *   Layout 절   — 열 전체(아이콘 단추 3개)
   *   칸 꾸미기 절 — 이 칸 하나(드롭다운)
   * 게다가 줄 꾸미기 절엔 「줄 정렬」이 또 있다. 보이는 라벨만으로는 «범위»를 못 가른다.
   * ⛔위젯 종류(단추냐 드롭다운이냐)·라벨 문구는 «현빈이 고르실 문제»라 여기서 안 정한다.
   *   여기서 잠그는 것은 그보다 아래 — 「세 드롭다운이 전부 범위를 말하는가」 하나다.
   *   실측(2026-09-24, 기준선 7780267): 칸 가로·칸 세로는 말했고 «줄 정렬만 빈 채»였다. */
  test('A7 직관성 — 세 절의 정렬 드롭다운이 전부 «무엇에 걸리는지» 말한다', async ({ page }) => {
    await boot(page);
    const got = await page.evaluate(async (addr) => {
      const HOST = document.getElementById('host');
      const PANEL = document.querySelector('#panel-right .panel-body');
      HOST.innerHTML = ''; PANEL.innerHTML = '';
      const { row, block } = window.__mk(JSON.parse(JSON.stringify(window.__FIX)));
      HOST.appendChild(row); block.classList.add('selected');
      window.__open(block, addr);
      for (const id of ['grd-cell-toggle', 'grd-line-toggle']) document.getElementById(id)?.click();
      await new Promise(r => setTimeout(r, 30));
      /* ★이름을 짓지 않는다 — 세 절 안의 «정렬 뜻을 가진 드롭다운»을 옵션 명부로 찾는다.
         (기본/왼쪽/가운데/오른쪽 또는 기본/위/가운데/아래 — _GRD_CELL_ALIGNS/VALIGNS 가 그 값이다) */
      const out = [];
      for (const id of ['grd-cell-body', 'grd-line-body', 'grd-line-add-kind']) {
        const sec = document.getElementById(id)?.closest('.prop-section');
        if (!sec) continue;
        for (const sel of sec.querySelectorAll('select')) {
          const opts = [...sel.options].map(o => o.text);
          const isAlign = opts[0] === '기본' && opts.length === 4;
          if (!isAlign) continue;
          if (out.some(o => o.id === sel.id)) continue;
          out.push({ id: sel.id, opts, title: (sel.getAttribute('title') || '').trim() });
        }
      }
      return out;
    }, ADDR);
    expect(got.length, '정렬 드롭다운을 한 개도 못 찾았다 — 모수가 비면 전부 통과한다').toBe(3);
    const mute = got.filter(g => !g.title);
    expect(mute, `범위를 «안 말하는» 정렬 드롭다운: ${JSON.stringify(got, null, 1)}`).toEqual([]);
  });

  /* ══ A8 — 「줄 종류」 드롭다운이 «지금 줄의 진짜 종류»를 말하는가 ═══════════════
   * ★왜 이 축인가 — 렌더러가 그리는 줄 종류가 패널 명부보다 «많다».
   *   렌더러 `_gridLineHtml` 의 type 분기 전수 = gap · image · duo · graph ＋ GRID_ROLES 6개
   *   패널 명부 `_GRD_KINDS`        = GRID_ROLES 6개 ＋ image ＋ gap   ⇒ duo·graph 가 «없다»
   *   ⛔둘을 «같게 만드는» 것은 이 검사의 일이 아니다(duo·graph 를 손으로 만들게 할지는
   *     현빈이 고르실 문제다 — 중첩·막대는 손잡이가 더 필요하다). 여기서 잠그는 것은 그보다 아래:
   *     「명부에 없는 종류의 줄을 골랐을 때, 드롭다운이 «거짓말을 하지 않는가»」.
   * ★실측(2026-09-24, 기준선 7780267) — duo 줄과 graph 줄을 고르면 드롭다운이 둘 다
   *   selectedIndex 0 = value "label" = 보이는 글자 「작은제목」 이었다. 요약 줄은 «(duo)»·«(graph)»
   *   라고 바르게 말하는데 드롭다운만 달랐다 — 한 절 안에서 두 문장이 어긋난다.
   *   그리고 그 거짓을 보고 「본문」으로 바꾸면 중첩이 통째로 날아간다(실측: cols 가 모델에서 사라지고
   *   캔버스의 .grd-nested 가 1 → 0). ⌘Z 로는 돌아온다.
   * ★모수를 이름으로 안 센다 — «렌더러가 실제로 분기하는 type» 을 소스에서 떠서 돈다.
   *   ⇒ 렌더러에 새 종류가 하나 붙으면 이 검사가 «저절로» 그것도 요구한다. */
  test('A8 「줄 종류」가 «지금 줄의 진짜 종류»를 말한다 (명부에 없는 종류 포함)', async ({ page }) => {
    /* 렌더러가 분기하는 비(非)역할 type 을 소스에서 뜬다 — `line.type === 'xxx'` 전수. */
    const SRC_BLOCK = fs.readFileSync(path.join(REPO, 'js/blocks/grid-block.js'), 'utf8');
    const rendered = [...new Set([...SRC_BLOCK.matchAll(/line\.type\s*===\s*'([a-z]+)'/g)].map(m => m[1]))];
    expect(rendered.length, '렌더러의 type 분기를 한 개도 못 떴다 — 모수가 비면 전부 통과한다').toBeGreaterThan(0);

    await boot(page);
    const got = await page.evaluate(async (kinds) => {
      const mkLine = (t) => (t === 'duo'
        ? { type: 'duo', gap: 12, cols: [{ width: 1, lines: [{ type: 'body', text: '중첩속' }] }] }
        : t === 'graph' ? { type: 'graph', items: [{ label: '만족도', value: 80 }] }
        : t === 'image' ? { type: 'image', imgSrc: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', height: 40 }
        : t === 'gap' ? { type: 'gap', height: 16 } : { type: t, text: 'X' });
      const out = [];
      for (const t of kinds) {
        const FIX = {
          cols: [{ width: 1, lines: [] }], rows: [{ height: 'auto' }, { height: 'auto' }],
          cells: [[{ lines: [{ type: 'body', text: 'top' }] }], [{ lines: [{ type: 'body', text: 'C0' }, mkLine(t)] }]],
        };
        const H = document.getElementById('host'), P = document.querySelector('#panel-right .panel-body');
        H.innerHTML = ''; P.innerHTML = '';
        const { row, block } = window.__mk(JSON.parse(JSON.stringify(FIX)));
        H.appendChild(row); block.classList.add('selected');
        window.__open(block, { r: 1, c: 0, li: 1 });
        document.getElementById('grd-line-toggle')?.click();
        await new Promise(r => setTimeout(r, 20));
        let real = null;
        try { real = window.__model(block).cells[1][0].lines[1].type; } catch (_) {}
        const sel = document.getElementById('grd-line-kind');
        out.push({
          심은type: t, 모델type: real,
          고른값: sel ? sel.value : '(select 없음)',
          보이는글자: sel ? ((sel.options[sel.selectedIndex] || {}).text || '') : '—',
        });
      }
      return out;
    }, rendered);

    /* ★계측기 자가점검 — 모델이 내가 심은 종류를 실제로 들고 있나.
       여기가 어긋나면 아래 판정은 «내 픽스처가 안 심긴 것»을 재는 것이다. */
    const notPlanted = got.filter(g => g.모델type !== g.심은type);
    expect(notPlanted, `픽스처가 안 심겼다 — 이 검사가 눈이 먼 상태다: ${JSON.stringify(notPlanted)}`).toEqual([]);

    /* ★재는 «양» — 「값이 같은가」가 아니라 「거짓말을 하는가」다.
       ⛔첫 판에 값 일치로 쟀더니, 사실을 말하도록 고친 뒤에도 빨갰다(머리 옵션은 value="" 가 맞다).
         게이트가 «잘못된 양»을 재면 고치는 쪽이 엉뚱한 데를 고친다. 양을 둘로 갈라 다시 세운다.
       ⑴ 고른 값이 «다른 실재 종류»이면 거짓말이다 (원래 결함: duo 줄인데 value="label")
       ⑵ 보이는 글자가 그 종류를 «이름으로도 값으로도» 안 담으면 사용자는 무엇인지 모른다
       ★둘 다 초록이 되는 길은 «둘»이고, 이 검사는 어느 쪽도 강요하지 않는다 —
         명부에 넣어 고를 수 있게 하든(값 일치), 못 만든다고 말해 주든(머리 옵션) 다 통과다.
         ⛔「duo 를 명부에 넣어라」를 이 검사가 «대신 정하지» 않는다. */
    const KO = (() => {
      const m = SRC_PANEL_KO.match(/_GRD_KIND_KO\s*=\s*\{([\s\S]*?)\n\};/);
      const o = {};
      if (m) for (const kv of m[1].matchAll(/([a-z]+)\s*:\s*'([^']+)'/g)) o[kv[1]] = kv[2];
      return o;
    })();
    const lying = got.filter((g) => {
      if (g.고른값 && g.고른값 !== g.모델type) return true;                    // ⑴
      const names = [KO[g.모델type], g.모델type].filter(Boolean);
      return !names.some(n => g.보이는글자.includes(n));                        // ⑵
    });
    expect(lying, `드롭다운이 «진짜 종류»를 말하지 않는다: ${JSON.stringify(got, null, 1)}`).toEqual([]);
  });
});
