/* t3-01-dim-mid.dom.spec.js — t3-01 ⑸ 「치수선 가운데 조절점」(현빈 ㉠ GO · 261026)
 *   ★처방: js/annotation-select.js 손잡이 만드는 곳의 ★셋째 갈래(.annot-dim-mid · dimEnd 'M' · pointIdx 없음) + _startDimMidDrag
 *     = a·b 를 같은 만큼 평행이동(설계 ⓐ · 길이·각도 유지 · 각도 자석 0) · 저장 자리 = 이미 있는 dimA·dimB
 *   ★칸 — M1 가운데 손잡이(a·b 중점 · annot-handle · pointIdx 0) · M2 끌면 a·b 둘 다 같은 만큼(길이·각도 그대로)
 *     ③ ⌘Z 한 걸음 · ①④ 저장 문자열에 손잡이 0 · 고르기 전/후 저장 문자열 같음 · ⑥ _updateBlockGeometry 뒤 가운데 자리 그대로
 *     ② (조건형 · 지키는 칸) a 끌기 = 예전 그대로(a 만 움직이고 b 고정) — 고치기 전 판에서도 초록이어야 자가 산 것
 *   ⛔고정 대기 0 — 조건 대기만(헬퍼는 dimension-sticker-t3-01 의 것을 그대로 옮겼다).
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');
const { clickAt } = require('./_click-at.js');

const SEC = '[id="secA"]';
const cnt = (page, sel) => page.evaluate((s) => document.querySelectorAll(s).length, sel);

async function setup(page) {
  await bootApp(page);
  await page.evaluate(() => {
    document.getElementById('canvas').innerHTML =
      '<div class="section-block" id="secA" style="position:relative;height:420px;background:#f4f4f6"><div class="section-inner"></div></div>';
    window.rebindAll?.();
    window.buildLayerPanel?.();
  });
}

/** ★사람 손 그대로 — 펜 단추 → 메뉴 → 섹션 클릭 N 번. third 가 ∅ 면 ★두 번만 누른다. */
async function drawDim(page, { dx = 0, dy = 140, menu = 'Dimension', third = true } = {}) {
  await page.click('#fp-pen-btn');
  await page.click(`#fp-pen-menu .fp-menu-item:text-is("${menu}")`);
  await expect.poll(() => page.evaluate(() => document.body.classList.contains('pen-mode')),
    '★전제: 펜 모드가 켜졌다').toBe(true);
  const r = await waitStableRect(page, SEC);
  const x1 = r.left + r.width * 0.3, y1 = r.top + r.height * 0.4;
  const x2 = r.left + r.width * 0.6, y2 = y1;
  await clickAt(page, x1, y1, { sel: SEC }, { label: '①점' });
  await clickAt(page, x2, y2, { sel: SEC }, { label: '②점' });
  const mid = { x: (x1 + x2) / 2 + dx, y: y1 + dy };
  /* ★★③자리는 ★섹션 ★밖일 수 있다 — ★치수선은 ★선 바깥으로 빼는 것이라 ★경계를 ★자주 넘는다.
     ★제품은 ★그 클릭을 ★받는다(자리 고르는 중이면 ★이미 정해진 섹션을 쓴다 · 261021 고침).
     ⇒ ⛔여기서 `{sel: SEC}` 를 ★걸면 ★검사 ★헬퍼가 ★제품보다 ★좁아 ★거짓 빨강이 난다(이 벌의 첫 판이 그랬다). */
  if (third) await clickAt(page, mid.x, mid.y, null, { label: '③자리' });
  return { r, x1, y1, x2, y2, mid };
}

/** 치수선 중점을 ★섹션 좌표로 */
const dimMid = (page) => page.evaluate(() => {
  const l = document.querySelector('#secA .annot-dim-line');
  if (!l) return null;
  const N = (k) => Number(l.getAttribute(k));
  return [(N('x1') + N('x2')) / 2, (N('y1') + N('y2')) / 2];
});
const toSec = (page, cx, cy) => page.evaluate(([x, y]) => {
  const r = document.getElementById('secA').getBoundingClientRect();
  const z = (window.currentZoom || 40) / 100;
  return [(x - r.left) / z, (y - r.top) / z];
}, [cx, cy]);

/** ★만든 ★직후에는 ★라벨이 ★편집 상태다(_finalizeAnnotation 의 enterLabelEdit).
 *  ★그 상태에서 ★누르면 ★캐럿만 옮고 ★선택이 ★안 된다 — ★그 판이 ★flaky 였다(T3 1/3).
 *  ⇒ ★편집에서 ★빠져나온 것을 ★기다린 뒤 ★고른다. ★사람도 ★한 번 빠져나와야 고를 수 있다. */
async function selectDim(page) {
  /* ★★★261021 — ★이 벌의 ★흔들림은 ★여기 ★한 단언에 ★몰렸다(6회 중 T4 4 · T3 1 · 다른 칸 ★0).
     ★까닭: `Escape` 는 ★라벨에 ★걸린 keydown 이다(annotation-select.js:697 → label.blur() → finish).
       ⇒ ★★라벨에 ★포커스가 ★가기 ★전에 누르면 ★안 닿는다. ★사람은 ★포커스가 간 ★뒤에 누른다.
     ⇒ ★★「편집이 ★시작됐다」를 ★먼저 기다린다. ⛔그 전에 Escape 를 쏘면 ★제품이 아니라 ★검사가 ★빠른 것이다. */
  /* ★합침 261026(S7) — «편집에 들어갔다» = contenteditable 만이 아니라 ★포커스까지. 포커스는 setTimeout 0 뒤에 온다
     (annotation-select.js annotBeginLabelEdit 끝 · t4-21 검사(taeyang/t4-dimline)가 같은 것을 찾아 같은 꼴로 기다린다).
     바닥 ca702d40 에서도 이 칸 전제가 흔들렸다(T3 «편집에서 빠져나왔다» 빨강 · 261026 실측) = 검사가 빨랐다. */
  await expect.poll(() => page.evaluate(() => {
    const l = document.querySelector('#secA .annot-label');
    return l?.getAttribute('contenteditable') === 'true' && document.activeElement === l ? 'true' : (l?.getAttribute('contenteditable') ?? 'none');
  }), '★전제: 라벨이 ★편집에 ★들어갔다(만든 직후 enterLabelEdit · 포커스까지)', { timeout: 15000 }).toBe('true');
  /* ★★261021 ★대조 실측 — ★「라벨 밖(섹션 빈 모서리) 클릭」으로 ★바꿔 봤더니 ★★6/6 이 ★빨강이었다
     (T3·T4 ★둘 다 · unexpected). ⇒ ★★되돌렸다. ★Escape 쪽이 ★낫다(T4 ★2/6).
     ⚠️`Escape` 는 ★두 곳이 듣는다(라벨 편집 :697 · 고르기 해제 :32) — ★그 경쟁이 ★남은 2/6 로 보이나
       ★★대조로 ★증명하지 ★못했다. ⛔「그래서다」라 ★적지 않는다. */
  await page.keyboard.press('Escape');                       // 라벨 편집 종료
  await expect.poll(() => page.evaluate(() =>
    document.querySelector('#secA .annot-label')?.getAttribute('contenteditable') ?? 'none'),
    '★전제: 라벨이 ★편집에서 빠져나왔다', { timeout: 15000 }).not.toBe('true');
  await page.keyboard.press('Escape');                       // 펜 모드 종료
  await expect.poll(() => page.evaluate(() => document.body.classList.contains('pen-mode')),
    '★전제: 펜 모드가 꺼졌다').toBe(false);
  /* ★★1.5px 선이 아니라 ★면적이 있는 ★라벨을 누른다 — ⛔「선택이 안 된다」를 규칙으로 읽지 마라, ★면적이다 */
  await page.click('#secA .annot-label', { force: true });
  /* ★★전제를 ★갈라 센다 — ⛔「손잡이 4」 하나만 재면 ★「★안 골랐다」와 ★「★손잡이가 ★안 선다」가 ★구분 안 된다.
     ★그리고 ★부하가 걸린 회차(18~24초)에서 ★흔들렸다 ⇒ ★★기다림을 ★넉넉히(15초) 준다.
     ⛔「기다리면 통과」는 ★약한 자다 — ★그래서 ★무엇을 기다리는지 ★이름을 ★붙여 ★갈라 둔다. */
  await expect.poll(() => page.evaluate(() =>
    !!document.querySelector('#secA .annotation-block.selected')),
    '★전제: 블럭이 ★골라졌다(클릭이 ★먹었다)', { timeout: 15000 }).toBe(true);
  /* ★1013t2C6(S7) 의 라벨 상자 너비 손잡이 둘(.annot-lw-handle)도 annot-handle 클래스를 단다(철거 명부를 같이 타려고) —
     이 칸이 세려는 것은 d·c·a·b 넷이다 ⇒ 그 둘을 빼고 센다(annotation-1013 AN2 · 1017t1h1 SN2 와 같은 좁힘). */
  /* ★t3-01 ⑸(S3 · 261026) — 가운데 조절점(.annot-dim-mid)도 annot-handle 을 단다(철거·저장 제외 명부) ⇒ 같은 좁힘으로 뺀다 · 뜻(d·c·a·b 넷)은 그대로 */
  await expect.poll(() => cnt(page, '#secA .annot-handle:not(.annot-lw-handle):not(.annot-dim-mid)'),
    '★골랐는데 ★손잡이가 ★넷이 아니다', { timeout: 15000 }).toBe(4);
}

/* ★펜 손(drawDim·selectDim)은 쓰지 않는다 — 그 헬퍼의 «라벨 편집에서 빠져나왔다» 전제가 고치기 전 판(336bb4af)에서도 2/4 흔들린다(S3 실측 ·
     원 검사 dimension-sticker-t3-01 T3·T4). 이 벌이 재는 것은 «손잡이와 끌기»라 치수선은 팩토리로 바로 놓고, 고르기만 사람 클릭으로. */
async function placeDim(page) {
  await bootApp(page);
  await page.evaluate(() => {
    document.getElementById('canvas').innerHTML = '<div class="section-block" id="secA" style="position:relative;height:420px;background:#f4f4f6"><div class="section-inner"></div></div>';
    window.rebindAll?.();
    const sec = document.getElementById('secA');
    const b = window.makeAnnotationBlock({ points: [[200, 160], [500, 160]], text: '수치입력', annotKind: 'dim', dimOffset: 60 });
    sec.appendChild(b); window.bindAnnotationSelect?.(b); window.deselectAll?.(); window.buildLayerPanel?.();
  });
  const r = await waitStableRect(page, '#secA .annot-label');
  await page.mouse.click(r.cx, r.cy);
  await expect.poll(() => page.evaluate(() => !!document.querySelector('#secA .annotation-block.selected') && document.querySelectorAll('#secA .annot-dim-handle').length === 2), '전제: 골랐고 a·b 손잡이 섰다(가운데는 재는 칸 — 전제에 안 넣는다)', { timeout: 15000 }).toBe(true);
}
const selectDim2 = async (page) => { await page.click('#secA .annot-label', { force: true }); await expect.poll(() => page.evaluate(() => !!document.querySelector('#secA .annot-dim-mid')), '전제: 다시 고름', { timeout: 15000 }).toBe(true); };
const ends = (page) => page.evaluate(() => { const l = document.querySelector('#secA .annot-dim-line'); const N = (k) => Number(l.getAttribute(k)); return [[N('x1'), N('y1')], [N('x2'), N('y2')]]; });
const midH = (page) => page.evaluate(() => { const h = document.querySelector('#secA .annot-dim-mid'); if (!h) return null; const r = h.getBoundingClientRect();
  return { cx: Number(h.getAttribute('cx')), cy: Number(h.getAttribute('cy')), x: r.left + r.width / 2, y: r.top + r.height / 2, cls: h.getAttribute('class'), pointIdx: h.dataset.pointIdx ?? null, dimEnd: h.dataset.dimEnd ?? null }; });
const zoomK = (page) => page.evaluate(() => (window.currentZoom || 40) / 100);
const r1 = (v) => Math.round(v * 10) / 10;

test.describe('t3-01 ⑸ 치수선 가운데 조절점', () => {
  test('M1·⑤·M2·③ ★가운데 끌면 a·b 둘 다 · ⌘Z 한 걸음', async ({ page }) => {
    await placeDim(page);
    const e0 = await ends(page);
    const m = await midH(page);
    expect(m, 'M1 가운데 손잡이').not.toBeNull();
    const side = await page.evaluate(() => { const l = document.querySelector('#secA .annot-dim-line'); const a = l.getBoundingClientRect(); const ln = [Number(l.getAttribute('x1')), Number(l.getAttribute('y1')), Number(l.getAttribute('x2')), Number(l.getAttribute('y2'))];
      const svg = l.ownerSVGElement; const ctm = svg.getScreenCTM(); const P = (x, y) => { const p = new DOMPoint(x, y).matrixTransform(ctm); return [p.x, p.y]; };
      const A = P(ln[0], ln[1]), B = P(ln[2], ln[3]); const ux = B[0] - A[0], uy = B[1] - A[1], L = Math.hypot(ux, uy); const nx = -uy / L, ny = ux / L; const M = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2];
      const lr = document.querySelector('#secA .annot-label').getBoundingClientRect(); const hr = document.querySelector('#secA .annot-dim-mid').getBoundingClientRect();
      const lc = [lr.left + lr.width / 2, lr.top + lr.height / 2], hc = [hr.left + hr.width / 2, hr.top + hr.height / 2];
      const sd = (p) => (p[0] - M[0]) * nx + (p[1] - M[1]) * ny, al = (p) => (p[0] - M[0]) * ux / L + (p[1] - M[1]) * uy / L;
      return { label: Math.round(sd(lc) * 10) / 10, handle: Math.round(sd(hc) * 10) / 10, along: Math.round(al(hc) * 10) / 10 }; });
    expect(Math.sign(side.label) === -Math.sign(side.handle) && Math.abs(Math.abs(side.label) - Math.abs(side.handle)) <= 1 && Math.abs(side.along) <= 1, `M1 라벨 맞은편 같은 거리 · 길이 방향 중점 ${JSON.stringify(side)}`).toBe(true);
    expect([m.cls.split(' ').includes('annot-handle'), m.pointIdx, m.dimEnd], '⑤ annot-handle · pointIdx 없음 · dimEnd M').toEqual([true, null, 'M']);
    const k = await zoomK(page);
    await page.mouse.move(m.x, m.y); await page.mouse.down();
    await page.mouse.move(m.x + 40, m.y + 20, { steps: 8 }); await page.mouse.up();
    await page.waitForFunction(() => !!document.querySelector('#secA .annotation-block').dataset.dimA, null, { timeout: 3000 });
    const e1 = await ends(page);
    const d = [r1(40 / k), r1(20 / k)];
    expect([r1(e1[0][0] - e0[0][0]), r1(e1[0][1] - e0[0][1]), r1(e1[1][0] - e0[1][0]), r1(e1[1][1] - e0[1][1])], 'M2 a·b 같은 만큼').toEqual([...d, ...d]);
    await page.evaluate(() => document.activeElement?.blur?.());
    await page.keyboard.press('Meta+z');
    await expect.poll(async () => JSON.stringify((await ends(page)).map((p) => p.map(r1))), '③ ⌘Z 한 걸음').toBe(JSON.stringify(e0.map((p) => p.map(r1))));
  });

  test('①④⑥ 저장에 손잡이 0 · 고르기 전후 저장 같음 · 덫(pointIdx 갱신)이 가운데를 안 옮김', async ({ page }) => {
    await placeDim(page);
    const s1 = await page.evaluate(() => window.getSerializedCanvas());
    await page.evaluate(() => window.deselectAll?.());
    await expect.poll(() => page.evaluate(() => document.querySelectorAll('#secA .annot-handle').length), '전제: 고르기 풀림 = 손잡이 0').toBe(0);
    const s0 = await page.evaluate(() => window.getSerializedCanvas());
    expect([/annot-dim-mid|annot-handle/.test(s1), s1 === s0], '①④ 고른 채 저장 문자열에 손잡이 0 · 풀린 뒤와 같음').toEqual([false, true]);
    await selectDim2(page);
    const m0 = await midH(page);
    await page.evaluate(() => { const b = document.querySelector('#secA .annotation-block'); const st = window.annotPropsFromDataset(b); window._updateAnnotBlockGeometry(b, st.points); });
    const m1 = await midH(page);
    expect([m1.cx, m1.cy], '⑥ 덫 뒤 가운데 자리 그대로').toEqual([m0.cx, m0.cy]);
  });

  test('② (조건형) a 끌기 = 예전 그대로 — a 만 · b 고정', async ({ page }) => {
    await placeDim(page);
    const e0 = await ends(page);
    const h = await page.locator('#secA .annot-dim-handle').first().boundingBox();
    await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2); await page.mouse.down();
    await page.mouse.move(h.x + h.width / 2 + 30, h.y + h.height / 2 + 30, { steps: 8 }); await page.mouse.up();
    await page.waitForFunction(() => !!document.querySelector('#secA .annotation-block').dataset.dimA, null, { timeout: 3000 });
    const e1 = await ends(page);
    expect([e1[0][0] !== e0[0][0] || e1[0][1] !== e0[0][1], r1(e1[1][0]) === r1(e0[1][0]) && r1(e1[1][1]) === r1(e0[1][1])], '② a 움직임 · b 그대로').toEqual([true, true]);
  });
  for (const z of [40, 100]) {
    test(`ⓐ 배율 ${z}% — 손잡이 한가운데 임자 = 그 손잡이`, async ({ page }) => {
      await placeDim(page);
      await page.evaluate((z) => window.applyZoom?.(z), z);
      await expect.poll(() => page.evaluate((z) => window.currentZoom === z, z)).toBe(true);
      await page.evaluate(() => document.getElementById('secA').scrollIntoView({ block: 'center' }));
      await waitStableRect(page, '#secA .annot-dim-mid');
      const hit = await page.evaluate(() => { const h = document.querySelector('#secA .annot-dim-mid'); const r = h.getBoundingClientRect(); const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { self: e === h, hit: String(e?.className?.baseVal ?? e?.className), w: Math.round(r.width * 10) / 10 }; });
      expect(hit.self, `ⓐ ${JSON.stringify(hit)}`).toBe(true);
    });
  }

  test('ⓑ (음성대조) 라벨 더블클릭 편집 여전히 됨', async ({ page }) => {
    await placeDim(page);
    const r = await waitStableRect(page, '#secA .annot-label');
    await page.mouse.dblclick(r.cx, r.cy);
    await expect.poll(() => page.evaluate(() => document.querySelector('#secA .annot-label')?.getAttribute('contenteditable')), 'ⓑ 라벨 편집').toBe('true');
  });
});
