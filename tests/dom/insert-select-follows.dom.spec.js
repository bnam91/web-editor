/* insert-select-follows.dom.spec.js — 「블럭을 넣으면 파란 선택 표시와 우측 패널이 «새 블럭»으로
 *   따라오는가」를 삽입 입구 «전부»에 대해 잠근다. (2026-09-22 T-084 후속)
 *
 * ★왜 필요한가
 *   T-084 1차 고침(4693c0d)은 js/block-edit.js 의 selectBlock 을 고쳤고,
 *   tests/dom/select-block-submarks.dom.spec.js 가 그 자리를 잠갔다.
 *   ⛔그런데 그건 «selectBlock 을 부르는 입구»에만 닿는다. 앱 실측(9639, 2026-09-22):
 *     삽입 입구 41자리 중 12자리가 새 블럭을 «아예 안 골랐다»
 *     (addAssetBlock·addGapBlock·addGradientBlock·addIconCircleBlock·addIconTextBlock·
 *      addIconifyBlock·addJokerBlock·addLabelGroupBlock·addLinerBlock·addMockupBlock·
 *      addSpeechBubbleBlock·addVectorBlock).
 *   ⇒ 입구마다 한 줄씩 더 적는 대신 js/insert-select.js 가 «로스터»로 한 번에 감싼다.
 *     이 스펙은 그 «모양»을 잰다 — 새 입구가 생겨도 이름만 규칙에 맞으면 저절로 걸린다.
 *
 * ★★음성대조 3벌이 이 스펙의 핵심이다 — 화석을 베끼지 않고 «지금 소스»에서 변형본을 만든다.
 *     N1 = 선택 옮기기를 «안» 하던 dev 모양            ⇒ S1 이 실제로 빨강
 *     N2 = 규약 ②(입구가 이미 골랐으면 손 안 댐) 제거  ⇒ S2 가 실제로 빨강
 *     N3 = getBlockById 를 옛 모양(dataset.type 만)으로 ⇒ S5 가 실제로 빨강
 *
 * ⛔앱을 «안» 띄운다 — 레포 파일만 크로미움에 얹는다(select-block-submarks 하네스 복제).
 * ⛔사본을 두지 않는다 — clearSelectionMarks/highlightBlock 은 «실물 소스»에서 떠 온다.
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js insert-select-follows
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };
const read = (p) => fs.readFileSync(path.join(REPO, p), 'utf8').replace(/\r\n/g, '\n');

/** 실물 소스에서 함수 하나를 중괄호 균형으로 떠 온다(사본을 두지 않기 위함). */
function extractFn(src, name) {
  const m = new RegExp('function\\s+' + name + '\\s*\\(').exec(src);
  if (!m) throw new Error('★함수를 못 찾았다: ' + name + ' — 이름이 바뀌었으면 이 검사부터 고쳐라');
  let i = m.index + m[0].length - 1, d = 0;
  for (; i < src.length; i++) {
    if (src[i] === '(') d++;
    else if (src[i] === ')') { d--; if (d === 0) { i++; break; } }
  }
  while (i < src.length && src[i] !== '{') i++;
  let b = 0;
  for (; i < src.length; i++) {
    if (src[i] === '{') b++;
    else if (src[i] === '}') { b--; if (b === 0) { i++; break; } }
  }
  return src.slice(m.index, i);
}

const EDITOR_SRC = read('js/editor.js');
const LAYER_SRC  = read('js/panels/layer-panel.js');
const IS_SRC     = read('js/insert-select.js');
const BE_SRC     = read('js/block-edit.js');

/* ── 음성대조본 ① — 선택 옮기기를 «안» 하던 dev 모양 ─────────────────────── */
const IS_N1 = (() => {
  const line = '          try { _followSelection(before); }';
  if (!IS_SRC.includes(line)) throw new Error('N1 변환이 늙었다 — 선택 옮기기 호출 줄을 못 찾았다');
  return IS_SRC.replace(line, '          try { /* N1: 선택 옮기기 없음(dev) */ }');
})();

/* ── 음성대조본 ② — 규약 ②(입구가 이미 «새 것»을 골랐으면 손 안 댄다) 제거 ── */
const IS_N2 = (() => {
  const line = '      if (newcomers[i].classList && newcomers[i].classList.contains(\'selected\')) return;';
  if (!IS_SRC.includes(line)) throw new Error('N2 변환이 늙었다 — 규약 ② 가드를 못 찾았다');
  return IS_SRC.replace(line, '      /* N2: 규약 ② 없음 — 프레임·섹션 규약을 덮어쓴다 */');
})();

/* ── 음성대조본 ③ — getBlockById 를 «옛 모양»(dataset.type 만)으로 ──────── */
const BE_N3 = (() => {
  const line = '  const isBlockEl = looksBlock && (!!el.dataset?.type || window.hasPanelForBlock?.(el) === true);';
  if (!BE_SRC.includes(line)) throw new Error('N3 변환이 늙었다 — getBlockById 판정 줄을 못 찾았다');
  return BE_SRC.replace(line, '  const isBlockEl = looksBlock && !!el.dataset?.type;   /* N3: 옛 모양 */');
})();

const SHIM = `
  var canvasEl = document.getElementById('canvas');
  function _setAttrIfChanged(el, name, value) { if (el.getAttribute(name) !== value) el.setAttribute(name, value); }
  ${extractFn(EDITOR_SRC, 'clearSelectionMarks')}
  ${extractFn(LAYER_SRC, 'highlightBlock')}
  window.clearSelectionMarks = clearSelectionMarks;
  window.highlightBlock = highlightBlock;

  /* 우측 패널 «잎»만 스텁 — 라우팅(표)은 진짜 js/panel-dispatch.js 가 한다.
     여기서 재는 것은 「어느 패널이 열렸나」이므로 잎은 기록만 한다. */
  window.__panel = null;
  ['showAssetProperties','showDividerProperties','showTextProperties','showGapProperties',
   'showLabelGroupProperties','showVectorProperties','showMockupProperties','showShapeProperties']
    .forEach(function (k) { window[k] = function (el) { window.__panel = { fn: k, id: el && el.id }; }; });
  window._selectGradient = function (el) { window.__panel = { fn: '_selectGradient', id: el && el.id }; el.classList.add('selected'); };

  /* ── 합성 입구 — 이름이 add*Block 이면 «자동으로» 로스터다(목록을 안 적는다) ──── */
  var _host = function () { return document.getElementById('host'); };
  function _mk(cls, id, type) {
    var d = document.createElement('div');
    d.className = cls; d.id = id;
    if (type) d.dataset.type = type;
    return d;
  }
  /* ⑴ «자기 선택을 안 하는» 입구 — 실측 12자리의 모양 */
  window.addPlainBlock = function (id) {
    var d = _mk('divider-block', id || 'p1', 'divider'); _host().appendChild(d); return d;
  };
  /* ⑵ dataset.type 을 «안 다는» 블럭 — .asset-block·.icon-text-block·.label-group-block 의 모양 */
  window.addTypelessBlock = function (id) {
    var d = _mk('asset-block', id || 't1', null); _host().appendChild(d); return d;
  };
  /* ⑶ 프레임 + 블럭 둘을 만드는 입구 — «잎»을 골라야 한다(addLinerBlock 의 모양) */
  window.addFramedBlock = function () {
    var ss = _mk('frame-block', 'fr1', null);
    var d  = _mk('divider-block', 'fr1_leaf', 'divider');
    ss.appendChild(d); _host().appendChild(ss); return d;
  };
  /* ⑷ 입구가 «프레임»을 스스로 고르는 모양 — 앱의 프레임 규약(addFrameBlock·addShapeBlock) */
  window.addSelfFrameBlock = function () {
    var ss = _mk('frame-block', 'fr2', null);
    var d  = _mk('divider-block', 'fr2_leaf', 'divider');
    ss.appendChild(d); _host().appendChild(ss);
    window.clearSelectionMarks(); ss.classList.add('selected');
    window.__panel = { fn: 'showFrameProperties', id: ss.id };
    return ss;
  };
  /* ⑸ 아무것도 안 넣는 입구 — 섹션 미선택 힌트만 띄우는 모양 */
  window.addSilentBlock = function () { window.__hint = (window.__hint || 0) + 1; };
  /* ⑹ 중첩 — window 경유로 잎을 두 번 부른다(조립자의 모양) */
  window.addNestBlock = function () { window.addPlainBlock('n1'); window.addPlainBlock('n2'); };
  /* ⑺ DOM 을 만진 «뒤» 던지는 입구 */
  window.addThrowBlock = function () { window.addPlainBlock('th1'); throw new Error('boom'); };
`;

function harness({ insertSelect = IS_SRC, blockEdit = BE_SRC } = {}) {
  return `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0">
<div id="canvas">
  <div class="section-block"><div class="section-inner" id="host">
    <div class="row">
      <div class="banner02-block" id="bn2_1" data-type="banner02">
        <div class="bn2-label" data-line-idx="0">라벨</div>
        <div class="bn2-title bn2-line-selected" data-line-idx="1">제목</div>
      </div>
    </div>
  </div></div>
</div>
<div id="layer-panel-body">
  <div class="layer-item active" id="li_bn2">Banner</div>
</div>
<script>${SHIM}</script>
<script src="/js/panel-dispatch.js"></script>
<script>${blockEdit}</script>
<script src="/js/insert-history.js"></script>
<script>${insertSelect}</script>
<script>
  document.getElementById('bn2_1')._layerItem = document.getElementById('li_bn2');
  window.__ready = true;
</script></body></html>`;
}

async function boot(page, opts) {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/__harness.html') return route.fulfill({ contentType: 'text/html', body: harness(opts) });
    const file = path.join(REPO, url.pathname);
    if (!file.startsWith(REPO) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({ contentType: MIME[path.extname(file)] || 'text/plain', body: fs.readFileSync(file) });
  });
  await page.goto(`${ORIGIN}/__harness.html`);
  await page.waitForFunction(() => window.__ready === true);
  return errs;
}

/** 미끼 = 배너 «줄»을 고른 상태(카드 ①). 그 뒤 입구를 부르고 «무엇이 표시돼 있나»를 돌려준다. */
const RUN = ([entry, arg]) => {
  if (typeof window[entry] !== 'function') throw new Error('★합성 입구가 없다: ' + entry);
  const bn2 = document.getElementById('bn2_1');
  window.clearSelectionMarks();
  bn2.classList.add('selected');
  bn2.querySelector('[data-line-idx="1"]').classList.add('bn2-line-selected');
  document.getElementById('li_bn2').classList.add('active');
  window.__panel = null;
  const before = {
    marks: [...document.querySelectorAll('#canvas .selected, #canvas .bn2-line-selected')].map(e => e.id || '(배너줄)'),
  };
  let threw = null;
  try { window[entry](arg); } catch (e) { threw = String(e.message || e); }
  return {
    before, threw,
    marks: [...document.querySelectorAll('#canvas .selected, #canvas .bn2-line-selected')].map(e => e.id || '(배너줄)'),
    panel: window.__panel,
    layer: [...document.querySelectorAll('#layer-panel-body .layer-item.active')].map(e => e.id),
  };
};

/* ═══ 고정 장치 ═══════════════════════════════════════════════════════════ */

test('S0 ★로스터를 «베껴 적지 않았다» — insert-select 와 insert-history 의 명부가 같다', async ({ page }) => {
  const errs = await boot(page);
  const got = await page.evaluate(() => ({
    seam: window.__insertSeamRoster(),
    sel: window.__insertSelectRoster(),
  }));
  expect(errs).toEqual([]);
  expect(got.sel).toEqual(got.seam);
  // 합성 입구가 «자동으로» 걸렸다 = 새 입구가 생겨도 저절로 덮인다
  expect(got.sel).toContain('addPlainBlock');
  expect(got.sel).toContain('addFramedBlock');
});

test('S0b ★«나중에 생긴» 입구도 재설치하면 저절로 로스터다 (목록이 안 썩는다)', async ({ page }) => {
  const errs = await boot(page);
  const got = await page.evaluate(() => {
    window.addBrandNewBlock = function () {
      const d = document.createElement('div');
      d.className = 'divider-block'; d.id = 'brand1'; d.dataset.type = 'divider';
      document.getElementById('host').appendChild(d); return d;
    };
    window.__insertSeamInstall(); window.__insertSelectInstall();
    const inRoster = window.__insertSelectRoster().includes('addBrandNewBlock');
    window.clearSelectionMarks();
    document.getElementById('bn2_1').classList.add('selected');
    window.addBrandNewBlock();
    return { inRoster, marks: [...document.querySelectorAll('#canvas .selected')].map(e => e.id) };
  });
  expect(errs).toEqual([]);
  expect(got.inRoster).toBe(true);
  expect(got.marks).toEqual(['brand1']);
});

/* ═══ 행동 ════════════════════════════════════════════════════════════════ */

test('S1 ★«자기 선택을 안 하는» 입구로 넣어도 새 블럭만 표시되고 패널이 따라온다 (카드 ③④⑤)', async ({ page }) => {
  const errs = await boot(page);
  const got = await page.evaluate(RUN, ['addPlainBlock', 'p1']);
  expect(errs).toEqual([]);
  expect(got.before.marks).toEqual(['bn2_1', '(배너줄)']);   // 전제: 넣기 «전»엔 배너 줄이 파랬다
  expect(got.marks).toEqual(['p1']);                          // ★음성대조 지점 N1 — 새 블럭 «하나»뿐
  expect(got.panel).toEqual({ fn: 'showDividerProperties', id: 'p1' });   // ⑤ 우측 패널도 새 블럭 것
  expect(got.layer).toEqual([]);                              // 옛 레이어 강조도 떨어진다
});

test('S2 ★입구가 «이미 새 것»을 골랐으면 손대지 않는다 (프레임·섹션 규약을 안 덮는다)', async ({ page }) => {
  const errs = await boot(page);
  const got = await page.evaluate(RUN, ['addSelfFrameBlock']);
  expect(errs).toEqual([]);
  expect(got.marks).toEqual(['fr2']);                          // ★음성대조 지점 N2 — 프레임 그대로
  expect(got.panel).toEqual({ fn: 'showFrameProperties', id: 'fr2' });
});

test('S3 ★프레임+블럭을 같이 만드는 입구는 «잎»(블럭)을 고른다', async ({ page }) => {
  const errs = await boot(page);
  const got = await page.evaluate(RUN, ['addFramedBlock']);
  expect(errs).toEqual([]);
  expect(got.marks).toEqual(['fr1_leaf']);
  expect(got.panel).toEqual({ fn: 'showDividerProperties', id: 'fr1_leaf' });
});

test('S4 ★아무것도 안 넣은 입구는 선택을 «안» 건드린다 (섹션 미선택 힌트 경로)', async ({ page }) => {
  const errs = await boot(page);
  const got = await page.evaluate(RUN, ['addSilentBlock']);
  expect(errs).toEqual([]);
  expect(got.marks).toEqual(['bn2_1', '(배너줄)']);            // 미끼 그대로 — 멀쩡한 선택을 뺏지 않는다
  expect(got.panel).toBe(null);
});

test('S5 ★dataset.type 이 «없는» 블럭도 표시가 붙는다 (asset·icon-text·label-group)', async ({ page }) => {
  const errs = await boot(page);
  const got = await page.evaluate(RUN, ['addTypelessBlock', 't1']);
  expect(errs).toEqual([]);
  expect(got.marks).toEqual(['t1']);                           // ★음성대조 지점 N3
  expect(got.panel).toEqual({ fn: 'showAssetProperties', id: 't1' });
});

test('S6 ★중첩 조립은 «바깥 한 번»만 고른다 (패널이 블럭마다 깜빡이지 않는다)', async ({ page }) => {
  const errs = await boot(page);
  const got = await page.evaluate(() => {
    window.clearSelectionMarks();
    document.getElementById('bn2_1').classList.add('selected');
    let calls = 0;
    const orig = window.selectBlock;
    window.selectBlock = function (id) { calls++; return orig(id); };
    window.addNestBlock();
    window.selectBlock = orig;
    return { calls, marks: [...document.querySelectorAll('#canvas .selected')].map(e => e.id) };
  });
  expect(errs).toEqual([]);
  expect(got.calls).toBe(1);
  expect(got.marks).toEqual(['n2']);                           // 마지막 잎 하나
});

test('S7 ★입구가 던져도 «넣은 것»은 표시된다 + 예외는 안 삼킨다', async ({ page }) => {
  const errs = await boot(page);
  const got = await page.evaluate(RUN, ['addThrowBlock']);
  expect(errs).toEqual([]);
  expect(got.threw).toBe('boom');                              // 예외는 그대로 위로 간다
  expect(got.marks).toEqual(['th1']);
});

test('S8 ★여러 번 이어 넣어도 «언제나 하나»다 (카드 ⑥)', async ({ page }) => {
  const errs = await boot(page);
  const got = await page.evaluate(() => {
    window.clearSelectionMarks();
    const bn2 = document.getElementById('bn2_1');
    bn2.classList.add('selected');
    bn2.querySelector('[data-line-idx="1"]').classList.add('bn2-line-selected');
    const steps = [];
    ['a1', 'a2', 'a3'].forEach((id) => {
      window.addPlainBlock(id);
      steps.push([...document.querySelectorAll('#canvas .selected, #canvas .bn2-line-selected')].map(e => e.id || '(배너줄)'));
    });
    return steps;
  });
  expect(errs).toEqual([]);
  expect(got).toEqual([['a1'], ['a2'], ['a3']]);
});

/* ═══ 음성대조 — 「통과를 만들어 내는 검사」가 아님을 증명한다 ═════════════ */

test('N1 ★선택 옮기기를 빼면 S1 이 실제로 빨강이 된다 (옛 배너 줄이 그대로 남는다)', async ({ page }) => {
  const errs = await boot(page, { insertSelect: IS_N1 });
  const got = await page.evaluate(RUN, ['addPlainBlock', 'p1']);
  expect(errs).toEqual([]);
  expect(got.marks).toEqual(['bn2_1', '(배너줄)']);            // 새 블럭엔 표시가 «없다» = 카드의 그 증상
  expect(got.panel).toBe(null);
});

test('N2 ★규약 ② 가드를 빼면 S2 가 실제로 빨강이 된다 (프레임 규약을 덮어쓴다)', async ({ page }) => {
  const errs = await boot(page, { insertSelect: IS_N2 });
  const got = await page.evaluate(RUN, ['addSelfFrameBlock']);
  expect(errs).toEqual([]);
  expect(got.marks).toEqual(['fr2_leaf']);                     // 프레임 대신 안쪽 잎을 뺏어 간다
});

test('N3 ★getBlockById 를 옛 모양으로 되돌리면 S5 가 실제로 빨강이 된다', async ({ page }) => {
  const errs = await boot(page, { blockEdit: BE_N3 });
  const got = await page.evaluate(RUN, ['addTypelessBlock', 't1']);
  expect(errs).toEqual([]);
  expect(got.marks).toEqual(['bn2_1', '(배너줄)']);            // .asset-block 은 영영 안 골라진다
  expect(got.panel).toBe(null);
});
