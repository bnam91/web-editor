/* text-style-code-paste.dom.spec.js — 형광펜·점·밑줄 «스타일 번호» 복사/붙여넣기 (1012t1E5 · 2026-10-13)
 *
 * ★원문 — 「최근 스타일을 하나씩 말고 파티클의 무늬번호처럼 혹은 컬러 코드를 입력할 수 있잖아?
 *   이것처럼 스타일 번호를 복사해서 붙여넣기 하는식으로」
 * ★꼴 = kind(hl·dot·ul)마다 번호 행 하나: #txt-<k>-code(칸) · #txt-<k>-code-copy(복사) · Enter/change 로 입힌다.
 *   코덱 = js/props/text-style-code.js(부르기만) · 입히기 = 최근 칩과 같은 _applyRecentStyle.
 * ★재는 것
 *   P0 행 — hl·dot·ul 각 1 · glow·grad 0 · 모달 산출 0 글자(양성대조 = 옵션 켠 산출 3)
 *   P1 복사 → 다른 블럭에 붙여넣기(kind 셋) — 꺼진 B 가 켜지고 값이 A 와 같고 칸이 같은 번호 · 기본 서식 불변
 *   P2 저장 왕복 — 다시 연 뒤 span·값·칸 번호 유지
 *   P3 ⌘Z — 붙여넣기 한 번 = 한 걸음
 *   P4 틀린 번호 — 체크섬·버전·다른 kind·복합·glow → 불변 + 까닭 알림 + 히스토리 불변
 *   P5 빈 칸 Enter — 아무 일 없음 · 알림 0 · 칸 복원
 *   P6 빈 조각(끈 번호) — 뜻 미정이라 불변 + 알림
 *   P7 pageerror 0 (각 칸 끝)
 * ⛔고정 대기 0 — waitForFunction / expect.poll. 전제는 칸 안에서 단언한다.
 * 실행: bash run-test.sh dom tests/dom/text-style-code-paste.dom.spec.js */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const SEC = '<div class="section-block" id="sA" data-section="1" data-name="sA" style="background-color:#ffffff;padding:80px 0 0 80px"><div class="section-hitzone"></div><div class="section-inner" id="inA"></div></div>';

/* kind 마다: 켜는 단추 · 고칠 칸과 값 · 켜졌나 판정 · 고친 변수 */
const KINDS = {
  hl: { btn: '#txt-highlight-btn', field: '#txt-hl-h-num', val: 40, var: '--tb-hl-h', want: '40%', label: '최근 형광펜',
        vars: ['--tb-hl-color', '--tb-hl-h', '--tb-hl-y'] },
  dot: { btn: '#txt-dot-btn', field: '#txt-dot-size-num', val: 9, var: '--tb-dot-size', want: '9px', label: '최근 점',
         vars: ['--tb-dot-color', '--tb-dot-size', '--tb-dot-gap', '--tb-dot-x', '--tb-dot-y'] },
  ul: { btn: '#txt-underline-btn', field: '#txt-ul-thick', val: 3, var: '--tb-ul-thick', want: '3px', label: '최근 밑줄',
        vars: ['--tb-ul-color', '--tb-ul-thick', '--tb-ul-offset'] },
};

async function setup(page) {
  await page.setViewportSize({ width: 1600, height: 1000 });
  const errs = await bootApp(page);
  await page.evaluate((html) => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', html);
    window.rebindAll?.(); window.deselectAll?.(); window.applyZoom?.(100);
    document.getElementById('sA').classList.add('selected');
    try { localStorage.removeItem('we_text_style_history_v1'); } catch (_) {}
    /* ★기록기는 부팅 «뒤» — drag-utils.js 가 showToast 를 제 것으로 덮는다(asset-drop-no-silent 의 함정). */
    window.__toasts = [];
    const _orig = window.showToast;
    window.showToast = (m, ...a) => { window.__toasts.push(String(m)); try { return _orig?.(m, ...a); } catch (_) {} };
    /* ★하네스의 electronAPI 는 «모든 호출 null» — 그대로면 복사가 실패 갈래로 간다. 클립보드만 기록기로. */
    window.__clip = null;
    window.electronAPI = new Proxy({ clipboardWriteText: async (t) => { window.__clip = t; return { ok: true }; } },
      { get: (o, k) => (k in o ? o[k] : () => Promise.resolve(null)) });
  }, SEC);
  await page.waitForFunction(() => !!document.getElementById('inA'));
  return errs;
}
const insertText = (page, content) => page.evaluate((t) => {
  const before = new Set([...document.querySelectorAll('#canvas [id]')].map(e => e.id));
  document.getElementById('sA').classList.add('selected');
  window.addTextBlock('body', { content: t });
  const fresh = [...document.querySelectorAll('#canvas .text-block')].filter(e => !before.has(e.id));
  return fresh.length ? fresh[fresh.length - 1].id : null;
}, content);
const openPanel = async (page, id) => {
  await page.evaluate((i) => window.showTextProperties(document.getElementById(i)), id);
  await page.waitForSelector('#txt-style-group', { state: 'attached' });
  await page.waitForSelector('#txt-hl-code', { state: 'attached' });
};
async function clickSel(page, sel) {
  const loc = page.locator(sel).first();
  await loc.scrollIntoViewIfNeeded();
  const b = await loc.boundingBox();
  if (!b) throw new Error('no box: ' + sel);
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
}
const isOn = (page, id, k) => page.evaluate(([i, kk]) => {
  const ce = document.getElementById(i)?.querySelector('.tb-body');
  if (!ce) return null;
  if (kk === 'hl') return ce.querySelectorAll('span.tb-hl').length > 0;
  if (kk === 'dot') return ce.querySelectorAll('span.tb-dot').length > 0;
  return String(ce.style.textDecorationLine || ce.style.textDecoration || '').includes('underline');
}, [id, k]);
const waitOn = (page, id, k, want = true) => expect.poll(() => isOn(page, id, k), `★${k} 켜짐이 ${want} 가 안 됐다`).toBe(want);
const varsOf = (page, id, names) => page.evaluate(([i, ns]) => {
  const cs = getComputedStyle(document.getElementById(i));
  return Object.fromEntries(ns.map(n => [n, cs.getPropertyValue(n).trim()]));
}, [id, names]);
const fontOf = (page, id) => page.evaluate((i) => {
  const cs = getComputedStyle(document.getElementById(i).querySelector('.tb-body'));
  return { font: cs.fontFamily, size: cs.fontSize, weight: cs.fontWeight, color: cs.color };
}, id);
/* 블럭 겉모습 — 선택 표시(class selected)만 걷고, 속성 «순서»는 이름순으로 맞춘다
   (⌘Z 복원은 블럭을 다시 묶으며 contenteditable 을 다른 차례로 단다 — 실측 run2: 차이가 그 순서 하나뿐이었다). */
const snapOf = (page, id) => page.evaluate((i) => {
  const c = document.getElementById(i).cloneNode(true);
  c.classList.remove('selected');
  c.querySelectorAll('.selected').forEach(e => e.classList.remove('selected'));
  for (const e of [c, ...c.querySelectorAll('*')]) {
    const at = [...e.attributes].map(x => [x.name, x.value]).sort((x, y) => (x[0] < y[0] ? -1 : 1));
    at.forEach(([n]) => e.removeAttribute(n));
    at.forEach(([n, v]) => e.setAttribute(n, v));
  }
  return c.outerHTML;
}, id);
/* 히스토리 끝 — #undo-btn 은 하네스 화면에 없다(title 이 늘 '') ⇒ history.js 의 getHistoryTip 을 읽는다 */
const tipOf = (page) => page.evaluate(() => { const t = window.getHistoryTip(); return { action: t.action, pos: t.pos, len: t.len }; });
const toasts = (page) => page.evaluate(() => window.__toasts.slice());
const paste = async (page, k, code) => { await page.fill(`#txt-${k}-code`, code); await page.press(`#txt-${k}-code`, 'Enter'); };

/** A 블럭에 kind 를 켜고 값 하나를 패널로 고친 뒤 복사 단추로 번호를 뜬다. */
async function makeAndCopy(page, k, content) {
  const K = KINDS[k];
  const id = await insertText(page, content);
  await openPanel(page, id);
  expect(await isOn(page, id, k), `★전제 — A 에 이미 ${k} 가 있다`).toBe(false);
  await clickSel(page, K.btn);
  await waitOn(page, id, k);
  await page.waitForSelector(K.field, { state: 'visible' });
  await page.fill(K.field, String(K.val));
  await page.press(K.field, 'Enter');
  await page.waitForFunction(([i, n, w]) => document.getElementById(i).style.getPropertyValue(n).trim() === w, [id, K.var, K.want]);
  await page.evaluate(() => { window.__clip = null; });
  await clickSel(page, `#txt-${k}-code-copy`);
  await page.waitForFunction(() => typeof window.__clip === 'string');
  const clip = await page.evaluate(() => window.__clip);
  expect(clip, `★복사한 번호 꼴이 아니다: ${clip}`).toMatch(new RegExp(`^T1-${k}:.+-[0-9a-z]{2}$`));
  expect(await page.inputValue(`#txt-${k}-code`), '★복사 뒤 칸 값이 복사한 번호와 다르다').toBe(clip);
  return { id, clip };
}

/* ══ P0 행 ══ */
test('P0 ★행 — hl·dot·ul 번호 행 각 1 · glow·grad 0 · 모달 산출 0 글자(양성대조 = 옵션 켠 산출 3)', async ({ page }) => {
  const errs = await setup(page);
  const id = await insertText(page, 'AAA');
  await openPanel(page, id);
  expect(await page.locator('#txt-glow-btn').count(), '★전제 — 텍스트 패널에 글로우 단추가 있다(showGlow 켠 판)').toBe(1);
  const n = await page.evaluate(() => ['hl', 'dot', 'ul', 'glow', 'grad'].map(k => [
    document.querySelectorAll(`#txt-${k}-code-row`).length,
    document.querySelectorAll(`#txt-${k}-code`).length,
    document.querySelectorAll(`#txt-${k}-code-copy`).length,
  ]));
  expect(n).toEqual([[1, 1, 1], [1, 1, 1], [1, 1, 1], [0, 0, 0], [0, 0, 0]]);
  const r = await page.evaluate(async () => {
    const m = await import(new URL('js/props/_typo-section.js', location.href).href);
    const base = { p: 'mdl-typo', size: 32 };
    const off = m.buildTypographySectionHtml(base);
    const on = m.buildTypographySectionHtml({ ...base, showHighlightOpts: true, showDotOpts: true, showUnderlineOpts: true, showGlow: true, showGlowOpts: true });
    return { off: (off.match(/code-row|-code"/g) || []).length, on: (on.match(/id="mdl-typo-(?:hl|dot|ul)-code-row"/g) || []).length, onGlow: /glow-code/.test(on) };
  });
  expect(r.off, '★기본 호출(모달·그리드·챗)에 번호 행이 샜다').toBe(0);
  expect(r.on, '★양성대조 — 옵션을 켜도 행이 3개가 아니다').toBe(3);
  expect(r.onGlow, '★글로우 분기에 번호 행이 샜다').toBe(false);
  expect(errs).toEqual([]);
});

/* ══ P1 복사 → 다른 블럭에 붙여넣기 (kind 셋) ══ */
for (const k of Object.keys(KINDS)) {
  test(`P1 ★${k} — A 에서 복사, 꺼진 B 에 붙여넣고 Enter → B 가 켜지고 값이 A 와 같다 · 칸 = 같은 번호 · 기본 서식 불변`, async ({ page }) => {
    const errs = await setup(page);
    const K = KINDS[k];
    const { id: a, clip } = await makeAndCopy(page, k, 'AAAAAA');
    const va = await varsOf(page, a, K.vars);
    const b = await insertText(page, 'BBBBBB');
    await openPanel(page, b);
    expect(await isOn(page, b, k), `★전제 — B 에 이미 ${k} 가 있다`).toBe(false);
    expect(await page.inputValue(`#txt-${k}-code`), '★전제 — 꺼진 B 의 칸이 비어 있지 않다').toBe('');
    const f0 = await fontOf(page, b);
    const t0 = await tipOf(page);
    await paste(page, k, clip);
    await waitOn(page, b, k);
    expect(await varsOf(page, b, K.vars), '★B 의 값이 A 와 다르다').toEqual(va);
    await expect.poll(() => page.inputValue(`#txt-${k}-code`), '★다시 그린 B 칸이 붙여넣은 번호가 아니다').toBe(clip);
    expect(await fontOf(page, b), '★폰트·크기·굵기·글자색까지 바뀌었다').toEqual(f0);
    const t1 = await tipOf(page);
    expect([t1.action, t1.pos - t0.pos], '★붙여넣기가 히스토리 «한 칸»이 아니다').toEqual([K.label, 1]);
    expect((await toasts(page)).filter(t => t.startsWith('⚠️')), '★맞는 번호인데 경고가 떴다').toEqual([]);
    expect(errs).toEqual([]);
  });
}

/* ══ P2 저장 왕복 ══ */
test('P2 ★저장 왕복 — 붙여넣은 B 를 저장·재기동·다시 열어도 span·값·칸 번호가 그대로', async ({ page }) => {
  await setup(page);
  const { id: a, clip } = await makeAndCopy(page, 'hl', 'AAAAAA');
  const b = await insertText(page, 'BBBBBB');
  await openPanel(page, b);
  await paste(page, 'hl', clip);
  await waitOn(page, b, 'hl');
  const vb = await varsOf(page, b, KINDS.hl.vars);
  const snap = await page.evaluate(() => window.serializeProject());
  expect(/--tb-hl-color/.test(snap), '★저장본에 형광펜 색이 안 실렸다').toBe(true);
  const errs = await bootApp(page);
  await page.evaluate((d) => window.applyProjectData(JSON.parse(d)), snap);
  await page.waitForFunction(([i, j]) => !!document.getElementById(i) && !!document.getElementById(j), [a, b]);
  await waitOn(page, b, 'hl');
  expect(await varsOf(page, b, KINDS.hl.vars), '★다시 연 뒤 값이 바뀌었다').toEqual(vb);
  await openPanel(page, b);
  await expect.poll(() => page.inputValue('#txt-hl-code'), '★다시 연 뒤 칸 번호가 다르다').toBe(clip);
  expect(errs).toEqual([]);
});

/* ══ P3 ⌘Z 한 걸음 ══ */
test('P3 ★⌘Z — 붙여넣기 한 번은 한 걸음에 붙여넣기 전으로 돌아간다', async ({ page }) => {
  const errs = await setup(page);
  const { clip } = await makeAndCopy(page, 'hl', 'AAAAAA');
  const b = await insertText(page, 'BBBBBB');
  await openPanel(page, b);
  const before = await snapOf(page, b);
  const t0 = await tipOf(page);
  await paste(page, 'hl', clip);
  await waitOn(page, b, 'hl');
  const t1 = await tipOf(page);
  expect([t1.action, t1.pos - t0.pos], '★붙여넣기가 히스토리 «한 칸»이 아니다').toEqual(['최근 형광펜', 1]);
  expect(await snapOf(page, b), '★양성대조 — 붙여넣기 뒤에도 B 가 전과 같다(아래 «같다»가 공짜가 된다)').not.toBe(before);
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Meta+z');
  await waitOn(page, b, 'hl', false);
  expect(await page.evaluate((i) => ['--tb-hl-color', '--tb-hl-h', '--tb-hl-y'].map(n => document.getElementById(i).style.getPropertyValue(n)), b),
    '★⌘Z 한 번 뒤에 인라인 형광펜 값이 남았다').toEqual(['', '', '']);
  expect(await snapOf(page, b), '★⌘Z 한 번으로 붙여넣기 전 모습이 안 돌아왔다').toBe(before);
  expect(errs).toEqual([]);
});

/* ══ P4 틀린 번호 ══ */
test('P4 ★틀린 번호 — 체크섬·버전·다른 kind·복합·glow → B 불변 · 까닭 알림 · 히스토리 불변', async ({ page }) => {
  const errs = await setup(page);
  const b = await insertText(page, 'BBBBBB');
  await openPanel(page, b);
  const codes = await page.evaluate(async () => {
    const C = await import(new URL('js/props/text-style-code.js', location.href).href);
    const Kd = await import(new URL('js/props/text-style-kinds.js', location.href).href);
    const R = Kd.TEXT_STYLE_KINDS;
    const hlV = { '--tb-hl-color': '#22aa55', '--tb-hl-h': '40%', '--tb-hl-y': '0px' };
    const good = C.tsEncodeOne(R, 'hl', hlV);
    const last = good.slice(-1);
    return {
      good,
      sum: good.slice(0, -1) + (last === 'a' ? 'b' : 'a'),
      ver: good.replace(/^T1-/, 'T2-'),
      dot: C.tsEncodeOne(R, 'dot', { '--tb-dot-color': '#ff0000', '--tb-dot-size': '6px', '--tb-dot-gap': '0px', '--tb-dot-x': '0px', '--tb-dot-y': '0px' }),
      comp: C.tsEncode(R, { hl: hlV, dot: null, ul: null }),
      glow: C.tsEncodeOne(R, 'glow', { '--tb-glow-color': '#ff00ff', '--tb-glow-k': '0.7' }),
    };
  });
  const cases = [['sum', '체크섬'], ['ver', '버전'], ['dot', '점 번호다'], ['comp', '복합'], ['glow', '글로우']];
  const snap0 = await snapOf(page, b);
  const undo0 = await tipOf(page);
  for (const [key, why] of cases) {
    const bad = codes[key];
    expect(typeof bad === 'string' && bad.length > 0 && bad !== codes.good, `★전제 — ${key} 입력이 맞는 번호와 같다/비었다: ${bad}`).toBe(true);
    const n0 = (await toasts(page)).length;
    await paste(page, 'hl', bad);
    await expect.poll(async () => (await toasts(page)).length, `★${key}: 알림이 안 떴다`).toBeGreaterThan(n0);
    const t = (await toasts(page)).slice(n0);
    expect(t.some(m => m.includes(why)), `★${key}: 까닭(${why})이 알림에 없다: ${JSON.stringify(t)}`).toBe(true);
    expect(await snapOf(page, b), `★${key}: 틀린 번호인데 B 가 바뀌었다`).toBe(snap0);
    expect(await tipOf(page), `★${key}: 히스토리가 늘었다`).toEqual(undo0);
    expect(await isOn(page, b, 'hl')).toBe(false);
    await expect.poll(() => page.inputValue('#txt-hl-code'), `★${key}: 칸이 되돌려지지 않았다`).toBe('');
  }
  /* ★양성대조 — 같은 칸에 맞는 번호는 입는다(위 «불변»이 칸이 죽어서가 아니다) */
  await paste(page, 'hl', codes.good);
  await waitOn(page, b, 'hl');
  expect(errs).toEqual([]);
});

/* ══ P5 빈 칸 ══ */
test('P5 ★빈 칸 Enter — 아무 일 없음 · 알림 0 · 히스토리 불변 · 칸은 지금 번호로 복원', async ({ page }) => {
  const errs = await setup(page);
  const { id: a, clip } = await makeAndCopy(page, 'hl', 'AAAAAA');
  const snap0 = await snapOf(page, a);
  const undo0 = await tipOf(page);
  const n0 = (await toasts(page)).length;
  await paste(page, 'hl', '');
  await expect.poll(() => page.inputValue('#txt-hl-code'), '★빈 칸 Enter 뒤 칸이 지금 번호로 안 돌아왔다').toBe(clip);
  expect(await snapOf(page, a), '★빈 칸인데 A 가 바뀌었다').toBe(snap0);
  expect(await tipOf(page), '★히스토리가 움직였다').toEqual(undo0);
  expect((await toasts(page)).slice(n0), '★빈 칸인데 알림이 떴다').toEqual([]);
  expect(errs).toEqual([]);
});

/* ══ P6 빈 조각 ══ */
test('P6 ★빈 조각(끈 번호) — TS_EMPTY_MEANS 미정 → B 불변 + 「뜻 미정」 알림', async ({ page }) => {
  const errs = await setup(page);
  const { id: a } = await makeAndCopy(page, 'hl', 'AAAAAA');
  const r = await page.evaluate(async () => {
    const C = await import(new URL('js/props/text-style-code.js', location.href).href);
    const Kd = await import(new URL('js/props/text-style-kinds.js', location.href).href);
    return { off: C.tsEncodeOne(Kd.TEXT_STYLE_KINDS, 'hl', null), means: C.TS_EMPTY_MEANS };
  });
  expect(r.means, '★전제 — 뜻이 정해졌다(이 칸을 다시 써야 한다)').toBe('UNDECIDED');
  expect(r.off).toMatch(/^T1-hl:-[0-9a-z]{2}$/);
  const snap0 = await snapOf(page, a);
  const undo0 = await tipOf(page);
  const n0 = (await toasts(page)).length;
  await paste(page, 'hl', r.off);
  await expect.poll(async () => (await toasts(page)).length, '★끈 번호에 알림이 없다').toBeGreaterThan(n0);
  expect((await toasts(page)).slice(n0).some(m => m.includes('뜻 미정')), '★까닭(뜻 미정)이 없다').toBe(true);
  expect(await snapOf(page, a), '★끈 번호가 A 를 바꿨다').toBe(snap0);
  expect(await isOn(page, a, 'hl')).toBe(true);
  expect(await tipOf(page), '★히스토리가 움직였다').toEqual(undo0);
  expect(errs).toEqual([]);
});
