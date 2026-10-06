/* collab-leave-ui — 설정 «협업» 탭(2026-10-06 현빈 승인으로 열림)의 줄 단추가 역할로 갈리나 (SIX ②).
 *   주인 → «해산» 단추(data-role=owner) · 누르면 leave({ collabId, action:'disband' }) · 참여자 → 「연결 끊기」 · action 없음.
 *   ★하네스: bootApp + 가짜 electronAPI.collab(invites 가 주인 방 하나·참여 방 하나를 준다) · confirm 은 «확인»으로 대신.
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

test('LU1 ★주인/참여자 — 단추와 보내는 action 이 갈린다(주인 = disband · 참여자 = 없음)', async ({ page }) => {
  await bootApp(page);
  const r = await page.evaluate(async () => {
    const leaves = [];
    window.confirm = () => true;
    window.electronAPI = Object.assign({}, window.electronAPI, { collab: {
      invites: async () => ({ ok: true, invites: [], projects: [
        { collabId: 'cb_own', name: '내가 올린 방', role: 'owner' },
        { collabId: 'cb_mem', name: '초대받은 방', role: 'member' },
      ] }),
      leave: async (p) => { leaves.push(p); return { ok: true, disbanded: p.action === 'disband' }; },
      ref: async () => ({ ok: true, ref: null }),
    } });
    window.openSettingsModal('collab');
    await new Promise(res => setTimeout(res, 300));
    const tab = document.querySelector('.settings-tab[data-tab="collab"]');
    const btns = [...document.querySelectorAll('[data-leave]')].map(b => ({ id: b.dataset.leave, role: b.dataset.role, text: b.textContent.trim() }));
    for (const b of document.querySelectorAll('[data-leave]')) { b.click(); await new Promise(res => setTimeout(res, 100)); }
    return { tabEnabled: !!tab && !tab.disabled, btns, leaves: leaves.map(l => ({ collabId: l.collabId, action: l.action ?? null, hasProjectIdKey: 'projectId' in l })) };
  });
  expect(r.tabEnabled, '★전제: 협업 탭이 열려 있다').toBe(true);
  expect(r.btns.map(b => b.role)).toEqual(['owner', 'member']);
  expect(r.btns[1].text).toBe('연결 끊기');
  expect(r.btns[0].text, '주인 줄이 «연결 끊기» 와 같은 단추다(서버가 거절하는 길)').not.toBe('연결 끊기');
  expect(r.leaves).toEqual([
    { collabId: 'cb_own', action: 'disband', hasProjectIdKey: true },
    { collabId: 'cb_mem', action: null, hasProjectIdKey: true },
  ]);
});
