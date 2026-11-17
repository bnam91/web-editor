/* anti-re-notice — APP-ANTI-REVERSE-ENGINEERING-NOTICE-01 (현빈 결정 261117 #12) — 역분석 금지 고지가 «처음 읽는 자리»에 있다
 *   실행: node tests/run-unit.mjs tests/unit/anti-re-notice.test.mjs
 *   N1 LICENSE·NOTICE.txt 가 있고 build.files 가 그 둘을 빼지 않는다(asar 루트에 실린다)
 *   N2 main.js·preload.js 첫 줄 = /*! 머리 · NOTICE.txt 를 가리킨다
 *   N3 main.js 가 맥 «관하여» 창에 고지 한 줄(setAboutPanelOptions copyright)
 *   N4 README.md 에 고지 절
 *   양성대조: _patches/NOTICE-CTL-drop-banner.patch(main.js 머리 줄 삭제) → N2 빨강
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const R = (p) => fs.readFileSync(new URL('../../' + p, import.meta.url), 'utf8');

test('N1 LICENSE·NOTICE.txt 가 있고 패키징에서 안 빠진다', () => {
  assert.match(R('NOTICE.txt'), /리버스 엔지니어링/);
  assert.match(R('LICENSE'), /리버스 엔지니어링/);
  const files = JSON.parse(R('package.json')).build.files;
  assert.ok(files.includes('**/*'), '[전제] build.files 가 **/* 로 시작');
  for (const f of ['LICENSE', 'NOTICE.txt']) assert.ok(!files.some((x) => x === '!' + f || x === '!*.txt' || x === '!LICENSE*'), `${f} 를 빼는 규칙이 있다`);
});

test('N2 main.js·preload.js 첫 줄이 /*! 고지 머리', () => {
  for (const p of ['main.js', 'preload.js']) {
    const src = R(p);
    assert.ok(src.startsWith('/*! GODITOR'), `${p} 첫 줄이 고지가 아니다`);
    const head = (src.match(/^\/\*![\s\S]*?\*\//) || [''])[0];
    assert.match(head, /역분석/);
    assert.match(head, /NOTICE\.txt/);
  }
});

test('N3 맥 «관하여» 창 고지 한 줄', () => {
  assert.match(R('main.js'), /app\.setAboutPanelOptions\?\.\(\{ copyright: '[^']*역분석[^']*' \}\)/);
});

test('N4 README 고지 절', () => {
  assert.match(R('README.md'), /^## 고지 — 역분석 금지 \/ Notice$/m);
});
