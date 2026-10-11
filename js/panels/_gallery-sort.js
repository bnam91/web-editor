/* _gallery-sort.js — ★AI 갤러리 ★정렬의 ★★«한 자리» (C11 · 2026-10-11)
 *
 * ★왜 ★생겼나 — ★같은 식이 ★★두 곳에 ★있었다(★t4quote 가 ★찾았다):
 *   ★`js/panels/ai-image-gallery.js:63` · ★`js/panels/assets-panel.js:1064`
 *   ★둘 다 ★★`String(b.createdAt).localeCompare(String(a.createdAt))` — ★★시각을 ★★«글자»로 ★견준다.
 *   ⇒ ★★명부가 ★둘이라 ★★한쪽만 ★고치면 ★조용히 ★갈린다 ⇒ ★★파생시켜 ★하나로.
 *
 * ★★★그리고 ★★«복제»만이 ★아니라 ★★«고침»이다 — ★그 식에 ★잠복 결함이 ★있다:
 *   ★`createdAt` 꼴이 ★★섞여 ★있다(★t4quote 실측: ★24자 ★18건 · ★★27자(마이크로초) ★28건)
 *     ⚠️★★그 수는 ★★내가 ★확인하지 ★못했다 — ★내 자로는 ★그 저장소를 ★★못 찾았다(★proj.json 쪽은 ★24자만 ★2건)
 *     ⇒ ★★«섞임»의 ★수는 ★★t4quote 의 것이고 ★★여기선 ★그대로 ★인용한다
 *   ★★그런데 ★★«역전»은 ★★내가 ★확인했다(★아래 ⒜).
 *
 * ⒜ ★★★글자 비교가 ★어긋나는 ★까닭 — ★`'Z'`(90) 가 ★숫자(48~57)보다 ★크다:
 *     ★`...00.85Z` vs ★`...00.850066Z` ⇒ ★공통 `...00.85` 뒤가 ★`Z` 대 ★`0`
 *     ⇒ ★★글자로는 ★`.85Z` 가 ★★«나중»이 된다. ★★참 시각은 ★★그 반대다(★0.850000 < 0.850066).
 *
 * ⒝ ★★★`Date.parse` 로는 ★★못 고친다 — ★★★밀리초에서 ★★잘린다(★내 실측):
 *     ★`Date.parse('...00.85Z')` = ★1779267600850 · ★`Date.parse('...00.850066Z')` = ★★같은 수
 *     ⇒ ★★★둘이 ★★동점이 된다 ⇒ ★★«문자열을 ★동점 깨기로»만 ★쓰면 ★★그 동점에서 ★★다시 ★글자로 ★가고
 *       ★★★어긋난 ★순서가 ★★그대로 ★돌아온다. ⇒ ★★그래서 ★★그 처방으로는 ★★이 짝을 ★★못 고친다.
 *     ⇒ ★★★그래서 ★★«마이크로초»까지 ★세는 ★키를 ★만든다(★아래 `createdAtKey`).
 *
 * ⒞ ★★파싱 실패는 ★★맨 뒤로 — ★실측 ★0건이어도 ★자리를 ★둔다(★지디 조건).
 *     ★까닭: ★★`null`·`''`·쓰레기가 ★★맨 앞에 ★서면 ★★«최신»자리를 ★차지한다 ⇒ ★화면이 ★거짓말한다.
 */

/** ★ISO 시각 → ★★마이크로초 정수(★비교용 키). ★★못 읽으면 ★`null`.
 *  ⛔`Date.parse` ★하나로는 ★안 된다 — ★★그 자는 ★★ms 에서 ★자른다(★머리말 ⒝).
 *  ⇒ ★★초의 ★소수부를 ★★따로 ★떼어 ★★6자리로 ★맞춘 뒤 ★더한다. */
function createdAtKey(v) {
  const s = String(v == null ? '' : v).trim();
  if (s === '') return null;
  const ms = Date.parse(s);
  if (!Number.isFinite(ms)) return null;
  /* ★소수부 — ★`.85` · `.850066` · ★없음 ★전부 받는다 */
  const m = /\.(\d+)/.exec(s);
  const frac = m ? m[1] : '';
  /* ★★6자리(마이크로초)로 ★맞춘다 — ★`85` → `850000` · `850066` → `850066` · `` → `000000`
     ⛔7자리 이상이면 ★잘라낸다(★그 아래는 ★이 키가 ★못 가른다 — ★그건 ★적어 둔다) */
  const micro = Number((frac + '000000').slice(0, 6));
  /* ★`Date.parse` 가 ★이미 ★ms 를 ★품었으니 ★★그 ms 의 ★소수부를 ★★빼고 ★다시 ★얹는다 */
  const whole = Math.floor(ms / 1000) * 1000;
  return (whole * 1000) + micro;
}

/** ★최신이 ★앞(내림차순). ★★파싱 실패는 ★★언제나 ★맨 뒤.
 *  ★★동점이면 ★`id` 로 ★깬다 — ⛔글자(`createdAt`)로 ★깨면 ★★머리말 ⒝ 의 ★그 역전이 ★돌아온다. */
function byCreatedAtDesc(a, b) {
  const ka = createdAtKey(a && a.createdAt);
  const kb = createdAtKey(b && b.createdAt);
  if (ka === null && kb === null) return 0;
  if (ka === null) return 1;            // ★a 를 ★뒤로
  if (kb === null) return -1;           // ★b 를 ★뒤로
  if (kb !== ka) return kb - ka;         // ★최신이 ★앞
  /* ★★동점 깨기 — ★`id` 는 ★시각과 ★무관한 ★안정 축이다(★같은 입력이면 ★같은 순서) */
  return String((b && b.id) || '').localeCompare(String((a && a.id) || ''));
}

/* ★★★고전 스크립트다 — ⛔`export` 를 ★쓰지 ★마라.
 *   ★까닭(★실측 2026-10-11): ★소비자 ★둘(`ai-image-gallery.js` · `assets-panel.js`)이
 *     ★★`index.html:1350~1351` 에서 ★★`<script src>` 로 ★실린다(★`type="module"` 이 ★아니다)
 *     ＋ ★★그 둘의 ★`import`/`export` 줄 = ★★0 (★dev 판으로 ★확인)
 *   ⇒ ★★`import` 를 ★더하면 ★★«Cannot use import statement outside a module» 로 ★★앱이 ★죽는다.
 *     ⚠️★★나는 ★처음에 ★`import` 꼴로 ★썼고, ★★`.mjs` 사본 ★`--check` 는 ★★그것을 ★★못 잡았다
 *       (★모듈로 ★검사해서 ★통과했다) ⇒ ★★★자가 ★«실리는 꼴»을 ★안 보면 ★거짓 초록을 ★낸다.
 *   ⇒ ★★그래서 ★★`window` 로 ★나눈다 — ★선례: ★`window.galleryInsertToCanvas`(:170) ·
 *     ★`window.assetsImportFromGallery`(:1305) */
window.galleryCreatedAtKey = createdAtKey;
window.galleryByCreatedAtDesc = byCreatedAtDesc;
