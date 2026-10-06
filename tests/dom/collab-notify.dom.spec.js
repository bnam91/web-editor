/* collab-notify — 협업 «배선»(2026-10-06 지디 발주 TWO ⒜): 진짜 index.html 에서
 *   ⑴ 공용 문장 표(js/collab/reasons.js)가 실린다
 *   ⑵ 사건을 듣는 단 하나의 자리(js/collab/notify.js)가 collabSync 에 «실제로» 붙어 사건을 듣는다
 *   ⑶ S7 술어(isSettingsTabEnabled)가 초대 배지 boot 시점(DOMContentLoaded)에 «이미» 닿는다
 *
 * ★하네스 = bootApp(진짜 index.html · electronAPI 는 null 을 돌려주는 가짜). 앱·포트·서버 0.
 * ⛔COLLAB_ENABLED·MVP_DISABLED_TABS 값은 건드리지 않는다 — 지금 값(false · ['dev','collab'])에서 잰다.
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

test('W1 — reasons.js 가 실리고 notify.js 가 collabSync 에 붙어 있다', async ({ page }) => {
  const errs = await bootApp(page);
  const r = await page.evaluate(() => ({
    reasons: typeof window.CollabReasons?.text,
    notify: typeof window.collabNotify?.attached,
    attached: window.collabNotify?.attached?.(),
    sync: typeof window.collabSync?.onEvent,
    flag: window.COLLAB_ENABLED,
  }));
  expect(r.flag, '★전제: 킬스위치는 «꺼진 채» 잰다').toBe(false);
  expect(r.reasons).toBe('function');
  expect(r.sync, '★전제: sync.js 가 실렸다').toBe('function');
  expect(r.notify).toBe('function');
  expect(r.attached, 'notify.js 가 collabSync.onEvent 에 붙었다').toBe(true);
  expect(errs).toEqual([]);
});

test('W2 — notify.js 가 sync.js 의 사건을 «실제로» 듣는다(stop → stopped)', async ({ page }) => {
  await bootApp(page);
  const r = await page.evaluate(() => {
    const before = window.collabNotify.heard().length;
    window.collabSync.stop();                       // _cfg 없이도 'stopped' 를 낸다(sync.js stop) — 서버·스위치 무관
    const after = window.collabNotify.heard();
    return { before, n: after.length, last: after[after.length - 1] };
  });
  expect(r.n, '들은 사건 수가 하나 늘었다').toBe(r.before + 1);
  expect(r.last.type).toBe('stopped');
  expect(r.last.cls).toBe('status');
});

test('W3 — S7 술어가 DOMContentLoaded 순간에 «이미» 정의돼 있다(배지 boot 가 그때 읽는다)', async ({ page }) => {
  /* 이 리스너는 addInitScript 라 «어느 스크립트보다 먼저» 붙는다 ⇒ 배지의 DOMContentLoaded 리스너보다 먼저 돈다.
   * 여기서 정의돼 있으면 배지가 읽을 때도 정의돼 있다(같은 사건 · 더 이른 순번). */
  await page.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      window.__s7AtDCL = {
        type: typeof window.isSettingsTabEnabled,
        collab: typeof window.isSettingsTabEnabled === 'function' ? window.isSettingsTabEnabled('collab') : null,
        api: typeof window.isSettingsTabEnabled === 'function' ? window.isSettingsTabEnabled('api') : null,
      };
    });
  });
  await bootApp(page);
  const r = await page.evaluate(() => ({ dcl: window.__s7AtDCL, inbox: window.collabInvites?.inboxOpen?.() }));
  expect(r.dcl, '★전제: DOMContentLoaded 에서 잰 값이 있다').toBeTruthy();
  expect(r.dcl.type).toBe('function');
  expect(r.dcl.collab, '협업 탭 = MVP 문 안(현빈 08-28) ⇒ 닫힘').toBe(false);
  expect(r.dcl.api, '음성대조: MVP 밖 탭은 열림').toBe(true);
  expect(r.inbox, '배지 술어 = COLLAB_ENABLED(false) && 탭 열림(false)').toBe(false);
});

test('W4 — 배지가 안 뜬다(문이 닫힌 동안 «못 받을 초대»를 알리지 않는다)', async ({ page }) => {
  await bootApp(page);
  const disp = await page.evaluate(() => getComputedStyle(document.getElementById('collab-invite-badge')).display);
  expect(disp).toBe('none');
});

/* ── ⒝ 걸음(2026-10-06): notify.js 가 «화면에» 말한다 ─────────────────────────────────────────
 * ★하네스 전제: start() 를 지나야 사건이 난다 ⇒ 검사 페이지 «안에서만» window.COLLAB_ENABLED=true 와 가짜
 *   electronAPI.collab(서버 대신 정해진 답)을 끼운다. 제품 파일 값 무변경 · 앱·서버·포트 0(지디 판정 ⑥ 의 근거와 같은 꼴).
 * ★토스트는 #editor-toast 의 textContent(drag-utils.js showToast) — 화면에 «실제로» 뜬 글자를 읽는다.
 * 기대 문장은 «글자로» 박는다(reasons.js 에서 읽으면 무력화해도 같이 바뀌어 항등식이 된다). */
const OFFLINE = '서버에 닿지 못했습니다. 네트워크를 확인해 주세요.';

async function bootWithFakeCollab(page) {
  await bootApp(page);
  await page.evaluate(() => {
    window.__pullMode = 'offline';
    window.electronAPI = Object.assign({}, window.electronAPI, { collab: {
      ref: async () => ({ ok: true, ref: { collabId: 'cb_test', seq: 5, role: 'member' } }),
      pull: async () => (window.__pullMode === 'ok'
        ? { ok: true, patches: [], seq: 5, presence: [] }
        : { ok: false, reason: 'offline' }),
      push: async () => ({ ok: true, seq: 5 }),
      seq: async () => ({ ok: true }),
    } });
    window.COLLAB_ENABLED = true;   // ★검사 페이지 안에서만(제품 js/feature-flags.js 는 false 그대로)
  });
}

test('W5 ★A5 — 첫 받기가 실패하면 start() 는 ok:false(거짓 성공 아님) · 화면에 기존 문장으로 말한다', async ({ page }) => {
  await bootWithFakeCollab(page);
  const r = await page.evaluate(async () => {
    const res = await window.collabSync.start('proj_fake');
    const toast = document.getElementById('editor-toast');
    const heard = window.collabNotify.heard().map(h => h.type);
    window.collabSync.stop();
    return { res, toast: toast && toast.textContent, heard };
  });
  expect(r.res.ok, '첫 받기 실패인데 ok:true — 거짓 성공(A5)').toBe(false);
  expect(r.res.reason).toBe('offline');
  expect(r.heard).toContain('start_failed');
  expect(r.heard, '실패했는데 「started」를 냈다').not.toContain('started');
  expect(r.toast, '★R1\' 축: 화면 토스트에 «기존 표 문장»이 뜬다').toContain(OFFLINE);
});

test('W6 ★상태 전이 1회 — 같은 받기 실패는 한 번만 · 회복 뒤 다시 실패하면 또 한 번(_lastShown)', async ({ page }) => {
  await bootWithFakeCollab(page);
  const r = await page.evaluate(async () => {
    await window.collabSync.start('proj_fake');                 // start_failed(토스트 1) — pull 채널과 별개
    const base = window.collabNotify.shown().length;
    const pullToasts = () => window.collabNotify.shown().slice(base).length;
    await window.collabSync.tick(); const n1 = pullToasts();    // 실패 → 말함
    await window.collabSync.tick(); await window.collabSync.tick(); const n3 = pullToasts();   // 같은 실패 → 안 말함
    window.__pullMode = 'ok'; await window.collabSync.tick(); const last = window.collabNotify.lastShown().pull;
    window.__pullMode = 'offline'; await window.collabSync.tick(); const n5 = pullToasts();   // 회복 뒤 다시 실패 → 말함
    window.collabSync.stop();
    return { n1, n3, last, n5, msgs: window.collabNotify.shown().slice(base) };
  });
  expect(r.n1, '첫 실패에 한 번 말한다').toBe(1);
  expect(r.n3, '같은 실패가 이어지는 동안은 다시 말하지 않는다(2초 폴링 폭주 금지)').toBe(1);
  expect(r.last, '회복(pulled)하면 _lastShown.pull 을 지운다').toBe(null);
  expect(r.n5, '회복 뒤 다시 실패하면 또 말한다').toBe(2);
  expect(r.msgs.every(m => m === OFFLINE), `문구: ${JSON.stringify(r.msgs)}`).toBe(true);
});


/* ── 현빈 승인 문장(2026-10-06) 이후: 상단바 «⚠ 연결 끊김»(지디 C) · section_too_large 의 섹션 이름(지디 B ⑴) ── */
test('W7 ★상단바 — 받기 실패면 「⚠ 연결 끊김」이 보이고, 다음 성공한 받기가 지운다', async ({ page }) => {
  await bootWithFakeCollab(page);
  const r = await page.evaluate(async () => {
    window.__pullMode = 'ok';
    await window.collabSync.start('proj_fake');
    const el = document.getElementById('collab-topbar-badge');
    window.__pullMode = 'offline'; await window.collabSync.tick();
    const down = { text: el.textContent, shown: getComputedStyle(el).display !== 'none', title: el.title };
    window.__pullMode = 'ok'; await window.collabSync.tick();
    const up = { text: el.textContent, shown: getComputedStyle(el).display !== 'none' };
    window.collabSync.stop();
    return { down, up };
  });
  expect(r.down.shown, '받기 실패인데 상단바가 조용하다(S3)').toBe(true);
  expect(r.down.text).toBe('⚠ 연결 끊김');
  expect(r.down.title, '마우스를 올리면 원인 문장').toBe(OFFLINE);
  expect(r.up.shown, '회복했는데 「연결 끊김」이 남아 있다').toBe(false);
});

test('W8 ★section_too_large — 「N번째 섹션」 + 「이 섹션은 상대에게 보이지 않습니다.」 (번호를 셀 수 있나 = 이 시험이 잰다)', async ({ page }) => {
  await bootWithFakeCollab(page);
  const r = await page.evaluate(async () => {
    const canvas = document.getElementById('canvas');
    canvas.innerHTML = '<div class="section-block" id="secA"><div class="section-inner">A</div></div><div class="section-block" id="secB"><div class="section-inner">B</div></div>';
    window.__pullMode = 'ok';
    window.electronAPI.collab.push = async (p) => (p.patches[0].sectionId === 'secB' ? { ok: false, reason: 'too_large' } : { ok: true, seq: 6 });
    const pre = { mm: typeof window.marketMerge?.hash, start: (await window.collabSync.start('proj_fake')).ok };
    const snap = JSON.stringify({ pages: [{ id: window.state.currentPageId, canvas: canvas.innerHTML }] });
    window.dispatchEvent(new CustomEvent('gd:project-saved', { detail: { snap } }));
    await new Promise(res => setTimeout(res, 300));
    const shown = window.collabNotify.shown();
    window.collabSync.stop();
    return { pre, shown };
  });
  expect(r.pre, '★전제: marketMerge 가 있고 동기화가 섰다').toEqual({ mm: 'function', start: true });
  const msg = r.shown.find(m => m.includes('너무 큽니다'));
  expect(msg, `413 토스트가 없다: ${JSON.stringify(r.shown)}`).toBeTruthy();
  expect(msg).toBe('섹션 하나가 너무 큽니다(이미지가 인라인으로 박혀 있습니다). · 2번째 섹션 — 이 섹션은 상대에게 보이지 않습니다.');
});
