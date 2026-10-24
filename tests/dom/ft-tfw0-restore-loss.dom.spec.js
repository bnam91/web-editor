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

test('T5 ★★«재는 폭»이 ★«되돌릴 폭»에 ★끌려가지 않는다 — ★복원 직후 ★`W` 가 ★setW 와 ★무관하다', async ({ page }) => {
  await bootApp(page);
  /* ★★★261024 ★정정 — ★이 칸의 ★자를 ★다시 세웠다.
     ★옛 자 : 「복원 직후 ★`tf.style.width`(= box 폭)가 setW 와 무관」.
     ★★그 자가 ★틀렸다 : ★장면이 ★★직사각형 네 점이라
       ★★`FT-AXIS-ALIGNED-TRANSFORM-LOST-ON-RESTORE-01`(★변형이 통째로 사라진다)이 ★끼어들어
       ★`tf.style.width` 가 ★box 가 아니라 ★★`W` 를 받고 있었다.
       ⇒ ★내가 그것을 ★「box 폭 악화(62 → 235)」로 ★읽었고 ★★그 판정을 ★★철회했다.
     ★★교차 측정으로 ★참값을 ★얻었다 : ★`box.w` 는 ★두 판 ★모두 ★★400(`boxDelta: 0`).
     ⇒ ★새 자 : ★★«사다리꼴» 장면(★변형 손실이 ★안 끼어든다) ＋ ★★`W` 를 ★직접 ★견준다.
       ★`tfW0`(되돌릴 폭)만 ★다른 두 판에서 ★`W`(재는 쪽 산출)가 ★★같아야 ★한다. */
  const TRAP = [[40, 0], [360, 0], [400, 140], [0, 140]];
  const withW = await run(page, true, true, TRAP);
  const noW   = await run(page, false, true, TRAP);
  expect(withW.fail).toBeUndefined(); expect(noW.fail).toBeUndefined();
  console.log('[T5]', JSON.stringify({ withW: { W: withW.measuredW, c: withW.cornersAfter, x: withW.afterX },
                                       noW:   { W: noW.measuredW,   c: noW.cornersAfter,   x: noW.afterX } }));

  /* ★★앞끝 전제 ⑴ — ★사다리꼴이라 ★네 점이 ★유지됐나. ⛔덮어써졌으면 ★다른 결함을 재는 것이다. */
  for (const [n, r] of [['withW', withW], ['noW', noW]])
    expect(r.cornersAfter, `★${n}: 네 점이 덮어써졌다 — FT-AXIS-ALIGNED-… 가 끼어들었다`)
      .toBe('40,0,360,0,400,140,0,140');

  /* ★★앞끝 전제 ⑵ — ★두 판의 ★«되돌릴 폭»이 ★★달라야 ★이 비교가 ★선다(⛔같으면 항등식) */
  expect(withW.base.computed, '★전제: 두 판의 켜기 전 폭이 같다 — 비교가 무의미하다')
    .not.toBe(noW.base.computed);
  expect(withW.measuredW, '★전제: W 를 못 쟀다').not.toBeNull();

  /* ★★★본 단언 — ★복원 직후 ★`W` 가 ★같다 = ★재는 쪽이 ★되돌릴 쪽에 ★안 끌려간다.
     ★261024 실측 : 두 칸을 ★섞으면 ★withW `280.03` · ★noW `373.36` 으로 ★갈린다(★변이로 확인).
     ★이름 = `FT-TFW0-TWO-USES-01` */
  expect(withW.measuredW,
    `★복원 직후 W 가 setW 에 따라 갈렸다 — 「재는 폭」이 「되돌릴 폭」에 끌려간다 ` +
    `(withW ${withW.measuredW} · noW ${noW.measuredW})`
  ).toBe(noW.measuredW);

  /* ★★음성대조 — ★✕ 뒤 폭은 ★★갈려야 ★한다(★그게 C2 고침의 ★목적이다) */
  expect(withW.afterX.computed, '★✕ 뒤 폭이 두 판에서 같다 — C2 고침(사용자 폭 복원)이 죽었다')
    .not.toBe(noW.afterX.computed);
});
