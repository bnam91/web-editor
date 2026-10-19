/* laurel-leaf-svg.test.mjs — 월계수 실루엣 «정의 자리» 전수 (소스 읽기 · node --test)
 *
 * ★★261019 — ★실루엣이 ★★0.9.7 판으로 ★되돌아왔다(현빈 「0.9.8 되면서 바뀐 건데 ★원래대로 돌려」).
 *   ⇒ ★T-G3-6 은 ★「옛 것과 ★다르다」에서 ★★「0.9.7 판이 ★서 있다」로 ★뒤집혔다.
 *   ⛔아래 ★1017t1g3㉡ 서술은 ★★역사다 — ★지우지 ★마라(그때 ★무엇을 ★왜 ★했는지가 ★남아야 한다).
 * ─── 아래부터 역사 ───
 * (1017t1g3㉡ 새 월계수 실루엣 — 그때의 머리말)
 *
 * ★현빈 원문(1017t1g3㉡): 「다른 svg 로 해줘. Laurel 연상되는 걸로」
 * ★정본(외부 금지): js/graph-shape.js:26-27 「내장 실루엣 … «직접 그린» 것(외부 아이콘 0) · viewBox 는
 *   잉크에 딱 맞는다」. 새 LAUREL_LEFT_PATH 는 줄기 ＋ 잎 8장을 cubic bezier 로 손수 그렸다(외부 소스 0).
 *
 * ⛔이 모듈을 import 하지 않는다 — js/blocks/laurel-block.js 끝의 `window.xxx = ...` 가 가드 없이
 *   최상위에서 돈다(브라우저 전제, DOM 없는 node 에선 ReferenceError) ⇒ «정의 자리»를 소스 글자로 읽어
 *   센다(hover-suppress-parity.test.mjs · css-comment-before-rule.test.mjs 와 같은 길).
 *   ⚠️⒜ 의 「1개」는 «사용 자리 grep»이 아니라 `const LAUREL_..._PATH =` «정의 자리»로 센다.
 *
 * ★구조 불변의 까닭 — tests/dom/h2c-svg-transform.dom.spec.js H2 가 「transform 개수 = mirror 1개」를
 *   `withh.lifted === 2`(월계수 오른 잎 ＋ 말풍선 꼬리)로 이미 잠가 뒀다. 여기서 ⒞ 로 미리 재서,
 *   DOM 시험이 빨개지기 전에 소스에서 먼저 잡는다(같은 요건을 두 자리에서 — 값은 그 DOM 시험이 정본).
 *
 * 실행: node --test tests/unit/laurel-leaf-svg.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const FILE = path.join(REPO, 'js', 'blocks', 'laurel-block.js');
const SRC = fs.readFileSync(FILE, 'utf8');

/* ══ 소스에서 재는 자(함수) — 실물·음성대조 양쪽에 같은 자를 쓴다(⛔손으로 둘째 명부 안 만든다) ══ */
const countPathConsts = (src) => [...src.matchAll(/^const LAUREL_[A-Z_]*PATH = '/gm)];
const viewboxWH = (src) => { const m = src.match(/const LAUREL_VIEWBOX = '0 0 (\d+) (\d+)'/); return m ? [Number(m[1]), Number(m[2])] : null; };
const widthRatio = (src) => { const m = src.match(/Math\.round\(height \* (\d+) \/ (\d+)\)/); return m ? [Number(m[1]), Number(m[2])] : null; };
const svgFnBody = (src) => { const m = src.match(/function _laurelLeafSvg\([^)]*\)\s*\{([\s\S]*?)\n\}/); return m ? m[1] : null; };
const pathLiteral = (src) => { const m = src.match(/const LAUREL_[A-Z_]*PATH = '([^']*)'/); return m ? m[1] : null; };

/* ══ ⒜ 상수는 정의 자리에 정확히 1개 ══ */
test('T-G3-1 ⒜ LAUREL_*_PATH 상수 — 정의 자리에 정확히 1개', () => {
  const found = countPathConsts(SRC);
  assert.equal(found.length, 1, `LAUREL_*_PATH 정의가 ${found.length}개 — 정확히 1개여야 한다`);
});
test('T-G3-1n 음성대조 — 상수를 하나 더 심으면 2개로 잡힌다(자가 살아 있음)', () => {
  const twoConst = SRC.replace(/^const LAUREL_VIEWBOX = /m, `const LAUREL_DUMMY_PATH = 'M0 0Z';\nconst LAUREL_VIEWBOX = `);
  const found = countPathConsts(twoConst);
  assert.equal(found.length, 2, `일부러 2개로 늘렸는데 ${found.length}개로 잡혔다 — 자가 죽었다`);
});

/* ══ ⒝ LAUREL_VIEWBOX 와 Math.round(height*170/324) 가 짝이 맞는다(명부 둘 — 어긋나면 안 된다) ══ */
test('T-G3-2 ⒝ LAUREL_VIEWBOX(170x324) 와 width 산식이 짝이 맞는다', () => {
  const vb = viewboxWH(SRC), wr = widthRatio(SRC);
  assert.ok(vb, 'viewBox 패턴을 못 찾았다');
  assert.ok(wr, 'width 산식 패턴을 못 찾았다');
  assert.deepEqual(wr, vb, `viewBox=${JSON.stringify(vb)} 인데 산식=${JSON.stringify(wr)} — 둘이 짝이 안 맞는다`);
});
test('T-G3-2n 음성대조(반례 단언 — !regex 한쪽만 금지) — 산식만 어긋내면 짝이 깨진다', () => {
  const mismatched = SRC.replace(/Math\.round\(height \* 170 \/ 324\)/, 'Math.round(height * 170 / 300)');
  const vb = viewboxWH(mismatched), wr = widthRatio(mismatched);
  assert.notDeepEqual(wr, vb, '일부러 어긋낸 값인데 같다고 나왔다 — 자가 죽었다');
});
test('T-G3-2n2 음성대조(반례 둘째) — viewBox 문자열만 어긋내도 짝이 깨진다', () => {
  const mismatched = SRC.replace(/const LAUREL_VIEWBOX = '0 0 170 324'/, `const LAUREL_VIEWBOX = '0 0 170 300'`);
  const vb = viewboxWH(mismatched), wr = widthRatio(mismatched);
  assert.notDeepEqual(wr, vb, '일부러 어긋낸 viewBox 인데 산식과 같다고 나왔다 — 자가 죽었다');
});

/* ══ ⒞ _laurelLeafSvg 구조 — svg 1개 · path 1개 · transform 은 mirror 삼항에만 1회 ══
 *   (h2c-svg-transform.dom.spec.js H2 가 이 구조를 전제로 lifted===2 를 잠근다 — 구조가 깨지면 거기서 빨개진다) */
test('T-G3-3 ⒞ _laurelLeafSvg — <svg> 1개 · <path> 1개 · transform 은 mirror 삼항에만 1곳', () => {
  const body = svgFnBody(SRC);
  assert.ok(body, '_laurelLeafSvg 함수 본문을 못 찾았다');
  const transforms = [...body.matchAll(/transform:/g)];
  assert.equal(transforms.length, 1, `transform: 이 ${transforms.length}곳 — 정확히 1곳(mirror 삼항)이어야 한다`);
  assert.match(body, /mirror \? 'transform:scaleX\(-1\);' : ''/, 'transform 이 mirror 삼항 밖에 있다(꼴이 바뀌었다)');
  const svgTags = [...body.matchAll(/<svg\b/g)];
  const pathTags = [...body.matchAll(/<path\b/g)];
  assert.equal(svgTags.length, 1, `반환 템플릿의 <svg> 태그가 ${svgTags.length}개 — 1개여야 한다`);
  assert.equal(pathTags.length, 1, `반환 템플릿의 <path> 태그가 ${pathTags.length}개 — 1개여야 한다(d 속성 안 subpath 는 무관)`);
});
test('T-G3-3n 음성대조 — transform 을 하나 더 심으면 2곳으로 잡힌다', () => {
  const body = svgFnBody(SRC);
  const poisoned = body.replace('flex-shrink:0;', 'flex-shrink:0;transform:translateX(1px);');
  const transforms = [...poisoned.matchAll(/transform:/g)];
  assert.equal(transforms.length, 2, `일부러 하나 더 심었는데 ${transforms.length}곳으로 잡혔다 — 자가 죽었다`);
});

/* ══ ⒟ 외부 자원 0건 — «바깥에서 끌어오는 참조»(href/src=http… · <image> · xlink:href=http…) 가
 *   LAUREL_*_PATH 문자열·_laurelLeafSvg 본문에 없다.
 *   ⛔바닥 문자열 "http" 를 그대로 금지어로 쓰지 않는다 — 1차로 그렇게 짰더니 SVG 표준 네임스페이스
 *   `xmlns="http://www.w3.org/2000/svg"`(graph-shape.js 도 5곳에서 똑같이 쓴다 — 이 레포의 정상 꼴)에
 *   걸려 거짓양성이 났다(실측으로 잡았다). ⇒ 「href/src 속성이 http(s) 를 가리키는가」로 좁힌다.
 *   ⛔`url(#...)` 도 제외 — 같은 함수가 «내부 그라데이션 참조»(fillAttr = `url(#${gid})`)로 이미
 *   정상적으로 쓰고 있다(외부 자원이 아니라 같은 <defs> 를 가리키는 조각 식별자). */
const FORBIDDEN_PATTERNS = [
  [/\bhref\s*=\s*["']https?:/i, 'href="http(s):…"'],
  [/\bsrc\s*=\s*["']https?:/i, 'src="http(s):…"'],
  [/<image\b/i, '<image'],
  [/xlink:href\s*=\s*["']https?:/i, 'xlink:href="http(s):…"'],
];
function forbiddenHits(s) { return FORBIDDEN_PATTERNS.filter(([re]) => re.test(s)).map(([, label]) => label); }

test('T-G3-4 ⒟ 외부 자원 0건 — LAUREL_*_PATH 문자열 안', () => {
  const p = pathLiteral(SRC);
  assert.ok(p, 'LAUREL_*_PATH 문자열을 못 찾았다');
  assert.deepEqual(forbiddenHits(p), [], `path 문자열에 금지어가 있다: ${forbiddenHits(p).join(',')}`);
});
test('T-G3-5 ⒟ 외부 자원 0건 — _laurelLeafSvg 함수 본문 안(url(#내부참조) 는 예외)', () => {
  const body = svgFnBody(SRC);
  assert.deepEqual(forbiddenHits(body), [], `_laurelLeafSvg 본문에 금지어가 있다: ${forbiddenHits(body).join(',')}`);
});
test('T-G3-5n 음성대조 — 외부 참조를 일부러 심으면 잡힌다(xmlns 는 그대로 둬도 거짓양성 없음)', () => {
  const body = svgFnBody(SRC);
  const poisoned = body + '<image href="http://evil.example/x.png" src="http://evil.example/z.png" xlink:href="http://evil.example/y.png">';
  const hits = forbiddenHits(poisoned);
  assert.equal(hits.length, 4, `일부러 넷(href·src·<image·xlink:href)을 심었는데 ${JSON.stringify(hits)} 만 잡혔다 — 자가 죽었다`);
  assert.deepEqual(forbiddenHits(body), [], '전제 — 심기 전(실물 함수 본문, xmlns 포함)은 0건이어야 한다');
});

/* ══ 곁가지 — path 글자가 실제로 바뀌었다(교체했다는 증거 · 옛 path 와 다르다) ══ */
test('T-G3-6 ★0.9.7 실루엣(6585자 · 단일 subpath)으로 ★되돌아와 있다 (261019 현빈)', () => {
  /* ★★261019 — ★이 검사를 ★뒤집었다. ★경위를 ★적는다.
       ★1017t1g3㉡ 「다른 svg 로 해줘. Laurel 연상되는 걸로」로 ★새 실루엣을 ★그렸고(6b2fc1a8),
         ★이 칸은 ★「옛 path(6585자)와 ★달라야 한다」를 ★잠갔다.
       ★★그런데 ★현빈이 ★9334 에서 ★보시고 ★「★0.9.8 버전 되면서 ★바뀐 건데 ★원래대로 ★돌려」라 하셨다.
       ⇒ ★★`LAUREL_LEFT_PATH` 를 ★v0.9.7 값(6585자 · cubic bezier · 단일 subpath)으로 ★복원했다.
       ⇒ ★★그래서 ★이 칸의 ★뜻도 ★뒤집는다 — ★★「되돌아와 ★있나」를 ★잠근다.
       ⛔지우지 ★않았다: ★★«어느 실루엣이 ★서 있나»는 ★앞으로도 ★잠가야 ★한다
         (★다시 ★바꾸려는 ★사람이 ★이 빨강을 ★보고 ★현빈 결정을 ★알게 된다). */
  const p = pathLiteral(SRC);
  assert.ok(p, 'LAUREL_*_PATH 문자열을 못 찾았다');
  assert.equal(p.length, 6585, `path 가 ${p.length}자 — 0.9.7 실루엣(6585자)이 아니다. 바꾸기 전에 현빈 결정을 확인하라`);
  assert.match(p, /^M73\.3342 3\.94941C/, '0.9.7 실루엣의 머리(M73.3342 3.94941C…)가 아니다');
  const mCount = [...p.matchAll(/M/g)].length;
  assert.equal(mCount, 1, `M(subpath 시작) 이 ${mCount}개 — 0.9.7 실루엣은 단일 subpath(1개)다`);
});

