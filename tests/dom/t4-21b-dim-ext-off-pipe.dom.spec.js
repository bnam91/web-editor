// t4-21 ⒝ — 현빈 원문 «그리고 보조지시선을 off하고 양끝 파이프를 두고 싶은데 그렇게는 안되니?»
// 묶임 실측: 보조선(dataset.dimShowExt · 패널 «자세히» 안 «보조선» 체크)과 끝 막음(dataset.anchorShape · 패널 «시작점 모양» 단추 줄 pipe·slash)이
//   서로 묶였나 — 정의 자리 = js/blocks/annotation-block.js _renderDimSVG(보조선 줄 .annot-dim-ext 만 dimShowExt 로 끄고 · 양끝 앵커는 늘 그린다).
// 장면은 앱 제 문으로만: 새 섹션 · 펜 메뉴 «사이즈 스티커» · 클릭 3 · Esc ×2 · 라벨 클릭(고르기) · 패널 «자세히» 열기 · «보조선» 체크 · «pipe» 단추 · ⌘Z. page.evaluate 는 읽기만.
// 자 — .annot-dim-ext 수 · .annot-anchor 수·꼴(tag)·자리(치수선 끝 ±1px)·회전(치수선 각 ±90 · ±1°) · dataset 두 칸.
// 성공 = 단언 (예측: 바닥 72cf381d 에서 Q0~Q3 전부 초록 = ⒝ 가 지금도 닿는다)
// 판 정체 — HEAD === EXPECT_SHA · ID_FILES 마다 페이지가 받은 sha1 === 디스크 === EXPECT_FILES_SHA1(JSON · ~/taeyang-098/ty-specenv.py 로 파생)
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { ROOT, waitStableRect } = require('./_root-harness.js');

test.describe.configure({ timeout: 90000 });

const ORIGIN = 'http://goditor.dom.test';
const VIEW = { width: 1600, height: 1200 };
const MIME = { '.js': 'application/javascript', '.mjs': 'application/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json' };
const ID_FILES = ['js/annotation-select.js', 'js/annotation-tool.js', 'js/blocks/annot-dim-geometry.js', 'js/blocks/annotation-block.js', 'js/props/prop-annotation.js'];
const TOL = 2;
const sha1 = (b) => crypto.createHash('sha1').update(b).digest('hex');
const log = (tag, o) => console.log(`T421B ${tag} ${JSON.stringify(o)}`);

async function assertBoard(page) {
  const want = process.env.EXPECT_SHA || '';
  expect(want, '판 정체: EXPECT_SHA 40 hex').toMatch(/^[0-9a-f]{40}$/);
  let wantMap = null; try { wantMap = JSON.parse(process.env.EXPECT_FILES_SHA1 || ''); } catch (_) {}
  expect(wantMap && Object.keys(wantMap).sort(), 'EXPECT_FILES_SHA1 열쇠 = ID_FILES').toEqual([...ID_FILES].sort());
  const noGit = process.env.IDENT_NO_GIT === '1';
  const head = noGit ? null : execFileSync('git', ['-C', ROOT, 'rev-parse', 'HEAD']).toString().trim();
  const rows = [];
  for (const f of ID_FILES) {
    const b64 = await page.evaluate(async (u) => { const a = new Uint8Array(await (await fetch(u, { cache: 'no-store' })).arrayBuffer());
      let s = ''; for (let k = 0; k < a.length; k += 0x8000) s += String.fromCharCode.apply(null, a.subarray(k, k + 0x8000)); return btoa(s); }, `${ORIGIN}/${f}`);
    rows.push({ f, page: sha1(Buffer.from(b64, 'base64')), root: sha1(fs.readFileSync(path.join(ROOT, f))), want: wantMap[f] });
  }
  log('ident', { root: ROOT, head, noGit, want, rows });
  if (!noGit) expect(head, '판 정체 ⑴ HEAD === EXPECT_SHA').toBe(want);
  for (const r of rows) { expect(r.page, `판 정체 ⑵a ${r.f} 서빙=디스크`).toBe(r.root); expect(r.root, `판 정체 ⑵b ${r.f} 디스크=env`).toBe(r.want); }
}

async function boot(page) {
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 300)));
  page.on('dialog', d => d.dismiss().catch(() => {}));
  await page.setViewportSize(VIEW);
  await page.addInitScript(() => {
    window.electronAPI = new Proxy({}, { get: () => (() => Promise.resolve(null)) });
    window.prompt = () => { throw new Error('prompt() is not supported.'); };
  });
  await page.route('**/*', async (r) => {
    const url = r.request().url();
    if (url.startsWith('data:') || url.startsWith('blob:')) return r.continue();
    if (!url.startsWith(ORIGIN + '/')) return r.abort();
    const f = path.join(ROOT, decodeURIComponent(new URL(url).pathname));
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return r.fulfill({ status: 404, body: '' });
    return r.fulfill({ contentType: MIME[path.extname(f)] || 'application/octet-stream', body: fs.readFileSync(f) });
  });
  await page.goto(`${ORIGIN}/index.html`);
  await page.waitForFunction(() => typeof window.rebindAll === 'function' && typeof window.makeAnnotationBlock === 'function' && typeof window.annotDimGeometry === 'function', null, { timeout: 30000 });
  await assertBoard(page);
  return errs;
}
const poll = async (page, fn, arg, timeout = 6000) => { try { await page.waitForFunction(fn, arg, { timeout, polling: 100 }); return true; } catch { return false; } };
const rectOf = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height, cx: r.left + r.width / 2, cy: r.top + r.height / 2 }; }, sel);
const hitAt = (page, x, y, sel) => page.evaluate(([x, y, s]) => { const e = document.elementFromPoint(x, y); return { ok: !!(e && (e.matches(s) || e.closest(s))),
  hit: e ? (e.id ? '#' + e.id : '') + '.' + String(e.className?.baseVal ?? e.className ?? '').split(' ')[0] : null }; }, [x, y, sel]);
async function zoom100(page) {
  for (let k = 0; k < 20; k++) {
    const z = (await page.textContent('#zoom-display')).trim();
    if (z === '100%') return z;
    await page.click(parseInt(z, 10) < 100 ? '#zoom-ctrl .zoom-btn >> nth=1' : '#zoom-ctrl .zoom-btn >> nth=0');
    await poll(page, (p) => document.getElementById('zoom-display').textContent.trim() !== p, z, 3000);
  }
  return (await page.textContent('#zoom-display')).trim();
}

// 지금 화면의 치수선 — 라벨 중심 · 치수선 두 끝(svg 좌표 → 화면) · 중점 · 손잡이
const snap = (page, id) => page.evaluate((id) => {
  const b = document.getElementById(id); if (!b) return null;
  const C = (e) => { if (!e) return null; const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
  const m = b.querySelector('.annot-svg')?.getScreenCTM();
  const P = (x, y) => { const p = new DOMPoint(Number(x), Number(y)).matrixTransform(m); return [p.x, p.y]; };
  const ln = b.querySelector('.annot-dim-line');
  const a = P(ln.getAttribute('x1'), ln.getAttribute('y1')), bb = P(ln.getAttribute('x2'), ln.getAttribute('y2'));
  const mid = [(a[0] + bb[0]) / 2, (a[1] + bb[1]) / 2];
  const lab = C(b.querySelector('.annot-label'));
  return { lab, a, b: bb, mid, lm: [lab[0] - mid[0], lab[1] - mid[1]],
    handles: [...b.querySelectorAll('.annot-handle')].map(h => ({ k: h.dataset.dimEnd || ('p' + h.dataset.pointIdx), at: C(h) })) };
}, id);

// 앱 문으로 치수선 하나 만들고 고른다 → id
async function makeDim(page) {
  await zoom100(page);
  const before = await page.evaluate(() => [...document.querySelectorAll('#canvas .section-block:not([data-ghost])')].map(s => s.id));
  await page.click('.fp-btn.primary[title="새 섹션 추가"]');
  expect(await poll(page, (n) => document.querySelectorAll('#canvas .section-block:not([data-ghost])').length > n, before.length), '전제: 새 섹션').toBe(true);
  const sec = (await page.evaluate(() => [...document.querySelectorAll('#canvas .section-block:not([data-ghost])')].map(s => s.id))).find(x => !before.includes(x));
  await page.evaluate((s) => document.getElementById(s).scrollIntoView({ block: 'center', behavior: 'instant' }), sec);
  await waitStableRect(page, `#${sec}`);
  const sr = await rectOf(page, `#${sec}`);
  await page.click('#fp-pen-dropdown .fp-dropdown-trigger');
  await page.click('#fp-pen-menu .fp-menu-item[onclick*="toggleDimMode"]');
  // 고정 대기 0줄(tests/unit/dom-fixed-wait-census W3) — 클릭마다 «그 클릭이 먹혔다»를 기다린다: 미리보기 점 1 → 2 → 치수선 블럭
  const P = [[sr.x + 250, sr.y + sr.h - 60], [sr.x + 550, sr.y + sr.h - 60], [sr.x + 400, sr.y + sr.h - 110]];
  for (const [k, p] of P.slice(0, 2).entries()) {
    await page.mouse.click(p[0], p[1]);
    expect(await poll(page, (n) => document.querySelectorAll('.annot-preview .annot-preview-dot').length >= n, k + 1, 4000), `전제: 클릭 ${k + 1} 이 점으로 먹혔다`).toBe(true);
  }
  await page.mouse.click(P[2][0], P[2][1]);
  expect(await poll(page, (s) => !!document.getElementById(s).querySelector('.annotation-block[data-annot-kind="dim"]'), sec, 4000), '전제: 치수선 생김(클릭 3)').toBe(true);
  const id = await page.evaluate((s) => document.getElementById(s).querySelector('.annotation-block[data-annot-kind="dim"]').id, sec);
  // 만든 직후 라벨이 편집에 들어간 «뒤»에 Esc(라벨 keydown) — 들어가기 전에 누르면 안 닿는다(dimension-sticker-t3-01 selectDim 머리 :86~95)
  //   ★«편집에 들어갔다» = contenteditable 만이 아니라 ★포커스까지 — 포커스는 setTimeout 0 뒤에 온다(js/annotation-select.js annotBeginLabelEdit 끝)
  expect(await poll(page, (i) => { const l = document.querySelector(`#${i} .annot-label`); return l?.getAttribute('contenteditable') === 'true' && document.activeElement === l; }, id, 4000), '전제: 라벨이 편집에 들어갔다(포커스까지)').toBe(true);
  await page.keyboard.press('Escape');
  expect(await poll(page, (i) => document.querySelector(`#${i} .annot-label`)?.getAttribute('contenteditable') !== 'true', id, 4000), '전제: 라벨 편집에서 빠져나왔다').toBe(true);
  await page.keyboard.press('Escape');
  expect(await poll(page, () => !document.body.classList.contains('pen-mode'), null, 4000), '전제: 펜 모드 꺼짐').toBe(true);
  const lr = await rectOf(page, `#${id} .annot-label`);
  const hit = await hitAt(page, lr.cx, lr.cy, `#${id} .annot-label`);
  expect(hit.ok, `전제: 라벨 맞힘(${hit.hit})`).toBe(true);
  await page.mouse.click(lr.cx, lr.cy);
  expect(await poll(page, (i) => document.getElementById(i).classList.contains('selected') && document.querySelectorAll(`#${i} .annot-handle`).length >= 4, id, 3000), '전제: 고름 · 손잡이 넷(d·c·a·b)').toBe(true);
  expect(await page.evaluate((i) => !!(document.getElementById(i).dataset.dimA && document.getElementById(i).dataset.dimB), id), '전제: a·b 가 박혔다(dimA·dimB)').toBe(true);
  return id;
}

// 치수선 그림 읽기 — 보조선 수 · 앵커(꼴·자리·회전) · 치수선 끝·각 (svg 좌표)
const dimPic = (page, id) => page.evaluate((id) => {
  const b = document.getElementById(id); if (!b) return null;
  const ln = b.querySelector('.annot-dim-line');
  const A = [+ln.getAttribute('x1'), +ln.getAttribute('y1')], B = [+ln.getAttribute('x2'), +ln.getAttribute('y2')];
  const lineDeg = Math.atan2(B[1] - A[1], B[0] - A[0]) * 180 / Math.PI;
  const anchors = [...b.querySelectorAll('.annot-svg .annot-anchor')].map(n => {
    const tag = n.tagName.toLowerCase();
    let at = null, rot = null;
    if (tag === 'line') { at = [(+n.getAttribute('x1') + +n.getAttribute('x2')) / 2, (+n.getAttribute('y1') + +n.getAttribute('y2')) / 2];
      const m = /rotate\(([-\d.]+)/.exec(n.getAttribute('transform') || ''); rot = m ? +m[1] : null; }
    else if (tag === 'circle') at = [+n.getAttribute('cx'), +n.getAttribute('cy')];
    return { tag, at, rot };
  });
  return { ext: b.querySelectorAll('.annot-svg .annot-dim-ext').length, lines: b.querySelectorAll('.annot-svg .annot-dim-line').length,
    A, B, lineDeg, anchors, ds: { ext: b.dataset.dimShowExt ?? null, shape: b.dataset.anchorShape ?? null } };
}, id);
const near = (p, q, t = 1) => !!p && !!q && Math.abs(p[0] - q[0]) <= t && Math.abs(p[1] - q[1]) <= t;
const perp = (rot, lineDeg) => { const d = ((rot - lineDeg) % 180 + 180) % 180; return Math.abs(d - 90) <= 1; };

test('Q0~Q3 보조선 끄고 양끝 pipe — 앱 패널 두 동작으로 닿는가 · ⌘Z 한 걸음씩', async ({ page }) => {
  const errs = await boot(page);
  const id = await makeDim(page);
  const q0 = await dimPic(page, id);
  log('Q0', q0);
  expect(q0.ext, 'Q0 기본: 보조선 2').toBe(2);
  expect(q0.anchors.map(a => a.tag), 'Q0 기본: 양끝 circle 2').toEqual(['circle', 'circle']);
  expect(q0.ds, 'Q0 기본: dataset').toEqual({ ext: '1', shape: 'circle' });
  // 패널 «자세히» 열기 → «보조선» 체크 끄기 (앱 문)
  expect(await poll(page, () => !!document.querySelector('#annot-dim-more'), null, 4000), '전제: 치수선 패널 «자세히»').toBe(true);
  const openMore = await page.evaluate(() => document.querySelector('#annot-dim-more').open);
  if (!openMore) await page.click('#annot-dim-more > summary');
  expect(await poll(page, () => document.querySelector('#annot-dim-more').open === true, null, 3000), '전제: «자세히» 열림').toBe(true);
  await page.locator('#annot-dim-ext').scrollIntoViewIfNeeded();
  expect(await page.isChecked('#annot-dim-ext'), '전제: «보조선» 켜져 있음').toBe(true);
  await page.click('#annot-dim-ext');
  expect(await poll(page, (i) => document.querySelectorAll(`#${i} .annot-svg .annot-dim-ext`).length === 0, id, 3000), 'Q1 보조선 0').toBe(true);
  const q1 = await dimPic(page, id);
  log('Q1', q1);
  expect(q1.anchors.length, 'Q1 양끝 앵커 2 그대로').toBe(2);
  expect(q1.lines, 'Q1 치수선 1').toBe(1);
  expect(q1.ds.ext, 'Q1 dataset dimShowExt').toBe('0');
  // «pipe» 단추
  await page.locator('#annot-shape-group .prop-align-btn[data-shape="pipe"]').scrollIntoViewIfNeeded();
  await page.click('#annot-shape-group .prop-align-btn[data-shape="pipe"]');
  expect(await poll(page, (i) => document.getElementById(i).dataset.anchorShape === 'pipe', id, 3000), '전제: pipe 먹힘').toBe(true);
  const q2 = await dimPic(page, id);
  log('Q2', q2);
  expect(q2.ext, 'Q2 보조선 여전히 0').toBe(0);
  expect(q2.anchors.map(a => a.tag), 'Q2 양끝 pipe(line) 2').toEqual(['line', 'line']);
  expect(near(q2.anchors[0].at, q2.A) && near(q2.anchors[1].at, q2.B), `Q2 pipe 자리 = 치수선 양끝 ±1 (${JSON.stringify([q2.anchors.map(a => a.at), q2.A, q2.B])})`).toBe(true);
  expect(q2.anchors.every(a => perp(a.rot, q2.lineDeg)), `Q2 pipe 는 치수선에 수직 ±1° (${JSON.stringify([q2.anchors.map(a => a.rot), q2.lineDeg])})`).toBe(true);
  // ⌘Z 한 걸음씩 — 패널 입력칸 밖(캔버스 빈 데)으로 초점을 옮기지 않고 키만(패널 단추는 입력칸이 아니다)
  await page.keyboard.press('Meta+z');
  expect(await poll(page, (i) => document.getElementById(i)?.dataset.anchorShape === 'circle', id, 3000), 'Q3a ⌘Z 1 → circle').toBe(true);
  const q3a = await dimPic(page, id);
  log('Q3a', q3a);
  expect(q3a.ext, 'Q3a 보조선은 여전히 0').toBe(0);
  await page.keyboard.press('Meta+z');
  expect(await poll(page, (i) => document.querySelectorAll(`#${i} .annot-svg .annot-dim-ext`).length === 2, id, 3000), 'Q3b ⌘Z 2 → 보조선 2').toBe(true);
  log('Q3b', await dimPic(page, id));
  expect(errs).toEqual([]);
});
