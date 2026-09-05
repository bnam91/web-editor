const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const pg = await b.newPage({ viewport: { width: 1600, height: 1600 } });
  await pg.goto('http://127.0.0.1:8899/tests/measure/frame-p1/harness.html', { waitUntil: 'networkidle' });
  const out = await pg.evaluate(async () => {
    const G = await import('/js/frame-geometry.js');
    const inner = document.querySelector('.section-inner'); const sec = document.getElementById('sec_test');
    const f = window.makeFrameBlock({});
    f.style.width='796px'; f.style.height='316px'; f.style.minHeight='316px';
    f.dataset.width='796'; f.dataset.height='316'; inner.appendChild(f);
    // export-image.js:546 이 하는 것: 섹션을 클론 → off-screen 부착 → clone.offsetHeight 로 클립
    const cloneH = () => { const c = sec.cloneNode(true); c.style.position='absolute'; c.style.top='-99999px';
      c.style.width='860px'; document.body.appendChild(c); const h=c.offsetHeight; c.remove(); return h; };
    const R = {};
    R.rot0 = { cloneOffsetHeight: cloneH(), frameAABB_h: +f.getBoundingClientRect().height.toFixed(1) };
    f.dataset.rotateDeg='45'; G.applyFrameTransform(f, {identity:'clear'});
    R.rot45_afterFix = { cloneOffsetHeight: cloneH(), frameAABB_h: +f.getBoundingClientRect().height.toFixed(1),
                         margin: f.style.marginTop };
    // 수정 «전» 을 재현: 마진만 걷어낸 상태
    f.style.removeProperty('margin-top'); f.style.removeProperty('margin-bottom');
    R.rot45_beforeFix = { cloneOffsetHeight: cloneH(), frameAABB_h: +f.getBoundingClientRect().height.toFixed(1) };
    R.verdict = { cutPx_before: +(R.rot45_beforeFix.frameAABB_h - R.rot45_beforeFix.cloneOffsetHeight).toFixed(1),
                  cutPx_after:  +(R.rot45_afterFix.frameAABB_h  - R.rot45_afterFix.cloneOffsetHeight).toFixed(1) };
    return R;
  });
  console.log(JSON.stringify(out, null, 1)); await b.close();
})();
