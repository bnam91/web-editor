/* U6 — 「캔버스를 클론하는 문」의 명부가 «실물과 맞는가». (2026-09-08 · 2026-09-09 분모 확대)
 *
 * ★이 검사가 막는 것
 *   편집 전용 마커를 벗기는 자리가 흩어져 있어, 「N자리 다 지웠나」로 세면
 *   «N+1번째 문이 생기는 날» 조용히 통과한다. ⇒ 자리를 세지 말고 «문의 명부»를 센다.
 *
 * ★★분모를 기계가 정한다
 *   처음엔 glob 이 js/io/export-* 였고, 그래서 js/panels/template-system.js 가
 *   «구조적으로 안 보였다» — 그 파일은 실제로 마커를 안 벗기고 있었다(2026-09-09 적대 검수).
 *   ⇒ 분모를 «js/ 전역에서 cloneNode(true) 를 쓰는 파일 전수»로 넓혔다.
 *     ⛔손으로 적은 명부는 다음 문을 못 본다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const _req = createRequire(import.meta.url);
const { readSrc, toPosix } = _req('./_srcread.js');
const { CHANNELS, MARKER_TOKENS, CLEAN_FN } = _req('../_export-channels.js');

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const JSDIR = path.join(ROOT, 'js');

/** 실물 — js/ 아래에서 «DOM 을 통째로 클론하는» 파일 전수. ⛔손으로 적지 않는다. */
function globCloneFiles() {
  const out = [];
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) { if (e.name !== 'node_modules') walk(full); continue; }
      if (!e.name.endsWith('.js')) continue;
      if (fs.readFileSync(full, 'utf8').includes('cloneNode(true)')) {
        out.push(toPosix(path.relative(ROOT, full)));
      }
    }
  })(JSDIR);
  return out.sort();
}

test('U6-0 ★양성대조 — glob 이 실제로 파일을 찾는다 (0건이 «못 잰 것»이 아니다)', () => {
  const found = globCloneFiles();
  assert.ok(found.length >= 10, `js/ 에서 ${found.length}건만 찾았다 — glob 이 죽었다:\n${found.join('\n')}`);
  for (const must of ['js/io/export-image.js', 'js/panels/template-system.js']) {
    assert.ok(found.includes(must), `${must} 를 못 찾는다 — 잣대가 낡았다`);
  }
  assert.ok(CHANNELS.length > 0, '명부가 비었다');
});

test('U6 ★명부 밖 파일이 «0건» — 새로 클론하는 문이 조용히 생기지 않는다', () => {
  const listed = new Set(CHANNELS.map(c => c.file));
  const missing = globCloneFiles().filter(f => !listed.has(f));
  assert.deepEqual(missing, [],
    `${missing.join(' · ')} 가 cloneNode(true) 를 새로 쓴다 — tests/_export-channels.js 명부에 추가해라.\n` +
    `  그 클론이 «저장·배송되는 산출물»이 되면 kind:'artifact' 로 적고 마커 스트립을 붙여라 ` +
    `(window.${CLEAN_FN}?.(clone) 위임이 정답이다). 안 그러면 그 경로로 선택 마커가 «조용히» 샌다.`);
});

test('U6-b ★명부의 파일이 «전부 실재»하고 «왜»가 적혀 있다', () => {
  const KINDS = new Set(['artifact', 'compare', 'transient']);
  for (const c of CHANNELS) {
    assert.ok(fs.existsSync(path.join(ROOT, c.file)), `명부의 ${c.file} 이 없다 — 명부가 낡았다`);
    assert.ok(KINDS.has(c.kind), `${c.file} 의 kind 가 «${c.kind}» 다`);
    assert.ok(typeof c.why === 'string' && c.why.length > 15, `${c.file} 에 «왜»가 없다`);
  }
});

test('U6-c ★artifact 채널은 마커를 «전부» 벗긴다 (손 열거든 위임이든)', () => {
  const arts = CHANNELS.filter(c => c.kind === 'artifact');
  assert.ok(arts.length >= 4, `artifact 채널이 ${arts.length}건이다 — 명부가 낡았거나 잣대가 죽었다`);
  for (const c of arts) {
    const src = readSrc(ROOT, c.file);
    if (c.strips === CLEAN_FN) {
      // 위임 — 토큰을 손으로 안 적는 대신 «세척 함수를 부른다»는 것을 확인한다.
      assert.match(src, new RegExp(`${CLEAN_FN}\\s*\\?\\.\\(|${CLEAN_FN}\\s*\\(`),
        `${c.file} 이 ${CLEAN_FN} 을 «부르지» 않는다 — 위임한다고 적어 놓고 안 부르면 아무것도 안 벗긴다.\n  (${c.why})`);
      continue;
    }
    for (const tok of MARKER_TOKENS) {
      assert.ok(src.includes(tok),
        `${c.file} 이 «${tok}» 을 안 벗긴다 — 그 마커가 이 경로의 결과물에 박힌다.\n  (${c.why})`);
    }
  }
});

test('U6-c-전제 ★위임 대상(serializeCleanRoot)이 실제로 그 토큰들을 벗긴다', () => {
  // 위임을 허용하려면 «위임받는 쪽»이 진짜 하는지 봐야 한다. 안 그러면 U6-c 가 자기통과한다.
  const src = readSrc(ROOT, 'js/io/section-serialize.js');
  assert.match(src, new RegExp(`function ${CLEAN_FN}`), `${CLEAN_FN} 이 거기 없다 — 위임이 허공을 가리킨다`);
  for (const tok of MARKER_TOKENS) {
    assert.ok(src.includes(tok), `★${CLEAN_FN} 이 «${tok}» 을 안 벗긴다 — 위임한 채널이 전부 새고 있다`);
  }
});

test('U6-d ★transient 라고 적은 파일이 «결과물»을 만들지 않는다', () => {
  // 「transient 라고 적어 두면 검사를 빠져나간다」를 막는 잣대.
  for (const c of CHANNELS.filter(x => x.kind === 'transient')) {
    const src = readSrc(ROOT, c.file);
    const looksLikeExport = /\.outerHTML\s*\)?\s*;?\s*$/m.test(src) && /saveTemplate|exportHTML|new Blob\(/.test(src);
    assert.equal(looksLikeExport, false,
      `${c.file} 은 transient 인데 산출물을 굳히는 모양이다 — 분류가 틀렸다.\n  (${c.why})`);
  }
});
