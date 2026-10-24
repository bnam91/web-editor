/* annot-same-as-other-blocks.dom.spec.js — ★어노테이션·치수선을 ★«다른 블록처럼» 다룬다. (2026-10-24 신설)
 *
 * ★왜 있나 — ★현빈 결정
 *   현빈: 「★왜 ★다르게 ★보냐 · ★★똑같이 ★해 · ★다른 ★블록처럼」
 *   ⇒ ★Figma JSON · ★마켓 비교 · ★버전 비교 ★전부에서 어노테이션(펜 주석)과 치수선을
 *     ★특별 제외하지 않는다. ★그 제외를 걷은 커밋이 ★이 파일을 같이 낳았다.
 *
 * ★★이번엔 ★«나온다»가 ★참이다 — 그래서 ★양성대조가 ★본 단언이다
 *   「0 건이다」가 아니라 「★N 건 나온다」를 재므로, ⛔장면을 안 만들었을 때 ★조용히 초록이
 *   되는 길이 없다. 대신 ★반대 위험이 생긴다 — ★«나오긴 나오는데 ★빈 껍데기»다.
 *   ⇒ A1 은 ★나온 ★노드의 ★«안»을 잰다(svg 바이트·치수선 선분 수).
 *
 * ★★음성대조를 ★같이 둔다 (A2) — `qa-block` 은 ★여전히 ★제외다. 「전부 나온다」로 미끄러지면
 *   거기서 빨개진다. ⛔A1 만 두면 「제외 명부를 통째로 비웠다」와 구분이 안 된다.
 *
 * ★★치수선은 ★별도 class 가 ★아니다 — ★측정값 : `js/blocks/annotation-block.js:424`
 *   `block.className = 'annotation-block'` ★하나뿐이고 치수선은 `annotKind:'dim'` ★변종이다
 *   (`:41` ★정의 자리). ⇒ 「★치수선도 동일」은 ★`.annotation-block` 제외를 걷는 것으로
 *   ★★자동으로 닫힌다. ⛔「치수선 class 를 따로 찾아 지운다」는 ★할 일이 ★없다.
 *
 * ⛔앱을 띄우지만 ★고디터 ★인스턴스가 ★아니다 — bootApp 은 헤드리스 크로미움에 레포 파일만 얹는다.
 *
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js annot-same-as-other-blocks
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { ROOT, bootApp } = require('./_root-harness.js');

/** 섹션 하나 + 어노테이션(펜) + 치수선 — ★꼴을 ★앱에서 ★뽑았다.
 *  ★★`section-block > section-inner` 와 `__state.pages` 둘이 ★없으면 내보내기가 ★`sections: []` 를 돌려준다
 *    (★261024 실측 — 내가 처음 짠 장면이 그랬고, ★A1 의 ★앞끝 양성대조가 ★그 자리에서 ★잡았다).
 *  ★꼴의 출처 = `tests/dom/figma-export-coverage.dom.spec.js:435~447` (★이미 초록인 장면). */
async function fixture(page) {
  return await page.evaluate(async () => {
    /* ★섹션·글상자는 ★앱의 ★제 함수로 만든다 — ⛔손으로 HTML 을 짜면 ★`sections: []` 가 나온다
       (★261024 실측 : `.section-inner` 와 상태 반영이 빠져 ★내보내기가 ★0 건이었다). */
    await window.addSection();
    const secs = [...document.querySelectorAll('#canvas .section-block')];
    const sec = secs[secs.length - 1];
    window.getSelectedSection = () => sec; window._activeFrame = null;
    await window.addTextBlock('body');
    /* ⛔글자를 ★손으로 ★덮지 ★않는다 — ★261024 에 ★그랬다가 ★섹션 ★제목(heading)의 ★안쪽 `.tb-h*` 를
       ★날려 ★그 블록이 ★`generic`(texts 0)으로 ★나갔고, ★내 ★앞끝 양성대조가 ★★거짓 ★빨강이 됐다.
       ⇒ ★앱이 ★넣어 준 ★기본 글자를 ★그대로 ★닻으로 ★쓴다. */
    const texts = [...sec.querySelectorAll('.text-block')];
    if (texts.length < 2) return { fail: `text-block 이 ${texts.length} 개 — 장면이 안 섰다` };

    const inner = sec.querySelector('.section-inner') || sec;
    /* ★펜 주석 · ★치수선 — ★같은 함수, `annotKind` 만 다르다(치수선은 별도 class 가 아니다)
       ★★★붙이는 ★자리는 ★`.section-block` ★★직속이다 — ⛔`.section-inner` 가 ★아니다.
         ★출처 = `js/annotation-tool.js:168` `e.target.closest('.section-block')` → `:358` `sec.appendChild(block)`
         ★★261024 에 ★처음엔 ★inner 에 ★넣었고, ★그러면 ★«플로팅 경로»(섹션 직속 absolute,
           ★좌표와 함께 나가는 길 — `figma-export-coverage` FX-4)를 ★★안 탄다.
         ⇒ ★★«그 꼴이 앱에서 생기나»를 ★먼저 재고 ★자리를 ★맞췄다. */
    /* ★★★글자 인자는 ★★`text` 다 — ⛔`labelText` 는 ★★내가 ★지어낸 ★이름이었다(261024).
         ★정의 자리 = `annotation-block.js:408` `opts.text ?? ANNOT_DEFAULTS.text`
         ★앱 쓰임  = `annotation-tool.js:357` `makeAnnotationBlock({ points, text: '텍스트' })`
       ★★그 흠 때문에 ★라벨에 ★기본값 「텍스트」가 들어갔고, ★내 표식이 ★DOM 에 ★애초에 ★없었다
         ⇒ ★「JSON 에 없다」가 ★당연해져 ★단언이 ★★항등식이 됐다(★같은 병 ★세 번째). */
    const pen = window.makeAnnotationBlock({ points: [[20, 20], [160, 90]], text: 'PEN-LABEL-ZQ' });
    const dim = window.makeAnnotationBlock({
      annotKind: 'dim', points: [[30, 200], [230, 200]], text: 'DIM-LABEL-ZQ',
    });
    sec.appendChild(pen); sec.appendChild(dim);
    /* ★음성대조용 — ★여전히 제외되어야 하는 종 */
    const qa = document.createElement('div');
    qa.className = 'qa-block'; qa.id = 'qa_zq';
    qa.innerHTML = '<div class="tb-body">QA-ONLY-ZQ</div>';
    inner.appendChild(qa);
    window.annotRedrawDim?.(dim);

    window.flushCurrentPage();   /* ★앱의 ★제 길 — ⛔`state.pages` 를 손으로 쓰지 않는다 */
    return {
      penId: pen.id, dimId: dim.id, secId: sec.id,
      /* ★되돌리기용 ★원본 — ⛔「같은 글자를 다시 쓰면 같아진다」로 ★짐작하지 않는다(261024 실측 빨강) */
      penLabelHtml: pen.querySelector('.annot-label')?.innerHTML ?? null,
      /* ★★전제 — ★내 표식이 ★★정말 ★라벨에 ★들어갔나. ⛔안 들어가면 ★아래 「JSON 에 있나」가 ★무의미 */
      penLabelText: pen.querySelector('.annot-label')?.textContent ?? null,
      dimLabelText: dim.querySelector('.annot-label')?.textContent ?? null,
    };
  });
}

/* ══ A0 — ★전제를 ★단언한다 (★이 검사가 ★무엇에 기대고 있나) ══════════════════════ */
test('A0 ★전제 — 제 함수가 있고, 제외 명부에서 annotation-block 이 «빠져» 있다', async ({ page }) => {
  const errs = await bootApp(page);
  const api = await page.evaluate(() => ({
    make: typeof window.makeAnnotationBlock,
    figma: typeof window.buildFigmaExportJSON,
    mm: typeof window.marketMerge?.normSection,
  }));
  expect(api, '★제 함수가 없으면 아래 전부가 «안 재고 있다»다').toEqual({
    make: 'function', figma: 'function', mm: 'function',
  });

  /* ★소스로도 잰다 — ★행위 단언이 ★어느 판을 재는지 못 박는다 */
  const fg = fs.readFileSync(path.join(ROOT, 'js', 'io', 'export-figma-json.js'), 'utf8');
  const skip = fg.slice(fg.indexOf('_TRAVERSE_SKIP = {'));
  const skipBody = skip.slice(0, skip.indexOf('};'));
  const keys = [...skipBody.matchAll(/^\s*'([a-z0-9-]+-block)'\s*:/gm)].map(m => m[1]).sort();
  expect(keys, '★제외 명부가 바뀌었다 — annotation-block 이 돌아왔으면 현빈 결정에 어긋난다')
    .toEqual(['frame-block', 'group-block', 'qa-block', 'section-block']);

  /* ★★제거 목록 ★셋 — ★한 자리만 고치고 둘을 잊는 것을 막는다(명부가 셋이었다) */
  for (const f of ['js/market-merge.js', 'js/version-diff.js']) {
    const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
    const lines = src.split('\n').filter(l => /querySelectorAll\(.*section-height-badge/.test(l));
    expect(lines.length, `${f} 에 normSection 제거 줄이 없다 — 자가 낡았다`).toBe(1);
    expect(lines[0], `${f} 의 제거 목록에 .annotation-block 이 ★또 있다 — 한쪽만 되돌리지 마라`)
      .not.toContain('.annotation-block');
    /* ★음성대조 — ★그 줄이 ★여전히 ★무언가는 지운다(★목록을 통째로 비운 것이 아니다) */
    expect(lines[0], `${f} 의 제거 목록이 통째로 비었다`).toContain('.annot-preview');
  }
  expect(errs, '앱 부팅 중 오류').toEqual([]);
});

/* ══ A1 — ★★양성대조(본 단언): 어노테이션·치수선이 ★Figma JSON 에 ★«나온다» ═════════ */
test('A1 ★양성대조 — 어노테이션·치수선이 Figma JSON 에 나오고, 껍데기가 «아니다»', async ({ page }) => {
  const errs = await bootApp(page);
  const ids = await fixture(page);
  const r = await page.evaluate(async (ids) => {
    const j = window.buildFigmaExportJSON(null);
    const s = JSON.stringify(j);
    /* ★어느 노드가 그 둘인가 — id 로 집는다(★class 이름 grep 이 아니다) */
    const flat = [];
    (function walk(v) {
      if (Array.isArray(v)) return v.forEach(walk);
      if (v && typeof v === 'object') { flat.push(v); Object.values(v).forEach(walk); }
    })(j);
    const pen = flat.find(n => n && n.id === ids.penId);
    const dim = flat.find(n => n && n.id === ids.dimId);
    return {
      penFound: !!pen, dimFound: !!dim,
      penType: pen?.type || '', dimType: dim?.type || '',
      penKind: pen?.kind || '', dimKind: dim?.kind || '',
      penBox: [pen?.width ?? null, pen?.height ?? null], dimBox: [dim?.width ?? null, dim?.height ?? null],
      /* ★★«다른 블록처럼»의 ★본 증거 — ★플로팅 경로(섹션 직속 absolute)를 ★탔나 = ★좌표가 ★실렸나 */
      penFloat: pen?.floating ?? null, dimFloat: dim?.floating ?? null,
      penHasXY: typeof pen?.x === 'number' && typeof pen?.y === 'number',
      dimHasXY: typeof dim?.x === 'number' && typeof dim?.y === 'number',
      penKeys: pen ? Object.keys(pen).join(',') : '',
      penLabelText: ids.penLabelText, dimLabelText: ids.dimLabelText,
      /* ★★«다른 출처»에서 ★섹션 실측 크기를 ★같이 뽑는다 — ⛔JSON 의 값을 ★되받지 ★않는다 */
      secBox: (() => { const e = document.getElementById(ids.secId); return e ? [e.offsetWidth, e.offsetHeight] : null; })(),
      /* ★펜 선의 ★그림 범위 — `points` 가 ★정본이다 */
      penPoints: JSON.parse(document.getElementById(ids.penId).dataset.points || '[]'),
      /* ★★음성대조용 — ★px 로 적힌 인라인 크기는 ★그대로 실려야 한다 */
      pxProbe: (() => {
        const t = document.createElement('div');
        t.className = 'probe-block'; t.id = 'pxProbe_zq';
        t.style.width = '123px'; t.style.height = '77px';
        document.getElementById(ids.secId).appendChild(t);
        window.flushCurrentPage();
        const jj = JSON.stringify(window.buildFigmaExportJSON(null));
        t.remove(); window.flushCurrentPage();
        const m = jj.match(/\{"type":"generic","id":"pxProbe_zq"[^}]*\}/);
        return m ? m[0] : null;
      })(),
      penSvgLen: (pen?.svg || '').length, dimSvgLen: (dim?.svg || '').length,
      /* ★치수선의 «안» — 치수선 전용 선분이 실렸나 */
      dimHasDimLine: /annot-dim-line/.test(dim?.svg || ''),
      penHasLine: /annot-line/.test(pen?.svg || ''),
      /* ★라벨 글자 — ★GENERIC 폴백의 texts 는 `tb-` 접두만 본다(소스 :1004) */
      penLabelInTexts: JSON.stringify(pen?.texts || []).includes('PEN-LABEL-ZQ'),
      penLabelAnywhere: s.includes('PEN-LABEL-ZQ'),
      dimLabelAnywhere: s.includes('DIM-LABEL-ZQ'),
      /* ★앞끝 양성대조 — ★`text` 종 블록이 ★실제로 ★나왔나(⛔내가 쓴 글자 ★문자열이 아니다) */
      nText: flat.filter(n => n && n.type === 'text' && n.content).length,
    };
  }, ids);

  /* ★앞끝 양성대조 — 본문이 나오지 않으면 이 내보내기 자체가 «안 돌았다» */
  expect(r.nText, '★text 종 블록이 하나도 JSON 에 없다 — 내보내기가 안 돌았다. 아래 단언은 의미 없다')
    .toBeGreaterThan(0);

  /* ★★본 단언 — ★나온다 */
  expect({ pen: r.penFound, dim: r.dimFound },
    '★어노테이션/치수선이 Figma JSON 에 ★없다 — 현빈 결정(다른 블록처럼)이 안 섰다').toEqual({ pen: true, dim: true });
  expect({ pen: r.penType, dim: r.dimType },
    '★종이 generic 이 아니다 — GENERIC 폴백 경로가 바뀌었으면 아래 칸 이름도 바뀐다')
    .toEqual({ pen: 'generic', dim: 'generic' });
  /* ★수신측이 ★무엇으로 ★가르나 — `kind` 는 `dataset.type` 에서 온다(annotation-block.js:425) */
  expect({ pen: r.penKind, dim: r.dimKind },
    '★kind 가 annotation 이 아니다 — 피그마 수신측이 이 둘을 가를 열쇠가 바뀌었다')
    .toEqual({ pen: 'annotation', dim: 'annotation' });

  /* ★★«껍데기가 아니다» — ★그림이 ★실려 ★있다. ⛔「노드가 있다」로 닫지 않는다. */
  expect(r.penHasLine, `★펜 주석의 svg 에 .annot-line 이 없다 (svg ${r.penSvgLen}바이트) — 빈 껍데기로 나갔다`).toBe(true);
  expect(r.dimHasDimLine, `★치수선의 svg 에 .annot-dim-line 이 없다 (svg ${r.dimSvgLen}바이트) — 치수선 그림이 빠졌다`).toBe(true);
  expect(r.penSvgLen, `★펜 svg 가 비었다 (${r.penSvgLen}바이트)`).toBeGreaterThan(80);
  expect(r.dimSvgLen, `★치수선 svg 가 비었다 (${r.dimSvgLen}바이트)`).toBeGreaterThan(80);

  /* ★★★`ANNOT-LABEL-TEXT-NOT-IN-FIGMA-TEXTS-01` — ★★닫혔다(261024).
     ★증상 : ★그림(svg)은 나가는데 ★라벨 ★글자는 ★안 나갔다 — ★수집기가 ★`tb-` 접두만 봤다.
     ★고침 : `export-figma-json.js` GENERIC 폴백의 수집 선택자에 ★`.annot-label` 을 ★더했다.
     ★★★결함이 ★실재했음을 ★핀 판으로 ★확인했다 — ⛔「고쳤다」만 적지 ★않는다 :
       ★핀 `74a53cf2` 를 `git archive` 로 전개해 ★같은 장면을 돌렸다(★제품만 옛 판) ⇒
         labelInDom = 'PEN-LABEL-ZQ' (★DOM 엔 ★있다)
         penTexts   = '[]' · penLabelAnywhere = false · dimLabelAnywhere = false (★JSON 엔 ★없다)
       ⇒ ★★결함 ★실재 · ★지금 판에서 ★`inTexts: true`.
     ★★⛔그런데 ★★내가 ★처음 이 이름을 올릴 때는 ★★«깨진 장면»으로 ★쟀다 —
       ★장면이 `labelText:`(★내가 ★지어낸 이름)를 써서 ★표식이 ★DOM 에 ★애초에 ★없었다.
       ⇒ ★결론은 ★맞았지만 ★★«맞는 결론»이 ★«맞는 측정»은 ★아니다. ★그래서 ★핀 대조를 ★따로 ★했다.
     ★★★남은 ★미측 = `ANNOT-LABEL-ANCHOR-TRANSFORM-NOT-IN-FIGMA-01`
       ★라벨의 `transform: translate(0,-50%)` 정렬(`_calcLabelTransform`)과
       ★`translate:<dx>px <dy>px`(사용자가 끌어 옮긴 몫)은 ★모형에 ★안 담긴다.
       ⛔「자리가 틀린다」로 ★단정하지 ★않는다 — ★수신측(figma-renderer) 영향은 ★안 쟀다.
       ★x·y 자체는 ★맞다 : 라벨이 인라인 `left:<px>;top:<px>` 를 가진다(annotation-block.js:531). */
  expect({ inTexts: r.penLabelInTexts, anywhere: r.penLabelAnywhere, dimAnywhere: r.dimLabelAnywhere },
    '★라벨 글자가 Figma JSON 에 안 나간다 — ANNOT-LABEL-TEXT-NOT-IN-FIGMA-TEXTS-01 이 돌아왔다'
  ).toEqual({ inTexts: true, anywhere: true, dimAnywhere: true });

  /* ★★전제 — ★내 표식이 ★정말 ★라벨에 ★들어갔나(⛔안 들어가면 위 단언이 ★항등식이 된다 · 261024 실수) */
  expect({ pen: r.penLabelText, dim: r.dimLabelText },
    '★전제: 라벨에 내 표식이 안 들어갔다 — 인자 이름이 `text` 인지 다시 봐라(⛔labelText 는 없다)')
    .toEqual({ pen: 'PEN-LABEL-ZQ', dim: 'DIM-LABEL-ZQ' });

  /* ★★★«다른 블록처럼»의 ★본 증거 — ★★좌표와 ★함께 ★나간다.
     ★어노테이션은 `position:absolute` 로 ★`.section-block` ★직속에 산다(annotation-tool.js:168·358)
     ⇒ ★내보내기의 ★«플로팅» 경로를 ★타고 `floating`·`x`·`y` 가 ★실린다.
     ★★이 셋이 ★없으면 ★「나왔다」가 ★★«제자리를 잃고 나왔다»다 — ★그래서 ★따로 ★잰다.
     ★측정값(261024) : keys = `type,id,kind,width,height,bg,radius,svg,texts,floating,x,y` */
  expect({ penF: r.penFloat, dimF: r.dimFloat, penXY: r.penHasXY, dimXY: r.dimHasXY },
    `★좌표가 안 실렸다 — 플로팅 경로를 안 탔다(제자리를 잃는다). penKeys = ${r.penKeys}`
  ).toEqual({ penF: true, dimF: true, penXY: true, dimXY: true });

  /* ★★★2026-10-24 — ★`ANNOT-FIGMA-BOX-IS-CSS-DEFAULT-NOT-DRAWING-EXTENT-01` ★★닫힘.
     ★★★내가 붙인 ★그 이름은 ★까닭을 ★틀렸다. ★한때 ★상자가 ★`100×100` 으로 실렸고
       나는 그것을 「★CSS 기본 크기 100px」로 ★읽었다 — ★★거짓이다.
     ★참 까닭 : ★`annotation-block.js:438` 이 `style.width = '100%'` 를 쓰고,
       ★내보내기의 GENERIC 폴백이 ★`parseFloat('100%')` ⇒ ★★`100` 으로 ★읽었다(★단위가 사라진다).
       ★CSS 도 `width:100%; height:100%` 다(editor-blocks.css:3786) — ★100px 가 ★아니다.
     ★참 이름 = ★`FIGMA-GENERIC-PARSES-PERCENT-AS-PX-01` (★고쳤다 · ★아래 A4 가 잠근다)
     ⇒ ★어노테이션은 ★★«섹션을 덮는 ★오버레이»다(`.annot-svg` 는 `overflow:visible`).
       ★그러니 ★상자 = ★★섹션 ★실측 크기가 ★맞고, ★그림 좌표는 ★그 ★안에 ★있다.
     ★★★「★그림이 ★상자 밖으로 나간다」던 ★내 ★말은 ★★`100` 이라는 ★거짓 값이 ★만든 ★착시였다. */
  expect({ pen: r.penBox, dim: r.dimBox },
    `★어노테이션 상자가 ★섹션 실측 크기와 다르다 (섹션=${JSON.stringify(r.secBox)}) — ` +
    '퍼센트를 px 로 읽는 병이 돌아왔는지 본다'
  ).toEqual({ pen: r.secBox, dim: r.secBox });

  /* ★★그림이 ★상자 ★«안»에 ★있나 — ★이것이 ★원래 ★재려던 ★성질이다(⛔숫자가 아니라 ★관계) */
  const maxX = Math.max(...r.penPoints.map(pt => pt[0]));
  const maxY = Math.max(...r.penPoints.map(pt => pt[1]));
  expect(maxX <= r.penBox[0] && maxY <= r.penBox[1],
    `★펜 그림(${maxX},${maxY})이 상자(${r.penBox.join('×')}) 밖이다`).toBe(true);

  expect(errs, '앱 부팅 중 오류').toEqual([]);
});

/* ══ A2 — ★음성대조: `qa-block` 은 ★여전히 ★안 나온다 ════════════════════════════ */
test('A2 ★음성대조 — qa-block 은 여전히 제외다 (제외 명부를 통째로 비운 것이 아니다)', async ({ page }) => {
  await bootApp(page);
  const ids = await fixture(page);
  const r = await page.evaluate((ids) => {
    const s = JSON.stringify(window.buildFigmaExportJSON(null));
    return {
      qa: s.includes('QA-ONLY-ZQ'), qaId: s.includes('qa_zq'),
      /* ★★앞끝 양성대조 — ⛔이게 없으면 ★내보내기가 ★0 건일 때도 ★이 음성대조가 ★초록이다.
         ★261024 에 ★실제로 그랬다 : A1 이 ★빨강인 판에서 ★A2 는 ★초록이었다(★안 재고 있었다). */
      /* ★앞끝 양성대조 — ★`text` 종 블록이 ★실제로 ★나왔나(⛔내가 쓴 글자 ★문자열이 아니다) */
      nText: (s.match(/"type":"text"/g) || []).length,
      annotOut: s.includes(ids.penId),
    };
  }, ids);
  expect({ text: r.nText > 0, annot: r.annotOut },
    '★내보내기가 본문·어노테이션을 안 냈다 — 아래 「qa 가 없다」는 «안 재고 있다»와 구분이 안 된다')
    .toEqual({ text: true, annot: true });
  expect({ qa: r.qa, qaId: r.qaId },
    '★qa-block 이 Figma JSON 에 나왔다 — 제외를 통째로 비웠다. A1 의 「나온다」가 의미를 잃는다')
    .toEqual({ qa: false, qaId: false });
});

/* ══ A3 — ★마켓 비교 키: 어노테이션이 ★바뀌면 ★«바뀜»으로 ★읽힌다 ═══════════════════ */
test('A3 ★양성대조 — 어노테이션 라벨만 고쳐도 마켓 비교 키가 «바뀐다»', async ({ page }) => {
  await bootApp(page);
  const ids = await fixture(page);
  const r = await page.evaluate((ids) => {
    const sec = document.getElementById(ids.secId);
    const norm = window.marketMerge.normSection;
    const before = norm(sec);

    /* ⑴ ★어노테이션 ★라벨만 고친다 — ★다른 것은 ★안 건드린다 */
    const lbl = document.getElementById(ids.penId).querySelector('.annot-label');
    lbl.innerHTML = 'PEN-LABEL-CHANGED';
    const afterAnnot = norm(sec);

    /* ⑵ ★되돌리고 — ★치수선 ★길이를 고친다(치수선도 같은 취급인지) */
    /* ★원본 ★그대로 되돌린다 — ⛔「같은 글자를 다시 쓰면 같아진다」가 ★거짓이었다(261024 빨강).
       ★`annotLabelHtml` 이 글자를 ★감싸므로 ★평문을 ★다시 써도 ★바이트가 ★다르다. */
    lbl.innerHTML = ids.penLabelHtml;
    const restored = norm(sec);
    const dimEl = document.getElementById(ids.dimId);
    dimEl.dataset.dimOffset = String((parseInt(dimEl.dataset.dimOffset) || 24) + 17);
    const afterDim = norm(sec);

    /* ⑶ ★★음성대조 — ★`.annot-preview`(그리는 중)는 ★여전히 ★키에 ★안 든다 */
    dimEl.dataset.dimOffset = '24';
    const base2 = norm(sec);
    const pv = document.createElement('div');
    pv.className = 'annot-preview'; pv.textContent = 'PREVIEW-ZQ';
    sec.appendChild(pv);
    const afterPreview = norm(sec);
    pv.remove();

    return {
      annotChanged: before !== afterAnnot,
      restoredSame: before === restored,
      dimChanged: restored !== afterDim,
      previewIgnored: base2 === afterPreview,
      beforeHasAnnot: /annotation-block/.test(before),
      previewInKey: /PREVIEW-ZQ/.test(afterPreview),
    };
  }, ids);

  /* ★앞끝 전제 — 키에 어노테이션이 ★애초에 들어 있나. 안 들어 있으면 아래 「바뀐다」는 못 선다. */
  expect(r.beforeHasAnnot, '★비교 키에 annotation-block 이 아예 없다 — normSection 이 아직 지우고 있다').toBe(true);

  expect(r.annotChanged, '★어노테이션 라벨을 고쳤는데 마켓 비교 키가 «그대로»다 — 「바뀜」으로 안 읽힌다').toBe(true);
  expect(r.restoredSame, '★되돌렸는데 키가 다르다 — 이 검사의 자가 흔들린다(비교가 무의미)').toBe(true);
  expect(r.dimChanged, '★치수선(dimOffset)을 고쳤는데 키가 «그대로»다 — 치수선이 다른 블록처럼 안 다뤄진다').toBe(true);

  /* ★★음성대조 — ★전부를 키에 ★넣은 것이 ★아니다 */
  expect({ ignored: r.previewIgnored, leaked: r.previewInKey },
    '★`.annot-preview`(그리는 중 미리보기)가 비교 키에 들었다 — 그리는 동안 「바뀜」이 뜬다')
    .toEqual({ ignored: true, leaked: false });
});

/* ══ A4 — ★`FIGMA-GENERIC-PARSES-PERCENT-AS-PX-01` 의 ★잠그는 자 ════════════════
   ★고침 : GENERIC 폴백이 ★px(또는 단위 없는 수)만 ★받고, ★아니면 ★살아 있는 실측으로 떨어진다.
   ★★음성대조가 ★본 단언과 ★한 쌍이다 — ★px 는 ★그대로 ★실려야 ★한다.
     ⛔없으면 「★인라인 크기를 ★통째로 ★무시한다」와 ★구분이 ★안 ★된다. */
test('A4 ★퍼센트를 px 로 읽지 않는다 — ★음성대조: px 는 그대로 실린다', async ({ page }) => {
  await bootApp(page);
  const ids = await fixture(page);
  const r = await page.evaluate((ids) => {
    const sec = document.getElementById(ids.secId);
    const mk = (id, w, h) => {
      const t = document.createElement('div');
      t.className = 'probe-block'; t.id = id;
      t.style.width = w; t.style.height = h;
      sec.appendChild(t); return t;
    };
    const pct = mk('zqPct', '100%', '100%');
    const px  = mk('zqPx', '123px', '77px');
    const em  = mk('zqEm', '10em', '5em');
    window.flushCurrentPage();
    const j = window.buildFigmaExportJSON(null);
    const flat = []; (function w(v) { if (Array.isArray(v)) return v.forEach(w);
      if (v && typeof v === 'object') { flat.push(v); Object.values(v).forEach(w); } })(j);
    const get = (id) => { const n = flat.find(x => x && x.id === id); return n ? [n.width, n.height] : null; };
    const live = (el) => [el.offsetWidth, el.offsetHeight];
    const out = { pct: get('zqPct'), px: get('zqPx'), em: get('zqEm'),
                  pctLive: live(pct), emLive: live(em) };
    [pct, px, em].forEach(e => e.remove()); window.flushCurrentPage();
    return out;
  }, ids);
  console.log('[A4]', JSON.stringify(r));

  /* ★★음성대조 — ★px 는 ★그대로 (★고침이 ★인라인 크기를 ★통째로 버린 것이 ★아니다) */
  expect(r.px, '★px 로 적은 인라인 크기가 안 실렸다 — 고침이 너무 넓다').toEqual([123, 77]);
  /* ★★본 단언 — ★퍼센트는 ★★«100» 이 아니라 ★살아 있는 실측 */
  expect(r.pct, `★퍼센트를 아직 px 로 읽는다 (살아있는 실측=${JSON.stringify(r.pctLive)})`).toEqual(r.pctLive);
  expect(r.pct[0], '★퍼센트가 100 으로 실렸다 — parseFloat 가 단위를 먹었다').not.toBe(100);
  /* ★em 도 ★같은 갈래 — ★단위 있는 값은 ★전부 ★거절하고 ★실측으로 떨어진다 */
  expect(r.em, `★em 을 px 로 읽는다 (살아있는 실측=${JSON.stringify(r.emLive)})`).toEqual(r.emLive);
});
