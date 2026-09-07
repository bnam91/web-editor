const { chromium } = require('playwright');
const U = 'http://127.0.0.1:8899/tests/measure/frame-p1/harness.html';

(async () => {
  const b = await chromium.launch();
  const pg = await b.newPage({ viewport: { width: 1600, height: 1400 } });
  await pg.goto(U, { waitUntil: 'networkidle' });

  const out = await pg.evaluate(() => {
    const R = {};
    const inner = document.querySelector('.section-inner');
    const sec   = document.getElementById('sec_test');
    const rect  = e => { const r = e.getBoundingClientRect(); return {l:+r.left.toFixed(1),t:+r.top.toFixed(1),w:+r.width.toFixed(1),h:+r.height.toFixed(1),b:+r.bottom.toFixed(1),r:+r.right.toFixed(1)}; };

    // ══ M1 : 프레임 회전 ══
    const f = window.makeFrameBlock({});          // free-layout 기본 860x520
    f.style.width='796px'; f.dataset.width='796';
    f.style.height='316px'; f.style.minHeight='316px'; f.dataset.height='316';
    inner.appendChild(f);
    const before = { innerH: inner.offsetHeight, secH: sec.offsetHeight, frameRect: rect(f),
                     offW: f.offsetWidth, offH: f.offsetHeight };
    // 실제 코드가 조립하는 transform 문자열과 동일 규약
    f.dataset.rotateDeg = '45';
    f.style.transform = 'translate(0px,0px) rotate(45deg) scale(1,1)';
    f.getBoundingClientRect();
    const after = { innerH: inner.offsetHeight, secH: sec.offsetHeight, frameRect: rect(f),
                    offW: f.offsetWidth, offH: f.offsetHeight };
    const secR = rect(sec), innerR = rect(inner);
    R.M1_frameRotate = {
      before, after, secRect: secR, innerRect: innerR,
      overflowTopPx:    +(innerR.t - after.frameRect.t).toFixed(1),
      overflowBottomPx: +(after.frameRect.b - innerR.b).toFixed(1),
      overflowLeftPx:   +(innerR.l - after.frameRect.l).toFixed(1),
      overflowRightPx:  +(after.frameRect.r - innerR.r).toFixed(1),
      cs_inner:  { overflowX: getComputedStyle(inner).overflowX, overflowY: getComputedStyle(inner).overflowY },
      cs_sec:    { overflowX: getComputedStyle(sec).overflowX,   overflowY: getComputedStyle(sec).overflowY },
      cs_frame:  { overflowX: getComputedStyle(f).overflowX,     overflowY: getComputedStyle(f).overflowY },
      // AABB 수식 검산
      aabbFormula: { w:+(Math.abs(796*Math.cos(Math.PI/4))+Math.abs(316*Math.sin(Math.PI/4))).toFixed(1),
                     h:+(Math.abs(796*Math.sin(Math.PI/4))+Math.abs(316*Math.cos(Math.PI/4))).toFixed(1) },
    };
    f.remove();

    // ══ M2 : 자유배치 프레임 안 «자식 블록» 회전 (부모가 자르는가) ══
    const f2 = window.makeFrameBlock({}); inner.appendChild(f2);
    f2.style.height='300px'; f2.style.minHeight='300px';
    const a = document.createElement('div'); a.className='asset-block';
    a.style.cssText='position:absolute;left:20px;top:20px;width:400px;height:200px;background:#ccc;';
    f2.appendChild(a);
    const aBefore = rect(a);
    a.dataset.rotation='45'; a.style.transform='rotate(45deg)';
    a.getBoundingClientRect();
    const f2R = rect(f2), aAfter = rect(a);
    R.M2_childRotate = {
      frameCS: { overflowX:getComputedStyle(f2).overflowX, overflowY:getComputedStyle(f2).overflowY },
      childBefore: aBefore, childAfter: aAfter, frameRect: f2R,
      clippedTopPx:  +(f2R.t - aAfter.t).toFixed(1),
      clippedLeftPx: +(f2R.l - aAfter.l).toFixed(1),
      clippedBottomPx:+(aAfter.b - f2R.b).toFixed(1),
      clippedRightPx:+(aAfter.r - f2R.r).toFixed(1),
      offW: a.offsetWidth, offH: a.offsetHeight,
    };
    f2.remove();

    // ══ M3 : 텍스트 삽입 기본값 (#2 중앙정렬) ══
    const f3 = window.makeFrameBlock({}); inner.appendChild(f3);   // 860x520
    window._activeFrame = f3;
    window.addTextBlock('body');
    const tf1 = f3.querySelector('.frame-block[data-text-frame]');
    const tb1 = tf1 && tf1.querySelector('.text-block');
    const ce1 = tf1 && tf1.querySelector('[class^="tb-"]');
    const f3R = rect(f3), tf1R = tf1 ? rect(tf1) : null;
    R.M3_addTextBlock = {
      tf_inline: tf1 ? { left: tf1.style.left, top: tf1.style.top, width: tf1.style.width, position: tf1.style.position, dsWidth: tf1.dataset.width } : null,
      contentAlign: ce1 ? (ce1.style.textAlign || '(none)') : null,
      computedAlign: ce1 ? getComputedStyle(ce1).textAlign : null,
      frameRect: f3R, tfRect: tf1R,
      // 「중앙」이라면 0 이어야 하는 값
      hCenterErrPx: tf1R ? +(((tf1R.l + tf1R.r)/2) - ((f3R.l + f3R.r)/2)).toFixed(1) : null,
      vCenterErrPx: tf1R ? +(((tf1R.t + tf1R.b)/2) - ((f3R.t + f3R.b)/2)).toFixed(1) : null,
      // 텍스트 글리프 자체의 중앙 오차
      glyphRect: ce1 ? rect(ce1) : null,
    };
    // 두 번째 텍스트 (스택)
    window.addTextBlock('body');
    const tfs = [...f3.querySelectorAll('.frame-block[data-text-frame]')];
    R.M3_secondText = tfs.map(t => ({ left:t.style.left, top:t.style.top, width:t.style.width, h:t.offsetHeight }));
    f3.remove();

    // ══ M4 : addBlankTextBlock ══
    const f4 = window.makeFrameBlock({}); inner.appendChild(f4);
    window._activeFrame = f4;
    window.addBlankTextBlock('body');
    const tf4 = f4.querySelector('.frame-block[data-text-frame]');
    const f4R = rect(f4), tf4R = tf4 ? rect(tf4) : null;
    R.M4_addBlank = { tf_inline: tf4 ? {left:tf4.style.left,top:tf4.style.top,width:tf4.style.width} : null,
      hCenterErrPx: tf4R ? +(((tf4R.l+tf4R.r)/2)-((f4R.l+f4R.r)/2)).toFixed(1) : null,
      vCenterErrPx: tf4R ? +(((tf4R.t+tf4R.b)/2)-((f4R.t+f4R.b)/2)).toFixed(1) : null };
    f4.remove();

    // ══ M5 : 비텍스트 블록 삽입 (_insertToFlowFrame) ══
    const f5 = window.makeFrameBlock({}); inner.appendChild(f5);
    window._activeFrame = f5;
    window.addAssetBlock && window.addAssetBlock();
    const kids5 = [...f5.children].filter(c=>!c.classList.contains('frame-resize-handle'));
    const f5R = rect(f5);
    R.M5_insertFlowFrame = kids5.map(c => { const cr = rect(c); return {
      cls: c.className, left: c.style.left, top: c.style.top, width: c.style.width,
      hCenterErrPx: +(((cr.l+cr.r)/2)-((f5R.l+f5R.r)/2)).toFixed(1),
      vCenterErrPx: +(((cr.t+cr.b)/2)-((f5R.t+f5R.b)/2)).toFixed(1) }; });
    f5.remove();

    return R;
  });

  console.log(JSON.stringify(out, null, 1));
  const errs = await pg.evaluate(() => window.__err);
  if (errs.length) console.log('ERRORS:', errs);
  await b.close();
})();
