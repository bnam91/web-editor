/* ══════════════════════════════════════════════════════════════════════════
   one-empty-image-judge — 「빈 그림 판정」의 사본이 다시 갈라지지 못하게 막는다 (T-148)
   ──────────────────────────────────────────────────────────────────────────
   무엇이 있었나 (2026-09-22, 하루에 «세 자리»):
     · 목업 재캡처(T-138) — 멀쩡한 928,378자 PNG 를 6자로 덮고 「캡처 완료!」라고 말했다
     · 카드 썸네일(T-087) — 6자가 truthy 라 저장됐고, 카드는 «아이콘조차 없는 빈 칸»이 됐다
     · 내보내기 조사(T-039) — 같은 함정을 «미리 경고»로 넘겨야 했다
   ★뿌리는 하나다 — `toDataURL()` 은 망가진 캔버스에서 **예외를 안 던지고**
     `"data:,"`(6자)를 돌려준다. **6자는 truthy 라** `if (url)` 로 거르면 통과한다.
     ⛔`try/catch` 로는 안 보인다. **길이와 꼴을 «재야»** 보인다.
   ⛔그런데 막은 두 자리가 «서로 다른 사본»이 됐다 — 같은 128 을 두 곳에 따로 적었다.
     이 레포엔 stripComments 가 11벌로 갈라져 9벌이 같은 모양으로 부서진 전례가 있다
     (tests/unit/_strip-comments.js 머리말). ⇒ **사본이 «둘일 때» 모았다. 셋이면 늦다.**

   ⇒ 판정은 js/io/image-data-url.js 의 `isUsableImageDataUrl` «한 곳»이다.
   ⛔이 검사는 «사본이 느는 것»만 막는다. 「아직 안 막은 자리가 몇인가」는 T-147 계열의 다른 일이다.
═══════════════════════════════════════════════════════════════════════════ */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const _req = createRequire(import.meta.url);
const { stripComments } = _req('./_strip-comments.js');   /* ⛔여기서 새로 만들지 마라(S-6) */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const HOME = path.join('js', 'io', 'image-data-url.js');   // 판정이 사는 «유일한 집»

/** 「빈 그림 판정을 스스로 하고 있다」로 보이는 꼴. 주석은 걷고 «코드»만 본다.
 *  ⛔처음엔 `startsWith('data:image/')` 를 «혼자서» 신호로 썼다가 오탐이 났다 —
 *    js/scratch-pad.js:1869 의 `else if (src.startsWith('data:image/')) srcType = 'image';`
 *    는 «종류를 가르는» 일이지 «빈 그림을 판정하는» 일이 아니다. 열어 보고 뺐다.
 *  ⇒ 꼴 판정은 «길이 비교와 같은 줄에» 있을 때만 사본으로 본다 — 진짜 사본이 그 모양이다. */
const COPY_RE = [
  /\.length\s*[<>]=?\s*128\b/,              // 같은 임계를 다시 적었다
  /['"`]data:,['"`]/,                        // 그 6자를 직접 비교한다
  /startsWith\(\s*['"`]data:image\/['"`]\s*\)[\s\S]{0,80}?\.length/, // 꼴＋길이 = 판정을 다시 만든 꼴
];

function sources() {
  const out = [];
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(js|mjs|html)$/.test(e.name)) {
        out.push({ rel: path.relative(ROOT, p), code: stripComments(fs.readFileSync(p, 'utf8')) });
      }
    }
  })(path.join(ROOT, 'js'));
  for (const rel of ['pages/projects.html', 'index.html']) {
    const p = path.join(ROOT, rel);
    if (fs.existsSync(p)) out.push({ rel, code: stripComments(fs.readFileSync(p, 'utf8')) });
  }
  return out;
}

const hits = (files) => files
  .filter(f => f.code.split('\n').some(line => COPY_RE.some(re => re.test(line))))
  .map(f => f.rel);

test('J1 ★전제 — 판정이 사는 집이 실재하고, 그 함수를 내놓는다', () => {
  const p = path.join(ROOT, HOME);
  assert.ok(fs.existsSync(p), `★${HOME} 이 없다 — 이 검사가 «안 돈» 것이지 통과가 아니다`);
  const m = _req(p);
  assert.equal(typeof m.isUsableImageDataUrl, 'function',
    '★isUsableImageDataUrl 을 안 내놓는다 — 아래 검사들이 «없는 집»을 지키게 된다');
});

test('J2 ★그 판정이 실제로 «6자»를 잡고 «멀쩡한 것»은 안 잡는다', () => {
  const { isUsableImageDataUrl } = _req(path.join(ROOT, HOME));
  assert.equal(isUsableImageDataUrl('data:,'), false, '★그 6자를 «쓸 만하다»고 한다 — 아무것도 안 막는다');
  assert.equal(isUsableImageDataUrl(''), false);
  assert.equal(isUsableImageDataUrl(null), false);
  assert.equal(isUsableImageDataUrl('data:image/png;base64,' + 'A'.repeat(200)), true,
    '★멀쩡한 그림을 «빈 그림»이라고 한다 — 되는 캡처까지 막는다');
  assert.equal(isUsableImageDataUrl('data:text/plain;base64,' + 'A'.repeat(500)), false,
    '★그림이 아닌 data URL 을 통과시킨다');
});

test('J3 ⛔판정의 «사본»이 집 밖에 생기지 못한다', () => {
  const found = hits(sources()).filter(rel => rel !== HOME);
  assert.deepEqual(found, [],
    '★빈 그림 판정을 스스로 하는 자리가 생겼다 — js/io/image-data-url.js 의 ' +
    'isUsableImageDataUrl 을 «불러라». 2026-09-22 에 같은 판정이 둘로 갈렸고 그날 모았다.\n  ' +
    found.join('\n  '));
});

test('J4 ★양성대조 — 이 잣대가 «실제로» 잡는다 (집을 빼지 않으면 걸려야 한다)', () => {
  const all = hits(sources());
  assert.ok(all.includes(HOME),
    `★집(${HOME}) 조차 이 정규식에 «안» 걸린다 — J3 의 초록은 «사본이 없어서»가 아니라 ` +
    '«못 봐서»다. COPY_RE 가 늙었으니 먼저 고쳐라');
});
