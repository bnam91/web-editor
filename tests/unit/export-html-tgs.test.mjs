/* 0919r3 textshadow 픽스 — 내보낸 HTML 에도 «그림자는 글자 뒤» 규칙과 필터 정의가 실린다(소스 감시).
 *   내보낸 HTML 은 앱 CSS 를 안 싣고 export-html.js 가 직접 쓰는 <style> 만 갖는다 → .tgs 규칙이 빠지면
 *   인라인 text-shadow 가 그라데이션 위에 칠해지고(페이드 사라짐), url(#tgs-f-…) 는 정의가 없어 글로우가 사라진다. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const EXPORT = strip(fs.readFileSync(path.join(ROOT, 'js/io/export-html.js'), 'utf8'));
const APPCSS = fs.readFileSync(path.join(ROOT, 'css/editor-blocks.css'), 'utf8');

test('export-html: .tgs 규칙이 앱과 같은 뜻으로 실린다', () => {
  assert.match(EXPORT, /\.tgs\{text-shadow:none!important;filter:var\(--tgs-filter\)!important;\}/);
  assert.match(APPCSS, /\.tgs \{\s*text-shadow: none !important;\s*filter: var\(--tgs-filter\) !important;\s*\}/);
});

test('export-html: 클론이 쓰는 SVG 필터 정의를 body 에 넣는다', () => {
  assert.match(EXPORT, /textGradShadowDefsMarkup\(clone\)/);
  assert.match(EXPORT, /<body>\s*\$\{tgsDefs\}/);
});
