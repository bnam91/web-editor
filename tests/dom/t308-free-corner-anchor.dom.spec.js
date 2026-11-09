/* t308-free-corner-anchor.dom.spec.js — t3-08 (0.9.11_t3) · 자유모드 객체의 모서리 핸들 «기준점»
 *
 * 현빈 원문(요지): 프레임 안 에셋/도형을 자유모드에서 우상단 B 핸들로 끌면 A 꼭지점이 고정되고 C·D 가 움직인다.
 *   원하는 것 = B 를 끌면 «맞은편» C 가 고정, A·D 는 X·Y 이동값에 따라 움직인다. 쉐이프에서도 같게 · 네 모서리 × 프레임 안/밖.
 * 이름 매핑: A=nw · B=ne · C=sw · D=se. 규칙 = «잡은 꼭지점의 맞은편 꼭지점이 화면에서 안 움직인다».
 *
 * 표: 종류(에셋 · 사각형 · 프레임 · 그룹 · 텍스트프레임) × 자리 × 4꼭지 × 방향(바깥 · 안쪽). 진짜 마우스로 «보이는 핸들»을 끈다.
 *   자리: free(자유 프레임 안) · depth2(free 안 free) · freeZoomScroll(줌 40%+스크롤) · float(섹션 직속 떠 있음)
 *         · stack/section(흐름 배치 = 대조: 좌표가 없어 가운데로 양쪽이 자란다 → 크기 Δ 만 단언, «무변화» 칸).
 *   텍스트프레임: 자유 프레임 안 텍스트는 손잡이가 없다(showHandlesFor — 오버레이 텍스트만). 그래서
 *     ⑴ free = 텍스트프레임을 품은 «그룹»을 끈다(프레임 손잡이 groupSnap 이 텍스트 자식을 스케일하는 그 길)
 *     ⑵ float = 섹션에 띄운 텍스트의 tfo 손잡이(이번 수정 밖 · 원래 맞은편 고정 — 대조).
 *   그룹 칸은 자식이 그룹 상자 안 «같은 비율 자리»에 남는지도 잰다(자식 스케일은 그대로여야 한다).
 * 덧칸: 회전 30° 에셋(맞은편 꼭지 = 그 손잡이 화면 중심 ±2px) · ⌘Z 한 번에 크기+자리 복원 · Shift 비율 고정.
 * 장면 준비만 evaluate — 끌기는 진짜 마우스. ⛔waitForTimeout 0.
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const DIRS = ['nw', 'ne', 'sw', 'se'];
const OPP = { nw: 'se', ne: 'sw', sw: 'ne', se: 'nw' };
const NAME = { nw: 'A', ne: 'B', sw: 'C', se: 'D' };
const TABLE = {
  asset: ['free', 'depth2', 'freeZoomScroll', 'float', 'stack', 'section'],
  shape: ['free', 'depth2', 'freeZoomScroll', 'float', 'stack', 'section'],
  frame: ['free', 'depth2', 'float', 'section'],
  group: ['free', 'depth2', 'float'],
  textframe: ['free', 'float'],
};
const TOL = 1.5;

const raf = (p) => p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

async function scene(page, place, kind, opt = {}) {
  return page.evaluate(async ({ place, kind, opt }) => {
    const FR = '.frame-block:not([data-text-frame])';
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach((s) => s.remove());
    await window.addSection();
    const sec = c.querySelector('.section-block');
    const within = (par, fn, sel) => { window.deselectAll(); window.selectSection(sec); window._activeFrame = par; const b = new Set(sec.querySelectorAll(sel)); fn(); const e = [...sec.querySelectorAll(sel)].find((x) => !b.has(x)); window._activeFrame = null; return e; };
    const box = (el, w, h) => { el.style.width = w + 'px'; el.style.height = h + 'px'; if (el.classList.contains('frame-block')) { el.style.minHeight = h + 'px'; el.dataset.width = String(w); el.dataset.height = String(h); } };
    const at = (el, l, t) => { el.style.left = l + 'px'; el.style.top = t + 'px'; el.dataset.offsetX = String(l); el.dataset.offsetY = String(t); };
    let host = null;
    if (place === 'free' || place === 'freeZoomScroll') host = within(null, () => window.addFrameBlock({}), FR);
    if (place === 'stack') { host = within(null, () => window.addFrameBlock({ fullWidth: true }), FR); host.style.minHeight = '420px'; }
    if (place === 'depth2') {
      const outer = within(null, () => window.addFrameBlock({}), FR);
      host = within(outer, () => window.addFrameBlock({}), FR);
      window.updateFrameBlock?.(host.id, { width: 600, height: 420 });
      at(host, 120, 40);
    }
    const addAsset = () => within(host, () => window.addAssetBlock('standard'), '.asset-block');
    let obj, target;
    if (kind === 'asset') { obj = target = addAsset(); box(target, 200, 150); }
    else if (kind === 'shape') {
      obj = within(host, () => window.addShapeBlock('rectangle'), '.shape-block');
      target = obj.closest('.frame-block'); box(target, 200, 150);
    } else if (kind === 'frame') {
      obj = target = within(host, () => window.addFrameBlock({}), FR); box(target, 200, 150);
    } else if (kind === 'textframe' && place === 'float') {
      target = within(host, () => window.addTextBlock('h2'), '[data-text-frame="true"]');
      obj = target.querySelector('.text-block');
    } else {
      // 그룹(텍스트프레임 칸 = 텍스트 자식을 품은 그룹)
      const a = addAsset(); box(a, 100, 60);
      const b = kind === 'textframe' ? within(host, () => window.addTextBlock('h2'), '[data-text-frame="true"]') : addAsset();
      if (kind !== 'textframe') box(b, 80, 70);
      else { b.style.width = '120px'; b.dataset.width = '120'; }   // 기본 578px 이면 그룹이 호스트를 넘어 호스트가 따라 자란다(장면 잡음)
      const abs = getComputedStyle(a).position === 'absolute';
      if (abs) { at(a, 180, 120); at(b, 260, 190); }
      a.setAttribute('data-t308child', 'a'); b.setAttribute('data-t308child', 'b');
      // 텍스트프레임은 래퍼가 아니라 안의 .text-block 이 선택 단위(groupSelectedBlocks 규약)
      window.deselectAll(); a.classList.add('selected'); (b.querySelector(':scope > .text-block') || b).classList.add('selected');
      window.groupSelectedBlocks();
      obj = target = a.closest('[data-group="true"]');
    }
    if (place === 'float') window.OverlayFloat.enterFloat(target);
    // 섹션에서 묶은 그룹은 흐름 자식 폭(최대폭)을 물려받아 폭 clamp 에 닿는다 → 띄운 뒤 작은 상자로
    if (place === 'float' && kind === 'group') box(target, 300, 220);
    if (target.style.position === 'absolute' && kind !== 'group' && kind !== 'textframe') at(target, 180, 120);
    if (target.style.position === 'absolute' && place === 'float') at(target, 180, 120);
    if (opt.rot) window.applyRotationDeg(target, opt.rot);
    window.deselectAll(); window.clearHistory?.();
    window.applyZoom?.(place === 'freeZoomScroll' ? 40 : 100);
    target.setAttribute('data-t308', 'tgt');
    obj.setAttribute('data-t308obj', '1');
    return { pos: target.style.position || 'static', host: host ? (host.dataset.freeLayout ? 'free' : 'stack') : 'section',
      float: target.dataset.overlayBlock === 'true', group: target.dataset.group === 'true',
      tfChild: !!target.querySelector?.('[data-t308child][data-text-frame="true"]') };
  }, { place, kind, opt });
}

async function settle(page, place) {
  await page.waitForFunction(() => { const t = document.getElementById('canvas-scaler')?.style.transform; const same = t === window.__zt; window.__zt = t; return same; }, null, { polling: 150 });
  await page.evaluate((place) => {
    const t = document.querySelector('[data-t308="tgt"]');
    t.scrollIntoView({ block: 'center' });
    if (place === 'freeZoomScroll') { let s = t.parentElement; while (s && s.scrollHeight <= s.clientHeight + 1) s = s.parentElement; if (s) s.scrollTop += 60; }
  }, place);
  await raf(page);
}

async function select(page, kind) {
  await page.evaluate((kind) => {
    const o = document.querySelector('[data-t308obj]');
    if (kind === 'shape') { window.selectShapeBlock ? window.selectShapeBlock(o) : o.click(); return; }
    // 프레임 안 것: 첫 클릭은 부모 프레임을 고른다 — 고를 때까지 한 층씩
    for (let i = 0; i < 4 && !o.classList.contains('selected'); i++) o.click();
  }, kind);
  await raf(page);
}

const handleSel = (kind, dir, place) => kind === 'asset' ? `#ss-handles-overlay .asset-overlay-handle.${dir}`
  : kind === 'shape' ? `.shape-handle.${dir}`
  : (kind === 'textframe' && place === 'float') ? `#ss-handles-overlay .tfo-overlay-handle.${dir}`
  : `#ss-handles-overlay .ss-resize-handle.${dir}`;

const visibleHandle = (page, s) => page.evaluate((s) => { const h = [...document.querySelectorAll(s)].find((x) => x.getBoundingClientRect().width > 0); if (!h) return null; const b = h.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; }, s);

async function snap(page) {
  return page.evaluate(() => {
    const t = document.querySelector('[data-t308="tgt"]');
    const b = t.getBoundingClientRect();
    const kids = [...t.querySelectorAll('[data-t308child]')].map((k) => { const q = k.getBoundingClientRect(); return { k: k.dataset.t308child, fx: (q.left - b.left) / b.width, fy: (q.top - b.top) / b.height, fw: q.width / b.width }; });
    return { l: b.left, t: b.top, r: b.right, b: b.bottom, w: b.width, h: b.height, kids,
      model: { left: t.style.left, top: t.style.top, width: t.style.width, height: t.style.height, ox: t.dataset.offsetX, oy: t.dataset.offsetY } };
  });
}
const corner = (R, d) => [d.includes('w') ? R.l : R.r, d.includes('n') ? R.t : R.b];

async function drag(page, H, D, { shift = false } = {}) {
  await page.mouse.move(H[0], H[1]);
  if (shift) await page.keyboard.down('Shift');
  await page.mouse.down();
  await page.mouse.move(H[0] + D[0], H[1] + D[1], { steps: 6 });
  await page.mouse.up();
  if (shift) await page.keyboard.up('Shift');
  await raf(page);
}

async function prep(page, place, kind, dir, opt) {
  const pre = await scene(page, place, kind, opt);
  await settle(page, place);
  await select(page, kind);
  const hs = handleSel(kind, dir, place);
  await expect.poll(() => visibleHandle(page, hs), `[전제] ${kind}@${place} ${dir} 핸들 보임`).not.toBeNull();
  const H = await visibleHandle(page, hs);
  const hit = await page.evaluate(([x, y, s]) => { const e = document.elementFromPoint(x, y); return !!e && e.matches(s); }, [H[0], H[1], hs]);
  return { pre, H, hit };
}

async function dragRow(page, place, kind, dir, way) {
  const { pre, H, hit } = await prep(page, place, kind, dir);
  const R0 = await snap(page);
  const sx = dir.includes('e') ? 1 : -1, sy = dir.includes('s') ? 1 : -1;
  const D = way === 'out' ? [sx * 40, sy * 30] : [-sx * 20, -sy * 15];
  await drag(page, H, D);
  const R1 = await snap(page);
  const o0 = corner(R0, OPP[dir]), o1 = corner(R1, OPP[dir]);
  const fixed = DIRS.filter((d) => { const a = corner(R0, d), b = corner(R1, d); return Math.abs(a[0] - b[0]) <= TOL && Math.abs(a[1] - b[1]) <= TOL; });
  const kidDrift = R0.kids.map((k0, i) => { const k1 = R1.kids[i]; return +Math.max(Math.abs(k1.fx - k0.fx), Math.abs(k1.fy - k0.fy), Math.abs(k1.fw - k0.fw)).toFixed(3); });
  const row = { place, kind, dir, name: NAME[dir], way, ...pre, hit, D,
    dW: +(R1.w - R0.w).toFixed(1), dH: +(R1.h - R0.h).toFixed(1), oppMove: [+(o1[0] - o0[0]).toFixed(1), +(o1[1] - o0[1]).toFixed(1)],
    fixed: fixed.map((d) => NAME[d] + "/" + d), kidDrift, m0: R0.model, m1: R1.model };
  console.log('T308ROW ' + JSON.stringify(row));
  return row;
}

for (const [kind, places] of Object.entries(TABLE)) for (const place of places) {
  test(`T308 ${kind} @ ${place} — 4꼭지 × 바깥/안쪽: 맞은편 꼭지점 고정 · 크기 Δ = 마우스 Δ`, async ({ page }) => {
    test.setTimeout(150000);
    await page.setViewportSize({ width: 1600, height: 1200 });
    const errs = await bootApp(page);
    const rows = [];
    for (const dir of DIRS) for (const way of ['out', 'in']) rows.push(await dragRow(page, place, kind, dir, way));
    const flow = place === 'stack' || place === 'section';
    for (const r of rows) {
      const tag = `${kind}@${place} ${r.name}(${r.dir}) ${r.way} pos=${r.pos}`;
      expect.soft(r.hit, `${tag} 전제: 핸들 자리에서 핸들이 잡힌다`).toBe(true);
      expect.soft(r.pos, `${tag} 전제: 배치`).toBe(flow ? 'static' : 'absolute');
      if (place === 'float') expect.soft(r.float, `${tag} 전제: 떠 있음`).toBe(true);
      if (kind === 'group' || (kind === 'textframe' && place !== 'float')) expect.soft([r.group, r.tfChild], `${tag} 전제: 그룹(텍스트 자식)`).toEqual([true, kind === 'textframe']);
      const sx = r.dir.includes('e') ? 1 : -1, sy = r.dir.includes('s') ? 1 : -1;
      // 텍스트 tfo(대조 · 이번 수정 밖): 크기는 글자 폭 맞춤·폰트 비례가 정한다 — 크기 단언 없이 맞은편 고정만
      const wantW = sx * r.D[0], wantH = sy * r.D[1];
      const textOnly = kind === 'textframe' && place === 'float';
      if (!textOnly) expect.soft(Math.abs(r.dW - wantW) <= TOL && Math.abs(r.dH - wantH) <= TOL, `${tag} 크기 Δ ${r.dW}×${r.dH} · 기대 ${wantW}×${wantH}`).toBe(true);
      if (!flow) {
        expect.soft(Math.abs(r.oppMove[0]) <= TOL && Math.abs(r.oppMove[1]) <= TOL,
          `${tag} 맞은편 ${NAME[OPP[r.dir]]}(${OPP[r.dir]}) 고정이어야 — 움직임 ${JSON.stringify(r.oppMove)} · 실제 고정 ${JSON.stringify(r.fixed)}`).toBe(true);
      }
      // 그룹 자식은 그룹 상자 안 같은 비율 자리·폭(±2%) — 기준점만 바뀌고 스케일은 그대로
      for (const d of r.kidDrift) expect.soft(d, `${tag} 자식 비율 자리 어긋남`).toBeLessThanOrEqual(0.02);
    }
    expect(errs, errs.join(' | ')).toEqual([]);
  });
}

test('T308 회전 30° 에셋 @ free — 4꼭지: 맞은편 꼭지(그 손잡이 화면 중심)가 ±2px 안에 그대로', async ({ page }) => {
  test.setTimeout(150000);
  await page.setViewportSize({ width: 1600, height: 1200 });
  const errs = await bootApp(page);
  for (const dir of DIRS) {
    const { pre, H } = await prep(page, 'free', 'asset', dir, { rot: 30 });
    const rot = await page.evaluate(() => document.querySelector('[data-t308="tgt"]').dataset.rotation);
    expect.soft([pre.pos, rot], `${dir} 전제: absolute · 회전 30`).toEqual(['absolute', '30']);
    const oppSel = handleSel('asset', OPP[dir]);
    const P0 = await visibleHandle(page, oppSel);
    const m0 = await snap(page);
    // 로컬 바깥 방향(30° 돌린 축)으로 끈다
    const t = Math.PI / 6, lx = (dir.includes('e') ? 1 : -1) * 40, ly = (dir.includes('s') ? 1 : -1) * 30;
    await drag(page, H, [lx * Math.cos(t) - ly * Math.sin(t), lx * Math.sin(t) + ly * Math.cos(t)]);
    await raf(page);
    const P1 = await visibleHandle(page, oppSel);
    const m1 = await snap(page);
    console.log('T308ROT ' + JSON.stringify({ dir, P0, P1, m0: m0.model, m1: m1.model }));
    expect.soft(parseFloat(m1.model.width) - parseFloat(m0.model.width), `${dir} 로컬 폭 +40`).toBeCloseTo(40, -0.5);
    expect.soft(Math.abs(P1[0] - P0[0]) <= 2 && Math.abs(P1[1] - P0[1]) <= 2, `${dir} 맞은편 ${OPP[dir]} 화면 고정 — ${JSON.stringify(P0)} → ${JSON.stringify(P1)}`).toBe(true);
  }
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('T308 ⌘Z — free 에셋 A(nw) 한 번 끌기 = ⌘Z 한 번에 크기·자리 함께 복원', async ({ page }) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 1600, height: 1200 });
  const errs = await bootApp(page);
  const { H } = await prep(page, 'free', 'asset', 'nw');
  const m0 = (await snap(page)).model;
  await drag(page, H, [-40, -30]);
  const m1 = (await snap(page)).model;
  expect([m1.left, m1.top, m1.width, m1.height], '끌기 뒤: 자리·크기 같이 바뀜').toEqual(['140px', '90px', '240px', '180px']);
  await page.keyboard.press('Meta+z');
  await expect.poll(async () => { const m = await page.evaluate(() => { const t = document.querySelector('.asset-block[data-t308="tgt"]') || [...document.querySelectorAll('.frame-block[data-free-layout] .asset-block')].pop(); return t && [t.style.left, t.style.top, t.style.width, t.style.height, t.dataset.offsetX, t.dataset.offsetY]; }); return m; },
    '⌘Z 한 번 = 시작 자리·크기').toEqual([m0.left, m0.top, m0.width, m0.height, m0.ox, m0.oy]);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('T308 Shift — free 에셋 A(nw) 비율 고정 끌기: 비율 유지 + 맞은편 D(se) 고정', async ({ page }) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 1600, height: 1200 });
  const errs = await bootApp(page);
  const { H } = await prep(page, 'free', 'asset', 'nw');
  const R0 = await snap(page);
  await drag(page, H, [-60, -10], { shift: true });
  const R1 = await snap(page);
  console.log('T308SHIFT ' + JSON.stringify({ R0: R0.model, R1: R1.model }));
  expect.soft(R1.w / R1.h, '비율 유지 4:3').toBeCloseTo(R0.w / R0.h, 1);
  expect.soft(R1.w - R0.w, '폭 +60').toBeCloseTo(60, 0);
  const o0 = corner(R0, 'se'), o1 = corner(R1, 'se');
  expect(Math.abs(o1[0] - o0[0]) <= TOL && Math.abs(o1[1] - o0[1]) <= TOL, `맞은편 D(se) 고정 — ${o0} → ${o1}`).toBe(true);
  expect(errs, errs.join(' | ')).toEqual([]);
});
