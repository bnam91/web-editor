/* 페이지 «안»에 심는 계측 프로브. comfort-bench.mjs 가 이 파일을 문자열로 읽어 주입한다.
 * 원칙: 제품 코드를 «안» 건드린다 — window.__pb 하나만 새로 만들고, 리스너는 passive 로 붙인다.
 *
 * ⚠️계측 비용 고지: 매 프레임 wrap.scrollLeft/Top 을 읽는다. 팬 경로는 이미 같은 태스크에서
 *   scrollLeft 를 읽고 쓰므로(editor.js 휠 핸들러) 추가 리플로는 사실상 없지만, «유휴» 측정도
 *   같은 프로브로 재서 프로브 비용이 기준선 안에 들어오게 한다.
 */
(() => {
  if (window.__pb) return 'already';
  const wrap = document.getElementById('canvas-wrap');
  const scaler = document.getElementById('canvas-scaler');
  if (!wrap || !scaler) return 'NO-CANVAS';

  const S = {
    frames: [], rid: 0, running: false,
    coordChanges: 0, lastCoord: '', hiddenSeen: false,
    armed: false, pending: null, lat: [], wheelSeen: 0
  };
  /* «화면 좌표가 실제로 바뀌었나» 의 단일 진실.
     팬은 두 곳에 나뉘어 산다 — wrap.scroll* (1차) + scaler transform 잔여(panOffset).
     둘 다 안 보면 「입력은 갔는데 안 움직였다」를 놓친다. */
  const coord = () => wrap.scrollLeft + ',' + wrap.scrollTop + ',' + scaler.style.transform;

  function frame(ts) {
    S.frames.push(ts);
    const c = coord();
    if (c !== S.lastCoord) {
      S.coordChanges++;
      if (S.pending && S.pending.done === null && c !== S.pending.base) {
        S.pending.done = ts - S.pending.t;
        S.lat.push(+S.pending.done.toFixed(2));
      }
      S.lastCoord = c;
    }
    if (document.visibilityState !== 'visible') S.hiddenSeen = true;
    S.rid = requestAnimationFrame(frame);
  }

  addEventListener('wheel', e => {
    S.wheelSeen++;
    if (S.armed && !S.pending) S.pending = { t: e.timeStamp, base: coord(), done: null };
  }, { capture: true, passive: true });

  window.__pb = {
    start(armLatency) {
      S.frames = []; S.coordChanges = 0; S.lastCoord = coord();
      S.hiddenSeen = document.visibilityState !== 'visible';
      S.wheelSeen = 0; S.lat = []; S.pending = null; S.armed = !!armLatency;
      if (!S.running) { S.running = true; S.rid = requestAnimationFrame(frame); }
      return 1;
    },
    /** 다음 휠 «1건»만 지연 측정 대상으로 삼는다(버스트가 아니라 단발이라야 의미가 있다). */
    arm() { S.pending = null; return 1; },
    /** @param t2 «이 기계의 주사율 기준» 드랍 임계(ms). 16.7 고정 임계는 60Hz 아닌 화면에서 거짓말을 한다. */
    stop(t2) {
      if (S.running) { cancelAnimationFrame(S.rid); S.running = false; }
      const f = S.frames, d = [];
      for (let i = 1; i < f.length; i++) d.push(f[i] - f[i - 1]);
      const s = d.slice().sort((a, b) => a - b);
      const q = p => s.length ? +s[Math.min(s.length - 1, Math.floor(s.length * p))].toFixed(2) : null;
      const over = t => d.filter(x => x > t).length;
      const T2 = +t2 || 25;
      return {
        frames: f.length,
        span: f.length > 1 ? +(f[f.length - 1] - f[0]).toFixed(1) : 0,
        p50: q(0.5), p95: q(0.95), max: s.length ? +s[s.length - 1].toFixed(2) : null,
        dropN: over(16.7),
        drop: d.length ? +(over(16.7) / d.length * 100).toFixed(1) : null,
        over33: over(33.4),
        t2: T2, dropN_t2: over(T2), drop_t2: d.length ? +(over(T2) / d.length * 100).toFixed(1) : null,
        coordChanges: S.coordChanges, wheelSeen: S.wheelSeen,
        hiddenSeen: S.hiddenSeen,
        lat: S.lat.slice()
      };
    },
    env() {
      return {
        vis: document.visibilityState, focus: document.hasFocus(),
        screenX: window.screenX, screenY: window.screenY,
        innerW: innerWidth, innerH: innerHeight,
        dprReported: devicePixelRatio,
        zoom: window.currentZoom,
        sections: document.querySelectorAll('#canvas .section-block').length,
        blocks: document.querySelectorAll('#canvas [class*="-block"]').length,
        domNodes: document.getElementById('canvas') ? document.getElementById('canvas').getElementsByTagName('*').length : null,
        canvasH: document.getElementById('canvas') ? document.getElementById('canvas').scrollHeight : null
      };
    },
    /** 캔버스 중앙(뷰포트 좌표) — 휠을 쏠 지점. */
    center() {
      const r = wrap.getBoundingClientRect();
      return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    }
  };
  return 'ok';
})()
