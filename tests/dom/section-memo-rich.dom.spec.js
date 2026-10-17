/* section-memo-rich — 섹션 메모의 `[]` → 동그란 체크박스(1012t1A1) · 참고 이미지 붙여넣기(1012t1A2)를 잠근다
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
 *
 * 1012t1A2 — 메모에 참고 이미지를 «붙여넣기»로 넣는다. 그림은 프로젝트 자산으로 저장하고
 *   (assetsSaveCanvasImage → goya-asset:// 주소) 메모에는 `![](주소)` 표식만 남긴다.
 *   P1 큰 그림을 붙이면 1280px JPEG 로 줄여 자산 IPC 를 한 번 부르고, 그림 하나와 표식이 남는다
 *   P2 글만 붙이면 자산 IPC 를 안 부르고 글·줄바꿈이 그대로 들어간다
 *   P3 text/html 은 그림 갈래가 생긴 뒤에도 안 읽는다(그림 파일과 같이 와도)
 *   P4 앱 자산이 아닌 주소(http · data:)의 표식은 그림이 아니라 글자다
 *   P5 자산 IPC·프로젝트가 없으면 안 넣고 알림만 띄운다(data URL 로 넣지 않는다)
 *   P6 그림 뒤 Backspace · 그림을 누르고 Delete 로 표식이 사라진다
 *   P7 캡처 클론에서는 메모와 함께 그림 주소도 떼인다
 *   P8 두 장을 붙이면 붙인 차례대로 둘
 *   P9 20MB 를 넘는 파일은 거절한다
 *
 * 이벨류에이터 실측 결함(2026-10-12)을 잠그는 칸:
 *   D1a~e 캐럿 «뒤에 글자가 있어도» 체크박스·그림은 정확히 하나(글 가운데 · 줄 맨 앞 · 한글 사이 · 둘째 줄 · 붙여넣기)
 *   D1f~g 브라우저 판마다 다른 insertHTML 뒷정리(번들 chromium 148 은 줄바꿈을 덧붙이고, 진짜 줄바꿈 앞에서는 삼킨다)에도 저장 글자가 같다
 *   D2·D2b 복사·잘라내기가 표식을 평문에 싣는다 · D2c 갈아 쓴 글이 색 입힌 요소에 싸이지 않는다
 *   D3 서식 단축키(⌘B·⌘I·⌘U·⌘⇧X)가 메모에 안 먹고 전역으로 안 샌다
 *   D4·D4b 조합으로 한도를 넘기면 끝에서 잘라 저장한다(원자 노드는 통째로)
 *   D6 한도가 차서 그림을 못 넣을 때는 자산 IPC 를 안 부른다
 *
 * 재검 실측 결함(2026-10-12 · 원자 노드 이웃에서의 크롬 기본 편집 동작)을 잠그는 칸:
 *   N3a~d 원자 노드 바로 뒤 글 맨 앞에서 Backspace 를 눌러도 끝 체크박스가 복제되지 않는다
 *   N2a~d 뒤·앞에 글이 있는 체크박스·그림이 Backspace·Delete 한 번에 «그것만» 지워지고 ⌘Z 로 되살아난다
 *   N1a~d 원자 노드 앞·뒤 Enter 는 줄바꿈 정확히 하나 · 잘라내 같은 자리에 붙이면 한 글자도 안 다르다
 *   NR 고정 시드로 캐럿 이동·타이핑·Backspace·Delete·Enter 를 섞어도 원자 노드는 안 늘고 남의 요소는 0
 *
 * 안 재는 것: 실제 한글 IME(합성 이벤트로만 잰다) · 실앱(Electron)에서의 전역 단축키 양보 ·
 *   실제 OS 클립보드(합성 ClipboardEvent 로만 잰다) · 실제 goya-asset 프로토콜(route 로 서브한다) · 자산 IPC 본체(스텁).
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
<span id="dim-probe" style="color: var(--ui-text-dim)"></span>
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

/* ══ 1012t1A2 — 참고 이미지 붙여넣기 ═══════════════════════════════════════════════════════
 * 자산 IPC 는 스텁이다(부른 인자를 적고 goya-asset 주소를 돌려준다). goya-asset:// 는 route 로 2×2 PNG 를 서브한다.
 * 그림 파일은 «페이지 안에서» 만든다: canvas → toBlob → File → DataTransfer.items.add → ClipboardEvent. */
const A2_URLS = ['goya-asset://p1/aaaa.jpg', 'goya-asset://p1/bbbb.jpg'];
const A2_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEklEQVR4nGP4z8DwH4QZYAwAR8oH+Rq28akAAAAASUVORK5CYII=', 'base64');
const imgSrcs = (page) => page.evaluate(() => [...document.querySelectorAll('.smp-editor img')].map((i) => i.getAttribute('src')));

async function armA2(page) {
  await page.route('goya-asset://**', (route) => route.fulfill({ contentType: 'image/png', body: A2_PNG }));
  await page.evaluate((urls) => {
    window.__ipc = [];
    window.__docPastes = 0;
    window.activeProjectId = 'p1';
    window.electronAPI = {
      assetsSaveCanvasImage: async (arg) => {
        window.__ipc.push(arg);
        return { ok: true, url: urls[Math.min(window.__ipc.length, urls.length) - 1] };
      },
    };
    document.addEventListener('paste', () => { window.__docPastes++; });
  }, A2_URLS);
}

/* sizes = [[w,h],…] 그림 파일을 그 수만큼 만들어 한 번에 붙인다.
   extra = { html, text, bytes } — bytes: «실제로 풀리는» PNG 뒤에 0 을 덧대 그 크기로 만든 파일
   (가짜 바이트만이면 디코드에서 먼저 실패해, 크기 가드가 없어도 같은 결과가 난다). */
async function pasteFiles(page, sizes, extra) {
  return page.evaluate(async ({ sizes, extra }) => {
    const dt = new DataTransfer();
    for (const [w, h] of sizes) {
      const cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      const ctx = cv.getContext('2d');
      ctx.fillStyle = 'rgb(200, 60, 60)';
      ctx.fillRect(0, 0, w, h);
      const blob = await new Promise((res) => cv.toBlob(res, 'image/png'));
      dt.items.add(new File([blob], 'shot.png', { type: 'image/png' }));
    }
    let big = null;
    if (extra && extra.bytes) {
      const cv = document.createElement('canvas');
      cv.width = 4; cv.height = 4;
      cv.getContext('2d').fillRect(0, 0, 4, 4);
      const head = await new Promise((res) => cv.toBlob(res, 'image/png'));
      const file = new File([head, new Uint8Array(extra.bytes - head.size)], 'big.png', { type: 'image/png' });
      /* 이 파일이 «그림으로 풀리는가» — 크기 가드만이 거절의 이유임을 보이는 전제 */
      const decodes = await new Promise((res) => {
        const u = URL.createObjectURL(file);
        const im = new Image();
        im.onload = () => { URL.revokeObjectURL(u); res(im.naturalWidth > 0); };
        im.onerror = () => { URL.revokeObjectURL(u); res(false); };
        im.src = u;
      });
      big = { size: file.size, decodes };
      dt.items.add(file);
    }
    if (extra && extra.html) dt.setData('text/html', extra.html);
    if (extra && extra.text) dt.setData('text/plain', extra.text);
    const ev = new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true });
    const files = [...ev.clipboardData.items].filter((it) => it.kind === 'file');
    const pre = { files: files.length, imageTypes: files.filter((it) => it.type.startsWith('image/')).length, types: [...ev.clipboardData.types] };
    document.querySelector('.smp-editor').dispatchEvent(ev);
    return { ...pre, big, prevented: ev.defaultPrevented };
  }, { sizes, extra: extra || null });
}

/* 자산 IPC 가 받은 b64 를 그림으로 풀어 크기를 읽는다 */
const ipcDecoded = (page) => page.evaluate(() => Promise.all(window.__ipc.map((a) => new Promise((res) => {
  const im = new Image();
  im.onload = () => res({ projectId: a.projectId, mime: a.mime, w: im.naturalWidth, h: im.naturalHeight });
  im.onerror = () => res({ projectId: a.projectId, mime: a.mime, w: -1, h: -1 });
  im.src = 'data:' + a.mime + ';base64,' + a.b64;
}))));

test('P1 큰 그림을 붙이면 1280px JPEG 로 줄여 자산 IPC 를 한 번 부르고, 그림 하나와 표식이 남는다', async ({ page }) => {
  await armA2(page);
  await openMemo(page, null);
  const pre = await pasteFiles(page, [[2000, 1000]]);
  expect(pre.files, '전제: 클립보드에 파일이 하나 있다').toBe(1);
  expect(pre.imageTypes, '전제: 그 파일의 type 이 image/ 로 시작한다').toBe(1);
  expect(pre.prevented, '기본 붙여넣기를 막는다').toBe(true);
  await expect(page.locator('.smp-editor img.smp-img')).toHaveCount(1);
  expect(await ipcDecoded(page), '자산 IPC 1회 — 긴 변 1280 의 JPEG').toEqual([{ projectId: 'p1', mime: 'image/jpeg', w: 1280, h: 640 }]);
  const attrs = await page.evaluate(() => {
    const i = document.querySelector('.smp-editor img.smp-img');
    return { src: i.getAttribute('src'), ce: i.getAttribute('contenteditable'), drag: i.getAttribute('draggable'), style: i.getAttribute('style') };
  });
  expect(attrs).toEqual({ src: A2_URLS[0], ce: 'false', drag: 'false', style: null });
  await expect.poll(() => memoOf(page)).toBe(`![](${A2_URLS[0]})`);
  expect((await memoOf(page)).includes('data:'), 'data URL 은 메모에 안 실린다').toBe(false);
  expect(await page.evaluate(() => window.__docPastes), '전역 붙여넣기 처리기로 새지 않는다').toBe(0);
  await expect(page.locator('.smp-count')).toHaveText(`${`![](${A2_URLS[0]})`.length} / 2000`);
  /* 그림이 실제로 뜬다(하네스가 goya-asset 을 서브한다) — 편집 칸 너비를 넘지 않는 블록 */
  await page.waitForFunction(() => document.querySelector('.smp-editor img.smp-img').naturalWidth > 0);
  expect(await page.evaluate(() => {
    const cs = getComputedStyle(document.querySelector('.smp-editor img.smp-img'));
    return { display: cs.display, maxWidth: cs.maxWidth };
  })).toEqual({ display: 'block', maxWidth: '100%' });
  /* 다시 열어도 그림으로 보이고, 닫아도 글자가 그대로다 */
  await closeMemo(page);
  await openMemo(page, `앞 ![](${A2_URLS[0]}) 뒤`);
  expect(await imgSrcs(page)).toEqual([A2_URLS[0]]);
  expect(await editorText(page)).toBe('앞  뒤');
  await closeMemo(page);
  expect(await memoOf(page)).toBe(`앞 ![](${A2_URLS[0]}) 뒤`);
  expect(await page.evaluate(() => window.__saves), '손대지 않았으면 저장을 안 부른다').toBe(0);
});

test('P2 글만 붙이면 자산 IPC 를 안 부르고 글·줄바꿈이 그대로 들어간다', async ({ page }) => {
  await armA2(page);
  await openMemo(page, null);
  const pre = await pasteFiles(page, [], { text: '첫 줄\n둘째 줄\n\n넷째' });
  expect(pre.files, '전제: 파일이 없다').toBe(0);
  expect(pre.types, '전제: 평문이 있다').toEqual(['text/plain']);
  await expect.poll(() => memoOf(page)).toBe('첫 줄\n둘째 줄\n\n넷째');
  expect(await page.evaluate(() => window.__ipc.length)).toBe(0);
  expect(await page.locator('.smp-editor img').count()).toBe(0);
});

test('P3 text/html 은 그림 갈래가 생긴 뒤에도 안 읽는다 — 그림 파일과 같이 와도 우리 그림 하나뿐', async ({ page }) => {
  await armA2(page);
  const HTML = '<img src="http://x/a.png" onerror="window.__pwned=1"><script>window.__pwned=1</' + 'script><b>굵게</b>';
  await openMemo(page, null);
  const a = await pasteFiles(page, [], { html: HTML });
  expect(a.types, '전제: 클립보드에 HTML 만 있다').toEqual(['text/html']);
  expect(a.prevented).toBe(true);
  const afterHtmlOnly = await page.evaluate(() => ({
    foreign: document.querySelectorAll('.smp-editor img, .smp-editor script, .smp-editor b, .smp-editor [onerror]').length,
    text: document.querySelector('.smp-editor').textContent,
    ipc: window.__ipc.length,
  }));
  expect(afterHtmlOnly).toEqual({ foreign: 0, text: '', ipc: 0 });

  const b = await pasteFiles(page, [[40, 20]], { html: HTML });
  expect(b.imageTypes, '전제: 이번에는 그림 파일도 같이 있다').toBe(1);
  expect(b.types).toEqual(expect.arrayContaining(['text/html', 'Files']));
  await expect(page.locator('.smp-editor img.smp-img')).toHaveCount(1);
  const afterBoth = await page.evaluate(() => ({
    imgs: [...document.querySelectorAll('.smp-editor img')].map((i) => i.getAttribute('src')),
    bad: document.querySelectorAll('.smp-editor script, .smp-editor b, .smp-editor [onerror]').length,
    pwned: window.__pwned === 1,
  }));
  expect(afterBoth).toEqual({ imgs: [A2_URLS[0]], bad: 0, pwned: false });
});

test('P4 앱 자산이 아닌 주소(http · data:)의 표식은 그림이 아니라 글자다', async ({ page }) => {
  await armA2(page);
  const MEMO = '![](http://evil/x.png) 과 ![](data:image/png;base64,AAAA) 과 ![](javascript:alert(1))';
  let requested = 0;
  await page.route('http://evil/**', (route) => { requested++; return route.fulfill({ status: 404, body: '' }); });
  await openMemo(page, MEMO);
  expect(await page.locator('.smp-editor img').count()).toBe(0);
  expect(await editorText(page), '표식 글자가 그대로 보인다').toBe(MEMO);
  /* 평문으로 붙여 넣어도 마찬가지다 */
  await pasteFiles(page, [], { text: ' ![](https://evil/y.png)' });
  await expect.poll(() => memoOf(page)).toBe(MEMO + ' ![](https://evil/y.png)');
  expect(await page.locator('.smp-editor img').count()).toBe(0);
  expect(requested, '남의 주소로 요청이 나가지 않는다').toBe(0);
  /* 양성 대조 — 같은 길로 «앱 자산» 표식을 붙이면 그림이 된다 */
  await pasteFiles(page, [], { text: `![](${A2_URLS[1]})` });
  await expect(page.locator('.smp-editor img.smp-img')).toHaveCount(1);
  expect(await imgSrcs(page)).toEqual([A2_URLS[1]]);
});

test('P5 자산 IPC·프로젝트가 없으면 안 넣고 알림만 띄운다 — data URL 로 넣지 않는다', async ({ page }) => {
  await armA2(page);
  await page.evaluate(() => { delete window.electronAPI; });
  await openMemo(page, '원래 글');
  const pre = await pasteFiles(page, [[40, 20]]);
  expect(pre.imageTypes, '전제: 그림 파일을 붙였다').toBe(1);
  expect(pre.prevented).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__toasts.length)).toBe(1);
  expect(await page.locator('.smp-editor img').count()).toBe(0);
  await closeMemo(page);
  expect(await memoOf(page)).toBe('원래 글');
  expect(await page.evaluate(() => window.__saves)).toBe(0);

  /* IPC 는 있는데 열린 프로젝트가 없을 때도 같다 */
  await armA2(page);
  await page.evaluate(() => { window.activeProjectId = null; window.__toasts.length = 0; });
  expect(await page.evaluate(() => new URLSearchParams(location.search).get('project')), '전제: 주소에도 프로젝트가 없다').toBe(null);
  await openMemo(page, '원래 글');
  await pasteFiles(page, [[40, 20]]);
  await expect.poll(() => page.evaluate(() => window.__toasts.length)).toBe(1);
  expect(await page.evaluate(() => ({ imgs: document.querySelectorAll('.smp-editor img').length, ipc: window.__ipc.length }))).toEqual({ imgs: 0, ipc: 0 });
  await closeMemo(page);
  expect(await memoOf(page)).toBe('원래 글');
});

test('P6 그림 뒤 Backspace 로, 그림을 누르고 Delete 로 표식이 사라진다', async ({ page }) => {
  await armA2(page);
  await openMemo(page, `가![](${A2_URLS[0]})`);
  await expect(page.locator('.smp-editor img.smp-img'), '전제: 그림이 하나 있다').toHaveCount(1);
  await page.keyboard.press('Backspace');
  await expect(page.locator('.smp-editor img')).toHaveCount(0);
  await expect.poll(() => memoOf(page)).toBe('가');
  await closeMemo(page);

  await openMemo(page, `가![](${A2_URLS[0]})나`);
  const img = page.locator('.smp-editor img.smp-img');
  await expect(img, '전제: 그림이 하나 있다').toHaveCount(1);
  await page.waitForFunction(() => document.querySelector('.smp-editor img.smp-img').naturalWidth > 0);
  await img.click();
  expect(await page.evaluate(() => {
    const s = window.getSelection();
    const r = s.rangeCount ? s.getRangeAt(0) : null;
    const im = document.querySelector('.smp-editor img.smp-img');
    return !!r && !r.collapsed && r.cloneContents().querySelector('img') !== null && r.toString() === '' && r.intersectsNode(im);
  }), '누르면 그 그림 하나가 선택된다').toBe(true);
  await page.keyboard.press('Delete');
  await expect(page.locator('.smp-editor img')).toHaveCount(0);
  await expect.poll(() => memoOf(page)).toBe('가나');
});

test('P7 캡처 클론에서는 메모와 함께 그림 주소도 떼인다', async ({ page }) => {
  await armA2(page);
  const out = await page.evaluate(async (url) => {
    const C = await import('/js/io/capture-safety.js');
    const sec = document.getElementById('sec1');
    sec.setAttribute('data-memo', `참고 ![](${url})`);
    const before = sec.outerHTML.includes('aaaa.jpg');
    const clone = sec.cloneNode(true);
    C.stripEditorOnlyForCapture(clone);
    return { fn: typeof C.stripEditorOnlyForCapture, before, after: clone.outerHTML.includes('aaaa.jpg'), hasMemo: clone.hasAttribute('data-memo'), live: sec.getAttribute('data-memo') };
  }, A2_URLS[0]);
  expect(out.fn, '전제: 캡처 걷기 함수가 실렸다').toBe('function');
  expect(out.before, '전제: 원본에는 그림 주소가 있다').toBe(true);
  expect(out).toMatchObject({ after: false, hasMemo: false, live: `참고 ![](${A2_URLS[0]})` });
});

test('P8 두 장을 한 번에 붙이면 붙인 차례대로 둘', async ({ page }) => {
  await armA2(page);
  await openMemo(page, '가');
  const pre = await pasteFiles(page, [[300, 100], [100, 200]]);
  expect(pre.imageTypes, '전제: 그림 파일 둘').toBe(2);
  await expect(page.locator('.smp-editor img.smp-img')).toHaveCount(2);
  expect(await imgSrcs(page)).toEqual(A2_URLS);
  expect((await ipcDecoded(page)).map((d) => [d.w, d.h]), '자산 IPC 는 붙인 차례대로 — 작은 그림은 키우지 않는다').toEqual([[300, 100], [100, 200]]);
  await expect.poll(() => memoOf(page)).toBe(`가![](${A2_URLS[0]})![](${A2_URLS[1]})`);
  /* 이어 친 글자는 둘째 그림 뒤에 붙는다 */
  await page.keyboard.type('나');
  await expect.poll(() => memoOf(page)).toBe(`가![](${A2_URLS[0]})![](${A2_URLS[1]})나`);
});

test('P9 20MB 를 넘는 파일은 거절한다 — 자산 IPC 를 안 부르고 알림만', async ({ page }) => {
  await armA2(page);
  await openMemo(page, null);
  const pre = await pasteFiles(page, [], { bytes: 20 * 1024 * 1024 + 1 });
  expect(pre.imageTypes, '전제: 그림 type 의 파일 하나').toBe(1);
  expect(pre.big, '전제: 20MB 를 1바이트 넘고, 그림으로는 멀쩡히 풀린다(거절의 이유는 크기뿐)').toEqual({ size: 20 * 1024 * 1024 + 1, decodes: true });
  await expect.poll(() => page.evaluate(() => window.__toasts.length)).toBe(1);
  expect(await page.evaluate(() => window.__toasts[0]), '크기 알림이다(저장 실패 알림이 아니다)').toContain('20MB');
  expect(await page.evaluate(() => ({ imgs: document.querySelectorAll('.smp-editor img').length, ipc: window.__ipc.length }))).toEqual({ imgs: 0, ipc: 0 });
  expect(await memoOf(page)).toBe(null);
});

/* ══ 이벨류에이터 실측 결함(2026-10-12)을 잠그는 칸 ═══════════════════════════════════════════
 * D1 캐럿 «뒤에 글자가 있을 때» 체크박스가 둘 생기던 것 · D2 복사/잘라내기가 표식을 잃던 것 ·
 * D3 서식 단축키가 메모 글에 먹던 것 · D4 조합으로 한도를 넘기면 저장이 통째로 거절되던 것 ·
 * D6 한도 초과로 그림을 거절하면서도 자산 파일을 쓰던 것. */
const afterCaret = (page) => page.evaluate(() => {
  const ed = document.querySelector('.smp-editor');
  const s = window.getSelection();
  const r = document.createRange();
  r.selectNodeContents(ed);
  r.setStart(s.anchorNode, s.anchorOffset);
  return r.toString();
});
async function caretLeft(page, n) {
  for (let i = 0; i < n; i++) await page.keyboard.press('ArrowLeft');
}
const selectAllInEditor = (page) => page.evaluate(() => {
  const ed = document.querySelector('.smp-editor');
  const r = document.createRange();
  r.selectNodeContents(ed);
  const s = window.getSelection();
  s.removeAllRanges();
  s.addRange(r);
  return s.toString();
});
/* 합성 copy/cut — 처리기가 clipboardData 에 실은 것을 돌려준다 */
const clipEvent = (page, type) => page.evaluate((type) => {
  const dt = new DataTransfer();
  const ev = new ClipboardEvent(type, { clipboardData: dt, bubbles: true, cancelable: true });
  document.querySelector('.smp-editor').dispatchEvent(ev);
  return { text: dt.getData('text/plain'), html: dt.getData('text/html'), prevented: ev.defaultPrevented };
}, type);
/* 편집 칸에 «글자·줄바꿈·원자 노드·체크완료 줄 래퍼» 말고 남은 요소 수.
   ★smp-done(1017t1b1 _wrapDoneRuns)은 이름 붙인 확대다 — C12(음성대조)가 그 대가를 잰다. */
const foreignCount = (page) => page.evaluate(() => [...document.querySelectorAll('.smp-editor *')]
  .filter((el) => !el.matches('.smp-check, .smp-img, br, span.smp-done')).length);

test('D1a 글 가운데(캐럿 뒤에 글자)에서 `[]` 를 치면 체크박스는 정확히 하나, 뒤 글자는 그대로 뒤에', async ({ page }) => {
  await openMemo(page, 'abcdef');
  await caretLeft(page, 3);
  expect(await afterCaret(page), '전제: 캐럿 뒤에 글자 셋이 있다').toBe('def');
  await page.keyboard.type('[]');
  await expect(page.locator('.smp-editor .smp-check')).toHaveCount(1);
  await expect.poll(() => memoOf(page)).toBe('abc[ ]def');
  expect(await checkCount(page), '저장된 뒤에도 하나다').toBe(1);
  /* 이어 친 글자는 체크박스 바로 뒤에 붙는다 */
  await page.keyboard.type('Z');
  await expect.poll(() => memoOf(page)).toBe('abc[ ]Zdef');
  /* 편집 칸의 꼴도 브라우저 판과 무관하게 같다 — 줄바꿈 요소가 끼어들지 않는다(번들 chromium 148 은 <br> 를 덧붙였다) */
  expect(await page.evaluate(() => [...document.querySelector('.smp-editor').childNodes]
    .map((n) => (n.nodeType === 3 ? JSON.stringify(n.data) : n.tagName)).join(' '))).toBe('"abc" SPAN "Zdef"');
  /* 글 가운데서도 ⌘Z 가 산다 — Z 를 무르고, 한 번 더 누르면 `[]` 글자로 돌아온다 */
  await page.keyboard.press('ControlOrMeta+z');
  await expect.poll(() => memoOf(page)).toBe('abc[ ]def');
  await page.keyboard.press('ControlOrMeta+z');
  await expect(page.locator('.smp-editor .smp-check')).toHaveCount(0);
  expect(await editorText(page)).toBe('abc[]def');
  await expect.poll(() => memoOf(page)).toBe('abc[]def');
});

test('D1b 줄 맨 앞(뒤에 글)과 한글 사이에서도 체크박스는 정확히 하나', async ({ page }) => {
  await openMemo(page, 'abc');
  await caretLeft(page, 3);
  expect(await afterCaret(page), '전제: 캐럿이 줄 맨 앞이고 뒤에 글 전부가 있다').toBe('abc');
  await page.keyboard.type('[]');
  await expect(page.locator('.smp-editor .smp-check')).toHaveCount(1);
  await expect.poll(() => memoOf(page)).toBe('[ ]abc');
  expect(await checkCount(page)).toBe(1);
  await closeMemo(page);

  await openMemo(page, '가나다라');
  await caretLeft(page, 2);
  expect(await afterCaret(page), '전제: 캐럿이 한글 사이다').toBe('다라');
  await page.keyboard.type('[]');
  await expect(page.locator('.smp-editor .smp-check')).toHaveCount(1);
  await expect.poll(() => memoOf(page)).toBe('가나[ ]다라');
  expect(await checkCount(page)).toBe(1);
});

test('D1c 둘째 줄 가운데서 `[x]` 를 치면 체크된 체크박스 정확히 하나', async ({ page }) => {
  await openMemo(page, 'ab\ncdef');
  await caretLeft(page, 2);
  expect(await afterCaret(page), '전제: 캐럿이 둘째 줄 가운데다').toBe('ef');
  await page.keyboard.type('[x]');
  await expect(page.locator('.smp-editor .smp-check')).toHaveCount(1);
  await expect(page.locator('.smp-editor .smp-check')).toHaveAttribute('aria-checked', 'true');
  await expect.poll(() => memoOf(page)).toBe('ab\ncd[x]ef');
  expect(await checkCount(page)).toBe(1);
});

test('D1d 글 가운데에 평문을 붙여도 표식 하나에 체크박스 정확히 하나, 자리도 그대로', async ({ page }) => {
  await armA2(page);
  await openMemo(page, 'abcdef');
  await caretLeft(page, 3);
  expect(await afterCaret(page), '전제: 캐럿 뒤에 글자 셋이 있다').toBe('def');
  const pre = await pasteFiles(page, [], { text: 'P [x] Q\nR' });
  expect(pre.types, '전제: 평문만 붙였다').toEqual(['text/plain']);
  await expect.poll(() => memoOf(page)).toBe('abcP [x] Q\nRdef');
  expect(await checkCount(page)).toBe(1);
  /* 그림 표식도 같은 길을 탄다 — 글 가운데에 붙여도 그림 하나 */
  await pasteFiles(page, [], { text: `![](${A2_URLS[0]})` });
  await expect.poll(() => memoOf(page)).toBe(`abcP [x] Q\nR![](${A2_URLS[0]})def`);
  expect(await imgSrcs(page)).toEqual([A2_URLS[0]]);
});

test('D1e 글 가운데에 그림을 붙여도 그림은 정확히 하나', async ({ page }) => {
  await armA2(page);
  await openMemo(page, 'abcdef');
  await caretLeft(page, 3);
  expect(await afterCaret(page), '전제: 캐럿 뒤에 글자 셋이 있다').toBe('def');
  const pre = await pasteFiles(page, [[40, 20]]);
  expect(pre.imageTypes, '전제: 그림 파일 하나').toBe(1);
  await expect.poll(() => memoOf(page)).toBe(`abc![](${A2_URLS[0]})def`);
  expect(await imgSrcs(page)).toEqual([A2_URLS[0]]);
});

test('D1f 진짜 줄바꿈 바로 앞(줄 끝 · 빈 줄)에 체크박스·그림을 넣어도 그 줄바꿈은 그대로다', async ({ page }) => {
  await armA2(page);
  await openMemo(page, 'ab\ncd');
  expect(await placeCaret(page, 0, 2), '전제: 캐럿이 첫 줄 끝, 줄바꿈 바로 앞이다').toBe('text:ab|\ncd');
  await page.keyboard.type('[]');
  await expect(page.locator('.smp-editor .smp-check')).toHaveCount(1);
  expect((await liveState(page)).caret, '캐럿은 체크박스 뒤, 줄바꿈 앞').toBe('ab[ ]|\ncd');
  await expect.poll(() => memoOf(page)).toBe('ab[ ]\ncd');
  await page.keyboard.press('ControlOrMeta+z');
  await expect(page.locator('.smp-editor .smp-check'), '⌘Z 가 `[]` 글자로 되돌린다').toHaveCount(0);
  await expect.poll(() => memoOf(page)).toBe('ab[]\ncd');
  await closeMemo(page);

  await openMemo(page, 'ab\ncd');
  expect(await placeCaret(page, 0, 2), '전제: 캐럿이 첫 줄 끝, 줄바꿈 바로 앞이다').toBe('text:ab|\ncd');
  await pasteFiles(page, [], { text: N_IMG });
  await expect.poll(() => memoOf(page)).toBe(`ab${N_IMG}\ncd`);
  expect(await imgSrcs(page)).toEqual([A2_URLS[0]]);
  await closeMemo(page);

  await openMemo(page, 'ab\n\ncd');
  expect(await placeCaret(page, 2), '전제: 캐럿이 빈 줄(두 줄바꿈 사이)이다').toBe('edge:ab\n|\ncd');
  await page.keyboard.type('[]');
  await expect(page.locator('.smp-editor .smp-check')).toHaveCount(1);
  await expect.poll(() => memoOf(page)).toBe('ab\n[ ]\ncd');
  await closeMemo(page);

  /* 줄바꿈이 둘 이어질 때도 하나도 안 사라진다 */
  await openMemo(page, 'ab\n\ncd');
  expect(await placeCaret(page, 0, 2), '전제: 캐럿이 첫 줄 끝이고 뒤에 줄바꿈이 둘이다').toBe('text:ab|\n\ncd');
  await pasteFiles(page, [], { text: N_IMG });
  await expect.poll(() => memoOf(page)).toBe(`ab${N_IMG}\n\ncd`);
  expect((await liveState(page)).caret, '캐럿은 넣은 그림 바로 뒤').toBe(`ab${N_IMG}|\n\ncd`);
});

test('D1g 브라우저가 넣은 체크박스 뒤에 줄바꿈을 덧붙여도(번들 chromium 148 의 꼴) 저장은 한 글자도 안 다르다', async ({ page }) => {
  await openMemo(page, 'abcdef');
  await caretLeft(page, 3);
  expect(await afterCaret(page), '전제: 캐럿 뒤에 글자 셋이 있다').toBe('def');
  /* insertHTML 이 끝난 직후에 <br> 를 하나 덧붙인다 — 어느 판에서 돌든 «덧붙이는 브라우저»를 흉내 낸다 */
  await page.evaluate(() => {
    window.__junk = 0;
    const orig = document.execCommand;
    document.execCommand = function (cmd, ui, val) {
      const r = orig.call(document, cmd, ui, val);
      const c = cmd === 'insertHTML' ? document.querySelector('.smp-editor .smp-check') : null;
      if (c) { c.after(document.createElement('br')); window.__junk++; }
      return r;
    };
  });
  await page.keyboard.type('[]');
  await expect(page.locator('.smp-editor .smp-check')).toHaveCount(1);
  expect(await page.evaluate(() => window.__junk), '전제: 줄바꿈을 정말로 한 번 덧붙였다').toBe(1);
  const st = await liveState(page);
  expect({ all: st.all, caret: st.caret, foreign: st.foreign }).toEqual({ all: 'abc[ ]def', caret: 'abc[ ]|def', foreign: 0 });
  await expect.poll(() => memoOf(page)).toBe('abc[ ]def');
  await page.keyboard.type('Z');
  await expect.poll(() => memoOf(page)).toBe('abc[ ]Zdef');
});

test('D2 복사·잘라내기는 표식을 평문에 싣는다 — 잘라낸 것을 다시 붙이면 체크박스·그림이 되살아난다', async ({ page }) => {
  await armA2(page);
  const MEMO = `[x] 하나\n[ ] 둘 ![](${A2_URLS[0]}) 끝`;
  await openMemo(page, MEMO);
  await expect(page.locator('.smp-editor .smp-check'), '전제: 체크박스 둘').toHaveCount(2);
  expect(await imgSrcs(page), '전제: 그림 하나').toEqual([A2_URLS[0]]);
  expect(await selectAllInEditor(page), '전제: 화면 글자에는 표식이 없다(기본 복사가 싣는 것)').not.toContain('[');
  const copied = await clipEvent(page, 'copy');
  expect(copied, '복사: 저장 글자 그대로 · HTML 은 안 싣는다').toEqual({ text: MEMO, html: '', prevented: true });
  expect(await memoOf(page), '복사는 메모를 안 바꾼다').toBe(MEMO);

  const cut = await clipEvent(page, 'cut');
  expect(cut).toEqual({ text: MEMO, html: '', prevented: true });
  await expect(page.locator('.smp-editor .smp-check')).toHaveCount(0);
  await expect.poll(() => memoOf(page), '잘라내면 메모가 비고 저장된다').toBe(null);

  await pasteFiles(page, [], { text: cut.text });
  await expect.poll(() => memoOf(page)).toBe(MEMO);
  expect(await page.evaluate(() => [...document.querySelectorAll('.smp-editor .smp-check')].map((c) => c.getAttribute('aria-checked')))).toEqual(['true', 'false']);
  expect(await imgSrcs(page)).toEqual([A2_URLS[0]]);
  expect(await foreignCount(page), '붙인 글이 남의 요소에 싸이지 않는다').toBe(0);
});

test('D2b 일부만 골라 복사하면 그 범위의 표식만 실리고, 고른 것이 없으면 아무것도 안 싣는다', async ({ page }) => {
  await openMemo(page, '가 [x] 나 [ ] 다');
  await expect(page.locator('.smp-editor .smp-check'), '전제: 체크박스 둘').toHaveCount(2);
  const none = await clipEvent(page, 'copy');
  expect(none, '고른 것이 없다 — 기본 동작에 맡긴다').toEqual({ text: '', html: '', prevented: false });
  /* 첫 체크박스 앞 글자 하나부터 그 뒤 글자 둘까지 */
  const picked = await page.evaluate(() => {
    const ed = document.querySelector('.smp-editor');
    const first = ed.querySelector('.smp-check');
    const r = document.createRange();
    r.setStart(first.previousSibling, first.previousSibling.data.length - 1);
    r.setEnd(first.nextSibling, 2);
    const s = window.getSelection();
    s.removeAllRanges();
    s.addRange(r);
    return r.cloneContents().querySelectorAll('.smp-check').length;
  });
  expect(picked, '전제: 고른 범위에 체크박스가 하나 들었다').toBe(1);
  expect((await clipEvent(page, 'copy')).text).toBe(' [x] 나');
  const cut = await clipEvent(page, 'cut');
  expect(cut.text).toBe(' [x] 나');
  await expect.poll(() => memoOf(page)).toBe('가 [ ] 다');
  expect(await checkCount(page)).toBe(1);
});

test('D2c 체크된 체크박스로 시작하는 글을 통째로 갈아 써도 글이 색 입힌 요소에 싸이지 않는다', async ({ page }) => {
  await openMemo(page, '[x] 하나\n[ ] 둘');
  await expect(page.locator('.smp-editor .smp-check[aria-checked="true"]'), '전제: 첫 노드가 체크된 체크박스다').toHaveCount(1);
  expect(await page.evaluate(() => document.querySelector('.smp-editor').firstChild.className), '전제: 편집 칸의 첫 노드가 그 체크박스다').toBe('smp-check');
  await page.keyboard.press('ControlOrMeta+a');
  expect(await page.evaluate(() => window.getSelection().toString().length > 0), '전제: 전체가 선택됐다').toBe(true);
  await page.keyboard.type('q');
  await expect.poll(() => memoOf(page)).toBe('q');
  expect(await page.evaluate(() => document.querySelector('.smp-editor').innerHTML), '글자만 남는다').toBe('q');
  /* 캐럿은 그 글자 뒤에 남아 이어 칠 수 있다 */
  await page.keyboard.type('r');
  await expect.poll(() => memoOf(page)).toBe('qr');
  expect(await foreignCount(page)).toBe(0);
});

test('D3 ⌘B·⌘I·⌘U·⌘⇧X 는 메모 글에 서식을 입히지 않고 전역 단축키 처리기로도 새지 않는다', async ({ page }) => {
  await openMemo(page, 'abc def');
  /* js/editor.js 의 전역 keydown 과 같은 자리(document · bubble)에 세는 자를 둔다 */
  await page.evaluate(() => {
    window.__leaks = [];
    document.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && !['Meta', 'Control', 'Shift'].includes(e.key)) window.__leaks.push((e.shiftKey ? 'S+' : '') + e.code);
    });
  });
  expect((await selectAllInEditor(page)), '전제: 글 전체가 선택됐다').toBe('abc def');
  /* 양성 대조 — 막지 않는 조합은 그 자까지 닿는다 */
  await page.keyboard.press('ControlOrMeta+k');
  expect(await page.evaluate(() => window.__leaks), '전제: 세는 자가 조합 키를 본다').toEqual(['KeyK']);
  for (const k of ['ControlOrMeta+b', 'ControlOrMeta+i', 'ControlOrMeta+u', 'ControlOrMeta+Shift+x']) await page.keyboard.press(k);
  expect(await page.evaluate(() => window.__leaks), '네 조합은 전역으로 안 샌다').toEqual(['KeyK']);
  expect(await page.evaluate(() => document.querySelector('.smp-editor').innerHTML), '서식 요소가 안 생긴다').toBe('abc def');
  expect(await foreignCount(page)).toBe(0);
  /* 막은 뒤에도 편집은 된다 */
  await page.keyboard.press('ArrowRight');
  await page.keyboard.type('!');
  await expect.poll(() => memoOf(page)).toBe('abc def!');
});

/* 조합(IME) 한 번을 합성한다 — 조합 중에 글자가 DOM 에 들어오고(beforeinput 으로 못 막는다) 끝난다 */
const composeAt = (page, where, text) => page.evaluate(({ where, text }) => {
  const ed = document.querySelector('.smp-editor');
  ed.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true, data: '' }));
  const t = document.createTextNode(text);
  if (where === 'start') ed.insertBefore(t, ed.firstChild); else ed.appendChild(t);
  const r = document.createRange();
  r.setStart(t, t.data.length);
  r.collapse(true);
  const s = window.getSelection();
  s.removeAllRanges();
  s.addRange(r);
  ed.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertCompositionText', data: text, isComposing: true }));
  const mid = document.querySelector('.smp-count').textContent;
  ed.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: text }));
  return mid;
}, { where, text });

test('D4 조합(IME)으로 2000자를 넘기면 끝에서 잘라 2000자로 저장한다 — 거절하지 않고 사람 말로 알린다', async ({ page }) => {
  const BASE = 'a'.repeat(1998);
  await openMemo(page, BASE);
  await expect(page.locator('.smp-count'), '전제: 한도까지 두 자 남았다').toHaveText('1998 / 2000');
  const mid = await composeAt(page, 'end', '가나다라');
  expect(mid, '전제: 조합 중에는 한도를 넘었다').toBe('2002 / 2000');
  await expect(page.locator('.smp-count')).toHaveText('2000 / 2000');
  await expect.poll(() => memoOf(page)).toBe(BASE + '가나');
  await expect(page.locator('.smp-status')).toHaveText('2000자까지 저장됩니다');
  /* 그 뒤 편집도 저장된다 */
  await page.keyboard.press('Backspace');
  await expect.poll(() => memoOf(page)).toBe(BASE + '가');
  expect(await page.locator('.smp-status').textContent(), '오류 글이 아니다').not.toMatch(/오류|TOO_LONG/);
});

test('D4b 끝에서 자를 때 체크박스는 반쪽 내지 않고 통째로 뗀다', async ({ page }) => {
  const BASE = 'a'.repeat(1996);
  await openMemo(page, BASE + '[ ]');
  await expect(page.locator('.smp-editor .smp-check'), '전제: 글 끝에 체크박스가 하나 있다').toHaveCount(1);
  await expect(page.locator('.smp-count'), '전제: 한도까지 한 자 남았다').toHaveText('1999 / 2000');
  const mid = await composeAt(page, 'start', '가나다');
  expect(mid, '전제: 조합 중에는 두 자를 넘었다').toBe('2002 / 2000');
  await expect.poll(() => memoOf(page)).toBe('가나다' + BASE);
  expect(await checkCount(page), '체크박스는 통째로 떼인다').toBe(0);
  await expect(page.locator('.smp-count')).toHaveText('1999 / 2000');
  await expect(page.locator('.smp-status')).toHaveText('2000자까지 저장됩니다');
});

test('D6 한도가 차서 그림을 못 넣을 때는 자산 IPC 를 부르지 않는다 — 안 쓰일 자산 파일을 만들지 않는다', async ({ page }) => {
  await armA2(page);
  const FULL = 'a'.repeat(1990);
  await openMemo(page, FULL);
  await expect(page.locator('.smp-count'), '전제: 남은 자리가 표식 하나보다 적다').toHaveText('1990 / 2000');
  expect(`![](${A2_URLS[0]})`.length, '전제: 표식 길이가 남은 자리(10)보다 길다').toBeGreaterThan(10);
  const pre = await pasteFiles(page, [[40, 20]]);
  expect(pre.imageTypes, '전제: 그림 파일을 붙였다').toBe(1);
  await expect.poll(() => page.evaluate(() => window.__toasts.length)).toBe(1);
  expect(await page.evaluate(() => window.__toasts[0])).toContain('2000자');
  expect(await page.evaluate(() => ({ imgs: document.querySelectorAll('.smp-editor img').length, ipc: window.__ipc.length })), '자산 IPC 0회').toEqual({ imgs: 0, ipc: 0 });
  await closeMemo(page);
  expect(await memoOf(page)).toBe(FULL);
  /* 양성 대조 — 자리가 있으면 같은 길로 IPC 를 부르고 그림이 들어간다 */
  await openMemo(page, 'a'.repeat(100));
  await pasteFiles(page, [[40, 20]]);
  await expect(page.locator('.smp-editor img.smp-img')).toHaveCount(1);
  expect(await page.evaluate(() => window.__ipc.length)).toBe(1);
});

/* ══ 재검 실측 결함(2026-10-12) — 원자 노드(체크박스·그림) 이웃에서의 크롬 기본 편집 동작 ═══════════
 * N3 원자 노드 바로 뒤 글 맨 앞에서 Backspace 를 누르면 «끝 체크박스»가 누를 때마다 하나씩 복제되던 것 ·
 * N2 뒤에 글이 있는 원자 노드가 Backspace·Delete 로 안 지워지던 것 ·
 * N1 원자 노드 앞에서 Enter(와 붙여넣기의 줄바꿈)가 줄바꿈을 둘 넣던 것. */
/* 편집 칸의 «지금»을 DOM 에서 바로 읽는다(저장은 500ms 뒤라 조작 직후에는 data-memo 가 옛 값이다).
   caret = 저장 글자로 본 캐럿 자리 `앞|뒤` · edge = 캐럿이 글자 노드 안이 아니라 요소 경계에 있다 */
const liveState = (page) => page.evaluate(() => {
  const ed = document.querySelector('.smp-editor');
  const ser = (root) => {
    let s = '';
    for (const n of root.childNodes) {
      if (n.nodeType === 3) s += n.data;
      else if (n.nodeType !== 1) continue;
      else if (n.matches('.smp-check')) s += n.getAttribute('aria-checked') === 'true' ? '[x]' : '[ ]';
      else if (n.matches('img.smp-img')) s += `![](${n.getAttribute('src')})`;
      else if (n.tagName === 'BR') s += '\n';
      /* smp-done(1017t1b1)은 저장 글자에 투명해야 한다(js/section-memo.js _domToTokens 와 같은 성질 — C13) */
      else if (n.matches('span.smp-done')) s += ser(n);
      else s += `<${n.tagName}>` + ser(n);
    }
    return s;
  };
  const sel = window.getSelection();
  const inEd = !!sel.rangeCount && ed.contains(sel.anchorNode);
  let before = null;
  let after = null;
  if (inEd) {
    const a = document.createRange();
    a.selectNodeContents(ed);
    a.setEnd(sel.anchorNode, sel.anchorOffset);
    const b = document.createRange();
    b.selectNodeContents(ed);
    b.setStart(sel.anchorNode, sel.anchorOffset);
    before = ser(a.cloneContents());
    after = ser(b.cloneContents());
  }
  const all = ser(ed);
  return {
    caret: inEd ? `${before}|${after}` : null,
    edge: inEd && sel.anchorNode.nodeType === 1,
    collapsed: sel.isCollapsed,
    all,
    nl: all.split('\n').length - 1,
    tail: after,
    checks: ed.querySelectorAll('.smp-check').length,
    imgs: ed.querySelectorAll('img.smp-img').length,
    atoms: ed.querySelectorAll('.smp-check, .smp-img').length,
    foreign: [...ed.querySelectorAll('*')].filter((el) => !el.matches('.smp-check, .smp-img, br, span.smp-done')).length,
  };
});
/* 캐럿을 편집 칸의 i번째 자식 노드에 놓는다 — off 가 수면 그 글자 노드 안, 없으면 요소 경계(편집 칸, i).
   놓은 자리를 `앞|뒤` 로 돌려준다(검사가 그것을 전제로 단언한다). */
async function placeCaret(page, i, off) {
  await page.evaluate(({ i, off }) => {
    const ed = document.querySelector('.smp-editor');
    const r = document.createRange();
    if (off == null) r.setStart(ed, i); else r.setStart(ed.childNodes[i], off);
    r.collapse(true);
    const s = window.getSelection();
    s.removeAllRanges();
    s.addRange(r);
  }, { i, off: off == null ? null : off });
  const st = await liveState(page);
  return `${st.edge ? 'edge' : 'text'}:${st.caret}`;
}
async function pressN(page, key, n) {
  for (let i = 0; i < n; i++) await page.keyboard.press(key);
}
const N_IMG = `![](${A2_URLS[0]})`;

/* N3 표본 — [메모, 캐럿(자식 번호·글자 자리), 전제 캐럿 자리, Backspace 1회 뒤, 3회 뒤] */
const N3_SAMPLES = {
  a: ['ab[ ]cd[x]', [2, 0], 'text:ab[ ]|cd[x]', 'abcd[x]', 'cd[x]'],
  b: ['[ ] 할일 [x]', [1, 0], 'text:[ ]| 할일 [x]', ' 할일 [x]', ' 할일 [x]'],
  /* ★1017t1b1: [x] 뒤의 " 하나" 는 체크완료 줄이라 span.smp-done 으로 싸인다(_wrapDoneRuns) ⇒
     ci=3 은 이제 그 래퍼 자신이고, 캐럿은 「요소 경계」로 보인다(edge:) — 글자 내용은 그대로다. */
  c: ['제목\n[x] 하나\n[ ]', [3, 0], 'edge:제목\n[x]| 하나\n[ ]', '제목\n 하나\n[ ]', '제 하나\n[ ]'],
};
const N3_NAMES = {
  a: 'N3a `ab[ ]cd[x]` 의 c 앞에서 Backspace — 끝 체크박스가 복제되지 않는다(1회 · 3회)',
  b: 'N3b `[ ] 할일 [x]` 의 첫 체크박스 뒤에서 Backspace — 끝 체크박스가 복제되지 않는다(1회 · 3회)',
  c: 'N3c 여러 줄 메모의 체크박스 뒤에서 Backspace — 끝 체크박스가 복제되지 않고 줄바꿈도 안 사라진다(1회 · 3회)',
};
for (const k of Object.keys(N3_SAMPLES)) {
  test(N3_NAMES[k], async ({ page }) => {
    const [memo, [ci, co], where, after1, after3] = N3_SAMPLES[k];
    for (const [times, want] of [[1, after1], [3, after3]]) {
      await openMemo(page, memo);
      const had = (await liveState(page)).checks;
      expect(had, '전제: 체크박스 둘로 열렸다').toBe(2);
      expect(await page.evaluate(() => document.querySelector('.smp-editor').lastChild.className), '전제: 메모의 마지막 노드가 체크박스다').toBe('smp-check');
      expect(await placeCaret(page, ci, co), '전제: 캐럿이 체크박스 바로 뒤 글의 맨 앞이다').toBe(where);
      for (let i = 0; i < times; i++) {
        await page.keyboard.press('Backspace');
        expect((await liveState(page)).checks, `Backspace ${i + 1}회째: 체크박스가 늘지 않는다`).toBeLessThanOrEqual(had);
      }
      const st = await liveState(page);
      expect({ all: st.all, checks: st.checks, foreign: st.foreign }, `Backspace ${times}회 뒤`).toEqual({ all: want, checks: 1, foreign: 0 });
      await expect.poll(() => memoOf(page)).toBe(want);
      await closeMemo(page);
      expect(await memoOf(page), '닫은 뒤에도 그 글자다').toBe(want);
    }
  });
}

test('N3d 글 가운데에 `[]` 를 치고 곧바로 Backspace — 방금 넣은 것만 지워지고 끝 체크박스는 그대로 하나', async ({ page }) => {
  await openMemo(page, 'abcd[x]');
  expect(await placeCaret(page, 0, 2), '전제: 캐럿이 글 가운데다').toBe('text:ab|cd[x]');
  await page.keyboard.type('[]');
  await expect(page.locator('.smp-editor .smp-check'), '전제: 체크박스가 하나 더 생겼다').toHaveCount(2);
  expect((await liveState(page)).caret, '전제: 캐럿이 방금 넣은 체크박스 바로 뒤다').toBe('ab[ ]|cd[x]');
  await page.keyboard.press('Backspace');
  expect((await liveState(page)).all).toBe('abcd[x]');
  await pressN(page, 'Backspace', 2);
  const st = await liveState(page);
  expect({ all: st.all, checks: st.checks }).toEqual({ all: 'cd[x]', checks: 1 });
  await expect.poll(() => memoOf(page)).toBe('cd[x]');
});

test('N2a 뒤에 글이 있는 체크박스 — 그 뒤 글 맨 앞에서 Backspace 한 번에 지워지고, ⌘Z 로 되살아난다', async ({ page }) => {
  await openMemo(page, 'ab[ ]cd');
  expect(await placeCaret(page, 2, 0), '전제: 캐럿이 체크박스 바로 뒤 글의 맨 앞이다').toBe('text:ab[ ]|cd');
  await page.keyboard.press('Backspace');
  const st = await liveState(page);
  expect({ all: st.all, checks: st.checks, caret: st.caret }).toEqual({ all: 'abcd', checks: 0, caret: 'ab|cd' });
  await expect.poll(() => memoOf(page)).toBe('abcd');
  await page.keyboard.press('ControlOrMeta+z');
  await expect(page.locator('.smp-editor .smp-check'), '⌘Z 가 지운 체크박스를 되살린다').toHaveCount(1);
  await expect.poll(async () => (await liveState(page)).all).toBe('ab[ ]cd');
  await expect.poll(() => memoOf(page)).toBe('ab[ ]cd');
  /* 다시 지우고 이어 친 글자는 지운 자리에 들어간다 */
  expect(await placeCaret(page, 2, 0), '전제: 캐럿이 되살아난 체크박스 바로 뒤 글의 맨 앞이다').toBe('text:ab[ ]|cd');
  await page.keyboard.press('Backspace');
  await page.keyboard.type('Z');
  const end = await liveState(page);
  expect({ all: end.all, checks: end.checks, foreign: end.foreign }).toEqual({ all: 'abZcd', checks: 0, foreign: 0 });
  await expect.poll(() => memoOf(page)).toBe('abZcd');
});

test('N2b 뒤에 글이 있는 그림 — 그 뒤 글 맨 앞에서 Backspace 한 번에 지워지고, ⌘Z 로 되살아난다', async ({ page }) => {
  await armA2(page);
  await openMemo(page, `ab${N_IMG}cd`);
  expect((await liveState(page)).imgs, '전제: 그림이 하나 있다').toBe(1);
  expect(await placeCaret(page, 2, 0), '전제: 캐럿이 그림 바로 뒤 글의 맨 앞이다').toBe(`text:ab${N_IMG}|cd`);
  await page.keyboard.press('Backspace');
  const st = await liveState(page);
  expect({ all: st.all, imgs: st.imgs, caret: st.caret }).toEqual({ all: 'abcd', imgs: 0, caret: 'ab|cd' });
  await expect.poll(() => memoOf(page)).toBe('abcd');
  await page.keyboard.press('ControlOrMeta+z');
  await expect(page.locator('.smp-editor img.smp-img'), '⌘Z 가 지운 그림을 되살린다').toHaveCount(1);
  await expect.poll(() => memoOf(page)).toBe(`ab${N_IMG}cd`);
});

test('N2c 원자 노드 바로 앞 글 끝에서 Delete 한 번 — 그 노드만 지워지고(체크박스 · 그림), ⌘Z 로 되살아난다', async ({ page }) => {
  await armA2(page);
  for (const [atom, key] of [['[ ]', 'checks'], [N_IMG, 'imgs']]) {
    await openMemo(page, `ab${atom}cd`);
    expect((await liveState(page))[key], '전제: 원자 노드가 하나 있다').toBe(1);
    expect(await placeCaret(page, 0, 2), '전제: 캐럿이 원자 노드 바로 앞 글의 맨 끝이다').toBe(`text:ab|${atom}cd`);
    await page.keyboard.press('Delete');
    const st = await liveState(page);
    expect({ all: st.all, atoms: st.atoms, caret: st.caret }, `${key}: Delete 1회`).toEqual({ all: 'abcd', atoms: 0, caret: 'ab|cd' });
    await expect.poll(() => memoOf(page)).toBe('abcd');
    await page.keyboard.press('ControlOrMeta+z');
    await expect.poll(async () => (await liveState(page)).all, `${key}: ⌘Z 가 되살린다`).toBe(`ab${atom}cd`);
    await closeMemo(page);
    expect(await memoOf(page)).toBe(`ab${atom}cd`);
  }
});

test('N2d 원자 노드가 나란할 때는 캐럿 쪽 하나만 지운다 — 요소 경계의 캐럿에서도, 글 가운데서는 글자만', async ({ page }) => {
  await armA2(page);
  const MEMO = `ab[ ][x]${N_IMG}cd`;
  await openMemo(page, MEMO);
  expect((await liveState(page)).atoms, '전제: 원자 노드 셋이 나란하다').toBe(3);
  expect(await placeCaret(page, 4, 0), '전제: 캐럿이 그림 바로 뒤 글의 맨 앞이다').toBe(`text:ab[ ][x]${N_IMG}|cd`);
  await page.keyboard.press('Backspace');
  expect((await liveState(page)).all, 'Backspace: 그림만').toBe('ab[ ][x]cd');
  expect(await placeCaret(page, 0, 2), '전제: 캐럿이 첫 체크박스 바로 앞이다').toBe('text:ab|[ ][x]cd');
  await page.keyboard.press('Delete');
  expect((await liveState(page)).all, 'Delete: 첫 체크박스만').toBe('ab[x]cd');
  await closeMemo(page);
  /* 요소 경계(두 원자 노드 사이)의 캐럿 — 앞은 Backspace 가, 뒤는 Delete 가 지운다 */
  await openMemo(page, MEMO);
  expect(await placeCaret(page, 2), '전제: 캐럿이 두 체크박스 사이의 요소 경계다').toBe(`edge:ab[ ]|[x]${N_IMG}cd`);
  await page.keyboard.press('Backspace');
  expect((await liveState(page)).all).toBe(`ab[x]${N_IMG}cd`);
  expect(await placeCaret(page, 2), '전제: 캐럿이 체크박스와 그림 사이의 요소 경계다').toBe(`edge:ab[x]|${N_IMG}cd`);
  await page.keyboard.press('Delete');
  expect((await liveState(page)).all).toBe('ab[x]cd');
  /* 양성 대조 — 원자 노드에 닿지 않은 캐럿에서는 글자만 지운다 */
  expect(await placeCaret(page, 2, 1), '전제: 캐럿이 글 가운데다').toBe('text:ab[x]c|d');
  await page.keyboard.press('Backspace');
  expect((await liveState(page)).all).toBe('ab[x]d');
  expect(await placeCaret(page, 0, 1), '전제: 캐럿이 글 가운데다').toBe('text:a|b[x]d');
  await page.keyboard.press('Delete');
  const st = await liveState(page);
  expect({ all: st.all, checks: st.checks, foreign: st.foreign }).toEqual({ all: 'a[x]d', checks: 1, foreign: 0 });
  await expect.poll(() => memoOf(page)).toBe('a[x]d');
});

/* Enter 한 번 → 줄바꿈이 정확히 하나 늘고, 이어 친 글자가 새 줄 맨 앞에 온다 */
async function enterOnce(page, wantAfterEnter, wantAfterType) {
  const before = await liveState(page);
  await page.keyboard.press('Enter');
  const mid = await liveState(page);
  expect(mid.nl - before.nl, 'Enter 한 번에 줄바꿈은 정확히 하나 는다').toBe(1);
  expect({ all: mid.all, atoms: mid.atoms }).toEqual({ all: wantAfterEnter, atoms: before.atoms });
  await page.keyboard.type('X');
  const end = await liveState(page);
  expect({ all: end.all, foreign: end.foreign }, '이어 친 글자가 새 줄 맨 앞에 온다').toEqual({ all: wantAfterType, foreign: 0 });
  await expect.poll(() => memoOf(page)).toBe(wantAfterType);
}

test('N1a 그림 바로 앞에서 Enter — 줄바꿈은 정확히 하나, 이어 친 글자는 새 줄 맨 앞', async ({ page }) => {
  await armA2(page);
  await openMemo(page, `a${N_IMG} gh`);
  expect((await liveState(page)).imgs, '전제: 그림이 하나 있다').toBe(1);
  expect(await placeCaret(page, 0, 1), '전제: 캐럿이 그림 바로 앞 글의 맨 끝이다').toBe(`text:a|${N_IMG} gh`);
  await enterOnce(page, `a\n${N_IMG} gh`, `a\nX${N_IMG} gh`);
});

test('N1b 체크박스 바로 앞에서 Enter — 줄바꿈은 정확히 하나(글 끝의 체크박스 앞에서도)', async ({ page }) => {
  await openMemo(page, 'a[ ]gh');
  expect(await placeCaret(page, 0, 1), '전제: 캐럿이 체크박스 바로 앞 글의 맨 끝이다').toBe('text:a|[ ]gh');
  await enterOnce(page, 'a\n[ ]gh', 'a\nX[ ]gh');
  await closeMemo(page);
  await openMemo(page, 'a[x]');
  expect(await placeCaret(page, 0, 1), '전제: 캐럿 뒤에 체크박스 하나뿐이다').toBe('text:a|[x]');
  await enterOnce(page, 'a\n[x]', 'a\nX[x]');
});

test('N1c 체크박스 바로 뒤(요소 경계)에서 Enter — 뒤가 글이든 원자 노드든 줄바꿈은 정확히 하나', async ({ page }) => {
  await armA2(page);
  await openMemo(page, 'a[ ]gh');
  expect(await placeCaret(page, 2), '전제: 캐럿이 체크박스 바로 뒤 요소 경계다').toBe('edge:a[ ]|gh');
  await enterOnce(page, 'a[ ]\ngh', 'a[ ]\nXgh');
  await closeMemo(page);
  await openMemo(page, '[ ][x] z');
  expect(await placeCaret(page, 1), '전제: 캐럿이 두 체크박스 사이의 요소 경계다').toBe('edge:[ ]|[x] z');
  await enterOnce(page, '[ ]\n[x] z', '[ ]\nX[x] z');
  await closeMemo(page);
  await openMemo(page, `[x]${N_IMG}`);
  expect(await placeCaret(page, 1), '전제: 캐럿이 체크박스와 그림 사이의 요소 경계다').toBe(`edge:[x]|${N_IMG}`);
  await enterOnce(page, `[x]\n${N_IMG}`, `[x]\nX${N_IMG}`);
});

test('N1d 잘라내 같은 자리에 붙이면 — 붙일 자리 바로 뒤가 그림·체크박스여도 data-memo 가 한 글자도 안 다르다', async ({ page }) => {
  await armA2(page);
  for (const atom of [N_IMG, '[x]']) {
    const MEMO = `가\n나\n${atom} 끝`;
    await openMemo(page, MEMO);
    expect((await liveState(page)).atoms, '전제: 원자 노드가 하나 있다').toBe(1);
    /* 글 맨 앞부터 원자 노드 바로 앞까지(`가\n나\n`)를 고른다 */
    const picked = await page.evaluate(() => {
      const ed = document.querySelector('.smp-editor');
      const atomEl = ed.querySelector('.smp-check, .smp-img');
      const r = document.createRange();
      r.setStart(ed, 0);
      r.setEndBefore(atomEl);
      const s = window.getSelection();
      s.removeAllRanges();
      s.addRange(r);
      return { text: s.toString(), next: (r.endContainer.childNodes[r.endOffset] || {}).className };
    });
    expect(picked.next, '전제: 고른 범위 바로 뒤가 원자 노드다').toMatch(/^smp-(img|check)$/);
    const cut = await clipEvent(page, 'cut');
    expect(cut.text, '전제: 잘라낸 글자에 줄바꿈 둘이 실렸다').toBe('가\n나\n');
    await expect.poll(() => memoOf(page), '전제: 잘라낸 뒤에는 원자 노드와 꼬리 글만 남는다').toBe(`${atom} 끝`);
    expect((await liveState(page)).caret, '전제: 캐럿이 잘라낸 그 자리(원자 노드 바로 앞)다').toBe(`|${atom} 끝`);
    await pasteFiles(page, [], { text: cut.text });
    await expect.poll(() => memoOf(page)).toBe(MEMO);
    const st = await liveState(page);
    expect({ all: st.all, atoms: st.atoms, foreign: st.foreign }).toEqual({ all: MEMO, atoms: 1, foreign: 0 });
    await closeMemo(page);
    expect(await memoOf(page)).toBe(MEMO);
  }
});

test('NR 고정 시드 무작위 — 캐럿 이동·타이핑·Backspace·Delete·Enter 를 섞어도 원자 노드는 늘지 않고 남의 요소는 0', async ({ page }) => {
  await armA2(page);
  /* 작은 LCG(고정 시드) — 같은 조작 줄이 매번 나온다 */
  let seed = 20261012;
  const rnd = (n) => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return Math.floor((seed / 4294967296) * n);
  };
  const MEMO = `가[ ]나다\n[x] 라${N_IMG}마[ ][x]\n바 ${N_IMG}\n사[ ]`;
  const OPS = ['ArrowLeft', 'ArrowLeft', 'ArrowRight', 'ArrowRight', 'jump', 'jump', 'type', 'type', 'Backspace', 'Backspace', 'Delete', 'Delete', 'Enter'];
  const ROUNDS = 4;
  const PER_ROUND = 50;
  let ops = 0;
  let atomDeletes = 0;
  let enters = 0;
  for (let round = 0; round < ROUNDS; round++) {
    await openMemo(page, MEMO);
    let prev = await liveState(page);
    expect({ atoms: prev.atoms, foreign: prev.foreign, all: prev.all }, '전제: 원자 노드 일곱으로 열렸고 마지막이 체크박스다').toEqual({ atoms: 7, foreign: 0, all: MEMO });
    for (let i = 0; i < PER_ROUND; i++) {
      const op = OPS[rnd(OPS.length)];
      const r = rnd(1000);
      if (op === 'jump') {
        /* 캐럿을 임의의 자식 노드로 — 글자 노드면 맨 앞·맨 끝·가운데 중 하나, 요소면 그 앞 경계 */
        await page.evaluate((r) => {
          const ed = document.querySelector('.smp-editor');
          const n = ed.childNodes[r % Math.max(1, ed.childNodes.length)];
          const rg = document.createRange();
          if (n && n.nodeType === 3) rg.setStart(n, [0, n.data.length, n.data.length >> 1][(r >> 4) % 3]);
          else rg.setStart(ed, n ? [...ed.childNodes].indexOf(n) : 0);
          rg.collapse(true);
          const s = window.getSelection();
          s.removeAllRanges();
          s.addRange(rg);
        }, r);
      } else if (op === 'type') {
        await page.keyboard.type('qw 가z'[r % 5]);
      } else {
        await page.keyboard.press(op);
      }
      ops++;
      const cur = await liveState(page);
      const tag = `${round}회전 ${i}번째 ${op} · 앞 ${JSON.stringify(prev.caret)} → 뒤 ${JSON.stringify(cur.caret)}`;
      expect(cur.atoms, `원자 노드는 늘지 않는다 — ${tag}`).toBeLessThanOrEqual(prev.atoms);
      expect(prev.atoms - cur.atoms, `원자 노드는 한 조작에 많아야 하나 준다 — ${tag}`).toBeLessThanOrEqual(1);
      expect(cur.foreign, `남의 요소 0 — ${tag}`).toBe(0);
      if (op !== 'Backspace' && op !== 'Delete') expect(cur.atoms, `지우는 조작이 아니면 원자 노드 수는 그대로다 — ${tag}`).toBe(prev.atoms);
      if (op === 'Enter') {
        enters++;
        /* 캐럿 뒤에 줄바꿈 말고 아무것도 없을 때만 크롬이 «보이는 줄»용 줄바꿈을 하나 더 둔다(저장 때 꼬리로 털린다) */
        const atEnd = prev.tail.replace(/\n/g, '') === '';
        if (!atEnd) expect(cur.nl - prev.nl, `Enter 는 줄바꿈 정확히 하나 — ${tag}`).toBe(1);
        expect(cur.all.replace(/\n+$/, '').length - prev.all.replace(/\n+$/, '').length, `Enter 뒤 저장 글자는 많아야 한 글자 는다 — ${tag}`).toBeLessThanOrEqual(1);
      }
      if (cur.atoms < prev.atoms) atomDeletes++;
      prev = cur;
    }
    await closeMemo(page);
    expect(await memoOf(page), '닫은 뒤의 저장 글자 = 편집 칸의 글자(꼬리 줄바꿈 뗀 것)').toBe(prev.all.replace(/\n+$/, '') || null);
  }
  expect(ops, '전제: 조작 200회를 다 돌았다').toBe(ROUNDS * PER_ROUND);
  expect(atomDeletes, '전제: 원자 노드를 지우는 갈래를 실제로 지났다').toBeGreaterThan(0);
  expect(enters, '전제: Enter 갈래를 실제로 지났다').toBeGreaterThan(0);
});

/* ══ 1017t1b1 — 체크 완료 줄 글자 구분(취소선·딤) ══════════════════════════ */

test('C10 체크된 줄의 글자는 취소선·딤색이 들고, 미체크 줄은 그대로다', async ({ page }) => {
  await openMemo(page, '[x] 하나\n[ ] 둘');
  await expect(page.locator('.smp-editor .smp-check')).toHaveCount(2);
  const checked = await page.evaluate(() => [...document.querySelectorAll('.smp-editor .smp-check')].map((c) => c.getAttribute('aria-checked')));
  expect(checked, '전제: 첫 줄 체크·둘째 줄 미체크').toEqual(['true', 'false']);
  const dim = await page.evaluate(() => getComputedStyle(document.getElementById('dim-probe')).color);
  expect(dim, '전제: 딤 토큰이 색으로 풀린다').toMatch(/^rgb\(/);
  expect(dim, '전제: 투명이 아니다').not.toBe('rgba(0, 0, 0, 0)');
  const done = await page.evaluate(() => {
    const sp = document.querySelector('.smp-editor span.smp-done');
    if (!sp) return null;
    const cs = getComputedStyle(sp);
    return { line: cs.textDecorationLine, color: cs.color, text: sp.textContent };
  });
  expect(done, '체크된 줄 나머지가 span.smp-done 하나로 싸인다').toEqual({ line: 'line-through', color: dim, text: ' 하나' });
  /* 음성대조(같은 시험 안) — 미체크 줄은 래퍼가 없고 편집 칸 기본 스타일 그대로다 */
  const plain = await page.evaluate(() => {
    const cs = getComputedStyle(document.querySelector('.smp-editor'));
    return { line: cs.textDecorationLine, color: cs.color };
  });
  expect(plain.line, '미체크 줄은 취소선이 없다').toBe('none');
  expect(plain.color, '미체크 줄은 딤색이 아니다').not.toBe(dim);
});

test('C11 체크하면 그 자리에서 취소선이 들고, 닫고 다시 열어도 그대로다', async ({ page }) => {
  await openMemo(page, '[ ] 하나');
  const before = await page.evaluate(() => getComputedStyle(document.querySelector('.smp-editor')).textDecorationLine);
  expect(before, '전제: 고치기 전 — 미체크라 취소선이 없다').toBe('none');
  await page.locator('.smp-editor .smp-check').click();
  await expect.poll(() => page.evaluate(() => {
    const sp = document.querySelector('.smp-editor span.smp-done');
    return sp ? getComputedStyle(sp).textDecorationLine : 'none';
  }), '막 체크한 줄에도 래퍼가 없던 자리에서 취소선이 든다(_wrapDoneRuns)').toBe('line-through');
  await expect.poll(() => memoOf(page), '왕복이 안 깨졌다(기존 C2 와 같은 자리)').toBe('[x] 하나');
  await closeMemo(page);
  await openMemo(page, '[x] 하나');
  const after = await page.evaluate(() => {
    const sp = document.querySelector('.smp-editor span.smp-done');
    return sp ? getComputedStyle(sp).textDecorationLine : 'none';
  });
  expect(after, '닫고 다시 열어도 취소선이 그대로다(렌더 왕복)').toBe('line-through');
});

test('C12 class 없는 남의 span 은 그대로 걷히고, smp-done 래퍼는 안 걷힌다', async ({ page }) => {
  await openMemo(page, '[x] 완료\nabc');
  await expect(page.locator('.smp-editor span.smp-done'), '전제: 체크완료 래퍼가 하나 있다').toHaveCount(1);
  const injected = await page.evaluate(() => {
    const ed = document.querySelector('.smp-editor');
    const sp = document.createElement('span');
    sp.style.color = 'red';
    sp.textContent = 'x';
    ed.appendChild(sp);
    /* .smp-check 도 <span> 이다 — 체크박스까지 세면 전제가 거짓 양성이 된다 */
    return document.querySelectorAll('.smp-editor span:not(.smp-done):not(.smp-check)').length;
  });
  expect(injected, '전제: 심은 직후 그 span 이 하나다(원래 0 이었다와 구분)').toBe(1);
  /* 아무 글자 입력이든 input 이벤트를 흘려 scrubForeign 을 돈다 */
  await page.keyboard.type('!');
  await expect.poll(() => page.evaluate(() => document.querySelectorAll('.smp-editor span:not(.smp-done):not(.smp-check)').length),
    '꾸밈 없는 남의 span 은 걷힌다(글자는 남는다)').toBe(0);
  expect(await page.evaluate(() => document.querySelectorAll('.smp-editor span.smp-done').length),
    'smp-done 래퍼는 같이 안 걷힌다 — 1017t1b1 의 대가를 메우는 자리').toBe(1);
});

test('C13 체크완료 래퍼(span.smp-done)는 저장 글자에 흔적을 안 남긴다', async ({ page }) => {
  const MEMO = '[x] 하나\n[ ] 둘';
  await openMemo(page, MEMO);
  const doneCount = await page.evaluate(() => document.querySelectorAll('.smp-editor span.smp-done').length);
  expect(doneCount, '전제: span.smp-done 이 실재한다').toBeGreaterThanOrEqual(1);
  await closeMemo(page);
  expect(await memoOf(page), '왕복 — 래퍼가 글자를 안 바꾼다(_domToTokens 는 모르는 요소를 투명하게 재귀한다)').toBe(MEMO);

  await openMemo(page, MEMO);
  await page.evaluate(() => {
    const ed = document.querySelector('.smp-editor');
    const r = document.createRange();
    r.setStart(ed, 0);
    r.setEndBefore(ed.querySelector('br'));
    const s = window.getSelection();
    s.removeAllRanges();
    s.addRange(r);
  });
  const copied = await clipEvent(page, 'copy');
  expect(copied.text, '체크된 줄만 복사해도 평문은 그대로다(span 흔적 없음) — rangeAsMemo 도 같은 재귀').toBe('[x] 하나');
});

/* ══ 1017t1b2 — 참고 이미지 크기 상한·확대(⒜ 고정 크기 + 더블클릭 확대) ══════════ */

test('P10 붙인 그림은 고정 상한을 안 넘는다 — 가로·세로 둘 다', async ({ page }) => {
  await armA2(page);
  /* 실제 가로세로 비율을 가진 PNG 를 만들어 armA2 의 고정 스텁(2x2) 대신 서브한다 —
     그래야 .smp-img 의 max-height 가 «진짜 세로로 긴 그림»에서 듣는지를 잰다. */
  const landscape = await page.evaluate(() => {
    const cv = document.createElement('canvas'); cv.width = 2000; cv.height = 1000;
    cv.getContext('2d').fillRect(0, 0, 2000, 1000);
    return cv.toDataURL('image/png').split(',')[1];
  });
  const portrait = await page.evaluate(() => {
    const cv = document.createElement('canvas'); cv.width = 1000; cv.height = 2000;
    cv.getContext('2d').fillRect(0, 0, 1000, 2000);
    return cv.toDataURL('image/png').split(',')[1];
  });
  await page.route('goya-asset://**', (route) => {
    const body = Buffer.from(route.request().url().includes('aaaa') ? landscape : portrait, 'base64');
    return route.fulfill({ contentType: 'image/png', body });
  });
  await openMemo(page, null);
  const editorWidth = await page.evaluate(() => document.querySelector('.smp-editor').getBoundingClientRect().width);
  await pasteFiles(page, [[2000, 1000]]);
  await expect(page.locator('.smp-editor img.smp-img')).toHaveCount(1);
  await page.waitForFunction(() => document.querySelector('.smp-editor img.smp-img').naturalWidth > 0);
  const propsL = await page.evaluate(() => {
    const i = document.querySelector('.smp-editor img.smp-img');
    const cs = getComputedStyle(i);
    const r = i.getBoundingClientRect();
    return { display: cs.display, maxWidth: cs.maxWidth, w: r.width, h: r.height, natW: i.naturalWidth };
  });
  expect({ display: propsL.display, maxWidth: propsL.maxWidth }, 'P1 과 같은 값 — max-height 를 더해도 무회귀').toEqual({ display: 'block', maxWidth: '100%' });
  expect(propsL.natW, '전제: 가로 그림(2000x1000)이 실제로 실렸다').toBe(2000);
  expect(propsL.h, `가로 그림 높이 ${propsL.h}px — 상한 안`).toBeLessThanOrEqual(320);
  expect(propsL.w, '편집 칸 너비를 안 넘는다').toBeLessThanOrEqual(editorWidth + 1);

  await closeMemo(page);
  await openMemo(page, null);
  await pasteFiles(page, [[1000, 2000]]);
  await expect(page.locator('.smp-editor img.smp-img')).toHaveCount(1);
  await page.waitForFunction(() => document.querySelector('.smp-editor img.smp-img').naturalWidth > 0);
  const propsP = await page.evaluate(() => {
    const i = document.querySelector('.smp-editor img.smp-img');
    const r = i.getBoundingClientRect();
    return { w: r.width, h: r.height, natW: i.naturalWidth };
  });
  expect(propsP.natW, '전제: 세로 그림(1000x2000)이 실제로 실렸다').toBe(1000);
  expect(propsP.h, `세로 그림 높이 ${propsP.h}px — 상한 안(현빈이 본 그 증상)`).toBeLessThanOrEqual(320);
  expect(propsP.w, '편집 칸 너비를 안 넘는다').toBeLessThanOrEqual(editorWidth + 1);
});

test('P11a 그림을 더블클릭하면 같은 주소의 그림이 확대되어 뜨고, 바깥 클릭·Esc 로 닫힌다', async ({ page }) => {
  await armA2(page);
  await openMemo(page, `가![](${A2_URLS[0]})나`);
  const img = page.locator('.smp-editor img.smp-img');
  await page.waitForFunction(() => document.querySelector('.smp-editor img.smp-img').naturalWidth > 0);
  expect(await page.evaluate(() => document.querySelectorAll('.smp-img-zoom-backdrop').length), '전제: 아직 확대는 없다').toBe(0);
  await img.dblclick();
  await page.waitForSelector('.smp-img-zoom-backdrop.open');
  await expect(page.locator('.smp-img-zoom-backdrop')).toHaveCount(1);
  const src = await page.evaluate(() => document.querySelector('.smp-img-zoom-backdrop img').getAttribute('src'));
  expect(src, '확대 그림은 같은 goya-asset 주소다').toBe(A2_URLS[0]);
  /* 바깥(backdrop) 클릭으로 닫힌다 — 실제 그림(스텁 2x2)은 작아서 (5,5) 는 반드시 바깥이다 */
  await page.locator('.smp-img-zoom-backdrop').click({ position: { x: 5, y: 5 } });
  await expect(page.locator('.smp-img-zoom-backdrop')).toHaveCount(0);
  /* 다시 열고 Esc 로도 닫힌다 */
  await img.dblclick();
  await page.waitForSelector('.smp-img-zoom-backdrop.open');
  await page.keyboard.press('Escape');
  await expect(page.locator('.smp-img-zoom-backdrop')).toHaveCount(0);
});

test('P11b 확대가 열린 동안 Esc 는 메모 팝오버를 안 닫고 전역으로도 안 새며, 홑클릭은 여전히 그림을 선택한다', async ({ page }) => {
  await armA2(page);
  await openMemo(page, `가![](${A2_URLS[0]})나`);
  const img = page.locator('.smp-editor img.smp-img');
  await page.waitForFunction(() => document.querySelector('.smp-editor img.smp-img').naturalWidth > 0);

  /* 회귀방지 — 홑클릭은 여전히 그림을 선택한다(P6 과 같은 식) */
  await img.click();
  expect(await page.evaluate(() => {
    const s = window.getSelection();
    const r = s.rangeCount ? s.getRangeAt(0) : null;
    const im = document.querySelector('.smp-editor img.smp-img');
    return !!r && !r.collapsed && r.cloneContents().querySelector('img') !== null && r.toString() === '' && r.intersectsNode(im);
  }), '홑클릭은 선택이 그대로다(확대를 달면서 안 깼다)').toBe(true);
  expect(await page.evaluate(() => document.querySelectorAll('.smp-img-zoom-backdrop').length), '홑클릭은 확대를 안 연다').toBe(0);

  /* js/editor.js 의 전역 keydown 과 같은 자리(document·bubble)에 세는 자를 둔다(D3 의 꼴) —
     이 하네스엔 editor.js 가 없어 이 자가 «새는가」를 직접 잰다. */
  await page.evaluate(() => {
    window.__escBubbled = 0;
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') window.__escBubbled++; });
  });
  await img.dblclick();
  await page.waitForSelector('.smp-img-zoom-backdrop.open');
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => document.querySelectorAll('.smp-img-zoom-backdrop').length), 'Esc 는 확대부터 닫는다').toBe(0);
  expect(await page.locator('.section-memo-popover').count(), 'Esc 가 모달까지 새면 메모가 날아간다 — 안 닫혔다').toBe(1);
  expect(await page.evaluate(() => window.__escBubbled), 'Esc 는 document·bubble 까지 안 샌다(stopPropagation)').toBe(0);
});
