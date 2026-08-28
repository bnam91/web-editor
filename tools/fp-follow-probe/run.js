const { chromium } = require('/Users/a1/web-editor/node_modules/playwright');
const fs = require('fs');
(async () => {
  const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const p = await b.newPage({ viewport: { width: 1554, height: 500 } });
  await p.goto('file://' + __dirname + '/probe.html');

  // ★대상 코드를 «파일에서 읽어» 넣는다 — 내 기억이 아니라 editor.js 를 잰다.
  const src = fs.readFileSync('/Users/a1/web-editor-merge/js/editor.js', 'utf8');
  const m = src.match(/\{\s*\n\s*const fp\s*=\s*document\.getElementById\('floating-panel'\);[\s\S]*?\n\}/);
  if (!m) { console.error('✖ editor.js 에서 추종 블록을 못 찾았다 — 추출기를 고쳐라'); process.exit(1); }
  await p.evaluate(m[0]);

  const snap = async (label) => p.evaluate((l) => {
    const g = id => { const r = document.getElementById(id).getBoundingClientRect(); return Math.round(r.left + r.width/2); };
    return { 라벨: l, 캔버스: g('canvas-area'), 노치: g('canvas-notch-bar'), 플로팅: g('floating-panel') };
  }, label);

  const out = [await snap('초기')];
  await p.evaluate(() => document.getElementById('panel-left').classList.add('collapsed'));
  await p.waitForTimeout(500); out.push(await snap('좌패널 접음'));
  await p.evaluate(() => document.getElementById('panel-left').classList.remove('collapsed'));
  await p.waitForTimeout(500); out.push(await snap('좌패널 폄'));

  let bad = 0;
  for (const r of out) { r.어긋남 = r.플로팅 - r.캔버스; if (Math.abs(r.어긋남) > 2) bad++; }
  console.log(JSON.stringify(out, null, 1));
  console.log(bad === 0 ? '\n✔ 모든 상태에서 플로팅이 캔버스 중앙을 따라간다' : `\n✖ 어긋난 상태 ${bad}건`);
  await b.close();
  process.exit(bad === 0 ? 0 : 1);
})();
