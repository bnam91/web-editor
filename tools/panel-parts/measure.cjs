/* tools/panel-parts/measure.cjs — 부품 카탈로그 v2 측정(탑 261123 · 레드팀 2차 ① «남이 돌릴 수 있게 · sha 를 json 안에»).
 *   node tools/panel-parts/measure.cjs app  <out.json>                  — 이 레포 작업 트리를 DOM 하네스(bootApp)로: 로스터 전 블럭 + 페이지·섹션·프레임
 *   node tools/panel-parts/measure.cjs mock <out.json> <panel-redesign.html> — 시안 파일의 시안A(v117a) 75상태
 * 판정기 = tools/panel-parts/det.js 한 벌(두 쪽 똑같이) · 기본 항목 = js/props/_section-spec.js SECTION_DEFAULTS. 헤드리스 한 개 · DOM 묶음 게이트(srv swap) 는 부르는 쪽이 지킨다. */
const fs = require('fs'), path = require('path'), vm = require('vm'), { execSync } = require('child_process');
const ROOT = path.resolve(__dirname, '../..');
const { chromium } = require(path.join(ROOT, 'node_modules/playwright'));
const [mode, out, mockFile] = process.argv.slice(2);
const det = fs.readFileSync(path.join(__dirname, 'det.js'), 'utf8');
const specSrc = fs.readFileSync(path.join(ROOT, 'js/props/_section-spec.js'), 'utf8').replace(/^export /gm, '');
const ctx = {}; vm.createContext(ctx); vm.runInContext(specSrc + '\n;globalThis.__d = JSON.parse(JSON.stringify(SECTION_DEFAULTS));', ctx);
const DEFAULTS = ctx.__d;
const sha = (dir, only) => { try { return execSync('git -C "' + dir + '" rev-parse --short HEAD').toString().trim() + (execSync('git -C "' + dir + '" status --porcelain' + (only ? ' -- "' + only + '"' : ' -- js css index.html tools')).toString().trim() ? '+dirty' : ''); } catch (e) { return '?'; } };   // dirty = 잰 것(앱 js·css·html·tools / 시안 파일 하나)만 본다
(async () => {
  const b = await chromium.launch(); const res = { mode, run: new Date().toISOString(), defaults: DEFAULTS, items: [] };
  try {
    const page = await b.newPage({ viewport: { width: 1500, height: 1100 } });
    if (mode === 'app') {
      res.sha = sha(ROOT);
      const { bootApp } = require(path.join(ROOT, 'tests/dom/_root-harness.js'));
      const { addKind } = require(path.join(ROOT, 'tests/dom/_block-roster-294.js'));
      const { resolveRoster } = require(path.join(ROOT, 'tests/dom/_panel-sections.js'));
      await bootApp(page); await page.addScriptTag({ content: det });
      await page.evaluate(async () => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); await window.addSection(); const sec = c.querySelector('.section-block'); window.__secEl = () => sec; });
      const read = () => page.evaluate((D) => window.__partsDet(document.querySelector('#panel-right .panel-body'), D), DEFAULTS);
      for (const k of await resolveRoster(page)) { if (!k.entryOk) { res.items.push({ who: k.cls, err: 'no-entry' }); continue; } const r = await addKind(page, k); if (r.err) { res.items.push({ who: k.cls, err: r.err }); continue; } await page.evaluate((id) => window.selectBlock(id), r.id); await page.waitForTimeout(120); res.items.push({ who: k.cls, secs: await read() }); }
      const MAN = { page: () => { window.deselectAll?.(); window.showPageProperties(); }, section: () => { window.deselectAll?.(); window.selectSection(window.__secEl()); },
        frame: () => { window.deselectAll?.(); const s = window.__secEl(); window.selectSection(s); window.addFrameBlock(); const f = [...s.querySelectorAll('.frame-block:not([data-text-frame])')].pop(); window.deselectAll?.(); f.classList.add('selected'); window.showFrameProperties(f); } };
      for (const [name, fn] of Object.entries(MAN)) { try { await page.evaluate(fn); await page.waitForTimeout(150); res.items.push({ who: name, secs: await read() }); } catch (e) { res.items.push({ who: name, err: String(e.message).slice(0, 100) }); } }
    } else if (mode === 'mock') {
      res.sha = sha(path.dirname(mockFile), path.basename(mockFile)); res.file = path.basename(mockFile);
      await page.goto('file://' + mockFile + '#cols=v117a,none,none&s=01'); await page.waitForTimeout(3000);
      const states = await page.evaluate(() => { const big = [...document.querySelectorAll('select')].sort((x, y) => y.options.length - x.options.length)[0]; return [...big.options].filter((o) => /^\d\d$/.test(o.value)).map((o) => [o.value, o.textContent.trim()]); });
      for (const [n, label] of states) {
        await page.goto('file://' + mockFile + '#cols=v117a,none,none&s=' + n); await page.reload(); await page.waitForTimeout(900); await page.addScriptTag({ content: det });
        const secs = await page.evaluate((D) => { const body = [...document.querySelectorAll('.panel-body')].find((x) => x.getClientRects().length && !x.closest('.mk116-canvas')); return window.__partsDet(body, D); }, DEFAULTS);
        res.items.push({ who: n, label, kind: (label.match(/·\s*([a-z0-9-]+)/) || [])[1] || '', secs });
      }
    } else throw new Error('mode = app | mock');
  } finally { await b.close(); }
  fs.writeFileSync(out, JSON.stringify(res, null, 1));
  console.log(mode, res.sha, res.items.length, 'items', 'err:', res.items.filter((x) => x.err).map((x) => x.who + ':' + x.err).join(' | ') || 0);
})();
