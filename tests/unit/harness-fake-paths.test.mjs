/* harness-fake-paths.test.mjs — ★198 ⒢ tests/harness-fake-paths.js 를 잠근다 (S3 · 261029 · 지디 15:5x 정의)
 *   ① 자가 산다 — 합성 글자로: 제품을 가짜 경로로 싣는 꼴 셋(⑴⑵⑶)은 걸리고 · 합성(/__harness.js) · 레포 경로(/js/…)는 안 걸린다
 *   ② 래칫 — 저장소 전수가 명부(tests/unit/HARNESS_FAKE_PATHS.json)와 같다(늘면 빨강 · 줄면 빨강 «--record 로 명부를 줄여라»)
 *   ⛔명부 수를 손으로 박지 않는다 — node tests/harness-fake-paths.js --record 가 쓴다(늘어날 땐 안 씀). */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const { scanSpec, scanRepo, compare } = createRequire(import.meta.url)('../harness-fake-paths.js');
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const repo = (rel) => ['js/props/prop-page.js', 'js/overlay-float.js', 'js/io/section-serialize.js', 'js/x.js'].includes(rel);
const head = `const PROP_PAGE_JS = fs.readFileSync(path.join(REPO, 'js/props/prop-page.js'), 'utf8');
const OF = read('js/overlay-float.js');
const SER = read('js/io/section-serialize.js');
`;
const routes = `
    if (url.pathname === '/props/prop-page.js') return route.fulfill({ contentType: 'application/javascript', body: PROP_PAGE_JS });
    if (url.pathname === '/overlay-float.js') {
      return route.fulfill({ contentType: 'application/javascript', body: OF });
    }
    if (u.pathname === '/section-serialize.js') return js(SER);
    if (url.pathname === '/__harness.js') return route.fulfill({ contentType: 'application/javascript', body: 'export const a = 1;' });
`;

test('H1 ★양성 — 가짜 경로로 싣는 꼴 셋(⑴ module+src · ⑵ 인라인 절대 import · ⑶ 고전 src)이 걸린다', () => {
  const t = head + `<script type="module" src="/props/prop-page.js"></script>
<script type="module">
  import { a } from '/overlay-float.js';
</script>
<script src="/section-serialize.js"></script>` + routes;
  const r = scanSpec(t, repo);
  assert.deepEqual(r.map((x) => [x.form, x.url, x.product]), [
    ['⑴', '/props/prop-page.js', 'js/props/prop-page.js'],
    ['⑵', '/overlay-float.js', 'js/overlay-float.js'],
    ['⑶', '/section-serialize.js', 'js/io/section-serialize.js'],
  ]);
});
test('H2 음성 — 합성(/__harness.js) · 레포 경로(/js/…) · 틀 문자열은 안 센다', () => {
  const t = head + `<script type="module" src="/__harness.js"></script>
<script type="module" src="/js/x.js"></script>
<script type="module">
  import { b } from '/js/x.js';
</script>
<script type="module" src="\${BASE}/props/prop-page.js"></script>` + routes;
  assert.deepEqual(scanSpec(t, repo), []);
});
test('H3 래칫 비교 — 늘어남 · 줄어듦을 따로 센다(같은 열쇠 여러 줄은 그 수만큼)', () => {
  const row = (url) => ({ spec: 'tests/dom/a.dom.spec.js', form: '⑴', url });
  const k = (url) => `tests/dom/a.dom.spec.js ⑴ ${url}`;
  assert.deepEqual(compare([row('/a.js'), row('/a.js')], { entries: [k('/a.js')] }).grew, [`${k('/a.js')} ×1`]);
  assert.deepEqual(compare([], { entries: [k('/a.js')] }).shrank, [`${k('/a.js')} ×1`]);
  assert.deepEqual(compare([row('/a.js')], { entries: [k('/a.js')] }), { now: 1, was: 1, grew: [], shrank: [] });
});
test('H4 ★래칫 — 저장소 전수 = 명부(늘면 빨강 · 줄면 «--record 로 명부를 줄여라»)', () => {
  const roster = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests', 'unit', 'HARNESS_FAKE_PATHS.json'), 'utf8'));
  const v = compare(scanRepo(ROOT), roster);
  assert.deepEqual(v.grew, [], `★가짜 경로 줄이 늘었다 — 제품 파일은 레포 경로(/js/…)로 실어라 · ${v.grew.join(' | ')}`);
  assert.deepEqual(v.shrank, [], `가짜 경로 줄이 줄었다 — node tests/harness-fake-paths.js --record 로 명부를 줄여라 · ${v.shrank.join(' | ')}`);
});
