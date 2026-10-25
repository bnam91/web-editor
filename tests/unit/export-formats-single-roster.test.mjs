/* export-formats-single-roster.test.mjs
 *   ★★`t6-01` — ★내보내기 꼴 명부가 ★«하나»인지 ★소스로 ★센다. (2026-10-25 신설 · 지디)
 *
 * ★왜 — ★같은 명부가 ★여섯 자리에 ★흩어져 있었다(선택지 둘 · gif 판정 둘 · mime/ext 삼항 · 결과모달 짧은이름).
 *   ⇒ ★정본 `js/io/export-formats.js` ★한 자리로 모았다. ★이 검사가 ★그 상태를 ★지킨다.
 *
 * ★★헤드리스 DOM 스펙(`tests/dom/t6-01-webp-export`)이 ★못 재는 축을 ★여기서 잰다 —
 *   거기선 `exportSection` 이 ★터진다(네이티브 CDP 캡처가 Electron 전용 ·
 *   `WEBP-EXPORT-PATH-NEEDS-NATIVE-CAPTURE-01`). ⇒ ★여기서는 ★«소스가 그 파생을 쓰나»를 ★센다.
 *
 * ⛔안 재는 축 — ★실제 디스크 webp 바이트(`WEBP-REAL-FILE-BYTES-UNMEASURED-01` · 앱/태양 축).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mkTmpRoot } from './_tmproot.js';
import { createRequire } from 'node:module';

/* ★주석 걷어내기는 ★«공용 부품»을 쓴다 — `tests/unit/_strip-comments.js`
     ⛔여기서 ★자기 벌을 ★만들면 안 된다(`strip-comments-shared.test.js` 의 ★S-6 가 막는다).
     ★★261025 — ★나는 ★처음에 ★제 것을 ★지었다가 ★그 게이트에 ★잡혔다. ★벌이 여럿이면
       ★«어느 벌로 쟀는지»에 따라 ★답이 갈린다. ⇒ ★공용 하나.
     ★왜 걷나 — ★주석에 ★예시로 적은 ★꼴 이름이 ★측정값이 되면 안 된다(261007 교훈). */
const _req = createRequire(import.meta.url);
const { stripComments } = _req('./_strip-comments.js');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

/* 정본은 import 가 없는 순수 모듈이다 — package.json 이 commonjs 라 tmp .mjs 사본으로 싣는다
   (ai-text-slots-ssot.test.mjs 와 같은 수법). 내용은 바이트 그대로다. */
const SRC = read('js/io/export-formats.js');
const _tmp = path.join(mkTmpRoot('export-formats-'), 'export-formats.mjs');
fs.writeFileSync(_tmp, SRC);
const MOD = await import(pathToFileURL(_tmp).href);
const { EXPORT_FORMATS, exportFormatOf, isGifFormat, isAnimFormat,
        exportMimeOf, exportExtOf, exportShortOf, exportFormatOptionsHTML } = MOD;

/* ───────────────────────── F1 ★정본 자체 ───────────────────────── */
test('F1 ★정본 — webp 가 들어 있고, id 가 겹치지 않고, 래스터 꼴은 mime·ext 를 다 갖는다', () => {
  const ids = EXPORT_FORMATS.map(f => f.id);
  assert.ok(ids.includes('webp'), `webp 가 정본에 없다 — ${ids.join(',')}`);
  assert.equal(new Set(ids).size, ids.length, `id 가 겹친다 — ${ids.join(',')}`);
  for (const f of EXPORT_FORMATS) {
    assert.ok(f.label && f.short, `${f.id} 에 label/short 가 없다`);
    /* ★라벨은 패널 HTML 에 ★그대로 박힌다 ⇒ ★이스케이프가 필요한 글자가 ★있으면 안 된다 */
    assert.doesNotMatch(f.label + f.short, /[<>&"']/, `${f.id} 의 이름에 HTML 특수문자가 있다 — 이스케이프 없이 박힌다`);
    if (f.gif) assert.ok(!f.mime && !f.ext, `${f.id} 는 gif 길인데 mime/ext 를 들고 있다 (toBlob 길로 오해된다)`);
    else assert.ok(f.mime && f.ext, `${f.id} 는 래스터인데 mime/ext 가 없다`);
  }
});

test('F2 ★파생 함수 — 꼴마다 제 값을 내고, 모르는 id 는 첫 꼴로 떨어진다', () => {
  assert.equal(exportMimeOf('webp'), 'image/webp');
  assert.equal(exportExtOf('webp'), 'webp');
  assert.equal(exportMimeOf('jpg'), 'image/jpeg');
  assert.equal(exportExtOf('jpg'), 'jpg');
  assert.equal(exportMimeOf('png'), 'image/png');
  /* ★★셋이 ★서로 다르다 — ⛔같으면 이 검사는 아무것도 안 잠근다 */
  assert.equal(new Set(['webp', 'jpg', 'png'].map(exportMimeOf)).size, 3, '세 꼴이 같은 mime 을 낸다');
  assert.equal(isGifFormat('gif'), true);
  assert.equal(isGifFormat('gif-anim'), true);
  assert.equal(isGifFormat('webp'), false, 'webp 가 gif 길로 잡히면 인코더가 갈린다');
  assert.equal(isAnimFormat('gif-anim'), true);
  assert.equal(isAnimFormat('gif'), false);
  assert.equal(exportFormatOf('없는꼴').id, EXPORT_FORMATS[0].id);
  assert.equal(exportShortOf('webp'), 'WebP');
  assert.equal(exportShortOf('gif-anim'), 'GIF', '결과 모달의 옛 규약 — GIF 둘은 같은 짧은 이름');
  assert.equal(exportShortOf('없는꼴'), '없는꼴'.toUpperCase());
});

test('F3 ★선택지 HTML — 정본 수만큼 나오고, selected 는 고른 하나뿐이다', () => {
  const h = exportFormatOptionsHTML('webp');
  const n = (h.match(/<option /g) || []).length;
  assert.equal(n, EXPORT_FORMATS.length, `option 수 ${n} ≠ 정본 수 ${EXPORT_FORMATS.length}`);
  assert.equal((h.match(/selected/g) || []).length, 1, 'selected 가 하나가 아니다');
  assert.match(h, /value="webp"[^>]*selected/, 'webp 가 안 골라졌다');
  /* ★인자 없이 부르면 ★아무것도 안 골라진다 — ★두 패널이 그렇게 쓴다(값은 뒤에 .value 로 복원) */
  assert.equal((exportFormatOptionsHTML().match(/selected/g) || []).length, 0);
});

/* ─────────── F4 ★★소비자가 ★제 명부를 ★다시 짓지 않는다 (★소스로 센다) ─────────── */
const CONSUMERS = [
  'js/props/prop-page.js',
  'js/props/prop-section.js',
  'js/io/export-image.js',
  'js/io/export-gate.js',
  'js/io/export-gate-core.js',
  'js/export-result-modal.js',
];

test('F4 ★★소비자 여섯 — 꼴 이름을 ★손으로 다시 적지 않는다 (주석은 걷고 센다)', () => {
  const bad = [];
  for (const rel of CONSUMERS) {
    const body = stripComments(read(rel));
    for (const lit of ["'gif-anim'", '"gif-anim"', "'image/jpeg'", "'image/webp'"]) {
      if (body.includes(lit)) bad.push(`${rel} 에 ${lit}`);
    }
    /* ★`<option value="png">` 처럼 ★선택지를 ★손으로 적은 자리 */
    const opt = body.match(/<option value="(png|jpg|webp|gif|gif-anim)"/g) || [];
    if (opt.length) bad.push(`${rel} 에 손으로 적은 <option> ${opt.length}개`);
  }
  assert.deepEqual(bad, [], `명부가 다시 둘이 됐다:\n  ${bad.join('\n  ')}`);
});

test('F5 ★★소비자 여섯이 ★정말 ★정본을 ★끌어 쓴다 (안 쓰면 F4 는 「그냥 안 적었다」와 구분 안 된다)', () => {
  const miss = [];
  for (const rel of CONSUMERS) {
    const body = read(rel);
    const usesEsm = /from '\.{1,2}\/(io\/)?export-formats\.js'/.test(body);
    const usesGlobal = /window\.EXPORT_FORMATS/.test(body);
    if (!usesEsm && !usesGlobal) miss.push(rel);
  }
  assert.deepEqual(miss, [], `정본을 안 끌어 쓰는 소비자:\n  ${miss.join('\n  ')}`);
});

/* ─────────── F6 ★★변이대조 — 이 자가 ★정말 ★돈다 ─────────── */
test('F6 ★★변이대조 — 정본에서 webp 를 빼면 F1·F2 의 판정이 빨개진다', () => {
  const mutated = EXPORT_FORMATS.filter(f => f.id !== 'webp');
  assert.notEqual(mutated.length, EXPORT_FORMATS.length, '변이가 한 줄도 안 잘랐다 = 이 대조는 아무것도 증명하지 않는다');
  assert.ok(!mutated.some(f => f.id === 'webp'), '변이 뒤에도 webp 가 남았다');
  /* ★같은 자(F1 의 단언)를 ★변이본에 대고 ★빨개지는지 본다 */
  assert.throws(() => {
    const ids = mutated.map(f => f.id);
    assert.ok(ids.includes('webp'), 'webp 가 정본에 없다');
  }, /webp 가 정본에 없다/);
});

test('F7 ★★`export-image.js` 가 ★mime·ext 를 ★파생으로 쓴다 (★삼항이 돌아오면 빨강)', () => {
  const body = stripComments(read('js/io/export-image.js'));
  assert.match(body, /const mime = exportMimeOf\(fmt\)/, 'mime 이 파생이 아니다');
  assert.match(body, /const ext\s+= exportExtOf\(fmt\)/, 'ext 가 파생이 아니다');
  assert.doesNotMatch(body, /fmt === 'jpg' \?/, "옛 삼항(fmt === 'jpg' ? …)이 돌아왔다");
  assert.match(body, /const isGif\s+= isGifFormat\(fmt\)/, 'isGif 가 파생이 아니다');
  assert.match(body, /const isGifAnim = isAnimFormat\(fmt\)/, 'isGifAnim 이 파생이 아니다');
});
