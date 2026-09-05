const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const pg = await b.newPage({ viewport: { width: 1600, height: 1400 } });
  await pg.goto('http://127.0.0.1:8899/tests/measure/frame-p1/harness.html', { waitUntil: 'networkidle' });
  const out = await pg.evaluate(() => {
    const R = {}; const inner = document.querySelector('.section-inner');
    const rect = e => { const r = e.getBoundingClientRect(); return {l:+r.left.toFixed(1),t:+r.top.toFixed(1),w:+r.width.toFixed(1),h:+r.height.toFixed(1),b:+r.bottom.toFixed(1),r:+r.right.toFixed(1)}; };
    const errs = (c, f) => { const cr=rect(c), fr=rect(f);
      return { h:+(((cr.l+cr.r)/2)-((fr.l+fr.r)/2)).toFixed(1), v:+(((cr.t+cr.b)/2)-((fr.t+fr.b)/2)).toFixed(1) }; };

    const scenario = (name, build, framePad) => {
      const f = window.makeFrameBlock({}); inner.appendChild(f);
      if (framePad) { f.style.padding = framePad; f.dataset.padding = parseInt(framePad); }
      const kids = build(f);
      window._activeFrame = f;
      window.__pf.showFrameProperties(f);
      document.getElementById('ss-align-hcenter')?.click();
      document.getElementById('ss-align-vcenter')?.click();
      f.getBoundingClientRect();
      R[name] = { framePad: framePad || null, frameRect: rect(f),
        clientWH: [f.clientWidth, f.clientHeight],
        kids: kids.map(k => ({ tag:k.className.split(' ')[0], left:k.style.left, top:k.style.top,
          w:k.style.width, offW:k.offsetWidth, offH:k.offsetHeight, rect:rect(k), err: errs(k, f) })) };
      f.remove();
    };

    // (a) 평범한 absolute 에셋
    scenario('A_plainAsset', f => { const a=document.createElement('div'); a.className='asset-block';
      a.style.cssText='position:absolute;left:0;top:0;width:400px;height:200px;background:#ccc;'; f.appendChild(a); return [a]; });

    // (b) 텍스트프레임 width:100%
    scenario('B_textFrame100', f => { window._activeFrame=f; window.addBlankTextBlock('body');
      return [...f.querySelectorAll(':scope > .frame-block[data-text-frame]')]; });

    // (c) 회전된 자식
    scenario('C_rotatedChild', f => { const a=document.createElement('div'); a.className='asset-block';
      a.style.cssText='position:absolute;left:0;top:0;width:400px;height:200px;background:#ccc;transform:rotate(45deg);';
      a.dataset.rotation='45'; f.appendChild(a); return [a]; });

    // (d) 패딩 있는 프레임
    scenario('D_framePadding', f => { const a=document.createElement('div'); a.className='asset-block';
      a.style.cssText='position:absolute;left:0;top:0;width:400px;height:200px;background:#ccc;'; f.appendChild(a); return [a]; }, '40px');

    // (e) 텍스트프레임 콘텐츠폭(좌측정렬) — addTextBlock 경로
    scenario('E_textFrameClamped', f => { window._activeFrame=f; window.addTextBlock('body');
      return [...f.querySelectorAll(':scope > .frame-block[data-text-frame]')]; });

    return R;
  });
  console.log(JSON.stringify(out, null, 1));
  const e = await pg.evaluate(()=>window.__err); if (e.length) console.log('ERR', e);
  await b.close();
})();
