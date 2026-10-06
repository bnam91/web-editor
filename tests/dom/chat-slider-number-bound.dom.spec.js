/* chat-slider-number-bound.dom.spec.js — ★「슬라이더와 숫자칸의 상한이 갈리면 ★조용히 깎인다」 (2026-10-06 ⒝ · 지디 발주)
 *
 * ★무엇을 재나 — ⒝ 에서 챗 패널의 숫자 상한 일곱 자리를 모델 경계(CHAT_NUM_BOUNDS)로 넓혔다. 그때 ★가장 조용한 함정이 이것이다:
 *     `<input type="range">` 는 ★value > max 를 ★max 로 «조용히» 깎는다. 경고도, 이벤트도 없다.
 *   ⇒ 숫자칸만 400 으로 넓히고 슬라이더를 60 에 두면 → 사람이 400 을 넣고 ★슬라이더를 건드리는 순간 60 으로 되돌아간다.
 *     ⛔화면도 모델도 «멀쩡해 보인다» — 사람은 「왜 안 먹지」만 느낀다. 그래서 ★행동으로 재야 한다.
 *
 * ★이 결함은 ★챗만의 것이 아니다 — 슬라이더＋숫자칸 쌍을 쓰는 모든 패널의 규약이다.
 *   ⇒ 여기서 ★챗으로 재고, 다른 패널로 넓히는 것은 별건(명부에 적는다).
 *
 * ★양성대조 — 상한을 «갈라» 두면 이 시험이 빨개진다:
 *     GD_CHB_BOUND_SPLIT=1 로 돌리면 하네스가 슬라이더 max 만 옛 값으로 되돌려 ★깎임을 재현한다.
 *     ⛔그 봉투 없이 초록인 것만으로는 「재고 있다」를 증명하지 못한다.
 *
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js tests/dom/chat-slider-number-bound.dom.spec.js --workers=1
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const SEC = `<div class="section-block" data-section="1" id="sB"><div class="section-hitzone"></div>
  <div class="section-inner" style="padding-left: 32px; padding-right: 32px;" data-padding-x="32"></div></div>`;

/** 슬라이더＋숫자칸 쌍 — ★dataset 키와 두 id 를 같이 든다. ⛔상한은 «적지 않는다»: 앱의 CHAT_NUM_BOUNDS 에서 읽는다. */
const PAIRS = [
  { key: 'padding',        label: '패딩',          range: 'chb-padding-range',        num: 'chb-padding-val' },
  { key: 'bubblePadding',  label: '말풍선 패딩',    range: 'chb-bubble-padding-range', num: 'chb-bubble-padding-val' },
  { key: 'bubbleMaxW',     label: '말풍선 최대폭',  range: 'chb-bubble-maxw-range',    num: 'chb-bubble-maxw-val' },
  { key: 'tailScale',      label: '꼬리 크기',      range: 'chb-tail-range',           num: 'chb-tail-val' },
  { key: 'profileSize',    label: '프로필 크기',    range: 'chb-profile-size-range',   num: 'chb-profile-size-num' },
  { key: 'profileOffsetY', label: '프로필 Y',       range: 'chb-profile-y-range',      num: 'chb-profile-y-num' },
  { key: 'profileGap',     label: '프로필 간격',    range: 'chb-profile-gap-range',    num: 'chb-profile-gap-num' },
];

async function fresh(page) {
  await page.setViewportSize({ width: 1700, height: 1100 });
  const errs = await bootApp(page);
  const id = await page.evaluate((h) => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', h);
    window.rebindAll?.();
    window.selectSection(document.getElementById('sB'));
    window.addChatBlock({ messages: [{ text: '안녕', align: 'left' }] });
    const b = document.querySelector('.chat-block');
    b.classList.add('selected');
    document.getElementById('chb-show-profile') || null;
    return b.id;
  }, SEC);
  return { errs, id };
}
/** 패널을 열고 «프로필 절까지» 보이게 한다 — 프로필 칸 셋은 토글 뒤에만 배선된다. */
async function openPanel(page, id) {
  await page.evaluate((id) => {
    const b = document.getElementById(id);
    b.dataset.showProfile = '1';
    window.showChatProperties(b);
  }, id);
  await page.waitForTimeout(120);
}

test('S0 ★전제 — 앱이 CHAT_NUM_BOUNDS 를 들고 있고, 쌍 명부가 그 표 «안»에 있다', async ({ page }) => {
  const { errs, id } = await fresh(page);
  await openPanel(page, id);
  /* ★이 전제가 없으면 아래 S1 이 「undefined 를 undefined 와 견준다」로 초록이 된다. */
  const have = await page.evaluate(() => {
    const B = window.__CHAT_NUM_BOUNDS;
    return B ? Object.keys(B) : null;
  });
  expect(have, '앱에 window.__CHAT_NUM_BOUNDS 가 없다 — 이 시험의 겨냥이 빗나갔다').not.toBeNull();
  for (const p of PAIRS) {
    expect(have, `${p.label}: 쌍 명부의 키 «${p.key}» 가 경계 표에 없다`).toContain(p.key);
  }
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('S1 ★슬라이더 max 가 숫자칸 max 와 «같다» — 갈리면 range 가 value 를 조용히 깎는다', async ({ page }) => {
  const { errs, id } = await fresh(page);
  await openPanel(page, id);
  const rows = await page.evaluate((pairs) => pairs.map(p => {
    const r = document.getElementById(p.range), n = document.getElementById(p.num);
    const B = window.__CHAT_NUM_BOUNDS[p.key];
    return { key: p.key, label: p.label,
      rMax: r ? r.max : null, nMax: n ? n.max : null,
      rMin: r ? r.min : null, nMin: n ? n.min : null,
      bMax: String(B.max), bMin: String(B.min) };
  }), PAIRS);
  for (const x of rows) {
    expect(x.rMax, `${x.label}: 슬라이더가 없다`).not.toBeNull();
    /* ★잰 값을 단언에 찍는다 — 빨강일 때 「무엇이었나」가 보이게. */
    expect(`${x.label} max 슬라이더=${x.rMax} 숫자=${x.nMax} 모델=${x.bMax}`)
      .toBe(`${x.label} max 슬라이더=${x.bMax} 숫자=${x.bMax} 모델=${x.bMax}`);
    expect(`${x.label} min 슬라이더=${x.rMin} 숫자=${x.nMin} 모델=${x.bMin}`)
      .toBe(`${x.label} min 슬라이더=${x.bMin} 숫자=${x.bMin} 모델=${x.bMin}`);
  }
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('S2 ★행동 — 숫자칸에 «모델 최대»를 넣고 슬라이더를 건드려도 값이 안 깎인다', async ({ page }) => {
  const { errs, id } = await fresh(page);
  await openPanel(page, id);
  for (const p of PAIRS) {
    const max = await page.evaluate((k) => window.__CHAT_NUM_BOUNDS[k].max, p.key);
    /* ⑴ 숫자칸에 모델 최대를 «사람처럼» 넣고 커밋(Enter) — 가드가 이 길로 커밋한다. */
    const f = page.locator(`#${p.num}`);
    await f.fill(String(max));
    await f.press('Enter');
    await page.waitForTimeout(120);
    const after = await page.evaluate(({ id, k }) => document.getElementById(id).dataset[k], { id, k: p.key });
    expect(Number(after), `전제: ${p.label} 숫자칸 커밋이 모델 최대(${max})를 썼다 — 실제 ${after}`).toBe(max);
    /* ⑵ 이제 «슬라이더를 건드린다». ★제 자리에서 input 을 한 번 — 사람이 집었다 놓은 꼴.
       ⛔슬라이더 max 가 더 작으면 range 가 value 를 그 max 로 깎아 두었으므로, 이 한 번이 값을 떨어뜨린다. */
    const slid = await page.evaluate((rid) => {
      const r = document.getElementById(rid);
      const shown = r.value;                       // ★range 가 «이미» 깎아 둔 값
      r.dispatchEvent(new Event('input', { bubbles: true }));
      return shown;
    }, p.range);
    await page.waitForTimeout(120);
    const after2 = await page.evaluate(({ id, k }) => document.getElementById(id).dataset[k], { id, k: p.key });
    expect(`${p.label}: 슬라이더가 보인 값=${slid} · 건드린 뒤 모델=${after2}`)
      .toBe(`${p.label}: 슬라이더가 보인 값=${max} · 건드린 뒤 모델=${max}`);
  }
  expect(errs, errs.join(' | ')).toEqual([]);
});
