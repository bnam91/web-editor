/* section-memo-rich — 섹션 메모의 `[]` → 동그란 체크박스를 잠근다 (1012t1A1)
 * ──────────────────────────────────────────────────────────────────────────
 * 무엇을 고쳤나: 섹션 툴바 📝 모달의 편집 칸이 textarea 라 `[ ] 할일` 이 글자로만 보였다.
 *   ⇒ contenteditable 로 바꾸고, 글 사이에 체크박스(원자 노드)를 둔다. 저장은 종전대로 «평문»
 *     (data-memo 에 `[ ]` / `[x]`). 글자 규칙은 js/section-memo-format.js 한 자리.
 *
 * 재는 것(브라우저에서만 보이는 것):
 *   C1 `[]` 를 «키보드로» 치면 체크박스가 되고 캐럿이 그 뒤에 있다
 *   C2 누르면 체크가 뒤집히고 data-memo 가 따라간다
 *   C3 열고 닫기만 하면 data-memo 가 한 글자도 안 바뀌고 저장도 안 부른다
 *   C4 조합(IME) 중에는 안 바꾸고, 조합이 끝난 뒤 한 번 바꾼다
 *   C5 되돌리기가 `[]` 글자를 되살린다(네이티브 undo 에 실렸다)
 *   C6 모양 — 동그랗고, 체크된 것은 강조색 토큰
 *   C7 저장돼 있던 `[]` 글자는 안 바꾼다
 *   C8 Enter 는 줄바꿈 하나(\n)로 저장된다
 *   C9 붙여넣기는 평문만 — 남의 마크업이 편집 칸에 안 들어온다
 * 안 재는 것: 실제 한글 IME(합성 이벤트로만 잰다) · 실앱(Electron)에서의 전역 단축키 양보.
 *
 * ⛔앱을 «안» 띄운다. 실행: npm run test:dom -- section-memo-rich
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };

function router(page, harness) {
  return page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/__harness.html') return route.fulfill({ contentType: 'text/html; charset=utf-8', body: harness });
    const file = path.join(REPO, decodeURIComponent(url.pathname));
    if (!file.startsWith(REPO) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({ contentType: MIME[path.extname(file)] || 'text/plain', body: fs.readFileSync(file) });
  });
}

/* ★index.html 과 같은 차례 — 포맷이 메모보다 먼저(그 차례는 유닛 U-MEMOFMT-9 가 소스에서 잰다). */
const HARNESS = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="/css/editor-base.css">
<link rel="stylesheet" href="/css/editor-layout.css">
</head><body>
<div id="canvas">
  <div class="section-block" id="sec1" data-name="Section 01">
    <div class="section-toolbar"><button class="st-btn st-memo-btn" type="button">MEMO</button></div>
    <div class="section-inner"></div>
  </div>
</div>
<span id="accent-probe" style="background: var(--ui-accent-primary)"></span>
<script src="/js/section-memo-format.js"></script>
<script src="/js/section-memo.js"></script>
<script>
  window.__saves = 0;
  window.__toasts = [];
  window.scheduleAutoSave = () => { window.__saves++; };
  window.showToast = (m) => { window.__toasts.push(String(m)); };
  window.__ready = true;
</script></body></html>`;

const memoOf = (page) => page.evaluate(() => document.getElementById('sec1').getAttribute('data-memo'));
const checkCount = (page) => page.locator('.smp-editor .smp-check').count();
const editorText = (page) => page.evaluate(() => document.querySelector('.smp-editor').textContent);

/* 메모를 심고 모달을 연다. 전제(편집 칸이 contenteditable 이고 포커스를 가졌다)를 여기서 단언한다. */
async function openMemo(page, memo) {
  await page.evaluate((m) => {
    const sec = document.getElementById('sec1');
    if (m == null) sec.removeAttribute('data-memo'); else sec.setAttribute('data-memo', m);
    window.__saves = 0;
    window.toggleSectionMemoPopover(document.querySelector('#sec1 .st-memo-btn'));
  }, memo);
  await page.waitForSelector('.section-memo-backdrop.open');
  await page.waitForFunction(() => {
    const ed = document.querySelector('.smp-editor');
    return !!ed && document.activeElement === ed;
  });
  const pre = await page.evaluate(() => {
    const ed = document.querySelector('.smp-editor');
    return { tag: ed.tagName, editable: ed.isContentEditable, fmt: typeof window.SectionMemoFormat };
  });
  expect(pre, '전제: 편집 칸은 contenteditable DIV 이고 포맷 전역이 실렸다').toEqual({ tag: 'DIV', editable: true, fmt: 'object' });
}

async function closeMemo(page) {
  await page.locator('.smp-close').click();
  await page.waitForFunction(() => !document.querySelector('.section-memo-backdrop'));
}

test.beforeEach(async ({ page }) => {
  await router(page, HARNESS);
  await page.goto(`${ORIGIN}/__harness.html`);
  await page.waitForFunction(() => window.__ready === true);
});

test('C1 `[]` 를 키보드로 치면 체크박스 하나가 되고, 이어 친 글자는 그 뒤에 붙는다', async ({ page }) => {
  await openMemo(page, null);
  expect(await checkCount(page), '전제: 빈 메모에는 체크박스가 없다').toBe(0);
  await page.keyboard.type('[]');
  await expect(page.locator('.smp-editor .smp-check')).toHaveCount(1);
  const attrs = await page.evaluate(() => {
    const c = document.querySelector('.smp-editor .smp-check');
    return { ce: c.getAttribute('contenteditable'), role: c.getAttribute('role'), checked: c.getAttribute('aria-checked'), style: c.getAttribute('style') };
  });
  expect(attrs, '넣은 노드의 속성이 그대로 남는다').toEqual({ ce: 'false', role: 'checkbox', checked: 'false', style: null });
  expect(await editorText(page), '`[]` 글자는 남지 않는다').toBe('');
  await expect.poll(() => memoOf(page)).toBe('[ ]');
  await page.keyboard.type('a');
  await expect.poll(() => memoOf(page)).toBe('[ ]a');
  await expect(page.locator('.smp-count')).toHaveText('4 / 2000');
});

test('C1b `[x]` 를 치면 체크된 체크박스, 줄 가운데서도 바뀐다', async ({ page }) => {
  await openMemo(page, null);
  await page.keyboard.type('할일 [x] 끝');
  await expect(page.locator('.smp-editor .smp-check')).toHaveCount(1);
  await expect(page.locator('.smp-editor .smp-check')).toHaveAttribute('aria-checked', 'true');
  await expect.poll(() => memoOf(page)).toBe('할일 [x] 끝');
});

test('C2 체크박스를 누르면 체크되고 data-memo 가 `[x]` 로, 다시 누르면 원복', async ({ page }) => {
  await openMemo(page, '[ ] 할일');
  const box = page.locator('.smp-editor .smp-check');
  await expect(box).toHaveCount(1);
  await expect(box, '전제: 처음에는 미체크').toHaveAttribute('aria-checked', 'false');
  await box.click();
  await expect(box).toHaveAttribute('aria-checked', 'true');
  await expect.poll(() => memoOf(page)).toBe('[x] 할일');
  expect(await page.evaluate(() => document.activeElement === document.querySelector('.smp-editor')), '누른 뒤에도 편집 칸이 포커스를 가진다').toBe(true);
  await box.click();
  await expect(box).toHaveAttribute('aria-checked', 'false');
  await expect.poll(() => memoOf(page)).toBe('[ ] 할일');
});

test('C3 표식이 든 메모를 열면 체크박스 둘, 닫아도 data-memo 는 한 글자도 안 바뀌고 저장도 안 부른다', async ({ page }) => {
  const MEMO = '할일 [x] 끝\n[ ] 둘';
  await openMemo(page, MEMO);
  await expect(page.locator('.smp-editor .smp-check')).toHaveCount(2);
  expect(await page.evaluate(() => [...document.querySelectorAll('.smp-editor .smp-check')].map((c) => c.getAttribute('aria-checked'))))
    .toEqual(['true', 'false']);
  expect(await editorText(page), '표식 글자는 화면에 안 남는다').toBe('할일  끝 둘');
  await expect(page.locator('.smp-count')).toHaveText(`${[...MEMO].length} / 2000`);
  await closeMemo(page);
  expect(await memoOf(page)).toBe(MEMO);
  expect(await page.evaluate(() => window.__saves), '손대지 않았으면 저장을 안 부른다').toBe(0);

  /* 왕복에서 달라지는 글자(대문자 표식·꼬리 줄바꿈)가 있어도 «손대지 않은 메모»는 그대로다 */
  const ODD = '[X] 대문자\n꼬리\n';
  await openMemo(page, ODD);
  await expect(page.locator('.smp-editor .smp-check')).toHaveCount(1);
  await closeMemo(page);
  expect(await memoOf(page)).toBe(ODD);
  expect(await page.evaluate(() => window.__saves)).toBe(0);
});

test('C4 조합(IME) 중에는 안 바꾼다 — 조합이 끝난 뒤 한 번 바꾼다', async ({ page }) => {
  await openMemo(page, null);
  await page.evaluate(() => {
    const ed = document.querySelector('.smp-editor');
    ed.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true, data: '' }));
    const t = document.createTextNode('[]');
    ed.appendChild(t);
    const r = document.createRange();
    r.setStart(t, 2);
    r.collapse(true);
    const s = window.getSelection();
    s.removeAllRanges();
    s.addRange(r);
    ed.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: ']', isComposing: true }));
  });
  const mid = await page.evaluate(() => ({
    checks: document.querySelectorAll('.smp-editor .smp-check').length,
    text: document.querySelector('.smp-editor').textContent,
    caretInText: window.getSelection().anchorNode.nodeType === 3,
  }));
  expect(mid, '조합 중: 글자 그대로, 캐럿은 그 글자 뒤').toEqual({ checks: 0, text: '[]', caretInText: true });
  await page.evaluate(() => {
    document.querySelector('.smp-editor').dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: ']' }));
  });
  await expect(page.locator('.smp-editor .smp-check')).toHaveCount(1);
  expect(await editorText(page)).toBe('');
  await expect.poll(() => memoOf(page)).toBe('[ ]');
});

test('C5 되돌리기(⌘Z)가 `[]` 글자를 되살리고, 되살아난 글자는 다시 안 바뀐다', async ({ page }) => {
  await openMemo(page, null);
  await page.keyboard.type('[]');
  await expect(page.locator('.smp-editor .smp-check'), '전제: 먼저 체크박스가 됐다').toHaveCount(1);
  await page.keyboard.press('ControlOrMeta+z');
  await expect(page.locator('.smp-editor .smp-check')).toHaveCount(0);
  expect(await editorText(page)).toBe('[]');
  await expect.poll(() => memoOf(page)).toBe('[]');
});

test('C6 모양 — 동그랗고, 체크된 것의 배경은 강조색 토큰', async ({ page }) => {
  await openMemo(page, '[ ] 하나\n[x] 둘');
  await expect(page.locator('.smp-editor .smp-check')).toHaveCount(2);
  const accent = await page.evaluate(() => getComputedStyle(document.getElementById('accent-probe')).backgroundColor);
  expect(accent, '전제: 강조색 토큰이 색으로 풀린다').toMatch(/^rgb\(/);
  expect(accent, '전제: 투명이 아니다').not.toBe('rgba(0, 0, 0, 0)');
  const look = await page.evaluate(() => [...document.querySelectorAll('.smp-editor .smp-check')].map((c) => {
    const cs = getComputedStyle(c);
    return { radius: cs.borderTopLeftRadius, bg: cs.backgroundColor, square: cs.width === cs.height, display: cs.display };
  }));
  expect(look[0]).toEqual({ radius: '50%', bg: 'rgba(0, 0, 0, 0)', square: true, display: 'inline-block' });
  expect(look[1]).toEqual({ radius: '50%', bg: accent, square: true, display: 'inline-block' });
  const mark = await page.evaluate(() => {
    const [off, on] = [...document.querySelectorAll('.smp-editor .smp-check')];
    return { off: getComputedStyle(off, '::after').content, on: getComputedStyle(on, '::after').content };
  });
  expect(mark, '체크 표시는 체크된 것에만 그린다').toEqual({ off: 'none', on: '""' });
});

test('C7 저장돼 있던 `[]` 글자는 열어도 체크박스로 안 바꾼다', async ({ page }) => {
  const MEMO = '[] 할일\n[]';
  await openMemo(page, MEMO);
  expect(await checkCount(page)).toBe(0);
  expect(await editorText(page)).toBe('[] 할일[]');
  /* 그 뒤에 다른 글자를 쳐도 앞의 `[]` 는 그대로다 */
  await page.keyboard.type('a');
  await expect.poll(() => memoOf(page)).toBe('[] 할일\n[]a');
  expect(await checkCount(page)).toBe(0);
});

test('C8 Enter 는 줄바꿈 하나로 저장되고, 체크박스 뒤 Backspace 는 체크박스를 지운다', async ({ page }) => {
  await openMemo(page, null);
  await page.keyboard.type('a');
  await page.keyboard.press('Enter');
  await page.keyboard.type('b');
  await expect.poll(() => memoOf(page)).toBe('a\nb');
  expect(await page.evaluate(() => document.querySelectorAll('.smp-editor div, .smp-editor p').length), '문단 요소로 쪼개지 않는다').toBe(0);
  await page.keyboard.press('Enter');
  await page.keyboard.type('[]');
  await expect(page.locator('.smp-editor .smp-check')).toHaveCount(1);
  await expect.poll(() => memoOf(page)).toBe('a\nb\n[ ]');
  await page.keyboard.press('Backspace');
  await expect(page.locator('.smp-editor .smp-check')).toHaveCount(0);
  await expect.poll(() => memoOf(page)).toBe('a\nb');
});

test('C9 붙여넣기는 평문만 — 마크업은 안 들어오고, 평문 속 표식은 체크박스가 된다', async ({ page }) => {
  await openMemo(page, null);
  const pre = await page.evaluate(() => {
    const dt = new DataTransfer();
    dt.setData('text/plain', '붙임 [x] 하나\n둘');
    dt.setData('text/html', '<b>굵게</b><img src="http://x/a.png" onerror="window.__pwned=1"><script>window.__pwned=1</' + 'script>');
    const ev = new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true });
    const types = [...ev.clipboardData.types];
    document.querySelector('.smp-editor').dispatchEvent(ev);
    return { types, prevented: ev.defaultPrevented };
  });
  expect(pre.types, '전제: 클립보드에 평문과 HTML 이 둘 다 있다').toEqual(expect.arrayContaining(['text/plain', 'text/html']));
  expect(pre.prevented, '기본 붙여넣기를 막는다').toBe(true);
  await expect.poll(() => memoOf(page)).toBe('붙임 [x] 하나\n둘');
  const inside = await page.evaluate(() => ({
    foreign: document.querySelectorAll('.smp-editor b, .smp-editor img, .smp-editor script, .smp-editor [onerror]').length,
    checks: document.querySelectorAll('.smp-editor .smp-check[aria-checked="true"]').length,
    pwned: window.__pwned === 1,
  }));
  expect(inside).toEqual({ foreign: 0, checks: 1, pwned: false });
});
