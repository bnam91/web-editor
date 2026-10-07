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
  '\\.section-label', '\\.section-toolbar', '\\.section-hitzone', '\\.variation-badge', '\\.section-height-badge',
  '\\.annotation', '\\.annot-', '\\.qa-block', '\\.todo-pin', '\\.pen-',
  '\\.col-placeholder', '\\.col-add', '\\.row-col-add', '\\.row-drop-indicator', '\\.layer-',
  'placeholder', '-handle\\b', '\\.cvb-img-empty', '\\.bn2-line-empty', '\\.grd-line-selected', '\\.grd-add-btn',
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
    if (name.startsWith('--goya-checker-')) continue;   // 편집용 체커 토큰 — 배송본에 «값»도 안 싣는다(체커 규칙을 안 싣는 것과 한 쌍)
    /* ★이 줄의 «짝»이 아래 ruleCssTextWithoutChecker 의 CHECKER_VAR_RE 다 — 여기는 :root/html 만,
       거기는 그 밖의 규칙(섹션 톤 규칙 등)을 본다. ⛔한쪽만 고치면 다른 쪽으로 샌다. */
    const pri = st.getPropertyPriority(name);
    out.push(`${name}:${st.getPropertyValue(name)}${pri ? ' !' + pri : ''}`);
  }
  return out;
}

const ROOT_SEL = /^(?::root|html)(?:\s*,\s*(?::root|html))*$/i;

/* ── 빈 이미지 칸 «체커보드»는 배송본에 실리지 않는다 ───────────────────────────
 * ★2026-09-21 EVAL medium — 이 파일이 앱 CSS 를 싣기 «시작»하면서, 이전엔 우연히 안 나가던
 *   편집용 체커가 배송본으로 새기 시작했다. 실측: 내보낸 HTML 의 <style> 에
 *   `.asset-block{…repeating-conic-gradient(rgb(216,216,216)…)}` 가 실려 실제로 그려졌다.
 *   banner02 는 export-html.js 가 «클래스를 벗겨» 살았지만, .asset-block 은 블럭 «자신의»
 *   클래스라 벗길 대상이 없다 ⇒ 클래스 제거 목록으로는 못 닫는 결함군이다.
 * ★선택자를 나열하지 «않는다» — js/io/capture-safety.js 와 «같은 서명»으로 판정한다
 *   (이 레포에서 conic gradient 를 사용자 데이터로 만드는 길은 없다: gradient-model.js 는
 *    linear/radial 뿐). 세 산출물(PNG·썸네일·단독 HTML)이 한 판정식을 쓴다.
 * ⛔규칙을 통째로 버리지 않는다 — 같은 규칙의 크기·테두리·배경«색»은 화면 그림에 필요하다.
 *   ⇒ 선언 목록(longhand)을 다시 써서 background-image «만» 바꾼다. 덮어쓰기가 아니라 «뺀다» —
 *     이 파일이 실어 보내는 배송본 소스에 편집용 무늬 문자열이 아예 안 남는다
 *     (export-html.js 의 원칙: 「숨기는 CSS 한 줄로 때우지 마라, 있을 이유 없는 것은 뺀다」).
 * ⛔통째로 none 을 박지 않는다 — 다중 레이어(목업: `url(...), <체커>`)에서 진짜 그림이 사라진다.
 * ⚠️체커가 background-image 가 «아닌» 자리(mask 등)에 있으면 건드리지 않는다 — 규칙을 다시 쓰다가
 *   엉뚱한 선언을 잃는 쪽이 더 비싸다(지금 레포엔 0건).
 */
const CHECKER_RE = /repeating-conic-gradient/i;

/** `a, b, c` 를 «괄호 깊이»를 세며 자른다 — gradient 안의 콤마에 속지 않는다. */
function splitBgLayers(css) {
  const out = [];
  let depth = 0, cur = '';
  for (const ch of String(css || '')) {
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    if (ch === ',' && depth === 0) { out.push(cur.trim()); cur = ''; continue; }
    cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

/* ★체커 «토큰 선언» 거르개 — rootCustomProps(:70) 의 «한 쌍»이다. 둘을 따로 고치지 마라.
 * ★왜 둘이 필요한가(2026-10-06 실측) — 그 자리는 ROOT_SEL(`:root`/`html`) 규칙에만 걸린다.
 *   2026-10-06 현빈 「체커는 일괄이 아니라 섹션마다」로 톤 규칙이
 *   `.section-block[data-checker-tone="dark"]` 가 되면서, 선택자가 ★캔버스 안에서 맞게 됐다
 *   ⇒ 그 규칙이 통째로 수확돼 배송본 <style> 에 체커 토큰 선언이 실린다.
 *   실측: 거르개 없이 0줄 → ★5줄(--goya-checker-secbg-a/b 외). 무늬(repeating-conic-gradient)는
 *   그래도 0건이라 «그려지지는» 않지만, 「체커 토큰은 배송본에 값도 안 싣는다」는 규약이 깨진다.
 * ★이름으로 거른다(값이 아니라) — 커스텀 속성은 값이 그냥 hex 라 값 검사에 안 걸린다. */
const CHECKER_VAR_RE = /^--goya-checker-/;

export function ruleCssTextWithoutChecker(rule) {
  const txt = rule.cssText || '';
  if (!CHECKER_RE.test(txt)) {
    if (!CHECKER_VAR_RE.test(txt) && !/--goya-checker-/.test(txt)) return txt;
    /* 무늬 서명은 없고 «토큰 선언»만 있는 규칙(섹션 톤 규칙이 이 꼴이다) — 그 선언만 뺀다. */
    let st2 = null;
    try { st2 = rule.style; } catch (_) { return txt; }
    if (!st2) return txt;
    const keep = [];
    for (let i = 0; i < st2.length; i++) {
      const name = st2.item(i);
      if (CHECKER_VAR_RE.test(name)) continue;                 // 체커 토큰 선언 — 안 싣는다
      const value = st2.getPropertyValue(name);
      if (/--goya-checker-/.test(value)) continue;             // 체커 토큰을 «참조»하는 선언도 끊는다(토큰이 없으니 의미가 없다)
      const pri = st2.getPropertyPriority(name);
      keep.push(`${name}:${value}${pri ? ' !' + pri : ''}`);
    }
    if (!keep.length) return '';                               // 체커 토큰뿐이던 규칙 — 껍데기도 안 싣는다
    return `${rule.selectorText}{${keep.join(';')}}`;
  }
  let st = null;
  try { st = rule.style; } catch (_) { return txt; }
  if (!st) return txt;
  let bg = st.getPropertyValue('background-image') || '';
  /* ★체커 값이 CSS 변수(var(--goya-checker-*))가 되면서 생긴 길 — `background:` «shorthand» 안에 var() 가 있으면
     CSSOM 은 longhand 를 «비워» 돌려준다(background-image === ''). 그러면 아래 서명 판정이 조용히 빗나가
     체커 규칙이 배송본에 «그대로» 실린다. ⇒ longhand 가 비면 shorthand 값으로 한 번 더 본다. */
  let viaShorthand = false;
  if (!CHECKER_RE.test(bg)) {
    const sh = st.getPropertyValue('background') || '';
    if (!CHECKER_RE.test(sh)) return txt;               // 체커가 배경이 아닌 자리에 있다 — 그대로 둔다
    bg = sh; viaShorthand = true;
  }
  const kept = splitBgLayers(bg).filter(l => !CHECKER_RE.test(l));
  /* ★CSSOM 은 shorthand 를 longhand 로 펴서 열거한다(실측 2026-09-21, Chromium 146:
     `.asset-block` → 29개 longhand). 그래서 `background:` 로 쓴 규칙도 background-image
     «하나만» 갈아끼울 수 있다 — 배경색·크기·위치는 그대로 산다. */
  const decls = [];
  if (viaShorthand) decls.push(`background:${kept.length ? kept.join(', ') : 'none'}`);   // shorthand 한 줄이 background-* 전부를 대신한다
  for (let i = 0; i < st.length; i++) {
    const name = st.item(i);
    if (viaShorthand && name.startsWith('background-')) continue;   // 위 shorthand 가 이미 덮었다(var 로 비어 있던 longhand 를 «빈 값»으로 싣지 않는다)
    if (CHECKER_VAR_RE.test(name)) continue;                       // 체커 «토큰 선언» — 위 거르개와 같은 잣대(이름으로)
    const value = name === 'background-image'
      ? (kept.length ? kept.join(', ') : 'none')
      : st.getPropertyValue(name);
    if (CHECKER_RE.test(value)) continue;               // 또 다른 선언에 숨어 있으면 그 선언만 뺀다
    if (/--goya-checker-/.test(value)) continue;        // 체커 «크기» 변수 — 토큰은 배송본에 안 실리니 참조도 끊는다(이미지가 none 이라 크기는 무의미)
    const pri = st.getPropertyPriority(name);
    decls.push(`${name}:${value}${pri ? ' !' + pri : ''}`);
  }
  if (!decls.length) return '';                          // 남는 선언이 없으면 규칙째 안 싣는다
  return `${rule.selectorText}{${decls.join(';')}}`;
}

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
        const text = ruleCssTextWithoutChecker(r);     // 편집용 체커는 배송본에 안 싣는다(위 주석)
        if (!text) continue;                            // 체커 하나뿐이던 규칙 — 껍데기도 안 싣는다
        sink.push(text);
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
