/* U-H3-B — 「함께 보내지는 것」이 «이 화면은 편집 중 오류를 안 모은다»를 말하는가. (H3 후속, 2026-09-06)
 *
 * ★왜 이 검사가 있나 (지디 지시)
 *   링버퍼(js/report-buffer.js)는 에디터(index.html)에만 실린다. 프로젝트 목록
 *   (pages/projects.html)에는 «일부러» 안 실었다 — H2 이후 링버퍼 내용은 «디스크에도»
 *   남으므로 그 화면에 새 console 후킹을 들여 노출 면을 늘리지 않는 쪽이 옳다.
 *   ⇒ 그래서 그 화면에서 보낸 신고는 errors 가 «비어 보인다». 그건 고장이 아니라 설계다.
 *   ⛔그 사실을 화면이 «말하지» 않으면, 나중에 우리가 「왜 어떤 신고는 errors 가 비지」로
 *     헤맨다. 이 검사가 그 문장을 잠근다.
 *
 * ⛔함수 «흉내»를 재지 않는다 — report-modal-auth-diag.test.mjs 와 같은 방식으로
 *   `js/report-modal.js` «원본 바이트»를 vm 으로 그대로 실행해 노출된 진짜 함수를 잰다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');

function boot() {
  const w = { electronAPI: null, document: { addEventListener() {}, getElementById() { return null; } } };
  const code = fs.readFileSync(path.join(ROOT, 'js/report-modal.js'), 'utf8');
  vm.runInNewContext(code, { window: w, document: w.document, Date, JSON, Object, Array, String, Error, Image: function () {} });
  return w;
}

const CTX = { appVersion: '0.9.1', os: 'darwin 25.3.0', arch: 'arm64', screen: '1920×1080' };
const NOTICE = /이 화면은 «편집 중 오류»를 따로 모으지 않습니다/;

test('U-H3-B1 링버퍼가 «없는» 화면(프로젝트 목록)에서는 그 사실을 말한다', () => {
  const w = boot();
  const html = w.reportModalDisclosureHtml({ ctx: CTX, errors: [], account: '', hasBuffer: false });
  assert.match(html, NOTICE,
    '★「비었다」가 왜 비었는지 안 말한다 — 나중에 우리가 「왜 errors 가 비지」로 헤맨다');
  assert.match(html, /편집 화면에서 보내시면/, '어떻게 하면 담기는지(행동)를 안 알려준다');
});

test('U-H3-B2 링버퍼가 «있는» 화면(에디터)에서는 그 문장이 «안» 나온다', () => {
  const w = boot();
  const html = w.reportModalDisclosureHtml({ ctx: CTX, errors: [], account: '', hasBuffer: true });
  assert.ok(!NOTICE.test(html),
    '★에디터에서도 「안 모은다」고 말한다 — 사실이 아니다. 거짓 안내는 안내 없음보다 나쁘다');
  assert.match(html, /담긴 오류가 없습니다/, '에디터에서 오류가 0건이면 그 말은 그대로 나와야 한다');
});

test('U-H3-B3 ★복구 줄이 실려 있어도 «안 모은다»는 사실은 그대로 말한다', () => {
  /* 지난 실행 크래시 줄은 «메인»이 만든 것이라 링버퍼와 무관하다. 줄이 있다고
     「다 담겼다」로 읽히면 안 된다 — 담긴 건 지난 실행 것뿐이고 «이번 세션» 오류는 없다. */
  const w = boot();
  const html = w.reportModalDisclosureHtml({
    ctx: CTX, account: '', hasBuffer: false,
    errors: [{ at: '2026-09-06T13:00:02.356Z', level: 'crash', msg: '[크래시] kind=uncaught-exception' }],
  });
  assert.match(html, NOTICE, '★줄이 있다는 이유로 안내가 사라졌다');
  assert.match(html, /최근 오류 1건/, '건수는 그대로 세야 한다');
  assert.match(html, /kind=uncaught-exception/, '실린 줄이 그대로 안 보인다');
});

test('U-H3-B4 ★판정은 «버퍼가 있는지»로 한다 — 화면 이름으로 하면 화면이 늘 때마다 낡는다', () => {
  const src = fs.readFileSync(path.join(ROOT, 'js/report-modal.js'), 'utf8');
  const i = src.indexOf('function renderDisclosure()');
  assert.ok(i > 0, 'renderDisclosure 를 못 찾았다');
  const body = src.slice(i, src.indexOf('\n  }', i));
  assert.ok(/w\.ReportBuffer && typeof w\.ReportBuffer\.list === 'function'/.test(body),
    '★hasBuffer 를 ReportBuffer 존재로 안 정한다: ' + body);
  assert.ok(!/location|pathname|projects\.html|index\.html/.test(body),
    '★화면 «이름»으로 판정한다 — 화면이 하나 늘면 그날로 틀린 안내가 된다: ' + body);
});

test('U-H3-B5 이 안내는 «문장 하나»다 — 데이터가 같이 늘지 않는다', () => {
  /* ★「안내를 하나 넣었다」가 조용히 «새 값 노출»을 끌고 오지 않았는지.
     버퍼 유무만 뒤집고 나머지 입력은 «똑같이» 준다 ⇒ 두 결과의 차이가 정확히
     안내 문단 한 개여야 한다. 한 글자라도 더 늘면 다른 것이 같이 들어온 것이다.
     ⛔`|| true` 같은 «안 막는 단언»을 쓰지 않는다(초판이 그랬다 — 검사처럼 «생긴» 문장이었다). */
  const w = boot();
  const input = { ctx: { ...CTX, projectId: 'proj_1788000000000' }, account: 'x@y.z',
                  errors: [{ at: 'a', level: 'crash', msg: 'M' }] };
  const off = w.reportModalDisclosureHtml({ ...input, hasBuffer: true });
  const on  = w.reportModalDisclosureHtml({ ...input, hasBuffer: false });
  assert.equal(on.length - off.length, NOTICE_LEN,
    '안내 문장 말고 다른 것이 같이 늘었다: +' + (on.length - off.length) + '자 (기대 ' + NOTICE_LEN + ')');
  assert.equal(on.replace(NOTICE_HTML, ''), off,
    '★안내 한 문단을 «빼면» 원래 결과와 같아야 한다 — 다르면 다른 곳도 바뀌었다');
});

/* 안내 문단 «그 자체» — 늘어난 것이 이 문장 하나뿐임을 못 박는 기준값. */
const NOTICE_HTML = '<p class="report-errs empty" style="margin:0 0 6px">' +
  '이 화면은 «편집 중 오류»를 따로 모으지 않습니다 — 편집 화면에서 보내시면 최근 오류가 함께 담깁니다.' +
  '</p>';
const NOTICE_LEN = NOTICE_HTML.length;
