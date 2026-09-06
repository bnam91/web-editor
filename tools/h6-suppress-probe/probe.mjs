/* ═══════════════════════════════════════════════════════════════════════════
   H6 실기 — «고착을 실제로 만들어» 자동저장이 정말 멎는지 잰다.
   ───────────────────────────────────────────────────────────────────────────
   ⛔합성 테스트로는 못 판정한다 — 억제 플래그는 «타이밍»이 전부고,
     진짜 MutationObserver·진짜 디바운스·진짜 디스크 쓰기가 있어야 답이 나온다.

   재는 법 (전부 «제품 자신의» 경로로)
     ⑴ 양성대조 — 편집 3건이 디스크(proj.json)에 도착하는지. 안 도착하면 아래는 «못 잼»이다.
     ⑵ 고착 주입 — window.buildLayerPanel 이 «한 번» 던지게 하고 제품의 switchPage 를 부른다.
        buildLayerPanel 은 switchPage 의 억제 창 «안»에서, 옛 `= false` 줄 «바로 앞»에 있다.
        (실제 고장 모양: 손상된 블록에서 레이어 패널 렌더가 터지는 것)
     ⑶ 플래그를 읽는다 — 고착이면 true 로 «남아» 있다.
     ⑷ 편집을 더 하고 기다린다 — 디스크 마커가 «안 늘면» 그게 조용한 데이터 손실이다.

   ⛔이 스크립트는 preflight 를 «부르지 않는다». 먼저 별도 명령으로 돌려라.
   사용: node tools/h6-suppress-probe/probe.mjs --checkout <앱경로> --port 9391 --out r.json
═══════════════════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { EXIT, HarnessError, armGlobalDeadline, sleep, waitFor } from '../hardening/lib/deadline.mjs';
import { requirePreflightPass } from '../hardening/lib/preflight-gate.mjs';
import { launch, teardown, originClean, mainLogLines } from '../hardening/lib/instance.mjs';
import { makeProject, makeUserDataDir } from '../hardening/lib/fixture.mjs';
import { evalJs } from '../hardening/lib/cdp.mjs';
import { newLedger, makeEdit, diskMaxMarker } from '../hardening/judge/lost-window.mjs';

const argv = process.argv.slice(2);
const flag = (n, d = null) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? (argv[i + 1] ?? true) : d; };
const CHECKOUT = path.resolve(flag('checkout', path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')));
const PORT = Number(flag('port', 0));
const OUT = flag('out', null);
const LABEL = flag('label', path.basename(CHECKOUT));

const R = { label: LABEL, checkout: CHECKOUT, port: PORT, startedAt: new Date().toISOString(), steps: {}, notes: [], verdict: null };
const disarm = armGlobalDeadline(Number(flag('deadline-ms', 300000)), 'h6 probe');
let inst = null;

try {
  if (!PORT) throw new HarnessError('--port 를 줘라 (9350~9399)');
  R.preflight = requirePreflightPass(PORT);

  const ud = makeUserDataDir(`h6-${PORT}`);
  const fx = makeProject(ud, `proj_h6_${Date.now()}`, { padKb: 0, sections: 3 });
  R.fixture = { id: fx.id, dir: fx.dir, bytes: fx.bytes };
  const projFile = path.join(fx.dir, 'proj.json');

  inst = await launch({ checkoutDir: CHECKOUT, userDataDir: ud, port: PORT, projectId: fx.id });
  R.instance = { pid: inst.pid, screenX: inst.screenX, offscreen: inst.offscreen, href: inst.href };

  /* 이 빌드가 억제를 «구조»로 다루는가 — 고친 판/안 고친 판을 스스로 말하게 한다. */
  R.build = await evalJs(inst.conn, `({
    hasHelper: typeof window.AutoSaveSuppress === 'object' && window.AutoSaveSuppress !== null,
    hasSwitchPage: typeof window.switchPage === 'function',
    hasAddPage: typeof window.addPage === 'function',
    flag: !!(window.state && window.state._suppressAutoSave),
  })`);
  if (!R.build.hasSwitchPage || !R.build.hasAddPage) {
    throw new HarnessError('제품이 switchPage/addPage 를 window 에 안 올렸다 — 이 실기는 성립하지 않는다', R.build);
  }

  /* ── ⑴ 양성대조 ─────────────────────────────────────────────────────── */
  const led = newLedger();
  for (let i = 0; i < 3; i++) { await makeEdit(inst.conn, led); await sleep(300); }
  let landedOk = true;
  try {
    await waitFor(() => diskMaxMarker(projFile).max >= 3, { timeout: 45000, interval: 400, label: '양성대조: 편집 3건 디스크 도착' });
  } catch (_) { landedOk = false; }
  R.steps.control = { editsMade: 3, diskMax: diskMaxMarker(projFile).max, landed: landedOk };
  if (!landedOk) {
    R.verdict = 'NOT_MEASURED';
    R.notes.push('★양성대조 실패 — 고착을 주입하기 «전»에도 편집이 디스크에 안 갔다. 아래 판정은 성립하지 않는다.');
    throw new HarnessError('양성대조 실패', R.steps.control);
  }

  /* ── ⑵ 고착 주입: 제품의 switchPage 를 «진짜로» 태우고 그 안에서 던지게 한다 ── */
  R.steps.inject = await evalJs(inst.conn, `(async function(){
    var out = { addedPage: null, threwInside: false, switchPageThrew: false, err: null };
    /* ★addPage 는 «스스로» switchPage 를 부른다(save-load.js). 그래서 던지는 스텁을 여기 «전»에
       깔면 그 안쪽 switchPage 가 먼저 먹고, 뒤이은 내 switchPage 가 성공하면서
       ★고착을 «치료»해 버린다 — 초판이 실제로 그래서 「고착 없음」을 냈다.
       ⇒ 페이지부터 만들고, «그게 끝난 뒤에» 스텁을 깐다. */
    window.addPage();
    await new Promise(function(r){ setTimeout(r, 2000); });
    var pages = (window.state && window.state.pages) || [];
    out.pageIds = pages.map(function(p){ return p.id; });
    out.currentBefore = window.state.currentPageId;
    var target = pages.find(function(p){ return p.id !== window.state.currentPageId; });
    if (!target) { out.err = 'no-second-page'; return out; }
    out.addedPage = target.id;
    out.flagBeforeInject = !!(window.state && window.state._suppressAutoSave);
    /* ★억제 창 «안», 옛 \`= false\` 줄 «바로 앞»에서 한 번 던진다.
       (실제 고장 모양: 손상된 블록에서 레이어 패널 렌더가 터지는 것) */
    var orig = window.buildLayerPanel, fired = false;
    window.buildLayerPanel = function(){
      if (!fired) { fired = true; throw new Error('[H6-probe] buildLayerPanel 강제 예외'); }
      return orig.apply(this, arguments);
    };
    try { await window.switchPage(target.id); }
    catch (e) { out.switchPageThrew = true; out.err = String(e && e.message || e); }
    out.threwInside = fired;
    out.currentAfter = window.state.currentPageId;
    out.flagRightAfter = !!(window.state && window.state._suppressAutoSave);
    window.buildLayerPanel = orig;
    return out;
  })()`, { awaitPromise: true });
  /* ★계측기 자가검증 — 「주입이 «정말» 일어났나」를 먼저 묻는다.
     안 물으면 «아무것도 안 한 실행»이 「고착 없음」으로 읽힌다(이 프로브가 실제로 한 번 그랬다). */
  if (!R.steps.inject || R.steps.inject.threwInside !== true) {
    R.verdict = 'NOT_MEASURED';
    R.notes.push('★주입이 «안 일어났다» — buildLayerPanel 이 안 던졌거나 switchPage 가 조기 return 했다. '
      + '이 실행으로는 고착 유무를 말할 수 없다. inject=' + JSON.stringify(R.steps.inject));
    throw new HarnessError('주입 미발생 — 계측 불성립', R.steps.inject);
  }

  await sleep(500);

  /* ── ⑶ 플래그가 «남았나» ─────────────────────────────────────────────── */
  R.steps.flagAfter = await evalJs(inst.conn, `({
    suppressed: !!(window.state && window.state._suppressAutoSave),
    helper: (typeof window.__autoSaveSuppressState === 'function') ? window.__autoSaveSuppressState() : null,
  })`);

  /* ── ⑷ 그 뒤 편집이 디스크에 «닿나» ─────────────────────────────────── */
  const before = diskMaxMarker(projFile).max;
  for (let i = 0; i < 3; i++) { await makeEdit(inst.conn, led); await sleep(300); }
  let after = before, reached = false;
  const deadline = Date.now() + 25000;
  while (Date.now() < deadline) {
    after = diskMaxMarker(projFile).max;
    if (after >= led.edits.length) { reached = true; break; }
    await sleep(500);
  }
  R.steps.afterStuck = {
    diskBefore: before, diskAfter: after, editsTotal: led.edits.length,
    laterEditsReachedDisk: reached,
  };

  /* 감시견이 «남기는가» (고친 판만) — 시계를 앞으로 밀지 않고 한계를 낮춰 즉시 확인 */
  R.steps.watchdog = await evalJs(inst.conn, `(function(){
    if (!window.AutoSaveSuppress) return { present: false };
    var s = window.__autoSaveSuppressState();
    var r = window.AutoSaveSuppress.evaluateStuck(Date.now() + 10 * 60 * 1000);
    return { present: true, state: s, wouldReport: !!r.report, report: r.report || null };
  })()`);

  R.mainLog = mainLogLines(inst);

  /* ── 종합 ────────────────────────────────────────────────────────────── */
  const stuck = R.steps.flagAfter.suppressed === true;
  const lost = R.steps.afterStuck.laterEditsReachedDisk === false;
  R.stuck = stuck; R.silentLoss = lost;
  R.verdict = stuck || lost ? 'STUCK(고착 재현)' : 'NOT_STUCK(고착 없음)';
  R.summary = `억제 플래그 ${stuck ? '★true 로 남았다' : 'false 로 풀렸다'} · `
    + `그 뒤 편집 ${R.steps.afterStuck.laterEditsReachedDisk ? '디스크 도달 OK' : '★디스크에 «안 닿는다»'} `
    + `(디스크 마커 ${before} → ${after} / 편집 총 ${led.edits.length})`;

} catch (e) {
  R.error = { name: e.name, message: e.message, detail: e.detail || null };
  R.verdict = R.verdict || (e instanceof HarnessError ? 'HARNESS_ERROR' : 'ERROR');
} finally {
  if (inst) { try { R.teardown = await teardown(inst); R.originClean = originClean(inst); } catch (_) {} }
  disarm();
}

R.finishedAt = new Date().toISOString();
if (OUT) { fs.mkdirSync(path.dirname(OUT), { recursive: true }); fs.writeFileSync(OUT, JSON.stringify(R, null, 2)); }
console.log(`\n═══ H6 실기 [${LABEL}] ═══`);
console.log(`체크아웃  ${CHECKOUT}`);
console.log(`빌드      구조헬퍼(AutoSaveSuppress) ${R.build?.hasHelper ? '있음' : '★없음(고치기 전 판)'}`);
console.log(`양성대조  편집3 → 디스크 ${R.steps?.control?.diskMax} · ${R.steps?.control?.landed ? 'OK' : '★실패'}`);
console.log(`주입      switchPage 안에서 던짐=${R.steps?.inject?.threwInside} · switchPage 가 던짐=${R.steps?.inject?.switchPageThrew}`);
console.log(`플래그    억제 남음=${R.steps?.flagAfter?.suppressed}`);
console.log(`이후저장  ${R.summary || '-'}`);
if (R.steps?.watchdog?.present) console.log(`감시견    보고예정=${R.steps.watchdog.wouldReport} · ${R.steps.watchdog.report || '-'}`);
if (R.originClean) console.log(`원본무접촉 ${R.originClean.clean ? 'ORIGIN-CLEAN' : '★위반 ' + R.originClean.offenders}`);
for (const n of R.notes) console.log(`note      ${n}`);
console.log(`판정      ★${R.verdict}`);
if (R.error) console.log(`오류      ${R.error.name}: ${R.error.message}`);
process.exit(R.verdict?.startsWith('HARNESS') || R.verdict === 'ERROR' ? EXIT.HARNESS_ERROR : EXIT.PASS);
