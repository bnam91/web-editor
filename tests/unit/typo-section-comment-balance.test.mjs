/* ═══════════════════════════════════════════════════════════════════════════
   ★★«템플릿 리터럴 안의 ★HTML 주석»이 ★조기 종료되지 않는다
   ─────────────────────────────────────────────────────────────────────────────
   ★왜 생겼나 — 2026-10-08 ★현빈이 ★앱에서 ★직접 찾았다:
     `js/props/_typo-section.js` 의 ★점 찍기 주석 안에 ★★«닫는 자»가 들어가
     ★주석이 ★거기서 끊기고 ★아래 4줄이 ★★«속성 패널에 ★글자로 ★인쇄»됐다
     (★250자 · 201×211px · color #e0e0e0 · 패널 넘침 507px 중 ★211px = ★42%).
   ★그 파일 `:189` 가 ★★«백틱·달러중괄호 금지»는 ★적어 뒀는데 ★★«닫는 자 금지»는 ★안 적어
     ★바로 그 자리에서 ★또 밟았다 ⇒ ★★주석으로 못 막은 자리라 ★★구조로 잠근다.
   ★★무력화 대조 = 어느 패널 파일에 ★닫는 자를 ★하나 더 넣으면 ★이 검사가 ★빨개져야 한다.
   ═══════════════════════════════════════════════════════════════════════════ */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../');
const DIR = path.join(REPO, 'js/props');

/** ★HTML 주석 열기/닫기를 ★순서대로 세어 ★깊이와 ★고아를 돌려준다 */
function scan(src) {
  const re = /<!--|-->/g;
  let depth = 0; const orphans = []; let m;
  while ((m = re.exec(src))) {
    if (m[0] === '<!--') depth++;
    else { depth--; if (depth < 0) { orphans.push(m.index); depth = 0; } }
  }
  return { depth, orphans };
}

const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.js')).sort();

test('J1 ★전제 — js/props 에 .js 가 여럿 있다(자가 빈 집합을 재고 있지 않다)', () => {
  assert.ok(files.length >= 10, `js/props 의 .js 가 ${files.length}개뿐이다 — 이 자가 아무것도 안 재고 있다`);
});

test('J1 ★★패널 파일의 HTML 주석이 ★조기 종료되지 않는다 — ★고아 「닫는 자」 0건', () => {
  const bad = [];
  for (const f of files) {
    const src = fs.readFileSync(path.join(DIR, f), 'utf8');
    const { depth, orphans } = scan(src);
    if (orphans.length) bad.push(`${f}: ★고아 닫는 자 ${orphans.length}개 (첫 자리 ${orphans[0]})`);
    if (depth !== 0) bad.push(`${f}: ★안 닫힌 주석 깊이 ${depth}`);
  }
  assert.deepEqual(bad, [],
    '★★주석이 조기 종료되면 ★그 아래 글이 ★속성 패널에 ★인쇄된다(2026-10-08 현빈 실측):\n  ' + bad.join('\n  '));
});

test('J1b ★★양성대조 — ★닫는 자를 ★하나 더 넣은 ★사본에서는 ★★잡힌다', () => {
  const src = fs.readFileSync(path.join(DIR, '_typo-section.js'), 'utf8');
  const anchor = '★또 밟았다).';
  assert.ok(src.includes(anchor), `★전제 깨짐: 양성대조 닻이 없다 — 「${anchor}」`);
  const broken = src.replace(anchor, anchor + ' -->');
  assert.notEqual(broken, src, '⛔치환이 안 먹었다 — 자가 죽었다');
  const { orphans } = scan(broken);
  assert.ok(orphans.length >= 1,
    '⛔양성대조 실패 — ★닫는 자를 더해도 ★이 자가 ★못 잡는다(그러면 위 칸의 초록은 「안 재고 있다」와 같다)');
});
