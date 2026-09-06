#!/usr/bin/env node
/* 갓 띄운 인스턴스를 «에디터 화면»까지 데려간다.
 * 격리 user-data-dir 은 상태가 비어 있어서 기동 직후 화면이 셋 중 하나다:
 *   pages/license.html  — 라이선스 게이트. 개발 빌드는 'admin' 인자로 통과(launch-goditor.mjs 가 붙인다).
 *                          여기 걸렸으면 계측 불가 → 사람이 판단할 일이므로 그냥 실패시킨다.
 *   pages/projects.html — 프로젝트 목록. 계측용 «빈 프로젝트»를 하나 만든다.
 *   index.html?project= — 이미 에디터. 그대로 통과.
 * 사용: node tools/perf/open-editor.mjs --port=9390 */
import { connect, sleep } from './cdp-lite.mjs';
const A = Object.fromEntries(process.argv.slice(2).map(s => { const m = /^--([^=]+)(?:=(.*))?$/.exec(s); return m ? [m[1], m[2] ?? true] : [s, true]; }));
const PORT = A.port;
if (!PORT) { console.error('usage: open-editor.mjs --port=9390'); process.exit(1); }

const url = async () => (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).filter(p => p.type === 'page').map(p => p.url);
let u = await url();
if (u.some(x => x.includes('license.html'))) {
  console.error('⛔라이선스 게이트(pages/license.html) — 격리 ud 에 auth.json 이 없다.\n' +
                '   개발 체크아웃이면 launch-goditor.mjs 가 붙이는 \'admin\' 인자로 통과한다. 패키지 빌드면 사람이 로그인해야 한다.');
  process.exit(2);
}
if (u.some(x => x.includes('projects.html'))) {
  const c = await connect(PORT, 'projects.html');
  await c.ev('window.createProject()');
  c.close();
  for (let i = 0; i < 40 && !(await url()).some(x => x.includes('index.html')); i++) await sleep(500);
  u = await url();
}
if (!u.some(x => x.includes('index.html'))) { console.error('⛔에디터로 못 갔다: ' + JSON.stringify(u)); process.exit(3); }
const c = await connect(PORT, 'index.html');
for (let i = 0; i < 40; i++) { if (await c.ev("!!document.getElementById('canvas-wrap')")) break; await sleep(500); }
const env = await c.ev("({url:location.href, canvas:!!document.getElementById('canvas-wrap'), sections:document.querySelectorAll('#canvas .section-block').length, zoom:window.currentZoom})");
c.close();
console.log(JSON.stringify(env, null, 1));
process.exit(env.canvas ? 0 : 4);
