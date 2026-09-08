/* zoom-drop-shadow — 확대블럭의 «도형 그림자»(드롭섀도). 현빈 2026-09-08
 *   「그리고 줌블럭에 쉐도우 온오프 기능도 별도로 있도록 해줘」
 *
 * ★「별도로」가 무슨 뜻인지부터 실측으로 갈렸다
 *   줌블럭엔 온·오프가 «이미» 있다 — prop-zoom 의 zm-shadow 라디오. 그런데 그건
 *   돋보기 «광원 사다리꼴»(SVG 폴리곤)이지 «도형 그림자»가 아니다. 블록엔 CSS 그림자가 0 이었다.
 *   ⇒ 현빈이 말한 건 도형 «자체»의 드롭섀도다. 그래서 키를 «따로» 둔다:
 *      dataset.shadow     = 'on'|'off'             — 광원(기존, 안 건드림)
 *      dataset.dropShadow = 'none'|'soft'|'strong' — 도형 그림자(이 검사가 지키는 것)
 *
 * ★★box-shadow 가 아니라 filter: drop-shadow 인 이유 (실측)
 *   회전 30°·rect 260×140 에서 블록 상자는 «축정렬 정사각 + border-radius 0» 이다
 *   (회전은 CSS transform 이 아니라 data-rotation 이고, 도형만 SVG 안에서 돈다).
 *   box-shadow 는 그 «블록 상자»를 따라가므로 돌아간 도형 뒤에 네모 그림자가 어긋나 뜬다.
 *   스크린샷으로 확인했다. drop-shadow 는 알파(실루엣)를 따라간다. 선례 = mockup-block.js:296.
 *
 * ⚠️런타임(정말 화면이 바뀌나)은 여기서 못 잰다 — tests/dom/zoom-drop-shadow.dom.spec.js 가 잰다.
 *   여기는 «변이를 빨갛게 만드는 그물»이다(node --test 게이트가 도는 자리).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readSrc } from './_srcread.js';
import { makeStripper } from './_strip-comments.js';

/* ⛔new URL(import.meta.url).pathname 으로 경로를 만들면 «안 된다» — 윈도우에서 '/C:/…' 가
   나와 require 가 못 찾는다(검사 ②-5 가 그 자리를 0건으로 못박는다). fileURLToPath 를 쓴다. */
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/* ⛔주석 걷어내기는 «공용» 부품으로만 한다(자기 벌을 만들면 S-6 이 즉시 빨강).
   ★왜 꼭 걷어내야 하나: 이 기능의 주석엔 「box-shadow 를 쓰면 안 된다」가 그대로 적혀 있다.
     안 걷어내면 T2 가 «자기 주석»을 보고 오발한다. */
const strip = (src) => { const s = makeStripper(); return src.split('\n').map(s).join('\n'); };

const SRC = {
  block: strip(readSrc(ROOT, 'js/blocks/zoom-block.js')),
  prop:  strip(readSrc(ROOT, 'js/props/prop-zoom.js')),
  css:   strip(readSrc(ROOT, 'css/editor-blocks.css')),
};

/* 중괄호 균형으로 «구간»을 뜬다.
   ⛔고정 창(slice(i, i+900)) 금지 — 코드가 길어지면 조용히 잘려 검사가 눈이 먼다.
   ⚠️함정: f(opts = {}) 의 «기본값 중괄호»를 몸통으로 오인한다. 여기서 뜨는 구간은
     `... .forEach(btn => {` 처럼 «여는 중괄호가 곧 몸통»인 자리뿐이라 그 함정을 안 밟지만,
     다른 자리에 이 도구를 쓸 땐 매개변수 괄호를 «먼저 닫고» 몸통을 찾아라. */
function braceSlice(src, marker) {
  const i = src.indexOf(marker);
  assert.notEqual(i, -1, `구간을 못 찾음(코드가 사라졌거나 이름이 바뀌었다): ${marker}`);
  let j = src.indexOf('{', i);
  assert.notEqual(j, -1, `구간의 여는 중괄호를 못 찾음: ${marker}`);
  let depth = 0;
  for (; j < src.length; j++) {
    if (src[j] === '{') depth++;
    else if (src[j] === '}') { depth--; if (depth === 0) { j++; break; } }
  }
  assert.equal(depth, 0, `중괄호가 안 닫힌다: ${marker}`);
  return src.slice(i, j);
}

/** `.zoom-block[data-drop-shadow="<단계>"]` 로 시작하는 CSS 규칙들을 «전부» 뜬다. */
function dropShadowRules() {
  const out = [];
  const re = /\.zoom-block\[data-drop-shadow="([a-z]+)"\][^{]*\{([^}]*)\}/g;
  let m;
  while ((m = re.exec(SRC.css))) out.push({ 단계: m[1], 본문: m[2] });
  return out;
}

/* ── T0 ★「입력이 살아 있다」 — 본 단언 «앞»에 선다 ──────────────────────────
   ⛔이게 없으면 「소스를 못 읽어 0건 → 아무것도 안 걸림 → 초록」이 된다.
   ★세는 검사(T2·T3)의 «셀 대상이 있다»도 여기서 따로 못박는다. */
test('T0-a 훑는 소스 셋이 «비어 있지 않다» (읽기·주석걷기가 코드를 통째로 날리지 않았다)', () => {
  for (const [k, v] of Object.entries(SRC)) {
    assert.ok(v.length > 2000, `SRC.${k} 가 ${v.length}자다 — 소스를 못 읽었거나 주석걷기가 삼켰다`);
  }
  // 주석을 걷고도 «진짜 코드»가 남아 있나 (걷기가 파일을 삼키면 여기서 빨강)
  assert.ok(SRC.block.includes('ZOOM_DEFAULTS'), 'zoom-block 에서 코드가 사라졌다');
  assert.ok(SRC.prop.includes('showZoomProperties'), 'prop-zoom 에서 코드가 사라졌다');
  assert.ok(SRC.css.includes('.zoom-block'), 'CSS 에서 코드가 사라졌다');
});

test('T0-b ★세는 검사의 «셀 대상이 있다» — 규칙 2개 · 버튼 3개', () => {
  // 되돌리면 빨강: CSS 규칙을 지우거나 패널 버튼 그룹을 지우면 여기서 «먼저» 걸린다.
  const rules = dropShadowRules();
  assert.ok(rules.length >= 2, `data-drop-shadow CSS 규칙이 ${rules.length}건이다 — 셀 것이 없으면 T2·T3 은 «0건 통과»가 된다`);
  const grp = braceSlice(SRC.prop, "#zm-drop-group .prop-align-btn').forEach(btn =>");
  assert.ok(grp.length > 50, '패널 핸들러 구간이 비었다');
  const btns = (SRC.prop.match(/data-val="(none|soft|strong)"/g) || []);
  assert.equal(btns.length, 3, `도형 그림자 버튼이 ${btns.length}개다 (없음·부드럽게·강하게 = 3개여야 한다)`);
});

/* ── T1 키가 «광원»과 다르다 ───────────────────────────────────────────── */
test('T1 ★도형 그림자 키가 광원 키(dataset.shadow)를 «안 뺏는다»', () => {
  // 되돌리면 빨강: dropShadow → shadow 로 이름을 바꾸면 둘이 서로를 덮고 여기서 걸린다.
  assert.match(SRC.block, /dropShadow:\s*'none'/, 'ZOOM_DEFAULTS.dropShadow 가 없다');
  assert.match(SRC.block, /dropShadow:\s*_dropShadow\(d\.dropShadow/,
    'readZoomState 가 d.dropShadow 를 «자기 키»에서 읽지 않는다');
  // 광원 키는 «그대로» 살아 있다
  assert.match(SRC.block, /shadow:\s*_onOff\(d\.shadow/, '광원 키(shadow)를 죽였다');
  assert.match(SRC.block, /shadow:\s*'off'/, '광원 기본값(off)을 죽였다');

  // 새 핸들러가 dataset.shadow 를 건드리면 안 된다 (구간을 떠서 «그 안»만 본다)
  const h = braceSlice(SRC.prop, "#zm-drop-group .prop-align-btn').forEach(btn =>");
  assert.match(h, /block\.dataset\.dropShadow\s*=/, '새 핸들러가 dropShadow 를 안 쓴다');
  assert.equal(/block\.dataset\.shadow\s*=/.test(h), false,
    '도형 그림자 핸들러가 dataset.shadow(광원)를 덮어쓴다 — 둘이 서로를 지운다');

  // CSS 도 «다른 속성»을 본다
  assert.equal(/\.zoom-block\[data-shadow=/.test(SRC.css), false,
    'CSS 가 data-shadow(광원)를 보고 도형 그림자를 칠한다 — 키를 나눠 쓰면 안 된다');
});

/* ── T2 ★box-shadow 가 «아니라» filter: drop-shadow ─────────────────────── */
test('T2 ★도형 그림자는 filter: drop-shadow 로 그린다 (⛔box-shadow 아님)', () => {
  // 되돌리면 빨강: filter → box-shadow 로 바꾸면 여기가 «즉시» 빨강.
  const rules = dropShadowRules();
  assert.ok(rules.length >= 2, '셀 규칙이 없다');   // T0-b 와 겹치는 하한 — 0건 통과 방지
  for (const r of rules) {
    assert.match(r.본문, /filter\s*:/, `[${r.단계}] 규칙이 filter 를 안 쓴다`);
    assert.match(r.본문, /drop-shadow\(/, `[${r.단계}] 규칙에 drop-shadow() 가 없다`);
    assert.equal(/box-shadow/.test(r.본문), false,
      `[${r.단계}] 가 box-shadow 다 — 잘린 실루엣을 안 따라가 네모 그림자가 도형 밖에 뜬다`);
  }
  // ⛔인라인 style 로 칠하면 안 된다 — renderZoomBlock 이 style.cssText 를 통째로 다시 쓴다.
  //   (실측: 렌더 한 번에 인라인 filter 가 null 로 날아갔다.)
  assert.equal(/dataset\.dropShadow[\s\S]{0,80}style\.filter\s*=/.test(SRC.prop), false,
    '인라인 style.filter 로 칠하면 렌더 한 번에 날아간다 — attribute + CSS 로 가야 한다');
});

/* ── T3 끔 → 비고 · 켬 → 값이 든다 ──────────────────────────────────────── */
test('T3 ★끔(none)이면 filter 가 «비고», 켬(soft/strong)이면 값이 «든다»', () => {
  // 되돌리면 빨강: none 에 규칙을 달거나(끔이 안 꺼짐) soft/strong 값을 비우면 걸린다.
  const rules = dropShadowRules();
  const 단계들 = rules.map(r => r.단계).sort();
  assert.deepEqual(단계들, ['soft', 'strong'],
    'soft·strong 만 규칙을 가져야 한다 — none 에 규칙이 붙으면 «끔»이 안 꺼진다');

  for (const r of rules) {
    // drop-shadow(...) 안이 «비어 있지 않다» (하한 — 「빈 값이라 아무 일도 안 함」 방지)
    const v = /drop-shadow\(([^)]*(?:\([^)]*\))?[^)]*)\)/.exec(r.본문);
    assert.ok(v, `[${r.단계}] drop-shadow() 를 못 읽었다`);
    assert.ok(v[1].trim().length >= 10, `[${r.단계}] drop-shadow 값이 «비었다»: ${JSON.stringify(v[1])}`);
    assert.match(v[1], /rgba?\(/, `[${r.단계}] 그림자 색이 없다 — 안 보인다`);
  }
  // 기본은 «끔» — 있던 블록이 갑자기 그림자를 얻으면 안 된다.
  assert.match(SRC.block, /dropShadow:\s*'none'/, '기본값이 none 이 아니다');
  // 모르는 값은 기본으로 떨어진다(저장본 변조 대비) — _onOff 와 같은 규율.
  assert.match(SRC.block, /ZOOM_DROP_SHADOWS\s*=\s*\['none',\s*'soft',\s*'strong'\]/,
    '허용 단계 목록이 없다 — 저장본에 아무 값이나 들어오면 그대로 나간다');
});

/* ── T4 남의 것을 안 죽였다 (정적) ──────────────────────────────────────── */
test('T4 ★광원 라디오와 「라디오여야 한다」 규약이 «그대로» 산다', () => {
  // 되돌리면 빨강: 새 컨트롤을 체크박스로 만들면(prop-sticker 의 prop-toggle 을 통째로 베끼면)
  //   기존 검사 ⓑ-14 와 «함께» 여기가 빨강. 현빈이 「라디오버튼으로」라고 못박은 자리다.
  assert.equal(/type="checkbox"/.test(SRC.prop), false,
    'prop-zoom 에 체크박스가 생겼다 — ⓑ-14 가 금지한다');
  for (const v of ['on', 'off']) {
    assert.ok(SRC.prop.includes(`type="radio" name="zm-shadow" value="${v}"`),
      `광원 라디오(zm-shadow ${v})가 사라졌다`);
  }
  // 새 컨트롤은 Shape 프리셋과 «같은 관용구»(prop-align-group)를 쓴다 — 새 어휘를 안 만든다.
  assert.match(SRC.prop, /prop-align-group" id="zm-drop-group"/, '새 컨트롤이 관용구를 안 따른다');
});
