#!/usr/bin/env node
/* conv-measure — 열 때 자동 변환을 격리 앱에서 잰다. 수·크기·해시만 찍고 내용은 안 찍는다.
 *   큰 본:  node tests/tools/conv-measure.cjs big <proj.json 경로> --tree <트리> --work <임시폴더> --cdp N --mcp N [--out 결과.jsonl]
 *   복구:   node tests/tools/conv-measure.cjs recover --tree … --work … --cdp N --mcp N   (합성 표식 · 합성 그림, 원본 파일 안 씀)
 *   설정:   node tests/tools/conv-measure.cjs setting --tree … --work … --cdp N --mcp N
 * 원본은 읽기만 하고 --work 안의 사본만 쓴다. --work 는 비어 있거나 없는 폴더여야 하고, 끝나면 지운다(앱 RSS 3000MB 넘으면 멈춤).
 * ⛔이 스크립트는 ⌘C·⌘X·⌘D·copySelected 를 안 쓴다. GODITOR_QA_HIDDEN=1 필수. */
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const { spawn, execSync } = require('child_process');
const RSS_STOP_KB = 3000 * 1024;
const sha = (p) => { const h = crypto.createHash('sha256'); const fd = fs.openSync(p, 'r'); const b = Buffer.alloc(1 << 20); let n; while ((n = fs.readSync(fd, b, 0, b.length)) > 0) h.update(b.subarray(0, n)); fs.closeSync(fd); return h.digest('hex'); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* 변환 결과 대조 — 원본의 모든 data URI 를 해시 주소로 바꾼 글이 변환본과 글자까지 같은가, 에셋 바이트가 해시와 맞는가. */
function verifyConverted(tree, projectDir, id, sourcePath) {
  const X = require(path.join(tree, 'main/project-store/externalizer.js'));
  const { canvasSlots } = X._internal;
  const src = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
  const cur = JSON.parse(fs.readFileSync(path.join(projectDir, 'proj.json'), 'utf8'));
  const re = new RegExp(X.DATA_URI_RE.source, 'g');
  const seen = new Map(); let refs = 0, badAsset = 0, missing = 0;
  const a = canvasSlots(src), b = canvasSlots(cur);
  let slotsSame = a.length === b.length;
  a.forEach((s, i) => {
    const expect = s.get().replace(re, (uri) => {
      refs++;
      if (!seen.has(uri)) {
        const m = /^data:image\/([a-z0-9.+-]+);base64,(.*)$/i.exec(uri);
        const buf = Buffer.from(m[2], 'base64'); const h = crypto.createHash('sha256').update(buf).digest('hex').slice(0, 16);
        const file = path.join(projectDir, 'assets', `${h}.${X.extFromMime('image/' + m[1])}`);
        if (!fs.existsSync(file)) missing++; else if (!fs.readFileSync(file).equals(buf)) badAsset++;
        seen.set(uri, `goya-asset://${id}/${h}.${X.extFromMime('image/' + m[1])}`);
      }
      return seen.get(uri);
    });
    if (!b[i] || b[i].get() !== expect) slotsSame = false;
  });
  const left = b.reduce((n, s) => n + (s.get().match(re) || []).length, 0);
  return { imagesUnique: seen.size, refs, missing, badAsset, leftInline: left, canvasExact: slotsSame };
}

function parseArgs(argv) {
  const o = { _: [] };
  for (let i = 0; i < argv.length; i++) { if (argv[i].startsWith('--')) o[argv[i].slice(2)] = argv[++i]; else o._.push(argv[i]); }
  return o;
}

async function main() {
  const a = parseArgs(process.argv.slice(2)); const mode = a._[0]; const source = a._[1];
  for (const k of ['tree', 'work', 'cdp', 'mcp']) if (!a[k]) throw new Error(`--${k} 필수`);
  if (mode === 'big' && !source) throw new Error('큰 본 경로 필수');
  const tree = path.resolve(a.tree), work = path.resolve(a.work);
  if (fs.existsSync(work) && fs.readdirSync(work).length) throw new Error('--work 가 비어 있지 않다');
  require('../unit/_tmproot.js').trackTmp(work);   // 끝날 때 치운다
  const UD = path.join(work, 'ud'), PJ = path.join(UD, 'projects'), LOG = path.join(work, 'app.log');
  fs.mkdirSync(path.join(UD, 'home'), { recursive: true }); fs.mkdirSync(PJ, { recursive: true });
  const { chromium } = require(path.join(tree, 'node_modules/playwright-core'));
  const out = (o) => { const l = JSON.stringify({ mode, ...o }); console.log(l); if (a.out) fs.appendFileSync(a.out, l + '\n'); };
  let app = null, page = null, br = null, peak = { main: 0, renderer: 0, sum: 0 }, stopRss = false, samp = null;
  const procs = () => { try { return execSync(`ps -axo rss=,command=`, { maxBuffer: 1 << 26 }).toString().split('\n').filter((l) => l.includes(UD)); } catch (_) { return []; } };
  const up = async () => {
    const fd = fs.openSync(LOG, 'a');
    app = spawn(path.join(tree, 'node_modules/.bin/electron'), ['.', `--remote-debugging-port=${a.cdp}`, '--remote-allow-origins=*', `--user-data-dir=${UD}`, '--disable-renderer-backgrounding', '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', 'admin'],
      { cwd: tree, stdio: ['ignore', fd, fd], env: { ...process.env, HOME: path.join(UD, 'home'), GODITOR_DOWNLOADS_DIR: path.join(UD, 'home'), GODITOR_MCP_PORT: String(a.mcp), GODITOR_QA_HIDDEN: '1' } });
    for (let i = 0; i < 90; i++) { try { execSync(`curl -s -m 1 http://127.0.0.1:${a.cdp}/json/version`, { stdio: 'ignore' }); break; } catch (_) { await sleep(1000); } }
    await sleep(2500);
    br = await chromium.connectOverCDP('http://127.0.0.1:' + a.cdp); page = br.contexts()[0].pages()[0]; page.setDefaultTimeout(240000);
    samp = setInterval(() => {
      let sum = 0;
      for (const l of procs()) { const kb = parseInt(l, 10) || 0; sum += kb; const k = l.includes('--type=renderer') ? 'renderer' : l.includes('--type=') ? null : 'main'; if (k) peak[k] = Math.max(peak[k], kb); if (kb > RSS_STOP_KB) stopRss = true; }
      peak.sum = Math.max(peak.sum, sum);
    }, 250);
  };
  const down = async () => {
    clearInterval(samp); try { await Promise.race([br.close(), sleep(2000)]); } catch (_) {}
    try { app.kill('SIGTERM'); } catch (_) {} await sleep(1500);
    try { execSync(`ps -axo pid=,command= | /usr/bin/grep -F "${UD}" | /usr/bin/grep -v grep | awk '{print $1}' | xargs kill -9 2>/dev/null`); } catch (_) {}
    await sleep(800);
  };
  const open = async (id) => { await page.goto(`file://${tree}/index.html?project=${id}`, { timeout: 240000 }); await page.waitForFunction(() => typeof window.addTextBlock === 'function'); await sleep(2500); };
  const failStop = () => { if (stopRss) throw new Error('RSS 3000MB 초과 — 멈춤'); };
  const toasts = () => page.evaluate(() => document.getElementById('editor-toast')?.textContent?.slice(0, 40) || '');
  const addMark = (m) => page.evaluate((m) => { if (!document.querySelector('#canvas .section-block')) window.addSection(); const s = document.querySelector('#canvas .section-block'); window.selectSection(s); window.addTextBlock(); const b = [...s.querySelectorAll('.text-block')].pop(); (b.querySelector('[contenteditable]') || b).textContent = m; window.pushHistory('글자'); window.scheduleAutoSave(); }, m);
  const has = (p, m) => fs.readFileSync(p, 'utf8').includes(m);
  const inl = (p) => (fs.readFileSync(p, 'utf8').match(/data:image\/[a-z]+;base64/g) || []).length;
  const screen = () => page.evaluate(() => (window.getSerializedCanvas().match(/MARK-[A-Z0-9]+/g) || []).filter((v, i, x) => x.indexOf(v) === i).sort());
  try {
    if (mode === 'big') {
      const id = 'proj_conv', dir = path.join(PJ, id), proj = path.join(dir, 'proj.json');
      fs.mkdirSync(dir); const srcCopy = path.join(work, 'source.json');
      fs.copyFileSync(source, srcCopy); fs.copyFileSync(srcCopy, proj);
      const orig = sha(srcCopy), before = fs.statSync(proj).size;
      fs.writeFileSync(path.join(UD, 'settings.json'), JSON.stringify({ autoExternalizeOnOpen: false }));   // 옛 판이 저장한 false
      await up(); const t0 = Date.now(); await open(id); const openMs = Date.now() - t0; failStop();
      const line = fs.readFileSync(LOG, 'utf8').match(/\[externalize\] on-open [^:]+: (\{.*\})/);
      const r = line ? JSON.parse(line[1]) : null;
      const pre = path.join(dir, X_BACKUP(tree)); const afterSha = sha(proj); await sleep(8000); failStop();
      const v = fs.existsSync(pre) ? verifyConverted(tree, dir, id, srcCopy) : null;
      out({ at: '변환', 전바이트: before, 후바이트: fs.statSync(proj).size, 변환ms: r && r.ms, 열기ms: openMs, images: r && r.images, reused: r && r.reused, skipped: r && r.skipped, 원본보존: fs.existsSync(pre) && sha(pre) === orig, 무편집안씀: sha(proj) === afterSha, 대조: v, 토스트: await toasts(), peakMB: { main: peak.main >> 10, renderer: peak.renderer >> 10, sum: peak.sum >> 10 } });
      await page.evaluate(() => window.cancelPendingAutoSaveForReload?.(window.activeProjectId));
      const rb = await page.evaluate((id) => window.electronAPI.externalizeRollback({ projectId: id }), id);
      await open(id); await sleep(8000); failStop();
      out({ at: '되돌림', ok: rb.ok, 원본해시일치: sha(proj) === orig, 재변환안함: !fs.existsSync(pre), 원본사본남음: fs.readdirSync(dir).filter((n) => /^proj_pre-externalize\.\d+\.json$/.test(n)).some((n) => sha(path.join(dir, n)) === orig), 뒤바이트: fs.statSync(proj).size, peakMB: peak.sum >> 10 });
    } else if (mode === 'recover') {
      await up(); const btn = page.getByText('New Design', { exact: false }).first(); await btn.waitFor(); const bb = await btn.boundingBox(); await page.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2); await page.waitForURL(/index\.html/); await page.waitForFunction(() => typeof window.addTextBlock === 'function');
      const id = new URL(page.url()).searchParams.get('project'), dir = path.join(PJ, id), proj = path.join(dir, 'proj.json');
      await addMark('MARK-A'); await sleep(3000);
      const d = await page.evaluate(() => { const v = document.createElement('canvas'); v.width = 30; v.height = 20; v.getContext('2d').fillRect(0, 0, 30, 20); return v.toDataURL('image/png'); });
      const a0 = await page.evaluate(async ([d, id]) => { const m = /^data:([^;]+);base64,(.*)$/.exec(d); return (await window.electronAPI.assetsSaveCanvasImage({ projectId: id, b64: m[2], mime: m[1] })).url; }, [d, id]);
      await page.evaluate((src) => { const s = document.querySelector('#canvas .section-block'); window.selectSection(s); window.addAssetBlock('img1'); const x = [...s.querySelectorAll('.asset-block')].pop(); window.setAssetImageFromSrc(x, src); window.pushHistory('그림'); window.scheduleAutoSave(); }, a0); await sleep(5000);
      execSync(`chmod 444 "${proj}"; chmod 555 "${dir}"`);
      await addMark('MARK-C');
      for (let i = 0; i < 60; i++) { if (await page.evaluate((id) => (localStorage.getItem('web-editor-autosave__' + id) || '').includes('MARK-C'), id)) break; await sleep(300); }
      await sleep(1500);
      try { execSync(`ps -axo pid=,command= | /usr/bin/grep -F "${UD}" | /usr/bin/grep -e "--type=renderer" | /usr/bin/grep -v grep | awk '{print $1}' | xargs kill -9`); } catch (_) {}
      await sleep(1500); execSync(`chmod 755 "${dir}"; chmod 644 "${proj}"`); await down();
      const t = fs.readFileSync(proj, 'utf8').split(a0).join(d); JSON.parse(t); fs.writeFileSync(proj, t);
      const inl0 = inl(proj), upd0 = JSON.parse(t).updatedAt, pre = path.join(dir, X_BACKUP(tree));
      await up(); await open(id); await sleep(6000);
      const first = { 뜸C: (await screen()).includes('MARK-C'), 파일C: has(proj, 'MARK-C'), 변환미룸: !fs.existsSync(pre), 인라인전: inl0, 인라인: inl(proj), 판바뀜: JSON.parse(fs.readFileSync(proj, 'utf8')).updatedAt !== upd0 };
      await open(id); await sleep(4000);
      const second = { 뜸C: (await screen()).includes('MARK-C'), 파일C: has(proj, 'MARK-C'), 인라인: inl(proj), 변환전본C: fs.existsSync(pre) && has(pre, 'MARK-C') };
      const preSha = fs.existsSync(pre) ? sha(pre) : null;
      await page.evaluate(() => window.cancelPendingAutoSaveForReload?.(window.activeProjectId));
      const rb = await page.evaluate((id) => window.electronAPI.externalizeRollback({ projectId: id }), id); await open(id); await sleep(4000);
      out({ at: '복구', 첫열기: first, 둘째열기: second, 되돌림: { ok: rb.ok, 변환전본해시일치: sha(proj) === preSha, 파일C: has(proj, 'MARK-C'), 뜸C: (await screen()).includes('MARK-C') }, 살았나: first.뜸C && first.파일C && second.파일C && second.인라인 === 0 && second.변환전본C });
    } else if (mode === 'setting') {
      const fx = (id, meta) => { const dir = path.join(PJ, id); fs.mkdirSync(dir); const png = 'data:image/png;base64,' + Buffer.alloc(3000, 7).toString('base64'); fs.writeFileSync(path.join(dir, 'proj.json'), JSON.stringify({ id, name: id, version: 2, updatedAt: '2026-01-01T00:00:00.000Z', pages: [{ id: 'a', name: 'a', canvas: `<div class="section-block" id="s1"><img data-img-src="${png}"></div>` }] }, null, 2)); if (meta) fs.writeFileSync(path.join(dir, 'proj_meta.json'), meta); return path.join(dir, 'proj.json'); };
      const [p1, p2, p3, p4] = [fx('s1'), fx('s2'), fx('s3', '{"collabRef":"x"}'), fx('s4', '{잘림')];
      fs.writeFileSync(path.join(UD, 'settings.json'), JSON.stringify({ autoExternalizeOnOpen: false }));
      await up(); await open('s1'); const 옛false켜짐 = inl(p1) === 0;
      await open('s3'); const 협업보류 = inl(p3) > 0; await open('s4'); const 메타보류 = inl(p4) > 0;
      await page.evaluate(() => window.electronAPI.setSettings({ autoExternalizeOnOpen: false })); await open('s2'); const 끄기먹음 = inl(p2) > 0;
      await down(); await up(); await open('s2'); const 재시작뒤끄기 = inl(p2) > 0; const 설정값 = await page.evaluate(() => window.electronAPI.getSettings().then((s) => s.autoExternalizeOnOpen));
      await page.evaluate(() => window.electronAPI.setSettings({ autoExternalizeOnOpen: true })); await open('s2'); const 다시켜기 = inl(p2) === 0;
      out({ at: '설정', 옛false켜짐, 협업보류, 메타보류, 끄기먹음, 재시작뒤끄기, 설정값, 다시켜기 });
    } else throw new Error('모드: big | recover | setting');
  } finally { try { await down(); } catch (_) {} try { execSync(`chmod -R u+w "${work}"`); } catch (_) {} }
}
const X_BACKUP = (tree) => require(path.join(tree, 'main/project-store/externalizer.js')).BACKUP_NAME;
module.exports = { verifyConverted };
if (require.main === module) main().then(() => process.exit(0), (e) => { console.error(String(e && e.message).slice(0, 200)); process.exit(1); });
