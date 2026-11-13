/* section-note-pattern-t309 — t3-09 노트 배경(줄눈·모눈·점모눈) «조절» · 정본 data-bg-note = kind|gap|#rrggbb|width|opacity.
 *   N1 파서 왕복 · 틀린 꼴/범위/선>=칸 은 null(= 안 그린다)
 *   N2 CSS 값표 — 이미지 0(url 없음) · repeating-* 없음(h2c 1.4.1 폴백) · 종류별 겹 수·크기
 *   N3 Figma SVG — 같은 값이 pattern 한 칸으로(선색·투명도·간격) · 틀린 꼴 = ''
 *   N4 그리개 배선 — _applySectionBg 가 그림·메시 «없을 때만» 노트를 그린다 · 로드 재적용 · Figma 실음 · 렌더러가 블록 «앞»에 깐다
 *   양성대조: 각 칸에 «되돌리면 빨강»이 같이 있다(아래 주석).
 * 경로별 행위(화면·PNG h2c·HTML·Figma JSON·저장 왕복·옛 고정 SVG 하위호환)는 tests/dom/section-note-pattern-t309.dom.spec.js 몫.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const SRC = read('js/props/prop-section.js');
const NAMES = ['NOTE_KINDS', 'NOTE_RANGE', 'NOTE_DEFAULT', 'noteParse', 'noteSpecOf', 'sectionNoteCss', 'sectionNoteSvg'];
function load(src) {
  const a = src.indexOf('export const NOTE_KINDS');
  const b = src.indexOf('window.sectionNoteCss = sectionNoteCss;');
  assert.ok(a > 0 && b > a, '노트 구간을 못 찾았다');
  const m = {};
  new Function('m', src.slice(a, b).replace(/^export /gm, '') + ';' + NAMES.map((n) => `m.${n}=${n}`).join(';'))(m);
  return m;
}
const N = load(SRC);

test('N1 파서 왕복 · 틀린 꼴과 범위 밖은 null', () => {
  assert.deepEqual(N.noteParse('grid|24|#FF0000|2|50'), { kind: 'grid', gap: 24, color: '#ff0000', width: 2, opacity: 50 });
  assert.equal(N.noteSpecOf(N.noteParse('grid|24|#ff0000|2|50')), 'grid|24|#ff0000|2|50', '왕복 = 같은 글자');
  assert.ok(N.noteParse(N.NOTE_DEFAULT), '기본값이 스스로 파서를 통과한다');
  for (const bad of ['', undefined, 'wave|24|#ff0000|2|50', 'lines|3|#ff0000|1|50', 'lines|24|#ff0000|21|50',
    'lines|24|#ff0000|2|101', 'lines|24|red|2|50', 'lines|4|#ff0000|4|50', 'lines|24|#ff0000|2|50|x', 'lines|24|#ff0000|2|50"><img>']) {
    assert.equal(N.noteParse(bad), null, `${JSON.stringify(bad)} 는 null 이어야 한다`);
  }
  /* 자르기: 범위 밖 → 끝값 · 선은 칸보다 1 가늘게 (되돌리면 빨강: noteSpecOf 의 gap-1 을 빼면 'lines|4|…|4|' = 파서 null) */
  assert.equal(N.noteSpecOf({ kind: 'lines', gap: 1, color: '#ABCDEF', width: 99, opacity: 300 }), 'lines|4|#abcdef|3|100');
  assert.equal(N.noteSpecOf({ kind: 'zz', gap: 30, color: 'x', width: 1, opacity: 10 }), 'lines|30|#9ca3af|1|10');
});

test('N2 CSS 값표 — 이미지 0 · repeating 0 · 종류별 겹/크기', () => {
  const L = N.sectionNoteCss('lines|28|#ff0000|2|100');
  assert.deepEqual(L, { image: 'linear-gradient(to bottom, rgba(255, 0, 0, 1) 0px, rgba(255, 0, 0, 1) 2px, transparent 2px, transparent 100%)', size: '100% 28px', layers: 1 });
  const G = N.sectionNoteCss('grid|40|#000000|1|50');
  assert.equal(G.layers, 2);
  assert.equal(G.size, '40px 40px, 40px 40px');
  assert.equal((G.image.match(/linear-gradient\(/g) || []).length, 2);
  assert.match(G.image, /rgba\(0, 0, 0, 0\.5\)/, '투명도 50 → 알파 0.5');
  const D = N.sectionNoteCss('dots|20|#00ff00|3|100');
  assert.match(D.image, /^radial-gradient\(circle, rgba\(0, 255, 0, 1\) 0px, rgba\(0, 255, 0, 1\) 3px, transparent 3px/);
  assert.equal(D.size, '20px 20px');
  for (const c of [L, G, D]) {
    assert.doesNotMatch(c.image, /url\(|repeating-/, 'url()·repeating-* 가 없다(이미지 교체 0 · h2c 폴백)');
  }
  /* 양성대조: 틀린 꼴은 null — 함수가 «늘 무언가 낸다»면 이 칸이 빨강 */
  assert.equal(N.sectionNoteCss('lines|28|#ff0000|28|100'), null);
});

test('N3 Figma SVG — 같은 값이 pattern 한 칸으로', () => {
  const s = N.sectionNoteSvg('grid|30|#ff0000|2|40', 860.4, 500);
  assert.match(s, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="860" height="500">/);
  assert.match(s, /<pattern id="gdnote" width="30" height="30" patternUnits="userSpaceOnUse">/);
  assert.equal((s.match(/<rect width="30" height="2" fill="#ff0000" fill-opacity="0\.4"\/>/g) || []).length, 1, '가로 띠 1');
  assert.equal((s.match(/<rect width="2" height="30" fill="#ff0000" fill-opacity="0\.4"\/>/g) || []).length, 1, '세로 띠 1(grid)');
  assert.doesNotMatch(N.sectionNoteSvg('lines|30|#ff0000|2|40', 10, 10), /height="30" fill/, 'lines 엔 세로 띠가 없다');
  assert.match(N.sectionNoteSvg('dots|20|#00ff00|3|100', 10, 10), /<circle cx="10" cy="10" r="3" fill="#00ff00" fill-opacity="1"\/>/);
  assert.equal(N.sectionNoteSvg('bad', 10, 10), '');
});

test('N4 배선 — 그리개·로드·Figma 실음·렌더러 순서', () => {
  /* 그리개: 노트는 그림·메시가 없을 때만 (되돌리면 빨강: `(img || mesh) ? null :` 을 빼면 그림 위에 무늬가 깔린다) */
  assert.match(SRC, /const note = \(img \|\| mesh\) \? null : sectionNoteCss\(sec\.dataset\.bgNote\);\n  if \(note\) \{/);
  /* 메시를 켜면 노트를 걷고, 노트를 켜면 메시를 걷는다(한 자리를 다툰다) */
  assert.match(SRC, /sec\.dataset\.bgMesh = meshSpecOf\(MESH_DEFAULT\); delete sec\.dataset\.bgNote;/);
  assert.match(SRC, /sec\.dataset\.bgNote = NOTE_DEFAULT; delete sec\.dataset\.bgMesh; delete sec\.dataset\.bgMeshGeo;/);
  /* 로드: 인라인이 빠진 길에서도 다시 그린다 */
  assert.match(read('js/io/save-load.js'), /if \(sec\.dataset\.bgMesh \|\| sec\.dataset\.bgNote\) window\.applySectionBg\?\.\(sec\);/);
  /* Figma 빌더가 bgNoteSvg 를 싣는다 */
  assert.match(read('js/io/export-figma-json.js'), /\.\.\.\(bgNoteSvg \? \{ bgNoteSvg \} : \{\}\)/);
  /* 렌더러: 블록 루프 «앞»에서 깐다(뒤면 무늬가 블록을 덮는다 — 순서를 바꾸면 빨강) */
  const R = read('figma-renderer/sangpe_to_figma.mjs');
  const iNote = R.indexOf("svg: section.bgNoteSvg, parentId: secFrame.id");
  const iLoop = R.indexOf('for (const block of section.blocks)');
  assert.ok(iNote > 0 && iLoop > 0 && iNote < iLoop, `렌더러 노트 ${iNote} < 블록 루프 ${iLoop}`);
});
