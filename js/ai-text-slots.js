/* ai-text-slots.js — «텍스트 블록(.text-block)의 글자가 어디 사는가»의 정본 (2026-10-03 · AI 묶음 A)
 *
 * ★왜 있나 — AI 섹션 채우기(js/ai-section-fill.js)가 말풍선·불릿·라이너의 «구조를 통째로 지웠다».
 *   실측(실앱 + Gemini): 채우기 뒤 말풍선 .tb-bubble/.tb-sender-name/svg 1→0, 불릿 ul.tb-bullet>li →0,
 *   라이너 .tb-liner + svg 미러 →0. 래퍼(.text-block)에 글자만 남았다.
 *   뿌리 — 읽는 쪽과 쓰는 쪽이 «셀렉터 명부를 따로» 들고 있었다:
 *     읽기  '.tb-h1, .tb-h2, .tb-h3, .tb-body, .tb-caption, .tb-label, .tb-bubble'
 *     쓰기  '.tb-h1, .tb-h2, .tb-h3, .tb-body, .tb-caption, .tb-label'   || tb   ← 래퍼에 textContent
 *   읽기는 말풍선을 «보는데» 쓰기는 못 봐서 래퍼로 떨어졌고, 불릿·라이너는 둘 다 몰랐다.
 *   ⇒ 명부를 «하나»로 만들고 읽기·쓰기가 둘 다 여기서 «파생»한다. 경고 주석으로 두 벌을 맞추지 않는다.
 *
 * ⛔래퍼(.text-block)에 글자를 쓰지 마라. 자리를 못 찾으면 «건너뛴다»(findTextSlot → null).
 *   래퍼 textContent 대입은 그 안의 모든 자식(말풍선 꼬리 svg·보낸이 이름·li·라이너 svg)을 지운다.
 *
 * 종류(TEXT_SLOT_KINDS) — 새 텍스트 변형이 생기면 «여기 한 줄»만 더한다:
 *   plain  .tb-h1 … .tb-label        textContent 그대로
 *   bullet .tb-bullet (ul)           ★줄바꿈으로 나눠 li 하나씩(아래 writeBulletText 규칙)
 *   bubble .tb-bubble                textContent. ★보낸이 이름(.tb-sender-name)은 «슬롯이 아니다» — 안 건드린다
 *   liner  .tb-liner (편집 미러)     textContent(줄바꿈은 공백으로) → 라이너 자신의 재렌더(ensureLiner)로 SVG 동기화
 *
 * 이 파일은 import 가 없고 최상위에서 DOM 을 만지지 않는다 — node 단위 시험이 data: URL 로 그대로 읽는다
 *   (tests/unit/ai-text-slots-ssot.test.mjs: 서비스 3벌의 STYLE_HINTS 가 여기 style 을 다 받는지 센다).
 */

/* ★글자를 쓰면 «안내문구 표식»을 뗀다 (2026-09-22 · T-039) — js/ai-section-fill.js 에서 옮겨 왔다.
 *   AI 채우기 경로는 DOM 에 textContent 를 직접 쓰는데 `data-is-placeholder="true"` 를 떼는 코드가 없었다.
 *   ⇒ 화면엔 AI 가 채운 본문이 보이지만 캡처 클론은 js/io/capture-safety.js hidePlaceholderTextForCapture 가
 *     그 본문을 visibility:hidden 으로 가린다 ⇒ PNG·단독 HTML·썸네일이 «내용 없는 흰 페이지»가 된다.
 *   ⛔빈 글자를 써 넣을 땐 «떼지 않는다» — 그건 도로 안내문구 상태다
 *     (block-drag.js 「안내문구가 본문으로 굳는 지뢰 방지」와 같은 결론).
 *   ★읽는 쪽(capture-safety.js)도 같은 패치에서 글자를 보게 고쳤다. */
function _clearPlaceholderFlagIfFilled(el, text) {
  const t = String(text ?? '').trim();
  if (t === '') return;
  const ph = (el.dataset?.placeholder || '').trim();
  if (t !== ph) delete el.dataset.isPlaceholder;
}
export function writeFilledText(el, text) {
  if (!el) return;
  el.textContent = text;
  _clearPlaceholderFlagIfFilled(el, text);
}

const PLAIN_CLASSES = ['tb-h1', 'tb-h2', 'tb-h3', 'tb-body', 'tb-caption', 'tb-label'];

/* 글머리 기호를 AI 가 붙여 보내면 li 의 list-style 과 겹쳐 «• • 항목» 이 된다 — 기호만 뗀다(숫자는 안 뗀다). */
const BULLET_MARK_RE = /^\s*[-*•·▪◦‣]\s+/;

/** 불릿 매핑 규칙:
 *   ① 글자를 줄바꿈(\n, \r\n)으로 나눈다 ② 줄 앞 글머리 기호(- * • · ▪ ◦ ‣ + 공백)를 떼고 앞뒤 공백을 자른다
 *   ③ 빈 줄은 버린다 ④ i 번째 줄 → i 번째 기존 li(속성·클래스 그대로, textContent 만 교체)
 *   ⑤ 줄이 더 많으면 «마지막 li 의 얕은 복제»(속성·클래스 복사, 내용 없음)를 덧붙인다
 *   ⑥ 줄이 더 적으면 남는 li 를 뗀다 ⑦ 줄이 0개(빈 응답)면 li 하나에 <br> — makeTextBlock blank 꼴과 같다
 *   ul 자체(클래스·style·data-*)는 안 건드린다. 표식은 «합친 글자»가 안내문구와 다를 때만 뗀다. */
function writeBulletText(ul, text) {
  if (ul.tagName !== 'UL') { writeFilledText(ul, text); return; }   // 방어: div.tb-bullet 은 만들어지지 않지만 래퍼로는 안 떨어진다
  const lines = String(text ?? '').split(/\r?\n/)
    .map(s => s.replace(BULLET_MARK_RE, '').trim())
    .filter(s => s !== '');
  const lis = [...ul.children].filter(c => c.tagName === 'LI');
  const template = lis[lis.length - 1] || null;
  const want = Math.max(1, lines.length);
  for (let i = 0; i < want; i++) {
    let li = lis[i];
    if (!li) {
      li = template ? template.cloneNode(false) : ul.ownerDocument.createElement('li');
      ul.appendChild(li);
    }
    if (lines.length === 0) li.replaceChildren(ul.ownerDocument.createElement('br'));
    else li.textContent = lines[i];
  }
  lis.slice(want).forEach(li => li.remove());
  _clearPlaceholderFlagIfFilled(ul, lines.join('\n'));
}

function readBulletText(ul) {
  const lis = [...ul.children].filter(c => c.tagName === 'LI');
  if (lis.length === 0) return ul.textContent || '';
  return lis.map(li => (li.textContent || '').trim()).join('\n');
}

/* 라이너 매핑 규칙: SVG textPath 는 한 줄이다 — 줄바꿈(과 그 둘레 공백)은 공백 하나로 합쳐 미러(.tb-liner)에 쓴다.
 *   그다음 라이너 «자신의» 재렌더를 부른다: ensureLiner = applyLiner(폭·path·폰트 재계산) + applyLinerText(미러→textPath).
 *   (js/liner-transform.js 는 classic 스크립트라 window 로만 닿는다. 없으면 텍스트만이라도 맞춘다.) */
function writeLinerText(mirror, text, block) {
  const one = String(text ?? '').replace(/\s*\r?\n\s*/g, ' ');
  writeFilledText(mirror, one);
  const w = (typeof window !== 'undefined') ? window : null;
  if (block?.dataset?.liner && typeof w?.ensureLiner === 'function') w.ensureLiner(block);
  else w?.applyLinerText?.(block);
}

/** 정본 명부. selector 는 그 종류의 «글자 요소»를 고른다(래퍼 안에서). styles 는 AI 에 보내는 style 값 후보. */
export const TEXT_SLOT_KINDS = Object.freeze([
  Object.freeze({ kind: 'plain',  selector: PLAIN_CLASSES.map(c => '.' + c).join(', '), styles: Object.freeze([...PLAIN_CLASSES]) }),
  Object.freeze({ kind: 'bullet', selector: '.tb-bullet', styles: Object.freeze(['tb-bullet']) }),
  Object.freeze({ kind: 'bubble', selector: '.tb-bubble', styles: Object.freeze(['tb-bubble']) }),
  Object.freeze({ kind: 'liner',  selector: '.tb-liner',  styles: Object.freeze(['tb-liner']) }),
]);
/** 읽기·쓰기 공용 셀렉터 — 명부에서 «파생»한다(손으로 다시 적지 마라). */
export const TEXT_SLOT_SELECTOR = TEXT_SLOT_KINDS.map(k => k.selector).join(', ');

/** text-block 래퍼 → { kind, el, style, block } | null. null 이면 «쓸 자리가 없다» = 건너뛴다. */
export function findTextSlot(tb) {
  if (!tb || typeof tb.querySelector !== 'function') return null;
  const el = tb.querySelector(TEXT_SLOT_SELECTOR);
  if (!el) return null;
  const k = TEXT_SLOT_KINDS.find(x => el.matches(x.selector));
  if (!k) return null;
  const style = [...el.classList].find(c => c.startsWith('tb-')) || 'tb-body';
  return { kind: k.kind, el, style, block: tb };
}

/** 그 자리의 현재 글자(불릿은 li 를 줄바꿈으로 잇는다). */
export function readTextSlot(slot) {
  if (!slot) return '';
  if (slot.kind === 'bullet' && slot.el.tagName === 'UL') return readBulletText(slot.el);
  return slot.el.textContent || '';
}

/** 그 자리에 글자를 쓴다. 썼으면 true. slot 이 없으면 아무것도 안 하고 false(★래퍼로 떨어지지 않는다). */
export function writeTextSlot(slot, text) {
  if (!slot || !slot.el) return false;
  if (slot.kind === 'bullet') writeBulletText(slot.el, text);
  else if (slot.kind === 'liner') writeLinerText(slot.el, text, slot.block);
  else writeFilledText(slot.el, text);
  return true;
}
