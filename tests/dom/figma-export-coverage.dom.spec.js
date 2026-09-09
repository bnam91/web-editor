/* figma-export-coverage.dom.spec.js — 「신규 블록이 Figma 업로드에서 빠지지 않는다」. (2026-09-09 신설)
 *
 * ★왜 있나
 *   현빈: 「줌 블럭 내보내기 테스트도 되었을까? 신규로 추가된 블럭들 모달블럭이나 …
 *   앱 빌드할 건데 내보내기 테스트를 했어야지」
 *   ⇒ 2026-09-09 실측: js/ 가 노출하는 add*Block 38종 중 «15종»이 Figma 업로드에서
 *     {"columns":[]} 빈 껍데기로 나가고 있었다. 에러도 경고도 없이.
 *
 * ★★분모를 «기계»가 센다 — ⛔손 명부로 세지 마라
 *   이 파일이 막으려는 병이 바로 「손으로 적은 명부가 20번째 블록을 못 본다」다.
 *   그 병을 검사가 똑같이 앓으면 안 된다. ⇒ 분모는 grep 으로 js/ 전역에서 뽑는다.
 *   새 블록을 추가하면 «자동으로» 분모가 늘고, 내보내기가 안 되면 «자동으로» 빨개진다.
 *
 * ★앞끝 양성대조가 본 단언 «앞»에 있다
 *   「빠지는 게 0이다」는 «아무것도 안 만들었을 때»도 참이다. 그래서 먼저 잰다:
 *     ①이 실행에서 블록을 실제로 만든 add fn 수  ②블록이 실린 섹션 수  ③text-block 이 나오나
 *   셋 중 하나라도 무너지면 본 단언은 «의미가 없다» — 그 자리에서 빨개진다.
 *
 * ⛔앱을 «안» 띄운다 — 고디터 인스턴스·MCP 9345 대역 무접촉. 레포 파일만 크로미움에 얹는다.
 * ⛔살아 있는 채널만 본다 — buildFigmaExportJSON(→figma-publish.js 업로드).
 *   exportFigmaJSON(파일 저장)·HTML 내보내기·Design JSON 은 부르는 곳이 검사뿐이라 안 본다.
 *
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js figma-export-coverage
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };
const FIGMA_SRC = path.join(REPO, 'js', 'io', 'export-figma-json.js');

/* ── 분모: 기계가 센다 ─────────────────────────────────────────────────── */
const sh = (cmd) => execSync(cmd, { encoding: 'utf8', cwd: REPO }).trim().split('\n').filter(Boolean);
/** js/ 가 «노출하는» add*Block 전수. 이게 분모다. */
const ADD_FNS = sh(`grep -rhoE 'window\\.(add[A-Za-z0-9]*Block)[[:space:]]*=' js/ | sed -E 's/window\\.//; s/ *=//' | sort -u`);
/** 그 함수들을 «정의하는» 파일 전수 — 하네스가 무엇을 import 할지도 손으로 안 적는다. */
const ADD_FILES = sh(`grep -rlE 'window\\.add[A-Za-z0-9]*Block[[:space:]]*=' js/ | sort`);

/* add*Block 을 정의하진 «않지만» 그 add fn 이 읽는 데이터를 공급하는 파일.
   ⛔없으면 addBannerBlock·addMockupBlock 이 «에러 없이» 아무것도 안 만든다(조용한 0) —
     그러면 양성대조가 38/38 에서 35/38 로 떨어져 그 자리에서 빨개진다. */
const DEP_FILES = ['js/banner-presets.js', 'js/panels/mockup-devices.js'];

/* ★★아직 «못 고친» 것 — 여기 이름이 있으면 그 종은 내보내기에서 빠진다는 뜻이다.
 *   2026-09-09 오후: «비었다». 한때 zoom·sticker·gradient 셋이 여기 있었다 —
 *   .section-block 직속(플로팅·absolute)이라 순회 뿌리(inner.children) «밖»이었다.
 *   순회의 뿌리를 넓혀 셋 다 닫혔다(모드 B). ⇒ 이제 빠지는 종은 0이어야 한다.
 *   ⛔여기 «한 줄이라도 늘면» 빨개진다 — 조용히 못 자란다. */
const KNOWN_DROPPED = [];

function harness() {
  const imports = [...DEP_FILES, ...ADD_FILES]
    .map(f => `  try { await import('/${f}'); } catch (e) { window.__importErrs.push(['${f}', String(e)]); }`).join('\n');
  return `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="/css/editor-base.css">
<link rel="stylesheet" href="/css/editor-blocks.css"></head><body style="margin:0">
<div id="project-tab-name">coverage</div>
<div id="canvas-wrap"><div id="canvas-scaler" style="transform:scale(1);transform-origin:0 0">
  <div id="canvas" style="width:860px"></div>
</div></div>
<div id="ss-handles-overlay"></div>
<div id="panel-right"><div class="panel-body"></div></div>
<script>window.__importErrs = [];</script>
<script type="module">
${imports}
  const g = await import('/js/globals.js');
  window.__state = g.state;
  await import('/js/io/export-figma-json.js');
  window.__ready = true;
</script></body></html>`;
}

async function boot(page) {
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/__coverage.html') return route.fulfill({ contentType: 'text/html', body: harness() });
    const file = path.join(REPO, url.pathname);
    if (!file.startsWith(REPO) || !fs.existsSync(file) || fs.statSync(file).isDirectory())
      return route.fulfill({ status: 404, body: '' });
    return route.fulfill({ contentType: MIME[path.extname(file)] || 'text/plain', body: fs.readFileSync(file) });
  });
  await page.goto(`${ORIGIN}/__coverage.html`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 30000 });
}

/** add fn 전수를 «진짜로» 부르고, 진짜 buildFigmaExportJSON 으로 내보낸 결과를 돌려준다. */
async function sweep(page, FNS) {
  return page.evaluate(async (FNS) => {
    const canvas = document.getElementById('canvas');

    /* 에디터 런타임 스텁 — 내보내기와 «무관»한 주변 배선만 채운다.
       ⛔블록을 만드는 일 자체는 진짜 add fn 이 한다(스텁이 대신 만들지 않는다). */
    const NOOP = () => {};
    for (const k of ['pushHistory', 'markDirty', 'autoSave', 'scheduleAutoSave', 'updateLayerPanel',
                     'renderLayerPanel', 'refreshLayerPanel', 'deselectAll', 'showToast',
                     'showNoSelectionHint', 'syncCanvasHeight', 'updateSectionHeights', 'saveScrollPos',
                     'hideHandles', 'showHandlesFor', 'flushCurrentPage', 'buildLayerPanel', 'selectSection'])
      if (typeof window[k] !== 'function') window[k] = NOOP;

    /* 인자가 필요한 몇몇. 프리셋 키는 «살아 있는 목록»에서 고른다 —
       손으로 적으면 이름이 바뀌는 날 조용히 0이 된다(그건 양성대조가 잡는다). */
    const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M4 4h16v16H4z"/></svg>';
    const ARGS = {
      addAssetBlock: ['full'], addTextBlock: ['body'], addBlankTextBlock: ['body'],
      addShapeBlock: ['rectangle'], addGapBlock: [50], addLinerBlock: ['underline'],
      addSpeechBubbleBlock: ['bottom'], addIconifyBlock: ['mdi:home', SVG, 64], addVectorBlock: [SVG],
    };
    const firstKey = (o) => o && Object.keys(o)[0];
    if (firstKey(window.BANNER_PRESETS)) ARGS.addBannerBlock = [firstKey(window.BANNER_PRESETS)];
    if (firstKey(window.MOCKUP_DEVICES)) {
      ARGS.addDeviceMockupBlock = [firstKey(window.MOCKUP_DEVICES), 400];
      ARGS.addMockupBlock = [{ deviceKey: firstKey(window.MOCKUP_DEVICES) }];
    }

    /* add fn 하나당 섹션 하나 — 「어느 종이 빠졌나」가 이름으로 바로 보이게. */
    const rows = [];
    for (let i = 0; i < FNS.length; i++) {
      const fn = FNS[i];
      const sec = document.createElement('div');
      sec.className = 'section-block'; sec.id = 'sec_' + i; sec.dataset.name = fn;
      const inner = document.createElement('div');
      inner.className = 'section-inner'; inner.style.width = '860px';
      sec.appendChild(inner); canvas.appendChild(sec);

      window.getSelectedSection = () => sec;
      window._activeFrame = null;
      let err = null;
      try { if (typeof window[fn] === 'function') await window[fn](...(ARGS[fn] || [])); }
      catch (e) { err = String((e && e.message) || e); }

      /* 이 섹션이 «무엇을» 담았나 — 클래스로 잰다(명부 아님). */
      const cls = new Set();
      sec.querySelectorAll('*').forEach(el => el.classList.forEach(c => {
        if (/-block$/.test(c) && c !== 'section-block') cls.add(c);
      }));
      /* ★«플로팅»인지를 «구조»로 판정한다 — 이름 명부가 아니다.
         정의: .section-block 직속이면서 .section-inner 가 «아닌» 콘텐츠 블록.
         (sticker/zoom/gradient 가 sec.appendChild 로 사는 자리. 네 번째가 생기면 자동으로 잡힌다.) */
      const floatEl = [...sec.children].find(c => c !== inner &&
        [...c.classList].some(x => x.endsWith('-block')));
      rows.push({ fn, err, classes: [...cls].sort(), secId: sec.id,
                  /* 흐름(section-inner) 안인가, 섹션 직속(플로팅)인가 — 순회가 보는 자리가 다르다 */
                  inFlow: inner.children.length > 0,
                  floating: !!floatEl,
                  floatDs: floatEl ? { x: floatEl.dataset.x, y: floatEl.dataset.y } : null,
                  made: sec.querySelectorAll('*').length > 1 });
    }

    /* ── ★순회 «자리»별 배치 — 한 자리만 재면 나머지 세 자리의 회귀를 못 본다 ──
       실측(2026-09-09): 블록을 row 직속에만 놓고 재면 «col 자식» 자리를 옛 손 명부로
       되돌리는 변이가 «초록»으로 지나간다. ⇒ 같은 블록을 세 자리에 각각 놓고 잰다.
         native = add fn 이 «스스로» 놓은 자리   col = row > col > 블록   frame = frame-block > 블록 */
    const SKIP = new Set(['frame-block', 'group-block', 'section-block']);
    const leafOf = (secEl) => [...secEl.querySelectorAll('*')]
      .find(el => [...el.classList].some(c => c.endsWith('-block')) &&
                  ![...el.classList].some(c => SKIP.has(c)));

    const arrange = (fn, i, kind, build) => {
      const src = leafOf(document.getElementById('sec_' + i));
      if (!src) return null;
      const sec = document.createElement('div');
      sec.className = 'section-block'; sec.id = `sec_${kind}_${i}`; sec.dataset.name = `${fn}@${kind}`;
      const inner = document.createElement('div');
      inner.className = 'section-inner'; inner.style.width = '860px';
      sec.appendChild(inner); canvas.appendChild(sec);
      build(inner, src.cloneNode(true));
      return { fn, kind, secId: sec.id };
    };
    const placed = [];
    for (let i = 0; i < FNS.length; i++) {
      const fn = FNS[i];
      placed.push(arrange(fn, i, 'col', (inner, clone) => {
        const row = document.createElement('div'); row.className = 'row';
        const col = document.createElement('div'); col.className = 'col'; col.dataset.width = '100';
        col.appendChild(clone); row.appendChild(col); inner.appendChild(row);
      }));
      placed.push(arrange(fn, i, 'frame', (inner, clone) => {
        const fb = document.createElement('div'); fb.className = 'frame-block';
        fb.dataset.width = '860'; fb.appendChild(clone); inner.appendChild(fb);
      }));
    }

    /* ★음성대조 — 플로팅의 style.left/top 을 «오염»시킨다.
       실물에서 이 값은 실제로 어긋난다: 섹션 간 드래그 뒤 dataset.y=114 인데 style.top=960
       (차이 846 = 그 섹션의 offsetTop) — 캔버스 절대 y 가 들어간다(zoom-block.js:227 실측).
       ⇒ dataset 이 단일 진실원이다. 오염시켜 두면 「style 에서 읽는」 변이가 «빨개진다».
       ⛔이게 없으면 sweep 안에서 dataset 과 style 이 같은 값이라 출처를 바꿔도 안 걸린다. */
    const POISON = 9999;
    for (const r of rows) {
      if (!r.floating) continue;
      const sec = document.getElementById(r.secId);
      const inner = sec.querySelector('.section-inner');
      [...sec.children].filter(c => c !== inner &&
        [...c.classList].some(x => x.endsWith('-block'))).forEach(el => {
          el.style.left = POISON + 'px'; el.style.top = POISON + 'px';
        });
    }

    /* ── 진짜 내보내기 — 살아 있는 채널 ── */
    const ps = { bg: '#eeeeee', padX: 0 };
    window.__state.pages = [{ canvas: canvas.innerHTML, pageSettings: ps }];
    window.__state.pageSettings = ps;
    let json = null, exportErr = null;
    try { json = window.buildFigmaExportJSON(null); } catch (e) { exportErr = String((e && e.stack) || e); }

    const bySec = {};
    if (json) for (const s of (json.sections || [])) bySec[s.id] = s;

    /* 「빈 껍데기」 = 섹션이 없다 / blocks 가 비었다 / blocks 가 {columns:[]} 뿐이다 */
    const isHollow = (s) => {
      if (!s) return true;
      const bs = s.blocks || [];
      if (!bs.length) return true;
      return bs.every(b => b && b.columns !== undefined && (b.columns || []).every(c => !(c.blocks || []).length));
    };
    for (const r of rows) {
      const s = bySec[r.secId];
      r.exported = !isHollow(s);
      r.kinds = s ? (s.blocks || []).map(b => b.type || '(빈껍데기)') : [];
      const fb = s && (s.blocks || []).find(b => b && b.floating);
      r.gotFloat = fb ? { floating: fb.floating, x: fb.x, y: fb.y } : null;
    }
    const arranged = placed.filter(Boolean).map(p => ({ ...p, exported: !isHollow(bySec[p.secId]) }));
    /* 「자리 옮기기」에 쓸 «콘텐츠 블록»이 아예 없던 add fn — 컨테이너만 만드는 것들이다. */
    const noLeaf = FNS.filter((fn, i) => !leafOf(document.getElementById('sec_' + i)));
    return { rows, arranged, noLeaf, exportErr, importErrs: window.__importErrs,
             sectionsInJson: json ? (json.sections || []).length : 0 };
  }, FNS);
}

/* ═════════════════════════════════════════════════════════════════════════ */

test('FX-1 ★앞끝 양성대조 — 이 실행이 정말 블록을 «만들었나» (본 단언의 전제)', async ({ page }) => {
  await boot(page);
  const { rows, arranged, exportErr, importErrs, sectionsInJson } = await sweep(page, ADD_FNS);

  console.log(`  분모(기계가 셈) window.add*Block = ${ADD_FNS.length} · 정의 파일 ${ADD_FILES.length}개`);
  console.log(`  블록을 실제로 만든 add fn = ${rows.filter(r => r.made).length}/${rows.length}`);
  console.log(`  JSON 안 섹션 = ${sectionsInJson}`);

  expect(importErrs, '★import 가 깨졌다 — 아래 측정은 전부 거짓이다').toEqual([]);
  expect(exportErr, '★내보내기 자체가 터졌다').toBeNull();

  // ① 분모가 «있다» — grep 이 0을 물어 오면 이 검사 전체가 공회전한다.
  expect(ADD_FNS.length, '★add*Block 을 하나도 못 찾았다 — 분모 grep 이 죽었다').toBeGreaterThan(30);

  // ② 이 실행에서 블록을 «실제로» 만들었다 (N > 0 이 아니라 N === 분모여야 한다)
  const notMade = rows.filter(r => !r.made);
  expect(notMade.map(r => `${r.fn}${r.err ? ' — ' + r.err : ' — (조용히 안 만듦)'}`),
    '★이 add fn 들이 아무것도 안 만들었다 — 하네스가 모자란 것이지 «통과»가 아니다').toEqual([]);

  // ③ 블록이 실린 섹션이 N/N — 만들긴 했는데 캔버스 밖이면 내보내기 측정이 무의미하다
  expect(rows.filter(r => r.made).length, '★블록이 실린 섹션이 분모와 다르다').toBe(ADD_FNS.length);
  expect(sectionsInJson, '★내보낸 JSON 의 섹션 수가 (native + col + frame) 배치 수와 다르다')
    .toBe(ADD_FNS.length + arranged.length);

  // ④ ★양성대조 본체 — text-block 이 «제대로» 나오나. 이게 0이면 자가 죽은 것이다.
  const t = rows.find(r => r.fn === 'addTextBlock');
  expect(t && t.exported, '★text-block 조차 안 나온다 — 자(측정도구)가 죽었다').toBe(true);
  expect(t.kinds, '★text-block 이 «빈 껍데기»로 나온다 — 양성대조 실패').toContain('text');
});

test('FX-2 ★본 단언 — add*Block 전수가 Figma 업로드에서 «빈 껍데기»가 아니다', async ({ page }) => {
  await boot(page);
  const { rows, arranged, noLeaf } = await sweep(page, ADD_FNS);

  /* ★자리를 옮길 «콘텐츠 블록»이 없는 add fn — 빈 컨테이너만 만든다.
     ⛔여기 이름이 늘면 그 종은 아래 자리별 검사를 «안 받고» 지나간다는 뜻이라 빨개진다. */
  expect(noLeaf, '★컨테이너만 만드는 add fn 목록이 바뀌었다 — 자리별 검사에서 빠지는 종이 생겼다')
    .toEqual(['addFrameBlock']);

  const made = rows.filter(r => r.made);
  expect(made.length, '★앞끝이 무너졌다 — FX-1 을 먼저 봐라').toBe(ADD_FNS.length);

  const dropped = made.filter(r => !r.exported).map(r => r.fn).sort();
  console.log(`  빠지는 종 = ${dropped.length}/${made.length}` + (dropped.length ? ` → ${dropped.join(' ')}` : ''));

  /* ⛔「빠지는 게 0」이 아니라 「알려진 셋과 정확히 같다」로 잰다.
     0으로 두면 지금 빨간 채라 못 쓰고, «이하»로 두면 새 블록이 빠져도 안 걸린다. */
  expect(dropped, [
    '★Figma 업로드에서 빠지는(빈 껍데기) 블록이 «알려진 셋»과 다르다.',
    '  늘었다면: 순회가 그 종을 못 본다 — _isContentBlock/_TRAVERSE_SKIP 을 봐라(export-figma-json.js).',
    '  줄었다면: 고쳐진 것이다 — KNOWN_DROPPED 에서 그 이름을 «지워라».',
  ].join('\n')).toEqual([...KNOWN_DROPPED].sort());

  /* ── ★순회 «네 자리»를 각각 잰다 ──
     실측(2026-09-09 변이 M1): 블록을 row 직속에만 놓고 재면, «col 자식» 자리를 옛 손 명부로
     되돌려도 이 검사가 «초록»으로 지난다. 자리마다 코드가 다르므로 자리마다 놓고 재야 한다.
     ★그리고 여기서는 KNOWN_DROPPED 도 예외가 아니다 — 플로팅 3종은 «자리»가 문제였을 뿐
       핸들러는 멀쩡하다는 뜻이라, col/frame 안에 넣으면 «전부» 나와야 한다. */
  for (const kind of ['col', 'frame']) {
    const here = arranged.filter(a => a.kind === kind);
    expect(here.length, `★${kind} 배치를 하나도 못 만들었다 — 앞끝이 죽었다`)
      .toBe(ADD_FNS.length - noLeaf.length);
    const gone = here.filter(a => !a.exported).map(a => a.fn).sort();
    expect(gone, [
      `★${kind} 자리(${kind === 'col' ? 'row > col > 블록' : 'frame-block > 블록'})에서 빠지는 블록이 있다.`,
      '  자리마다 순회 코드가 다르다 — 한 자리만 고치면 나머지가 조용히 샌다.',
      '  ⇒ 그 자리도 _blockChildren(성질)로 도는지 봐라.',
    ].join('\n')).toEqual([]);
    console.log(`  ${kind} 자리 = ${here.length - gone.length}/${here.length} 나옴`);
  }

  /* 알려진 셋이 «왜» 빠지는지도 잰다 — 이유가 바뀌면(흐름 안으로 들어왔는데도 빠지면)
     그건 다른 결함이므로 KNOWN_DROPPED 로 덮으면 안 된다. */
  for (const fn of KNOWN_DROPPED) {
    const r = rows.find(x => x.fn === fn);
    expect(r.inFlow, `★${fn} 이 이제 section-inner «흐름 안»에 있다 — 기제가 바뀌었다. ` +
      `명부 문제가 되었으니 KNOWN_DROPPED 로 덮지 말고 순회를 고쳐라`).toBe(false);
  }
});

test('FX-3 ★순회가 «성질»로 잡는다 — 손 명부로 되돌리는 변이를 막는다', async () => {
  const src = fs.readFileSync(FIGMA_SRC, 'utf8');

  /* buildFigmaExportJSON «안»만 본다 — 위쪽 exportFigmaJSON(파일 저장)은 죽은 채널이라
     아직 손 명부를 쓰고 있고, 그건 이 검사의 대상이 아니다. */
  const body = src.slice(src.indexOf('function buildFigmaExportJSON'));

  // ① 성질 판정이 «있다»
  expect(body, '★_isContentBlock 이 사라졌다 — 순회가 성질을 잃었다').toContain('function _isContentBlock');
  expect(body, '★성질 판정이 핸들러와 «같은» 기준(-block 으로 끝나는 클래스)을 안 쓴다')
    .toMatch(/_isContentBlock[\s\S]{0,400}endsWith\('-block'\)/);

  // ② ★손 명부로 되돌리는 변이 — 순회 자리에 «긴 -block 나열»이 다시 생기면 빨강.
  //    (`:scope > .a-block, :scope > .b-block, …` 3개 이상 나열 = 명부로의 회귀)
  const handLists = body.match(/:scope > \.[a-z0-9-]+-block(?:\s*,\s*:scope > \.[a-z0-9-]+-block){2,}/g) || [];
  expect(handLists, [
    '★순회가 «손으로 적은 명부»로 되돌아갔다. 그게 이 파일이 앓던 병이다 —',
    '  명부 네 벌이 서로 어긋나 38종 중 15종이 {"columns":[]} 로 나갔다(2026-09-09).',
    '  ⛔한 곳으로 «모으기»도 답이 아니다. 성질(_isContentBlock)로 잡고 명부는 «제외»에만 써라.',
  ].join('\n')).toEqual([]);

  // ③ ★제외가 «헐거워지는» 변이 — 아무거나 하나 더 넣으면 빨강.
  //    제외는 짧아야 하고, 한 줄마다 «왜»가 붙어야 한다.
  const skipSrc = body.slice(body.indexOf('_TRAVERSE_SKIP = {'));
  const skipBody = skipSrc.slice(0, skipSrc.indexOf('};'));
  const entries = [...skipBody.matchAll(/'([a-z0-9-]+-block)'\s*:\s*'([^']*)'/g)].map(m => [m[1], m[2]]);

  expect(entries.map(e => e[0]).sort(), [
    '★_TRAVERSE_SKIP(제외 목록)이 바뀌었다.',
    '  ⛔제외에 콘텐츠 블록을 넣으면 그 종은 내보내기에서 «조용히» 사라진다.',
    '  늘리려면: 왜 _block() 에 넘기면 «안 되는지» 한 줄로 적고, 이 기대도 같이 고쳐라.',
  ].join('\n')).toEqual(['annotation-block', 'frame-block', 'group-block', 'section-block']);
  /* annotation-block 은 «뿌리를 섹션 직속까지 넓히면서» 새로 필요해진 제외다.
     ⛔짐작이 아니다 — market-merge.js 의 normSection 이 .section-label·.variation-badge 와
       «같은 줄»에서 .annotation-block 을 지운다. 이 레포가 이미 「내용 아님」으로 판정한 것이다.
     그 근거가 사라지면 제외의 정당성도 사라지므로 여기서 같이 지킨다. */
  const mm = fs.readFileSync(path.join(REPO, 'js', 'market-merge.js'), 'utf8');
  expect(mm, '★market-merge normSection 이 annotation-block 을 더는 «내용 아님»으로 안 지운다 — ' +
    '그러면 순회에서 제외할 근거가 사라진다. 제외를 다시 판단해라').toContain('.annotation-block');

  // 각 제외에 «이유»가 실제로 붙어 있나 (빈 문자열로 형식만 맞추는 것을 막는다)
  for (const [cls, why] of entries)
    expect(why.length, `★제외 '${cls}' 에 이유가 없다 — 제외는 이유가 있을 때만 정당하다`).toBeGreaterThan(10);
});

/* ══ FX-4 — ★모드 B: 순회의 «뿌리». 셀렉터를 성질로 바꿔도 여기엔 닿지 않는다 ═════════
 * ★왜 따로인가 — 세 가지 병이 «다른» 병이라서다. 검사도 갈라야 어느 것이 깨졌는지 보인다:
 *     모드 A 셀렉터가 안 잡는다        → FX-2 의 col/frame 자리별 단언이 잡는다
 *     모드 C 핸들러가 null 을 낸다      → FX-2 의 native 단언이 잡는다
 *     ★모드 B 순회가 «보지도» 않는다   → 여기서 잡는다
 *   2026-09-09 실측: zoom·sticker·gradient 는 .section-block «직속»(absolute)이라
 *   `[...inner.children]` 만 도는 순회에겐 «방문 대상 자체»가 아니었다.
 *
 * ⛔셋을 이름으로 적지 않는다 — 분모를 «구조»로 센다(.section-inner 가 아닌 섹션 직속 블록).
 *   네 번째 플로팅 블록이 생기면 «자동으로» 이 검사의 분모에 들어온다. 그게 요점이다. */
test('FX-4 ★플로팅 블록(섹션 직속 absolute)이 좌표와 «함께» 나온다 — 순회 뿌리', async ({ page }) => {
  await boot(page);
  const { rows } = await sweep(page, ADD_FNS);

  /* 분모 — 기계가 «구조»로 센다. ⛔이름 목록이 아니다. */
  const floats = rows.filter(r => r.floating);
  console.log(`  플로팅(섹션 직속) = ${floats.length}종 → ${floats.map(r => r.fn).join(' ')}`);

  /* ★양성대조 — 이 실행이 플로팅을 «실제로» 만들었나. 0이면 아래 단언은 공회전이다. */
  expect(floats.length, '★플로팅 블록을 하나도 못 만들었다 — 분모가 0이면 아래는 아무 뜻이 없다. ' +
    '구조 판정(.section-inner 가 아닌 섹션 직속 블록)이 낡았는지 봐라').toBeGreaterThan(0);

  for (const r of floats) {
    // ① 빠지지 않는다
    expect(r.exported, `★${r.fn} 이 내보내기에서 빠진다. 순회 «뿌리»가 .section-inner 로 좁혀졌나 ` +
      `— 플로팅은 .section-block 직속이라 inner.children 만 돌면 안 보인다`).toBe(true);
    // ② ★좌표가 «같이» 실린다 — 노드만 나오고 위치가 없으면 제자리를 잃는다
    expect(r.gotFloat, `★${r.fn} 이 나오긴 하는데 floating 표시가 없다 — 위치 없이 흐름에 끼면 자리가 사라진다`)
      .not.toBeNull();
    const wx = parseFloat(r.floatDs.x), wy = parseFloat(r.floatDs.y);
    if (Number.isFinite(wx) && Number.isFinite(wy)) {
      expect({ x: r.gotFloat.x, y: r.gotFloat.y },
        `★${r.fn} 의 좌표가 dataset.x/y 와 다르다. ★출처는 dataset 이어야 한다 — ` +
        `style.left/top 에는 «캔버스 절대 y»가 들어가 있을 수 있다(zoom-block.js:227 실측)`)
        .toEqual({ x: wx, y: wy });
    }
  }
});
