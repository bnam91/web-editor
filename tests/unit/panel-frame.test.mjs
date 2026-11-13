/* panel-frame.test.mjs — 우측 패널 틀(js/props/_panel-frame.js · _section-spec.js)의 규칙을 잠근다. (right-panel-unify U0)
 *   실행: node --test tests/unit/panel-frame.test.mjs
 *
 * ★소스를 vm 에 그대로 올려 «진짜로» 부른다(선례 _text-template-harness.js) — 마크업을 베껴 들지 않는다.
 *   같은 vm 에 _helpers.js(disclosureSectionHtml 한 벌) · _section-spec.js · _panel-frame.js 를 올린다.
 *
 *   F1 정렬 — SECTION_ORDER 순 · special 은 선언순
 *   F2 중복 — 같은 key 두 번 / 같은 special 제목 두 번 → throw
 *   F3 빈 절 — html 이 빈 문자열·공백이면 DOM 에 없다
 *   F4 제목 규칙 — special 은 title 필수 · Title Case 영어 1~2단어(+개수) 아니면(한글·괄호·기호) → throw · 모르는 key → throw
 *   F5 접기 저장/복원 — localStorage 'gd-panel-collapsed' · 새 모듈 판에서도 복원 · 저장소 없거나 막혀도 안 죽는다
 *   F6 기본 = 전부 펼침 · aria-expanded/aria-controls == 몸통 id
 *   F7 disclosureSectionHtml 3인자 산출은 바이트 그대로(그리드 골든 보호) — 4인자 = 3인자 + aria 치환«만»
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
  fieldRowHTML, hintHTML, scopeChipsHTML, disclosureSectionHtml, SECTION_ORDER, SECTION_TITLE, isValidSectionTitle };`, ctx);
  return { ...ctx.__F, propPanel };
}

const secsOf = (html) => [...html.matchAll(/data-sec="([a-z]+)"/g)].map((m) => m[1]);
const titlesOf = (html) => [...html.matchAll(/text-overflow:ellipsis;white-space:nowrap;">([^<]*)<\/span>/g)].map((m) => m[1]);

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
});

test('F4 제목 규칙 — special title 필수 · 영문/괄호 → throw · 모르는 key → throw', () => {
  const F = loadFrame();
  assert.throws(() => F.sec('special', 'x'), /title 이 필수/);
  for (const t of ['꼬리', 'Tail (V)', 'size', 'Arrow line', 'Three Word Title', 'Stroke(Text)', 'Cards-3', 'Cards 3 4', 'SIZE', '[Cell]', '']) {
    assert.throws(() => F.sec('special', 'x', { title: t }), /규칙 위반|필수/, `★「${t}」 를 통과시켰다`);
  }
  assert.throws(() => F.sec('size', 'x', { title: '크기' }), /규칙 위반/, '★special 아닌 절도 제목 덮어쓰기는 같은 규칙');
  assert.throws(() => F.sec('nope', 'x'), /모르는 절/);
  for (const t of ['Tail', 'Cards 3', 'Arrow Line', 'Arrow Line 2']) assert.doesNotThrow(() => F.sec('special', 'x', { title: t }), t);
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

test('F7 disclosureSectionHtml 3인자 = 바이트 그대로 · 4인자 = 3인자 + aria 치환«만»', () => {
  const F = loadFrame();
  for (const open of [true, false]) {
    const three = F.disclosureSectionHtml('h', '제목', open);
    assert.doesNotMatch(three, /aria-/, '★3인자 산출에 aria 가 섞였다 — 그리드 골든(bt2-grid-panel-golden.json)이 깨진다');
    const four = F.disclosureSectionHtml('h', '제목', open, 'b');
    const expect = three.replace('role="button" tabindex="0"', `role="button" tabindex="0" aria-expanded="${open}" aria-controls="b"`);
    assert.equal(four, expect, '★4인자 산출이 «3인자 + aria 치환» 밖으로 달라졌다');
  }
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
