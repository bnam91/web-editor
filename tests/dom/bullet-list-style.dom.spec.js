/* bullet-list-style.dom.spec.js — ★T7. 현빈 2026-10-07:
 *   「[] ★불릿 텍스트 블럭 : ★스타일 변경가능하도록 (★불릿의 ★크기 및, ★모양 및 ★숫자 및 ★알파벳 등 ★★프리셋 필요)」
 *   판정(지디 2026-10-07): ★v1 = `list-style-type` ★한 축 ＋ ★크기(이미 된다) ＋ ★프리셋으로 묶기 · ★`ul` 유지.
 *
 * ══ ★착수 전 실측 — ★이 카드가 ★뒤집는 것 (★판 `4b36eb56`) ═══════════════════════════════
 *   ★불릿 블럭은 ★이미 있었다 — `<ul class="tb-bullet">` · 패널 Type 절의 ★「List」 단추.
 *     ⛔「없다」로 안 닫았다 — ★낱말 `bullet` 이 ★20파일, `불릿` 이 ★9파일에 있었다. ★행위로 만들어 봤다.
 *   ★네 칸 중 ★크기 = ★★이미 된다(36px → 18px). ⚠️내 1차 측정은 ★「안 된다」였고 ★틀렸다 —
 *     `change` 만 쏘고 ★`input` 을 ★안 쐈다. ★양성대조(같은 손잡이로 ★body 를 먼저)가 ★거짓 결함을 막았다.
 *   ★모양·숫자·알파벳 = ★안 됐다. ★근거 둘:
 *     ㉠ ★데이터 키 ★0개 — 블럭 dataset=['type'] · ul dataset=['placeholder','isPlaceholder'] · 인라인은 font-family 하나
 *     ㉡ ★`ul.dataset.bulletStyle='decimal'` 을 넣어도 computed 가 ★`disc` 그대로 ⇒ ★★«읽는 자»가 없었다(행위)
 *
 * ══ ★양성대조 명부 — ★칸 ★넷(빨강/★타임아웃=안 쟀다/초록/안 쟀다) ＋ ★음성대조 ═════════════
 *   판은 ★`GD1001_ROOT=<트리>` 로 갈아 끼운다(_root-harness.js). ⛔판을 HEAD 로 두면 전부 초록이다.
 *     ㉠ ★핀 `4b36eb56`(착수 전)        → ★B1·B2·B3·B4 ★빨강 / ★B5·B6 ★초록(지키는 자)
 *     ㉡ 변이 M-READ  인라인 쓰기 제거   → ★B2·B3 빨강
 *     ㉢ 변이 M-PANEL 절 자체 제거       → ★B1·B2·B3 빨강
 *     ㉣ 변이 M-GUARD 명부 검문 제거     → ★B4 빨강(명부 밖 값이 화면에 샌다)
 *     ㉤ ★★음성대조 M-NOOP 주석 한 줄만 바꿈 → ★★전부 초록이 ★정답(계측기가 무해한 변이에 안 흔들린다)
 *   ★각 판 ★×3 · ★원복 ★해시 검산 · ★판마다 `df`.
 *
 *   ══ ★★실측 (2026-10-07 · 판 6 × 3 = ★18런 · ★load 최댓값 ★69.91 · ★disk 최저 ★13G) ══════════
 *     판              ★빨강                      초록              ⚠️비고
 *     HEAD            —                          B1~B6 ★3/3        —
 *     ★PIN-4b36eb56   B1~B6 ★3/3                 —                 ＋★타임아웃 5줄
 *     M-READ          B2~B6(#1#2) · ★B1~B6(#3)   B1(#1#2)          ★★흔들림 1/3 ＋ 타임아웃 5줄
 *     M-PANEL         B1~B6 ★3/3                 —                 ＋타임아웃 5·4·3 ★흔들린다
 *     ★M-GUARD        ★★B4 «하나만» ★3/3         B1·B2·B3·B5·B6    ★★타임아웃 ★0 ← ★가장 깔끔
 *     ★음성대조 M-NOOP ★B1(#1 ★하나)              B1~B6(#2#3)       ⚠️★★1/3 ★빨강
 *
 *   ⛔★★「단언 빨강」과 「타임아웃(=안 쟀다)」을 ★★못 가렸다 — ★그 칸은 ★★«안 쟀다»다.
 *     까닭(내 흠 ★둘): ⑴ 러너가 ★`grep -c "Timeout"` 으로 ★«글자 든 줄 수»만 셌다(어느 test 인지 안 셌다)
 *                     ⑵ ★출력 원문을 ★변수에 담고 ★버렸다 ⇒ ★★사후에 못 가린다
 *                        (test-results 도 `preserveOutput:'failures-only'` 로 ★0개였다 — 「조사가 증거를 지운다」)
 *     ⇒ ★고쳤다: ★이 spec 의 ★`clickLst`(click 앞 전제 단언) ＋ ★러너 v2(아래 ★설계 요점).
 *   ★★★음성대조가 ★1/3 ★빨강이다 — ★★「전부 초록이 정답」이 ★깨졌다.
 *     ⇒ ★★그건 ★«변이 효과»가 아니라 ★★«계측기가 ★부하에 흔들린다»는 뜻이다(load ★69.91).
 *     ⇒ ★★그래서 ★M-READ #3 의 ★B1 빨강도 ★★같은 꼴일 수 있다 — ★변이 효과로 ★읽으면 안 된다.
 *     ⇒ ★★이름 붙여 올린다: ★★FLAKY ★B1 — 「흔들린다 ＋ ★1/3(음성대조에서도 1/3) ＋ 부하 69.91」
 *        ⛔「부하 탓」이라 ★라벨 붙이지 않는다 — ★원인 라벨은 다음 사람의 조사를 닫는다. ★수만 적는다.
 *        ⚠️★1/3 은 ★아직 ★수가 아니다 — ★조용한 창에서 ★×N 을 더 받아야 선다.
 *
 *   ══ ★러너 ★v2 설계 요점 (⛔스크래치패드는 사라진다 — ★여기 적어 ★재생 가능하게) ═════════════
 *     ⑴ ★출력 원문을 ★판·회차마다 ★파일로 남긴다(⛔변수에 담고 버리지 마라)
 *     ⑵ ★변이 뒤 ★`node --check` ★먼저 — 치환이 ★줄 반쪽을 잡아 ★문법이 깨지면 ★모듈이 안 떠
 *        ★«전부 빨강»이 된다. ★★그 빨강은 ★거짓이다 ⇒ ★★「빨강도 ★양성이 아니다」(지디 2026-10-07)
 *     ⑶ 판정은 ★test 이름별로 — ★「Test timeout of」가 ★그 블록에 들었으면 ★칸 ②「안 쟀다」
 *     ⑷ ★변이 주입은 ★md5 로 ★안 닫는다 — ★«노린 토큰이 사라졌나» ＋ ★원복 ★sha256 검산 ＋ 판마다 `df`
 *     ⑸ 판정 칸: OK / PATCH_FAILED / ★AIM_FAILED / ★RESTORE_FAILED / ★SYNTAX_BROKEN
 *
 * ⛔못 재는 축(하네스 한계 — _root-harness.js 머리말): 파일 저장/불러오기 · PNG 픽셀 · 단독 HTML · Figma JSON.
 *   ⇒ ★저장 왕복은 `serializeProject`→`applyProjectData` 로 ★잰다(B5). 그 밖은 ★미측정으로 적는다.
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

async function scene(page) {
  await page.setViewportSize({ width: 1500, height: 1000 });
  const errs = await bootApp(page);
  await page.evaluate(() => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', `<div class="section-block" id="bS" data-section="1"><div class="section-hitzone"></div><div class="section-inner">
      <div class="gap-block" data-type="gap" style="height:40px"></div><div class="row" id="bR" data-layout="stack"></div><div class="gap-block" data-type="gap" style="height:200px"></div></div></div>`);
  });
  await page.waitForTimeout(250);
  return errs;
}
/** 불릿 블럭 하나를 만들고 ★골라서 패널을 띄운다(사람이 하는 순서 — 만들기·고르기·열기). */
async function addBulletAndOpen(page, kind = 'bullet') {
  await page.evaluate(async (kind) => {
    const s = document.getElementById('bS'); s.classList.add('selected');
    window.addTextBlock?.(kind);
    await new Promise(r => setTimeout(r, 300));
  }, kind);
  await page.waitForTimeout(260);
  const sel = kind === 'bullet' ? '#bS ul.tb-bullet' : '#bS .text-block .tb-body';
  const xy = await page.evaluate((sel) => {
    const el = document.querySelector(sel); if (!el) return null;
    const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2];
  }, sel);
  if (!xy) return false;
  await page.mouse.click(xy[0], xy[1]);
  await page.waitForTimeout(380);
  return true;
}
const ulState = (page) => page.evaluate(() => {
  const ul = document.querySelector('#bS ul.tb-bullet');
  if (!ul) return null;
  const cs = getComputedStyle(ul);
  return { tag: ul.tagName, listStyleType: cs.listStyleType, fontSize: cs.fontSize,
           inlineLst: ul.style.listStyleType || '', li: ul.querySelectorAll('li').length };
});
/** ★★단추를 누르기 «전»에 ★그 단추가 있나를 ★단언한다 — ★이 한 벌이 ★칸을 가른다.
 *  ⛔`page.click(없는 셀렉터)` 는 ★30초 ★타임아웃으로 죽는다 ⇒ 그 빨강은 ★«단언 빨강»이 아니라
 *    ★★칸 ②「★안 쟀다」다. ★2026-10-07 실측: 핀 판에서 ★타임아웃 ★5줄이 나와
 *    ★「절이 없다」와 ★「값이 안 바뀐다」를 ★구분할 수 없었다(지디 지적 · 내 러너도 어느 test 인지 못 셌다).
 *  ⇒ ★여기서 ★먼저 막으면 ★빨강이 ★즉시·명확해지고 ★30초를 ★안 쓴다. ★그게 「검사는 자기 전제를 단언한다」다. */
async function clickLst(page, v) {
  const found = await page.evaluate((v) => {
    const sec = document.getElementById('bullet-style-section');
    return { sec: !!sec, btn: !!(sec && sec.querySelector(`[data-lst="${v}"]`)) };
  }, v);
  expect(found.sec, `[전제] 「글머리」 절이 없다 — ★${v} 를 누를 수 없다(절이 안 떴다)`).toBe(true);
  expect(found.btn, `[전제] ★${v} 단추가 없다 — 명부와 패널이 어긋났다`).toBe(true);
  await page.click(`#bullet-style-section [data-lst="${v}"]`);
  await page.waitForTimeout(260);
}
const panelState = (page) => page.evaluate(() => {
  const sec = document.getElementById('bullet-style-section');
  return {
    there: !!sec,
    btns: sec ? [...sec.querySelectorAll('[data-lst]')].map(b => b.dataset.lst) : null,
    active: sec ? [...sec.querySelectorAll('[data-lst].active')].map(b => b.dataset.lst) : null,
    /* ★★`prop-type-btn` 이 ★내 단추에 ★붙지 않았나 — 붙으면 wireTypeSection 이 물어 ★타입이 깨진다 */
    typeBtnLeak: sec ? sec.querySelectorAll('[data-lst].prop-type-btn').length : -1,
  };
});

/* ══ B1 ★패널이 ★불릿일 때만 뜬다 ═══════════════════════════════════════════════════ */
test('B1 ★「글머리」 절이 ★불릿일 때만 뜬다 · 단추 6개 · ⛔prop-type-btn 안 붙었다', async ({ page }) => {
  const errs = await scene(page);
  expect(errs).toEqual([]);
  expect(await addBulletAndOpen(page, 'bullet'), '[전제] 불릿을 만들고 골랐다').toBe(true);
  const p = await panelState(page);
  expect(p.there, '★불릿을 골랐는데 「글머리」 절이 안 떴다').toBe(true);
  expect(p.btns, '★단추가 명부(6)와 다르다').toEqual(['disc', 'circle', 'square', 'decimal', 'lower-alpha', 'upper-alpha']);
  expect(p.active, '★아무것도 안 고른 상태면 disc 가 보여야 한다(화면이 그러하므로)').toEqual(['disc']);
  /* ★★이 단언이 ★잠복 결함을 막는다 — `wireTypeSection` 이 `.prop-type-btn` 을 ★패널 전역으로 잡는다.
     ★붙이면 내 단추가 ★타입 전환 핸들러에 물려 `dataset.cls`=undefined 로 ★타입 클래스가 지워진다. */
  expect(p.typeBtnLeak, '★★내 단추에 `prop-type-btn` 이 붙었다 — wireTypeSection 이 물어 타입이 깨진다').toBe(0);

  // ★대조 — body 를 고르면 그 절이 ★없다(「눌리는데 아무 일도 안 난다」를 안 만든다)
  await scene(page);
  expect(await addBulletAndOpen(page, 'body'), '[전제] body 를 만들고 골랐다').toBe(true);
  expect((await panelState(page)).there, '★대조 실패 — body 에도 「글머리」 절이 떴다').toBe(false);
});

/* ══ B2 ★모양을 ★고르면 ★화면이 바뀐다 (현빈의 「모양」) ═════════════════════════════ */
test('B2 ★점·빈원·사각을 고르면 ★computed list-style-type 이 바뀐다 · 인라인에 실린다', async ({ page }) => {
  await scene(page);
  expect(await addBulletAndOpen(page), '[전제]').toBe(true);
  const before = await ulState(page);
  expect(before, '[전제] 아무것도 안 고른 불릿은 disc · 인라인 없음').toMatchObject({ tag: 'UL', listStyleType: 'disc', inlineLst: '' });
  for (const v of ['circle', 'square', 'disc']) {
    await clickLst(page, v);
    const s = await ulState(page);
    expect(s.listStyleType, `★${v} 를 골랐는데 화면이 안 바뀐다`).toBe(v);
    expect(s.inlineLst, `★${v} 가 인라인에 안 실렸다 — 「골랐나」를 못 가른다`).toBe(v);
  }
});

/* ══ B3 ★숫자·알파벳 (현빈이 ★따로 열거한 둘) ══════════════════════════════════════ */
test('B3 ★숫자(1.)·알파벳(a./A.) — ★`ul` 그대로 두고 뜬다(⛔ol 로 안 바꿨다)', async ({ page }) => {
  await scene(page);
  expect(await addBulletAndOpen(page), '[전제]').toBe(true);
  for (const v of ['decimal', 'lower-alpha', 'upper-alpha']) {
    await clickLst(page, v);
    const s = await ulState(page);
    expect(s.listStyleType, `★${v} 가 안 먹는다`).toBe(v);
    /* ★★태그는 `ul` ★그대로다 — 지디 2026-10-07 판정 ⑷.
       까닭: `ol` 로 바꾸면 ★소비자 둘이 그 태그를 본다(ai-text-slots.js `.tb-bullet` · block-drag.js:1241 `tb-bullet`→li).
       ★보이는 것은 같고 ★비용이 0 이라 `ul` 을 유지했다.
       ⚠️«의미»는 `ol` 이 맞다 — ★별건으로 올렸다. ⛔이걸 「버그」로 읽지 마라. */
    expect(s.tag, '★태그가 ul 이 아니다 — ol 로 바꾸면 AI 슬롯·인라인 편집이 그 태그를 본다(별건)').toBe('UL');
    expect(s.li, '★항목이 사라졌다').toBeGreaterThanOrEqual(1);
  }
});

/* ══ B4 ★명부 밖 값은 ★화면에 못 닿는다 ════════════════════════════════════════════ */
test('B4 ★명부 밖 값(「none」·「upper-roman」)은 ★거절된다 — 화면이 안 바뀐다', async ({ page }) => {
  await scene(page);
  expect(await addBulletAndOpen(page), '[전제]').toBe(true);
  await clickLst(page, 'decimal');
  expect((await ulState(page)).listStyleType, '[전제] 먼저 decimal 로 세웠다').toBe('decimal');
  /* ★단추의 값을 ★명부 밖으로 갈아끼운 뒤 눌러 본다 — 배선이 ★같은 명부로 검문하나 */
  const out = await page.evaluate(async () => {
    const b = document.querySelector('#bullet-style-section [data-lst="disc"]');
    b.dataset.lst = 'upper-roman';
    b.click();
    await new Promise(r => setTimeout(r, 260));
    const ul = document.querySelector('#bS ul.tb-bullet');
    return { computed: getComputedStyle(ul).listStyleType, inline: ul.style.listStyleType || '' };
  });
  expect(out.computed, '★★명부 밖 값이 화면에 샜다 — 배선의 검문이 죽었다').toBe('decimal');
  expect(out.inline, '★명부 밖 값이 인라인에 실렸다').toBe('decimal');
});

/* ══ B5 ★지키는 자 — 저장 왕복 · 크기는 ★이미 되는 것이 안 깨졌나 ═══════════════════ */
test('B5 ★지키는 자 — ①저장→다시 열기 뒤에도 모양이 남는다 ②크기(이미 되던 것)가 안 깨졌다', async ({ page }) => {
  await scene(page);
  expect(await addBulletAndOpen(page), '[전제]').toBe(true);
  await clickLst(page, 'lower-alpha');
  /* ★크기 — ★이미 되던 것(실측 2026-10-07). ⛔`input` ＋ `change` 둘 다 쏜다(그게 사람이 하는 꼴) */
  await page.evaluate(async () => {
    const n = document.getElementById('txt-size-number');
    if (!n) return;
    n.value = '18';
    n.dispatchEvent(new Event('input', { bubbles: true }));
    n.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise(r => setTimeout(r, 350));
  });
  const before = await ulState(page);
  expect(before, '[전제] 모양·크기 둘 다 섰다').toMatchObject({ listStyleType: 'lower-alpha', fontSize: '18px' });

  const snap = await page.evaluate(() => window.serializeProject());
  await bootApp(page);
  await page.evaluate((d) => window.applyProjectData(d), JSON.parse(snap));
  await page.waitForTimeout(420);
  const after = await page.evaluate(() => {
    const ul = document.querySelector('ul.tb-bullet');
    if (!ul) return null;
    const cs = getComputedStyle(ul);
    return { listStyleType: cs.listStyleType, fontSize: cs.fontSize, inlineLst: ul.style.listStyleType || '', tag: ul.tagName };
  });
  expect(after, '★왕복 뒤 불릿이 아예 없다').not.toBeNull();
  expect(after, '★왕복 뒤 모양·크기가 안 남았다').toMatchObject({ listStyleType: 'lower-alpha', fontSize: '18px', inlineLst: 'lower-alpha', tag: 'UL' });
  /* ★★＋`rebindAll` 까지 — 지디 2026-10-07: 「★인라인이니 ★당연히 저장된다」는 ★코드독해다.
     ★재렌더(=앱이 로드 뒤 실제로 거치는 길)를 ★한 번 더 지나서도 ★남는지 ★행위로 잰다. */
  const afterRebind = await page.evaluate(async () => {
    window.rebindAll?.();
    await new Promise(r => setTimeout(r, 300));
    const ul = document.querySelector('ul.tb-bullet');
    if (!ul) return null;
    const cs = getComputedStyle(ul);
    return { listStyleType: cs.listStyleType, fontSize: cs.fontSize, inlineLst: ul.style.listStyleType || '', tag: ul.tagName };
  });
  expect(afterRebind, '★rebindAll 뒤 불릿이 사라졌다').not.toBeNull();
  expect(afterRebind, '★★rebindAll(재렌더)이 사람이 고른 모양을 지웠다 — 저장은 됐는데 다시 그릴 때 잃는다')
    .toMatchObject({ listStyleType: 'lower-alpha', fontSize: '18px', inlineLst: 'lower-alpha', tag: 'UL' });
});

/* ══ B6 ★지키는 자 — ★타입 전환이 ★안 깨졌다 ══════════════════════════════════════ */
test('B6 ★지키는 자 — 모양을 고른 뒤 ★타입을 바꿔도 깨지지 않고, ★다시 List 로 오면 그 모양이 살아 있다', async ({ page }) => {
  await scene(page);
  expect(await addBulletAndOpen(page), '[전제]').toBe(true);
  await clickLst(page, 'square');
  expect((await ulState(page)).listStyleType, '[전제] square 를 세웠다').toBe('square');
  /* ★Body 로 — 타입 전환이 ★노드를 갈아끼운다(ul → div). ★타입 클래스가 살아야 한다 */
  await page.click('#type-section [data-cls="tb-body"]');
  await page.waitForTimeout(380);
  const asBody = await page.evaluate(() => {
    const el = document.querySelector('#bS .text-block > *');
    return { tag: el?.tagName ?? null, cls: el?.className ?? null, hasPanel: !!document.getElementById('bullet-style-section') };
  });
  expect(asBody.tag, '★타입 전환이 div 를 안 만들었다').toBe('DIV');
  expect(asBody.cls, '★★타입 클래스가 지워졌다 — 내 단추가 wireTypeSection 에 물렸다는 신호다').toContain('tb-body');
  /* ★다시 List 로 — ★인라인 선언이 속성 복사로 따라왔으므로 ★그 모양이 되살아난다(의도) */
  await page.click('#type-section [data-cls="tb-bullet"]');
  await page.waitForTimeout(400);
  const back = await ulState(page);
  expect(back, '★다시 List 로 왔는데 ul 이 아니다').toMatchObject({ tag: 'UL' });
  expect(back.listStyleType, '★사람이 고른 모양이 왕복에서 사라졌다(의도는 「되살아난다」)').toBe('square');
});
