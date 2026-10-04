/* bt-bubble-chat.dom.spec.js — BT1(발신자 이름: 패널 입력칸 제거 → 캔버스에서 바로 수정) · BT3(말풍선 스타일 드롭다운이 «모습»을 바꾼다)
 *   + 챗블럭 짝(BT5 규칙: 「BT1~BT4 를 고칠 때마다 챗블럭도 같이」). (2026-10-04 태양 레인 lane-bt-bubble-chat)
 *
 * ★뿌리(고치기 전 판 07d8178b 실측)
 *   BT1  js/props/prop-text-template.js:281-283 — 토글을 켜면 #bubble-sender-name-row 가 보이고 그 안 <input placeholder="Your name">.
 *        캔버스의 .tb-sender-name 은 contenteditable 속성이 «없어»(js/block-factory.js:2644) 더블클릭해도 편집에 못 든다
 *        (js/block-drag.js dblclick 은 [contenteditable] 만 켠다 → 본문 .tb-bubble 이 대신 열린다).
 *   BT3  js/props/prop-text-wireup-bubble.js:24-32 — 바꾸는 것은 .tb-bubble 의 data-bubble-style(apple 일 때만)뿐이고
 *        그 속성을 읽는 CSS 가 레포 «어디에도 없다»(css/·export-html 전수 0건). default 와 imessage 는 «같은 갈래»(delete).
 *        뿌리 커밋 904c5027 메시지: 「Apple은 추후 정의」 — 끝내 정의되지 않았다 ⇒ 세 옵션 모두 같은 모습.
 *   챗블럭: 스타일 드롭다운이 «없다»(js/props/prop-chat.js 패널 = 블록머리·패딩·Color 4칸·Profile·Messages) ⇒ BT3 짝 없음.
 *        이름(.chb-profile-name)은 패널 «프로필 이름» 칸에서만 고친다 — 캔버스 더블클릭은 .chb-btext 만 연다(chat-block.js dblclick).
 *
 * ★전제부터 단언한다(이름 붙인 조건이 섰는지 먼저 잰다) — 토글이 켜졌나·이름표가 보이나·옵션이 셋인가.
 * 양성대조: GD1001_ROOT=<07d8178b 체크아웃> 로 돌리면 «고침을 재는» 시험이 빨강이어야 한다.
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js bt-bubble-chat --workers=1 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');

const SEC = `<div class="section-block" data-section="1" id="sBT"><div class="section-hitzone"></div>
  <div class="section-inner" style="padding-left: 60px; padding-right: 60px;" data-padding-x="60"></div></div>`;

async function freshCanvas(page) {
  await page.setViewportSize({ width: 1700, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate((h) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', h); window.rebindAll?.();
    window.selectSection(document.getElementById('sBT'));
  }, SEC);
  return errs;
}

async function addBubble(page) {
  await page.evaluate(() => window.addSpeechBubbleBlock('left'));
  const id = await page.evaluate(() => document.querySelector('.speech-bubble-block').id);
  expect(id, '전제: 말풍선 블럭이 생겼다').toMatch(/^sb/);
  return id;
}

/* 실제 클릭으로 블럭을 골라 우측 텍스트 패널을 연다 */
async function selectBubble(page, id) {
  const r = await waitStableRect(page, `#${id} .tb-bubble`);
  await page.mouse.click(r.cx, r.cy);
  await expect(page.locator('#bubble-style-section'), '전제: 말풍선 패널이 열렸다').toBeVisible();
}

/* 패널 토글로 발신자 이름 켜기(실제 클릭 — 숨은 checkbox 대신 보이는 트랙을 누른다) */
async function turnSenderOn(page, id) {
  await page.locator('#bubble-show-sender + .prop-toggle-track').click();
  await expect(page.locator('#bubble-show-sender'), '전제: 토글이 켜졌다').toBeChecked();
  expect(await page.evaluate((i) => document.getElementById(i).dataset.showSender, id), '전제: dataset.showSender').toBe('true');
  await expect(page.locator(`#${id} .tb-sender-name`), '전제: 캔버스 이름표가 보인다').toBeVisible();
}

async function roundTrip(page) {
  const snap = JSON.parse(await page.evaluate(() => window.serializeProject()));
  await bootApp(page);
  await page.evaluate((d) => window.applyProjectData(d), snap);
  await page.waitForTimeout(400);
}

/* 캔버스 이름표를 더블클릭 → 전부 지우고 → 타이핑 → 바깥 클릭으로 끝낸다 */
async function editSenderOnCanvas(page, id, text) {
  const r = await waitStableRect(page, `#${id} .tb-sender-name`);
  await page.mouse.dblclick(r.cx, r.cy);
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.press('Backspace');
  if (text) await page.keyboard.type(text);
  await page.keyboard.press('Enter');
}

// ─────────────────────────────── BT1 ───────────────────────────────
test('BT1-1 발신자 이름을 켜도 우측 패널에 이름 입력칸(placeholder)이 «없다» — 토글은 남는다', async ({ page }) => {
  await freshCanvas(page);
  const id = await addBubble(page);
  await selectBubble(page, id);
  await expect(page.locator('#bubble-show-sender'), '토글은 패널에 남는다').toHaveCount(1);
  await turnSenderOn(page, id);
  const panelInputs = await page.evaluate(() =>
    [...document.querySelectorAll('#bubble-style-section input')].filter(i => i.type === 'text' && i.offsetParent !== null)
      .map(i => ({ id: i.id, ph: i.placeholder })));
  expect(panelInputs.filter(i => i.id !== 'bubble-bg-hex'), '보이는 글자 입력칸은 배경색 코드 하나뿐').toEqual([]);
  await expect(page.locator('#bubble-sender-name-input')).toHaveCount(0);
  await expect(page.locator('#bubble-sender-name-row')).toHaveCount(0);
  // 끄기도 그대로 된다
  await page.locator('#bubble-show-sender + .prop-toggle-track').click();
  await expect(page.locator(`#${id} .tb-sender-name`)).toBeHidden();
});

test('BT1-2 캔버스에서 이름표를 더블클릭해 고치면 저장→불러오기 왕복 뒤에도 남고, 다시 고칠 수 있다', async ({ page }) => {
  await freshCanvas(page);
  const id = await addBubble(page);
  await selectBubble(page, id);
  await turnSenderOn(page, id);
  const bodyBefore = await page.evaluate((i) => document.querySelector(`#${i} .tb-bubble`).textContent, id);

  await editSenderOnCanvas(page, id, '홍길동');
  const s1 = await page.evaluate((i) => { const b = document.getElementById(i); const n = b.querySelector('.tb-sender-name');
    return { ds: b.dataset.senderName, text: n.textContent, ce: n.getAttribute('contenteditable'), body: b.querySelector('.tb-bubble').textContent,
      editing: b.classList.contains('editing') }; }, id);
  expect(s1.text, '캔버스 이름표 글자').toBe('홍길동');
  expect(s1.ds, 'dataset.senderName 동기화').toBe('홍길동');
  expect(s1.body, '본문은 안 바뀐다(타이핑이 본문으로 새지 않았다)').toBe(bodyBefore);
  expect(s1.ce, '편집이 끝나면 이름표에 contenteditable 이 «남지 않는다»([contenteditable] 첫 칸 가로채기 방지)').toBeNull();
  expect(s1.editing).toBe(false);

  await roundTrip(page);
  const s2 = await page.evaluate((i) => { const b = document.getElementById(i); const n = b.querySelector('.tb-sender-name');
    return { ds: b.dataset.senderName, text: n.textContent, show: b.dataset.showSender, vis: getComputedStyle(n).display !== 'none',
      firstCE: b.querySelector('[contenteditable]')?.className || null }; }, id);
  expect(s2).toEqual({ ds: '홍길동', text: '홍길동', show: 'true', vis: true, firstCE: 'tb-bubble' });

  // 불러온 뒤에도 다시 고쳐진다(배선이 왕복을 견딘다)
  await editSenderOnCanvas(page, id, '김철수');
  const s3 = await page.evaluate((i) => { const b = document.getElementById(i);
    return { ds: b.dataset.senderName, text: b.querySelector('.tb-sender-name').textContent }; }, id);
  expect(s3).toEqual({ ds: '김철수', text: '김철수' });
});

test('BT1-3 이름을 다 지우고 끝내면 기본 이름(Your name)으로 돌아간다 — 캔버스 글자와 dataset 이 같다', async ({ page }) => {
  await freshCanvas(page);
  const id = await addBubble(page);
  await selectBubble(page, id);
  await turnSenderOn(page, id);
  await editSenderOnCanvas(page, id, '홍길동');
  expect(await page.evaluate((i) => document.querySelector(`#${i} .tb-sender-name`).textContent, id), '전제: 먼저 이름이 바뀌었다').toBe('홍길동');
  await editSenderOnCanvas(page, id, '');
  const s = await page.evaluate((i) => { const b = document.getElementById(i);
    return { ds: b.dataset.senderName, text: b.querySelector('.tb-sender-name').textContent }; }, id);
  expect(s).toEqual({ ds: 'Your name', text: 'Your name' });
});

test('BT1-4 (지키는 시험) 본문을 더블클릭하면 여전히 «본문»이 편집된다 — 이름표가 가로채지 않는다', async ({ page }) => {
  await freshCanvas(page);
  const id = await addBubble(page);
  await selectBubble(page, id);
  await turnSenderOn(page, id);
  const r = await waitStableRect(page, `#${id} .tb-bubble`);
  await page.mouse.dblclick(r.cx, r.cy);
  await page.keyboard.type('안녕');
  await page.mouse.click(5, 1090);
  const s = await page.evaluate((i) => { const b = document.getElementById(i);
    return { body: b.querySelector('.tb-bubble').textContent, name: b.querySelector('.tb-sender-name').textContent }; }, id);
  expect(s.body).toBe('안녕');
  expect(s.name).toBe('Your name');
});

// 챗블럭 짝 — 이름 표시가 켜진 메시지의 이름을 캔버스에서 바로 고친다
const CHAT_MSGS = [
  { text: '첫 메시지', align: 'left', profileName: '상담원' },
  { text: '둘째', align: 'right', profileName: '고객' },
];
async function addChat(page) {
  await page.evaluate((m) => window.addChatBlock({ messages: m }), CHAT_MSGS);
  const id = await page.evaluate(() => document.querySelector('.chat-block').id);
  await page.evaluate((i) => { const b = document.getElementById(i); b.dataset.showName = '1'; window.renderChatBlock(b); }, id);
  await expect(page.locator(`#${id} .chb-profile-name`), '전제: 이름 표시 ON → 캔버스 이름 2개').toHaveCount(2);
  return id;
}

test('BT1-C1 챗블럭 — 캔버스 이름(.chb-profile-name)을 더블클릭해 고치면 messages[i].profileName 이 바뀌고 왕복 뒤 남는다', async ({ page }) => {
  await freshCanvas(page);
  const id = await addChat(page);
  const r = await waitStableRect(page, `#${id} .chb-profile-name[data-name-idx="0"]`);
  await page.mouse.dblclick(r.cx, r.cy);
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type('김상담');
  await page.keyboard.press('Enter');
  const s1 = await page.evaluate((i) => { const b = document.getElementById(i); const m = JSON.parse(b.dataset.messages);
    return { n0: m[0].profileName, n1: m[1].profileName, t0: m[0].text, canvas: b.querySelector('.chb-profile-name[data-name-idx="0"]').textContent,
      ce: !!b.querySelector('.chb-profile-name[contenteditable]') }; }, id);
  expect(s1).toEqual({ n0: '김상담', n1: '고객', t0: '첫 메시지', canvas: '김상담', ce: false });
  await roundTrip(page);
  const s2 = await page.evaluate((i) => { const b = document.getElementById(i);
    return { n0: JSON.parse(b.dataset.messages)[0].profileName, canvas: b.querySelector('.chb-profile-name[data-name-idx="0"]')?.textContent }; }, id);
  expect(s2).toEqual({ n0: '김상담', canvas: '김상담' });
});

test('BT1-C2 챗블럭 — 이름을 다 지우면 그 메시지의 이름이 빠진다(이름 칸은 패널 «프로필 이름»에서 다시 넣는다)', async ({ page }) => {
  await freshCanvas(page);
  const id = await addChat(page);
  const r = await waitStableRect(page, `#${id} .chb-profile-name[data-name-idx="1"]`);
  await page.mouse.dblclick(r.cx, r.cy);
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.press('Backspace');
  await page.keyboard.press('Enter');
  const s = await page.evaluate((i) => { const b = document.getElementById(i); if (!b) return 'block gone'; const m = JSON.parse(b.dataset.messages);
    return { n0: m[0].profileName, n1: m[1].profileName, names: b.querySelectorAll('.chb-profile-name').length }; }, id);
  expect(s).toEqual({ n0: '상담원', n1: '', names: 1 });
});

// ─────────────────────────────── BT3 ───────────────────────────────
const look = (page, id) => page.evaluate((i) => {
  const b = document.getElementById(i); const bub = b.querySelector('.tb-bubble'); const cs = getComputedStyle(bub);
  return { bg: cs.backgroundColor, color: cs.color, tail: getComputedStyle(b.querySelector('.tb-bubble-tail')).fill, style: b.dataset.bubbleStyle };
}, id);

test('BT3-1 스타일 드롭다운 — 옵션마다 말풍선의 «보이는 모습»(배경·글자색·꼬리색)이 다르고, 기본으로 돌아오면 원래 모습', async ({ page }) => {
  await freshCanvas(page);
  const id = await addBubble(page);
  await selectBubble(page, id);
  const opts = await page.evaluate(() => [...document.querySelectorAll('#bubble-style-select option')].map(o => o.value));
  expect(opts, '전제: 옵션 셋').toEqual(['default', 'imessage', 'apple']);
  const base = await look(page, id);
  expect(base.style, '전제: 새 블럭은 기본').toBe('default');

  const seen = {};
  for (const v of ['imessage', 'apple', 'default']) {
    await page.locator('#bubble-style-select').selectOption(v);
    await expect(page.locator('#bubble-style-select'), '패널이 고른 값을 보여 준다').toHaveValue(v);
    seen[v] = await look(page, id);
    expect(seen[v].style).toBe(v);
    expect(seen[v].tail, `${v}: 꼬리색 = 말풍선 배경`).toBe(seen[v].bg);
  }
  expect(seen.default, '기본으로 돌아오면 처음 모습').toEqual(base);
  const keys = Object.values(seen).map(l => `${l.bg}|${l.color}`);
  expect(new Set(keys).size, `세 옵션의 모습이 서로 다르다: ${JSON.stringify(seen)}`).toBe(3);
});

test('BT3-2 고른 스타일이 저장→불러오기 왕복 뒤에도 그 모습·그 선택값으로 남는다', async ({ page }) => {
  await freshCanvas(page);
  const id = await addBubble(page);
  await selectBubble(page, id);
  const base = await look(page, id);
  await page.locator('#bubble-style-select').selectOption('imessage');
  const before = await look(page, id);
  expect(before.bg, '전제: iMessage 가 기본과 다른 모습이다(같으면 왕복이 아무것도 안 잰다)').not.toBe(base.bg);
  await roundTrip(page);
  expect(await look(page, id)).toEqual(before);
  await selectBubble(page, id);
  await expect(page.locator('#bubble-style-select')).toHaveValue('imessage');
});

test('BT3-3 MCP 경로(updateSpeechBubbleBlock bubbleStyle)도 패널과 «같은 모습»을 낸다', async ({ page }) => {
  await freshCanvas(page);
  const id = await addBubble(page);
  await selectBubble(page, id);
  const base = await look(page, id);
  await page.locator('#bubble-style-select').selectOption('apple');
  const viaPanel = await look(page, id);
  expect(viaPanel.bg, '전제: Apple 이 기본과 다른 모습이다').not.toBe(base.bg);
  await page.locator('#bubble-style-select').selectOption('default');
  const res = await page.evaluate((i) => window.updateSpeechBubbleBlock(i, { bubbleStyle: 'apple' }).ok, id);
  expect(res).toBe(true);
  expect(await look(page, id)).toEqual(viaPanel);
});

test('BT3-4 스타일을 고른 뒤 배경색을 손으로 바꾸면 그 색이 이긴다(스타일은 «출발점»)', async ({ page }) => {
  await freshCanvas(page);
  const id = await addBubble(page);
  await selectBubble(page, id);
  await page.locator('#bubble-style-select').selectOption('imessage');
  const hex = page.locator('#bubble-bg-hex');
  await hex.fill('FF0000');
  await hex.press('Enter');
  const l = await look(page, id);
  expect(l.bg).toBe('rgb(255, 0, 0)');
  expect(l.tail).toBe('rgb(255, 0, 0)');
});

test('BT3-C 챗블럭 — 스타일 드롭다운에 해당하는 칸이 «없다»(짝 없음의 증거; 생기면 이 시험을 짝 시험으로 바꿔라)', async ({ page }) => {
  await freshCanvas(page);
  const id = await addChat(page);
  const r = await waitStableRect(page, `#${id} .chb-bubble`);
  await page.mouse.click(r.cx, r.cy);
  await expect(page.locator('#chb-add-msg'), '전제: 챗 패널이 열렸다').toBeVisible();
  const all = await page.evaluate(() => [...document.querySelectorAll('#panel-right select, .panel-right select')].filter(s => s.offsetParent !== null)
    .map(s => ({ id: s.id || s.className, inLinePanel: !!s.closest('#ln-line-panel') })));
  test.info().annotations.push({ type: 'selects', description: JSON.stringify(all) });
  /* ★BT2(2026-10-04) — 챗에 «줄바»(#ln-line-panel: 「+ 줄 추가▾」·줄 종류·줄 정렬)가 생겼다. 그건 «스타일 드롭다운»이 아니다.
     ⛔수를 느슨하게(≤N) 하지 않는다 — 줄바 그릇 «밖»의 셀렉트가 0 이어야 한다(이 시험의 뜻 = 챗에 BT3 스타일 칸 없음). */
  const selects = all.filter(s => !s.inLinePanel).map(s => s.id);
  expect(selects).toEqual([]);
});

// ─────────── 챗 렌더 잠금(E27) — 이 레인이 건드린 챗 자리(이름 칸·말풍선·본문 칸)의 «렌더»가 안 바뀌었다 ───────────
/* 골든은 «고치기 전 판 07d8178b» 에서 떴다: GD1001_ROOT=<핀> BT_CHAT_GOLDEN=update 로 한 번 돌려 파일을 쓴다.
   고친 판에서 같은 값이면 = 챗 렌더 무손상. ⚠️골든을 «고친 판»에서 다시 뜨지 마라(그러면 무엇과도 같아진다). */
const fs = require('fs');
const path = require('path');
const GOLDEN = path.join(__dirname, 'fixtures', 'bt-chat-render-golden.json');
const LOCK_MSGS = [
  { text: '안녕하세요! <b>굵게</b>', align: 'left', profileName: '상담원 & "팀" <1>', stars: 4 },
  { text: '네~\n두 줄', align: 'right', profileName: '고객' },
  { text: '이름 없음', align: 'left' },
  { text: '숨김', align: 'left', profileName: '숨은이', hideProfile: true },
];
test('BT-CLOCK 챗 렌더 골든 — 이름 표시·프로필·별점·좌우 메시지의 마크업과 계산 스타일이 핀(07d8178b)과 같다', async ({ page }) => {
  await freshCanvas(page);
  await page.evaluate((m) => window.addChatBlock({ messages: m }), LOCK_MSGS);
  const got = await page.evaluate(() => {
    const b = document.querySelector('.chat-block');
    b.dataset.showProfile = '1'; b.dataset.showName = '1'; window.renderChatBlock(b);
    const pick = (el, props) => { const cs = getComputedStyle(el); return Object.fromEntries(props.map(p => [p, cs[p]])); };
    return {
      html: b.innerHTML,
      names: [...b.querySelectorAll('.chb-profile-name')].map(n => ({ idx: n.dataset.nameIdx, text: n.textContent, ce: n.getAttribute('contenteditable'),
        ...pick(n, ['fontSize', 'color', 'textAlign', 'visibility', 'display', 'userSelect', 'cursor', 'marginBottom']) })),
      bubbles: [...b.querySelectorAll('.chb-bubble')].map(n => pick(n, ['backgroundColor', 'color', 'borderRadius', 'paddingTop', 'paddingLeft', 'fontSize'])),
      btexts: [...b.querySelectorAll('.chb-btext')].map(n => ({ text: n.textContent, ce: n.getAttribute('contenteditable'), ...pick(n, ['whiteSpace', 'userSelect']) })),
    };
  });
  expect(got.names.length, '전제: 이름 칸 3개(이름 없는 메시지는 칸이 없다)').toBe(3);
  if (process.env.BT_CHAT_GOLDEN === 'update') {
    fs.mkdirSync(path.dirname(GOLDEN), { recursive: true });
    fs.writeFileSync(GOLDEN, JSON.stringify(got, null, 2) + '\n');
    test.info().annotations.push({ type: 'golden', description: `wrote ${GOLDEN}` });
    return;
  }
  expect(fs.existsSync(GOLDEN), '골든 파일이 있다').toBe(true);
  expect(got).toEqual(JSON.parse(fs.readFileSync(GOLDEN, 'utf8')));
});

test('BT1-C3 (지키는 시험) 챗 본문(.chb-btext)을 더블클릭하면 여전히 «본문»이 편집되고 이름은 그대로', async ({ page }) => {
  await freshCanvas(page);
  const id = await addChat(page);
  const r = await waitStableRect(page, `#${id} .chb-btext[data-msg-idx="0"]`);
  await page.mouse.dblclick(r.cx, r.cy);
  await page.keyboard.type('!!');
  await page.mouse.click(5, 1090);
  const s = await page.evaluate((i) => { const m = JSON.parse(document.getElementById(i).dataset.messages); return { t0: m[0].text, n0: m[0].profileName }; }, id);
  expect(s).toEqual({ t0: '첫 메시지!!', n0: '상담원' });
});
