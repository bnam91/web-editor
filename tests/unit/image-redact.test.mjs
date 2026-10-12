/* image-redact.test.mjs — 이미지 «블러 (Redact)» 공용 모듈(js/effects/image-redact.js)과 그 배선 자리를 잰다 (1012t1 C1)
 *
 * ★하네스 — 모듈은 import 0 이라 .mjs 사본으로 싣는다(package type=commonjs · ai-text-slots-ssot 와 같은 수법).
 * ★잠그는 것
 *   U1 redactPx/normalizeRedact 눈금(0..100 → 0..20px · 걸러내기)
 *   U2 applyRedact 멱등 · 0 이면 흔적 0(속성·변수 둘 다) — D4 컴패리전이 매 렌더 부르는 계약
 *   U3 redactSectionHTML 꼴(그레인 절과 같은 클래스 · 인라인 style 0)
 *   U4 wireRedactSection — input=라이브, change=적용 «뒤» pushHistory(push-after), onCommit 문
 *   U5 배선 자리(소스): prop-asset 절 위치 · clearAssetImage 끔 · ASSET_FX_DS_KEYS · capture-safety 명부 · CSS 규칙 · Figma 덮개
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
  const asset = readSrc(ROOT, 'js', 'props', 'prop-asset.js');
  const iGrain = asset.indexOf('id="asset-grain-number"');
  const iRedact = asset.indexOf("redactSectionHTML({ idPrefix: 'asset'");
  const iFx = asset.indexOf("window.fxSectionHtml?.(ab, 'asset')");
  assert.ok(iGrain > 0 && iRedact > 0 && iFx > 0, `하네스가 늙었다 — 자리를 못 찾았다 grain ${iGrain} redact ${iRedact} fx ${iFx}`);
  assert.ok(iGrain < iRedact && iRedact < iFx, '블러 절이 «그레인 아래 · Effects 위»가 아니다');
  assert.match(asset, /if \(hasImage\) wireRedactSection\(\{ idPrefix: 'asset', getHost: \(\) => ab \}\)/);

  const ih = readSrc(ROOT, 'js', 'image-handling.js');
  const clr = ih.slice(ih.indexOf('function clearAssetImage(ab)'), ih.indexOf('ab.innerHTML = `', ih.indexOf('function clearAssetImage(ab)')));
  assert.ok(clr.length > 50, '하네스가 늙었다 — clearAssetImage 를 못 찾았다');
  assert.match(clr, /applyRedact\(ab, 0\)/, '이미지 제거가 블러를 안 걷는다 — 다음 그림이 말없이 흐려진다');
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
  const rule = css.match(/\.asset-block\[data-redact\] > \.asset-img-clip::after \{([^}]*)\}/);
  assert.ok(rule, '블러 CSS 규칙이 없다');
  assert.match(rule[1], /\n\s*backdrop-filter: blur\(var\(--redact-blur, 8px\)\);/);
  assert.match(rule[1], /-webkit-backdrop-filter: blur\(var\(--redact-blur, 8px\)\);/);
  assert.match(rule[1], /content: '';/);
  assert.match(rule[1], /pointer-events: none;/);

  const fj = readSrc(ROOT, 'js', 'io', 'export-figma-json.js');
  assert.match(fj, /function _imageRedactField\(el\)[\s\S]{0,200}cover: _REDACT_COVER/, 'Figma 덮개가 기존 상수가 아니다');
  assert.match(fj, /return redact \? \{ src: null, redact \} : \{\};/, 'Figma 이미지 블럭이 원본 src 를 그대로 싣는다');
  const rr = readSrc(ROOT, 'figma-renderer', 'sangpe_to_figma.mjs');
  assert.match(rr, /if \(block\.redact\) \{[\s\S]{0,300}set_fill_color', \{ nodeId: node\.id, color: hex\(block\.redact\.cover\) \}/);
});
