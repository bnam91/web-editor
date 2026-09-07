/* (b) 드롭 — «좁은» 블록에서 가로 중앙이 실제로 먹는지 (E2 는 폭 100% 라 0px 이 정답이라 안 갈린다) */
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const pg = await b.newPage({ viewport: { width: 1600, height: 1600 } });
  pg.on('console', m => { if (m.type()==='error') console.log('CONSOLE ERR:', m.text().slice(0,300)); });
  await pg.goto('http://127.0.0.1:8899/tests/measure/frame-textcenter/harness.html', { waitUntil: 'networkidle' });
  const out = await pg.evaluate(async () => {
    const SD = await import('/js/section-drag.js');
    const R = {}; const inner = document.querySelector('.section-inner');
    const f = window.makeFrameBlock({}); inner.appendChild(f); window.bindFrameDropZone(f);
    // 프레임 안에 «좁은» 절대배치 블록 둘 — 사용자가 임의 좌표에 둔 상태
    const mk = (id, w, l, t) => { const d = document.createElement('div'); d.className = 'asset-block'; d.id = id;
      d.style.cssText = `position:absolute;left:${l}px;top:${t}px;width:${w}px;height:80px;background:#ccc;`;
      f.appendChild(d); return d; };
    const a1 = mk('a1', 200, 11, 7), a2 = mk('a2', 400, 500, 300);
    const before = { a1: { l: a1.style.left, t: a1.style.top }, a2: { l: a2.style.left, t: a2.style.top } };
    // 섹션에서 «좁은» 블록 하나를 끌어와 드롭
    const src = document.createElement('div'); src.className = 'asset-block'; src.id = 'src';
    src.style.cssText = 'width:300px;height:60px;background:#999;'; inner.appendChild(src);
    SD.dragState.dragSrc = src;
    const ev = new Event('drop', { bubbles: true, cancelable: true }); ev.dataTransfer = { dropEffect: '' };
    f.dispatchEvent(ev);
    const ctr = e => { const r = e.getBoundingClientRect(), z = f.getBoundingClientRect();
      return +(((r.left+r.right)/2) - ((z.left+z.right)/2)).toFixed(1); };
    R.frameClientW = f.clientWidth;
    R.before = before;
    R.after = { a1: { l: a1.style.left, t: a1.style.top, w: a1.offsetWidth, ctrErr: ctr(a1) },
                a2: { l: a2.style.left, t: a2.style.top, w: a2.offsetWidth, ctrErr: ctr(a2) },
                src: { parentIsFrame: src.parentElement === f, l: src.style.left, t: src.style.top,
                       w: src.offsetWidth, ctrErr: ctr(src) } };
    R.expectedCenters = { a1: Math.round((f.clientWidth - 200)/2), a2: Math.round((f.clientWidth - 400)/2),
                          src: Math.round((f.clientWidth - 300)/2) };
    R.__err = window.__err;
    return R;
  });
  console.log(JSON.stringify(out, null, 2));
  await b.close();
})();
