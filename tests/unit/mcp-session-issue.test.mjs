/* ══════════════════════════════════════════════════════════════════════════
   mcp-session-issue — 「호출자를 갈라 주는 자리」와 「원장에 부른 쪽을 남기는 자리」를 잠근다
   ──────────────────────────────────────────────────────────────────────────
   무엇이 있었나 (2026-09-22 실측, 격리 인스턴스):
     쓰기 게이트(확정 안 한 프로젝트엔 못 쓴다)는 «호출자별»로 걸린다.
     호출자는 요청의 `Mcp-Session-Id` 로 가른다.
     ⛔그런데 서버가 그 값을 «한 번도 발급하지 않았다». 규약(Streamable HTTP)상 클라이언트는
       «서버가 준» 세션 id 만 되돌려 보낸다 ⇒ ★규약을 지키는 클라이언트일수록 헤더를
       «안 보내고» 전부 한 칸(`anon`)에 뭉쳤다. 그 칸은 공유라, 남이 세운 확정으로 쓰기가 통과했다.
     ⚠️소스에 이 자리를 예견한 주석이 있고 그 근거 ⑶ 은 「브리지가 반드시 보내게(이미 그렇다)」였다.
       **그 전제가 깨졌다** — 브리지를 «안 거치고» 이 서버에 바로 붙는 길이 실제로 쓰인다.
     ⛔그리고 원장(tool-audit.jsonl)에 «부른 쪽» 칸이 없어서, 그렇게 들어온 쓰기가 정상 쓰기와
       글자 하나 다르지 않게 남았다 ⇒ **일이 나도 「일어났나」를 못 재는 축**이었다.

   고친 모양 셋:
     ㉠ initialize 에서 세션 id 를 «발급»하고 응답 헤더로 싣는다
        ⛔헤더 없는 호출자를 «거절하지 않는다» — 직접 HTTP 로 부르는 도구·검사가 통째로 죽는다.
          이 고침은 «막는 것»이 아니라 «갈라 주는 것»이다.
     ㉡ CORS 에 Expose 를 더한다 — Allow 만 있으면 «보내는 것»은 되고 «읽는 것»이 안 된다.
     ㉢ 원장을 쓰는 «모든» 자리에 caller 를 남긴다.

   ★행동은 실앱에서 쟀다(2026-09-22, 격리 포트):
     · initialize 응답에 Mcp-Session-Id 1건(고치기 전 0건)
     · 그 id 를 되돌려 보낸 호출자의 확정 없는 쓰기 → 거절됨
     · 원장이 `caller=s-…` 와 `caller=anon` 으로 갈림(고치기 전 칸 자체가 없음)
   ⛔여기 초록을 «행동까지 봤다»로 읽지 마라 — 이 파일은 «소스 모양»만 잰다.
     (mcp-server.js 는 electron 의존이라 node 단위검사에 못 싣는다.)
   ⛔재현 절차는 적지 않는다. 자리와 종류까지만.
═══════════════════════════════════════════════════════════════════════════ */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const _req = createRequire(import.meta.url);
const { stripComments } = _req('./_strip-comments.js');   /* ⛔새로 만들지 마라(S-6) */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC_PATH = path.join(ROOT, 'main', 'claude-pm', 'mcp-server.js');
const raw = () => fs.readFileSync(SRC_PATH, 'utf8');
const code = () => stripComments(raw());

test('M1 ★전제 + 양성대조 — 호출자를 가르는 장치가 실재한다', () => {
  assert.ok(fs.existsSync(SRC_PATH), '★mcp-server.js 가 없다 — 이 검사가 «안 돈» 것이지 통과가 아니다');
  const c = code();
  for (const tok of ['_confirmedByCaller', 'function _callerId(', "req.headers['mcp-session-id']"]) {
    assert.ok(c.includes(tok),
      `★${tok} 이 사라졌다 — 호출자를 가르는 얼개가 바뀌었다. 아래 검사들이 «없는 것»을 지키게 된다`);
  }
});

test('M2 ★서버가 세션 id 를 «발급»하고 응답 헤더로 싣는다', () => {
  const c = code();
  assert.match(c, /method === 'initialize'/,
    '★initialize 를 가려내는 자리가 없다 — 발급할 시점이 사라졌다');
  assert.match(c, /Mcp-Session-Id['"]\s*\]\s*=|'Mcp-Session-Id'\s*:/,
    '★응답 헤더에 Mcp-Session-Id 를 «안» 싣는다. 규약상 클라이언트는 «서버가 준» 것만 ' +
    '되돌려 보내므로, 안 주면 규약을 지키는 클라이언트일수록 헤더 없이 한 칸에 뭉친다');
  assert.match(c, /randomBytes|randomUUID/,
    '★세션 id 를 «만드는» 자리가 없다 — 고정값이면 갈라지지 않는다');
});

test('M3 ★그 헤더를 클라이언트가 «읽을» 수 있다 (Allow 만으로는 모자라다)', () => {
  const c = code();
  assert.match(c, /Access-Control-Allow-Headers[^\n]*Mcp-Session-Id/,
    '★보내는 것을 허용하지 않는다');
  assert.match(c, /Access-Control-Expose-Headers[^\n]*Mcp-Session-Id/,
    '★Expose 가 없다 — 발급해도 브라우저 클라이언트는 «읽지 못해» 되돌려 보낼 수 없다');
});

test('M4 ⛔원장을 쓰는 «모든» 자리가 부른 쪽을 남긴다 (자리를 전수로 센다)', () => {
  /* ★이름을 열거하지 않는다 — 「tool-audit.jsonl 에 쓰는 자리」로 자동 로스터가 된다.
     ⛔이 검사가 필요한 까닭이 실측으로 있다: 원장을 쓰는 자리가 «둘»인데 한 곳만 고쳤다가
       도구 원장에 caller 가 «안 남는» 것을 실앱에서 잡았다(2026-09-22). */
  const lines = code().split('\n');
  const writers = [];
  lines.forEach((L, i) => { if (L.includes("'tool-audit.jsonl'")) writers.push(i); });
  assert.ok(writers.length >= 2,
    `★원장을 쓰는 자리가 ${writers.length}곳이다 — 둘 이상이어야 한다. ` +
    '얼개가 바뀌었으면 이 검사를 먼저 고쳐라(«못 봐서» 초록이 되는 자리다)');

  const missing = [];
  for (const i of writers) {
    /* 그 append 가 만드는 «객체 리터럴» 안에 caller 가 있는가 — 앞뒤 12줄로 본다 */
    const win = lines.slice(Math.max(0, i - 2), i + 12).join('\n');
    if (!/\bcaller\s*:/.test(win)) missing.push(`걷은 소스 ${i + 1}번째 줄`);
  }
  assert.deepEqual(missing, [],
    '★원장에 «부른 쪽» 칸을 안 남기는 자리가 있다. 원장은 사고 뒤 «유일한 근거»인데 ' +
    '누가 불렀는지가 빠지면, 확정 없이 들어온 쓰기가 정상 쓰기와 구별되지 않는다 ' +
    '⇒ 「일어났나」를 못 재는 축이 된다.\n  ' + missing.join('\n  '));
});

test('M5 ★음성대조 — 한 자리에서 caller 를 빼면 M4 가 실제로 잡는다', () => {
  const lines = code().split('\n');
  const writers = [];
  lines.forEach((L, i) => { if (L.includes("'tool-audit.jsonl'")) writers.push(i); });
  const i = writers[0];
  const mutated = lines.slice();
  for (let k = Math.max(0, i - 2); k < Math.min(mutated.length, i + 12); k++) {
    mutated[k] = mutated[k].replace(/\bcaller\s*:[^,]*,/, '');
  }
  const win = mutated.slice(Math.max(0, i - 2), i + 12).join('\n');
  assert.equal(/\bcaller\s*:/.test(win), false,
    '★caller 를 지운 변형본에서도 여전히 잡힌다 — M4 의 초록은 «있어서»가 아니라 «못 봐서»일 수 있다');
});
