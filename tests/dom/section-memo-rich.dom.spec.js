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

/* sizes = [[w,h],…] 그림 파일을 그 수만큼 만들어 한 번에 붙인다. extra = { html, text, bytes(그 크기의 가짜 파일) } */
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
    if (extra && extra.bytes) dt.items.add(new File([new Uint8Array(extra.bytes)], 'big.png', { type: 'image/png' }));
    if (extra && extra.html) dt.setData('text/html', extra.html);
    if (extra && extra.text) dt.setData('text/plain', extra.text);
    const ev = new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true });
    const files = [...ev.clipboardData.items].filter((it) => it.kind === 'file');
    const pre = { files: files.length, imageTypes: files.filter((it) => it.type.startsWith('image/')).length, types: [...ev.clipboardData.types] };
    document.querySelector('.smp-editor').dispatchEvent(ev);
    return { ...pre, prevented: ev.defaultPrevented };
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
  await expect.poll(() => page.evaluate(() => window.__toasts.length)).toBe(1);
  expect(await page.evaluate(() => ({ imgs: document.querySelectorAll('.smp-editor img').length, ipc: window.__ipc.length }))).toEqual({ imgs: 0, ipc: 0 });
  expect(await memoOf(page)).toBe(null);
});
