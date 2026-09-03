/* ══════════════════════════════════════════════════════════════════════════
   섹션 배경 «위치 편집» 검증 프로브 (feat/section-bg-position)

   실행:
     cd /Users/a1/web-editor-secbgpos
     node tools/section-bg-position-probe/run.mjs                      # 기본: 포트 9334, sec_uid2mbz
     (node_modules 없어도 됨 — ws 는 /Users/a1/web-editor 쪽에서 폴백 로드)
     PORT=9334 SEC=sec_uid2mbz node tools/section-bg-position-probe/run.mjs
     SEC=auto node tools/section-bg-position-probe/run.mjs             # 배경이미지 있는 첫 섹션 자동선택
     SHOT=1  node tools/section-bg-position-probe/run.mjs              # 켬/끔 스크린샷을 이 폴더에 저장

   ⚠️ 앱을 새로 띄우지 않는다. 이미 떠 있는 GODITOR(원격디버깅 포트)에 «붙기»만 한다.
   ⚠️ 이 프로브는 실제로 드래그·리사이즈를 수행하고 ESC 로 끈다 → 끝나면 섹션 배경 위치가
      바뀌어 있다(되돌리려면 ⌘Z). 검증 전용 프로젝트에서 돌리는 걸 권함.

   가르는 기준(전부 수치):
     ⑴ 프레임 «밖» 노출  : 고스트/경계선 rect 가 섹션 rect 를 넘는 px 량 > 1
     ⑵ 핸들             : corner 4 + edge 4 + boundary 1, rotate 0(배경은 회전 불가)
     ⑶ 끄면 잔여 0      : 프록시·고스트·핸들·경계선·힌트·클래스·플래그 전부 0
     ⑷ 직렬화 무유출     : «편집 중»에 직렬화해도 편집 UI 문자열 0회
     ⑸ 조작 반영        : 드래그/리사이즈가 background-position/size 에 수치로 반영
═══════════════════════════════════════════════════════════════════════════ */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
// ws 는 워크트리에 node_modules 가 없어도 되게 본 레포에서 폴백 로드한다
const WebSocket = (await import('ws').catch(() =>
  import('/Users/a1/web-editor/node_modules/ws/wrapper.mjs'))).default;

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || '9334';
const SEC  = process.env.SEC  || 'sec_uid2mbz';

/* ── CDP 접속 ── */
let pages;
try {
  pages = await (await fetch(`http://localhost:${PORT}/json`)).json();
} catch (e) {
  console.error(`✗ CDP ${PORT} 접속 실패 — 앱이 --remote-debugging-port=${PORT} 로 떠 있는지 확인.`);
  process.exit(2);
}
const target = pages.find(p => p.type === 'page' && /index\.html|GODITOR/i.test(p.url + p.title))
            || pages.find(p => p.type === 'page');
if (!target) { console.error('✗ page 타겟 없음'); process.exit(2); }

const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.once('open', res); ws.once('error', rej); });
let _id = 0; const pending = new Map();
ws.on('message', m => {
  const d = JSON.parse(m.toString());
  if (d.id && pending.has(d.id)) { const p = pending.get(d.id); pending.delete(d.id); d.error ? p.rej(d.error) : p.res(d.result); }
});
const send = (method, params = {}) => new Promise((res, rej) => { const id = ++_id; pending.set(id, { res, rej }); ws.send(JSON.stringify({ id, method, params })); });

async function evalJs(fnBody, arg) {
  const r = await send('Runtime.evaluate', {
    expression: `(async (ARG) => { ${fnBody} })(${JSON.stringify(arg ?? null)})`,
    returnByValue: true, awaitPromise: true,
  });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result?.value;
}
const shot = async (clip) => (await send('Page.captureScreenshot', { format: 'png', clip: { ...clip, scale: 1 } })).data;

/* ── 결과 집계 ── */
const rows = [];
const check = (id, ok, detail) => { rows.push({ id, ok, detail }); return ok; };

try {
/* ────────────────────────────────────────────── 0. 대상 확보 ── */
const base = await evalJs(`
  const SEC = ARG;
  let sec = SEC === 'auto' ? null : document.getElementById(SEC);
  if (!sec) sec = [...document.querySelectorAll('.section-block')].find(s => s.dataset.bgImg);
  if (!sec) return { err: '배경이미지 있는 섹션을 못 찾음 (SEC=<id> 로 지정하거나 섹션에 배경 이미지를 넣어라)' };
  window.__SBP = { sec };
  const r = sec.getBoundingClientRect();
  return {
    id: sec.id, zoom: window.currentZoom || 100,
    bgSize: sec.dataset.bgSize || '(없음=cover)', bgPos: sec.dataset.bgPos || '(없음=center)',
    rect: { x: r.x, y: r.y, w: r.width, h: r.height },
    api: {
      enter: typeof window.enterSectionBgEditMode, exit: typeof window.exitSectionBgEditMode,
      applyBg: typeof window.applySectionBg, ser: typeof window.serializeSectionClone,
      serCanvas: typeof window.getSerializedCanvas,
    },
  };
`, SEC);
if (base.err) { console.error('✗ ' + base.err); process.exit(2); }
console.log(`대상 섹션 : ${base.id}   zoom ${base.zoom}%   rect ${base.rect.w.toFixed(1)}×${base.rect.h.toFixed(1)}`);
console.log(`편집 전   : bgSize=${base.bgSize}  bgPos=${base.bgPos}`);
check('API 로드', Object.values(base.api).every(v => v === 'function'), JSON.stringify(base.api));

const shotBefore = process.env.SHOT ? await shot({ x: base.rect.x, y: base.rect.y, width: base.rect.w, height: base.rect.h }) : null;

/* ── 0.5 «위치 편집» 버튼 배선 — 사용자가 실제로 누르는 경로 ── */
const wiring = await evalJs(`
  const sec = window.__SBP.sec;
  await window.showSectionProperties(sec);
  await new Promise(r => setTimeout(r, 200));
  const btn = document.getElementById('sec-bg-pos-btn');
  if (!btn) return { err: '우측 패널에 #sec-bg-pos-btn 없음' };
  const label0 = btn.textContent.trim(), cls = btn.className;
  btn.click();
  for (let i = 0; i < 40; i++) { await new Promise(r => requestAnimationFrame(r)); if (document.querySelector('.sec-bg-ghost')) break; }
  const entered = !!sec._secBgEditing && !!document.querySelector('.sec-bg-proxy');
  const doneBtn = document.getElementById('sec-bg-pos-done');
  return { label0, cls, entered, hasDoneBtn: !!doneBtn, doneCls: doneBtn && doneBtn.className };
`);
if (wiring.err) { console.error('✗ ' + wiring.err); }
check('버튼 클릭으로 편집 진입', wiring.entered === true, `label="${wiring.label0}" class="${wiring.cls}"`);
check('종료 버튼이 같은 클래스 재사용', wiring.doneCls === 'prop-action-btn secondary', `done class="${wiring.doneCls}"`);
// 배선 확인용 진입은 여기서 되돌리고, 아래에서 «깨끗한» 상태로 다시 측정한다
await evalJs(`window.exitSectionBgEditMode(window.__SBP.sec); await new Promise(r => setTimeout(r, 250)); return 1;`);

/* ────────────────────────────── 1. 편집 켜기 + 기하 실측 ── */
const on = await evalJs(`
  const sec = window.__SBP.sec;
  window.enterSectionBgEditMode(sec);
  // 이미지 디코드 + RAF 2회(고스트/핸들 배치) 대기
  for (let i = 0; i < 40; i++) {
    await new Promise(r => requestAnimationFrame(r));
    if (document.querySelector('.sec-bg-ghost') && document.querySelector('.img-boundary')) break;
  }
  await new Promise(r => requestAnimationFrame(r));
  const q = s => document.querySelectorAll(s).length;
  const sr = sec.getBoundingClientRect();
  const rectOf = s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, l: r.left, t: r.top, rt: r.right, b: r.bottom }; };
  const over = r => r ? Math.max(sr.left - r.l, sr.top - r.t, r.rt - sr.right, r.b - sr.bottom) : null;
  const g = rectOf('.sec-bg-ghost'), bnd = rectOf('.img-boundary');
  return {
    counts: { proxy: q('.sec-bg-proxy'), ghost: q('.sec-bg-ghost'), corner: q('.img-corner-handle'),
              edge: q('.img-edge-handle'), boundary: q('.img-boundary'), rotate: q('.img-rotate-zone'),
              hint: q('.img-edit-hint'), editingCls: q('.sec-bg-editing') },
    secRect: { l: sr.left, t: sr.top, r: sr.right, b: sr.bottom, w: sr.width, h: sr.height },
    ghost: g, ghostOverflowPx: over(g),
    boundary: bnd, boundaryOverflowPx: over(bnd),
    ghostVisible: (() => { const e = document.querySelector('.sec-bg-ghost'); if (!e) return null;
      const cs = getComputedStyle(e); return { opacity: cs.opacity, display: cs.display, clipPath: (cs.clipPath||'').slice(0, 40) }; })(),
    styleNow: { size: sec.style.backgroundSize, pos: sec.style.backgroundPosition },
    proxyInCanvas: !!document.querySelector('#canvas .sec-bg-proxy'),
    ghostInCanvas: !!document.querySelector('#canvas .sec-bg-ghost, #canvas .sec-bg-ghost-wrap'),
  };
`);

check('⑵ 핸들 corner 4개',  on.counts.corner === 4,  `corner=${on.counts.corner}`);
check('⑵ 핸들 edge 4개',    on.counts.edge === 4,    `edge=${on.counts.edge}`);
check('⑵ 경계선(파란 아웃라인) 1개', on.counts.boundary === 1, `boundary=${on.counts.boundary}`);
check('⑵ 회전존 0개(배경은 회전 불가)', on.counts.rotate === 0, `rotate=${on.counts.rotate}`);
check('프록시 1개',          on.counts.proxy === 1,   `proxy=${on.counts.proxy}`);
check('고스트 1개',          on.counts.ghost === 1,   `ghost=${on.counts.ghost}`);
check('⑴ 고스트가 섹션 밖으로 넘침', (on.ghostOverflowPx ?? -1) > 1,
      `최대 초과 ${on.ghostOverflowPx?.toFixed(1)}px · ghost ${on.ghost && (on.ghost.w.toFixed(1)+'×'+on.ghost.h.toFixed(1))} vs sec ${on.secRect.w.toFixed(1)}×${on.secRect.h.toFixed(1)}`);
check('⑴ 경계선이 섹션 밖으로 넘침', (on.boundaryOverflowPx ?? -1) > 1,
      `최대 초과 ${on.boundaryOverflowPx?.toFixed(1)}px`);
check('고스트는 #canvas «밖»(직렬화 대상 아님)', on.ghostInCanvas === false, `#canvas 안 고스트=${on.ghostInCanvas}`);
// 프록시는 «설계상» #canvas 안이다(섹션 padding-box 좌표를 써야 하므로) → 세척 등록이 필수.
check('프록시는 #canvas 안 (→ 세척 등록 필수)', on.proxyInCanvas === true, `#canvas 안 프록시=${on.proxyInCanvas}`);
console.log(`편집 중   : background-size=${on.styleNow.size}  position=${on.styleNow.pos}`);
console.log(`고스트    : opacity=${on.ghostVisible?.opacity} clip=${on.ghostVisible?.clipPath || '(punch-out 없음)'}`);

const shotOn = process.env.SHOT ? await shot({ x: base.rect.x, y: base.rect.y, width: base.rect.w, height: base.rect.h }) : null;
if (shotBefore && shotOn) {
  const same = shotBefore === shotOn;
  console.log(`[INFO] 프레임 «안» 픽셀 켬 전/후 동일: ${same ? 'YES(완전동일)' : 'NO'} (${shotBefore.length} vs ${shotOn.length} b64)`);
  fs.writeFileSync(path.join(HERE, 'shot-before.png'), Buffer.from(shotBefore, 'base64'));
  fs.writeFileSync(path.join(HERE, 'shot-editing.png'), Buffer.from(shotOn, 'base64'));
  console.log(`[INFO] 스크린샷 저장: ${HERE}/shot-before.png, shot-editing.png`);
}

/* ─────────────────────── 2. «편집 중» 직렬화 — 유출 0 이어야 ── */
const LEAK = ['sec-bg-proxy', 'sec-bg-ghost', 'sec-bg-editing', 'img-corner-handle', 'img-edge-handle', 'img-boundary', 'img-edit-hint', 'img-rotate-zone', 'img-editing'];
const ser = await evalJs(`
  const sec = window.__SBP.sec;
  const LEAK = ARG;
  const secHtml = window.serializeSectionClone(sec);
  const canvasHtml = window.getSerializedCanvas();
  const hits = s => LEAK.filter(k => s.includes(k));
  return { secLen: secHtml.length, canvasLen: canvasHtml.length,
           secHits: hits(secHtml), canvasHits: hits(canvasHtml),
           // 배경 자체는 반드시 살아 있어야 한다(세척이 과하게 지우지 않았는지)
           secHasBg: /data-bg-img|background-image/.test(secHtml) };
`, LEAK);
check('⑷ 섹션 직렬화에 편집 UI 0회', ser.secHits.length === 0, `hits=${JSON.stringify(ser.secHits)} (len ${ser.secLen})`);
check('⑷ 캔버스 전체 직렬화에 편집 UI 0회', ser.canvasHits.length === 0, `hits=${JSON.stringify(ser.canvasHits)} (len ${ser.canvasLen})`);
check('직렬화에 배경은 살아 있음', ser.secHasBg === true, `secHasBg=${ser.secHasBg}`);

/* ────────────────────────────────── 3. 드래그 / 리사이즈 반영 ── */
const drag = await evalJs(`
  const sec = window.__SBP.sec;
  const img = document.querySelector('.sec-bg-proxy .asset-img');
  const zs  = (window.currentZoom || 100) / 100;
  const r   = img.getBoundingClientRect();
  const sx  = r.left + r.width / 2, sy = r.top + r.height / 2;
  const DX = 137, DY = 91;   // 중앙스냅(12px) 밖 · 홀수로 잡아 우연일치 방지
  const before = sec.style.backgroundPosition;
  const md = (t, x, y, el) => (el || document).dispatchEvent(new MouseEvent(t, { bubbles: true, clientX: x, clientY: y, button: 0 }));
  md('mousedown', sx, sy, img);
  md('mousemove', sx + DX, sy + DY);
  await new Promise(r => requestAnimationFrame(r));
  await new Promise(r => requestAnimationFrame(r));
  const mid = sec.style.backgroundPosition;
  md('mouseup', sx + DX, sy + DY);
  const num = s => (s.split(',').pop() || '').trim().split(/\\s+/).map(parseFloat);
  const b = num(before), m = num(mid);
  return { before, mid, dxObserved: m[0] - b[0], dyObserved: m[1] - b[1], dxExpected: DX / zs, dyExpected: DY / zs };
`);
check('⑸ 드래그가 background-position 에 반영',
      Math.abs(drag.dxObserved - drag.dxExpected) < 1.5 && Math.abs(drag.dyObserved - drag.dyExpected) < 1.5,
      `Δ관측 (${drag.dxObserved?.toFixed(1)}, ${drag.dyObserved?.toFixed(1)}) vs Δ기대 (${drag.dxExpected.toFixed(1)}, ${drag.dyExpected.toFixed(1)})`);

const resize = await evalJs(`
  const sec = window.__SBP.sec;
  const hs  = [...document.querySelectorAll('.img-corner-handle')];
  // 가장 오른쪽·아래 = br 핸들
  const h = hs.sort((a, b) => (b.getBoundingClientRect().left + b.getBoundingClientRect().top) - (a.getBoundingClientRect().left + a.getBoundingClientRect().top))[0];
  const r = h.getBoundingClientRect();
  const sx = r.left + r.width / 2, sy = r.top + r.height / 2;
  const zs = (window.currentZoom || 100) / 100;
  const DX = 120;
  const wOf = s => parseFloat((s.split(',').pop() || '').trim().split(/\\s+/)[0]);
  const before = sec.style.backgroundSize;
  const md = (t, x, y, el) => (el || document).dispatchEvent(new MouseEvent(t, { bubbles: true, clientX: x, clientY: y, button: 0 }));
  md('mousedown', sx, sy, h);
  md('mousemove', sx + DX, sy);
  await new Promise(r => requestAnimationFrame(r));
  await new Promise(r => requestAnimationFrame(r));
  const mid = sec.style.backgroundSize;
  md('mouseup', sx + DX, sy);
  return { before, mid, dwObserved: wOf(mid) - wOf(before), dwExpected: DX / zs };
`);
check('⑸ 모서리 핸들이 background-size 에 반영',
      Math.abs(resize.dwObserved - resize.dwExpected) < 2,
      `Δ너비 관측 ${resize.dwObserved?.toFixed(1)}px vs 기대 ${resize.dwExpected.toFixed(1)}px  (${resize.before} → ${resize.mid})`);

/* ──────────────────────────────── 4. ESC 로 끄기 → 잔여 0 ── */
const off = await evalJs(`
  const sec = window.__SBP.sec;
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await new Promise(r => setTimeout(r, 300));   // showSectionProperties 가 async 라 RAF 로는 부족
  const q = s => document.querySelectorAll(s).length;
  return {
    residue: {
      proxy: q('.sec-bg-proxy'), ghost: q('.sec-bg-ghost'), corner: q('.img-corner-handle'),
      edge: q('.img-edge-handle'), boundary: q('.img-boundary'), rotate: q('.img-rotate-zone'),
      hint: q('.img-edit-hint'), editingCls: q('.sec-bg-editing'), imgEditingCls: q('.img-editing'),
      ghostWrap: q('.sec-bg-ghost-wrap'),
    },
    flags: { secBgEditing: !!sec._secBgEditing, proxyRef: !!sec._secBgProxy, ghostRef: !!sec._secBgGhost, syncStop: !!sec._secBgSyncStop },
    committed: { bgSize: sec.dataset.bgSize || '', bgPos: sec.dataset.bgPos || '' },
    inline:    { size: sec.style.backgroundSize, pos: sec.style.backgroundPosition },
    panelHasPosBtn: !!document.getElementById('sec-bg-pos-btn'),
  };
`);
const residueTotal = Object.values(off.residue).reduce((a, b) => a + b, 0);
check('⑶ 끄면 잔여 DOM/클래스 0', residueTotal === 0, JSON.stringify(off.residue));
check('⑶ 끄면 내부 플래그 0', Object.values(off.flags).every(v => v === false), JSON.stringify(off.flags));
check('커밋된 dataset 이 px 값', /px/.test(off.committed.bgSize) && /px/.test(off.committed.bgPos),
      `bgSize="${off.committed.bgSize}" bgPos="${off.committed.bgPos}"`);
check('인라인 style 이 dataset 과 일치',
      off.inline.pos.replace(/\s/g, '').endsWith(off.committed.bgPos.replace(/\s/g, '')),
      `inline="${off.inline.pos}" dataset="${off.committed.bgPos}"`);
check('우측 패널이 섹션 패널로 복귀', off.panelHasPosBtn === true, `sec-bg-pos-btn=${off.panelHasPosBtn}`);
console.log(`편집 후   : bgSize=${off.committed.bgSize}  bgPos=${off.committed.bgPos}`);

/* ──────────────────────── 5. 끈 뒤 직렬화 + 켬/끔 2회 멱등 ── */
const after = await evalJs(`
  const sec = window.__SBP.sec;
  const LEAK = ARG;
  const hits = s => LEAK.filter(k => s.includes(k));
  const h1 = hits(window.getSerializedCanvas());
  // 켬 → 버튼 토글로 끔 → 다시 켬 → ESC 로 끔 : 두 경로 모두 잔여 0 이어야
  window.enterSectionBgEditMode(sec);
  for (let i = 0; i < 40; i++) { await new Promise(r => requestAnimationFrame(r)); if (document.querySelector('.sec-bg-ghost')) break; }
  window.exitSectionBgEditMode(sec);
  for (let i = 0; i < 6; i++) await new Promise(r => requestAnimationFrame(r));
  const q = s => document.querySelectorAll(s).length;
  const r1 = q('.sec-bg-proxy') + q('.sec-bg-ghost') + q('.sec-bg-ghost-wrap') + q('.img-corner-handle') + q('.img-edge-handle') + q('.img-boundary') + q('.img-edit-hint') + q('.sec-bg-editing');
  window.enterSectionBgEditMode(sec);
  for (let i = 0; i < 40; i++) { await new Promise(r => requestAnimationFrame(r)); if (document.querySelector('.sec-bg-ghost')) break; }
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  for (let i = 0; i < 6; i++) await new Promise(r => requestAnimationFrame(r));
  const r2 = q('.sec-bg-proxy') + q('.sec-bg-ghost') + q('.sec-bg-ghost-wrap') + q('.img-corner-handle') + q('.img-edge-handle') + q('.img-boundary') + q('.img-edit-hint') + q('.sec-bg-editing');
  return { canvasHitsAfter: h1, residueAfterToggleExit: r1, residueAfterEscExit: r2,
           bgSize: sec.dataset.bgSize, bgPos: sec.dataset.bgPos };
`, LEAK);
check('⑷ 끈 뒤 캔버스 직렬화에 편집 UI 0회', after.canvasHitsAfter.length === 0, JSON.stringify(after.canvasHitsAfter));
check('⑶ 버튼 토글 종료 잔여 0', after.residueAfterToggleExit === 0, `${after.residueAfterToggleExit}`);
check('⑶ ESC 종료(2회차) 잔여 0', after.residueAfterEscExit === 0, `${after.residueAfterEscExit}`);
check('열었다 닫기만 하면 값이 안 흔들림', after.bgSize === off.committed.bgSize && after.bgPos === off.committed.bgPos,
      `${off.committed.bgSize}/${off.committed.bgPos} → ${after.bgSize}/${after.bgPos}`);

} catch (e) {
  rows.push({ id: '프로브 실행', ok: false, detail: String(e.message || e).slice(0, 400) });
} finally {
  ws.close();
}

/* ── 리포트 ── */
console.log('\n──────────────────────────────────────────────────────────────');
let fail = 0;
for (const r of rows) {
  if (!r.ok) fail++;
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.id.padEnd(38)} ${r.detail ?? ''}`);
}
console.log('──────────────────────────────────────────────────────────────');
console.log(fail === 0 ? `전부 통과 (${rows.length}항)` : `실패 ${fail}/${rows.length}항`);
process.exit(fail ? 1 : 0);
