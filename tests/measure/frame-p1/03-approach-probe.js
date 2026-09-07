const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const pg = await b.newPage({ viewport: { width: 1600, height: 1600 } });
  await pg.goto('http://127.0.0.1:8899/tests/measure/frame-p1/harness.html', { waitUntil: 'networkidle' });
  const out = await pg.evaluate(() => {
    const R = {}; const inner = document.querySelector('.section-inner'); const sec = document.getElementById('sec_test');
    const rect = e => { const r=e.getBoundingClientRect(); return {t:+r.top.toFixed(1),b:+r.bottom.toFixed(1),l:+r.left.toFixed(1),r:+r.right.toFixed(1),w:+r.width.toFixed(1),h:+r.height.toFixed(1)}; };
    const AABB = (w,h,deg)=>{const t=deg*Math.PI/180,c=Math.abs(Math.cos(t)),s=Math.abs(Math.sin(t));return{w:w*c+h*s,h:w*s+h*c};};

    // 마진 보정 실험
    const f = window.makeFrameBlock({});
    f.style.width='796px'; f.style.height='316px'; f.style.minHeight='316px';
    f.dataset.width='796'; f.dataset.height='316';
    inner.appendChild(f);
    const base = { secH: sec.offsetHeight, innerH: inner.offsetHeight, cssText: f.style.cssText.slice(0,200) };

    f.dataset.rotateDeg='45'; f.style.transform='translate(0px,0px) rotate(45deg) scale(1,1)';
    const ab = AABB(796,316,45);
    const m = Math.ceil((ab.h - 316)/2);
    f.style.marginTop = m+'px'; f.style.marginBottom = m+'px';
    f.getBoundingClientRect();
    const secR = rect(sec), fR = rect(f);
    R.marginFix = { marginPx: m, aabbH: +ab.h.toFixed(1),
      secH_before: base.secH, secH_after: sec.offsetHeight, innerH_after: inner.offsetHeight,
      grew: sec.offsetHeight - base.secH, expectedGrow: m*2,
      spillTopPx: +(secR.t - fR.t).toFixed(1), spillBottomPx: +(fR.b - secR.b).toFixed(1),
      cssText_after: f.style.cssText,
      computedMargin: [getComputedStyle(f).marginTop, getComputedStyle(f).marginRight, getComputedStyle(f).marginBottom, getComputedStyle(f).marginLeft],
      stillCenteredH: getComputedStyle(f).marginLeft };
    // 0으로 되돌리기
    f.dataset.rotateDeg='0'; f.style.removeProperty('transform');
    f.style.removeProperty('margin-top'); f.style.removeProperty('margin-bottom');
    R.revert = { secH: sec.offsetHeight, cssText: f.style.cssText, sameAsBase: f.style.cssText===base.cssText, baseCss: base.cssText };
    f.remove();

    // 섹션에 «명시 height» 가 있을 때도 자라는가
    const f2 = window.makeFrameBlock({}); f2.style.width='796px'; f2.style.height='316px'; f2.style.minHeight='316px';
    sec.style.height = '396px';
    inner.appendChild(f2);
    const h0 = sec.offsetHeight;
    f2.style.marginTop='196px'; f2.style.marginBottom='196px';
    R.sectionExplicitHeight = { before:h0, after: sec.offsetHeight, innerOffsetH: inner.offsetHeight, innerScrollH: inner.scrollHeight };
    sec.style.removeProperty('height'); f2.remove();

    // 자식 회전 + overflow:visible 로 클립 해제되는가
    const f3 = window.makeFrameBlock({}); inner.appendChild(f3); f3.style.height='300px'; f3.style.minHeight='300px';
    const a = document.createElement('div'); a.className='asset-block';
    a.style.cssText='position:absolute;left:20px;top:20px;width:400px;height:200px;background:#ccc;transform:rotate(45deg);';
    a.dataset.rotation='45'; f3.appendChild(a);
    const beforeOv = getComputedStyle(f3).overflowY;
    // 규칙 시뮬레이션
    const st = document.createElement('style');
    st.textContent = '.frame-block:has([data-rotation]),.frame-block:has([data-rotate-deg]:not([data-rotate-deg="0"])){overflow:visible;}';
    document.head.appendChild(st);
    R.childOverflowEscape = { beforeOverflowY: beforeOv, afterOverflowY: getComputedStyle(f3).overflowY,
      childRect: rect(a), frameRect: rect(f3) };
    // 회전 0 인 프레임엔 안 걸리는지 (양성/음성 대조)
    const f4 = window.makeFrameBlock({}); inner.appendChild(f4);
    const a4 = document.createElement('div'); a4.className='asset-block';
    a4.style.cssText='position:absolute;left:0;top:0;width:100px;height:50px;'; f4.appendChild(a4);
    R.negativeControl_noRotation = getComputedStyle(f4).overflowY;
    const f5 = window.makeFrameBlock({}); inner.appendChild(f5);
    const a5 = document.createElement('div'); a5.className='vector-block'; a5.dataset.rotateDeg='0';
    a5.style.cssText='position:absolute;left:0;top:0;width:100px;height:50px;'; f5.appendChild(a5);
    R.negativeControl_rotateDegZero = getComputedStyle(f5).overflowY;
    f3.remove(); f4.remove(); f5.remove(); st.remove();
    return R;
  });
  console.log(JSON.stringify(out, null, 1));
  await b.close();
})();
