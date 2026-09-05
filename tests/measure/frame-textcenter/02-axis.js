const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const pg = await b.newPage({ viewport: { width: 1600, height: 1600 } });
  await pg.goto('http://127.0.0.1:8899/tests/measure/frame-textcenter/harness.html', { waitUntil: 'networkidle' });
  const out = await pg.evaluate(() => {
    const inner = document.querySelector('.section-inner');
    const f = window.makeFrameBlock({}); inner.appendChild(f);
    const child = document.createElement('div');
    child.style.cssText = 'position:absolute;left:0;top:0;width:200px;height:50px;background:#ccc;';
    f.appendChild(child);
    const R = {};
    R.framePosition = getComputedStyle(f).position;
    R.canvasScalerExists = !!document.getElementById('canvas-scaler');
    R.scalerComputedBefore = getComputedStyle(document.getElementById('canvas-scaler')).transform;
    const at = (label) => ({ label,
      frame_clientWidth: f.clientWidth,
      frame_rectW: +f.getBoundingClientRect().width.toFixed(2),
      child_offsetWidth: child.offsetWidth,
      child_rectW: +child.getBoundingClientRect().width.toFixed(2) });
    R.zoom100 = at('zoom100');
    const sc = document.getElementById('canvas-scaler');
    sc.style.transition = 'none';
    sc.style.transformOrigin = 'top left';
    sc.style.transform = 'scale(0.4)';
    void sc.offsetHeight;
    R.scalerComputedAfter = getComputedStyle(sc).transform;
    R.zoom40 = at('zoom40');
    // 이 축들로 «중앙» 을 계산하면 각각 얼마가 나오는가
    R.centerLeft_by_clientWidth = Math.round((f.clientWidth - child.offsetWidth) / 2);
    R.centerLeft_by_rectWidth   = Math.round((f.getBoundingClientRect().width - child.offsetWidth) / 2);
    sc.style.transform = '';
    return R;
  });
  console.log(JSON.stringify(out, null, 2));
  await b.close();
})();
