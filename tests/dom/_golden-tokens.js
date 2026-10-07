'use strict';
/* ══ _golden-tokens.js — 「핀 대조」 골든들이 쓰는 ★«뜻한 바뀜» 토큰 되돌리기 (지디 2026-10-08) ══
 *
 * ★무엇인가 — 이 레포엔 «커밋 sha 핀»과 바이트를 견주는 검사가 다섯 있다:
 *   W0 grid-block-width-model(bf9161d0) · Y0 grid-cellpady(0f572e2a) · B0 grid-children-shell-bytes(37ab1c65)
 *   F8 grid-flatten-columns(골든 파일 · ★GD1001_ROOT 핀루트에서만 뜬다) · T3 tpl-pagepad-e81(4df20f78)
 * ★그 검사들은 「★내가 더한 코드가 ★기존 산출을 ★한 바이트도 안 건드렸나」를 잰다.
 *   ⇒ ★«뜻한 바뀜»(현빈이 요청해 ★일부러 더한 선언)은 ★그 토큰만 옛 꼴로 되돌려 견준다.
 *   ⛔골든을 «갱신»하는 길은 ★아니다 — F8 이 그 가드를 글로 박아 뒀다:
 *     「⛔골든은 ★핀 판에서만 뜬다 — GD1001_ROOT 를 걸어라(★HEAD 에서 뜨면 ★무엇과도 같아진다)」
 *     ★2026-10-08 에 내가 Y0·T3 를 HEAD 에서 갱신했다가 그 가드를 읽고 ★되돌렸다.
 *
 * ★왜 ★한 곳인가 — 2026-10-08 전까지 이 로직이 ★W0·B0 ★두 곳에 ★복사돼 있었다(주석까지 같았다).
 *   FONT 토큰을 더해야 할 자리가 ★다섯으로 늘어나는 순간 ★명부가 다섯이 된다.
 *   ★내 규율: 「★명부가 «둘»이면 ★경고 주석으로 못 막는다 — ★파생시켜 ★하나로」
 *   ⇒ ★여기 하나에서 뜨고, ★★「이 본문을 무력화하면 ★다섯이 ★전부 빨강」을 ★검사로 잠근다
 *     (tests/dom/golden-tokens-contract.dom.spec.js — 「합쳐라」와 「합친 것을 재라」를 ★한 쌍으로).
 *
 * ★토큰 명부 — ★각각 ★무엇이 왜 더해졌나를 ★적는다. ⛔까닭 없는 토큰을 더하지 마라.
 *   ⑴ E127 (c16bbccc · 지디 E127-guards 2026-10-06)
 *      그리드 역할색 `color:#hex` → `color:var(--preset-<역할>-color, #hex)`.
 *      폴백 hex 가 그대로라 프리셋 덮기가 없으면 ★같은 픽셀이다. 역할 다섯 · 6자리 hex 만 잡는다.
 *   ⑵ FONT (9a3f934d · 2026-10-07 현빈)
 *      원문: 「… 이외 ★그리드 블럭에 ★텍스트 줄을 추가해도 ★기본(시스템)으로 나온다. 근데 그냥 섹션에
 *             ★텍스트 블럭을 추가하면 ★프리텐다드로 되어있잖아? ★그렇게 되길 원해 ★모달이나 ★그리드블럭의 텍스트 줄」
 *      ⇒ 새 글자 줄에 `font-family:'Pretendard', sans-serif;` 가 붙는다. 핀 판엔 없다.
 *      ★얼굴이 ★둘이다 — ⒜렌더된 ★인라인 스타일 ⒝`data-cols` 안 ★모델 JSON(속성값이라 따옴표가 `&quot;`).
 *        ⛔2026-10-08 실측: ⒜만 되돌렸다가 B0(outerHTML 을 뜬다)가 ★21/21 그대로 빨갰다.
 *        W0 는 `.grd-inner` 만 떠서 data-cols 가 없어 ⒜만으로 초록이었다 — ★범위가 달랐을 뿐이다.
 *      ⛔값을 리터럴로 적는 것이라 `fontChain('Pretendard')` 규약이 바뀌면 ★이 자가 먼저 썩는다 —
 *        그때 FONT 영수증이 0 이 되어 ★빨개진다(그게 영수증을 토큰별로 가른 까닭이다).
 *      ★그 한 뿌리가 다섯을 움직였다: `grdNewLineFontFamily()` 를 '' 로 무력화하면 다섯이 ★전부 초록
 *        (2026-10-08 실측 · rc 0 · ✘ 0 · 원복 해시 동일).
 */

const TOKENS = [
  { name: 'E127', re: /color:var\(--preset-(?:h1|h2|h3|body|caption)-color, (#[0-9a-fA-F]{6})\);/g,
    to: (_, hex) => `color:${hex};` },
  { name: 'FONT', re: /font-family:'Pretendard', sans-serif;/g, to: () => '' },
  { name: 'FONT', re: /,&quot;fontFamily&quot;:&quot;'Pretendard', sans-serif&quot;/g, to: () => '' },
  { name: 'FONT', re: /,"fontFamily":"'Pretendard', sans-serif"/g, to: () => '' },
];

/** 토큰을 옛 꼴로 되돌린다.
 *  @param h    견줄 문자열
 *  @param want ★«어느 토큰을 되돌리나» — 이름 배열. ⛔생략하면 던진다.
 *
 *  ★★왜 호출자가 고르나 — ★검사마다 ★핀이 ★다른 판이다(2026-10-08 실측):
 *    W0 bf9161d0 · B0 37ab1c65 → ★E127 ★이전 판 ⇒ ★E127 도 되돌려야 핀과 같아진다
 *    Y0 0f572e2a               → ★★E127 ★이후 판 ⇒ ★★E127 을 되돌리면 ★거꾸로 달라진다
 *       (실측: 핀에 `color:var(--preset-body-color, #555555);` 가 ★이미 있는데 내가 `color:#555555;` 로 되돌려 빨갰다)
 *  ⇒ ★★「전체 선언」 하나로는 ★개별 예외를 못 만든다 — ★예외는 ★대상(호출자)에서 고른다.
 *    ★각 검사는 ★자기 핀이 ★어느 판인지 ★적고 그 목록을 넘긴다. ⛔추측으로 넘기지 마라 — ★빨개지면 ★방향을 봐라.
 */
function tokensBack(h, want) {
  if (!Array.isArray(want) || !want.length) {
    throw new Error('⛔tokensBack(h, want): ★어느 토큰을 되돌리나를 ★고르라 — 핀 판마다 다르다(모듈 머리말 참조)');
  }
  const bad = want.filter(n => !TOKEN_NAMES.includes(n));
  if (bad.length) throw new Error(`⛔모르는 토큰 이름: ${bad.join(',')} — 아는 것은 ${TOKEN_NAMES.join(',')}`);
  let s = (h ?? '') + '';
  const counts = {};
  for (const t of TOKENS) {
    if (!want.includes(t.name)) continue;
    s = s.replace(t.re, (...a) => { counts[t.name] = (counts[t.name] || 0) + 1; return t.to(...a); });
  }
  return { s, counts };
}

/** 이 모듈이 아는 토큰 이름들 — 계약 검사가 이걸로 영수증 칸을 센다. */
const TOKEN_NAMES = [...new Set(TOKENS.map(t => t.name))];

module.exports = { tokensBack, TOKEN_NAMES };
