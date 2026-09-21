/* U-THUMB — 프로젝트 카드 썸네일의 «빈 그림» 판정과 그 배선 (T-87, 2026-09-22)
 *   실행: node --test "tests/unit/*.test.mjs"  ·  소스만 읽는다(라이브 무접촉).
 *
 * ★무엇을 지키나 — 「썸네일이 있다」를 «비어 있지 않다»(truthy)로 재던 자리.
 *   toDataURL 은 높이 0 캔버스에서 예외를 «안» 던지고 "data:,"(6자)를 돌려준다.
 *   6자는 truthy 라 _meta.json 에 썸네일로 저장되고, 카드는 <img src="data:,"> 를 그려
 *   onerror 로 숨겼다 ⇒ 기본 아이콘조차 없는 «완전한 빈 칸»(2026-09-22 실앱 재현, 9640).
 *
 * ⛔「파일이/값이 있다」만 재지 마라 — 그게 빈 그림을 통과시킨 바로 그 잣대다.
 *   여기서는 «길이와 꼴»을 잰다. 음성대조로 «truthy 로 재면 통과한다»는 사실도 같이 못 박는다.
 *
 * 브라우저 캔버스가 필요한 «만드는 쪽»(makeThumbDataUrl)은 tests/dom/card-thumb-empty.dom.spec.js.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const require_ = createRequire(import.meta.url);
const { isUsableThumbnail, MIN_DATA_URL_LEN } = require_(path.join(ROOT, 'js/io/image-data-url.js'));

const JPEG = 'data:image/jpeg;base64,' + 'A'.repeat(4000);

test('U-THUMB-1 "data:,"(6자)는 «빈 그림»이다 — 그런데 truthy 다(음성대조)', () => {
  const EMPTY = 'data:,';
  assert.equal(EMPTY.length, 6, '함정의 실측값: toDataURL 이 0 높이에서 돌려주는 문자열은 6자다');
  assert.equal(!!EMPTY, true, '★음성대조 — truthy 로 재면 이 빈 그림이 그대로 통과한다');
  assert.equal(isUsableThumbnail(EMPTY), false, `길이 ${EMPTY.length} 자리 data URL 은 그림이 아니다`);
});

test('U-THUMB-2 «길이»로 가른다 — 경계 바로 아래/위', () => {
  const below = 'data:image/jpeg;base64,' + 'A'.repeat(MIN_DATA_URL_LEN - 23 - 1);
  const at    = 'data:image/jpeg;base64,' + 'A'.repeat(MIN_DATA_URL_LEN - 23);
  assert.equal(below.length, MIN_DATA_URL_LEN - 1);
  assert.equal(at.length, MIN_DATA_URL_LEN);
  assert.equal(isUsableThumbnail(below), false, `${below.length}자는 통과하면 안 된다`);
  assert.equal(isUsableThumbnail(at), true, `${at.length}자는 통과해야 한다`);
});

test('U-THUMB-3 꼴도 본다 — 길기만 한 non-image data URL 은 그림이 아니다', () => {
  const longText = 'data:text/plain;base64,' + 'A'.repeat(4000);
  assert.equal(longText.length > MIN_DATA_URL_LEN, true, '길이만으로는 못 거른다(음성대조)');
  assert.equal(isUsableThumbnail(longText), false);
  assert.equal(isUsableThumbnail(JPEG), true);
});

test('U-THUMB-4 data: 가 아닌 값(파일/원격 경로)은 여기서 막지 않는다 — <img> 가 읽어 보면 안다', () => {
  assert.equal(isUsableThumbnail('goya-asset://thumb/proj_1.png'), true);
  assert.equal(isUsableThumbnail('../assets/x.png'), true);
});

test('U-THUMB-5 값이 아닌 것들', () => {
  for (const v of [null, undefined, '', 0, 123, {}, [], NaN]) {
    assert.equal(isUsableThumbnail(v), false, `${String(v)} 는 썸네일이 아니다`);
  }
});

/* ── 배선 — 판정이 «한 곳»에 있고, 쓰는 쪽 둘 다 그걸 싣는지 ──────────────────
 * ⛔이 묶음이 없으면 image-data-url.js 가 조용히 안 실려도 아무도 모른다.
 *   그러면 save-load.js 는 window.makeThumbDataUrl 이 없어 예외 → 썸네일이 «전부» 사라지고,
 *   projects.html 은 window.isUsableThumbnail 이 없어 예외 → 카드가 아예 안 그려진다. */
test('U-THUMB-6 index.html 이 image-data-url.js 를 save-load.js(모듈)보다 «먼저» 싣는다', () => {
  const html = read('index.html');
  const iThumb = html.indexOf('js/io/image-data-url.js');
  const iSave  = html.indexOf('js/io/save-load.js');
  assert.notEqual(iThumb, -1, 'index.html 에 image-data-url.js 가 없다');
  assert.notEqual(iSave, -1);
  assert.equal(iThumb < iSave, true, `순서가 뒤집혔다 — image-data-url@${iThumb} · save-load@${iSave}`);
  assert.match(html.slice(iThumb - 60, iThumb), /<script src="$/, 'classic script 여야 한다(모듈은 defer 돼 늦는다)');
});

test('U-THUMB-7 pages/projects.html 이 image-data-url.js 를 싣고, 카드가 그 판정을 쓴다', () => {
  const html = read('pages/projects.html');
  assert.match(html, /<script src="\.\.\/js\/io\/image-data-url\.js"><\/script>/, 'projects.html 에 image-data-url.js 가 없다');
  assert.match(html, /window\.isUsableThumbnail\(proj\.thumbnail\)/, '카드가 판정 함수를 안 쓴다');
  assert.equal(/thumbContent\s*=\s*proj\.thumbnail\s*\n?\s*\?/.test(html), false,
    '★옛 truthy 판정(`proj.thumbnail ?`)이 돌아왔다 — 그 길로 "data:," 가 다시 들어온다');
});

test('U-THUMB-8 썸네일을 «만드는» 자리도 같은 한 곳을 쓴다 — 자체 toDataURL 금지', () => {
  const src = read('js/io/save-load.js');
  const raw = src.slice(src.indexOf('async function captureThumbnail()'), src.indexOf('/* ── 프로젝트 파일 저장'));
  assert.notEqual(raw.length, 0, 'captureThumbnail 을 못 찾았다');
  // ★주석은 걷어내고 «코드»만 잰다 — 함정을 설명한 주석이 검사를 빨갛게 만들면 안 된다
  const cap = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.match(cap, /window\.makeThumbDataUrl\(canvas\)/, 'captureThumbnail 이 공용 축소·판정을 안 쓴다');
  assert.equal(/toDataURL/.test(cap), false,
    '★captureThumbnail 이 스스로 toDataURL 을 부른다 — 0 높이에서 "data:," 를 돌려주는 그 자리다');
});

test('U-THUMB-9 카드가 못 읽힌 그림을 «감추기만» 하지 않는다 — 기본 아이콘이 남는다', () => {
  const html = read('pages/projects.html');
  assert.match(html, /class="card-thumb-fallback"/, '기본 아이콘 자리(.card-thumb-fallback)가 없다');
  assert.match(html, /onerror="this\.style\.display='none';this\.nextElementSibling\.hidden=false"/,
    'onerror 가 기본 아이콘을 되살리지 않는다');
  assert.match(read('pages/projects.html'), /\.card-thumb-fallback\[hidden\]\s*\{\s*display:\s*none;?\s*\}/,
    '[hidden] 규칙이 없으면 flex 칸에서 아이콘이 «항상» 보인다');
});
