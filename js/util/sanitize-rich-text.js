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
    const safe = safeStyleValue(val) ?? (isExtra && VAL_SNUM.test(val) ? val : null);
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
