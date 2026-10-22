/* U-PIELEG — ★원형 그래프의 ★범례를 ★끌 수 있는가. ＋ ★꺼도 ★옛 저장본이 ★한 글자도 안 바뀌는가. (2026-10-22)
 *   실행: `npm test` (= node tests/run-unit.mjs 'tests/unit/*.test.mjs' 'tests/unit/*.test.js')
 *
 * ★왜 — ★현빈 t4-18: 「원형그래프 블럭 : ★하단에 ★컬러 칩 ★제거하기」
 *   ★「하단 컬러 칩」 = ★범례다(`.grb-pie-legend` · 칩 = `.grb-pie-dot` · drag-utils.js 의 _renderPie).
 *   ★고치기 «전» 실측: `drag-utils.js:1281` 이 ★조건 없이 ★항상 범례를 낸다 ⇒ ★끌 길이 ★없었다.
 *   ★패널 토글 명부(prop-graph.js:17~19 = showAxis·showGrid·showLine)에도 ★범례가 ★없었다.
 *
 * ★★극성에 주의 — ★기본은 ★「보임」이어야 한다
 *   ★`pieRank`·`pieName` 은 「켜면 '1' · 끄면 키 삭제」라 ★기본(키 없음)이 ★꺼짐이다.
 *   ★범례는 ★지금 ★보이고 있으므로, 같은 극성으로 하면 ★★옛 저장본이 ★전부 바뀐다.
 *   ⇒ ★키 이름을 ★`pieLegendOff` 로 두고 ★「'1' 일 때만 ★뺀다」 ⇒ ★★키 없으면 ★한 글자도 안 바뀐다
 *     (이 집의 관용구다 — `:1271` 「키가 있을 때만 인라인 … ⇒ G0 골든 유지」와 ★같은 꼴).
 *
 * ⚠️★이 파일이 ★못 재는 것: ★화면에서 ★칩이 ★사라지는 것. ★여기 있는 것은 ★소스 꼴뿐이다.
 *   ⇒ ★DOM 축은 ★`tests/dom/graph-pie-1017.dom.spec.js` 계열에 ★덧붙여야 한다(★레인 몫 · 앱 필요).
 *   ★★그래서 ★T3 가 ★이 파일의 ★가장 약한 칸이다 — ★「조건이 걸렸다」까지만 잰다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';

const ROOT = process.env.GD1001_ROOT || path.join(import.meta.dirname, '..', '..');
const rd = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1 ');

test('T1 ★패널에 ★범례 토글이 있다 — ★배선 ★파생 명부에 ★들어 있다(⛔손으로 단 리스너 금지)', () => {
  const prop = stripComments(rd('js/props/prop-graph.js'));
  assert.match(prop, /id="grb-pie-legend-toggle"/, '⛔범례 토글 입력칸이 없다');
  // ★배선은 ★한 자리(파생 명부)에서 와야 한다
  const roster = prop.match(/for \(const \[tid, key[^\]]*\] of \[([\s\S]*?)\]\) \{/);
  assert.ok(roster, '⛔토글 배선 파생 명부를 못 찾았다 — 꼴이 바뀌었으면 이 자를 고쳐라');
  assert.match(roster[1], /grb-pie-legend-toggle/, '⛔범례 토글이 ★그 명부에 없다(따로 달면 자리가 둘이 된다)');
  for (const t of ['grb-pie-rank-toggle', 'grb-pie-name-toggle']) {
    assert.match(roster[1], new RegExp(t), `⛔기존 토글 ${t} 가 명부에서 빠졌다`);
  }
});

test('T2 ★★기본은 ★보임 — ★키가 ★없으면 ★범례가 ★그대로 나온다(옛 저장본 무변)', () => {
  const du = stripComments(rd('js/drag-utils.js'));
  // ★「'1' 일 때만 뺀다」 꼴이어야 한다 — ⛔「'1' 일 때만 넣는다」면 기본이 꺼짐이 되어 옛 저장본이 바뀐다
  assert.match(du, /pieLegendOff\s*===\s*'1'/, '⛔`pieLegendOff === \'1\'` 비교가 없다');
  assert.doesNotMatch(du, /pieLegend\s*===\s*'1'\s*\?\s*`<div class="grb-pie-legend/,
    '⛔극성이 뒤집혔다 — 키가 있을 때만 «넣으면» 옛 저장본의 범례가 전부 사라진다');
  const prop = stripComments(rd('js/props/prop-graph.js'));
  assert.match(prop, /pieLegendOff\s*!==\s*'1'\s*\?\s*'checked'/,
    '⛔토글의 checked 가 ★키 없음 = 켜짐 이 아니다(기본이 꺼짐으로 보인다)');
});

test('T3 ★렌더가 ★그 키를 ★조건으로 쓴다 (⚠️이 파일의 ★가장 약한 칸 — ★화면은 안 잰다)', () => {
  const du = stripComments(rd('js/drag-utils.js'));
  const pie = du.slice(du.indexOf('grb-pie-wrap'));
  const legendLine = pie.split('\n').find(l => l.includes('grb-pie-legend"'));
  assert.ok(legendLine, '⛔범례를 내는 줄을 못 찾았다');
  assert.match(legendLine, /pieLegendOff|_legendHTML|_leg\b/,
    '⛔범례 줄이 ★조건 없이 ★항상 나온다 — 끌 길이 없다');
});

test('T4 ★★양성대조 — ★이 파일의 자가 ★«고치기 전» 꼴을 ★잡는가', () => {
  // ★고치기 전 실제 꼴을 ★그대로 적어 미끼로 쓴다(⛔내가 지어낸 꼴이 아니다 · 261022 실측 :1281)
  const before = '      <div class="grb-pie-legend" style="font-size:${labelSize}px${_legGapCss}">${legend}</div>`;';
  assert.doesNotMatch(before, /pieLegendOff|_legendHTML|_leg\b/,
    '⛔자가 눈이 멀었다 — 고치기 전 꼴을 ★통과시킨다');
  // ★음성대조 — 고친 꼴은 통과해야 한다
  const after = '      ${d.pieLegendOff === \'1\' ? \'\' : `<div class="grb-pie-legend" style="...">${legend}</div>`}';
  assert.match(after, /pieLegendOff/, '⛔고친 꼴을 거짓으로 거절한다');
});
