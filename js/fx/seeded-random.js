/* ═══════════════════════════════════════════════════════════════════════════
   fx/seeded-random.js — «씨앗 고정 난수» 단일 원본 (이펙트 공용 부품).
   ───────────────────────────────────────────────────────────────────────────
   ★왜 있나 (2026-10-06 지디 발주 FOUR ④)
     이펙트(글로우 스티커 · 다음은 파티클)는 「찍을 때마다 각기 다른 모습」이어야 하고(현빈),
     동시에 «저장한 모습은 다시 열어도 같아야» 한다(리로드·썸네일·내보내기·undo 가 매번 다시 그린다).
     ⇒ 모습의 흔들림은 Math.random 이 아니라 «저장된 seed» 에서만 뽑는다.
   ★왜 «공용»인가: 소비자마다 PRNG 를 따로 만들면 같은 seed 가 다른 그림을 낸다 = 명부가 둘이 된다.
     소비자: ① js/fx/glow-render.js(글로우 스티커) — 파티클이 붙으면 둘째로 여기 적는다.
     회귀: tests/dom/fx-glow-sticker.dom.spec.js (무력화하면 소비자 수만큼 빨강 — 지금 1).
   레포 선례 0 (2026-10-06 · 판 5a859e11 · js·main·pages·index.html·main.js·preload.js·services·tools·scripts 에서
     mulberry|xorshift|sfc32|splitmix|seededRandom|rng/prng 함수명 grep = 0 파일).
   ⚠️고전 스크립트다 — 고전·모듈 둘 다 window 로 읽게(feature-flags.js 와 같은 까닭). 이름이 소비자 함수와 겹치지 않게
     네임스페이스 하나(FxSeed)로 낸다(같은 이름 최상위 function 이 전역을 덮는 함정 — 2026-10-06 CollabReasons).
═══════════════════════════════════════════════════════════════════════════ */
(function (w) {
  /** mulberry32 — 32비트 seed → [0,1) 수열. 같은 seed = 같은 수열(엔진·기계 무관 · 정수 연산만). */
  function mulberry32(seed) {
    let a = (seed >>> 0) || 0x9e3779b9;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /** 새 seed — «만들 때»와 [다시 뿌리기] 때만 부른다. ⛔그리기(render) 안에서 부르지 마라(리로드마다 모습이 바뀐다). */
  function newSeed() {
    return (Math.floor(Math.random() * 0xFFFFFFFF) >>> 0) || 1;
  }

  /** 편의: rng 에서 [lo,hi) 실수 · ±amp 흔들림. */
  const range = (rng, lo, hi) => lo + (hi - lo) * rng();
  const jitter = (rng, amp) => (rng() * 2 - 1) * amp;

  w.FxSeed = Object.freeze({ mulberry32, newSeed, range, jitter });
})(window);
