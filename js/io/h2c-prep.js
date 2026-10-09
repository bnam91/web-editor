/* h2c-prep.js — html2canvas 에 넘길 «클론»을 그릴 수 있는 꼴로 고치는 전처리 한 벌.
 *
 * ★★왜 있나 — html2canvas 1.4.1 은 ★«svg 요소에 ★닿는 CSS transform»을 ★안 그린다.
 *   ★인라인이든 ★클래스든 ★같다(2026-10-09 실측 · 격리 도형으로 네 꼴을 갈라 쟀다):
 *     `style="transform:scaleX(-1)"` on svg  → ★안 그린다 (잉크·무게중심 ★무변)
 *     클래스로 준 `transform:scaleX(-1)`      → ★안 그린다 (★인라인과 같다)
 *     클래스로 준 `transform:translateX(…)`   → ★안 그리고 ★★내용이 ★잘린다(잉크 4800 → 500)
 *     `<g transform="…">` (SVG 속성)          → ★그린다
 *     감싸는 div/span 의 CSS transform        → ★그린다   ⇐ ★이 함수가 쓰는 길
 *   ⇒ ★거울은 ★조용히 사라지고(그려지되 ★뒤집히지 않는다) ★translate 는 ★내용을 잃는다.
 *
 * ★★무엇이 샜나 (2026-10-09 · 현빈 「썸네일이 뒤집혀 보이네 — 오른쪽 월계수잎」):
 *   ★월계수 오른 잎은 ★왼 잎과 ★같은 path 를 쓰고 거울을 ★CSS 하나로만 낸다
 *   (js/blocks/laurel-block.js `_laurelLeafSvg` 의 `mirror ? 'transform:scaleX(-1);' : ''`)
 *   ⇒ ★썸네일에서 ★오른 잎이 ★왼 잎의 ★복사본이 됐다(실측: 두 잎의 무게중심이 ★−0.1101 로 ★동일.
 *     ★참 렌더는 L −0.2048 / R ＋0.1907 로 ★부호가 갈린다).
 *
 * ★★왜 «소비자 전처리»인가 — ⛔«소비자를 각각 땜질»하는 것이 ★아니다:
 *   ★함수는 ★하나고 ★소비자가 ★그것을 ★부른다. 생산자(블록)를 고치는 길은 ★버렸다 —
 *   ⒜ 병이 ★«거울»보다 넓다(translate 도) ⒝ 말풍선은 거울이 ★CSS 파일에 살고 마크업이 ★세 곳이다
 *   ⒞ 생산자를 고치면 ★live 렌더를 건드려야 한다(이 길은 ★live 를 ★한 글자도 안 건드린다).
 *   ★선례 = js/io/save-load.js 의 `neutralizeBoxReflectForH2C` — ★같은 자리에서 ★같은 일을 한다.
 *
 * ⛔라이브 DOM 에 쓰지 마라 — ★«클론»에서만 돈다. 이 함수는 svg 를 ★감싸고 ★인라인 transform 을 쓴다.
 * ⚠️전제 — 클론이 ★document 에 ★붙어 있어야 한다. ★떼어진(detached) 요소의 `getComputedStyle` 은
 *   transform 을 ★빈 문자열로 준다(실측) ⇒ ★그러면 이 함수는 ★조용히 ★0 을 올린다.
 *   ★세 소비자 전부 ★붙인 뒤에 부른다(save-load:130 · capture-safety:530 · export-image:272).
 */

/**
 * 클론 안의 모든 svg 에서 «CSS transform»을 감싸는 span 으로 올린다.
 * @param {Element|Document} root 클론의 뿌리(★document 에 붙어 있어야 한다)
 * @returns {number} 올린 개수 — ★0 이면 «할 일이 없었다»거나 «클론이 떼어져 있다»다(위 ⚠️).
 *                   ★검사가 이 수를 센다(「초록」만으로는 이 함수가 ★불렸는지 못 잰다).
 */
export function liftSvgTransformsForH2C(root) {
  if (!root || typeof root.querySelectorAll !== 'function') return 0;
  let lifted = 0;
  for (const svg of root.querySelectorAll('svg')) {
    if (svg.parentElement && svg.parentElement.dataset
        && svg.parentElement.dataset.h2cLift === '1') continue;   // ★두 번 감싸지 않는다
    const cs = (typeof getComputedStyle === 'function') ? getComputedStyle(svg) : null;
    const t = cs && cs.transform ? cs.transform.trim() : '';
    if (!t || t === 'none') continue;
    const w = document.createElement('span');
    w.dataset.h2cLift = '1';
    w.style.display = 'inline-block';
    w.style.transform = t;                       // ★computed 그대로 — `matrix(a,b,c,d,e,f)` 꼴로 온다
    /* ★★이 줄을 빼지 마라 — 자리가 밀린다. 기본값은 `50% 50%`(요소 가운데)인데 CSS 가 다른 값을
       쓰고 있으면 감싸는 쪽이 ★그 값을 ★이어받지 않아 ★다른 점을 중심으로 돈다. 재는 자 = 아래 검사. */
    if (cs && cs.transformOrigin) w.style.transformOrigin = cs.transformOrigin;

    /* ★★★흐름 밖(position:absolute|fixed)인 svg 는 ★감싸기만 하면 ★안 된다 — ★실측(2026-10-09):
       ★말풍선 꼬리(`.tb-bubble-tail` · absolute)를 그냥 감싸니 ★감싸는 span 이 ★★0×0 이 됐다
       (흐름 밖 자식은 부모 상자를 ★안 채운다). ⇒ 복사해 둔 `transform-origin`(9.5px 8px)이
       ★★0×0 상자에 걸려 ★엉뚱한 점을 중심으로 돌고, ★거울이 ★여전히 ★안 그려졌다
       (잰 값: 무게중심 ＋0.1185 → ＋0.1064 · ★부호가 ★안 뒤집혔다). ＋꼬리 자리가 4px 밀렸다(x 34→30).
       ⇒ ★★감싸는 쪽이 ★그 자리·그 크기를 ★물려받고, svg 는 ★그 안에서 ★흐름 안으로 들어간다.
       ★그러면 상자가 ★svg 의 것과 ★같아져 origin 이 ★제 점을 가리킨다. 재는 자 = 아래 검사(꼬리 거울). */
    const pos = cs ? cs.position : '';
    if (pos === 'absolute' || pos === 'fixed') {
      const r = svg.getBoundingClientRect();
      w.style.position = pos;
      for (const k of ['left', 'top', 'right', 'bottom', 'zIndex', 'margin']) {
        const v = cs[k];
        if (v && v !== 'auto' && v !== 'normal') w.style[k] = v;
      }
      w.style.width  = r.width + 'px';
      w.style.height = r.height + 'px';
      svg.parentNode.insertBefore(w, svg);
      w.appendChild(svg);
      /* ★svg 를 ★흐름 안으로 — 감싸는 쪽이 ★자리를 ★맡았다 */
      svg.style.position = 'static';
      for (const k of ['left', 'top', 'right', 'bottom', 'margin']) svg.style[k] = '';
      svg.style.transform = 'none';
      lifted++;
      continue;
    }
    svg.parentNode.insertBefore(w, svg);
    w.appendChild(svg);
    svg.style.transform = 'none';                // ★svg 쪽은 끈다(클래스가 걸려 있어도 인라인이 이긴다)
    lifted++;
  }
  return lifted;
}
