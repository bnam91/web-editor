/* grid-newline-font.dom.spec.js — ★㉡ 「그리드 칸에 ★새로 추가하는 글자 줄」의 기본 글꼴 (2026-10-07)
 *
 * ★현빈 원문(정본):
 *   「섹션에 신규로 모달블럭을 추가할떄를 말한거임. 우측패널에 기본 서체가 기본(시스템)으로 나오거든?
 *     ★이외 그리드 블럭에 텍스트 줄을 추가해도 기본(시스템)으로 나온다.
 *     근데 그냥 섹션에 ★텍스트 블럭을 추가하면 ★프리텐다드로 되어있잖아? ★그렇게 되길 원해
 *     ★모달이나 ★그리드블럭의 텍스트 줄」
 *   ⇒ ㉠ 모달 = tests/dom/modal-font.dom.spec.js · ㉡ ★그리드 줄 = ★이 파일.
 *
 * ★여섯 칸이 ★각각 ★무엇을 막나
 *   G-PRE    ★전제만 모은 칸 — ⛔이 칸이 SKIP/빨강이면 ★아래 다섯의 초록은 ★아무것도 증명 못 한다
 *   G-NEW    ★T 단축키로 새로 넣은 글자 줄 = ★텍스트블럭과 ★같은 판에서 ★같은 글꼴 ＋ ★패널 라벨
 *   G-KIND   ★줄 ★종류별 — ⛔「글자 줄에만」을 ★손으로 적은 표가 아니라 ★렌더러에게 물어 ★견준다
 *   G-OLD    ★음성대조 — ★저장본으로 되살아난 «옛 줄»은 ★한 글자도 안 움직인다
 *   G-GATE   ★박는 값이 ★렌더러의 검문 자(`GRID_FONT_RE`)를 ★통과한다(＋그 자가 ★항등식이 아님)
 *   G-RULER  ★그 이름이 «진짜 먹나»는 ★폭으로만 안다 — ⛔이름이 틀리면 ★에러 없이 폴백한다
 *
 * ★G-RULER 영점(실측 2026-10-07 · 100px 같은 글자 폭): 'Pretendard' ★828.33 / 가짜 이름 778.91 / sans-serif 778.91
 *   ⛔`'Noto Sans KR'` 은 ★이 기계에 ★없어서 가짜 이름과 ★폭이 같다 — ★단언에 쓰지 않는다(한 환경에서만 참인 검사 금지).
 *
 * 실행: npm run test:dom -- grid-newline-font
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

/* ★패널이 «사람에게» 보여주는 글꼴 이름 — ⛔dataset 만 재지 마라.
   `_font-picker.js` 가 `.font-picker-current` 에 쓴다. 빈 값이면 ★「기본 (시스템)」 —
   ★현빈이 ★증상으로 지목한 ★그 글자다. */
const PANEL_FONT = `() => {
  const el = document.querySelector('.font-picker-current');
  return el ? { id: el.id, label: el.textContent.trim() } : null;
}`;

/* ★폭 자 — 같은 글자를 ★그 스택으로 그려 ★가짜 이름과 ★견준다.
   ★한 판 안에서 ★둘을 같이 재야 한다(기계·버전마다 절대폭이 다르다 ⇒ ★차이만 쓴다). */
const WIDTH_PROBE = `(stack) => {
  const s = document.createElement('span');
  s.style.cssText = 'position:absolute;left:-9999px;top:0;font-size:100px;white-space:pre;font-family:' + stack;
  s.textContent = 'Wig한글기준 12345';
  document.body.appendChild(s);
  const w = s.getBoundingClientRect().width;
  s.remove();
  return Math.round(w * 100) / 100;
}`;

/** 빈 섹션 하나 + 그리드 블럭 하나. ★앱이 «사람이 밟는 길»을 그대로 밟는다(addGridBlock). */
async function setup(page) {
  await page.setViewportSize({ width: 1700, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(() => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend',
      '<div class="section-block" data-section="1" id="sec1"><div class="section-hitzone"></div>'
      + '<div class="section-inner" id="inner1"></div></div>');
    window.rebindAll?.();
    document.getElementById('sec1').classList.add('selected');
    const made = window.addGridBlock?.({});
    window.__g = (made && made.block) || document.querySelector('#inner1 .grid-block');
    window.__g?.classList.add('selected');
  });
  await page.waitForTimeout(200);
  return errs;
}

/* ══ G-PRE ★전제만 모은 칸 ════════════════════════════════════════════════
   ⛔아래 다섯 칸의 전제를 ★그 칸들 안에 섞어 두지 않는다 — 한 칸이 SKIP 되면
     ★형제 단언까지 같이 먹는다(지디 조건). 여기가 빨강이면 ★나머지 초록은 무효다. */
test('G-PRE ★전제 — 앱·블럭·패널·정본(텍스트블럭)이 선다', async ({ page }) => {
  const errs = await setup(page);
  const pre = await page.evaluate(({ panelSrc }) => {
    const panelFont = eval(panelSrc);
    const g = window.__g;
    const out = { hasGrid: !!(g && g.isConnected), hasRender: typeof window.renderGridBlock === 'function',
                  hasModel: typeof window.getGridModel === 'function', hasAddLine: typeof window.grdAddLineToSelectedCell === 'function' };
    // ★정본 — 「그냥 섹션에 텍스트 블럭을 추가하면 프리텐다드」
    document.getElementById('sec1').classList.add('selected');
    window.addTextBlock?.({});
    const tb = document.querySelector('#inner1 .text-block');
    const tc = tb && (tb.querySelector('[contenteditable]') || tb.firstElementChild);
    out.textInline = tc ? tc.style.fontFamily : null;
    if (tb) window.showTextProperties?.(tb);
    out.textPanel = panelFont();
    // ★줄 종류 명부 — ★정의 자리에서 뜬 것(`_GRD_KINDS = Object.keys(GRID_ROLES) + image·gap·divider`)을
    //   패널 select 가 그대로 그린다. ⛔여기서 손으로 세지 않는다.
    if (g) { g.classList.add('selected'); window.grdSetActiveLine?.(g, { r: 0, c: 0, li: 0 }); window.showGridProperties?.(g); }
    const sel = document.getElementById('grd-line-add-kind');
    out.kinds = sel ? [...sel.options].map(o => o.value).filter(Boolean) : null;
    out.gridPanel = panelFont();
    return out;
  }, { panelSrc: PANEL_FONT });
  console.log(`  G-PRE 텍스트블럭 inline=${JSON.stringify(pre.textInline)} panel=${JSON.stringify(pre.textPanel)}`);
  console.log(`  G-PRE 줄 종류 명부(${pre.kinds ? pre.kinds.length : 'null'})=${JSON.stringify(pre.kinds)} · 그리드 패널=${JSON.stringify(pre.gridPanel)}`);

  expect(pre.hasGrid, '전제: addGridBlock 이 블럭을 안 돌려줬다 / DOM 에 없다').toBe(true);
  expect(pre.hasRender, '전제: window.renderGridBlock 이 없다 — 「옛 줄」을 되살리는 문을 못 밟는다').toBe(true);
  expect(pre.hasModel, '전제: window.getGridModel 이 없다 — 줄 데이터를 못 읽는다').toBe(true);
  expect(pre.hasAddLine, '전제: window.grdAddLineToSelectedCell 이 없다 — T 단축키 길을 못 밟는다').toBe(true);
  expect(pre.textInline, '전제: ★정본인 「새 텍스트블럭」이 글꼴을 안 갖고 태어난다 — 견줄 대상이 없다').toBeTruthy();
  expect(pre.textPanel, '전제: 텍스트 패널에 폰트 줄이 없다').not.toBeNull();
  expect(pre.gridPanel, '전제: 그리드 패널에 폰트 줄이 없다 — 패널 라벨을 못 잰다').not.toBeNull();
  expect(pre.kinds, '전제: 패널 「+ 줄 추가」 select 를 못 찾았다 — 종류를 정의 자리에서 못 센다').not.toBeNull();
  /* ★수를 ★손으로 박지 않는다 — 「글자 역할 ＋ 그 밖 셋」이라는 ★구조만 단언한다.
     역할이 하나 늘면 이 수도 같이 는다(GRID_ROLES 한 곳에서 뜬다). */
  expect(pre.kinds.filter(k => k === 'image' || k === 'gap' || k === 'divider').sort(),
    '전제: 글자 아닌 종류 셋(image·gap·divider)이 명부에 그대로 있나').toEqual(['divider', 'gap', 'image']);
  expect(pre.kinds.length, `전제: 글자 역할이 하나도 없다 — 명부=${JSON.stringify(pre.kinds)}`).toBeGreaterThan(3);
  expect(errs, `pageerror: ${errs[0] || ''}`).toHaveLength(0);
});

/* ══ G-NEW ★주 단언 ══════════════════════════════════════════════════════ */
test('G-NEW ★T 단축키로 새로 넣은 글자 줄 = 「텍스트블럭과 같은 글꼴」 (＋패널 라벨)', async ({ page }) => {
  /* ★★자를 «빌린 수»로 두지 않는다 — `'Pretendard', sans-serif` 를 ★손으로 적으면
       ★체인 규약이 바뀌는 날 ★이 검사가 ★제품보다 먼저 거짓이 된다.
     ⇒ ★★같은 판에서 ★텍스트블럭을 ★같이 만들어 ★그것이 받는 값과 ★견준다. */
  const errs = await setup(page);
  const got = await page.evaluate(({ panelSrc }) => {
    const panelFont = eval(panelSrc);
    const g = window.__g;
    const before = window.getGridModel(g).cells[0][0].lines.length;
    g.classList.add('selected');
    window.grdSetActiveLine?.(g, { r: 0, c: 0, li: 0 });
    const ok = window.grdAddLineToSelectedCell?.('text');     // ★T 단축키가 들어오는 ★그 문
    const lines = window.getGridModel(g).cells[0][0].lines;
    const li = lines.length - 1;
    const el = g.querySelector(`.grd-cell[data-r="0"][data-c="0"] [data-line="${li}"]`);
    const grid = {
      ok, added: lines.length - before, li,
      field: lines[li] ? (lines[li].fontFamily ?? null) : null,
      inline: el ? el.style.fontFamily : null,
      computed: el ? getComputedStyle(el).fontFamily : null,
    };
    window.grdSetActiveLine?.(g, { r: 0, c: 0, li });
    window.showGridProperties?.(g);
    grid.panel = panelFont();

    // ★같은 섹션에 텍스트블럭을 만들어 «그 자리의 값»을 읽는다 — ★같은 판·같은 브라우저 직렬화
    g.classList.remove('selected');
    document.getElementById('sec1').classList.add('selected');
    window.addTextBlock?.({});
    const tb = document.querySelector('#inner1 .text-block');
    const tc = tb && (tb.querySelector('[contenteditable]') || tb.firstElementChild);
    const text = { inline: tc ? tc.style.fontFamily : null, computed: tc ? getComputedStyle(tc).fontFamily : null };
    if (tb) window.showTextProperties?.(tb);
    text.panel = panelFont();
    return { grid, text };
  }, { panelSrc: PANEL_FONT });
  console.log(`  G-NEW 그리드 줄 field=${JSON.stringify(got.grid.field)} inline=${JSON.stringify(got.grid.inline)} panel=${JSON.stringify(got.grid.panel)}`);
  console.log(`  G-NEW 텍스트블럭           inline=${JSON.stringify(got.text.inline)} panel=${JSON.stringify(got.text.panel)}`);

  expect(got.grid.ok, '전제: grdAddLineToSelectedCell 이 false 를 돌려줬다 — 줄이 안 들어갔다').toBe(true);
  expect(got.grid.added, '전제: 줄 수가 ＋1 이 아니다 — 다른 것을 재고 있다').toBe(1);
  expect(got.text.inline, '전제: 텍스트블럭이 글꼴을 안 갖고 태어난다 — 이 대조는 아무것도 증명 못 한다').toBeTruthy();
  expect(got.grid.panel, '전제: 그리드 패널에 폰트 줄이 없다').not.toBeNull();
  expect(got.text.panel, '전제: 텍스트 패널에 폰트 줄이 없다').not.toBeNull();

  // ★주 단언 ⑴ — ★«같은 글꼴»이다(브라우저가 직렬화한 같은 꼴로 견준다)
  expect(got.grid.inline, `★새 그리드 글자 줄이 텍스트블럭과 다른 글꼴로 태어났다 — 줄 ${JSON.stringify(got.grid.inline)} / 텍스트블럭 ${JSON.stringify(got.text.inline)}`)
    .toBe(got.text.inline);
  // ★주 단언 ⑵ — ★사람이 보는 라벨도 같다(⛔dataset 만 재지 않는다)
  expect(got.grid.panel.label, `★패널 라벨이 텍스트블럭과 다르다 — 줄 「${got.grid.panel.label}」 / 텍스트블럭 「${got.text.panel.label}」`)
    .toBe(got.text.panel.label);
  // ★주 단언 ⑶ — ★그 라벨이 ★현빈이 지목한 ★증상 글자가 ★아니다
  expect(got.grid.panel.label, '★그리드 패널이 아직 「기본 (시스템)」이다 — 현빈이 지목한 그 증상 그대로다').not.toBe('기본 (시스템)');
  // ★주 단언 ⑷ — ★재렌더를 지난 «계산된» 값까지 같다(그리드는 innerHTML 통째 재생성이라 여기서 죽는 배선이 있다)
  expect(got.grid.computed, `★계산 스타일이 텍스트블럭과 다르다 — 줄 ${JSON.stringify(got.grid.computed)} / 텍스트블럭 ${JSON.stringify(got.text.computed)}`)
    .toBe(got.text.computed);
  expect(errs, `pageerror: ${errs[0] || ''}`).toHaveLength(0);
});

/* ══ G-KIND ★「글자 줄에만」을 ★렌더러에게 물어 견준다 ═══════════════════ */
test('G-KIND ★종류별 — 박히는 종류 집합 = 렌더러가 fontFamily 를 «읽는» 종류 집합', async ({ page }) => {
  /* ⛔「글자 역할은 label·h1·h2·h3·body·caption 여섯」이라는 ★표를 ★여기 적지 않는다 —
       그 표는 렌더러와 ★따로 늙는다(grid-block.js T-122 규약이 같은 말을 한다).
     ⇒ ★두 집합을 ★각각 ★행위로 뜬다:
        ㉠ 박히는 집합  = 패널 「+ 줄 추가」로 ★실제로 넣어 보고 `line.fontFamily` 가 생겼나
        ㉡ 읽는 집합    = 그 종류 줄에 fontFamily 를 ★손으로 박아 ★렌더한 결과에 선언이 ★나왔나
     그리고 ★㉠ === ㉡ 을 단언한다. ⇒ 「글자 줄인데 안 박힘」·「아닌 줄에 박힘」이 ★둘 다» 빨개진다. */
  const errs = await setup(page);
  const got = await page.evaluate(() => {
    const g = window.__g;
    g.classList.add('selected');
    window.grdSetActiveLine?.(g, { r: 0, c: 0, li: 0 });
    window.showGridProperties?.(g);
    const sel = document.getElementById('grd-line-add-kind');
    const kinds = [...sel.options].map(o => o.value).filter(Boolean);

    /* ★아이콘(image)은 피커가 ★비동기다 — ★실물 이름 그대로 세워 ★동기로 답하게 한다.
       ⛔이 자리를 건너뛰면 ★한 종류가 ★안 재진 채 초록이 된다. */
    const realPicker = window.openIconifyModal;
    window.openIconifyModal = (cb) => cb({ svg: '<svg xmlns="http://www.w3.org/2000/svg"/>', size: 64 });

    const stamped = [];
    for (const k of kinds) {
      const lines0 = window.getGridModel(g).cells[0][0].lines;
      window.grdSetActiveLine?.(g, { r: 0, c: 0, li: lines0.length - 1 });
      window.showGridProperties?.(g);
      const s = document.getElementById('grd-line-add-kind');
      s.value = k;
      s.dispatchEvent(new Event('change', { bubbles: true }));
      const lines1 = window.getGridModel(g).cells[0][0].lines;
      const last = lines1[lines1.length - 1];
      if (lines1.length !== lines0.length + 1) return { error: `kind '${k}': 줄이 ＋1 이 아니다 (${lines0.length}→${lines1.length})` };
      if (last.type !== k) return { error: `kind '${k}': 들어간 줄의 type 이 '${last.type}' 이다` };
      if (last.fontFamily) stamped.push(k);
    }
    window.openIconifyModal = realPicker;

    /* ★★패널 select 가 ★만들 수 없는 종류도 ★같이 잰다 — ⛔안 재면 `_GRD_ROLE_KINDS` 가름이
         ★아무것도 안 막는 장식이 된다(명부 안에서는 gap·divider 가 ★먼저 돌아가고 image 는
         ★호출부가 가로채므로, 가름을 ★지워도 명부 안 결과는 ★한 글자도 안 바뀐다 — 실측했다).
       ★duo·graph 는 ★렌더러가 ★그리는 종류인데 `_GRD_KINDS` 에는 ★없다(prop-grid.js _GRD_KINDS
         머리말이 그 어긋남을 ★이미 적어 뒀다). ⇒ ★spec 빌더에 ★직접 묻는다.
       ⛔이 둘을 「만들 수 있게」 하는 것이 아니다 — 만드는 길은 ★select 뿐이고 거긴 안 늘었다. */
    const extra = ['duo', 'graph'];
    for (const k of extra) {
      const sp = window.grdNewLineSpec ? window.grdNewLineSpec(k, 'grid') : null;
      if (!sp) return { error: `window.grdNewLineSpec 이 없다 — 명부 밖 종류를 못 잰다` };
      if (sp.fontFamily) stamped.push(k);
    }
    const allKinds = [...kinds, ...extra];

    /* ★★㉣ ★임자 가름 — ⛔이 문은 그리드만 쓰는 문이 ★아니다. 버블(`kind:'bubble'`)·
       챗(`kind:'chat'`) 줄이 ★같은 select·★같은 spec 빌더를 쓴다(line-host.js · BT2).
       ★현빈 발주는 「모달이나 ★그리드블럭의 텍스트 줄」이라 ★그 둘은 ★안 건드린다.
       ⛔안 재면 다음 사람이 가름을 지우고도 ★이 레인에선 초록을 본다
         (그 빨강은 ★남의 spec 인 `bt2-lines.dom.spec.js` T3 에서만 난다 — 실측했다). */
    const hosts = {};
    for (const hk of ['grid', 'bubble', 'chat']) {
      hosts[hk] = !!(window.grdNewLineSpec('caption', hk) || {}).fontFamily;
    }

    /* ㉡ 렌더러가 ★그 종류에서 fontFamily 를 ★읽나 — ★저장본 꼴로 만들어 ★그려 본다 */
    const reads = [];
    const probe = document.createElement('div');
    probe.className = 'grid-block';
    probe.dataset.type = g.dataset.type; probe.dataset.gap = g.dataset.gap; probe.dataset.valign = g.dataset.valign;
    document.getElementById('inner1').appendChild(probe);
    for (const k of allKinds) {
      probe.dataset.cols = JSON.stringify([{ width: 1, lines: [{ type: k, text: 'x', fontFamily: "'Pretendard', sans-serif" }] }]);
      window.renderGridBlock(probe);
      const el = probe.querySelector('[data-line="0"]');
      const css = el ? (el.style.cssText + ' ' + [...el.querySelectorAll('*')].map(n => n.style.cssText).join(' ')) : '';
      if (/font-family/.test(css)) reads.push(k);
    }
    probe.remove();
    return { kinds: allKinds, stamped, reads, hosts };
  });
  if (got.error) throw new Error(`전제 깨짐 — ${got.error}`);
  console.log(`  G-KIND 종류(${got.kinds.length})=${JSON.stringify(got.kinds)}`);
  console.log(`  G-KIND ㉠박힌 종류(${got.stamped.length})=${JSON.stringify(got.stamped)}`);
  console.log(`  G-KIND ㉡렌더러가 읽는 종류(${got.reads.length})=${JSON.stringify(got.reads)}`);

  /* ★★전제 — ⛔두 집합이 ★둘 다 비면 `toEqual` 은 ★항등식이 되어 ★아무것도 안 잠근다.
     ★«공집합 == 공집합» 이 초록으로 통과하는 판을 먼저 막는다. */
  expect(got.reads.length, '전제: 어느 종류에서도 렌더러가 fontFamily 를 안 읽는다 — 이 자는 아무것도 못 잰다').toBeGreaterThan(0);
  expect(got.reads.length, `전제: 모든 종류가 fontFamily 를 읽는다고 나왔다 — 「글자 줄에만」을 가를 수 없다. 종류=${JSON.stringify(got.kinds)}`).toBeLessThan(got.kinds.length);

  expect(got.stamped.slice().sort(),
    `★박히는 종류 집합이 렌더러가 읽는 종류 집합과 다르다 — 박힘 ${JSON.stringify(got.stamped)} / 읽음 ${JSON.stringify(got.reads)}`)
    .toEqual(got.reads.slice().sort());

  // ★㉣ 임자 — 그리드만 박고 버블·챗은 ★그대로다(발주 범위)
  expect(got.hosts.grid, '★그리드 임자인데 안 박혔다 — 발주 범위 안에서 기전이 죽었다').toBe(true);
  expect(got.hosts.bubble, '★버블 줄에도 박혔다 — 발주 범위(모달·그리드) 밖이다. bt2-lines T3 이 같이 빨개진다').toBe(false);
  expect(got.hosts.chat, '★챗 줄에도 박혔다 — 발주 범위(모달·그리드) 밖이다. bt2-lines T3 이 같이 빨개진다').toBe(false);
  expect(errs, `pageerror: ${errs[0] || ''}`).toHaveLength(0);
});

/* ══ G-OLD ★음성대조 — 최고 위험 ═════════════════════════════════════════ */
test('G-OLD ★(음성대조) 저장본으로 되살아난 «옛» 줄은 한 글자도 안 움직인다 — 패널도 그대로 「기본 (시스템)」', async ({ page }) => {
  /* ★★이 칸이 ★기존 프로젝트 ★전부를 지킨다. 저장본은 `grdNewLineSpec` 이 아니라
       ★`dataset.cols` → `renderGridBlock` 으로 되살아난다 ⇒ ★그 길을 ★그대로 밟는다.
     ⛔「+ 줄 추가」로 만든 줄을 «옛 줄»이라 부르면 ★이 칸이 거짓초록이 된다. */
  const errs = await setup(page);
  const got = await page.evaluate(({ panelSrc }) => {
    const panelFont = eval(panelSrc);
    const g = window.__g;
    const old = document.createElement('div');
    old.className = 'grid-block';
    old.id = 'oldgrid';
    old.dataset.type = g.dataset.type; old.dataset.gap = g.dataset.gap; old.dataset.valign = g.dataset.valign;
    // ★fontFamily 를 ★안 가진 «옛» 글자 줄 — 2026-10-07 이전의 저장본이 꼭 이 꼴이다
    old.dataset.cols = JSON.stringify([{ width: 1, lines: [{ type: 'body', text: '옛 본문' }] }]);
    document.getElementById('inner1').appendChild(old);
    window.renderGridBlock(old);                        // ★저장본이 되살아나는 ★그 문
    const el = old.querySelector('[data-line="0"]');
    g.classList.remove('selected'); old.classList.add('selected');
    window.grdSetActiveLine?.(old, { r: 0, c: 0, li: 0 });
    window.showGridProperties?.(old);
    return {
      has: !!el,
      hasKey: !!(window.getGridModel(old).cells[0][0].lines[0] || {}).fontFamily,
      inline: el ? el.style.fontFamily : null,
      cssHasFont: el ? /font-family/.test(el.style.cssText) : null,
      computed: el ? getComputedStyle(el).fontFamily : null,
      panel: panelFont(),
    };
  }, { panelSrc: PANEL_FONT });
  console.log(`  G-OLD hasKey=${got.hasKey} inline=${JSON.stringify(got.inline)} computed=${JSON.stringify(got.computed)} panel=${JSON.stringify(got.panel)}`);

  expect(got.has, '전제: 옛 줄이 안 그려졌다 — 되살리는 문을 못 밟았다').toBe(true);
  expect(got.panel, '전제: 패널에 폰트 줄이 없다').not.toBeNull();
  expect(got.hasKey, '★옛 줄에 fontFamily 가 생겼다 — 되살리는 길이 새 기본값을 박고 있다').toBe(false);
  expect(got.cssHasFont, `★옛 줄에 font-family 선언이 나갔다 — 기존 프로젝트의 화면이 움직인다. inline=${JSON.stringify(got.inline)}`).toBe(false);
  expect(got.panel.label, `★옛 줄의 패널이 바뀌었다 — 「${got.panel.label}」. 사용자가 고르지 않은 값을 패널이 말하고 있다`).toBe('기본 (시스템)');
  expect(errs, `pageerror: ${errs[0] || ''}`).toHaveLength(0);
});

/* ══ G-GATE ★검문 자 ═════════════════════════════════════════════════════ */
test('G-GATE ★박는 값이 렌더러의 검문 자를 통과한다 — 거절되면 선언이 «조용히» 빠진다 (＋그 자가 항등식이 아님)', async ({ page }) => {
  const errs = await setup(page);
  const got = await page.evaluate(() => {
    const g = window.__g;
    g.classList.add('selected');
    window.grdSetActiveLine?.(g, { r: 0, c: 0, li: 0 });
    window.grdAddLineToSelectedCell?.('text');
    const lines = window.getGridModel(g).cells[0][0].lines;
    const value = (lines[lines.length - 1] || {}).fontFamily ?? null;

    /* ★검문 자를 ★제품에서 빌린다 — ⛔정규식을 여기 베끼지 않는다(두 벌이 되면 따로 늙는다). */
    const probe = document.createElement('div');
    probe.className = 'grid-block';
    probe.dataset.type = g.dataset.type; probe.dataset.gap = g.dataset.gap; probe.dataset.valign = g.dataset.valign;
    document.getElementById('inner1').appendChild(probe);
    const render = (ff) => {
      probe.dataset.cols = JSON.stringify([{ width: 1, lines: [{ type: 'body', text: 'x', fontFamily: ff }] }]);
      window.renderGridBlock(probe);
      const el = probe.querySelector('[data-line="0"]');
      return el ? /font-family/.test(el.style.cssText) : false;
    };
    const out = { value, passes: value === null ? null : render(value), rejects: render('Noto; color:red') };
    probe.remove();
    return out;
  });
  console.log(`  G-GATE 박은 값=${JSON.stringify(got.value)} · 통과=${got.passes} · 더러운 값 거절=${!got.rejects}`);

  expect(got.value, '전제: 새 줄에 박힌 값이 없다 — 검문할 것이 없다').toBeTruthy();
  // ★주 단언 — 우리가 박는 ★그 값이 ★렌더러를 통과한다
  expect(got.passes, `★박은 값 ${JSON.stringify(got.value)} 이 검문 자에 걸려 font-family 선언이 나가지 않았다 — 패널만 「Pretendard」라 말하고 화면은 그대로다`).toBe(true);
  /* ★★이 자가 ★항등식이 아님을 ★같이 보인다 — ⛔「무엇을 줘도 통과」면 위 초록은 아무것도 안 잠근다 */
  expect(got.rejects, '★검문 자가 「Noto; color:red」까지 통과시킨다 — 그러면 위 통과 단언은 항등식이다').toBe(false);
  expect(errs, `pageerror: ${errs[0] || ''}`).toHaveLength(0);
});

/* ══ G-RULER ★폭 ═════════════════════════════════════════════════════════ */
test('G-RULER ★그 이름이 «진짜 먹나»는 폭으로만 안다 (＋이 자가 항등식이 아님을 같이 보인다)', async ({ page }) => {
  const errs = await setup(page);
  const got = await page.evaluate(({ probeSrc }) => {
    const widthOf = eval(probeSrc);
    const g = window.__g;
    g.classList.add('selected');
    window.grdSetActiveLine?.(g, { r: 0, c: 0, li: 0 });
    window.grdAddLineToSelectedCell?.('text');
    const lines = window.getGridModel(g).cells[0][0].lines;
    const li = lines.length - 1;
    const el = g.querySelector(`.grd-cell[data-r="0"][data-c="0"] [data-line="${li}"]`);
    const stack = el ? getComputedStyle(el).fontFamily : '';
    return {
      stack,
      line: stack ? widthOf(stack) : null,
      bogus: widthOf("'NoSuchFontXyz123', sans-serif"),
      sans: widthOf('sans-serif'),
    };
  }, { probeSrc: WIDTH_PROBE });
  console.log(`  G-RULER 줄 스택=${JSON.stringify(got.stack)} 폭=${got.line} / 가짜이름 ${got.bogus} / sans-serif ${got.sans}`);

  expect(got.stack, '전제: 새 줄의 계산된 font-family 가 비었다 — 잴 것이 없다').toBeTruthy();
  expect(got.line, '전제: 폭을 못 쟀다').toBeTruthy();
  /* ★영점 — 가짜 이름은 generic 으로 떨어져 sans-serif 와 ★같은 폭이 된다.
     ⛔이 둘이 다르면 ★자 자체가 틀린 것이라 아래 단언을 믿을 수 없다. */
  expect(got.bogus, `전제(영점): 없는 이름이 sans-serif 로 안 떨어졌다 — 가짜 ${got.bogus} / sans ${got.sans}`).toBe(got.sans);
  // ★주 단언 — ★그 글꼴이 ★진짜 그려진다(이름만 맞고 폴백이면 여기서 빨개진다)
  expect(got.line, `★새 줄의 글꼴이 «진짜로 안 먹는다» — 줄 ${got.line} 이 폴백(${got.bogus})과 같다. 스택=${JSON.stringify(got.stack)}`)
    .not.toBe(got.bogus);
  expect(errs, `pageerror: ${errs[0] || ''}`).toHaveLength(0);
});
