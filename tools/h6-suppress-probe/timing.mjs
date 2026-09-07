/* ═══════════════════════════════════════════════════════════════════════════
   H6 실기 ⑵ — «회귀를 안 만들었다»를 잰다.
   ───────────────────────────────────────────────────────────────────────────
   H6 에서 제일 위험한 회귀는 고착이 아니라 «반대 방향»이다:
     ⓐ 억제를 «너무 일찍» 풀면 → applyProjectData 의 rAF 창이 닫혀 MutationObserver 가
        억제 꺼진 채 발화 → 자동저장이 «중간 DOM» 을 예약한다(H3 가 고쳐 둔 경합의 부활).
     ⓑ 억제를 «너무 늦게» 풀면 → 복원 직후 관측자 발화가 통째로 삼켜져
        «복원 결과가 디스크에 안 남는다».
   ⇒ 그래서 «해제 시각표»를 고치기 전/후로 «같은 자로» 재서 대조한다. 같으면 안 바뀐 것이다.

   재는 것 (전부 제품의 실경로 · 실 Chromium · 실 MutationObserver)
     A. switchPage   — 구조로 바꾼 자리(안에 applyProjectData «없음»)
     B. switchBranch — 구조로 바꾼 자리(안에 applyProjectData «있음» = ★중첩이 생기는 자리)
     각각: 동기직후 / rAF 1틱 / rAF 2틱 의 억제값 + 그 사이 관측자가 «억제 없이» 몇 번 울었나
           + 그 결과가 디스크에 «남았나»
   사용: node tools/h6-suppress-probe/timing.mjs --checkout <앱경로> --port 9392 --out r.json
═══════════════════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { EXIT, HarnessError, armGlobalDeadline, sleep } from '../hardening/lib/deadline.mjs';
import { requirePreflightPass } from '../hardening/lib/preflight-gate.mjs';
import { launch, teardown, originClean } from '../hardening/lib/instance.mjs';
import { makeProject, makeUserDataDir } from '../hardening/lib/fixture.mjs';
import { evalJs } from '../hardening/lib/cdp.mjs';
import { diskMaxMarker } from '../hardening/judge/lost-window.mjs';

const argv = process.argv.slice(2);
const flag = (n, d = null) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? (argv[i + 1] ?? true) : d; };
const CHECKOUT = path.resolve(flag('checkout', path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')));
const PORT = Number(flag('port', 0));
const OUT = flag('out', null);
const LABEL = flag('label', path.basename(CHECKOUT));

const R = { label: LABEL, checkout: CHECKOUT, port: PORT, startedAt: new Date().toISOString(), notes: [] };
const disarm = armGlobalDeadline(Number(flag('deadline-ms', 300000)), 'h6 timing');
let inst = null;

/* 억제 시각표를 재는 «자» — 관측자를 «내가» 달고, 발화 순간의 억제값을 적는다.
   (scheduleAutoSave 의 게이트 `if (state._suppressAutoSave) return;` 와 같은 위치·같은 값) */
const INSTALL = `(function(){
  window.__h6 = { fires: [], armedFires: 0 };
  var c = document.getElementById('canvas');
  if (!c) return 'no-canvas';
  window.__h6.obs = new MutationObserver(function(){
    var s = !!(window.state && window.state._suppressAutoSave);
    window.__h6.fires.push(s);
    if (!s) window.__h6.armedFires++;
  });
  window.__h6.obs.observe(c, { childList:true, subtree:true, characterData:true, attributes:true });
  window.__h6.reset = function(){ window.__h6.fires.length = 0; window.__h6.armedFires = 0; };
  window.__h6.tl = async function(fn){
    window.__h6.reset();
    var out = { threw: null };
    try { await fn(); } catch (e) { out.threw = String(e && e.message || e); }
    out.sync = !!(window.state && window.state._suppressAutoSave);
    await new Promise(function(r){ requestAnimationFrame(function(){ r(); }); });
    out.raf1 = !!(window.state && window.state._suppressAutoSave);
    await new Promise(function(r){ requestAnimationFrame(function(){ r(); }); });
    out.raf2 = !!(window.state && window.state._suppressAutoSave);
    await new Promise(function(r){ setTimeout(r, 120); });
    out.after120 = !!(window.state && window.state._suppressAutoSave);
    out.fires = window.__h6.fires.slice(0, 40);
    out.armedFires = window.__h6.armedFires;
    return out;
  };
  return 'ok';
})()`;

try {
  if (!PORT) throw new HarnessError('--port 를 줘라');
  R.preflight = requirePreflightPass(PORT);
  const ud = makeUserDataDir(`h6t-${PORT}`);
  const fx = makeProject(ud, `proj_h6t_${Date.now()}`, { padKb: 0, sections: 3 });
  const projFile = path.join(fx.dir, 'proj.json');
  inst = await launch({ checkoutDir: CHECKOUT, userDataDir: ud, port: PORT, projectId: fx.id });
  R.instance = { pid: inst.pid, offscreen: inst.offscreen };

  R.build = await evalJs(inst.conn, `({ hasHelper: !!window.AutoSaveSuppress,
    hasSwitchPage: typeof window.switchPage === 'function',
    hasSwitchBranch: typeof window.switchBranch === 'function',
    hasCreateBranch: typeof window.createBranch === 'function' })`);
  const installed = await evalJs(inst.conn, INSTALL);
  if (installed !== 'ok') throw new HarnessError(`계측기 설치 실패: ${installed}`);

  /* ★계측기 자가증명 — 「관측자가 «정말» 우는가」를 먼저 쏴서 확인한다.
     증명 없는 「0회」는 판정이 아니다(H7 §5 가 자기 자신을 잡은 자리). */
  R.instrumentProof = await evalJs(inst.conn, `(async function(){
    return await window.__h6.tl(async function(){
      var d = document.createElement('div'); d.textContent = 'h6-proof';
      document.getElementById('canvas').appendChild(d);
      await new Promise(function(r){ setTimeout(r, 50); });
    });
  })()`, { awaitPromise: true });
  if (!R.instrumentProof || R.instrumentProof.fires.length === 0) {
    throw new HarnessError('★관측자 자가증명 실패 — 「0회」를 결론으로 쓸 수 없다', R.instrumentProof);
  }

  /* ── A. switchPage (applyProjectData 없음) ─────────────────────────── */
  R.A_switchPage = await evalJs(inst.conn, `(async function(){
    window.addPage();
    await new Promise(function(r){ setTimeout(r, 1500); });
    var pages = window.state.pages;
    var target = pages.find(function(p){ return p.id !== window.state.currentPageId; });
    return await window.__h6.tl(function(){ return window.switchPage(target.id); });
  })()`, { awaitPromise: true });

  await sleep(3000);
  const diskAfterA = diskMaxMarker(projFile);

  /* ── B. switchBranch (applyProjectData «있음» = 중첩이 생기는 자리) ─── */
  R.B_switchBranch = await evalJs(inst.conn, `(async function(){
    if (typeof window.createBranch !== 'function') return { skipped: 'no-createBranch' };
    // 마커를 하나 박아 두고 — 브랜치 전환 «결과»가 디스크에 남는지 보려는 것
    var d = document.createElement('div'); d.className='h7-edit-marker';
    d.textContent = 'H7-EDIT-91'; (document.querySelector('.section-block')||document.getElementById('canvas')).appendChild(d);
    window.saveCurrentBranchSnapshot && window.saveCurrentBranchSnapshot();
    try { window.createBranch('h6-probe'); } catch (e) { return { skipped: 'createBranch: '+e.message }; }
    await new Promise(function(r){ setTimeout(r, 1200); });
    var store = window.loadBranchStore && window.loadBranchStore();
    var names = store ? Object.keys(store.branches||{}) : [];
    var other = names.find(function(n){ return n !== (store && store.current); });
    if (!other) return { skipped: 'no-other-branch', names: names, current: store && store.current };
    var r = await window.__h6.tl(function(){ return window.switchBranch(other); });
    r.branches = names; r.switchedTo = other; r.currentAfter = window.getCurrentBranch && window.getCurrentBranch();
    return r;
  })()`, { awaitPromise: true });

  await sleep(4000);
  R.disk = { afterA: diskAfterA.max, afterB: diskMaxMarker(projFile).max, bytes: diskMaxMarker(projFile).bytes };

  R.verdict = 'MEASURED';
} catch (e) {
  R.error = { name: e.name, message: e.message, detail: e.detail || null };
  R.verdict = e instanceof HarnessError ? 'HARNESS_ERROR' : 'ERROR';
} finally {
  if (inst) { try { R.teardown = await teardown(inst); R.originClean = originClean(inst); } catch (_) {} }
  disarm();
}
R.finishedAt = new Date().toISOString();
if (OUT) { fs.mkdirSync(path.dirname(OUT), { recursive: true }); fs.writeFileSync(OUT, JSON.stringify(R, null, 2)); }
const tl = (x) => x ? `sync=${x.sync} raf1=${x.raf1} raf2=${x.raf2} +120ms=${x.after120} · 관측자 발화 ${x.fires ? x.fires.length : '?'}회(억제없이 ${x.armedFires})${x.threw ? ' · 던짐='+x.threw : ''}${x.skipped ? ' · 건너뜀='+x.skipped : ''}` : '-';
console.log(`\n═══ H6 시각표 [${LABEL}] ═══`);
console.log(`빌드        구조헬퍼 ${R.build?.hasHelper ? '있음' : '★없음(고치기 전)'}`);
console.log(`계측기증명  ${tl(R.instrumentProof)}`);
console.log(`A switchPage    ${tl(R.A_switchPage)}`);
console.log(`B switchBranch  ${tl(R.B_switchBranch)}`);
console.log(`디스크      A뒤 마커=${R.disk?.afterA} · B뒤 마커=${R.disk?.afterB} (91=브랜치전환 대상 마커)`);
if (R.originClean) console.log(`원본무접촉  ${R.originClean.clean ? 'ORIGIN-CLEAN' : '★위반'}`);
console.log(`판정        ★${R.verdict}`);
if (R.error) console.log(`오류        ${R.error.name}: ${R.error.message}`);
process.exit(R.verdict === 'MEASURED' ? EXIT.PASS : EXIT.HARNESS_ERROR);
