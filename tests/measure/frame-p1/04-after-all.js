const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const pg = await b.newPage({ viewport: { width: 1600, height: 1600 } });
  pg.on('console', m => { if (m.type()==='error') console.log('CONSOLE ERR:', m.text().slice(0,200)); });
  await pg.goto('http://127.0.0.1:8899/tests/measure/frame-p1/harness.html', { waitUntil: 'networkidle' });
  const out = await pg.evaluate(async () => {
    const G = await import('/js/frame-geometry.js');
    const R = {}; const inner = document.querySelector('.section-inner'); const sec = document.getElementById('sec_test');
    const rect = e => { const r=e.getBoundingClientRect(); return {t:+r.top.toFixed(1),b:+r.bottom.toFixed(1),l:+r.left.toFixed(1),r:+r.right.toFixed(1),w:+r.width.toFixed(1),h:+r.height.toFixed(1)}; };
    const ctr = (c,f)=>{const a=rect(c),z=rect(f);return{h:+(((a.l+a.r)/2)-((z.l+z.r)/2)).toFixed(1),v:+(((a.t+a.b)/2)-((z.t+z.b)/2)).toFixed(1)};};

    // ① 프레임 45도 회전 — 섹션이 자라고 삐져나오지 않는가
    const f = window.makeFrameBlock({});
    f.style.width='796px'; f.style.height='316px'; f.style.minHeight='316px';
    f.dataset.width='796'; f.dataset.height='316';
    inner.appendChild(f);
    const h0 = sec.offsetHeight, html0 = f.outerHTML;
    f.dataset.rotateDeg='45'; G.applyFrameTransform(f, {identity:'clear'});
    f.getBoundingClientRect();
    const sr = rect(sec), fr = rect(f);
    R['①frameRotate45'] = { secH_before:h0, secH_after:sec.offsetHeight,
      margin:[f.style.marginTop,f.style.marginBottom], rotMarkerAttr: f.dataset.rotMarginY,
      spillTopPx:+(sr.t-fr.t).toFixed(1), spillBottomPx:+(fr.b-sr.b).toFixed(1),
      frameAABB_h: fr.h, horizontallyCentered: getComputedStyle(f).marginLeft };
    // ② 0으로 되돌리기
    f.dataset.rotateDeg='0'; G.applyFrameTransform(f, {identity:'clear'});
    R['②revertTo0'] = { secH: sec.offsetHeight, backToBefore: sec.offsetHeight===h0,
      margin:[f.style.marginTop||'(none)',f.style.marginBottom||'(none)'], marker: f.dataset.rotMarginY||'(none)',
      transform: f.style.transform||'(none)' };
    // ③ 로드경로(identity 기본 skip) 가 «회전 0 프레임» 을 안 건드리는가 — outerHTML 무변경 게이트
    const g = window.makeFrameBlock({}); inner.appendChild(g);
    const gHtml = g.outerHTML; G.applyFrameTransform(g); // save-load 가 부르는 형태 그대로
    R['③loadPathNoop_rot0'] = { unchanged: g.outerHTML===gHtml, before:gHtml.slice(0,150), after:g.outerHTML.slice(0,150) };
    // ③b 저장본에 rotate(0deg) 잔재가 있는 프레임도 그대로 두는가(스태킹 컨텍스트 보존)
    const g2 = window.makeFrameBlock({}); g2.style.transform='translate(0px, 0px) rotate(0deg) scale(1, 1)';
    g2.dataset.rotateDeg='0'; inner.appendChild(g2);
    const g2Html = g2.outerHTML; G.applyFrameTransform(g2);
    R['③bLegacyIdentityKept'] = { unchanged: g2.outerHTML===g2Html, transform: g2.style.transform };
    f.remove(); g.remove(); g2.remove();

    // ④ 자식 회전 — 프레임이 자르는가
    const f3 = window.makeFrameBlock({}); inner.appendChild(f3); f3.style.height='300px'; f3.style.minHeight='300px';
    const a = document.createElement('div'); a.className='asset-block';
    a.style.cssText='position:absolute;left:20px;top:20px;width:400px;height:200px;background:#ccc;';
    f3.appendChild(a);
    const ovBefore = getComputedStyle(f3).overflowY;
    a.dataset.rotation='45'; a.style.transform='rotate(45deg)';
    R['④childRotateClip'] = { overflowY_noRotation: ovBefore, overflowY_rotated: getComputedStyle(f3).overflowY,
      childAABB_h: rect(a).h, clippedTopPx: +(rect(f3).t - rect(a).t).toFixed(1) };
    // 음성대조
    const f4=window.makeFrameBlock({}); inner.appendChild(f4);
    const v=document.createElement('div'); v.className='vector-block'; v.dataset.rotateDeg='0';
    v.style.cssText='position:absolute;left:0;top:0;width:80px;height:40px;'; f4.appendChild(v);
    R['④negControls'] = { plainFrame: getComputedStyle(f4).overflowY, rotateDegZeroChild: getComputedStyle(f4).overflowY };
    f3.remove(); f4.remove();

    // ⑤ 텍스트 중앙 (#2)
    const f5 = window.makeFrameBlock({}); inner.appendChild(f5); window._activeFrame=f5;
    window.addTextBlock('body');
    const tf = f5.querySelector(':scope > .frame-block[data-text-frame]');
    R['⑤addTextBlock'] = { inline:{left:tf.style.left,top:tf.style.top,width:tf.style.width}, err: ctr(tf,f5) };
    window.addTextBlock('body');
    const tfs=[...f5.querySelectorAll(':scope > .frame-block[data-text-frame]')];
    R['⑤bSecondTextCascade'] = tfs.map(t=>({left:t.style.left,top:t.style.top}));
    f5.remove();

    // ⑥ 명시좌표(MCP 경로)는 «중앙으로 안 끌려간다» — 회귀 가드
    const f6 = window.makeFrameBlock({}); inner.appendChild(f6); window._activeFrame=f6;
    window.addTextBlock('body', { x: 33, y: 77, width: 200 });
    const tf6 = f6.querySelector(':scope > .frame-block[data-text-frame]');
    R['⑥explicitCoordsUntouched'] = { left:tf6.style.left, top:tf6.style.top, width:tf6.style.width };
    f6.remove();

    // ⑦ 빈줄 / ⑧ 비텍스트 블록 (#3)
    const f7 = window.makeFrameBlock({}); inner.appendChild(f7); window._activeFrame=f7;
    window.addBlankTextBlock('body');
    const tf7=f7.querySelector(':scope > .frame-block[data-text-frame]');
    R['⑦addBlank'] = { inline:{left:tf7.style.left,top:tf7.style.top,width:tf7.style.width}, err: ctr(tf7,f7) };
    f7.remove();
    const f8 = window.makeFrameBlock({}); inner.appendChild(f8); window._activeFrame=f8;
    window.addAssetBlock();
    const k8=[...f8.children].filter(c=>!c.classList.contains('frame-resize-handle'));
    R['⑧addAsset'] = k8.map(c=>({cls:c.className.split(' ')[0],left:c.style.left,top:c.style.top,w:c.style.width,err:ctr(c,f8)}));
    window.addIconCircleBlock && window.addIconCircleBlock();
    const k8b=[...f8.children].filter(c=>!c.classList.contains('frame-resize-handle'));
    R['⑧bTwoBlocks'] = k8b.map(c=>({cls:c.className.split(' ')[0],left:c.style.left,top:c.style.top}));
    f8.remove();

    // ⑨ 섹션에 «직접» 텍스트 추가 — 중앙배치가 새지 않는가(프레임 밖 경로 회귀 가드)
    window._activeFrame = null;
    const nBefore = inner.querySelectorAll(':scope > .frame-block[data-text-frame]').length;
    window.addTextBlock('body');
    const secTfs=[...inner.querySelectorAll(':scope > .frame-block[data-text-frame]')];
    const last=secTfs[secTfs.length-1];
    R['⑨sectionDirectInsert'] = { added: secTfs.length-nBefore, position:last.style.position||'(static)',
      left:last.style.left||'(none)', top:last.style.top||'(none)' };
    last.remove();
    return R;
  });
  console.log(JSON.stringify(out, null, 1));
  const e = await pg.evaluate(()=>window.__err); if (e.length) console.log('ERR', e);
  await b.close();
})();
