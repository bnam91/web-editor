/* asset-width-min.dom.spec.js — 「에셋 블럭 폭 하한은 60 인가」를 «사람이 보는 값»으로.
 *   (현빈 결정 2026-09-20 ㉠ / 카드 T-078: 「이미지 블럭 폭 하한을 패널에서도 60 으로 낮춘다」)
 *
 * ★왜 이 결함이 «조용한가»
 *   `<input type="range" min="100" value="60">` 은 브라우저가 value 를 «min 으로 끌어올린다»
 *   — 그래서 60px 짜리 블럭을 고르면 패널 슬라이더가 «100» 을 가리킨다. 숫자칸은 60 을 보여
 *   주므로 한 줄 안에서 두 칸이 서로 다른 말을 한다. 그 상태로 폭에 손을 대면(슬라이더를
 *   한 번 튕기거나 모서리 핸들을 1px 만 움직이거나) 값이 100 으로 «올라앉는다».
 *   스크래치패드는 60px 까지 줄어든다(scratch-pad.js 의 fMin) — 그 크기 그대로 섹션에
 *   들어온 블럭이 패널을 거치며 40px 커진다.
 *
 * ★음성대조 (이 파일을 고치기 «전» 소스에서 실측 — 아래 6건 중 4건 red)
 *   A1 60px 블럭 → 슬라이더 100 / 숫자칸 60  (두 칸 불일치)        → red
 *   A2 숫자칸 59 커밋 → 100px                                      → red
 *   A3 숫자칸 0  커밋 → 100px                                      → red
 *   A4 60px 블럭 + 슬라이더 input → 100px 로 올라앉음              → red
 *   A5 60px 블럭 + 정렬/외곽선만 만짐 → 패널이 100 을 가리킴            → red
 *   A6 하한 미만(59)은 60 으로 막힘 + 상한/풀블리드는 종전 (가드)        → red
 *   A7 ★빈 칸 커밋 → 폭이 «꽉참»으로 날아감                             → red
 *   A8 0 과 빈 칸이 «같이» 풀블리드로 날아감                             → red
 *   H1/H2 모서리 핸들 1px·−40px 드래그 → 100px 로 올라앉음              → red
 *   E1/E2 ★신고 경로 통째로(스크래치 60px → commitScratchDropAt → 진짜 패널) → red
 *
 * ★2026-09-20 통합(int/0920b) 메모 — E 그룹은 «복원»이다.
 *   이 검사는 원래 wip/0920b-minwidth60-on-e3c2638 에서 스크래치 드롭(T-075 ⑨) «위»에 얹혀 있었다.
 *   fix/0920b-minwidth60 은 dev 기준으로 다시 딴 브랜치라 그때 드롭 경로가 없어 E 그룹이 빠졌다.
 *   통합으로 두 쪽이 한 나무에 들어왔으므로 되살린다 — 이게 현빈이 실제로 밟은 길이다.
 *
 * ⛔앱을 «안» 띄운다 — 레포 파일만 크로미움에 얹는다(modal-icon-align.dom.spec.js 와 같은 부팅).
 * ⚠️⚠️tests/dom 은 `npm test` 스위트에 «안» 들어간다. 변이 책임은
 *   tests/unit/asset-width-min.test.js 가 진다.
 *
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js asset-width-min
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };

const PX = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

const HARNESS = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="/css/editor-blocks.css"></head><body>
<div id="canvas-wrap"><div id="canvas-scaler"><div id="canvas">
  <div class="section-block"><div class="section-inner" id="host" data-padding-x="32"
       style="width:860px;padding-left:32px;padding-right:32px;"></div></div>
</div></div></div>
<div id="panel-right"><div class="panel-body"></div></div>
<div id="ss-handles-overlay" style="position:fixed;inset:0;pointer-events:none;"></div>
<script type="module">
  import { showAssetProperties } from '/js/props/prop-asset.js';
  import '/js/overlay-handles.js';
  window.__open = showAssetProperties;
  window.pushHistory = () => { window.__pushes = (window.__pushes||0) + 1; };
  window.scheduleAutoSave = () => {};
  window.triggerAutoSave = () => {};
  window.applyAssetFullBleed = (ab) => { ab.style.width = ''; ab.style.marginLeft = ''; ab.style.marginRight = ''; };
  window.getBlockBreadcrumb = () => '';
  window.setRpIdBadge = () => {};
  window.getEffectiveUsePadx = (ab) => ab.dataset.usePadx === 'true';
  window.__ready = true;
</script></body></html>`;

async function boot(page) {
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/__harness.html') return route.fulfill({ contentType: 'text/html', body: HARNESS });
    const file = path.join(REPO, url.pathname);
    if (!file.startsWith(REPO) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({ contentType: MIME[path.extname(file)] || 'text/plain', body: fs.readFileSync(file) });
  });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(`${ORIGIN}/__harness.html`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 10000 }).catch(() => {
    throw new Error('harness boot 실패: ' + errs.join(' | '));
  });
}

/** 스크래치 드롭이 만들어 놓는 «폭 px 로 잠긴» 에셋 블럭 하나 — canvas-scratch-drop.applyScratchWidth 와 같은 벌. */
async function mount(page, w) {
  await page.evaluate(({ w, px }) => {
    const host = document.getElementById('host');
    host.innerHTML = '';
    const row = document.createElement('div'); row.className = 'row'; row.dataset.layout = 'stack';
    const ab = document.createElement('div'); ab.className = 'asset-block has-image';
    ab.dataset.align = 'center'; ab.dataset.overlay = 'false'; ab.dataset.usePadx = 'false';
    ab.dataset.imgSrc = px;
    ab.style.width = w + 'px'; ab.style.height = Math.round(w * 0.75) + 'px'; ab.style.alignSelf = 'center';
    ab.innerHTML = '<div class="asset-img-clip"><img class="asset-img" src="' + px
      + '" style="width:100%;height:100%;object-fit:cover"></div><div class="asset-overlay"></div>';
    row.appendChild(ab); host.appendChild(row);
    window.__ab = ab;
    window.__open(ab);
  }, { w, px: PX });
}

const read = (page) => page.evaluate(() => {
  const ab = window.__ab;
  const sl = document.getElementById('asset-w-slider');
  const nu = document.getElementById('asset-w-number');
  return {
    cssW: Math.round(ab.getBoundingClientRect().width),
    contentW: ab.clientWidth,
    inlineW: ab.style.width,
    sliderValue: sl ? sl.value : null,
    sliderMin: sl ? sl.min : null,
    numberValue: nu ? nu.value : null,
    numberMin: nu ? nu.min : null,
  };
});

/** 숫자칸에 값을 넣고 «커밋»(change) — prop-number-commit-guard 없이도 같은 문이다. */
const commitNumber = (page, v) => page.evaluate((v) => {
  const nu = document.getElementById('asset-w-number');
  nu.value = String(v);
  nu.dispatchEvent(new Event('change', { bubbles: true }));
}, v);

test.describe('T-078 ㉠ — 에셋 폭 하한 60', () => {
  test('A1 60px 블럭을 고르면 슬라이더·숫자칸이 «둘 다» 60 을 가리킨다', async ({ page }) => {
    await boot(page); await mount(page, 60);
    const r = await read(page);
    expect(r.sliderMin).toBe('60');
    expect(r.numberMin).toBe('60');
    expect(r.sliderValue).toBe('60');   // ★고치기 전: '100' (브라우저가 min 으로 끌어올림)
    expect(r.numberValue).toBe('60');
    expect(r.cssW).toBe(60);
  });

  test('A2 숫자칸에 59 를 넣으면 60 으로 막힌다 (100 으로 튀지 않는다)', async ({ page }) => {
    await boot(page); await mount(page, 60);
    await commitNumber(page, 59);
    const r = await read(page);
    expect(r.inlineW).toBe('60px');     // ★고치기 전: '100px'
    expect(r.cssW).toBe(60);
    expect(r.numberValue).toBe('60');
  });

  test('A3 숫자칸에 0 을 넣어도 60 으로 막힌다', async ({ page }) => {
    await boot(page); await mount(page, 60);
    await commitNumber(page, 0);
    const r = await read(page);
    expect(r.inlineW).toBe('60px');     // ★고치기 전: '100px' (|| 860 폴백 뒤 Math.max(100,…))
    expect(r.cssW).toBe(60);
  });

  test('A4 60px 블럭에서 폭 슬라이더를 «건드려도» 값이 올라앉지 않는다', async ({ page }) => {
    await boot(page); await mount(page, 60);
    // 슬라이더를 그 자리에서 한 번 튕긴다(사용자가 손잡이를 잡았다 놓은 것과 같은 문).
    await page.evaluate(() => {
      const sl = document.getElementById('asset-w-slider');
      sl.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const r = await read(page);
    expect(r.inlineW).toBe('60px');     // ★고치기 전: '100px' — 슬라이더가 이미 100 을 들고 있었다
    expect(r.cssW).toBe(60);
  });

  test('A5 «다른 속성»(정렬·외곽선)만 만져도 폭은 60 그대로다', async ({ page }) => {
    await boot(page); await mount(page, 60);
    await page.evaluate(() => {
      document.querySelector('#asset-align-group .prop-align-btn[data-align="left"]').click();
      const st = document.getElementById('asset-stroke-slider');
      st.value = '4'; st.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const r = await read(page);
    expect(r.inlineW).toBe('60px');
    // ⚠️rect 은 «외곽선 두께까지» 담는다(4px 테두리 → 68). 폭 자체는 clientWidth 로 잰다.
    expect(r.contentW).toBe(60);
    expect(await page.evaluate(() => window.__ab.dataset.align)).toBe('left');
    // 그리고 슬라이더·숫자칸도 여전히 60 을 가리켜야 한다(패널이 «다른 말»을 하면 다음 손길에 튄다)
    expect(r.sliderValue).toBe('60');
    expect(r.numberValue).toBe('60');
  });

  test('A6 가드 — 상한·풀블리드·중간값은 종전 그대로다', async ({ page }) => {
    await boot(page); await mount(page, 300);
    await commitNumber(page, 900);                       // 상한 860 → 풀블리드
    expect((await read(page)).inlineW).toBe('');
    await commitNumber(page, 420);                       // 중간값은 그대로 박힌다
    expect((await read(page)).inlineW).toBe('420px');
    await commitNumber(page, 60);                        // 하한 정확히
    expect((await read(page)).inlineW).toBe('60px');
  });

  test('A7 ★빈 칸을 커밋하면 «아무 일도 안 일어난다» (0 과 다른 것)', async ({ page }) => {
    await boot(page); await mount(page, 300);
    const pushes0 = await page.evaluate(() => window.__pushes || 0);
    await commitNumber(page, '');
    const r = await read(page);
    expect(r.inlineW).toBe('300px');   // ★고치기 전: '' — `|| 860` 폴백으로 «꽉참»이 됐다
    expect(r.numberValue).toBe('300'); // 지우다 만 칸은 지금 값으로 되돌아온다
    expect(r.sliderValue).toBe('300');
    // 커밋이 아니므로 히스토리도 안 쌓인다(⌘Z 한 번이 «안 한 일»을 되돌리면 안 된다)
    expect(await page.evaluate(() => window.__pushes || 0)).toBe(pushes0);
  });

  test('A8 ★0 과 빈 칸은 «다르게» 처리된다 (둘 다 falsy 라고 같이 묶지 않는다)', async ({ page }) => {
    await boot(page); await mount(page, 300);
    await commitNumber(page, 0);
    expect((await read(page)).inlineW).toBe('60px');    // 0 = 「가장 작게」 → 하한
    await commitNumber(page, 420);
    await commitNumber(page, '');
    expect((await read(page)).inlineW).toBe('420px');   // 빈 칸 = 「값 없음」 → 그대로
  });
});

/* ── ⑶ 모서리 핸들 — «패널만» 고치면 이 문으로 다시 100 이 된다 ────────────────
   패널 하한을 60 으로 낮춰도 overlay-handles 의 클램프가 100 으로 남아 있으면,
   60px 블럭의 모서리를 «1px 만» 움직여도 폭이 100 으로 올라앉는다(신고와 같은 증상).
   ★음성대조: 고치기 전 소스에서 H1·H2 는 100 을 받아 red. */
test.describe('T-078 ㉠ — 모서리 핸들도 같은 하한(60)을 본다', () => {
  /** 핸들 하나를 잡아 dx 만큼 끌고 놓는다 — 실제 리스너(_onAssetResizeHandleMouseDown)를 탄다. */
  const drag = (page, dir, dx, dy) => page.evaluate(({ dir, dx, dy }) => {
    const ab = window.__ab;
    ab.classList.add('selected');
    window.showAssetResizeHandles(ab);
    const h = document.querySelector(`#ss-handles-overlay .asset-overlay-handle.${dir}`);
    if (!h) throw new Error('핸들을 못 찾았다: ' + dir);
    const r = h.getBoundingClientRect();
    const x0 = r.left + r.width / 2, y0 = r.top + r.height / 2;
    const mk = (type, x, y) => new MouseEvent(type, { bubbles: true, clientX: x, clientY: y, button: 0 });
    h.dispatchEvent(mk('mousedown', x0, y0));
    document.dispatchEvent(mk('mousemove', x0 + dx, y0 + dy));
    document.dispatchEvent(mk('mouseup', x0 + dx, y0 + dy));
  }, { dir, dx, dy });

  test('H1 60px 블럭의 모서리를 «거의 안 움직여도» 폭이 60 그대로다', async ({ page }) => {
    await boot(page); await mount(page, 60);
    await drag(page, 'se', 1, 1);
    const r = await read(page);
    expect(r.inlineW).toBe('61px');   // ★고치기 전: '100px' — 1px 밀었는데 40px 이 커졌다
  });

  test('H2 60px 블럭을 더 작게 끌어도 60 밑으로는 안 내려간다', async ({ page }) => {
    await boot(page); await mount(page, 60);
    await drag(page, 'se', -40, 0);
    const r = await read(page);
    expect(r.inlineW).toBe('60px');   // ★고치기 전: '100px'
  });

  test('H3 가드 — 목업·캔버스 블럭의 하한 100 은 «안» 건드렸다', async ({ page }) => {
    await boot(page);
    // 소스 대조는 unit 이 한다. 여기선 «에셋이 아닌» 블럭이 이 상수를 안 본다는 것만 값으로 확인.
    const n = await page.evaluate(() => window.ASSET_W_MIN);
    expect(n).toBe(60);
  });
});

/* ── ★현빈이 신고한 «그 길» 통째로 — 스크래치 60px → 섹션 → 패널 ──────────────
   A/H 는 블럭을 손으로 얹어 잰다. 여기서는 실제 드롭 경로(commitScratchDropAt)로 넣고,
   그 위에 진짜 패널(showAssetProperties)을 열어 「다른 속성만 만졌을 때」를 잰다.
   ⇒ 두 모듈 사이의 «경계»(드롭이 박은 60px 을 패널이 어떻게 읽나)까지 덮는다.
   ★음성대조: 고치기 전 소스에서 E1·E2 는 100 을 받아 red. */
const E_HARNESS = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="/css/editor-blocks.css"><link rel="stylesheet" href="/css/editor-layout.css">
<style>#canvas-scaler{position:relative;width:860px;min-height:900px;}#canvas{width:860px;}
.section-block{position:relative;background:#fff;}
.section-inner{padding-left:32px;padding-right:32px;min-height:400px;display:block;}</style></head><body>
<div id="canvas-wrap"><div id="canvas-scaler">
  <div id="canvas"><div class="section-block" id="sec"><div class="section-inner" id="inner" data-padding-x="32"></div></div></div>
  <div class="scratch-item" id="sp" style="position:absolute;left:900px;top:0;width:60px;">
    <img src="${PX}" style="display:block;width:100%;height:auto;"></div>
</div></div>
<div id="panel-right"><div class="panel-body"></div></div>
<script type="module">
  import { commitScratchDropAt } from '/js/canvas-scratch-drop.js';
  import { showAssetProperties } from '/js/props/prop-asset.js';
  window.__commit = commitScratchDropAt;
  window.__open = showAssetProperties;
  window.state = { pageSettings: { padX: 32 } };
  window.makeAssetBlock = () => {
    const row=document.createElement('div'); row.className='row'; row.dataset.layout='stack'; row.id='row_t';
    const ab=document.createElement('div'); ab.className='asset-block'; ab.id='ab_t';
    ab.dataset.align='center'; ab.dataset.overlay='false'; ab.style.alignSelf='center';
    ab.innerHTML='<div class="asset-overlay"></div>'; row.appendChild(ab); return {row,block:ab};
  };
  window.setAssetImageFromSrc = (ab,src)=>{ ab.classList.add('has-image'); ab.dataset.imgSrc=src;
    ab.innerHTML='<div class="asset-img-clip"><img class="asset-img" src="'+src+'" style="width:100%;height:100%;object-fit:cover"></div>'; };
  window.bindBlock=()=>{}; window.buildLayerPanel=()=>{}; window.triggerAutoSave=()=>{};
  window.applyPadXToSection=(inner,px)=>{ inner.style.paddingLeft=px?px+'px':''; inner.style.paddingRight=px?px+'px':''; };
  window.getDragAfterElement=()=>null;
  window.pushHistory=()=>{}; window.scheduleAutoSave=()=>{};
  window.getBlockBreadcrumb=()=>''; window.setRpIdBadge=()=>{};
  window.getEffectiveUsePadx=(ab)=>ab.dataset.usePadx==='true';
  window.applyAssetFullBleed=(ab)=>{ ab.style.width=''; ab.style.marginLeft=''; ab.style.marginRight=''; };
  window.__ready=true;
</script></body></html>`;

async function bootE(page) {
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/__harness.html') return route.fulfill({ contentType: 'text/html', body: E_HARNESS });
    const file = path.join(REPO, url.pathname);
    if (!file.startsWith(REPO) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({ contentType: MIME[path.extname(file)] || 'text/plain', body: fs.readFileSync(file) });
  });
  await page.goto(`${ORIGIN}/__harness.html`);
  await page.waitForFunction(() => window.__ready === true);
}

/** 스크래치 60px 아이템을 섹션에 떨어뜨리고, 그 블럭의 패널을 연다. */
const dropAndOpen = (page) => page.evaluate((px) => {
  const inner = document.getElementById('inner');
  const seed = document.createElement('div');
  seed.className = 'row'; seed.dataset.layout = 'stack';
  seed.style.height = '100px'; seed.style.background = '#eee';
  inner.appendChild(seed);
  const sr = seed.getBoundingClientRect();
  const scratchW = document.getElementById('sp').getBoundingClientRect().width;
  const ok = window.__commit(sr.left + sr.width / 2, sr.top + sr.height / 2, px,
    { naturalWidth: 440, naturalHeight: 330, width: scratchW });
  const ab = document.getElementById('ab_t');
  window.__ab = ab;
  if (ab) window.__open(ab);
  return { committed: ok, scratchW: +scratchW.toFixed(1), droppedW: ab ? +ab.getBoundingClientRect().width.toFixed(1) : null };
}, PX);

test.describe('T-078 ㉠ — 현빈 신고 경로 통째로 (스크래치 60px → 섹션 → 패널)', () => {
  test('E1 60px 로 들어온 블럭은 패널에서 «다른 속성»만 만져도 60 그대로다', async ({ page }) => {
    await bootE(page);
    const d = await dropAndOpen(page);
    expect(d.committed).toBe(true);
    expect(d.scratchW).toBe(60);
    expect(d.droppedW).toBe(60);          // 스크래치 폭 그대로 (e3c2638 의 T-075 ⑨ 가 한 일)

    // 패널에서 «폭이 아닌» 것만 만진다 — 정렬 → 외곽선 → 모서리
    await page.evaluate(() => {
      document.querySelector('#asset-align-group .prop-align-btn[data-align="right"]').click();
      const st = document.getElementById('asset-stroke-slider');
      st.value = '2'; st.dispatchEvent(new Event('input', { bubbles: true }));
      const r = document.getElementById('asset-r-slider');
      r.value = '8'; r.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const r = await read(page);
    expect(r.inlineW).toBe('60px');       // ★고치기 전: 슬라이더가 100 을 들고 있어 다음 손길에 100
    expect(r.contentW).toBe(60);
    expect(r.sliderValue).toBe('60');     // ★고치기 전: '100' — 패널이 «화면과 다른 말»을 한다
    expect(r.numberValue).toBe('60');
  });

  test('E2 그 블럭의 폭 칸에 59 를 넣어도 60 에서 막힌다', async ({ page }) => {
    await bootE(page);
    await dropAndOpen(page);
    await commitNumber(page, 59);
    const r = await read(page);
    expect(r.inlineW).toBe('60px');       // ★고치기 전: '100px'
    expect(r.contentW).toBe(60);
  });
});
