/* tmproot-sole-owner — 「★임시 디렉터리를 ★치우는 자가 ★★`_tmproot.js` ★하나인가」의 ★자.
 *
 * ★★왜 있나 (2026-10-10 · 지디 ⑶)
 *   ★이 세션의 ★안전 훅이 ★`rm` 하나를 ★막았다 — ★「possibly-empty variable path: `"$D/$f"`」
 *   ⇒ ★전수로 세니 ★`tests/` 안에 ★`rmSync(변수, {recursive})` 꼴이 ★★40 파일 ★55 호출이었다
 *   ⇒ ★★그런데 ★처방이 ★★«가드를 ★40벌 복사»면 ★★그게 ★★«명부 둘»의 ★40배다
 *     ⇒ ★지디: 「⛔그대로는 안 된다 · ★★파생시켜 ★하나로 · ★일괄 sed 금지」
 *   ⇒ ★★그리고 ★★레포에 ★★이미 ★그 자가 ★있었다 — ★`tests/unit/_tmproot.js`
 *     ★그 자는 ★pid 우산 ＋ ★죽은 실행 회수 ＋ ★디스크 사전게이트 ＋ ★종료훅을 ★다 쥔다
 *     ⇒ ★★★부르는 쪽은 ★★지울 필요가 ★없다. ⇒ ★★«가드를 더하기»보다 ★★«지우는 줄을 없애기»가 ★낫다
 *
 * ★★★단위가 ★둘이다 — ★섞지 ★마라 (2026-10-10 · 지디가 ★제 처방을 ★고쳐 준 자리)
 *   ★★«칸»(PENDING·NOT_TMPROOT·DONE_EAGER)은 ★★«파일» 단위다 ⇒ ★「정확히 ★한 칸」 불변이 ★선다
 *   ★★«자»(아래 ★pairs())는 ★★★«rmSync ★한 줄» 단위다 ⇒ ★한 파일이 ★여러 쌍을 ★가질 수 ★있다
 * ★★★왜 갈라야 하나 — ★`operator-allow-cli.test.mjs` 가 ★★«섞였다»(★자가 ★찍는 ★참값):
 *   ★`rmSync(HOME)` ×2 = ★그 임시루트의 ★즉시치움(㉢) · ★`rmSync(inRepo)`·`rmSync(bad)` = ★그 검사의 ★주제(㉡)
 * ⚰️★★★내가 ★처음 ★이 자리에 ★`history-ipc` 를 ★적었고 ★★★틀렸다 — ★그 파일의 ★rmSync 는 ★★1건(eager)뿐이다.
 *   ★까닭: ★내 ★첫 걷기가 ★★주석을 ★떼지 ★않아 ★★주석 속 낱말(«진짜 영구삭제»)을 ★★rmSync ★대상으로 ★읽었다
 *   ⇒ ★★★「주석은 ★소스 파싱 게이트의 ★입력」 ★그 자리다. ★★그래서 ★`pairs()` 는 ★`stripComments` 를 ★먼저 쓴다
 *   ⇒ ★★그 파일을 ★★«파일 단위»로 ★⊇ 견주면 ★★㉢ 이기도 ㉡ 이기도 해서
 *     ★★「정확히 한 칸」과 ★그 ⊇ 견줌이 ★★서로 ★싸운다 ⇒ ★★★거짓 빨강이 ★난다
 * ⇒ ★★★칸은 ★파일로, ★자는 ★rmSync 줄로. ★★섞인 파일은 ★그 칸의 ★까닭에 ★★양쪽을 ★적는다
 *   (★★그게 ★「수가 갈리면 ★★단위부터」의 ★그 자리다 — ★T5 의 ⒡ 가 ★그것까지 ★잠근다)
 *
 * ⛔⛔★★★이 파일을 ★걷는 자는 ★★`stripComments` 를 ★★반드시 ★쓴다 (2026-10-10 실측 · 지디가 찾았다)
 *   ★까닭: ★여긴 ★★«까닭»을 ★많이 적는 파일이다 ⇒ ★★주석에 ★호출 이름이 ★자주 ★나온다
 *   ⛔★수를 ★여기 ★박지 ★않는다 — ★★`T7` 이 ★매 회차 ★찍는다(★주석 포함 · ★주석 뗀 뒤 · ★차이)
 *     ★까닭: ★★그 수는 ★이 파일을 ★고칠 때마다 ★움직인다 ⇒ ★★박으면 ★★산문이 ★먼저 ★썩는다
 *     (★실제로 ★★한 번 ★썩었다 — ★★본문 3건을 ★없앴더니 ★★머리말의 ★10 이 ★거짓이 됐다)
 *   ⇒ ★★주석을 ★안 떼는 자는 ★★★«참값 0» 대신 ★★«주석 속 전부» 를 ★센다
 *   ⇒ ★★★그게 ★★내가 ★오늘 ★두 번 ★밟은 ★길이다 — ★첫 걷기가 ★주석 낱말을 ★★대상으로 ★읽었다
 *     (★그 출력이 ★★«말이 안 되는 꼴»이었다 ⇒ ★★★그게 ★자가 ★깨졌다는 ★가장 ★싼 신호다. ★읽어라)
 *   ⇒ ★★★그래서 ★★`T7` 이 ★★그 두 수를 ★나란히 ★찍고 ★★본문 ★0건을 ★못박는다
 *   ★★＋ ★까닭 문자열에서도 ★★호출 꼴을 ★없앴다(★`name 접두사 …` 로) — ★★본문 ★0건을 ★만들려고
 *
 * ★★이 자가 ★재는 것 — ★두 축
 *   ㉠ ★★위반 집합 ⊆ ★★명부 (★새 위반이 ★생기면 ★빨강)
 *   ㉡ ★★명부에 ★★«이미 옮긴» 칸이 ★남아 있으면 ★빨강 (★명부가 ★낡으면 ★다음 위반을 ★가린다)
 *   ⛔등호로 ★수를 ★박지 않는다 — ★∅ 가 ★일치로 ★둔갑한다(★이 레포의 ★census 선례와 ★같은 규율)
 *
 * ★★★그래서 ★★«몇 벌 ★남았나»는 ★★이 자가 ★찍는다 — ⛔사람이 ★세지 ★않는다.
 *   ★명부가 ★0 이 되는 날 ★★이 자는 ★★진짜 금지로 ★선다.
 *
 * ⚠️★`tools/` 는 ★★범위 ★밖이다 — ★그쪽 임시물은 ★★테스트 수명이 ★아니고(★스윕·프로브가 ★제 수명을 쥔다)
 *   ★`_tmproot` 의 ★pid 우산·종료훅 모형이 ★안 맞는다. ⇒ ★★별건이다(★지디 판정 자리).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const { stripComments } = createRequire(import.meta.url)('./_strip-comments.js');
/* ★★이 파일도 ★합성 표본 ★뿌리가 ★필요하다(★T6 ⒜) — ★★그 뿌리마저 ★공용 자가 ★쥔다.
 * ★들이는 줄은 ★★호출 꼴이 ★아니다(`mkTmpRoot }` 뒤에 `(` 가 ★없다) ⇒ ★T7 의 ★자에 ★안 걸린다 */
const { mkTmpRoot } = createRequire(import.meta.url)('./_tmproot.js');

const ROOT = path.join(import.meta.dirname, '..', '..');
const SELF = fileURLToPath(import.meta.url);   /* ★이 파일 자신 — ★T7 이 ★제 오염을 ★잰다.
 * ⛔`new URL(import.meta.url).pathname` 은 ★★`win-portability` ②-5 가 ★막는다(★윈도우에서 `/C:/…`) */   /* ★이 파일 자신 — ★T7 이 ★제 오염을 ★잰다 */
const RM_RE = () => /\brmSync\s*\(/g;

/* ★★명부 — ★★«아직 ★손으로 ★치우는» 파일. ★이름으로 든다(⛔수를 박지 않는다).
   ★★옮길 때마다 ★여기서 ★뺀다. ★★그 수가 ★이 일의 ★남은 분량이다.
   ⛔까닭 없이 ★이름을 ★늘려 ★빨강을 ★끄지 ★마라 — ★늘릴 땐 ★«왜 공용 자를 못 쓰나»를 적어라. */
/* ★★★명부를 ★★«둘»로 갈랐다 (2026-10-10 · ★이전 ★2/5 뒤 ★실측)
 * ★★까닭: ★처음엔 ★★한 이름(`PENDING`)으로 ★★36벌을 ★묶었다 ⇒ ★★★그 수가 ★«무엇의 수»를 ★안 들었다
 *   ★★실측해 보니 ★★둘이 ★★전혀 다른 일이었다:
 *     ㉠ ★`mkdtempSync` 로 ★★«임시 루트»를 만들고 ★제 손으로 치운다  ⇒ ★★이전 ★대상이다
 *     ㉡ ★★`rmSync` 가 ★★«그 검사의 ★일 자체»다 — ★임시 루트가 ★아니다 ⇒ ★★★이전 대상이 ★아니다
 *        ★예: ★`recovery-collect` · ★`quit-save-window-gone` · ★e2e 셋 (★아래 ㉡ 칸의 ★까닭들)
 *            ★`recovery-collect` 는 ★★«사본이 ★없을 때»를 만들려 ★픽스처를 ★지운다
 *            ★`quit-save-window-gone` 의 ★`reset()` 은 ★시험 사이 ★★상태 파일을 ★씻는다
 *            ★e2e 셋은 ★★크롬 ★프로필 폴더(★`PROFILE`)를 ★치운다 — ★테스트 수명이 ★아니다
 *   ⇒ ★★★㉡ 를 ★«미이전»으로 ★세면 ★★★영원히 ★0 이 ★안 되는 수를 ★쫓는다
 *   ⇒ ★★그리고 ★★㉡ 를 ★`mkTmpRoot` 로 ★바꾸면 ★★★그 검사가 ★재던 것을 ★★부순다
 * ⚠️★㉡ 의 ★일부는 ★★`trackTmp` 로 ★갈 수 ★있을지도 ★모른다 — ★★그건 ★★파일별 판정이고
 *   ★★임자가 ★★내가 ★아니다. ⇒ ★★★조정자에게 ★올렸다. ⛔내가 ★고르지 ★않는다. */

/** ㉠ ★★이전 ★대상 — ★`mkdtempSync` 로 ★임시 루트를 ★만들고 ★제 손으로 ★치우는 자. */
const PENDING = {
};

/** ㉡ ★★이전 ★대상이 ★아니다 — ★`rmSync` 가 ★★«그 검사의 일»이다. ★까닭을 ★이름 옆에.
 *  ⛔여기 올리려면 ★★«그 rmSync 가 ★무엇을 ★지우나»를 ★읽고 ★적어라. ★«미이전»과 ★섞지 ★마라. */
const NOT_TMPROOT = {
  'tests/unit/win-portability.test.mjs':
    '★★공용자불가(★`goya-wp-deny-` ★하나만 — ★나머지 둘은 ★옮겼다) — ★`denyWrite(dir)` 의 ★복구가 '
    + '★`catch (_) {}` 로 ★삼킨다 ⇒ ★복구 실패 시 ★0500 이 ★남고 ★★우산의 ★recursive 치움이 ★그 안에서 ★실패한다 '
    + '⇒ ★★이 공용 자가 ★막으려던 ★그 누수를 ★이 한 벌이 ★만들 수 있다. '
    + '★★`denywrite.cjs` 는 ★부모를 ★안 건드린다(★지디 실측 — ★상속 ★없다) ⇒ ⛔«부모 사슬»로 ★적지 마라',
  'tests/unit/put-image-path.test.js':
    '★★공용자불가 — ★그 루트가 ★`os.homedir()` ★아래여야 한다. ★이 검사의 ★주제가 ★«홈 ★밖은 ★막힌다»다(:93·:107). '
    + '★`mkTmpRoot` 는 ★tmpdir 아래라 ★★옮기면 ★그 전제가 ★깨진다(★:69 가 ★homedir 길이로 ★자른다). '
    + '★★꼴은 ㉠(mkdtempSync 루트를 ★손으로 치움)이지만 ★★뜻은 ㉡ 이다',
  'tests/unit/_tmproot.js':                   '★공용 자 ★자신 — ★치우기의 ★임자다',
  'tests/unit/tmproot.test.js':               '★그 자의 ★회수를 ★직접 재는 검사',
  'tests/e2e/12-insert-seam-settle.spec.js':  '★크롬 ★프로필 폴더(PROFILE) — ★테스트 수명이 아니다 · ★e2e',
  'tests/e2e/13-undo-family.spec.js':         '★크롬 ★프로필 폴더(PROFILE) · ★e2e',
  'tests/e2e/14-undo-depth.spec.js':          '★크롬 ★프로필 폴더(PROFILE) · ★e2e',
  'tests/unit/destructive-ipc.test.js':       '★`copy` — ★파괴적 IPC 가 ★무엇을 지우나가 ★주제다',
  'tests/unit/grid-gap-clamp.test.js':        '★`srtAlias` — ★별칭 파일을 ★지우는 것이 ★장면이다',
  'tests/unit/mcp-project-crud.test.js':      '★프로젝트 ★삭제 CRUD — ★그게 ★주제다',
  'tests/unit/migrate-files-vanish.test.js':  '★파일이 ★사라지는 장면을 ★만든다 — ★주제다',
  'tests/unit/migrator-vanish.test.js':       '★같은 축 — ★사라짐이 ★주제다',
  'tests/unit/quit-save-window-gone.test.mjs':'★`reset()` — ★시험 사이 ★상태 파일 씻기',
  'tests/unit/recovery-collect.test.mjs':     '★★«사본이 없을 때»를 만들려 ★픽스처를 지운다 — ★주제다',
};

/** ㉢ ★★이미 ★공용 자를 ★쓴다 — ★그 위에 ★★«즉시 치움»을 ★얹었다. ★★그게 ★의도다.
 *  ★★★이 칸이 ★★없어서 ★이 둘이 ★★㉡ 에 ★★«틀린 까닭»으로 ★앉아 있었다(2026-10-10 · 지디가 ★재서 잡았다).
 *    ★내가 적었던 까닭: ★`history-restart` → 「★`ud`(userData) — ★재시작 장면을 만든다」
 *    ★★참값: ★그 `ud` 는 ★★`mkTmpRoot('goya-restart-')` 다 ⇒ ★★★이미 ★공용 자다
 *    ⇒ ★★수는 ★안 틀렸다(★둘 다 ★«안 옮길 것») ★★그러나 ★★«무엇의 수인가»를 ★흐렸다
 *  ★★왜 ★즉시 치우나 — ★★`mkTmpRoot` 는 ★★종료훅에 ★맡긴다. ★그 사이 ★임시물이 ★남는다.
 *    ★한 파일이 ★★여러 벌을 ★연달아 만들면(★`history-restart` 는 ★셋) ★★그 사이에 ★쌓인다
 *    ⇒ ★★그래서 ★★«동기로» 치운다. ★`coupon-presets` 주석이 ★그 까닭을 ★이미 말한다.
 *  ⇒ ★★★즉 ★이 칸은 ★★결함이 ★아니다. ⛔여기 것을 ★`PENDING` 으로 ★옮기지 ★마라. */
const DONE_EAGER = {
  'tests/unit/operator-allow-cli.test.mjs':
    '★★섞였다 — ★HOME = mkTmpRoot 접두사 goditor-opallow- 의 ★즉시치움 ★3 ＋ ★inRepo·bad(그 검사의 주제) ★2. '
    + '★★왜 ★즉시치움인가 = ★★그 폴더에 ★★개인키가 ★산다 ⇒ ★종료훅(★SIGKILL 에서 ★안 돈다)에 ★못 맡긴다. '
    + '★★그 약속을 ★★잠그는 칸 = ★★C-KEYGONE(★그 파일) — ⛔머리말 ★선언으로 ★안 닫았다',
  'tests/unit/history-restart.test.js':
    '★`ud` = mkTmpRoot 접두사 goya-restart{,2,3}- ★셋 — ★rmSync ★3/3 이 ★그 임시루트의 ★즉시 치움이다',
  'tests/unit/history-ipc.test.js':
    '★`outside` = mkTmpRoot 접두사 goya-outside- 의 ★즉시치움 ★1 — ★★그것뿐이다(★자가 ★쟀다). '
    + '⚰️★내가 ★처음 ★«섞였다»로 적었고 ★★틀렸다 — ★주석을 ★안 뗀 ★걷기가 ★주석 낱말을 ★대상으로 ★읽었다',
};

/** ★★★누수 명부(★둘째 축) — ★`mkdtempSync` 는 ★쓰는데 ★★치우는 자가 ★모자란 파일.
 *  ★★★까닭은 ★«위생»이 ★아니라 ★★«관측 가능성»이다(★위 `leakers()` 머리말).
 *  ★칸 값 = ★★«Δ · 접두사» — ★★그 접두사가 ★★디스크에서 ★찾을 ★이름이다.
 *  ⇒ ★★이전이 ★끝나면 ★★그 접두사들이 ★★0 이 되어야 한다 — ★★그게 ★완주 판정이다.
 *  ⛔수를 ★손으로 ★고치지 ★마라 — ★★`T6` 가 ★★이 명부와 ★자를 ★견준다. */
const LEAKING = {
  /* ★★★비었다 — ★★이 축의 ★일이 ★끝났다(★17 → ★0 · ★Δ22 → ★0).
   *   ⛔★«비었으니 ★안 재도 된다»가 ★아니다 — ★★진짜 뿌리가 ★0 이면 ★진짜 파일로는 ★양성대조를 ★못 세운다
   *   ⇒ ★★T6 ⒜ 가 ★`mkTmpRoot` 로 ★합성 표본 ★뿌리를 ★만들어 ★자가 ★살아있음을 ★매 회차 ★증명한다
   *   ★새로 ★`mkdtempSync` 를 ★손으로 쓰는 자가 ★생기면 ★★여기 ★적지 말고 ★★`mkTmpRoot` 로 ★옮겨라 */
};

/** ★★«rmSync ★한 줄» 단위의 ★자 — ★{file, line, kind} ★쌍을 ★돌려준다.
 *  ★갈래 셋: ★`eager`(대상이 ★mkTmpRoot 결과) · ★`pending`(대상이 ★mkdtempSync 결과) · ★`subject`(그 밖)
 *  ⛔«파일이 ★mkTmpRoot 를 ★쓴다»만으로 ★판정하지 ★않는다 — ★`recovery-collect` 가 ★그 함정이다
 *    (★`mkTmpRoot` 를 쓰면서 ★`rmSync(em)` 으로 ★픽스처를 지운다 ⇒ ★★`subject`) */
function pairs() {
  const out = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const q = path.join(d, e.name);
      if (e.isDirectory()) { walk(q); continue; }
      if (!/\.(js|mjs|cjs)$/.test(e.name)) continue;
      const src = stripComments(fs.readFileSync(q, 'utf8'));
      if (!RM_RE().test(src)) continue;
      const rel = path.relative(ROOT, q);
      const eagerVars = new Set(), pendVars = new Set();
      for (const m of src.matchAll(/(\w+)\s*=\s*mkTmpRoot\s*\(/g)) eagerVars.add(m[1]);
      for (const m of src.matchAll(/(\w+)\s*=\s*[\w.]*mkdtempSync\s*\(/g)) pendVars.add(m[1]);
      src.split('\n').forEach((ln, i) => {
        for (const m of ln.matchAll(/rmSync\(\s*([^,)]+)/g)) {
          const base = (m[1].trim().match(/^(\w+)/) || [])[1] || '';
          const kind = eagerVars.has(base) ? 'eager' : (pendVars.has(base) ? 'pending' : 'subject');
          out.push({ file: rel, line: i + 1, kind, target: m[1].trim().slice(0, 40) });
        }
      });
    }
  };
  walk(path.join(ROOT, 'tests'));
  return out;
}

/** ★★★둘째 축 — ★«아예 ★안 치우는» 파일 (2026-10-10 · 지디가 ★찾았다)
 *  ★★★왜 ★둘째 축이 ★필요한가 — ★아래 `violations()` 는 ★★`rmSync` 를 ★«쓰는» 파일만 ★센다
 *    (`if (n) out[…] = n;`) ⇒ ★★★`rmSync` 가 ★0 인 파일은 ★★★영원히 ★안 보인다
 *  ⇒ ★★그리고 ★그게 ★★`_tmproot.js` 머리말의 ★그 사고(★「임시 디렉터리 ★25,102개 · ★30GB」)의
 *    ★★★참 ★원천 꼴이다 — ★★«공용 자를 ★안 쓴 치움»이 아니라 ★★★«아예 ★안 치우는 것»
 *  ★★그리고 ★★T1 의 ★양성대조는 ★★그 축에 ★★없었다 — ★「rmSync 를 쓰는 위반」만 ★본다
 *    ⇒ ★★★그래서 ★T1~T4 ★초록이 ★★17벌의 ★누수를 ★★안 보고 ★있었다
 *
 *  ★★★그리고 ★이전의 ★«까닭»은 ★★★«위생»이 ★아니다 — ★★★«관측 ★가능성»이다(지디 정정):
 *    ★`mkdtempSync('zoom-tangent-')` 는 ★★임자 표시를 ★안 남긴다
 *      ⇒ ★그 폴더가 ★남아도 ★★«누가 ★만들었나»·«살아있나»를 ★★아무도 ★모른다
 *      ⇒ ★★★어떤 디스크 자로도 ★★«회수해도 되나»를 ★판정할 수 ★없다
 *    ★반면 ★`mkTmpRoot` 는 ★`goya-run-<pid>` ★우산 ★안에 ★앉는다
 *      ⇒ ★★`ps -p <pid>` ★한 줄로 ★★«죽은 임자의 것»을 ★가를 수 ★있다
 *    ⇒ ★★★치우기는 ★실패할 수 ★있지만, ★★★못 재면 ★★실패도 ★모른다. ★★후자가 ★더 크다
 *
 *  ★★자 = ★`mkdtempSync` 수 > (`rmSync` ＋ `mkTmpRoot` ＋ `trackTmp`) 수
 *  ★★＋ ★★«접두사»도 ★같이 돌려준다 — ★★그게 ★★디스크에서 ★그것을 ★찾을 ★수단이다
 *    (⛔지금은 ★찾을 ★이름을 ★모른다 ⇒ ★★지디의 ★`goya*`·`goditor*` 겨냥에 ★★20/20 이 ★안 걸렸다) */
/** ★★★이 자가 ★걷는 ★뿌리들. ★★`tools/` 도 ★★든다(지디 판정 2026-10-10: ★«범위에 드나»가 아니라 ★«이미 됐다»
 *  ⇒ ★★자가 ★스스로 ★열고 닫게 ★하라). ⛔★여기서 ★빼면 ★★T6 ⒞ 의 ★전제가 ★빨개진다. */
const SCAN_ROOTS = ['tests', 'tools'];

/** ★그 뿌리에서 ★자가 ★★«읽을 수 있는» 파일 수. ★★0 이면 ★그 뿌리의 ★«0건»은 ★★«안 쟀다»다.
 *  ⛔★T9 가 ★제 손으로 ★세던 것을 ★★여기 ★하나로 ★모았다(★명부가 ★둘이 되지 ★않게). */
function countScannable(dir) {
  if (!fs.existsSync(dir)) return 0;
  let n = 0;
  const w = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.isDirectory()) w(path.join(d, e.name));
      else if (/\.(js|mjs|cjs)$/.test(e.name)) n += 1;
    }
  };
  w(dir);
  return n;
}

/** ★`mkdtempSync` 에 ★넘긴 ★접두사들. ★따옴표·백틱 ★셋 다.
 *  ★★템플릿 리터럴이면 ★`${…}` 가 ★그대로 ★들어온다 — ★`e2c-${tag}-` 가 ★그 꼴이다
 *  (★★«못 읽음»이 아니라 ★★«변수를 품었다» ⇒ ★★완주 판정에서 ★디스크로 ★못 찾는다 · ★T10 ⒞)
 *  ⛔★이 자는 ★★한 벌이다 — ★`leakers()` 와 ★`T10` 이 ★★같은 것을 ★쓴다(★명부가 ★둘이 되지 ★않게). */
function mkdtempPrefixesIn(src) {
  const pref = new Set();
  for (const m of src.matchAll(/mkdtempSync\(\s*path\.join\([^,]+,\s*(['"`])([^'"`]*)\1/g)) pref.add(m[2]);
  for (const m of src.matchAll(/mkdtempSync\(\s*(['"`])([^'"`]*)\1/g)) pref.add(m[2]);
  return pref;
}

/** ★그 뿌리들에서 ★`mkdtempSync` 에 ★넘긴 ★접두사 중 ★★`keys` 에 ★걸리는 자리.
 *  ★★★`read` 를 ★같이 ★돌려준다 — ⛔★«걸린 종 0» 이 ★★«안 걸어봤다»인지 ★가르는 ★유일한 수다.
 *  ★★★대조(양성·음성)도 ★★이 함수를 ★지난다 — ★«본 측정»과 ★«대조»가 ★다른 길이면 ★대조가 ★거짓이다. */
function prefixSites(roots, keys) {
  const seen = {};
  let read = 0;
  const w = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const q = path.join(dir, e.name);
      if (e.isDirectory()) { w(q); continue; }
      if (!/\.(js|mjs|cjs)$/.test(e.name)) continue;
      read += 1;
      for (const pre of mkdtempPrefixesIn(stripComments(fs.readFileSync(q, 'utf8')))) {
        for (const k of keys) if (pre.startsWith(k)) (seen[k] = seen[k] || []).push(path.relative(ROOT, q));
      }
    }
  };
  for (const r of roots) { if (fs.existsSync(r)) w(r); }
  return { seen, read };
}

function leakers(root = SCAN_ROOTS.map((d) => path.join(ROOT, d)), base = ROOT) {
  /* ★★★뿌리를 ★주입받는다 — ★까닭: ★누수가 ★0 이 되면 ★★«진짜 파일»로는 ★양성대조를 ★세울 수 ★없다.
   *   ⛔그때 ★«0건 초록»을 ★«잠겼다»로 ★읽으면 ★★«안 재고 있다»와 ★구분이 ★안 된다
   *   ⇒ ★★합성 표본 ★뿌리를 ★`mkTmpRoot` 로 ★만들어 ★그쪽으로 ★자를 ★돌린다(★T6 ⒜)
   * ★★★그리고 ★`stripComments` 는 ★★«선택»이 ★아니라 ★★★전제다 — ★★안 떼면 ★★양방향으로 ★틀린다:
   *   ★`history-ipc`   — ★주석이 ★«있다»를 ★지어냈다  ⇒ ★★거짓양성
   *   ★`project-trash` — ★주석이 ★«없다»를 ★가렸다    ⇒ ★★거짓음성(★지디 census 가 ★이걸 ★«누수 아님»으로 ★제외했다)
   *   ⇒ ★★한쪽만 ★겪으면 ★«떼면 ★수가 ★줄는다»로 ★배운다 — ★★그건 ★★절반이다 */
  const out = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const q = path.join(d, e.name);
      if (e.isDirectory()) { walk(q); continue; }
      if (!/\.(js|mjs|cjs)$/.test(e.name)) continue;
      const src = stripComments(fs.readFileSync(q, 'utf8'));
      const mk = (src.match(/\bmkdtempSync\s*\(/g) || []).length;
      if (!mk) continue;
      const rm = (src.match(/\brmSync\s*\(/g) || []).length;
      const mt = (src.match(/\bmkTmpRoot\s*\(/g) || []).length;
      const tt = (src.match(/\btrackTmp\s*\(/g) || []).length;
      const delta = mk - (rm + mt + tt);
      if (delta <= 0) continue;
      /* ★접두사 — ★따옴표·백틱 ★셋 다. ★★템플릿 리터럴이면 ★`${…}` 가 ★그대로 들어온다
         (★`env-collab-pin` 이 ★`e2c-${tag}-` 다 — ★★«못 읽음»이 아니라 ★★«변수를 품었다») */
      out.push({ file: path.relative(base, q), mk, rm, mt, tt, delta,
                 prefixes: [...mkdtempPrefixesIn(src)].sort() });
    }
  };
  /* ★★뿌리는 ★하나일 수도 ★여럿일 수도 ★있다 — ★★합성 표본은 ★★«둘»을 ★준다(★T6 ⒜) */
  const roots = Array.isArray(root) ? root : [root];
  for (const r of roots) { if (fs.existsSync(r)) walk(r); }
  return out.sort((a, b) => b.delta - a.delta || a.file.localeCompare(b.file));
}

/** tests/ 안에서 ★손으로 ★`rmSync` 를 쓰는 파일 — ★주석은 ★뗀다(★주석의 예시가 ★측정값이 되는 것 방지). */
function violations(root = path.join(ROOT, 'tests')) {
  /* ★★뿌리를 ★주입받는다 — ★`leakers()` 와 ★같은 까닭(★T9 가 ★다른 뿌리를 ★잰다).
   * ⛔★★한 번 ★틀렸다: ★인자를 ★안 받는데 ★`violations(TOOLS)` 로 ★불러 ★★tests/ 수를
   *   ★★«tools/» 라고 ★찍었다 — ★★출력의 ★파일 경로가 ★전부 `tests/…` 라 ★들켰다
   *   ⇒ ★★«말이 안 되는 출력»이 ★자가 깨졌다는 ★가장 싼 신호다(지디) */
  const out = {};
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { walk(p); continue; }
      if (!/\.(js|mjs|cjs)$/.test(e.name)) continue;
      const n = (stripComments(fs.readFileSync(p, 'utf8')).match(RM_RE()) || []).length;
      if (n) out[path.relative(ROOT, p)] = n;
    }
  };
  walk(root);
  return out;
}

test('T1 ★자가 살아있다 — ★양성·음성 대조 (⛔이것 없으면 아래 0건이 «안 재고 있다»와 같다)', () => {
  /* ★★★대조 문자열의 ★토큰을 ★★«짜 맞춘다» — ★★이 파일이 ★★제 자에 ★걸리지 ★않게.
     ★★실측(2026-10-10): ★처음엔 ★리터럴로 적었고 ⇒ ★★`T2` 가 ★★★이 파일을 ★위반으로 ★잡았다.
     ⇒ ★★고를 수 있던 ★두 길:
        ⒜ ★이 파일을 ★PENDING 에 ★영구 예외로 올린다
        ⒝ ★★소스에 ★리터럴이 ★없게 ★토큰을 ★짜 맞춘다
     ⇒ ★★★⒝ 를 ★골랐다. ★까닭: ★⒜ 는 ★★이 파일 안의 ★«참 호출»까지 ★★가려 준다(★서는 예외가 ★눈을 먼다)
     ⛔그리고 ★단언의 ★세기는 ★★안 낮췄다 — ★정규식에 ★대는 문자열은 ★★글자까지 ★같다 */
  const TOK = 'rm' + 'Sync(';
  assert.equal((stripComments('fs.' + TOK + 'x, {recursive:true});').match(RM_RE()) || []).length, 1,
    '★양성대조 실패 — ★그 호출 꼴을 ★못 잡는다');
  assert.equal((stripComments('/* fs.' + TOK + 'x) */ const a = 1;').match(RM_RE()) || []).length, 0,
    '★음성대조 실패 — ★★주석 안의 ★예시를 ★위반으로 ★센다');
  assert.equal((stripComments("const norm = 1; transform();").match(RM_RE()) || []).length, 0,
    '★음성대조 실패 — ★`norm`·`transform` 의 ★rm 글자를 ★잡는다');
  const v = violations();
  assert.ok(Object.keys(v).length >= 1,
    '★위반이 ★0 파일이다 — ★★걷는 자가 ★죽었거나 ★이름이 ★바뀌었다(★0 을 ★성공으로 읽지 않는다)');
});

test('T2 ㉠ ★위반은 ★«명부 안»에만 있다 — ★새 위반이 생기면 ★빨강', () => {
  const v = violations();
  const LISTED = { ...PENDING, ...NOT_TMPROOT, ...DONE_EAGER };
  const unlisted = Object.keys(v).filter((f) => !(f in LISTED)).sort();
  assert.deepEqual(unlisted, [],
    `★★명부 ★밖에서 ★손으로 ★임시물을 ★치우는 파일이 ★${unlisted.length}개 있다:\n  ` +
    unlisted.map((f) => `· ${f} (${v[f]}건)`).join('\n  ') +
    `\n  ⇒ ★`.concat("tests/unit/_tmproot.js` 의 ★`mkTmpRoot`/`trackTmp` 를 ★써라 — ★치우기는 ★그 자가 쥔다") +
    '\n  ⇒ ★공용 자를 ★못 쓰는 ★까닭이 있으면 ★이 파일 ★PENDING 에 ★그 까닭과 함께 올려라');
});

test('T3 ㉡ ★명부가 ★낡지 않았다 — ★이미 옮긴 칸이 ★남아 있으면 ★빨강', () => {
  const v = violations();
  const LISTED = { ...PENDING, ...NOT_TMPROOT, ...DONE_EAGER };
  const stale = Object.keys(LISTED).filter((f) => !(f in v)).sort();
  assert.deepEqual(stale, [],
    `★PENDING 에 ★«이제 ★안 치우는» 파일이 ★${stale.length}개 ★남았다 — ★낡은 명부가 ★다음 위반을 ★가린다:\n  ` +
    stale.map((f) => `· ${f}`).join('\n  ') +
    '\n  ⇒ ★옮겼으면 ★PENDING 에서 ★빼라');
});

test('T4 ★★남은 분량을 ★자가 찍는다 — ⛔사람이 세지 않는다', () => {
  const v = violations();
  /* ★★★«남은 수»를 ★★두 갈래로 ★따로 찍는다 — ⛔한 수로 묶으면 ★«무엇의 수»를 ★안 든다 */
  const pend = Object.keys(PENDING).filter((f) => f in v);
  const pendCalls = pend.reduce((a, f) => a + v[f], 0);
  const notTmp = Object.keys(NOT_TMPROOT).filter((f) => f in v);
  const doneE = Object.keys(DONE_EAGER).filter((f) => f in v);
  console.log(`    ★★㉠ 이전 대상 ★남음 = ★파일 ${pend.length} · ★호출 ${pendCalls}`);
  console.log(`    ★★㉡ 이전 대상 ★아님  = ★파일 ${notTmp.length} (★`.concat('rmSync 가 ★그 검사의 ★일이다)'));
  console.log(`    ★★㉢ 이미 ★공용 자 ＋ 즉시치움 = ★파일 ${doneE.length} (★의도다)`);
  /* ★★내 네 파일은 ★★이미 ★옮겼다 — ★그것만은 ★★단언으로 ★못박는다(★되돌아가면 ★빨강) */
  for (const f of ['tests/unit/shape-star-rating.test.mjs', 'tests/unit/shape-star-colors.test.mjs',
                   'tests/unit/shape-star-scales.test.mjs', 'tests/unit/shape-star-frame-width.test.mjs']) {
    assert.ok(!(f in v), `★${f} 가 ★다시 ★손으로 치운다 — ★이미 ★`.concat("mkTmpRoot` 로 옮긴 파일이다"));
    assert.ok(!(f in PENDING), `★${f} 가 ★PENDING 에 ★남아 있다 — ★옮겼으니 ★빼야 한다`);
  }
  /* ★★★두 명부가 ★겹치지 ★않는다 — ⛔겹치면 ★같은 파일이 ★«이전 대상»이면서 ★«아니다»가 된다.
     ★★앞서 여기 ★`left.length >= 0` 이라 ★적었다가 ★지웠다 — ★★그건 ★★항등이라 ★아무것도 ★안 잠갔다. */
  /* ★★★세 칸이 ★서로 ★겹치지 ★않는다 — ⛔겹치면 ★한 파일이 ★두 뜻을 ★갖는다 (지디 ⑶ 의 ★그 불변) */
  const MAPS = { PENDING, NOT_TMPROOT, DONE_EAGER };
  const names = Object.keys(MAPS);
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      const dup = Object.keys(MAPS[names[i]]).filter((f) => f in MAPS[names[j]]);
      assert.deepEqual(dup, [],
        `★${names[i]} 와 ★${names[j]} 에 ★같이 든 파일: ${dup.join(' ')}`);
    }
  }
  /* ★★그리고 ★모든 위반이 ★★정확히 ★한 칸에 ★든다 */
  for (const f of Object.keys(v)) {
    const hits = names.filter((n) => f in MAPS[n]);
    assert.equal(hits.length, 1,
      `★${f} 가 ★${hits.length} 칸에 든다(${hits.join(',') || '없음'}) — ★정확히 ★하나여야 한다`);
  }
});

test('T5 ★★★자(rmSync 단위)와 ★명부(파일 단위)가 ★맞물린다 — ⛔등호 ★금지 (지디 ⑵ 정정)', () => {
  /* ★★지디가 ★제 처방을 ★★고쳤다: 「★그 ⊇ 견줌을 ★★«rmSync 단위»로 돌려라 —
   *   ★단위 = (파일, rmSync 줄) ★쌍 ⇒ ★한 파일이 ★두 쌍을 ★가질 수 있다」
   * ★★까닭: ★★파일 단위로 ★돌리면 ★★섞인 파일(★history-ipc)에서 ★★거짓 빨강이 ★난다
   * ⛔등호로 ★수를 ★박지 ★않는다 — ★★«⊇ ＋ ★밖 0건» 꼴이다 */
  const P = pairs();
  /* ⒜ ★★자가 ★살아있나 — ★세 갈래가 ★다 ★한 번은 ★나와야 한다(⛔하나라도 0 이면 ★못 가른다) */
  const kinds = new Set(P.map((x) => x.kind));
  for (const k of ['eager', 'pending', 'subject']) {
    assert.ok(kinds.has(k), `★갈래 «${k}» 가 ★0건 — ★자가 ★그 축을 ★못 가른다(★전체 ${P.length} 쌍)`);
  }
  /* ⒝ ★`eager` 쌍을 ★가진 파일 ⊆ ★`DONE_EAGER` */
  const eagerFiles = [...new Set(P.filter((x) => x.kind === 'eager').map((x) => x.file))].sort();
  const eagerOutside = eagerFiles.filter((f) => !(f in DONE_EAGER));
  assert.deepEqual(eagerOutside, [],
    `★임시루트를 ★즉시 치우는데 ★㉢ 명부 ★밖이다:\n  ` + eagerOutside.join('\n  '));
  /* ⒞ ★`DONE_EAGER` 에 ★`eager` 쌍이 ★없는 파일이 ★남으면 ★명부가 ★낡았다 */
  const eagerStale = Object.keys(DONE_EAGER).filter((f) => !eagerFiles.includes(f));
  assert.deepEqual(eagerStale, [], `★㉢ 명부가 ★낡았다: ${eagerStale.join(' ')}`);
  /* ⒟ ★`pending` 쌍을 ★가진 파일 ⊆ ★(`PENDING` ∪ `NOT_TMPROOT`)
     ★★★이 칸이 ★처음엔 ★`⊆ PENDING` 이었고 ★★`put-image-path` 에서 ★★빨개졌다 — ★★그게 ★맞는 빨강이었다:
       ★그 파일은 ★`mkdtempSync` 루트를 ★손으로 치운다(★꼴은 ★㉠) ★★그러나 ★★★옮기면 ★안 된다
         ⇒ ★그 루트가 ★★`os.homedir()` ★아래여야 ★한다(★이 검사의 ★주제가 ★«홈 밖은 막힌다»다)
       ⇒ ★★즉 ★★«꼴은 ㉠ · ★뜻은 ㉡» 인 ★자리가 ★★실재한다
     ⇒ ★★그래서 ★★㉡ 도 ★받는다. ⛔단 ★★«왜 공용 자를 ★못 쓰나»를 ★★그 칸에 ★적어야 한다
       ★★규약: ★그 까닭에 ★★`공용자불가` 를 ★한 번 ★적는다 — ★★그러면 ★grep 으로 ★찾을 수 있고
         ★★새 사례가 ★그 표시 ★없이 ★들어오면 ★★이 칸이 ★빨개져 ★사람이 ★정하게 된다 */
  const pendFiles = [...new Set(P.filter((x) => x.kind === 'pending').map((x) => x.file))].sort();
  const pendOutside = pendFiles.filter((f) => !(f in PENDING) && !(f in NOT_TMPROOT));
  assert.deepEqual(pendOutside, [],
    `★mkdtempSync 루트를 ★손으로 치우는데 ★두 명부 ★밖이다:\n  ` + pendOutside.join('\n  '));
  /* ⒟-b ★★㉡ 에 ★앉은 ★`pending` 파일은 ★★«공용자불가» 까닭을 ★들어야 한다 */
  for (const f of pendFiles.filter((x) => x in NOT_TMPROOT)) {
    assert.match(NOT_TMPROOT[f], /공용자불가/,
      `★${f} 는 ★꼴이 ★㉠(mkdtempSync 루트를 손으로 치움)인데 ★㉡ 에 있다 — `
      + `★★«왜 공용 자를 ★못 쓰나»를 ★그 칸에 ★`.concat('«공용자불가» 와 함께 적어라'));
  }
  /* ⒠ ★★섞인 파일 수를 ★찍는다 — ⛔단언이 아니라 ★보고다(★있어도 ★정상이다) */
  const byFile = {};
  for (const x of P) (byFile[x.file] = byFile[x.file] || new Set()).add(x.kind);
  const mixed = Object.keys(byFile).filter((f) => byFile[f].size > 1).sort();
  console.log(`    ★★쌍 ${P.length} — eager ${P.filter((x) => x.kind === 'eager').length}`
    + ` · pending ${P.filter((x) => x.kind === 'pending').length}`
    + ` · subject ${P.filter((x) => x.kind === 'subject').length}`);
  console.log(`    ★★섞인 파일 ${mixed.length}: ${mixed.map((f) => f.split('/').pop()).join(' ') || '없음'}`);
  /* ⒡ ★★섞인 파일은 ★그 칸의 ★까닭에 ★★양쪽이 ★적혀 있어야 한다 — ⛔반쪽 진실 금지 */
  const ALL = { ...PENDING, ...NOT_TMPROOT, ...DONE_EAGER };
  for (const f of mixed) {
    assert.match(ALL[f] || '', /섞였다/,
      `★${f} 는 ★섞였는데 ★칸의 ★까닭이 ★«섞였다»를 ★안 말한다 — ★반쪽 진실이 된다`);
  }
});

test('T6 ★★★둘째 축 — ★«아예 안 치우는» 파일이 ★★명부 안에만 있다 ＋ ★양성·음성 대조 (지디 ⑵⑶)', () => {
  /* ★★지디: 「★`violations()` 는 ★`rmSync` 를 ★쓰는 파일만 ★센다 ⇒ ★★`rmSync` ★0 인 파일은 ★영원히 ★안 보인다.
   *   ★★그게 ★★「25,102개」의 ★참 원천 꼴이다 ⇒ ★★둘째 축을 ★세워라 ＋ ★★그 축의 ★양성대조도」
   * ★★★그리고 ★까닭은 ★★«관측 가능성»이다 — ⛔«위생»으로 ★적지 ★마라(★`leakers()` 머리말) */
  const L = leakers();
  const names = L.map((x) => x.file);
  /* ⒜ ★★★양성대조 — ★★누수가 ★0 이 된 ★지금은 ★★진짜 파일로 ★세울 수 ★없다(★그게 ★이 일의 ★끝이다).
   *   ★앞 회차의 ★양성대조 둘(★`zoom-tangent` · ★`folders-crud`)은 ★★내가 ★이전해서 ★★내 손으로 ★죽였다
   *   ⇒ ★★`mkTmpRoot` 로 ★★합성 표본 ★뿌리를 ★만들어 ★자를 ★그쪽으로 ★돌린다 — ★★양성·음성을 ★한 자리에서
   *   ⛔★표본 글자는 ★★조립해서 쓴다 — ★이 파일 ★본문이 ★오염되면 ★★T7 이 ★빨개진다 */
  const fxRoot = mkTmpRoot('tmproot-fixture-');
  /* ★★★뿌리가 ★«여럿»이 된 ★뒤의 ★새 ★위험 = ★★«첫 뿌리만 ★걷는다».
   *   ⇒ ★★그래서 ★표본을 ★★★둘째 뿌리에 ★심는다 — ★첫 뿌리는 ★★비워 둔다
   *   ⇒ ★★`for (const r of roots)` 를 ★`walk(roots[0])` 로 ★바꾸면 ★★이 칸이 ★빨개진다(★변이 M-R1) */
  const fxA = path.join(fxRoot, 'first-root'); fs.mkdirSync(fxA);
  const fx = path.join(fxRoot, 'second-root'); fs.mkdirSync(fx);
  const MKD = 'mkdtemp' + 'Sync';
  fs.writeFileSync(path.join(fx, 'leaks.test.js'),
    'const fs = require(\'fs\');\nconst d = fs.' + MKD + '(\'/tmp/fixture-leak-\');\n');
  /* ★★음성 표본은 ★★`mkdtempSync` ＋ `trackTmp` 꼴로 ★둔다 — ⛔`mkTmpRoot` ★단독이면 ★mk 0 이라
   *   ★★`if (!mk) continue` 에서 ★먼저 ★걸러져 ★★«빼기»가 ★하는 일이 ★0 이 된다(★무력화해도 ★안 빨개진다).
   *   ★이 꼴이면 ★mk 1 · tt 1 ⇒ ★Δ 0 ⇒ ★★빼기가 ★참으로 ★일한다 (★아래 ★변이 M-C5 가 ★그걸 잰다)
   *   ⛔★토큰은 ★★조립한다 — ★`trackTmp` 는 ★T7 의 ★하드 꼴이다 */
  const TTR = 'track' + 'Tmp';
  fs.writeFileSync(path.join(fx, 'clean.test.js'),
    'const fs = require(\'fs\');\nconst { ' + TTR + ' } = require(\'./_tmproot.js\');\n'
    + 'const d = ' + TTR + '(fs.' + MKD + '(\'/tmp/fixture-clean-\'));\n');
  /* ★★★셋째 표본 — ★호출이 ★★«주석 속에만» 있는 파일.
   *   ★스트리핑이 ★살아있으면 mk 0 ⇒ ★안 걸린다 / ★죽으면 mk 1 · 빼는 자 0 ⇒ ★Δ1 ⇒ ★★걸린다
   *   ★까닭: ★★`leakers()` 안의 ★`stripComments` 를 ★끄는 변이(M-C4)가 ★★fail 0 이었다
   *     ⇒ ★★그 자리를 ★재는 ★단언이 ★하나도 ★없었다는 ★뜻이다(⛔«이미 잠겼다»로 ★읽지 않았다).
   *   ★이게 ★원래 ★`project-trash` 가 ★쥐던 ★성질이다 — ★이제 ★합성 표본이 ★쥔다 */
  fs.writeFileSync(path.join(fx, 'commented.test.js'),
    '/* const d = fs.' + MKD + '(\'/tmp/fixture-comment-\'); */\nconst a = 1;\n');
  const FX = leakers([fxA, fx], fx);   /* ★★뿌리 ★둘 — ★표본은 ★둘째에 ★있다 */
  assert.deepEqual(FX.map((x) => x.file), ['leaks.test.js'],
    '★★양성·음성 대조 ★동시 실패 — ★합성 표본에서 ★잡아야 할 것은 ★leaks.test.js ★하나다. ★잡은 것: '
    + JSON.stringify(FX.map((x) => x.file))
    + ' ⇒ ★자가 ★죽었거나(★빈 명부) ★★이미 옮긴 꼴을 ★누수로 센다');
  assert.deepEqual(FX[0].prefixes, ['/tmp/fixture-leak-'],
    '★★접두사를 ★못 읽는다 — ★★그게 ★디스크에서 ★그것을 ★찾는 ★유일한 수단이다(지디). ★읽은 것: '
    + JSON.stringify(FX[0].prefixes));
  /* ⒜-2 ★★그 자로 ★진짜 뿌리를 ★재면 ★0 이어야 한다 — ★★위 ⒜ 가 ★섰기에 ★이 ★0 은 ★«안 쟀다»가 ★아니다 */
  assert.deepEqual(names, [], '★★누수 ★0 이 ★목표였다 — ★남은 것: ' + JSON.stringify(names));
  /* ⒜-3 ★★★Δ = 0 을 ★★«보고»가 아니라 ★★★«단언»으로 — ★지디: ★★«그래야 ★다음 사람이 ★다시 ★늘릴 수 ★없다»
   *   ⛔★파일 수 ★0 만으로는 ★부족하다: ★한 파일에 ★Δ 가 ★여럿 ★들 수 있다(★이번 ★Δ2 가 ★5벌이었다) */
  assert.equal(L.reduce((a, x) => a + x.delta, 0), 0,
    '★★Δ 합계가 ★0 이 ★아니다 — ★★«치우는 자»보다 ★`mkdtempSync` 가 ★많은 자리가 ★남았다');
  /* ⒜-4 ★★★뿌리마다 ★★«읽은 파일 수 > 0» — ⛔★안 그러면 ★위 ★두 ★«0»이 ★★«안 쟀다»다
   *   ★★`tools/` 를 ★`SCAN_ROOTS` 에서 ★빼면 ★★여기서 ★빨개진다 */
  for (const d of SCAN_ROOTS) {
    const n = countScannable(path.join(ROOT, d));
    assert.ok(n > 0, '★★`' + d + '/` 에서 ★읽은 js 파일이 ★0개다 ⇒ ★★그 뿌리의 ★«0건»은 ★★«안 쟀다»다');
  }
  /* ⒝ ★★★음성대조 — ★★이미 옮긴 파일은 ★★안 걸려야 한다(★mkdtemp 0 · mkTmpRoot 1) */
  for (const f of ['tests/unit/shape-star-rating.test.mjs', 'tests/unit/account-projects-root.test.js',
                   'tests/unit/grid-line-add.test.mjs',
                   /* ★아래 두 벌은 ★★묶음 A·B 에서 ★내가 ★지금 ★옮긴 것 — ★이전이 ★참으로 ★먹었는지 */
                   'tests/unit/project-trash.test.js', 'tests/unit/zoom-panel-slim.test.mjs']) {
    assert.ok(!names.includes(f),
      `★음성대조 실패 — ★이미 ★`.concat(`mkTmpRoot 로 옮긴 ${f} 를 ★누수로 센다`));
  }
  /* ⒞ ★★명부 ★밖이 ★0 건 — ★본 단언. ⛔등호 금지(⊇ ＋ 밖 0) */
  const outside = names.filter((f) => !(f in LEAKING)).sort();
  assert.deepEqual(outside, [],
    `★★«아예 ★안 치우는» 파일이 ★명부 ★밖에 ★${outside.length}개 있다 — ★★임시물이 ★임자 표시 ★없이 ★남는다:\n  `
    + outside.map((f) => `· ${f} (${L.find((x) => x.file === f).delta} · ${L.find((x) => x.file === f).prefixes.join(' ')})`).join('\n  ')
    + '\n  ⇒ ★`mkTmpRoot`/`trackTmp` 로 옮기거나, ★★못 옮기는 까닭을 ★이 파일 ★`LEAKING` 에 ★적어 올려라');
  /* ⒟ ★★명부가 ★낡지 않았나 — ★옮겼는데 ★명부에 ★남아 있으면 ★빨강 */
  /* ⒡ ★★«주석 속 rmSync»를 ★자가 ★참으로 ★떼내나 — ★원래 `project-trash` 가 ★쥐던 ★성질이다.
   *   ★그 파일은 ★이제 ★내가 ★이전해서 ★더 이상 ★날 새지 ★않는다 — ★★그러나 ★그 rmSync 는 ★여전히 ★주석 속에 ★있다
   *   ⇒ ★★`stripComments` 가 ★죽으면 ★그 파일은 ★★«손으로 rmSync 를 쓰는 자»로 ★보여 ★★㉠ 명부 밖에 ★나타나 ★T2 가 ★빨개진다 */
  const PT = 'tests/unit/project-trash.test.js';
  const ptRaw = fs.readFileSync(path.join(ROOT, PT), 'utf8');
  assert.ok((ptRaw.match(/\brmSync\s*\(/g) || []).length >= 1,
    '★전제 깨짐 — ' + PT + ' 에서 «rmSync 가 ★주석 속에 있다»는 ★성질이 ★사라졌다 ⇒ ★이 ★대조는 ★이제 ★아무것도 ★잠그지 ★않는다');
  assert.equal((stripComments(ptRaw).match(/\brmSync\s*\(/g) || []).length, 0,
    '★★' + PT + ' 의 rmSync 는 ★주석 속이다 — ★주석을 떼면 ★★0 이어야 한다(★아니면 stripComments 가 ★제 일을 ★안 한다)');

  const stale = Object.keys(LEAKING).filter((f) => !names.includes(f)).sort();
  assert.deepEqual(stale, [], `★LEAKING 에 ★«이제 ★안 새는» 파일이 ★남았다: ${stale.join(' ')}`);
  /* ⒠ ★★★Δ 합계를 ★★자가 ★찍는다 — ⛔파일 수만 세지 ★마라(지디 ⒜) */
  const dsum = L.reduce((a, x) => a + x.delta, 0);
  console.log(`    ★★누수 = ★파일 ${L.length} · ★★Δ 합계 ${dsum}`);
  /* ★★«남은 일»을 ★자가 ★뱉게 한다 — ⛔별도 스캐너를 지어 ★★«명부가 둘»이 되면 없던 차가 생긴다 */
  for (const x of L) console.log(`      · Δ${x.delta} ${x.file}  [${x.prefixes.join(' ')}]`);
  console.log(`    ★★접두사(디스크에서 ★찾을 이름) = ${[...new Set(L.flatMap((x) => x.prefixes))].sort().join(' ')}`);
  /* ⒡ ★★명부의 Δ 표기가 ★자와 ★맞나 — ⛔산문이 ★수와 ★어긋나면 ★다음 사람이 ★산문을 믿는다 */
  for (const x of L) {
    assert.match(LEAKING[x.file], new RegExp('Δ' + x.delta + '(?![0-9])'),
      `★${x.file} 의 ★명부 Δ 표기가 ★자(Δ${x.delta})와 ★다르다: ${LEAKING[x.file]}`);
  }
});

test('T7 ★★★이 파일 ★자신이 ★★가장 오염시키는 파일이다 — ★★어느 꼴이 ★0 이고 ★어느 꼴이 ★몇인지 (지디 ⑶)', () => {
  /* ★★지디 ⑶: 「★주석 속 호출 꼴 ★7 vs ★본문 ★3 ⇒ ★★주석 안 떼는 자가 ★10 을 센다 ⇒ ★★칸 하나로 ★잠가라」
   * ★★★앞 회차엔 ★«본문 ★0» 이었다. ★★이제는 ★아니다 — ★T6 ⒜ 의 ★합성 표본 ★뿌리를 ★★`mkTmpRoot` 로 만든다.
   *   ⇒ ★★«0 이라 적고 ★1 을 쓰는» ★거짓 대신 ★★꼴을 ★갈라 ★적는다:
   *     ⒜ ★★`rmSync` · `mkdtempSync` · `trackTmp` = ★★★본문 0 (★하드)
   *        ★까닭: ★이 셋이 ★본문에 ★있으면 ★★제 자가 ★★자기를 ★위반자(㉠)·누수로 ★센다
   *     ⒝ ★★`mkTmpRoot` = ★본문 ★★정확히 ★1 (★합성 표본 ★한 줄) — ★늘면 ★빨강
   *   ⛔★수를 ★산문에 ★박지 ★않는다 — ★아래가 ★매 회차 ★찍는다 */
  const raw = fs.readFileSync(SELF, 'utf8');
  const body = stripComments(raw);
  const cnt = (src, re) => (src.match(re) || []).length;
  const HARD = /\b(rmSync|mkdtempSync|trackTmp)\s*\(/g;
  const SOFT = /\bmkTmpRoot\s*\(/g;
  const ALL  = () => /\b(rmSync|mkdtempSync|mkTmpRoot|trackTmp)\s*\(/g;
  const hardBody = cnt(body, HARD);
  const softBody = cnt(body, SOFT);
  const withC = cnt(raw, ALL());
  const noC = cnt(body, ALL());
  console.log(`    ★★이 파일 — ★주석 포함 ${withC}건 · ★★주석 뗀 뒤 ${noC}건 (★차이 ${withC - noC} = ★주석 속)`);
  console.log(`      ★본문 ★하드 꼴(rmSync·mkdtempSync·trackTmp) = ${hardBody} (★0 이어야 한다) · ★mkTmpRoot = ${softBody} (★전부 ★표본 뿌리여야 ★한다)`);
  /* ⒜ ★하드 — ★★0 */
  assert.equal(hardBody, 0,
    '★이 파일 ★본문에 ★★위반자 꼴이 ★' + hardBody + '건 생겼다 — ★★제 자가 ★★자기를 ★㉠·누수로 ★세기 시작한다');
  /* ⒝ ★★소프트 — ⛔★★«정확히 1» 로 ★박지 ★않는다.
   *   ★★★한 번 ★썩었다: ★T10 의 ★표본 뿌리를 ★더하자 ★★그 ★1 이 ★거짓이 됐다
   *   ⇒ ★★지디 ⑷⒝ 가 ★그대로 ★여기 ★왔다 — ★★«수를 박는 처방»은 ★그 수가 ★바뀌면 ★거짓이 ★된다
   *   ⇒ ★★★수 ★대신 ★★«성질»을 ★잠근다: ★★이 파일의 ★`mkTmpRoot` 호출은 ★★★전부 ★«표본 뿌리»여야 ★한다 */
  const FIX_PRE = /^'tmproot-[a-z-]*fixture-'$/;
  const args = [...body.matchAll(/\bmkTmpRoot\(([^)]*)\)/g)].map((m) => m[1].trim());
  assert.ok(args.length >= 1,
    '★전제 깨짐 — ★이 파일에 ★`mkTmpRoot` 호출이 ★0건이다 ⇒ ★★⒝ 가 ★아무것도 ★잠그지 ★않는다');
  const notFixture = args.filter((a) => !FIX_PRE.test(a));
  assert.deepEqual(notFixture, [],
    '★★이 파일이 ★★«표본 뿌리»가 ★아닌 ★임시 루트를 ★만든다 — ★★명부 파일은 ★★제 일(★재기)만 ★한다: '
    + JSON.stringify(notFixture));
  /* ⒞ ★★전제 단언 — ★이 파일은 ★참으로 ★오염원인가(⛔아니면 ★이 칸은 ★아무것도 ★안 잠근다) */
  assert.ok(withC - noC >= 5,
    '★전제 깨짐 — ★주석 속 호출 꼴이 ★' + (withC - noC) + '건뿐이다 ⇒ ★★이 파일은 ★더 이상 ★«가장 오염시키는 파일»이 ★아니다');
  /* ⒟ ★★양성대조 — ★주석 속 꼴을 ★참으로 ★떼나. ★토큰은 ★조립한다(⛔표본이 ★이 파일을 ★다시 오염시키면 안 된다) */
  const FAKE = '/* ' + 'rm' + 'Sync(FAKE) */ const a = 1;';
  assert.equal(cnt(stripComments(FAKE), ALL()), 0,
    '★양성대조 실패 — ★★주석 속 ★가짜 호출을 ★★세고 있다 ⇒ ★`stripComments` 가 ★안 뗀다');
  /* ⒠ ★★음성대조 — ★본문 꼴은 ★★살아야 한다(⛔안 그러면 ★«전부 떼는 자»가 ★초록을 ★만든다) */
  const REAL = 'fs.' + 'rm' + 'Sync(x);';
  assert.equal(cnt(stripComments(REAL), ALL()), 1,
    '★음성대조 실패 — ★★참 호출을 ★★못 센다 ⇒ ★자가 ★죽었다');
});
test('T9 ★★`tools/` 축은 ★★★«이미 됐다»로 ★닫혔다 — ★그 닫힘을 ★자가 ★매 회차 ★다시 ★잰다 (지디 판정)', () => {
  /* ★★★지디 판정(2026-10-10): ★★«범위에 ★드나/안 드나»를 ★고를 일이 ★없다 — ★★★이미 ★됐다.
   *   ★그쪽 실측: ★mkdtempSync 합 ★1(그마저 ★rmSync 2 로 ★치운다) · ★`_tmproot` require ★10곳 · ★누수 ★0벌
   *   ★★내 앞 물음(「11파일/17호출이 ★범위에 ★드나」)은 ★★낡은 수였다 — ★그 사이 ★이미 ★옮겨졌다
   * ★★★그런데 ⛔«대기»로도 ⛔«구두»로도 ★닫지 ★않는다(★닫으면 ★담당이 ★없다):
   *   ⇒ ★★`SCAN_ROOTS` 에 ★`tools` 를 ★넣어 ★★자가 ★스스로 ★열고 ★닫게 ★했다
   *   ⇒ ★★다음에 ★누가 ★`tools/` 에 ★`mkdtempSync` 를 ★쓰면 ★★그 자리에서 ★빨개진다
   * ⛔★수를 ★이 주석에 ★박지 ★않는다 — ★아래가 ★찍는다 */
  assert.ok(SCAN_ROOTS.includes('tools'),
    '★★`tools` 가 ★`SCAN_ROOTS` 에서 ★빠졌다 — ★★그러면 ★그 축은 ★★다시 ★«안 재는» 축이 된다');
  const TOOLS = path.join(ROOT, 'tools');
  const read = countScannable(TOOLS);
  /* ★★전제 — ★★«0건»이 ★«깨끗하다»인지 ★«안 걸어봤다»인지 ★가른다 */
  assert.ok(read > 0,
    '★★`tools/` 에서 ★읽은 js 파일이 ★0개다 ⇒ ★★아래 ★«0건»은 ★★«안 쟀다»다');
  const L = leakers(TOOLS, ROOT);
  const V = violations(TOOLS);
  const vfiles = Object.keys(V).sort();
  console.log(`    ★★\`tools/\` — ★읽은 js ${read} · ★손 rmSync ★파일 ${vfiles.length}/★호출 ${vfiles.reduce((a, f) => a + V[f], 0)}`
    + ` · ★★누수 ★파일 ${L.length}/★Δ ${L.reduce((a, x) => a + x.delta, 0)}`);
  /* ★★본 단언 — ★그 축이 ★0 이다. ★★양성대조는 ★T6 ⒜ 가 ★쥔다(★합성 표본 ★뿌리 ★둘) */
  assert.deepEqual(L.map((x) => x.file), [],
    '★★`tools/` 에 ★★«안 치우는» 자리가 ★생겼다 — ★★`mkTmpRoot` 로 ★옮겨라');
});

test('T10 ★★★«접두사 22종 → 0» — ★★보고가 아니라 ★단언이다 (지디 ⑵⑸)', () => {
  /* ★★★지디: 「★끝에 ★`Δ=0` 과 ★`접두사 22종 → 0` 을 ★★단언으로. ⛔보고로 ★두지 ★마라」
   * ★★★왜 ★«디스크»가 ★아니라 ★«소스»를 ★재나:
   *   ★디스크엔 ★★옛 잔재가 ★★남아 있다(★현빈 결정 ★대기) ⇒ ★★디스크로 ★재면 ★★★영원히 ★빨강이다
   *   ⇒ ★★★가를 것은 ★★«과거 잔재»(★못 지운다)와 ★★«미래 생성»(★막았다)이다 — ★지디 ⒨
   *   ⇒ ★★그래서 ★이 칸은 ★★★«미래 생성»만 ★잰다: ★그 22종을 ★★다시 ★`mkdtempSync` 에 ★넘기는 자리 ★0건
   * ★★⒞ ★`e2c-${tag}-` 는 ★★«접두사 ★변수»다 — ★★디스크로는 ★못 찾는다
   *   ⇒ ★★그래도 ★★수에서 ★빼지 ★않는다(★지디 지시) · ★★여기선 ★정적 ★머리(`e2c-`)로 ★잡는다 */
  const CENSUS = {
    'gd-gmstrict-': 1, 'gd-edgec-': 1, 'exrep-': 1, 'gdt-list-folderid-': 1, 'gdt-planlist-': 1,
    'zoom-panel-slim-': 1, 'gdt-trash-': 1, 'gdt-e169h-': 1, 'gdt-e170-': 1, 'gdt-e169-': 1,
    'zoom-spread-': 1, 'gdt-folders-': 1, 'gdt-folders-flat-': 1, 'gdt-e168-': 1, 'gdt-e168n-': 1,
    'recov-acct-': 1, 'recov-legacy-': 1, 'zoom-narrow-': 1, 'zoom-narrow-mut-': 1,
    'zoom-tangent-': 1, 'zoom-mutant-': 1,
    /* ★★★이 하나가 ★★«접두사 ★변수» — ★디스크 판정의 ★눈이 ★안 닿는 ★자리다 */
    'e2c-': 1,
  };
  const VARIABLE = new Set(['e2c-']);
  const keys = Object.keys(CENSUS);
  assert.equal(keys.length, 22,
    '★★명부가 ★22종이 ★아니다(★' + keys.length + '종) — ★★«22종»이라 ★이름 붙였으면 ★그 수를 ★여기서 ★세라');
  /* ★★현장 — ★`SCAN_ROOTS` 전부를 ★★주석 떼고 ★걷는다 */
  const real = prefixSites(SCAN_ROOTS.map((d) => path.join(ROOT, d)), keys);
  const left = Object.keys(real.seen).sort();
  console.log(`    ★★접두사 명부 ${keys.length}종 (★접두사 변수 ${VARIABLE.size}종: ${[...VARIABLE].join(' ')})`
    + ` · ★읽은 js ${real.read} · ★★mkdtempSync 로 ★아직 넘기는 종 = ${left.length}`);
  /* ★★★전제 ★먼저 — ⛔«0종»이 ★«안 걸어봤다»면 ★이 칸은 ★거짓이다 */
  assert.ok(real.read > 0,
    '★★읽은 js 파일이 ★0개다 ⇒ ★★아래 ★«0종»은 ★★«안 쟀다»다');
  assert.deepEqual(left, [],
    '★★그 접두사를 ★★다시 ★`mkdtempSync` 에 ★넘기는 자리가 ★생겼다 — ★★우산 ★밖에 ★임자 ★없는 임시물이 ★다시 ★쌓인다:\n  '
    + left.map((k) => `· ${k} ← ${(real.seen[k] || []).join(' ')}`).join('\n  '));
  /* ★★★양성·음성 대조 — ★★★«본 측정과 ★같은 길»로 ★지나간다(★`prefixSites`).
   *   ⛔★앞서 ★나는 ★문자열에만 ★대조를 ★걸었다 — ★★그러면 ★★«걷기»가 ★깨져도 ★초록이다 */
  const fx = mkTmpRoot('tmproot-prefix-fixture-');
  const MKD = 'mkdtemp' + 'Sync';
  const MTR = 'mkTmp' + 'Root';
  fs.writeFileSync(path.join(fx, 'bad.test.js'), 'const d = fs.' + MKD + "('gdt-trash-');\n");
  fs.writeFileSync(path.join(fx, 'good.test.js'), 'const d = ' + MTR + "('gdt-trash-');\n");
  fs.writeFileSync(path.join(fx, 'commented.test.js'), '/* fs.' + MKD + "('gdt-folders-'); */\n");
  const ctl = prefixSites([fx], keys);
  assert.ok(ctl.read === 3, '★대조 표본 3벌을 ★다 못 읽었다 — ★읽은 수: ' + ctl.read);
  assert.deepEqual(Object.keys(ctl.seen).sort(), ['gdt-trash-'],
    '★★대조 실패 — ★★잡아야 할 것은 ★`bad.test.js` 의 ★`gdt-trash-` ★하나다(★`good` 은 ★`mkTmpRoot` · ★`commented` 는 ★주석). '
    + '★잡은 것: ' + JSON.stringify(Object.keys(ctl.seen).sort()));
  assert.deepEqual(ctl.seen['gdt-trash-'].map((f) => path.basename(f)), ['bad.test.js'],
    '★★걸린 ★자리가 ★`bad.test.js` 가 ★아니다: ' + JSON.stringify(ctl.seen['gdt-trash-']));
  /* ★★⒞ ★접두사 변수 ★표시가 ★살아 있나 — ⛔«수에서 빼는» 것이 ★아니라 ★«표시»다 */
  for (const v of VARIABLE) assert.ok(keys.includes(v), '★접두사 변수 ★표시가 ★명부에서 ★빠졌다: ' + v);
});

test('T8 ★★«공용자불가» 표시 — ★그 표시를 ★든 파일이 ★전부 ★(㉠ ∪ ㉡) 안인가 (지디 ⑷)', () => {
  /* ★★지디: 「★그 표시 이름을 ★★전수로 ★grep 할 수 있게 ★한 자리에 ★모아 적어라
   *   ＋ ★T5 에 ★한 칸: ★그 표시를 ★든 파일이 ★★전부 ★(㉠∪㉡) 안인가」
   * ★★왜 — ★★그 표시는 ★★«넓혔지만 ★안 느슨해졌다»의 ★근거다(★T5 ⒟-b 가 ★요구한다)
   *   ⇒ ★★그 표시가 ★★엉뚱한 칸(㉢)에 ★붙으면 ★★그 뜻이 ★흐려진다 */
  const MARK = '공용자불가';
  const inP = Object.keys(PENDING).filter((f) => PENDING[f].includes(MARK));
  const inN = Object.keys(NOT_TMPROOT).filter((f) => NOT_TMPROOT[f].includes(MARK));
  const inD = Object.keys(DONE_EAGER).filter((f) => DONE_EAGER[f].includes(MARK));
  const inL = Object.keys(LEAKING).filter((f) => LEAKING[f].includes(MARK));
  console.log(`    ★★«${MARK}» 표시 — ㉠ ${inP.length} · ㉡ ${inN.length} · ㉢ ${inD.length} · 누수 ${inL.length}`);
  assert.deepEqual(inD, [], `★㉢(이미 공용 자)에 ★«${MARK}» 가 붙었다 — ★뜻이 ★어긋난다: ${inD.join(' ')}`);
  assert.deepEqual(inL, [], `★누수 명부에 ★«${MARK}» 가 붙었다 — ★거긴 ★치우는 자가 ★아예 없는 칸이다: ${inL.join(' ')}`);
  /* ★★★그리고 ★그 표시가 ★★한 건이라도 ★있어야 한다 — ⛔0 이면 ★이 칸이 ★아무것도 안 잠근다 */
  assert.ok(inP.length + inN.length >= 1,
    `★«${MARK}» 표시가 ★★0건이다 — ★★T5 ⒟-b 가 ★잠글 대상이 ★없다(★자가 ★죽었거나 ★표시가 ★바뀌었다)`);
});
