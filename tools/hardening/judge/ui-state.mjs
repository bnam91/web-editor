/* ═══════════════════════════════════════════════════════════════════════════
   judge/ui-state.mjs — «사용자가 아는가» 축의 자. 토스트·저장 인디케이터를 «읽는다».
   ───────────────────────────────────────────────────────────────────────────
   ★★이 파일은 자체 실기에서 «한 번 틀렸다». 그 기록을 남긴다:
     초판은 MutationObserver 의 addedNodes 만 봤다. 그런데 showToast(js/drag-utils.js:192)는
     `#editor-toast` «한 개»를 만들어 두고 textContent 만 갈아 끼운다 —
     ⑴두 번째 토스트부터는 addedNodes 에 «요소»가 안 오고(텍스트 노드만 온다)
     ⑵그 텍스트 노드는 nodeType 3 이라 초판이 즉시 버렸다.
     ⇒ 결과: corrupt 시나리오 두 판이 «TOAST 0건»을 냈다. 그건 「토스트가 없다」가 아니라
       「내 자가 못 봤다」였다. ★그대로 뒀으면 H5 판정 전체가 가짜가 될 뻔했다.
   ⇒ 그래서 지금은 ⑴관측 방식을 둘로 겹치고(옵저버 + 100ms 폴링)
                  ⑵★매 실행마다 «알려진 토스트»를 쏴서 자가 실제로 잡는지 «증명»한다.
     증명이 안 되면 그 실행의 「0건」은 PASS 가 아니라 NOT_MEASURED 다.
   ⛔Page.crash 뒤에는 이 자를 쓰지 마라 — 창이 죽었다(rAF 대기 금지와 같은 이유).
═══════════════════════════════════════════════════════════════════════════ */
import { evalJs } from '../lib/cdp.mjs';
import { waitFor } from '../lib/deadline.mjs';

export const PROBE_PREFIX = '[H7-TOAST-PROBE]';

const RECORDER_SRC = `(function(){
  if (window.__h7Toasts) return 'already';
  window.__h7Toasts = [];
  var SEL = '#editor-toast, .toast, [class*="toast"]';
  var last = Object.create(null);
  function record(el){
    if (!el) return;
    var txt = String(el.textContent || '').trim();
    if (!txt) return;
    var key = (el.id || el.className || 'anon') + '|' + txt;
    var now = Date.now();
    // 같은 «요소+문구»가 2초 안에 다시 오면 같은 토스트로 본다(중복 방지)
    if (last[key] && now - last[key] < 2000) return;
    last[key] = now;
    window.__h7Toasts.push({ at: now, text: txt.slice(0,300),
      id: el.id || null, shown: !!(el.className && String(el.className).indexOf('show') >= 0) });
  }
  function sweep(){
    var els = document.querySelectorAll(SEL);
    for (var i=0;i<els.length;i++) record(els[i]);
  }
  // ⑴옵저버 — 즉시성. ★target 도 본다(텍스트 노드 교체는 addedNodes 가 «텍스트»다).
  try {
    new MutationObserver(function(ms){
      for (var i=0;i<ms.length;i++){
        var t = ms[i].target;
        var el = (t && t.nodeType === 1) ? t : (t && t.parentElement);
        if (el && el.closest) { var c = el.closest(SEL); if (c) record(c); }
      }
      sweep();
    }).observe(document.documentElement, { childList:true, subtree:true, characterData:true,
                                           attributes:true, attributeFilter:['class'] });
  } catch(e) {}
  // ⑵폴링 — 안전망. 토스트는 2초 산다(drag-utils.js:192-204) → 100ms 면 못 놓친다.
  try { window.__h7ToastTimer = setInterval(sweep, 100); } catch(e) {}
  sweep();
  return 'installed';
})()`;

/** 수집기를 심는다. 리로드에도 살도록 addScriptToEvaluateOnNewDocument 로도 건다. */
export async function installToastRecorder(conn) {
  await conn.send('Page.addScriptToEvaluateOnNewDocument', { source: RECORDER_SRC });
  return evalJs(conn, RECORDER_SRC);
}

export async function readToasts(conn) {
  return JSON.parse(await evalJs(conn, 'JSON.stringify(window.__h7Toasts||[])') || '[]');
}

/**
 * ★자가 증명 — «알려진» 토스트를 쏘고 수집기가 잡는지 본다.
 *   ⛔이게 실패하면 그 실행의 「토스트 0건」은 «못 쟀다»이지 «없다»가 아니다.
 *   ⚠️제품의 showToast 를 그대로 쓴다(내가 DOM 을 직접 만들면 «내 것만» 잡는 자가 된다).
 */
export async function proveToastRecorder(conn, { timeout = 4000 } = {}) {
  const tag = `${PROBE_PREFIX}${Date.now()}`;
  const fired = await evalJs(conn,
    `(function(){ if (typeof window.showToast !== 'function') return 'no-showToast';
       window.showToast(${JSON.stringify(tag)}); return 'fired'; })()`);
  if (fired !== 'fired') return { proven: false, reason: `showToast 가 없다(${fired})`, tag };
  try {
    await waitFor(async () => (await readToasts(conn)).some(t => t.text.includes(tag)),
      { timeout, interval: 100, label: '토스트 수집기 자가증명' });
    return { proven: true, tag };
  } catch (e) {
    return { proven: false, reason: `쐈는데 «못 잡았다»: ${e.message}`, tag };
  }
}

/** 저장 인디케이터 «현재» 상태. 빨강(저장 실패)은 영속이라 사후에도 읽힌다. */
export async function readSaveIndicator(conn) {
  return evalJs(conn, `(function(){
    var el = document.querySelector('#autosave-indicator, #save-indicator, [class*="autosave"], [class*="save-indicator"]');
    if (!el) return { found:false };
    var cs = getComputedStyle(el);
    return { found:true, id: el.id||null, cls: String(el.className||''),
             text: String(el.textContent||'').trim().slice(0,200),
             color: cs.color, display: cs.display, visible: el.offsetParent !== null || cs.position==='fixed' };
  })()`);
}

/** 링버퍼 내용 — 「사용자는 몰라도 우리는 아는가」 축. */
export async function readReportBuffer(conn) {
  return JSON.parse(await evalJs(conn,
    'JSON.stringify((window.ReportBuffer && window.ReportBuffer.list && window.ReportBuffer.list()) || [])') || '[]');
}

/**
 * @param proof  proveToastRecorder() 결과. ⛔없거나 proven:false 면 「0건」은 NOT_MEASURED 다.
 */
export function judgeToast(toasts, { mustMatch = null, mustNotMatch = null, proof = null } = {}) {
  const real = toasts.filter(t => !t.text.startsWith(PROBE_PREFIX));   // 자가증명용은 뺀다
  const texts = real.map(t => t.text);
  const hit = mustMatch ? texts.some(t => t.includes(mustMatch)) : null;
  const bad = mustNotMatch ? texts.filter(t => t.includes(mustNotMatch)) : [];

  const res = { judge: 'TOAST', count: real.length, texts, mustMatch, hit, unexpected: bad,
    recorderProven: proof ? !!proof.proven : null };

  if (!proof || !proof.proven) {
    /* ★★수집기가 «잡는다»는 증명이 없으면 어떤 결론도 못 낸다.
       특히 「0건」을 PASS 로 읽는 순간 그게 가짜 초록이다(초판이 실제로 그랬다). */
    res.verdict = 'NOT_MEASURED'; res.pass = null;
    res.notMeasured = `토스트 수집기 자가증명 실패${proof ? ': ' + proof.reason : '(증명을 안 했다)'} — ` +
      `«${real.length}건»이라는 수를 믿을 수 없다`;
  } else {
    res.pass = (mustMatch ? hit : true) && bad.length === 0;
    res.verdict = res.pass ? 'PASS' : 'FAIL';
  }
  res.summary = `TOAST ${res.verdict} — ${real.length}건` +
    (mustMatch ? ` · «${mustMatch}» ${hit ? '있음' : '없음'}` : '') +
    (res.recorderProven === true ? ' · 수집기 자가증명 OK' : ' · ⚠️수집기 미증명') +
    (real.length ? ` :: ${texts.map(t => t.slice(0, 60)).join(' | ')}` : '');
  return res;
}
