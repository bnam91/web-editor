/* artifact-clone-roster — ★«live-DOM 을 ★클론해 ★산출물을 만드는 자리»의 ★명부를 ★센다.
 *
 * ★★왜 — 2026-10-09: ★움직이는 파티클이 ★★«썸네일»과 ★★«HTML 내보내기»에 ★★움직인 한 프레임으로
 *   ★박혔다. ★저장 경로는 ★`serializeCleanRoot` 가 ★막고 있었는데 ★그 둘은 ★안 거쳤다.
 *   ⇒ ★처방 = `capture-safety.js` ★`restRuntimeForArtifact` ★한 겹을 ★그 둘이 ★부른다.
 *   ⇒ ★★그런데 ★★«새 소비자»가 ★생기면 ★같은 병이 ★또 난다 — ★★주석으로는 ★못 막는다.
 *     (★그 교훈: 「★명부가 둘이면 ★경고 주석으로 못 막는다 — ★파생시켜 하나로」)
 *   ⇒ ★★이 자가 ★그 명부를 ★«센다». ★새 자리가 생기면 ★여기가 ★빨개진다.
 *
 * ★★자가 ★제 글자를 세지 않게 — ★★주석을 ★떼고 ★센다(★주석은 ★소스 파싱 게이트의 ★입력이다).
 * ⛔이 파일은 ★«어느 파일이 ★클론을 뜨나»만 잰다. ★★«그 세척이 ★정말 먹나»는 ★DOM 수트 몫이다.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { readSrc } = require('./_srcread.js');
const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../');

/** ★★명부 — ★«무엇을 ★왜» 를 ★사람 말로 적는다. ★`rest` = ★세척 한 겹을 ★부르나. */
const ROSTER = {
  'js/io/save-load.js': { rest: true,
    why: '★썸네일 → _meta.json · ★사람이 「지금 이 모습」을 ★고른 적이 없다(★저절로 찍힌다)' },
  'js/io/export-html.js': { rest: true,
    why: '★HTML = ★«문서» ⇒ ★같은 입력에 ★같은 출력이어야 한다' },
  'js/io/export-image.js': { rest: false,
    why: '★PNG = ★«스냅샷» ⇒ ★«누른 순간 화면»이 ★계약이다(실측: 멈춘 판 ★0% · 도는 판 ★5.4~6.0%)' },
  'js/io/capture-safety.js': { rest: false, owner: true,
    why: '★★세척 ★한 겹의 ★«정의 자리» — ★제 함수를 ★제가 부르지는 않는다. ★거울상도 ★여기서 뜬다' },
  'js/io/section-serialize.js': { rest: false,
    why: '★저장 경로 — ★★이미 ★`serializeCleanRoot` 안에서 ★`restParticleMotion` 을 ★부른다(★그 함수의 ★임자다)\n'
       + '        ⚠️2026-10-09: ★★내 ★첫 전수가 ★이 자리를 ★빠뜨렸다 — ★이 게이트가 ★잡았다' },
  'js/io/export-figma-json.js': { rest: false,
    why: '★<defs> 조각 복제 — ★파티클 층을 ★안 탄다' },
};

/* ★★주석 걷어내기는 ★«공용 부품» 하나다 — tests/unit/_strip-comments.js
   ⛔내가 ★제 것을 지었다가 ★레포의 ★S-6 게이트에 ★잡혔다(2026-10-09).
     ★내 정규식이 ★하필 ★그 파일이 ★경고하는 ★바로 그 부서진 꼴이었다:
       `src.replace(/\/\*[\s\S]*?\*\//g, '')` — ★`image/*` 의 `/*` 를 ★주석 시작으로 읽는다.
     ⇒ ★★「선례를 베껴라」가 ★여기선 ★「★하나뿐인 것을 ★써라」였다. */
const { stripComments } = require('./_strip-comments.js');

const IO_DIR = path.join(REPO, 'js/io');
const files = fs.readdirSync(IO_DIR).filter((f) => f.endsWith('.js')).map((f) => 'js/io/' + f).sort();

test('A1 ★전제 — ★js/io 를 ★읽었고 ★주석 떼기가 ★돈다', () => {
  assert.ok(files.length > 5, `★js/io 파일이 ${files.length}개다 — ★경로가 틀렸다`);
  const probe = stripComments('/* cloneNode(true) */ var a = 1; // cloneNode(true)\nvar b = 2;');
  assert.ok(!probe.includes('cloneNode'), '★★주석 떼기가 ★안 돈다 — ★아래 수가 ★내 주석일 수 있다');
  assert.ok(probe.includes('var a') && probe.includes('var b'), '★주석 떼기가 ★코드까지 지웠다');
});

test('A2 ★★명부 ≡ ★실측 — ★새 소비자가 생기면 ★여기가 빨개진다', () => {
  const found = files.filter((f) => stripComments(readSrc(REPO, f)).includes('cloneNode(true)')).sort();
  const declared = Object.keys(ROSTER).sort();
  assert.ok(found.length > 0, '★★0건이다 — ★자가 죽었다(⛔「없다」가 아니다)');
  const missing = declared.filter((f) => !found.includes(f));
  const extra = found.filter((f) => !declared.includes(f));
  assert.deepEqual(missing, [], `★★명부에 있는데 ★소스에 ★없다: ${missing.join(', ')} — ★명부가 늙었다`);
  assert.deepEqual(extra, [],
    `★★새로 ★live-DOM 클론을 뜨는 자리가 ★생겼다: ${extra.join(', ')}\n`
    + '  ⇒ ★그 자리가 ★★«산출물»을 만드나? ★만들면 ★`restRuntimeForArtifact(clone)` 를 ★부르고\n'
    + '    ★안 만들면 ★이 명부에 ★`rest:false` ＋ ★까닭을 ★적어라. ⛔그냥 지우지 마라');
});

test('A3 ★★`rest:true` 인 자리는 ★정말 ★그 겹을 ★부른다', () => {
  const bad = [];
  for (const [f, spec] of Object.entries(ROSTER)) {
    const src = stripComments(readSrc(REPO, f));
    /* ★★«정의»와 ★«호출»을 ★가른다 — ⛔안 가르면 ★임자 파일이 ★제 이름을 ★가졌다고 ★호출로 세어진다
       (★2026-10-09 실측: ★이 자가 ★그 흠을 ★내게 ★바로 돌려줬다). */
    const body = spec.owner ? src.replace(/export function restRuntimeForArtifact[\s\S]*?\n}/, ' ') : src;
    const calls = body.includes('restRuntimeForArtifact(');
    if (spec.rest && !calls) bad.push(`${f} — ★부른다고 적혀 있는데 ★안 부른다`);
    if (!spec.rest && calls) bad.push(`${f} — ★안 부른다고 적혀 있는데 ★부른다 (${spec.why})`);
  }
  assert.deepEqual(bad, [], bad.join(' · '));
});

test('A4 ★★세척의 ★임자는 ★하나다 — ★겹이 ★`restParticleMotion` 을 ★부르고, ★소비자는 ★직접 안 부른다', () => {
  /* ⛔소비자가 ★날로 부르면 ★⒟ 가 stdDeviation 을 더하는 날 ★두 곳을 다 고쳐야 한다 */
  const layer = stripComments(readSrc(REPO, 'js/io/capture-safety.js'));
  assert.ok(/restParticleMotion\s*\)?\.?\(|restParticleMotion\s*\)\?\.\(/.test(layer) || layer.includes('restParticleMotion'),
    '★세척 한 겹이 ★restParticleMotion 을 ★안 부른다');
  for (const f of ['js/io/save-load.js', 'js/io/export-html.js', 'js/io/export-image.js']) {
    /* ⛔section-serialize.js 는 ★뺀다 — ★거기가 ★그 함수의 ★정의 자리다 */
    const src = stripComments(readSrc(REPO, f));
    assert.ok(!src.includes('restParticleMotion('),
      `★${f} 가 ★restParticleMotion 을 ★날로 부른다 — ★★한 겹(restRuntimeForArtifact)을 거쳐라`);
  }
  /* ★정의 자리는 ★하나 */
  const def = stripComments(readSrc(REPO, 'js/io/section-serialize.js'));
  assert.equal((def.match(/function restParticleMotion\s*\(/g) || []).length, 1,
    '★restParticleMotion 정의가 ★하나가 아니다');
});

test('A5 ★★세척이 ★거울상보다 ★«앞»에 온다 — ⛔주석만으로는 ★안 지켜진다', () => {
  /* ★★왜 ★순서인가 — `neutralizeBoxReflectForH2C` 가 ★`el.cloneNode(true)` 로 ★거울상을 ★또 뜬다.
     ⇒ ★세척이 ★먼저여야 ★거울이 ★★이미 ★쉬는 값을 ★베낀다.
     ★★그 덕에 ★★「반사가 ★섹션에도 걸리나」를 ★★몰라도 ★닫힌다 — ★그 답은 ★★안 쟀다(★순서로 막았다).
     ⇒ ★★그러니 ★그 순서가 ★★이 처방의 ★전제다. ★★주석이 아니라 ★이 줄이 ★지킨다. */
  const src = stripComments(readSrc(REPO, 'js/io/save-load.js'));
  const rest = src.indexOf('restRuntimeForArtifact(');
  const mirror = src.indexOf('neutralizeBoxReflectForH2C(');
  assert.ok(rest > 0, '★전제: 세척 호출이 ★없다');
  assert.ok(mirror > 0, '★전제: 거울상 호출이 ★없다 — ★이 칸의 뜻이 사라졌다(그 함수가 빠졌나)');
  assert.ok(rest < mirror,
    `★★세척(${rest})이 ★거울상(${mirror})보다 ★뒤에 있다 — ★거울이 ★움직인 값을 ★베낀다`);
});
