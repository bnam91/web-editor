/* shape-rotate-minheight.dom.spec.js — «패널 값 = 실제 크기»를 회전 경로에서도 지킨다
 *   [0920b-shapesize 후속 · shape-handle-resize.dom.spec.js 의 형제]
 *
 * ★무엇을 재나
 *   형제 스펙(shape-handle-resize)은 «손잡이로 줄인 직후»만 잰다. 그런데 도형 높이를 60 아래로
 *   내려 둔 뒤 «회전»하면 그 잠금이 도로 풀린다 — 패널은 40 인데 화면은 60 이다.
 *
 * ★실측 (2026-09-21, 실앱 포트 9504 · 격리 프로필 /tmp/goditor_0921_shapehandle · 줌 40%)
 *   ① 새 Rectangle → SE 손잡이로 100→60→40  ⇒ {panelH:'40', styleH:'40px', minH:'40px', offsetH:40} ✅
 *   ② 그 상태에서 applyShapeRotation(block,10) ⇒ {panelH:'40', styleH:'40px', minH:'(none)', offsetH:60} ⛔20px 거짓
 *   ③ 회전된 채 패널 H 칸에 30 입력        ⇒ {panelH:'30', styleH:'30px', minH:'(none)', offsetH:60} ⛔30px 거짓
 *      (=회전된 도형은 «높이를 줄일 수 없다»가 그대로 남아 있다 — 손잡이가 아니라 패널로도.)
 *
 * ★뿌리 — inline min-height 를 «지우기만» 한다. 두 자리가 같은 꼴이다:
 *     js/props/prop-shape.js `_updateFrameForRotation`  (패널 applySize → 회전중이면 정리)
 *     js/props/prop-shape.js `applyShapeRotation`       (슬라이더·코너 회전핸들 공용 진입점)
 *   지우면 CSS 바닥 `.frame-block { min-height: 60px }`(css/editor-blocks.css:14)가 되살아난다.
 *   원래 의도는 «구버전이 남긴 부푼 보정값 청소»(회전해도 크기 불변)인데, 지금 코드는 «청소»와
 *   «바닥 해제»를 구분 못 한다 ⇒ 청소한 뒤 자기 높이로 «다시 잠그면» 두 뜻을 다 지킨다.
 *
 * ⚠️정직하게 — 이건 int/0920b 머지가 «만든» 회귀가 아니다(dev 에도 같은 두 줄이 있다).
 *   다만 「패널 H 칸이 화면과 다른 수를 보여준다」(2026-09-21 최종통합 QA medium ③)가
 *   손잡이 경로만 닫아서는 «안 닫힌다»는 것을 위 실측이 보여준다.
 *
 * ⛔앱을 «안» 띄운다 — prop-shape.js 의 두 함수를 _slice-block 으로 떠서 돌린다.
 * 실행: npm run test:dom -- shape-rotate-minheight
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { sliceBlock } = require('../unit/_slice-block.js');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const read = (p) => fs.readFileSync(path.join(REPO, p), 'utf8');
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

const PROP_SRC = read('js/props/prop-shape.js');

/* ── ⓪-a 전제 — «바닥»이 진짜로 CSS 에 있다. 이게 사라지면 아래 R* 가 재는 대상이 없어진다.
   ⛔하드코딩한 60 을 믿지 않는다 — 진짜 파일에서 읽어 하네스에 그대로 싣는다. */
const CSS_SRC = read('css/editor-blocks.css');
const FRAME_RULE = CSS_SRC.match(/\.frame-block\s*\{[\s\S]*?\}/);
if (!FRAME_RULE) throw new Error('⛔css/editor-blocks.css 에서 .frame-block 규칙을 못 찾았다 — 스펙이 늙었다');
const FLOOR = FRAME_RULE[0].match(/min-height:\s*(\d+)px/);
if (!FLOOR) throw new Error('⛔.frame-block 에 min-height 바닥이 없다 — 이 스펙이 재던 대상이 사라졌다');
const FLOOR_PX = parseInt(FLOOR[1]);   // 실측 시점 60

/* ── ⓪-b 전제 — 두 정리 자리가 아직 «그 자리»에 있다. */
const UFR_SRC = sliceBlock(PROP_SRC, 'function _updateFrameForRotation(');
const ASR_SRC = sliceBlock(PROP_SRC, 'export function applyShapeRotation(').replace(/^export\s+/, '');
const RELOCK_SRC = sliceBlock(PROP_SRC, 'function _relockFrameMinHeight(');

/* ── ⓪-c 전제 — «여는 쪽»의 높이 복원 자리(js/io/save-load.js). 이 두 줄만 떠서 돌린다.
   ⛔함수 한 덩이가 아니라 큰 forEach 안의 조각이라 sliceBlock 이 못 뜬다 → 닻으로 집는다. */
const LOAD_SRC = read('js/io/save-load.js');
const LOAD_FIX = LOAD_SRC.match(/const _ssH = parseInt\(ss\.dataset\.height\)[\s\S]*?ss\.style\.minHeight = _ssH \+ 'px';/);
if (!LOAD_FIX) throw new Error('⛔save-load 의 프레임 높이 복원 자리를 못 찾았다 — 스펙이 늙었다');
const LOAD_PRE = LOAD_FIX[0].replace(/\n[^\n]*ss\.style\.minHeight = _ssH \+ 'px';/, '');
/* ⚠️«읽는» 폴백(parseInt(ss.style.minHeight))은 원래 있던 줄이라 남는다 — «쓰는» 줄만 걷혔는지 본다. */
if (/ss\.style\.minHeight\s*=/.test(stripComments(LOAD_PRE))) throw new Error('⛔음성대조본에 minHeight 쓰기 잔재 — 변환이 늙었다');
if (!/ss\.style\.height = _ssH/.test(LOAD_PRE)) throw new Error('⛔음성대조본에서 height 까지 지워졌다 — 변환이 과했다');
for (const [name, src] of [['_updateFrameForRotation', UFR_SRC], ['applyShapeRotation', ASR_SRC]]) {
  if (!/removeProperty\('min-height'\)/.test(stripComments(src))) {
    throw new Error(`⛔${name} 에 min-height 해제가 안 보인다 — 스펙이 늙었다`);
  }
}

/* ── 음성대조본 — «현재» 소스에서 되잠금 줄만 걷는다 = 고치기 «전» 모양.
   ⛔손으로 베껴 두지 않는다(형제 스펙 머리말과 같은 이유 — 베낀 사본은 본문과 따로 늙는다). */
const RELOCK = /\n[^\n]*_relockFrameMinHeight\(frame\);[^\n]*/g;
function toPre(src, newName, oldName) {
  if (!RELOCK.test(src)) throw new Error('⛔되잠금 호출(_relockFrameMinHeight)이 안 보인다 — 픽스가 사라졌거나 변환이 늙었다');
  RELOCK.lastIndex = 0;
  const out = src.replace(RELOCK, '');
  if (/_relockFrameMinHeight\(/.test(stripComments(out))) {
    throw new Error('⛔음성대조본에 되잠금 잔재 — 변환이 늙었다');
  }
  if (!/removeProperty\('min-height'\)/.test(out)) throw new Error('⛔음성대조본에서 청소까지 지워졌다 — 변환이 과했다');
  return out.replace(oldName, newName);
}

const HARNESS_JS = `
let block = null;  /* _updateFrameForRotation 은 클로저의 block 을 본다 → 시나리오가 갈아끼운다 */
window.__setBlock = (b) => { block = b; };
${RELOCK_SRC}
${UFR_SRC.replace('function _updateFrameForRotation(', 'function _ufr(')}
${ASR_SRC}
${toPre(UFR_SRC, 'function _ufrPre(', 'function _updateFrameForRotation(')}
${toPre(ASR_SRC, 'function applyShapeRotationPre(', 'function applyShapeRotation(')}
function _loadFix(ss)    { ${LOAD_FIX[0]} }
function _loadFixPre(ss) { ${LOAD_PRE} }
window.__fns = { ufr: _ufr, ufrPre: _ufrPre, asr: applyShapeRotation, asrPre: applyShapeRotationPre,
                 load: (_b, _d, frame) => _loadFix(frame),
                 loadPre: (_b, _d, frame) => _loadFixPre(frame) };
window.__ready = true;
`;

const BODY = `<div id="canvas"><div class="section-block"><div class="section-inner" id="inner"></div></div></div>`;

async function boot(page) {
  await page.route(`${ORIGIN}/**`, async (route) => {
    const u = new URL(route.request().url());
    if (u.pathname === '/__harness.html') {
      return route.fulfill({
        contentType: 'text/html',
        body: `<!doctype html><html><head><meta charset="utf-8"><style>
          *{margin:0}
          ${FRAME_RULE[0]}                      /* ★진짜 파일에서 그대로 실은 «바닥» */
          .section-inner{width:800px}
          .shape-block{width:100%;height:100%;position:absolute;inset:0}
        </style><script type="module" src="/__harness.js"></script></head><body>${BODY}</body></html>`,
      });
    }
    if (u.pathname === '/__harness.js') return route.fulfill({ contentType: 'application/javascript', body: HARNESS_JS });
    return route.fulfill({ status: 404, body: '' });
  });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(`${ORIGIN}/__harness.html`);
  await page.waitForFunction(() => window.__ready === true);
  return errs;
}

/* which: 'asr'|'asrPre' = 공용 회전 진입점 · 'ufr'|'ufrPre' = 패널 applySize 뒤 정리
   seed: 프레임에 심어 둘 inline 값 {h, minH} — addShapeBlock + 손잡이 리사이즈가 남기는 꼴 */
const SCENARIO = ([which, deg, seed]) => {
  const inner = document.getElementById('inner');
  inner.innerHTML = '';
  const frame = document.createElement('div');
  frame.className = 'frame-block';
  frame.dataset.freeLayout = 'true';
  frame.style.width = '100px';
  if (seed.h) { frame.style.height = seed.h; frame.dataset.height = parseInt(seed.h) + ''; }
  if (seed.minH) frame.style.minHeight = seed.minH;
  const blk = document.createElement('div');
  blk.className = 'shape-block';
  blk.dataset.shapeType = 'rectangle';
  frame.appendChild(blk);
  inner.appendChild(frame);

  const before = { offsetH: frame.offsetHeight, styleH: frame.style.height, minH: frame.style.minHeight };
  const fn = window.__fns[which];
  if (seed.noShape) frame.removeChild(blk);   // «도형이 아닌» 보통 프레임 — 사정거리 가드용
  if (which !== 'ufr' && which !== 'ufrPre') fn(blk, deg, frame);
  else { window.__setBlock(blk); fn(deg); }   // _ufr 은 인자로 블럭을 안 받는다(클로저의 block 을 본다)
  return {
    before,
    styleH: frame.style.height,
    minH: frame.style.minHeight || '(none)',
    offsetH: frame.offsetHeight,
    /* 패널이 보여줄 수 = prop-shape.js `_shapeFrameSize` 와 같은 우선순위(style → dataset → offset) */
    panelH: parseInt(frame.style.height) || parseInt(frame.dataset.height) || frame.offsetHeight,
  };
};

test('R1 ★회전해도 «패널 값 = 화면» — 40px 도형을 10° 돌려도 화면이 40 이다', async ({ page }) => {
  const errs = await boot(page);
  const r = await page.evaluate(SCENARIO, ['asr', 10, { h: '40px', minH: '40px' }]);
  console.log('  R1-head:', r, 'FLOOR=', FLOOR_PX);
  expect(r.before, '하네스 전제 — 손잡이가 40 으로 잠가 둔 상태').toEqual({ offsetH: 40, styleH: '40px', minH: '40px' });
  expect(r.styleH).toBe('40px');
  expect(r.panelH).toBe(40);
  expect(r.offsetH, `★패널은 40 인데 화면이 ${FLOOR_PX} 이면 거짓말이다`).toBe(40);
  expect(errs).toEqual([]);
});

test('R1-pre ★음성대조 — 되잠금을 걷으면 화면이 CSS 바닥으로 튄다', async ({ page }) => {
  const errs = await boot(page);
  const r = await page.evaluate(SCENARIO, ['asrPre', 10, { h: '40px', minH: '40px' }]);
  console.log('  R1-pre:', r);
  expect(r.styleH).toBe('40px');
  expect(r.offsetH, '음성대조 — 고치기 전에는 여기서 바닥으로 튀었다').toBe(FLOOR_PX);
  expect(errs).toEqual([]);
});

test('R2 ★패널 경로(_updateFrameForRotation)도 같다 — 회전된 채 H 를 30 으로 내릴 수 있다', async ({ page }) => {
  const errs = await boot(page);
  const r = await page.evaluate(SCENARIO, ['ufr', 10, { h: '30px', minH: '30px' }]);
  console.log('  R2-head:', r);
  expect(r.panelH).toBe(30);
  expect(r.offsetH, '★applySize 가 잠근 30 을 이 정리 함수가 도로 풀면 안 된다').toBe(30);
  expect(errs).toEqual([]);
});

test('R2-pre ★음성대조 — 패널 경로도 걷어내면 바닥으로 튄다', async ({ page }) => {
  const errs = await boot(page);
  const r = await page.evaluate(SCENARIO, ['ufrPre', 10, { h: '30px', minH: '30px' }]);
  console.log('  R2-pre:', r);
  expect(r.offsetH).toBe(FLOOR_PX);
  expect(errs).toEqual([]);
});

test('R3 ★회전 «해제»(0°)에서도 같다', async ({ page }) => {
  const errs = await boot(page);
  const r = await page.evaluate(SCENARIO, ['asr', 0, { h: '40px', minH: '40px' }]);
  console.log('  R3-head:', r);
  expect(r.offsetH).toBe(40);
  expect(r.panelH).toBe(40);
  expect(errs).toEqual([]);
});

test('R4 ★구버전이 남긴 «부푼» 보정값은 되살아나지 않는다 (청소 의도 유지)', async ({ page }) => {
  const errs = await boot(page);
  // 옛 데이터 꼴: height 40 인데 minHeight 가 200 으로 부풀려져 있다 → 회전하면 «크기가 커진다»는 그 증상
  const r = await page.evaluate(SCENARIO, ['asr', 10, { h: '40px', minH: '200px' }]);
  console.log('  R4-head:', r);
  expect(r.before.offsetH, '하네스 전제 — 부푼 보정값이 살아 있는 상태').toBe(200);
  expect(r.offsetH, '★청소는 그대로 — 자기 높이(40)로만 잠근다').toBe(40);
  expect(r.minH).toBe('40px');
  expect(errs).toEqual([]);
});

test('R5 ★높이를 «안 적은» 프레임은 건드리지 않는다 — 자동 높이는 CSS 바닥 그대로', async ({ page }) => {
  const errs = await boot(page);
  const r = await page.evaluate(SCENARIO, ['asr', 10, { h: '', minH: '' }]);
  console.log('  R5-head:', r);
  expect(r.minH, '★inline 잠금을 «새로» 심지 않는다 — 자동 높이 프레임의 규약은 CSS 가 쥔다').toBe('(none)');
  expect(r.offsetH).toBe(FLOOR_PX);
  expect(errs).toEqual([]);
});

/* ── L* ★«여는 쪽» — 이미 저장된 프로젝트를 다시 열 때도 패널 값 = 화면
 *   실측(실앱 9504, 줌 40%): 회전 뒤 패널로 30 을 넣어 저장된 도형을 reload 하니
 *   {styleH:'30px', minH:'(none)', offsetH:60} — 고친 회전 경로와 무관하게 저장본이 그대로 거짓말했다.
 *   저장본은 canvas innerHTML 통째라 inline min-height 도 실리지만, «없이 저장된 것»은 여는 쪽이 치유해야 한다. */
test('L1 ★저장본을 열 때 — 30px 도형 프레임이 화면에서도 30 이다', async ({ page }) => {
  const errs = await boot(page);
  const r = await page.evaluate(SCENARIO, ['load', 0, { h: '30px', minH: '' }]);
  console.log('  L1-head:', r);
  expect(r.before.offsetH, '하네스 전제 — minHeight 없이 저장된 꼴은 CSS 바닥에 걸려 있다').toBe(FLOOR_PX);
  expect(r.panelH).toBe(30);
  expect(r.offsetH, '★여는 순간 치유 — 패널 30 이면 화면도 30').toBe(30);
  expect(errs).toEqual([]);
});

test('L1-pre ★음성대조 — 치유 줄을 걷으면 열 때마다 바닥에 걸린다', async ({ page }) => {
  const errs = await boot(page);
  const r = await page.evaluate(SCENARIO, ['loadPre', 0, { h: '30px', minH: '' }]);
  console.log('  L1-pre:', r);
  expect(r.panelH).toBe(30);
  expect(r.offsetH).toBe(FLOOR_PX);
  expect(errs).toEqual([]);
});

test('L2 ★사정거리 — «도형이 아닌» 보통 프레임의 60px 바닥은 안 건드린다', async ({ page }) => {
  const errs = await boot(page);
  const r = await page.evaluate(SCENARIO, ['load', 0, { h: '30px', minH: '', noShape: true }]);
  console.log('  L2-head:', r);
  expect(r.minH, '★도형 계약이 없는 프레임엔 잠금을 심지 않는다').toBe('(none)');
  expect(r.offsetH, '보통 프레임(하위 섹션)의 바닥은 의도다 — 그대로 둔다').toBe(FLOOR_PX);
  expect(errs).toEqual([]);
});
