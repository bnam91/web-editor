#!/usr/bin/env node
/* panel-clip-probe 실행기.
 *
 * ★왜 만들었나(독립 QA 지적 ③): 프로브에 실행기가 없어 «손으로 열 때만» 돌았다.
 *   자동으로 안 돌면 회귀를 못 잡는다 — 다음 사람이 이 자리를 되돌려도 아무도 모른다.
 *
 * ★그리고 지적 ②: 프로브 주석은 「실제 소스 파일에서 뽑아온 style 로 검증한다」고 적어놓고
 *   그 파일을 읽지 않았다(fetch/import 0건). 그래서 «픽스를 되돌려도 초록»이었다.
 *   ⇒ 여기서 prop-comparison.js 를 «실제로 읽어» 인라인 style 을 뽑고, 그걸 페이지에 주입한다.
 *      주석이 약속한 일을 코드가 하게 만든다.
 *
 * 사용: node tools/panel-clip-probe/run.js
 *   잘림이 남거나 검출기 자가시험이 실패하면 exit 1.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..', '..');
const SRC = path.join(REPO, 'js', 'props', 'prop-comparison.js');
const PROBE = path.join(__dirname, 'probe.html');
const CHROME = process.env.GOYA_CHROME
  || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

/** 소스에서 «칼럼 N» 버튼의 인라인 style 을 뽑는다 — 기억이 아니라 파일을 읽는다. */
function styleFromSource() {
  const s = fs.readFileSync(SRC, 'utf8');
  // data-feat="${i}" 를 가진 버튼의 style="..." 하나를 집는다.
  // style 속성이 «아예 없는» 경우와 «비어 있는» 경우는 다르다.
  //   없다 = 마크업이 바뀌었다(추출기를 고쳐야 한다) / 비었다 = 인라인 스타일 없는 상태(측정 대상이다).
  const btn = /<button class="prop-align-btn[^`]*?data-feat="\$\{i\}"[^>]*>/.exec(s);
  if (!btn) {
    throw new Error(`[panel-clip] ${path.relative(REPO, SRC)} 에서 칼럼 버튼 자체를 못 찾았다 — 마크업이 바뀌었다.`);
  }
  const m = /style="([^"]*)"/.exec(btn[0]) || (btn[0].includes('style=') ? null : ['', '']);
  if (!m) {
    throw new Error(
      `[panel-clip] ${path.relative(REPO, SRC)} 에서 칼럼 버튼의 인라인 style 을 «못 찾았다».\n` +
      `  마크업이 바뀌었으면 이 추출기도 같이 고쳐야 한다 — 못 찾은 걸 «문제 없음»으로 넘기지 않는다.`);
  }
  return m[1];
}

(async () => {
  let chromium;
  try { chromium = require(path.join(REPO, 'node_modules', 'playwright')).chromium; }
  catch (_) {
    console.error('[panel-clip] playwright 가 없다 — 이 워크트리에서 `npm i` 를 먼저 해라.');
    process.exit(2);
  }

  const style = styleFromSource();
  console.log(`[panel-clip] 소스에서 읽은 style = "${style}"  (${path.relative(REPO, SRC)})`);

  const browser = await chromium.launch({ executablePath: CHROME });
  const page = await browser.newPage({ viewport: { width: 900, height: 800 } });
  await page.addInitScript((s) => { window.__SOURCE_STYLE = s; }, style);
  await page.goto('file://' + PROBE);
  await page.waitForFunction(() => !!window.__RESULT, null, { timeout: 15000 });
  const R = await page.evaluate(() => window.__RESULT);
  await browser.close();

  // ── 판정 ─────────────────────────────────────────────
  console.log('\n[panel-clip] env:', JSON.stringify(R.env, null, 1));

  // ★검출기 자가시험이 먼저다 — 무딘 검출기의 «초록»은 아무 뜻이 없다.
  if (R.env.selftestDetected !== true) {
    console.error('\n✖ 검출기 자가시험 실패 — 모든 초록이 무효다.');
    process.exit(1);
  }

  // 소스 style 로 실제 잘림이 있나 (본론)
  const src = R.cases.filter(c => c.variant.startsWith('SOURCE'));
  if (!src.length) {
    console.error('\n✖ SOURCE 변형이 안 돌았다 — 「파일을 잰다」가 성립하지 않는다.');
    process.exit(1);
  }
  const bad = src.filter(c => c.clipped > 0);

  // 임계값을 «숫자로» 보고한다 — 어디서부터 문제인지 사람이 알아야 한다.
  // ⚠️«칼럼 N» 자리만 센다. SELFTEST(강제 잘림·N=1)나 고정 2버튼 자리를 섞으면
  //   「N=1 부터 잘린다」 같은 무의미한 숫자가 나온다(내가 처음 그렇게 짰다).
  const colBefore = R.cases.filter(c =>
    c.site.includes('칼럼') && c.variant.startsWith('BEFORE') && c.W === 240);
  const firstClip = colBefore.filter(c => c.clipped > 0).map(c => c.n).sort((a, b) => a - b)[0];
  console.log(`[panel-clip] 240px 패널 «칼럼 N» 에서 수정 전 잘림이 시작되는 N = ${firstClip != null ? firstClip : '없음'}`);
  if (firstClip == null) {
    console.error('✖ 수정 «전»에서 잘림이 하나도 안 잡힌다 — 이 프로브는 그 버그를 재고 있지 않다(양성대조 실패).');
    process.exit(1);
  }
  console.log(`[panel-clip] 현행 소스 잘림 = ${bad.length}건 / ${src.length}케이스`);

  if (R.problems.length) {
    console.error('\n✖ 문제:');
    for (const p of R.problems) console.error('  - ' + p);
    process.exit(1);
  }
  console.log('\n✔ 문제 0건 — 현행 소스에서 잘림 없음, 검출기 자가시험 통과.');
})().catch((e) => { console.error(e && e.message || e); process.exit(1); });
