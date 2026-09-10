/* test-dirs-reachable.test.js — ★「빨간데 아무도 안 본다」를 막는 자리. (2026-09-08 신설)
 *
 * ⚠️무엇이 있었나(실측): tests/dom 은 «어떤 npm script 도 부르지 않았다».
 *   · npm test        → node --test 'tests/unit/*'  ⇒ dom 미포함
 *   · npm run test:e2e → playwright.config testDir='./tests/e2e'  ⇒ dom 미포함
 *   · tests/dom/playwright.dom.config.js 라는 «전용 설정»이 있는데 그걸 부르는 자리가 0건
 *   ⇒ tests/dom/canvas-state.dom.spec.js 가 «빨간 채로» 여러 머지를 통과했다.
 *      (d9cdf97 이 canvas-state.js 스키마에 parentId·depth 를 늘리고 픽스처를 안 떴다)
 *
 * ★이 검사가 지키는 것은 «검사의 내용»이 아니라 «검사가 불리는가»다.
 *   초록이 나는 이유가 「코드가 옳아서」인지 「훑을 게 없어서」인지를 가르는 자리다.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const TESTS = path.join(ROOT, 'tests');
const IS_TEST_FILE = /\.(test|spec)\.(js|mjs)$/;

/* 검사 파일을 «담고 있는» tests/ 하위 디렉터리를 실제로 센다 — 목록을 손으로 적지 않는다.
   손으로 적으면 새 디렉터리가 생겨도 이 검사가 조용히 통과한다. */
function testBearingDirs() {
  return fs.readdirSync(TESTS, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .filter((d) => fs.readdirSync(path.join(TESTS, d.name)).some((f) => IS_TEST_FILE.test(f)))
    .map((d) => d.name);
}

function scriptBlob() {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  /* 스크립트 «명령문»만 본다. 이름(test:dom)은 근거가 못 된다 — 이름은 아무거나 붙일 수 있다. */
  return Object.values(pkg.scripts || {}).join('\n');
}

/* playwright 처럼 «설정 파일»을 경유해 도는 것도 도달로 친다 —
   설정이 그 디렉터리를 가리키고, 그 설정을 부르는 스크립트가 있으면 도달이다. */
function dirsReachedViaConfigs(blob) {
  const reached = new Set();
  for (const m of blob.matchAll(/--config[= ]([^\s'"]+)/g)) {
    const cfg = path.join(ROOT, m[1]);
    if (!fs.existsSync(cfg)) continue;
    const src = fs.readFileSync(cfg, 'utf8');
    for (const d of testBearingDirs()) {
      if (src.includes(`tests/${d}`) || src.includes(`'./${d}'`) || src.includes(`"./${d}"`)) reached.add(d);
    }
    /* testDir 이 «설정 파일 자신의 폴더»면 그 폴더가 도달 대상이다 (__dirname 관용구) */
    if (/testDir\s*:\s*__dirname/.test(src)) reached.add(path.basename(path.dirname(cfg)));
  }
  /* 루트 playwright.config 는 이름만 대도 돈다(playwright test) */
  const rootCfg = ['playwright.config.js', 'playwright.config.ts', 'playwright.config.mjs']
    .map((f) => path.join(ROOT, f)).find((p) => fs.existsSync(p));
  if (rootCfg && /\bplaywright test\b/.test(blob)) {
    const src = fs.readFileSync(rootCfg, 'utf8');
    for (const d of testBearingDirs()) if (src.includes(`tests/${d}`) || src.includes(`'./${d}'`)) reached.add(d);
  }
  return reached;
}

function reachable(dir, blob, viaCfg) {
  return blob.includes(`tests/${dir}`) || viaCfg.has(dir);
}

test('R-1 ★검사 파일을 담은 tests/ 디렉터리는 «전부» 어떤 npm script 로든 불려야 한다', () => {
  const dirs = testBearingDirs();
  /* ★양성대조 — 입력이 비면 이 검사는 «스스로» 통과한다. 먼저 살아 있음을 보인다. */
  assert.ok(dirs.length >= 3, `tests/ 하위 검사 디렉터리를 못 셌다(${dirs.length}개) — 이 검사는 아무것도 안 쟀다`);

  const blob = scriptBlob();
  const viaCfg = dirsReachedViaConfigs(blob);
  const orphan = dirs.filter((d) => !reachable(d, blob, viaCfg));

  assert.deepEqual(orphan, [],
    `★어떤 npm script 도 안 부르는 검사 디렉터리: ${orphan.join(', ')}\n` +
    `  ⇒ 그 안의 검사는 «빨개도 아무도 안 본다». package.json 에 스크립트를 만들어라.\n` +
    `  (실제로 tests/dom 이 이 상태였고, 빨간 검사 1건이 여러 머지를 통과했다)`);
});

test('R-2 ★대조가 살아 있나 — 없는 디렉터리는 «도달 못 함»으로 잡혀야 한다', () => {
  const blob = scriptBlob();
  const viaCfg = dirsReachedViaConfigs(blob);
  /* 규칙을 «아무도 안 부르는 이름»에 적용해 본다. 여기서 true 가 나오면 R-1 은 늘 초록인 가짜다. */
  assert.equal(reachable('__아무도_안_부르는_디렉터리__', blob, viaCfg), false,
    '판정 규칙이 아무 이름에나 「도달」을 준다 — R-1 은 아무것도 안 지킨다');
});

test('R-3 ★tests/dom 은 «설정 경유»로 도달한다 (이 구멍이 다시 열리면 여기서 먼저 운다)', () => {
  const blob = scriptBlob();
  assert.ok(/playwright\.dom\.config\.js/.test(blob),
    'tests/dom 전용 설정을 부르는 npm script 가 사라졌다 — dom 검사가 다시 «안 도는» 상태가 된다');
});
