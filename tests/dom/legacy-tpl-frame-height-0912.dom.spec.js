/* legacy-tpl-frame-height-0912.dom.spec.js — LEGACY-TPL-FRAME-ROWS-COLLAPSE-ON-RELOAD-01 (미카사 실앱)
 * 옛 공용 템플릿 「급하게 제품이 필요하신가요?」(templates/canvas/tpl_1775031581782.html · 프레임 style min-height:100px + data-height=100 ·
 *   style.height 없음 · 안 = .row[stack] > .col > .text-block ×3)을 넣고 아무것도 안 한 채 다시 열면 프레임이 100 에 갇히고 글이 안 보였다.
 * 뿌리: js/io/save-load.js rebindAll 프레임 복원 `if (_ssH) ss.style.height = _ssH + 'px'` 가 옛 «바닥»(min-height)을 «고정 높이»로 바꿨다.
 * 고침(지디 ㉮): style.height 비고 · minHeight == dataset.height · 비자유 프레임 = 옛 바닥 꼴 → height 를 박지 않는다.
 * 칸
 *   L1 넣기 → 저장 왕복(serializeProject → 다시 띄움 → applyProjectData) — 프레임 style.height 없음 · 높이 > 100 · 글 셋 다 높이 > 0 · 프레임 안에 보임
 *   L2 넣기 → 프레임 밖 간격 블럭 편집 → ⌘Z(되돌리기 = rebindAll 길) — L1 과 같은 단언
 *   N1 음성 — 사용자가 높이를 고정한 stack 프레임(style.height 300 · data-height 300)은 다시 열어도 300 고정
 *   N2 음성 — 자유(free) 프레임은 옛 꼴(min-height 만)이어도 다시 열면 height 를 박는다(무변)
 * 측정: 각 칸이 프레임 높이·글프레임 높이를 console.log(LTF0912 …)로 찍는다 — 고침 전 «글프레임 높이 0»(보고 때 추정한 고리)의 실제 값이 여기서 나온다.
 * 양성대조: save-load.js 의 `&& !_legacyFloor` 를 지우면 L1·L2 빨강(프레임 100 · 글 높이 0 또는 잘림) · N1·N2 초록.
 */
const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const TPL_ID = 'tpl_1775031581782';
const TPL_HTML = fs.readFileSync(path.join(__dirname, '../../templates/canvas', TPL_ID + '.html'), 'utf8');
const SEC = '<div class="section-block" id="sT" data-section="1" data-name="옛템플릿"><div class="section-hitzone"></div><div class="section-inner">'
  + '<div class="gap-block" data-type="gap" style="height:40px"></div>'
  + '<div class="row" id="rN1" data-layout="stack"><div class="frame-block" id="fN1" data-bg="#eeeeee" data-height="300" style="background:#eee;width:780px;margin:0 auto;min-height:300px;height:300px;">'
  + '<div class="frame-block" data-text-frame="true" id="tfN1" style="background:transparent;width:100%;"><div class="text-block" data-type="body" id="tbN1"><div class="tb-body">고정 높이 프레임 글</div></div></div></div></div>'
  + '<div class="row" id="rN2" data-layout="stack"><div class="frame-block" id="fN2" data-free-layout="true" data-bg="#dddddd" data-width="780" data-height="400" style="background:#ddd;width:780px;margin:0 auto;min-height:400px;">'
  + '<div class="frame-block" data-text-frame="true" id="tfN2" style="position:absolute;left:20px;top:20px;width:300px;"><div class="text-block" data-type="body" id="tbN2"><div class="tb-body">자유 프레임 글</div></div></div></div></div>'
  + '</div></div>';

async function setup(page) {
  await page.setViewportSize({ width: 1500, height: 1200 });
  const errs = await bootApp(page);
  const r = await page.evaluate(async ([html, sec, id]) => {
    const base = window.electronAPI;
    window.electronAPI = new Proxy({}, { get: (t, k) => (k === 'loadTemplateCanvas' ? async (x) => (x === id ? html : null) : base[k]) });
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', sec);
    window.rebindAll?.(); window.applyZoom?.(100);
    const S = document.getElementById('sT'); window.deselectAll?.(); window.selectSection?.(S);
    const before = new Set([...document.querySelectorAll('.frame-block')].map(f => f.id));
    await window.insertTemplate({ id, name: '급하게 제품이 필요하신가요?', type: 'subsection' });
    const F = [...document.querySelectorAll('#sT .frame-block:not([data-text-frame])')].find(f => !before.has(f.id));
    window.deselectAll?.();
    window.clearHistory?.();
    return { F: F ? F.id : null, h0: F ? F.offsetHeight : null };
  }, [TPL_HTML, SEC, TPL_ID]);
  expect(r.F, '[전제] 템플릿 프레임이 들어갔다').toBeTruthy();
  console.log('LTF0912 넣은 직후 높이 ' + r.h0);
  expect(r.h0, '[전제] 넣은 직후엔 글 따라 100 보다 크다').toBeGreaterThan(130);
  return { errs, ...r };
}

/** 프레임 높이 · style.height · 안 글 셋의 상자(높이 · 프레임 안에 드나) · 글프레임 높이. */
const frameState = (page, id) => page.evaluate((id) => {
  const f = document.getElementById(id);
  if (!f) return null;
  const fr = f.getBoundingClientRect();
  const tbs = [...f.querySelectorAll('.text-block')].map(tb => {
    const r = tb.getBoundingClientRect(); const tf = tb.closest('.frame-block[data-text-frame]');
    return { text: (tb.innerText || '').trim().slice(0, 12), h: Math.round(r.height), tfH: tf ? tf.offsetHeight : null, inside: r.top >= fr.top - 1 && r.bottom <= fr.bottom + 1 };
  });
  return { h: f.offsetHeight, styleH: f.style.height, tbs };
}, id);

async function reopen(page) {
  const snap = await page.evaluate(() => window.serializeProject());
  const errs = await bootApp(page);
  await page.setViewportSize({ width: 1500, height: 1200 });
  await page.evaluate((d) => { document.getElementById('canvas').innerHTML = ''; window.applyProjectData(JSON.parse(d)); }, snap);
  await page.waitForFunction(() => !!document.getElementById('sT'));
  return errs;
}

function expectHealthy(s, label) {
  expect(s, `${label} 프레임이 있다`).toBeTruthy();
  expect(s.styleH, `${label} 옛 바닥 꼴엔 고정 높이를 박지 않는다`).toBe('');
  expect(s.h, `${label} 프레임 높이 > 100(바닥에 안 갇힘)`).toBeGreaterThan(130);
  expect(s.tbs.length, `${label} 글 셋 그대로`).toBe(3);
  for (const t of s.tbs) {
    expect(t.h, `${label} 「${t.text}」 높이 > 0`).toBeGreaterThan(0);
    if (t.tfH !== null) expect(t.tfH, `${label} 「${t.text}」 글프레임 높이 > 0`).toBeGreaterThan(0);
    expect(t.inside, `${label} 「${t.text}」 프레임 안에 보인다`).toBe(true);
  }
}

test('L1 넣기 → 다시 열기 — 프레임이 100 에 안 갇히고 글 셋이 보인다', async ({ page }) => {
  const { F } = await setup(page);
  const errs = await reopen(page);
  const s = await frameState(page, F);
  console.log('LTF0912 L1 ' + JSON.stringify(s));
  expectHealthy(s, 'L1');
  expect(errs).toEqual([]);
});

test('L2 넣기 → 프레임 밖 블럭 하나 편집(간격 40→80) → ⌘Z(rebindAll 길) — 되돌린 판도 L1 과 같다', async ({ page }) => {
  const { errs, F } = await setup(page);
  /* 편집 한 수 = 다른 편집 길과 같은 꼴(변경 전 표본 → 바꿈 → 끝 표본). 대상은 프레임 «밖» 간격 블럭 — 되돌리기가 캔버스를 통째로 다시 깔며 rebindAll 을 타는지가 재는 것.
     ⛔⌘[ 는 못 쓴다: 넣은 프레임은 .row 안이라 프레임 갈래(editor.js moveSelectedBlocks)가 section-inner 직속 명부에서 못 찾아(-1) «위로»는 무동작이다(별건 FRAME-IN-ROW-BRACKET-JUMPS-TO-SECTION-TOP-01 · 인텔 실측). */
  const gapH = () => page.evaluate(() => document.querySelector('#sT > .section-inner > .gap-block').style.height);
  expect(await gapH(), '[전제] 간격 40').toBe('40px');
  await page.evaluate(() => {
    window.pushHistory?.();
    document.querySelector('#sT > .section-inner > .gap-block').style.height = '80px';
    window.pushHistory?.('간격 높이');
  });
  expect(await gapH(), '[전제] 간격 80 으로 바뀜').toBe('80px');
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Meta+z');
  await expect.poll(gapH, '[전제] ⌘Z 로 간격 40 으로 되돌아옴').toBe('40px');
  const s = await frameState(page, F);
  console.log('LTF0912 L2 ' + JSON.stringify(s));
  expectHealthy(s, 'L2');
  expect(errs).toEqual([]);
});

test('N1 음성 — 사용자가 고정한 stack 프레임(height 300)은 다시 열어도 300 고정', async ({ page }) => {
  await setup(page);
  const errs = await reopen(page);
  const s = await frameState(page, 'fN1');
  console.log('LTF0912 N1 ' + JSON.stringify(s));
  expect(s.styleH).toBe('300px');
  expect(s.h).toBe(300);
  expect(errs).toEqual([]);
});

test('N2 음성 — 자유 프레임은 옛 꼴(min-height 만)이어도 다시 열면 height 를 박는다(무변)', async ({ page }) => {
  await setup(page);
  const errs = await reopen(page);
  const s = await frameState(page, 'fN2');
  console.log('LTF0912 N2 ' + JSON.stringify(s));
  expect(s.styleH).toBe('400px');
  expect(errs).toEqual([]);
});
