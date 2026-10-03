/* GRW0 — _graph-gr-harness 의 기준판 공급(baseFile)이 «옛 길(요청마다 execFileSync git show)» 과 바이트 동일한가.
 *   배경: bootBase 가 255요청마다 동기 git show 를 띄워 부하 속 goto 가 30s 예산을 먹었다(GR-W0a/b 시간초과). 상주 cat-file --batch(비동기)로 바꿨다.
 *   ★«바이트 동일»을 여기서 잰다 — 빠르게 만들다 응답이 달라졌다면 GR-W0 비교 자체가 무의미해진다.
 *   ★표본: 텍스트(html·js·css), 이진(4MB png), 큰 파일, 없는 경로(옛 길은 null → 404). */
const { test, expect } = require('@playwright/test');
const path = require('path');
const { execFileSync } = require('child_process');
const { baseFile, BASE } = require('./_graph-gr-harness.js');
const REPO = path.join(__dirname, '..', '..');
const oldWay = (rel) => { try { return execFileSync('git', ['show', `${BASE}:${rel}`], { cwd: REPO, maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] }); } catch (_) { return null; } };
const SAMPLES = ['index.html', 'js/drag-utils.js', 'js/editor.js', 'css/editor-blocks.css', 'assets/textures/texture-001.png', '.design/html/fixplan-2026-06-11.html'];

test('GRW0-a 기준판 공급 baseFile ⇒ 옛 길(git show)과 바이트 동일(표본 6 + 연속 재요청)', async () => {
  for (const rel of SAMPLES) {
    const want = oldWay(rel); expect(want, `전제: ${rel} 이 기준판에 있다`).not.toBeNull();
    const got = await baseFile(rel);
    expect(got && got.length, `${rel} 길이`).toBe(want.length);
    expect(Buffer.compare(got, want), `${rel} 바이트`).toBe(0);
  }
  // 동시에 던져도(라우트가 겹쳐 부른다) 섞이지 않는다
  const rels = ['js/drag-utils.js', 'index.html', 'css/editor-blocks.css', 'js/editor.js'];
  const gots = await Promise.all(rels.map((r) => baseFile(r)));
  rels.forEach((r, i) => expect(Buffer.compare(gots[i], oldWay(r)), `동시 ${r}`).toBe(0));
});

test('GRW0-b 없는 경로·디렉터리 ⇒ null(404 길) — 옛 길과 같은 «있다/없다»', async () => {
  const miss = 'js/__no_such_file_grw0__.js';
  expect(oldWay(miss)).toBeNull();
  expect(await baseFile(miss)).toBeNull();
  expect(await baseFile('js/drag-utils.js'), '없는 경로 뒤에도 파이프가 안 어긋난다').not.toBeNull();
  expect(Buffer.compare(await baseFile('index.html'), oldWay('index.html'))).toBe(0);
});
