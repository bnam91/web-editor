/* ═══════════════════════════════════════════════════════════════════════════
   break/crash.mjs — 렌더러 크래시 · GPU 크래시 · 행(hang).
   ───────────────────────────────────────────────────────────────────────────
   ★크래시 «판정»은 3채널만이다(골 §5.6). 이 파일이 세 채널을 전부 관측하고,
     ⑴채널(Runtime.exceptionThrown)이 «구독 중이 아니었으면» fatalVerdictValid:false 를
     결과에 박는다 — 「안 났다」와 「못 봤다」를 절대 안 섞는다.
   ⛔함정1(PLAN §5 H2 ⑶): Page.crash 뒤 rAF 계열 대기 금지 — 창이 죽었다.
     그래서 크래시 뒤 모든 관측은 «소켓/포트/파일»로만 한다.
   ⛔Page.crash 는 «응답이 안 온다». 기다리면 매달린다 → trySend + 짧은 상한.
═══════════════════════════════════════════════════════════════════════════ */
import { HarnessError, sleep, didHappenWithin, waitFor } from '../lib/deadline.mjs';
import { portAlive, attachBrowser, evalFireAndForget, evalJs } from '../lib/cdp.mjs';

/** 세 채널 관측기. 크래시를 «내기 전»에 만들어야 한다(과거 이벤트는 못 본다). */
export function watchChannels(conn) {
  const hits = { exceptionThrown: [], targetCrashed: [], socketClosed: null };
  const off = conn.on(ev => {
    if (ev.method === 'Runtime.exceptionThrown') hits.exceptionThrown.push(ev);
    if (ev.method === 'Inspector.targetCrashed') hits.targetCrashed.push(ev);
  });
  return {
    hits, off,
    subscribed: !!conn.exceptionSubscribed,
    snapshot() {
      hits.socketClosed = conn.closed ? conn.closeReason : null;
      return { ...hits, subscribed: !!conn.exceptionSubscribed };
    },
  };
}

/** ⑴렌더러 크래시. */
export async function crashRenderer(inst, { settleMs = 3000 } = {}) {
  const conn = inst.conn;
  if (!conn) throw new HarnessError('crashRenderer: 붙은 페이지가 없다');
  const w = watchChannels(conn);
  const at = Date.now();
  const r = await conn.trySend('Page.crash', {}, { timeout: 2500 });  // 응답 없음이 «정상»
  await sleep(settleMs);
  const ch = w.snapshot(); w.off();
  const portUp = await portAlive(inst.port, 2000);
  const res = {
    breaker: 'crash-renderer', at, cdpCall: r,
    channels: {
      exceptionThrown: ch.exceptionThrown.length,
      targetCrashed: ch.targetCrashed.length,
      socketClosed: ch.socketClosed,          // = Target destroyed 채널
      portAlive: portUp,                       // = main exit 채널(살아 있으면 메인은 안 죽었다)
    },
    exceptionSubscribed: ch.subscribed,
    fatalVerdictValid: ch.subscribed,          // ★구독 없이 돈 실행은 치명④ 판정 «무효»
  };
  res.hit = ch.targetCrashed.length > 0 || !!ch.socketClosed;
  res.sanity = res.hit
    ? `렌더러가 죽었다 — targetCrashed ${ch.targetCrashed.length} · socket ${ch.socketClosed || '살아있음'}`
    : `⚠️크래시 «흔적 없음» — Page.crash 가 안 먹었을 수 있다(sanity 미달)`;
  res.summary = `crash-renderer ${res.hit ? 'HIT' : 'MISS'} — 메인 ${portUp ? '생존' : '죽음'} · ` +
    `판정유효 ${res.fatalVerdictValid}`;
  if (!res.hit) throw new HarnessError(res.sanity, res);
  return res;
}

/** ⑵GPU 크래시. 브라우저 타깃에 걸어야 한다(페이지 타깃엔 이 명령이 없다). */
export async function crashGpu(inst, { settleMs = 3000 } = {}) {
  const b = await attachBrowser(inst.port);
  const at = Date.now();
  let call;
  try { call = await b.trySend('Browser.crashGpuProcess', {}, { timeout: 4000 }); }
  finally { /* 소켓은 아래에서 닫는다 */ }
  await sleep(settleMs);
  const portUp = await portAlive(inst.port, 2000);
  let pageAlive = false, pageErr = null;
  try { pageAlive = (await evalJs(inst.conn, '1+1', { timeout: 4000 })) === 2; }
  catch (e) { pageErr = e.message; }
  try { b.close(); } catch (_) {}
  const res = {
    breaker: 'crash-gpu', at, cdpCall: call,
    channels: { portAlive: portUp, pageAlive, pageErr, socketClosed: inst.conn.closed ? inst.conn.closeReason : null },
    exceptionSubscribed: !!inst.conn.exceptionSubscribed,
    fatalVerdictValid: !!inst.conn.exceptionSubscribed,
  };
  // ★GPU 크래시는 «앱이 살아 있는 게 정상»이다(Chromium 이 GPU 를 재시작한다).
  //   그래서 hit 판정은 「명령이 받아들여졌나」로 본다 — 죽는지 여부가 아니라.
  res.hit = !!(call && call.ok);
  res.sanity = res.hit ? 'Browser.crashGpuProcess 수락됨' : `⚠️명령 거부/실패: ${call && call.error}`;
  res.summary = `crash-gpu ${res.hit ? 'HIT' : 'MISS'} — 메인 ${portUp ? '생존' : '죽음'} · 페이지 ${pageAlive ? '응답' : '무응답'}`;
  if (!res.hit) throw new HarnessError(res.sanity, res);
  return res;
}

/** ⑶행(hang) — 렌더러를 busy loop 로 잠재우고 «무응답임»을 잰다. */
export async function hangRenderer(inst, { busyMs = 12000, probeTimeout = 4000 } = {}) {
  const conn = inst.conn;
  const at = Date.now();
  // 응답을 «기다리지 않는» 평가. 기다리면 이 하네스가 같이 매달린다.
  evalFireAndForget(conn, `(function(){var t=Date.now();while(Date.now()-t<${busyMs}){}})()`);
  await sleep(300);
  // ★행 판정 = 「상한 안에 응답이 «없어야» 정상」. 그래서 didHappenWithin(던지지 않는 자)을 쓴다.
  const probe = await didHappenWithin(async () => {
    try { return (await evalJs(conn, '1+1', { timeout: probeTimeout })) === 2; } catch (_) { return false; }
  }, { timeout: probeTimeout, interval: 400 });
  const res = {
    breaker: 'hang', at, busyMs,
    respondedWhileBusy: probe.happened, probeMs: probe.ms,
    hit: !probe.happened,
  };
  res.sanity = res.hit ? `busy loop 동안 ${probe.ms}ms 무응답 확인` : `⚠️busy loop 를 걸었는데 «응답했다» — 주입 실패(sanity 미달)`;
  // 풀릴 때까지 «상한 안에서» 기다린다. 안 풀리면 HARNESS_ERROR.
  await waitFor(async () => {
    try { return (await evalJs(conn, '1+1', { timeout: 3000 })) === 2; } catch (_) { return false; }
  }, { timeout: busyMs + 20000, interval: 500, label: 'busy loop 해제 대기' });
  res.recoveredAfterMs = Date.now() - at;
  res.summary = `hang ${res.hit ? 'HIT' : 'MISS'} — 무응답 ${probe.ms}ms · ${res.recoveredAfterMs}ms 뒤 회복`;
  if (!res.hit) throw new HarnessError(res.sanity, res);
  return res;
}
