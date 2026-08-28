const { chromium } = require('/Users/a1/web-editor/node_modules/playwright');
const fs = require('fs');
(async () => {
  const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const p = await b.newPage({ viewport: { width: 1200, height: 1100 } });
  await p.goto('file://' + __dirname + '/probe.html');

  // ★대상 코드를 editor.js «파일에서» 뽑아 넣는다 — 재구현하지 않는다
  const src = fs.readFileSync('/Users/a1/web-editor-merge/js/editor.js', 'utf8');
  const tail = src.match(/const CANVAS_TAIL_BASE[\s\S]*?\nwindow\.syncCanvasTailSpace = syncCanvasTailSpace;/);
  const scroll = src.match(/if \(scrollIntoView\) \{[\s\S]*?\n  \}/);
  if (!tail)   { console.error('✖ syncCanvasTailSpace 추출 실패 — 추출기를 고쳐라'); process.exit(1); }
  if (!scroll) { console.error('✖ 스크롤 블록 추출 실패 — 추출기를 고쳐라'); process.exit(1); }
  await p.evaluate(tail[0]);
  await p.evaluate(`window.scrollToSec = (sec) => { const scrollIntoView = true; ${scroll[0].replace(/^if \(scrollIntoView\) \{/, '').replace(/\n  \}$/, '')} };`);

  const settle = () => p.evaluate(() => new Promise(res => {
    const w = document.getElementById('canvas-wrap');
    let last = -1, same = 0;
    const t = setInterval(() => {
      const c = Math.round(w.scrollTop);
      if (c === last) { if (++same >= 3) { clearInterval(t); res(); } } else { same = 0; last = c; }
    }, 60);
  }));

  const rows = [];
  for (const z of [0.15, 0.25, 0.4, 0.55, 0.7, 1.0]) {
    await p.evaluate(z => { applyZoomTest(z); window.syncCanvasTailSpace(); }, z);
    await p.waitForTimeout(120);
    for (const [label, idx] of [['첫', 0], ['작은', 0], ['큰', 7], ['★끝', 19]]) {
      const r = await p.evaluate(async (i) => {
        const w = document.getElementById('canvas-wrap');
        const secs = [...document.querySelectorAll('.section-block')];
        window.scrollToSec(secs[i]);
        return null;
      }, idx);
      await settle();
      const m = await p.evaluate((i) => {
        const w = document.getElementById('canvas-wrap');
        const s = [...document.querySelectorAll('.section-block')][i];
        const wr = w.getBoundingClientRect(), sr = s.getBoundingClientRect();
        return { 위여유: Math.round(sr.top - wr.top), 높이: Math.round(sr.height),
                 꼬리여백: w.style.paddingBottom };
      }, idx);
      rows.push({ 배율: (z*100)+'%', 경우: label, ...m });
    }
  }
  let bad = 0;
  console.log(`${'배율'.padEnd(7)}${'경우'.padEnd(6)}${'높이'.padStart(7)}${'위여유'.padStart(8)}${'꼬리여백'.padStart(10)}  판정`);
  for (const r of rows) {
    const ok = r.위여유 >= -2 && r.위여유 <= 42; if (!ok) bad++;
    console.log(`${r.배율.padEnd(7)}${r.경우.padEnd(6)}${String(r.높이).padStart(7)}${String(r.위여유).padStart(8)}${String(r.꼬리여백).padStart(10)}  ${ok?'✅':'★어긋남'}`);
  }
  console.log(bad === 0 ? '\n✔ 모든 배율·모든 위치에서 위 여유 40px' : `\n✖ 어긋남 ${bad}건`);
  await b.close(); process.exit(bad===0?0:1);
})();
