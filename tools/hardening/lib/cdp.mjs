/* ═══════════════════════════════════════════════════════════════════════════
   cdp.mjs — 이 하네스 전용 최소 CDP 클라이언트.
   ───────────────────────────────────────────────────────────────────────────
   ★왜 자체 구현인가: 크래시를 «일부러» 내는 도구다. 크래시 뒤에도 살아서
     「무엇이 죽었나」를 말해야 하는데, 대부분의 클라이언트는 소켓이 끊기면
     그냥 던지거나 조용히 매달린다. 여기서는 «끊김 자체»가 판정 채널이다.

   ★크래시 판정 3채널 (골 §5.6 — 이 밖의 채널로 치명④를 말하면 무효)
     ⑴ Runtime.exceptionThrown 구독 히트
     ⑵ Target destroyed (= 페이지 소켓 끊김)
     ⑶ main exit / 포트 소멸
   ⛔ ⑴은 «구독 중일 때만» 잡힌다. 그래서 이 클라이언트는 구독 여부를 스스로
     기록하고(`exceptionSubscribed`), 구독 없이 돈 실행의 결과에는
     `fatalVerdictValid:false` 가 찍힌다 — 「안 났다」와 「못 봤다」를 가른다.

   ★소유권 (harness.md §3-c ⑶-c)
     `--verify` 는 «프로세스»만 본다. «내가 어디로 navigate 했는지»는 안 본다.
     그래서 attach 직후 location.href 를 읽어 기대 체크아웃과 대조하는
     assertPageOwnership() 을 둔다 — 실사고 4케이스가 이걸 안 해서 폐기됐다.
═══════════════════════════════════════════════════════════════════════════ */
import { createRequire } from 'node:module';
import path from 'node:path';
import { HarnessError, withDeadline, waitFor, sleep } from './deadline.mjs';

const require_ = createRequire(import.meta.url);
const WebSocket = require_('ws');

const DEFAULT_TIMEOUT = 15000;

async function httpJson(url, timeoutMs = 5000) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const r = await fetch(url, { signal: ac.signal });
    return await r.json();
  } finally { clearTimeout(t); }
}

export async function listTargets(port, timeoutMs = 5000) {
  return httpJson(`http://127.0.0.1:${port}/json/list`, timeoutMs);
}
export async function browserVersion(port, timeoutMs = 5000) {
  return httpJson(`http://127.0.0.1:${port}/json/version`, timeoutMs);
}
/** 포트가 살아 있나 — 채널⑶(main exit)의 관측기. */
export async function portAlive(port, timeoutMs = 2000) {
  try { await browserVersion(port, timeoutMs); return true; } catch (_) { return false; }
}

class Conn {
  constructor(ws, label) {
    this.ws = ws; this.label = label;
    this.id = 0; this.pending = new Map();
    this.events = [];            // {method, params, at}
    this.listeners = new Set();
    this.closed = false; this.closeReason = null;
    this.exceptionSubscribed = false;
    ws.on('message', raw => {
      let m; try { m = JSON.parse(raw.toString()); } catch (_) { return; }
      if (m.id != null && this.pending.has(m.id)) {
        const { res, rej } = this.pending.get(m.id); this.pending.delete(m.id);
        m.error ? rej(new Error(`${this.label} CDP error: ${m.error.message || JSON.stringify(m.error)}`)) : res(m.result);
        return;
      }
      if (m.method) {
        const ev = { method: m.method, params: m.params, at: Date.now() };
        this.events.push(ev);
        for (const l of this.listeners) { try { l(ev); } catch (_) {} }
      }
    });
    const die = reason => {
      if (this.closed) return;
      this.closed = true; this.closeReason = reason;
      for (const { rej } of this.pending.values()) rej(new HarnessError(`${this.label} 소켓 끊김: ${reason}`));
      this.pending.clear();
    };
    ws.on('close', (c) => die(`close(${c})`));
    ws.on('error', (e) => die(`error(${e && e.message})`));
  }

  /** ⛔모든 호출에 상한. 소켓이 죽어 있으면 «즉시» 던진다(매달리지 않는다). */
  send(method, params = {}, { timeout = DEFAULT_TIMEOUT } = {}) {
    if (this.closed) return Promise.reject(new HarnessError(`${this.label} 이미 끊김(${this.closeReason}) — ${method}`));
    const id = ++this.id;
    const p = new Promise((res, rej) => {
      this.pending.set(id, { res, rej });
      try { this.ws.send(JSON.stringify({ id, method, params })); }
      catch (e) { this.pending.delete(id); rej(e); }
    });
    return withDeadline(p, timeout, `CDP ${method} (${this.label})`);
  }

  /** 던지지 않는 호출 — 크래시를 «내는» 명령처럼 응답이 안 오는 게 정상인 자리용. */
  async trySend(method, params = {}, opts = {}) {
    try { return { ok: true, result: await this.send(method, params, opts) }; }
    catch (e) { return { ok: false, error: e.message }; }
  }

  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  eventsOf(method) { return this.events.filter(e => e.method === method); }
  close() { try { this.ws.close(); } catch (_) {} this.closed = true; }
}

async function open(wsUrl, label, timeoutMs = 10000) {
  const ws = new WebSocket(wsUrl, { perMessageDeflate: false, maxPayload: 512 * 1024 * 1024 });
  await withDeadline(new Promise((res, rej) => {
    ws.once('open', res); ws.once('error', rej);
  }), timeoutMs, `CDP 연결 ${label}`);
  return new Conn(ws, label);
}

/** 브라우저 타깃(GPU 크래시·프로세스 정보용). */
export async function attachBrowser(port, { timeout = 10000 } = {}) {
  const v = await browserVersion(port);
  if (!v.webSocketDebuggerUrl) throw new HarnessError(`포트 ${port} 에 브라우저 WS 엔드포인트가 없다`);
  return open(v.webSocketDebuggerUrl, `browser:${port}`, timeout);
}

/**
 * 페이지 타깃에 붙는다.
 * @param match  URL 부분문자열(예 'index.html'). 여러 개면 «맨 앞» — 애매하면 던진다.
 */
export async function attachPage(port, { match = '', timeout = 20000, subscribeExceptions = true } = {}) {
  const t = await waitFor(async () => {
    const list = await listTargets(port);
    const pages = list.filter(x => x.type === 'page' && String(x.url).includes(match) && x.webSocketDebuggerUrl);
    return pages.length ? pages : null;
  }, { timeout, interval: 250, label: `페이지 타깃 대기 (port=${port}, match=${match || '*'})` });

  if (t.length > 1) {
    throw new HarnessError(`포트 ${port} 에 조건에 맞는 페이지가 ${t.length}개 — 대상이 애매하다(TARGET_MISMATCH)`,
      { urls: t.map(x => x.url) });
  }
  const c = await open(t[0].webSocketDebuggerUrl, `page:${port}`, 10000);
  c.targetUrl = t[0].url;
  await c.send('Runtime.enable');
  await c.send('Page.enable');
  if (subscribeExceptions) c.exceptionSubscribed = true;   // Runtime.enable 이 곧 구독이다
  return c;
}

/** ★소유권 검사 — 「내가 잰 것이 그 체크아웃인가」. 프로세스 소유권과 «다른 것». */
export async function assertPageOwnership(conn, expectedCheckoutDir) {
  const href = (await conn.send('Runtime.evaluate',
    { expression: 'location.href', returnByValue: true })).result.value;
  const real = path.resolve(expectedCheckoutDir);
  const enc = encodeURI(`file://${real}`);
  const ok = String(href).includes(`file://${real}`) || String(href).includes(enc);
  if (!ok) {
    throw new HarnessError(
      `★페이지 소유권 불일치 — 이 탭은 «${expectedCheckoutDir}» 것이 아니다. 남의 작업본을 잴 참이었다`,
      { href, expected: real });
  }
  return href;
}

/** 값을 돌려받는 평가. 던지면 던진다. */
export async function evalJs(conn, expression, { timeout = DEFAULT_TIMEOUT, awaitPromise = false } = {}) {
  const r = await conn.send('Runtime.evaluate',
    { expression, returnByValue: true, awaitPromise }, { timeout });
  if (r.exceptionDetails) {
    throw new HarnessError(`Runtime.evaluate 가 던졌다: ${r.exceptionDetails.text} ${r.exceptionDetails.exception?.description || ''}`);
  }
  return r.result?.value;
}

/** 응답을 «기다리지 않는» 평가 — 행(hang) 주입용. */
export function evalFireAndForget(conn, expression) {
  const id = ++conn.id;
  try { conn.ws.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression } })); }
  catch (_) {}
  return id;
}

export { Conn, sleep };
