/* CDP 포트 뱃지 — «값의 출처» 게이트 검사
 *
 * 현빈 지시(2026-09-07): 「admin 모드가 아니더라도 되게 / ★앱 배포나 메인브랜치에서만 안 보이면 돼」
 *
 * ★왜 «렌더러»가 아니라 «main» 을 재나
 *   차단을 화면의 표시 조건에 두면, 화면을 손대는 사람이 언제든 조용히 열 수 있다.
 *   `app:debug-port` 가 값을 «안 주면» 화면 코드가 무엇을 하든 못 그린다 — 구조로 닫은 것이고,
 *   그래서 검사도 그 구조를 겨눈다.
 *
 * ★왜 «몸통을 떼어» 돌리나 (2026-09-07 MCP매니저가 M20 에서 얻은 것)
 *   대역(mock)을 세워 두면 그 대역이 검사의 사각을 만든다. 진짜 함수를 망가뜨려도 안 잡힌다.
 *   ⇒ 여기서는 main.js «원문»에서 핸들러 몸통을 떼어내 실제로 실행한다. 원문이 바뀌면 여기가 빨개진다.
 *
 * ⛔이 검사가 «안» 보는 것 (정직하게 적는다)
 *   · 렌더러가 그 값을 받아 실제로 그리는지 — 그건 실기(CDP)로 확인했다(isAdmin false 에서 ':9373' 표시)
 *   · 클릭 복사 동작 — 실기에서 실물 클립보드로 확인했다(pbpaste → '9373')
 *   · admin 빌드에서의 동작 — ⛔admin 으로 앱을 못 띄우므로 «안 쟀다»
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const MAIN = path.join(__dirname, '..', '..', 'main.js');
const SRC = fs.readFileSync(MAIN, 'utf8');

/** main.js 원문에서 `ipcMain.handle('app:debug-port', () => { … })` 의 «몸통»을 떼어낸다. */
function extractHandlerBody(src) {
  const needle = "ipcMain.handle('app:debug-port', () => {";
  const i = src.indexOf(needle);
  assert.notStrictEqual(i, -1, '★app:debug-port 핸들러를 못 찾았다 — 이름이 바뀌었으면 이 검사부터 고쳐라');
  let depth = 0, start = src.indexOf('{', i + needle.length - 1), j = start;
  for (; j < src.length; j++) {
    if (src[j] === '{') depth++;
    else if (src[j] === '}') { depth--; if (depth === 0) break; }
  }
  assert.ok(j < src.length, '★핸들러 몸통의 끝을 못 찾았다');
  return src.slice(start + 1, j);
}

/** 떼어낸 몸통을 «가짜 환경»으로 실행한다. 대역이 아니라 진짜 코드를 돌린다. */
function runHandler(body, { isPackaged, branch, argv }) {
  const fn = new Function('app', 'getGitBranch', 'process', body);
  return fn({ isPackaged }, () => branch, { argv });
}

const BODY = extractHandlerBody(SRC);
const ARGV_WITH = ['electron', '.', '--remote-debugging-port=9373'];
const ARGV_NONE = ['electron', '.'];

test('배포본(isPackaged)이면 «값 자체»를 안 준다', () => {
  const r = runHandler(BODY, { isPackaged: true, branch: 'dev', argv: ARGV_WITH });
  assert.strictEqual(r, null, '★배포본인데 CDP 포트가 새어 나갔다');
});

test('main 브랜치면 «값 자체»를 안 준다 (main = 배포 상태)', () => {
  const r = runHandler(BODY, { isPackaged: false, branch: 'main', argv: ARGV_WITH });
  assert.strictEqual(r, null, '★main 인데 CDP 포트가 새어 나갔다');
});

test('dev·기능브랜치에서는 포트를 준다 (admin 여부와 «무관»)', () => {
  for (const branch of ['dev', 'fix/cdp-port-badge-nonadmin', 'feat/whatever']) {
    const r = runHandler(BODY, { isPackaged: false, branch, argv: ARGV_WITH });
    assert.strictEqual(r, '9373', `★${branch} 에서 포트가 안 나온다 — 현빈 지시는 「admin 아니어도 되게」다`);
  }
});

test('CDP 를 안 켰으면 (argv 에 인자 없음) null', () => {
  const r = runHandler(BODY, { isPackaged: false, branch: 'dev', argv: ARGV_NONE });
  assert.strictEqual(r, null);
});

/* ★양성대조 — 이 검사가 «원문을 실제로 읽고 있나».
 *   가드를 지운 몸통을 만들어 돌렸을 때 «빨개져야» 한다. 안 빨개지면 위 검사들은 장식이다.
 *   (오늘 M17 이 「양쪽 다 초록」이라 장식이었던 것을 그대로 방지한다) */
test('★양성대조 — 가드를 빼면 위 검사가 실제로 깨진다', () => {
  const noPkg = BODY.replace(/if \(app\.isPackaged\) return null;/, '');
  assert.notStrictEqual(noPkg, BODY, '★치환이 안 됐다 — 가드 문장이 바뀌었으면 이 대조부터 고쳐라');
  assert.strictEqual(
    runHandler(noPkg, { isPackaged: true, branch: 'dev', argv: ARGV_WITH }), '9373',
    '★가드를 빼도 null 이 나온다 = 이 검사는 isPackaged 를 안 보고 있다(장식)');

  const noMain = BODY.replace(/if \(getGitBranch\(\) === 'main'\) return null;.*$/m, '');
  assert.notStrictEqual(noMain, BODY, '★치환이 안 됐다 — main 가드 문장이 바뀌었으면 이 대조부터 고쳐라');
  assert.strictEqual(
    runHandler(noMain, { isPackaged: false, branch: 'main', argv: ARGV_WITH }), '9373',
    '★가드를 빼도 null 이 나온다 = 이 검사는 브랜치를 안 보고 있다(장식)');
});
