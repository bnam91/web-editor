/* ★_verifyApplied — 「applied 는 인자를 되읊은 것」을 «화면»으로 대조하는 관문.
   2026-09-07 실측으로 드러난 세 가지:
     ⑴ 관문이 «update_block 을 안 잡았다». 조건이 /^update_.*_block$/ 이라 통합 도구 이름이 안 걸렸다
        (제일 많이 쓰이는 이름인데 그것만 비껴갔다). ⇒ 「초록이냐」 전에 «돌기는 하냐»를 먼저 재라.
     ⑵ 못 잰 키를 checked 에 넣고 ok:true 를 냈다 — 거짓 초록. ⇒ checked / notChecked 를 가른다.
     ⑶ 스타일은 «바깥 블록»이 아니라 «안쪽 자식»(.tb-body)에 붙는다. 바깥만 재고
        「applied 가 거짓말한다」고 판정할 뻔했다 — 내 계측이 틀린 것이었다.
   ★양성대조(거짓말 주입, 실측): applied.content 에 화면에 없는 값을 넣으니
     verify.ok=false + actual:'바뀜' via innerText 로 «잡혔다». */
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { readSrc } = require('./_srcread.js');   // ⛔CRLF — win-portability ①-3

const ROOT = path.join(__dirname, '..', '..');
const SRV = readSrc(ROOT, 'main', 'claude-pm', 'mcp-server.js');
const MAIN = readSrc(ROOT, 'main.js');

/* ⛔주석을 «먼저» 걷는다 — 안 그러면 「옛 조건은 이랬다」고 적어 둔 주석까지 세서
     V1 이 «자기 설명문»에 걸려 빨개진다(2026-09-07 실제로 그랬다). 검사는 «코드»를 봐야 한다. */
const codeOnly = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
const gate = () => {
  const src = codeOnly(SRV);
  const i = src.indexOf('const _verifyApplied');
  assert.ok(i > 0, '_verifyApplied 가 없다');
  const end = src.indexOf('};', src.indexOf('catch (_) { return r; }', i));
  assert.ok(end > i, '관문의 끝을 못 찾았다 — 패턴이 썩었다');
  return src.slice(i, end);
};

test('V1 관문이 «update_block» 도 잡는다 — 통합 도구를 비껴가면 안 된다', () => {
  const g = gate();
  assert.doesNotMatch(g, /\^update_\.\*_block\$/,
    '옛 조건이 남아 있다 — 그건 update_block 을 «안» 잡는다(실측 verify:null)');
  assert.match(g, /if \(!\/\^update_\/\.test\(name\)\) return r;/,
    'update_ 로 시작하는 도구를 전부 잡아야 한다');
});

test('V2 «잰 것»과 «못 잰 것»을 갈라 적는다 — 못 잰 것을 초록으로 세지 않는다', () => {
  const g = gate();
  assert.match(g, /const mismatch = \{\}; const checked = \[\]; const notChecked = \{\};/);
  assert.match(g, /if \(!checked\.length\)/,
    '하나도 못 쟀는데 ok:true 를 주면 거짓 초록이다');
  assert.match(g, /ok: null, measured: false/, '못 잰 상태를 «못 잼»으로 말해야 한다');
});

test('V3 글자는 innerText 로, 스타일은 «바깥·안쪽 둘 다»로 잰다', () => {
  const g = gate();
  assert.match(g, /TEXTISH/, '글자류를 dataset 에서만 찾으면 영영 «못 잼»이다');
  assert.match(g, /st\.computedInner/, '안쪽 자식을 안 보면 거짓 빨강이 난다(.tb-body 에 스타일이 붙는다)');
  assert.match(MAIN, /computedInner: csIn/, 'readBlockState 가 안쪽 값을 안 실어 준다');
});

test('V4 색은 «표기»를 맞춰 비교한다 (#ff0000 vs rgb(255,0,0))', () => {
  const g = gate();
  assert.match(g, /const rgb = \(v\) =>/, '색 정규화가 없으면 매번 «못 잼»으로 샌다');
});

test('V5 ★변이대조 — 조건을 옛것으로 되돌리면 V1 이 빨개져야 한다', () => {
  const mutated = codeOnly(SRV).replace(/if \(!\/\^update_\/\.test\(name\)\) return r;/,
                                        "if (!/^update_.*_block$/.test(name)) return r;");
  assert.match(mutated, /\^update_\.\*_block\$/, '변이가 안 먹었다 = V1 은 이 배선을 «안» 본다');
  assert.doesNotMatch(mutated, /if \(!\/\^update_\/\.test\(name\)\) return r;/,
    '변이가 «덧붙기»만 했다 — 옛 조건이 살아 있으면 대조가 성립 안 한다');
});
