/**
 * 이미지 픽셀 밴드 스캔 — planner(실측 4칙)/evaluator(스캔 Δ 판정) 표준 도구
 * (engine/band_scan_snippet.js 정식 승격, 2026-07-04. 실전 검증: 창대 sec01 —
 *  눈짐작 fs104/슬롯500 → 스캔 fs72/슬롯300 교정)
 *
 * 원본 상세페이지 이미지에서 텍스트/영역 밴드(y시작·높이·가로폭)를 픽셀 스캔으로 실측하고
 * 860px 캔버스 기준 환산치를 JSON으로 출력한다.
 *
 * 사용법:
 *   node scripts/measure_image_bands.js --image <경로> [--invert] [--threshold 170]
 *                                       [--canvas-width 860] [--min-band 10] [--min-count 40]
 *
 *   --image        스캔할 이미지 파일 경로 (필수)
 *   --invert       라이트 배경(어두운 글자) 이미지용 — 임계 반전(g < threshold, 기본 85)
 *   --threshold    밝기 임계값 (기본: 다크 배경 170 / --invert 시 85)
 *   --canvas-width 환산 기준 캔버스 폭 (기본 860)
 *   --min-band     밴드 최소 높이 px (기본 10 — 노이즈 컷)
 *   --min-count    행이 '밝다'로 판정될 최소 픽셀 수 (기본 40)
 *
 * 출력(JSON, stdout):
 *   { W, H, k,                          // 원본 크기 · 환산 스케일 k = canvasWidth / W
 *     bands: [{ y, h, w,                // 원본 px 실측 (y시작, 밴드높이, 콘텐츠 가로폭)
 *               yK, hK, wK,             // ×k 환산 (캔버스 px)
 *               gapAfterK,              // 다음 밴드까지 갭 ×k (마지막 밴드는 null)
 *               fsFromH }] }            // 한글 기준 fs 추정 = hK (밴드h ≈ fs×1.0±0.1)
 *
 * ── 환산 공식 (planner 실측 4칙 참조) ──
 *   fs(텍스트) ≈ wK ÷ (글자수 + 공백수×0.35) ÷ 0.98   ← 폭 기반(신뢰). fsFromH와 교차검증
 *   갭(블록 간) = gapAfterK / 이미지 영역 높이 = 연속 블록 밴드 hK
 *
 * headless Chrome을 자체 스폰(--remote-debugging-port=0 자동 할당 — 포트 충돌 없음)하며
 * 종료 시 임시 프로필까지 정리한다. render_standalone.js와 동일 패턴.
 */

const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('/Users/a1/web-editor/node_modules/ws');

const CHROME = process.env.CHROME_BIN || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const args = process.argv.slice(2);
function flag(name, dflt) { const i = args.indexOf(name); return i !== -1 ? args[i + 1] : dflt; }
const has = (name) => args.includes(name);

const IMAGE = flag('--image', null);
if (!IMAGE || !fs.existsSync(IMAGE)) {
  console.error('❌ --image <경로> 필수 (존재하는 이미지 파일)');
  console.error('usage: node scripts/measure_image_bands.js --image <경로> [--invert] [--threshold 170] [--canvas-width 860]');
  process.exit(1);
}
const INVERT = has('--invert');
const THRESHOLD = parseInt(flag('--threshold', INVERT ? '85' : '170'), 10);
const CANVAS_W = parseInt(flag('--canvas-width', '860'), 10);
const MIN_BAND = parseInt(flag('--min-band', '10'), 10);
const MIN_COUNT = parseInt(flag('--min-count', '40'), 10);
const imgUrl = 'file://' + path.resolve(IMAGE);

function getJson(port) {
  return new Promise((res, rej) => {
    http.get(`http://127.0.0.1:${port}/json`, r => {
      let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d)));
    }).on('error', rej);
  });
}

function spawnChrome() {
  return new Promise((res, rej) => {
    const udd = fs.mkdtempSync('/tmp/measure_bands_');
    // arch -arm64 강제: Rosetta 쉘에서 스폰돼도 네이티브로
    const ch = spawn('arch', ['-arm64', CHROME, '--headless=new', '--disable-gpu',
      '--remote-debugging-port=0', `--user-data-dir=${udd}`,
      '--allow-file-access-from-files', 'about:blank']);
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

// 페이지 안에서 실행될 스캔 함수 (band_scan_snippet.js 검증본 + 파라미터화)
const SCAN_FN = `(async (IMG_URL, TH, INVERT, MIN_BAND, MIN_COUNT) => {
  const img = new Image();
  await new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error('이미지 로드 실패')); img.src = IMG_URL; });
  const W = img.naturalWidth, H = img.naturalHeight;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const cx = cv.getContext('2d'); cx.drawImage(img, 0, 0);
  const d = cx.getImageData(0, 0, W, H).data;
  const hit = (i) => { const g = (d[i] + d[i+1] + d[i+2]) / 3; return INVERT ? g < TH : g > TH; };
  const margin = Math.min(40, Math.floor(W * 0.05));
  const rowCount = y => { let n = 0; for (let x = margin; x < W - margin; x++) { if (hit((y * W + x) * 4)) n++; } return n; };
  const bands = []; let s = null;
  for (let y = 0; y < H; y += 2) {
    const b = rowCount(y);
    if (b > MIN_COUNT && s === null) s = y;
    else if (b <= MIN_COUNT && s !== null) { if (y - s >= MIN_BAND) bands.push([s, y, y - s]); s = null; }
  }
  if (s !== null && H - s >= MIN_BAND) bands.push([s, H, H - s]);
  const widths = bands.map(([a, b]) => { let mn = W, mx = 0;
    for (let y = a; y < b; y += 3) for (let x = margin; x < W - margin; x += 2) {
      if (hit((y * W + x) * 4)) { if (x < mn) mn = x; if (x > mx) mx = x; } }
    return Math.max(0, mx - mn); });
  return JSON.stringify({ W, H, bands: bands.map((b, i) => ({ y: b[0], h: b[2], w: widths[i] })) });
})`;

(async () => {
  const { proc, port, udd } = await spawnChrome();
  try {
    const pages = await getJson(port);
    const page = pages.find(p => p.type === 'page');
    if (!page) throw new Error('CDP page 타겟 없음');
    const ws = new WebSocket(page.webSocketDebuggerUrl); // Origin 헤더 있으면 Chrome이 403
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
    await new Promise(r => ws.on('open', r));

    // about:blank(origin null)는 file:// 이미지 로드 불가 — file:// 페이지로 이동 후 스캔
    // (--allow-file-access-from-files는 file→file만 허용)
    const hostHtml = path.join(udd, '_scan_host.html');
    fs.writeFileSync(hostHtml, '<!DOCTYPE html><html><body></body></html>');
    await send('Page.enable');
    await send('Page.navigate', { url: 'file://' + hostHtml });
    await new Promise(r => setTimeout(r, 800));

    const expr = `${SCAN_FN}(${JSON.stringify(imgUrl)}, ${THRESHOLD}, ${INVERT}, ${MIN_BAND}, ${MIN_COUNT})`;
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error('스캔 실패: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
    const raw = JSON.parse(r.result.value);

    const k = CANVAS_W / raw.W;
    const round1 = v => Math.round(v * 10) / 10;
    const bands = raw.bands.map((b, i) => {
      const next = raw.bands[i + 1];
      return {
        y: b.y, h: b.h, w: b.w,
        yK: round1(b.y * k), hK: round1(b.h * k), wK: round1(b.w * k),
        gapAfterK: next ? round1((next.y - (b.y + b.h)) * k) : null,
        fsFromH: Math.round(b.h * k),
      };
    });
    console.log(JSON.stringify({ W: raw.W, H: raw.H, k: round1(k * 1000) / 1000, threshold: THRESHOLD, invert: INVERT, bands }, null, 1));
    ws.close();
  } finally {
    const exited = new Promise(r => { proc.once('exit', r); setTimeout(r, 3000); });
    proc.kill();
    await exited; // 프로필 쓰기 완료 전 rm하면 ENOTEMPTY 레이스
    fs.rmSync(udd, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
})().catch(e => { console.error('❌', e.message); process.exit(1); });
