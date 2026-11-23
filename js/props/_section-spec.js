/* _section-spec.js — 우측 속성 패널 «절 순서·제목»의 유일한 정본. (right-panel-unify U0, 2026-11-13)
 *
 * ★모든 블록 패널은 js/props/_panel-frame.js 의 sec()/renderPanel() 로 절을 등록하고,
 *   renderPanel 이 이 순서로 줄 세운다. 해당 없는 절은 «숨김»이지 자리 이동이 아니다 ⇒ 어느 패널이든 순서는 이 표의 부분열.
 * ★테스트·문서가 이 파일을 직접 읽는다(tests/unit/panel-frame.test.mjs · tests/dom/panel-section-gate.dom.spec.js ·
 *   docs/styleguide-panel.html) — ⛔순서표를 다른 곳에 베끼지 마라(두 벌은 조용히 갈라진다).
 * ★제목 = 영어 Title Case 1~2단어(Figma 명명) · 단어 = 「Abc」 또는 약어 2~4자(QA·FAQ·3D·SVG·CTA) ·
 *   한글·괄호·기호 없음 · 개수 접미는 「Cards 3」 꼴.
 *   (현빈 2026-11-13 Q1 정정 — 처음 확정한 «한글»을 뒤집었다.)
 *   stroke = «Stroke» 한 절 — 블록 테두리와 글자 윤곽선(text·sticker)이 같은 절 안 «행»이다(하위 제목 없음).
 * ★special 은 블록 고유 절 — 제목을 sec() 호출부가 준다(같은 규칙 · 선언순).
 * ⛔이 파일에는 색·px 리터럴 0 (scripts/check-design-tokens.sh 신규 층 하드게이트).
 */
export const SECTION_ORDER = Object.freeze([
  'kind', 'content', 'position', 'size', 'layout', 'padding', 'appearance',
  'typography', 'fill', 'stroke', 'effects', 'selection', 'template', 'export', 'special',   // selection = 섹션 «Selection Colors»(현빈 261123 섹션 보강 · Figma 꼴 · 지디 261123 Title Case)   // ★꼬리 = 정본 v1(지디 261123 ⑶ⓑ) Templates → Export → [Special] · 다른 절 재배열은 PR-ORDER-V1 몫
]);
/** 절 정렬 수 — 블록 고유 «GIF»(special · 제목 GIF)만 Effects 바로 뒤(정본 v1 «Effects → GIF → Templates» · 지디 261123 ⑶ⓑ). 틀 정렬·게이트 판정이 이 한 자리를 쓴다.
 *  shortcut: GIF 가 special 로 사는 동안의 예외 한 줄 — PR-ORDER-V1 에서 GIF 를 제 key 로 가르면 걷는다. */
export function sectionRank(order, key, title) { return key === 'special' && title === 'GIF' ? order.indexOf('effects') + 0.5 : order.indexOf(key); }
/** 패널별 순서 예외 — { 패널 이름: { first: [맨 앞으로 올릴 key…], why } }. ⛔드물게 · 예외는 «이 표 한 자리»
 *  (renderPanel({ panel }) 와 시험 _panel-sections.js 가 sectionOrderFor 로 읽는다 — 렌더러·시험에 순서를 따로 박지 마라).
 *  section = Layout 묶음 안 Alignment 가 Size 위(텍스트와 같은 꼴) — ★11-18 D5 «섹션만 Fill 맨 앞»은 현빈 261123 «섹션도 예외없이 일단 layout 다음 fill»로 걷었다. */
export const SECTION_ORDER_EXCEPT = Object.freeze({
  section: Object.freeze({ before: Object.freeze([Object.freeze(['layout', 'size'])]), why: '현빈 261123 «섹션도 예외없이 일단 layout 다음 fill»(11-18 D5 «Fill 맨 앞» 걷음) · 섹션 보강(v117a) — Layout 묶음 안 Alignment(layout)가 Size 위(텍스트와 같은 꼴)' }),
  /* before = [[옮길 key, 이 key 바로 앞]] */
  text: Object.freeze({ before: Object.freeze([Object.freeze(['layout', 'size'])]), why: '현빈 261120(재설계 v5 · Q21 텍스트만) — 가로 정렬(Layout)이 Size 위' }),
});
/** 그 패널의 절 순서 — 예외가 없으면 SECTION_ORDER 그대로. */
export function sectionOrderFor(panel) {
  const x = panel ? SECTION_ORDER_EXCEPT[panel] : null;
  if (!x) return SECTION_ORDER;
  const first = x.first || [];
  const o = [...first, ...SECTION_ORDER.filter((k) => !first.includes(k))];
  for (const [k, at] of x.before || []) { o.splice(o.indexOf(k), 1); o.splice(o.indexOf(at), 0, k); }
  return Object.freeze(o);
}

/** ★절별 기본 항목(현빈 G 261123 · 레드팀 2차 ② · 태양 PLAN-ds-parts-state-261123 §4b 표 그대로) — 절 key → 부품(data-part) 목록.
 *  부품 이름 = PLAN §2 «부품 이름 한 벌»(row·number·slider·toggle·select·color·tip·align-group·chain·end-slot·fx-card·rot). Kind·Content·[Special] 은 블럭마다 달라 «제외».
 *  지금 읽는 자 = tools/panel-parts(카탈로그 판정기 · 기본 대비 빠짐/남음) · 다음 = §4 fromSpec(태양). 값 = 목표 꼴(데이터만 · 그리는 코드 무변).
 *  결정 거리(PLAN §7): Layout W/H · Typography 크기의 기본이 number 냐 slider 냐 — 지금은 number. */
export const SECTION_DEFAULTS = Object.freeze({
  position: Object.freeze(['align-group', 'number', 'rot']),
  layout: Object.freeze(['number', 'chain']),
  fill: Object.freeze(['end-slot', 'color']),
  stroke: Object.freeze(['end-slot', 'color', 'number', 'select']),
  appearance: Object.freeze(['slider', 'number', 'check']),   // 보이기 = check(현빈 261123 · 태양 §2c — 옛 toggle)
  effects: Object.freeze(['end-slot', 'fx-card']),
  typography: Object.freeze(['select', 'number', 'align-group']),
});
export const PART_NAMES = Object.freeze(['row', 'number', 'slider', 'check', 'select', 'color', 'tip', 'align-group', 'chain', 'end-slot', 'fx-card', 'rot']);
export const SECTION_TITLE = Object.freeze({
  kind: 'Type',
  content: 'Content',
  position: 'Position',
  size: 'Size',
  layout: 'Layout',
  padding: 'Padding',
  appearance: 'Appearance',
  typography: 'Typography',
  fill: 'Fill',
  stroke: 'Stroke',
  effects: 'Effects',
  selection: 'Selection Colors',
  export: 'Export',
  template: 'Template',
});

/** 절 제목 규칙 — 단어(Title Case 「Abc」 또는 약어 [A-Z0-9]{2,4}) 1~2개 + 선택 개수 접미(「Cards 3」). 한글·괄호·기호면 거짓. */
export function isValidSectionTitle(t) {
  return typeof t === 'string' && /^(?:[A-Z][a-z]+|[A-Z0-9]{2,4})( (?:[A-Z][a-z]+|[A-Z0-9]{2,4}))?( \d+)?$/.test(t);
}

/* ── 소유 규칙(OWNERSHIP) — «이 속성은 이 절에 산다». (U0 · 지디 2026-11-13)
 * ★왜: renderPanel 이 SECTION_ORDER 로 «정렬해 주므로» 이관된 패널은 순서 위반을 낼 수 없다.
 *   진짜 위험은 속성을 엉뚱한 절에 넣는 것 ⇒ 게이트(tests/dom/panel-section-gate)가 절 안 input/select/button/textarea 를
 *   controlIdent() 로 단어열로 만들고(id · data-* · «색이다» 표식) 이 표로 «있어야 할 절»을 정해, 다른 절이면 빨강.
 * ★class 는 안 본다 — `.prop-color-hex` 가 «작은 글칸 껍데기»로도 쓰여(iconify 프리셋 이름칸 등) class 로 재면 색 아닌 칸이 fill 로 간다.
 *   «색이다»는 input[type=color] 이거나 그 짝(같은 .prop-color-field 안 · 바로 앞 형제가 색 칸)일 때만(readPanel 이 잰다).
 * ★위에서부터 첫 일치가 이긴다. 'a+b' = 두 단어 다 · 'pad*' = 그 접두 단어 · '*rule' = 그 접미 단어. 어느 줄에도 안 걸리면 판정 밖(null).
 * ★Content 절 안 반복 항목 카드([data-sec-item] · .prop-cell-card · [data-card-index] — simple-card #cvb-card-items 의 .cvb-card-item) 속 컨트롤은 판정 밖(한 항목의 색·크기·글이 한 몸 — §3-2).
 *   카드가 다른 절에 있으면 여전히 판정한다(tests/dom/_panel-sections.js judgePanel).
 * ⛔애매한 컨트롤은 표를 비틀지 말고 OWNERSHIP_EXEMPT(id) 또는 OWNERSHIP_EXEMPT_SCOPES(그릇 id — 그 «안»만)에 까닭과 함께 뺀다. */
export const OWNERSHIP = Object.freeze([
  [['export'], 'export'],   // 내보내기 설정(sec-export-width · page-export-width) — 폭·색 단어보다 먼저
  [['border+color', 'stroke+color', '*rule', 'line+color', 'line+width'], 'stroke'],   // *rule = 그리드 「칸 사이 줄」 · line+color/width = 선 색·두께(rdl-line-* · tbl-line-*)
  // ⚠️그리드 「줄」(글줄)도 line 이지만 #grd-line-body 그릇 안이라 판정 밖(OWNERSHIP_EXEMPT_SCOPES) — 글줄 색이 stroke 로 오판되지 않는다
  [['radius'], 'appearance'],
  [['pad*'], 'padding'],
  [['shadow', 'glow'], 'effects'],
  // 'a>b' = a 바로 뒤 b. 글 부위 단어 바로 뒤 size = 글자 크기(stb-title-size · chb-typo-size · tbl-header-size · grb-pct-size · cpn-slot-size)
  [['font', 'letter', 'line+height', 'title>size', 'desc>size', 'typo>size', 'header>size', 'pct>size', 'label>size', 'slot>size', 'dot>size'], 'typography'],   // dot>size = 점 찍기 지름(${p}-dot-size) · 텍스트 패널 글자 크기는 OWNERSHIP_ID_STEM 'txt-size'
  [['border', 'stroke'], 'stroke'],
  [['color', 'colour', 'fill', 'bg'], 'fill'],
  [['rotate', 'rotation', 'x', 'y'], 'position'],
  [['width', 'height', 'size'], 'size'],
]);
/** 판정 제외 — { 색/컨트롤 id: '까닭' }. 색 칸(input[type=color]) id 를 적으면 그 짝(hex·alpha)도 같이 빠진다(readPanel pairId). */
export const OWNERSHIP_EXEMPT = Object.freeze({
  'stk-coin-face-color': '코인 앞면 금속색 — 재질=custom 옆 special «Coin» 절에 일부러 둔다(U5)',
  'stk-coin-side-color': '코인 옆면 금속색 — 재질=custom 옆 special «Coin» 절에 일부러 둔다(U5)',
});
/** 꼴로는 못 가르는 id 줄기 → { 줄기: [절 key, 까닭] }. id 가 「줄기」 이거나 「줄기-」로 시작하면 이 절. ⛔드물게 — 규칙이 먼저다. */
export const OWNERSHIP_ID_STEM = Object.freeze({
  'tbl-size': ['typography', '표 글자 크기(prop-table applySize → table.style.fontSize) — 접두 바로 뒤 size 라 «블록 크기»와 꼴이 같다'],
  'sec-txt': ['selection', '섹션 «Selection Colors» 글자 색(sec-txt-<타입>) — 색 칸이라 꼴로는 fill 로 읽힌다(섹션 보강 · 현빈 261123)'],
  'txt-size': ['typography', '텍스트 글자 크기(공용 Typography 빌더 p:\'txt\' → txt-size-number) — 접두 txt 에 글 부위 단어가 없어 «블록 크기»와 꼴이 같다'],
});
/** 줄임 단어 → 뜻 단어. ★id 의 «첫 단어»(블록 접두 — 스티커 stk-·…)에는 안 건다: stk-t-STK-c-color 의 둘째 stk 만 stroke. */
export const OWNERSHIP_ALIAS = Object.freeze({ stk: 'stroke', sh: 'shadow', bc: 'stroke', bdc: 'stroke', shc: 'shadow' });   // bc·bdc = 테두리 색(mdl-bc-* · zm-bdc-*) · shc = 효과 색(zm-shc-*)
/** 판정 제외 그릇 — { 그릇 id: { sec, why } }. 그 그릇 «안»의 컨트롤만 뺀다(같은 컨트롤이 그릇 밖이면 판정한다).
 *  sec = 그 그릇이 «있어야 할 절»(null = 어느 절이든). 그릇이 다른 절에 있으면 그 안 컨트롤도 판정한다.
 *  그리드 하위 접기 몸통: 한 칸·한 줄·칸 사이 줄 스코프의 색·테두리·여백이 한 몸통에 섞여 사는 것이 설계다(§4-1 · U1). */
export const OWNERSHIP_EXEMPT_SCOPES = Object.freeze({
  'grd-cell-body': { sec: null, why: '그리드 「칸 꾸미기」 하위 접기 — 이 칸의 배경·테두리·여백이 한 몸통' },
  'grd-line-body': { sec: null, why: '그리드 「줄 꾸미기」 하위 접기 — 이 글줄의 글자·채움·테두리가 한 몸통' },
  'grd-rule-body': { sec: null, why: '그리드 「칸 사이 줄」 하위 접기 — 줄 굵기·들임·색이 한 몸통' },
  'grd-cellall-body': { sec: 'content', why: '그리드 「칸 꾸미기 · 모든 칸」 — 모든 칸의 배경·테두리·여백이 한 몸통(Content 안)' },
  'grd-img-section': { sec: 'content', why: '그리드 그림 묶음 — 칸 그림의 크기·모양·여백이 한 몸통(Content 안 · U1 이 그릇 id 를 단다)' },
  'grd-bbg-section': { sec: 'fill', why: '그리드 블럭 배경 — 배경 상자 자기 여백·모서리가 배경과 한 몸(Fill 안)' },
});

/** 컨트롤 → 판정 단어열. c = { id, type, data: [[이름, 값]…], pairedColor }. ⛔class 는 받아도 안 쓴다(위 머리말). */
export function controlIdent(c) {
  return [c.id || '', ...(c.data || []).map(([n, v]) => `${n} ${v}`), (c.type === 'color' || c.pairedColor) ? 'color' : ''].join(' ').trim();
}

export function controlWords(s) {
  return String(s).replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}
/** 컨트롤 식별 문자열(id·class·data-*) → 있어야 할 절 key, 모르면 null. */
export function ownerOf(ident) {
  const id0 = String(ident).trim().split(/\s+/)[0] || '';
  for (const [stem, [key]] of Object.entries(OWNERSHIP_ID_STEM)) if (id0 === stem || id0.startsWith(stem + '-')) return key;
  const w = controlWords(ident).map((x, i) => (i > 0 && OWNERSHIP_ALIAS[x]) || x);
  const has = (p) => (p.endsWith('*') ? w.some((x) => x.startsWith(p.slice(0, -1)))
    : p.startsWith('*') ? w.some((x) => x.endsWith(p.slice(1)))
    : p.includes('>') ? w.some((x, i) => x === p.split('>')[0] && w[i + 1] === p.split('>')[1])
    : p.split('+').every((q) => w.includes(q)));
  for (const [pats, key] of OWNERSHIP) if (pats.some(has)) return key;
  return null;
}

/** 컨트롤 → 있어야 할 절. ★명시 덮어쓰기: 컨트롤(또는 같은 절 안 조상 줄)의 data-own="<절 key>" 가 있으면 그 key —
 *  «건너뛰기»가 아니라 «그 절이어야 한다»로 여전히 판정한다. 드물게 · 호출부에 까닭 주석 필수(DESIGN_SYSTEM §11-A).
 *  예: 방사형 배치 반지름(rdl-radius) = 원 배치의 크기 → Layout(모서리 radius 가 아니다). */
export function ownerOfControl(c) {
  // fxCard = effects-registry 의 카드 목록(#<P>-fx-list · fxSectionParts 의 body) 안 — 카드 안 색·x/y·크기는 전부 그 효과의 것 ⇒ Effects
  return explicitOwnOf(c) ?? (c.fxCard ? 'effects' : ownerOf(controlIdent(c)));
}
/** 명시 덮어쓰기 값(없으면 null). 값 = 절 key(SECTION_ORDER) 또는 블록 고유 절 'special:<제목>'(예 'special:Grid' · 'special:Buzz').
 *  게이트는 그 절이 «이 패널에 실제로 있나»도 잰다 — 오타면 빨강. */
export function explicitOwnOf(c) {
  const own = c.own ?? (c.data || []).find(([n]) => n === 'own')?.[1];
  return own != null && own !== '' ? own : null;
}

/* ★window 로도 낸다 — 정적 import 없이 읽는 DOM 게이트·styleguide 용. Node vm 하네스에는 window 가 없다. */
if (typeof window !== 'undefined') window.__panelSectionSpec = { SECTION_ORDER, SECTION_TITLE, isValidSectionTitle, OWNERSHIP, OWNERSHIP_EXEMPT, OWNERSHIP_EXEMPT_SCOPES, OWNERSHIP_ALIAS, OWNERSHIP_ID_STEM, controlIdent, ownerOf, ownerOfControl, explicitOwnOf };
