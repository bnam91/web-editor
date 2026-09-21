/* ══════════════════════════════════════════════════════════════════════════
   release-gate-wiring — 「배포 게이트와 검사가 «모든 배포 경로»에서 돈다」를 잠근다
   ──────────────────────────────────────────────────────────────────────────
   무엇이 있었나 (2026-09-22 실측):
     tools/deploy-gate.js 는 2026-08-15 에 「안 지키면 배포가 실패하는 구조」로 태어났다.
     그런데 달린 자리는 package.json 의 release:mac / release:win «앞»뿐이었고,
     정규 배포 경로는 «태그 푸시 → .github/workflows» 이며 거기선
     `npx electron-builder` 를 **직접** 부른다 ⇒ 게이트를 통째로 비껴갔다.

     ★실행 기록으로 확인(gh run view, 단계 전수):
         v0.8.5 · v0.8.6 · v0.9.0 · v0.9.1 · v0.9.2 · v0.9.3 — 맥·윈 양쪽 success.
         마지막 맥 실행의 단계 아홉 개:
           Set up job / Checkout / Setup Node / Install deps / Import signing certificate /
           Build only(skipped) / Build & publish / Upload artifact / Cleanup keychain
         ⇒ **게이트도 검사도 한 줄이 없다.**
     ★그리고 그 게이트는 «지금» 실제로 배포 차단(exit 1)을 내고 있었다
       (SIGLESS_GRACE_UNTIL 까지 40일 < GRACE_DAYS 45일).
       ⇒ 로컬로 내보내려 하면 막히고, 태그를 밀면 그냥 나갔다.

     ★같은 아홉 단계에 `npm test` 도 `npm run test:dom` 도 없다 — T-144 가 이것의 반쪽이다.
       훅(pre-push)·배포 게이트·CI 어디에도 검사를 부르는 자리가 없었다.

   ⛔이 파일이 잠그는 것은 «게이트의 내용»이 아니라 «게이트가 불리는가»다.
     내용은 tools/deploy-gate.js 가 스스로 본다.
   ★R5 가 알맹이다 — 워크플로를 «전수»로 훑는다. 새 배포 경로가 조용히 들어와도
     같은 사각지대를 다시 못 만든다.

   ⛔이 검사는 «파일 모양»만 잰다. CI 에서 실제로 돌아 초록이 나는지는 태그를 밀어야 안다 —
     그건 아직 «안 쟀다». 여기 초록을 「CI 에서 돈다」로 읽지 마라.
═══════════════════════════════════════════════════════════════════════════ */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const _req = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const WF_DIR = path.join(ROOT, '.github', 'workflows');

/* ★주석(#) 걷어내기는 «공용 부품»을 쓴다 — tests/unit/_strip-comments.js
   ⛔여기서 새로 만들지 마라(S-6 이 막는다). 처음에 여기서 만들었다가 S-6 에 잡혔고,
     「YAML 이라 다른 함수다」로 넘기지 않고 공용 부품에 stripYamlComments 를 열었다.
   왜 걷나 — 산문은 «부르는 자리»가 아니다. 안 걷으면 이 고침의 설명 주석이 스스로 초록을 낸다. */
const { stripYamlComments } = _req('./_strip-comments.js');

function workflows() {
  if (!fs.existsSync(WF_DIR)) return [];
  return fs.readdirSync(WF_DIR)
    .filter(f => /\.ya?ml$/.test(f))
    .map(f => ({ name: f, code: stripYamlComments(fs.readFileSync(path.join(WF_DIR, f), 'utf8')) }));
}
/** 이 워크플로가 «앱을 만들어 내보내는» 경로인가 = electron-builder 를 부른다. */
const isBuildPath = (w) => w.code.includes('electron-builder');

test('R1 ★전제 + 양성대조 — 배포 워크플로가 «실재»하고 빌드를 부른다', () => {
  const all = workflows();
  assert.ok(all.length > 0,
    '★.github/workflows 가 비었다 — 이 파일의 검사들이 «안 돈» 것이지 통과가 아니다');
  const builders = all.filter(isBuildPath);
  assert.ok(builders.length >= 2,
    `★electron-builder 를 부르는 워크플로가 ${builders.length}개다(맥·윈 둘이어야 한다). ` +
    '경로가 바뀌었다면 아래 검사들이 «비껴갈» 수 있으니 먼저 이 줄을 고쳐라');
});

test('R2 ★배포 게이트가 «빌드보다 먼저» 불린다 (모든 빌드 경로에서)', () => {
  for (const w of workflows().filter(isBuildPath)) {
    const g = w.code.indexOf('tools/deploy-gate.js');
    const b = w.code.indexOf('electron-builder');
    assert.notEqual(g, -1,
      `★${w.name} 이 배포 하드 게이트를 «안» 부른다 — 이 경로로 나가면 DEPLOY-BLOCK 도, ` +
      '공개키 대조(KEY_PROVENANCE)도, 서명없음 유예 마감도 «아무도 안 본다». ' +
      '2026-09-22 실행 기록에서 여섯 릴리스가 실제로 이 구멍으로 나갔다');
    assert.ok(g < b,
      `★${w.name} 에서 게이트가 빌드 «뒤»에 있다 — 막아도 이미 만들고 서명한 뒤다`);
  }
});

test('R3 ★검사가 «빌드보다 먼저» 불린다 (T-144)', () => {
  for (const w of workflows().filter(isBuildPath)) {
    const b = w.code.indexOf('electron-builder');
    const unit = w.code.indexOf('npm test');
    const dom = w.code.indexOf('npm run test:dom');
    assert.notEqual(unit, -1,
      `★${w.name} 이 단위 검사를 «안» 부른다 — 훅·게이트·CI 어디에도 부르는 자리가 없으면 ` +
      '검사는 «사람이 생각났을 때»만 돈다(T-144)');
    assert.notEqual(dom, -1, `★${w.name} 이 DOM 검사를 «안» 부른다`);
    assert.ok(unit < b && dom < b,
      `★${w.name} 에서 검사가 빌드 «뒤»에 있다 — 빨강이 나도 이미 나간 뒤다`);
  }
});

test('R4 ★음성대조 — 게이트 줄을 빼면 R2 가 실제로 빨강이 된다', () => {
  /* 화석을 안 베낀다 — «지금» 파일에서 그 줄만 지운 변형본을 만든다. */
  const w = workflows().filter(isBuildPath)[0];
  assert.ok(w, '★빌드 워크플로가 없다 — 검사가 안 돈 것이다');
  /* ⛔여기서 「변환이 늙었다」라고만 적으면 «고침이 통째로 빠진» 경우를 그쪽으로 잘못 보낸다.
     실제로 그랬다 — 워크플로를 되돌려 보니 R4 가 「지울 줄을 못 찾았다」로 죽어서
     읽는 사람을 이 검사 파일로 보냈다. 원인은 워크플로였다. 그래서 둘을 갈라 적는다. */
  const mutated = w.code.replace('tools/deploy-gate.js', '');
  assert.notEqual(mutated, w.code,
    `★${w.name} 에 'tools/deploy-gate.js' 가 «아예 없다». 둘 중 하나다 — ` +
    '⑴ 게이트 배선이 빠졌다(그러면 R2 도 같이 빨갛다 ⇒ 워크플로를 고쳐라), ' +
    '⑵ 부르는 «표기»가 바뀌었다(R2 가 초록이면 이쪽 ⇒ 이 검사의 문자열을 고쳐라). ' +
    'R2 부터 봐라.');
  assert.equal(mutated.indexOf('tools/deploy-gate.js'), -1,
    '★변형본에 아직 게이트가 남아 있다 — R2 의 초록은 «없어서»가 아니라 «못 봐서»일 수 있다');
});

test('R5 ★새 배포 경로가 조용히 들어와도 같은 사각지대를 못 만든다 (전수)', () => {
  /* ★이 검사의 알맹이 — 이름을 열거하지 않는다. 「electron-builder 를 부르면 배포 경로다」로
     «자동으로» 로스터가 된다. 그래서 release-linux.yml 같은 것이 새로 생겨도 걸린다.
     ⛔면제를 두고 싶으면 «이유»를 여기 적어라 — 이름만 빼면 같은 구멍이 다시 열린다. */
  const EXEMPT = {
    /* (지금은 비어 있다) */
  };
  const bad = [];
  for (const w of workflows().filter(isBuildPath)) {
    if (w.name in EXEMPT) continue;
    const miss = [];
    if (!w.code.includes('tools/deploy-gate.js')) miss.push('배포 게이트');
    if (!w.code.includes('npm test')) miss.push('단위 검사');
    if (!w.code.includes('npm run test:dom')) miss.push('DOM 검사');
    if (miss.length) bad.push(`${w.name} — 빠진 것: ${miss.join(', ')}`);
  }
  assert.deepEqual(bad, [],
    '★앱을 만들어 내보내는 워크플로가 게이트/검사를 안 거친다. ' +
    '면제하려면 EXEMPT 에 «이유와 함께» 적어라 — 이름만 빼면 2026-08-15~09-11 의 구멍이 다시 열린다');
});

test('R6 ★로컬 경로도 그대로 게이트를 지난다 (여기만 고치고 저기를 풀지 않는다)', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  for (const k of ['release:mac', 'release:win']) {
    assert.ok(pkg.scripts?.[k], `★package.json 에 ${k} 이 없다 — 검사가 안 돈 것이다`);
    assert.match(pkg.scripts[k], /deploy-gate\.js/,
      `★${k} 이 게이트를 안 부른다 — CI 를 고쳤다고 로컬 경로를 풀면 구멍이 자리만 옮긴다`);
  }
});
