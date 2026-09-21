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
    /* ★annotation 은 «레이어 패널에 행 자체가 없다» — 펜 오버레이 하위체계라 자기 선택 경로를 쓴다.
       근거(2026-09-21 실측): js/annotation-tool.js 는 `sec.appendChild(block)` 로 «섹션 직속»에
       붙이는데, 레이어 패널은 `sec.querySelector('.section-inner')` 의 row 자식만 훑는다
       (js/panels/layer-panel.js appendRowToLayer). js/editor.js 의 CANVAS_SEL_BLOCKS 에도 없다.
       ⇒ 여기서 요구하면 «있을 수 없는 행»을 요구하는 게 된다. 대신 U-DISPATCH-3 가 이 타입이
         정본 표에 «있는지»를 재고, 캔버스 경로는 js/annotation-select.js 가 맡는다. */
    if (cls === 'annotation-block') continue;
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

/* ────────────────────────────────────────────────────────────────────────────
 * U-DISPATCH — 「패널 함수는 «멀쩡한데» 정본 표에서만 빠진」 경우를 잡는다.
 *
 * ★왜 이 축이 따로 필요한가 (ULFIX 0920b 추가지시 · panel-dict 가 짚음)
 *   위 U-LAYERPANEL 은 «정본 표 ↔ 레이어 분기»만 본다(둘 다 표를 베낀 사본끼리의 대조).
 *   팀리드의 패널사전 검사(~/.claude/skills/지디/tools/panel-dict)는 «prop-*.js 안의
 *   절·컨트롤»만 본다(패널 «내용»이 낡았는가).
 *   ⇒ 「패널 파일은 온전하고, 레이어 분기도 온전한데, 정본 표에만 그 타입이 없는」 상태는
 *     ★양쪽 검사가 «다 초록»인 채로 샌다. 2026-09-21 T-079(배너)가 정확히 그 꼴이었다.
 *     배너는 prop-banner02.js 도 멀쩡했고 레이어 분기에도 있었다. 표에만 없었다.
 *
 * ★그래서 여기서는 «앱에 실재하는 패널 함수 전수» ↔ «정본 표» 를 diff 하고,
 *   차이는 «의도적 제외 화이트리스트»에 사유와 함께 적혀 있어야만 통과시킨다.
 *   화이트리스트에 없는 차이가 하나라도 나오면 빨강 = 「일부러 없는 것」과
 *   「실수로 빠진 것」이 기계로 갈린다.
 *
 * ★전수의 출처를 «라이브 스캔»으로 둔 이유
 *   ULFIX 는 panel-dict.json 의 discovered(38개)를 쓰라고 했다. 그 파일은 기준 커밋이
 *   dev 20e50e3 이라 «이 브랜치보다 낡을 수 있다» — 새 패널이 생긴 날 검사가 조용히
 *   못 보게 된다(감시가 자기 스냅샷으로 자길 재는 꼴). 그래서 1차 출처는 js/props/prop-*.js
 *   «지금» 소스로 두고, panel-dict.json 은 «있으면» 교차대조만 한다(U-DISPATCH-5).
 *   실측(2026-09-21 fix/ul-bannersave): 라이브 스캔 38개 = panel-dict discovered 38개, 완전일치.
 * ──────────────────────────────────────────────────────────────────────────── */

/** 앱에 «실재하는» 패널 함수 전수 = js/props/prop-*.js 가 window 에 노출하는 show… 들.
 *  (panel-dict 추출기와 «같은 범위»를 본다 — 그 디렉터리 밖으로 옮기면 여기서도 사라진다.
 *   그 경우 U-DISPATCH-4 가 「표가 부르는데 정의가 없다」로 잡는다.) */
function livePanelFns() {
  const dir = path.join(ROOT, 'js', 'props');
  const out = new Set();
  for (const f of fs.readdirSync(dir)) {
    if (!/^prop-.*\.js$/.test(f)) continue;
    const src = stripComments(fs.readFileSync(path.join(dir, f), 'utf8'));
    for (const m of src.matchAll(/^window\.(show[A-Za-z0-9]+)\s*=/gm)) out.add(m[1]);
  }
  assert.ok(out.size >= 35, `★패널 함수 스캔이 ${out.size}개뿐이다 — 추출이 낡았다(노출 방식이 바뀌었나)`);
  return out;
}

/** 정본 표(+전용 진입점 특례)가 «실제로 여는» 패널 함수 전수. */
function dispatchedPanelFns() {
  const i = DISPATCH.indexOf('const _PANEL_BY_CLASS');
  const body = DISPATCH.slice(i, DISPATCH.indexOf('];', i));
  const out = new Set([...body.matchAll(/window\.(show[A-Za-z0-9]+)/g)].map(m => m[1]));
  /* 전용 진입점 특례 — 표가 아니라 openPanelForBlock 머리에서 처리한다.
     그 진입점이 결국 어떤 패널을 여는지는 여기서 «사람이» 적지 않고 소스에서 확인한다. */
  const head = DISPATCH.slice(DISPATCH.indexOf('function openPanelForBlock'));
  for (const [entry, fn] of [['_selectGradient', 'showGradientProperties'], ['_selectSticker', 'showStickerProperties']]) {
    if (head.includes(entry)) out.add(fn);
  }
  return out;
}

/** ★의도적으로 정본 표에 «없는» 패널들 — 사유를 각각 적는다.
 *  (사유를 안 적으면 다음 사람이 「빠진 건지 일부러인지」를 또 처음부터 판정하게 된다.) */
const DISPATCH_WHITELIST = {
  showPageProperties:          '문서(페이지) 전체 패널. 선택이 «없을 때» 뜨는 기본 화면이라 «블럭→패널» 표의 축이 아니다.',
  showSectionProperties:       '.section-block 은 컨테이너다. getBlockById 가 dataset.type 을 요구해 selectBlock 이 애초에 안 받는다.',
  showRowProperties:           '.row 는 컨테이너다. 위와 같은 이유.',
  showFrameProperties:         '.frame-block(서브섹션)도 컨테이너다. js/ 전수에서 frame-block 에 dataset.type 을 붙이는 자리가 0건 ⇒ getBlockById 가 막는다. 클릭 경로는 js/block-drag.js 가 직접 연다.',
  showModalIconProperties:     'modal-block «안의 아이콘»을 고른 하위 선택 패널이다. 블럭 단위가 아니라 블럭 «내부» 선택이라 표의 축이 아니다.',
  showFlowMultiSelPanel:       '여러 블럭을 «동시에» 고른 상태의 패널. 단일 블럭 표의 축이 아니다.',
  showFreeLayoutMultiSelPanel: '위와 같음(자유배치 프레임 안의 다중선택).',
  showDuoProperties:           'js/props/prop-grid.js 의 showGridProperties «별칭»이다(별도 패널이 아니다). duo 는 로드 때 grid 로 승격된다(js/io/save-load.js) ⇒ grid-block 항목이 이미 덮는다.',
};

test('U-DISPATCH-3 ★앱의 패널 함수 전수 ↔ 정본 표 — 차이는 «사유가 적힌 화이트리스트»뿐이다', () => {
  const live = livePanelFns();
  const routed = dispatchedPanelFns();
  const orphans = [...live].filter(fn => !routed.has(fn)).sort();
  const unexplained = orphans.filter(fn => !DISPATCH_WHITELIST[fn]);
  assert.deepEqual(unexplained, [],
    '★패널 함수는 «멀쩡한데» 정본 표(js/panel-dispatch.js)에만 없는 것이 있다:\n  ' +
    unexplained.join('\n  ') +
    '\n  ⇒ 이 상태는 U-LAYERPANEL 도 patrol 사전(panel-dict)도 «둘 다 초록»인 채로 샌다(T-079 가 그 꼴).' +
    '\n  ⇒ 표에 넣든지, DISPATCH_WHITELIST 에 «사유»와 함께 적든지 둘 중 하나를 해라.');
  /* 반대 방향 — 화이트리스트가 낡는 것도 막는다(없어진 패널의 사유가 남아 있으면 지운다). */
  const stale = Object.keys(DISPATCH_WHITELIST).filter(fn => !live.has(fn) || routed.has(fn)).sort();
  assert.deepEqual(stale, [],
    '★DISPATCH_WHITELIST 가 낡았다(패널이 사라졌거나 이제 표에 «있다»):\n  ' + stale.join('\n  '));
});

test('U-DISPATCH-4 ★정본 표가 부르는 패널 함수는 «실재한다» + 앱 어디에도 «죽은 패널 호출»이 없다', () => {
  const live = livePanelFns();
  const missing = [...dispatchedPanelFns()].filter(fn => !live.has(fn)).sort();
  assert.deepEqual(missing, [],
    '★정본 표가 부르는데 js/props/prop-*.js 에 그 패널이 없다:\n  ' + missing.join('\n  ') +
    '\n  ⇒ 이름 오타이거나, 패널을 prop-*.js «밖»으로 옮겼다는 뜻이다.' +
    '\n    후자라면 팀리드 패널사전(panel-dict)의 감시 범위 밖이 된다 — 옮기지 말고 여기 남겨라.');

  /* ★앱 전체에서 «정의가 없는 패널 함수를 부르는» 자리를 센다.
     옵셔널 체이닝(`window.showX?.(el)`)은 예외도 경고도 안 낸다 ⇒ 패널이 조용히 «안» 갱신된다.
     실측(2026-09-21, 고치기 «전»): js/block-factory.js 의 showSpeechBubbleProperties 1건.
     그 자리는 MCP 로 말풍선 글을 바꾼 뒤 우측 패널을 되그리려던 호출인데 그 함수는
     이 레포 어디에도 «정의가 없다»(grep 전수 1건 = 그 호출 한 줄뿐) ⇒ 영영 no-op 이었다. */
  const defined = new Set();
  const calls = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { walk(p); continue; }
      if (!e.name.endsWith('.js')) continue;
      const src = stripComments(fs.readFileSync(p, 'utf8'));
      for (const m of src.matchAll(/window\.(show[A-Za-z0-9]*Properties)\s*=/g)) defined.add(m[1]);
      for (const m of src.matchAll(/function\s+(show[A-Za-z0-9]*Properties)\s*\(/g)) defined.add(m[1]);
      for (const m of src.matchAll(/window\.(show[A-Za-z0-9]*Properties)\s*\??\.?\(/g)) {
        calls.push([m[1], path.relative(ROOT, p)]);
      }
    }
  };
  walk(path.join(ROOT, 'js'));
  const dead = [...new Set(calls.filter(([fn]) => !defined.has(fn)).map(([fn, f]) => `${fn}  (${f})`))].sort();
  assert.deepEqual(dead, [],
    '★정의가 «없는» 패널 함수를 부르는 자리가 있다 — 옵셔널 체이닝이라 조용히 no-op 이다:\n  ' +
    dead.join('\n  ') +
    '\n  ⇒ 공용 진입점(window.openPanelForBlock)으로 보내든지, 그 패널을 실제로 만들어라.');
});

test('U-DISPATCH-5 교차대조 — 팀리드 패널사전(panel-dict.json)이 아는 패널이 라이브 스캔에 «다» 있다', () => {
  /* ULFIX 0920b 가 지정한 축. 사전은 기준 커밋이 «다른»(dev 20e50e3) 스냅샷이라
     1차 출처로 쓰지 않고 교차대조만 한다 — 사전에만 있고 여기 없으면 둘 중 하나다:
       ① 그 패널이 지워졌다(사전을 다시 뽑아야 한다)  ② prop-*.js 밖으로 나갔다(감시 밖). */
  const DICT = path.join(process.env.HOME || '', '.claude', 'skills', '지디', 'reference', 'panel-dict', 'panel-dict.json');
  if (!fs.existsSync(DICT)) {
    /* ⛔조용히 통과시키지 않는다 — 사전이 없는 기기에서는 «못 잰 축»임을 출력으로 남긴다. */
    console.warn(`[U-DISPATCH-5] ★못 쟀다 — 패널사전이 없다: ${DICT} (U-DISPATCH-3/4 는 그대로 돌았다)`);
    return;
  }
  const dict = JSON.parse(fs.readFileSync(DICT, 'utf8'));
  const base = dict?.app?.shaShort || '(미상)';
  const live = livePanelFns();
  const gone = (dict.discovered || []).map(d => d.fn).filter(fn => !live.has(fn)).sort();
  assert.deepEqual(gone, [],
    `★패널사전(기준 커밋 ${base})에는 있는데 지금 js/props/prop-*.js 에 없다:\n  ` + gone.join('\n  ') +
    '\n  ⇒ 지웠으면 사전을 다시 뽑고, 옮겼으면 «되돌려라»(prop-*.js 밖은 사전의 감시 범위 밖이다).');
});

test('U-DISPATCH-6 ★block-edit.js 를 얹는 DOM 하네스는 panel-dispatch.js 를 «먼저» 같이 얹는다', () => {
  /* ★왜 (2026-09-21 픽스 라운드, 이벨류에이터 지적 ④)
       selectBlock 의 패널 호출은 `window.openPanelForBlock?.(block)` — 옵셔널 체이닝이다.
       하네스가 panel-dispatch.js 를 안 얹으면 그 값이 undefined 라 «예외도 경고도 없이»
       패널만 안 열린다. 그런데 대부분의 검사는 다른 경로로도 패널이 열려서 «초록»이 된다
       = 거짓 그린. 지금은 네 하네스가 selectBlock 을 안 불러서 무해하지만, 그 파일에
       selectBlock 호출이 한 줄만 늘면 그날로 함정이 열린다.
     ⇒ 「오늘 안 터진다」로 두지 않고 짝을 기계로 센다. 순서까지 본다(늦게 얹으면 소용없다). */
  const domDir = path.join(ROOT, 'tests', 'dom');
  const bad = [];
  for (const f of fs.readdirSync(domDir)) {
    if (!f.endsWith('.spec.js')) continue;
    const src = fs.readFileSync(path.join(domDir, f), 'utf8');
    const be = src.indexOf('src="/js/block-edit.js"');
    if (be < 0) continue;
    const pd = src.indexOf('src="/js/panel-dispatch.js"');
    if (pd < 0) bad.push(`${f} — panel-dispatch.js 를 «안» 얹는다`);
    else if (pd > be) bad.push(`${f} — panel-dispatch.js 를 block-edit.js «뒤»에 얹는다(순서가 반대다)`);
  }
  assert.deepEqual(bad, [],
    '★selectBlock 이 패널을 «못 열고도 초록»이 되는 하네스가 있다:\n  ' + bad.join('\n  ') +
    '\n  ⇒ <script src="/js/panel-dispatch.js"></script> 를 block-edit.js 줄 «앞»에 넣어라.');
});
