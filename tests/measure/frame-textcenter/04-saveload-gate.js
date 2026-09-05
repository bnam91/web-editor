/* ★저장본 무변경 «실측 게이트»
   옛 저장본 HTML 을 캔버스에 심고 → 로드 경로(rebindAll) 를 통과시켜 outerHTML 이 «바이트 동일»한가.
   음성대조를 같이 잰다 — 비교기가 «변화를 실제로 잡는지» 보여야 이 게이트가 의미를 갖는다. */
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const pg = await b.newPage({ viewport: { width: 1600, height: 1600 } });
  pg.on('console', m => { if (m.type()==='error') console.log('CONSOLE ERR:', m.text().slice(0,300)); });
  await pg.goto('http://127.0.0.1:8899/tests/measure/frame-textcenter/harness.html', { waitUntil: 'networkidle' });
  const out = await pg.evaluate(async () => {
    /* ★rebindAll 은 «섹션 크롬»(삭제/순서/드래그/드롭존/히트존) 바인더를 부른다 —
       editor.js 전역이라 이 하네스엔 없다. 이번 변경이 «전혀 안 건드린» 것들이라 no-op 으로 세운다.
       ⇒ 이 게이트가 재는 것은 rebindAll 의 «DOM 정규화·블록 재바인딩» 구간이다. */
    for (const n of ['bindSectionDelete','bindSectionOrder','bindSectionDrag','bindSectionDropZone',
                     'bindSectionHitzone','bindSectionMemo','selectSectionWithModifier','bindSectionProtection',
                     'syncSection','highlightBlock','showFrameProperties','setBlockAnchor','syncLayerActive',
                     'toggleBlockSelect','rangeSelectBlocks','deselectAll','showToast','triggerAutoSave']) {
      if (typeof window[n] !== 'function') window[n] = () => {};
      if (typeof globalThis[n] !== 'function') globalThis[n] = window[n];
    }
    await import('/js/io/save-load.js');
    const R = {}; const canvas = document.getElementById('canvas');
    const TF = (id, style, align, text) =>
      `<div class="frame-block" id="${id}" data-text-frame="true" data-bg="transparent" style="${style}">` +
      `<div class="text-block" id="tb_${id}"><div class="tb-body" style="${align ? 'text-align:'+align+';' : ''}">${text}</div></div></div>`;
    canvas.innerHTML =
      `<div class="section-block" id="sec_old"><div class="section-inner" style="padding:40px 0;">` +
        // ① 자유배치 프레임 — 옛 저장본의 좌표/정렬 그대로
        `<div class="frame-block" id="ss_free" data-free-layout="true" data-bg="#ffffff" data-width="860" data-height="520" ` +
          `style="background:#ffffff;padding:0;width:860px;max-width:100%;margin:0 auto;min-height:520px;height:520px;">` +
          TF('ss_t1', 'position:absolute;left:0px;top:20px;width:338px;box-sizing:border-box;', '', '왼쪽 기본') +
          TF('ss_t2', 'position:absolute;left:100px;top:200px;width:100%;box-sizing:border-box;', 'right', '오른쪽 지정') +
        `</div>` +
        // ② fullWidth(플로우) 프레임
        `<div class="frame-block" id="ss_flow" data-full-width="true" data-bg="#eeeeee" style="background:#eeeeee;width:100%;box-sizing:border-box;">` +
          TF('ss_t3', 'background:transparent;width:100%;box-sizing:border-box;', '', '플로우 텍스트') +
        `</div>` +
        // ③ 섹션 «직접» 텍스트
        TF('ss_t4', 'background:transparent;width:100%;box-sizing:border-box;', '', '섹션 직접') +
      `</div></div>`;

    const before = canvas.outerHTML;
    window.rebindAll();
    const after = canvas.outerHTML;
    R['①loadPath_outerHTML'] = { byteIdentical: before === after, len: before.length };
    // ★두 빌드(기준선 vs 이 브랜치) 사이 «로드 결과»가 같은지 비교하기 위한 전문 덤프
    R['①loadPath_afterHTML'] = after;
    if (before !== after) {
      let i = 0; while (i < before.length && before[i] === after[i]) i++;
      R['①loadPath_outerHTML'].firstDiffAt = i;
      R['①loadPath_outerHTML'].beforeCtx = before.slice(Math.max(0,i-80), i+80);
      R['①loadPath_outerHTML'].afterCtx  = after.slice(Math.max(0,i-80), i+80);
    }
    // 각 텍스트의 정렬이 그대로인가 (인라인 + computed)
    const al = id => { const e = document.getElementById(id).querySelector('.tb-body');
      return { inline: e.style.textAlign || '(none)', computed: getComputedStyle(e).textAlign }; };
    R['②alignsUnchanged'] = { t1_free_default: al('ss_t1'), t2_free_right: al('ss_t2'),
                              t3_flow: al('ss_t3'), t4_sectionDirect: al('ss_t4') };
    // 좌표도 그대로인가
    const pos = id => ({ left: document.getElementById(id).style.left, top: document.getElementById(id).style.top,
                         width: document.getElementById(id).style.width });
    R['③coordsUnchanged'] = { t1: pos('ss_t1'), t2: pos('ss_t2') };

    /* ★음성대조 — 비교기가 «변화를 잡는지». 프레임에 텍스트를 «새로» 추가하면 반드시 달라져야 한다. */
    const snap = canvas.outerHTML;
    window._activeFrame = document.getElementById('ss_free');
    window.addTextBlock('body', { content: 'NEW' });
    R['④negControl_addChanges'] = { changed: canvas.outerHTML !== snap };
    // 그리고 그 «새» 텍스트만 가운데인가 — 기존 둘은 안 건드렸는가
    R['⑤afterAdd_oldOnesStill'] = { t1: al('ss_t1'), t2: al('ss_t2'), t4: al('ss_t4'),
      newOne: (() => { const tfs = document.getElementById('ss_free').querySelectorAll('.frame-block[data-text-frame]');
        const e = tfs[tfs.length-1].querySelector('.tb-body');
        return { inline: e.style.textAlign || '(none)', computed: getComputedStyle(e).textAlign,
                 left: tfs[tfs.length-1].style.left, width: tfs[tfs.length-1].style.width }; })() };
    R['__err'] = window.__err;
    return R;
  });
  console.log(JSON.stringify(out, null, 2));
  await b.close();
})();
