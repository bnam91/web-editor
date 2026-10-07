/* modal-rotate.dom.spec.js — T11 「모달블럭도 로테이트 기능이 있으면 좋을 것 같다」
 *   (현빈 구두 2026-10-07 · 지디 발주 · TODO-sections T11)
 *
 * ══ ★무엇을 ★안 만들었나 (★착수 전 실측) ═══════════════════════════════════════
 *   ★정본 공장 = ★`js/asset-rotate.js:236` ★`_makeRotateType(cfg)`
 *     cfg 칸: hostFor · zoneClass · guard · readDeg · ★applyDeg · ★syncUI · historyLabel · restore · sz · out
 *   ★★그 공장이 ★이미 ★여섯을 찍었다 — _TEXT_ROT · _ICONIFY_ROT · _MOCKUP_ROT ·
 *     _CANVAS_ROT · _ICB_ROT · _VECTOR_ROT (＋ asset·shape 는 전용 쌍)
 *   ★라우팅도 ★한 자리다 — `_ROTATE_HANDLERS`(:397) · `_rotateHandlerFor`(:407) 가 ★클래스로 고른다
 *   ★핸들 add/remove 는 ★`MutationObserver` 가 ★`.selected` 를 보고 ★스스로 한다(:417)
 *   ⇒ ★★모달은 ★«타입 한 줄 ＋ 라우팅 한 줄 ＋ 패널 줄» 이다. ⛔새 드래그 코드 ★0
 *   ⛔공장을 ★밖으로 빼지 않는다(module-private 유지 · 지디 승인) — 모달 타입을 ★그 파일 ★안에 더한다
 *
 * ══ ⛔★안 합친 것 (★범위를 지킨다) ════════════════════════════════════════════
 *   ★`js/sticker-select.js:199 _bindRotateDrag` 가 ★그 공장을 ★안 쓰는 ★사본이다
 *   ⇒ ★★로테이트 명부가 ★둘이다(공장 6 ＋ 사본 1). ★라우팅 표도 그 사실을 적어 뒀다
 *      (:396 「★스티커는 sticker-select.js가 이미 회전 담당 → ★여기 미등록(중복 방지)」)
 *   ⇒ ⛔★이번에 ★안 합친다(지디 지시 · 합치면 ★T11 의 분모가 흔들린다) — ★별건이다
 *
 * ══ ★자 ═══════════════════════════════════════════════════════════════════════
 *   ★「핫존이 있나」로 닫지 않는다 — ★★«돌려서 ★각도가 ★남나»를 ★잰다(dataset.rotation ＋ transform).
 *   ★그리고 ★패널 숫자와 ★핫존이 ★같은 값을 보나 — ★공유 헬퍼(`applyRotationDeg`)를 ★쓴 증거다.
 *   ⛔px·deg 를 ★박지 않는다 — ★기존 타입(캔버스)과 ★★같은 실행에서 견준다(빌린 수 0).
 *
 * ⛔앱 통째 헤드리스(`bootApp`). ★양성대조: `GD1001_ROOT=<ce93dc91 체크아웃>` 이면 옛 판을 잰다.
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js modal-rotate --workers=2
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

/** 섹션 하나를 세우고 블럭을 «입구로» 넣는다 — 사람이 하는 순서(고르기 → 넣기). */
async function setup(page, kind) {
  await page.setViewportSize({ width: 1700, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate((kind) => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend',
      '<div class="section-block" data-section="1" id="sec1"><div class="section-hitzone"></div>'
      + '<div class="section-inner" id="inner1"></div></div>');
    window.rebindAll?.();
    document.getElementById('sec1').classList.add('selected');
    const made = kind === 'modal' ? window.addModalBlock?.({}) : window.addCanvasBlock?.({});
    /* ⚠️★입구마다 ★돌려주는 것이 ★다르다 — ★실측(2026-10-07):
         `addModalBlock`  → ★{row, block} 을 ★돌려준다
         `addCanvasBlock` → ★★아무것도 ★안 돌려준다(함수 끝에 return 이 없다 · canvas-block.js:1048)
       ⇒ ★★`made.block` 에만 기대면 ★캔버스에서 ★전제가 깨진다(★내가 밟았다)
       ⇒ ★DOM 에서 ★집는 길을 ★같이 둔다. ⛔「입구가 다 같은 꼴을 돌려준다」로 ★믿지 마라. */
    window.__b = (made && made.block)
      || document.querySelector('#inner1 .row > *')
      || document.querySelector('#inner1 > *');
  }, kind);
  await page.waitForTimeout(350);
  const pre = await page.evaluate(() => ({
    exists: !!window.__b, inDom: !!(window.__b && window.__b.isConnected),
    cls: window.__b ? window.__b.className : null,
    selected: !!(window.__b && window.__b.classList.contains('selected')),
  }));
  expect(pre.exists, `전제: add*Block(${kind}) 이 블럭을 안 돌려줬다`).toBe(true);
  expect(pre.inDom, '전제: 블럭이 DOM 에 없다').toBe(true);
  expect(pre.selected, '전제: 넣은 뒤 자동선택이 안 됐다').toBe(true);
  return errs;
}

/** 회전 핫존 수 — zoneClass 별로 센다. */
const zones = (page, cls) => page.evaluate((cls) =>
  document.querySelectorAll('.' + cls).length, cls);

/* ═══════════════════════════════════════════════════════════════════════════
   M-ROT1 — ★라우팅에 들었나 ＋ ★핫존 넷이 «고르면» 붙나
   ★기존 타입(캔버스)과 ★같은 실행에서 견준다 — ⛔「4개」를 박지 않는다
═══════════════════════════════════════════════════════════════════════════ */
test('M-ROT1 ★모달을 고르면 회전 핫존이 «캔버스와 같은 수»로 붙는다', async ({ page }) => {
  // ⇐ 되돌리기: _ROTATE_HANDLERS 의 'modal-block' 줄을 지우면 빨강
  const errs = await setup(page, 'canvas');
  /* ⑴ 기준 — ★이미 있는 타입(캔버스). ★이 수가 ★0 이면 ★이 검사는 «안 쟀다»다 */
  const ref = await zones(page, 'cvb-rotate-zone');
  expect(ref, '기준(캔버스) 회전 핫존이 0개다 — 이 검사가 아무것도 재고 있지 않다').toBeGreaterThan(0);

  /* ⑵ 모달 — ★같은 판을 새로 띄워 ★같은 순서로 */
  const errs2 = await setup(page, 'modal');
  const got = await zones(page, 'mdl-rotate-zone');
  expect(got, `★모달 회전 핫존 ${got}개 · 기준(캔버스) ${ref}개 — 갈린다`).toBe(ref);

  /* ★그리고 ★라우팅이 ★모달을 ★고르나 — 클래스로 고르는 그 함수의 ★행위 */
  const routed = await page.evaluate(() => {
    /* ⛔`_rotateHandlerFor` 는 module-private 다 ⇒ ★행위로 본다:
       선택을 풀면 ★핫존이 사라져야 한다(MutationObserver 가 .selected 를 본다). */
    window.__b.classList.remove('selected');
    return new Promise(r => setTimeout(() => r(document.querySelectorAll('.mdl-rotate-zone').length), 250));
  });
  expect(routed, '선택을 풀었는데 회전 핫존이 안 걷혔다 — 라우팅/감시자가 안 걸렸다').toBe(0);
  expect(errs).toEqual([]);
  expect(errs2).toEqual([]);
});

/* ═══════════════════════════════════════════════════════════════════════════
   M-ROT2 — ★★「핫존이 있나」가 아니라 ★«돌면 각도가 남나»
   ★공유 헬퍼(applyRotationDeg)를 썼는지까지 — dataset.rotation ＋ transform 둘
═══════════════════════════════════════════════════════════════════════════ */
/* ⚠️★이 칸은 ★★«전제»다 — ★«기능 게이트»가 ★아니다(2026-10-07 실측).
   ★V1·V2·V3 ★어느 변이에도 ★안 빨개진다 ⇒ ★`applyRotationDeg` 가 ★전역이라 ★내 변경 ★전에도 초록이었다.
   ⇒ ★제목에 ★「(전제)」를 ★박는다 — ⛔게이트처럼 보이면 ★다음 사람이 ★속는다(지디 지시). */
test('M-ROT2 ★(전제) 공유 헬퍼가 dataset.rotation 과 transform 에 «둘 다» 쓴다', async ({ page }) => {
  // ⇐ 되돌리기: applyDeg 를 _applyRotationDeg 가 아닌 제 벌로 바꾸면 둘 중 하나가 빠져 빨강
  const errs = await setup(page, 'modal');
  const r = await page.evaluate(() => {
    const b = window.__b;
    const before = { ds: b.dataset.rotation || null, tf: b.style.transform || '' };
    window.applyRotationDeg?.(b, 30);
    const after = { ds: b.dataset.rotation || null, tf: b.style.transform || '' };
    /* ★0 으로 되돌리면 ★둘 다 걷혀야 한다(그 헬퍼의 계약) */
    window.applyRotationDeg?.(b, 0);
    const zero = { ds: b.dataset.rotation || null, tf: b.style.transform || '' };
    return { before, after, zero };
  });
  expect(r.before.ds, '전제: 처음엔 각도가 없어야 한다').toBeNull();
  expect(r.after.ds, `★dataset.rotation 이 ${r.after.ds} 다`).toBe('30');
  expect(r.after.tf, `★transform 이 «${r.after.tf}» 다`).toMatch(/rotate\(30deg\)/);
  /* ★음성대조 — ★0 이면 ★둘 다 걷힌다(안 걷히면 그 헬퍼를 안 쓴 것이다) */
  expect(r.zero.ds, `0 으로 되돌렸는데 dataset.rotation 이 ${r.zero.ds} 다`).toBeNull();
  expect(r.zero.tf, `0 으로 되돌렸는데 transform 이 «${r.zero.tf}» 다`).not.toMatch(/rotate\(/);
  expect(errs).toEqual([]);
});

/* ═══════════════════════════════════════════════════════════════════════════
   M-ROT3 — ★패널 줄이 ★«읽히고» ★핫존과 ★같은 값을 본다
   ★`_syncNumSlider` 규약 = id 접두사 `<prefix>-slider` / `-number`
═══════════════════════════════════════════════════════════════════════════ */
test('M-ROT3 ★패널 회전 줄이 있고, 값을 넣으면 블럭에 먹고 되읽힌다', async ({ page }) => {
  // ⇐ 되돌리기: prop-modal.js 의 회전 줄(HTML) 또는 그 배선을 지우면 빨강
  const errs = await setup(page, 'modal');
  const r = await page.evaluate(async () => {
    const s = document.getElementById('mdl-rot-slider');
    const n = document.getElementById('mdl-rot-number');
    if (!s || !n) return { missing: { s: !s, n: !n } };
    /* ★읽히나 — 두 칸이 ★면적을 갖나(0 이면 못 만진다) */
    const sr = s.getBoundingClientRect(), nr = n.getBoundingClientRect();
    n.value = '45';
    n.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(r => setTimeout(r, 200));
    const b = window.__b;
    return {
      missing: null,
      sW: Math.round(sr.width), nW: Math.round(nr.width),
      ds: b.dataset.rotation || null, tf: b.style.transform || '',
      sliderVal: s.value, numVal: n.value,
      min: n.getAttribute('min'), max: n.getAttribute('max'),
    };
  });
  expect(r.missing, `★패널 회전 줄이 없다: ${JSON.stringify(r.missing)}`).toBeNull();
  /* ★읽히나 — 면적 */
  expect(r.sW, `슬라이더 폭 ${r.sW}px`).toBeGreaterThan(0);
  expect(r.nW, `숫자칸 폭 ${r.nW}px`).toBeGreaterThan(0);
  /* ★먹나 */
  expect(r.ds, `45 를 넣었는데 dataset.rotation 이 ${r.ds} 다`).toBe('45');
  expect(r.tf, `transform «${r.tf}»`).toMatch(/rotate\(45deg\)/);
  /* ★두 칸이 ★같은 값을 보나 — 하나만 맞추면 슬라이더와 숫자가 갈라진다(이 레포 고질) */
  expect(r.sliderVal, `슬라이더 ${r.sliderVal} · 숫자 ${r.numVal}`).toBe(r.numVal);
  /* ★범위 — 다른 타입과 같은 −180~180(⛔내 수가 아니라 ★선례의 수다) */
  expect([r.min, r.max], `범위 ${r.min}~${r.max}`).toEqual(['-180', '180']);
  expect(errs).toEqual([]);
});

/* ═══════════════════════════════════════════════════════════════════════════
   M-ROT4 — ★★저장→로드 왕복에서 ★각도가 ★사나
   ★모달은 `renderModalBlock` 이 ★cssText 를 ★통째로 갈아끼운다(:511 부근) ⇒
   ★그 재렌더가 ★transform 을 ★지우면 각도가 조용히 사라진다. ★그것을 잰다.
═══════════════════════════════════════════════════════════════════════════ */
test('M-ROT4 ★재렌더 뒤에도 각도가 산다 (모달은 cssText 를 통째로 갈아끼운다)', async ({ page }) => {
  const errs = await setup(page, 'modal');
  const r = await page.evaluate(async () => {
    const b = window.__b;
    window.applyRotationDeg?.(b, 30);
    const before = { ds: b.dataset.rotation || null, tf: b.style.transform || '' };
    /* ★재렌더 — 패널 조작·저장 로드가 ★늘 부르는 그 함수 */
    window.renderModalBlock?.(b);
    await new Promise(r => setTimeout(r, 200));
    const after = { ds: b.dataset.rotation || null, tf: b.style.transform || '' };
    return { before, after };
  });
  expect(r.before.tf, '전제: 재렌더 전에 transform 이 있어야 한다').toMatch(/rotate\(30deg\)/);
  /* ★dataset 은 재렌더가 안 건드린다 — ★그래서 ★여기는 ★약한 단언이다(그 사실을 적는다) */
  expect(r.after.ds, `재렌더 뒤 dataset.rotation = ${r.after.ds}`).toBe('30');
  /* ★★본단언 — ★화면(transform)이 ★살아 있나. ⛔dataset 만 보면 「저장은 되고 안 보인다」를 놓친다 */
  expect(r.after.tf, `★재렌더가 transform 을 지웠다 — before «${r.before.tf}» → after «${r.after.tf}»`)
    .toMatch(/rotate\(30deg\)/);
  expect(errs).toEqual([]);
});

/* ═══════════════════════════════════════════════════════════════════════════
   M-ROT5 — ★★「모달 블럭의 transform 은 ★rotate ★하나뿐이다」를 ★잠근다
   ───────────────────────────────────────────────────────────────────────────
   ★왜 이 칸이 있나 — ★`renderModalBlock` 의 회전 재적용이 ★transform 을 ★«통째로» 쓴다.
     ★공유 헬퍼(asset-rotate.js:218·:316)는 ★기존 것을 ★★이어받는데 ★이 줄은 ★버린다.
     ⇒ ★그게 괜찮은 ★유일한 근거 = ★★«모달에 rotate 아닌 transform 이 앉는 판이 ★0건»이다
       (★다섯 경로 전수 — js/blocks/modal-block.js 의 그 주석에 ★어떻게 쟀나까지 적었다).
   ⇒ ★★그 0건이 ★깨지는 날 ★이 칸이 ★빨개진다 ⇒ ★그때 ★이어받기 꼴로 고쳐라.
   ★★그리고 ⛔이 단언이 ★«항등식»이 아님을 ★같이 보인다 — ★translate 를 ★손으로 얹어 ★거짓이 되는지.
      (★「내가 건 단언이 ★항상 참이라 ★아무것도 안 잠갔다」를 막는 자리)
═══════════════════════════════════════════════════════════════════════════ */
test('M-ROT5 ★모달 transform 은 «rotate 하나뿐»이다 (＋그 자가 항등식이 아님을 같이 보인다)', async ({ page }) => {
  const errs = await setup(page, 'modal');
  const r = await page.evaluate(async () => {
    const b = window.__b;
    window.applyRotationDeg?.(b, 30);
    window.renderModalBlock?.(b);
    await new Promise(r => setTimeout(r, 150));
    const live = (b.style.transform || '').trim();
    /* ★자 — ★rotate ★하나만. ⛔공백·순서에 느슨하지 않게 ★꼴을 박는다 */
    const ROTATE_ONLY = /^rotate\(-?[\d.]+deg\)$/;
    return {
      live,
      passes: ROTATE_ONLY.test(live),
      /* ★★음성대조 — ★같은 자에 ★translate 가 섞인 값을 ★손으로 넣는다. ★거짓이어야 한다 */
      negTranslate: ROTATE_ONLY.test('translateX(5px) rotate(30deg)'),
      negScale:     ROTATE_ONLY.test('rotate(30deg) scale(1,-1)'),
      /* ★양성대조 — ★그 자가 ★맞는 꼴은 ★참이라 해야 한다 */
      posPlain:     ROTATE_ONLY.test('rotate(30deg)'),
      posNeg:       ROTATE_ONLY.test('rotate(-12.5deg)'),
    };
  });
  /* ★전제 — 재렌더 뒤에 ★transform 이 ★있나(0 이면 이 칸은 «안 쟀다»다) */
  expect(r.live, '전제: 재렌더 뒤 transform 이 비었다 — M-ROT4 가 먼저 빨개져야 한다').not.toBe('');
  /* ★★자가 ★항등식이 아님 — ★먼저 보인다 */
  expect(r.posPlain, '★자가 맞는 꼴을 거부한다 — 자가 죽었다').toBe(true);
  expect(r.posNeg,   '★자가 음수 각도를 거부한다').toBe(true);
  expect(r.negTranslate, '★★자가 translate 섞인 값을 ★통과시킨다 — ★이 단언은 아무것도 안 잠근다').toBe(false);
  expect(r.negScale,     '★★자가 scale 섞인 값을 ★통과시킨다 — 같은 까닭으로 무의미하다').toBe(false);
  /* ★★본단언 — ★0건이 ★아직 참인가 */
  expect(r.passes, `★모달 transform 이 «${r.live}» 다 — ★rotate 아닌 것이 섞였다
     ⇒ ★★「0건」 전제가 깨졌다. ★js/blocks/modal-block.js 의 그 주석대로 ★이어받기 꼴로 고쳐라`).toBe(true);
  expect(errs).toEqual([]);
});
