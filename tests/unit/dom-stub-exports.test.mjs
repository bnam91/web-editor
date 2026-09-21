/* dom-stub-exports — 화면 검사가 «가짜로 끼우는» 모듈이 실물을 따라가는가.
 *
 * ★왜 있나 (2026-09-21)
 *   `tests/dom/number-field-contract.dom.spec.js` 40건이 «통째로» 30초 타임아웃이었다.
 *   까닭: 그 하네스가 `/js/props/color-picker.js` 를 스텁으로 갈아끼우는데,
 *   2026-09-21(커밋 499cbc3)이 실물에 `wireHexText`·`parseHex6`·`formatHex6` 를 새로 만들고
 *   `js/props/prop-page.js:6` 이 그것을 import 하기 시작했다. **스텁이 안 따라갔다.**
 *   ⇒ 모듈 그래프가 통째로 안 뜨고 `window.__ready` 가 영영 안 켜진다.
 *   ★그 스펙 머리주석이 「404 로 막으면 … __ready 가 영영 안 켜진다」로 **이미 경고**해 뒀는데,
 *     경고는 있고 «막는 것»이 없었다. 이 검사가 그 자리를 막는다.
 *
 * ⛔스텁을 실물에서 «생성»하지 않는다 — 생성하면 증인이 둘에서 하나로 준다.
 *   대조만 한다: **하네스가 실제로 쓰는 이름 ⊆ 스텁이 내보내는 이름**.
 *
 * ⚠️이 검사는 소스 문자열을 본다. 스텁 꼴이 바뀌면 빨강이 날 수 있다 — 그때는 지우지 말고
 *   「하네스가 요구하는 이름이 스텁에 다 있는가」를 확인한 뒤 패턴을 고쳐라.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { readSrc } = require('./_srcread.js');
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '../../');

const SPEC = 'tests/dom/number-field-contract.dom.spec.js';
const SRC = readSrc(REPO, SPEC);

/** 스텁 상수 본문에서 export 이름을 긁는다. */
function stubExports(constName) {
  const i = SRC.indexOf(`${constName} =`);
  assert.ok(i > 0, `${constName} 를 못 찾았다 — 이름이 바뀌었으면 이 검사부터 고쳐라`);
  const start = SRC.indexOf('`', i);
  const end = SRC.indexOf('`;', start + 1);
  assert.ok(end > start, `${constName} 의 템플릿 리터럴 끝을 못 찾았다`);
  const body = SRC.slice(start, end);
  return new Set([...body.matchAll(/export\s+(?:function|const)\s+([A-Za-z0-9_$]+)/g)].map(m => m[1]));
}

/** 하네스가 «실제로 싣는» 모듈들이 그 스텁에서 가져오는 이름을 모은다. */
function requiredFrom(moduleFile, importPathFragment) {
  const src = readSrc(REPO, moduleFile);
  const re = new RegExp(`import\\s*\\{([^}]*)\\}\\s*from\\s*['"][^'"]*${importPathFragment}['"]`, 'g');
  const out = new Set();
  for (const m of src.matchAll(re)) {
    for (const raw of m[1].split(',')) {
      const n = raw.trim().split(/\s+as\s+/)[0].trim();
      if (n) out.add(n);
    }
  }
  return out;
}

/** 하네스 head 에서 import 하는 모듈 목록(= 실제로 싣는 것). */
function harnessModules() {
  const i = SRC.indexOf("script type=\"module\"");
  assert.ok(i > 0, '하네스의 module 스크립트를 못 찾았다');
  const seg = SRC.slice(i, i + 900);
  return [...seg.matchAll(/import\s+'\/(js\/[^']+)'/g)].map(m => m[1]);
}

test('U-STUB-1 ★color-picker 스텁이 «하네스가 싣는 모듈들이 요구하는 이름»을 다 내보낸다', () => {
  const have = stubExports('COLOR_PICKER_STUB');
  const mods = harnessModules();
  assert.ok(mods.length >= 3, `하네스가 싣는 모듈이 너무 적게 잡혔다: ${mods.length}개 — 긁는 정규식을 의심하라`);

  const missing = [];
  for (const m of mods) {
    for (const need of requiredFrom(m, 'color-picker\\.js')) {
      if (!have.has(need)) missing.push(`${m} → ${need}`);
    }
  }
  assert.deepEqual(missing, [],
    '★스텁에 없는 이름을 하네스 모듈이 import 한다 — 모듈 그래프가 통째로 안 뜨고 ' +
    'window.__ready 가 영영 안 켜져 그 스펙이 «전건 30초 타임아웃»이 된다. 스텁에 그 이름을 더해라');
});

test('U-STUB-2 ★그 셋(wireHexText·parseHex6·formatHex6)은 «실물에도» 있다 — 검사가 헛돌지 않는다', () => {
  /* 이게 없으면 U-STUB-1 은 「아무도 안 쓰는 스텁」을 지키는 빈 검사가 될 수 있다. */
  const real = readSrc(REPO, 'js/props/color-picker.js');
  for (const n of ['wireHexText', 'parseHex6', 'formatHex6']) {
    assert.match(real, new RegExp(`export\\s+(?:function|const)\\s+${n}\\b`),
      `실물 color-picker.js 에 ${n} 이 없다 — 그러면 이 검사의 전제를 다시 보라`);
  }
  assert.match(readSrc(REPO, 'js/props/prop-page.js'), /from '\.\/color-picker\.js'/,
    'prop-page.js 가 color-picker 를 더는 안 쓴다 — 그러면 이 검사의 전제를 다시 보라');
});
