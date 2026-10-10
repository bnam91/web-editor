/* text-style-code — ★«스타일 번호» 의 ★encode/decode. (1010t1a2 · 현빈 요구 ③)
 *
 * ══ 현빈 ★원문 (⛔요약이 아니다) ════════════════════════════════════════════
 *   「★셋 다 ★따로도 가능하고 ★일괄도 가능하게 할까? ★스타일 번호 있는데 ★하위에 각 조절되게?」
 *   ⇒ ★두 층이다: ★«복합 번호 하나» ＋ ★«하위 개별»
 *
 * ══ ★정본이 ★어디인가 — ⛔번호가 ★아니다 ═══════════════════════════════════
 *   `text-style-kinds.js:36` 이 ★이미 못박아 뒀다:
 *     「한 벌의 «값»은 ★CSS 사용자 속성 ★그 자체다 … ⛔다른 이름으로 ★갈아 적지 않는다
 *       (갈아 적으면 ★뜨기와 ★입히기 사이에 ★번역표가 생기고 ★그게 ★둘째 명부다)」
 *   ⇒ ★★정본 = ★CSS 변수 그 자체. ★★복합 번호와 ★개별 번호는 ★★둘 다 ★«파생»이다.
 *   ⇒ ★★번호는 ★어디에도 ★저장하지 ★않는다 — ★저장이 ★0개 늘어난다.
 *   ⇒ ★개별 조각은 ★복합을 ★«자른 것»이다(그 역도 성립) — ★검사가 ★그 등식을 건다.
 *
 * ══ ★이음새 — ⛔새 저장소도 ★새 번역표도 ★없다 ═════════════════════════════
 *   `captureTextStyle(k, …)` / `applyTextStyleVars(k, …)` ★짝이 ★이미 ★kind 별로 있다.
 *   ⇒ 이 파일은 ★그 둘 ★사이의 ★«글자 꼴»만 ★맡는다. ★켜기/끄기·입히기는 ★안 한다.
 *   ⛔★import 를 ★하나도 ★안 쓴다 — `text-style-kinds.js` 에 ★순환 import TDZ 위험이
 *     ★이미 적혀 있다(2026-10-09 지디 경고 · tests/dom/multisel-save-and-copy 머리말).
 *     ⇒ ★명부(roster)를 ★★«인자»로 받는다. ★그래서 이 파일은 ★평가 시점에 ★아무것도 안 끌어온다.
 *
 * ══ 꼴 ═════════════════════════════════════════════════════════════════════
 *   복합 : `T1-<hl>.<dot>.<ul>-<c>`
 *   개별 : `T1-hl:<hl>-<c>`
 *     T  꼴 이름 · 1 ★버전(⒝) · 조각은 그 kind 의 vars 를 ★명부 ★순서대로 `,` 로
 *     c  ★체크섬 ★한 글자(⒞) — ★값 ＋ ★«조각 수»와 ★«조각 안 칸 수»까지 ★먹인다
 *
 * ══ ★버전 1 은 ★3칸이다 — ⛔파생하지 ★않는다 (⒜-2 ㉢ · 지디 판정) ═══════════
 *   `TS_CODE_V1_KINDS` 를 ★못박는다. ★버전은 ★불변이기 때문이다.
 *   ⛔명부에서 ★파생하면 ★kind 가 늘 때 ★버전 1 꼴이 ★조용히 늘어난다.
 *   ⇒ ★대신 ★검사가 ★두 쪽을 ★같이 건다:
 *       ⑴ 「오늘 ★vars>0 인 kind 집합」 == `TS_CODE_V1_KINDS`   (★늘면 ★빨강 ⇒ ★버전 2 로)
 *       ⑵ 「명부에 kind 를 더해도 ★버전 1 꼴은 ★안 늘어난다」
 *     ⇒ ★그 둘이 ★짝이라 ★어느 쪽으로도 ★안 샌다.
 *   ★`grad` 가 ★버전 1 에 ★없는 까닭 = ★vars 가 ★0 이고 ★값이 ★css 문자열이다 ⇒ ★조각 길이가 안 맞는다.
 *
 * ══ 무엇을 ★«안» 하나 (⛔이 칸을 지우지 마라) ════════════════════════════════
 *   ⒜ ★입히기·켜기·끄기 — ★안 한다. ★부르는 쪽이 `text-style-chips` 의 `onPick` ★길을 탄다
 *      (「켜고 → 입힌다」 순서가 ★그 한 자리에만 있다 — ★둘로 만들면 ★둘째 명부다).
 *   ⒝ ★★«빈 조각»의 ★뜻 — ★★미결이다. ⒤그 kind 를 ★손대지 않는다 / ⅱ)★끈다.
 *      ⇒ ★★이 파일은 ★그 갈림에 ★★안 걸린다 — `decode` 는 ★«빈 조각»을 ★`null` 로 돌려주고
 *        ★그 뜻은 ★부르는 쪽이 정한다. ★★갈림이 정해지면 ★그 자리 ★한 곳만 고친다.
 *   ⒞ ★최근 큐·칩 — ★안 건드린다(⒟ 「칩과 같이」 — 번호가 칩을 ★대체하지 ★않는다).
 *   ⒟ ★grad — ★버전 1 에 ★없다(위).
 */

/** 꼴 이름 — 번호가 ★다른 꼴의 번호와 섞이지 않게. */
export const TS_CODE_PREFIX = 'T';

/** ★버전(⒝) — 꼴이 바뀌면 ★올린다. ★옛 번호는 ★거절된다(★조용히 다른 그림이 되지 않게). */
export const TS_CODE_VERSION = 1;

/** ★버전 1 의 조각 명부 — ⛔못박는다(위 머리말). */
export const TS_CODE_V1_KINDS = ['hl', 'dot', 'ul'];

/* ── 글자 escape — ★값 안에 ★구분자가 ★들어간다 ─────────────────────────────
 * ★실물 값에 ★정말 들어간다:
 *   `,` — `rgba(255,0,0,.5)`           `-` — `--tb-ul-offset` 의 ★음수(min -10)
 *   `.` — `0.5px` · `rgba(…,.5)`       `%` — escape 자신
 * ⇒ ★그 넷만 ★`%XX` 로 바꾼다. ⛔encodeURIComponent 를 쓰지 않는다 —
 *   그건 ★`(` `)` 까지 ★안 건드리거나 ★더 건드려서 ★꼴이 ★길어지고, ★되돌리기가 ★모호해진다. */
const ESC = { '%': '%25', ',': '%2C', '.': '%2E', '-': '%2D', ':': '%3A' };
const UNESC = { 25: '%', 2: null };     // 아래 unesc 가 두 글자를 직접 읽는다

export function tsEsc(s) {
  return String(s == null ? '' : s).replace(/[%,.\-:]/g, (ch) => ESC[ch]);
}
export function tsUnesc(s) {
  return String(s == null ? '' : s).replace(/%([0-9A-Fa-f]{2})/g, (_m, h) => String.fromCharCode(parseInt(h, 16)));
}

/* ── 체크섬(⒞) — ★한 글자 ─────────────────────────────────────────────────
 * ★값만 먹이면 ★«조각 안에서 칸이 ★한 칸 밀린» 오타를 ★못 잡는다
 *   (dot 은 vars 가 ★5개다 ⇒ `size` 가 `gap` 으로 ★조용히 들어간다).
 * ⇒ ★★«조각 수»와 ★«조각마다 칸 수»를 ★같이 먹인다. */
export function tsChecksum(body, shape) {
  const s = `${body}|${shape.join('x')}`;
  let h = 7;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 1296;   // 36^2
  return h.toString(36).padStart(2, '0');
}

/** 명부에서 그 kind 의 vars 를 꺼낸다. ⛔이름을 손으로 적지 않는다. */
function varsOf(roster, k) {
  const d = (roster || []).find((x) => x && x.k === k);
  return d && Array.isArray(d.vars) ? d.vars : null;
}

/** 버전 1 의 «조각 모양» — 조각마다 칸이 몇이냐. 체크섬이 이것까지 먹는다. */
export function tsShape(roster, kinds = TS_CODE_V1_KINDS) {
  return kinds.map((k) => (varsOf(roster, k) || []).length);
}

/**
 * ★복합 번호를 짓는다.
 * @param {Array} roster     TEXT_STYLE_KINDS (★인자로 받는다 — import 0)
 * @param {Object} valsByKind {hl:{'--tb-hl-color':'#f00',…}|null, dot:…, ul:…}
 * @returns {string|null}    `T1-….….…-cc` · 명부가 안 맞으면 null
 */
export function tsEncode(roster, valsByKind, kinds = TS_CODE_V1_KINDS) {
  const shape = tsShape(roster, kinds);
  if (shape.some((n) => n === 0)) return null;        // 명부에 없는 kind — 꼴을 못 만든다
  const segs = kinds.map((k) => {
    const vars = varsOf(roster, k);
    const v = (valsByKind && valsByKind[k]) || null;
    if (!v) return '';                                 // ★꺼져 있다 = ★빈 조각
    return vars.map((name) => tsEsc(v[name] || '')).join(',');
  });
  const body = segs.join('.');
  return `${TS_CODE_PREFIX}${TS_CODE_VERSION}-${body}-${tsChecksum(body, shape)}`;
}

/** ★개별 번호 — ★복합에서 ★그 조각만. ⛔따로 만들지 않고 ★같은 자를 ★부른다. */
export function tsEncodeOne(roster, k, vals) {
  const vars = varsOf(roster, k);
  if (!vars || !vars.length) return null;
  const body = vals ? vars.map((name) => tsEsc(vals[name] || '')).join(',') : '';
  return `${TS_CODE_PREFIX}${TS_CODE_VERSION}-${k}:${body}-${tsChecksum(`${k}:${body}`, [vars.length])}`;
}

/**
 * 번호를 읽는다.
 * @returns {{ok:true, kinds:string[], vals:Object}|{ok:false, why:string}}
 *   ★vals[k] === null  ⇒ ★«빈 조각». ⛔그 뜻(손대지 않는다 / 끈다)은 ★여기가 정하지 않는다.
 */
export function tsDecode(roster, str, kinds = TS_CODE_V1_KINDS) {
  const s = String(str == null ? '' : str).trim();
  if (!s) return { ok: false, why: '빈 글자' };
  const m = /^([A-Za-z])(\d+)-([\s\S]*)-([0-9a-z]{2})$/.exec(s);
  if (!m) return { ok: false, why: '꼴이 아니다 (T<버전>-<본문>-<체크섬>)' };
  const [, prefix, verStr, body, sum] = m;
  if (prefix !== TS_CODE_PREFIX) return { ok: false, why: `꼴 이름이 ${prefix} 다 (${TS_CODE_PREFIX} 여야)` };
  const ver = Number(verStr);
  if (ver !== TS_CODE_VERSION) {
    return { ok: false, why: `버전 ${ver} 번호다 — 이 판은 ${TS_CODE_VERSION} 만 읽는다(옛 번호는 ★조용히 다른 그림이 된다)` };
  }
  /* 개별 꼴 — `hl:...` */
  const one = /^([a-z]+):([\s\S]*)$/.exec(body);
  if (one) {
    const k = one[1];
    const vars = varsOf(roster, k);
    if (!vars || !vars.length) return { ok: false, why: `명부에 없는 kind: ${k}` };
    if (tsChecksum(body, [vars.length]) !== sum) return { ok: false, why: '체크섬이 안 맞는다 — 붙여넣기 오타' };
    const cells = one[2] === '' ? null : one[2].split(',');
    if (cells && cells.length !== vars.length) {
      return { ok: false, why: `칸이 ${cells.length}개다 — ${k} 는 ${vars.length}개여야 한다` };
    }
    const vals = {};
    vals[k] = cells ? Object.fromEntries(vars.map((n, i) => [n, tsUnesc(cells[i])])) : null;
    return { ok: true, kinds: [k], vals };
  }
  /* 복합 꼴 */
  const shape = tsShape(roster, kinds);
  if (shape.some((n) => n === 0)) return { ok: false, why: '명부가 이 버전의 꼴과 안 맞는다' };
  if (tsChecksum(body, shape) !== sum) return { ok: false, why: '체크섬이 안 맞는다 — 붙여넣기 오타' };
  const segs = body.split('.');
  if (segs.length !== kinds.length) {
    return { ok: false, why: `조각이 ${segs.length}개다 — 버전 ${TS_CODE_VERSION} 은 ${kinds.length}개다` };
  }
  const vals = {};
  for (let i = 0; i < kinds.length; i++) {
    const k = kinds[i];
    const vars = varsOf(roster, k);
    if (segs[i] === '') { vals[k] = null; continue; }            // ★빈 조각 — 뜻은 부르는 쪽이
    const cells = segs[i].split(',');
    if (cells.length !== vars.length) {
      return { ok: false, why: `${k} 조각의 칸이 ${cells.length}개다 — ${vars.length}개여야 한다` };
    }
    vals[k] = Object.fromEntries(vars.map((n, j) => [n, tsUnesc(cells[j])]));
  }
  return { ok: true, kinds: kinds.slice(), vals };
}

/** ★복합에서 ★개별 조각을 ★자른다 — ★개별 칸이 ★이것과 ★한 글자도 달라선 안 된다. */
export function tsSliceOne(roster, composite, k, kinds = TS_CODE_V1_KINDS) {
  const r = tsDecode(roster, composite, kinds);
  if (!r.ok) return null;
  if (!(k in r.vals)) return null;
  return tsEncodeOne(roster, k, r.vals[k]);
}
