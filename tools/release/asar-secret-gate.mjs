#!/usr/bin/env node
/* asar-secret-gate — 빌드 산출물에 «비밀»이 실렸는지 «검사»한다. 있으면 릴리스를 막는다.
 *
 * ★왜 이게 있나 (2026-09-06, 현빈 질문에서 나왔다: 「apikey까지 같이 배포되니?」)
 *   당시 배포본은 «무사했다»(asar 1,375 항목 전수, 키 0건). 그런데 막고 있는 게 없었다:
 *     · package.json build.files 가 «전부 담기» 형태인데 «.env 가 제외 목록에 없었다»
 *     · main.js:65 가 `_loadEnvFile(path.join(__dirname, '.env'))` — «패키징된 앱 안의» .env 도 읽는다
 *     · electron-builder 는 git 이 아니라 «디스크»에서 담는다 ⇒ .gitignore 는 방어가 «아니다»
 *     · 그리고 릴리스를 빌드하는 본체 체크아웃(/Users/a1/web-editor)에 .env 가 «실제로 있었다»
 *   ⇒ 누가 거기 `OPENAI_API_KEY=...` 한 줄 넣고 빌드하면 «전 사용자»에게 나간다. 그리고 아무도 모른다.
 *
 * ⛔이 파일이 있는 이유 = 「주의하세요」 문서로 닫지 않기 위해서다.
 *   경고는 갈라짐을 못 막는다. 검사만 막는다.
 *   (같은 날 실증: main/report/queue.js:114 주석에 「라이브 /api/report 는 404 를 준다」가
 *    적혀 있었는데도 사용자 신고가 271회 재시도로 갇혀 있었다. 주석은 아무것도 안 막았다.)
 *
 * 사용: node tools/release/asar-secret-gate.mjs <app.asar 경로>
 * 종료코드: 0=통과 · 1=비밀 발견(릴리스 중단) · 2=검사 자체 실패(«통과 아님»)
 */
import fs from 'node:fs';
import path from 'node:path';

const asarPath = process.argv[2];
const FAIL = 1, ERROR = 2;

function die(code, msg) { console.error(msg); process.exit(code); }
if (!asarPath) die(ERROR, '사용: node tools/release/asar-secret-gate.mjs <app.asar>');
if (!fs.existsSync(asarPath)) die(ERROR, `✗ asar 없음: ${asarPath}`);

let asar;
try { asar = (await import('@electron/asar')).default ?? (await import('@electron/asar')); }
catch (e) { die(ERROR, `✗ @electron/asar 를 못 읽었다: ${e.message}\n  ⛔이건 «통과»가 아니다. 검사가 못 돈 것이다.`); }

/* ── ① 파일 이름으로 거른다 ── */
const NAME_BAD = [
  /(^|\/)\.env(\..*)?$/i,          // .env · .env.local …
  /(^|\/)id_(rsa|ed25519|ecdsa)$/, // 개인키
  /\.(pem|p12|pfx|keystore|jks)$/i,
  /(^|\/)(credentials|secrets?)\.(json|ya?ml|txt)$/i,
  /(^|\/)auth\.json$/i,            // 세션토큰(런타임 userData 에만 있어야 한다)
];

/* ── ② 내용으로 거른다 (실제 키 «모양»만. 플레이스홀더는 안 잡는다) ──
 *   ⚠️`sk-ant-...` 같은 «UI 플레이스홀더»가 소스에 있다(report/prefs 화면). 그걸 잡으면 오탐이다.
 *     그래서 «…» 로 끝나거나 길이가 짧은 것은 제외하고, 실제 키 길이(20자+)만 본다. */
const CONTENT_BAD = [
  { re: /\bsk-ant-api\d\d-[A-Za-z0-9_-]{20,}/g,        what: 'Anthropic API 키' },
  { re: /\bsk-proj-[A-Za-z0-9_-]{20,}/g,               what: 'OpenAI 프로젝트 키' },
  { re: /\bsk-[A-Za-z0-9]{32,}/g,                      what: 'OpenAI 구형 키' },
  { re: /\bAIza[A-Za-z0-9_-]{30,}/g,                   what: 'Google API 키' },
  { re: /\bghp_[A-Za-z0-9]{30,}/g,                     what: 'GitHub 토큰' },
  { re: /\bxox[baprs]-[A-Za-z0-9-]{20,}/g,             what: 'Slack 토큰' },
  { re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g,         what: '개인키 블록' },
  { re: /\b(OPENAI|ANTHROPIC|GEMINI|GOOGLE)_API_KEY\s*=\s*\S{20,}/gi, what: '환경변수에 박힌 키' },
];

let list;
try { list = asar.listPackage(asarPath); }
catch (e) { die(ERROR, `✗ asar 목록을 못 읽었다: ${e.message}\n  ⛔이건 «통과»가 아니다.`); }

if (!Array.isArray(list) || list.length === 0)
  die(ERROR, '✗ asar 항목이 0개다 — 검사가 «아무것도 안 본» 것이다. 통과로 세지 않는다.');

const hits = [];
for (const entry of list) {
  if (NAME_BAD.some(re => re.test(entry)))
    hits.push({ file: entry, what: '비밀 파일 이름', sample: '(이름으로 적발 — 내용 안 읽음)' });
}

/* 내용 검사는 «텍스트로 보이는» 것만. 큰 바이너리는 건너뛰되 «건너뛴 수»를 보고한다. */
let scanned = 0, skipped = 0;
const TEXT_EXT = /\.(js|mjs|cjs|json|html|css|txt|env|ya?ml|sh|map)$/i;
for (const entry of list) {
  if (!TEXT_EXT.test(entry)) { skipped++; continue; }
  let buf;
  try { buf = asar.extractFile(asarPath, entry.replace(/^\//, '')); } catch { skipped++; continue; }
  if (buf.length > 8 * 1024 * 1024) { skipped++; continue; }
  const s = buf.toString('utf8');
  scanned++;
  for (const { re, what } of CONTENT_BAD) {
    re.lastIndex = 0;
    const m = re.exec(s);
    if (m) hits.push({ file: entry, what, sample: m[0].slice(0, 12) + '<가림>' });
  }
}

console.log(`[asar-secret-gate] 항목 ${list.length} · 내용검사 ${scanned} · 건너뜀 ${skipped}`);
if (scanned === 0) die(ERROR, '✗ 내용을 «한 파일도» 안 읽었다 — 검사가 성립 안 한다. 통과로 세지 않는다.');

if (hits.length) {
  console.error(`\n⛔ 비밀이 배포 산출물에 실렸다 — 릴리스를 중단한다. (${hits.length}건)`);
  for (const h of hits) console.error(`   · ${h.file}\n     ${h.what}: ${h.sample}`);
  console.error('\n  고치는 법: package.json build.files 의 제외 목록을 확인하고, 빌드 머신의 해당 파일을 치워라.');
  process.exit(FAIL);
}
console.log('[asar-secret-gate] ★PASS — 비밀 0건');
