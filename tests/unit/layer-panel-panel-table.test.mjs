/* U-LAYERPANEL — 「좌측 LAYERS 행을 누르면 «그 타입의» 패널이 뜨는가」를 기계로 센다.
 *
 * ★왜 생겼나 (2026-09-20 최종 통합 라운드)
 *   js/panels/layer-panel-items.js 의 타입 분기는 «손으로 맞춘 목록»이고, 마지막이
 *   `else window.showAssetProperties(block)` 였다 — 갈래를 하나 빠뜨리면 «조용히 에셋 패널»이 뜬다.
 *   그리고 실제로 빠져 있었다:
 *     · gradient·sticker (0920b QA 반영에서 닫음)
 *     · ★vector·step     (이번 라운드에서 찾음 — isVector/isStep 이 «선언만» 돼 있고 이름표에만 쓰였다)
 *   더 나쁜 점은 잘못 뜬 에셋 패널의 「너비/높이」가 «실제로 먹는다»는 것이다
 *   (gradient 에서 실측: style.width 는 바뀌고 dataset.gradWidth 는 그대로 = 저장값과 화면이 갈라진다).
 *
 * ★그래서 사람이 두 목록을 맞추는 규약을 «기계»로 바꾼다.
 *   정본 = js/panel-dispatch.js 의 _PANEL_BY_CLASS. 그 표는 «실제 클릭 경로»(js/block-drag.js)를 베낀
 *   것이고 줄번호 주석까지 달려 있다(tests/unit/grad-stop-commit-wiring G9b 가 그 대조를 지킨다).
 *   여기서는 「그 표의 모든 타입이 레이어 분기에도 있는가」를 센다.
 *
 * ⛔주석 거르기는 공용 부품(tests/unit/_strip-comments.js)만 쓴다.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from './_strip-comments.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (...p) => stripComments(fs.readFileSync(path.join(ROOT, ...p), 'utf8'));

/* ★2026-09-21(T-079) 정본 표가 js/history.js 에서 js/panel-dispatch.js 로 «이사»했다.
   (같은 표의 사본이 js/block-edit.js 에도 있었고 그게 배너 글자크기 손실의 자리였다 —
    아래 U-SELECTBLOCK 참고.) 이 검사가 파싱하는 자리도 같이 옮긴다. */
const DISPATCH = read('js', 'panel-dispatch.js');
const LAYER    = read('js', 'panels', 'layer-panel-items.js');

/** 정본 표에서 «타입 클래스»를 뽑는다. */
function panelTableClasses() {
  const i = DISPATCH.indexOf('const _PANEL_BY_CLASS');
  assert.ok(i > 0, '★js/panel-dispatch.js 의 _PANEL_BY_CLASS 를 못 찾았다 — 이름이 바뀌었으면 이 검사부터 고쳐라');
  const body = DISPATCH.slice(i, DISPATCH.indexOf('];', i));
  const out = [...body.matchAll(/\['([a-z0-9-]+-block)'/g)].map(m => m[1]);
  assert.ok(out.length >= 20, `★표에서 뽑힌 타입이 ${out.length}개뿐이다 — 추출이 낡았다`);
  return out;
}

/** 레이어 분기 사슬(클릭 핸들러 안)의 코드만 떠 온다. */
function layerDispatchBody() {
  const i = LAYER.indexOf('if (isShape) window.showShapeProperties');
  assert.ok(i > 0, '★레이어 패널의 타입 분기 시작을 못 찾았다 — 이름이 바뀌었으면 이 검사부터 고쳐라');
  const j = LAYER.indexOf('window.showHandlesFor?.(block);', i);
  assert.ok(j > i, '★분기 끝(showHandlesFor)을 못 찾았다');
  return LAYER.slice(i, j);
}

/** 그 타입이 «어떤 형태로든» 레이어 경로에서 자기 진입점으로 가는가.
 *  (패널 함수 이름 또는 전용 진입점 이름이 분기 안에 있으면 통과 — 이름을 여기 또 적지 않는다.) */
const SPECIAL = {
  'gradient-block': '_selectGradient',   // 선택+핸들+패널을 자기 진입점이 한 벌로 처리
  'sticker-block':  '_selectSticker',
};

test('U-LAYERPANEL-1 ★정본 표의 «모든» 타입이 레이어 분기에도 있다 (없으면 에셋 패널로 샌다)', () => {
  const body = layerDispatchBody();
  /* 각 타입이 분기에서 쓰이는지 = 「그 클래스 이름」이 분기 안에 있거나,
     그 타입을 가리키는 is… 플래그가 분기 안에서 «쓰이는지»로 센다.
     클래스 이름을 여기 다시 나열하지 않는다 — 정본 표에서 뽑아 온다. */
  const flagOf = (cls) => {
    const m = new RegExp(`const\\s+(is[A-Za-z0-9]+)\\s*=\\s*block\\.classList\\.contains\\('${cls}'\\)`).exec(LAYER);
    return m ? m[1] : null;
  };
  const missing = [];
  for (const cls of panelTableClasses()) {
    if (cls === 'asset-block') continue;                     // 최종 갈래가 맡는다(아래 U-LAYERPANEL-2)
    if (cls === 'text-block') continue;                      // isText 로 이미 잡힌다(버블·라이너 포함)
    const f = flagOf(cls);
    const hit = (f && new RegExp(`\\b${f}\\b`).test(body)) || body.includes(`'${cls}'`);
    if (!hit) missing.push(`${cls}${f ? ` (플래그 ${f} 는 선언돼 있는데 분기에 안 쓰임)` : ' (플래그도 없음)'}`);
  }
  assert.deepEqual(missing, [],
    '★레이어 패널에서 «엉뚱한 패널»이 뜨는 타입이 있다:\n  ' + missing.join('\n  '));
});

test('U-LAYERPANEL-2 ★최종 갈래는 «에셋일 때만» 연다 (무조건 else 가 이 결함의 구조였다)', () => {
  const body = layerDispatchBody();
  assert.ok(!/\belse\s+window\.showAssetProperties\s*\(/.test(body),
    '★무조건 else 가 돌아왔다 — 갈래를 하나 빠뜨리면 남의 블럭에 «에셋 패널»이 뜨고 그 폭/높이가 먹는다');
  assert.match(body, /else if \(.*asset-block.*\)\s*window\.showAssetProperties\(block\)/,
    '★에셋 갈래가 사라졌다 — 진짜 에셋 행이 아무 패널도 못 연다');
});

test('U-LAYERPANEL-3 가드 — 두 «전용 진입점» 타입은 패널 함수가 아니라 자기 진입점으로 간다', () => {
  const body = layerDispatchBody();
  const head = LAYER.slice(LAYER.indexOf('window.deselectAll();'), LAYER.indexOf('if (isShape) window.showShapeProperties'));
  for (const [cls, fn] of Object.entries(SPECIAL)) {
    assert.ok(head.includes(fn) || body.includes(fn),
      `★${cls} 가 ${fn} 대신 패널 함수로 간다 — 전용 UI·핸들이 안 붙는다`);
  }
});

/* ────────────────────────────────────────────────────────────────────────────
 * U-SELECTBLOCK — 「js/block-edit.js 의 selectBlock 이 «자기만의 타입표»를 또 들고 있지 않은가」
 *
 * ★왜 생겼나 (2026-09-21 «사용자 관점 훑기» T-079)
 *   현빈 페르소나: 「배너 글자크기를 40 으로 바꾸고 저장했는데 다시 열면 원래 크기로 돌아가 있어요」
 *   뿌리는 배너가 아니었다. selectBlock 의 타입 분기가 «9종»뿐이고 마지막이
 *   `else window.showTextProperties(block)` 였다 ⇒ 배너를 넣은 «그 순간» 우측 패널이
 *   «Text Block» 으로 뜨고, 거기서 만진 글자크기는 .bn2-label 의 «인라인 스타일»에 찍힌다.
 *   그런데 banner02 는 dataset.lines 를 정본으로 renderBanner02 가 innerHTML 을 새로 그린다
 *   ⇒ 저장/로드(js/io/save-load.js 의 renderBanner02 호출)에서 인라인이 «통째로 폐기»된다.
 *   = 화면은 바뀌고 autosave 도 돌아서 «됐다»고 보이는데, 다시 열면 없다(조용한 데이터 손실).
 *
 * ★그래서 재는 것은 «배너»가 아니라 «표의 사본이 또 있는가»다.
 *   이 앱의 타입표 사본은 넷이었다 — block-drag(클릭, 사실상 정본) · layer-panel-items ·
 *   history(_PANEL_BY_CLASS, 정본 선언) · block-edit(낡은 9종).
 *   위 U-LAYERPANEL 이 «정본↔레이어»를 재고, 여기서 «정본↔selectBlock»을 잰다.
 *   selectBlock 은 삽입만의 입구가 아니다 — js/inspector.js 의 «점검 점프»와 MCP/PM
 *   진입점이 모두 여기로 흐른다. 블럭 쪽에서 제 패널을 직접 부르는 땜질로는 못 닫힌다.
 * ──────────────────────────────────────────────────────────────────────────── */

const BLOCK_EDIT = read('js', 'block-edit.js');

/** selectBlock 함수 본문만 떠 온다(다음 함수 선언 직전까지). */
function selectBlockBody() {
  const i = BLOCK_EDIT.indexOf('function selectBlock(');
  assert.ok(i > 0, '★js/block-edit.js 의 selectBlock 을 못 찾았다 — 이름이 바뀌었으면 이 검사부터 고쳐라');
  const j = BLOCK_EDIT.indexOf('function editTextBlock(', i);
  assert.ok(j > i, '★selectBlock 의 끝(editTextBlock 선언)을 못 찾았다');
  return BLOCK_EDIT.slice(i, j);
}

test('U-SELECTBLOCK-1 ★selectBlock 이 «자기 타입표»를 들고 있지 않다 (사본이 낡으면 조용히 남의 패널이 뜬다)', () => {
  const body = selectBlockBody();
  const hits = [...body.matchAll(/window\.(show[A-Z]\w*Properties)/g)].map(m => m[1]);
  assert.deepEqual([...new Set(hits)], [],
    '★selectBlock 안에 패널 함수를 직접 부르는 갈래가 남아 있다:\n  ' + [...new Set(hits)].join(', ') +
    '\n  ⇒ 정본 표(js/panel-dispatch.js openPanelForBlock)를 쓰고 여기 목록은 «0개»여야 한다.');
});

test('U-SELECTBLOCK-2 ★selectBlock 은 공용 진입점(openPanelForBlock)으로 간다', () => {
  assert.match(selectBlockBody(), /window\.openPanelForBlock\?\.\(/,
    '★selectBlock 이 공용 패널 진입점을 안 쓴다 — 표의 다섯 번째 사본이 생겼다는 뜻이다');
});

test('U-SELECTBLOCK-3 ★공용 진입점의 표가 «정본»이고, 거기에 banner02 가 있다 (T-079 가 닫힌 자리)', () => {
  const classes = panelTableClasses();
  assert.ok(classes.includes('banner02-block'),
    '★정본 표에서 banner02-block 이 사라졌다 — 배너 글자크기 손실(T-079)이 되살아난다');
  assert.ok(classes.length >= 26, `★정본 표가 ${classes.length}종으로 줄었다 — 이사 중에 흘렸다`);
});
