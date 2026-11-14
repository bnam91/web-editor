/* cert-block.dom.spec.js — A4 용지 스택(cert-block · 보이는 이름 «Documents» — 현빈 261114) (A · 현빈 261114 reframe «A4 용지들을 배치»)
 *   K1 진짜 메뉴(컴포넌트 ▾ → «Documents») → 고른 섹션에 블럭 · 세로 A4 4장(그려진 세로/가로 ≈ 1.414) · 빈 칸 = 체크무늬 ·
 *      콜아웃·지시선 0(기본 끔) · 말림 0(기본 끔) · 위 제목 0(비움) · 원형 마크·낙관·그리드·액자 0 · 층 이름 «Documents»
 *   K2 부채 스택(기본) — 왼→오 회전각이 커진다(atan2) · 이웃끼리 겹친다(화면 사각형)
 *   K3 끌어 놓기 — 용지 칸에 그림 파일을 drop → 그 칸이 img(data:image/png) · 다른 칸은 체크무늬 그대로
 *   K4 더블클릭 = 파일창(진짜 filechooser) → 그 칸 img
 *   K5 패널에 용지 카드 0(현빈 261114 ⑥ «용지별 카드 전부 제거» · 그림은 캔버스로만 — K3 끌어 놓기·K4 더블클릭·S1 스크래치가 그 길을 잰다)
 *      ⚠️카드와 함께 잃은 길(다른 입구 없음 · 실측): «그림 빼기» · 지시선 글의 용지별 제목·설명·상태 편집 — 대안은 현빈 답 뒤(K5 는 그래서 «없음»을 잠근다)
 *   K6 «지시선 글» 켬 → 콜아웃·지시선 4 · 상태 «출원»(dataset — 패널 카드가 없어져 입구는 현빈 답 뒤) → 칩
 *   K7 → E1 로 옮김(말림은 «이펙트» 절 · 용지마다)
 *   K8 [보안] 손댄 dataset — 글은 글자로 · 이상한 그림 주소는 빈 칸 · 핸들러 0(콜아웃 켬)
 *   K9 저장→열기 왕복(applyProjectData) — dataset 에서 다시 그린다
 *   K10 장 수 6 · K11 장 수 8(⑨ 상한 6 → 8) — 둘 다 스택 명시(⑩ 기본이 격자)
 *   ⑩ 새 블럭 기본 = 격자 — 스택을 재는 칸(K2·K6·K10·K11·H1·U1·E3)은 패널 «모드»로 스택을 명시(stackMode) · K1 은 기본 격자를 잰다
 *   ── 격자 모드(A4 칸 · 현빈 결정 «스택 ＋ 격자») ──
 *   G1 모드 «격자» → .cert-grid · 칸 4 · 세로 A4 · 빈 칸 체크무늬 · 회전 0
 *   G2 그리드 피커 2×2(현빈 261114 «그리드 피커» · .grid-picker 관례) → 열 2개 · 용지 4
 *   G5 그리드 피커 3×3 → 열 3 · 용지 9(격자 상한 12 · 스택 6) · 라벨 «3 × 3»
 *   ── 현빈 실물 피드백(261114 · srv 9500) ──
 *   U1 패널 — 끌어 놓기 안내문(prop-hint) 0 · «위 제목/부제» 칸 0 · «지시선 글» 행 = «장 수» 행 바로 아래(격자면 피커 바로 아래)
 *   G6 격자 간격 −40(⑦ 음수 = 겹침) → 이웃 칸(열·행) 사각형이 겹친다 · 뒤 칸이 위 · 출력 사본(forOutput)도 겹친다
 *      양성대조: cert-block.js _renderGridStage 의 음수 갈래(`(neg ? \`position:relative;transform:translate(…)\` : '')`)를 `''` 로 → G6 빨강
 *   SM1 «샘플 넣어보기»(⑪) — 켬 = 빈 칸 3에 샘플(번들 그림 실제 로드) · 넣은 그림 안 덮음 · dataset.certs 에 샘플 주소 0 · 미리보기 샘플 보임
 *       · 캡처(내보내기) 클론 = 샘플도 빈 칸 취급(R1 — 1장만) · 끔 = 체크무늬 3 으로
 *      양성대조: cert-block.js renderCertBlock 의 `{ forOutput = false, showSamples = !forOutput }` 를 `showSamples = true` 로 → SM1(캡처 1장) 빨강
 *              · 같은 곳 `(c.img ? c : …)` 를 `({ ...c, img: CERT_SAMPLE_DOCS[…], sample: true })`(무조건 덮기)로 → SM1(안 덮음) 빨강
 *   SH1 «용지 높이»(⑫ · crt-sheeth) — 스택 200 → 용지 높이/폭 2.0 · 슬라이더 = «용지 크기» 바로 아래 / 격자 60 → 0.6 · 캡처 클론(출력)도 같은 비율
 *      양성대조: cert-block.js 격자 칸 `aspect-ratio:100 / ${st.sheetH}` 를 `210 / 297` 로 → SH1(격자) 빨강 · collageLayout 호출의 `ratio: st.sheetH / 100,` 삭제 → SH1(스택) 빨강
 *   OV1 겹침 순서(⑬ · ⑮ 기본 «왼쪽이 위») — 간격 −40 · 기본 → 겹친 곳 = 왼쪽 칸(0)·위 행 칸(0) · 출력 클론도 같은 z · «오른쪽이 위» 명시 → 칸 1·칸 2
 *      양성대조: cert-block.js _renderGridStage 의 `(st.overlap === 'left' ? \`z-index:…\` : '')` 를 `''` 로 → OV1 빨강
 *   SN1 «용지 높이» 자석 턱(⑭) — 슬라이더 끌기 139·143·145 → 141 · 130·146 → 그대로 · 숫자 칸 직접 139 → 139 · 트랙에 턱 눈금
 *      양성대조: prop-cert.js wireNum('crt-sheeth', …) 의 `, { snap: { to: CERT_SHEET_H.def, tol: 4 } }` 삭제 → SN1 빨강
 *   IE1 안 2 — 그림 든 칸 더블클릭 = 틀 안 그림 편집(공용 편집기 · 코너 핸들) · 끌기 → certs[0].crop(％) · 틀 크기 그대로 · 출력 클론도 같은 crop
 *       · ⌘Z 한 번 = 크롭 전(그림은 남음) · 다시 열어 «원래대로» = crop 없음(cover) · (빈 칸 더블클릭 = 파일창은 K4)
 *      양성대조: cert-block.js 더블클릭의 `if (readCertState(block).certs[i]?.img) { enterCertImageEditMode(block, i); return; }` 삭제 → IE1 빨강
 *              · setCertList 의 `if (cr) o.crop = cr;` 삭제 → IE1(crop 저장) 빨강
 *   FB1 «패딩 제외» — 섹션 좌우 패딩 40 → 토글 보임 · 켬 = 블럭 margin −40 · 끔 = 원래대로(흔적 0)
 *   G3 격자에서도 끌어 놓기 · 지시선 글 켜면 칸 «아래» 글(지시선 0)
 *   ── 빈 용지 숨김(현빈 결정 R1 · 편집 = 체크무늬 · 출력 = 빈 칸 빼고 다시 배치 · 전부 비면 블럭째 숨김 · 저장본 무변) ──
 *   H1 캡처 클론(stripEditorOnlyForCapture = PNG·HTML·썸네일 공용) — 채움 2·빔 2 → 클론 용지 2 · 빈 칸 0 · 각도 = 부채(2장) ±4°
 *   H2 전부 빔 → 클론 블럭 display:none · 그 줄(.row)도 숨김
 *   H3 편집 화면·저장본 무변 — 캡처 뒤에도 라이브 용지 4(빈 2) · dataset.certs 그대로
 *   H4 미리보기(enterPreview) — 미리보기 사본 용지 2 · 편집 화면 4 그대로
 *   H5 내보내기 직전 알림 — certOutputNotice → «빈 용지 2장» 토스트(비차단)
 *   양성대조: cert-block.js renderCertBlock 의 forOutput 갈래(`if (forOutput) { … }`)를 지우면 H1·H2·H4 빨강 · capture-safety.js 의 그 한 줄을 지우면 H1·H2 빨강
 *            · preview.js enterPreview 의 그 한 줄을 지우면 H4 빨강
 *   ── 스크래치패드 끌어오기(현빈 결정 ④) — js/canvas-scratch-drop.js 의 진짜 판정·실행(scratch-pad onUp 이 부르는 그 둘) ──
 *   S1 용지 칸 위 좌표 → previewScratchDropAt = 'certslot' · 안내 «용지 그림으로» · commitScratchDropAt → 그 칸 img · 다른 칸 그대로 · 새 에셋 블럭 0
 *   S2 그림 주소가 data:image/ 가 아니면(javascript:) 안 들어간다(형식 문 certImgOk)
 *   양성대조: canvas-scratch-drop.js «케이스 A1» 판정(`const certSheet = …` 덩이)을 지우면 S1 빨강(«사이에 새 에셋 삽입»으로 떨어진다)
 *   ── 이펙트(현빈 «이펙트» 절 · 용지마다: 회전·기울기·끝말림·그림자) ──
 *   E1 대상 «모든 용지» — 그림자 «진하게» → 4장 모두 진한 그림자 · (⑧ 끝말림 제거) 저장본에 fx.curl:'on' 이 있어도 .cert-curl 0
 *   E2 대상 «용지 2» — 회전 20 → 그 장만 20° 더 돈다(나머지 각도 그대로)
 *   E3 기울기 25(모든 용지) → 3D 원근(matrix3d) · 0 이면 2D 그대로
 *   E4 격자에서도 이펙트(회전) 가 먹는다
 *   양성대조: cert-block.js sheetTransform 의 `base + fx.rot` 를 `base` 로 → E2·E4 빨강 · `fx.tilt ?` 갈래를 지우면 E3 빨강
 *            · _sheetCss 의 `box-shadow:${CERT_SHADOWS[c.fx.shadow]}` 를 지우면 E1 빨강
 * 양성대조:
 *   · js/blocks/cert-block.js _bindSlotInput 의 drop 리스너(`block.addEventListener('drop', …)`)를 지우면 K3 빨강
 *   · 같은 파일 `transform:rotate(${s.rot.toFixed(2)}deg);` 를 지우면 K2 빨강
 *   · js/blocks/cert-layout.js collageLayout 의 `preset === 'fan' ? _fanSlots(n) :` 를 지우면 K2 빨강(기본이 auto 로 떨어져 각도 ± 번갈아)
 *   · js/blocks/cert-block.js renderCertBlock 의 `if (st.mode === 'grid') { … }` 갈래를 지우면 G1·G2·G3 빨강
 *   · js/props/prop-cert.js 피커 click 리스너(`picker.addEventListener('click', …)`)를 지우면 G2·G5 빨강
 *   · js/blocks/cert-block.js renderCertBlock 의 `window.applyBlockFullBleed?.(block);` 를 지우면 FB1 빨강
 * 셀렉터 대조(제품 소스 grep): #fp-add-cert(index.html) · .fp-dropdown-trigger(#fp-component-dropdown) · .cert-sheet/.cert-ph/.cert-img/.cert-callout/.cert-line/.cert-status/.cert-stage(cert-block.js)
 *   · #crt-mode/#crt-preset/#crt-count-number/#crt-grid-picker .grid-picker-cell/#crt-fullbleed/#crt-samples/#crt-sheeth-number/#crt-overlap/#crt-img-crop-done/#crt-img-crop-reset/.cert-img-edit-proxy/#crt-callouts/#crt-fx-target/#crt-fx-rot-number/#crt-fx-tilt-number/#crt-fx-shadow(prop-cert.js) · 카드 셀렉터(.crt-card/.crt-img-pick/.crt-img-clear/.crt-status)는 «없음» 단언용 · 토글 = label.prop-toggle:has(#id)(숨은 체크박스 · css/editor-props.css:242)
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

async function boot(page) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(async () => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    await window.addSection(); window.deselectAll?.(); window.selectSection(c.querySelector('.section-block'));
  });
  return errs;
}
async function addViaMenu(page) {
  await page.click('#fp-component-dropdown .fp-dropdown-trigger');
  await page.click('#fp-add-cert');
  await page.waitForSelector('#canvas .cert-block .cert-stage');
  return page.evaluate(() => { const b = [...document.querySelectorAll('#canvas .cert-block')].pop(); return b.id; });
}
async function openPanel(page, id) {
  await page.evaluate((id) => window.showCertProperties(document.getElementById(id)), id);
  await page.waitForSelector('#crt-mode');   // ⑩ 뒤 기본이 격자 — #crt-preset 은 스택에만 있다(두 모드 공통 = #crt-mode)
}
const toggle = (page, id) => page.click(`label.prop-toggle:has(#${id})`);
/** ⑩ 새 블럭 기본 = 격자 — 스택을 재는 칸은 패널 «모드»로 스택을 «명시»하고 잰다(단언 그대로). */
async function stackMode(page, id) {
  await openPanel(page, id);
  await page.selectOption('#crt-mode', 'stack');
  await page.waitForFunction((id) => document.getElementById(id).dataset.mode === 'stack' && !!document.querySelector(`#${id} .cert-stage:not(.cert-grid)`), id);
}

test('K1 메뉴 «Documents» — 기본 격자(⑩) · 세로 A4 4장 · 체크무늬 · 옵션 다 끔', async ({ page }) => {
  const errs = await boot(page);
  const id = await addViaMenu(page);
  const r = await page.evaluate((id) => { const b = document.getElementById(id); const q = (s) => b.querySelectorAll(s).length;
    const sh = b.querySelector('.cert-sheet');
    return { sheets: q('.cert-sheet'), ph: q('.cert-sheet.cert-ph'), ratioOk: Math.abs(sh.offsetHeight / sh.offsetWidth - 297 / 210) < 0.02,   // 픽셀 반올림 여유
      checker: /conic-gradient/.test(sh.style.background || sh.style.backgroundImage || getComputedStyle(sh).backgroundImage),
      callouts: q('.cert-callout'), lines: q('.cert-line'), curl: q('.cert-curl'), head: q('.cert-head'),
      extra: q('.cert-frame, .cert-f-seal'), mode: b.dataset.mode, grid: q('.cert-grid'), layer: b.dataset.layerName }; }, id);
  expect(r).toEqual({ sheets: 4, ph: 4, ratioOk: true, checker: true, callouts: 0, lines: 0, curl: 0, head: 0, extra: 0, mode: 'grid', grid: 1, layer: 'Documents' });
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('K2 부채 스택 — 회전 단조 · 이웃 겹침', async ({ page }) => {
  const errs = await boot(page);
  const id = await addViaMenu(page);
  await stackMode(page, id);
  const r = await page.evaluate((id) => {
    const S = [...document.querySelectorAll(`#${id} .cert-sheet`)].map((s) => { const m = new DOMMatrix(getComputedStyle(s).transform); const rc = s.getBoundingClientRect();
      return { deg: Math.atan2(m.b, m.a) * 180 / Math.PI, cx: rc.left + rc.width / 2, rc }; }).sort((a, b) => a.cx - b.cx);
    const hit = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
    return { mono: S.every((s, i) => i === 0 || s.deg > S[i - 1].deg + 0.5), overlap: S.every((s, i) => i === 0 || hit(S[i - 1].rc, s.rc)), degs: S.map((s) => s.deg.toFixed(1)) };
  }, id);
  expect(r.mono, `★부채가 아니다(각도 ${r.degs})`).toBe(true);
  expect(r.overlap, '★이웃 용지가 안 겹친다').toBe(true);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('K3 끌어 놓기 — 그 칸만 그림', async ({ page }) => {
  const errs = await boot(page);
  const id = await addViaMenu(page);
  const dt = await page.evaluateHandle((b64) => { const bin = atob(b64); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    const d = new DataTransfer(); d.items.add(new File([u], 'a4.png', { type: 'image/png' })); return d; }, PNG.toString('base64'));
  await page.dispatchEvent(`#${id} .cert-sheet[data-idx="2"]`, 'dragover', { dataTransfer: dt });
  await page.dispatchEvent(`#${id} .cert-sheet[data-idx="2"]`, 'drop', { dataTransfer: dt });
  await page.waitForFunction((id) => !!document.querySelector(`#${id} .cert-sheet[data-idx="2"] img.cert-img`), id, { timeout: 5000 });
  const r = await page.evaluate((id) => ({ src: document.querySelector(`#${id} .cert-sheet[data-idx="2"] img`).getAttribute('src').slice(0, 22), ph: document.querySelectorAll(`#${id} .cert-sheet.cert-ph`).length }), id);
  expect(r).toEqual({ src: 'data:image/png;base64,', ph: 3 });
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('K4 더블클릭 = 파일창', async ({ page }) => {
  const errs = await boot(page);
  const id = await addViaMenu(page);
  // 맨 위(가장 오른쪽 · z 최대) 장의 가운데 — 다른 장에 안 가린 자리(부채는 오른쪽이 위에 쌓인다)
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.dblclick(`#${id} .cert-sheet[data-idx="3"]`)]);
  await chooser.setFiles({ name: 'a4.png', mimeType: 'image/png', buffer: PNG });
  await page.waitForFunction((id) => !!document.querySelector(`#${id} .cert-sheet[data-idx="3"] img.cert-img`), id, { timeout: 5000 });
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('K5 패널에 용지 카드 없음(⑥)', async ({ page }) => {
  const errs = await boot(page);
  const id = await addViaMenu(page);
  await openPanel(page, id);
  const r = await page.evaluate(() => ({ cards: document.querySelectorAll('.crt-card, .crt-img-pick, .crt-img-clear, .crt-status, .crt-title, .crt-desc').length }));
  expect(r.cards, '★용지별 카드가 남았다').toBe(0);
  await toggle(page, 'crt-callouts');   // 지시선 글을 켜도 카드는 안 생긴다
  expect(await page.evaluate(() => document.querySelectorAll('.crt-card, .crt-status').length)).toBe(0);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('K6 옵션 «지시선 글» · 상태 칩', async ({ page }) => {
  const errs = await boot(page);
  const id = await addViaMenu(page);
  await stackMode(page, id);   // 지시선은 스택에서만
  await toggle(page, 'crt-callouts');
  await expect(page.locator(`#${id} .cert-callout`)).toHaveCount(4);
  await expect(page.locator(`#${id} .cert-line`)).toHaveCount(4);
  // 상태는 데이터로(패널 카드 입구는 ⑥ 으로 빠짐 · 대안 입구는 현빈 답 뒤)
  await page.evaluate((id) => { const b = document.getElementById(id); const c = JSON.parse(b.dataset.certs); c[0].status = '출원'; b.dataset.certs = JSON.stringify(c); window.renderCertBlock(b); }, id);
  await expect(page.locator(`#${id} .cert-callout[data-idx="0"] .cert-status`)).toHaveText('출원');
  expect(errs, errs.join(' | ')).toEqual([]);
});


test('K8 [보안] 손댄 dataset', async ({ page }) => {
  const errs = await boot(page);
  const id = await addViaMenu(page);
  const r = await page.evaluate((id) => {
    const b = document.getElementById(id);
    b.dataset.callouts = 'on';
    b.dataset.certs = JSON.stringify([
      { title: '<img src=x onerror="window.__pwnT=1">', desc: '<b>x</b>', img: 'javascript:window.__pwnI=1', status: '' },
      { title: 'ok', desc: 'ok', img: 'data:text/html;base64,PHNjcmlwdD4=', status: '<script>' },
    ]);
    b.dataset.headline = '<img src=x onerror="window.__pwnH=1">';
    window.renderCertBlock(b);
    const all = [...b.querySelectorAll('*')];
    return { imgs: b.querySelectorAll('img').length, on: all.filter((e) => [...e.attributes].some((a) => /^on/i.test(a.name))).length,
      t0: b.querySelector('.cert-callout[data-idx="0"] .cert-ct').textContent, ph: b.querySelectorAll('.cert-sheet.cert-ph').length,
      status: b.querySelectorAll('.cert-status').length, head: b.querySelector('.cert-headline').textContent };
  }, id);
  expect(r.imgs).toBe(0);
  expect(r.on).toBe(0);
  expect(r.t0).toBe('<img src=x onerror="window.__pwnT=1">');
  expect(r.ph).toBe(2);
  expect(r.status).toBe(0);
  expect(r.head).toBe('<img src=x onerror="window.__pwnH=1">');
  expect(await page.evaluate(() => ['__pwnT', '__pwnI', '__pwnH'].filter((k) => window[k]))).toEqual([]);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('K9 저장→열기 — dataset 에서 다시 그린다', async ({ page }) => {
  const errs = await boot(page);
  const id = await addViaMenu(page);
  const html = await page.evaluate((id) => {
    const clone = document.getElementById(id).closest('.section-block').cloneNode(true);
    clone.querySelectorAll('.cert-block').forEach((b) => { b.querySelectorAll(':scope > *').forEach((n) => n.remove()); });   // 저장본의 옛 그림을 지워도
    return clone.outerHTML;
  }, id);
  await page.evaluate((h) => window.applyProjectData({ canvas: h }), html);
  await page.waitForSelector('#canvas .cert-block .cert-stage');
  expect(await page.locator('#canvas .cert-block .cert-sheet').count()).toBe(4);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('K10 장 수 6', async ({ page }) => {
  const errs = await boot(page);
  const id = await addViaMenu(page);
  await stackMode(page, id);   // «장 수» 슬라이더는 스택(격자는 피커)
  await page.fill('#crt-count-number', '6');
  await page.dispatchEvent('#crt-count-number', 'change');
  await expect(page.locator(`#${id} .cert-sheet`)).toHaveCount(6);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('G1 격자 모드 — A4 칸 4', async ({ page }) => {
  const errs = await boot(page);
  const id = await addViaMenu(page);
  await openPanel(page, id);
  await page.selectOption('#crt-mode', 'grid');
  await page.waitForSelector(`#${id} .cert-grid`);
  const r = await page.evaluate((id) => { const b = document.getElementById(id); const sh = b.querySelector('.cert-grid .cert-sheet');
    return { cells: b.querySelectorAll('.cert-grid .cert-cell').length, ratioOk: Math.abs(sh.offsetHeight / sh.offsetWidth - 297 / 210) < 0.02,
      checker: /conic-gradient/.test(sh.style.background || getComputedStyle(sh).backgroundImage), rot: getComputedStyle(sh).transform }; }, id);
  expect(r).toEqual({ cells: 4, ratioOk: true, checker: true, rot: 'none' });
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('G2 그리드 피커 2×2', async ({ page }) => {
  const errs = await boot(page);
  const id = await addViaMenu(page);
  await openPanel(page, id);
  await page.selectOption('#crt-mode', 'grid');
  await page.waitForSelector('#crt-grid-picker .grid-picker-cell');
  await page.click('#crt-grid-picker .grid-picker-cell[data-c="2"][data-r="2"]');
  const r = await page.evaluate((id) => ({ cols: getComputedStyle(document.querySelector(`#${id} .cert-grid`)).gridTemplateColumns.split(' ').length, n: document.querySelectorAll(`#${id} .cert-sheet`).length }), id);
  expect(r).toEqual({ cols: 2, n: 4 });
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('G3 격자 — 끌어 놓기 · 칸 아래 글', async ({ page }) => {
  const errs = await boot(page);
  const id = await addViaMenu(page);
  await openPanel(page, id);
  await page.selectOption('#crt-mode', 'grid');
  await page.waitForSelector(`#${id} .cert-grid`);
  const dt = await page.evaluateHandle((b64) => { const bin = atob(b64); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    const d = new DataTransfer(); d.items.add(new File([u], 'a4.png', { type: 'image/png' })); return d; }, PNG.toString('base64'));
  await page.dispatchEvent(`#${id} .cert-sheet[data-idx="1"]`, 'drop', { dataTransfer: dt });
  await page.waitForFunction((id) => !!document.querySelector(`#${id} .cert-grid .cert-sheet[data-idx="1"] img.cert-img`), id, { timeout: 5000 });
  await toggle(page, 'crt-callouts');
  const r = await page.evaluate((id) => { const b = document.getElementById(id); const cap = b.querySelector('.cert-cell .cert-callout'); const sh = cap?.parentElement.querySelector('.cert-sheet');
    return { caps: b.querySelectorAll('.cert-grid .cert-callout').length, lines: b.querySelectorAll('.cert-line').length, below: !!(cap && sh && cap.getBoundingClientRect().top >= sh.getBoundingClientRect().bottom - 1) }; }, id);
  expect(r).toEqual({ caps: 4, lines: 0, below: true });
  expect(errs, errs.join(' | ')).toEqual([]);
});

const angles = (page, id) => page.evaluate((id) => [...document.querySelectorAll(`#${id} .cert-sheet`)].sort((a, b) => a.dataset.idx - b.dataset.idx)
  .map((s) => { const m = new DOMMatrix(getComputedStyle(s).transform); return +(Math.atan2(m.b, m.a) * 180 / Math.PI).toFixed(1); }), id);

test('E1 모든 용지 — 끝말림·그림자', async ({ page }) => {
  const errs = await boot(page);
  const id = await addViaMenu(page);
  await openPanel(page, id);
  await expect(page.locator('#crt-fx-target')).toHaveValue('all');
  // ⑧ 끝말림 제거 — 저장본에 fx.curl 이 있어도 안 그린다(호환)
  await page.evaluate((id) => { const b = document.getElementById(id); const c = JSON.parse(b.dataset.certs); c.forEach((x) => { x.fx = { ...(x.fx || {}), curl: 'on' }; }); b.dataset.certs = JSON.stringify(c); window.renderCertBlock(b); }, id);
  await expect(page.locator(`#${id} .cert-curl`)).toHaveCount(0);
  await expect(page.locator('#crt-fx-curl')).toHaveCount(0);
  await page.selectOption('#crt-fx-shadow', 'strong');
  const sh = await page.evaluate((id) => [...document.querySelectorAll(`#${id} .cert-sheet`)].map((s) => /0\.32/.test(getComputedStyle(s).boxShadow)), id);
  expect(sh).toEqual([true, true, true, true]);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('E2 용지 2 만 회전 +20', async ({ page }) => {
  const errs = await boot(page);
  const id = await addViaMenu(page);
  const before = await angles(page, id);
  await openPanel(page, id);
  await page.selectOption('#crt-fx-target', '1');
  await page.fill('#crt-fx-rot-number', '20');
  await page.dispatchEvent('#crt-fx-rot-number', 'change');
  const after = await angles(page, id);
  const d = after.map((a, i) => +(a - before[i]).toFixed(1));
  expect(d).toEqual([0, 20, 0, 0]);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('E3 기울기 25 → 3D 원근', async ({ page }) => {
  const errs = await boot(page);
  const id = await addViaMenu(page);
  await stackMode(page, id);   // 전제 «기울기 0 = 2D matrix» 는 회전이 있는 스택에서 잰다(격자 무회전 = none)
  const t0 = await page.evaluate((id) => getComputedStyle(document.querySelector(`#${id} .cert-sheet`)).transform, id);
  expect(t0.startsWith('matrix('), '[전제] 기울기 0 = 2D').toBe(true);
  await openPanel(page, id);
  await page.fill('#crt-fx-tilt-number', '25');
  await page.dispatchEvent('#crt-fx-tilt-number', 'change');
  const t = await page.evaluate((id) => [...document.querySelectorAll(`#${id} .cert-sheet`)].map((s) => getComputedStyle(s).transform.startsWith('matrix3d(')), id);
  expect(t).toEqual([true, true, true, true]);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('E4 격자에서도 회전', async ({ page }) => {
  const errs = await boot(page);
  const id = await addViaMenu(page);
  await openPanel(page, id);
  await page.selectOption('#crt-mode', 'grid');
  await page.waitForSelector(`#${id} .cert-grid`);
  await page.fill('#crt-fx-rot-number', '-8');
  await page.dispatchEvent('#crt-fx-rot-number', 'change');
  expect(await angles(page, id)).toEqual([-8, -8, -8, -8]);
  expect(errs, errs.join(' | ')).toEqual([]);
});

const DATA_PNG = 'data:image/png;base64,' + PNG.toString('base64');
async function seed(page, id, imgs) {
  await page.evaluate(({ id, imgs }) => { const b = document.getElementById(id);
    b.dataset.certs = JSON.stringify(imgs.map((img, i) => ({ title: `제목 ${i + 1}`, desc: '설명', img, status: '' }))); window.renderCertBlock(b); }, { id, imgs });
}
async function captureClone(page, id) {
  return page.evaluate(async (id) => {
    const sec = document.getElementById(id).closest('.section-block');
    const clone = sec.cloneNode(true); document.body.appendChild(clone);
    const mod = await import('/js/io/capture-safety.js'); mod.stripEditorOnlyForCapture(clone);
    const b = clone.querySelector('.cert-block');
    const degs = [...b.querySelectorAll('.cert-sheet')].map((s) => { const m = new DOMMatrix(getComputedStyle(s).transform); return +(Math.atan2(m.b, m.a) * 180 / Math.PI).toFixed(1); }).sort((a, c) => a - c);
    const out = { sheets: b.querySelectorAll('.cert-sheet').length, ph: b.querySelectorAll('.cert-ph').length, degs, display: b.style.display, rowDisplay: b.parentElement.style.display };
    clone.remove(); return out;
  }, id);
}

test('H1 캡처 클론 — 빈 칸 빼고 2장 부채', async ({ page }) => {
  const errs = await boot(page);
  const id = await addViaMenu(page);
  await stackMode(page, id);
  await seed(page, id, [DATA_PNG, '', DATA_PNG, '']);
  const r = await captureClone(page, id);
  expect([r.sheets, r.ph, r.degs]).toEqual([2, 0, [-4, 4]]);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('H2 전부 빔 — 블럭째 숨김', async ({ page }) => {
  const errs = await boot(page);
  const id = await addViaMenu(page);
  const r = await captureClone(page, id);
  expect([r.display, r.rowDisplay]).toEqual(['none', 'none']);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('H3 편집 화면·저장본 무변', async ({ page }) => {
  const errs = await boot(page);
  const id = await addViaMenu(page);
  await seed(page, id, [DATA_PNG, '', DATA_PNG, '']);
  const before = await page.evaluate((id) => document.getElementById(id).dataset.certs, id);
  await captureClone(page, id);
  const r = await page.evaluate((id) => { const b = document.getElementById(id); return { sheets: b.querySelectorAll('.cert-sheet').length, ph: b.querySelectorAll('.cert-ph').length, certs: b.dataset.certs, display: b.style.display }; }, id);
  expect([r.sheets, r.ph, r.display]).toEqual([4, 2, '']);
  expect(r.certs).toBe(before);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('H4 미리보기 — 빈 칸 빠짐 · 편집 화면 그대로', async ({ page }) => {
  const errs = await boot(page);
  const id = await addViaMenu(page);
  await seed(page, id, [DATA_PNG, '', '', DATA_PNG]);
  await page.evaluate(() => window.enterPreview());   // enterPreview 가 현재 쪽을 먼저 flushCurrentPage 한다(preview.js:12)
  await page.waitForFunction(() => document.body.classList.contains('preview-mode'));
  const n = await page.evaluate(() => [...document.querySelectorAll('#preview-content .cert-block')].map((b) => [b.querySelectorAll('.cert-sheet').length, b.querySelectorAll('.cert-ph').length]));
  expect(n, '[전제] 미리보기에 Documents 가 실렸다').toHaveLength(1);
  expect(n[0]).toEqual([2, 0]);
  await page.evaluate(() => window.exitPreview());
  expect(await page.locator(`#${id} .cert-sheet`).count()).toBe(4);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('H5 내보내기 직전 알림', async ({ page }) => {
  const errs = await boot(page);
  const id = await addViaMenu(page);
  await seed(page, id, [DATA_PNG, '', DATA_PNG, '']);
  const n = await page.evaluate(() => window.certOutputNotice(document.getElementById('canvas')));
  expect(n).toBe(2);
  await expect(page.locator('#editor-toast')).toContainText('빈 용지 2장');
  expect(errs, errs.join(' | ')).toEqual([]);
});

async function sheetCenter(page, id, idx) {
  return page.evaluate(({ id, idx }) => { const r = document.querySelector(`#${id} .cert-sheet[data-idx="${idx}"]`).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, { id, idx });
}

test('S1 스크래치 끌어오기 — 그 칸 그림', async ({ page }) => {
  const errs = await boot(page);
  const id = await addViaMenu(page);
  await page.evaluate((id) => document.querySelector(`#${id} .cert-sheet[data-idx="3"]`).scrollIntoView({ block: 'center' }), id);
  const p = await sheetCenter(page, id, 3);   // 맨 위(오른쪽) 장 가운데 — 다른 장에 안 가림
  const assets0 = await page.locator('#canvas .asset-block').count();
  const kind = await page.evaluate(({ x, y }) => window.previewScratchDropAt(x, y), p);
  expect(kind).toBe('certslot');
  await expect(page.locator(`#${id} .cert-sheet[data-idx="3"] .sp2c-badge`)).toHaveText('용지 그림으로');
  const ok = await page.evaluate(({ x, y, src }) => { const r = window.commitScratchDropAt(x, y, src); window.clearScratchDropGuides?.(); return r; }, { ...p, src: DATA_PNG });
  expect(ok).toBe(true);
  const r = await page.evaluate((id) => ({ img: !!document.querySelector(`#${id} .cert-sheet[data-idx="3"] img.cert-img`), ph: document.querySelectorAll(`#${id} .cert-sheet.cert-ph`).length }), id);
  expect(r).toEqual({ img: true, ph: 3 });
  expect(await page.locator('#canvas .asset-block').count(), '★새 에셋 블럭이 생겼다(칸 대신 섹션에 삽입)').toBe(assets0);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('S2 스크래치 — 이상한 주소는 안 들어간다', async ({ page }) => {
  const errs = await boot(page);
  const id = await addViaMenu(page);
  await page.evaluate((id) => document.querySelector(`#${id} .cert-sheet[data-idx="3"]`).scrollIntoView({ block: 'center' }), id);
  const p = await sheetCenter(page, id, 3);
  const ok = await page.evaluate(({ x, y }) => { const r = window.commitScratchDropAt(x, y, 'javascript:window.__pwnS=1'); window.clearScratchDropGuides?.(); return r; }, p);
  expect(ok).toBe(false);
  expect(await page.locator(`#${id} .cert-sheet.cert-ph`).count()).toBe(4);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('G5 그리드 피커 3×3 — 9장', async ({ page }) => {
  const errs = await boot(page);
  const id = await addViaMenu(page);
  await openPanel(page, id);
  await page.selectOption('#crt-mode', 'grid');
  await page.waitForSelector('#crt-grid-picker .grid-picker-cell');
  await page.click('#crt-grid-picker .grid-picker-cell[data-c="3"][data-r="3"]');
  await expect(page.locator(`#${id} .cert-grid .cert-sheet`)).toHaveCount(9);
  await expect(page.locator('#crt-grid-picker-label')).toHaveText('3 × 3');
  expect(await page.evaluate((id) => getComputedStyle(document.querySelector(`#${id} .cert-grid`)).gridTemplateColumns.split(' ').length, id)).toBe(3);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('U1 패널 — 안내문·위 제목 없음 · 지시선 글 = 장 수 바로 아래', async ({ page }) => {
  const errs = await boot(page);
  const id = await addViaMenu(page);
  await stackMode(page, id);   // «장 수» 행은 스택
  const r = await page.evaluate(() => {
    const P = document.getElementById('crt-mode').closest('.prop-section').parentElement;
    const nextHas = (el, sel) => !!el?.nextElementSibling?.querySelector(sel);
    return { hint: /끌어다 놓거나/.test(P.textContent), head: P.querySelectorAll('#crt-headline, #crt-sub').length,
      afterCount: nextHas(document.getElementById('crt-count-number').closest('.prop-row'), '#crt-callouts') };
  });
  expect(r).toEqual({ hint: false, head: 0, afterCount: true });
  await page.selectOption('#crt-mode', 'grid');
  await page.waitForSelector('#crt-grid-picker');
  const g = await page.evaluate(() => document.getElementById('crt-grid-picker-label').nextElementSibling?.querySelector('#crt-callouts') != null);
  expect(g, '격자: 지시선 글 = 피커 바로 아래').toBe(true);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('FB1 패딩 제외 켜고 끄기', async ({ page }) => {
  const errs = await boot(page);
  const id = await addViaMenu(page);
  await page.evaluate((id) => { const inner = document.getElementById(id).closest('.section-inner'); inner.dataset.paddingX = '40'; inner.style.paddingLeft = inner.style.paddingRight = '40px'; }, id);
  await openPanel(page, id);
  await expect(page.locator('#crt-fullbleed'), '[전제] 섹션 패딩이 있으면 토글이 보인다').toHaveCount(1);
  await toggle(page, 'crt-fullbleed');
  expect(await page.evaluate((id) => [document.getElementById(id).dataset.fullBleed, document.getElementById(id).style.marginLeft], id)).toEqual(['true', '-40px']);
  await toggle(page, 'crt-fullbleed');
  expect(await page.evaluate((id) => [document.getElementById(id).dataset.fullBleed ?? null, document.getElementById(id).style.marginLeft], id)).toEqual([null, '']);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('G6 격자 음수 간격 — 이웃 칸이 겹친다(편집·출력)', async ({ page }) => {
  const errs = await boot(page);
  const id = await addViaMenu(page);
  await openPanel(page, id);
  await page.selectOption('#crt-mode', 'grid');
  await page.waitForSelector('#crt-grid-picker .grid-picker-cell');
  await page.click('#crt-grid-picker .grid-picker-cell[data-c="2"][data-r="2"]');
  await page.fill('#crt-gap-number', '-40');
  await page.dispatchEvent('#crt-gap-number', 'change');
  const live = await page.evaluate((id) => { const b = document.getElementById(id); b.scrollIntoView({ block: 'center' });
    const R = [...b.querySelectorAll('.cert-cell')].map((c) => c.getBoundingClientRect());
    const mid = [(R[0].right + R[1].left) / 2, R[0].top + R[0].height / 2];
    return { h: R[0].right > R[1].left + 1, v: R[0].bottom > R[2].top + 1, top: document.elementFromPoint(mid[0], mid[1])?.closest('.cert-cell') === b.querySelectorAll('.cert-cell')[1] }; }, id);
  expect(live, '★편집 화면에서 안 겹친다').toEqual({ h: true, v: true, top: true });
  // 출력(forOutput) 사본도 같은 겹침 — 칸에 그림 넣고(출력은 빈 칸을 뺀다) 캡처 클론에서 잰다
  await seed(page, id, [DATA_PNG, DATA_PNG, DATA_PNG, DATA_PNG]);
  const out = await page.evaluate(async (id) => {
    const sec = document.getElementById(id).closest('.section-block'); const clone = sec.cloneNode(true); document.body.appendChild(clone);
    const mod = await import('/js/io/capture-safety.js'); mod.stripEditorOnlyForCapture(clone);
    const R = [...clone.querySelectorAll('.cert-block .cert-cell')].map((c) => c.getBoundingClientRect()); clone.remove();
    return { n: R.length, h: R[0].right > R[1].left + 1, v: R[0].bottom > R[2].top + 1 };
  }, id);
  expect(out).toEqual({ n: 4, h: true, v: true });
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('K11 장 수 8(⑨)', async ({ page }) => {
  const errs = await boot(page);
  const id = await addViaMenu(page);
  await stackMode(page, id);
  expect(await page.getAttribute('#crt-count-number', 'max'), '슬라이더 상한 = CERT_MAX_SHEETS').toBe('8');
  await page.fill('#crt-count-number', '8');
  await page.dispatchEvent('#crt-count-number', 'change');
  await expect(page.locator(`#${id} .cert-sheet`)).toHaveCount(8);
  const r = await page.evaluate((id) => { const b = document.getElementById(id).getBoundingClientRect();
    return [...document.querySelectorAll(`#${id} .cert-sheet`)].every((s) => { const q = s.getBoundingClientRect(); return q.left >= b.left - 1 && q.right <= b.right + 1; }); }, id);
  expect(r, '★8장 중 블럭 가로 밖으로 나간 종이가 있다(회전 모서리 포함)').toBe(true);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('SM1 샘플 넣어보기 — 빈 칸만 · 저장 0 · 미리보기 보임 · 내보내기 빈 칸', async ({ page }) => {
  const errs = await boot(page);
  const id = await addViaMenu(page);
  await seed(page, id, [DATA_PNG, '', '', '']);
  await openPanel(page, id);
  await toggle(page, 'crt-samples');
  await expect(page.locator(`#${id} .cert-sheet.cert-sample`)).toHaveCount(3);
  await page.waitForFunction((id) => [...document.querySelectorAll(`#${id} .cert-sample img`)].every((i) => i.complete && i.naturalWidth > 0), id);   // 번들 경로가 실제로 열린다
  const r = await page.evaluate((id) => { const b = document.getElementById(id);
    return { flag: b.dataset.samples, leak: /sample-docs/.test(b.dataset.certs), ph: b.querySelectorAll('.cert-ph').length,
      first: b.querySelector('.cert-sheet[data-idx="0"]').classList.contains('cert-sample') }; }, id);
  expect(r).toEqual({ flag: 'on', leak: false, ph: 0, first: false });
  expect(await page.evaluate(({ id, src }) => document.querySelector(`#${id} .cert-sheet[data-idx="0"] img`).getAttribute('src') === src, { id, src: DATA_PNG }), '★넣은 그림을 덮었다').toBe(true);
  const cap = await captureClone(page, id);
  expect([cap.sheets, cap.ph], '★내보내기에 샘플이 나갔다(안전기본값 = 빈 칸 취급)').toEqual([1, 0]);
  await page.evaluate(() => window.enterPreview());
  await page.waitForFunction(() => document.body.classList.contains('preview-mode'));
  expect(await page.evaluate(() => [...document.querySelectorAll('#preview-content .cert-block')].map((b) => [b.querySelectorAll('.cert-sheet').length, b.querySelectorAll('.cert-sample').length])), '미리보기 = 샘플 보임').toEqual([[4, 3]]);
  await page.evaluate(() => window.exitPreview());
  await openPanel(page, id);
  await toggle(page, 'crt-samples');
  await expect(page.locator(`#${id} .cert-sample`)).toHaveCount(0);
  await expect(page.locator(`#${id} .cert-ph`)).toHaveCount(3);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('SH1 용지 높이 — 스택·격자·출력', async ({ page }) => {
  const errs = await boot(page);
  const id = await addViaMenu(page);
  const ratio = (root) => page.evaluate(({ id, root }) => [...document.querySelectorAll(root ? `${root} .cert-block .cert-sheet` : `#${id} .cert-sheet`)].map((s) => +(s.offsetHeight / s.offsetWidth).toFixed(2)), { id, root });
  await stackMode(page, id);
  expect(await page.inputValue('#crt-sheeth-number'), '저장본에 값 없음 = 141(A4)').toBe('141');
  expect(await page.evaluate(() => document.getElementById('crt-sheetw-number').closest('.prop-row').nextElementSibling?.querySelector('#crt-sheeth-number') != null), '«용지 크기» 바로 아래').toBe(true);
  await page.fill('#crt-sheeth-number', '200');
  await page.dispatchEvent('#crt-sheeth-number', 'change');
  for (const r of await ratio()) expect(Math.abs(r - 2), `스택 h/w ${r}`).toBeLessThan(0.03);
  await page.selectOption('#crt-mode', 'grid');
  await page.waitForSelector('#crt-sheeth-number');
  await page.fill('#crt-sheeth-number', '60');
  await page.dispatchEvent('#crt-sheeth-number', 'change');
  for (const r of await ratio()) expect(Math.abs(r - 0.6), `격자 h/w ${r}`).toBeLessThan(0.03);
  await seed(page, id, [DATA_PNG, DATA_PNG, '', '']);
  const out = await page.evaluate(async (id) => {
    const sec = document.getElementById(id).closest('.section-block'); const clone = sec.cloneNode(true); document.body.appendChild(clone);
    const mod = await import('/js/io/capture-safety.js'); mod.stripEditorOnlyForCapture(clone);
    const R = [...clone.querySelectorAll('.cert-block .cert-sheet')].map((s) => +(s.offsetHeight / s.offsetWidth).toFixed(2)); clone.remove(); return R;
  }, id);
  expect(out.length).toBe(2);
  for (const r of out) expect(Math.abs(r - 0.6), `출력 h/w ${r}`).toBeLessThan(0.03);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('OV1 겹침 순서 — 기본 왼쪽이 위(⑮) · 오른쪽 명시', async ({ page }) => {
  const errs = await boot(page);
  const id = await addViaMenu(page);
  await openPanel(page, id);
  await page.selectOption('#crt-mode', 'grid');
  await page.waitForSelector('#crt-grid-picker .grid-picker-cell');
  await page.click('#crt-grid-picker .grid-picker-cell[data-c="2"][data-r="2"]');
  await page.fill('#crt-gap-number', '-40');
  await page.dispatchEvent('#crt-gap-number', 'change');
  expect(await page.inputValue('#crt-overlap'), '⑮ 기본 = 왼쪽이 위').toBe('left');
  expect(await page.evaluate(() => document.getElementById('crt-gap-number').closest('.prop-row').nextElementSibling?.querySelector('#crt-overlap') != null), '«간격» 바로 아래').toBe(true);
  const top = () => page.evaluate((id) => {
    const b = document.getElementById(id); b.scrollIntoView({ block: 'center' });
    const C = [...b.querySelectorAll('.cert-cell')], R = C.map((c) => c.getBoundingClientRect());
    const at = (x, y) => C.indexOf(document.elementFromPoint(x, y)?.closest('.cert-cell'));
    return { h: at((R[0].right + R[1].left) / 2, R[0].top + R[0].height / 2), v: at(R[0].left + R[0].width / 2, (R[0].bottom + R[2].top) / 2) };
  }, id);
  expect(await top(), '★기본인데 왼쪽·위가 위가 아니다').toEqual({ h: 0, v: 0 });
  await seed(page, id, [DATA_PNG, DATA_PNG, DATA_PNG, DATA_PNG]);
  const out = await page.evaluate(async (id) => {
    const clone = document.getElementById(id).closest('.section-block').cloneNode(true); document.body.appendChild(clone);
    const mod = await import('/js/io/capture-safety.js'); mod.stripEditorOnlyForCapture(clone);
    const z = [...clone.querySelectorAll('.cert-block .cert-cell')].map((c) => +getComputedStyle(c).zIndex || 0); clone.remove(); return z;
  }, id);
  expect(out.length).toBe(4);
  expect(out[0] > out[1] && out[0] > out[2] && out[1] > out[3], `출력 클론도 같은 z(앞 칸이 위) ${out}`).toBe(true);
  await openPanel(page, id);
  await page.selectOption('#crt-overlap', 'right');
  expect(await top(), '★«오른쪽이 위» 를 골랐는데 오른쪽·아래가 위가 아니다').toEqual({ h: 1, v: 2 });
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('SN1 용지 높이 자석 턱 141(⑭)', async ({ page }) => {
  const errs = await boot(page);
  const id = await addViaMenu(page);
  await stackMode(page, id);
  const drag = (v) => page.evaluate(({ id, v }) => { const s = document.getElementById('crt-sheeth-slider'); s.value = String(v); s.dispatchEvent(new Event('input', { bubbles: true }));
    return [+document.getElementById('crt-sheeth-number').value, +document.getElementById(id).dataset.sheetH, +s.value]; }, { id, v });
  expect(await drag(139)).toEqual([141, 141, 141]);
  expect(await drag(143)).toEqual([141, 141, 141]);
  expect(await drag(145), '경계 ±4 포함').toEqual([141, 141, 141]);
  expect(await drag(130)).toEqual([130, 130, 130]);
  expect(await drag(146)).toEqual([146, 146, 146]);
  await page.fill('#crt-sheeth-number', '139');
  await page.dispatchEvent('#crt-sheeth-number', 'change');
  expect(await page.evaluate((id) => document.getElementById(id).dataset.sheetH, id), '숫자 칸 직접 입력엔 턱 없음').toBe('139');
  expect(await page.evaluate(() => document.getElementById('crt-sheeth-slider').style.background), '턱 눈금').toMatch(/linear-gradient/);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('IE1 그림 든 칸 더블클릭 = 틀 안 그림 편집(안 2)', async ({ page }) => {
  const errs = await boot(page);
  const id = await addViaMenu(page);
  await seed(page, id, [DATA_PNG, '', '', '']);
  await page.evaluate(() => window.pushHistory('IE1 seed'));   // ⌘Z 가 돌아갈 «크롭 전» 칸
  const sheet = `#${id} .cert-sheet[data-idx="0"]`;
  const frame0 = await page.locator(sheet).boundingBox();
  await page.dblclick(sheet);
  await page.waitForFunction(() => document.querySelectorAll('.cert-img-edit-proxy').length === 1 && document.querySelectorAll('.img-corner-handle').length > 0, null, { timeout: 5000 });
  await expect(page.locator('#crt-img-crop-done')).toHaveCount(1);
  const box = await page.locator('.cert-img-edit-proxy img.asset-img').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - 30, box.y + box.height / 2 - 20, { steps: 8 });
  await page.mouse.up();
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => document.querySelectorAll('.cert-img-edit-proxy, .img-corner-handle').length === 0, null, { timeout: 5000 });
  const r = await page.evaluate((id) => { const b = document.getElementById(id); const c = JSON.parse(b.dataset.certs)[0];
    return { crop: c.crop ?? null, img: !!c.img, pos: b.querySelector('.cert-sheet[data-idx="0"] img.cert-img').style.position }; }, id);
  expect(r.img).toBe(true);
  expect(r.crop, '★크롭이 저장 안 됐다').not.toBeNull();
  expect([r.crop.size, r.crop.x, r.crop.y].every(Number.isFinite)).toBe(true);
  expect(r.pos, '그림이 ％ 자리로 그려진다').toBe('absolute');
  const frame1 = await page.locator(sheet).boundingBox();
  expect(Math.abs(frame1.width - frame0.width) + Math.abs(frame1.height - frame0.height), '★틀 크기가 바뀌었다(안 2 = 틀 고정)').toBeLessThan(1);
  const out = await page.evaluate(async (id) => {
    const clone = document.getElementById(id).closest('.section-block').cloneNode(true); document.body.appendChild(clone);
    const mod = await import('/js/io/capture-safety.js'); mod.stripEditorOnlyForCapture(clone);
    const im = clone.querySelector('.cert-block .cert-sheet img.cert-img'); const v = im && [im.style.left, im.style.width]; clone.remove(); return v;
  }, id);
  expect(out, '출력 클론도 같은 crop').toEqual([`${r.crop.x}%`, `${r.crop.size}%`]);
  await page.keyboard.press('ControlOrMeta+z');
  await page.waitForFunction((id) => { const c = JSON.parse(document.getElementById(id)?.dataset.certs || '[]')[0]; return c && !c.crop && !!c.img; }, id, { timeout: 5000 });
  await page.keyboard.press('ControlOrMeta+Shift+z');
  await page.waitForFunction((id) => !!JSON.parse(document.getElementById(id)?.dataset.certs || '[]')[0]?.crop, id, { timeout: 5000 });
  await page.dblclick(sheet);
  await page.waitForSelector('#crt-img-crop-reset');
  await page.click('#crt-img-crop-reset');
  await page.waitForFunction((id) => { const c = JSON.parse(document.getElementById(id).dataset.certs)[0]; return !c.crop && !!c.img; }, id, { timeout: 5000 });
  expect(errs, errs.join(' | ')).toEqual([]);
});
