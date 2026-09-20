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
 *   정본 = js/history.js 의 _PANEL_BY_CLASS. 그 표는 «실제 클릭 경로»(js/block-drag.js)를 베낀
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

const HISTORY = read('js', 'history.js');
const LAYER   = read('js', 'panels', 'layer-panel-items.js');

/** 정본 표에서 «타입 클래스»를 뽑는다. */
function panelTableClasses() {
  const i = HISTORY.indexOf('const _PANEL_BY_CLASS');
  assert.ok(i > 0, '★js/history.js 의 _PANEL_BY_CLASS 를 못 찾았다 — 이름이 바뀌었으면 이 검사부터 고쳐라');
  const body = HISTORY.slice(i, HISTORY.indexOf('];', i));
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
