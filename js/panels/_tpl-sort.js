/* _tpl-sort.js — ★설계 F(b4): ★템플릿 브라우저 ★정렬 ★★«명부 한 자리»
 *
 * ★★찾은 자 = t4quote · ★★고친 자 = t1bstar.
 *
 * ★★★이 설계의 ★안전판 — ★★기본 열쇠는 ★★★«아무것도 ★안 한다»
 *   ★★지디 판정(2026-10-11 · ★⒝): ★★기본 열쇠 = ★★`'default'` = ★★★정렬 자를 ★안 거친 ★그 차례.
 *   ★★★왜 ★그렇게 ★갔나 — ★★★«안 쟀다»를 ★★안전판으로 ★쓰지 ★않으려고.
 *     ★★첫 판은 ★기본을 ★`recent`(createdAt 내림차순)로 ★뒀다. ★`saveAsTemplate` 가 ★`unshift` 하니
 *     ★★«사실상 ★같다»고 ★적었는데 — ★★★그 «사실상»은 ★★★모든 레코드의 ★createdAt 차례가
 *     ★삽입 차례와 ★같을 ★때만 ★참이고, ★★★나는 ★그걸 ★★못 쟀다.
 *   ⇒ ★★그래서 ★★«데이터가 ★마침 ★협조한다»에 ★★안 맡긴다. ★★★기본은 ★★«손대지 ★않는다»다.
 *   ⇒ ★★그러면 ★★F1 이 ★★★데이터와 ★★무관하게 ★참/거짓이 ★갈린다 — ★★완전히 ★선다.
 *   ⛔«기본값 ★없음»(undefined·null)으로 ★두지 ★않았다 — ★★★이름 있는 ★값이어야
 *     ★★검사가 ★그 상태를 ★가리킬 ★수 ★있고 ★★«열 때 ★되돌리기»도 ★쓸 ★수 ★있다.
 *
 * ★★★⚠️무엇을 ★쟀고 ★무엇을 ★안 쟀나 — ★★쪼개 ★적는다(⛔지우지 ★마라 · ★지디 ⑵ 2026-10-11)
 *   ★★★쟀다: ★★새로 ★저장되는 것은 ★★`unshift` 다 ⇒ ★★배열이 ★★«최근 추가 ★내림차순»이다.
 *     ★자리 ★★네 곳(★내가 ★다시 ★셌다 — ★지디 수는 ★셋이었다):
 *       ★`template-system.js:372`  `_lsFullCache.unshift(…)`   ⟵ ★섹션 저장 · ★전체 캐시
 *       ★`template-system.js:376`  `templates.unshift(…)`      ⟵ ★섹션 저장 · ★색인
 *       ★`template-system.js:1123` `_lsFullCache.unshift(…)`   ⟵ ★블록 저장 · ★전체 캐시
 *       ★`template-system.js:1128` `templates.unshift({…})`    ⟵ ★블록 저장 · ★색인
 *     ⇒ ★★즉 ★★«저장 경로 ★둘» × ★«목록 ★둘» = ★★4.
 *   ★★★그러나 ★★그것이 ★★«createdAt 차례와 ★같다»는 ★뜻은 ★★아니다 — ★★★셋을 ★안 쟀다:
 *     ⒜ ★★옛·이관 데이터는 ★★그 자를 ★★안 거쳤을 ★수 ★있다
 *     ⒝ ★★`loadTemplates()`(★`template-system.js:202`)가 ★★어디서 ★읽고 ★★차례를 ★★보존하나
 *     ⒞ ★★`createdAt` 이 ★★«저장 시각»인가 ★★«만든 시각»인가 — ★★뜻이 ★다르면 ★차례도 ★다르다
 *   ⇒ ★★★누가 ★★`recent` 를 ★★기본으로 ★올리려 ★하면 ★★★이 ★셋이 ★★먼저다.
 *   ⇒ ★★«안 쟀다»를 ★★«무엇을 ★안 쟀나»로 ★쪼갠 ★까닭: ★★다음 사람이 ★★쓸 수 ★있어야 ★한다.
 *
 * ★★★명부는 ★★여기 ★하나다 — ⛔UI 의 ★`<option>` 을 ★★손으로 ★★또 ★적지 ★마라.
 *   ★★`tplSortOptionsHtml()` 이 ★★이 명부에서 ★그린다 ⇒ ★★갈라질 ★수가 ★없다.
 *   (★내 명부: ★「★명부가 ★둘이면 ★경고 주석으로 ★못 막는다 — ★★파생시켜 ★하나로」)
 *
 * ★★★`recent` 의 ★비교자는 ★★새로 ★짜지 ★않았다 — ★★`_gallery-sort.js` 의 것을 ★쓴다.
 *   ★그 자가 ★이미: ★마이크로초까지 ★가르고(★`.85Z` vs `.850066Z` 역전을 ★고친다) ·
 *   ★★못 읽는 값은 ★★맨 뒤(=★F6) · ★동점은 ★`id` 로 ★깬다.
 *   ⇒ ★★여기서 ★★다시 적으면 ★★그 셋이 ★★두 벌이 된다.
 *
 * ★★★그 ★동점 깨기의 ★«뜻»은 ★★★«부르는 쪽 ★id 꼴»에 ★산다 (지디 정정 · 2026-10-11)
 *   ★★템플릿 = ★★`tpl_<ms>_<난수4>` — ★★★오늘 ★내 C 묶음이 ★★그렇게 ★바꿨다.
 *   ⇒ ★★같은 ms 의 ★둘도 ★★«갈린다». ⇒ ★★그래서 ★★★「ms 보다 ★잘게는 ★못 가른다」가 ★★틀렸다.
 *   ★★참 문장 = ★★★「★같은 ms 안에서는 ★★★난수가 ★정한 ★차례가 ★보인다 — ★★임의지만 ★★안정·결정적」.
 *     ⇒ ★★사람은 ★「최신이 ★앞」으로 ★읽는데 ★★그 안쪽 차례엔 ★★뜻이 ★없다. ★★받아들일 ★수는 ★있다 —
 *       ★★다만 ★★«뜻 없음»을 ★★«뜻 있음»으로 ★읽히게 ★두지 ★않으려고 ★여기 ★적는다.
 *   ★★★⇒ ★그리고 ★★이것이 ★★내 C 묶음의 ★귀결이다 — ★겹침을 ★없애려 ★붙인 ★난수가
 *     ★★이 비교자의 ★동점 깨기의 ★뜻을 ★바꿨다. ★★둘이 ★★같은 세션에서 ★물렸다.
 *   ⚠️★★`ai-image-gallery`·`assets-panel` 의 ★id 꼴은 ★★★안 쟀다 — ⛔«같다»로 ★적지 ★않는다.
 *     ⇒ ★★이 F 는 ★★«템플릿 꼴»만 ★잠근다. ⛔남의 꼴까지 ★재려 ★들지 ★않는다(★범위가 ★넓어진다).
 *
 * ★★★⛔`export`·`import` 금지 — ★★`pages/template-browser.html` 이 ★소비자를 ★고전 스크립트로 싣는다.
 */

/* ★★비교자를 ★★«부를 때» ★찾는다 — ⛔모듈 ★평가 ★시점에 ★박지 ★마라.
   ★★까닭: ★싣는 ★차례가 ★어떻든 ★★부르는 ★시점엔 ★`_gallery-sort.js` 가 ★이미 ★섰다.
   ★★그리고 ★★없으면 ★★조용히 ★«안 정렬»로 ★떨어지지 ★않게 — ★★그 자리에서 ★던진다. */
function _recentCmp(a, b) {
  const f = window.byCreatedAtDesc || window.galleryByCreatedAtDesc;
  if (typeof f !== 'function') {
    throw new Error('★`byCreatedAtDesc` 가 ★없다 — ★`_gallery-sort.js` 가 ★안 실렸나?');
  }
  return f(a, b);
}

/* ★★★명부 — ★★차례가 ★뜻을 ★가른다: ★★첫 칸이 ★★기본값이다(★`tplSortDefault`).
   ★★★`cmp: null` = ★★«정렬 자를 ★★안 거친다». ⛔`() => 0` 으로 ★★두지 ★마라 —
     ★그건 ★★«안정 정렬에 ★기대어 ★같은 차례가 ★나온다»이고 ★★★«안 거친다»가 ★아니다.
     ★★엔진의 ★안정성에 ★뜻이 ★매달리면 ★★F1 이 ★★다시 ★★«무언가에 ★협조를 ★구하는» 단언이 ★된다. */
const TPL_SORTS = Object.freeze({
  default: Object.freeze({ label: '기본 (추가된 차례)', cmp: null }),
  recent: Object.freeze({ label: '최근 추가순', cmp: _recentCmp }),
  name:   Object.freeze({
    label: '이름순',
    /* ★`'ko'` — ★한글 ★차례를 ★★글자코드가 ★아니라 ★★사전으로 ★센다 */
    cmp: (a, b) => String((a && a.name) || '').localeCompare(String((b && b.name) || ''), 'ko'),
  }),
});

const TPL_SORT_DEFAULT = 'default';

/** ★★`<option>` 들을 ★★명부에서 ★그린다 — ★★두 HTML 이 ★★같은 자를 ★부른다. */
function tplSortOptionsHtml(selected) {
  const sel = TPL_SORTS[selected] ? selected : TPL_SORT_DEFAULT;
  return Object.keys(TPL_SORTS).map(k =>
    `<option value="${k}"${k === sel ? ' selected' : ''}>${TPL_SORTS[k].label}</option>`
  ).join('');
}

/** ★★목록을 ★정렬해 ★★«새 배열»로 ★돌려준다.
 *  ⛔제자리 정렬(`list.sort`)을 ★하지 ★않는다 — ★★부르는 쪽의 ★배열을 ★★안 흔든다.
 *  ★★못 아는 열쇠는 ★★기본값으로 ★떨어진다(⛔`sort(undefined)` 로 ★가면 ★★기본 ★문자열 비교가 되어
 *    ★★조용히 ★★틀린 차례가 ★된다 — ★C11 에서 ★쟀다). */
function tplSortApply(list, key) {
  const k = TPL_SORTS[key] ? key : TPL_SORT_DEFAULT;
  const cmp = TPL_SORTS[k].cmp;
  /* ★★★`cmp` 가 ★없는 ★열쇠(=★기본)는 ★★★`sort` 를 ★★아예 ★안 부른다 — ★사본만 ★돌려준다.
     ⇒ ★★그래서 ★★«기본으로 ★그린 차례 == ★정렬 자를 ★안 거친 차례»가 ★★항등이 아니라 ★★★집행이다. */
  if (!cmp) return (list || []).slice();
  return (list || []).slice().sort(cmp);
}

window.TPL_SORTS = TPL_SORTS;
window.tplSortDefault = TPL_SORT_DEFAULT;
window.tplSortOptionsHtml = tplSortOptionsHtml;
window.tplSortApply = tplSortApply;
