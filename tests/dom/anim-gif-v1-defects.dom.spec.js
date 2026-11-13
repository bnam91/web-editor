/* anim-gif-v1-defects — 애니메이션 GIF V1 결함 6건(시트 0.9.12_별건 GIF-V1-* · 실앱 재현 DONE40 · 아이맥 2852c9f44).
 * ★잰다: 실제 모달(window.openAnimModal — 어드민 게이트는 UI 만 막는다) · 실제 효과 목록 클릭 · 미리보기 캔버스.
 *   requestAnimationFrame 을 «손으로 돌리는» 가짜로 바꿔 원하는 시점(t)의 프레임을 그리게 하고(고정 대기 0),
 *   미리보기 캔버스의 fillText 호출(글·x·정렬·폭)을 받아 적는다 — 프레임 그림과 같은 호출이다.
 * G1 ⑴ 카운트업 «12,345» — 0 부터 센다(옛: 0,345 → 12,345 · 첫 묶음만)
 * G1b ⑴ «3.5» — 0.0 부터(옛: 0.5 → 3.5 · 정수부만)
 * G2 ⑵·X3 슬롯 «8,765» — 자리마다 한 글자씩 그린다(릴) · «18» 잔상 없음 · 끝 = 원문
 * G3 ⑶ 타이핑 + 가운데 정렬 — 친 글자의 왼끝이 프레임마다 같다(옛: 글자가 늘 때마다 왼쪽으로 밀림)
 * G4 X1 타이핑 긴 글 — 줄바꿈해서 캔버스 폭 안(옛: 한 줄로 넘침)
 * G5 ⑷ 클래스 배경 섹션 — GIF 바탕 = 그 색(옛: 인라인만 읽어 흰색)
 * G5b [지킴] 인라인 단색 배경 — 그대로 그 색
 * G6 ⑹ 생성 실패 — 네이티브 대화상자 0 · 토스트로 알린다(옛: alert 가 창을 막음)
 * 전제(r0914gif 뒤): 가짜 rAF 는 엔진이 건 것만 잡는다 · 프레임마다 «엔진 rAF 가 걸렸다»를 조건 대기로 확인한다.
 * 양성대조: js/animation-engine.js 만 부모 판으로(git checkout <이 커밋>^ -- js/animation-engine.js) → G1·G1b·G2·G3·G4·G5·G6 빨강 · G5b 초록 → git checkout HEAD -- js/animation-engine.js
 * ⛔남은 것(이 파일이 안 잰다): ⑷ 그라데이션·이미지·메시 배경의 «모양» · ⑸ 리치텍스트 꾸밈 — 지디 결정 대기.
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

async function scene(page, { text, align, secClass, secInlineBg } = {}) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(async ({ text, align, secClass, secInlineBg }) => {
    if (secClass) { const st = document.createElement('style'); st.textContent = `.${secClass}{background:#1e2a44 !important}`; document.head.appendChild(st); }
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    await window.addSection();
    const sec = c.querySelector('.section-block');
    if (secClass) sec.classList.add(secClass);
    if (secInlineBg) sec.style.backgroundColor = secInlineBg;
    window.selectSection(sec);
    window.addTextBlock('body');
    const tb = [...sec.querySelectorAll('.text-block')].pop();
    const ce = tb.querySelector('[contenteditable]') || tb.querySelector('.tb-body');
    ce.textContent = text;
    if (align) ce.style.textAlign = align;
    window.__tb = tb;
    /* 손으로 돌리는 rAF — ★엔진(animation-engine.js)이 건 것만 잡는다. 앱의 다른 rAF(js/ 55곳)는 진짜 rAF 로 보낸다
       (r0914gif: 전부 잡았더니 앱 콜백이 엔진 tick 을 덮어 fillText 0 · 다음엔 __cb null). + fillText 받아 적기(미리보기 캔버스만) */
    const realRaf = window.requestAnimationFrame.bind(window), realCaf = window.cancelAnimationFrame.bind(window);
    window.__appRaf = 0;
    window.requestAnimationFrame = (cb) => {
      if ((new Error().stack || '').includes('animation-engine.js')) { window.__cb = cb; return -1; }
      window.__appRaf++; return realRaf(cb);
    };
    window.cancelAnimationFrame = (id) => { if (id === -1) window.__cb = null; else realCaf(id); };
    const orig = CanvasRenderingContext2D.prototype.fillText;
    window.__calls = [];
    CanvasRenderingContext2D.prototype.fillText = function (s, x, y, ...rest) {
      if (this.canvas.id === 'anim-preview-canvas') window.__calls.push({ s: String(s), x, y, align: this.textAlign, w: this.measureText(String(s)).width, cw: this.canvas.width });
      return orig.call(this, s, x, y, ...rest);
    };
    window.__frame = (t) => { window.__calls = []; const cb = window.__cb; window.__cb = null; cb(1000 + 1200 * t); return window.__calls; };   // 속도 1× = 1200ms
    window.__rafState = () => ({ engineCb: typeof window.__cb, appRaf: window.__appRaf, modal: document.getElementById('anim-gif-modal')?.style.display, active: document.querySelector('#anim-list .anim-item.active')?.dataset.id ?? null });
    window.openAnimModal(tb);
  }, { text, align, secClass, secInlineBg });
  return errs;
}
/** 효과를 고르고(진짜 목록 클릭) 그 효과의 t=0 을 먼저 그린다(시작 시각을 박는다). */
async function pick(page, id) {
  await page.click(`#anim-list .anim-item[data-id="${id}"]`);
  await frame(page, 0);
}
/** 전제: 엔진이 rAF 를 «걸었다» — 안 걸렸으면 무엇이 안 걸렸는지 찍고 빨강(고정 대기 아님 · 조건 대기). */
async function frame(page, t) {
  const ok = await page.waitForFunction(() => typeof window.__cb === 'function', null, { timeout: 5000 }).then(() => true, () => false);
  if (!ok) {
    const st = await page.evaluate(() => window.__rafState());
    expect(st.engineCb, `★전제: t=${t} 를 그리려는데 엔진 rAF 가 안 걸렸다 — ${JSON.stringify(st)} (modal≠flex = 모달 안 열림 · active≠고른 효과 = 클릭 안 먹음 · appRaf 만 늘면 엔진이 미리보기를 안 돌림)`).toBe('function');
  }
  return page.evaluate((t) => window.__frame(t), t);
}
const leftOf = (c) => (c.align === 'center' ? c.x - c.w / 2 : c.align === 'right' || c.align === 'end' ? c.x - c.w : c.x);

test('G1 ⑴ 카운트업 «12,345» — 0 부터 센다', async ({ page }) => {
  const errs = await scene(page, { text: '누적 판매 12,345개' });
  await page.click('#anim-list .anim-item[data-id="count-up"]');
  const f0 = await frame(page, 0);
  expect(f0.map((c) => c.s), '★첫 프레임이 «0» 이 아니다(옛: 0,345 — 첫 묶음만 셈)').toContain('누적 판매 0개');
  const fm = await frame(page, 0.5);
  expect(fm[0].s, '중간에도 뒤 «,345» 가 고정이면 옛 결함').toMatch(/^누적 판매 \d{1,2},\d{3}개$/);
  expect(fm[0].s.endsWith(',345개'), fm[0].s).toBe(false);
  const f1 = await frame(page, 1);
  expect(f1[0].s, '끝 = 원문').toBe('누적 판매 12,345개');
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('G1b ⑴ 카운트업 «3.5» — 0.0 부터(정수부만 세지 않는다)', async ({ page }) => {
  const errs = await scene(page, { text: '평점 3.5' });
  await page.click('#anim-list .anim-item[data-id="count-up"]');
  expect((await frame(page, 0))[0].s, '옛: 평점 0.5').toBe('평점 0.0');
  expect((await frame(page, 1))[0].s).toBe('평점 3.5');
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('G2 ⑵·X3 슬롯 «8,765» — 자리마다 릴 · 없는 숫자(+10 잔상) 없음 · 끝 = 원문', async ({ page }) => {
  const errs = await scene(page, { text: '8,765명' });
  await pick(page, 'slot-machine');
  const fm = await frame(page, 0.5);
  expect(fm.length, '전제: 그렸다').toBeGreaterThan(0);
  expect(fm.filter((c) => c.s.length > 1).map((c) => c.s), '★줄 통째로 그렸다 = 릴이 아니다').toEqual([]);
  expect(fm.some((c) => /18/.test(c.s)), '★«첫 묶음+10» 잔상').toBe(false);
  const f1 = await frame(page, 1);
  expect(f1.map((c) => c.s).join(''), '끝 = 원문(멈춘 릴은 한 글자만)').toBe('8,765명');
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('G3 ⑶ 타이핑 + 가운데 정렬 — 친 글자의 왼끝이 프레임마다 같다', async ({ page }) => {
  const errs = await scene(page, { text: '가운데 정렬 타이핑', align: 'center' });
  await pick(page, 'typewriter');
  const lefts = [];
  for (const t of [0.3, 0.6, 0.9]) { const f = await frame(page, t); expect(f.length, `전제: t=${t} 에 글자`).toBeGreaterThan(0); lefts.push(leftOf(f[0])); }
  expect(Math.max(...lefts) - Math.min(...lefts), `★왼끝이 움직였다 ${lefts.map((v) => v.toFixed(1))}`).toBeLessThanOrEqual(0.5);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('G4 X1 타이핑 긴 글 — 줄바꿈해서 캔버스 폭 안', async ({ page }) => {
  const long = '여러 줄로 감기는 아주 긴 문장입니다 이 문장은 블럭 폭보다 훨씬 길어서 반드시 여러 줄로 나뉘어야 합니다 끝';
  const errs = await scene(page, { text: long });
  await pick(page, 'typewriter');
  const f = await frame(page, 1);
  expect(f.length, '★한 줄로만 그렸다(줄바꿈 안 함)').toBeGreaterThan(1);
  for (const c of f) {
    expect(leftOf(c), `왼쪽 밖: «${c.s}»`).toBeGreaterThanOrEqual(-0.5);
    expect(leftOf(c) + c.w, `오른쪽 밖: «${c.s}» (캔버스 ${c.cw})`).toBeLessThanOrEqual(c.cw + 0.5);
  }
  expect(errs, errs.join(' | ')).toEqual([]);
});

const corner = (page) => page.evaluate(() => [...document.getElementById('anim-preview-canvas').getContext('2d').getImageData(1, 1, 1, 1).data].slice(0, 3));

test('G5 ⑷ 클래스(테마) 배경 섹션 — GIF 바탕 = 그 색', async ({ page }) => {
  const errs = await scene(page, { text: '배경 확인', secClass: 'qa-gif-theme' });
  await pick(page, 'fade-in');
  await frame(page, 0.5);
  expect(await corner(page), '★흰색이면 인라인만 읽은 것').toEqual([30, 42, 68]);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('G5b [지킴] 인라인 단색 배경 — 그대로', async ({ page }) => {
  const errs = await scene(page, { text: '배경 확인', secInlineBg: 'rgb(255, 224, 178)' });
  await pick(page, 'fade-in');
  await frame(page, 0.5);
  expect(await corner(page)).toEqual([255, 224, 178]);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('G6 ⑹ 생성 실패 — 네이티브 대화상자 없이 토스트', async ({ page }) => {
  const errs = await scene(page, { text: '실패 확인' });
  const dialogs = [];
  page.on('dialog', (d) => { dialogs.push(d.message()); d.dismiss(); });
  const r = await page.evaluate(async () => {
    const real = window.GIF;
    window.GIF = function () { throw new Error('주입 실패'); };
    try { await window.exportAnimGif(); } finally { window.GIF = real; }
    return { toast: document.getElementById('editor-toast')?.textContent || '', btn: document.querySelector('.anim-export-btn')?.disabled };
  });
  expect(dialogs, '★alert 가 떴다').toEqual([]);
  expect(r.toast, '토스트로 알린다').toContain('오류');
  expect(r.btn, '단추가 돌아온다').toBe(false);
  expect(errs, errs.join(' | ')).toEqual([]);
});
