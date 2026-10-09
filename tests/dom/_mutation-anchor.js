/* _mutation-anchor.js — 「변이 닻이 ★살아 있나」를 ★심기 «전»에 ★Node 쪽에서 잰다.
 *
 * ★★왜 이 파일이 ★하나인가 — ★소비자가 ★다섯이다
 *   grid-line-drag · grid-line-move-across-cells · grid-line-move-cmdarrow ·
 *   grid-nested-inline-edit · grid-nested-line-select
 *   ⚠️★이 명부는 ★손으로 든 수다 ⇒ ★묵는다. ★세는 자리:
 *     `grep -rl assertAnchorsAlive tests/dom | grep -c 'dom.spec.js'`
 *   ★그중 ★«실제로 노출된» 것은 ★`boot(page, X)` 로 ★변이를 ★넘기는 벌뿐이다 —
 *     ★2026-10-10 실측 = ★★4벌(★cmdarrow 는 ★변이 0 ⇒ ★죽은 보일러플레이트).
 *     ★그 가름은 ★★«이 본문을 무력화하면 ★몇 벌이 빨개지나»로 ★쟀다(★빨강 11 / 4벌). ⛔문자열 유무로 ★세지 마라.
 *   ⇒ ★★같은 단언을 ★다섯 벌 ★베껴 두면 ★그게 ★«명부 둘»이다. ★한 벌로 두고 ★파생시킨다.
 *   ⇒ ★★양성대조가 ★구조로 선다: ★★이 본문을 ★무력화하면 ★★소비자 ★다섯이 ★전부 ★빨강이어야 한다.
 *
 * ★★★쓰는 법 — ★소비자가 ★늘 때 ★이 네 줄만 보면 된다
 *   ⑴ `const { assertAnchorsAlive } = require('./_mutation-anchor.js');`
 *   ⑵ 제 `boot(page, mutate)` 안, ★`page.route(...)` ★«앞»에 한 줄:
 *        `assertAnchorsAlive(REPO, mutate);`
 *      ★★⛔route 뒤에 두면 ★늦다 — 닻 부재가 ★페이지로 던져져 ★30초 타임아웃이 된다.
 *   ⑶ `REPO` = 레포 뿌리 절대경로 · `mutate` = `{path, from, to}` ★하나 또는 ★배열.
 *      `path` 는 ★레포 뿌리 기준(★`/js/...`) — route 가 쓰는 `url.pathname` 과 ★같은 꼴.
 *   ⑷ ★제 사본을 들고 있었다면 ★지우고 ★이걸 불러라 — ★★명부가 ★둘이면 ★갈라진다.
 *      (★2026-10-10 t3a4 가 ★이 규율 셋을 ★손으로 들였다 ⇒ ★머지되면 ★그가 ★여섯째 소비자다)
 *
 * ★★무슨 사고를 막는가 (2026-10-10 실측)
 *   `34db28d8`(2026-10-08)이 `js/block-drag.js` 의 그 줄에 ★`textHtml` 을 더하자
 *   `grid-nested-inline-edit` 의 닻 `… np: addr.np, text }` 이 ★안 맞게 됐다. 그러면 boot() 의
 *   route 가 모듈 자리에 `throw MUTATION_ANCHOR_MISSING` 을 내려보내고 ⇒ `window.__ready` 가
 *   ★영영 안 서고 ⇒ ★`waitForFunction` ★30초 ★타임아웃.
 *   ★★그 결과 ★★로그에 「MUTATION_ANCHOR_MISSING」이 ★★안 남는다 — ★사람은 ★「느리다/흔들린다」로
 *   읽는다. ★실제로 ★그렇게 ★읽혔고 ★★양성대조 P2 가 ★12일간 ★죽은 채 ★돌았다.
 *   ⇒ ★★그래서 ★«페이지로 던지지» 말고 ★★«Node 에서 이름을 대고 즉시» 터뜨린다.
 *
 * ★★이 자가 ★재는 것 — ★자 이름: `String.prototype.split` 로 센 ★비중첩 ★일치 횟수 ＋ ★문자 경계
 *   ⑴ 닻(`from`)이 ★«정확히 1회» 있나   — ⛔`>=1` 이 아니다
 *   ⑵ 바꿔 보면 ★정말 ★달라지나        — ★«행동»으로 잰다(⛔`to` 의 ★출현 수로 ★재지 않는다)
 *   ⑶ 그 1회가 ★«낱말 경계»에 있나      — 더 긴 이름 ★안에 걸린 것이 아닌가
 *
 * ★★⛔이 자가 ★안 재는 것 (★수만 떼어 가지 말라고 ★여기 ＋ 실패 문구에 ★박아 둔다)
 *   ⛔변이가 ★«의도한 행동»을 바꾸는지는 ★안 잰다 — ★그건 그 시험의 ★양성대조가 할 일이다.
 *   ⛔`to` 로 바꾼 ★뒤 소스가 ★문법으로 ★성립하는지 ★안 잰다(★파싱하지 않는다).
 *   ⛔`MUTATION_ANCHOR_MISSING` ★꼴이 ★아닌 변이(★인라인 모듈 치환 등)는 ★이 분모에 ★없다.
 *   ⛔한 파일에 ★변이 ★여럿이 ★겹칠 때 ★«서로를 가리는지»는 ★안 잰다(각각 1회만 본다).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { expect } = require('@playwright/test');

const IDENT = /[A-Za-z0-9_$]/;

/** 변이 명부가 «심을 수 있는 상태»인지 단언한다. ⛔못 심을 상태면 그 자리에서 이름을 대고 터진다. */
function assertAnchorsAlive(REPO, mutate) {
  const muts = !mutate ? [] : (Array.isArray(mutate) ? mutate : [mutate]);
  for (const m of muts) {
    const f = path.join(REPO, m.path);
    expect(fs.existsSync(f), `⛔변이 대상 파일이 없다 — ${m.path}`).toBe(true);
    const txt = fs.readFileSync(f, 'utf8');

    /* ⑴ 정확히 1회 — 0회 = 닻이 어긋났다(소스가 바뀌었다) · 2회+ = replace 가 첫 자리만 바꿔 변이가 반쪽 */
    const hits = txt.split(m.from).length - 1;
    expect(
      hits,
      `⛔변이 닻이 ${hits}회 일치한다(★정확히 1회여야 한다) — ${m.path}\n`
      + `  ★닻: ${JSON.stringify(m.from)}\n`
      + `  ★0회 = 소스가 바뀌어 닻이 어긋났다(그 줄을 찾아 닻을 고쳐라).\n`
      + `  ★2회+ = replace 가 첫 자리만 바꾼다 ⇒ 변이가 반쪽만 들어가 양성대조가 «딴 것»을 잰다.\n`
      + `  ⛔이 자는 «변이가 의도한 행동을 바꾸는지»는 안 잰다.`,
    ).toBe(1);

    /* ⑵ 변이가 ★정말로 소스를 바꾸나 — ★«행동»으로 잰다.
       ★★⛔내가 처음 쓴 자는 ★틀렸다(2026-10-10, ★내가 깨뜨리고 ★내가 고쳤다):
         「`to` 가 ★파일 어딘가에 ★이미 있으면 no-op」이라 ★적었다 ⇒ ★★4벌을 ★거짓으로 ★빨갛게 했다.
         ★실례: from `if (opts.noHistory !== true) window.pushHistory?.();`
                to   `window.pushHistory?.();`  ← ★이 ★짧은 꼴은 ★같은 파일에 ★3번 ★정당하게 있다.
         ⇒ ★★«결과 문자열이 ★어딘가 있다»와 ★«바꿔도 ★안 바뀐다»는 ★다른 양이다.
       ★그래서 ★바꿔 보고 ★달라지는지를 ★본다. ⇒ ★잡는 것 = ★`from === to`(짜다가 빠뜨린 꼴).
       ⚠️★이 단언은 ★★약하다 — ⑴이 ★1회를 ★이미 잠갔으니 ★`from !== to` 면 ★거의 늘 참이다.
         ★그래도 ★둔다: ★틀린 ★강한 자보다 ★맞는 ★약한 자가 낫다. */
    expect(
      txt.replace(m.from, m.to) === txt,
      `⛔변이가 소스를 ★하나도 안 바꾼다(no-op) — ${m.path}\n`
      + `  ★닻: ${JSON.stringify(m.from)}\n  ★결과: ${JSON.stringify(m.to)}\n`
      + `  ⇒ from 과 to 가 같은지 보라.`,
    ).toBe(false);

    /* ⑶ 낱말 경계 — 더 긴 이름 «안»에 걸린 1회를 거절한다.
       ★까닭(2026-10-10 t3a4 M8): `indexOf('…Clone')` 이 `…CloneRENAMED` 를 접두사로 맞아
       ★변이가 «조용히» 통과했다. ⇒ 1회여도 «그 1회가 맞는 자리인가»를 따로 본다. */
    const at = txt.indexOf(m.from);
    const before = at > 0 ? txt[at - 1] : '';
    const after = txt[at + m.from.length] || '';
    if (IDENT.test(m.from[0]) && IDENT.test(before)) {
      expect(
        `${before}|${m.from.slice(0, 24)}`,
        `⛔닻 ★앞이 낱말 경계가 아니다 — 더 긴 이름 «안»에 걸렸다: ${m.path}\n  앞 글자: ${JSON.stringify(before)}`,
      ).toBe('<낱말 경계>');
    }
    if (IDENT.test(m.from[m.from.length - 1]) && IDENT.test(after)) {
      expect(
        `${m.from.slice(-24)}|${after}`,
        `⛔닻 ★뒤가 낱말 경계가 아니다 — 더 긴 이름 «안»에 걸렸다: ${m.path}\n  뒤 글자: ${JSON.stringify(after)}`,
      ).toBe('<낱말 경계>');
    }
  }
  return muts;
}

module.exports = { assertAnchorsAlive };
