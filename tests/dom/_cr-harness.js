// _cr-harness — CLONE-RERENDER-01 사용자 길 재기 공용부(사본 4 길 × 종류 행위 자). 쓰는 spec: _s5-cr01(탐침) · graph-reload-bind.
// (옛 머리말: S5 CLONE-RERENDER-01 탐침 (커밋 금지 · 핀 나무 untracked 1개 · 끝나면 사본+sha → 지우기는 태양 승인).)
// 돌리는 법(핀 나무 cwd · 서빙 판은 GD1001_ROOT):
//   핀:     GD1001_ROOT=<핀> EXPECT_SHA=<풀 sha> EXPECT_MODE=git  CR_RUN=<표> RUN_COUNTED=1 bash ~/taeyang-098/run-test.sh dom tests/dom/_s5-cr01.dom.spec.js --retries=0 --output=test-results-S5cr --grep @K18 --repeat-each=3
//   고친 판: GD1001_ROOT=<레인> EXPECT_SHA=<바닥 sha> EXPECT_MODE=work …  (레인 HEAD == 바닥 · 서빙 바이트 == 레인 작업 바이트 · numstat 을 JSON 에)
// 규칙: 장면은 앱 제 문(메뉴·섹션 툴바 A/B·레이어 패널·진짜 마우스·⌘C/⌘V·⌘S·같은 ?project= 다시 부팅). 예외(칸 JSON door 에 적음):
//   섹션 템플릿 저장·넣기 = window.saveAsTemplate/insertTemplate(W2D-01b 와 같음) · qa 넣기 = window.addQABlock(메뉴 항목 0 — index.html grep).
// ★단언은 P0(전제)만 — 빨강 = 장면 미성립. 주 단언(판정 칸) = JSON main.ok (사본에서 사용자 길 행위가 먹었나) — rc 는 판정에 안 쓴다.
// 곁: 길이 도는 동안 window.render* 호출 수(계수기 · «두 번 그려지나») · 누를 점 좌표·스크롤·뷰포트 안 여부(W2D-01b RT r2 교훈).
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { ROOT, waitStableRect } = require('./_root-harness.js');

const ORIGIN = 'http://goditor.dom.test';
const RUN = process.env.CR_RUN || 'r0';
const OUT = process.env.CR_OUT ? path.join(process.env.CR_OUT, RUN) : null;   // 결과 JSON 자리 — env 가 없으면 안 쓴다(커밋된 spec 이 보고 폴더에 쓰지 않게)
const VIEW = { width: 1440, height: 900 };
const MIME = { '.js': 'application/javascript', '.mjs': 'application/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json' };
const T_MS = 120000;
const PROJ = 'proj_s5cr01';
if (OUT) fs.mkdirSync(OUT, { recursive: true });

// 판 정체 — EXPECT_MODE=git: 서빙 바이트 == git show EXPECT_SHA:<f> · =work: ROOT HEAD == EXPECT_SHA 이고 서빙 바이트 == ROOT 작업 바이트(고친 판)
const EXPECT_SHA = process.env.EXPECT_SHA || '';
const EXPECT_MODE = process.env.EXPECT_MODE || 'git';
const IDENT_FILES = ['index.html', 'js/io/save-load.js', 'js/section-variation.js', 'js/panels/template-system.js', 'js/editor.js', 'js/blocks/radial-block.js'];
const sha1 = (b) => crypto.createHash('sha1').update(b).digest('hex');
let IDENT = null;
async function fetchSha1(page, f) {
  const b64 = await page.evaluate(async (u) => { const a = new Uint8Array(await (await fetch(u, { cache: 'no-store' })).arrayBuffer());
    let bin = ''; for (let i = 0; i < a.length; i += 0x8000) bin += String.fromCharCode.apply(null, a.subarray(i, i + 0x8000)); return btoa(bin); }, `${ORIGIN}/${f}`);
  return sha1(Buffer.from(b64, 'base64'));
}
async function assertBoard(page) {
  if (!EXPECT_SHA && !process.env.CR_REQUIRE_BOARD) { IDENT = null; return; }   // 판 정체는 재기 런(env)에서만 — 일반 회귀 런은 건너뜀
  expect(EXPECT_SHA, 'P0 판 정체: EXPECT_SHA env 가 풀 sha 40자').toMatch(/^[0-9a-f]{40}$/);
  expect(['git', 'work'].includes(EXPECT_MODE), 'P0 판 정체: EXPECT_MODE git|work').toBe(true);
  const headSha = execFileSync('git', ['-C', ROOT, 'rev-parse', 'HEAD']).toString().trim();
  const numstat = execFileSync('git', ['-C', ROOT, 'diff', '--numstat', 'HEAD']).toString().trim();
  const files = {};
  for (const f of IDENT_FILES) {
    const want = EXPECT_MODE === 'git' ? sha1(execFileSync('git', ['-C', ROOT, 'show', `${EXPECT_SHA}:${f}`])) : sha1(fs.readFileSync(path.join(ROOT, f)));
    files[f] = { want, page: await fetchSha1(page, f) };
  }
  IDENT = { root: ROOT, mode: EXPECT_MODE, expectSha: EXPECT_SHA, headSha, numstat, files };
  expect(headSha, 'P0 판 정체 ⑴: ROOT 의 HEAD === EXPECT_SHA').toBe(EXPECT_SHA);
  if (EXPECT_MODE === 'git') expect(numstat, 'P0 판 정체: git 판은 ROOT 추적 미커밋 0').toBe('');
  for (const f of IDENT_FILES) expect(files[f].page, `P0 판 정체 ⑵: 페이지가 받은 ${f} sha1`).toBe(files[f].want);
}
function save(cell, ti, o) {
  if (!OUT) return null;
  const base = `${cell}-${RUN}-r${ti.repeatEachIndex}-t${ti.retry}`;
  let p = path.join(OUT, base + '.json'); let k = 1;
  while (fs.existsSync(p)) p = path.join(OUT, `${base}-dup${k++}.json`);
  fs.writeFileSync(p, JSON.stringify({ ident: IDENT, ...o }, null, 1));
  return p;
}

// 렌더 계수기 — 네 명부가 window 로 부르는 이름 21 (save-load.js rebindAll 세 구간 + editor.js _bindPastedEl + 사본 길 둘)
const RENDER_NAMES = ['renderStickerBlock', 'renderGradientBlock', 'renderLaurelBlock', 'renderCouponBlock', 'renderQuoteBlock', 'renderRadialBlock', 'renderGraph',
  'renderZoomBlock', 'renderBridgeBlock', 'applyBridgeFullBleed', 'renderGridBlock', 'renderInfoCardBlock', 'renderInnerCardBlock', 'renderModalBlock', 'renderChatBlock',
  'lnRenderBubble', 'renderBanner02', 'renderComparison', 'renderCanvas', 'renderQABlock', 'renderStepBlock'];

async function stub(page) {
  await page.addInitScript(() => {
    // ★협업 끔(지디 덧) — feature-flags.js:77 가 뒤에 true 로 덮지 못하게 defineProperty · Proxy 에 collab 키 0.
    Object.defineProperty(window, 'COLLAB_ENABLED', { configurable: true, get: () => false, set: () => {} });
    const KP = (id) => 's5cr:' + id;
    const tpl = new Map(); window.__tplStore = tpl;
    window.electronAPI = new Proxy({}, { get: (_, k) => {
      if (k === 'isElectron') return true;
      if (k === 'saveProject') return (p) => { sessionStorage.setItem(KP(p.id), JSON.stringify(p)); sessionStorage.setItem('s5cr:saves', String(Number(sessionStorage.getItem('s5cr:saves') || 0) + 1)); return Promise.resolve({ ok: true }); };
      if (k === 'saveProjectSync') return (p) => { sessionStorage.setItem(KP(p.id), JSON.stringify(p)); sessionStorage.setItem('s5cr:saves', String(Number(sessionStorage.getItem('s5cr:saves') || 0) + 1)); return { ok: true }; };
      if (k === 'loadProject') return (id) => { const s = sessionStorage.getItem(KP(id)); return Promise.resolve(s ? JSON.parse(s) : null); };
      if (k === 'listProjects') return () => Promise.resolve([]);
      if (k === 'saveTemplateCanvas') return (id, html) => { tpl.set(id, html); return Promise.resolve(true); };
      if (k === 'loadTemplateCanvas') return (id) => Promise.resolve(tpl.has(id) ? tpl.get(id) : null);
      return () => Promise.resolve(null);
    } });
    window.prompt = () => { throw new Error('prompt() is not supported.'); };
  });
}
async function boot(page) {
  const B = { errs: [], cerr: [], dialogs: [], aborted: [], reqFailed: [] };
  page.on('pageerror', e => B.errs.push(String(e).slice(0, 300)));
  page.on('console', m => { if (m.type() === 'error') B.cerr.push(m.text().slice(0, 300)); });
  page.on('dialog', d => { B.dialogs.push(d.type() + ':' + d.message().slice(0, 120)); d.dismiss().catch(() => {}); });
  page.on('requestfailed', q => B.reqFailed.push(q.url().slice(0, 120) + ' ← ' + (q.failure()?.errorText || '?')));
  await page.setViewportSize(VIEW);
  await stub(page);
  await page.route('**/*', async (r) => {
    const url = r.request().url();
    if (!url.startsWith(ORIGIN + '/')) { if (!url.startsWith('data:') && !url.startsWith('blob:')) B.aborted.push(url.slice(0, 120)); return r.abort(); }
    const u = new URL(url); const f = path.join(ROOT, decodeURIComponent(u.pathname));
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return r.fulfill({ status: 404, body: '' });
    return r.fulfill({ contentType: MIME[path.extname(f)] || 'application/octet-stream', body: fs.readFileSync(f) });
  });
  await gotoApp(page, B);
  await assertBoard(page);
  return B;
}
async function gotoApp(page, B) {
  await page.goto(`${ORIGIN}/index.html?project=${PROJ}`);
  await page.waitForFunction(() => typeof window.rebindAll === 'function' && typeof window.insertTemplate === 'function' && typeof window.saveAsTemplate === 'function' && typeof window.serializeProject === 'function', null, { timeout: 30000 });
  await page.evaluate((names) => {
    window.__norm = () => { const p = JSON.parse(window.serializeProject()); const pg = (p.pages || []).find(x => x.id === p.currentPageId) || (p.pages || [])[0] || {};
      const t = document.createElement('template'); t.innerHTML = String(pg.canvas || ''); t.content.querySelectorAll('.section-toolbar').forEach(e => e.remove());
      t.content.querySelectorAll('[class]').forEach(e => { ['selected', 'multi-selected', 'drag-over', 'editing', 'hover', 'is-hover', 'block-hover', 'rdl-cell-selected'].forEach(c => e.classList.remove(c)); if (!e.className) e.removeAttribute('class'); });
      t.content.querySelectorAll('[draggable]').forEach(e => e.removeAttribute('draggable')); return t.innerHTML.replace(/\s*--sec-clip:\s*[^;"]*;?/g, ''); };
    // 계수기 — window.<이름> 을 감싸 부른 수만 센다(동작은 그대로 넘김 · 읽기 전용 감싸기)
    window.__rc = {}; window.__rcOn = false; window.__rcMissing = [];
    for (const n of names) {
      const f = window[n];
      if (typeof f !== 'function') { window.__rcMissing.push(n); continue; }
      window[n] = function (...a) { if (window.__rcOn) window.__rc[n] = (window.__rc[n] || 0) + 1; return f.apply(this, a); };
    }
  }, RENDER_NAMES);
  const collab = await page.evaluate(() => window.COLLAB_ENABLED);
  expect(collab, 'P0: COLLAB_ENABLED === false (defineProperty 가 먹었다)').toBe(false);
}
function errsOf(B) { return { errs: B.errs.slice(0, 20), cerr: B.cerr.slice(0, 20), dialogs: B.dialogs.slice(0, 10), abortedN: B.aborted.length, aborted: B.aborted.slice(0, 5), reqFailed: B.reqFailed.slice(0, 5) }; }
async function pollTrue(page, fn, arg, timeout = 6000) { try { await page.waitForFunction(fn, arg, { timeout, polling: 100 }); return true; } catch { return false; } }
async function settleNorm(page, timeout = 8000) {
  await page.evaluate(() => { window.__lastNorm = null; });
  return pollTrue(page, () => { const s = window.__norm(); const ok = s === window.__lastNorm; window.__lastNorm = s; return ok; }, null, timeout);
}
async function stableTwice(page, sel) {
  const a = await waitStableRect(page, sel); const b = await waitStableRect(page, sel);
  return { ...b, twiceSame: a.left === b.left && a.top === b.top && a.width === b.width && a.height === b.height };
}
const scrollTo = (page, sel) => page.evaluate((s) => document.querySelector(s)?.scrollIntoView({ block: 'center', behavior: 'instant' }), sel);
// 누를 점 기록(W2D-01b RT r2 교훈) — 좌표 · 스크롤 · 뷰포트 · 안 여부 · elementFromPoint 가 그 선택자 안인가
async function pointAt(page, sel) {
  await scrollTo(page, sel);
  const r = await stableTwice(page, sel);
  const pt = await page.evaluate(([x, y, sel]) => { const e = document.elementFromPoint(x, y);
    return { x, y, scrollX: window.scrollX, scrollY: window.scrollY, innerW: window.innerWidth, innerH: window.innerHeight, inViewport: x >= 0 && y >= 0 && x < window.innerWidth && y < window.innerHeight,
      hitInside: !!(e && e.closest(sel)), hit: e ? (e.tagName + '.' + String(e.className?.baseVal ?? e.className).split(' ')[0]) : null }; }, [r.cx, r.cy, sel]);
  return { ...pt, w: r.width, h: r.height, twiceSame: r.twiceSame };
}
async function escapeOut(page) {
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
  const pt = await page.evaluate(() => { const w = document.getElementById('canvas-wrap').getBoundingClientRect(); const s = document.querySelector('#canvas .section-block:not([data-ghost])');
    if (!s) return null; const r = s.getBoundingClientRect(); return { x: Math.max(w.left + 10, r.left - 40), y: Math.min(Math.max(w.top + 60, r.top + 40), w.bottom - 40) }; });
  if (pt) { const ok = await page.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return !!(e && e.closest('#canvas-wrap') && !e.closest('.section-block, .fp-dropdown, #floating-panel')); }, [pt.x, pt.y]); if (ok) await page.mouse.click(pt.x, pt.y); }
  await settleNorm(page);
}
async function clickMenu(page, dd, label) {
  await page.click(`#${dd}-dropdown .fp-dropdown-trigger`);
  const re = new RegExp('^\\s*' + label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*$');
  await page.locator(`#${dd}-menu .fp-menu-item`).filter({ hasText: re }).first().click();
}
async function newSection(page) {
  const n0 = await page.evaluate(() => document.querySelectorAll('#canvas .section-block').length);
  await page.click('.fp-btn.primary[title="새 섹션 추가"]');
  await pollTrue(page, (n) => document.querySelectorAll('#canvas .section-block').length > n, n0);
  return page.evaluate(() => window.getSelectedSection?.()?.id || [...document.querySelectorAll('#canvas .section-block')].pop()?.id);
}
async function pickSec(page, id) {
  await scrollTo(page, `[id="${id}"]`);
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
  const r = await stableTwice(page, `[id="${id}"] .section-hitzone`);
  await page.mouse.click(r.left + 20, r.cy);
  return pollTrue(page, (id) => window.getSelectedSection?.()?.id === id, id, 3000);
}

// ── 종류 표: 넣는 문 · 행위 자(성공 = 무엇이 보이나) ─────────────────────────────
// act(page, id) → { ok, pt, detail } · ok = 그 행위가 먹었다(주 단언 재료)
const editableAfterDbl = (sub) => async (page, id) => {
  const S = `[id="${id}"] ${sub}`;
  const pt = await pointAt(page, S);
  if (!pt.hitInside || !pt.inViewport) return { ok: null, pt, detail: 'miss' };
  await page.mouse.dblclick(pt.x, pt.y);
  const ok = await pollTrue(page, (id) => { const b = document.getElementById(id); const a = document.activeElement;
    return !!(b && ((a && b.contains(a) && a.isContentEditable) || b.querySelector('[contenteditable="true"]'))); }, id, 2500);
  return { ok, pt, detail: await page.evaluate((id) => { const b = document.getElementById(id); return { ce: b ? b.querySelectorAll('[contenteditable="true"]').length : null, active: document.activeElement?.className?.toString?.().slice(0, 40) || null }; }, id) };
};
const KINDS = {
  radial: { sel: '.radial-block', ins: (p) => clickMenu(p, 'fp-component', 'Radial'), door: 'menu Radial',
    act: async (page, id) => {
      const S = `[id="${id}"] .rdl-item[data-rdl-idx="1"]`; await escapeOut(page);
      const pt = await pointAt(page, S); if (!pt.hitInside || !pt.inViewport) return { ok: null, pt, detail: 'miss' };
      await page.mouse.click(pt.x, pt.y);
      await pollTrue(page, (id) => document.querySelector('#panel-right .prop-block-id')?.dataset?.copyId === id, id, 3000);
      const d = await page.evaluate((id) => { const b = document.getElementById(id); let items = null; try { items = JSON.parse(b?.dataset.items || 'null'); } catch { }
        return { sel: b ? [...b.querySelectorAll('.rdl-item.rdl-cell-selected')].map(e => Number(e.dataset.rdlIdx)) : null, lab: document.getElementById('rdl-item-label')?.value ?? null, want: items?.[1]?.label ?? null }; }, id);
      return { ok: !!(d.sel && d.sel.length === 1 && d.sel[0] === 1 && d.lab !== null && d.lab === d.want), pt, detail: d };
    } },
  // v2(핀 ×3 첫 판에서 장면 미성립 12/12): 기본 확대블럭은 shadow off 라 손잡이가 안 그려진다(zoom-geometry.js:672 handlesVisible)
  //   ⇒ 손잡이 대신 «이동 끌기»(_bindZoomMoveDrag zoom-block.js:341 · 같은 renderZoomBlock 안에서 걸림 · 선택 조건 없음) — 성공 = dataset.x/y 바뀜.
  zoom: { sel: '.zoom-block', ins: (p) => clickMenu(p, 'fp-pen', 'Zoom'), door: 'menu(pen) Zoom',
    act: async (page, id) => {
      await escapeOut(page);
      const pt = await pointAt(page, `[id="${id}"]`); if (!pt.hitInside || !pt.inViewport) return { ok: null, pt, detail: 'miss' };
      const before = await page.evaluate((id) => { const d = document.getElementById(id).dataset; return { x: d.x ?? null, y: d.y ?? null }; }, id);
      await page.mouse.move(pt.x, pt.y); await page.mouse.down(); await page.mouse.move(pt.x + 8, pt.y + 4, { steps: 3 }); await page.mouse.move(pt.x + 30, pt.y + 20, { steps: 6 }); await page.mouse.up();
      await settleNorm(page);
      const after = await page.evaluate((id) => { const d = document.getElementById(id).dataset; return { x: d.x ?? null, y: d.y ?? null }; }, id);
      return { ok: before.x !== after.x || before.y !== after.y, pt, detail: { before, after } };
    } },
  // v2: 기본 모달(variant plain)엔 아이콘 슬롯이 없다(modal-block.js:787 icon 변형만) ⇒ 넣은 뒤 패널 #mdl-variant 에서 «icon» 을 고른다(사용자 길).
  modal: { sel: '.modal-block', door: 'menu Modal → 패널 #mdl-variant=icon',
    ins: async (p) => {
      await clickMenu(p, 'fp-component', 'Modal');
      await pollTrue(p, () => [...document.querySelectorAll('.modal-block')].some(e => !e.__s5), null);
      const id = await p.evaluate(() => [...document.querySelectorAll('.modal-block')].find(e => !e.__s5)?.id || null);
      expect(id, 'P0 modal: 넣은 모달').toBeTruthy();
      await escapeOut(p);
      const bp = await pointAt(p, `[id="${id}"]`);
      expect(bp.hitInside && bp.inViewport, 'P0 modal: 모달을 맞혔다').toBe(true);
      await p.mouse.click(bp.x, bp.y);
      const panel = await pollTrue(p, () => !!document.getElementById('mdl-variant'), null, 4000);
      expect(panel, 'P0 modal: 패널 #mdl-variant').toBe(true);
      await p.selectOption('#mdl-variant', 'icon');
      const icon = await pollTrue(p, (id) => !!document.getElementById(id)?.querySelector('.mdl-icon'), id, 4000);
      expect(icon, 'P0 modal: icon 변형에 .mdl-icon').toBe(true);
    },
    act: async (page, id) => {
      await escapeOut(page);
      await page.evaluate(() => { const i = document.getElementById('iconify-search-input'); const m = i?.closest('[style*="display"]') || null; if (m) m.style.display = 'none'; });
      const S = `[id="${id}"] .mdl-icon`;
      const pt = await pointAt(page, S); if (!pt.hitInside || !pt.inViewport) return { ok: null, pt, detail: 'miss' };
      await page.mouse.click(pt.x, pt.y);
      const ok = await pollTrue(page, () => { const i = document.getElementById('iconify-search-input'); return !!(i && i.offsetParent !== null); }, null, 3000);
      await page.keyboard.press('Escape');
      return { ok, pt, detail: { pickerVisible: ok } };
    } },
  chat: { sel: '.chat-block', ins: (p) => clickMenu(p, 'fp-component', 'Chat'), door: 'menu Chat', act: async (p, id) => { await escapeOut(p); return editableAfterDbl('.chb-btext')(p, id); } },
  canvas: { sel: '.canvas-block', ins: (p) => clickMenu(p, 'fp-component', 'Card'), door: 'menu Card(addCanvasBlock)', act: async (p, id) => { await escapeOut(p); return editableAfterDbl('.cvb-card-title')(p, id); } },
  banner02: { sel: '.banner02-block', ins: (p) => clickMenu(p, 'fp-component', 'Banner 2'), door: 'menu Banner 2', act: async (p, id) => { await escapeOut(p); return editableAfterDbl('[data-line-idx]')(p, id); } },
  step: { sel: '.step-block', ins: (p) => clickMenu(p, 'fp-component', 'Step'), door: 'menu Step', act: async (p, id) => { await escapeOut(p); return editableAfterDbl('.stb-title')(p, id); } },
  comparison: { sel: '.comparison-block', ins: (p) => clickMenu(p, 'fp-component', 'Comparison'), door: 'menu Comparison', act: async (p, id) => { await escapeOut(p); return editableAfterDbl('.cmp-hd')(p, id); } },
  qa: { sel: '.qa-block', ins: (p) => p.evaluate(() => window.addQABlock()), door: 'window.addQABlock (메뉴 항목 0)',
    act: async (page, id) => {
      await escapeOut(page);
      const S = `[id="${id}"] .qa-verdict-btn[data-verdict="pass"]`;
      const pt = await pointAt(page, S); if (!pt.hitInside || !pt.inViewport) return { ok: null, pt, detail: 'miss' };
      const before = await page.evaluate((id) => document.getElementById(id)?.dataset.verdict ?? null, id);
      await page.mouse.click(pt.x, pt.y);
      await pollTrue(page, ([id, b]) => (document.getElementById(id)?.dataset.verdict ?? null) !== b, [id, before], 2500);
      const after = await page.evaluate((id) => document.getElementById(id)?.dataset.verdict ?? null, id);
      return { ok: before !== after, pt, detail: { before, after } };
    } },
  graphbar: { sel: '.graph-block', ins: (p) => clickMenu(p, 'fp-component', 'Graph'), door: 'menu Graph(기본 유형)', act: async (p, id) => { await escapeOut(p); return editableAfterDbl('.grb-bar-label, .grb-bar-h-desc, .grb-line-xlabel, .grb-pie-label')(p, id); } },
};
const K18 = ['radial', 'zoom', 'modal', 'chat', 'canvas', 'banner02', 'step', 'comparison', 'qa'];   // graph 뺀 판(지디 ③) · comparison·qa 는 회귀 칸

async function insertKind(page, k) {
  const K = KINDS[k];
  await page.evaluate((s) => document.querySelectorAll(s).forEach(e => { e.__s5 = 1; }), K.sel);
  await K.ins(page);
  await pollTrue(page, (s) => [...document.querySelectorAll(s)].some(e => !e.__s5), K.sel);
  await settleNorm(page);
  return page.evaluate((s) => [...document.querySelectorAll(s)].filter(e => !e.__s5).map(e => e.id)[0] || null, K.sel);
}
const rcStart = (page) => page.evaluate(() => { window.__rc = {}; window.__rcOn = true; });
const rcStop = (page) => page.evaluate(() => { window.__rcOn = false; return { counts: { ...window.__rc }, missing: window.__rcMissing.slice() }; });

// ── 길 4 ─────────────────────────────────────────────────────────────────────
const PATHS = {
  AB: async (page, o, k) => {   // ⒝ A/B 변형 → B 사본(_bindVariantClone :136) → B 활성
    await pickSec(page, o.A);
    const sel = `[id="${o.A}"] .section-toolbar .st-ab-btn`;
    const vis = await pollTrue(page, (s) => { const b = document.querySelector(s); return !!(b && b.offsetParent && b.getBoundingClientRect().width > 0); }, sel, 4000);
    expect(vis, 'P0 AB: A/B 단추 보임').toBe(true);
    await rcStart(page);
    await page.locator(sel).first().click({ timeout: 4000 });
    const made2 = await pollTrue(page, (id) => { const g = document.getElementById(id)?.dataset.variationGroup; return !!g && document.querySelectorAll(`.section-block[data-variation-group="${g}"]`).length === 2; }, o.A);
    await settleNorm(page); o.rc = await rcStop(page);
    expect(made2, 'P0 AB: 변형 둘').toBe(true);
    o.bId = await page.evaluate((id) => { const g = document.getElementById(id).dataset.variationGroup; return [...document.querySelectorAll(`.section-block[data-variation-group="${g}"]`)].find(s => s.dataset.variation === 'B')?.id || null; }, o.A);
    for (let i = 0; i < 3 && o.bId; i++) {
      if (await page.evaluate((c) => document.getElementById(c)?.dataset.variationActive === '1', o.bId)) break;
      try { await page.locator('#layer-panel-body .layer-variation-toggle').first().click({ timeout: 3000 }); } catch { }
      await pollTrue(page, (c) => document.getElementById(c)?.dataset.variationActive === '1', o.bId, 1500);
    }
    o.bActive = await page.evaluate((c) => document.getElementById(c)?.dataset.variationActive === '1', o.bId);
    expect(o.bActive, 'P0 AB: B 활성').toBe(true);
    return page.evaluate(([c, s]) => document.getElementById(c)?.querySelector(s)?.id || null, [o.bId, KINDS[k].sel]);
  },
  TPL: async (page, o, k) => {  // ⒞ 섹션 템플릿 저장 → 넣기(_bindInsertedTree :741) · window API
    o.door2 = 'window.saveAsTemplate/insertTemplate (템플릿 패널 문 아님)';
    const ids0 = await page.evaluate((s) => [...document.querySelectorAll(s)].map(e => e.id), KINDS[k].sel);
    const tplId = await page.evaluate(async (A) => { await window.saveAsTemplate(document.getElementById(A), 'S5 cr01', '기타', '', [], 'section'); return window.loadTemplates()[0]?.id || null; }, o.A);
    o.tplStored = await page.evaluate(([id, s]) => (window.__tplStore.get(id) || '').includes(s.slice(1)), [tplId, KINDS[k].sel]);
    expect(o.tplStored, 'P0 TPL: 템플릿에 그 종류가 들었다').toBe(true);
    await pickSec(page, o.A);
    await rcStart(page);
    await page.evaluate(async (id) => { await window.insertTemplate({ id, type: 'section', name: 'S5 cr01' }); }, tplId);
    await pollTrue(page, ([ids, s]) => [...document.querySelectorAll(s)].some(e => !ids.includes(e.id)), [ids0, KINDS[k].sel]);
    await settleNorm(page); o.rc = await rcStop(page);
    return page.evaluate(([ids, s]) => [...document.querySelectorAll(s)].map(e => e.id).filter(i => !ids.includes(i))[0] || null, [ids0, KINDS[k].sel]);
  },
  PASTE: async (page, o, k) => { // ⒟ 블럭 고름(레이어 패널 줄) → ⌘C → ⌘V (pasteClipboard → _bindPastedEl)
    await escapeOut(page);
    const row = await page.evaluate((id) => { const b = document.getElementById(id); const it = [...document.querySelectorAll('#layer-panel-body .layer-item')].find(x => x._dragTarget === b || x === b?._layerItem);
      if (!it) return null; it.scrollIntoView({ block: 'center' }); const r = it.getBoundingClientRect(); return { x: r.left + Math.min(40, r.width / 2), y: r.top + r.height / 2 }; }, o.orig);
    expect(row, 'P0 PASTE: 레이어 패널에 그 블럭 줄').toBeTruthy();
    await page.mouse.click(row.x, row.y);
    const sel = await pollTrue(page, (id) => document.getElementById(id)?.classList.contains('selected'), o.orig, 3000);
    expect(sel, 'P0 PASTE: 블럭 골라짐').toBe(true);
    const ids0 = await page.evaluate((s) => [...document.querySelectorAll(s)].map(e => e.id), KINDS[k].sel);
    await page.keyboard.press('Meta+c');
    await rcStart(page);
    await page.keyboard.press('Meta+v');
    await pollTrue(page, ([ids, s]) => [...document.querySelectorAll(s)].some(e => !ids.includes(e.id)), [ids0, KINDS[k].sel]);
    await settleNorm(page); o.rc = await rcStop(page);
    return page.evaluate(([ids, s]) => [...document.querySelectorAll(s)].map(e => e.id).filter(i => !ids.includes(i))[0] || null, [ids0, KINDS[k].sel]);
  },
  RELOAD: async (page, o, k) => { // 리로드 — ⌘S → 같은 ?project= 다시 부팅(rebindAll) · 같은 id
    await escapeOut(page);
    const s0 = await page.evaluate(() => Number(sessionStorage.getItem('s5cr:saves') || 0));
    await page.evaluate(() => { document.activeElement?.blur?.(); });
    await page.keyboard.press('Meta+s');
    const saved = await pollTrue(page, (s0) => Number(sessionStorage.getItem('s5cr:saves') || 0) > s0, s0, 20000);
    expect(saved, 'P0 RELOAD: ⌘S 가 저장소에 썼다').toBe(true);
    // 다시 부팅 — 계수기는 부팅 안 rebindAll 을 못 센다(감싸기 전에 돈다) ⇒ 리로드 칸 rc 는 «안 쟀다»로 적는다
    await gotoApp(page, o.__B);
    await pollTrue(page, (id) => !!document.getElementById(id), o.orig, 20000);
    await settleNorm(page);
    o.rc = { counts: null, note: '부팅 안 rebindAll — 계수기 감싸기 전 · 안 쟀다' };
    return page.evaluate((id) => document.getElementById(id) ? id : null, o.orig);
  },
};


module.exports = { test, expect, boot, KINDS, PATHS, save, errsOf, escapeOut, newSection, insertKind, T_MS, RUN, IDENT: () => IDENT };
