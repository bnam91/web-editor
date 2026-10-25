/* save-strip-plus7-window.dom.spec.js
 *   ★★①측정 — `CAPTURE-ROSTER-NOT-DERIVED-FROM-SAVE-01` 을 ★파생으로 고치기 ★전에,
 *   ★★「저장 줄에만 있는 ＋7 이 ★정본에 들어가도 ★★계약을 깨지 않나」를 ★잰다. (2026-10-25 신설 · 지디)
 *
 * ★★왜 ★먼저 재나 — `editor-ui-roster.js` 머리말 ⛔계약 :
 *   「여기에 무언가 추가할 때는 ★`serializeProject` 가 ★★실제로 그걸 지우는지 ★먼저 확인하라.
 *     지우지 않는 것을 넣으면 ★«진짜 편집»이 저장되지 않는다 — ★★데이터 손실이다.」
 *   ★그 상수는 ★★`autoSaveObserver` 의 ★dirty 필터이기도 하다(`save-load.js:650·654`)
 *   ＋ ★`editor.js:1580` ⌘C 글자 뽑기도 쓴다.
 *   ⇒ ★★+7 이 들어가면 ★그 7 의 ★생성·제거가 ★「편집 아님」이 된다 ⇒ ★★행위로 재야 한다.
 *
 * ★★실측된 수 (★정의 자리에서 센 것 · 261025)
 *   저장 줄 ★36종 · 정본 ★29종 · ★`저장 ∖ 정본 = 7` · ★`정본 ∖ 저장 = 0` (정본은 ★진부분집합)
 *   ＋7 = .block-resize-handle .ci-handle .shape-handle .gradient-corner-handle
 *         .grad-line-overlay .vpen-preview .vpen-edit-overlay
 *
 * ★★★그리고 ★여기서 ★찾은 것 — ★★「창」이 ★갈린다
 *   ★`#canvas-scaler` ⊃ ★`#canvas` 이고 ★`getSerializedCanvas()` 는 ★★`#canvas` 창이다.
 *   ⇒ ★`.grad-line-overlay`(portal 길 · `#canvas-scaler` 자식) · `.vpen-edit-overlay`(`#ss-handles-overlay`)
 *     는 ★★어느 저장 창에도 ★담기지 ★않는다 ⇒ ★★그 「0건」은 ★★「해당 없음」이지 ★「지운다」가 아니다
 *   ⇒ ★★계약을 ★★충족할 수 ★없다 ⇒ ★★그 둘은 ★정본에 ★넣으면 ★안 된다.
 *   ⇒ ★★⇒ ★파생은 ★★「저장 줄 ★그대로」가 ★아니라 ★★「★창 안의 것만」이다.
 *
 * ⛔이 파일이 ★안 재는 것 (★이름을 붙인다)
 *   · `.grad-line-overlay`·`.vpen-preview`·`.vpen-edit-overlay` 를 ★★행위로 만들지 ★않았다
 *     (펜 도구·그라데 라인 입구가 길다) ⇒ ★부모는 ★★소스에서 ★기계로 읽었다
 *     = `PLUS7-OVERLAYS-NOT-MADE-BY-BEHAVIOR-01`
 *   · ★죽은 이름 둘은 ★만들 수 ★없다 — ★그래서 ★「0건」을 ★★측정으로 쓰지 ★않는다
 *
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js save-strip-plus7-window
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { bootApp, ROOT } = require('./_root-harness.js');

const src = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

/** ★섹션을 ★앱 길로 하나 만들고 돌려준다. */
const newSection = async (page) => page.evaluate(async () => {
  const canvas = document.getElementById('canvas');
  canvas.querySelectorAll('.section-block').forEach(s => s.remove());
  await window.addSection();
  const sec = [...canvas.querySelectorAll('.section-block')].pop();
  if (!sec) return { fail: 'addSection 뒤에도 섹션이 없다' };
  if (!sec.id) sec.id = 'p7Sec';
  window.selectSection(sec);
  return { id: sec.id };
});

/** ★네 창에서 ★그 선택자를 ★센다. ⛔하나라도 빼면 「0건」이 「안 봤다」가 된다. */
const fourWindows = async (page, sel) => page.evaluate((sel) => {
  const sec = document.querySelector('#canvas .section-block');
  if (!sec) return { fail: '섹션이 없다' };
  const bare = sel.replace(/^\./, '');
  const ser = window.serializeSectionClone ? String(window.serializeSectionClone(sec)) : '';
  const clone = sec.cloneNode(true);
  if (window.__cap?.stripEditorOnlyForCapture) window.__cap.stripEditorOnlyForCapture(clone);
  window.flushCurrentPage?.();
  const saved = window.getSerializedCanvas
    ? String(window.getSerializedCanvas())
    : document.getElementById('canvas').innerHTML;
  const re = new RegExp(bare, 'g');
  return {
    live: document.querySelectorAll(sel).length,
    liveInSection: sec.querySelectorAll(sel).length,
    inSectionClone: (ser.match(re) || []).length,
    inCaptureClone: clone.querySelectorAll(sel).length,
    inProjectSave: (saved.match(re) || []).length,
    /* ★★양성대조 — ★섹션 자체는 ★남아야 한다(⛔「다 지워서 0」이 아니다) */
    secKept: (saved.match(/section-block/g) || []).length,
  };
}, sel);

test('W0 ★전제 — ★하네스에 ★캡처 겹이 ★올라와 있고 ★네 창이 ★다 돈다', async ({ page }) => {
  await bootApp(page);
  await page.evaluate(async () => { window.__cap = await import('/js/io/capture-safety.js'); });
  const s = await newSection(page);
  expect(s.fail, `★전제: ${s.fail}`).toBeUndefined();
  const r = await fourWindows(page, '.section-block');
  expect(r.fail).toBeUndefined();
  console.log('[W0]', JSON.stringify(r));
  /* ★네 창이 ★다 «무언가»를 본다 — ⛔안 그러면 아래 「0」이 전부 거짓이다 */
  expect(r.live, '★라이브에 섹션이 없다').toBeGreaterThan(0);
  expect(r.inSectionClone, '★serializeSectionClone 이 빈 문자열을 준다 — 그 창이 죽었다').toBeGreaterThan(0);
  expect(r.inProjectSave, '★getSerializedCanvas 가 섹션을 안 담는다 — 그 창이 죽었다').toBeGreaterThan(0);
});

/** ★★★만들기 ＋ ★네 창 측정을 ★★«한 동기 블록»에서 한다.
    ⛔사이에 ★await 를 ★넣으면 ★`MutationObserver` 가 ★손잡이를 ★`#ss-handles-overlay` 로
      ★옮겨(탈출) ★섹션 밖이 되고, ★그러면 ★네 창의 ★「0」이 ★★«안 봤다»가 된다.
    ★261025 에 ★내가 ★그 거짓 초록을 ★★실제로 받았다(`W2` 가 `liveInSection 0` 인데 초록).
      ⇒ ★`D7-1` 과 ★같은 처방이다. ★그래서 ★`liveInSection` 을 ★★전제로 ★단언한다. */
const makeAndMeasure = async (page, kind, sel) => page.evaluate(async ([kind, sel]) => {
  const m = await import('/js/io/capture-safety.js');   /* ★await 를 ★먼저 끝낸다 */
  const canvas = document.getElementById('canvas');
  canvas.querySelectorAll('.section-block').forEach(s => s.remove());
  await window.addSection();
  const sec = [...canvas.querySelectorAll('.section-block')].pop();
  if (!sec) return { fail: 'addSection 뒤에도 섹션이 없다' };
  window.selectSection(sec);

  /* ── ★여기서부터 ★★await 0 — ★탈출이 ★끼지 못한다 ── */
  let made = 0;
  if (kind === 'shape') {
    if (typeof window.addShapeBlock !== 'function') return { fail: 'addShapeBlock 없음' };
    /* ★★`addShapeBlock` 은 ★반환값이 ★없다(261025 실측) — ★★끝에서 `selectShapeBlock` 을 ★이미 부른다
       ⇒ ★DOM 에서 찾는다. ⛔반환값을 쓰면 ★전제가 ★헛돈다. */
    window.addShapeBlock();
    const b = sec.querySelector('.shape-block');
    if (!b) return { fail: 'addShapeBlock 뒤에 .shape-block 이 없다' };
    made = b.querySelectorAll(':scope > .shape-handle').length;
  } else {
    const b = window.addGradientBlock?.();
    if (!b) return { fail: 'addGradientBlock 이 블럭을 안 돌려준다' };
    window._selectGradient(b);
    made = b.querySelectorAll(':scope > .gradient-corner-handle').length;
  }
  const bare = sel.replace(/^\./, '');
  const re = new RegExp(bare, 'g');
  const liveInSection = sec.querySelectorAll(sel).length;
  const ser = String(window.serializeSectionClone(sec));
  const clone = sec.cloneNode(true);
  const inCloneBefore = clone.querySelectorAll(sel).length;
  m.stripEditorOnlyForCapture(clone);
  window.flushCurrentPage?.();
  const saved = String(window.getSerializedCanvas());
  /* ── ★동기 블록 끝 ── */
  return {
    made, liveInSection,
    inSectionClone: (ser.match(re) || []).length,
    inCloneBefore,
    inCaptureClone: clone.querySelectorAll(sel).length,
    inProjectSave: (saved.match(re) || []).length,
    secKept: (saved.match(/section-block/g) || []).length,
  };
}, [kind, sel]);

for (const [name, kind, sel] of [
  ['W1', 'shape',    '.shape-handle'],
  ['W2', 'gradient', '.gradient-corner-handle'],
]) {
  test(`${name} ★\`${sel}\` — ★앱 길로 만들고 ★★같은 동기 블록에서 ★네 창을 ★센다`, async ({ page }) => {
    await bootApp(page);
    const r = await makeAndMeasure(page, kind, sel);
    expect(r.fail, `★전제: ${r.fail}`).toBeUndefined();
    console.log(`[${name}]`, JSON.stringify(r));

    /* ★★앞끝 양성대조 ★둘 — ⛔하나라도 0 이면 아래 「0」은 ★«안 재고 있다»다 */
    expect(r.made, '★손잡이가 블럭 자식으로 안 생겼다').toBe(4);
    expect(r.liveInSection, '★★손잡이가 ★섹션 안에 없다 — ★이미 탈출했다 ⇒ 아래 「0」은 «안 봤다»다').toBe(4);
    expect(r.inCloneBefore, '★clone 에 손잡이가 안 담겼다 — 창이 틀렸다').toBe(4);
    expect(r.secKept, '★섹션이 저장본에서 사라졌다 — 너무 많이 지웠다').toBeGreaterThan(0);

    /* ★★★계약 측정 — ★저장 ★두 창에서 ★0 이어야 ★★정본에 ★넣을 수 있다 */
    expect(r.inSectionClone, `★${sel} 가 ★섹션 저장본에 ★남는다 (${r.inSectionClone}) — ★정본에 넣으면 ★데이터 손실`).toBe(0);
    expect(r.inProjectSave, `★${sel} 가 ★프로젝트 저장본에 ★남는다 (${r.inProjectSave}) — ★정본에 넣으면 ★데이터 손실`).toBe(0);
    /* ★캡처에는 ★남는다(★고치기 전) — ★수만 찍는다 */
    console.log(`[${name}-capture]`, r.inCaptureClone);
  });
}

test('W3 ★★★창 판정 — ★`#canvas-scaler` 는 ★`#canvas` ★밖이다 (★행위로)', async ({ page }) => {
  await bootApp(page);
  const r = await page.evaluate(() => {
    const canvas = document.getElementById('canvas');
    const scaler = document.getElementById('canvas-scaler');
    const ovl = document.getElementById('ss-handles-overlay');
    return {
      hasCanvas: !!canvas, hasScaler: !!scaler, hasOverlay: !!ovl,
      scalerInsideCanvas: !!(canvas && scaler && canvas.contains(scaler)),
      canvasInsideScaler: !!(canvas && scaler && scaler.contains(canvas)),
      overlayInsideCanvas: !!(canvas && ovl && canvas.contains(ovl)),
    };
  });
  console.log('[W3]', JSON.stringify(r));
  expect(r.hasCanvas && r.hasScaler && r.hasOverlay, '★전제: 세 노드가 다 있어야 한다').toBe(true);
  /* ★★★이것이 ★①측정의 ★핵심 — ★저장 창(`#canvas`) ★밖에 ★사는 것은 ★계약을 ★충족할 수 없다 */
  expect(r.canvasInsideScaler, '★#canvas 가 #canvas-scaler 안이 아니다 — 창 모형이 틀렸다').toBe(true);
  expect(r.scalerInsideCanvas, '★#canvas-scaler 가 #canvas 안이다 — 그러면 portal 도 저장된다').toBe(false);
  expect(r.overlayInsideCanvas, '★#ss-handles-overlay 가 #canvas 안이다 — 창 모형이 틀렸다').toBe(false);
});

test('W4 ★★+7 의 ★창을 ★소스에서 ★기계로 읽는다 — ★누가 ★어디에 ★붙나', () => {
  /* ⛔행위로 안 만든 셋은 ★여기서 ★부모를 읽는다 = `PLUS7-OVERLAYS-NOT-MADE-BY-BEHAVIOR-01` */
  const WHO = {
    '.shape-handle':            ['js/block-drag.js',            /className = `shape-handle \$\{dir\}`/],
    '.gradient-corner-handle':  ['js/gradient-select.js',       /el\.className = 'gradient-corner-handle'/],
    '.grad-line-overlay':       ['js/gradient-line-overlay.js', /overlay\.className = 'grad-line-overlay'/],
    '.vpen-preview':            ['js/pen-tool.js',              /wrap\.className = 'vpen-preview'/],
    '.vpen-edit-overlay':       ['js/pen-tool.js',              /wrap\.className = 'vpen-edit-overlay'/],
  };
  const seen = {};
  for (const [sel, [file, re]] of Object.entries(WHO)) {
    const code = src(file);
    const m = re.exec(code);
    expect(m, `★${sel} 를 만드는 줄을 ${file} 에서 못 찾았다 — 이름이 바뀌었나`).not.toBeNull();
    /* ★그 줄 뒤 ★40줄 안의 ★첫 appendChild 대상 */
    const after = code.slice(m.index, m.index + 2000);
    const ap = /(\w+)\.appendChild\(\s*(?:wrap|overlay|h|el|portal)\s*\)/.exec(after);
    seen[sel] = ap ? ap[1] : '(못 읽음)';
  }
  console.log('[W4]', JSON.stringify(seen));
  /* ★★저장 창(`#canvas`) ★안에 ★붙는 것 = ★정본에 ★넣을 수 있다 */
  expect(seen['.shape-handle'], '★.shape-handle 의 부모가 block 이 아니다').toBe('block');
  expect(seen['.gradient-corner-handle'], '★부모가 block 이 아니다').toBe('block');
  expect(seen['.vpen-preview'], '★부모가 sec 이 아니다').toBe('sec');
  /* ★★★저장 창 ★밖 — ★★계약을 ★충족할 수 ★없다 */
  /* ★★261025 ★정정 — ★내가 `host` 라 ★적었으나 ★★측정값은 `portal` 이다.
     ★소스 순서 : `portal.appendChild(overlay)` ★먼저 → `host.appendChild(portal)` ★다음.
     ⇒ ★★overlay 의 ★직접 부모는 ★`portal` 이고, ★그 portal 이 ★`host`(= `#canvas-scaler`)에 붙는다.
     ⇒ ★★어느 쪽이든 ★★`#canvas` ★밖이다(★`W3` 가 그것을 ★행위로 쟀다).
     ⛔★내 산문이 ★측정값을 ★이기지 않게 ★단언을 ★측정값으로 ★맞춘다. */
  expect(seen['.grad-line-overlay'], '★.grad-line-overlay 의 직접 부모가 portal 이 아니다').toBe('portal');
  /* ★★그 portal 이 ★`host`(#canvas-scaler)에 붙는지 — ★★거기까지 가야 ★「저장 창 밖」이 선다 */
  const glo = src('js/gradient-line-overlay.js');
  expect(/host\.appendChild\(portal\)/.test(glo),
    '★portal 을 host 에 붙이는 줄이 사라졌다 — 창 판정의 근거가 죽었다').toBe(true);
  expect(/const HOST_SELECTOR = '#canvas-scaler'/.test(glo),
    "★HOST_SELECTOR 가 '#canvas-scaler' 가 아니다 — 창이 바뀌었다").toBe(true);
  expect(seen['.vpen-edit-overlay'], '★.vpen-edit-overlay 의 부모가 overlay 가 아니다').toBe('overlay');
});

test('W5 ★★죽은 이름 둘 — ★만드는 자가 ★0 이다 (`DEAD-SELECTORS-IN-SAVE-STRIP-01`)', () => {
  const FILES = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(path.join(ROOT, d), { withFileTypes: true })) {
      const p = `${d}/${e.name}`;
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.js')) FILES.push(p);
    }
  };
  walk('js');
  expect(FILES.length, '★js 파일을 하나도 못 읽었다 — 아래 0 은 「안 봤다」다').toBeGreaterThan(50);
  const count = (name) => FILES.reduce((n, f) => {
    const c = src(f);
    const re = new RegExp(`className\\s*=\\s*['"\`][^'"\`]*${name}|classList\\.add\\(['"\`]${name}`, 'g');
    return n + (c.match(re) || []).length;
  }, 0);
  const dead = { '.block-resize-handle': count('block-resize-handle'), '.ci-handle': count('ci-handle') };
  /* ★★양성대조 — ★살아 있는 것은 ★0 이 ★아니어야 한다(★이 자가 ★헛돌지 않음) */
  const alive = { '.shape-handle': count('shape-handle'), '.gradient-corner-handle': count('gradient-corner-handle') };
  console.log('[W5]', JSON.stringify({ dead, alive, files: FILES.length }));
  expect(alive['.shape-handle'], '★살아 있는 것도 0 이다 — 이 자가 헛돌았다').toBeGreaterThan(0);
  expect(alive['.gradient-corner-handle'], '★살아 있는 것도 0 이다 — 이 자가 헛돌았다').toBeGreaterThan(0);
  /* ★★★죽은 이름 — ★만드는 자 0 ⇒ ★저장 줄에 ★있어도 ★아무것도 안 지운다 */
  expect(dead['.block-resize-handle'], '★.block-resize-handle 을 만드는 자가 생겼다 — 죽은 이름이 아니다').toBe(0);
  expect(dead['.ci-handle'], '★.ci-handle 을 만드는 자가 생겼다 — 죽은 이름이 아니다').toBe(0);
});
