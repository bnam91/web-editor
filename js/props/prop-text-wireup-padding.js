/* prop-text-wireup-padding.js
 * padding 상하 + padding 좌우 (chain-link 토글 포함)
 * R2: phLinked는 인자로 받아 내부 let으로 복사 → 자유롭게 mutate
 * ★재설계 1차 ⑤(Q26 현빈 261120) — 잠금/풂을 블럭에 저장한다: tb.dataset.padXLinked '1'|'0'(data-pad-x-linked).
 *   읽기 = prop-text.js(칸 없으면 옛 저장본 → 좌 = 우 이면 잠금). 잠금 = «좌우패딩» 한 줄(#txt-ph-*) · 풂 = 좌측·우측 줄.
 */

export function wirePaddingSection({ tb, phLinked: phLinkedArg }) {
  let phLinked = phLinkedArg; // R2: 내부 가변 복사본

  /* ★표준 Layout(C3 · 현빈 261124 L-4/7) — 패딩 슬라이더 넷 걷음 · 숫자 칸·잠금 사슬·키 그대로 */
  const pvNumber = document.getElementById('txt-pv-number');
  pvNumber?.addEventListener('input', () => { const v=Math.min(120,Math.max(0,parseInt(pvNumber.value)||0)); tb.style.paddingTop=v+'px'; tb.style.paddingBottom=v+'px'; });

  /* 좌우 패딩 */
  const plNumber = document.getElementById('txt-pl-number');
  const prNumber = document.getElementById('txt-pr-number');
  const chainBtn = document.getElementById('txt-ph-chain');
  const phNumber = document.getElementById('txt-ph-number');
  /* 잠금 = «좌우패딩» 한 줄만 · 풂 = 그 줄의 슬라이더 자리는 비우고(사슬 자리 그대로) 좌측·우측 줄 */
  const showLinked = () => {
    for (const el of [phNumber]) if (el) el.style.visibility = phLinked ? '' : 'hidden';
    for (const id of ['txt-pl-row', 'txt-pr-row']) { const r = document.getElementById(id); if (r) r.hidden = phLinked; }
    chainBtn?.setAttribute('aria-pressed', String(phLinked));
  };

  const CHAIN_SVG_LINKED = `<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="0.5" y="3.5" width="4" height="5" rx="2"/><rect x="7.5" y="3.5" width="4" height="5" rx="2"/><line x1="4.5" y1="6" x2="7.5" y2="6" stroke-linecap="round"/></svg>`;
  const CHAIN_SVG_BROKEN = `<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="0.5" y="3.5" width="4" height="5" rx="2"/><rect x="7.5" y="3.5" width="4" height="5" rx="2"/><line x1="5.2" y1="4.8" x2="6.8" y2="7.2" stroke-linecap="round"/></svg>`;

  if (plNumber) {
    chainBtn.addEventListener('click', () => {
      phLinked = !phLinked;
      tb.dataset.padXLinked = phLinked ? '1' : '0';   // Q26 — 블럭에 저장(복사·복제·저장·⌘Z 가 dataset 으로 같이 간다)
      chainBtn.classList.toggle('active', phLinked);
      chainBtn.innerHTML = phLinked ? CHAIN_SVG_LINKED : CHAIN_SVG_BROKEN;
      if (phLinked) {
        const v = parseInt(plNumber.value) || 0;
        tb.style.paddingRight = v + 'px';
        tb.dataset.customPadR = '1';   // 옛 잠금 경로(setL)와 같은 부수 처리 — 손댐 표시 · 말풍선 꼬리
        prNumber.value = v;
        if (phNumber) phNumber.value = v;
        _syncBubbleTail();
      }
      showLinked();
      window.pushHistory?.('좌우패딩 잠금');   // 적용 먼저 → 이력(push-after · 정렬 단추와 같은 순서)
    });

    // speech-bubble 말꼬리는 .speech-bubble-block 기준 absolute라 padding 변경 시 분리됨
    // padding 값에 맞춰 tail.left/right를 동시 갱신
    const _syncBubbleTail = () => {
      if (!tb.classList.contains('speech-bubble-block')) return;
      const tail = tb.querySelector('.tb-bubble-tail');
      if (!tail) return;
      const dir = tb.dataset.tail;
      if (dir === 'left') {
        const pl = parseInt(tb.style.paddingLeft) || 0;
        tail.style.left = (pl + 2) + 'px';
        tail.style.right = '';
      } else if (dir === 'right') {
        const pr = parseInt(tb.style.paddingRight) || 0;
        tail.style.right = (pr + 2) + 'px';
        tail.style.left = '';
      }
    };

    const setL = v => {
      tb.style.paddingLeft = v + 'px';
      tb.dataset.customPadL = '1';
      plNumber.value = v;
      if (phLinked) { tb.style.paddingRight = v + 'px'; tb.dataset.customPadR = '1'; prNumber.value = v; if (phNumber) phNumber.value = v; }
      _syncBubbleTail();
    };
    const setR = v => {
      tb.style.paddingRight = v + 'px';
      tb.dataset.customPadR = '1';
      prNumber.value = v;
      if (phLinked) { tb.style.paddingLeft = v + 'px'; tb.dataset.customPadL = '1'; plNumber.value = v; }
      _syncBubbleTail();
    };

    plNumber.addEventListener('input', () => setL(Math.min(120, Math.max(0, parseInt(plNumber.value) || 0))));
    prNumber.addEventListener('input', () => setR(Math.min(120, Math.max(0, parseInt(prNumber.value) || 0))));
    /* «좌우패딩» 한 줄 = 잠금일 때 둘을 같이(setL 이 잠금이면 우측도 쓴다) */
    phNumber?.addEventListener('input', () => setL(Math.min(120, Math.max(0, parseInt(phNumber.value) || 0))));
  }

  /* ★J146B ⒝ — 패딩이 글자칸을 옮기면 자유변형 보라·손잡이도 따라간다(위 setter 들 뒤에 돈다) */
  [pvNumber, plNumber, prNumber, phNumber].forEach((el) => el?.addEventListener('input', () => { if (tb.dataset.tfCorners) window.ftHandlesSync?.(tb); }));
  /* ★151 TEXT-PAD-SLIDER-NO-HISTORY-01(dev 74ceafe81 · 지디 261120) — 숫자칸 change 한 번 = push-after(표준 Layout 뒤 슬라이더는 걷혀 숫자칸만) */
  [pvNumber, plNumber, prNumber, phNumber].forEach((el) => el?.addEventListener('change', () => window.pushHistory?.('패딩')));
}
