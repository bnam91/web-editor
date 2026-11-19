/* nsis-license-page — 역분석 고지 윈도우 자리: NSIS 설치기 «사용권 계약» 쪽에 LICENSE 를 띄운다
 *   실행: node tests/run-unit.mjs tests/unit/nsis-license-page.test.mjs
 *   L1 build.nsis.license = build/nsis-license-ko.txt
 *   L2 그 파일 = UTF-8 BOM + LICENSE 바이트 그대로(드리프트 금지 — LICENSE 를 고치면 사본도 다시 만든다)
 *   왜 BOM 사본인가(electron-builder 26.8.1 out/targets/nsis/nsisLicense.js): nsis.license 를 직접 주면 BOM 을 붙이지 않고
 *     MUI_PAGE_LICENSE 에 그대로 넘긴다 → 한글 txt 는 BOM 이 있어야 유니코드 설치기에서 안 깨진다.
 *   왜 license_ko.txt 가 아닌가: build/license_*.txt 는 dmg-builder(dmgLicense.js getLicenseFiles)가 맥 DMG 에도 계약창을 붙인다.
 *   다시 만들기: node -e 'const f=require("fs");f.writeFileSync("build/nsis-license-ko.txt",Buffer.concat([Buffer.from([0xef,0xbb,0xbf]),f.readFileSync("LICENSE")]))'
 *   양성대조: _patches/NSIS-LICENSE-CTL-drop-config.patch(nsis 블록 삭제) → L1 빨강
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const B = (p) => fs.readFileSync(new URL('../../' + p, import.meta.url));
const BOM = Buffer.from([0xef, 0xbb, 0xbf]);

test('L1 build.nsis.license 가 BOM 사본을 가리킨다', () => {
  const build = JSON.parse(B('package.json').toString('utf8')).build;
  assert.equal(build.nsis?.license, 'build/nsis-license-ko.txt');
});

test('L2 사본 = BOM + LICENSE(드리프트 없음)', () => {
  const copy = B('build/nsis-license-ko.txt');
  const lic = B('LICENSE');
  assert.ok(!lic.subarray(0, 3).equals(BOM), '[전제] 원본 LICENSE 는 BOM 없음');
  assert.ok(copy.subarray(0, 3).equals(BOM), '사본이 UTF-8 BOM 으로 시작하지 않는다');
  assert.ok(copy.subarray(3).equals(lic), '사본이 LICENSE 와 다르다 — 머리 주석의 «다시 만들기» 로 재생성');
});
