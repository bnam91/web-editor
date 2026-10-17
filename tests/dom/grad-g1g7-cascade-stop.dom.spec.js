/* grad-g1g7-cascade-stop.dom.spec.js — 1017t1 그라데이션 셋(G1·G2·G7·G-NEW)
 *
 * 현빈 h8-b 「스티커패널에서 그라데이션 추가시 쾌적하지 않다 … 2개 이상 추가해보고 이상없는지 qa 해봐」
 * ＋ G-NEW(2026-10-17 밤) 「2개 이상 추가한 뒤 하나를 옮기면 나머지 하나가 배경이미지로 들어가는 것 같다」
 *
 * ★무엇을 잠그나
 *   G-N0  ★«쌓임 실측» — 그라데이션과 텍스트블럭이 겹칠 때 ★어느 쪽이 위인가(전제 3개 + 주 단언)
 *   G1-a  ★양성 — cascade: 2개 추가 ⇒ y 가 40/64 로 갈려 겹치지 않는다(x 는 clamp 로 0 — 일부러)
 *   G1-n  ★음성대조(×3) — cascade 블록을 지우면 G1-a 가 실제로 빨강
 *   G1-sel ★양성 — 추가하면 ★새것이 «진짜 로스터»로 골라진다(G2 가 이미 닫혀 있음을 이 레인에서도 잠근다)
 *   G1-sel-n ★음성대조 — DENY 에 addGradientBlock 을 넣으면 ★로스터에서 빠지고 ★선택도 안 된다
 *   G7-a  ★양성 — 3-stop radial 에서 중간색 자리가 ★입력값 그대로(0.2 가 20%로, 80%로 안 뒤집힘)
 *   G7-n  ★음성대조 — 「1 - s.offset」을 되살리면 G7-a 가 실제로 빨강(중간색이 80%로)
 *   G7-twoStop ★보정 — ★설계서(GD Planner)의 「2-stop 은 고치기 전후 바이트 동일」주장을 실측으로 재검증.
 *     ⚠️실측 결과 그 주장은 ★틀렸다 — offset «집합» {0,1} 은 자기 자신으로 가지만, 거기 «붙은 색/알파»는
 *     swap 된다(기본값: alpha 1↔0). old=[rgba(..,0) 0%, rgba(..,1) 100%] vs new=[rgba(..,1) 0%, rgba(..,0) 100%]
 *     — 바이트가 다르다. 이 칸은 ★그 정정을 고정한다(⛔설계서를 베끼지 않는다 — 다시 쟀다).
 *   G-NEW-a    ★양성 — 현빈 증상 그 장면: 2개 추가 → 진짜 마우스로 하나를 스냅임계 밖으로 이동 →
 *     겹치지 않고, G-N0 이 실측한 «쌓임 승자»가 그대로 유지된다(미리 결론을 박지 않는다 — G-N0 상수를 그대로 받아 쓴다)
 *   G-NEW-snap ★양성 — cascade 가 있어도 임계(40 섹션-로컬 px) 안에서 끌면 ★다시 자석처럼 붙는다
 *     (G1 만으로는 안 닫힌다는 findings ④㉢ 를 ★사실로 기록 — ⛔버그로 적지 않는다)
 *
 * ⛔앱을 «안» 띄운다(9500/9334/MCP 대역 무접촉). dev 원문 js 를 ★인라인으로 그대로 먹이고(선례 insert-select-follows),
 *   css 는 ★실물 파일을 route 로 서빙해 ★진짜 쌓임맥락으로 잰다(editor-canvas.css·editor-layout.css).
 * ⛔page.waitForTimeout 금지 — waitForFunction/expect.poll/waitStableRect 만.
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js grad-g1g7-cascade-stop
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://gradg1g7.dom.test';
const MIME = { '.css': 'text/css' };
const read = (p) => fs.readFileSync(path.join(REPO, p), 'utf8').replace(/\r\n/g, '\n');

const GB_SRC = read('js/blocks/gradient-block.js');
const GS_SRC = read('js/gradient-select.js');
const SS_SRC = read('js/sticker-select.js');
const IH_SRC = read('js/insert-history.js');
const IS_SRC = read('js/insert-select.js');
const BE_SRC = read('js/block-edit.js');
const PD_SRC = read('js/panel-dispatch.js');

/* ── 음성대조본 N(G1) — cascade 묶음을 지운다 ───────────────────────────── */
const GB_N_NOCASCADE = (() => {
  const needle = `  if (opts.x == null && opts.y == null) {
    const n = sec.querySelectorAll('.gradient-block').length;
    const cx = 40 + (n % 8) * 24, cy = 40 + (n % 8) * 24;
    const bw = Number(opts.width ?? GRADIENT_DEFAULTS.width);
    const bh = Number(opts.height ?? GRADIENT_DEFAULTS.height);
    const [qx, qy] = window._clampToSection?.(cx, cy, sec, bw, bh) || [cx, cy];
    opts = { ...opts, x: qx, y: qy };
  }`;
  if (!GB_SRC.includes(needle)) throw new Error('G1-n 변환이 늙었다 — cascade 블록을 못 찾았다');
  return GB_SRC.replace(needle, '  /* N: cascade 없음 */');
})();

/* ── 음성대조본 N(G7) — 「1 - s.offset」 반전을 되살린다 ──────────────────── */
const GB_N_RADIALREV = (() => {
  const needle = 'const radialStops = stops;   // ★자리 보존 — 사용자가 준 offset 그대로';
  if (!GB_SRC.includes(needle)) throw new Error('G7-n 변환이 늙었다 — radialStops 대입 줄을 못 찾았다');
  return GB_SRC.replace(
    needle,
    "const radialStops = stops.map(s => ({ ...s, offset: Math.max(0, Math.min(1, 1 - s.offset)) })).sort((a,b) => a.offset - b.offset);   // N: 반전 되살림"
  );
})();

/* ── 음성대조본 N(G1-sel) — DENY 에 addGradientBlock 을 넣는다 ───────────── */
const IH_N_DENY = (() => {
  const needle = `  var DENY = {
    /* (지금은 비어 있다 — Block$ 패턴이 비삽입을 한 건도 안 잡는다.
       비삽입 add* 8자리(addGhostSection·addPage·addSectionToScope·addStickerFavorite·
       addToImageGallery·addChecklistItem·addChecklistSection·addVariation)는 전부
       패턴 밖이라 여기 적을 것이 없다. 새 이름이 생기면 «이유와 함께» 여기에.) */
  };`;
  if (!IH_SRC.includes(needle)) throw new Error('G1-sel-n 변환이 늙었다 — DENY 리터럴을 못 찾았다');
  return IH_SRC.replace(needle, '  var DENY = { addGradientBlock: 1 /* N: 음성대조 — 강제로 막음 */ };');
})();

function harness({ gb = GB_SRC, ih = IH_SRC, textH = 150, secH = 600 } = {}) {
  return `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="/css/editor-canvas.css">
<link rel="stylesheet" href="/css/editor-layout.css">
<style>body{margin:0}</style>
<script>
  window.currentZoom = 40;
  window.__hist = 0;
  window.pushHistory = (a) => { window.__hist = (window.__hist||0) + 1; window.__lastAction = a; };
  window.scheduleAutoSave = () => {};
  window.buildLayerPanel = () => {};
  window.beginDragHistory = () => ({ arm: () => {} });
  /* ★window.showGradientProperties — 제품 정의 자리는 js/props/prop-gradient.js. DOM 하네스에서는
     ★스텁이다(선례 tests/dom/undo-restore-selection.dom.spec.js:52). */
  window.showGradientProperties = (el) => { window.__panelFor = el && el.id; };
  window.getSelectedSection = () => document.querySelector('.section-block');
  window.showNoSelectionHint = () => { window.__hint = (window.__hint || 0) + 1; };
  window.deselectAll = () => {};
  window.clearSelectionMarks = () => { document.querySelectorAll('.selected').forEach((el) => el.classList.remove('selected')); };
  window.highlightBlock = () => {};
</script>
</head><body>
<!-- ★js/editor.js:368 _applyScalerTransform 의 그 꼴(scale(currentZoom/100)) — origin 만 top left 로
     단순화(production 은 top center. 드래그 산식(/zoom)을 «진짜로» 밟으려면 scaler 가 있어야 한다). -->
<div id="canvas-scaler" style="transform:scale(0.4);transform-origin:top left;">
<div id="canvas">
  <div class="section-block" id="sec1" style="width:860px;height:${secH}px">
    <div class="section-inner">
      <div class="row">
        <div class="text-block tb-h1" id="txt1" style="height:${textH}px;margin:0;background:rgba(0,0,255,0.35)">본문 글자 — G-N0 쌓임 실측용</div>
      </div>
    </div>
  </div>
</div>
</div>
<div id="ss-handles-overlay" style="position:fixed;inset:0;pointer-events:none;z-index:9000"></div>
<script>${SS_SRC}</script>
<script>${ih}</script>
<script>${IS_SRC}</script>
<script>${BE_SRC}</script>
<script>${PD_SRC}</script>
<script type="module">
${gb}
window.__gbReady = true;
</script>
<script type="module">
${GS_SRC}
window.__gsReady = true;
</script>
</body></html>`;
}

async function boot(page, opts) {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.route(`${ORIGIN}/**`, async (route) => {
    const u = new URL(route.request().url());
    if (u.pathname === '/h.html') return route.fulfill({ contentType: 'text/html', body: harness(opts) });
    const file = path.join(REPO, u.pathname);
    if (!file.startsWith(REPO) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({ contentType: MIME[path.extname(file)] || 'text/plain', body: fs.readFileSync(file) });
  });
  await page.setViewportSize({ width: 1200, height: 900 });
  await page.goto(`${ORIGIN}/h.html`);
  await page.waitForFunction(() => window.__gbReady && window.__gsReady && window.addGradientBlock && window.renderGradientBlock);
  return errs;
}

/* 섹션-로컬 좌표(x,y) → 화면 client 좌표. #canvas-scaler 가 scale(0.4) 이므로 secRect 는 이미 축소돼
   있다 — 안쪽 오프셋(x,y)에 ★zoom 을 곱해야 gradient-select.js 의 «/zoom» 역산과 맞아떨어진다. */
const toClient = (page, x, y) => page.evaluate(({ x, y }) => {
  const r = document.getElementById('sec1').getBoundingClientRect();
  const zoom = (window.currentZoom || 40) / 100;
  return { cx: r.left + x * zoom, cy: r.top + y * zoom };
}, { x, y });

test.describe('G-N0 — 그라데이션 ↔ 텍스트블럭 쌓임 실측(전제 먼저)', () => {
  test('전제 3개 + 주 단언 — 누가 위인가를 찍어서 올린다', async ({ page }) => {
    const errs = await boot(page);
    await page.evaluate(() => { window.addGradientBlock(); });
    const r = await page.evaluate(() => {
      const sec = document.getElementById('sec1');
      const grad = document.querySelector('.gradient-block');
      const txt = document.getElementById('txt1');
      return {
        secZ: getComputedStyle(sec).zIndex,
        gradInlineZ: grad.style.zIndex,
        gradIsLastSectionChild: sec.lastElementChild === grad,
        gradXY: { x: grad.dataset.x, y: grad.dataset.y },
      };
    });
    // ★전제 단언 3개 — 먼저 선다
    expect(r.secZ).toBe('2');
    expect(r.gradInlineZ).toBe('2');
    expect(r.gradIsLastSectionChild).toBe(true);
    expect(r.gradXY).toEqual({ x: '0', y: '40' });

    // ★주 단언 — 겹치는 점(섹션-로컬 400,100 — txt 범위 0~150, grad 범위 40~340)에서 누가 위인가
    const { cx, cy } = await toClient(page, 400, 100);
    const hit = await page.evaluate(({ cx, cy }) => {
      const stack = document.elementsFromPoint(cx, cy).map((el) => el.id || el.className);
      const top = document.elementsFromPoint(cx, cy)[0];
      return { stack, topIsGrad: !!top.closest('.gradient-block'), topIsText: !!top.closest('.text-block') };
    }, { cx, cy });
    // ★둘째 자 — 진짜 마우스 클릭으로 ★무엇이 선택되는지(= 사용자가 실제로 겪는 상호작용 상위)
    await page.mouse.click(cx, cy);
    const clicked = await page.evaluate(() => {
      const sel = document.querySelector('.selected');
      return sel ? (sel.classList.contains('gradient-block') ? 'gradient' : sel.classList.contains('text-block') ? 'text' : sel.className) : 'none';
    });
    // ★찍어서 올린다 — 「되어야 한다」를 미리 박지 않는다. 두 측정이 서로 뒷받침하는지만 본다.
    const paintTop = hit.topIsGrad ? 'gradient' : hit.topIsText ? 'text' : 'other';
    expect(errs).toEqual([]);
    console.log('[G-N0 실측]', JSON.stringify({ stack: hit.stack, paintTop, clicked }));
    // ★두 측정(화면에 그려진 순서 vs 실제 클릭이 집는 것)이 ★서로 같은 답을 내야 한다 — 다르면 자가 흔들린다는 뜻.
    expect(clicked === 'gradient' ? 'gradient' : clicked === 'text' ? 'text' : 'other').toBe(paintTop);
  });
});

test.describe('G1 — cascade (같은 자리 겹침 방지)', () => {
  test('G1-a 양성 — 2개 추가 ⇒ y 가 갈려 겹치지 않는다(x 는 clamp 로 0)', async ({ page }) => {
    const errs = await boot(page);
    await page.evaluate(() => { window.addGradientBlock(); window.addGradientBlock(); });
    const gs = await page.evaluate(() => [...document.querySelectorAll('.gradient-block')].map((b) => ({ x: b.dataset.x, y: b.dataset.y })));
    expect(gs.length).toBe(2);                 // ★전제
    expect(gs[0].y).toBe('40');
    expect(gs[1].y).toBe('64');                // 40 + 1*24 — 선례 식 그대로
    expect(gs[0].x).toBe(gs[1].x);              // ★x 는 clamp 로 같다(일부러 — findings①)
    expect(gs[0].x).toBe('0');

    // ★자리 분리가 «고를 수 있음»까지 가는지 — 첫째의 노출된 띠(y 40~63)의 한 점에서 첫째가 잡힌다
    const { cx, cy } = await toClient(page, 10, 50);
    const topId = await page.evaluate(({ cx, cy }) => {
      const top = document.elementsFromPoint(cx, cy)[0];
      const g = top.closest('.gradient-block');
      return g ? g.id : null;
    }, { cx, cy });
    const firstId = await page.evaluate(() => document.querySelectorAll('.gradient-block')[0].id);
    expect(errs).toEqual([]);
    expect(topId).toBe(firstId);
  });

  for (let i = 1; i <= 3; i++) {
    test(`G1-n 음성대조(#${i}/3) — cascade 를 지우면 G1-a 가 실제로 빨강`, async ({ page }) => {
      const errs = await boot(page, { gb: GB_N_NOCASCADE });
      await page.evaluate(() => { window.addGradientBlock(); window.addGradientBlock(); });
      const gs = await page.evaluate(() => [...document.querySelectorAll('.gradient-block')].map((b) => ({ x: b.dataset.x, y: b.dataset.y })));
      expect(errs).toEqual([]);
      expect(gs.length).toBe(2);
      // ★무력화 판에서는 둘 다 (0,0) — G1-a 의 기대(40/64)가 깨진다
      expect(gs[0]).toEqual({ x: '0', y: '0' });
      expect(gs[1]).toEqual({ x: '0', y: '0' });
      expect(() => expect(gs[1].y).toBe('64')).toThrow();   // ★G1-a 단언이 실제로 빨강이 됨을 재확인
    });
  }

  test('G1-sel 양성 — 추가하면 새것이 진짜 로스터로 골라진다(G2 재확인)', async ({ page }) => {
    const errs = await boot(page);
    await page.evaluate(() => { window.__insertSeamInstall(); });
    const roster = await page.evaluate(() => window.__insertSeamRoster());
    expect(roster).toContain('addGradientBlock');          // ★전제
    await page.evaluate(() => { window.addGradientBlock(); });
    const r = await page.evaluate(() => {
      const sels = [...document.querySelectorAll('.gradient-block.selected')];
      const newest = document.querySelectorAll('.gradient-block')[0];
      return { n: sels.length, isNewest: sels[0] === newest };
    });
    expect(errs).toEqual([]);
    expect(r.n).toBe(1);
    expect(r.isNewest).toBe(true);
  });

  test('G1-sel-n 음성대조 — DENY 에 addGradientBlock 을 넣으면 로스터·선택 둘 다 빠진다', async ({ page }) => {
    const errs = await boot(page, { ih: IH_N_DENY });
    await page.evaluate(() => { window.__insertSeamInstall(); });
    const roster = await page.evaluate(() => window.__insertSeamRoster());
    expect(roster).not.toContain('addGradientBlock');
    await page.evaluate(() => { window.addGradientBlock(); });
    const n = await page.evaluate(() => document.querySelectorAll('.gradient-block.selected').length);
    expect(errs).toEqual([]);
    expect(n).toBe(0);                                      // ★빨강 — 아무도 안 골라졌다
  });
});

test.describe('G7 — radial 중간 stop 자리 반전 제거', () => {
  const STOPS3 = JSON.stringify([
    { color: '#ff0000', alpha: 1, offset: 0 },
    { color: '#00ff00', alpha: 1, offset: 0.2 },
    { color: '#0000ff', alpha: 1, offset: 1 },
  ]);

  test('G7-a 양성 — 3-stop radial 중간색(0.2)이 입력값 그대로(20%)', async ({ page }) => {
    const errs = await boot(page);
    const bg = await page.evaluate((stops) => {
      const b = document.createElement('div');
      b.id = 'g7a'; b.className = 'gradient-block'; b.dataset.type = 'gradient';
      b.dataset.gradStyle = 'radial';
      b.dataset.gradStops = stops;
      document.getElementById('sec1').appendChild(b);
      window.renderGradientBlock(b);
      return b.querySelector('.grad-fill').style.backgroundImage;
    }, STOPS3);
    expect(errs).toEqual([]);
    expect(bg).toContain('radial-gradient');                 // ★전제
    const pcts = [...bg.matchAll(/(\d+)%/g)].map((m) => Number(m[1]));
    expect(pcts.length).toBe(3);                              // ★전제 — stop 3개
    expect(pcts).toEqual([0, 20, 100]);                        // ★주 단언 — 20이지 80이 아니다
  });

  test('G7-n 음성대조 — 「1 - offset」을 되살리면 중간색이 80%로 뒤집혀 G7-a 가 빨강', async ({ page }) => {
    const errs = await boot(page, { gb: GB_N_RADIALREV });
    const bg = await page.evaluate((stops) => {
      const b = document.createElement('div');
      b.id = 'g7n'; b.className = 'gradient-block'; b.dataset.type = 'gradient';
      b.dataset.gradStyle = 'radial';
      b.dataset.gradStops = stops;
      document.getElementById('sec1').appendChild(b);
      window.renderGradientBlock(b);
      return b.querySelector('.grad-fill').style.backgroundImage;
    }, STOPS3);
    expect(errs).toEqual([]);
    const pcts = [...bg.matchAll(/(\d+)%/g)].map((m) => Number(m[1]));
    expect(pcts).toEqual([0, 80, 100]);                         // ★뒤집힘 — G7-a 의 20 기대가 깨진다
    expect(() => expect(pcts).toEqual([0, 20, 100])).toThrow();
  });

  test('G7-twoStop ★보정 — 설계서의 「2-stop 바이트 동일」주장은 틀렸다(실측으로 정정)', async ({ page }) => {
    const errsOld = await boot(page, { gb: GB_N_RADIALREV });
    const bgOld = await page.evaluate(() => {
      const b = document.createElement('div');
      b.id = 'g7old'; b.className = 'gradient-block'; b.dataset.type = 'gradient';
      b.dataset.gradStyle = 'radial';
      document.getElementById('sec1').appendChild(b);
      window.renderGradientBlock(b);
      return b.querySelector('.grad-fill').style.backgroundImage;
    });
    expect(errsOld).toEqual([]);

    const errsNew = await boot(page, {});
    const bgNew = await page.evaluate(() => {
      const b = document.createElement('div');
      b.id = 'g7new'; b.className = 'gradient-block'; b.dataset.type = 'gradient';
      b.dataset.gradStyle = 'radial';
      document.getElementById('sec1').appendChild(b);
      window.renderGradientBlock(b);
      return b.querySelector('.grad-fill').style.backgroundImage;
    });
    expect(errsNew).toEqual([]);
    // ★실측: offset «집합» {0,1} 은 자기 자신으로 가지만, 거기 붙은 alpha 는 swap 된다 — 바이트가 다르다.
    expect(bgOld).not.toBe(bgNew);
    expect(bgOld).toContain('rgba(0, 0, 0, 0) 0%');     // old: 중앙 투명
    expect(bgNew).toContain('rgb(0, 0, 0) 0%');          // new: 중앙 불투명(알파1→브라우저가 rgb로 직렬화) — 방향이 바뀌었다
  });
});

test.describe('G-NEW — 「2개 추가 → 하나 이동 → 나머지가 글자 위에 보인다」', () => {
  test('G-NEW-a 양성 — 현빈 증상 장면: 스냅 임계 밖으로 끌면 겹치지 않고, 쌓임 승자는 G-N0 과 같다', async ({ page }) => {
    /* ★섹션을 넉넉히(1000px) — 기본 600px 로는 300px 짜리 블록 둘이 ★구조적으로 안 떨어진다
       (첫째가 y=40 고정이라 둘째의 가용범위[0,300]과 반드시 겹친다). «쌓임»을 재는 게 목적이라
       치수를 좁히는 쪽을 골랐다 — 산식(cascade·clamp)은 안 바꾼다. */
    const errs = await boot(page, { secH: 1000 });
    // G-N0 승자 상수를 ★같은 하네스에서 다시 받아온다(미리 손으로 박지 않는다)
    await page.evaluate(() => { window.addGradientBlock(); });
    const { cx: gcx, cy: gcy } = await toClient(page, 400, 100);
    await page.mouse.click(gcx, gcy);
    const winnerBefore = await page.evaluate(() => {
      const sel = document.querySelector('.selected');
      return sel ? (sel.classList.contains('gradient-block') ? 'gradient' : 'text') : 'none';
    });
    await page.evaluate(() => { document.querySelectorAll('.selected').forEach((el) => el.classList.remove('selected')); document.querySelectorAll('.gradient-block').forEach((el) => el.remove()); });

    // ★진짜 장면 — 2개 추가
    await page.evaluate(() => { window.addGradientBlock(); window.addGradientBlock(); });
    const before = await page.evaluate(() => [...document.querySelectorAll('.gradient-block')].map((b) => b.id));
    expect(before.length).toBe(2);

    // ★둘째(=insert-select 가 고른 최근 추가)를 ★진짜 마우스로 스냅임계(40 섹션-로컬px) 밖 · 첫째와도
    // 안 겹치는 자리(y=400, 첫째[40,340] 과 분리)로 끈다.
    const start = await toClient(page, 10, 64 + 5);
    const end = await toClient(page, 10, 69 + (400 - 64));
    await page.mouse.move(start.cx, start.cy);
    await page.mouse.down();
    await page.mouse.move(end.cx, end.cy, { steps: 10 });
    await page.mouse.up();

    const after = await page.evaluate(() => [...document.querySelectorAll('.gradient-block')].map((b) => ({ id: b.id, x: Number(b.dataset.x), y: Number(b.dataset.y) })));
    expect(errs).toEqual([]);
    // ★주 단언 ⑴ — 겹치지 않는다
    const [a, b] = after;
    const overlapY = Math.max(0, Math.min(a.y + 300, b.y + 300) - Math.max(a.y, b.y));
    expect(overlapY).toBe(0);

    // ★주 단언 ⑵ — 첫째(안 옮긴 블록)의 노출 지점에서 쌓임 승자가 G-N0 실측과 같다
    const first = await page.evaluate(() => document.querySelectorAll('.gradient-block')[0]);
    const { cx, cy } = await toClient(page, 400, 100);
    await page.mouse.click(cx, cy);
    const winnerAfter = await page.evaluate(() => {
      const sel = document.querySelector('.selected');
      if (!sel) return 'none';
      return sel.classList.contains('gradient-block') ? 'gradient' : sel.classList.contains('text-block') ? 'text' : 'other';
    });
    console.log('[G-NEW-a 실측]', JSON.stringify({ winnerBefore, winnerAfter }));
    expect(winnerAfter).toBe(winnerBefore);   // ★G-N0 이 실측한 그 값과 같다(미리 「글자 위/아래」를 적지 않는다)
  });

  test('G-NEW-snap 양성(사실 기록, ⛔버그 아님) — 임계(40px) 안에서 끌면 다시 붙는다', async ({ page }) => {
    const errs = await boot(page);
    await page.evaluate(() => { window.addGradientBlock(); window.addGradientBlock(); });
    const start = await toClient(page, 10, 64 + 5);
    const end = await toClient(page, 10, 64 + 5 - 20);   // ★첫째 쪽으로 20px(<임계 40px) — 자석이 다시 붙는 방향
    await page.mouse.move(start.cx, start.cy);
    await page.mouse.down();
    await page.mouse.move(end.cx, end.cy, { steps: 5 });
    await page.mouse.up();
    const ys = await page.evaluate(() => [...document.querySelectorAll('.gradient-block')].map((b) => Number(b.dataset.y)));
    expect(errs).toEqual([]);
    // ★사실 기록 — 임계 안이라 자석이 첫째 변에 다시 붙는다(동일변 정렬 스냅, js/gradient-select.js:179-183)
    expect(ys[1]).toBe(ys[0]);
  });
});
