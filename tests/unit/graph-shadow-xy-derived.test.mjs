/* graph-shadow-xy-derived.test.mjs — 1017t1f4 그림자 x/y/blur 값·범위의 «사본 자리» 잠금 (태양 w3f 2026-10-17)
 *
 * ★왜 — js/drag-utils.js 는 홀로 서빙하는 DOM 하네스 6곳(tests/dom/_drag-utils-deps.js 가 그 자리)이 있어
 *   js/effects-shadow.js(ESM · effects-registry.js 를 끈다)를 import 하면 그 하네스들이 404 로 모듈 그래프가
 *   죽을 수 있다 — 그래서 drag-utils.js 는 FX_SHADOW_DEFAULTS/RANGES 의 x/y/blur 를 «사본»(_PIE_SH_RANGE ·
 *   _PIE_SH_DEFAULT)으로 든다. 이 검사는 그 사본이 임자(js/effects-shadow.js)와 ★지금도 같은 수인지 ★소스
 *   텍스트에서 «직접» 읽어 잰다(실제 import 는 안 한다 — effects-shadow.js 는 ESM 이고 이 레포의 .js 는
 *   package.json "type" 이 module 이 아니라서 Node 가 바로 못 읽는다. 다른 유닛도 같은 까닭으로 소스 파싱을
 *   쓴다 — tests/dom/_drag-utils-deps.js 와 같은 결).
 * ⛔이 검사가 빨강이면 ★수를 맞추는 쪽은 drag-utils.js 의 사본이다(effects-shadow.js 가 임자).
 *
 *   A1 js/effects-shadow.js FX_SHADOW_RANGES.x/y/blur · FX_SHADOW_DEFAULTS.x/y/blur 를 읽는다(전제 — 파싱이 살았다)
 *   A2 js/drag-utils.js _PIE_SH_RANGE · _PIE_SH_DEFAULT 가 ★정확히 같은 수다
 *   A3 음성대조 — 한 수를 손으로 바꿔 끼우면(문자열 치환) A2 와 같은 비교가 실제로 빨개진다
 *   B1 js/props/prop-graph.js 가 FX_SHADOW_DEFAULTS/RANGES 를 import 한다(★손으로 베낀 둘째 명부가 아니다)
 *   B2 패널의 네 라벨이 정확히 X·Y·Blur·색상이다(새 사용자 문장 0 — 「불투명도」 같은 다섯째 글자가 없다)
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

function parseShadowSrc(src) {
  const rangeM = /FX_SHADOW_RANGES\s*=\s*\{([^}]*)\}/.exec(src);
  assert.ok(rangeM, '전제: FX_SHADOW_RANGES 선언을 찾았다');
  const defM = /FX_SHADOW_DEFAULTS\s*=\s*\{([^}]*)\}/.exec(src);
  assert.ok(defM, '전제: FX_SHADOW_DEFAULTS 선언을 찾았다');
  const num = (body, key) => { const m = new RegExp(key + '\\s*:\\s*\\[\\s*(-?\\d+)\\s*,\\s*(-?\\d+)\\s*\\]').exec(body); return m ? [+m[1], +m[2]] : null; };
  const defNum = (body, key) => { const m = new RegExp(key + '\\s*:\\s*(-?\\d+)').exec(body); return m ? +m[1] : null; };
  return {
    range: { x: num(rangeM[1], 'x'), y: num(rangeM[1], 'y'), blur: num(rangeM[1], 'blur') },
    dflt: { x: defNum(defM[1], 'x'), y: defNum(defM[1], 'y'), blur: defNum(defM[1], 'blur') },
  };
}
function parseDragUtilsCopy(src) {
  const rangeM = /_PIE_SH_RANGE\s*=\s*\{([^}]*)\}/.exec(src);
  assert.ok(rangeM, '전제: _PIE_SH_RANGE 사본 선언을 찾았다');
  const defM = /_PIE_SH_DEFAULT\s*=\s*\{([^}]*)\}/.exec(src);
  assert.ok(defM, '전제: _PIE_SH_DEFAULT 사본 선언을 찾았다');
  const num = (body, key) => { const m = new RegExp(key + '\\s*:\\s*\\[\\s*(-?\\d+)\\s*,\\s*(-?\\d+)\\s*\\]').exec(body); return m ? [+m[1], +m[2]] : null; };
  const defNum = (body, key) => { const m = new RegExp(key + '\\s*:\\s*(-?\\d+)').exec(body); return m ? +m[1] : null; };
  return {
    range: { x: num(rangeM[1], 'x'), y: num(rangeM[1], 'y'), blur: num(rangeM[1], 'blur') },
    dflt: { x: defNum(defM[1], 'x'), y: defNum(defM[1], 'y'), blur: defNum(defM[1], 'blur') },
  };
}

test('A1·A2 — drag-utils.js 의 그림자 x/y/blur 사본이 effects-shadow.js 임자와 같은 수다', () => {
  const src = parseShadowSrc(read('js/effects-shadow.js'));
  const copy = parseDragUtilsCopy(read('js/drag-utils.js'));
  assert.deepEqual(copy.range, src.range, '범위(x/y/blur) 사본이 임자와 다르다');
  assert.deepEqual(copy.dflt, src.dflt, '기본값(x/y/blur) 사본이 임자와 다르다');
});

test('A3 음성대조 — 사본 수를 하나 바꿔 끼우면 위 비교가 실제로 빨개진다', () => {
  const src = parseShadowSrc(read('js/effects-shadow.js'));
  const dragSrc = read('js/drag-utils.js');
  const broken = dragSrc.replace('const _PIE_SH_DEFAULT = { x: 2, y: 2, blur: 4 };', 'const _PIE_SH_DEFAULT = { x: 999, y: 2, blur: 4 };');
  assert.notEqual(broken, dragSrc, '전제: 치환이 실제로 글자를 바꿨다');
  const copy = parseDragUtilsCopy(broken);
  assert.notDeepEqual(copy.dflt, src.dflt, '망가뜨린 사본은 임자와 달라야 한다(자가 살아 있다)');
});

test('B1 — prop-graph.js 는 FX_SHADOW_DEFAULTS/RANGES 를 effects-shadow.js 에서 import 한다(손 베낌이 아니다)', () => {
  const src = read('js/props/prop-graph.js');
  assert.match(src, /import\s*\{[^}]*FX_SHADOW_DEFAULTS[^}]*FX_SHADOW_RANGES[^}]*\}\s*from\s*['"]\.\.\/effects-shadow\.js['"]/,
    'FX_SHADOW_DEFAULTS·FX_SHADOW_RANGES 를 ../effects-shadow.js 에서 import 하지 않는다');
});

test('B2 — 패널의 그림자 x/y/blur/색상 네 라벨이 정확히 X·Y·Blur·색상이다(새 사용자 문장 0)', () => {
  const src = read('js/props/prop-graph.js');
  const sec = /function pieShadowSectionHTML[\s\S]*?\n\}/.exec(src)?.[0] || '';
  assert.ok(sec, '전제: pieShadowSectionHTML 본문을 찾았다');
  const labels = [...sec.matchAll(/<span class="prop-label">([^<]+)<\/span>/g)].map(m => m[1]);
  assert.deepEqual(labels, ['그림자', 'X', 'Y', 'Blur', '색상'], '그림자 절의 라벨 집합이 바뀌었다(불투명도 등 새 문장이 생겼는지 확인)');
});
