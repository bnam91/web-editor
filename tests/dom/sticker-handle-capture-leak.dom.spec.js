/* sticker-handle-capture-leak.dom.spec.js — ★스티커를 ★고른 채 ★내보내면 ★손잡이가 ★박힌다.
 *   ★이름 = `STICKER-HANDLE-BAKED-IN-CAPTURE-01` (2026-10-24 신설 · ★적대적 ⒠ C5 가 지목)
 *
 * ★★찾은 이 = ★적대적 검수 ⒠(수지맥 · 읽기만) — ★소스로 ★지목했다.
 *   ★★그 보고를 ★그대로 ★받지 ★않았다 — ★네 자리를 ★내가 ★다시 셌고, ★★행위로 ★수를 ★냈다 :
 *     스티커(rect)   라이브 ★4 · 저장 ★0 · ★★캡처 클론 ★★4
 *     선 스티커(hlb) 라이브 ★3 · 저장 ★0 · ★★캡처 클론 ★★3
 *   ⇒ ★저장은 ★막고 ★캡처는 ★안 막는다 = ★★«두 명부가 ★갈린» 그 병이다.
 *
 * ★★보고가 ★맞았고 ★★내 ★의심이 ★틀린 칸도 ★적는다 :
 *   나는 「`capture-safety.js:504` 가 ★루트의 `.selected` 만 걷으니 ★도형 손잡이도 샐 것」이라 ★의심했다.
 *   ★실측 : 캡처 클론의 `.selected` = ★★0 (`capSel: 0`) ⇒ `.shape-handle` 은 ★꺼진다 ⇒ ★도형은 ★안전.
 *   ★`capture-safety.js:442` 의 「블록의 .selected 는 하나도 안 걷었다」는 ★★«역사 문장»이었다.
 *
 * ★★⛔이 검사가 ★안 재는 것
 *   · ★도형(`.shape-handle`) 누수 — ★내 장면에서 `selectShapeBlock` 이 ★손잡이를 ★0 개 만들었다
 *     ⇒ ★★«0 은 ★안 잰 것»이다. ★도형 축은 ★★미측정으로 ★남긴다.
 *   · ★실제 PNG 픽셀에 ★박히나 — ★이 하네스는 ★클론까지만 본다(★태양 ⒜ 몫).
 *
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js sticker-handle-capture-leak
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { ROOT, bootApp } = require('./_root-harness.js');

const H_SEL = '.sticker-corner-handle, .hlb-handle';

/** 스티커 하나를 ★앱 함수로 만들고 ★고른다. */
async function scene(page, shape) {
  return await page.evaluate(async (shape) => {
    for (const k of ['pushHistory', 'markDirty', 'scheduleAutoSave', 'updateLayerPanel', 'buildLayerPanel', 'showToast', 'deselectAll'])
      if (typeof window[k] !== 'function') window[k] = () => {};
    const cap = await import('/js/io/capture-safety.js');
    window.__cap = cap;
    await window.addSection();
    const sec = [...document.querySelectorAll('#canvas .section-block')].pop();
    sec.id = 'stkSec';
    window.getSelectedSection = () => sec; window._activeFrame = null;
    window.addStickerBlock?.({ shape });
    const el = [...sec.querySelectorAll('.sticker-block')].pop();
    if (!el) return { fail: '스티커가 안 만들어졌다' };
    window.selectBlock?.(el.id);
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    return { id: el.id, selected: el.classList.contains('selected') };
  }, shape);
}

/** 라이브 · 저장 · 캡처 셋을 ★한 번에 센다. */
async function counts(page) {
  return await page.evaluate((sel) => {
    const sec = document.getElementById('stkSec');
    const live = sec.querySelectorAll(sel).length;
    const ser = window.serializeSectionClone ? window.serializeSectionClone(sec) : '';
    const clone = sec.cloneNode(true);
    window.__cap.stripEditorOnlyForCapture(clone);
    return {
      live,
      ser: (ser.match(/sticker-corner-handle|hlb-handle/g) || []).length,
      cap: clone.querySelectorAll(sel).length,
      capSelected: clone.querySelectorAll('.selected').length,
    };
  }, H_SEL);
}

test('K0 ★전제 — 두 이름이 ★요소 명부 ★상수와 ★저장 정본 ★제거 줄 ★둘 다에 있다 (★계약)', () => {
  const roster = fs.readFileSync(path.join(ROOT, 'js', 'io', 'editor-ui-roster.js'), 'utf8');
  const serial = fs.readFileSync(path.join(ROOT, 'js', 'io', 'section-serialize.js'), 'utf8');

  /* ★★★⛔파일 ★전체로 ★재면 ★안 된다 — ★261024 에 ★★또 ★밟았다(★오늘 ★세 번째).
     ★내가 ★바로 ★위 ★주석에 `.sticker-corner-handle` 이라 ★적었더니 ★`toContain` 이 ★★참이 되어
     ★★명부에서 ★두 줄을 ★뺀 ★변이 판에서도 ★이 칸이 ★★초록이었다(K1·K2 만 빨강).
     ⇒ ★자를 ★★«그 한 줄»로 ★좁힌다. ★`NON_CONTENT_UI_SELECTOR` 상수의 ★대입 줄만 ★본다.
     ★같은 병의 ★앞선 얼굴 : 261007 주석→소스 파싱 게이트 · 261024 figma FX-3. */
  const rosterLine = roster.split('\n').find(l => /^\s*'\.[a-z]/.test(l) && l.includes('rotate-zone'));
  expect(rosterLine, '★NON_CONTENT_UI_SELECTOR 의 대입 줄을 못 찾았다 — 이 검사의 자가 낡았다').toBeTruthy();
  const serialLines = serial.split('\n').filter(l => /querySelectorAll\(/.test(l) && l.includes('remove'));
  expect(serialLines.length, '★저장 정본의 제거 줄을 못 찾았다 — 자가 낡았다').toBeGreaterThan(0);
  const serialJoined = serialLines.join('\n');

  for (const cls of ['.sticker-corner-handle', '.hlb-handle']) {
    expect(rosterLine, `★요소 명부 ★상수 줄에 ${cls} 가 없다 (★주석에만 있는 것은 ★안 센다)`).toContain(cls);
    expect(serialJoined, `★저장 정본의 ★제거 줄에 ${cls} 가 없다 — ★명부의 ⛔계약이 깨진다(데이터 손실 쪽)`).toContain(cls);
  }
  /* ★★음성대조 — ★아무 이름이나 ★들어 있는 것이 ★아니다(★자가 헛돌면 ★둘 다 참이 된다) */
  expect(rosterLine, '★없는 이름이 명부 줄에 있다 — 이 검사의 자가 헛돈다').not.toContain('.zz-not-a-handle');
  expect(rosterLine.length, '★명부 줄이 너무 짧다 — 엉뚱한 줄을 집었다').toBeGreaterThan(100);
});

test('K1 ★★스티커를 고른 채 — ★캡처 클론에 손잡이가 ★0 (★전엔 4였다)', async ({ page }) => {
  const errs = await bootApp(page);
  const s = await scene(page, 'rect');
  expect(s.fail).toBeUndefined();
  expect(s.selected, '★전제: 스티커가 안 골라졌다 — 손잡이가 애초에 안 뜬다').toBe(true);
  const c = await counts(page);
  console.log('[K1]', JSON.stringify(c));

  /* ★★앞끝 양성대조 — ★라이브에 ★손잡이가 ★떠 있어야 ★「캡처에 0」이 ★의미를 가진다.
     ⛔없으면 ★「아무것도 안 만들었다」와 ★구분이 ★안 된다(★261024 에 그 병을 세 번 밟았다). */
  expect(c.live, '★라이브에 손잡이가 안 떴다 — 아래 「캡처 0」은 «안 재고 있다»다').toBeGreaterThan(0);

  expect(c.cap, `★캡처 클론에 손잡이가 ${c.cap} 개 남았다 — 고른 채 내보내면 박힌다`).toBe(0);
  expect(c.ser, '★저장본에 손잡이가 남았다 — 저장 쪽 명부가 깨졌다').toBe(0);
});

test('K2 ★★선 스티커(highlightB) — ★끝점 손잡이도 ★캡처에 ★0 (★전엔 3이었다)', async ({ page }) => {
  await bootApp(page);
  const s = await scene(page, 'highlightB');
  expect(s.fail).toBeUndefined();
  const c = await counts(page);
  console.log('[K2]', JSON.stringify(c));
  expect(c.live, '★라이브에 끝점 손잡이가 안 떴다 — 아래 0 은 «안 재고 있다»다').toBeGreaterThan(0);
  expect(c.cap, `★캡처 클론에 ${c.cap} 개 남았다`).toBe(0);
  expect(c.ser, '★저장본에 남았다').toBe(0);
});

test('K3 ★`.shape-handle` 은 ★왜 안 샜나 — ★캡처 클론의 `.selected` 가 ★0 이다(★대조의 근거)', async ({ page }) => {
  await bootApp(page);
  const s = await scene(page, 'rect');
  expect(s.fail).toBeUndefined();
  const c = await counts(page);
  /* ★★이 값이 ★0 이 ★아니게 되면 — `.shape-handle` 처럼 ★«.selected 로만 켜지는» 것들이
     ★★전부 ★캡처에 ★보이기 ★시작한다. ⇒ ★그 날 ★이 칸이 ★빨개져야 ★한다. */
  expect(c.capSelected,
    `★캡처 클론에 .selected 가 ${c.capSelected} 개 남았다 — ★«.selected 로만 켜지는» UI 가 전부 샌다. ` +
    'js/io/capture-safety.js 가 블록의 .selected 를 더는 안 걷는다는 뜻이다').toBe(0);
});
