/* capture-cdp-queue — SLIDE-GIF-PREVIEW-ZOOM-FLASH-01 보강(현빈 9500 두 번째 재현 · 지디 261118): main.js 'capture-section-cdp' 를 «한 줄로».
 *   main.js 원문(_cdpCapTail · 처리기 등록 · _captureSectionCdp)을 잘라 가짜 debugger 로 돌린다(admin-authorized-wiring 과 같은 꼴 — 모양 아니라 행동).
 * Q1 다섯 번 연달아 부름 → 동시에 도는 캡처 ≤ 1 · 부른 차례대로 · 각자 제 결과
 * Q2 둘째가 실패해도 → 둘째만 거절 · 셋째부터 그대로 감
 * Q3 겹친 부름에도 attach 는 한 번
 * Q4 clip 값 그대로(배율 0·음수·거대값 → 1 · 상한 4)
 * 양성대조(CTL · _patches/capture-cdp-CTL-no-queue.patch): 처리기가 줄 없이 바로 _captureSectionCdp 를 부르게 → Q1 빨강(동시 캡처 > 1)
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { readSrc } = require('./_srcread.js');
const { sliceBlock, sliceCall } = require('./_slice-block.js');

const MAIN = readSrc(path.join(__dirname, '..', '..'), 'main.js');
function load({ fail = new Set(), delay = 5 } = {}) {
  const src = ['let _cdpCapTail = Promise.resolve();', sliceCall(MAIN, "ipcMain.handle('capture-section-cdp'") + ';', sliceBlock(MAIN, 'async function _captureSectionCdp({ x = 0, y = 0, width, height, scale = 1 } = {}) {')   /* 머리를 «본문 {»까지 — 분해 인자의 { 를 본문으로 안 읽게(_slice-block 규약) */].join('\n');
  const st = { inflight: 0, max: 0, order: [], attach: 0, attached: false, clips: [] };
  const dbg = {
    isAttached: () => st.attached,
    attach: () => { st.attach++; st.attached = true; },
    sendCommand: async (cmd, p) => {
      st.inflight++; st.max = Math.max(st.max, st.inflight); st.order.push(p.clip.x); st.clips.push(p.clip);
      await new Promise((r) => setTimeout(r, delay));
      st.inflight--;
      if (fail.has(p.clip.x)) throw new Error('cdp ' + p.clip.x);
      return { data: 'png' + p.clip.x };
    },
  };
  let handler = null;
  new Function('ipcMain', 'mainWindow', src)({ handle: (ch, fn) => { if (ch === 'capture-section-cdp') handler = fn; } }, { webContents: { debugger: dbg } });
  assert.ok(handler, '[전제] 처리기 등록');
  return { call: (o) => handler({}, o), st };
}

test('Q1 다섯 번 연달아 = 한 줄 · 차례 · 제 결과', async () => {
  const { call, st } = load();
  const rs = await Promise.all([1, 2, 3, 4, 5].map((x) => call({ x, y: 0, width: 10, height: 10 })));
  assert.deepStrictEqual(rs, ['png1', 'png2', 'png3', 'png4', 'png5']);
  assert.strictEqual(st.max, 1, `★동시 캡처 ${st.max}`);
  assert.deepStrictEqual(st.order, [1, 2, 3, 4, 5]);
});

test('Q2 앞이 실패해도 다음은 간다', async () => {
  const { call } = load({ fail: new Set([2]) });
  const rs = await Promise.allSettled([1, 2, 3].map((x) => call({ x, y: 0, width: 10, height: 10 })));
  assert.deepStrictEqual(rs.map((r) => r.status), ['fulfilled', 'rejected', 'fulfilled']);
  assert.strictEqual(rs[2].value, 'png3');
});

test('Q3 겹친 부름에도 attach 한 번', async () => {
  const { call, st } = load();
  await Promise.all([1, 2, 3].map((x) => call({ x, y: 0, width: 10, height: 10 })));
  assert.strictEqual(st.attach, 1);
});

test('Q4 clip 값 · 배율 막기', async () => {
  const { call, st } = load({ delay: 0 });
  for (const scale of [0, -1, 99, 2]) await call({ x: 7, y: -99999, width: 10.2, height: 20.7, scale });
  assert.deepStrictEqual(st.clips.map((c) => c.scale), [1, 1, 1, 2]);
  assert.deepStrictEqual([st.clips[0].x, st.clips[0].y, st.clips[0].width, st.clips[0].height], [7, -99999, 11, 21]);
});
