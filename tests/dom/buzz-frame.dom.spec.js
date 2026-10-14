/* buzz-frame.dom.spec.js — 버즈(1012t1Z5): 자유배치 프레임 + 진짜 모달 N개 묶음을 «진짜 앱»에서 잰다.
 *
 * 버즈는 새 블럭이 아니다 — 프레임에 표식 data-buzz="1" 이 붙고, 프레임 패널 맨 위에 「Buzz」 절이 뜬다
 * (js/blocks/buzz-frame.js · buzz-layout.js · buzz-mark.js · js/props/prop-frame-buzz.js). 낱개는 끝까지 그냥 모달이다.
 *
 * ★현빈 고침 셋(2026-10-13)을 지키는 칸
 *   ⑴ 다시 뿌리기 = 전부 리셋(손으로 옮긴 것도)            → BZ-03
 *   ⑵ 무엇을 바꿔도 프레임 높이 그대로 · 넘치면 안에서 맞춤   → BZ-04 · BZ-05 · BZ-09
 *   ⑶ 레이어 줄 · 패널 머리에 「Buzz」 + 전용 아이콘           → BZ-02 · BZ-17
 *   테이프의 자리(현빈 1013t1 「테이프 모양 및 위치 검수」)    → BZ-18
 * ★1013t2 D1 · D2(현빈 2026-10-14) — 새 기본
 *   D2 알약 프레임 기본 배경 = 솔리드 #5f564e · 합성 뒤 흰 글자 대비 ≥ 3.0 · 그라데이션은 프리셋   → BZ-23 · BZ-24 · BZ-25
 *   D1 나머지 5종은 투명 배경 · 새 버즈는 「패딩 제외」 켬 · 이미 저장된 버즈는 그대로           → BZ-26 · BZ-27 · BZ-28
 *   「패딩 제외」 스위치의 다시 놓기(js/props/prop-frame.js 의 refitBuzzOnResize 한 줄)가 닿는 범위:
 *     버즈를 끌 때만 → BZ-27 · 보통 프레임의 자식은 안 건드린다 → BZ-29 · 열기 · 패널 그리기에서는 안 돈다 → BZ-30
 *
 * ★재는 법
 *   · 삽입은 삽입 메뉴 「Buzz」를 진짜로 누른다. 패널 조작은 진짜 클릭 · 선택 · 키 입력이다.
 *   · 자리는 «레이아웃 px»(row 의 인라인 left/top · offsetTop/offsetHeight)로 잰다 — 캔버스 배율과 무관하다.
 *     화면 px(사각형)은 «누를 점»을 찾을 때와, 잰 값끼리 견줄 때(BZ-11 꼬리 · BZ-18 테이프)만 쓴다.
 *   · 기다림은 전부 조건이다(expect.poll · waitForFunction). 고정 대기 0.
 *   · 칸마다 첫머리에 전제를 단언한다(섹션이 골라졌다 · 프레임이 만들어졌다 · 누르는 점이 그 모달 위다).
 * ⛔못 재는 축: PNG 주 경로(Electron CDP 캡처) · 파일 저장창 — 하네스의 electronAPI 가 가짜다.
 *   PNG 는 html2canvas 길(captureSectionImage)만 잰다(BZ-15).
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');
const { clickAt } = require('./_click-at.js');
const { expectOneUndoStep } = require('./_history-step.js');

const STYLE_KEYS = ['card', 'pill', 'bubble', 'tail', 'tape', 'strip'];

/* ── 장면 ───────────────────────────── */
async function setup(page) {
  await page.setViewportSize({ width: 1600, height: 1100 });
  const errs = await bootApp(page);
  const secId = await page.evaluate(async () => {
    await document.fonts?.ready;                      /* 글꼴이 늦게 실리면 실측 폭이 달라진다 — 재기 전에 기다린다 */
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach((s) => s.remove());
    window.addSection?.();
    const sec = c.querySelector('.section-block');
    window.deselectAll?.();
    window.selectSection?.(sec);
    window.clearHistory?.();
    return sec?.id || null;
  });
  expect(secId, '전제: 섹션이 하나 있다').toBeTruthy();
  expect(await page.evaluate(() => window.getSelectedSection?.()?.id || null), '전제: 그 섹션이 골라져 있다').toBe(secId);
  return { errs, secId };
}

/** 삽입 메뉴(Component ▾)의 「Buzz」를 진짜로 누른다. */
async function clickMenuBuzz(page) {
  const t = await waitStableRect(page, '#fp-component-dropdown .fp-dropdown-trigger');
  await clickAt(page, t.cx, t.cy, { sel: '#fp-component-dropdown .fp-dropdown-trigger' }, { label: 'Component 펼치기' });
  await expect(page.locator('#fp-component-dropdown')).toHaveClass(/open/);
  const item = page.locator('#fp-component-menu .fp-menu-item', { hasText: /^Buzz$/ });
  await expect(item, '전제: 삽입 메뉴에 「Buzz」가 있다').toBeVisible();
  const b = await item.boundingBox();
  await clickAt(page, b.x + b.width / 2, b.y + b.height / 2, { sel: '#fp-component-menu .fp-menu-item' }, { label: 'Buzz 누르기' });
}

async function insertBuzz(page) {
  await clickMenuBuzz(page);
  await expect.poll(() => page.evaluate(() => document.querySelectorAll('#canvas .frame-block[data-buzz="1"]').length), { message: '전제: 버즈 프레임이 만들어졌다' }).toBe(1);
  const fid = await page.evaluate(() => document.querySelector('#canvas .frame-block[data-buzz="1"]').id);
  await waitStableRect(page, `[id="${fid}"]`);      /* 삽입 뒤 부드러운 스크롤이 멎을 때까지 */
  return fid;
}

/** 프레임과 그 row · 모달의 상태(레이아웃 px). */
const stateOf = (page, fid) => page.evaluate((fid) => {
  const f = document.getElementById(fid);
  if (!f) return null;
  const rows = [...f.querySelectorAll(':scope > .row')].filter((r) => r.querySelector(':scope > .modal-block'));
  return {
    h: [f.dataset.height, f.style.height, f.style.minHeight, f.offsetHeight],
    ch: f.clientHeight, cw: f.clientWidth, selected: f.classList.contains('selected'),
    attrs: Object.fromEntries([...f.attributes].filter((a) => a.name.startsWith('data-buzz')).map((a) => [a.name, a.value])),
    rows: rows.map((r) => {
      const m = r.querySelector(':scope > .modal-block');
      return { id: r.id, mid: m.id, left: r.style.left, top: r.style.top, z: r.style.zIndex, w: r.style.width, far: r.dataset.buzzFar || '',
        ot: r.offsetTop, ol: r.offsetLeft, ow: r.offsetWidth, oh: r.offsetHeight,
        rot: m.dataset.rotation || '0', text: m.dataset.textText || '', radius: m.dataset.radius, bg: m.dataset.bg,
        tail: m.dataset.decoTail || '', tape: m.dataset.decoTape || '', glass: m.dataset.glass || '',
        tailEls: [...m.querySelectorAll('.mdl-deco-tail')].map((e) => e.dataset.side), tapeEls: m.querySelectorAll('.mdl-deco-tape').length };
    }),
  };
}, fid);
const coordsOf = (st) => st.rows.map((r) => `${r.id}:${r.left},${r.top},${r.z}`);
/** 프레임 밖으로 나간 row 의 id(프레임보다 큰 낱개는 위만 본다). */
const outsideOf = (st) => st.rows.filter((r) => r.ol < 0 || r.ol + r.ow > st.cw || r.ot < 0 || (r.oh <= st.ch && r.ot + r.oh > st.ch)).map((r) => r.id);

/** 그 모달 위의 화면 점. 기본은 «그 모달이 실제로 맞는» 점이고, frameOk 면 그 모달의 프레임 안 무엇이 맞아도 된다
 *  (안 골라진 프레임의 자식은 직접 안 맞는다 — 프레임이 맞는다. 그것이 드릴인의 첫 클릭이다). */
async function pointOn(page, mid, { frameOk = false } = {}) {
  await page.evaluate((id) => document.getElementById(id).scrollIntoView({ block: 'center' }), mid);
  await waitStableRect(page, `[id="${mid}"]`);
  const p = await page.evaluate(([id, frameOk]) => {
    const el = document.getElementById(id);
    const frame = el.closest('.frame-block');
    const b = el.getBoundingClientRect();
    for (const fy of [0.5, 0.3, 0.7, 0.2, 0.8]) for (const fx of [0.5, 0.25, 0.75, 0.1, 0.9]) {
      const x = b.left + b.width * fx, y = b.top + b.height * fy;
      const hit = document.elementFromPoint(x, y);
      if (hit && (hit.closest('.modal-block') === el || (frameOk && hit.closest('.frame-block') === frame))) return { x, y };
    }
    return null;
  }, [mid, frameOk]);
  expect(p, `전제: 모달 ${mid} 위에 누를 수 있는 점이 있다`).not.toBeNull();
  return p;
}
const isSelected = (page, id) => page.evaluate((id) => !!document.getElementById(id)?.classList.contains('selected'), id);

/** 프레임을 고른다 — 선택을 비우고 그 프레임 안 모달의 자리를 누른다. 안 골라진 프레임의 자식은 직접 안 맞으므로
 *  (섹션 → 프레임 순으로 들어간다) 프레임이 골라질 때까지 많아야 세 번 누른다. 모달까지 들어가기 전에 멈춘다. */
async function pickFrame(page, fid, { buzz = true } = {}) {
  await page.evaluate(() => { document.activeElement?.blur?.(); window.deselectAll?.(); });
  expect(await isSelected(page, fid), '전제: 누르기 전에는 프레임이 안 골라져 있다').toBe(false);
  const mid = await page.evaluate((fid) => document.getElementById(fid).querySelector(':scope > .row > .modal-block').id, fid);
  const secSel = await page.evaluate((fid) => '[id="' + document.getElementById(fid).closest('.section-block').id + '"]', fid);
  for (let i = 0; i < 3; i++) {
    if (await isSelected(page, fid)) break;
    await page.evaluate((id) => document.getElementById(id).scrollIntoView({ block: 'center' }), mid);
    const r = await waitStableRect(page, `[id="${mid}"]`);
    await clickAt(page, r.cx, r.cy, { sel: secSel }, { label: `프레임 고르기 ${i + 1}` });
  }
  await expect.poll(() => isSelected(page, fid), { message: '전제: 프레임이 골라졌다' }).toBe(true);
  expect(await isSelected(page, mid), '전제: 모달까지 들어가지는 않았다').toBe(false);
  if (buzz) await expect(page.locator('#bzf-section'), '전제: 프레임 패널에 Buzz 절이 있다').toHaveCount(1);
}
/** 낱개 모달을 고른다 — 프레임이 골라진 뒤 한 번 더 누른다(많아야 두 번). */
async function pickModal(page, mid) {
  for (let i = 0; i < 2; i++) {
    if (await isSelected(page, mid)) break;
    const p = await pointOn(page, mid);
    await clickAt(page, p.x, p.y, { sel: `[id="${mid}"]` }, { label: `모달 고르기 ${i + 1}` });
  }
  await expect.poll(() => isSelected(page, mid), { message: `전제: 모달 ${mid} 이 골라졌다` }).toBe(true);
  await expect(page.locator('#panel-right .prop-block-name'), '전제: 패널이 Modal 이다').toHaveText('Modal');
}
/** 프레임 패널 Size › 높이 숫자 칸에 값을 친다(사용자가 높이를 바꾸는 길). */
async function setFrameHeight(page, fid, h) {
  const num = page.locator('#ss-height-num');
  await num.scrollIntoViewIfNeeded();
  await num.fill(String(h));
  await num.press('Enter');
  await expect.poll(() => page.evaluate((fid) => document.getElementById(fid).dataset.height, fid), { message: `전제: 프레임 높이가 ${h} 이 됐다` }).toBe(String(h));
}
const pickStyle = async (page, fid, key) => {
  await page.locator('#bzf-style').selectOption(key);
  await expect.poll(() => page.evaluate((fid) => document.getElementById(fid).dataset.buzzStyle, fid), { message: `스타일 ${key}` }).toBe(key);
  await expect(page.locator('#bzf-style'), '패널이 다시 그려져도 선택이 그 스타일이다').toHaveValue(key);
};
const layerOf = (page, fid) => page.evaluate((fid) => {
  const f = document.getElementById(fid);
  const it = f && f._layerItem ? f._layerItem : [...document.querySelectorAll('.layer-row-header, .layer-item')].find((e) => e._dragTarget === f || e.parentElement?._dragTarget === f);
  if (!it) return null;
  const svg = it.querySelector('svg.layer-item-icon');
  return { name: it.querySelector('.layer-item-name')?.textContent, type: it.querySelector('.layer-item-type')?.textContent,
    viewBox: svg?.getAttribute('viewBox') || null, sw: svg?.getAttribute('stroke-width') || null, fill: svg?.getAttribute('fill') || null };
}, fid);
/** 배율을 바꾸고 «화면이 실제로 그 배율이 될 때까지» 기다린다 — window.currentZoom 은 곧장 바뀌지만
 *  #canvas-scaler 의 transform 은 전환(transition)을 거쳐 늦게 닿는다. 그 사이에 재면 옛 배율의 화면을 잰다. */
async function zoomTo(page, z) {
  await page.evaluate((z) => window.applyZoom(z), z);
  await page.waitForFunction((z) => {
    const m = new DOMMatrix(getComputedStyle(document.getElementById('canvas-scaler')).transform);
    return window.currentZoom === z && Math.abs(m.a - z / 100) < 0.001;
  }, z);
}
const undo = async (page) => { await page.evaluate(() => document.activeElement?.blur?.()); await page.keyboard.press('Meta+z'); };
const redo = async (page) => { await page.evaluate(() => document.activeElement?.blur?.()); await page.keyboard.press('Meta+Shift+z'); };

/* ═══════════════════════════════════ 칸 ═══════════════════════════════════ */

test('BZ-01 삽입 메뉴 「Buzz」 → 표식 붙은 자유배치 프레임 + 모달 6 · 프레임이 골라지고 패널 맨 위가 Buzz 절', async ({ page }) => {
  const { errs } = await setup(page);
  const fid = await insertBuzz(page);
  const st = await stateOf(page, fid);
  expect(await page.evaluate(() => document.querySelectorAll('#canvas .frame-block[data-buzz="1"][data-free-layout="true"]').length), '표식 + 자유배치 프레임이 하나').toBe(1);
  expect(st.rows.length, '모달 row 6').toBe(6);
  expect(st.selected, '프레임이 골라져 있다(마지막 모달이 아니다)').toBe(true);
  expect(await page.evaluate(() => document.querySelectorAll('#canvas .modal-block.selected').length), '모달은 안 골라졌다').toBe(0);
  await expect(page.locator('#panel-right .prop-block-name')).toHaveText('Buzz');
  expect(await page.evaluate(() => document.querySelectorAll('#panel-right .prop-section')[1]?.id || null), '둘째 절(머리 다음)이 Buzz 절').toBe('bzf-section');
  expect(outsideOf(st), '모든 낱개가 프레임 안').toEqual([]);
  /* 패널 꼴(판정서 M4): 버즈 프레임에는 프레임의 Layout 절(free → stack)이 없다 · 단추 묶음과 다음 라벨이 붙지 않는다 */
  const titles = await page.evaluate(() => [...document.querySelectorAll('#panel-right .prop-section-title')].map((e) => e.textContent.trim()));
  expect([titles[0], titles.includes('Layout'), titles.includes('Background')], 'Buzz 절이 맨 위 · Layout 절 없음 · 나머지 프레임 절은 그대로').toEqual(['Buzz', false, true]);
  await expect(page.locator('#ss-to-stack-btn'), '버즈 프레임에는 「stack」 변환 단추가 없다').toHaveCount(0);
  const gaps = await page.evaluate(() => {
    const top = (el) => el.getBoundingClientRect().top, bottom = (el) => el.getBoundingClientRect().bottom;
    const dir = document.getElementById('bzf-dir'), depth = document.getElementById('bzf-depth');
    return { dirToDepthLabel: top(depth.previousElementSibling) - bottom(dir), labelIsDepth: depth.previousElementSibling.textContent.trim() };
  });
  expect(gaps.labelIsDepth, '전제: 「방향」 묶음 다음 라벨이 「깊이」다').toBe('깊이');
  expect(gaps.dirToDepthLabel > 0, `「방향」 단추 줄과 「깊이」 라벨 사이가 붙지 않는다(${gaps.dirToDepthLabel}px)`).toBe(true);
  expect(st.h[1], '처음 높이가 인라인으로 박혔다').toBe(st.h[0] + 'px');
  expect(st.h[2]).toBe(st.h[0] + 'px');
  expect(st.attrs['data-buzz-style']).toBe('card');
  expect(new Set(st.rows.map((r) => r.text)).size, '예문이 서로 다르다').toBe(6);
  /* 섹션을 안 고르고 누르면 아무것도 안 만든다 */
  await page.evaluate(() => { window.deselectAll?.(); document.querySelectorAll('#canvas .frame-block[data-buzz="1"]').forEach((f) => f.remove()); });
  expect(await page.evaluate(() => window.getSelectedSection?.() || null), '전제: 고른 섹션이 없다').toBeNull();
  await clickMenuBuzz(page);
  await expect(page.locator('#fp-component-dropdown'), '메뉴는 닫혔다(눌린 것은 맞다)').not.toHaveClass(/open/);
  expect(await page.evaluate(() => document.querySelectorAll('#canvas .frame-block[data-buzz="1"]').length), '섹션 미선택 → 프레임 0').toBe(0);
  expect(errs).toEqual([]);
});

test('BZ-02 ★⑶ 레이어 줄과 패널 머리가 「Buzz」 + 전용 아이콘(viewBox 12 · 선 1.3) · 보통 프레임은 Frame', async ({ page }) => {
  const { errs } = await setup(page);
  const fid = await insertBuzz(page);
  const lay = await layerOf(page, fid);
  expect(lay, '전제: 레이어 패널에 그 프레임의 줄이 있다').not.toBeNull();
  expect(lay).toEqual({ name: 'Buzz', type: 'Buzz', viewBox: '0 0 12 12', sw: '1.3', fill: 'none' });
  const head = await page.evaluate(() => {
    const svg = document.querySelector('#panel-right .prop-block-icon svg');
    return { name: document.querySelector('#panel-right .prop-block-name')?.textContent, viewBox: svg?.getAttribute('viewBox'), sw: svg?.getAttribute('stroke-width'), w: svg?.getAttribute('width'), h: svg?.getAttribute('height') };
  });
  expect(head, '패널 머리 — 이웃(모달 머리)과 같은 꼴').toEqual({ name: 'Buzz', viewBox: '0 0 12 12', sw: '1.3', w: '12', h: '12' });
  /* 이웃 아이콘과 같은 꼴인가 — 같은 레이어 패널의 모달 줄 아이콘과 견준다 */
  const neighbor = await page.evaluate((fid) => {
    const m = document.getElementById(fid).querySelector('.modal-block');
    const it = m._layerItem || [...document.querySelectorAll('.layer-item')].find((e) => e._dragTarget === m || e._dragTarget === m.closest('.row'));
    const svg = it?.querySelector('svg.layer-item-icon');
    return svg ? { viewBox: svg.getAttribute('viewBox'), sw: svg.getAttribute('stroke-width'), fill: svg.getAttribute('fill') } : null;
  }, fid);
  expect(neighbor, '전제: 같은 레이어 패널에서 이웃(모달 줄) 아이콘을 찾았다').not.toBeNull();
  expect({ viewBox: lay.viewBox, sw: lay.sw, fill: lay.fill }, '이웃(모달 줄) 아이콘과 같은 viewBox · 선 굵기 · fill').toEqual(neighbor);
  /* 같은 섹션의 보통 프레임 */
  const plain = await page.evaluate(() => {
    const before = new Set([...document.querySelectorAll('#canvas .frame-block')].map((f) => f.id));
    window.addFrameBlock();
    const f = [...document.querySelectorAll('#canvas .frame-block')].find((x) => !before.has(x.id));
    return f?.id || null;
  });
  expect(plain, '전제: 보통 프레임이 만들어졌다').toBeTruthy();
  const lay2 = await layerOf(page, plain);
  expect(lay2 && [lay2.name, lay2.type], '보통 프레임 줄은 Frame').toEqual(['Frame', 'Frame']);
  await expect(page.locator('#panel-right .prop-block-name'), '보통 프레임 패널 머리는 Frame').toHaveText('Frame');
  expect(errs).toEqual([]);
});

test('BZ-03 ★⑴ 다시 뿌리기는 전부 리셋 — 손으로 옮긴 말풍선도 다시 놓인다 · 「옮긴 것 풀기」가 없다', async ({ page }) => {
  const { errs } = await setup(page);
  const fid = await insertBuzz(page);
  await page.locator('#bzf-redraw').click();                       /* 기준 = 지금 번호로 다시 그린 자리 */
  const base = await stateOf(page, fid);
  const first = base.rows[0];                                       /* DOM 순서 첫 말풍선 */
  await pickModal(page, first.mid);
  const p = await pointOn(page, first.mid);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.mouse.move(p.x + 20, p.y + 10, { steps: 4 });
  await page.mouse.move(p.x + 60, p.y + 30, { steps: 6 });
  await page.mouse.up();
  const moved = (await stateOf(page, fid)).rows[0];
  expect([moved.left, moved.top], '전제: 끌어서 자리가 변했다').not.toEqual([first.left, first.top]);
  expect(moved.left !== first.left && moved.top !== first.top, `전제: 가로 · 세로 둘 다 변했다 (${first.left},${first.top}) → (${moved.left},${moved.top})`).toBe(true);

  await pickFrame(page, fid);
  await expect(page.locator('#bzf-release'), '「손으로 옮긴 n개 풀기」 단추가 없다').toHaveCount(0);
  await expect(page.locator('#bzf-section')).not.toContainText('옮긴');
  await page.locator('#bzf-redraw').click();                       /* ↻ 같은 번호로 다시 그리기 */
  await expect.poll(async () => { const r = (await stateOf(page, fid)).rows[0]; return [r.left, r.top]; },
    { message: '↻ 뒤 — 손으로 옮긴 말풍선이 뿌린 자리로 돌아왔다' }).toEqual([first.left, first.top]);
  expect(coordsOf(await stateOf(page, fid)), '↻ 뒤 전체 자리 = 옮기기 전').toEqual(coordsOf(base));

  /* 다시 한 번 옮기고 「다시 뿌리기」 — 그 말풍선도 새 자리 */
  await pickModal(page, first.mid);
  const p2 = await pointOn(page, first.mid);
  await page.mouse.move(p2.x, p2.y);
  await page.mouse.down();
  await page.mouse.move(p2.x + 30, p2.y + 20, { steps: 6 });
  await page.mouse.up();
  const moved2 = (await stateOf(page, fid)).rows[0];
  expect([moved2.left, moved2.top], '전제: 두 번째 끌기도 자리가 변했다').not.toEqual([first.left, first.top]);
  await pickFrame(page, fid);
  await page.locator('#bzf-reroll').click();
  await expect.poll(async () => (await stateOf(page, fid)).attrs['data-buzz-seed'], { message: '다시 뿌리기 → 무늬번호가 바뀐다' }).not.toBe(base.attrs['data-buzz-seed']);
  const after = await stateOf(page, fid);
  expect(coordsOf(after), '다시 뿌리기 → 전체 자리가 바뀐다').not.toEqual(coordsOf(base));
  expect([after.rows[0].left, after.rows[0].top], '손으로 옮긴 말풍선도 그 자리에 안 남는다').not.toEqual([moved2.left, moved2.top]);
  /* 다시 ↻ 하면 같은 자리 = 그 말풍선의 자리도 seed 가 정한 것이다 */
  await page.locator('#bzf-redraw').click();
  expect(coordsOf(await stateOf(page, fid)), '같은 번호 ↻ = 같은 자리(전부 seed 가 정한다)').toEqual(coordsOf(after));
  const ser = await page.evaluate(() => window.getSerializedCanvas());
  expect(ser.includes('data-buzz="1"'), '전제: 직렬화에 버즈 프레임이 있다').toBe(true);
  expect([ser.includes('data-bz-'), ser.includes('data-buzz-x'), ser.includes('data-buzz-y')], '자리 도장 속성이 없다').toEqual([false, false, false]);
  expect(errs).toEqual([]);
});

test('BZ-04 ★⑵ 다시 뿌리기 · 개수 · 스타일 · 배치 · 너비를 바꿔도 프레임 높이는 처음 그대로 · 낱개는 프레임 안', async ({ page }) => {
  const { errs } = await setup(page);
  const fid = await insertBuzz(page);
  const h0 = (await stateOf(page, fid)).h;
  expect(Number(h0[0]) >= 100 && h0[3] === Number(h0[0]), `전제: 처음 높이가 섰다 ${JSON.stringify(h0)}`).toBe(true);
  const check = async (label) => {
    const st = await stateOf(page, fid);
    expect(st.h, `${label}: 프레임 높이(data-height · height · min-height · 실측)가 처음과 같다`).toEqual(h0);
    expect(outsideOf(st), `${label}: 프레임 밖으로 나간 낱개`).toEqual([]);
    return st;
  };
  for (let i = 0; i < 3; i++) { await page.locator('#bzf-reroll').click(); await check(`다시 뿌리기 ${i + 1}`); }
  for (let i = 0; i < 3; i++) await page.locator('#bzf-n-plus').click();
  expect((await check('개수 +3')).rows.length).toBe(9);
  for (let i = 0; i < 2; i++) await page.locator('#bzf-n-minus').click();
  expect((await check('개수 −2')).rows.length).toBe(7);
  for (const k of [...STYLE_KEYS.slice(1), 'card']) { await pickStyle(page, fid, k); await check(`스타일 ${k}`); }
  await page.locator('#bzf-layout [data-val="stack"]').click();
  expect((await check('배치 스택')).attrs['data-buzz-layout']).toBe('stack');
  await page.locator('#bzf-n-plus').click();
  expect((await check('스택에서 개수 +1')).rows.length).toBe(8);
  await page.locator('#bzf-layout [data-val="scatter"]').click();
  expect((await check('배치 흩어짐')).attrs['data-buzz-layout']).toBe('scatter');
  const wnum = page.locator('#bzf-width-number');
  await wnum.fill('300');
  await wnum.press('Tab');
  const st = await check('너비 300');
  expect([...new Set(st.rows.map((r) => r.w))], '전제: 너비 칸이 실제로 먹었다').toEqual(['300px']);
  await page.locator('#bzf-angle-number').fill('12');
  await page.locator('#bzf-angle-number').press('Tab');
  await check('각도 12');
  expect(errs).toEqual([]);
});

test('BZ-05 ★⑵ 사용자가 바꾼 프레임 높이가 새 기준 — 400 이면 400 안에, 900 이면 더 넓게', async ({ page }) => {
  const { errs } = await setup(page);
  const fid = await insertBuzz(page);
  const bottomOf = (st) => Math.max(...st.rows.map((r) => r.ot + r.oh));
  await setFrameHeight(page, fid, 400);
  await page.locator('#bzf-redraw').click();
  const a = await stateOf(page, fid);
  expect(a.h, '높이는 사용자가 정한 400 그대로').toEqual(['400', '400px', '400px', 400]);
  expect(outsideOf(a), '400 안에 다 들어간다').toEqual([]);
  const bottomA = bottomOf(a);
  expect(bottomA <= a.ch, `맨 아래 밑변 ${bottomA} ≤ 프레임 ${a.ch}`).toBe(true);
  await pickFrame(page, fid);
  await setFrameHeight(page, fid, 900);
  await page.locator('#bzf-redraw').click();
  const b = await stateOf(page, fid);
  expect(b.h, '높이는 사용자가 정한 900 그대로').toEqual(['900', '900px', '900px', 900]);
  expect(outsideOf(b)).toEqual([]);
  expect(bottomOf(b) > bottomA, `900 에서는 더 아래까지 쓴다 ${bottomOf(b)} > ${bottomA}`).toBe(true);
  expect(errs).toEqual([]);
});

test('BZ-06 스타일 6종 — 모달 값 · 꼬리 좌우 번갈아 · 테이프 · 유리 · 띠의 한 방향 기울기', async ({ page }) => {
  const { errs } = await setup(page);
  const fid = await insertBuzz(page);
  const STYLES = await page.evaluate(async () => (await import('/js/blocks/buzz-frame.js')).BUZZ_STYLES);
  expect(Object.keys(STYLES), '전제: 스타일 표가 6종').toEqual(STYLE_KEYS);
  for (const k of [...STYLE_KEYS.slice(1), 'card']) {
    await pickStyle(page, fid, k);
    const st = await stateOf(page, fid);
    const n = st.rows.length;
    expect(n, `${k}: 개수 불변`).toBe(6);
    expect(st.rows.map((r) => [r.radius, r.bg]), `${k}: 모달의 모서리 · 배경이 표의 값`).toEqual(st.rows.map(() => [String(STYLES[k].modal.radius), STYLES[k].modal.bg]));
    const tails = st.rows.map((r) => r.tailEls.join(','));
    const tapes = st.rows.reduce((m, r) => m + r.tapeEls, 0);
    if (k === 'tail') {
      expect(tails, 'tail: 꼬리 요소가 낱개마다 하나 · 좌우 번갈아').toEqual(['left', 'right', 'left', 'right', 'left', 'right']);
      expect(st.attrs['data-buzz-layout']).toBe('stack');
    } else expect(tails.join(''), `${k}: 꼬리 없음`).toBe('');
    if (k === 'tape') {
      expect(tapes, 'tape: 테이프 요소가 낱개마다 하나').toBe(n);
      expect(new Set(st.rows.map((r) => r.tape)).size, 'tape: 자리(좌 · 중 · 우)가 섞인다').toBe(3);
    } else expect(tapes, `${k}: 테이프 없음`).toBe(0);
    if (k === 'pill') {
      expect(st.rows.every((r) => r.glass === '1'), 'pill: 유리 표식').toBe(true);
      const bf = await page.evaluate((fid) => { const cs = getComputedStyle(document.getElementById(fid).querySelector('.modal-block')); return cs.backdropFilter || cs.webkitBackdropFilter || ''; }, fid);
      expect(bf.startsWith('blur('), `pill: 유리가 실제로 걸렸다(${bf})`).toBe(true);
      expect(st.attrs['data-buzz-depth']).toBe('strong');
    } else expect(st.rows.every((r) => r.glass === ''), `${k}: 유리 없음`).toBe(true);
    if (k === 'strip') {
      const rots = [...new Set(st.rows.map((r) => r.rot))];
      expect(rots.length === 1 && Number(rots[0]) < 0, `strip: 전부 같은 음수 각도 ${rots}`).toBe(true);
    }
  }
  const back = await stateOf(page, fid);
  expect(await page.evaluate((fid) => document.getElementById(fid).querySelectorAll('.mdl-deco-tail, .mdl-deco-tape, .mdl-deco-tailwrap').length, fid), 'card 로 돌아오면 장식 요소 0').toBe(0);
  expect(back.attrs['data-buzz-layout']).toBe('scatter');
  expect(errs).toEqual([]);
});

test('BZ-07 개수 +/− — 흩어짐에서는 남은 것의 자리를 안 건드리고 새 것만 프레임 안에 · 1 과 12 에서 멈춘다', async ({ page }) => {
  const { errs } = await setup(page);
  const fid = await insertBuzz(page);
  const a = await stateOf(page, fid);
  expect(a.attrs['data-buzz-layout'] || 'scatter', '전제: 흩어짐').toBe('scatter');
  await page.locator('#bzf-n-plus').click();
  const b = await stateOf(page, fid);
  expect(b.rows.length, 'row +1').toBe(7);
  await expect(page.locator('#bzf-n-count')).toHaveText('7');
  expect(coordsOf(b).slice(0, 6), '기존 여섯의 자리 · 겹침 순서 불변').toEqual(coordsOf(a));
  expect(outsideOf(b), '새 것도 프레임 안').toEqual([]);
  const neu = b.rows[6];
  expect(a.rows.map((r) => r.text).includes(neu.text), `새 예문이 기존 것과 다르다(${neu.text})`).toBe(false);
  expect(Number(neu.z) > Math.max(...a.rows.map((r) => Number(r.z))), '새 것이 맨 앞').toBe(true);
  await pickModal(page, neu.mid);                                   /* 새 모달도 진짜 모달이다 — 골라진다 */
  await pickFrame(page, fid);
  await page.locator('#bzf-n-minus').click();
  const c = await stateOf(page, fid);
  expect(c.rows.map((r) => r.id), '− 는 마지막 것을 지운다').toEqual(a.rows.map((r) => r.id));
  await expect(page.locator('#bzf-n-count')).toHaveText('6');
  for (let i = 0; i < 5; i++) await page.locator('#bzf-n-minus').click();
  expect((await stateOf(page, fid)).rows.length).toBe(1);
  await expect(page.locator('#bzf-n-minus'), '1 에서 − 는 꺼진다').toBeDisabled();
  await expect(page.locator('#bzf-n-plus')).toBeEnabled();
  for (let i = 0; i < 11; i++) await page.locator('#bzf-n-plus').click();
  const full = await stateOf(page, fid);
  expect(full.rows.length).toBe(12);
  await expect(page.locator('#bzf-n-count')).toHaveText('12');
  await expect(page.locator('#bzf-n-plus'), '12 에서 + 는 꺼진다').toBeDisabled();
  expect(outsideOf(full), '12개도 프레임 안').toEqual([]);
  expect(full.h, '높이 불변').toEqual(a.h);
  expect(errs).toEqual([]);
});

test('BZ-08 배치 — 스택이면 DOM 순서대로 세로로 쌓고 ∓엇갈림/2 · 슬라이더 줄이 갈린다 · 흩어짐으로 돌아온다', async ({ page }) => {
  const { errs } = await setup(page);
  const fid = await insertBuzz(page);
  await expect(page.locator('#bzf-spread-slider'), '전제: 흩어짐 줄이 있다').toHaveCount(1);
  await page.locator('#bzf-layout [data-val="stack"]').click();
  await expect.poll(() => page.evaluate((fid) => document.getElementById(fid).dataset.buzzLayout, fid)).toBe('stack');
  const st = await stateOf(page, fid);
  const tops = st.rows.map((r) => r.ot);
  expect(tops, 'DOM 순서대로 아래로').toEqual([...tops].sort((x, y) => x - y));
  expect(new Set(tops).size, '세로 자리가 전부 다르다').toBe(tops.length);
  const offset = await page.evaluate(async (fid) => (await import('/js/blocks/buzz-frame.js')).getBuzz(document.getElementById(fid), 'offset'), fid);
  expect(offset > 0, '전제: 엇갈림이 0 이 아니다').toBe(true);
  st.rows.forEach((r, i) => {
    const want = st.cw / 2 + (i % 2 ? offset / 2 : -offset / 2);
    expect(Math.abs((r.ol + r.ow / 2) - want) <= 1, `#${i} 가로 중심 ${r.ol + r.ow / 2} ≈ ${want}`).toBe(true);
  });
  await expect(page.locator('#bzf-offset-slider')).toHaveCount(1);
  await expect(page.locator('#bzf-gap-slider')).toHaveCount(1);
  await expect(page.locator('#bzf-spread-slider'), '스택에서는 흩어짐 줄이 없다').toHaveCount(0);
  await expect(page.locator('#bzf-overlap')).toHaveCount(0);
  await expect(page.locator('#bzf-layout .active')).toHaveText('스택');
  /* 안내(판정서 L-1): 처음 높이의 카드 스택은 간격만 줄었을 뿐 상자가 안 겹친다 → 「겹쳐 놓았습니다」가 꺼져 있어야 한다 */
  const gap0 = await page.evaluate(async (fid) => (await import('/js/blocks/buzz-frame.js')).getBuzz(document.getElementById(fid), 'gap'), fid);
  const gaps = st.rows.slice(1).map((r, i) => r.ot - (st.rows[i].ot + st.rows[i].oh));
  expect(gaps.every((g) => g >= 0) && Math.max(...gaps) < gap0, `전제: 간격이 설정(${gap0})보다 줄었지만 겹치지는 않았다 ${gaps}`).toBe(true);
  await expect(page.locator('#bzf-squeeze'), '안 겹쳤으면 「겹쳐 놓았습니다」 안내는 꺼져 있다').toBeHidden();
  await page.locator('#bzf-layout [data-val="scatter"]').click();
  await expect.poll(() => page.evaluate((fid) => document.getElementById(fid).dataset.buzzLayout, fid)).toBe('scatter');
  await expect(page.locator('#bzf-spread-slider')).toHaveCount(1);
  await expect(page.locator('#bzf-offset-slider')).toHaveCount(0);
  expect(errs).toEqual([]);
});

test('BZ-09 ★⑵ 스택이 넘치면 간격을 고르게 줄여(겹쳐) 프레임 안에 · 안내 한 줄 · 넉넉하면 설정 간격 그대로', async ({ page }) => {
  const { errs } = await setup(page);
  const fid = await insertBuzz(page);
  await page.locator('#bzf-layout [data-val="stack"]').click();
  await setFrameHeight(page, fid, 300);
  await page.locator('#bzf-redraw').click();
  const gapsOf = (st) => st.rows.slice(1).map((r, i) => r.ot - (st.rows[i].ot + st.rows[i].oh));
  const a = await stateOf(page, fid);
  const ga = gapsOf(a);
  expect(a.h, '높이 300 그대로').toEqual(['300', '300px', '300px', 300]);
  expect(ga.every((g) => g < 0), `넘치면 간격이 음수(겹침) ${ga}`).toBe(true);
  expect(Math.max(...ga) - Math.min(...ga) <= 1, `간격이 고르다 ${ga}`).toBe(true);
  const last = a.rows[a.rows.length - 1];
  expect(last.ot + last.oh <= a.ch, `마지막 밑변 ${last.ot + last.oh} ≤ ${a.ch}`).toBe(true);
  expect(outsideOf(a)).toEqual([]);
  await expect(page.locator('#bzf-squeeze'), '겹쳐 놓았다는 안내가 보인다').toBeVisible();
  await pickFrame(page, fid);
  await expect(page.locator('#bzf-squeeze'), '패널을 다시 열어도 안내가 보인다').toBeVisible();
  await setFrameHeight(page, fid, 1200);
  await page.locator('#bzf-redraw').click();
  const b = await stateOf(page, fid);
  const gap = await page.evaluate(async (fid) => (await import('/js/blocks/buzz-frame.js')).getBuzz(document.getElementById(fid), 'gap'), fid);
  expect(gapsOf(b).every((g) => Math.abs(g - gap) <= 1), `넉넉하면 설정 간격 ${gap} 그대로 ${gapsOf(b)}`).toBe(true);
  await expect(page.locator('#bzf-squeeze'), '안내가 꺼진다').toBeHidden();
  expect(errs).toEqual([]);
});

test('BZ-10 깊이 — 뒤쪽 말풍선을 작고 흐리게(자리 불변) · 개수를 늘려도 기존 단계가 다시 매겨지지 않는다', async ({ page }) => {
  const { errs } = await setup(page);
  const fid = await insertBuzz(page);
  const a = await stateOf(page, fid);
  expect(a.rows.filter((r) => r.far === '2').length, '전제: 뒤쪽(2) 낱개가 둘').toBe(2);
  expect(a.rows.filter((r) => r.far === '1').length, '전제: 가운데(1) 낱개가 둘').toBe(2);
  const farRow = a.rows.find((r) => r.far === '2').id;
  const look = () => page.evaluate((id) => { const cs = getComputedStyle(document.getElementById(id)); return { opacity: cs.opacity, transform: cs.transform, filter: cs.filter }; }, farRow);
  expect((await look()).opacity, '전제: 깊이 없음일 때는 또렷하다').toBe('1');
  await page.locator('#bzf-depth [data-val="strong"]').click();
  await expect.poll(() => page.evaluate((fid) => document.getElementById(fid).dataset.buzzDepth, fid)).toBe('strong');
  const l = await look();
  expect(l.opacity, '강하게: 뒤쪽 투명도').toBe('0.5');
  expect(l.transform !== 'none' && l.filter !== 'none', `강하게: 축소 · 흐림이 걸렸다 ${JSON.stringify(l)}`).toBe(true);
  const b = await stateOf(page, fid);
  expect(coordsOf(b), '깊이는 자리를 안 바꾼다').toEqual(coordsOf(a));
  for (let i = 0; i < 3; i++) await page.locator('#bzf-n-plus').click();
  const c = await stateOf(page, fid);
  expect(c.rows.length, '전제: 9개가 됐다').toBe(9);
  expect(c.rows.slice(0, 6).map((r) => r.far), '기존 여섯의 단계가 그대로다').toEqual(a.rows.map((r) => r.far));
  expect(c.rows.slice(6).map((r) => r.far), '새 것은 앞(단계 없음)').toEqual(['', '', '']);
  await page.locator('#bzf-depth [data-val="none"]').click();
  await expect.poll(async () => (await look()).opacity, { message: '없음: 다시 또렷하다' }).toBe('1');
  expect(errs).toEqual([]);
});

test('BZ-11 낱개 모달 패널의 Decoration — 꼬리 · 테이프가 «실제 요소»로 붙고 ⌘Z 로 돌아온다 · 버즈 밖 모달도 같다', async ({ page }) => {
  const { errs, secId } = await setup(page);
  const fid = await insertBuzz(page);
  const mid = (await stateOf(page, fid)).rows[0].mid;
  await pickModal(page, mid);
  const titles = await page.evaluate(() => [...document.querySelectorAll('#panel-right .prop-section-title')].map((e) => e.textContent.trim()));
  expect(titles.indexOf('Shadow') >= 0, `전제: Shadow 절이 있다 ${titles}`).toBe(true);
  expect(titles[titles.indexOf('Shadow') + 1], 'Shadow 바로 다음이 Decoration').toBe('Decoration');
  await expect(page.locator('#mdl-deco-tail-group .active')).toHaveText('없음');
  const deco = () => page.evaluate((id) => {
    const m = document.getElementById(id);
    const tail = m.querySelector('.mdl-deco-tail');
    const mb = m.getBoundingClientRect();
    const tb = tail ? tail.getBoundingClientRect() : null;
    return { tail: m.dataset.decoTail || '', tape: m.dataset.decoTape || '', tailEls: m.querySelectorAll('.mdl-deco-tail').length, tapeEls: m.querySelectorAll('.mdl-deco-tape').length,
      side: tail?.dataset.side || '', below: tb ? tb.bottom - mb.bottom : null, tailW: tb ? tb.width : null,
      before: getComputedStyle(m, '::before').content, slotFirst: m.firstElementChild?.className || '' };
  }, mid);
  await page.locator('#mdl-deco-tail-group [data-tail="left"]').click();
  const a = await deco();
  expect([a.tail, a.tailEls, a.side], '꼬리 왼쪽 — 속성 · 요소 하나 · 방향').toEqual(['left', 1, 'left']);
  expect(a.below > 0 && a.tailW > 0, `꼬리가 모달 밑변 아래로 나온다(${a.below})`).toBe(true);
  expect(a.before, '장식은 의사요소가 아니다').toBe('none');
  expect(a.slotFirst.startsWith('tb-mdl-'), `글 슬롯이 여전히 첫 자식이다(${a.slotFirst})`).toBe(true);
  await expect(page.locator('#mdl-deco-tail-group .active')).toHaveText('왼쪽');
  await page.locator('#mdl-deco-tail-group [data-tail="none"]').click();
  expect((await deco()).tailEls, '꼬리 없음 → 0').toBe(0);
  expect(await page.evaluate((id) => document.getElementById(id).hasAttribute('data-deco-tail'), mid), '없음이면 속성째 지운다').toBe(false);
  await page.locator('#mdl-deco-tape-group [data-tape="center"]').click();
  expect([(await deco()).tape, (await deco()).tapeEls], '테이프 가운데 → 요소 하나').toEqual(['center', 1]);
  await undo(page);
  await expect.poll(async () => (await deco()).tapeEls, { message: '⌘Z → 테이프 0' }).toBe(0);
  expect((await deco()).tape).toBe('');
  /* 버즈 밖의 보통 모달 */
  const plain = await page.evaluate((secId) => {
    window.deselectAll?.(); window.selectSection?.(document.getElementById(secId));
    const before = new Set([...document.querySelectorAll('#canvas .modal-block')].map((m) => m.id));
    window.addModalBlock();
    return [...document.querySelectorAll('#canvas .modal-block')].find((m) => !before.has(m.id))?.id || null;
  }, secId);
  expect(plain, '전제: 버즈 밖 모달이 만들어졌다').toBeTruthy();
  expect(await page.evaluate((id) => !document.getElementById(id).closest('.frame-block[data-buzz]'), plain), '전제: 그 모달은 버즈 프레임 밖이다').toBe(true);
  await pickModal(page, plain);
  await page.locator('#mdl-deco-tail-group [data-tail="right"]').click();
  expect(await page.evaluate((id) => [...document.getElementById(id).querySelectorAll('.mdl-deco-tail')].map((e) => e.dataset.side), plain), '버즈 밖 모달에도 꼬리가 붙는다').toEqual(['right']);
  expect(errs).toEqual([]);
});

test('BZ-12 저장 → 다시 열기 — 표식 · 설정 · 자리 · 뒤쪽 단계 · 높이가 그대로고 장식은 다시 그려진다', async ({ page }) => {
  const { errs } = await setup(page);
  const fid = await insertBuzz(page);
  await pickStyle(page, fid, 'tape');
  await page.locator('#bzf-depth [data-val="strong"]').click();
  await page.locator('#bzf-n-plus').click();
  const a = await stateOf(page, fid);
  expect([a.rows.length, a.attrs['data-buzz-depth'], a.rows.reduce((m, r) => m + r.tapeEls, 0)], '전제: 7개 · 깊이 강하게 · 테이프 7').toEqual([7, 'strong', 7]);
  const ser = await page.evaluate(() => window.getSerializedCanvas());
  expect([/class="[^"]*\bselected\b/.test(ser), ser.includes('mdl-rotate-zone'), ser.includes('data-bz-')], '직렬화에 선택 표시 · 회전 손잡이 · 옛 속성이 없다').toEqual([false, false, false]);
  const snap = await page.evaluate(() => window.serializeProject());
  await bootApp(page);
  await page.evaluate((d) => window.applyProjectData(d), JSON.parse(snap));
  await expect.poll(() => page.evaluate((fid) => !!document.getElementById(fid), fid), { message: '전제: 다시 연 문서에 그 프레임이 있다' }).toBe(true);
  await expect.poll(() => page.evaluate((fid) => document.getElementById(fid).querySelectorAll('.modal-block').length && [...document.getElementById(fid).querySelectorAll('.modal-block')].every((m) => m._blockBound), fid), { message: '모달이 다시 묶였다' }).toBe(true);
  const b = await stateOf(page, fid);
  const keep = (st) => ({ h: st.h, attrs: st.attrs, rows: st.rows.map((r) => [r.id, r.mid, r.left, r.top, r.z, r.w, r.far, r.rot, r.text, r.tape, r.tapeEls]) });
  expect(keep(b), '다시 연 뒤 = 저장 전').toEqual(keep(a));
  expect(b.selected, '선택은 저장되지 않는다').toBe(false);
  const lay = await layerOf(page, fid);
  expect(lay && [lay.name, lay.type], '다시 연 뒤에도 레이어 줄은 Buzz').toEqual(['Buzz', 'Buzz']);
  await pickFrame(page, fid);
  await expect(page.locator('#panel-right .prop-block-name')).toHaveText('Buzz');
  await expect(page.locator('#bzf-n-count')).toHaveText('7');
  await page.locator('#bzf-redraw').click();
  expect((await stateOf(page, fid)).h, '다시 연 뒤 ↻ 도 높이 불변').toEqual(a.h);
  expect(errs).toEqual([]);
});

test('BZ-13 실행 취소 — 다시 뿌리기 ⌘Z/⌘⇧Z · 개수 + 는 한 걸음 · ⌘Z 뒤 다시 고른 패널이 새 노드에 먹는다', async ({ page }) => {
  const { errs } = await setup(page);
  const fid = await insertBuzz(page);
  const a = await stateOf(page, fid);
  await page.locator('#bzf-reroll').click();
  const b = await stateOf(page, fid);
  expect(coordsOf(b), '전제: 뿌린 뒤 자리가 바뀌었다').not.toEqual(coordsOf(a));
  expect(b.attrs['data-buzz-seed'], '전제: 무늬번호가 바뀌었다').not.toBe(a.attrs['data-buzz-seed']);
  await undo(page);
  await expect.poll(async () => (await stateOf(page, fid))?.attrs['data-buzz-seed'], { message: '⌘Z → 무늬번호가 뿌리기 전으로' }).toBe(a.attrs['data-buzz-seed']);
  const u = await stateOf(page, fid);
  expect([coordsOf(u), u.h, u.rows.map((r) => r.rot)], '⌘Z → 자리 · 높이 · 회전이 뿌리기 전과 같다').toEqual([coordsOf(a), a.h, a.rows.map((r) => r.rot)]);
  await redo(page);
  await expect.poll(async () => (await stateOf(page, fid))?.attrs['data-buzz-seed'], { message: '⌘⇧Z → 뿌린 뒤로' }).toBe(b.attrs['data-buzz-seed']);
  expect(coordsOf(await stateOf(page, fid))).toEqual(coordsOf(b));
  /* 다시 뿌리기 = 히스토리 한 걸음(끝 표본이 있다) — ⌘Z 의 구제 칸에 기대지 않는다 */
  await pickFrame(page, fid);
  await expectOneUndoStep(page, async () => { await page.locator('#bzf-reroll').click(); }, '버즈 다시 뿌리기');
  /* 개수 + = 히스토리 한 걸음 */
  await pickFrame(page, fid);
  await expectOneUndoStep(page, async () => { await page.locator('#bzf-n-plus').click(); }, '버즈 개수 +1');
  expect((await stateOf(page, fid)).rows.length, '⌘Z 한 번 뒤 다시 6개').toBe(6);
  /* ⌘Z 는 캔버스를 통째로 간다 — 다시 고르면 패널이 «새 노드»를 잡는다 */
  await pickFrame(page, fid);
  const c = await stateOf(page, fid);
  await page.locator('#bzf-reroll').click();
  await expect.poll(async () => (await stateOf(page, fid)).attrs['data-buzz-seed'], { message: '⌘Z 뒤 다시 뿌리기가 지금 노드에 먹는다' }).not.toBe(c.attrs['data-buzz-seed']);
  expect(coordsOf(await stateOf(page, fid))).not.toEqual(coordsOf(c));
  expect(errs).toEqual([]);
});

test('BZ-14 복제 — 프레임 ⌘D 는 표식 · 설정 · 높이까지 그대로고 사본을 뿌려도 원본은 그대로 · 낱개 ⌘D 는 개수 +1', async ({ page }) => {
  const { errs } = await setup(page);
  const fid = await insertBuzz(page);
  const a = await stateOf(page, fid);
  expect(a.selected, '전제: 프레임이 골라져 있다').toBe(true);
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Meta+d');
  await expect.poll(() => page.evaluate(() => document.querySelectorAll('#canvas .frame-block[data-buzz="1"]').length), { message: '프레임 ⌘D → 버즈 프레임 둘' }).toBe(2);
  const copyId = await page.evaluate((fid) => [...document.querySelectorAll('#canvas .frame-block[data-buzz="1"]')].map((f) => f.id).find((id) => id !== fid), fid);
  const ids = await page.evaluate(() => [...document.querySelectorAll('#canvas [id]')].map((e) => e.id));
  expect(ids.length - new Set(ids).size, 'id 중복 0').toBe(0);
  const c0 = await stateOf(page, copyId);
  expect([c0.rows.length, c0.h, c0.attrs], '사본: 개수 · 높이 · 설정이 원본과 같다').toEqual([a.rows.length, a.h, a.attrs]);
  expect(c0.rows.map((r) => [r.left, r.top, r.z, r.far]), '사본: 자리 · 단계가 원본과 같다').toEqual(a.rows.map((r) => [r.left, r.top, r.z, r.far]));
  const layC = await layerOf(page, copyId);
  expect(layC && layC.type, '사본의 레이어 줄도 Buzz').toBe('Buzz');
  await pickFrame(page, copyId);
  expect(await isSelected(page, fid), '전제: 고른 것은 사본이다(원본 아님)').toBe(false);
  await page.locator('#bzf-reroll').click();
  await expect.poll(async () => (await stateOf(page, copyId)).attrs['data-buzz-seed'], { message: '사본의 무늬번호가 바뀐다' }).not.toBe(a.attrs['data-buzz-seed']);
  expect(coordsOf(await stateOf(page, copyId)).map((s) => s.split(':')[1]), '사본 자리가 바뀌었다').not.toEqual(coordsOf(a).map((s) => s.split(':')[1]));
  const orig = await stateOf(page, fid);
  expect([coordsOf(orig), orig.attrs], '원본은 자리도 무늬번호도 그대로').toEqual([coordsOf(a), a.attrs]);
  /* 낱개 모달 ⌘D */
  await pickFrame(page, fid);
  await pickModal(page, a.rows[0].mid);
  await page.keyboard.press('Meta+d');
  await expect.poll(async () => (await stateOf(page, fid)).rows.length, { message: '낱개 ⌘D → 그 프레임의 row +1' }).toBe(7);
  await pickFrame(page, fid);
  await expect(page.locator('#bzf-n-count'), '패널 개수도 7').toHaveText('7');
  expect((await stateOf(page, fid)).h, '높이 불변').toEqual(a.h);
  expect(errs).toEqual([]);
});

test('BZ-15 내보내기 — PNG(html2canvas 길)가 돈다 · HTML 에 장식 요소 · 깊이 규칙 · 글이 실린다', async ({ page }) => {
  test.setTimeout(90000);
  const { errs, secId } = await setup(page);
  const fid = await insertBuzz(page);
  await pickStyle(page, fid, 'tape');
  await page.locator('#bzf-depth [data-val="strong"]').click();
  const st = await stateOf(page, fid);
  expect(st.rows.reduce((m, r) => m + r.tapeEls, 0), '전제: 테이프 요소 6').toBe(6);
  const cap = await page.evaluate(async (secId) => {
    const m = await import('/js/io/capture-safety.js');
    const r = await m.captureSectionImage(document.getElementById(secId));
    return { ok: r.ok, reason: r.reason ?? null, png: r.ok ? /^data:image\/png/.test(r.dataUrl) : null, usable: r.ok ? window.isUsableImageDataUrl(r.dataUrl) : null,
      left: [...document.body.children].filter((e) => e.classList?.contains('section-block')).length };
  }, secId);
  expect(cap, 'PNG(html2canvas 길): ok · PNG · 쓸 만한 그림 · 남은 클론 0').toEqual({ ok: true, reason: null, png: true, usable: true, left: 0 });
  /* «새는 것»(판정서 M-1): 모달을 고른 채 내보낸다 — 캔버스에는 회전 핫존 · 선택 표시가 있다 */
  await pickModal(page, st.rows[0].mid);
  const live = await page.evaluate(() => ({ zones: document.querySelectorAll('#canvas .mdl-rotate-zone').length, selected: document.querySelectorAll('#canvas .selected').length }));
  expect(live.zones, '전제: 고른 모달에 회전 핫존 넷이 붙어 있다').toBe(4);
  expect(live.selected > 0, '전제: 캔버스에 선택 표시가 있다').toBe(true);
  const html = await page.evaluate(async () => {
    const origCreate = URL.createObjectURL; const origClick = HTMLAnchorElement.prototype.click;
    let captured = null;
    URL.createObjectURL = (b) => { captured = b; return 'blob:buzz-spec'; };
    HTMLAnchorElement.prototype.click = function () {};
    try { await window.exportHTMLFile(); } finally { URL.createObjectURL = origCreate; HTMLAnchorElement.prototype.click = origClick; }
    return captured ? await captured.text() : null;
  });
  expect(typeof html, '전제: 내보낸 HTML 을 가로챘다').toBe('string');
  expect(html.split('class="mdl-deco-tape"').length - 1, 'HTML: 테이프 요소 6').toBe(6);
  const leaks = html.match(/class="[^"]*\b(?:mdl-rotate-zone|selected|[a-z-]*resize-handle|[a-z-]*overlay-handle|[a-z-]*rotate-zone)\b[^"]*"/g) || [];
  expect(leaks, 'HTML: 편집 흔적(회전 핫존 · 선택 표시 · 손잡이)이 하나도 안 샌다').toEqual([]);
  expect(html.includes('data-buzz="1"') && html.includes('data-buzz-far="2"'), 'HTML: 표식 · 뒤쪽 단계 속성').toBe(true);
  expect(/data-buzz-depth="strong"\]\s*>\s*\.row\[data-buzz-far="2"\]\s*\{[^}]*opacity/.test(html), 'HTML: 깊이 규칙이 스타일로 실렸다').toBe(true);
  expect(/#canvas[^{]*data-buzz-far/.test(html), 'HTML: 깊이 규칙에 캔버스 접두가 없다').toBe(false);
  expect(st.rows.filter((r) => html.includes(r.text)).length, 'HTML: 글 6개').toBe(6);
  expect(html.includes(`left:${st.rows[0].left}`) || html.includes(`left: ${st.rows[0].left}`), 'HTML: 자리(인라인 left)가 실렸다').toBe(true);
  expect(errs).toEqual([]);
});

test('BZ-16 캔버스 배율과 무관 — 같은 무늬번호면 40% 에서도 100% 에서도 같은 자리', async ({ page }) => {
  const { errs } = await setup(page);
  const fid = await insertBuzz(page);
  const z0 = await page.evaluate(() => window.currentZoom);
  expect(z0 !== 100, `전제: 처음 배율이 100 이 아니다(${z0})`).toBe(true);
  const seed = page.locator('#bzf-seed');
  await seed.fill('4127');
  await seed.press('Enter');
  await expect.poll(() => page.evaluate((fid) => document.getElementById(fid).dataset.buzzSeed, fid), { message: '전제: 무늬번호 4127' }).toBe('4127');
  const a = await stateOf(page, fid);
  await zoomTo(page, 100);                                          /* 화면이 실제로 100% 가 된 뒤에 다시 그린다 */
  await page.locator('#bzf-redraw').click();
  const b = await stateOf(page, fid);
  expect([coordsOf(b), b.rows.map((r) => r.w), b.rows.map((r) => r.rot)], '배율 100% 에서 같은 번호로 다시 그려도 자리 · 폭 · 회전이 같다').toEqual([coordsOf(a), a.rows.map((r) => r.w), a.rows.map((r) => r.rot)]);
  expect(b.h).toEqual(a.h);
  expect(errs).toEqual([]);
});

test('BZ-17 ★⑶ 보통 프레임은 그대로 — 모달이 둘 들어 있어도 표식이 없으면 Frame 이고 Buzz 절이 없다', async ({ page }) => {
  const { errs } = await setup(page);
  const fid = await page.evaluate(() => {
    window.addFrameBlock();
    const f = document.querySelector('#canvas .frame-block[data-free-layout="true"]');
    ['보통 프레임 안의 모달 하나', '보통 프레임 안의 모달 둘'].forEach((t, i) => {
      const { row, block } = window.makeModalBlock({ variant: 'plain', text: t });
      row.style.position = 'absolute'; row.style.left = (40 + i * 60) + 'px'; row.style.top = (40 + i * 160) + 'px'; row.style.width = '460px';
      row.setAttribute('draggable', 'false');
      f.appendChild(row); window.renderModalBlock(block); window.bindBlock(block);
    });
    window.bindFrameDropZone?.(f); window.buildLayerPanel?.(); window.deselectAll?.();
    return f.id;
  });
  expect(await page.evaluate((fid) => { const f = document.getElementById(fid); return [f.dataset.buzz || null, f.querySelectorAll(':scope > .row > .modal-block').length]; }, fid), '전제: 표식 없는 자유배치 프레임 + 모달 둘').toEqual([null, 2]);
  await pickFrame(page, fid, { buzz: false });
  await expect(page.locator('#panel-right .prop-block-name')).toHaveText('Frame');
  await expect(page.locator('#bzf-section'), '보통 프레임 패널에 Buzz 절이 없다').toHaveCount(0);
  await expect(page.locator('#ss-to-stack-btn'), '보통 자유배치 프레임에는 Layout 절(free → stack)이 그대로 있다').toHaveCount(1);
  expect(await page.evaluate(() => document.querySelector('#panel-right .prop-block-icon svg')?.getAttribute('viewBox')), '머리 아이콘은 프레임 것 그대로').not.toBe('0 0 12 12');
  const lay = await layerOf(page, fid);
  expect(lay && [lay.name, lay.type, lay.viewBox === '0 0 12 12'], '레이어 줄은 Frame · 프레임 아이콘').toEqual(['Frame', 'Frame', false]);
  expect(errs).toEqual([]);
});

/* 테이프의 «자리»(현빈 1013t1). 모양(폭 · 높이 · 색)은 js/blocks/modal-block.js MODAL_TAPE_SHAPE 한 곳이고 여기서는 자리를 잠근다:
   윗변에 걸친다(세로 중심 = 모달 윗변) · 가운데는 가로 중심 · 좌/우는 가장자리에서 9% · 모달을 돌리거나 배율을 바꿔도 모달 기준 같은 자리. */
test('BZ-18 테이프 자리 — 윗변에 걸치고(중심 = 윗변) 좌 · 중 · 우 자리가 맞다 · 회전 · 배율 · 저장 왕복에서 모달 기준 같은 자리', async ({ page }) => {
  const { errs, secId } = await setup(page);
  const mid = await page.evaluate(() => { const made = window.addModalBlock(); return (made?.block || document.querySelector('#canvas .modal-block')).id; });
  expect(mid, '전제: 모달이 만들어졌다').toBeTruthy();
  const put = (side, rot) => page.evaluate(([id, side, rot]) => {
    const m = document.getElementById(id);
    m.dataset.decoTape = side; m.dataset.rotation = String(rot);
    window.renderModalBlock(m);
  }, [mid, side, rot]);
  /* 레이아웃 px — 테이프의 offsetParent 는 모달이다 */
  const layout = () => page.evaluate((id) => {
    const m = document.getElementById(id);
    const t = m.querySelector('.mdl-deco-tape');
    return { n: m.querySelectorAll('.mdl-deco-tape').length, parentIsModal: t?.offsetParent === m, mw: m.clientWidth, mh: m.offsetHeight,
      l: t?.offsetLeft, top: t?.offsetTop, w: t?.offsetWidth, h: t?.offsetHeight, deg: t?.style.transform || '' };
  }, mid);
  /* 화면에서 잰 자리를 모달 좌표계(회전 · 배율을 푼 것)로 — 테이프 중심 − 모달 중심 */
  const inModalFrame = () => page.evaluate((id) => {
    const m = document.getElementById(id);
    const t = m.querySelector('.mdl-deco-tape');
    const mb = m.getBoundingClientRect();
    const tb = t.getBoundingClientRect();
    const rot = (parseInt(m.dataset.rotation, 10) || 0) * Math.PI / 180;
    const dx = (tb.left + tb.width / 2) - (mb.left + mb.width / 2), dy = (tb.top + tb.height / 2) - (mb.top + mb.height / 2);
    const scale = new DOMMatrix(getComputedStyle(document.getElementById('canvas-scaler')).transform).a;   /* 지금 화면의 실제 배율 */
    return { x: (dx * Math.cos(-rot) - dy * Math.sin(-rot)) / scale, y: (dx * Math.sin(-rot) + dy * Math.cos(-rot)) / scale, scale };
  }, mid);
  const near = (a, b, tol = 1) => Math.abs(a - b) <= tol;

  await put('center', 0);
  const c = await layout();
  expect([c.n, c.parentIsModal], '전제: 테이프는 모달의 자식 요소 하나').toEqual([1, true]);
  expect(c.top < 0 && c.top + c.h > 0, `윗변에 걸친다(위 ${-c.top}px · 아래 ${c.top + c.h}px)`).toBe(true);
  expect(near(c.top + c.h / 2, 0), `세로 중심이 모달 윗변이다(${c.top + c.h / 2})`).toBe(true);
  expect(near(c.l + c.w / 2, c.mw / 2), `가운데: 가로 중심 ${c.l + c.w / 2} ≈ 모달 중심 ${c.mw / 2}`).toBe(true);
  expect([c.w, c.h, c.top], '지금 모양의 수치(폭 · 높이 · 위로 나온 만큼) — 모양을 바꾸면 이 줄을 같이 고친다').toEqual([132, 40, -20]);
  await put('left', 0);
  const l = await layout();
  expect(near(l.l, l.mw * 0.09), `왼쪽: 왼변에서 9% (${l.l} ≈ ${l.mw * 0.09})`).toBe(true);
  expect(l.top).toBe(c.top);
  await put('right', 0);
  const r = await layout();
  expect(near(r.mw - (r.l + r.w), r.mw * 0.09), `오른쪽: 오른변에서 9% (${r.mw - (r.l + r.w)} ≈ ${r.mw * 0.09})`).toBe(true);
  expect([l.deg, c.deg, r.deg], '기울기 — 왼 −4° · 가운데 2° · 오른 5°').toEqual(['rotate(-4deg)', 'rotate(2deg)', 'rotate(5deg)']);

  /* 모달을 돌려도 모달 좌표계에서 같은 자리(테이프가 모달과 같이 돈다) */
  await put('center', 0);
  const f0 = await inModalFrame();
  expect(near(f0.x, 0) && near(f0.y, -c.mh / 2), `전제: 화면에서 잰 자리도 「가운데 · 윗변」이다 (${f0.x}, ${f0.y}) vs (0, ${-c.mh / 2})`).toBe(true);
  await put('center', 25);
  expect(await page.evaluate((id) => document.getElementById(id).style.transform, mid), '전제: 모달이 실제로 돌았다').toBe('rotate(25deg)');
  const f25 = await inModalFrame();
  expect(near(f25.x, f0.x) && near(f25.y, f0.y), `회전 25° 뒤에도 모달 기준 같은 자리 (${f25.x}, ${f25.y}) vs (${f0.x}, ${f0.y})`).toBe(true);
  const scr = await page.evaluate((id) => { const m = document.getElementById(id); const a = m.getBoundingClientRect(); const b = m.querySelector('.mdl-deco-tape').getBoundingClientRect(); return (b.left + b.width / 2) - (a.left + a.width / 2); }, mid);
  expect(Math.abs(scr) > 1, `전제: 화면에서는 테이프가 옆으로 돌아가 있다(${scr}) — 같이 돈다는 뜻`).toBe(true);

  /* 배율 두 값 — 모달 대비 상대 자리 · 크기가 같다 */
  const ratioAt = async (z) => {
    await zoomTo(page, z);
    await waitStableRect(page, `[id="${mid}"]`);
    const f = await inModalFrame();
    const k = await page.evaluate((id) => { const m = document.getElementById(id); const a = m.getBoundingClientRect(); const b = m.querySelector('.mdl-deco-tape').getBoundingClientRect(); return b.width / a.width; }, mid);
    return { x: f.x, y: f.y, k, scale: f.scale };
  };
  await put('center', 0);
  const z50 = await ratioAt(50), z200 = await ratioAt(200);
  expect([z50.scale, z200.scale], '전제: 배율이 실제로 두 값이다').toEqual([0.5, 2]);
  expect(near(z50.x, z200.x) && near(z50.y, z200.y), `배율 50% · 200% 에서 모달 기준 같은 자리 (${z50.x}, ${z50.y}) vs (${z200.x}, ${z200.y})`).toBe(true);
  expect(Math.abs(z50.k - z200.k) < 0.01, `모달 대비 테이프 폭 비율이 같다 ${z50.k} vs ${z200.k}`).toBe(true);

  /* 직렬화 왕복 — 저장한 글자를 다시 넣고 다시 묶어도 같은 자리 */
  await put('left', 8);
  const before = await layout();
  await page.evaluate((secId) => {
    const html = window.getSerializedCanvas();
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach((s) => s.remove());
    c.insertAdjacentHTML('beforeend', html);
    window.rebindAll();
    return secId;
  }, secId);
  await expect.poll(() => page.evaluate((id) => !!document.getElementById(id)?._blockBound, mid), { message: '전제: 다시 넣은 모달이 묶였다' }).toBe(true);
  expect(await layout(), '직렬화 왕복 뒤 테이프 자리 · 크기 · 기울기가 같다').toEqual(before);
  expect(await page.evaluate((id) => document.getElementById(id).dataset.rotation, mid)).toBe('8');
  expect(errs).toEqual([]);
});

/* 판정서 M5 의 남은 절반 — 「옮긴 것」 개념은 없어졌지만, 개수 − 는 여전히 «글을 고친» 마지막 말풍선도 묻지 않고 지운다.
   그 글이 ⌘Z 한 번으로 돌아오는지 지킨다. (글 고치기는 장면 준비다 — 재는 것은 − 와 ⌘Z 다.) */
test('BZ-19 개수 − 가 지운 말풍선은 ⌘Z 로 글째 돌아온다 · 무늬번호 칸의 이상한 값은 1~99999 로 접힌다', async ({ page }) => {
  const { errs } = await setup(page);
  const fid = await insertBuzz(page);
  const EDITED = '손으로 고쳐 쓴 마지막 후기 한 줄';
  const lastMid = (await stateOf(page, fid)).rows[5].mid;
  await page.evaluate(([id, text]) => {
    const m = document.getElementById(id);
    m.dataset.textText = text; delete m.dataset.textHtml;
    window.renderModalBlock(m);
    window.pushHistory?.('글 고침(장면 준비)');
  }, [lastMid, EDITED]);
  const a = await stateOf(page, fid);
  expect(a.rows[5].text, '전제: 마지막 말풍선의 글이 고쳐졌다').toBe(EDITED);
  expect(a.selected, '전제: 프레임이 골라져 있다').toBe(true);
  await page.locator('#bzf-n-minus').click();
  const b = await stateOf(page, fid);
  expect([b.rows.length, b.rows.some((r) => r.text === EDITED)], '− → 5개 · 고친 글의 말풍선이 지워졌다').toEqual([5, false]);
  await undo(page);
  await expect.poll(async () => (await stateOf(page, fid))?.rows.length, { message: '⌘Z 한 번 → 다시 6개' }).toBe(6);
  const c = await stateOf(page, fid);
  expect(c.rows[5].text, '⌘Z → 고친 글이 그대로 돌아왔다').toBe(EDITED);
  expect([coordsOf(c), c.h], '⌘Z → 자리 · 높이도 그대로').toEqual([coordsOf(a), a.h]);
  /* 무늬번호 칸 — 음수 · 아주 큰 수(판정서 H2) */
  await pickFrame(page, fid);
  const seed = page.locator('#bzf-seed');
  for (const [typed, want] of [['-5', '5'], ['99999999999', '99999'], ['0', '1']]) {
    await seed.fill(typed);
    await seed.press('Enter');
    await expect.poll(() => page.evaluate((fid) => document.getElementById(fid).dataset.buzzSeed, fid), { message: `무늬번호 ${typed} → ${want}` }).toBe(want);
    await expect(seed, '칸에도 접힌 값이 보인다').toHaveValue(want);
  }
  expect(errs).toEqual([]);
});

/* 판정서 D-1 — 프레임 높이를 «줄인 직후»(다시 그리기를 누르기 전)에 말풍선이 프레임 밖에 남으면 안 된다.
   밖으로 나간 것이 있으면 그 자리에서 같은 무늬번호로 안에 다시 놓고, 없으면(키웠으면) 손으로 옮긴 자리도 그대로 둔다. */
test('BZ-20 ★⑵ 패널 높이 칸으로 줄인 «직후» 말풍선이 프레임 안 · 키울 때는 자리 불변 · 높이 변경과 히스토리 한 칸', async ({ page }) => {
  const { errs } = await setup(page);
  const fid = await insertBuzz(page);
  const s0 = await stateOf(page, fid);
  /* 한 개를 손으로 옮긴 뒤 높이를 «키운다» → 아무 자리도 안 변한다 */
  await pickModal(page, s0.rows[0].mid);
  const p = await pointOn(page, s0.rows[0].mid);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.mouse.move(p.x + 24, p.y + 14, { steps: 6 });
  await page.mouse.up();
  await pickFrame(page, fid);
  const moved = await stateOf(page, fid);
  expect(coordsOf(moved), '전제: 손으로 옮겨 자리가 변했다').not.toEqual(coordsOf(s0));
  expect(outsideOf(moved), '전제: 옮긴 뒤에도 프레임 안이다').toEqual([]);
  await setFrameHeight(page, fid, 1000);
  const grown = await stateOf(page, fid);
  expect([coordsOf(grown), grown.attrs['data-buzz-seed']], '키우면 자리 · 무늬번호 불변(손으로 옮긴 자리도)').toEqual([coordsOf(moved), moved.attrs['data-buzz-seed']]);
  /* 1000 에 맞춰 펼친 뒤 300 으로 줄인다 — 줄인 «직후»를 잰다(↻ 를 누르지 않는다) */
  await page.locator('#bzf-redraw').click();
  const spread = await stateOf(page, fid);
  expect(Math.max(...spread.rows.map((r) => r.ot + r.oh)) > 300, '전제: 1000 에서는 300 아래까지 펼쳐져 있다').toBe(true);
  await expect(page.locator('#bzf-squeeze'), '전제: 1000 에서는 안내가 꺼져 있다').toBeHidden();
  const r = await expectOneUndoStep(page, async () => {
    await setFrameHeight(page, fid, 300);
    const now = await stateOf(page, fid);
    expect(now.h, '높이는 사용자가 정한 300').toEqual(['300', '300px', '300px', 300]);
    expect(outsideOf(now), '줄인 직후 — 프레임 밖 말풍선 0(↻ 없이)').toEqual([]);
    expect(Math.max(...now.rows.map((x) => x.ot + x.oh)) <= now.ch, '줄인 직후 — 맨 아래 밑변이 프레임 안').toBe(true);
    expect(now.attrs['data-buzz-seed'], '같은 무늬번호로 다시 놓았다').toBe(spread.attrs['data-buzz-seed']);
    await expect(page.locator('#bzf-squeeze'), '줄인 직후 — 겹쳐 놓았다는 안내가 켜진다').toBeVisible();
  }, '버즈 프레임 높이 1000 → 300');
  expect(r.undoDPos, '높이 변경 + 다시 놓기 = ⌘Z 한 칸').toBe(-1);
  const back = await stateOf(page, fid);
  expect([back.h, coordsOf(back)], '⌘Z 한 번 → 높이 1000 과 그때의 자리가 같이 돌아온다').toEqual([spread.h, coordsOf(spread)]);
  expect(errs).toEqual([]);
});

/* 판정서 H-1 — 내보낸 HTML 은 편집기의 글꼴(Pretendard)이 없는 화면에서도 열린다. 대체 글꼴은 글이 더 넓다.
   폭 여유가 모자라면 마지막 글자가 다음 줄로 떨어진다 → 스타일 6종의 낱개마다 줄 수가 편집기와 같아야 한다.

   ★「글꼴 없는 화면」은 이 칸이 «스스로» 만든다(태양 게이트 2026-10-13: Pretendard 가 깔린 맥에서 전제가 안 서 2/2 빨강이었다).
     시스템에 깔린 글꼴은 요청 차단(page.route)으로 못 막는다 ⇒ 내보낸 글자에서 글꼴 «이름»을 이 세상에 없는 이름으로 바꾼다.
     그러면 어떤 요소도 「Pretendard」를 가리키지 않아, 깔려 있든 @font-face 로 실려 있든 그 글꼴이 뽑힐 길이 없고 다음 대체 글꼴로 내려간다.
   ★그 우회가 「Pretendard 가 있는 화면」에서도 먹는지를 매번 같이 잰다(대조 페이지 = 레인의 woff2 를 @font-face 로 실은 화면):
     이름을 안 바꾸면 넓어진 낱개 0(= 게이트가 본 그 헛도는 꼴) · 이름을 바꾸면 넓어진 낱개 > 0. */
const NO_FONT = 'BuzzNoSuchFont';
const PRETENDARD_FILES = { 500: 'Medium', 600: 'SemiBold', 700: 'Bold', 800: 'ExtraBold' };
test('BZ-21 내보낸 HTML 을 글꼴 없는 화면에서 열어도 말풍선 글의 줄 수가 편집기와 같다(스타일 6종 · 글꼴 설치 여부와 무관)', async ({ page, context }) => {
  test.setTimeout(150000);
  const fs = require('fs');
  const path = require('path');
  const { errs } = await setup(page);
  const fid = await insertBuzz(page);
  /* 줄 수 = 글 슬롯의 높이 ÷ 줄 높이. 글 폭은 그 화면의 글꼴로 canvas 에 재어 «다른 글꼴로 그려졌다»는 전제를 잡는다. */
  const measure = (pg) => pg.evaluate(async (fid) => {
    await document.fonts.ready;
    return [...document.getElementById(fid).querySelectorAll(':scope > .row > .modal-block')].map((m) => {
      const slot = m.querySelector('[data-mdl-slot="text"]');
      const cs = getComputedStyle(slot);
      const ctx = document.createElement('canvas').getContext('2d');
      ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      const lh = parseFloat(cs.lineHeight);
      return { id: m.id, lines: Math.round(slot.offsetHeight / lh), lh, textW: ctx.measureText(slot.textContent).width, family: cs.fontFamily };
    });
  }, fid);
  const exportHtml = () => page.evaluate(async () => {
    const origCreate = URL.createObjectURL; const origClick = HTMLAnchorElement.prototype.click;
    let captured = null;
    URL.createObjectURL = (b) => { captured = b; return 'blob:buzz-spec'; };
    HTMLAnchorElement.prototype.click = function () {};
    try { await window.exportHTMLFile(); } finally { URL.createObjectURL = origCreate; HTMLAnchorElement.prototype.click = origClick; }
    return captured ? await captured.text() : null;
  });
  const rename = (html) => html.replace(/Pretendard/g, NO_FONT);
  /* ① 글꼴 없는 화면 — 바깥 자원 0 + 글꼴 이름을 없는 이름으로 */
  const bare = await context.newPage();
  await bare.setViewportSize({ width: 1200, height: 900 });
  await bare.route('**/*', (r) => r.abort());
  /* ② 대조: Pretendard 가 «있는» 화면 — 레인의 woff2 를 @font-face 로 싣는다(설치된 셈). 그 밖의 바깥 자원은 0 */
  const withFont = await context.newPage();
  await withFont.setViewportSize({ width: 1200, height: 900 });
  const FONT_DIR = path.join(__dirname, '..', '..', 'assets', 'fonts', 'woff2');
  await withFont.route('**/*', (r) => {
    const m = /\/buzz-font\/(Pretendard-[A-Za-z]+\.woff2)$/.exec(new URL(r.request().url()).pathname);
    if (!m) return r.abort();
    return r.fulfill({ contentType: 'font/woff2', headers: { 'access-control-allow-origin': '*' }, body: fs.readFileSync(path.join(FONT_DIR, m[1])) });
  });
  const FACE = '<style>' + Object.entries(PRETENDARD_FILES).map(([w, name]) =>
    `@font-face{font-family:'Pretendard';font-weight:${w};src:url('http://buzz-font.test/buzz-font/Pretendard-${name}.woff2') format('woff2');}`).join('') + '</style>';
  const withFace = (html) => html.replace(/<head[^>]*>/i, (h) => h + FACE);
  const loadFaces = () => withFont.evaluate(async (weights) => {
    await Promise.all(weights.map((w) => document.fonts.load(`${w} 28px Pretendard`, '가나다')));
    return weights.filter((w) => [...document.fonts].some((f) => f.family.replace(/['"]/g, '') === 'Pretendard' && f.weight === String(w) && f.status === 'loaded')).length;
  }, Object.keys(PRETENDARD_FILES).map(Number));

  const count = { bare: 0, withFontAsIs: 0, withFontRenamed: 0 };
  const widerThan = (ex, ed) => ex.filter((x, i) => x.textW > ed[i].textW * 1.005).length;
  for (const k of STYLE_KEYS) {
    await pickStyle(page, fid, k);
    const ed = await measure(page);
    expect(ed.length === 6 && ed.every((x) => Number.isFinite(x.lh) && x.lines >= 1), `${k} 전제: 편집기에서 낱개 6의 줄 수를 쟀다 ${JSON.stringify(ed.map((x) => x.lines))}`).toBe(true);
    const html = await exportHtml();
    expect(typeof html, `${k} 전제: 내보낸 HTML 을 가로챘다`).toBe('string');
    expect(html.split('Pretendard').length - 1 > 0 && /<head[^>]*>/i.test(html), `${k} 전제: 내보낸 글자가 Pretendard 를 가리키고 head 가 있다`).toBe(true);
    const bareHtml = rename(html);
    expect(bareHtml.includes('Pretendard'), `${k} 전제: 바꾼 글자에는 Pretendard 라는 이름이 하나도 없다`).toBe(false);

    /* ① 글꼴 없는 화면 */
    await bare.setContent(bareHtml, { waitUntil: 'domcontentloaded' });
    const ex = await measure(bare);
    expect(ex.map((x) => x.id), `${k} 전제: 내보낸 화면에 같은 낱개 6`).toEqual(ed.map((x) => x.id));
    expect(ex.every((x) => x.family.includes(NO_FONT) && !x.family.includes('Pretendard')), `${k} 전제: 글 슬롯의 글꼴 이름이 없는 이름으로 바뀌었다(${ex[0].family})`).toBe(true);
    count.bare += widerThan(ex, ed);
    expect(ex.map((x) => x.lines), `${k}: 글꼴 없는 화면의 줄 수 = 편집기의 줄 수`).toEqual(ed.map((x) => x.lines));

    /* ② 대조 — Pretendard 가 있는 화면: 그대로 열면 편집기와 같은 폭(넓어진 것 0) */
    await withFont.setContent(withFace(html), { waitUntil: 'domcontentloaded' });
    expect(await loadFaces(), `${k} 전제(대조): Pretendard 네 굵기가 그 화면에 실렸다`).toBe(4);
    count.withFontAsIs += widerThan(await measure(withFont), ed);
    /* 같은 화면(Pretendard 가 실려 있다)에 이름을 바꾼 글자를 넣으면 — 우회가 먹어 대체 글꼴로 그려진다 */
    await withFont.setContent(withFace(bareHtml), { waitUntil: 'domcontentloaded' });
    expect(await loadFaces(), `${k} 전제(대조): 이름을 바꾼 글자를 넣어도 그 화면에는 Pretendard 가 실려 있다`).toBe(4);
    const ex2 = await measure(withFont);
    count.withFontRenamed += widerThan(ex2, ed);
    expect(ex2.map((x) => x.lines), `${k}: Pretendard 가 있는 화면에서 우회를 거쳐도 줄 수 = 편집기`).toEqual(ed.map((x) => x.lines));
  }
  console.log(`[BZ-21] 넓어진 낱개 — 글꼴 없는 화면 ${count.bare}/36 · Pretendard 있는 화면(그대로) ${count.withFontAsIs}/36 · Pretendard 있는 화면(이름 바꿈) ${count.withFontRenamed}/36`);
  expect(count.bare > 0, `전제: 내보낸 화면은 다른(더 넓은) 글꼴로 그려졌다 — 넓어진 낱개 ${count.bare}/36`).toBe(true);
  expect(count.withFontAsIs, `전제(대조): Pretendard 가 있는 화면에 그대로 열면 편집기와 같은 폭이다(넓어진 낱개 0) — 이름을 안 바꾸면 이 칸은 헛돈다`).toBe(0);
  expect(count.withFontRenamed > 0, `전제(대조): Pretendard 가 있는 화면에서도 이름을 바꾸면 대체 글꼴로 그려진다 — 넓어진 낱개 ${count.withFontRenamed}/36`).toBe(true);
  await bare.close();
  await withFont.close();
  expect(errs).toEqual([]);
});

/* 판정서 D-1 의 둘째 입구 — 크기 손잡이(아래 오른쪽 모서리)를 진짜로 끌어 줄인다. 놓는 순간 안에 맞는다. */
test('BZ-22 ★⑵ 크기 손잡이를 끌어 줄이고 «놓은 직후» 말풍선이 프레임 안 · ⌘Z 한 번에 높이와 자리가 같이 돌아온다', async ({ page }) => {
  const { errs } = await setup(page);
  const fid = await insertBuzz(page);
  await page.locator('#bzf-redraw').click();
  const a = await stateOf(page, fid);
  expect(a.selected, '전제: 프레임이 골라져 있다(손잡이가 떠 있다)').toBe(true);
  await page.evaluate((fid) => document.getElementById(fid).scrollIntoView({ block: 'center' }), fid);
  await waitStableRect(page, `[id="${fid}"]`);
  const handle = page.locator('.ss-resize-handle.se');
  await expect(handle, '전제: 아래 오른쪽 크기 손잡이가 하나 보인다').toHaveCount(1);
  const scale = await page.evaluate(() => new DOMMatrix(getComputedStyle(document.getElementById('canvas-scaler')).transform).a);
  const b = await handle.boundingBox();
  const hx = b.x + b.width / 2, hy = b.y + b.height / 2;
  const up = Math.round((a.ch / 2) * scale);                        /* 프레임 높이의 절반만큼 위로(화면 px) */
  await page.mouse.move(hx, hy);
  await page.mouse.down();
  await page.mouse.move(hx, hy - up / 2, { steps: 5 });
  await page.mouse.move(hx, hy - up, { steps: 5 });
  await page.mouse.up();
  const c = await stateOf(page, fid);
  expect(c.ch < a.ch * 0.6, `전제: 손잡이로 높이가 줄었다 ${a.ch} → ${c.ch}`).toBe(true);
  expect([c.h[1], c.h[2], c.h[3]], '높이 4값이 서로 맞다').toEqual([c.h[0] + 'px', c.h[0] + 'px', Number(c.h[0])]);
  expect(outsideOf(c), '놓은 직후 — 프레임 밖 말풍선 0').toEqual([]);
  expect(Math.max(...c.rows.map((x) => x.ot + x.oh)) <= c.ch, '놓은 직후 — 맨 아래 밑변이 프레임 안').toBe(true);
  expect(c.attrs['data-buzz-seed'], '같은 무늬번호').toBe(a.attrs['data-buzz-seed']);
  await undo(page);
  await expect.poll(async () => (await stateOf(page, fid))?.h, { message: '⌘Z 한 번 → 높이가 돌아온다' }).toEqual(a.h);
  expect(coordsOf(await stateOf(page, fid)), '⌘Z 한 번 → 자리도 같이 돌아온다(다시 놓기가 따로 한 칸이 아니다)').toEqual(coordsOf(a));
  expect(errs).toEqual([]);
});

/* ═══════════════ 1013t2 D1 · D2 — 버즈의 새 기본(현빈 2026-10-14) ═══════════════
   D2 「알약 기본색은 솔리드로」 = 알약 스타일의 프레임 배경 #5f564e(그라데이션은 Buzz 절 「배경」 묶음의 프리셋으로 남는다)  → BZ-23 · BZ-24 · BZ-25
   D1 「기본은 투명 배경 / 패딩제외 옵션」 = 나머지 5종은 투명 · 새 버즈는 「패딩 제외」가 켜진 채로                      → BZ-26 · BZ-27
   이미 저장된 버즈는 안 건드린다(새로 넣을 때 · 스타일을 고를 때의 기본만 바뀐다)                                      → BZ-28 */
const PILL_SOLID = 'rgb(95, 86, 78)';                               /* #5f564e */
const PILL_GRADIENT = 'linear-gradient(165deg, rgb(184, 173, 160), rgb(167, 156, 145) 55%, rgb(159, 148, 138))';
const CLEAR = 'rgba(0, 0, 0, 0)';
/** 프레임 배경 — 값 칸(data-bg)과 «실제로 그려진» 색 · 그림(computed). */
const bgOf = (page, fid) => page.evaluate((fid) => {
  const f = document.getElementById(fid); const cs = getComputedStyle(f);
  return { data: f.dataset.bg, color: cs.backgroundColor, image: cs.backgroundImage };
}, fid);
/** Buzz 절 「배경」 묶음 — 단추의 값과 켜진 것. 묶음이 없으면 null. */
const bgGroupOf = (page) => page.evaluate(() => {
  const g = document.getElementById('bzf-bg');
  return g ? { vals: [...g.querySelectorAll('.prop-align-btn')].map((b) => b.dataset.val), active: [...g.querySelectorAll('.prop-align-btn.active')].map((b) => b.dataset.val) } : null;
});
/* 색 산수(WCAG 2.x 상대 휘도 · 대비) — 검사 «안»에서 계산한다. 색 문자열을 견주는 것으로 갈음하지 않는다. */
const rgbaOf = (s) => {
  const m = /^rgba?\(([^)]+)\)$/.exec(String(s).trim());
  if (!m) return null;
  const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
  return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
};
const mix = (top, bot, a) => ({ r: top.r * a + bot.r * (1 - a), g: top.g * a + bot.g * (1 - a), b: top.b * a + bot.b * (1 - a), a: 1 });
const lumOf = (c) => {
  const f = (v) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
};
const contrastOf = (a, b) => { const la = lumOf(a), lb = lumOf(b); return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05); };
const hexOf = (c) => '#' + [c.r, c.g, c.b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
/** 프레임 폭과 「패딩 제외」 — 섹션 안쪽 상자(.section-inner) 기준. gap = 프레임 변과 안쪽 상자 변 사이(레이아웃 px). */
const bleedOf = (page, fid) => page.evaluate((fid) => {
  const f = document.getElementById(fid); const inner = f.closest('.section-inner'); const ics = getComputedStyle(inner);
  const sc = new DOMMatrix(getComputedStyle(document.getElementById('canvas-scaler')).transform).a;
  const fr = f.getBoundingClientRect(), ir = inner.getBoundingClientRect();
  const r1 = (v) => (Math.round(v * 10) / 10) || 0;      /* -0 을 0 으로 */
  const t = document.getElementById('ss-fullbleed-toggle');
  return { flag: f.dataset.fullBleed ?? null, cw: f.clientWidth, innerW: inner.clientWidth, padL: parseFloat(ics.paddingLeft), padR: parseFloat(ics.paddingRight),
    gapL: r1((fr.left - ir.left) / sc), gapR: r1((ir.right - fr.right) / sc),
    toggle: t ? [t.checked, t.disabled] : null };
}, fid);
/** 저장 → 새로 띄워 다시 열기. 다시 띄운 쪽의 페이지 오류 목록을 돌려준다. */
async function reopen(page, fid) {
  const snap = await page.evaluate(() => window.serializeProject());
  const errs2 = await bootApp(page);
  await page.evaluate((d) => window.applyProjectData(d), JSON.parse(snap));
  await expect.poll(() => page.evaluate((fid) => { const f = document.getElementById(fid); return !!f && f.querySelectorAll('.modal-block').length > 0 && [...f.querySelectorAll('.modal-block')].every((m) => m._blockBound); }, fid),
    { message: '전제: 다시 연 문서에 그 프레임이 있고 모달이 다시 묶였다' }).toBe(true);
  return errs2;
}

test('BZ-23 1013t2D2⒜ 알약 스타일의 프레임 기본 배경 = 솔리드 #5f564e(그림 없음) · 패널 배경색 칸도 그 색 · 낱개 알약은 그대로', async ({ page }) => {
  const { errs } = await setup(page);
  const fid = await insertBuzz(page);
  expect((await stateOf(page, fid)).attrs['data-buzz-style'], '전제: 삽입 기본은 카드다(알약으로 바로 들어오지 않는다)').toBe('card');
  await pickStyle(page, fid, 'pill');
  expect(await bgOf(page, fid), '알약: 프레임 배경이 솔리드 #5f564e 이고 배경 그림(그라데이션)이 없다').toEqual({ data: '#5f564e', color: PILL_SOLID, image: 'none' });
  await expect(page.locator('#ss-bg-hex'), '패널 Background 배경색 글자 칸이 실제 색이다(그라데이션 자리 채움 FFFFFF 가 아니다)').toHaveValue(/^#?5f564e$/i);
  /* 낱개는 그대로 — 흰 26% · 테두리 흰 55% 2px · 뒤 흐림 10px · 깊이 3단 */
  const pills = await page.evaluate((fid) => [...document.getElementById(fid).querySelectorAll(':scope > .row > .modal-block')].map((m) => {
    const cs = getComputedStyle(m);
    return [cs.backgroundColor, cs.borderTopWidth + ' ' + cs.borderTopStyle + ' ' + cs.borderTopColor, cs.backdropFilter || cs.webkitBackdropFilter];
  }), fid);
  expect(pills.length, '전제: 알약 6').toBe(6);
  expect([...new Set(pills.map((p) => p.join(' | ')))], '낱개 6개가 전부 같은 값: 흰 26% · 2px 흰 55% · blur(10px)').toEqual(['rgba(255, 255, 255, 0.26) | 2px solid rgba(255, 255, 255, 0.55) | blur(10px)']);
  const st = await stateOf(page, fid);
  expect([st.attrs['data-buzz-depth'], st.rows.map((r) => r.far).sort().join(',')], '깊이 「강하게」 · 3단(앞 2 · 가운데 2 · 뒤 2)').toEqual(['strong', ',,1,1,2,2']);
  expect(errs).toEqual([]);
});

test('BZ-24 1013t2D2⒝ 알약 기본 배경 위에서 «알약을 합성한 뒤»의 흰 글자 대비 ≥ 3.0(큰 글자 기준) — 검사가 계산한다', async ({ page }) => {
  const { errs } = await setup(page);
  const fid = await insertBuzz(page);
  await pickStyle(page, fid, 'pill');
  /* 프레임 → row → 모달 → … → 글자를 직접 품은 요소까지, 층마다 computed 배경을 그대로 읽어 온다 */
  const L = await page.evaluate((fid) => {
    const f = document.getElementById(fid); const fcs = getComputedStyle(f);
    const rows = [...f.querySelectorAll(':scope > .row')].filter((r) => r.querySelector(':scope > .modal-block'));
    return { frame: { color: fcs.backgroundColor, image: fcs.backgroundImage, opacity: fcs.opacity },
      rows: rows.map((r) => {
        const m = r.querySelector(':scope > .modal-block');
        const tw = document.createTreeWalker(m, NodeFilter.SHOW_TEXT);
        let tn = null;
        while (tw.nextNode()) { if (tw.currentNode.nodeValue.trim()) { tn = tw.currentNode; break; } }
        const te = tn ? tn.parentElement : null;
        const chain = [];
        for (let e = te; e && e !== f; e = e.parentElement) { const cs = getComputedStyle(e); chain.unshift({ cls: String(e.className).split(' ')[0], color: cs.backgroundColor, image: cs.backgroundImage, opacity: cs.opacity }); }
        const tcs = te ? getComputedStyle(te) : null;
        return { far: r.dataset.buzzFar || '0', z: Number(r.style.zIndex), isRow: chain[0]?.cls === 'row', chain, text: tcs?.color || null, fontPx: tcs ? parseFloat(tcs.fontSize) : 0, weight: tcs ? Number(tcs.fontWeight) : 0, filter: getComputedStyle(r).filter };
      }) };
  }, fid);
  const frameBg = rgbaOf(L.frame.color);
  expect([L.frame.image, frameBg && frameBg.a, L.frame.opacity], `전제: 프레임 배경이 불투명한 단색이다(${L.frame.color}) — 그라데이션이면 이 산수가 성립하지 않는다`).toEqual(['none', 1, '1']);
  expect(L.rows.length, '전제: 알약 6').toBe(6);
  const out = L.rows.map((row) => {
    expect(row.text && row.isRow, '전제: 글자를 품은 요소를 찾았고 사슬의 맨 바깥이 row 다').toBeTruthy();
    const text = rgbaOf(row.text);
    expect(text.a, `전제: 글자색이 불투명하다(${row.text})`).toBe(1);
    expect(row.chain.every((c) => c.image === 'none'), '전제: 글자 뒤 어느 층에도 배경 그림이 없다(색만 합성하면 된다)').toBe(true);
    expect(row.chain.slice(1).every((c) => c.opacity === '1'), '전제: 불투명도는 row 에만 걸린다(깊이)').toBe(true);
    const fills = row.chain.map((c) => rgbaOf(c.color)).filter((c) => c.a > 0);
    expect(fills.length >= 1 && fills.some((c) => c.a < 1), `전제: 글자 뒤에 «반투명» 채움 층이 있다(${row.chain.map((c) => c.color).join(' / ')})`).toBe(true);
    /* ① 알약 합성: 프레임 배경 위에 채움 층을 아래부터 알파로 얹는다 */
    let under = frameBg;
    fills.forEach((c) => { under = mix(c, under, c.a); });
    /* ② 깊이: row 의 opacity 는 알약 통째(채움 + 글자)에 걸린다 → 둘 다 프레임 배경 쪽으로 같은 비율만큼 섞인다 */
    const op = Number(row.chain[0].opacity);
    const bg = mix(under, frameBg, op), fg = mix(text, frameBg, op);
    return { far: row.far, z: row.z, op, filter: row.filter, fontPx: row.fontPx, weight: row.weight, pill: hexOf(bg), fg: hexOf(fg), ratio: Math.round(contrastOf(fg, bg) * 1000) / 1000 };
  });
  const tier = (far) => out.filter((o) => o.far === far);
  const front = tier('0'), mid = tier('1'), back = tier('2');
  expect([front.length, mid.length, back.length], '전제: 깊이 3단이 2 · 2 · 2 로 갈렸다').toEqual([2, 2, 2]);
  expect(front.every((o) => o.op === 1 && o.filter === 'none'), '전제: 맨 앞 묶음에는 불투명도 · 흐림이 안 걸린다').toBe(true);
  expect(Math.min(...front.map((o) => o.z)) > Math.max(...mid.map((o) => o.z), ...back.map((o) => o.z)), '전제: 「맨 앞」 = 겹침 순서가 가장 높은 묶음').toBe(true);
  expect(out.every((o) => o.fontPx >= 24), `전제: 큰 글자다(≥ 24px · 지금 ${out[0].fontPx}px ${out[0].weight}) — 그래서 기준이 3.0 이다`).toBe(true);
  const report = `frame ${hexOf(frameBg)} | 앞 ${front.map((o) => o.ratio).join(' · ')} (알약 ${front[0].pill} · 글자 ${front[0].fg}) | 가운데(opacity ${mid[0].op}) ${mid.map((o) => o.ratio).join(' · ')} (알약 ${mid[0].pill} · 글자 ${mid[0].fg}) | 뒤(opacity ${back[0].op} · ${back[0].filter}) ${back.map((o) => o.ratio).join(' · ')} (알약 ${back[0].pill} · 글자 ${back[0].fg})`;
  console.log('[BZ-24 대비] ' + report);
  test.info().annotations.push({ type: 'BZ-24 대비', description: report });
  /* ★단언은 맨 앞 묶음 기준이다. 가운데 · 뒤 묶음(깊이로 일부러 흐리게 한 것)의 수는 위 줄에 적기만 한다. */
  front.forEach((o) => expect(o.ratio, `맨 앞 알약: 합성 뒤 흰 글자 대비 ${o.ratio} ≥ 3.0 (${report})`).toBeGreaterThanOrEqual(3.0));
  expect(errs).toEqual([]);
});

test('BZ-25 1013t2D2⒞ Buzz 절 「배경」 묶음 — 그라데이션 프리셋을 고르면 그 그라데이션이 그려지고(⌘Z 한 칸) 솔리드로 돌아온다 · 저장 · ⌘D · HTML 에서 유지', async ({ page }) => {
  test.setTimeout(90000);
  const { errs } = await setup(page);
  const fid = await insertBuzz(page);
  expect(await bgGroupOf(page), '카드 스타일에는 「배경」 묶음이 없다').toBeNull();
  await pickStyle(page, fid, 'pill');
  expect(await bgGroupOf(page), '알약: 「배경」 묶음에 솔리드 · 그라데이션 두 단추 · 솔리드가 켜져 있다').toEqual({ vals: ['solid', 'gradient'], active: ['solid'] });
  expect(await bgOf(page, fid), '전제: 지금은 솔리드').toEqual({ data: '#5f564e', color: PILL_SOLID, image: 'none' });
  const GRAD = { data: 'linear-gradient(165deg,#b8ada0,#a79c91 55%,#9f948a)', color: CLEAR, image: PILL_GRADIENT };
  /* 그라데이션 단추 = 히스토리 한 걸음. expectOneUndoStep 이 누르고 → ⌘Z 한 번 → 누르기 전과 같은지 본다 */
  await expectOneUndoStep(page, async () => {
    await page.locator('#bzf-bg [data-val="gradient"]').click();
    await expect.poll(() => bgOf(page, fid), { message: '그라데이션 단추 → 프레임에 그 그라데이션이 그려진다' }).toEqual(GRAD);
  }, '버즈 배경 프리셋(그라데이션)');
  expect(await bgOf(page, fid), '⌘Z 한 번 → 솔리드로 돌아왔다').toEqual({ data: '#5f564e', color: PILL_SOLID, image: 'none' });
  /* 다시 그라데이션으로 — 패널이 그 값을 보인다 */
  await pickFrame(page, fid);
  await page.locator('#bzf-bg [data-val="gradient"]').click();
  await expect.poll(() => bgOf(page, fid), { message: '그라데이션이 그려진다' }).toEqual(GRAD);
  expect(await bgGroupOf(page), '패널이 다시 그려져도 그라데이션 단추가 켜져 있다').toEqual({ vals: ['solid', 'gradient'], active: ['gradient'] });
  expect((await stateOf(page, fid)).attrs['data-buzz-style'], '스타일은 알약 그대로').toBe('pill');
  /* 프레임 ⌘D */
  expect(await isSelected(page, fid), '전제: 프레임이 골라져 있다').toBe(true);
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Meta+d');
  await expect.poll(() => page.evaluate(() => document.querySelectorAll('#canvas .frame-block[data-buzz="1"]').length), { message: '프레임 ⌘D → 버즈 프레임 둘' }).toBe(2);
  const copyId = await page.evaluate((fid) => [...document.querySelectorAll('#canvas .frame-block[data-buzz="1"]')].map((f) => f.id).find((id) => id !== fid), fid);
  expect(await bgOf(page, copyId), '사본도 그라데이션').toEqual(GRAD);
  /* HTML 내보내기 */
  const html = await page.evaluate(async () => {
    const origCreate = URL.createObjectURL; const origClick = HTMLAnchorElement.prototype.click;
    let captured = null;
    URL.createObjectURL = (b) => { captured = b; return 'blob:buzz-spec'; };
    HTMLAnchorElement.prototype.click = function () {};
    try { await window.exportHTMLFile(); } finally { URL.createObjectURL = origCreate; HTMLAnchorElement.prototype.click = origClick; }
    return captured ? await captured.text() : null;
  });
  expect(typeof html, '전제: 내보낸 HTML 을 가로챘다').toBe('string');
  const tags = html.match(/<div[^>]*data-buzz="1"[^>]*>/g) || [];
  expect(tags.length, '전제: 내보낸 HTML 에 버즈 프레임 둘').toBe(2);
  expect(tags.map((t) => /style="[^"]*linear-gradient\(165deg/.test(t)), 'HTML: 두 프레임의 인라인 배경에 그라데이션이 실렸다').toEqual([true, true]);
  /* 저장 → 다시 열기 */
  const errs2 = await reopen(page, fid);
  expect(await bgOf(page, fid), '다시 연 뒤에도 그라데이션').toEqual(GRAD);
  await pickFrame(page, fid);
  expect(await bgGroupOf(page), '다시 연 뒤 패널: 그라데이션 단추가 켜져 있다').toEqual({ vals: ['solid', 'gradient'], active: ['gradient'] });
  /* 솔리드 단추 → 돌아온다 */
  await page.locator('#bzf-bg [data-val="solid"]').click();
  await expect.poll(() => bgOf(page, fid), { message: '솔리드 단추 → #5f564e 로 돌아오고 그림이 없다' }).toEqual({ data: '#5f564e', color: PILL_SOLID, image: 'none' });
  expect(await bgGroupOf(page)).toEqual({ vals: ['solid', 'gradient'], active: ['solid'] });
  await expect(page.locator('#ss-bg-hex'), 'Background 배경색 칸도 되읽혔다').toHaveValue(/^#?5f564e$/i);
  expect(await bgOf(page, copyId), '사본은 그대로 그라데이션(원본만 바뀐다)').toEqual(GRAD);
  expect([errs, errs2]).toEqual([[], []]);
});

test('BZ-26 1013t2D1⒜ 새 버즈(기본 스타일)의 프레임 배경 = 투명 · 알약만 #5f564e 이고 나머지 5종은 투명 · 저장 왕복에서 유지', async ({ page }) => {
  const { errs, secId } = await setup(page);
  const fid = await insertBuzz(page);
  expect((await stateOf(page, fid)).attrs['data-buzz-style'], '전제: 삽입 기본 스타일은 카드').toBe('card');
  expect(await bgOf(page, fid), '새 버즈: 프레임 배경이 투명(색 · 그림 없음)').toEqual({ data: 'transparent', color: CLEAR, image: 'none' });
  const panel = () => page.evaluate(() => {
    const hex = document.getElementById('ss-bg-hex');
    return { label: hex?.closest('.prop-color-row')?.querySelector('.prop-label')?.textContent.trim() ?? null, alpha: document.getElementById('ss-bg-alpha')?.value ?? null };
  });
  expect(await panel(), '패널 Background: 「배경색 (투명)」 · 불투명도 0').toEqual({ label: '배경색 (투명)', alpha: '0' });
  /* 투명이면 뒤의 섹션 색이 그대로 보인다 — 프레임의 빈 자리에서 «보이는 색» = 섹션 배경 */
  const secBg = await page.evaluate((secId) => getComputedStyle(document.getElementById(secId)).backgroundColor, secId);
  expect(rgbaOf(secBg)?.a, `전제: 섹션에 불투명한 배경이 있다(${secBg})`).toBe(1);
  const seen = {};
  for (const k of ['bubble', 'tail', 'tape', 'strip', 'pill', 'card']) {
    await pickStyle(page, fid, k);
    const b = await bgOf(page, fid);
    seen[k] = [b.data, b.color, b.image];
  }
  const T = ['transparent', CLEAR, 'none'];
  expect(seen, '스타일 6종의 프레임 기본 배경: 알약만 #5f564e · 나머지 5종은 투명').toEqual({ bubble: T, tail: T, tape: T, strip: T, pill: ['#5f564e', PILL_SOLID, 'none'], card: T });
  expect(await panel(), '카드로 돌아온 뒤 패널도 투명').toEqual({ label: '배경색 (투명)', alpha: '0' });
  const errs2 = await reopen(page, fid);
  expect(await bgOf(page, fid), '다시 연 뒤에도 투명').toEqual({ data: 'transparent', color: CLEAR, image: 'none' });
  expect([errs, errs2]).toEqual([[], []]);
});

test('BZ-27 1013t2D1⒝ 새 버즈는 「패딩 제외」가 켜져 있다 — 패널 표시 + 실제 폭(섹션 좌우 패딩을 넘어 가장자리까지) · 끄면 패딩 안으로 · ⌘Z · 저장 · ⌘D', async ({ page }) => {
  const { errs } = await setup(page);
  const fid = await insertBuzz(page);
  const a = await bleedOf(page, fid);
  expect(a.padL > 0 && a.padL === a.padR, `전제: 섹션에 좌우 패딩이 있다(${a.padL} · ${a.padR}) — 0 이면 「패딩 제외」가 켜져도 폭이 안 달라진다`).toBe(true);
  expect(a.flag, '새 버즈: 「패딩 제외」 표식(data-full-bleed)이 켜져 있다').toBe('true');
  expect(a.toggle, '패널 Size 절 「패딩 제외」 스위치가 켜져 있고 누를 수 있다').toEqual([true, false]);
  expect([a.gapL, a.gapR, a.cw], `실제 폭: 프레임이 섹션 안쪽 상자의 양 끝까지 닿는다(패딩 ${a.padL} 을 넘는다)`).toEqual([0, 0, a.innerW]);
  const st = await stateOf(page, fid);
  expect(st.cw, '말풍선을 놓는 폭 = 그 넓어진 폭').toBe(a.innerW);
  expect(outsideOf(st), '모든 낱개가 프레임 안').toEqual([]);
  /* 프레임 ⌘D — 사본도 켜진 채 같은 폭 */
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Meta+d');
  await expect.poll(() => page.evaluate(() => document.querySelectorAll('#canvas .frame-block[data-buzz="1"]').length), { message: '프레임 ⌘D → 둘' }).toBe(2);
  const copyId = await page.evaluate((fid) => [...document.querySelectorAll('#canvas .frame-block[data-buzz="1"]')].map((f) => f.id).find((id) => id !== fid), fid);
  const c = await bleedOf(page, copyId);
  expect([c.flag, c.gapL, c.gapR, c.cw], '사본: 켜짐 · 같은 폭').toEqual(['true', 0, 0, a.innerW]);
  /* 저장 → 다시 열기 */
  const errs2 = await reopen(page, fid);
  await pickFrame(page, fid);
  const b = await bleedOf(page, fid);
  expect([b.flag, b.gapL, b.gapR, b.cw, b.toggle], '다시 연 뒤에도 켜짐 · 같은 폭 · 스위치 켜짐').toEqual(['true', 0, 0, a.innerW, [true, false]]);
  /* 끄기(진짜 클릭) → 패딩 안으로 들어온다 · 말풍선은 좁아진 프레임 안에.
     끄기 전에 말풍선 너비를 800 으로 — 좁아질 폭(안쪽 폭 − 패딩 둘)보다 넓어, 다시 놓지 않으면 반드시 밖으로 나간다 */
  const wnum = page.locator('#bzf-width-number');
  await wnum.fill('800');
  await wnum.press('Tab');
  const wide = await stateOf(page, fid);
  expect(wide.rows.every((r) => r.ow > a.innerW - a.padL - a.padR) && outsideOf(wide).length === 0, `전제: 말풍선 폭(${wide.rows[0].ow})이 끈 뒤의 프레임 폭(${a.innerW - a.padL - a.padR})보다 넓고, 지금은 다 안에 있다`).toBe(true);
  const sw = page.locator('label.prop-toggle:has(#ss-fullbleed-toggle)');
  await sw.scrollIntoViewIfNeeded();
  await sw.click();
  await expect.poll(async () => (await bleedOf(page, fid)).flag, { message: '스위치를 끄면 표식이 없어진다' }).toBeNull();
  const off = await bleedOf(page, fid);
  expect([off.gapL, off.gapR, off.cw, off.toggle], `끈 뒤: 좌우로 패딩 ${a.padL} 만큼 들어온다`).toEqual([a.padL, a.padR, a.innerW - a.padL - a.padR, [false, false]]);
  expect(outsideOf(await stateOf(page, fid)), '끈 직후 — 좁아진 프레임 밖으로 나간 말풍선 0').toEqual([]);
  await undo(page);
  await expect.poll(async () => { const u = await bleedOf(page, fid); return [u.flag, u.gapL, u.gapR, u.cw]; }, { message: '⌘Z → 다시 켜지고 폭이 돌아온다' }).toEqual(['true', 0, 0, a.innerW]);
  expect([errs, errs2]).toEqual([[], []]);
});

test('BZ-28 1013t2D1·D2 이미 저장된 버즈는 그대로 — 옛 기본(카드 #f3f1ee · 패딩 제외 꺼짐)으로 저장된 프레임은 다시 열어도 · 다시 그려도 안 바뀐다', async ({ page }) => {
  const { errs } = await setup(page);
  const fid = await insertBuzz(page);
  /* 옛 판이 만들던 꼴로 되돌려 저장본을 만든다(옛 addBuzzBlock: 배경 #f3f1ee · 폭 860px/max-width 100% · 표식 없음) */
  await page.evaluate((fid) => {
    const f = document.getElementById(fid);
    f.dataset.bg = '#f3f1ee'; f.style.background = '#f3f1ee';
    delete f.dataset.fullBleed; delete f.dataset.fbMaxW;
    f.style.marginLeft = ''; f.style.marginRight = ''; f.style.margin = '0 auto'; f.style.width = '860px'; f.style.maxWidth = '100%';
  }, fid);
  const old = await bleedOf(page, fid);
  expect([old.flag, old.gapL, old.cw], '전제: 옛 꼴 — 표식 없음 · 패딩 안쪽 폭').toEqual([null, old.padL, old.innerW - old.padL - old.padR]);
  expect(old.padL > 0, '전제: 섹션에 좌우 패딩이 있다').toBe(true);
  const errs2 = await reopen(page, fid);
  const OLD_BG = { data: '#f3f1ee', color: 'rgb(243, 241, 238)', image: 'none' };
  expect(await bgOf(page, fid), '다시 연 뒤: 배경이 저장된 그대로(#f3f1ee)').toEqual(OLD_BG);
  await pickFrame(page, fid);
  const b = await bleedOf(page, fid);
  expect([b.flag, b.gapL, b.cw, b.toggle], '다시 연 뒤: 패딩 제외 꺼진 그대로 · 폭 그대로 · 스위치 꺼짐').toEqual([null, old.padL, old.cw, [false, false]]);
  /* 다시 그리기 · 개수 + 는 배경과 폭을 안 건드린다 */
  await page.locator('#bzf-redraw').click();
  await page.locator('#bzf-n-plus').click();
  await expect(page.locator('#bzf-n-count'), '전제: 개수 + 가 먹었다').toHaveText('7');
  const c = await bleedOf(page, fid);
  expect([await bgOf(page, fid), c.flag, c.cw], '다시 그리기 · 개수 + 뒤에도 배경 · 패딩 제외 · 폭 그대로').toEqual([OLD_BG, null, old.cw]);
  expect([errs, errs2]).toEqual([[], []]);
});

/* ── 「패딩 제외」 스위치의 다시 놓기 한 줄(js/props/prop-frame.js · refitBuzzOnResize)이 «닿지 말아야 할» 두 자리 ── */
/** 프레임 직속 row 의 자리 — 인라인 값과 레이아웃 px 둘 다. */
const rowBoxesOf = (page, fid) => page.evaluate((fid) => [...document.getElementById(fid).querySelectorAll(':scope > .row')].map((r) =>
  [r.id, r.style.left, r.style.top, r.style.width, r.style.zIndex, r.offsetLeft, r.offsetTop, r.offsetWidth, r.querySelector(':scope > .modal-block')?.dataset.rotation || '']), fid);

test('BZ-29 1013t2D 게이트 — 버즈 «아닌» 보통 자유배치 프레임: 「패딩 제외」를 켜고 꺼도 자식 자리(left · top · width)는 그대로고 프레임 폭만 바뀐다', async ({ page }) => {
  const { errs } = await setup(page);
  /* 보통 자유배치 프레임 + 모달 둘. 둘째는 «패딩 제외를 켠 폭» 안에는 들고 «끈 폭» 밖으로는 걸친다 */
  const fid = await page.evaluate(() => {
    window.addFrameBlock();
    const f = document.querySelector('#canvas .frame-block[data-free-layout="true"]');
    [['보통 프레임 안의 모달 하나', 40, 40, 460], ['패딩 밖으로 걸친 모달', 560, 220, 280]].forEach(([t, x, y, w]) => {
      const { row, block } = window.makeModalBlock({ variant: 'plain', text: t });
      row.style.position = 'absolute'; row.style.left = x + 'px'; row.style.top = y + 'px'; row.style.width = w + 'px';
      row.setAttribute('draggable', 'false');
      f.appendChild(row); window.renderModalBlock(block); window.bindBlock(block);
    });
    window.bindFrameDropZone?.(f); window.buildLayerPanel?.(); window.deselectAll?.();
    return f.id;
  });
  expect(await page.evaluate((fid) => { const f = document.getElementById(fid); return [f.dataset.buzz || null, f.dataset.fullBleed || null, f.querySelectorAll(':scope > .row > .modal-block').length]; }, fid),
    '전제: 버즈 표식도 패딩 제외 표식도 없는 자유배치 프레임 + 모달 둘').toEqual([null, null, 2]);
  await pickFrame(page, fid, { buzz: false });
  await expect(page.locator('#bzf-section'), '전제: 보통 프레임이다(Buzz 절 없음)').toHaveCount(0);
  const off0 = await bleedOf(page, fid);
  const kids0 = await rowBoxesOf(page, fid);
  expect(off0.padL > 0 && off0.padL === off0.padR, `전제: 섹션에 좌우 패딩이 있다(${off0.padL})`).toBe(true);
  expect([off0.flag, off0.cw, off0.toggle], '전제: 패딩 제외 꺼짐 · 프레임이 패딩 안쪽 폭 · 스위치를 누를 수 있다').toEqual([null, off0.innerW - off0.padL - off0.padR, [false, false]]);
  const right = kids0[1][5] + kids0[1][7];
  expect(right > off0.cw && right <= off0.innerW, `전제: 둘째 모달의 오른쪽 끝(${right})이 끈 폭(${off0.cw}) 밖으로 걸치고 켠 폭(${off0.innerW}) 안에는 든다`).toBe(true);
  const sw = page.locator('label.prop-toggle:has(#ss-fullbleed-toggle)');
  await sw.scrollIntoViewIfNeeded();
  /* 켬 */
  await sw.click();
  await expect.poll(async () => (await bleedOf(page, fid)).flag, { message: '스위치를 켜면 표식이 붙는다' }).toBe('true');
  const on = await bleedOf(page, fid);
  expect([on.gapL, on.gapR, on.cw, on.toggle], '켠 뒤: 프레임 폭만 섹션 안쪽 상자 끝까지 넓어진다').toEqual([0, 0, off0.innerW, [true, false]]);
  expect(await rowBoxesOf(page, fid), '켠 뒤: 자식 자리(인라인 left · top · width · z-index · 실측 · 회전)가 그대로다').toEqual(kids0);
  /* 끔 — 둘째 모달이 다시 밖으로 걸치지만, 보통 프레임의 자식은 «다시 놓지 않는다» */
  await sw.click();
  await expect.poll(async () => (await bleedOf(page, fid)).flag, { message: '스위치를 끄면 표식이 없어진다' }).toBeNull();
  const off1 = await bleedOf(page, fid);
  expect([off1.gapL, off1.gapR, off1.cw, off1.toggle], '끈 뒤: 프레임 폭만 패딩 안쪽으로 돌아온다').toEqual([off0.padL, off0.padR, off0.cw, [false, false]]);
  const kids1 = await rowBoxesOf(page, fid);
  expect(kids1, '끈 뒤: 자식 자리가 그대로다 — 밖으로 걸친 모달도 안 옮긴다(다시 놓기는 버즈만)').toEqual(kids0);
  expect(kids1[1][5] + kids1[1][7] > off1.cw, '끈 뒤에도 둘째 모달은 걸친 그대로다(이 칸이 «걸친 꼴»을 실제로 지났다)').toBe(true);
  expect(errs).toEqual([]);
});

test('BZ-30 1013t2D 게이트 — 「패딩 제외」가 켜진 채 말풍선이 프레임 밖에 놓인 저장본은 열기만 해서는 · 프레임을 골라 패널이 그려져도 자리가 안 바뀐다', async ({ page }) => {
  const { errs } = await setup(page);
  const fid = await insertBuzz(page);
  expect((await bleedOf(page, fid)).flag, '전제: 새 버즈는 패딩 제외가 켜져 있다').toBe('true');
  /* 저장본의 꼴을 만든다 — 마지막 말풍선을 프레임 오른쪽 변 밖으로 걸치게(손으로 끌어다 놓은 것과 같은 인라인 값) */
  const moved = await page.evaluate(async (fid) => {
    const f = document.getElementById(fid);
    const rows = [...f.querySelectorAll(':scope > .row')].filter((r) => r.querySelector(':scope > .modal-block'));
    const last = rows[rows.length - 1];
    last.style.left = (f.clientWidth - 60) + 'px';
    const { buzzOverflowing } = await import('/js/blocks/buzz-frame.js');
    return { id: last.id, left: last.style.left, right: last.offsetLeft + last.offsetWidth, cw: f.clientWidth, overflowing: buzzOverflowing(f) };
  }, fid);
  expect(moved.right > moved.cw && moved.overflowing, `전제: 그 말풍선의 오른쪽 끝(${moved.right})이 프레임(${moved.cw}) 밖이고, 다시 놓기의 판정(buzzOverflowing)도 「밖에 있다」고 본다`).toBe(true);
  const a = await rowBoxesOf(page, fid);
  const seed = (await stateOf(page, fid)).attrs['data-buzz-seed'];
  const errs2 = await reopen(page, fid);
  const o = await bleedOf(page, fid);
  expect([o.flag, o.gapL, o.gapR, o.cw], '다시 연 뒤: 패딩 제외 켜진 그대로 · 같은 폭').toEqual(['true', 0, 0, moved.cw]);
  expect(await rowBoxesOf(page, fid), '열기만 했다 — 밖에 놓인 말풍선을 포함해 모든 자리가 저장된 그대로다').toEqual(a);
  /* 프레임을 고른다 = 패널(Buzz 절 · Size 절)이 그려진다. 그리기는 재기만 하고 옮기지 않는다 */
  await pickFrame(page, fid);
  await expect(page.locator('#ss-fullbleed-toggle'), '전제: 패널이 그려졌고 스위치가 켜져 있다').toBeChecked();
  const b = await rowBoxesOf(page, fid);
  expect(b, '프레임을 골라 패널이 그려진 뒤에도 자리가 그대로다').toEqual(a);
  expect([b.find((r) => r[0] === moved.id)[1], (await stateOf(page, fid)).attrs['data-buzz-seed']], '밖에 놓인 말풍선의 left 와 무늬번호가 그대로다').toEqual([moved.left, seed]);
  expect([errs, errs2]).toEqual([[], []]);
});
