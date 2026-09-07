/* 단위 하네스 — goya-asset:// «결함군» 을 한 번에 닫은 세 자리 + 공용 변환 문
 * 실행: node --test tests/unit/*.test.js tests/unit/*.test.mjs
 *
 * ■ 병(하나다, 세 번 나타났을 뿐):
 *   v0.8.0 이미지 외부화 이후 이미지 src 는 `goya-asset://<projectId>/<hash>.<ext>` 다.
 *   렌더러는 file:// origin 이라 이 커스텀 스킴은 **cross-origin** 이고 그래서
 *     · `<canvas>` 에 그리면 오염 → `toDataURL()` 이 SecurityError 를 던지고
 *     · services 의 base64 파서 `/^data:([^;]+);base64,(.+)$/` 는 «거절»한다.
 *   발견될 때마다 한 자리씩 고쳐 왔다: 슬라이스(2026-09-03)·색보정·AI 텍스트채우기.
 *   여기서 닫는 셋 —
 *     ⑴ ai-image-gen.js  스크래치 참조 수집 (refs.push)
 *     ⑵ ai-image-gen.js  에셋블록 참조 수집 (.asset-img 의 src)
 *     ⑶ ai-image-gen.js  _composeOutpaintPayload → cv1.toDataURL
 *
 * ■ ⑴⑵ 가 «오늘 고친 것보다 나쁜» 이유:
 *   변환 없이 넘기면 services/imageGenService.js 의 `if (!p) continue;`(:47) /
 *   `if (!p) return;`(:114) 가 그 참조를 **조용히 버린다**. 사용자는 결과물을 받으므로
 *   «참조가 빠진 줄도 모른다». 그래서 여기 검사는 «변환했나» 뿐 아니라
 *   «못 하면 사용자에게 보이게 알리나»(R4) 까지 잰다.
 *
 * ■ 이 파일이 «진짜로 태우는 것»과 «문자열로만 재는 것»을 구분해 읽어라:
 *   ⓐ 동작 — goya-asset-inline.js 의 goyaAssetToDrawableSrc 를 tmp .mjs 사본으로
 *      **실제 실행**한다(package.json 이 "type":"commonjs" 라 js/**.js 를 직접 못 읽는다.
 *      aifill-goya-asset.test.js 와 같은 수법).
 *   ⓑ 구조 — ai-image-gen.js 의 세 구간을 문자열로 잘라 판정한다. ★양성대조(고치기 전
 *      «역사 문자열»)로 판정기가 죽지 않았음을 스스로 보인다.
 *   ⓒ 울타리 — ⛔picker UI 넷은 «고치면 퇴행»이다. 그 자리가 변환을 타면 빨강.
 *   ⓓ 배선 — index.html 의 <script type="module">. 이게 빠지면 import 가 죽어
 *      ai-image-gen.js 가 통째로 안 돈다(AI 이미지 모달 전멸).
 *
 * ⛔★이 검사가 «못 잡는 것» (적대검수와 같은 한계 — aifill-goya-asset.test.js 참조):
 *   ⓑ 계열은 토큰을 보는 문자열 판정이라, 토큰은 남기고 결과만 버리는 «영리한 사보타주»
 *   (예: 변환 결과를 다른 변수에 받고 원본을 push)는 못 잡는다. ⓑ 가 «확실히» 잡는 변이는
 *   「그 구간을 통째로 옛 코드로 되돌리기」다. ⓐ 만이 실행으로 잰 것이다.
 *
 * ⚠️소스 읽기는 «반드시» _srcread.js 의 readSrc() 를 탄다(CRLF 체크아웃 대비).
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { readSrc } = require('./_srcread.js');
const { mkTmpRoot } = require('./_tmproot.js');

const ROOT = path.resolve(__dirname, '../..');
const AIG = readSrc(ROOT, 'js', 'ai-image-gen.js');
const INLINE = readSrc(ROOT, 'js', 'io', 'goya-asset-inline.js');
const HTML = readSrc(ROOT, 'index.html');

/* ── 구간 잘라내기 — 못 찾으면 «건너뛰지 않고» 던진다(못 잰 검사는 통과가 아니다) ── */
function slice(src, startAnchor, endAnchor, label) {
  const a = src.indexOf(startAnchor);
  assert.ok(a !== -1, `${label}: 앵커 없음 «${startAnchor}» — 검사가 대상을 못 찾았다(리네임됐나?)`);
  const b = src.indexOf(endAnchor, a + startAnchor.length);
  assert.ok(b !== -1, `${label}: 끝 앵커 없음 «${endAnchor}»`);
  return src.slice(a, b);
}

const REFS_A = '// ref 이미지 src 수집';
const REFS_B = 'if (!window.electronAPI?.aiGenerateImage)';
const COMPOSE_A = 'async function _composeOutpaintPayload(box) {';
const COMPOSE_B = "const imageDataUrl = cv1.toDataURL('image/png');";
const SUBMIT_A = 'let outpaint = null;';
const SUBMIT_B = "const scratchIds = _pickerChips.filter(c => c.type === 'scratch')";
const PICKER_A = 'function _openScratchPopover(anchorBtn) {';
const PICKER_B = 'function _addReferenceFiles(fileList) {';

const refsRegion    = () => slice(AIG, REFS_A, REFS_B, '⑴⑵ refs 수집');
const composeRegion = () => slice(AIG, COMPOSE_A, COMPOSE_B, '⑶ outpaint 합성');
const submitRegion  = () => slice(AIG, SUBMIT_A, SUBMIT_B, '⑶ 호출부');
const pickerRegion  = () => slice(AIG, PICKER_A, PICKER_B, '⛔picker UI');

/* ── 판정기 ── 실제 소스와 «고치기 전» 소스에 «같은» 판정을 쓴다 ─────────────────
 * ★판정 «전»에 줄주석을 걷어낸다. 두 방향으로 필요하다:
 *   · 오탐 — 이 수정이 남긴 설명 주석에 `?? alert(` 같은 «금지 문구»가 들어있다(R5 가 오발).
 *   · 미탐 — 주석에 토큰만 적어두고 실제 코드는 안 고치는 위장을 막는다.
 * ⚠️한계: `'https://…'` 처럼 문자열 안의 `//` 는 «앞 글자가 `:` 가 아닐 때만» 자른다.
 *   위 네 구간에 그런 문자열은 없다(있게 되면 이 자를 먼저 고쳐라). 블록주석은 안 건드린다.
 * ───────────────────────────────────────────────────────────────── */
function stripLineComments(src) {
  return String(src).split('\n').map(l => l.replace(/(^|[^:])\/\/.*$/, '$1')).join('\n');
}

/** ⑴⑵ refs 수집 구간 → 위반 목록(빈 배열 = 통과) */
function judgeRefs(region0) {
  const region = stripLineComments(region0);
  const bad = [];
  if (!/isGoyaAssetUrl\s*\(/.test(region)) bad.push('R1 goya-asset 여부를 판별하지 않는다');
  if ((region.match(/await\s+goyaAssetToDrawableSrc\s*\(/g) || []).length < 2) {
    bad.push('R2 스크래치·에셋블록 «둘 다»에서 변환(await)하지 않는다');
  }
  if (/refs\.push\(\s*\{\s*src:\s*it\.src\b/.test(region)) bad.push('R3a 스크래치 src 를 «그대로» 넣는다');
  if (/if\s*\(src\)\s*refs\.push\(\s*\{\s*src,\s*label:\s*aid\s*\}\s*\)/.test(region)) {
    bad.push('R3b 에셋블록 src 를 «그대로» 넣는다');
  }
  if (!/refFailed/.test(region) || !/showToast/.test(region)) {
    bad.push('R4 변환 실패를 사용자에게 보이는 신호로 남기지 않는다 (조용히 버린다)');
  }
  if (/\?\?\s*alert\s*\(/.test(region)) {
    bad.push('R5 `?? alert(` — showToast 가 undefined 를 반환해 렌더러를 얼린다');
  }
  return bad;
}

/** ⑶ 합성 함수 구간 — drawImage/toDataURL 전에 변환을 태우나 */
function judgeCompose(region0) {
  const region = stripLineComments(region0);
  const bad = [];
  if (!/await\s+goyaAssetToDrawableSrc\s*\(\s*box\.src\s*\)/.test(region)) {
    bad.push('R6 box.src 를 그리기 «전» 변환하지 않는다 → cv1.toDataURL 이 SecurityError');
  }
  if (!/if\s*\(!src\)\s*return null/.test(region)) {
    bad.push('R7 변환 실패에 null 을 돌려 호출부가 알릴 기회를 주지 않는다');
  }
  const cvt = region.indexOf('goyaAssetToDrawableSrc');
  const draw = region.indexOf('ctx1.drawImage');
  if (cvt === -1 || draw === -1 || cvt > draw) bad.push('R8 변환이 drawImage «뒤»에 있다(순서가 뒤집혔다)');
  return bad;
}

/** ⑶ 호출부 — 예외가 핸들러를 뚫고 나가지 않나 */
function judgeSubmit(region0) {
  const region = stripLineComments(region0);
  const bad = [];
  const call = region.indexOf('_composeOutpaintPayload(box)');
  if (call === -1) { bad.push('R9 합성 호출을 못 찾았다'); return bad; }
  const tryIdx = region.lastIndexOf('try {', call);
  const catchIdx = region.indexOf('catch', call);
  if (tryIdx === -1 || catchIdx === -1) {
    bad.push('R9 합성 호출이 try/catch «밖»이다 — 예외가 뚫고 나가 토스트도 스피너도 없이 「아무 일 없음」');
  }
  if (!/showToast/.test(region)) bad.push('R10 실패를 사용자에게 알리지 않는다');
  if (/\?\?\s*alert\s*\(/.test(region)) bad.push('R5 `?? alert(` 금지');
  return bad;
}

/* ── 고치기 전(dev c99a593) 그대로의 «역사 문자열» — 양성대조용. 다시 바뀌지 않는다. ── */
const PRE_FIX_REFS = [
  '// ref 이미지 src 수집',
  '    const refs = [];',
  '    for (const sid of (inputs.scratchIds || [])) {',
  '      const it = window._scratchGetItemById?.(sid);',
  '      if (it?.src) refs.push({ src: it.src, label: sid });',
  '    }',
  '    for (const aid of (inputs.assetBlockIds || [])) {',
  '      const el = document.getElementById(aid);',
  "      const src = el?.querySelector('.asset-img')?.src || el?.dataset?.imgSrc;",
  '      if (src) refs.push({ src, label: aid });',
  '    }',
  '    for (const r of (inputs.refDataUrls || [])) {',
  "      if (r?.src) refs.push({ src: r.src, label: r.label || 'ref' });",
  '    }',
  '',
  '    ',
].join('\n');

const PRE_FIX_COMPOSE = [
  'async function _composeOutpaintPayload(box) {',
  '    if (!box?.src) return null;',
  '    const { src, padTop, padRight, padBottom, padLeft } = box;',
  '    // origW/H는 box의 값이 아니라 현재 자연 이미지 크기 사용 — 합성 정확도',
  '    const img = await new Promise((resolve, reject) => {',
  '      const i = new Image();',
  '      i.onload = () => resolve(i);',
  '      i.onerror = reject;',
  '      i.src = src;',
  '    });',
  '    const ow = img.naturalWidth;',
  '    const oh = img.naturalHeight;',
  '    const scale = box.origW > 0 ? ow / box.origW : 1;',
  '    const pt = Math.round(padTop * scale);',
  '    const pr = Math.round(padRight * scale);',
  '    const pb = Math.round(padBottom * scale);',
  '    const pl = Math.round(padLeft * scale);',
  '    const w = ow + pl + pr;',
  '    const h = oh + pt + pb;',
  "    const cv1 = document.createElement('canvas');",
  '    cv1.width = w; cv1.height = h;',
  "    const ctx1 = cv1.getContext('2d');",
  '    ctx1.drawImage(img, pl, pt);',
  '    ',
].join('\n');

const PRE_FIX_SUBMIT = [
  'let outpaint = null;',
  '    if (isOutpaint) {',
  '      const box = window._outpaintGetBox?.();',
  "      if (!box) { window.showToast?.('⚠️ 확장 박스 없음'); return; }",
  '      const sumPad = box.padTop + box.padRight + box.padBottom + box.padLeft;',
  "      if (sumPad === 0) { window.showToast?.('⚠️ 확장 영역이 0 — 핸들로 늘려주세요'); return; }",
  '      outpaint = await _composeOutpaintPayload(box);',
  "      if (!outpaint) { window.showToast?.('⚠️ outpaint 합성 실패'); return; }",
  '    }',
  '',
  '    ',
].join('\n');

/* ══════════ ⓐ 동작 — 공용 변환 문을 «진짜로» 태운다 ══════════ */

const SRC_MOD = path.resolve(ROOT, 'js/io/goya-asset-inline.js');
let _modP = null;
function loadMod() {
  if (!_modP) {
    const dir = mkTmpRoot('goya-family-');
    const mjs = path.join(dir, 'goya-asset-inline.mjs');
    fs.copyFileSync(SRC_MOD, mjs);
    _modP = import(pathToFileURL(mjs).href);
  }
  return _modP;
}

const ASSET_URL = 'goya-asset://proj1/aaaaaaaaaaaaaaaa.png';
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
/** services 의 «그» 정규식 — 참조를 조용히 버리게 만든 문지기(imageGenService.js:31). */
const SERVICE_RE = /^data:([^;]+);base64,(.+)$/;

function withWindow(api, fn) {
  const had = Object.prototype.hasOwnProperty.call(globalThis, 'window');
  const prev = globalThis.window;
  globalThis.window = { electronAPI: api };
  try { return fn(); }
  finally { if (had) globalThis.window = prev; else delete globalThis.window; }
}

test('ⓐ-1 공용 문이 존재하고 export 된다', async () => {
  const mod = await loadMod();
  assert.equal(typeof mod.goyaAssetToDrawableSrc, 'function');
});

test('ⓐ-2 goya-asset → data URI (그리고 그 결과는 services 파서를 통과한다)', async () => {
  const { goyaAssetToDrawableSrc } = await loadMod();
  const seen = [];
  const out = await goyaAssetToDrawableSrc(ASSET_URL, async (pid, fn) => {
    seen.push(`${pid}/${fn}`); return PNG;
  });
  assert.deepEqual(seen, ['proj1/aaaaaaaaaaaaaaaa.png']);
  assert.equal(out, PNG);
  assert.equal(SERVICE_RE.test(out), true);
  // 대조 — 변환 «안 한» 원본은 그 파서를 못 통과한다(그게 조용히 버려지던 정체)
  assert.equal(SERVICE_RE.test(ASSET_URL), false);
});

test('ⓐ-3 비-goya src(data:/http/blob:)는 «그대로» 통과한다 — 손대지 않는다', async () => {
  const { goyaAssetToDrawableSrc } = await loadMod();
  const never = async () => { throw new Error('reader 를 부르면 안 된다'); };
  assert.equal(await goyaAssetToDrawableSrc(PNG, never), PNG);
  assert.equal(await goyaAssetToDrawableSrc('https://x/y.png', never), 'https://x/y.png');
  assert.equal(await goyaAssetToDrawableSrc('blob:abc', never), 'blob:abc');
});

test('ⓐ-4 ★실패는 «null» 이다 — 원본으로 조용히 갈아끼우지 않는다', async () => {
  const { goyaAssetToDrawableSrc } = await loadMod();
  // reader 가 null (읽기 실패)
  assert.equal(await goyaAssetToDrawableSrc(ASSET_URL, async () => null), null);
  // reader 가 data: 아닌 것을 돌려줌
  assert.equal(await goyaAssetToDrawableSrc(ASSET_URL, async () => 'nope'), null);
  // reader 가 던짐 → 던져 나오지 않고 null (호출부가 «빼고 알릴» 수 있게)
  assert.equal(await goyaAssetToDrawableSrc(ASSET_URL, async () => { throw new Error('EIO'); }), null);
  // 빈 입력
  assert.equal(await goyaAssetToDrawableSrc('', async () => PNG), null);
  assert.equal(await goyaAssetToDrawableSrc(null, async () => PNG), null);
});

test('ⓐ-5 reader 미주입이면 electronAPI 를 쓰고, 웹(IPC 없음)은 null 이다', async () => {
  const { goyaAssetToDrawableSrc } = await loadMod();
  const ok = await withWindow(
    { assetsReadAsDataUri: async () => ({ ok: true, dataUri: PNG }) },
    async () => goyaAssetToDrawableSrc(ASSET_URL)
  );
  assert.equal(ok, PNG);
  const failed = await withWindow(
    { assetsReadAsDataUri: async () => ({ ok: false, error: 'ENOENT' }) },
    async () => goyaAssetToDrawableSrc(ASSET_URL)
  );
  assert.equal(failed, null);
  // 웹 — preload 없음
  assert.equal(await withWindow({}, async () => goyaAssetToDrawableSrc(ASSET_URL)), null);
});

/* ══════════ ⓑ 구조 — 세 자리가 그 문을 탄다 ══════════ */

test('ⓑ-1 ⑴⑵ 참조 수집은 goya-asset 을 되돌린 «뒤» 싣고, 실패는 보이게 알린다', () => {
  const bad = judgeRefs(refsRegion());
  assert.deepEqual(bad, [], '위반: ' + bad.join(' / '));
});

test('ⓑ-2 ⑶ 합성은 그리기 «전» 변환한다 (toDataURL SecurityError 차단)', () => {
  const bad = judgeCompose(composeRegion());
  assert.deepEqual(bad, [], '위반: ' + bad.join(' / '));
});

test('ⓑ-3 ⑶ 호출부는 예외를 잡아 토스트를 띄운다 (「눌렀는데 아무 일 없음」 차단)', () => {
  const bad = judgeSubmit(submitRegion());
  assert.deepEqual(bad, [], '위반: ' + bad.join(' / '));
});

test('ⓑ-4 변환 도구를 새로 만들지 않고 goya-asset-inline.js 것을 쓴다', () => {
  assert.match(
    AIG,
    /import\s*\{[^}]*\bisGoyaAssetUrl\b[^}]*\bgoyaAssetToDrawableSrc\b[^}]*\}\s*from\s*'\.\/io\/goya-asset-inline\.js'/,
    'goya-asset-inline.js 에서 가져와야 한다(재구현 금지)'
  );
  assert.equal(
    /assetsReadAsDataUri/.test(AIG), false,
    'ai-image-gen.js 가 IPC 를 직접 부른다 = 세 번째 복붙 변환기가 생겼다'
  );
  assert.match(INLINE, /\bgoyaAssetToDrawableSrc,\n\s*inlineGoyaAssetsInJSON/, '공용 문이 export 목록에 없다');
});

test('ⓑ-5 ★양성대조 — 세 구간을 «고치기 전»으로 되돌리면 판정이 전부 빨강이다', () => {
  const revert = (src, a, b, pre) => {
    const i = src.indexOf(a), j = src.indexOf(b, i + a.length);
    return src.slice(0, i) + pre + src.slice(j);
  };
  const old1 = revert(AIG, REFS_A, REFS_B, PRE_FIX_REFS);
  const bad1 = judgeRefs(slice(old1, REFS_A, REFS_B, '역사 refs'));
  assert.ok(bad1.length > 0, '양성대조 초록 — judgeRefs 는 장식이다');
  for (const r of ['R1', 'R2', 'R3a', 'R3b', 'R4']) {
    assert.ok(bad1.some(x => x.startsWith(r)), `${r} 이 결함을 못 잡는다: ${bad1.join(' / ')}`);
  }

  const old2 = revert(AIG, COMPOSE_A, COMPOSE_B, PRE_FIX_COMPOSE);
  const bad2 = judgeCompose(slice(old2, COMPOSE_A, COMPOSE_B, '역사 compose'));
  assert.ok(bad2.length > 0, '양성대조 초록 — judgeCompose 는 장식이다');
  for (const r of ['R6', 'R7', 'R8']) {
    assert.ok(bad2.some(x => x.startsWith(r)), `${r} 이 결함을 못 잡는다: ${bad2.join(' / ')}`);
  }

  const old3 = revert(AIG, SUBMIT_A, SUBMIT_B, PRE_FIX_SUBMIT);
  const bad3 = judgeSubmit(slice(old3, SUBMIT_A, SUBMIT_B, '역사 submit'));
  assert.ok(bad3.some(x => x.startsWith('R9')), `R9 이 결함을 못 잡는다: ${bad3.join(' / ')}`);
});

/* ══════════ ⓒ 울타리 — ⛔picker UI 는 «고치면 퇴행» ══════════ */

test('ⓒ-1 ⛔picker UI 는 변환을 «타면 안 된다» — 무늬가 같다고 처분이 같지 않다', () => {
  const region = stripLineComments(pickerRegion());
  // 왜 여기는 그냥 둬야 하나:
  //   `cell.style.backgroundImage = url("…")` 는 CSS 렌더다. main.js:7 의
  //   registerSchemesAsPrivileged([{ standard:true, secure:true, supportFetchAPI:true }]) 덕분에
  //   goya-asset 은 «화면에 잘 그려진다». 캔버스 오염/네트워크 전송만 문제다.
  //   여기서 IPC 로 base64 를 읽어오면 popover 가 이미지 수만큼 느려지고(동기 렌더가 async 가 됨)
  //   메모리도 base64 로 부풀어 퇴행이다.
  assert.equal(
    /goyaAssetToDrawableSrc/.test(region), false,
    '⛔picker UI(_openScratchPopover/_openAssetPopover)가 변환을 탄다 = 퇴행. ' +
    'CSS 렌더는 goya-asset 을 그대로 그린다(main.js registerSchemesAsPrivileged). ' +
    '「형제니까」로 고치지 마라 — 판정은 한 건씩.'
  );
  assert.equal(
    (region.match(/backgroundImage = `url\("\$\{it\.src\}"\)`/g) || []).length, 2,
    'picker 두 곳의 CSS 렌더 형태가 바뀌었다 — 의도한 것인지 다시 판정해라'
  );
  // main.js 의 «근거» 가 살아있는지도 같이 본다. 이게 빠지면 위 판단의 전제가 무너진다.
  const MAIN = readSrc(ROOT, 'main.js');
  assert.match(MAIN, /registerSchemesAsPrivileged/, 'goya-asset 스킴 특권 등록이 사라졌다 — picker 전제가 무너진다');
});

/* ══════════ ⓓ 배선 — 모듈로 로드되지 않으면 파일이 통째로 죽는다 ══════════ */

/* ★전례(«쟀다»가 아니라 «레포가 이미 그렇게 돌고 있다»):
 *   main.js 는 loadFile(=file:// origin)인데도 js/editor.js·js/history.js·js/scratch-pad.js·
 *   js/ai-section-fill.js 등 ~40개가 이미 <script type="module"> 이다. 그 중 editor.js 는
 *   선택·줌·단축키라 «안 돌면 앱이 안 쓰인다». 즉 이 Electron 설정에서 모듈 로드는 실증돼 있다
 *   (main.js 에 appendSwitch·webSecurity 조작은 0건 — 실측). */
test('ⓓ-1 index.html 이 ai-image-gen.js 를 <script type="module"> 로 싣는다', () => {
  assert.match(
    HTML,
    /<script type="module" src="js\/ai-image-gen\.js"><\/script>/,
    'type="module" 이 빠지면 최상단 import 가 SyntaxError 로 죽어 ai-image-gen.js 가 «한 줄도» 안 돈다 ' +
    '(AI 이미지 모달 전멸). import 를 쓰는 한 이 태그는 module 이어야 한다.'
  );
  // classic 으로 되돌아간 흔적이 남아있지 않은지
  assert.equal(/<script src="js\/ai-image-gen\.js">/.test(HTML), false);
});
