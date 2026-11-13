/* panel-section-rules — 절 게이트 판독(_panel-sections.js readPanel) 규칙 셋의 양성·음성대조. (right-panel-unify U6 · 지디 261113)
 *   ⑴ «빈 머리 절» 자(liveControls)가 [role="button"](div 하위 접기 머리)도 센다 — 그리드 칸 고름 Content(안내 + 접힌 하위 접기 머리)
 *   ⑵ 읽기 전용 글(.prop-value-text)도 절 내용 — QA 패널 special:Checklist · template(§2-1 14 Template = QA Ticket · 전문 보기)
 *   ⑶ 색짝 = 바로 앞 형제가 «색 칸 자신» 또는 .prop-color-swatch — 옛 «앞 형제 안에 색 칸 하나라도» 는 색 든 목록 뒤 «추가» 단추를 Fill/Stroke 로 끌었다
 * 칸마다: [양성] 옛 자(LIVE_SEL_OLD / 옛 색짝 식)로 재면 그 꼴이 «걸린다» — 그래야 새 자의 초록이 공짜가 아니다.
 *         [음성] 새 자도 «진짜 빈 절» · «진짜 색짝»은 여전히 잡는다(규칙을 넓혀 눈멀지 않았다).
 * R1~R3 = 손 픽스처(setContent · 앱 무부팅) · R4 = 실제 그래프·배너02 패널(앱 부팅) — data-own 없이 ⑶ 만으로 소유 위반 0.
 *   (태양 가지 ui/rp-u6-fix 는 graph·banner02 추가 단추에 data-own=content 를 임시로 달았다 — 이 판(ca61b210e 위)엔 없다 ⇒ R4 가 «없어도 통과»를 보인다.)
 * ⛔고정 대기 0 · 앱 = bootApp(index.html + 레포 파일 · 크로미움).
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const { addKind } = require('./_block-roster-294.js');
const { loadSectionSpec, readPanel, judgePanel, LIVE_SEL_OLD } = require('./_panel-sections.js');

const SPEC = loadSectionSpec();
const EMPTY = (k) => `빈 머리 절: ${k} — 보이는 컨트롤 0(렌더러가 그 절을 안 내야 한다)`;

/** 패널 몸만 있는 쪽 — 절 HTML 을 넣는다(틀과 같은 껍데기: data-sec · .prop-sec-head > .prop-section-title · .prop-sec-body). */
const secHtml = (sec, title, body) => `<div class="prop-section" data-sec="${sec}"><div class="prop-sec-head"><div class="prop-section-title">${title}</div></div><div class="prop-sec-body">${body}</div></div>`;
async function fixture(page, sections) {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e.message)));
  await page.setContent(`<!doctype html><html><body><div id="panel-right"><div class="panel-body">${sections.join('')}</div></div></body></html>`);
  return errs;
}
const verdicts = async (page, live) => judgePanel(await readPanel(page, SPEC, live), SPEC);

test('R1 ⑴ 안내 + div[role=button] 하위 접기 머리만 있는 Content 는 «빈 절»이 아니다 · 진짜 빈 절은 여전히 잡는다', async ({ page }) => {
  const errs = await fixture(page, [
    secHtml('content', 'Content', `<div class="prop-hint">캔버스에서 칸을 고르세요</div>
      <div class="prop-section-title" id="fx-sub-toggle" role="button" tabindex="0" aria-expanded="false">칸 꾸미기 · 모든 칸</div>
      <div id="fx-sub-body" style="display:none"><input type="number" id="fx-sub-n"></div>`),
    secHtml('layout', 'Layout', '<div class="prop-hint">안내만</div>'),   // [음성] 진짜 빈 절
  ]);
  const now = await verdicts(page);
  expect(now.filter((v) => v.startsWith('빈 머리 절')), '새 자: content 는 통과 · layout(진짜 빈 절)은 잡는다').toEqual([EMPTY('layout')]);
  expect((await verdicts(page, LIVE_SEL_OLD)).filter((v) => v.startsWith('빈 머리 절')), '[양성] 옛 자는 content 도 «빈 절»로 잡았다').toEqual([EMPTY('content'), EMPTY('layout')]);
  expect(errs).toEqual([]);
});

test('R2 ⑵ 읽기 전용 글(.prop-value-text)만 있는 special·template 은 «빈 절»이 아니다 · 숨긴 글뿐이면 여전히 빈 절', async ({ page }) => {
  const errs = await fixture(page, [
    secHtml('special', 'Checklist', '<div class="prop-row"><span class="prop-value-text">☑ 첫 항목 · ☐ 둘째 항목</span></div>'),
    secHtml('export', 'Export', '<div class="prop-row" style="display:none"><span class="prop-value-text">숨은 글</span></div>'),   // [음성] 보이는 내용 0
    secHtml('template', 'Template', '<div class="prop-row"><span class="prop-value-text">QA-123 · 전문 보기</span></div>'),
  ]);
  const now = await verdicts(page);
  expect(now.filter((v) => v.startsWith('빈 머리 절')), '새 자: Checklist·Template 통과 · 숨은 글뿐인 Export 는 잡는다').toEqual([EMPTY('export')]);
  expect((await verdicts(page, LIVE_SEL_OLD)).filter((v) => v.startsWith('빈 머리 절')), '[양성] 옛 자는 읽기 전용 절을 «빈 절»로 잡았다')
    .toEqual([EMPTY('special:Checklist'), EMPTY('export'), EMPTY('template')]);
  expect(errs).toEqual([]);
});

/** 옛 색짝 식(⑶ 이전 readPanel) — 같은 컨트롤을 옛 식으로 재 «짝이 잡혔나»만 돌려준다(양성대조 재료). */
const oldPaired = (page, id) => page.evaluate((id) => {
  const c = document.getElementById(id), prev = c.previousElementSibling;
  return !!(c.closest('.prop-color-field')?.querySelector('input[type="color"]')
    || (prev?.matches?.('input[type="color"]') ? prev : prev?.querySelector?.('input[type="color"]')));
}, id);
const pairedNow = async (page, id) => (await readPanel(page, SPEC)).secs.flatMap((s) => s.controls).find((c) => c.id === id)?.pairedColor ?? null;

test('R3 ⑶ 색 든 목록 뒤 «추가» 단추는 색짝이 아니다 · 스와치·색 칸 바로 뒤 hex 는 여전히 색짝', async ({ page }) => {
  const errs = await fixture(page, [
    secHtml('content', 'Content', `
      <div class="fx-list"><div class="fx-item" data-sec-item><input type="text" id="fx-item-0"><div class="prop-color-swatch"><input type="color" id="fx-item-0-color"></div></div></div>
      <button class="prop-btn" id="fx-add">+ 항목 추가</button>`),
    secHtml('fill', 'Fill', `
      <div class="prop-row"><div class="prop-color-swatch"><input type="color" id="fx-fill-color"></div><input type="text" class="prop-color-hex" id="fx-fill-hex"></div>
      <div class="prop-row"><input type="color" id="fx-bg-color"><input type="text" class="prop-color-hex" id="fx-bg-hex"></div>`),
  ]);
  expect(await oldPaired(page, 'fx-add'), '[양성] 옛 식은 «추가» 단추를 색짝으로 잡았다').toBe(true);
  expect(await pairedNow(page, 'fx-add'), '새 식: 추가 단추는 색짝 아님').toBe(false);
  expect([await pairedNow(page, 'fx-fill-hex'), await pairedNow(page, 'fx-bg-hex')], '[음성] 스와치 뒤 · 색 칸 뒤 hex 는 여전히 색짝').toEqual([true, true]);
  expect((await verdicts(page)).filter((v) => /fx-add/.test(v)), '새 식: 추가 단추 소유 위반 0').toEqual([]);
  expect(errs).toEqual([]);
});

/* R4 — 실제 패널. 태양 가지가 임시로 단 data-own=content 없이도 ⑶ 만으로 두 «추가» 단추가 Content 소유로 판정된다. */
const REAL = [
  { cls: 'graph-block', entry: 'addGraphBlock', btn: 'grb-add-item' },
  { cls: 'banner02-block', entry: 'addBanner02Block', btn: 'bn2-line-add' },
];
for (const k of REAL) {
  test(`R4 ⑶ 실제 ${k.cls} 패널 — #${k.btn} 가 data-own 없이 Content 절에서 소유 위반 0 · 옛 식이면 색짝으로 끌렸다`, async ({ page }) => {
    await page.setViewportSize({ width: 1500, height: 1100 });
    const errs = await bootApp(page);
    await page.evaluate(async () => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); await window.addSection(); const sec = c.querySelector('.section-block'); window.__secEl = () => sec; });
    const r = await addKind(page, k);
    expect(r.err, '[전제] 블록이 들어갔다').toBeUndefined();
    await page.evaluate((id) => window.selectBlock(id), r.id);
    await expect(page.locator(`#panel-right #${k.btn}`), '[전제] 추가 단추가 떴다').toBeAttached();
    const pre = await page.evaluate((b) => { const e = document.getElementById(b); return { own: !!e.closest('[data-own]'), sec: e.closest('.prop-section[data-sec]')?.dataset.sec ?? null }; }, k.btn);
    expect(pre, '[전제] data-own 없음 · Content 절 안').toEqual({ own: false, sec: 'content' });
    expect(await oldPaired(page, k.btn), '[양성] 옛 식은 이 단추를 색짝으로 잡았다(앞 형제 안에 색 칸) — 아니면 이 칸은 ⑶ 을 안 잰다').toBe(true);
    expect(await pairedNow(page, k.btn), '새 식: 색짝 아님').toBe(false);
    expect((await verdicts(page)).filter((v) => v.includes(k.btn)), `★${k.btn} 소유 위반`).toEqual([]);
    expect(errs).toEqual([]);
  });
}
