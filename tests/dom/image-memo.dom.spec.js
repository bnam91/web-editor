/* image-memo.dom.spec.js — 이미지 메모 · 「준비할 이미지」 · 템플릿 트리 폴더 (2026-09-30, 현빈 요청 3건)
 *
 * ★양성대조의 판 = 착수 «직전» origin/dev **4a66f8c1** (⛔HEAD 아님 — 고친 뒤엔 HEAD 가 곧 고친 판이다).
 *   그 판에 이 파일만 얹어 돌리면 «빨강이어야 하는» 시험(이름으로):
 *     M1 쪽지 되돌아옴 · M2 캡처 클론에서 메모가 빠진다 · M3 편집 한 번 = 히스토리 한 번 ·
 *     M4 그 자리 입력 · M5 준비할 이미지 — 수·줄·두 갈래 · M6 섹션 안 골랐으면 절이 없다 ·
 *     M7 줄을 누르면 그 블럭으로 · F1 빈 폴더가 다시 그려도 남는다 · F2 우클릭 새 폴더 ·
 *     F3 이름 바꾸기·지우기 규칙
 *   (4a66f8c1 에는 js/image-memo.js 도, 폴더 명부도 없다 — 전부 빨강이어야 계측기가 뭔가를 잰 것이다.)
 *   실측 결과는 커밋 메시지와 지디 보고에 «어느 시험이 빨강이었나» 명부로 적는다.
 *
 * ⛔앱을 «안» 띄운다 — index.html(스크립트 제거) + 레포 파일만 크로미움에 얹는다.
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js image-memo
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
  window.__hist = [];
  window.pushHistory = (label) => window.__hist.push(label || '');
  window.__toasts = [];
  window.showToast = (m) => window.__toasts.push(String(m));
  window.__selected = [];
  window.selectBlock = (id) => window.__selected.push(id);
  /* ★하나가 못 실려도 부팅은 끝낸다 — 그래야 양성대조(4a66f8c1, image-memo.js 없음)에서
     «부팅 실패로 전멸»이 아니라 «시험마다 제 단언에서» 빨개진다. 무엇이 못 실렸나는 __bootErr. */
  window.__bootErr = [];
  const imp = (p) => import(p).catch(e => { window.__bootErr.push(p + ': ' + e); return {}; });
  const M = await imp('/js/image-memo.js');
  const C = await imp('/js/io/capture-safety.js');
  await imp('/js/inspector.js');
  await imp('/js/panels/template-system.js');
  await imp('/js/panels/template-browser.js');
  window.__M = M;
  window.__strip = C.stripEditorOnlyForCapture;
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
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 15000 });
  return errs;
}

/* 섹션 하나: 빈 에셋(메모) · 빈 에셋(메모 없음) · 이미지 든 에셋(메모) · 그리드 빈 슬롯 */
const seed = (page) => page.evaluate(() => {
  const host = document.getElementById('canvas');
  host.innerHTML = `
    <div class="section-block" id="sec1">
      <div class="section-inner">
        <div class="asset-block" id="abMemo" data-memo="모델컷 — 상반신, 정면" style="height:300px"></div>
        <div class="asset-block" id="abBare" style="height:300px"></div>
        <div class="asset-block has-image" id="abImg" data-memo="숨은 메모" style="height:300px"></div>
        <div class="grid-block" id="grd1"><div class="grd-img-empty" data-line="0" style="height:120px"></div></div>
      </div>
    </div>`;
  window.getSelectedSection = () => document.getElementById('sec1');
});

const beforeContent = (page, id) => page.evaluate(
  (id) => getComputedStyle(document.getElementById(id), '::before').content, id);

test('M1 쪽지 되돌아옴 — 메모 → 이미지 넣기(숨음) → 이미지 비우기 → 같은 글자로 다시', async ({ page }) => {
  const errs = await boot(page);
  expect(await page.evaluate(() => window.__bootErr), '모듈이 못 실렸다').toEqual([]);
  await seed(page);
  expect(await beforeContent(page, 'abMemo')).toBe('"모델컷 — 상반신, 정면"');
  expect(await beforeContent(page, 'abBare'), '메모 없는 칸엔 쪽지가 없다').toBe('none');
  await page.evaluate(() => document.getElementById('abMemo').classList.add('has-image'));
  expect(await beforeContent(page, 'abMemo'), '이미지가 들어오면 «그냥 숨는다»').toBe('none');
  expect(await page.evaluate(() => document.getElementById('abMemo').getAttribute('data-memo')),
    '★값은 남는다').toBe('모델컷 — 상반신, 정면');
  await page.evaluate(() => document.getElementById('abMemo').classList.remove('has-image'));
  expect(await beforeContent(page, 'abMemo'), '★이미지를 비우면 같은 글자로 다시').toBe('"모델컷 — 상반신, 정면"');
  // 쪽지는 칸을 넘지 않는다
  const fits = await page.evaluate(() => {
    const el = document.getElementById('abMemo');
    el.setAttribute('data-memo', '아주 긴 메모 '.repeat(80));
    el.style.height = '60px'; el.style.width = '90px';
    const cs = getComputedStyle(el, '::before');
    return { mw: cs.maxWidth, mh: cs.maxHeight, ov: cs.overflow };
  });
  expect(fits.ov).toBe('hidden');
  expect(fits.mw).toMatch(/calc|px/);
  // #canvas 밖(캡처 클론이 붙는 body)에서는 안 그려진다
  const outside = await page.evaluate(() => {
    const d = document.createElement('div');
    d.className = 'asset-block'; d.setAttribute('data-memo', 'x');
    document.body.appendChild(d);
    const c = getComputedStyle(d, '::before').content; d.remove(); return c;
  });
  expect(outside).toBe('none');
  expect(errs).toEqual([]);
});

test('M2 캡처 클론에서 메모가 빠진다 — 라이브는 그대로', async ({ page }) => {
  await boot(page);
  await seed(page);
  const r = await page.evaluate(() => {
    const live = document.getElementById('sec1');
    const clone = live.cloneNode(true);
    window.__strip(clone);
    const selfClone = document.getElementById('abMemo').cloneNode(true);
    window.__strip(selfClone);
    return {
      clone: clone.querySelectorAll('[data-memo]').length,
      self: selfClone.hasAttribute('data-memo'),
      live: live.querySelectorAll('[data-memo]').length,
    };
  });
  expect(r.clone, '★PNG·HTML·썸네일 클론에 메모가 남았다').toBe(0);
  expect(r.self, '클론 «자신»에 붙은 메모도 뗀다').toBe(false);
  expect(r.live, '라이브(=저장 대상)는 안 건드린다').toBe(2);
});

test('M3 편집 한 번 = 히스토리 한 번(push-after) · 빈 값은 속성째 뗀다', async ({ page }) => {
  await boot(page);
  await seed(page);
  const r = await page.evaluate(() => {
    const M = window.__M, ab = document.getElementById('abBare');
    const out = {};
    out.first = M.setImageMemo(ab, '  성분표 — 흰 배경  ');
    out.val = ab.getAttribute('data-memo');
    out.same = M.setImageMemo(ab, '성분표 — 흰 배경');
    out.cleared = M.setImageMemo(ab, '   ');
    out.hasAttr = ab.hasAttribute('data-memo');
    out.nonHost = M.setImageMemo(document.getElementById('grd1'), 'x');
    out.hist = window.__hist.slice();
    return out;
  });
  expect(r.first).toBe(true);
  expect(r.val, '앞뒤 공백은 턴다').toBe('성분표 — 흰 배경');
  expect(r.same, '같은 값이면 아무 일도 없다').toBe(false);
  expect(r.cleared).toBe(true);
  expect(r.hasAttr, '빈 값 = 속성을 뗀다(빈 속성을 남기지 않는다)').toBe(false);
  expect(r.nonHost, '⛔그리드엔 메모를 못 적는다(이번 범위 밖)').toBe(false);
  expect(r.hist, '★바뀐 두 번만 찍는다').toEqual(['이미지 메모', '이미지 메모']);
});

test('M4 그 자리 입력 — Enter 저장 · ⇧Enter 줄바꿈 · Esc 취소 · 블럭 안에 안 넣는다', async ({ page }) => {
  await boot(page);
  await seed(page);
  await page.evaluate(() => window.__M.openImageMemoEditor(document.getElementById('abBare')));
  const box = page.locator('.img-memo-editor');
  await expect(box).toHaveCount(1);
  expect(await page.evaluate(() => !!document.querySelector('#canvas .img-memo-editor, #canvas textarea')),
    '⛔입력칸이 캔버스 안에 있으면 자동저장이 찍는다').toBe(false);
  await page.keyboard.type('누끼컷');
  await page.keyboard.press('Shift+Enter');
  await page.keyboard.type('흰 배경');
  await page.keyboard.press('Enter');
  await expect(box).toHaveCount(0);
  expect(await page.evaluate(() => document.getElementById('abBare').getAttribute('data-memo'))).toBe('누끼컷\n흰 배경');

  await page.evaluate(() => window.__M.openImageMemoEditor(document.getElementById('abBare')));
  expect(await page.locator('.img-memo-editor textarea').inputValue(), '고칠 땐 지금 값이 들어 있다').toBe('누끼컷\n흰 배경');
  await page.keyboard.type(' 바꿈');
  await page.keyboard.press('Escape');
  await expect(page.locator('.img-memo-editor')).toHaveCount(0);
  expect(await page.evaluate(() => document.getElementById('abBare').getAttribute('data-memo')), 'Esc = 취소').toBe('누끼컷\n흰 배경');
  expect(await page.evaluate(() => window.__hist.length), 'Esc 는 히스토리를 안 찍는다').toBe(1);
});

const prep = (page) => page.evaluate(() => {
  window.renderInspectorPanel();
  const sec = document.querySelector('#inspector-stats-body .insp-prep');
  if (!sec) return null;
  return {
    count: sec.querySelector('[data-prep-count]')?.textContent,
    rows: [...sec.querySelectorAll('.insp-prep-row')].map(r => ({
      kind: r.dataset.prepKind, text: r.querySelector('.insp-prep-text').textContent,
      cls: r.className })),
  };
});

test('M5 준비할 이미지 — 수 = 줄 수 · 이미지 든 칸은 안 센다 · 「메모 없음」과 「그리드 칸」을 가른다', async ({ page }) => {
  await boot(page);
  await seed(page);
  const r = await prep(page);
  expect(r, '섹션을 골랐는데 절이 없다').not.toBeNull();
  expect(r.rows.map(x => x.text)).toEqual(['모델컷 — 상반신, 정면', '메모 없음', '그리드 칸 — 메모는 아직']);
  expect(r.rows.map(x => x.kind)).toEqual(['asset', 'asset', 'grid']);
  expect(Number(r.count), '★숫자와 줄 수가 늘 같아야 한다').toBe(r.rows.length);
  expect(r.rows[1].cls).toContain('is-empty');
  expect(r.rows[2].cls, '⛔「적을 수 없는 것」을 「메모 없음」과 합치지 마라').toContain('is-grid');
  // 숨은 시안 안은 세지도 가지도 않는다
  const r2 = await page.evaluate(() => {
    document.getElementById('sec1').setAttribute('data-variation-active', '0');
    window.renderInspectorPanel();
    return !!document.querySelector('#inspector-stats-body .insp-prep');
  });
  expect(r2, '숨은 시안 섹션이면 절이 안 뜬다').toBe(false);
});

test('M6 섹션을 안 골랐으면 절이 없다 · 고르면 따라온다(관찰자)', async ({ page }) => {
  await boot(page);
  await seed(page);
  await page.evaluate(() => { window.getSelectedSection = () => null; });
  expect(await prep(page)).toBeNull();
  // 인스펙터 탭이 열려 있으면 선택·메모 변화를 스스로 따라간다
  await page.evaluate(() => {
    document.querySelector('.panel-tab[data-tab="inspector"]')?.classList.add('active');
    window.getSelectedSection = () => document.querySelector('.section-block.selected');
    document.getElementById('sec1').classList.add('selected');
  });
  await expect.poll(() => page.evaluate(() =>
    document.querySelector('#inspector-stats-body .insp-prep [data-prep-count]')?.textContent)).toBe('3');
  await page.evaluate(() => document.getElementById('abBare').setAttribute('data-memo', '새 메모'));
  await expect.poll(() => page.evaluate(() =>
    [...document.querySelectorAll('#inspector-stats-body .insp-prep-text')].map(e => e.textContent)[1])).toBe('새 메모');
});

test('M7 줄을 누르면 그 블럭으로 — 기존 점프 길(selectBlock · 그리드는 그 그리드 블럭)', async ({ page }) => {
  await boot(page);
  await seed(page);
  await prep(page);
  await page.evaluate(() => {
    const rows = document.querySelectorAll('#inspector-stats-body .insp-prep-row');
    rows[1].click(); rows[2].click();
  });
  expect(await page.evaluate(() => window.__selected)).toEqual(['abBare', 'grd1']);
});

/* ── ③ 템플릿 트리 폴더 ── */
const seedTpl = (page) => page.evaluate(() => {
  localStorage.removeItem('tpl-folders');
  window.saveTemplatesPublic([
    { id: 't1', name: '내것', folder: 'F1', category: 'Hero' },
    { id: 's1', name: '공용', folder: '공용F', category: 'Hero', _scope: 'shared' },
  ]);
  window._renderBrowserTree();
});
const treeFolders = (page) => page.evaluate(() =>
  [...document.querySelectorAll('#tpl-browser-tree .tb-tree-folder-header')].map(h => h.dataset.folder));

test('F1 빈 폴더가 다시 그려도 남는다 — 목록은 한 곳(listTemplateFolders)', async ({ page }) => {
  await boot(page);
  await seedTpl(page);
  const r = await page.evaluate(() => ({
    a: window.createTemplateFolder('빈폴더'),
    dup: window.createTemplateFolder('빈폴더'),
    res: window.createTemplateFolder('전체'),
    blank: window.createTemplateFolder('  '),
    list: window.listTemplateFolders(),
  }));
  expect(r.a.ok).toBe(true);
  expect(r.dup.ok).toBe(false);
  expect(r.res.ok, '「전체」는 트리 항목 이름이라 못 쓴다').toBe(false);
  expect(r.blank.ok).toBe(false);
  expect(r.list).toEqual(['F1', '공용F', '빈폴더']);
  await page.evaluate(() => { window._renderBrowserTree(); window._renderBrowserTree(); });
  expect(await treeFolders(page), '★빈 폴더가 다음 렌더에 사라졌다').toEqual(['F1', '공용F', '빈폴더']);
  expect(await page.evaluate(() =>
    document.querySelector('#tpl-browser-tree .tb-tree-folder-header[data-folder="빈폴더"] .tb-tree-count').textContent)).toBe('0');
});

test('F2 우클릭 「새 폴더」 — 그 자리 입력 · Enter 확정 · 폴더 위에선 바꾸기·지우기도', async ({ page }) => {
  await boot(page);
  await seedTpl(page);
  await page.locator('#tpl-browser').evaluate(el => { el.style.display = 'flex'; });
  const menuTexts = () => page.evaluate(() =>
    [...document.querySelectorAll('#tb-tree-ctx [data-tree-act]')].map(e => e.textContent));
  await page.evaluate(() => document.getElementById('tpl-browser-tree')
    .dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 40, clientY: 40 })));
  expect(await menuTexts()).toEqual(['새 폴더']);
  await page.locator('#tb-tree-ctx [data-tree-act="new"]').click();
  await expect(page.locator('#tpl-browser-tree .tb-tree-input')).toHaveCount(1);
  await page.keyboard.type('UI폴더');
  await page.keyboard.press('Enter');
  expect(await treeFolders(page)).toContain('UI폴더');
  await page.evaluate(() => document.querySelector('#tpl-browser-tree .tb-tree-folder-header[data-folder="F1"]')
    .dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 40, clientY: 40 })));
  expect(await menuTexts()).toEqual(['새 폴더', '이름 바꾸기', '폴더 지우기']);
});

test('F3 이름 바꾸기·지우기 — 빈 폴더만 지운다 · 공용이 든 폴더는 못 바꾼다 · 공용 folder 는 안 바뀐다', async ({ page }) => {
  await boot(page);
  await seedTpl(page);
  const r = await page.evaluate(() => {
    const out = {};
    out.ren = window.renameTemplateFolder('F1', 'F2');
    out.t1 = window.loadTemplatesPublic().find(t => t.id === 't1').folder;
    out.renShared = window.renameTemplateFolder('공용F', '바꿈');
    out.s1 = window.loadTemplatesPublic().find(t => t.id === 's1').folder;
    out.delFull = window.deleteTemplateFolder('F2');
    window.createTemplateFolder('빈폴더');
    out.delEmpty = window.deleteTemplateFolder('빈폴더');
    out.list = window.listTemplateFolders();
    return out;
  });
  expect(r.ren.ok).toBe(true);
  expect(r.t1, '개인 템플릿은 새 이름으로 따라간다').toBe('F2');
  expect(r.renShared.ok, '공용이 든 폴더는 못 바꾼다').toBe(false);
  expect(r.renShared.reason).toContain('공용');
  expect(r.s1, '⛔공용 템플릿의 folder 는 절대 안 바뀐다').toBe('공용F');
  expect(r.delFull.ok, '템플릿이 남은 폴더는 못 지운다').toBe(false);
  expect(r.delFull.reason).toContain('1개');
  expect(r.delEmpty.ok).toBe(true);
  expect(r.list).toEqual(['F2', '공용F']);
});
