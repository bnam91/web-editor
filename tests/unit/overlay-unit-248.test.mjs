/* overlay-unit-248.test.mjs — 248 «섹션에 떠 있는 블럭» 단위 명부가 하나인가(지디 261029 12:0x 판정 ＋ 처방 ㊀㊁).
 *   병(지디 판정): 선택상자(scratch-pad.js _marqueeCanvasTargets)와 «서로 맞춤»(prop-multisel.js _overlayUnitOf)이
 *     같은 단위(오버레이 래퍼 · 섹션 직속 줌)를 «각자» 들고 있었고, 1013t2C1(ac343b47)이 섹션 직속 스티커를 한쪽에만 더했다
 *     ⇒ 선택상자가 스티커(마킹·보통)를 못 고른다.
 *   처방: 술어를 js/overlay-unit.js 한 벌로 빼고 두 소비자가 그것을 부른다(⛔새 술어 · ⛔경고 주석으로 막기).
 *   ⛔어노테이션은 단위가 아니다(ac343b47 «제외» 결정) — O2 가 음성으로 잠근다.
 *   그라데이션(섹션 직속)은 248 ㊂⒜ 판정 전이라 여기서 «있다/없다» 를 잠그지 않는다.
 *   앱 행위(진짜 마우스 선택상자)는 tests/dom/marquee-sticker-248.dom.spec.js 가 잰다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readSrc } from './_srcread.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const MOD = path.join(ROOT, 'js', 'overlay-unit.js');
const CONSUMERS = ['js/props/prop-multisel.js', 'js/scratch-pad.js'];

/* 가짜 요소 — 술어가 쓰는 것(classList.contains · parentElement · closest('[data-overlay-block="true"]'))만 */
function el({ cls = [], attrs = {}, parent = null } = {}) {
  const e = { classList: { contains: (c) => cls.includes(c) }, parentElement: parent, getAttribute: (k) => (k in attrs ? attrs[k] : null) };
  e.closest = (sel) => {
    assert.equal(sel, '[data-overlay-block="true"]', `가짜 요소가 모르는 선택자: ${sel}`);
    for (let x = e; x; x = x.parentElement) if (x.getAttribute('data-overlay-block') === 'true') return x;
    return null;
  };
  return e;
}

test('O1 ★공용 술어가 있다 — js/overlay-unit.js 의 overlayUnitOf', () => {
  assert.ok(fs.existsSync(MOD), '공용 술어 파일 js/overlay-unit.js 가 없다 — 248 고치기 전(명부가 둘)');
  assert.match(readSrc(MOD), /export function overlayUnitOf\(/, 'overlayUnitOf 를 내보내지 않는다');
});

test('O2 ★행위 — 섹션 직속 스티커(보통·마킹)·줌·오버레이 래퍼는 단위 · 어노테이션·프레임 안 스티커는 아니다', async () => {
  if (!fs.existsSync(MOD)) assert.fail('공용 술어 파일이 없어 행위를 못 잰다 — 248 고치기 전');
  const { overlayUnitOf } = await import(pathToFileURL(MOD).href);
  const sec = el({ cls: ['section-block'] });
  const merged = el({ cls: ['section-merged-part'] });
  const sticker = el({ cls: ['sticker-block'], parent: sec });
  const marking = el({ cls: ['sticker-block'], attrs: { 'data-count': '1' }, parent: sec });
  const stickerInMerged = el({ cls: ['sticker-block'], parent: merged });
  const zoom = el({ cls: ['zoom-block'], parent: sec });
  const wrap = el({ cls: ['frame-block'], attrs: { 'data-overlay-block': 'true' }, parent: sec });
  const textInWrap = el({ cls: ['text-block'], parent: wrap });
  const annot = el({ cls: ['annotation-block'], parent: sec });
  const frame = el({ cls: ['frame-block'], parent: sec });
  const stickerInFrame = el({ cls: ['sticker-block'], parent: frame });
  assert.equal(overlayUnitOf(sticker), sticker, '섹션 직속 보통 스티커가 단위가 아니다(248 증상)');
  assert.equal(overlayUnitOf(marking), marking, '섹션 직속 마킹 스티커가 단위가 아니다(248 증상)');
  assert.equal(overlayUnitOf(stickerInMerged), stickerInMerged, '합친 상자 직속 스티커가 단위가 아니다');
  assert.equal(overlayUnitOf(zoom), zoom, '섹션 직속 줌이 단위가 아니다(옛 갈래가 깨졌다)');
  assert.equal(overlayUnitOf(wrap), wrap, '오버레이 래퍼가 단위가 아니다(옛 갈래가 깨졌다)');
  assert.equal(overlayUnitOf(textInWrap), wrap, '오버레이 래퍼 안 글상자의 단위가 래퍼가 아니다');
  assert.equal(overlayUnitOf(annot), null, '★어노테이션이 단위가 됐다 — ac343b47 «제외» 결정을 어겼다');
  assert.equal(overlayUnitOf(stickerInFrame), null, '프레임 안 스티커가 단위가 됐다(섹션 직속만)');
});

test('O3 ★명부 하나 — 소비자 둘이 공용 술어를 부르고 제 명부를 따로 들지 않는다', () => {
  const importers = CONSUMERS.filter(f => /import\s*\{[^}]*\boverlayUnitOf\b[^}]*\}\s*from\s*['"][./]*overlay-unit\.js['"]/.test(readSrc(path.join(ROOT, f))));
  assert.deepEqual(importers, CONSUMERS, `공용 술어를 안 부르는 소비자: ${CONSUMERS.filter(f => !importers.includes(f)).join(', ')}`);
  const ms = readSrc(path.join(ROOT, 'js/props/prop-multisel.js'));
  assert.doesNotMatch(ms, /function _overlayUnitOf\(/, 'prop-multisel.js 가 제 _overlayUnitOf 를 아직 든다(명부 둘)');
  const sp = readSrc(path.join(ROOT, 'js/scratch-pad.js'));
  const i = sp.indexOf('function _marqueeCanvasTargets(');
  assert.ok(i >= 0, '전제: _marqueeCanvasTargets 정의가 없다');
  const body = sp.slice(i, sp.indexOf('\n}\n', i));
  assert.match(body, /\boverlayUnitOf\(/, '선택상자가 공용 술어를 안 부른다');
  assert.doesNotMatch(body, /\[data-overlay-block="true"\], \.zoom-block/, '선택상자가 제 «오버레이·줌» 선택자를 아직 든다(명부 둘)');
});
