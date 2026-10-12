/* outer-pad-shared.dom.spec.js — ★「패딩 제외」가 되먹는 섹션 패딩이 ★한 함수에서 온다 (2026-10-06 ⒜-2 · 지디 발주)
 *
 * ★무엇을 합쳤나 — `_effSectionPadX` 가 ★챗·캔버스 ★두 벌이었다(주석 뺀 본문이 한 글자도 안 달랐다).
 *   ⇒ js/blocks/outer-pad.js `effSectionPadX` 하나로. ★산출 불변 리팩터다.
 * ★★「합친 것을 ★무엇으로 재나」 — 그 함수를 무력화하면 ★소비자 수만큼 빨강이어야 한다:
 *     F1a (챗) · F1b (캔버스)  ⇒ ★2 빨강 — ⛔한 test 에 묶으면 1 로 세어져 이 조건이 안 선다
 *     F2 (에셋)              ⇒ ★초록 유지 = ★음성대조
 *   ⛔에셋은 ★다른 함수(block-factory.js applyExcludePadX)를 쓴다 — 전역 토글·프리셋 폭 가드·폴백·적용방식
 *     ★넷이 다르다. 「에셋 패턴 미러」 주석은 «패턴»을 가리킨 말이고 «같은 함수»가 아니다(까닭은 outer-pad.js 머리말).
 *   ⇒ ★3 빨강을 기대하면 ★영영 안 서는 조건이다. ★2 ＋ 음성대조 1 이 참값이다.
 *
 * ★F3 은 ★«설계»를 잠근다 — 자유배치 프레임 안에서는 ★0 이다(absolute 배치라 full-bleed 가 뜻이 없다).
 *   ⛔이걸 「고쳐야 할 구멍」으로 읽지 마라. 2026-10-06 에 내 조사가 그렇게 읽었고 실측으로 뒤집혔다.
 *
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js tests/dom/outer-pad-shared.dom.spec.js --workers=1
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

async function scene(page, { free = false } = {}) {
  await page.setViewportSize({ width: 1700, height: 1100 });
  const errs = await bootApp(page);
  const info = await page.evaluate((free) => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend',
      '<div class="section-block" data-section="1" id="sO"><div class="section-hitzone"></div>'
      + '<div class="section-inner" id="siO"></div></div>');
    window.rebindAll?.();
    const padX = window.state?.pageSettings?.padX ?? 0;
    window.applyPadXToSection?.(document.getElementById('siO'), padX);
    window.selectSection(document.getElementById('sO'));
    if (free) {
      window.addFrameBlock?.({});
      const fr = document.querySelector('#siO > .frame-block');
      fr.dataset.freeLayout = 'true';
      fr.classList.add('selected');
      window._activeFrame = fr;
    }
    /* ★내용 폭 — ⛔clientWidth 는 padding 을 «포함»한다(실측: 860 이 나왔다). 그 둘을 빼야 내용 폭이다. */
    const si = document.getElementById('siO');
    const cs = getComputedStyle(si);
    const inner = si.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
    return { canvas: c.offsetWidth, padX, inner };
  }, free);
  return { errs, ...info };
}

test('F0 ★전제 — 섹션에 padX 가 «실제로» 걸렸고 0 이 아니다', async ({ page }) => {
  const s = await scene(page);
  expect(s.padX, '전제: padX > 0(0 이면 아래가 아무것도 안 잠근다)').toBeGreaterThan(0);
  expect(`안쪽 ${s.inner} = 캔버스 ${s.canvas} − 2×${s.padX}`)
    .toBe(`안쪽 ${s.canvas - 2 * s.padX} = 캔버스 ${s.canvas} − 2×${s.padX}`);
  expect(s.errs, s.errs.join(' | ')).toEqual([]);
});

/* ★소비자를 ★한 test 에 묶지 «않는다» — 묶으면 공용 함수를 무력화했을 때 ★«1 빨강»으로 세어져
   「소비자 수만큼 빨강」이 ★안 선다(실측 2026-10-06: 묶었더니 F1 하나만 빨갰다). ⇒ ★따로 센다. */
async function bleed(page, kind) {
  return page.evaluate((kind) => {
    const out = {};
    if (kind === 'chat') {
      window.addChatBlock({ messages: [{ text: 'x', align: 'left' }] });
      const ch = document.querySelector('.chat-block');
      window.updateChatBlock(ch.id, { padding: 0 });
      out.before = ch.offsetWidth;
      window.updateChatBlock(ch.id, { fullBleed: true });
      out.after = ch.offsetWidth;
      out.found = true;
    } else {
      window.addCanvasBlock?.({});
      const cv = document.querySelector('.canvas-block');
      out.found = !!cv;
      if (cv) {
        out.before = cv.offsetWidth;
        window.updateCanvasBlock?.(cv.id, { fullBleed: true });
        out.after = cv.offsetWidth;
      }
    }
    out.canvas = document.getElementById('canvas').offsetWidth;
    return out;
  }, kind);
}

test('F1a ★소비자 ① 챗 — full-bleed 로 «캔버스 폭»이 된다', async ({ page }) => {
  const s = await scene(page);
  const g = await bleed(page, 'chat');
  expect(g.found, '전제: 챗이 섰다').toBe(true);
  /* ⛔before 를 «수»로 안 박는다 — 블럭 종류마다 기본 폭이 다르다. 재는 것은 ㉠after = 캔버스 ㉡넓어졌다. */
  expect(`챗 after=${g.after} · 캔버스=${g.canvas}`).toBe(`챗 after=${g.canvas} · 캔버스=${g.canvas}`);
  expect(g.after > g.before, `넓어졌다 (잰 값 ${g.before} → ${g.after})`).toBe(true);
  expect(s.errs, s.errs.join(' | ')).toEqual([]);
});

test('F1b ★소비자 ② 캔버스 블럭 — 같은 함수로 같은 결과', async ({ page }) => {
  const s = await scene(page);
  const g = await bleed(page, 'canvas');
  expect(g.found, '전제: 캔버스 블럭이 섰다').toBe(true);
  expect(`캔버스블럭 after=${g.after} · 캔버스=${g.canvas}`).toBe(`캔버스블럭 after=${g.canvas} · 캔버스=${g.canvas}`);
  expect(g.after > g.before, `넓어졌다 (잰 값 ${g.before} → ${g.after})`).toBe(true);
  expect(s.errs, s.errs.join(' | ')).toEqual([]);
});

test('F2 ★음성대조 — 에셋은 «다른 함수»를 쓴다(공용 함수를 무력화해도 에셋은 산다)', async ({ page }) => {
  const s = await scene(page);
  const got = await page.evaluate(() => {
    window.addAssetBlock?.({});
    const ab = document.querySelector('.asset-block');
    return { found: !!ab, w: ab ? ab.offsetWidth : null,
      ml: ab ? (parseInt(ab.style.marginLeft) || 0) : null,
      canvas: document.getElementById('canvas').offsetWidth,
      toggle: !!window.state?.pageSettings?.padXExcludesAsset };
  });
  expect(got.found, '전제: 에셋 블럭이 섰다').toBe(true);
  expect(got.toggle, '전제: padXExcludesAsset 전역 토글이 켜져 있다(에셋 길의 입구 조건)').toBe(true);
  /* ★에셋은 삽입 때 applyExcludePadX 가 «스스로» 음수마진을 박는다 — 공용 함수를 안 거친다. */
  expect(`에셋 폭 ${got.w} · marginLeft ${got.ml}`)
    .toBe(`에셋 폭 ${got.canvas} · marginLeft ${-s.padX}`);
  expect(s.errs, s.errs.join(' | ')).toEqual([]);
});

test('F3 ★설계를 잠근다 — 자유배치 프레임 안에서는 되먹을 패딩이 «0»이다', async ({ page }) => {
  const s = await scene(page, { free: true });
  const got = await page.evaluate(() => {
    window.addChatBlock({ messages: [{ text: 'x', align: 'left' }] });
    const ch = document.querySelector('.chat-block');
    window.updateChatBlock(ch.id, { fullBleed: true });
    return { inFree: !!ch.closest('.frame-block[data-free-layout="true"]'),
      inlineW: ch.style.width || '(없음)', inlineML: ch.style.marginLeft || '(없음)' };
  });
  expect(got.inFree, '전제: 챗이 자유배치 프레임 «안»에 있다').toBe(true);
  /* ⛔「구멍」이 아니라 설계다 — absolute 배치라 full-bleed 가 뜻이 없다(에셋 가드와 같은 규약). */
  expect(`인라인 width=${got.inlineW} marginLeft=${got.inlineML}`)
    .toBe('인라인 width=(없음) marginLeft=(없음)');
  expect(s.errs, s.errs.join(' | ')).toEqual([]);
});
