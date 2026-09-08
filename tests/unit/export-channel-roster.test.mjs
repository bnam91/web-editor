/* U6 — 「내보내기 문」의 명부가 «실물과 맞는가». (2026-09-08)
 *
 * ★이 검사가 막는 것
 *   편집 전용 마커를 벗기는 자리가 흩어져 있어, 「6자리 다 지웠나」로 세면
 *   «7번째 문이 생기는 날» 조용히 통과한다. ⇒ 자리를 세지 말고 «문의 명부»를 센다.
 *   명부는 tests/_export-channels.js 에 있고, tests/dom/grid-three-channels.dom.spec.js (D4)
 *   가 그 명부를 «돌려서» 결과물 0건을 잰다.
 *
 * ⛔명부를 «손으로» 적어 두고 끝내지 않는다 — 여기서 js/io 를 glob 으로 훑어 대조한다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const _req = createRequire(import.meta.url);
const { readSrc, toPosix } = _req('./_srcread.js');
const { CHANNELS, MARKER_TOKENS } = _req('../_export-channels.js');

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const IODIR = path.join(ROOT, 'js/io');

/** 실물 — js/io 아래 「내보내기·직렬화」 파일 전수. ⛔손으로 적지 않는다. */
function globChannelFiles() {
  return fs.readdirSync(IODIR)
    .filter(f => f.endsWith('.js') && (f.startsWith('export-') || f === 'section-serialize.js'))
    .map(f => toPosix(path.join('js/io', f)))
    .sort();
}

test('U6-0 ★양성대조 — glob 이 실제로 파일을 찾는다 (0건이 «못 잰 것»이 아니다)', () => {
  const found = globChannelFiles();
  assert.ok(found.length >= 5, `js/io 에서 ${found.length}건만 찾았다 — glob 이 죽었다:\n${found.join('\n')}`);
  assert.ok(found.includes('js/io/export-image.js'), 'PNG 경로를 못 찾는다 — 잣대가 낡았다');
  assert.ok(CHANNELS.length > 0, '명부가 비었다');
});

test('U6 ★명부 밖 파일이 «0건» — 새 내보내기 경로가 조용히 생기지 않는다', () => {
  const listed = new Set(CHANNELS.map(c => c.file));
  const found = globChannelFiles();
  const missing = found.filter(f => !listed.has(f));
  assert.deepEqual(missing, [],
    `${missing.join(' · ')} 가 새로 생겼다 — tests/_export-channels.js 명부에 추가해라. ` +
    `DOM 클래스를 나르는 문이면 carriesDomClasses:true 로 적고 마커 스트립을 «붙여라». ` +
    `안 그러면 그 경로로 선택 마커가 «조용히» 샌다 ` +
    `(그리고 tests/dom/grid-three-channels.dom.spec.js D4 가 그 채널을 안 돌린다).`);
});

test('U6-b ★명부의 파일이 «전부 실재»한다 (지워진 문을 계속 지키고 있지 않다)', () => {
  for (const c of CHANNELS) {
    assert.ok(fs.existsSync(path.join(ROOT, c.file)), `명부의 ${c.file} 이 없다 — 명부가 낡았다`);
    assert.ok(typeof c.why === 'string' && c.why.length > 5, `${c.file} 에 «왜»가 없다`);
  }
});

test('U6-c ★DOM 을 나르는 채널은 마커를 «전부» 벗긴다 (토큰 하나만 빠져도 빨강)', () => {
  const carriers = CHANNELS.filter(c => c.carriesDomClasses);
  assert.ok(carriers.length >= 3, `DOM 채널이 ${carriers.length}건이다 — 명부가 낡았거나 잣대가 죽었다`);
  for (const c of carriers) {
    const src = readSrc(ROOT, c.file);
    for (const tok of MARKER_TOKENS) {
      assert.ok(src.includes(tok),
        `${c.file} 이 «${tok}» 을 안 벗긴다 — 그 마커가 이 경로의 결과물에 박힌다.\n  (${c.why})`);
    }
  }
});

test('U6-d ★DOM 을 «안» 나른다고 적은 파일이 실제로 클론을 안 만진다', () => {
  // 「false 라고 적어 두면 검사를 빠져나간다」를 막는다 — 거짓 신고를 잡는 잣대.
  for (const c of CHANNELS.filter(x => !x.carriesDomClasses)) {
    const src = readSrc(ROOT, c.file);
    assert.equal(/cloneNode\s*\(\s*true\s*\)/.test(src), false,
      `${c.file} 은 carriesDomClasses:false 인데 cloneNode(true) 를 한다 — 분류가 틀렸다. ` +
      `DOM 을 나르면 마커를 벗겨야 한다.`);
  }
});
