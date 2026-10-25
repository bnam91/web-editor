/* annot-point-angle-leak.dom.spec.js
 *   ★★`ANNOT-POINT-ANGLE-BAKED-IN-SAVE-01` — ★어노테이션 점 손잡이를 ★끌는 ★동안 뜨는
 *   ★★각도 글자(`37.5°`)가 ★저장본·캡처에 ★실렸다. (2026-10-24 신설 · ★적대적 ⒠ ★⒟5)
 *
 * ★★찾은 이 = 적대적 검수 ⒠(수지맥 · 읽기만) ★⒟5 — 「★어느 저장 목록에도 ★없다 … ★안 잼」
 *   ⇒ ★★수는 ★내가 쟀다(261024 · 판 `c14b9679`) :
 *     라이브 ★1 · ★저장(serializeSectionClone) ★★1 · ★캡처 클론 ★★1 · ★프로젝트 저장 ★★1
 *     ★그리고 ★글자(`37.5°`)까지 ★저장본 문자열에 ★들어갔다.
 *
 * ★★왜 ★이제 ★문제인가 — ★★덮어 주던 것이 ★사라졌다
 *   ★`.annot-point-angle` 은 ★`.annot-svg` ★안에 산다. ★261022 결정으로 ★어노테이션이
 *   ★★«저장되는 것»이 됐다 ⇒ ★그 안의 ★이 글자도 ★같이 저장된다.
 *   ★전에는 ★어노가 ★통째로 걷혀 ★이 글자도 ★안 보였다.
 *   ⇒ ★★「★막아둔 ★까닭이 ★먼저 죽고 ★문만 남는다」의 ★거울상이다.
 *
 * ★★고침은 ★계약 ★순서를 ★지켰다
 *   ⒜ ★먼저 `js/io/section-serialize.js` 의 ★제거 줄(저장 정본)에 넣고
 *   ⒝ ★그 다음 `js/io/editor-ui-roster.js` ★요소 명부에 올렸다
 *   ⇒ ★그 명부 머리말의 ⛔「serializeProject 가 ★실제로 지우는지 ★먼저 확인」이 ★섰다.
 *     ⛔거꾸로 하면 ★「진짜 편집이 ★저장되지 않는다」 = ★데이터 손실 쪽으로 ★넘어간다.
 *
 * ⛔★이 파일이 ★안 재는 것
 *   · ★실제로 ★1.5s 자동저장이 ★끌기 중에 ★끼는가 — ★★안 쟀다(★타이밍 축 · 태양 ⒜ 몫)
 *     ★여기서는 ★그 글자가 ★«있는 상태»를 ★만들어 ★세 출구를 ★잰다.
 *   · ★실 PNG 픽셀에 ★보이나 — ★클론까지만 본다
 *
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js annot-point-angle-leak
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { ROOT, bootApp } = require('./_root-harness.js');

/** 어노테이션 하나 ＋ ★각도 글자를 ★제 꼴로 심는다(★`_pointAngleLabel` 과 ★같은 식). */
async function scene(page) {
  return await page.evaluate(async () => {
    for (const k of ['pushHistory', 'markDirty', 'scheduleAutoSave', 'updateLayerPanel', 'buildLayerPanel', 'showToast', 'deselectAll'])
      if (typeof window[k] !== 'function') window[k] = () => {};
    const cap = await import('/js/io/capture-safety.js');
    window.__cap = cap;
    const canvas = document.getElementById('canvas');
    canvas.querySelectorAll('.section-block').forEach((s) => s.remove());
    await window.addSection();
    const sec = [...canvas.querySelectorAll('.section-block')].pop();
    sec.id = 'apaSec';
    window.getSelectedSection = () => sec; window._activeFrame = null;
    await window.addTextBlock('body');          /* ★양성대조용 ★본문 */
    const ann = window.makeAnnotationBlock({ points: [[20, 20], [160, 90]], text: 'APA' });
    sec.appendChild(ann);
    const svg = ann.querySelector('.annot-svg');
    if (!svg) return { fail: '.annot-svg 가 없다' };
    /* ★꼴을 ★`js/annotation-select.js:261~270` 에서 ★그대로 베꼈다 — ⛔손으로 짓지 않았다 */
    const lab = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    lab.setAttribute('class', 'annot-point-angle');
    lab.setAttribute('fill', '#1592fe');
    lab.setAttribute('text-anchor', 'middle');
    lab.textContent = '37.5°';
    svg.appendChild(lab);
    return { annId: ann.id, live: sec.querySelectorAll('.annot-point-angle').length };
  });
}

test('P0 ★전제 — 세 자리가 ★계약 순서대로 들어 있다(★저장 정본 ★먼저)', () => {
  const ser = fs.readFileSync(path.join(ROOT, 'js', 'io', 'section-serialize.js'), 'utf8');
  const ros = fs.readFileSync(path.join(ROOT, 'js', 'io', 'editor-ui-roster.js'), 'utf8');

  /* ★★자를 ★«그 한 줄»로 ★좁힌다 — ⛔파일 전체로 재면 ★내 산문이 ★입력이 된다
     (★261024 에 ★네 번 밟았다 : 261007 · figma FX-3 · 스티커 K0 · U2-SCOPE) */
  const serLine = ser.split('\n').find((l) => /querySelectorAll\(/.test(l) && l.includes('.img-rotate-zone') && l.includes('remove'));
  expect(serLine, '★저장 정본의 제거 줄을 못 찾았다 — 이 검사의 자가 낡았다').toBeTruthy();
  expect(serLine, '★저장 정본의 ★제거 줄에 `.annot-point-angle` 이 없다 — ★요소 명부의 ⛔계약이 깨진다')
    .toContain('.annot-point-angle');

  const rosLine = ros.split('\n').find((l) => /^\s*'\.[a-z]/.test(l) && l.includes('rotate-zone'));
  expect(rosLine, '★요소 명부 상수 줄을 못 찾았다 — 자가 낡았다').toBeTruthy();
  expect(rosLine, '★요소 명부 상수 줄에 `.annot-point-angle` 이 없다').toContain('.annot-point-angle');

  /* ★★음성대조 — ★자가 ★헛돌지 않는다 */
  expect(rosLine, '★없는 이름이 명부 줄에 있다 — 자가 헛돈다').not.toContain('.zz-no-such');
  expect(rosLine.length, '★명부 줄이 너무 짧다 — 엉뚱한 줄을 집었다').toBeGreaterThan(100);
});

test('P1 ★★각도 글자가 ★저장·캡처·프로젝트저장 ★셋에서 ★0 (★전엔 ★1/1/1 이었다)', async ({ page }) => {
  const errs = await bootApp(page);
  const s = await scene(page);
  expect(s.fail).toBeUndefined();

  /* ★★앞끝 양성대조 — ★라이브에 ★있어야 ★「0」이 ★의미를 가진다
     ⛔없으면 ★「아무것도 안 만들었다」와 ★구분이 ★안 된다(★261024 에 그 병을 ★세 번 밟았다) */
  expect(s.live, '★라이브에 각도 글자가 안 생겼다 — 아래 「0」은 «안 재고 있다»다').toBe(1);

  const r = await page.evaluate(() => {
    const sec = document.getElementById('apaSec');
    const ser = window.serializeSectionClone ? window.serializeSectionClone(sec) : '';
    const clone = sec.cloneNode(true);
    window.__cap.stripEditorOnlyForCapture(clone);
    window.flushCurrentPage();
    const saved = window.getSerializedCanvas ? window.getSerializedCanvas() : document.getElementById('canvas').innerHTML;
    return {
      inSectionClone: (ser.match(/annot-point-angle/g) || []).length,
      inCaptureClone: clone.querySelectorAll('.annot-point-angle').length,
      inProjectSave: (saved.match(/annot-point-angle/g) || []).length,
      degSaved: /37\.5°/.test(saved),
      /* ★★양성대조 ★둘 — ★어노 ★자체와 ★본문은 ★남아야 ★한다(⛔너무 많이 지운 것이 아니다) */
      annKept: (saved.match(/annotation-block/g) || []).length,
      bodyKept: /tb-body/.test(saved),
    };
  });
  console.log('[P1]', JSON.stringify(r));

  /* ★★양성대조 — ★어노와 ★본문은 ★살아 있다(⛔「다 지워서 0」이 아니다) */
  expect(r.annKept, '★어노테이션 자체가 저장본에서 사라졌다 — 너무 많이 지웠다').toBeGreaterThan(0);
  expect(r.bodyKept, '★본문이 저장본에서 사라졌다 — 너무 많이 지웠다').toBe(true);

  /* ★★★본 단언 — ★세 출구 ★전부 ★0 */
  expect({ ser: r.inSectionClone, cap: r.inCaptureClone, save: r.inProjectSave },
    '★각도 글자가 ★저장본·캡처에 ★실린다 — 끌기 중 자동저장이 끼면 `37.5°` 가 산출물에 박힌다')
    .toEqual({ ser: 0, cap: 0, save: 0 });
  expect(r.degSaved, '★`37.5°` 글자가 저장본 문자열에 남았다').toBe(false);

  expect(errs, `★앱 오류: ${errs.join(' | ')}`).toEqual([]);
});

/* ══ P2 — ★★⒟8 ★죽은 이름 ★둘을 ★수로 박는다 ════════════════════════════
   ★적대적 ⒠ ⒟8 : 「`.block-resize-handle`·`.ci-handle` — js/ 에서 만드는 곳을 못 찾았다 … ★확인 안 함」
   ⇒ ★★내가 ★전수로 쟀다(261024) : ★js 전체에서 ★`section-serialize.js:356` ★한 줄에만 등장 ·
     ★css ★0 · ★index.html ★0 ⇒ ★★«죽은 이름»이다(★지우는 명부에만 산다).
   ★★⛔그래도 ★지우지 ★않는다 — ★「★없다 ≠ ★지워짐」의 ★거울상으로 ★「★있다 ≠ ★산다」다.
     ★누가 ★그 이름으로 ★다시 만들 수도 있고, ★지우는 쪽에 ★남아 있어 ★해가 ★없다.
   ⇒ ★★수만 ★박아 ★명부에 올린다. ★이름 = `DEAD-SELECTORS-IN-SAVE-STRIP-01`
     ★이 칸이 ★빨개지면 = ★그 이름을 ★누가 ★쓰기 시작했거나 ★명부에서 ★지웠다 ⇒ ★그때 ★판정해라. */
test('P2 ★죽은 이름 둘 — ★만드는 곳이 ★0 이고 ★지우는 명부에만 ★산다(수로 박는다)', () => {
  const { stripCommentsTA } = require('../unit/_strip-comments.js');
  const files = ['js/io/section-serialize.js', 'js/io/editor-ui-roster.js', 'js/editor.js', 'js/annotation-select.js'];
  for (const name of ['block-resize-handle', 'ci-handle']) {
    /* ★만드는 자리 = `className`·`classList.add`·`setAttribute('class'`·`class="` — ★0 이어야 한다 */
    let makes = 0;
    for (const f of files) {
      const src = stripCommentsTA(fs.readFileSync(path.join(ROOT, f), 'utf8'));
      const re = new RegExp(`(className\\s*=\\s*['"\`][^'"\`]*${name}|classList\\.add\\([^)]*${name}|setAttribute\\(\\s*['"]class['"]\\s*,\\s*['"][^'"]*${name}|class="[^"]*${name})`, 'g');
      makes += (src.match(re) || []).length;
    }
    expect(makes, `★\`.${name}\` 을 ★만드는 자리가 ★생겼다(${makes}) — ★죽은 이름이 ★살아났다. 판정해라`).toBe(0);
    /* ★★그러나 ★지우는 명부에는 ★있다 — ★그게 ★「있다 ≠ 산다」의 ★증거다 */
    const ser = fs.readFileSync(path.join(ROOT, 'js', 'io', 'section-serialize.js'), 'utf8');
    expect(ser.includes(`.${name}`), `★\`.${name}\` 이 ★저장 제거 명부에서 ★사라졌다 — 되살아날 때를 못 막는다`).toBe(true);
  }
});
