/* U-PARSE — ★`js/**` 의 ★모든 파일이 ★파싱되는가. (2026-10-22 · 지디)
 *   실행: `npm test`
 *
 * ★★왜 이 파일이 생겼나 — ★261022 에 ★내가 ★제품을 ★깼는데 ★아무것도 ★안 잡았다
 *   t4-18 을 고치며 `js/props/prop-graph.js` 의 ★템플릿 리터럴 안에 ★HTML 주석을 넣었고,
 *   그 주석 안의 ★★백틱(`` ` ``)이 ★리터럴을 ★닫아 ★`SyntaxError` 가 났다.
 *   ★그런데 ★그때 ★내 소스 꼴 게이트(pie-legend-toggle)는 ★★4/4 ★초록이었다 —
 *   ★★소스를 ★글자로 재는 자는 ★★그 파일이 ★돌아가는지를 ★안 잰다.
 *   ★그리고 ★★레포 전체에 ★「파싱되나」를 재는 자가 ★★0건이었다(내가 셌다).
 *   ★저장 훅(CLAUDE.md 의 「JS 저장 시 node --check」)은 ★편집 ★도구에 붙어서,
 *   ★★`sed`·`python` 으로 고치면 ★안 돈다. ⇒ ★그 길로 들어온 ★깨짐은 ★무엇도 못 막았다.
 *
 * ★자를 고른 까닭 (★비용을 쟀다)
 *   ⒜ 파일마다 `node --input-type=module --check` = 313 파일 ★65,627 ms  ⇒ ⛔전수(237 s)의 +28%
 *   ⒝ ★자식 ★하나 안에서 `new vm.SourceTextModule(src)` = ★★526 ms  ⇒ ★★125배 싸다. ★이걸 쓴다
 *   ★`SourceTextModule` 의 ★생성자는 ★파싱만 한다 — ★★평가(실행)는 ★안 한다(그래서 브라우저 전역이 없어도 된다).
 *   ⚠️`--experimental-vm-modules` 가 필요해서 ★자식으로 띄운다(★러너에 플래그를 못 준다).
 *
 * ⚠️★이 파일이 ★못 재는 것
 *   ★「파싱된다」 ≠ ★「맞게 돈다」. ★이 자는 ★★가장 낮은 바닥만 잡는다.
 *   ⇒ ★동작은 ★여전히 ★그 기능의 ★제 검사가 재야 한다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { createRequire } from 'module';

const require_ = createRequire(import.meta.url);
const { mkTmpRoot } = require_('./_tmproot.js');   // ⛔손으로 mkdtemp 하지 마라(tmproot-sole-owner 가드)

const ROOT = process.env.GD1001_ROOT || path.join(import.meta.dirname, '..', '..');

/** 한 자식 안에서 <dir>/**\/*.js 를 전부 파싱한다. 돌려주는 것 = 파싱 실패 목록. */
function parseAll(dir) {
  const script = `
import fs from "fs"; import path from "path"; import vm from "vm";
const walk = (d) => fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>{
  const p = path.join(d, e.name);
  return e.isDirectory() ? walk(p) : (e.name.endsWith(".js") ? [p] : []);
});
const files = walk(process.argv[1]); const bad = [];
for (const f of files) {
  try { new vm.SourceTextModule(fs.readFileSync(f, "utf8"), { identifier: f }); }
  catch (e) { bad.push({ f, m: String(e && e.message).split("\\n")[0] }); }
}
process.stdout.write(JSON.stringify({ n: files.length, bad }));
`;
  const out = execFileSync(process.execPath,
    ['--experimental-vm-modules', '--input-type=module', '--eval', script, dir],
    { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
  return JSON.parse(out);
}

test('T1 ★`js/**` 의 ★모든 .js 가 ★파싱된다', () => {
  const r = parseAll(path.join(ROOT, 'js'));
  assert.ok(r.n >= 300, `⛔파일을 ${r.n} 개만 봤다 — 자가 ★좁아졌다(261022 실측 313)`);
  assert.deepEqual(r.bad, [], '⛔파싱이 안 되는 파일: ' +
    r.bad.map(b => `${path.basename(b.f)} :: ${b.m}`).join(' · '));
});

test('T2 ★★양성대조 — ★일부러 ★깬 파일을 ★잡는가', () => {
  const root = mkTmpRoot('u-parse-');
  const js = path.join(root, 'js');
  fs.mkdirSync(js, { recursive: true });
  // ★미끼 = ★261022 에 ★내가 ★실제로 낸 꼴: ★템플릿 리터럴 안의 ★백틱이 ★리터럴을 닫는다
  fs.writeFileSync(path.join(js, 'bait.js'),
    'export const h = `<div>\n  <!-- 설명 안의 `백틱` 이 리터럴을 닫는다 -->\n</div>`;\n');
  fs.writeFileSync(path.join(js, 'fine.js'), 'export const ok = 1;\n');
  const r = parseAll(js);
  assert.equal(r.n, 2, '⛔미끼 판의 파일 수가 2가 아니다');
  assert.equal(r.bad.length, 1, '⛔자가 눈이 멀었다 — 일부러 깬 파일을 못 잡는다');
  assert.match(r.bad[0].f, /bait\.js$/, '⛔엉뚱한 파일을 잡았다(멀쩡한 쪽을 잡으면 거짓양성이다)');
});
