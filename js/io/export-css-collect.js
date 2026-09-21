/* export-css-collect.js — 단독 HTML 내보내기가 «화면과 같은 그림»이 되게, 앱 CSS 에서
 * «이 캔버스에 실제로 걸리는 규칙»만 골라 담는다.
 *
 * ★왜 (2026-09-21 최종통합 QA medium)
 *   js/io/export-html.js 는 앱 CSS 를 한 줄도 안 싣고 자기가 손으로 쓴 <style> 만 붙였다.
 *   그 손글씨 명부는 «두 벌째 CSS»라 늙는다 — 실측(9505·줌40%·실앱 클론 34노드 대조,
 *   h0920b/cap-export-before.measured.json vs cap-live.json):
 *     · 섹션 배경        rgb(255,255,255) → rgba(0,0,0,0)   (배경이 통째로 사라짐)
 *     · 도형 blk         100×100 @380,240 → 0×24 @0,0       (도형 붕괴 + 자리 이탈)
 *     · 프레임 blk       display:flex/position:relative/overflow:hidden → block/static/visible
 *     · 아이콘+텍스트    75.2px → 48px, flex → block
 *     · 에셋 blk         y 1560.8 → 5      (절대배치가 풀려 위로 솟음)
 *     · 캔버스 전체높이  2695.8 → 1888.6   (−807.2px)
 *
 * ★어떻게
 *   손으로 규칙을 베껴 오면 또 두 벌이 된다. 그래서 «베끼지 않고» 런타임에 CSSOM
 *   (document.styleSheets)을 읽어, 지금 캔버스에 실제로 매칭되는 규칙만 추린다.
 *   - 매칭 판정은 «라이브 캔버스»에 한다(조상까지 있어야 선택자가 제대로 평가된다).
 *     클론은 떼어낸 트리라 `#canvas .x` 같은 선택자가 거짓 음성이 된다.
 *   - 편집 전용 선택자(.selected·:hover·핸들·라벨·툴바·placeholder …)는 «담지 않는다».
 *     담으면 배송본이 편집 화면을 흉내 낸다.
 *   - :root 규칙은 커스텀 속성(--*)만 뽑는다. ⛔통째로 담으면 안 된다 —
 *     `color-scheme: dark`(전역 다크폼) 같은 선언이 같이 실려 배송본이 어두워진다.
 *
 * ⚠️CSSOM 이 막히면(다른 오리진에서 온 시트 등) 조용히 건너뛴다 — 부르는 쪽은 손글씨
 *   기본 CSS 를 «먼저» 깔아 두므로 최소한 지금과 같은 결과가 나온다(퇴행 없음).
 */

/* 편집 화면에서만 의미가 있는 선택자 — 배송본에 실리면 안 된다.
   ⛔`-btn` 같은 «너무 넓은» 조각은 쓰지 않는다: 배너 프리셋의 .cta-btn 처럼 진짜 콘텐츠가
     같은 꼬리를 쓸 수 있다. 여기 적는 것은 이 레포가 실제로 편집 전용으로 쓰는 이름들이다. */
const EDITOR_ONLY_SEL = new RegExp([
  '\\.selected\\b', '\\.editing\\b', '\\.dragging\\b', '\\.group-selected', '\\.group-editing',
  '\\.ss-drag-over', '\\.drag-over', '\\.item-selected', '\\.cell-selected', '\\.row-active', '\\.col-active',
  '-line-selected', '-step-selected', '\\.sec-bg-editing', '\\.sec-bg-proxy',
  '\\.img-editing', '\\.img-edit-hint', '\\.img-boundary', '\\.img-corner-handle', '\\.img-edge-handle', '\\.img-rotate-zone',
  '\\.section-label', '\\.section-toolbar', '\\.section-hitzone', '\\.variation-badge',
  '\\.annotation', '\\.annot-', '\\.qa-block', '\\.todo-pin', '\\.pen-',
  '\\.col-placeholder', '\\.col-add', '\\.row-col-add', '\\.row-drop-indicator', '\\.layer-',
  'placeholder', '-handle\\b', '\\.cvb-img-empty', '\\.bn2-line-empty', '\\.grd-line-selected',
  '\\.st-btn', '#preview-overlay', '#canvas-scaler', '#canvas-wrap', '#canvas-area',
  ':hover', ':focus', ':active', ':focus-visible', ':focus-within', '::selection', '::-webkit-',
].join('|'), 'i');

/* 캔버스 그림과 무관한 «UI 껍데기» 스타일시트 — 아예 읽지 않는다(비용·오염 둘 다 줄인다). */
const CHROME_SHEET = /(editor-panels|editor-props|color-picker|settings-modal|settings-admin|report-modal|notice|release-note|export-result|version-history|section-search|ai-image|assets-panel|claude-pm|editor-toast|pen-tool|xterm)\.css(\?.*)?$/i;

/* 가상«요소»만 떼어낸다(가상클래스 :not/:has/:is 는 매칭에 꼭 필요하므로 남긴다). */
const PSEUDO_ELEMENT = /::[a-zA-Z-]+(\([^()]*\))?|:(?:before|after|first-line|first-letter|marker|backdrop|selection)\b/g;

function selectorMatchesInScope(scopeEl, selectorText) {
  for (const part of String(selectorText || '').split(',')) {
    const probe = part.replace(PSEUDO_ELEMENT, '').trim();
    if (!probe) continue;
    try {
      if (scopeEl.matches(probe)) return true;
      if (scopeEl.querySelector(probe)) return true;
    } catch (_) { /* 브라우저가 못 읽는 선택자 — 담지 않는다 */ }
  }
  return false;
}

function rootCustomProps(rule) {
  // :root / html 규칙에서 «커스텀 속성만» 뽑아 되쓴다.
  const st = rule.style;
  const out = [];
  for (let i = 0; i < st.length; i++) {
    const name = st.item(i);
    if (!name.startsWith('--')) continue;
    const pri = st.getPropertyPriority(name);
    out.push(`${name}:${st.getPropertyValue(name)}${pri ? ' !' + pri : ''}`);
  }
  return out;
}

const ROOT_SEL = /^(?::root|html)(?:\s*,\s*(?::root|html))*$/i;

export function collectCanvasCss(scopeEl, doc) {
  const d = doc || (typeof document !== 'undefined' ? document : null);
  if (!scopeEl || !d || !d.styleSheets) return '';

  const out = [];
  const rootVars = [];
  const keyframes = new Map();   // name → cssText
  let considered = 0, taken = 0;

  const walk = (rules, sink) => {
    for (const r of rules) {
      const kind = r.constructor && r.constructor.name || '';
      // CSSStyleRule
      if (kind === 'CSSStyleRule' || (r.selectorText != null && r.style && !r.cssRules)) {
        considered++;
        const sel = r.selectorText;
        if (ROOT_SEL.test(sel.trim())) { rootVars.push(...rootCustomProps(r)); continue; }
        if (EDITOR_ONLY_SEL.test(sel)) continue;
        if (!selectorMatchesInScope(scopeEl, sel)) continue;
        sink.push(r.cssText);
        taken++;
        continue;
      }
      // @keyframes — 이름표만 모아 두고, 실제로 쓰이는 것만 나중에 싣는다.
      if (kind === 'CSSKeyframesRule') { keyframes.set(r.name, r.cssText); continue; }
      // @import
      if (kind === 'CSSImportRule') {
        if (CHROME_SHEET.test(r.href || '')) continue;
        try { walk(r.styleSheet.cssRules, sink); } catch (_) { /* 접근 불가 시트 */ }
        continue;
      }
      // @media / @supports / @layer — 안쪽이 비면 껍데기도 안 싣는다.
      if (kind === 'CSSMediaRule' || kind === 'CSSSupportsRule' || kind === 'CSSLayerBlockRule') {
        const inner = [];
        try { walk(r.cssRules, inner); } catch (_) { continue; }
        if (!inner.length) continue;
        const head = kind === 'CSSMediaRule'    ? `@media ${r.media.mediaText}`
                   : kind === 'CSSSupportsRule' ? `@supports ${r.conditionText}`
                   : null;                       // @layer 는 껍데기 없이 안쪽만 펴 담는다
        if (!head) { sink.push(...inner); continue; }
        sink.push(`${head}{${inner.join('')}}`);
        continue;
      }
      // @font-face 등 그 밖의 규칙은 싣지 않는다(상대경로 폰트는 배송본에서 깨진다).
    }
  };

  for (const ss of d.styleSheets) {
    const href = ss.href || '';
    if (CHROME_SHEET.test(href)) continue;
    let rules = null;
    try { rules = ss.cssRules; } catch (_) { continue; }   // CSSOM 접근 불가 → 건너뜀
    if (!rules) continue;
    try { walk(rules, out); } catch (_) { /* 시트 하나가 깨져도 나머지는 담는다 */ }
  }

  // 실제로 참조되는 @keyframes 만 덧붙인다.
  const body = out.join('\n');
  const used = [];
  for (const [name, text] of keyframes) {
    if (new RegExp('(^|[\\s:,])' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([\\s;,}]|$)').test(body)) used.push(text);
  }

  const varsBlock = rootVars.length ? `:root{${rootVars.join(';')}}\n` : '';
  const css = varsBlock + body + (used.length ? '\n' + used.join('\n') : '');
  // 진단용(회귀 스펙이 읽는다) — «몇 개 중 몇 개를 담았나».
  collectCanvasCss.lastStats = { considered, taken, vars: rootVars.length, keyframes: used.length, bytes: css.length };
  return css;
}
