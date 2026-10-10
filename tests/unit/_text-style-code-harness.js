/* _text-style-code-harness — ★ESM `.js` 를 ★node 검사에 ★싣는 자.
 * ★왜 필요한가 = `package.json type = commonjs` 라 ★node 는 `js/props/*.js` 의 `export` 를 ★못 읽는다.
 * ★선례 = `_text-template-harness.js` 의 `stripEsm` — ★그 꼴을 ★그대로 쓴다(⛔제 벌을 만들지 않는다).
 * ⛔`js/` 에 ★`.mjs` 를 ★처음 들이지 ★않는다 — ★이 레포는 `js/` 안 `.mjs` 가 ★0건이다(실측).
 */
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { readSrc } = require('./_srcread.js');
const ROOT = path.join(__dirname, '../..');
const REL = 'js/props/text-style-code.js';

/** ESM 문법만 벗긴다(import 줄 · export 키워드). 본문은 그대로. */
function stripEsm(src, what) {
  const body = src
    .replace(/^import[^\n]*\n/gm, '')
    .replace(/^export\s+/gm, '')
    .replace(/^export\s*\{[\s\S]*?\};\s*$/gm, '');
  assert.ok(!/^\s*export\s/m.test(body), `${what}: export 를 다 못 벗겼다 — 하네스를 고쳐라`);
  assert.ok(!/^\s*import\s/m.test(body), `${what}: import 가 남았다 — ★이 모듈은 import 0 이어야 한다`);
  return body;
}

function loadTextStyleCode() {
  const body = stripEsm(readSrc(ROOT, REL), REL);
  const names = ['TS_CODE_PREFIX', 'TS_CODE_VERSION', 'TS_CODE_V1_KINDS', 'tsEsc', 'tsUnesc',
    'tsChecksum', 'tsShape', 'tsEncode', 'tsEncodeOne', 'tsDecode', 'tsSliceOne'];
  // eslint-disable-next-line no-new-func
  const fn = new Function(`${body}\n;return {${names.join(',')}};`);
  const mod = fn();
  for (const n of names) {
    assert.ok(mod[n] !== undefined, `${REL}: ★${n} 를 못 꺼냈다 — ★이름이 바뀌었으면 ★하네스도 고쳐라`);
  }
  return mod;
}

/** ★명부를 ★소스에서 뜬다 — ⛔손으로 적지 않는다. `text-style-kinds.js` 는 ★import 가 있어 못 싣는다
 *   ⇒ ★`vars:` 줄만 ★정규식으로 긁는다. ★그 정규식이 ★0건을 내면 ★전제가 깨졌다고 ★단언한다. */
function loadRoster() {
  const src = readSrc(ROOT, 'js/props/text-style-kinds.js');
  const blk = src.slice(src.indexOf('TEXT_STYLE_KINDS = ['));
  const cut = blk.slice(0, blk.indexOf('\n];'));
  const out = [];
  const re = /k:\s*'(\w+)'[\s\S]*?vars:\s*\[([^\]]*)\]/g;
  let m;
  while ((m = re.exec(cut))) {
    out.push({ k: m[1], vars: m[2].split(',').map((x) => x.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean) });
  }
  assert.ok(out.length >= 3, `★명부를 ${out.length}종만 긁었다 — ★정규식이 썩었다(전제가 깨졌다)`);
  return out;
}

module.exports = { loadTextStyleCode, loadRoster, ROOT, REL };
