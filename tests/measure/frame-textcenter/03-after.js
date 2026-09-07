/* 고친 «뒤» 측정 — 01-before.js 와 동일 시나리오(파일 사본, 대조 가능하게 유지) */
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const pg = await b.newPage({ viewport: { width: 1600, height: 1600 } });
  pg.on('console', m => { if (m.type()==='error') console.log('CONSOLE ERR:', m.text().slice(0,300)); });
  await pg.goto('http://127.0.0.1:8899/tests/measure/frame-textcenter/harness.html', { waitUntil: 'networkidle' });
  const out = await pg.evaluate(async () => {
    const SD = await import('/js/section-drag.js');
    const R = {}; const inner = document.querySelector('.section-inner');
    const rect = e => { const r=e.getBoundingClientRect(); return {t:+r.top.toFixed(1),l:+r.left.toFixed(1),w:+r.width.toFixed(1),h:+r.height.toFixed(1),cx:+(r.left+r.width/2).toFixed(1)}; };
    const ctrErr = (c,f)=>{const a=c.getBoundingClientRect(),z=f.getBoundingClientRect();
      return {h:+(((a.left+a.right)/2)-((z.left+z.right)/2)).toFixed(1), v:+(((a.top+a.bottom)/2)-((z.top+z.bottom)/2)).toFixed(1)};};
    const tfInfo = (tf, frame) => {
      const tb = tf.querySelector('.text-block');
      const ce = tf.querySelector('[class^="tb-"]') || tb;
      const g = document.createRange(); g.selectNodeContents(ce);
      const gr = g.getBoundingClientRect();
      return {
        left: tf.style.left, top: tf.style.top, width: tf.style.width, dsWidth: tf.dataset.width,
        inlineAlign_content: ce.style.textAlign || '(none)',
        computedAlign_content: getComputedStyle(ce).textAlign,
        tfRect: rect(tf), glyphRect: {l:+gr.left.toFixed(1), w:+gr.width.toFixed(1), cx:+(gr.left+gr.width/2).toFixed(1)},
        boxCenterErr: ctrErr(tf, frame),
        glyphCenterErr: +(((gr.left+gr.right)/2) - ((frame.getBoundingClientRect().left+frame.getBoundingClientRect().right)/2)).toFixed(1),
      };
    };

    /* ── A. (a) 신규 추가 — addTextBlock ── */
    const f1 = window.makeFrameBlock({}); inner.appendChild(f1); window._activeFrame = f1;
    window.addTextBlock('body');
    const tf1 = f1.querySelector('.frame-block[data-text-frame]');
    R['A1_addTextBlock_1st'] = tfInfo(tf1, f1);
    window.addTextBlock('body');
    const tfs = f1.querySelectorAll('.frame-block[data-text-frame]');
    R['A2_addTextBlock_2nd'] = tfInfo(tfs[1], f1);
    // 긴 여러 줄 텍스트(ragged) — 「박스는 중앙, 짧은 줄은 좌측」이 실제로 보이는가
    const f1b = window.makeFrameBlock({}); inner.appendChild(f1b); window._activeFrame = f1b;
    window.addTextBlock('body', { content: '첫 줄은 아주 길게 늘어져서 프레임 폭 근처까지 가는 문장입니다 정말로 길게\n짧은둘째줄' });
    const tf1b = f1b.querySelector('.frame-block[data-text-frame]');
    const ce1b = tf1b.querySelector('[class^="tb-"]');
    const lineRects = (() => { const r=document.createRange(); r.selectNodeContents(ce1b);
      return [...r.getClientRects()].map(x=>({l:+x.left.toFixed(1), w:+x.width.toFixed(1), cx:+(x.left+x.width/2).toFixed(1)})); })();
    R['A3_multiline_ragged'] = { ...tfInfo(tf1b, f1b), frameCx: +(f1b.getBoundingClientRect().left + f1b.getBoundingClientRect().width/2).toFixed(1), lineRects };

    /* ── B. (a) addBlankTextBlock ── */
    const f2 = window.makeFrameBlock({}); inner.appendChild(f2); window._activeFrame = f2;
    window.addBlankTextBlock('body');
    R['B1_blank_1st'] = tfInfo(f2.querySelector('.frame-block[data-text-frame]'), f2);
    window.addBlankTextBlock('body');
    R['B2_blank_2nd'] = tfInfo(f2.querySelectorAll('.frame-block[data-text-frame]')[1], f2);

    /* ── C. 명시 align (MCP/API 경로) 은 그대로인가 ── */
    const f3 = window.makeFrameBlock({}); inner.appendChild(f3); window._activeFrame = f3;
    window.addTextBlock('body', { align: 'right' });
    R['C1_explicit_right'] = tfInfo(f3.querySelector('.frame-block[data-text-frame]'), f3);
    const f3b = window.makeFrameBlock({}); inner.appendChild(f3b); window._activeFrame = f3b;
    window.addTextBlock('body', { align: 'left' });
    R['C2_explicit_left'] = tfInfo(f3b.querySelector('.frame-block[data-text-frame]'), f3b);
    // 명시 좌표(MCP) — 손대면 안 됨
    const f3c = window.makeFrameBlock({}); inner.appendChild(f3c); window._activeFrame = f3c;
    window.addTextBlock('body', { x: 33, y: 77, width: 200 });
    const tf3c = f3c.querySelector('.frame-block[data-text-frame]');
    R['C3_explicit_xy'] = { left: tf3c.style.left, top: tf3c.style.top, width: tf3c.style.width,
      align: (tf3c.querySelector('[class^="tb-"]')||{}).style?.textAlign || '(none)' };

    /* ── D. 회귀 금지선: 섹션 «직접» / fullWidth 프레임 ── */
    window._activeFrame = null;
    window.addTextBlock('body', { content: 'SECTION-DIRECT' });
    const secTf = [...inner.children].filter(c=>c.dataset && c.dataset.textFrame==='true').pop();
    R['D1_sectionDirect'] = { position: secTf.style.position || '(static)', left: secTf.style.left || '(none)',
      width: secTf.style.width || '(none)',
      inlineAlign: (secTf.querySelector('[class^="tb-"]').style.textAlign)||'(none)',
      computedAlign: getComputedStyle(secTf.querySelector('[class^="tb-"]')).textAlign, outerHTMLHead: secTf.outerHTML.slice(0,120) };
    const f4 = window.makeFrameBlock({ fullWidth: true }); inner.appendChild(f4); window._activeFrame = f4;
    window.addTextBlock('body', { content: 'FULLWIDTH' });
    const tf4 = f4.querySelector('.frame-block[data-text-frame]');
    R['D2_fullWidthFrame'] = { position: tf4.style.position || '(static)', left: tf4.style.left || '(none)',
      width: tf4.style.width || '(none)',
      inlineAlign: (tf4.querySelector('[class^="tb-"]').style.textAlign)||'(none)',
      computedAlign: getComputedStyle(tf4.querySelector('[class^="tb-"]')).textAlign, outerHTMLHead: tf4.outerHTML.slice(0,120) };

    /* ── E. (b) HTML5 드롭 — 섹션 텍스트프레임을 자유배치 프레임 안으로 ── */
    window._activeFrame = null;
    window.addTextBlock('body', { content: 'DROP-ME' });
    const dropSrc = [...inner.children].filter(c=>c.dataset && c.dataset.textFrame==='true').pop();
    const beforeAlign = dropSrc.querySelector('[class^="tb-"]').style.textAlign || '(none)';
    const f5 = window.makeFrameBlock({}); inner.appendChild(f5);
    window.bindFrameDropZone(f5);
    // 프레임 안에 미리 «이미 중앙에 놓인» 블록 하나 — 재정렬 루프가 지우는지 본다
    window._activeFrame = f5; window.addTextBlock('body', { content: 'ALREADY-HERE' });
    const pre = f5.querySelector('.frame-block[data-text-frame]');
    const preBefore = { left: pre.style.left, top: pre.style.top, width: pre.style.width };
    window._activeFrame = null;
    SD.dragState.dragSrc = dropSrc;
    const ev = new Event('drop', { bubbles: true, cancelable: true });
    ev.dataTransfer = { dropEffect: '' };
    f5.dispatchEvent(ev);
    R['E1_dropIntoFrame'] = {
      landedInFrame: dropSrc.parentElement === f5,
      left: dropSrc.style.left, top: dropSrc.style.top, width: dropSrc.style.width,
      alignBefore: beforeAlign,
      alignAfter: dropSrc.querySelector('[class^="tb-"]').style.textAlign || '(none)',
      centerErr: ctrErr(dropSrc, f5),
      frameClientW: f5.clientWidth,
    };
    R['E2_siblingClobber'] = { before: preBefore, after: { left: pre.style.left, top: pre.style.top, width: pre.style.width } };

    /* ── F. (c) 「보여지는 가로너비」 축 비교 ── */
    const fz = window.makeFrameBlock({}); inner.appendChild(fz);
    const axesPlain = { clientWidth: fz.clientWidth, rectW: +fz.getBoundingClientRect().width.toFixed(2),
                        datasetWidth: fz.dataset.width, styleWidth: fz.style.width, offsetWidth: fz.offsetWidth };
    // 줌(캔버스 scaler transform:scale) 걸었을 때
    const scaler = document.getElementById('canvas-scaler');
    scaler.style.transform = 'scale(0.4)'; scaler.style.transformOrigin = 'top left';
    const child = document.createElement('div');
    child.style.cssText = 'position:absolute;left:0;top:0;width:200px;height:50px;background:#ccc;';
    fz.appendChild(child);
    const axesZoom = { clientWidth: fz.clientWidth, rectW: +fz.getBoundingClientRect().width.toFixed(2),
                       childOffsetW: child.offsetWidth, childRectW: +child.getBoundingClientRect().width.toFixed(2) };
    scaler.style.transform = '';
    // 중첩 프레임: max-width:100% 로 «설정값»과 «보여지는 값»이 갈리는가
    const outerF = window.makeFrameBlock({}); inner.appendChild(outerF);
    outerF.style.width = '400px'; outerF.style.maxWidth = '400px';
    const innerF = window.makeFrameBlock({}); innerF.style.position='absolute'; innerF.style.left='0'; innerF.style.top='0';
    outerF.appendChild(innerF);
    const axesNested = { dataset_width: innerF.dataset.width, style_width: innerF.style.width,
                         clientWidth: innerF.clientWidth, rectW: +innerF.getBoundingClientRect().width.toFixed(2) };
    // 패딩 프레임: clientWidth 가 padding box(=absolute 자식의 기준)인가
    const fp = window.makeFrameBlock({}); inner.appendChild(fp); fp.style.padding = '40px'; fp.style.border='5px solid #000';
    const axesPad = { clientWidth: fp.clientWidth, offsetWidth: fp.offsetWidth, rectW: +fp.getBoundingClientRect().width.toFixed(2) };
    R['F_widthAxes'] = { plain: axesPlain, underZoom040: axesZoom, nestedMaxWidth: axesNested, paddedBordered: axesPad };

    R['__err'] = window.__err;
    return R;
  });
  console.log(JSON.stringify(out, null, 2));
  await b.close();
})();
