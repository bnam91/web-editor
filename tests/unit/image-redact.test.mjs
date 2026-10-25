/* image-redact.test.mjs — 이미지 «블러 (Redact)» 공용 모듈(js/effects/image-redact.js)과 그 배선 자리를 잰다 (1012t1 C1)
 *
 * ★하네스 — 모듈은 import 0 이라 .mjs 사본으로 싣는다(package type=commonjs · ai-text-slots-ssot 와 같은 수법).
 * ★잠그는 것
 *   U1 redactPx/normalizeRedact 눈금(0..100 → 0..20px · 걸러내기)
 *   U2 applyRedact 멱등 · 0 이면 흔적 0(속성·변수 둘 다) — D4 컴패리전이 매 렌더 부르는 계약
 *   U3 redactSectionHTML 꼴(그레인 절과 같은 클래스 · 인라인 style 0)
 *   U4 wireRedactSection — input=라이브, change=적용 «뒤» pushHistory(push-after), onCommit 문
 *   U5 배선 자리(소스): prop-asset 에 옛 절 0 · Effects 식구 「블러」(js/effects-blur.js · index.html) · clearAssetImage 끔 · ASSET_FX_DS_KEYS · capture-safety 명부 · CSS 규칙 · Figma 덮개
 * ★음성대조(쓴 이가 정한 것 · 안 돌렸다): REDACT_MAX_PX 20 → 21 ⇒ U1 「100 → 20」 빨강.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readSrc } from './_srcread.js';
import { mkTmpRoot } from './_tmproot.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const MOD_SRC = readSrc(ROOT, 'js', 'effects', 'image-redact.js');
const _tmp = path.join(mkTmpRoot('image-redact-'), 'image-redact.mjs');
fs.writeFileSync(_tmp, MOD_SRC);
const R = await import(pathToFileURL(_tmp).href);

function fakeHost(initial = {}) {
  const props = {};
  return {
    dataset: { ...initial },
    style: {
      _p: props,
      setProperty(k, v) { props[k] = String(v); },
      removeProperty(k) { delete props[k]; },
      getPropertyValue(k) { return props[k] || ''; },
    },
  };
}

test('U1 눈금 — 강도 0..100 → 0..20px · 걸러내기', () => {
  assert.equal(R.REDACT_MAX_PX, 20);
  const cases = [[0, 0], [100, 20], [60, 12], [-5, 0], [150, 20], ['60', 12], [NaN, 0], [undefined, 0], ['abc', 0], [1, 0.2], [33, 6.6]];
  for (const [inp, want] of cases) assert.equal(R.redactPx(inp), want, `redactPx(${String(inp)})`);
  const norm = [[0, 0], [100, 100], [60.4, 60], [-1, 0], [101, 100], ['42', 42], [null, 0], [NaN, 0]];
  for (const [inp, want] of norm) assert.equal(R.normalizeRedact(inp), want, `normalizeRedact(${String(inp)})`);
});

test('U2 applyRedact — 켜면 속성·변수 둘 다 · 0 이면 둘 다 지운다 · 멱등', () => {
  const h = fakeHost();
  assert.equal(R.applyRedact(h, 60), 60);
  assert.equal(h.dataset.redact, '60');
  assert.equal(h.style._p['--redact-blur'], '12px');
  assert.equal(R.readRedact(h), 60);
  /* 멱등 — 같은 값 두 번 = 같은 상태(D4 는 매 렌더 부른다) */
  const snap = JSON.stringify([h.dataset, h.style._p]);
  R.applyRedact(h, 60);
  assert.equal(JSON.stringify([h.dataset, h.style._p]), snap);
  /* 끔 — 흔적 0(옛 바이트 보존) */
  assert.equal(R.applyRedact(h, 0), 0);
  assert.ok(!('redact' in h.dataset), 'data-redact 가 남았다');
  assert.ok(!('--redact-blur' in h.style._p), '--redact-blur 가 남았다');
  assert.equal(R.readRedact(h), 0);
  /* 깨끗한 호스트에 0 = 아무것도 안 생긴다 */
  const c = fakeHost();
  R.applyRedact(c, 0);
  assert.deepEqual(c.dataset, {});
  assert.deepEqual(c.style._p, {});
  /* 범위 밖 · 문자열 — 걸러서 건다 */
  R.applyRedact(c, '250');
  assert.equal(c.dataset.redact, '100');
  assert.equal(c.style._p['--redact-blur'], '20px');
  /* 호스트 없음 — 던지지 않는다 */
  assert.equal(R.applyRedact(null, 50), 0);
  assert.equal(R.readRedact(null), 0);
});

test('U3 redactSectionHTML — 그레인 절과 같은 꼴 · 인라인 style 0', () => {
  const html = R.redactSectionHTML({ idPrefix: 'asset', value: 37 });
  assert.match(html, /<div class="prop-section" id="asset-redact-section">/);
  assert.match(html, /<div class="prop-section-title">블러 \(Redact\)<\/div>/);
  assert.match(html, /<div class="prop-row">/);
  assert.match(html, /<span class="prop-label">강도<\/span>/);
  assert.match(html, /<input type="range" class="prop-slider" id="asset-redact-slider" min="0" max="100" step="1" value="37">/);
  assert.match(html, /<input type="number" class="prop-number" id="asset-redact-number" min="0" max="100" value="37">/);
  assert.doesNotMatch(html, /style=/, '인라인 style 이 생겼다(디자인시스템: 클래스만)');
  assert.doesNotMatch(html, /#[0-9a-f]{3,6}\b/i, '색 리터럴이 생겼다');
  /* 다른 접두 · 범위 밖 값 */
  const h2 = R.redactSectionHTML({ idPrefix: 'cmp-cell', value: 999 });
  assert.match(h2, /id="cmp-cell-redact-slider"[^>]*value="100"/);
  assert.match(h2, /id="cmp-cell-redact-number"[^>]*value="100"/);
});

test('U4 wireRedactSection — input 라이브 · change 는 적용 «뒤» pushHistory · onCommit', () => {
  const mkInput = (value) => ({ value: String(value), _h: {}, addEventListener(t, f) { this._h[t] = f; } });
  const slider = mkInput(0), number = mkInput(0);
  const root = { querySelector: (s) => (s === '#x-redact-slider' ? slider : s === '#x-redact-number' ? number : null) };
  const host = fakeHost();
  const log = [];
  globalThis.window = { pushHistory: () => log.push(['push', host.dataset.redact ?? null]) };
  try {
    R.wireRedactSection({ idPrefix: 'x', root, getHost: () => host, onCommit: (v) => log.push(['commit', v]) });
    assert.equal(typeof slider._h.input, 'function', '슬라이더 input 이 안 걸렸다');
    assert.equal(typeof slider._h.change, 'function', '슬라이더 change 가 안 걸렸다');
    assert.equal(typeof number._h.change, 'function', '숫자칸 change 가 안 걸렸다');
    slider.value = '60'; slider._h.input();
    assert.equal(host.dataset.redact, '60');
    assert.equal(String(number.value), '60', '숫자칸이 안 따라왔다');
    assert.deepEqual(log, [], 'input 에서 히스토리를 찍었다(드래그마다 칸이 쌓인다)');
    slider._h.change();
    assert.deepEqual(log, [['commit', 60], ['push', '60']], 'change: 적용 «뒤» 찍어야 한다(push-after)');
    log.length = 0;
    number.value = '-3'; number._h.change();
    assert.ok(!('redact' in host.dataset), '숫자칸 음수 → 0(끔) 이어야 한다');
    assert.equal(String(slider.value), '0');
    assert.equal(String(number.value), '0', '숫자칸이 걸러진 값으로 안 돌아왔다');
    assert.deepEqual(log, [['commit', 0], ['push', null]]);
  } finally {
    delete globalThis.window;
  }
});

test('U5 배선 자리 — 패널·제거·스크래치·h2c·CSS·Figma', () => {
  /* ★2026-10-26 1012t1C1(이동) — 에셋 블러의 입구는 따로 절이 아니라 «Effects 드롭다운의 「블러」»다(js/effects-blur.js).
     ⇒ 옛 기대(「그레인 아래 · Effects 위」 따로 절 + prop-asset 의 wireRedactSection)를 «옛 절 0 + 명부 식구»로 바꿨다.
     ⛔약하게 만든 것이 아니다 — 같은 자리(prop-asset)를 «없어야 한다»로 재고, 새 입구를 따로 잰다. */
  const asset = readSrc(ROOT, 'js', 'props', 'prop-asset.js');
  const iGrain = asset.indexOf('id="asset-grain-number"');
  const iFx = asset.indexOf("window.fxSectionHtml?.(ab, 'asset')");
  assert.ok(iGrain > 0 && iFx > 0, `하네스가 늙었다 — 자리를 못 찾았다 grain ${iGrain} fx ${iFx}`);
  assert.ok(iGrain < iFx, 'Effects 절이 그레인 아래가 아니다');
  assert.doesNotMatch(asset, /redactSectionHTML|wireRedactSection/, '옛 «블러 (Redact)» 따로 절이 prop-asset 에 남았다(두 곳)');
  const fxb = readSrc(ROOT, 'js', 'effects-blur.js');
  assert.match(fxb, /registerFxType\(\{\s*key: 'blur',\s*label: '블러',/, '명부 식구 「블러」 가 없다');
  assert.match(fxb, /import \{ applyRedact, readRedact, normalizeRedact \} from '\.\/effects\/image-redact\.js'/, '블러 카드가 공용 모듈(같은 저장 키)을 안 쓴다');
  assert.match(fxb, /supports: \(el\) => !!\(el && el\.classList && el\.classList\.contains\('asset-block'\) && el\.classList\.contains\('has-image'\)\)/, '대상이 «그림 든 에셋»이 아니다');
  const idx = readSrc(ROOT, 'index.html');
  const iReg = idx.indexOf('<script type="module" src="js/effects-registry.js">');
  const iBlur = idx.indexOf('<script type="module" src="js/effects-blur.js">');
  assert.ok(iReg > 0 && iBlur > iReg, 'index.html 이 effects-blur.js 를 명부 뒤에 안 싣는다');

  const ih = readSrc(ROOT, 'js', 'image-handling.js');
  const clr = ih.slice(ih.indexOf('function clearAssetImage(ab)'), ih.indexOf('ab.innerHTML = `', ih.indexOf('function clearAssetImage(ab)')));
  assert.ok(clr.length > 50, '하네스가 늙었다 — clearAssetImage 를 못 찾았다');
  assert.match(clr, /applyRedact\(ab, 0\)/, '이미지 제거가 블러를 안 걷는다 — 다음 그림이 말없이 흐려진다');
  assert.match(clr, /delete ab\.dataset\.redactOff;/, '이미지 제거가 «눈 끈 블러»(redactOff)를 안 걷는다 — 다음 그림에 끈 블러 카드가 붙는다(1012t1C1 이동)');
  assert.match(ih, /const ASSET_FX_DS_KEYS = \[[^\]]*'redact'[^\]]*\]/, '스크래치 이동이 블러를 안 담는다');
  assert.match(ih, /if \(ds\.redact != null\) applyRedact\(ab, ds\.redact\)/, '되얹을 때 변수까지 쓰지 않는다');

  const cs = readSrc(ROOT, 'js', 'io', 'capture-safety.js');
  assert.match(cs, /import \{ REDACT_HOST_SEL \} from '\.\.\/effects\/image-redact\.js'/);
  const fn = cs.slice(cs.indexOf('export function neutralizeRedactForH2C'), cs.indexOf('/* 0918r2 textgrad'));
  assert.match(fn, /querySelectorAll\(REDACT_HOST_SEL\)/);
  assert.match(fn, /removeAttribute\('src'\)/);
  assert.match(fn, /box\.style\.backgroundColor = REDACT_OPAQUE_FILL/, '덮개 색이 기존 상수가 아니다(새 리터럴 금지)');
  assert.equal((fn.match(/#4a4a4a/gi) || []).length, 0, '함수 안에 회색 리터럴을 새로 박았다');

  const css = readSrc(ROOT, 'css', 'editor-layout.css');
  /* ★2026-10-13 — 에셋 블러는 그림 «자신»의 filter(뒤 막 backdrop 은 배율 >100% 에서 가장자리가 샜다) */
  const rule = css.match(/\.asset-block\[data-redact\] > \.asset-img-clip > :is\(\.asset-img, canvas\) \{([^}]*)\}/);
  assert.ok(rule, '블러 바닥 CSS 규칙이 없다');
  assert.match(rule[1], /\n\s*filter: blur\(var\(--redact-blur, 8px\)\);/);
  const grow = css.match(/\.asset-block\[data-redact\]:not\(\[data-img-w\]\):not\(\[data-clip-content="false"\]\) > \.asset-img-clip > :is\(\.asset-img, canvas\) \{([^}]*)\}/);
  assert.ok(grow, '흐림 가장자리 3σ 키우기 규칙이 없다');
  assert.match(grow[1], /margin: calc\(-3 \* var\(--redact-blur, 8px\)\);/);
  assert.match(grow[1], /width: calc\(100% \+ 6 \* var\(--redact-blur, 8px\)\);/);
  assert.doesNotMatch(css, /\.asset-block\[data-redact\] > \.asset-img-clip::after/, '옛 뒤 막(::after backdrop) 규칙이 남았다 — 배율 >100% 누출');
  /* 색보정의 인라인 filter 쓰기는 합성 한 자리(writeImgFilter)로만 */
  const ica = readSrc(ROOT, 'js', 'image-color-adjust.js');
  assert.match(ica, /import \{ writeImgFilter \} from '\.\/effects\/image-redact\.js'/);
  assert.equal((ica.match(/\.style\.filter\s*=/g) || []).length, 0, '색보정이 인라인 filter 를 직접 쓴다 — 블러를 지운다');
  const sl = readSrc(ROOT, 'js', 'io', 'save-load.js');
  assert.match(sl, /window\.recomposeImageRedact\(ab\)/, '되돌리기/불러오기 뒤 블러 합성이 없다');

  const fj = readSrc(ROOT, 'js', 'io', 'export-figma-json.js');
  assert.match(fj, /function _imageRedactField\(el\)[\s\S]{0,200}cover: _REDACT_COVER/, 'Figma 덮개가 기존 상수가 아니다');
  assert.match(fj, /return redact \? \{ src: null, redact \} : \{\};/, 'Figma 이미지 블럭이 원본 src 를 그대로 싣는다');
  const rr = readSrc(ROOT, 'figma-renderer', 'sangpe_to_figma.mjs');
  assert.match(rr, /if \(block\.redact\) \{[\s\S]{0,300}set_fill_color', \{ nodeId: node\.id, color: hex\(block\.redact\.cover\) \}/);
});

test('U6 writeImgFilter — 색보정 몫 + 블러 몫 합성 · 호스트 상태에서 블러를 읽는다 · 비교 칸·카드는 블러 0', () => {
  const mkEl = (hostClass, hostDs = {}) => {
    const host = { classList: { contains: (c) => c === hostClass }, dataset: hostDs };
    const clip = { classList: { contains: (c) => c === 'asset-img-clip' }, parentElement: host };
    let f = '';
    return { host, el: { parentElement: clip, style: { get filter() { return f; }, set filter(v) { f = v; } } } };
  };
  const { host, el } = mkEl('asset-block', { redact: '60' });
  R.writeImgFilter(el, 'url(#img-color-adj-1)');
  assert.equal(el.style.filter, 'url(#img-color-adj-1) blur(12px)');
  /* 호출자가 블러를 품은 문자열을 줘도 블러 몫은 «상태»에서만 — 중복·옛 값 0 */
  R.writeImgFilter(el, 'url(#img-color-adj-1) blur(3px)');
  assert.equal(el.style.filter, 'url(#img-color-adj-1) blur(12px)');
  assert.equal(R.adjFilterPart(el), 'url(#img-color-adj-1)');
  /* 색보정 끔 — 블러 몫은 남는다 */
  R.writeImgFilter(el, '');
  assert.equal(el.style.filter, 'blur(12px)');
  /* 블러 끔(상태) → 합성 → 색보정 몫만 */
  el.style.filter = 'url(#a) blur(12px)';
  delete host.dataset.redact;
  R.composeImgFilter(el);
  assert.equal(el.style.filter, 'url(#a)');
  /* 에셋 클립 밖(카드 배경 div · 비교 칸) — 블러를 안 붙인다 */
  const card = { parentElement: { classList: { contains: () => false } }, style: { filter: '' } };
  R.writeImgFilter(card, 'url(#c)');
  assert.equal(card.style.filter, 'url(#c)');
  const cmp = mkEl('cmp-row', { redact: '60' });
  R.writeImgFilter(cmp.el, '');
  assert.equal(cmp.el.style.filter, '', '비교 칸엔 블러 몫을 붙이지 않는다(그 칸은 CSS 막이 흐린다)');
});
