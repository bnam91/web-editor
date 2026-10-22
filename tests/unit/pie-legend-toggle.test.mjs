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
import { createRequire } from 'node:module';

const ROOT = process.env.GD1001_ROOT || path.join(import.meta.dirname, '..', '..');
const rd = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
/* ★주석 걷어내기는 ★★«공용 부품»을 쓴다 — `tests/unit/_strip-comments.js`
 *   ⛔여기서 ★자기 벌을 ★만들면 ★안 된다 — ★`strip-comments-shared.test.js` 의 ★★`S-6` 가 ★막는다.
 *   ★★261022: ★★이 파일은 ★처음에 ★자기 벌을 ★만들었고 ★★그래서 ★★dev 가 ★★빨강이었다(★rc 1).
 *     ★★★내가 ★그 빨강을 ★★하루 종일 ★몰랐다 — ★★관련 검사만 ★돌리고 ★★전수를 ★★안 돌렸다.
 *     ⇒ ★★★`S-6` 의 ★허용목록에 ★★더하지 ★않았다. ★★그 명부는 ★★«오늘의 ★빚»이라 ★적혀 있다. */
const _req = createRequire(import.meta.url);
const { stripComments } = _req('./_strip-comments.js');

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
/* T5b — ★★2026-10-23 ★지디 ★뜻을 ★뒤집었다. ⛔지우지 ★않고 ★★«반대»를 ★잠근다.
   ★옛 꼴 : `assert.match(… pointer-events:auto)` ＋ `todo` — ★「★상자에 ★auto 를 ★주라」를 ★★요구했다
   ★★왜 ★뒤집었나 — ★요구가 ★★«다른 기능»으로 ★★이미 ★채워졌고, ★★★auto 는 ★★틀린 ★처방으로 ★판정됐다:
     ⒤ ★틀린 처방 : ★`HIT-TOP-FLIPPED-BY-POINTER-AUTO-01`
        (★면적으로 닫고 ★겹침 ★순서를 ★안 봤다 · ★auto 면 ★라벨 자리의 ★맨 위가 ★조각 → ★라벨로 ★뒤집혀
         ★1013t1C3 계약 ★J2·J5·X1 이 ★★3 ★빨강 · ★바닥 사본 ★3 ★초록 — ★실측)
     ⅱ) ★요구를 ★채우는 자 : ★제품 `js/drag-utils.js:819 _grbPieNameAt`(:836 에서 불린다)
        ★재는 자 ★셋 = `tests/dom/graph-label-edit.dom.spec.js`
          ★T8  조각 안 이름 ★더블클릭 → ★편집이 ★열린다 ＋ ★★그 자리 ★맨 위는 ★조각(★J5 계약을 ★한 칸에 ★같이)
          ★T9  ★숨은 이름 자리를 더블클릭해도 ★안 잡는다 · ★데이터 ★무변(★음성대조)
          ★T10 ★두 이름이 겹치면 ★«칠 순서 위쪽» — 같은 z = 문서 순서 뒤 · z 큰 쪽이 이긴다
   ★★⇒ ★그러니 ★옛 단언은 ★★«무효 항목»이었다 — ★★⛔`todo` 로 두면 ★★«고아 칸»이 되어 ★★다음 빨강을 ★가린다
      (★같은 날 ★R1 도 ★같은 자리였다 — ★둘 다 ★todo 가 ★빨강을 ★덮고 있었다)
   ★★★뒤집은 뒤 ★이 칸이 ★잠그는 것 : ★★«누가 ★auto 를 ★다시 ★주면 ★빨강» ⇒ ★J2·J5·X1 을 ★지킨다 */
test('T5b ★★조각 안 라벨 상자에 ★auto 를 ★주지 ★않는다 — ★★HIT-TOP-FLIPPED-BY-POINTER-AUTO-01 (★요구는 ★T8·T9·T10 이 채운다)', () => {
  const css = rd('css/editor-graph.css');
  const AUTO = /\.grb-pie-tag\s*\{[^}]*pointer-events:\s*auto/;
  /* ★★★반례 단언 — ⛔금지단언(`doesNotMatch`)은 ★★«자가 죽어도 ★초록»이다(261009 이스케이프 ★1글자 = ★항등식).
     ⇒ ★그 자가 ★★«실제로 ★잡는다»를 ★★★같은 자리에서 ★보인다. ⛔이 줄을 ★지우지 ★마라. */
  assert.match('.grb-pie-tag { pointer-events: auto; }', AUTO,
    '★★자가 ★죽었다 — ★그 정규식이 ★★진짜 auto 선언도 ★못 잡는다 ⇒ ★아래 ★금지단언은 ★★증거가 ★아니다');
  assert.doesNotMatch('.grb-pie-tag { pointer-events: none; }', AUTO,
    '★★음성대조 — ★그 정규식이 ★`none` 까지 ★잡는다(★너무 먹는다)');
  /* ★★본 단언 — ★제품에 ★그 선언이 ★★없어야 한다 */
  assert.doesNotMatch(css, AUTO,
    '⛔`.grb-pie-tag` 에 ★`pointer-events:auto` 가 ★생겼다 — ★★그러면 ★라벨 자리의 ★맨 위가 ★조각에서 ★라벨로 ★뒤집혀\n'
    + '   ★1013t1C3 계약 ★J2·J5·X1 이 ★빨강이 된다(★HIT-TOP-FLIPPED-BY-POINTER-AUTO-01 · 실측).\n'
    + '   ★요구(조각 안 이름을 눌러 고친다)는 ★★«dblclick 사각형 판정»이 ★이미 채운다 —\n'
    + '   ★제품 js/drag-utils.js:819 `_grbPieNameAt` · ★재는 자 tests/dom/graph-label-edit.dom.spec.js T8·T9·T10');
});
