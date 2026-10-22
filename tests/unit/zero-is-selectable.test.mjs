/* U-ZEROSEL — ★패널에서 «0» 을 고를 수 있다고 해 놓고 ★블럭이 0 을 ★기본값으로 되살리지 않는가. (2026-10-22)
 *   실행: node --test "tests/unit/*.test.mjs" "tests/unit/*.test.js"   (= `npm test`)
 *
 * ★왜 이 파일이 있나 — ★현빈 t4-20
 *   현빈: 「컴패리전 블럭 - 모서리 라운드 ★완전히 없앨수도 있는지? (반경에서 조절하는것 같은데
 *          100% 라운드를 ★없앨 순 없어보이기도함)」
 *   참 원인 = `js/blocks/comparison-block.js` 가 값을 ★`parseInt(d.X) || <기본값>` 으로 읽었다.
 *   ★JS 에서 `0` 은 ★falsy 다 ⇒ `parseInt('0') || 20` = ★★20. 사용자가 0 을 골라도 20 이 그려진다.
 *   ⛔저장 쪽은 `?? 20` 이라 0 이 ★산다 — ★읽는 쪽만 병이었다. 그래서 「저장은 되는데 안 먹는」 꼴이다.
 *
 * ★★현빈은 `radius` ★하나만 봤다. 내가 ★분모를 세니 ★셋이었다(radius·overlap·rowGap).
 *   ⇒ ★이 파일은 ★그 ★꼴 자체를 잠근다 — 다음에 누가 `min="0"` 슬라이더를 더하고
 *     `|| 24` 로 읽으면 ★여기서 빨강이 난다.
 *
 * ★명부를 ★사람이 관리하지 않는다
 *   `prop-comparison.js` 의 `pair('cmp-x', 'cmp-x-num', 'key', lo, hi)` 가 ★다리다.
 *   패널 `min` 은 그 슬라이더의 `min="…"` 에서, 블럭 기본값은 `parseInt(d.key) || N` 에서 ★기계로 뽑는다.
 *   ⇒ 칸을 더하면 ★자동으로 대상이 된다.
 *
 * ⚠️T2 는 ★이 파일의 ★자를 ★자기가 ★잰다(양성대조). ★T1 이 초록일 때 ★「0건이 초록」인지
 *   ★「자가 눈이 멀어 초록」인지 ★구분이 안 되기 때문이다. ⛔T2 를 지우지 마라.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';

const ROOT = process.env.GD1001_ROOT || path.join(import.meta.dirname, '..', '..');
const rd = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

/** 패널 소스 + 블럭 소스에서 「min 0 인데 0 아닌 기본값으로 읽는 칸」을 뽑는다. */
function violations(propSrc, blkSrc) {
  const mins = {};
  for (const m of propSrc.matchAll(/id="(cmp-[a-z-]+?)(?:-num)?"[^>]*?min="(-?[\d.]+)"/g)) {
    if (!(m[1] in mins)) mins[m[1]] = Number(m[2]);
  }
  const defaults = {};
  for (const m of blkSrc.matchAll(/const\s+\w+\s*=\s*parseInt\(d\.(\w+)\)\s*\|\|\s*([\d.]+)/g)) {
    defaults[m[1]] = Number(m[2]);
  }
  const out = [];
  for (const m of propSrc.matchAll(/pair\('(cmp-[a-z-]+)',\s*'[^']*',\s*'(\w+)',\s*(-?[\d.]+),\s*(-?[\d.]+)\)/g)) {
    const [, sid, key] = m;
    const pmin = sid in mins ? mins[sid] : Number(m[3]);
    const dflt = defaults[key];
    if (pmin === 0 && dflt !== undefined && dflt !== 0) out.push({ sid, key, dflt });
  }
  return out;
}

test('T1 「min 0」 슬라이더를 ★0 아닌 기본값으로 읽는 칸이 없다', () => {
  const v = violations(rd('js/props/prop-comparison.js'), rd('js/blocks/comparison-block.js'));
  assert.deepEqual(v, [], '⛔0 을 고를 수 있다고 해 놓고 0 을 기본값으로 되살린다: ' +
    v.map(x => `${x.sid}(${x.key}) 0→${x.dflt}`).join(' · '));
});

test('T2 ★★양성대조 — ★이 파일의 자가 ★나쁜 꼴을 ★잡는가', () => {
  const fakeProp = `<input class="prop-slider" id="cmp-bait" min="0" max="40">\n` +
                   `  pair('cmp-bait', 'cmp-bait-num', 'baitKey', 0, 40);\n`;
  const fakeBlk  = `  const bait = parseInt(d.baitKey) || 20;\n`;
  const v = violations(fakeProp, fakeBlk);
  assert.equal(v.length, 1, '⛔자가 눈이 멀었다 — 일부러 넣은 나쁜 꼴을 못 잡는다');
  assert.equal(v[0].dflt, 20);
  // ★음성대조도 같이 — min>0 이면 잡지 말아야 한다
  const safe = violations(fakeProp.replace('min="0"', 'min="12"'), fakeBlk);
  assert.equal(safe.length, 0, '⛔min>0 인 칸을 거짓으로 잡는다');
});

test('T3 ★뿌리가 ★한 자리인가 — 0 을 지키는 수 읽기가 ★헬퍼 하나로 모였다', () => {
  const blk = rd('js/blocks/comparison-block.js');
  const KEYS = ['radius', 'overlap', 'rowGap'];
  const bad = KEYS.filter(k => new RegExp(`parseInt\\(d\\.${k}\\)\\s*\\|\\|`).test(blk));
  assert.deepEqual(bad, [], `⛔아직 \`|| 기본값\` 으로 읽는 칸: ${bad.join(' · ')}`);
  const helperDefs = blk.match(/const\s+_num\s*=/g) || [];
  assert.equal(helperDefs.length, 1, '⛔0 을 지키는 수 읽기 헬퍼 `_num` 이 ★정확히 한 자리여야 한다');
  for (const k of KEYS) {
    assert.match(blk, new RegExp(`_num\\(d\\.${k}\\s*,`), `⛔${k} 가 그 헬퍼를 안 쓴다`);
  }
});

test('T4 ★★동작 — ★제품의 `_num` ★그 줄을 ★꺼내 돌린다 (0 이 살아남나)', () => {
  // ★★제품 파일에서 ★그 한 줄을 ★떼어 와서 돌린다 — ⛔내 테스트에 ★사본을 쓰면 ★항등식이 된다.
  //   그래서 누가 `_num` 을 `parseInt(v) || dflt` 로 되돌리면 ★여기서 빨강이 난다.
  const blk = rd('js/blocks/comparison-block.js');
  const m = blk.match(/^const\s+_num\s*=\s*(.+?);[ \t]*(?:\/\/.*)?$/m);
  assert.ok(m, '⛔제품에서 `_num` 한 줄을 못 떼었다 — 꼴이 바뀌었으면 이 자를 고쳐라');
  const _num = eval(`(${m[1]})`);
  assert.equal(_num('0', 20), 0, '⛔사용자가 고른 0 이 기본값으로 되살아난다');
  assert.equal(_num(0, 20), 0);
  assert.equal(_num('', 20), 20, '⛔빈 값은 기본값이어야 한다');
  assert.equal(_num(undefined, 20), 20);
  assert.equal(_num('abc', 20), 20);
  assert.equal(_num('35', 20), 35);
});
