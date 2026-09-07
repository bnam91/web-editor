/* ★「검사가 초록이다」는 «검사가 본 범위»와 같이 적어야 뜻이 있다.
   2026-09-07 실측: 나는 `find … -name '*.test.js'` 로만 돌려 **55개(.test.mjs)를 통째로 안 셌다**
   — 내가 세던 49개보다 «많은» 수다. 그 안에 이미 «빨간» 검사가 하나 있었고(win-portability ①-3),
   나는 그걸 모른 채 「800/800 통과」라고 세 번 보고했다.
   ⇒ 이 파일은 그 사고를 «반복 불가»로 만든다: 테스트 파일의 «확장자 집합»이 늘면 빨개진다. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const TESTS = path.join(__dirname, '..');

/** tests/ 아래 모든 «검사 파일»의 확장자를 센다. */
function scan() {
  const out = [];
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
      const f = path.join(d, e.name);
      if (e.isDirectory()) walk(f);
      else if (/\.test\.[a-z]+$/.test(e.name)) out.push(f);
    }
  })(TESTS);
  return out;
}

test('S1 ★검사 파일의 «확장자»가 늘면 알린다 — 돌리는 명령이 그걸 따라가야 한다', () => {
  const files = scan();
  assert.ok(files.length > 80, `★파일을 ${files.length}개밖에 못 셌다 — 「0건」이 아니라 «못 잰» 것이다`);

  const exts = [...new Set(files.map((f) => f.split('.test.').pop()))].sort();
  assert.deepStrictEqual(exts, ['js', 'mjs'],
    `★검사 확장자가 ${JSON.stringify(exts)} 로 «변했다». 돌리는 명령을 같이 고쳐라 —
     안 고치면 새 확장자 파일들이 «조용히» 안 돌고, 그 안의 빨강을 아무도 못 본다.
     정본 명령: node --test $(find tests -name '*.test.js' -o -name '*.test.mjs' | sort | tr '\\n' ' ')`);
});

test('S2 ★«확장자별 개수»를 기록으로 남긴다 (다음 사람이 범위를 눈으로 본다)', () => {
  const files = scan();
  const by = {};
  for (const f of files) { const e = f.split('.test.').pop(); by[e] = (by[e] || 0) + 1; }
  const total = Object.values(by).reduce((a, b) => a + b, 0);
  console.log(`  [실측] 검사 파일 ${total}개 — ${JSON.stringify(by)}`);
  // ⚠️숫자를 못박지 «않는다» — 파일이 느는 건 정상이다. 여기서 지키는 건 「범위가 보이게 하는 것」이다.
  assert.strictEqual(total, files.length);
  assert.ok((by.mjs || 0) > 0, '★.mjs 가 0이면 이 검사가 지키려는 사고 자체가 안 보인다(양성대조)');
});

test('S3 ★문서에 적힌 «돌리는 명령»이 두 확장자를 다 덮는다', () => {
  /* 명령을 «사람 기억»에 두면 또 빠뜨린다. 스킬 문서에 박고 그게 맞는지 여기서 본다. */
  const p = path.join(process.env.HOME, '.claude', 'skills', 'goditor-manager-mcp', 'SKILL.md');
  if (!fs.existsSync(p)) { console.log('  (스킬 문서 없음 — 건너뜀)'); return; }
  const doc = fs.readFileSync(p, 'utf8');
  assert.match(doc, /\*\.test\.js/, '★스킬 문서에 «돌리는 명령»이 없다');
  assert.match(doc, /\*\.test\.mjs/, '★문서의 명령이 .mjs 를 빠뜨렸다 — 내가 오늘 그래서 55개를 못 셌다');
});
