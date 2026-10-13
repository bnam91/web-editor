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
  if (neighbor) expect({ viewBox: lay.viewBox, sw: lay.sw, fill: lay.fill }, '이웃(모달 줄) 아이콘과 같은 viewBox · 선 굵기 · fill').toEqual(neighbor);
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
  await page.evaluate(() => window.applyZoom(100));
  await page.waitForFunction(() => window.currentZoom === 100);
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
    const scale = (window.currentZoom || 0) / 100;
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
    await page.evaluate((z) => window.applyZoom(z), z);
    await page.waitForFunction((z) => window.currentZoom === z, z);
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
