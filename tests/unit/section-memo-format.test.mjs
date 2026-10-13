/* section-memo-format — 섹션 메모 «평문 ↔ 토큰» 규칙을 잠근다 (1012t1A1)
 *
 * 재는 것: js/section-memo-format.js 의 순수 함수(앱·DOM 없이 require 로 «같은 함수»를 싣는다).
 *   ⑴ 토큰화 → 직렬화 왕복이 «한 글자도» 안 바꾼다(옛 평문·한글·이모지·표식 섞인 글)
 *   ⑵ `[ ]` `[x]` `[X]` 만 체크박스다 — `[]` 는 글자다
 *   ⑶ 치는 순간의 방아쇠(checkTrigger) — `[]` `[ ]` `[x]`
 *   ⑷ 배선: index.html 이 이 파일을 js/section-memo.js «앞»에 싣는다
 *   ⑸ (1012t1A2) 참고 이미지 표식 `![](goya-asset://…)` — 앱 자산 주소만 그림이고, 그 밖은 글자다
 * 안 재는 것: 에디터 DOM(렌더·토글·IME·되돌리기) → tests/dom/section-memo-rich.dom.spec.js
 *
 * 실행: node --test tests/unit/section-memo-format.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const require_ = createRequire(import.meta.url);
const F = require_(path.join(ROOT, 'js/section-memo-format.js'));
const { tokenizeMemo, serializeTokens, checkTrigger, checkTriggerLen, memoLength, isMemoImgSrc, imgToken } = F;

const types = (s) => tokenizeMemo(s).map((t) => t.type);

test('U-MEMOFMT-1 왕복 불변 — 토큰화한 것을 직렬화하면 «같은 글자»다', () => {
  const samples = [
    '',
    '옛 평문 메모 한 줄',
    '출처: 기획서 3쪽\n의도: 첫 화면에서 가격을 보인다\n\n빈 줄 다음',
    '한글 🙂 이모지 👨‍👩‍👧 섞임',
    '[ ] 할일\n[x] 끝난 일\n[X] 대문자',
    '글 사이 [ ] 와 [x] 가 [X] 한 줄에',
    '[] 리터럴 과 [  ] 공백 둘 과 [y] 는 글자',
    '[[ ]] [x][ ]붙은 것',
    '꼬리 줄바꿈\n',
    '\n머리 줄바꿈',
    '\r\n윈도 줄바꿈\r\n',
    '![](goya-asset://p1/aaaa.jpg) 아직 글자인 표식',
  ];
  assert.equal(samples.length, 12, '표본 수 전제');
  for (const s of samples) {
    assert.equal(serializeTokens(tokenizeMemo(s)), s, `왕복이 글자를 바꿨다: ${JSON.stringify(s)}`);
  }
});

test('U-MEMOFMT-2 `[ ]` `[x]` `[X]` 만 체크박스다 — 상태·차례', () => {
  const toks = tokenizeMemo('a[ ]b[x]c[X]d');
  assert.deepEqual(toks.map((t) => t.type), ['text', 'check', 'text', 'check', 'text', 'check', 'text']);
  const checks = toks.filter((t) => t.type === 'check');
  assert.equal(checks.length, 3);
  assert.deepEqual(checks.map((t) => t.checked), [false, true, true]);
  assert.deepEqual(checks.map((t) => t.raw), ['[ ]', '[x]', '[X]']);
});

test('U-MEMOFMT-3 `[]`(공백 없음)는 글자다 — 저장된 리터럴은 안 바뀐다', () => {
  assert.deepEqual(types('[] 할일'), ['text']);
  assert.equal(tokenizeMemo('[] 할일')[0].text, '[] 할일');
  for (const s of ['[]', '[  ]', '[y]', '[xx]', '[ x]', '[', ']', '[ \n]']) {
    assert.equal(tokenizeMemo(s).filter((t) => t.type === 'check').length, 0, `${JSON.stringify(s)} 는 체크박스가 아니다`);
  }
});

test('U-MEMOFMT-4 줄바꿈은 br 토큰 하나씩 — 글 토막은 줄바꿈을 품지 않는다', () => {
  const toks = tokenizeMemo('가\n\n나\n');
  assert.deepEqual(toks.map((t) => t.type), ['text', 'br', 'br', 'text', 'br']);
  for (const t of toks) if (t.type === 'text') assert.equal(t.text.includes('\n'), false);
});

test('U-MEMOFMT-5 직렬화 — 뒤집힌 체크는 정본 글자로, 안 뒤집힌 것은 읽은 그대로', () => {
  assert.equal(serializeTokens([{ type: 'check', checked: false }]), '[ ]');
  assert.equal(serializeTokens([{ type: 'check', checked: true }]), '[x]');
  assert.equal(serializeTokens([{ type: 'check', checked: true, raw: '[X]' }]), '[X]', '손 안 댄 대문자는 그대로');
  assert.equal(serializeTokens([{ type: 'check', checked: false, raw: '[X]' }]), '[ ]', '체크를 푼 것은 raw 를 안 믿는다');
  assert.equal(serializeTokens([{ type: 'check', checked: true, raw: '[ ]' }]), '[x]', '체크한 것은 raw 를 안 믿는다');
  assert.equal(serializeTokens([{ type: 'check', checked: true, raw: '<b>' }]), '[x]', 'raw 가 표식 꼴이 아니면 안 쓴다');
  assert.equal(serializeTokens([{ type: 'text', text: '할일 ' }, { type: 'check', checked: true }, { type: 'br' }, { type: 'mystery' }, null]),
    '할일 [x]\n', '모르는 토큰·빈 칸은 버린다');
  assert.equal(serializeTokens(null), '');
});

test('U-MEMOFMT-6 방아쇠 — 캐럿 앞이 `[]` `[ ]` `[x]` 로 끝날 때만', () => {
  assert.equal(checkTriggerLen('ab[]'), 2);
  assert.equal(checkTriggerLen('[ ]'), 3);
  assert.equal(checkTriggerLen('줄 가운데 [x]'), 3);
  assert.equal(checkTriggerLen('[X]'), 3);
  assert.equal(checkTriggerLen('[x'), 0);
  assert.equal(checkTriggerLen('[] '), 0, '방아쇠 뒤에 글자가 더 있으면 아니다');
  assert.equal(checkTriggerLen('[y]'), 0);
  assert.equal(checkTriggerLen('[  ]'), 0);
  assert.equal(checkTriggerLen(']'), 0);
  assert.equal(checkTriggerLen(''), 0);
  assert.equal(checkTriggerLen(null), 0);
  assert.deepEqual(checkTrigger('ab[]'), { len: 2, checked: false });
  assert.deepEqual(checkTrigger('[ ]'), { len: 3, checked: false });
  assert.deepEqual(checkTrigger('[x]'), { len: 3, checked: true });
  assert.deepEqual(checkTrigger('[X]'), { len: 3, checked: true });
  assert.equal(checkTrigger('[x'), null);
});

test('U-MEMOFMT-7 길이는 코드포인트로 센다 — 체크박스 하나는 3자', () => {
  assert.equal(memoLength('가나다'), 3);
  assert.equal(memoLength('🙂'), 1);
  assert.equal('🙂'.length, 2, '음성대조 — .length 로 세면 2 다');
  assert.equal(memoLength(serializeTokens([{ type: 'check', checked: false }])), 3);
  assert.equal(memoLength(null), 0);
});

test('U-MEMOFMT-8 값이 아닌 입력 — 터지지 않고 빈 토큰 줄', () => {
  assert.deepEqual(tokenizeMemo(null), []);
  assert.deepEqual(tokenizeMemo(undefined), []);
  assert.deepEqual(tokenizeMemo(''), []);
  assert.equal(serializeTokens(tokenizeMemo(123)), '123');
});

test('U-MEMOFMT-9 배선 — index.html 이 포맷을 메모 스크립트 «앞»에 싣고, 메모 스크립트가 그 전역을 쓴다', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const iFmt = html.indexOf('<script src="js/section-memo-format.js"></script>');
  const iMemo = html.indexOf('<script src="js/section-memo.js"></script>');
  assert.notEqual(iFmt, -1, 'index.html 에 포맷 스크립트 태그가 없다');
  assert.notEqual(iMemo, -1, 'index.html 에 메모 스크립트 태그가 없다');
  assert.equal(iFmt < iMemo, true, '포맷이 메모보다 먼저 실려야 한다');
  const memoSrc = fs.readFileSync(path.join(ROOT, 'js/section-memo.js'), 'utf8');
  assert.equal(memoSrc.includes('window.SectionMemoFormat'), true, 'js/section-memo.js 가 포맷 전역을 안 쓴다');
  assert.equal(typeof globalThis.SectionMemoFormat, 'object', 'require 하면 전역에도 걸린다(브라우저와 같은 이름)');
  assert.equal(globalThis.SectionMemoFormat.tokenizeMemo, tokenizeMemo);
});

test('U-MEMOFMT-10 그림 주소 — 앱 자산(goya-asset://프로젝트/파일)만 참이다', () => {
  assert.equal(isMemoImgSrc('goya-asset://p1/aaaa.jpg'), true, '양성');
  const bad = [
    'javascript:alert(1)',
    'data:image/png;base64,AAAA',
    'http://evil/x.png',
    'goya-asset://p1/a".jpg',
  ];
  assert.equal(bad.length, 4, '음성 표본 수 전제');
  for (const s of bad) assert.equal(isMemoImgSrc(s), false, `${JSON.stringify(s)} 는 그림 주소가 아니다`);
  /* 앞뒤에 다른 글자가 붙은 것·폴더가 더 깊은 것·값이 아닌 것도 아니다 */
  for (const s of ['x goya-asset://p1/a.jpg', 'goya-asset://p1/a.jpg\n', 'goya-asset://p1/a.jpg onerror=x', 'goya-asset://p1/d/a.jpg',
    'goya-asset://p1/', 'goya-asset:///a.jpg', 'https://goya-asset://p1/a.jpg', '', null, undefined, 3]) {
    assert.equal(isMemoImgSrc(s), false, `${JSON.stringify(s)} 는 그림 주소가 아니다`);
  }
});

test('U-MEMOFMT-11 그림 표식 — 토큰 하나로 읽고, 직렬화하면 같은 글자다', () => {
  const MEMO = '참고 ![](goya-asset://p1/aaaa.jpg)\n[x] 끝 ![](goya-asset://proj_2-b/0123456789abcdef.jpg)꼬리';
  const toks = tokenizeMemo(MEMO);
  assert.deepEqual(toks.map((t) => t.type), ['text', 'img', 'br', 'check', 'text', 'img', 'text']);
  const imgs = toks.filter((t) => t.type === 'img');
  assert.deepEqual(imgs.map((t) => t.src), ['goya-asset://p1/aaaa.jpg', 'goya-asset://proj_2-b/0123456789abcdef.jpg']);
  assert.equal(imgs[0].raw, '![](goya-asset://p1/aaaa.jpg)');
  assert.equal(serializeTokens(toks), MEMO, '왕복 불변');
  /* 에디터가 DOM 에서 다시 읽은 토큰에는 raw 가 없다 — 그래도 같은 글자다 */
  assert.equal(serializeTokens([{ type: 'img', src: 'goya-asset://p1/aaaa.jpg' }]), '![](goya-asset://p1/aaaa.jpg)');
  assert.equal(imgToken('goya-asset://p1/aaaa.jpg'), '![](goya-asset://p1/aaaa.jpg)');
  assert.equal(memoLength(imgToken('goya-asset://p1/aaaa.jpg')), 29, '그림 하나는 표식 글자 수만큼 한도에 센다');
});

test('U-MEMOFMT-12 앱 자산이 아닌 그림 표식은 글자다 — 토큰도, 직렬화도 그림을 만들지 않는다', () => {
  const bad = [
    '![](http://evil/x.png)',
    '![](https://evil/x.png)',
    '![](data:image/png;base64,AAAA)',
    '![](javascript:alert(1))',
    '![](goya-asset://p1/a".jpg)',
    '![alt](goya-asset://p1/aaaa.jpg)',
    '![](goya-asset://p1/aaaa.jpg "제목")',
    '[](goya-asset://p1/aaaa.jpg)',
  ];
  assert.equal(bad.length, 8, '표본 수 전제');
  for (const s of bad) {
    const toks = tokenizeMemo(s);
    assert.equal(toks.filter((t) => t.type === 'img').length, 0, `${JSON.stringify(s)} 는 그림 표식이 아니다`);
    assert.equal(serializeTokens(toks), s, `글자가 바뀌었다: ${JSON.stringify(s)}`);
  }
  /* 손으로 만든 나쁜 토큰은 직렬화가 버린다(표식으로 되살아날 글자를 만들지 않는다) */
  assert.equal(serializeTokens([{ type: 'text', text: '가' }, { type: 'img', src: 'http://evil/x.png' }, { type: 'img' }, { type: 'text', text: '나' }]), '가나');
});
