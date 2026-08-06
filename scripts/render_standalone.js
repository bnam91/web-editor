/**
 * 독립렌더 QA 스크립트 (★독립렌더 QA트릭 정식판 — 창대 격리빌드 프로토 승격, 2026-07-03)
 *
 * 디스크 proj.json의 canvas를 에디터 CSS 링크 독립 html로 감싸 headless Chrome으로 렌더,
 * captureBeyondViewport 슬라이스 스샷을 뜬다. 스샷 자체가 "디스크 저장 프루프"를 겸한다
 * (evaluator provenance 규약의 기본 채집법 — 에디터 줌 변환(canvas-scaler)에 의한 clip 왜곡 회피).
 *
 * 사용법:
 *   node scripts/render_standalone.js <projId|proj.json경로> [--section sec_xxx] [--out <dir>]
 *                                     [--scale 0.62] [--slice 2600] [--attach-port 93XX]
 *
 *   - 기본: 자체 headless Chrome을 임시 포트(자동 할당)로 스폰 → 종료까지 책임 (포트 충돌 없음)
 *   - --attach-port: 이미 떠 있는 CDP 인스턴스에 붙어 렌더만 수행 (스폰 안 함)
 *   - --section: 해당 섹션 1개만 렌더 (기본 = 페이지 전체)
 *   - 출력: <out>/qa_01.png, qa_02.png … (기본 out = ./render_qa_<projId>)
 *
 * ⚠️ 읽기 전용 — proj.json을 절대 수정하지 않는다. 독립 html은 out 디렉토리에 생성.
 * ⚠️ 대상 proj가 에디터에 열려 있어도 안전(디스크만 읽음). 단 autosave 직후 상태를 보려면 저장 후 실행.
 */

const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
// ws는 레포 dependencies. 특정 맥의 클론 경로를 하드코딩하면 다른 맥·worktree에서 죽는다.
const WebSocket = require('ws');

const WE = path.resolve(__dirname, '..');
// app.name='GODITOR'(main.js)이 userData 경로를 결정한다. 구 'Goya Design Editor'
// 폴더는 main.js의 _migrateUserDataDir가 'GODITOR'로 rename해 더 이상 존재하지 않는다.
const PROJ_DIR = `${process.env.HOME}/Library/Application Support/GODITOR/projects`;
const CHROME = process.env.CHROME_BIN || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const CSS = ['design-tokens.css', 'editor-base.css', 'editor-layout.css', 'editor-canvas.css',
             'editor-blocks.css', 'editor-graph.css', 'editor-extra.css'];

// ---- args ----
const args = process.argv.slice(2);
function flag(name, dflt) { const i = args.indexOf(name); return i !== -1 ? args[i + 1] : dflt; }
const SECTION = flag('--section', null);
const SCALE = parseFloat(flag('--scale', '0.62'));
const SLICE = parseInt(flag('--slice', '2600'), 10);
const ATTACH = flag('--attach-port', null);
const target = args.find((a, i) => !a.startsWith('--') && (i === 0 || !args[i - 1].startsWith('--')));
if (!target) {
  console.error('usage: node scripts/render_standalone.js <projId|proj.json경로> [--section sec_xxx] [--out dir] [--scale 0.62] [--slice 2600] [--attach-port 93XX]');
  process.exit(1);
}
const projPath = target.endsWith('.json') ? target : `${PROJ_DIR}/${target}/proj.json`;
if (!fs.existsSync(projPath)) { console.error(`❌ proj.json 없음: ${projPath}`); process.exit(1); }
const proj = JSON.parse(fs.readFileSync(projPath, 'utf8'));
const projId = proj.id || path.basename(path.dirname(projPath));
const OUT = path.resolve(flag('--out', `./render_qa_${projId}`));
fs.mkdirSync(OUT, { recursive: true });

// ---- 1) 독립 html 빌드 ----
function extractSection(canvas, secId) {
  const startRe = /<div class="section-block/g;
  let m;
  while ((m = startRe.exec(canvas))) {
    const head = canvas.slice(m.index, m.index + 600);
    if (!head.includes(`id="${secId}"`)) continue;
    let depth = 0;
    const tokRe = /<div\b|<\/div>/g;
    tokRe.lastIndex = m.index;
    let t;
    while ((t = tokRe.exec(canvas))) {
      depth += t[0] === '</div>' ? -1 : 1;
      if (depth === 0) return canvas.slice(m.index, tokRe.lastIndex);
    }
  }
  return null;
}

let body = proj.pages?.[0]?.canvas || '';
if (!body) { console.error('❌ pages[0].canvas 비어 있음'); process.exit(1); }
if (SECTION) {
  body = extractSection(body, SECTION);
  if (!body) { console.error(`❌ 섹션 없음: ${SECTION}`); process.exit(1); }
}
// goya-asset:// → 디스크 assets 경로 (커스텀 스킴은 file:// 페이지에서 안 뜸)
body = body.split(`goya-asset://${projId}/`).join(`file://${PROJ_DIR}/${projId}/assets/`);

const links = CSS.map(c => `<link rel="stylesheet" href="file://${WE}/css/${c}">`).join('\n');
const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="file://${WE}/assets/fonts/pretendard.css">
${links}
<style>
  body{margin:0;background:#fff}
  #canvas{width:848px;margin:0 auto;position:relative}
  /* 에디터 크롬 숨김 — 순수 캔버스 렌더 */
  .section-toolbar,.section-hitzone,.section-label{display:none!important}
</style></head><body><div id="canvas">${body}</div></body></html>`;
const htmlPath = `${OUT}/_standalone_${projId}${SECTION ? '_' + SECTION : ''}.html`;
fs.writeFileSync(htmlPath, html);

// ---- 2) CDP 렌더 ----
const delay = ms => new Promise(r => setTimeout(r, ms));

function getJson(port) {
  return new Promise((res, rej) => {
    http.get(`http://127.0.0.1:${port}/json`, r => {
      let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d)));
    }).on('error', rej);
  });
}

function spawnChrome() {
  return new Promise((res, rej) => {
    const udd = fs.mkdtempSync('/tmp/render_standalone_');
    // arch -arm64 강제: Rosetta 쉘에서 스폰돼도 네이티브로 (무거운 페이지 렌더 멈춤 방지)
    const ch = spawn('arch', ['-arm64', CHROME, '--headless=new', '--disable-gpu',
      '--remote-debugging-port=0', `--user-data-dir=${udd}`,
      '--allow-file-access-from-files', '--hide-scrollbars', 'about:blank']);
    let err = '';
    const onData = d => {
      err += d;
      const m = err.match(/DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)\//);
      if (m) { ch.stderr.off('data', onData); res({ proc: ch, port: parseInt(m[1], 10), udd }); }
    };
    ch.stderr.on('data', onData);
    ch.on('exit', c => rej(new Error(`chrome 조기 종료(${c}): ${err.slice(-300)}`)));
    setTimeout(() => rej(new Error('chrome 부팅 타임아웃')), 15000);
  });
}

(async () => {
  let proc = null, udd = null, port = ATTACH;
  if (!ATTACH) ({ proc, port, udd } = await spawnChrome());

  try {
    const pages = await getJson(port);
    const page = pages.find(p => p.type === 'page');
    if (!page) throw new Error('CDP page 타겟 없음');
    // Origin 헤더를 보내면 Chrome이 403으로 거부 — 옵션 없이 연결 (Electron attach 시에도 무해)
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    let id = 1; const pend = new Map();
    ws.on('message', d => {
      const m = JSON.parse(d);
      if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); }
    });
    const send = (meth, p = {}) => new Promise((res, rej) => {
      const i = id++; pend.set(i, { res, rej });
      ws.send(JSON.stringify({ id: i, method: meth, params: p }));
      setTimeout(() => { if (pend.has(i)) { pend.delete(i); rej(new Error('timeout ' + meth)); } }, 30000);
    });
    const ev = e => send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })
      .then(m => { if (m.exceptionDetails) throw new Error(m.exceptionDetails.text); return m.result?.value; });
    await new Promise(r => ws.on('open', r));
    await send('Page.enable');
    await send('Page.navigate', { url: `file://${htmlPath}` });
    await delay(1500);
    await ev('(async()=>{ try{ await document.fonts.ready; }catch(e){} })()');
    await delay(500);
    await send('Emulation.setDeviceMetricsOverride', { width: 848, height: 1200, deviceScaleFactor: 1, mobile: false });
    await delay(400);

    const h = await ev('document.getElementById("canvas").getBoundingClientRect().height');
    const nsec = await ev('document.querySelectorAll(".section-block").length');
    console.log(`canvas height ${Math.round(h)}px, sections ${nsec}`);
    if (!h) throw new Error('canvas 렌더 실패(height 0)');

    const parts = Math.ceil(h / SLICE);
    const prefix = SECTION ? SECTION : 'qa';
    for (let i = 0; i < parts; i++) {
      const cy = i * SLICE, chH = Math.min(SLICE, h - cy);
      const r = await send('Page.captureScreenshot', {
        format: 'png', captureBeyondViewport: true,
        clip: { x: 0, y: cy, width: 848, height: chH, scale: SCALE },
      });
      if (!r?.data) { console.error(`⚠️ slice ${i + 1} 데이터 없음`); continue; }
      const f = `${OUT}/${prefix}_${String(i + 1).padStart(2, '0')}.png`;
      fs.writeFileSync(f, Buffer.from(r.data, 'base64'));
      console.log(`slice ${i + 1}/${parts} → ${f}`);
    }
    ws.close();
    console.log(`✅ 렌더 완료 → ${OUT}`);
  } finally {
    if (proc) {
      const exited = new Promise(r => { proc.once('exit', r); setTimeout(r, 3000); });
      proc.kill();
      await exited; // chrome이 프로필 쓰기를 마치기 전 rm하면 ENOTEMPTY 레이스
      if (udd) fs.rmSync(udd, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    }
  }
})().catch(e => { console.error('❌', e.message); process.exit(1); });
