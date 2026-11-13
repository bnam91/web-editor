/* panel-frame.test.mjs — 우측 패널 틀(js/props/_panel-frame.js · _section-spec.js)의 규칙을 잠근다. (right-panel-unify U0)
 *   실행: node --test tests/unit/panel-frame.test.mjs
 *
 * ★소스를 vm 에 그대로 올려 «진짜로» 부른다(선례 _text-template-harness.js) — 마크업을 베껴 들지 않는다.
 *   같은 vm 에 _helpers.js(disclosureSectionHtml 한 벌) · _section-spec.js · _panel-frame.js 를 올린다.
 *
 *   F1 정렬 — SECTION_ORDER 순 · special 은 선언순
 *   F2 중복 — 같은 key 두 번 / 같은 special 제목 두 번 → throw
 *   F3 빈 절 — html 이 빈 문자열·공백이면 DOM 에 없다
 *   F4 제목 규칙 — special 은 title 필수 · 단어(Title Case 또는 약어 2~4자) 1~2개(+개수) 아니면(한글·괄호·기호) → throw · 모르는 key → throw
 *   F5 접기 저장/복원 — localStorage 'gd-panel-collapsed' · 새 모듈 판에서도 복원 · 저장소 없거나 막혀도 안 죽는다
 *   F6 기본 = 전부 펼침 · aria-expanded/aria-controls == 몸통 id
 *   F7 disclosureSectionHtml 3인자 산출은 바이트 그대로(그리드 골든 보호) — 4인자(틀 판) = aria · 인라인 style/title 없음
 *   F10 렌더된 틀 마크업(머리·껍데기)에 색·px·rem·em 리터럴 0 — check-design-tokens.sh 하드게이트와 같은 정규식
 *   F11 docs/styleguide.html 정적 14행 표 == SECTION_ORDER · SECTION_TITLE (문서 순서 기계검사)
 *   N2 ★양성대조 — 그 표의 두 행을 맞바꾼 판이면 F11 판정이 빨강
 *   F12 소유 규칙 ownerOf/controlIdent — 컨트롤 id·data·«색이다» 표식 → 있어야 할 절(게이트의 본 칼날) · class 는 안 본다 · 표의 절 key 는 정본에 있다
 *   F13 하위 접기 제외는 «그릇 안»만 — 같은 컨트롤이 그릇 밖이면 소유 위반(judgePanel · tests/dom/_panel-sections.js)
 *   F8 정본 표 — SECTION_ORDER 와 SECTION_TITLE 가 special 외 1:1 · 모든 제목이 규칙을 지킨다
 *   F9 파일럿 — prop-gap.js · prop-bridge.js 는 propPanel.innerHTML 대신 renderPanel 을 쓴다
 *   N1 ★양성대조 — SECTION_ORDER 를 뒤집은 판을 올리면 F1 의 기대가 깨진다
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const _req = createRequire(import.meta.url);
const { readSrc } = _req('./_srcread.js');
const { stripComments } = _req('./_strip-comments.js');
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');

/** ESM 문법만 벗긴다(import 줄 · export 키워드). 본문은 그대로. */
const stripEsm = (src) => String(src).replace(/^import[^\n]*\n/gm, '').replace(/^export\s+/gm, '');

function memStorage(seed = {}) {
  const m = new Map(Object.entries(seed));
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), _m: m };
}

/** 틀을 새 vm 에 올린다. specPatch 로 _section-spec.js 소스를 바꿔 끼울 수 있다(양성대조용). */
function loadFrame({ storage, specPatch = (s) => s } = {}) {
  const parts = [
    stripEsm(readSrc(ROOT, 'js/props/_helpers.js')),
    stripEsm(specPatch(readSrc(ROOT, 'js/props/_section-spec.js'))),
    stripEsm(readSrc(ROOT, 'js/props/_panel-frame.js')),
  ];
  const propPanel = { innerHTML: '', addEventListener() {}, contains: () => true };
  const ctx = { console, propPanel };
  if (storage !== undefined) ctx.localStorage = storage;
  vm.createContext(ctx);
  vm.runInContext(parts.join('\n;\n') + `
;globalThis.__F = { sec, renderPanel, buildPanelHTML, isSectionCollapsed, setSectionCollapsed,
  fieldRowHTML, hintHTML, scopeChipsHTML, disclosureSectionHtml, disclosureChevronHtml, SECTION_ORDER, SECTION_TITLE, isValidSectionTitle, OWNERSHIP, OWNERSHIP_EXEMPT_SCOPES, controlIdent, ownerOf };`, ctx);
  return { ...ctx.__F, propPanel };
}

const secsOf = (html) => [...html.matchAll(/data-sec="([a-z]+)"/g)].map((m) => m[1]);
const titlesOf = (html) => [...html.matchAll(/<span class="prop-sec-title-text">([^<]*)<\/span>/g)].map((m) => m[1]);

/** F1 의 기대 — 틀 판마다 다시 잰다(N1 이 같은 함수로 뒤집힌 판을 잰다). */
function orderedAsExpected(F) {
  const html = F.buildPanelHTML({ sections: [
    F.sec('fill', 'f'), F.sec('size', 's'), F.sec('special', 'a', { title: 'First' }),
    F.sec('kind', 'k'), F.sec('special', 'b', { title: 'Second' }), F.sec('template', 't'),
  ] });
  return { html, secs: secsOf(html), titles: titlesOf(html) };
}

test('F1 정렬 — SECTION_ORDER 순 · special 은 선언순', () => {
  const r = orderedAsExpected(loadFrame());
  assert.deepEqual(r.secs, ['kind', 'size', 'fill', 'special', 'special', 'template']);
  assert.deepEqual(r.titles, ['Type', 'Size', 'Fill', 'First', 'Second', 'Template']);
  assert.match(r.html, /id="psec-special-0"[\s\S]*First[\s\S]*id="psec-special-1"[\s\S]*Second/, '★special id 가 선언순으로 안 붙는다');
});

test('F2 중복 — 같은 key 두 번 · 같은 special 제목 두 번 → throw', () => {
  const F = loadFrame();
  assert.throws(() => F.buildPanelHTML({ sections: [F.sec('size', 'a'), F.sec('size', 'b')] }), /두 번/);
  assert.throws(() => F.buildPanelHTML({ sections: [F.sec('size', 'a'), F.sec('size', '')] }), /두 번/, '★빈 절이라도 두 번 선언은 결함이다');
  assert.throws(() => F.buildPanelHTML({ sections: [F.sec('special', 'a', { title: 'Tail' }), F.sec('special', 'b', { title: 'Tail' })] }), /두 번/);
  assert.doesNotThrow(() => F.buildPanelHTML({ sections: [F.sec('special', 'a', { title: 'Tail' }), F.sec('special', 'b', { title: 'Handles' })] }));
});

test('F3 빈 절 — 빈 문자열·공백 html 은 DOM 에 없다', () => {
  const F = loadFrame();
  const html = F.buildPanelHTML({ header: '<div class="prop-block-label">H</div>', sections: [F.sec('kind', ''), F.sec('size', '  \n '), F.sec('fill', 'x'), F.sec('stroke', undefined)] });
  assert.deepEqual(secsOf(html), ['fill']);
  assert.match(html, /^\s*<div class="prop-section">\s*<div class="prop-block-label">H<\/div>/, '★header 가 맨 앞 머리 절(data-sec 없음)로 안 나온다');
  assert.equal(F.buildPanelHTML({ sections: [F.sec('kind', '')] }).trim(), '', '★절이 다 비면 빈 패널이어야 한다');
  // U0b ② — 몸이 비어도 headTools 가 있으면 머리 + 빈 몸으로 그린다(Effects 효과 0개 = 추가 목록 한 줄) · 둘 다 비면 버린다
  const ht = F.buildPanelHTML({ sections: [F.sec('effects', '', { headTools: '<select id="txt-fx-add"></select>', id: 'txt-fx-section' }), F.sec('fill', '', { headTools: '  ' })] });
  assert.deepEqual(secsOf(ht), ['effects'], '★headTools 만 있는 절이 빠졌거나 · 공백 headTools 절이 남았다');
  assert.match(ht, /id="txt-fx-section"[\s\S]*<\/div><select id="txt-fx-add"><\/select>\s*<\/div>\s*<div class="prop-sec-body" id="txt-fx-section-body">\s*<\/div>/, '★머리(+손잡이)·빈 몸 꼴이 아니다');
});

test('F4 제목 규칙 — special title 필수 · 규칙 밖 → throw · 모르는 key → throw', () => {
  const F = loadFrame();
  assert.throws(() => F.sec('special', 'x'), /title 이 필수/);
  for (const t of ['꼬리', 'Tail (V)', 'size', 'Arrow line', 'Three Word Title', 'Stroke(Text)', 'Cards-3', 'Cards 3 4', 'SIZES', 'Q', 'qa', 'qA', 'QA-Ticket', 'FAQ Set Two', '3d', '[Cell]', '']) {
    assert.throws(() => F.sec('special', 'x', { title: t }), /규칙 위반|필수/, `★「${t}」 를 통과시켰다`);
  }
  assert.throws(() => F.sec('size', 'x', { title: '크기' }), /규칙 위반/, '★special 아닌 절도 제목 덮어쓰기는 같은 규칙');
  assert.throws(() => F.sec('nope', 'x'), /모르는 절/);
  for (const t of ['Tail', 'Cards 3', 'Arrow Line', 'Arrow Line 2', 'QA', 'FAQ', '3D', 'SVG', 'CTA', 'QA Ticket', 'SVG Presets', '3D Mockup', 'FAQ 2']) assert.doesNotThrow(() => F.sec('special', 'x', { title: t }), t);
});

test('F5 접기 저장/복원 — localStorage · 새 모듈 판 복원 · 저장소 없음/막힘에도 안 죽는다', () => {
  const ls = memStorage();
  const A = loadFrame({ storage: ls });
  assert.equal(A.isSectionCollapsed('size'), false, '[전제] 기본 펼침');
  A.setSectionCollapsed('size', true);
  assert.deepEqual(JSON.parse(ls.getItem('gd-panel-collapsed')), ['size'], '★localStorage 에 안 적혔다');
  const B = loadFrame({ storage: ls });   // 재로드 흉내 — 새 모듈 상태
  assert.equal(B.isSectionCollapsed('size'), true, '★새 판에서 복원이 안 된다');
  const html = B.buildPanelHTML({ sections: [B.sec('size', 'x'), B.sec('fill', 'y')] });
  assert.match(html, /class="prop-section is-collapsed" data-sec="size"/);
  assert.match(html, /id="psec-size-head"[^>]*aria-expanded="false" aria-controls="psec-size-body"/);
  assert.match(html, /id="psec-size-body" hidden>/);
  assert.match(html, /id="psec-fill-body">/, '★다른 절까지 접혔다 — 접기 단위는 절 key 다');
  B.setSectionCollapsed('size', false);
  assert.deepEqual(JSON.parse(ls.getItem('gd-panel-collapsed')), []);
  // special 은 제목별로 따로 접힌다
  B.setSectionCollapsed('special:Tail', true);
  const h2 = B.buildPanelHTML({ sections: [B.sec('special', 'a', { title: 'Tail' }), B.sec('special', 'b', { title: 'Handles' })] });
  assert.match(h2, /class="prop-section is-collapsed" data-sec="special" data-sec-state="special:Tail"/);
  assert.match(h2, /class="prop-section" data-sec="special" data-sec-state="special:Handles"/);
  // 저장소 없음(유닛 vm) — typeof 가드 · 메모리 대역
  const N = loadFrame();
  N.setSectionCollapsed('fill', true);
  assert.equal(N.isSectionCollapsed('fill'), true, '★저장소가 없을 때 대역이 안 돈다');
  // 막힌 저장소 — 던져도 안 죽는다
  const T = loadFrame({ storage: { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } } });
  assert.doesNotThrow(() => T.setSectionCollapsed('kind', true));
  assert.equal(T.isSectionCollapsed('kind'), true);
});

test('F6 기본 = 전부 펼침 · aria-controls == 몸통 id · renderPanel 은 propPanel 에 쓴다', () => {
  const F = loadFrame({ storage: memStorage() });
  const p = F.renderPanel({}, { header: 'H', sections: [F.sec('size', 'x'), F.sec('stroke', 'y')] });
  assert.equal(p, F.propPanel, '★renderPanel 이 propPanel 을 안 돌려준다');
  assert.doesNotMatch(p.innerHTML, /hidden>|is-collapsed/);
  for (const k of ['size', 'stroke']) {
    assert.match(p.innerHTML, new RegExp(`id="psec-${k}-head" role="button" tabindex="0" aria-expanded="true" aria-controls="psec-${k}-body"`));
    assert.match(p.innerHTML, new RegExp(`<div class="prop-sec-body" id="psec-${k}-body">`));
  }
  assert.match(p.innerHTML, /<div class="prop-section-title-row prop-sec-head">/, '★절 머리가 title-row 안에 없다(손잡이 정렬 규칙 밖)');
  assert.ok(p.innerHTML.includes('>Stroke</span>'), '★stroke 제목이 «Stroke» 가 아니다(§8 Q1 정정 — 영어 Figma 명명)');
});

test('F7 disclosureSectionHtml 3인자 = 바이트 그대로 · 4인자(틀 판) = aria · 인라인 style/title 없음', () => {
  const F = loadFrame();
  /* ★3인자 골든 — 판 2852c9f44 의 산출(그리드 6절·카드가 쓰는 꼴). ⛔한 자도 고치지 마라(bt2-grid-panel-golden.json 이 같은 바이트를 품는다) */
  const chev = (open) => F.disclosureChevronHtml(open);   // 쉐브론 바이트는 disclosure-chevron-ssot 가 따로 잠근다
  for (const open of [true, false]) {
    const three = F.disclosureSectionHtml('h', 'T', open);
    assert.equal(three, `
      <div class="prop-section-title" id="h" role="button" tabindex="0"
           style="display:flex;align-items:center;gap:6px;cursor:pointer;"
           title="${open ? '접기' : '펼치기'}">
        ${chev(open)}
        <span style="flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">T</span>
      </div>`, '★3인자 산출이 바뀌었다 — 그리드 골든이 깨진다');
    const four = F.disclosureSectionHtml('h', 'T', open, 'b');
    assert.match(four, new RegExp(`role="button" tabindex="0" aria-expanded="${open}" aria-controls="b">`));
    assert.doesNotMatch(four, /style=|title=/, '★틀 판 머리에 인라인 style·툴팁이 남았다');
    assert.match(four, /<span class="prop-sec-title-text">T<\/span>/);
    assert.ok(four.includes(chev(open).replace(/\n\s*style="[^"]*">/, ' class="prop-sec-chevron">')), '★틀 판이 쉐브론 한 벌(인라인 style→클래스)을 안 쓴다');
    assert.match(four, /<path d="M1 3l4 4 4-4"\/>/);
  }
});

/* scripts/check-design-tokens.sh 의 LIT_RE 와 같은 꼴(grep -E → JS) */
const LIT_RE = /#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|[0-9]+(px|r?em)\b/;

test('F10 렌더된 틀 마크업(머리·껍데기)에 색·px·rem·em 리터럴 0', () => {
  const F = loadFrame({ storage: memStorage({ 'gd-panel-collapsed': '["fill"]' }) });
  const html = F.buildPanelHTML({ sections: [F.sec('size', 'BODY'), F.sec('fill', 'BODY'), F.sec('special', 'BODY', { title: 'Tail' })] });
  assert.ok(html.includes('hidden>'), '[전제] 접힌 판도 같이 쟀다');
  const hit = html.split('\n').filter((l) => LIT_RE.test(l));
  assert.deepEqual(hit, [], '★틀이 그린 마크업에 리터럴이 있다 — 토큰(css panel-frame 블록)으로');
  assert.ok(LIT_RE.test('<div style="gap:6px">') && LIT_RE.test('hsl(0,0%,50%)') && LIT_RE.test('2rem'), '[양성대조] 정규식이 산다');
});

/** styleguide.html 정적 표 → [[key, title], …] */
function styleguideRows(html) {
  const i = html.indexOf('<section id="panel-frame">');
  assert.ok(i > -1, '★styleguide.html 에 panel-frame 절이 없다');
  const sec = html.slice(i, html.indexOf('</section>', i));
  return [...sec.matchAll(/<tr><td>(\d+)<\/td><td><code>([a-z]+)<\/code><\/td><td><b>([^<]*)<\/b><\/td>/g)].map((m) => [m[2], m[3]]);
}
const styleguideMismatch = (rows, F) => {
  const want = F.SECTION_ORDER.map((k) => [k, F.SECTION_TITLE[k] ?? '(호출부가 줌)']);
  return JSON.stringify(rows) === JSON.stringify(want) ? null : { rows, want };
};

test('F11 docs/styleguide.html 정적 14행 표 == SECTION_ORDER · SECTION_TITLE', () => {
  const F = loadFrame();
  const rows = styleguideRows(readSrc(ROOT, 'docs/styleguide.html'));
  assert.equal(rows.length, 14, `[전제] 표 ${rows.length}행`);
  assert.equal(styleguideMismatch(rows, F), null, '★문서 표가 정본과 갈렸다 — docs/styleguide.html 패널 절 표를 고쳐라');
});

test('N2 ★양성대조 — 문서 표 두 행을 맞바꾸면 F11 판정이 빨강', () => {
  const F = loadFrame();
  const rows = styleguideRows(readSrc(ROOT, 'docs/styleguide.html'));
  [rows[3], rows[4]] = [rows[4], rows[3]];
  assert.notEqual(styleguideMismatch(rows, F), null, '★행을 바꿔도 같다 — F11 이 «안 재고» 있다');
});

test('F8 정본 표 — ORDER 와 TITLE 이 special 외 1:1 · 모든 제목이 규칙을 지킨다', () => {
  const F = loadFrame();
  assert.equal(F.SECTION_ORDER.length, 14);
  assert.deepEqual([...F.SECTION_ORDER].filter((k) => k !== 'special').sort(), Object.keys(F.SECTION_TITLE).sort());
  for (const [k, t] of Object.entries(F.SECTION_TITLE)) assert.ok(F.isValidSectionTitle(t), `${k}: ${t}`);
  /* ★현빈 확정 라벨(2026-11-13 Q1 정정 · 지디 확정값) — 바꾸려면 현빈 결정이 먼저다 */
  assert.deepEqual({ ...F.SECTION_TITLE }, { kind: 'Type', content: 'Content', position: 'Position', size: 'Size', layout: 'Layout',
    padding: 'Padding', appearance: 'Appearance', typography: 'Typography', fill: 'Fill', stroke: 'Stroke', effects: 'Effects',
    export: 'Export', template: 'Template' });
  assert.equal(new Set(Object.values(F.SECTION_TITLE)).size, 13, '★제목이 겹친다');
});

test('F9 파일럿 — prop-gap.js · prop-bridge.js 는 renderPanel 을 쓰고 propPanel.innerHTML 을 안 쓴다', () => {
  for (const rel of ['js/props/prop-gap.js', 'js/props/prop-bridge.js']) {
    const code = stripComments(readSrc(ROOT, rel));
    assert.match(code, /renderPanel\(/, `${rel}: ★renderPanel 을 안 부른다`);
    assert.doesNotMatch(code, /propPanel\.innerHTML\s*=/, `${rel}: ★패널을 손으로 짠다`);
    assert.doesNotMatch(code, /class="prop-section-title"/, `${rel}: ★절 머리를 손으로 짠다`);
  }
  const frame = stripComments(readSrc(ROOT, 'js/props/_panel-frame.js'));
  assert.equal((frame.match(/propPanel\.innerHTML\s*=/g) || []).length, 1, '★틀 안 innerHTML 대입이 한 곳이 아니다');
});

test('N1 ★양성대조 — SECTION_ORDER 를 뒤집은 판이면 F1 의 기대가 깨진다', () => {
  const ANCHOR = "'kind', 'content', 'position', 'size', 'layout', 'padding', 'appearance',\n  'typography', 'fill', 'stroke', 'effects', 'special', 'export', 'template',";
  const src = readSrc(ROOT, 'js/props/_section-spec.js');
  assert.ok(src.includes(ANCHOR), '★변이 닻을 못 찾았다 — 이 양성대조는 «안 재고» 있다');
  const rev = ANCHOR.replace(/\n/, ' ').split(',').map((s) => s.trim()).filter(Boolean).reverse().join(', ') + ',';
  const r = orderedAsExpected(loadFrame({ specPatch: (s) => s.replace(ANCHOR, rev) }));
  assert.notDeepEqual(r.secs, ['kind', 'size', 'fill', 'special', 'special', 'template'], '★순서를 뒤집어도 같은 결과 — F1 이 순서를 안 잰다');
  assert.equal(r.secs[0], 'template', '[전제] 뒤집힌 판이 실제로 올라갔다');
});

test('F12 소유 규칙 ownerOf/controlIdent — 컨트롤 식별 → 있어야 할 절', () => {
  const F = loadFrame();
  const cases = {
    'brg-color color': 'fill', 'mdl-bg-hex': 'fill', 'tb-border-color': 'stroke', 'stkStrokeColor': 'stroke',
    'frame-border-w': 'stroke', 'modal-radius': 'appearance', 'page-padx-number': 'padding', 'tb-pad-l': 'padding',
    'shadowBlur': 'effects', 'stk-glow-size': 'effects', 'tb-line-height': 'typography', 'letterSpacing': 'typography', 'font-picker': 'typography',
    'rotation-input': 'position', 'stk-x': 'position', 'asset-width': 'size', 'fr-height-number': 'size',
    'grd-colrule-w': 'stroke', 'grd-rowrule-inset': 'stroke',
    'brg-h-slider': null, 'gap-preset-btn h 20': null, 'gap-slider': null,
    /* U0b ⑦ 줄임 단어(블록 접두 뒤에서만): stk→stroke · sh→shadow */
    'stk-t-stk-c-color color': 'stroke', 'stk-t-stk-w': 'stroke', 'stk-t-sh-x': 'effects', 'stk-t-sh-y': 'effects',
    'stk-t-sh-num': 'effects', 'stk-t-sh-c-color color': 'effects',
    'stk-t-fill-color color': 'fill', 'stk-color color': 'fill', 'stk-x': 'position',   // ★함정: 첫 단어 stk(스티커 접두)는 stroke 가 아니다
    /* U0c ① 글 부위 단어 바로 뒤 size = 글자 크기 · 표 글자 크기는 id 줄기 · 그냥 블록 size-w/h 는 Size */
    'stb-title-size-slider': 'typography', 'stb-desc-size-number': 'typography', 'chb-typo-size-number': 'typography',
    'tbl-header-size-slider': 'typography', 'grb-pct-size-number': 'typography', 'cpn-slot-size-slider': 'typography',
    'tbl-size-slider': 'typography', 'tbl-size-number': 'typography', 'stb-size-w': 'size', 'mck-size-h': 'size', 'tbl-sizer-w': null,   // 줄기 tbl-size 는 「tbl-size」·「tbl-size-」만 — tbl-sizer 는 아니다
    'stb-title-gap-size': 'size',   // title 바로 뒤가 size 가 아니다(인접 규칙)
    /* U0c ⑤ export 단어 → Export 절 · 그냥 폭은 Size */
    /* U0c ⑥ bc(테두리 색) → Stroke — 색 칸의 짝(hex·alpha)도 같은 꼴 */
    'mdl-bc-color color': 'stroke', 'mdl-bc-hex color': 'stroke', 'mdl-bc-alpha color': 'stroke', 'bc-color color': 'fill',   // 첫 단어 bc 는 접두(바꾸지 않음)
    /* U0c ⑩ bdc(줌 테두리 색) → Stroke · shc(줌 효과 색) → Effects */
    'zm-bdc-color color': 'stroke', 'zm-bdc-hex color': 'stroke', 'zm-shc-color color': 'effects', 'zm-shc-alpha color': 'effects', 'zm-color color': 'fill',
    'sec-export-width': 'export', 'page-export-width': 'export', 'page-export-bg color': 'export', 'sec-width': 'size', 'mdl-width-number': 'size',
    /* U0c ② 선 = line + 색/두께 → Stroke(색짝 hex/alpha 포함) · line+height 는 그대로 Typography */
    'rdl-line-color color': 'stroke', 'rdl-line-hex color': 'stroke', 'rdl-line-alpha color': 'stroke', 'rdl-line-width': 'stroke',
    'tbl-line-color color': 'stroke', 'tbl-line-hex color': 'stroke', 'tb-line-height-number': 'typography', 'rdl-line-style': null,
  };
  assert.deepEqual(Object.fromEntries(Object.keys(cases).map((k) => [k, F.ownerOf(k)])), cases);
  /* 컨트롤 꼴 — readPanel 이 넘기는 {id,type,data,pairedColor}. ★class 는 넘겨도 안 쓴다. */
  const ctl = {
    'brg-color(type=color)': [{ id: 'brg-color', type: 'color' }, 'fill'],
    'brg-hex(색짝)': [{ id: 'brg-hex', type: 'text', pairedColor: true, cls: 'prop-color-hex' }, 'fill'],
    'brg-alpha(색짝)': [{ id: 'brg-alpha', type: 'text', pairedColor: true }, 'fill'],
    'iconify 프리셋 이름칸(.prop-color-hex 껍데기)': [{ id: 'icn-preset-newcat-input', type: 'text', cls: 'prop-color-hex' }, null],
    'iconify 저장 이름칸': [{ id: 'icn-preset-save-input', type: 'text', cls: 'prop-color-hex' }, null],
    '그리드 칸 사이 줄 색(type=color)': [{ id: 'grd-colrule-color', type: 'color' }, 'stroke'],
    '그리드 칸 사이 줄 hex(색짝)': [{ id: 'grd-rowrule-hex', type: 'text', pairedColor: true, cls: 'prop-color-hex' }, 'stroke'],
    'data 로 말하는 칸': [{ id: 'x1', type: 'number', data: [['prop', 'radius']] }, 'appearance'],
  };
  assert.deepEqual(Object.fromEntries(Object.entries(ctl).map(([k, [c]]) => [k, F.ownerOf(F.controlIdent(c))])),
    Object.fromEntries(Object.entries(ctl).map(([k, [, want]]) => [k, want])));
  /* ★양성대조 — class 를 단어로 쳤다면 iconify 이름칸은 fill 로 갔다(그래서 controlIdent 가 class 를 버린다) */
  assert.equal(F.ownerOf('icn-preset-newcat-input prop-color-hex'), 'fill', '[양성대조] class 단어가 들어가면 색으로 오판한다');
  for (const [, key] of F.OWNERSHIP) assert.ok(F.SECTION_ORDER.includes(key), `★표에 모르는 절 key: ${key}`);
  assert.deepEqual(Object.keys(F.OWNERSHIP_EXEMPT_SCOPES).sort(), ['grd-cell-body', 'grd-line-body', 'grd-rule-body']);
  /* ★양성대조 — 줄임 단어를 첫 단어에도 걸었다면 스티커 채움 색이 stroke 로 갔다(그래서 i > 0 만) */
  assert.equal(F.ownerOf('stroke color color'), 'stroke', '[양성대조] stk 를 첫 단어에도 풀면 stk-color 가 stroke 로 간다');
  /* ★양성대조(U0c ①) — 인접 규칙이 없던 판이면 stb-title-size 는 Size 로 갔다: 같은 단어열에서 title 을 떼면 Size */
  assert.equal(F.ownerOf('stb-size-slider'), 'size', '[양성대조] 글 부위 단어가 없으면 Size');
  assert.equal(F.ownerOf('stb-title-x-size'), 'position', '[양성대조] 인접이 아니면 title>size 가 안 걸린다');
  /* ★양성대조(U0c ②) — line 없는 같은 색 칸은 Fill(규칙이 «line» 에 걸려 있다) */
  assert.equal(F.ownerOf('rdl-fill-color color'), 'fill');
});

test('F13 하위 접기 제외는 «그릇 안»만 — 같은 컨트롤이 그릇 밖이면 소유 위반', () => {
  const { loadSectionSpec, judgePanel } = _req('../dom/_panel-sections.js');
  const spec = loadSectionSpec();
  const c = (scope) => ({ id: 'grd-cell-bg-color', type: 'color', data: [], pairedColor: false, scope });
  const panel = (scope) => ({ hints: 0, secs: [
    { sec: null, isHeader: true, title: null, labels: [], controls: [] },
    { sec: 'size', isHeader: false, title: 'Size', labels: [], controls: [c(scope)] },
  ] });
  assert.deepEqual(judgePanel(panel('grd-cell-body'), spec), [], '★하위 접기 그릇 안인데 빨갛다');
  assert.deepEqual(judgePanel(panel(null), spec), ['소유 위반: grd-cell-bg-color 는 fill 절 속성인데 size 절에 있다'], '★그릇 밖인데 안 잡는다');
  /* U0c ② 그리드 「줄」(글줄)의 색 칸 — 규칙상 line+color = stroke 지만 #grd-line-body 그릇 안이면 판정 밖 · 그릇 밖이면 잡힌다 */
  const gl = (scope) => ({ hints: 0, secs: [{ sec: 'typography', isHeader: false, title: 'Typography', labels: [],
    controls: [{ id: 'grd-line-color', type: 'color', data: [], pairedColor: false, scope }] }] });
  assert.deepEqual(judgePanel(gl('grd-line-body'), spec), [], '★그리드 글줄 색이 그릇 안인데 stroke 로 잡혔다');
  assert.deepEqual(judgePanel(gl(null), spec), ['소유 위반: grd-line-color 는 stroke 절 속성인데 typography 절에 있다'], '[양성대조] 그릇 밖이면 잡는다');
  /* U0c ③ data-own 명시 덮어쓰기 — 건너뛰기가 아니라 «그 절이어야 한다» */
  const rad = (sec, own, data = []) => ({ hints: 0, secs: [{ sec, isHeader: false, title: spec.SECTION_TITLE[sec], labels: [],
    controls: [{ id: 'rdl-radius-slider', type: 'range', data, pairedColor: false, scope: null, own }] }] });
  assert.deepEqual(judgePanel(rad('layout', null), spec), ['소유 위반: rdl-radius-slider 는 appearance 절 속성인데 layout 절에 있다'], '[양성대조] 덮어쓰기 없으면 radius = appearance');
  assert.deepEqual(judgePanel(rad('layout', 'layout'), spec), [], '★조상 줄 data-own=layout 인데 빨갛다');
  assert.deepEqual(judgePanel(rad('layout', null, [['own', 'layout']]), spec), [], '★컨트롤 자신의 data-own=layout 인데 빨갛다');
  const two = { hints: 0, secs: [{ sec: 'layout', isHeader: false, title: 'Layout', labels: [], controls: [] },
    { sec: 'appearance', isHeader: false, title: 'Appearance', labels: [], controls: [{ id: 'rdl-radius-slider', type: 'range', data: [], own: 'layout' }] }] };
  assert.deepEqual(judgePanel(two, spec), ['소유 위반: rdl-radius-slider 는 layout 절 속성인데 appearance 절에 있다'], '★덮어쓰기가 판정을 건너뛰었다(여전히 재야 한다)');
  assert.deepEqual(judgePanel(rad('layout', 'lay-out'), spec), ['data-own 이 이 패널에 없는 절: rdl-radius-slider → lay-out'], '★오타 key 를 못 잡는다');
  assert.deepEqual(judgePanel(rad('layout', 'appearance'), spec), ['data-own 이 이 패널에 없는 절: rdl-radius-slider → appearance'], '★패널에 없는 정본 key 를 못 잡는다');
  /* U0c ⑦ 블록 고유 절 key — data-own="special:<제목>" (페이지 Grid 보기 도우미 · Buzz …) */
  const grid = (own, title = 'Grid') => ({ hints: 0, secs: [{ sec: 'special', isHeader: false, title, labels: [],
    controls: [{ id: 'page-grid-color', type: 'color', data: [], own }, { id: 'page-pad-hint-color', type: 'color', data: [], own }] }] });
  assert.deepEqual(judgePanel(grid('special:Grid'), spec), [], '★special 절 key 덮어쓰기가 안 먹는다');
  assert.deepEqual(judgePanel(grid(null), spec), ['소유 위반: page-grid-color 는 fill 절 속성인데 special:Grid 절에 있다',
    '소유 위반: page-pad-hint-color 는 padding 절 속성인데 special:Grid 절에 있다'], '[양성대조] 덮어쓰기 없으면 fill');
  assert.deepEqual(judgePanel(grid('special:Gird'), spec).length, 2, '★special 오타를 못 잡는다');
  /* U0c ④ 반복 항목 카드 — Content 안이면 판정 밖 · 같은 카드가 다른 절(Appearance)이면 판정 */
  const card = (sec, itemCard) => ({ hints: 0, secs: [{ sec, isHeader: false, title: spec.SECTION_TITLE[sec], labels: [],
    controls: [{ id: 'cmp-card-0-bg-color', type: 'color', data: [], pairedColor: false, scope: null, own: null, itemCard }] }] });
  assert.deepEqual(judgePanel(card('content', true), spec), [], '★Content 안 항목 카드인데 빨갛다');
  assert.deepEqual(judgePanel(card('appearance', true), spec), ['소유 위반: cmp-card-0-bg-color 는 fill 절 속성인데 appearance 절에 있다'], '[양성대조] Appearance 의 카드는 판정');
  assert.deepEqual(judgePanel(card('content', false), spec), ['소유 위반: cmp-card-0-bg-color 는 fill 절 속성인데 content 절에 있다'], '[양성대조] 카드 밖 Content 컨트롤은 판정');
  /* U0b ⑦ 코인 금속색 — 색 칸 id 를 제외하면 그 짝(hex·alpha)도 빠진다 · 제외 밖 짝은 여전히 잡는다 */
  const coin = (id, pairId) => ({ id, type: pairId ? 'text' : 'color', data: [], pairedColor: !!pairId, pairId, scope: null });
  const special = (controls) => ({ hints: 0, secs: [{ sec: 'special', isHeader: false, title: 'Coin', labels: [], controls }] });
  assert.deepEqual(judgePanel(special([coin('stk-coin-face-color'), coin('stk-coin-face-hex', 'stk-coin-face-color'),
    coin('stk-coin-side-color'), coin('stk-coin-side-alpha', 'stk-coin-side-color')]), spec), [], '★코인 금속색(제외)이 빨갛다');
  assert.deepEqual(judgePanel(special([coin('stk-coin-rim-hex', 'stk-coin-rim-color')]), spec),
    ['소유 위반: stk-coin-rim-hex 는 fill 절 속성인데 special:Coin 절에 있다'], '[양성대조] 제외 밖 색짝은 잡는다');
});
