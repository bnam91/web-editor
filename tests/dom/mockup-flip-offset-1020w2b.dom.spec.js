/* mockup-flip-offset-1020w2b — ★플립·회전된 «스택» 프레임 안의 목업(흐름 자식) ⌘드래그 오프셋 ＋ 섹션 밖 크롭 (W2B ⒜)
 *
 * ★무엇을 잠그나 — 불변식 둘:
 *   ⑴ ⌘드래그(가로 오프셋 translateX)에서 ★목업이 ★손을 따라간다 — 화면 Δ = 손 Δ 를 ★목업이 움직일 수 있는 축에 내린 것.
 *      목업 오프셋은 ★로컬 x 한 축뿐이다 ⇒ rotate90 프레임에선 그 축이 ★화면 세로다(가로로 끌면 안 움직이는 것이 맞다).
 *   ⑵ 섹션 밖 크롭(`--sec-clip: inset(t r b l)`)은 ★목업 «자기» 상자의 변이다 ⇒ 화면에서 섹션 밖으로 나간 ★그 쪽이
 *      ★그 양만큼 잘려야 한다(flipH 면 화면 왼쪽 = 로컬 오른쪽 · rotate90 이면 화면 왼쪽 = 로컬 아래).
 * ★바꾸기 전 판(a42d76d5) 실측(줌 40% · ⌘(+60,0)): 모델Δ 가 ★다섯 꼴 전부 +150 · 화면Δ flipH/둘다 [−60,0] · rot90 [0,+60]
 *   ⇒ 반대·축뒤바뀜 3/5. 크롭은 flipH/둘다/rot90 에서 ★잘리는 변이 틀렸다.
 * ★장면은 ★앱의 제 문으로만 짓는다(HANDOFF ⑧): 섹션(+단추) → 프레임(fp-btn addFrameBlock) → 목업 A(플러그인 → 목업 모달 → 삽입)
 *   → 프레임 선택 → `#ss-to-stack-btn` → A 클릭(드릴인) → 목업 B 삽입 ⇒ ★B = frame > row > mockup(흐름 자식).
 *   ⛔빈 프레임은 stack 변환이 안 된다(alert 「변환할 자식이 없습니다」) — 그래서 A 가 먼저 있다.
 *   플립·회전 = 프로퍼티 패널 `#ss-flip-h` / `#ss-flip-v` / `#ss-rotate-90` 클릭. ⌘드래그 = 진짜 마우스(Meta 눌림).
 * ★rect 는 ★가라앉기(waitStableRect) ＋ ★두 번 읽어 같은가 를 같이 건다. ⛔고정 대기 0.
 * ★양성대조: GD1001_ROOT=<a42d76d5 풀 sha 아카이브> 로 돌리면 M-flipH·M-both·M-rot90 이 빨갛다(×3 실측 — 보고서). */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');

const ZOOM = 40;
/* ★꼴마다 ★손으로 적은 기대값(⛔피검 코드에서 뽑지 않는다):
 *   hx = 로컬 +x 가 화면에서 가는 방향(목업 오프셋 축) · map = 화면 변 → 로컬 변(inset 의 어느 칸이 잘려야 하나) */
const FORMS = [
  { name: 'none',  clicks: [],                           tf: /scale\(1, 1\)|^$/, hx: [1, 0],  map: { L: 'l', R: 'r', T: 't', B: 'b' } },
  { name: 'flipH', clicks: ['#ss-flip-h'],               tf: /scale\(-1, 1\)/,   hx: [-1, 0], map: { L: 'r', R: 'l', T: 't', B: 'b' } },
  { name: 'flipV', clicks: ['#ss-flip-v'],               tf: /scale\(1, -1\)/,   hx: [1, 0],  map: { L: 'l', R: 'r', T: 'b', B: 't' } },
  { name: 'both',  clicks: ['#ss-flip-h', '#ss-flip-v'], tf: /scale\(-1, -1\)/,  hx: [-1, 0], map: { L: 'r', R: 'l', T: 'b', B: 't' } },
  /* rotate(90deg): 로컬 +x → 화면 +y(아래) · 로컬 +y → 화면 −x(왼쪽) ⇒ 화면 왼쪽 끝 = 로컬 아래 변 */
  { name: 'rot90', clicks: ['#ss-rotate-90'],            tf: /rotate\(90deg\)/,  hx: [0, 1],  map: { L: 'b', R: 't', T: 'l', B: 'r' } },
];

/** 가라앉은 rect 를 ★두 번 읽어 같은지 단언하고 돌려준다(정수 px · cx/cy 포함) */
async function rect2(page, sel) {
  const a = await waitStableRect(page, sel);
  const b = await waitStableRect(page, sel);
  expect(b, `★rect 두 번 읽기가 갈렸다 — ${sel}`).toEqual(a);
  return a;
}
/** 실수 rect 를 두 번 읽어 같은지(가라앉기는 rect2 로 먼저 건다) */
async function raw2(page, ids) {
  const read = () => page.evaluate((ids) => Object.fromEntries(Object.entries(ids).map(([k, id]) => {
    const r = document.getElementById(id).getBoundingClientRect();
    return [k, { left: r.left, top: r.top, right: r.right, bottom: r.bottom }];
  })), ids);
  const a = await read(); const b = await read();
  expect(b, '★실수 rect 두 번 읽기가 갈렸다').toEqual(a);
  return a;
}

async function openMockupAndInsert(page) {
  if (!(await page.isVisible('#plugin-mockup'))) await page.click('#fp-plugin-btn');
  await page.click('#plugin-mockup');
  await page.click('.mkp-device-card[data-device="iphone"]');
  await page.click('#mkp-insert-btn');
}

async function scene(page, form) {
  await page.setViewportSize({ width: 1600, height: 1200 });
  const errs = await bootApp(page);
  page.on('dialog', (d) => { errs.push('dialog: ' + d.message()); d.dismiss(); });
  await page.evaluate(() => { document.querySelectorAll('#canvas .section-block').forEach((s) => s.remove()); });
  await page.click('.fp-btn.primary[onclick="addSection()"]');
  const before = await page.evaluate(() => [...document.querySelectorAll('#canvas .frame-block')].map((e) => e.id));
  await page.click('.fp-btn[onclick="addFrameBlock()"]');
  const fid = await page.evaluate((b) => [...document.querySelectorAll('#canvas .frame-block')].map((e) => e.id).find((id) => !b.includes(id)), before);
  expect(fid, '★전제: 프레임 단추가 프레임을 만들었다').toBeTruthy();
  await openMockupAndInsert(page);                                   // 목업 A(자유배치 프레임 안)
  const aId = await page.evaluate(() => document.querySelector('#canvas .mockup-block')?.id);
  expect(aId, '★전제: 목업 A 가 생겼다').toBeTruthy();
  const fr = await rect2(page, '#' + fid);
  await page.mouse.click(fr.left + 5, fr.top + 5);                   // 프레임(빈 자리) 선택
  await page.click('#ss-to-stack-btn');
  await page.waitForFunction((id) => document.getElementById(id).dataset.freeLayout !== 'true', fid);
  const ar = await rect2(page, '#' + aId);
  await page.mouse.click(ar.cx, ar.cy);                              // A 클릭(드릴인)
  if (!(await page.evaluate((a) => document.getElementById(a).classList.contains('selected'), aId))) await page.mouse.click(ar.cx, ar.cy);
  await openMockupAndInsert(page);                                   // 목업 B(스택 프레임 > row > mockup)
  const mid = await page.evaluate((a) => [...document.querySelectorAll('#canvas .mockup-block')].find((m) => m.id !== a)?.id, aId);
  expect(mid, '★전제: 목업 B 가 생겼다').toBeTruthy();
  // 프레임 선택 → 꼴 단추
  const fr2 = await rect2(page, '#' + fid);
  await page.mouse.click(fr2.left + 5, fr2.top + 5);
  await page.waitForSelector('#ss-flip-h');
  for (const c of form.clicks) await page.click(c);
  await page.evaluate((z) => window.applyZoom(z), ZOOM);
  const secId = await page.evaluate((m) => { const s = document.getElementById(m).closest('.section-block'); return s.id; }, mid);
  await rect2(page, '#' + mid);
  const pre = await page.evaluate(([fid, mid]) => {
    const f = document.getElementById(fid), m = document.getElementById(mid);
    return {
      scaler: document.getElementById('canvas-scaler').style.transform,
      free: f.dataset.freeLayout ?? null,
      pos: m.style.position,
      parentIsRow: m.parentElement.classList.contains('row'),
      rowInFrame: m.parentElement.parentElement === f,
      ft: f.style.transform,
      fOverflow: getComputedStyle(f).overflow,
      off: m.dataset.offsetX ?? null,
    };
  }, [fid, mid]);
  return { errs, fid, mid, secId, pre };
}

/** ⌘(Meta) 진짜 마우스 끌기 — 6틱 */
async function cmdDrag(page, x, y, dx, dy) {
  await page.keyboard.down('Meta');
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 1; i <= 6; i++) await page.mouse.move(x + (dx * i) / 6, y + (dy * i) / 6);
  await page.mouse.up();
  await page.keyboard.up('Meta');
}

/** 목업의 style 쓰기 수(★autosave 옵저버가 «편집»으로 읽는 attributes:style) · pushHistory 부름 수 */
const armCounters = (page, mid) => page.evaluate((mid) => {
  const m = document.getElementById(mid);
  window.__w2b = { style: 0, hist: 0 };
  new MutationObserver((ms) => { for (const r of ms) if (r.attributeName === 'style') window.__w2b.style++; }).observe(m, { attributes: true });
  const ph = window.pushHistory;
  window.pushHistory = function (...a) { window.__w2b.hist++; return ph.apply(this, a); };
}, mid);
const counters = (page) => page.evaluate(() => new Promise((res) => setTimeout(() => res({ ...window.__w2b }), 0)));
const model = (page, mid) => page.evaluate((mid) => { const m = document.getElementById(mid); return { off: parseInt(m.dataset.offsetX) || 0, tf: m.style.transform, left: m.style.left, clip: m.style.getPropertyValue('--sec-clip'), style: m.getAttribute('style') }; }, mid);

/** 목업 선택 풀기 — ★프레임(빈 구석)을 클릭해 프레임을 고른다(장면을 지을 때와 같은 문).
 *  ⌘+클릭(안 움직인 끌기)은 다중선택으로 목업을 고른다 ⇒ 선택 중엔 크롭이 풀린다(.mockup-block.selected{clip-path:none}).
 *  ⛔Esc(deselectAll)는 안 쓴다 — 프레임까지 풀리면 스택 프레임 자식이 맞지 않는다(실측: 누른 점의 맨 위가 프레임이 됐다). */
async function unselect(page, s) {
  /* ★상태 = 「프레임이 골라져 있고(.frame-block.selected ⇒ 자식이 맞는다 · css/editor-blocks.css 「선택 상태: 자식 pointer-events 복원」)
     목업은 안 골라짐」. ⌘+클릭(안 움직임)은 이 상태를 바꾼다(실측: rot90 A 뒤 누른 점의 맨 위가 ss_…) ⇒ 그 상태가 아니면
     프레임 구석을 클릭한다. ⚠️이미 골라진 프레임을 또 누르면 풀린다(실측) ⇒ 상태를 보고 누른다(최대 3번) */
  const ok = () => page.evaluate(([f, m]) => document.getElementById(f).classList.contains('selected') && !document.getElementById(m).classList.contains('selected'), [s.fid, s.mid]);
  for (let i = 0; i < 3 && !(await ok()); i++) {
    /* 구석 = 프레임 AABB ∩ 섹션 의 왼위(+5) — rot90 프레임은 섹션보다 넓어 AABB 구석이 섹션 밖이다 */
    const fr = await rect2(page, '#' + s.fid), sr = await rect2(page, '#' + s.secId);
    await page.mouse.click(Math.max(fr.left, sr.left) + 5, Math.max(fr.top, sr.top) + 5);
  }
  expect(await ok(), '★전제: 프레임 골라짐 · 목업 안 골라짐').toBe(true);
}

/** 한 번 끌고 ★모델Δ·화면Δ·갈래 마커 */
async function dragOnce(page, s, dx, dy, tag) {
  await unselect(page, s);
  const r0 = await rect2(page, '#' + s.mid);
  const m0 = await model(page, s.mid);
  /* 누르는 점의 맨 위 요소 — 목업(또는 그 자손)이어야 ⌘ 갈래가 mousedown 을 받는다 */
  const top = await page.evaluate(([x, y, mid]) => { const e = document.elementFromPoint(x, y); const m = document.getElementById(mid); return { onMockup: !!e && (e === m || m.contains(e)), el: e ? (e.id || e.className || e.tagName) + '' : null }; }, [r0.cx, r0.cy, s.mid]);
  await cmdDrag(page, r0.cx, r0.cy, dx, dy);
  const r1 = await rect2(page, '#' + s.mid);
  const m1 = await model(page, s.mid);
  const out = { tag, top, hand: [dx, dy], dModel: m1.off - m0.off, dScreen: [r1.left - r0.left, r1.top - r0.top], tf: m1.tf, left: m1.left,
    /* 갈래 마커: ⌘ 오프셋 onMove 가 돌았나 = offsetX·transform 이 그것이 쓰는 꼴로 바뀌었나(흐름 목업에 그것 말고 쓰는 자 없음) */
    branchOffset: m1.off !== m0.off && m1.tf === (m1.off ? `translateX(${m1.off}px)` : '') ? 'onMove(⌘offset) 돎' : (m1.off === m0.off ? '안 움직임(문턱 미달 또는 onMove 안 돎)' : '다른 자가 씀') };
  return out;
}

/** 크롭 — 화면 넘침(섹션 밖) vs --sec-clip 의 변·양 vs ★사용자가 보는 잘림(elementsFromPoint 훑기) */
async function cropProbe(page, s, form) {
  await unselect(page, s);
  await rect2(page, '#' + s.mid);
  const R = await raw2(page, { m: s.mid, s: s.secId, f: s.fid });
  const m = await model(page, s.mid);
  const O = { L: Math.max(0, R.s.left - R.m.left), R: Math.max(0, R.m.right - R.s.right), T: Math.max(0, R.s.top - R.m.top), B: Math.max(0, R.m.bottom - R.s.bottom) };
  const inset = (() => { const q = /inset\(([-\d.]+)px ([-\d.]+)px ([-\d.]+)px ([-\d.]+)px\)/.exec(m.clip || ''); return q ? { t: +q[1], r: +q[2], b: +q[3], l: +q[4] } : null; })();
  const exp = { t: 0, r: 0, b: 0, l: 0 };
  for (const k of ['L', 'R', 'T', 'B']) exp[form.map[k]] = Math.round(O[k] / (ZOOM / 100));
  /* 보이는 구간 — 가로선(목업 세로 가운데)·세로선(가로 가운데)을 1px 씩 훑어 목업이 맞는 구간 */
  const vis = await page.evaluate(([mid, R]) => {
    const m = document.getElementById(mid);
    const hit = (x, y) => document.elementsFromPoint(x, y).some((e) => e === m || m.contains(e));
    const cy = (Math.max(R.m.top, R.s.top, R.f.top) + Math.min(R.m.bottom, R.s.bottom, R.f.bottom)) / 2;
    const cx = (Math.max(R.m.left, R.s.left, R.f.left) + Math.min(R.m.right, R.s.right, R.f.right)) / 2;
    let x0 = null, x1 = null, y0 = null, y1 = null;
    for (let x = Math.floor(R.m.left) - 2; x <= Math.ceil(R.m.right) + 2; x++) if (hit(x + 0.5, cy)) { if (x0 === null) x0 = x; x1 = x + 1; }
    for (let y = Math.floor(R.m.top) - 2; y <= Math.ceil(R.m.bottom) + 2; y++) if (hit(cx, y + 0.5)) { if (y0 === null) y0 = y; y1 = y + 1; }
    return { x0, x1, y0, y1, sel: m.classList.contains('selected') };
  }, [s.mid, R]);
  /* 기대 보이는 구간 = 목업 ∩ 섹션 ∩ 프레임(프레임 overflow:hidden · 플립/90° 라 AABB = 그 상자) */
  const ev = { x0: Math.max(R.m.left, R.s.left, R.f.left), x1: Math.min(R.m.right, R.s.right, R.f.right), y0: Math.max(R.m.top, R.s.top, R.f.top), y1: Math.min(R.m.bottom, R.s.bottom, R.f.bottom) };
  const visErr = vis.x0 === null ? null : Math.max(Math.abs(vis.x0 - ev.x0), Math.abs(vis.x1 - ev.x1), Math.abs(vis.y0 - ev.y0), Math.abs(vis.y1 - ev.y1));
  return { O: Object.fromEntries(Object.entries(O).map(([k, v]) => [k, +v.toFixed(2)])), clip: m.clip, inset, exp, branchClip: m.clip ? 'set' : 'remove(또는 안 돎)', vis, ev: Object.fromEntries(Object.entries(ev).map(([k, v]) => [k, +v.toFixed(2)])), visErr };
}

for (const form of FORMS) {
  test(`M-${form.name} ★스택 프레임(${form.name}) > row > 목업 — ⌘드래그가 손을 따라가고 섹션 밖 크롭이 나간 쪽을 자른다`, async ({ page }) => {
    const s = await scene(page, form);
    /* ★전제 — 이름에 붙인 조건을 재기 전에 단언한다 */
    expect(s.errs, s.errs.join(' | ')).toEqual([]);
    expect(s.pre.scaler, '★전제: 줌 40%').toMatch(/scale\(0\.4\)/);
    expect(s.pre.free, '★전제: 자유배치 프레임이 아니다(스택)').not.toBe('true');
    expect(s.pre.pos, '★전제: 목업이 absolute 가 아니다(흐름 자식)').not.toBe('absolute');
    expect([s.pre.parentIsRow, s.pre.rowInFrame], '★전제: frame > row > mockup').toEqual([true, true]);
    expect(s.pre.ft, `★전제: 프레임 변환이 ${form.name} 꼴이다`).toMatch(form.tf);
    await armCounters(page, s.mid);

    /* ⑴ ⌘(+60,0) */
    const A = await dragOnce(page, s, 60, 0, 'A(+60,0)');
    const drags = [A];
    if (form.name === 'rot90') drags.push(await dragOnce(page, s, 0, 60, 'B(0,+60)'));
    const cAfterDrags = await counters(page);
    /* ⑵ 크롭 — 먼저 섹션 밖으로 삐져나오게 심는다(안 그러면 --sec-clip 이 빠져 그 갈래가 안 돈다)
       플립 꼴: (+84,0) ⇒ 섹션 오른쪽(또는 핀에선 왼쪽)으로 ~20 화면px · rot90: 회전한 프레임이 이미 섹션보다 넓다 ⇒ (+20,+20) 로 갈래만 돌린다 */
    const P = form.name === 'rot90' ? await dragOnce(page, s, 20, 20, 'P(+20,+20)') : await dragOnce(page, s, 84, 0, 'P(+84,0)');
    const C = await cropProbe(page, s, form);
    const cEnd = await counters(page);
    console.log(`[W2B ${form.name}] pre ${JSON.stringify(s.pre)}`);
    for (const d of [...drags, P]) console.log(`[W2B ${form.name}] drag ${d.tag} 누른점 ${JSON.stringify(d.top)} 모델Δ ${d.dModel} 화면Δ ${JSON.stringify(d.dScreen)} · ${d.branchOffset} · tf=${d.tf} left='${d.left}'`);
    console.log(`[W2B ${form.name}] crop 화면넘침 ${JSON.stringify(C.O)} · --sec-clip=${C.clip || '(없음)'} [${C.branchClip}] · 기대 inset(t r b l)=${JSON.stringify(C.exp)} · 보이는 ${JSON.stringify(C.vis)} 기대 ${JSON.stringify(C.ev)} 어긋남 ${C.visErr}`);
    console.log(`[W2B ${form.name}] counters 끌기 후 ${JSON.stringify(cAfterDrags)} · 끝 ${JSON.stringify(cEnd)}`);

    /* ⑴ 손을 따라간다 — 기대 화면Δ = 손Δ 를 오프셋 축(hx)에 내린 것 */
    for (const d of [...drags, P]) expect(d.top.onMockup, `★전제: ${d.tag} 누른 점이 목업 위다(맨 위 ${d.top.el})`).toBe(true);
    for (const d of drags) {
      const along = d.hand[0] * form.hx[0] + d.hand[1] * form.hx[1];
      const expScreen = [along * form.hx[0], along * form.hx[1]];
      expect(Math.abs(d.dScreen[0] - expScreen[0]) <= 1 && Math.abs(d.dScreen[1] - expScreen[1]) <= 1,
        `${form.name} ${d.tag}: 화면Δ ${JSON.stringify(d.dScreen)} ≠ 기대 ${JSON.stringify(expScreen)} (모델Δ ${d.dModel})`).toBe(true);
      expect(Math.abs(d.dModel - along / (ZOOM / 100)) <= 1, `${form.name} ${d.tag}: 모델Δ ${d.dModel} ≠ 기대 ${along / (ZOOM / 100)}`).toBe(true);
      if (along) expect(d.branchOffset, '★갈래: ⌘ 오프셋 onMove 가 돌았다').toBe('onMove(⌘offset) 돎');
      expect(d.left, '★측정 쓰기(left)가 남지 않았다').toBe('');
    }
    expect(P.branchOffset, '★갈래: 심기 끌기에서 ⌘ 오프셋 onMove 가 돌았다').toBe('onMove(⌘offset) 돎');
    /* ⑵ 크롭 */
    expect(Math.max(C.O.L, C.O.R, C.O.T, C.O.B), '★전제: 목업이 섹션 밖으로 나갔다(넘침 > 4 화면px)').toBeGreaterThan(4);
    expect(C.branchClip, '★갈래: _updateMockupSecClip 의 set 갈래가 돌았다').toBe('set');
    expect(C.vis.sel, '★전제: 목업이 선택되지 않았다(선택 중엔 크롭이 풀린다)').toBe(false);
    for (const k of ['t', 'r', 'b', 'l']) {
      expect(Math.abs(C.inset[k] - C.exp[k]) <= 1, `${form.name} --sec-clip 의 ${k} = ${C.inset[k]} ≠ 기대 ${C.exp[k]} (화면넘침 ${JSON.stringify(C.O)} · ${C.clip})`).toBe(true);
    }
    expect(C.visErr !== null && C.visErr <= 2, `${form.name} 보이는 구간 ${JSON.stringify(C.vis)} ≠ 목업∩섹션∩프레임 ${JSON.stringify(C.ev)}`).toBe(true);
    /* 히스토리 — ★움직인 끌기 한 번에 pushHistory ★두 번(arm 의 시작 표본 1 + onUp 1 · js/drag-history.js — 핀 a42d76d5 실측 값).
       ★측정 쓰기(measureLocalBasis 의 left/top 잠깐 쓰기)가 칸을 늘리지 않는다 */
    const movedN = [...drags, P].filter((d) => d.dModel !== 0).length;
    expect(cEnd.hist, `pushHistory 수 ${cEnd.hist} ≠ 2 × 움직인 끌기 ${movedN}`).toBe(2 * movedN);
  });
}

/* N0 ★⌘+클릭(안 끌기)은 목업 style 을 ★한 번도 쓰지 않는다 — 기저 측정이 «움직임 뒤»에만 돈다(autosave 잡음 0 · 옛 판과 같다) */
test('N0 ★⌘+클릭만(안 끌기) — 목업 style 쓰기 0 · 오프셋 그대로 (flipH 프레임)', async ({ page }) => {
  const s = await scene(page, FORMS[1]);
  expect(s.errs, s.errs.join(' | ')).toEqual([]);
  expect(s.pre.free).not.toBe('true');
  await armCounters(page, s.mid);
  const r0 = await rect2(page, '#' + s.mid);
  const m0 = await model(page, s.mid);
  await cmdDrag(page, r0.cx, r0.cy, 0, 0);
  const m1 = await model(page, s.mid);
  const c = await counters(page);
  console.log(`[W2B N0] counters ${JSON.stringify(c)} · style 전후 같음 ${m0.style === m1.style}`);
  expect(c.style, '⌘+클릭만으로 목업 style 이 쓰였다').toBe(0);
  expect(m1.style).toBe(m0.style);
  expect(m1.off).toBe(m0.off);
});
