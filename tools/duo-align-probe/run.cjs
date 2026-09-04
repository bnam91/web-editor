#!/usr/bin/env node
/* ─────────────────────────────────────────────────────────────────────────────
   듀오블럭 «레이아웃(정렬)» 검증 — 화면 좌표(px)로 빨강/초록을 가른다.
     node verify-duo-align.cjs            # 기본: 포트 9334, GODITOR 렌더러
     PORT=9412 MATCH=harness3.html node verify-duo-align.cjs   # 하네스 대상

   판정 (인라인 스타일이 아니라 «실제 그려진 글자 상자» = Range.getBoundingClientRect + computed style)
     ⑴ 가로 정렬  좌/가운데/우 를 «진짜 클릭» → 글자 상자 left 가 컬럼 폭만큼 이동해야 한다.
        빨강(고치기 전) = [data-ha] 버튼이 «없음» → BUTTON_MISSING.
        초록(고친 뒤)   = left 이동 ≥ 40px, 그리고 좌 < 가운데 < 우.
     ⑵ 세로 정렬  상단/중앙/하단 → .duo-col 의 computed justify-content 가
        flex-start/center/flex-end 로 바뀌어야 한다(정렬 축이 «컬럼 안 내용»으로 갔다는 증거).
        빨강 = align-self/align-items 만 바뀌고 justify-content 는 계속 'normal'.
        ★컬럼 높이가 같으면 좌표는 0px 이 맞다(기하학적으로 여백이 없다) — 그래서 축을 잰다.
     ⑶ 간격 0     dataset.gap='0' 후 패널 재오픈 → 슬라이더/숫자가 0 이어야 한다.
        빨강 = 24 (parseInt||24 폴백이 0 을 삼킴).  초록 = 0.
   ───────────────────────────────────────────────────────────────────────────── */
const http = require('http');
const path = require('path');
const PORT  = process.env.PORT  || 9334;
const MATCH = process.env.MATCH || 'index.html';

let WebSocket = null;
for (const p of [path.join(process.env.HOME || '', 'web-editor/node_modules/ws'),
                 path.join(process.env.HOME || '', 'Documents/github_cloud/web-editor/node_modules/ws'), 'ws']) {
  try { WebSocket = require(p); break; } catch (_) {}
}
if (!WebSocket) { console.error('ERR ws 모듈 없음'); process.exit(1); }

const targets = () => new Promise((res, rej) => {
  http.get(`http://127.0.0.1:${PORT}/json`, r => { let b = ''; r.on('data', d => b += d); r.on('end', () => { try { res(JSON.parse(b)); } catch (e) { rej(e); } }); }).on('error', rej);
});

(async () => {
  const ts = (await targets()).filter(t => t.type === 'page' && (t.url || '').includes(MATCH));
  if (ts.length !== 1) { console.error(`TARGET_MISMATCH count=${ts.length} (MATCH=${MATCH})`); process.exit(2); }
  const ws = new WebSocket(ts[0].webSocketDebuggerUrl, { perMessageDeflate: false, maxPayload: 1 << 28 });
  let id = 0; const pend = new Map();
  const send = (m, p) => new Promise((res, rej) => { const i = ++id; pend.set(i, [res, rej]); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
  ws.on('message', m => { const o = JSON.parse(m); if (o.id && pend.has(o.id)) { const [res, rej] = pend.get(o.id); pend.delete(o.id); o.error ? rej(new Error(JSON.stringify(o.error))) : res(o.result); } });
  await new Promise(r => ws.on('open', r));
  const ev = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'eval error');
    return r.result.value;
  };
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  // ── 계측 헬퍼를 페이지에 심는다 (읽기 전용) ──
  await ev(`window.__duoProbe = (function(){
    function blk(){ return document.querySelector('.duo-block'); }
    return {
      pick: function(){
        var b = blk(); if(!b) return null;
        b.scrollIntoView({block:'center'});
        if (window.selectBlock) window.selectBlock(b.id);
        else { document.querySelectorAll('.selected').forEach(function(e){e.classList.remove('selected');}); b.classList.add('selected'); window.showDuoProperties && window.showDuoProperties(b); }
        return b.id;
      },
      btn: function(sel){
        var e = document.querySelector(sel); if(!e) return null;
        var r = e.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) return null;
        return { x: Math.round(r.left + r.width/2), y: Math.round(r.top + r.height/2) };
      },
      state: function(){
        var b = blk(); if(!b) return null;
        var inner = b.querySelector('.duo-inner'); if(!inner) return null;
        var ir = inner.getBoundingClientRect();
        var cols = [].slice.call(b.querySelectorAll(':scope > .duo-inner > .duo-col'));
        var lines = [].slice.call(b.querySelectorAll('.duo-line'));
        return {
          gap: b.dataset.gap, valign: b.dataset.valign,
          colAlign: (JSON.parse(b.dataset.cols||'[]')).map(function(c){return c.align||null;}),
          innerAlignItems: getComputedStyle(inner).alignItems,
          colJustify: cols.map(function(c){ return getComputedStyle(c).justifyContent; }),
          colTop: cols.map(function(c){ return Math.round(c.getBoundingClientRect().top - ir.top); }),
          colH: cols.map(function(c){ return Math.round(c.getBoundingClientRect().height); }),
          innerH: Math.round(ir.height),
          textAlign: lines.map(function(l){ return getComputedStyle(l).textAlign; }),
          glyphLeft: lines.map(function(l){ var rg=document.createRange(); rg.selectNodeContents(l); var r=rg.getBoundingClientRect(); return Math.round(r.left - ir.left); }),
          glyphTop:  lines.map(function(l){ var rg=document.createRange(); rg.selectNodeContents(l); var r=rg.getBoundingClientRect(); return Math.round(r.top - ir.top); })
        };
      },
      snapshot: function(){
        var b = blk(); if(!b) return null;
        return { cols: b.dataset.cols, gap: b.dataset.gap, valign: b.dataset.valign };
      },
      restore: function(s){
        var b = blk(); if(!b || !s) return false;
        b.dataset.cols = s.cols; b.dataset.gap = s.gap; b.dataset.valign = s.valign;
        window.renderDuoBlock && window.renderDuoBlock(b);
        window.showDuoProperties && window.showDuoProperties(b);
        window.scheduleAutoSave && window.scheduleAutoSave();
        return true;
      },
      gapZero: function(){
        var b = blk(); if(!b) return null;
        var keep = b.dataset.gap;
        b.dataset.gap = '0'; window.renderDuoBlock && window.renderDuoBlock(b);
        window.showDuoProperties && window.showDuoProperties(b);
        var s = document.getElementById('duo-gap-slider'), n = document.getElementById('duo-gap-number');
        var out = { slider: s && s.value, number: n && n.value, dataset: b.dataset.gap };
        b.dataset.gap = keep; window.renderDuoBlock && window.renderDuoBlock(b);
        window.showDuoProperties && window.showDuoProperties(b);
        return out;
      }
    };
  })(); 'ok'`);

  const pickedId = await ev('window.__duoProbe.pick()');
  if (!pickedId) {
    console.log('✗ 캔버스에 .duo-block 이 없다. 듀오블럭 하나 추가한 뒤 다시 실행해라.');
    ws.close(); process.exit(4);
  }
  console.log(`대상 duo-block = ${pickedId}   (port ${PORT} / ${MATCH})`);
  // ★검증은 라이브 프로젝트를 만진다 — 원상복구용 스냅샷을 먼저 뜬다(끝에 되돌린다).
  const snap = await ev('JSON.stringify(window.__duoProbe.snapshot())');
  console.log('원상복구 스냅샷 확보 (검증 끝나면 되돌린다)\n');

  const click = async (sel) => {
    const pt = await ev(`JSON.stringify(window.__duoProbe.btn(${JSON.stringify(sel)}))`);
    if (!pt || pt === 'null') return null;
    const { x, y } = JSON.parse(pt);
    await send('Input.dispatchMouseEvent', { type: 'mousePressed',  x, y, button: 'left', clickCount: 1, buttons: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1, buttons: 0 });
    await sleep(150);
    return JSON.parse(await ev('JSON.stringify(window.__duoProbe.state())'));
  };

  let fail = 0;
  // ─── ⑴ 가로 정렬 ───────────────────────────────────────────────────────────
  console.log('⑴ 가로 정렬 — 글자 상자 left (px, .duo-inner 기준)');
  const h = {};
  for (const a of ['left', 'center', 'right']) {
    const s = await click(`#duo-halign-group [data-ha="${a}"]`);
    if (!s) { console.log(`   ${a.padEnd(6)} : ✗ BUTTON_MISSING — 패널에 «가로 정렬» 버튼이 없다 (= 빨강)`); fail++; continue; }
    h[a] = s;
    console.log(`   ${a.padEnd(6)} : textAlign=${JSON.stringify(s.textAlign)}  glyphLeft=${JSON.stringify(s.glyphLeft)}`);
  }
  if (h.left && h.center && h.right) {
    const d1 = Math.min(...h.center.glyphLeft.map((v, i) => v - h.left.glyphLeft[i]));
    const d2 = Math.min(...h.right.glyphLeft.map((v, i) => v - h.center.glyphLeft[i]));
    const ok = d1 >= 40 && d2 >= 40;
    console.log(`   → 좌→가운데 최소이동 ${d1}px, 가운데→우 최소이동 ${d2}px  ${ok ? '✓ 초록' : '✗ 빨강(40px 미만 = 안 움직임)'}`);
    if (!ok) fail++;
  }

  // ─── ⑵ 세로 정렬 ───────────────────────────────────────────────────────────
  console.log('\n⑵ 세로 정렬 — 정렬 «축»(컬럼 안 내용) + 실제 좌표');
  const want = { top: 'flex-start', middle: 'center', bottom: 'flex-end' };
  const v = {};
  for (const a of ['top', 'middle', 'bottom']) {
    const s = await click(`#duo-valign-group [data-va="${a}"]`) || await click(`[data-va="${a}"]`);
    if (!s) { console.log(`   ${a.padEnd(6)} : ✗ BUTTON_MISSING`); fail++; continue; }
    v[a] = s;
    console.log(`   ${a.padEnd(6)} : inner.alignItems=${s.innerAlignItems}  col.justifyContent=${JSON.stringify(s.colJustify)}  colTop=${JSON.stringify(s.colTop)}  glyphTop=${JSON.stringify(s.glyphTop)}`);
  }
  const axisOk = ['top', 'middle', 'bottom'].every(a => v[a] && v[a].colJustify.every(j => j === want[a]));
  console.log(`   → 축 판정: ${axisOk ? '✓ 초록 — 컬럼 «안»의 justify-content 가 상/중/하로 전환된다'
                                      : '✗ 빨강 — justify-content 가 안 바뀐다(정렬이 컬럼 «박스»만 움직임)'}`);
  if (!axisOk) fail++;
  if (v.top) {
    const slack = Math.max(...v.top.colH.map(x => v.top.innerH - x));
    const moved = v.middle ? Math.max(...v.middle.glyphTop.map((y, i) => Math.abs(y - v.top.glyphTop[i]))) : 0;
    console.log(`   → 컬럼 높이 여백 slack=${slack}px, 상단→중앙 최대이동 ${moved}px`);
    console.log(`      ${slack === 0 ? 'ℹ slack=0 이면 좌표가 0px 인 게 «정상»이다(컬럼 두 개가 같은 높이). 축 판정으로 가른다.'
                                     : (moved > 0 ? '✓ 여백이 있으니 실제로 움직인다' : '✗ 여백이 있는데 안 움직인다 = 빨강')}`);
    if (slack > 0 && moved === 0) fail++;
  }

  // ─── ⑶ 간격 0 표시 ─────────────────────────────────────────────────────────
  const g = JSON.parse(await ev('JSON.stringify(window.__duoProbe.gapZero())'));
  const gOk = g && String(g.slider) === '0' && String(g.number) === '0';
  console.log(`\n⑶ 간격 0 표시 — dataset=0 일 때 패널 슬라이더=${g && g.slider}, 숫자=${g && g.number}  ${gOk ? '✓ 초록' : '✗ 빨강(24 로 되살아남)'}`);
  if (!gOk) fail++;

  const restored = await ev(`window.__duoProbe.restore(${snap})`);
  console.log(`\n원상복구: ${restored ? '✓ 검증 전 정렬/간격으로 되돌렸다' : '✗ 실패 — Cmd+Z 로 되돌려라'}`);
  console.log(`\n===== ${fail === 0 ? '초록 PASS' : `빨강 FAIL (${fail}건)`} =====`);
  ws.close();
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.error(e.message || e); process.exit(1); });
