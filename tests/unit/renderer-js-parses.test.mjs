/* renderer-js-parses.test.mjs — 렌더러 js 가 «전부 파싱되나». (T-237, 2026-09-27)
 *
 * ★★왜 생겼나 — 2026-09-27 에 HTML 을 만드는 템플릿 리터럴 «안»의 HTML 주석에 백틱을 썼다.
 *   백틱은 리터럴을 ★«닫는다» ⇒ 그 뒤가 코드로 파싱돼 파일이 통째로 `SyntaxError` 가 됐고,
 *   그 파일을 import 하는 검사 **21개**가 한꺼번에 빨개졌다. ⛔단언 하나도 «자기 축»을 재지 못했다.
 *
 * ★이 저장소엔 «형제 검사»가 이미 있다 — `tests/unit/renderer-template-intact.test.js`.
 *   ⇒ ⛔다만 그 자는 **`main.js` 만** 보고(`:12` 의 `readSrc(… 'main.js')`), 게다가 그 머리말이
 *     ★「⛔node --check 는 이걸 «통과시킨다» — 잘린 뒤에도 문법은 성립하기 때문이다」라고 적어 뒀다.
 *   ⇒ ★★**두 자는 «다른 경우»를 잡는다**:
 *       · 저 자  — 잘렸는데 «문법은 성립»하는 경우(런타임에 터진다)
 *       · 이 자  — 잘려서 «문법이 깨지는» 경우(로드가 아예 안 된다 ← 0927 이 이것이었다)
 *     ⇒ 짝으로 둔다. 어느 하나로 다른 하나를 대신할 수 없다.
 *
 * ★★«실제로 로드되는 방식»으로 갈라 잰다 — ⛔전부 `.mjs` 로 재면 안 된다.
 *   실측(판 33ea355d): `js/` 아래 `.js` **225개** = ESM(import/export 있음) **139** ＋ 전역 스크립트 **86**.
 *   전역 스크립트는 `<script src>` 로 실리고 ESM 문법 규칙을 안 받는다(HTML 주석 `<!--` 등 Annex B).
 *   ⇒ ESM 은 tmp 에 `.mjs` 로, 스크립트는 `.cjs` 로 복사해 검사한다.
 *   ⛔`node --check` 는 «확장자»로 모드를 정한다 — 그래서 복사가 필요하다(원본 `.js` 는 CJS 로 본다).
 *
 * ★비용 — 225 × 약 0.038s ≈ 9초. 「전수를 안 재는 계측기를 발명하지 마라」의 반대쪽: 재도 싸다.
 *
 * ★무엇을 잠그나
 *   P0  ★양성대조(먼저) — 모수가 «있다»(ESM·스크립트 둘 다 0 이 아니다)
 *   P1  ★★모든 렌더러 js 가 그 모드로 파싱된다
 *   P2  ★음성대조 — 템플릿 리터럴 안에 백틱을 «넣으면» 이 자가 그 파일을 빨갛다고 한다
 *       (0927 에 실제로 난 그 꼴을 그대로 흉내낸다)
 *   P3  ⛔이 자가 «형제 검사»를 대신하지 않는다 — 그 파일이 살아 있는지 확인한다
 *
 * 실행: node --test tests/unit/renderer-js-parses.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire as _cr } from 'node:module';
const { mkTmpRoot } = _cr(import.meta.url)('./_tmproot.js');   /* ★임시 루트의 ★임자 = ★`tests/unit/_tmproot.js` · ★잠그는 자 = ★`tmproot-sole-owner.test.mjs` */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', '..');

/** js/ 아래 모든 .js — ⛔이름 목록을 손으로 적지 않는다(새 파일이 늘어도 자동으로 든다). */
function walkJs(rel) {
  const out = [];
  for (const ent of fs.readdirSync(path.join(ROOT, rel), { withFileTypes: true })) {
    const r = path.join(rel, ent.name);
    if (ent.isDirectory()) out.push(...walkJs(r));
    else if (ent.name.endsWith('.js')) out.push(r);
  }
  return out;
}

/** 그 파일이 «모듈»인가 — 줄머리의 import/export 로 가른다(실제 로드 방식과 같은 판정). */
const isModule = (src) => /^\s*(import|export)\s/m.test(src);

/** `node --check` 한 번. 통과면 null, 아니면 첫 줄 오류 메시지. */
function checkSyntax(src, asModule, tmpDir, tag) {
  const p = path.join(tmpDir, `${tag}.${asModule ? 'mjs' : 'cjs'}`);
  fs.writeFileSync(p, src);
  try {
    execFileSync(process.execPath, ['--check', p], { stdio: 'pipe' });
    return null;
  } catch (e) {
    const out = String(e.stderr || e.stdout || e.message);
    const line = out.split('\n').find(l => /Error/.test(l)) || out.split('\n')[0];
    return line.trim();
  } finally {
    try { fs.unlinkSync(p); } catch (_) {}
  }
}

const FILES = walkJs('js');
const SPLIT = { esm: [], script: [] };
for (const rel of FILES) {
  (isModule(fs.readFileSync(path.join(ROOT, rel), 'utf8')) ? SPLIT.esm : SPLIT.script).push(rel);
}

test('P0 ★양성대조(먼저) — 모수가 있다(둘 다 0 이 아니다)', () => {
  assert.ok(FILES.length >= 100, `★js 파일을 ${FILES.length} 개밖에 못 찾았다 — 훑는 자가 낡았다`);
  assert.ok(SPLIT.esm.length > 0, '★ESM 이 0개다 — 가르는 자가 고장났다(전부 스크립트로 셌다)');
  assert.ok(SPLIT.script.length > 0, '★전역 스크립트가 0개다 — 가르는 자가 고장났다');
});

test('P1 ★★모든 렌더러 js 가 «그 모드로» 파싱된다', () => {
  const tmp = mkTmpRoot('rjs-parse-');
  const bad = [];
  try {
    for (const [kind, list] of [['esm', SPLIT.esm], ['script', SPLIT.script]]) {
      list.forEach((rel, i) => {
        const err = checkSyntax(fs.readFileSync(path.join(ROOT, rel), 'utf8'), kind === 'esm', tmp, `${kind}-${i}`);
        if (err) bad.push(`${rel} [${kind}] ${err}`);
      });
    }
  } finally {
  }
  assert.deepEqual(bad, [],
    '★★파싱이 안 되는 파일이 있다 — 그 파일을 import 하는 검사가 «자기 축을 재기 전에» 통째로 죽는다:\n  '
    + bad.join('\n  '));
});

test('P2 ★음성대조 — 템플릿 리터럴 안에 백틱을 넣으면 이 자가 잡는다(0927 에 실제로 난 꼴)', () => {
  const tmp = mkTmpRoot('rjs-neg-');
  try {
    /* ★0927 의 꼴 그대로 — HTML 을 만드는 템플릿 «안»의 HTML 주석에 백틱을 하나 넣는다. */
    const BROKEN = [
      'export const f = (x) => `',
      '  <div>',
      '    <!-- 여기에 `백틱` 을 쓰면 리터럴이 닫힌다 -->',
      '    <span>${x}</span>',
      '  </div>`;',
    ].join('\n');
    const err = checkSyntax(BROKEN, true, tmp, 'broken');
    assert.ok(err, '★★백틱을 넣었는데 통과했다 — 이 자는 그 축을 «안 재고» 있다(0927 병이 다시 새어 나간다)');
    assert.match(err, /SyntaxError/, `★다른 이유로 실패했다: ${err}`);
    /* ★그리고 백틱을 뺀 같은 파일은 통과해야 한다 — 「언제나 빨갛다」와 구별한다. */
    const OK = BROKEN.replace('`백틱`', '«백틱»');
    assert.equal(checkSyntax(OK, true, tmp, 'ok'), null, '★백틱을 뺀 것도 빨갛다 — 이 대조가 아무것도 안 가른다');
  } finally {
  }
});

test('P3 ⛔이 자가 «형제 검사»를 대신하지 않는다 — 그 파일이 살아 있다', () => {
  const rel = 'tests/unit/renderer-template-intact.test.js';
  assert.ok(fs.existsSync(path.join(ROOT, rel)),
    `★★${rel} 이 사라졌다 — 「잘렸는데 문법은 성립하는」 경우를 재는 자가 없어졌다. 이 검사는 그 축을 «못» 잡는다`);
  const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  assert.match(src, /node --check 는 이걸 «통과시킨다»/,
    '★그 파일이 「왜 두 자가 따로 필요한가」를 더는 적지 않는다 — 다음 사람이 하나를 지운다');
});
