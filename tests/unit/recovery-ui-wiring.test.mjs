/* U-H3-U — pages/projects.html · js/report-modal.js 의 H3 배선(정적). (2026-09-06)
 *
 * ⛔이건 «정적» 검사다. 진짜 렌더링은 실기(CDP 스크린샷)가 증명했다 — 보고 참조.
 *   여기서는 «그 고침이 도로 돌아가지 않는지»만 기계로 잠근다(PSB-* 와 같은 규율).
 *
 * ★잠그는 것 넷
 *   ⑴ 모듈이 «실제로 로드»된다 — 「모듈은 완벽한데 아무도 안 부른다」 방지.
 *   ⑵ 배너가 «모달이 아니다» — alert/confirm/showModal 을 안 부른다.
 *   ⑶ ★노출: 이 화면에서 «직접 보내지» 않는다(report.submit 호출 0). 신고 창을 «열» 뿐이다.
 *   ⑷ ★노출: 나갈 내용을 «그대로 보는» 자리가 있고, 뭉뚱그린 문장이 아니다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const HTML = fs.readFileSync(path.join(ROOT, 'pages/projects.html'), 'utf8');
const MODAL = fs.readFileSync(path.join(ROOT, 'js/report-modal.js'), 'utf8');

/** 인라인 스크립트에서 H3 블록만 잘라 낸다 — CSS·마크업 주석에 걸리지 않게. */
function h3Block() {
  const a = HTML.indexOf('async function paintRecoveryBanner');
  const b = HTML.indexOf('function paintAcct(st)');
  assert.ok(a > 0 && b > a, 'H3 배선 블록을 못 찾았다 — 마크업/스크립트가 바뀌었다');
  return HTML.slice(a, b);
}

test('U-H3-U1 recovery-banner.js · report-modal.js 가 «실제로» 로드된다', () => {
  assert.match(HTML, /<script src="\.\.\/js\/recovery-banner\.js"><\/script>/,
    '판정 모듈이 안 실린다 — 배너가 영영 안 뜬다');
  assert.match(HTML, /<script src="\.\.\/js\/report-modal\.js"><\/script>/,
    '신고 창이 안 실린다 — [원인 보내기]가 죽는다(새 전송 경로를 만들지 마라, 이걸 실어라)');
  assert.match(HTML, /<link rel="stylesheet" href="\.\.\/css\/report-modal\.css">/,
    '신고 창 CSS 가 없다 — 창이 뜨긴 하는데 꼴이 깨진다');
});

test('U-H3-U2 배너 초기 마크업은 `hidden` 이 아니라 style="display:none" (PSB-1 회귀 방지)', () => {
  const m = HTML.match(/<div id="recovery-banner"([^>]*)>/);
  assert.ok(m, '#recovery-banner 를 못 찾았다');
  assert.ok(!/\bhidden\b/.test(m[1]),
    '`hidden` 속성이다 — ID 셀렉터 display 가 [hidden] UA 규칙을 이겨 «빈 줄»이 남는다: ' + m[0]);
  assert.match(m[1], /style="display:\s*none"/, m[0]);
  assert.ok(!/getElementById\('recovery-banner'\)\.hidden\s*=/.test(HTML), 'JS 가 el.hidden 으로 돌아갔다');
});

test('U-H3-U3 ★배너가 사용자를 막지 않는다 — alert·confirm·showModal 을 안 부른다', () => {
  const b = h3Block();
  assert.ok(!/\balert\(|\bconfirm\(|showModal\(/.test(b),
    '★모달·확인창을 부른다. 지난 실행의 사고는 «지금» 급한 일이 아니다 — 하려던 걸 먼저 하게 둬라');
});

test('U-H3-U4 ★★이 화면은 «직접 보내지» 않는다 — report.submit 을 부르지 않는다', () => {
  const b = h3Block();
  assert.ok(!/report\s*\.\s*submit\s*\(/.test(b),
    '★★복구 배선이 신고를 «직접» 보낸다 = 사용자 동의 없이 나갈 수 있다. 반려 조건이다');
  assert.ok(/openReportModal\(/.test(b),
    '기존 신고 창을 안 연다 — 새 전송 경로를 만들지 말고 있는 걸 재사용해라');
});

test('U-H3-U5 ★나갈 내용을 «그대로» 보는 자리가 있다 — 뭉뚱그린 문장 금지', () => {
  const b = h3Block();
  assert.ok(/outgoingText\(/.test(b), '나갈 줄을 그대로 그리는 호출이 없다');
  assert.ok(/보낼 내용 그대로 보기/.test(b), '펼쳐 보는 버튼이 없다');
  assert.match(HTML, /<pre id="recovery-outgoing">|id="recovery-outgoing"/,
    '나갈 줄을 담을 <pre> 자리가 없다');
  /* ⛔「진단 정보가 포함됩니다」류 — 무엇이 나가는지 안 밝히는 문장 */
  assert.ok(!/진단 정보가 포함|일부 정보가 함께|기술 정보가 전송/.test(b),
    '★뭉뚱그린 안내 문구가 들어왔다 — 무엇이 나가는지 그대로 보여줘라');
  assert.ok(/비상 사본\)은 보내지지 않|보내지지 않고 이 컴퓨터에만/.test(b),
    '★작업 내용이 «안 나간다»는 사실을 명시하지 않는다');
});

test('U-H3-U6 [✕]는 «이번만», [이 안내 그만 보기]가 도장 — 둘이 다른 일을 한다', () => {
  const b = h3Block();
  const closeIdx = b.indexOf("t.id === 'recovery-banner-close'");
  assert.ok(closeIdx > 0, '[✕] 처리가 없다');
  const closeStmt = b.slice(closeIdx, closeIdx + 200);
  assert.ok(!/ack\(/.test(closeStmt), '★[✕]가 도장을 찍는다 — 「나중에」가 「영영 안 봄」이 돼 버린다');
  assert.ok(/t\.id === 'recovery-dismiss'[\s\S]{0,300}?ack\(/.test(b),
    '[이 안내 그만 보기]가 도장을 안 찍는다 — 매번 다시 뜬다');
});

test('U-H3-U7 report-modal open(opts) — 인자 없이 부르던 기존 호출부가 «그대로» 돈다', () => {
  assert.match(MODAL, /function open\(opts\)\s*\{\s*\n?\s*var o = opts \|\| \{\};/,
    'open 이 인자를 «필수»로 받게 바뀌면 index.html 의 openReportModal() 이 죽는다');
  const IDX = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  assert.match(IDX, /window\.openReportModal\(\)/, '전제 확인 — 에디터는 인자 없이 부른다');
});

test('U-H3-U8 ★extraErrors 는 errors[] 로 실리고, 그때 「함께 보내지는 것」이 «펼친 채로» 열린다', () => {
  assert.ok(/extraErrors/.test(MODAL), 'extraErrors 를 안 받는다');
  assert.ok(/mergeRecoveryLines\(/.test(MODAL),
    '★복구 줄을 errors[] 로 «합치는» 자리가 없다 — 최상위 필드로 실으면 서버가 조용히 버린다(E3 실측)');
  assert.ok(/var openDisc = _extra\.length > 0/.test(MODAL),
    '★사용자가 «안 적은» 줄이 실리는데 「함께 보내지는 것」이 접힌 채로 열린다');
  assert.ok(/aria-expanded', String\(openDisc\)/.test(MODAL), '펼침 상태가 aria 에 안 반영된다');
});

test('U-H3-U9 새 CSS 는 «기존 토큰»만 쓴다 — 다크 단일 테마에서 색이 튀지 않게', () => {
  const a = HTML.indexOf('#recovery-banner {');
  const b = HTML.indexOf('#btn-new {');
  assert.ok(a > 0 && b > a, 'H3 CSS 블록을 못 찾았다');
  const css = HTML.slice(a, b);
  const tokens = [...css.matchAll(/var\((--[a-z0-9-]+)/g)].map((m) => m[1]);
  assert.ok(tokens.length >= 6, '토큰을 거의 안 쓴다 — 색을 손으로 박았다는 뜻이다');
  const base = fs.readFileSync(path.join(ROOT, 'css/editor-base.css'), 'utf8');
  for (const t of new Set(tokens)) {
    assert.ok(base.includes(t + ':'), `★없는 토큰 ${t} — 조용히 «색 없음»으로 그려진다`);
  }
  /* 하드코딩된 hex 는 흰 글자 하나(주요 버튼 대비)만 허용한다. */
  const hex = (css.match(/#[0-9a-fA-F]{3,8}\b/g) || []).filter((h) => h.toLowerCase() !== '#fff');
  assert.deepEqual(hex, [], '토큰 대신 색을 손으로 박았다: ' + hex.join(', '));
});

test('U-H3-U10 ★★[원인 보내기]가 «되살릴 게 남은» 저장 실패에 도장을 찍지 않는다', () => {
  /* ★실기가 잡은 진짜 결함(2026-09-06): 초판은 여기서 items «전부»에 도장을 찍고 배너를 감췄다.
     ⇒ [원인 보내기] 한 번에 [되살리기]가 같이 사라졌다 = 「원인은 보냈는데 문서는 잃었다」.
       이 정적 검사는 그 초판으로 되돌아가는 것을 막는다. (합성 단위검사는 이걸 «통과»시켰다 —
       화면을 실제로 눌러 본 실기만 잡았다.) */
  const b = h3Block();
  const i = b.indexOf("t.id === 'recovery-send'");
  assert.ok(i > 0, '[원인 보내기] 처리가 없다');
  const stmt = b.slice(i, b.indexOf("return;", b.indexOf('paintRecoveryBanner', i)) + 8);
  assert.ok(/crashIds/.test(stmt) && /kind === 'crash'/.test(stmt),
    '★크래시만 골라 도장을 찍지 않는다 — 저장 실패까지 찍으면 되살리기가 사라진다:\n' + stmt.slice(0, 400));
  assert.ok(!/ack\(items\.map/.test(stmt),
    '★items 전부에 도장을 찍는다 = 「복구할 수 있었는데 못 했다」. 반려 조건이다');
  assert.ok(/paintRecoveryBanner\(\)/.test(stmt),
    '보낸 뒤 배너를 다시 그리지 않는다 — 남은 저장 실패가 화면에서 사라진다');
});
