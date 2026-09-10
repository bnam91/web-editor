/* U-H — 확대블럭(Zoom) 다듬기 4건. (2026-09-08, 현빈 지시)
 *   실행: node --test "tests/unit/*.test.mjs" "tests/unit/*.test.js"
 *   ⛔`node --test tests/unit`(디렉터리 인자)로 부르지 마라 — Node 24 에서 한 개도 안 돌고
 *     화면엔 「tests 1 / pass 0 / fail 1」로 «작은 실패»처럼 보인다. 1738개가 «안 돈 것»을
 *     「하나 깨짐」으로 오독한다.
 *
 * ★현빈 원문
 *   「줌블럭은 스티커 패널에 넣어줘야하고 / 처음 버튼눌러 추가하면 모서리 버튼이 안보여.
 *     몇번 클릭해야 보이는데 첨부터 핸들이 있어야되는거잖아. / zm-img-drop 이거는 버튼으로
 *     해도되지않을까 다른 에셋블럭들처럼?」
 *
 * ★★이 파일의 규율 — 「입력이 살아 있다」를 «먼저» 단언한다
 *   훑는 목록이 비면 그 뒤의 루프·정규식 검사는 전부 «0바퀴»로 자기통과한다.
 *   오늘 이 팀에서 루프 검사 6개가 표를 비우니 전부 초록이 됐다. 그래서 각 검사의 첫 줄은
 *   «무엇을 훑고 있는지»를 세는 단언이다. 셀 것이 사라지면 그게 «먼저» 빨개진다.
 *
 * ⚠️이 파일은 «소스 문자열»을 단언한다. 정상 리팩터링에도 빨강이 날 수 있다 —
 *   그때는 지우지 말고 「현빈이 요구한 넷이 여전히 성립하는가」를 확인한 뒤 패턴을 고쳐라.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
/* ⛔주석 걷어내기는 «공용 부품»만 쓴다 — 자기 벌을 만들면 S-6(strip-comments-shared)가 빨강. */
const { stripComments } = require('./_strip-comments.js');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '../../');
const read = (rel) => fs.readFileSync(path.join(REPO, rel), 'utf8');

const F_HTML = 'index.html';
const F_ZOOM = 'js/blocks/zoom-block.js';
const F_OVL  = 'js/overlay-handles.js';
const F_PROP = 'js/props/prop-zoom.js';
const F_CSS  = 'css/editor-blocks.css';

/* ── 부품: 중괄호 균형으로 «함수 몸통»을 떼어낸다 ─────────────────────────────
   ⛔고정 창(slice(i, i+900)) 금지 — 함수가 자라면 창 밖으로 나가고, 검사는
     「없으니 통과」로 초록이 된다. 창이 아니라 «균형»으로 끊는다. */
function funcBody(src, signature) {
  const at = src.indexOf(signature);
  assert.ok(at >= 0, `함수를 못 찾았다: ${signature}`);
  let from = at + signature.length;
  /* ⚠️매개변수의 «기본값 중괄호»를 몸통으로 오인하지 않는다 —
       `function addZoomBlock(opts = {}) {` 에서 첫 `{` 는 몸통이 아니라 기본값이다.
       그걸 몸통으로 잡으면 «빈 몸통»이 나오고, 뒤의 단언이 전부 0바퀴로 자기통과한다
       (실제로 이 파일을 쓰다가 T-H3 이 그렇게 새는 것을 「입력이 살아 있다」가 잡았다).
       ⇒ 서명이 `(` 로 끝나면 매개변수 괄호를 «닫는 데»까지 먼저 걸어간다. */
  if (signature.endsWith('(')) {
    let pd = 1;
    while (from < src.length && pd > 0) {
      if (src[from] === '(') pd++;
      else if (src[from] === ')') pd--;
      from++;
    }
    assert.ok(pd === 0, `매개변수 괄호가 안 닫힌다: ${signature}`);
  }
  const open = src.indexOf('{', from);
  assert.ok(open >= 0, `여는 중괄호를 못 찾았다: ${signature}`);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) return src.slice(open + 1, i); }
  }
  assert.fail(`중괄호가 안 닫힌다: ${signature}`);
}

/* HTML 드롭다운 메뉴 하나를 떼어낸다. 메뉴 안은 <button> 과 주석뿐이라 첫 </div> 가 끝이다. */
function menuBody(html, id) {
  const at = html.indexOf(`id="${id}"`);
  assert.ok(at >= 0, `메뉴를 못 찾았다: #${id}`);
  const end = html.indexOf('</div>', at);
  assert.ok(end > at, `메뉴가 안 닫힌다: #${id}`);
  return html.slice(at, end);
}

/* CSS 규칙 하나 — 셀렉터 목록과 선언부를 나눠서 준다. */
function cssRules(css) {
  const out = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(css)) !== null) out.push({ sel: m[1].trim(), body: m[2] });
  return out;
}

/* ══════════════════════════════════════════════════════════════════════════
   T-H1 — 스티커 패널로 옮겼나. 닫는 인자도 같이 옮겼나.
   되돌리면 빨강: addZoomBlock 줄을 #fp-component-menu 로 되돌리거나,
                 닫는 인자만 'fp-component-dropdown' 으로 남겨두면.
   ══════════════════════════════════════════════════════════════════════════ */
test('T-H1 Zoom 이 «스티커 패널»(#fp-pen-menu) 안이고, 닫는 인자도 fp-pen-dropdown 이다', () => {
  const html = read(F_HTML);
  const pen  = menuBody(html, 'fp-pen-menu');
  const comp = menuBody(html, 'fp-component-menu');

  // ★입력이 살아 있다 — 두 메뉴를 실제로 떼어냈고, 셀 항목이 있다.
  const penItems  = (pen.match(/fp-menu-item/g)  || []).length;
  const compItems = (comp.match(/fp-menu-item/g) || []).length;
  assert.ok(penItems  >= 7, `스티커 메뉴 항목이 안 잡혔다 (${penItems}개) — 아래 단언이 0바퀴로 자기통과한다`);
  assert.ok(compItems >= 5, `컴포넌트 메뉴 항목이 안 잡혔다 (${compItems}개)`);

  // 줌은 스티커 메뉴에 «있다»
  assert.ok(/addZoomBlock\(\)/.test(pen), 'addZoomBlock 이 #fp-pen-menu 안에 없다');
  // 컴포넌트 메뉴엔 «0건»
  assert.equal((comp.match(/addZoomBlock/g) || []).length, 0,
    'addZoomBlock 이 아직 #fp-component-menu 에 남아 있다 — 옮긴 게 아니라 복사했다');

  // ★닫는 인자 — 빠뜨리면 «남의 메뉴»를 닫으라 시켜서 이 메뉴가 안 닫힌다.
  const onclick = (pen.match(/onclick="addZoomBlock\(\);toggleFpDropdown\('([^']+)'\)"/) || [])[1];
  assert.equal(onclick, 'fp-pen-dropdown',
    `줌 버튼이 닫으라는 드롭다운이 '${onclick}' 이다 — 자기 메뉴('fp-pen-dropdown')를 닫아야 한다`);
});

/* ══════════════════════════════════════════════════════════════════════════
   T-H2 — 줌 핸들이 «자기 클래스»를 갖는다. 남의 일괄 제거에 안 쓸려간다.
   되돌리면 빨강: className 을 `asset-overlay-handle ${dir}` 로 되돌리면.
   ══════════════════════════════════════════════════════════════════════════ */
test('T-H2 줌 핸들은 .zm-overlay-handle 이고, hideAssetResizeHandles 가 그걸 «안 집는다»', () => {
  const src  = stripComments(read(F_OVL));
  const show = funcBody(src, 'function showZoomResizeHandles(');
  const hide = funcBody(src, 'function hideAssetResizeHandles(');

  // ★입력이 살아 있다 — 두 몸통을 실제로 떼어냈다.
  assert.ok(show.includes('createElement'), 'showZoomResizeHandles 몸통이 비었다 — 아래가 0바퀴로 통과한다');
  assert.ok(hide.includes('querySelectorAll'), 'hideAssetResizeHandles 몸통이 비었다');

  // 줌 핸들이 실제로 붙이는 클래스 문자열을 «소스에서» 읽는다.
  const cls = (show.match(/className\s*=\s*`([^`]*)`/) || [])[1];
  assert.ok(cls, 'showZoomResizeHandles 가 className 을 안 붙인다');
  const tokens = cls.replace(/\$\{[^}]*\}/g, ' ').trim().split(/\s+/).filter(Boolean);
  assert.ok(tokens.length >= 1, `클래스 토큰이 안 잡혔다: ${cls}`);
  assert.ok(tokens.includes('zm-overlay-handle'),
    `줌 핸들 클래스가 ${JSON.stringify(tokens)} 다 — 자기 클래스 zm-overlay-handle 을 가져야 한다`);
  assert.ok(!tokens.includes('asset-overlay-handle'),
    '줌 핸들이 .asset-overlay-handle 을 «빌려 쓰고» 있다 — hideAssetResizeHandles 의 일괄 제거에 같이 쓸려나간다');

  // ★남의 청소기가 «집는 클래스»를 모아, 줌 토큰과 겹치는지 본다.
  const swept = [...hide.matchAll(/querySelectorAll\(\s*'([^']+)'\s*\)/g)].map(m => m[1]);
  assert.ok(swept.length >= 1, 'hideAssetResizeHandles 에서 제거 셀렉터를 못 읽었다 — 아래가 0바퀴다');
  for (const sel of swept) {
    for (const t of sel.split(',').map(s => s.trim())) {
      if (!t.startsWith('.')) continue;
      assert.ok(!tokens.includes(t.slice(1)),
        `hideAssetResizeHandles 의 '${t}' 가 줌 핸들(${JSON.stringify(tokens)})까지 쓸어간다`);
    }
  }
});

/* ══════════════════════════════════════════════════════════════════════════
   T-H3 — 추가 경로가 «캔버스 클릭 경로와 같은 두 줄»을 부른다.
   되돌리면 빨강: addZoomBlock 에서 showHandlesFor 한 줄만 지워도.
   ══════════════════════════════════════════════════════════════════════════ */
test('T-H3 addZoomBlock 이 showZoomProperties 와 showHandlesFor 를 «둘 다» 부른다', () => {
  const add = funcBody(stripComments(read(F_ZOOM)), 'function addZoomBlock(');

  // ★입력이 살아 있다 — 추가 함수 몸통을 실제로 떼어냈다.
  assert.ok(add.includes('appendChild'), 'addZoomBlock 몸통이 비었다 — 아래가 자기통과한다');

  assert.ok(/showZoomProperties/.test(add),
    '추가 직후 우측 패널이 줌 패널이 아니다 — window.selectBlock 만으로는 showTextProperties 로 샌다');
  assert.ok(/showHandlesFor/.test(add),
    '★추가 직후 모서리 핸들이 0개다 — block-drag 의 클릭 경로엔 있는 showHandlesFor 가 추가 경로에만 없다');
});

/* ══════════════════════════════════════════════════════════════════════════
   T-H4 — 빗장이 «지워진 상태»를 알아챈다.
   되돌리면 빨강: `if (_zoomResizeBlock === zb) return;` 옛 형태로 되돌리면.
   ══════════════════════════════════════════════════════════════════════════ */
test('T-H4 showZoomResizeHandles 의 빗장이 «핸들이 지워진 것»을 알아챈다', () => {
  const show = funcBody(stripComments(read(F_OVL)), 'function showZoomResizeHandles(');

  /* ★입력이 살아 있다 — 몸통에 early-return 이 실제로 있다.
     ⛔조건에 괄호가 «중첩»되므로 /\([^)]*\)/ 로는 못 뜬다. 표식에서부터 걸어서 뗀다. */
  const mark = show.indexOf('_zoomResizeBlock === zb');
  assert.ok(mark >= 0, 'showZoomResizeHandles 에서 _zoomResizeBlock 빗장을 못 찾았다 — 아래가 0바퀴다');
  const ifAt = show.lastIndexOf('if', mark);
  const retAt = show.indexOf('return', mark);
  assert.ok(ifAt >= 0 && retAt > mark, '빗장이 `if (…) return;` 꼴이 아니다 — 아래가 0바퀴다');
  const guard = show.slice(ifAt, show.indexOf(';', retAt) + 1);
  assert.ok(guard.includes('_zoomResizeBlock'), '빗장 문장을 못 떼어냈다');

  // 옛 형태 = 「같은 블록인가」만 보고 나간다. 그러면 핸들이 이미 쓸려나간 뒤에도 재생성을 막는다.
  assert.ok(!/^if\s*\(\s*_zoomResizeBlock\s*===\s*zb\s*\)\s*return;$/.test(guard.trim()),
    '★빗장이 «같은 블록인가»만 본다 — 남의 청소기가 핸들을 지운 뒤에도 재생성을 막아 4→0 이 영구화된다');

  // 새 형태 = 「그러면서 핸들이 DOM 에 실제로 있는가」까지 본다.
  assert.ok(/querySelector/.test(guard) && /data-zoom-resize-dir/.test(guard),
    '빗장이 DOM 에 핸들이 «남아 있는지»를 확인하지 않는다');
});

/* ══════════════════════════════════════════════════════════════════════════
   T-H5 — 버튼은 «추가»지 «교체»가 아니다. 드롭존 네 리스너가 살아 있다.
   되돌리면 빨강: drop 리스너를 지우거나, 버튼에 새 클래스를 쓰면.
   ══════════════════════════════════════════════════════════════════════════ */
test('T-H5 이미지 «버튼»이 생겼고 드롭존 네 리스너(dragenter/dragover/dragleave/drop)가 살아 있다', () => {
  const raw = read(F_PROP);
  const src = stripComments(raw);

  // ★입력이 살아 있다 — 드롭존 배선 블록을 실제로 떼어냈다.
  const wiring = funcBody(src, 'const drop = ');
  assert.ok(wiring.includes('addEventListener'),
    '드롭존 배선 블록이 비었다 — 아래 네 단언이 0바퀴로 자기통과한다');

  for (const ev of ['dragenter', 'dragover', 'dragleave', 'drop']) {
    assert.ok(wiring.includes(`'${ev}'`),
      `★드롭존의 '${ev}' 리스너가 사라졌다 — 버튼은 «추가»지 드래그앤드롭의 «교체»가 아니다`);
  }
  assert.ok(/addEventListener\(\s*'drop'/.test(wiring),
    "실제 파일을 받는 addEventListener('drop', …) 이 사라졌다 — 드롭해도 이미지가 안 들어간다");

  // 버튼 — 어휘는 prop-asset.js 것을 빌린다(새 클래스 금지).
  const btn = (src.match(/<button class="([^"]*)" id="zm-img-btn"/) || [])[1];
  assert.ok(btn, '이미지 선택 버튼(#zm-img-btn)이 없다');
  assert.ok(btn.split(/\s+/).includes('prop-action-btn'),
    `버튼 클래스가 '${btn}' 이다 — 다른 에셋 블록과 같은 prop-action-btn 을 써야 한다(새 클래스 금지)`);
  /* 버튼이 «물려» 있나 — 마크업만 있고 리스너가 없으면 눌러도 아무 일도 안 난다.
     querySelector('#zm-img-btn') … addEventListener('click', …) 한 줄을 확인한다. */
  assert.ok(/querySelector\('#zm-img-btn'\)[\s\S]{0,40}addEventListener\(\s*'click'/.test(src),
    '버튼(#zm-img-btn)에 click 리스너가 안 붙어 있다 — 눌러도 아무 일도 안 난다');
});

/* ══════════════════════════════════════════════════════════════════════════
   T-H6 — CSS 는 «공유»다(복사 아님). 보라 한정자도 «같이» 옮겼다.
   되돌리면 빨강: .zm-overlay-handle 을 새 규칙으로 떼어내거나,
                 보라 한정자를 .asset-overlay-handle[…] 로 남겨두면.
   ══════════════════════════════════════════════════════════════════════════ */
test('T-H6 .zm-overlay-handle 이 기존 규칙에 «얹혀» 있고, 보라 한정자도 같이 옮겨졌다', () => {
  const css = stripComments(read(F_CSS));
  const rules = cssRules(css);

  // ★입력이 살아 있다 — 규칙을 실제로 갈랐다.
  assert.ok(rules.length >= 20, `CSS 규칙이 ${rules.length}개밖에 안 잡혔다 — 아래가 0바퀴로 자기통과한다`);

  // ⑴ 모양 규칙 = .asset-overlay-handle 과 .icb-overlay-handle 이 함께 있는 «그» 규칙.
  const shared = rules.find(r => /\.asset-overlay-handle\s*,/.test(r.sel)
                              && r.sel.includes('.icb-overlay-handle')
                              && /width:\s*7px/.test(r.body));
  assert.ok(shared, '기존 공유 규칙(.asset-overlay-handle, .icb-overlay-handle)을 못 찾았다');
  assert.ok(shared.sel.includes('.zm-overlay-handle'),
    '★.zm-overlay-handle 이 기존 규칙에 «안 얹혀» 있다 — 새 규칙을 만들면 복사지 공유가 아니다');

  // ⑵ 보라 한정자 — 확대블럭 핸들만 보라. 클래스가 갈라졌으니 셀렉터도 같이 가야 한다.
  const purple = rules.filter(r => r.sel.includes('[data-zoom-resize-dir]'));
  assert.equal(purple.length, 1, `보라 한정자 규칙이 ${purple.length}개다 — 하나여야 한다`);
  assert.ok(purple[0].sel.includes('.zm-overlay-handle'),
    `★보라 한정자가 '${purple[0].sel}' 에 남아 있다 — 클래스를 갈랐으면 한정자도 같이 옮겨야 한다. 안 옮기면 줌 핸들만 색을 잃는다`);
  assert.ok(!/\.asset-overlay-handle\[data-zoom-resize-dir\]/.test(purple[0].sel),
    '보라 한정자가 아직 .asset-overlay-handle 에 걸려 있다 — 줌 핸들에는 안 걸린다');
  assert.ok(/border-color/.test(purple[0].body), '보라 한정자 규칙에 border-color 가 없다');
});
