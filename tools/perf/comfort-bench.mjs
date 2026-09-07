#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════
   goditor «쾌적성» 계측 하네스 (팬/스크롤/줌)

   이 하네스는 «고치는 도구»가 아니라 «재는 자»다. 제품 코드를 한 줄도 안 건드린다.
   같은 자를 맥과 윈도우(미니4호기)에 대고 재야 「우리 코드가 느린 것」과
   「그 기계가 느린 것」이 갈린다 — 한쪽 숫자만으로는 못 가른다.

   재는 것(조건 조합마다):
     ① 팬 프레임시간 분포   p50 / p95 / 최대
     ② 드랍 프레임 비율     16.7ms 초과 프레임 %
     ③ 입력→반영 지연       휠 이벤트 timeStamp → 좌표가 «실제로» 바뀐 첫 프레임 (ms)
     ④ 줌 계단              휠 한 노치당 배율 증분 (%p)
     ⑤ 세로 스크롤          ①~③ 을 세로 축으로 (코드 경로가 다르다)

   조건: 문서무게 2단(가벼움/무거움) × 배율 3단(40/100/200)

   ⛔측정 규약
     · 첫 회차는 버린다(JIT·레이아웃 캐시). --warmup 회차 수를 보고에 적는다.
     · 창이 hidden 이면 rAF 는 0Hz 다 → 시작 전과 매 측정마다 확인하고, hidden 이면 무효 처리.
     · DPR 은 «가정»하지 않는다 — 스크린샷 높이 / innerHeight 로 실측한다.
     · 입력은 CDP Input.dispatchMouseEvent 로 «진짜» 주입한다(합성 이벤트 금지).
     · 좌표가 실제로 안 바뀐 회차는 «무효»로 표시한다(입력이 먹히지 않은 것을 통과시키지 않는다).

   사용:
     node tools/perf/comfort-bench.mjs --port=9390 --label="mac flags-on" --out=/tmp/mac.json
   ═══════════════════════════════════════════════════════════════════ */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { connect, sleep, wheel, moveWindowOffscreen } from './cdp-lite.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROBE = fs.readFileSync(path.join(HERE, 'probe.js'), 'utf8');

// ── 인자 ──────────────────────────────────────────────
const A = Object.fromEntries(process.argv.slice(2).map(s => {
  const m = /^--([^=]+)(?:=(.*))?$/.exec(s);
  return m ? [m[1], m[2] === undefined ? true : m[2]] : [s, true];
}));
const PORT = A.port;
if (!PORT) { console.error('usage: comfort-bench.mjs --port=9390 [--label=..] [--out=x.json] [--repeats=3] [--warmup=1]'); process.exit(1); }
const MATCH    = A.match || 'index.html';
const LABEL    = A.label || `port${PORT}`;
const REPEATS  = +(A.repeats || 3);
const WARMUP   = +(A.warmup || 1);
const ZOOMS    = String(A.zooms || '40,100,200').split(',').map(Number);
const DOCS     = String(A.docs  || 'light,heavy').split(',');
const DOC_N    = { light: +(A.light || 3), heavy: +(A.heavy || 14) };
const PAN_N    = +(A['pan-events'] || 120);
const PAN_IV   = +(A['pan-interval'] || 8);
const PAN_MAG  = +(A['pan-mag'] || 50);
const LAT_K    = +(A['latency-notches'] || 8);
const OUT      = A.out || '';

let DROP_T2 = 25;   // 주사율 실측 뒤 «측정된 프레임주기 × 1.5» 로 덮어쓴다
const nowISO = () => new Date().toISOString();
const num = (v, w = 6) => String(v == null ? '-' : v).padStart(w);

// ── 통계 ──────────────────────────────────────────────
const med = a => { const s = a.filter(x => x != null).slice().sort((x, y) => x - y); return s.length ? +s[Math.floor(s.length / 2)].toFixed(2) : null; };
const mean = a => { const s = a.filter(x => x != null); return s.length ? +(s.reduce((p, c) => p + c, 0) / s.length).toFixed(2) : null; };
const sd = a => { const s = a.filter(x => x != null); if (s.length < 2) return null; const m = s.reduce((p, c) => p + c, 0) / s.length; return +Math.sqrt(s.reduce((p, c) => p + (c - m) ** 2, 0) / (s.length - 1)).toFixed(2); };

// ── 측정 단위 ─────────────────────────────────────────
async function burst(cdp, c, { axis, n, interval, mag, chunk = 40 }) {
  await cdp.ev('window.__pb.start(false)');
  const t0 = Date.now();
  let sign = 1;
  for (let i = 0; i < n; i++) {
    if (i && i % chunk === 0) sign = -sign;   // 스크롤 끝에 박혀 «안 움직이는» 회차를 피한다
    await wheel(cdp, { x: c.x, y: c.y, dx: axis === 'x' ? sign * mag : 0, dy: axis === 'y' ? sign * mag : 0 });
    if (interval) await sleep(interval);
  }
  const wall = Date.now() - t0;
  await sleep(150);
  const r = await cdp.ev(`window.__pb.stop(${DROP_T2})`);
  return { ...r, wall, dispatched: n, valid: r.coordChanges > n * 0.2 && !r.hiddenSeen };
}

async function idle(cdp, ms = 1500) {
  await cdp.ev('window.__pb.start(false)');
  await sleep(ms);
  return cdp.ev(`window.__pb.stop(${DROP_T2})`);
}

/** 입력→반영 지연. 단발 노치 K 회 — 버스트로 재면 «앞 프레임에 묻어가는» 값이 나온다.
 *  ★앞 단계의 «정착»을 먼저 빼낸다: 휠 핸들러는 마지막 휠에서 200ms 뒤에 shrinkPanRoom() 을
 *    돌리고(editor.js scheduleWheelSettle), 그게 좌표를 «스스로» 한 번 더 움직인다.
 *    안 빼내면 첫 표본이 그 타이머와 섞여 ~250ms 로 튄다(2026-09-06 실측: 18회 중 14회가 첫 표본). */
async function latency(cdp, c, { axis, k, mag }) {
  await sleep(450);
  await cdp.ev('window.__pb.start(true)');
  for (let i = 0; i < k; i++) {
    await cdp.ev('window.__pb.arm()');
    await sleep(60);
    const s = i % 2 ? -1 : 1;
    await wheel(cdp, { x: c.x, y: c.y, dx: axis === 'x' ? s * mag : 0, dy: axis === 'y' ? s * mag : 0 });
    await sleep(220);
  }
  const r = await cdp.ev(`window.__pb.stop(${DROP_T2})`);
  return { samples: r.lat, p50: med(r.lat), p95: r.lat.length ? +r.lat.slice().sort((a, b) => a - b)[Math.min(r.lat.length - 1, Math.floor(r.lat.length * 0.95))].toFixed(2) : null, max: r.lat.length ? Math.max(...r.lat) : null, got: r.lat.length, want: k, hiddenSeen: r.hiddenSeen };
}

/** 줌 계단 — 휠 «한 노치» 당 배율이 몇 %p 뛰나. 노치 사이를 넉넉히 벌려(스로틀 16ms) 합산을 막는다. */
async function zoomLadder(cdp, c, { deltaY, from = 100, notches = 5 }) {
  await cdp.ev(`window.applyZoom(${from})`);
  await sleep(350);
  const seq = [await cdp.ev('window.currentZoom')];
  for (let i = 0; i < notches; i++) {
    await wheel(cdp, { x: c.x, y: c.y, dy: deltaY, ctrl: true });
    await sleep(300);
    seq.push(await cdp.ev('window.currentZoom'));
  }
  const steps = seq.slice(1).map((v, i) => +(v - seq[i]).toFixed(2));
  return { deltaY, from, seq, steps };
}

/* 문서 무게를 «만든다». 섹션만 늘리면 무거움이 안 된다 —
   빈 섹션 14개는 DOM 266노드밖에 안 돼서(실측) 가벼움과 사실상 같은 조건이 된다.
   ⇒ 무거움은 섹션마다 블록 묶음(텍스트2·표·구분선·아이콘텍스트·인포카드·그래프·스텝·라벨그룹)을 심는다.
   ★블록 추가는 «선택된 섹션»에 들어가므로 setup 단계에서 sec.click() 을 쓴다.
     이건 «준비»지 «측정»이 아니다 — 성능 판정 입력은 전부 CDP 진짜 주입이다. */
const HEAVY_FNS = ['addTextBlock','addTextBlock','addTableBlock','addDividerBlock','addIconTextBlock','addInfoCardBlock','addGraphBlock','addStepBlock','addLabelGroupBlock'];
async function setDoc(cdp, n, fill) {
  await cdp.ev(`(()=>{
    const cv=document.getElementById('canvas');
    const cnt=()=>cv.querySelectorAll('.section-block').length;
    let g=0;
    while(cnt()<${n} && g++<120) window.addSection();
    while(cnt()>${n} && g++<400){ const list=cv.querySelectorAll('.section-block'); if(!window.deleteSection(list[list.length-1])) break; }
    return cnt();
  })()`);
  await sleep(400);
  if (fill) {
    await cdp.ev(`(()=>{
      const secs=[...document.querySelectorAll('#canvas .section-block')];
      const fns=${JSON.stringify(HEAVY_FNS)};
      for(const s of secs){ for(const f of fns){ try{ s.click(); window[f] && window[f](); }catch(e){} } }
      window.deselectAll && window.deselectAll();
      return 1;
    })()`);
    await sleep(1200);
  }
  await cdp.ev('window.deselectAll && window.deselectAll()');
  await sleep(200);
  return cdp.ev('window.__pb.env()');
}

// ── 본체 ──────────────────────────────────────────────
const out = { label: LABEL, port: PORT, startedAt: nowISO(), node: process.version, platform: process.platform, config: { REPEATS, WARMUP, ZOOMS, DOCS, DOC_N, PAN_N, PAN_IV, PAN_MAG, LAT_K }, invalid: [], conditions: [], zoom: {} };
const cdp = await connect(PORT, MATCH);
out.targetUrl = cdp.target.url;

const inst = await cdp.ev(PROBE);
if (inst === 'NO-CANVAS') { console.error('⛔#canvas-wrap/#canvas-scaler 가 없다 — 에디터 페이지가 아니다'); process.exit(3); }

// 창을 화면 밖으로 (현빈 실사용 맥 — 창이 앞으로 튀면 안 된다)
if (!A['no-move']) out.windowMove = await moveWindowOffscreen(PORT, -2400, 0, MATCH);

// ★hidden 이면 rAF 는 0Hz — 재기 전에 막는다
let env = await cdp.ev('window.__pb.env()');
out.env0 = env;
if (env.vis !== 'visible') { console.error('⛔visibilityState=' + env.vis + ' — rAF 가 0Hz 다. 이 상태로 잰 숫자는 전부 거짓말이다.'); process.exit(4); }

// ★DPR 은 «가정»하지 않는다 — 스크린샷 높이 / innerHeight
{
  const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
  const b = Buffer.from(shot.result.data, 'base64');
  const h = b.readUInt32BE(20), w = b.readUInt32BE(16);   // PNG IHDR
  out.dpr = { measured: +(h / env.innerH).toFixed(3), reported: env.dprReported, shot: { w, h }, inner: { w: env.innerW, h: env.innerH } };
}

// 화면 주사율 — 「16.7ms 초과 = 드랍」이 이 기계에서 말이 되는지부터 본다
// ★첫 유휴는 버린다 — 기동 직후엔 아직 로딩·컴파일이 돌아 49Hz 처럼 보인다(실측 2026-09-06:
//   버리기 전 20.3ms → 버린 뒤 16.7ms. 이 값이 드랍 임계를 정하므로 오염되면 표 전체가 흔들린다).
{
  await idle(cdp, 1200);
  const i = await idle(cdp, 2000);
  out.refresh = { framePeriodP50: i.p50, hz: i.p50 ? +(1000 / i.p50).toFixed(1) : null, idle: i };
  /* ★「16.7ms 초과 = 드랍」은 «60Hz 화면에서만» 참이다. 유휴 프레임주기를 먼저 재고,
     그 1.5배를 «진짜 놓친 프레임» 임계로 같이 보고한다(둘 다 표에 남긴다). */
  if (i.p50) DROP_T2 = +(i.p50 * 1.5).toFixed(1);
  out.dropThresholds = { fixed: 16.7, refreshBased: DROP_T2 };
}

const c = await cdp.ev('window.__pb.center()');
out.center = c;

// ── 줌 계단 (문서 가벼움·배율 100 에서 1회) ──
await setDoc(cdp, DOC_N.light, false);
for (const [k, dy] of [['wheel-100-in', -100], ['wheel-100-out', 100], ['wheel-120-in', -120], ['trackpad-10-in', -10], ['trackpad-3-in', -3]]) {
  out.zoom[k] = await zoomLadder(cdp, c, { deltaY: dy, from: 100, notches: 5 });
  console.error(`[zoom] ${k.padEnd(16)} ${JSON.stringify(out.zoom[k].seq)}  계단=${JSON.stringify(out.zoom[k].steps)}`);
}
await cdp.ev('window.applyZoom(100)');

// ── 조건 조합 ──
for (const doc of DOCS) {
  const w = await setDoc(cdp, DOC_N[doc], doc === 'heavy');
  console.error(`[doc] ${doc}: 섹션 ${w.sections} · DOM ${w.domNodes}노드 · 캔버스높이 ${w.canvasH}px`);
  for (const z of ZOOMS) {
    await cdp.ev(`window.applyZoom(${z})`);
    await sleep(500);
    const cond = { doc, sections: w.sections, weight: { domNodes: w.domNodes, canvasH: w.canvasH, blocks: w.blocks }, zoom: z, reps: [] };
    for (let r = 0; r < WARMUP + REPEATS; r++) {
      const warm = r < WARMUP;
      const pan    = await burst(cdp, c, { axis: 'x', n: PAN_N, interval: PAN_IV, mag: PAN_MAG });
      const scroll = await burst(cdp, c, { axis: 'y', n: PAN_N, interval: PAN_IV, mag: PAN_MAG });
      const latX   = await latency(cdp, c, { axis: 'x', k: LAT_K, mag: PAN_MAG });
      const latY   = await latency(cdp, c, { axis: 'y', k: LAT_K, mag: PAN_MAG });
      const idl    = await idle(cdp, 1000);
      const rep = { warm, pan, scroll, latX, latY, idle: idl };
      cond.reps.push(rep);
      if (!warm && (!pan.valid || !scroll.valid)) out.invalid.push({ doc, zoom: z, rep: r, panValid: pan.valid, scrollValid: scroll.valid, panCoordChanges: pan.coordChanges, scrollCoordChanges: scroll.coordChanges, hidden: pan.hiddenSeen || scroll.hiddenSeen });
      console.error(`[${LABEL}] ${doc}/${z}% rep${r}${warm ? '(warm·버림)' : ''}  팬 p50=${num(pan.p50, 5)} p95=${num(pan.p95, 6)} max=${num(pan.max, 7)} drop=${num(pan.drop, 5)}%  | 스크롤 p50=${num(scroll.p50, 5)} p95=${num(scroll.p95, 6)} drop=${num(scroll.drop, 5)}%  | 지연 x=${num(latX.p50, 5)} y=${num(latY.p50, 5)}  | 좌표변화 ${pan.coordChanges}/${scroll.coordChanges}`);
    }
    // 회차 집계 (warm 제외)
    const m = cond.reps.filter(r => !r.warm);
    const pick = (sel, f) => f(m.map(sel));
    cond.summary = {
      n: m.length,
      pan:    { p50: pick(r => r.pan.p50, med),    p50sd: pick(r => r.pan.p50, sd),    p95: pick(r => r.pan.p95, med),    max: Math.max(...m.map(r => r.pan.max)),    drop: pick(r => r.pan.drop, mean),    dropSd: pick(r => r.pan.drop, sd),    dropT2: pick(r => r.pan.drop_t2, mean) },
      scroll: { p50: pick(r => r.scroll.p50, med), p50sd: pick(r => r.scroll.p50, sd), p95: pick(r => r.scroll.p95, med), max: Math.max(...m.map(r => r.scroll.max)), drop: pick(r => r.scroll.drop, mean), dropSd: pick(r => r.scroll.drop, sd), dropT2: pick(r => r.scroll.drop_t2, mean) },
      latX:   { p50: pick(r => r.latX.p50, med),   p95: pick(r => r.latX.p95, med),    max: Math.max(...m.map(r => r.latX.max ?? 0)) },
      latY:   { p50: pick(r => r.latY.p50, med),   p95: pick(r => r.latY.p95, med),    max: Math.max(...m.map(r => r.latY.max ?? 0)) },
      idle:   { p50: pick(r => r.idle.p50, med),   p95: pick(r => r.idle.p95, med),    drop: pick(r => r.idle.drop, mean) }
    };
    out.conditions.push(cond);
  }
}

out.envEnd = await cdp.ev('window.__pb.env()');
out.finishedAt = nowISO();

// ── 표 ────────────────────────────────────────────────
const L = [];
L.push('');
L.push(`═══ ${LABEL} ═══  node ${process.version} · ${process.platform} · DPR 실측 ${out.dpr.measured}(보고값 ${out.dpr.reported}) · 주사율 ${out.refresh.hz}Hz(유휴 p50 ${out.refresh.framePeriodP50}ms)`);
L.push(`회차: warmup ${WARMUP} 버리고 ${REPEATS}회 측정 · 팬/스크롤 각 ${PAN_N}이벤트(간격 ${PAN_IV}ms, delta ${PAN_MAG}) · 지연 단발 ${LAT_K}회`);
L.push('');
L.push(`문서(섹션/DOM노드)  배율 |        팬 프레임시간(ms)         |    팬드랍%    |      세로스크롤(ms)          |  스크롤드랍%  | 입력→반영 p50(ms) | 유휴`);
L.push(`                          |  p50(±sd)   p95     최대        | >16.7  >${DROP_T2}  |  p50     p95     최대        | >16.7  >${DROP_T2}  |  가로     세로    | p50`);
L.push('─'.repeat(165));
for (const cd of out.conditions) {
  const s = cd.summary;
  L.push(
    `${(cd.doc + '(' + cd.sections + '/' + cd.weight.domNodes + ')').padEnd(25)} ${String(cd.zoom + '%').padStart(4)} |` +
    ` ${num(s.pan.p50, 6)}(±${num(s.pan.p50sd, 4)}) ${num(s.pan.p95, 6)} ${num(s.pan.max, 8)}  |` +
    ` ${num(s.pan.drop, 5)} ${num(s.pan.dropT2, 5)} |` +
    ` ${num(s.scroll.p50, 6)} ${num(s.scroll.p95, 7)} ${num(s.scroll.max, 8)}   |` +
    ` ${num(s.scroll.drop, 5)} ${num(s.scroll.dropT2, 5)} |` +
    ` ${num(s.latX.p50, 7)} ${num(s.latY.p50, 7)}  |` +
    ` ${num(s.idle.p50, 5)}`
  );
}
L.push('');
L.push('줌 계단 (한 노치당 %p):');
for (const [k, v] of Object.entries(out.zoom)) L.push(`   ${k.padEnd(16)} deltaY=${String(v.deltaY).padStart(5)}  ${v.seq.join(' → ')}   계단 ${JSON.stringify(v.steps)}`);
if (out.invalid.length) { L.push(''); L.push(`⛔무효 회차 ${out.invalid.length}건: ${JSON.stringify(out.invalid)}`); }
else L.push('\n무효 회차 0건 (모든 측정에서 좌표가 실제로 움직였고, 창은 내내 visible)');
const table = L.join('\n');
console.log(table);

if (OUT) { fs.writeFileSync(OUT, JSON.stringify(out, null, 1)); fs.writeFileSync(OUT.replace(/\.json$/, '') + '.txt', table); console.error('\n→ ' + OUT); }
cdp.close();
process.exit(0);
