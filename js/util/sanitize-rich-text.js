/* sanitize-rich-text.js — «부분 서식 HTML»(리치텍스트)을 ★안전하게 다루는 ★한 벌.
 *
 * ★★어디서 왔나 (2026-10-08 · 지디 판정)
 *   이 본문은 ★`js/blocks/sticker-block.js` 의 «U6b 스티커 리치텍스트»였다.
 *   ★이름만 바꿨고 ★본문 로직은 ★한 글자도 안 고쳤다 — ⛔손으로 베낀 것이 아니다.
 *     스크래치패드 도구(extract.py)가 ★원본 바이트에서 ★뽑아 왔다. ★경계는 ★이름으로 찾았다
 *     (⛔줄번호로 찾지 않았다 — 그 사이가 바뀌면 조용히 틀린다). ★뽑은 줄 95(원본 25~119행).
 *   ★왜 옮겼나 — ★모달 슬롯(수지②)이 ★같은 일을 해야 한다. 베끼면 ★명부가 둘이 되고,
 *     ★`window._sanitizeStickerHtml` 전역을 ★모달이 부르는 것도 ⛔안 된다
 *     (★이름이 거짓말을 한다 — 「Sticker」가 모달의 권위가 된다 ＋ ★플레인 전역 이름 충돌 위험).
 *   ⇒ 지디 규율: 「★명부가 ★둘이면 ★경고 주석으로 못 막는다 — ★파생시켜 ★하나로」
 *
 * ★★무변을 ★무엇이 증명하나
 *   ★`tests/dom/rich-text-sanitize.dom.spec.js` — ★이사 ★전에 ★먼저 세웠고 ★7/7 초록이었다.
 *   ★이사 뒤에도 ★같은 단언이 ★같은 입구(★`window._sanitizeStickerHtml`)로 ★초록이어야 한다.
 *   ⇒ ★빨개지면 그것이 ★«공용화 실패»다. ⛔그 파일을 지우지 마라 — ★이 모듈의 ★존재 근거다.
 *   ★S7 이 ★«알리아스가 ★같은 함수인가»를 ★`===` 로 잠근다
 *     (★사본이 아니라 ★한 벌임을 ★그것이 증명한다 — ⛔「합쳤다」는 말로는 안 된다).
 *
 * ★★소비자 — ★늘면 ★여기 적어라. ★명부는 ★이 줄들 하나다
 *   ⑴ `js/blocks/sticker-block.js` — `dataset.textHtml`
 *      (★2026-10-08 이사 시점의 ★유일한 소비자. ★행위로 셌다: 이 모듈을 import 하는 파일 1)
 *   ⑵ (예정) 모달 슬롯 — 수지② `js/blocks/modal-block.js` · `js/block-drag.js`
 *   ⑶ 그리드 줄 — `js/blocks/grid-block.js`(렌더 gridLineHtml) · `js/block-drag.js`(커밋 _gridEndEdit) · opts = GRID_RICH_TEXT_OPTS (수지⑦ 2026-10-08)
 *   ⑷ line-host 줄(버블·챗·비교·laurel) — `js/blocks/line-host.js` lnBeginEdit 커밋 · 렌더는 ⑶ 의 gridLineHtml · 같은 opts (1013t1B1 2026-10-13)
 *   ⑸ 어노테이션 라벨 — `js/blocks/annotation-block.js` `dataset.labelHtml`(렌더 ＋ `annotReadLabelHtml` 커밋) ·
 *      opts = ANNOT_RICH_TEXT_OPTS (★`styleProps:['font-size']` — ★이 소비자가 ★`RICH_TEXT_STRICT_STYLE_VALS` 의 ★첫 손님이다) (1017t1h3 2026-10-19)
 *
 * ★★★2026-10-08 ★정정 — ★내가 여기 적었던 문장이 ★틀렸다(★지디가 ★자기 QA 로 잡았다)
 *   ⛔틀린 문장: 「이 본문을 ★무력화하면 ★소비자 ★«수»만큼 빨강이어야 한다 · 실측 = 소비자 1 이라 빨강도 1」
 *   ★무엇이 틀렸나 — ★빨강을 낼 수 있는 것은 ★import 하는 ★«파일»이 ★아니라
 *     ★★그 소비자의 ★행동을 ★«재는 ★검사»다. ★그 수는 ★★0 이었다.
 *   ★실측(지디 · 무력화 QA): 빨강 ★3건이 ★전부 ★«이 모듈 ★자신의 spec»(S2·S3·S5)이었고,
 *     ★스티커를 겨냥한 DOM ★9벌은 ★하나도 ★안 빨개졌다 — 그 9벌에서
 *     `textHtml`·`sanitizeRichText`·`richTextHasFormatting` 언급이 ★전부 ★0 이다.
 *     ＋ tests/ 전체에서 `textHtml` 을 언급하는 다른 파일은 ★벽 기록 벌(skip 전용) ★하나뿐.
 *   ★★고친 문장: 「무력화 → ★«그 길을 ★재는 ★검사» N개 ★전부 빨강」
 *     ＋ 「★빨강이 ★어느 파일인지 ★전수 출력 — ★전부 ★이 모듈 ★자신의 spec 이면
 *        그것은 ★«공용화가 안전하다»가 ★아니라 ★★«소비자 쪽을 ★안 재고 있다»다」
 *   ★★그래서 ★이 이사를 ★떠받치는 것은 ★«무력화 쌍»이 ★아니라 ★★«내용 동일성»이다 —
 *     지디 실측: 옛 본문(dev 의 sticker-block.js 25~119행) ↔ 이 모듈의 본문, 이름만 정규화해
 *     ★diff ★2줄(★소비자로 옮겨간 ★알리아스 두 줄) ⇒ ★본문은 ★한 글자도 안 바뀌었다.
 *     ＋ ★S7 의 `===` 가 ★사본이 아니라 ★한 벌임을 잠근다.
 *   ⛔★그 근거는 ★«순수 리팩터»에만 선다. ★★모달 리치텍스트(⑶)는 ★제품 동작을 ★바꾸므로
 *     ★내용 동일성이 ★근거가 ★못 된다 ⇒ ★★거기선 ★«모달의 ★행동을 ★재는 검사»를 ★먼저 세워야
 *     「무력화 → ★2 ★전부 빨강」이 ★처음으로 ★참이 된다. ★스티커 쪽 ★0 도 ★그때 하나 같이 세운다.
 *
 * ★★★이 파일이 ★사는 자리의 규약 (지디 판정 2026-10-08 ①) — ★`js/util/` 에는
 *   ★★«도메인 임자가 ★없는 ★순수 함수»만 들어온다.
 *   ⛔상태를 들거나 · DOM 을 ★소유하거나 · ★블럭 지식이 있으면 ★못 들어온다.
 *   ★까닭: 이 sanitizer 는 ★임자가 없다. `blocks/`·`io/` 에 넣으면 ★이름이 ★거짓말을 한다 —
 *     ★`window._sanitizeStickerHtml` 을 ★거부한 그 까닭과 ★같다.
 *   ⛔이 한 줄이 없으면 ★`js/util/` 은 ★쓰레기통이 된다.
 *   (★이 디렉터리는 2026-10-08 에 ★이 파일로 ★생겼다 — `js/` 하위 12번째.
 *    ★지디 쪽 기록 = 지디/reference/architecture.md · ⛔CLAUDE.md 는 안 건드린다)
 *
 * ★정규식 아님 — ★DOM 순회다. `<template>` 파싱이라 ★실행 컨텍스트가 없다(img 로드·이벤트 미발생).
 * ⛔`innerHTML` 로 직접 파싱하지 마라 — 그 순간 img 가 뜨고 on* 가 돈다.
 * ★★두 허용목록을 ★export 한 까닭 = ★검사가 ★«정의 자리의 ★런타임 값»을 읽게 하려고다.
 *   ⛔소스 문자열만 파싱하면 ★내 주석이 ★그 입력이 된다(★이 레포에서 실제로 밟은 함정이다).
 */

const CTL_CHARS_RE = /[\u0000-\u0008\u000B-\u001F\u007F]/g;
// 제어문자 정화 — \b(U+0008) 등 보이지 않는 제어문자가 렌더에 잔존하면
// contenteditable 캐럿 오프셋을 어지럽힘 (실데이터 stk_p4wfa0 선두 \b 사례).
// \t(U+0009)·\n(U+000A)은 보존 (텍스트 스티커 Enter 줄바꿈 기능 유지). 렌더는 비파괴(dataset 불변),
// dataset 자체는 편집 커밋(sticker-select.js finish) 시 자연 치유됨.
export function stripCtlChars(s) {
  return String(s).replace(CTL_CHARS_RE, '');
}

// ── U6b: 스티커 리치텍스트 sanitizer ──────────────────────────────────────
// dataset.textHtml(부분 서식 HTML)을 렌더·로드 때마다 재-sanitize한다(저장본/.gdt 변조 대비).
// ★정규식 아님 — DOM 순회. template 파싱이라 실행 컨텍스트 없음(img 로드·이벤트 미발생).
//   허용 태그만 재구성, span은 style만·style도 프로퍼티/값 화이트리스트, 그 외 전부 제거.
// ⚠️STRIKE 는 «레거시지만 execCommand 가 실제로 만드는» 태그다 — Chrome 의
//   execCommand('strikeThrough') 산출물이 <strike> 라, 허용목록에 없으면 ⌘⇧X 로 그은 취소선이
//   커밋(sanitize) 순간 언랩돼 «되는 척»만 하고 사라진다(실측: live 엔 <strike>, textHtml 엔 없음).
export const RICH_TEXT_ALLOWED_TAGS = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'BR', 'SPAN']);
export const RICH_TEXT_ALLOWED_STYLE_PROPS = new Set(['color', 'font-weight', 'font-style', 'text-decoration', 'background-color']);
// 값 화이트리스트 — hex / 함수형색(rgb·hsl, 내부 charset 잠금) / 명명색·키워드(bold·italic·underline·line-through·normal) / 정수(font-weight).
//   함수형색 내부는 [0-9.,\s%/]만 허용 → url(·javascript: 등 침투 불가.
const VAL_HEX  = /^#[0-9a-fA-F]{3,8}$/;
const VAL_FUNC = /^(?:rgb|rgba|hsl|hsla)\(\s*[0-9.,\s%/]+\)$/i;
const VAL_WORD = /^[a-z]+(?:[ -][a-z]+)*$/i;
const VAL_NUM  = /^[0-9]{1,3}$/;
/* ★부호 있는 수 — ★소비자가 더한 style prop «전용»(아래 `opts.styleProps`).
   ★왜 필요한가: 점 찍기의 `--tb-dot-i` 는 ★`-1`·`-0.5`·`0.5` 처럼 ★음수·소수다
     (`prop-text-wireup-text-edit.js:655` `String(i - (n - 1) / 2)`).
   ⛔기본 명부(RICH_TEXT_ALLOWED_STYLE_PROPS)의 값 검사는 ★한 글자도 안 바꿨다 —
     ★이 패턴은 ★«소비자가 명시한 prop»에만 ★추가로 열린다. */
const VAL_SNUM = /^-?(?:[0-9]{1,4})(?:\.[0-9]{1,4})?$/;

/* ★1017t1h3 — ★«좁히는» 값 검사 표. ★소비자가 `opts.styleProps` 로 ★이름을 연 prop 가운데
 *   ★이 표에 ★이름이 있는 것은 ★이 패턴 ★하나만 본다 — ★`safeStyleValue` 를 ★타지 않는다.
 * ★왜 필요했나 — ★어노테이션 라벨이 ★`font-size` 를 열어야 했다(현빈 1017t1h3 「폰트크기 등 각 다르게」).
 *   ★그런데 ★`--tb-dot-i` 와 ★같은 길로 열면 ★두 가지가 ★동시에 틀어진다(1017t1h3 음성대조 실측 —
 *     이 표를 ★비운 판에서 ★직접 재서 ★확인했다. ⛔코드를 읽고 「그럼 된다」로 적지 않았다):
 *     ㉠ ★샌다 — `safeStyleValue` 의 ★`VAL_WORD`(`/^[a-z]+([ -][a-z]+)*$/i`)가
 *        `font-size:inherit`·`larger`·`xx-large` 를 ★통과시킨다(수가 아니라 ★낱말이다).
 *        ★위험(스크립트 실행)은 ★아니지만 ★요구가 「고른 글자만 ★몇 px」이고, 저장본을 손대 넣으면
 *        ★그 글자가 ★제 뜻 없이 ★조상 크기를 ★물려받는다.
 *     ㉡ ★★못 쓴다 — ★`14px` 가 ★막힌다. 옛 네 패턴(HEX·FUNC·WORD·NUM)과 `VAL_SNUM` ★어디에도
 *        ★«수 + 단위» 꼴이 ★없다(WORD 는 글자로 시작 · NUM·SNUM 은 단위 없는 수).
 *   ⇒ ★★이 표는 ★«샘을 막는 자»이면서 ★동시에 ★«이 기능을 ★서게 하는 자»다 — ★«수 + 단위»로만 받는다.
 * ★`px` ★하나만 — ★`em`·`%`·`rem` 은 ★조상에 달린 상대값이라 ★위와 같은 병이다. ★`calc(`·`url(` 은 ★꼴이 아니다.
 *   ★앞자리 0 금지(`[1-9]`) ⇒ ★`0px`·`0.5px`(안 보이는 글자)도 ★안 통과한다. ★1~999px.
 *   ⚠️★이 자는 ★«안전»과 ★«꼴»만 잰다 — ★UI 범위(패널 슬라이더 8~48)는 ★패널이 잰다(여기서 또 재면 명부가 둘이 된다).
 * ⛔★표에 ★없는 prop 은 ★한 줄도 안 달라진다 — ★기본 명부와 ★`--tb-dot-i` 는 ★옛 길 그대로다.
 *   ★★그 무변을 ★tests/unit/annot-label-rich-text-1017t1h3.test.mjs 가 ★기본 명부 ★다섯을 ★전수로 잰다. */
const VAL_FONT_SIZE_PX = /^[1-9][0-9]{0,2}(?:\.[0-9]{1,3})?px$/;
export const RICH_TEXT_STRICT_STYLE_VALS = new Map([['font-size', VAL_FONT_SIZE_PX]]);

function safeStyleValue(rawVal) {
  const v = String(rawVal).trim();
  if (!v) return null;
  if (VAL_HEX.test(v) || VAL_FUNC.test(v) || VAL_WORD.test(v) || VAL_NUM.test(v)) return v;
  return null; // url(...)·expression(...)·javascript:·기타 함수/특수문자 = 그 선언 제거 (#4 교훈)
}

/* ★«소비자가 허용목록을 준다»(수지⑦ 2026-10-08 · 지디 판정) ────────────────────
 * ⛔공용 필터를 ★전부에게 ★넓히지 않는다 — 넓히면 ★스티커·모달의 ★공격면이 ★같이 는다.
 *   ⇒ ★본문(이 모듈)은 ★하나로 두고, ★«어디까지 허용하나»만 ★소비자가 ★인자로 준다.
 * ★`opts` 를 ★안 주면 ★★지금 동작 그대로다 — ★그 무변을 ★검사가 잠근다
 *   (`rich-text-consumer-sticker.dom.spec.js` 5칸 ＋ `sz7-grid-rich-text` 의 ★무변 칸).
 * ★모양: `{ classes: ['tb-hl','tb-dot'], styleProps: ['--tb-dot-i'] }`
 *   ⛔둘 다 ★«화이트리스트»다 — ★`class` 를 ★통째로 열지 않는다(★이름을 ★하나씩 적는다).
 */
function normOpts(opts) {
  if (!opts) return null;
  const classes = new Set();
  const styleProps = new Set();
  for (const c of (opts.classes || [])) {
    const t = String(c).trim();
    if (t) classes.add(t);
  }
  for (const p of (opts.styleProps || [])) {
    const t = String(p).trim().toLowerCase();
    if (t) styleProps.add(t);
  }
  if (!classes.size && !styleProps.size) return null;
  return { classes, styleProps };
}

/* 허용된 class 토큰만 남긴다 — `class="tb-hl evil"` → `class="tb-hl"` · `class="evil"` → 없음. */
function safeClass(raw, cfg) {
  if (!raw || !cfg || !cfg.classes.size) return '';
  const kept = String(raw).split(/\s+/).filter((t) => t && cfg.classes.has(t));
  return kept.join(' ');
}

function sanitizeStyle(styleStr, cfg) {
  if (!styleStr) return '';
  const kept = [];
  for (const decl of String(styleStr).split(';')) {
    const idx = decl.indexOf(':');
    if (idx < 0) continue;
    const prop = decl.slice(0, idx).trim().toLowerCase();
    const val  = decl.slice(idx + 1).trim();
    const isBase = RICH_TEXT_ALLOWED_STYLE_PROPS.has(prop);
    const isExtra = !!(cfg && cfg.styleProps.has(prop));
    if (!isBase && !isExtra) continue;
    /* ★기본 명부의 값 검사는 ★그대로. ★소비자가 더한 prop 만 ★부호 있는 수도 받는다.
       ⛔그래도 ★화이트리스트다 — `url(`·`javascript:` 는 ★두 패턴 ★어느 쪽도 ★통과 못 한다. */
    /* ★1017t1h3 — ★소비자가 연 prop 이고 ★좁히는 표에 ★이름이 있으면 ★그 패턴 ★하나만(위 머리말).
       ⛔`isBase` 면 ★이 갈래를 ★타지 않는다 — ★기본 명부는 ★아래 한 줄이 ★그대로 잰다. */
    const strictRe = (isExtra && !isBase) ? RICH_TEXT_STRICT_STYLE_VALS.get(prop) : null;
    const safe = strictRe
      ? (strictRe.test(val) ? val : null)
      : safeStyleValue(val) ?? (isExtra && VAL_SNUM.test(val) ? val : null);
    if (safe == null) continue;
    kept.push(`${prop}:${safe}`);
  }
  return kept.join(';');
}

function sanitizeInto(srcParent, dstParent, cfg) {
  const doc = dstParent.ownerDocument || document;
  srcParent.childNodes.forEach((node) => {
    if (node.nodeType === 3) { // 텍스트 — 제어문자만 정화(\t·\n 보존), esc는 innerHTML 직렬화가 담당
      dstParent.appendChild(doc.createTextNode(stripCtlChars(node.nodeValue)));
      return;
    }
    if (node.nodeType !== 1) return; // 주석/기타 노드 제거
    const tag = node.tagName ? node.tagName.toUpperCase() : '';
    if (tag === 'SCRIPT' || tag === 'STYLE') return; // 자식까지 통째 제거
    if (RICH_TEXT_ALLOWED_TAGS.has(tag)) {
      const clean = doc.createElement(tag.toLowerCase());
      if (tag === 'SPAN') {
        /* ★소비자가 ★이름을 ★적은 class 만 ★살린다(없으면 ★옛 동작 = ★전부 제거).
           ★`class` 를 ★`style` ★«앞»에 둔다 — ★직렬화 순서가 ★그대로 산출이 되므로
             ★`<span class="tb-dot" style="--tb-dot-i:…">` 로 ★읽는 순서와 ★같게 둔다
             (★2026-10-08 실측: 뒤에 두면 `<span style="…" class="…">` 로 나와 ★바이트 대조가 ★헛돈다). */
        const safeCls = safeClass(node.getAttribute('class'), cfg);
        if (safeCls) clean.setAttribute('class', safeCls);
        const safeStyle = sanitizeStyle(node.getAttribute('style'), cfg);
        if (safeStyle) clean.setAttribute('style', safeStyle);
      }
      if (tag !== 'BR') sanitizeInto(node, clean, cfg); // 그 외 속성(on*/href/src/id/data-*)은 미복사=제거
      dstParent.appendChild(clean);
    } else {
      sanitizeInto(node, dstParent, cfg); // 비허용 태그 = 언랩(자식만 재귀 편입)
    }
  });
}

/* ★1013t1B1 — 편집기(contenteditable) «블럭 경계»를 줄바꿈 <br> 로 펴는 «한 벌» (sanitize ★앞에서 부른다 · 옵트인).
 *   ★왜: Chrome 은 한 줄 편집 칸에서 Enter 를 `AAABBB<div>CCC</div>`(또는 `<div><br></div>` 빈 줄)로 만든다.
 *     DIV 는 허용목록에 없어 sanitizeRichTextHtml 이 «언랩»만 한다 ⇒ 줄바꿈 없이 `AAABBBCCC` 가 된다.
 *     평문 쪽(innerText → text)은 \n 을 지키므로 «text 는 두 줄인데 textHtml 은 한 줄»로 갈린다(이벨류 실측 · 서식 든 줄만).
 *   ★규칙(= innerText 와 같은 줄 수 · block-drag.js _mdlReadText 와 같은 뜻):
 *     블럭(DIV·P·LI·H1~6)은 줄을 «시작»하고(앞 줄에 글이 있으면), 끝나면 줄바꿈이 «대기»한다(뒤에 뭔가 올 때만 실제 <br>).
 *     블럭 안 «마지막» <br> 는 빈 줄 자리표시(그 줄 자체가 줄이다) — 대기 중인 줄바꿈만 꺼낸다. 그 밖의 <br> 는 그대로.
 *   ★인라인(b·i·span…)은 얕게 복사해 그 안에서 이어 간다 — 속성은 그대로 두고 ★거르는 것은 뒤의 sanitize 몫이다.
 *   ⛔sanitizeRichTextHtml 자체는 안 바꾼다(스티커·모달·그리드 산출 무변) — 부르는 자만 영향(현재 line-host 커밋 한 곳). */
const BLOCK_BREAK_RE = /^(DIV|P|LI|H[1-6])$/;
export function richTextBlocksToBreaks(html) {
  const tpl = document.createElement('template');
  tpl.innerHTML = String(html == null ? '' : html);
  const out = document.createElement('div');
  const doc = out.ownerDocument || document;
  let pending = false, lineOpen = false;
  const flush = (dst) => { if (pending) { dst.appendChild(doc.createElement('br')); pending = false; lineOpen = false; } };
  const walk = (src, dst, inBlock) => {
    src.childNodes.forEach((n) => {
      if (n.nodeType === 3) {
        if (n.nodeValue === '') return;
        flush(dst);
        dst.appendChild(doc.createTextNode(n.nodeValue));
        lineOpen = !/\n$/.test(n.nodeValue);   // 글자 \n 으로 끝나면(pre 칸의 Enter) 줄이 이미 닫혔다
        return;
      }
      if (n.nodeType !== 1) return;
      const tag = n.tagName.toUpperCase();
      if (tag === 'BR') {
        if (inBlock && !n.nextSibling) { flush(dst); return; }   // 블럭 끝 자리표시 — 줄은 블럭 자신이 낸다
        flush(dst);
        dst.appendChild(doc.createElement('br'));
        lineOpen = false;
        return;
      }
      if (BLOCK_BREAK_RE.test(tag)) {
        if (lineOpen) pending = true;
        walk(n, dst, true);
        pending = true;
        return;
      }
      if (n.textContent !== '' || n.querySelector('br')) flush(dst);   // 대기 줄바꿈은 인라인 «밖»에 — <b><br>CCC</b> 가 아니라 <br><b>CCC</b>
      const shallow = n.cloneNode(false);
      dst.appendChild(shallow);
      walk(n, shallow, false);
    });
  };
  walk(tpl.content, out, false);
  return out.innerHTML;
}

// 문자열 HTML → sanitize된 문자열 HTML. template.content(inert DocumentFragment)에서 파싱.
export function sanitizeRichTextHtml(html, opts) {
  const tpl = document.createElement('template');
  tpl.innerHTML = String(html == null ? '' : html);
  const out = document.createElement('div');
  sanitizeInto(tpl.content, out, normOpts(opts));
  return out.innerHTML;
}

// sanitize된 html에 «실제 인라인 서식»이 있는지 판정 — 서식 태그(b/strong/i/em/u/s)나 style 달린 span.
//   <br>(줄바꿈)만 있는 건 서식 아님(평문 경로 유지). finish()의 textHtml 생성 여부 판정에 사용.
export function richTextHasFormatting(html, opts) {
  if (!html) return false;
  const tpl = document.createElement('template');
  tpl.innerHTML = String(html);
  if (tpl.content.querySelector('b,strong,i,em,u,s,strike')) return true;
  const cfg = normOpts(opts);
  for (const s of tpl.content.querySelectorAll('span')) {
    if (s.getAttribute('style')) return true;
    /* ★형광펜·점은 ★`class` 로 산다(style 이 없을 수 있다) ⇒ ★허용된 class 가 붙었으면 ★서식이다.
       ⛔`opts` 를 ★안 주면 ★이 줄은 ★한 번도 ★참이 되지 않는다 = ★옛 판정 그대로. */
    if (cfg && safeClass(s.getAttribute('class'), cfg)) return true;
  }
  return false;
}
