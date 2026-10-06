/* ai-fill-structure.dom.spec.js — 「AI 섹션 채우기가 말풍선·불릿·라이너 구조를 지운다」(2026-10-03 AI 묶음 A · 데이터 유실).
 *
 * ★실측(실앱 + Gemini, scratchpad AI-MEASURE): 채우기 뒤
 *   말풍선 .tb-bubble 1·.tb-sender-name 1·svg 1 → 0·0·0 / 불릿 ul.tb-bullet>li → 0 / 라이너 .tb-liner 1 + svg → 0.
 *   래퍼(.text-block)에 글자만 남았다. 뿌리 = 읽기·쓰기 셀렉터 명부가 두 벌 + 쓰기의 `|| tb`(래퍼) 폴백.
 *   고침 = js/ai-text-slots.js 한 정본(findTextSlot/readTextSlot/writeTextSlot)을 읽기·쓰기가 같이 쓴다.
 *
 * 실제 앱(bootApp — index.html + 전 모듈) + 실제 입력: ✨ 버튼·범위 라디오·ID 칸 타이핑·「생성 → 적용」 모두 마우스·키.
 *   AI 서비스만 가짜다 — window.electronAPI.aiFillSectionTexts 가 «받은 블록 목록대로» 정해진 글자를 돌려준다
 *   (진짜 키·진짜 호출 없음). 블록은 앱 함수(addTextBlock·addSpeechBubbleBlock·addLinerBlock)로 만든다.
 *
 * 여기서 재는 것:
 *   F1 ★전체 섹션 — h1·body·불릿·말풍선·라이너 다섯이 «구조째» 살아남고 새 글자가 들어간다.
 *       말풍선: .tb-bubble 1 · .tb-sender-name 1(글자 그대로) · svg 1 / 불릿: ul 1 · li = 줄 수(기호 떼고) · li 속성 보존 /
 *       라이너: .tb-liner 1 · svg 1 · textPath 글자 == 미러 글자 == 새 글자(줄바꿈→공백) / 래퍼엔 맨 글자 노드 0 /
 *       토스트 = 실제로 쓴 수(5).
 *   F2 ★특정 블록만 — 말풍선·불릿 두 ID 만 골라 채우면 그 둘만 바뀌고 나머지 셋(h1·body·라이너)은 outerHTML 그대로.
 *   F3 ★저장 왕복 — 채운 뒤 serializeProject → 새로 띄워 applyProjectData 해도 세 구조와 새 글자가 그대로.
 *   F4 ★건너뛰기 — 글자 자리가 없는 text-block 으로 온 응답은 «쓰지 않고» 건너뛴다(래퍼 무변) · 토스트 수에서 빠지고 「1개 건너뜀」.
 *
 * ★양성대조: GD1001_ROOT=<37ab1c65 체크아웃> 로 돌리면 F1~F4 가 빨강이어야 한다(그 판은 래퍼에 쓴다).
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js ai-fill-structure --workers=1
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

/* 가짜 AI — style 별로 정해진 글자. 불릿은 «기호 붙은 줄»을 일부러 섞는다(매핑 규칙 ②를 잰다). */
const FILL = {
  'tb-h1': '새 대제목',
  'tb-body': '새 본문 문장입니다.',
  'tb-bullet': '첫째 항목\n- 둘째 항목\n\n• 셋째 항목',
  'tb-bubble': '말풍선 새 글',
  'tb-liner': '곡선 새 글\n둘째줄',
};
const BULLET_LINES = ['첫째 항목', '둘째 항목', '셋째 항목'];
const LINER_TEXT = '곡선 새 글 둘째줄';

async function installFakeAI(page, extraReps = []) {
  await page.evaluate(([FILL, extraReps]) => {
    const real = window.electronAPI;
    window.__aiPayloads = [];
    const fake = {
      aiFillSectionTexts: async (payload) => {
        window.__aiPayloads.push(JSON.parse(JSON.stringify(payload)));
        const replacements = payload.blocks.map(b => ({ id: b.id, text: FILL[b.style] ?? ('?' + b.style) }));
        return { ok: true, replacements: replacements.concat(extraReps), additions: [], extensions: {} };
      },
    };
    window.electronAPI = new Proxy(fake, { get: (t, k) => (k in t ? t[k] : real[k]) });
    window.__toasts = [];
    const origToast = window.showToast;
    window.showToast = (m, ...a) => { window.__toasts.push(String(m)); return origToast?.(m, ...a); };
  }, [FILL, extraReps]);
}

async function setup(page) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  const ids = await page.evaluate(() => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach(s => s.remove());
    window.addSection({ skipDefaultBlock: true, paddingY: 20 });
    const sec = c.querySelector('.section-block');
    sec.id = 'secAI';
    const add = (fn) => { window.selectSection(sec); fn(); };
    const before = new Set([...sec.querySelectorAll('.text-block')].map(t => t.id));
    const newest = () => { const t = [...sec.querySelectorAll('.text-block')].find(t => !before.has(t.id)); before.add(t.id); return t.id; };
    add(() => window.addTextBlock('h1'));             const h1 = newest();
    add(() => window.addTextBlock('body'));           const body = newest();
    add(() => window.addTextBlock('bullet'));         const bullet = newest();
    add(() => window.addSpeechBubbleBlock('left'));   const bubble = newest();
    add(() => window.addLinerBlock('arc-up'));        const liner = newest();
    // 불릿 li 에 속성·클래스를 달아 둔다 — 매핑이 «li 를 새로 만들어» 속성을 잃는지 잰다
    const li = document.querySelector(`#${bullet} li`); li.classList.add('li-keep'); li.dataset.keep = '1';
    window.deselectAll?.();
    return { h1, body, bullet, bubble, liner };
  });
  await page.evaluate(() => window.clearHistory?.());
  return { errs, ids };
}

/* 구조·글자 한 장 — 비교·판정에 같이 쓴다 */
const shape = (page, ids) => page.evaluate((ids) => {
  const q = (id) => document.getElementById(id);
  const strayText = (tb) => [...tb.childNodes].filter(n => n.nodeType === 3 && n.textContent.trim() !== '').map(n => n.textContent.trim());
  const B = q(ids.bubble), U = q(ids.bullet), L = q(ids.liner);
  return {
    bubble: B && { bubble: B.querySelectorAll('.tb-bubble').length, sender: B.querySelectorAll('.tb-sender-name').length,
      svg: B.querySelectorAll('svg').length, text: B.querySelector('.tb-bubble')?.textContent ?? null,
      senderText: B.querySelector('.tb-sender-name')?.textContent ?? null, stray: strayText(B) },
    bullet: U && { ul: U.querySelectorAll('ul.tb-bullet').length, li: [...U.querySelectorAll('ul.tb-bullet > li')].map(li => li.textContent),
      liKeep: [...U.querySelectorAll('ul.tb-bullet > li')].map(li => li.classList.contains('li-keep') && li.dataset.keep === '1'),
      ulPh: U.querySelector('ul.tb-bullet')?.dataset.isPlaceholder ?? null, stray: strayText(U) },
    liner: L && { mirror: L.querySelectorAll('.tb-liner').length, svg: L.querySelectorAll('svg.lnr-svg').length,
      mirrorText: L.querySelector('.tb-liner')?.textContent ?? null, svgText: L.querySelector('svg.lnr-svg textPath')?.textContent ?? null,
      stray: strayText(L) },
    h1: q(ids.h1) && { el: q(ids.h1).querySelectorAll('.tb-h1').length, text: q(ids.h1).querySelector('.tb-h1')?.textContent ?? null, stray: strayText(q(ids.h1)) },
    body: q(ids.body) && { el: q(ids.body).querySelectorAll('.tb-body').length, text: q(ids.body).querySelector('.tb-body')?.textContent ?? null, stray: strayText(q(ids.body)) },
  };
}, ids);

const outer = (page, ids) => page.evaluate((ids) => Object.fromEntries(Object.entries(ids).map(([k, id]) => [k, document.getElementById(id)?.outerHTML ?? null])), ids);

/* ✨ → 패널 — 실제 마우스. 섹션을 골라 툴바를 띄우고 버튼이 멈춘 뒤 누른다. */
async function openPanel(page) {
  await page.evaluate(() => { const s = document.getElementById('secAI'); window.selectSection(s); s.scrollIntoView({ block: 'center' }); });
  await page.waitForTimeout(300);
  const btn = page.locator('#secAI > .section-toolbar .st-ai-fill-btn');
  await expect(btn, '전제 — ✨ 버튼이 보인다').toBeVisible();
  await btn.click();
  await expect(page.locator('#ai-fill-panel.open'), '전제 — ✨ 를 누르면 AI 채우기 패널이 열린다').toBeVisible();
}
async function runFill(page) {
  const n0 = await page.evaluate(() => window.__aiPayloads.length);
  await page.locator('#ai-fill-panel-run').click();
  await page.waitForFunction((n0) => window.__aiPayloads.length > n0 && document.querySelector('#ai-fill-panel-run')?.disabled === false
    && window.__toasts.some(t => t.startsWith('✅')), n0, { timeout: 10000 });
  return page.evaluate(() => ({ payload: window.__aiPayloads.at(-1), toast: window.__toasts.filter(t => t.startsWith('✅')).at(-1) }));
}

function expectFilled(s) {
  expect(s.bubble, '말풍선 구조 — .tb-bubble·보낸이·꼬리 svg 가 하나씩 남는다').toMatchObject({ bubble: 1, sender: 1, svg: 1 });
  expect(s.bubble.text).toBe(FILL['tb-bubble']);
  expect(s.bubble.senderText, '보낸이 이름은 AI 슬롯이 아니다 — 글자 그대로').toBe('Your name');
  expect(s.bullet.ul, '불릿 ul 이 남는다').toBe(1);
  expect(s.bullet.li, '불릿 매핑 — 줄마다 li 하나(기호·빈 줄 제거)').toEqual(BULLET_LINES);
  expect(s.bullet.liKeep, 'li 속성·클래스 보존(기존 li 재사용 + 마지막 li 얕은 복제)').toEqual(BULLET_LINES.map(() => true));
  expect(s.bullet.ulPh, '글자가 들어갔으니 안내문구 표식은 떨어진다').toBe(null);
  expect(s.liner, '라이너 구조 — 미러·svg 하나씩').toMatchObject({ mirror: 1, svg: 1 });
  expect(s.liner.mirrorText).toBe(LINER_TEXT);
  expect(s.liner.svgText, '★svg 미러가 새 글자와 같다(라이너 재렌더가 불렸다)').toBe(LINER_TEXT);
  expect(s.h1).toMatchObject({ el: 1, text: FILL['tb-h1'] });
  expect(s.body).toMatchObject({ el: 1, text: FILL['tb-body'] });
  for (const k of ['bubble', 'bullet', 'liner', 'h1', 'body']) expect(s[k].stray, `${k} 래퍼에 맨 글자 노드가 없다`).toEqual([]);
}

test.describe('AI 묶음 A — AI 채우기가 텍스트 변형의 구조를 지키는가', () => {
  test('F1 ★전체 섹션 — 다섯 블록이 구조째 살아남고 새 글자가 들어간다', async ({ page }) => {
    const { errs, ids } = await setup(page);
    await installFakeAI(page);
    const pre = await shape(page, ids);
    expect(pre.bubble, '전제 — 말풍선이 정상 구조로 만들어졌다').toMatchObject({ bubble: 1, sender: 1, svg: 1 });
    expect(pre.bullet.li.length, '전제 — 불릿 li 1개').toBe(1);
    expect(pre.liner.svgText, '전제 — 라이너 svg 가 미러를 비춘다').toBe(pre.liner.mirrorText);
    await openPanel(page);
    const { payload, toast } = await runFill(page);
    expect(payload.blocks.map(b => b.style).sort(), '읽기 — 다섯 다 «자기 style» 로 보낸다')
      .toEqual(['tb-body', 'tb-bubble', 'tb-bullet', 'tb-h1', 'tb-liner']);
    expectFilled(await shape(page, ids));
    expect(toast, '토스트 = 실제로 쓴 수').toBe('✅ 5개 블록 적용됨');
    expect(errs).toEqual([]);
  });

  test('F2 ★특정 블록만 — 고른 둘(말풍선·불릿)만 바뀌고 나머지는 그대로', async ({ page }) => {
    const { errs, ids } = await setup(page);
    await installFakeAI(page);
    const before = await outer(page, ids);
    await openPanel(page);
    await page.locator('#ai-fill-panel input[name="ai-fill-scope"][value="specific"]').click();
    const first = page.locator('#ai-fill-panel-scope-ids .ai-fill-panel-id-input').first();
    await first.click(); await page.keyboard.type(ids.bubble);
    await page.locator('#ai-fill-panel-id-add').click();
    await page.locator('#ai-fill-panel-scope-ids .ai-fill-panel-id-input').nth(1).click();
    await page.keyboard.type(ids.bullet);
    const { payload, toast } = await runFill(page);
    expect(payload.blocks.map(b => b.id).sort(), '전제 — 고른 둘만 보냈다').toEqual([ids.bubble, ids.bullet].sort());
    const s = await shape(page, ids);
    expect(s.bubble).toMatchObject({ bubble: 1, sender: 1, svg: 1, text: FILL['tb-bubble'], senderText: 'Your name', stray: [] });
    expect(s.bullet).toMatchObject({ ul: 1, li: BULLET_LINES, stray: [] });
    const after = await outer(page, ids);
    for (const k of ['h1', 'body', 'liner']) expect(after[k], `안 고른 ${k} 는 outerHTML 그대로`).toBe(before[k]);
    expect(toast).toBe('✅ 2개 블록 적용됨');
    expect(errs).toEqual([]);
  });

  test('F3 ★저장 왕복 — 채운 뒤 저장·다시 열어도 세 구조와 글자가 그대로', async ({ page }) => {
    const { ids } = await setup(page);
    await installFakeAI(page);
    await openPanel(page);
    await runFill(page);
    expectFilled(await shape(page, ids));
    const snap = await page.evaluate(() => window.serializeProject());
    const errs2 = await bootApp(page);
    await page.evaluate((d) => window.applyProjectData(d), JSON.parse(snap));
    await page.waitForTimeout(1200);
    const s = await shape(page, ids);
    expectFilled(s);
    expect(errs2).toEqual([]);
  });

  test('F4 ★건너뛰기 — 글자 자리 없는 text-block 으로 온 응답은 래퍼에 안 쓰고 건너뛴다', async ({ page }) => {
    const { errs, ids } = await setup(page);
    // 글자 자리가 없는 text-block(내용 요소 없음) — 응답이 그 id 로 온다
    await page.evaluate(() => {
      const inner = document.querySelector('#secAI .section-inner');
      const tf = document.createElement('div'); tf.className = 'frame-block'; tf.dataset.textFrame = 'true'; tf.id = 'ssBare';
      tf.innerHTML = '<div class="text-block" data-type="body" id="tbBare"></div>';
      inner.appendChild(tf);
    });
    await installFakeAI(page, [{ id: 'tbBare', text: '래퍼에 쓰면 안 되는 글자' }]);
    await openPanel(page);
    const { payload, toast } = await runFill(page);
    expect(payload.blocks.some(b => b.id === 'tbBare'), '읽기 — 자리 없는 블록은 보내지 않는다(쓰기와 같은 정본)').toBe(false);
    const bare = await page.evaluate(() => document.getElementById('tbBare').innerHTML);
    expect(bare, '★래퍼는 그대로 비어 있다').toBe('');
    expectFilled(await shape(page, ids));
    expect(toast, '토스트 — 쓴 수 5, 건너뛴 수 1').toBe('✅ 5개 블록 적용됨 · 1개 건너뜀');
    expect(errs).toEqual([]);
  });
});
