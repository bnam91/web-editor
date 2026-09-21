/* banner-placeholder-export-strip.dom.spec.js — «배너 안내문구»가 내보내기 결과물에 박히는 자리.
 *   (2026-09-20 사용자 관점 훑기 → 유닛 exportvisual)
 *
 * ★재현(고치기 전, 실측 2026-09-21 · 실앱 9525 · 860×1399 export PNG):
 *   모달 안내문구는 «빠지는데» 배너의 「라벨입니다./제목을 입력합니다./캡션이 입력됩니다.」는
 *   그대로 찍혔다(배너 글자영역 320×120 안에 검정 2,203px).
 *   스크린샷: $SP/h0920b/ulexp-BEFORE-AB-export.png
 *
 * ★뿌리 — 모달·텍스트 블록은 data-is-placeholder="true" + data-placeholder 를 달고,
 *   js/io/capture-safety.js stripEditorOnlyForCapture 가 그 속성을 보고 visibility:hidden 한다.
 *   banner02-block.js 의 _defaultLines 만 «진짜 텍스트값»만 넣고 표시가 한 글자도 없었다
 *   ⇒ 같은 그물에 «배너만» 안 걸렸다. 고침 = export 코드가 아니라 «표시»를 붙이는 쪽.
 *
 * 여기서 재는 것:
 *   N0 ★음성대조 — 표시를 뗀 옛 꼴이면 걷은 뒤에도 안내문구가 그대로 보인다.
 *   T1 기본 배너 세 줄에 표시가 붙는다(모달과 «같은» 속성 한 쌍).
 *   T2 걷은 클론에서 세 줄이 visibility:hidden — 글자는 안 지운다(높이 보존).
 *   T3 ★글자를 쓰면 표시가 떨어진다 = 본문은 «안» 숨겨진다(과잉 삭제 방지).
 *   T4 옛 저장본 호환 — placeholder 키가 없는 dataset.lines 는 본문으로 읽힌다(열기만 해도 글자가 사라지면 안 된다).
 *   T5 편집 화면 dim 은 #canvas 스코프라 export 클론(body)엔 «안» 샌다.
 *
 * ⛔앱을 «안» 띄운다 — index.html + 레포 파일만 크로미움에 얹는다.
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js banner-placeholder-export-strip
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
               '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml' };

const HARNESS = (() => {
  let h = fs.readFileSync(path.join(REPO, 'index.html'), 'utf8');
  h = h.replace(/<script\b[\s\S]*?<\/script>/gi, '');
  return h.replace('</body>', `<script type="module">
  import '/js/blocks/banner02-block.js';
  import { stripEditorOnlyForCapture } from '/js/io/capture-safety.js';
  import { renderComponentsInClone } from '/js/io/export-image.js';
  window.__strip = stripEditorOnlyForCapture;
  window.__render2 = renderComponentsInClone;
  window.__ready = true;
</script></body>`);
})();

async function boot(page) {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/__harness.html') return route.fulfill({ contentType: 'text/html', body: HARNESS });
    const file = path.join(REPO, decodeURIComponent(url.pathname));
    if (!file.startsWith(REPO) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      return route.fulfill({ status: 404, body: '' });
    }
    return route.fulfill({ contentType: MIME[path.extname(file)] || 'text/plain', body: fs.readFileSync(file) });
  });
  await page.goto(`${ORIGIN}/__harness.html`);
  await page.waitForFunction(() => window.__ready === true);
  return errs;
}

/* @param mode 'new' = 지금 코드 · 'old' = 표시를 떼서 고치기 «전» 꼴로 되돌린다(음성대조)
   @param typed 사람이 두 번째 줄에 실제로 친 글자(없으면 기본문구 그대로) */
const probe = (page, mode, typed) => page.evaluate(({ mode, typed }) => {
  const host = document.querySelector('#canvas') || document.body;
  host.innerHTML = '';
  const sec = document.createElement('div');
  sec.className = 'section-block'; sec.id = 'sec1';
  host.appendChild(sec);

  const { row, block } = window.makeBanner02Block({});
  block.id = 'bn';
  sec.appendChild(row);
  window.renderBanner02(block);

  if (typed) {
    // 캔버스 편집과 «같은 경로»로 커밋한다 — blur 핸들러가 표시를 떼는지까지 본다.
    const el = block.querySelector('[data-line-idx="1"]');
    el.setAttribute('contenteditable', 'true');
    el.textContent = typed;
    el.dispatchEvent(new FocusEvent('blur'));
    window.renderBanner02(block);
  }

  const before = [...block.querySelectorAll('.bn2-text > *')].map(el => ({
    text: el.textContent,
    ph: el.dataset.isPlaceholder || '',
    phAttr: el.dataset.placeholder || '',
    dim: window.getComputedStyle(el).opacity,
  }));

  const clone = sec.cloneNode(true);
  if (mode === 'old') {
    clone.querySelectorAll('[data-is-placeholder]').forEach(el => {
      el.removeAttribute('data-is-placeholder'); el.removeAttribute('data-placeholder');
    });
  }
  clone.style.cssText += ';position:fixed;top:-99999px;left:0;width:860px;';
  document.body.appendChild(clone);
  window.__strip(clone);
  clone.getBoundingClientRect();

  const after = [...clone.querySelectorAll('.bn2-text > *')].map(el => ({
    text: el.textContent,
    vis: window.getComputedStyle(el).visibility,
    opacity: window.getComputedStyle(el).opacity,
    h: Math.round(el.getBoundingClientRect().height),
  }));
  const lines = JSON.parse(block.dataset.lines || '[]');
  clone.remove();
  return { before, after, lines };
}, { mode, typed });

test('N0 ★음성대조 — 표시를 뗀 «고치기 전» 꼴이면 안내문구가 그대로 보인다', async ({ page }) => {
  const errs = await boot(page);
  const r = await probe(page, 'old', null);
  console.log('  N0 after:', r.after);
  expect(r.after.map(x => x.vis), '★여기서 hidden 이 나오면 T2 는 아무것도 증명하지 못한다')
    .toEqual(['visible', 'visible', 'visible']);
  expect(r.after.map(x => x.text)).toEqual(['라벨입니다.', '제목을 입력합니다.', '캡션이 입력됩니다.']);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('T1 기본 배너 세 줄에 «안내문구» 표시가 붙는다(모달과 같은 속성 한 쌍)', async ({ page }) => {
  const errs = await boot(page);
  const r = await probe(page, 'new', null);
  console.log('  T1 before:', r.before);
  expect(r.before.map(x => x.ph)).toEqual(['true', 'true', 'true']);
  expect(r.before.map(x => x.phAttr))
    .toEqual(['라벨입니다.', '제목을 입력합니다.', '캡션이 입력됩니다.']);
  expect(r.lines.every(l => l.placeholder === true), 'dataset.lines 에도 표시가 있어야 저장·재열기에서 산다').toBe(true);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('T2 걷은 클론에서 안내문구가 «숨겨진다» — 글자는 안 지운다(높이 보존)', async ({ page }) => {
  const errs = await boot(page);
  const r = await probe(page, 'new', null);
  console.log('  T2 after:', r.after);
  expect(r.after.map(x => x.vis)).toEqual(['hidden', 'hidden', 'hidden']);
  expect(r.after.map(x => x.text), '글자를 «지우면» 박스 높이가 무너져 배너 레이아웃이 달라진다')
    .toEqual(['라벨입니다.', '제목을 입력합니다.', '캡션이 입력됩니다.']);
  expect(r.after.every(x => x.h > 0), '숨기되 자리는 남아야 한다').toBe(true);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('T3 ★글자를 쓰면 표시가 떨어진다 — 본문은 안 숨겨진다(과잉 삭제 방지)', async ({ page }) => {
  const errs = await boot(page);
  const r = await probe(page, 'new', '강아지 간식');
  console.log('  T3 after:', r.after);
  expect(r.lines[1].placeholder, '글자를 썼는데 표시가 남으면 «쓴 글»이 내보내기에서 사라진다').toBeUndefined();
  expect(r.after[1].text).toBe('강아지 간식');
  expect(r.after[1].vis).toBe('visible');
  // 안 건드린 두 줄은 여전히 안내문구다
  expect([r.after[0].vis, r.after[2].vis]).toEqual(['hidden', 'hidden']);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('T4 옛 저장본 호환 — placeholder 키가 없는 lines 는 «본문»으로 읽힌다', async ({ page }) => {
  const errs = await boot(page);
  const r = await page.evaluate(() => {
    const host = document.querySelector('#canvas') || document.body;
    host.innerHTML = '';
    const sec = document.createElement('div'); sec.className = 'section-block'; host.appendChild(sec);
    const { row, block } = window.makeBanner02Block({});
    sec.appendChild(row);
    // 옛 저장본: placeholder 키가 «없다»
    block.dataset.lines = JSON.stringify([
      { kind: 'label', text: '라벨입니다.', size: 24, color: '#000000', gapTop: 0 },
      { kind: 'title', text: '진짜 제목',   size: 42, color: '#000000', gapTop: 5 },
    ]);
    window.renderBanner02(block);
    const clone = sec.cloneNode(true);
    clone.style.cssText += ';position:fixed;top:-99999px;left:0;width:860px;';
    document.body.appendChild(clone);
    window.__strip(clone);
    const out = [...clone.querySelectorAll('.bn2-text > *')].map(el => ({
      text: el.textContent, vis: window.getComputedStyle(el).visibility,
    }));
    clone.remove();
    return out;
  });
  console.log('  T4:', r);
  expect(r.map(x => x.vis), '★열기만 해도 기존 배너 글자가 사라지는 것이 제일 비싼 회귀다')
    .toEqual(['visible', 'visible']);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('T5 편집 화면 dim(#canvas 스코프)은 export 클론(body)으로 안 샌다', async ({ page }) => {
  const errs = await boot(page);
  const r = await probe(page, 'new', null);
  expect(r.before.map(x => x.dim), '캔버스 안에서는 안내문구가 흐리게 보인다(기존 컨벤션)')
    .toEqual(['0.45', '0.45', '0.45']);
  expect(r.after.map(x => x.opacity), 'body 에 붙은 클론까지 흐려지면 «본문»도 흐려질 위험이 있다')
    .toEqual(['1', '1', '1']);
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* ══════════════════════════════════════════════════════════════════════════
   ★타이밍 — ①걷기 «뒤»에 ②컴포넌트 재렌더가 DOM 을 다시 만든다.
   실측(2026-09-21, 실앱 9525): 표시를 붙인 «뒤»에도 export PNG 에 안내문구가 그대로 나왔다.
   표시는 맞았고 «걸린 자리가 재렌더에 지워지는» 것이 문제였다.
   ══════════════════════════════════════════════════════════════════════════ */
const probe2 = (page, mode) => page.evaluate((mode) => {
  const host = document.querySelector('#canvas') || document.body;
  host.innerHTML = '';
  const sec = document.createElement('div'); sec.className = 'section-block'; host.appendChild(sec);
  const { row, block } = window.makeBanner02Block({});
  sec.appendChild(row);
  window.renderBanner02(block);

  const clone = sec.cloneNode(true);
  clone.style.cssText += ';position:fixed;top:-99999px;left:0;width:860px;';
  document.body.appendChild(clone);
  window.__strip(clone);                              // ① 편집 chrome 걷기
  if (mode === 'old') {
    // 고치기 «전» 꼴 — ② 재렌더만 돌고 안내문구 재숨김이 없다
    clone.querySelectorAll('.banner02-block').forEach(b => window.renderBanner02(b));
  } else {
    window.__render2(clone);                          // ② 공용 재렌더(안에서 다시 숨긴다)
  }
  const out = [...clone.querySelectorAll('.bn2-text > *')].map(el => ({
    text: el.textContent, vis: window.getComputedStyle(el).visibility,
  }));
  clone.remove();
  return out;
}, mode);

test('N1 ★음성대조 — ②재렌더가 ①의 숨김을 지운다(고치기 전 꼴에서 실제로 되살아난다)', async ({ page }) => {
  const errs = await boot(page);
  const r = await probe2(page, 'old');
  console.log('  N1:', r);
  expect(r.map(x => x.vis), '★여기서 hidden 이 나오면 T6 은 아무것도 증명하지 못한다')
    .toEqual(['visible', 'visible', 'visible']);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('T6 ①걷기 → ②재렌더 뒤에도 안내문구는 숨겨져 있다(실제 export 순서)', async ({ page }) => {
  const errs = await boot(page);
  const r = await probe2(page, 'new');
  console.log('  T6:', r);
  expect(r.map(x => x.vis)).toEqual(['hidden', 'hidden', 'hidden']);
  expect(errs, errs.join(' | ')).toEqual([]);
});
