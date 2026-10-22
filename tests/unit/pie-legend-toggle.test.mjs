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

/* ★★★T5 — ★t4-18 의 ★부작용을 ★잠근다: `LEGEND-OFF-KILLS-NAME-EDIT-01`
 *   ★`.grb-pie-label`(범례 안 항목 이름)은 ★`GRB_CAT_LABEL_SEL`(drag-utils.js:808)에 들어 있어
 *     ★★더블클릭 ★캔버스 편집 ★대상이다. ⇒ ★★범례를 ★끄면 ★그 길이 ★같이 ★없어진다.
 *   ★그 길을 ★돌려주는 것이 ★★t4-17 이다 — ★조각 안 이름(`.grb-pie-name`)은 ★범례와 ★★같은
 *     `items[i].label` 이라 ★★편집 대상 명부에 ★그 하나를 ★더하면 된다.
 *     ★선례 = `css/editor-graph.css:498~502`(K8⒤ — 꺾은선 ★카테고리 라벨만 `pointer-events:auto`).
 *   ⛔`.grb-pie-rank`(「n위」)는 ★편집 대상이 ★아니다 — `graph-pie-geom.js:129 pieRanks(values)` 가
 *     ★값 내림차순으로 ★계산한다. ★손으로 고치면 ★값과 ★어긋난다. ⇒ ★이 칸은 ★이름만 잰다.
 *   ★★`todo` 로 둔다 — ★t4-17 이 ★닫으면 ★★저절로 초록이 된다. ⛔「일부러 빨강」이면 ★다음 빨강을 가린다. */
test('T5 ★범례를 꺼도 ★이름을 ★캔버스에서 고칠 길이 ★남는다 (t4-17 이 닫음)', () => {
  const du = stripComments(rd('js/drag-utils.js'));
  const m = du.match(/const GRB_CAT_LABEL_SEL\s*=\s*'([^']+)'/);
  assert.ok(m, '⛔GRB_CAT_LABEL_SEL 을 못 떼었다 — 꼴이 바뀌었으면 이 자를 고쳐라');
  const sel = m[1];
  // ★전제 — ★범례 라벨은 ★그 명부에 ★있다(★있어야 ★이 칸의 뜻이 선다)
  assert.match(sel, /\.grb-pie-label/, '⛔전제가 깨졌다: 범례 라벨이 편집 명부에서 빠졌다');
  // ★★본 단언 — ★조각 «안» 이름도 ★그 명부에 ★있어야 ★범례를 꺼도 길이 남는다
  assert.match(sel, /\.grb-pie-name/,
    '⛔범례를 끄면 이름 편집 입구가 사라진다 — 조각 안 이름(.grb-pie-name)이 편집 명부에 없다');
  // ★그리고 ★그 상자가 ★클릭을 받아야 한다(선례 K8⒤ 꼴 · 컨테이너는 none 유지)
  const css = rd('css/editor-graph.css');
  /* 범위 밖(t4-17 판정 ㉮ · 261022 S3): 「.grb-pie-tag auto」 단언은 아래 T5b(todo)로 옮겼다 — 지우지 않음.
     왜: 상자를 열면 1013t1C3 계약(graph-pie-1013 J5 «라벨 위를 눌러도 그 조각» · J2 · X1)이 3 빨강(실측 · 바닥 사본 3 초록).
     그래서 덧층은 none 그대로 두고, 더블클릭은 drag-utils.js _bindGraphLabelEdit 위임 안의 사각형 판정(_grbPieNameAt)으로 받는다.
     행동 단언(조각 안 이름 더블클릭 → 편집 열림)은 tests/dom/graph-label-edit.dom.spec.js T8 이 잰다.
  assert.match(css, /\.grb-pie-tag\s*\{[^}]*pointer-events:\s*auto/,
    '⛔조각 안 라벨 상자가 클릭을 안 받는다(.grb-pie-tag 에 pointer-events:auto 없음)'); */
  assert.match(css, /\.grb-pie-tags\s*\{[^}]*pointer-events:\s*none/,
    '⛔컨테이너(.grb-pie-tags)는 none 이어야 한다 — 열면 조각 클릭이 죽는다');
});
/* T5b — 지디 발주(덧③ ④)의 「상자 auto」 단언 그대로 · todo(⛔지우지 않음). 지디 판정 261022: 처방 ⑵ 는 틀렸다 — HIT-TOP-FLIPPED-BY-POINTER-AUTO-01
   (면적으로 닫고 겹침 순서를 안 봤다 · auto 면 라벨 자리의 맨 위가 조각에서 라벨로 뒤집혀 J2·J5·X1 빨강 · 바닥 사본 초록). */
test('T5b 조각 안 라벨 상자가 클릭을 받는다(.grb-pie-tag auto) — 판정 대기',
  { todo: 'T5-CSS-AUTO-SUPERSEDED-BY-DBLCLICK-HITTEST — 지디 판정 261022 — auto 를 주면 J2·J5·X1 이 빨강이 된다(실측)' }, () => {
  const css = rd('css/editor-graph.css');
  assert.match(css, /\.grb-pie-tag\s*\{[^}]*pointer-events:\s*auto/,
    '⛔조각 안 라벨 상자가 클릭을 안 받는다(.grb-pie-tag 에 pointer-events:auto 없음)');
});
