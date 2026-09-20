/* canvas-ui-under-panels.dom.spec.js — 0920b-zorder
 *
 * ★현빈 신고: 「bn2_ts0he_nd6fglg 배너블럭을 선택했을 때 파란 선택 아웃라인이 중앙 플로팅
 *   패널(PLUGINS) «위»로 보인다. 다른 블럭도 그럴 것으로 보인다」
 *
 * ★근본원인(실측 확정) — «블럭 타입» 문제가 아니라 «층 하나» 문제다.
 *   선택 아웃라인·리사이즈 핸들·스마트가이드는 전부 단 하나의 뷰포트 고정 층
 *   #ss-handles-overlay(position:fixed; z-index:9990) 에 그려진다(js/selection-overlay.js,
 *   js/overlay-handles.js, js/smart-guides.js, js/gradient-select.js …). 그 층의 조상
 *   #canvas-area 에 스태킹 컨텍스트가 없어서 9990 이 «앱 전체»와 경쟁했고, z-index 가
 *   9990 보다 낮은 플로팅 패널 12종이 전부 그 아래로 깔렸다.
 *   ⇒ 선택된 블럭이 무엇이든 결과가 같다. 변수는 «블럭 타입»이 아니라 «어느 패널이냐».
 *
 * ★고침: css/editor-canvas.css #canvas-area { isolation: isolate; } 한 줄.
 *   패널 z-index 는 하나도 안 건드렸다(#fp-plugin-panel 의 499 포함).
 *   ⛔contain:paint 로 바꾸면 안 된다 — G5 가 그걸 잡는다(fixed 자손의 컨테이닝 블록이 바뀜).
 *
 * ⛔앱을 «안» 띄운다 — 실제 css/*.css 를 route 로 먹여 진짜 elementsFromPoint 를 잰다.
 *   정본 패턴 = tests/dom/overlay-zindex-hittest.dom.spec.js.
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js canvas-ui-under-panels
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const CSS_FILES = [
  'editor-base.css', 'editor-canvas.css', 'editor-panels.css', 'editor-blocks.css',
  'editor-toast.css', 'editor-layout.css', 'editor-extra.css', 'assets-panel.css',
  'settings-modal.css',
];
const CSS = CSS_FILES.map((f) => fs.readFileSync(path.join(REPO, 'css', f), 'utf8')).join('\n');

/* ★계측기 주의 — 이 검사는 «히트순서»가 아니라 «페인트순서»를 재는 것이 목적이다.
 *   실제 앱에서 #ss-handles-overlay 는 pointer-events:none, #tpl-browser 는 .open 전까지
 *   none, #editor-toast 는 .show 여도 none 이다. 그대로 두면 elementsFromPoint 가
 *   «안 보이는 것»이 아니라 «안 잡히는 것»을 걸러내 버려서 결함을 못 본다.
 *   ⇒ 모두 히트 가능하게 만든 뒤 잰다. pointer-events 는 페인트순서와 무관하므로
 *   이때의 elementsFromPoint 스택 = 페인트순서(위→아래)다. */
const HARNESS_CSS = `
  html, body { margin: 0; height: 100%; }
  body { display: flex; flex-direction: column; }
  #main { flex: 1; display: flex; overflow: hidden; }
  #panel-left, #panel-right { width: 60px; background: #222; }
  #canvas-scaler { transform: translate(0px, 0px) scale(1); }
  #canvas { height: 2000px; background: #fff; }
  * { pointer-events: auto !important; opacity: 1 !important; transition: none !important; }
`;

const BODY = `
<div id="topbar" style="height:40px"></div>
<div id="main">
  <div class="panel" id="panel-left"></div>
  <div id="canvas-area">
    <div id="canvas-wrap"><div id="canvas-scaler"><div id="canvas">
      <div class="asset-block selected" id="blk" style="position:relative;width:600px;height:300px;background:#eee"></div>
    </div></div></div>
    <!-- ★캔버스 UI 층: 선택 아웃라인·핸들·가이드가 전부 여기 그려진다(블럭 타입 무관) -->
    <div id="ss-handles-overlay"></div>
  </div>
  <div class="panel" id="panel-right"></div>
</div>
<div id="floating-panel"><button class="fp-btn">x</button></div>
<div id="fp-plugin-panel" style="display:block"><div class="fp-plugin-panel-body" style="height:300px"></div></div>
<div id="tpl-browser" class="tpl-browser open" style="display:flex"><div class="tpl-browser-header" style="height:280px">T</div></div>
<div id="color-adjust-panel" style="display:block;position:fixed;left:200px;top:300px;width:200px;height:200px;background:#111"></div>
<div class="comp-shelf-panel" id="shelf" style="display:block;position:fixed;left:200px;top:120px;width:200px;height:120px;background:#111"></div>
<div id="editor-toast" class="show">toast</div>
<div class="anim-modal-overlay" id="animov" style="display:flex;position:fixed;left:700px;top:600px;width:200px;height:150px"></div>
<div class="assets-import-modal-backdrop" id="aimb" style="display:block;position:fixed;left:950px;top:600px;width:200px;height:150px;background:rgba(0,0,0,.5)"></div>
<div class="settings-modal-overlay" id="smo" style="display:flex;position:fixed;left:950px;top:200px;width:200px;height:150px"></div>
<script>
  /* 오버레이 «안»의 두 손님: 선택 테두리 층(js/selection-overlay.js)과 리사이즈 핸들
     (js/overlay-handles.js). 둘 다 #ss-handles-overlay 의 자식이라 층 하나에 얹힌다.
     핸들을 뷰포트 전면으로 깔아 «어디서 재든 캔버스 UI 가 후보에 든다»를 보장한다. */
  const ov = document.getElementById('ss-handles-overlay');
  const layer = document.createElement('div');
  layer.className = 'ss-sel-layer'; layer.id = 'sel';
  layer.style.cssText = 'position:absolute;inset:0;';
  ov.appendChild(layer);
  const h = document.createElement('div');
  h.className = 'asset-overlay-handle'; h.id = 'hdl';
  h.style.cssText = 'position:fixed;left:0;top:0;width:100%;height:100%;';
  ov.appendChild(h);
</script>`;

async function boot(page) {
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/__harness.html') {
      return route.fulfill({
        contentType: 'text/html',
        body: `<!doctype html><html><head><meta charset="utf-8">
          <style>${CSS}</style><style>${HARNESS_CSS}</style></head>
          <body>${BODY}</body></html>`,
      });
    }
    return route.fulfill({ status: 404, body: '' });
  });
  await page.setViewportSize({ width: 1200, height: 800 });
  await page.goto(`${ORIGIN}/__harness.html`);
}

/* 대상 한 자리에서 «패널이 위냐 캔버스 UI 층이 위냐»를 페인트순서로 판정 */
async function paintWinner(page, sel) {
  return page.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el) return { err: 'missing' };
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return { err: 'zero-rect' };
    const x = r.left + Math.min(r.width / 2, 300);
    const y = r.top + Math.min(r.height / 2, 120);
    const stack = document.elementsFromPoint(x, y);
    const selfIdx = stack.findIndex((e) => e === el || el.contains(e));
    const uiIdx = stack.findIndex((e) => e.id === 'hdl' || e.id === 'sel');
    return {
      z: getComputedStyle(el).zIndex,
      selfIdx, uiIdx,
      winner: selfIdx >= 0 && (uiIdx < 0 || selfIdx < uiIdx) ? 'PANEL' : 'CANVAS-UI',
      top: (stack[0] && (stack[0].id || stack[0].className)) || '-',
    };
  }, sel);
}

/* ★표 — «새던» 플로팅 패널들. 숫자는 dev @20e50e3 실측(소스 위치는 주석).
 *   ⛔이 표는 «수정 대상 목록»이 아니다. 고침은 한 줄(#canvas-area 격리)이고,
 *   이 표는 그 한 줄이 «전부»를 덮는지 확인하는 표본일 뿐이다. 새 패널이 생겨도
 *   표에 추가할 필요 없이 자동으로 옳다 — 그게 목록 대신 격리를 택한 이유다. */
const PANELS = [
  { sel: '#color-adjust-panel', z: '420', src: 'editor-panels.css' },
  { sel: '#fp-plugin-panel', z: '499', src: 'editor-toast.css (현빈 신고 화면)' },
  { sel: '#tpl-browser', z: '500', src: 'editor-extra.css' },
  { sel: '#editor-toast', z: '600', src: 'editor-toast.css' },
  { sel: '.comp-shelf-panel', z: '1200', src: 'editor-extra.css' },
  { sel: '.anim-modal-overlay', z: '9000', src: 'editor-extra.css' },
  { sel: '.assets-import-modal-backdrop', z: '9000', src: 'assets-panel.css' },
];

test('G0 전제 — 캔버스 UI 층과 패널이 화면에서 실제로 겹친다(안 겹치면 아래 검사는 아무것도 안 본다)', async ({ page }) => {
  await boot(page);
  const rows = await page.evaluate((sels) => {
    const ov = document.getElementById('ss-handles-overlay').getBoundingClientRect();
    return sels.map((s) => {
      const el = document.querySelector(s);
      const r = el.getBoundingClientRect();
      return {
        s,
        visible: r.width > 0 && r.height > 0,
        overlap: ov.left < r.right && ov.right > r.left && ov.top < r.bottom && ov.bottom > r.top,
      };
    });
  }, PANELS.map((p) => p.sel));
  for (const row of rows) {
    expect(row.visible, `${row.s} 가 화면에 0x0 이다 — 계측 불가`).toBe(true);
    expect(row.overlap, `${row.s} 가 캔버스 UI 층과 안 겹친다 — 이 검사가 헛돈다`).toBe(true);
  }
});

test('G1 ★핵심 — 플로팅 패널 자리에서 «패널»이 캔버스 UI 층보다 위로 그려진다 (표 구동)', async ({ page }) => {
  await boot(page);
  const bad = [];
  for (const p of PANELS) {
    const r = await paintWinner(page, p.sel);
    if (r.err) { bad.push(`${p.sel}: ${r.err}`); continue; }
    if (r.winner !== 'PANEL') {
      bad.push(`${p.sel} (z=${r.z}, ${p.src}) — 캔버스 UI 층이 위다(top=${r.top}). 선택 아웃라인/핸들이 패널을 덮는다`);
    }
  }
  expect(bad.join('\n'), `#canvas-area 격리가 빠졌거나 무력화됐다:\n${bad.join('\n')}`).toBe('');
});

test('G2 무회귀(대조군) — 캔버스 «내용» 위에서는 여전히 캔버스 UI 층이 위다', async ({ page }) => {
  // ★이게 빠지면 「전부 아래로 내려버리기」(오버레이 z 를 낮추는 오답)가 통과한다.
  await boot(page);
  const r = await page.evaluate(() => {
    const el = document.getElementById('blk');
    const b = el.getBoundingClientRect();
    const x = b.left + b.width / 2, y = b.top + b.height / 2;
    const stack = document.elementsFromPoint(x, y);
    const blkIdx = stack.findIndex((e) => e === el || el.contains(e));
    const uiIdx = stack.findIndex((e) => e.id === 'hdl' || e.id === 'sel');
    return { blkIdx, uiIdx };
  });
  expect(r.uiIdx, '캔버스 UI 층이 스택에 아예 없다 — 계측기가 고장났다').toBeGreaterThanOrEqual(0);
  expect(r.blkIdx, '캔버스 블럭이 스택에 없다').toBeGreaterThanOrEqual(0);
  expect(r.uiIdx < r.blkIdx, '캔버스 블럭 위에서 선택 아웃라인/핸들이 블럭 «아래»로 깔렸다 — 선택 UI 가 안 보인다').toBe(true);
});

test('G3 [음성대조] 격리를 런타임에 지우면 G1 이 빨강이 된다 (이 검사가 그 결함을 겨눈다는 증거)', async ({ page }) => {
  await boot(page);
  await page.addStyleTag({ content: '#canvas-area { isolation: auto !important; }' });
  const leaked = [];
  for (const p of PANELS) {
    const r = await paintWinner(page, p.sel);
    if (!r.err && r.winner !== 'PANEL') leaked.push(p.sel);
  }
  expect(leaked.length, '격리를 지워도 아무 패널도 안 샌다 — G1 이 이 결함을 못 본다는 뜻(계측기 무효)').toBe(PANELS.length);
});

test('G4 ★블럭 타입 무관 — 어느 타입을 선택해도 같은 층에 그려진다(타입별 목록이 아니다)', async ({ page }) => {
  // js/selection-overlay.js 의 _collect() 는 '.selected' 만 본다(블록 이름 목록 없음).
  // 여기서는 그 «구조적 사실»을 검사한다: 타입이 달라도 아웃라인은 #ss-handles-overlay 안이고,
  // 따라서 G1 의 판정이 33개 블럭 타입 전부에 그대로 적용된다.
  await boot(page);
  const TYPES = ['banner02-block', 'text-block', 'shape-block', 'grid-block', 'modal-block',
    'asset-block', 'frame-block', 'sticker-block', 'gradient-block', 'icon-block'];
  const rows = await page.evaluate((types) => {
    const canvas = document.getElementById('canvas');
    const ov = document.getElementById('ss-handles-overlay');
    const out = [];
    for (const t of types) {
      canvas.querySelectorAll('.__probe').forEach((n) => n.remove());
      ov.querySelectorAll('.__probe-outline').forEach((n) => n.remove());
      const b = document.createElement('div');
      b.className = `${t} selected __probe`;
      b.style.cssText = 'position:relative;width:400px;height:120px;background:#ddd';
      canvas.appendChild(b);
      // selection-overlay 가 하는 일과 같은 모양: 오버레이 층에 사각 하나를 그린다
      const r = b.getBoundingClientRect();
      const box = document.createElement('div');
      box.className = 'ss-sel-box __probe-outline';
      box.style.cssText = `position:fixed;left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;`;
      ov.appendChild(box);
      const panel = document.getElementById('fp-plugin-panel');
      const pr = panel.getBoundingClientRect();
      const x = pr.left + pr.width / 2, y = pr.top + Math.min(pr.height / 2, 120);
      const stack = document.elementsFromPoint(x, y);
      const pIdx = stack.findIndex((e) => e === panel || panel.contains(e));
      const uIdx = stack.findIndex((e) => e.id === 'hdl' || e.id === 'sel' || e.classList.contains('__probe-outline'));
      out.push({ t, winner: pIdx >= 0 && (uIdx < 0 || pIdx < uIdx) ? 'PANEL' : 'CANVAS-UI' });
    }
    return out;
  }, TYPES);
  const leaked = rows.filter((r) => r.winner !== 'PANEL').map((r) => r.t);
  expect(leaked.join(','), `이 블럭 타입들의 선택 UI 가 패널을 덮는다: ${leaked.join(', ')}`).toBe('');
});

test('G5 ★오답 방어 — 격리 전후로 #ss-handles-overlay 의 고정 기하가 [0,0,vw,vh] 로 같다', async ({ page }) => {
  // ⛔contain:paint / transform / filter / will-change 로 «격리»를 흉내내면 fixed 자손의
  //   컨테이닝 블록이 바뀌어 층이 잘린다(실측: [0,40,1200,760]). 그 오답을 여기서 잡는다.
  await boot(page);
  const now = await page.evaluate(() => {
    const r = document.getElementById('ss-handles-overlay').getBoundingClientRect();
    return { r: [r.left, r.top, r.width, r.height], pos: getComputedStyle(document.getElementById('ss-handles-overlay')).position };
  });
  expect(now.pos).toBe('fixed');
  expect(now.r, `오버레이 층이 뷰포트 전체를 안 덮는다: ${JSON.stringify(now.r)} — #canvas-area 에 contain/transform/filter 류가 들어간 것으로 의심`).toEqual([0, 0, 1200, 800]);

  // 양성대조: contain:paint 를 실제로 넣으면 «빨강»이 되는지 확인(이 검사가 겨누는 대상 증명)
  await page.addStyleTag({ content: '#canvas-area { contain: paint !important; }' });
  const broken = await page.evaluate(() => {
    const r = document.getElementById('ss-handles-overlay').getBoundingClientRect();
    return [r.left, r.top, r.width, r.height];
  });
  expect(broken, 'contain:paint 로도 기하가 안 변한다 — G5 가 아무것도 안 지킨다는 뜻').not.toEqual([0, 0, 1200, 800]);
});

test('G6 [보조·입구검사] CSS 소스에 #canvas-area 격리 선언이 실재한다', async () => {
  // ★본검사는 위의 DOM 검사다. 이건 «왜 통과했는지»를 사람이 1초에 읽게 하는 보조 검사일 뿐.
  // ★주석을 먼저 지운다 — 이 규칙의 주석은 «⛔contain 금지» 를 «글자로» 담고 있어서,
  //   주석을 안 지우면 아래 contain 검사가 자기 경고문에 걸려 거짓 빨강이 난다(실측).
  const src = fs.readFileSync(path.join(REPO, 'css/editor-canvas.css'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '');
  const rule = src.match(/#canvas-area\s*\{[^}]*\}/);
  expect(rule, '#canvas-area 규칙을 못 찾았다').toBeTruthy();
  expect(/isolation:\s*isolate/.test(rule[0]), '#canvas-area 에 isolation:isolate 가 없다').toBe(true);
  expect(/contain:\s*(paint|strict|content)/.test(rule[0]), '⛔#canvas-area 에 contain 이 들어갔다 — fixed 층이 잘린다(G5 참고)').toBe(false);
});
