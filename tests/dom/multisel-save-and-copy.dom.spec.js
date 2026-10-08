/* multisel-save-and-copy.dom.spec.js — C③④ 「멀티선택이 죽는다」 두 건.
 *   ③ multi-selected 가 «저장물»에 새어, 다시 열면 상자선택(⌘클릭 길)이 그 섹션을 건너뛴다.
 *   ④ 섹션 멀티선택 ⌘C⌘V 가 «1개»만 붙는다(3·5·7 을 골라도).
 *
 * ★양성대조 판 = 기준 sha 1fe77e38 (`GD1001_ROOT=/Users/a1/web-editor-gd-multisel-base`).
 *   ⛔HEAD 를 판으로 쓰지 않는다 — 핀된 별도 체크아웃이다.
 * ★사람이 하는 순서 — 섹션 «머리(.section-hitzone)»를 ⌘클릭으로 고르고, 키보드로 ⌘C/⌘V 를 누른다.
 *   손으로 classList.add('multi-selected') 하지 않는다(그 꼴이 앱에서 생기나부터 재라).
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

/** N개 섹션 — 머리(hitzone)는 실제 바인딩 대상이고, 몸통은 갭 하나. */
function secsHTML(n) {
  let out = '';
  for (let i = 1; i <= n; i++) {
    out += `<div class="section-block" id="ms${i}" data-section="${i}" data-name="S${i}" data-bg="#ffffff" style="background:#fff;">`
      + `<div class="section-hitzone" style="height:28px"><span class="section-label">S${i}</span></div>`
      + `<div class="section-inner"><div class="gap-block" data-type="gap" style="height:60px"></div></div></div>`;
  }
  return out;
}

/* ★앱이 «뜬다»를 단언한다 — 2026-10-09 지디 경고: 순환 import(text-style-kinds ↔
 *   prop-text-wireup-text-edit)가 «모듈 평가 시점»에 읽히면 TDZ 로 앱이 안 뜬다.
 *   그러면 아래 모든 측정이 «0개에서 0건»이 돼 조용히 초록으로 보일 수 있다.
 *   ⇒ 장면을 만들기 «전»에 pageerror 0건을 건다. errs 는 bootApp 이 모으는 그 배열 그대로. */
async function setup(page, n) {
  await page.setViewportSize({ width: 1500, height: 1000 });
  const errs = await bootApp(page);
  expect(errs, `★앱 부팅에 pageerror ${errs.length}건 — 아래 측정은 전부 무효다:\n${errs.join('\n')}`).toEqual([]);
  await page.evaluate((html) => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', html);
    window.rebindAll?.();
    window.deselectAll?.();
  }, secsHTML(n));
  await page.waitForTimeout(250);
  return errs;
}

/** 섹션 머리를 ⌘클릭 — 사람의 길. */
async function cmdClickSections(page, ids) {
  for (const id of ids) {
    const hz = page.locator(`#${id} > .section-hitzone`);
    await hz.scrollIntoViewIfNeeded();
    await hz.click({ modifiers: ['Meta'], force: true });
    await page.waitForTimeout(60);
  }
}

/** 지금 «여러 개 선택»으로 잡힌 섹션 id — multiSel 모델과 DOM 표식을 따로 센다. */
const selState = (page) => page.evaluate(() => ({
  modelIds: [...(window.multiSel?.sections || [])].map(s => s.id),
  markIds: [...document.querySelectorAll('#canvas .section-block.multi-selected')].map(s => s.id),
  secCount: document.querySelectorAll('#canvas .section-block').length,
}));

/* ══════════════════════════════════════════════════════════════════
   ③ «저장물»에 multi-selected 가 새는가
══════════════════════════════════════════════════════════════════ */
test('C3-전제 ★섹션 셋이 «정말» 골라졌다 — 이걸 먼저 단언한다(0개에서 「0건」은 항등식)', async ({ page }) => {
  await setup(page, 4);
  await cmdClickSections(page, ['ms1', 'ms2', 'ms3']);
  const s = await selState(page);
  expect(s.modelIds.sort()).toEqual(['ms1', 'ms2', 'ms3']);
  expect(s.markIds.sort()).toEqual(['ms1', 'ms2', 'ms3']);
});

test('C3 ★저장물에 multi-selected 가 0건이다', async ({ page }) => {
  await setup(page, 4);
  await cmdClickSections(page, ['ms1', 'ms2', 'ms3']);
  /* ★전제 — 세 개가 골라진 «뒤»에 재야 0건이 뜻을 가진다. */
  expect((await selState(page)).modelIds.length).toBe(3);

  const r = await page.evaluate(() => {
    const html = window.getSerializedCanvas();
    return {
      leak: (html.match(/multi-selected/g) || []).length,
      selectedLeak: (html.match(/\bselected\b/g) || []).length,
      len: html.length,
    };
  });
  expect(r.len).toBeGreaterThan(100);              // 전제: 직렬화가 «무언가» 냈다
  expect(r.leak).toBe(0);
});

test('C3b ★저장물을 다시 열면 상자선택(⌘클릭 길)이 그 섹션을 고른다', async ({ page }) => {
  await setup(page, 4);
  await cmdClickSections(page, ['ms1', 'ms2', 'ms3']);
  expect((await selState(page)).modelIds.length).toBe(3);   // 전제

  /* 저장 → 다시 열기(캔버스를 저장물로 갈아끼우고 rebindAll — save-load 의 열기 경로와 같은 두 줄). */
  await page.evaluate(() => {
    const html = window.getSerializedCanvas();
    const c = document.getElementById('canvas');
    c.innerHTML = html;
    window.rebindAll?.();
    window.deselectAll?.();
    window.multiSel?.sections.clear();
    window.multiSel?.cols.clear();
  });
  await page.waitForTimeout(200);

  /* 전제 — 다시 열린 판에 섹션 4개가 있고 «모델»은 비어 있다. */
  const after = await selState(page);
  expect(after.secCount).toBe(4);
  expect(after.modelIds.length).toBe(0);

  /* ★상자선택(scratch-pad.js) 의 섹션 길 = selectSectionWithModifier(sec,{metaKey:true}).
     그 길이 「이미 multi-selected 면 건너뛴다」는 가드를 지나는지 «그 길 그대로» 재라. */
  const got = await page.evaluate(() => {
    const picked = [];
    ['ms1', 'ms2'].forEach(id => {
      const sec = document.getElementById(id);
      if (!sec.classList.contains('multi-selected')) {
        window.selectSectionWithModifier?.(sec, { metaKey: true });
        picked.push(id);
      }
    });
    return { picked, model: [...(window.multiSel?.sections || [])].map(s => s.id) };
  });
  expect(got.picked.sort()).toEqual(['ms1', 'ms2']);   // 가드가 건너뛰지 않았다
  expect(got.model.sort()).toEqual(['ms1', 'ms2']);
});

test('C3c ★★«이미 샌» 저장물을 열어도 ⌘클릭 길이 산다 — 저장 쪽만 고치면 기존 파일은 안 낫는다', async ({ page }) => {
  await setup(page, 1);
  /* ★손으로 만든 장면이 아니다 — C3 가 «옛 판에서 실제로 나온» 그 꼴이다(저장물에 그 낱말 3건).
     여기선 그 «이미 오염된 proj.json» 을 ★제품의 열기 문(window.applyProjectData)으로 넣는다.
     ⛔canvas.innerHTML 에 직접 꽂지 않는다 — 그러면 sanitize·strip·rebindAll 을 건너뛰어
       「앱에서 정말 이렇게 되나」를 안 재는 장면이 된다. */
  const polluted =
    ['p1', 'p2', 'p3'].map((id, i) =>
      `<div class="section-block multi-selected" id="${id}" data-section="${i + 1}" data-name="P${i + 1}" data-bg="#ffffff" style="background:#fff;">`
      + `<div class="section-hitzone" style="height:28px"><span class="section-label">P${i + 1}</span></div>`
      + `<div class="section-inner"><div class="gap-block" data-type="gap" style="height:60px"></div></div></div>`).join('');

  const r = await page.evaluate((html) => {
    /* ⚠️`version: 2` ★필수 — 없으면 applyProjectData 가 «v1 하위호환» 갈래로 떨어져
       `data.pages` 를 ★안 보고 `data.canvas` 를 읽는다(그 갈래는 pages 를 새로 만든다).
       ★1차 구현이 그래서 섹션 0개였고, ★전제 단언(secCount===3)이 그걸 잡았다 —
       ★그 칸이 없었으면 「유령 0건」이 ★항등식으로 초록이 됐을 것이다(0개에서 0건). */
    window.applyProjectData({
      version: 2,
      pages: [{ id: 'page_1', name: 'Page 1', label: '', pageSettings: {}, canvas: html }],
      currentPageId: 'page_1',
    });
    return {
      secCount: document.querySelectorAll('#canvas .section-block').length,
      ghosts: document.querySelectorAll('#canvas .multi-selected').length,
    };
  }, polluted);

  /* ⑴ 전제 — 열기 문이 ★정말 세 섹션을 들였다(0개에서 「유령 0건」은 항등식) */
  expect(r.secCount).toBe(3);
  /* ⑵ 본 단언 — 라이브 DOM 에 유령이 0건 */
  expect(r.ghosts).toBe(0);

  /* ⑶ ★행위로 — 상자선택의 섹션 길이 그 셋을 «건너뛰지 않는다» */
  const got = await page.evaluate(() => {
    const picked = [];
    ['p1', 'p2', 'p3'].forEach(id => {
      const sec = document.getElementById(id);
      if (!sec.classList.contains('multi-selected')) {
        window.selectSectionWithModifier?.(sec, { metaKey: true });
        picked.push(id);
      }
    });
    return { picked, model: [...(window.multiSel?.sections || [])].map(s => s.id) };
  });
  expect(got.picked.sort()).toEqual(['p1', 'p2', 'p3']);
  expect(got.model.sort()).toEqual(['p1', 'p2', 'p3']);
});

/* ══════════════════════════════════════════════════════════════════
   ④ 섹션 멀티선택 ⌘C⌘V — 붙은 «개수»
══════════════════════════════════════════════════════════════════ */
for (const n of [3, 5, 7]) {
  test(`C4-${n} ★섹션 ${n}개 ⌘클릭 → ⌘C → ⌘V = +${n}`, async ({ page }) => {
    const total = n + 1;
    await setup(page, total);
    const ids = Array.from({ length: n }, (_, i) => `ms${i + 1}`);
    await cmdClickSections(page, ids);

    /* ⑴ 전제 단언 — «정말» n 개가 골라졌나. 이게 없으면 「+1」은 아무것도 안 잠근다. */
    const before = await selState(page);
    expect(before.modelIds.length).toBe(n);
    expect(before.secCount).toBe(total);

    await page.evaluate(() => document.activeElement?.blur?.());
    await page.keyboard.press('Meta+c');
    await page.waitForTimeout(120);
    await page.keyboard.press('Meta+v');
    await page.waitForTimeout(500);

    /* ★잰 값을 단언에 찍는다 — 빨강일 때 「몇 개 붙었나」가 보고에 그대로 남게. */
    const after = await selState(page);
    expect(`+${after.secCount - before.secCount}`).toBe(`+${n}`);
  });
}

test('C4-음성 ★1개만 골랐을 때는 1개가 붙는다(정상이 안 깨졌다)', async ({ page }) => {
  await setup(page, 3);
  const hz = page.locator('#ms2 > .section-hitzone');
  await hz.click({ force: true });                 // 평소 클릭 = 단일 선택
  await page.waitForTimeout(100);
  const before = await selState(page);
  expect(before.secCount).toBe(3);
  expect(await page.evaluate(() => document.querySelectorAll('#canvas .section-block.selected').length)).toBe(1);

  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Meta+c');
  await page.waitForTimeout(120);
  await page.keyboard.press('Meta+v');
  await page.waitForTimeout(500);
  expect((await selState(page)).secCount - before.secCount).toBe(1);
});
