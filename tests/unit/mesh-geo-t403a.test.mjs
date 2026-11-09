/* mesh-geo-t403a — t4-03 ㉠ 메시 모서리 자리(data-bg-mesh-geo) · 설계서 T403A §1·§5 A1·A3.
 *   A1 geo 파서 왕복 · 틀린 꼴/범위는 null(= 기본 모서리로 그린다, 메시는 그대로)
 *   A3 ★옛 리더 모의 — v0.9.10(e7d97f1ec)의 메시 구간을 git show 로 떼어 «새 저장»을 읽혀 본다:
 *      data-bg-mesh 는 그대로라 4겹을 그린다(꺼지지 않는다). 양성대조 = 꼬리 꼴(@x y rx ry)은 옛 리더가 null.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const NAMES = ['meshCornersOf', 'meshColorsOf', 'sectionMeshCss', 'meshSpecOfCorners', 'meshGeoParse', 'meshGeoSpecOf'];
function load(src) {
  const a = src.indexOf('export const MESH_CORNERS');
  const b = src.indexOf('window.sectionMeshCss = sectionMeshCss;');
  assert.ok(a > 0 && b > a, '메시 구간을 못 찾았다');
  const body = src.slice(a, b).replace(/^export /gm, '');
  const m = {};
  new Function('m', body + ';' + NAMES.map((n) => `try{m.${n}=${n}}catch(_){}`).join(';'))(m);
  return m;
}
const OLD = load(execFileSync('git', ['show', 'e7d97f1ec:js/props/prop-section.js'], { cwd: ROOT, encoding: 'utf8' }));
const NEW = load(fs.readFileSync(path.join(ROOT, 'js', 'props', 'prop-section.js'), 'utf8'));

/* 새 판이 끌고 나서 저장한 꼴(DOM A8 이 같은 꼴을 실제 저장본에서 잰다) */
const SAVED = '<section class="section-block" data-bg-mesh="#ff0080|#7928ca|#00d4ff|#ffdd00" data-bg-mesh-geo="40 30 100 100|100 0 100 100|100 100 80 120|0 100 100 100"></section>';
const attr = (html, n) => (new RegExp(` ${n}="([^"]*)"`).exec(html) || [])[1];

test('A1 geo 파서 왕복 · 틀린 꼴과 범위 밖은 null', () => {
  const s = '40 30 100 100|100 0 100 100|100 100 80 120|-20 119.5 10 200';
  const g = NEW.meshGeoParse(s);
  assert.equal(g.length, 4);
  assert.deepEqual(g[3], { x: -20, y: 119.5, rx: 10, ry: 200 });
  assert.equal(NEW.meshGeoSpecOf(g), s, '왕복 = 같은 글자');
  assert.equal(NEW.meshGeoSpecOf(NEW.meshGeoParse('0 0 100 100|100 0 100 100|100 100 100 100|0 100 100 100')), '', '모두 기본 = 빈 글자(속성 생략)');
  for (const bad of ['abc', '0 0 100 100|100 0 100 100|100 100 100 100', '150 0 100 100|100 0 100 100|100 100 100 100|0 100 100 100',
    '0 0 5 100|100 0 100 100|100 100 100 100|0 100 100 100', '0 0 100 100|100 0 100 100|100 100 100 100|0 100 100 100|0 0 1 1',
    '0 0 100 100;x|100 0 100 100|100 100 100 100|0 100 100 100', '', undefined]) {
    assert.equal(NEW.meshGeoParse(bad), null, `틀린 꼴 ${bad}`);
  }
  /* 틀린 geo 를 받아도 메시는 4겹(기본 모서리)으로 그린다 */
  const css = NEW.sectionMeshCss(attr(SAVED, 'data-bg-mesh'), NEW.meshGeoParse('abc') || undefined);
  assert.equal((css.image.match(/radial-gradient\(/g) || []).length, 4);
  assert.ok(!/ellipse \d/.test(css.image), '기본 모서리 글자');
});

test('A3 ★옛 리더(v0.9.10)가 새 저장을 읽어도 4겹을 그린다 (＋꼬리 꼴은 null = 양성대조)', () => {
  const spec = attr(SAVED, 'data-bg-mesh');
  assert.ok(attr(SAVED, 'data-bg-mesh-geo'), '전제: 새 저장에 geo 가 있다');
  const corners = OLD.meshCornersOf(spec);
  assert.equal(corners?.length, 4, '옛 meshCornersOf = 모서리 넷');
  assert.equal(OLD.meshColorsOf(spec)?.length, 4, '옛 meshColorsOf = 색 넷');
  assert.equal((OLD.sectionMeshCss(spec)?.image.match(/radial-gradient\(/g) || []).length, 4, '옛 판도 그린다');
  assert.equal(OLD.meshCornersOf('#ff0080@40% 30% 100% 100%|#7928ca|#00d4ff|#ffdd00'), null, '양성대조: 꼬리 꼴은 옛 리더가 끈다');
});

test('A3b 새 판: 안 움직인 겹은 옛 판과 한 글자도 같고, 움직인 겹만 ellipse rx ry at x y', () => {
  const spec = attr(SAVED, 'data-bg-mesh');
  const g = NEW.meshGeoParse(attr(SAVED, 'data-bg-mesh-geo'));
  const oldL = OLD.sectionMeshCss(spec).image.split(/, (?=radial)/);
  const newL = NEW.sectionMeshCss(spec, g).image.split(/, (?=radial)/);
  assert.equal(newL[1], oldL[1]); assert.equal(newL[3], oldL[3]);
  assert.match(newL[0], /^radial-gradient\(ellipse 100% 100% at 40% 30%, /);
  assert.match(newL[2], /^radial-gradient\(ellipse 80% 120% at 100% 100%, /);
  assert.equal(NEW.sectionMeshCss(spec).image, OLD.sectionMeshCss(spec).image, 'geo 없이 = 옛 글자 그대로');
});
