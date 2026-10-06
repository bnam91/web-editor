/* modal-frameify — M1 「프레임화 하기」의 행동 (2026-10-04, M1 레인 · 설계 $S/reports/M1-DESIGN.md)
 *   M  변환 결과의 꼴 · 모달 정체성 0 · 가로 형태 거절(까닭 문구)
 *   P  패널 경로(진짜 change) · optgroup 둘 · 가로 형태 disabled+까닭 · 토스트 ⌘Z · 「되돌릴 수 없」 0회
 *   U  ⌘Z 한 걸음 · ⌘⇧Z · 깊이 · 이웃 이음매(push-before / push-after)
 *   K  자식이 재렌더 입구마다 살아남는다(G19 줄기) · 저장 왕복
 *   R6 프레임화 «뒤» 더한 본문 줄 = 본문 줄과 같은 글꼴·크기·색(지디 조건 2026-10-04)
 *   E  피그마 JSON — 글자가 빠짐없이·한 번씩 (PNG 내보내기 픽셀은 modal-frameify-pixel E2)
 * ★양성대조 판 = 커밋 sha 로 고정(GD1001_ROOT=<그 판 체크아웃>). pin 5015a2ab 에서는 frameifyModal 이 없어 M·P·U·K·R6·E 전부 빨강이어야 한다.
 * ⛔앱 무접촉 — bootApp(헤드리스 크로미움에 레포 파일만). */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const SEC = `<div class="section-block" id="sF" data-section="1" data-name="F"><div class="section-hitzone"></div><div class="section-inner" id="innerF" style="padding-left: 32px; padding-right: 32px;">
<div class="gap-block" data-type="gap" id="gTop" style="height:120px"></div>
<div class="gap-block" data-type="gap" id="gEnd" style="height:200px"></div></div></div>`;
const IDENT_SEL = '.modal-block, [data-type="modal"], [data-mdl-slot], [data-mdl-icon], [class*="tb-mdl"], [class*="mdl-"]';
const H_REASON = '가로로 늘어선 모달은 프레임이 세로로만 쌓여서 아직 그대로 옮길 수 없습니다';

async function setup(page) {
  await page.setViewportSize({ width: 1500, height: 1400 });
  const errs = await bootApp(page);
  await page.evaluate((h) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', h); window.rebindAll?.(); window.deselectAll?.();
  }, SEC);
  await page.waitForTimeout(300);
  return errs;
}
const putModal = (page, opts) => page.evaluate((o) => {
  const { row, block } = window.makeModalBlock(o);
  block.id = 'mdlT';
  document.getElementById('gTop').after(row);
  window.renderModalBlock(block); window.bindBlock?.(block); window.buildLayerPanel?.();
  window.clearHistory?.();
  return block.id;
}, opts);
async function clickEl(page, sel, dx = null, dy = null) {
  const p = await page.evaluate(([sel, dx, dy]) => { const el = document.querySelector(sel); el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect(); return [dx === null ? r.left + r.width / 2 : (dx < 0 ? r.right + dx : r.left + dx), dy === null ? r.top + r.height / 2 : r.top + dy]; }, [sel, dx, dy]);
  await page.mouse.click(p[0], p[1]);
  await page.waitForTimeout(120);
}
/** 모달을 «클릭으로» 고르고 패널 select 에 진짜 change 를 쏜다 — 함수 직접 호출이 아니라 사용자 길. */
async function frameifyByPanel(page) {
  await clickEl(page, '#mdlT');
  await expect.poll(() => page.evaluate(() => !!document.getElementById('mdl-variant')), { timeout: 2000 }).toBe(true);
  await page.selectOption('#mdl-variant', '__frameify');
  await page.waitForTimeout(150);
  return page.evaluate(() => document.querySelector('#innerF > .frame-block[data-full-width="true"]')?.id || null);
}
/* ★10-05 H11 ⒝: 프레임화 직후 = 오브젝트 선택 = 밖 (안으로 넣으려면 안쪽 블럭을 먼저 고른다) — 그 «먼저 고르기»를 진짜 클릭으로. */
async function drillIntoFrame(page, fid) {
  const id = await page.evaluate((fid) => { const ts = [...document.getElementById(fid).querySelectorAll('.text-block')]; return ts[ts.length - 1].id; }, fid);
  await page.waitForTimeout(400);
  await clickEl(page, `[id="${id}"]`, 20, null);
  await expect.poll(() => page.evaluate(([fid, id]) => document.getElementById(fid).classList.contains('selected') && document.getElementById(id).classList.contains('selected'), [fid, id]), { timeout: 2000, message: '[전제] 들어간 상태(프레임 + 안쪽 줄)' }).toBe(true);
}
const keyN = async (page, key, n = 1) => {
  await page.evaluate(() => { document.activeElement?.blur?.(); });
  for (let i = 0; i < n; i++) { await page.keyboard.press(key); await page.waitForTimeout(150); }
};

// ── M 변환 결과 ───────────────────────────────────────────────────────────────
const SHAPE = { plain: ['body'], dashed: ['body'], titled: ['heading', 'body'], 'icon-stack': ['icon', 'body'] };
for (const variant of Object.keys(SHAPE)) {
  test(`M1 ${variant} → 스택 프레임 + ${SHAPE[variant].join('·')} · 모달 정체성 0 · 글자(줄바꿈 포함) 그대로 · 본문 꼴이 프레임에 심김`, async ({ page }) => {
    const errs = await setup(page);
    await putModal(page, { variant, title: '배송 안내', text: '첫 줄\n둘째 줄', fontSize: 30 });
    const r = await page.evaluate(() => {
      const f = window.frameifyModal('mdlT');
      if (!f) return null;
      const kids = [...f.children].map(c => c.matches('.frame-block[data-text-frame]') ? (c.querySelector('.text-block').dataset.type) : (c.querySelector('.icon-block') ? 'icon' : c.className));
      /* ★★2026-10-07 — 「모달 정체성 0」을 ★두 자로 ★갈라 잰다(지디가 열었다 · 까닭은 아래 단언 주석).
         ⛔합친 조건은 ★한 글자도 약해지지 않는다 — 아래 단언 둘의 ★논리곱이 옛 `ident === 0` 과 ★같다. */
      const IDENT = '[data-type="modal"], [data-mdl-slot], [data-mdl-icon], [class*="mdl"]';
      const hits = [...f.querySelectorAll(IDENT)];
      const html = f.outerHTML;
      const at = html.indexOf('mdl');
      return { full: f.dataset.fullWidth, parent: f.parentElement.id, kids,
               /* ㉠ ★요소 자 — 매치 수 ＋ ★매치된 첫 요소를 ★찍는다(빨강일 때 «무엇이 남았나»가 보이게) */
               identSel: hits.length,
               identSelFirst: hits.length ? hits[0].outerHTML.slice(0, 200) : null,
               /* ㉡ ★낱말 자 — `outerHTML` 에 글자 `mdl` 이 있나 ＋ ★있으면 ★그 주변 80자(어느 글자가 걸렸나) */
               identWord: at >= 0,
               identWordCtx: at >= 0 ? html.slice(Math.max(0, at - 40), at + 40) : null,
               body: [...f.querySelectorAll('.text-block')].pop().querySelector('[class^="tb-"]').textContent, tpl: !!f.dataset.rowTextStyle, modalGone: !document.getElementById('mdlT') };
    });
    expect(r, '★frameifyModal 이 없다/거절했다').not.toBeNull();
    expect(r.full).toBe('true');
    expect(r.parent, '자리 — 모달만 든 row 를 갈아끼워 section-inner 직속').toBe('innerF');
    expect(r.kids).toEqual(SHAPE[variant]);
    /* ★★★2026-10-07 — 옛 단언은 ★`ident === 0` ★하나였고 ★두 항의 ★합이었다:
     *     `querySelectorAll(IDENT).length  +  (outerHTML.includes('mdl') ? 1 : 0)`
     *   ⛔그래서 ★빨강이 떴을 때 ★«어느 항이 1 이었나»를 ★못 가렸다 — ★자가 증상을 못 읽었다.
     *   ★실측(2026-10-06 전수 · 판 8a2e6f74): 이 M1 dashed 가 ★Expected 0 · Received 1 로 빨강.
     *     ★그런데 ★단독 재현 ★0/20 이었다(핀 d3092d8d 23/23 초록 · 내 것 혼자 23/23 초록 ·
     *     같은 판 워커1 ×5 ★115/115 · 워커3 ×5 ★115/115) ⇒ ★남은 변수는 «전수 환경»뿐이었다.
     *   ⇒ ★★그래서 ★자를 먼저 갈랐다 — ★다음 빨강이 ★그 자리에서 읽히게.
     * ⛔합친 조건은 ★약해지지 않았다 — 아래 둘의 ★논리곱이 옛 `ident === 0` 과 ★같다
     *   (옛 합이 0 ⟺ 매치 수 0 ★그리고 낱말 없음).
     * ★이 spec 은 ★fx-parity 범위 밖이었다 — ★지디가 「㉡ 를 먼저」로 ★열어 줬다(2026-10-07).
     * ★`IDENT_SEL`(이 파일 :16)은 `[class*="tb-mdl"]`·`[class*="mdl-"]` 를 덮는다 ⇒ ★낱말 자가 잡는 것은
     *   ★그 밖이다(id·style 같은 자리). ⛔그러나 ★단정하지 않는다 — ★찍힌 값으로 ★읽어라. */
    expect(`요소 ${r.identSel}개 · 첫 매치 ${r.identSelFirst}`,
      '★★모달 정체성 요소가 남았다 — 다음 rebindAll 이 자식을 지운다(위가 그 요소다)')
      .toBe('요소 0개 · 첫 매치 null');
    expect(`낱말 ${r.identWord} · 주변 ${r.identWordCtx}`,
      '★★outerHTML 에 글자 «mdl» 이 남았다 — ★주변 80자가 ★어느 글자인지 말한다(요소가 아닐 수 있다)')
      .toBe('낱말 false · 주변 null');
    expect(r.body).toBe('첫 줄\n둘째 줄');
    expect(r.tpl).toBe(true);
    expect(r.modalGone).toBe(true);
    expect(errs, errs.join(' | ')).toEqual([]);
  });
}
for (const variant of ['icon', 'grid-2']) {
  test(`M2 가로 형태 ${variant} — 거절(null) · 모달 그대로 · 까닭 문구`, async ({ page }) => {
    await setup(page);
    await putModal(page, { variant, text: '가로' });
    const r = await page.evaluate(() => { const before = document.getElementById('innerF').innerHTML; const f = window.frameifyModal('mdlT');
      return { f: !!f, same: before === document.getElementById('innerF').innerHTML, reason: window.canFrameifyModal(document.getElementById('mdlT')).reason }; });
    expect(r).toEqual({ f: false, same: true, reason: H_REASON });
  });
}

// ── P 패널 ────────────────────────────────────────────────────────────────────
test('P1 패널 — optgroup 「형태」(6)·「구조」(프레임화 하기) · select change 로 바뀐다 · 토스트에 ⌘Z · 「되돌릴 수 없」 0회', async ({ page }) => {
  await setup(page);
  await putModal(page, { variant: 'plain', text: '패널 길' });
  await page.evaluate(() => { window.__toasts = []; const o = window.showToast; window.showToast = (m) => { window.__toasts.push(String(m)); return o?.(m); }; });
  await clickEl(page, '#mdlT');
  const g = await page.evaluate(() => [...document.querySelectorAll('#mdl-variant optgroup')].map(x => ({ l: x.label, o: [...x.querySelectorAll('option')].map(o => o.value + ':' + o.textContent + (o.disabled ? ':off' : '')) })));
  expect(g.map(x => x.l)).toEqual(['형태', '구조']);
  expect(g[0].o.length).toBe(6);
  expect(g[1].o).toEqual(['__frameify:프레임화 하기']);
  const panelText = await page.evaluate(() => document.getElementById('prop-panel')?.innerHTML || document.body.innerHTML);
  expect(panelText).not.toContain('되돌릴 수 없');
  const fid = await frameifyByPanel(page);
  expect(fid, '★select change 로 프레임이 안 생겼다').toBeTruthy();
  const t = await page.evaluate(() => window.__toasts);
  expect(t.join('|')).toContain('⌘Z');
  expect(t.join('|')).not.toContain('되돌릴 수 없');
  const sel = await page.evaluate((id) => ({ sel: document.getElementById(id).classList.contains('selected'), active: window._activeFrame?.id }), fid);
  expect(sel).toEqual({ sel: true, active: fid });
});
for (const variant of ['icon', 'grid-2']) {
  test(`P2 가로 형태 ${variant} — 「프레임화 하기」 disabled · 까닭 툴팁(option·select 둘 다)`, async ({ page }) => {
    await setup(page);
    await putModal(page, { variant, text: '가로' });
    await clickEl(page, '#mdlT');
    const r = await page.evaluate(() => { const o = document.querySelector('#mdl-variant option[value="__frameify"]'); const s = document.getElementById('mdl-variant');
      return { dis: o?.disabled, ot: o?.title, st: s?.title }; });
    expect(r).toEqual({ dis: true, ot: H_REASON, st: H_REASON });
  });
}

// ── U ⌘Z ─────────────────────────────────────────────────────────────────────
test('U1 ★프레임화 → ⌘Z 한 번 = 앞 직렬화와 글자 단위로 같다 · 모달 dataset 전 키 같다 · 모달이 선택됨', async ({ page }) => {
  await setup(page);
  await putModal(page, { variant: 'titled', title: '제목', text: '본문', dropShadow: 'soft', radius: 10 });
  const pre = await page.evaluate(() => ({ ser: window.getSerializedCanvas(), ds: { ...document.getElementById('mdlT').dataset } }));
  const fid = await frameifyByPanel(page);
  expect(fid).toBeTruthy();
  await keyN(page, 'Meta+z');
  const post = await page.evaluate(() => ({ ser: window.getSerializedCanvas(), ds: document.getElementById('mdlT') ? { ...document.getElementById('mdlT').dataset } : null, sel: document.getElementById('mdlT')?.classList.contains('selected'), frame: !!document.querySelector('#innerF > .frame-block') }));
  expect(post.frame, '★⌘Z 한 번에 프레임이 안 사라졌다').toBe(false);
  expect(post.ds).toEqual(pre.ds);
  expect(post.ser === pre.ser, '★⌘Z 결과가 프레임화 «앞»과 다르다').toBe(true);
  expect(post.sel).toBe(true);
});
test('U1b 히스토리 꼭대기 이름 = 「프레임화 하기」 — «뒤» 표본(pushHistory)이 실제로 찍혔다', async ({ page }) => {
  await setup(page);
  await putModal(page, { variant: 'plain', text: '이름' });
  await frameifyByPanel(page);
  /* ⚠️undo() 첫머리 구제(ensureHistoryCheckpoint '현재 상태')가 빠진 끝 표본을 «메워» ⌘Z 자체는 한 걸음으로 돈다(V6 실측 — U1·U2 초록).
     그래서 끝 표본의 흔적 = 꼭대기 칸의 이름(getHistoryTip().action — 되돌리기 단추·⌘Z 안내가 읽는 그 칸)으로 잰다.
     (이 판 index.html 엔 #undo-btn 이 없다 — 첫 판이 그걸 읽어 "" 로 빨갰다.) */
  expect(await page.evaluate(() => window.getHistoryTip()?.action || '')).toBe('프레임화 하기');
});
test('U2 ⌘Z → ⌘⇧Z = 프레임·자식 id 그대로 돌아온다', async ({ page }) => {
  await setup(page);
  await putModal(page, { variant: 'icon-stack', text: '본문' });
  const fid = await frameifyByPanel(page);
  const ids = await page.evaluate((id) => [id, ...[...document.getElementById(id).querySelectorAll('[id]')].map(e => e.id)], fid);
  await keyN(page, 'Meta+z');
  await keyN(page, 'Meta+Shift+z');
  const back = await page.evaluate((id) => document.getElementById(id) ? [id, ...[...document.getElementById(id).querySelectorAll('[id]')].map(e => e.id)] : null, fid);
  expect(back).toEqual(ids);
});
test('U3 패널 편집(push-after) → 프레임화 → ⌘Z 두 번 = 편집 전', async ({ page }) => {
  await setup(page);
  await putModal(page, { variant: 'plain', text: '깊이', padX: 20 });
  await clickEl(page, '#mdlT');
  await page.fill('#mdl-padx-number', '44'); await page.press('#mdl-padx-number', 'Enter');
  await page.dispatchEvent('#mdl-padx-number', 'change');
  await page.waitForTimeout(100);
  expect(await page.evaluate(() => document.getElementById('mdlT').dataset.padX)).toBe('44');
  await page.selectOption('#mdl-variant', '__frameify'); await page.waitForTimeout(150);
  await keyN(page, 'Meta+z');
  expect(await page.evaluate(() => document.getElementById('mdlT')?.dataset.padX), '⌘Z 1 = 프레임화만').toBe('44');
  await keyN(page, 'Meta+z');
  expect(await page.evaluate(() => document.getElementById('mdlT')?.dataset.padX), '⌘Z 2 = 편집 전').toBe('20');
});
test('U4 ★삽입(push-before) «바로 뒤» 프레임화 → ⌘Z 한 번은 프레임화만 되돌린다(삽입은 남는다)', async ({ page }) => {
  await setup(page);
  await putModal(page, { variant: 'plain', text: '이음매' });
  await page.evaluate(() => { window.selectSection?.(document.getElementById('sF')); });
  await page.evaluate(() => { window.addGapBlock(77); });
  const gapId = await page.evaluate(() => [...document.querySelectorAll('#innerF .gap-block')].find(g => g.style.height === '77px')?.id);
  expect(gapId, '전제 — 삽입됐다').toBeTruthy();
  await page.evaluate(() => window.frameifyModal('mdlT'));
  await keyN(page, 'Meta+z');
  const r = await page.evaluate((g) => ({ modal: !!document.getElementById('mdlT'), gap: !!document.getElementById(g) }), gapId);
  expect(r, '★⌘Z 한 번이 삽입까지 먹었다(이음매 ⑴)').toEqual({ modal: true, gap: true });
  await keyN(page, 'Meta+z');
  expect(await page.evaluate((g) => !!document.getElementById(g), gapId), '⌘Z 2 = 삽입').toBe(false);
});
test('U4b ★날 push-before(찍고 나서 바꿈 · 끝 표본 없음) «바로 뒤» 프레임화 → ⌘Z 한 번은 프레임화만', async ({ page }) => {
  /* U4 의 addGapBlock 은 삽입 입구 래퍼(js/insert-history.js)가 «끝 표본»을 찍어 줘서 앞 표본(ensureHistoryCheckpoint)이 없어도 초록이었다(V5 실측).
     래퍼 밖의 날 push-before — R1-d 의 꼴 — 에서만 앞 표본이 «빠진 칸»을 메운다. */
  await setup(page);
  await putModal(page, { variant: 'plain', text: '이음매' });
  await page.evaluate(() => { window.pushHistory('B'); document.getElementById('gEnd').style.height = '333px'; });
  await page.evaluate(() => window.frameifyModal('mdlT'));
  await keyN(page, 'Meta+z');
  const r = await page.evaluate(() => ({ modal: !!document.getElementById('mdlT'), h: document.getElementById('gEnd').style.height }));
  expect(r, '★⌘Z 한 번이 날 편집까지 먹었다(앞 표본 없음)').toEqual({ modal: true, h: '333px' });
});
test('U5 프레임화 → 프레임에 줄 하나 → ⌘Z = 줄만 · ⌘Z = 모달', async ({ page }) => {
  await setup(page);
  await putModal(page, { variant: 'plain', text: '줄 더하기' });
  const fid = await frameifyByPanel(page);
  await drillIntoFrame(page, fid);   // 10-05 H11 ⒝: 프레임화 직후 = 오브젝트 선택 = 밖 (안으로 넣으려면 안쪽 블럭을 먼저 고른다)
  await page.evaluate(() => window.addTextBlock('body'));
  const n = (p) => p.evaluate((id) => document.getElementById(id)?.querySelectorAll('.text-block').length ?? -1, fid);
  expect(await n(page)).toBe(2);
  await keyN(page, 'Meta+z');
  expect(await n(page)).toBe(1);
  await keyN(page, 'Meta+z');
  expect(await page.evaluate(() => !!document.getElementById('mdlT'))).toBe(true);
});

// ── W ⒝(10-05 H11 · 지디 결정): 프레임화 직후 T = 밖 · 우회 = 안쪽 블럭을 먼저 고른다 ──────────────────
test('W1 ⒝ 프레임화 직후 바로 t → 새 줄은 프레임 «밖»(오브젝트 선택) — 프레임 줄 수 그대로', async ({ page }) => {
  await setup(page);
  await putModal(page, { variant: 'titled', title: '제목', text: '본문' });
  const fid = await frameifyByPanel(page);
  const n0 = await page.evaluate((id) => document.getElementById(id).querySelectorAll('.text-block').length, fid);
  const all0 = await page.evaluate(() => document.querySelectorAll('#canvas .text-block').length);
  await keyN(page, 't');
  expect(await page.evaluate((id) => document.getElementById(id).querySelectorAll('.text-block').length, fid), '★프레임 안 줄 수 그대로').toBe(n0);
  expect(await page.evaluate(() => document.querySelectorAll('#canvas .text-block').length), '[전제] 새 줄은 생겼다(밖에)').toBe(all0 + 1);
});
test('W2 ⒝ 우회 — 프레임화 → 안쪽 줄 클릭 → t → 새 줄은 프레임 «안»', async ({ page }) => {
  await setup(page);
  await putModal(page, { variant: 'titled', title: '제목', text: '본문' });
  const fid = await frameifyByPanel(page);
  const n0 = await page.evaluate((id) => document.getElementById(id).querySelectorAll('.text-block').length, fid);
  await drillIntoFrame(page, fid);
  await keyN(page, 't');
  expect(await page.evaluate((id) => document.getElementById(id).querySelectorAll('.text-block').length, fid), '★안쪽을 먼저 고르면 안으로').toBe(n0 + 1);
});

// ── K 살아남기 (G19 줄기) ─────────────────────────────────────────────────────
test('K1 ★프레임화 + 줄 셋 → rebindAll · 직렬화 왕복(로드) · ⌘Z⌘⇧Z · 패널 열기 — 자식 수 그대로 · 모달 정체성 0', async ({ page }) => {
  await setup(page);
  await putModal(page, { variant: 'titled', title: '제목', text: '본문' });
  const fid = await frameifyByPanel(page);
  await drillIntoFrame(page, fid);   // 10-05 H11 ⒝: 프레임화 직후 = 오브젝트 선택 = 밖 (안으로 넣으려면 안쪽 블럭을 먼저 고른다)
  await page.evaluate(() => { window.addTextBlock('body'); window.addTextBlock('body'); window.addTextBlock('body'); });
  const count = (p) => p.evaluate(([id, sel]) => { const f = document.getElementById(id); return f ? { tb: f.querySelectorAll('.text-block').length, ident: f.querySelectorAll(sel).length } : null; }, [fid, IDENT_SEL]);
  expect(await count(page)).toEqual({ tb: 5, ident: 0 });
  await page.evaluate(() => window.rebindAll());
  expect(await count(page), 'rebindAll').toEqual({ tb: 5, ident: 0 });
  await page.evaluate(() => { const s = window.getSerializedCanvas(); const c = document.getElementById('canvas'); c.innerHTML = s; window.rebindAll(); });
  expect(await count(page), '직렬화 왕복').toEqual({ tb: 5, ident: 0 });
  await keyN(page, 'Meta+z'); await keyN(page, 'Meta+Shift+z');
  expect(await count(page), '⌘Z⌘⇧Z').toEqual({ tb: 5, ident: 0 });
  await page.evaluate((id) => window.showFrameProperties(document.getElementById(id)), fid);
  expect(await count(page), '패널 열기').toEqual({ tb: 5, ident: 0 });
});

// ── R6 새 줄 = 본문 꼴 ───────────────────────────────────────────────────────
const KEYS = ['fontFamily', 'fontSize', 'color', 'lineHeight', 'fontWeight', 'letterSpacing', 'textAlign', 'fontStyle', 'textDecorationLine'];
const look = (sel) => `(() => { const ce = document.querySelector(${JSON.stringify(sel)}).querySelector('[class^="tb-"]'); const cs = getComputedStyle(ce); const tb = getComputedStyle(ce.closest('.text-block')); return { ${KEYS.map(k => `${k}: cs.${k}`).join(', ')}, padL: tb.paddingLeft, padT: tb.paddingTop, bg: tb.backgroundColor }; })()`;
for (const [name, opts, how] of [
  ['plain · 글꼴/크기/색/줄간격/자간/가운데 · T 키', { variant: 'plain', text: '본문', fontFamily: 'Georgia, serif', fontSize: 28, textColor: '#c0392b', lineHeight: 1.4, letterSpacing: 2, align: 'center' }, 'key'],
  ['titled · 기본 · addTextBlock', { variant: 'titled', title: '제목', text: '본문' }, 'api'],
  ['dashed · 기울임+형광펜 · addBlankTextBlock', { variant: 'dashed', text: '본문', italic: true, highlight: true, textColor: 'var(--color-brand, #2255aa)' }, 'blank'],
]) {
  test(`R6 ★프레임화 뒤 더한 줄 = 본문 줄과 같은 꼴 — ${name}`, async ({ page }) => {
    await setup(page);
    await putModal(page, opts);
    const fid = await frameifyByPanel(page);
    await drillIntoFrame(page, fid);   // 10-05 H11 ⒝: 프레임화 직후 = 오브젝트 선택 = 밖 (안으로 넣으려면 안쪽 블럭을 먼저 고른다)
    const ids = (p) => p.evaluate((id) => [...document.getElementById(id).querySelectorAll('.text-block')].map(t => t.id), fid);
    const pre = await ids(page);
    const bodyId = pre[pre.length - 1];
    if (how === 'key') { await page.evaluate(() => document.activeElement?.blur?.()); await page.keyboard.press('t'); await page.waitForTimeout(150); }
    else if (how === 'api') await page.evaluate(() => window.addTextBlock('body'));
    else await page.evaluate(() => window.addBlankTextBlock('body'));
    const newId = (await ids(page)).find(x => !pre.includes(x));
    expect(newId, '★새 줄이 프레임 안에 안 생겼다').toBeTruthy();
    const a = await page.evaluate(look(`#${bodyId}`));
    const b = await page.evaluate(look(`#${newId}`));
    console.log('[R6]', name, JSON.stringify({ a, b }));
    expect(b).toEqual(a);
  });
}

// ── E 내보내기 ────────────────────────────────────────────────────────────────
test('E3 피그마 JSON — 프레임화 뒤에도 글자가 빠짐없이·한 번씩 · 모달 generic 은 사라진다', async ({ page }) => {
  await setup(page);
  await putModal(page, { variant: 'titled', title: 'TITLE-XYZ', text: 'BODY-XYZ', dropShadow: 'soft' });
  const ex = () => page.evaluate(async () => {
    const ps = { bg: '#ffffff', padX: 0 }; const { state } = await import('/js/globals.js');
    state.pages = [{ canvas: document.getElementById('canvas').innerHTML, pageSettings: ps }]; state.pageSettings = ps;
    return JSON.stringify(window.buildFigmaExportJSON(null));
  });
  const before = await ex();
  await page.evaluate(() => window.frameifyModal('mdlT'));
  const after = await ex();
  const cnt = (s, w) => s.split(w).length - 1;
  console.log('[E3] before modal kind:', before.includes('"kind":"modal"'), 'after:', after.includes('"kind":"modal"'), 'shadow-ish after:', /shadow/i.test(after));
  expect([cnt(before, 'TITLE-XYZ'), cnt(before, 'BODY-XYZ')], '전제 — 모달 때 한 번씩').toEqual([1, 1]);
  expect([cnt(after, 'TITLE-XYZ'), cnt(after, 'BODY-XYZ')]).toEqual([1, 1]);
  expect(after.includes('"kind":"modal"')).toBe(false);
});
