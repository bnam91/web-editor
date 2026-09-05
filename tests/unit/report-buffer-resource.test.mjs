/* 단위 — js/report-buffer.js 의 «리소스 로드 실패» 후킹 (M11: 사용자 파일명 유출 차단).
 *
 * ★이 파일이 지키겠다고 한 것 둘 — «둘 다» 성립해야 한다:
 *   ⑴ 새는 것을 막는다 — 파일명·호스트·쿼리토큰·data: 페이로드가 신고에 안 실린다
 *   ⑵ ★재현 능력을 같이 죽이지 않는다 — 스킴·확장자·«서로 다른 에셋인가»는 남는다
 *      (막다가 진단을 죽이면 그것도 실패다)
 * ⛔★함수 «단독»을 재지 않는다. M3 에서 두 번 걸린 병이다(세척기는 멀쩡한데 «배선»이 끊겨도 초록).
 *   그래서 여기서는 **실제 error 리스너를 실제 이벤트 모양으로 때려** 링버퍼에 «담긴 것»을 본다.
 *   판정도 「함수가 불렸다」가 아니라 「그 문자열이 담긴 줄에 없다」로 한다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** report-buffer.js «원본»을 실행하고, 등록된 리스너를 그대로 돌려준다. */
function boot() {
  const listeners = [];
  const w = { console: { error: () => {}, log: () => {} },
              addEventListener: (t, f) => listeners.push([t, f]) };
  const code = fs.readFileSync(path.join(__dirname, '../../js/report-buffer.js'), 'utf8');
  vm.runInNewContext(code, { window: w, Date, JSON, Object, Array, String, Error });
  const on = (type) => listeners.filter(([t]) => t === type).map(([, f]) => f);
  return { rb: w.ReportBuffer, w, onError: on('error')[0], onRej: on('unhandledrejection')[0] };
}
/** 리소스 로드 실패 이벤트를 «실제 모양»으로 만든다(error·message 없음, target 만 있다). */
const resEv = (tag, url, attr = 'src') => ({ target: { tagName: tag, [attr]: url } });
const fire = (b, ev) => { b.onError(ev); return b.rb.list().map(e => e.level + ' | ' + e.msg); };

/* ── ⑴ 새는 것을 막는다 ─────────────────────────────────────────────────── */
const LEAKY = [
  // [설명, url, 절대 나오면 안 되는 조각들]
  ['검수자 표본(퍼센트 인코딩)', 'http://127.0.0.1:9877/hang_%EB%A1%AF%EB%8D%B0_2026%EC%97%AC%EB%A6%84.png', ['롯데', '9877', '127.0.0.1']],
  ['같은 것, 디코딩된 꼴',       'http://127.0.0.1:9877/hang_롯데_2026여름.png', ['롯데', '2026여름']],
  ['★호스트가 곧 클라이언트',    'https://cdn.lotte.co.kr/2026summer/main_v3.jpg', ['lotte', 'cdn', 'main_v3', '2026summer']],
  ['에셋 저장소',                'goya-asset://proj_9k2/롯데_2026여름_메인.png', ['롯데', 'proj_9k2', '메인']],
  ['에셋 저장소(인코딩)',        'goya-asset://proj_9k2/%EB%A1%AF%EB%8D%B0_2026%EC%97%AC%EB%A6%84.png', ['롯데', 'proj_9k2']],
  ['사용자 디스크',              'file:///Users/kim minjae/작업/여름세일_메인.png', ['kim', 'minjae', '작업', '여름세일', 'Users']],
  ['사용자 디스크(인코딩)',      'file:///Users/kim%20minjae/%EC%9E%91%EC%97%85/hero.png', ['kim', 'minjae', 'hero', 'Users']],
  ['blob',                       'blob:file:///9a1c-롯데.png', ['롯데', '9a1c']],
  ['스킴 없는 상대경로',         '롯데_2026여름.png', ['롯데', '2026여름']],
];

test('R1 ★★후킹이 «실제로 담는 줄»에 파일명·호스트가 없다 (9표본) — 인코딩된 꼴로도 판정한다', () => {
  for (const [label, url, secrets] of LEAKY) {
    const b = boot();
    const got = fire(b, resEv('IMG', url));
    assert.equal(got.length, 1, label + ' — 안 담겼다');
    for (const sec of secrets) {
      assert.ok(!got[0].includes(sec), `${label}: 평문 «${sec}» 유출 — ${got[0]}`);
      /* ★핵심 함정 — 퍼센트 인코딩은 «눈으로 보면 깨끗해 보인다». 디코드하면 되돌아오므로
         남아 있으면 유출이다. 평문과 «둘 다» 잰다. */
      const enc = encodeURIComponent(sec);
      if (enc !== sec) assert.ok(!got[0].includes(enc), `${label}: 인코딩된 «${sec}» 유출 — ${got[0]}`);
    }
  }
});

test('R2 ★data: URI 는 «이미지 바이트»였다 — 페이로드가 안 담긴다', () => {
  const b = boot();
  const payload = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQ'.repeat(30);
  const got = fire(b, resEv('IMG', 'data:image/png;base64,' + payload));
  // 양성대조 — 고치기 전에는 1000자 상한까지 «내용»이 담겼다
  assert.ok(payload.length > 1000, '표본이 충분히 길지 않다');
  assert.ok(!got[0].includes('iVBOR'), '이미지 바이트가 담겼다: ' + got[0].slice(0, 120));
  assert.ok(!got[0].includes('base64'), got[0]);
  assert.ok(got[0].length < 60, '줄이 여전히 길다(' + got[0].length + '자): ' + got[0].slice(0, 80));
  assert.ok(got[0].includes('data:'), '무엇이었는지도 사라지면 재현이 죽는다: ' + got[0]);
});

test('R3 ★쿼리스트링의 서명·토큰이 안 담긴다', () => {
  const b = boot();
  const got = fire(b, resEv('IMG', 'https://cdn.lotte.co.kr/a.png?sig=abc123&token=SECRET_TOKEN_9f8e7d&exp=1788'));
  for (const bad of ['SECRET_TOKEN', 'sig=', 'token=', 'abc123']) {
    assert.ok(!got[0].includes(bad), `«${bad}» 유출: ` + got[0]);
  }
});

/* ── ⑵ 재현 능력을 죽이지 않는다 ────────────────────────────────────────── */
test('R4 ★남는 것 — 태그·스킴·확장자. 원인 유형을 이걸로 가른다', () => {
  const b1 = boot(); assert.match(fire(b1, resEv('IMG', 'goya-asset://p/x.png'))[0], /img 로드 실패: goya-asset: \.png/);
  const b2 = boot(); assert.match(fire(b2, resEv('IMG', 'file:///Users/a/b/c.gif'))[0], /img 로드 실패: file: \.gif/);
  const b3 = boot(); assert.match(fire(b3, resEv('SCRIPT', 'https://cdn/x/three.min.js'))[0], /script 로드 실패: https: \.js/);
  // ★<link> 는 src 가 아니라 href 다 — 후킹이 둘 다 본다
  const b4 = boot(); assert.match(fire(b4, resEv('LINK', 'https://f/x.css', 'href'))[0], /link 로드 실패: https: \.css/);
  const b5 = boot(); assert.match(fire(b5, resEv('IMG', ''))[0], /\(주소 없음\)/);
});

test('R4b ★쿼리·프래그먼트가 붙어도 «확장자»를 읽는다 — 서명 URL 은 항상 쿼리가 있다', () => {
  /* ⚠️이 핀은 «유출»이 아니라 «재현» 축이다. 쿼리를 안 버려도 유출은 안 난다 —
     출력에 싣는 건 정규식으로 뽑은 «확장자»뿐이고 경로·쿼리 자체는 애초에 안 실리기 때문이다.
     대신 확장자가 «사라진다»(`a.png?sig=…` 는 .png 로 안 끝난다) ⇒ gif·svg 구분이 죽는다. */
  const b1 = boot();
  assert.match(fire(b1, resEv('IMG', 'https://cdn.lotte.co.kr/a.png?sig=abc123&exp=1788'))[0],
    /https: \.png/, '쿼리가 붙자 확장자를 잃었다');
  const b2 = boot();
  assert.match(fire(b2, resEv('IMG', 'https://x/hero.gif#frame2'))[0], /https: \.gif/);
});

test('R5 ★★중복 억제 — 같은 에셋 3칸이 1칸이 되고, «서로 다른» 에셋은 안 뭉친다', () => {
  /* 내보내기 한 번에 같은 깨진 이미지가 세 번 온다 — 라이브 DOM · export 클론 · truth 클론이
     전부 document.body 에 붙기 때문이다. 그건 MAX_PER_RUN 예산 «밖»이라 남의 오류를 밀어낸다. */
  const b = boot();
  const same = 'goya-asset://p/롯데_메인.png';
  b.onError(resEv('IMG', same));           // 라이브
  b.onError(resEv('IMG', same));           // export 클론
  b.onError(resEv('IMG', same));           // truth 클론
  assert.equal(b.rb.size(), 1, '3칸이 그대로다: ' + JSON.stringify(b.rb.list().map(x => x.msg)));

  /* ★«사이에 다른 오류가 끼어도» 억눌러야 한다. 실제 순서가 그렇다 —
     라이브 img 실패 → (그 사이 다른 오류) → export 클론 부착 → truth 클론 부착.
     직전 한 칸만 보는 구현이면 여기서 샌다. */
  b.rb.clear();
  b.onError(resEv('IMG', same));
  b.w.console.error('그 사이에 난 다른 오류');
  b.onError(resEv('IMG', same));
  assert.equal(b.rb.list().filter(e => e.level === 'resource').length, 1,
    '사이에 다른 줄이 끼자 중복이 새어 들어왔다: ' + JSON.stringify(b.rb.list().map(x => x.msg)));

  // ★서로 다른 에셋은 «갈려야» 한다 — 해시가 그 일을 한다(해시를 빼면 한 줄로 합쳐진다)
  b.rb.clear();
  b.onError(resEv('IMG', same));
  b.onError(resEv('IMG', 'goya-asset://p/롯데_서브.png'));
  const msgs = b.rb.list().map(x => x.msg);
  assert.equal(msgs.length, 2, '다른 에셋이 뭉쳐졌다: ' + JSON.stringify(msgs));
  assert.notEqual(msgs[0], msgs[1], '두 줄이 구분이 안 된다: ' + JSON.stringify(msgs));
  // 그래도 파일명은 여전히 없다
  for (const m of msgs) { assert.ok(!m.includes('롯데'), m); assert.ok(!m.includes('메인'), m); assert.ok(!m.includes('서브'), m); }
});

/* ── ⑶ ★공용 파일이다 — resource 밖 동작은 «안 바꾼다» ───────────────────── */
test('R6 ★resource 밖 동작 무변경 — 다른 후킹·세척기·중복정책이 그대로다', () => {
  const b = boot();
  // console.error 후킹은 «같은 줄을 두 번» 담는다(중복 억제는 resource 전용이다)
  b.w.console.error('같은 오류');
  b.w.console.error('같은 오류');
  assert.equal(b.rb.size(), 2, '중복 억제가 resource 밖으로 샜다: ' + JSON.stringify(b.rb.list()));
  assert.equal(b.rb.list()[0].level, 'console.error');

  b.rb.clear();
  // onerror(message 있는 스크립트 오류) 경로는 그대로
  b.onError({ message: 'boom', filename: 'file:///Users/kim minjae/앱/js/x.js', lineno: 12 });
  assert.equal(b.rb.list()[0].level, 'onerror');
  assert.ok(!b.rb.list()[0].msg.includes('minjae'), b.rb.list()[0].msg);

  b.rb.clear();
  b.onRej({ reason: new Error('rejected') });
  assert.equal(b.rb.list()[0].level, 'unhandledrejection');

  // 공개 API·상한은 그대로
  assert.equal(b.rb.max, 20);
  assert.equal(typeof b.rb.scrubPaths, 'function');
  assert.equal(b.rb.scrubPaths('/Users/kim minjae/작업/x'), '~/…/x');
  assert.equal(b.w.console.error.__reportBufferWrapped, true);
});

test('R7 ★링버퍼 상한 20은 그대로 — resource 가 링을 다 먹지 않는다', () => {
  const b = boot();
  for (let i = 0; i < 40; i++) b.onError(resEv('IMG', 'goya-asset://p/a' + i + '.png'));
  assert.equal(b.rb.size(), 20, '상한이 깨졌다: ' + b.rb.size());
});
