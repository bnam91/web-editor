/* 242(+243 한 입구) — AI 채우기 «적용됨» 미리보기가 모델 글을 innerHTML 로 «그대로» 심나
 *   자리: js/ai-section-fill.js 의 미리보기 덩이(`const byId = new Map(` … `preview.innerHTML = …;`) — 그 덩이만 떠서 돌린다.
 *   칸 넷: rep.text(모델) · add.text(모델) · add.style(모델) · styleLbl(문서 블럭의 style — 다른 입구지만 같은 innerHTML 로 간다).
 *   243 OCR 길: 그림을 붙여 채우기를 돌려도 모델 응답은 같은 replacements/additions 로 이 덩이를 지난다 ⇒ 같은 자가 그 길도 잰다.
 *   한 쌍: 고치기 전 판(333aa3d9)에서 T1 빨강 · 고친 판에서 초록. */
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readSrc } from './_srcread.js';
import { createRequire } from 'node:module';
const { sliceBlock } = createRequire(import.meta.url)('./_slice-block.js');

const ROOT = process.env.GD1001_ROOT || path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC = readSrc(ROOT, 'js/ai-section-fill.js');   // ★읽기는 readSrc 한 문(CRLF 정규화 · win-portability ①-3)
/* 제품 이스케이프(js/props/_helpers.js 의 escHtml)를 «그 글 그대로» 떠서 쓴다 — 그 파일은 .js ESM 이라 node 가 바로 못 import 한다.
   ★자르기는 공용 sliceBlock(짝 괄호 · 이름꼴 닻 — slice-block-shared SB-16 · 닻 래칫). */
const escHtml = new Function(`${sliceBlock(readSrc(ROOT, 'js/props/_helpers.js'), 'export function escHtml(').replace('export ', '')}; return escHtml;`)();

/* 미리보기 덩이 = 첫 닻에서 «preview.innerHTML = …;» 줄 끝까지(고정 창 아님 · 두 닻 사이) */
const A = SRC.indexOf('const byId = new Map(');
const B = A < 0 ? -1 : SRC.indexOf('preview.innerHTML = ', A);
const E = B < 0 ? -1 : SRC.indexOf(';\n', B);
const seg = A >= 0 && E > B ? SRC.slice(A, E + 1).replace('preview.innerHTML = ', 'return ') : '';
const build = seg ? new Function('res', 'blocks', 'additions', 'extApplied', 'escHtml', seg) : null;

const BAD = '<img src=x onerror="window.__p242=1">';
const run = () => build(
  { replacements: [{ id: 'b1', text: BAD }] },
  [{ id: 'b1', style: 'tb-' + BAD }],
  [{ style: BAD, text: BAD }],
  0,
  escHtml);

test('T0 전제 — 미리보기 덩이를 떴고 그 안에 네 칸이 있다', () => {
  assert.ok(build, '덩이를 못 떴다(닻 둘 · preview.innerHTML 을 못 찾음)');
  assert.equal(typeof escHtml, 'function', 'js/props/_helpers.js 의 escHtml 을 못 떴다');
  assert.equal(escHtml('<a>&"\''), '&lt;a&gt;&amp;&quot;&#39;', 'escHtml 이 다섯 글자를 다 바꾼다(전제)');
  for (const k of ['rep.text', 'add.text', 'add.style', 'styleLbl']) assert.ok(seg.includes(k), `덩이에 ${k} 칸이 없다`);
  const html = build({ replacements: [{ id: 'b1', text: '안녕' }] }, [{ id: 'b1', style: 'tb-body' }], [], 0, escHtml);
  assert.ok(html.includes('안녕') && html.includes('body'), '맞는 글이 미리보기에 안 나온다(자가 눈멀었다)');
});

test('T1 모델 글·문서 style 의 태그 꼴이 «글자 그대로»(이스케이프) 들어간다 — <img 태그가 안 생긴다(242)', () => {
  const html = run();
  assert.equal((html.match(/<img\b/gi) || []).length, 0, `미리보기 HTML 에 날 <img 가 섰다 — innerHTML 로 실행된다\n${html}`);
  assert.equal((html.match(/&lt;img\b/g) || []).length, 4, `네 칸(rep.text · add.text · add.style · styleLbl) 다 글자로 보여야 한다\n${html}`);
});
