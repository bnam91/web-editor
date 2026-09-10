/* 단위 하네스 — 「AI 텍스트 채우기」 스크래치 토큰(#sp_xxxxxx) 첨부의 goya-asset 재인라인
 * 실행: node --test tests/unit/*.test.js tests/unit/*.test.mjs
 *
 * ★재현 조건(다음 사람이 알아야 할 것) — 「저장 전엔 되고 저장 후엔 안 됐다」:
 *   ① 스크래치 패드 이미지의 src 는 붙여넣은 «직후엔» base64 data URL 이다.
 *   ② 프로젝트를 한 번 저장하면 externalizeScratchpad(js/scratch-pad.js:95~98)가
 *      그 이미지를 `goya-asset://<projectId>/<hash>.<ext>` 로 «외부화»한다.
 *   ③ 그 뒤 프롬프트에 #sp_xxxxxx 를 넣으면 ai-section-fill.js 가 그 goya-asset URL 을
 *      «형식 검사도 변환도 없이» imageDataUrls 로 넘겼고,
 *      services/geminiService.js:151 의 /^data:([^;]+);base64,(.+)$/ 가 거절해
 *      「이미지 dataURL 형식 오류」가 났다.
 *
 * 이 파일은 둘을 잰다:
 *   ⓐ 구조 — 첨부 «마지막 문»에서 변환이 실제로 일어나는가 (+★양성대조: 고치기 전 코드로
 *      같은 판정을 돌려 «빨강»이 나오는지를 검사 스스로 확인한다).
 *   ⓑ 동작 — goya-asset-inline.js 의 reader 가 만든 결과가 geminiService 의 «그 정규식»을
 *      통과하는가 (+ 원본 goya-asset URL 은 통과 못 하는가 = 그 정규식이 진짜 문지기인지).
 *
 * ⚠️소스를 문자열로 자르는 검사이므로 읽기는 «반드시» _srcread.js 의 readSrc() 를 탄다
 *   (CRLF 체크아웃에서 검사 파일이 통째로 안 도는 것을 막는다 — win-portability ①-3).
 *
 * ⛔★★이 검사가 «못 잡는 것» — 적대검수(2026-09-07)가 «재서» 확인한 것이다. 지우지 마라.
 *   사보타주 둘을 만들어 돌렸더니 **현빈이 신고한 버그를 100% 되살리는데도 이 검사(그리고 전체
 *   1439건)가 «전부 초록»이었다**:
 *     M1 — judge 가 보는 토큰(isGoyaAssetUrl·await·tokenFailed·showToast)은 다 남긴 채,
 *          변환 결과를 다른 변수에 받고 `baseUrls.push(src)` 로 «원본»을 밀어넣는다.
 *          R3 정규식이 `baseUrls\.push\(\s*it\.src\s*\)` 라 변수명만 바뀌면 안 걸린다.
 *     M2 — `_scratchSrcToDataUrl` 첫 줄에 `return url;` 을 꽂아 변환을 통째로 무력화한다.
 *   ⇒ ★즉 ⓐ 계열이 «확실히» 잡는 변이는 「이 구간을 통째로 옛 코드로 되돌리기」 하나뿐이다.
 *     ⓐ-2 양성대조는 «얼어붙은 역사 문자열»을 스스로에게 먹이는 것이라 판정기가 죽지 않았음은
 *     보여주지만, «앞으로의 회귀»는 못 잡는다. 그 둘을 헷갈리지 마라.
 *
 * ⇒ 왜 «행동 검사»로 못 만들었나 (구조적 제약 — 지디 실측 2026-09-07):
 *   `package.json` 이 `"type":"commonjs"` 라 `js/**.js` 의 ES 모듈은 **node 가 아예 못 읽는다**
 *   (`Cannot use import statement outside a module`). 브라우저는 <script type="module"> 로 읽으니
 *   문제가 안 된다. 그래서 이 레포의 소스 검사가 전부 «문자열»인 것이고, 여기만의 게으름이 아니다.
 *   ⇒ 고치려면 «js/ 에 .mjs 를 들이거나» 번들 단계를 두어야 한다 — 전례가 0건이라 별건으로 남긴다.
 *   ⇒ ★그때까지 이 검사는 «회귀 방지»가 아니라 «구조 기록»으로 읽어라.
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
const FULL = readSrc(ROOT, 'js', 'ai-section-fill.js');

/* ── 판정 대상 구간 잘라내기 ─────────────────────────────────────────
 * 토큰 첨부 루프 = `const tokenMatches` ~ `const model = panel.querySelector('#ai-fill-panel-model')`.
 * 못 찾으면 «건너뛰지 않고» 던진다 — 못 잰 검사는 통과가 아니다.
 * ───────────────────────────────────────────────────────────────── */
const REGION_START = "const tokenMatches = [...promptText.matchAll(";
const REGION_END = "const model = panel.querySelector('#ai-fill-panel-model')";

function sliceRegion(src) {
  const a = src.indexOf(REGION_START);
  const b = src.indexOf(REGION_END, a + 1);
  assert.ok(a !== -1, `앵커 없음: ${REGION_START} — 검사가 대상을 못 찾았다(리네임됐나?)`);
  assert.ok(b !== -1 && b > a, `앵커 없음: ${REGION_END}`);
  return src.slice(a, b);
}

/** 구간 소스 → 위반 목록(빈 배열 = 통과). 실제 소스와 「고치기 전」 소스에 «같은» 판정을 쓴다. */
function judge(region) {
  const bad = [];
  if (!/isGoyaAssetUrl\s*\(/.test(region)) {
    bad.push('R1 goya-asset 여부를 판별하지 않는다');
  }
  if (!/await\s+_scratchSrcToDataUrl\s*\(/.test(region)) {
    bad.push('R2 첨부 전에 data URL 로 변환(await)하지 않는다');
  }
  if (/baseUrls\.push\(\s*it\.src\s*\)/.test(region)) {
    bad.push('R3 스크래치 src 를 «그대로» 첨부에 넣는다');
  }
  if (!/tokenFailed/.test(region) || !/showToast/.test(region)) {
    bad.push('R4 변환 실패를 사용자에게 보이는 신호로 남기지 않는다');
  }
  if (/\?\?\s*alert\s*\(/.test(region)) {
    bad.push('R5 `?? alert(` — showToast 가 undefined 를 반환해 렌더러를 얼린다');
  }
  return bad;
}

/* 고치기 전(dev 7684264) 그대로의 구간 — 양성대조용 «역사 문자열». 여기는 다시 바뀌지 않는다. */
const PRE_FIX_REGION = [
  "const tokenMatches = [...promptText.matchAll(/#(sp_[a-z0-9]{6})\\b/g)];",
  "    const seen = new Set(); let tokenAttached = 0;",
  '    for (const m of tokenMatches) {',
  '      const id = m[1];',
  '      if (seen.has(id)) continue;',
  '      seen.add(id);',
  '      const it = window._scratchGetItemById?.(id);',
  '      if (it?.src && !baseUrls.includes(it.src)) {',
  '        baseUrls.push(it.src);',
  '        tokenAttached += 1;',
  '      }',
  '    }',
  '    if (tokenAttached > 0) {',
  '      window.showToast?.(`🔗 스크래치 ID로 ${tokenAttached}장 자동 첨부`);',
  '    }',
  '    ',
].join('\n');

test('ⓐ-1 토큰 첨부는 goya-asset src 를 data URL 로 되돌린 «뒤» 넣는다', () => {
  const bad = judge(sliceRegion(FULL));
  assert.deepEqual(bad, [], '위반: ' + bad.join(' / '));
});

test('ⓐ-2 ★양성대조 — 고치기 전 코드를 넣으면 같은 판정이 «빨강»을 낸다', () => {
  // 고친 구간을 역사 문자열로 되돌린 «전체 소스»를 만들어, 같은 잘라내기+같은 judge 를 태운다.
  const a = FULL.indexOf(REGION_START);
  const b = FULL.indexOf(REGION_END, a + 1);
  const reverted = FULL.slice(0, a) + PRE_FIX_REGION + FULL.slice(b);
  const bad = judge(sliceRegion(reverted));
  assert.ok(bad.length > 0, '양성대조가 초록이다 — 이 검사는 장식이다(판정이 아무것도 안 본다)');
  for (const rule of ['R1', 'R2', 'R3', 'R4']) {
    assert.ok(bad.some(x => x.startsWith(rule)), `${rule} 이 결함을 못 잡는다: ${bad.join(' / ')}`);
  }
});

test('ⓐ-3 변환 도구는 새로 만들지 않고 goya-asset-inline.js 것을 쓴다', () => {
  assert.match(
    FULL,
    /import\s*\{[^}]*\bisGoyaAssetUrl\b[^}]*\bparseGoyaAssetUrl\b[^}]*\bmakeElectronAssetReader\b[^}]*\}\s*from\s*'\.\/io\/goya-asset-inline\.js'/,
    'goya-asset-inline.js 에서 세 헬퍼를 가져와야 한다(재구현 금지)'
  );
});

/* ── ⓑ 동작 — 브라우저용 ES 모듈이라 tmp .mjs 사본으로 동적 import (figma-goya.test.js 와 동일 수법) ── */
const SRC_MOD = path.resolve(ROOT, 'js/io/goya-asset-inline.js');
let _modP = null;
function loadMod() {
  if (!_modP) {
    const dir = mkTmpRoot('aifill-goya-');
    const mjs = path.join(dir, 'goya-asset-inline.mjs');
    fs.copyFileSync(SRC_MOD, mjs);
    _modP = import(pathToFileURL(mjs).href);
  }
  return _modP;
}

const ASSET_URL = 'goya-asset://proj1/aaaaaaaaaaaaaaaa.png';
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
/** services/geminiService.js:151 의 «그» 정규식 — 오류 문구를 만든 문지기. */
const GEMINI_RE = /^data:([^;]+);base64,(.+)$/;

function withWindow(api, fn) {
  const had = Object.prototype.hasOwnProperty.call(globalThis, 'window');
  const prev = globalThis.window;
  globalThis.window = { electronAPI: api };
  try { return fn(); }
  finally { if (had) globalThis.window = prev; else delete globalThis.window; }
}

test('ⓑ-1 원본 goya-asset URL 은 geminiService 정규식을 «통과 못 한다»(그게 오류의 정체)', () => {
  assert.equal(GEMINI_RE.test(ASSET_URL), false);
  assert.equal(GEMINI_RE.test(PNG), true);   // 대조: 변환 결과 형식은 통과한다
});

test('ⓑ-2 reader 로 되돌린 값은 그 정규식을 통과한다', async () => {
  const { parseGoyaAssetUrl, makeElectronAssetReader, isGoyaAssetUrl } = await loadMod();
  assert.equal(isGoyaAssetUrl(ASSET_URL), true);
  const seen = [];
  const out = await withWindow({
    assetsReadAsDataUri: async ({ projectId, filename }) => {
      seen.push(`${projectId}/${filename}`);
      return { ok: true, dataUri: PNG };
    },
  }, async () => {
    const p = parseGoyaAssetUrl(ASSET_URL);
    return await makeElectronAssetReader()(p.projectId, p.filename);
  });
  assert.deepEqual(seen, ['proj1/aaaaaaaaaaaaaaaa.png']);
  assert.equal(GEMINI_RE.test(out), true);
});

test('ⓑ-3 읽기 실패(ok:false)·IPC 미가용은 null 이다 — 호출부가 «빼고 알릴» 수 있게', async () => {
  const { makeElectronAssetReader } = await loadMod();
  const fail = await withWindow(
    { assetsReadAsDataUri: async () => ({ ok: false, error: 'ENOENT' }) },
    async () => makeElectronAssetReader()('proj1', 'x.png')
  );
  assert.equal(fail, null);
  // 웹(preload 없음) → reader 자체가 null
  assert.equal(withWindow({}, () => makeElectronAssetReader()), null);
});
