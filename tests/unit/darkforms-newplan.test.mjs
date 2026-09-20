/* darkforms-newplan.test.mjs — 0920b 두 건의 «소스 계약».
 *   실행: node --test "tests/unit/*.test.mjs"  ·  소스만 읽는다(라이브 무접촉).
 *
 * ① 다크 색 체계 — 앱 문서에 `color-scheme: dark` 가 «한 곳»에서 선언돼 있는가.
 *    ★왜 계약으로 고정하나: 이 앱엔 라이트 테마가 없는데도 문서는 `color-scheme: normal` 이라
 *      브라우저가 «체크 안 된» 라디오·체크박스를 밝은 테마로 그렸다(현빈 신고 2026-09-20:
 *      「우측패널 라디오버튼 css가 흰색인거는 css 적용이안된거니?」).
 *      원인은 «CSS 가 안 먹은» 게 아니라 «색 체계 선언이 없는» 것이다 —
 *      appearance:auto 인 네이티브 컨트롤은 author 의 background 를 «무시하고» UA 가 칠한다.
 *    ★선례 = css/release-note.css(2026-09-19): 같은 증상에 「accent-color 는 지정하지 않는다,
 *      color-scheme: dark 한 줄만 남긴다」로 정리했다. 그 답을 «전역»으로 올린 것이 이 계약이다.
 *    ★왜 개별 선택자가 아니라 한 곳인가 = css/editor-base.css:418 의 스크롤바 코너와 같은 규율 —
 *      「개별로 붙이면 반드시 한 곳이 빠진다」.
 *
 * ② 기획모드(New Plan) — 아직 «비활성»이어야 한다(현빈 지시 2026-09-20).
 *    ★근거(실측): main.js `_listProjectsImpl` 의 두 걸름망이 모두 /^proj_\d+$/ 라
 *      plan_* 프로젝트는 «만들어져도 목록에 안 뜬다»(9397 실기 재현: plan_1789885549682 가
 *      디스크에 생겼는데 projects:list 는 [] 를 돌려줬다). 버튼이 살아 있으면
 *      «만들었는데 사라지는» 경험이 된다.
 *    ★되살리는 조건 = T-064(목록 필터가 plan_* 도 받게 되는 것). 그때 PLAN_MODE_ENABLED 를 true 로.
 *    ⛔기능 코드를 지우지 않는다 — 스위치 하나로 껐다 켠다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(HERE, '..', '..');
const read = (p) => fs.readFileSync(path.join(REPO, p), 'utf8');

/** `:root { ... }` 블록들 안에 color-scheme: dark 가 있나 (주석 안은 안 센다). */
function rootDeclaresDarkScheme(css) {
  const noComment = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const blocks = [...noComment.matchAll(/:root[^{]*\{([^}]*)\}/g)].map((m) => m[1]);
  return blocks.some((b) => /color-scheme\s*:\s*dark\s*(;|$)/.test(b));
}

test('DF-1 ① 다크 색 체계가 «공용 CSS»에서 :root 에 선언돼 있다', () => {
  assert.equal(rootDeclaresDarkScheme(read('css/design-tokens.css')), true,
    'css/design-tokens.css :root 에 color-scheme: dark 가 없다 — 앱 문서가 밝은 테마로 폼 컨트롤을 그린다');
});

test('DF-2 ① 그 공용 CSS 를 «CSS 를 쓰는 모든 앱 창»이 실제로 읽는다', () => {
  // design-tokens.css 는 editor-base.css 가 @import 하고, license.html 은 직접 링크한다.
  assert.match(read('css/editor-base.css'), /@import\s+['"]\.\/design-tokens\.css['"]/,
    'editor-base.css 가 design-tokens.css 를 @import 하지 않는다');
  for (const [page, href] of [
    ['index.html', 'css/editor-base.css'],
    ['pages/projects.html', '../css/editor-base.css'],
    ['pages/template-browser.html', '../css/editor-base.css'],
    ['pages/license.html', '../css/design-tokens.css'],
  ]) {
    assert.ok(read(page).includes(`href="${href}"`), `${page} 가 ${href} 를 안 읽는다`);
  }
});

test('DF-3 ① 자체 인라인 CSS 를 쓰는 창(planning.html)도 같은 선언을 갖는다', () => {
  // planning.html 은 외부 CSS 를 하나도 안 읽는다(자체 <style> + 자체 :root) ⇒ 전역이 안 닿는다.
  const html = read('pages/planning.html');
  assert.equal(html.includes('rel="stylesheet"'), false,
    'planning.html 이 외부 CSS 를 읽게 바뀌었다 — 이 검사의 전제를 다시 보라');
  assert.equal(rootDeclaresDarkScheme(html), true,
    'pages/planning.html 의 :root 에 color-scheme: dark 가 없다');
});

test('DF-4 ② New Plan 버튼이 비활성이다 — aria-disabled + 이유 툴팁 (⛔disabled 속성 금지)', () => {
  const html = read('pages/projects.html');
  const m = html.match(/<button id="btn-new-planning"[^>]*>/);
  assert.ok(m, '#btn-new-planning 버튼을 못 찾았다');
  const tag = m[0];
  assert.match(tag, /aria-disabled="true"/, 'aria-disabled="true" 가 없다');
  assert.match(tag, /class="[^"]*\bis-disabled\b/, 'is-disabled 클래스가 없다');
  assert.match(tag, /title="[^"]*준비 중/, '이유를 알리는 title 툴팁이 없다');
  assert.doesNotMatch(tag, /\sdisabled(\s|=|>)/,
    'disabled 속성을 쓰면 크로미움이 hover 를 안 줘 title 툴팁이 안 뜬다(기획 카드 📁 와 같은 규율)');
  assert.doesNotMatch(tag, /onclick=/, '비활성인데 onclick 이 남아 있다');
});

test('DF-5 ② 스위치 한 줄로 껐다 — 기능 코드는 지우지 않았고 되살리는 조건이 적혀 있다', () => {
  const html = read('pages/projects.html');
  assert.match(html, /const\s+PLAN_MODE_ENABLED\s*=\s*false/, 'PLAN_MODE_ENABLED 스위치가 없다');
  assert.match(html, /T-064/, '되살리는 조건(T-064)이 주석에 없다');
  // 기능 코드는 그대로 있어야 한다 — 「지우지 말고 끈다」
  assert.match(html, /async function createPlanningProject\(\)/, 'createPlanningProject 가 사라졌다');
  assert.match(html, /'plan_'\s*\+\s*Date\.now\(\)/, '기획 프로젝트 생성 코드가 사라졌다');
});

test('DF-6 ② 함수 자신이 막는다 — 화면을 우회해 불러도 프로젝트가 안 생긴다', () => {
  const html = read('pages/projects.html');
  const body = html.slice(html.indexOf('async function createPlanningProject()'));
  const guard = body.slice(0, body.indexOf('await saveNewProject'));
  assert.match(guard, /PLAN_MODE_ENABLED/,
    'createPlanningProject 가 saveNewProject 앞에서 PLAN_MODE_ENABLED 를 안 본다 — '
    + '화면만 막으면 콘솔·남은 DOM 참조로 그대로 만들어진다(planning.html 이 같은 이유로 «페이지 자신»이 막는다)');
});
