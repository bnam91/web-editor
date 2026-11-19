/* u3-panel-variants-wiring.dom.spec.js — U3(right-panel-unify) 패널을 «기본 아닌 변형»까지 열어 배선이 끝까지 도는가.
 * ★왜(U5 평가자 교차 지적 2026-11-13): 틀로 옮기며 «그려 놓고 숨기던» 절을 «안 그리는» 절로 바꾸면, 그 안 컨트롤을 null 가드 없이
 *   집는 배선이 던져 나머지 배선이 통째로 죽는다 — 기본 패널만 여는 게이트(panel-section-gate)는 못 본다.
 * ★U3 실측: 옛 판 대비 id 소실 0(9파일 전수 comm) · 새로 «안 그리게» 된 곳 = 흐름 멀티선택의 글자 크기(글 0개)·분배(간격 <2) 둘뿐 — 둘 다 가드돼 있다(prop-multisel.js `fsApply?.` `fsInput?.` · querySelectorAll).
 * 단언(변형마다): pageerror 0 · 그 변형의 컨트롤 하나가 모델에 «쓴다»(배선이 끝까지 돌았다는 증거 — 앞에서 던지면 뒤 배선이 안 걸린다).
 * 힌트 ≤2(U3 평가 F4): 모든 프레임 변형 + 원형 배치를 «시작한» 프레임(V-frame-radial).
 *   양성대조: prop-frame.js _radialSec 의 `!isBuzzFrame(ss)` 를 지우면 V-frame-buzz 힌트 3(squeeze·원형 시작·…) 빨강 ·
 *   radial-arrange.js 「다시 배치」 툴팁을 도로 .prop-hint 로 내리면 V-frame-radial 빨강.
 * V-canvas-layer-empty [G9] 레이어 0개 — Content 절을 안 낸다(빈 머리 절 금지) · 그 절을 집던 배선(#cvb-layer-list)이 던지지 않는다.
 *   양성대조: prop-canvas.js 의 `getElementById('cvb-layer-list')?.` 셋 중 하나에서 ?. 를 빼면 빨강(TypeError · pageerror 1).
 * E1·E2 ★기대 바뀜(패널 재설계 1차 · 표준 절 접기 없음) — 머리를 눌러도 안 접히고, 줄을 더한 뒤 Content 절이 보인다(카드 수 늘리기 · 모달 아이콘 변형).
 * 양성대조: prop-multisel.js showFlowMultiSelPanel 의 `fsApply?.addEventListener` 를 `fsApply.addEventListener` 로 바꾸면 V-ms-notext 빨강(TypeError · pageerror 1).
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

async function scene(page) {
  await page.setViewportSize({ width: 1500, height: 1200 });
  const errs = await bootApp(page);
  await page.evaluate(() => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    c.insertAdjacentHTML('beforeend', '<div class="section-block" data-section="1" id="sV"><div class="section-hitzone"></div><div class="section-inner" id="sVi"></div></div>');
    window.rebindAll?.(); window.deselectAll?.();
    window.__S = () => document.getElementById('sV');
    window.__made = (sel, fn) => { const b = new Set([...document.querySelectorAll('#canvas ' + sel)]); fn(); return [...document.querySelectorAll('#canvas ' + sel)].find((e) => !b.has(e)); };
    /* 숫자 칸에 쓴다 — input·change 둘 다(bindSlider 는 input, 카드/캔버스는 change 에서 먹는다) */
    window.__write = (id, v) => { const n = document.getElementById(id); n.value = String(v); n.dispatchEvent(new Event('input', { bubbles: true })); n.dispatchEvent(new Event('change', { bubbles: true })); };
  });
  return errs;
}
const run = (page, fn, arg) => page.evaluate(fn, arg);

/* ── 프레임 4 변형 — 코너(Appearance) 칸이 dataset.radius 에 쓴다 ── */
const FRAME = {
  free: (f) => {},
  stack: (f) => { f.dataset.freeLayout = 'false'; },
  group: (f) => { f.dataset.group = 'true'; },
  buzz: null,   // 진짜 버즈(addBuzzBlock)
};
for (const [name, prep] of Object.entries(FRAME)) {
  test(`V-frame-${name} — 열림 · 오류 0 · 코너 칸이 쓴다`, async ({ page }) => {
    const errs = await scene(page);
    const r = await run(page, ([name, prepSrc]) => {
      const S = window.__S(); window.selectSection(S);
      const f = name === 'buzz'
        ? window.__made('.frame-block[data-buzz="1"]', () => window.addBuzzBlock())
        : window.__made('.frame-block:not([data-text-frame])', () => window.addFrameBlock());
      if (!f) return { err: '프레임을 못 만들었다' };
      if (prepSrc) (new Function('f', prepSrc))(f);
      window.deselectAll?.(); window.showFrameProperties(f);
      window.__write('ss-radius-num', 14);
      return { hints: document.querySelectorAll('#panel-right .prop-hint').length, radius: f.dataset.radius, buzzSec: !!document.getElementById('bzf-section'), float: !!document.getElementById('ss-float-toggle'), fx: !!document.getElementById('ss-fx-section') };
    }, [name, prep ? `(${prep})(f)` : '']);
    expect(r.err).toBeUndefined();
    expect(r.radius, '코너 칸이 모델에 안 썼다 — 배선이 앞에서 끊겼다').toBe('14');
    if (name !== 'buzz') expect(r.fx, 'Effects 절(머리만이라도)이 있다 — effects-frame-shadow 와 같은 전제').toBe(true);
    if (name === 'buzz') expect(r.buzzSec, '전제: 버즈 절').toBe(true);
    expect(r.hints, `힌트 ${r.hints}개 > 2 (U3 평가 F4 — 버즈는 원형 배치 단추를 안 둔다)`).toBeLessThanOrEqual(2);
    if (name === 'group') expect(r.float, '전제: 그룹 플로팅 손잡이').toBe(true);
    expect(errs, errs.join(' | ')).toEqual([]);
  });
}

test('V-section — 섹션 패널(배경·파티클·메시 칸 포함) · 좌우 패딩이 쓴다', async ({ page }) => {
  const errs = await scene(page);
  await run(page, () => window.selectSection(window.__S()));
  /* showSectionProperties 는 async(_presetsReady 뒤 그린다) — 칸이 선 뒤에 쓴다(태양 판정 · 제품 결함 아님). */
  await page.waitForFunction(() => document.getElementById('sec-padx-number'));
  const r = await run(page, () => {
    window.__write('sec-padx-number', 24);
    return { padx: document.getElementById('sVi').dataset.paddingX, ptc: !!document.getElementById('sec-fxpart-toggle'), mesh: !!document.getElementById('sec-bg-mesh') };
  });
  expect([r.ptc, r.mesh], '전제: 파티클·메시 칸').toEqual([true, true]);
  expect(r.padx).toBe('24');
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('V-page — 페이지 패널 · 패딩 비주얼 끔이 쓴다', async ({ page }) => {
  const errs = await scene(page);
  const r = await run(page, () => {
    window.deselectAll?.(); window.showPageProperties();
    document.getElementById('page-pad-hint-on').click();
    const on = window.readPadHintOn();
    document.getElementById('page-pad-hint-off').click();
    return { on, off: window.readPadHintOn() };
  });
  expect([r.on, r.off]).toEqual([true, false]);
  expect(errs, errs.join(' | ')).toEqual([]);
});

for (const v of ['plain', 'icon', 'grid-2', 'titled']) {
  test(`V-modal-${v} — 모달 변형 · 모서리 칸이 쓴다`, async ({ page }) => {
    const errs = await scene(page);
    const r = await run(page, (v) => {
      window.selectSection(window.__S());
      const b = window.__made('.modal-block', () => window.addModalBlock());
      if (!b) return { err: '모달을 못 만들었다' };
      window.applyModalVariant(b, v); window.renderModalBlock?.(b);
      window.deselectAll?.(); window.showModalProperties(b);
      const n = document.getElementById('mdl-radius-number');
      const want = String(n.max);
      window.__write('mdl-radius-number', want);
      return { variant: b.dataset.variant || 'plain', radius: b.dataset.radius, want };
    }, v);
    expect(r.err).toBeUndefined();
    expect(r.radius, `모서리 칸이 모델에 안 썼다(${r.variant})`).toBe(r.want);
    expect(errs, errs.join(' | ')).toEqual([]);
  });
}

test('V-canvas-layer — 캔버스 레이어 모드 · 반경 칸이 쓴다', async ({ page }) => {
  const errs = await scene(page);
  const r = await run(page, () => {
    const made = window.makeCanvasBlock({});
    const b = made.block; b.dataset.cardMode = 'layers';
    b.dataset.layers = JSON.stringify([{ type: 'shape', label: 'S', color: '#cccccc' }, { type: 'text', content: 'T', color: '#000000', fontSize: 16 }]);
    document.getElementById('sVi').appendChild(made.row || b); window.rebindAll?.();
    window.showCanvasProperties(b);
    window.__write('cvb-radius-number', 9);
    return { radius: b.dataset.radius, layers: document.querySelectorAll('#cvb-layer-list .cvb-layer-row').length };
  });
  expect(r.layers, '전제: 레이어 모드 패널').toBe(2);
  expect(r.radius).toBe('9');
  expect(errs, errs.join(' | ')).toEqual([]);
});

for (const icon of [false, true]) {
  test(`V-card${icon ? '-icon' : ''} — 심플카드 · 간격 칸이 쓴다`, async ({ page }) => {
    const errs = await scene(page);
    const r = await run(page, (icon) => {
      const made = window.makeCanvasBlock({ cardMode: 'simple' });
      const b = made.block; if (icon) b.dataset.iconMode = 'true';
      document.getElementById('sVi').appendChild(made.row || b); window.rebindAll?.();
      window.showSimpleCardProperties(b);
      window.__write('cvb-gap-number', 20);
      return { gap: b.dataset.cardGap, iconRow: !!document.getElementById('cvb-icon-size-number') };
    }, icon);
    expect(r.iconRow, '전제: 아이콘(이스터에그) 칸 유무').toBe(icon);
    expect(r.gap).toBe('20');
    expect(errs, errs.join(' | ')).toEqual([]);
  });
}

for (const layout of ['stack', 'flex']) {
  test(`V-row-${layout} — row · 좌우 패딩이 쓴다`, async ({ page }) => {
    const errs = await scene(page);
    const r = await run(page, (layout) => {
      const row = document.createElement('div'); row.className = 'row'; row.dataset.layout = layout;
      row.innerHTML = '<div class="col" data-flex="1"></div><div class="col" data-flex="1"></div>';
      document.getElementById('sVi').appendChild(row);
      window.showRowProperties(row);
      window.__write('row-padx-number', 16);
      return { padx: row.dataset.padX, ratio: !!document.getElementById('row-col-ratio') };
    }, layout);
    expect(r.ratio, '전제: 비율 칸은 stack 이 아닐 때만').toBe(layout !== 'stack');
    expect(r.padx).toBe('16');
    expect(errs, errs.join(' | ')).toEqual([]);
  });
}

/* ── 흐름 멀티선택 — 글 0개(글자 크기 절 없음) · 글 2개(있음) ── */
for (const kind of ['notext', 'text']) {
  test(`V-ms-${kind} — 흐름 멀티선택 · 정렬 단추가 쓴다`, async ({ page }) => {
    const errs = await scene(page);
    const r = await run(page, (kind) => {
      const S = window.__S(); const made = [];
      for (let i = 0; i < 2; i++) {
        window.selectSection(S);
        made.push(kind === 'text' ? window.__made('.text-block', () => window.addTextBlock('body')) : window.__made('.gap-block', () => window.addGapBlock()));
      }
      window.deselectAll?.(); made.forEach((b) => b.classList.add('selected'));
      const ok = window.hasFlowMultiSel();
      window.showFlowMultiSelPanel();
      const before = made.map((b) => b.outerHTML).join('|');
      document.querySelector('#panel-right .prop-align-btn[data-align="right"]')?.click();
      return { ok, typo: !!document.querySelector('#panel-right .prop-section[data-sec="typography"]'), fs: !!document.getElementById('msp-font-size'),
        changed: made.map((b) => b.outerHTML).join('|') !== before };
    }, kind);
    expect(r.ok, '전제: 흐름 멀티선택이 성립').toBe(true);
    expect([r.typo, r.fs], '글자 크기 절은 글이 있을 때만').toEqual([kind === 'text', kind === 'text']);
    expect(r.changed, '정렬 단추가 블록에 안 썼다 — 배선이 앞에서 끊겼다').toBe(true);
    expect(errs, errs.join(' | ')).toEqual([]);
  });
}

test('V-frame-radial — 원형 배치를 시작한 프레임 · 힌트 ≤2 · 반지름 칸이 쓴다', async ({ page }) => {
  const errs = await scene(page);
  const r = await run(page, () => {
    window.selectSection(window.__S());
    const f = window.__made('.frame-block:not([data-text-frame])', () => window.addFrameBlock());
    window.deselectAll?.(); window.showFrameProperties(f);
    document.getElementById('ss-radial-apply')?.click();      // 배치 시작 — 패널이 다시 그려진다
    window.showFrameProperties(f);
    const n = document.getElementById('ss-radial-radius-number');
    if (!n) return { err: '배치 뒤 반지름 칸이 없다' };
    const before = f.outerHTML;
    window.__write('ss-radial-radius-number', parseInt(n.value, 10) + 2);
    return { arranged: f.dataset.radialArrange, hints: document.querySelectorAll('#panel-right .prop-hint').length,
      changed: f.outerHTML !== before };
  });
  expect(r.err).toBeUndefined();
  expect(r.arranged, '전제: 원형 배치가 시작됐다').toBe('1');
  expect(r.hints, `힌트 ${r.hints}개 > 2`).toBeLessThanOrEqual(2);
  expect(r.changed, '반지름 칸이 프레임(칸 자리)에 안 썼다').toBe(true);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('E1 카드 수를 늘리면 Content 절이 보인다(머리를 눌러도 안 접힘)', async ({ page }) => {
  const errs = await scene(page);
  const r = await run(page, () => {
    const made = window.makeCanvasBlock({ cardMode: 'simple' });
    document.getElementById('sVi').appendChild(made.row || made.block); window.rebindAll?.();
    window.showSimpleCardProperties(made.block);
    document.getElementById('psec-content-head').click();                       // ★기대 바뀜(패널 재설계 1차) — 옛 판은 이걸로 접혔다
    const folded = document.getElementById('psec-content-body').hidden;
    const n0 = JSON.parse(made.block.dataset.cards || '[]').length;
    document.querySelector('#cvb-grid-picker .grid-picker-cell[data-r="1"][data-c="3"]').click();   // 1×3 — 카드가 는다
    return { folded, n0, n1: JSON.parse(made.block.dataset.cards || '[]').length, open: !document.getElementById('psec-content-body')?.hidden };
  });
  expect(r.folded, '★머리를 누르니 Content 절이 접혔다').toBe(false);
  expect(r.n1, '전제: 카드가 늘었다').toBeGreaterThan(r.n0);
  expect(r.open, '★카드가 늘었는데 Content 절이 안 보인다').toBe(true);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('E2 모달을 아이콘 변형으로 바꾸면 Content 절이 보인다(옛 접기 저장이 있어도)', async ({ page }) => {
  const errs = await scene(page);
  const r = await run(page, () => {
    window.selectSection(window.__S());
    const b = window.__made('.modal-block', () => window.addModalBlock());
    window.deselectAll?.(); window.showModalProperties(b);
    document.getElementById('psec-content-head')?.click();   // ★기대 바뀜(패널 재설계 1차) — 옛 판은 이걸로 접혔다
    localStorage.setItem('gd-panel-collapsed', JSON.stringify(['content']));   // 옛 판이 남긴 저장 — 이제 안 읽는다
    const sel = document.getElementById('mdl-variant'); sel.value = 'icon'; sel.dispatchEvent(new Event('change', { bubbles: true }));
    return { variant: b.dataset.variant, icon: !!document.getElementById('mdl-icon-pick'), open: !document.getElementById('psec-content-body')?.hidden };
  });
  expect([r.variant, r.icon], '전제: 아이콘 변형 · 아이콘 칸').toEqual(['icon', true]);
  expect(r.open, '★아이콘 칸이 생겼는데 Content 절이 안 보인다').toBe(true);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('V-canvas-layer-empty — 레이어 0개 · Content 절 없음 · 오류 0 · 반경 칸이 쓴다', async ({ page }) => {
  const errs = await scene(page);
  const r = await run(page, () => {
    const made = window.makeCanvasBlock({});
    const b = made.block; b.dataset.cardMode = 'layers'; b.dataset.layers = '[]';
    document.getElementById('sVi').appendChild(made.row || b); window.rebindAll?.();
    window.showCanvasProperties(b);
    window.__write('cvb-radius-number', 7);
    return { content: !!document.querySelector('#panel-right .prop-section[data-sec="content"]'), radius: b.dataset.radius };
  });
  expect(r.content, '레이어 0개인데 Content 절(빈 머리)을 냈다').toBe(false);
  expect(r.radius, '배선이 앞에서 끊겼다').toBe('7');
  expect(errs, errs.join(' | ')).toEqual([]);
});
