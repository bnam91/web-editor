/* ft-tfw0-restore-loss.dom.spec.js — ★자유변형을 ★저장→다시 열기→✕ 하면 ★프레임 폭이 ★영영 사라졌다.
 *   ★이름 = `FT-TFW0-LOST-ON-RESTORE-01` (2026-10-24 신설 · ★적대적 ⒠ C2 가 소스로 지목 · ★나는 행위로 쟀다)
 *
 * ★★무엇이었나 (★고치기 전 ★실측 3/3 · 판 `5f845727`)
 *   폭 300px 짜리 글상자 → 자유변형 켜고 넓히기(box 400) → ★저장 → ★다시 열기 → ★효과 ✕
 *   ⇒ ★tf 폭이 ★★`400px` 로 ★굳는다. ★사용자가 정한 ★300 이 ★영영 사라진다.
 *   ★복원 직후 tf 폭 = ★338.344px (★저장본 400 과도 ★다르다 — ★적대적 ⒠ ★C3 가 말한 「다른 폭에서 잼」의 ★수)
 *
 * ★★뿌리 : `ftMeasure` 의 ★`tfW0`(켜기 «전» 폭)가 ★★WeakMap 에만 산다 ⇒ ★다시 열면 ★비어 있다.
 *   옛 줄 `st.tfW0 = ktf` 의 ★`ktf` = ★«지금 tf 폭» = ★복원 뒤엔 ★★저장된 ★box 폭이다.
 *   ⇒ `_strip`(✕)이 ★그 값으로 ★「되돌린다」.
 * ★★방아쇠 : 복원 뒤 ★`watchAllFx` → `ftMeasure`.
 *   ⛔★261024 에 ★내가 `rebindAll` 에 더한 `watchAllFx` 한 줄이 ★그 경로를 ★★늘렸다
 *     (★복원·페이지 전환·undo/redo). ★단 `effects-registry.js:136` 의 ★`load` 가 ★원래도 불렀으므로
 *     ★「내 줄이 ★유일 원인」은 ★★거짓이다 — ★늘어난 것은 ★★«경로의 수»다.
 *
 * ★★★내가 ★한 번 ★판정을 ★틀렸다 — ★여기 적어 둔다
 *   첫 측정에서 ★「저장 전 ✕ → `''` 이니 ★정상」이라 읽었다. ★★둘 다 틀렸다 :
 *     ⒜ `''` 는 ★「원래로」가 ★아니라 ★「지정 없음」이다 — ★inline 만 보면 ★판정을 못 한다 ⇒ ★★computed 로 재라.
 *     ⒝ ★그 `''` 자체가 ★★내 ★장면의 흠이었다 — ★장면이 켜기 ★전에 `setFxFreeTransform(tb, null)` 을
 *        ★초기화로 불러 ★`_strip` 이 ★tf 폭을 ★미리 ★지워 버렸다.
 *     ★핀 판에서 ★그 줄 없이 다시 재니 ★「저장 전 ✕」는 ★★`300px`(computed 300) = ★정상이었다.
 *   ⇒ ★★이 파일은 ★★inline ★과 ★computed 를 ★★둘 다 ★잰다.
 *
 * ⛔★이 파일이 ★안 재는 것
 *   · ★`load` 리스너만 있던 ★옛 판에서도 손실이 나나 — ★★미측정(★load 는 이미 지나간 뒤다)
 *   · ★`.row` 갈래(tf 가 아니라 row 가 폭을 든 꼴) — ★`_tfOf` 는 tf 만 본다 ⇒ ★안 쟀다
 *   · ★`js-structure.md:23` 「프레임과 안쪽 블럭은 항상 같은 너비」가 ★실제로 깨지나 — ★안 쟀다
 *   · ★★`FT-TFW0-NOT-PERSISTED-01` — ★사용자가 ★패널 ★밖의 길로 폭을 정한 경우 ★`'100%'` 추정이 ★틀린다.
 *     ★근본 고침(켤 때 tfW0 를 ★데이터로 남기기)은 ★저장 꼴을 바꿔 ★분모가 넓어 ★안 골랐다. ★0.9.9 후보.
 *
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js ft-tfw0-restore-loss
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { ROOT, bootApp } = require('./_root-harness.js');

/** 경로 하나를 돌린다 — `setW`(패널로 폭을 정했나) × `restore`(저장→다시 열기를 했나). */
async function run(page, setW, restore, corners) {
  return await page.evaluate(async ({ setW, restore, corners }) => {
    for (const k of ['pushHistory', 'markDirty', 'scheduleAutoSave', 'updateLayerPanel', 'buildLayerPanel', 'showToast', 'deselectAll'])
      if (typeof window[k] !== 'function') window[k] = () => {};
    const ft = await import('/js/effects-freetransform.js');
    const canvas = document.getElementById('canvas');
    const cw = (el) => Math.round(parseFloat(getComputedStyle(el).width));

    canvas.querySelectorAll('.section-block').forEach((s) => s.remove());
    await window.addSection();
    const sec = [...canvas.querySelectorAll('.section-block')].pop();
    window.getSelectedSection = () => sec; window._activeFrame = null;
    await window.addTextBlock('body');
    const tb = [...sec.querySelectorAll('.text-block')].pop();
    tb.id = 'tfwTb';
    const tf = tb.closest('.frame-block[data-text-frame="true"]');
    if (!tf) return { fail: 'text-frame 이 없다 — addTextBlock 이 프레임을 안 만든다' };

    /* ★패널이 폭을 정하는 꼴 — `prop-text-wireup-position.js:9` applyW 가 쓰는 ★두 속성 */
    if (setW) { tf.style.width = '300px'; tf.style.maxWidth = '100%'; tf.dataset.width = '300'; }
    const base = { inline: tf.style.width, computed: cw(tf) };

    /* ★켜고 ★넓힌다 — ⛔켜기 «전»에 `null` 을 부르지 ★않는다(★261024 에 그 줄이 폭을 미리 지웠다) */
    ft.setFxFreeTransform(tb, corners || [[0, 0], [400, 0], [400, 120], [0, 120]], { history: false });
    const on = { inline: tf.style.width, computed: cw(tf) };

    let tb2 = tb, tf2 = tf, afterRestore = null;
    if (restore) {
      window.flushCurrentPage();
      const saved = window.getSerializedCanvas ? window.getSerializedCanvas() : canvas.innerHTML;
      canvas.innerHTML = saved;            /* ★새 DOM = ★WeakMap 이 빈다(★실제 복원과 같은 조건) */
      window.rebindAll?.({});              /* ★복원 정본 — ★이것이 `watchAllFx` 를 부른다 */
      tb2 = document.getElementById('tfwTb');
      tf2 = tb2 && tb2.closest('.frame-block[data-text-frame="true"]');
      if (!tb2 || !tf2) return { fail: '복원 뒤 블럭·프레임을 못 찾았다' };
      afterRestore = { inline: tf2.style.width, computed: cw(tf2) };
    }
    /* ★★`ftMeasure` 가 ★어느 폭에서 ★잰 결과인가 = ★`W`. ★T5 가 ★이 값으로 ★⒜·⒝ 분리를 ★잰다. */
    const stAfter = ft.ftMeasure(tb2, true);
    const measuredW = stAfter ? +stAfter.W.toFixed(2) : null;
    const cornersAfter = tb2.dataset.tfCorners || null;
    ft.setFxFreeTransform(tb2, null, { history: false });   /* ★✕ */
    return { base, on, afterRestore, measuredW, cornersAfter,
             afterX: { inline: tf2.style.width, computed: cw(tf2) } };
  }, { setW, restore, corners });
}

test('T0 ★전제 — 장면이 선다(프레임이 생기고, 켜면 폭이 실제로 넓어진다)', async ({ page }) => {
  const errs = await bootApp(page);
  const r = await run(page, true, false);
  expect(r.fail).toBeUndefined();
  expect(r.base, '★패널 폭이 안 걸렸다').toEqual({ inline: '300px', computed: 300 });
  /* ★★앞끝 양성대조 — ★켜도 폭이 ★안 변하면 ★아래 「✕ 뒤 같다」가 ★★항등식이 된다 */
  expect(r.on.computed, `★켰는데 폭이 안 넓어졌다 (${r.on.computed}) — 장면이 증상을 못 만든다`).toBe(400);
  expect(errs, `★앱 오류: ${errs.join(' | ')}`).toEqual([]);
});

test('T1 ★★폭을 정한 글상자 — ★저장→다시 열기→✕ 뒤 폭이 ★켜기 전과 같다 (★전엔 400 으로 굳었다)', async ({ page }) => {
  await bootApp(page);
  const r = await run(page, true, true);
  expect(r.fail).toBeUndefined();
  console.log('[T1]', JSON.stringify(r));
  expect(r.on.computed, '★전제: 켜면 400 이어야 한다').toBe(400);
  /* ★★★본 단언 — ★★computed 로 ★잰다(⛔inline 만 보면 `''` 를 「정상」으로 읽는다) */
  expect(r.afterX.computed,
    `★✕ 뒤 폭이 ★켜기 전(${r.base.computed})과 다르다 — 사용자가 정한 폭이 사라졌다 ` +
    `(복원 직후 ${r.afterRestore && r.afterRestore.inline} · ✕ 뒤 ${r.afterX.inline})`
  ).toBe(r.base.computed);
  expect(r.afterX.inline, '★✕ 뒤 inline 이 패널 값이 아니다').toBe('300px');
});

test('T2 ★★폭을 ★안 정한 글상자 — ★저장→다시 열기→✕ 뒤에도 기본(100%) 이다 (★전엔 400 으로 굳었다)', async ({ page }) => {
  await bootApp(page);
  const r = await run(page, false, true);
  expect(r.fail).toBeUndefined();
  console.log('[T2]', JSON.stringify(r));
  expect(r.base.inline, '★전제: 갓 만든 프레임의 기본 폭').toBe('100%');
  expect(r.on.computed, '★전제: 켜면 400').toBe(400);
  expect(r.afterX.computed, `★✕ 뒤 폭이 기본(${r.base.computed})과 다르다`).toBe(r.base.computed);
  expect(r.afterX.inline, '★✕ 뒤 inline 이 기본이 아니다').toBe('100%');
});

test('T3 ★★음성대조 — ★저장 ★전에 ✕ 하면 ★원래도 정상이었다(★그 길은 안 깨졌다)', async ({ page }) => {
  await bootApp(page);
  for (const setW of [true, false]) {
    const r = await run(page, setW, false);
    expect(r.fail).toBeUndefined();
    expect(r.afterX.computed, `★저장 전 ✕ 가 깨졌다 (setW=${setW})`).toBe(r.base.computed);
  }
});

test('T4 ★`100%` 는 ★손으로 박은 값이다 — ★`_makeTextFrame` 의 cssText 에서 ★파싱해 ★대조한다', () => {
  const bf = fs.readFileSync(path.join(ROOT, 'js', 'block-factory.js'), 'utf8');
  const body = bf.slice(bf.indexOf('function _makeTextFrame()'));
  const head = body.slice(0, body.indexOf('}'));
  const m = head.match(/cssText\s*=\s*'[^']*width:\s*([0-9.]+%|[0-9.]+px)/);
  expect(m, '★`_makeTextFrame` 의 cssText 에서 width 를 못 찾았다 — 이 검사의 자가 낡았다').toBeTruthy();
  /* ★`effects-freetransform.js` 가 ★폴백으로 쓰는 값과 ★★같아야 한다.
     ⇒ ★`_makeTextFrame` 쪽이 바뀌면 ★여기서 ★빨강이고, ★그때 ★폴백도 ★같이 고치게 된다. */
  const ftSrc = fs.readFileSync(path.join(ROOT, 'js', 'effects-freetransform.js'), 'utf8');
  const fb = ftSrc.match(/:\s*'(100%|[0-9.]+px)';\s*\/\* ★`_makeTextFrame` 의 기본/);
  expect(fb, '★effects-freetransform 의 폴백 줄을 못 찾았다 — 자가 낡았다').toBeTruthy();
  expect(fb[1], `★두 값이 갈렸다 — _makeTextFrame=${m[1]} · 폴백=${fb && fb[1]}`).toBe(m[1]);
});

test('T5 ★★«재는 폭»과 ★«되돌릴 폭»은 ★여전히 ★다른 칸이다 — ★★폴백이 ★갈린다', () => {
  /* ★★★2026-10-24 ⅲ) — ★이 칸의 ★자를 ★★두 번째로 ★다시 세웠다. ★★역사를 ★적는다 :
     ⒜ ★첫 자 : 「복원 직후 ★`tf.style.width`(box 폭)가 ★setW 와 무관」
        ⇒ ★★틀렸다 — 장면이 ★직사각형이라 ★`FT-AXIS-ALIGNED-TRANSFORM-LOST-ON-RESTORE-01` 이
          ★끼어들어 ★그 값이 ★box 가 아니라 ★`W` 였다. ★내가 그것을 ★「box 악화」로 읽고 ★철회했다.
     ⒝ ★둘째 자 : 「★사다리꼴 장면에서 ★복원 직후 ★`W` 가 ★setW 와 무관」
        ⇒ ★★ⅲ) 에서 ★★전제가 ★바뀌었다 — ★`tfMeasW` 의 ★출처를 ★★`tf.dataset.width` 로 ★골랐으므로
          ★「setW 에 따라 ★`W` 가 ★달라지는 것」이 ★이제 ★★«설계»다(★C3 를 ★그것으로 ★닫았다).
          ⇒ ★그 자는 ★★더는 ★참이 아니다.
     ⒞ ★★셋째 자(지금) : ★두 칸이 ★★«다른 칸»임의 ★증거 = ★★폴백이 ★갈린다.
        `tfW0`(✕ 가 되돌릴 폭) : `dataset.width` → ★없으면 ★★`'100%'`
        `tfMeasW`(재는 폭)     : `dataset.width` → ★없으면 ★★`ktf`
     ★★이 칸이 ★막는 사고 — ★261024 에 ★실제로 났다 :
       ★한 칸이 ★두 일을 하던 때 ★`tfW0` 출처만 고쳤는데 ★`ftMeasure` 가 ★끌려가
       ★복원 직후 `W` 가 ★338.344 → ★164.719 로 ★바뀌었다.
     ⛔★행위로는 ★여기서 ★안 잰다 — ★✕ 쪽은 ★`T1`·`T2` 가, ★재는 쪽은
       `ft-restore-remeasures-at-other-width.dom.spec.js` ★`X1` 이 ★행위로 잠근다.
       ★이 칸은 ★★«두 칸이 ★합쳐지는 것»만 ★막는다(★구조). */
  const src = fs.readFileSync(path.join(ROOT, 'js', 'effects-freetransform.js'), 'utf8');

  /* ★전제 — ★두 이름이 ★둘 다 ★산다 */
  for (const name of ['tfW0', 'tfMeasW'])
    expect(src.includes(name), `★${name} 이 사라졌다 — 두 칸이 합쳐졌으면 ★이 칸을 다시 판정해라`).toBe(true);

  /* ★★본 단언 — ★폴백이 ★갈린다. ★`tfW0` 쪽은 ★`'100%'`, ★`tfMeasW` 쪽은 ★`ktf`. */
  const w0Fallback = src.match(/:\s*'(100%|[0-9.]+px)';\s*\/\* ★`_makeTextFrame` 의 기본/);
  expect(w0Fallback, '★`tfW0` 의 폴백 줄을 못 찾았다 — 이 검사의 자가 낡았다').toBeTruthy();
  expect(w0Fallback[1], '★`tfW0` 의 폴백이 바뀌었다 — T4 와 같이 다시 판정해라').toBe('100%');

  const measBlock = src.slice(src.indexOf('st.tfMeasW = (dsW'));
  expect(measBlock.slice(0, 200), '★`tfMeasW` 의 폴백이 `ktf` 가 아니다 — 두 칸이 같아졌으면 다시 판정해라')
    .toContain(': ktf');

  /* ★★음성대조 — ★`tfW0` 쪽 줄에는 ★`ktf` 폴백이 ★없다(★있으면 ★두 칸이 ★같아진 것이다) */
  const w0Block = src.slice(src.indexOf('st.tfW0 = (dsW'), src.indexOf('st.tfW0 = (dsW') + 220);
  expect(w0Block, '★`tfW0` 가 `ktf` 로 떨어진다 — 두 칸이 같아졌다(261024 의 그 사고가 돌아온다)')
    .not.toContain(': ktf');
});
