/* frame-empty-no-dashed.dom.spec.js — ⑸ 빈 프레임의 «점선 아웃라인»을 없앴다
 * (현빈 2026-10-06 「프레임블럭에는 처음에 왜 점선 아웃라인이 생기는지?? 없어도됨」
 *  ★지디가 대가를 그림으로 보여 드리고 받은 답 = 「흰 섹션 위의 빈 프레임이 눈에 안 들어오게 된다」를
 *  알고도 「없애라」 ⇒ 그 대가는 받아들인 것이다. 폐기 까닭은 css/editor-blocks.css 의 비석 주석에.)
 *
 * ★양성대조 = 지운 4줄을 ★되살린 판. 두 길이 있고 둘 다 2026-10-06 에 실측했다:
 *   ㉠ 핀 e7444dd3 — `GD1001_ROOT=<그 판 체크아웃> ...` ⇒ ★F1 빨강(dashed 2px 가 뜬다)
 *   ㉡ 이 레인에서 css/editor-blocks.css 의 비석 안 규칙을 주석 밖으로 되살리면 ⇒ ★F1 빨강
 *   (㉡ 이 「그 4줄이 ★원인」임을 ★같은 판에서 가린다 — 핀은 다른 변경도 함께 들었다)
 * ★지키는 검사(양쪽 판에서 초록이어야 한다):
 *   F2 선택하면 solid(선택 외곽선은 ★안 건드렸다) · F3 자식이 있으면 none ·
 *   F4 배송본엔 ★원래부터 안 나갔다(PNG 경로 · HTML 내보내기 CSS 수확) ⇒ 이 삭제는 편집 화면만 바꾼다
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const SEC = `<div class="section-block" id="fA" data-section="1" data-name="A" data-bg="#ffffff" style="background:#fff;">
  <div class="section-hitzone"><span class="section-label">A</span></div><div class="section-inner"></div></div>`;

/** 빈 프레임 하나를 만든다. ⚠️새로 만들면 ★selected 로 나온다 — 미선택 장면은 각 칸이 직접 푼다. */
async function setupEmptyFrame(page) {
  await page.setViewportSize({ width: 1500, height: 900 });
  await bootApp(page);
  await page.evaluate((html) => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', html);
    window.rebindAll?.(); window.deselectAll?.();
    window.selectSection?.(document.getElementById('fA'));
    window.addFrameBlock?.({});
  }, SEC);
  await page.waitForTimeout(350);
}

const probe = (page) => page.evaluate(() => {
  const f = document.querySelector('#canvas .frame-block:not([data-text-frame])');
  if (!f) return { err: 'frame 없음' };
  const cs = getComputedStyle(f);
  return {
    selected: f.classList.contains('selected'),
    children: f.children.length,
    outlineStyle: cs.outlineStyle,
    outlineWidth: cs.outlineWidth,
    inScaler: !!f.closest('#canvas-scaler'),
  };
});

test('F1 ★빈 프레임 ＋ 미선택 → outline 이 none 이다(점선이 안 뜬다)', async ({ page }) => {
  await setupEmptyFrame(page);
  // ★새로 만든 직후는 selected 라 solid 다 — 그 상태로 재면 이 검사는 «아무것도 안 잰다». 먼저 푼다.
  await page.evaluate(() => {
    document.querySelectorAll('#canvas .frame-block').forEach(f => f.classList.remove('selected'));
  });
  const s = await probe(page);
  // ★전제 단언 — 「빈 프레임 ＋ 미선택 ＋ #canvas-scaler 아래」가 실제로 섰다(그 셋이 옛 규칙의 조건이다)
  expect(s.err, '프레임이 생겼다').toBeUndefined();
  expect(s.children, `자식 수 (잰 값: ${s.children})`).toBe(0);
  expect(s.selected, '미선택').toBe(false);
  expect(s.inScaler, '#canvas-scaler 아래').toBe(true);

  expect(s.outlineStyle, `outline-style (잰 값: ${s.outlineStyle} ${s.outlineWidth})`).toBe('none');
});

test('F2 ★지키는 검사 — 선택하면 solid(선택 외곽선은 안 건드렸다)', async ({ page }) => {
  await setupEmptyFrame(page);
  await page.evaluate(() => document.querySelector('#canvas .frame-block:not([data-text-frame])').classList.add('selected'));
  const s = await probe(page);
  expect(s.selected, '★전제 — 선택 상태').toBe(true);
  expect(s.outlineStyle, `outline-style (잰 값: ${s.outlineStyle})`).toBe('solid');
});

test('F3 ★지키는 검사 — 자식이 있으면 none(옛 규칙도 none 이었다)', async ({ page }) => {
  await setupEmptyFrame(page);
  const s = await page.evaluate(() => {
    const f = document.querySelector('#canvas .frame-block:not([data-text-frame])');
    f.classList.remove('selected');
    const kid = document.createElement('div');
    kid.className = 'gap-block'; kid.dataset.type = 'gap'; kid.style.height = '40px';
    f.appendChild(kid);
    const cs = getComputedStyle(f);
    return { children: f.children.length, selected: f.classList.contains('selected'), outlineStyle: cs.outlineStyle };
  });
  expect(s.children, '★전제 — 자식 1개').toBe(1);
  expect(s.selected, '★전제 — 미선택').toBe(false);
  expect(s.outlineStyle, `outline-style (잰 값: ${s.outlineStyle})`).toBe('none');
});

test('F4 ★지키는 검사 — 배송본엔 원래부터 안 나갔다(이 삭제는 편집 화면만 바꾼다)', async ({ page }) => {
  await setupEmptyFrame(page);
  const out = await page.evaluate(async () => {
    const f = document.querySelector('#canvas .frame-block:not([data-text-frame])');
    f.classList.remove('selected');
    /* ⒜ PNG 경로 — 클론이 body 로 나가 #canvas-scaler 조상을 잃는다(그 기제를 잰다) */
    const clone = f.cloneNode(true);
    document.body.appendChild(clone);
    const cloneOutline = getComputedStyle(clone).outlineStyle;
    clone.remove();
    /* ⒝ HTML 내보내기 — 실제 수확기를 부른다 */
    let exp = null;
    try {
      const m = await import('/js/io/export-css-collect.js');
      const css = m.collectCanvasCss(document.getElementById('canvas'), document);
      const t = Array.isArray(css) ? css.join('\n') : String(css && (css.css || css.text) || css);
      exp = { len: t.length, hasScaler: t.includes('#canvas-scaler'), hasRule: /:not\(:has\(> \*\)\)/.test(t) };
    } catch (e) { exp = { err: String(e.message || e) }; }
    return { cloneOutline, exp };
  });
  expect(out.cloneOutline, `body 로 옮긴 클론의 outline (잰 값: ${out.cloneOutline})`).toBe('none');
  expect(out.exp.err, 'CSS 수확기가 돌았다').toBeUndefined();
  expect(out.exp.len, `수확 CSS 길이 (잰 값: ${out.exp.len}) — ★0이면 아무것도 안 잰 것이다`).toBeGreaterThan(100);
  expect(out.exp.hasScaler, "수확물에 '#canvas-scaler' 가 없다(EDITOR_ONLY_SEL 이 걸러낸다)").toBe(false);
  expect(out.exp.hasRule, '수확물에 옛 점선 규칙이 없다').toBe(false);
});
