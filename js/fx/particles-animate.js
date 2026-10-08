/* ═══════════════════════════════════════════════════════════════════════════
   fx/particles-animate.js — 섹션 배경 파티클의 «움직임» (v1.5 ⑴ · 2026-10-09)
   ───────────────────────────────────────────────────────────────────────────
   ★현빈 2026-10-08 「빠진게 있지않니 파티클 효과에? 시안대로 — ★패닝효과」
   ★시안 = artifact BcCGv6AJJCp7o4pfNouY9N 「패닝 컨페티 — 네 판 비교」

   ★★왜 ★rAF 인가 — ★★후보 셋을 ★재서 골랐다(2026-10-08 실측 · ⛔추측 아님):
     ㉠ SMIL `<animateTransform>` ⇒ ★★탈락. ★html2canvas 가 ★★«t=0 프레임»을 찍는다.
        ★0.9초 간격 두 캡처: ★화면은 40×8 → 41×13 으로 움직였는데 ★캡처는 ★40×8 → ★40×8 이었다.
        ⇒ ★썸네일·PNG 가 ★화면과 ★영구히 갈린다 = ★「같은 시드 = 같은 그림」 계약의 바깥 얼굴.
     ㉡ CSS `@keyframes` ⇒ ★캡처는 ★따라온다. ★그러나 ★★«SVG 속성»을 ★못 만진다
        ⇒ ★⒟(번짐을 속도에 묶기)는 ★`feGaussianBlur` 의 `stdDeviation` 이라 ★CSS 로 ★못 간다
        ⇒ ★회전은 CSS · 번짐은 JS 로 ★길이 ★둘이 되고, ★어차피 ★rAF 루프가 ★하나 필요해진다
        ⇒ ★★명부를 ★둘로 ★안 만든다.
     ㉢ ★★rAF ⇒ ★캡처 따라옴 ＋ ★⒟ 가능 ＋ ★★«뷰포트 컬링»을 ★쓸 수 있는 ★유일한 길.

   ★★`step()` 이 ★«순수에 가까운» 함수인 ★까닭 — ⛔검사가 ★프레임을 ★기다리지 않게.
     ★부하는 ★느리게만이 아니라 ★★«틀리게»도 만든다 — ★고정 대기 위에 선 검사는 ★값을 ★잃는다.
     ⇒ ★검사는 ★`step(2000)` 처럼 ★시각을 ★손으로 넣어 ★결정적으로 잰다.

   ★★좌표를 ★여기서 ★다시 계산하지 ★않는다 — ★그리개가 ★`data-fxp` 로 ★적어 준다.
     ★★까닭: ★같은 시드 흐름을 ★두 곳에서 뽑으면 ★★명부가 ★둘이고, ★어느 날 ★갈린다.
     ★그 꼬리표는 ★★«움직이는 판»에서만 붙는다 ⇒ ★옛 저장본은 ★글자가 ★한 자도 ★안 바뀐다(★inert).

   ⛔★아직 ★안 한 것(★v1.5 ⑵⑶ · ★이 파일의 ★다음 두 칸):
     ⑵ `prefers-reduced-motion` ★JS 가드 — ★★CSS `@media` 로는 ★안 멈춘다(★우리는 ★속성을 ★쓴다)
     ⑶ ★뷰포트 컬링 — ★실측: ★섹션 20에서 ★전부 돌리면 ★프레임중앙 ★16.7ms,
        ★보이는 것만 돌리면 ★8.3ms(★둘 다 ★퍼짐 0ms · 같은 조건 ×3).
        ⇒ ★★그때까지 ★이 루프는 ★★«안 보이는 섹션까지» 돈다. ★그게 ★지금의 ★한계다.
   ═══════════════════════════════════════════════════════════════════════════ */
(function (w) {
  'use strict';

  /** 위아래 여유 — 알맹이가 상자를 벗어난 뒤 ★되돌아올 자리. ⛔화면 밖에서 사라져 보이지 않게. */
  const MARGIN = 40;
  /** 움직일 것이 0 일 때 ★다시 볼 주기(ms) — ★루프를 ★세우고 ★이 간격으로만 깨운다. */
  const IDLE_RECHECK_MS = 1000;

  /** 한 알맹이의 ★세로 어긋남. ★★순수 함수다 — ★검사가 ★이것만 따로 잴 수 있다.
   *  ★`y0` 에서 출발해 ★아래로 흐르고 ★상자를 지나면 ★위로 되돌아온다(감싸기).
   *  ★★`speed` 가 0 이면 ★언제나 0 을 돌려준다 — ★「안 움직인다」가 ★이 함수의 성질이지
   *    ★부르는 쪽의 ★분기가 ★아니다(⇒ ★분기가 ★둘로 갈리지 않는다). */
  function offsetY(tSec, y0, vj, speed, H) {
    if (!(speed > 0)) return 0;
    const span = H + 2 * MARGIN;
    if (!(span > 0)) return 0;
    const raw = y0 + MARGIN + tSec * speed * vj;
    const y = ((raw % span) + span) % span - MARGIN;   // ★음수 시각에서도 감싸기가 선다
    return y - y0;
  }

  /** 한 알맹이의 ★각도. ★`spin` 이 0 이면 ★처음 각 그대로(= 그리개가 넣은 무작위 각). */
  function angleAt(tSec, rot0, spin, dir) {
    if (!(spin > 0)) return rot0;
    return rot0 + tSec * spin * dir;
  }

  /* ★읽어 둔 알맹이 — ★svg 요소가 ★그대로면 ★다시 안 읽는다.
     ★다시 그리면 ★새 svg 요소가 나므로 ★저절로 ★빗나간다(⛔무효화를 손으로 안 한다). */
  const cache = new WeakMap();

  /** 꼬리표 한 줄 → 수 다섯. ⛔꼴이 틀리면 ★그 알맹이를 ★버린다(★조용히 0 으로 안 때운다). */
  function parseTag(el) {
    const raw = el.getAttribute('data-fxp');
    if (!raw) return null;
    const a = raw.split(',');
    if (a.length !== 5) return null;
    const n = a.map(Number);
    if (n.some((v) => !Number.isFinite(v))) return null;
    return { el, x: n[0], y: n[1], vj: n[2], dir: n[3], rot0: n[4] };
  }

  /** 한 층(svg)의 알맹이 명부 ＋ 상자 높이. ★높이는 ★`viewBox` 에서 — ⛔`clientHeight` 가 아니다
   *  (★좌표가 ★난 자리가 ★viewBox 다. ★상자가 CSS 로 늘면 ★둘이 갈린다). */
  function readLayer(svg) {
    const hit = cache.get(svg);
    if (hit) return hit;
    const vb = String(svg.getAttribute('viewBox') || '').trim().split(/\s+/).map(Number);
    const H = (vb.length === 4 && Number.isFinite(vb[3])) ? vb[3] : 0;
    const bits = [];
    const list = svg.querySelectorAll('[data-fxp]');
    for (let i = 0; i < list.length; i++) {
      const b = parseTag(list[i]);
      if (b) bits.push(b);
    }
    const rec = { H, bits };
    cache.set(svg, rec);
    return rec;
  }

  /** 지금 ★움직여야 할 층 전수. ★설정은 ★섹션의 dataset 에서 — ★그리개와 ★같은 정본이다. */
  function scan(root) {
    const doc = root || w.document;
    if (!doc || !doc.querySelectorAll) return [];
    const out = [];
    const wraps = doc.querySelectorAll('.sec-fxpart-wrap');
    for (let i = 0; i < wraps.length; i++) {
      const wrap = wraps[i];
      const sec = wrap.parentElement;
      const svg = wrap.querySelector('svg');
      if (!sec || !svg) continue;
      let cfg = null;
      try { cfg = w.readParticles ? w.readParticles(sec.dataset) : null; } catch (_) { cfg = null; }
      if (!cfg) continue;
      const speed = +cfg.speed || 0, spin = +cfg.spin || 0;
      if (speed <= 0 && spin <= 0) continue;        /* ★축이 전부 0 = ★옛 저장본 ⇒ ★건드리지 않는다 */
      const lay = readLayer(svg);
      if (!lay.bits.length || !(lay.H > 0)) continue;
      out.push({ svg, speed, spin, H: lay.H, bits: lay.bits });
    }
    return out;
  }

  /** ★한 프레임 — ★시각(ms)을 ★받는다. ⛔`performance.now()` 를 ★안 읽는다(검사가 못 고정한다).
   *  @returns {number} ★움직인 알맹이 수 — ★검사가 ★「정말 돌았나」를 ★이 수로 잰다. */
  function step(tMs, root) {
    const t = (+tMs || 0) / 1000;
    const layers = scan(root);
    let moved = 0;
    for (let i = 0; i < layers.length; i++) {
      const L = layers[i];
      for (let j = 0; j < L.bits.length; j++) {
        const b = L.bits[j];
        const dy = offsetY(t, b.y, b.vj, L.speed, L.H);
        const ang = angleAt(t, b.rot0, L.spin, b.dir);
        b.el.setAttribute('transform',
          'translate(0,' + (Math.round(dy * 10) / 10) + ') rotate('
          + (Math.round(ang * 10) / 10) + ' ' + b.x + ' ' + b.y + ')');
        moved++;
      }
    }
    return moved;
  }

  /* ── 루프 ──────────────────────────────────────────────────────────────── */
  let rafId = 0, idleId = 0, t0 = 0;

  function frame(now) {
    rafId = 0;
    if (!t0) t0 = now;
    const moved = step(now - t0);
    if (moved > 0) { rafId = w.requestAnimationFrame(frame); return; }
    /* ★움직일 것이 ★없다 ⇒ ★루프를 ★세운다. ⛔빈 루프를 돌리면 ★편집기가 ★쉬지 못한다.
       ★그리고 ★느린 주기로만 ★다시 본다(★켜지면 ★그때 ★루프가 ★다시 선다). */
    idleId = w.setTimeout(() => { idleId = 0; start(); }, IDLE_RECHECK_MS);
  }

  function start() {
    if (rafId || !w.requestAnimationFrame) return false;
    if (idleId) { w.clearTimeout(idleId); idleId = 0; }
    if (!scan().length) {                         /* ★없으면 ★굳이 ★프레임을 ★안 잡는다 */
      idleId = w.setTimeout(() => { idleId = 0; start(); }, IDLE_RECHECK_MS);
      return false;
    }
    rafId = w.requestAnimationFrame(frame);
    return true;
  }

  function stop() {
    if (rafId) { w.cancelAnimationFrame(rafId); rafId = 0; }
    if (idleId) { w.clearTimeout(idleId); idleId = 0; }
    t0 = 0;
  }

  /** 다시 그린 뒤 부르면 ★바로 깨어난다(★느린 주기를 ★안 기다린다). */
  function kick() { stop(); return start(); }

  w.ParticlesAnim = Object.freeze({ offsetY, angleAt, scan, step, start, stop, kick, MARGIN, IDLE_RECHECK_MS });
})(window);
