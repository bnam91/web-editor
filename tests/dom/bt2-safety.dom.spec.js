/* bt2-safety.dom.spec.js — BT2(버블·챗 «줄») 안전판 C0. ★코드보다 «먼저» 박는 시험 (2026-10-04 태양 lane-bt2-lines)
 *
 * 무엇을 지키나 — BT2 가 «건드리면 안 되는» 세 자리를 핀(df43db91 = BT2 전) 그대로 잠근다.
 *   T1  챗 차등 골든 — 합성 설정 N 개를 핀 렌더러로 그린 결과(innerHTML + block.style.cssText)를 골든으로 뜨고,
 *       BT2 뒤 렌더러가 «lines 가 없는 한» 바이트로 같은지 잰다. ⚠️기존 BT-CLOCK(bt-bubble-chat.dom.spec.js:284)은 «한 설정»만 잠근다.
 *       설정은 현빈 계정 센서스(BT2-COND.md §3)에 나온 «기본값 아닌 속성»을 골고루 섞어 만든 «합성»이다(현빈 데이터 아님).
 *   T1b 옛 버블 왕복 — data-lines 없는 버블 여러 꼴을 «실제 저장(getSerializedCanvas) → 실제 불러오기(sanitize+innerHTML+rebindAll)»로
 *       돌려 블럭 outerHTML 이 핀과 같은지 잰다. + BT2 의 줄 렌더(window.lnRenderBubble)가 «한 번도» 안 불린다.
 *   T6  그리드 패널 HTML 바이트 스냅샷 — 줄바·줄 꾸미기·Typography 를 host 인자로 바꾸는 리팩터(C2)가 그리드 패널을 한 바이트도 안 바꿨나.
 *   T5r ★«BT2 가 만들 위험»의 증명 — 지금(핀)은 메시지에 lines 가 «없어서» 실제 유실은 0 이다. 그러나 lines 를 얹는 순간
 *       updateChatBlock{editMessage} 가 그것을 지운다(chat-block.js _normMsg 가 아는 필드로만 다시 만든다). 그 «모양»이 실재함을
 *       test.fail() 로 «빨강을 기대»해 박는다. BT2 C5 가 고치면 test.fail 을 걷는다(걷지 않으면 «예상 밖 통과»로 빨강 — 잊을 수 없다).
 *
 * 골든 뜨기: BT2_GOLDEN=update 로 «핀 판(C0 커밋)»에서 한 번. ⛔BT2 코드가 들어간 판에서 다시 뜨지 마라(그러면 무엇과도 같아진다).
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js tests/dom/bt2-safety.dom.spec.js --workers=1 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { bootApp } = require('./_root-harness.js');

const SEC = `<div class="section-block" data-section="1" id="sBT2"><div class="section-hitzone"></div>
  <div class="section-inner" style="padding-left: 60px; padding-right: 60px;" data-padding-x="60"></div></div>`;
const GOLD = (n) => path.join(__dirname, 'fixtures', `bt2-${n}-golden.json`);
const UPDATE = process.env.BT2_GOLDEN === 'update';

async function freshCanvas(page) {
  await page.setViewportSize({ width: 1700, height: 1100 });
  await bootApp(page);
  await page.evaluate((h) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', h); window.rebindAll?.();
    window.selectSection(document.getElementById('sBT2'));
  }, SEC);
}

function golden(name, got) {
  const f = GOLD(name);
  if (UPDATE) {
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, JSON.stringify(got, null, 2) + '\n');
    test.info().annotations.push({ type: 'golden', description: `wrote ${f}` });
    return;
  }
  expect(fs.existsSync(f), `골든 파일이 있다(${path.basename(f)})`).toBe(true);
  expect(got).toEqual(JSON.parse(fs.readFileSync(f, 'utf8')));
}

// ─────────── T1 챗 차등 골든 ───────────
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const CHAT_CONFIGS = [
  { name: 'default', ds: {}, msgs: null },
  { name: 'tail300-pad40-bleed-profile', ds: { tailScale: '300', bubblePadding: '40', fullBleed: 'true', showProfile: '1' },
    msgs: [{ text: '안녕', align: 'left' }, { text: '네', align: 'right' }] },
  { name: 'tail0-maxw50-name-profsize', ds: { tailScale: '0', bubbleMaxW: '50', showProfile: '1', showName: '1', profileSize: '80', profileGap: '20', profileOffsetY: '10' },
    msgs: [{ text: '이름 있음', align: 'left', profileName: '상담원' }, { text: '우측 이름', align: 'right', profileName: '나' }] },
  { name: 'colors-radius-gap-font', ds: { bgLeft: '#fdfdfd', bgRight: '#8f8f8f', colorLeft: '#222222', colorRight: '#fefefe', radius: '28', padding: '30', gap: '20', fontSize: '44' },
    msgs: [{ text: '왼', align: 'left' }, { text: '오', align: 'right' }, { text: '왼2', align: 'left' }] },
  { name: 'stars-hide-img-br-b-5msgs', ds: { showProfile: '1', showName: '1' },
    msgs: [
      { text: '별 <b>굵게</b>', align: 'left', stars: 4, profileName: 'A & "B" <c>' },
      { text: '줄<br>바꿈', align: 'left', hideProfile: true },
      { text: '그림 프로필', align: 'left', profileImg: PNG, profileName: '그림' },
      { text: '네~\n두 줄', align: 'right', stars: 0 },
      { text: '끝', align: 'right' },
    ] },
  { name: 'tail442-pad0-profile-name-hide', ds: { tailScale: '442', bubblePadding: '0', showProfile: '1', showName: '1' },
    msgs: [{ text: '하나', align: 'left', profileName: '갑' }, { text: '둘', align: 'left', profileName: '갑', hideProfile: true }] },
  { name: 'font26-maxw100-bleed-off', ds: { fontSize: '26', radius: '16', bubbleMaxW: '100', fullBleed: 'false' },
    msgs: [{ text: '길고 긴 메시지 '.repeat(8), align: 'left' }] },
  { name: 'single-right-tail255', ds: { tailScale: '255' }, msgs: [{ text: '혼자', align: 'right' }] },
];
test('T1 챗 차등 골든 — lines 없는 챗 N=8 설정의 렌더(innerHTML·style)가 핀(df43db91)과 바이트 같다', async ({ page }) => {
  await freshCanvas(page);
  const got = await page.evaluate((configs) => {
    const out = {};
    for (const cf of configs) {
      document.querySelectorAll('.chat-block').forEach(b => b.closest('.row')?.remove());
      window.selectSection(document.getElementById('sBT2'));   // 지운 블럭이 선택돼 있었다 — 섹션을 다시 골라야 add 가 산다
      window.addChatBlock(cf.msgs ? { messages: cf.msgs } : {});
      const b = document.querySelector('.chat-block');
      Object.assign(b.dataset, cf.ds);
      window.renderChatBlock(b);
      out[cf.name] = { html: b.innerHTML.split(b.id).join('ID'), style: b.style.cssText, msgs: b.dataset.messages };
    }
    return out;
  }, CHAT_CONFIGS);
  expect(Object.keys(got).length, '전제: 설정 8개를 다 그렸다').toBe(8);
  expect(Object.values(got).every(g => g.html.includes('chb-btext')), '전제: 모든 설정에 본문 칸이 있다').toBe(true);
  golden('chat-render', got);
});

// ─────────── T1b 옛 버블 왕복 ───────────
test('T1b 옛 버블(data-lines 없음) — 실제 저장→불러오기 뒤 outerHTML 이 핀과 같고, 줄 렌더는 0회', async ({ page }) => {
  await freshCanvas(page);
  const got = await page.evaluate(() => {
    const mk = (tail) => { window.addSpeechBubbleBlock(tail); const all = [...document.querySelectorAll('.speech-bubble-block')]; return all[all.length - 1]; };
    const b1 = mk('left');                                                     // 기본·placeholder
    const b2 = mk('right'); window.updateSpeechBubbleBlock(b2.id, { text: '오른쪽 말풍선', bubbleStyle: 'imessage' });
    const b3 = mk('center'); window.updateSpeechBubbleBlock(b3.id, { text: '가운데', bubbleStyle: 'apple', showSender: true, senderName: '홍길동' });
    const b4 = mk('left'); window.updateSpeechBubbleBlock(b4.id, { text: '배경색', bubbleBg: '#ffeeaa' });
    const b5 = mk('left'); {                                                    // 서식 든 본문(센서스: 31 중 1 이 div 자식)
      const tb = b5.querySelector('.tb-bubble'); delete tb.dataset.isPlaceholder;
      tb.innerHTML = '첫 줄<div>둘째 <b>굵게</b></div>'; tb.style.fontSize = '36px'; tb.style.color = 'rgb(10, 20, 30)';
    }
    const ids = [b1, b2, b3, b4, b5].map(b => b.id);
    window.deselectAll?.();
    let calls = 0;
    const spy = (name) => { const f = window[name]; if (typeof f === 'function') window[name] = function (...a) { calls++; return f.apply(this, a); }; };
    spy('lnRenderBubble');
    const html = window.getSerializedCanvas();
    const c = document.getElementById('canvas');
    c.innerHTML = window.sanitizeCanvasHtml(html);
    window.rebindAll();
    window.deselectAll?.();
    const after = {};
    for (const id of ids) {
      const el = document.getElementById(id);
      after[id] = el ? el.outerHTML : null;
    }
    return { ids, after: ids.map(id => after[id]), calls, nLines: document.querySelectorAll('.speech-bubble-block[data-lines]').length };
  });
  expect(got.after.every(Boolean), '전제: 다섯 버블이 왕복 뒤에도 있다').toBe(true);
  expect(got.nLines, '전제: data-lines 든 버블 0').toBe(0);
  expect(got.calls, 'BT2 줄 렌더가 옛 버블에서 불리지 않는다').toBe(0);
  // id 는 매 판 바뀐다 — 위치 이름으로 바꿔 비교한다
  const norm = got.after.map((h, i) => h.split(got.ids[i]).join(`SB${i}`));
  golden('bubble-roundtrip', norm);
});

// ─────────── T6 그리드 패널 HTML 바이트 스냅샷 ───────────
test('T6 그리드 패널 — 상태 7가지의 우측 패널 HTML 이 핀과 바이트 같다(C2 host 리팩터 무변 증인)', async ({ page }) => {
  await freshCanvas(page);
  const got = await page.evaluate((png) => {
    window.addGridBlock({ cols: [
      { lines: [{ type: 'h2', text: '제목' }, { type: 'body', text: '본문', color: '#123456', fontSize: 30 }, { type: 'gap', height: 20 },
                { type: 'divider' }, { type: 'image', imgSrc: png, height: 40 }, { type: 'label', text: '알약', bg: '#eeeeee' }] },
      { lines: [] },
    ] });
    const b = document.querySelector('.grid-block');
    const panel = document.querySelector('#panel-right .panel-body');
    const states = [['block', null], ['h2', { r: 0, c: 0, li: 0 }], ['body', { r: 0, c: 0, li: 1 }], ['gap', { r: 0, c: 0, li: 2 }],
                    ['divider', { r: 0, c: 0, li: 3 }], ['image', { r: 0, c: 0, li: 4 }], ['badge', { r: 0, c: 0, li: 5 }], ['empty', { r: 0, c: 1, li: null }]];
    const out = {};
    for (const [n, a] of states) {
      window.showGridProperties(b, a);
      out[n] = panel.innerHTML.split(b.id).join('ID');
    }
    return out;
  }, PNG);
  expect(Object.keys(got).length, '전제: 상태 8개').toBe(8);
  expect(got.h2.includes('grd-line-summary'), '전제: 줄을 고르면 줄바 요약이 뜬다').toBe(true);
  golden('grid-panel', got);
});

// ─────────── T5r BT2 가 만들 위험 — editMessage 가 lines 를 지운다(지금 모양) ───────────
test('T5r editMessage{align} 가 메시지의 lines 를 «보존한다» (핀 d5fe9bb8 에선 빨강 = 유실 모양 증명 · C5 부터 초록)', async ({ page }) => {
  /* ★C5(BT2) 에서 test.fail 을 걷었다 — _normMsg·editMessage 가 lines 를 통과·병합한다. 이제 빨강 = 유실 재발. */
  await freshCanvas(page);
  const after = await page.evaluate(() => {
    window.addChatBlock({ messages: [{ text: 'a', align: 'left' }] });
    const b = document.querySelector('.chat-block');
    const m = JSON.parse(b.dataset.messages);
    m[0].lines = [{ type: 'h2', text: '제목' }, { type: 'body', text: 'a' }];
    b.dataset.messages = JSON.stringify(m);
    const res = window.updateChatBlock(b.id, { editMessage: { index: 0, align: 'right' } });
    return { ok: res && res.ok, msg: JSON.parse(b.dataset.messages)[0] };
  });
  expect(after.ok, '전제: 커밋은 성공했다').toBe(true);
  expect(after.msg.align, '전제: 고친 필드는 들어갔다').toBe('right');
  expect(after.msg.lines, 'lines 가 그대로 남는다').toEqual([{ type: 'h2', text: '제목' }, { type: 'body', text: 'a' }]);
});
