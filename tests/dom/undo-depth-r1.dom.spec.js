/* undo-depth-r1 — ⌘Z 깊이가 «1»에 갇히던 회귀(R1, 2026-10-03 현빈 「커맨드z가 한번밖에 안되지? 이전만큼 되질 않네」)
 * ──────────────────────────────────────────────────────────────────────────────────────
 * ★자(현빈 실제 프로젝트 proj_1786077501267 을 «읽기만» 얹어 잰 것과 같은 걸음): 블럭 10개를 차례로 지우고(클릭+Backspace) ⌘Z 10번.
 *   v0.9.3·v0.9.1 = 10개 다 돌아옴 / v0.9.4·v0.9.5·dev(68f56937) = 1개만. 첫 나쁜 커밋 = 3d49aae2(09-22, 이분 탐색).
 *   기전: 복원이 멱등이 아니면(채팅말풍선 style 형식 · padding 없는 섹션) undo 첫머리 구제가 매번 새 칸을 만들어 제자리.
 * ★실물 파일은 시험에 못 쓴다 ⇒ 그 프로젝트에서 «갈리게 만든 꼴»을 재료로 가진 작은 고정 판을 쓴다:
 *   ⑴채팅말풍선 블럭(그 프로젝트의 여는 태그 속성 그대로 · 말풍선 글만 바꿈) ⑵인라인 padding 없는 섹션.
 * ★양성대조 핀은 «둘»이다 — 서로 다른 것을 잰다(지디 2026-10-03 「다음 사람이 왜 핀이 둘인가를 알아야 한다」):
 *   핀① 3d49aae2(R1 이 들어온 판) = R1-a·R1-b·R1-c 빨강 — «고치려는 것»(⌘Z 깊이 1)을 잰다는 증거.
 *   핀② 1deee27c(3d49aae2 바로 앞) = R1-d 빨강 — «되살아나면 안 되는 것»(T-009⑨·T-005④㉡, 3d49aae2 가 막은 것)을 잰다는 증거.
 *   고친 판 = 전부 초록. 한 핀만 쓰면 한쪽이 공짜로 초록이다.
 * ★R1-d 는 3d49aae2 가 «막으려고» 들어온 것(T-009⑨·T-005④㉡ — ⌘Z «직후» push-before 편집 뒤 ⌘Z 가 두 걸음 먹던 것)을 지킨다:
 *   1deee27c(그 커밋 앞)에서 빨강이어야 이 시험이 그 축을 잰다는 증거다.
 * ⛔이 하네스로 못 재는 축: 실앱(Electron) — 렌더러 코드는 같다. 실앱 측정은 커밋 본문에 따로. */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const N = 10;

/* 그 프로젝트(proj_1786077501267 chb_qyvgqx1)의 블럭을 «꼴 그대로» — 속성·안쪽 마크업 원본, 말풍선 글만 바꿈·셋→둘.
   ★실측(2026-10-03): 그 프로젝트를 applyProjectData 로 연 «직후» 말풍선 style 이 이미
     `background: none rgb(253, 253, 253); color: rgb(17, 17, 17); …`(CSSOM 형식 — backgroundImage 가 «none» 으로 한 번 쓰인 꼴)이고,
     ⌘Z 복원 때 rebindAll 이 다시 그려 `background:#fdfdfd;…`(렌더 형식)가 된다 = 비멱등.
     ⚠️누가 연 직후 그 한 번을 쓰는지는 «미확정»(코드에서 못 찾음 — 작은 판으로 열면 안 생긴다) ⇒ 아래 setup 이 그 «결과»를 똑같이 만든다
       (bubble.style.backgroundImage = 'none'). R1-0 이 이 판에서 복원이 실제로 갈리는지 먼저 확인한다. */
const CHAT = `<div class="chat-block" id="chb_r1fix" data-type="chat" data-messages="[{&quot;text&quot;:&quot;첫 줄 말풍선&quot;,&quot;align&quot;:&quot;left&quot;},{&quot;text&quot;:&quot;오른쪽 말풍선&quot;,&quot;align&quot;:&quot;right&quot;}]" data-gap="30" data-font-size="38" data-bg-left="#fdfdfd" data-bg-right="#8f8f8f" data-color-left="#111111" data-color-right="#ffffff" data-radius="16" data-padding="47" style="padding: 47px; margin-left: -72px; margin-right: -72px; width: calc(100% + 144px); max-width: none;" data-profile-size="24" data-show-profile="0" data-bubble-padding="40" data-full-bleed="true" data-tail-scale="300" data-fb-max-w=""><div class="chb-msg chb-left" style="margin-bottom:30px;gap:8px"><div class="chb-wrap" style="padding-bottom:48px;max-width:70%"><div class="chb-bubble" style="background:#fdfdfd;color:#111111;font-size:38px;border-radius:16px;padding:40px"><div class="chb-btext" data-msg-idx="0">첫 줄 말풍선</div></div><svg class="chb-tail" viewBox="0 0 19 16" xmlns="http://www.w3.org/2000/svg" style="fill:#fdfdfd;width:57px;height:48px;bottom:30px"><path d="M18.3597 14.7395C9.25742 16.3944 2.32729 11.6364 0 9.05055L0.258587 1.29294C2.75826 1.81011 8.17136 2.27557 9.82631 0C9.56773 9.30914 16.5496 13.9637 18.3597 14.7395Z" transform="scale(-1,1) translate(-19,0)"></path></svg></div></div><div class="chb-msg chb-right" style="margin-bottom:30px;gap:8px"><div class="chb-wrap" style="padding-bottom:48px;max-width:70%"><div class="chb-bubble" style="background:#8f8f8f;color:#ffffff;font-size:38px;border-radius:16px;padding:40px"><div class="chb-btext" data-msg-idx="1">오른쪽 말풍선</div></div><svg class="chb-tail" viewBox="0 0 19 16" xmlns="http://www.w3.org/2000/svg" style="fill:#8f8f8f;width:57px;height:48px;bottom:30px"><path d="M18.3597 14.7395C9.25742 16.3944 2.32729 11.6364 0 9.05055L0.258587 1.29294C2.75826 1.81011 8.17136 2.27557 9.82631 0C9.56773 9.30914 16.5496 13.9637 18.3597 14.7395Z"></path></svg></div></div></div>`;
const gaps = (pfx) => Array.from({ length: N }, (_, i) => `<div class="row" data-layout="stack"><div class="gap-block" data-type="gap" id="${pfx}${i}" style="height:${30 + i}px"></div></div>`).join('');
/* ⑴ 채팅말풍선 + 갭 10 (섹션은 앱이 쓰는 인라인 padding 을 «가진» 꼴 — 비멱등 원천을 채팅 «하나»로 좁힌다) */
const FIX_CHAT = `<div class="section-block" id="rS1" data-section="1"><div class="section-hitzone"></div><div class="section-inner" style="padding-left: 32px; padding-right: 32px;">
  <div class="row" data-layout="stack">${CHAT}</div>${gaps('rg')}</div></div>`;
/* ⑵ 인라인 padding «없는» 섹션 + 갭 10 (채팅 없음 — 원천 둘째) */
/* ⑶ 비멱등 원천 «없는» 판(padding 있는 섹션 + 갭) — R1-d 용. ★원천이 있으면 그 갈림이 push-before 차단을 우연히 비켜 가
   T-009⑨ 결함을 «가린다»(실측: 채팅 판에선 1deee27c 에서도 R1-d 초록이었다). */
const FIX_PLAIN = `<div class="section-block" id="rS3" data-section="1"><div class="section-hitzone"></div><div class="section-inner" style="padding-left: 32px; padding-right: 32px;">${gaps('rg')}</div></div>`;
const FIX_PAD = `<div class="section-block" id="rS2" data-section="1"><div class="section-hitzone"></div><div class="section-inner">${gaps('rg')}</div></div>`;

async function setup(page, html) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate((h) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', h); window.rebindAll?.(); window.deselectAll?.();
    document.querySelectorAll('#canvas .chb-bubble').forEach(b => { b.style.backgroundImage = 'none'; });   // 실프로젝트를 연 직후 꼴(위 CHAT 주석)
  }, html);
  await page.waitForTimeout(300);
  await page.evaluate(() => window.clearHistory());   // 프로젝트를 «연» 순간과 같은 출발점
  await page.waitForTimeout(100);
  return errs;
}
const alive = (page) => page.evaluate((n) => Array.from({ length: n }, (_, i) => document.getElementById('rg' + i)).filter(Boolean).length, N);
async function deleteAll(page) {
  for (let i = 0; i < N; i++) {
    const p = await page.evaluate((id) => { const el = document.getElementById(id); el.scrollIntoView({ block: 'center' });
      const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, 'rg' + i);
    await page.mouse.click(p[0], p[1]);
    await expect.poll(() => page.evaluate((id) => document.getElementById(id)?.classList.contains('selected'), 'rg' + i), { timeout: 2000 }).toBe(true);
    await page.keyboard.press('Backspace');
    await expect.poll(() => page.evaluate((id) => !document.getElementById(id), 'rg' + i), { timeout: 2000 }).toBe(true);
  }
}
async function pressN(page, key, n) {
  await page.evaluate(() => { window.deselectAll?.(); document.activeElement?.blur?.(); });
  const trail = [];
  for (let i = 0; i < n; i++) { await page.keyboard.press(key); await page.waitForTimeout(120); trail.push(await alive(page)); }
  return trail;
}
const STEPS = Array.from({ length: N }, (_, i) => i + 1);   // 1,2,…,10

test('R1-0 전제 — 채팅말풍선이 «그려졌고» 복원하면 직렬화가 갈린다(이 판이 비멱등 원천을 실제로 품는다)', async ({ page }) => {
  const errs = await setup(page, FIX_CHAT);
  expect(errs, errs.join(' | ')).toEqual([]);
  expect(await page.evaluate(() => document.querySelectorAll('#chb_r1fix .chb-bubble').length), '★말풍선이 안 그려졌다 — 재료가 늙었다').toBeGreaterThan(0);
  const r = await page.evaluate(() => { const a = window.getSerializedCanvas(); window.restoreSnapshot({ canvas: a, settings: {}, selection: null }); const b = window.getSerializedCanvas(); return a === b; });
  expect(r, '★복원이 멱등이다 — 그러면 R1-a 의 빨강/초록이 이 원천을 안 잰다(재료를 다시 뽑아라)').toBe(false);
});
test('R1-a ★채팅말풍선 있는 판 — 블럭 10개 지우고 ⌘Z 10번 = 하나씩 10개 다 돌아온다', async ({ page }) => {
  await setup(page, FIX_CHAT);
  await deleteAll(page);
  expect(await alive(page)).toBe(0);
  expect(await pressN(page, 'Meta+z', N), '⌘Z 마다 살아난 수 — 1,1,1… 이면 깊이 1 에 갇혔다(R1)').toEqual(STEPS);
});
test('R1-b ★padding 없는 섹션 — 같은 자, 다른 원천', async ({ page }) => {
  await setup(page, FIX_PAD);
  await deleteAll(page);
  expect(await pressN(page, 'Meta+z', N)).toEqual(STEPS);
});
test('R1-c ⌘Z 10 → ⌘⇧Z 10 왕복 — 다시 하기도 하나씩 끝까지(되돌린 칸을 다시 찍어도 redo 꼬리가 산다)', async ({ page }) => {
  await setup(page, FIX_CHAT);
  await deleteAll(page);
  await pressN(page, 'Meta+z', N);
  expect(await pressN(page, 'Meta+Shift+z', N)).toEqual(STEPS.map(k => N - k));
});
test('R1-d ★지키는 시험 — ⌘Z «직후» push-before 편집 뒤 ⌘Z 는 «그 편집 하나»만 되돌린다(T-009⑨·T-005④㉡, 3d49aae2 가 막은 것)', async ({ page }) => {
  await setup(page, FIX_PLAIN);
  const h = (id) => page.evaluate((id) => document.getElementById(id).style.height, id);
  // ① push-after 편집 둘: A0 rg0 30→100 · A1 rg2 32→150
  await page.evaluate(() => { document.getElementById('rg0').style.height = '100px'; window.pushHistory('A0'); });
  await page.evaluate(() => { document.getElementById('rg2').style.height = '150px'; window.pushHistory('A1'); });
  await page.evaluate(() => { window.deselectAll?.(); document.activeElement?.blur?.(); });
  await page.keyboard.press('Meta+z'); await page.waitForTimeout(150);
  expect([await h('rg2'), await h('rg0')], '전제 — ⌘Z 로 A1 만 풀렸다').toEqual(['32px', '100px']);
  // ② ⌘Z «직후» push-before 편집 B: 찍고 나서 rg1 31→200
  await page.evaluate(() => { window.pushHistory('B'); document.getElementById('rg1').style.height = '200px'; });
  await page.keyboard.press('Meta+z'); await page.waitForTimeout(150);
  expect(await h('rg1'), '★⌘Z 가 B 를 안 풀었다').toBe('31px');
  expect(await h('rg0'), '★⌘Z 한 번이 «두 걸음» — A0 까지 풀렸다(T-009⑨·T-005④㉡ 되살아남)').toBe('100px');
  await page.keyboard.press('Meta+Shift+z'); await page.waitForTimeout(150);
  expect(await h('rg1'), '★⌘⇧Z 로 B 가 안 돌아온다 — 편집 결과가 스택에 안 찍혔다').toBe('200px');
});

/* ★R1-e — 복원 «직후» 같은 틱·몇 프레임 안의 편집이 복원된 칸에 섞이지 않는다 (2026-10-03 적대QA 가 9b5e5f31 에서 깬 것).
 *   첫 처방은 복원한 칸을 «두 프레임 뒤에 한 번 더» 찍었다. push-before 편집은 «꼭대기와 같다»에 걸려 칸을 안 만드니
 *   pos·len·seq 가드를 통과하고, 늦은 찍기가 그 편집을 복원된 칸에 구웠다 ⇒ 다음 ⌘Z 가 두 걸음(T-009⑨ 꼴 재발) +
 *   ⌘⇧Z 가 잘렸어야 할 꼬리를 되살렸다. 위험한 실제 자리 = 창이 숨거나 가려져 rAF 가 멈춘 동안 MCP 가 편집할 때.
 *   ⇒ 늦은 찍기를 뺐다(동기 찍기만). 이 시험은 그 «틈»을 rAF 를 붙잡아 일부러 넓혀 잰다. */
for (const hold of [0, 300]) test(`R1-e ★⌘Z 직후 ${hold ? 'rAF 300ms 정지 중' : '같은 틱'}의 push-before 편집(deleteBlock) 뒤 ⌘Z 는 한 걸음`, async ({ page }) => {
  await setup(page, FIX_PLAIN);
  const h = (id) => page.evaluate((id) => document.getElementById(id)?.style.height ?? null, id);
  await page.evaluate(() => { document.getElementById('rg0').style.height = '100px'; window.pushHistory('A0'); });
  await page.evaluate(() => { document.getElementById('rg2').style.height = '150px'; window.pushHistory('A1'); });
  await page.evaluate((hold) => {
    if (hold) { const r = window.requestAnimationFrame; window.requestAnimationFrame = (cb) => setTimeout(() => r(cb), hold); setTimeout(() => { window.requestAnimationFrame = r; }, hold + 50); }
    window.undo(); window.deleteBlock('rg3');
  }, hold);
  await page.waitForTimeout(hold + 400);
  expect(await h('rg3'), '전제 — rg3 가 지워졌다').toBe(null);
  await page.evaluate(() => { window.deselectAll?.(); document.activeElement?.blur?.(); });
  await page.keyboard.press('Meta+z'); await page.waitForTimeout(200);
  expect(await h('rg3'), '★⌘Z 가 지우기를 안 풀었다').toBe('33px');
  expect([await h('rg0'), await h('rg2')], '★⌘Z 한 번이 «두 걸음» — 지우기가 복원된 칸에 구워졌다').toEqual(['100px', '32px']);
  await page.keyboard.press('Meta+Shift+z'); await page.waitForTimeout(200);
  expect(await h('rg3'), '★⌘⇧Z 로 지우기가 안 돌아온다').toBe(null);
  await page.keyboard.press('Meta+Shift+z'); await page.waitForTimeout(200);
  expect([await h('rg3'), await h('rg2')], '★잘렸어야 할 redo 꼬리(A1)가 살아 돌아왔다 — 사용자 편집 유실').toEqual([null, '32px']);
});
