/* rich-text-loss-axes.dom.spec.js — ★«부분 서식이 ★다른 길로 나갈 때 ★사는가»를 ★재서 ★적어 둔 것.
 *
 * ★★이 파일은 ★«측정 기록»이다. ⛔고치는 것이 ★아니다 — ★전부 `test.skip` 이다.
 *   ★돌면 ★지금의 ★손실을 ★잠근다(고치면 빨개진다) ⇒ ★★그래서 ★skip 이다.
 *   ★★고치는 사람은 ⒜ skip 을 ★떼고 ⒝ 단언을 ★뒤집어라. ★단언 메시지에 그렇게 적었다.
 *   ⇒ ★선례 = tests/dom/sz27-partial-format-wall.dom.spec.js (★같은 양식 · 지디 2026-10-08 판정 ③).
 *
 * ★★⛔이것은 ★«오늘 그랬다»를 ★잠그는 것이고 ★«처방»이 ★아니다 — 지디가 요구한 ★그 구분이다.
 *   ★무엇을 할지는 ★아래 ★판정 줄에 적혀 있고, ★그 판정은 ★지디·현빈 것이다.
 *
 * ══ 재는 것 (2026-10-08 실측 · 판 = `bd42465d` ＋ dev) ══════════════════════════
 *   전제(둘 공통): 모달 슬롯에 ★사람 순서로 부분 서식을 만든다
 *     → `plain:"AAABBBCCC"` · `html:"AAABBB<b>CCC</b>"` · 앱 판정자 `fmt:true`
 *
 *   ★L1 ★프레임화 (window.frameifyModal)
 *     실측: canFrameify {ok:true} → 프레임화 ★성공(모달 사라지고 frame-block 2)
 *           결과 글자칸 1개 · innerHTML = ★"AAABBBCCC" · ★서식 ★0 · textHtml 키 ★null
 *     ⇒ ★★부분 서식이 ★사라진다. ★글자는 ★산다.
 *     ★까닭(소스 일치): js/blocks/modal-frameify.js `_makeTextRow` 가 ★`ce.textContent = txt`
 *     ★★판정(지디 2026-10-08): ★★«별건» ＋ ★현빈께 ★알림(릴리스 노트 사실).
 *       까닭 ⒜ ★⌘Z 로 ★돌아온다 ⇒ ★«복구 불가»가 ★아니다
 *            ⒝ 고치는 일 = ★두 모델(★모달 dataset ↔ ★텍스트블럭 ★DOM 인라인)을 ★잇는 것 ⇒ ★작지 않다
 *            ⒞ ★수지② 가 ★요구한 것이 ★아니다(요구 = «영역 선택한 만큼 서식» · ★그건 섰다)
 *
 *   ★L2 ★피그마 내보내기 (window.buildFigmaExportJSON(null) ＋ ★flushCurrentPage)
 *     실측: JSON 535자 · ★모달 노드 ★있다 · ★글자 ★산다
 *           texts: [{"t":"AAABBBCCC","fs":36,"color":"#1c1c1e","slot":"text","x":0,"y":0}]
 *           ⇒ ★서식은 ★안 실린다(`<b>` 0 · Html 키 0)
 *     ★까닭(소스 일치): js/io/export-figma-json.js 가 `push('text', ds.textText)` — ★평문 키만 읽는다
 *     ★★★그리고 ★수신측도 ★받는 칸이 ★없다(2026-10-08 ★파일 읽기로 닫았다):
 *       figma-renderer/sangpe_to_figma.mjs 의 ★generic 분기(모달이 가는 길)는
 *       `create_text` 를 ★`text: t.t`(★평문 문자열) ★하나로 부르고, 서식은 ★노드 ★전체에 한 번씩만 준다
 *       (fontSize · fontColor · ★fontWeight 400 ★고정). ★Figma 의 ★부분 서식 API(setRange*)는
 *       ★레포 ★전체에 ★★0건이다.
 *     ★★판정(지디 2026-10-08): ★★«채널 모델 ★한계» ⇒ ⛔«손실»이 ★아니다 ⇒ ★별건에서도 ★빠진다.
 *     ⛔★그래서 ★이 축은 ★★«한계»로 적는다. ★«결함»으로 적지 마라.
 *
 * ══ ⛔못 잰 축 — ★이름으로 ════════════════════════════════════════════════
 *   ★Figma ★플러그인이 ★실제로 무엇을 그리나 — ★Figma 를 띄울 수 없다.
 *     위 L2 의 근거는 ★«렌더러 ★소스에 그 칸이 없다»＋★레포 전수 grep ★0건까지다. ⛔그 범위를 넘기지 마라.
 *   ★Electron 재기동 · ★파일로 쓰인 export · ★다른 배율(★100% 에서만 쟀다).
 *
 * ══ ★내 «자»가 이 측정에서 ★세 번 거쳤다 — ★다음 사람이 ★같은 데서 안 막히게 ════════
 *   ① `buildFigmaExportJSON()` 을 ★빈손으로 불렀다 — ★`(selectedIds, nodeMap)` 이고 ★`null` = ★전체다.
 *   ② ★그래도 `sections: []` 였다 ⇒ ★★내보내기는 ★`state.pages`(★직렬화본)를 돌고 ★라이브 DOM 을 ★안 본다
 *      ⇒ ★★`flushCurrentPage()` 가 ★빠진 단계였다. ★선례가 그걸 먼저 부른다(T12-gridcol-probe G3).
 *      ★★그 사실은 ★이 레포의 ★구조다 — ★다음 사람이 ★반나절 날릴 자리다.
 *   ③ ★그 ★180자 JSON 을 ★하마터면 ★「글자가 사라진다」로 올릴 뻔했다. ★막은 것은 ★★음성대조다 —
 *      ★평문 텍스트블럭을 ★앱 입구로 넣어도 ★안 실렸다 ⇒ ★★제품이 아니라 ★★내 ★장면이었다.
 *   ⇒ ★그래서 ★아래 두 벌은 ★전제를 ★단언한다(★모달 노드가 payload 에 있나 · ★글자가 있나).
 *
 * 실행(일부러 skip 이다): npx playwright test --config=tests/dom/playwright.dom.config.js rich-text-loss-axes
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');

const SEC = '<div class="section-block" id="sA" data-section="1" data-name="sA" style="background-color:#ffffff"><div class="section-hitzone"></div><div class="section-inner" id="inA"></div></div>';
const TXT = 'AAABBBCCC';
const OUTSIDE = { x: 800, y: 960 };

async function setup(page) {
  await page.setViewportSize({ width: 1600, height: 1000 });
  const errs = await bootApp(page);
  await page.evaluate((h) => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', h);
    window.rebindAll?.(); window.deselectAll?.(); window.applyZoom?.(100);
    document.getElementById('sA').classList.add('selected');
  }, SEC);
  await page.waitForTimeout(250);
  return errs;
}

/* 모달 슬롯에 ★사람 순서로 부분 서식을 만든다(⑤⑥·② 와 같은 관용구) */
async function makeFormattedModal(page) {
  const id = await page.evaluate(() => {
    const before = new Set([...document.querySelectorAll('#canvas [id]')].map(e => e.id));
    document.getElementById('sA').classList.add('selected');
    window.addModalBlock?.({});
    const f = [...document.querySelectorAll('#canvas .modal-block')].filter(e => !before.has(e.id));
    return f[f.length - 1]?.id || null;
  });
  await page.waitForTimeout(300);
  const s = `#${id} [data-mdl-slot="text"]`;
  await page.locator(s).first().scrollIntoViewIfNeeded();
  let r = await waitStableRect(page, s);
  await page.mouse.dblclick(r.cx, r.cy); await page.waitForTimeout(400);
  await page.keyboard.press('ControlOrMeta+a'); await page.keyboard.type(TXT);
  await page.waitForTimeout(200); await page.mouse.click(OUTSIDE.x, OUTSIDE.y); await page.waitForTimeout(500);
  await page.locator(s).first().scrollIntoViewIfNeeded();
  r = await waitStableRect(page, s);
  await page.mouse.dblclick(r.cx, r.cy); await page.waitForTimeout(400);
  await page.keyboard.press('End');
  for (let i = 0; i < 3; i++) await page.keyboard.press('Shift+ArrowLeft');
  await page.waitForTimeout(150);
  await page.keyboard.press('ControlOrMeta+b'); await page.waitForTimeout(200);
  await page.mouse.click(OUTSIDE.x, OUTSIDE.y); await page.waitForTimeout(500);
  const st = await page.evaluate((i) => {
    const b = document.getElementById(i);
    const e = b.querySelector('[data-mdl-slot="text"]');
    return { plain: b.dataset.textText ?? null, html: b.dataset.textHtml ?? null,
             fmt: window._stickerHtmlHasFormatting?.(e?.innerHTML || '') ?? null };
  }, id);
  return { id, st };
}

/* ══════════════════════════════════════════════════════════════════ */

test.skip('X1 ★프레임화 — 부분 서식이 ★사라진다 (2026-10-08 측정 기록 · 지디 판정 = ★별건)', async ({ page }) => {
  const errs = await setup(page);
  const { id, st } = await makeFormattedModal(page);
  console.log('  X1 전제:', JSON.stringify(st));
  expect(st.html, '★전제 — 부분 서식이 안 만들어졌다. 이 측정이 아무것도 안 잰다').toBeTruthy();
  expect(st.fmt, '★전제 — 앱 판정자가 서식을 못 본다').toBe(true);

  const r = await page.evaluate((i) => {
    const b = document.getElementById(i);
    const can = window.canFrameifyModal?.(b);
    if (typeof window.frameifyModal !== 'function') return { err: 'frameifyModal 이 없다' };
    window.frameifyModal(b.id);
    const frames = [...document.querySelectorAll('#canvas .frame-block')];
    const fr = frames[frames.length - 1] || null;
    const tbs = fr ? [...fr.querySelectorAll('[class^="tb-"]')] : [];
    return { can, stillModal: !!document.getElementById(i), frames: frames.length,
      tbCount: tbs.length, tbHtml: tbs.map(e => e.innerHTML).slice(0, 4),
      anyFmt: tbs.some(e => window._stickerHtmlHasFormatting?.(e.innerHTML) ?? false) };
  }, id);
  console.log('  X1 프레임화 뒤:', JSON.stringify(r));
  expect(r.err).toBeUndefined();
  expect(r.can?.ok, `★전제 — 이 모달은 프레임화가 안 된다. 잰 값 ${JSON.stringify(r.can)}`).toBe(true);
  expect(r.tbCount, `★전제 — 프레임 안에 글자칸이 안 생겼다. 잰 값 ${JSON.stringify(r)}`).toBeGreaterThan(0);
  /* ★글자는 ★산다 — 이건 ★지켜야 하는 것이다(여기가 빨개지면 ★더 나쁜 결함이다) */
  expect(r.tbHtml.join(''), `★★글자까지 사라졌다 — 이건 기록이 아니라 ★새 결함이다. 잰 값 ${JSON.stringify(r)}`).toContain(TXT);
  /* ★★지금의 ★손실을 ★기록한다. ★고치는 사람은 ★이 단언을 ★뒤집어라(toBe(true) 로). */
  expect(r.anyFmt, `★★부분 서식이 ★프레임화를 ★견딘다면 ★이 기록이 ★낡았다 — ★단언을 ★뒤집어라. 잰 값 ${JSON.stringify(r)}`).toBe(false);
  expect(errs).toEqual([]);
});

test.skip('X2 ★피그마 내보내기 — 글자는 산다 · 서식은 ★안 실린다 (지디 판정 = ★채널 모델 한계)', async ({ page }) => {
  const errs = await setup(page);
  const { st } = await makeFormattedModal(page);
  console.log('  X2 전제:', JSON.stringify(st));
  expect(st.html, '★전제 — 부분 서식이 안 만들어졌다').toBeTruthy();

  const r = await page.evaluate(() => {
    if (typeof window.buildFigmaExportJSON !== 'function') return { err: 'buildFigmaExportJSON 이 없다' };
    /* ★★전제 — 내보내기는 ★`state.pages`(직렬화본)를 돈다 · ★라이브 DOM 을 ★안 본다
       ⇒ ★flushCurrentPage() 가 ★없으면 ★sections:[] 가 온다(머리말 ②의 그 함정). */
    window.flushCurrentPage?.();
    let j; try { j = window.buildFigmaExportJSON(null); } catch (e) { return { err: String(e) }; }
    const s = JSON.stringify(j);
    return { len: s.length, hasModalNode: /"kind":"modal"/.test(s),
      hasPlainText: new RegExp('AAABBBCCC').test(s),
      hasFmtMarkup: /<b>|<\/b>|&lt;b&gt;|textHtml|data-text-html/.test(s),
      modalNode: (s.match(/"kind":"modal"[\s\S]{0,260}/) || [''])[0].slice(0, 260) };
  });
  console.log('  X2 내보낸 JSON:', JSON.stringify(r));
  expect(r.err).toBeUndefined();
  /* ★★전제 둘 — ★없으면 아래 「안 실린다」는 ★«안 쟀다»다(머리말 ③의 그 자리) */
  expect(r.hasModalNode, `★★전제 — JSON 에 ★모달 노드가 ★없다. 이 상태로는 ★아무것도 안 잰다. 잰 값 ${JSON.stringify(r)}`).toBe(true);
  expect(r.hasPlainText, `★★전제 — JSON 에 ★글자조차 없다. 잰 값 ${JSON.stringify(r)}`).toBe(true);
  /* ★★지금의 ★한계를 ★기록한다. ⛔«결함»이 아니다 — ★수신측에 ★받는 칸이 ★없다(머리말 참조).
     ★양쪽(보내는 쪽·받는 쪽)이 ★같이 리치텍스트를 ★갖추면 ★이 단언을 ★뒤집어라. */
  expect(r.hasFmtMarkup, `★★서식이 ★실린다면 ★이 기록이 ★낡았다 — ★단언을 ★뒤집어라. 잰 값 ${JSON.stringify(r)}`).toBe(false);
  expect(errs).toEqual([]);
});
