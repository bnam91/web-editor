/* t308-free-corner-anchor.dom.spec.js — t3-08 (0.9.11_t3) · 프레임 안 자유모드 객체의 모서리 핸들 «기준점»
 *
 * 현빈 원문(요지): 프레임 안 에셋/도형을 자유모드에서 우상단 B 핸들로 끌면 A 꼭지점이 고정되고 C·D 가 움직인다.
 *   원하는 것 = B 를 끌면 «맞은편» C 가 고정, A·D 는 X·Y 이동값에 따라 움직인다.
 * 이름 매핑(이 시험의 해석): A=nw · B=ne · C=sw · D=se. 규칙 = «잡은 꼭지점의 맞은편 꼭지점이 화면에서 안 움직인다».
 *
 * 무엇을 재나: 4꼭지 × 자리(free 프레임 · stack 프레임 · free 안 free(깊이2) · free+줌40+스크롤 · 섹션 직속) × 종류(에셋 · 사각형)
 *   × 방향(바깥 · 안쪽). 진짜 마우스로 «보이는 핸들»을 끈다. 전/후 getBoundingClientRect 로
 *   ⑴ 맞은편 꼭지점이 ±1.5px 안에 그대로인가 ⑵ 화면 크기 변화 = 잡은 꼭지점 바깥 방향 × 마우스 Δ 인가.
 * 기대값은 «맞는 동작»이다 — base(e7d97f1ec)에서 빨강인 칸이 결함 칸이다.
 *   흐름 배치(stack 프레임 · 섹션 직속)는 가운데 정렬이라 폭이 «양쪽으로» 는다 — 그 칸은 ⑴ 을 걸지 않고 기록만 한다
 *   (좌표가 없는 배치에서 «맞은편 고정»은 이 티켓 범위 밖. 크기 ⑵ 만 단언).
 * 장면 준비만 evaluate(섹션·프레임·블럭 추가, 시작 크기·자리, 선택) — 끌기는 진짜 마우스. ⛔waitForTimeout 0.
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const DIRS = ['nw', 'ne', 'sw', 'se'];
const OPP = { nw: 'se', ne: 'sw', sw: 'ne', se: 'nw' };
const NAME = { nw: 'A', ne: 'B', sw: 'C', se: 'D' };
const PLACES = ['free', 'stack', 'depth2', 'freeZoomScroll', 'section'];
const TYPES = ['asset', 'shape'];
const TOL = 1.5;

const raf = (p) => p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

async function scene(page, place, type) {
  return page.evaluate(async ({ place, type }) => {
    const FR = '.frame-block:not([data-text-frame])';
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach((s) => s.remove());
    await window.addSection();
    const sec = c.querySelector('.section-block');
    const within = (par, fn, sel) => { window.deselectAll(); window.selectSection(sec); window._activeFrame = par; const b = new Set(sec.querySelectorAll(sel)); fn(); const e = [...sec.querySelectorAll(sel)].find((x) => !b.has(x)); window._activeFrame = null; return e; };
    let host = null;
    if (place === 'free' || place === 'freeZoomScroll') host = within(null, () => window.addFrameBlock({}), FR);
    if (place === 'stack') host = within(null, () => window.addFrameBlock({ fullWidth: true }), FR);
    if (place === 'depth2') {
      const outer = within(null, () => window.addFrameBlock({}), FR);
      host = within(outer, () => window.addFrameBlock({}), FR);
      window.updateFrameBlock?.(host.id, { width: 600, height: 420 });
      host.style.left = '120px'; host.style.top = '40px'; host.dataset.offsetX = '120'; host.dataset.offsetY = '40';
    }
    if (place === 'stack') { host.style.minHeight = '420px'; }
    let obj, target;
    if (type === 'asset') {
      obj = within(host, () => window.addAssetBlock('standard'), '.asset-block');
      obj.style.width = '200px'; obj.style.height = '150px';
      target = obj;
    } else {
      const sb = within(host, () => window.addShapeBlock('rectangle'), '.shape-block');
      obj = sb;
      target = sb.closest('.frame-block');
      target.style.width = '200px'; target.style.height = '150px'; target.style.minHeight = '150px';
      target.dataset.width = '200'; target.dataset.height = '150';
    }
    if (target.style.position === 'absolute') {
      target.style.left = '180px'; target.style.top = '120px';
      target.dataset.offsetX = '180'; target.dataset.offsetY = '120';
    }
    window.deselectAll(); window.clearHistory?.();
    window.applyZoom?.(place === 'freeZoomScroll' ? 40 : 100);
    target.id = target.id || 't308tgt';
    target.setAttribute('data-t308', 'tgt');
    obj.setAttribute('data-t308obj', '1');
    return { pos: target.style.position || 'static', frameMode: host ? (host.dataset.freeLayout ? 'free' : 'stack') : 'none',
      depth: (() => { let d = 0; for (let e = target.parentElement; e; e = e.parentElement) if (e.matches?.(FR) && !e.querySelector(':scope > .shape-block')) d++; return d; })() };
  }, { place, type });
}

async function settle(page, place) {
  await page.waitForFunction(() => { const t = document.getElementById('canvas-scaler')?.style.transform; const same = t === window.__zt; window.__zt = t; return same; }, null, { polling: 150 });
  await page.evaluate((place) => {
    const t = document.querySelector('[data-t308="tgt"]');
    t.scrollIntoView({ block: 'center' });
    // 스크롤된 자리: 캔버스 스크롤 컨테이너를 조금 더 민다(프레임이 화면에서 «위로 밀린» 상태)
    if (place === 'freeZoomScroll') { let s = t.parentElement; while (s && s.scrollHeight <= s.clientHeight + 1) s = s.parentElement; if (s) s.scrollTop += 60; }
  }, place);
  await raf(page);
}

async function select(page, type) {
  await page.evaluate((type) => {
    const o = document.querySelector('[data-t308obj]');
    if (type === 'shape') { window.selectShapeBlock ? window.selectShapeBlock(o) : o.click(); return; }
    // 프레임 안 에셋: 첫 클릭은 부모 프레임을 고른다(_isInsideUnselectedFrame) — 고를 때까지 한 층씩
    for (let i = 0; i < 4 && !o.classList.contains('selected'); i++) o.click();
  }, type);
  await raf(page);
}

const handleSel = (type, dir) => type === 'asset' ? `#ss-handles-overlay .asset-overlay-handle.${dir}` : `.shape-handle.${dir}`;

async function rectOf(page) {
  return page.evaluate(() => { const b = document.querySelector('[data-t308="tgt"]').getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom, w: b.width, h: b.height }; });
}
const corner = (R, d) => [d.includes('w') ? R.l : R.r, d.includes('n') ? R.t : R.b];

async function dragRow(page, place, type, dir, kind) {
  const pre = await scene(page, place, type);
  await settle(page, place);
  await select(page, type);
  const hs = handleSel(type, dir);
  await expect.poll(() => page.evaluate((s) => { const h = [...document.querySelectorAll(s)].find((x) => x.getBoundingClientRect().width > 0); return !!h; }, hs), `[전제] ${type} ${dir} 핸들 보임`).toBe(true);
  const H = await page.evaluate((s) => { const h = [...document.querySelectorAll(s)].find((x) => x.getBoundingClientRect().width > 0); const b = h.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; }, hs);
  const hit = await page.evaluate(([x, y, s]) => { const e = document.elementFromPoint(x, y); return !!e && e.matches(s); }, [H[0], H[1], hs]);
  const scale = await page.evaluate(() => { const m = document.getElementById('canvas-scaler')?.style.transform?.match(/scale\(([^)]+)\)/); return m ? parseFloat(m[1]) : 1; });
  const R0 = await rectOf(page);
  const sx = dir.includes('e') ? 1 : -1, sy = dir.includes('s') ? 1 : -1;
  const D = kind === 'out' ? [sx * 40, sy * 30] : [-sx * 20, -sy * 15];
  await page.mouse.move(H[0], H[1]);
  await page.mouse.down();
  await page.mouse.move(H[0] + D[0], H[1] + D[1], { steps: 6 });
  await page.mouse.up();
  await raf(page);
  const R1 = await rectOf(page);
  const o0 = corner(R0, OPP[dir]), o1 = corner(R1, OPP[dir]);
  const fixed = DIRS.filter((d) => { const a = corner(R0, d), b = corner(R1, d); return Math.abs(a[0] - b[0]) <= TOL && Math.abs(a[1] - b[1]) <= TOL; });
  const dW = R1.w - R0.w, dH = R1.h - R0.h;
  const row = { place, type, dir, name: NAME[dir], kind, pos: pre.pos, frameMode: pre.frameMode, depth: pre.depth, scale, hit,
    D, dW: +dW.toFixed(1), dH: +dH.toFixed(1), oppMove: [+(o1[0] - o0[0]).toFixed(1), +(o1[1] - o0[1]).toFixed(1)], fixed: fixed.map((d) => NAME[d] + '/' + d) };
  console.log('T308ROW ' + JSON.stringify(row));
  return row;
}

for (const type of TYPES) for (const place of PLACES) {
  test(`T308 ${type} @ ${place} — 4꼭지 × 바깥/안쪽: 맞은편 꼭지점 고정 · 크기 Δ = 마우스 Δ`, async ({ page }) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width: 1600, height: 1200 });
    const errs = await bootApp(page);
    const rows = [];
    for (const dir of DIRS) for (const kind of ['out', 'in']) rows.push(await dragRow(page, place, type, dir, kind));
    for (const r of rows) {
      const tag = `${type}@${place} ${r.name}(${r.dir}) ${r.kind} pos=${r.pos}`;
      expect.soft(r.hit, `${tag} 전제: 핸들 자리에서 핸들이 잡힌다`).toBe(true);
      const sx = r.dir.includes('e') ? 1 : -1, sy = r.dir.includes('s') ? 1 : -1;
      const wantW = sx * r.D[0], wantH = sy * r.D[1];
      expect.soft(Math.abs(r.dW - wantW) <= TOL && Math.abs(r.dH - wantH) <= TOL, `${tag} 크기 Δ ${r.dW}×${r.dH} · 기대 ${wantW}×${wantH}`).toBe(true);
      if (r.pos === 'absolute') {
        expect.soft(Math.abs(r.oppMove[0]) <= TOL && Math.abs(r.oppMove[1]) <= TOL,
          `${tag} 맞은편 ${NAME[OPP[r.dir]]}(${OPP[r.dir]}) 고정이어야 — 움직임 ${JSON.stringify(r.oppMove)} · 실제 고정 ${JSON.stringify(r.fixed)}`).toBe(true);
      }
    }
    expect(errs, errs.join(' | ')).toEqual([]);
  });
}
